#!/usr/bin/env python3
"""Hero Shooter C — armed V6: reusable 3D hold, walk and aim poses.

Original procedural 3D weapon prop + VTK preview and GLB morph-track animation.
Preserves approved V3 anime-face GLB and V4 eight-phase paced gait.
Character front = -Y, +Z up. Anatomical right hand = model negative X.
No skeletal armature is claimed. Not weapon-manufacturing geometry.
"""
from pathlib import Path
import math, json, struct, zipfile, os, sys
import numpy as np
import vtk
from scipy.spatial.transform import Rotation
from vtk.util.numpy_support import vtk_to_numpy,numpy_to_vtk
from PIL import Image,ImageDraw

HERE=Path(__file__).resolve().parent
SOURCE=HERE/'C_unarmed_VTK_v3/C_unarmed_v3_animeface.glb'
WALK=HERE/'C_unarmed_VTK_v4_walk/C_paced_walk_v4_8frame_animated.glb'
OUT=HERE/'C_armed_VTK_v6'
if not SOURCE.exists():
 # The downloaded asset pack embeds its source models under source_inputs/.
 SOURCE=HERE/'source_inputs/C_unarmed_VTK_v3/C_unarmed_v3_animeface.glb'
 WALK=HERE/'source_inputs/C_unarmed_VTK_v4_walk/C_paced_walk_v4_8frame_animated.glb'
 OUT=HERE
OUT.mkdir(exist_ok=True)
FACE_TEXTURE=OUT/'C_face_original_embedded.png'
assert SOURCE.exists() and WALK.exists(), 'Source V3/V4 GLBs required; see source_inputs folder'
FRAMES=8
PERIOD=1.08

CTYPES={5126:('<f4',4),5125:('<u4',4),5123:('<u2',2),5121:('u1',1)}
DIM={'SCALAR':1,'VEC2':2,'VEC3':3,'VEC4':4}

def parse_glb(path):
 raw=path.read_bytes();magic,version,length=struct.unpack_from('<4sII',raw)
 assert magic==b'glTF' and version==2 and length==len(raw)
 cur=12;j=None;bd=None
 while cur<len(raw):
  n,kind=struct.unpack_from('<I4s',raw,cur);chunk=raw[cur+8:cur+8+n];cur+=8+n
  if kind==b'JSON':j=json.loads(chunk)
  elif kind==b'BIN\0':bd=bytearray(chunk)
 assert j is not None and bd is not None
 return j,bd

def arr(j,bd,idx):
 a=j['accessors'][idx];v=j['bufferViews'][a['bufferView']];dt,k=CTYPES[a['componentType']];d=DIM[a['type']]
 start=v.get('byteOffset',0)+a.get('byteOffset',0)
 assert v.get('byteStride',0) in (0,k*d)
 return np.frombuffer(bd,np.dtype(dt),offset=start,count=a['count']*d).reshape(-1,d).copy()

J,originalbin=parse_glb(SOURCE);Jw,Bw=parse_glb(WALK)
# The embedded V3 texture has the approved painted eyes; do not substitute older PNG variants.
face_image=J['images'][0];face_view=J['bufferViews'][face_image['bufferView']]
FACE_TEXTURE.write_bytes(bytes(originalbin[face_view['byteOffset']:face_view['byteOffset']+face_view['byteLength']]))
M=[];w8=[]
for m,wm in zip(J['meshes'],Jw['meshes']):
 p=m['primitives'][0];wp=wm['primitives'][0]
 coords=arr(J,originalbin,p['attributes']['POSITION']).astype(np.float32)
 faces=arr(J,originalbin,p['indices']).ravel().astype(np.uint32)
 cols=arr(J,originalbin,p['attributes']['COLOR_0']) if 'COLOR_0' in p['attributes'] else None
 tex=arr(J,originalbin,p['attributes']['TEXCOORD_0']) if 'TEXCOORD_0' in p['attributes'] else None
 # The existing unarmed gait is reused without regenerating it.
 motions=[coords+arr(Jw,Bw,t['POSITION']).astype(np.float32) for t in wp['targets']]
 M.append({'name':m['name'],'p':coords,'tri':faces.reshape(-1,3),'color':cols,'uv':tex})
 w8.append(motions)
assert len(M)==len(w8) and all(len(x)==8 for x in w8)

# -----------------------------------------
# Original decorative, game-scale pink pistol mesh; VTK sources, not CAD for fabrication.
# Grip local x=0, y=+0.052, z=-0.132 is anchor at C's hand.
# Barrel forward in -Y. Source atlas is in the Hero Shooter Library (Weapons and Props).
# -----------------------------------------
PAL={
 'pink':(235,66,137),'pink_highlight':(255,114,170),'pink_shadow':(171,38,94),
 'slide':(42,42,51),'slide_highlight':(91,85,96),'black':(24,23,29),
 'polymer':(61,56,65),'metal':(126,119,120),'red_dot':(246,77,45),
 'sight_glass':(255,129,72),'lamp':(250,194,98),'lamp_ring':(194,150,86)
}
parts={k:[] for k in PAL}

def add_part(key,poly):
 assert poly.GetNumberOfPoints()>2
 parts[key].append(poly)

def tf_poly(src,loc=(0,0,0),sc=(1,1,1),axis=None,angle=0):
 xf=vtk.vtkTransform();xf.Translate(*loc)
 if axis:xf.RotateWXYZ(angle,*axis)
 xf.Scale(*sc)
 ff=vtk.vtkTransformPolyDataFilter();ff.SetInputConnection(src.GetOutputPort());ff.SetTransform(xf);ff.Update()
 poly=vtk.vtkPolyData();poly.DeepCopy(ff.GetOutput())
 return poly

def cub(key,pos,dim,roundness=None):
 if roundness is None:
  s=vtk.vtkCubeSource();s.SetXLength(dim[0]);s.SetYLength(dim[1]);s.SetZLength(dim[2])
  add_part(key,tf_poly(s,pos))
 else:
  s=vtk.vtkSuperquadricSource();s.SetThetaResolution(24);s.SetPhiResolution(16);s.SetSize(1)
  s.SetThetaRoundness(roundness);s.SetPhiRoundness(roundness)
  add_part(key,tf_poly(s,pos,(dim[0]*.5,dim[1]*.5,dim[2]*.5)))

def ell(key,pos,dim):
 s=vtk.vtkSphereSource();s.SetRadius(1);s.SetPhiResolution(18);s.SetThetaResolution(22)
 add_part(key,tf_poly(s,pos,(dim[0]*.5,dim[1]*.5,dim[2]*.5)))

def cylinder(key,pos,radius,length,axis='y'):
 s=vtk.vtkCylinderSource();s.SetRadius(radius);s.SetHeight(length);s.SetResolution(18);s.CappingOn()
 # vtkCylinderSource is default aligned +Y
 angle=0;rotation=(0,0,1)
 if axis=='x':angle=90;rotation=(0,0,1)
 elif axis=='z':angle=90;rotation=(1,0,0)
 add_part(key,tf_poly(s,pos,axis=rotation if angle else None,angle=angle))

def ring(key,center,outer=.025,inner=.015):
 # visual muzzle bevel, not a firearm bore specification
 tor=vtk.vtkSuperquadricSource();tor.SetToroidal(1);tor.SetSize(1)
 tor.SetThickness(inner/outer);tor.SetThetaResolution(20);tor.SetPhiResolution(12)
 # tube axis default Z: point toward -Y by rotating 90 around X
 add_part(key,tf_poly(tor,center,sc=(outer,outer,outer),axis=(1,0,0),angle=90))

def polyquad(key,pts):
 pp=vtk.vtkPoints();pp.SetDataTypeToDouble()
 for x in pts:pp.InsertNextPoint(*[float(v) for v in x])
 pd=vtk.vtkPolyData();pd.SetPoints(pp);ca=vtk.vtkCellArray()
 pg=vtk.vtkPolygon();pg.GetPointIds().SetNumberOfIds(len(pts))
 for i in range(len(pts)):pg.GetPointIds().SetId(i,i)
 ca.InsertNextCell(pg);pd.SetPolys(ca);add_part(key,pd)

# black slide, pink polymer receiver, dark slide top plane
cub('slide', (0,-.060,+.012),(.071,.247,.055),.25)
cub('slide_highlight',(0,-.055,.043),(.070,.222,.012),.26)
cub('pink',(0,-.058,-.028),(.081,.218,.047),.28)
cub('pink_highlight',(0,-.073,-.035),(.082,.145,.011),.24)
# cosmetic grip with tapered polymer proportions; visually held in right hand
cub('pink',(0,.051,-.124),(.067,.080,.160),.28)
cub('polymer',(.036,.047,-.135),(.010,.064,.104),.19)
cub('polymer',(-.036,.047,-.135),(.010,.064,.104),.19)
cub('black',(0,.057,-.207),(.070,.084,.015),.18)
cub('pink_shadow',(0,.028,-.174),(.048,.036,.025),.24)
# sight housing, red glass (stylised visual asset)
cub('black',(0,-.034,.067),(.067,.065,.023),.25)
cub('slide',(0,-.034,.091),(.064,.030,.063),.26)
cub('red_dot',(0,-.053,.098),(.041,.007,.032),.25)
cub('sight_glass',(0,-.057,.099),(.028,.004,.020),.17)
cub('black',(0,-.066,.062),(.055,.017,.013),.22)
# compact underbarrel flashlight in a decorative cylindrical housing
cylinder('polymer',(0,-.133,-.091),.026,.095,'y')
cylinder('metal',(0,-.184,-.091),.026,.014,'y')
cylinder('lamp_ring',(0,-.193,-.091),.023,.005,'y')
ell('lamp',(0,-.200,-.091),(.018,.004,.018))
cub('black',(0,-.092,-.062),(.054,.050,.020),.23)
# simple trigger guard silhouette as visual pieces (nonfunctional)
cub('black',(0,-.018,-.096),(.015,.072,.013),.20)
cub('black',(0,-.046,-.081),(.015,.011,.035),.25)
# muzzle facing -Y; circular annulus not an exact real-world barrel
ring('metal',(0,-.188,.015),.027,.014)
ell('black',(0,-.186,.015),(.015,.006,.015))
# slide serrations left and right and cosmetic frame accents
for side in (-1,1):
 for i in range(5):
  yy=+.002-i*.008
  cub('slide_highlight',(side*.036,yy,.019),(.002,.003,.034),.18)
 cub('pink_highlight',(side*.040,-.085,-.024),(.003,.065,.007),.22)
 for i in range(4):
  cub('pink_shadow',(side*.041,.056,-.103-i*.020),(.003,.038,.004),.17)

WEAPON=[]
for k,group in parts.items():
 ap=vtk.vtkAppendPolyData()
 for p in group:ap.AddInputData(p)
 ap.Update();t=vtk.vtkTriangleFilter();t.SetInputConnection(ap.GetOutputPort());t.Update()
 pd=t.GetOutput();v=vtk_to_numpy(pd.GetPoints().GetData()).astype(np.float32)
 faces_data=vtk_to_numpy(pd.GetPolys().GetData()).reshape(-1,4)[:,1:].astype(np.uint32)
 WEAPON.append({'name':'weapon_'+k,'p':v,'tri':faces_data,'rgb':PAL[k]})

# -----------------------------------------
# Right- and left-arm bone-guided surface deformation. V3 remains source.
# Applies mesh-based positional edits to existing material groups, no skeleton rig claimed.
# -----------------------------------------
ARM_GROUPS={'skin','jacket','jacket2','jacketshadow','glove','glove2','black','patch','silver'}
# existing arm pivot coords recorded in VTK builder; +X is character left, -X anatomical right

def smooth(v,a,b):
 f=np.clip((v-a)/(b-a),0,1)
 return f*f*(3-2*f)

def rot_from(a,b):
 a=np.array(a,dtype=float);b=np.array(b,dtype=float);a/=max(np.linalg.norm(a),1.e-8);b/=max(np.linalg.norm(b),1.e-8)
 cross=np.cross(a,b);co=np.dot(a,b)
 if co<-0.9999:return Rotation.from_rotvec(np.pi*np.array([1.,0,0])).as_matrix()
 if co>.9999:return np.eye(3)
 s=np.linalg.norm(cross)
 K=np.array([[0,-cross[2],cross[1]],[cross[2],0,-cross[0]],[-cross[1],cross[0],0]])
 return np.eye(3)+K+K@K*((1-co)/max(s*s,1e-12))

def arm_pose(vertices,name,side,target_elbow,target_hand):
 """Repose a relaxed arm to low-ready or extended, with smooth elbow transitions."""
 if name not in ARM_GROUPS:return vertices.copy()
 p=vertices.astype(np.float64)
 H=np.array([side*.273,.025,1.389]);E=np.array([side*.326,.015,1.151]);W=np.array([side*.338,-.022,.902])
 Ht=H
 Et=np.array(target_elbow);Wt=np.array(target_hand)
 ru=rot_from(E-H,Et-Ht);rl=rot_from(W-E,Wt-Et)
 u=(p-H)@ru.T+Ht
 l=(p-E)@rl.T+Et
 # upper arm above elbow; forearm below; correction works for sleeve/skin/wrist
 w=smooth(p[:,2],1.105,1.225)
 new=l*(1-w[:,None])+u*w[:,None]
 xx=side*p[:,0]
 mask=smooth(xx,.232,.324)*smooth(p[:,2],.773,.860)*(1-smooth(p[:,2],1.433,1.543))
 return (p+(new-p)*mask[:,None]).astype(np.float32)

def morph_pose(stage,frame=None):
 poses=[]
 for i,m in enumerate(M):
  if stage=='walk':start=w8[i][frame].copy()
  else:start=m['p'].copy()
  if stage=='idle':out=start
  elif stage=='walk':
   # Move both arms toward one connected, two-handed, compact low-ready grip.
   # The underlying V4 gait moves both arms: reset arm-only regions to the
   # neutral reference first, preserving the eight-frame lower-body stride.
   baseline=m['p']
   if m['name'] in ARM_GROUPS:
    for side in (-1,+1):
     xx=side*baseline[:,0]
     mask=smooth(xx,.240,.330)*smooth(baseline[:,2],.790,.880)*(1-smooth(baseline[:,2],1.43,1.51))
     start+=(baseline-start)*mask[:,None]
   # Anatomical right hand carries the pistol, left hand supports its grip.
   # Both wrists meet just ahead of the solar plexus, with relaxed elbows.
   out=arm_pose(start,m['name'],-1,[-.247,-.158,1.228],[-.128,-.333,1.220])
   out=arm_pose(out,m['name'],+1,[+.242,-.147,1.228],[-.067,-.332,1.216])
   # Hands and sidearm remain stable; only the stride has modest gait motion.
  elif stage=='aim':
   out=arm_pose(start,m['name'],-1,[-.245,-.205,1.350],[-.058,-.532,1.493])
   out=arm_pose(out,m['name'],+1,[+.204,-.197,1.344],[+.015,-.510,1.474])
  else:raise ValueError(stage)
  poses.append(out.astype(np.float32))
 return poses

IDLE=morph_pose('idle')
WALKS=[morph_pose('walk',i) for i in range(FRAMES)]
AIM=morph_pose('aim')

# Weapon grip target world anchors; rigid transformations applied to all grouped meshes.
# Idle muzzle points at floor. Walk low-ready points diagonally at floor; Aim extends forward.
R_ID=Rotation.from_euler('x',90,degrees=True).as_matrix()
R_LO=Rotation.from_euler('x',34,degrees=True).as_matrix()
R_AIM=Rotation.from_euler('x',-2,degrees=True).as_matrix()
GRIP=np.array([0,.052,-.132])
ANCHOR_IDLE=np.array([-.338,-.026,.875])
ANCHOR_LOW=np.array([-.128,-.336,1.196])
ANCHOR_AIM=np.array([-.058,-.532,1.470])

def gun_pos(v,stage,frame=0):
 if stage=='idle':R=R_ID;anchor=ANCHOR_IDLE
 elif stage=='walk':
  R=R_LO
  t=2*np.pi*frame/FRAMES
  anchor=ANCHOR_LOW+np.array([.001*np.sin(t),.002*np.sin(t),.004*np.cos(2*t)])
 elif stage=='aim':R=R_AIM;anchor=ANCHOR_AIM
 else:raise ValueError(stage)
 return ((v-GRIP)@R.T+anchor).astype(np.float32)

ALL=[]
for i,m in enumerate(M):
 ALL.append({'name':m['name'],'p':IDLE[i], 'tri':m['tri'],'color':m['color'],'uv':m['uv'],
             'walk':[WALKS[f][i] for f in range(FRAMES)],'aim':AIM[i]})
for m in WEAPON:
 ALL.append({'name':m['name'],'p':gun_pos(m['p'],'idle'), 'tri':m['tri'],
             'color':np.tile(np.asarray([*m['rgb'],255],dtype=np.uint8)[None,:],(len(m['p']),1)),
             'uv':None,'walk':[gun_pos(m['p'],'walk',f) for f in range(FRAMES)],'aim':gun_pos(m['p'],'aim')})

# Extend V3 glTF JSON and binary, preserving original UV-painted C face.
J2=json.loads(json.dumps(J));bd=bytearray(originalbin)

def addbuffer(buf):
 while len(bd)%4:bd.append(0)
 off=len(bd);bd.extend(buf)
 while len(bd)%4:bd.append(0)
 n=len(J2['bufferViews'])
 J2['bufferViews'].append({'buffer':0,'byteOffset':off,'byteLength':len(buf)})
 return n

def accessor(data,component_type=5126,kind='VEC3',bounds=False):
 data=np.ascontiguousarray(data);vi=addbuffer(data.tobytes());n=len(J2['accessors'])
 ob={'bufferView':vi,'componentType':component_type,'count':len(data),'type':kind}
 if bounds:
  ob['min']=np.min(data,axis=0).astype(float).tolist() if data.ndim==2 else [float(np.min(data))]
  ob['max']=np.max(data,axis=0).astype(float).tolist() if data.ndim==2 else [float(np.max(data))]
 J2['accessors'].append(ob)
 return n

# Repoint original POSITIONs from v3 to armed idle pose. Keep original normals absent.
for i,m in enumerate(M):
 acc=J2['meshes'][i]['primitives'][0]['attributes']['POSITION']
 ai=J2['accessors'][acc];vi=J2['bufferViews'][ai['bufferView']]
 offset=vi['byteOffset']+ai.get('byteOffset',0)
 v=ALL[i]['p']; assert v.dtype==np.float32
 bd[offset:offset+v.nbytes]=v.tobytes()
 ai['min']=v.min(axis=0).astype(float).tolist();ai['max']=v.max(axis=0).astype(float).tolist()

# Add weapon visual meshes with separate material colors.
if 'materials' not in J2:J2['materials']=[]
for i in range(len(M),len(ALL)):
 m=ALL[i];v=m['p'];index=m['tri'].astype(np.uint32).ravel()
 co=m['color']
 # use vertex colors consistent with existing C and material default
 prim={'attributes':{'POSITION':accessor(v,bounds=True),'COLOR_0':accessor(co,5121,'VEC4')},
       'indices':accessor(index,5125,'SCALAR')}
 J2['accessors'][prim['attributes']['COLOR_0']]['normalized']=True
 meshid=len(J2['meshes']);J2['meshes'].append({'name':m['name'],'primitives':[prim]})
 J2['nodes'].append({'name':m['name'],'mesh':meshid})
 node_id=len(J2['nodes'])-1
 J2['scenes'][J2.get('scene',0)]['nodes'].append(node_id)

for i,m in enumerate(ALL):
 p=J2['meshes'][i]['primitives'][0]
 base=m['p']
 targets=[]
 for f in range(FRAMES):targets.append({'POSITION':accessor(m['walk'][f]-base,bounds=True)})
 targets.append({'POSITION':accessor(m['aim']-base,bounds=True)})
 p['targets']=targets
 J2['meshes'][i]['weights']=[0.]*9
 J2['meshes'][i]['extras']={'targetNames':[f'lowready_walk_{f:02d}' for f in range(FRAMES)]+['aim_extended']}

# Each glTF clip has its own sampler; same keyed time data may be shared between nodes.
# Three states and two short morph-transitions; idle is base, walk cycles at 1.08s.
J2['animations']=[]
ANIM_META=[]

def clip(name,times,weight_rows,interpolation='LINEAR'):
 arrt=np.asarray(times,dtype=np.float32);W=np.asarray(weight_rows,dtype=np.float32)
 assert W.shape==(len(arrt),9)
 ia=accessor(arrt,5126,'SCALAR',bounds=True)
 oa=accessor(W.reshape(-1),5126,'SCALAR')
 sam={'input':ia,'output':oa,'interpolation':interpolation}
 channels=[{'sampler':0,'target':{'node':i,'path':'weights'}} for i,node in enumerate(J2['nodes']) if 'mesh' in node]
 J2['animations'].append({'name':name,'samplers':[sam],'channels':channels})
 ANIM_META.append({'name':name,'seconds':float(arrt[-1]),'keyframes':len(arrt),'channels':len(channels)})

def weight(target=None):
 w=np.zeros(9,np.float32)
 if target is not None:w[target]=1
 return w

clip('C_Armed_Idle_PistolDown',[0,.5],[weight(),weight()])
clip('C_Armed_Walk_LowReady_8',list(np.arange(9)*PERIOD/8),[weight(f) for f in range(8)]+[weight(0)])
clip('C_Armed_Aim_Extended',[0,.5],[weight(8),weight(8)])
clip('C_Armed_Raise',[0,.22,.47],[weight(),weight(0),weight(8)])
clip('C_Armed_Lower',[0,.22,.47],[weight(8),weight(0),weight()])
J2['buffers'][0]['byteLength']=len(bd)
J2.setdefault('asset',{}).setdefault('extras',{})['studio']='Hero Shooter C v6 armed anime-face procedural morph animation; original pink pistol visual based on Library reference'

def save_glb(path,js,binary):
 jsonbytes=json.dumps(js,ensure_ascii=False,separators=(',',':')).encode('utf8');jsonbytes+=b' '*(-len(jsonbytes)%4)
 binbytes=bytes(binary);binbytes+=b'\0'*(-len(binbytes)%4)
 with open(path,'wb') as f:
  f.write(struct.pack('<4sII',b'glTF',2,12+8+len(jsonbytes)+8+len(binbytes)))
  f.write(struct.pack('<I4s',len(jsonbytes),b'JSON'));f.write(jsonbytes)
  f.write(struct.pack('<I4s',len(binbytes),b'BIN\0'));f.write(binbytes)

MAIN=OUT/'C_armed_v6_twohand_lowready.glb';save_glb(MAIN,J2,bd)

# Three baked static GLBs for viewers/engines that do not implement morph targets.
# This is actual pose geometry (POSITION overwritten), not merely morph weights.
STILLS=OUT/'poses';STILLS.mkdir(exist_ok=True)
def compact_unused_animation(js,bb):
 # Copy only the geometry/color/UV/image bufferViews used by static mesh primitives.
 needed_acc=set()
 for mesh in js['meshes']:
  mesh.pop('weights',None);mesh.pop('extras',None)
  for prim in mesh['primitives']:
   prim.pop('targets',None)
   needed_acc.update(prim['attributes'].values())
   if 'indices' in prim:needed_acc.add(prim['indices'])
 js.pop('animations',None)
 aid={old:i for i,old in enumerate(sorted(needed_acc))}
 relevant_views=set(js['accessors'][i]['bufferView'] for i in aid)
 for im in js.get('images',[]):
  if 'bufferView' in im:relevant_views.add(im['bufferView'])
 vid={old:i for i,old in enumerate(sorted(relevant_views))}
 newbin=bytearray();viewout=[]
 for old in sorted(relevant_views):
  view=js['bufferViews'][old].copy()
  while len(newbin)%4:newbin.append(0)
  new_off=len(newbin)
  start=view.get('byteOffset',0);n=view['byteLength']
  newbin.extend(bb[start:start+n]);view['byteOffset']=new_off
  viewout.append(view)
 for mesh in js['meshes']:
  for pr in mesh['primitives']:
   pr['attributes']={key:aid[val] for key,val in pr['attributes'].items()}
   if 'indices' in pr:pr['indices']=aid[pr['indices']]
 for im in js.get('images',[]):
  if 'bufferView' in im:im['bufferView']=vid[im['bufferView']]
 js['accessors']=[js['accessors'][old] for old in sorted(needed_acc)]
 for acc in js['accessors']:acc['bufferView']=vid[acc['bufferView']]
 js['bufferViews']=viewout
 js['buffers'][0]['byteLength']=len(newbin)
 return js,newbin

for name,idx in [('idle_pistol_down',None),('walk_lowready_twohand_mid',2),('aim_extended',8)]:
 js=json.loads(json.dumps(J2));bb=bytearray(bd)
 for mi,mesh in enumerate(js['meshes']):
  va=ALL[mi]['p'] if idx is None else (ALL[mi]['aim'] if idx==8 else ALL[mi]['walk'][idx])
  ai=js['accessors'][mesh['primitives'][0]['attributes']['POSITION']]
  vi=js['bufferViews'][ai['bufferView']]
  off=vi.get('byteOffset',0)+ai.get('byteOffset',0)
  bb[off:off+va.nbytes]=va.astype(np.float32).tobytes()
  ai['min']=va.min(axis=0).astype(float).tolist();ai['max']=va.max(axis=0).astype(float).tolist()
 js,bb=compact_unused_animation(js,bb)
 save_glb(STILLS/f'C_armed_{name}.glb',js,bb)

# VTK previews at exactly the same pose vertex positions as the actual GLB.
ren=vtk.vtkRenderer();ren.SetBackground(.045,.046,.059);ren.SetBackground2(.112,.105,.121);ren.GradientBackgroundOn()
actlist=[]
for m in ALL:
 pp=vtk.vtkPoints();pp.SetData(numpy_to_vtk(np.ascontiguousarray(m['p']),deep=True))
 pd=vtk.vtkPolyData();pd.SetPoints(pp)
 tri=m['tri'].astype(np.int64)
 conn=np.hstack([np.full((len(tri),1),3,dtype=np.int64),tri]).ravel()
 cells=vtk.vtkCellArray();cells.SetCells(len(tri),numpy_to_vtk(conn,deep=True,array_type=vtk.VTK_ID_TYPE))
 pd.SetPolys(cells)
 if m['uv'] is not None:
  tco=numpy_to_vtk(np.ascontiguousarray(np.column_stack((m['uv'][:,0],1.0-m['uv'][:,1])).astype(np.float32)),deep=True);tco.SetName('TCoords');tco.SetNumberOfComponents(2)
  pd.GetPointData().SetTCoords(tco)
 norm=vtk.vtkPolyDataNormals();norm.SetInputData(pd);norm.SplittingOff();norm.ComputePointNormalsOn();norm.Update()
 mp=vtk.vtkPolyDataMapper();mp.SetInputConnection(norm.GetOutputPort());mp.ScalarVisibilityOff()
 actor=vtk.vtkActor();actor.SetMapper(mp)
 if m['uv'] is not None:
  rd=vtk.vtkPNGReader();rd.SetFileName(str(FACE_TEXTURE));rd.Update()
  tex=vtk.vtkTexture();tex.SetInputConnection(rd.GetOutputPort());tex.InterpolateOn();tex.RepeatOff();actor.SetTexture(tex)
  actor.GetProperty().SetColor(1,1,1)
 else:
  c=m['color'][0,:3].astype(float)/255.0
  actor.GetProperty().SetColor(*c)
 actor.GetProperty().SetInterpolationToPhong();actor.GetProperty().SetAmbient(.29);actor.GetProperty().SetDiffuse(.74);actor.GetProperty().SetSpecular(.045)
 if m['name'] in ['weapon_sight_glass','weapon_lamp']:
  actor.GetProperty().SetAmbient(.75);actor.GetProperty().SetSpecular(.2)
 ren.AddActor(actor);actlist.append((pd,pp,norm))
for pos,intens in [((-3,-4,6),1.16),((3,2,5),.75)]:
 light=vtk.vtkLight();light.SetLightTypeToSceneLight();light.SetPosition(*pos);light.SetFocalPoint(0,0,1);light.SetIntensity(intens);ren.AddLight(light)
win=vtk.vtkRenderWindow();win.SetOffScreenRendering(1);win.SetSize(550,700);win.SetMultiSamples(2);win.AddRenderer(ren)

def assign_pose(stage,frame=0):
 for mid,(pd,pp,norm) in enumerate(actlist):
  a=ALL[mid]
  data=a['p'] if stage=='idle' else (a['aim'] if stage=='aim' else a['walk'][frame])
  pp.SetData(numpy_to_vtk(np.ascontiguousarray(data),deep=True));pp.Modified();pd.Modified();norm.Modified()

def preview(stage,frame,angle,filename,size=(430,590)):
 assign_pose(stage,frame);win.SetSize(*size)
 cam=ren.GetActiveCamera();az=math.radians(angle);el=math.radians(4);d=4.9
 cam.SetPosition(d*math.sin(az)*math.cos(el),-d*math.cos(az)*math.cos(el),1.09+d*math.sin(el))
 cam.SetFocalPoint(0,0,1.055);cam.SetViewUp(0,0,1);cam.ParallelProjectionOn();cam.SetParallelScale(1.15)
 ren.ResetCameraClippingRange();win.Render()
 w2i=vtk.vtkWindowToImageFilter();w2i.SetInput(win);w2i.SetInputBufferTypeToRGB();w2i.ReadFrontBufferOff();w2i.Update()
 wr=vtk.vtkPNGWriter();wr.SetInputConnection(w2i.GetOutputPort());wr.SetFileName(str(filename));wr.Write()

for state in ['idle','walk','aim']:
 for nm,angle in [('front',0),('threequarter',-35),('side',90)]:
  preview(state,2 if state=='walk' else 0,angle,OUT/f'C_armed_{state}_{nm}.png')

# 3x3 review sheet, no generated 2D overlays on model.
thumb=(360,494)
sh=Image.new('RGB',(thumb[0]*3,thumb[1]*3),(25,23,32))
for row,state in enumerate(['idle','walk','aim']):
 for column,view in enumerate(['front','threequarter','side']):
  pic=Image.open(OUT/f'C_armed_{state}_{view}.png').convert('RGB').resize(thumb,Image.Resampling.LANCZOS)
  sh.paste(pic,(column*thumb[0],row*thumb[1]))
sh.save(OUT/'C_armed_v6_pose_comparison.png')

if os.environ.get("HERO_C_FAST_BUILD", "0") != "1":
 # Eight-frame moving low-ready walk from front / side.
 walk_imgs={v:[] for v in ('front','threequarter','side')}
 for i in range(FRAMES):
  for nm,angle in [('front',0),('threequarter',-35),('side',90)]:
   f=OUT/f'_C_armed_walk_{nm}_{i:02}.png'
   preview('walk',i,angle,f,size=(360,490))
   walk_imgs[nm].append(Image.open(f).convert('RGB').copy());f.unlink()
 for view,imgs in walk_imgs.items():
  imgs[0].save(OUT/f'C_armed_walk_{view}.gif',save_all=True,append_images=imgs[1:],duration=135,loop=0,optimize=True,disposal=2)
 frame_imgs=[]
 for i in range(FRAMES):
  pn=Image.new('RGB',(360*3,490),(25,23,32))
  for vi,view in enumerate(['front','threequarter','side']):pn.paste(walk_imgs[view][i],(360*vi,0))
  frame_imgs.append(pn)
 frame_imgs[0].save(OUT/'C_armed_lowready_walk_3views.gif',save_all=True,append_images=frame_imgs[1:],duration=135,loop=0,optimize=True,disposal=2)

# Optional small game-camera sprites for the current 2D canvas runtime.
# These are ONLY the South/front view; not a full eight-bearing atlas.
# Render transparent instead of recording the large turntable GIF in game assets.
win.SetAlphaBitPlanes(1)
ren.SetBackgroundAlpha(0.0)
ren.GradientBackgroundOff()
alpha=[]
for i in range(FRAMES):
 assign_pose('walk',i)
 cam=ren.GetActiveCamera()
 elev=math.radians(16);d=5.
 cam.SetPosition(0.,-d*math.cos(elev),1.055+d*math.sin(elev))
 cam.SetFocalPoint(0.,0.,1.055);cam.SetViewUp(0.,0.,1.)
 cam.ParallelProjectionOn();cam.SetParallelScale(1.145)
 win.SetSize(160,240);ren.ResetCameraClippingRange();win.Render()
 filt=vtk.vtkWindowToImageFilter();filt.SetInput(win)
 filt.SetInputBufferTypeToRGBA();filt.ReadFrontBufferOff();filt.Update()
 im=vtk.vtkImageData();im.DeepCopy(filt.GetOutput())
 raw=vtk_to_numpy(im.GetPointData().GetScalars()).reshape(240,160,4)[::-1].copy()
 alpha.append(Image.fromarray(raw,'RGBA'))
assert alpha[0].getpixel((0,0))[3]==0, 'VTK transparent sprite capture failed'
for w,h in [(64,96),(40,48)]:
 sheet=Image.new('RGBA',(w*FRAMES,h),(0,0,0,0))
 for i,im in enumerate(alpha):
  sheet.paste(im.resize((w,h),Image.Resampling.LANCZOS),(i*w,0))
 sheet.save(OUT/f'C_armed_twohand_south_8frame_{w}x{h}.png',optimize=True)
ren.SetBackgroundAlpha(1.0)

# Export standalone cosmetic pistol prop in neutral horizontal pose (GLB + PNG preview)
# Standalone glTF created with trimesh from the same VTK generated mesh groups.
import trimesh
sc=trimesh.Scene()
for wm in WEAPON:
 mesh=trimesh.Trimesh(vertices=wm['p'],faces=wm['tri'],process=False)
 mesh.visual=trimesh.visual.ColorVisuals(mesh=mesh,vertex_colors=np.tile([*wm['rgb'],255],(len(wm['p']),1)))
 sc.add_geometry(mesh,geom_name=wm['name'])
sc.export(OUT/'C_pink_G26_style_prop.glb')

qa={'status':'OK','character':'C','reference_v3':str(SOURCE),'reuse_v4':str(WALK),'weapon_reference_library':'Hero Shooter / Weapons and Props / Hot Pink Anime Pistol Weapon Atlas.png',
    'armed_pose_states':['idle lowered one handed','walk two-hand close-body low-ready','aim extended two handed'],
    'morph_targets_per_mesh':9,'walk_frames':8,'walk_seconds':PERIOD,'animations':ANIM_META,
    'meshes':len(ALL),'character_meshes':len(M),'weapon_visual_groups':len(WEAPON),
    'triangle_count':int(sum(len(x['tri']) for x in ALL)),
    'rights':'Original game-art procedural geometry; no manufacturing blueprint','rig':'Morph targets on geometry; no armature/skinned joints',
    'model_front':'-Y','model_up':'+Z','right_hand':'-X from front','gun_held_by':'anatomical right hand, supported by left hand in moving/aiming poses',
    'source_v3_untouched':True,'source_v4_untouched':True,'updated_two_hand_lowready':True}
with open(OUT/'QA_report.json','w') as f:json.dump(qa,f,indent=2)
with open(OUT/'README.md','w') as f:
 f.write('''# Hero Shooter — C V6 (armed animated model)\n\n'''+
 '''Based directly on canonical C V3 anime-face GLB and V4 paced walk. The Glock 26-inspired compact pink pistol is an original **stylized game prop** based on the generated weapon atlas in the Hero Shooter Library. It has a dark slide, vivid pink frame and magazine detail, red-dot sight and underbarrel flashlight. It is not a mechanically accurate firearm or fabrication model.\n\n'''+
 '''**Animation clips:** `C_Armed_Idle_PistolDown` (arms low; pistol points at ground), `C_Armed_Walk_LowReady_8` (8-frame paced gait, both hands together near solar plexus, muzzle down-angled), `C_Armed_Aim_Extended` (both arms forward, red-dot presentation), plus `C_Armed_Raise` and `C_Armed_Lower` short transitions. These are morph-target clips, not skinned skeletal rigging; static GLB default appearance is idle down. Engines must blend/switch named animation clips explicitly and transition back to idle on movement stop.\n\n'''+
 '''Files: `C_armed_v6_twohand_lowready.glb` is the main animated GLB. Three `poses/*.glb` standalones provide compatibility for viewers with no morph support. `C_pink_G26_style_prop.glb` is the independent weapon prop. `C_armed_v6_pose_comparison.png` previews all states and `C_armed_lowready_walk_3views.gif` shows the loop. `build_c_armed_v6.py` is reproducible source.\n\n'''+
 '''Coordinates: +Z up, -Y forward; anatomical right arm/hand appears on viewer's left (-X). No 2D atlas or game integration was made. For sprite rendering, use the repository `hero-sprite-bearings` screen-space contract.\n\n'''+
 '''This is a first-pass procedural morph animation, not an IK/skeletal game rig. Joint transitions, finger-to-grip fit and gun-sight line need manual QC in the game's intended camera before deployment.\n''')
print(json.dumps({'GLB':str(MAIN),'bytes':MAIN.stat().st_size,'states':3,'clips':len(ANIM_META),'total_meshes':len(ALL),'triangles':qa['triangle_count']},indent=2))