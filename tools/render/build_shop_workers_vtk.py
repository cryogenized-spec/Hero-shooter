#!/usr/bin/env python3
"""Hero Shooter — reproducible VTK models of Home & More Sunday shop staff.
Real procedural meshes; transparent 8 directions x (idle/walk/run) x 4 atlases.
+Z up, face front -Y, game screen +X right / +Y down.
No armature: walk/run sprites are procedurally posed from rigid assemblies.
Designs are fictional, art-direction choices; narrative names/roles belong to map.
Usage: xvfb-run -a python build_shop_workers_vtk.py [--out DIR] [--preview-only]
Dependencies: vtk numpy pillow trimesh
"""
import math, json, argparse, re, time
from pathlib import Path
from collections import defaultdict
import numpy as np
import vtk
import trimesh
from PIL import Image, ImageDraw, ImageFont
from vtk.util.numpy_support import vtk_to_numpy

DIRS=[('S',0),('SW',-45),('W',-90),('NW',-135),('N',180),('NE',135),('E',90),('SE',45)]
# Character identifiers match map-layer names; no arbitrary reinterpretation of story.
CHARACTERS=[
 dict(id='sibusiso_mkhize',name='Sibusiso Mkhize',gender='man',height=1.84,build=1.09,
      skin='#89583E', skinshade='#663D2E',hair='#15191D',iris='#4A3326',hair_style='fade',
      top='#3E5650',tophi='#6A8E7C',undershirt='#DED5BB',trousers='#4F463B',legshade='#33332C',
      shoes='#302B29',sole='#AD9D7B',accent='#E0AC48',role='receiving',variant='utility-vest'),
 dict(id='thandeka_dlamini',name='Thandeka Dlamini',gender='woman',height=1.71,build=.94,
      skin='#A46F53',skinshade='#754931',hair='#242027',iris='#4B3022',hair_style='braided_bun',
      top='#754A51',tophi='#B47576',undershirt='#E4CDB6',trousers='#35404E',legshade='#26303B',
      shoes='#29282E',sole='#F1EBDE',accent='#DBBA79',role='receiving',variant='zip-jacket'),
 dict(id='bongani_cele',name='Bongani Cele',gender='man',height=1.78,build=1.13,
      skin='#714833',skinshade='#503224',hair='#1C2020',iris='#30231D',hair_style='buzz',
      top='#435D78',tophi='#7694A7',undershirt='#C7D6D0',trousers='#383D37',legshade='#292E2A',
      shoes='#39362C',sole='#C7C5A7',accent='#D9A85E',role='shelves',variant='work-polo'),
 dict(id='mandla_khumalo',name='Mandla Khumalo',gender='man',height=1.87,build=1.04,
      skin='#916247',skinshade='#68442F',hair='#302B28',iris='#473024',hair_style='short_curls',
      top='#7A6753',tophi='#B19B79',undershirt='#D2D0C5',trousers='#35353B',legshade='#27282C',
      shoes='#302F34',sole='#9E9CA4',accent='#B7C5A4',role='shelves',variant='work-jacket'),
 dict(id='back_office_clerk',name='Back-office clerk',gender='woman',height=1.66,build=.91,
      skin='#9E6C51',skinshade='#754935',hair='#292127',iris='#372721',hair_style='low_bun',
      top='#655670',tophi='#9784AA',undershirt='#D6CDE2',trousers='#33323C',legshade='#25252D',
      shoes='#3A333E',sole='#AFA0AA',accent='#E2B762',role='paperwork',variant='office-cardigan'),
]

def rgb(v):
    s=v.lstrip('#');return tuple(int(s[i:i+2],16)/255 for i in (0,2,4))
def rgba(v):return [int(c*255) for c in rgb(v)]+[255]
def gaussian(x,u,s):return math.exp(-.5*((x-u)/s)**2)

def poly(v,f):
    points=vtk.vtkPoints();tris=vtk.vtkCellArray()
    for p in v:points.InsertNextPoint(*[float(x) for x in p])
    for face in f:
        cell=vtk.vtkTriangle()
        for j,k in enumerate(face):cell.GetPointIds().SetId(j,int(k))
        tris.InsertNextCell(cell)
    mesh=vtk.vtkPolyData();mesh.SetPoints(points);mesh.SetPolys(tris)
    normals=vtk.vtkPolyDataNormals();normals.SetInputData(mesh);normals.ConsistencyOn();normals.SplittingOff();normals.Update()
    return normals.GetOutput()

def front_face_y(x,z):
    # Surface of custom head with a small projection for cheekbones.
    xx=x/.147;zz=(z-1.620)/.193
    return -.008-.128*math.sqrt(max(.02,1-xx**2-zz**2))

def custom_head():
    vs=[];fs=[];rings=46;steps=72
    for i in range(rings+1):
        t=(i+1e-5)*math.pi/(rings+2e-5)
        for j in range(steps):
            a=j*2*math.pi/steps
            x=.147*math.sin(t)*math.cos(a)
            y=.125*math.sin(t)*math.sin(a)
            z=.193*math.cos(t)
            if y<0:
                bridge=.009*gaussian(x,0,.031)*gaussian(z,.015,.066)
                tip=.018*gaussian(x,0,.024)*gaussian(z,-.053,.03)
                nostrils=.004*(gaussian(x,.035,.015)+gaussian(x,-.035,.015))*gaussian(z,-.07,.026)
                cheeks=.005*(gaussian(x,.07,.025)+gaussian(x,-.07,.025))*gaussian(z,-.035,.066)
                y-=bridge+tip+nostrils+cheeks
            x*=1-.14*gaussian(z,-.14,.06)
            vs.append((x,y-.008,1.620+z))
            if i:
                p=(i-1)*steps+j;q=(i-1)*steps+(j+1)%steps;r=i*steps+j;s=i*steps+(j+1)%steps
                fs.extend(((p,r,q),(q,r,s)))
    return poly(vs,fs)

class Person:
    def __init__(self,info):
        self.p=info;self.root=vtk.vtkAssembly();self.parts=[]
        self.groups={'body':self.root}
        self.colors={
            'skin':info['skin'],'skinshade':info['skinshade'],'hair':info['hair'],'iris':info['iris'],
            'ink':'#211B20','white':'#F9F4E9','shirt':info['undershirt'],
            'top':info['top'],'tophi':info['tophi'],'topshadow':'#20252C',
            'pants':info['trousers'],'pantshadow':info['legshade'],
            'shoe':info['shoes'],'sole':info['sole'],'accent':info['accent'],
            'metal':'#AFB9BA','badge':'#E8E3D9','badge_text':'#5B6875',
            'bag':'#343238','bagtrim':'#82726E'
        }
        for part,at in [('arm_l',(-.206,0,1.297)),('arm_r',(.206,0,1.297)),
                        ('leg_l',(-.083,0,.864)),('leg_r',(.083,0,.864))]:
            assembly=vtk.vtkAssembly();assembly.SetPosition(*at);self.root.AddPart(assembly)
            self.groups[part]=assembly
        self.root.SetScale(info['build'],info['build'],info['height']/1.8)
    def mat(self,key):return self.colors.get(key,key)
    def add(self,geom,key,name,group='body'):
        mapper=vtk.vtkPolyDataMapper()
        if isinstance(geom,vtk.vtkPolyData):mapper.SetInputData(geom)
        else:mapper.SetInputConnection(geom.GetOutputPort())
        a=vtk.vtkActor();a.SetMapper(mapper)
        p=a.GetProperty();p.SetColor(*rgb(self.mat(key)));p.SetAmbient(.36);p.SetDiffuse(.66);p.SetSpecular(.09);p.SetSpecularPower(18)
        self.groups[group].AddPart(a);self.parts.append((a,key,name,group));return a
    def ell(self,pos,scale,key,name,group='body',res=26):
        g=vtk.vtkSphereSource();g.SetThetaResolution(res);g.SetPhiResolution(max(12,res-6))
        a=self.add(g,key,name,group);a.SetScale(*scale);a.SetPosition(*pos);return a
    def cube(self,pos,scale,key,name,group='body'):
        g=vtk.vtkCubeSource();a=self.add(g,key,name,group);a.SetScale(*scale);a.SetPosition(*pos);return a
    def cylinder(self,aa,bb,r,key,name,group='body',res=16):
        aa=np.array(aa,float);bb=np.array(bb,float);d=bb-aa
        g=vtk.vtkCylinderSource();g.SetRadius(r);g.SetHeight(float(np.linalg.norm(d)));g.SetResolution(res)
        a=self.add(g,key,name,group)
        t=vtk.vtkTransform();t.Translate(*((aa+bb)/2))
        norm=d/np.linalg.norm(d);axis=np.cross([0,1,0],norm);dot=np.dot([0,1,0],norm)
        if np.linalg.norm(axis)>1e-8:t.RotateWXYZ(math.degrees(math.acos(np.clip(dot,-1,1))),*axis)
        elif dot<0:t.RotateWXYZ(180,1,0,0)
        a.SetUserTransform(t);return a
    def line(self,points,width,key,name,group='body',sides=7):
        pts=vtk.vtkPoints();lines=vtk.vtkCellArray()
        for p in points:pts.InsertNextPoint(*p)
        for i in range(len(points)-1):
            l=vtk.vtkLine();l.GetPointIds().SetId(0,i);l.GetPointIds().SetId(1,i+1);lines.InsertNextCell(l)
        d=vtk.vtkPolyData();d.SetPoints(pts);d.SetLines(lines)
        tube=vtk.vtkTubeFilter();tube.SetInputData(d);tube.SetRadius(width);tube.SetNumberOfSides(sides);tube.CappingOn()
        return self.add(tube,key,name,group)
    def loft(self,rings,key,name,n=42):
        vs=[];fs=[]
        for idx,(z,rx,ry,cy) in enumerate(rings):
            for j in range(n):
                a=2*math.pi*j/n
                vs.append((rx*math.cos(a),cy+ry*math.sin(a),z))
                if idx:
                    a0=(idx-1)*n+j;b0=(idx-1)*n+(j+1)%n;c=idx*n+j;d=idx*n+(j+1)%n
                    fs.extend([(a0,b0,c),(b0,d,c)])
        # closed ends
        vs.extend([(0,rings[0][3],rings[0][0]),(0,rings[-1][3],rings[-1][0])])
        low=len(vs)-2;hi=len(vs)-1
        for j in range(n):
            fs.append((low,(j+1)%n,j))
            fs.append((hi,(len(rings)-1)*n+j,(len(rings)-1)*n+(j+1)%n))
        return self.add(poly(vs,fs),key,name)
    def strip(self,points,width,key,name,group='body'):
        # true polygonal strip, flush/raised on garment, not a billboard.
        vs=[];fs=[]
        for i,pt in enumerate(points):
            x,y,z=pt;vs.extend([(x-width/2,y,z),(x+width/2,y,z)])
            if i:
                n=i*2;fs.extend([(n-2,n-1,n),(n-1,n+1,n)])
        return self.add(poly(vs,fs),key,name,group)
    def pose(self,yaw=0,gait='idle',frame=0):
        self.root.SetOrientation(0,0,yaw)
        pulse=math.sin(frame*math.pi/2)
        strength=0 if gait=='idle' else 1 if gait=='walk' else 1.5
        base=0 if gait=='idle' else (6 if frame==0 else -6 if frame==2 else 0)
        for side,suff in [(1,'l'),(-1,'r')]:
            leg=self.groups['leg_'+suff];arm=self.groups['arm_'+suff]
            leg.SetOrientation(0,0,0);leg.RotateX(side*(base+strength*21*pulse))
            arm.SetOrientation(0,0,0);arm.RotateX(-side*(base*.56+strength*19*pulse))
        self.root.SetPosition(0,0,0 if gait=='idle' else strength*.020*abs(pulse))

def eye_decal(m,x,centerz):
    # Entire almond silhouette is porcelain sclera; the iris and pupil sit inside it.
    eyey=lambda px,zz:front_face_y(px,zz)-.017
    verts=[];faces=[];steps=20
    rx=.033;ry=.016
    for i in range(steps):
        a=2*math.pi*i/steps
        xx=x+rx*math.cos(a);zz=centerz+ry*math.sin(a)*(.84+.16*math.cos(a))
        verts.append((xx,eyey(xx,zz),zz))
    cx=x;cz=centerz
    verts.append((cx,eyey(cx,cz)-.0005,cz))
    for i in range(steps):faces.append((steps,i,(i+1)%steps))
    m.add(poly(verts,faces),'white','full_almond_sclera')
    for key,dx,r in [('iris',.004,.0095),('ink',.004,.0045),('white',.001,.0018)]:
        n=20;v=[(x+dx,eyey(x+dx,cz)-.004 if key!='white' else eyey(x+dx,cz)-.008,cz)]
        for i in range(n):
            a=2*math.pi*i/n;px=x+dx+r*math.cos(a);pz=cz+r*math.sin(a)
            v.append((px,eyey(px,pz)-(.004 if key=='iris' else .008 if key=='ink' else .012),pz))
        # intentionally flattened painted-like polygons
        m.add(poly(v,[(0,i,i+1) for i in range(1,n)]),key,key+'_pupil_decal')
    m.line([(x-.036,eyey(x-.036,cz+.009)-.001,cz+.010),
            (x,eyey(x,cz+.012)-.004,cz+.015),
            (x+.035,eyey(x+.035,cz+.008)-.001,cz+.009)],.0036,'ink','upper_eyelid')
    m.line([(x-.036,eyey(x-.036,cz-.009)-.001,cz-.009),
            (x,eyey(x,cz-.015)-.002,cz-.014),
            (x+.035,eyey(x+.035,cz-.008)-.001,cz-.009)],.002,'skinshade','lower_eyelid')
    z=cz+.040
    m.line([(x-.040,eyey(x-.040,z)-.004,z),
            (x-.005,eyey(x-.005,z+.005)-.007,z+.005),
            (x+.032,eyey(x+.032,z+.001)-.006,z+.001)],.006,'hair','eyebrow')

def hair(m):
    p=m.p;style=p['hair_style']
    if style=='fade':
        m.ell((0,-.028,1.777),(.151,.151,.091),'hair','short_faded_crown')
        for side in (-1,1):
            m.ell((side*.121,.004,1.710),(.022,.086,.054),'hair','temple_fade')
        for i in range(28):
            a=i*2.39996;rad=.034+.10*math.sqrt((i+1)/29)
            m.ell((rad*math.cos(a),.030+rad*.7*math.sin(a),1.803+.020*math.sin(a*3)),(.017,.018,.016),'hair','short_textured_curl',res=12)
    elif style=='braided_bun':
        m.ell((0,-.028,1.773),(.155,.150,.092),'hair','laid_braided_crown')
        m.ell((0,.114,1.785),(.107,.087,.088),'hair','wrapped_bun')
        for j in range(8):
            a=2*math.pi*j/8;x=.082*math.cos(a);z=1.788+.057*math.sin(a)
            m.line([(x,-.048,1.776),(x*.85,-.015,1.798),(.093*math.cos(a),.083,1.804),(x*.65,.170,z)],.005,'hair','sculpted_braid')
        m.line([(-.134,-.05,1.711),(-.145,.020,1.732),(-.123,.123,1.740)],.008,'hair','hairline_left')
    elif style=='buzz':
        m.ell((0,-.024,1.778),(.150,.144,.078),'hair','buzz_cut')
        for j in range(18):
            a=2*math.pi*j/18
            m.ell((.12*math.cos(a),.01+.098*math.sin(a),1.774),(.016,.019,.017),'hair','short_hair_stubble',res=12)
    elif style=='short_curls':
        m.ell((0,-.028,1.773),(.155,.15,.093),'hair','close_cropped_hair')
        for j in range(32):
            a=j*2.399963;rr=.03+.11*math.sqrt((j+1)/33)
            m.ell((rr*math.cos(a),.010+rr*.85*math.sin(a),1.792+.030*math.sin(a*3)),(.024,.021,.022),'hair','short_coiled_locks',res=14)
    elif style=='low_bun':
        m.ell((0,-.029,1.772),(.155,.153,.093),'hair','smooth_crown')
        m.ell((0,.143,1.694),(.091,.079,.093),'hair','low_coiled_bun')
        for side in (-1,1):
            m.line([(side*.115,-.085,1.730),(side*.132,.025,1.720),(side*.088,.140,1.704)],.009,'hair','pinned_side_hair')
    for side in (-1,1):
        m.ell((side*.141,-.003,1.602),(.017,.025,.043),'skin','ear',res=20)
        m.line([(side*.143,-.029,1.608),(side*.148,-.035,1.587)],.004,'skinshade','ear_detail')

def build(info):
    p=Person(info)
    # Independent legs and ankles. Cargo or office trousers have cuffs and distinct shoes.
    for part,side in [('leg_l',-1),('leg_r',1)]:
        p.cylinder((0,0,-.009),(side*.006,.010,-.412),.074,'pants','upper_pants',part,22)
        p.ell((side*.004,.010,-.390),(.080,.072,.125),'pants','knee_fabric',part,24)
        p.cylinder((side*.006,.012,-.413),(side*.008,.015,-.777),.059,'pants','lower_pants',part,20)
        p.ell((side*.008,.016,-.761),(.070,.066,.027),'pantshadow','cuffed_hem',part,24)
        for dz in [-.22,-.47,-.64]:
            p.line([(-.060,-.046,dz),(0,-.051,dz-.006),(.055,-.043,dz)],.003,'pantshadow','wrinkle_seam',part)
        if p.p['variant'] in ('utility-vest','work-jacket'):
            p.cube((side*.027,-.058,-.294),(.089,.028,.127),'pants','thigh_pocket',part)
            p.cube((side*.027,-.077,-.242),(.095,.009,.020),'pantshadow','pocket_flap',part)
            p.ell((side*.025,-.087,-.238),(.006,.004,.006),'accent','pocket_snap',part,12)
        p.ell((0,-.072,-.807),(.078,.144,.053),'shoe','three_dimensional_shoe',part,30)
        p.ell((0,-.081,-.849),(.081,.145,.017),'sole','sole_rim',part,30)
        p.ell((0,-.190,-.818),(.075,.040,.023),'shoe','toe_cap',part,22)
        p.line([(-.043,-.054,-.778),(0,-.108,-.774),(.042,-.054,-.778)],.004,'sole','shoe_top_stitch',part)
        for i in range(3):
            z=-.764-i*.015
            p.line([(-.023,-.080-i*.010,z),(.024,-.081-i*.010,z)],.003,'sole','sneaker_lace',part)
    # Shirt and structured upper garments: real solid torso and layered overlays.
    p.loft([(.856,.163,.134,.010),(.930,.177,.148,.009),(1.042,.189,.147,.009),
            (1.187,.202,.153,.012),(1.334,.213,.158,.016),(1.406,.194,.136,.018),
            (1.455,.121,.102,.018)],'top','continuous_tailored_torso',n=52)
    p.ell((0,-.136,1.288),(.095,.025,.138),'shirt','visible_center_shirt',res=34)
    p.ell((0,-.019,.922),(.175,.127,.081),'pants','waist_and_hips',res=28)
    p.line([(-.166,-.136,.911),(0,-.151,.907),(.167,-.132,.911)],.012,'pantshadow','work_belt')
    p.cube((0,-.160,.912),(.045,.017,.032),'metal','belt_buckle')
    for sign in (-1,1):
        # curved front jacket panels and side pockets
        p.strip([(sign*.137,-.156,1.376),(sign*.151,-.160,1.272),(sign*.157,-.154,1.104),(sign*.141,-.142,.985)],.069,'top','jacket_front_panel')
        p.line([(sign*.108,-.162,1.385),(sign*.108,-.174,1.281),(sign*.105,-.168,1.112)],.004,'tophi','raised_front_trim')
        p.line([(sign*.149,-.139,1.276),(sign*.180,-.126,1.162),(sign*.160,-.132,1.012)],.004,'topshadow','jacket_cutline')
        if p.p['variant']!='work-polo':
            p.cube((sign*.129,-.159,1.080),(.072,.025,.080),'top','front_pocket')
            p.cube((sign*.129,-.174,1.119),(.075,.008,.017),'tophi','flap_trim')
        if p.p['variant']=='utility-vest':
            for z in (1.08,1.12,1.24):
                p.line([(sign*.120,-.182,z),(sign*.155,-.174,z)],.005,'accent','utility_reflective_trim')
    p.line([(0,-.162,1.375),(0,-.164,1.24),(0,-.163,1.010)],.003,'topshadow','center_placket')
    p.ell((0,-.06,1.408),(.116,.068,.035),'tophi','raised_collar',res=28)
    for part,side in [('arm_l',-1),('arm_r',1)]:
        p.cylinder((0,0,-.015),(side*.062,.008,-.251),.080,'top','upper_sleeve',part,22)
        p.ell((side*.040,0,-.204),(.082,.076,.113),'top','fabric_at_elbow',part,22)
        p.cylinder((side*.059,.009,-.247),(side*.067,-.024,-.461),.060,'top','lower_sleeve',part,20)
        p.ell((side*.064,-.025,-.475),(.070,.066,.030),'tophi','cuff_fold',part,24)
        p.line([(side*.020,-.071,-.478),(side*.067,-.089,-.480),(side*.104,-.054,-.478)],.004,'accent','work_cuff_trim',part)
        p.ell((side*.065,-.032,-.535),(.052,.049,.082),'skin','hand_with_thumb',part,24)
        for i in range(4):
            xx=side*(.025+.015*i)
            p.cylinder((xx,-.066,-.575),(xx,-.071,-.596+.005*abs(i-1)),.007,'skin','individual_finger',part,10)
        if part=='arm_l':
            p.cylinder((side*.064,-.03,-.501),(side*.064,-.03,-.48),.054,'topshadow','watch_or_wristband',part,14)
            p.cube((side*.062,-.091,-.501),(.034,.008,.032),'accent','watch_face',part)
    # Collar, badge and chest trim; props are role-specific.
    p.cylinder((0,.01,1.389),(0,.01,1.522),.069,'skin','neck',res=26)
    p.add(custom_head(),'skin','integrated_sculpted_anime_face')
    for xx in (-.055,.055):eye_decal(p,xx,1.660)
    p.line([(-.037,front_face_y(-.037,1.525)-.020,1.526),(0,front_face_y(0,1.524)-.021,1.522),(.038,front_face_y(.038,1.526)-.020,1.526)],.003,'skinshade','subtle_mouth_line')
    hair(p)
    # Distinct uniforms and prop identifiers; waist bag / pen / ID remain real geometry.
    if p.p['role']=='receiving':
        p.line([(-.058,-.116,1.397),(-.037,-.164,1.303),(0,-.173,1.188),(.039,-.166,1.305),(.060,-.119,1.396)],.0035,'accent','identification_lanyard')
        p.cube((0,-.190,1.176),(.063,.014,.087),'badge','hanging_company_id')
        p.cube((0,-.198,1.179),(.045,.003,.044),'accent','badge_photo_and_barcode')
        p.ell((0,.153,1.192),(.140,.089,.173),'bag','small_stock_handling_bag',res=24)
    elif p.p['role']=='shelves':
        p.cube((-.119,-.183,1.196),(.046,.015,.058),'accent','work_name_patch')
        p.line([(-.084,-.186,1.180),(-.070,-.188,1.180)],.003,'topshadow','name_stitch')
        for side in (-1,1):
            p.line([(side*.169,.017,1.40),(side*.161,-.067,1.305),(side*.174,-.067,1.179)],.005,'accent','workwear_shoulder_piping')
    else:
        p.cube((.120,-.171,1.263),(.045,.020,.025),'accent','pen_case')
        p.cylinder((.115,-.179,1.271),(.115,-.179,1.325),.003,'metal','pen')
        p.cube((-.095,-.183,1.130),(.064,.012,.080),'badge','clerk_id')
    return p

def matrix(actor):
    m=actor.GetMatrix()
    return np.array([[m.GetElement(i,j) for j in range(4)] for i in range(4)],dtype=float)

def export_glb(person,out):
    person.pose()
    grouped=defaultdict(lambda:[[],[]])
    tri=0
    for actor,key,name,part in person.parts:
        mapper=actor.GetMapper();mapper.Update();inp=mapper.GetInput()
        f=vtk.vtkTriangleFilter();f.SetInputData(inp);f.Update();pd=f.GetOutput()
        if not pd.GetNumberOfPolys():continue
        verts=vtk_to_numpy(pd.GetPoints().GetData()).astype('f8')
        faces=vtk_to_numpy(pd.GetPolys().GetData()).reshape(-1,4)[:,1:].astype('i8')
        verts=trimesh.transform_points(verts,matrix(actor))
        if part!='body':verts=trimesh.transform_points(verts,matrix(person.groups[part]))
        verts=trimesh.transform_points(verts,matrix(person.root))
        vsets,fsets=grouped[key];shift=sum(len(v) for v in vsets)
        vsets.append(verts.astype('f4'));fsets.append(faces+shift);tri+=len(faces)
    scene=trimesh.Scene()
    for key,(vs,fs) in grouped.items():
        mesh=trimesh.Trimesh(vertices=np.concatenate(vs),faces=np.concatenate(fs),process=False)
        mat=trimesh.visual.material.PBRMaterial(name=key,baseColorFactor=rgba(person.mat(key)),metallicFactor=.1 if key in ('metal','accent') else .02,roughnessFactor=.6,doubleSided=True)
        mesh.visual=trimesh.visual.TextureVisuals(material=mat)
        scene.add_geometry(mesh,node_name=person.p['id']+'_'+key)
    target=out/(person.p['id']+'.glb');scene.export(str(target))
    loaded=trimesh.load(str(target),force='scene')
    assert len(loaded.geometry)>=7 and tri>12000
    return {'file':target.name,'bytes':target.stat().st_size,'triangles':tri,'meshes':len(loaded.geometry),'bounds':np.array(loaded.bounds).round(4).tolist()}

def setup_renderer(person,view,size,alpha=True):
    r=vtk.vtkRenderer();r.SetBackground(.06,.062,.078)
    if alpha:r.SetBackgroundAlpha(0)
    r.AddActor(person.root)
    win=vtk.vtkRenderWindow();win.SetSize(*size);win.SetMultiSamples(0);win.SetAlphaBitPlanes(1);win.SetOffScreenRendering(True);win.AddRenderer(r)
    camera=r.GetActiveCamera();camera.ParallelProjectionOn();camera.SetViewUp(0,0,1)
    views={'sprite':((0,-6,4),(0,0,.88),1.18),'front':((0,-5,2.1),(0,0,.92),1.16),
           'quarter':((-4,-6,3.1),(0,0,.90),1.18),'profile':((-6,0,2.15),(0,0,.90),1.15),
           'back':((0,6,2.1),(0,0,.90),1.17)}
    pos,target,scale=views[view];camera.SetPosition(*pos);camera.SetFocalPoint(*target);camera.SetParallelScale(scale)
    for xyz,intensity,c in [((-3,-4,7),.95,(1,.85,.75)),((4,2,6),.64,(.70,.8,1)),((2,-4,3),.37,(1,.8,.65))]:
        light=vtk.vtkLight();light.SetPosition(*xyz);light.SetFocalPoint(0,0,1);light.SetIntensity(intensity);light.SetColor(*c);r.AddLight(light)
    r.ResetCameraClippingRange();return win

def shot(win,alpha=True):
    win.Render();f=vtk.vtkWindowToImageFilter();f.SetInput(win);f.ReadFrontBufferOff()
    f.SetInputBufferTypeToRGBA() if alpha else f.SetInputBufferTypeToRGB();f.Update()
    d=f.GetOutput().GetDimensions();a=vtk_to_numpy(f.GetOutput().GetPointData().GetScalars()).reshape(d[1],d[0],-1)
    return Image.fromarray(np.flipud(a).copy())

def render_one(person,out,preview_only=False):
    slug=person.p['id'];out.mkdir(parents=True,exist_ok=True)
    info=export_glb(person,out)
    preview=Image.new('RGB',(440*4,590),(28,28,33))
    for i,view in enumerate(['front','quarter','profile','back']):
        person.pose();win=setup_renderer(person,view,(440,590),False);im=shot(win,False)
        d=ImageDraw.Draw(im);d.rectangle((0,0,440,42),fill=(23,25,30));d.text((18,14),person.p['name']+' | '+view.upper(),fill=(239,214,174))
        preview.paste(im,(i*440,0));win.Finalize()
    preview.save(out/(slug+'_four_view.png'))
    if preview_only:return info
    atlas=Image.new('RGBA',(256,576),(0,0,0,0));rw=256;rh=384
    win=setup_renderer(person,'sprite',(rw,rh),True)
    for row in range(12):
        gait=['idle','walk','run'][row//4];frame=row%4
        for col,(_,yaw) in enumerate(DIRS):
            person.pose(yaw,gait,frame);render=shot(win,True)
            sprite=render.resize((32,48),Image.Resampling.LANCZOS)
            atlas.alpha_composite(sprite,(32*col,48*row))
        print(slug,'gait',gait,'row',row,'/',11,flush=True)
    win.Finalize();atlas.save(out/(slug+'_8dir_12row_atlas.png'))
    alpha=np.asarray(atlas.getchannel('A'))
    count=[int(np.count_nonzero(alpha[y*48:(y+1)*48,x*32:(x+1)*32]>20)) for y in range(12) for x in range(8)]
    assert atlas.size==(256,576) and min(count)>12,(slug,min(count))
    # Turnaround hero poster: enlarge the 8 direction idle cells.
    review=Image.new('RGB',(8*120,212),(29,30,37));d=ImageDraw.Draw(review)
    for col,(bearing,_) in enumerate(DIRS):
        region=atlas.crop((col*32,0,(col+1)*32,48)).resize((96,144),Image.Resampling.NEAREST)
        review.paste(region,(col*120+12,46),region)
        d.text((col*120+20,13),bearing,fill=(229,206,165))
    review.save(out/(slug+'_direction_review.png'))
    info.update({'atlas':slug+'_8dir_12row_atlas.png','atlas_bytes':(out/(slug+'_8dir_12row_atlas.png')).stat().st_size,
                 'min_filled_pixels_per_cell':min(count),'max_filled_pixels_per_cell':max(count)})
    return info

def main():
    ap=argparse.ArgumentParser();ap.add_argument('--out',default='public/play/assets/procedural');ap.add_argument('--preview-only',action='store_true')
    ap.add_argument('--only',default='',help='optional comma-separated slugs')
    opt=ap.parse_args();out=Path(opt.out).resolve();out.mkdir(parents=True,exist_ok=True)
    selected=[p for p in CHARACTERS if not opt.only or p['id'] in opt.only.split(',')]
    audits=[];start=time.monotonic()
    for p in selected:
        print('BUILD',p['name'],flush=True)
        audits.append({'character':p['name'],**render_one(build(p),out,opt.preview_only)})
    (out/'home_more_workers_vtk_manifest.json').write_text(json.dumps({
        'generator':'VTK '+vtk.vtkVersion.GetVTKVersion(),'asset_status':'Unrigged real 3D model and baked 96-frame sprite atlas',
        'gaits':['idle','walk','run'],'bearings':[x[0] for x in DIRS],
        'cell':[32,48],'total_seconds':round(time.monotonic()-start,2),
        'characters':audits},indent=2))
    print('GENERATED',len(audits),'CHARACTERS',round(time.monotonic()-start,2),'seconds',flush=True)
if __name__=='__main__': main()