import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,stat} from 'node:fs/promises';
const read=async p=>readFile(new URL('../'+p,import.meta.url),'utf8');

test('experimental prefab remains separate from active Sophia game',async()=>{
 const old=await read('src/sophia-demo.js');
 const studio=await read('public/sophia-prefab.js');
 assert.match(old,/sophia_v33_articulated\.glb/);
 assert.doesNotMatch(old,/sophia_prefab/);
 assert.match(studio,/base_body_anim\.glb|preset\.base\.model/);
 assert.match(studio,/GLTFLoader/);
 assert.match(studio,/gender_female/);
 assert.match(studio,/mergeRig/);
 assert.match(studio,/skeleton/);
});
test('CC0-only prefab asset catalog is versioned',async()=>{
 const preset=JSON.parse(await read('public/play/assets/procedural/sophia_prefab/preset.json'));
 assert.equal(preset.source.assetLicense,'CC0-1.0');
 assert.equal(preset.base.sex,'female');
 assert.equal(preset.base.height_m,1.72);
 assert.ok(preset.assets.includes('clothing_dress.glb'));
 assert.ok(preset.assets.includes('hair_long01.glb'));
 assert.ok(preset.assets.includes('clothing_boots.glb'));
});
test('preview exposes multiple camera angles and outfit choices',async()=>{
 const html=await read('public/sophia-prefab.html');
 for(const a of ['data-view="front"','data-view="threequarter"','data-view="profile"','data-view="back"','data-view="portrait"','data-outfit="practical"','data-outfit="gothic_dress"'])
  assert.ok(html.includes(a),a);
});
