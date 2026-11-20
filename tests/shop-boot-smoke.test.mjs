import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
const read = path => readFile(new URL('../'+path,import.meta.url),'utf8');

function noop() {}
function mockCanvas() {
  const methods = ['save','restore','translate','rotate','scale','beginPath','ellipse',
    'fill','stroke','roundRect','moveTo','lineTo','fillRect','strokeRect',
    'bezierCurveTo','quadraticCurveTo','closePath'];
  const ctx=Object.fromEntries(methods.map(m=>[m,noop]));
  return ctx;
}
test('Codex approved C and worker sprites render first frame without JavaScript errors', async () => {
  const source=await read('public/play/sprites.js');
  const window={};
  vm.runInNewContext(source,{window,console,Math,Object});
  const ctx=mockCanvas();
  const actor={x:100,y:120,angle:0,radius:15,walkPhase:0,walkBlend:0,
    walkAngle:0,isSneaking:false,hasMolleVest:false,weaponVisible:false,
    flashlightOn:false,woundedSpeedFactor:1};
  assert.doesNotThrow(()=>window.HeroSprites.drawC(ctx,actor));
  assert.doesNotThrow(()=>window.HeroSprites.drawNpc(ctx,{...actor},'assistant'));
  assert.doesNotThrow(()=>window.HeroSprites.drawNpc(ctx,{...actor},'manager'));
});
test('branch Pages fallback cannot erase URL query before autostart',async()=>{
  const fallback=await read('play/index.html');
  assert.doesNotMatch(fallback,/http-equiv=["']refresh["']/i);
  assert.match(fallback,/destination\.search = window\.location\.search/);
  assert.match(fallback,/window\.location\.replace\(destination\.href\)/);
});
test('main menu uses artwork hotspots, not the old game engine',async()=>{
  const html=await read('index.html');
  const title=await read('src/ui/title-screen.js');
  assert.match(html,/title-hit title-hit-start/);
  assert.match(html,/title-hit title-hit-continue/);
  assert.match(html,/title-hit title-hit-options/);
  assert.match(html,/src\/title-entry\.js/);
  assert.doesNotMatch(html,/<script[^>]+src="\.\/src\/main\.js"/);
  assert.match(title,/url\.searchParams\.set\('autostart', '1'\)/);
});
test('shop boot is lightweight, old campaign still archived intact',async()=>{
  const html=await read('public/play/index.html');
  const entry=await read('public/play/entry.js');
  const game=await read('public/play/game.js');
  assert.match(html,/src="\.\/entry\.js"/);
  assert.doesNotMatch(html,/<script[^>]+src="\.\/game\.js"/);
  assert.match(entry,/HeroShop\.start\(\)/);
  assert.match(entry,/HeroShop\.frame\(dt/);
  assert.match(entry,/shopConversation/);
  assert.match(game,/function generateWorld\(camp\)/);
  assert.match(game,/function gameLoop\(timestamp\)/);
});

test('actual Home & More first gameplay frame renders from its committed Tiled map',async()=>{
  const source=await read('public/play/sprites.js');
  const scene=await read('public/play/shop.js');
  const map=JSON.parse(await read('public/play/maps/home-and-more.tmj'));
  const elements=new Map();
  const element=(id)=>{
    if(!elements.has(id)) elements.set(id,{
      id,hidden:true,textContent:'',style:{},
      classList:{add:noop,remove:noop},replaceChildren:noop,
      addEventListener:noop
    });
    return elements.get(id);
  };
  const document={
    body:{classList:{add:noop,remove:noop}},
    getElementById:element
  };
  const root={
    document,addEventListener:noop,localStorage:{getItem:()=>null,setItem:noop,removeItem:noop},
    location:{search:'?fresh=1'},console
  };
  const environment={
    window:root,document,fetch:async()=>({ok:true,json:async()=>map}),
    console,Math,Object,Number,JSON,String,Set,URLSearchParams
  };
  vm.runInNewContext(source,environment);
  vm.runInNewContext(scene,environment);
  await root.HeroShop.start();
  const ctx=mockCanvas();
  ctx.setTransform=noop;
  ctx.arc=noop;ctx.fillText=noop;ctx.fillRect=noop;
  ctx.measureText=(value)=>({width:String(value).length*7});
  ctx.createRadialGradient=()=>({addColorStop:noop});
  const input={keys:{},leftStick:{active:false,dx:0,dy:0}};
  assert.doesNotThrow(()=>root.HeroShop.frame(0.016,{ctx,width:1100,height:690,input}));
  input.keys.KeyW=true;
  assert.doesNotThrow(()=>root.HeroShop.frame(0.016,{ctx,width:1100,height:690,input}));
  assert.equal(element('shopLayer').hidden,false);
  assert.match(element('shopFloor').textContent,/SALES FLOOR/);
});

test('lightweight entry starts the Sunday map without loading or selecting a legacy chapter',async()=>{
  const entry=await read('public/play/entry.js');
  const jobs=[];
  let starts=0,frames=0;
  const canvas={width:0,height:0,getContext:()=>mockCanvas()};
  const elements={
    gameCanvas:canvas,shopConversation:{hidden:true},
    shopNotice:{style:{},textContent:''},
    shopLayer:{hidden:true}
  };
  const root={
    location:{href:'https://example.org/Hero-shooter/public/play/index.html?autostart=1&fresh=1',
      pathname:'/Hero-shooter/public/play/index.html',search:'?autostart=1&fresh=1',
      replace:noop,assign:noop},
    document:{readyState:'complete',body:{classList:{add:noop}},
      getElementById:(id)=>elements[id]},
    HeroShop:{start:()=>{starts++},frame:()=>{frames++},keydown:noop,stop:noop},
    HeroSprites:{},addEventListener:noop,
    performance:{now:()=>0},innerWidth:1024,innerHeight:768,
    requestAnimationFrame:(fn)=>{jobs.push(fn)},console
  };
  vm.runInNewContext(entry,{window:root,URL,URLSearchParams,Math,Object,console,Error});
  assert.equal(starts,1);
  assert.equal(canvas.width,1024);
  assert.equal(jobs.length,1);
  jobs[0](16);
  assert.equal(frames,1);
  assert.equal(jobs.length,2);
});
