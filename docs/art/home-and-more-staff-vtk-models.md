# Home & More — Sunday shop staff VTK character models

Six real, inspectable **3D GLB** files, each paired with a canonical **8-way 96-frame RGBA sprite atlas**, are stored in `public/play/assets/procedural`. These are procedurally built from Python **VTK** source and use independent 3D limb poses for idle/walk/run sprites; they are **unrigged GLBs**, not skeletal animations. The existing game still renders sprites in its 2D top-down engine.

| Character | Tiled map | Visual concept (fictional choice) | GLB | Atlas |
| --- | --- | --- | --- | --- |
| Ismail | Character concept only; **not** currently placed on the Sunday map | Existing approved merchandiser design, unchanged | `ismail_unarmed_vtk.glb` | `ismail_vtk_atlas_32x48.png` |
| Sibusiso Mkhize | Receiving floor | Dark green work vest, tan cargos, short hair | `sibusiso_mkhize.glb` | `sibusiso_mkhize_8dir_12row_atlas.png` |
| Thandeka Dlamini | Receiving floor | Burgundy jacket, braids, dark trousers | `thandeka_dlamini.glb` | `thandeka_dlamini_8dir_12row_atlas.png` |
| Bongani Cele | Stock shelves | Muted blue work polo, cropped hair, dark trousers | `bongani_cele.glb` | `bongani_cele_8dir_12row_atlas.png` |
| Mandla Khumalo | Stock shelves | Khaki work jacket, short curls, charcoal trousers | `mandla_khumalo.glb` | `mandla_khumalo_8dir_12row_atlas.png` |
| Back-office clerk | Staff back office | Purple cardigan, tied-back hair and stationery | `back_office_clerk.glb` | `back_office_clerk_8dir_12row_atlas.png` |

**Source:** `tools/render/build_ismail_vtk.py` is Ismail's prior approved source; `tools/render/build_shop_workers_vtk.py` is the reproducible 5-worker generator. The workflow `render-home-more-staff.yml` regenerates all outputs, checks mesh structure and atlas dimensions, runs Node game tests, and publishes the files.

**Animation:** South, Southwest, West, Northwest, North, Northeast, East, Southeast appear left-to-right. Sprite cell is 32×48 px, with four rows each of idle, walk, run (256×576 total). Existing shop worker route and wage-delivery dialogue remains unchanged. Idle is stationary.

**Continuity:** No new worker was added to the Tiled map and the four named recipients of the wage-delivery storyline are preserved. Ismail's original name and appearance are not conflated with the alternate Ismael concept sheet. The clerk remains unnamed pending story decisions. Designs for the remaining staff are original fictional visualizations, not representations of real-world individuals.

**Scope/limitations:** These are working art prototypes; individual expressions, face styling, and natural joint deformation can be refined during playtesting. This change does not introduce a real-time 3D rig or game engine.
