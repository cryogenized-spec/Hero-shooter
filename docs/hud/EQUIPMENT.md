# Home & More — live equipment and HUD state

The Sunday prologue now has a **real, saveable inventory** and a working four-direction quick selector. The HUD reads ammunition, reloading, selected equipment and vitality from the same state object. No ammunition values are baked into the artwork.

## Play the normal story

Load `/play/?autostart=1&fresh=1`. The canonical starting inventory includes the 84FS and the engraved backup revolver. Only owned items are selectable; unavailable items remain dimmed. Select slots with **1–4** or click, change selector page with **[ / ]**, **R** reloads an eligible item, and **H** holsters or draws the selected item. Acquiring additional items is an explicit story event through `window.HeroInventory.grantItem(id)`; no random weapons are assigned.

## Optional armory test

Load `/play/?autostart=1&armoryTest=1&fresh=1`. This separate test save includes all eight item icons, so every slot can be equipped for QA. Click the floor or press **Space** to spend a *virtual* round with visible cosmetic feedback; the peaceful shop NPCs are not attackable. Reload with **R**. Melee items have no ammunition. Test inventory cannot overwrite the ordinary narrative save. The normal story does not fire inside the shop.

## Architecture

- `shop-equipment.js` owns the inventory, equipment choice, magazine counters, reload timeline, serialization and story-grant API. It has no dependency on UI or browser APIs.
- `shop.js` owns the runtime state and shares it with the HUD and selector through `HeroInventory` and `HeroShop.getHudSnapshot`.
- `weapon-quick-select.js` now rejects locked/unowned items, highlights only successful equipment selections, and can sync the equipped item after restoring a save.
- `sprites.js` draws a stylized silhouette for the equipped item rather than incorrectly showing the previous pink pistol for everything.
- `ornate-hud.js` reads the live counter and shows an item name for melee equipment while hiding ammunition values. The world map rotates beneath the fixed centre chevron.

## Validation

`node --check public/play/shop-equipment.js && node --test tests/shop-equipment.test.mjs && npm run check && npm test && npm run build`

The current prologue remains a peaceful exploration scene; full NPC combat systems and the user-authored story progression are separate future game features.
