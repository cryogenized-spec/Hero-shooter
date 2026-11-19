import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
const source = await readFile(new URL('../public/play/game.js', import.meta.url), 'utf8');

test('Phoenix, Arise! is linked to the approved local game asset, not an expiring session URL', () => {
  assert.match(source, /const PHOENIX_TRACK_URL = '\.\.\/assets\/music\/phoenix-arise\.mp3';/);
  assert.doesNotMatch(source, /X-Goog-Signature|sess_66a6d26ef60850cf/);
});

test('recorded music is restricted to mall campaign and music toggle', () => {
  assert.match(source, /this\.musicGenre === 'psytrance' && currentCampaign === 'mall'/);
  assert.match(source, /this\.musicEnabled && gameState === 'playing' && this\.isPhoenixStage\(\)/);
  assert.match(source, /this\.musicEnabled = !this\.musicEnabled;\s*this\.syncPhoenixTrack\(\)/);
});

test('recorded track suppresses procedural scheduler, with safe fallback when missing', () => {
  assert.match(source, /if \(this\.isPhoenixPlaying\(\)\) \{/);
  assert.match(source, /if \(this\.phoenixUnavailable \|\| this\.phoenixPlayPending \|\| !this\.ctx\) return;/);
  assert.match(source, /audio\.addEventListener\('error',/);
  assert.match(source, /this\.pausePhoenixTrack\(\);/);
});

test('music HUD labels approved track only while actual recording is playing', () => {
  assert.match(source, /IPODS \[M\]: PHOENIX, ARISE! \/\/ ON/);
  assert.match(source, /IPODS \[M\]: PSYTRANCE 150BPM \/\/ ON/);
});
