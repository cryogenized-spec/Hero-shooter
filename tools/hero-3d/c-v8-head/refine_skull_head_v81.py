#!/usr/bin/env python3
"""C V8.1 — non-destructive skull contour refinement of UV-painted Hero C face.

No new geometry or textures: deforms only Existing_C_approved_face vertex positions.
UV, triangle topology, 1024px painted expression texture, other components preserved.
Meshes remain UNRIGGED; not a replacement for original V8 or gameplay.
"""
from __future__ import annotations
import argparse,hashlib,json,math
from pathlib import Path
import numpy as np
import trimesh
from PIL import Image, ImageDraw, ImageFont
import vtk
from vtk.util.numpy_support import numpy_to_vtk

FACE = 'Existing_C_approved_face'


def hash_bytes(b): return hashlib.sha256(b).hexdigest()


def gauss(v, mu, sigma):return np.exp(-.5*((v-mu)/sigma)**2)


def craniofacial_refine(vert, intensity=1.):
    """A gentle, symmetric facial contour deformation, units metres; retains UV."""
    v=np.asarray(vert,dtype=np.float64).copy()
    x,y,z=v.T
    # This head is an original 3D UV-ellipsoid; ~0.246m wide, 0.26m tall.
    # Sculpt a z-dependent brow, temporal depression, cheekbone and narrowing jaw.
    width_z = np.array([1.408,1.427,1.446,1.465,1.487,1.510,1.534,1.552,1.575,1.598,1.620,1.641,1.659,1.675])
    width_f = np.array([.93,.89,.90,.87,.88,.92,.991,.982,.910,.930,.975,1.010,1.027,1.020])
    radial = np.interp(z,width_z,width_f)
    # Avoid deforming central nasal region as much as silhouette.
    v[:,0]=x*(1+intensity*(radial-1))

    # Front of head (-Y) and posterior occiput (+Y) weights, smooth and bounded.
    front = np.clip((-y-.005)/.09,0,1)
    back = np.clip((y-.012)/.079,0,1)
    front = front*front*(3-2*front)
    back = back*back*(3-2*back)
    ax=np.abs(x)

    # Distinct rear cranial vault and occiput, rather than a uniform balloon.
    occiput = (.0115*gauss(z,1.618,.058)+.003*gauss(z,1.563,.056))*back
    # Gentle supraorbital and frontoparietal flattening.
    forehead = .0038*gauss(z,1.625,.039)*front
    # Bony malar arch: high cheekbone volume on each side of the face.
    cheekbone = -.0068*gauss(z,1.526,.018)*gauss(ax,.063,.025)*front
    # Nose's central projection; preserves painted nose (no separate capsule).
    bridge = -.0060*gauss(z,1.574,.028)*gauss(x,0,.013)*front
    nose_tip = -.0093*gauss(z,1.519,.014)*gauss(x,0,.010)*front
    # Delicate chin prominence within tapered jaw.
    chin = -.0058*gauss(z,1.445,.020)*gauss(x,0,.039)*front
    # Inward jaw tuck at the lower side profile, without shrinking the neck junction.
    jaw_tuck = +.0035*gauss(z,1.464,.024)*gauss(ax,.069,.031)*front
    v[:,1] = y + intensity*(occiput-forehead+cheekbone+bridge+nose_tip+chin+jaw_tuck)
    # Subtle flattening below cheekbone creates an anatomical jaw-to-cheek transition.
    # Keep z and all UVs unchanged to preserve expressive placement of eyes/mouth.
    return v


def full_hash_material(mesh):
    mat=getattr(mesh.visual,'material',None)
    img=getattr(mat,'baseColorTexture',None)
    if img is None:raise ValueError('Expected approved painted face texture')
    from io import BytesIO
    b=BytesIO();img.save(b,format='PNG')
    return hash_bytes(b.getvalue()), img.size


def export_revision(inp:Path,out:Path,strength=1.):
    scene=trimesh.load(inp,force='scene',process=False)
    if FACE not in scene.geometry: raise ValueError(f'Face mesh missing from {inp}')
    face=scene.geometry[FACE]
    old_v=face.vertices.copy();old_uv=np.asarray(face.visual.uv).copy();old_f=face.faces.copy()
    oldtex,size=full_hash_material(face)
    new_v=craniofacial_refine(old_v,strength)
    face.vertices=new_v
    out.parent.mkdir(parents=True,exist_ok=True)
    scene.export(out)
    reloaded=trimesh.load(out,force='scene',process=False)
    after=reloaded.geometry[FACE]
    newtex,newsize=full_hash_material(after)
    old_verts={k:m.vertices.copy() for k,m in trimesh.load(inp,force='scene',process=False).geometry.items()}
    untouched={k:float(np.max(np.abs(reloaded.geometry[k].vertices-old_verts[k]))) for k in old_verts if k!=FACE}
    displacement=np.linalg.norm(new_v-old_v,axis=1)
    checks={
        'source':str(inp),'output':str(out),'source_sha256':hash_bytes(inp.read_bytes()),
        'output_sha256':hash_bytes(out.read_bytes()),
        'face_mesh':FACE,'face_triangles':len(face.faces),
        'skin_texture_resolution':list(size),'painted_texture_sha256_before':oldtex,'painted_texture_sha256_after':newtex,
        'painted_texture_byte_exact':oldtex==newtex,'uv_coordinates_unchanged':bool(np.array_equal(old_uv,face.visual.uv) and np.allclose(old_uv,after.visual.uv,atol=1e-6)),
        'triangle_indices_unchanged':bool(np.array_equal(old_f,after.faces)),
        'max_head_vertex_displacement_mm':round(float(displacement.max()*1000),2),
        'mean_head_vertex_displacement_mm':round(float(displacement.mean()*1000),2),
        'max_other_mesh_vertex_error_mm':round(max(untouched.values(),default=0)*1000,5),
        'mesh_count':len(reloaded.geometry),'triangle_count':sum(len(x.faces) for x in reloaded.geometry.values()),
        'source_head_bounds_m':np.round(np.stack((old_v.min(axis=0),old_v.max(axis=0))),4).tolist(),
        'output_head_bounds_m':np.round(after.bounds,4).tolist(),
        'notes':['No rig or animation added.','Skull-shaped adjustment is still stylized; eyes/freckles/mouth are unchanged UV artwork.','Hair, earrings and scarf stay independent pre-existing meshes.','Original V8 remains unchanged.']
    }
    assert checks['painted_texture_byte_exact'] and checks['uv_coordinates_unchanged'] and checks['triangle_indices_unchanged']
    assert checks['max_other_mesh_vertex_error_mm']<0.01
    return checks


def vtk_actor(mesh, face_smoothing=False):
    poly=vtk.vtkPolyData();pts=vtk.vtkPoints()
    pts.SetData(numpy_to_vtk(np.ascontiguousarray(mesh.vertices,dtype=np.float32),deep=True));poly.SetPoints(pts)
    faces=np.asarray(mesh.faces,dtype=np.int64)
    cells=vtk.vtkCellArray();cells.SetCells(len(faces),numpy_to_vtk(np.ascontiguousarray(np.column_stack((np.full(len(faces),3),faces)).ravel()),deep=True,array_type=vtk.VTK_ID_TYPE));poly.SetPolys(cells)
    uv=getattr(mesh.visual,'uv',None)
    mat=getattr(mesh.visual,'material',None)
    im=(getattr(mat,'image',None) or getattr(mat,'baseColorTexture',None)) if mat is not None else None
    # In the approved painted face, smooth shading avoids low-poly facets on skin.
    if face_smoothing:
        norms=np.asarray(mesh.vertex_normals,dtype=np.float32)
        normalarr=numpy_to_vtk(np.ascontiguousarray(norms),deep=True)
        normalarr.SetNumberOfComponents(3);poly.GetPointData().SetNormals(normalarr)
    mapper=vtk.vtkPolyDataMapper();mapper.SetInputData(poly)
    actor=vtk.vtkActor();actor.SetMapper(mapper)
    actor.GetProperty().SetInterpolationToPhong();actor.GetProperty().SetAmbient(.44);actor.GetProperty().SetDiffuse(.67);actor.GetProperty().SetSpecular(.06);actor.GetProperty().SetSpecularPower(16)
    if im is not None and uv is not None:
        tc=numpy_to_vtk(np.ascontiguousarray(uv,dtype=np.float32),deep=True);tc.SetNumberOfComponents(2);poly.GetPointData().SetTCoords(tc)
        pix=np.asarray(im.convert('RGBA'),dtype=np.uint8);h,w=pix.shape[:2]
        img=vtk.vtkImageData();img.SetDimensions(w,h,1)
        raw=numpy_to_vtk(np.ascontiguousarray(np.flipud(pix).reshape(-1,4)),deep=True,array_type=vtk.VTK_UNSIGNED_CHAR)
        raw.SetNumberOfComponents(4);img.GetPointData().SetScalars(raw)
        texture=vtk.vtkTexture();texture.SetInputData(img);texture.InterpolateOn();texture.RepeatOff()
        mapper.ScalarVisibilityOff();actor.SetTexture(texture)
    elif mesh.visual.kind in ('vertex','face'):
        c=np.asarray(mesh.visual.vertex_colors if mesh.visual.kind=='vertex' else mesh.visual.face_colors,dtype=np.uint8)
        vtkc=numpy_to_vtk(np.ascontiguousarray(c[:,:3]),deep=True,array_type=vtk.VTK_UNSIGNED_CHAR);vtkc.SetNumberOfComponents(3)
        if mesh.visual.kind=='vertex':poly.GetPointData().SetScalars(vtkc);mapper.SetScalarModeToUsePointData()
        else:poly.GetCellData().SetScalars(vtkc);mapper.SetScalarModeToUseCellData()
        mapper.SetColorModeToDirectScalars();mapper.ScalarVisibilityOn()
    else:
        col=np.asarray(getattr(mat,'baseColorFactor',[.8,.72,.6,1]) if mat is not None else [.8,.72,.6,1.],dtype=float)
        if col.max()>1:col=col/255
        actor.GetProperty().SetColor(*col[:3]);mapper.ScalarVisibilityOff()
    return actor


def render_portrait(scene,path,ang,framing='head',full=False):
    ren=vtk.vtkRenderer();ren.SetBackground(.042,.042,.056);ren.SetBackground2(.16,.135,.16);ren.GradientBackgroundOn()
    for name,mesh in scene.geometry.items():ren.AddActor(vtk_actor(mesh,face_smoothing=(FACE==name)))
    for pos,power in [((-3.8,-4.5,5.5),1.25),((3.0,1.8,3.7),.65)]:
        light=vtk.vtkLight();light.SetLightTypeToSceneLight();light.SetPosition(*pos);light.SetFocalPoint(0,0,1.55);light.SetIntensity(power);ren.AddLight(light)
    win=vtk.vtkRenderWindow();win.SetOffScreenRendering(1);win.AddRenderer(ren)
    win.SetSize(600,650 if framing=='head' else 850);win.SetMultiSamples(4)
    camera=ren.GetActiveCamera();r=math.radians(ang);dist=3.0
    target_z=1.575 if framing=='head' else .95
    camera.SetFocalPoint(0,0,target_z)
    camera.SetPosition(dist*math.sin(r),-dist*math.cos(r),target_z+.04)
    camera.SetViewUp(0,0,1);camera.ParallelProjectionOn();camera.SetParallelScale(.28 if framing=='head' else 1.05)
    ren.ResetCameraClippingRange();win.Render()
    f=vtk.vtkWindowToImageFilter();f.SetInput(win);f.SetInputBufferTypeToRGB();f.ReadFrontBufferOff();f.Update()
    p=vtk.vtkPNGWriter();p.SetFileName(str(path));p.SetInputConnection(f.GetOutputPort());p.Write()
    win.Finalize()


def make_board(out_dir,sources,title_labels):
    # Layout 2 rows: V8 original / V8.1 sculpt; 3 views each.
    canvas=Image.new('RGB',(1800,1395),(22,20,29));d=ImageDraw.Draw(canvas)
    try:ft=ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf',24)
    except Exception:ft=ImageFont.load_default()
    for row,(label,views) in enumerate(sources):
        for col,(view,png) in enumerate(views):
            im=Image.open(png).convert('RGB');x=col*600;y=row*698
            canvas.paste(im,(x,y+35));d.text((x+15,y+4),f'{label}  ·  {view}',font=ft,fill=(255,242,232))
    dst=out_dir/'C_V8_vs_V8_1_skull_closeups.png';canvas.save(dst);return dst


def main():
    ap=argparse.ArgumentParser()
    ap.add_argument('--input',default='/mnt/data/C_V8_ready_assets/output/C_V8_ready_made_without_vest.glb')
    ap.add_argument('--vest-input',default='/mnt/data/C_V8_ready_assets/output/C_V8_ready_made_only_assembly.glb')
    ap.add_argument('--out',default='/mnt/data/C_V8_head_skull_v81')
    ap.add_argument('--strength',type=float,default=1.)
    args=ap.parse_args();out=Path(args.out);out.mkdir(parents=True,exist_ok=True)
    a=Path(args.input);b=Path(args.vest_input)
    model_a=out/'C_V8_1_skull_refined_no_vest.glb';qa_a=export_revision(a,model_a,args.strength)
    model_b=out/'C_V8_1_skull_refined_with_vest.glb';qa_b=export_revision(b,model_b,args.strength)
    for lab,p in [('before',a),('after',model_a)]:
        scene=trimesh.load(p,force='scene',process=False)
        for label,ang in [('front',0),('threequarter',-36),('profile',90)]:
            render_portrait(scene,out/f'C_{lab}_{label}.png',ang)
        render_portrait(scene,out/f'C_{lab}_full.png',-30,'full')
    make_board(out,[('V8 ORIGINAL',[(n,out/f'C_before_{n}.png') for n in ('front','threequarter','profile')]),('V8.1 REFINED',[(n,out/f'C_after_{n}.png') for n in ('front','threequarter','profile')])],None)
    qa={'version':'C V8.1 head shape refinement','technique':'deformation of completed UV-painted face mesh, original texture preserved','without_vest':qa_a,'with_vest':qa_b,'approved_baseline':'V8 original and V7 remain untouched','rigged':False,'approved':False}
    (out/'QA_report.json').write_text(json.dumps(qa,indent=2))
    (out/'README.md').write_text('# C V8.1 — Skull contour correction (experimental)\n\nImproves the existing character head with anatomical temple, cheekbone, jaw, nasal bridge, chin, frontal/occipital skull volume; does not replace or repaint the anime face texture. UV coordinates and all other meshes, including ready-made outfit, boots, hands, scarf, headband and hair, are preserved. Two unrigged static GLBs are provided (without/with vest). Rebuild: `python refine_skull_head_v81.py --input C_V8_ready_made_without_vest.glb --vest-input C_V8_ready_made_only_assembly.glb --out output/`. No game integration; previous V8 files remain available for rollback.\n')
    print(json.dumps({'outputs':[str(model_a),str(model_b)],'max_displacement_mm':qa_a['max_head_vertex_displacement_mm'],'texture_same':qa_a['painted_texture_byte_exact'],'other_untouched_mm':qa_a['max_other_mesh_vertex_error_mm']},indent=2))

if __name__=='__main__':main()