#!/usr/bin/env python3
"""Hero Shooter | three unarmed adult male looter NPCs, aged 23/27/35.
Procedural VTK geometry, 2-bone inverse-kinematic human walk, GLB neutral export,
8-direction x 12-row sprite atlas. This uses the canonical Hero Shooter sprite
contract: S SW W NW N NE E SE; rows idle(0:3), walk(4:7), run(8:11).

VTK world: +Z is up, model neutral front looks toward -Y. The hero game's
screen +X is right, screen +Y down, angles clockwise from East, atlas South FRONT.
Unarmed meshes are NOT skinned/rigged GLBs: motion is generated in Python VTK.
Run: xvfb-run -a python generate_looters.py
Dependencies: VTK, numpy, trimesh, pillow.
"""
from __future__ import annotations
import math, json, zipfile, time, sys
from pathlib import Path
from collections import defaultdict
import numpy as np
from PIL import Image, ImageDraw, ImageFont
import vtk, trimesh
from vtk.util.numpy_support import vtk_to_numpy

ROOT=Path(__file__).resolve().parent
DIR=[('South',0,90,'front'),('Southwest',-45,135,'front quarter left'),('West',-90,180,'left profile'),('Northwest',-135,225,'rear quarter left'),('North',180,270,'back'),('Northeast',135,315,'rear quarter right'),('East',90,0,'right profile'),('Southeast',45,45,'front quarter right')]
CONFIGS=[
 dict(id='looter_23',age=23,height=1.75,build='lean',stride=.52,cadence=112,
      desc='Lean young adult in a faded rust hoodie, midnight-blue sleeveless quilted vest, dark joggers and worn canvas trainers. Short textured curls, crossbody sling bag and casual silver chain. Energetic quick-stepping walk.',
      skin='#704732',skinShade='#4C3024',skinHi='#986548',hair='#161A20',hairLight='#29262B',beard='#392B26',
      jacket='#2F4359',jacketHi='#4D6276',jacketDark='#1C2937',shirt='#A14D3F',shirtHi='#BD6B54',
      pants='#393A3D',pantsHi='#55565B',pantsDark='#282930',shoe='#D4CEC0',shoeDark='#45444A',sole='#F0E9DB',
      bag='#4B4543',strap='#6E615B',accent='#B78662',metal='#BBC4C4'),
 dict(id='looter_27',age=27,height=1.81,build='average',stride=.60,cadence=105,
      desc='Medium build, practical olive canvas utility jacket with rolled cuffs, faded burgundy tee, tan cargo trousers and dark work boots. Short buzz fade, a little stubble, backwards cap and compact canvas daypack. Purposeful measured stride.',
      skin='#623F2D',skinShade='#41281E',skinHi='#90634B',hair='#171719',hairLight='#303033',beard='#2D2622',
      jacket='#5F6953',jacketHi='#899078',jacketDark='#404C3A',shirt='#65383B',shirtHi='#8D5355',
      pants='#8A7960',pantsHi='#AB9779',pantsDark='#5B5344',shoe='#342D29',shoeDark='#1A1B1B',sole='#6B6354',
      bag='#4A4740',strap='#75705D',accent='#C4B89A',metal='#8F989D'),
 dict(id='looter_35',age=35,height=1.84,build='stocky',stride=.57,cadence=92,
      desc='Broad-shouldered man in worn charcoal denim jacket, checked shirt, faded blue jeans, thick-soled brown boots and a shoulder satchel. Close-cropped hair, defined jaw and short trimmed beard. Steady heavy-footed walking style.',
      skin='#76503A',skinShade='#523326',skinHi='#A47658',hair='#26201F',hairLight='#3D3330',beard='#322826',
      jacket='#404750',jacketHi='#63717D',jacketDark='#262D36',shirt='#875B54',shirtHi='#C28E70',
      pants='#4B627B',pantsHi='#6D8093',pantsDark='#344251',shoe='#6D4B36',shoeDark='#3D3025',sole='#37332D',
      bag='#615045',strap='#7D6C59',accent='#C9A982',metal='#B1A89A')
]
COMMON={'white':'#E7DFD4','dark':'#191C21','stitch':'#B3A899','iris':'#241D1A','mouth':'#6B3838','zip':'#C1B8A9','lace':'#A3A19A','nail':'#D6A88D'}

def rgb(hexstr):
 s=hexstr.lstrip('#');return tuple(int(s[i:i+2],16)/255 for i in (0,2,4))

def mathex(c,key):return c.get(key,COMMON.get(key,key if key.startswith('#') else '#777777'))

def mesh(v,f):
 pts=vtk.vtkPoints();tris=vtk.vtkCellArray()
 for p in v:pts.InsertNextPoint(*[float(q) for q in p])
 for face in f:
  t=vtk.vtkTriangle()
  for n,ind in enumerate(face):t.GetPointIds().SetId(n,int(ind))
  tris.InsertNextCell(t)
 pd=vtk.vtkPolyData();pd.SetPoints(pts);pd.SetPolys(tris)
 norm=vtk.vtkPolyDataNormals();norm.SetInputData(pd);norm.ConsistencyOn();norm.SplittingOff();norm.Update()
 return norm.GetOutput()

def gauss(x,mu,s):return math.exp(-.5*((x-mu)/s)**2)

def smooth_curve(points,samples=5):
 arr=np.asarray(points,dtype=float);out=[]
 for i in range(len(arr)-1):
  a=arr[max(i-1,0)];b=arr[i];c=arr[i+1];d=arr[min(i+2,len(arr)-1)]
  for u in np.linspace(0,1,samples,endpoint=False):
   out.append(.5*((2*b)+(-a+c)*u+(2*a-5*b+4*c-d)*u*u+(-a+3*b-3*c+d)*u*u*u))
 out.append(arr[-1]);return np.asarray(out)

class Person:
 def __init__(self,c):
  self.c=c;self.h=float(c['height']);self.s=self.h/1.8;self.root=vtk.vtkAssembly()
  self.groups={'body':self.root};self.parent={'body':None};self.parts=[]
  self.hip_z=.98*self.s;self.thigh=.435*self.s;self.shin=.43*self.s
  self.ankle_rest=self.hip_z-self.thigh-self.shin
  self.shoulder_z=1.405*self.s
  # parent tree makes exact scene transforms available to GLB export.
  for side in ['l','r']:
   s=-1 if side=='l' else 1
   self.group('thigh_'+side,'body',(s*.098*self.s,0,self.hip_z))
   self.group('shin_'+side,'thigh_'+side,(0,0,-self.thigh))
   self.group('foot_'+side,'shin_'+side,(0,0,-self.shin))
   self.group('arm_'+side,'body',(s*(.244 if c['build']=='stocky' else .219)*self.s,0,self.shoulder_z))
  self.build()
  self.pose()
 def group(self,name,parent,pos):
  a=vtk.vtkAssembly();a.SetPosition(*pos);self.groups[parent].AddPart(a)
  self.groups[name]=a;self.parent[name]=parent
 def add(self,source,name,color,group='body',spec=.10):
  mapper=vtk.vtkPolyDataMapper()
  if isinstance(source,vtk.vtkPolyData):mapper.SetInputData(source)
  else:mapper.SetInputConnection(source.GetOutputPort())
  a=vtk.vtkActor();a.SetMapper(mapper)
  prop=a.GetProperty();prop.SetColor(*rgb(mathex(self.c,color)));prop.SetAmbient(.37);prop.SetDiffuse(.65);prop.SetSpecular(spec);prop.SetSpecularPower(24)
  self.groups[group].AddPart(a);self.parts.append((a,name,color,group));return a
 def ell(self,p,r,col,name,group='body',res=22):
  sph=vtk.vtkSphereSource();sph.SetThetaResolution(res);sph.SetPhiResolution(max(12,res-8));sph.SetRadius(1)
  a=self.add(sph,name,col,group);a.SetPosition(*p);a.SetScale(*r);return a
 def box(self,p,size,col,name,group='body',angle=0):
  src=vtk.vtkCubeSource();a=self.add(src,name,col,group);a.SetPosition(*p);a.SetScale(*size)
  if angle:a.RotateZ(angle)
  return a
 def cylinder(self,p,q,r,col,name,group='body',res=15):
  p,q=np.array(p,dtype=float),np.array(q,dtype=float)
  d=q-p;length=float(np.linalg.norm(d));src=vtk.vtkCylinderSource();src.SetHeight(length);src.SetRadius(r);src.SetResolution(res);src.CappingOn()
  a=self.add(src,name,col,group)
  tr=vtk.vtkTransform();tr.Translate(*((p+q)/2));v=d/length;axis=np.cross([0,1,0],v);dot=np.clip(np.dot([0,1,0],v),-1,1)
  if np.linalg.norm(axis)>1e-5:tr.RotateWXYZ(math.degrees(math.acos(dot)),*axis)
  elif dot<0:tr.RotateWXYZ(180,1,0,0)
  a.SetUserTransform(tr);return a
 def line(self,positions,r,col,name,group='body',sides=7):
  pts=smooth_curve(positions,3);v=vtk.vtkPoints();lines=vtk.vtkCellArray()
  for p in pts:v.InsertNextPoint(*p)
  for i in range(len(pts)-1):
   cell=vtk.vtkLine();cell.GetPointIds().SetId(0,i);cell.GetPointIds().SetId(1,i+1);lines.InsertNextCell(cell)
  pd=vtk.vtkPolyData();pd.SetPoints(v);pd.SetLines(lines)
  tube=vtk.vtkTubeFilter();tube.SetInputData(pd);tube.SetRadius(r);tube.SetNumberOfSides(sides);tube.CappingOn()
  return self.add(tube,name,col,group)
 def loft(self,rings,col,name,group='body',sides=40):
  vertices=[];faces=[]
  for i,(z,rx,ry,yc) in enumerate(rings):
   for j in range(sides):
    t=j*math.tau/sides;vertices.append((rx*math.cos(t),yc+ry*math.sin(t),z))
    if i:
     a=(i-1)*sides+j;b=(i-1)*sides+(j+1)%sides;d=i*sides+j;e=i*sides+(j+1)%sides
     faces.extend(((a,d,b),(b,d,e)))
  faces.extend((0,j+1,j) for j in range(1,sides-1))
  shift=(len(rings)-1)*sides;faces.extend((shift,shift+j,shift+j+1) for j in range(1,sides-1))
  return self.add(mesh(vertices,faces),name,col,group)
 def ribbon(self,points,halfwidth,col,name,group='body'):
  curve=smooth_curve(points,4);verts=[];faces=[]
  for i,p in enumerate(curve):
   delta=curve[min(i+1,len(curve)-1)]-curve[max(0,i-1)]
   lateral=np.cross(delta,[0,1,0]);lateral=lateral/(np.linalg.norm(lateral)+1e-7)
   verts.extend([p+lateral*halfwidth,p-lateral*halfwidth])
   if i>0:
    j=i*2;faces.extend(((j-2,j-1,j),(j-1,j+1,j),(j,j-1,j-2),(j,j+1,j-1)))
  return self.add(mesh(verts,faces),name,col,group)
 def face(self):
  S=self.s;C=self.c;type_=C['build']
  rx=(.140 if type_=='stocky' else .129 if type_=='average' else .124)*S
  ry=(.114 if type_!='stocky' else .120)*S
  rz=(.177 if type_!='stocky' else .173)*S
  zc=1.647*S
  V=[];F=[];n=88;h=56
  for j in range(h+1):
   theta=math.pi*(j+0.0001)/(h+0.0002)
   for k in range(n):
    phi=math.tau*k/n
    x=rx*math.sin(theta)*math.cos(phi)
    y=ry*math.sin(theta)*math.sin(phi)
    z=rz*math.cos(theta)
    if y<-.018*S:
     # integrated bridge, nasal tip, alar wings, cheekbones, brows, chin
     y-=S*(.011*gauss(x,0,.034*S)*gauss(z,.022*S,.057*S)
         +.025*gauss(x,0,.025*S)*gauss(z,-.045*S,.027*S)
         +.008*(gauss(x,.029*S,.015*S)+gauss(x,-.029*S,.015*S))*gauss(z,-.063*S,.021*S)
         +.006*(gauss(x,.064*S,.022*S)+gauss(x,-.064*S,.022*S))*gauss(z,-.040*S,.058*S)
         +.004*(gauss(x,.064*S,.018*S)+gauss(x,-.064*S,.018*S))*gauss(z,.060*S,.022*S))
    if type_=='lean':x*=1-.24*gauss(z,-.133*S,.053*S)
    if type_=='stocky':x*=1-.12*gauss(z,-.130*S,.062*S)
    V.append((x,y,z+zc))
    if j:
     a=(j-1)*n+k;b=(j-1)*n+(k+1)%n;d=j*n+k;e=j*n+(k+1)%n;F.extend(((a,d,b),(b,d,e)))
  self.add(mesh(V,F),'continuous_integrated_anatomical_face','skin')
  # Inlaid eyes, upper/lower lids and individual eyebrow hair, following face surface.
  for sg in [-1,1]:
   x=sg*.052*S;z=zc+.026*S
   eye_y=-(.108 if type_=='stocky' else .111)*S
   self.ell((x,eye_y-.003*S,z),(.033*S,.008*S,.013*S),'white','almond_eye_white')
   self.ell((x+sg*.001*S,eye_y-.010*S,z),(.011*S,.006*S,.011*S),'iris','dark_brown_iris',res=18)
   self.ell((x+.002*S,eye_y-.015*S,z+.003*S),(.003*S,.002*S,.003*S),'white','iris_catchlight',res=12)
   for dz,amt in [( .0115, .0031),(-.0105,.0018)]:
    pts=[(x+t*.030*S,eye_y-.005*S,z+dz*S*(1-(t*t*.75))) for t in np.linspace(-1,1,5)]
    self.line(pts,amt*S,'hair','upper_or_lower_eyelid')
   brow=[(x+t*.038*S,eye_y+.003*S,z+(.039+(.004 if type_=='stocky' else 0)-.009*abs(t))*S) for t in np.linspace(-1,1,5)]
   self.line(brow,.0045*S,'hair','eyebrow')
   self.ell((sg*(rx+.009*S),.0,zc-.010*S),(.021*S,.032*S,.043*S),'skin','ear_cartilage')
   self.ell((sg*(rx+.026*S),-.015*S,zc-.018*S),(.007*S,.015*S,.022*S),'skinShade','ear_shadow')
  self.line([(-.033*S,-.120*S,zc-.111*S),(-.015*S,-.126*S,zc-.115*S),(0,-.130*S,zc-.116*S),(.016*S,-.125*S,zc-.114*S),(.033*S,-.121*S,zc-.112*S)],
            .0025*S,'mouth','closed_mouth_soft_lip_line')
  self.ell((0,-.130*S,zc-.120*S),(.031*S,.005*S,.006*S),'skinShade','lower_lip_soft_volume')
  # Fitted sculpted hair cap sitting inside the skull silhouette, subtly uneven hairline
  for t in np.linspace(-1,1,18):
   x=t*rx*.89;z=zc+rz*(.73-.10*abs(t))
   self.ell((x,-.039*S,z),(.030*S,.047*S,.043*S),'hair','short_hair_clumps',res=12)
  self.ell((0,.065*S,zc+.106*S),(.118*S,.076*S,.090*S),'hair','rear_hairstyle_volume')
  if type_=='lean':
   # Short tightly curled textured crop, sparse highlights not stereotyped caricature.
   for i in range(18):
    angle=i*2.39;rad=.105*math.sqrt((i+.3)/19);x=rad*math.cos(angle)*S;y=rad*math.sin(angle)*S-.016*S
    z=zc+.149*S+.021*S*(1-rad/.12)
    self.ell((x,y,z),(.020*S,.018*S,.014*S),'hairLight' if i%4==0 else 'hair','textured_hair_curl',res=10)
  elif type_=='average':
   self.ell((0,-.04*S,zc+.157*S),(.112*S,.092*S,.027*S),'hair','buzz_fade_hair_top')
   # Backward baseball cap, brim points behind the head (+Y).
   self.ell((0,-.001*S,zc+.155*S),(.130*S,.113*S,.051*S),'jacketDark','worn_baseball_cap_crown',res=25)
   self.ell((0,.121*S,zc+.165*S),(.075*S,.070*S,.013*S),'jacket','backwards_cap_curved_brim',res=18)
   self.line([(-.093*S,-.067*S,zc+.160*S),(0,-.111*S,zc+.156*S),(.096*S,-.068*S,zc+.159*S)],.003*S,'stitch','cap_topstitch')
  else:
   # mature close crop and hairline
   self.ell((0,.021*S,zc+.132*S),(.127*S,.085*S,.048*S),'hair','closely_cropped_hair')
   for i in range(12):
    t=i*math.tau/12
    self.ell((.104*S*math.cos(t),.039*S+.065*S*math.sin(t),zc+.142*S),(.012*S,.014*S,.008*S),'hairLight','hair_texture',res=10)
  if type_!='lean':
   # Short, integrated facial hair and moustache along jawline.
   for side in (-1,1):
    for j in range(12):
     t=j/11;x=side*(.020+.073*t)*S;z=zc+(-.117+.018*t)*S
     y=(-.125+.033*t)*S
     self.ell((x,y,z),(.012*S,.004*S,.014*S),'beard','beard_close_to_jaw',res=12)
   for sg in [-1,1]:
    for j in range(5):
     x=sg*(.010+j*.008)*S
     self.ell((x,-.124*S,zc-.096*S),(.006*S,.003*S,.005*S),'beard','short_moustache',res=10)
   if type_=='stocky':
    for k in range(11):
     x=(k-5)*.014*S
     self.ell((x,-.096*S,zc-.145*S),(.010*S,.006*S,.012*S),'beard','trimmed_chin_beard',res=12)
 def build(self):
  C=self.c;S=self.s;typ=C['build']
  torsoW={'lean':.205,'average':.232,'stocky':.263}[typ]*S
  # Limb groups: each foot is relative to shin, shin relative to thigh; true pivots.
  for side in ['l','r']:
   q=-1 if side=='l' else 1;up='thigh_'+side;low='shin_'+side;foot='foot_'+side
   L=self.thigh;K=self.shin
   self.cylinder((0,0,-.020*S),(q*.008*S,-.005*S,-L+.012*S),(.073 if typ=='lean' else .087 if typ=='stocky' else .081)*S,'pants','fabric_thigh',up,22)
   self.ell((q*.007*S,-.010*S,-.190*S),(.074*S,.074*S,.180*S),'pantsHi','trouser_thigh_shape',up,res=20)
   self.ell((q*.008*S,-.004*S,-L+.014*S),(.074*S,.072*S,.085*S),'pantsDark','knee_seam_and_wrinkle',up)
   self.cylinder((0,0,0),(q*.002*S,.003*S,-K+.012*S),(.065 if typ=='lean' else .075)*S,'pants','fabric_shin',low,22)
   for z in (-.065*S,-.305*S):
    self.line([(-.057*S,-.049*S,z),(-.025*S,-.071*S,z-.005*S),(.041*S,-.063*S,z+.006*S)],.0027*S,'pantsDark','trouser_folds',low)
   self.ell((0,0,-K+.027*S),(.069*S,.068*S,.067*S),'pantsDark','trouser_ankle_cuff',low)
   if typ=='average':
    self.box((q*.021*S,-.058*S,-.215*S),(.082*S,.037*S,.142*S),'pantsHi','cargo_pocket',low)
    self.box((q*.022*S,-.078*S,-.159*S),(.082*S,.012*S,.024*S),'pantsDark','cargo_flap',low)
    self.box((q*.018*S,-.086*S,-.167*S),(.016*S,.009*S,.013*S),'accent','cargo_snap',low)
   elif typ=='stocky':
    for z in [-.19*S,-.29*S]:
     self.line([(-.06*S,-.058*S,z),(.0*S,-.078*S,z+.01*S),(.057*S,-.054*S,z)],.002*S,'pantsHi','denim_fade_seam',low)
   else:
    self.line([(-.057*S,-.044*S,-.28*S),(-.027*S,-.069*S,-.28*S),(.052*S,-.045*S,-.28*S)],.002*S,'stitch','jogger_knee_patch',low)
   # Solid shoes with actual heel/toe volume; sole top rests near floor.
   self.ell((0,-.036*S,-.045*S),(.086*S,.155*S,.055*S),'shoe','full_foot_3d',foot,25)
   self.ell((0,-.044*S,-.086*S),(.094*S,.156*S,.025*S),'sole','heel_toe_sole',foot,23)
   self.ell((0,-.142*S,-.056*S),(.079*S,.056*S,.037*S),'shoeDark','scuffed_toecap',foot,19)
   self.line([(-.045*S,-.112*S,-.001*S),(0,-.12*S,.004*S),(.042*S,-.11*S,-.001*S)],.005*S,'lace','tied_laces',foot)
   for k in range(3):
    self.line([(-.048*S,-(.060+.020*k)*S,-.007*S),(.050*S,-(.059+.020*k)*S,-.007*S)],.0026*S,'lace','shoe_laces',foot)
   self.box((0,.046*S,-.065*S),(.135*S,.054*S,.055*S),'shoeDark','structured_heel',foot)
  # Torso, shirt, jacket, soft clavicle and waist geometry
  lower_z=.88*S;upper_z=1.44*S
  rings=[(.88*S,.164*S,.108*S,.008*S),(.98*S,.176*S,.120*S,.004*S),(1.12*S,torsoW*.90,.131*S,-.004*S),
         (1.29*S,torsoW,.134*S,-.007*S),(1.415*S,torsoW*.91,.108*S,-.005*S),(1.455*S,.128*S,.083*S,0)]
  self.loft(rings,'jacket','tailored_jacket_outer',sides=48)
  self.loft([(.99*S,.130*S,.088*S,-.037*S),(1.13*S,.149*S,.091*S,-.038*S),(1.305*S,.145*S,.099*S,-.040*S),(1.435*S,.100*S,.078*S,-.027*S)],'shirt','inner_shirt_visible_chest',sides=32)
  # jacket panels, zip, ribbing and collars
  self.ribbon([(-.073*S,-.123*S,1.395*S),(-.043*S,-.151*S,1.313*S),(-.020*S,-.147*S,1.115*S),(-.030*S,-.132*S,.955*S)],.017*S,'jacketHi','left_jacket_edge')
  self.ribbon([(.074*S,-.123*S,1.396*S),(.041*S,-.151*S,1.310*S),(.020*S,-.147*S,1.114*S),(.030*S,-.132*S,.955*S)],.017*S,'jacketDark','right_jacket_edge')
  self.line([(0,-.147*S,.98*S),(0,-.150*S,1.27*S),(0,-.145*S,1.33*S)],.0032*S,'zip','center_front_zipper')
  self.ell((0,-.149*S,1.25*S),(.010*S,.006*S,.022*S),'metal','zipper_pull')
  self.ribbon([(-.147*S,-.090*S,1.40*S),(-.081*S,-.158*S,1.365*S),(-.042*S,-.141*S,1.315*S)],.028*S,'jacketDark','left_lapel_fold')
  self.ribbon([(.147*S,-.090*S,1.40*S),(.081*S,-.158*S,1.365*S),(.042*S,-.141*S,1.315*S)],.028*S,'jacketHi','right_lapel_fold')
  # Shirt collar around neck and visible neck skin
  self.cylinder((0,0,1.425*S),(0,-.003*S,1.530*S),.067*S,'skin','neck',res=25)
  self.ell((0,-.044*S,1.466*S),(.077*S,.052*S,.030*S),'shirtHi','shirt_collar_round',res=28)
  self.ell((0,-.040*S,1.505*S),(.065*S,.061*S,.023*S),'skinShade','neck_shadow_under_chin')
  self.face()
  for side in ['l','r']:
   q=-1 if side=='l' else 1;grp='arm_'+side
   shoulderR=(.093 if typ=='stocky' else .078)*S
   self.ell((q*.010*S,-.004*S,-.041*S),(shoulderR,.096*S,.114*S),'jacket','tailored_sleeve_cap',grp)
   self.cylinder((q*.006*S,0,-.054*S),(q*.025*S,-.011*S,-.275*S),(.075 if typ=='stocky' else .062)*S,'jacket','upper_sleeve',grp)
   self.ell((q*.024*S,-.011*S,-.269*S),(.068*S,.071*S,.080*S),'jacketHi','elbow_seam_volume',grp)
   self.cylinder((q*.025*S,-.011*S,-.274*S),(q*.028*S,-.047*S,-.432*S),.055*S,'jacket','forearm_sleeve',grp)
   self.ell((q*.027*S,-.046*S,-.422*S),(.056*S,.058*S,.032*S),'jacketDark','fabric_wrist_cuff',grp)
   self.ell((q*.028*S,-.048*S,-.468*S),(.047*S,.047*S,.074*S),'skin','skin_hand',grp)
   for j in range(4):
    dx=(j-1.5)*.022*S
    self.ell((q*.028*S+dx,-.050*S,-.515*S),(.012*S,.023*S,.043*S),'skin','individual_finger',grp,res=13)
   self.ell((q*.078*S,-.068*S,-.469*S),(.020*S,.023*S,.039*S),'skin','thumb',grp,res=13)
   self.line([(q*.035*S,-.077*S,-.128*S),(q*.058*S,-.076*S,-.165*S),(q*.049*S,-.076*S,-.205*S)],.003*S,'jacketHi','sleeve_wear_crease',grp)
   if typ=='average':
    self.box((q*.033*S,-.050*S,-.413*S),(.118*S,.014*S,.049*S),'shirtHi','rolled_sleeve_cuff',grp)
   if typ=='stocky':
    for z in [-.11*S,-.22*S]:
     self.line([(-.037*S,-.075*S,z),(.047*S,-.077*S,z+.015*S)],.003*S,'stitch','denim_sleeve_topstitch',grp)
  # Neckline detail and trousers belt and side pockets
  self.box((0,-.113*S,.904*S),(.323*S,.030*S,.050*S),'pantsDark','waist_belt')
  self.box((0,-.131*S,.904*S),(.047*S,.011*S,.034*S),'metal','belt_buckle')
  for sg in (-1,1):
   self.box((sg*.112*S,-.085*S,.985*S),(.080*S,.019*S,.105*S),'jacketDark','jacket_hip_pocket')
   self.line([(sg*.071*S,-.105*S,1.012*S),(sg*.151*S,-.102*S,1.012*S)],.003*S,'stitch','pocket_edge_stitch')
  if typ=='lean':self.build_23()
  elif typ=='average':self.build_27()
  else:self.build_35()
 def build_23(self):
  S=self.s
  # rust hoodie: hood on back and paired drawstrings on front, varsity-ish quilted vest
  self.ell((0,.105*S,1.375*S),(.16*S,.090*S,.125*S),'shirt','hoodie_folded_hood')
  for q in (-1,1):
   self.line([(q*.039*S,-.105*S,1.445*S),(q*.045*S,-.151*S,1.325*S),(q*.051*S,-.153*S,1.237*S)],.0035*S,'stitch','hoodie_drawstring')
  for i in range(6):
   z=(1.035+i*.056)*S
   self.line([(-.168*S,-.134*S,z),(-.081*S,-.148*S,z+.004*S)],.003*S,'jacketHi','vest_quilt_left')
   self.line([(.167*S,-.133*S,z),(.081*S,-.148*S,z+.004*S)],.003*S,'jacketHi','vest_quilt_right')
  self.line([(-.190*S,-.097*S,1.37*S),(-.184*S,-.139*S,1.08*S),(-.169*S,-.121*S,.99*S)],.006*S,'jacketDark','sleeveless_vest_edge')
  self.line([(.190*S,-.097*S,1.37*S),(.184*S,-.139*S,1.08*S),(.169*S,-.121*S,.99*S)],.006*S,'jacketDark','sleeveless_vest_edge')
  # functional angled crossbody strap and small messenger bag
  self.ribbon([( .121*S,-.118*S,1.42*S),(.060*S,-.157*S,1.29*S),(-.052*S,-.162*S,1.08*S),(-.151*S,-.042*S,1.012*S)],.021*S,'strap','sling_strap_front')
  self.ell((-.164*S,.070*S,1.058*S),(.100*S,.062*S,.153*S),'bag','crossbody_sling_pouch')
  self.box((-.175*S,-.004*S,1.116*S),(.085*S,.014*S,.052*S),'strap','sling_bag_front_flap')
  self.line([(-.123*S,-.016*S,1.145*S),(-.158*S,-.012*S,1.146*S),(-.203*S,-.016*S,1.145*S)],.0035*S,'accent','sling_bag_zip')
  # tiny necklace chain in the neckline
  self.line([(-.055*S,-.106*S,1.46*S),(0,-.139*S,1.422*S),(.057*S,-.106*S,1.461*S)],.0025*S,'metal','simple_silver_chain')
 def build_27(self):
  S=self.s
  for sgn in [-1,1]:
   self.box((sgn*.105*S,-.151*S,1.286*S),(.078*S,.016*S,.109*S),'jacketDark','upper_utility_patch_pocket')
   self.box((sgn*.105*S,-.161*S,1.340*S),(.083*S,.020*S,.024*S),'jacketHi','utility_flap')
   self.box((sgn*.106*S,-.174*S,1.331*S),(.016*S,.008*S,.012*S),'metal','utility_snap')
  # strap fasteners and small pack, no weapons/illicit objects.
  self.ell((0,.135*S,1.208*S),(.159*S,.095*S,.248*S),'bag','small_canvas_daypack')
  for sign in [-1,1]:
   self.ribbon([(sign*.138*S,.112*S,1.413*S),(sign*.151*S,-.051*S,1.331*S),(sign*.159*S,-.099*S,1.142*S),(sign*.146*S,-.070*S,1.029*S)],.017*S,'strap','backpack_shoulder_strap')
   self.box((sign*.151*S,-.105*S,1.109*S),(.027*S,.010*S,.034*S),'metal','backpack_buckle')
  self.box((0,.240*S,1.150*S),(.134*S,.014*S,.098*S),'jacketDark','backpack_outer_pocket')
  self.line([(-.068*S,.249*S,1.183*S),(.068*S,.249*S,1.183*S)],.004*S,'zip','pack_zipper')
 def build_35(self):
  S=self.s
  # conspicuous check pattern beneath partially open denim coat
  for i in range(5):
   z=(1.120+i*.055)*S
   self.line([(-.055*S,-.146*S,z),(.056*S,-.146*S,z)],.0028*S,'shirtHi','checked_shirt_horizontal')
  for x in [-.047,-.018,.014,.044]:
   self.line([(x*S,-.146*S,1.105*S),(x*S,-.145*S,1.376*S)],.0022*S,'shirtHi','checked_shirt_vertical')
  for side in [-1,1]:
   self.box((side*.100*S,-.154*S,1.259*S),(.096*S,.024*S,.093*S),'jacketDark','denim_chest_pocket')
   self.line([(side*.051*S,-.172*S,1.303*S),(side*.149*S,-.172*S,1.303*S)],.004*S,'jacketHi','denim_pocket_topstitch')
   self.ell((side*.111*S,-.175*S,1.306*S),(.008*S,.006*S,.010*S),'metal','jacket_button',res=12)
  for i in range(5):
   z=(1.044+i*.069)*S
   self.line([(-.213*S,-.126*S,z),(-.148*S,-.151*S,z+.009*S)],.0027*S,'stitch','denim_left_vertical_wear')
  # worn shoulder satchel: anchored strap diagonal across chest and flat pouch at waist side
  self.ribbon([(-.125*S,-.103*S,1.428*S),(-.075*S,-.160*S,1.306*S),(.029*S,-.167*S,1.146*S),(.155*S,-.079*S,.987*S)],.024*S,'strap','satchel_strap')
  self.ell((.195*S,.063*S,1.005*S),(.103*S,.074*S,.138*S),'bag','used_suede_satchel')
  self.box((.200*S,-.012*S,1.061*S),(.168*S,.024*S,.065*S),'strap','satchel_flap')
  self.box((.195*S,-.032*S,1.043*S),(.020*S,.010*S,.025*S),'metal','satchel_buckle')
 def static_ankle(self):return self.hip_z-self.thigh-self.shin
 def leg_target(self,ph,amp,run):
  # ph: 0=heel strike at forward position; 0..0.60 stance, 0.60..1 swing.
  stride=float(self.c['stride'])*amp*(1.38 if run else 1.0)
  if ph<.60:
   u=ph/.60;forward=-stride*.5+stride*u
   lift=0.0;roll=(-.07+u*.25)
  else:
   u=(ph-.60)/.40;e=u*u*(3-2*u)
   forward=stride*.5-stride*e
   lift=(.13 if run else .092)*self.s*math.sin(math.pi*u)
   roll=.18*(1-u)-.10*u
  return forward,self.static_ankle()+lift,roll,lift
 def pose(self,yaw=0,gait='idle',phase=0.0):
  self.root.SetOrientation(0,0,float(yaw))
  state=(gait!='idle');run=(gait=='run');amp=0 if not state else (1 if not run else 1.12)
  t=phase%1.0
  # Low-amplitude head/pelvis movement and side-to-side transfer.
  bob=(.010 if state else 0)*self.s*(1-math.cos(math.tau*2*t))
  sway=(.013 if state else 0)*self.s*math.sin(math.tau*t)
  self.root.SetPosition(sway,0,bob)
  for side,off in [('l',0.0),('r',.5)]:
   ph=(t+off)%1
   thigh=self.groups['thigh_'+side];shin=self.groups['shin_'+side];foot=self.groups['foot_'+side]
   arm=self.groups['arm_'+side]
   # no locomotor foot movement while idle; zero rotations and stance pose.
   if not state:
    A=0.0;B=0.0;roll=0.0;footz=self.static_ankle()
   else:
    y,footz,roll,lift=self.leg_target(ph,amp,run)
    # Correct z for small pelvis rise so planted sole does not penetrate floor.
    target=np.array([y,footz-self.hip_z-bob])
    D=float(np.linalg.norm(target));L=self.thigh;K=self.shin
    D=min(D,(L+K)*.998)
    a=(L*L-K*K+D*D)/(2*D)
    h=math.sqrt(max(0,L*L-a*a));vec=target/(np.linalg.norm(target)+1e-9)
    # knee bends toward front (-Y); two-link inverse kinematics.
    perp=np.array([vec[1],-vec[0]]) # with vec z<0, front y<0
    knee=a*vec+h*perp
    A=math.degrees(math.atan2(knee[0],-knee[1]))
    dist=target-knee;B=math.degrees(math.atan2(dist[0],-dist[1]))
   thigh.SetOrientation(A,0,0)
   shin.SetOrientation(B-A,0,0)
   foot.SetOrientation(-B+math.degrees(roll),0,0)
   # Arm swing opposes ipsilateral leg; subtle elbow motion on older NPC.
   if state:
    armangle=(-1 if side=='l' else 1)*(22 if not run else 34)*math.cos(math.tau*t)
    if self.c['build']=='stocky':armangle*=.72
   else:armangle=0.0
   arm.SetOrientation(armangle,0,0)
  return self

# VTK off-screen scene utility
class Stage:
 def __init__(self,m,size=(288,440),view='game',alpha=True):
  self.m=m;self.ren=vtk.vtkRenderer();self.ren.SetBackground(.07,.077,.108)
  if alpha:self.ren.SetBackgroundAlpha(0)
  self.ren.AddActor(m.root);self.win=vtk.vtkRenderWindow();self.win.SetSize(*size)
  self.win.SetOffScreenRendering(True);self.win.SetMultiSamples(0);self.win.SetAlphaBitPlanes(1);self.win.AddRenderer(self.ren)
  self.camera=self.ren.GetActiveCamera();self.camera.ParallelProjectionOn();self.camera.SetViewUp(0,0,1);self.view(view)
  for pos,intensity,light_color in [((-3,-5,8),1.05,(1,.86,.73)),((4,2,6),.78,(.80,.85,1)),((3,-3,4),.32,(1,.86,.70))]:
   l=vtk.vtkLight();l.SetPosition(*pos);l.SetFocalPoint(0,0,1);l.SetColor(*light_color);l.SetIntensity(intensity);self.ren.AddLight(l)
 def view(self,view):
  cf=self.m.h*.48;scale=self.m.h*.65
  positions={'front':(0,-5,2.7),'threequarter':(-3.9,-5,3.4),'profile':(-5.5,0,2.7),
             'back':(0,5,2.7),'overhead':(0,-1,7.0),'game':(0,-5.5,4.15)}
  self.camera.SetPosition(*positions[view]);self.camera.SetFocalPoint(0,0,cf)
  self.camera.SetParallelScale(scale*(1.06 if view=='game' else 1.0));self.ren.ResetCameraClippingRange()
 def grab(self,alpha=True):
  self.ren.ResetCameraClippingRange();self.win.Render()
  f=vtk.vtkWindowToImageFilter();f.SetInput(self.win);f.ReadFrontBufferOff()
  if alpha:f.SetInputBufferTypeToRGBA()
  else:f.SetInputBufferTypeToRGB()
  f.Update();data=f.GetOutput();dims=data.GetDimensions();buf=vtk_to_numpy(data.GetPointData().GetScalars()).reshape(dims[1],dims[0],-1)
  return Image.fromarray(np.flipud(buf).copy())
 def close(self):self.win.Finalize()

def matrix(obj):
 M=obj.GetMatrix();return np.array([[M.GetElement(i,j) for j in range(4)] for i in range(4)])

def export_glb(m,folder):
 m.pose();group_parts=defaultdict(lambda:[[],[]]);vertices=tris=0
 for actor,name,material,group in m.parts:
  mapper=actor.GetMapper();mapper.Update();flt=vtk.vtkTriangleFilter();flt.SetInputData(mapper.GetInput());flt.Update();pd=flt.GetOutput()
  if pd.GetNumberOfPolys()==0:continue
  V=vtk_to_numpy(pd.GetPoints().GetData()).astype('f8')
  F=vtk_to_numpy(pd.GetPolys().GetData()).reshape(-1,4)[:,1:].astype('i8')
  transforms=[matrix(actor)];anc=group
  while anc:
   transforms.append(matrix(m.groups[anc]));anc=m.parent[anc]
  M=np.eye(4)
  for transform in reversed(transforms):M=M@transform
  V=trimesh.transform_points(V,M)
  store=group_parts[material];offset=sum(len(v) for v in store[0]);store[0].append(V.astype('f4'));store[1].append(F+offset)
  vertices+=len(V);tris+=len(F)
 scene=trimesh.Scene()
 for col,(vs,fs) in group_parts.items():
  meshobj=trimesh.Trimesh(vertices=np.concatenate(vs),faces=np.concatenate(fs),process=False)
  h=mathex(m.c,col);RGBA=list(int(x*255) for x in rgb(h))+[255]
  meshobj.visual=trimesh.visual.TextureVisuals(material=trimesh.visual.material.PBRMaterial(name=col,baseColorFactor=RGBA,metallicFactor=.12 if col=='metal' else .0,roughnessFactor=.72,doubleSided=True))
  scene.add_geometry(meshobj,node_name=m.c['id']+'_'+col)
 p=folder/(m.c['id']+'.glb');scene.export(str(p))
 check=trimesh.load(str(p),force='scene')
 audit={'id':m.c['id'],'age':m.c['age'],'status':'unrigged 3D neutral pose; articulated only in generator, PNG atlas and GIF',
 'vertex_count':vertices,'triangles':tris,'components':len(m.parts),'material_meshes':len(check.geometry),
 'bounds_m':np.asarray(check.bounds).round(4).tolist(),'height_m':round(float(np.ptp(check.bounds[:,2])),3),
 'vt_k_version':vtk.vtkVersion.GetVTKVersion(),'source':'procedurally authored VTK meshes; no photogrammetry or stock figures'}
 (folder/'geometry_audit.json').write_text(json.dumps(audit,indent=2));return audit

def montage(m,folder):
 views=['front','threequarter','profile','back','overhead'];W,H=450,560
 sheet=Image.new('RGB',(W*3,H*2),(30,32,39));d=ImageDraw.Draw(sheet)
 for i,view in enumerate(views):
  m.pose();s=Stage(m,(W,H),view,False);im=s.grab(False)
  x=i%3*W;y=i//3*H
  sheet.paste(im,(x,y));d.rectangle((x,y,x+W,y+42),fill=(24,27,37));d.text((x+15,y+14),f'{m.c["id"].upper()}   |   {view.upper()}',fill=(243,210,166));s.close()
  im.save(folder/f'{view}.png')
 # Profile and custom garment detailing rendered with actual geometry.
 sheet.save(folder/'5_view_comparison.png')

def sprite_atlas(m,folder):
 stage=Stage(m,(288,432),'game',True)
 hi=Image.new('RGBA',(1024,2304),(0,0,0,0));small=Image.new('RGBA',(256,576),(0,0,0,0))
 direction_previews=[];meta=[]
 for gait_i,gait in enumerate(['idle','walk','run']):
  for frame in range(4):
   for col,(heading,yaw,angle,visible) in enumerate(DIR):
    phase=frame/4.0 if gait!='idle' else 0.0
    m.pose(yaw,gait,phase)
    im=stage.grab(True).resize((128,192),Image.Resampling.LANCZOS)
    hi.alpha_composite(im,(col*128,(gait_i*4+frame)*192))
    small.alpha_composite(im.resize((32,48),Image.Resampling.LANCZOS),(col*32,(gait_i*4+frame)*48))
    if gait_i==0 and frame==0:direction_previews.append(im)
    meta.append({'gait':gait,'frame_index':frame,'row':gait_i*4+frame,'column':col,
                 'character_facing':heading,'screen_angle_degrees':angle,'vt_k_model_yaw_degrees':yaw})
  print(f"  {m.c['id']} {gait} atlas completed",flush=True)
 hi.save(folder/'atlas_4x.png');small.save(folder/'atlas_32x48.png')
 qa=Image.new('RGB',(8*143,246),(30,31,42));d=ImageDraw.Draw(qa)
 for i,im in enumerate(direction_previews):
  x=i*143;tile=Image.new('RGB',(128,192),(51,50,56));tile.paste(im,(0,0),im)
  qa.paste(tile,(x+7,44));d.text((x+13,16),f'{DIR[i][0][:2].upper()} {DIR[i][2]}°',fill=(243,210,166))
 qa.save(folder/'eight_direction_QA.png')
 stage.close()
 (folder/'atlas_metadata.json').write_text(json.dumps({'character':m.c['id'],'columns':['S','SW','W','NW','N','NE','E','SE'],
 'rows':'idle 0-3; walk 4-7; run 8-11','cell_size':[32,48],
 'coordinate_contract':'screen +X right, +Y down; angle 0 East, positive clockwise; South shows FRONT',
 'leg_motion':'2-bone planar inverse kinematics: 60% stance, 40% swing; alternating opposite-leg offset, shoe pitch and counter-swing arms',
 'frames':meta},indent=2))
 a=np.array(small.getchannel('A'));used=[]
 for row in range(12):
  for col in range(8):used.append(int(np.count_nonzero(a[row*48:(row+1)*48,col*32:(col+1)*32]>24)))
 assert min(used)>10, ('empty sprite cell', min(used))
 (folder/'atlas_validation.json').write_text(json.dumps({'atlas_dimensions':[256,576],'total_cells':96,
 'min_nontransparent_pixels_per_cell':min(used),'max_nontransparent_pixels_per_cell':max(used),'all_valid':True},indent=2))

def gait_gif(m,folder):
 # Twelve frames = smoother motion demo than the game's fixed 4-step atlas.
 stage=Stage(m,(300,450),'game',True);frames=[]
 for i in range(16):
  m.pose(0,'walk',i/16);im=stage.grab(True).resize((225,338),Image.Resampling.LANCZOS)
  bg=Image.new('RGBA',im.size,(40,44,53,255));bg.alpha_composite(im)
  draw=ImageDraw.Draw(bg);draw.text((12,12),f'{m.c["id"]} | WALK | {round(i/16*100)}%',fill=(237,218,187))
  frames.append(bg.convert('P',palette=Image.Palette.ADAPTIVE))
 frames[0].save(folder/'walk_cycle.gif',save_all=True,append_images=frames[1:],duration=85,loop=0,optimize=True,disposal=2)
 stage.close()

def gait_strip(m,folder):
 stage=Stage(m,(250,400),'profile',True);out=Image.new('RGB',(8*220,392),(36,37,47));d=ImageDraw.Draw(out)
 for i in range(8):
  m.pose(0,'walk',i/8);im=stage.grab(True).resize((200,310),Image.Resampling.LANCZOS)
  x=i*220+10;bg=Image.new('RGBA',im.size,(48,47,54,255));bg.alpha_composite(im)
  out.paste(bg.convert('RGB'),(x,40));d.text((x+8,13),f'FRAME {i+1}  {int(i*100/8)}%',fill=(230,198,162))
 d.line((0,351,8*220,351),fill=(197,158,104),width=2)
 out.save(folder/'walking_gait_eight_phase.png');stage.close()

def main():
 t=time.time()
 for conf in CONFIGS:
  folder=ROOT/conf['id'];folder.mkdir(exist_ok=True)
  print('\nSTART',conf['id'],flush=True)
  m=Person(conf);audit=export_glb(m,folder)
  print('  mesh',audit['triangles'],'tris in',audit['components'],'VTK parts',flush=True)
  montage(m,folder);print('  five-view QA completed',flush=True)
  sprite_atlas(m,folder)
  gait_gif(m,folder);gait_strip(m,folder)
  (folder/'character_design.json').write_text(json.dumps({k:v for k,v in conf.items() if k not in ('skin','skinShade','skinHi','hair','hairLight','beard','jacket','jacketHi','jacketDark','shirt','shirtHi','pants','pantsHi','pantsDark','shoe','shoeDark','sole','bag','strap','accent','metal')},indent=2))
  readme=f'''# {conf['id']} — Hero Shooter unarmed NPC, age {conf['age']}\n\n{conf['desc']}\n\n`{conf['id']}.glb` is a real procedural VTK 3D model (+Z up, facing -Y), approximately {conf['height']} m tall. This is a static, unrigged 3D file; the procedural generator contains joint rotations and a planar two-bone leg IK controller for offline walk/run/idle render. Do **not** describe it as an animated skeletal GLB.\n\nOutput: `5_view_comparison.png`, five camera PNGs, `walk_cycle.gif` (16 phases), `walking_gait_eight_phase.png` (8 phase side profile), `eight_direction_QA.png`, `atlas_32x48.png` (256×576), `atlas_4x.png` (1024×2304), `geometry_audit.json`, `atlas_metadata.json` and `atlas_validation.json`.\n\nThe gait uses a biomechanically motivated 60/40 stance/swing ratio, knee flexion during swing, arm counter-swing and shoe roll. It is a stylized approximation, not measured motion-capture. Four-step in-game atlas frames may look choppier than sixteen-step GIF; consider 8-frame atlas when the game renderer supports it. Neutral unarmed stance; characters are not linked to ethnic appearance, income or criminality by any physiological marker.\n\nHero Shooter directional contract: columns [South, Southwest, West, Northwest, North, Northeast, East, Southeast]; rows 0–3 idle, 4–7 walking, 8–11 running; a standing NPC must use idle, not cycling walk.\n\nRebuild: `xvfb-run -a python generate_looters.py` from package root. Dependencies: vtk, numpy, Pillow, trimesh.\n'''
  (folder/'README.md').write_text(readme)
  print('COMPLETE',conf['id'],round(time.time()-t,1),'s cumulative',flush=True)
 # final contact sheet with all three characters
 out=Image.new('RGB',(1350,700),(29,31,39));d=ImageDraw.Draw(out)
 for i,conf in enumerate(CONFIGS):
  p=ROOT/conf['id']/'front.png';im=Image.open(p).convert('RGB').resize((430,535))
  x=i*450+10;out.paste(im,(x,78));d.text((x+12,21),f"LOOTER {conf['age']} YEARS",fill=(239,206,165));d.text((x+12,44),conf['build'].upper()+' | unarmed',fill=(183,182,184))
 out.save(ROOT/'three_looters_comparison.png')
 report={'characters':[],'gait':'60 percent grounded stance, 40 percent swing, two-bone IK',
         'static_glb_unrigged':True,'repository_modifications':False,'source_repository':'cryogenized-spec/Hero-shooter',
         'directions':['S','SW','W','NW','N','NE','E','SE'],'fps_walk_gif':round(1000/85,2)}
 for c in CONFIGS:
  p=ROOT/c['id']
  report['characters'].append({'name':c['id'],'age':c['age'],'height_m':c['height'],'files':[q.name for q in p.iterdir() if q.is_file()]})
 (ROOT/'delivery_manifest.json').write_text(json.dumps(report,indent=2))
 (ROOT/'README.md').write_text('''# Hero Shooter — three looter prototypes (23, 27, 35)\n\nThree distinct **adult male, unarmed** character meshes plus 96-cell sprite atlases and 16-phase walking demonstrations, built with Python VTK. Source `generate_looters.py` is editable and reproducible. See each character folder for multi-angle reviews and audits.\n\nNo original repository character sprites or PRs were overwritten. Assets are offline review candidates until approved and integrated.\n\n### Coordinates\n3D: X horizontal, Y depth (front is -Y), Z up. 2D: +X right, +Y down, 0° east clockwise. Atlas S SW W NW N NE E SE, South FRONT, North BACK; 12 rows as 4 idle, 4 walk, 4 run.\n\n### Gait\nTwo-link planar inverse kinematics; approximately 60% stance and 40% swing, opposite arms counter-swing, articulated shoes and slight body bob. `walking_gait_eight_phase.png` provides eight side-on reference poses, while `walk_cycle.gif` has 16 intermediate frames. These are stylized authored kinetics, not mocap. Standing actors should display idle.\n\n### Limitations\nThe GLB files are real but **unrigged neutral poses**. Motion exists in Python source and rendered sprite/GIF exports. A runtime skeletal character requires Blender or another rigging package.\n\n## Files\n- `looter_23/`, `looter_27/`, `looter_35/`: GLB, camera previews, side-on gait strip, GIF, native 32×48 sprites, high-resolution sprites, QA JSON.\n- `three_looters_comparison.png`: 3-character lineup.\n- `generate_looters.py`: deterministic VTK source.\n''')
 with zipfile.ZipFile(ROOT/'hero_shooter_looters_vtk.zip','w',compression=zipfile.ZIP_DEFLATED,compresslevel=6) as z:
  for p in ROOT.rglob('*'):
   if p.is_file() and p.name not in ('hero_shooter_looters_vtk.zip','build.log'):
    z.write(p,p.relative_to(ROOT))
 print('ALL_COMPLETE',round(time.time()-t,1),'s',flush=True)

if __name__=='__main__':main()