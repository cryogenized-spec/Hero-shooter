import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
import {drawArmedC} from '../src/armed-c.js';

const read = path => readFile(new URL('../'+path, import.meta.url), 'utf8');
const headings = [
  {name:'South',deg:90,column:0},
  {name:'Southwest',deg:135,column:1},
  {name:'West',deg:180,column:2},
  {name:'Northwest',deg:225,column:3},
  {name:'North',deg:270,column:4},
  {name:'Northeast',deg:315,column:5},
  {name:'East',deg:0,column:6},
  {name:'Southeast',deg:45,column:7}
];
const rad=deg=>deg*Math.PI/180;

async function makeRenderer(){
  const source=await read('public/play/sprites.js');
  const images=[],drawn=[],root={};
  class MockImage{
    constructor(){this.complete=true;this.naturalWidth=320;}
    set src(value){images.push(value);}
  }
  const ctx={save(){},restore(){},translate(){},rotate(){},scale(){},
    drawImage(...args){drawn.push(args);}};
  vm.runInNewContext(source,{
    window:root,Image:MockImage,document:{baseURI:'https://example.test/play/'},
    URL,Math,Object,console,performance:{now:()=>0}
  });
  return {root,ctx,drawn,images};
}

test('screen-space angle contract: zero is East, clockwise turns toward South',()=>{
  const vectors=[
    [1,0,0,'E'],[1,1,45,'SE'],[0,1,90,'S'],[-1,1,135,'SW'],
    [-1,0,180,'W'],[-1,-1,-135,'NW'],[0,-1,-90,'N'],[1,-1,-45,'NE']
  ];
  for(const [dx,dy,expected,label] of vectors){
    assert.ok(Math.abs(Math.atan2(dy,dx)-rad(expected))<1e-9,label);
  }
  for(const {name,deg,column} of headings){
    for(const wrap of [-720,-360,0,360,720]){
      const angle=rad(deg+wrap);
      const index=((Math.round((angle-Math.PI/2)/(Math.PI/4))%8)+8)%8;
      assert.equal(index,column,name+' '+wrap);
    }
  }
});

test('the civilian C atlas keeps the exact bearing column for each travel heading',async()=>{
  const {root,ctx,drawn}=await makeRenderer();
  const c={x:160,y:110,angle:0,walkAngle:0,walkPhase:0,walkBlend:1,
    gait:'walk',radius:15,weaponVisible:false,weaponId:null,
    nvgEquipped:false,hasMolleVest:false,idleClock:0};
  for(const h of headings){
    c.angle=rad((h.deg+180)%360); // A separate aim/pose angle must not override travel direction.
    c.walkAngle=rad(h.deg);
    root.HeroSprites.drawC(ctx,c);
    assert.equal(drawn.at(-1)[1],h.column*32,'C moving '+h.name);
    assert.equal(drawn.at(-1)[3],32);
  }
  c.gait='idle';c.angle=0;
  for(const h of headings){
    c.lastTravelFacing=rad(h.deg);
    root.HeroSprites.drawC(ctx,c);
    assert.equal(drawn.at(-1)[1],h.column*32,'C idle last-facing '+h.name);
  }
});

test('armed C atlas uses aim angle and never transposes E/W or N/S',async()=>{
  const {root,ctx,drawn}=await makeRenderer();
  const c={x:160,y:110,angle:0,walkAngle:rad(180),walkPhase:0,
    walkBlend:1,gait:'walk',radius:15,weaponVisible:true,weaponId:'glock26',
    nvgEquipped:false,hasMolleVest:false,idleClock:0};
  for(const h of headings){
    c.angle=rad(h.deg);
    root.HeroSprites.drawC(ctx,c);
    assert.equal(drawn.at(-1)[1],h.column*40,'C Glock aiming '+h.name);
    assert.equal(drawn.at(-1)[3],40);
  }
});

test('NPC atlas uses actor facing when idle and travel direction when moving',async()=>{
  const {root,ctx,drawn}=await makeRenderer();
  const actor={name:'Mr. Chen',x:160,y:110,radius:14,angle:0,
    walkAngle:0,walkPhase:0,walkBlend:0,gait:'idle',idleClock:0};
  for(const h of headings){
    actor.angle=rad(h.deg);
    actor.walkAngle=rad((h.deg+90)%360);
    root.HeroSprites.drawNpc(ctx,actor,'family-father');
    assert.equal(drawn.at(-1)[1],h.column*32,'NPC idle '+h.name);
  }
  actor.gait='walk';actor.walkBlend=1;
  for(const h of headings){
    actor.angle=rad((h.deg+90)%360);
    actor.walkAngle=rad(h.deg);
    root.HeroSprites.drawNpc(ctx,actor,'family-father');
    assert.equal(drawn.at(-1)[1],h.column*32,'NPC moving '+h.name);
  }
});

test('training Glock 26 also respects the eight compass bearings',()=>{
  const originalImage=globalThis.Image,originalLocation=globalThis.location;
  const drawn=[];
  globalThis.Image=class{constructor(){this.complete=true;this.naturalWidth=320;}set src(v){this.srcValue=v;}};
  globalThis.location={pathname:'/Hero-shooter/public/training/index.html'};
  const ctx={save(){},restore(){},translate(){},scale(){},drawImage(...args){drawn.push(args);}};
  try{
    const c={gender:'mall',x:100,y:110,angle:0,walkPhase:0,walkBlend:1,slideTime:0};
    for(const h of headings){
      c.angle=rad(h.deg);
      assert.equal(drawArmedC(ctx,c,{id:'glock26'}),true);
      assert.equal(drawn.at(-1)[1],h.column*40,'training Glock '+h.name);
    }
  }finally{
    if(originalImage===undefined)delete globalThis.Image;
    else globalThis.Image=originalImage;
    if(originalLocation===undefined)delete globalThis.location;
    else globalThis.location=originalLocation;
  }
});

test('project documents and agent skill explicitly preserve the orientation contract',async()=>{
  const guide=await read('docs/art/sprite-bearing-contract.md');
  const root=await read('AGENTS.md');
  const skill=await read('.agents/skills/hero-sprite-bearings/SKILL.md');
  assert.match(guide,/0°.*East/);
  assert.match(guide,/South.*Southwest.*West.*Northwest.*North.*Northeast.*East.*Southeast/);
  assert.match(guide,/\+Y.*down/i);
  assert.match(root,/sprite-bearing-contract\.md/);
  assert.match(root,/hero-sprite-bearings\/SKILL\.md/);
  assert.match(skill,/name: hero-sprite-bearings/);
});
