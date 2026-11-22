import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
const text=async path=>readFile(new URL('../'+path, import.meta.url),'utf8');
const map=JSON.parse(await text('public/play/maps/home-and-more.tmj'));
const layers=Object.fromEntries(map.layers.map(l=>[l.name,l.objects]));
const prop=(o,name)=>o.properties?.find(p=>p.name===name)?.value;

test('Home & More exports a genuine object-layer Tiled JSON map',()=>{
  assert.equal(map.type,'map');
  assert.equal(map.orientation,'orthogonal');
  assert.equal(map.tilewidth,40);
  assert.equal(map.width*map.tilewidth,2600);
  for(const layer of ['Architecture','Fixtures','Zones','Interactables','Actors','Lighting'])
    assert.ok(Array.isArray(layers[layer]),'Missing '+layer);
  assert.ok(layers.Architecture.every(o=>o.width>0 && o.height>0));
});
test('ten complete aisles have two segments and a clear cross-passage',()=>{
  const rows=layers.Fixtures.filter(o=>o.type==='shelf' && /^Aisle \d+/.test(o.name));
  assert.equal(rows.length,20);
  const aisles=new Set(rows.map(o=>prop(o,'aisle')));
  assert.equal(aisles.size,10);
  for(const i of aisles) assert.deepEqual(rows.filter(o=>prop(o,'aisle')===i).map(o=>prop(o,'segment')).sort(),['north','south']);
  assert.ok(layers.Zones.find(o=>o.name==='Central cross-passage'));
});
test('shops have the requested features and a separate mezzanine office',()=>{
  const names=layers.Fixtures.map(o=>o.name);
  for(const name of ['Till 1','Till 2','display counter · controlled goods','light and CCTV demonstration',
    'folding tracked entrance doors','motorised security shutter','U-turn office staircase',
    'pallet stacks','polypropylene sacks','freight lift enclosure','printer & payroll cabinet'])
    assert.ok(names.includes(name),'Missing '+name);
  assert.ok(layers.Zones.some(o=>o.name==='staff canteen'));
  assert.ok(layers.Zones.some(o=>o.name==='Upper office mezzanine' && prop(o,'floor')==='office'));
  assert.ok(layers.Interactables.some(o=>o.type==='stairs' && prop(o,'floor')==='office'));
  assert.ok(layers.Interactables.some(o=>o.type==='stairs' && prop(o,'floor')==='shop'));
});
test('Sunday staff and their routes are represented on the map',()=>{
  const actorNames=layers.Actors.map(o=>o.name);
  assert.equal(actorNames.length,8);
  assert.equal(new Set(actorNames).size,8);
  for(const name of ['Mr. Chen','Mrs. Chen','Wei Chen','Sibusiso Mkhize',
    'Thandeka Dlamini','Bongani Cele','Mandla Khumalo'])
      assert.ok(actorNames.includes(name),'Missing '+name);
  const workers=layers.Actors.filter(o=>o.type==='worker');
  assert.equal(workers.length,4);
  assert.ok(layers.Actors.some(o=>o.name==='Back-office clerk' && prop(o,'floor')==='staff'));

  assert.ok(workers.every(o=>String(prop(o,'route')).includes(';')));
});
test('scene is integrated into the active game, not published as a standalone throwaway demo',async()=>{
  const engine=await text('public/play/game.js');
  const html=await text('public/play/index.html');
  const scene=await text('public/play/shop.js');
  assert.match(engine,/shop: 'btnCampShop'/);
  assert.match(engine,/HeroShop\.start\(\)/);
  assert.match(engine,/HeroShop\.frame\(dt/);
  assert.match(html,/id="btnCampShop"/);
  assert.match(html,/\.\/shop\.js/);
  assert.match(scene,/maps\/home-and-more\.tmj/);
  assert.match(scene,/function collisionAt/);
  assert.match(scene,/function handPayslip/);
  assert.match(scene,/function talkMother/);
  assert.match(scene,/function animateActors/);
});

test('Staff Only door connects the sales floor and back-office map',async()=>{
  const portals=layers.Interactables.filter(o=>o.type==='office-door');
  const entrance=portals.find(o=>o.name==='STAFF ONLY · Back Office');
  const exit=portals.find(o=>o.name==='Sales floor · STAFF ONLY return');
  assert.ok(entrance);
  assert.ok(exit);
  assert.equal(prop(entrance,'floor'),'shop');
  assert.equal(prop(entrance,'destination'),'staffEntry');
  assert.equal(prop(exit,'floor'),'staff');
  assert.equal(prop(exit,'destination'),'staffReturn');
  for(const area of ['receiving / packing','toilets','staff canteen','lockers / changing','back office'])
    assert.ok(layers.Zones.some(o=>o.name===area && prop(o,'floor')==='staff'),area);
  assert.ok(layers.Fixtures.some(o=>o.type==='workbench' && prop(o,'floor')==='staff'));
  assert.ok(layers.Fixtures.some(o=>o.type==='locker' && prop(o,'floor')==='staff'));
  const scene=await text('public/play/shop.js');
  assert.match(scene,/staffEntry:\['staff'/);
  assert.match(scene,/staffReturn:\['shop'/);
  assert.match(scene,/floor==='staff'/);
  assert.match(scene,/KeyE/);
});

test('back-office circulation remains walkable between all rooms',()=>{
  const solid=new Set(['wall','shelf','till','glass-counter','counter','display','pallet',
    'sacks','furniture','desk','lift','table','chairs','cabinet','trolley','pallet-jack',
    'locker','workbench','toilet','fridge']);
  const blockers=Object.values(layers).flat().filter(o=>prop(o,'floor')==='staff' && solid.has(o.type));
  const blocked=(x,y)=>{
    if(x<326||x>1870||y<226||y>1072)return true;
    return blockers.some(o=>{
      const nearX=Math.max(o.x,Math.min(x,o.x+o.width));
      const nearY=Math.max(o.y,Math.min(y,o.y+o.height));
      return (x-nearX)**2+(y-nearY)**2<15**2;
    });
  };
  const step=10, start=[178,94], queue=[start], seen=new Set();
  const key=(x,y)=>x+','+y;
  for(let i=0;i<queue.length && i<80000;i++){
    const [x,y]=queue[i],k=key(x,y);
    if(seen.has(k))continue;
    seen.add(k);
    for(const [dx,dy] of [[1,0],[-1,0],[0,1],[0,-1]]){
      const nx=x+dx,ny=y+dy;
      if(!seen.has(key(nx,ny))&&!blocked(nx*step,ny*step))queue.push([nx,ny]);
    }
  }
  assert.ok(seen.has(key(...start)),'staff entry must be walkable');
  for(const [area,x,y] of [
    ['packing',151,35],['canteen',97,90],['upper toilet',57,81],
    ['lower toilet',55,94],['lockers',139,82],['office',163,74]
  ])assert.ok(seen.has(key(x,y)),area+' must be reachable from staff entrance');
});
