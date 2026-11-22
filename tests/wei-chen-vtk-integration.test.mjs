import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile, access} from 'node:fs/promises';
import vm from 'node:vm';

const read=path=>readFile(new URL('../'+path,import.meta.url),'utf8');
const atlasUrl=new URL('../public/play/assets/procedural/wei_chen_8dir_12row_atlas.png',import.meta.url);

test('Wei's real VTK model builder and dedicated runtime asset are wired by identity',async()=>{
  const script=await read('tools/render/wei_chen_3d.py');
  const sprite=await read('public/play/sprites.js');
  assert.match(script,/import vtk/);
  assert.match(script,/sculpt_head/);
  assert.match(script,/face_texture/);
  assert.match(sprite,/selected==='family-son'.*wei_chen_8dir_12row_atlas\.png/);
});

test('family-son uses the canonical eight-direction, three-gait atlas and neutral idle frame',async()=>{
  const s=await read('public/play/sprites.js');
  const drawn=[],urls=[];
  class MockImage {
    constructor(){this.complete=true;this.naturalWidth=256;this.naturalHeight=576;}
    set src(v){urls.push(v);}
  }
  const ctx={save(){},restore(){},drawImage(...args){drawn.push(args);}};
  const root={};
  vm.runInNewContext(s,{
    window:root,Image:MockImage,document:{baseURI:'https://example.test/play/'},
    URL,Math,Object,console,performance:{now:()=>123456}
  });
  const actor={name:'Wei Chen',x:300,y:300,angle:Math.PI/2,
    walkAngle:Math.PI/2,walkBlend:0,gait:'idle',idleClock:4,
    walkPhase:0,radius:14};
  for(let col=0;col<8;col++){
    const angle=Math.PI/2+col*Math.PI/4;
    for(const [gait,row] of [['idle',0],['walk',4],['run',8]]){
      for(let frame=0;frame<4;frame++){
        actor.angle=angle;actor.walkAngle=angle;actor.gait=gait;
        actor.walkBlend=gait==='idle'?0:1;
        actor.walkPhase=frame*Math.PI/2;
        root.HeroSprites.drawNpc(ctx,actor,'family-son');
        const d=drawn.at(-1);
        assert.equal(d[1],col*32,'direction '+col);
        assert.equal(d[2],(row+(gait==='idle'?0:frame))*48,'gait '+gait+' frame '+frame);
        assert.equal(d[3],32);
        assert.equal(d[4],48);
      }
    }
  }
  assert.equal(drawn.length,96);
  assert.equal(urls.length,1,'Wei sprite image should be cached');
  assert.ok(urls[0].endsWith('/assets/procedural/wei_chen_8dir_12row_atlas.png'));
});

test('Wei's shop walking route stays in the aisle north of the tills',async()=>{
  const map=JSON.parse(await read('public/play/maps/home-and-more.tmj'));
  const actors=map.layers.find(l=>l.name==='Actors').objects;
  const wei=actors.find(x=>x.name==='Wei Chen');
  assert.equal(wei.type,'family-son');
  const route=wei.properties.find(p=>p.name==='route')?.value;
  assert.ok(route);
  const coords=route.split(';').map(point=>point.split(',').map(Number));
  assert.ok(coords.length>=3);
  assert.deepEqual(coords[0],[wei.x,wei.y]);
  const fixtures=map.layers.find(l=>l.name==='Fixtures').objects;
  const solids=new Set(['shelf','till','glass-counter','counter','display','pallet','sacks','furniture','desk','lift','table','chairs','cabinet','trolley']);
  for(const [x,y] of coords){
    assert.ok(x>250&&x<2340&&y>180&&y<1680);
    const collision=fixtures.some(o=>solids.has(o.type)&&
      (x-Math.max(o.x,Math.min(x,o.x+o.width)))**2+
      (y-Math.max(o.y,Math.min(y,o.y+o.height)))**2<15**2);
    assert.ok(!collision,'Wei route must not intersect fixtures: '+x+','+y);
  }
});

test('Wei's generated atlas is a transparent 256x576 PNG (after render workflow)',async t=>{
  let b;
  try { b=await readFile(atlasUrl); }
  catch(e){ if(e.code==='ENOENT')return t.skip('binary is produced by render-wei-chen workflow'); throw e; }
  assert.equal(b.subarray(0,8).toString('hex'),'89504e470d0a1a0a');
  assert.equal(b.readUInt32BE(16),256);
  assert.equal(b.readUInt32BE(20),576);
  assert.equal(b[25],6,'PNG should include alpha');
});
