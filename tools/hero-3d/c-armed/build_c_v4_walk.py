#!/usr/bin/env python3
"""Hero Shooter C — V4 paced 8-phase 3D walk. Python VTK + glTF morph targets.

Does not overwrite approved V3 GLB. Preserves original mesh/UV/material geometry.
Exports GLB with 8 morph-target poses and looping morph-weight animation,
8 per-frame pose GLBs for compatibility, PNG sprites and multi-angle GIF previews.

Coordinate: +Z up, front -Y. Character is unarmed. No skeletal rig is claimed;
this is a reusable procedural gait profile plus vertex-deformation prototype.
"""
import json, struct, math, zipfile, io, os
from pathlib import Path
import numpy as np
import vtk
from PIL import Image, ImageDraw, ImageFont
from vtk.util.numpy_support import numpy_to_vtk

HERE=Path(__file__).resolve().parent
SOURCE=HERE/'C_unarmed_VTK_v3/C_unarmed_v3_animeface.glb'
OUT=HERE/'C_unarmed_VTK_v4_walk'
OUT.mkdir(parents=True,exist_ok=True)
TEXTURE=HERE/'C_unarmed_VTK_v3/C_face_anime_smirk.png'

PERIOD=1.08  # seconds per complete left/right cycle; 1.85 steps per second
FRAMES=8
STEP_AMPLITUDE=0.175  # model metres; restrained purposeful gait
STANCE_FRACTION=0.61
FOOT_CLEARANCE=.055
ARM_SWING_RADIANS=np.deg2rad(8.3)

CFG={
 'profile':'hero-shooter-neutral-paced-walk-v1','frames':FRAMES,'period_seconds':PERIOD,
 'stance_portion':STANCE_FRACTION,'foot_fore_aft_amplitude_model_units':STEP_AMPLITUDE,
 'swing_foot_clearance_model_units':FOOT_CLEARANCE,
 'arm_swing_degrees':8.3,'neutral_pose':'Unarmed, arms by sides',
 'model_forward':'-Y','model_up':'+Z',
 'method':'procedural 2-bone sagittal IK, mesh-local weighted deformation, glTF morph-weight animation',
 'game_direction_convention':'South/front is character facing screen-down; use hero-sprite-bearings for 2D render',
 'retargeting':'parametric gait; change anthropometry/hip,knee,ankle pivot placement for another character, not a skeleton rig',
 'license':'Original generated modelling and rig-control code; no external motion-capture assets'
}


def parse_glb(path):
 raw=path.read_bytes();magic,ver,ln=struct.unpack_from('<4sII',raw)
 assert magic==b'glTF' and ver==2 and ln==len(raw)
 cur=12;js=None;binary=None
 while cur<len(raw):
  size,typ=struct.unpack_from('<I4s',raw,cur);data=raw[cur+8:cur+8+size];cur+=8+size
  if typ==b'JSON':js=json.loads(data)
  if typ==b'BIN\x00':binary=bytearray(data)
 assert js and binary
 return js,binary

j,rawbin=parse_glb(SOURCE)
accessors=j['accessors'];views=j['bufferViews']

CTYPES={5126:('<f4',4),5125:('<u4',4),5123:('<u2',2),5121:('u1',1)}
DIM={'SCALAR':1,'VEC2':2,'VEC3':3,'VEC4':4}

def get_arr(ix):
 a=accessors[ix];v=views[a['bufferView']];dtype,b=CTYPES[a['componentType']];dim=DIM[a['type']]
 start=v['byteOffset']+a.get('byteOffset',0)
 if v.get('byteStride',0) not in (0,dim*b):
  raise ValueError('Interleaved vertex buffer not supported')
 arr=np.frombuffer(rawbin,dtype=np.dtype(dtype),count=a['count']*dim,offset=start)
 return arr.reshape(a['count'],dim).copy()

BASE=[]
for idx,mesh in enumerate(j['meshes']):
 p=mesh['primitives'][0];v=get_arr(p['attributes']['POSITION']).astype(np.float64)
 ind=get_arr(p['indices']).ravel().astype(np.uint32)
 BASE.append({'name':mesh['name'],'vertices':v,'indices':ind,'primitive':p,'color':get_arr(p['attributes']['COLOR_0']).copy() if 'COLOR_0' in p['attributes'] else None,'uv':get_arr(p['attributes']['TEXCOORD_0']).copy() if 'TEXCOORD_0' in p['attributes'] else None})


def smooth(x,a,b):
 r=np.clip((x-a)/(b-a),0.,1.)
 return r*r*(3-2*r)

def rot_x(v,theta):
 c,s=np.cos(theta),np.sin(theta)
 out=v.copy()
 out[...,1]=c*v[...,1]-s*v[...,2]
 out[...,2]=s*v[...,1]+c*v[...,2]
 return out

def rot_yz_from_to(v0,v1):
 a,b=v0[1:],v1[1:];la=np.linalg.norm(a);lb=np.linalg.norm(b)
 cosine=np.clip(np.dot(a,b)/(la*lb),-1.,1.)
 sine=(a[0]*b[1]-a[1]*b[0])/(la*lb)
 return math.atan2(sine,cosine)

def foot_trajectory(t):
 t=t%1.
 if t < STANCE_FRACTION:
  u=t/STANCE_FRACTION
  yy=-STEP_AMPLITUDE+2*STEP_AMPLITUDE*u
  zz=0.
  # Small toe-rock late in stance; feet remain grounded at their base soles.
  pitch=(math.radians(-2.8)*(1-smooth(u,0,.17))
         +math.radians(4.0)*smooth(u,.82,.995))
 else:
  u=(t-STANCE_FRACTION)/(1.-STANCE_FRACTION)
  # smooth swing return, no instantaneous teleport at the loop point
  yy=STEP_AMPLITUDE-2*STEP_AMPLITUDE*(3*u*u-2*u*u*u)
  zz=FOOT_CLEARANCE*(math.sin(math.pi*u)**1.35)
  pitch=math.radians(-2.5)*math.sin(math.pi*u)
 return yy,zz,pitch

def solve_leg(s,t,root):
 # Correct slight bend with two-bone, length-preserving sagittal IK.
 baseH=np.array([s*.144,.016,.978]);baseK=np.array([s*.159,.003,.551]);baseA=np.array([s*.176,-.023,.211])
 L1=np.linalg.norm(baseK-baseH);L2=np.linalg.norm(baseA-baseK)
 y,clear,pitch=foot_trajectory(t)
 H=baseH+np.array([root[0],root[1],root[2]])
 A=np.array([s*.176+root[0]*.30,y,baseA[2]+clear])
 d=A[1:]-H[1:];dist=np.linalg.norm(d)
 if dist>L1+L2-1e-4:
  # Distance correction is below a millimetre at these amplitudes.
  dist2=L1+L2-1e-4
  A[1:]=H[1:]+(d/dist)*dist2;d=A[1:]-H[1:];dist=dist2
 along=(L1*L1-L2*L2+dist*dist)/(2*dist)
 high=max(0.,L1*L1-along*along)**.5
 unit=d/dist
 perp=np.array([-unit[1],unit[0]])
 K2=H[1:]+along*unit-high*perp  # knee bows toward front (-Y)
 K=np.array([s*.157+root[0]*.60,*K2])
 theta1=rot_yz_from_to(baseK-baseH,K-H)
 theta2=rot_yz_from_to(baseA-baseK,A-K)
 return {'baseH':baseH,'baseK':baseK,'baseA':baseA,'H':H,'K':K,'A':A,'top_angle':theta1,'shin_angle':theta2,'pitch':pitch,'foot_y':y,'clear':clear}


def deformed(name,positions,index):
 p=positions.astype(np.float64,copy=True)
 phase=index/FRAMES
 bob=-.022+.009*(-np.cos(4*np.pi*phase)) # trough at contact, slight lift at midstance
 sway=.0075*np.sin(2*np.pi*phase)
 root=np.array([sway,0.0,bob]);out=p+root
 is_arm_group = name in ('skin','glove','glove2','jacket','jacket2','jacketshadow','black','patch','silver')
 is_leg_group = name not in ('face','hair','hairdark','hairmid','hairglow','headband','flower','flowermid','scarf_dark','scarf_white','silver','patch','eyelash','pupil','iris','skinshadow')
 for side,legshift in [(-1,0.0),(1,0.5)]:
  xx=p[:,0]*side
  arm_mask=np.zeros(len(p))
  if is_arm_group:
   arm_mask=smooth(xx,.245,.333)*smooth(p[:,2],.782,.853)*(1-smooth(p[:,2],1.38,1.53))
   sh=np.array([side*.274,.020,1.385]);theta= -side*ARM_SWING_RADIANS*np.cos(2*np.pi*phase)
   a=sh+root+rot_x(p-sh,theta)
   # Forearms naturally angle a little forward around the elbow.
   e=np.array([side*.325,.017,1.150]);e2=sh+root+rot_x(e-sh,theta)
   bend=math.radians(-5.0) # little forward bend in elbows
   lower=e2+rot_x(a-e2,bend)
   fore_weight=1.-smooth(p[:,2],1.105,1.215)
   arm_new=a*(1-fore_weight[:,None])+lower*fore_weight[:,None]
   out+=arm_mask[:,None]*(arm_new-out)
  if not is_leg_group:continue
  mask=smooth(xx,.042,.130)*(1-smooth(p[:,2],.926,1.075))
  if not np.any(mask>.01):continue
  mask=mask*(1-arm_mask)
  leg=solve_leg(side,(phase+legshift)%1.,root)
  upper=leg['H']+rot_x(p-leg['baseH'],leg['top_angle'])
  lower=leg['K']+rot_x(p-leg['baseK'],leg['shin_angle'])
  ankle=leg['A']+rot_x(p-leg['baseA'],leg['pitch'])
  kneeweight=smooth(p[:,2],.497,.612)
  footweight=1-smooth(p[:,2],.175,.268)
  below=lower*(1-footweight[:,None])+ankle*footweight[:,None]
  target=upper*kneeweight[:,None]+below*(1-kneeweight[:,None])
  out+=mask[:,None]*(target-out)
 # gentle torso twist at waist around vertical; keeps smile and scarf stable
 yaw=math.radians(.85)*math.sin(2*np.pi*phase)
 torso_zone=smooth(p[:,2],.95,1.40)*(1-smooth(p[:,2],1.46,1.70))
 if np.any(torso_zone>0):
  c,s=np.cos(yaw),np.sin(yaw);center=np.array([root[0],root[1],1.00+root[2]])
  v=out-center;turned=v.copy();turned[:,0]=c*v[:,0]-s*v[:,1];turned[:,1]=s*v[:,0]+c*v[:,1]
  out+=(turned-v)*torso_zone[:,None]
 return out.astype(np.float32)

POSES=[[deformed(m['name'],m['vertices'],i) for m in BASE] for i in range(FRAMES)]

# Create complete animated GLB with shareable glTF 2.0 morph target animation.
js=json.loads(json.dumps(j))
newbin=bytearray(rawbin)
while len(newbin)%4:newbin+=b'\0'

def add_bytes(bb):
 while len(newbin)%4:newbin.extend(b'\0')
 off=len(newbin);newbin.extend(bb)
 while len(newbin)%4:newbin.extend(b'\0')
 iv=len(js['bufferViews'])
 js['bufferViews'].append({'buffer':0,'byteOffset':off,'byteLength':len(bb)})
 return iv

def add_accessor(arr,component_type,kind,with_bounds=False):
 arr=np.ascontiguousarray(arr)
 bv=add_bytes(arr.tobytes());idx=len(js['accessors'])
 a={'bufferView':bv,'componentType':component_type,'type':kind,'count':len(arr)}
 if with_bounds:
  a['min']=np.min(arr,axis=0).tolist() if arr.ndim>1 else [float(np.min(arr))]
  a['max']=np.max(arr,axis=0).tolist() if arr.ndim>1 else [float(np.max(arr))]
 js['accessors'].append(a)
 return idx

for mesh_index,m in enumerate(js['meshes']):
 base=BASE[mesh_index]['vertices'].astype(np.float32)
 p=m['primitives'][0]
 targets=[]
 for f in range(FRAMES):
  diff=POSES[f][mesh_index]-base
  idx=add_accessor(diff,5126,'VEC3',with_bounds=True)
  targets.append({'POSITION':idx})
 p['targets']=targets
 m['weights']=[1.]+[0.]*(FRAMES-1)
 m['extras']={'targetNames':[f'walk_{k:02}' for k in range(FRAMES)]}

# GlTF animation output SCALAR has frame count multiplied by morph target count.
# A single sampler can animate all mesh nodes because they share timings/weights.
times=np.arange(FRAMES+1,dtype=np.float32)*PERIOD/FRAMES
weights=np.zeros((FRAMES+1,FRAMES),dtype=np.float32)
for i in range(FRAMES):weights[i,i]=1
weights[-1,0]=1
input_acc=add_accessor(times,5126,'SCALAR',with_bounds=True)
output_acc=add_accessor(weights.ravel(),5126,'SCALAR')
channels=[]
for index,node in enumerate(js['nodes']):
 if 'mesh' in node:channels.append({'sampler':0,'target':{'node':index,'path':'weights'}})
js['animations']=[{'name':'C_Paced_Walk_8','samplers':[{'input':input_acc,'output':output_acc,'interpolation':'LINEAR'}], 'channels':channels}]
js['buffers'][0]['byteLength']=len(newbin)
js.setdefault('asset',{}).setdefault('extras',{})['walk_profile']='Hero Shooter paced walk 8 poses / morph targets; not skeletal skinning'

def save_glb(path,js,content):
 jd=json.dumps(js,separators=(',',':'),ensure_ascii=False).encode('utf8');jd+=b' ' * (-len(jd)%4)
 bd=bytes(content);bd+=b'\0'*(-len(bd)%4)
 length=12+8+len(jd)+8+len(bd)
 with open(path,'wb') as f:
  f.write(struct.pack('<4sII',b'glTF',2,length));f.write(struct.pack('<I4s',len(jd),b'JSON'));f.write(jd)
  f.write(struct.pack('<I4s',len(bd),b'BIN\0'));f.write(bd)

anim_glb=OUT/'C_paced_walk_v4_8frame_animated.glb'
save_glb(anim_glb,js,newbin)

# Save eight individually posed GLBs too; they can be previewed in any viewer
# irrespective of support for the GLB morph-weight animations.
POSE_GLBS=OUT/'frame_glbs';POSE_GLBS.mkdir(exist_ok=True)
for f in range(FRAMES):
 by=bytearray(rawbin)
 for mid,mesh in enumerate(j['meshes']):
  pos_acc=j['accessors'][mesh['primitives'][0]['attributes']['POSITION']]
  view=j['bufferViews'][pos_acc['bufferView']]
  off=view['byteOffset']+pos_acc.get('byteOffset',0)
  vertices=POSES[f][mid]
  by[off:off+vertices.nbytes]=vertices.tobytes()
  pos_acc_copy=None
 # Note: original min/max accessor bounds remain valid for most vertices; update for safety
 basejson=json.loads(json.dumps(j))
 for mid,mesh in enumerate(basejson['meshes']):
  pa=basejson['accessors'][mesh['primitives'][0]['attributes']['POSITION']]
  vv=POSES[f][mid]
  pa['min']=vv.min(axis=0).tolist();pa['max']=vv.max(axis=0).tolist()
 save_glb(POSE_GLBS/f'C_walk_{f:02}.glb',basejson,by)

# Build VTK renderer from same vertex buffers, texture preserved, one mapper per material.
ren=vtk.vtkRenderer();ren.SetBackground(.050,.050,.063);ren.SetBackground2(.116,.106,.128);ren.GradientBackgroundOn()
actors=[]
for m in BASE:
 pts=vtk.vtkPoints();pts.SetDataTypeToFloat();pts.SetData(numpy_to_vtk(m['vertices'].astype(np.float32),deep=True))
 pd=vtk.vtkPolyData();pd.SetPoints(pts)
 ids=m['indices'].reshape(-1,3)
 cells=vtk.vtkCellArray();cell_arr=np.hstack([np.full((len(ids),1),3,dtype=np.int64),ids]).flatten()
 cells.SetCells(len(ids),numpy_to_vtk(cell_arr,deep=True,array_type=vtk.VTK_ID_TYPE))
 pd.SetPolys(cells)
 if m['uv'] is not None:
  uv=numpy_to_vtk(m['uv'].astype(np.float32),deep=True);uv.SetName('TCoords');uv.SetNumberOfComponents(2);pd.GetPointData().SetTCoords(uv)
 norm=vtk.vtkPolyDataNormals();norm.SetInputData(pd);norm.ComputePointNormalsOn();norm.SplittingOff();norm.AutoOrientNormalsOff();norm.Update()
 # The normals pipeline is updated when point positions change below.
 mp=vtk.vtkPolyDataMapper();mp.SetInputConnection(norm.GetOutputPort());mp.ScalarVisibilityOff()
 act=vtk.vtkActor();act.SetMapper(mp)
 if m['uv'] is not None:
  reader=vtk.vtkPNGReader();reader.SetFileName(str(TEXTURE));reader.Update()
  tex=vtk.vtkTexture();tex.SetInputConnection(reader.GetOutputPort());tex.InterpolateOn();tex.RepeatOff()
  act.SetTexture(tex);act.GetProperty().SetColor(1.,1.,1.)
 else:
  color=m['color'][0][:3].astype(float)/255
  act.GetProperty().SetColor(*color)
 act.GetProperty().SetInterpolationToPhong();act.GetProperty().SetAmbient(.30);act.GetProperty().SetDiffuse(.73);act.GetProperty().SetSpecular(.045)
 ren.AddActor(act);actors.append((pd,pts,norm))

for position,intensity in [((-3,-4,6),1.20),((3,2,5),.70)]:
 lt=vtk.vtkLight();lt.SetLightTypeToSceneLight();lt.SetPosition(*position);lt.SetFocalPoint(0,0,1);lt.SetIntensity(intensity);ren.AddLight(lt)
win=vtk.vtkRenderWindow();win.SetOffScreenRendering(1);win.SetAlphaBitPlanes(1);win.SetSize(480,650);win.SetMultiSamples(2);win.AddRenderer(ren)


def pose_vtk(f):
 for mid,(pd,pts,norm) in enumerate(actors):
  pts.SetData(numpy_to_vtk(POSES[f][mid],deep=True));pts.Modified();pd.Modified();norm.Modified()

def render(f,az,filename,size=(480,650)):
 pose_vtk(f);w,h=size;win.SetSize(w,h)
 cam=ren.GetActiveCamera()
 a=math.radians(az);el=math.radians(5)
 d=5.2
 cam.SetPosition(d*math.sin(a)*math.cos(el),-d*math.cos(a)*math.cos(el),1.09+d*math.sin(el))
 cam.SetFocalPoint(0,0,1.055);cam.SetViewUp(0,0,1)
 cam.ParallelProjectionOn();cam.SetParallelScale(1.13)
 ren.ResetCameraClippingRange();win.Render()
 w2i=vtk.vtkWindowToImageFilter();w2i.SetInput(win);w2i.SetInputBufferTypeToRGB();w2i.ReadFrontBufferOff();w2i.Update()
 wr=vtk.vtkPNGWriter();wr.SetFileName(str(filename));wr.SetInputConnection(w2i.GetOutputPort());wr.Write()

PNG=OUT/'png_frames';PNG.mkdir(exist_ok=True)
for i in range(FRAMES):
 for view,angle in [('front',0),('threequarter',-32),('side',90)]:
  render(i,angle,PNG/f'C_walk_{i:02}_{view}.png',size=(420,580))

# Build comparison sheets; previews labelled separately, no labels on exported cells.
for view in ['front','threequarter','side']:
 thumb=(270,375);sheet=Image.new('RGB',(thumb[0]*4,thumb[1]*2),(24,23,32))
 for i in range(FRAMES):
  pic=Image.open(PNG/f'C_walk_{i:02}_{view}.png').convert('RGB').resize(thumb,Image.Resampling.LANCZOS)
  sheet.paste(pic,((i%4)*thumb[0],(i//4)*thumb[1]))
 sheet.save(OUT/f'C_walk_eight_frames_{view}.png')

# Multi-angle preview: duplicate first frame at wrap rather than hold with discontinuity.
gifs=[]
for view in ['threequarter','side','front']:
 pictures=[Image.open(PNG/f'C_walk_{i:02}_{view}.png').convert('RGB').resize((380,525),Image.Resampling.LANCZOS) for i in range(FRAMES)]
 path=OUT/f'C_paced_walk_{view}.gif'
 pictures[0].save(path,save_all=True,append_images=pictures[1:],duration=int(PERIOD*1000/FRAMES),loop=0,optimize=True,disposal=2)
 gifs.append(path)
# Animation sync comparison with 3 views side by side
combined=[]
for i in range(FRAMES):
 panel=Image.new('RGB',(380*3,525),(24,23,32))
 for v,view in enumerate(['front','threequarter','side']):
  im=Image.open(PNG/f'C_walk_{i:02}_{view}.png').convert('RGB').resize((380,525),Image.Resampling.LANCZOS)
  panel.paste(im,(v*380,0))
 combined.append(panel)
combined[0].save(OUT/'C_paced_walk_multiview.gif',save_all=True,append_images=combined[1:],duration=int(PERIOD*1000/FRAMES),loop=0,optimize=True,disposal=2)

# Eight transparent front-facing preview frames; not the directional 8-column game atlas.
# In Hero Shooter terms this is the South/front-facing view ONLY, eight animation phases.
win.SetAlphaBitPlanes(1)
ren.SetBackgroundAlpha(0.0)
ren.GradientBackgroundOff()
SPRITES=OUT/'south_alpha_frames';SPRITES.mkdir(exist_ok=True)
alpha_frames=[]
for i in range(FRAMES):
 pose_vtk(i)
 cam=ren.GetActiveCamera(); az=0.0; elev=math.radians(16)
 d=5.0
 cam.SetPosition(0,-d*math.cos(elev),1.055+d*math.sin(elev))
 cam.SetFocalPoint(0,0,1.055);cam.SetViewUp(0,0,1)
 cam.ParallelProjectionOn();cam.SetParallelScale(1.14)
 ren.ResetCameraClippingRange();win.SetSize(256,384);win.Render()
 w2i=vtk.vtkWindowToImageFilter();w2i.SetInput(win);w2i.SetInputBufferTypeToRGBA();w2i.ReadFrontBufferOff();w2i.Update()
 wr=vtk.vtkPNGWriter();wr.SetFileName(str(SPRITES/f'C_walk_south_{i:02}.png'))
 wr.SetInputConnection(w2i.GetOutputPort());wr.Write()
 alpha_frames.append(Image.open(SPRITES/f'C_walk_south_{i:02}.png').convert('RGBA').copy())
alpha_sheet=Image.new('RGBA',(256*FRAMES,384),(0,0,0,0))
for i,im in enumerate(alpha_frames):alpha_sheet.paste(im,(256*i,0))
alpha_sheet.save(OUT/'C_walk_south_8frame_transparent_strip.png')
assert alpha_frames[0].getpixel((0,0))[3]==0, 'Transparent render failed'
ren.SetBackgroundAlpha(1.0)

# Profile data for retargeting to other characters
pose_metrics=[]
for i in range(FRAMES):
 phase=i/FRAMES
 root=np.array([.0075*np.sin(2*np.pi*phase),0.,-.022-.009*np.cos(4*np.pi*phase)])
 legs={}
 for side,label,shift in [(-1,'model_left',0),(1,'model_right',.5)]:
  d=solve_leg(side, (phase+shift)%1,root)
  legs[label]={'hip':d['H'].round(5).tolist(),'knee':d['K'].round(5).tolist(),'ankle':d['A'].round(5).tolist(),
               'hip_rotation_x_degrees':round(math.degrees(d['top_angle']),3),
               'shin_rotation_x_degrees':round(math.degrees(d['shin_angle']),3),
               'foot_rotation_x_degrees':round(math.degrees(d['pitch']),3),
               'swing_clearance':round(d['clear'],5)}
 pose_metrics.append({'frame':i,'time_seconds':round(i*PERIOD/FRAMES,5),'root_offset':root.round(5).tolist(),
                      'arm_swing_model_left_deg':round(math.degrees(ARM_SWING_RADIANS*np.cos(2*np.pi*phase)),3),
                      'arm_swing_model_right_deg':round(math.degrees(-ARM_SWING_RADIANS*np.cos(2*np.pi*phase)),3),'legs':legs})
CFG['frames_data']=pose_metrics
CFG['asset']={'animated_glb':anim_glb.name,'v3_source':SOURCE.name,'geometry_groups':len(BASE),'mesh_was_not_skeleton_rigged':True,'preserves_face_uv_texture':True}
with open(OUT/'reusable_paced_walk_profile.json','w') as f:json.dump(CFG,f,indent=2)
with open(OUT/'README.md','w') as f:
 f.write('''# Hero Shooter — C unarmed V4 / eight-frame paced walk\n\n'''
 '''This is a restrained, purposeful pedestrian walk (not a stroll or march), with slight contralateral arm swing, moderate strides, two-bone inverse-kinematics knees, knee flex during the airborne swing and restrained hip bounce.\n\n'''
 '''**Primary asset** `C_paced_walk_v4_8frame_animated.glb`: real 3D meshes with eight morph targets per original mesh and one looping glTF animation `C_Paced_Walk_8` (linear transitions). Compatible with viewers/engines that implement glTF morph-target weights; static viewers show frame 0. The UV-painted anime face material is kept.\n\n'''
 '''`frame_glbs/` contains eight posed static GLBs as compatibility fallbacks. `png_frames/` has front, three-quarter and side rendered images from VTK. `C_paced_walk_multiview.gif` is an animated review of those views.\n\n'''
 '''`reusable_paced_walk_profile.json` captures pivot definitions, timing and per-frame knee/ankle targets for adapting to other models. `build_c_v4_walk.py` is the full reproducible Python builder.\n\n'''
 '''Important: **This is morph-target animation, not a transferable skeletal animation / skinned rig**. The gait *parameters* are reusable, but another character requires matching joint placement or a real skeleton retarget pass.\n\n'''
 '''World coordinates +Z up, -Y forward. No weapon; no runtime game integration. Original C V3 remains untouched.\n''')

# GLB validation
jj,bin2=parse_glb(anim_glb)
assert len(jj['animations'])==1
assert len(jj['meshes'])==len(BASE)
assert all(len(m['primitives'][0].get('targets',[]))==FRAMES for m in jj['meshes'])
assert len(jj['animations'][0]['channels'])==len(jj['meshes'])
assert all(len(jj['meshes'][i]['primitives'][0]['targets'])==FRAMES for i in range(len(BASE)))
assert len(POSES)==FRAMES
assert np.isfinite(np.concatenate([np.concatenate(pose,axis=0) for pose in POSES])).all()
print(json.dumps({'status':'OK','frames':FRAMES,'period_sec':PERIOD,'meshes':len(BASE),
 'gltf_animation_channels':len(jj['animations'][0]['channels']),'animated_glb_bytes':anim_glb.stat().st_size,
 'pose_glbs':len(list(POSE_GLBS.glob('*.glb')))},indent=2))