#!/usr/bin/env python3
"""Hero Shooter C — neutral unarmed, poseable-inspired static 3D reference.
Geometry constructed using VTK sources and explicit vtkPolyData surface meshes.
Coordinate convention: +Z up, front faces -Y, +X is model's left when viewed from front.
Units: metres. Export: GLB/OBJ/STL (triangulated), turntable and four views.
"""
import os, math, json
from pathlib import Path
from collections import defaultdict
import numpy as np
import vtk
from vtk.util.numpy_support import vtk_to_numpy
from PIL import Image, ImageDraw, ImageFont
import trimesh
from face_texture_v3 import build_texture_variants
from scipy.interpolate import PchipInterpolator

OUT=str(Path(__file__).resolve().parent / 'C_unarmed_VTK_v3')
FACE_TEXTURES = build_texture_variants(OUT)
os.makedirs(OUT,exist_ok=True)
# PBR-inspired palette matching approved artwork
C={
'skin':('#C88A67',0.99),'skinshadow':('#A87051',1),'freckles':('#9E654D',1),
'eye_white':('#E7D1B8',1),'iris':('#5B362E',1),'pupil':('#1C171B',1),'eyelash':('#241819',1),
'lip':('#8F4F49',1),'teeth':('#EFDBCE',1),
'hair':('#672F24',1),'hairmid':('#843F2C',1),'hairglow':('#AF623B',1),'hairdark':('#3B2223',1),
'headband':('#E8DECE',1),'flower':('#F0E7D9',1),'flowermid':('#D4B45E',1),'silver':('#9EA8AA',1),
'jacket':('#322F38',1),'jacket2':('#443C43',1),'jacketshadow':('#252830',1),
'olive':('#75694C',1),'olive2':('#988360',1),'tan':('#B8A17A',1),'tanedge':('#54473E',1),
'vest':('#51483B',1),'vestshadow':('#37372E',1),'webbing':('#B6A07A',1),
'black':('#1F2129',1),'glove':('#272830',1),'glove2':('#3C3A3E',1),
'cargo':('#302D35',1),'cargo2':('#454149',1),'cargohilight':('#5D5050',1),
'armor':('#968069',1),'armorshade':('#655B54',1),'armorlight':('#B5A08A',1),
'boots':('#3B302C',1),'bootpanel':('#574338',1),'bootsole':('#201F20',1),'laces':('#B49A81',1),
'patch':('#D2A13F',1),'scarf_white':('#DCD2C6',1),'scarf_grey':('#A9A3A4',1),'scarf_dark':('#26252B',1)
}
meshes=defaultdict(list)


def colrgb(c):
 h=C[c][0].lstrip('#');return np.array([int(h[i:i+2],16) for i in (0,2,4)],dtype=np.uint8)


def append(c,p):
 if p is not None and p.GetNumberOfPoints()>=3:meshes[c].append(p)


def transformed(source,pos=(0,0,0),scale=(1,1,1),rotation=None):
 t=vtk.vtkTransform();t.Translate(*[float(v) for v in pos]);
 if rotation:
  angle,axis=rotation;t.RotateWXYZ(float(angle),*[float(v) for v in axis])
 t.Scale(*[float(v) for v in scale]);f=vtk.vtkTransformPolyDataFilter();f.SetInputConnection(source.GetOutputPort());f.SetTransform(t);f.Update();return f.GetOutput()


def ell(c,pos,sc,res=22):
 s=vtk.vtkSphereSource();s.SetRadius(1);s.SetThetaResolution(res);s.SetPhiResolution(max(12,res-4));append(c,transformed(s,pos,sc))


def box(c,pos,sc,rounded=False):
 if rounded:
  src=vtk.vtkSuperquadricSource();src.SetThetaResolution(24);src.SetPhiResolution(20);src.SetSize(1);src.SetThetaRoundness(.23);src.SetPhiRoundness(.24)
  append(c,transformed(src,pos,(sc[0],sc[1],sc[2])))
 else:
  src=vtk.vtkCubeSource();src.SetXLength(sc[0]*2);src.SetYLength(sc[1]*2);src.SetZLength(sc[2]*2);append(c,transformed(src,pos))


def polygon(c,pts,faces=None):
 p=vtk.vtkPoints();p.SetDataTypeToDouble()
 for pt in pts:p.InsertNextPoint(*[float(v) for v in pt])
 pd=vtk.vtkPolyData();pd.SetPoints(p);cells=vtk.vtkCellArray()
 if faces is None:faces=[list(range(len(pts)))]
 for face in faces:
  poly=vtk.vtkPolygon();poly.GetPointIds().SetNumberOfIds(len(face))
  for j,i in enumerate(face):poly.GetPointIds().SetId(j,int(i))
  cells.InsertNextCell(poly)
 pd.SetPolys(cells);append(c,pd)


def quads(c,pts):polygon(c,pts)


def between(c,a,b,r0,r1=None,depth_scale=1,n=16):
 """Construct an elliptic tapered sweep between endpoints in VTK."""
 a=np.array(a,dtype=float);b=np.array(b,dtype=float);v=b-a;lv=np.linalg.norm(v)
 if lv<1e-5:return
 axis=v/lv
 ref=np.array([0,1,0],float) if abs(axis[1])<.95 else np.array([0,0,1],float)
 e1=np.cross(axis,ref);e1/=np.linalg.norm(e1);e2=np.cross(axis,e1);e2/=np.linalg.norm(e2)
 if r1 is None:r1=r0
 pts=[]
 for center,r in [(a,r0),(b,r1)]:
  for k in range(n):
   ang=2*np.pi*k/n
   pts.append(tuple(center + r*(math.cos(ang)*e1+math.sin(ang)*e2*depth_scale)))
 faces=[]
 for k in range(n):faces.append([k,(k+1)%n,n+(k+1)%n,n+k])
 faces.append(list(reversed(range(n))));faces.append(list(range(n,2*n)))
 polygon(c,pts,faces)


def strand(c,points,radii,aspect=1,n=9):
 """Swept variable-radius tube on polyline (VTK polydata)."""
 pts=[];faces=[]
 q=np.asarray(points,float)
 for i,center in enumerate(q):
  tan=q[min(i+1,len(q)-1)]-q[max(i-1,0)]
  norm=np.linalg.norm(tan)
  if norm<1e-8:tan=np.array([0,0,1.]);norm=1
  tan=tan/norm
  ref=np.array([0,1.,0]) if abs(tan[1])<.9 else np.array([0.,0,1.])
  e1=np.cross(tan,ref);e1/=max(np.linalg.norm(e1),1e-10)
  e2=np.cross(tan,e1)
  for k in range(n):
   a=2*math.pi*k/n
   pt=center+radii[i]*(math.cos(a)*e1+math.sin(a)*aspect*e2)
   pts.append(pt)
  if i:
   for k in range(n):faces.append([(i-1)*n+k,(i-1)*n+(k+1)%n,i*n+(k+1)%n,i*n+k])
 faces.extend([list(range(n-1,-1,-1)),list(range((len(q)-1)*n,len(q)*n))])
 polygon(c,pts,faces)


def arc(c,center,rx,rz,y,a0,a1,r=.005,n=12):
 th=np.linspace(a0,a1,n)
 q=[(center[0]+rx*np.cos(t),y,center[2]+rz*np.sin(t)) for t in th]
 strand(c,q,[r]*n,1,n=7)


def plane_ellipse(c,pos,rx,rz,depth=.006):
 """A thin extrusion with +Y normal, facing viewer along -Y."""
 a=np.linspace(0,2*math.pi,20,endpoint=False)
 upper=[(pos[0]+rx*math.cos(t),pos[1]-depth/2,pos[2]+rz*math.sin(t)) for t in a]
 lower=[(x,pos[1]+depth/2,z) for x,y,z in upper]
 pts=upper+lower;faces=[];n=len(upper)
 faces += [list(range(n-1,-1,-1)),list(range(n,2*n))]
 faces += [[i,(i+1)%n,(i+1)%n+n,i+n] for i in range(n)]
 polygon(c,pts,faces)

# Body: anatomically structured anime proportions with neutral arms down.
# Overall height incl hair ~2.03; eye level ~1.75. Ground at z=0.
# pelvis and torso
ell('jacketshadow',(0,.025,1.14),(.224,.122,.245),26)
# jacket torso loft from narrow waist to shoulders and collar
bodyrings=[(.994,.213,.115), (1.085,.217,.123), (1.225,.247,.134), (1.358,.285,.145), (1.44,.217,.109), (1.495,.13,.098)]
pts=[];faces=[];n=30
for z,wx,dy in bodyrings:
 for k in range(n):
  a=2*math.pi*k/n
  pts.append((wx*math.cos(a),.035+dy*math.sin(a),z))
for j in range(len(bodyrings)-1):
 for k in range(n):faces.append([j*n+k,j*n+(k+1)%n,(j+1)*n+(k+1)%n,(j+1)*n+k])
faces += [list(range(n-1,-1,-1)),list(range((len(bodyrings)-1)*n,len(bodyrings)*n))]
polygon('jacket',pts,faces)
# collar and upper dark under-vest
ell('vestshadow',(0,-.129,1.303),(.235,.045,.162),24)
ell('vest',(0,-.157,1.286),(.197,.040,.145),26)
# waist belt & buckle
box('black',(0,-.018,1.011),(.246,.137,.035),rounded=True)
box('olive2',(0,-.143,1.016),(.044,.016,.026),rounded=True)
box('black',(0,-.160,1.018),(.021,.018,.015),rounded=True)
# seams along jacket panels
for x in [-.21,.21]:
 strand('jacket2',[(x,-.120,1.10),(x*1.13,-.123,1.25),(x*1.25,-.091,1.37)],[.008,.008,.006],n=7)
# shoulder arms are straight, relaxed at sides, elbows softly articulated
for s in [-1,1]:
 ell('jacket',(s*.273,.025,1.389),(.105,.128,.109),24)
 # upper sleeve taper and slight side drop
 between('jacket2',(s*.293,.030,1.366),(s*.323,.020,1.146),.091,.072,1.1)
 ell('jacket2',(s*.326,.020,1.155),(.074,.080,.062),18)
 # rolled sleeve hem
 between('jacket',(s*.321,.014,1.183),(s*.325,.011,1.144),.077,.075)
 between('jacketshadow',(s*.320,.014,1.160),(s*.327,.011,1.146),.078,.078)
 # exposed forearms to glove: pinkish natural skin
 between('skin',(s*.33,.006,1.135),(s*.337,-.017,.951),.059,.046)
 ell('skin',(s*.333,.001,1.128),(.06,.066,.052),20)
 # wristband / fingerless glove palm
 between('glove',(s*.337,-.017,.956),(s*.338,-.025,.901),.050,.047)
 ell('glove2',(s*.338,-.022,.893),(.045,.047,.057),18)
 # relaxed fingers pointing down, visible when viewed face on
 for k in range(4):
  fx=s*(.311+.018*k)
  strand('skin',[(fx,-.063,.878),(fx+s*.005,-.066,.839-k*.004)], [.013,.010], n=9)
 # left/right thumbs toward midline
 strand('skin',[(s*.296,-.050,.925),(s*.287,-.067,.888),(s*.29,-.057,.864)],[.014,.013,.011],n=9)
 # glove finger supports / trims
 for x in [.31,.33,.35]:
  box('black',(s*x,-.058,.913),(.008,.007,.029),rounded=True)
 # rolled cuffs stitched
 for dz in [1.157,1.182]:
  arc('jacketshadow',(s*.325,0,dz),.077,.01,-.073,0,math.pi,r=.003,n=9)

# Legs: two pant legs with realistic width and slight bends; cargo folds.
for s in [-1,1]:
 # hips and upper trouser
 ell('cargo',(s*.132,.027,.995),(.129,.121,.13),24)
 leg=[(s*.132,.018,.983),(s*.148,-.003,.852),(s*.151,.005,.706),(s*.158,-.009,.573),(s*.166,-.016,.444),(s*.172,-.027,.303),(s*.176,-.036,.190)]
 rr=[.123,.117,.111,.109,.105,.099,.091]
 strand('cargo',leg,rr,aspect=1.01,n=19)
 # layer angular folds, at successive points (overlap intentional)
 for z,x,y in [(.886,.148,-.104),(.780,.14,-.111),(.653,.15,-.106),(.405,.17,-.099),(.283,.174,-.095)]:
  strand('cargo2',[(s*(x-.045),y+.007,z+.009),(s*x,y-.013,z),(s*(x+.045),y+.015,z-.009)],[.009,.011,.007],n=7)
 # thigh cargo pouch on outer sides
 box('cargo2',(s*.236,-.02,.785),(.074,.073,.119),rounded=True)
 box('jacketshadow',(s*.245,-.084,.847),(.07,.015,.022),rounded=True)
 box('tanedge',(s*.245,-.101,.838),(.024,.005,.009))
 # webbing strap above and below thigh pouch
 for z in [.826,.712]:
  box('tanedge',(s*.222,-.07,z),(.11,.013,.012),rounded=True)
  box('olive2',(s*.235,-.084,z),(.015,.007,.016),rounded=True)
 # knee pads forward-facing (-Y), not flattened stickers
 ell('armorshade',(s*.157,-.11,.541),(.096,.035,.110),24)
 ell('armor',(s*.158,-.138,.548),(.080,.034,.094),24)
 ell('armorlight',(s*.16,-.163,.550),(.062,.011,.070),18)
 for xx in [-.052,.052]:
  ell('tanedge',(s*.16+xx,-.171,.556),(.006,.006,.006),10)
 # knee securing straps partially visible on both sides
 for z in [.49,.587]:
  box('olive',(s*.16,-.084,z),(.111,.023,.015),rounded=True)
 # boot with sole and toe projecting forward toward -Y
 ell('bootsole',(s*.177,-.074,.077),(.105,.168,.061),24)
 ell('boots',(s*.177,-.050,.125),(.101,.144,.107),26)
 ell('bootpanel',(s*.177,-.099,.152),(.087,.109,.060),24)
 between('boots',(s*.176,-.021,.199),(s*.175,-.02,.320),.090,.077,1.0)
 for z in [.239,.282]:
  box('bootpanel',(s*.179,-.115,z),(.078,.018,.016),rounded=True)
 # front boot toe cap and sidepanel
 ell('bootpanel',(s*.178,-.161,.102),(.087,.066,.038),24)
 # laces along anterior boot shaft, crossed on each row
 for z in np.linspace(.195,.295,6):
  for sign in [-1,1]:
   x=s*.175+sign*.030
   strand('laces',[(x,-.103,z+.008),(s*.175-sign*.030,-.121,z-.008)],[.003,.003],n=6)
 # side boot heel pulling tab
 box('black',(s*.17,.080,.295),(.037,.012,.037),rounded=True)

# Chest harness: two crossed olive straps + buckle straps and MOLLE horizontal bands.
for s in [-1,1]:
 strand('olive',[(s*.09,-.045,1.479),(s*.187,-.144,1.395),(s*.204,-.189,1.263),(s*.169,-.187,1.15)],[.029,.031,.026,.024],n=12)
 for z in [1.36,1.295,1.225,1.160]:
  box('webbing',(s*.156,-.207,z),(.075,.010,.011),rounded=True)
for z in [1.276,1.207]:
 box('olive',(0,-.205,z),(.208,.022,.018),rounded=True)
# 4 frontal chest pouches varying tones
for i,x in enumerate([-.151,-.051,.049,.149]):
 box(['olive2','olive','olive2','olive'][i],(x,-.216,1.238),(.043,.045,.086),rounded=True)
 box('tanedge',(x,-.262,1.310),(.041,.009,.019),rounded=True)
 box('webbing',(x,-.269,1.297),(.014,.008,.018),rounded=True)
 box('vestshadow',(x,-.273,1.246),(.035,.004,.030),rounded=True)
# radio clipped to left shoulder (no weapons)
box('glove',(.223,-.156,1.435),(.035,.025,.074),rounded=True)
strand('black',[(.23,-.147,1.488),(.237,-.145,1.545),(.244,-.154,1.566)],[.007,.006,.003],n=10)
# main left hip tactical pouch
box('tanedge',(-.245,-.015,1.040),(.055,.063,.093),rounded=True)
box('olive',(-.245,-.079,1.031),(.05,.010,.070),rounded=True)
# sleeve patch
polygon('tanedge',[(-.382,-.078,1.360),(-.299,-.085,1.356),(-.310,-.080,1.307),(-.377,-.079,1.311)])
# mountain zigzag stitching
strand('patch',[(-.368,-.085,1.326),(-.348,-.086,1.342),(-.335,-.087,1.331),(-.320,-.087,1.346),(-.315,-.087,1.329)],[.003]*5,n=6)

# scarf around neck (black/cream keffiyeh)
ell('scarf_dark',(0,-.015,1.473),(.181,.119,.085),26)
ell('scarf_white',(0,-.105,1.458),(.168,.081,.067),25)
# front triangular drape, physical tapered cloth layered over vest
polygon('scarf_white',[(-.160,-.172,1.476),(.170,-.172,1.475),(.116,-.205,1.351),(.046,-.221,1.330),(-.090,-.205,1.385)])
polygon('scarf_dark',[(-.128,-.177,1.448),(-.091,-.193,1.424),(-.061,-.203,1.445),(-.087,-.188,1.464)])
polygon('scarf_dark',[(.032,-.199,1.449),(.080,-.194,1.424),(.118,-.196,1.437),(.091,-.173,1.474)])
# keffiyeh zigzag diagonal black stitch strips on front
for x in [-.116,-.071,-.026,.019,.064,.108]:
 pts=[(x,-.200,1.444),(x+.020,-.208,1.424),(x-.002,-.209,1.405),(x+.021,-.206,1.390)]
 strand('scarf_dark',pts,[.006,.007,.006,.004],n=7)
for x,z in [(-.128,1.412),(-.086,1.380),(-.039,1.359),(.029,1.348),(.074,1.369)]:
 strand('scarf_white',[(x,-.204,z),(x-.004,-.197,z-.04)],[.005,.003],n=6)
# neck partially hidden
ell('skin',(0,.015,1.510),(.075,.072,.072),20)

# Head: rounded 3D sculpt with *2D painted anime expression texture*.
# The mesh remains curved 3D, but eyes, brows, nose and smile are texture details
# just like classic handheld/PS1-era stylized characters and LEGO faces.
# UVs run around the head: U=.5 directly front (-Y); V=0 chin, V=1 crown.
from vtk.util.numpy_support import numpy_to_vtk
face_anchor=[(1.540,.046,.052),(1.572,.081,.073),(1.615,.114,.091),
             (1.687,.139,.111),(1.766,.142,.110),(1.829,.121,.105),(1.858,.097,.088)]
face_zs=np.linspace(face_anchor[0][0],face_anchor[-1][0],37)
face_nodes=[]; uv=[]; face_faces=[]; n=96
for zi,z in enumerate(face_zs):
 wx=float(PchipInterpolator([v[0] for v in face_anchor],[v[1] for v in face_anchor])(z))
 ry=float(PchipInterpolator([v[0] for v in face_anchor],[v[2] for v in face_anchor])(z))
 for k in range(n+1):
  u=k/n
  angle=math.pi/2+2*math.pi*u  # 0.5 directly facing front (-Y)
  face_nodes.append((wx*math.cos(angle),.010+ry*math.sin(angle),float(z)))
  uv.append((u,(z-face_zs[0])/(face_zs[-1]-face_zs[0])))
  if zi and k<n:
   a=(zi-1)*(n+1)+k;b=zi*(n+1)+k
   face_faces.append((a,a+1,b+1,b))
face_points=vtk.vtkPoints();face_points.SetDataTypeToDouble()
for v in face_nodes:face_points.InsertNextPoint(*v)
face_pd=vtk.vtkPolyData();face_pd.SetPoints(face_points)
face_cells=vtk.vtkCellArray()
for ids in face_faces:
 q=vtk.vtkQuad()
 for j,idx in enumerate(ids):q.GetPointIds().SetId(j,int(idx))
 face_cells.InsertNextCell(q)
face_pd.SetPolys(face_cells)
tcoords=numpy_to_vtk(np.asarray(uv,np.float32),deep=True)
tcoords.SetNumberOfComponents(2);tcoords.SetName('TCoords')
face_pd.GetPointData().SetTCoords(tcoords)
append('face',face_pd)
# ears behind hair and earrings
for s in [-1,1]:
 ell('skinshadow',(s*.144,.013,1.714),(.034,.025,.053),18)
 ell('skin',(s*.156,-.005,1.717),(.024,.027,.038),18)
 # silver hoop, no glasses
 arc('silver',(s*.169,0,1.670),.031,.047,-.016,0,2*math.pi,r=.006,n=28)
# All nose, eye, eyebrow, freckles and lip artwork is painted into the
# curved head material. No separate protruding feature meshes.
# hairline cap on upper/bare back of head
ell('hairdark',(0,.043,1.806),(.154,.124,.136),28)
# exposed face needs to remain visible; front locks positioned outside forehead
for s in [-1,1]:
 strand('hair',[(s*.130,-.028,1.884),(s*.142,-.095,1.815),(s*.140,-.091,1.767)], [.048,.032,.008],n=11)
# frontal asymmetric bangs swooping from viewer right toward left
for q,col in [([(.106,-.067,1.900),(.078,-.112,1.866),(.024,-.119,1.841)],'hairmid'),
              ([(.070,-.095,1.907),(.027,-.117,1.880),(-.027,-.121,1.851)],'hairglow'),
              ([(-.044,-.060,1.909),(-.080,-.111,1.881),(-.102,-.108,1.845)],'hair')]:
 strand(col,q,[.029,.019,.003],n=11)
# central thick voluminous auburn high ponytail bun above crown
ell('hair',(0,.095,1.947),(.172,.155,.127),26)
ell('hairmid',(-.011,.128,2.006),(.144,.136,.105),22)
# layered locks curling around bun, back hair visible from all sides
rng=np.random.default_rng(8)
for i in range(23):
 a=i*2.399
 rr=.115+.04*(i%4)/3
 x=rr*math.cos(a);y=.095+rr*.8*math.sin(a)
 z=2.001+.06*(i%3)/2
 end=(x+0.045*math.cos(a),y+0.04*math.sin(a),z-.032)
 co='hairglow' if i%6==0 else ('hairmid' if i%3 else 'hair')
 strand(co,[(x*.64,y*.7+.045,z+.036),(x,y,z+.031),end],[.038,.027,.007],n=11)
# long high ponytail sweeping to model's right from back, clear 3D depth
for k in range(13):
 t=k/12
 ang=k*2.4
 x=-.099 + .08*math.sin(ang)*.6
 y=.195+.07*math.cos(ang)
 pts=[(x,y,2.028),(x-.07-t*.05,y+.08,1.967),(x-.13-t*.05,y+.064,1.882),(x-.12-t*.06,y+.09,1.77-t*.10)]
 r=(.022+.012*(k%3)/3)
 strand('hairglow' if k%5==0 else ('hair' if k%2 else 'hairmid'),pts,[r*.9,r,r*.65,.003],n=9)
# white daisy headband seated against the hair, wrapped around the crown
headband_pts=[]
for t in np.linspace(-0.15, math.pi+0.15, 18):
 headband_pts.append((0.142*math.cos(t), -0.050-0.010*math.sin(t), 1.950+0.035*math.sin(t)))
strand('headband', headband_pts, [0.0105]*len(headband_pts), aspect=0.72, n=8)
# a soft underlay tuck so the band appears embedded into the hair rather than floating
for t in np.linspace(0.0, math.pi, 7):
 ell('hairdark',(0.140*math.cos(t), -0.040-0.010*math.sin(t), 1.955+0.031*math.sin(t)),(.012,.010,.010),10)
# distinct small daisies attached directly to the band
for i in range(11):
 t=(i/10)*math.pi
 fx=.142*math.cos(t);fz=1.950+.034*math.sin(t)
 fy=-.055-.008*math.sin(t)
 for j in range(5):
  a=2*math.pi*j/5
  ell('flower',(fx+.0075*math.cos(a),fy-.002,fz+.0075*math.sin(a)),(.0065,.0035,.0055),10)
 ell('flowermid',(fx,fy-.006,fz),(.0035,.003,.0035),9)

# optional small non-weapon character accessories
# waist belt belt loops, thigh straps and pockets
for s in [-1,1]:
 for z in [1.005,1.020]:
  box('olive',(s*.168,-.119,z),(.024,.016,.011),rounded=True)
 box('vestshadow',(s*.210,.112,1.031),(.035,.030,.047),rounded=True)
 # dark wristwatch on right hand only
 if s==1:
  box('black',(s*.339,-.057,.970),(.045,.015,.018),rounded=True)
  box('silver',(s*.34,-.074,.971),(.016,.005,.012),rounded=True)

# build grouped surfaces and finish with VTK cleaning/normals
outmesh={}
for k,parts in meshes.items():
 appendf=vtk.vtkAppendPolyData()
 for p in parts:appendf.AddInputData(p)
 appendf.Update()
 tri=vtk.vtkTriangleFilter();tri.SetInputConnection(appendf.GetOutputPort());tri.Update()
 # concatenate in material groups, but don't merge intentionally overlapping parts
 pd=vtk.vtkPolyData();pd.DeepCopy(tri.GetOutput())
 if k=='face':
  smooth=vtk.vtkPolyDataNormals();smooth.SetInputData(pd);smooth.ComputePointNormalsOn();smooth.ComputeCellNormalsOff();smooth.SplittingOff();smooth.ConsistencyOn();smooth.Update()
  pd=vtk.vtkPolyData();pd.DeepCopy(smooth.GetOutput())
 outmesh[k]=pd

# GLB scene, using VTK-generated polydata converted to GLTF-compatible trimesh
scene=trimesh.Scene()
total=0
for i,(name,pd) in enumerate(outmesh.items()):
 verts=vtk_to_numpy(pd.GetPoints().GetData()).astype(np.float32)
 raw=vtk_to_numpy(pd.GetPolys().GetData()).reshape(-1,4)
 faces=raw[:,1:4].astype(np.int64)
 if not len(faces):continue
 total+=len(faces)
 mesh=trimesh.Trimesh(vertices=verts,faces=faces,process=False)
 if name=='face':
  xy=vtk_to_numpy(pd.GetPointData().GetTCoords()).astype(np.float32)
  image=Image.open(FACE_TEXTURES['smirk']).convert('RGBA')
  mat=trimesh.visual.material.SimpleMaterial(image=image,diffuse=[255,255,255,255],ambient=[255,255,255,255])
  mesh.visual=trimesh.visual.TextureVisuals(uv=xy,material=mat)
 else:
  mesh.visual=trimesh.visual.ColorVisuals(mesh=mesh,face_colors=np.concatenate([colrgb(name),[255]]))
 scene.add_geometry(mesh,geom_name=name,node_name=name)
glb=os.path.join(OUT,'C_unarmed_v3_animeface.glb')
scene.export(glb)
# Expression variants share the identical UV mesh. Swap images without moving vertices.
# Keep only the main default GLB and external PNGs to avoid redundant large model copies.
# additional interchange meshes export with consistent part names (textures via color MTL)
objtxt,tex=trimesh.exchange.obj.export_obj(scene,include_color=True,return_texture=True)
with open(os.path.join(OUT,'C_unarmed_v3_animeface.obj'),'w') as f:f.write(objtxt)
# Actor renderer for VTK preview, png output
face_actor=None
ren=vtk.vtkRenderer();ren.SetBackground(.055,.052,.071);ren.SetBackground2(.14,.123,.140);ren.GradientBackgroundOn()
for name,pd in outmesh.items():
 m=vtk.vtkPolyDataMapper();m.SetInputData(pd);m.ScalarVisibilityOff()
 act=vtk.vtkActor();act.SetMapper(m)
 if name=='face':
  png=vtk.vtkPNGReader();png.SetFileName(FACE_TEXTURES['smirk']);png.Update()
  vt=vtk.vtkTexture();vt.SetInputConnection(png.GetOutputPort());vt.InterpolateOn();vt.RepeatOff()
  act.SetTexture(vt);act.GetProperty().SetColor(1.0,1.0,1.0);face_actor=act
 else:act.GetProperty().SetColor(*[i/255 for i in colrgb(name)])
 act.GetProperty().SetInterpolationToPhong()
 act.GetProperty().SetAmbient(.25);act.GetProperty().SetDiffuse(.72);act.GetProperty().SetSpecular(.07)
 if name in ('silver','flowermid'):act.GetProperty().SetSpecular(.35);act.GetProperty().SetSpecularPower(28)
 ren.AddActor(act)
# multi-source soft studio lighting
lt=vtk.vtkLight();lt.SetLightTypeToSceneLight();lt.SetPosition(-3,-5,6);lt.SetFocalPoint(0,0,1);lt.SetIntensity(1.15);ren.AddLight(lt)
lt2=vtk.vtkLight();lt2.SetLightTypeToSceneLight();lt2.SetPosition(3,3,4.8);lt2.SetFocalPoint(0,0,1);lt2.SetIntensity(.76);ren.AddLight(lt2)
win=vtk.vtkRenderWindow();win.SetOffScreenRendering(1);win.SetSize(840,1050);win.AddRenderer(ren);win.SetMultiSamples(4)

def screenshot(path,az=0,elev=5,height=1050,width=840):
 cam=ren.GetActiveCamera()
 d=4.65
 aa=np.deg2rad(az);el=np.deg2rad(elev)
 # front is looking toward positive Y, from -Y
 cam.SetPosition(d*np.sin(aa)*np.cos(el),-d*np.cos(aa)*np.cos(el),1.06+d*np.sin(el))
 cam.SetFocalPoint(0,0,1.05);cam.SetViewUp(0,0,1);cam.ParallelProjectionOn();cam.SetParallelScale(1.18)
 ren.ResetCameraClippingRange()
 win.SetSize(width,height);win.Render()
 w2i=vtk.vtkWindowToImageFilter();w2i.SetInput(win);w2i.SetInputBufferTypeToRGB();w2i.ReadFrontBufferOff();w2i.Update()
 wr=vtk.vtkPNGWriter();wr.SetFileName(path);wr.SetInputConnection(w2i.GetOutputPort());wr.Write()

for nam,az,el in [('front',0,3),('threequarter',-35,7),('side',90,5),('back',180,5)]:
 screenshot(os.path.join(OUT,f'C_unarmed_v3_{nam}.png'),az,el)
# composite image
ims=[Image.open(os.path.join(OUT,f'C_unarmed_v3_{i}.png')).convert('RGB') for i in ['front','threequarter','side','back']]
compo=Image.new('RGB',(840*2,1050*2),(24,23,30))
for j,im in enumerate(ims):compo.paste(im,((j%2)*840,(j//2)*1050))
compo.save(os.path.join(OUT,'C_unarmed_v3_four_views.png'),quality=92)

# Close-up renders of the SAME real curved head with four texture-based expressions.
# Camera/light/body geometry stay identical; only the single face PNG changes.
exprimages=[]
for expression in ['smirk','neutral','blink','determined']:
 png=vtk.vtkPNGReader();png.SetFileName(FACE_TEXTURES[expression]);png.Update()
 tx=vtk.vtkTexture();tx.SetInputConnection(png.GetOutputPort());tx.InterpolateOn();tx.RepeatOff()
 face_actor.SetTexture(tx)
 cam=ren.GetActiveCamera()
 cam.SetPosition(0,-3.5,1.73);cam.SetFocalPoint(0,0,1.78);cam.SetViewUp(0,0,1)
 cam.ParallelProjectionOn();cam.SetParallelScale(.36)
 ren.ResetCameraClippingRange();win.SetSize(550,700);win.Render()
 w2i=vtk.vtkWindowToImageFilter();w2i.SetInput(win);w2i.SetInputBufferTypeToRGB();w2i.ReadFrontBufferOff();w2i.Update()
 wr=vtk.vtkPNGWriter();wr.SetFileName(os.path.join(OUT,f'C_unarmed_v3_face_{expression}.png'))
 wr.SetInputConnection(w2i.GetOutputPort());wr.Write()
 exprimages.append(Image.open(os.path.join(OUT,f'C_unarmed_v3_face_{expression}.png')).convert('RGB'))
 # Hold references for VTK until rasterized (above)
png=vtk.vtkPNGReader();png.SetFileName(FACE_TEXTURES['smirk']);png.Update()
tx=vtk.vtkTexture();tx.SetInputConnection(png.GetOutputPort());tx.InterpolateOn();tx.RepeatOff()
face_actor.SetTexture(tx)
sheet=Image.new('RGB',(1100,1400),(25,24,29))
for ix,im in enumerate(exprimages):sheet.paste(im,((ix%2)*550,(ix//2)*700))
sheet.save(os.path.join(OUT,'C_unarmed_v3_expression_contact_sheet.png'))

# Make original SVG-free VTK polydata bundled for VTK import as multi-block .vtm
multi=vtk.vtkMultiBlockDataSet();multi.SetNumberOfBlocks(len(outmesh))
for i,(k,pd) in enumerate(outmesh.items()):
 multi.SetBlock(i,pd);multi.GetMetaData(i).Set(vtk.vtkCompositeDataSet.NAME(),k)
v=vtk.vtkXMLMultiBlockDataWriter();v.SetFileName(os.path.join(OUT,'C_unarmed_v3_parts.vtm'));v.SetInputData(multi);v.Write()
# single self-contained VTK .vtp mesh with point RGB colors for VTK apps
from vtk.util.numpy_support import numpy_to_vtk
coloredappend=vtk.vtkAppendPolyData()
for key,pd in outmesh.items():
 cp=vtk.vtkPolyData();cp.DeepCopy(pd)
 rgb=np.repeat((colrgb(key) if key!='face' else colrgb('skin'))[None,:],cp.GetNumberOfPoints(),axis=0)
 arr=numpy_to_vtk(rgb,deep=True,array_type=vtk.VTK_UNSIGNED_CHAR)
 arr.SetName('RGB');arr.SetNumberOfComponents(3)
 cp.GetPointData().SetScalars(arr)
 coloredappend.AddInputData(cp)
coloredappend.Update()
vtpw=vtk.vtkXMLPolyDataWriter()
vtpw.SetFileName(os.path.join(OUT,'C_unarmed_v3_colored.vtp'))
vtpw.SetInputData(coloredappend.GetOutput())
vtpw.SetCompressorTypeToZLib();vtpw.SetDataModeToBinary();vtpw.Write()
# 12-frame rotation preview; character remains in neutral pose
frameimgs=[]
for idx,degree in enumerate(range(0,360,30)):
 fr=os.path.join(OUT,f'_turn_{idx:02}.png')
 screenshot(fr,az=degree,elev=7,width=480,height=680)
 frameimgs.append(Image.open(fr).convert('RGB').copy())
 os.unlink(fr)
frameimgs[0].save(os.path.join(OUT,'C_unarmed_v3_turntable.gif'),save_all=True,append_images=frameimgs[1:],duration=120,loop=0,optimize=True)


# create user-friendly interchange OBJ with MTL via VTK exporter (scene colors)
try:
 exp=vtk.vtkOBJExporter();exp.SetInput(win);exp.SetFilePrefix(os.path.join(OUT,'C_unarmed_v3_vtk_scene'));exp.Write()
except Exception as e:print('vtk OBJ exporter failed:',str(e))

summary={'subject':'C — Hero Shooter v3','pose':'neutral standing, unarmed, hands relaxed at sides','coordinates':'X horizontal, Y depth, +Z up; face toward -Y','height_m':2.135,'file_glb':os.path.basename(glb),'triangles':int(total),'parts':len(outmesh),'materials':list(outmesh),'expression_textures':{k:os.path.basename(v) for k,v in FACE_TEXTURES.items()},'format':'static geometry; individual material submeshes, NOT skinned/rigged','tool':'VTK 9.6.2 + trimesh textured GLB export','reference':'C - Canonical Character Artwork.png', 'revision':'v3: anime UV face with painted expressive eyes, eyebrows, nose, lips; no raised facial decals'}
with open(os.path.join(OUT,'asset_metadata.json'),'w') as f:json.dump(summary,f,indent=2)
with open(os.path.join(OUT,'README.txt'),'w') as f:f.write('Hero Shooter — C / Canonical unarmed 3D prototype\n\n'+json.dumps(summary,indent=2)+'\n\nOpen C_unarmed_v3_animeface.glb in Blender, Godot, Babylon.js or a compatible glTF viewer.\nAn individual character model, not a flat billboard. The mesh is built using Python VTK; face is a real UV-painted PNG texture. Expression swaps use texture variants.\nThis is a stylized geometry prototype, not an exact photogrammetric reproduction and it is not yet rigged for movement.\nThe model is unarmed: no pistol/holstered weapon. Both arms hang at the sides.\n')
print(json.dumps(summary,indent=2))