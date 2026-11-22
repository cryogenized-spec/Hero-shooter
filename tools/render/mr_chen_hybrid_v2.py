#!/usr/bin/env python3
"""Hero Shooter — Mr Chen V2: texture-mapped 2D facial graphics + integrated 3D nose.

Usage: python build_mr_chen.py [--out DIR]
World: +Z up, +X character's left on frontal camera, -Y is character FRONT.
Atlas: S SW W NW N NE E SE; rows idle[0:4],walk[4:8],run[8:12].
Reference: public/assets/portraits/chen-family/mr-chen-portrait-4x5.png,
           Mr. Chen Hero Shooter Sprite Sheet.png (Library concept).
This prototype has no armature or skin weights; gait poses are procedural only.
"""
import argparse, json, math, os
from collections import Counter
from pathlib import Path
import numpy as np
from PIL import Image, ImageDraw, ImageFont, ImageFilter
import vtk
from vtk.util.numpy_support import vtk_to_numpy
import trimesh

ap=argparse.ArgumentParser(); ap.add_argument('--out',default='/mnt/data/mr_chen_vtk_v2'); opt=ap.parse_args()
OUT=Path(opt.out); OUT.mkdir(parents=True,exist_ok=True)

C={
 'skin': '#c88c68', 'skin_light':'#ddaa86','skin_shadow':'#a87458',
 'shirt':'#e3d9c9','shirt_shadow':'#b9ab96','shirt_light':'#f0e7d6',
 'vest':'#242731','vest_hi':'#353945','vest_dark':'#171921',
 'trouser':'#282832','trouser_hi':'#35343d','shoe':'#21191a','sole':'#56413b',
 'hair':'#181821','hair_hi':'#2f2a2e','hair_mid':'#3c3335','gray':'#817876',
 'frame':'#19171a','frame_glint':'#a88c67','eye':'#32231e',
 'gold':'#d39a35','gold_hi':'#ebbf5d','watch':'#c1a25d',
 'button':'#989388','lip':'#9b6757','white':'#f2e5d9',
}

def rgb(h):
 h=h.lstrip('#');return tuple(int(h[i:i+2],16)/255 for i in (0,2,4))

def transform(pd,scale=(1,1,1),pos=(0,0,0),rotation=None):
 t=vtk.vtkTransform();t.PostMultiply();t.Scale(*scale)
 if rotation: t.RotateWXYZ(rotation[0],*rotation[1:])
 t.Translate(*pos);f=vtk.vtkTransformPolyDataFilter();f.SetInputData(pd);f.SetTransform(t);f.Update();return f.GetOutput()

def uv_sphere(pos,axes,color,res=18):
 sp=vtk.vtkSphereSource();sp.SetRadius(1);sp.SetThetaResolution(res*2);sp.SetPhiResolution(res);sp.Update();return transform(sp.GetOutput(),axes,pos),color

def tube(points,r,color,sides=9,closed=False):
 pts=vtk.vtkPoints();lines=vtk.vtkCellArray();n=len(points)
 for p in points:pts.InsertNextPoint(*p)
 ln=vtk.vtkPolyLine();ln.GetPointIds().SetNumberOfIds(n+(1 if closed else 0))
 for i in range(n):ln.GetPointIds().SetId(i,i)
 if closed:ln.GetPointIds().SetId(n,0)
 lines.InsertNextCell(ln)
 pd=vtk.vtkPolyData();pd.SetPoints(pts);pd.SetLines(lines)
 filt=vtk.vtkTubeFilter();filt.SetInputData(pd);filt.SetRadius(r);filt.SetNumberOfSides(sides);filt.CappingOn();filt.Update()
 return filt.GetOutput(),color

def cylinder_between(a,b,r1,r2,color,n=16):
 a=np.array(a,float);b=np.array(b,float);v=b-a;L=np.linalg.norm(v)
 if L<1e-6:return uv_sphere(a,(r1,r1,r1),color)
 cone=vtk.vtkConeSource();cone.SetHeight(L);cone.SetRadius(max(r1,r2));cone.SetResolution(n);cone.SetDirection(0,1,0);cone.Update()
 # Better tapered limbs: loft as elliptical cross-sections along segment.
 r=(r1+r2)/2
 src=vtk.vtkCylinderSource();src.SetHeight(L);src.SetRadius(r);src.SetResolution(n);src.CappingOn();src.Update()
 v=v/L; axis=np.cross([0,1,0],v); angle=math.degrees(math.acos(np.clip(np.dot([0,1,0],v),-1,1)))
 t=vtk.vtkTransform();t.PostMultiply()
 if np.linalg.norm(axis)>1e-7:t.RotateWXYZ(angle,*axis)
 elif v[1]<0:t.RotateX(180)
 t.Translate(*(a+b)/2)
 f=vtk.vtkTransformPolyDataFilter();f.SetInputData(src.GetOutput());f.SetTransform(t);f.Update()
 return f.GetOutput(),color

def loft(rings,color,segments=24):
 """rings: (z, half_width_x, half_depth_y, center_x, center_y)"""
 pts=vtk.vtkPoints();polys=vtk.vtkCellArray()
 for z,rx,ry,cx,cy in rings:
  for j in range(segments):
   ang=2*math.pi*j/segments
   pts.InsertNextPoint(cx+rx*math.cos(ang),cy+ry*math.sin(ang),z)
 for k in range(len(rings)-1):
  for j in range(segments):
   jn=(j+1)%segments
   poly=vtk.vtkQuad();[poly.GetPointIds().SetId(i,id_) for i,id_ in enumerate([k*segments+j,k*segments+jn,(k+1)*segments+jn,(k+1)*segments+j])];polys.InsertNextCell(poly)
 for k,reverse in [(0,True),(len(rings)-1,False)]:
  poly=vtk.vtkPolygon();poly.GetPointIds().SetNumberOfIds(segments)
  for j in range(segments):poly.GetPointIds().SetId(j,k*segments+(segments-j-1 if reverse else j))
  polys.InsertNextCell(poly)
 pd=vtk.vtkPolyData();pd.SetPoints(pts);pd.SetPolys(polys)
 tri=vtk.vtkTriangleFilter();tri.SetInputData(pd);tri.Update()
 return tri.GetOutput(),color

def patch(points,color):
 v=vtk.vtkPoints();poly=vtk.vtkPolygon();poly.GetPointIds().SetNumberOfIds(len(points))
 for i,p in enumerate(points):v.InsertNextPoint(*p);poly.GetPointIds().SetId(i,i)
 cells=vtk.vtkCellArray();cells.InsertNextCell(poly);pd=vtk.vtkPolyData();pd.SetPoints(v);pd.SetPolys(cells)
 tri=vtk.vtkTriangleFilter();tri.SetInputData(pd);tri.Update();return tri.GetOutput(),color


# HERO SHOOTER HYBRID FACE v2
# Painted eyes, eyelids, brows, mouth and subtle creases are in one transparent
# PNG texture on a conforming 3D patch. The nose is deformation of the *head*
# mesh itself (no separate spheres, no conspicuous pasted-on facial volumes).
HEAD_RINGS=[
 (1.487,.065,.078,0,-.002),(1.508,.098,.103,0,-.008),
 (1.543,.125,.121,0,-.010),(1.561,.133,.126,0,-.009),
 (1.580,.143,.130,0,-.008),(1.590,.157,.134,0,-.008),
 (1.605,.163,.138,0,-.006),(1.630,.171,.144,0,-.004),
 (1.657,.178,.148,0,-.002),(1.686,.175,.149,0,-.001),
 (1.716,.172,.150,0,0),(1.748,.166,.145,0,.007),
 (1.778,.153,.136,0,.015),(1.818,.097,.095,0,.029),
 (1.830,.035,.035,0,.039)]
ZMIN,ZMAX=1.513,1.752
ANGMAX=1.035
FACE_FILE=OUT/'mr_chen_facials_neutral.png'

def head_params(z):
 for a,b in zip(HEAD_RINGS[:-1],HEAD_RINGS[1:]):
  if a[0]<=z<=b[0]:
   t=(z-a[0])/(b[0]-a[0]);return tuple(a[j]*(1-t)+b[j]*t for j in range(1,5))
 if z<HEAD_RINGS[0][0]:return HEAD_RINGS[0][1:]
 return HEAD_RINGS[-1][1:]

def nose_bump(x,y,z):
 # Localised low relief, model-proportional and tapering smoothly to the cheeks.
 return .026*np.exp(-((x/.042)**2)-(((z-1.600)/.047)**2))*max(0,min(1,(-y/.12)))**2

def sculpt_head(pd):
 cp=vtk.vtkPolyData();cp.DeepCopy(pd)
 pts=cp.GetPoints()
 for i in range(pts.GetNumberOfPoints()):
  x,y,z=pts.GetPoint(i);pts.SetPoint(i,x,y-nose_bump(x,y,z),z)
 pts.Modified();cp.Modified()
 ns=vtk.vtkPolyDataNormals();ns.SetInputData(cp);ns.ConsistencyOn();ns.AutoOrientNormalsOn();ns.SplittingOff();ns.Update()
 return ns.GetOutput()

def face_poly(bob=0.0,nx=72,nz=56):
 points=vtk.vtkPoints();cells=vtk.vtkCellArray();uvs=vtk.vtkFloatArray();uvs.SetName('TCoords');uvs.SetNumberOfComponents(2)
 for iz in range(nz+1):
  t=iz/nz;z=ZMIN+t*(ZMAX-ZMIN)
  rx,ry,cx,cy=head_params(z)
  for ix in range(nx+1):
   u=ix/nx;angle=(u*2-1)*ANGMAX;x=cx+rx*math.sin(angle)
   y=cy-ry*math.cos(angle)
   # Offset 3.5mm outward to prevent z-fighting against low-poly head triangles.
   y-=nose_bump(x,y,z)+.0035*math.cos(angle)
   x+=.0035*math.sin(angle)
   points.InsertNextPoint(x,y,z+bob);uvs.InsertNextTuple2(u,t)
 for iz in range(nz):
  for ix in range(nx):
   a=iz*(nx+1)+ix;b=a+1;c=a+nx+1;d=c+1
   for triangle in [(a,b,d),(a,d,c)]:
    t=vtk.vtkTriangle();[t.GetPointIds().SetId(k,triangle[k]) for k in range(3)];cells.InsertNextCell(t)
 pd=vtk.vtkPolyData();pd.SetPoints(points);pd.SetPolys(cells);pd.GetPointData().SetTCoords(uvs)
 return pd

def face_texture(path=FACE_FILE):
 W,H=1200,960
 art=Image.new('RGBA',(W,H),(0,0,0,0))
 dr=ImageDraw.Draw(art)
 def X(x,z=1.65):
  rx=head_params(z)[0]
  return int(W*(math.asin(max(-.99,min(.99,x/rx)))/ANGMAX+1)/2)
 def Y(z):return int(H*(ZMAX-z)/(ZMAX-ZMIN))
 def shape_xy(points,fill,z=1.65):dr.polygon([(X(x,z),Y(zz)) for x,zz in points],fill=fill)
 def line(points,fill,w=5,z=1.65):dr.line([(X(x,z),Y(zz)) for x,zz in points],fill=fill,width=w,joint='curve')
 # Soft, painted cheek flush: translucent skin shading, not a glued solid.
 blush=Image.new('RGBA',(W,H),(0,0,0,0));bd=ImageDraw.Draw(blush)
 for sg in (-1,1):
  cx=X(sg*.106,1.595);cy=Y(1.592)
  bd.ellipse((cx-80,cy-34,cx+80,cy+62),fill=(105,56,42,28))
 blush=blush.filter(ImageFilter.GaussianBlur(28));art.alpha_composite(blush);dr=ImageDraw.Draw(art)
 for sg in (-1,1):
  # Viewer-left and viewer-right eyes have individually drawn geometry, not duplicated mesh.
  ex=X(sg*.084,1.646);ey=Y(1.646)
  eyeW,eyeH=67,31
  dr.ellipse((ex-eyeW,ey-eyeH,ex+eyeW,ey+eyeH),fill=(239,212,186,245))
  dr.ellipse((ex-20,ey-27,ex+18,ey+29),fill=(71,47,40,255))
  dr.ellipse((ex-10,ey-19,ex+8,ey+22),fill=(29,24,29,255))
  dr.ellipse((ex-12,ey-17,ex-5,ey-7),fill=(246,236,213,230))
  dr.arc((ex-eyeW-4,ey-eyeH-5,ex+eyeW+5,ey+eyeH+6),183,356,fill=(35,28,31,255),width=10)
  # Make the upper eyelid stern/slanted, pointed toward the nose.
  inner=sg*.043;outer=sg*.135
  line([(outer,1.647),(sg*.099,1.659),(inner,1.650)],(45,31,30,244),9)
  line([(outer,1.635),(sg*.086,1.628),(inner,1.637)],(138,79,58,154),4)
  # Heavy angled brows, closer/lower by bridge, high at outside.
  shape_xy([(sg*.039,1.683),(sg*.041,1.675),(sg*.073,1.680),
            (sg*.111,1.695),(sg*.137,1.706),(sg*.126,1.697),
            (sg*.084,1.685),(sg*.051,1.689)],(34,28,31,255))
  line([(sg*.039,1.694),(sg*.063,1.701),(sg*.085,1.703)],(124,76,56,135),3)
  # Eye-corner and forehead creases for a man in his late forties.
  line([(sg*.136,1.655),(sg*.151,1.666)],(102,59,48,155),4)
  line([(sg*.137,1.640),(sg*.159,1.643)],(113,64,49,140),3)
  line([(sg*.127,1.619),(sg*.146,1.607)],(120,72,56,130),3)
  line([(sg*.044,1.718),(sg*.070,1.722)],(121,75,57,110),3)
  # Nose bridge and mouth folds are 2D painted accents against the real head.
  line([(sg*.024,1.607),(sg*.030,1.592)],(121,71,54,125),3)
  line([(sg*.048,1.582),(sg*.062,1.558)],(120,68,54,120),4)
  dr.ellipse((X(sg*.038,1.585)-10,Y(1.578)-4,X(sg*.038,1.585)+10,Y(1.578)+8),fill=(125,75,55,130))
 # Furrow between eyebrows and small highlight in the central nose bump.
 line([(-.015,1.695),(-.013,1.680)],(110,62,48,115),5)
 line([(.015,1.695),(.013,1.680)],(110,62,48,115),5)
 line([(-.004,1.627),(-.004,1.594)],(245,180,132,95),8)
 # Stern closed mouth, subtle uneven corners and painted lip volumes.
 line([(-.059,1.545),(-.032,1.540),(-.005,1.541),(.025,1.544),(.056,1.542)],(86,49,44,240),6)
 line([(-.047,1.533),(-.016,1.531),(.028,1.534)],(179,103,78,170),5)
 line([(-.061,1.549),(-.074,1.551)],(110,61,48,130),3)
 line([(.057,1.543),(.068,1.543)],(110,61,48,110),3)
 # Light chin highlight (no separate lip cylinders or beads).
 line([(-.031,1.516),(0,1.514),(.027,1.518)],(240,165,126,50),7)
 art.save(path)
 return art

FACE_ART=None

# Some 3D face detail is deliberately inset/overlapped to avoid disconnected ornaments.
def build(gait='idle',phase=0.0):
 parts=[]
 def add(v):parts.append(v)
 cycle=2*math.pi*phase
 motion={'idle':0.00,'walk':0.115,'run':0.205}[gait]
 bend={'idle':0.0,'walk':0.016,'run':0.045}[gait]
 bob=0.002*math.sin(phase*4*math.pi) if gait=='idle' else 0.007+0.011*abs(math.sin(cycle))
 # shoes + legs; gait moves Y-axis (front toward negative Y)
 for side in [-1,1]:
  sin=math.sin(cycle + (0 if side<0 else math.pi));stride=motion*sin
  hip=(side*.133,0,.91+bob)
  knee=(side*.140,-stride*.44,.51+bob-bend*(1-abs(sin)))
  ankle=(side*.145,-stride,.14+bob+bend*(1-abs(sin)))
  add(cylinder_between(hip,knee,.106,.085,C['trouser'],16))
  add(uv_sphere(knee,(.096,.090,.105),C['trouser_hi']))
  add(cylinder_between(knee,ankle,.085,.074,C['trouser'],16))
  add(uv_sphere((ankle[0],ankle[1]-.035, .075+bob),(.102,.174,.078),C['shoe']))
  add(uv_sphere((ankle[0],ankle[1]-.075, .041+bob),(.105,.159,.040),C['sole']))
  # brown shoe tongue tip
  add(tube([(ankle[0]-.066,ankle[1]-.157,.10+bob),(ankle[0]+.066,ankle[1]-.157,.10+bob)],.007,C['sole']))
 # waist and shirt tailored mass
 add(loft([(.86+bob,.22,.145,0,0),(.94+bob,.23,.155,0,0),(1.05+bob,.25,.170,0,0)],C['trouser']))
 add(loft([(1.01+bob,.209,.122,0,0),(1.22+bob,.231,.139,0,0),(1.39+bob,.262,.145,0,0),(1.44+bob,.124,.104,0,0)],C['shirt']))
 # contrast shoulders sleeve / arms, rolled just below elbow
 for side in [-1,1]:
  swing=-motion*math.sin(cycle + (0 if side<0 else math.pi))*.78
  x=side*.290;shoulder=(x,-.006,1.362+bob)
  elbow=(side*.325,.025+swing*.58,1.130+bob)
  wrist=(side*.307,.005+swing,.979+bob)
  add(uv_sphere(shoulder,(.068,.073,.079),C['shirt']))
  add(cylinder_between(shoulder,elbow,.076,.073,C['shirt']))
  add(uv_sphere(elbow,(.079,.084,.078),C['shirt_shadow']))
  add(cylinder_between(elbow,(side*.315,.010+swing*.77,1.043+bob),.075,.068,C['skin_light']))
  add(cylinder_between((side*.315,.010+swing*.77,1.055+bob),wrist,.077,.065,C['shirt']))
  add(uv_sphere((side*.306,.008+swing,.968+bob),(.065,.072,.082),C['skin']))
  # finger shapes and relaxed hand palms, no prop
  add(uv_sphere((side*.307,.0+swing,.938+bob),(.057,.059,.073),C['skin']))
  if side>0:
   # watch on character's left wrist, matte gold
   add(uv_sphere((side*.308,-.064+swing,.990+bob),(.029,.014,.025),C['watch']))
   add(uv_sphere((side*.308,-.075+swing,.990+bob),(.017,.004,.014),C['vest_dark']))
 # vest covers body: dark, fitted; three layers for subtle side and trim
 add(loft([(1.008+bob,.231,.151,0,0),(1.13+bob,.252,.166,0,0),(1.34+bob,.285,.172,0,0),(1.407+bob,.262,.161,0,0)],C['vest']))
 # vest front central shirt V and collar: negative y = front
 add(patch([(-.138,-.174,1.402+bob),(.138,-.174,1.402+bob),(0,-.186,1.218+bob)],C['shirt_light']))
 add(patch([(-.145,-.177,1.407+bob),(-.020,-.184,1.358+bob),(-.091,-.187,1.311+bob),(-.182,-.173,1.365+bob)],C['shirt']))
 add(patch([(.145,-.177,1.407+bob),(.020,-.184,1.358+bob),(.091,-.187,1.311+bob),(.182,-.173,1.365+bob)],C['shirt']))
 # lapel piping and center button/zipper line
 add(tube([(-.15,-.179,1.395+bob),(-.08,-.187,1.288+bob),(0,-.188,1.245+bob),(.08,-.187,1.288+bob),(.15,-.179,1.395+bob)],.008,C['vest_hi']))
 add(tube([(0,-.189,1.242+bob),(0,-.173,1.060+bob)],.007,C['vest_dark']))
 for z in [1.105,1.166,1.224]:add(uv_sphere((.018,-.186,z+bob),(.010,.006,.009),C['button']))
 # vest pocket welt and sewn golden emblem on left of viewer (character right)
 add(tube([(-.228,-.169,1.233+bob),(-.105,-.182,1.233+bob)],.010,C['vest_hi']))
 # patch badge under chest: gold thread approximating square border and stylized strokes
 add(patch([(-.240,-.174,1.345+bob),(-.143,-.193,1.345+bob),(-.143,-.192,1.263+bob),(-.241,-.171,1.263+bob)],C['vest_dark']))
 for coords in [
   [(-.218,1.327),(-.165,1.327)], [(-.213,1.305),(-.169,1.305)],
   [(-.204,1.337),(-.204,1.283)], [(-.190,1.314),(-.170,1.288)],
   [(-.231,1.282),(-.165,1.282)]]:
  add(tube([(x,-.196,z+bob) for x,z in coords],.0045,C['gold']))
 # gold embroidered insignia on the back, readable as a textured small crest at game scale
 add(patch([(-.073,.166,1.303+bob),(.073,.166,1.303+bob),(.073,.164,1.188+bob),(-.073,.164,1.188+bob)],C['vest_dark']))
 for zs in [1.285,1.247,1.207]:add(tube([(-.055,.170,zs+bob),(.053,.170,zs+bob)],.006,C['gold']))
 add(tube([(0,.171,1.30+bob),(0,.171,1.198+bob)],.006,C['gold']))
 add(tube([(-.04,.171,1.27+bob),(.03,.171,1.225+bob)],.005,C['gold']))
 # neck / head. ear lobe Z about 1.59, hair peak 1.88
 add(uv_sphere((0,-.005,1.458+bob),(.104,.104,.132),C['skin']))
 head_rings=[(z+bob,rx,ry,cx,cy) for z,rx,ry,cx,cy in HEAD_RINGS]
 h,_=loft(head_rings,C['skin'],segments=96)
 add((sculpt_head(h),C['skin']))
 # The ears are physical anatomy, and sunglasses frames remain actual 3D geometry.
 for side in [-1,1]:
  add(uv_sphere((side*.165,-.002,1.619+bob),(.025,.038,.064),C['skin_shadow']))
  add(uv_sphere((side*.174,-.014,1.621+bob),(.018,.020,.036),C['skin']))
 # 2D facial artwork follows the head's contours via UVs (one shared texture).
 add((face_poly(bob),C['skin'],'face'))
 # glasses: two rectangular rounded rings in face plane; temples extend back to ears
 for side in [-1,1]:
  cx=side*.087;cz=1.642+bob
  dx=.068;dz=.040;y=-.170
  # chamfered closed loop; avoid lenses obscuring eyes with solid material
  points=[(cx-dx*.8,y,cz+dz),(cx+dx*.8,y,cz+dz),
          (cx+dx,y,cz+dz*.72),(cx+dx,y,cz-dz*.68),
          (cx+dx*.80,y,cz-dz),(cx-dx*.8,y,cz-dz),
          (cx-dx,y,cz-dz*.7),(cx-dx,y,cz+dz*.72)]
  add(tube(points,.0075,C['frame'],closed=True))
  add(tube([(side*.153,-.171,cz+.008),(side*.171,-.089,cz+.015),(side*.176,-.014,cz+.004)],.006,C['frame']))
  add(tube([(cx-dx*.6,-.177,cz+dz*.86),(cx-dx*.1,-.177,cz+dz*.90)],.0022,C['frame_glint']))
 add(tube([(-.019,-.174,1.653+bob),(0,-.168,1.657+bob),(.019,-.174,1.653+bob)],.007,C['frame']))
 # swept back jet-black hair cap; skin shows lower forehead
 add(uv_sphere((0,.032,1.799+bob),(.181,.151,.100),C['hair']))
 add(uv_sphere((0,.062,1.829+bob),(.177,.126,.057),C['hair_mid']))
 # swept hair strands (no detached point tips); each partially intersects base cap
 for j,offset in enumerate([-.135,-.091,-.043,.012,.065,.112]):
  add(tube([(offset-.015,-.065,1.806+bob),(offset+.009,-.025,1.855+bob),
           (offset+.026,.046,1.869+bob),(offset+.029,.116,1.825+bob)],.014 if j in (2,3) else .011, C['gray'] if j in (0,5) else C['hair_hi']))
 # sculpted front hair wave and left/right subtle silver at temples (not too grey)
 add(tube([(-.156,-.060,1.782+bob),(-.092,-.106,1.811+bob),
           (-.011,-.102,1.836+bob),(.078,-.054,1.836+bob)],.023,C['hair']))
 for side in [-1,1]:
  add(tube([(side*.166,-.053,1.770+bob),(side*.176,-.022,1.808+bob),(side*.162,.032,1.834+bob)],.010,C['gray']))
 return parts

def rotate_pd(pd,angle):
 t=vtk.vtkTransform();t.RotateZ(angle)
 f=vtk.vtkTransformPolyDataFilter();f.SetInputData(pd);f.SetTransform(t);f.Update();return f.GetOutput()

def make_actor(pd,col,tex=None):
 m=vtk.vtkPolyDataMapper();m.SetInputData(pd);a=vtk.vtkActor();a.SetMapper(m)
 p=a.GetProperty();p.SetColor(*rgb(col));p.SetAmbient(.37);p.SetDiffuse(.67);p.SetSpecular(.12);p.SetSpecularPower(27)
 if tex=='face':
  rdr=vtk.vtkPNGReader();rdr.SetFileName(str(FACE_FILE));rdr.Update()
  texture=vtk.vtkTexture();texture.SetInputConnection(rdr.GetOutputPort());texture.InterpolateOn();texture.RepeatOff()
  a.SetTexture(texture)
  p.SetColor(1,1,1);p.SetAmbient(.94);p.SetDiffuse(.06);p.SetSpecular(0)
  p.BackfaceCullingOff()
 return a

def setup_renderer(w,h,mode='sprite'):
 ren=vtk.vtkRenderer();win=vtk.vtkRenderWindow();win.SetOffScreenRendering(True);win.SetSize(w,h);win.SetMultiSamples(0);win.SetAlphaBitPlanes(1);win.AddRenderer(ren)
 ren.SetBackground(0,0,0);ren.SetBackgroundAlpha(0)
 cam=ren.GetActiveCamera();cam.ParallelProjectionOn()
 if mode=='sprite':
  cam.SetPosition(0,-6.5,5.0);cam.SetFocalPoint(0,0,1.01);cam.SetViewUp(0,0,1);cam.SetParallelScale(1.10)
 elif mode=='front':
  cam.SetPosition(0,-6.5,3.2);cam.SetFocalPoint(0,0,1.00);cam.SetViewUp(0,0,1);cam.SetParallelScale(1.12)
 elif mode=='back':
  cam.SetPosition(0,6.5,3.2);cam.SetFocalPoint(0,0,1.0);cam.SetViewUp(0,0,1);cam.SetParallelScale(1.12)
 elif mode=='profile':
  cam.SetPosition(6.5,0,3.0);cam.SetFocalPoint(0,0,1.0);cam.SetViewUp(0,0,1);cam.SetParallelScale(1.12)
 elif mode=='quarter':
  cam.SetPosition(4,-5.5,3.75);cam.SetFocalPoint(0,0,1.0);cam.SetViewUp(0,0,1);cam.SetParallelScale(1.12)
 elif mode=='top':
  cam.SetPosition(0,-2.5,7.0);cam.SetFocalPoint(0,0,1.0);cam.SetViewUp(0,0,1);cam.SetParallelScale(1.2)
 # set lights custom
 ren.AutomaticLightCreationOff()
 def light(p,intensity,col):
  l=vtk.vtkLight();l.SetLightTypeToSceneLight();l.SetPosition(*p);l.SetFocalPoint(0,0,1);l.SetIntensity(intensity);l.SetColor(*col);ren.AddLight(l)
 light((-3,-4,7),1.0,(1,.88,.75));light((3,2,5),.68,(.72,.82,1));light((1,-5,2),.30,(1,1,1))
 return ren,win

def render(parts,mode='sprite',angle=0,w=128,h=192):
 ren,win=setup_renderer(w,h,mode)
 for part in parts:
  pd,c=part[:2];tex=part[2] if len(part)>2 else None
  ren.AddActor(make_actor(rotate_pd(pd,angle) if angle else pd,c,tex))
 win.Render()
 cap=vtk.vtkWindowToImageFilter();cap.SetInput(win);cap.SetInputBufferTypeToRGBA();cap.ReadFrontBufferOff();cap.Update()
 im=cap.GetOutput();arr=vtk_to_numpy(im.GetPointData().GetScalars()).reshape(h,w,4)[::-1].copy()
 # EGL alpha may be fully opaque; VTK stores proper foreground alpha on recent versions.
 return Image.fromarray(arr,'RGBA')

def export_glb(parts,path):
 grouped={};counts=Counter();scene=trimesh.Scene()
 for part in parts:
  pd,c=part[:2];tex=part[2] if len(part)>2 else None
  tri=vtk.vtkTriangleFilter();tri.SetInputData(pd);tri.Update();p=tri.GetOutput()
  pts=vtk_to_numpy(p.GetPoints().GetData()).astype(np.float32)
  cells=vtk_to_numpy(p.GetPolys().GetConnectivityArray()).astype(np.int64)
  if len(cells)%3:continue
  faces=cells.reshape(-1,3)
  if tex=='face':
   uv=vtk_to_numpy(p.GetPointData().GetTCoords()).astype(np.float64)
   mat=trimesh.visual.material.PBRMaterial(baseColorTexture=Image.open(FACE_FILE).convert('RGBA'),baseColorFactor=[255,255,255,255],alphaMode='BLEND',doubleSided=True,metallicFactor=0.0,roughnessFactor=1.0)
   m=trimesh.Trimesh(vertices=pts,faces=faces,visual=trimesh.visual.TextureVisuals(uv=uv,material=mat),process=False)
   # Winding of the UV sheet is consistent and visible from the outside.
   scene.add_geometry(m,geom_name='material_painted_face')
  else:
   grouped.setdefault(c,[]).append((pts,faces))
 for color,meshes in grouped.items():
  vs=[];fs=[];base=0
  for v,f in meshes:vs.append(v);fs.append(f+base);base+=len(v)
  visual=trimesh.visual.ColorVisuals(vertex_colors=np.tile(np.array([int(color[i:i+2],16) for i in (1,3,5)]+[255],np.uint8),(base,1)))
  mesh=trimesh.Trimesh(vertices=np.concatenate(vs),faces=np.concatenate(fs),visual=visual,process=False)
  scene.add_geometry(mesh,geom_name='mat_'+color[1:])
  counts[color]=len(mesh.faces)
 path.write_bytes(scene.export(file_type='glb'))
 return scene,counts

def main():
 face_texture()
 base=build('idle',0)
 scene,faces=export_glb(base,OUT/'mr_chen_hybrid_face_v2.glb')
 imgs=[]
 for k in ['front','quarter','profile','back']:
  im=render(base,mode=k,w=400,h=520)
  imgs.append(im)
  im.save(OUT/f'mr_chen_{k}.png')
 # four-up labelled presentation; image labels outside actual exports
 panel=Image.new('RGB',(400*4,588),(22,22,27));d=ImageDraw.Draw(panel)
 for i,(title,im) in enumerate(zip(['FRONT','THREE-QUARTER','RIGHT PROFILE','BACK'],imgs)):
  bg=Image.new('RGB',im.size,(33,35,44));bg.paste(im,(0,0),im)
  panel.paste(bg,(400*i,34));d.text((400*i+18,10),title,fill=(239,213,169))
 d.text((18,565),'MR CHEN  /  Hero Shooter  /  VTK hybrid texture face v2 — unrigged prototype',fill=(197,197,200))
 panel.save(OUT/'mr_chen_four_view.png')
 # 8-direction neutral poses, fixed camera. Front is South; rotate subject not camera.
 headings=['S','SW','W','NW','N','NE','E','SE']
 rotations=[0,-45,-90,-135,180,135,90,45]
 dir_imgs=[]
 for head,deg in zip(headings,rotations):
  im=render(base,'sprite',deg,200,300)
  im.save(OUT/f'mr_chen_facing_{head}.png')
  dir_imgs.append(im)
 preview=Image.new('RGB',(200*8,338),(25,26,32));dr=ImageDraw.Draw(preview)
 for i,(name,im) in enumerate(zip(headings,dir_imgs)):
  bg=Image.new('RGB',(200,300),(40,42,51));bg.paste(im,(0,0),im)
  preview.paste(bg,(i*200,28));dr.text((i*200+87,5),name,fill=(237,190,104))
 preview.save(OUT/'mr_chen_direction_review.png')
 # Raw atlas: transparent 256x576. Oversample each cell then downsample to genuine pixel dimensions.
 tilew,tileh=32,48
 atlas=Image.new('RGBA',(tilew*8,tileh*12),(0,0,0,0))
 for gi,gait in enumerate(['idle','walk','run']):
  for fi in range(4):
   phase=(fi/4)
   item=build(gait,phase)
   for ci,deg in enumerate(rotations):
    im=render(item,'sprite',deg,128,192)
    im=im.resize((tilew,tileh),Image.Resampling.LANCZOS)
    atlas.paste(im,(ci*tilew,(gi*4+fi)*tileh))
 atlas.save(OUT/'mr_chen_8dir_12row_atlas.png')
 atlas.resize((256*3,576*3),Image.Resampling.NEAREST).save(OUT/'mr_chen_atlas_3x_review.png')
 audit={'tool':'VTK','vtk_version':vtk.vtkVersion.GetVTKVersion(),'mesh_library':'trimesh '+trimesh.__version__,
 'model':'mr_chen_hybrid_face_v2.glb','facial_technique':'UV-mapped transparent 2D facial art on curved head-conforming mesh; 3D integral nose deformation; real 3D eyeglass frames','status':'unrigged procedural VTK prototype, not game-ready',
 'height_units':'metres','height_approx_m':1.89,'coordinate_system':'+Z up; -Y model front; +X to viewer-right in frontal camera',
 'direction_order':headings,'atlas_rotation_about_3d_z_deg':rotations,
 'sprite_cell_px':[32,48],'sprite_atlas_px':[256,576],'sprite_rows':'0-3 idle; 4-7 walk; 8-11 run',
 'mesh_count':len(scene.geometry),'total_triangles':int(sum(len(g.faces) for g in scene.geometry.values())),
 'material_triangle_counts':dict(faces),'scene_bounds_m':scene.bounds.tolist(),
 'source_of_truth':'Hero Shooter portrait+existing sprite sheet; prior GLB for Mr Chen not found in repository',
 'outfit':'dark vest with approximate gold crest, ivory rolled-cuff shirt, tailored trousers, black shoes, rectangle glasses, gold watch',
 'provenance':'Procedural geometry by this script; no external 3D meshes; reference art is not embedded',
 'validation':'Eight neutral direction images plus 4-view, 96 atlas cells; no skeletal deformation/animation QA',
 'notes':['UV facial patch is independent surface 3.5mm above head; actual GLB PNG texture uses alpha blending','Gait is independent 3D pose generation, not a rig','Gold Chinese glyph is an abstract stitched motif, not accurate typography',
          'Visible-overlap construction; separate VTK components are not a single watertight connected mesh']}
 (OUT/'mr_chen_audit.json').write_text(json.dumps(audit,indent=2))
 print('Wrote outputs:',[(p.name,p.stat().st_size) for p in sorted(OUT.iterdir()) if p.is_file()]);print('Bounds',scene.bounds,'triangles',audit['total_triangles'])

if __name__=='__main__':main()