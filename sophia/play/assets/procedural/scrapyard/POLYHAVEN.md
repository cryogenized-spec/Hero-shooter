# Pine Ridge scrapyard — Poly Haven 3D detail pass

This is a non-destructive, **genuine 3D import** pass for the authored 50 × 28 m
Pine Ridge scrapyard in `sophia/play/assets/procedural/scrapyard/`.

The existing `scrapyard_arena.glb`, `arena_layout.json` and
`arena_navgrid.json` remain the collision and coordinate baselines. The
script `tools/render/enrich_scrapyard_polyhaven.py` fetches three CC0 Poly Haven
models in **1K glTF** (where available) and imports their mesh geometry and
textures into a separate `scrapyard_arena_polyhaven.glb`:

- [Barrel 03](https://polyhaven.com/a/barrel_03) — seven weathered steel drums
- [Old Tyre](https://polyhaven.com/a/old_tyre) — twenty tyres, distributed as stacks
- [Rusted Wheel Rim 02](https://polyhaven.com/a/rusted_wheel_rim_02) — three rusty wheel rims

All 30 placements are repeatable and recorded by name in
`arena_polyhaven_manifest.json`, with camera render
`scrapyard_polyhaven_preview.webp`. The package preserves source glTF UV
coordinates and material images where the import pipeline supports them;
mesh instancing avoids duplicating geometry for every barrel or tyre.

**World-axis bridge:** authored coordinates are (X east, Y north, Z up);
the existing glTF scene uses (X east, Y up, Z south), so the Python builder
converts positions as `(x,z,-y)`. It preserves existing colliders and navgrid.

**The deployed `/training/` game is still a separate Canvas-2D scene** using
`public/training/scrapyard.webp` and its original target rectangles. This
change does not silently replace the 2D background or its hitboxes. Loading
this 3D GLB into a renderer, or baking a pixel-perfect 2D replacement with
recalibrated hitboxes, remains a separate integration step.

### Rebuild

```bash
pip install numpy requests trimesh vtk pillow
xvfb-run -a python tools/render/enrich_scrapyard_polyhaven.py
```

The GitHub Actions workflow `enrich-scrapyard-polyhaven.yml` renders a preview,
verifies the exported GLB and publishes the enriched asset on main. It
uses Poly Haven's API only during CI generation; runtime gameplay does not
call the API.

**Licence:** all three downloaded models are [Poly Haven CC0](https://polyhaven.com/license).
The underlying Poly Haven API has different terms: it requests a distinctive
User-Agent, and a visible credit if using the *live* API in a product. This
script uses the API only at build time and records the source URLs and
"Powered by Poly Haven" in the manifest as provenance.