import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
const read=(path)=>readFile(new URL('../'+path,import.meta.url),'utf8');

test('Saafiya equipped atlas is complete and correctly dimensioned',async()=>{
  const svg=await read('public/play/saafiya-equipped.svg');
  assert.match(svg,/width="256" height="576"/);
  assert.match(svg,/data:image\/png;base64,iVBORw0KGgo/);
});

test('Saafiya aliases, concealed and visible Beretta, pistol prop and explicit art key choose correct atlases',async()=>{
  const source=await read('public/play/sprites.js');
  const draws=[],urls=[];
  class MockImage {
    constructor(){this.complete=true;this.naturalWidth=256;}
    set src(v){urls.push(v);}
  }
  const ctx=new Proxy({drawImage(...args){draws.push(args);}}, {get(obj,key){return key in obj?obj[key]:()=>{};}});
  const root={};
  vm.runInNewContext(source,{window:root,Image:MockImage,document:{baseURI:'https://example.test/play/'},
    URL,Math,Object,console,performance:{now:()=>0}});
  const actor={name:'Saafiya',x:200,y:210,angle:Math.PI/2,walkAngle:Math.PI/2,
    gait:'idle',walkPhase:0,walkBlend:0,idleClock:0,radius:14,weaponVisible:false};
  root.HeroSprites.drawNpc(ctx,actor,'assistant');
  assert.ok(urls.at(-1).endsWith('/saafiya.svg'));
  actor.weaponVisible=true;actor.weaponId='beretta-84fs';
  root.HeroSprites.drawNpc(ctx,actor,'assistant');
  assert.ok(urls.at(-1).endsWith('/saafiya-equipped.svg'));
  actor.weaponVisible=false;actor.weaponId=null;
  root.HeroSprites.drawNpc(ctx,{...actor,name:'Sophia'},'assistant','pistol');
  root.HeroSprites.drawNpc(ctx,{...actor,name:'Sofia'},'assistant','none');
  root.HeroSprites.drawNpc(ctx,{...actor,name:'Other',meta:{sprite:'saafiya-equipped'}},'assistant');
  assert.equal(draws.length,5);
  assert.deepEqual(urls,[
    'https://example.test/play/saafiya.svg',
    'https://example.test/play/saafiya-equipped.svg']);
  root.HeroSprites.drawNpc(ctx,{...actor,weaponVisible:true,weaponId:'glock26'},'assistant');
  assert.equal(draws.length,5,'Known non-Beretta should use procedural fallback');
});

test('Saafiya equipped atlas supports all 96 direction-gait-frame combinations',async()=>{
  const source=await read('public/play/sprites.js');
  const draws=[];
  class MockImage {
    constructor(){this.complete=true;this.naturalWidth=256;}
    set src(v){this.url=v;}
  }
  const ctx={save(){},restore(){},drawImage(...args){draws.push(args);}};
  const root={};
  vm.runInNewContext(source,{window:root,Image:MockImage,document:{baseURI:'https://example.test/play/'},
    URL,Math,Object,console,performance:{now:()=>0}});
  const actor={name:'Saafiya',x:200,y:210,angle:Math.PI/2,walkAngle:Math.PI/2,
    gait:'idle',walkPhase:0,walkBlend:0,idleClock:0,radius:14,weaponVisible:true,weaponId:'beretta84fs'};
  for(let gait=0;gait<3;gait++)for(let direction=0;direction<8;direction++)for(let frame=0;frame<4;frame++){
    actor.gait=['idle','walk','run'][gait];
    actor.angle=Math.PI/2+direction*Math.PI/4;
    actor.walkAngle=actor.angle;actor.walkBlend=gait===0?0:1;
    actor.idleClock=frame/3;actor.walkPhase=frame*Math.PI/2;
    root.HeroSprites.drawNpc(ctx,actor,'assistant');
    const d=draws.at(-1);
    assert.equal(d[1],direction*32);
    assert.equal(d[2],(gait*4+frame)*48);
  }
  assert.equal(draws.length,96);
});
