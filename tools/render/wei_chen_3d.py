#!/usr/bin/env python3
"""Hero Shooter — Wei Chen: reference-accurate procedural 3D model with UV-painted anime face.

Usage: python build_wei_chen.py [--out DIR] [--preview-only]
World: +Z up, +X character's left on frontal camera, -Y is character FRONT.
Atlas: S SW W NW N NE E SE; rows idle[0:4],walk[4:8],run[8:12].
Reference: public/assets/portraits/chen-family/wei-portrait-4x5.png,
           Wei Chen Hero Shooter Sprite Sheet.png (Library concept).
This prototype has no armature or skin weights; gait poses are procedural only.
"""
import argparse, json, math, os
from collections import Counter
from pathlib import Path
import numpy as np
from PIL import Image, ImageDraw, ImageFont, ImageFilter, ImageChops
import vtk
from vtk.util.numpy_support import vtk_to_numpy
import trimesh

ap=argparse.ArgumentParser(); ap.add_argument('--out',default='/mnt/data/wei_chen_vtk_v2'); ap.add_argument('--preview-only',action='store_true'); opt=ap.parse_args()
OUT=Path(opt.out); OUT.mkdir(parents=True,exist_ok=True)

C={
 'skin':'#ce9a77','skin_light':'#dfaf8a','skin_shadow':'#a77559',
 'hoodie':'#c8b9a6','hoodie_light':'#e3d6bf','hoodie_dark':'#9e8b7b',
 'jacket':'#23252e','jacket_hi':'#383947','jacket_shadow':'#171a21',
 'jacket_rib':'#1b1e27','embroider':'#dca34a','gold':'#d4a052',
 'pant':'#393740','pant_dark':'#292831','pant_hi':'#504850',
 'shoe':'#d3c4b1','shoe_side':'#30303b','shoe_toe':'#eee4d4',
 'sole':'#b8a99d','sole_dark':'#665b57',
 'hair':'#14141b','hair_mid':'#29252b','hair_hi':'#4a3435','hair_amber':'#72473b',
 'frame':'#1b1c26','metal':'#7a7781','cup':'#282c35','cup_dark':'#0d1218',
 'shirt_zip':'#e5d3b1','watch':'#977a5b','bag':'#614532','bag_hi':'#7e5c41',
 'button':'#9e8978','lip':'#985c4d','white':'#fff0dc','eye':'#33221e',
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



# -----------------------------------------------------------------------------
# Wei Chen: young-adult proportions, hand-painted facial features in curved UV.
# Units: metres, +Z up, model forward = -Y, face is on the -Y hemisphere.
# A-pose is unarmed. Exact direction contract: S SW W NW N NE E SE.
# -----------------------------------------------------------------------------
HEAD_RINGS=[
 (1.495,.055,.074,0,-.004), (1.520,.090,.095,0,-.006),
 (1.551,.116,.113,0,-.009),(1.587,.131,.127,0,-.008),
 (1.609,.145,.132,0,-.007),(1.641,.151,.141,0,-.006),
 (1.673,.157,.144,0,-.003),(1.706,.156,.146,0,0),
 (1.740,.153,.141,0,.006),(1.778,.140,.133,0,.010),
 (1.810,.106,.109,0,.023),(1.835,.050,.053,0,.031)
]
ZMIN,ZMAX=1.526,1.765
ANGMAX=1.12
FACE_FILE=OUT/'wei_face_neutral_rgba.png'
BADGE_FILE=OUT/'wei_jacket_emblem.png'


def head_params(z):
 for a,b in zip(HEAD_RINGS[:-1],HEAD_RINGS[1:]):
  if a[0]<=z<=b[0]:
   t=(z-a[0])/(b[0]-a[0]);return tuple(a[j]*(1-t)+b[j]*t for j in range(1,5))
 if z<HEAD_RINGS[0][0]:return HEAD_RINGS[0][1:]
 return HEAD_RINGS[-1][1:]


def nose_bump(x,y,z):
 # Integrated raised nose bridge / tip, not an attached bead or cylinder.
 bridge=.010*np.exp(-((x/.030)**2)-(((z-1.629)/.070)**2))
 tip=.017*np.exp(-((x/.032)**2)-(((z-1.591)/.027)**2))
 return (bridge+tip)*max(0,min(1,-y/.11))**2


def sculpt_head(pd):
 cp=vtk.vtkPolyData();cp.DeepCopy(pd);points=cp.GetPoints()
 for i in range(points.GetNumberOfPoints()):
  x,y,z=points.GetPoint(i)
  points.SetPoint(i,x,y-nose_bump(x,y,z),z)
 points.Modified();cp.Modified()
 ns=vtk.vtkPolyDataNormals();ns.SetInputData(cp);ns.ConsistencyOn();ns.AutoOrientNormalsOn();ns.SplittingOff();ns.Update()
 return ns.GetOutput()


def face_poly(bob=0.0,nx=76,nz=58):
 points=vtk.vtkPoints();cells=vtk.vtkCellArray();uv=vtk.vtkFloatArray()
 uv.SetName('TCoords');uv.SetNumberOfComponents(2)
 for iz in range(nz+1):
  t=iz/nz;z=ZMIN+t*(ZMAX-ZMIN);rx,ry,cx,cy=head_params(z)
  for ix in range(nx+1):
   u=ix/nx;a=(2*u-1)*ANGMAX
   x=cx+rx*math.sin(a);y=cy-ry*math.cos(a)
   y-=nose_bump(x,y,z)+.0043*math.cos(a);x+=.0043*math.sin(a)
   points.InsertNextPoint(x,y,z+bob);uv.InsertNextTuple2(u,t)
 for iz in range(nz):
  for ix in range(nx):
   a=iz*(nx+1)+ix;b=a+1;c=a+nx+1;d=c+1
   for v in [(a,b,d),(a,d,c)]:
    tri=vtk.vtkTriangle()
    for k,q in enumerate(v):tri.GetPointIds().SetId(k,q)
    cells.InsertNextCell(tri)
 pd=vtk.vtkPolyData();pd.SetPoints(points);pd.SetPolys(cells);pd.GetPointData().SetTCoords(uv)
 return pd


def face_texture(path=FACE_FILE, expression='neutral'):
 """Hand-painted anime facial features; stored as 2D transparent texture."""
 W,H=1200,1000
 art=Image.new('RGBA',(W,H),(0,0,0,0));d=ImageDraw.Draw(art)
 def X(x,z=1.67):
  rx=head_params(z)[0]
  return int(W*(math.asin(max(-.999,min(.999,x/rx)))/ANGMAX+1)/2)
 def Y(z):return int(H*(ZMAX-z)/(ZMAX-ZMIN))
 def ln(p,color,w=6):d.line([(X(x,z),Y(z)) for x,z in p],fill=color,width=w,joint='curve')
 # Blurred cheek warmth and under-eye gradients in image space.
 layer=Image.new('RGBA',(W,H),(0,0,0,0));ld=ImageDraw.Draw(layer)
 for s in (-1,1):
  cx,cy=X(s*.102,1.601),Y(1.600)
  ld.ellipse((cx-65,cy-48,cx+65,cy+63),fill=(168,77,58,30))
 layer=layer.filter(ImageFilter.GaussianBlur(36));art.alpha_composite(layer)
 d=ImageDraw.Draw(art)
 for s in (-1,1):
  # Hero Shooter facial revision V2: the *whole* almond-shaped eye opening
  # is opaque white sclera. The iris and pupil are separate 2D pigment,
  # clipped *inside* the eye opening. There is no detached eye geometry.
  def point(x,z):return (X(s*x,z),Y(z))
  def bezier(a,b,c,d,n=24):
   return [((1-t)**3*a[0]+3*(1-t)**2*t*b[0]+3*(1-t)*t*t*c[0]+t**3*d[0],
            (1-t)**3*a[1]+3*(1-t)**2*t*b[1]+3*(1-t)*t*t*c[1]+t**3*d[1])
           for t in (i/n for i in range(n+1))]
  inner=point(.030,1.655)
  outer=point(.137,1.656)
  upper=bezier(inner,point(.046,1.672),point(.105,1.680),outer)
  lower=bezier(outer,point(.120,1.636),point(.057,1.633),inner)
  almond=upper+lower[1:]
  mask=Image.new('L',(W,H),0)
  md=ImageDraw.Draw(mask)
  md.polygon(almond,fill=255)
  # Solid white sclera fills both corners, above and below the iris.
  sclera=Image.new('RGBA',(W,H),(255,255,255,255))
  art.paste(sclera,(0,0),mask)
  # Natural dark chestnut iris, deep black pupil and two bright highlights.
  # The mask prevents iris pigment from crossing eyelids at any size.
  ex=X(s*.084,1.650)
  ey=Y(1.655)
  iris=Image.new('RGBA',(W,H),(0,0,0,0));idraw=ImageDraw.Draw(iris)
  idraw.ellipse((ex-53,ey-60,ex+53,ey+58),fill=(50,31,30,255))
  idraw.ellipse((ex-43,ey-49,ex+43,ey+51),fill=(124,76,53,255))
  idraw.ellipse((ex-34,ey-44,ex+34,ey+38),fill=(75,42,37,255))
  idraw.ellipse((ex-24,ey-45,ex+24,ey+42),fill=(13,12,18,255))
  # Highlights sit in the same ink layer, no extra 3D eye pieces.
  idraw.ellipse((ex-26,ey-38,ex-9,ey-18),fill=(255,255,255,255))
  idraw.ellipse((ex+15,ey+17,ex+21,ey+24),fill=(243,230,206,215))
  iris.putalpha(ImageChops.multiply(iris.getchannel('A'),mask))
  art.alpha_composite(iris)
  d=ImageDraw.Draw(art)
  # Deliberately dark anime upper eyelid; slimmer lower lash line.
  d.line(upper,fill=(29,24,27,255),width=10,joint='curve')
  d.line(lower,fill=(94,49,44,221),width=5,joint='curve')
  # Slight outward accent and a small upper outer lash.
  d.line([outer,point(.148,1.662)],fill=(30,24,28,255),width=8)
  d.line([point(.128,1.663),point(.143,1.676)],fill=(29,24,27,208),width=6)
  # Long asymmetric angled brows: serious but younger than father
  b=[(s*.034,1.702),(s*.055,1.707),(s*.079,1.708),(s*.116,1.702),(s*.136,1.694)]
  ln(b,(28,25,30,255),14)
  ln([(s*.043,1.715),(s*.070,1.716)],(89,57,49,90),3)
  # subdued temples, not middle-age wrinkles
  ln([(s*.139,1.664),(s*.148,1.658)],(122,74,57,76),3)
  ln([(s*.118,1.624),(s*.130,1.620)],(127,71,52,56),3)
  # tiny nostril color, mouth-corner shadows
  d.ellipse((X(s*.026,1.585)-7,Y(1.582)-3,X(s*.026,1.585)+7,Y(1.582)+3),fill=(102,53,44,122))
 # nose bridge highlight and short subtle cheek shadow
 ln([(-.007,1.627),(-.010,1.600)],(249,197,152,92),9)
 ln([(.037,1.602),(.024,1.597)],(133,76,52,67),4)
 if expression=='talking':
  d.ellipse((X(-.036,1.549),Y(1.550),X(.038,1.549),Y(1.518)),fill=(85,39,44,236))
  ln([(-.040,1.547),(.040,1.547)],(121,65,53,220),5)
 elif expression=='smirk':
  ln([(-.055,1.548),(-.020,1.548),(.022,1.548),(.056,1.560)],(88,49,47,244),7)
  ln([(-.023,1.537),(.030,1.541)],(178,92,76,145),5)
 else:
  # restrained flat anime mouth
  ln([(-.053,1.545),(-.017,1.545),(.020,1.543),(.053,1.546)],(88,49,43,247),6)
  ln([(-.031,1.537),(.026,1.537)],(178,90,76,126),4)
 art.save(path)
 return art


def make_badge():
 # The source character wears an embroidered 陳 insignia. Exact CJK glyph.
 im=Image.new('RGBA',(300,300),(0,0,0,0));d=ImageDraw.Draw(im)
 fontpath='/usr/share/fonts/truetype/arphic/uming.ttc'
 if not Path(fontpath).exists():
  import subprocess
  lines=subprocess.check_output(['fc-match','-f','%{file}',':lang=zh-cn'],text=True)
  fontpath=lines.strip().split('\n')[0]
 try:font=ImageFont.truetype(fontpath,190)
 except OSError:font=ImageFont.load_default()
 d.rounded_rectangle((15,10,285,290),radius=33,fill=(22,25,32,0),outline=(223,162,70,238),width=11)
 bbox=d.textbbox((0,0),'陳',font=font,stroke_width=0)
 tw,th=bbox[2]-bbox[0],bbox[3]-bbox[1]
 d.text(((300-tw)/2-bbox[0],(300-th)/2-bbox[1]),'陳',font=font,fill=(242,182,83,255))
 im.save(BADGE_FILE)
 return im


def quad_uv(corners):
 pts=vtk.vtkPoints();ps=vtk.vtkCellArray();u=vtk.vtkFloatArray()
 u.SetName('TCoords');u.SetNumberOfComponents(2)
 for p,t in zip(corners,[(0,0),(1,0),(1,1),(0,1)]):
  pts.InsertNextPoint(*p);u.InsertNextTuple2(*t)
 for triangle in [(0,1,2),(0,2,3)]:
  t=vtk.vtkTriangle()
  for k,v in enumerate(triangle):t.GetPointIds().SetId(k,v)
  ps.InsertNextCell(t)
 pd=vtk.vtkPolyData();pd.SetPoints(pts);pd.SetPolys(ps);pd.GetPointData().SetTCoords(u)
 return pd


def strand(points,radii,color,facets=8,segments_per_span=6):
 """Smooth tapered poly-mesh (not a collection of disconnected hair spheres)."""
 pts=np.asarray(points,dtype=float)
 rr=np.asarray(radii,dtype=float)
 tlist=np.linspace(0,len(pts)-1,(len(pts)-1)*segments_per_span+1)
 # cubic-interpolated space curve with endpoint clamping
 from scipy.interpolate import CubicSpline
 base=np.arange(len(pts))
 spts=np.stack([CubicSpline(base,pts[:,j],bc_type='natural')(tlist) for j in range(3)],axis=1)
 rad=np.interp(tlist,base,rr)
 tang=np.gradient(spts,axis=0)
 vertices=[];polys=vtk.vtkCellArray()
 for i,(p,r,t) in enumerate(zip(spts,rad,tang)):
  tangent=t/(np.linalg.norm(t)+1e-12)
  side=np.cross(tangent,[0,0,1.])
  if np.linalg.norm(side)<1e-3:side=np.cross(tangent,[0,1,0.])
  side=side/(np.linalg.norm(side)+1e-12);other=np.cross(tangent,side)
  for j in range(facets):
   a=j*math.pi*2/facets
   vertices.append(p+side*(r*math.cos(a))+other*(r*.64*math.sin(a)))
 for i in range(len(spts)-1):
  for j in range(facets):
   a=i*facets+j;b=i*facets+(j+1)%facets;c=(i+1)*facets+(j+1)%facets;d=(i+1)*facets+j
   quad=vtk.vtkQuad()
   for k,v in enumerate([a,b,c,d]):quad.GetPointIds().SetId(k,v)
   polys.InsertNextCell(quad)
 poly=vtk.vtkPolyData();vpts=vtk.vtkPoints()
 for v in vertices:vpts.InsertNextPoint(*v)
 poly.SetPoints(vpts);poly.SetPolys(polys)
 return poly,color


def build(gait='idle',phase=0.0):
 parts=[]
 def add(v):parts.append(v)
 c=2*math.pi*phase
 stride={'idle':0.0,'walk':.105,'run':.190}[gait]
 bob=.003*math.sin(2*c) if gait=='idle' else .005+.010*abs(math.sin(c))
 bend={'idle':0.0,'walk':.014,'run':.038}[gait]
 # SNEAKERS and fitted cargo trousers, with separate real toe caps / seams.
 for side in [-1,1]:
  sw=math.sin(c+(0 if side<0 else math.pi));st=stride*sw
  hip=(side*.125,.015,.915+bob)
  knee=(side*.130,-st*.44,.510+bob-bend*(1-abs(sw)))
  ankle=(side*.137,-st,.158+bob+bend*(1-abs(sw)))
  add(cylinder_between(hip,knee,.094,.090,C['pant'],18))
  add(uv_sphere(knee,(.095,.097,.109),C['pant']))
  add(cylinder_between(knee,ankle,.089,.074,C['pant'],18))
  # ripples in cargo fabric near cuffs, slight contrasting hem
  add(uv_sphere((ankle[0],ankle[1],.190+bob),(.080,.083,.033),C['pant_dark']))
  # ankle-height casual sneakers
  add(uv_sphere((ankle[0],ankle[1]-.056,.082+bob),(.105,.177,.088),C['shoe_side']))
  add(uv_sphere((ankle[0],ankle[1]-.095,.070+bob),(.100,.145,.050),C['shoe']))
  add(uv_sphere((ankle[0],ankle[1]-.105,.042+bob),(.109,.154,.031),C['sole']))
  add(uv_sphere((ankle[0],ankle[1]-.192,.080+bob),(.079,.060,.045),C['shoe_toe']))
  add(tube([(ankle[0]-.059,ankle[1]-.143,.117+bob), (ankle[0]+.059,ankle[1]-.143,.117+bob)],.006,C['shoe_toe']))
  for k in range(3):
   add(tube([(ankle[0]-.040,ankle[1]-.077-k*.023,.151-k*.011+bob),
             (ankle[0]+.040,ankle[1]-.077-k*.023,.151-k*.011+bob)],.0034,C['white']))
  # OUTER CARGO POCKETS on thighs (patches follow leg silhouette)
  py=-st*.24+.010
  add(uv_sphere((side*.235,py,.695+bob),(.026,.085,.105),C['pant_hi']))
  add(tube([(side*.248,py-.075,.740+bob),(side*.248,py+.065,.740+bob)],.006,C['pant_dark']))
  add(uv_sphere((side*.253,py-.028,.684+bob),(.010,.027,.015),C['button']))
  add(tube([(side*.219,py-.080,.801+bob),(side*.225,py-.047,.799+bob)],.006,C['pant_dark']))
 # Waist / belt with buckle and seam
 add(loft([(.875+bob,.210,.140,0,0),(.957+bob,.224,.150,0,0),(1.067+bob,.225,.143,0,0)],C['pant']))
 add(tube([(-.210,-.149,.951+bob),(.210,-.149,.951+bob)],.011,C['pant_dark']))
 add(uv_sphere((0,-.153,.954+bob),(.023,.010,.016),C['metal']))
 # HOODIE worn beneath zipped-open jacket, layered matte beige fabric.
 add(loft([(1.006+bob,.204,.123,0,0),(1.110+bob,.221,.135,0,0),
           (1.315+bob,.239,.155,0,0),(1.423+bob,.213,.133,0,0),(1.474+bob,.087,.086,0,0)],C['hoodie']))
 # Hood bulges behind head, and raised neck band; visually physically linked.
 add(uv_sphere((0,.086,1.441+bob),(.220,.125,.116),C['hoodie_dark']))
 add(uv_sphere((0,.082,1.471+bob),(.166,.113,.093),C['hoodie']))
 add(tube([(-.126,-.132,1.469+bob),(-.085,-.166,1.505+bob),(0,-.161,1.495+bob),
           (.085,-.166,1.505+bob),(.126,-.132,1.469+bob)],.018,C['hoodie_light']))
 # JACKET torso: sharper dark shoulders and tapered silhouette; half-open zipper.
 add(loft([(1.000+bob,.235,.153,0,0),(1.120+bob,.253,.166,0,0),
           (1.335+bob,.280,.169,0,0),(1.416+bob,.257,.163,0,0)],C['jacket']))
 # Hoodie front panel showing through open jacket (always on the negative-Y face)
 add(patch([(-.107,-.176,1.415+bob),(.107,-.176,1.415+bob),
            (.133,-.187,1.072+bob),(-.133,-.187,1.072+bob)],C['hoodie']))
 add(patch([(-.073,-.179,1.388+bob),(.073,-.179,1.388+bob),
            (.082,-.193,1.134+bob),(-.082,-.193,1.134+bob)],C['hoodie_light']))
 # Jacket folded lapels framing central tan hoodie / zipper
 add(patch([(-.266,-.170,1.399+bob),(-.120,-.174,1.411+bob),
            (-.103,-.191,1.125+bob),(-.227,-.173,1.125+bob)],C['jacket_hi']))
 add(patch([(.266,-.170,1.399+bob),(.120,-.174,1.411+bob),
            (.103,-.191,1.125+bob),(.227,-.173,1.125+bob)],C['jacket_hi']))
 # Zip rows and hem
 for s in (-1,1):
  add(tube([(s*.112,-.192,1.370+bob),(s*.110,-.200,1.182+bob),(s*.111,-.185,1.044+bob)],.006,C['shirt_zip']))
  add(tube([(s*.255,-.168,1.093+bob),(s*.165,-.187,1.093+bob)],.007,C['jacket_shadow']))
  # Ribbed fabric hem and pocket openings
  add(tube([(s*.113,-.191,1.051+bob),(s*.215,-.173,1.051+bob)],.015,C['jacket_rib']))
  add(tube([(s*.155,-.193,1.204+bob),(s*.244,-.175,1.222+bob)],.009,C['jacket_shadow']))
  add(uv_sphere((s*.130,-.199,1.070+bob),(.006,.006,.018),C['metal']))
 add(tube([(0,-.198,1.151+bob),(0,-.189,1.054+bob)],.004,C['hoodie_dark']))
 add(uv_sphere((0,-.199,1.167+bob),(.008,.007,.016),C['metal']))
 # Hoodie strings, hang into the jacket aperture
 for s in (-1,1):
  add(tube([(s*.056,-.174,1.424+bob),(s*.058,-.184,1.318+bob),(s*.061,-.188,1.290+bob)],.0055,C['hoodie_light']))
  add(uv_sphere((s*.061,-.188,1.286+bob),(.007,.007,.009),C['metal']))
 # Arms: jacket sleeves down to wrist, cuff bands, empty hands (neutral A-pose).
 for s in (-1,1):
  swing=stride*math.sin(c+(0 if s<0 else math.pi))
  sh=(s*.293,-.009,1.353+bob)
  elbow=(s*.346,.013+swing*.47,1.136+bob)
  wrist=(s*.338,-.002+swing*.88,.953+bob)
  add(uv_sphere(sh,(.080,.088,.097),C['jacket']))
  add(cylinder_between(sh,elbow,.083,.079,C['jacket'],18))
  add(uv_sphere(elbow,(.076,.087,.087),C['jacket_hi']))
  add(cylinder_between(elbow,wrist,.076,.064,C['jacket'],18))
  add(uv_sphere((s*.338,wrist[1],.974+bob),(.072,.075,.036),C['jacket_rib']))
  add(uv_sphere((s*.340,wrist[1],.918+bob),(.052,.055,.072),C['skin']))
  add(uv_sphere((s*.335,wrist[1]-.005,.877+bob),(.043,.046,.045),C['skin_light']))
  # Contrast shoulder panels, seams and sleeve patches
  add(tube([(s*.304,-.085,1.398+bob),(s*.365,-.068,1.268+bob),
            (s*.364,-.063,1.180+bob)],.008,C['jacket_shadow']))
  add(uv_sphere((s*.365,-.074,1.278+bob),(.017,.014,.062),C['jacket_hi']))
  # one sleeve patch for embroidered surname (actual accurate glyph mapped)
  if s<0:
   q=quad_uv([(s*.379,-.087,1.283+bob), (s*.310,-.087,1.283+bob),
              (s*.312,-.091,1.360+bob), (s*.378,-.090,1.360+bob)])
   add((q,C['gold'],'badge'))
  # watch on wrist partially beneath cuff (character right hand)
  if s>0:
   add(uv_sphere((s*.343,-.056+swing*.88,.947+bob),(.027,.013,.024),C['watch']))
 # Back side jacket seam and zipper/stitch details
 add(tube([(-.170,.165,1.388+bob),(-.172,.169,1.085+bob)],.006,C['jacket_hi']))
 add(tube([(.170,.165,1.388+bob),(.172,.169,1.085+bob)],.006,C['jacket_hi']))
 # Small square crest on upper BACK, readable at game scale
 badge=quad_uv([(-.055,.168,1.232+bob),(.055,.168,1.232+bob),
                (.055,.172,1.340+bob),(-.055,.172,1.340+bob)])
 add((badge,C['gold'],'badge'))
 # Crossbody strap/backpack: asymmetric, faithfully maintained in all views.
 # Shoulder viewer-right to wearer opposite hip, large angular fabric strap.
 add(tube([( .161,-.147,1.385+bob),(.074,-.192,1.300+bob),
           (-.054,-.190,1.174+bob),(-.185,-.160,1.048+bob)],.024,C['bag']))
 add(tube([(.158,-.171,1.398+bob),(.066,-.217,1.308+bob)],.005,C['bag_hi']))
 # One-shoulder backpack: bag behind left hip and on back
 add(uv_sphere((.147,.161,1.208+bob),(.170,.099,.224),C['bag']))
 add(uv_sphere((.147,.245,1.200+bob),(.136,.031,.167),C['bag_hi']))
 add(tube([(.038,.251,1.292+bob),(.245,.250,1.292+bob)],.006,C['bag']))
 add(uv_sphere((.140,.260,1.099+bob),(.022,.018,.014),C['metal']))
 # Head, jaw and physical ears (only the FEATURES are painted)
 add(uv_sphere((0,-.004,1.472+bob),(.080,.086,.112),C['skin']))
 hr=[(z+bob,rx,ry,x,y) for z,rx,ry,x,y in HEAD_RINGS]
 h,_=loft(hr,C['skin'],segments=112)
 add((sculpt_head(h),C['skin']))
 for s in (-1,1):
  add(uv_sphere((s*.151,-.001,1.628+bob),(.026,.037,.057),C['skin_shadow']))
  add(uv_sphere((s*.163,-.009,1.630+bob),(.015,.020,.033),C['skin']))
 add((face_poly(bob),C['skin'],'face'))
 # Youthful tousled hair: cap + swept sculpted groups + fringe that partly shields brow.
 add(uv_sphere((0,.022,1.783+bob),(.172,.145,.088),C['hair']))
 add(uv_sphere((0,.032,1.829+bob),(.159,.133,.076),C['hair_mid']))
 # back and temple locks
 for s in (-1,1):
  add(strand([(s*.155,.050,1.807+bob),(s*.176,.060,1.748+bob),
              (s*.179,.074,1.684+bob)],[.026,.030,.001],C['hair']))
  add(strand([(s*.155,-.020,1.795+bob),(s*.175,-.043,1.744+bob),
              (s*.161,-.045,1.686+bob)],[.026,.027,.001],C['hair_hi']))
 # rich top tuft clumps with various diagonal sways, dark red/brown highlights.
 for k,x in enumerate(np.linspace(-.140,.133,8)):
  dis=(k-3.5)/7
  add(strand([(x*.80,.046,1.846+bob),(x+.008,-.012,1.878+bob),
              (x+.026+dis*.014,-.070,1.866+bob),
              (x+.050+dis*.025,-.102,1.802+bob)],
             [.025,.031,.021,.001], C['hair_hi'] if k in (2,5) else C['hair']))
 # large side-swept dark front fringe - asymmetric, no mirrored fake.
 for k,(x,endx,endz) in enumerate([(-.14,-.123,1.724),(-.08,-.050,1.691),
                                     (-.030,.023,1.707),(.045,.096,1.748),(.10,.140,1.789)]):
  add(strand([(x,.002,1.847+bob),(x+.018,-.067,1.845+bob),
              (endx-.025,-.129,1.799+bob),(endx,-.139,endz+bob)],
             [.025,.034,.026,.001], C['hair_mid'] if k==1 else C['hair']))
 # warm-brown hair streaks remain subtle (no grey, unlike Mr Chen)
 add(strand([(-.118,-.060,1.847+bob),(-.060,-.107,1.848+bob),(.010,-.134,1.777+bob)],
            [.006,.009,.001],C['hair_amber']))
 add(strand([(.028,-.066,1.855+bob),(.075,-.094,1.840+bob),(.135,-.098,1.777+bob)],
            [.005,.007,.001],C['hair_hi']))
 # Headphones rest around neck / shoulders: metallic hoop and clear earcups.
 add(tube([(-.159,-.017,1.509+bob),(-.180,-.006,1.465+bob),
           (-.160,-.045,1.407+bob),(-.071,-.096,1.397+bob),
           (0,-.110,1.387+bob),(.090,-.097,1.397+bob),
           (.169,-.050,1.418+bob),(.185,.001,1.473+bob)],.018,C['cup']))
 for s in (-1,1):
  add(uv_sphere((s*.138,-.146,1.386+bob),(.067,.043,.075),C['cup_dark']))
  add(uv_sphere((s*.139,-.182,1.382+bob),(.054,.017,.066),C['cup']))
  add(tube([(s*.105,-.197,1.421+bob),(s*.154,-.203,1.433+bob),
            (s*.182,-.197,1.403+bob)],.005,C['metal']))
  add(uv_sphere((s*.137,-.202,1.380+bob),(.017,.005,.021),C['gold']))
 # 8 mm floor clearance correction after mesh inspection: no part below Z=0.
 lifted=[]
 for pd,color,*extras in parts:
  lifted.append((transform(pd,pos=(0,0,.008)),color,*extras))
 return lifted

def rotate_pd(pd,angle):
 t=vtk.vtkTransform();t.RotateZ(angle)
 f=vtk.vtkTransformPolyDataFilter();f.SetInputData(pd);f.SetTransform(t);f.Update();return f.GetOutput()

def make_actor(pd,col,tex=None):
 m=vtk.vtkPolyDataMapper();m.SetInputData(pd);a=vtk.vtkActor();a.SetMapper(m)
 p=a.GetProperty();p.SetColor(*rgb(col));p.SetAmbient(.37);p.SetDiffuse(.67);p.SetSpecular(.12);p.SetSpecularPower(27)
 if tex in ('face','badge'):
  rdr=vtk.vtkPNGReader();rdr.SetFileName(str(FACE_FILE if tex=='face' else BADGE_FILE));rdr.Update()
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
 elif mode=='close':
  cam.SetPosition(0,-3.7,1.68);cam.SetFocalPoint(0,0,1.685);cam.SetViewUp(0,0,1);cam.SetParallelScale(.30)
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
  if tex in ('face','badge'):
   uv=vtk_to_numpy(p.GetPointData().GetTCoords()).astype(np.float64)
   mat=trimesh.visual.material.PBRMaterial(baseColorTexture=Image.open(FACE_FILE if tex=='face' else BADGE_FILE).convert('RGBA'),baseColorFactor=[255,255,255,255],alphaMode='BLEND',doubleSided=True,metallicFactor=0.0,roughnessFactor=1.0)
   m=trimesh.Trimesh(vertices=pts,faces=faces,visual=trimesh.visual.TextureVisuals(uv=uv,material=mat),process=False)
   # Winding of the UV sheet is consistent and visible from the outside.
   scene.add_geometry(m,geom_name='material_painted_'+tex+str(len(scene.geometry)))
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
 face_texture();make_badge()
 parts=build('idle',0)
 path=OUT/'wei_chen_hybrid_vtk_v2.glb'
 scene,faces=export_glb(parts,path)
 # Four-view review / translucent background layers.
 labels=['FRONT','THREE-QUARTER','RIGHT PROFILE','BACK']
 imgs=[]
 for kind in ['front','quarter','profile','back']:
  im=render(parts,mode=kind,w=420,h=560)
  imgs.append(im);im.save(OUT/f'wei_chen_{kind}.png')
 panel=Image.new('RGB',(420*4,615),(22,22,28));d=ImageDraw.Draw(panel)
 for i,(title,im) in enumerate(zip(labels,imgs)):
  bg=Image.new('RGB',im.size,(34,35,46));bg.paste(im,(0,0),im)
  panel.paste(bg,(420*i,33));d.text((i*420+17,9),title,fill=(238,203,158))
 d.text((18,596),'WEI CHEN / Hero Shooter / Actual VTK 3D mesh with 2D UV facial art / Unrigged prototype',fill=(198,199,210))
 panel.save(OUT/'wei_chen_four_view.png')
 close=render(parts,'close',0,640,640);close.save(OUT/'wei_chen_face_closeup.png')
 headings=['S','SW','W','NW','N','NE','E','SE']
 rotations=[0,-45,-90,-135,180,135,90,45]
 dir_imgs=[]
 for head,deg in zip(headings,rotations):
  im=render(parts,'sprite',deg,180,270)
  im.save(OUT/f'wei_chen_facing_{head}.png')
  dir_imgs.append(im)
 direction=Image.new('RGB',(8*180,320),(22,23,29));dr=ImageDraw.Draw(direction)
 for i,(name,im) in enumerate(zip(headings,dir_imgs)):
  bg=Image.new('RGB',im.size,(38,40,51));bg.paste(im,(0,0),im)
  direction.paste(bg,(180*i,28));dr.text((i*180+81,6),name,fill=(229,183,96))
 dr.text((17,304),'S FRONT | N BACK | W LEFT-FACING | E RIGHT-FACING | +Z UP | -Y MODEL FRONT',fill=(208,213,225))
 direction.save(OUT/'wei_chen_direction_review.png')
 if not opt.preview_only:
  # Transparent 256x576 sprite atlas, reference game format; not a skeletal walk rig.
  atlas=Image.new('RGBA',(32*8,48*12),(0,0,0,0))
  for gi,gait in enumerate(['idle','walk','run']):
   for fi in range(4):
    ps=fi/4;item=build(gait,ps)
    for ci,deg in enumerate(rotations):
     im=render(item,'sprite',deg,128,192).resize((32,48),Image.Resampling.LANCZOS)
     atlas.paste(im,(ci*32,(gi*4+fi)*48))
  atlas.save(OUT/'wei_chen_8dir_12row_atlas.png')
  atlas.resize((768,1728),Image.Resampling.NEAREST).save(OUT/'wei_chen_atlas_3x_review.png')
 # Verify exported GLB can be reopened and has a textured UV mesh.
 reloaded=trimesh.load(path,force='scene',process=False)
 texmeshes=[k for k,v in reloaded.geometry.items() if isinstance(v.visual,trimesh.visual.TextureVisuals) and v.visual.uv is not None]
 tri_count=int(sum(len(g.faces) for g in reloaded.geometry.values()))
 bounds=np.array(reloaded.bounds).tolist()
 audit={'model':path.name,'renderer':'VTK '+vtk.vtkVersion.GetVTKVersion(),
 'trimesh':trimesh.__version__,'procedural_source':'build_wei_chen.py',
 'facial_revision':'v2: opaque white whole-eye almond sclera; larger dark-brown iris and black pupil with highlights, clipped to the eye area',
 'height_unit':'metres','coordinate_system':'+Z up; character forward -Y; +X screen-right in frontal view',
 'model_status':'real textured static 3D GLB prototype; unrigged (no skeleton, skin weights or animations)',
 'design_source':'Original Hero Shooter Wei Chen sprite sheet (Library) and public/assets/portraits/chen-family/wei-portrait-4x5.png (GitHub)',
 'hair':'youthful uneven side fringe; dark black-brown with subtle warm highlights, NO greying',
 'facial_method':'head-conforming UV art: full-white almond sclera with clipped iris/pupil, painted eyelids/brows/mouth + shallow sculpted nose; no glasses',
 'costume':'hoodie, charcoal work jacket, small true-text 陳 patches, cargo trousers, sneakers, headphones around neck, asymmetrical strap and backpack',
 'directions':headings,'rotations_3d_degrees':rotations,
 'atlas_cell_px':[32,48],'atlas_dimensions_px':[256,576],
 'atlas_rows':{'idle':[0,3],'walk':[4,7],'run':[8,11]},
 'rendering_note':'Sprite frames are separately posed VTK mesh renders; no armature or deformation rig.',
 'mesh_count':len(reloaded.geometry),'total_triangles':tri_count,
 'reimport_uv_textured_meshes':texmeshes,'bounds_metres':bounds,
 'continuous_mesh_note':'body is intentionally assembled from multiple overlapping material meshes; skin/cloth surface is visually continuous but NOT single connected watertight manifold',
 'outstanding_quality':'UV artwork and low-poly construction still need approved human likeness QA and rigging for runtime skeletal animation.'}
 (OUT/'wei_chen_audit.json').write_text(json.dumps(audit,indent=2),encoding='utf-8')
 (OUT/'README.md').write_text('''# Wei Chen — Hero Shooter procedural 3D prototype v2 (white sclera eye revision)

A **real VTK-built geometry model**, GLB export with embedded UV textures, and camera inspection images.
This is NOT an image-to-3D illusion, and is NOT rigged or runtime integrated.

## Fidelity

- Reference: original Hero Shooter Wei Chen sheet / repo portrait, **not** the generated glasses-and-vest concept.
- Young Chinese son of Mr Chen. Tousled black-brown fringe, anime painted eyes and mouth, **no glasses**.
- Eye revision: both entire eye openings are filled with opaque white sclera, larger chestnut-brown irises and deep black pupils, with highlights and clipping inside the almond-shaped eyelids.
- Dark work jacket with accurate 陳 patches, warm beige hoodie, headphones around neck, sling/shoulder bag, cargo pockets, sneakers.
- Model coordinate frame: +Z up; model forward is -Y. Main sprite front is `South`.
- Game atlas order: S, SW, W, NW, N, NE, E, SE; rows 0-3 idle, 4-7 walk, 8-11 run, 32×48 pixels/cell.

## Files

- `wei_chen_hybrid_vtk_v2.glb`: GLB static mesh with UV-textured face and clothing emblem.
- `build_wei_chen.py`: full reproducible Python+VTK+Pillow+numpy+scipy+trimesh geometry and export pipeline.
- `wei_face_neutral_rgba.png`: editable 2D anime face UV art, not separate eye geometry.
- `wei_jacket_emblem.png`: 2D gold embroidered glyph texture.
- `wei_chen_four_view.png` and `wei_chen_face_closeup.png`: inspection views.
- `wei_chen_direction_review.png`: labelled eight-way visual orientation review.
- `wei_chen_8dir_12row_atlas.png`: 256×576 preview sprite export, generated from 3D poses.
- `wei_chen_audit.json`: mesh/material count and bounds.

## Use

```bash
python build_wei_chen.py --out ./wei_output
```

No existing live assets were overwritten or wired into the game. No skeleton/weights/animation blending; facial animation can be implemented later by swapping the UV art texture.
''',encoding='utf-8')
 print('EXPORTED',path,'bytes',path.stat().st_size)
 print('TRIANGLES',tri_count,'UV textures',texmeshes,'BOUNDS',bounds)
 print('FILES', [(p.name,p.stat().st_size) for p in OUT.iterdir() if p.is_file()])


if __name__=='__main__':main()