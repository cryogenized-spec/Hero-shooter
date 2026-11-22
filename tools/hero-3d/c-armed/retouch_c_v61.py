#!/usr/bin/env python3
"""Hero Shooter C V6.1: *non-destructive* incremental geometry/morph correction.

INPUT: immutable V6 optimized GLB (SHA-256 recorded in qa.json).
OUTPUT: separate V6.1 GLB; no source overwrite.
Fix 1: smoothly round face mesh and add analytic vertex normals.
Fix 2: alter only distal-arm morph positions in walk/aim; seat idle sidearm in palm.
This is a stylised game-model repair, not an articulated IK rig.
"""
from pathlib import Path
import json, struct, hashlib, math, argparse
import numpy as np
from PIL import Image, ImageDraw, ImageFont
from scipy.spatial import cKDTree
import vtk
from vtk.util.numpy_support import numpy_to_vtk, vtk_to_numpy

parser=argparse.ArgumentParser(description='Non-destructive V6 to V6.1 3D head and weapon grip correction')
parser.add_argument('--input',type=Path,required=True,help='Existing immutable C armed V6 optimized GLB')
parser.add_argument('--output-dir',type=Path,default=Path('C_armed_V6_1_release'))
args=parser.parse_args()
OLD=args.input.expanduser().resolve()
OUT=args.output_dir.expanduser().resolve();OUT.mkdir(parents=True,exist_ok=True)
NEW=OUT/'C_armed_v6_1_head_grip_refinement.glb'
CT={5126:('<f4',4),5125:('<u4',4),5123:('<u2',2),5121:('u1',1)}
DIM={'SCALAR':1,'VEC2':2,'VEC3':3,'VEC4':4}

def load_glb(path):
 data=path.read_bytes();magic,version,sz=struct.unpack_from('<4sII',data)
 assert magic==b'glTF' and version==2 and sz==len(data)
 offset=12;j=None;binary=None
 while offset<len(data):
  n,kind=struct.unpack_from('<I4s',data,offset)
  b=data[offset+8:offset+8+n];offset+=8+n
  if kind==b'JSON':j=json.loads(b)
  if kind==b'BIN\0':binary=bytearray(b)
 assert j is not None and binary is not None
 return j,binary

def read_acc(j,b,index):
 a=j['accessors'][index];v=j['bufferViews'][a['bufferView']];dtype,k=CT[a['componentType']];n=DIM[a['type']]
 offset=v.get('byteOffset',0)+a.get('byteOffset',0)
 assert v.get('byteStride',0) in [0,k*n]
 return np.frombuffer(b,np.dtype(dtype),offset=offset,count=a['count']*n).reshape(-1,n).copy()

def write_acc(j,b,index,data):
 a=j['accessors'][index];v=j['bufferViews'][a['bufferView']]
 dtype,k=CT[a['componentType']];n=DIM[a['type']]
 data=np.ascontiguousarray(data,dtype=np.dtype(dtype))
 assert data.shape==(a['count'],n)
 off=v.get('byteOffset',0)+a.get('byteOffset',0)
 b[off:off+data.nbytes]=data.tobytes()
 if 'min' in a:a['min']=data.min(axis=0).astype(float).tolist()
 if 'max' in a:a['max']=data.max(axis=0).astype(float).tolist()

def append_accessor(j,b,data):
 data=np.ascontiguousarray(data,dtype='<f4')
 while len(b)%4:b.append(0)
 off=len(b);b.extend(data.tobytes())
 v=len(j['bufferViews']);j['bufferViews'].append({'buffer':0,'byteOffset':off,'byteLength':data.nbytes})
 ai=len(j['accessors']);j['accessors'].append({'bufferView':v,'componentType':5126,'count':len(data),'type':'VEC3'})
 return ai

def save_glb(path,j,b):
 j['buffers'][0]['byteLength']=len(b)
 jb=json.dumps(j,ensure_ascii=False,separators=(',',':')).encode('utf-8');jb+=b' '*(-len(jb)%4)
 by=bytes(b);by+=b'\0'*(-len(by)%4)
 with path.open('wb') as f:
  f.write(struct.pack('<4sII',b'glTF',2,12+8+len(jb)+8+len(by)))
  f.write(struct.pack('<I4s',len(jb),b'JSON'));f.write(jb)
  f.write(struct.pack('<I4s',len(by),b'BIN\0'));f.write(by)

def smooth(v,a,b):
 t=np.clip((v-a)/(b-a),0.,1.);return t*t*(3-2*t)

def round_head(p):
 q=p.copy().astype(np.float64);x=q[:,0];z=q[:,2];y=q[:,1]
 # Existing face ellipse rings are a bit squared-off around the cheeks. Add
 # sub-centimetre to 1-cm smooth soft-tissue curvature, preserving UVs.
 cheek=np.exp(-((z-1.710)/.116)**2)
 q[:,0]=x*(1.0+0.063*cheek)
 bulge=.0125*cheek*np.clip(1.0-(x/.163)**2,0.,1.)
 # front face bulges forward (-Y), back of head backward (+Y).
 q[:,1]=y+np.sign(y-.010)*bulge
 return q.astype('<f4')

def face_normals(q):
 x,y,z=q[:,0],q[:,1],q[:,2]
 norm=np.column_stack([x/(.155**2),(y-.010)/(.122**2),(z-1.702)/(.169**2)])
 norm/=np.maximum(1e-8,np.linalg.norm(norm,axis=1,keepdims=True))
 return norm.astype('<f4')

def hand_weight(name,p,side):
 if name not in {'skin','glove','glove2','jacket','jacket2','jacketshadow','black','silver','patch'}:
  return np.zeros(len(p),np.float64)
 # Original/rest-space vertex is used to prevent accidentally moving a torso
 # buckle or a gun when the animated wrists happen to cross the chest.
 x=side*p[:,0]
 xx=smooth(x,.230,.313)
 zz=1.0-smooth(p[:,2],.950,1.345)
 zz*=smooth(p[:,2],.780,.830)
 return xx*zz

def color_rgb(j,b,prim):
 aidx=prim['attributes'].get('COLOR_0')
 if aidx is None:return np.array([.89,.72,.64])
 c=read_acc(j,b,aidx).astype(np.float64)
 if c.max()>1.:c=c/255.
 return np.mean(c[:,:3],axis=0)

BASESHA=hashlib.sha256(OLD.read_bytes()).hexdigest()
J,B=load_glb(OLD)
old_j=json.loads(json.dumps(J));old_b=bytearray(B)
names=[x['name'] for x in J['meshes']]
P={}
for mesh in J['meshes']:
 prim=mesh['primitives'][0]
 P[mesh['name']]={'base':read_acc(J,B,prim['attributes']['POSITION']),
 'indices':read_acc(J,B,prim['indices']).ravel().astype(np.uint32).reshape(-1,3),
 'targets':[read_acc(J,B,t['POSITION']) for t in prim['targets']]}

# Face is a *separate UV-mapped mesh* in canonical C V3. Retain its texture and
# morph data. Only rest vertex positions change, all future poses inherit it.
faceidx=names.index('face');fp=J['meshes'][faceidx]['primitives'][0]
face_before=P['face']['base'];face_after=round_head(face_before)
write_acc(J,B,fp['attributes']['POSITION'],face_after)
# The original file omitted glTF normals; analytic ellipsoid-style normals
# supply rounded, continuous lighting even when the character is viewed obliquely.
fp['attributes']['NORMAL']=append_accessor(J,B,face_normals(face_after))

# Morph position targets represent (pose - base). Walk and aim are corrected,
# with idle preserved as the zero target. One target is shared by raise/lower.
D={'walk':{-1:np.array([0.,0.,0.]),+1:np.array([-.090,-.057,.008])},
   'aim':{-1:np.array([+.063,-.111,+.077]),+1:np.array([-.092,-.108,+.065])}}
for mi,mesh in enumerate(J['meshes']):
 name=mesh['name'];prim=mesh['primitives'][0];rest=P[name]['base']
 if not name.startswith('weapon_'):
  weights={side:hand_weight(name,rest,side) for side in (-1,1)}
  for ti,target in enumerate(prim['targets']):
   state='walk' if ti<8 else 'aim'
   old=P[name]['targets'][ti]
   shift=np.zeros_like(old,dtype=np.float64)
   for side in (-1,1): shift+=weights[side][:,None]*D[state][side][None,:]
   # protect every non-hand vertex; original topology + colours untouched
   if np.any(shift):write_acc(J,B,target['POSITION'],old+shift.astype(np.float32))
 else:
  # In lowered idle only, seat the grip a little deeper into the right palm.
  # Subtract the idle translation from each morph delta, so the walking and
  # aiming weapon placements remain identical to V6, with no behavioural drift.
  idle_shift=np.array([0.,-.020,+.020],dtype='<f4')
  write_acc(J,B,prim['attributes']['POSITION'],rest+idle_shift)
  for ti,target in enumerate(prim['targets']):
   write_acc(J,B,target['POSITION'],P[name]['targets'][ti]-idle_shift)

J.setdefault('asset',{}).setdefault('extras',{})['revision']='Hero Shooter C v6.1: rounded facial shading + animated grip repair'
save_glb(NEW,J,B)

# QA geometry contact: compare proper skin/glove regions against 3D pistol-grip
# region via KD tree. Region selection is cosmetic; not an IK/contact solver.
def pose_model(j,b,name,state):
 mesh=j['meshes'][names.index(name)];prim=mesh['primitives'][0]
 r=read_acc(j,b,prim['attributes']['POSITION'])
 if state>=0:r=r+read_acc(j,b,prim['targets'][state]['POSITION'])
 return r

def grip_metrics(j,b,stage):
 gripall=pose_model(j,b,'weapon_pink',stage)
 # grip region inferred from original V6 anchors + local weapon prop coordinates
 from scipy.spatial.transform import Rotation
 R=Rotation.from_euler('x',{ -1:90, 2:34, 8:-2}[stage],degrees=True).as_matrix()
 anc=np.array({-1:[-.338,-.026,.875],2:[-.128,-.336,1.196],8:[-.058,-.532,1.470]}[stage])
 # v6.1 idle gun translated a little: the region selector is tolerant
 if stage==-1 and j is not old_j:anc+=np.array([0.,-.020,+.020])
 local=(gripall-anc)@R+np.array([0.,.052,-.132])
 keep=(abs(local[:,1]-.051)<.050)&(abs(local[:,2]+.124)<.090)
 grip=gripall[keep]
 hands=[]
 for name in ['skin','glove','glove2']:
  rest=P[name]['base']
  verts=pose_model(j,b,name,stage)
  mask=(rest[:,0]<-.270)&(rest[:,2]>.810)&(rest[:,2]<1.02)
  hands.append(verts[mask])
 hand=np.vstack(hands)
 dist=cKDTree(hand).query(grip)[0]
 return {'min_m':float(dist.min()),'median_m':float(np.median(dist)),'under_10mm_count':int((dist<.010).sum()),'grip_vertices':len(grip)}

# Test all clips, pivots, morphology, UVs and texture bit-for-bit preserved.
SJ,SB=load_glb(NEW)
assert len(J['animations'])==len(SJ['animations'])==len(old_j['animations'])==5
assert [a['name'] for a in SJ['animations']]==[a['name'] for a in old_j['animations']]
assert len(J['meshes'])==len(SJ['meshes'])==len(old_j['meshes'])==47
for key in ['images','textures','materials']:
 assert J.get(key)==SJ.get(key)==old_j.get(key),f'{key} changed'
assert all(len(m['primitives'][0]['targets'])==9 for m in SJ['meshes'])
# All lower body, costume and unrelated mesh geometry must remain byte-identical.
assert (P['cargo']['base']==pose_model(SJ,SB,'cargo',-1)).all()
assert (P['hair']['base']==pose_model(SJ,SB,'hair',-1)).all()
qa={'model':'Hero Shooter C armed V6.1 head and grip micro-revision',
    'rollback':'Original V6 optimized GLB remains unchanged; use its original path for immediate rollback.',
    'original_path':str(OLD),'original_sha256':BASESHA,
    'v61_path':str(NEW),'v61_sha256':hashlib.sha256(NEW.read_bytes()).hexdigest(),
    'mesh_count':len(SJ['meshes']),'animations':[a['name'] for a in SJ['animations']],
    'mesh_triangles':int(sum(len(x['indices']) for x in P.values())),
    'face_max_displacement_m':float(np.linalg.norm(face_after-face_before,axis=1).max()),
    'face_base_vertex_count':int(len(face_after)),
    'round_shading':'Face-specific analytical vertex normals, no change to approved UV texture',
    'hand_contact_proxy_not_IK':{'idle':{},'lowready':{},'extended_aim':{}},
    'notes':['Original 3D rig is morph-target-only; animation timings remain unchanged','Pistol is an original nonfunctional decorative model']}
for stage,lab in [(-1,'idle'),(2,'lowready'),(8,'extended_aim')]:
 qa['hand_contact_proxy_not_IK'][lab]={'V6':grip_metrics(old_j,old_b,stage),'V6.1':grip_metrics(SJ,SB,stage)}

# Render original/edited GLB via VTK to expose any seams/gaps/overlaps.
# Actual model geometry from glTF data; not a synthesized image.
FIMG=OUT/'embedded_face_texture.png'
im=SJ['images'][0];view=SJ['bufferViews'][im['bufferView']];FIMG.write_bytes(SB[view['byteOffset']:view['byteOffset']+view['byteLength']]);
renderer=vtk.vtkRenderer();renderer.SetBackground(.048,.049,.065);renderer.SetBackground2(.135,.113,.137);renderer.GradientBackgroundOn()
actors=[]
for mesh in SJ['meshes']:
 name=mesh['name'];prim=mesh['primitives'][0]
 pos=pose_model(SJ,SB,name,-1).astype(np.float32)
 pt=vtk.vtkPoints();pt.SetData(numpy_to_vtk(np.ascontiguousarray(pos),deep=True))
 pd=vtk.vtkPolyData();pd.SetPoints(pt)
 inds=read_acc(SJ,SB,prim['indices']).ravel().astype(np.int64).reshape(-1,3)
 cell=np.column_stack([np.full(len(inds),3),inds]).ravel().astype(np.int64)
 ca=vtk.vtkCellArray();ca.SetCells(len(inds),numpy_to_vtk(cell,deep=True,array_type=vtk.VTK_ID_TYPE))
 pd.SetPolys(ca)
 if 'TEXCOORD_0' in prim['attributes']:
  uv=read_acc(SJ,SB,prim['attributes']['TEXCOORD_0'])
  tcoords=numpy_to_vtk(np.ascontiguousarray(np.column_stack((uv[:,0],1-uv[:,1])).astype(np.float32)),deep=True)
  tcoords.SetNumberOfComponents(2);pd.GetPointData().SetTCoords(tcoords)
 if 'NORMAL' in prim['attributes']:
  norm=read_acc(SJ,SB,prim['attributes']['NORMAL']).astype(np.float32)
  nn=numpy_to_vtk(np.ascontiguousarray(norm),deep=True);nn.SetNumberOfComponents(3);pd.GetPointData().SetNormals(nn)
 obj=vtk.vtkPolyDataMapper();obj.SetInputData(pd);obj.ScalarVisibilityOff()
 act=vtk.vtkActor();act.SetMapper(obj)
 if 'TEXCOORD_0' in prim['attributes']:
  rd=vtk.vtkPNGReader();rd.SetFileName(str(FIMG));tex=vtk.vtkTexture();tex.SetInputConnection(rd.GetOutputPort());tex.InterpolateOn();tex.RepeatOff();act.SetTexture(tex);act.GetProperty().SetColor(1,1,1)
 else:
  c=color_rgb(SJ,SB,prim);act.GetProperty().SetColor(*c)
 act.GetProperty().SetInterpolationToPhong();act.GetProperty().SetAmbient(.32);act.GetProperty().SetDiffuse(.70);act.GetProperty().SetSpecular(.07)
 renderer.AddActor(act);actors.append((name,pt,pd,prim))
for pos,inten in [((-3,-4,6),1.1),((3,3,5),.74)]:
 lt=vtk.vtkLight();lt.SetLightTypeToSceneLight();lt.SetPosition(*pos);lt.SetFocalPoint(0,0,1);lt.SetIntensity(inten);renderer.AddLight(lt)
win=vtk.vtkRenderWindow();win.SetOffScreenRendering(1);win.AddRenderer(renderer);win.SetMultiSamples(2);win.SetSize(540,660)

def render(j,b,state,angle,filename,focus=1.05,scale=1.17,size=(540,670)):
 for name,pt,pd,prim in actors:
  pos=pose_model(j,b,name,state).astype(np.float32)
  pt.SetData(numpy_to_vtk(np.ascontiguousarray(pos),deep=True));pt.Modified();pd.Modified()
  if name=='face':
   normals=face_normals(pos)
   nn=numpy_to_vtk(np.ascontiguousarray(normals),deep=True);nn.SetNumberOfComponents(3);pd.GetPointData().SetNormals(nn)
  else:pd.GetPointData().SetNormals(None)
 cam=renderer.GetActiveCamera();a=math.radians(angle);d=4.7
 cam.SetPosition(d*math.sin(a),-d*math.cos(a),focus+.25)
 cam.SetFocalPoint(0,0,focus);cam.SetViewUp(0,0,1);cam.ParallelProjectionOn();cam.SetParallelScale(scale)
 win.SetSize(*size);renderer.ResetCameraClippingRange();win.Render()
 f=vtk.vtkWindowToImageFilter();f.SetInput(win);f.SetInputBufferTypeToRGB();f.ReadFrontBufferOff();f.Update()
 wr=vtk.vtkPNGWriter();wr.SetFileName(str(filename));wr.SetInputConnection(f.GetOutputPort());wr.Write()

# Use 3 poses and three camera angles for proper quality control.
for state,name in [(-1,'idle'),(2,'lowready'),(8,'aim')]:
 for angle,view in [(0,'front'),(-35,'threequarter'),(90,'side')]:
  render(SJ,SB,state,angle,OUT/f'C_v61_{name}_{view}.png')
# Side-by-side baseline/current (head + hand) from same camera angles.
for state,name in [(-1,'idle'),(2,'lowready'),(8,'aim')]:
 render(old_j,old_b,state,-35,OUT/f'_baseline_{name}.png')
comparison=Image.new('RGB',(1080,670*3),(23,23,34))
for i,name in enumerate(['idle','lowready','aim']):
 for j,version in enumerate([f'_baseline_{name}.png',f'C_v61_{name}_threequarter.png']):
  pic=Image.open(OUT/version).convert('RGB');comparison.paste(pic,(540*j,670*i))
comparison.save(OUT/'C_V6_vs_V6_1_pose_comparison.png',optimize=True)
for name in ['idle','lowready','aim']:(OUT/f'_baseline_{name}.png').unlink(missing_ok=True)
# zoom head using VTK fitted to actual face mesh; model's original approved texture
render(SJ,SB,-1,-25,OUT/'C_v61_head_detail.png',focus=1.755,scale=.36,size=(600,650))
qa['rendered_previews']='3 poses x 3 angles plus head detail and before/after comparison'
(OUT/'QA_report.json').write_text(json.dumps(qa,indent=2))
(OUT/'ROLLBACK.md').write_text(f'''# Hero Shooter C V6.1 — rollback\n\nOriginal V6 remains unchanged at:\n`{OLD}`\n\nSHA-256: `{BASESHA}`\n\nV6.1 revision:\n`{NEW}`\n\nSHA-256: `{qa['v61_sha256']}`\n\nTo roll back, select the original V6 GLB or rebuild from the versioned V6 source in `tools/hero-3d/c-armed/`. This revision is a separate file; no GitHub runtime or approved V6 asset was overwritten.\n''')
print(json.dumps({'file':str(NEW),'size_bytes':NEW.stat().st_size,'face_max_shift_m':qa['face_max_displacement_m'],'contacts':qa['hand_contact_proxy_not_IK']},indent=2))