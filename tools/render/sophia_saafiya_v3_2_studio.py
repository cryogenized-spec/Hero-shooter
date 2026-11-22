#!/usr/bin/env python3
"""Hero Shooter 3D Studio -- Sophia / Saafiya, Gothic look, V3.
Fully procedural, offline, no image generator. World: +Z up, +Y front, +X character's anatomical LEFT.
Materials and dimensions estimated against approved turnaround (saafiya_corrected_model_sheet_v2.png).
V2 baseline: /mnt/data/saafiya_true3d_modelsheet.py (unchanged).
Run: xvfb-run -a python /mnt/data/sophia_saafiya_v3_studio.py
"""
import math, json, os
from pathlib import Path
from collections import defaultdict
import numpy as np
import vtk
import trimesh
from vtk.util.numpy_support import vtk_to_numpy
from PIL import Image,ImageDraw,ImageFont,ImageFilter

ROOT=Path(__file__).resolve().parent; OUT=ROOT/'sophia_saafiya_studio_v3_2';OUT.mkdir(exist_ok=True)
P={
 'skin':'#b97455','skin_high':'#d18c67','skin_low':'#92553e',
 'hair':'#1e101b','hair_mid':'#3a1829','hair_rim':'#662f46','hair_dark':'#120b13',
 'lace':'#241722','lace_pattern':'#181219','corset':'#20161e','corset_panel':'#342530',
 'skirt':'#1e1721','skirt_alt':'#312330','coat':'#28202c','coat_fold':'#413142','coat_inner':'#17141e',
 'boot':'#1d1820','boot_light':'#3e343d','fishnet':'#30202a',
 'silver':'#bfc6d0','silver_hi':'#f1f2ed','silver_dark':'#747783',
 'buckle':'#d4c6b9','lens':'#242530', 'eyes':'#22161c', 'iris':'#81543d',
 'lip':'#2b1120','shadow':'#170c15'
}
def col(x):
 s=P.get(x,x).lstrip('#');return tuple(int(s[i:i+2],16)/255 for i in (0,2,4))

class Studio:
 def __init__(self):
  self.parts=[];self.assembly=vtk.vtkAssembly();self.build()
 def add(self,poly,name,mat,opacity=1.0,metal=.1):
  mapper=vtk.vtkPolyDataMapper();mapper.SetInputData(poly)
  a=vtk.vtkActor();a.SetMapper(mapper)
  p=a.GetProperty();p.SetColor(col(mat));p.SetAmbient(.28);p.SetDiffuse(.72)
  p.SetSpecular(.08 + metal*.64);p.SetSpecularPower(22 if metal<.4 else 56)
  p.SetOpacity(opacity);p.SetInterpolationToPhong()
  self.assembly.AddPart(a);self.parts.append((name,mat,poly,a));return a
 def ell(self,name,pos,rad,mat,res=28,metal=0):
  s=vtk.vtkSphereSource();s.SetRadius(1);s.SetPhiResolution(res);s.SetThetaResolution(res+4);s.Update()
  tf=vtk.vtkTransform();tf.Translate(*pos);tf.Scale(*rad)
  f=vtk.vtkTransformPolyDataFilter();f.SetInputConnection(s.GetOutputPort());f.SetTransform(tf);f.Update()
  return self.add(f.GetOutput(),name,mat,metal=metal)
 def tube(self,name,points,r,mat,edges=9,metal=0,closed=False):
  if len(points)<2:return
  ps=vtk.vtkPoints();ln=vtk.vtkCellArray()
  pp=list(points)+([points[0]] if closed else [])
  for p in pp:ps.InsertNextPoint(*p)
  for k in range(len(pp)-1):
   line=vtk.vtkLine();line.GetPointIds().SetId(0,k);line.GetPointIds().SetId(1,k+1);ln.InsertNextCell(line)
  src=vtk.vtkPolyData();src.SetPoints(ps);src.SetLines(ln)
  tubing=vtk.vtkTubeFilter();tubing.SetInputData(src);tubing.SetRadius(r)
  tubing.SetNumberOfSides(edges);tubing.CappingOn();tubing.Update()
  return self.add(tubing.GetOutput(),name,mat,metal=metal)
 def cyl(self,name,a,b,r,mat,metal=0,res=18,r2=None):
  a=np.array(a,float);b=np.array(b,float);d=b-a;ln=np.linalg.norm(d)
  if ln<1e-5:return
  if r2 is not None and abs(r-r2)>.0001:
   src=vtk.vtkConeSource();src.SetHeight(ln);src.SetRadius(max(r,r2));src.SetResolution(res)
  else:
   src=vtk.vtkCylinderSource();src.SetRadius(r);src.SetHeight(ln);src.SetResolution(res)
  src.CappingOn();src.Update()
  trans=vtk.vtkTransform();trans.Translate(*((a+b)/2))
  axis=np.cross(np.array([0,1,0]),d/ln)
  dot=np.dot([0,1,0],d/ln)
  if np.linalg.norm(axis)>1e-6:trans.RotateWXYZ(math.degrees(math.acos(max(-1,min(1,dot)))),*axis)
  elif dot<0:trans.RotateWXYZ(180,1,0,0)
  f=vtk.vtkTransformPolyDataFilter();f.SetInputConnection(src.GetOutputPort());f.SetTransform(trans);f.Update()
  return self.add(f.GetOutput(),name,mat,metal=metal)
 def cube(self,name,pos,size,mat,metal=0):
  s=vtk.vtkCubeSource();s.SetXLength(size[0]);s.SetYLength(size[1]);s.SetZLength(size[2]);s.SetCenter(*pos);s.Update()
  return self.add(s.GetOutput(),name,mat,metal=metal)
 def grid_surface(self,name,positions,faces,mat,metal=0):
  points=vtk.vtkPoints();points.SetNumberOfPoints(len(positions));
  for i,p in enumerate(positions):points.SetPoint(i,*[float(x) for x in p])
  poly=vtk.vtkPolyData();poly.SetPoints(points)
  cells=vtk.vtkCellArray()
  for face in faces:
   v=vtk.vtkTriangle();v.GetPointIds().SetId(0,int(face[0]));v.GetPointIds().SetId(1,int(face[1]));v.GetPointIds().SetId(2,int(face[2]));cells.InsertNextCell(v)
  poly.SetPolys(cells)
  normals=vtk.vtkPolyDataNormals();normals.SetInputData(poly);normals.SplittingOff();normals.ConsistencyOn();normals.AutoOrientNormalsOn();normals.ComputePointNormalsOn();normals.Update()
  return self.add(normals.GetOutput(),name,mat,metal=metal)
 def oval_loft(self,name,rings,mat,section=48,pinch=0,metal=0):
  """Rings: z, rx, ry, centerY; fine folded organic dress shapes."""
  pos=[];fs=[]
  for j,(z,rx,ry,cy) in enumerate(rings):
   for k in range(section):
    a=2*math.pi*k/section
    fold=(.010*math.sin(a*11+z*3) if pinch else 0)
    pos.append(((rx+fold)*math.cos(a),cy+(ry+fold)*math.sin(a),z))
  for j in range(len(rings)-1):
   for k in range(section):
    kk=(k+1)%section;a=j*section+k;b=j*section+kk;c=(j+1)*section+k;d=(j+1)*section+kk
    fs.extend([(a,b,c),(b,d,c)])
  # cap ends
  pos.extend([(0,rings[0][3],rings[0][0]),(0,rings[-1][3],rings[-1][0])]);a=len(pos)-2;b=len(pos)-1
  for k in range(section):fs.append((a,(k+1)%section,k));fs.append((b,(len(rings)-1)*section+k,(len(rings)-1)*section+(k+1)%section))
  return self.grid_surface(name,pos,fs,mat,metal=metal)
 def skirt(self):
  sections=80;pos=[];faces=[]
  for j,(z,rx,ry) in enumerate([(1.22,.23,.20),(1.14,.30,.245),(1.07,.34,.27),(.99,.37,.31),(.93,.39,.33)]):
   for i in range(sections):
    a=math.tau*i/sections
    pleat=.015*math.sin(15*a+.1)*(j/4)
    # front asymmetry: skirt dips on back, front cut higher
    hem_delta=-(.13*max(0,-math.sin(a))) if j==4 else 0
    z_offset=-.03*math.cos(3*a) if j==4 else 0
    pos.append(((rx+pleat)*math.cos(a),(ry+pleat)*math.sin(a)-.012,z+hem_delta+z_offset))
  for j in range(4):
   for i in range(sections):
    a=j*sections+i;b=j*sections+(i+1)%sections;c=(j+1)*sections+i;d=(j+1)*sections+(i+1)%sections
    faces.extend([(a,b,c),(b,d,c)])
  self.grid_surface('skirt/main_pleated',pos,faces,'skirt')
  # fine vertical raised seam/fold lines, no disconnected planes
  for i in range(15):
   a=math.tau*i/15
   pts=[]
   for j in range(3):
    t=j/2;rz=1.17-.205*t;rx=.28+.103*t;ry=.23+.10*t
    pts.append(((rx+.013)*math.cos(a),(ry+.014)*math.sin(a),rz-.04*max(0,-math.sin(a))*t))
   self.tube('skirt/pleat_seam',pts,.004,'skirt_alt')
 def create_face(self):
  """Single connected head surface with integrated sculptural nose profile."""
  cx,cy,cz=0,0,2.145;rx,ry,rz=.236,.207,.302
  seg=84; rows=48;vertices=[];tri=[]
  for i in range(rows+1):
   theta=.00002+(math.pi-.00004)*i/rows
   for j in range(seg):
    a=j*math.tau/seg
    zz=rz*math.cos(theta)
    xx=rx*math.sin(theta)*math.cos(a)
    yy=ry*math.sin(theta)*math.sin(a)
    # Shape jaw/chin taper, cheek structure, slight tapered upper forehead
    lower=max(0,(-zz+.045)/.26)
    xx*=1-.34*min(1,lower)**1.1
    if yy>0:
     # nose bridge emerges from same head surface around x≈0, z relative -.012
     f=math.exp(-(xx/.058)**2) * math.exp(-((zz-.010)/.135)**2)
     tip=math.exp(-(xx/.047)**2) * math.exp(-((zz+.060)/.050)**2)
     wing=math.exp(-((abs(xx)-.055)/.030)**2)*math.exp(-((zz+.083)/.033)**2)
     yy+=.041*f + .033*tip + .012*wing
     # gentle brow ridge, cheekbones
     yy+=.009*math.exp(-((zz-.082)/.035)**2)*math.exp(-((abs(xx)-.092)/.064)**2)
     yy+=.009*math.exp(-((zz+.055)/.09)**2)*math.exp(-((abs(xx)-.143)/.07)**2)
    vertices.append((cx+xx,cy+yy,cz+zz))
  for i in range(rows):
   for j in range(seg):
    jj=(j+1)%seg;k=i*seg+j;kn=i*seg+jj;k2=(i+1)*seg+j;k2n=(i+1)*seg+jj
    tri.extend([(k,kn,k2),(kn,k2n,k2)])
  self.grid_surface('anatomy/continuous_face_and_nose',vertices,tri,'skin')
  return lambda x,z:self.face_y(x,z)
 @staticmethod
 def face_y(x,z):
  """Approx. front surface including nose used to conform makeup and lips."""
  zc=z-2.145;rx=.236;rz=.302
  a=max(.02,1-(x/rx)**2-(zc/rz)**2)
  y=.207*math.sqrt(a)
  y+=.041*math.exp(-(x/.058)**2)*math.exp(-((zc-.010)/.135)**2)
  y+=.033*math.exp(-(x/.047)**2)*math.exp(-((zc+.060)/.050)**2)
  y+=.012*math.exp(-((abs(x)-.055)/.030)**2)*math.exp(-((zc+.083)/.033)**2)
  y+=.009*math.exp(-((zc-.082)/.035)**2)*math.exp(-((abs(x)-.092)/.064)**2)
  y+=.009*math.exp(-((zc+.055)/.09)**2)*math.exp(-((abs(x)-.143)/.07)**2)
  return y
 def surface_stroke(self,name,xz,rad,mat):
  pts=[(x,self.face_y(x,z)+.006,z) for x,z in xz]
  self.tube(name,pts,rad,mat,edges=10)
 def face_details(self):
  # integrated almond-shaped eyes, sharp winged eyeliner, warm irises
  for side in (-1,1):
   x0=side*.092;zc=2.215
   self.surface_stroke('face/eyeliner_upper',[(x0-.065,zc),(x0-.02,zc+.016),(x0+.027,zc+.012),(x0+.072,zc+.002)],.009,'eyes')
   self.surface_stroke('face/wing',[(x0+.045,zc+.007),(x0+.083,zc+.035)],.008,'eyes')
   self.surface_stroke('face/lower_eyelid',[(x0-.050,zc-.010),(x0,zc-.017),(x0+.046,zc-.008)],.0045,'hair_rim')
   self.surface_stroke('face/brow',[(x0-.050,2.280),(x0+.002,2.298),(x0+.061,2.288)],.0065,'hair_dark')
   x=x0+.005;z=2.219;y=self.face_y(x,z)+.013
   self.ell('face/iris', (x,y,z),(.019,.007,.017),'iris',res=16)
   self.ell('face/pupil', (x,y+.006,z),(.007,.005,.013),'shadow',res=12)
   self.ell('face/eyeglint', (x-.005,y+.011,z+.007),(.005,.003,.005),'silver_hi',res=10)
  # Integrated upper/lower black lipstick meet at one shared mouth line.
  for upper in (True,False):
   coords=[];faces=[];steps=36;rows=5
   for j in range(rows):
    t=j/(rows-1)
    for i in range(steps+1):
     u=-1+2*i/steps;x=.107*u
     base=2.015+.0028*u+.0040*abs(u)
     fullness=(1-u*u)**.9
     # subtle vermilion border, cupid bow without beard-like double stripes
     bow=(.0042*math.cos(math.pi*2.0*u) if upper else 0)
     z=base+t*(.020*fullness+bow*fullness) if upper else base-t*.015*fullness
     y=self.face_y(x,z)+.004+(.0065*math.sin(math.pi*t)*fullness)
     coords.append((x,y,z))
   for j in range(rows-1):
    for i in range(steps):
     a=j*(steps+1)+i;b=a+1;c=(j+1)*(steps+1)+i;d=c+1
     faces.extend([(a,b,c),(b,d,c)])
   self.grid_surface('face/lip_upper' if upper else 'face/lip_lower',coords,faces,'lip')
  # beauty mark viewer right (character left) above upper lip
  x=.128;z=2.049;self.ell('face/beauty_spot',(x,self.face_y(x,z)+.006,z),(.006,.003,.006),'shadow',res=12)
  # ears integrated visually into cheeks and jewellery attached to the earlobes
  for side in (-1,1):
   x=side*.232
   self.ell('anatomy/ear',(x,.006,2.098),(.044,.055,.078),'skin',res=24)
   # an entire hanging circle in XZ plane, visually attached to the ear lobe
   ang=np.linspace(0,2*math.pi,64)
   self.tube('jewelry/silver_hoop',[(x+side*.025+.063*math.cos(a),.027,2.030+.067*math.sin(a)) for a in ang],.007,'silver_hi',metal=.9,closed=True)
 def hair(self):
  self.ell('hair/scalp',(0,-.045,2.365),(.252,.226,.175),'hair',36)
  self.ell('hair/rear_volume',(0,-.177,2.355),(.255,.242,.210),'hair',28)
  # full textured bun positioned rear and high; authored seeded curves, not random drift
  self.ell('hair/updo_base',(0,-.172,2.530),(.250,.211,.176),'hair_mid',40)
  # Curl geometry sits on (not inside) the surface of the updo; varied helices
  # break the spherical silhouette and reveal the burgundy highlights at all views.
  rng=np.random.default_rng(97)
  for k in range(86):
   u=((k*.61803398875)%1)*math.tau
   v=((k*.38196601125)%1)*math.pi
   rr=.255*math.sin(v)
   cx=rr*math.cos(u);cy=-.172+.214*math.sin(v)*math.sin(u)
   cz=2.530+.182*math.cos(v)
   tangent=np.array([-math.sin(u),math.cos(u),0.0]);
   if np.linalg.norm(tangent)<1e-6:tangent=np.array([1.0,0.0,0.0])
   points=[]
   for j in range(28):
    t=j/27;phase=math.tau*(1.15+(k%3)*.17)*t
    ds=.014*math.cos(phase)
    x=cx + tangent[0]*(t-.5)*.068 + tangent[0]*ds
    y=cy + tangent[1]*(t-.5)*.068 + tangent[1]*ds
    z=cz+.018*math.sin(phase)+.019*(t-.5)
    points.append((x,y,z))
   self.tube('hair/updo_curl',points,.012+(.0025*(k%3==0)),['hair','hair_mid','hair_rim','hair_dark'][k%4])
  # Cascade ringlets along the left and right outlines of the messy high bun
  for side in (-1,1):
   for k in range(6):
    x=side*(.218+.02*(k%3));y=-.18+.047*(k//3);z=2.59-.034*k
    points=[]
    for j in range(35):
     t=j/34;zj=z-.2*t
     points.append((x+side*.027*math.sin(5*math.pi*t),y+.031*math.cos(5*math.pi*t),zj))
    self.tube('hair/ringlets',points,.009+(.002 if k%2==0 else 0),'hair_rim' if k%3==0 else 'hair_mid')
  # Distinct projected curls on the forward surface of the updo, like the approved
  # reference rather than one featureless egg-shaped bun. They remain attached.
  for i in range(36):
   a=i*2.399963229728653
   x=.223*math.cos(a); z=2.540+.153*math.sin(a)
   y=.022+.036*math.sin(i*3.4)  # front half of high bun
   pts=[]
   for j in range(26):
    t=j/25;ph=math.tau*1.55*t+i*.9
    xx=x+.019*math.cos(ph)
    zz=z+.017*math.sin(ph)+.015*(t-.5)
    yy=y+.017*math.sin(ph*1.2)
    pts.append((xx,yy,zz))
   self.tube('hair/forward_curl',pts,.010,'hair_rim' if i%4==0 else ('hair_mid' if i%3 else 'hair_dark'))
  # loose forehead bangs, sides, short tendrils
  for side in (-1,1):
   x=side*.212
   self.tube('hair/face_framing_strand',[(x,-.005,2.36),(x+side*.042,.139,2.26),(x+side*.025,.185,2.14),(x+side*.014,.153,2.05)],.015,'hair_mid')
   self.tube('hair/flyaway',[(x*.5,.17,2.41),(x*.66,.217,2.336),(x*.72,.200,2.25)],.008,'hair_rim')
  for i in range(7):
   x=-.16+i*.051
   self.tube('hair/fringe',[(x*.9,.054,2.451),(x,.170,2.356),(x+.023,.201,2.305+.014*(i%2))],.010,'hair_dark')
  # Sunglasses perched on hair crown, fitted dark oval lenses with silver thin rims
  for s in (-1,1):
   x=s*.105
   self.ell('accessories/sunglasses_lens',(x,.149,2.514),(.083,.018,.045),'lens',22)
   self.tube('accessories/sunglasses_frame',[(x+.083*math.cos(a),.168,2.514+.047*math.sin(a)) for a in np.linspace(0,math.tau,44)],.008,'silver_hi',metal=.8,closed=True)
  self.tube('accessories/sunglasses_bridge',[(-.026,.171,2.516),(.026,.171,2.516)],.008,'silver',metal=.8)
  # small silver hair clip without a cross motif
  self.tube('accessories/hair_clip',[(-.228,.084,2.497),(-.242,.074,2.454),(-.237,.076,2.420)],.008,'silver_hi',metal=.8)
 def jewelry(self):
  self.oval_loft('jewelry/black_choker',[(1.920,.133,.125,0),(1.940,.132,.126,0),(1.972,.127,.121,0)],'corset',section=40)
  # Silver eyelet ring at centre of choker
  a=np.linspace(0,math.tau,48)
  self.tube('jewelry/choker_ring',[(.042*math.cos(t),.136,1.942+.042*math.sin(t)) for t in a],.008,'silver_hi',metal=.85,closed=True)
  self.tube('jewelry/necklace_chain',[(-.085,.12,1.914),(-.04,.171,1.842),(0,.188,1.791),(.04,.171,1.842),(.085,.12,1.914)],.005,'silver',metal=.8)
  # Metal crescent moon as a continuous solid 3D ribbon. Curved silver crescent
  # open to screen-right, with tapered tips and a polished raised front edge.
  levels=35;coords=[];faces=[]
  for j in range(levels):
   t=j/(levels-1);theta=-math.pi/2+math.pi*t
   z=1.780+.065*math.sin(theta)
   x_outer=-.044*math.cos(theta)-.003
   # thickness tapers smoothly to zero at top and bottom
   x_inner=x_outer+.023*(math.cos(theta)**.85)
   coords.extend([(x_outer,.223,z),(x_inner,.227,z)])
  for j in range(levels-1):
   k=2*j;faces.extend([(k,k+1,k+2),(k+1,k+3,k+2)])
  self.grid_surface('jewelry/crescent_solid',coords,faces,'silver_hi',metal=.9)
 def build(self):
  # feet and legs in balanced neutral A-stance; game +Z up, floor=0
  for sign in (-1,1):
   x=sign*.145
   self.cyl('anatomy/thigh',(x,0,1.18),(x+sign*.025,.012,.65),.138,'skin',res=26)
   self.ell('anatomy/knee',(x+sign*.025,.011,.63),(.126,.125,.145),'skin',28)
   # fishnets on exposed thigh: conforming helical diagonals over surface
   for winding in (-1,1):
    for start in range(5):
     pts=[]
     for j in range(35):
      t=j/34;z=.69+.42*t
      # angular phase wrapping around thigh at reasonable density
      ang=winding*math.tau*2.0*t + start*math.tau/5
      xx=x+sign*(.017*(1-t))+.139*math.cos(ang)
      yy=.012+.139*math.sin(ang)
      pts.append((xx,yy,z))
     self.tube('hosiery/fishnet',pts,.0028,'fishnet',edges=6)
   # thigh garter left leg only (viewer-right in frontal render)
   if sign==1:
    angs=np.linspace(0,math.tau,48)
    self.tube('hosiery/garter',[(x+.148*math.cos(a),.012+.148*math.sin(a),.943) for a in angs],.014,'corset',closed=True)
    self.cube('hosiery/garter_buckle',(x,.167,.942),(.052,.018,.047),'silver',metal=.75)
   self.cyl('boot/calf',(x+sign*.026,.01,.60),(x+sign*.025,.026,.17),.147,'boot',res=28)
   self.ell('boot/front_toe',(x+sign*.025,.12,.095),(.145,.205,.086),'boot',30)
   self.ell('boot/heel',(x+sign*.025,-.055,.090),(.155,.14,.113),'boot',26)
   self.cube('boot/platform',(x+sign*.023,.084,.042),(.290,.335,.065),'boot_light')
   for j in range(5):
    z=.210+j*.084
    self.tube('boot/leather_strap',[(x-.13,.126,z),(x-.075,.171,z-.002),(x+.08,.17,z-.002),(x+.145,.120,z)],.017,'boot_light')
    self.cube('boot/silver_buckle',(x+.050,.185,z),(.058,.016,.042),'silver',metal=.85)
    self.cube('boot/buckle_hole',(x+.057,.198,z),(.025,.014,.014),'shadow')
   for j in range(7):
    z=.185+j*.055
    self.tube('boot/laces',[(x-.026,.180,z),(x+.025,.180,z+.031)],.004,'silver_dark')
  # skirt undercorset and top with organic shape. V2 used box-like blocks.
  self.skirt()
  self.oval_loft('costume/tight_corset',[(1.18,.242,.195,-.02),(1.30,.211,.155,-.03),(1.48,.222,.180,-.025),(1.63,.263,.215,-.028),(1.79,.260,.195,-.025)],'corset',section=52)
  self.oval_loft('costume/lace_upper',[(1.65,.254,.204,-.02),(1.78,.257,.204,-.03),(1.875,.192,.151,-.05)],'lace',section=52)
  # Bust shaping follows torso, no protruding detached black spheres
  for sign in (-1,1):
   self.ell('costume/bust_seam',(sign*.112,.167,1.688),(.103,.066,.107),'corset',26)
   self.tube('costume/neckline',[(sign*.215,.122,1.820),(sign*.125,.230,1.740),(0,.235,1.772)],.008,'corset_panel')
  for z in (1.27,1.40,1.54):
   self.tube('costume/corset_belts',[(-.21,.121,z),(-.12,.182,z),(.03,.199,z),(.21,.115,z)],.023,'corset_panel')
   self.cube('costume/belt_buckle',(.02,.223,z),(.074,.015,.045),'silver',metal=.85)
   self.cube('costume/belt_insert',(.02,.233,z),(.035,.008,.021),'shadow')
  # hip chains draped across skirt, physically following fabric
  for zz in (1.19,1.15):
   pts=[]
   for j in range(35):
    t=j/34;x=-.26+t*.51
    sag=.11*math.sin(math.pi*t)
    pts.append((x,.175+.13*math.sin(math.pi*t),zz-.17*t-sag))
   self.tube('jewelry/hip_chain',pts,.006,'silver',metal=.86)
  # Arms + transparent impression of lace; relaxed at sides, dropped jacket sleeves.
  for sign in (-1,1):
   shoulder=(sign*.277,-.008,1.813);elbow=(sign*.360,.02,1.390);wrist=(sign*.418,.071,1.033)
   self.ell('anatomy/shoulder_cap',(sign*.278,-.010,1.791),(.115,.112,.120),'skin',28)
   self.cyl('anatomy/upper_arm',shoulder,elbow,.107,'skin',res=24)
   self.cyl('anatomy/forearm',elbow,wrist,.094,'skin',res=24)
   # mesh lace on upper arms: spiral crossing lines, fitted not huge cylindrical blocks
   for wind in (-1,1):
    for s in range(3):
     pts=[]
     for j in range(35):
      t=j/34;z=1.79-.36*t
      ang=wind*math.tau*1.3*t+math.tau*s/3
      x=sign*(.278+.07*t)+.107*math.cos(ang)
      y=.008+.106*math.sin(ang)
      pts.append((x,y,z))
     self.tube('costume/arm_lace_mesh',pts,.003,'lace_pattern',edges=6)
   self.ell('coat/off_shoulder_scrunch',(sign*.368,-.055,1.444),(.185,.184,.197),'coat',26)
   # baggy off-shoulder coats, dramatically folded and tapered at the wrist
   for k in range(3):
    t=k/2;z=1.34-.28*t
    self.ell('coat/bulky_drape',(sign*(.381+.015*t),-.037+.018*t,z),(.152-.016*t,.164-.014*t,.167),'coat' if k%2==0 else 'coat_fold',24)
   self.ell('coat/cuff',(sign*.421,.064,1.073),(.139,.137,.102),'coat_inner',24)
   self.ell('anatomy/hand',(sign*.434,.086,.952),(.081,.087,.137),'skin',24)
   # four slim fingers hang from wrist, fingers slightly separated
   for k in range(4):
    self.cyl('anatomy/finger',(sign*.434+(k-1.5)*.031,.128,.900),(sign*.434+(k-1.5)*.032,.146,.844-.008*abs(k-1.5)),.014,'skin',res=12)
   # longer draped jacket tails on back, vertically layered ribbons
   for k in range(3):
    x=sign*(.28+.046*k)
    pts=[(x,-.125,1.345),(x+sign*.034,-.165,.99),(x+sign*.055,-.19,.815-.056*k)]
    self.tube('coat/flowing_fold',pts,.022,'coat' if k%2==0 else 'coat_fold')
  self.cyl('anatomy/neck',(0,-.02,1.847),(0,-.018,2.004),.122,'skin',res=30)
  self.create_face();self.face_details();self.hair();self.jewelry()

# World axes +Z up +Y front, game camera uses south = front of character, +X screen right after image flip.
VIEWS=[('3/4 LEFT',45),('FRONT',0),('3/4 RIGHT',-45),('LEFT PROFILE',90),('BACK',180),('RIGHT PROFILE',-90)]

def render(model,yaw=0,elevation=10,sz=(530,860),transparent=True,scale=1.53,closeup=False):
 ren=vtk.vtkRenderer();ren.SetBackground(.94,.92,.91) if not transparent else ren.SetBackground(0,0,0)
 if transparent:ren.SetBackgroundAlpha(0)
 win=vtk.vtkRenderWindow();win.SetOffScreenRendering(True);win.SetAlphaBitPlanes(1);win.SetMultiSamples(8);win.SetSize(*sz);win.AddRenderer(ren)
 model.assembly.SetOrientation(0,0,yaw)
 ren.AddActor(model.assembly)
 cam=vtk.vtkCamera();ang=math.radians(elevation)
 if closeup:
  focal=(0,0,2.16);distance=4.5
  cam.SetPosition(0,distance*math.cos(ang),2.16+distance*math.sin(ang));cam.SetParallelScale(.47)
 else:
  focal=(0,0,1.36);distance=6.0
  cam.SetPosition(0,distance*math.cos(ang),1.36+distance*math.sin(ang));cam.SetParallelScale(scale)
 cam.SetFocalPoint(*focal);cam.SetViewUp(0,0,1);cam.ParallelProjectionOn();ren.SetActiveCamera(cam)
 for pos,intensity in [((-4,5,8),.97),((4,3,5),.42),((0,-5,7),.65)]:
  light=vtk.vtkLight();light.SetPosition(*pos);light.SetFocalPoint(*focal);light.SetIntensity(intensity);ren.AddLight(light)
 ren.SetUseFXAA(False);win.Render()
 f=vtk.vtkWindowToImageFilter();f.SetInput(win);f.SetInputBufferTypeToRGBA();f.ReadFrontBufferOff();f.Update()
 w,h=sz;arr=vtk_to_numpy(f.GetOutput().GetPointData().GetScalars()).reshape((h,w,4))
 im=Image.fromarray(arr[::-1].copy(),'RGBA').transpose(Image.Transpose.FLIP_LEFT_RIGHT)
 if transparent and im.getpixel((0,0))[3]!=0:raise RuntimeError('VTK offscreen alpha unavailable')
 ren.RemoveActor(model.assembly)
 return im

def backdrop(im,color='#edebea',shadow=True):
 out=Image.new('RGBA',im.size,color)
 if shadow:
  # subtle ground-level oval for a studio render, not part of export
  sh=Image.new('RGBA',im.size,(0,0,0,0));d=ImageDraw.Draw(sh)
  w,h=im.size;cx=w//2; y=int(h*.88);r=int(w*.17)
  d.ellipse([cx-r,y-13,cx+r,y+10],fill=(26,13,23,35));sh=sh.filter(ImageFilter.GaussianBlur(12));out.alpha_composite(sh)
 out.alpha_composite(im)
 return out.convert('RGB')

def font(size,bold=False):
 paths=['/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf' if bold else '/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf','/usr/share/fonts/truetype/liberation2/LiberationSans-Regular.ttf']
 for p in paths:
  if os.path.exists(p):return ImageFont.truetype(p,size)
 return ImageFont.load_default()

def export_glb(m):
 # No artificial triangulated 2D sprites; export the original 3D polydatasets.
 scene=trimesh.Scene();parts=defaultdict(list);counts={}
 for name,mat,poly,actor in m.parts:
  tri=vtk.vtkTriangleFilter();tri.SetInputData(poly);tri.Update();p=tri.GetOutput()
  if p.GetNumberOfPoints()<3 or p.GetNumberOfCells()<1:continue
  vertices=vtk_to_numpy(p.GetPoints().GetData()).reshape((-1,3)).astype(np.float32)
  faces=vtk_to_numpy(p.GetPolys().GetConnectivityArray()).reshape(-1,3).astype(np.int64)
  # Triangle filter guaranteed triangles. Coordinates are world-space already.
  prefix=name.split('/')[0]
  if name=='anatomy/continuous_face_and_nose':prefix='face'
  if name.startswith('face/lip'):prefix='lips'
  group=f'{prefix}_{mat}'
  parts[group].append((vertices,faces,mat))
 # Determine exact unscaled bounds to set meter scale, keeping feet on z=0.
 all_verts=np.vstack([v for subsets in parts.values() for v,_,_ in subsets]);
 raw_bottom=float(all_verts[:,2].min());raw_top=float(all_verts[:,2].max())
 scale_m=1.72/(raw_top-raw_bottom)
 for group,sections in parts.items():
  mat=sections[0][2]
  vv=[];ff=[];off=0
  for v,f,_ in sections:
   vv.append(v);ff.append(f+off);off+=len(v)
  v=np.vstack(vv);f=np.vstack(ff)
  v=v*scale_m;v[:,2]-=raw_bottom*scale_m
  mesh=trimesh.Trimesh(vertices=v,faces=f,process=False,validate=False)
  mesh.visual=trimesh.visual.TextureVisuals(material=trimesh.visual.material.PBRMaterial(name=mat,baseColorFactor=[*list((np.array(col(mat))*255).astype(int)),255],roughnessFactor=.58,metallicFactor=.85 if mat.startswith('silver') else .08))
  scene.add_geometry(mesh,node_name=group,geom_name=group)
  counts[group]={'parts':len(sections),'vertices':len(v),'triangles':len(f)}
 path=OUT/'sophia_saafiya_3d_v3_2_unrigged.glb';path.write_bytes(scene.export(file_type='glb'))
 return path,counts

def main():
 m=Studio()
 glb,counts=export_glb(m)
 # neutral full turntable and overhead game camera
 paths=[];views=[]
 for label,yaw in VIEWS:
  img=render(m,yaw,10,(450,790),transparent=True,scale=1.54)
  slug=label.lower().replace(' ','_').replace('/','_')
  img.save(OUT/f'sophia_{slug}_transparent.png')
  paths.append(f'sophia_{slug}_transparent.png')
  views.append(backdrop(img))
 # 3x2 view sheet
 W,H=450,790
 cv=Image.new('RGB',(W*3, (H+52)*2+90),'#eae8e6');d=ImageDraw.Draw(cv)
 d.text((30,15),'SOPHIA / SAAFIYA  |  HERO SHOOTER',font=font(31,True),fill='#291b29')
 d.text((30,57),'V3.2 · PROCEDURAL 3D RECONSTRUCTION · VTK / PYTHON · UNARMED NEUTRAL POSE',font=font(14),fill='#625664')
 for i,((label,_),im) in enumerate(zip(VIEWS,views)):
  x=(i%3)*W;y=90+(i//3)*(H+52)
  cv.paste(im,(x,y))
  d.text((x+22,y+H+9),label,font=font(21,True),fill='#241923')
  d.line([(x+14,y+H+43),(x+W-12,y+H+43)],fill='#bbb4b6',width=1)
 cv.save(OUT/'sophia_saafiya_v3_2_turnaround.png',optimize=True)
 # 4-view standard / plus game view
 front=render(m,0,8,(720,1110),scale=1.52)
 backdrop(front).save(OUT/'sophia_saafiya_v3_2_hero.png',optimize=True)
 game=render(m,0,58,(560,760),scale=1.52)
 backdrop(game,shadow=False).save(OUT/'sophia_saafiya_v3_2_game_camera.png',optimize=True)
 close=render(m,0,6,(650,740),closeup=True)
 backdrop(close,shadow=False).save(OUT/'sophia_saafiya_v3_2_face_closeup.png',optimize=True)
 # technical geometry audit independent import
 verify=trimesh.load(glb,force='scene',process=False)
 bounds=verify.bounds
 info={'character':'Sophia (Saafiya)', 'revision':'v3.2','reference':'saafiya_corrected_model_sheet_v2.png','baseline':'saafiya_true3d_modelsheet.py',
       'model':'sophia_saafiya_3d_v3_2_unrigged.glb','skeleton':'none; neutral A-pose static',
       'axes':'+Z up, +Y front, +X anatomical left; GLB metres, character precisely scaled to 1.72m standing height', 'height_m':float(bounds[1,2]-bounds[0,2]),
       'bounds_m':np.asarray(bounds).round(3).tolist(),'meshes':len(verify.geometry),
       'triangles':sum(len(g.faces) for g in verify.geometry.values()),'materials':counts,
       'views':[v[0] for v in VIEWS],'draw_method':'Python/Vtk geometry; trimesh GLB; no image generator',
       'limitations':['unrigged','facial mesh is sculpted procedurally but not deformation-ready','clothing/hair separately intersect visually rather than manifold seam weld','not yet audited for every attachment with BVH tests','the approved source is stylized; likeness is approximate']}
 (OUT/'sophia_saafiya_v3_2_audit.json').write_text(json.dumps(info,indent=2))
 print(json.dumps({k:v for k,v in info.items() if k!='materials'},indent=2))
 print('FILES:',*[str(p.name) for p in OUT.iterdir()],sep='\n')

if __name__=='__main__':main()