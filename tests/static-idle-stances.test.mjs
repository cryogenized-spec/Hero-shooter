import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
import {drawArmedC} from '../src/armed-c.js';

const read=path=>readFile(new URL('../'+path,import.meta.url),'utf8');

async function renderer(){
  const draws=[],loaded=[],root={};
  class MockImage{
    constructor(){this.complete=true;this.naturalWidth=320;}
    set src(url){loaded.push(url);}
  }
  const ctx={save(){},restore(){},translate(){},rotate(){},scale(){},drawImage(...args){draws.push(args);}};
  vm.runInNewContext(await read('public/play/sprites.js'),{
    window:root,Image:MockImage,document:{baseURI:'https://example.test/play/'},
    URL,Math,Object,console,performance:{now:()=>12345678}
  });
  return {root,ctx,draws,loaded};
}

test('C returns to a neutral idle pose independent of time and previous stride',async()=>{
  const {root,ctx,draws}=await renderer();
  const actor={x:100,y:110,angle:Math.PI/2,walkAngle:Math.PI/2,
    gait:'walk',walkPhase:Math.PI/2,walkBlend:1,radius:15,
    weaponVisible:false,hasMolleVest:false,nvgEquipped:false,idleClock:200};
  root.HeroSprites.drawC(ctx,actor);
  assert.equal(draws.at(-1)[2],5*48,'walk uses the moving frame');
  actor.gait='idle';actor.idleClock=300;actor.walkPhase=3*Math.PI/2;
  for(let i=0;i<6;i++){
    root.HeroSprites.drawC(ctx,actor);
    assert.equal(draws.at(-1)[2],0,'idle always displays neutral frame 0');
    actor.idleClock+=10;
  }
  root.HeroSprites.updateWalk(actor,actor.x,actor.y,.016,88,18);
  assert.equal(actor.walkPhase,0,'walking phase resets on a stationary tick');
  actor.gait='run';actor.walkPhase=Math.PI;
  root.HeroSprites.drawC(ctx,actor);
  assert.equal(draws.at(-1)[2],10*48,'running selects the run row');
});

test('armed C idle in the Sunday shop stays static while aim angle may rotate',async()=>{
  const {root,ctx,draws}=await renderer();
  const actor={x:100,y:110,angle:Math.PI/2,walkAngle:Math.PI/2,walkBlend:0,
    walkPhase:Math.PI,gait:'idle',idleClock:500,radius:15,weaponVisible:true,
    weaponId:'glock26',hasMolleVest:false,nvgEquipped:false};
  for(let direction=0;direction<8;direction++){
    actor.angle=Math.PI/2+direction*Math.PI/4;
    root.HeroSprites.drawC(ctx,actor);
    assert.equal(draws.at(-1)[1],direction*40);
    assert.equal(draws.at(-1)[2],0);
  }
});

test('stationary NPCs preserve their heading and show a neutral pose',async()=>{
  const {root,ctx,draws}=await renderer();
  const actor={name:'Mr. Chen',x:100,y:110,angle:Math.PI/2,walkAngle:Math.PI/2,
    radius:14,gait:'idle',walkBlend:0.7,walkPhase:2,idleClock:1000};
  root.HeroSprites.drawNpc(ctx,actor,'family-father');
  assert.equal(draws.at(-1)[2],0);
  actor.walkBlend=.02;actor.walkPhase=4;actor.idleClock=3000;
  root.HeroSprites.drawNpc(ctx,actor,'family-father');
  assert.equal(draws.at(-1)[2],0);
  actor.gait='walk';actor.walkPhase=Math.PI/2;
  root.HeroSprites.drawNpc(ctx,actor,'family-father');
  assert.equal(draws.at(-1)[2],5*48);
  actor.gait='idle';actor.walkPhase=3;
  root.HeroSprites.drawNpc(ctx,actor,'family-father');
  assert.equal(draws.at(-1)[2],0);
  actor.idlePoseFrame=2; // Only the art-review control may select alternate static poses.
  root.HeroSprites.drawNpc(ctx,actor,'family-father');
  assert.equal(draws.at(-1)[2],2*48);
});

test('training Glock renderer remains still when no movement occurs',()=>{
  const original=globalThis.Image;
  const originalLocation=globalThis.location;
  const draws=[];
  globalThis.Image=class {constructor(){this.complete=true;this.naturalWidth=320;}set src(v){this.url=v;}};
  globalThis.location={pathname:'/Hero-shooter/public/training/index.html'};
  const ctx={save(){},restore(){},translate(){},scale(){},drawImage(...args){draws.push(args);}};
  try{
    const actor={gender:'mall',x:100,y:100,angle:Math.PI/2,walkBlend:0,walkPhase:3,
      sprinting:false,slideTime:0,idleClock:100};
    assert.equal(drawArmedC(ctx,actor,{id:'glock26'}),true);
    assert.equal(draws.at(-1)[2],0);
    actor.idleClock=999;
    drawArmedC(ctx,actor,{id:'glock26'});
    assert.equal(draws.at(-1)[2],0);
    actor.walkBlend=1;actor.walkPhase=Math.PI/2;
    drawArmedC(ctx,actor,{id:'glock26'});
    assert.equal(draws.at(-1)[2],5*48);
    actor.walkBlend=0;
    drawArmedC(ctx,actor,{id:'glock26'});
    assert.equal(draws.at(-1)[2],0);
  }finally{
    if(original===undefined)delete globalThis.Image;else globalThis.Image=original;
    if(originalLocation===undefined)delete globalThis.location;else globalThis.location=originalLocation;
  }
});

test('shop and range motion state is derived from travel, never wall-clock idle animation',async()=>{
  const shop=await read('public/play/shop.js');
  const training=await read('public/training/range.js');
  const sprites=await read('public/play/sprites.js');
  assert.match(shop,/gait=Math\.hypot\(a\.x-beforeX,a\.y-beforeY\)>0\.01\?'walk':'idle'/);
  assert.match(training,/player\.walkPhase=0; \/\/ No stuck mid-stride pose/);
  assert.doesNotMatch(sprites,/performance\.now\(\)\/1000\)\*3/);
});
