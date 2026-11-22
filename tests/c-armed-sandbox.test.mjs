import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
const js=readFileSync('public/c/c-demo.js','utf8');
const html=readFileSync('public/c/index.html','utf8');
const pages=readFileSync('.github/workflows/pages.yml','utf8');
test('mouse contract: LMB fire without orbit, RMB camera rotate',()=>{
 assert.match(js, /LEFT\s*:\s*null/);
 assert.match(js, /RIGHT\s*:\s*THREE\.MOUSE\.ROTATE/);
 assert.match(js, /contextmenu',e=>e\.preventDefault\(\)/);
 assert.match(js, /if\(e\.button!==0\)return/);
 assert.match(js, /aimFromMouse\(e\);shoot\(\)/);
 assert.match(js, /if\(e\.buttons===0\)aimFromMouse\(e\)/);
 assert.match(html, /Hold RMB \+ drag/);
});
test('fire effects and 15-round extended-magazine counter',()=>{
 assert.match(js,/magazineMax=15/);
 assert.match(js,/state\.mag--/);
 assert.match(js,/state\.flashTime=/);
 assert.match(js,/ejectCasing\(\)/);
 assert.match(js,/playShotSound\(\)/);
 assert.match(js,/function reload\(\)/);
 assert.match(js,/poseNames=\['side','low','aim'\]/);
});
test('self-hosted CC0 handgun sound recordings',()=>{
 assert.match(js,/`\.\/assets\/p226-report-/);
 assert.match(js,/`\.\/assets\/p226-tail-/);
 assert.doesNotMatch(js,/https:\/\/raw\.githubusercontent\.com/);
});
test('published Pages build includes isolated /c/ without replacing Sophia',()=>{
 assert.match(pages,/c-main\/public\/c/);
 assert.match(pages,/dist\/c/);
});
test('V8.1 run gait deforms real lower-body vertices and stops at idle',async()=>{
  const {gaitSample,legDisplacement}=await import('../public/c/c-gait.js');
  const idle=gaitSample(.25,'idle');
  const walking=gaitSample(.25,'walk');
  const running=gaitSample(.25,'run');
  assert.equal(idle.active,false);
  assert.equal(walking.active,true);
  assert.equal(running.run,true);
  assert.ok(running.hipAmplitude>walking.hipAmplitude);
  assert.ok(running.kneeAmplitude>walking.kneeAmplitude);
  const left=legDisplacement(-.14,0,.72,running);
  const right=legDisplacement(.14,0,.72,running);
  assert.ok(Math.abs(left[1])>.02);
  assert.ok(left[1]*right[1]<0,'legs swing in opposite directions');
  assert.deepEqual(legDisplacement(-.14,0,.72,idle),[0,0,0]);
  assert.deepEqual(legDisplacement(.4,0,.75,running),[0,0,0],
    'upper arms beyond leg mask must not be deformed');
  assert.deepEqual(legDisplacement(-.14,0,.72,gaitSample(0,'run')),
    legDisplacement(-.14,0,.72,gaitSample(1,'run')).map(v=>Math.abs(v)<1e-10?0:v));
});
test('live C sandbox uses one deformation system for walk and sprint, and keeps the cosmetic prop upright',()=>{
  assert.match(js,/import \{gaitSample,legDisplacement\} from '\.\/c-gait\.js'/);
  assert.match(js,/function animateBody\(dt\)/);
  assert.match(js,/state\.legMorphs=parts/);
  assert.match(js,/state\.locomotion=actualDistance>\.0001\?\(run\?'run':'walk'\):'idle'/);
  assert.match(js,/run=pressed\.has\('shift'\)\|\|virtual\.has\('shift'\)/);
  assert.match(js,/addCosmeticGripFingers\(weaponHolder\)/);
  assert.match(js,/h\.rotation\.y=0/);
  assert.match(js,/h\.rotation\.z=THREE\.MathUtils\.lerp\(h\.rotation\.z,0,/);
  assert.doesNotMatch(js,/animateArms\(dt\)/);
  assert.match(html, /data-key="shift">RUN<\/button>/);
});
