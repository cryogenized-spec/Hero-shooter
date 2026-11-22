import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync, statSync } from 'node:fs';
import { join } from 'node:path';

test('C sandbox build copies exact original scrapyard model and navigation data',()=>{
 const source=readFileSync('scripts/build.mjs','utf8');
 for(const file of ['scrapyard_arena.glb','arena_navgrid.json','arena_layout.json']){
   assert.match(source,new RegExp(file.replace('.','\\.')));
   assert.ok(existsSync(join('sophia','play','assets','procedural','scrapyard',file)));
 }
 assert.match(source,/scrapyardOut/);
});
test('C sandbox points to the published copied scrapyard assets',()=>{
 const code=readFileSync('public/c/c-demo.js','utf8');
 assert.match(code,/play\/assets\/procedural\/scrapyard/);
 assert.match(code,/RIGHT:THREE\.MOUSE\.ROTATE/);
 assert.match(code,/LEFT:null/);
});
