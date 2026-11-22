# Hero Shooter — eight-direction sprite bearing contract

**Status: project-wide canonical convention.** This document applies to the playable shop, scrapyard training, all eight-direction character atlases, future custom art and image-generation prompts. If a generated image appears to contradict this table, **reject/correct the image** rather than silently changing the game's orientation to match it.

## 1. Coordinate system (do not substitute a mathematical Y-up compass)

The origin of the game canvas is the **top-left corner**. **X grows to the right**; **Y grows downward**.

- `θ = 0 radians = 0°` means facing **East (screen right)**.
- Increasing `θ` rotates the facing vector **clockwise as seen on the screen**.
- Use `θ = Math.atan2(dy, dx)` for a movement vector; `dx = cos(θ)`, `dy = sin(θ)`.
- Negative angles and angles over 360° are valid and must wrap to the same direction. The screen is **not** a Y-up Cartesian plot.
- A **sprite's facing direction is where the character looks/walks**, **not** which direction a camera is looking or which part of the character is visible.

### Visual compass (screen-space, not a rotated arrow icon)

```text
   ↖ Northwest       ↑ North         ↗ Northeast

   ← West            ● Character     → East

   ↙ Southwest       ↓ South         ↘ Southeast
```

A character facing **South ↓** looks toward the **bottom of the screen**; an orthographic/three-quarter sprite therefore shows her **face/front**. Facing **North ↑** looks toward the **top**; we see the **back**. Facing **East →** is a **screen-right-facing profile**, and **West ←** is a **screen-left-facing profile**. Diagonals show the appropriate front-quarter (SE/SW) or back-quarter (NE/NW) view.

## 2. Atlas columns — fixed, left to right

These are the columns expected by the actual draw code in `public/play/sprites.js` and `src/armed-c.js`.

| Column (0-based) | Heading | Arrow | Screen angle | Visible artwork |
| ---: | --- | :---: | ---: | --- |
| 0 | South | ↓ | 90° | Character's **front** (face visible) |
| 1 | Southwest | ↙ | 135° | Front-quarter, looking toward bottom-left |
| 2 | West | ← | 180° | Profile looking toward **screen left** |
| 3 | Northwest | ↖ | 225° (or -135°) | Back-quarter, looking toward top-left |
| 4 | North | ↑ | 270° (or -90°) | Character's **back** |
| 5 | Northeast | ↗ | 315° (or -45°) | Back-quarter, looking toward top-right |
| 6 | East | → | 0° (or 360°) | Profile looking toward **screen right** |
| 7 | Southeast | ↘ | 45° | Front-quarter, looking toward bottom-right |

```js
// Contract: θ is Math.atan2(dy, dx), where +Y goes DOWN.
const column = ((Math.round((theta - Math.PI / 2) / (Math.PI / 4)) % 8) + 8) % 8;
// Corresponds exactly to [S, SW, W, NW, N, NE, E, SE].
```

**Important:** `0° = East` is an *angle reference*; it does **not** mean atlas column 0. The atlas deliberately starts with **South (column 0)**. Do not confuse these two zeroes.

## 3. Frames, proportions and movement

| Atlas rows (0-based) | Gait | Four frames |
| --- | --- | --- |
| 0–3 | Idle | Neutral standing variations; never freeze a leg in mid-stride |
| 4–7 | Walk | Four stages of one continuous, loopable walk cycle |
| 8–11 | Run | Four stages of one continuous, loopable run cycle |

Atlas layout is **8 columns × 12 rows = 96 cells**. The currently approved civilian C / generic NPC cells are **32 × 48 px (256 × 576 sheet)**; Glock-equipped C is **40 × 48 px (320 × 576 sheet)**. Do not resize one direction relative to another. Keep the character's head/body scale, feet baseline, ground contact, transparent background, costume, handedness and gear placement consistent in every cell. Each cell contains **exactly one complete character**, not 2D icons or labels.

A character who stops walking must go to a **neutral stationary pose**, not continue cycling the idle rows and not stay stuck in a lifted-leg frame. The standard at-rest pose is idle frame 0 unless a fixed alternative is deliberately chosen for review. Walking/running cycle frames must advance only while actually moving. Do not rotate/mirror the exported sprites to fake missing angles, particularly when weapons, holsters, bags or other asymmetric elements are present.

### Movement versus aim

- `actor.walkAngle` is the direction of travel, for the walk/run loop.
- `actor.angle` is the actor's facing/aim angle and is used by several idle/armed renderers.
- Civilian C can remember `lastTravelFacing` when she stops.
- Armed C may point her weapon East while moving North; the sprite direction must follow the intended armed/aim renderer without accidentally swapping the meanings of the two angles.
- Confirm the actual usage in the renderer, do not assume moving and aiming are identical.

## 4. Image generation: mandatory directional brief

For every single-direction sprite generation, include **all** these clauses in the request, updating `{DIRECTION}`, `{ARROW}`, `{ANGLE}` and `{VIEW}` from the atlas table:

> Hero Shooter eight-direction 2D game sprite. **Screen coordinates: X increases right and Y increases down.** This image is **ONE direction: {DIRECTION}, arrow {ARROW}, screen heading {ANGLE}°**, where 0° points right/East and angles increase clockwise. The **character is facing {DIRECTION}**, not the camera. **The visible side is {VIEW}.** Maintain the same approved character design, costume, proportions, handedness, equipment and foot baseline as the source reference. Include one neutral idle pose and four walking poses for this specific direction. Each walking pose is a distinct phase of the same loop, with believable alternating foot placement and contact. Orthographic/three-quarter top-down pixel-art game sprite with transparent background; one consistent cell size, no direction labels inside export cells, no compass arrows in exported artwork, no mirrored substitutions.

Use these concrete view clauses:
- South ↓ 90°: **front visible**, character looking toward bottom of screen.
- Southwest ↙ 135°: **front-left screen diagonal**, looking bottom-left.
- West ← 180°: **screen-left profile**, looking left.
- Northwest ↖ 225°: **back-left screen diagonal**, looking top-left.
- North ↑ 270°: **back visible**, looking top.
- Northeast ↗ 315°: **back-right screen diagonal**, looking top-right.
- East → 0°: **screen-right profile**, looking right.
- Southeast ↘ 45°: **front-right screen diagonal**, looking bottom-right.

**Do not ask the generator for all eight unreviewed directions at once.** Start with the approved **south-facing walking cycle**, confirm the face/front and real stride, then produce and approve the other seven directions one at a time. After each direction, examine idle, walk frames, body width/height, foot baseline and camera perspective; only then assemble the atlas in the fixed order.

## 5. QA gate before a generated atlas may be wired in

1. Draw or review a **labelled compass reference separate from the raw atlas**; confirm every arrow points in the correct screen direction.
2. In the actual character image: S must show face; N must show back; E points right; W points left. Check diagonal quarters for front/back consistency.
3. Compare proportions and asymmetrical details across all eight columns. Do not mirror holsters, hands, jacket features or gun presentation.
4. Inspect *all* four walk cells for each direction. Ensure a loop with no leg teleport and consistent ground-contact point. A single pretty still image is not a functional cycle.
5. Confirm all four idle cells contain plausible stationary poses (or use one neutral idle cell); stopping cannot strand an outstretched walking leg.
6. Render the eight directions at game size and verify the character's movement and aim independently.
7. Run `npm run check && npm test && npm run build`. The bearing regression test checks renderer selection and angle wrap, **not** the visual correctness of generated image contents; those require inspection.

**Avoid "skew" transforms as a substitute for orientation correctness.** A skew changes shape/perspective, not the semantic meaning of facing North versus South.
