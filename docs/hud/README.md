# Hero Shooter — gothic HUD + quick-selector icon integration

This package is an installer for the **current browser game** in `cryogenized-spec/Hero-shooter`. It uses the green-screen HUD from the prior step and the two newly provided weapon sheets, with the **large close-up Beretta and engraved revolver replacing the smaller versions** in the first sheet.

## Files

- `assets/ui/hero_shooter_hud_transparent.png`: 2048×1152 transparent portrait / minimap / D-pad / ammo frames.
- `assets/ui/weapons/*.png`: eight separate 512×512 RGBA icons extracted from the user-supplied reference sheets, with neon green removed.
- `ornate-hud.js`: dynamic vitality hearts, a smoothly rotating player-centred map with a stationary chevron, a bronze-toned condensed digital ammunition readout and weapon label.
- `weapon-quick-select.js`: four clickable direction slots with **two pages of icons**, selected-slot lighting, keyboard handling and a future inventory integration API.
- `install.py`: idempotent local patch installer for existing `public/play` code. Installs art and scripts; does not delete or alter underlying combat logic.
- `preview.html`: inspect layout without running a campaign.

## Install

```bash
unzip hero_shooter_hud_with_weapons.zip
python3 hero_hud_patch/install.py /path/to/Hero-shooter
cd /path/to/Hero-shooter
npm run check
npm test
npm run build
npm run preview
```

On the current playable Sunday Home & More branch, open the game through its title screen. The HUD uses the Home & More architecture for the minimap. The game has no ammo/equipping system there yet: **the quick selector visually previews the supplied assets but does not secretly grant or equip weapons**, and the ammunition area stays blank.

On the earlier combat engine, hearts/ammo/minimap reflect `player.hp`, `player.ammo`, `player.spareMags`, and `minimapCanvas` from the existing game state. These are NOT baked into image files.

## Quick selector

The default preview shows two pages:

- **Page 1:** up: Beretta 84FS; right: pump shotgun; down: CANIK TP9; left: NORINCO AKM.
- **Page 2:** up: engraved revolver; right: Fairbairn–Sykes knife; down: AKM-pattern bayonet; left: Spetsnaz knife.

Click one of four icons (or press **1–4**, matching up/right/down/left) to highlight it. Click the small center page indicator (or press **[** and **]**) to cycle pages. These inputs do not interfere with WASD, E, R or Q. Selection dispatches `hero-quick-selector:select` with itemId, direction, page, slot, previewOnly. No real weapon state is mutated unless a future game-system `window.HeroInventory.equipQuickSlot(id, index)` method is installed.

`window.HeroQuickSelector.setPages([['beretta_84fs', 'fairbairn_sykes', null, null]])` lets chapter logic replace the preview icons with only the player's actually owned items, one page of up to four at a time. The script exposes `catalog`, `showPage(index)`, `select(slotIndex)`, and `getState()`.

## Limitations

- This installer is retained for local checkouts; the source integration is committed to the Hero Shooter repository. Running the installer again is safe.
- The current Home & More scene has no weapon-equipping, inventory ownership, or ammunition state, so icon selection is visual until the game's underlying mechanics support it.
- The transparent icons are **raster** 512px assets, designed for the small selector; the original reference sheet may not precisely represent every historical make/model.
- The ornamental art is 16:9; other aspect ratios are letterboxed to keep frame positions accurate. The minimap rotates with player heading while the central chevron remains fixed.
- There are no new player-life counters: **vitality hearts follow HP**, not an invented respawn/lives mechanic.
