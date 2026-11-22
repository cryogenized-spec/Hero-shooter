---
name: hero-3d-character-studio
description: Create, inspect, repair, validate, and export Hero Shooter character 3D meshes using Python VTK, Blender/bpy, GLB/glTF/OBJ and approved character references. Use for 2D-to-3D reconstruction, character continuity, sculpting the head or face, correcting detached-looking nose/lips/headbands or other accessories, improving lip volume, topology, retopology, LODs, rigging readiness, and rendering model turnarounds for QA. Applies to C and future Hero Shooter characters.
---

# Hero Shooter — 3D Character Studio

Produce inspectable **real 3D assets**, not images posing as 3D models. Prefer incremental repairs to established meshes rather than full replacement. The approved artwork is the authority for likeness; the last approved mesh is the geometry baseline.

## Start here

1. Locate the character's **approved image**, current model (`.blend`, `.glb`/`.gltf`, `.obj`, or `.vtm/.vtp`), and any relevant notes. For C, read [character-contract.md](references/character-contract.md). If an asset is inaccessible, **say so**; do not invent its geometry or claim it is loaded.
2. Inspect existing geometry, scale, hierarchy, transforms and materials. Keep a pristine version and make a numbered revision. Record source version/path. Run `python scripts/mesh_audit.py path/to/model.glb --output path/to/audit.json` when `trimesh` and `numpy` are available; see [mesh-repair.md](references/mesh-repair.md) for interpretation.
3. Plan a **small, specific change**: e.g. lower an Alice band onto hair; replace protruding lip capsules with an integrated mouth surface; add lip volume while preserving C's restrained asymmetric smirk. Take front, profile and three-quarter baseline images before editing.
4. Choose the right tool: **VTK** for procedural blockout, mesh generation, geometric inspection and previews; **Blender/bpy** for organic facial sculpting, remeshing, surface conforming, rigging and final game export. Do not pretend Blender ran if `bpy`/Blender is unavailable. Imported VTK GLB geometry can be refined in Blender without remaking all costume parts.
5. Repair according to [mesh-repair.md](references/mesh-repair.md). Keep editable components/material groups where useful, and join or remesh only the anatomy that needs continuity. **Zero visible gaps** is not identical to **one topologically connected surface**: document which was achieved.
6. Produce an **unarmed neutral A-pose** (arms relaxed at sides, hands empty) unless the user requests a different pose. Do not add or modify weapons without direction. Preserve art-accurate clothing, accessories and proportions.
7. Inspect from **front, back, left/right profiles, three-quarter, overhead** and a neutral game-camera view. Verify silhouettes, facial profile, contact points, material mapping, attachment fit, pose and zero floor penetration. No body parts or headband may visibly float.
8. Deliver at least a **GLB**, a four-view comparison image, a tool/version audit summary and reproducible source (Python script or `.blend`). Deliver OBJ/VTK only if supported and useful. Mark **prototype** versus **rigged/game-ready** honestly. Make links only to verified files.

## Mandatory geometry quality gates

- **Nose:** profile has a continuous bridge/tip/alar transition into the face, no obvious sphere or capsule pasted onto it; verify front and both profiles.
- **Lips:** upper and lower lips have subtle 3D volume, meet cleanly at mouth corners, retain intended small offset on the character's **right** side (viewer-left when facing her), and read correctly under side lighting. No disconnected dark slab or bead-like protrusion.
- **Alice band / flowers:** the band follows scalp/hair curvature and is anchored; flowers attach to or overlap the band intentionally, rather than hover above it. Verify at the crown from rear and side.
- **Eyes, ears, hair and costume:** preserve accepted shapes, colors and asymmetry unless explicitly changed. Check no clipping at cheeks, neck, headband or scarf.
- **Mesh integrity:** inspect normals, mesh boundaries, loose fragments, intersections, material names and source transforms. Watertightness is **not universally required** for clothing, hair cards, accessories or stylized game meshes.
- **Scale:** record units and height, do not silently change size or axes; map to Hero Shooter conventions before any 2D sprite projection.
- **Animation readiness:** don't claim rigged until skeleton, deformation weights and animation samples were tested; an unrigged GLB is not a game-ready skeletal character.

## Project-specific orientation / sprite bridge

When generating directional sprite atlases or renders from the 3D model, **load the separate skill** `../hero-sprite-bearings/SKILL.md` and `../../../docs/art/sprite-bearing-contract.md`. The game's +X is screen-right and +Y is screen-down; 0° is East with clockwise positive angles. Atlas order is `[S, SW, W, NW, N, NE, E, SE]`, where South displays the **front** and North the **back**. In 3D, explicitly document the world coordinate axes and camera transform instead of assuming a 3D north-facing camera means the same thing as a sprite's South/front-facing view.

## Reuse and external references

Use the original authored instructions in this skill as the default. Optional *external reading* (not vendored code) includes:

- [Scenario Blender Sculpting](https://github.com/scenario-labs/skills/blob/main/skills/dcc/blender/scenario-blender-sculpting/SKILL.md) — procedural sculpting and facial correction patterns.
- [Scenario Blender Retopology](https://github.com/scenario-labs/skills/tree/main/skills/dcc/blender/scenario-blender-retopology) — clean topology for deformation.
- [Blender Python API](https://docs.blender.org/api/current/) and [VTK](https://docs.vtk.org/) — authoritative APIs.

**Never execute downloaded third-party scripts automatically.** Inspect licences, dependencies and source before adapting anything, and document attribution for any imported code or assets. The links above are optional references, not installed dependencies.

## Constraints and reporting

Make actual edits only when the user asks for a model change; creating this skill does not itself modify C's mesh. When proposing geometry improvements, use explicit before/after views and objective checks, but do not equate vertex proximity numbers with visual correctness. Never overwrite the approved 2D source or the previous GLB. For repository changes, use a branch/PR unless instructed otherwise; report whether a change is staged, merged or deployed, without conflating those states.