import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, stat } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { join, dirname } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (path) => readFile(join(root, path), 'utf8');

test('approved title artwork is optimised WebP and copied to the build', async () => {
    const path = 'public/assets/title/hero-shooter-title.webp';
    const file = await readFile(join(root, path));
    assert.equal(file.toString('ascii', 0, 4), 'RIFF');
    assert.equal(file.toString('ascii', 8, 12), 'WEBP');
    assert.ok(file.length < 350_000);
    assert.ok((await stat(join(root, 'dist/assets/title/hero-shooter-title.webp'))).size > 100_000);
});

test('all printed title controls have real buttons and are wired to actions', async () => {
    const html = await read('index.html');
    const js = await read('src/ui/title-screen.js');
    for (const id of ['titleStart', 'titleContinue', 'titleOptions', 'titlePressStart']) {
        assert.match(html, new RegExp(`id="${id}"`));
        assert.match(js, new RegExp(`'${id}'`));
    }
    assert.match(js, /continueChapter\(CAMPAIGNS\.has\(previous\)/);
    assert.match(js, /chapterOverlay\.inert = true/);
});
