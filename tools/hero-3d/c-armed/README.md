# Hero Shooter — C armed V6: compact two-handed low-ready

This is **real 3D geometry** created with VTK and glTF morph-target animation. It preserves the approved V3 anime-painted face, V4 paced walking gait (8 phases / 1.08 s), and the V5 stylized pink pistol with red-dot and underbarrel light. **V6 changes the moving low-ready pose to a two-hand grip**, with the supporting left wrist close to the right hand around the centre of her torso. Idle is one-handed, muzzle down; extended aim is two-handed. No firearm manufacturing dimensions are provided.

## Build reproducibly

```bash
python -m pip install -r requirements.txt
# Headless Linux: run under xvfb-run -a where needed.
python build_release.py
```

The first script creates C V3 geometry and UV-painted face, the second creates the 8-pose walk, the third makes the three armed states plus five glTF animation clips and front-facing 8-frame sprites, then `optimize_c_glb_lossless.py` removes only **exact** redundant vertices and reindexes mesh primitives and morphs without deleting animation clips. It preserves all 47 mesh groups and nine morph targets per group. Output is in `dist/` and `C_armed_v6_asset_pack.zip`.

Only **source code and the build workflow** are committed to the repository, avoiding the space overhead of multiple successive 15 MB models and generated images. GitHub Actions publishes generated files as a downloadable workflow artifact after a successful run. The workflow does **not** integrate these GLBs into the current 2D canvas runtime.

## Runtime size policy

- For the existing top-down Canvas2D game, prefer small directional PNG/WebP atlases; `C_armed_twohand_south_8frame_40x48.png` is a tiny **South/front** development preview **only** (not a full 8-direction atlas).
- The optimized `.glb` is for 3D game use and asset inspection. The `.glb.br` is a compressed **transport** artifact, not a directly parseable GLB; the server must decompress with `Content-Encoding: br` or the client must decode it before passing it to glTF loader.
- Avoid shipping V3, V4, V5 and V6 simultaneously. Load only the assets actually needed by the selected scene; keep full-resolution previews and unreduced source out of runtime bundles.
- 3D model remains **morph-target animated, not skeletal/rigged**. The hand-to-grip pose is a stylized visual approximation rather than finger-level hand IK.
- For screen bearings consult `docs/art/sprite-bearing-contract.md`: South ↓ shows face/front, North ↑ shows back; 8 walking phases **do not mean** 8 directions.

## Attribution

C is an original Hero Shooter character; the stylized pink pistol is an original game-art mesh based on the Hero Shooter Library visual atlas. No third-party model or animation assets are included. Prior approved geometry remains preserved in Library.