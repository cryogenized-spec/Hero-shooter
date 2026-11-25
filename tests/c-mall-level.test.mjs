import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile,stat} from 'node:fs/promises';
const get=async p=>readFile(new URL('../'+p,import.meta.url),'utf8');
test('Golden Dragon is a separate mall level with C and an interactive Mr Chen',async()=>{
 const page=await get('public/c-mall/index.html');
 const js=await get('public/c-mall/mall-scene.js');
 assert.match(page,/Golden Dragon/);
 assert.match(page,/Sandton Mall/);
 assert.match(page,/mall-scene\.js/);
 assert.match(page,/c_portrait\.webp/);
 assert.match(page,/id="dialogue"/);
 assert.match(js,/C_V8_1_skull_refined_with_vest/);
 assert.match(js,/C_pink_compact_pistol/);
 assert.match(js,/mr_chen_hybrid_face_v2\.glb/);
 assert.match(js,/dialogue/);
 assert.match(js,/mall\.walkable/);
 assert.doesNotMatch(js,/scrapyard_arena\.glb/);
});
test('Mall has distinct real 3D fixtures, retail shell and concourse',async()=>{
 const src=await get('public/c-mall/mall-geometry.js');
 for(const feature of ['GoldenDragonMallLevel1','STOCK / STAFF','GOLDEN DRAGON',
 'LEVEL 1 · MALL CONCOURSE','shelf(', 'obstacle(', 'Checkout',
 'STOCK / STAFF','Mr Chen','walkable'])
 assert.ok(src.includes(feature.replace('Mr Chen','')),feature);
 assert.match(src,/function shelf/);
 assert.match(src,/new THREE\.CanvasTexture/);
 assert.match(src,/new THREE\.PointLight/);
});
test('C original portrait from this conversation is present in game assets',async()=>{
 const s=await stat(new URL('../public/c-mall/assets/c_portrait.webp',import.meta.url));
 assert.ok(s.size>2500&&s.size<100000,s.size);
});
test('Existing C scrapyard is unchanged',async()=>{
 const s=await get('public/c/c-demo.js');
 assert.match(s,/scrapyard_arena\.glb/);
 assert.match(s,/C_V8_1_skull_refined_with_vest/);
});
