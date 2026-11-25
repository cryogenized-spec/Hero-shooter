# C anatomical trial — independent prototype for comparison

This **experimental alternative** is created from the real CC0 MakeHuman HM08 base mesh, blended with official `female-young` and `averagemuscle-averageweight` macro-target files, followed by independently authored C-specific accessories and anime facial markings. It is **not** a Blender or MPFB session, despite relying on the same MakeHuman mesh/target source the plugin uses. The Python script constructs the resulting scene with trimesh and renders it with VTK. No V6.1 assets are overwritten.

The old C prototype was ~2.135 m including hairstyle. This trial assumes a **1.68 m human stature** (the figure's hair adds a bit more height), as a design choice within adult population reference data. No canonical height or personal body measurements for C were recorded earlier, so these are illustrative, not factual. For broad context the UK women's median (50th percentile) values in the RoyMech anthropometry table are 1.62 m standing height, 0.44 m shoulder breadth (bideltoid), 0.365 m shoulder breadth (biacromial), 0.185 m head length, and 0.240 m foot length. These are population descriptors rather than measurements of C or parameters guaranteed by the MakeHuman morphs.

## Generate

`python -m pip install -r tools/hero-3d/c-anatomical-trial/requirements.txt`

`python tools/hero-3d/c-anatomical-trial/build_c_anatomical.py --out dist/c-anatomical-trial`

The official source files are downloaded at build time and their checksums recorded. An actual internet connection is required; local restricted runtimes cannot complete the MPFB-derived build. The source commit is pinned for reproducibility. The build produces a genuine GLB, four viewpoints and JSON metadata. Repo Actions archives the large GLB separately rather than committing it to gameplay.

## Limitations

- Experimental character **base mesh and static outfit**, **no rig** or ready-to-use locomotion. Visual details are procedural approximations of C's approved anime portrait, not an automatic transfer of V6.1 custom geometry.
- This is a trial of the MakeHuman anatomical foundation, **not the official MPFB program executing a preset**. The macro targets and the CC0 mesh are official and licensed; the particular blended preset, costume and expression decals are our own recipe.
- GLB contains real geometry and vertex/face colors, no texture image. It is intentionally separate from C V6.1. Acceptance requires visual comparison and possible further sculpting.

## Sources and licence

- MakeHuman HM08 base and targets: https://github.com/makehumancommunity/makehuman (official CC0 core graphical assets)
- MakeHuman license: https://github.com/makehumancommunity/makehuman/blob/master/LICENSE.md
- MPFB model/phenotype docs: https://github.com/makehumancommunity/mpfb2/blob/master/docs/ui/new_human/newhuman.md
- MakeHuman coordinate and decimeter convention: https://static.makehumancommunity.org/makehuman/docs/exports_and_file_formats.html
- Anthropometry: https://www.roymech.co.uk/Useful_Tables/Ergonomics/Human_sizes.html