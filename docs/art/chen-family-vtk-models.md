# Hero Shooter — Chen family procedural 3D archive

This repository contains actual VTK-generated **GLB models** for the entire Chen family, stored as source+export. All are **unrigged prototypes**. They can be viewed in 3D software, but the current playable shop uses 2D atlases/procedural sprites rather than real-time GLB character rendering.

| Character | 3D GLB | VTK source | Transparent eight-direction atlas | Runtime status |
| --- | --- | --- | --- | --- |
| Mr. Chen | `public/play/assets/procedural/mr_chen_hybrid_face_v2.glb` | `tools/render/mr_chen_hybrid_v2.py` | `public/play/assets/procedural/mr_chen_8dir_12row_atlas.png` | Existing `mr-chen.svg` atlas remains unchanged |
| Mrs. Chen | `public/play/assets/procedural/mrs_chen_unarmed_vtk.glb` | `tools/render/mrs_chen_vtk.py` | `public/play/assets/procedural/mrs_chen_vtk_atlas_32x48.png` | Existing `family-mother` renderer remains unchanged; new atlas is a review candidate |
| Wei Chen | `public/play/assets/procedural/wei_chen_hybrid_vtk_v2.glb` | `tools/render/wei_chen_3d.py` | `public/play/assets/procedural/wei_chen_8dir_12row_atlas.png` | Wired into `family-son` NPC rendering and walking route |

## Provenance and preservation

The GLBs were generated from the project's own procedural VTK scripts. Wei's latest model includes white sclera, iris and pupil from the UV facial texture. Mr. Chen's V2 includes his mapped anime-style facial features and spectacles. Mrs. Chen's original unarmed VTK model preserves her traditional outfit and ornaments.

Models and their source scripts are preserved separately. This work adds archive assets only; it does **not** replace approved portraits, overwrites none of the existing `mr-chen.svg` sprites, and introduces no new gameplay logic.

## Atlas contract

All 2D atlases use 32 × 48 px cells, eight columns in the order `S, SW, W, NW, N, NE, E, SE`, and 12 rows: idle 0–3, walk 4–7, run 8–11. See `docs/art/sprite-bearing-contract.md`. South-facing is character front; north-facing is back. No skeletal rigging is present in these GLBs.

## Regeneration

The `render-chen-family.yml` GitHub Actions workflow regenerates Mr and Mrs Chen VTK exports and verifies that all three GLBs are structurally readable and the atlas images have expected dimensions. Wei's separate `render-wei-chen.yml` workflow generates his original GLB.
