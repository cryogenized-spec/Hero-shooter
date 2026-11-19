import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile, stat } from 'node:fs/promises';

const root = new URL('../', import.meta.url);
const read = path => readFile(new URL(path, root));

test('Phoenix, Arise! is the exact approved 181-second MP3, not a substitute', async () => {
  const audio = await read('public/assets/music/phoenix-arise.mp3');
  assert.equal(audio.length, 4360553);
  assert.equal(
    createHash('sha256').update(audio).digest('hex'),
    '17921d46ccd2e735751c8f9e992d909fd1dfc587962a1b393d4ef07831ad9c8f'
  );
  assert.equal(audio.toString('ascii', 0, 3), 'ID3');
});

test('C portrait is a real webp image and used in the Golden Dragon HUD', async () => {
  const art = await read('public/assets/portraits/c-portrait.webp');
  assert.equal(art.toString('ascii', 0, 4), 'RIFF');
  assert.equal(art.toString('ascii', 8, 12), 'WEBP');
  assert.ok(art.length > 20000 && art.length < 100000);

  const game = (await read('public/play/game.js')).toString();
  const style = (await read('public/play/styles.css')).toString();
  const classic = (await read('src/main.js')).toString();
  assert.match(game, /portraits\.mall \|\|= '\.\.\/assets\/portraits\/c-portrait\.webp'/);
  assert.match(game, /classList\.toggle\('is-c-portrait', key === 'mall'\)/);
  assert.match(style, /\.portrait-frame\.is-c-portrait/);
  assert.match(classic, /const cPortraitSrc = '\.\/assets\/portraits\/c-portrait\.webp'/);
});

test('the static build ships both approved assets', async () => {
  const audio = await stat(new URL('public/assets/music/phoenix-arise.mp3', root));
  const art = await stat(new URL('public/assets/portraits/c-portrait.webp', root));
  assert.equal(audio.size, 4360553);
  assert.equal(art.size, 32412);
});
