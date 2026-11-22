import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const read=async path=>readFile(new URL('../'+path,import.meta.url),'utf8');

test('live 3D looter stage is reachable from playable shop',async()=>{
 const html=await read('public/play/index.html');
 const stage=await read('public/play/looters-3d.html');
 assert.match(html,/href="\.\/looters-3d\.html"/);
 assert.match(stage,/type="importmap"/);
 assert.match(stage,/looters-3d\.js/);
 assert.match(stage,/WebGL/);
});

test('live renderer uses GLTF geometry and named articulated joints instead of sprite scaling',async()=>{
 const source=await read('public/play/looters-3d.js');
 assert.match(source,/GLTFLoader/);
 assert.match(source,/_articulated\.glb/);
 for (const id of ['looter_23','looter_27','looter_35']) assert.match(source,new RegExp(id));
 for (const joint of ['thigh_l','shin_l','foot_l','thigh_r','shin_r','foot_r','arm_l','arm_r']) assert.ok(source.includes("'"+joint+"'"));
 assert.match(source,/WebGLRenderer/);
 assert.match(source,/setPixelRatio/);
 assert.doesNotMatch(source,/drawImage\(/);
});

test('male locomotion and separate hand props preserve idle and action states',async()=>{
 const src=await read('public/play/looters-3d.js');
 for (const marker of ['ikPos','updateRig','leg[','arm_r','brick','stone','knife','overhand','throw','run','walk','idle']) assert.ok(src.includes(marker),marker);
 const exporter=await read('tools/render/export_articulated_looters.py');
 assert.match(exporter,/model\.groups/);
 assert.match(exporter,/frame_to=joint/);
 const generator=await read('tools/render/generate_looters.py');
 for (const palette of ['#704732','#623F2D','#76503A']) assert.ok(generator.includes(palette),palette);
});

test('generation workflow exports new articulated files and runs existing checks',async()=>{
 const workflow=await read('.github/workflows/render-looter-assets.yml');
 assert.match(workflow,/export_articulated_looters\.py/);
 assert.match(workflow,/_articulated\.glb/);
 assert.match(workflow,/npm test/);
 assert.match(workflow,/npm run build/);
});


test('scrapyard GLB is authoritative sandbox environment with the right up-axis',async()=>{
 const source=await read('public/play/looters-3d.js');
 assert.match(source,/scrapyard_arena\.glb/);
 assert.match(source,/arena_navgrid\.json/);
 assert.match(source,/arena_layout\.json/);
 assert.match(source,/arenaRoot\.rotation\.x=Math\.PI\/2/);
 assert.match(source,/moveOnGrid/);
 assert.match(source,/isWalkable/);
 assert.match(source,/south_gate/);
 assert.doesNotMatch(source,/cargo container',x,y,z/);
 const gen=await read('tools/render/build_scrapyard_arena.py');
 assert.match(gen,/def make_navigation_grid/);
 assert.match(gen,/def export_scene/);
 assert.match(gen,/50/);
 const workflow=await read('.github/workflows/render-looter-assets.yml');
 assert.match(workflow,/build_scrapyard_arena\.py/);
 assert.match(workflow,/scrapyard_arena\.glb/);
 assert.match(workflow,/arena_navgrid\.json/);
});
