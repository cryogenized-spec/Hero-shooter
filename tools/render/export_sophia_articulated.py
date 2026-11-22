#!/usr/bin/env python3
"""Export approved Sophia v3.3 VTK geometry with articulated rigid groups.

Preserves the approved 2048px painted anime face and chrome prop. Animation is
procedural rigid-part rotation (not a skin-weighted skeletal rig). Depends on
the existing v3.3 and v3.2 Studio builders, not 2D sprite images.
"""
from pathlib import Path
import json
import numpy as np
import trimesh
import vtk
from vtk.util.numpy_support import vtk_to_numpy
from PIL import Image
import sophia_saafiya_studio_v3_3_builder as source

OUT = Path(__file__).resolve().parent / 'sophia_articulated'
OUT.mkdir(exist_ok=True)

def tr(x,y,z):
    m=np.eye(4);m[:3,3]=[x,y,z];return m

def main():
    model=source.Studio33()
    # Authoritative grouping follows the source's approved v3.4 animation code.
    prepared=[]
    for index,(name,mat,poly,actor) in enumerate(model.parts):
        filt=vtk.vtkTriangleFilter();filt.SetInputData(poly);filt.Update()
        pd=filt.GetOutput()
        if pd.GetNumberOfPolys()<1 or pd.GetNumberOfPoints()<3:continue
        v=vtk_to_numpy(pd.GetPoints().GetData()).reshape(-1,3).copy()
        connectivity=vtk_to_numpy(pd.GetPolys().GetConnectivityArray()).astype('i8')
        assert len(connectivity)%3==0,(name,len(connectivity))
        f=connectivity.reshape(-1,3)
        uv=None
        if name=='anatomy/continuous_face_and_nose':
            tc=pd.GetPointData().GetTCoords()
            assert tc is not None,'Approved face UV coordinates missing'
            uv=vtk_to_numpy(tc).reshape(-1,2).copy()
            assert len(uv)==len(v)
        if index<=37:group='left_boot' if name.startswith('boot/') else 'left_leg'
        elif index<=77:group='right_boot' if name.startswith('boot/') else 'right_leg'
        elif 112<=index<=130 or name.startswith('prop/'):group='left_arm'
        elif 134<=index<=152:group='right_arm'
        else:group='body'
        prepared.append((index,name,mat,group,v,f,uv))
    assert len(prepared)>250,'Missing approved source geometry'
    points=np.vstack([a[4] for a in prepared])
    floor=float(points[:,2].min());high=float(points[:,2].max())
    scale=1.72/(high-floor)
    original_pivots={
      'body':(0,0,floor),'left_leg':(-.162,0,1.083),
      'right_leg':(.162,0,1.083),'left_boot':(-.158,0,.61),
      'right_boot':(.158,0,.61),'left_arm':(-.277,-.008,1.813),
      'right_arm':(.277,-.008,1.813)}
    pivots={g:np.array([x*scale,y*scale,(z-floor)*scale]) for g,(x,y,z) in original_pivots.items()}
    pivots['body']=np.zeros(3)
    parents={'body':None,'left_leg':'body','right_leg':'body',
             'left_boot':'left_leg','right_boot':'right_leg',
             'left_arm':'body','right_arm':'body'}
    scene=trimesh.Scene()
    scene.graph.update(frame_from=scene.graph.base_frame,frame_to='body',matrix=np.eye(4))
    for name,parent in parents.items():
        if parent is None:continue
        scene.graph.update(frame_from=parent,frame_to=name,matrix=tr(*(pivots[name]-pivots[parent])))
    face_count=0;tri_count=0
    for i,name,mat,group,v,f,uv in prepared:
        v=v.astype('f4')*scale
        v[:,2]-=floor*scale
        v-=pivots[group].astype('f4')
        geo=trimesh.Trimesh(vertices=v,faces=f,process=False,validate=False)
        if uv is not None:
            face_count+=1
            material=trimesh.visual.material.PBRMaterial(
                name='Sophia_v33_approved_painted_face',
                baseColorTexture=Image.open(model.face_texture).convert('RGBA'),
                baseColorFactor=[255,255,255,255],roughnessFactor=.94,metallicFactor=0)
            geo.visual=trimesh.visual.TextureVisuals(uv=uv.astype('f4'),material=material)
        else:
            rgb=np.array(source.base.col(mat))
            rgba=[*np.clip((rgb*255).astype(int),0,255).tolist(),255]
            material=trimesh.visual.material.PBRMaterial(
                name=mat,baseColorFactor=rgba,roughnessFactor=.65,
                metallicFactor=.86 if mat.startswith('silver') else .04,doubleSided=True)
            geo.visual=trimesh.visual.TextureVisuals(material=material)
        node=f'{group}__{i:03d}__{name.replace("/","_")}'
        scene.add_geometry(geo,node_name=node,geom_name=f'part_{i:03d}',parent_node_name=group)
        tri_count+=len(f)
    assert face_count==1,'Painted face missing'
    target=OUT/'sophia_v33_articulated.glb'
    scene.export(target)
    reopened=trimesh.load(target,force='scene',process=False)
    missing=set(parents)-set(reopened.graph.nodes)
    assert not missing,('GLB lost joints',missing)
    textured=[g for g in reopened.geometry.values()
              if getattr(getattr(g.visual,'material',None),'baseColorTexture',None) is not None]
    assert len(textured)==1,'GLB lost approved face texture'
    height=round(float(reopened.bounds[1,2]-reopened.bounds[0,2]),3)
    assert 1.70<height<1.75,height
    stats={'character':'Sophia/Saafiya v3.3','height_m':height,
           'rig_type':'procedural articulated rigid parts (not skinned)',
           'groups':list(parents),'face_texture_px':[2048,2048],
           'parts':len(prepared),'triangles':tri_count,
           'material_face_textures':len(textured),
           'weapon':'attached chrome Beretta 84FS appearance prop'}
    (OUT/'sophia_v33_articulation_audit.json').write_text(json.dumps(stats,indent=2))
    print(json.dumps(stats,indent=2),flush=True)
if __name__=='__main__':main()
