#!/usr/bin/env python3
"""Hero Shooter C — independent anatomical character trial using MakeHuman HM08 CC0 mesh.

Not a Blender/MPFB invocation. Reimplements a small documented subset of
MakeHuman's macro-target morph concept using the official base OBJ and target
files, adds newly authored stylised C clothing/face details, exports genuine GLB,
and renders VTK review views. No edits to the approved C V6.1 asset.

Source licence: https://github.com/makehumancommunity/makehuman/blob/master/LICENSE.md
Official source revision: a8bc2d54ff0ac92e78ff71431b1023eda42bf482
"""
import argparse, math, json, urllib.request, hashlib, pathlib, io
import numpy as np
import trimesh
from PIL import Image, ImageDraw, ImageFont
import vtk
from vtk.util.numpy_support import numpy_to_vtk, vtk_to_numpy

COMMIT='a8bc2d54ff0ac92e78ff71431b1023eda42bf482'
RAW=f'https://raw.githubusercontent.com/makehumancommunity/makehuman/{COMMIT}/makehuman/data/'
# Neutral blend of official standard female-young macro targets (not identity).
TARGETS=[
 ('targets/macrodetails/caucasian-female-young.target', 1/3),
 ('targets/macrodetails/african-female-young.target', 1/3),
 ('targets/macrodetails/asian-female-young.target', 1/3),
 ('targets/macrodetails/universal-female-young-averagemuscle-averageweight.target', 1.0),
]
HEIGHT=1.68 # tentative design height, not an established canonical measurement
COLORS={
 'skin':'#C78768','skinshadow':'#A97054','hair':'#773A2B','hairlight':'#AB6040','hairdark':'#482A27',
 'headband':'#F4EBDD','flower':'#FFF9EC','flower_center':'#CEAB63',
 'jacket':'#33323C','jacket2':'#48404A','cargo':'#302F36','cargolight':'#45404A',
 'boots':'#41342F','bootsole':'#242326','armor':'#A18B79','olive':'#887A5B','tan':'#C2AB84',
 'vest':'#554F42','vest_dark':'#3B3834','scarf':'#E9DFD2','scarf_ink':'#2F2935',
 'eye_white':'#F4D9CF','iris':'#6B3D2B','pupil':'#1C1921','brows':'#322326','lip':'#954F50',
 'eyeliner':'#2C2225','blush':'#CB867A','metal':'#ACB5B2','belt':'#29282C',
 'patch':'#CFA657','radio':'#303039'
}

def rgba(key):
 h=COLORS.get(key,key).lstrip('#');return list(int(h[i:i+2],16) for i in (0,2,4))+[255]

def download_cached(rel,cache,sha=None):
 dest=cache/rel.replace('/','__'); dest.parent.mkdir(parents=True,exist_ok=True)
 if not dest.exists():
  print('FETCH',rel, flush=True)
  req=urllib.request.Request(RAW+rel,headers={'User-Agent':'HeroShooterResearchModel/0.1'})
  with urllib.request.urlopen(req,timeout=90) as r: dest.write_bytes(r.read())
 if dest.stat().st_size<100: raise RuntimeError(f'Download unexpectedly short: {rel}')
 return dest

def load_mh_obj(path):
 # Preserve original global vertex indices while discarding all helper faces.
 vs=[]; faces=[]
 with open(path,encoding='utf-8',errors='replace') as f:
  for line in f:
   if line.startswith('v '):
    a=line.split();vs.append([float(a[1]),float(a[2]),float(a[3])])
   elif line.startswith('f '):
    nums=[int(s.split('/')[0])-1 for s in line.split()[1:]]
    if len(nums)>=3 and all(0<=j<13380 for j in nums):
     for i in range(1,len(nums)-1):faces.append((nums[0],nums[i],nums[i+1]))
 v=np.asarray(vs,dtype=np.float64); f=np.asarray(faces,dtype=np.int64)
 if len(v)<19158 or not (9000<len(f)<60000):raise RuntimeError(f'Unexpected HM08 mesh layout: {v.shape}, {f.shape}')
 return v, f

def apply_mh_target(vertices,path,w):
 indices=[];diff=[]
 with open(path,'r',errors='replace') as f:
  for line in f:
   a=line.split()
   if len(a)>=4 and a[0][0].isdigit():
    indices.append(int(a[0]));diff.append([float(a[1]),float(a[2]),float(a[3])])
 if indices:vertices[np.asarray(indices,dtype=int)]+=np.asarray(diff,dtype=float)*w
 return len(indices)

def world(p):
 # MH: X horizontal / Y up / +Z frontal; output +Z up / front toward -Y.
 return np.stack([p[:,0],-p[:,2],p[:,1]],axis=-1)

def add(scene,name,mesh,color,translation=None):
 if translation is not None:mesh=mesh.copy();mesh.apply_translation(translation)
 mesh.visual=trimesh.visual.ColorVisuals(mesh=mesh,face_colors=np.asarray(rgba(color),dtype=np.uint8))
 scene.add_geometry(mesh,geom_name=name,node_name=name)
 return mesh

def ell(scene,name,color,pos,r,subdiv=2):
 m=trimesh.creation.icosphere(subdivisions=subdiv,radius=1)
 m.vertices*=np.asarray(r)
 m.apply_translation(pos)
 return add(scene,name,m,color)

def rod(scene,name,color,start,end,r=.008,r2=None,sections=12):
 a=np.asarray(start,float);b=np.asarray(end,float)
 v=b-a; L=float(np.linalg.norm(v))
 if L<1e-8:return
 mesh=trimesh.creation.cone(radius=r,height=L,sections=sections) if r2==0 else trimesh.creation.cylinder(radius=r,height=L,sections=sections)
 mesh.apply_transform(trimesh.geometry.align_vectors([0,0,1],v/L));mesh.apply_translation((a+b)*0.5)
 return add(scene,name,mesh,color)

def multi_rod(scene,name,color,points,r=.005,sections=10):
 for j in range(len(points)-1):rod(scene,f'{name}_{j:02}',color,points[j],points[j+1],r=r,sections=sections)

def ring_points(center,rx,rz,y,n=18,t0=0,t1=2*math.pi):
 return [(center[0]+rx*math.cos(a),y,center[2]+rz*math.sin(a)) for a in np.linspace(t0,t1,n)]

def face_sampler(body_vertices,face_indices):
 # approximate frontal surface y on triangle at a given x,z, using barycentric
 # coordinates projected into x,z, limited to face above neckline.
 v=body_vertices;tri=v[face_indices]; tri=tri[(tri[:,:,2].max(axis=1)>1.41) & (np.any(tri[:,:,1]<0.15,axis=1))]
 bb=np.column_stack((tri[:,:,0].min(axis=1),tri[:,:,0].max(axis=1),tri[:,:,2].min(axis=1),tri[:,:,2].max(axis=1)))
 def sample(x,z):
  ids=np.where((bb[:,0]<=x)&(bb[:,1]>=x)&(bb[:,2]<=z)&(bb[:,3]>=z))[0]
  ys=[]
  for idx in ids:
   t=tri[idx]; a,b,c=t
   d=(b[2]-c[2])*(a[0]-c[0])+(c[0]-b[0])*(a[2]-c[2])
   if abs(d)<1e-12:continue
   w1=((b[2]-c[2])*(x-c[0])+(c[0]-b[0])*(z-c[2]))/d
   w2=((c[2]-a[2])*(x-c[0])+(a[0]-c[0])*(z-c[2]))/d
   w3=1-w1-w2
   if min(w1,w2,w3)>=-1e-5: ys.append(float(w1*a[1]+w2*b[1]+w3*c[1]))
  if ys:return min(ys)-.0024
  # Nearest visible head point otherwise (avoid crashing at extreme eye corners)
  near=v[(v[:,2]>1.4)&(abs(v[:,0]-x)<.02)&(abs(v[:,2]-z)<.02)]
  return float(near[:,1].min()-.003) if len(near) else -.100
 return sample

def patch(scene,name,col,surface,xc,zc,rx,rz,twist=0,side='full',segments=22):
 # Fan triangulation of a curved painted-decal patch: real mesh surface contact,
 # negligible depth, so it can be recoloured later for facial animation.
 theta=np.linspace(0,2*math.pi,segments,endpoint=False)
 verts=[]
 for t in theta:
  dx=rx*math.cos(t); dz=rz*math.sin(t)+twist*dx
  X=xc+dx;Z=zc+dz
  verts.append([X,surface(X,Z),Z])
 verts.append([xc,surface(xc,zc)-.0006,zc]);center=len(verts)-1
 faces=[(center,j,(j+1)%segments) for j in range(segments)]
 # decal surface normals are front-facing (-Y) in our convention
 m=trimesh.Trimesh(vertices=verts,faces=faces,process=False)
 add(scene,name,m,col)
 return m

def create_char(body,faces,profile,outdir):
 scene=trimesh.Scene()
 # All coordinates in metres; body is from actual HM08 skin topology.
 # Individual triangles colour zones; separate transparent overlays not required.
 tri=body[faces]; cent=tri.mean(axis=1)
 mats=np.empty(len(faces),dtype='<U15');mats[:]='cargo'
 mats[cent[:,2]>=.96]='jacket'; mats[cent[:,2]<.24]='boots'
 mats[(cent[:,2]>1.43)]='skin'
 # Forearm and hand: restrict to outside torso to avoid colour bleeding onto chest.
 ext=np.abs(cent[:,0]);z=cent[:,2]
 mats[((ext>.295)&(z<1.18)&(z>.78))]='skin'
 mats[((ext>.295)&(z>=1.18)&(z<1.43))]='jacket2'
 for name in ['skin','cargo','jacket','jacket2','boots']:
  idx=np.where(mats==name)[0]
  if not len(idx):continue
  vertids=np.unique(faces[idx]);imap=np.full(len(body),-1,dtype=np.int64);imap[vertids]=np.arange(len(vertids))
  m=trimesh.Trimesh(vertices=body[vertids],faces=imap[faces[idx]],process=False)
  add(scene,'hm08_'+name,m,name)
 # Facial decals on curved real mesh; preserve expressive anime eye shapes.
 sample=face_sampler(body,faces)
 for s in (-1,1):
  x=s*.042;zz=1.557
  patch(scene,f'eye_lash_{s}','eyeliner',sample,x,zz,.039,.015,twist=.040*s)
  patch(scene,f'eye_white_{s}','eye_white',sample,x,zz,.032,.011,twist=.033*s)
  patch(scene,f'iris_{s}','iris',sample,x+s*.003,zz-.001,.013,.013)
  patch(scene,f'pupil_{s}','pupil',sample,x+s*.003,zz-.001,.006,.009)
  # modest painted upper eyelid and brows, no detached rods
  for k in range(5):
   t=k/4;xk=s*(.015+.056*t);zk=1.593+.008*math.sin(t*math.pi)
   ell(scene,f'eyebrow_{s}_{k}','brows',(xk,sample(xk,zk)-.001,zk),(.0052,.0028,.0029),1)
  for k in range(5):
   xk=s*(.043+.013*(k%3));zk=1.520+.010*(k//3)
   ell(scene,f'freckle_{s}_{k}','skinshadow',(xk,sample(xk,zk)-.001,zk),(.0018,.0012,.0017),1)
 # restrained one-sided raised mouth
 for k in range(19):
  x=-.036+(.073*k/18)
  z=1.494 + .005*(1-k/18) - .007*math.sin(math.pi*k/18)
  ell(scene,f'mouth_{k}','lip',(x,sample(x,z)-.001,z),(.0042,.002,.0018),1)
 # Ponytail anchored behind head; headband snug on scalp.
 ell(scene,'hair_cap','hair',(0,.043,1.655),(.111,.115,.095),3)
 ell(scene,'auburn_bun','hair',(-.02,.112,1.730),(.102,.10,.079),3)
 ell(scene,'bun_highlight','hairlight',(-.045,.107,1.750),(.071,.062,.058),2)
 for j in range(14):
  theta=(j*.71)
  px=-.115-.035*(j%3)/3;py=.17+.035*math.sin(theta)
  p1=(px,py,1.74);p2=(px-.060,py+.025,1.685);p3=(px-.091,py+.055,1.59-.025*(j%3))
  multi_rod(scene,f'ponytail_{j}','hairlight' if j%5==0 else 'hair',[p1,p2,p3],r=.012)
 for s in (-1,1):
  pts=[(s*.092,-.054,1.703),(s*.108,-.089,1.654),(s*.103,-.090,1.620)]
  multi_rod(scene,f'loose_side_lock_{s}','hair',pts,r=.013)
  ell(scene,f'earring_{s}','metal',(s*.096,.016,1.536),(.020,.008,.022),2)
 # gently arched white floral Alice band, follows hair silhouette rather than floating
 hpts=[(.105*math.cos(t),-.061-.005*math.sin(t),1.688+.028*math.sin(t)) for t in np.linspace(0,math.pi,24)]
 multi_rod(scene,'headband','headband',hpts,r=.0052)
 for i,t in enumerate(np.linspace(.12,math.pi-.12,11)):
  x=.105*math.cos(t);z=1.690+.028*math.sin(t);y=-.067-.004*math.sin(t)
  for p in range(5):
   a=p*math.tau/5
   ell(scene,f'daisy_{i}_{p}','flower',(x+.0052*math.cos(a),y-.002,z+.0052*math.sin(a)),(.0049,.002,.004),1)
  ell(scene,f'daisy_center_{i}','flower_center',(x,y-.005,z),(.0028,.002,.0028),1)
 # outfit: softer volume, thin tactical layers over anatomical base.
 ell(scene,'vest_main','vest',(0,-.103,1.185),(.180,.087,.200),3)
 ell(scene,'vest_waist','vest_dark',(0,-.110,1.030),(.173,.077,.082),2)
 for s in [-1,1]:
  multi_rod(scene,f'shoulder_strap_{s}','olive',[(s*.091,-.05,1.39),(s*.147,-.137,1.30),(s*.132,-.19,1.13)],r=.014)
  ell(scene,f'hip_utility_pouch_{s}','olive',(s*.187,-.075,1.0),(.062,.052,.068),2)
  ell(scene,f'thigh_pocket_{s}','cargolight',(s*.192,-.045,.78),(.061,.042,.10),2)
  for z in [.52,.56]:
   ell(scene,f'knee_pad_{s}_{z}','armor',(s*.126,-.105,z),(.076,.029,.057),2)
  # boot at toes (feet +Z), covered by original body colour too
  ell(scene,f'boot_toe_{s}','boots',(s*.125,-.10,.065),(.082,.119,.05),2)
  for j in range(3):
   rod(scene,f'bootlace_{s}_{j}','tan',(s*.13-.020,-.171,.105+j*.027),(s*.13+.020,-.175,.103+j*.027),.002)
 for i,x in enumerate([-.129,-.043,.043,.129]):
  ell(scene,f'front_pouch_{i}','olive',(x,-.191,1.165),(.038,.025,.073),2)
  ell(scene,f'pouch_flap_{i}','tan',(x,-.213,1.225),(.034,.007,.011),2)
 rod(scene,'waist_belt','belt',(-.17,-.142,1.02),(.17,-.142,1.02),.011)
 ell(scene,'radio','radio',(.19,-.166,1.35),(.024,.026,.061),1)
 rod(scene,'radio_antenna','radio',(.20,-.160,1.397),(.22,-.155,1.482),.005)
 # scarf wraps the base of the neck in a softer organic contour
 ell(scene,'scarf_collar','scarf',(0,-.077,1.405),(.118,.078,.068),3)
 ell(scene,'scarf_drape','scarf',(0,-.172,1.345),(.154,.018,.085),2)
 for i,x in enumerate(np.linspace(-.125,.125,9)):
  multi_rod(scene,f'scarf_pattern_{i}','scarf_ink',[(x,-.194,1.378),(x+.013,-.195,1.353),(x-.003,-.197,1.326)],r=.0033)
 # Left shoulder heraldic zigzag
 for s in [-1]:
  multi_rod(scene,f'c_patch_{s}','patch',[(s*.255,-.035,1.30),(s*.26,-.046,1.314),(s*.267,-.041,1.307),(s*.271,-.043,1.317)],r=.0035)
 # Export one GLB, all materials original/skin using vertex colors.
 outdir.mkdir(parents=True,exist_ok=True)
 glb=outdir/'C_anatomical_MakeHuman_trial.glb';scene.export(glb)
 return scene,glb

def vtk_render(scene,outdir):
 renderer=vtk.vtkRenderer();renderer.SetBackground(.055,.055,.074);renderer.SetBackground2(.16,.14,.16);renderer.GradientBackgroundOn()
 for name,m in scene.geometry.items():
  if not isinstance(m,trimesh.Trimesh) or len(m.faces)==0:continue
  # trimesh face visual into VTK per-cell colors, preserving material variation.
  poly=vtk.vtkPolyData();pts=vtk.vtkPoints();pts.SetData(numpy_to_vtk(m.vertices.astype(np.float32),deep=True));poly.SetPoints(pts)
  cells=vtk.vtkCellArray()
  for face in m.faces:
   c=vtk.vtkTriangle();c.GetPointIds().SetId(0,int(face[0]));c.GetPointIds().SetId(1,int(face[1]));c.GetPointIds().SetId(2,int(face[2]));cells.InsertNextCell(c)
  poly.SetPolys(cells)
  fc=m.visual.face_colors.astype(np.uint8)
  arr=numpy_to_vtk(fc[:,:3].copy(),deep=True,array_type=vtk.VTK_UNSIGNED_CHAR);arr.SetName('RGB');arr.SetNumberOfComponents(3)
  poly.GetCellData().SetScalars(arr)
  mapper=vtk.vtkPolyDataMapper();mapper.SetInputData(poly);mapper.SetScalarModeToUseCellData();mapper.SetColorModeToDirectScalars()
  actor=vtk.vtkActor();actor.SetMapper(mapper);actor.GetProperty().SetInterpolationToPhong();actor.GetProperty().SetAmbient(.25);actor.GetProperty().SetDiffuse(.75)
  renderer.AddActor(actor)
 for pos,lum in [((-3,-5,6),1.1),((3,3,5),.75)]:
  l=vtk.vtkLight();l.SetLightTypeToSceneLight();l.SetPosition(*pos);l.SetFocalPoint(0,0,1);l.SetIntensity(lum);renderer.AddLight(l)
 win=vtk.vtkRenderWindow();win.SetOffScreenRendering(True);win.AddRenderer(renderer);win.SetMultiSamples(4)
 win.SetSize(720,960)
 paths=[]
 for name,az in [('front',0),('threequarter',-38),('side',90),('back',180)]:
  cam=renderer.GetActiveCamera();a=math.radians(az);dist=4.2
  cam.SetPosition(dist*math.sin(a),-dist*math.cos(a),1.0+.26)
  cam.SetFocalPoint(0,0,.94);cam.SetViewUp(0,0,1);cam.ParallelProjectionOn();cam.SetParallelScale(1.05)
  renderer.ResetCameraClippingRange();win.Render()
  w=vtk.vtkWindowToImageFilter();w.SetInput(win);w.SetInputBufferTypeToRGB();w.ReadFrontBufferOff();w.Update()
  p=outdir/f'C_anatomical_{name}.png';wr=vtk.vtkPNGWriter();wr.SetFileName(str(p));wr.SetInputConnection(w.GetOutputPort());wr.Write();paths.append(p)
 ims=[Image.open(p).convert('RGB') for p in paths]
 board=Image.new('RGB',(1440,1920),(21,21,28))
 for i,im in enumerate(ims):board.paste(im,((i%2)*720,(i//2)*960))
 board.save(outdir/'C_anatomical_four_views.png')
 return paths

def main():
 ap=argparse.ArgumentParser();ap.add_argument('--out',default='dist');ap.add_argument('--cache',default='.cache/makehuman');ap.add_argument('--debug-dummy',action='store_true');args=ap.parse_args()
 out=pathlib.Path(args.out).absolute();cache=pathlib.Path(args.cache).absolute();cache.mkdir(parents=True,exist_ok=True)
 if args.debug_dummy:
  # This mode validates exports/rendering without pretending it is MPFB geometry.
  b=trimesh.creation.icosphere(subdivisions=4);b.vertices*=np.array([.28,.13,.81]);b.vertices[:,2]+=.82
  body=b.vertices;faces=b.faces
 else:
  obj=download_cached('3dobjs/base.obj',cache);v,faces=load_mh_obj(obj)
  hashes={'base_obj_sha256':hashlib.sha256(obj.read_bytes()).hexdigest()}
  for path,w in TARGETS:
   f=download_cached(path,cache);count=apply_mh_target(v,f,w);hashes[path]={'vertices_modified':count,'sha256':hashlib.sha256(f.read_bytes()).hexdigest(),'weight':w}
  body=world(v[:13380])
  # MakeHuman base is decimeters. Center and place feet on floor.
  body*=.1
  current_height=float(body[:,2].max()-body[:,2].min());body*=HEIGHT/current_height
  body[:,2]-=body[:,2].min()
  print('HM08 REAL MESH',len(body),len(faces),'HEIGHT',current_height,'BBOX',body.min(0).round(3),body.max(0).round(3),flush=True)
 scene,model=create_char(body,faces,{},out)
 vtk_render(scene,out)
 summary={'status':'independent anatomical base trial, not a literal run of MPFB/Blender','source':'MakeHuman HM08 CC0 base.obj + macro targets','source_revision':COMMIT,'mesh_height_m_before_hair':HEIGHT,'morph_targets':TARGETS,'model':str(model.name),'triangles':int(sum(len(m.faces) for m in scene.geometry.values())),'model_groups':len(scene.geometry),'bbox_m':scene.bounds.tolist(),'measurement_reference':'https://www.roymech.co.uk/Useful_Tables/Ergonomics/Human_sizes.html','note':'Character height 1.68 m is a design assumption, not established canon. Body uses official base topology; costume, hair, face details are newly procedural.'}
 if not args.debug_dummy:summary['source_hashes']=hashes
 (out/'measurements_and_provenance.json').write_text(json.dumps(summary,indent=2))
 print(json.dumps({k:v for k,v in summary.items() if k!='source_hashes'},indent=2),flush=True)

if __name__=='__main__':main()