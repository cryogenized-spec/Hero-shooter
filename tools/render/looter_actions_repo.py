#!/usr/bin/env python3
"""Hero Shooter: male VTK looter gear, throw and overhand-action sprite pipeline.

Reuses Person.pose and Person.leg_target from generate_looters.py (two-link
male IK walk/run), never C's female animation. Standalone GLB props; 8-direction
x 8-frame attack PNG atlases; neutral unrigged GLBs remain separate.
Run: xvfb-run -a python tools/render/looter_actions_repo.py
"""
from pathlib import Path
import math
import numpy as np
import vtk
import trimesh
from PIL import Image
from vtk.util.numpy_support import vtk_to_numpy
from generate_looters import Person, Stage, CONFIGS, DIR, mesh

OUT=Path(__file__).resolve().parent/'looter_action_output'
OUT.mkdir(exist_ok=True)

def smooth(a,b,t):
    x=max(0,min(1,(t-a)/(b-a)))
    return x*x*(3-2*x)

def geometry(kind):
    if kind=='brick':
        return [(trimesh.creation.box(extents=(.13,.08,.07)),'#9D543D')]
    if kind=='stone':
        s=vtk.vtkSphereSource()
        s.SetThetaResolution(16);s.SetPhiResolution(12);s.Update()
        p=s.GetOutput();v=vtk_to_numpy(p.GetPoints().GetData()).copy()
        for i in range(len(v)):
            v[i]*=np.array([.082,.061,.053])*(1+.12*math.sin(i*.83)+.05*math.sin(i*1.91))
        f=vtk.vtkTriangleFilter();f.SetInputData(p);f.Update()
        faces=vtk_to_numpy(f.GetOutput().GetPolys().GetData()).reshape(-1,4)[:,1:]
        return [(trimesh.Trimesh(vertices=v,faces=faces,process=False),'#78736E')]
    if kind=='knife':
        h=trimesh.creation.box(extents=(.036,.044,.118))
        h.apply_translation((0,0,-.063))
        v=np.array([[-.022,-.008,0],[.022,-.008,0],[0,-.004,.17],
                    [-.022,.008,0],[.022,.008,0],[0,.004,.17]])
        f=np.array([[0,1,2],[3,5,4],[0,3,4],[0,4,1],
                    [1,4,5],[1,5,2],[2,5,3],[2,3,0]])
        return [(h,'#413B35'),(trimesh.Trimesh(vertices=v,faces=f,process=False),'#B6C0C7')]
    raise ValueError(kind)

def export_props():
    dest=OUT/'props';dest.mkdir(exist_ok=True)
    for kind in ('brick','stone','knife'):
        scene=trimesh.Scene()
        for i,(geo,c) in enumerate(geometry(kind)):
            rgba=[int(c[j:j+2],16) for j in (1,3,5)]+[255]
            geo.visual=trimesh.visual.TextureVisuals(material=trimesh.visual.material.PBRMaterial(
                name=kind+'_'+str(i),baseColorFactor=rgba,doubleSided=True))
            scene.add_geometry(geo,node_name=kind+'_'+str(i))
        scene.export(str(dest/(kind+'.glb')))

class MaleLooter(Person):
    def __init__(self,c):
        super().__init__(c)
        self.held={};self.thrown={}
        for kind in ('brick','stone','knife'):
            self.held[kind]=[]
            for i,(geo,color) in enumerate(geometry(kind)):
                a=self.add(mesh(geo.vertices,geo.faces),kind+'_held_'+str(i),color,'arm_r')
                a.SetPosition(.030*self.s,-.045*self.s,-.505*self.s)
                a.SetOrientation(90 if kind=='knife' else 0,0,0)
                self.held[kind].append(a)
            if kind!='knife':
                self.thrown[kind]=[]
                for i,(geo,color) in enumerate(geometry(kind)):
                    self.thrown[kind].append(self.add(mesh(geo.vertices,geo.faces),
                        kind+'_released_'+str(i),color,'body'))
        self.action('idle',0,'none')

    def action(self,state,t,prop,yaw=0):
        assert state in ('idle','walk','run','throw','overhand')
        assert prop in ('none','brick','stone','knife')
        assert state!='throw' or prop in ('brick','stone')
        assert state!='overhand' or prop=='knife'
        self.pose(yaw,state if state in ('idle','walk','run') else 'idle',t)
        for group in list(self.held.values())+list(self.thrown.values()):
            for a in group:a.SetVisibility(False)
        if state in ('idle','walk','run'):
            if prop!='none':
                for a in self.held[prop]:a.SetVisibility(True)
                self.groups['arm_r'].SetOrientation(-10,0,-12)
        elif state=='throw':
            self.groups['arm_r'].SetOrientation(
                -123*smooth(0,.35,t)+102*smooth(.35,.65,t)+21*smooth(.65,1,t),0,-12)
            self.groups['arm_l'].SetOrientation(-17*math.sin(math.pi*t),0,0)
            if t<.52:
                for a in self.held[prop]:a.SetVisibility(True)
            elif t<.95:
                travel=(t-.52)/.43
                for a in self.thrown[prop]:
                    a.SetVisibility(True)
                    a.SetPosition(.12+.24*travel,-.50-1.4*travel,
                                  .89+.32*math.sin(math.pi*travel)-.45*travel)
        else:
            self.groups['arm_r'].SetOrientation(
                -158*smooth(0,.29,t)+120*smooth(.32,.69,t)+38*smooth(.74,1,t),0,-17)
            self.groups['arm_l'].SetOrientation(-20*math.sin(math.pi*t),0,0)
            for a in self.held['knife']:a.SetVisibility(True)
        return self

def render_atlas(m,prop,dest):
    stage=Stage(m,(240,384),'game',True)
    hi=Image.new('RGBA',(1024,1536));small=Image.new('RGBA',(256,384))
    for row in range(8):
        for col,(_,yaw,_,_) in enumerate(DIR):
            m.action('overhand' if prop=='knife' else 'throw',row/7,prop,yaw)
            im=stage.grab(True).resize((128,192),Image.Resampling.LANCZOS)
            hi.alpha_composite(im,(col*128,row*192))
            small.alpha_composite(im.resize((32,48),Image.Resampling.LANCZOS),(col*32,row*48))
    stage.close()
    hi.save(dest/(prop+'_action_4x.png'))
    small.save(dest/(prop+'_action_32x48.png'))
    a=np.asarray(small.getchannel('A'))
    assert all((a[y*48:(y+1)*48,x*32:(x+1)*32]>12).sum()>30
               for y in range(8) for x in range(8))


def equipped_atlas(m,prop,dest):
    """96-cell male walk/run/idle sheet with a separate prop attached to hand."""
    stage=Stage(m,(96,144),'game',True)
    small=Image.new('RGBA',(256,576))
    for gait_i,gait in enumerate(('idle','walk','run')):
        for frame in range(4):
            for col,(_,yaw,_,_) in enumerate(DIR):
                m.action(gait,frame/4,prop,yaw)
                im=stage.grab(True).resize((32,48),Image.Resampling.LANCZOS)
                small.alpha_composite(im,(col*32,(gait_i*4+frame)*48))
    stage.close()
    small.save(dest/(prop+'_equipped_gait_32x48.png'))
    a=np.asarray(small.getchannel('A'))
    assert all((a[y*48:(y+1)*48,x*32:(x+1)*32]>12).sum()>30
               for y in range(12) for x in range(8))

def main():
    export_props()
    for config in CONFIGS:
        dest=OUT/config['id'];dest.mkdir(exist_ok=True)
        actor=MaleLooter(config)
        for prop in ('brick','stone','knife'):
            render_atlas(actor,prop,dest)
            equipped_atlas(actor,prop,dest)
            print(config['id'],prop,flush=True)
    (OUT/'README.md').write_text(
        'Reusable male two-link IK gait in generate_looters.py. '
        'Separate brick, stone and knife GLBs. '
        'Attack sheets: eight directions S SW W NW N NE E SE x eight frames '
        'at 32x48 or 128x192 pixels. Offline VTK poses, not skeletal animation.\\n')

if __name__=='__main__':main()
