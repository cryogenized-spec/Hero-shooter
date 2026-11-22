import { cp, copyFile, mkdir, rm, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const out = join(root, 'dist');
await rm(out, { recursive: true, force: true });
await mkdir(out, { recursive: true });
await copyFile(join(root, 'index.html'), join(out, 'index.html'));
await cp(join(root, 'src'), join(out, 'src'), { recursive: true });
await cp(join(root, 'public'), out, { recursive: true });

/*
 * The playable C /c/ arena reuses the scrapyard scene/nav assets maintained
 * with Sophia's 3D sandbox. The source lives outside public/, so the static
 * dist/ build must include just these three required files. Do not copy
 * the large Poly Haven alternative assets or duplicate the characters.
 */
const scrapyardSource = join(root, 'sophia', 'play', 'assets', 'procedural', 'scrapyard');
const scrapyardOut = join(out, 'play', 'assets', 'procedural', 'scrapyard');
await mkdir(scrapyardOut, { recursive: true });
for (const asset of ['scrapyard_arena.glb', 'arena_navgrid.json', 'arena_layout.json']) {
  await copyFile(join(scrapyardSource, asset), join(scrapyardOut, asset));
}

await writeFile(join(out, '.nojekyll'), '');
console.log('Static game built in dist/ (no bundler or install required).');
