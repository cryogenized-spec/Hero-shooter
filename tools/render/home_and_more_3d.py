#!/usr/bin/env python3
"""Hero Shooter — Home & More shop, code-only VTK 3D control test.

Reads home_and_more_layout.json and creates original geometry/lighting using VTK.
No generated images, no reference texture. Code-generated floor & sign textures only.
All shop dimensions are provisional estimates from the approved 1670x942 artwork.

Run: xvfb-run -a python3 home_and_more_3d.py
"""
import math, json, random, argparse, itertools
from pathlib import Path
import numpy as np
from PIL import Image, ImageDraw, ImageFont, ImageEnhance
import vtk
from vtk.util.numpy_support import vtk_to_numpy

ROOT=Path(__file__).resolve().parent
LAYOUT=json.loads((ROOT/'home_and_more_layout.json').read_text())
SCALE=LAYOUT['coordinate_system']['image_pixels_per_metre']
OX,OY=LAYOUT['coordinate_system']['image_origin_px']
RANDOM=random.Random(10517)
RENDERER=None
TEXTURES=[]
ACTORS=[]
COUNTS={}

PALETTE={
    'floor':'#937985', 'floor_service':'#55505e', 'wood_floor':'#97694c',
    'outer_wall':'#3e3342', 'wall':'#716173', 'wall_light':'#ad8f9b',
    'border':'#241d29', 'shelf_metal':'#302637', 'rack_wood':'#a86b43',
    'gold':'#df9d37', 'yellow':'#f7b535', 'red':'#b73945', 'red_light':'#da6d66',
    'cream':'#ead0a9', 'peach':'#ce8d67', 'orange':'#e7a05e', 'brown':'#79513d',
    'purple':'#8b669d', 'lilac':'#c098bb', 'blue':'#587da5', 'sky':'#9fb8ca',
    'mint':'#7a9f9a', 'olive':'#6e8e55', 'dark':'#201b24', 'glass':'#bcd0d7',
    'metal':'#bdb7c2', 'white':'#f1e7e0', 'black':'#17151d', 'wood':'#a77956',
    'leaf':'#709e43', 'leaf_hi':'#b5bd46', 'pot':'#a95746', 'cardboard':'#ba8d5b',
    'cart':'#b6b1bc', 'paper':'#efe3d9', 'desk':'#674532', 'screen':'#466c8f',
    'warm_light':'#f1ae70', 'tile_line':'#6e596d'
}

def rgb(value):
    h=PALETTE.get(value,value)
    return tuple(int(h[i:i+2],16)/255 for i in (1,3,5))

def xy(px,py): return ((px-OX)/SCALE, (OY-py)/SCALE)

def pos(px,py,z):
    x,y=xy(px,py)
    return (x,y,z)


def a_mesh(src, material, location=(0,0,0), rotation=(0,0,0), spec=.16, ambient=.32, opacity=1.0, meta=None):
    m=vtk.vtkPolyDataMapper(); m.SetInputConnection(src.GetOutputPort())
    a=vtk.vtkActor(); a.SetMapper(m); a.SetPosition(*location); a.SetOrientation(*rotation)
    pr=a.GetProperty(); pr.SetColor(*rgb(material));pr.SetAmbient(ambient);pr.SetDiffuse(.68)
    pr.SetSpecular(spec);pr.SetSpecularPower(24);pr.SetOpacity(opacity)
    RENDERER.AddActor(a)
    ACTORS.append(a)
    if meta:
        COUNTS[meta]=COUNTS.get(meta,0)+1
    return a


def cube(x,y,z,sx,sy,sz,c,rot=(0,0,0),spec=.12,meta=None,opacity=1.0):
    s=vtk.vtkCubeSource();s.SetXLength(max(sx,.002));s.SetYLength(max(sy,.002));s.SetZLength(max(sz,.002))
    return a_mesh(s,c,(x,y,z),rot,spec,opacity=opacity,meta=meta)

def cubep(px,py,z,sx,sy,sz,c,**kwargs):
    x,y=xy(px,py);return cube(x,y,z,sx,sy,sz,c,**kwargs)

def cylinder(x,y,z,r,h,c,res=12,meta=None):
    s=vtk.vtkCylinderSource();s.SetRadius(r);s.SetHeight(h);s.SetResolution(res)
    return a_mesh(s,c,(x,y,z),rotation=(90,0,0),meta=meta)

def ball(x,y,z,rx,ry,rz,c,res=12):
    s=vtk.vtkSphereSource();s.SetRadius(1);s.SetThetaResolution(res);s.SetPhiResolution(res)
    a=a_mesh(s,c,(x,y,z));a.SetScale(rx,ry,rz);return a

def line(points,r,c,res=7,meta=None):
    pts=vtk.vtkPoints()
    for p in points:pts.InsertNextPoint(*p)
    cells=vtk.vtkCellArray()
    for i in range(len(points)-1):
        l=vtk.vtkLine();l.GetPointIds().SetId(0,i);l.GetPointIds().SetId(1,i+1);cells.InsertNextCell(l)
    pd=vtk.vtkPolyData();pd.SetPoints(pts);pd.SetLines(cells)
    t=vtk.vtkTubeFilter();t.SetInputData(pd);t.SetRadius(r);t.SetNumberOfSides(res);t.CappingOn()
    return a_mesh(t,c,spec=.24,meta=meta)

def between_wall(x1,y1,x2,y2,h=2.6,t=.15,material='wall',z0=0):
    dx=x2-x1;dy=y2-y1
    length=(dx*dx+dy*dy)**.5
    return cube((x1+x2)/2,(y1+y2)/2,z0+h/2,length,t,h,material,rot=(0,0,math.degrees(math.atan2(dy,dx))),meta='walls')

def cubewall_px(p1,p2,h=2.6,t=.15,material='wall'):
    return between_wall(*xy(*p1),*xy(*p2),h=h,t=t,material=material)

def image_vtk_tex(img):
    # PIL RGB image => vtk texture, pixels bottom-up convention
    arr=np.ascontiguousarray(np.array(img.convert('RGB'))[::-1])
    vtkimg=vtk.vtkImageData();vtkimg.SetDimensions(img.width,img.height,1)
    vtkimg.AllocateScalars(vtk.VTK_UNSIGNED_CHAR,3)
    from vtk.util.numpy_support import numpy_to_vtk
    vtkarr=numpy_to_vtk(arr.reshape(-1,3),deep=True,array_type=vtk.VTK_UNSIGNED_CHAR)
    vtkarr.SetNumberOfComponents(3);vtkimg.GetPointData().SetScalars(vtkarr)
    tex=vtk.vtkTexture();tex.SetInputData(vtkimg);tex.InterpolateOn()
    TEXTURES.extend([tex,vtkimg]);return tex

def textured_plane(origin,point1,point2,img,ambient=1.0):
    p=vtk.vtkPlaneSource();p.SetOrigin(*origin);p.SetPoint1(*point1);p.SetPoint2(*point2)
    mapper=vtk.vtkPolyDataMapper();mapper.SetInputConnection(p.GetOutputPort())
    a=vtk.vtkActor();a.SetMapper(mapper);a.SetTexture(image_vtk_tex(img))
    pr=a.GetProperty();pr.SetAmbient(ambient);pr.SetDiffuse(max(0,1-ambient));pr.LightingOff()
    RENDERER.AddActor(a);ACTORS.append(a)
    return a


def make_floor_texture(w_px=1600,h_px=840, rgbbase=(125,105,123), tile=42, line_color=(102,86,106)):
    im=Image.new('RGB',(w_px,h_px),rgbbase);d=ImageDraw.Draw(im)
    for x in range(0,w_px,tile):d.line([(x,0),(x,h_px)],fill=line_color,width=2)
    for y in range(0,h_px,tile):d.line([(0,y),(w_px,y)],fill=line_color,width=2)
    # warm alternating tile color noise, extremely subtle
    return im


def floor_plane():
    # source coordinates map exactly to the reference image footprint
    x0,y0=xy(25,854);x1,y1=xy(1620,20)
    cube((x0+x1)/2,(y0+y1)/2,-.04,x1-x0,y1-y0,.08,'border',meta='floor')
    img=make_floor_texture()
    textured_plane((x0,y0,.013),(x1,y0,.013),(x0,y1,.013),img)
    # loading service floor textured blocks (deliberately distinct)
    for ppx,ppy,sw,sh,mat in [(145,254,3.4,7.2,'floor_service'),(145,608,3.4,3.0,'wood_floor'),(145,791,3.4,2.1,'wood_floor')]:
        x,y=xy(ppx,ppy);cube(x,y,.018,sw,sh,.009,mat,meta='floor_zones')


def walls_and_doors():
    # perimeter tall walls at N, E, W. Front cutaway parapet preserves shop visibility.
    wall=LAYOUT['walls']
    for key in ('back','left','right'):
        w=wall[key]
        cubewall_px(w['from_px'],w['to_px'],h=w['height_m'],t=.2,material='outer_wall')
    for a,b in wall['front_segments_px']:
        cubewall_px((a,850),(b,850),h=.45,t=.26,material='outer_wall')

    # left-side service area partition x≈250px, with passage for staff
    x=wall['service_partition_px']; y0=36; y1=850
    for a,b in [(y0,370),(474,503),(505,710),(710,850)]:
        if b>a: cubewall_px((x,a),(x,b),h=2.35,t=.15,material='wall')
    # low doorway lintel above staff passage
    xw,yw=xy(x,(370+474)/2)
    cube(xw,yw,2.40,.17,(474-370)/SCALE,.22,'wall_light',meta='door_lintels')
    # internal service subrooms, openings in left side at appropriate places
    for py in wall['service_y_dividers_px']:
        for pa,pb in [(32,110),(170,250)]:
            cubewall_px((pa,py),(pb,py),h=2.18,t=.14,material='outer_wall')
        # doorway upper lintel
        x1,y1=xy(110,py);x2,y2=xy(170,py)
        cube((x1+x2)/2,y1,2.28,(170-110)/SCALE,.14,.18,'wall_light',meta='door_lintels')
    # front service wall
    cubewall_px((25,850),(255,850),h=.38,t=.22,material='outer_wall')
    # loading bay left wall gate (mesh gates)
    x1,y1=xy(35,360);x2,y2=xy(243,360)
    line([(x1,y1,.1),(x2,y1,.1),(x2,y1,1.45),(x1,y1,1.45),(x1,y1,.1)],.035,'metal',meta='gates')
    for i in range(7):
        xx=x1+(x2-x1)*(i/6)
        line([(xx,y1,.15),(xx,y1,1.40)],.012,'metal')
    # main entry surround
    a,b=wall['main_entrance_px'];xa,ya=xy(a,850);xb,yb=xy(b,850)
    for x in (xa,xb):cube(x,ya,1.18,.19,.20,2.36,'wall_light',meta='door_posts')
    cube((xa+xb)/2,ya,2.42,xb-xa,.25,.22,'outer_wall',meta='door_lintels')


def hazard_stripes(px,py,w,h,axis='x'):
    x,y=xy(px,py)
    cube(x,y,.026,w,h,.011,'gold',meta='safety_markings')
    # dark striped stencils
    if axis=='x':
        n=int(w/.18)
        for i in range(n):
            if i%2==0:cube(x-w/2+(i+.5)*w/n,y,.035,w/n*.65,h*.88,.008,'brown')
    else:
        n=int(h/.18)
        for i in range(n):
            if i%2==0:cube(x,y-h/2+(i+.5)*h/n,.035,w*.88,h/n*.7,.008,'brown')

PRODUCTS={
 'cookware':['red_light','orange','cream','purple','brown'],
 'ceramics':['peach','cream','orange','brown','paper'],
 'beverages':['blue','red','mint','orange','cream'],
 'tools':['yellow','gold','black','brown','orange'],
 'appliances':['lilac','paper','blue','purple','cream'],
 'textiles':['cream','peach','brown','red_light','purple'],
 'hardware':['gold','black','yellow','brown','metal'],
 'electronics':['lilac','purple','paper','blue','black'],
 'paint':['sky','blue','cream','lilac','red'],
 'boxes':['cardboard','cream','purple','lilac','brown'],
 'luggage':['purple','blue','red','black','cream'],
}

def product_pkg(x,y,z,theme,i,j,variant=0):
    colors=PRODUCTS[theme]; c=colors[(i+3*j+variant)%len(colors)]
    # small carton with label/trim and occasional can / bowl shape
    package_w=.20;package_d=.19
    ht=.22+0.08*((i+2*j)%3)
    if theme=='paint' and ((i+j)%3==0):
        cylinder(x,y,z+ht/2,.105,ht,c,res=12,meta='stock')
        cube(x,y,z+ht+.012,.16,.16,.02,'metal')
    elif theme=='ceramics' and ((i+j)%4==1):
        cylinder(x,y,z+.10,.11,.20,c,res=14,meta='stock')
    elif theme=='beverages' and (i+j)%2==0:
        cylinder(x,y,z+.12,.07,.24,c,res=10,meta='stock')
        cube(x,y,z+.255,.10,.10,.018,'cream')
    else:
        cube(x,y,z+ht/2,package_w,package_d,ht,c,meta='stock')
        if (i+j)%4!=0:
            cube(x,y-.103,z+ht*.55,.135,.006,.045,'paper',spec=.01)

def gondola(gid,px,py,theme):
    x,y=xy(px,py);wx,wy,h=LAYOUT['gondola_size_m']
    # yellow clearance borders, matching painted markings in source
    cube(x,y,.026,wx+.36,wy+.32,.014,'gold',meta='gondola_markings')
    cube(x,y,.030,wx+.16,wy+.12,.014,'floor')
    # base, vertical steel posts, shelf decks
    cube(x,y,.12,wx,wy,.23,'shelf_metal',meta='gondola')
    for xx in [-wx/2+.08,wx/2-.08]:
        for yy in [-wy/2+.08,wy/2-.08]:
            cube(x+xx,y+yy,h/2,.08,.08,h,'shelf_metal',meta='shelf_posts')
    for z in [.30,.70,1.12,1.52]:
        cube(x,y,z,wx,wy,.058,'shelf_metal',meta='shelf_decks')
        # front bronze trim
        cube(x,y-wy/2+.035,z,wx,.055,.07,'rack_wood',meta='shelf_trim')
    # goods visible from elevated camera, rows in Y direction
    for j in range(7):
        for i in range(6):
            xx=x-wx/2+.23+i*.27
            yy=y-wy/2+.25+j*.30
            z=1.54
            product_pkg(xx,yy,z,theme,i,j,variant=int((px+py)/80)%5)
    # short front facing shelves lower levels, camera near south
    for i in range(5):
        for k,z in enumerate([.51,.91,1.32]):
            xx=x-wx/2+.24+i*.33
            yy=y-wy/2-.013
            product_pkg(xx,yy,z,theme,i,k)
    COUNTS['gondolas'] = COUNTS.get('gondolas',0)+1


def back_wall_shelving():
    # long continuous shelves under banner on north wall
    for k, pair in enumerate(LAYOUT['back_wall_shelves_px']):
        px,wpx=pair;x,y=xy(px,156)
        w=wpx/SCALE
        cube(x,y,.86,w,.40,1.70,'shelf_metal',meta='wall_shelves')
        for z in (.35,.75,1.15,1.60):
            cube(x,y-.08,z,w,.50,.055,'rack_wood')
            n=max(2,int(w/.25))
            for j in range(n):
                cx=x-w/2+(j+.5)*w/n
                product_pkg(cx,y-.08,z+.03,'boxes' if k%2 else 'electronics',j,k)
    # floor level fixture on south-facing wall at top left and right


def wall_shelves(px,py,length,side):
    x,y=xy(px,py)
    sx=.54;sy=length
    cube(x,y,.85,sx,sy,1.65,'shelf_metal',meta='wall_shelves')
    for z in (.40,.81,1.22,1.68):
        cube(x,y,z,sx+.07,sy,.055,'rack_wood')
        n=int(sy/.35)
        for j in range(n):
            cy=y-sy/2+(j+.5)*sy/n
            product_pkg(x,cy,z+.08,'boxes',j,int(z*10))


def checkout_counter(px,py,sx,sy,h):
    x,y=xy(px,py)
    cube(x,y,h/2,sx,sy,h,'red',meta='checkout')
    cube(x,y,h+.07,sx+.08,sy+.10,.13,'rack_wood',spec=.33,meta='checkout')
    # tills, monitors and drawers
    for xx in (x-sx*.28, x+sx*.2):
        cube(xx,y+.11,h+.25,.58,.12,.40,'black',meta='tills')
        cube(xx,y+.18,h+.27,.45,.025,.28,'screen',spec=.6)
        cube(xx,y-.04,h+.13,.14,.30,.07,'metal')
        cube(xx+.58,y+.07,h+.13,.30,.22,.20,'metal')
        cube(xx+.58,y+.20,h+.24,.28,.04,.07,'paper')
        # handheld scanner
        cylinder(xx-.6,y+.08,h+.25,.05,.24,'black')
    for i in range(4):
        cube(x+sx/2-.20,y,.45,.03,sy-.08,.4,'brown',meta='counter_drawers')


def queue_barrier(px,py,sx,sy,h):
    x,y=xy(px,py)
    # Two parallel U-shaped queue lanes, rope held by metal uprights
    for yy in (y-.38,y+.38):
        xs=[x-sx/2 + i*sx/5 for i in range(6)]
        for xx in xs:
            cylinder(xx,yy,.048,.10,.08,'metal')
            cylinder(xx,yy,h/2,.040,h,'metal',res=12,meta='stanchions')
            cylinder(xx,yy,h+.014,.075,.045,'metal')
        line([(xx,yy,h*.85) for xx in xs],.025,'red',meta='queue_rope')
    # curved joining segment at east/right end
    pts=[]
    for i in range(9):
        t=-math.pi/2 + i*math.pi/8
        pts.append((x+sx/2 + .29*math.cos(t),y+.38*math.sin(t),h*.85))
    line(pts,.026,'red',meta='queue_rope')


def glass_entry(px,py,sx,sy,h):
    x,y=xy(px,py)
    # visible sliding pair, with strong framing
    cube(x,y,.06,sx+.30,sy+.50,.1,'metal',meta='entry')
    for xx in (x-sx/2,x,x+sx/2):
        cube(xx,y, h/2,.05,.15,h,'metal',meta='entry_frame')
    cube(x,y,h,sx+.1,.18,.13,'metal',meta='entry_frame')
    for xx in (x-sx/4,x+sx/4):
        cube(xx,y,h/2,sx/2-.06,.018,h-.20,'glass',spec=.6,opacity=.28)
        cube(xx,y-.035,1.0,.028,.065,.25,'metal')
    cube(x,y-.32,0.025,sx+.40,.40,.05,'tile_line',meta='threshold')


def cart_one(x,y,offset=0):
    # simple deterministic trolley cage, wheels, handles
    sx=.50;sy=.75;z=.55
    cube(x,y,z,.57,.68,.06,'metal',meta='carts')
    for xx in (x-.27,x+.27):
        for yy in (y-.32,y+.32):
            line([(xx,yy,.38),(xx,yy,.85)],.013,'metal')
    for zz in (.61,.78):
        line([(x-.28,y-.34,zz),(x-.28,y+.34,zz),(x+.28,y+.34,zz),(x+.28,y-.34,zz)],.012,'metal')
    line([(x-.25,y+.38,.88),(x+.25,y+.38,.88)],.025,'red')
    for xx in (x-.22,x+.22):
        for yy in (y-.30,y+.30):
            cylinder(xx,yy,.11,.055,.08,'black')


def loading(px,py,sx,sy):
    # exact high-level loading zone arrangement, with stacked cartons and pallet lines
    palette=['cardboard','brown','cream','purple']
    for k,(pX,pY,rows,cols) in enumerate([(90,108,3,3),(164,100,2,2),(107,249,3,2),(180,274,2,3),(108,335,2,2)]):
        x,y=xy(pX,pY)
        cube(x,y,.12,1.15,1.15,.23,'wood',meta='pallets')
        for i in range(rows):
            for j in range(cols):
                xx=x+(i-(rows-1)/2)*.35;yy=y+(j-(cols-1)/2)*.35
                boxh=.26+.04*((i+j)%2)
                cube(xx,yy,.30+boxh/2,.32,.32,boxh,palette[(k+i+j)%4],meta='cartons')
                if (i+j)%2==0:cube(xx,yy-.164,.38,.16,.008,.045,'paper')
    # miniature pallet jack / forklift silhouette
    x,y=xy(145,185)
    cube(x,y,.13,.24,.68,.2,'yellow')
    cube(x,y+.30,.56,.15,.12,.9,'yellow')
    cube(x,y-.23,.18,.80,.10,.08,'yellow')
    for sx0 in [-.16,.16]: cylinder(x+sx0,y+.2,.11,.065,.07,'black')
    # hazard strips at loading passage
    hazard_stripes(201,348,1.8,.15)


def office(px,py):
    # desk, monitor, chairs, filing, indoor plants
    cubep(151,610,.47,1.62,.74,.94,'desk',meta='office_furniture')
    cubep(145,608,1.06,.58,.15,.46,'black')
    cubep(145,598,1.11,.48,.028,.31,'screen')
    x,y=xy(175,654)
    cylinder(x,y,.42,.23,.38,'black')
    cylinder(x,y,.21,.12,.26,'metal')
    cubep(73,620,.95,.65,.55,1.9,'office' if 'office' in PALETTE else 'wall')
    # frame poster on wall
    cubep(110,540,1.50,.60,.08,.55,'gold')
    cubep(110,539,1.51,.48,.092,.43,'paper')


def canteen(px,py):
    cubep(103,758,.42,1.2,.62,.84,'desk',meta='canteen_furniture')
    cubep(104,756,.88,.96,.55,.065,'cream')
    x,y=xy(140,806)
    cylinder(x,y,.42,.43,.07,'wood')
    for xx,yy in [(95,826),(183,824)]:
        x,y=xy(xx,yy)
        cylinder(x,y,.29,.19,.45,'wood')
        cube(x,y,.63,.33,.30,.10,'gold')
    cubep(76,792,1.0,.60,.45,1.92,'fridge' if 'fridge' in PALETTE else 'sky',meta='canteen_furniture')


def plant(px,py,scale=1.0):
    x,y=xy(px,py)
    cylinder(x,y,.24*scale,.20*scale,.45*scale,'pot',res=10)
    cylinder(x,y,.48*scale,.13*scale,.13*scale,'leaf')
    for k in range(7):
        ang=2*math.pi*k/7
        ball(x+math.cos(ang)*.22*scale,y+math.sin(ang)*.22*scale,.70*scale,.08*scale,.18*scale,.09*scale, 'leaf_hi' if k%3==0 else 'leaf',res=10)
    ball(x,y,.82*scale,.20*scale,.20*scale,.16*scale,'leaf')


def store_label_texture():
    w,h=1600,260
    im=Image.new('RGB',(w,h),(112,30,58))
    pix=im.load()
    for y in range(h):
        for x in range(w):
            t=y/(h-1);u=x/(w-1)
            glow=math.exp(-((u-.7)/.28)**2 - ((t-.45)/.4)**2)
            pix[x,y]=(int(114+80*glow+48*t),int(35+67*glow+24*t),int(61+10*glow))
    d=ImageDraw.Draw(im)
    # mountains / acacia tree stylized horizon silhouette
    d.polygon([(870,220),(1000,160),(1090,191),(1180,119),(1260,172),(1390,132),(1540,222)], fill=(30,35,44))
    d.ellipse((1170,54,1350,82),fill=(23,29,33))
    d.line((1258,82,1255,190),fill=(22,28,30),width=13)
    d.line((1256,127,1210,73),fill=(22,28,30),width=7)
    d.line((1256,119,1320,69),fill=(22,28,30),width=7)
    # roof chevron
    d.line((65,84,170,30,275,84),fill=(247,182,62),width=13,joint='curve')
    d.line((65,84,65,100),fill=(247,182,62),width=7)
    d.line((275,84,275,100),fill=(247,182,62),width=7)
    try:
        f1=ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans-BoldOblique.ttf',86)
        f2=ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf',48)
    except:
        f1=ImageFont.load_default();f2=f1
    d.text((318,47),'Home',font=f1,fill='#fff0d0',stroke_width=2,stroke_fill='#52263b')
    d.text((642,47),'&',font=f1,fill='#d8443d',stroke_width=1,stroke_fill='#702439')
    d.text((758,47),'More',font=f1,fill='#fff0d0',stroke_width=2,stroke_fill='#52263b')
    d.line([(20,199),(730,199)],fill='#f8a933',width=12)
    d.line([(20,215),(730,215)],fill='#da4a44',width=8)
    return im


def standing_sign():
    # Code-generated banner mounted vertically on rear wall
    x0,y0=xy(535,50);x1,y1=xy(1170,50)
    y=y0-.035
    textured_plane((x0,y,1.23),(x1,y,1.23),(x0,y,2.65),store_label_texture())
    # decorative sconce orange bars in front of back wall, object coordinates
    for px in [130,395,560,740,920,1110,1320,1520]:
        x,yy=xy(px,42)
        cube(x,yy-.045,2.57,.56,.16,.10,'warm_light',spec=.05,meta='wall_lights')


def wall_decor():
    # decorative rear framed graphics and poster blocks
    for px in [360,470,1460,1530]:
        x,y=xy(px,76)
        cube(x,y-.16,1.94,.54,.07,.74,'gold',meta='wall_decoration')
        cube(x,y-.21,1.95,.40,.036,.60,'red_light')
    for px in [1580,1600]:
        x,y=xy(px,175)
        cube(x-.01,y-.02,1.65,.10,.22,1.3,'orange',meta='wall_decoration')


def build_scene():
    global RENDERER
    RENDERER=vtk.vtkRenderer()
    RENDERER.SetBackground(.081,.071,.093)
    RENDERER.SetBackground2(.13,.103,.15)
    RENDERER.GradientBackgroundOn()
    window=vtk.vtkRenderWindow();window.SetOffScreenRendering(1);window.AddRenderer(RENDERER);window.SetSize(1900,1140);window.SetMultiSamples(4)
    floor_plane();walls_and_doors()
    # gondolas complete 3x6 / 3-front layout
    for row in LAYOUT['gondola_rows']:
        for px,theme in zip(row['positions_x_px'],row['themes']):
            gondola(f'gondola_{row["row"]}_{px}',px,row['source_y_px'],theme)
    back_wall_shelving()
    for f in LAYOUT['fixtures']:
        typ=f['type'];px,py=f['source_px'];sx,sy,sz=(f.get('size_m',[0,0,0])+[0,0,0])[:3]
        if typ=='checkout_counter':checkout_counter(px,py,sx,sy,sz)
        elif typ=='queue_barrier':queue_barrier(px,py,sx,sy,sz)
        elif typ=='glass_entry':glass_entry(px,py,sx,sy,sz)
        elif typ=='carts':
            x,y=xy(px,py)
            for k in range(f['count']):cart_one(x-(k-2.5)*.32,y,offset=k)
        elif typ=='loading':loading(px,py,sx,sy)
        elif typ=='office':office(px,py)
        elif typ=='canteen':canteen(px,py)
        elif typ=='wall_shelves':wall_shelves(px,py,f['length_m'],'west' if px<800 else 'east')
        elif typ=='staff':
            # sign for staff only near left service area
            cubep(195,412,1.15,.65,.19,1.9,'outer_wall',meta='staff_door')
    for p in LAYOUT['decorative_plants_px']:
        plant(*p,scale=1.0 if p[1]>300 else .85)
    standing_sign(); wall_decor()
    # floor arrows / cashier queue markings near entrance
    for px in (673,1010):
        cubep(px,819,.018,.38,.58,.018,'gold',meta='floor_markings')
    # camera, north = back wall/top of output
    camera=vtk.vtkCamera()
    el=math.radians(float(LAYOUT['camera']['elevation_degrees']))
    target=(0,6.45,.85)
    distance=38
    camera.SetPosition(0,-distance*math.cos(el),target[2]+distance*math.sin(el))
    camera.SetFocalPoint(*target)
    camera.SetViewUp(0,0,1)
    camera.ParallelProjectionOn();camera.SetParallelScale(8.10)
    RENDERER.SetActiveCamera(camera)
    for xyz,inten in [((-11,-10,19),1.20),((10,9,15),.70),((0,1,19),.42)]:
        light=vtk.vtkLight();light.SetPosition(*xyz);light.SetFocalPoint(0,6,0);light.SetIntensity(inten);RENDERER.AddLight(light)
    RENDERER.SetUseShadows(False)
    window.Render()
    wi=vtk.vtkWindowToImageFilter();wi.SetInput(window);wi.SetInputBufferTypeToRGBA();wi.ReadFrontBufferOff();wi.Update()
    arr=vtk_to_numpy(wi.GetOutput().GetPointData().GetScalars()).reshape((1140,1900,4))
    out=Image.fromarray(arr[::-1].copy(),'RGBA')
    # Inspection camera: slightly lower and rotated to make 3D volume visible.
    inspect_elev=math.radians(52)
    inspect_az=math.radians(-13)
    camera.SetPosition(target[0]+distance*math.sin(inspect_az)*math.cos(inspect_elev),
                       target[1]-distance*math.cos(inspect_az)*math.cos(inspect_elev),
                       target[2]+distance*math.sin(inspect_elev))
    camera.SetParallelScale(8.35)
    window.Render();wi.Modified();wi.Update()
    arr2=vtk_to_numpy(wi.GetOutput().GetPointData().GetScalars()).reshape((1140,1900,4))
    Image.fromarray(arr2[::-1].copy(),'RGBA').save(ROOT/'home_and_more_3d_oblique.png')
    # Restore reference-facing camera for repeatable atlas output.
    camera.SetPosition(0,-distance*math.cos(el),target[2]+distance*math.sin(el))
    camera.SetParallelScale(8.10);window.Render()
    # Portable single-file GLB export. Intermediate .gltf fragments are temporary.
    try:
        import tempfile, trimesh
        with tempfile.TemporaryDirectory(prefix='hmm_gltf_') as tmp:
            intermediate=Path(tmp)/'home_and_more.gltf'
            exporter=vtk.vtkGLTFExporter()
            exporter.SetRenderWindow(window)
            exporter.SetFileName(str(intermediate))
            exporter.InlineDataOff()
            exporter.Write()
            scene=trimesh.load(str(intermediate),force='scene',process=False)
            scene.export(str(ROOT/'home_and_more_3d_scene.glb'))
            print('Portable GLB exported:',len(scene.geometry),'mesh parts')
    except Exception as err:
        print('GLB export skipped:',err)
    return out


def draw_layout_map():
    # editable annotated plan from same data — not the source image
    im=Image.new('RGB',(1670,980),'#e7e2e7');d=ImageDraw.Draw(im)
    d.rectangle([25,20,1620,854],fill='#ac99aa',outline='#29232c',width=12)
    d.rectangle([25,20,250,854],fill='#777081',outline='#29232c',width=4)
    # service sections
    for y in (505,710):d.line([(25,y),(250,y)],fill='#24202a',width=8)
    d.line([(250,20),(250,850)],fill='#29232c',width=10)
    d.line([(250,370),(250,474)],fill='#dfc69d',width=12)
    d.line([(735,854),(935,854)],fill='#e7e2e7',width=15)
    for row in LAYOUT['gondola_rows']:
        py=row['source_y_px']
        for px in row['positions_x_px']:
            d.rectangle([px-61,py-80,px+61,py+80],fill='#463747',outline='#e7a848',width=6)
    for f in LAYOUT['fixtures']:
        px,py=f['source_px'];t=f['type']
        if t=='checkout_counter':d.rectangle([px-140,py-26,px+140,py+26],fill='#b54b4d',outline='#44262b',width=3)
        elif t=='queue_barrier':
            for yy in (py-30,py+30):d.line([(px-210,yy),(px+200,yy)],fill='#c44b43',width=7)
        elif t=='glass_entry':d.rectangle([px-97,py-51,px+97,py+51],fill='#b0d0d5',outline='#3d4f5a',width=6)
        elif t=='carts':d.rectangle([px-85,py-30,px+85,py+30],fill='#c1bac8',outline='#5f5867',width=3)
        elif t=='loading':
            for xx,yy in [(98,95),(163,110),(100,245),(170,277),(97,341)]:
                d.rectangle([xx-30,yy-22,xx+30,yy+22],fill='#b48c67',outline='#493846',width=2)
        elif t=='office':d.rectangle([66,553,224,690],fill='#bc9170',outline='#45313a',width=2)
        elif t=='canteen':d.rectangle([55,745,216,830],fill='#bc9170',outline='#45313a',width=2)
        elif t=='wall_shelves':d.rectangle([px-20,py-120,px+20,py+120],fill='#63536c')
    for px,w in LAYOUT['back_wall_shelves_px']:
        d.rectangle([px-w/2,120,px+w/2,169],fill='#3a2c3f',outline='#c69860',width=2)
    for px,py in LAYOUT['decorative_plants_px']:
        d.ellipse([px-14,py-14,px+14,py+14],fill='#669249',outline='#d5bf58',width=3)
    try:
        f=ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf',19)
        fs=ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf',14)
    except: f=fs=ImageFont.load_default()
    labels=[('LOADING BAY',(40,55)),('STAFF ONLY',(70,445)),('OFFICE',(83,585)),('CANTEEN',(68,768)),('HOME & MORE',(698,78)),('CHECKOUT',(1100,812)),('ENTRY',(780,870))]
    for title,pt in labels:d.text(pt,title,font=f,fill='#f9e7c8' if title!='ENTRY' else '#3d2834',stroke_width=1,stroke_fill='#34252f' if title!='ENTRY' else '#e7e2e7')
    d.text((30,908),'Code-driven floor plan / estimated layout. Pixel coordinates reflect the approved reference image.',font=fs,fill='#352a39')
    return im


def output():
    render=build_scene()
    render.save(ROOT/'home_and_more_3d_render.png')
    plan=draw_layout_map();plan.save(ROOT/'home_and_more_code_floorplan.png')
    # compare with the exact user-provided reference for QA
    src_path=ROOT/'Home and More - Approved Shop Layout - Web Optimized.webp'
    src=Image.open(src_path).convert('RGB') if src_path.exists() else render.copy().convert('RGB')
    source_view=Image.new('RGB',(950,540),'#f9f5ee');src.thumbnail((950,520),Image.Resampling.LANCZOS)
    source_view.paste(src,((950-src.width)//2,(540-src.height)//2))
    rend_view=render.convert('RGB').resize((950,570),Image.Resampling.LANCZOS)
    comp=Image.new('RGB',(1900,660),'#eae4e5')
    comp.paste(source_view,(0,46));comp.paste(rend_view,(950,46))
    d=ImageDraw.Draw(comp)
    try: font=ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf',20)
    except:font=ImageFont.load_default()
    d.text((18,13),'Approved reference',font=font,fill='#382c36')
    d.text((968,13),'VTK / Python control render (editable geometry)',font=font,fill='#382c36')
    comp.save(ROOT/'home_and_more_reference_comparison.png')
    meta={'render_method':'Python 3 + VTK 9.6, geometry from editable JSON','camera_elevation_deg':LAYOUT['camera']['elevation_degrees'], 'actor_count':len(ACTORS),'counts':COUNTS,'notes':'Provisional spatial reconstruction from supplied stylized layout, not exact surveyed dimensions.'}
    (ROOT/'home_and_more_render_metadata.json').write_text(json.dumps(meta,indent=2))
    print(json.dumps(meta,indent=2))

if __name__=='__main__': output()