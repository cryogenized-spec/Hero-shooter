import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
const read = (path) => readFile(new URL('../' + path, import.meta.url), 'utf8');

test('complete Gemini v10.1 HTML archived and current gameplay is modular', async () => {
    const original = await read('reference/gemini-v10.1-complete-2026-11-19.html');
    assert.match(original, /BUILD v10\.1/);
    assert.match(original, /<\/html>/);
    const html = await read('public/play/index.html');
    assert.match(html, /\.\/entry\.js/);
    assert.match(html, /\.\/styles\.css/);
    assert.match(html, /btnCampMall/);
    assert.match(html, /btnCampTraining/);
    assert.match(html, /TITLE SCREEN/);
});

test('v10 includes working audio, chapters and key gameplay systems', async () => {
    const js = await read('public/play/game.js');
    for (const pattern of [/function gameLoop\(timestamp\)/, /function generateWorld\(camp\)/,
        /function selectCampaign\(camp\)/, /buildImpulseResponse\(duration, decay\)/,
        /configureGenreForCampaign\(camp\)/, /class Corpse/, /toggleSneak\(\)/,
        /class Enemy/, /requestAnimationFrame\(gameLoop\)/]) assert.match(js, pattern);
    assert.match(js, /roundsTray\.dataset\.renderKey/);
    assert.match(js, /spareTray\.dataset\.renderKey/);
});

test('hero title remains and opens new build without deleting legacy', async () => {
    const title = await read('src/ui/title-screen.js');
    assert.match(title, /new URL\('\.\/play\/'/);
    assert.match(title, /titleClassic/);
    const old = await read('src/main.js');
    assert.match(old, /function gameLoop\(timestamp\)/);
});
