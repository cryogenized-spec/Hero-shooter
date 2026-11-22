---
name: hero-sprite-bearings
description: Use for Hero Shooter character sprites, sprite atlases, eight-way facing direction, walking/running/idle loops, sprite-generation prompts, weapon aiming, character camera orientation, or directional diagrams.
---

# Hero Shooter sprite-bearing skill

This is the canonical task workflow for **every** new or updated directional character sprite. Before generating, writing or reviewing any atlas, **read [the orientation contract](../../../docs/art/sprite-bearing-contract.md)**. Follow that document over generic compass conventions or image generator guesses.

## Fixed screen bearings

- Canvas top-left origin; **+X right, +Y down**, `atan2(dy,dx)` gives facing.
- Screen-angle **0° means East/right; positive angles look clockwise**.
- Atlas columns, left to right: **0 South ↓ 90° (FRONT); 1 Southwest ↙ 135° (front quarter); 2 West ← 180° (LEFT-facing profile); 3 Northwest ↖ 225° (back quarter); 4 North ↑ 270° (BACK); 5 Northeast ↗ 315° (back quarter); 6 East → 0° (RIGHT-facing profile); 7 Southeast ↘ 45° (front quarter)**.
- `column = ((Math.round((angle-Math.PI/2)/(Math.PI/4))%8)+8)%8`.
- Rows 0–3 idle, 4–7 walking, 8–11 running. Cell size **32×48** for civilian C and most NPCs; **40×48** for Glock-ready C.

## Workflow

1. Inspect the **approved reference image and existing atlas** before writing a prompt. In any generated directional view, write the full words and arrow plus angle: e.g. **South ↓ = 90° = character FRONT visible**. Distinguish character-facing direction from camera view.
2. **One direction at a time.** Start with the previously accepted south-facing walking loop. Produce a clean neutral idle pose and four walking phases for the same view. Verify legs switch naturally, head/body scale does not change, and the feet do not slide.
3. For the next view, preserve costume/gear asymmetry; **never mirror a weapon/holster image merely to fill a missing direction**.
4. Check diagonal front/back orientation and screen-left/right profiles. Label **review previews**, not the final atlas PNG/SVG.
5. Assemble eight columns **[S, SW, W, NW, N, NE, E, SE]** and 12 rows only after each direction is approved. Preserve the feet/baseline alignment.
6. Verify runtime uses the correct facing angle for the renderer. `actor.walkAngle` for movement, `actor.angle` for aim/idle where appropriate. A stationary character should show a neutral standing pose instead of cycling or freezing mid-stride.
7. Run **`npm run check`, `npm test`, `npm run build`**; inspect `tests/sprite-bearing-contract.test.mjs`. Automated column checks cannot prove a generated image actually shows the intended front/back or left/right view, so inspect the art visually.

## Generation prompt fragment

> This direction is **{heading} {arrow}, {angle}° in Hero Shooter SCREEN coordinates** (X right, Y down, zero at East/right, clockwise positive). The **character faces {heading}**, so the viewer sees **{front/back/profile/quarter view}**. Maintain exact approved silhouette and outfit, plus unchanged body scale and contact-point position. Draw one neutral idle pose and four sequential, looping walking poses for **this direction only**, not a montage of angles. No compass markings within the exported sprite cells.

If the generator gets the bearings wrong, *reject the output and fix the directional prompt*, not the game mapping or camera. Do not use a skew, rotation or horizontal flip to disguise the wrong direction.
