# Hero Shooter — 3D sandbox coding and artwork contract

## Active playable application
The homepage \`index.html\` launches Sophia's real-time Three.js/WebGL scrapyard demo from \`src/sophia-demo.js\`. The old Canvas 2D campaign game and directional sprite files have been deliberately removed in this feature branch. Do not quietly reintroduce the 2D title, stages, NPC drawing code, or 32 × 48 sprite atlases.

## Coordinate system and collision
The authored scrapyard uses +X east, +Y north, +Z up. The scrapyard GLB is Y-up and requires a +90° world-X rotation when imported into the Z-up character stage. The original \`arena_navgrid.json\` has 0.5 m tiles, grid 100 × 56; always check ground-level motion against it. The south-gate spawn is (0, -11.8, 0.1). Do not claim the raised container or watchtower is walkable until vertical collision is implemented.

## Sophia character
The approved source of truth is \`tools/render/sophia_saafiya_studio_v3_3_builder.py\` plus the prior v3.2 builder. The generated \`sophia_v33_articulated.glb\` retains one UV-painted 2048px face, 1.72m character scale and rigid group pivots: body, left_leg/right_leg, left_boot/right_boot, left_arm/right_arm. Procedural rigid articulation is **not** a skin-weighted rig. Do not flatten her to a pixel sheet. Review the installed .agents/skills/hero-3d-character-studio/SKILL.md before character geometry edits.

## Rendering and interactions
Use real-time 3D WebGL for the hero, characters and arena. Keep the rendering resolution native to the viewport (device pixel ratio may be capped for memory/performance). Keep stop-idle feet neutral and make the camera follow without teleporting during normal movement. The three looter GLBs are currently NPC test figures; interactions do not include weapon damage.

## Verification
Run \`npm run check\`, \`npm test\`, and \`npm run build\`; use GitHub Actions to generate any missing GLB before claiming the downloadable demo is ready. Use browser QA when a connected browser is available. Preserve Git history to recover the retired 2D game if needed.
