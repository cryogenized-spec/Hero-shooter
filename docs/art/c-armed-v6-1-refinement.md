# Hero Shooter — C Armed V6.1 experimental facial and hand contact refinement

This revision **does not replace V6**, does not replace the game's runtime sprites, and does not modify the existing production entry point. It is a *new* candidate model for review.

## Scope

- Small, smooth facial volume adjustment (maximum recorded displacement 12.5 mm) + face-specific rounded vertex normals; painted anime eyes and UV texture retained exactly.
- Idle pistol shifted slightly toward the palm to appear properly held while muzzle remains down.
- Eight-phase moving two-hand low-ready geometry preserved; left hand continues to support the pistol.
- Extended aiming morph corrected by moving distal wrists toward the grip while tapering the adjustment up the forearm.
- Retain 47 original material mesh groups, all 9 morph targets/group, and all 5 clip names and timings.

## Geometry QA

- Aiming right-hand proximity to decorative gun grip: original V6 minimum 48 mm; experimental V6.1 minimum 1.6 mm.
- Idle right-hand proxy has more contact-near vertices, though the distribution also changed. Proximity is not a physical grip or proof that there are no overlapping surfaces.
- The changes remain a first-pass morph target repair, **not a skinned rig or an IK hand solution**; check actual game-camera perspective before acceptance.
- The original V6 model is unchanged, with SHA-256 `5a05801aca81252df9151dd7dac814ceefcef69b5f63d9add8677cd6432f419f`.
- Candidate V6.1 GLB SHA-256 `281024446c786e531d616be2b318bb551a9b465d711c2c820b4a6b31b829bb91`.

## Reproduce and roll back

```sh
python tools/hero-3d/c-armed/retouch_c_v61.py \
  --input /path/to/C_armed_v6_twohand_lowready_optimized.glb \
  --output-dir /tmp/C_armed_v6_1
```

Use the original V6 GLB (previous source file) in the character loader to roll back. Keep both named outputs; never force overwrite. The project's V6 generation source and workflow remain at `tools/hero-3d/c-armed/` and `.github/workflows/build-c-armed-3d.yml`.

Detailed VTK preview images and the updated animated GLB are kept in the project's ChatGPT Library working collection under `Hero Shooter / Characters / C - Protagonist / C Armed V6.1`. They are not committed as large Git blobs.