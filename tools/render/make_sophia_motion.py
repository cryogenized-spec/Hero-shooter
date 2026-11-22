#!/usr/bin/env python3
"""Hero Shooter: deterministic v3.3 Sophia/Saafiya sprite + chrome pistol exporter.

Source: last approved painted-face Sophia v3.3 meshes and textures.
The GLB is an unrigged source asset; the PNG sprite animations are generated
by articulated, repeatable geometry transforms, not image generation.

World: X character left, Y character front, Z up (model units). Camera fixed
in +Y at 58 deg elevation. Screen bearing atlas rows S,SW,W,NW,N,NE,E,SE.
"""
from pathlib import Path
import math, json, sys, time, os, shutil
import numpy as np
from PIL import Image, ImageDraw
import vtk
from vtk.util.numpy_support import vtk_to_numpy
import sophia_saafiya_studio_v3_3_builder as source

HERE=Path(__file__).resolve().parent
OUT=HERE/'sophia_motion_output';OUT.mkdir(exist_ok=True,parents=True)
SHEET_DIR=OUT/'frames';SHEET_DIR.mkdir(exist_ok=True)
MODEL_DIR=HERE/'sophia_saafiya_studio_v3_3'
FRAME=(176,224)
DIRS={'S':0,'SW':45,'W':90,'NW':135,'N':180,'NE':225,'E':270,'SE':315}
POSES=('lowered','aimed')
GAITS=('walk','run')


def trans(v):
 m=vtk.vtkMatrix4x4()
 for i in range(4):
  for j in range(4):m.SetElement(i,j,float(v[i,j]))
 return m

def move(x=0,y=0,z=0):
 m=np.eye(4);m[:3,3]=[x,y,z];return m

def rot_x(deg):
 a=math.radians(deg);m=np.eye(4);m[1,1]=m[2,2]=math.cos(a);m[1,2]=-math.sin(a);m[2,1]=math.sin(a);return m

def rot_z(deg):
 a=math.radians(deg);m=np.eye(4);m[0,0]=m[1,1]=math.cos(a);m[0,1]=-math.sin(a);m[1,0]=math.sin(a);return m

def about(p,m):return move(*p)@m@move(*(-np.array(p)))


def add_chrome_prop(m):
 """Stylized Cheetah-family prop: 7.65 mm / slim single-stack visual profile.

 The accepted character backstory calls it an 84FS, but a real 84FS is a
 9 mm short double-stack pistol. A 7.65-mm single-stack is the Model 82.
 For Hero Shooter this cosmetic reference is deliberately based on the Model
 82-like slim grip shape while preserving the story's polished Cheetah look.

 Fixed 3D hand-space: -Z is muzzle-forward in a lowered pose, rotated by
 exactly +90 degrees around the shoulder when sighted straight ahead (+Y).
 The barrel / sights have identical X and Y centerlines: zero prop skew.
 These are silhouette surfaces only, not functional/mechanical gun parts.
 """
 x=-.435
 thickness=.044
 def extrusion(name, outline, material, thick=thickness, metal=.75):
  pts=[]
  for xx in (x-thick/2,x+thick/2):
   pts.extend([(xx,float(y),float(z)) for y,z in outline])
  n=len(outline);faces=[]
  for i in range(1,n-1):
   faces.append((0,i,i+1));faces.append((n,n+i+1,n+i))
  for i in range(n):
   j=(i+1)%n
   faces.extend([(i,j,n+j),(i,n+j,n+i)])
  return m.grid_surface(name,pts,faces,material,metal=metal)

 grip=[(.128,.840),(.155,.833),(.172,.859),(.155,.890),
       (.119,.928),(.080,.953),(.048,.953),(.030,.940),
       (.024,.908),(.038,.872),(.073,.840)]
 extrusion('prop/beretta84fs/ergonomic_slim_grip',grip,'silver_dark',thick=.038,metal=.42)
 inset=[(.125,.859),(.146,.861),(.143,.881),(.111,.914),
        (.074,.932),(.055,.930),(.052,.909),(.066,.872)]
 for s in (-1,1):
  xx=x+s*.022
  v=[(xx,y,z) for y,z in inset]
  faces=[(0,i,i+1) for i in range(1,len(v)-1)]
  m.grid_surface('prop/beretta84fs/contoured_black_grip_panel',v,faces,'shadow',metal=.03)
  for i in range(3):
   mz=.885+.015*i; my=.102-.012*i
   m.tube('prop/beretta84fs/grip_checkering',
          [(xx+s*.001,my-.014,mz-.010),(xx+s*.001,my+.019,mz+.009)],
          .00165,'silver_dark',edges=6,metal=.12)

 frame=[(.145,.813),(.203,.811),(.210,.831),(.201,.864),
        (.176,.877),(.143,.872),(.122,.858)]
 extrusion('prop/beretta84fs/curved_receiver',frame,'silver',thick=.045,metal=.88)

 # Tapered open-top slide instead of a Glock-like solid rectangle.
 slide=[(.162,.657),(.201,.657),(.211,.668),(.213,.806),
        (.205,.826),(.179,.836),(.160,.827),(.153,.806),(.154,.680)]
 extrusion('prop/beretta84fs/rounded_open_slide',slide,'silver_hi',thick=.046,metal=.91)
 m.tube('prop/beretta84fs/slide_cutout_shadow',
        [(x,.217,.702),(x,.217,.789)],.007,'silver_dark',edges=10,metal=.15)
 m.tube('prop/beretta84fs/exposed_barrel_glint',
        [(x,.222,.699),(x,.222,.768)],.0035,'silver',edges=9,metal=.85)

 # Closed hollow guard, situated underneath the slide, not above it.
 guard_yz=[(.159,.808),(.145,.798),(.123,.800),(.108,.814),
           (.106,.835),(.117,.850),(.137,.859),(.158,.854)]
 for xx in (x-.024,x+.024):
  m.tube('prop/beretta84fs/rounded_trigger_guard',
         [(xx,y,z) for y,z in guard_yz],.0045,'silver',
         edges=9,metal=.80,closed=True)
 m.tube('prop/beretta84fs/trigger_curve',
        [(x-.026,.139,.819),(x-.027,.132,.824),(x-.027,.127,.841)],
        .0032,'silver_dark',edges=9,metal=.40)

 # Aligned front/rear sights and a cosmetic dark muzzle disk.
 m.cube('prop/beretta84fs/front_sight',(x,.223,.662),
        (.018,.012,.016),'silver_dark',metal=.30)
 m.cube('prop/beretta84fs/rear_sight',(x,.223,.822),
        (.020,.013,.014),'silver_dark',metal=.30)
 m.ell('prop/beretta84fs/dark_muzzle',(x,.181,.649),
       (.020,.016,.005),'silver_dark',res=14,metal=.1)
 m.ell('prop/beretta84fs/hammer_nub',(x,.186,.849),
       (.016,.024,.017),'silver',res=14,metal=.86)
 for sign in (-1,1):
  xx=x+sign*.026
  for k in range(4):
   z=.796+k*.009
   m.tube('prop/beretta84fs/rear_slide_serration',
          [(xx,.164,z),(xx,.205,z+.003)],
          .0015,'silver_dark',edges=6,metal=.13)


class SophiaMotion:
 def __init__(self):
  source.make_painted_face('angry')
  self.model=source.Studio33()
  add_chrome_prop(self.model)
  self.parts=self.model.parts
  # V3.2 construction has separate limb blocks in stable assembly order.
  # In a future skeletal conversion this table can be replaced with bone weights.
  self.groups={}
  for idx,(name,mat,poly,actor) in enumerate(self.parts):
   # Stable v3.3 authoring blocks: two legs, two arms, and rigid torso/hair.
   # Separate coat tails stay attached to hips, not the raised aiming arms.
   if idx<=37: group='left_leg'
   elif idx<=77: group='right_leg'
   elif 112<=idx<=130: group='left_arm'
   elif 134<=idx<=152: group='right_arm'
   elif name.startswith('prop/'): group='left_arm'
   else: group='torso'
   self.groups[idx]=group
  self.setup_renderer()
 def setup_renderer(self):
  self.ren=vtk.vtkRenderer();self.ren.SetBackground(0,0,0);self.ren.SetBackgroundAlpha(0)
  self.win=vtk.vtkRenderWindow();self.win.SetOffScreenRendering(True)
  self.win.SetAlphaBitPlanes(1);self.win.SetMultiSamples(0);self.win.SetSize(*FRAME)
  self.win.AddRenderer(self.ren);self.ren.AddActor(self.model.assembly)
  self.cam=vtk.vtkCamera();d=7;e=math.radians(58)
  self.cam.SetPosition(0,d*math.cos(e),1.36+d*math.sin(e))
  self.cam.SetFocalPoint(0,0,1.36);self.cam.SetViewUp(0,0,1)
  self.cam.ParallelProjectionOn();self.cam.SetParallelScale(1.6)
  self.ren.SetActiveCamera(self.cam)
  for pos,intensity in [((-4,5,8),.96),((4,3,5),.40),((0,-5,7),.63)]:
   l=vtk.vtkLight();l.SetPosition(*pos);l.SetFocalPoint(0,0,1.36);l.SetIntensity(intensity);self.ren.AddLight(l)
  self.capture=vtk.vtkWindowToImageFilter();self.capture.SetInput(self.win)
  self.capture.SetInputBufferTypeToRGBA();self.capture.ReadFrontBufferOff()
  self.face=[actor for n,mat,p,actor in self.parts if n=='anatomy/continuous_face_and_nose'][0]
  self.neutral_texture=self.face.GetTexture()
  reader=vtk.vtkPNGReader();reader.SetFileName(str(MODEL_DIR/'sophia_face_angry_uv_v3_3.png'))
  reader.Update()
  self.angry_tex=vtk.vtkTexture();self.angry_tex.SetInputData(reader.GetOutput());self.angry_tex.InterpolateOn();self.angry_tex.RepeatOn()
  self._angry_reader=reader
 def pose(self,yaw,phase,gait,weapon_pose):
  # Avoid updating transforms cumulatively; every frame starts from immutable geometry.
  walk=gait!='idle';running=gait=='run'
  s=math.sin(phase*math.tau) if walk else 0
  amplitude=28 if running else (16 if walk else 0)
  knee=23 if running else 13
  bob=(.038 if running else .018)*(1-math.cos(phase*math.tau*2)) if walk else 0
  body=move(0,0,bob)
  hips={-1:(-.162,0,1.083),1:(.162,0,1.083)}
  legs={}
  for side in (-1,1):
   swing=amplitude*s*(1 if side<0 else -1)
   hip=about(hips[side],rot_x(swing))
   # Lower leg folds backward when its foot is off the floor.
   flex=-knee*max(0,(1 if side<0 else -1)*s)
   knee_p=(side*.158,0,.61)
   legs[side]=(body@hip,body@hip@about(knee_p,rot_x(flex)))
  shoulders={-1:(-.277,-.008,1.813),1:(.277,-.008,1.813)}
  arms={}
  for side in (-1,1):
   if weapon_pose=='aimed':
    # Sight-line pose: pistol and supporting hand project outward with face.
    # Rotations are deterministic visual pose parameters, not procedural aim logic.
    angle_x=90 if side<0 else 88
    angle_z=0 if side<0 else 57
   else:
    angle_x=(5 if running else 3) * -s * (1 if side<0 else -1)
    angle_z=0
   arms[side]=body@about(shoulders[side],rot_z(angle_z)@rot_x(angle_x))
  self.model.assembly.SetOrientation(0,0,yaw)
  for idx,(name,mat,poly,actor) in enumerate(self.parts):
   group=self.groups[idx]
   if group=='left_leg':
    matrix=legs[-1][1 if name.startswith('boot/') else 0]
   elif group=='right_leg':
    matrix=legs[1][1 if name.startswith('boot/') else 0]
   elif group=='left_arm':matrix=arms[-1]
   elif group=='right_arm':matrix=arms[1]
   else:matrix=body
   actor.SetUserMatrix(trans(matrix))
  self.face.SetTexture(self.angry_tex if weapon_pose=='aimed' else self.neutral_texture)
 def frame(self,yaw,phase,gait='idle',weapon_pose='lowered'):
  self.pose(yaw,phase,gait,weapon_pose)
  self.win.Render();self.capture.Modified();self.capture.Update()
  w,h=FRAME
  v=vtk_to_numpy(self.capture.GetOutput().GetPointData().GetScalars()).reshape((h,w,4))
  im=Image.fromarray(v[::-1].copy(),'RGBA').transpose(Image.Transpose.FLIP_LEFT_RIGHT)
  if im.getpixel((0,0))[3]!=0:raise RuntimeError('Alpha was not preserved')
  return im


def export(model):
 atlas_manifest={}
 all_rows=[]
 for weapon_pose in POSES:
  for gait in GAITS:
   name=f'sophia_{weapon_pose}_{gait}'
   canvas=Image.new('RGBA',(FRAME[0]*8,FRAME[1]*8),(0,0,0,0))
   for row,(direction,yaw) in enumerate(DIRS.items()):
    for i in range(8):
     im=model.frame(yaw,i/8,gait,weapon_pose)
     canvas.alpha_composite(im,(i*FRAME[0],row*FRAME[1]))
     if direction=='S':im.save(SHEET_DIR/f'{name}_S_{i:02d}.png')
    print(f'generated {name} {direction}',flush=True)
   canvas.save(OUT/f'{name}_8way.png',compress_level=6)
   atlas_manifest[name]={'file':f'{name}_8way.webp','frames':8,'rows':list(DIRS),'size':list(FRAME)}
  # 8-direction idle, only one natural resting pose per row, column=0
  name=f'sophia_{weapon_pose}_idle'
  atlas=Image.new('RGBA',(FRAME[0],FRAME[1]*8),(0,0,0,0))
  for row,(direction,yaw) in enumerate(DIRS.items()):atlas.alpha_composite(model.frame(yaw,0,'idle',weapon_pose),(0,row*FRAME[1]))
  atlas.save(OUT/f'{name}_8way.png',compress_level=6)
  atlas_manifest[name]={'file':f'{name}_8way.webp','frames':1,'rows':list(DIRS),'size':list(FRAME)}
 # QA direction/contact sheet
 bg='#2b2630';q=Image.new('RGB',(8*176+80,4*224+145),bg);d=ImageDraw.Draw(q)
 d.text((16,12),'SOPHIA v3.3 • 3D TO SPRITE • CHROME 84FS',fill='#e8dcd5')
 for row,(pose,gait) in enumerate([('lowered','walk'),('lowered','run'),('aimed','idle'),('aimed','walk')]):
  d.text((8,45+row*224+15),pose+'\n'+gait,fill='#eee0e8')
  for j,(direction,yaw) in enumerate(DIRS.items()):
   frame=model.frame(yaw,.25 if gait!='idle' else 0,gait,pose)
   tile=Image.new('RGBA',FRAME,'#37303a');tile.alpha_composite(frame)
   q.paste(tile.convert('RGB'),(70+j*176,45+row*224))
   d.text((75+j*176,49+row*224),direction,fill='#f4deb6')
 q.save(OUT/'sophia_3d_animation_qa.png')
 # artifact original GLB v3.3 plus chrome prop for inspection
 model.pose(0,0,'idle','lowered')
 glb,info=source.export_glb(model.model)
 shutil.copy2(glb,OUT/'sophia_v3_3_with_chrome_84fs_unrigged.glb')
 meta={'model':'Sophia/Saafiya approved v3.3 face/corset; 3D procedural articulation v3.5',
       'base_model':'sophia_saafiya_studio_v3_3_builder.py','world_axis':'+Z up +Y front +X anatomical left',
       'camera_elevation_degrees':58,'direction_order':list(DIRS.keys()),
       'cell_px':list(FRAME),'weapon':'chrome slim-profile Cheetah-style cosmetic prop (84FS story designation; 82-like 7.65 mm single-stack proportions, nonfunctional)',
       'weapon_poses':['lowered at side','aimed outward'],
       'atlas_layout':'eight direction rows, eight chronological frame columns (idle uses one column)',
       'atlases':atlas_manifest, 'facing':'positive screen X right, positive screen Y down; S face, N back',
       'status':'unrigged GLB + code-articulated pre-rendered sprites',
       'gun_profile_reference':{'family':'Beretta Cheetah 80-series','story_model':'84FS','historical_single_stack_7_65':'Model 82','single_stack_width_reference_mm':30,'slide_axis':'straight -Z in rest prop space, +Y in aimed space','geometry':'stylized cosmetic silhouette; no operable firearm mechanism'},
       'limitations':['v3.3 GLB has no bones or deforming skin weights','arm rotation is procedural whole-piece articulation, jacket intersections may require cleanup','sprite atlases are suitable for inspection before game-scale approval']}
 (OUT/'sophia_motion_metadata.json').write_text(json.dumps(meta,indent=2))
 for item in OUT.glob('sophia_*_8way.png'):
  item_image=Image.open(item).convert('RGBA')
  item_image.save(item.with_suffix('.webp'),'WEBP',quality=91,method=1,exact=True)
 return meta


if __name__=='__main__':
 t=time.perf_counter();model=SophiaMotion();metadata=export(model)
 print('DONE {:.1f} s; {}'.format(time.perf_counter()-t,json.dumps({'atlases':len(metadata['atlases']), 'out':str(OUT)})),flush=True)