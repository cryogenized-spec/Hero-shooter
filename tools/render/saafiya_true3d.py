#!/usr/bin/env python3
"""Hero Shooter | Saafiya: deterministic 3D-to-sprite proof of concept.
All geometry created with VTK; no AI image generation / no input textures.
View the source, tweak the rig, then rerender fixed camera angles.
Run: xvfb-run -a python saafiya_true3d.py
"""
import math, os, json, zipfile
from pathlib import Path
import vtk
from PIL import Image, ImageDraw, ImageFont
from vtk.util.numpy_support import vtk_to_numpy

OUT=Path(__file__).parent
DEST=OUT/'saafiya_true3d_frames'; DEST.mkdir(exist_ok=True)
DIRECTIONS={'S':0,'SW':45,'W':90,'NW':135,'N':180,'NE':225,'E':270,'SE':315}
COLORS={
 'skin':'#b97859', 'skin_hi':'#de9870', 'skin_shadow':'#8f4b3c',
 'hair':'#381729','hair_wine':'#672a43','hair_hi':'#91405d','hair_dark':'#1d111a',
 'dress':'#261e2c','corset':'#211824','jacket':'#362a3b','jacket_hi':'#5b465b',
 'boot':'#261e29','boot_hi':'#4b3b4b','lace':'#815366',
 'metal':'#bfc6d1','metal_light':'#eef2f3','metal_dark':'#6e717e',
 'eye':'#1d1018','lip':'#21101a','glasses':'#222631',
 'shade':'#151017','fishnet':'#322532','gun':'#cfd4dc','gun_dark':'#656b79'
}

def rgb(h):return tuple(int(h[i:i+2],16)/255 for i in (1,3,5))
def color(name):return rgb(COLORS.get(name,name))

class Character:
 def __init__(self,yaw=0,phase=0.0,walk=False):
  self.root=vtk.vtkAssembly();self.yaw=yaw; self.phase=phase;self.walk=walk
  self.stride=math.sin(phase*math.tau) if walk else 0.
  self.bob=.035*(1-math.cos(phase*math.tau*2)) if walk else 0.
  self.s=math.sin(phase*math.tau) if walk else 0.
  self.build();self.root.SetOrientation(0,0,yaw)
 def attach(self,actor): self.root.AddPart(actor); return actor
 def prop(self,actor,c,opacity=1,shininess=.1,rough=False):
  p=actor.GetProperty();p.SetColor(*color(c));p.SetOpacity(opacity)
  p.SetAmbient(.36);p.SetDiffuse(.63);p.SetSpecular(shininess);p.SetSpecularPower(24)
  if rough:p.SetInterpolationToFlat();p.SetSpecular(.03)
  return actor
 def uv(self,xyz,scale,c,res=20,shininess=.08,opacity=1):
  s=vtk.vtkSphereSource();s.SetRadius(1);s.SetThetaResolution(res);s.SetPhiResolution(max(10,res-4));s.Update()
  m=vtk.vtkPolyDataMapper();m.SetInputConnection(s.GetOutputPort())
  a=vtk.vtkActor();a.SetMapper(m);a.SetPosition(*xyz);a.SetScale(*scale)
  self.attach(self.prop(a,c,opacity,shininess));return a
 def bar(self,a,b,r1,r2,c,res=14,shininess=.1):
  # true 3D tapered segment, aligned along a-b with world transforms
  import numpy as np
  p=np.array(a,dtype=float);q=np.array(b,dtype=float);d=q-p;length=float(np.linalg.norm(d))
  if length<1e-4:return
  # vtkConeSource taper means one tip; create segment as cylinder + endpoint ellipsoids
  cy=vtk.vtkCylinderSource();cy.SetRadius(r1);cy.SetHeight(length);cy.SetResolution(res);cy.CappingOn()
  m=vtk.vtkPolyDataMapper();m.SetInputConnection(cy.GetOutputPort())
  act=vtk.vtkActor();act.SetMapper(m)
  rot=vtk.vtkTransform();rot.Translate(*((p+q)/2));
  axis=np.cross([0,1,0],d/length)
  dot=float(np.dot([0,1,0],d/length))
  if np.linalg.norm(axis)>.00001:rot.RotateWXYZ(math.degrees(math.acos(max(-1,min(1,dot)))),*axis)
  elif dot<0:rot.RotateWXYZ(180,1,0,0)
  act.SetUserTransform(rot);self.attach(self.prop(act,c,shininess=shininess))
  self.uv(a,(r1,r1,r1),c,res=12,shininess=shininess)
  self.uv(b,(r2,r2,r2),c,res=12,shininess=shininess)
  return act
 def line(self,points,r,c):
  ps=vtk.vtkPoints();ln=vtk.vtkCellArray()
  for i,p in enumerate(points):ps.InsertNextPoint(*p)
  poly=vtk.vtkPolyData();poly.SetPoints(ps)
  for i in range(len(points)-1):
   l=vtk.vtkLine();l.GetPointIds().SetId(0,i);l.GetPointIds().SetId(1,i+1);ln.InsertNextCell(l)
  poly.SetLines(ln)
  tube=vtk.vtkTubeFilter();tube.SetInputData(poly);tube.SetRadius(r);tube.SetNumberOfSides(6);tube.CappingOn()
  mapper=vtk.vtkPolyDataMapper();mapper.SetInputConnection(tube.GetOutputPort())
  a=vtk.vtkActor();a.SetMapper(mapper);self.attach(self.prop(a,c));return a
 def torus(self,xyz,major,minor,c,rot=(90,0,0)):
  t=vtk.vtkParametricTorus();t.SetRingRadius(major);t.SetCrossSectionRadius(minor)
  src=vtk.vtkParametricFunctionSource();src.SetParametricFunction(t);src.SetUResolution(32);src.SetVResolution(8)
  m=vtk.vtkPolyDataMapper();m.SetInputConnection(src.GetOutputPort());a=vtk.vtkActor();a.SetMapper(m)
  a.SetPosition(*xyz);a.SetOrientation(*rot);self.attach(self.prop(a,c,shininess=.6));return a
 def box(self,pos,size,c,rotation=0,shininess=.15):
  s=vtk.vtkCubeSource();s.SetXLength(size[0]);s.SetYLength(size[1]);s.SetZLength(size[2])
  m=vtk.vtkPolyDataMapper();m.SetInputConnection(s.GetOutputPort());a=vtk.vtkActor();a.SetMapper(m)
  a.SetPosition(*pos);a.RotateZ(rotation);self.attach(self.prop(a,c,shininess=shininess));return a
 def cone(self,pos,radius,height,c,res=20):
  s=vtk.vtkConeSource();s.SetHeight(height);s.SetRadius(radius);s.SetResolution(res);s.SetDirection(0,0,-1)
  m=vtk.vtkPolyDataMapper();m.SetInputConnection(s.GetOutputPort());a=vtk.vtkActor();a.SetMapper(m);a.SetPosition(*pos);self.attach(self.prop(a,c));return a
 def build(self):
  b=self.bob;st=self.stride
  # legs and shoes: real cylinders and spheroids with front/back depth
  for side in [-1,1]:
   x=side*.17;walk_y=st*.23 * (1 if side==-1 else -1)
   lift=max(0,st*(1 if side==-1 else -1))*.12
   hip=(x,0,.85+b);knee=(x+side*.025,walk_y*.44,.49+b+lift*.25)
   shin=(x+side*.03,walk_y,.18+lift); toe=(x+side*.04,walk_y+.13,.115+lift)
   self.bar(hip,knee,.135,.12,'skin',res=16)
   # lace/fishnet crossed bands on thigh facing +Y
   for i in range(3):
    z=.73-i*.08+b; yy=.14+walk_y*.20
    self.line([(x-.12,yy,z),(x+.12,yy,z-.08)],.006,'fishnet')
    self.line([(x-.12,yy,z-.08),(x+.12,yy,z)],.006,'fishnet')
   self.bar(knee,shin,.145,.13,'boot',res=16)
   self.uv((toe[0],toe[1],toe[2]),(.14,.235,.105),'boot',res=18)
   for j in range(3):
    zz=.22+j*.075+lift
    self.box((x,walk_y+.145,zz),(.24,.035,.026),'metal_dark')
    self.box((x+.02,walk_y+.165,zz),(.06,.013,.013),'metal_light',shininess=.65)
  # hips and voluminous layered skirt
  self.uv((0,0,.84+b),(.31,.23,.23),'skirt' if 'skirt' in COLORS else 'dress')
  self.cone((0,0,.83+b),.40,.28,'dress',res=20)
  for side in (-1,1):
   self.uv((side*.22,.06,.76+b),(.15,.19,.15),'dress',res=14)
  # torso rounded NOT cardboard
  self.uv((0,-.03,1.30+b),(.285,.205,.48),'jacket',res=20)
  self.uv((0,.15,1.23+b),(.25,.12,.37),'corset',res=18)
  self.uv((0,.22,1.50+b),(.31,.13,.18),'corset',res=18)
  for side in (-1,1):
   self.uv((side*.13,.225,1.43+b),(.125,.12,.155),'corset',res=16)
  # jacket folded lapels, tight waist belt, lacing
  for side in (-1,1):
   self.bar((side*.20,.18,1.55+b),(side*.15,.23,1.18+b),.032,.025,'jacket_hi')
  for z in (1.04,1.19,1.34):
   self.box((0,.281,z+b),(.45,.048,.047),'jacket')
   self.box((0,.315,z+b),(.082,.018,.059),'metal',shininess=.75)
   self.box((0,.33,z+b),(.032,.011,.034),'shade')
  # chain swoop across hip with real links
  self.line([(-.28,.23,1.0+b),(-.26,.28,.79+b),(-.02,.28,.73+b),(.24,.20,.92+b)],.010,'metal')
  for side in [-1,1]:
   x=side*.32;swing=st*(-1 if side==1 else 1)*.115
   shoulder=(x,-.015,1.52+b)
   elbow=(x+side*.04,swing,.99+b)
   hand=(x+side*.06,swing*1.7+.025,.75+b)
   self.bar(shoulder,elbow,.155,.13,'jacket',res=16)
   self.bar(elbow,hand,.125,.115,'jacket',res=16)
   self.uv((hand[0],hand[1]+.01,hand[2]),(.10,.09,.115),'skin',res=14)
   self.box((x+side*.05,swing*.9+.115,.86+b),(.07,.04,.05),'jacket_hi')
   if side == -1:
    # inherited chromed compact pistol held down at rest (prop model only)
    gx=hand[0]-.03; gy=hand[1]+.115
    self.box((gx,gy,.665+b),(.092,.085,.245),'gun',shininess=.7)
    self.box((gx-.010,gy,.59+b),(.085,.10,.11),'gun_dark')
    self.box((gx+.075,gy,.69+b),(.105,.08,.078),'gun',shininess=.8)
    self.box((gx-.028,gy+.053,.72+b),(.032,.021,.11),'metal_light',shininess=.8)
  # neck / choker and central ring
  self.bar((0,0,1.57+b),(0,0,1.72+b),.13,.13,'skin')
  self.uv((0,0,1.60+b),(.16,.15,.063),'corset')
  self.torus((0,.174,1.565+b),.06,.015,'metal')
  self.line([(0,.17,1.545+b),(0,.24,1.40+b)],.012,'metal')
  # face shaped with actual height, forehead, jaw, cheeks
  self.uv((0,.01,1.95+b),(.30,.275,.38),'skin',res=28)
  self.uv((0,.12,1.80+b),(.22,.25,.18),'skin',res=24)
  for side in (-1,1):
   self.uv((side*.30,-.018,1.95+b),(.053,.062,.084),'skin',res=14)
   self.torus((side*.335,-.023,1.86+b),.062,.012,'metal',rot=(0,90,0))
  # face details on forward +Y
  for side in (-1,1):
   x=side*.118
   self.uv((x,.282,1.97+b),(.073,.021,.036),'eye',res=16)
   self.uv((x,.301,1.97+b),(.022,.012,.028),'metal_light',res=12)
   self.line([(x-.072,.288,2.055+b),(x+.065,.288,2.062+b)],.019,'hair_dark')
  self.uv((0,.293,1.845+b),(.038,.055,.055),'skin_hi',res=12)
  self.uv((0,.317,1.795+b),(.105,.020,.038),'lip',res=14)
  self.uv((.115,.30,1.83+b),(.011,.009,.012),'lip',res=10)
  # burgundy dark hair scalp and thick voluminous bunches; curl clusters, real 3D shapes
  self.uv((0,-.105,2.16+b),(.36,.29,.285),'hair',res=24)
  self.uv((0,-.24,1.99+b),(.33,.19,.28),'hair_dark',res=20)
  for i in range(12):
   a=i*math.tau/12
   x=.25*math.cos(a);y=.22*math.sin(a)-.11
   z=2.16+b+.10*math.sin(i*2.5)
   self.uv((x,y,z),(.095,.115,.16),'hair_wine' if i%3 else 'hair_dark',res=12)
  self.uv((0,-.17,2.44+b),(.245,.24,.215),'hair',res=20)
  for i in range(15):
   a=i*2.399
   xx=.19*math.cos(a);yy=-.17+.18*math.sin(a);zz=2.45+b+.115*math.sin(2*a)
   self.uv((xx,yy,zz),(.078,.077,.10), 'hair_hi' if i%6==0 else 'hair_wine',res=12)
  for side in (-1,1):
   x=side*.28
   self.line([(x,.02,2.18+b),(x+.025,.13,2.02+b),(x-.01,.23,1.84+b)],.027,'hair_wine')
  # sunglasses on top of head
  for side in (-1,1):
   x=side*.153
   self.uv((x,.12,2.34+b),(.13,.045,.07),'glasses',res=16)
   self.torus((x,.175,2.35+b),.075,.010,'metal_light',rot=(90,0,0))
  self.line([(-.03,.17,2.35+b),(.03,.17,2.35+b)],.013,'metal_light')
  # hair accessory cross left
  self.line([(-.31,.19,2.17+b),(-.31,.19,2.30+b)],.015,'metal_light')
  self.line([(-.36,.19,2.25+b),(-.26,.19,2.25+b)],.014,'metal_light')


def snapshot(yaw,phase=0,walk=False,pitch=58,size=(288,360)):
 r=vtk.vtkRenderer();r.SetBackground(0,0,0);r.SetBackgroundAlpha(0.0)
 win=vtk.vtkRenderWindow();win.SetOffScreenRendering(1);win.SetAlphaBitPlanes(1);win.SetMultiSamples(4);win.SetSize(*size);win.AddRenderer(r)
 ch=Character(yaw,phase,walk);r.AddActor(ch.root)
 camera=vtk.vtkCamera()
 elev=math.radians(pitch)
 camera.SetPosition(0,8*math.cos(elev),1.30+8*math.sin(elev))
 camera.SetFocalPoint(0,0,1.29)
 camera.SetViewUp(0,0,1)
 camera.ParallelProjectionOn();camera.SetParallelScale(1.53)
 r.SetActiveCamera(camera)
 # Ambient + dedicated fill/rim lights; constant for all directions
 l=vtk.vtkLight();l.SetPosition(-3,5,9);l.SetFocalPoint(0,0,1.3);l.SetIntensity(1.08);r.AddLight(l)
 l2=vtk.vtkLight();l2.SetPosition(5,-5,8);l2.SetIntensity(.54);r.AddLight(l2)
 win.Render()
 wi=vtk.vtkWindowToImageFilter();wi.SetInput(win);wi.SetInputBufferTypeToRGBA();wi.ReadFrontBufferOff();wi.Update()
 x,y=size;data=vtk_to_numpy(wi.GetOutput().GetPointData().GetScalars()).reshape((y,x,4))
 result=Image.fromarray(data[::-1].copy(),'RGBA')
 # VTK's offscreen RGBA often preserves black opaque background on X; detect only if zero alpha is unavailable.
 # VTK camera looking north from screen south has image-X reversed against game screen X.
 # Flip the final render once so West is left and East is right, consistently.
 return result.transpose(Image.Transpose.FLIP_LEFT_RIGHT)

def contact(images,labels,cols=4,bg='#191820',tile=(220,270)):
 rows=math.ceil(len(images)/cols);tw,th=tile
 canvas=Image.new('RGBA',(tw*cols,rows*(th+28)+48),bg)
 d=ImageDraw.Draw(canvas)
 d.text((17,14),'SAAFIYA  |  CODE-ONLY 3D CHARACTER / FIXED CAMERA',fill='#efdbde')
 for i,(im,label) in enumerate(zip(images,labels)):
  x=(i%cols)*tw;y=(i//cols)*(th+28)+40
  p=im.copy();p.thumbnail((tw-12,th-5),Image.Resampling.LANCZOS)
  canvas.alpha_composite(p,(x+(tw-p.width)//2,y))
  d.text((x+12,y+th+3),label,fill='#e9c0ce')
 return canvas.convert('RGB')

def main():
 print('Building fixed-camera 3D geometry, preparing eight directions')
 ims=[]
 for d,yaw in DIRECTIONS.items():
  im=snapshot(yaw);im.save(DEST/f'{d.lower()}_idle.png');ims.append(im)
 print('Frame alpha sample',ims[0].getpixel((0,0)))
 cp=contact(ims,list(DIRECTIONS.keys()))
 cp.save(OUT/'saafiya_true3d_8directions.png')
 # Quick fixed-camera turntable GIF: the geometry truly rotates in 3D, not a planar flip.
 spin=[]
 for im in ims:
  b=Image.new('RGBA',im.size,'#24212b');b.alpha_composite(im)
  spin.append(b.convert('RGB').resize((216,270),Image.Resampling.LANCZOS))
 spin[0].save(OUT/'saafiya_true3d_turntable.gif',save_all=True,append_images=spin[1:],duration=200,loop=0,disposal=2,optimize=False)
 print('Producing south 8-frame walk')
 walk=[]
 for i in range(8):
  im=snapshot(0,i/8,walk=True);im.save(DEST/f's_walk_{i:02d}.png');walk.append(im)
 # Rendered previews to reduce aliasing in png atlases
 contact(walk,[f'Walk / {i+1}' for i in range(8)]).save(OUT/'saafiya_true3d_walk_contact.png')
 # GIF: remove alpha with dark background for GIF preview; transparent PNGs remain source of truth.
 prev=[]
 for im in walk:
  b=Image.new('RGBA',im.size,'#24212b');b.alpha_composite(im)
  prev.append(b.convert('RGB').resize((216,270),Image.Resampling.LANCZOS))
 prev[0].save(OUT/'saafiya_true3d_south_walk.gif',save_all=True,append_images=prev[1:],duration=115,loop=0,disposal=2,optimize=False)
 # A direct comparison of two camera elevations for same 3D model
 comp=contact([snapshot(0,pitch=48),snapshot(90,pitch=48),snapshot(0,pitch=65),snapshot(90,pitch=65)], ['South / 48°','West / 48°','South / 65°','West / 65°'],cols=2)
 comp.save(OUT/'saafiya_true3d_camera_comparison.png')
 # metadata
 metadata={'method':'VTK 9 code-built 3D geometry; no generated art','facing_order':list(DIRECTIONS.keys()),'camera_elevation_degrees':58,'walk_fps_approx':8.7,'walk_frames':8,'frame_rgba_size':[288,360], 'caveat':'Technical visual prototype, not a production-quality anime model'}
 (OUT/'saafiya_true3d_metadata.json').write_text(json.dumps(metadata,indent=2))
 with zipfile.ZipFile(OUT/'saafiya_true3d_prototype.zip','w',zipfile.ZIP_DEFLATED) as z:
  for f in [Path(__file__), OUT/'saafiya_true3d_metadata.json', OUT/'saafiya_true3d_8directions.png',OUT/'saafiya_true3d_walk_contact.png', OUT/'saafiya_true3d_south_walk.gif',OUT/'saafiya_true3d_camera_comparison.png',OUT/'saafiya_true3d_turntable.gif',*DEST.glob('*.png')]:z.write(f,f.relative_to(OUT))
 print('Done')
if __name__=='__main__':main()