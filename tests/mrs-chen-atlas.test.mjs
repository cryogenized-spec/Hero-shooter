import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';

const read=(path)=>readFile(new URL('../'+path,import.meta.url),'utf8');
test('Mrs Chen directional atlas contains 96 properly sized cells',async()=>{
  const svg=await read('public/play/mrs-chen.svg');
  assert.match(svg,/width="256" height="576"/);
  assert.match(svg,/data:image\/png;base64,iVBORw0KGgo/);
});
test('family-mother atlas renders all 96 cells and stays distinct from the family son and father',async()=>{
  const source=await read('public/play/sprites.js');
  const draws=[], urls=[];
  class MockImage {
    constructor(){this.complete=true;this.naturalWidth=256;}
    set src(v){urls.push(v);}
  }
  const ctx={save(){},restore(){},translate(){},rotate(){},scale(){},drawImage(...args){draws.push(args);}};
  const root={};
  vm.runInNewContext(source,{window:root,Image:MockImage,document:{baseURI:'https://example.test/play/'},
    URL,Math,Object,console,performance:{now:()=>0}});
  const actor={name:'Mrs. Chen',radius:14,x:200,y:210,angle:Math.PI/2,
    walkAngle:Math.PI/2,walkBlend:0,gait:'idle',idleClock:0,walkPhase:0};
  for(let gait=0;gait<3;gait++)for(let direction=0;direction<8;direction++)for(let frame=0;frame<4;frame++){
    actor.gait=['idle','walk','run'][gait];
    actor.angle=Math.PI/2+direction*Math.PI/4;
    actor.walkAngle=actor.angle;
    actor.walkBlend=gait===0?0:1;
    actor.idleClock=frame/3;
    actor.walkPhase=frame*Math.PI/2;
    root.HeroSprites.drawNpc(ctx,actor,'family-mother');
    const d=draws.at(-1);
    assert.equal(d[1],direction*32);
    assert.equal(d[2],(gait*4+frame)*48);
    assert.equal(d[3],32);
    assert.equal(d[4],48);
  }
  assert.equal(draws.length,96);
  assert.deepEqual(urls,['https://example.test/play/mrs-chen.svg']);
  root.HeroSprites.drawNpc(ctx,{...actor,name:'Unlabelled mother',meta:{sprite:'family-mother'}},'assistant');
  assert.equal(draws.length,97);
  root.HeroSprites.drawNpc(ctx,{...actor,name:'Wei Chen'},'family-son');
  root.HeroSprites.drawNpc(ctx,{...actor,name:'Mr. Chen'},'family-father');
  assert.deepEqual(urls,[
    'https://example.test/play/mrs-chen.svg',
    'https://example.test/play/wei-chen.svg',
    'https://example.test/play/mr-chen.svg']);
});
test('Tiled Mrs. Chen remains office payroll actor',async()=>{
  const map=JSON.parse(await read('public/play/maps/home-and-more.tmj'));
  const actor=map.layers.find(layer=>layer.name==='Actors').objects.find(a=>a.name==='Mrs. Chen');
  assert.equal(actor?.type,'family-mother');
  assert.ok(actor?.properties.some(p=>p.name==='floor' && p.value==='office'));
  assert.ok(actor?.properties.some(p=>p.name==='role' && p.value==='payroll'));
});
