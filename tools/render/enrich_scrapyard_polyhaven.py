#!/usr/bin/env python3
"""Non-destructive Poly Haven CC0 3D set-dressing for Hero Shooter's Pine Ridge yard.

Imports *actual* Poly Haven 1K glTF assets with dependencies and textures,
instances them in the existing procedural GLB in measured locations, and
exports an enriched GLB, an optional overhead preview and manifest.

The established 50 x 28m GLB, layout, navgrid and colliders are left intact.
The current Canvas training range remains a separate 2D scene; the enriched
GLB is for future 3D level loading and still-image backgrounds.

Usage in GitHub Actions:
    xvfb-run -a python tools/render/enrich_scrapyard_polyhaven.py

For an offline geometry smoke test (with locally supplied .gltf or .glb):
    python tools/render/enrich_scrapyard_polyhaven.py --offline --cache-dir ./fixture-cache \
      --scene fixture.glb --layout fixture.json --output enriched.glb \
      --manifest manifest.json --no-preview

License: original Poly Haven assets CC0. API used only at build time;
see https://polyhaven.com/our-api (and use a distinctive User-Agent).
"""
from __future__ import annotations

import argparse
import hashlib
import json
import math
from pathlib import Path
import shutil
import sys
from urllib.parse import urlparse, unquote

import numpy as np
import requests
import trimesh

ROOT=Path(__file__).resolve().parents[2]
ARENA=ROOT/'sophia/play/assets/procedural/scrapyard'
AGENT='HeroShooterScrapyardBuilder/1.0 (+https://github.com/cryogenized-spec/Hero-shooter)'
ALLOWED_DOWNLOAD_HOSTS={'dl.polyhaven.org','cdn.polyhaven.com'}
# Cosmetic model meshes only. The physical/interactive placeholders stay in place.
ASSETS={
 'barrel_03':{'type':'drum','size_m':[.74,.96,.74], 'page':'https://polyhaven.com/a/barrel_03'},
 'old_tyre':{'type':'tyre','size_m':[.81,.21,.81], 'page':'https://polyhaven.com/a/old_tyre'},
 'rusted_wheel_rim_02':{'type':'rim','size_m':[.60,.18,.60], 'page':'https://polyhaven.com/a/rusted_wheel_rim_02'},
}
DRUMS=('barrel_1','barrel_2','barrel_3','barrel_6','barrel_8','barrel_14','barrel_16')
TYRES=('tirestack_1','tirestack_2','tirestack_3','tirestack_5','tirestack_7','tirestack_9')
RIMS=('pallet_1','pallet_3','pallet_6')


def safe_relative(path: str) -> Path:
    item=Path(path.replace('\\','/'))
    if item.is_absolute() or '..' in item.parts or not item.parts:
        raise ValueError(f'Unsafe API include path: {path!r}')
    return item


def api_json(url: str) -> dict:
    response=requests.get(url,headers={'User-Agent':AGENT,'Accept':'application/json'},timeout=40)
    response.raise_for_status()
    return response.json()


def download_file(url: str, where: Path, md5: str|None = None, max_bytes: int = 60_000_000) -> int:
    parsed=urlparse(url)
    if parsed.scheme != 'https' or parsed.hostname not in ALLOWED_DOWNLOAD_HOSTS:
        raise ValueError(f'Unsafe Poly Haven download URL: {url!r}')
    where.parent.mkdir(exist_ok=True,parents=True)
    if where.exists() and where.stat().st_size:
        if md5 and hashlib.md5(where.read_bytes()).hexdigest().lower()!=md5.lower():
            where.unlink()
        else:
            return where.stat().st_size
    temp=where.with_name(where.name+'.partial')
    count=0; digest=hashlib.md5()
    with requests.get(url,headers={'User-Agent':AGENT},timeout=(20,120),stream=True) as response:
        response.raise_for_status()
        with temp.open('wb') as f:
            for block in response.iter_content(chunk_size=256*1024):
                if not block: continue
                count+=len(block)
                if count>max_bytes:raise ValueError(f'Model dependency exceeded 60MB cap: {url}')
                f.write(block); digest.update(block)
    if md5 and digest.hexdigest().lower()!=md5.lower():
        temp.unlink(missing_ok=True)
        raise ValueError(f'Poly Haven integrity hash mismatch for {where.name}')
    temp.replace(where)
    return count


def get_asset(slug: str, cache: Path, offline: bool) -> tuple[Path,dict]:
    folder=cache/slug; folder.mkdir(parents=True,exist_ok=True)
    if offline:
        entries=list(folder.glob('*.gltf'))+list(folder.glob('*.glb'))
        if not entries:raise FileNotFoundError(f'Offline test model not present: {folder}')
        return entries[0],{'resolution':'local','files':'offline fixture'}
    info=api_json('https://api.polyhaven.com/files/'+slug)
    variants=info.get('gltf',{})
    entry=None;resolution=None
    for res in ('1k','2k','4k'):
        if isinstance(variants.get(res),dict) and isinstance(variants[res].get('gltf'),dict):
            resolution=res; entry=variants[res]['gltf'];break
    if not entry:
        raise RuntimeError(f'{slug} has no glTF file listed by Poly Haven API')
    url=entry['url'];name=Path(unquote(urlparse(url).path)).name
    main=folder/safe_relative(name)
    total=download_file(url,main,entry.get('md5'))
    for subpath,subinfo in entry.get('include',{}).items():
        rel=safe_relative(subpath)
        total+=download_file(subinfo['url'],folder/rel,subinfo.get('md5'))
    print(f'Poly Haven {slug}: {resolution} glTF, {total/1e6:.2f} MB (incl. dependencies)',flush=True)
    return main,{'resolution':resolution,'url':ASSETS[slug]['page'],'file_bytes':total}


def orient_model(parts: list[trimesh.Trimesh],kind: str,target_dimensions: list[float]):
    # Trimesh loads glTF scene transforms. Mesh geometry is real, not a stand-in.
    bounds=np.array([mesh.bounds for mesh in parts]);lo=bounds[:,0,:].min(axis=0);hi=bounds[:,1,:].max(axis=0)
    extent=hi-lo
    if (extent < 0.00001).any():raise ValueError('Model has a zero dimension')
    # Cylinders generally have their *longest* dimension on the axial side;
    # tyres / wheel rims have the *shortest* dimension along the axle.
    axial=int(np.argmax(extent)) if kind=='drum' else int(np.argmin(extent))
    if axial==1:R=np.eye(4)
    elif axial==2:R=trimesh.transformations.rotation_matrix(-math.pi/2,[1,0,0])
    else:R=trimesh.transformations.rotation_matrix(math.pi/2,[0,0,1])
    oriented=[]
    for mesh in parts:
        mesh=mesh.copy();mesh.apply_transform(R);oriented.append(mesh)
    low=np.min([x.bounds[0] for x in oriented],axis=0)
    high=np.max([x.bounds[1] for x in oriented],axis=0)
    d=high-low
    desired=np.array(target_dimensions,dtype=float)
    base=max(d[0],d[2]);ratio=desired[0]/base
    # Keep circular wheel faces circular; adjust height slightly if needed.
    scale=np.diag([ratio,desired[1]/d[1],ratio,1.])
    for p in oriented:p.apply_transform(scale)
    low=np.min([x.bounds[0] for x in oriented],axis=0)
    high=np.max([x.bounds[1] for x in oriented],axis=0)
    move=trimesh.transformations.translation_matrix([-(low[0]+high[0])/2, -low[1], -(low[2]+high[2])/2])
    for p in oriented:p.apply_transform(move)
    return oriented, {'source_axial_axis':'XYZ'[axial],'target_extent_m':[round(float(v),3) for v in (np.max([p.bounds[1] for p in oriented],axis=0)-np.min([p.bounds[0] for p in oriented],axis=0))], 'source_extent':[round(float(v),3) for v in extent]}


def anchors(layout: dict):
    return {x['name']:x for x in layout['colliders']}


def authored_to_glb_position(o:dict, ground_offset=0.0):
    # Authored [x, y(north), z(height)] -> glTF [x, y(height), z(south)].
    x,y,z=o['center'];height=o.get('height',o.get('size',[0,0,0])[-1]);
    return (float(x),float(z)-float(height)/2+ground_offset,-float(y))


def planned_placements(layout:dict):
    lookup=anchors(layout)
    placements=[]
    for idx,name in enumerate(DRUMS):
        pos=authored_to_glb_position(lookup[name]);
        placements.append({'asset':'barrel_03','at':name,'position_m':pos,'yaw_deg':(idx*31)%360})
    for idx,name in enumerate(TYRES):
        at=lookup[name];height=float(at['height']);n=max(1,math.ceil(height/.21))
        spacing=(height-.21)/(n-1) if n>1 else 0
        for layer in range(n):
            pos=authored_to_glb_position(at,layer*spacing)
            placements.append({'asset':'old_tyre','at':name,'stack_layer':layer,
                               'position_m':pos,'yaw_deg':(17*idx+27*layer)%360})
    for idx,name in enumerate(RIMS):
        at=lookup[name];
        pos=authored_to_glb_position(at,float(at['size'][2]))
        placements.append({'asset':'rusted_wheel_rim_02','at':name,'position_m':pos,
                           'yaw_deg':(idx*39+11)%360})
    return placements


def enhance(scene:trimesh.Scene,layout:dict,assets:dict):
    if abs(float(layout['dimension_m']['width_x'])-50)>.1:raise ValueError('Unexpected arena dimensions')
    pl=planned_placements(layout);registry={}; report={}
    for slug,pack in assets.items():
        raw=trimesh.load(pack['file'],force='scene',process=False)
        if not raw.geometry:raise RuntimeError(f'No mesh data in downloaded {slug} glTF')
        parts=[m for m in raw.dump() if isinstance(m,trimesh.Trimesh) and len(m.faces)]
        if not parts:raise RuntimeError(f'Empty imported model {slug}')
        meshes,stats=orient_model(parts,ASSETS[slug]['type'],ASSETS[slug]['size_m'])
        registry[slug]=[];report[slug]={'mesh_groups':len(meshes),'triangles':sum(len(m.faces) for m in meshes),**stats}
        for i,mesh in enumerate(meshes):
            name=f'polyhaven__{slug}__part{i}'
            # A single geometry will be instanced multiple times in the GLB.
            # We add once at the first placement, then graph-reference it.
            registry[slug].append((name,mesh))
    for p_i,spot in enumerate(pl):
        tx,ty,tz=spot['position_m']
        matrix=trimesh.transformations.translation_matrix([tx,ty,tz]) @ \
            trimesh.transformations.rotation_matrix(math.radians(spot['yaw_deg']),[0,1,0])
        for index,(name,mesh) in enumerate(registry[spot['asset']]):
            node=f'polyhaven__{spot["asset"]}__{p_i:02d}__part{index:02d}'
            if name not in scene.geometry:
                scene.add_geometry(mesh,geom_name=name,node_name=node,transform=matrix)
            else:
                scene.graph.update(frame_to=node,frame_from=scene.graph.base_frame,
                                   matrix=matrix,geometry=name)
    return pl,report


def make_preview(glb:Path,png:Path):
    import vtk
    from vtk.util.numpy_support import vtk_to_numpy
    from PIL import Image,ImageDraw
    win=vtk.vtkRenderWindow();win.SetOffScreenRendering(True);win.SetSize(1400,900);win.SetMultiSamples(4)
    imp=vtk.vtkGLTFImporter();imp.SetFileName(str(glb));imp.SetRenderWindow(win);imp.Update()
    r=win.GetRenderers().GetFirstRenderer()
    r.SetBackground(0.13,0.12,0.13)
    cam=vtk.vtkCamera();cam.SetFocalPoint(0,1.5,0);cam.SetPosition(0,30,29)
    cam.SetViewUp(0,1,0);cam.ParallelProjectionOn();cam.SetParallelScale(19.5)
    r.SetActiveCamera(cam)
    for pos,intensity in [((-28,25,24),1.05),((24,35,-20),.58),((0,24,0),.35)]:
        l=vtk.vtkLight();l.SetPosition(*pos);l.SetFocalPoint(0,0,0);l.SetIntensity(intensity);r.AddLight(l)
    win.Render()
    flt=vtk.vtkWindowToImageFilter();flt.SetInput(win);flt.SetInputBufferTypeToRGB();flt.ReadFrontBufferOff();flt.Update()
    data=vtk_to_numpy(flt.GetOutput().GetPointData().GetScalars()).reshape((900,1400,3))
    image=Image.fromarray(data[::-1].copy(),'RGB');image.save(png,quality=94)
    image.save(png.with_suffix('.webp'),'WEBP',quality=84,method=5)
    return image.size


def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--scene',type=Path,default=ARENA/'scrapyard_arena.glb')
    parser.add_argument('--layout',type=Path,default=ARENA/'arena_layout.json')
    parser.add_argument('--output',type=Path,default=ARENA/'scrapyard_arena_polyhaven.glb')
    parser.add_argument('--manifest',type=Path,default=ARENA/'arena_polyhaven_manifest.json')
    parser.add_argument('--preview',type=Path,default=ARENA/'scrapyard_polyhaven_preview.png')
    parser.add_argument('--cache-dir',type=Path,default=ROOT/'.cache/polyhaven_models')
    parser.add_argument('--offline',action='store_true',help='Load cached .gltf/.glb fixtures, no network')
    parser.add_argument('--no-preview',action='store_true')
    args=parser.parse_args()
    layout=json.loads(args.layout.read_text())
    scene=trimesh.load(args.scene,force='scene',process=False)
    original_nodes=len(scene.graph.nodes_geometry)
    original_geoms=len(scene.geometry)
    original_bounds=np.array(scene.bounds)
    downloaded={}
    for slug in ASSETS:
        path,detail=get_asset(slug,args.cache_dir,args.offline)
        downloaded[slug]={'file':path,**detail}
    instances,stats=enhance(scene,layout,downloaded)
    args.output.parent.mkdir(parents=True,exist_ok=True)
    args.output.write_bytes(scene.export(file_type='glb'))
    check=trimesh.load(args.output,force='scene',process=False)
    assert len(check.graph.nodes_geometry)>original_nodes
    assert len(check.geometry)>original_geoms
    assert np.all(check.bounds[0]<=original_bounds[0]+1e-3)
    assert np.all(check.bounds[1]>=original_bounds[1]-1e-3)
    preview=None
    if not args.no_preview:
        args.preview.parent.mkdir(parents=True,exist_ok=True)
        make_preview(args.output,args.preview)
        preview=str(args.preview.name)
    report={
        'version':1,'scene':'Pine Ridge scrapyard / Hero Shooter',
        'base_glb':args.scene.name,'enriched_glb':args.output.name,
        'preview':preview,
        'source':'Poly Haven CC0 3D models (downloaded once at build time)',
        'api_credit':'Powered by Poly Haven — https://polyhaven.com',
        'asset_sources':{slug:{'page':ASSETS[slug]['page'],'license':'CC0','resolution':downloaded[slug]['resolution'],**stats[slug]} for slug in ASSETS},
        'instances':len(instances),'placements':instances,
        'original_mesh_groups':original_geoms,'enriched_mesh_groups':len(check.geometry),
        'original_scene_nodes':original_nodes,'enriched_scene_nodes':len(check.graph.nodes_geometry),
        'collisions_unchanged':True,'navgrid_unchanged':True,
        'engine_note':'3D enriched GLB not directly loaded by current 2D public/training range; runtime integration is separate.',
        'size_bytes':args.output.stat().st_size,
    }
    args.manifest.write_text(json.dumps(report,indent=2)+'\n')
    print(f'ENRICHED: {len(instances)} model instances, {len(check.geometry)} geometry groups, '
          f'{args.output.stat().st_size/1e6:.1f} MB',flush=True)

if __name__=='__main__':main()