import { createHash } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';

// Import only the exact recording the game director approved.
// The provider's signed CDN URL is temporary. Obtain a fresh URL from
// the public playback API, verify the recording byte-for-byte, then commit.
const SESSION = 'sess_66a6d26ef60850cf';
const SHA256 = '17921d46ccd2e735751c8f9e992d909fd1dfc587962a1b393d4ef07831ad9c8f';
const endpoints = [
  `https://app.backgroundmusic.xyz/api/tracks?session_id=${SESSION}&track_number=1`,
  `https://app.backgroundmusic.xyz/tracks?session_id=${SESSION}&track_number=1`
];

function collectUrls(value, result = []) {
  if (typeof value === 'string') {
    if (/^https:\/\//.test(value) && value.includes('/tracks/' + SESSION + '/') && value.includes('.mp3')) result.push(value);
  } else if (Array.isArray(value)) value.forEach(v => collectUrls(v, result));
  else if (value && typeof value === 'object') Object.values(value).forEach(v => collectUrls(v, result));
  return result;
}

let found = false;
for (const endpoint of endpoints) {
  try {
    const response = await fetch(endpoint, {
      headers: { accept: 'application/json', referer: 'https://app.backgroundmusic.xyz/player?session_id=' + SESSION },
      signal: AbortSignal.timeout(16000)
    });
    console.log('Provider API:', new URL(endpoint).pathname, 'HTTP', response.status);
    if (!response.ok) continue;
    const type = response.headers.get('content-type') || '';
    if (!/json/.test(type)) continue;
    const data = await response.json();
    console.log('Public response fields:', Object.keys(data || {}).join(', '));
    for (const url of collectUrls(data)) {
      const parsed = new URL(url);
      if (parsed.hostname !== 'storage.googleapis.com') continue;
      const audioResponse = await fetch(url, { signal: AbortSignal.timeout(55000) });
      console.log('Original MP3 download HTTP', audioResponse.status);
      if (!audioResponse.ok) continue;
      const bytes = Buffer.from(await audioResponse.arrayBuffer());
      const digest = createHash('sha256').update(bytes).digest('hex');
      console.log('Audio bytes:', bytes.length, 'sha256:', digest);
      if (digest !== SHA256) throw new Error('Remote audio hash differs from the approved original; refusing to import.');
      await mkdir('public/assets/music', { recursive: true });
      await writeFile('public/assets/music/phoenix-arise.mp3', bytes);
      found = true;
      break;
    }
    if (found) break;
  } catch (error) {
    if (/hash differs/.test(String(error))) throw error;
    console.log('Provider retrieval unavailable:', String(error?.message || error));
  }
}
if (!found) throw new Error('Exact recording could not be imported from the public provider API. No replacement was written.');
