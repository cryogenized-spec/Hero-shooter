#!/usr/bin/env python3
"""Hero Shooter scrapyard/skirmish arena prototype, modelled entirely with Python VTK.

Reference: supplied top-down scrapyard arena illustration (2026-11-22).
Units: metres. Authoring coordinates: X=east/right, Y=north/up-image, Z=height.
GLB export coordinates: X=east/right, Y=height, Z=south/down-image.
No source-image pixel projection: actual meshes for every prop.
Run: python build_scrapyard_arena.py --out /path/to/output
Requires: vtk, numpy, trimesh, Pillow.
"""
from __future__ import annotations
import argparse, json, math, os, random, sys, shutil
from pathlib import Path
from collections import defaultdict
import numpy as np
import vtk
from vtk.util import numpy_support
import trimesh
from PIL import Image

R=random.Random(29112026)
COLORS={
 'ground': '#936344', 'earth2':'#a47451','earth3':'#8c5a40','earth4':'#785039','earthlight':'#be885b',
 'dirt_dark':'#704d3e','stone':'#79695d','grass':'#708236','grass2':'#8b9442','yellow':'#e9b23f',
 'amber':'#ffc878','white':'#d4d1c4','concrete':'#b4a59a','concrete_light':'#d3c4b2',
 'concrete_dark':'#7a756c','concrete_stripe':'#ddac3f','black':'#24262a',
 'steel':'#535a5e','steel_light':'#9c9990','steel_dark':'#36383d', 'fence':'#777f7b',
 'blue':'#426384','blue_dark':'#304a65','red':'#91483d','rust':'#ad5736','rust_light':'#c37948',
 'rust_dark':'#713d31','orange':'#da8842','wood':'#99613c','wood_light':'#bf8753',
 'wood_dark':'#63412b','green':'#527745','green_light':'#83a255','bottle':'#397441',
 'bottle_brown':'#80512f','glass':'#90b3be','skin':'#dcb177','cloth':'#b9986c',
 'puddle':'#4b5963', 'oil':'#444445', 'light':'#ffd28a', 'shadow':'#6b503b',
}

def rgb(hexstr):
 h=hexstr.lstrip('#'); return tuple(int(h[i:i+2],16)/255 for i in (0,2,4))

# Gather VTK PolyData by material for low draw calls and single-file glTF transfer.
parts=defaultdict(list)
colliders=[]
landmarks=[]
spawn_points=[]
tri_count=0

def add_poly(poly,color):
 if poly is None or not poly.GetNumberOfCells():return
 parts[color].append(poly)

def transform_poly(poly,translation=(0,0,0), rotation=(0,0,0), scale=(1,1,1)):
 tr=vtk.vtkTransform(); tr.PostMultiply()
 tr.Scale(*scale)
 for a,axis in zip(rotation,('X','Y','Z')):
  if a: getattr(tr,'Rotate'+axis)(a)
 tr.Translate(*translation)
 tf=vtk.vtkTransformPolyDataFilter();tf.SetInputData(poly);tf.SetTransform(tr);tf.Update()
 result=vtk.vtkPolyData();result.ShallowCopy(tf.GetOutput());return result

def cube(x,y,z,sx,sy,sz,col,rot=0):
 src=vtk.vtkCubeSource();src.SetXLength(max(0.008,sx));src.SetYLength(max(.008,sy));src.SetZLength(max(.008,sz));src.Update()
 add_poly(transform_poly(src.GetOutput(),(x,y,z),(0,0,rot)),col)

def cylinder(x,y,z,rad,height,col,res=10,orient='z',rot=0):
 src=vtk.vtkCylinderSource();src.SetRadius(rad);src.SetHeight(height);src.SetResolution(res);src.CappingOn();src.Update()
 # native cylinder Y-axis; make upright Z-axis. x-axis for horizontal pipe.
 angles={'z':(90,0,rot),'x':(0,0,90+rot),'y':(0,0,rot)}
 add_poly(transform_poly(src.GetOutput(),(x,y,z),angles[orient]),col)

def ellipsoid(x,y,z,sx,sy,sz,col,theta=12,phi=8,rot=0):
 src=vtk.vtkSphereSource();src.SetThetaResolution(theta);src.SetPhiResolution(phi);src.Update()
 add_poly(transform_poly(src.GetOutput(),(x,y,z),(0,0,rot),(sx,sy,sz)),col)

def rod(a,b,r,col,res=6):
 p=np.array(a,dtype=float);q=np.array(b,dtype=float);v=q-p
 L=np.linalg.norm(v)
 if L<.008: return
 src=vtk.vtkCylinderSource();src.SetRadius(r);src.SetHeight(float(L));src.SetResolution(res);src.CappingOn();src.Update()
 # Rotate the default Y axis to segment vector.
 tr=vtk.vtkTransform();tr.PostMultiply()
 yy=vtk.vtkMath(); axis=np.cross([0,1.,0],v/L)
 if np.linalg.norm(axis)<1e-7:
  if np.dot([0,1.,0],v/L)<0:tr.RotateX(180)
 else:
  axis=axis/np.linalg.norm(axis)
  angle=math.degrees(math.acos(np.clip(np.dot([0,1.,0],v/L),-1,1)))
  tr.RotateWXYZ(angle,*axis)
 tr.Translate(*((p+q)*.5))
 tf=vtk.vtkTransformPolyDataFilter();tf.SetInputData(src.GetOutput());tf.SetTransform(tr);tf.Update()
 result=vtk.vtkPolyData();result.ShallowCopy(tf.GetOutput()); add_poly(result,col)

def quad(corners,col):
 pts=vtk.vtkPoints()
 for p in corners:pts.InsertNextPoint(*p)
 polygon=vtk.vtkPolygon();polygon.GetPointIds().SetNumberOfIds(len(corners))
 for i in range(len(corners)):polygon.GetPointIds().SetId(i,i)
 cells=vtk.vtkCellArray();cells.InsertNextCell(polygon)
 poly=vtk.vtkPolyData();poly.SetPoints(pts);poly.SetPolys(cells)
 add_poly(poly,col)

def decal(x,y,sx,sy,col,rotation=0,z=.025):cube(x,y,z,sx,sy,.016,col,rotation)

def box_collider(name,x,y,w,d,h=1.5,z=None,rot=0,kind='solid'):
 colliders.append({'name':name,'type':'box','center':[round(x,3),round(y,3),round(h/2 if z is None else z,3)],
  'size':[round(w,3),round(d,3),round(h,3)],'yaw_deg':round(rot,3),'kind':kind})

def circle_collider(name,x,y,r,h=1.5):
 colliders.append({'name':name,'type':'cylinder','center':[round(x,3),round(y,3),round(h/2,3)],'radius':r,'height':h,'kind':'solid'})

def landmark(name,x,y,kind):landmarks.append({'name':name,'x':round(x,2),'y':round(y,2),'kind':kind})

# world dimension & texture-like ground patches
W,H=50.,28.
cube(0,0,-.24,50,28,.48,'ground')
# irregular ground stains, cracks, pebbles and sparse tufts
for i in range(200):
 x=R.uniform(-24.4,24.4);y=R.uniform(-13.5,13.5)
 size=R.uniform(.15,1.5)
 if R.random()<.65:
  ellipsoid(x,y,.023,size*1.6,size*.58,.02,R.choice(['earth2','earth3','earth4','dirt_dark','earthlight']),12,5, R.randint(0,170))
for i in range(410):
 x=R.uniform(-24.4,24.4);y=R.uniform(-13.4,13.4)
 s=R.uniform(.018,.09)
 if R.random()<.78:
  cube(x,y,.035,s*1.5,s*.7,.04,R.choice(['stone','concrete_dark','wood_dark','rust_dark']),R.randint(0,180))
 else:
  for j in range(3):
   rod((x,y,.035),(x+R.uniform(-.16,.16),y+R.uniform(-.14,.14),R.uniform(.09,.27)),.019,R.choice(['grass','grass2']),4)
# dry grass along perimeter
for i in range(270):
 side=R.choice([0,1,2,3]);x=R.uniform(-25,25) if side<2 else R.choice([-24.4,24.4])+R.uniform(-.5,.5)
 y=R.choice([-13.5,13.5])+R.uniform(-.3,.3) if side<2 else R.uniform(-13.5,13.5)
 for _ in range(R.randint(2,4)):
  a=R.random()*6.28;l=R.uniform(.08,.32)
  rod((x,y,.06),(x+math.cos(a)*l,y+math.sin(a)*l,R.uniform(.1,.3)),.025,R.choice(['grass','grass2']),4)

# wheel ruts through center, concentric arcs near pipe pile
for r in [6.65,7.0]:
 for deg in range(0,295,7):
  t=math.radians(deg)
  x=-1.8+r*math.cos(t);y=-1+r*.59*math.sin(t)
  x2=-1.8+r*math.cos(t+.065);y2=-1+r*.59*math.sin(t+.065)
  rod((x,y,.037),(x2,y2,.037),.022,'earth4',4)
for j in range(12):
 x=R.uniform(-13,14);y=R.uniform(-7,9)
 rod((x,y,.035),(x+R.uniform(.2,.8),y+R.uniform(-.18,.18),.035),.02,'earth4',4)

# front entrance road markings and two big open-leaf chainlink gate spans
for x in np.arange(-4,4.1,.7):decal(x,-13.36,.35,.13,'yellow',0)
for i in range(7):
 x=-4.0+i*1.36; decal(x,-13.82,.95,.09,'yellow',0)
# directional arrow just inside entry
for x,y in [(-.1,-12.6),(-.1,-12.2),(-.1,-11.8)]:decal(x,y,.13,.38,'yellow')
rod((-.8,-11.85,.038),(0,-11.3,.038),.075,'yellow');rod((.8,-11.85,.038),(0,-11.3,.038),.075,'yellow')

# chainlink fence panel with actual wire geometry, two horizontal structural rails
# fence is in 3D with partial diamond wire mesh -- no translucent cardboard planes.
def fence_segment(ax,ay,bx,by,height=2.45,gate=False,wire=True):
 a=np.array([ax,ay]);b=np.array([bx,by]);v=b-a;length=np.linalg.norm(v);direct=v/length
 normal=np.array([-direct[1],direct[0]])
 for p in [a,b]:
  cube(p[0],p[1],height*.5,.095,.095,height,'steel_dark')
  cylinder(p[0],p[1],height+.02,.1,.08,'steel_light',8)
 for z in [.35,1.25,2.27]:rod((ax,ay,z),(bx,by,z),.037,'fence',6)
 if not wire:return
 # diamond grid diagonals clipped into a rectangular panel in fence parametric coords
 pitch=.54
 for shift in np.arange(-height-1.0,length+height+1.,pitch):
  # lines s = z + shift or s = -z + shift
  for slope in (-1.,1.):
   seg=[]
   for zz in np.linspace(.38,2.25,8):
    ss=shift+slope*zz
    if 0<=ss<=length:seg.append((ss,zz))
   if len(seg)<2:continue
   p1=a+direct*seg[0][0];p2=a+direct*seg[-1][0]
   rod((p1[0],p1[1],seg[0][1]),(p2[0],p2[1],seg[-1][1]),.012,'fence',4)

# perimeter with post ~4m; bottom gate gap 5.3m
for line in [(np.linspace(-24.6,24.6,13),13.65,'x'),(np.linspace(-24.6,24.6,13),-13.65,'x'),
             (np.linspace(-13.65,13.65,8),-24.6,'y'),(np.linspace(-13.65,13.65,8),24.6,'y')]:
 vals,constant,axis=line
 for a,b in zip(vals[:-1],vals[1:]):
  if axis=='x' and constant<0 and max(a,-2.85)<min(b,2.85):
   # leave full panel off in front gate
   continue
  if axis=='x':fence_segment(a,constant,b,constant,wire=True)
  else:fence_segment(constant,a,constant,b,wire=True)
# gate leaves swung outward at x about +-3.0
fence_segment(-3.0,-13.65,-4.6,-12.0,2.40,True)
fence_segment(3.0,-13.65,4.6,-12.0,2.40,True)
for x in [-3.1,3.1]:
 cube(x,-13.7,1.25,.25,.25,2.6,'steel_dark')
 # marker stripe
 cube(x,-13.7,.12,.28,.28,.12,'yellow')
 box_collider('gate_post_'+str(x),x,-13.7,.27,.27,2.6)
# sidelight posts front & back

def lamp(x,y,h=3.5,version=1):
 cylinder(x,y,h/2,.085,h,'steel_dark',8)
 cube(x,y,h-.12,.70,.33,.19,'orange');cube(x,y+.03,h-.12,.60,.12,.12,'amber')
 box_collider('light_post_'+str(round(x,2))+'_'+str(round(y,2)),x,y,.2,.2,h)
for x,y in [(-21,-13.4),(-1.95,-13.2),(2,-13.2),(22.6,-13.2),(-15,13.4),(-1.4,13.4),(17.8,13.4)]:lamp(x,y,3.5)

# industrial shipping containers: corrugations, corners, double doors, roof ribs
container_i=0
def container(x,y,l,w,h,body='rust',yaw=0,door='east',raised=False):
 global container_i
 container_i+=1
 cube(x,y,h/2,l,w,h,body,yaw)
 for s in (-1,1):
  cube(x,y+s*(w/2-.08),h*.5,l,.08,h-.14,'rust_dark' if body=='rust' else 'blue_dark',yaw)
  for xx in np.arange(-l/2+.15,l/2-.1,.38):
   # side corrugation on north/south face, with local transforms
   X=x+xx*math.cos(math.radians(yaw))-s*(w/2+.025)*math.sin(math.radians(yaw))
   Y=y+xx*math.sin(math.radians(yaw))+s*(w/2+.025)*math.cos(math.radians(yaw))
   cube(X,Y,h/2,.062,.046,h*.84,'rust_light' if body=='rust' else 'steel_light',yaw)
 for a in (-1,1):
  for b in (-1,1):
   X=x+a*(l/2-.095)*math.cos(math.radians(yaw))-b*(w/2-.085)*math.sin(math.radians(yaw))
   Y=y+a*(l/2-.095)*math.sin(math.radians(yaw))+b*(w/2-.085)*math.cos(math.radians(yaw))
   cube(X,Y,h*.5,.10,.13,h,'steel_dark',yaw)
 for zz in np.arange(.15,h-.1,.42):cube(x,y,zz,l,.04,.03,'rust_dark' if body=='rust' else 'blue_dark',yaw)
 cube(x,y,h+.05,l+.10,w+.10,.10,'steel_dark',yaw)
 box_collider('container_'+str(container_i),x,y,l,w,h,rot=yaw)
 landmark('container_'+str(container_i),x,y,'cover')

# corrugated roof shed at rear right
container(-21.15,10.3,6.2,2.7,2.45,'rust')
cube(-21.15,8.55,2.35,5.8,1.7,.12,'rust_dark')
for xx in np.arange(-23.75,-18.55,.39):cube(xx,8.55,2.43,.08,1.7,.06,'rust_light')
# container pop-up door / shelves / bottle bar
cube(-21.15,8.48,1.22,3.6,.42,1.8,'wood_dark')
for x in np.arange(-22.7,-19.6,.55):
 cylinder(x,8.25,1.99,.082,.32,'bottle',8)
 cylinder(x,8.25,2.17,.047,.07,'white',6)
# junkyard piles across back border, tires, appliances, car carcasses, dumpsters
for i in range(75):
 x=R.uniform(-17.5,5.4);y=R.uniform(10.55,12.8)
 if R.random()<.40:
  cube(x,y,.45,R.uniform(.35,1.0),R.uniform(.3,1),R.uniform(.45,1),R.choice(['steel','steel_dark','concrete_dark','rust_dark','wood']),R.randint(-50,50))
 elif R.random()<.5:
  cylinder(x,y,.33,.25,.45,R.choice(['rust','steel','steel_dark']),8)
 else:
  ellipsoid(x,y,.4,.52,.31,.30,R.choice(['rust','blue_dark','concrete_dark']),8,6)
# wrecked sedans: wheel disks + cabin + body + panels
car_id=0
def wreck_car(x,y,angle=0,col='rust',scale=1):
 global car_id
 car_id+=1
 # transform location of car feature according yaw
 a=math.radians(angle)
 def pt(dx,dy,z):return x+scale*(dx*math.cos(a)-dy*math.sin(a)),y+scale*(dx*math.sin(a)+dy*math.cos(a)),z*scale
 def bc(dx,dy,z,sx,sy,sz,c):
  X,Y,Z=pt(dx,dy,z);cube(X,Y,Z,scale*sx,scale*sy,scale*sz,c,angle)
 bc(0,0,.65,3.35,1.72,.58,col)
 bc(-.2,0,1.19,1.72,1.46,.55,'steel_dark')
 bc(-.2,0,1.50,1.78,1.15,.12,col)
 for tx in [-1.2,1.1]:
  for sy in [-.91,.91]:
   X,Y,Z=pt(tx,sy,.48);cylinder(X,Y,Z,.38,.23,'black',12,'y',angle)
   cylinder(X,Y,Z,.18,.25,'steel_light',10,'y',angle)
 for tx in [-1.4,1.4]:
  X,Y,Z=pt(tx,0,.98);bc(tx,0,.98,.11,1.1,.15,'steel_light')
 for tx in [-1.67,1.67]:
  X,Y,Z=pt(tx,0,.5);bc(tx,0,.5,.09,1.65,.12,'steel_dark')
 box_collider('wreck_car_'+str(car_id),x,y,3.45*scale,1.9*scale,1.8*scale,rot=angle)
 landmark('wreck_car_'+str(car_id),x,y,'wreck')

wreck_car(-14.6,11.2,21,'red',1.12)
wreck_car(-8.8,11.6,-16,'blue',1)
wreck_car(4.1,11.8,27,'rust',.93)
wreck_car(-14.9,6.0,7,'red',.80)
wreck_car(10.0,-10.3,-17,'rust',.94)
# left-center low obstacles and ruined washer
cube(-12.5,2.5,.43,.9,.83,.85,'white');cube(-12.5,2.10,.5,.62,.04,.65,'steel_dark')
cylinder(-12.5,2.06,.65,.29,.06,'steel_light',12,'y')
for x,y in [(-12.5,3.6),(-9.4,5.2),(-16.2,3.0)]:
 cylinder(x,y,.42,.26,.78,'rust',10);cylinder(x,y,.82,.27,.06,'steel_dark',10)

# targets on simple stands, stand plate facing south
def target(x,y,style='paper',facing='south',scale=1):
 rod((x-.24*scale,y,0),(x-.24*scale,y,1.3*scale),.04,'steel_dark')
 rod((x+.24*scale,y,0),(x+.24*scale,y,1.3*scale),.04,'steel_dark')
 if style=='paper':
  cube(x,y,1.46*scale,.92*scale,.055*scale,1.20*scale,'concrete_light')
  cube(x,y-.047*scale,1.47*scale,.65*scale,.01*scale,.96*scale,'white')
  cylinder(x,y-.060*scale,1.51*scale,.26*scale,.015,'steel_dark',10,'y')
  cylinder(x,y-.080*scale,1.51*scale,.15*scale,.018,'rust_light',10,'y')
 else:
  ellipsoid(x,y,1.5*scale,.26*scale,.11*scale,.46*scale,'black',10,7)
  ellipsoid(x,y,1.02*scale,.32*scale,.13*scale,.44*scale,'black',10,7)
 box_collider('target_'+str(round(x,2))+'_'+str(round(y,2)),x,y,1.0*scale,.12,2.1*scale,kind='shootable')
for x in [-15,-13.7,-12.4]:target(x,8.2,scale=.87)
for x in [8.4,9.7,11.0]:target(x,9.5,scale=.84)
target(16.9,4.3,scale=.87)
# wood pallets, barrels, tires, crates
prop_counts=defaultdict(int)
def pallet(x,y,size=1.1,rot=0):
 prop_counts['pallet']+=1
 for dy in [-.43*size,0,.43*size]:cube(x,y+dy,.19,1.2*size,.13*size,.20,'wood',rot)
 for dx in [-.4*size,.4*size]:cube(x+dx,y,.07,.13*size,1.12*size,.14,'wood_dark',rot)
 box_collider('pallet_'+str(prop_counts['pallet']),x,y,1.2*size,1.13*size,.23,rot=rot)

def barrel(x,y,col='rust',h=.92,rot=0):
 prop_counts['barrel']+=1
 cylinder(x,y,h/2,.31,h,col,12)
 for z in [.10,h*.53,h-.1]:cylinder(x,y,z,.32,.075,'steel_dark',12)
 cylinder(x,y,h+.014,.27,.025,'steel_light',12)
 circle_collider('barrel_'+str(prop_counts['barrel']),x,y,.35,h)

def tire(x,y,scale=1,stack=1):
 prop_counts['tire']+=1
 for i in range(stack):
  z=.20*scale+i*.30*scale
  cylinder(x,y,z,.36*scale,.27*scale,'black',12)
  cylinder(x,y,z+.146*scale,.18*scale,.025,'steel_dark',12)
 circle_collider('tirestack_'+str(prop_counts['tire']),x,y,.4*scale,stack*.31*scale)

def crate(x,y,s=.8,rot=0):
 prop_counts['crate']+=1
 cube(x,y,s*.52,s,s,s,'wood',rot)
 for d in [-.43,.43]:
  cube(x+d*s,y,s*.55,.07*s,s*.95,.90*s,'wood_light',rot)
  cube(x,y+d*s,s*.55,.95*s,.07*s,.90*s,'wood_dark',rot)
 for d in [0,.38*s,.70*s]:cube(x,y,s*.15+d,.90*s,.88*s,.045,'wood_light',rot)
 box_collider('crate_'+str(prop_counts['crate']),x,y,s,s,s,rot=rot)

for x,y in [(-23.0,3.5),(-21.2,4.0),(-19.3,3.5),(-17.7,8.1),(-6.0,3.6),(2.0,12.0),(7.0,10.8),(9.0,10.4),(18.6,10.1),(22.6,6.9),(-14.0,-4.3),(-7.1,-5.1),(3.6,-2.7),(11,-3.1),(20.5,-6.8),(-19.2,-11.0)]:
 barrel(x,y,R.choice(['rust','rust_light','blue','steel_dark']))
for x,y,n in [(-19.8,2.4,2),(-6.5,4.8,2),(1.9,10.0,3),(6.7,8.4,2),(11,5,2),(4.7,-7.3,2),(-21,-6.5,2),(12,-5,2),(24,-8,2)]:tire(x,y,1,n)
for x,y,s in [(-17.1,4.2,1.4),(-14.5,-6.1,1.1),(-9.4,3.8,.92),(4.5,3.8,1.0),(14.4,4.2,.89),(20.4,4.3,.7),(-12.2,-9.7,.92),(-10.2,-10.1,.75),(5.2,-7.4,1.1),(14.9,-10.2,.8),(21.3,-7.9,1.4)]:crate(x,y,s)
for x,y in [(-22.3,7.2),(-20.1,3.3),(-14,-10.6),(-.5,-2.3),(18.3,-10.5),(22,-11.6),(-4.8,-6.5)]:pallet(x,y,R.uniform(.85,1.15))

# segmented concrete modular L- and U-cover waist-high walls
wall_i=0
def concrete_wall(x,y,l=2.0,yaw=0,h=1.25):
 global wall_i
 wall_i+=1
 a=math.radians(yaw)
 def wallpoint(d):return x+d*math.cos(a),y+d*math.sin(a)
 count=max(1,round(l/0.77))
 step=l/count
 for i in range(count):
  xx,yy=wallpoint((i+.5)*step-l/2)
  cube(xx,yy,h/2,step-.035,.44,h,'concrete',yaw)
  # darker inset on face, top segment joint and hazard stripe at foot
  cube(xx,yy,h+.016,step-.04,.47,.05,'concrete_light',yaw)
  for f in (-1,1):
   fx=xx-f*.225*math.sin(a);fy=yy+f*.225*math.cos(a)
   cube(fx,fy,.20,step*.55,.035,.22,'concrete_dark',yaw)
 box_collider('concrete_cover_'+str(wall_i),x,y,l,.49,h,rot=yaw)

concrete_wall(-12.8,7.1,3.9,0,1.18)
concrete_wall(-5.0,7.45,2.25,0,1.25)
concrete_wall(8.9,7.6,2.5,110,1.3)
concrete_wall(13.0,6.2,2.45,90,1.25)
concrete_wall(16.2,5.6,3.5,0,1.1)
concrete_wall(19.7,5.6,2.9,0,1.0)
# upper right cover zigzag
concrete_wall(12.1,3.6,4.0,0)
concrete_wall(12.2,1.8,3.1,90)
concrete_wall(16.2,2.2,2.5,90)
# middle right u-shaped
concrete_wall(10.5,-2.1,4.9,0)
concrete_wall(8.1,-3.6,3.8,90)
concrete_wall(12.8,-3.6,3.4,90)
concrete_wall(11.7,-5.25,2.2,0)
# lower center left cover
concrete_wall(-6.8,-8.3,5.1,0)
concrete_wall(-9,-8.9,1.8,90)
concrete_wall(-4.3,-9.1,1.5,90)
# front right car cover
concrete_wall(10.3,-10.9,2.9,0)

# yellow stripe painting on concrete blocks / barricade bases
for bx,by in [(-12.7,6.7),(13.0,5.6),(19.5,5.1),(10.2,-10.5)]:
 for i in range(5):
  cube(bx-1.0+i*.5,by,.2,.22,.03,.32,'yellow', -24)

# central 3D raised blue shipping container with playable rooftop & stair approach
container(-.6,6.1,6.1,3.1,2.75,'blue')
# roof deck floor
cube(-.6,6.1,2.88,6.1,3.2,.18,'wood')
# deck planks
for xx in np.arange(-3.3,2.5,.34):cube(xx,6.1,2.98,.10,3.2,.05,'wood_light')
# yellow painted handrails (except where stairs connect)
def railing(ax,ay,bx,by,h1=2.98,h2=4.08):
 rod((ax,ay,h2),(bx,by,h2),.042,'yellow')
 rod((ax,ay,h1+.55),(bx,by,h1+.55),.026,'yellow')
 length=math.dist((ax,ay),(bx,by));count=max(2,round(length/1.1))
 for i in range(count+1):
  t=i/count
  x=ax+(bx-ax)*t;y=ay+(by-ay)*t
  rod((x,y,h1),(x,y,h2+.10),.034,'yellow')
# north, west, east fence deck rails, partial south rail leaving stairs access
railing(-3.68,7.75,2.45,7.75)
railing(2.47,7.75,2.47,4.5)
railing(-3.68,7.75,-3.68,4.5)
railing(-3.68,4.5,-2.35,4.5)
railing(-.85,4.5,2.45,4.5)
# stairs southwest: ascending from ground at (-6.1,1.5) up to (-2.1,4.7)
steps=13
for i in range(steps):
 t=(i+.5)/steps
 x=-6.2+3.7*t;y=1.65+2.5*t
 z=(i+1)*2.78/steps
 # visual step riser + tread
 cube(x,y,z*.5,.53,1.24,z,'steel_dark',-15)
 cube(x,y,z+.045,.64,1.30,.09,'steel_light',-15)
# handrails on stairs along diagonals
for offset in [-.71,.71]:
 ra=(-6.45,1.60+offset,.85);rb=(-2.58,4.18+offset,3.65)
 rod(ra,rb,.045,'yellow')
 for i in range(7):
  t=i/6;x=ra[0]*(1-t)+rb[0]*t;y=ra[1]*(1-t)+rb[1]*t
  z=.25+2.8*t
  rod((x,y,z),(x,y,z+.84),.035,'yellow')
# rail bridge or ladder at rear north corner
for j in range(3):
 barrel(-2.3+j*.84,6.0,'blue',.74)
# sign and prop target on front face of container
cube(.3,4.49,1.6,.66,.06,.96,'white')
cylinder(.3,4.45,1.61,.27,.025,'steel_dark',9,'y')
for j in range(4):
 cylinder(-1.7+j*.35,4.46,1.28,.08,.25,'bottle',8)
box_collider('central_stairs_foot',-4.4,2.8,3.8,2.1,2.9,rot=32,kind='stairs')
landmark('central elevated container',-.6,6.1,'elevated')

# industrial pipe stack center, hollow detail as half inner cylinder cap illusion
for x,y,z,r in [(-2.4,-1.2,.6,.75),(-.8,-1.1,.6,.75),(-2.0,-1.4,1.72,.76),(-.4,-1.5,1.72,.72)]:
 cylinder(x,y,z,r,2.75,'rust_light',12,'x')
 # rim at both ends; inside dark circular port as nested cylinder end caps
 for sx in [-1.39,1.39]:
  cylinder(x+sx,y,z,r+.045,.14,'rust',12,'x')
  cylinder(x+sx*1.04,y,z,r*.72,.025,'steel_dark',12,'x')
 box_collider('pipe_section_'+str(round(x,2))+'_'+str(round(z,2)),x,y,2.9,1.8,2.6)
pallet(-4.3,-1.5,1.0,22)

# shooter's practice tent at upper right with targets and bottle tables
for px in [10.4,19.0]:
 for py in [10.1,12.6]:rod((px,py,0),(px,py,3.0),.07,'steel_dark')
# roof apex and colored corrugated roof tiles
quad([(10.0,9.75,3.03),(19.3,9.75,3.03),(19.3,13.0,3.48),(10.0,13.0,3.48)],'rust')
for px in np.arange(10.12,19.2,.42):
 rod((px,9.73,3.07),(px,13.0,3.49),.045,'rust_light')
for x in [11.4,12.65,14,15.35,16.7]:
 rod((x,12.45,2.75),(x,12.45,1.95),.023,'steel_light')
 cylinder(x,12.45,1.83,.34,.08,'black',10,'y')
# shooting mannequin and bottles
for x in [17.5,18.05,18.6]:
 cylinder(x,10.2,.95,.09,.35,'bottle',8)
 cylinder(x,10.2,1.13,.04,.08,'white',7)

# mannequin torso targets: stylized flat humanoid shapes
man_id=0
def mannequin(x,y,scale=1):
 global man_id
 man_id+=1
 cylinder(x,y,1.25*scale,.055,2.0*scale,'steel_dark',7)
 cube(x,y,1.48*scale,.62*scale,.25*scale,.88*scale,'skin')
 ellipsoid(x,y,2.10*scale,.23*scale,.21*scale,.27*scale,'skin',10,7)
 ellipsoid(x,y,1.03*scale,.35*scale,.23*scale,.22*scale,'skin',10,7)
 cylinder(x,y,.16*scale,.44*scale,.32*scale,'black',12)
 box_collider('mannequin_'+str(man_id),x,y,.74,.52,2.45,kind='shootable')
for x,y in [(-6.9,-9.5),(-4.7,-9.4),(-2.6,-9.7),(13.7,-2.6),(16.8,11.8)]:mannequin(x,y,.82 if y>0 else 1)

# far right tower with four support struts, upper hut and stairway
TXX,TYY=21.8,9.7
for dx in [-1.35,1.35]:
 for dy in [-1.2,1.2]:rod((TXX+dx,TYY+dy,.0),(TXX+dx,TYY+dy,5.1),.115,'steel_dark',8)
for z in [1.6,3.0,4.7]:
 for x in [-1.35,1.35]:rod((TXX+x,TYY-1.2,z),(TXX+x,TYY+1.2,z),.050,'steel')
 for y in [-1.2,1.2]:rod((TXX-1.35,TYY+y,z),(TXX+1.35,TYY+y,z),.050,'steel')
for dx in [-1.35,1.35]:
 rod((TXX+dx,TYY-1.2,.0),(TXX-dx,TYY-1.2,4.70),.054,'steel_dark')
cube(TXX,TYY,5.0,3.35,3.1,.20,'steel')
# hut at 5+ high
cube(TXX,TYY,6.15,2.6,2.46,2.18,'blue_dark')
cube(TXX,TYY,7.36,3.3,2.94,.22,'rust')
for dx in [-.85,.85]:
 cube(TXX+dx,TYY-1.255,6.28,.8,.07,.82,'glass')
 cube(TXX+dx,TYY+1.255,6.28,.8,.07,.82,'glass')
for z in [5.14,6.0]:
 for dy in [-1.48,1.48]:rod((20.0,TYY+dy,z),(23.62,TYY+dy,z),.035,'yellow')
 for dx in [-1.80,1.80]:rod((TXX+dx,TYY-1.48,z),(TXX+dx,TYY+1.48,z),.035,'yellow')
for px in [19.98,23.62]:
 for py in [TYY-1.48,TYY+1.48]:rod((px,py,5.05),(px,py,6.07),.040,'yellow')
# stairs extend southwest from tower platform, down 4.7m elevation
for i in range(15):
 t=(i+.5)/15
 x=18.7-3.5*t;y=8.8-3.25*t
 z=4.75-(i+1)*4.6/15
 cube(x,y,z+.03,.82,1.3,.15,'yellow',-38)
 cube(x,y,z-.21,.82,.10,.37,'steel_dark',-38)
for p in (-.65,.65):
 rod((18.7,8.8+p,5.6),(15.0,5.55+p,1.05),.07,'yellow')
 box_collider('tower_stairs',17.0,7.2,5.2,2.2,4.5,rot=43,kind='stairs')
box_collider('watchtower_tall_support',TXX,TYY,3.4,3.2,7.5)
landmark('watchtower',TXX,TYY,'elevated')
# roof mast and lamps
rod((TXX+1.5,TYY+.2,7.5),(TXX+1.5,TYY+.2,9.2),.045,'steel_dark')
cube(TXX+1.47,TYY+.3,9.04,.62,.5,.23,'steel_dark')
cube(TXX+1.47,TYY+.6,9.04,.55,.2,.16,'amber')

# shooting rack on right near y=0: targets dangling on a line
rod((19.4,1.05,2.65),(24.1,1.05,2.65),.052,'rust_dark')
for xx in [20.15,21.50,22.85]:
 rod((xx,1.05,2.63),(xx,1.05,1.75),.023,'steel_light')
 ellipsoid(xx,1.05,1.52,.35,.075,.60,'steel',10,6)
for px in [19.4,24.1]:rod((px,1.05,0),(px,1.05,2.88),.08,'rust')

# right lower orange container + blue cloth canopy; permanent corner props
container(20.4,-5.0,5.7,2.6,2.6,'rust',0)
quad([(17.2,-6.9,2.95),(23.6,-6.9,2.55),(24.0,-4.3,2.8),(18.1,-4.05,3.25)],'blue')
for px,py in [(17.3,-6.8),(23.7,-6.8),(23.9,-4.3)]:rod((px,py,0),(px,py,3.1),.054,'steel_dark')
for i in range(8):
 bx=18.6+i*.55
 cylinder(bx,-6.4,1.13,.10,.32,R.choice(['bottle','bottle_brown']),8)
# laboratory table below above reference
cube(13.3,-7.1,.87,3.6,1.02,.13,'wood_light')
for dx in [-1.3,1.3]:
 for dy in [-.4,.4]:rod((13.3+dx,-7.1+dy,0),(13.3+dx,-7.1+dy,.85),.042,'steel_dark')
for bx in [12.2,12.9,13.5,14.4]:
 cylinder(bx,-7.1,1.1,.19,.43,'white',9)
 # tubing or lab mouth
 cylinder(bx,-7.1,1.35,.09,.11,'glass',9)

# lower left stacked storage containers create short navigable corridor
container(-23.35,-5.2,8.5,2.2,2.45,'rust',90)
# left narrow covered corridor, short horizontal fence, overhead gaps
fence_segment(-25,-1.4,-20.7,-1.4,2.2,wire=True)
fence_segment(-25,-6.9,-20.7,-6.9,2.2,wire=True)
for y in [-3,-4,-5.5,-8.5]:pallet(-23.2,y,.89)

# simple firing table and bottles at bottom center right
cube(3.9,-8.2,.83,4.65,.9,.17,'wood_light')
for x in [1.9,5.9]:
 for y in [-8.6,-7.8]:rod((x,y,.0),(x,y,.88),.042,'steel_dark')
for i in range(8):
 x=2.05+i*.50
 cylinder(x,-8.16,1.14,.095,.40,'bottle' if i%3 else 'bottle_brown',8)
 cylinder(x,-8.16,1.35,.048,.045,'white',7)
# miscellaneous all around
for cx,cy in [(18,-8.7),(20,-8.9),(22.9,-9.2),(-20,-9.7),(-11.5,-2),(-16,2.3)]:
 cube(cx,cy,.22,.67,.68,.40,'steel_dark')
 cylinder(cx,cy,.48,.18,.09,'steel_light',8)
# many concrete pits/puddles like reference
for x,y in [(-11.0,2.6),(-10.8,-11.7),(4.6,2.7),(9.0,-7.8),(19.4,-10.8),(-3.1,-4.1)]:
 ellipsoid(x,y,.028,.74,.42,.02,'puddle',13,6)
 for j in range(5):
  xx=x+R.uniform(-.7,.7);yy=y+R.uniform(-.4,.4)
  ellipsoid(xx,yy,.045,.10,.08,.025,'steel',8,5)

# spectator-style bottles and trash along walls
for x,y in [(-23,8.6),(-22.5,8.6),(-20.5,8.6),(-20.1,8.6),(2.7,11.6),(3.4,11.6),(17.4,10.3),(22.0,-5.4),(13.8,-8.7)]:
 cylinder(x,y,.65,.10,.24,'bottle',8)
 cylinder(x,y,.78,.046,.05,'white',8)

# player placement / balancing metadata; inside walkable open ground
for name,x,y,yaw in [
 ('south_gate',0,-11.8,90),('west_flank',-18.7,-5.2,35),('east_flank',18.4,-1.0,160),
 ('north_junkyard',-10,7.5,270),('northeast_cover',14.7,3.4,225),('southwest_cover',-7.7,-7.2,30),
 ('central_open',2.8,-4.3,75),('upper_container_entry',-6.7,3.8,10)]:
 spawn_points.append({'id':name,'x':x,'y':y,'facing_deg_math':yaw,'z':0.1})

# Build actor per color. We intentionally merge geometry by material to avoid thousands of draw calls.
renderer=vtk.vtkRenderer();renderer.SetBackground(*rgb('#5b5b65'))
renderer.SetAmbient(.50,.50,.50)
renderer.AutomaticLightCreationOff()
N_polys=0
for key,poly_list in parts.items():
 app=vtk.vtkAppendPolyData()
 for p in poly_list:app.AddInputData(p)
 app.Update()
 tri=vtk.vtkTriangleFilter();tri.SetInputConnection(app.GetOutputPort());tri.Update()
 p_out=vtk.vtkPolyData();p_out.DeepCopy(tri.GetOutput())
 N_polys+=p_out.GetNumberOfCells()
 mapper=vtk.vtkPolyDataMapper();mapper.SetInputData(p_out)
 actor=vtk.vtkActor();actor.SetMapper(mapper)
 actor.GetProperty().SetColor(*rgb(COLORS[key]));actor.GetProperty().SetAmbient(.34);actor.GetProperty().SetDiffuse(.72)
 actor.GetProperty().SetSpecular(.10); actor.GetProperty().SetSpecularPower(13)
 renderer.AddActor(actor)
 print(key,len(poly_list),'parts',p_out.GetNumberOfCells(),'triangles')

# Add a texture-mapped terrain layer generated entirely from deterministic noise.
# This is not the reference painting projected onto the floor; the map remains all meshes.
def build_ground_texture(outpath):
 from PIL import ImageDraw, ImageFilter
 rg=np.random.default_rng(9876)
 tw,th=1536,864
 n=rg.random((th,tw)).astype(np.float32)*2-1
 small=Image.fromarray(rg.integers(0,256,(36,64),dtype=np.uint8)).resize((tw,th),Image.Resampling.BICUBIC)
 mid=Image.fromarray(rg.integers(0,256,(216,384),dtype=np.uint8)).resize((tw,th),Image.Resampling.BILINEAR)
 coarse=(np.asarray(small).astype(np.float32)-127)/127
 middle=(np.asarray(mid).astype(np.float32)-127)/127
 tex=coarse*17+middle*6+n*6
 # patchy sand and darker compacted mud, with mild warm variation
 base=np.array([150,102,72],np.float32)
 img=np.zeros((th,tw,3),np.uint8)
 for c,d in enumerate((1.,.85,.66)):
  img[:,:,c]=np.clip(base[c]+tex*d,0,255).astype('uint8')
 result=Image.fromarray(img,'RGB')
 draw=ImageDraw.Draw(result,'RGBA')
 # Tiny gravel and random dirt chips, not broad patches that look like painted circles.
 for i in range(7000):
  x=rg.integers(0,tw);y=rg.integers(0,th)
  radius=int(rg.integers(1,4))
  draw.ellipse((x-radius,y-radius,x+radius,y+radius),fill=(51,45,39,int(rg.integers(24,65))))
 for i in range(70):
  x=int(rg.integers(0,tw));y=int(rg.integers(0,th));r=int(rg.integers(5,38))
  draw.ellipse((x-r*2,y-r*.55,x+r*2,y+r*.55),fill=(60,46,38,int(rg.integers(5,23))))
 result.save(outpath,optimize=True)
 return outpath

texturepath=Path(__file__).resolve().parent/'arena_ground_texture.png'
build_ground_texture(texturepath)
pl=vtk.vtkPlaneSource();pl.SetOrigin(-25,-14,.012);pl.SetPoint1(25,-14,.012);pl.SetPoint2(-25,14,.012)
pl.SetXResolution(1);pl.SetYResolution(1)
ptmapper=vtk.vtkPolyDataMapper();ptmapper.SetInputConnection(pl.GetOutputPort())
pactor=vtk.vtkActor();pactor.SetMapper(ptmapper)
reader=vtk.vtkPNGReader();reader.SetFileName(str(texturepath));reader.Update()
texture=vtk.vtkTexture();texture.SetInputConnection(reader.GetOutputPort());texture.InterpolateOn()
pactor.SetTexture(texture);pactor.GetProperty().SetAmbient(.47);pactor.GetProperty().SetDiffuse(.65)
renderer.AddActor(pactor)

for pos,intensity in [((15,-12,45),.62),((-25,20,28),.52)]:
 light=vtk.vtkLight();light.SetLightTypeToSceneLight();light.SetPosition(*pos);light.SetFocalPoint(0,0,0)
 light.SetIntensity(intensity);light.SetColor(1,.91,.79);renderer.AddLight(light)

window=vtk.vtkRenderWindow();window.SetOffScreenRendering(1);window.SetMultiSamples(0);window.AddRenderer(renderer)


def save_view(outdir,fn,kind='top',size=(1600,920)):
 cam=renderer.GetActiveCamera();cam.ParallelProjectionOn()
 if kind=='top':
  cam.SetPosition(0,-1.9,86);cam.SetFocalPoint(0,0,0);cam.SetViewUp(0,1,0)
  cam.SetParallelScale(16.2)
 elif kind=='iso':
  cam.SetPosition(42,-51,55);cam.SetFocalPoint(0,0,1);cam.SetViewUp(0,0,1)
  cam.SetParallelScale(27.4)
 elif kind=='center':
  cam.SetPosition(20,-21,22);cam.SetFocalPoint(-.7,3.0,2);cam.SetViewUp(0,0,1)
  cam.SetParallelScale(15)
 renderer.ResetCameraClippingRange()
 window.SetSize(*size)
 window.Render()
 w2i=vtk.vtkWindowToImageFilter();w2i.SetInput(window);w2i.SetInputBufferTypeToRGB();w2i.ReadFrontBufferOff();w2i.Update()
 wr=vtk.vtkPNGWriter();wr.SetFileName(str(outdir/fn));wr.SetInputConnection(w2i.GetOutputPort());wr.Write()
 print('view',fn)


def export_scene(outdir):
 # VTK produces glTF JSON with embedded binary data; use trimesh to pack as compact GLB.
 cam=renderer.GetActiveCamera();cam.SetPosition(0,-20,75);cam.SetViewUp(0,0,1);cam.SetFocalPoint(0,0,0)
 renderer.ResetCameraClippingRange()
 window.SetSize(128,128);window.Render()
 exporter=vtk.vtkGLTFExporter();exporter.SetRenderWindow(window);exporter.SetFileName(str(outdir/'arena_from_vtk.gltf'));exporter.InlineDataOn();exporter.Write()
 # Rotate Z-up VTK authored geometry to GLTF / engine Y-up. Set vertex positions, not camera.
 scene=trimesh.load(str(outdir/'arena_from_vtk.gltf'),force='scene',process=False)
 # VTK uses z-up. Rotation about X by -90 degrees -> world y (vertical) positive, depth z = -worldY.
 orient=trimesh.transformations.rotation_matrix(-math.pi/2,[1,0,0])
 scene.apply_transform(orient)
 # strip exporter camera and lights; keep geometry nodes
 scene.camera=None
 glb=scene.export(file_type='glb')
 (outdir/'scrapyard_arena.glb').write_bytes(glb)
 # Roundtrip validation
 loaded=trimesh.load(str(outdir/'scrapyard_arena.glb'),force='scene')
 bounds=np.array(loaded.bounds)
 print('GLB meshes',len(loaded.geometry),'bounds',bounds.tolist(),'MB',len(glb)/1e6)
 # user only needs GLB, do not leave intermediate embedded gltf in main folder
 (outdir/'arena_from_vtk.gltf').unlink(missing_ok=True)
 return len(loaded.geometry),bounds

def make_navigation_grid(outdir):
    # Simple 0.5-metre horizontal walkability raster, not a vertical navmesh.
    res=.5;nx=int(W/res);ny=int(H/res);pr=.35
    xs=-W/2+(np.arange(nx)+.5)*res
    ys=H/2-(np.arange(ny)+.5)*res
    xx,yy=np.meshgrid(xs,ys)
    free=(np.abs(xx)<W/2-pr-.12)&(np.abs(yy)<H/2-pr-.12)
    for col in colliders:
        if col['kind']!='solid': continue
        cx,cy,_=col['center']; dx=xx-cx;dy=yy-cy
        if col['type']=='cylinder':mask=dx*dx+dy*dy<=(col['radius']+pr)**2
        else:
            ang=math.radians(col.get('yaw_deg',0));ca=math.cos(ang);sa=math.sin(ang)
            rx=dx*ca+dy*sa; ry=-dx*sa+dy*ca
            sx,sy,_=col['size']
            mask=(np.abs(rx)<=(sx/2+pr))&(np.abs(ry)<=(sy/2+pr))
        free &= ~mask
    # reference coordinates in first row are at north; x left-to-right.
    # JSON bitstrings: 1=walkable, 0=blocked.
    data={'tile_size_m':res,'width_cells':nx,'height_cells':ny,
      'origin_world_top_left_center':[-W/2+res/2,H/2-res/2],
      'row_order':'north to south (screen top to bottom)',
      'column_order':'west to east (screen left to right)',
      'walkable_char':'1','blocked_char':'0','player_radius_m':pr,
      'rows':[''.join('1' if a else '0' for a in row) for row in free]}
    (outdir/'arena_navgrid.json').write_text(json.dumps(data,indent=2))
    from PIL import ImageDraw
    im=Image.new('RGB',(nx*8,ny*8),'#27292b');d=ImageDraw.Draw(im)
    for iy in range(ny):
      for ix in range(nx):
        if free[iy,ix]:d.rectangle((ix*8,iy*8,(ix+1)*8-1,(iy+1)*8-1),fill='#b5a079')
    for sp in spawn_points:
      ix=round((sp['x']+W/2)/res-.5);iy=round((H/2-sp['y'])/res-.5)
      if 0<=ix<nx and 0<=iy<ny:
        d.ellipse((ix*8-4,iy*8-4,ix*8+12,iy*8+12), fill='#eccc50',outline='#17191a',width=2)
    im.save(outdir/'arena_walkability.png')
    # quick BFS from nearest walkable cell to main gate
    from collections import deque
    start=(round((H/2+11.8)/res-.5),round((0+W/2)/res-.5))
    sx,sy=start[1],start[0]
    # find closest unblocked cell
    ys2,xs2=np.where(free)
    if len(xs2):
      idx=np.argmin((xs2-sx)**2+(ys2-sy)**2)
      st=(int(ys2[idx]),int(xs2[idx]));seen={st};q=deque([st])
      while q:
       y,x=q.popleft()
       for ddx,ddy in ((0,1),(0,-1),(1,0),(-1,0)):
        nx0=x+ddx;ny0=y+ddy
        if 0<=nx0<nx and 0<=ny0<ny and free[ny0,nx0] and (ny0,nx0) not in seen:
         seen.add((ny0,nx0));q.append((ny0,nx0))
      data['reachable_from_south_gate_cells']=len(seen)
      data['walkable_cells']=int(free.sum())
      data['reachable_walkable_percent']=round(100*len(seen)/max(1,free.sum()),2)
    (outdir/'arena_navgrid.json').write_text(json.dumps(data,indent=2))
    print('NAV',data.get('reachable_walkable_percent'),'percent of walkable ground reachable from main gate')

def main():
 ap=argparse.ArgumentParser();ap.add_argument('--out',default='/mnt/data/scrapyard_arena_3d')
 args=ap.parse_args();out=Path(args.out);out.mkdir(parents=True,exist_ok=True)
 if texturepath.resolve()!=(out/'arena_ground_texture.png').resolve():
  shutil.copy2(texturepath,out/'arena_ground_texture.png')
 save_view(out,'arena_overhead.png','top')
 save_view(out,'arena_isometric.png','iso')
 save_view(out,'arena_center_closeup.png','center',(1200,800))
 meshes,bounds=export_scene(out)
 make_navigation_grid(out)
 metadata={
  'project':'Hero Shooter', 'asset':'Pine Ridge scrapyard arena', 'generation':'procedural Python VTK 9.6',
  'fidelity':'stylized spatial interpretation of reference image, not exact photogrammetry',
  'dimension_m':{'width_x':W,'height_ground_y':H,'maximum_structure_z':9.4},
  'authored_coordinates':'X right/east, Y towards image top/north, Z up (metres)',
  'glb_coordinates':'X right/east, Y up/height, Z towards image bottom/south',
  'glb_transform':{'x_glb':'x_authored','y_glb':'z_authored','z_glb':'-y_authored'},
  'engine':'Current Hero Shooter uses HTML Canvas 2D. GLB needs a Three.js/Babylon.js/WebGL 3D integration; overhead PNG may be used separately.',
  'mesh_material_groups':meshes,'triangles':N_polys,
  'landmarks':landmarks,'spawn_points':spawn_points,'colliders':colliders,
  'collision_guide':'All colliders in authored Z-up coordinates. Convert each center [x,y,z] to GLB [x,z,-y] if using glTF engine. Where yaw degrees are used, authored rotation is around vertical Z.',
  'traversal_note':'The rendered stairs and elevated central platform are visual only until stair/ramp colliders are implemented by the target game engine.',
  'navmesh_note':'Obstacle list is not yet a baked navigation mesh.',
 }
 (out/'arena_layout.json').write_text(json.dumps(metadata,indent=2))
 source=Path(__file__).resolve()
 if source!=out/'build_scrapyard_arena.py':
  (out/'build_scrapyard_arena.py').write_text(source.read_text())
 (out/'README.md').write_text('''# Hero Shooter: scrapyard training arena (VTK prototype)

This arena is a real 3D mesh derived procedurally with Python VTK from the supplied 2026-11-22 scrapyard illustration. It is a *spatial interpretation*, not a pixel-perfect photogrammetry reconstruction.

**Files**

- `scrapyard_arena.glb` — binary glTF mesh with material colour groups, importable in Blender, Three.js, Babylon.js, Godot, Unity, or other glTF clients.
- `arena_overhead.png` — orthographic overhead render for art review or 2D development.
- `arena_isometric.png` — orthographic 3D perspective render.
- `arena_center_closeup.png` — closer view of central elevated container and cover.
- `arena_navgrid.json` / `arena_walkability.png` — 0.5m obstacle-space raster and visual navigation diagnostic.
- `arena_viewer.html` — optional interactive Three.js preview; run `python -m http.server 8000` from this folder and open `/arena_viewer.html` (requires an internet connection for the Three.js library).
- `arena_ground_texture.png` — generated textured dirt for regenerating VTK scene.
- `arena_layout.json` — object positions, dimensions, spawn candidates, collision boxes/cylinders, orientation conversion, and caveats.
- `build_scrapyard_arena.py` — full deterministic parametric VTK generation script.

**Dimensions and axes**

Approx. 50 x 28 metres (50 units X, 28 units Z in GLB; Y up), structures as high as 9.4m. The generation script uses X right, Y north/image-up, Z height; the GLB converts to X right, Y height, Z south/image-down. The collision JSON records positions in script coordinates; see JSON conversion rules.

**World elements**

Real volumetric assets: chainlink fence perimeter and open front gate; rear scrapyard with wrecks and junk; left service container; container stairs and elevated walkway/guardrails; right watchtower with stairs; target shed; paper/steel/mannequin targets; concrete block cover, U-shaped cover; stacked rusted pipe sections; pallets, tires, drums, bottles, crates, tarped lower-right container, laboratories, debris and sparse scrub.

**Game integration status**

The Hero Shooter repo currently runs an HTML Canvas 2D game; `.glb` is NOT wired into that runtime. Use a WebGL/Three.js or Babylon.js 3D scene to display the model, or use the overhead render as a source for a 2D map workflow. The `arena_layout.json` data are suggested blockers / spawn zones, not engine-ready physics colliders or baked navmesh. Character scale, spawn clearance, collision tests, and draw call budgets should be validated in-engine before publication.

**Regenerate**

`pip install vtk numpy trimesh Pillow`

`python build_scrapyard_arena.py --out ./scrapyard_arena_3d`

Generated preview images use VTK offscreen OpenGL rendering. No external texture assets are required.
''')
 print('DONE',len(parts),'materials',len(colliders),'colliders',N_polys,'triangle polys')

if __name__=='__main__':main()