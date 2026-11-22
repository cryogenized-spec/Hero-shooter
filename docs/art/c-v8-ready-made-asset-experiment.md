# C V8 — pre-existing mesh assets only (experimental)

This branch is an isolated **asset acquisition** trial. The character is assembled from **already-made meshes** only: Quaternius's *Ultimate Modular Women / Soldier* for the outfit, trousers, boots and skin-coloured hands; the CC0 *Plate Carrier with Pouches* by 3DAssets.dev for the optional vest; and pre-existing Hero Shooter C V7 face, hair, floral band, earrings and scarf meshes. No primitive accessories or newly sculpted clothing is generated. All donor assets have rigid coordinate transforms and palette recolours only.

**Original source packs**

- https://quaternius.com/packs/ultimatemodularwomen.html (Quaternius, pack states CC0)
- https://github.com/trebeljahr/quaternius-showcase/tree/main/public/glb/modular_women (readymade GLB archive; its LICENSES.md maps this pack to CC0)
- https://3dassets.dev/assets/fps-survival-forest-outpost-plate-carrier-2ac4f423 (additional plate carrier, listed CC0)
- Existing C V7 project-owned models, not replaced in-game

**Two candidate outputs created locally for comparison:** V8A uses the Quaternius body/outfit only; V8B also fits the plate carrier. The assembled GLBs are static T-pose exports, **not skinned or rigged**. Original Quaternius donor assets retain their source rigs. The source GLB may contain animation data, but it has not been transferred to the composite.

The runnable Python/VTK assembly script, source meshes, GLBs, QA manifest, and four-view previews have been bundled separately as `C_V8_Ready_Made_Asset_Experiment.zip` in the ChatGPT conversation that created this branch. **Do not use this experimental branch as a game runtime dependency.** V6.1 and V7 are unchanged. Only merge source/tools after visual approval; do not replace the current character.

For licensing, favour the Quaternius original pack page over mirror badges and credit Quaternius regardless. 