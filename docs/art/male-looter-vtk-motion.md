# Hero Shooter — male looter VTK motion and props

This branch introduces three distinct male VTK characters (ages **23, 27, 35**) reusing the **male** two-bone IK gait defined in [`tools/render/generate_looters.py`](../../tools/render/generate_looters.py). It does **not** borrow C's female walk animation.

## Content

- Separate unrigged GLBs for each male character, with four idle, four walk and four run frames in a **256 × 576** sprite atlas.
- Separate three-dimensional game-prop GLBs: **half brick**, **stone** and **stylised knife**.
- Each character has a **256 × 384** atlas (8 headings × 8 phases) for the **throw** (brick and stone) and the **overhand knife** gesture. These are visual poses; no physical combat instructions or damage simulation.
- Every equipped prop also has its own **256 × 576** male walking/running atlas, so it stays visible while an NPC moves.
- Original unarmed sprites and code remain unchanged. A separate [preview page](../../public/play/looter-motion-preview.html) can show all animation combinations after assets render.

## Sprite and movement conventions

Screen +X points right, +Y down, 0°=East and clockwise positive. Columns are `S, SW, W, NW, N, NE, E, SE`; South shows the face, North shows the back. Four idle rows must show a neutral static character; walk rows 4–7 and run rows 8–11 advance only while moving. Action sheets are independent, eight rows ordered through an action once, not continually animated while idle.

The shared male gait uses a stylised two-link knee solver and 60/40 stance-to-swing approximation. Arm swing increases for running. These are animation assets, **not** a motion capture library. Attached props follow the right-hand model group.

## Build

The [GitHub Actions workflow](../../.github/workflows/render-looter-assets.yml) installs VTK, renders both generators, checks existing game code, and commits compact runtime output under `public/play/assets/procedural/looters/` on its source branch.

Locally:
```bash
python -m pip install vtk pillow numpy trimesh
xvfb-run -a python tools/render/generate_looters.py
xvfb-run -a python tools/render/looter_actions_repo.py
npm run check && npm test && npm run build
```

The generated GLBs are static/unrigged and the 2D PNG/WebP animations are offline render sequences. Integration with combat timing, hit registration, navigation and projectile physics is **not** included here. Keep the existing game renderer in place until new files and loading transitions are verified; do not replace C's sprites or the current game without review.


## Full-resolution 3D WebGL stage (November 22 update)

The original 32×48 native atlases are a performance fallback and **not** the
renderer used by `public/play/looters-3d.html`. The stage can be reached via
the **3D LOOTERS** link in the live Home & More interface. The 3D stage
loads `looter_23_articulated.glb`, `looter_27_articulated.glb` and
`looter_35_articulated.glb` via Three.js GLTFLoader.

The independent exporter `tools/render/export_articulated_looters.py`
preserves named `thigh_l/r`, `shin_l/r`, `foot_l/r` and `arm_l/r`
nodes from the original VTK assemblies. The browser uses a simple 60% stance,
40% swing two-bone IK solver that rotates those nodes each frame. The three
models retain separate foot and arm movement, not a baked 2D slideshow.
Gear is loaded from independent GLBs and attached to the moving right-hand
group. The stage supports real-time movement and camera orbit and is rendered
at the browser viewport's actual pixel resolution (DPR capped at 2).

The three skin material palettes were adjusted as an explicit character-art
revision: 23 `#704732`, 27 `#623F2D`, 35 `#76503A`, each with
separate highlight and shadow tones. This is a choice for these fictional
characters, not a claim about how any ethnic group must look.

**Scope**: This is a new *playable 3D character test stage* within the Hero
Shooter web game, not a conversion of its existing 2D map, all NPCs, collision,
or gameplay physics. The original Home & More game continues to use Canvas 2D.
The 3D test stage is a native real-time WebGL renderer, not a 3D screenshot or
pixel atlas. In-game combat damage and projectile collision remain outside
this review stage. External Three.js ES modules require network access.

Use `npm run check && npm test && npm run build` and verify the WebGL stage
in a real browser with the deployed preview URL before merging.


## VTK scrapyard sandbox integration

Source-of-truth scene: the approved **Pine Ridge scrapyard** created on
2026-11-22 from the overhead scrapyard artwork. Its deterministic Python
generator was preserved as \`tools/render/build_scrapyard_arena.py\`.
The GitHub Actions workflow renders and publishes:

- \`public/play/assets/procedural/scrapyard/scrapyard_arena.glb\` — genuine
  50 m × 28 m 3D world, central raised container, stairs, watchtower, perimeter
  fence, wrecks, targets, concrete cover, barrels, crates and junk
- \`arena_layout.json\` — obstacle definitions and authored spawn points
- \`arena_navgrid.json\` — 100 × 56 grid at 0.5 m per cell, obstacles inflated
  for a nominal 0.35 m character radius
- \`arena_isometric.png\` — source-geometry review image

The stage \`/play/looters-3d.html\` now imports this GLB **instead of**
the temporary grey proxy yard. The GLB uses **Y-up** (X east, Z south);
the articulated character stage uses **Z-up**. Rotating the imported arena
root +90° around world X preserves x=east and reprojects the old south-Z
onto the stage's north-Y. No 32×48 sprite scaling is used.

The three male looters spawn at x=−1.6/0/+1.6 m, y=−11.8 m near
the south gate, validated as walkable. Move attempts are checked against
the authoring navgrid with blocked-axis sliding. Ground-level collision
is conservative; vertical stair and raised-platform travel, mesh-level
collision, proper AI navmesh and projectile/knife hit detection are not yet
implemented. **This is the character and environment sandbox**, not the
final full game conversion. Avoid replacing the original Canvas 2D campaign
maps and scripts until the wider 3D engine transition is ready.
