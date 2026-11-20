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
