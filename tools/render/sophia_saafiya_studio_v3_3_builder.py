#!/usr/bin/env python3
"""Hero Shooter / Sophia (Saafiya), revision 3.3.

Builds on revision 3.2 geometry; changes are restricted to (1) real lowered
corset neckline/upper torso and (2) UV-mapped painted anime face + optional
expression textures. No generated artwork or external asset downloaded.

World axes +Z up, +Y face/front, +X anatomical left; 1.72 m GLB unit scale.
Requires VTK, numpy, trimesh, Pillow. V3.2 script packaged alongside this file.
Run: xvfb-run -a python sophia_saafiya_studio_v3_3_builder.py
"""
import importlib.util, os, sys, math, json, shutil
from pathlib import Path
from collections import defaultdict
import numpy as np
import vtk
import trimesh
from PIL import Image,ImageDraw,ImageFilter, ImageFont
from vtk.util.numpy_support import vtk_to_numpy

HERE=Path(__file__).resolve().parent
OLD=Path('/mnt/data/sophia_saafiya_studio_v3_2/sophia_saafiya_v3_2_studio.py')
if not OLD.exists(): OLD=HERE/'sophia_saafiya_v3_2_studio.py'
spec=importlib.util.spec_from_file_location('sophia_v32',OLD)
base=importlib.util.module_from_spec(spec);sys.modules[spec.name]=base;spec.loader.exec_module(base)
OUT=HERE/'sophia_saafiya_studio_v3_3';OUT.mkdir(parents=True,exist_ok=True)
SIZE=2048
SKIN=(185,116,85); INK=(28,15,26,255); LIP=(30,8,25,255)

def face_xy(x,z):
    """Convert model face local front-surface x,z to equirectangular UV pixels."""
    zn=(z-2.145)/.302
    theta=math.acos(max(-.999,min(.999,zn)))
    radial=.236*math.sin(theta)
    ratio=max(-1,min(1,x/max(.0001,radial)))
    a=math.acos(ratio)                 # front hemisphere, +Y
    return (a/math.tau*SIZE,theta/math.pi*SIZE)

def draw_poly(d,verts,fill,outline=None,width=1):
    p=[face_xy(x,z) for x,z in verts]
    d.polygon(p,fill=fill)
    if outline:d.line(p+[p[0]],fill=outline,width=width,joint='curve')

def draw_line(d,pts,fill,width=4):
    d.line([face_xy(x,z) for x,z in pts],fill=fill,width=width,joint='curve')

def fill_ellipse_as_poly(d,x,z,rx,rz,fill):
    draw_poly(d,[(x+rx*math.cos(k*math.tau/60),z+rz*math.sin(k*math.tau/60)) for k in range(60)],fill)

def make_painted_face(mood='neutral'):
    """A deterministic painted anime face; no AI/image synthesis.

    All makeup is mapped to UV coordinates of one connected sculpted face mesh.
    Four expression images share identical UVs for future texture swapping.
    """
    image=Image.new('RGB',(SIZE,SIZE),SKIN)
    d=ImageDraw.Draw(image,'RGBA')
    # Face is a smooth skin-colored UV; subtle brow and cheek/eye gradients.
    for s in (-1,1):
        # faint high cheek tint
        for k in range(8,0,-1):
            a=int(5+3*k)
            fill_ellipse_as_poly(d,s*.132,2.126,.040+k*.003,.028+k*.001,(174,70,73,a))
        # smokey eye makeup; softly shaded contour around upper lid
        upper=2.230
        draw_poly(d,[(s*.033,2.246),(s*.066,2.260),(s*.127,2.256),(s*.161,2.238),(s*.130,2.222),(s*.061,2.222)],(46,18,44,78))
        if mood=='blink':
            draw_line(d,[(s*.044,2.216),(s*.077,2.220),(s*.125,2.219),(s*.150,2.227)],INK,13)
            draw_line(d,[(s*.062,2.208),(s*.098,2.208),(s*.130,2.211)],(75,34,48,170),5)
        else:
            # almond sclera, inset iris and pin-shaped pupils; fully painted
            contour=[(s*.045,2.214),(s*.067,2.231),(s*.096,2.235),(s*.124,2.226),(s*.151,2.214),(s*.125,2.202),(s*.091,2.199),(s*.064,2.205)]
            draw_poly(d,contour,(226,197,172,255),INK,7)
            gaze_offset=.010 if mood=='smirk' else 0
            fill_ellipse_as_poly(d,s*.099+gaze_offset,2.216,.021,.020,(124,76,52,255))
            fill_ellipse_as_poly(d,s*.099+gaze_offset,2.215,.012,.016,(24,17,27,255))
            fill_ellipse_as_poly(d,s*.107+gaze_offset,2.226,.006,.005,(255,251,237,255))
            draw_line(d,[(s*.049,2.220),(s*.077,2.234),(s*.113,2.234),(s*.144,2.225),(s*.171,2.245)],INK,11)
            draw_line(d,[(s*.049,2.210),(s*.083,2.200),(s*.121,2.200)],(56,26,40,180),4)
            for jj in range(3):
                draw_line(d,[(s*(.135+jj*.010),2.225+jj*.002),(s*(.147+jj*.010),2.241+jj*.002)],INK,4)
        # eyebrow silhouette curves, raised for smirk, angled for anger
        extra=(.011 if mood=='smirk' and s==1 else 0)
        angry=-(.019 if mood=='angry' else 0)
        draw_poly(d,[(s*.047,2.285+extra),(s*.082,2.294+extra+angry),
            (s*.126,2.290+extra-angry),(s*.155,2.282+extra),
            (s*.131,2.272+extra),(s*.086,2.278+extra)],(36,16,29,255))
    # Subtle nose shading; actual nose bridge is physically present on head mesh.
    draw_line(d,[(-.007,2.140),(-.009,2.104),(-.028,2.087)],(116,59,45,100),5)
    draw_line(d,[(.015,2.101),(.030,2.091),(.012,2.080),(-.018,2.084)],(90,38,35,115),4)
    for x,z in [(-.042,2.081),(.045,2.081)]:fill_ellipse_as_poly(d,x,z,.008,.004,(105,52,42,90))
    # Black lipstick: combined filled upper + lower lip silhouettes, not extruded beads.
    xs=[-.111,-.089,-.057,-.028,0,.030,.058,.084,.109]
    top=[2.024,2.028,2.034,2.032,2.029,2.035,2.034,2.027,2.025]
    bot=[2.021,2.013,2.008,2.003,2.000,2.003,2.008,2.013,2.022]
    if mood=='smirk':
        top=[z+.009*(x+.111)/.222 for x,z in zip(xs,top)]
        bot=[z+.009*(x+.111)/.222 for x,z in zip(xs,bot)]
    if mood=='angry':
        top=[z-.002 for z in top]; bot=[z-.003 for z in bot]
    draw_poly(d,list(zip(xs,top))+list(zip(reversed(xs),reversed(bot))),LIP)
    draw_line(d,[(-.083,2.018),(-.037,2.014),(.033,2.015),(.082,2.020)],(69,27,52,220),3)
    draw_line(d,[(-.054,2.008),(.004,2.005),(.051,2.010)],(125,67,99,110),3)
    # tiny signature beauty mole above her anatomical left lip (viewer-right)
    fill_ellipse_as_poly(d,.121,2.065,.006,.006,(39,20,21,255))
    # soft freckles on upper cheeks, understated
    for s in (-1,1):
        for j,(xx,zz) in enumerate([(.139,2.155),(.157,2.145),(.118,2.141),(.152,2.166)]):
            fill_ellipse_as_poly(d,s*xx,zz,.0025,.0025,(99,54,44,65))
    path=OUT/f'sophia_face_{mood}_uv_v3_3.png';image.save(path,optimize=True)
    return path

class Studio33(base.Studio):
 def __init__(self):
    self.face_texture=make_painted_face('neutral')
    super().__init__()
 def create_face(self):
    func=super().create_face()
    matches=[(idx,p) for idx,p in enumerate(self.parts) if p[0]=='anatomy/continuous_face_and_nose']
    assert len(matches)==1
    idx,(name,mat,poly,actor)=matches[0]
    coords=vtk.vtkFloatArray();coords.SetNumberOfComponents(2);coords.SetName('TCoords')
    n=poly.GetNumberOfPoints();assert n==49*84,(n,49*84)
    for i in range(49):
        for j in range(84):
            coords.InsertNextTuple2(j/84,1-i/48)
    poly.GetPointData().SetTCoords(coords)
    # VTK material must be white for the PNG texture to retain authored colours.
    actor.GetProperty().SetColor(1,1,1)
    tex=vtk.vtkTexture(); reader=vtk.vtkPNGReader();reader.SetFileName(str(self.face_texture))
    tex.SetInputConnection(reader.GetOutputPort());tex.InterpolateOn();tex.RepeatOn()
    actor.SetTexture(tex)
    return func
 def face_details(self):
    # The face itself, including lips, brows, eyeliner, pupils and beauty spot,
    # is painted into one UV skin texture. Keep anatomical ears and real jewelry.
    for sign in (-1,1):
        x=sign*.232
        self.ell('anatomy/ear',(x,.006,2.098),(.044,.055,.078),'skin',res=24)
        a=np.linspace(0,math.tau,64)
        self.tube('jewelry/silver_hoop',[(x+sign*.025+.063*math.cos(t),.027,2.030+.067*math.sin(t)) for t in a],.007,'silver_hi',metal=.9,closed=True)
 def oval_loft(self,name,rings,mat,section=48,pinch=0,metal=0):
    if name=='costume/tight_corset':
        # Physical corset terminates at sternum below the exposed neckline.
        rings=[(1.18,.242,.195,-.02),(1.30,.211,.155,-.03),(1.48,.222,.180,-.025),(1.54,.234,.193,-.025),(1.605,.257,.205,-.028)]
    elif name=='costume/lace_upper':
        # Real upper bust/chest skin, not simply an image painted over a dress.
        base.Studio.oval_loft(self,'anatomy/exposed_decolletage',
          [(1.565,.255,.203,-.025),(1.63,.264,.212,-.02),(1.72,.266,.205,-.025),(1.81,.235,.181,-.025),(1.875,.191,.157,-.035)],
          'skin',section=52)
        # Cover the back with dark lace; leave the front physically open.
        rows=[(1.605,.264,.209,-.028),(1.73,.264,.204,-.025),(1.81,.234,.180,-.025),(1.875,.190,.155,-.035)]
        vv=[];ff=[];segs=44
        for z,rx,ry,cy in rows:
            for k in range(segs+1):
                a=math.pi + math.pi*k/segs
                vv.append((rx*math.cos(a),cy+ry*math.sin(a)-.003,z))
        for k in range(len(rows)-1):
            for j in range(segs):
                a=k*(segs+1)+j;b=a+1;c=(k+1)*(segs+1)+j;d=c+1
                ff.extend([(a,b,c),(b,d,c)])
        return self.grid_surface('costume/lace_back_panel',vv,ff,'lace',metal=.02)
    return super().oval_loft(name,rings,mat,section,pinch,metal)
 def ell(self,name,pos,rad,mat,res=28,metal=0):
    if name=='costume/bust_seam':
        # Corset cups support the silhouette but leave a distinctly low-cut V.
        pos=(pos[0],.166,1.622);rad=(.113,.081,.097)
    return super().ell(name,pos,rad,mat,res,metal)
 def tube(self,name,points,r,mat,edges=9,metal=0,closed=False):
    if name=='costume/neckline':
        # Exposed sternum in the center. A genuine 3D sweetheart/deep-V opening.
        s=1 if points[0][0]>0 else -1
        points=[(s*.228,.125,1.772),(s*.182,.194,1.702),(s*.117,.246,1.637),
                (s*.064,.249,1.587),(0,.226,1.575)]
        r=.010
    return super().tube(name,points,r,mat,edges,metal,closed)


def export_glb(m):
    scene=trimesh.Scene();parts=defaultdict(list);counts={}
    for name,mat,poly,actor in m.parts:
        tri=vtk.vtkTriangleFilter();tri.SetInputData(poly);tri.Update();p=tri.GetOutput()
        if p.GetNumberOfPoints()<3 or p.GetNumberOfCells()<1:continue
        v=vtk_to_numpy(p.GetPoints().GetData()).reshape((-1,3)).astype(np.float32)
        f=vtk_to_numpy(p.GetPolys().GetConnectivityArray()).reshape(-1,3).astype(np.int64)
        uv=None
        if name=='anatomy/continuous_face_and_nose':
            tc=p.GetPointData().GetTCoords()
            if tc is None:raise RuntimeError('Lost 3D face UVs during export')
            uv=vtk_to_numpy(tc).reshape(-1,2).astype(np.float32)
            if len(uv)!=len(v):raise RuntimeError('Mismatch between face vertices and UVs')
        prefix=name.split('/')[0]
        if name=='anatomy/continuous_face_and_nose':prefix='face'
        group=f'{prefix}_{mat}'
        # preserve face as separate material, do not merge face with body skin
        parts[group].append((v,f,mat,uv))
    all_v=np.vstack([v for sections in parts.values() for v,_,_,_ in sections]);floor=all_v[:,2].min();high=all_v[:,2].max();scale=1.72/(high-floor)
    for group,sections in parts.items():
        mat=sections[0][2];out_v=[];out_f=[];out_uv=[];offset=0
        for v,f,_,uv in sections:
            out_v.append(v);out_f.append(f+offset);offset+=len(v)
            if uv is not None:out_uv.append(uv)
        v=np.vstack(out_v);f=np.vstack(out_f);v*=scale;v[:,2]-=floor*scale
        mesh=trimesh.Trimesh(vertices=v,faces=f,process=False,validate=False)
        if group=='face_skin':
            material=trimesh.visual.material.PBRMaterial(name='Painted_anime_face_neutral',baseColorTexture=Image.open(m.face_texture).convert('RGBA'),baseColorFactor=(255,255,255,255),roughnessFactor=.94,metallicFactor=0)
            mesh.visual=trimesh.visual.TextureVisuals(uv=np.vstack(out_uv),material=material)
        else:
            material=trimesh.visual.material.PBRMaterial(name=mat,baseColorFactor=[*list((np.array(base.col(mat))*255).astype(int)),255],roughnessFactor=.6,metallicFactor=.8 if mat.startswith('silver') else .05)
            mesh.visual=trimesh.visual.TextureVisuals(material=material)
        scene.add_geometry(mesh,node_name=group,geom_name=group)
        counts[group]={'triangles':int(len(f)),'vertices':int(len(v)),'has_uv':len(out_uv)>0}
    target=OUT/'sophia_saafiya_v3_3_painted_face_unrigged.glb'
    target.write_bytes(scene.export(file_type='glb'))
    # Export integrity: check imported material and UV are intact
    imported=trimesh.load(target,force='scene',process=False)
    textured=[(n,g) for n,g in imported.geometry.items() if isinstance(g.visual,trimesh.visual.TextureVisuals) and getattr(g.visual.material,'baseColorTexture',None) is not None]
    if not textured:raise RuntimeError('Exported GLB lost its painted head texture')
    head=textured[0][1]
    if head.visual.uv is None or len(head.visual.uv)!=len(head.vertices):raise RuntimeError('Exported GLB lacks usable face UVs')
    info={'revision':'v3.3','character':'Sophia / Saafiya (identity follows prior accepted v3.2 naming)',
          'baseline':'sophia_saafiya_3d_v3_2_unrigged.glb','unit':'metres','height_m':float(imported.bounds[1,2]-imported.bounds[0,2]),
          'mesh_groups':len(imported.geometry),'triangles':sum(len(g.faces) for g in imported.geometry.values()),
          'UV_textured_head_meshes':len(textured),'texture_resolution':[SIZE,SIZE],
          'mesh_materials':counts,'status':'static unrigged / not yet game-ready',
          'changes':['geometrically low-cut front neckline, exposed upper bust, back lace panel','UV-mapped painted anime face on original integrated nose/head mesh','four interchangeable facial expression texture PNGs'],
          'rendering':'Python + VTK and Pillow; exported as trimesh GLB; no image-generator',
          'limitations':['Face texture is a hand-coded planarized UV layout; not a blendshape-based facial rig.','Clothing anatomy remains a partially intersecting procedural prototype.','UV seam is placed on lateral head surface; possible minor aliasing at low sprite resolutions.','Silhouette and face require user visual approval before rigging.']}
    (OUT/'sophia_saafiya_v3_3_audit.json').write_text(json.dumps(info,indent=2))
    return target,info


def pretty_font(size,bold=False):return base.font(size,bold)

def make_artifacts(m):
    views=[]
    for label,yaw in base.VIEWS:
        im=base.render(m,yaw,10,(460,800),transparent=True,scale=1.55)
        fn='sophia_'+label.lower().replace('/','_').replace(' ','_')+'_v3_3.png'
        im.save(OUT/fn)
        views.append(base.backdrop(im))
    W,H=460,800
    sheet=Image.new('RGB',(W*3,(H+56)*2+95),'#eee9e7');draw=ImageDraw.Draw(sheet)
    draw.text((22,15),'SOPHIA / SAAFIYA | HERO SHOOTER',fill='#271a27',font=pretty_font(29,True))
    draw.text((22,56),'V3.3 · PAINTED ANIME FACE · LOW-CUT CORSET · PROCEDURAL VTK · UNRIGGED',fill='#635762',font=pretty_font(14))
    for i,((lab,_),view) in enumerate(zip(base.VIEWS,views)):
        x=(i%3)*W;y=95+(i//3)*(H+56)
        sheet.paste(view,(x,y));draw.text((x+14,y+H+10),lab,font=pretty_font(20,True),fill='#261825')
        draw.line([(x+12,y+H+45),(x+W-12,y+H+45)],fill='#b7aab2',width=1)
    sheet.save(OUT/'sophia_saafiya_v3_3_turnaround.png')
    close=base.render(m,0,4,(780,900),closeup=True)
    base.backdrop(close,shadow=False).save(OUT/'sophia_saafiya_v3_3_face_closeup.png')
    hero=base.render(m,0,10,(720,1040),scale=1.5)
    base.backdrop(hero).save(OUT/'sophia_saafiya_v3_3_front.png')
    game=base.render(m,0,58,(640,800),scale=1.51)
    base.backdrop(game,shadow=False).save(OUT/'sophia_saafiya_v3_3_game_camera.png')
    # before/after comparisons. Source art remains untouched.
    original=Image.open('/mnt/data/sophia_saafiya_studio_v3_2/sophia_saafiya_v3_2_face_closeup.png').convert('RGB')
    revised=Image.open(OUT/'sophia_saafiya_v3_3_face_closeup.png').convert('RGB')
    old=original.resize((480,560),Image.Resampling.LANCZOS)
    new=revised.resize((480,560),Image.Resampling.LANCZOS)
    comp=Image.new('RGB',(960,635),'#efe9ea');d=ImageDraw.Draw(comp)
    d.text((22,15),'PAINTED FACE — COMPARISON',fill='#312332',font=pretty_font(27,True))
    comp.paste(old,(0,72));comp.paste(new,(480,72))
    d.text((24,585),'V3.2 raised geometry',fill='#4a3545',font=pretty_font(21,True))
    d.text((504,585),'V3.3 UV-painted expression',fill='#4a3545',font=pretty_font(21,True))
    comp.save(OUT/'sophia_saafiya_v3_3_face_comparison.png')
    return sheet

def main():
    for mood in ('smirk','angry','blink'):make_painted_face(mood)
    m=Studio33()
    glb,info=export_glb(m)
    make_artifacts(m)
    report='''# Sophia / Saafiya V3.3 — 3D Character Studio\n\nThis revision updates V3.2 without altering or replacing the approved design sheet.\n\n- Deeper physical sweetheart/V-neck opening on the front, real skin upper torso exposed, dark lace retained on back and sleeves.\n- A 2048² UV texture on the continuous original head mesh paints eyes, eyeliner, eyebrows, black lipstick, nose shading and beauty spot.\n- Bonus expressive textures (`smirk`, `angry`, `blink`) use the same UVs and can be swapped by a runtime material, but are NOT facial animation or blendshapes.\n- Neutral unarmed character, GLB 1.72 m, Z-up, +Y front; model currently not rigged.\n- Geometry is still stylised/prototype-quality and clothing/hair are separate pieces. No AI image generator involved.\n- To reproduce, run `sophia_saafiya_studio_v3_3_builder.py` next to the included `sophia_saafiya_v3_2_studio.py` script using Python, vtk, Pillow, numpy and trimesh under an offscreen X display (`xvfb-run`).\n'''
    (OUT/'README.md').write_text(report)
    shutil.copy2(OLD,OUT/'sophia_saafiya_v3_2_studio.py')
    shutil.copy2(__file__,OUT/Path(__file__).name)
    print(json.dumps({k:v for k,v in info.items() if k!='mesh_materials'},indent=2))
if __name__=='__main__':main()