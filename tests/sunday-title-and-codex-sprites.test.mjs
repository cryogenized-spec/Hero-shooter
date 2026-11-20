import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
const read=path=>readFile(new URL('../'+path,import.meta.url),'utf8');

test('title artwork loads under branch-source as well as dist Pages layouts',async()=>{
  const bytes=await readFile(new URL('../assets/title/hero-shooter-title.webp',import.meta.url));
  const canonical=await readFile(new URL('../public/assets/title/hero-shooter-title.webp',import.meta.url));
  assert.deepEqual(bytes,canonical);
  const html=await read('index.html');
  assert.match(html,/id="titleScreen"/);
  assert.match(html,/assets\/title\/hero-shooter-title\.webp/);
  for(const id of ['titleStart','titleContinue','titleOptions','titlePressStart'])assert.match(html,new RegExp('id="'+id+'"'));
});

test('only Home & More is publicly selectable, all old chapter sources still exist',async()=>{
  const title=await read('src/ui/title-screen.js');
  const engine=await read('public/play/game.js');
  const html=await read('public/play/index.html');
  const css=await read('public/play/styles.css');
  assert.match(title,/const CAMPAIGNS = new Set\(\['shop'\]\)/);
  assert.match(title,/url\.searchParams\.set\('autostart', '1'\)/);
  assert.match(title,/resume \? 'resume' : 'fresh'/);
  assert.match(engine,/currentCampaign = 'shop'/);
  assert.match(engine,/query\.get\('autostart'\) !== '1'/);
  assert.match(css,/\.legacy-hidden \{ display: none !important; \}/);
  for(const id of ['btnCampTraining','btnCampMall','btnCampCBD','btnCampSniper','btnCampSuburbs']){
    assert.match(html,new RegExp('id="'+id+'"'));
    assert.match(html,new RegExp('id="'+id+'"[^>]*class="legacy-hidden'));
  }
  for(const name of ['training','mall','cbd','sniper','suburbs']) assert.ok(engine.includes(name), 'Missing preserved '+name+' chapter');
});

test('the approved Codex renderer, not primitive circles, draws C and shop staff',async()=>{
  const sprite=await read('public/play/sprites.js');
  const shop=await read('public/play/shop.js');
  const html=await read('public/play/index.html');
  assert.match(sprite,/function drawMallCBody\(ctx, actor\)/);
  assert.match(sprite,/function drawHumanNpc\(/);
  assert.match(sprite,/function drawDogSprite/);
  assert.match(sprite,/function drawDog\(/);
  for (const role of ['chen','assistant','cashier','manager','security','looter','hostage_taker','looter_unarmed'])
    assert.ok(sprite.includes(role+':'), 'Missing Codex NPC palette for '+role);
  assert.match(sprite,/function updateSpriteWalk\(/);
  assert.match(sprite,/drawSpriteFootwork/);
  assert.match(sprite,/Olive flannel/);
  assert.match(sprite,/if \(actor\.weaponVisible\)/);
  assert.match(shop,/HeroSprites\.drawC\(ctx,p\)/);
  assert.match(shop,/HeroSprites\.drawNpc\(ctx,a,looks,prop\)/);
  assert.match(shop,/HeroSprites\.updateWalk\(state\.player/);
  assert.match(shop,/HeroSprites\.updateWalk\(a,beforeX/);
  assert.match(html,/\.\/sprites\.js[\s\S]*\.\/shop\.js[\s\S]*\.\/entry\.js/);
});

test('start and continue have durable in-shop save state',async()=>{
  const shop=await read('public/play/shop.js');
  assert.match(shop,/hero-shooter:home-and-more-save-v1/);
  assert.match(shop,/function saveProgress\(\)/);
  assert.match(shop,/function restoreProgress\(\)/);
  assert.match(shop,/query\.get\('fresh'\)/);
  assert.match(shop,/query\.get\('resume'\)/);
  assert.match(shop,/saveProgress\(\)/);
});
