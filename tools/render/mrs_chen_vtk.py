#!/usr/bin/env python3
"""Hero Shooter Mrs. Chen — procedural VTK 3D model and 8-way atlas.
Approved reference: Mrs. Chen Hero Shooter Sprite Sheet.png; repo PR #30.
+Z up, model faces -Y in neutral pose. Game +Y points DOWN.
Model's VTK rotation degrees [S,SW,W,NW,N,NE,E,SE] = [0,-45,-90,-135,180,135,90,45].
GLB unrigged: pose frames produced from procedural limb pivots, not an armature.
"""
import math, json, time, zipfile
from pathlib import Path
from collections import defaultdict
import vtk,numpy as np,trimesh
from vtk.util.numpy_support import vtk_to_numpy
from PIL import Image,ImageDraw
O=Path(__file__).resolve().parent
P={'skin':'#DEA482','skin_shadow':'#BC8267','blush':'#CA8B7E','highlight':'#F4C7A0','hair':'#201922','hair2':'#33262D','hair3':'#5A3940','hairshine':'#8D5B54','qipao':'#251D26','qipao2':'#392833','panel':'#4E2A35','collar':'#221922','shawl':'#69253A','shawl2':'#86364A','shawlshade':'#42192C','shawlhi':'#AB5160','gold':'#C69443','goldhi':'#F3CA70','goldshade':'#8F662E','red':'#BD423C','redhi':'#E86752','reddark':'#7A2C32','eyes':'#F3DCCA','iris':'#34242B','ink':'#241F27','glasses':'#211F28','lens':'#92979A','lips':'#995452','shoe':'#30232A','sole':'#151419'}
def color(key):
 h=P.get(key,key).replace('#','');return tuple(int(h[i:i+2],16)/255 for i in (0,2,4))
def mat_color(key):return list(int(v*255) for v in color(key))+[255]
def poly(v,f):
 p=vtk.vtkPoints();cells=vtk.vtkCellArray()
 for a in v:p.InsertNextPoint(*map(float,a))
 for face in f:
  t=vtk.vtkTriangle()
  for i in range(3):t.GetPointIds().SetId(i,int(face[i]))
  cells.InsertNextCell(t)
 d=vtk.vtkPolyData();d.SetPoints(p);d.SetPolys(cells)
 normal=vtk.vtkPolyDataNormals();normal.SetInputData(d);normal.SplittingOff();normal.ConsistencyOn();normal.Update();return normal.GetOutput()
def gaussian(x,mean,sig):return math.exp(-.5*((x-mean)/sig)**2)
class Character:
 def __init__(self):
  self.root=vtk.vtkAssembly();self.groups={'body':self.root};self.parts=[]
  for g,xyz in [('arm_l',(-.214,0,1.27)),('arm_r',(.214,0,1.27)),('leg_l',(-.08,0,.864)),('leg_r',(.08,0,.864))]:
   a=vtk.vtkAssembly();a.SetPosition(*xyz);self.root.AddPart(a);self.groups[g]=a
 def add(self,source,name,material,group='body',spec=.16):
  m=vtk.vtkPolyDataMapper();
  if isinstance(source,vtk.vtkPolyData):m.SetInputData(source)
  else:m.SetInputConnection(source.GetOutputPort())
  a=vtk.vtkActor();a.SetMapper(m);p=a.GetProperty();p.SetColor(*color(material));p.SetAmbient(.34);p.SetDiffuse(.65);p.SetSpecular(spec);p.SetSpecularPower(28)
  self.groups[group].AddPart(a);self.parts.append((a,name,material,group));return a
 def ell(self,center,scales,material,name,group='body',res=24,rot=0):
  s=vtk.vtkSphereSource();s.SetRadius(1);s.SetPhiResolution(max(res-6,10));s.SetThetaResolution(res)
  a=self.add(s,name,material,group);a.SetPosition(*center);a.SetScale(*scales)
  if rot:a.RotateZ(rot)
  return a
 def cyl(self,p,q,r,material,name,group='body',res=14):
  p=np.asarray(p,dtype=float);q=np.asarray(q,dtype=float);d=q-p
  length=float(np.linalg.norm(d));s=vtk.vtkCylinderSource();s.SetRadius(r);s.SetHeight(length);s.SetResolution(res);s.CappingOn()
  a=self.add(s,name,material,group);trans=vtk.vtkTransform();trans.Translate(*(p+q)/2)
  norm=d/length;axis=np.cross([0,1,0],norm);dot=np.dot([0,1,0],norm)
  if np.linalg.norm(axis)>1e-6:trans.RotateWXYZ(math.degrees(math.acos(np.clip(dot,-1,1))),*axis)
  elif dot<0:trans.RotateWXYZ(180,1,0,0)
  a.SetUserTransform(trans);return a
 def cube(self,xyz,size,material,name,group='body'):
  s=vtk.vtkCubeSource();a=self.add(s,name,material,group);a.SetPosition(*xyz);a.SetScale(*size);return a
 def line(self,pts,r,material,name,group='body',sides=6):
  ps=vtk.vtkPoints();ls=vtk.vtkCellArray()
  for p in pts:ps.InsertNextPoint(*p)
  for j in range(len(pts)-1):
   l=vtk.vtkLine();l.GetPointIds().SetId(0,j);l.GetPointIds().SetId(1,j+1);ls.InsertNextCell(l)
  pd=vtk.vtkPolyData();pd.SetPoints(ps);pd.SetLines(ls)
  t=vtk.vtkTubeFilter();t.SetInputData(pd);t.SetRadius(r);t.SetNumberOfSides(sides);t.CappingOn();return self.add(t,name,material,group)
 def loft(self,rings,material,name,n=40):
  vert=[];faces=[]
  for i,(z,rx,ry,cy) in enumerate(rings):
   for j in range(n):
    t=2*math.pi*j/n;vert.append((rx*math.cos(t),cy+ry*math.sin(t),z))
    if i:
     a=(i-1)*n+j;b=(i-1)*n+(j+1)%n;cc=i*n+j;d=i*n+(j+1)%n
     faces.extend([(a,b,cc),(b,d,cc)])
  return self.add(poly(vert,faces),name,material)
 def ribbon(self,pts,widths,material,name):
  pts=np.asarray(pts,dtype=float);widths=np.asarray(widths,dtype=float)
  # C1 smooth Catmull–Rom curve with wavering cloth width and layered folds.
  dense=[];wlist=[]
  for i in range(len(pts)-1):
   p0=pts[max(0,i-1)];p1=pts[i];p2=pts[i+1];p3=pts[min(len(pts)-1,i+2)]
   for j in range(5):
    t=j/5;curve=.5*((2*p1)+(-p0+p2)*t+(2*p0-5*p1+4*p2-p3)*t*t+(-p0+3*p1-3*p2+p3)*t*t*t)
    dense.append(curve)
    wlist.append(float(widths[i]*(1-t)+widths[i+1]*t)*(1+.035*math.sin((i*5+j)*2.3)))
  dense.append(pts[-1]);wlist.append(widths[-1]);vs=[];fs=[]
  for i,(pt,w) in enumerate(zip(dense,wlist)):
   tan=dense[min(i+1,len(dense)-1)]-dense[max(0,i-1)]
   lateral=np.cross(tan,[0,1,0]);lateral/=np.linalg.norm(lateral)+1e-9
   vs.extend([pt-lateral*w/2,pt+lateral*w/2]);
   if i:
    j=2*i;fs.extend([(j-2,j-1,j),(j-1,j+1,j),(j,j-1,j-2),(j,j+1,j-1)])
  return self.add(poly(vs,fs),name,material)
 def pose(self,yaw=0,gait='idle',frame=0):
  self.root.SetOrientation(0,0,yaw);v=math.sin(frame*math.pi/2)
  e=0 if gait=='idle' else (1 if gait=='walk' else 1.45)
  # Four distinct stride phases: 0/2 are opposite support transfers, not duplicate poses.
  planted=0 if gait=='idle' else (4 if frame==0 else -4 if frame==2 else 0)
  for sign,suffix in [(1,'l'),(-1,'r')]:
   l=self.groups['leg_'+suffix];l.SetOrientation(0,0,0);l.RotateX(sign*(e*17*v+planted))
   a=self.groups['arm_'+suffix];a.SetOrientation(0,0,0);a.RotateX(-sign*(e*15*v+planted*.5))
  sway=0 if gait=='idle' else .004*e*math.cos(frame*math.pi/2)
  self.root.SetPosition(sway,0,(.003 if gait=='idle' and frame%2 else .026*e*abs(v)))

def continuous_face():
 # One continuous face with nose bridge/tip, philtrum, cheek contour, lips and chin integrated.
 vs=[];fs=[];n=80;h=48
 for k in range(h+1):
  theta=(k+1e-5)/(h+2e-5)*math.pi
  for j in range(n):
   phi=2*math.pi*j/n;xx=.128*math.sin(theta)*math.cos(phi);yy=.113*math.sin(theta)*math.sin(phi);zz=.184*math.cos(theta)
   if yy<-.012:
    projection=(.011*gaussian(xx,0,.025)*gaussian(zz,.014,.057)+
                .014*gaussian(xx,0,.021)*gaussian(zz,-.032,.018)+
                .006*gaussian(xx,0,.039)*gaussian(zz,-.084,.015)+
                .010*gaussian(xx,0,.044)*gaussian(zz,-.099,.012)+
                .007*(gaussian(xx,.072,.030)+gaussian(xx,-.072,.030))*gaussian(zz,-.047,.053))
    yy-=projection
   xx*=1-.12*gaussian(zz,-.12,.085)  # shaped jaw, not a perfect sphere
   vs.append([xx,yy-.019,zz+1.481])
   if k:
    a=(k-1)*n+j;b=(k-1)*n+(j+1)%n;c=k*n+j;d=k*n+(j+1)%n
    fs.extend([(a,c,b),(b,c,d)])
 return poly(vs,fs)
def front_surface(x,z):
 delta=z-1.481
 return -.019-.113*math.sqrt(max(.04,1-(x/.128)**2-(delta/.184)**2))-.017*gaussian(x,0,.025)*gaussian(delta,.014,.055)
def blossom(m,x,y,z,s):
 for k in range(5):
  a=k*2*math.pi/5
  m.ell((x+s*.48*math.cos(a),y,z+s*.48*math.sin(a)),(s*.55,s*.24,s*.42),'redhi' if k%2 else 'red','sakura_petals',res=18,rot=math.degrees(a))
 m.ell((x,y-.016,z),(s*.18,s*.2,s*.18),'goldhi','gold_pistil',res=12)

def build():
 m=Character()
 for g in ('leg_l','leg_r'):
  m.cyl((0,0,-.015),(0,.007,-.785),.045,'skin','continuous_bare_lower_leg',g,res=22)
  m.ell((0,-.055,-.811),(.054,.115,.035),'shoe','shoe_upper',g,res=28)
  m.ell((0,-.125,-.811),(.045,.066,.022),'sole','shoe_toecap',g)
  m.cyl((0,.036,-.77),(0,.036,-.860),.015,'sole','heel',g,res=12)
  m.line([(-.043,-.055,-.774),(0,-.015,-.746),(.043,-.055,-.774)],.0035,'goldshade','shoe_strap',g)
 # Qipao fit and hem.
 m.loft([(.278,.141,.129,-.008),(.37,.152,.135,-.008),(.56,.177,.143,-.008),(.82,.183,.155,-.008),(.94,.168,.135,-.008),
         (1.08,.160,.13,-.01),(1.22,.188,.137,-.01),(1.311,.192,.141,-.008),(1.345,.092,.082,-.008)],'qipao','fitted_qipao')
 m.ribbon([(-.023,-.149,1.322),(.046,-.148,1.244),(.063,-.147,1.129),(.058,-.157,1.034),(.058,-.153,.89),(.034,-.15,.65),(.025,-.134,.32)],
          [.06,.064,.055,.052,.056,.065,.063],'qipao2','front_qipao_panel')
 # Golden trim hem, side slit, high collar, frog closures.
 for z in [.283,.318]:
  m.line([(.142*math.cos(2*math.pi*i/72),-.008+.13*math.sin(2*math.pi*i/72),z) for i in range(73)],.0035,'gold','tailored_hem')
 for s in [-1,1]:m.line([(s*.139,-.008,.29),(s*.162,-.016,.43),(s*.180,-.017,.59)],.004,'goldhi','side_slit_trim')
 m.ell((0,-.012,1.376),(.069,.069,.078),'skin','neck',res=26)
 m.loft([(1.348,.080,.067,-.014),(1.411,.075,.063,-.013),(1.422,.070,.057,-.013)],'collar','mandarin_collar',n=36)
 m.line([(-.076,-.035,1.417),(-.064,-.074,1.398),(0,-.083,1.397),(.071,-.042,1.410)],.004,'goldhi','collar_piping')
 m.line([(-.02,-.152,1.321),(.045,-.159,1.255),(.057,-.159,1.213),(.035,-.154,1.177),(.049,-.154,1.118)],.0042,'gold','diagonal_qipao_placket')
 for x,z in [(0,1.321),(.037,1.275),(.052,1.234),(.033,1.182),(.048,1.131)]:
  y=-.160
  m.line([(x-.026,y,z),(x-.008,y-.006,z+.007),(x+.011,y-.004,z),(x+.027,y,z+.003)],.0033,'goldhi','frog_button_loops')
  m.ell((x+.028,y-.005,z),(.006,.005,.006),'goldhi','button_knots',res=12)
 # Real raised floral embroidery; no flat overlay texture used.
 motifs=[(-.070,1.156,.039),(.058,1.088,.026),(-.066,1.041,.038),(.071,.971,.040),(-.065,.861,.051),(.062,.778,.039),(-.060,.698,.045),(.068,.624,.045),(-.076,.544,.048),(.077,.492,.039),(-.061,.418,.043),(.045,.344,.035)]
 for x,z,s in motifs:
  y=-.164 if .55<z<1.05 else (-.151 if z>=1.05 else -.139)
  for k in range(5):
   a=math.pi*2*k/5
   m.ell((x+s*.52*math.cos(a),y-.001,z+s*.52*math.sin(a)),(s*.50,.006,s*.32), 'gold' if k%2 else 'goldhi','raised_embroidery_petals',res=16,rot=math.degrees(a))
  m.ell((x,y-.006,z),(.18*s,.007,.18*s),'goldhi','embroidered_flower_centers',res=12)
  m.line([(x,y,z),(x+.014,y,z-.026),(x+.025,y,z-.046)],.0035,'goldshade','embroidered_flower_stems')
  m.ell((x+.012,y,z-.029),(.011,.004,.005),'goldhi','embroidered_gilt_leaf',res=14,rot=25)
  m.ell((x+.023,y,z-.044),(.012,.004,.005),'gold','embroidered_gilt_leaf',res=14,rot=-20)
 # Raised curving vine-embroidery with tiny leaves, deliberately visible in top-down art.
 for vine in [
  [(-.102,-.126,1.206),(-.124,-.132,1.157),(-.118,-.141,1.100),(-.090,-.146,1.059)],
  [(.096,-.113,.94),(.107,-.130,.875),(.083,-.143,.813),(.055,-.153,.765)],
  [(-.108,-.115,.755),(-.121,-.126,.68),(-.107,-.141,.605),(-.080,-.149,.558)],
  [(.088,-.114,.557),(.109,-.118,.489),(.099,-.133,.411),(.061,-.146,.357)]]:
  m.line(vine,.0028,'goldhi','gold_floral_vines')
  for j in range(1,len(vine)-1):
   x,y,z=vine[j]
   m.ell((x-.010,y-.005,z+.010),(.012,.005,.005),'gold','sculpted_leaflets',res=14)
   m.ell((x+.010,y-.003,z-.009),(.012,.005,.005),'goldshade','sculpted_leaflets',res=14)
 # Shawl with layered fabric folds at sides, not baked into the qipao.
 m.ell((0,.060,1.229),(.218,.096,.085),'shawlshade','shawl_backfold',res=36)
 for side in [-1,1]:
  m.ribbon([(side*.183,-.012,1.268),(side*.218,-.09,1.216),(side*.244,-.114,1.079),
            (side*.268,-.094,.901),(side*.265,-.075,.758),(side*.237,-.07,.615)],
            [.13,.16,.155,.15,.124,.08],'shawl','flowing_burgundy_shawl')
  m.line([(side*.186,-.041,1.268),(side*.228,-.102,1.212),(side*.252,-.118,1.072),
          (side*.268,-.095,.9),(side*.262,-.073,.76)],.0035,'shawlhi','silk_fold_specular')
  m.line([(side*.208,-.015,1.233),(side*.235,-.087,1.156),(side*.256,-.098,1.011),
          (side*.260,-.080,.826),(side*.246,-.073,.675)],.003,'shawlshade','deep_shawl_folds')
 # Arms, cuffs, bracelets, fingers; pivotable groups at shoulder.
 for g,sgn in [('arm_l',-1),('arm_r',1)]:
  m.cyl((0,0,-.015),(sgn*.043,.009,-.215),.069,'shawl','silk_sleeves',g,res=22)
  m.ell((sgn*.043,-.010,-.160),(.080,.072,.150),'shawlshade','sleeve_folds',g,res=24)
  m.cyl((sgn*.050,.012,-.230),(sgn*.042,-.042,-.340),.047,'shawl','wrist_sleeves',g,res=22)
  m.line([(sgn*.09,-.041,-.314),(sgn*.046,-.076,-.347),(sgn*.003,-.043,-.339)],.0055,'gold','cuff_hem',g)
  m.ell((sgn*.048,-.04,-.408),(.040,.041,.068),'skin','hands',g,res=22)
  for j in range(4):
   x=sgn*(.024+j*.014);m.cyl((x,-.065,-.442),(x,-.075,-.470+abs(j-1)*.005),.007,'skin','fingers',g,res=9)
  m.line([(sgn*.095,-.025,-.37),(sgn*.080,-.07,-.373),(sgn*.021,-.068,-.374)],.004,'goldhi','gold_bracelet',g)
 # Face, eyes, confident restrained smile, age-appropriate skin tone.
 m.add(continuous_face(),'continuous_anatomical_face','skin')
 for sgn in [-1,1]:
  # No sticker-like cheek spheres: blush is omitted rather than detached.
  m.ell((sgn*.136,-.008,1.47),(.018,.023,.044),'skin','integrated_ears',res=20)
  eye_x=sgn*.054;eye_y=front_surface(eye_x,1.50)-.004
  m.ell((eye_x,eye_y,1.498),(.027,.0032,.0075),'eyes','narrow_almond_eyes',res=18)
  m.ell((eye_x,eye_y-.005,1.496),(.009,.003,.0085),'iris','dark_iris',res=16)
  m.ell((eye_x-.002,eye_y-.01,1.5),(.003,.002,.004),'highlight','eye_reflection',res=10)
  m.line([(eye_x-sgn*.027,eye_y,1.513),(eye_x,eye_y-.003,1.518),(eye_x+sgn*.023,eye_y,1.511)],.0032,'hair','upper_eyelashes')
  m.line([(eye_x-sgn*.027,eye_y+.005,1.541),(eye_x,eye_y,1.545),(eye_x+sgn*.024,eye_y+.003,1.54)],.0042,'hair2','shaped_eyebrows')
  m.ell((sgn*.147,-.015,1.401),(.008,.01,.022),'goldhi','gold_drop_earring',res=16)
  m.line([(sgn*.145,-.015,1.45),(sgn*.150,-.017,1.429),(sgn*.147,-.018,1.421)],.003,'gold','earring_attachment')
 # Nose shape is sculpted into the continuous facial surface; no disconnected nostril bead.
 m.line([(-.022,-.133,1.391),(-.01,-.137,1.388),(0,-.138,1.387),(.011,-.135,1.390),(.022,-.130,1.392)],.0021,'lips','small_confident_smile')
 # Hair crown with interlocked full bun, hair strand geometry, long cheek wisps.
 m.ell((0,.013,1.588),(.143,.120,.122),'hair2','fitted_crown',res=42)
 m.ell((0,.067,1.567),(.140,.098,.144),'hair','dark_back_hair',res=36)
 m.ell((-.018,-.049,1.600),(.127,.085,.069),'hair2','swept_fringes',res=38)
 for k in range(11):
  xx=-.124+k*.024
  m.line([(xx*.50-.02,-.111,1.652-abs(xx)*.1),(xx*.8-.01,-.116,1.619-abs(xx)*.14),
          (xx,-.107,1.578-abs(xx)*.18)],.0025 if k%2 else .0032,'hair3' if k%3==0 else 'hair2','swept_hair_fibres')
 m.ell((.015,.130,1.605),(.103,.092,.089),'hair2','attached_bun',res=40)
 for k in range(13):
  ang=2*math.pi*k/13;radius=.073
  xx=.015+radius*.92*math.cos(ang);zz=1.610+radius*.88*math.sin(ang)
  m.line([(xx,.196,zz),(.015+(xx-.015)*.65,.218,1.610+(zz-1.610)*.65),(.015,.227,1.610)],.0052,
         'hair3' if k%3==0 else 'hair2','bun_interwoven_strands')
 for s in (-1,1):
  m.line([(s*.123,-.035,1.599),(s*.137,-.068,1.542),(s*.142,-.081,1.484),(s*.127,-.082,1.435)],.0047,'hair3','loose_long_face_framing_strands')
  m.line([(s*.128,-.052,1.567),(s*.150,-.069,1.514),(s*.141,-.068,1.465)],.0027,'hairshine','silk_hair_highlights')
 # Proper rectangular glasses conform to eye height; frame, bridge, temples.
 for s in (-1,1):
  cx=s*.055;yy=front_surface(cx,1.501)-.024;ww=.059
  corners=[(cx-ww/2,yy,1.482),(cx+ww/2,yy,1.482),(cx+ww/2,yy,1.522),
           (cx-ww/2,yy,1.522),(cx-ww/2,yy,1.482)]
  m.line(corners,.0028,'glasses','rectangular_eyeglass_frames',sides=8)
  lens=m.cube((cx,yy+.003,1.501),(.051,.0015,.033),'lens','subtle_tinted_lenses');lens.GetProperty().SetOpacity(.13)
  m.line([(cx+s*ww/2,yy,1.509),(s*.129,-.081,1.509),(s*.153,-.01,1.509)],.0033,'glasses','eyeglass_temple_arms')
  m.ell((cx+s*ww/2,yy,1.509),(.004,.005,.004),'goldshade','eyeglass_hinge',res=12)
 m.line([(-.025,-.155,1.51),(0,-.163,1.51),(.025,-.155,1.51)],.0035,'glasses','eyeglass_bridge')
 # Hair ornaments: red floral clips, gold pins, dangling tassels physically attached.
 blossom(m,-.127,-.062,1.650,.044);blossom(m,-.148,-.045,1.612,.037);blossom(m,-.083,-.056,1.679,.026)
 for i in range(3):
  a=(-.140+i*.013,-.046,1.632);b=(-.190+i*.011,-.039,1.681)
  m.cyl(a,b,.0038,'goldhi','hairpin_sticks',res=10)
  m.ell(b,(.007,.007,.007),'goldhi','hairpin_finials',res=10)
  xx=-.145+i*.020
  m.line([(xx,-.049,1.629),(xx-.006,-.058,1.583),(xx+.004,-.048,1.540)],.0025,'gold','hair_ornament_tassels')
  m.ell((xx+.004,-.050,1.535),(.005,.005,.012),'goldhi','tassel_droplets',res=12)
 return m
DIR=[('S',0,90,'front'),('SW',-45,135,'front-quarter-left'),('W',-90,180,'left-profile'),('NW',-135,225,'back-quarter-left'),('N',180,270,'back'),('NE',135,315,'back-quarter-right'),('E',90,0,'right-profile'),('SE',45,45,'front-quarter-right')]

def renderer(m,view='game',size=(320,480),alpha=True):
 r=vtk.vtkRenderer();r.SetBackground(.065,.06,.09)
 if alpha:r.SetBackgroundAlpha(0)
 r.AddActor(m.root)
 win=vtk.vtkRenderWindow();win.SetSize(*size);win.SetMultiSamples(0);win.SetAlphaBitPlanes(1);win.SetOffScreenRendering(True);win.AddRenderer(r)
 cam=r.GetActiveCamera();cam.ParallelProjectionOn();cam.SetViewUp(0,0,1)
 opts={'game':((0,-6,4.0),(0,0,.85),1.17),'front':((0,-5,2.06),(0,0,.9),1.12),
       'threequarter':((-4,-6,3.24),(0,0,.9),1.18),'profile':((-6,0,2.05),(0,0,.9),1.12),
       'back':((0,6,2.05),(0,0,.9),1.12),'overhead':((0,-1,7),(0,0,.87),1.17)}
 pos,foc,scale=opts[view];cam.SetPosition(*pos);cam.SetFocalPoint(*foc);cam.SetParallelScale(scale)
 for xyz,intensity,rgb in [((-3,-4,7),1.,(1,.87,.75)),((4,2,6),.74,(.75,.82,1)),((2,-4,3),.4,(1,.8,.7))]:
  l=vtk.vtkLight();l.SetPosition(*xyz);l.SetFocalPoint(0,0,1);l.SetIntensity(intensity);l.SetColor(*rgb);r.AddLight(l)
 r.ResetCameraClippingRange();return win

def shot(win,rgba=True):
 win.Render();f=vtk.vtkWindowToImageFilter();f.SetInput(win);f.ReadFrontBufferOff()
 f.SetInputBufferTypeToRGBA() if rgba else f.SetInputBufferTypeToRGB();f.Update()
 pic=f.GetOutput();d=pic.GetDimensions();a=vtk_to_numpy(pic.GetPointData().GetScalars()).reshape(d[1],d[0],-1)
 return Image.fromarray(np.flipud(a).copy())

def glb_export(m):
 m.pose();material_faces=defaultdict(lambda:[[],[]]);vtotal=tcount=0
 for actor,name,material,group in m.parts:
  mapper=actor.GetMapper();mapper.Update();data=mapper.GetInput()
  tf=vtk.vtkTriangleFilter();tf.SetInputData(data);tf.Update();pd=tf.GetOutput()
  if pd.GetNumberOfPolys()==0:continue
  v=vtk_to_numpy(pd.GetPoints().GetData()).astype(np.float64)
  f=vtk_to_numpy(pd.GetPolys().GetData()).reshape(-1,4)[:,1:].astype('int64')
  ma=actor.GetMatrix();A=np.array([[ma.GetElement(i,j) for j in range(4)] for i in range(4)])
  v=trimesh.transform_points(v,A)
  if group!='body':
   ma=m.groups[group].GetMatrix();B=np.array([[ma.GetElement(i,j) for j in range(4)] for i in range(4)])
   v=trimesh.transform_points(v,B)
  geom=material_faces[material];shift=sum(len(s) for s in geom[0]);geom[0].append(v.astype('f4'));geom[1].append(f+shift)
  vtotal+=len(v);tcount+=len(f)
 scene=trimesh.Scene()
 for material,(vs,faces) in material_faces.items():
  obj=trimesh.Trimesh(vertices=np.concatenate(vs),faces=np.concatenate(faces),process=False)
  obj.visual=trimesh.visual.TextureVisuals(material=trimesh.visual.material.PBRMaterial(name=material,baseColorFactor=mat_color(material),metallicFactor=.7 if 'gold' in material else .025,roughnessFactor=.34 if 'gold' in material else .76,doubleSided=True))
  scene.add_geometry(obj,node_name='Mrs_Chen_'+material)
 scene.export(str(O/'mrs_chen_unarmed_vtk.glb'))
 check=trimesh.load(str(O/'mrs_chen_unarmed_vtk.glb'),force='scene')
 audit={'person':'Mrs Chen','source':'approved sprite sheet / Hero Shooter PR #30',
        'asset_status':'unrigged static GLB with separately generated 3D pose animations for 2D atlas',
        'mesh_vertices':vtotal,'triangles':tcount,'vtk_components':len(m.parts),'material_meshes':len(check.geometry),
        'materials':list(material_faces),'bounds_m':np.asarray(check.bounds).round(4).tolist(),
        'height_m':round(float(check.bounds[1][2]-check.bounds[0][2]),3),'vtk_version':vtk.vtkVersion.GetVTKVersion()}
 (O/'geometry_audit.json').write_text(json.dumps(audit,indent=2));return audit

def studio(m):
 views=['front','threequarter','profile','back','overhead'];montage=Image.new('RGB',(450*3,580*2),(25,22,31))
 for i,view in enumerate(views):
  m.pose();win=renderer(m,view,(450,580),alpha=False);im=shot(win,False)
  dr=ImageDraw.Draw(im);dr.rectangle((0,0,450,45),fill=(28,23,32));dr.text((18,15),view.upper(),fill=(245,211,156))
  im.save(O/f'mrs_chen_{view}.png');montage.paste(im,(i%3*450,i//3*580));win.Finalize()
 ref=Path('/mnt/data/mrs_chen_sources/Mrs. Chen Hero Shooter Sprite Sheet.png')
 if ref.exists():
  r=Image.open(ref).convert('RGB').crop((0,90,270,1000));r.thumbnail((350,500))
  montage.paste(r,(945,640));ImageDraw.Draw(montage).text((960,605),'APPROVED REFERENCE',fill=(245,211,156))
 montage.save(O/'mrs_chen_5_view_comparison.png')

def atlas(m):
 win=renderer(m,'game',(256,384),alpha=True)
 hi=Image.new('RGBA',(128*8,192*12),(0,0,0,0));sm=Image.new('RGBA',(32*8,48*12),(0,0,0,0));qa=[];metadata=[]
 for state,gait in enumerate(['idle','walk','run']):
  for frame in range(4):
   for col,(heading,yaw,angle,visible) in enumerate(DIR):
    m.pose(yaw,gait,frame);im=shot(win,True).resize((128,192),Image.Resampling.LANCZOS)
    hi.alpha_composite(im,(col*128,(state*4+frame)*192))
    sm.alpha_composite(im.resize((32,48),Image.Resampling.LANCZOS),(col*32,(state*4+frame)*48))
    if state==0 and frame==0:qa.append(im)
    metadata.append({'gait':gait,'row':state*4+frame,'direction':heading,'col':col,'screen_angle_deg':angle,'yaw_3d_deg':yaw,'visible':visible})
  print('Rendered',gait,flush=True)
 hi.save(O/'mrs_chen_vtk_atlas_4x.png');sm.save(O/'mrs_chen_vtk_atlas_32x48.png')
 review=Image.new('RGB',(8*145,250),(28,24,37));d=ImageDraw.Draw(review)
 for i,img in enumerate(qa):
  bg=Image.new('RGB',(128,192),(40,34,45));bg.paste(img,(0,0),img)
  review.paste(bg,(145*i+7,45));d.text((145*i+12,18),DIR[i][0]+f' / {DIR[i][2]} deg',fill=(241,200,137))
 review.save(O/'mrs_chen_direction_QA.png');win.Finalize()
 meta={'character':'Mrs Chen','basis':'hero-sprite-bearings contract','screen_x':'+right','screen_y':'+down','angles':'clockwise from east 0 deg',
       'columns':['S','SW','W','NW','N','NE','E','SE'],'rows':'0-3 idle; 4-7 walk; 8-11 run','cell':[32,48],
       'glb_animation':'unrigged; atlas frames posed directly in VTK','frames':metadata}
 (O/'sprite_metadata.json').write_text(json.dumps(meta,indent=2))
 al=np.asarray(sm.getchannel('A'));occupied=[int(np.count_nonzero(al[row*48:(row+1)*48,col*32:(col+1)*32]>24)) for row in range(12) for col in range(8)]
 assert sm.size==(256,576) and hi.size==(1024,2304) and min(occupied)>20
 (O/'sprite_validation.json').write_text(json.dumps({'directions':8,'gaits':3,'frames_per_gait':4,'total_cells':96,'min_filled_pixels':min(occupied),'max_filled_pixels':max(occupied),'valid':True},indent=2))

README='''# Mrs. Chen — Hero Shooter detailed procedural VTK model

**Source of truth:** The approved *Mrs. Chen Hero Shooter Sprite Sheet.png* (shop owner / matriarch) and Hero Shooter PR #30. This is **Mrs. Chen, not C**: Mrs. Chen's glasses, dark coiffed bun with red flowers, gold hairpins and earrings, black-and-maroon traditional qipao with raised gold floral embroidery, dark shoes, and burgundy silk shawl all come from her approved sprite-sheet reference.

**Real 3D geometry:** fitted 3D body and dress, textured-looking sculpted strands on bun, rendered face with continuous integrated nose/lips, actual rectangular glasses frames and temples, flower petals, gold ornaments and textile seams. Built procedurally in VTK; no image planes, cards, photograph wrapping or raster model shortcuts.

**Files:**
- `mrs_chen_unarmed_vtk.glb`: GLB neutral standing pose, world +Z up, front -Y, metres.
- `mrs_chen_5_view_comparison.png`: front, three-quarter, left profile, back, overhead and source artwork inset.
- `mrs_chen_direction_QA.png`: labeled eight-way orientation visual check.
- `mrs_chen_vtk_atlas_32x48.png`: 256×576 transparent standard 8×12 sprite atlas.
- `mrs_chen_vtk_atlas_4x.png`: 1024×2304 higher-resolution sprite atlas.
- `sprite_metadata.json`, `geometry_audit.json`, `sprite_validation.json`: orientation and geometry QA.
- `build_mrs_chen_vtk.py`: editable source, run `xvfb-run -a python build_mrs_chen_vtk.py` with `vtk`, `numpy`, `Pillow`, `trimesh`.

**Bearing contract:** Canvas origin top-left, +X right, +Y down; zero East, clockwise positive. Columns `[S, SW, W, NW, N, NE, E, SE]`, south/front and north/back; idle rows 0–3, walking 4–7, running 8–11. No frame is mirrored to fake another direction.

**Integration/limitations:** This is a new **candidate** for artistic review. GLB is **unrigged**; walk/run legs and arms are procedurally rotated inside VTK to render the atlas, not authored skeletal animations or a reusable armature. At native 32×48, some gold embroidery necessarily collapses to a few pixels; inspect both scales. The existing PR #30 atlas and any approved 2D art are left unchanged. An integration PR should explicitly replace the existing `family-mother` atlas and run `npm run check`, `npm test`, `npm run build` only after art approval.
'''
def main():
 t=time.time();m=build();print('Generated VTK components',len(m.parts),flush=True)
 audit=glb_export(m);print('GLB triangles',audit['triangles'],flush=True)
 studio(m);print('Five-view geometry QA rendered',flush=True)
 atlas(m);(O/'README.md').write_text(README)
 with zipfile.ZipFile(O/'mrs_chen_vtk_asset_pack.zip','w',compression=zipfile.ZIP_DEFLATED) as z:
  for p in sorted(O.iterdir()):
   if p.is_file() and p.name!='mrs_chen_vtk_asset_pack.zip':z.write(p,p.name)
 print('COMPLETE',round(time.time()-t,1),'seconds',flush=True)
if __name__=='__main__':main()