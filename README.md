# Hero Shooter

A top-down, chapter-based browser action game set in South Africa, developed collaboratively with creative direction from the game director and iterations originating in Gemini.

## Chapters

- **Prologue:** Pine Ridge Airsoft Skirmish — young Yael, G, and Blaze.
- **Chapter 1:** The Mall Blockade — Yael.
- **Chapter 2:** Joburg CBD — Blaze.
- **Chapter 3:** Sniper Overwatch — The Uncle.
- **Chapter 4:** The Suburbs — G.

## Development

The code is deliberately lightweight: **native JavaScript ES modules + HTML Canvas 2D**, with **no dependency install required**. The first migration extracts only stable, low-coupling systems (CSS, math, weapon data, portraits, sound); the core simulation remains in `src/main.js` until it can be disentangled safely, with behaviour-preserving tests.

```bash
npm run check    # Check JS syntax
npm test         # Check preserved baseline and campaign definitions
npm run build    # Generate deployable dist/
npm run preview  # Serve dist/ on localhost:4173
```

The exact, unmodified latest Gemini revision is in `reference/gemini-original-2026-11-19.html`; its SHA-256 digest is in `reference/original.sha256`.

## Artwork & cutscenes

Artwork belongs in `public/assets/cutscenes/<chapter>/`, where it is copied to `/assets/cutscenes/<chapter>/` during build. For example `public/assets/cutscenes/mall/yael-portrait.webp` is a 4:5 anime character illustration optimised for web delivery. The visual cutscene player is not wired into gameplay yet; the original phone cutscene system is unchanged. Avoid base64-embedding large images into source files.

For new artwork, use Squoosh or equivalent to export compressed WebP/AVIF and check the result visually. Aim for compact files without destroying line art or legibility.

## Deploy to GitHub Pages

The workflow in `.github/workflows/pages.yml` tests the code and publishes `dist/` on pushes to `main`. Once Pages is enabled for **GitHub Actions** in repository **Settings → Pages**, the expected URL is:

https://cryogenized-spec.github.io/Hero-shooter/

A GitHub Actions run is not proof that Pages has been enabled; confirm the deployment in the Actions tab and open the actual site URL.

## Collaboration workflow

The GitHub repository is the source of truth. Gemini can continue prototyping and proposing story, UI, and gameplay changes. Save its revised HTML or targeted snippets as new source material, compare with the current repository, and integrate on branches with review and tests. Preserve intentional creative decisions instead of rewriting the atmosphere around engineering preferences.

## Migration roadmap

1. Verify that all five chapters launch in the modular version (desktop and mobile).
2. Extract input and HUD systems behind explicit interfaces.
3. Extract campaign data, world creation, and entity state incrementally.
4. Implement artwork-based cutscenes as a separate, data-driven layer.
5. Add browser gameplay regression tests and automated visual baselines.

Avoid simultaneous wholesale refactors and gameplay changes.

## Anime title screen

The approved 16:9 retro-anime title artwork is stored as `public/assets/title/hero-shooter-title.webp` (WebP). Its visible START / CONTINUE / OPTIONS labels are part of the artwork. Transparent accessible HTML hotspots in `index.html`, styled in `src/styles.css` and wired through `src/ui/title-screen.js`, make the menu interactive without duplicating the printed UI. START opens the existing five-chapter selector. CONTINUE reopens the selector focused on the most recently played chapter—it does **not** restore in-game progress, because there is no checkpoint save system yet. OPTIONS contains a functional music-on-start preference and fullscreen toggle.

For future localised menu text or redesigned buttons, create a *text-free* export of the art and render the buttons as independent HTML elements. The source image was deliberately preserved here to match the approved composition.

## Performance optimisations (November 2026)

The gameplay and artwork are unchanged. This pass addresses wasted CPU and DOM work, not the simulation rules or rendering resolution:

- **HUD:** only rewrite labels, ammunition counters, cartridge graphics, and weapon-slot HTML when values actually change; handle weapon-slot clicks through one delegated listener. Visual updates still happen immediately on state changes, rather than throttling the HUD.
- **Minimap:** rasterise static roads, buildings, mall zones and terrain once per generated world, then draw changing characters, vehicles, pickups and the pulsing mission marker each frame. A campaign reset invalidates the cached terrain.
- **Rendering:** skip off-screen roads, rail tracks, crosswalks, persistent decals, effects and characters; their world updates and AI continue normally.
- **Geometry:** use cheap axis-aligned exclusion checks before exact intersection and circle-versus-building calculations. The original collision and line-of-sight calculations still apply when potentially intersecting.

The Node regression tests compare 1,203 deterministic geometry queries against the preserved Gemini source. All five chapters were manually launched in Chromium (including a phone viewport) and weapon-slot interaction was checked. In short, headless-browser checks, the mall's measured game-loop time dropped from roughly **5–7 ms to about 3 ms per frame**. These are limited measurements on a single test environment, not guaranteed device FPS gains. No fidelity settings, assets, chapter content or entity counts were reduced.

## Gemini gameplay snapshot (19 November 2026)

The supplied `Pasted text(20261119-172530).txt` was truncated in the middle of a second, unfinished audio engine and lacked the game-loop/bootstrap footer. Its exact text is archived as `reference/gemini-incomplete-2026-11-19.txt`, **not** served as the game entrypoint. The modular build recovers the completed gameplay portion using the last complete Gemini chapter update for missing CBD world setup and lifecycle functions, while keeping the approved 16:9 title screen and the geometry/HUD/radar performance safeguards. The working, earlier procedural audio engine is deliberately retained: the unfinished 32-bar audio upgrade is *not* claimed as implemented.

The reconstructed build includes the four-level mall, interactive NPC conversations, crouch/sneak (keyboard `C` and the touch SNEAK control), corpses with persistent drawing states, and the existing five chapters. The repository tests are supplemented by manual Chromium smoke checks for all five chapter starts, desktop/mobile sneak toggles, and title-menu interactions. Since this is a recovered snapshot, it should still receive full human playtesting, especially chapter progression and level transitions.
