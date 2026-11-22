import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';

const read=(p)=>readFile(new URL('../'+p,import.meta.url));
const noop=()=>{};

test('the two primary game backdrops and Saafiya atlases are real generated WebP assets',async()=>{
  for(const file of [
    'home_and_more_shop_3d.webp','home_and_more_staff_3d.webp',
    'saafiya_walk_8way_8frame_atlas.webp','saafiya_run_8way_8frame_atlas.webp'
  ]){
    const contents=await read('public/play/assets/procedural/'+file);
    assert.ok(contents.length>8000,file+' is unexpectedly small');
    assert.equal(contents.toString('ascii',0,4),'RIFF',file);
    assert.equal(contents.toString('ascii',8,12),'WEBP',file);
  }
  const glb=await read('public/play/assets/procedural/home_and_more_shop_3d.glb');
  assert.equal(glb.toString('ascii',0,4),'glTF');
  const meta=JSON.parse((await read('public/play/assets/procedural/saafiya_motion_metadata.json')).toString());
  assert.deepEqual(meta.directions,['S','SW','W','NW','N','NE','E','SE']);
  assert.equal(meta.frame_count_per_cycle,8);
  assert.deepEqual(meta.size_pixels,[176,224]);
});

test('shop module uses 3D backdrops as default with debug fallback',async()=>{
  const code=(await read('public/play/shop.js')).toString();
  assert.match(code,/home_and_more_shop_3d\.webp/);
  assert.match(code,/home_and_more_staff_3d\.webp/);
  assert.match(code,/drawProceduralBackdrop\(ctx,floor,bounds\)/);
  assert.match(code,/procedural3D/);
  const sprites=(await read('public/play/sprites.js')).toString();
  assert.match(sprites,/function drawSaafiya3D/);
  assert.match(sprites,/saafiya_.*8way_8frame_atlas\.webp/);
});

test('Staff Only E-key doorway works in both directions and preserves the player',async()=>{
  const scene=(await read('public/play/shop.js')).toString();
  const sprite=(await read('public/play/sprites.js')).toString();
  const map=JSON.parse((await read('public/play/maps/home-and-more.tmj')).toString());
  const elements=new Map();
  const elem=id=>{
    if(!elements.has(id))elements.set(id,{
      hidden:true,textContent:'',style:{},
      classList:{add:noop,remove:noop,toggle:noop},addEventListener:noop,
      replaceChildren:noop,appendChild:noop
    });
    return elements.get(id);
  };
  const saves=new Map();
  const location={search:'?resume=1'};
  const root={
    location,document:{body:{classList:{add:noop,remove:noop}},getElementById:elem,baseURI:'https://example.test/play/'},
    addEventListener:noop,console,
    localStorage:{
      getItem:key=>saves.get(key)||null,
      setItem:(key,value)=>saves.set(key,value),
      removeItem:key=>saves.delete(key)
    }
  };
  const env={window:root,document:root.document,
    fetch:async()=>({ok:true,json:async()=>map}),console,Math,Object,Number,JSON,String,Set,
    URLSearchParams,URL,performance:{now:()=>0}};
  vm.runInNewContext(sprite,env);
  vm.runInNewContext(scene,env);
  const saveKey='hero-shooter:home-and-more-save-v1';
  saves.set(saveKey,JSON.stringify({floor:'shop',
    player:{x:322,y:1092,angle:0},elapsed:0,delivered:[],envelopes:[]}));
  await root.HeroShop.start();
  root.HeroShop.keydown('KeyE');
  root.HeroShop.stop();
  const entered=JSON.parse(saves.get(saveKey));
  assert.equal(entered.floor,'staff','E at Staff Only must enter back office');
  assert.ok(entered.player.x>1700 && entered.player.y>850);
  saves.set(saveKey,JSON.stringify({...entered,player:{x:1832,y:900,angle:0}}));
  await root.HeroShop.start();
  root.HeroShop.keydown('KeyE');
  root.HeroShop.stop();
  const returned=JSON.parse(saves.get(saveKey));
  assert.equal(returned.floor,'shop','E at staff exit must return to sales floor');
  assert.ok(returned.player.x<400);
});
