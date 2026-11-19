import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';

// Assemble the exact user-approved original file from binary chunks.
// Never regenerate, retime, normalize, or transcode this recording.
const expected = '17921d46ccd2e735751c8f9e992d909fd1dfc587962a1b393d4ef07831ad9c8f';
const parts = await Promise.all(Array.from({ length: 15 }, (_, i) =>
  readFile('.asset-import/phoenix-arise/part-' + String(i).padStart(2, '0') + '.bin')
));
const data = Buffer.concat(parts);
const actual = createHash('sha256').update(data).digest('hex');
if (data.length !== 4360553 || actual !== expected) {
  throw Error('Original asset validation failed: size=' + data.length + ' sha256=' + actual);
}
await mkdir('public/assets/music', { recursive: true });
await writeFile('public/assets/music/phoenix-arise.mp3', data);
console.log('Original Phoenix, Arise! verified and assembled:', data.length, 'bytes, SHA-256', actual);
