# Facial and accessory mesh repair — technical protocol

## 1. Establish evidence before editing

Capture orthographic front, both profiles, three-quarter, top and rear views with stable lighting and the same camera distance. Inspect the component hierarchy, object transforms and materials, especially `skin`, `lip`, `hair`, `headband`, `flower` groups. Preserve the original file as a versioned checkpoint.

Run `python scripts/mesh_audit.py input.glb --output audit.json`. The script reports per-group triangle counts, dimensions, rough nearest-vertex distances and data integrity, **not** actual surface-attachment certification. Very small or large proxy gaps are only leads to examine visually. For real surface gap tests, use actual point-to-triangle closest-point queries (`vtkStaticCellLocator`, Blender BVH or another geometry library), sampling candidate surfaces densely and checking penetration/overlap.

## 2. Lips and nose

1. Identify whether features are truly disjoint mesh islands or simply separate material-group surfaces intended to overlap.
2. If starting with an ellipsoidal/primitive nose, build the nose from a **continuous head mesh** in Blender. Voxel remesh only a *duplicate* of the head-related surfaces (not the full clothed character), use sufficient resolution to preserve the face, and refine bridge, alae, tip and nostril transitions. A watertight voxel remesh may erase small details: keep an original duplicate and compare.
3. Build lip volume with upper/lower vermilion forms and a subtle philtrum; follow curvature of the face, embed lip surfaces into the facial geometry and shape both corners. Sculpt a modest asymmetric smile with the character's **right** corner raised; avoid separate horizontal cylinders or a deeply carved grimace.
4. Check nose/lip continuity in side profile under neutral light, from above at three-quarter, and in wireframe. If separate lips are retained for expression controls, explicitly skin/anchor them and ensure seamless contact under animation.
5. Retopologize facial loops if later blendshapes or jaw motion require deformation; ensure correct normals, no self-intersections and a plausible mouth cavity when needed.

## 3. Alice band and flowers

1. Use the hair/scalp surface as the attachment target, not an arbitrary global Z offset.
2. In Blender, a Curve with bevel, a shrinkwrap modifier with an appropriate target and offset, or per-vertex nearest-surface projection can follow the head. Restrict projection to intended contact regions and keep the band **above** hair surface, not buried under it.
3. Join flower elements to the band assembly (or parent them with stable transforms); tiny independent decorative meshes are acceptable if they visually meet their base and remain attached through poses.
4. Preview from side, top and back; confirm the band follows hair curvature without floating or clipping.

## 4. Retopology, hierarchy and export

- Keep separate geometry for garments and accessory materials, but avoid orphaned tiny parts or inconsistent normals.
- Preserve source scale; record metres/unit and axes. Apply transforms when needed before export, but do not corrupt rig/armature transforms.
- Use clear names (`head`, `face`, `lips`, `nose`, `headband`, `flower`, `scarf`, `body`, `hands`) in new clean meshes. Material-only merged collections may need manually assigned semantic names for validation.
- If not rigged, label the GLB **static/unrigged**. If rigged, test jaw, head turn, shoulder movement and idle posture; verify hairband tracks the head with no gaps.
- Check GLB in an independent viewer, compare against screenshots, and confirm materials/transparency survive export.

## 5. VTK vs Blender

VTK: `vtkPolyData`, `vtkAppendPolyData`, `vtkCleanPolyData`, `vtkPolyDataNormals`, `vtkStaticCellLocator`, `vtkCollisionDetectionFilter` (when appropriate), plus offscreen render regression. `vtkAppendPolyData` joins datasets **without** automatically welding their surfaces. `vtkCleanPolyData` only merges coincident/nearby vertices; it does not magically fix arbitrary spacing or make a believable nose/lip transition.

Blender: `bpy` editing/sculpting, shrinkwrap, remesh and retopology, normal fixing, UV/material checks, export `bpy.ops.export_scene.gltf(export_format='GLB')` with configured add-on. Some Blender operators depend on context/GUI; use mesh-data APIs or explicitly create selection/context in headless scripts.

Do not install or execute third-party assets/scripts until reviewing them. Exact geometry acceptance always requires camera/lighting comparison; raw vertex-to-vertex nearest distance is only a proxy.