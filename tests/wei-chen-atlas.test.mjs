import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';

const read=(path)=>readFile(new URL('../'+path,import.meta.url),'utf8');

test('Wei Chen atlas has 8 directions, 3 gaits, and 4 frames',async()=>{
  const svg=await read('public/play/wei-chen.svg');
  assert.match(svg,/width="256" height="576"/);
  assert.match(svg,/data:image\/png;base64,iVBORw0KGgo/);
});

test('family-son selection covers all 96 frames without affecting Mr Chen',async()=>{
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
  const actor={name:'Wei Chen',radius:14,x:200,y:210,angle:Math.PI/2,
    walkAngle:Math.PI/2,walkBlend:0,gait:'idle',idleClock:0,walkPhase:0};
  for(let gait=0;gait<3;gait++)for(let direction=0;direction<8;direction++)for(let frame=0;frame<4;frame++){
    actor.gait=['idle','walk','run'][gait];
    actor.angle=Math.PI/2+direction*Math.PI/4;
    actor.walkAngle=actor.angle;
    actor.walkBlend=gait===0?0:1;
    actor.idleClock=frame/3;
    actor.walkPhase=frame*Math.PI/2;
    root.HeroSprites.drawNpc(ctx,actor,'family-son');
    const d=draws.at(-1);
    assert.equal(d[1],direction*32);
    assert.equal(d[2],(gait*4+frame)*48);
    assert.equal(d[3],32);
    assert.equal(d[4],48);
  }
  assert.equal(draws.length,96);
  assert.deepEqual(urls,['https://example.test/play/wei-chen.svg']);
  root.HeroSprites.drawNpc(ctx,{...actor,name:'Unlabelled son',meta:{sprite:'family-son'}},'assistant');
  assert.equal(draws.length,97);
  root.HeroSprites.drawNpc(ctx,{...actor,name:'Mr. Chen'},'family-father');
  assert.equal(draws.length,98);
  assert.ok(urls.at(-1).endsWith('/mr-chen.svg'));
  assert.equal(urls.length,2);
});

test('Tiled Wei Chen retains family-son identity and shop location',async()=>{
  const map=JSON.parse(await read('public/play/maps/home-and-more.tmj'));
  const actor=map.layers.find(layer=>layer.name==='Actors').objects.find(a=>a.name==='Wei Chen');
  assert.equal(actor?.type,'family-son');
  assert.ok(actor?.properties.some(p=>p.name==='floor' && p.value==='shop'));
});
