#!/usr/bin/env python3
"""Articulated, full-resolution GLBs from actual VTK character geometry.

The original generator flattens meshes by material into an unrigged GLB.
This parallel exporter preserves named thigh, shin, foot and arm joint nodes
for real-time 3D animation by Three.js. No sprite enlargement is used.
"""
from pathlib import Path
import json
import numpy as np
import trimesh
import vtk
from vtk.util.numpy_support import vtk_to_numpy
from generate_looters import Person, CONFIGS, matrix, mathex, rgb

JOINTS = ('body','thigh_l','shin_l','foot_l','thigh_r','shin_r','foot_r','arm_l','arm_r')

def build(model, dest):
    model.pose(0,'idle',0)
    scene=trimesh.Scene()
    scene.graph.update(frame_to='body', frame_from=scene.graph.base_frame, matrix=np.eye(4))
    for joint in JOINTS[1:]:
        scene.graph.update(frame_to=joint, frame_from=model.parent[joint],
                           matrix=matrix(model.groups[joint]))
    for i,(actor,name,material,group) in enumerate(model.parts):
        actor.GetMapper().Update()
        filt=vtk.vtkTriangleFilter()
        filt.SetInputData(actor.GetMapper().GetInput());filt.Update()
        pd=filt.GetOutput()
        if pd.GetNumberOfPolys()==0:continue
        vertices=vtk_to_numpy(pd.GetPoints().GetData()).astype('f4')
        faces=vtk_to_numpy(pd.GetPolys().GetData()).reshape(-1,4)[:,1:].astype('i4')
        geo=trimesh.Trimesh(vertices=vertices,faces=faces,process=False)
        rgba=[int(v*255) for v in rgb(mathex(model.c,material))]+[255]
        geo.visual=trimesh.visual.TextureVisuals(
            material=trimesh.visual.material.PBRMaterial(name=material,
               baseColorFactor=rgba, metallicFactor=.12 if material=='metal' else 0,
               roughnessFactor=.75,doubleSided=True))
        scene.add_geometry(geo,node_name=f'{group}__{name}_{i}',
                           geom_name=f'{name}_{i}',parent_node_name=group,
                           transform=matrix(actor))
    scene.export(str(dest))
    reopened=trimesh.load(str(dest),force='scene')
    missing=set(JOINTS)-set(reopened.graph.nodes)
    assert not missing,('Missing joint nodes',missing)
    height=float(np.ptp(reopened.bounds[:,2]))
    assert 1.5<height<2.1,(model.c['id'],height)
    return {'character':model.c['id'],'height_m':round(height,3),
            'triangle_count':sum(len(v.faces) for v in reopened.geometry.values()),
            'nodes':len(reopened.graph.nodes),'geometry_meshes':len(reopened.geometry),
            'joints':list(JOINTS), 'palette':{k:model.c[k] for k in ('skin','skinShade','skinHi')}}

def main():
    dest=Path(__file__).resolve().parent/'looters_articulated'
    dest.mkdir(exist_ok=True)
    report=[]
    for config in CONFIGS:
        model=Person(config)
        result=build(model,dest/(config['id']+'_articulated.glb'))
        report.append(result)
        print(result,flush=True)
    (dest/'articulation_audit.json').write_text(json.dumps(report,indent=2))

if __name__=='__main__':main()
