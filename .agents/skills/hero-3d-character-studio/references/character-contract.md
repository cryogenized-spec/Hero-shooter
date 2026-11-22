# C — canonical 3D modelling reference

**Source of truth:** approved full-body C character artwork in ChatGPT Library at `Hero Shooter/Approved Artwork/C - Canonical Character Artwork.png`. This is a reference location, **not an automatically available local file**. Locate/download/attach it before claiming an exact visual match. Existing first-pass VTK prototype is a *baseline*, not approved final topology.

## Silhouette and identity

- Auburn-brown hair, high messy ponytail/updo with loose strands; decorative **white floral Alice band** seated along the hair surface.
- Freckles, warm complexion, expressive brown/amber eyes, no spectacles. Hoop earrings.
- Restrained, energized asymmetric smirk: modest elevation on **C's anatomical right** mouth corner; full lips with subtle natural volume, **not** a baring-teeth grin or villain expression.
- Charcoal rolled-sleeve tactical clothing, black-and-white keffiyeh-patterned scarf, olive/tan chest rig and utility pouches, fingerless gloves, cargo trousers with knee pads and sturdy brown combat boots.
- Unarmed default: both hands empty, arms rested by sides, balanced pose. A holster or pouch may remain as costume but not a held weapon.

## Fidelity priorities

1. Preserve overall proportions, head silhouette, hairline, facial expression and clothing color blocks.
2. Avoid cosmetic changes to the accepted design when repairing geometry (e.g., do not replace the hair, change the scarf pattern, add glasses, or change face age/identity).
3. Model nose and lips as anatomically plausible surfaces integrated with the face; accessory geometry can remain separate if visibly attached. Maintain contact under all camera angles.
4. Keep flower band, eyes, scarf and tactical equipment as deliberate independent pieces when useful for later rigging or material editing.
5. Never quietly assert a generated image is an exact canonical model; always compare with approved art and get approval for visual deviations.

## Reference format and deliverables

- Use the approved 2D illustration as the image reference, an existing GLB/OBJ as geometry source, and side/back render previews as verification (not as new canonical art).
- Keep a versioned, editable work file; export a GLB in metres or explicitly documented units with stable world axes. Document intended runtime scale.
- A sculpted unrigged model and a rigged runtime model are separate milestones.
