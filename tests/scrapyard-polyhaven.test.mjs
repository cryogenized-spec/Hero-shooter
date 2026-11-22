import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const read = (p) => readFile(new URL('../' + p, import.meta.url), 'utf8');

test('Poly Haven 3D enrichment is sourced and preserves the authored scrapyard layout', async () => {
  const source = await read('tools/render/enrich_scrapyard_polyhaven.py');
  const layout = JSON.parse(await read('sophia/play/assets/procedural/scrapyard/arena_layout.json'));
  const workflow = await read('.github/workflows/enrich-scrapyard-polyhaven.yml');
  const readme = await read('sophia/play/assets/procedural/scrapyard/POLYHAVEN.md');
  assert.equal(layout.dimension_m.width_x,50);
  assert.equal(layout.dimension_m.height_ground_y,28);
  assert.ok(Array.isArray(layout.colliders));
  for(const slug of ['barrel_03','old_tyre','rusted_wheel_rim_02']) {
    assert.ok(source.includes(slug),slug);
    assert.ok(readme.includes('polyhaven.com/a/'+slug));
  }
  assert.match(source,/https:\/\/api\.polyhaven\.com\/files\//);
  assert.match(source,/get_asset\(slug,args\.cache_dir,args\.offline\)/);
  assert.match(source,/scene\.add_geometry\(/);
  assert.match(source,/scene\.graph\.update\(/);
  assert.match(source,/planned_placements/);
  assert.match(readme,/current Canvas-2D scene/);
  assert.match(workflow,/upload-artifact@v4/);
  assert.match(workflow,/if: github\.event_name == 'push'/);
});