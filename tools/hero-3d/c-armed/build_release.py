#!/usr/bin/env python3
"""Hero Shooter C v6 artifact pipeline. Source-only Git; compiled art is a CI artifact."""
from pathlib import Path
import hashlib,json,os,shutil,subprocess,sys,zipfile
import brotli
from optimize_c_glb_lossless import load,opt
ROOT=Path(__file__).resolve().parent
DIST=ROOT/'dist'
DIST.mkdir(exist_ok=True)
SCRIPTS=['build_c_vtk_v3.py','build_c_v4_walk.py','build_c_armed_v6.py']
for script in SCRIPTS:
 print('Building',script,flush=True)
 subprocess.run([sys.executable,str(ROOT/script)],cwd=str(ROOT),check=True, env={**os.environ,"HERO_C_FAST_BUILD":"1"})
SOURCE=ROOT/'C_armed_VTK_v6/C_armed_v6_twohand_lowready.glb'
TARGET=DIST/'C_armed_v6_twohand_lowready_optimized.glb'
summary=opt(SOURCE,TARGET)
BIN=TARGET.read_bytes()
(DIST/(TARGET.name+'.br')).write_bytes(brotli.compress(BIN,quality=8))
for src,dst in [
 ('C_armed_twohand_south_8frame_40x48.png','C_armed_twohand_south_8frame_40x48.png'),
 ('C_armed_twohand_south_8frame_64x96.png','C_armed_twohand_south_8frame_64x96.png'),
 ('C_armed_v6_pose_comparison.png','C_armed_v6_pose_comparison.png'),
 ('QA_report.json','QA_report.json'),
 ('C_face_original_embedded.png','C_face_original_embedded.png')]:
 shutil.copy2(ROOT/'C_armed_VTK_v6'/src,DIST/dst)
js,bd=load(TARGET)
assert len(js.get('animations',[]))==5 and len(js['meshes'])==47
assert all(len(m['primitives'][0]['targets'])==9 for m in js['meshes'])
assert 'C_Armed_Walk_LowReady_8' in [a['name'] for a in js['animations']]
assert all('input' in s and 'output' in s for a in js['animations'] for s in a['samplers'])
report={'character':'C','revision':'V6 two-hand low-ready','format':'glTF binary with morph-target animations','animations':[a['name'] for a in js['animations']], 'geometry_groups':len(js['meshes']), 'morph_targets_per_group':9,'source_glb_bytes':summary['source_bytes'],'optimized_glb_bytes':TARGET.stat().st_size,'brotli_transfer_bytes':(DIST/(TARGET.name+'.br')).stat().st_size,'source_vertices':summary['source_vertices'],'optimized_vertices':summary['optimized_vertices'],'checksum_sha256':hashlib.sha256(BIN).hexdigest(),'script':'build_release.py','integration_status':'source and build pipeline committed; produced GLB must be downloaded from CI artifact or Library before game integration','sprite_note':'South/front facing only, eight phases. Existing game atlas uses 4-frame rows; do not substitute directly without adapting loader.'}
(DIST/'asset_manifest.json').write_text(json.dumps(report,indent=2)+'\n')
with zipfile.ZipFile(ROOT/'C_armed_v6_asset_pack.zip','w',zipfile.ZIP_DEFLATED,compresslevel=5) as z:
 for p in sorted(DIST.iterdir()):
  if p.is_file():z.write(p,'assets/'+p.name)
 for p in [*map(lambda x:ROOT/x, ['build_release.py','build_c_armed_v6.py','optimize_c_glb_lossless.py','requirements.txt','README.md'])]:
  z.write(p,'source/'+p.name)
print(json.dumps(report,indent=2),flush=True)