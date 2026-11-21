import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {drawArmedC} from '../src/armed-c.js';

const read=path=>readFile(new URL('../'+path,import.meta.url),'utf8');

test('training path works both as dist/ and repository-root Pages',async()=>{
  const fallback=await read('training/index.html');
  const training=await read('public/training/index.html');
  const source=await read('public/training/range.js');
  const build=await read('scripts/build.mjs');
  assert.match(fallback,/new URL\('\.\.\/public\/training\/index\.html',window\.location\.href\)/);
  assert.match(fallback,/location\.search/);
  assert.match(fallback,/location\.hash/);
  assert.match(source,/import\.meta\.url\.includes\('\/public\/training\/'\)/);
  assert.match(source,/sourcePublished\?'\.\.\/\.\.\/src\/armed-c\.js':'\.\.\/src\/armed-c\.js'/);
  assert.match(source,/sourcePublished\?'\.\.\/\.\.\/':'\.\.\/'/);
  assert.match(training,/src="\.\/range\.js"/);
  assert.match(build,/await cp\(join\(root, 'public'\), out/);
});

test('armed C loads the atlas from a source-hosted training page',()=>{
  const originalImage=globalThis.Image, originalLocation=globalThis.location;
  let request;
  globalThis.location={pathname:'/Hero-shooter/public/training/index.html'};
  globalThis.Image=class{
    constructor(){this.complete=true;this.naturalWidth=320;}
    set src(x){request=x;}
  };
  const ctx={save(){},restore(){},translate(){},scale(){},drawImage(){}};
  try{
    const actor={gender:'mall',angle:0,x:100,y:100,walkBlend:0,walkPhase:0,slideTime:0};
    assert.equal(drawArmedC(ctx,actor,{id:'glock26'}),true);
    assert.match(request,/\/public\/play\/c-glock-ready\.svg$/);
  }finally{
    if(originalImage===undefined)delete globalThis.Image;
    else globalThis.Image=originalImage;
    if(originalLocation===undefined)delete globalThis.location;
    else globalThis.location=originalLocation;
  }
});
