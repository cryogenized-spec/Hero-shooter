import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile, stat } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createWeapons } from '../src/data/weapons.js';
import { Math2 } from '../src/core/math.js';
import { getPortraitSVG } from '../src/ui/portraits.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (path) => readFile(join(root, path), 'utf8');

test('original Gemini revision is preserved byte-for-byte', async () => {
  const original = await readFile(join(root, 'reference/gemini-original-2026-11-19.html'));
  const expected = (await read('reference/original.sha256')).trim().split(' ')[0];
  assert.equal(createHash('sha256').update(original).digest('hex'), expected);
});

test('five chapter definitions remain available', () => {
  for (const chapter of ['training', 'mall', 'cbd', 'sniper', 'suburbs']) {
    const weapons = createWeapons(chapter);
    assert.ok(weapons.length >= 3, chapter);
    assert.ok(weapons.some(w => w.unlocked), chapter);
  }
});

test('essential game and portrait interfaces are present', async () => {
  const html = await read('index.html');
  const js = await read('src/main.js');
  assert.match(html, /type="module" src="\.\/src\/title-entry\.js"/);
  // The complete original game engine remains in source, but is not booted on the title page.
  assert.match(html, /id="campTrainingBtn"/);
  assert.match(html, /id="campMallBtn"/);
  assert.match(js, /generateWoodlandWorld\(\)/);
  assert.match(js, /requestAnimationFrame\(gameLoop\)/);
  assert.match(getPortraitSVG('mall'), /<svg/);
  assert.equal(Math2.clamp(14, 0, 10), 10);
});

test('cinematic art stored separately', async () => {
  const img = await stat(join(root, 'public/assets/cutscenes/mall/yael-portrait.webp'));
  assert.ok(img.size > 10_000 && img.size < 300_000);
});
