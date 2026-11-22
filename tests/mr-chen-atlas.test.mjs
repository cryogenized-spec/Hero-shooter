import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';

const read=(path)=>readFile(new URL('../'+path,import.meta.url),'utf8');

test('Mr Chen has a transparent eight-direction, three-gait atlas',async()=>{
  const svg=await read('public/play/mr-chen.svg');
  assert.match(svg,/width="256" height="576"/);
  assert.match(svg,/data:image\/png;base64,iVBORw0KGgo/);
});

test('family-father selects Mr Chen artwork for all 96 direction and gait frames',async()=>{
  const s=await read('public/play/sprites.js');
  const drawn=[],urls=[];
  class MockImage {
    constructor(){this.complete=true;this.naturalWidth=256;}
    set src(v){this.url=v;urls.push(v);}
  }
  const ctx={save(){},restore(){},drawImage(...args){drawn.push(args);}};
  const root={};
  vm.runInNewContext(s,{window:root,Image:MockImage,
    document:{baseURI:'https://example.test/play/'},URL,Math,Object,console,
    performance:{now:()=>0}});
  const actor={name:'Mr. Chen',radius:14,x:200,y:210,angle:Math.PI/2,
    walkAngle:Math.PI/2,walkBlend:0,gait:'idle',idleClock:0,walkPhase:0};
  for (let gait=0;gait<3;gait++){
    for(let col=0;col<8;col++){
      for(let frame=0;frame<4;frame++){
        actor.gait=['idle','walk','run'][gait];
        actor.angle=Math.PI/2+col*Math.PI/4;
        actor.walkAngle=actor.angle;
        actor.walkBlend=gait===0?0:1;
        actor.idleClock=frame/3;
        actor.walkPhase=frame*Math.PI/2;
        root.HeroSprites.drawNpc(ctx,actor,'family-father');
        const d=drawn.at(-1);
        assert.equal(d[1],col*32,'Direction '+col);
        assert.equal(d[2],(gait*4+frame)*48,'Gait/frame '+gait+'/'+frame);
        assert.equal(d[3],32);
        assert.equal(d[4],48);
      }
    }
  }
  assert.equal(drawn.length,96);
  assert.equal(urls.length,1);
  assert.ok(urls[0].endsWith('/mr-chen.svg'));
  root.HeroSprites.drawNpc(ctx,{...actor,name:'Unlabelled parent',meta:{sprite:'family-father'}},'assistant');
  assert.equal(drawn.length,97,'Explicit Tiled sprite key resolves Mr Chen artwork');
});

test('Saafiya and Sophia continue using their own atlas, not Mr Chen artwork',async()=>{
  const source=await read('public/play/sprites.js');
  const drawn=[],urls=[];
  class MockImage{
    constructor(){this.complete=true;this.naturalWidth=256;}
    set src(v){this.url=v;urls.push(v);}
  }
  const ctx={save(){},restore(){},drawImage(...args){drawn.push(args);}};
  const root={};
  vm.runInNewContext(source,{window:root,Image:MockImage,document:{baseURI:'https://example.test/play/'},URL,console,Math,Object,performance:{now:()=>0}});
  for(const name of ['Saafiya','Sophia','Sofia']){
    root.HeroSprites.drawNpc(ctx,{name,x:160,y:110,angle:Math.PI/2,walkAngle:Math.PI/2,
      walkPhase:0,walkBlend:0,idleClock:0,gait:'idle',radius:14},'assistant');
  }
  assert.equal(drawn.length,3);
  assert.deepEqual(urls,['https://example.test/play/assets/procedural/saafiya_walk_8way_8frame_atlas.webp']);
});

test('current Tiled shop assigns the correct family roles, not generic employee roles',async()=>{
  const map=JSON.parse(await read('public/play/maps/home-and-more.tmj'));
  const actors=map.layers.find(l=>l.name==='Actors').objects;
  assert.equal(actors.find(a=>a.name==='Mr. Chen')?.type,'family-father');
  assert.equal(actors.find(a=>a.name==='Mrs. Chen')?.type,'family-mother');
  assert.equal(actors.find(a=>a.name==='Wei Chen')?.type,'family-son');
});
