# Hero Shooter — instructions for coding agents

## Mandatory sprite-bearing convention

Whenever a task creates, edits, indexes, prompts for, reviews, or renders a character sprite atlas, read **[the bearing contract](docs/art/sprite-bearing-contract.md)** and use the repository skill at **[.agents/skills/hero-sprite-bearings/SKILL.md](.agents/skills/hero-sprite-bearings/SKILL.md)**.

- Game screen coordinates: **+X is right, +Y is down**; `0° = East (→)`; positive angles rotate **clockwise** on screen.
- Eight atlas columns **left to right, zero-based**: **0 South ↓, 1 Southwest ↙, 2 West ←, 3 Northwest ↖, 4 North ↑, 5 Northeast ↗, 6 East →, 7 Southeast ↘**.
- **South shows the character's front. North shows the back. East faces screen-right; West faces screen-left.** A camera-facing portrait is not the same as a character facing north.
- Rows: idle 0–3, walk 4–7, run 8–11. A stopped character uses a neutral, **non-walking** idle pose; see PR #36 for the idle-state fix.
- Never silently change this indexing, use a Cartesian Y-up compass, rotate the sheet 90°, transpose directions, or mirror equipment-bearing art. Use an explicit direction-labelled preview before accepting generated sprite artwork.
- Preserve `actor.angle` (aim/appearance heading) and `actor.walkAngle` (movement heading) as distinct concepts; verify which one a renderer uses before changing animation behaviour.
- Run `npm run check`, `npm test`, and `npm run build` for sprite-related changes; in particular preserve `tests/sprite-bearing-contract.test.mjs`.

## 3D character modelling and geometry QA

When creating, editing, repairing, exporting, inspecting, or rendering a real 3D character mesh for Hero Shooter, use **[.agents/skills/hero-3d-character-studio/SKILL.md](.agents/skills/hero-3d-character-studio/SKILL.md)**. The corresponding private ChatGPT plugin is `hero-shooter-3d-studio` and is packaged from the canonical skill with `python tools/package-hero-3d-plugin.py`.

- Treat approved artwork as the visual source of truth and preserve earlier model versions. For C, consult the skill's `references/character-contract.md` before changing appearance.
- Repair detached-looking face and accessory surfaces deliberately (nose/lips/headband), verify multiple views and do not claim a model is rigged without rigging tests.
- Use the separate **hero-sprite-bearings** skill when producing 2D directional sprite atlases; a 3D front-view and a sprite's facing direction are not interchangeable.
