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