# C at Golden Dragon — playable Level 1 mall scene

New independent Three.js 3D exploration level, preserving the original C scrapyard sandbox and the 2D Home & More map.

**Place:** Golden Dragon, a Chinese shop in a Sandton mall, Level 1, early morning (~07:00) during a power failure. Mr. Chen is beside the checkout and opens a short introductory dialogue. The player can inspect the stockroom, front shutter, display shelves and mall concourse.

**Character:** The user-supplied full-body anime concept illustration is used as an optimized WebP portrait in the HUD. The in-world actor remains the existing original C V8.1 stylized 3D GLB with the existing pink prop. Added a minimal original 3D white floral hairband and silver earrings as a decorative connection to the reference artwork. **The picture has not been converted into a photorealistic 3D model**, and the in-world C mesh is only an approximation of its facial features, hair, scarf and costume.

**Map:** Original renderable 3D shelf units, boxes, display products, storefront glass, counter and registers, rear stockroom facade, lanterns, Golden Dragon signage, emergency lights and a short mall concourse. Axis +Z up; X east/right, Y north/back of shop. Store ~18m wide; concourse ~33m wide. There are walk-blocking fixture rectangles; full navmesh and upper floors do not exist.

**Controls:** WASD movement, Shift sprint, Space jump, hold right mouse button and drag camera, scroll zoom, E interact, R restart at entrance, V overhead/follow camera, H hide HUD, 1/2 equipment pose. Mobile touch pad. The level focuses on narrative exploration and does not implement firing.

**Files:** public/c-mall/index.html, mall-scene.js, mall-geometry.js, c-appearance.js, assets/c_portrait.webp. Reuses public/c/assets/C_V8_1_skull_refined_with_vest.glb.gz and C_pink_compact_pistol.glb.gz, and public/play/assets/procedural/mr_chen_hybrid_face_v2.glb. Browser QA script: scripts/qa_c_mall.mjs; GitHub workflow: .github/workflows/qa-c-mall.yml.

**Online:** https://cryogenized-spec.github.io/Hero-shooter/c-mall/ via the authorized main-branch GitHub Pages workflow, which checks out this feature and publishes it without merging its source. Main's C sandbox remains https://cryogenized-spec.github.io/Hero-shooter/c/.

**Collision and scene limitations:** Ground level only. Mr Chen is unrigged; C V8.1 uses approximate arm and walk movement, not a fully skeletal body with individually articulated fingers. The fixture models are simple procedural prototypes, not an imported mall architecture model. Keep Home & More artwork and historical main campaign unaffected.

**Browser QA:** npm checks, 1600 × 960 actual WebGL screenshots and playable path test for C walking, occupied shelf cells, shop-to-mall continuity, original portrait load and Mr Chen E dialogue.