import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,readdir,stat} from 'node:fs/promises';
const read=async path=>readFile(new URL('../'+path,import.meta.url),'utf8');
test('public homepage directly starts Sophia 3D sandbox',async()=>{
 const html=await read('index.html');
 assert.match(html,/Sophia.s Scrapyard/);
 assert.match(html,/\.\/src\/sophia-demo\.js/);
 assert.match(html,/id="stage"/);
 assert.match(html,/data-control="up"/);
 assert.match(html,/data-control="jump"/);
 assert.doesNotMatch(html,/src\/title-entry\.js|campMallBtn|2D Canvas/);
});
test('demo imports GLBs, not 32×48 pixel sprite sheets',async()=>{
 const js=await read('src/sophia-demo.js');
 assert.match(js,/GLTFLoader/);
 assert.match(js,/sophia_v33_articulated\.glb/);
 assert.match(js,/scrapyard_arena\.glb/);
 assert.match(js,/WebGLRenderer/);
 assert.match(js,/renderer\.setPixelRatio/);
 assert.doesNotMatch(js,/drawImage\(|_8way\.webp/);
 assert.match(js,/model\.getObjectByName\(name\)/);
});
test('movement and controls use 3D physics with correct collision support',async()=>{
 const js=await read('src/sophia-demo.js');
 for(const token of ['walkable','moveGround','animateSophia','jumpVelocity','jumpHeight',
  'camera.getWorldDirection','hero.facing','throwStone','spawnStone','respawn',
  'toggleCamera','toggleNpcs','left_leg','right_leg','left_boot','right_boot'])
   assert.ok(js.includes(token),token);
 assert.match(js,/yard\.rotation\.x=Math\.PI\/2/);
 const nav=JSON.parse(await read('public/play/assets/procedural/scrapyard/arena_navgrid.json'));
 const layout=JSON.parse(await read('public/play/assets/procedural/scrapyard/arena_layout.json'));
 assert.equal(nav.tile_size_m,.5);
 assert.equal(nav.width_cells,100);
 assert.equal(nav.height_cells,56);
 assert.equal(nav.rows.length,56);
 const spawn=layout.spawn_points.find(p=>p.id==='south_gate');
 assert.ok(spawn);
 const x=Math.floor((spawn.x+25)/.5),y=Math.floor((14-spawn.y)/.5);
 assert.equal(nav.rows[y][x],'1','south gate must be walkable');
});
test('Sophia exporter preserves painted face, limb pivots and 1.72m size',async()=>{
 const src=await read('tools/render/export_sophia_articulated.py');
 for(const s of ['source.Studio33','continuous_face_and_nose','face_texture',
 'left_arm','right_arm','left_leg','right_leg','left_boot','right_boot',
 'scene.export','1.72','trimesh.load'])assert.ok(src.includes(s),s);
 const workflow=await read('.github/workflows/build-sophia-scrapyard.yml');
 assert.match(workflow,/export_sophia_articulated\.py/);
 assert.match(workflow,/sophia_v33_articulated\.glb/);
});
test('retired 2D game assets are not in the shipping tree',async()=>{
 const retired=['public/play/game.js','public/play/sprites.js',
  'public/play/shop.js','public/play/entry.js','src/main.js'];
 for(const path of retired){
   await assert.rejects(stat(new URL('../'+path,import.meta.url)),{code:'ENOENT'});
 }
});
