import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
const root = new URL('../', import.meta.url);
const read = async (path) => readFile(new URL(path, root), 'utf8');

test('received Gemini snapshot is archived with truncation disclosed', async () => {
  const source = await read('reference/gemini-incomplete-2026-11-19.txt');
  assert.match(source, /32-Bar Evolving 150 BPM Psytrance Engine/);
  assert.ok(source.length > 350_000);
  assert.doesNotMatch(source, /<\/html>/);
});

test('the game recovers the new mall, stealth, and fallen character features', async () => {
  const main = await read('src/main.js');
  const html = await read('index.html');
  for (const pattern of [/class Corpse\s*\{/, /function loadMallFloorGeometry\(floorId\)/,
    /function generateCBDWorld\(\)/, /function renderRadarTerrain\(\)/,
    /toggleSneak\(\)/, /function gameLoop\(timestamp\)/]) {
    assert.match(main, pattern);
  }
  assert.match(html, /id="btnSneak"/);
  assert.match(html, /id="titleScreen"/);
  assert.match(html, /id="monologueToast"/);
  assert.equal((main.match(/const sfx = createAudioEngine\(/g) || []).length, 1);
});

test('multichapter content and previous optimizations stay included', async () => {
  const main = await read('src/main.js');
  for (const label of ['training','mall','cbd','sniper','suburbs']) {
    assert.match(main, new RegExp(`camp === '${label}'|selectedCampaign === '${label}'`));
  }
  assert.match(main, /setHudHTML\(slotBarElement, slotsMarkup\)/);
  assert.match(main, /radarTerrainDirty = true/);
});
