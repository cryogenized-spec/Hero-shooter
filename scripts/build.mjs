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
await writeFile(join(out, '.nojekyll'), '');
console.log('Static game built in dist/ (no bundler or install required).');
