#!/usr/bin/env python3
"""Hero Shooter Ismail — sculpted procedural VTK 3D model and 8-way atlas.
Approved reference: Ismail Hero Shooter Sprite Sheet(1).png and repo PR #32.
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
P={'skin':'#A96A45','skin_shadow':'#774631','skin_hi':'#DA9770',
'hair':'#17161B','hair_hi':'#30282B','beard':'#261C1C','beard_mid':'#3A2827',
'lip':'#794D44','iris':'#2E211B','eye_white':'#E9D5B8',
'headband':'#3D3030','headband_shadow':'#2C2527','headband_light':'#E8DCC3','headband_gold':'#C59A57',
'hood_dark':'#34323B','hood_grey':'#5E5964','hood_hi':'#746975','shirt':'#36353D','shirt_mid':'#57545D',
'jacket':'#272630','jacket_shadow':'#1D1C26','jacket_hi':'#49414C',
'yellow':'#E5A92F','yellow_shadow':'#B8751F','gold':'#D3A149','seam':'#6B5F5C',
'cargo':'#3D3B43','cargo_hi':'#565059','cargo_shadow':'#24242D','belt':'#221D24',
'badge':'#292B35','badge_white':'#D9D4C9','badge_gold':'#E7AE32','metal':'#A9A2A0','lanyard':'#C99D42',
'sneaker_dark':'#25232B','sneaker_sole':'#F2EFE4','sneaker_toe':'#47444E','sneaker_white':'#F6EFE0','sneaker_grey':'#6C646D',
'watch':'#BE9345','watch_face':'#E8B953','watch_inner':'#1A222E',
'headphone':'#262329','headphone_face':'#3D3842','headphone_accent':'#C38D36',
'backpack':'#2B2A35','strap':'#4F4244'}
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


# Sculpted Ismail-specific mesh and clothing geometry.
def face_surface(x,z):
    dz=z-1.611
    return -.014-.119*math.sqrt(max(.07,1-(x/.137)**2-(dz/.183)**2))-.014*gaussian(x,0,.033)*gaussian(dz,.004,.053)
def face_geometry():
    verts=[];faces=[];n=100;h=64
    for k in range(h+1):
        theta=(k+1e-5)/(h+2e-5)*math.pi
        for j in range(n):
            phi=2*math.pi*j/n
            xx=.137*math.sin(theta)*math.cos(phi)
            yy=.117*math.sin(theta)*math.sin(phi)
            zz=.183*math.cos(theta)
            # Integrated nasal anatomy: bridge, tip, alae, philtrum, brow and cheekbone.
            if yy<-.016:
                proj=(.013*gaussian(xx,0,.029)*gaussian(zz,.016,.058)
                    +.018*gaussian(xx,0,.025)*gaussian(zz,-.045,.027)
                    +.007*(gaussian(xx,.036,.016)+gaussian(xx,-.036,.016))*gaussian(zz,-.055,.019)
                    +.005*gaussian(xx,0,.034)*gaussian(zz,-.079,.014)
                    +.006*(gaussian(xx,.074,.026)+gaussian(xx,-.074,.026))*gaussian(zz,-.055,.07)
                    +.006*(gaussian(xx,.058,.03)+gaussian(xx,-.058,.03))*gaussian(zz,.055,.036))
                yy-=proj
            xx*=1-.17*gaussian(zz,-.13,.065) # angular jaw / tapered chin
            verts.append((xx,yy-.014,zz+1.611))
            if k:
                a=(k-1)*n+j;b=(k-1)*n+(j+1)%n;c=k*n+j;d=k*n+(j+1)%n
                faces.extend(((a,c,b),(b,c,d)))
    return poly(verts,faces)

def weave_ornament(m):
    # Wide fitted textile wrap across forehead, with repeat ivory zigzag stitches.
    track=[(-.144,-.026,1.742),(-.133,-.078,1.747),(-.100,-.111,1.749),(-.058,-.128,1.751),
           (0,-.134,1.749),(.060,-.123,1.749),(.107,-.101,1.747),(.139,-.049,1.741),(.144,.022,1.735)]
    m.ribbon(track,[.072,.077,.075,.073,.071,.075,.075,.072,.065],'headband','geometric_woven_headband')
    m.line(track,.0032,'headband_shadow','headband_lower_seam')
    for j in range(12):
        x=-.115+.021*j
        y=-.139*math.sqrt(max(.12,1-(x/.160)**2))-.012
        z=1.748
        m.line([(x-.008,y-.003,z-.017),(x,y-.004,z+.012),(x+.008,y-.003,z-.017)],.0027,
               'headband_light','woven_ivory_chevrons')
        m.line([(x-.008,y-.004,z+.016),(x,y-.004,z-.009),(x+.008,y-.004,z+.016)],.002,'headband_gold','woven_gilt_chevrons')
    for x in [-.116,-.083,-.05,-.018,.015,.049,.082,.113]:
        m.ell((x,-.139*math.sqrt(max(.12,1-(x/.16)**2))-.014,1.747),(.002,.003,.005),'headband_gold','trim_stitch',res=10)

def build():
    m=Character()
    # Standing legs are independently pivotable and meet the shoes at floor level.
    for group,s in [('leg_l',-1),('leg_r',1)]:
        m.cyl((0,0,-.009),(s*.007,.018,-.440),.067,'cargo','upper_leg_trouser',group,20)
        m.ell((s*.006,.005,-.37),(.079,.073,.160),'cargo_hi','knee_cloth_layers',group)
        m.cyl((s*.007,.018,-.429),(s*.012,.012,-.777),.058,'cargo','lower_leg_trouser',group,20)
        m.cyl((s*.011,.01,-.754),(s*.011,.009,-.803),.067,'cargo_shadow','ankle_cuff',group,18)
        # 3D cargo-pockets with seams, flap closures and two-dimensional fabric panelling.
        m.cube((s*.034,-.054,-.290),(.076,.032,.155),'cargo_hi','cargo_pocket',group)
        m.cube((s*.034,-.072,-.233),(.078,.008,.024),'cargo_shadow','cargo_flap',group)
        m.cube((s*.020,-.076,-.240),(.015,.006,.014),'gold','pocket_snap',group)
        for z in [-.16,-.48,-.68]:
            m.line([(-.052,-.042,z),(0,-.051,z-.008),(.055,-.042,z)],.0029,'seam','trouser_fold',group)
        # Contrasting black-and-white sneakers with real 3D volume.
        m.ell((0,-.074,-.812),(.071,.150,.047),'sneaker_dark','sneaker_body',group,res=36)
        m.ell((0,-.087,-.844),(.075,.15,.019),'sneaker_sole','sneaker_white_sole',group,res=36)
        m.ell((0,-.183,-.828),(.071,.052,.027),'sneaker_toe','rounded_sneaker_toe',group,res=24)
        m.line([(-.063,-.087,-.834),(0,-.137,-.836),(.062,-.087,-.834)],.005,'sneaker_white','shoe_contrast_motifs',group)
        for j in range(5):
            y=-.058-j*.021
            m.line([(-.027,y,-.762-j*.007),(.027,y-.003,-.762-j*.007)],.003,'sneaker_white','individual_shoe_laces',group)
        m.line([(-.055,-.018,-.827),(0,.037,-.827),(.055,-.018,-.827)],.005,'sneaker_grey','heel_sneaker_trim',group)
    # Layered torso, hooded tee and open light-trimmed work jacket.
    m.loft([(.851,.167,.143,.014),(.942,.175,.147,.013),(1.030,.174,.140,.011),
            (1.188,.193,.145,.015),(1.355,.219,.159,.023),(1.408,.201,.144,.025),
            (1.462,.128,.100,.025)],'shirt','inner_dark_tshirt',n=54)
    m.ell((0,-.075,1.155),(.171,.059,.234),'shirt_mid','front_tee',res=30)
    # Jacket body: two separate tailored fronts, shoulder seams, a structured V-shaped opening.
    for side in [-1,1]:
        m.ribbon([(side*.095,-.140,1.432),(side*.137,-.161,1.344),(side*.134,-.164,1.185),
                  (side*.119,-.159,1.008),(side*.124,-.134,.872)],
                 [.145,.135,.130,.122,.119],'jacket','tailored_open_jacket_panels')
        m.ribbon([(side*.082,-.154,1.425),(side*.107,-.173,1.356),(side*.113,-.177,1.231),
                  (side*.107,-.173,1.053),(side*.104,-.151,.876)],
                 [.026,.035,.032,.028,.022],'jacket_hi','raised_jacket_lapel')
        m.line([(side*.087,-.167,1.416),(side*.111,-.184,1.347),(side*.103,-.175,1.17),
                (side*.101,-.174,1.02),(side*.100,-.156,.876)],.004,'gold','fine_zipper_tape')
        m.line([(side*.141,-.090,1.379),(side*.174,-.105,1.241),(side*.176,-.104,1.078),
                (side*.160,-.084,.921)],.003,'jacket_hi','jacket_panel_seam')
        m.cube((side*.137,-.175,1.127),(.080,.023,.065),'jacket_shadow','chest_flap_pocket')
        m.cube((side*.138,-.189,1.153),(.086,.012,.019),'jacket_hi','chest_flap_lip')
        m.line([(side*.096,-.182,1.021),(side*.120,-.190,1.018),(side*.158,-.183,1.021)],.003,'headband_gold','jacket_trim_badge_stitch')
        m.ell((side*.145,-.191,1.160),(.009,.004,.007),'gold','pocket_stud',res=12)
        m.ribbon([(side*.17,-.020,1.395),(side*.192,.056,1.325),(side*.174,.107,1.243)],
                 [.11,.126,.10],'jacket_shadow','shoulder_collar_back')
    # Grey hood from behind the neck, not floating over the jacket.
    m.ell((0,.080,1.430),(.212,.122,.108),'hood_dark','hood_back',res=36)
    m.ell((0,-.031,1.418),(.125,.090,.072),'hood_grey','hood_neck_inner',res=30)
    m.line([(-.140,-.065,1.425),(-.108,-.096,1.393),(0,-.119,1.385),(.108,-.097,1.395),(.140,-.065,1.425)],
           .007,'hood_hi','padded_hood_rim')
    # Shirt / jacket closure and small details.
    m.line([(-.009,-.177,1.375),(-.009,-.178,1.220),(-.009,-.180,1.105),(-.009,-.160,.940)],.0028,'seam','tee_center_crease')
    for z in [1.314,1.207,1.120,.955]:
        m.ell((-.090,-.178,z),(.004,.004,.005),'gold','jacket_button_studs',res=10)
    m.ell((0,-.036,.865),(.166,.147,.043),'cargo_shadow','waistband',res=30)
    m.line([(-.15,-.135,.890),(0,-.159,.886),(.15,-.135,.89)],.011,'belt','woven_belt')
    m.cube((0,-.170,.886),(.049,.013,.035),'metal','belt_buckle')
    m.cube((0,-.181,.887),(.027,.015,.017),'cargo_shadow','belt_inner_buckle')
    # Split collar/hood drawstrings + lanyard with actual solid badge.
    for s in [-1,1]:
        m.line([(s*.045,-.122,1.410),(s*.065,-.137,1.312),(s*.063,-.150,1.238)],.003,'hood_hi','drawstring')
        m.ell((s*.063,-.154,1.233),(.005,.004,.008),'gold','drawstring_tip',res=12)
        m.line([(s*.058,-.132,1.406),(s*.056,-.174,1.304),(0,-.187,1.145)],.0042,'lanyard','id_lanyard_straps')
    m.cube((0,-.197,1.113),(.060,.014,.087),'badge','staff_id_badge')
    m.cube((0,-.207,1.113),(.049,.004,.074),'badge_white','badge_inner_card')
    m.cube((0,-.210,1.133),(.036,.004,.019),'badge_gold','badge_photo_zone')
    m.line([(-.017,-.211,1.094),(.017,-.211,1.094)],.002,'seam','badge_line_one')
    m.line([(-.014,-.211,1.081),(.011,-.211,1.081)],.002,'seam','badge_line_two')
    # Arms: actual cuffs, elbows, fingers and contrasting merchandiser jacket stripes.
    for group,s in [('arm_l',-1),('arm_r',1)]:
        m.cyl((0,0,-.023),(s*.050,.013,-.263),.086,'jacket','upper_sleeve',group,res=26)
        m.ell((s*.03,-.007,-.179),(.086,.075,.137),'jacket_shadow','fabric_elbow_folds',group,res=24)
        m.cyl((s*.053,.013,-.255),(s*.049,-.032,-.472),.063,'jacket','lower_sleeve',group,res=24)
        m.ell((s*.050,-.032,-.484),(.073,.072,.037),'jacket_shadow','cuff',group,res=22)
        m.line([(s*.109,-.039,-.485),(s*.043,-.093,-.485),(s*-.013,-.041,-.485)],.004,'gold','gold_trim_at_cuff',group)
        m.ell((s*.047,-.033,-.544),(.049,.050,.089),'skin','open_neutral_hand',group,res=30)
        for j in range(4):
            xx=s*(.023+j*.015)
            m.cyl((xx,-.069,-.583),(xx,-.078,-.611+abs(j-1)*.006),.008,'skin','fingers',group,res=10)
        # Signature broad yellow bands, cuff stitch, shoulder emblem.
        for z in [-.145,-.168,-.225]:
            m.line([(s*.048+.082*math.cos(i*2*math.pi/24),.008+.079*math.sin(i*2*math.pi/24),z) for i in range(25)],
                   .009 if z!=-.168 else .012,'yellow' if z!=-.168 else 'yellow_shadow','gold_sleeve_stripes',group)
        for k in range(6):
            phi=2*math.pi*k/6
            x=s*.055+.019*math.cos(phi);z=-.115+.020*math.sin(phi)
            m.ell((x,-.093,z),(.012,.006,.009),'gold' if k%2 else 'yellow','sleeve_flower_emblem',group,12)
        m.ell((s*.055,-.10,-.115),(.006,.006,.006),'yellow','floral_emblem_center',group,12)
        if s<0:
            m.cyl((s*.053,-.03,-.51),(s*.053,-.03,-.49),.058,'watch','wristwatch_body',group,18)
            m.cube((s*.054,-.090,-.503),(.052,.011,.047),'watch_face','watch_gold_face',group)
            m.cube((s*.055,-.100,-.503),(.029,.005,.030),'watch_inner','watch_dark_dial',group)
        # Trim and visible running cloth creases.
        m.line([(s*.032,-.090,-.271),(s*.063,-.094,-.322),(s*.061,-.092,-.411)],.003,'jacket_hi','forearm_crease',group)
    # Head-neck connection, face sculpture, ears.
    m.cyl((0,.02,1.388),(0,.01,1.524),.073,'skin','neck',res=28)
    m.add(face_geometry(),'one_piece_sculpted_face','skin')
    for s in [-1,1]:
        m.ell((s*.143,-.01,1.588),(.021,.028,.050),'skin','ears',res=24)
        m.ell((s*.153,-.03,1.590),(.006,.005,.025),'skin_shadow','inner_ear_relief',res=16)
    # Eyes, eyebrow ridge and softly flattened pupils.
    for s in [-1,1]:
        xx=s*.055;zz=1.650;yy=face_surface(xx,zz)-.008
        m.ell((xx,yy,zz),(.028,.003,.0065),'eye_white','slim_natural_eye',res=22)
        m.ell((xx,yy-.005,zz-.002),(.008,.003,.006),'iris','brown_iris',res=18)
        m.line([(xx-.030,yy,zz+.006),(xx,yy-.005,zz+.010),(xx+.030,yy,zz+.008)],.0039,'hair','upper_eyelid')
        m.line([(xx-.030,yy+.001,zz-.008),(xx,yy-.002,zz-.009),(xx+.029,yy,zz-.006)],.0025,'skin_shadow','lower_lid')
        m.line([(xx-.036,yy+.004,zz+.032),(xx-.006,yy-.009,zz+.039),(xx+.029,yy+.004,zz+.034)],.006,'hair','bold_eyebrow')
    # Facial hair grown along face contours, not a painted/flat black head panel.
    for s in [-1,1]:
        m.ribbon([(s*.117,-.042,1.560),(s*.109,-.084,1.540),(s*.089,-.107,1.514),
                  (s*.057,-.120,1.486),(s*.021,-.128,1.476)],
                 [.023,.035,.040,.041,.026],'beard','close_fitted_jawline_beard_patch')
        m.line([(s*.120,-.038,1.571),(s*.112,-.086,1.542),(s*.093,-.106,1.519),
                (s*.064,-.121,1.495)],.0048,'beard_mid','fine_beard_contour')
        m.line([(s*.076,-.112,1.529),(s*.071,-.116,1.517),(s*.058,-.114,1.506)],.0034,'beard_mid','facial_stubble_edge')
        m.line([(s*.008,-.131,1.543),(s*.026,-.128,1.551),(s*.047,-.117,1.547)],.0054,'beard','short_moustache')
        m.line([(s*.018,-.132,1.509),(s*.004,-.135,1.504)],.0028,'lip','small_mouth_corners')
    m.ell((0,-.125,1.479),(.036,.006,.009),'beard','sculpted_goatee_tip',res=30)
    m.line([(-.035,-.134,1.512),(0,-.142,1.509),(.036,-.133,1.513)],.003,'lip','quiet_confident_smile')
    m.line([(-.023,-.139,1.560),(-.013,-.142,1.556),(0,-.145,1.558),(.012,-.143,1.556),(.023,-.139,1.560)],.0022,'skin_shadow','nose_base_relief')
    # Coiled hair mass and long locs in a tied-back pattern: side view shows volume and depth.
    m.ell((0,.018,1.770),(.145,.131,.104),'hair','close_coiled_crown',res=42)
    m.ell((0,.073,1.782),(.135,.116,.086),'hair_hi','rear_coils',res=38)
    m.ell((0,.115,1.808),(.087,.093,.069),'hair','tied_loc_bun',res=30)
    for j in range(20):
        ang=j*2.399963
        rad=.041+.052*math.sqrt((j+1)/21)
        x=rad*math.cos(ang);y=.076+rad*.83*math.sin(ang);z=1.816+.049*math.sin(ang*3)
        m.ell((x,y,z),(.027,.030,.024),'hair' if j%4 else 'hair_hi','coiled_hair_locks',res=16)
    for j in range(18):
        a=2*math.pi*j/18
        x=.092*math.cos(a);z=1.81+.058*math.sin(a)
        m.line([(x*.55,.134,z+.010),(x,.178,z),(x*.83+.007,.244,z-.069)],.010 if j%3 else .013,
               'hair' if j%3 else 'hair_hi','individually_sculpted_short_locs')
    # Tapered hairline and sideburns sit behind headband.
    for s in [-1,1]:
        m.line([(s*.139,-.032,1.732),(s*.137,-.069,1.687),(s*.129,-.065,1.609),(s*.119,-.074,1.565)],.009,
               'hair','short_sideburns')
    weave_ornament(m)
    # Black over-ear headphones around collar, with yellow ring plates and padded yoke.
    m.line([(-.148,-.032,1.465),(-.148,-.087,1.449),(-.103,-.153,1.407),
            (0,-.161,1.399),(.103,-.153,1.407),(.148,-.087,1.449),(.148,-.032,1.465)],.025,'headphone','neckband_headphones')
    for s in [-1,1]:
        m.ell((s*.135,-.145,1.406),(.058,.039,.077),'headphone','deep_headphone_earpads',res=36)
        m.ell((s*.135,-.184,1.409),(.050,.014,.057),'headphone_face','earpad_outer_shell',res=32)
        m.ell((s*.135,-.198,1.410),(.035,.007,.040),'headphone_accent','gold_trim_on_headphones',res=26)
        m.ell((s*.135,-.208,1.411),(.021,.005,.026),'headphone','headphone_cup_center',res=22)
        m.line([(s*.117,-.177,1.471),(s*.146,-.162,1.477),(s*.168,-.150,1.459)],.0045,'gold','headphone_mounting_clips')
    # Backpack and webbing, accessories present but nonintrusive in game art.
    m.ell((0,.170,1.188),(.151,.088,.230),'backpack','small_merchandising_backpack',res=30)
    for s in [-1,1]:
        m.ribbon([(s*.137,.115,1.385),(s*.155,-.046,1.338),(s*.169,-.087,1.195),
                  (s*.160,-.066,1.072)], [.048,.045,.050,.042],'strap','functional_backpack_straps')
        m.cube((s*.158,-.105,1.128),(.025,.014,.040),'gold','strap_buckle')
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
  scene.add_geometry(obj,node_name='Ismail_'+material)
 scene.export(str(O/'ismail_unarmed_vtk.glb'))
 check=trimesh.load(str(O/'ismail_unarmed_vtk.glb'),force='scene')
 audit={'person':'Ismail','source':'Hero Shooter PR #32, Ismail merchandiser approved directional atlas',
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
  im.save(O/f'ismail_{view}.png');montage.paste(im,(i%3*450,i//3*580));win.Finalize()
 ref=O/'ismail_approved_reference_crop.png'
 if ref.exists():
  r=Image.open(ref).convert('RGB').crop((0,0,400,965));r.thumbnail((350,500))
  montage.paste(r,(945,640));ImageDraw.Draw(montage).text((960,605),'APPROVED REFERENCE',fill=(245,211,156))
 montage.save(O/'ismail_5_view_comparison.png')

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
 hi.save(O/'ismail_vtk_atlas_4x.png');sm.save(O/'ismail_vtk_atlas_32x48.png')
 review=Image.new('RGB',(8*145,250),(28,24,37));d=ImageDraw.Draw(review)
 for i,img in enumerate(qa):
  bg=Image.new('RGB',(128,192),(40,34,45));bg.paste(img,(0,0),img)
  review.paste(bg,(145*i+7,45));d.text((145*i+12,18),DIR[i][0]+f' / {DIR[i][2]} deg',fill=(241,200,137))
 review.save(O/'ismail_direction_QA.png');win.Finalize()
 meta={'character':'Ismail','basis':'hero-sprite-bearings contract','screen_x':'+right','screen_y':'+down','angles':'clockwise from east 0 deg',
       'columns':['S','SW','W','NW','N','NE','E','SE'],'rows':'0-3 idle; 4-7 walk; 8-11 run','cell':[32,48],
       'glb_animation':'unrigged; atlas frames posed directly in VTK','frames':metadata}
 (O/'sprite_metadata.json').write_text(json.dumps(meta,indent=2))
 al=np.asarray(sm.getchannel('A'));occupied=[int(np.count_nonzero(al[row*48:(row+1)*48,col*32:(col+1)*32]>24)) for row in range(12) for col in range(8)]
 assert sm.size==(256,576) and hi.size==(1024,2304) and min(occupied)>20
 (O/'sprite_validation.json').write_text(json.dumps({'directions':8,'gaits':3,'frames_per_gait':4,'total_cells':96,'min_filled_pixels':min(occupied),'max_filled_pixels':max(occupied),'valid':True},indent=2))

README='''# Ismail — Hero Shooter, sculpted procedural VTK merchandiser

Source: Hero Shooter repo open PR #32 (`art/ismail-merchandiser`) plus approved Ismail Hero Shooter Sprite Sheet(1).png. This is Ismail (not the alternative Ismael concept). Identity design from the actual repo atlas: geometric fabric headband, short tied locs, lightly bearded face, headphones worn around his neck, charcoal jacket with gold stripes and flower sleeve emblem, pale hooded inner shirt, hanging shop ID badge, cargo trousers and black/white sneakers.

The deliverable is **genuine 3D geometry** built from VTK sources: custom continuous sculpted facial surface with integrated nose, face and beard contours, fitted headwrap with woven relief, actual curled strands, 3D padded headphones, layer-separated jacket, individual sleeve trim, pockets, belt, backpack straps, hanging ID card, watch, articulated arms/legs and fully shaped trainers.

- `ismail_approved_reference_crop.png`: approved character-reference inset used in the comparison render.
- `ismail_unarmed_vtk.glb`: real three-dimensional static neutral model, +Z up / front -Y, approx. 1.89 metres tall.
- `ismail_5_view_comparison.png`: front/3-4/profile/back/overhead with cropped approved source.
- `ismail_direction_QA.png`: approved bearing orientation with no mirrored shortcuts.
- `ismail_vtk_atlas_32x48.png`: 256x576 transparent atlas (8 directions x 12 rows).
- `ismail_vtk_atlas_4x.png`: 1024x2304 high-resolution atlas.
- `sprite_metadata.json`, `sprite_validation.json`, `geometry_audit.json`: machine-readable validation.
- `build_ismail_vtk.py`: rebuild with `xvfb-run -a python build_ismail_vtk.py` (numpy, VTK, Pillow, trimesh).

**Critical limitations:** GLB is unrigged; procedural limb pivots are used only during the raster sprite export. The results are artist-review candidates, not replacements for the existing PR #32 files and not yet deployed. A full animation-ready skeletal rig would need an additional rigging pass. Alt atlas appearance is distinct from non-selected `Ismael` concept art.

Atlas columns S,SW,W,NW,N,NE,E,SE in that order, 32x48 cells; 0-3 idle, 4-7 walk, 8-11 run; game +X right, +Y down, clockwise angles from East. No 3D compass rotations are silently substituted for the game contract.
'''
def main():
 t=time.time();m=build();print('Generated VTK components',len(m.parts),flush=True)
 audit=glb_export(m);print('GLB triangles',audit['triangles'],flush=True)
 studio(m);print('Five-view geometry QA rendered',flush=True)
 atlas(m);(O/'README.md').write_text(README)
 with zipfile.ZipFile(O/'ismail_vtk_asset_pack.zip','w',compression=zipfile.ZIP_DEFLATED) as z:
  for p in sorted(O.iterdir()):
   if p.is_file() and not p.name.startswith('_') and p.name not in ('ismail_vtk_asset_pack.zip','compile_source.py','build.log'):z.write(p,p.name)
 print('COMPLETE',round(time.time()-t,1),'seconds',flush=True)
if __name__=='__main__':main()