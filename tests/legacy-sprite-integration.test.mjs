import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const read = (path) => readFile(new URL('../' + path, import.meta.url), 'utf8');

test('legacy campaign sprite integration retains its own character and NPC visuals', async () => {
  const game = await read('public/play/game.js');
  for (const name of ['drawHumanNpc','drawDogSprite','drawMallCFeet','drawMallCBody','updateSpriteWalk']) {
    assert.match(game, new RegExp('(?:function|\\s)' + name + '\\('), 'Missing sprite helper: ' + name);
  }
  assert.match(game, /NPC_SPRITE_COLORS/);
  assert.match(game, /this\.gender === 'israeli_c'/);
  assert.match(game, /this\.walkBlend/);
  assert.match(game, /drawHumanNpc\(ctx, this, colors, outline, pose, prop, thermalActive\)/);
});

test('sprite port does not regress condition recovery or debug-only enemy sight cones', async () => {
  const game = await read('public/play/game.js');
  assert.match(game, /this\.stamina = Math\.min\(100, this\.stamina \+ 24 \* dt \* resources\)/);
  assert.match(game, /window\.HERO_DEBUG_VISION === true/);
  assert.match(game, /updateSpriteWalk\(this, previousX, previousY, dt/);
  assert.match(game, /function updateNpc\(npc, dt\)/);
});

test('active Sunday shop uses its independent modern renderer', async () => {
  const shop = await read('public/play/shop.js');
  const active = await read('public/play/sprites.js');
  const entry = await read('public/play/index.html');
  assert.match(entry, /src="\.\/sprites\.js"/);
  assert.match(entry, /src="\.\/entry\.js"/);
  assert.doesNotMatch(entry, /<script[^>]*src="\.\/game\.js"/);
  assert.match(shop, /HeroSprites\.drawC\(ctx,p\)/);
  assert.match(active, /function drawCHead\(ctx, goggles\)/);
});
