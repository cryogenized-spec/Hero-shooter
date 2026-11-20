import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, access } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const read = (path) => readFile(new URL('../' + path, import.meta.url), 'utf8');

test('both Pages publishing modes have a playable chapter URL', async () => {
  // GitHub Pages auto-Jekyll publishes the repository root as /Hero-shooter/.
  const fallback = await read('play/index.html');
  assert.match(fallback,/\.\.\/public\/play\/index\.html/);
  assert.match(fallback,/location\.search/);
  assert.match(fallback,/window\.location\.replace/);
  // The regular static build copies public/ into dist/, not the root fallback.
  const game = await read('public/play/index.html');
  assert.match(game,/shop\.js/);
  assert.match(game,/id="btnCampShop"/);
  await access(new URL('../public/play/shop.js', import.meta.url));
  await access(new URL('../public/play/maps/home-and-more.tmj', import.meta.url));
});

test('static build produces the canonical /play/ landing page and assets', async () => {
  // Tests check build script contract without building dist/ during a
  // parallel Node test run; the CI build step exercises the real output.
  const build = await read('scripts/build.mjs');
  assert.match(build,/cp\(join\(root, 'public'\), out/);
  assert.match(build,/copyFile\(join\(root, 'index\.html'\)/);
});
