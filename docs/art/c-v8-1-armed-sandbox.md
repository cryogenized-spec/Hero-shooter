# C V8.1 — isolated armed 3D arena sandbox

This is a **3D test scene**, not a replacement for the 2D game or Sophia's existing demo. It uses the **existing** C V8.1 skull-refined character with vest, the original approved compact pink pistol from C's V6 source, and the project's scrapyard arena layout and navigation grid.

- **Open:** /c/ on the published website (also /public/c/ in a source checkout).
- **Move:** WASD; Shift sprint; Space jump. Standing idle has no fictitious leg walk cycle.
- **Pistol poses:** 1 = at side, 2 = two-handed low ready, 3 = raised/aimed; on-screen pose controls also work.
- **Shoot:** **Left mouse click only**. Gunshot sound, muzzle flash, flash light, ejected casing, optional static-environment impact marker, ammo counter, and fire-rate gating.
- **Camera:** Hold **right mouse button and drag** to orbit. Left drag does **not** manipulate the camera. Wheel zoom; V switches follow/overhead.
- **Reload:** R, two spare 15-round magazines. A 15-round extended magazine is a supported optional G26 magazine; it is NOT the pistol's 10-round standard magazine.
- **Sound:** three near-field 9mm handgun recordings and two tails, embedded in this repository from a CC0 audio library https://github.com/yegors/hard-lines/tree/main/public/audio (recorded PPQ, not a specific Glock sample). Audio may be affected by browser autoplay; synthesized fallback provided.
- **Rendering:** Three.js pinned to v0.180.0 via import map. Z up. 3D model files are gzip-compressed GLBs loaded through DecompressionStream, keeping repo footprint low.

**Limitations:** C's current V8.1 asset is an *unrigged static GLB*, so arms are deformed in the sandbox as a rigging **approximation**, not true weighted skeletal animations or accurate fingers on a grip. The pistol follows the right-hand pose; contact should be inspected in-browser. Jump and movement are simple functional prototypes. Target NPCs and combat AI are not implemented here.

**Rollback:** /c/ is a new isolated folder; deleting public/c reverts this feature. V6.1, V7, V8, the existing Sophia 3D demo, main menu and gameplay are unaffected.

**Donor assets:** Character from previously approved C V8.1 (itself derived from Quaternius CC0 Soldier outfit), pistol from approved earlier C model, arena already in the repository. Sound recordings CC0: https://opengameart.org/content/the-free-firearm-sound-library; source excerpt info https://github.com/yegors/hard-lines/blob/main/public/audio/README.md.
