# C V8.1 live arena: GitHub Pages root alias

GitHub Pages currently serves Hero Shooter using the repository-root document tree. Therefore `public/c/index.html` is accessible at `/Hero-shooter/public/c/` but **not** at `/Hero-shooter/c/`. To make the advertised `/c/` URL work, a Git tree alias at root `c/` reuses the exact existing `public/c/` tree blob. No binary re-upload or asset rebuild occurs.

The `/c/c-demo.js` loads the scrapyard GLB and navgrid through the relative `../play/assets/procedural/scrapyard/` route. The source for those files is `sophia/play/assets/procedural/scrapyard/`. This commit adds three same-SHA Git references at `play/assets/procedural/scrapyard/`; both routes reuse the same repository blobs. No additional 16MB Poly Haven alternate asset is published via the alias.

Separate Vercel/build-system publishing remains handled by `scripts/build.mjs` which copies the same three files to `dist/play/assets/procedural/scrapyard/`.

C’s 3D model, weapon meshes, animation prototype and camera controls are unchanged; undo this alias commit to restore prior routing.