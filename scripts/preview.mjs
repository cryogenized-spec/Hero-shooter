import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { extname, join, normalize, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { dirname } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', 'dist');
const port = Number(process.env.PORT || 4173);
const contentType = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.webp': 'image/webp', '.png': 'image/png', '.svg': 'image/svg+xml' };
createServer(async (req, res) => {
  try {
    const pathname = decodeURIComponent(new URL(req.url, `http://localhost:${port}`).pathname);
    const relative = pathname.replace(/^\/+/, '') || 'index.html';
    const full = normalize(join(root, relative));
    if (!(full === root || full.startsWith(root + sep))) { res.writeHead(403).end('Forbidden'); return; }
    const info = await stat(full);
    if (!info.isFile()) { res.writeHead(404).end('Not found'); return; }
    const content = await readFile(full);
    res.writeHead(200, { 'content-type': contentType[extname(full)] || 'application/octet-stream', 'cache-control': 'no-cache' }).end(content);
  } catch { res.writeHead(404).end('Not found'); }
}).listen(port, '127.0.0.1', () => console.log(`Hero Shooter at http://127.0.0.1:${port}`));
