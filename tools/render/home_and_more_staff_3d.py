#!/usr/bin/env python3
"""Hero Shooter / Home & More staff back office. Procedural 3D VTK set.
Shop-floor and staff area are separate gameplay maps with matching doorway portals.
This 3D render is a code-built visualization of the playable room blockout.
"""
from pathlib import Path
import math, json, random
import vtk
from vtk.util.numpy_support import vtk_to_numpy
from PIL import Image, ImageDraw, ImageFont
import numpy as np
R=Path(__file__).resolve().parent
rng=random.Random(21122)
parts=[]
scene=None
P={'base':'#706573','concrete':'#69606b','tile':'#bd957d','light':'#f5d39d','wall':'#433443','edge':'#211925','metal':'#736573','metalhi':'#b7adb3','shelf':'#3c3447','box':'#c18c5d','box2':'#d5a475','box3':'#b47752','blue':'#4c6b9a','purple':'#74598c','floor':'#8b7c86','wood':'#ad754e','woodtop':'#dca171','darkwood':'#563b35','green':'#608d5c','paper':'#ece4d6','glass':'#a3c8d4','door':'#39313f','chair':'#4c3540','white':'#e4d8d2','screen':'#326e8e','black':'#251d26','gold':'#dfb358'}
def color(c):
    v=P.get(c,c);return tuple(int(v[i:i+2],16)/255 for i in (1,3,5))
def xy(px,py):return ((px-1100)/125,(650-py)/125)
def add(source,c,x,y,z,scale=None,spec=.12,ambient=.33):
    m=vtk.vtkPolyDataMapper();m.SetInputConnection(source.GetOutputPort());a=vtk.vtkActor();a.SetMapper(m);a.SetPosition(x,y,z)
    if scale:a.SetScale(*scale)
    p=a.GetProperty();p.SetColor(*color(c));p.SetAmbient(ambient);p.SetDiffuse(.66);p.SetSpecular(spec);p.SetSpecularPower(22)
    scene.AddActor(a);parts.append(a);return a
def box(x,y,z,sx,sy,sz,c,spec=.14):
    s=vtk.vtkCubeSource();s.SetXLength(sx);s.SetYLength(sy);s.SetZLength(sz);return add(s,c,x,y,z,spec=spec)
def bp(px,py,z,sx,sy,sz,c,spec=.12):
    x,y=xy(px,py);return box(x,y,z,sx/125,sy/125,sz,c,spec)
def ball(px,py,z,r,c):
    x,y=xy(px,py);s=vtk.vtkSphereSource();s.SetRadius(r);s.SetThetaResolution(12);s.SetPhiResolution(10);return add(s,c,x,y,z)
def wall(px1,py1,px2,py2,height=2.5,width=.18,c='wall'):
    x1,y1=xy(px1,py1);x2,y2=xy(px2,py2)
    dx=x2-x1;dy=y2-y1;l=math.hypot(dx,dy)
    a=box((x1+x2)/2,(y1+y2)/2,height/2,l,width,height,c)
    a.SetOrientation(0,0,math.degrees(math.atan2(dy,dx)))
    return a
def shelf(px,py,w,d,levels=4):
    # geometry follows an elevated shelf rack, not a flat icon
    x,y=xy(px,py);wi=w/125;de=d/125
    for i in range(levels):
        z=.22+i*.38
        box(x,y,z,wi,de,.075,'wood')
        for j in range(max(3,int(w/48))):
            cx=x-wi/2+(j+.5)*wi/max(3,int(w/48))
            for side in (-1,1):
                if (j+i)%4==3:continue
                box(cx,y+side*de*.22,z+.10,wi/max(3,int(w/48))*.71,de*.30,.17,rng.choice(['box','box2','blue','purple']))
    for side in (-1,1):
        for end in (-1,1):box(x+side*(wi/2),y+end*de/2,.79,.07,.07,1.58,'shelf')

def table(px,py,w=110,h=85):
    bp(px,py,.76,w,h,.11,'woodtop')
    for dx in (-w*.42,w*.42):
        for dy in (-h*.40,h*.40):bp(px+dx,py+dy,.37,9,9,.7,'darkwood')

def floor():
    bp(1100,650,-.10,1600,900,.2,'base')
    # receiving / packing
    bp(1100,431,.005,1548,430,.02,'concrete')
    for px,py,w,h,c in [(470,875,288,397,'tile'),(900,875,548,397,'wood'),(1340,875,261,397,'metal'),(1660,875,325,397,'floor')]:bp(px,py,.02,w,h,.025,c)
    # tile grid with subtle narrow recessed grout lines
    for y in range(240,1080,45):bp(1100,y,.03,1550,1.2,.005,'edge')
    for x in range(350,1870,45):bp(x,650,.03,1.2,820,.005,'edge')

def boundaries():
    wall(300,200,1900,200,2.65,c='wall')
    wall(300,200,300,1100,2.65,c='wall')
    wall(1900,200,1900,842,2.65,c='wall')
    wall(1900,971,1900,1100,2.65,c='wall')
    # front low wall for visibility
    wall(300,1100,1900,1100,.45,c='wall')
    # receiving divider / service corridors
    wall(326,654,1256,654,2.45,c='wall')
    wall(1370,654,1874,654,2.45,c='wall')
    # doors along staff facilities
    for xa,ya,xb,yb in [(614,678,614,753),(614,827,614,895),(614,969,614,1074),
      (1185,678,1185,772),(1185,865,1185,1074),(1470,678,1470,771),(1470,860,1470,1074),
      (1820,678,1820,842),(1820,939,1820,1074)]:wall(xa,ya,xb,yb,2.4,c='wall')
    wall(330,853,614,853,2.4,c='wall')
    # thin trim / lintel cross door openings above heads
    for px,py,ang,gap in [(614,790,90,74),(1185,820,90,77),(1470,814,90,87),(1820,890,90,96)]:
        bp(px,py,2.34,18,gap,.19,'metalhi')

def receiving():
    # loading bay pallets/cases
    for xx in (380,525):
        for yy in (315,470):
            bp(xx,yy,.10,115,92,.18,'wood')
            for layer in range(2):
                for i in range(2):
                    for j in range(2):bp(xx+(i-.5)*50,yy+(j-.5)*37,.32+layer*.40,44,34,.38,rng.choice(['box','box2','box3']))
    # back wall racks
    for x in (730,980,1235):shelf(x,288,221,83,levels=4)
    for x in (800,965,1130,1295):shelf(x,485,78,235,levels=4)
    shelf(1800,365,116,226,levels=5)
    # staff packing desk (raised work surface / packages)
    bp(1540,455,.87,282,110,.13,'woodtop')
    for x in (1420,1640):bp(x,455,.43,18,100,.80,'metal')
    for x in (1460,1570,1650):bp(x,445,1.03,32,36,.28,'box')
    bp(1620,460,1.015,62,42,.10,'green')
    # dispatch cart
    bp(1760,545,.31,85,62,.45,'metal')
    for xx in (1729,1794):
        for yy in (524,559):ball(xx,yy,.10,.10,'black')
    # pallet jack silhouette
    bp(575,385,.19,75,30,.22,'gold')
    bp(575,348,.54,12,8,.63,'gold')

def toilets():
    for cy in (770,944):
        bp(421,cy,.89,154,118,1.65,'metalhi')
        for xx in (365,418,470):bp(xx,cy+48,1.2,3,11,1.8,'darkwood')
        bp(548,cy,.43,56,50,.82,'white')
        bp(548,cy,.87,46,36,.15,'glass')

def canteen():
    # kitchenette, water cooler and fridge
    bp(798,731,.55,240,66,1.10,'wood')
    bp(798,731,1.135,240,72,.09,'woodtop')
    for xx in (745,811,882):bp(xx,726,1.2,34,28,.10,'white')
    bp(1090,989,.9,66,70,1.8,'metalhi')
    for x,y in ((850,800),(1060,800),(852,964),(1060,964)):
        table(x,y)
        for dx,dy in ((-72,0),(72,0),(0,-66),(0,66)):
            ball(x+dx,y+dy,.5,.16,'chair')
            bp(x+dx,y+dy,.30,28,24,.58,'chair')

def locker_room():
    for x in (1277,1394):
        bp(x,958,1.02,113,65,2.04,'metal')
        for dx in (-32,0,32):
            bp(x+dx,988,1.43,16,3,.09,'metalhi')
    bp(1320,1026,.50,145,28,.25,'wood')

def office():
    table(1635,808,235,100)
    bp(1635,808,.85,76,60,.12,'black')
    bp(1635,799,1.10,64,12,.57,'screen')
    bp(1635,850,.95,65,34,.10,'white')
    bp(1685,971,1.1,160,65,2.2,'metal')
    bp(1700,905,.31,60,55,.65,'chair')
    for x in (1555,1755):ball(x,715,.7,.28,'green')

def capture(angle=67,w=1440,h=900):
    global scene, parts
    parts=[];scene=vtk.vtkRenderer();scene.SetBackground(*color('#1c1720'))
    window=vtk.vtkRenderWindow();window.SetOffScreenRendering(1);window.SetMultiSamples(4);window.SetSize(w,h);window.AddRenderer(scene)
    floor();boundaries();receiving();toilets();canteen();locker_room();office()
    cam=vtk.vtkCamera();e=math.radians(angle);dist=19
    cam.SetPosition(0,-dist*math.cos(e),1.0+dist*math.sin(e));cam.SetFocalPoint(0,0,0.7);cam.SetViewUp(0,0,1)
    cam.ParallelProjectionOn();cam.SetParallelScale(5.15 if angle>=75 else 6.0);scene.SetActiveCamera(cam)
    for pt,pwr in [((-5,-3,13),1.1),((7,6,9),.62),((2,-7,7),.34)]:
        li=vtk.vtkLight();li.SetPosition(*pt);li.SetFocalPoint(0,0,1);li.SetIntensity(pwr);scene.AddLight(li)
    window.Render();im=vtk.vtkWindowToImageFilter();im.SetInput(window);im.SetInputBufferTypeToRGBA();im.ReadFrontBufferOff();im.Update()
    a=vtk_to_numpy(im.GetOutput().GetPointData().GetScalars()).reshape(h,w,4)
    return Image.fromarray(a[::-1].copy(),'RGBA').transpose(Image.Transpose.FLIP_LEFT_RIGHT).convert('RGB')
if __name__=='__main__':
    image=capture(77)
    image.save(R/'home_and_more_staff_3d_render.png')
    image2=capture(56)
    image2.save(R/'home_and_more_staff_3d_oblique.png')
    print('done',len(parts))