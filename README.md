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

## Approved Home & More shop layout

The game director approved the definitive L1 retail interior on 21 November 2026. See [the approved shop artwork and migration notes](docs/art/home-and-more-shop-approved.md). The master PNG and optimised WebP are preserved in the ChatGPT Library; the existing Tiled map remains the live collision/scene source until the approved artwork is aligned and copied into the repository. Do not silently replace the shop geometry with a stretched image.

## Artwork & cutscenes

Artwork belongs in `public/assets/cutscenes/<chapter>/`, where it is copied to `/assets/cutscenes/<chapter>/` during build. For example `public/assets/cutscenes/mall/yael-portrait.webp` is a 4:5 anime character illustration optimised for web delivery. The visual cutscene player is not wired into gameplay yet; the original phone cutscene system is unchanged. Avoid base64-embedding large images into source files.

For new artwork, use Squoosh or equivalent to export compressed WebP/AVIF and check the result visually. Aim for compact files without destroying line art or legibility.

## Deploy to GitHub Pages

**GitHub is the source of truth and the designated publishing host.** The workflow in `.github/workflows/pages.yml` tests the code and publishes `dist/` on pushes to `main`.

To turn on publishing once, visit [repository Settings → Pages](https://github.com/cryogenized-spec/Hero-shooter/settings/pages), set **Build and deployment → Source → GitHub Actions**, then save. The normal `GITHUB_TOKEN` cannot create the initial Pages site automatically. After that, run the existing **Build, test and publish Hero Shooter** workflow or push a change to `main`.

Expected site address after Pages is enabled and a deployment succeeds:

https://cryogenized-spec.github.io/Hero-shooter/

Both game entry points are in the static build: the title screen at the site root and the current gameplay implementation at `/play/`. The exact MP3 and C's approved portrait are copied into `dist/assets/` by `npm run build`.

**Verification:** An Action's passing *build* does not prove the *deploy* job succeeded. Confirm that the **deploy** job is green and that the Pages URL loads before sharing it. A `404 Not Found` from `actions/deploy-pages` generally means Pages has not yet been initialized or the source is incorrect. This is a repository configuration issue—not a reason to migrate hosting.

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

## Complete Gemini v10.1 integration (19 November 2026)

The previously pasted incomplete update has now been superseded by the **complete** `hero_shooter(1)(1).html` source, preserved in `reference/gemini-v10.1-complete-2026-11-19.html`. This is a substantially rewritten game, not an append-only patch to the existing engine. The new version is accessible through the approved root title screen's **START** and **CONTINUE** controls at `play/`, while the original modular version remains selectable via **OPTIONS → PLAY PREVIOUS BUILD**. All five chapters remain available in both. This arrangement avoids silently replacing the previously optimised simulation while the new engine receives full playtesting.

The v10 game is separated into `public/play/index.html`, `public/play/styles.css`, and `public/play/game.js` and is copied directly into the static build. The newer lookahead/reverb music engine is present. The existing game's optimisations are unchanged; the v10 engine additionally avoids redundant ammunition-icon DOM rendering and offscreen background fill operations. Full performance parity should be benchmarked before removing the previous build. The Gemini v10 layout currently still depends on Tailwind's browser CDN, which should be replaced with compiled local CSS before declaring the game fully offline-capable.

The title's **CONTINUE** selection remembers the last started chapter but does not restore a mid-chapter save.

## Story and condition system (work in progress)

The editable Chapter 1 continuity notes live at `docs/story/chapter-01-sunday-opening.md` and are **not** included in the public web build. Local uncommitted screenplay drafts can be kept in `story-drafts/` (ignored by Git). Git ignores cannot hide a committed file from GitHub code search; use `docs/story/` for versioned story and `story-drafts/` for notes that must stay local.

The v1 gameplay condition model is in `public/play/condition.js`, loaded before `game.js`. Injuries can persist as a status, larger wounds can cause continuing health loss, and **H** (or the mobile **CARE** action) consumes one fictional field-care item to stabilize ongoing bleeding without restoring lost health. Food/water restore energy/hydration reserves and thereby support gradual stamina recovery, **not health or instant stamina**. Rest-based *partial* recovery is exposed as a tested helper for future **actual** linked-chapter transitions; the current standalone chapter picker does not apply rest or persist conditions between characters.

Ordinary gameplay no longer renders the AI sight wedges. Set `window.HERO_DEBUG_VISION = true` before launching a chapter to inspect the original debug cones. A fuller distinction between noticing a person and choosing to confront them belongs to the later map/AI redesign. isiZulu text snippets are provisional. This one-person project will refine them through AI cross-checking and repeated in-game listening; no outside human reviewer is required.

## Home & More — playable Sunday-morning blockout

Select **Home & More — Opening** from the existing **/play/** chapter selector, or open **/play/?chapter=shop**. The earlier Mall Blockade chapter remains selectable as a separate stage. The shop scene uses the existing game canvas and menu; it is not an unrelated demonstration.

The source of truth for the physical shop is **`public/play/maps/home-and-more.tmj`**, an object-layer Tiled Map Editor-compatible JSON file on a 40-unit grid. Open it in Tiled to move its labelled objects; the renderer uses them for both visual layout and collision rather than duplicating their coordinates in the scene code. The current map is a deliberately limited architectural first slice, **not** a size limit for the full mall.

- **Sales floor (L1):** broad centre-front folding doors with an outer shutter track, two tills immediately to the right, adjacent sensitive-item counter, lighting/CCTV corner, ten long shelves with transverse connecting aisles, patio/furniture, plumbing and pool supplies, trolley bay, separate canteen, a pallet-filled secure stockholding section and a freight-lift enclosure.
- **Office (mezzanine):** U-turn staircase connects to Mrs. Chen's independent upstairs payroll office, with desk, cabinet, printer and glazed outlook with aluminium blinds.
- **People:** Mr. Chen, Wei Chen, Mrs. Chen, and four volunteers with light working routines in pairs. Dialogue is basic and isiZulu staff chatter is deliberately short and provisional; it can be cross-checked with another AI but does not require human reviewers.
- **Interactions:** WASD/arrows move, Shift speeds up, E speaks or uses a nearby object, Tab switches between nearby people, Esc closes a conversation. Mobile directional buttons and TALK/NEXT controls are included. Voluntary payslip delivery and bringing water to Mrs. Chen have in-session persistent state.
- **Boundaries:** this is a walkable, peaceful opening **blockout**. Cutscene escalation, exterior crowd, shutters closing under pressure, freight-lift travel to the G loading bay, proper lighting occlusion, NPC voice acting, true portrait art for the Chens, saves and the full mall site map are future work. No combat is initiated in the Sunday shop blockout.

The prior story treatment remains at **`docs/story/chapter-01-sunday-opening.md`**. Work-in-progress personal narrative drafts may be kept under the Git-ignored **`story-drafts/`** path.

### GitHub Pages publishing safeguard

GitHub Pages can be configured to publish either **GitHub Actions build artifacts** (recommended) or the **root of `main`** using its automatic Jekyll build. These are **not the same directory layout**.

- The custom `.github/workflows/pages.yml` builds `dist/`; `public/play/index.html` is published at **`/Hero-shooter/play/`**.
- When the site's source is instead **Deploy from a branch → main → /(root)**, the same file is published at **`/Hero-shooter/public/play/`**.
- A separate root `play/index.html` redirect exists to make **`/Hero-shooter/play/?chapter=shop`** resolve in the branch-publishing case too. It is *not* packaged into `dist/`; the proper build retains the real game at `play/index.html`.

**Preferred one-time GitHub setting:** Repo → Settings → Pages → Build and deployment → Source = **GitHub Actions**. This disables the competing automatic Jekyll deployment. Until that setting is changed, the fallback keeps the advertised game path working in either mode. A successful workflow check alone does not verify which site's directory was served.

If a link 404s, check the published deployment artifact contents and the current Pages source before claiming a deployment succeeded.

## Public chapter selector and approved animated sprites

The root site **`/Hero-shooter/`** is the main title screen. Its approved retro-anime art has working **Start**, **Continue**, and **Options** hotspots. **Start** launches a new `Home & More` shop intro through `/play/?chapter=shop&autostart=1&fresh=1`; **Continue** uses `resume=1` and retrieves the shop character's saved position, office/sales-floor level and optional errands from localStorage. Return to the title via the **STAGES** control. All other chapters and the older root game engine are retained in source for development, but no legacy chapters are selectable from the normal UI or URL.

The shop and its NPCs use **the procedural sprite renderer from Codex PR #8**, now extracted into `public/play/sprites.js`: olive-flannel C silhouette, independent stride animation, actual travel direction and distinguishable human NPC sprites. This is *procedural Canvas art*, **not** an invented sprite sheet. During the peaceful Sunday-morning scene, C's weapon is not drawn. Codex's original PR #8 remains available separately while its reusable sprite logic is adopted in the active playable shop.

The title image is also present under `assets/title/` (identical Git blob to `public/assets/title/`) so both Pages source modes resolve it. `/play/` without the `autostart=1` flag routes to the approved main title rather than showing the old stage menu.
