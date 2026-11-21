import { looterLooks, drawLooterJacket, drawLooterHead } from './looter-art.js';
import { setupTitleScreen } from './ui/title-screen.js';
import { Math2 } from './core/math.js';
import { createWeapons } from './data/weapons.js';
import { createAudioEngine } from './audio/sfx.js';

        (function () {
            'use strict';

            const canvas = document.getElementById('gameCanvas');
            const ctx = canvas.getContext('2d');
            const radarCanvas = document.getElementById('radarCanvas');
            const radarCtx = radarCanvas.getContext('2d');
            const radarTerrainCanvas = document.createElement('canvas');
            radarTerrainCanvas.width = radarCanvas.width;
            radarTerrainCanvas.height = radarCanvas.height;
            const radarTerrainCtx = radarTerrainCanvas.getContext('2d');
            let radarTerrainDirty = true;

            const lightCanvas = document.createElement('canvas');
            const lightCtx = lightCanvas.getContext('2d');

            let WORLD_SIZE = 4400;

            function resizeCanvas() {
                canvas.width = window.innerWidth;
                canvas.height = window.innerHeight;
                lightCanvas.width = canvas.width;
                lightCanvas.height = canvas.height;
            }
            window.addEventListener('resize', resizeCanvas);
            resizeCanvas();

            // ============================================================================
            // MATH & GEOMETRY UTILITIES
            // ============================================================================
            function segmentIntersectsRect(x1, y1, x2, y2, rx, ry, rw, rh) {
                let t0 = 0;
                let t1 = 1;
                const dx = x2 - x1;
                const dy = y2 - y1;

                const checks = [
                    [-dx, x1 - rx],
                    [dx, rx + rw - x1],
                    [-dy, y1 - ry],
                    [dy, ry + rh - y1]
                ];

                for (let i = 0; i < 4; i++) {
                    const p = checks[i][0];
                    const q = checks[i][1];
                    if (Math.abs(p) < 1e-8) {
                        if (q < 0) return false;
                    } else {
                        const r = q / p;
                        if (p < 0) {
                            if (r > t1) return false;
                            if (r > t0) t0 = r;
                        } else {
                            if (r < t0) return false;
                            if (r < t1) t1 = r;
                        }
                    }
                }
                return t0 <= t1;
            }

            function raycastBuildingsT(x1, y1, x2, y2) {
                let bestT = 1.0;
                const dx = x2 - x1;
                const dy = y2 - y1;
                const left = Math.min(x1, x2);
                const right = Math.max(x1, x2);
                const top = Math.min(y1, y2);
                const bottom = Math.max(y1, y2);
                for (let i = 0; i < buildings.length; i++) {
                    const b = buildings[i];
                    if (b.isLowWall || b.x > right || b.x + b.w < left ||
                        b.y > bottom || b.y + b.h < top) continue;
                    let t0 = 0;
                    let t1 = 1;
                    const checks = [
                        [-dx, x1 - b.x],
                        [dx, b.x + b.w - x1],
                        [-dy, y1 - b.y],
                        [dy, b.y + b.h - y1]
                    ];
                    let hit = true;
                    for (let j = 0; j < 4; j++) {
                        const p = checks[j][0];
                        const q = checks[j][1];
                        if (Math.abs(p) < 1e-8) {
                            if (q < 0) { hit = false; break; }
                        } else {
                            const r = q / p;
                            if (p < 0) {
                                if (r > t1) { hit = false; break; }
                                if (r > t0) t0 = r;
                            } else {
                                if (r < t0) { hit = false; break; }
                                if (r < t1) t1 = r;
                            }
                        }
                    }
                    if (hit && t0 <= t1 && t0 >= 0 && t0 < bestT) {
                        bestT = t0;
                    }
                }
                return bestT;
            }

            function segmentCircleIntersectT(x1, y1, x2, y2, cx, cy, r) {
                const dx = x2 - x1;
                const dy = y2 - y1;
                const fx = x1 - cx;
                const fy = y1 - cy;

                const a = dx * dx + dy * dy;
                if (a < 1e-8) {
                    return (fx * fx + fy * fy <= r * r) ? 0 : null;
                }
                const b = 2 * (fx * dx + fy * dy);
                const c = fx * fx + fy * fy - r * r;
                let disc = b * b - 4 * a * c;
                if (disc < 0) return null;

                disc = Math.sqrt(disc);
                const t1 = (-b - disc) / (2 * a);
                const t2 = (-b + disc) / (2 * a);
                if (t1 >= 0 && t1 <= 1) return t1;
                if (t2 >= 0 && t2 <= 1) return t2;
                return null;
            }

            function circleRectResolve(entity, rect) {
                // Broad-phase exclusion; no contact response is changed for intersecting circles.
                if (entity.x + entity.r <= rect.x || entity.x - entity.r >= rect.x + rect.w ||
                    entity.y + entity.r <= rect.y || entity.y - entity.r >= rect.y + rect.h) return false;
                const closestX = Math2.clamp(entity.x, rect.x, rect.x + rect.w);
                const closestY = Math2.clamp(entity.y, rect.y, rect.y + rect.h);
                const dx = entity.x - closestX;
                const dy = entity.y - closestY;
                const distSq = dx * dx + dy * dy;

                if (distSq < entity.r * entity.r) {
                    const dist = Math.sqrt(distSq);
                    if (dist > 0.0001) {
                        const overlap = entity.r - dist;
                        entity.x += (dx / dist) * overlap;
                        entity.y += (dy / dist) * overlap;
                    } else {
                        const leftPen = Math.abs(entity.x - rect.x);
                        const rightPen = Math.abs(rect.x + rect.w - entity.x);
                        const topPen = Math.abs(entity.y - rect.y);
                        const botPen = Math.abs(rect.y + rect.h - entity.y);
                        const minPen = Math.min(leftPen, rightPen, topPen, botPen);
                        if (minPen === leftPen) entity.x = rect.x - entity.r;
                        else if (minPen === rightPen) entity.x = rect.x + rect.w + entity.r;
                        else if (minPen === topPen) entity.y = rect.y - entity.r;
                        else entity.y = rect.y + rect.h + entity.r;
                    }
                    return true;
                }
                return false;
            }

            function pointInsideBuilding(x, y, pad = 20) {
                for (let i = 0; i < buildings.length; i++) {
                    const b = buildings[i];
                    if (x > b.x - pad && x < b.x + b.w + pad && y > b.y - pad && y < b.y + b.h + pad) {
                        return true;
                    }
                }
                return false;
            }

            function hasLoS(x1, y1, x2, y2) {
                const left = Math.min(x1, x2);
                const right = Math.max(x1, x2);
                const top = Math.min(y1, y2);
                const bottom = Math.max(y1, y2);
                for (let i = 0; i < buildings.length; i++) {
                    const b = buildings[i];
                    if (b.isLowWall || b.x > right || b.x + b.w < left ||
                        b.y > bottom || b.y + b.h < top) continue;
                    if (segmentIntersectsRect(x1, y1, x2, y2, b.x, b.y, b.w, b.h)) {
                        return false;
                    }
                }
                return true;
            }

            // ============================================================================
            // PROCEDURAL WEB AUDIO ENGINE (SFX + TOGGLEABLE 150 BPM PSYTRANCE / METAL)
            // ============================================================================
            const sfx = createAudioEngine({
                getGameState: () => gameState,
                getPlayer: () => player,
                onPortraitUpdate: (a) => updatePortraitSVG(a),
                onBanner: (label, duration) => showBanner(label, duration)
            });

            // ============================================================================
            // WEAPON DEFINITIONS PER CAMPAIGN (REALISTIC HIGH-VELOCITY BALLISTICS)
            // ============================================================================
            let selectedCampaign = 'training';
            let WEAPONS = createWeapons(selectedCampaign);

            // ============================================================================
            // GLOBAL GAME STATE
            // ============================================================================
            let camera = { x: 0, y: 0, shake: 0 };
            let keys = {};
            let mouse = { x: 0, y: 0, down: false, rightDown: false, justClicked: false, worldX: 0, worldY: 0 };
            let isMobileDevice = false;
            let touchInput = {
                moveX: 0,
                moveY: 0,
                aimAngle: 0,
                aimActive: false,
                firing: false,
                justFired: false,
                sprint: false,
                scopeActive: false
            };
            let lastTime = 0;
            let gameState = 'menu';
            let kills = 0;
            let cashCollected = 0;
            let bannerTimer = null;
            let phoneTimer = null;
            let monoTimer = null;
            let eKeyJustPressed = false;

            let player = null;
            let buildings = [];
            let roads = [];
            let crosswalks = [];
            let railTracks = [];
            let woodlandTrees = [];
            let woodlandCreek = null;
            let mallZones = [];
            let mallLights = [];
            let stairwells = [];
            let currentMallFloor = 'L1';
            let vehicles = [];
            let bullets = [];
            let flameJets = [];
            let enemies = [];
            let allies = [];
            let civilians = [];
            let particles = [];
            let decals = [];
            let shells = [];
            let droppedMags = [];
            let corpses = [];
            let pickups = [];
            let mission = null;
            let cctvRevealedFloors = {};

            // ============================================================================
            // PRE-CACHED PROCEDURAL TILE & SPRITE ATLAS (ZERO EXTERNAL UPLOADS)
            // ============================================================================
            const SpriteAtlas = {
                tilePatterns: {},
                initialized: false,

                init() {
                    if (this.initialized) return;
                    this.initialized = true;
                    this.tilePatterns.mall = this.makeTilePattern('#18202c', '#1f293b', 'rgba(255,255,255,0.03)', 64);
                    this.tilePatterns.parkade = this.makeTilePattern('#11151e', '#161b26', 'rgba(148,163,184,0.04)', 96);
                    this.tilePatterns.city = this.makeTilePattern('#181c24', '#1c212b', 'rgba(255,255,255,0.025)', 100);
                },

                makeTilePattern(c1, c2, groutColor, size) {
                    const off = document.createElement('canvas');
                    off.width = size * 2;
                    off.height = size * 2;
                    const octx = off.getContext('2d');
                    octx.fillStyle = c1;
                    octx.fillRect(0, 0, size * 2, size * 2);
                    octx.fillStyle = c2;
                    octx.fillRect(0, 0, size, size);
                    octx.fillRect(size, size, size, size);
                    octx.strokeStyle = groutColor;
                    octx.lineWidth = 1;
                    octx.strokeRect(0, 0, size, size);
                    octx.strokeRect(size, 0, size, size);
                    octx.strokeRect(0, size, size, size);
                    octx.strokeRect(size, size, size, size);
                    return ctx.createPattern(off, 'repeat');
                }
            };

            // ============================================================================
            // INLINE SVG PORTRAITS (WITH DYNAMIC MOLLE GEAR & EARBUD STATE)
            // ============================================================================
            const PORTRAIT_SVGS = {
                training: `<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
                    <defs>
                        <linearGradient id="bgTrain" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stop-color="#14532d"/><stop offset="100%" stop-color="#052e16"/></linearGradient>
                    </defs>
                    <rect width="100" height="100" fill="url(#bgTrain)"/>
                    <path d="M16 98 C16 74, 84 74, 84 98 Z" fill="#3f6212"/>
                    <path d="M35 76 L50 94 L65 76 Z" fill="#1e293b"/>
                    <rect x="44" y="64" width="12" height="15" rx="4" fill="#c68b59"/>
                    <path d="M27 42 C27 21, 73 21, 73 42 L75 74 L25 74 Z" fill="#111827"/>
                    <path d="M34 43 C34 29, 66 29, 66 43 L65 57 C65 66, 35 66, 35 57 Z" fill="#d49b6a"/>
                    <path d="M34 40 Q48 28 66 39 L66 32 Q50 23 34 32 Z" fill="#111827"/>
                    <rect x="33" y="42" width="34" height="11" rx="3" fill="rgba(56, 189, 248, 0.28)" stroke="#e2e8f0" stroke-width="1.5"/>
                    <path d="M38 41 L46 41 M54 41 L62 41" stroke="#0f172a" stroke-width="1.8" stroke-linecap="round"/>
                    <circle cx="42" cy="47" r="2.2" fill="#090d16"/>
                    <circle cx="58" cy="47" r="2.2" fill="#090d16"/>
                    <path d="M44 59 Q50 62 56 59" stroke="#7c2d12" stroke-width="1.5" fill="none"/>
                    <path d="M74 68 L94 64 L96 70 L76 74 Z" fill="#ec4899" stroke="#831843" stroke-width="1"/>
                </svg>`,
                mall: `<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
                    <defs>
                        <linearGradient id="bgMall" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stop-color="#1e1b4b"/><stop offset="100%" stop-color="#090d16"/></linearGradient>
                    </defs>
                    <rect width="100" height="100" fill="url(#bgMall)"/>
                    <circle cx="82" cy="24" r="16" fill="#ec4899" opacity="0.22"/>
                    <path d="M16 98 C16 74, 84 74, 84 98 Z" fill="#3f4e32"/>
                    <path d="M16 98 C16 74, 84 74, 84 98" stroke="#1f291c" stroke-width="2" fill="none"/>
                    <path d="M35 76 L50 93 L65 76 Z" fill="#1e293b"/>
                    <rect x="44" y="64" width="12" height="15" rx="4" fill="#c68b59"/>
                    <path d="M27 42 C27 21, 73 21, 73 42 L76 80 L24 80 Z" fill="#0f172a"/>
                    <path d="M34 44 C34 30, 66 30, 66 44 L65 58 C65 67, 35 67, 35 58 Z" fill="#d49b6a"/>
                    <path d="M34 40 Q48 27 66 40 L66 33 Q50 23 34 33 Z" fill="#090d16"/>
                    <path d="M38 44 L46 45 M54 45 L62 44" stroke="#090d16" stroke-width="2" stroke-linecap="round"/>
                    <circle cx="42" cy="48" r="2.3" fill="#090d16"/>
                    <circle cx="58" cy="48" r="2.3" fill="#090d16"/>
                    <path d="M44 59 Q50 61 56 59" stroke="#7c2d12" stroke-width="1.5" fill="none"/>
                    <path d="M74 68 L94 64 L96 70 L76 74 Z" fill="#ec4899" stroke="#831843" stroke-width="1"/>
                    <rect x="78" y="61" width="14" height="4" rx="1" fill="#1e293b"/>
                    <circle cx="85" cy="62" r="1.2" fill="#ef4444"/>
                </svg>`,
                mall_geared: `<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
                    <defs>
                        <linearGradient id="bgMallG" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stop-color="#1e1b4b"/><stop offset="100%" stop-color="#090d16"/></linearGradient>
                    </defs>
                    <rect width="100" height="100" fill="url(#bgMallG)"/>
                    <path d="M16 98 C16 74, 84 74, 84 98 Z" fill="#3f4e32"/>
                    <rect x="30" y="75" width="40" height="23" rx="4" fill="#365314" stroke="#1a2e05" stroke-width="1.5"/>
                    <line x1="33" y1="82" x2="67" y2="82" stroke="#1a2e05" stroke-width="2"/>
                    <line x1="33" y1="88" x2="67" y2="88" stroke="#1a2e05" stroke-width="2"/>
                    <rect x="44" y="64" width="12" height="15" rx="4" fill="#c68b59"/>
                    <path d="M27 42 C27 21, 73 21, 73 42 L76 80 L24 80 Z" fill="#0f172a"/>
                    <path d="M34 44 C34 30, 66 30, 66 44 L65 58 C65 67, 35 67, 35 58 Z" fill="#d49b6a"/>
                    <path d="M34 40 Q48 27 66 40 L66 33 Q50 23 34 33 Z" fill="#090d16"/>
                    <path d="M38 44 L46 45 M54 45 L62 44" stroke="#090d16" stroke-width="2" stroke-linecap="round"/>
                    <circle cx="42" cy="48" r="2.3" fill="#090d16"/>
                    <circle cx="58" cy="48" r="2.3" fill="#090d16"/>
                    <path d="M44 59 Q50 61 56 59" stroke="#7c2d12" stroke-width="1.5" fill="none"/>
                    <path d="M74 68 L94 64 L96 70 L76 74 Z" fill="#ec4899" stroke="#831843" stroke-width="1"/>
                    <rect x="78" y="61" width="14" height="4" rx="1" fill="#1e293b"/>
                    <circle cx="85" cy="62" r="1.2" fill="#ef4444"/>
                </svg>`,
                female: `<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
                    <defs>
                        <linearGradient id="bgFemale" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stop-color="#451a03"/><stop offset="100%" stop-color="#0f172a"/></linearGradient>
                        <linearGradient id="hairGrad" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stop-color="#ef4444"/><stop offset="100%" stop-color="#991b1b"/></linearGradient>
                    </defs>
                    <rect width="100" height="100" fill="url(#bgFemale)"/>
                    <path d="M16 98 C16 74, 84 74, 84 98 Z" fill="#1e293b"/>
                    <path d="M32 76 L68 76 L64 98 L36 98 Z" fill="#334155"/>
                    <rect x="44" y="63" width="12" height="15" rx="4" fill="#e0a986"/>
                    <path d="M26 42 C26 20, 74 20, 74 42 L78 82 L22 82 Z" fill="url(#hairGrad)"/>
                    <path d="M34 44 C34 30, 66 30, 66 44 L65 58 C65 67, 35 67, 35 58 Z" fill="#f1c2a0"/>
                    <path d="M38 44 L46 46 M54 46 L62 44" stroke="#7f1d1d" stroke-width="2" stroke-linecap="round"/>
                    <circle cx="42" cy="49" r="2.2" fill="#0f172a"/>
                    <circle cx="58" cy="49" r="2.2" fill="#0f172a"/>
                    <path d="M44 59 Q50 62 56 59" stroke="#991b1b" stroke-width="1.6" fill="none"/>
                </svg>`,
                sniper: `<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
                    <defs>
                        <linearGradient id="bgSniper" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stop-color="#1e293b"/><stop offset="100%" stop-color="#090d16"/></linearGradient>
                    </defs>
                    <rect width="100" height="100" fill="url(#bgSniper)"/>
                    <path d="M14 98 C14 72, 86 72, 86 98 Z" fill="#365314"/>
                    <rect x="33" y="75" width="34" height="23" rx="3" fill="#4d7c0f"/>
                    <rect x="43" y="62" width="14" height="16" rx="4" fill="#c68b59"/>
                    <path d="M33 40 C33 26, 67 26, 67 40 L66 57 C66 67, 34 67, 34 57 Z" fill="#d49b6a"/>
                    <path d="M33 50 C33 65, 67 65, 67 50 L64 60 C56 66, 44 66, 36 60 Z" fill="#cbd5e1"/>
                    <path d="M43 56 Q50 53 57 56" stroke="#94a3b8" stroke-width="2.5" fill="none"/>
                    <path d="M31 33 C31 19, 69 19, 69 33 Z" fill="#3f6212"/>
                    <path d="M27 33 L73 33 L68 38 L32 38 Z" fill="#1a2e05"/>
                    <path d="M37 42 L46 44 M54 44 L63 42" stroke="#334155" stroke-width="2.2" stroke-linecap="round"/>
                    <circle cx="42" cy="46" r="2.1" fill="#0f172a"/>
                    <circle cx="58" cy="46" r="2.1" fill="#0f172a"/>
                </svg>`,
                male: `<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
                    <defs>
                        <linearGradient id="bgMale" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stop-color="#1e293b"/><stop offset="100%" stop-color="#090d16"/></linearGradient>
                    </defs>
                    <rect width="100" height="100" fill="url(#bgMale)"/>
                    <path d="M14 98 C14 72, 86 72, 86 98 Z" fill="#1e293b"/>
                    <rect x="34" y="75" width="32" height="23" rx="3" fill="#4b5563"/>
                    <rect x="43" y="62" width="14" height="16" rx="4" fill="#c68b59"/>
                    <path d="M33 41 C33 27, 67 27, 67 41 L66 57 C66 67, 34 67, 34 57 Z" fill="#d49b6a"/>
                    <path d="M32 37 C31 20, 69 20, 68 37 C63 29, 37 29, 32 37 Z" fill="#e2e8f0"/>
                    <path d="M34 51 C34 65, 66 65, 66 51 L63 60 C55 66, 45 66, 37 60 Z" fill="#cbd5e1"/>
                    <path d="M38 43 L46 45 M54 45 L62 43" stroke="#475569" stroke-width="2" stroke-linecap="round"/>
                    <circle cx="42" cy="47" r="2.1" fill="#0f172a"/>
                    <circle cx="58" cy="47" r="2.1" fill="#0f172a"/>
                </svg>`
            };

            const cPortraitSrc = './assets/portraits/c-portrait.webp';
            const cPortraitMarkup = `<img src="${cPortraitSrc}" alt="C — Hero Shooter" style="display:block;width:100%;height:100%;object-fit:cover;border-radius:50%">`;

            function getPortraitWithMusicState(key) {
                // The primary campaign uses C's approved portrait instead of
                // the older simplified SVG, including inner-monologue views.
                if (key === 'mall' || key === 'mall_geared') return cPortraitMarkup;
                let actualKey = key;
                if (key === 'mall' && player && player.hasMolleVest) {
                    actualKey = 'mall_geared';
                }
                const base = PORTRAIT_SVGS[actualKey] || PORTRAIT_SVGS.male;
                if (!sfx.musicEnabled) return base;
                const earbudOverlay = `<circle cx="33" cy="51" r="2.7" fill="#ffffff" stroke="#090d16" stroke-width="0.8"/><path d="M33 53 Q31 66 36 80" stroke="#ffffff" stroke-width="1.6" fill="none"/></svg>`;
                return base.replace('</svg>', earbudOverlay);
            }

            function updatePortraitSVG(gender) {
                const el = document.getElementById('portrait');
                if (el) el.innerHTML = getPortraitWithMusicState(gender);
                const monoEl = document.getElementById('monoAvatar');
                if (monoEl) monoEl.innerHTML = getPortraitWithMusicState(gender);
            }

            document.getElementById('avatarTraining').innerHTML = PORTRAIT_SVGS.training;
            document.getElementById('avatarMall').innerHTML = cPortraitMarkup;
            document.getElementById('avatarCbd').innerHTML = PORTRAIT_SVGS.female;
            document.getElementById('avatarSniper').innerHTML = PORTRAIT_SVGS.sniper;
            document.getElementById('avatarSuburbs').innerHTML = PORTRAIT_SVGS.male;
            updatePortraitSVG('training');

            function showBanner(text, duration = 2200, isExec = false) {
                const banner = document.getElementById('promptBanner');
                banner.innerText = text;
                banner.classList.toggle('exec-ready', isExec);
                banner.classList.add('visible');
                if (bannerTimer) clearTimeout(bannerTimer);
                bannerTimer = setTimeout(() => {
                    banner.classList.remove('visible');
                    banner.classList.remove('exec-ready');
                }, duration);
            }

            function showPhoneMessage(sender, timeStr, message, duration = 5200) {
                const toast = document.getElementById('phoneToast');
                const senderEl = document.getElementById('phoneSender');
                const timeEl = document.getElementById('phoneTime');
                const msgEl = document.getElementById('phoneMsg');
                if (!toast || !senderEl || !timeEl || !msgEl) return;

                senderEl.innerText = sender;
                timeEl.innerText = timeStr;
                msgEl.innerText = message;
                toast.classList.add('visible');
                sfx.playPhonePing();

                if (phoneTimer) clearTimeout(phoneTimer);
                phoneTimer = setTimeout(() => {
                    toast.classList.remove('visible');
                }, duration);
            }

            function showMonologue(tag, text, duration = 5400) {
                const toast = document.getElementById('monologueToast');
                const tagEl = document.getElementById('monoTag');
                const textEl = document.getElementById('monoText');
                if (!toast || !tagEl || !textEl) return;

                if (player) {
                    const monoEl = document.getElementById('monoAvatar');
                    if (monoEl) monoEl.innerHTML = getPortraitWithMusicState(player.gender);
                }
                tagEl.innerText = tag;
                textEl.innerText = `"${text}"`;
                toast.classList.add('visible');

                if (monoTimer) clearTimeout(monoTimer);
                monoTimer = setTimeout(() => {
                    toast.classList.remove('visible');
                }, duration);
            }

            // ============================================================================
            // CHECKPOINT SMARTPHONE MESSENGER CUTSCENE SYSTEM (MANUAL CLICK/TAP ADVANCE)
            // ============================================================================
            const phoneCutscene = {
                active: false,
                messages: [],
                index: 0,
                onComplete: null,

                start(config) {
                    this.active = true;
                    this.messages = config.messages || [];
                    this.index = 0;
                    this.onComplete = config.onComplete || null;

                    mouse.down = false;
                    mouse.rightDown = false;
                    touchInput.firing = false;
                    keys = {};

                    const overlay = document.getElementById('cutsceneOverlay');
                    const clockEl = document.getElementById('phoneClockTop');
                    const opsecEl = document.getElementById('phoneOpsecBanner');
                    const avatarEl = document.getElementById('phoneContactAvatar');
                    const nameEl = document.getElementById('phoneContactName');
                    const subEl = document.getElementById('phoneContactSub');
                    const streamEl = document.getElementById('phoneChatStream');

                    if (clockEl) clockEl.innerText = config.clock || '07:00 AM';
                    if (opsecEl) {
                        opsecEl.innerText = config.opsec || 'OPSEC WARNING: CELLULAR SIGNAL UNENCRYPTED (NO DMR RADIO)';
                        opsecEl.classList.toggle('training-banner', Boolean(config.isTraining));
                    }
                    if (avatarEl) {
                        const avKey = config.contactAvatar || 'male';
                        avatarEl.innerHTML = PORTRAIT_SVGS[avKey] || PORTRAIT_SVGS.male;
                    }
                    if (nameEl) nameEl.innerText = config.contactName || 'EXFIL OPS';
                    if (subEl) subEl.innerHTML = config.contactSub || 'BURNER SIM &bull; CELL RELAY';
                    if (streamEl) streamEl.innerHTML = '';

                    gameState = 'cutscene';
                    overlay.classList.remove('hidden');

                    if (this.messages.length > 0) {
                        this.revealNext();
                    }
                },

                revealNext() {
                    if (!this.active) return;
                    if (this.index >= this.messages.length) {
                        this.close();
                        return;
                    }

                    const msg = this.messages[this.index++];
                    const streamEl = document.getElementById('phoneChatStream');
                    const typingBar = document.getElementById('phoneTypingBar');
                    const nextBtn = document.getElementById('btnCutsceneNext');

                    const bubble = document.createElement('div');
                    if (msg.side === 'system') {
                        bubble.className = 'chat-bubble system';
                        bubble.innerText = msg.text;
                    } else {
                        bubble.className = `chat-bubble ${msg.side === 'outgoing' ? 'outgoing' : 'incoming'}`;
                        const tag = document.createElement('div');
                        tag.className = 'chat-sender-tag';
                        tag.innerHTML = `<span>${msg.sender || ''}</span><span>${msg.time || ''}</span>`;
                        const body = document.createElement('div');
                        body.innerText = msg.text;
                        bubble.appendChild(tag);
                        bubble.appendChild(body);
                    }

                    streamEl.appendChild(bubble);
                    streamEl.scrollTop = streamEl.scrollHeight;
                    sfx.playPhonePing();

                    if (this.index < this.messages.length) {
                        const upcoming = this.messages[this.index];
                        typingBar.innerText = upcoming.side === 'outgoing'
                            ? 'Click / Tap or press [SPACE] to send reply...'
                            : `${upcoming.sender} sent a message — Click / Tap or [SPACE] to read next...`;
                        nextBtn.innerText = isMobileDevice ? 'NEXT MESSAGE' : 'NEXT [CLICK / SPACE]';
                    } else {
                        typingBar.innerText = 'End of transmission — Click / Tap or press [SPACE] to resume.';
                        nextBtn.innerText = isMobileDevice ? 'RESUME ACTION' : 'RESUME [CLICK / SPACE]';
                    }
                },

                close() {
                    if (!this.active) return;
                    this.active = false;
                    document.getElementById('cutsceneOverlay').classList.add('hidden');
                    gameState = 'playing';
                    syncMobileControlsVisibility();
                    lastTime = performance.now();
                    const cb = this.onComplete;
                    this.onComplete = null;
                    if (cb) cb();
                }
            };

            document.getElementById('btnCutsceneNext').addEventListener('click', () => phoneCutscene.revealNext());
            document.getElementById('btnCutsceneSkip').addEventListener('click', () => phoneCutscene.close());
            document.getElementById('phoneChatStream').addEventListener('click', () => phoneCutscene.revealNext());
            document.getElementById('phoneChassis').addEventListener('click', (e) => {
                if (e.target && (e.target.id === 'btnCutsceneSkip' || e.target.id === 'btnCutsceneNext')) return;
                if (e.target && e.target.closest('#phoneChatStream')) return;
                phoneCutscene.revealNext();
            });

            // ============================================================================
            // INPUT HANDLERS
            // ============================================================================
            window.addEventListener('keydown', (e) => {
                const k = e.key.toLowerCase();
                keys[k] = true;
                if (e.code === 'Space') keys['space'] = true;

                if (gameState === 'cutscene') {
                    if (e.code === 'Space' || e.key === 'Enter') {
                        e.preventDefault();
                        phoneCutscene.revealNext();
                    } else if (e.key === 'Escape') {
                        e.preventDefault();
                        phoneCutscene.close();
                    }
                    return;
                }

                if (k === 'm') {
                    sfx.toggleMusic();
                }

                if (gameState !== 'playing' || !player) return;

                if ((k === 'c' || e.key === 'Control') && !player.vehicle) {
                    e.preventDefault();
                    player.toggleSneak();
                }

                if (k === 'b' && !player.vehicle) {
                    player.toggleAmmoLoad();
                }

                if (k === 'v' && !player.vehicle) {
                    player.cycleOptics();
                }

                if (k === 'f' && !player.vehicle) {
                    player.toggleUtilityLight();
                }

                if (k === 't' && !player.vehicle) {
                    player.toggleStrobe();
                }

                if (k === '1') player.switchWeapon(0);
                if (k === '2') player.switchWeapon(1);
                if (k === '3') player.switchWeapon(2);
                if (k === '4') player.switchWeapon(3);
                if (k === '5') player.switchWeapon(4);

                if (k === 'r' && !player.vehicle) {
                    player.reload();
                }

                if (k === 'e') {
                    eKeyJustPressed = true;
                    player.handleContextInteract();
                }

                if (k === 'h' && player.vehicle) {
                    sfx.playHorn();
                }
            });

            window.addEventListener('keyup', (e) => {
                const k = e.key.toLowerCase();
                keys[k] = false;
                if (e.code === 'Space') keys['space'] = false;
            });

            window.addEventListener('mousemove', (e) => {
                mouse.x = e.clientX;
                mouse.y = e.clientY;
            });

            window.addEventListener('mousedown', (e) => {
                if (e.target && e.target.closest && (
                    e.target.closest('.modal-overlay') ||
                    e.target.closest('#cutsceneOverlay') ||
                    e.target.closest('#mobileControls') ||
                    e.target.closest('.wep-slot') ||
                    e.target.closest('#radioStatus') ||
                    e.target.closest('#opticsStatus') ||
                    e.target.closest('#stanceStatus') ||
                    e.target.closest('#ammoTypeToggle')
                )) {
                    return;
                }
                if (e.button === 0) {
                    mouse.down = true;
                    mouse.justClicked = true;
                } else if (e.button === 2) {
                    mouse.rightDown = true;
                }
            });

            window.addEventListener('mouseup', (e) => {
                if (e.button === 0) mouse.down = false;
                if (e.button === 2) mouse.rightDown = false;
            });

            canvas.addEventListener('contextmenu', (e) => e.preventDefault());
            document.getElementById('radioStatus').addEventListener('click', () => sfx.toggleMusic());
            document.getElementById('stanceStatus').addEventListener('click', () => {
                if (gameState === 'playing' && player && !player.vehicle) player.toggleSneak();
            });
            document.getElementById('opticsStatus').addEventListener('click', () => {
                if (gameState === 'playing' && player && !player.vehicle) player.cycleOptics();
            });
            document.getElementById('ammoTypeToggle').addEventListener('click', () => {
                if (gameState === 'playing' && player && !player.vehicle) player.toggleAmmoLoad();
            });

            window.addEventListener('wheel', (e) => {
                if (gameState !== 'playing' || !player || player.vehicle) return;
                const dir = e.deltaY > 0 ? 1 : -1;
                let next = player.weaponIdx;
                for (let step = 0; step < WEAPONS.length; step++) {
                    next = (next + dir + WEAPONS.length) % WEAPONS.length;
                    if (WEAPONS[next].unlocked) {
                        player.switchWeapon(next);
                        break;
                    }
                }
            });

            // ============================================================================
            // PLATFORM DETECTION (MOBILE TOUCH vs. DESKTOP)
            // ============================================================================
            function detectPlatform() {
                const hasTouch = ('ontouchstart' in window) || (navigator.maxTouchPoints > 0);
                const smallViewport = window.innerWidth <= 920;
                const mobileUA = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent || '');
                isMobileDevice = Boolean(mobileUA || (hasTouch && smallViewport));

                document.body.classList.toggle('mobile-mode', isMobileDevice);
                const mobileEl = document.getElementById('mobileControls');
                if (mobileEl) {
                    mobileEl.classList.toggle('hidden', !isMobileDevice);
                }

                const controlsGrid = document.getElementById('controlsGrid');
                if (controlsGrid) {
                    if (isMobileDevice) {
                        controlsGrid.innerHTML = `
                            <div><strong>Left Stick:</strong> Run &amp; Drive (<strong>SNEAK:</strong> Crouch)</div>
                            <div><strong>Right Stick:</strong> Aim &amp; Auto-Fire</div>
                            <div><strong>Optics / Light:</strong> NVG/FLIR &bull; Beam &bull; Strobe</div>
                            <div><strong>USE [E] Button:</strong> Talk &bull; Stairs &bull; Boot &bull; Execute</div>
                            <div><strong>Reload Button:</strong> Toss Mag (Forfeits Rounds)</div>
                            <div><strong>Weapon Bar:</strong> Tap Slots to Switch</div>
                        `;
                    } else {
                        controlsGrid.innerHTML = `
                            <div><strong>WASD / Arrows:</strong> Run &amp; Drive (<strong>C:</strong> Toggle Sneak)</div>
                            <div><strong>LMB / RMB:</strong> Fire &amp; Sniper Scope</div>
                            <div><strong>M (iPods):</strong> Toggle Earbuds + 150 BPM Psytrance / Metal</div>
                            <div><strong>V / F / T / B:</strong> Optics &bull; Light &bull; Strobe &bull; FMJ/JHP</div>
                            <div><strong>E (Interact):</strong> Talk &bull; Stairs &bull; Boot &bull; Execute</div>
                            <div><strong>R (Reload):</strong> Toss Mag (Forfeits Leftover Rounds)</div>
                        `;
                    }
                }
            }

            function initMobileTouchControls() {
                detectPlatform();

                const leftBase = document.getElementById('leftStickBase');
                const leftKnob = document.getElementById('leftStickKnob');
                const rightBase = document.getElementById('rightStickBase');
                const rightKnob = document.getElementById('rightStickKnob');

                let leftTouchId = null;
                let rightTouchId = null;
                const maxRadius = 40;

                function updateStick(touch, baseEl, knobEl, isLeft) {
                    const rect = baseEl.getBoundingClientRect();
                    const cx = rect.left + rect.width / 2;
                    const cy = rect.top + rect.height / 2;
                    let dx = touch.clientX - cx;
                    let dy = touch.clientY - cy;
                    const dist = Math.hypot(dx, dy);
                    if (dist > maxRadius) {
                        dx = (dx / dist) * maxRadius;
                        dy = (dy / dist) * maxRadius;
                    }
                    knobEl.style.transform = `translate(${dx}px, ${dy}px)`;

                    if (isLeft) {
                        touchInput.moveX = dx / maxRadius;
                        touchInput.moveY = dy / maxRadius;
                    } else {
                        if (dist > 8) {
                            touchInput.aimActive = true;
                            touchInput.aimAngle = Math.atan2(dy, dx);
                        }
                        if (dist > 15) {
                            if (!touchInput.firing) touchInput.justFired = true;
                            touchInput.firing = true;
                        } else {
                            touchInput.firing = false;
                        }
                    }
                }

                function resetStick(knobEl, isLeft) {
                    knobEl.style.transform = 'translate(0px, 0px)';
                    if (isLeft) {
                        touchInput.moveX = 0;
                        touchInput.moveY = 0;
                    } else {
                        touchInput.aimActive = false;
                        touchInput.firing = false;
                    }
                }

                leftBase.addEventListener('touchstart', (e) => {
                    e.preventDefault();
                    if (leftTouchId !== null) return;
                    const t = e.changedTouches[0];
                    leftTouchId = t.identifier;
                    updateStick(t, leftBase, leftKnob, true);
                }, { passive: false });

                leftBase.addEventListener('touchmove', (e) => {
                    e.preventDefault();
                    for (let i = 0; i < e.changedTouches.length; i++) {
                        if (e.changedTouches[i].identifier === leftTouchId) {
                            updateStick(e.changedTouches[i], leftBase, leftKnob, true);
                        }
                    }
                }, { passive: false });

                const endLeft = (e) => {
                    for (let i = 0; i < e.changedTouches.length; i++) {
                        if (e.changedTouches[i].identifier === leftTouchId) {
                            leftTouchId = null;
                            resetStick(leftKnob, true);
                        }
                    }
                };
                leftBase.addEventListener('touchend', endLeft);
                leftBase.addEventListener('touchcancel', endLeft);

                rightBase.addEventListener('touchstart', (e) => {
                    e.preventDefault();
                    if (rightTouchId !== null) return;
                    const t = e.changedTouches[0];
                    rightTouchId = t.identifier;
                    updateStick(t, rightBase, rightKnob, false);
                }, { passive: false });

                rightBase.addEventListener('touchmove', (e) => {
                    e.preventDefault();
                    for (let i = 0; i < e.changedTouches.length; i++) {
                        if (e.changedTouches[i].identifier === rightTouchId) {
                            updateStick(e.changedTouches[i], rightBase, rightKnob, false);
                        }
                    }
                }, { passive: false });

                const endRight = (e) => {
                    for (let i = 0; i < e.changedTouches.length; i++) {
                        if (e.changedTouches[i].identifier === rightTouchId) {
                            rightTouchId = null;
                            resetStick(rightKnob, false);
                        }
                    }
                };
                rightBase.addEventListener('touchend', endRight);
                rightBase.addEventListener('touchcancel', endRight);

                const btnSprint = document.getElementById('btnSprint');
                btnSprint.addEventListener('touchstart', (e) => {
                    e.preventDefault();
                    touchInput.sprint = true;
                    btnSprint.classList.add('active');
                }, { passive: false });
                const endSprint = (e) => {
                    e.preventDefault();
                    touchInput.sprint = false;
                    btnSprint.classList.remove('active');
                };
                btnSprint.addEventListener('touchend', endSprint);
                btnSprint.addEventListener('touchcancel', endSprint);

                const btnReload = document.getElementById('btnReload');
                btnReload.addEventListener('touchstart', (e) => {
                    e.preventDefault();
                    if (player && !player.vehicle) player.reload();
                }, { passive: false });

                const btnVehicle = document.getElementById('btnVehicle');
                btnVehicle.addEventListener('touchstart', (e) => {
                    e.preventDefault();
                    if (player) player.handleContextInteract();
                }, { passive: false });

                const btnOptics = document.getElementById('btnOptics');
                btnOptics.addEventListener('touchstart', (e) => {
                    e.preventDefault();
                    if (!player || player.vehicle) return;
                    player.cycleOptics();
                }, { passive: false });

                const btnUtil = document.getElementById('btnUtil');
                btnUtil.addEventListener('touchstart', (e) => {
                    e.preventDefault();
                    if (!player || player.vehicle) return;
                    player.toggleUtilityLight();
                }, { passive: false });

                const btnStrobe = document.getElementById('btnStrobe');
                btnStrobe.addEventListener('touchstart', (e) => {
                    e.preventDefault();
                    if (!player || player.vehicle) return;
                    player.toggleStrobe();
                }, { passive: false });

                const btnSneak = document.getElementById('btnSneak');
                btnSneak.addEventListener('touchstart', (e) => {
                    e.preventDefault();
                    if (!player || player.vehicle) return;
                    player.toggleSneak();
                }, { passive: false });

                window.addEventListener('resize', detectPlatform);
            }

            // ============================================================================
            // PARTICLES, BLOOD DECALS, SHELL CASINGS, TOSSED MAGAZINES & PICKUPS
            // ============================================================================
            class Particle {
                constructor(x, y, angle, color, size, speed, life, gravity = 0) {
                    this.x = x;
                    this.y = y;
                    this.vx = Math.cos(angle) * speed;
                    this.vy = Math.sin(angle) * speed;
                    this.color = color;
                    this.size = size;
                    this.life = life;
                    this.maxLife = life;
                    this.gravity = gravity;
                }

                update(dt) {
                    this.x += this.vx * dt;
                    this.y += this.vy * dt;
                    this.vy += this.gravity * dt;
                    this.vx *= Math.pow(0.06, dt);
                    this.vy *= Math.pow(0.06, dt);
                    this.life -= dt;
                }

                draw(ctx) {
                    if (this.life <= 0) return;
                    ctx.save();
                    ctx.globalAlpha = Math.max(0, this.life / this.maxLife);
                    ctx.fillStyle = this.color;
                    ctx.beginPath();
                    ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
                    ctx.fill();
                    ctx.restore();
                }
            }

            class Decal {
                constructor(x, y, type, angle = 0, scale = 1, floor = null) {
                    this.x = x;
                    this.y = y;
                    this.type = type;
                    this.angle = angle;
                    this.scale = scale;
                    this.floor = floor;
                }

                draw(ctx) {
                    if (this.floor && this.floor !== currentMallFloor) return;
                    ctx.save();
                    ctx.translate(this.x, this.y);
                    ctx.rotate(this.angle);
                    if (this.type === 'blood') {
                        ctx.fillStyle = 'rgba(136, 19, 55, 0.72)';
                        ctx.beginPath();
                        ctx.ellipse(0, 0, this.scale * 1.4, this.scale * 0.9, 0, 0, Math.PI * 2);
                        ctx.fill();
                    } else if (this.type === 'scorch') {
                        ctx.fillStyle = 'rgba(10, 10, 12, 0.78)';
                        ctx.beginPath();
                        ctx.arc(0, 0, this.scale, 0, Math.PI * 2);
                        ctx.fill();
                    } else if (this.type === 'bb') {
                        ctx.fillStyle = 'rgba(248, 250, 252, 0.85)';
                        ctx.beginPath();
                        ctx.arc(0, 0, 2.2, 0, Math.PI * 2);
                        ctx.fill();
                    }
                    ctx.restore();
                }
            }

            class Shell {
                constructor(x, y, ejectAngle, floor = null) {
                    this.x = x;
                    this.y = y;
                    this.floor = floor;
                    const spd = Math2.rand(70, 145);
                    this.vx = Math.cos(ejectAngle) * spd;
                    this.vy = Math.sin(ejectAngle) * spd;
                    this.angle = Math2.rand(0, Math.PI * 2);
                    this.vAngle = Math2.rand(-18, 18);
                    this.life = 4.0;
                    this.slideTimer = 0.25;
                }

                update(dt) {
                    this.life -= dt;
                    if (this.slideTimer > 0) {
                        this.slideTimer -= dt;
                        this.x += this.vx * dt;
                        this.y += this.vy * dt;
                        this.angle += this.vAngle * dt;
                        this.vx *= Math.pow(0.02, dt);
                        this.vy *= Math.pow(0.02, dt);
                    }
                }

                draw(ctx) {
                    if (this.life <= 0) return;
                    if (this.floor && this.floor !== currentMallFloor) return;
                    ctx.save();
                    ctx.globalAlpha = Math.min(1, this.life);
                    ctx.translate(this.x, this.y);
                    ctx.rotate(this.angle);
                    ctx.fillStyle = '#facc15';
                    ctx.fillRect(-2.5, -1, 5, 2);
                    ctx.restore();
                }
            }

            class DroppedMag {
                constructor(x, y, tossAngle, isPink = false, isAirsoft = false, forfeitedRounds = 0, floor = null) {
                    this.x = x;
                    this.y = y;
                    this.floor = floor;
                    const spd = Math2.rand(120, 195);
                    this.vx = Math.cos(tossAngle) * spd;
                    this.vy = Math.sin(tossAngle) * spd;
                    this.angle = tossAngle + Math2.rand(-0.6, 0.6);
                    this.vAngle = Math2.rand(-14, 14);
                    this.slideTimer = 0.34;
                    this.isPink = isPink;
                    this.isAirsoft = isAirsoft;
                    this.forfeitedRounds = forfeitedRounds;
                    this.clattered = false;
                }

                update(dt) {
                    if (this.slideTimer > 0) {
                        this.slideTimer -= dt;
                        this.x += this.vx * dt;
                        this.y += this.vy * dt;
                        this.angle += this.vAngle * dt;
                        this.vx *= Math.pow(0.03, dt);
                        this.vy *= Math.pow(0.03, dt);
                        this.vAngle *= Math.pow(0.05, dt);

                        if (this.slideTimer <= 0.14 && !this.clattered) {
                            this.clattered = true;
                            sfx.playMagClatter();
                        }
                    }
                }

                draw(ctx) {
                    if (this.floor && this.floor !== currentMallFloor) return;
                    ctx.save();
                    ctx.translate(this.x, this.y);
                    ctx.rotate(this.angle);

                    const hopScale = this.slideTimer > 0.14 ? (1.0 + (this.slideTimer - 0.14) * 1.4) : 1.0;
                    ctx.scale(hopScale, hopScale);

                    ctx.fillStyle = 'rgba(0, 0, 0, 0.45)';
                    ctx.fillRect(-3.5, -1.5, 9, 5);

                    ctx.fillStyle = '#1e293b';
                    ctx.fillRect(-4.5, -2.5, 9, 4.5);
                    ctx.strokeStyle = '#64748b';
                    ctx.lineWidth = 0.8;
                    ctx.strokeRect(-4.5, -2.5, 9, 4.5);

                    ctx.fillStyle = this.isPink ? '#ec4899' : '#475569';
                    ctx.fillRect(-5.5, -3.2, 2.2, 5.8);

                    if (this.forfeitedRounds > 0) {
                        ctx.fillStyle = this.isAirsoft ? '#ffffff' : '#facc15';
                        ctx.fillRect(3.2, -1.6, 2.4, 2.6);
                    }

                    ctx.restore();
                }
            }

            class FlameJet {
                constructor(x, y, angle, speed, dmg) {
                    this.x = x;
                    this.y = y;
                    this.vx = Math.cos(angle) * speed;
                    this.vy = Math.sin(angle) * speed;
                    this.dmg = dmg;
                    this.life = 0.42;
                    this.maxLife = 0.42;
                    this.r = 9;
                    this.active = true;
                    this.hitSet = new Set();
                }

                update(dt) {
                    if (!this.active) return;
                    this.life -= dt;
                    if (this.life <= 0) {
                        this.active = false;
                        return;
                    }
                    this.x += this.vx * dt;
                    this.y += this.vy * dt;
                    this.vx *= Math.pow(0.18, dt);
                    this.vy *= Math.pow(0.18, dt);
                    this.r += 34 * dt;

                    for (let i = 0; i < buildings.length; i++) {
                        const b = buildings[i];
                        if (!b.isLowWall && this.x > b.x && this.x < b.x + b.w && this.y > b.y && this.y < b.y + b.h) {
                            this.active = false;
                            return;
                        }
                    }

                    for (let i = 0; i < enemies.length; i++) {
                        const e = enemies[i];
                        if (e.hp > 0 && !this.hitSet.has(e) && Math2.dist(this.x, this.y, e.x, e.y) < this.r + e.r) {
                            this.hitSet.add(e);
                            e.takeDamage(this.dmg, Math.atan2(this.vy, this.vx), true);
                            e.burnTimer = 2.6;
                        }
                    }

                    for (let i = 0; i < vehicles.length; i++) {
                        const v = vehicles[i];
                        if (!v.destroyed && !this.hitSet.has(v) && Math2.dist(this.x, this.y, v.x, v.y) < this.r + Math.max(v.w, v.h) * 0.42) {
                            this.hitSet.add(v);
                            v.takeDamage(this.dmg * 1.4);
                        }
                    }
                }

                draw(ctx) {
                    if (!this.active) return;
                    const ratio = Math.max(0, this.life / this.maxLife);
                    ctx.save();
                    const grad = ctx.createRadialGradient(this.x, this.y, 2, this.x, this.y, this.r);
                    grad.addColorStop(0, `rgba(254, 249, 195, ${ratio * 0.95})`);
                    grad.addColorStop(0.45, `rgba(249, 115, 22, ${ratio * 0.85})`);
                    grad.addColorStop(1, 'rgba(220, 38, 38, 0)');
                    ctx.fillStyle = grad;
                    ctx.beginPath();
                    ctx.arc(this.x, this.y, this.r, 0, Math.PI * 2);
                    ctx.fill();
                    ctx.restore();
                }
            }

            class Pickup {
                constructor(x, y, type, floor = null) {
                    this.x = x;
                    this.y = y;
                    this.type = type;
                    this.floor = floor;
                    this.r = 15;
                    this.bob = Math2.rand(0, Math.PI * 2);
                    this.collected = false;
                }

                update(dt) {
                    this.bob += dt * 4;
                    if (this.floor && this.floor !== currentMallFloor) return;
                    if (!this.collected && player && Math2.dist(this.x, this.y, player.x, player.y) < this.r + player.r + 8) {
                        this.collected = true;
                        sfx.playPickup();
                        if (this.type === 'health') {
                            player.hp = Math.min(player.maxHp, player.hp + 35);
                            showBanner('MEDKIT ACQUIRED (+35 HEALTH)', 1600);
                        } else if (this.type === 'armor') {
                            player.armor = Math.min(100, player.armor + 45);
                            showBanner('KEVLAR VEST ACQUIRED (+45 ARMOR)', 1600);
                        } else if (this.type === 'ammo') {
                            const w = WEAPONS[player.weaponIdx];
                            if (w && w.id === 'glock26') {
                                w.fmjReserve += 15;
                                if (w.ammoLoad === 'fmj') w.reserve = w.fmjReserve;
                                showBanner('SCARCE 9mm (100gr FMJ) FOUND (+15 RDS)', 1800);
                            } else {
                                for (let i = 0; i < WEAPONS.length; i++) {
                                    if (WEAPONS[i].type !== 'melee' && WEAPONS[i].id !== 'flamethrower') {
                                        WEAPONS[i].reserve += Math.max(8, Math.floor(WEAPONS[i].magMax * 0.8));
                                    }
                                }
                                showBanner('AMMUNITION BOX COLLECTED', 1600);
                            }
                        } else if (this.type === 'jhp_stash') {
                            const g26 = WEAPONS.find((w) => w.id === 'glock26');
                            if (g26) {
                                g26.jhpReserve += 15;
                                g26.ammoLoad = 'jhp';
                                g26.reserve = g26.jhpReserve;
                            }
                            showBanner('120GR (+P) HOLLOW POINTS LOADED! (+15 RDS)', 2200);
                            showMonologue(
                                'C // INTERNAL THOUGHT',
                                '120-grain +P jacketed hollow points—heavier charge than my 100gr FMJ. Brighter fireball and louder crack out of a 3.4-inch barrel, so only use them when I need immediate stopping power.',
                                6000
                            );
                        } else if (this.type === 'hunting_knife') {
                            const knifeWep = WEAPONS.find((w) => w.id === 'knife');
                            if (knifeWep) knifeWep.unlocked = true;
                            if (mission) mission.knifeFound = true;
                            showBanner('7" FIXED-BLADE HUNTING KNIFE EQUIPPED! (SLOT 2 + SILENT EXECUTIONS [E])', 2400);
                            showMonologue(
                                'C // INTERNAL THOUGHT',
                                '7-inch carbon-steel fixed blade with a leather belt scabbard. Now I can slip behind unaware or strobe-dazed looters in the dark and drop them silently [E] without wasting 9mm.',
                                6000
                            );
                        } else if (this.type === 'crowbar') {
                            player.hasCrowbar = true;
                            showBanner('STEEL CROWBAR ACQUIRED — CAN PRY BARRED DOORS!', 2000);
                        } else if (this.type === 'bb_bag') {
                            for (let i = 0; i < WEAPONS.length; i++) {
                                if (WEAPONS[i].isAirsoft && WEAPONS[i].type !== 'melee') {
                                    WEAPONS[i].reserve += WEAPONS[i].magMax * 2;
                                }
                            }
                            showBanner('6mm BIO-BB POUCH REFILLED (+2 MAGS)', 1600);
                        } else if (this.type === 'airsoft_aeg') {
                            const aeg = WEAPONS.find((w) => w.id === 'airsoft_aeg');
                            if (aeg) {
                                aeg.unlocked = true;
                                player.switchWeapon(WEAPONS.indexOf(aeg));
                            }
                            showBanner('AIRSOFT M4 CQB AEG PICKED UP!', 1800);
                        } else if (this.type === 'fuel') {
                            const ft = WEAPONS.find((w) => w.id === 'flamethrower');
                            if (ft) ft.reserve += 150;
                            showBanner('NAPALM FUEL CANISTER (+150 FUEL)', 1600);
                        } else if (this.type === 'cash') {
                            const amt = Math2.randInt(250, 950);
                            cashCollected += amt;
                            const cashEl = document.getElementById('cashCounter');
                            if (cashEl) {
                                cashEl.style.display = 'block';
                                cashEl.innerText = `CASH LOOTED: R${cashCollected.toLocaleString()}`;
                            }
                            showBanner(`CASH STASH COLLECTED (+R${amt})`, 1500);
                        } else if (this.type === 'food') {
                            player.hp = Math.min(player.maxHp, player.hp + 20);
                            player.stamina = 100;
                            showBanner('CANNED RATIONS EATEN (+20 HP, STAMINA FULL)', 1600);
                        } else if (this.type === 'water') {
                            player.stamina = 100;
                            player.hp = Math.min(player.maxHp, player.hp + 10);
                            showBanner('BOTTLED WATER CONSUMED (+10 HP, +STAMINA)', 1500);
                        } else if (this.type === 'shotgun') {
                            const idx = WEAPONS.findIndex((w) => w.id === 'shotgun');
                            if (idx >= 0) {
                                WEAPONS[idx].unlocked = true;
                                player.switchWeapon(idx);
                            }
                            showBanner('SECURITY PUMP SHOTGUN ACQUIRED!', 1900);
                        } else if (this.type === 'ar15') {
                            const idx = WEAPONS.findIndex((w) => w.id === 'ar15');
                            if (idx >= 0) {
                                WEAPONS[idx].unlocked = true;
                                player.switchWeapon(idx);
                            }
                            showBanner('TACTICAL AR-15 ACQUIRED!', 1800);
                        }
                        updateHUD();
                    }
                }

                draw(ctx) {
                    if (this.collected) return;
                    if (this.floor && this.floor !== currentMallFloor) return;
                    const offset = Math.sin(this.bob) * 3;
                    ctx.save();
                    ctx.translate(this.x, this.y + offset);

                    const glowColors = {
                        health: 'rgba(239, 68, 68, 0.3)',
                        armor: 'rgba(56, 189, 248, 0.3)',
                        fuel: 'rgba(249, 115, 22, 0.35)',
                        cash: 'rgba(74, 222, 128, 0.35)',
                        food: 'rgba(251, 191, 36, 0.3)',
                        water: 'rgba(56, 189, 248, 0.3)',
                        jhp_stash: 'rgba(239, 68, 68, 0.38)',
                        hunting_knife: 'rgba(203, 213, 225, 0.38)',
                        crowbar: 'rgba(248, 113, 113, 0.35)',
                        bb_bag: 'rgba(255, 255, 255, 0.35)',
                        airsoft_aeg: 'rgba(74, 222, 128, 0.35)'
                    };
                    ctx.fillStyle = glowColors[this.type] || 'rgba(250, 204, 21, 0.28)';
                    ctx.beginPath();
                    ctx.arc(0, 0, 18, 0, Math.PI * 2);
                    ctx.fill();

                    if (this.type === 'health') {
                        ctx.fillStyle = '#f8fafc';
                        ctx.fillRect(-10, -8, 20, 16);
                        ctx.fillStyle = '#dc2626';
                        ctx.fillRect(-2.5, -5.5, 5, 11);
                        ctx.fillRect(-5.5, -2.5, 11, 5);
                    } else if (this.type === 'armor') {
                        ctx.fillStyle = '#2563eb';
                        ctx.beginPath();
                        ctx.moveTo(-9, -8); ctx.lineTo(9, -8); ctx.lineTo(11, 8); ctx.lineTo(0, 11); ctx.lineTo(-11, 8);
                        ctx.closePath();
                        ctx.fill();
                    } else if (this.type === 'fuel') {
                        ctx.fillStyle = '#ea580c';
                        ctx.fillRect(-8, -10, 16, 20);
                        ctx.fillStyle = '#facc15';
                        ctx.fillRect(-5, -4, 10, 8);
                    } else if (this.type === 'cash') {
                        ctx.fillStyle = '#15803d';
                        ctx.fillRect(-11, -6, 22, 12);
                        ctx.strokeStyle = '#86efac';
                        ctx.lineWidth = 1.5;
                        ctx.strokeRect(-11, -6, 22, 12);
                        ctx.fillStyle = '#dcfce7';
                        ctx.font = '900 10px ui-monospace, monospace';
                        ctx.textAlign = 'center';
                        ctx.fillText('R', 0, 3.5);
                    } else if (this.type === 'food') {
                        ctx.fillStyle = '#d97706';
                        ctx.beginPath();
                        ctx.arc(0, 0, 9, 0, Math.PI * 2);
                        ctx.fill();
                        ctx.strokeStyle = '#fef3c7';
                        ctx.lineWidth = 1.5;
                        ctx.stroke();
                    } else if (this.type === 'water') {
                        ctx.fillStyle = '#0284c7';
                        ctx.fillRect(-5, -10, 10, 20);
                        ctx.fillStyle = '#e0f2fe';
                        ctx.fillRect(-3, -13, 6, 3);
                    } else if (this.type === 'jhp_stash') {
                        ctx.fillStyle = '#7f1d1d';
                        ctx.fillRect(-11, -7, 22, 14);
                        ctx.strokeStyle = '#fca5a5';
                        ctx.lineWidth = 1.4;
                        ctx.strokeRect(-11, -7, 22, 14);
                        ctx.fillStyle = '#fef08a';
                        ctx.font = '900 8px ui-monospace, monospace';
                        ctx.textAlign = 'center';
                        ctx.fillText('+P JHP', 0, 3);
                    } else if (this.type === 'hunting_knife') {
                        ctx.fillStyle = '#78350f';
                        ctx.fillRect(-11, -3, 12, 6);
                        ctx.fillStyle = '#e2e8f0';
                        ctx.beginPath();
                        ctx.moveTo(1, -2.5); ctx.lineTo(13, 0); ctx.lineTo(1, 2.5);
                        ctx.closePath();
                        ctx.fill();
                    } else if (this.type === 'crowbar') {
                        ctx.strokeStyle = '#ef4444';
                        ctx.lineWidth = 3.2;
                        ctx.beginPath();
                        ctx.moveTo(-11, 4); ctx.lineTo(8, -4); ctx.lineTo(12, -1);
                        ctx.stroke();
                    } else if (this.type === 'bb_bag') {
                        ctx.fillStyle = '#334155';
                        ctx.fillRect(-9, -9, 18, 18);
                        ctx.fillStyle = '#ffffff';
                        ctx.beginPath(); ctx.arc(-3, -2, 2.2, 0, Math.PI * 2); ctx.fill();
                        ctx.beginPath(); ctx.arc(3, 2, 2.2, 0, Math.PI * 2); ctx.fill();
                    } else if (this.type === 'airsoft_aeg') {
                        ctx.fillStyle = '#1e293b';
                        ctx.fillRect(-14, -3, 26, 6);
                        ctx.fillStyle = '#f97316';
                        ctx.fillRect(12, -2.5, 3, 5);
                    } else {
                        ctx.fillStyle = '#b45309';
                        ctx.fillRect(-11, -7, 22, 14);
                        ctx.strokeStyle = '#fde047';
                        ctx.lineWidth = 1.5;
                        ctx.strokeRect(-11, -7, 22, 14);
                    }

                    ctx.restore();
                }
            }

            // ============================================================================
            // PERSISTENT CORPSES (MULTI-POSE COLLAPSE ON FLOOR)
            // ============================================================================
            class Corpse {
                constructor(x, y, hitAngle, bodyColor, skinColor, isBoss = false, floor = null, faction = 'looter') {
                    this.x = x;
                    this.y = y;
                    this.floor = floor;
                    this.faction = faction;
                    this.bodyColor = bodyColor;
                    this.skinColor = skinColor;
                    this.isBoss = isBoss;
                    this.angle = hitAngle + Math2.rand(-0.55, 0.55);
                    this.vx = Math.cos(hitAngle) * Math2.rand(55, 115);
                    this.vy = Math.sin(hitAngle) * Math2.rand(55, 115);
                    this.slideTimer = 0.22;
                    this.pose = ['sprawl_face', 'side_curl', 'supine', 'twisted'][Math2.randInt(0, 3)];
                }

                update(dt) {
                    if (this.slideTimer > 0) {
                        this.slideTimer -= dt;
                        this.x += this.vx * dt;
                        this.y += this.vy * dt;
                        this.vx *= Math.pow(0.03, dt);
                        this.vy *= Math.pow(0.03, dt);
                        for (let i = 0; i < buildings.length; i++) {
                            circleRectResolve({ x: this.x, y: this.y, r: 12 }, buildings[i]);
                        }
                    }
                }

                draw(ctx) {
                    if (this.floor && this.floor !== currentMallFloor) return;
                    ctx.save();
                    ctx.translate(this.x, this.y);
                    ctx.rotate(this.angle);

                    const scale = this.isBoss ? 1.2 : 1.0;
                    ctx.scale(scale, scale);

                    ctx.fillStyle = 'rgba(127, 29, 29, 0.78)';
                    ctx.beginPath();
                    ctx.ellipse(2, 1, 16, 11, 0.3, 0, Math.PI * 2);
                    ctx.fill();

                    if (this.faction === 'dog') {
                        ctx.fillStyle = '#451a03';
                        ctx.beginPath();
                        ctx.ellipse(0, 0, 12, 6, 0, 0, Math.PI * 2);
                        ctx.fill();
                        ctx.restore();
                        return;
                    }

                    ctx.fillStyle = '#0f172a';
                    if (this.pose === 'side_curl') {
                        ctx.fillRect(-16, -5, 13, 4.5);
                        ctx.fillRect(-13, 1, 11, 4.5);
                    } else if (this.pose === 'twisted') {
                        ctx.save();
                        ctx.rotate(0.28);
                        ctx.fillRect(-18, -5.5, 14, 4.5);
                        ctx.restore();
                        ctx.save();
                        ctx.rotate(-0.35);
                        ctx.fillRect(-17, 1.5, 14, 4.5);
                        ctx.restore();
                    } else {
                        ctx.fillRect(-18, -5.2, 14, 4.4);
                        ctx.fillRect(-18, 1.0, 14, 4.4);
                    }

                    ctx.fillStyle = this.skinColor;
                    if (this.pose === 'supine') {
                        ctx.fillRect(0, -13, 4, 8);
                        ctx.fillRect(2, 6, 4, 8);
                    } else if (this.pose === 'side_curl') {
                        ctx.fillRect(4, -7, 7, 3.6);
                        ctx.fillRect(2, 3, 6, 3.6);
                    } else {
                        ctx.fillRect(3, -12, 4.2, 8);
                        ctx.fillRect(-2, 6, 4.2, 8);
                    }

                    ctx.fillStyle = this.bodyColor;
                    ctx.beginPath();
                    ctx.ellipse(0, 0, 10.5, 7.2, 0, 0, Math.PI * 2);
                    ctx.fill();
                    ctx.strokeStyle = 'rgba(0,0,0,0.45)';
                    ctx.lineWidth = 1.1;
                    ctx.stroke();

                    ctx.fillStyle = this.skinColor;
                    ctx.beginPath();
                    ctx.arc(10.5, this.pose === 'side_curl' ? 2 : 0, 5.6, 0, Math.PI * 2);
                    ctx.fill();

                    ctx.restore();
                }
            }

            // ============================================================================
            // HIGH-VELOCITY SWEPT-SEGMENT BALLISTICS (CROSS-NPC FRIENDLY FIRE ENABLED)
            // ============================================================================
            class Bullet {
                constructor(x, y, angle, speed, dmg, ownerType, ownerRef, pierce = false, isAirsoft = false, isJHP = false) {
                    this.x = x;
                    this.y = y;
                    this.prevX = x;
                    this.prevY = y;
                    this.angle = angle;
                    this.vx = Math.cos(angle) * speed;
                    this.vy = Math.sin(angle) * speed;
                    this.dmg = dmg;
                    this.ownerType = ownerType;
                    this.ownerRef = ownerRef;
                    this.pierce = pierce;
                    this.isAirsoft = isAirsoft;
                    this.isJHP = isJHP;
                    this.hitSet = new Set();
                    this.life = isAirsoft ? 0.34 : (pierce ? 0.28 : 0.22);
                    this.active = true;
                }

                update(dt) {
                    if (!this.active) return;
                    this.life -= dt;
                    if (this.life <= 0) {
                        this.active = false;
                        return;
                    }

                    const subSteps = 4;
                    const subDt = dt / subSteps;
                    const fl = (mission && mission.campaign === 'mall') ? currentMallFloor : null;

                    for (let step = 0; step < subSteps; step++) {
                        if (!this.active) return;
                        this.prevX = this.x;
                        this.prevY = this.y;
                        const nextX = this.x + this.vx * subDt;
                        const nextY = this.y + this.vy * subDt;

                        for (let i = 0; i < buildings.length; i++) {
                            const b = buildings[i];
                            if (b.isLowWall) continue;
                            if (segmentIntersectsRect(this.prevX, this.prevY, nextX, nextY, b.x, b.y, b.w, b.h)) {
                                this.active = false;
                                if (this.isAirsoft) {
                                    createBBHit(this.prevX, this.prevY, this.angle);
                                } else {
                                    for (let s = 0; s < 4; s++) {
                                        particles.push(new Particle(this.prevX, this.prevY, this.angle + Math.PI + Math2.rand(-0.8, 0.8), '#fde047', 2, Math2.rand(70, 190), 0.16));
                                    }
                                }
                                return;
                            }
                        }

                        for (let i = 0; i < woodlandTrees.length; i++) {
                            const tr = woodlandTrees[i];
                            const t = segmentCircleIntersectT(this.prevX, this.prevY, nextX, nextY, tr.x, tr.y, tr.trunkR);
                            if (t !== null) {
                                this.active = false;
                                if (this.isAirsoft) createBBHit(this.prevX, this.prevY, this.angle);
                                return;
                            }
                        }

                        let bestT = 1.01;
                        let hitTarget = null;
                        let hitKind = null;

                        if (this.ownerType === 'enemy' && player && player.hp > 0 && !player.vehicle) {
                            const t = segmentCircleIntersectT(this.prevX, this.prevY, nextX, nextY, player.x, player.y, player.r);
                            if (t !== null && t < bestT) {
                                bestT = t;
                                hitTarget = player;
                                hitKind = 'player';
                            }
                        }

                        if (this.ownerType === 'enemy') {
                            for (let i = 0; i < allies.length; i++) {
                                const al = allies[i];
                                if (al.isOut) continue;
                                const t = segmentCircleIntersectT(this.prevX, this.prevY, nextX, nextY, al.x, al.y, al.r);
                                if (t !== null && t < bestT) {
                                    bestT = t;
                                    hitTarget = al;
                                    hitKind = 'ally';
                                }
                            }
                        }

                        for (let i = 0; i < enemies.length; i++) {
                            const e = enemies[i];
                            if (e.hp <= 0 || e === this.ownerRef || this.hitSet.has(e)) continue;
                            if (fl && e.floor !== fl) continue;
                            const t = segmentCircleIntersectT(this.prevX, this.prevY, nextX, nextY, e.x, e.y, e.r);
                            if (t !== null && t < bestT) {
                                bestT = t;
                                hitTarget = e;
                                hitKind = 'enemy';
                            }
                        }

                        for (let i = 0; i < civilians.length; i++) {
                            const c = civilians[i];
                            if (c.dead || (fl && c.floor !== fl)) continue;
                            const t = segmentCircleIntersectT(this.prevX, this.prevY, nextX, nextY, c.x, c.y, c.r);
                            if (t !== null && t < bestT) {
                                bestT = t;
                                hitTarget = c;
                                hitKind = 'civilian';
                            }
                        }

                        for (let i = 0; i < vehicles.length; i++) {
                            const v = vehicles[i];
                            if (v.destroyed || (fl && v.floor !== fl)) continue;
                            const vr = Math.max(v.w, v.h) * 0.42;
                            const t = segmentCircleIntersectT(this.prevX, this.prevY, nextX, nextY, v.x, v.y, vr);
                            if (t !== null && t < bestT) {
                                bestT = t;
                                hitTarget = v;
                                hitKind = 'vehicle';
                            }
                        }

                        if (hitTarget) {
                            const hitX = this.prevX + (nextX - this.prevX) * bestT;
                            const hitY = this.prevY + (nextY - this.prevY) * bestT;

                            if (hitKind === 'player') {
                                this.x = hitX;
                                this.y = hitY;
                                this.active = false;
                                hitTarget.takeDamage(this.dmg);
                                if (this.isAirsoft) {
                                    sfx.playBBImpact();
                                    createBBHit(this.x, this.y, this.angle);
                                } else {
                                    createBlood(this.x, this.y, this.angle, 4);
                                }
                            } else if (hitKind === 'ally') {
                                this.x = hitX;
                                this.y = hitY;
                                this.active = false;
                                hitTarget.takeDamage(this.dmg);
                                sfx.playBBImpact();
                                createBBHit(this.x, this.y, this.angle);
                            } else if (hitKind === 'civilian') {
                                this.x = hitX;
                                this.y = hitY;
                                this.active = false;
                                hitTarget.takeDamage(this.dmg, this.angle);
                            } else if (hitKind === 'enemy') {
                                hitTarget.takeDamage(this.dmg, this.angle, false, this.isJHP);
                                if (this.pierce && this.dmg > 45 && !this.isAirsoft) {
                                    this.hitSet.add(hitTarget);
                                    this.dmg *= 0.72;
                                    for (let s = 0; s < 5; s++) {
                                        particles.push(new Particle(hitX, hitY, this.angle + Math2.rand(-0.35, 0.35), '#fef08a', 2.4, Math2.rand(140, 280), 0.18));
                                    }
                                } else {
                                    this.x = hitX;
                                    this.y = hitY;
                                    this.active = false;
                                }
                            } else if (hitKind === 'vehicle') {
                                this.x = hitX;
                                this.y = hitY;
                                this.active = false;
                                hitTarget.takeDamage(this.dmg);
                                for (let s = 0; s < 5; s++) {
                                    particles.push(new Particle(this.x, this.y, this.angle + Math.PI + Math2.rand(-0.9, 0.9), '#facc15', 2.2, Math2.rand(90, 220), 0.18));
                                }
                            }
                            if (!this.active) return;
                        }

                        this.x = nextX;
                        this.y = nextY;
                    }
                }

                draw(ctx) {
                    if (!this.active) return;
                    ctx.save();
                    if (this.isAirsoft) {
                        const tx = this.x - Math.cos(this.angle) * 28;
                        const ty = this.y - Math.sin(this.angle) * 28;
                        const grad = ctx.createLinearGradient(tx, ty, this.x, this.y);
                        grad.addColorStop(0, 'rgba(248, 250, 252, 0)');
                        grad.addColorStop(1, 'rgba(248, 250, 252, 0.85)');
                        ctx.strokeStyle = grad;
                        ctx.lineWidth = 2.0;
                        ctx.beginPath();
                        ctx.moveTo(tx, ty);
                        ctx.lineTo(this.x, this.y);
                        ctx.stroke();

                        ctx.fillStyle = '#ffffff';
                        ctx.beginPath();
                        ctx.arc(this.x, this.y, 2.3, 0, Math.PI * 2);
                        ctx.fill();
                        ctx.restore();
                        return;
                    }

                    const tailLen = this.pierce ? 140 : (this.isJHP ? 95 : 80);
                    const tx = this.x - Math.cos(this.angle) * tailLen;
                    const ty = this.y - Math.sin(this.angle) * tailLen;

                    const grad = ctx.createLinearGradient(tx, ty, this.x, this.y);
                    if (this.pierce) {
                        grad.addColorStop(0, 'rgba(56, 189, 248, 0)');
                        grad.addColorStop(1, 'rgba(224, 242, 254, 0.98)');
                    } else if (this.isJHP) {
                        grad.addColorStop(0, 'rgba(251, 146, 60, 0)');
                        grad.addColorStop(1, 'rgba(254, 240, 138, 0.98)');
                    } else {
                        grad.addColorStop(0, 'rgba(250, 204, 21, 0)');
                        grad.addColorStop(1, 'rgba(254, 249, 195, 0.96)');
                    }

                    ctx.strokeStyle = grad;
                    ctx.lineWidth = this.pierce ? 2.8 : (this.isJHP ? 2.3 : 1.9);
                    ctx.beginPath();
                    ctx.moveTo(tx, ty);
                    ctx.lineTo(this.x, this.y);
                    ctx.stroke();

                    ctx.fillStyle = '#ffffff';
                    ctx.beginPath();
                    ctx.arc(this.x, this.y, this.pierce ? 2.2 : 1.6, 0, Math.PI * 2);
                    ctx.fill();
                    ctx.restore();
                }
            }

            // ============================================================================
            // YOUTH AIRSOFT SQUADMATES (YOUNGER G & YOUNGER BLAZE)
            // ============================================================================
            class Ally {
                constructor(x, y, name, hairColor, shirtColor, offsetAngle) {
                    this.x = x;
                    this.y = y;
                    this.name = name;
                    this.hairColor = hairColor;
                    this.shirtColor = shirtColor;
                    this.offsetAngle = offsetAngle;
                    this.r = 11;
                    this.hp = 85;
                    this.maxHp = 85;
                    this.angle = 0;
                    this.lastShot = 0;
                    this.isOut = false;
                    this.respawnTimer = 0;
                }

                takeDamage(amount) {
                    if (this.isOut) return;
                    this.hp -= amount;
                    if (this.hp <= 0) {
                        this.hp = 0;
                        this.isOut = true;
                        this.respawnTimer = 8.0;
                        showBanner(`${this.name}: "HIT! HEADING TO RESPAWN!"`, 1800);
                    }
                }

                update(dt) {
                    if (this.isOut) {
                        this.respawnTimer -= dt;
                        if (this.respawnTimer <= 0 && player) {
                            this.isOut = false;
                            this.hp = this.maxHp;
                            this.x = player.x + Math.cos(this.offsetAngle) * 55;
                            this.y = player.y + Math.sin(this.offsetAngle) * 55;
                            showBanner(`${this.name} IS BACK IN PLAY!`, 1500);
                        }
                        return;
                    }

                    if (!player) return;

                    let nearestEnemy = null;
                    let bestDist = 460;
                    for (let i = 0; i < enemies.length; i++) {
                        const e = enemies[i];
                        if (e.hp <= 0) continue;
                        const d = Math2.dist(this.x, this.y, e.x, e.y);
                        if (d < bestDist && hasLoS(this.x, this.y, e.x, e.y)) {
                            bestDist = d;
                            nearestEnemy = e;
                        }
                    }

                    const formX = player.x + Math.cos(player.angle + this.offsetAngle) * 65;
                    const formY = player.y + Math.sin(player.angle + this.offsetAngle) * 65;
                    const distToForm = Math2.dist(this.x, this.y, formX, formY);

                    if (distToForm > 24) {
                        const moveAng = Math2.angle(this.x, this.y, formX, formY);
                        const spd = distToForm > 220 ? 245 : 185;
                        this.x += Math.cos(moveAng) * spd * dt;
                        this.y += Math.sin(moveAng) * spd * dt;
                        if (!nearestEnemy) this.angle = moveAng;
                    }

                    if (nearestEnemy) {
                        this.angle = Math2.angle(this.x, this.y, nearestEnemy.x, nearestEnemy.y);
                        const now = performance.now();
                        if (now - this.lastShot >= 280) {
                            this.lastShot = now;
                            sfx.playGunshot('airsoft_aeg');
                            const mx = this.x + Math.cos(this.angle) * 18;
                            const my = this.y + Math.sin(this.angle) * 18;
                            bullets.push(new Bullet(mx, my, this.angle + Math2.rand(-0.07, 0.07), 4600, 18, 'ally', this, false, true, false));
                        }
                    }

                    for (let i = 0; i < buildings.length; i++) {
                        circleRectResolve(this, buildings[i]);
                    }
                    for (let i = 0; i < woodlandTrees.length; i++) {
                        const tr = woodlandTrees[i];
                        circleRectResolve(this, { x: tr.x - tr.trunkR, y: tr.y - tr.trunkR, w: tr.trunkR * 2, h: tr.trunkR * 2 });
                    }
                }

                draw(ctx) {
                    if (this.isOut) return;
                    ctx.save();
                    ctx.translate(this.x, this.y);
                    ctx.rotate(this.angle);

                    ctx.fillStyle = 'rgba(0,0,0,0.38)';
                    ctx.beginPath();
                    ctx.ellipse(2, 2, 10, 11.5, 0, 0, Math.PI * 2);
                    ctx.fill();

                    ctx.fillStyle = this.shirtColor;
                    ctx.beginPath();
                    ctx.ellipse(-1, 0, 8.5, 11.5, 0, 0, Math.PI * 2);
                    ctx.fill();

                    ctx.fillStyle = '#1e293b';
                    ctx.fillRect(5, 3, 17, 3.2);
                    ctx.fillStyle = '#f97316';
                    ctx.fillRect(21, 3, 2.5, 3.2);

                    ctx.fillStyle = '#e0a986';
                    ctx.beginPath();
                    ctx.arc(0, 0, 6, 0, Math.PI * 2);
                    ctx.fill();

                    ctx.fillStyle = this.hairColor;
                    ctx.beginPath();
                    ctx.arc(-1, 0, 6.2, Math.PI * 0.45, Math.PI * 1.55);
                    ctx.fill();

                    ctx.restore();

                    ctx.fillStyle = '#86efac';
                    ctx.font = '800 9px ui-monospace, monospace';
                    ctx.textAlign = 'center';
                    ctx.fillText(this.name, this.x, this.y - 16);
                }
            }

            // ============================================================================
            // FRIGHTENED MALL SHOPPERS, SHOPKEEPER CONTACT & KNEELING HOSTAGES
            // ============================================================================
            class Civilian {
                constructor(x, y, floor = null, label = null, isHostage = false) {
                    this.x = x;
                    this.y = y;
                    this.floor = floor;
                    this.label = label;
                    this.isHostage = isHostage;
                    this.rescued = false;
                    this.rewardGiven = false;
                    this.dead = false;
                    this.r = 10.5;
                    this.angle = Math2.rand(0, Math.PI * 2);
                    this.state = isHostage ? 'hostage' : 'huddled';
                    this.panicTimer = 0;
                    this.fleeAngle = this.angle;
                    this.shirtColor = ['#38bdf8', '#a855f7', '#eab308', '#14b8a6', '#f43f5e'][Math2.randInt(0, 4)];
                }

                takeDamage(amount, hitAngle = 0) {
                    if (this.dead) return;
                    this.dead = true;
                    createBlood(this.x, this.y, hitAngle, 6);
                    corpses.push(new Corpse(this.x, this.y, hitAngle, this.shirtColor, '#8d5524', false, this.floor, 'civilian'));
                    if (this.isHostage) {
                        showBanner('HOSTAGE KILLED IN CROSSFIRE!', 2200, true);
                    }
                }

                interact() {
                    if (this.dead) return;
                    if (this.label && this.label.includes('CHEN')) {
                        phoneCutscene.start({
                            clock: '07:03 AM',
                            opsec: 'FACE-TO-FACE WHISPER // GOLDEN DRAGON BACK ROOM',
                            contactName: 'MR. CHEN // GOLDEN DRAGON',
                            contactSub: 'SHOPKEEPER CONTACT &bull; LEVEL 1',
                            contactAvatar: 'sniper',
                            messages: [
                                { side: 'incoming', sender: 'MR. CHEN', time: '07:03', text: 'C, thank goodness you stayed to help lock the back vault. The looters broke the outer mall shutters at 05:00 and speak only isiZulu—they will not negotiate.' },
                                { side: 'outgoing', sender: 'C', time: '07:03', text: 'Keep the back shutter bolted behind me, Chen. I am heading down the central escalator to Ground [G] and then B1 for my car boot.' },
                                { side: 'incoming', sender: 'MR. CHEN', time: '07:03', text: 'Check the Safari Outdoor & Butchery section on Ground Floor—my cousin left a 7-inch carbon-steel hunting knife in a leather scabbard behind the counter. Take this cash and water too.' }
                            ],
                            onComplete: () => {
                                if (!this.rewardGiven) {
                                    this.rewardGiven = true;
                                    cashCollected += 600;
                                    player.stamina = 100;
                                    const cashEl = document.getElementById('cashCounter');
                                    if (cashEl) {
                                        cashEl.style.display = 'block';
                                        cashEl.innerText = `CASH LOOTED: R${cashCollected.toLocaleString()}`;
                                    }
                                    sfx.playPickup();
                                    showBanner('MR. CHEN GAVE YOU R600 CASH & BOTTLED WATER!', 2200);
                                }
                            }
                        });
                        return;
                    }

                    if (this.isHostage && this.rescued) {
                        if (!this.rewardGiven) {
                            this.rewardGiven = true;
                            sfx.playPickup();
                            cashCollected += 850;
                            const cashEl = document.getElementById('cashCounter');
                            if (cashEl) {
                                cashEl.style.display = 'block';
                                cashEl.innerText = `CASH LOOTED: R${cashCollected.toLocaleString()}`;
                            }
                            const g26 = WEAPONS.find((w) => w.id === 'glock26');
                            if (g26) {
                                g26.fmjReserve += 8;
                                if (g26.ammoLoad === 'fmj') g26.reserve = g26.fmjReserve;
                            }
                            player.hp = Math.min(100, player.hp + 20);
                            updateHUD();
                            showMonologue(
                                'RESCUED SHOP STAFF // WHISPER',
                                'Thank you! Those gunmen kept shouting at us in isiZulu to open the safe. Take the till cash, a first-aid wrap, and a box of 9mm rounds the mall guard dropped!',
                                5600
                            );
                        } else {
                            showBanner('RESCUED STAFF: "STAY SAFE — WE ARE HIDING IN THE STOREROOM!"', 1800);
                        }
                        return;
                    }

                    showBanner('SHOPPER: "PLEASE — KEEP YOUR LIGHT LOW, LOOTERS ARE EVERYWHERE!"', 1800);
                }

                onHearGunshot(gx, gy) {
                    if (this.dead || this.isHostage) return;
                    this.state = 'fleeing';
                    this.panicTimer = Math2.rand(3.0, 5.5);
                    this.fleeAngle = Math2.angle(gx, gy, this.x, this.y) + Math2.rand(-0.5, 0.5);
                }

                update(dt) {
                    if (this.dead) return;
                    if (this.floor && this.floor !== currentMallFloor) return;

                    if (this.isHostage && !this.rescued) {
                        let captorAlive = false;
                        for (let i = 0; i < enemies.length; i++) {
                            const e = enemies[i];
                            if (e.hp > 0 && e.floor === this.floor && e.faction === 'hostage_taker' && Math2.dist(this.x, this.y, e.x, e.y) < 260) {
                                captorAlive = true;
                                break;
                            }
                        }
                        if (!captorAlive) {
                            this.rescued = true;
                            this.state = 'rescued';
                            showBanner('HOSTAGE RESCUED! PRESS [E] TO TALK & COLLECT SUPPLIES', 2400);
                        }
                        return;
                    }

                    if (this.state === 'fleeing') {
                        this.panicTimer -= dt;
                        this.angle = this.fleeAngle;
                        this.x += Math.cos(this.angle) * 165 * dt;
                        this.y += Math.sin(this.angle) * 165 * dt;

                        this.x = Math2.clamp(this.x, 320, WORLD_SIZE - 320);
                        this.y = Math2.clamp(this.y, 320, WORLD_SIZE - 320);

                        for (let i = 0; i < buildings.length; i++) {
                            if (circleRectResolve(this, buildings[i])) {
                                this.fleeAngle += Math.PI * 0.7;
                            }
                        }

                        if (this.panicTimer <= 0) {
                            this.state = 'huddled';
                        }
                    }
                }

                draw(ctx) {
                    if (this.dead) return;
                    if (this.floor && this.floor !== currentMallFloor) return;
                    ctx.save();
                    ctx.translate(this.x, this.y);
                    ctx.rotate(this.angle);

                    const walkBob = this.state === 'fleeing' ? Math.sin(performance.now() * 0.02 + this.x) * 3.5 : 0;

                    ctx.fillStyle = 'rgba(0,0,0,0.35)';
                    ctx.beginPath();
                    ctx.ellipse(2, 2, 9.5, 11.5, 0, 0, Math.PI * 2);
                    ctx.fill();

                    if (this.state === 'fleeing') {
                        ctx.fillStyle = '#0f172a';
                        ctx.fillRect(-3 + walkBob, -5.5, 5, 3.2);
                        ctx.fillRect(-3 - walkBob, 2.3, 5, 3.2);
                    }

                    ctx.fillStyle = this.shirtColor;
                    ctx.beginPath();
                    ctx.ellipse(-1, 0, this.isHostage && !this.rescued ? 7.2 : 8.5, 11, 0, 0, Math.PI * 2);
                    ctx.fill();

                    if (this.isHostage && !this.rescued) {
                        ctx.fillStyle = '#8d5524';
                        ctx.beginPath(); ctx.arc(-4, -5.5, 2.5, 0, Math.PI * 2); ctx.fill();
                        ctx.beginPath(); ctx.arc(-4, 5.5, 2.5, 0, Math.PI * 2); ctx.fill();
                    }

                    ctx.fillStyle = '#8d5524';
                    ctx.beginPath();
                    ctx.arc(0, 0, 5.8, 0, Math.PI * 2);
                    ctx.fill();

                    ctx.restore();

                    if (this.label) {
                        ctx.fillStyle = '#38bdf8';
                        ctx.font = '800 9px ui-monospace, monospace';
                        ctx.textAlign = 'center';
                        ctx.fillText(this.label, this.x, this.y - 16);
                    } else if (this.isHostage && !this.rescued) {
                        ctx.fillStyle = '#f87171';
                        ctx.font = '900 9px ui-monospace, monospace';
                        ctx.textAlign = 'center';
                        ctx.fillText('HOSTAGE [KNEELING]', this.x, this.y - 16);
                    } else if (this.isHostage && this.rescued) {
                        ctx.fillStyle = '#4ade80';
                        ctx.font = '900 9px ui-monospace, monospace';
                        ctx.textAlign = 'center';
                        ctx.fillText('RESCUED [E]', this.x, this.y - 16);
                    } else if (this.state === 'fleeing') {
                        ctx.fillStyle = '#fef08a';
                        ctx.font = '900 11px ui-monospace, monospace';
                        ctx.textAlign = 'center';
                        ctx.fillText('!', this.x, this.y - 16);
                    }
                }
            }

            // ============================================================================
            // TACTICAL FACTION AI (SIGHT CONES, ISIZULU HOSTAGE-TAKERS, MELEE DASHERS & LOOTERS)
            // ============================================================================
            const ZULU_HOSTAGE_BARKS = ['HLALA PHANSI!', 'VULA I-SAFE!', 'THULA!', 'NGIZOKUDUBULA!'];
            const ZULU_ALARM_BARKS = ['NANGU UMUNTU!', 'NAYA IMPI!', 'BAMBA LO!', 'BALEKANI!'];

            class Enemy {
                constructor(x, y, faction = 'looter', isBoss = false, floor = null, activity = null) {
                    this.looterLook = ['looter', 'melee_looter', 'unarmed_looter'].includes(faction) && !isBoss
                        ? looterLooks[Math.abs(Math.floor(x * 0.37 + y * 0.61)) % looterLooks.length] : null;
                    this.x = x;
                    this.y = y;
                    this.faction = faction;
                    this.isBoss = isBoss;
                    this.floor = floor;
                    this.activity = activity;
                    this.angle = Math2.rand(0, Math.PI * 2);
                    this.lastShot = 0;
                    this.burnTimer = 0;
                    this.burnTick = 0;
                    this.wanderAngle = this.angle;
                    this.wanderTimer = Math2.rand(1, 3);
                    this.animPhase = Math2.rand(0, Math.PI * 2);
                    this.barkText = '';
                    this.barkTimer = 0;
                    this.barkCooldown = Math2.rand(1.5, 4.5);

                    this.isUnarmed = (faction === 'unarmed_looter');
                    this.isMeleeLooter = (faction === 'melee_looter');
                    this.isSpotter = this.isUnarmed && Math.random() < 0.42;
                    this.spotterWarnTimer = 0;
                    this.spotterCooldown = 0;

                    this.panicState = 'normal';
                    this.panicTimer = 0;
                    this.fleeAngle = 0;
                    this.nearbyAllyDeaths = 0;
                    this.moraleThreshold = isBoss ? 99 : Math2.randInt(2, 3);
                    this.carryingLoot = (this.isUnarmed && !this.isSpotter && (activity === 'haul_crate' || Math.random() < 0.55));
                    this.dashCooldown = 0;
                    this.dashTimer = 0;
                    this.hostageExecuteTimer = 0;

                    this.lkpX = null;
                    this.lkpY = null;
                    this.lkpTimer = 0;

                    this.hesitationTimer = 0;
                    this.blindTimer = 0;
                    this.blindPanicShotTimer = 0;

                    this.fovHalfAngle = 1.05;

                    if (faction === 'airsoft_adult') {
                        this.r = 12.5;
                        this.hp = isBoss ? 140 : 65;
                        this.maxHp = this.hp;
                        this.speed = 152;
                        this.dmg = 16;
                        this.fireDelay = 310;
                        this.sightRange = 540;
                        this.attackRange = 410;
                        this.hesitationRequired = 0.42;
                    } else if (faction === 'dog') {
                        this.r = 9;
                        this.hp = 48;
                        this.maxHp = 48;
                        this.speed = 235;
                        this.dmg = 22;
                        this.fireDelay = 520;
                        this.sightRange = 460;
                        this.attackRange = 24;
                        this.hesitationRequired = 0.25;
                    } else if (faction === 'unarmed_looter') {
                        this.r = 11;
                        this.hp = 42;
                        this.maxHp = 42;
                        this.speed = 195;
                        this.dmg = 0;
                        this.fireDelay = 9999;
                        this.sightRange = 340;
                        this.attackRange = 0;
                        this.hesitationRequired = 0.6;
                        this.fovHalfAngle = 0.95;
                    } else if (faction === 'melee_looter') {
                        this.r = 11.5;
                        this.hp = 58;
                        this.maxHp = 58;
                        this.speed = 188;
                        this.dmg = 28;
                        this.fireDelay = 620;
                        this.sightRange = 390;
                        this.attackRange = 28;
                        this.hesitationRequired = 0.45;
                        this.fovHalfAngle = 1.0;
                    } else if (faction === 'hostage_taker') {
                        this.r = 12;
                        this.hp = 72;
                        this.maxHp = 72;
                        this.speed = 148;
                        this.dmg = 26;
                        this.fireDelay = 540;
                        this.sightRange = 380;
                        this.attackRange = 260;
                        this.hesitationRequired = 0.85;
                        this.fovHalfAngle = 0.92;
                    } else if (faction === 'blockade_goon') {
                        this.r = 12.5;
                        this.hp = isBoss ? 240 : 110;
                        this.maxHp = this.hp;
                        this.speed = 142;
                        this.dmg = 44;
                        this.fireDelay = 340;
                        this.sightRange = 540;
                        this.attackRange = 410;
                        this.hesitationRequired = 0.48;
                    } else if (faction === 'security') {
                        this.r = 12;
                        this.hp = isBoss ? 220 : 110;
                        this.maxHp = this.hp;
                        this.speed = 138;
                        this.dmg = 34;
                        this.fireDelay = 360;
                        this.sightRange = 500;
                        this.attackRange = 370;
                        this.hesitationRequired = 0.52;
                    } else if (faction === 'syndicate') {
                        this.r = isBoss ? 15 : 12;
                        this.hp = isBoss ? 300 : 90;
                        this.maxHp = this.hp;
                        this.speed = isBoss ? 125 : 148;
                        this.dmg = isBoss ? 42 : 28;
                        this.fireDelay = isBoss ? 270 : 440;
                        this.sightRange = 490;
                        this.attackRange = 340;
                        this.hesitationRequired = isBoss ? 0.4 : 0.72;
                    } else {
                        this.r = 11.5;
                        this.hp = 68;
                        this.maxHp = 68;
                        this.speed = 160;
                        this.dmg = 26;
                        this.fireDelay = 580;
                        this.sightRange = 410;
                        this.attackRange = 260;
                        this.hesitationRequired = Math2.rand(0.95, 1.45);
                    }
                }

                sayZulu(phrase, dur = 2.4) {
                    this.barkText = phrase;
                    this.barkTimer = dur;
                }

                isExecutionVulnerable(attacker) {
                    if (this.hp <= 0 || this.isBoss || this.faction === 'dog') return false;
                    if (this.blindTimer > 0.2 || this.panicState === 'in_cover' || this.panicState === 'frozen') return true;
                    const angEnemyToAttacker = Math2.angle(this.x, this.y, attacker.x, attacker.y);
                    const behindEnemy = Math2.angleDiff(this.angle, angEnemyToAttacker) > 1.72;
                    return behindEnemy && this.hesitationTimer < 0.15;
                }

                setLKP(x, y, duration = 7.5) {
                    this.lkpX = x;
                    this.lkpY = y;
                    this.lkpTimer = Math.max(this.lkpTimer, duration);
                }

                applyStrobeDaze(sourceX, sourceY, isDarkAmbient) {
                    if (this.hp <= 0) return;
                    const newBlind = isDarkAmbient ? 2.6 : 1.15;
                    if (this.blindTimer < 0.4) {
                        this.hesitationTimer = 0;
                        this.hostageExecuteTimer = 0;
                        this.setLKP(sourceX + Math2.rand(-90, 90), sourceY + Math2.rand(-90, 90), 4.0);
                    }
                    this.blindTimer = Math.max(this.blindTimer, newBlind);
                }

                onHearGunshot(gx, gy) {
                    if (this.hp <= 0 || this.panicState === 'fleeing' || this.panicState === 'wounded_retreat') return;

                    if (this.faction === 'hostage_taker' && this.hostageExecuteTimer <= 0) {
                        this.hostageExecuteTimer = 3.8;
                        this.sayZulu('NGIZOKUDUBULA!', 3.2);
                    }

                    if (this.isUnarmed) {
                        this.sayZulu('BALEKANI!', 2.2);
                        if (Math.random() < 0.35 && this.panicState === 'normal') {
                            this.panicState = 'frozen';
                            this.panicTimer = Math2.rand(0.7, 1.3);
                        } else {
                            this.panicState = 'fleeing';
                            this.panicTimer = Math2.rand(5.0, 9.0);
                            this.fleeAngle = Math2.angle(gx, gy, this.x, this.y) + Math2.rand(-0.45, 0.45);
                        }
                    } else if (this.panicState === 'normal') {
                        this.setLKP(gx, gy, 8.0);
                    }
                }

                onHearSpotterShout(sx, sy) {
                    if (this.hp <= 0 || this.isUnarmed || this.panicState === 'fleeing' || this.panicState === 'wounded_retreat') return;
                    this.setLKP(sx, sy, 9.5);
                }

                onComradeKilled(deadX, deadY) {
                    if (this.hp <= 0 || this.isBoss || this.faction === 'blockade_goon' || this.faction === 'airsoft_adult') return;
                    if (Math2.dist(this.x, this.y, deadX, deadY) < 340) {
                        this.nearbyAllyDeaths++;
                        if (this.isUnarmed || this.nearbyAllyDeaths >= this.moraleThreshold) {
                            this.panicState = 'fleeing';
                            this.panicTimer = Math2.rand(6.5, 10.5);
                            this.fleeAngle = Math2.angle(deadX, deadY, this.x, this.y) + Math2.rand(-0.4, 0.4);
                            this.sayZulu('BALEKANI!', 2.2);
                        }
                    }
                }

                takeDamage(amount, hitAngle = 0, silent = false, isJHP = false) {
                    if (this.hp <= 0) return;
                    const isAirsoft = (this.faction === 'airsoft_adult');
                    this.hp -= amount;
                    if (!silent) {
                        if (isAirsoft) sfx.playBBImpact();
                        else sfx.playHit();
                    }

                    if (isAirsoft) {
                        createBBHit(this.x, this.y, hitAngle);
                    } else {
                        createBlood(this.x, this.y, hitAngle, this.isBoss ? 8 : 5);
                    }

                    if (this.hp <= 0) {
                        this.hp = 0;
                        kills++;
                        const killLabel = (mission && mission.campaign === 'training')
                            ? `ADULTS TAGGED OUT: ${kills}`
                            : `HOSTILES NEUTRALIZED: ${kills}`;
                        document.getElementById('killCounter').innerText = killLabel;

                        if (!isAirsoft) {
                            const bodyColors = {
                                unarmed_looter: this.isSpotter ? '#eab308' : '#d97706',
                                melee_looter: '#9a3412',
                                hostage_taker: '#7f1d1d',
                                looter: '#b45309',
                                blockade_goon: '#991b1b',
                                syndicate: '#15803d',
                                security: '#1d4ed8'
                            };
                            const bCol = (this.isBoss && this.faction !== 'airsoft_adult') ? '#7f1d1d' : (bodyColors[this.faction] || '#b45309');
                            corpses.push(new Corpse(this.x, this.y, hitAngle, bCol, '#5c3a21', this.isBoss, this.floor, this.faction));
                            if (corpses.length > 160) corpses.shift();
                        } else {
                            showBanner(this.isBoss ? 'ADULT SQUAD CAPTAIN: "HIT! GOOD SHOT!"' : 'ADULT PLAYER: "HIT! OUT!"', 1300);
                        }

                        for (let i = 0; i < enemies.length; i++) {
                            const other = enemies[i];
                            if (other !== this && other.hp > 0 && (!this.floor || other.floor === this.floor)) {
                                other.onComradeKilled(this.x, this.y);
                            }
                        }

                        const isMall = mission && mission.campaign === 'mall';
                        const isTraining = mission && mission.campaign === 'training';
                        if (isTraining) {
                            if (Math.random() < 0.4) {
                                pickups.push(new Pickup(this.x, this.y, 'bb_bag'));
                            }
                        } else if (isMall) {
                            const r = Math.random();
                            if (this.isMeleeLooter && r < 0.45) {
                                pickups.push(new Pickup(this.x, this.y, 'crowbar', this.floor));
                            } else if (this.faction === 'blockade_goon' && r < 0.25) {
                                pickups.push(new Pickup(this.x, this.y, 'ammo', this.floor));
                            } else if (r < 0.35) {
                                pickups.push(new Pickup(this.x, this.y, 'cash', this.floor));
                            } else if (r < 0.52) {
                                pickups.push(new Pickup(this.x, this.y, Math.random() < 0.5 ? 'food' : 'water', this.floor));
                            }
                        } else if (Math.random() < 0.32) {
                            const dropType = (mission && mission.campaign === 'cbd' && Math.random() < 0.45)
                                ? 'fuel'
                                : (Math.random() < 0.55 ? 'ammo' : 'health');
                            pickups.push(new Pickup(this.x, this.y, dropType));
                        }
                    } else if (!isAirsoft) {
                        if (!this.isBoss && this.faction !== 'dog' && this.panicState !== 'fleeing') {
                            const isLooter = (this.faction === 'looter' || this.isUnarmed || this.isMeleeLooter);
                            const hpRatio = this.hp / this.maxHp;
                            const retreatChance = isJHP ? 0.96 : (isLooter ? 0.82 : (hpRatio < 0.55 ? 0.62 : 0.22));
                            if (Math.random() < retreatChance) {
                                this.panicState = 'wounded_retreat';
                                this.panicTimer = Math2.rand(7.0, 12.0);
                                this.fleeAngle = hitAngle + Math2.rand(-0.55, 0.55);
                                this.hesitationTimer = 0;
                            }
                        }
                    }
                }

                getEffectiveSightRange() {
                    const isDarkMall = (mission && mission.campaign === 'mall' && this.faction !== 'blockade_goon');
                    if (!isDarkMall || !player) return this.sightRange;
                    if (player.flashlightOn && !player.vehicle) return 460;
                    if (isPlayerIlluminatedByEnvironment()) return 275;
                    if (player.isSneaking) return 44;
                    const isSprinting = (keys['shift'] || touchInput.sprint) && (keys['w'] || keys['a'] || keys['s'] || keys['d'] || Math.hypot(touchInput.moveX, touchInput.moveY) > 0.2);
                    return isSprinting ? 195 : 94;
                }

                canDetectPlayer() {
                    if (!player || player.hp <= 0) return false;
                    if (this.floor && this.floor !== currentMallFloor) return false;
                    const d = Math2.dist(this.x, this.y, player.x, player.y);
                    if (!hasLoS(this.x, this.y, player.x, player.y)) return false;

                    const angToPlayer = Math2.angle(this.x, this.y, player.x, player.y);
                    const viewDiff = Math2.angleDiff(this.angle, angToPlayer);
                    const inFrontCone = viewDiff <= this.fovHalfAngle;

                    const isDarkMall = (mission && mission.campaign === 'mall' && this.faction !== 'blockade_goon');
                    if (isDarkMall) {
                        if (player.flashlightOn && !player.vehicle) {
                            if (inFrontCone && d < 460) return true;
                            const beamAng = Math2.angle(player.x, player.y, this.x, this.y);
                            if (d < 440 && Math2.angleDiff(player.angle, beamAng) < 0.36) return true;
                        }
                        if (isPlayerIlluminatedByEnvironment() && inFrontCone && d < 275) {
                            return true;
                        }
                        if (player.isSneaking) {
                            return inFrontCone ? d < 44 : d < 24;
                        }
                        const isSprinting = (keys['shift'] || touchInput.sprint) && (keys['w'] || keys['a'] || keys['s'] || keys['d'] || Math.hypot(touchInput.moveX, touchInput.moveY) > 0.2);
                        if (isSprinting && d < 195) {
                            return true;
                        }
                        const shadowRadius = inFrontCone ? 94 : 48;
                        return d < shadowRadius;
                    }

                    if (inFrontCone && d < this.sightRange) return true;
                    return player.isSneaking ? d < 45 : d < 120;
                }

                findTarget() {
                    if (this.isUnarmed || this.blindTimer > 0) return null;
                    if (this.panicState === 'fleeing' || this.panicState === 'frozen' || this.panicState === 'wounded_retreat' || this.panicState === 'in_cover') {
                        return null;
                    }

                    let bestTarget = null;
                    let bestDist = this.sightRange;

                    if (this.canDetectPlayer()) {
                        bestDist = Math2.dist(this.x, this.y, player.x, player.y);
                        bestTarget = player;
                    }

                    for (let i = 0; i < allies.length; i++) {
                        const al = allies[i];
                        if (al.isOut) continue;
                        const d = Math2.dist(this.x, this.y, al.x, al.y);
                        if (d < bestDist && hasLoS(this.x, this.y, al.x, al.y)) {
                            bestDist = d;
                            bestTarget = al;
                        }
                    }

                    for (let i = 0; i < enemies.length; i++) {
                        const other = enemies[i];
                        if (other === this || other.hp <= 0 || other.isUnarmed) continue;
                        if (this.floor && other.floor !== this.floor) continue;
                        if (other.faction === this.faction) continue;
                        if ((this.faction === 'syndicate' && other.faction === 'dog') || (this.faction === 'dog' && other.faction === 'syndicate')) continue;
                        const isMallLooterGroup = (f) => (f === 'looter' || f === 'melee_looter' || f === 'hostage_taker' || f === 'blockade_goon');
                        if (isMallLooterGroup(this.faction) && isMallLooterGroup(other.faction)) continue;

                        const d = Math2.dist(this.x, this.y, other.x, other.y);
                        if (d < bestDist && hasLoS(this.x, this.y, other.x, other.y)) {
                            bestDist = d;
                            bestTarget = other;
                        }
                    }

                    return bestTarget;
                }

                update(dt) {
                    if (this.hp <= 0) return;
                    if (this.floor && this.floor !== currentMallFloor) return;

                    if (this.spotterCooldown > 0) this.spotterCooldown -= dt;
                    if (this.dashCooldown > 0) this.dashCooldown -= dt;
                    if (this.dashTimer > 0) this.dashTimer -= dt;
                    if (this.barkTimer > 0) this.barkTimer -= dt;
                    if (this.barkCooldown > 0) this.barkCooldown -= dt;

                    if (this.barkCooldown <= 0 && this.panicState === 'normal') {
                        this.barkCooldown = Math2.rand(4.5, 9.0);
                        if (this.faction === 'hostage_taker') {
                            this.sayZulu(ZULU_HOSTAGE_BARKS[Math2.randInt(0, ZULU_HOSTAGE_BARKS.length - 1)], 2.6);
                        } else if (this.activity === 'pry_shutter' && Math.random() < 0.5) {
                            this.sayZulu('VULA LO MNYANGO!', 2.0);
                        }
                    }

                    if (this.burnTimer > 0) {
                        this.burnTimer -= dt;
                        this.burnTick += dt;
                        if (Math.random() < 0.45) {
                            particles.push(new Particle(this.x, this.y, -Math.PI / 2 + Math2.rand(-0.5, 0.5), '#fb923c', Math2.rand(3, 6), Math2.rand(30, 85), 0.25));
                        }
                        if (this.burnTick >= 0.35) {
                            this.burnTick = 0;
                            this.takeDamage(12, 0, true);
                            if (this.hp <= 0) return;
                        }
                    }

                    if (this.blindTimer > 0) {
                        this.blindTimer -= dt;
                        this.x -= Math.cos(this.angle) * 42 * dt;
                        this.y -= Math.sin(this.angle) * 42 * dt;
                        this.angle += Math.sin(performance.now() * 0.025 + this.x) * 2.2 * dt;
                        this.animPhase += dt * 7;

                        if (!this.isUnarmed && !this.isMeleeLooter && this.faction !== 'dog' && this.blindTimer > 0.7) {
                            this.blindPanicShotTimer += dt;
                            if (this.blindPanicShotTimer > 0.65 && Math.random() < 0.04) {
                                this.blindPanicShotTimer = 0;
                                const isAirsoft = (this.faction === 'airsoft_adult');
                                const isRifle = (this.faction === 'security' || this.faction === 'blockade_goon');
                                sfx.playGunshot(isAirsoft ? 'airsoft_aeg' : (isRifle ? 'ak47' : 'glock'));
                                const mx = this.x + Math.cos(this.angle) * 18;
                                const my = this.y + Math.sin(this.angle) * 18;
                                bullets.push(new Bullet(mx, my, this.angle + Math2.rand(-0.72, 0.72), isAirsoft ? 4400 : 14000, this.dmg, 'enemy', this, false, isAirsoft, false));
                            }
                        }

                        for (let i = 0; i < buildings.length; i++) {
                            circleRectResolve(this, buildings[i]);
                        }
                        return;
                    }

                    if (this.panicState === 'frozen') {
                        this.panicTimer -= dt;
                        if (this.panicTimer <= 0) {
                            this.panicState = 'fleeing';
                            this.panicTimer = Math2.rand(4.5, 8.0);
                            this.fleeAngle = player ? Math2.angle(player.x, player.y, this.x, this.y) : Math2.rand(0, Math.PI * 2);
                        }
                        return;
                    }

                    if (this.panicState === 'wounded_retreat') {
                        this.panicTimer -= dt;
                        this.angle = this.fleeAngle;
                        this.x += Math.cos(this.angle) * (this.speed * 1.18) * dt;
                        this.y += Math.sin(this.angle) * (this.speed * 1.18) * dt;
                        this.animPhase += dt * 13;

                        if (Math.random() < 0.14 && decals.length < 520) {
                            decals.push(new Decal(this.x, this.y, 'blood', Math2.rand(0, Math.PI * 2), 4, this.floor));
                        }

                        this.x = Math2.clamp(this.x, 40, WORLD_SIZE - 40);
                        this.y = Math2.clamp(this.y, 40, WORLD_SIZE - 40);
                        for (let i = 0; i < buildings.length; i++) {
                            if (circleRectResolve(this, buildings[i])) {
                                this.fleeAngle += Math.PI * 0.55;
                            }
                        }

                        if (player && !hasLoS(this.x, this.y, player.x, player.y) && Math2.dist(this.x, this.y, player.x, player.y) > 210) {
                            this.panicState = 'in_cover';
                            this.panicTimer = Math2.rand(8.0, 14.0);
                            this.angle = Math2.angle(this.x, this.y, player.x, player.y);
                        } else if (this.panicTimer <= 0) {
                            this.panicState = 'in_cover';
                            this.panicTimer = 6.0;
                        }
                        return;
                    }

                    if (this.panicState === 'in_cover') {
                        this.panicTimer -= dt;
                        if (this.panicTimer <= 0) {
                            this.panicState = 'normal';
                        }
                        return;
                    }

                    if (this.panicState === 'fleeing') {
                        this.panicTimer -= dt;
                        this.angle = this.fleeAngle;
                        const fleeSpeed = this.isUnarmed ? 215 : 205;
                        this.x += Math.cos(this.angle) * fleeSpeed * dt;
                        this.y += Math.sin(this.angle) * fleeSpeed * dt;
                        this.animPhase += dt * 15;

                        this.x = Math2.clamp(this.x, 40, WORLD_SIZE - 40);
                        this.y = Math2.clamp(this.y, 40, WORLD_SIZE - 40);
                        for (let i = 0; i < buildings.length; i++) {
                            if (circleRectResolve(this, buildings[i])) {
                                this.fleeAngle += Math.PI * 0.65;
                            }
                        }
                        if (this.panicTimer <= 0 && !this.isUnarmed) {
                            this.panicState = 'normal';
                        }
                        return;
                    }

                    if (this.isUnarmed) {
                        if (this.spotterWarnTimer > 0) {
                            this.spotterWarnTimer -= dt;
                            if (player) this.angle = Math2.angle(this.x, this.y, player.x, player.y);
                            if (this.spotterWarnTimer <= 0) {
                                sfx.playAlarmShout();
                                this.sayZulu(ZULU_ALARM_BARKS[Math2.randInt(0, ZULU_ALARM_BARKS.length - 1)], 2.6);
                                if (player) {
                                    broadcastGunshot(player.x, player.y, 580, true);
                                    if (mission && mission.campaign === 'mall') {
                                        showBanner('SPOTTER SHOUTED IN ISIZULU — ALARM RAISED! RELOCATE!', 2100);
                                    }
                                    this.fleeAngle = Math2.angle(player.x, player.y, this.x, this.y) + Math2.rand(-0.3, 0.3);
                                }
                                this.panicState = 'fleeing';
                                this.panicTimer = 7.5;
                                this.spotterCooldown = 12.0;
                            }
                            return;
                        }

                        if (this.canDetectPlayer()) {
                            if (this.isSpotter && this.spotterCooldown <= 0) {
                                this.spotterWarnTimer = 0.58;
                                this.sayZulu('NANGU!', 1.2);
                                this.angle = Math2.angle(this.x, this.y, player.x, player.y);
                                return;
                            } else {
                                this.sayZulu('BALEKANI!', 2.0);
                                this.panicState = 'fleeing';
                                this.panicTimer = 6.5;
                                this.fleeAngle = Math2.angle(player.x, player.y, this.x, this.y) + Math2.rand(-0.35, 0.35);
                                return;
                            }
                        }
                    }

                    const target = this.findTarget();

                    if (target) {
                        this.setLKP(target.x, target.y, 7.5);

                        if (this.faction === 'hostage_taker' && this.hostageExecuteTimer <= 0) {
                            this.hostageExecuteTimer = 3.8;
                            this.sayZulu('NGIZOKUDUBULA!', 3.0);
                        }

                        const desiredAngle = Math2.angle(this.x, this.y, target.x, target.y);
                        this.angle = desiredAngle;
                        const d = Math2.dist(this.x, this.y, target.x, target.y);

                        let effectiveHesitation = this.hesitationRequired;
                        if (target === player && (this.faction === 'looter' || this.faction === 'syndicate' || this.faction === 'hostage_taker')) {
                            const pAimDiff = Math2.angleDiff(player.angle, Math2.angle(player.x, player.y, this.x, this.y));
                            if (pAimDiff < 0.25) effectiveHesitation += 0.32;
                        }

                        this.hesitationTimer += dt;

                        if (this.isMeleeLooter && d < 185 && d > 36 && this.dashCooldown <= 0) {
                            this.dashTimer = 0.36;
                            this.dashCooldown = 3.2;
                            this.sayZulu('BAMBA!', 1.4);
                        }

                        const moveMult = this.dashTimer > 0 ? 2.15 : 1.0;

                        if (d > this.attackRange * 0.85) {
                            this.x += Math.cos(this.angle) * (this.speed * moveMult) * dt;
                            this.y += Math.sin(this.angle) * (this.speed * moveMult) * dt;
                            this.animPhase += dt * 13 * moveMult;
                        } else if (this.faction !== 'dog' && !this.isMeleeLooter && d < this.attackRange * 0.45) {
                            this.x -= Math.cos(this.angle) * this.speed * 0.55 * dt;
                            this.y -= Math.sin(this.angle) * this.speed * 0.55 * dt;
                            this.animPhase += dt * 8;
                        }

                        if (this.hesitationTimer >= effectiveHesitation && d <= this.attackRange) {
                            const now = performance.now();
                            if (now - this.lastShot >= this.fireDelay) {
                                this.lastShot = now;
                                if (this.faction === 'dog' || this.isMeleeLooter) {
                                    if (this.isMeleeLooter) sfx.playMelee();
                                    if (target === player && !player.vehicle) {
                                        player.takeDamage(this.dmg);
                                        createBlood(player.x, player.y, this.angle, 4);
                                    } else if (target !== player) {
                                        target.takeDamage(this.dmg, this.angle, true);
                                    }
                                } else {
                                    const isAirsoft = (this.faction === 'airsoft_adult');
                                    const isRifle = (this.faction === 'security' || this.faction === 'blockade_goon');
                                    sfx.playGunshot(isAirsoft ? 'airsoft_aeg' : (isRifle ? 'ak47' : 'glock'));
                                    const mx = this.x + Math.cos(this.angle) * 18;
                                    const my = this.y + Math.sin(this.angle) * 18;
                                    const spread = isAirsoft ? 0.08 : (isRifle ? 0.085 : 0.14);
                                    const spd = isAirsoft ? 4500 : (isRifle ? 26500 : 14000);
                                    bullets.push(new Bullet(mx, my, this.angle + Math2.rand(-spread, spread), spd, this.dmg, 'enemy', this, false, isAirsoft, false));
                                }
                            }
                        }
                    } else if (this.lkpTimer > 0 && this.lkpX !== null && !this.isUnarmed) {
                        this.lkpTimer -= dt;
                        this.hesitationTimer = Math.max(0, this.hesitationTimer - dt * 0.7);
                        const distLkp = Math2.dist(this.x, this.y, this.lkpX, this.lkpY);
                        if (distLkp > 36) {
                            this.angle = Math2.angle(this.x, this.y, this.lkpX, this.lkpY);
                            this.x += Math.cos(this.angle) * (this.speed * 0.85) * dt;
                            this.y += Math.sin(this.angle) * (this.speed * 0.85) * dt;
                            this.animPhase += dt * 11;
                        } else {
                            this.angle += Math.sin(performance.now() * 0.006 + this.x) * 2.4 * dt;
                        }
                    } else {
                        this.hesitationTimer = Math.max(0, this.hesitationTimer - dt);

                        if (this.faction === 'hostage_taker' && this.hostageExecuteTimer > 0) {
                            this.hostageExecuteTimer -= dt;
                            if (this.hostageExecuteTimer <= 0) {
                                for (let i = 0; i < civilians.length; i++) {
                                    const c = civilians[i];
                                    if (!c.dead && c.isHostage && !c.rescued && c.floor === this.floor && Math2.dist(this.x, this.y, c.x, c.y) < 220) {
                                        sfx.playGunshot('glock');
                                        c.takeDamage(100, Math2.angle(this.x, this.y, c.x, c.y));
                                        break;
                                    }
                                }
                            }
                        }

                        if (this.activity === 'pry_shutter' || this.activity === 'rummage') {
                            this.animPhase += dt * 9;
                            if (this.activity === 'pry_shutter' && Math.random() < 0.08) {
                                particles.push(new Particle(
                                    this.x + Math.cos(this.angle) * 14,
                                    this.y + Math.sin(this.angle) * 14,
                                    this.angle + Math.PI + Math2.rand(-0.7, 0.7),
                                    '#facc15',
                                    1.8,
                                    Math2.rand(45, 110),
                                    0.18
                                ));
                            }
                        } else if (this.activity === 'guard_hostage') {
                            this.angle += Math.sin(performance.now() * 0.003 + this.x) * 0.7 * dt;
                        } else {
                            this.wanderTimer -= dt;
                            if (this.wanderTimer <= 0) {
                                this.wanderTimer = Math2.rand(1.5, 4.0);
                                this.wanderAngle += Math2.rand(-1.8, 1.8);
                            }
                            this.angle = this.wanderAngle;
                            this.x += Math.cos(this.angle) * (this.speed * 0.42) * dt;
                            this.y += Math.sin(this.angle) * (this.speed * 0.42) * dt;
                            this.animPhase += dt * 7;
                        }
                    }

                    this.x = Math2.clamp(this.x, 30, WORLD_SIZE - 30);
                    this.y = Math2.clamp(this.y, 30, WORLD_SIZE - 30);

                    for (let i = 0; i < buildings.length; i++) {
                        if (circleRectResolve(this, buildings[i])) {
                            this.wanderAngle += Math.PI * 0.65;
                            if (this.lkpTimer > 0 && Math2.dist(this.x, this.y, this.lkpX, this.lkpY) < 70) {
                                this.lkpTimer = 0;
                            }
                        }
                    }
                    for (let i = 0; i < woodlandTrees.length; i++) {
                        const tr = woodlandTrees[i];
                        if (circleRectResolve(this, { x: tr.x - tr.trunkR, y: tr.y - tr.trunkR, w: tr.trunkR * 2, h: tr.trunkR * 2 })) {
                            this.wanderAngle += Math.PI * 0.55;
                        }
                    }
                }

                drawVisionCone(ctx) {
                    if (this.hp <= 0 || this.blindTimer > 0 || this.panicState === 'fleeing' || this.panicState === 'in_cover') return;
                    if (this.floor && this.floor !== currentMallFloor) return;
                    if (!mission || mission.campaign !== 'mall') return;

                    const range = this.getEffectiveSightRange();
                    if (range < 40) return;

                    ctx.save();
                    const grad = ctx.createRadialGradient(this.x, this.y, 8, this.x, this.y, range);
                    if (this.hesitationTimer > 0.08) {
                        grad.addColorStop(0, 'rgba(239, 68, 68, 0.24)');
                        grad.addColorStop(1, 'rgba(239, 68, 68, 0)');
                    } else if (this.isSpotter) {
                        grad.addColorStop(0, 'rgba(250, 204, 21, 0.16)');
                        grad.addColorStop(1, 'rgba(250, 204, 21, 0)');
                    } else {
                        grad.addColorStop(0, 'rgba(248, 113, 113, 0.13)');
                        grad.addColorStop(1, 'rgba(248, 113, 113, 0)');
                    }
                    ctx.fillStyle = grad;
                    ctx.beginPath();
                    ctx.moveTo(this.x, this.y);
                    ctx.arc(this.x, this.y, range, this.angle - this.fovHalfAngle, this.angle + this.fovHalfAngle);
                    ctx.closePath();
                    ctx.fill();
                    ctx.restore();
                }

                draw(ctx) {
                    if (this.hp <= 0) return;
                    if (this.floor && this.floor !== currentMallFloor) return;
                    ctx.save();
                    ctx.translate(this.x, this.y);
                    ctx.rotate(this.angle);

                    if (this.faction === 'dog') {
                        ctx.fillStyle = '#451a03';
                        ctx.beginPath();
                        ctx.ellipse(0, 0, 11, 5.5, 0, 0, Math.PI * 2);
                        ctx.fill();
                        ctx.fillStyle = '#78350f';
                        ctx.beginPath();
                        ctx.arc(9, 0, 4.5, 0, Math.PI * 2);
                        ctx.fill();
                        ctx.restore();
                        return;
                    }

                    const stride = Math.sin(this.animPhase) * 4.2;

                    ctx.fillStyle = '#090d16';
                    ctx.fillRect(-3 + stride, -6.5, 5.5, 3.2);
                    ctx.fillRect(-3 - stride, 3.3, 5.5, 3.2);

                    ctx.fillStyle = 'rgba(0,0,0,0.38)';
                    ctx.beginPath();
                    ctx.ellipse(2, 3, 11, 13.5, 0, 0, Math.PI * 2);
                    ctx.fill();

                    const bodyColors = {
                        airsoft_adult: this.isBoss ? '#3f6212' : '#4d7c0f',
                        unarmed_looter: this.isSpotter ? '#eab308' : '#d97706',
                        melee_looter: '#9a3412',
                        hostage_taker: '#7f1d1d',
                        looter: '#b45309',
                        blockade_goon: '#991b1b',
                        syndicate: '#15803d',
                        security: '#1d4ed8'
                    };
                    ctx.fillStyle = (this.isBoss && this.faction !== 'airsoft_adult') ? '#7f1d1d' : (this.looterLook?.coat || bodyColors[this.faction] || '#b45309');
                    ctx.beginPath();
                    ctx.ellipse(-2, 0, 9.5, this.isBoss ? 15.5 : 13, 0, 0, Math.PI * 2);
                    ctx.fill();

                    if (this.looterLook) drawLooterJacket(ctx, this.looterLook);

                    if (this.blindTimer > 0) {
                        ctx.fillStyle = this.looterLook?.skin || '#5c3a21';
                        ctx.beginPath(); ctx.arc(6, -4, 3, 0, Math.PI * 2); ctx.fill();
                        ctx.beginPath(); ctx.arc(6, 4, 3, 0, Math.PI * 2); ctx.fill();
                    } else if (this.isUnarmed) {
                        if (this.carryingLoot) {
                            ctx.fillStyle = '#334155';
                            ctx.fillRect(5, -8.5, 11, 17);
                            ctx.strokeStyle = '#94a3b8';
                            ctx.lineWidth = 1;
                            ctx.strokeRect(5, -8.5, 11, 17);
                        } else {
                            ctx.fillStyle = this.looterLook?.skin || '#5c3a21';
                            ctx.beginPath(); ctx.arc(5 - stride * 0.5, -8.5, 2.8, 0, Math.PI * 2); ctx.fill();
                            ctx.beginPath(); ctx.arc(5 + stride * 0.5, 8.5, 2.8, 0, Math.PI * 2); ctx.fill();
                        }
                    } else if (this.isMeleeLooter) {
                        const prySwing = Math.sin(this.animPhase * 1.4) * 0.35;
                        ctx.save();
                        ctx.rotate(prySwing);
                        ctx.fillStyle = '#cbd5e1';
                        ctx.fillRect(4, 5, 18, 3);
                        ctx.fillStyle = '#ef4444';
                        ctx.fillRect(19, 4, 4, 5);
                        ctx.restore();
                    } else if (this.faction === 'airsoft_adult') {
                        ctx.fillStyle = '#1e293b';
                        ctx.fillRect(5, 3, 18, 3.6);
                        ctx.fillStyle = '#f97316';
                        ctx.fillRect(22, 3.1, 2.5, 3.4);
                    } else if (this.faction === 'blockade_goon') {
                        ctx.fillStyle = '#78350f';
                        ctx.fillRect(3, 3, 12, 3.8);
                        ctx.fillStyle = '#18181b';
                        ctx.fillRect(14, 3.3, 10, 3);
                        ctx.fillStyle = '#475569';
                        ctx.fillRect(10, 6.5, 4, 4);
                    } else {
                        ctx.fillStyle = '#0f172a';
                        ctx.fillRect(6, 3, this.faction === 'security' ? 18 : 13, 3.5);
                    }

                    ctx.fillStyle = this.faction === 'airsoft_adult' ? '#d4a373' : '#5c3a21';
                    ctx.beginPath();
                    ctx.arc(0, 0, this.isBoss ? 7.8 : 6.4, 0, Math.PI * 2);
                    ctx.fill();

                    if (this.looterLook) {
                        drawLooterHead(ctx, this.looterLook);
                    } else if (this.faction === 'airsoft_adult') {
                        ctx.fillStyle = '#365314';
                        ctx.beginPath();
                        ctx.arc(-0.5, 0, 8.6, 0, Math.PI * 2);
                        ctx.fill();
                    } else if (this.faction === 'security') {
                        ctx.fillStyle = '#1e3a8a';
                        ctx.beginPath();
                        ctx.arc(-1, 0, 6.8, Math.PI * 0.45, Math.PI * 1.55);
                        ctx.fill();
                    }

                    ctx.restore();

                    ctx.font = '900 10px ui-monospace, monospace';
                    ctx.textAlign = 'center';
                    if (this.barkTimer > 0 && this.barkText) {
                        ctx.fillStyle = '#fde047';
                        ctx.fillText(`"${this.barkText}"`, this.x, this.y - 26);
                    }
                    if (this.blindTimer > 0) {
                        ctx.fillStyle = '#e0f2fe';
                        ctx.fillText('BLINDED', this.x, this.y - 18);
                    } else if (this.spotterWarnTimer > 0) {
                        ctx.fillStyle = '#facc15';
                        ctx.fillText('! NANGU !', this.x, this.y - 18);
                    } else if (this.panicState === 'wounded_retreat') {
                        ctx.fillStyle = '#f87171';
                        ctx.fillText('WOUNDED', this.x, this.y - 18);
                    } else if (this.panicState === 'in_cover') {
                        ctx.fillStyle = '#94a3b8';
                        ctx.fillText('COVER', this.x, this.y - 18);
                    } else if (this.panicState === 'fleeing' || this.panicState === 'frozen') {
                        ctx.fillStyle = this.panicState === 'frozen' ? '#38bdf8' : '#facc15';
                        ctx.fillText(this.panicState === 'frozen' ? '?!' : 'FLEE', this.x, this.y - 18);
                    } else if (this.hesitationTimer > 0.08 && this.hesitationTimer < this.hesitationRequired) {
                        ctx.fillStyle = '#fde047';
                        ctx.fillText('?', this.x, this.y - 18);
                    } else if (this.hp < this.maxHp || this.isBoss) {
                        const bw = this.isBoss ? 36 : 24;
                        ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
                        ctx.fillRect(this.x - bw / 2, this.y - 22, bw, 4);
                        ctx.fillStyle = this.isBoss ? '#f59e0b' : '#ef4444';
                        ctx.fillRect(this.x - bw / 2, this.y - 22, bw * (this.hp / this.maxHp), 4);
                    }
                }
            }

            // ============================================================================
            // VEHICLE CLASS (PLAYER & CIVILIAN DRIVER AI + TAXI RANK + STAGED CAR BOOT)
            // ============================================================================
            class Vehicle {
                constructor(x, y, type = 'sedan', angle = 0, lockedBlockade = false, floor = null, isPlayerStagedCar = false) {
                    this.x = x;
                    this.y = y;
                    this.type = type;
                    this.angle = angle;
                    this.lockedBlockade = lockedBlockade;
                    this.floor = floor;
                    this.isPlayerStagedCar = isPlayerStagedCar;
                    this.goBagLooted = false;
                    this.speed = 0;
                    this.driver = null;
                    this.destroyed = false;
                    this.smokeTimer = 0;

                    if (type === 'taxi') {
                        this.w = 64;
                        this.h = 30;
                        this.maxSpeed = 480;
                        this.hp = 380;
                        this.color = '#f8fafc';
                        this.stripe = '#2563eb';
                    } else if (type === 'armored') {
                        this.w = 72;
                        this.h = 34;
                        this.maxSpeed = 430;
                        this.hp = 700;
                        this.color = '#365314';
                        this.stripe = '#a3e635';
                    } else if (type === 'police') {
                        this.w = 56;
                        this.h = 27;
                        this.maxSpeed = 590;
                        this.hp = 340;
                        this.color = '#f8fafc';
                        this.stripe = '#1d4ed8';
                    } else {
                        this.w = 54;
                        this.h = 26;
                        this.maxSpeed = 540;
                        this.hp = 280;
                        const palette = ['#dc2626', '#d97706', '#0284c7', '#475569', '#6d28d9'];
                        this.color = isPlayerStagedCar ? '#334155' : palette[Math2.randInt(0, palette.length - 1)];
                        this.stripe = null;
                    }
                    this.maxHp = this.hp;
                }

                takeDamage(amount) {
                    if (this.destroyed || this.isPlayerStagedCar) return;
                    this.hp -= amount;
                    if (this.hp <= 0) {
                        this.hp = 0;
                        this.destroyed = true;
                        this.speed = 0;
                        sfx.playExplosion();
                        camera.shake = 18;
                        decals.push(new Decal(this.x, this.y, 'scorch', this.angle, 48, this.floor));

                        for (let i = 0; i < 36; i++) {
                            const a = Math2.rand(0, Math.PI * 2);
                            const col = ['#ef4444', '#f97316', '#facc15', '#1e293b'][Math2.randInt(0, 3)];
                            particles.push(new Particle(this.x, this.y, a, col, Math2.rand(4, 10), Math2.rand(80, 340), Math2.rand(0.4, 0.9)));
                        }

                        if (this.driver === 'player' && player) {
                            player.vehicle = null;
                            player.x = this.x + 36;
                            player.y = this.y + 36;
                            player.takeDamage(55);
                        }
                        this.driver = null;
                    }
                }

                update(dt) {
                    if (this.floor && this.floor !== currentMallFloor) return;
                    if (this.destroyed) {
                        this.smokeTimer += dt;
                        if (this.smokeTimer > 0.14) {
                            this.smokeTimer = 0;
                            particles.push(new Particle(this.x, this.y, -Math.PI / 2 + Math2.rand(-0.4, 0.4), '#334155', Math2.rand(5, 9), Math2.rand(25, 65), 0.7));
                        }
                        return;
                    }

                    if (this.driver === 'player' && player) {
                        let throttle = 0;
                        let steer = 0;
                        if (keys['w'] || keys['arrowup']) throttle += 1;
                        if (keys['s'] || keys['arrowdown']) throttle -= 1;
                        if (keys['a'] || keys['arrowleft']) steer -= 1;
                        if (keys['d'] || keys['arrowright']) steer += 1;

                        if (isMobileDevice && (Math.abs(touchInput.moveX) > 0.1 || Math.abs(touchInput.moveY) > 0.1)) {
                            const mag = Math.min(1, Math.hypot(touchInput.moveX, touchInput.moveY));
                            const desired = Math.atan2(touchInput.moveY, touchInput.moveX);
                            const diff = Math.atan2(Math.sin(desired - this.angle), Math.cos(desired - this.angle));
                            throttle = mag;
                            steer = Math2.clamp(diff * 2.4, -1, 1);
                        }

                        if (throttle > 0) this.speed += 460 * dt;
                        else if (throttle < 0) this.speed -= 380 * dt;
                        else this.speed *= Math.pow(0.18, dt);

                        if (keys['space'] || touchInput.sprint) {
                            this.speed *= Math.pow(0.03, dt);
                        }

                        this.speed = Math2.clamp(this.speed, -190, this.maxSpeed);

                        if (Math.abs(this.speed) > 12) {
                            const dir = this.speed >= 0 ? 1 : -1;
                            this.angle += steer * 2.85 * dir * dt;
                        }

                        this.x += Math.cos(this.angle) * this.speed * dt;
                        this.y += Math.sin(this.angle) * this.speed * dt;
                        this.x = Math2.clamp(this.x, 45, WORLD_SIZE - 45);
                        this.y = Math2.clamp(this.y, 45, WORLD_SIZE - 45);

                        const colProxy = { x: this.x, y: this.y, r: 22 };
                        for (let i = 0; i < buildings.length; i++) {
                            if (circleRectResolve(colProxy, buildings[i])) {
                                this.x = colProxy.x;
                                this.y = colProxy.y;
                                this.speed *= -0.35;
                            }
                        }

                        if (Math.abs(this.speed) > 130) {
                            for (let i = 0; i < enemies.length; i++) {
                                const e = enemies[i];
                                if (e.hp > 0 && Math2.dist(this.x, this.y, e.x, e.y) < 28 + e.r) {
                                    e.takeDamage(Math.abs(this.speed) * 0.48, this.angle);
                                    this.speed *= 0.86;
                                    camera.shake = 6;
                                }
                            }
                        }

                        player.x = this.x;
                        player.y = this.y;
                        player.angle = this.angle;
                    } else if (this.driver === 'civilian') {
                        this.speed = Math2.lerp(this.speed, 175, dt * 2);
                        this.x += Math.cos(this.angle) * this.speed * dt;
                        this.y += Math.sin(this.angle) * this.speed * dt;

                        if (this.x < 160 || this.x > WORLD_SIZE - 160 || this.y < 160 || this.y > WORLD_SIZE - 160) {
                            this.angle += Math.PI * 0.5;
                        }
                        const colProxy = { x: this.x, y: this.y, r: 22 };
                        for (let i = 0; i < buildings.length; i++) {
                            if (circleRectResolve(colProxy, buildings[i])) {
                                this.x = colProxy.x;
                                this.y = colProxy.y;
                                this.angle += Math.PI * 0.5;
                            }
                        }
                    } else {
                        this.speed *= Math.pow(0.08, dt);
                    }
                }

                draw(ctx) {
                    if (this.floor && this.floor !== currentMallFloor) return;
                    ctx.save();
                    ctx.translate(this.x, this.y);
                    ctx.rotate(this.angle);

                    ctx.fillStyle = 'rgba(0, 0, 0, 0.45)';
                    ctx.fillRect(-this.w / 2 + 4, -this.h / 2 + 5, this.w, this.h);

                    ctx.fillStyle = this.destroyed ? '#1e293b' : this.color;
                    ctx.beginPath();
                    ctx.roundRect(-this.w / 2, -this.h / 2, this.w, this.h, 5);
                    ctx.fill();

                    if (!this.destroyed && this.stripe) {
                        ctx.fillStyle = this.stripe;
                        ctx.fillRect(-this.w * 0.35, -this.h / 2 + 2, this.w * 0.7, 4);
                        ctx.fillRect(-this.w * 0.35, this.h / 2 - 6, this.w * 0.7, 4);
                    }

                    ctx.fillStyle = this.destroyed ? '#090d16' : '#0f172a';
                    ctx.fillRect(this.w * 0.1, -this.h * 0.38, this.w * 0.22, this.h * 0.76);
                    ctx.fillRect(-this.w * 0.34, -this.h * 0.36, this.w * 0.16, this.h * 0.72);

                    if (!this.destroyed && this.type === 'police') {
                        const pulse = Math.sin(performance.now() * 0.015) > 0;
                        ctx.fillStyle = pulse ? '#3b82f6' : '#ef4444';
                        ctx.fillRect(-3, -this.h * 0.32, 6, this.h * 0.32);
                        ctx.fillStyle = pulse ? '#ef4444' : '#3b82f6';
                        ctx.fillRect(-3, 0, 6, this.h * 0.32);
                    }

                    if (!this.destroyed) {
                        ctx.fillStyle = '#fef08a';
                        ctx.fillRect(this.w / 2 - 2, -this.h * 0.38, 3, 5);
                        ctx.fillRect(this.w / 2 - 2, this.h * 0.38 - 5, 3, 5);
                        ctx.fillStyle = '#ef4444';
                        ctx.fillRect(-this.w / 2 - 1, -this.h * 0.38, 2, 5);
                        ctx.fillRect(-this.w / 2 - 1, this.h * 0.38 - 5, 2, 5);
                    }

                    ctx.restore();

                    if (!this.destroyed && this.isPlayerStagedCar) {
                        ctx.fillStyle = this.goBagLooted ? '#4ade80' : '#facc15';
                        ctx.font = '900 9.5px ui-monospace, monospace';
                        ctx.textAlign = 'center';
                        ctx.fillText(this.goBagLooted ? 'C\'S CAR [GEAR RECOVERED]' : 'C\'S CAR [GO-BAG IN BOOT]', this.x, this.y - 22);
                    } else if (!this.destroyed && this.type === 'taxi' && this.lockedBlockade) {
                        ctx.fillStyle = '#38bdf8';
                        ctx.font = '800 9px ui-monospace, monospace';
                        ctx.textAlign = 'center';
                        ctx.fillText('TAXI RANK [IDLING]', this.x, this.y - 20);
                    }
                }
            }

            // ============================================================================
            // PLAYER CONTROLLER (WITH STANCE, GO-BAG, MOLLE VEST, POWER BANK & EXECUTIONS)
            // ============================================================================
            class Player {
                constructor(x, y, archetype = 'suburbs') {
                    this.x = x;
                    this.y = y;
                    this.archetype = archetype;
                    this.gender = archetype;
                    this.r = (archetype === 'mall' || archetype === 'training') ? 10.5 : 12;
                    this.hp = 100;
                    this.maxHp = 100;
                    this.armor = (archetype === 'training') ? 0 : ((archetype === 'mall') ? 0 : ((archetype === 'sniper') ? 25 : 20));
                    this.stamina = 100;
                    this.speed = (archetype === 'mall' || archetype === 'training') ? 236 : 225;
                    this.angle = 0;
                    this.weaponIdx = 0;
                    this.lastShot = 0;
                    this.reloading = false;
                    this.reloadStart = 0;
                    this.vehicle = null;
                    this.lightMode = 'off';
                    this.strobePhase = 0;
                    this.opticsMode = 'normal';

                    this.hasGoBag = (archetype !== 'mall');
                    this.hasMolleVest = (archetype !== 'mall');
                    this.hasCrowbar = false;
                    this.isSneaking = false;
                    this.walkPhase = 0;
                    this.opticCharge = (archetype !== 'mall') ? 100 : 0;
                    this.powerBankMah = (archetype !== 'mall') ? 10000 : 0;
                    this.powerBankMaxMah = 10000;
                    this.lowBatteryWarned = false;
                }

                get flashlightOn() {
                    return this.lightMode !== 'off';
                }

                toggleSneak() {
                    this.isSneaking = !this.isSneaking;
                    sfx.playClick();
                    showBanner(
                        this.isSneaking
                            ? 'STANCE: CROUCH / SNEAK (SILENT FOOTSTEPS • LOW PROFILE)'
                            : 'STANCE: RUN (NORMAL SPEED)',
                        1400
                    );
                    updateHUD();
                }

                toggleAmmoLoad() {
                    const wep = WEAPONS[this.weaponIdx];
                    if (!wep || wep.id !== 'glock26') return;
                    if (wep.ammoLoad === 'fmj') {
                        if (wep.jhpReserve <= 0) {
                            sfx.playClick();
                            showBanner('NO 120GR +P HOLLOW POINTS SCAVENGED YET', 1500);
                            return;
                        }
                        wep.ammoLoad = 'jhp';
                        wep.reserve = wep.jhpReserve;
                        sfx.playReload();
                        showBanner('SWITCHED TO 120GR (+P) JHP — HIGH FLASH & STOPPING POWER', 1800);
                    } else {
                        wep.ammoLoad = 'fmj';
                        wep.reserve = wep.fmjReserve;
                        sfx.playReload();
                        showBanner('SWITCHED TO 100GR FMJ — LOW FLASH & QUIETER REPORT', 1800);
                    }
                    updateHUD();
                }

                cycleOptics() {
                    if (!this.hasGoBag) {
                        sfx.playClick();
                        showMonologue(
                            'C // INTERNAL THOUGHT',
                            'My thermal/NVG monocular, power bank, and MOLLE rig are locked in the boot of my car down in the B1 Underground Parkade. Have to reach B1 first.',
                            5600
                        );
                        return;
                    }

                    if (this.opticsMode === 'normal') {
                        if (this.opticCharge < 6) {
                            sfx.playClick();
                            showBanner('MONOCULAR CELL DEPLETED — LET POWER BANK TRICKLE-CHARGE!', 1800);
                            return;
                        }
                        this.opticsMode = 'nvg';
                        sfx.playOpticsWhine();
                        showBanner('OPTICS: NIGHT VISION (NVG) + INVISIBLE IR LASER', 1600);
                    } else if (this.opticsMode === 'nvg') {
                        this.opticsMode = 'thermal';
                        sfx.playOpticsWhine();
                        showBanner('OPTICS: WHITE-HOT THERMAL (FLIR) + IR LASER (BATTERY DRAINING)', 1700);
                    } else {
                        this.opticsMode = 'normal';
                        sfx.playClick();
                        showBanner('OPTICS: OFF (TRICKLE CHARGING FROM USB-C POWER BANK)', 1500);
                    }
                    updateHUD();
                }

                toggleUtilityLight() {
                    if (this.lightMode === 'off') {
                        this.lightMode = 'beam';
                        sfx.playClick();
                        showBanner('UNDER-BARREL LIGHT: STEADY BEAM (EXPOSES POSITION)', 1500);
                    } else {
                        this.lightMode = 'off';
                        sfx.playClick();
                        showBanner('UNDER-BARREL LIGHT: OFF (SHADOW CONCEALMENT)', 1400);
                    }
                    updateHUD();
                }

                toggleStrobe() {
                    if (this.lightMode === 'strobe') {
                        this.lightMode = 'off';
                        sfx.playClick();
                        showBanner('TACTICAL STROBE: OFF', 1300);
                    } else {
                        this.lightMode = 'strobe';
                        this.strobePhase = 0;
                        sfx.playClick();
                        showBanner('TACTICAL STROBE: ACTIVE (DISORIENTS ENEMIES IN CONE)', 1700);
                    }
                    updateHUD();
                }

                findExecutableEnemy() {
                    if (this.vehicle) return null;
                    const knifeUnlocked = WEAPONS.some((w) => (w.id === 'knife' || w.id === 'panga' || w.id === 'rubber_knife') && w.unlocked);
                    if (!knifeUnlocked) return null;

                    const fl = (mission && mission.campaign === 'mall') ? currentMallFloor : null;
                    let best = null;
                    let bestDist = 42;
                    for (let i = 0; i < enemies.length; i++) {
                        const e = enemies[i];
                        if (e.hp <= 0 || (fl && e.floor !== fl)) continue;
                        const d = Math2.dist(this.x, this.y, e.x, e.y);
                        if (d < bestDist && e.isExecutionVulnerable(this) && hasLoS(this.x, this.y, e.x, e.y)) {
                            bestDist = d;
                            best = e;
                        }
                    }
                    return best;
                }

                performSilentExecution(target) {
                    const isTraining = (mission && mission.campaign === 'training');
                    this.angle = Math2.angle(this.x, this.y, target.x, target.y);
                    sfx.playExecution();
                    camera.shake = 4.5;
                    target.takeDamage(999, this.angle, true, false);
                    showBanner(
                        isTraining
                            ? 'SILENT RUBBER KNIFE TAP! ("HIT! NICE SNEAK!")'
                            : 'SILENT 7" BLADE TAKEDOWN — ZERO GUNSHOT NOISE!',
                        1800,
                        true
                    );
                }

                unlockGoBagFromBoot(car) {
                    car.goBagLooted = true;
                    this.hasGoBag = true;
                    this.hasMolleVest = true;
                    this.armor = 55;
                    this.opticCharge = 100;
                    this.powerBankMah = 10000;
                    this.lowBatteryWarned = false;

                    const g26 = WEAPONS.find((w) => w.id === 'glock26');
                    if (g26) {
                        g26.fmjReserve += 15;
                        g26.jhpReserve += 15;
                        g26.reserve = (g26.ammoLoad === 'jhp') ? g26.jhpReserve : g26.fmjReserve;
                    }

                    updatePortraitSVG(this.gender);
                    sfx.playPickup();
                    updateHUD();

                    phoneCutscene.start({
                        clock: '07:22 AM',
                        opsec: 'OPSEC WARNING: CELLULAR SIGNAL UNENCRYPTED (NO DMR RADIO)',
                        contactName: 'DAVID // EXFIL OPS',
                        contactSub: 'BURNER SIM &bull; B1 PARKADE REPEATER',
                        contactAvatar: 'male',
                        messages: [
                            { side: 'system', text: 'GO-BAG & MOLLE PLATE CARRIER EQUIPPED // +55 ARMOR' },
                            { side: 'outgoing', sender: 'C', time: '07:22', text: 'Popped the boot on B1. Slipped into my MOLLE carrier, grabbed my spare mags, and pulled out the thermal/NVG monocular + 10,000 mAh USB-C power bank.' },
                            { side: 'incoming', sender: 'DAVID', time: '07:22', text: 'Careful with continuous thermal—that sensor draws heavy current. Snap it on [V] to scan dark concourses with your IR laser, then switch it off so the 10,000 mAh bank trickle-charges the cell.' },
                            { side: 'incoming', sender: 'DAVID', time: '07:23', text: 'Main central escalators just dropped their steel fire shutters! Take the North Service Stairwell up through Ground [G] and Level 1 to reach the L2 Skybridge!' }
                        ]
                    });
                }

                handleContextInteract() {
                    if (this.vehicle) {
                        this.toggleVehicle();
                        return;
                    }

                    const execTarget = this.findExecutableEnemy();
                    if (execTarget) {
                        this.performSilentExecution(execTarget);
                        return;
                    }

                    const fl = (mission && mission.campaign === 'mall') ? currentMallFloor : null;
                    for (let i = 0; i < civilians.length; i++) {
                        const c = civilians[i];
                        if (!c.dead && (!fl || c.floor === fl) && Math2.dist(this.x, this.y, c.x, c.y) < 52) {
                            c.interact();
                            return;
                        }
                    }

                    if (mission && mission.campaign === 'mall' && currentMallFloor === 'G') {
                        if (Math2.dist(this.x, this.y, 1720, 1520) < 62) {
                            const secDoor = buildings.find((b) => b.id === 'sec_barred_door');
                            if (secDoor) {
                                if (this.hasCrowbar || WEAPONS.some((w) => w.id === 'knife' && w.unlocked)) {
                                    buildings.splice(buildings.indexOf(secDoor), 1);
                                    sfx.playMelee();
                                    camera.shake = 5;
                                    showBanner('PRIED OPEN SECURITY CONTROL ROOM DOOR!', 2200);
                                } else {
                                    sfx.playClick();
                                    showMonologue(
                                        'C // INTERNAL THOUGHT',
                                        'Reinforced security door barred from the inside—and the bulletproof glass window is intact. I need a crowbar from a looter or my 7-inch blade to pry the latch.',
                                        5600
                                    );
                                }
                                return;
                            }
                        }

                        if (Math2.dist(this.x, this.y, 2080, 1580) < 64) {
                            cctvRevealedFloors[currentMallFloor] = true;
                            sfx.playOpticsWhine();
                            showBanner('CCTV CONSOLE ACCESSED — ALL FLOOR HOSTILES & STASHES MAPPED ON RADAR!', 2600);
                            return;
                        }
                    }

                    if (mission && mission.campaign === 'mall') {
                        for (let i = 0; i < vehicles.length; i++) {
                            const v = vehicles[i];
                            if (v.floor === currentMallFloor && v.isPlayerStagedCar && !v.goBagLooted) {
                                if (Math2.dist(this.x, this.y, v.x, v.y) < 68) {
                                    this.unlockGoBagFromBoot(v);
                                    return;
                                }
                            }
                        }

                        for (let i = 0; i < stairwells.length; i++) {
                            const st = stairwells[i];
                            if (st.fromFloor === currentMallFloor && Math2.dist(this.x, this.y, st.x, st.y) < 56) {
                                if (st.blocked) {
                                    sfx.playClick();
                                    showMonologue(
                                        'C // INTERNAL THOUGHT',
                                        st.blockedReason || 'Collapsed steel security shutter blocking the central escalator—I have to take a different route up!',
                                        5600
                                    );
                                    return;
                                }
                                transitionMallFloor(st);
                                return;
                            }
                        }
                    }

                    this.toggleVehicle();
                }

                switchWeapon(idx) {
                    if (idx < 0 || idx >= WEAPONS.length) return;
                    if (!WEAPONS[idx].unlocked) return;
                    this.weaponIdx = idx;
                    this.reloading = false;
                    updateHUD();
                }

                reload() {
                    const wep = WEAPONS[this.weaponIdx];
                    if (this.reloading || wep.type === 'melee') return;
                    const availableReserve = (wep.id === 'glock26')
                        ? (wep.ammoLoad === 'jhp' ? wep.jhpReserve : wep.fmjReserve)
                        : wep.reserve;

                    if (wep.mag >= wep.magMax || availableReserve <= 0) return;

                    const forfeitedRounds = wep.mag;
                    wep.mag = 0;

                    if (wep.type !== 'flame') {
                        const tossAngle = this.angle - Math.PI * 0.62 + Math2.rand(-0.22, 0.22);
                        const dropX = this.x + Math.cos(tossAngle) * 12;
                        const dropY = this.y + Math.sin(tossAngle) * 12;
                        const isPink = (wep.id === 'glock26' || wep.id === 'airsoft_pistol');
                        const isAirsoft = Boolean(wep.isAirsoft);
                        const fl = (mission && mission.campaign === 'mall') ? currentMallFloor : null;
                        droppedMags.push(new DroppedMag(dropX, dropY, tossAngle, isPink, isAirsoft, forfeitedRounds, fl));
                        if (droppedMags.length > 120) droppedMags.shift();
                    }

                    this.reloading = true;
                    this.reloadStart = performance.now();
                    sfx.playReload();
                    if (forfeitedRounds > 0 && wep.type !== 'flame') {
                        const unitWord = wep.isAirsoft ? 'BBs' : 'ROUNDS';
                        showBanner(`MAG TOSSED — FORFEITED ${forfeitedRounds} UNFIRED ${unitWord}`, 1500);
                    }
                    updateHUD();
                }

                toggleVehicle() {
                    if (this.vehicle) {
                        const v = this.vehicle;
                        const exitX = v.x + Math.cos(v.angle + Math.PI / 2) * 34;
                        const exitY = v.y + Math.sin(v.angle + Math.PI / 2) * 34;
                        this.x = exitX;
                        this.y = exitY;
                        v.driver = null;
                        this.vehicle = null;
                        this.speed = 236;
                        updateHUD();
                        return;
                    }

                    const fl = (mission && mission.campaign === 'mall') ? currentMallFloor : null;
                    let closest = null;
                    let bestDist = 54;
                    for (let i = 0; i < vehicles.length; i++) {
                        const v = vehicles[i];
                        if (v.destroyed || v.driver || v.lockedBlockade || v.isPlayerStagedCar) continue;
                        if (fl && v.floor !== fl) continue;
                        const d = Math2.dist(this.x, this.y, v.x, v.y);
                        if (d < bestDist) {
                            bestDist = d;
                            closest = v;
                        }
                    }

                    if (closest) {
                        this.vehicle = closest;
                        closest.driver = 'player';
                        this.reloading = false;
                        this.lightMode = 'off';
                        this.opticsMode = 'normal';
                        this.isSneaking = false;
                        sfx.playHorn();
                        showBanner('VEHICLE ENTERED — [E] EXIT, [SPACE] HANDBRAKE');
                        updateHUD();
                    }
                }

                takeDamage(amount) {
                    if (this.hp <= 0) return;
                    if (mission && mission.campaign === 'training') {
                        this.hp = Math.max(0, this.hp - amount);
                        camera.shake = Math.min(8, camera.shake + amount * 0.14);
                        updateHUD();
                        if (this.hp <= 0) {
                            triggerEndScreen(false, 'TAGGED OUT (6mm BB HIT)', 'A grown-up MilSim player tagged you out! Respawn and push with Younger G & Younger Blaze.');
                        }
                        return;
                    }

                    if (this.armor > 0) {
                        const absorbed = Math.min(this.armor, amount * 0.45);
                        this.armor -= absorbed;
                        amount -= absorbed;
                    }
                    this.hp = Math.max(0, this.hp - amount);
                    camera.shake = Math.min(16, camera.shake + amount * 0.36);
                    updateHUD();

                    if (this.hp <= 0) {
                        triggerEndScreen(false, 'FLATLINED', 'You took fatal gunfire and collapsed in the streets.');
                    }
                }

                update(dt) {
                    if (this.hp <= 0) return;

                    if (this.hasGoBag && !this.vehicle) {
                        if (this.opticsMode !== 'normal') {
                            const drainRate = this.opticsMode === 'thermal' ? 2.6 : 1.9;
                            this.opticCharge = Math.max(0, this.opticCharge - drainRate * dt);
                            if (this.opticCharge <= 15 && !this.lowBatteryWarned) {
                                this.lowBatteryWarned = true;
                                showBanner('MONOCULAR CELL LOW (15%) — SWITCH OFF [V] TO RECHARGE!', 1800);
                            }
                            if (this.opticCharge <= 0) {
                                this.opticsMode = 'normal';
                                sfx.playClick();
                                showBanner('MONOCULAR BATTERY DEPLETED — POWER BANK TRICKLE CHARGING', 2000);
                            }
                        } else if (this.opticCharge < 100 && this.powerBankMah > 0) {
                            const chargeGain = 3.2 * dt;
                            const actualGain = Math.min(100 - this.opticCharge, chargeGain);
                            const mahUsed = actualGain * 24;
                            if (this.powerBankMah >= mahUsed) {
                                this.opticCharge += actualGain;
                                this.powerBankMah = Math.max(0, this.powerBankMah - mahUsed);
                                if (this.opticCharge > 25) this.lowBatteryWarned = false;
                            }
                        }
                    }

                    if (this.lightMode === 'strobe' && !this.vehicle) {
                        this.strobePhase += dt * 16.5;
                        const pulseOn = Math.sin(this.strobePhase * Math.PI * 2) > 0.15;
                        if (pulseOn) {
                            const isDarkAmbient = (mission && mission.campaign === 'mall');
                            const fl = isDarkAmbient ? currentMallFloor : null;
                            const strobeRange = isDarkAmbient ? 360 : 210;
                            for (let i = 0; i < enemies.length; i++) {
                                const e = enemies[i];
                                if (e.hp <= 0 || (fl && e.floor !== fl)) continue;
                                const d = Math2.dist(this.x, this.y, e.x, e.y);
                                if (d < strobeRange && hasLoS(this.x, this.y, e.x, e.y)) {
                                    const angToEnemy = Math2.angle(this.x, this.y, e.x, e.y);
                                    const angEnemyToPlayer = Math2.angle(e.x, e.y, this.x, this.y);
                                    if (Math2.angleDiff(this.angle, angToEnemy) < 0.34 && Math2.angleDiff(e.angle, angEnemyToPlayer) < 1.25) {
                                        e.applyStrobeDaze(this.x, this.y, isDarkAmbient);
                                    }
                                }
                            }
                        }
                    }

                    if (this.reloading) {
                        const wep = WEAPONS[this.weaponIdx];
                        if (performance.now() - this.reloadStart >= wep.reloadTime) {
                            const loadCount = Math.min(wep.magMax, wep.reserve);
                            wep.mag = loadCount;
                            if (wep.id === 'glock26') {
                                if (wep.ammoLoad === 'jhp') {
                                    wep.jhpReserve -= loadCount;
                                    wep.reserve = wep.jhpReserve;
                                } else {
                                    wep.fmjReserve -= loadCount;
                                    wep.reserve = wep.fmjReserve;
                                }
                            } else {
                                wep.reserve -= loadCount;
                            }
                            this.reloading = false;
                            updateHUD();
                        }
                    }

                    if (this.vehicle) {
                        this.updateContextualPrompt();
                        return;
                    }

                    let mx = 0;
                    let my = 0;
                    if (keys['w'] || keys['arrowup']) my -= 1;
                    if (keys['s'] || keys['arrowdown']) my += 1;
                    if (keys['a'] || keys['arrowleft']) mx -= 1;
                    if (keys['d'] || keys['arrowright']) mx += 1;

                    if (isMobileDevice && (Math.abs(touchInput.moveX) > 0.08 || Math.abs(touchInput.moveY) > 0.08)) {
                        mx = touchInput.moveX;
                        my = touchInput.moveY;
                    }

                    const isMoving = Math.hypot(mx, my) > 0.05;
                    const sprinting = isMoving && (keys['shift'] || touchInput.sprint) && this.stamina > 2;
                    if (sprinting && this.isSneaking) {
                        this.isSneaking = false;
                        updateHUD();
                    }

                    if (sprinting) {
                        this.stamina = Math.max(0, this.stamina - 34 * dt);
                    } else {
                        this.stamina = Math.min(100, this.stamina + 22 * dt);
                    }

                    if (isMoving) {
                        const len = Math.max(1, Math.hypot(mx, my));
                        const stanceMult = this.isSneaking ? 0.54 : (sprinting ? 1.48 : 1.0);
                        const moveSpeed = this.speed * stanceMult;
                        this.x += (mx / len) * moveSpeed * dt;
                        this.y += (my / len) * moveSpeed * dt;
                        this.walkPhase += dt * (this.isSneaking ? 7.5 : (sprinting ? 17 : 12.5));
                    }

                    this.x = Math2.clamp(this.x, 30, WORLD_SIZE - 30);
                    this.y = Math2.clamp(this.y, 30, WORLD_SIZE - 30);

                    for (let i = 0; i < buildings.length; i++) {
                        circleRectResolve(this, buildings[i]);
                    }
                    for (let i = 0; i < woodlandTrees.length; i++) {
                        const tr = woodlandTrees[i];
                        circleRectResolve(this, { x: tr.x - tr.trunkR, y: tr.y - tr.trunkR, w: tr.trunkR * 2, h: tr.trunkR * 2 });
                    }

                    if (isMobileDevice) {
                        if (touchInput.aimActive) {
                            this.angle = touchInput.aimAngle;
                        } else if (isMoving) {
                            this.angle = Math.atan2(my, mx);
                        }
                    } else {
                        this.angle = Math2.angle(this.x, this.y, mouse.worldX, mouse.worldY);
                    }

                    const wep = WEAPONS[this.weaponIdx];
                    const wantsFire = isMobileDevice
                        ? (wep.type === 'auto' || wep.type === 'flame' ? touchInput.firing : touchInput.justFired)
                        : (wep.type === 'auto' || wep.type === 'flame' ? mouse.down : mouse.justClicked);

                    if (wantsFire && !this.reloading) {
                        this.tryFire(wep);
                    }

                    this.updateContextualPrompt();
                }

                updateContextualPrompt() {
                    const banner = document.getElementById('promptBanner');
                    if (!banner) return;

                    const execTarget = this.findExecutableEnemy();
                    if (execTarget) {
                        banner.innerText = isMobileDevice ? 'TAP [USE] FOR SILENT ONE-HIT EXECUTION' : 'PRESS [E] FOR SILENT ONE-HIT EXECUTION';
                        banner.classList.add('exec-ready');
                        banner.classList.add('visible');
                        return;
                    }

                    const fl = (mission && mission.campaign === 'mall') ? currentMallFloor : null;
                    for (let i = 0; i < civilians.length; i++) {
                        const c = civilians[i];
                        if (!c.dead && (!fl || c.floor === fl) && Math2.dist(this.x, this.y, c.x, c.y) < 52) {
                            const who = c.label ? c.label : (c.isHostage && c.rescued ? 'RESCUED STAFF' : 'SHOPPER');
                            banner.innerText = isMobileDevice ? `TAP [USE] TO TALK TO ${who}` : `PRESS [E] TO TALK TO ${who}`;
                            banner.classList.remove('exec-ready');
                            banner.classList.add('visible');
                            return;
                        }
                    }

                    if (mission && mission.campaign === 'mall') {
                        if (currentMallFloor === 'G') {
                            const secDoor = buildings.find((b) => b.id === 'sec_barred_door');
                            if (secDoor && Math2.dist(this.x, this.y, 1720, 1520) < 62) {
                                banner.innerText = isMobileDevice ? 'TAP [USE] TO PRY SECURITY DOOR' : 'PRESS [E] TO PRY SECURITY DOOR';
                                banner.classList.remove('exec-ready');
                                banner.classList.add('visible');
                                return;
                            }
                            if (Math2.dist(this.x, this.y, 2080, 1580) < 64) {
                                banner.innerText = isMobileDevice ? 'TAP [USE] CCTV MONITOR CONSOLE' : 'PRESS [E] TO ACCESS CCTV CONSOLE';
                                banner.classList.remove('exec-ready');
                                banner.classList.add('visible');
                                return;
                            }
                        }

                        for (let i = 0; i < vehicles.length; i++) {
                            const v = vehicles[i];
                            if (v.floor === currentMallFloor && v.isPlayerStagedCar && !v.goBagLooted && Math2.dist(this.x, this.y, v.x, v.y) < 68) {
                                banner.innerText = isMobileDevice ? 'TAP [USE] TO OPEN CAR BOOT (GO-BAG & MOLLE VEST)' : 'PRESS [E] TO OPEN CAR BOOT (GO-BAG & MOLLE VEST)';
                                banner.classList.remove('exec-ready');
                                banner.classList.add('visible');
                                return;
                            }
                        }

                        for (let i = 0; i < stairwells.length; i++) {
                            const st = stairwells[i];
                            if (st.fromFloor === currentMallFloor && Math2.dist(this.x, this.y, st.x, st.y) < 56) {
                                banner.innerText = st.blocked
                                    ? `BLOCKED: ${st.label}`
                                    : (isMobileDevice ? `TAP [USE]: ${st.label}` : `PRESS [E]: ${st.label}`);
                                banner.classList.toggle('exec-ready', Boolean(st.blocked));
                                banner.classList.add('visible');
                                return;
                            }
                        }
                    }

                    let nearVeh = false;
                    for (let i = 0; i < vehicles.length; i++) {
                        const v = vehicles[i];
                        if (!v.destroyed && !v.driver && !v.lockedBlockade && !v.isPlayerStagedCar && (!fl || v.floor === fl) && Math2.dist(this.x, this.y, v.x, v.y) < 54) {
                            nearVeh = true;
                            break;
                        }
                    }
                    if (nearVeh) {
                        banner.innerText = isMobileDevice ? 'TAP [USE] TO ENTER VEHICLE' : 'PRESS [E] TO ENTER VEHICLE';
                        banner.classList.remove('exec-ready');
                        banner.classList.add('visible');
                    } else if (banner.innerText.startsWith('PRESS [E]') || banner.innerText.startsWith('TAP [USE]') || banner.innerText.startsWith('BLOCKED:')) {
                        banner.classList.remove('visible');
                        banner.classList.remove('exec-ready');
                    }
                }

                tryFire(wep) {
                    const now = performance.now();
                    if (now - this.lastShot < wep.delay) return;

                    if (wep.type === 'melee') {
                        this.lastShot = now;
                        sfx.playMelee();
                        camera.shake = Math.max(camera.shake, 2.5);
                        const reachX = this.x + Math.cos(this.angle) * (wep.range * 0.72);
                        const reachY = this.y + Math.sin(this.angle) * (wep.range * 0.72);

                        for (let i = 0; i < 6; i++) {
                            const a = this.angle + Math2.rand(-0.7, 0.7);
                            particles.push(new Particle(reachX, reachY, a, wep.isAirsoft ? '#fb923c' : '#e2e8f0', 2.2, Math2.rand(70, 160), 0.14));
                        }

                        const fl = (mission && mission.campaign === 'mall') ? currentMallFloor : null;
                        for (let i = 0; i < enemies.length; i++) {
                            const e = enemies[i];
                            if (e.hp > 0 && (!fl || e.floor === fl) && Math2.dist(reachX, reachY, e.x, e.y) < wep.range + e.r) {
                                e.takeDamage(wep.dmg, this.angle, true);
                            }
                        }
                        return;
                    }

                    if (wep.mag <= 0) {
                        this.reload();
                        return;
                    }

                    this.lastShot = now;
                    wep.mag--;
                    updateHUD();

                    if (wep.type === 'flame') {
                        sfx.playFlamethrower();
                        camera.shake = Math.max(camera.shake, 1.8);
                        const mx = this.x + Math.cos(this.angle) * 24;
                        const my = this.y + Math.sin(this.angle) * 24;
                        for (let p = 0; p < 2; p++) {
                            const a = this.angle + Math2.rand(-wep.spread, wep.spread);
                            flameJets.push(new FlameJet(mx, my, a, wep.bulletSpeed + Math2.rand(-80, 90), wep.dmg));
                        }
                        if (wep.mag === 0 && wep.reserve > 0) this.reload();
                        return;
                    }

                    const isJHP = (wep.id === 'glock26' && wep.ammoLoad === 'jhp');
                    const effectiveRecoil = isJHP ? 5.5 : wep.recoil;
                    const effectiveDmg = isJHP ? 68 : wep.dmg;
                    const effectiveSpeed = isJHP ? 13800 : wep.bulletSpeed;
                    const alertRadius = wep.isAirsoft ? 320 : (isJHP ? 880 : 560);

                    sfx.playGunshot(isJHP ? 'glock26_jhp' : wep.id);
                    if (wep.type === 'bolt') {
                        setTimeout(() => sfx.playBoltCycle(), 240);
                    }
                    camera.shake = Math.max(camera.shake, effectiveRecoil);

                    const muzzleX = this.x + Math.cos(this.angle) * 22;
                    const muzzleY = this.y + Math.sin(this.angle) * 22;

                    const scoped = (wep.id === 'ruger' && (mouse.rightDown || touchInput.scopeActive));
                    const effectiveSpread = scoped ? 0.0005 : wep.spread;

                    const pellets = wep.pellets || 1;
                    for (let p = 0; p < pellets; p++) {
                        const a = this.angle + Math2.rand(-effectiveSpread, effectiveSpread);
                        bullets.push(new Bullet(muzzleX, muzzleY, a, effectiveSpeed, effectiveDmg, 'player', this, Boolean(wep.pierce), Boolean(wep.isAirsoft), isJHP));
                    }

                    if (!wep.isAirsoft) {
                        const fl = (mission && mission.campaign === 'mall') ? currentMallFloor : null;
                        shells.push(new Shell(this.x + Math.cos(this.angle + 1.3) * 10, this.y + Math.sin(this.angle + 1.3) * 10, this.angle + Math.PI / 2 + Math2.rand(-0.3, 0.3), fl));
                        if (shells.length > 160) shells.shift();

                        const flashCount = isJHP ? 12 : (wep.id === 'ruger' ? 9 : 5);
                        const flashSize = isJHP ? 4.4 : (wep.id === 'ruger' ? 4.0 : 2.6);
                        const flashColor = isJHP ? '#fb923c' : '#fef08a';
                        for (let s = 0; s < flashCount; s++) {
                            particles.push(new Particle(muzzleX, muzzleY, this.angle + Math2.rand(-0.48, 0.48), flashColor, flashSize, Math2.rand(140, 320), isJHP ? 0.14 : 0.09));
                        }
                    }

                    broadcastGunshot(this.x, this.y, alertRadius, false);

                    if (wep.mag === 0 && wep.reserve > 0) {
                        this.reload();
                    }
                }

                draw(ctx) {
                    if (this.vehicle) return;
                    const wep = WEAPONS[this.weaponIdx];

                    if (this.opticsMode !== 'normal' && this.hasGoBag) {
                        const laserDist = 720;
                        const targetX = this.x + Math.cos(this.angle) * laserDist;
                        const targetY = this.y + Math.sin(this.angle) * laserDist;
                        const hitT = raycastBuildingsT(this.x, this.y, targetX, targetY);
                        const endX = this.x + (targetX - this.x) * hitT;
                        const endY = this.y + (targetY - this.y) * hitT;

                        ctx.save();
                        const laserColor = this.opticsMode === 'thermal' ? 'rgba(255, 255, 255, 0.72)' : 'rgba(74, 222, 128, 0.72)';
                        ctx.strokeStyle = laserColor;
                        ctx.lineWidth = 1.6;
                        ctx.setLineDash([6, 4]);
                        ctx.beginPath();
                        ctx.moveTo(this.x + Math.cos(this.angle) * 16, this.y + Math.sin(this.angle) * 16);
                        ctx.lineTo(endX, endY);
                        ctx.stroke();
                        ctx.setLineDash([]);

                        ctx.fillStyle = this.opticsMode === 'thermal' ? '#ffffff' : '#86efac';
                        ctx.beginPath();
                        ctx.arc(endX, endY, 3.2, 0, Math.PI * 2);
                        ctx.fill();
                        ctx.restore();
                    }

                    ctx.save();
                    ctx.translate(this.x, this.y);
                    ctx.rotate(this.angle);

                    const crouchScale = this.isSneaking ? 0.88 : 1.0;
                    ctx.scale(crouchScale, crouchScale);

                    const isMall = (this.gender === 'mall');
                    const isYoungC = (this.gender === 'training');
                    const isFemale = (this.gender === 'female');
                    const isSniper = (this.gender === 'sniper');

                    const stride = Math.sin(this.walkPhase) * (this.isSneaking ? 2.4 : 4.5);
                    ctx.fillStyle = '#090d16';
                    ctx.fillRect(-3 + stride, -6.2, 5.5, 3.0);
                    ctx.fillRect(-3 - stride, 3.2, 5.5, 3.0);

                    ctx.fillStyle = 'rgba(0, 0, 0, 0.42)';
                    ctx.beginPath();
                    ctx.ellipse(2, 3, (isMall || isYoungC) ? 10.5 : 12, (isMall || isYoungC) ? 12 : (isFemale ? 13.5 : 15), 0, 0, Math.PI * 2);
                    ctx.fill();

                    if (isYoungC) {
                        ctx.fillStyle = '#3f6212';
                    } else if (isMall) {
                        ctx.fillStyle = this.hasMolleVest ? '#365314' : '#4b5539';
                    } else if (isFemale) {
                        ctx.fillStyle = '#334155';
                    } else if (isSniper) {
                        ctx.fillStyle = '#3f6212';
                    } else {
                        ctx.fillStyle = '#27272a';
                    }
                    ctx.beginPath();
                    ctx.ellipse(-2, 0, (isMall || isYoungC) ? 8.5 : 10, (isMall || isYoungC) ? 11.5 : (isFemale ? 13 : 14.5), 0, 0, Math.PI * 2);
                    ctx.fill();

                    if (isMall && !this.hasMolleVest) {
                        ctx.strokeStyle = '#1f291c';
                        ctx.lineWidth = 1.2;
                        ctx.beginPath();
                        ctx.moveTo(-6, -9); ctx.lineTo(4, 9);
                        ctx.moveTo(-6, 9); ctx.lineTo(4, -9);
                        ctx.stroke();
                    }

                    if (isFemale && wep.id === 'flamethrower') {
                        ctx.fillStyle = '#ea580c';
                        ctx.beginPath();
                        ctx.roundRect(-13, -7, 8, 6, 2);
                        ctx.roundRect(-13, 1, 8, 6, 2);
                        ctx.fill();
                    }

                    if (isMall && this.hasMolleVest) {
                        ctx.fillStyle = '#1a2e05';
                        ctx.fillRect(-5, -8, 9, 16);
                    } else if (!isMall && !isYoungC) {
                        ctx.fillStyle = isFemale ? '#1e293b' : '#4d7c0f';
                        ctx.fillRect(-5, -9, 10, 18);
                    }

                    if (wep.id === 'glock26' || wep.id === 'airsoft_pistol') {
                        ctx.fillStyle = '#ec4899';
                        ctx.fillRect(5, 2.2, 12, 4.2);
                        ctx.fillStyle = '#1e293b';
                        ctx.fillRect(6, 2.7, 11, 2.8);
                        ctx.fillStyle = '#ef4444';
                        ctx.fillRect(7, 3.6, 2, 1.2);
                        if (wep.id === 'glock26') {
                            ctx.fillStyle = '#090d16';
                            ctx.fillRect(12, 2.5, 4.5, 3.4);
                        } else {
                            ctx.fillStyle = '#f97316';
                            ctx.fillRect(17, 2.7, 2.2, 2.8);
                        }
                    } else if (wep.type === 'melee') {
                        ctx.fillStyle = wep.isAirsoft ? '#f97316' : '#cbd5e1';
                        ctx.fillRect(5, 4, 17, 2.8);
                    } else if (wep.id === 'ruger') {
                        ctx.fillStyle = '#78350f';
                        ctx.fillRect(2, 2.8, 17, 4.4);
                        ctx.fillStyle = '#1e293b';
                        ctx.fillRect(18, 3.5, 16, 2.8);
                        ctx.fillStyle = '#090d16';
                        ctx.fillRect(8, 2.2, 11, 5.2);
                    } else if (wep.id === 'flamethrower') {
                        ctx.fillStyle = '#334155';
                        ctx.fillRect(4, 2, 19, 5);
                        ctx.fillStyle = '#f97316';
                        ctx.fillRect(22, 3, 4, 3);
                    } else {
                        ctx.fillStyle = wep.color;
                        ctx.fillRect(5, 3, wep.type === 'auto' || wep.id === 'shotgun' ? 21 : 13, 3.8);
                    }

                    ctx.fillStyle = (isMall || isYoungC) ? '#d49b6a' : (isFemale ? '#f1c2a0' : '#e0ac69');
                    ctx.beginPath();
                    ctx.arc(0, 0, (isMall || isYoungC) ? 5.8 : 6.5, 0, Math.PI * 2);
                    ctx.fill();

                    if (isYoungC) {
                        ctx.fillStyle = '#111827';
                        ctx.beginPath();
                        ctx.arc(-1, 0, 6.2, Math.PI * 0.42, Math.PI * 1.58);
                        ctx.fill();
                        ctx.beginPath();
                        ctx.arc(-8.5, 0, 2.8, 0, Math.PI * 2);
                        ctx.fill();
                        ctx.fillStyle = 'rgba(56, 189, 248, 0.55)';
                        ctx.fillRect(4.2, -4.5, 2.2, 9);
                    } else if (isMall) {
                        ctx.fillStyle = '#090d16';
                        ctx.beginPath();
                        ctx.arc(-1, 0, 6.3, Math.PI * 0.42, Math.PI * 1.58);
                        ctx.fill();
                        ctx.beginPath();
                        ctx.ellipse(-6.5, 0, 3.4, 4.4, 0, 0, Math.PI * 2);
                        ctx.fill();
                    } else if (isFemale) {
                        ctx.fillStyle = '#dc2626';
                        ctx.beginPath();
                        ctx.arc(-1.2, 0, 7.0, Math.PI * 0.35, Math.PI * 1.65);
                        ctx.fill();
                        ctx.beginPath();
                        ctx.ellipse(-7, 0, 4.5, 5.2, 0, 0, Math.PI * 2);
                        ctx.fill();
                    } else if (isSniper) {
                        ctx.fillStyle = '#3f6212';
                        ctx.beginPath();
                        ctx.arc(0, 0, 7.2, 0, Math.PI * 2);
                        ctx.fill();
                    } else {
                        ctx.fillStyle = '#e2e8f0';
                        ctx.beginPath();
                        ctx.arc(-1, 0, 6.6, Math.PI * 0.48, Math.PI * 1.52);
                        ctx.fill();
                    }

                    if (sfx.musicEnabled) {
                        ctx.fillStyle = '#ffffff';
                        ctx.beginPath();
                        ctx.arc(0.5, -5.6, 1.9, 0, Math.PI * 2);
                        ctx.arc(0.5, 5.6, 1.9, 0, Math.PI * 2);
                        ctx.fill();
                    }

                    ctx.restore();
                }
            }

            // ============================================================================
            // WORLD GENERATION PER CAMPAIGN
            // ============================================================================
            function clearWorldArrays() {
                radarTerrainDirty = true;
                buildings = [];
                roads = [];
                crosswalks = [];
                railTracks = [];
                woodlandTrees = [];
                woodlandCreek = null;
                mallZones = [];
                mallLights = [];
                stairwells = [];
                vehicles = [];
                bullets = [];
                flameJets = [];
                enemies = [];
                allies = [];
                civilians = [];
                particles = [];
                decals = [];
                shells = [];
                droppedMags = [];
                corpses = [];
                pickups = [];
            }

            function generateWoodlandWorld() {
                WORLD_SIZE = 3200;
                clearWorldArrays();

                woodlandCreek = [
                    { x: 1450, y: 0 },
                    { x: 1580, y: 800 },
                    { x: 1380, y: 1600 },
                    { x: 1640, y: 2400 },
                    { x: 1520, y: 3200 }
                ];

                buildings.push({ x: 1360, y: 1540, w: 280, h: 110, color: '#78350f', roof: '#92400e', isLowWall: true, label: 'CREEK FOOTBRIDGE' });

                const bunkers = [
                    [680, 1450, 26, 110], [680, 1660, 26, 110],
                    [960, 1280, 90, 24], [960, 1920, 90, 24],
                    [1180, 1420, 26, 95], [1180, 1710, 26, 95],
                    [1820, 1360, 26, 110], [1820, 1740, 26, 110],
                    [2120, 1240, 110, 26], [2120, 1940, 110, 26],
                    [2380, 1440, 28, 120], [2380, 1660, 28, 120],
                    [2680, 1420, 32, 360], [2712, 1420, 180, 32], [2712, 1748, 180, 32]
                ];
                for (let i = 0; i < bunkers.length; i++) {
                    const bk = bunkers[i];
                    buildings.push({ x: bk[0], y: bk[1], w: bk[2], h: bk[3], color: '#57534e', roof: '#78716c', isLowWall: true });
                }

                for (let i = 0; i < 165; i++) {
                    const tx = Math2.rand(120, WORLD_SIZE - 120);
                    const ty = Math2.rand(120, WORLD_SIZE - 120);
                    if (Math2.dist(tx, ty, 460, 1600) < 220) continue;
                    if (Math2.dist(tx, ty, 2780, 1600) < 240) continue;
                    if (Math.abs(tx - 1520) < 130) continue;
                    if (pointInsideBuilding(tx, ty, 45)) continue;
                    woodlandTrees.push({
                        x: tx,
                        y: ty,
                        trunkR: Math2.rand(11, 16),
                        canopyR: Math2.rand(42, 68),
                        shade: ['#14532d', '#166534', '#15803d', '#064e3b'][Math2.randInt(0, 3)]
                    });
                }

                const gearDrops = [
                    [820, 1520, 'bb_bag'], [1260, 1600, 'airsoft_aeg'], [1680, 1595, 'bb_bag'],
                    [2040, 1420, 'bb_bag'], [2280, 1780, 'bb_bag'], [2540, 1600, 'bb_bag']
                ];
                for (let i = 0; i < gearDrops.length; i++) {
                    pickups.push(new Pickup(gearDrops[i][0], gearDrops[i][1], gearDrops[i][2]));
                }
            }

            // ============================================================================
            // 4-FLOOR SANDTON-SCALE MALL GENERATOR (L2, L1, G, B1 UNDERGROUND PARKADE)
            // ============================================================================
            const MALL_FLOOR_TITLES = {
                L2: 'FLOOR: L2 — SKYBRIDGE & EAST TAXI PLAZA',
                L1: 'FLOOR: L1 — UPPER GALLERIA & GOLDEN DRAGON',
                G: 'FLOOR: G — GROUND CONCOURSE & SECURITY COMPLEX',
                B1: 'FLOOR: B1 — UNDERGROUND PARKADE (STAGED CAR)'
            };

            function loadMallFloorGeometry(floorId) {
                radarTerrainDirty = true;
                currentMallFloor = floorId;
                buildings = [];
                mallZones = [];

                const wallT = 36;
                buildings.push({ x: 260, y: 260, w: 2080, h: wallT, color: '#0f172a', roof: '#1e293b', height: 22 });
                buildings.push({ x: 260, y: 1904, w: 2080, h: wallT, color: '#0f172a', roof: '#1e293b', height: 22 });
                buildings.push({ x: 260, y: 260, w: wallT, h: 1680, color: '#0f172a', roof: '#1e293b', height: 22 });

                if (floorId === 'L2') {
                    buildings.push({ x: 2304, y: 260, w: wallT, h: 660, color: '#0f172a', roof: '#1e293b', height: 22 });
                    buildings.push({ x: 2304, y: 1280, w: wallT, h: 660, color: '#0f172a', roof: '#1e293b', height: 22 });

                    mallZones.push({ x: 296, y: 296, w: 2008, h: 1608, floor: '#18202c', label: 'LEVEL 2 — SKYBRIDGE & FOOD COURT' });
                    mallZones.push({ x: 1640, y: 920, w: 680, h: 360, floor: '#222d3f', label: 'EAST SKYBRIDGE CONCOURSE' });
                    mallZones.push({ x: 2340, y: 300, w: 740, h: 1600, floor: '#1e293b', label: 'OUTER TAXI RANK & BLOCKADE' });

                    buildings.push({ x: 420, y: 380, w: 560, h: 420, color: '#1e293b', roof: '#334155', height: 18, label: 'UPPER FOOD COURT' });
                    buildings.push({ x: 420, y: 1380, w: 620, h: 440, color: '#1e293b', roof: '#334155', height: 18, label: 'CINEMA & ARCADE WING' });
                    buildings.push({ x: 1680, y: 380, w: 540, h: 440, color: '#27272a', roof: '#3f3f46', height: 18, label: 'LUXURY BOUTIQUES (L2)' });
                    buildings.push({ x: 1680, y: 1380, w: 540, h: 440, color: '#27272a', roof: '#3f3f46', height: 18, label: 'EXECUTIVE SUITES (L2)' });

                    buildings.push({ x: 2475, y: 920, w: 28, h: 140, color: '#78350f', roof: '#92400e', isLowWall: true });
                    buildings.push({ x: 2475, y: 1140, w: 28, h: 140, color: '#78350f', roof: '#92400e', isLowWall: true });

                    mallLights.push({ floor: 'L2', x: 1960, y: 1100, r: 220, color: 'rgba(148, 163, 184, 0.30)', flicker: false });
                    mallLights.push({ floor: 'L2', x: 2660, y: 1100, r: 460, color: 'rgba(253, 224, 71, 0.36)', flicker: false });
                } else if (floorId === 'L1') {
                    buildings.push({ x: 2304, y: 260, w: wallT, h: 1680, color: '#0f172a', roof: '#1e293b', height: 22 });

                    mallZones.push({ x: 296, y: 296, w: 2008, h: 1608, floor: '#18202c', label: 'LEVEL 1 — UPPER GALLERIA' });
                    mallZones.push({ x: 340, y: 1480, w: 580, h: 390, floor: '#2a1215', label: 'GOLDEN DRAGON DISCOUNT SHOP' });

                    buildings.push({ x: 340, y: 1460, w: 580, h: 20, color: '#7f1d1d', roof: '#991b1b', height: 14 });
                    buildings.push({ x: 920, y: 1460, w: 20, h: 250, color: '#7f1d1d', roof: '#991b1b', height: 14 });
                    buildings.push({ x: 460, y: 1640, w: 260, h: 22, color: '#991b1b', roof: '#dc2626', isLowWall: true });

                    buildings.push({ x: 360, y: 380, w: 620, h: 360, color: '#1e293b', roof: '#334155', height: 18, label: 'FASHION GALLERIA' });
                    buildings.push({ x: 1680, y: 380, w: 560, h: 420, color: '#1e293b', roof: '#334155', height: 18, label: 'ELECTRONICS WING' });
                    buildings.push({ x: 1680, y: 1360, w: 560, h: 460, color: '#27272a', roof: '#3f3f46', height: 18, label: 'DEPARTMENT STORE (L1)' });

                    mallLights.push({ floor: 'L1', x: 520, y: 1690, r: 95, color: 'rgba(239, 68, 68, 0.25)', flicker: true });
                    mallLights.push({ floor: 'L1', x: 1330, y: 1100, r: 195, color: 'rgba(148, 163, 184, 0.26)', flicker: false });
                } else if (floorId === 'G') {
                    buildings.push({ x: 2304, y: 260, w: wallT, h: 1680, color: '#0f172a', roof: '#1e293b', height: 22 });

                    mallZones.push({ x: 296, y: 296, w: 2008, h: 1608, floor: '#1e2634', label: 'GROUND FLOOR CONCOURSE (G)' });
                    mallZones.push({ x: 1060, y: 780, w: 540, h: 540, floor: '#253042', label: 'CENTRAL SUNKEN ATRIUM (G)' });
                    mallZones.push({ x: 340, y: 340, w: 620, h: 460, floor: '#1c2923', label: 'SAFARI OUTDOOR & BUTCHERY SECTION' });
                    mallZones.push({ x: 1720, y: 1360, w: 520, h: 460, floor: '#131c31', label: 'MALL SECURITY CONTROL ROOM' });

                    buildings.push({ x: 1120, y: 840, w: 36, h: 36, color: '#334155', roof: '#475569', height: 18 });
                    buildings.push({ x: 1500, y: 840, w: 36, h: 36, color: '#334155', roof: '#475569', height: 18 });
                    buildings.push({ x: 1120, y: 1220, w: 36, h: 36, color: '#334155', roof: '#475569', height: 18 });
                    buildings.push({ x: 1500, y: 1220, w: 36, h: 36, color: '#334155', roof: '#475569', height: 18 });

                    buildings.push({ x: 360, y: 1340, w: 580, h: 480, color: '#1e293b', roof: '#334155', height: 16, label: 'SUPERMARKET & PHARMACY' });
                    buildings.push({ x: 1720, y: 1340, w: 520, h: 24, color: '#1e3a8a', roof: '#2563eb', height: 18 });
                    buildings.push({ x: 1720, y: 1800, w: 520, h: 24, color: '#1e3a8a', roof: '#2563eb', height: 18 });
                    buildings.push({ x: 2216, y: 1340, w: 24, h: 484, color: '#1e3a8a', roof: '#2563eb', height: 18 });
                    buildings.push({ x: 1720, y: 1364, w: 24, h: 116, color: '#1e3a8a', roof: '#2563eb', height: 18 });
                    buildings.push({ x: 1720, y: 1560, w: 24, h: 240, color: '#1e3a8a', roof: '#2563eb', height: 18 });
                    buildings.push({ id: 'sec_barred_door', x: 1722, y: 1480, w: 20, h: 80, color: '#7f1d1d', roof: '#dc2626', isLowWall: true });
                    buildings.push({ x: 2090, y: 1480, w: 65, h: 190, color: '#0f172a', roof: '#38bdf8', isLowWall: true });

                    buildings.push({ x: 1720, y: 380, w: 520, h: 380, color: '#27272a', roof: '#3f3f46', height: 16, label: 'BANKING HALL (G)' });
                    buildings.push({ x: 520, y: 620, w: 220, h: 22, color: '#78350f', roof: '#92400e', isLowWall: true });

                    mallLights.push({ floor: 'G', x: 1330, y: 1050, r: 280, color: 'rgba(148, 163, 184, 0.34)', flicker: false });
                    mallLights.push({ floor: 'G', x: 640, y: 540, r: 125, color: 'rgba(250, 204, 21, 0.22)', flicker: true });
                    mallLights.push({ floor: 'G', x: 1980, y: 1580, r: 150, color: 'rgba(56, 189, 248, 0.28)', flicker: true });
                } else if (floorId === 'B1') {
                    buildings.push({ x: 2304, y: 260, w: wallT, h: 1680, color: '#0f172a', roof: '#1e293b', height: 22 });

                    mallZones.push({ x: 296, y: 296, w: 2008, h: 1608, floor: '#11151e', label: 'B1 UNDERGROUND PARKADE // BAY 14' });
                    mallZones.push({ x: 1680, y: 1360, w: 560, h: 480, floor: '#18202c', label: 'STAFF BAY 14 (C\'S STAGED CAR)' });

                    const pillars = [
                        [680, 620], [1080, 620], [1480, 620], [1880, 620],
                        [680, 1080], [1080, 1080], [1480, 1080], [1880, 1080],
                        [680, 1540], [1080, 1540], [1480, 1540]
                    ];
                    for (let i = 0; i < pillars.length; i++) {
                        buildings.push({ x: pillars[i][0], y: pillars[i][1], w: 42, h: 42, color: '#334155', roof: '#475569', height: 18 });
                    }

                    buildings.push({ x: 1260, y: 1420, w: 26, h: 150, color: '#78350f', roof: '#92400e', isLowWall: true });

                    mallLights.push({ floor: 'B1', x: 1960, y: 1580, r: 150, color: 'rgba(239, 68, 68, 0.28)', flicker: true });
                    mallLights.push({ floor: 'B1', x: 880, y: 850, r: 120, color: 'rgba(250, 204, 21, 0.18)', flicker: true });
                }

                const floorEl = document.getElementById('floorIndicator');
                if (floorEl) {
                    floorEl.style.display = 'block';
                    floorEl.innerText = MALL_FLOOR_TITLES[floorId] || `FLOOR: ${floorId}`;
                }
            }

            function transitionMallFloor(st) {
                sfx.playStairs();
                loadMallFloorGeometry(st.toFloor);
                player.x = st.toX;
                player.y = st.toY;
                camera.x = player.x - canvas.width / 2;
                camera.y = player.y - canvas.height / 2;
                showBanner(`ARRIVED AT ${MALL_FLOOR_TITLES[st.toFloor]}`, 2000);

                if (st.toFloor === 'L1' && player.hasGoBag && mission && !mission.alternateRouteMonologueShown) {
                    mission.alternateRouteMonologueShown = true;
                    showMonologue(
                        'C // INTERNAL THOUGHT',
                        'Main central escalators are sealed off by dropped fire shutters. Good thing I took the North Service Stairwell—crossing Level 1 to the East Service Stairs up to L2 Skybridge.',
                        6200
                    );
                }
                updateHUD();
            }

            function generateMallWorld() {
                WORLD_SIZE = 3200;
                clearWorldArrays();
                mallLights = [];

                stairwells = [
                    { fromFloor: 'L1', toFloor: 'G', x: 1330, y: 1340, toX: 1330, toY: 1320, label: 'CENTRAL ESCALATOR DOWN TO GROUND [G]', blocked: false },
                    { fromFloor: 'G', toFloor: 'B1', x: 1330, y: 1760, toX: 1330, toY: 1720, label: 'SOUTH STAIRWELL DOWN TO B1 PARKADE', blocked: false },
                    { fromFloor: 'G', toFloor: 'L1', x: 1330, y: 1340, toX: 1330, toY: 1340, label: 'CENTRAL ESCALATOR TO L1 (SHUTTER COLLAPSED)', blocked: true, blockedReason: 'Collapsed steel fire shutter blocking the central escalator! Take the North Service Stairwell [x: 520, y: 380] instead.' },
                    { fromFloor: 'B1', toFloor: 'G', x: 1330, y: 1760, toX: 1330, toY: 1720, label: 'SOUTH STAIRWELL UP TO GROUND [G]', blocked: false },
                    { fromFloor: 'G', toFloor: 'L1', x: 520, y: 380, toX: 520, toY: 420, label: 'NORTH SERVICE STAIRWELL UP TO LEVEL 1 [L1]', blocked: false },
                    { fromFloor: 'L1', toFloor: 'L2', x: 2140, y: 1100, toX: 1840, toY: 1100, label: 'EAST SERVICE STAIRS UP TO L2 SKYBRIDGE', blocked: false },
                    { fromFloor: 'L2', toFloor: 'L1', x: 1840, y: 1100, toX: 2140, toY: 1100, label: 'EAST SERVICE STAIRS DOWN TO LEVEL 1 [L1]', blocked: false }
                ];

                loadMallFloorGeometry('L1');

                civilians.push(new Civilian(450, 1740, 'L1', 'MR. CHEN [E]'));
                civilians.push(new Civilian(520, 1790, 'L1'));
                civilians.push(new Civilian(660, 1760, 'L1'));
                civilians.push(new Civilian(820, 1680, 'L1'));
                civilians.push(new Civilian(1620, 620, 'L1', null, true));
                civilians.push(new Civilian(1650, 665, 'L1', null, true));
                civilians.push(new Civilian(1010, 1520, 'G', null, true));
                civilians.push(new Civilian(1010, 1565, 'G', null, true));
                civilians.push(new Civilian(1180, 1460, 'G'));
                civilians.push(new Civilian(1480, 1480, 'G'));

                vehicles.push(new Vehicle(1980, 1580, 'sedan', Math.PI, true, 'B1', true));
                vehicles.push(new Vehicle(860, 1340, 'sedan', Math.PI / 2, true, 'B1', false));
                vehicles.push(new Vehicle(1020, 860, 'sedan', 0, true, 'B1', false));

                vehicles.push(new Vehicle(2790, 960, 'taxi', Math.PI / 2, true, 'L2'));
                vehicles.push(new Vehicle(2790, 1110, 'taxi', Math.PI / 2, true, 'L2'));
                vehicles.push(new Vehicle(2790, 1260, 'taxi', Math.PI / 2, true, 'L2'));

                const mallLoot = [
                    [440, 1580, 'water', 'L1'], [790, 1540, 'food', 'L1'], [1140, 1260, 'cash', 'L1'],
                    [1520, 920, 'cash', 'L1'], [1940, 1100, 'food', 'L1'], [1040, 560, 'water', 'L1'],
                    [580, 470, 'hunting_knife', 'G'], [440, 440, 'food', 'G'], [780, 460, 'water', 'G'],
                    [1960, 1450, 'jhp_stash', 'G'], [1960, 1710, 'shotgun', 'G'], [1960, 1580, 'cash', 'G'],
                    [1220, 1050, 'cash', 'G'], [1440, 1050, 'water', 'G'],
                    [1760, 1480, 'jhp_stash', 'B1'], [920, 1520, 'cash', 'B1'], [760, 880, 'water', 'B1'],
                    [1330, 1100, 'cash', 'L2'], [1330, 1540, 'food', 'L2'], [1920, 960, 'ammo', 'L2'],
                    [2020, 1240, 'cash', 'L2'], [2620, 1040, 'cash', 'L2']
                ];
                for (let i = 0; i < mallLoot.length; i++) {
                    pickups.push(new Pickup(mallLoot[i][0], mallLoot[i][1], mallLoot[i][2], mallLoot[i][3]));
                }
            }

            function generateSuburbsWorld() {
                WORLD_SIZE = 4400;
                clearWorldArrays();
                const roadCenters = [700, 1700, 2700, 3700];
                const roadWidth = 220;

                for (let i = 0; i < roadCenters.length; i++) {
                    const c = roadCenters[i];
                    roads.push({ x: 0, y: c - roadWidth / 2, w: WORLD_SIZE, h: roadWidth, dir: 'h' });
                    roads.push({ x: c - roadWidth / 2, y: 0, w: roadWidth, h: WORLD_SIZE, dir: 'v' });
                }

                for (let ix = 0; ix < roadCenters.length; ix++) {
                    for (let iy = 0; iy < roadCenters.length; iy++) {
                        const cx = roadCenters[ix];
                        const cy = roadCenters[iy];
                        crosswalks.push({ x: cx - 80, y: cy - roadWidth / 2 - 22, w: 160, h: 18, dir: 'h' });
                        crosswalks.push({ x: cx - 80, y: cy + roadWidth / 2 + 4, w: 160, h: 18, dir: 'h' });
                        crosswalks.push({ x: cx - roadWidth / 2 - 22, y: cy - 80, w: 18, h: 160, dir: 'v' });
                        crosswalks.push({ x: cx + roadWidth / 2 + 4, y: cy - 80, w: 18, h: 160, dir: 'v' });
                    }
                }

                const blockBounds = [
                    [840, 1560],
                    [1840, 2560],
                    [2840, 3560]
                ];

                const roofColors = ['#334155', '#475569', '#3f3f46', '#1e293b', '#52525b'];
                const wallColors = ['#1e293b', '#27272a', '#0f172a', '#18181b'];

                for (let bx = 0; bx < blockBounds.length; bx++) {
                    for (let by = 0; by < blockBounds.length; by++) {
                        const [minX, maxX] = blockBounds[bx];
                        const [minY, maxY] = blockBounds[by];

                        if (bx === 0 && by === 0) {
                            buildings.push({ x: minX + 120, y: minY + 120, w: 280, h: 240, color: '#1e293b', roof: '#475569', height: 22, label: 'COMPOUND' });
                            buildings.push({ x: minX + 60, y: minY + 60, w: 460, h: 20, color: '#334155', roof: '#64748b', isLowWall: true });
                            buildings.push({ x: minX + 60, y: minY + 60, w: 20, h: 420, color: '#334155', roof: '#64748b', isLowWall: true });
                            continue;
                        }

                        if (bx === 2 && by === 2) {
                            buildings.push({ x: minX + 180, y: minY + 180, w: 360, h: 320, color: '#1e3a8a', roof: '#1d4ed8', height: 34, label: 'SUBSTATION #4' });
                            buildings.push({ x: minX + 110, y: minY + 110, w: 180, h: 22, color: '#475569', roof: '#94a3b8', isLowWall: true });
                            buildings.push({ x: minX + 430, y: minY + 540, w: 190, h: 22, color: '#475569', roof: '#94a3b8', isLowWall: true });
                            continue;
                        }

                        const cols = 2;
                        const rows = 2;
                        const cellW = (maxX - minX) / cols;
                        const cellH = (maxY - minY) / rows;
                        for (let cx = 0; cx < cols; cx++) {
                            for (let cy = 0; cy < rows; cy++) {
                                const w = Math2.randInt(190, 265);
                                const h = Math2.randInt(180, 255);
                                const x = minX + cx * cellW + (cellW - w) / 2;
                                const y = minY + cy * cellH + (cellH - h) / 2;
                                buildings.push({
                                    x, y, w, h,
                                    color: wallColors[Math2.randInt(0, wallColors.length - 1)],
                                    roof: roofColors[Math2.randInt(0, roofColors.length - 1)],
                                    height: Math2.randInt(18, 36)
                                });
                            }
                        }
                    }
                }

                for (let i = 0; i < 48; i++) {
                    const bx = Math2.rand(420, WORLD_SIZE - 420);
                    const by = Math2.rand(420, WORLD_SIZE - 420);
                    if (Math2.dist(bx, by, 1340, 1340) < 340) continue;
                    if (pointInsideBuilding(bx, by, 50)) continue;
                    const horiz = Math.random() < 0.5;
                    buildings.push({
                        x: bx, y: by,
                        w: horiz ? Math2.randInt(75, 135) : 22,
                        h: horiz ? 22 : Math2.randInt(75, 135),
                        color: '#78350f', roof: '#92400e', isLowWall: true
                    });
                }

                const vehicleSpawns = [
                    [1560, 1730, 'sedan', 0],
                    [2660, 1180, 'taxi', Math.PI / 2],
                    [1730, 2540, 'police', Math.PI / 2],
                    [2540, 2730, 'sedan', Math.PI],
                    [3660, 2260, 'armored', Math.PI / 2],
                    [1140, 3660, 'taxi', 0],
                    [3180, 730, 'sedan', Math.PI]
                ];

                for (let i = 0; i < vehicleSpawns.length; i++) {
                    const vs = vehicleSpawns[i];
                    const v = new Vehicle(vs[0], vs[1], vs[2], vs[3]);
                    if (i === 1 || i === 5) v.driver = 'civilian';
                    vehicles.push(v);
                }

                const lootSpawns = [
                    [1340, 1420, 'ammo'], [1380, 1420, 'armor'],
                    [1700, 1700, 'health'], [2700, 1700, 'shotgun'],
                    [1700, 2700, 'ammo'], [2700, 2700, 'armor'],
                    [3100, 2700, 'ar15'], [3150, 2700, 'health'],
                    [2200, 3700, 'ammo'], [3700, 2200, 'health']
                ];
                for (let i = 0; i < lootSpawns.length; i++) {
                    pickups.push(new Pickup(lootSpawns[i][0], lootSpawns[i][1], lootSpawns[i][2]));
                }
            }

            function generateCbdWorld() {
                WORLD_SIZE = 4400;
                clearWorldArrays();
                const avenues = [640, 1520, 2400, 3280, 3960];
                const roadWidth = 210;

                for (let i = 0; i < avenues.length; i++) {
                    const c = avenues[i];
                    roads.push({ x: 0, y: c - roadWidth / 2, w: WORLD_SIZE, h: roadWidth, dir: 'h' });
                    roads.push({ x: c - roadWidth / 2, y: 0, w: roadWidth, h: WORLD_SIZE, dir: 'v' });
                }

                for (let ix = 0; ix < avenues.length; ix++) {
                    for (let iy = 0; iy < avenues.length; iy++) {
                        const cx = avenues[ix];
                        const cy = avenues[iy];
                        crosswalks.push({ x: cx - 75, y: cy - roadWidth / 2 - 20, w: 150, h: 16, dir: 'h' });
                        crosswalks.push({ x: cx - 75, y: cy + roadWidth / 2 + 4, w: 150, h: 16, dir: 'h' });
                    }
                }

                const cbdBlocks = [
                    [780, 1380],
                    [1660, 2260],
                    [2540, 3140],
                    [3420, 3820]
                ];

                const towerRoofs = ['#1e293b', '#0f172a', '#334155', '#172554', '#27272a'];
                for (let bx = 0; bx < cbdBlocks.length; bx++) {
                    for (let by = 0; by < cbdBlocks.length; by++) {
                        const [minX, maxX] = cbdBlocks[bx];
                        const [minY, maxY] = cbdBlocks[by];

                        if (bx === 3 && by === 3) {
                            buildings.push({ x: minX + 40, y: minY + 40, w: 320, h: 320, color: '#0f172a', roof: '#0284c7', height: 48, label: 'CARLTON PLAZA' });
                            continue;
                        }

                        const pad = 26;
                        buildings.push({
                            x: minX + pad,
                            y: minY + pad,
                            w: (maxX - minX) - pad * 2,
                            h: (maxY - minY) - pad * 2,
                            color: '#090d16',
                            roof: towerRoofs[(bx + by) % towerRoofs.length],
                            height: Math2.randInt(44, 72)
                        });
                    }
                }

                const cbdBarricades = [
                    [1520, 960, 140, 24], [1520, 1940, 140, 24],
                    [2400, 1280, 150, 24], [2400, 2860, 150, 24],
                    [1960, 2400, 24, 140], [2920, 2400, 24, 140],
                    [3280, 3120, 160, 26]
                ];
                for (let i = 0; i < cbdBarricades.length; i++) {
                    const b = cbdBarricades[i];
                    buildings.push({ x: b[0] - b[2] / 2, y: b[1] - b[3] / 2, w: b[2], h: b[3], color: '#7c2d12', roof: '#ea580c', isLowWall: true });
                }

                const cbdVehicles = [
                    [820, 675, 'police', 0],
                    [1555, 1120, 'taxi', Math.PI / 2],
                    [2365, 1860, 'taxi', -Math.PI / 2],
                    [1980, 2435, 'armored', 0],
                    [3315, 2640, 'police', Math.PI / 2],
                    [2880, 3315, 'taxi', Math.PI]
                ];
                for (let i = 0; i < cbdVehicles.length; i++) {
                    const cv = cbdVehicles[i];
                    const v = new Vehicle(cv[0], cv[1], cv[2], cv[3]);
                    if (i === 2) v.driver = 'civilian';
                    vehicles.push(v);
                }

                const cbdLoot = [
                    [740, 640, 'fuel'], [1520, 1520, 'fuel'],
                    [2400, 1520, 'armor'], [2400, 2400, 'fuel'],
                    [1520, 2400, 'shotgun'], [3280, 2400, 'fuel'],
                    [3280, 3280, 'ar15'], [2900, 3280, 'health']
                ];
                for (let i = 0; i < cbdLoot.length; i++) {
                    pickups.push(new Pickup(cbdLoot[i][0], cbdLoot[i][1], cbdLoot[i][2]));
                }
            }

            function generateSniperWorld() {
                WORLD_SIZE = 4400;
                clearWorldArrays();

                railTracks = [
                    { y: 1220 },
                    { y: 1460 },
                    { y: 1700 },
                    { y: 1940 }
                ];

                roads.push({ x: 0, y: 2440, w: WORLD_SIZE, h: 220, dir: 'h' });
                roads.push({ x: 0, y: 3440, w: WORLD_SIZE, h: 220, dir: 'h' });
                roads.push({ x: 960, y: 2150, w: 200, h: 2250, dir: 'v' });
                roads.push({ x: 3160, y: 2150, w: 200, h: 2250, dir: 'v' });

                buildings.push({ x: 1850, y: 2920, w: 460, h: 240, color: '#1e293b', roof: '#475569', height: 52, label: 'SIGNAL TOWER' });
                buildings.push({ x: 1950, y: 2885, w: 260, h: 20, color: '#3f6212', roof: '#65a30d', isLowWall: true });

                const trainCars = [
                    [520, 1185, 290, 56, '#7f1d1d', '#991b1b'],
                    [920, 1185, 310, 56, '#1e3a8a', '#1d4ed8'],
                    [1840, 1185, 340, 56, '#3f3f46', '#52525b'],
                    [2920, 1185, 310, 56, '#78350f', '#92400e'],
                    [680, 1425, 320, 56, '#14532d', '#15803d'],
                    [1460, 1425, 280, 56, '#7f1d1d', '#991b1b'],
                    [2460, 1425, 340, 56, '#1e293b', '#334155'],
                    [3340, 1425, 310, 56, '#78350f', '#92400e'],
                    [980, 1665, 330, 56, '#3f3f46', '#52525b'],
                    [2140, 1665, 290, 56, '#1e3a8a', '#1d4ed8'],
                    [3080, 1665, 320, 56, '#7f1d1d', '#991b1b'],
                    [580, 1905, 310, 56, '#78350f', '#92400e'],
                    [1720, 1905, 340, 56, '#14532d', '#15803d'],
                    [2780, 1905, 300, 56, '#3f3f46', '#52525b']
                ];
                for (let i = 0; i < trainCars.length; i++) {
                    const tc = trainCars[i];
                    buildings.push({ x: tc[0], y: tc[1], w: tc[2], h: tc[3], color: tc[4], roof: tc[5], height: 26, label: i % 4 === 0 ? 'FREIGHT' : '' });
                }

                buildings.push({ x: 460, y: 460, w: 620, h: 360, color: '#0f172a', roof: '#1e293b', height: 38, label: 'NORTH DEPOT' });
                buildings.push({ x: 3180, y: 440, w: 660, h: 380, color: '#0f172a', roof: '#1e293b', height: 38, label: 'ARMORY SHED' });
                buildings.push({ x: 1360, y: 2780, w: 340, h: 280, color: '#18181b', roof: '#27272a', height: 28 });
                buildings.push({ x: 2480, y: 2780, w: 340, h: 280, color: '#18181b', roof: '#27272a', height: 28 });

                const sniperVehicles = [
                    [1120, 2510, 'armored', 0],
                    [2980, 2510, 'sedan', Math.PI],
                    [1020, 3220, 'police', -Math.PI / 2],
                    [3220, 3180, 'taxi', -Math.PI / 2]
                ];
                for (let i = 0; i < sniperVehicles.length; i++) {
                    const sv = sniperVehicles[i];
                    vehicles.push(new Vehicle(sv[0], sv[1], sv[2], sv[3]));
                }

                const sniperLoot = [
                    [1980, 2850, 'ammo'], [2180, 2850, 'armor'],
                    [1650, 2120, 'ammo'], [2520, 2120, 'health'],
                    [2080, 1560, 'ar15'], [1220, 1320, 'ammo'],
                    [2980, 1320, 'health'], [2080, 920, 'ammo']
                ];
                for (let i = 0; i < sniperLoot.length; i++) {
                    pickups.push(new Pickup(sniperLoot[i][0], sniperLoot[i][1], sniperLoot[i][2]));
                }
            }

            // ============================================================================
            // MISSION DIRECTOR (5 PLAYABLE CAMPAIGNS + CHECKPOINT MESSENGER CUTSCENES)
            // ============================================================================
            function broadcastGunshot(gx, gy, radius = 620, isSpotterShout = false) {
                const isMall = (mission && mission.campaign === 'mall');
                for (let i = 0; i < enemies.length; i++) {
                    const e = enemies[i];
                    if (e.hp <= 0) continue;
                    if (isMall && e.floor !== currentMallFloor) continue;
                    if (Math2.dist(gx, gy, e.x, e.y) <= radius) {
                        if (isSpotterShout) e.onHearSpotterShout(gx, gy);
                        else e.onHearGunshot(gx, gy);
                    }
                }
                for (let i = 0; i < civilians.length; i++) {
                    const c = civilians[i];
                    if (!c.dead && (!isMall || c.floor === currentMallFloor) && Math2.dist(gx, gy, c.x, c.y) <= radius) {
                        c.onHearGunshot(gx, gy);
                    }
                }
            }

            function spawnEnemySquad(cx, cy, count, faction, spread = 240, includeBoss = false) {
                for (let i = 0; i < count; i++) {
                    let sx = cx;
                    let sy = cy;
                    for (let attempt = 0; attempt < 25; attempt++) {
                        const tx = Math2.clamp(cx + Math2.rand(-spread, spread), 120, WORLD_SIZE - 120);
                        const ty = Math2.clamp(cy + Math2.rand(-spread, spread), 120, WORLD_SIZE - 120);
                        if (!pointInsideBuilding(tx, ty, 24)) {
                            sx = tx;
                            sy = ty;
                            break;
                        }
                    }
                    const isBoss = includeBoss && i === 0;
                    enemies.push(new Enemy(sx, sy, faction, isBoss));
                }
            }

            function initTrainingMissions() {
                mission = {
                    campaign: 'training',
                    stage: 1,
                    targetX: 2780,
                    targetY: 1600
                };

                allies.push(new Ally(415, 1545, 'YOUNGER G', '#451a03', '#1e3a8a', -1.1));
                allies.push(new Ally(415, 1655, 'YOUNGER BLAZE', '#dc2626', '#7f1d1d', 1.1));

                spawnEnemySquad(1180, 1580, 3, 'airsoft_adult', 190, false);
                spawnEnemySquad(1920, 1560, 4, 'airsoft_adult', 220, false);
                spawnEnemySquad(2620, 1600, 4, 'airsoft_adult', 200, true);
                enemies.push(new Enemy(2780, 1600, 'airsoft_adult', true));

                updateMissionUI();

                phoneCutscene.start({
                    clock: '09:15 AM',
                    opsec: 'PINE RIDGE AIRSOFT ARENA // YOUTH TEAM CHANNEL',
                    isTraining: true,
                    contactName: 'YOUNGER G & YOUNGER BLAZE',
                    contactSub: 'SQUAD GROUP CHAT &bull; SUNDAY SKIRMISH',
                    contactAvatar: 'male',
                    messages: [
                        { side: 'system', text: 'FLASHBACK // WOODLAND AIRSOFT TRAINING MATCH' },
                        { side: 'incoming', sender: 'YOUNGER G', time: '09:14', text: 'C, those grown-up MilSim guys took the far pine ridge and sandbag bunker. Remember: 6mm BBs only—call your hits!' },
                        { side: 'incoming', sender: 'YOUNGER BLAZE', time: '09:15', text: 'I grabbed an AEG carbine—let us push across the creek footbridge together and capture their HQ flag!' },
                        { side: 'outgoing', sender: 'YOUNGER C', time: '09:15', text: 'Copy! Pink G26 GBB is gassed up. Stick to the pine trunks and let us flank them.' }
                    ]
                });
            }

            function initMallMissions() {
                mission = {
                    campaign: 'mall',
                    stage: 1,
                    targetFloor: 'L1',
                    targetX: 1330,
                    targetY: 1340,
                    knifeFound: false,
                    alternateRouteMonologueShown: false
                };
                cctvRevealedFloors = {};

                const floorHostiles = [
                    [1040, 1460, 'unarmed_looter', false, 'L1', 'haul_crate'],
                    [1110, 1540, 'melee_looter', false, 'L1', 'pry_shutter'],
                    [1220, 1420, 'looter', false, 'L1', null],
                    [1390, 1380, 'unarmed_looter', false, 'L1', 'rummage'],
                    [1540, 1140, 'unarmed_looter', false, 'L1', 'haul_crate'],
                    [1580, 960, 'melee_looter', false, 'L1', 'pry_shutter'],
                    [1020, 820, 'looter', false, 'L1', null],
                    [780, 840, 'unarmed_looter', false, 'L1', 'rummage'],
                    [1640, 580, 'hostage_taker', false, 'L1', 'guard_hostage'],
                    [1675, 710, 'hostage_taker', false, 'L1', 'guard_hostage'],
                    [1160, 1260, 'unarmed_looter', false, 'G', 'haul_crate'],
                    [1460, 1260, 'looter', false, 'G', null],
                    [1240, 1620, 'melee_looter', false, 'G', 'pry_shutter'],
                    [1440, 1660, 'unarmed_looter', false, 'G', 'rummage'],
                    [860, 960, 'looter', false, 'G', null],
                    [620, 960, 'unarmed_looter', false, 'G', 'haul_crate'],
                    [660, 520, 'melee_looter', false, 'G', 'rummage'],
                    [980, 1490, 'hostage_taker', false, 'G', 'guard_hostage'],
                    [1035, 1610, 'hostage_taker', false, 'G', 'guard_hostage'],
                    [1660, 1440, 'melee_looter', false, 'G', 'pry_shutter'],
                    [1380, 1520, 'looter', false, 'B1', null],
                    [1680, 1580, 'melee_looter', false, 'B1', 'pry_shutter'],
                    [1840, 1420, 'unarmed_looter', false, 'B1', 'haul_crate'],
                    [1120, 1220, 'looter', false, 'B1', null],
                    [920, 1380, 'unarmed_looter', false, 'B1', 'rummage'],
                    [780, 960, 'looter', false, 'L2', null],
                    [1120, 1340, 'unarmed_looter', false, 'L2', 'haul_crate'],
                    [1340, 1330, 'melee_looter', false, 'L2', 'pry_shutter'],
                    [1540, 1280, 'looter', false, 'L2', null],
                    [1960, 1020, 'looter', false, 'L2', null],
                    [2040, 1180, 'looter', false, 'L2', null],
                    [2430, 980, 'blockade_goon', false, 'L2', null],
                    [2430, 1220, 'blockade_goon', false, 'L2', null],
                    [2560, 1040, 'blockade_goon', true, 'L2', null],
                    [2560, 1160, 'blockade_goon', false, 'L2', null],
                    [2680, 990, 'blockade_goon', false, 'L2', null],
                    [2680, 1210, 'blockade_goon', false, 'L2', null]
                ];
                for (let i = 0; i < floorHostiles.length; i++) {
                    const fh = floorHostiles[i];
                    enemies.push(new Enemy(fh[0], fh[1], fh[2], fh[3], fh[4], fh[5]));
                }

                updateMissionUI();

                phoneCutscene.start({
                    clock: '07:00 AM',
                    opsec: 'OPSEC WARNING: CELLULAR SIGNAL UNENCRYPTED (NO DMR RADIO)',
                    contactName: 'DAVID // EXFIL OPS',
                    contactSub: 'BURNER SIM &bull; SANDTON MALL CELL RELAY',
                    contactAvatar: 'male',
                    messages: [
                        { side: 'system', text: '2 HOURS POST-IMPACT // POWER GRID OFFLINE' },
                        { side: 'incoming', sender: 'DAVID', time: '07:00', text: 'C, tell me your phone still has signal. There was warning last night, so the shops locked down early—nobody expected the outer gates to collapse this fast or the substation to trip.' },
                        { side: 'outgoing', sender: 'C', time: '07:00', text: 'Copy. I drove in at dawn to help Mr. Chen pack his stock at Golden Dragon on Level 1. Lights are dead. I only have my rolled-up flannel, denims, my pink Glock 26 (100gr FMJ), and 3 mags on me.' },
                        { side: 'incoming', sender: 'DAVID', time: '07:01', text: 'Toggle Sneak [C] to move silently past looter sight cones, or talk to Mr. Chen [E] before taking the central escalator down to Ground [G] and B1 for your Go-Bag!' }
                    ]
                });
            }

            function initSuburbsMissions() {
                mission = {
                    campaign: 'suburbs',
                    stage: 1,
                    targetX: 1700,
                    targetY: 1700
                };
                spawnEnemySquad(1700, 1700, 5, 'looter', 220, false);
                spawnEnemySquad(1820, 1420, 2, 'dog', 140, false);
                updateMissionUI();

                phoneCutscene.start({
                    clock: '04:15 PM',
                    opsec: 'OPSEC WARNING: CELLULAR TOWER DEGRADED (NO DMR RADIO)',
                    contactName: 'C // EXFIL LINK',
                    contactSub: 'BURNER SIM &bull; SUBURBAN GRID SECTOR',
                    contactAvatar: 'mall_geared',
                    messages: [
                        { side: 'system', text: '+48 HOURS POST-MELTDOWN // SUBSTATION #4 OFFLINE' },
                        { side: 'incoming', sender: 'C', time: '04:14', text: 'G, I am out of the mall and linked up with Blaze. Substation #4 is still dark—your local micro-grid will not stabilize until someone resets the main breaker.' },
                        { side: 'outgoing', sender: 'G', time: '04:15', text: 'Stepping out of the compound now with the Vektor LM4 and panga. Keep off open frequencies—Syndicate scouts are scanning cellular traffic.' }
                    ]
                });
            }

            function initCbdMissions() {
                mission = {
                    campaign: 'cbd',
                    stage: 1,
                    targetX: 1520,
                    targetY: 960
                };
                spawnEnemySquad(1520, 960, 5, 'looter', 210, false);
                spawnEnemySquad(1240, 640, 3, 'syndicate', 180, false);
                updateMissionUI();

                phoneCutscene.start({
                    clock: '01:40 PM',
                    opsec: 'OPSEC WARNING: CELLULAR SIGNAL UNENCRYPTED (NO DMR RADIO)',
                    contactName: 'G // COMPOUND RELAY',
                    contactSub: 'BURNER SIM &bull; INNER-CITY CBD',
                    contactAvatar: 'male',
                    messages: [
                        { side: 'system', text: 'DAY 1 AFTERNOON // JOBURG CBD CORRIDOR' },
                        { side: 'incoming', sender: 'G', time: '01:39', text: 'Blaze, Syndicate crews threw up burning barricades across Commissioner and Eloff to bottle in the evacuation convoy.' },
                        { side: 'outgoing', sender: 'BLAZE', time: '01:40', text: 'Portable flamethrower is pressurized and ready. Clearing the barricades from the north block down to Carlton Plaza.' }
                    ]
                });
            }

            function initSniperMissions() {
                mission = {
                    campaign: 'sniper',
                    stage: 1,
                    targetX: 2080,
                    targetY: 1460
                };
                spawnEnemySquad(1520, 1340, 4, 'looter', 240, false);
                spawnEnemySquad(2420, 1580, 4, 'syndicate', 260, false);
                spawnEnemySquad(2060, 1820, 2, 'dog', 180, false);
                updateMissionUI();

                phoneCutscene.start({
                    clock: '05:50 PM',
                    opsec: 'OPSEC WARNING: CELLULAR SIGNAL UNENCRYPTED (NO DMR RADIO)',
                    contactName: 'G // OVERWATCH SPOTTER',
                    contactSub: 'BURNER SIM &bull; FREIGHT RAIL YARD',
                    contactAvatar: 'male',
                    messages: [
                        { side: 'system', text: 'DAY 1 DUSK // SIGNAL TOWER OVERWATCH' },
                        { side: 'incoming', sender: 'G', time: '05:49', text: 'Uncle, Syndicate weapons brokers are moving heavy crates along the central freight tracks before nightfall.' },
                        { side: 'outgoing', sender: 'THE UNCLE', time: '05:50', text: 'Ruger M77 is zeroed on the yard from the signal tower deck. Right-click to glass the tracks—I will drop their broker before that shipment leaves.' }
                    ]
                });
            }

            function updateMissionUI() {
                if (!mission) return;
                const phaseEl = document.getElementById('missionPhase');
                const titleEl = document.getElementById('missionTitle');
                const descEl = document.getElementById('missionDesc');

                if (mission.campaign === 'training') {
                    phaseEl.innerText = 'PROLOGUE // WOODLAND AIRSOFT';
                    if (mission.stage === 1) {
                        titleEl.innerText = 'Push Across the Pine Creek';
                        descEl.innerText = 'Coordinate with Younger G and Younger Blaze, use pine trees & bunkers as cover, and tag out the grown-up MilSim squad.';
                    } else {
                        titleEl.innerText = 'Capture the Adults\' HQ Flag';
                        descEl.innerText = 'Clear the sandbag bunker on the East Ridge and touch the Adults\' Base Flag [x: 2780, y: 1600] to win!';
                    }
                    return;
                }

                if (mission.campaign === 'mall') {
                    phaseEl.innerText = `SANDTON MALL // STEP ${mission.stage} OF 4`;
                    if (mission.stage === 1) {
                        titleEl.innerText = 'Descend from L1 to Ground Floor [G]';
                        descEl.innerText = 'Talk to Mr. Chen [E] or slip out of Golden Dragon using Sneak [C]. Reach the Central Escalator [x: 1330, y: 1340] down to Ground [G].';
                    } else if (mission.stage === 2) {
                        titleEl.innerText = 'Reach B1 Parkade & Open Car Boot';
                        descEl.innerText = 'Grab the 7" Fixed Blade in Ground Floor Safari Outdoor & Butchery, then take the South Stairs down to B1 to unlock your Go-Bag & MOLLE Vest.';
                    } else if (mission.stage === 3) {
                        titleEl.innerText = 'Flank Up via North Service Stairs';
                        descEl.innerText = 'Central escalators are shuttered! Ascend Ground [G] -> North Service Stairs -> L1 -> East Service Stairs up to L2 Skybridge.';
                    } else {
                        titleEl.innerText = 'Break the Taxi Rank Blockade';
                        descEl.innerText = 'Use Thermal/NVG [V], IR Laser, and Strobe [T] to eliminate the AK-47 goons outside L2 East Plaza and reach the idling taxis!';
                    }
                    return;
                }

                phaseEl.innerText = `CHAPTER ${mission.stage} / 5`;

                if (mission.campaign === 'sniper') {
                    if (mission.stage === 1) {
                        titleEl.innerText = 'Overwatch: Clear the Rail Yard';
                        descEl.innerText = 'Use your Ruger M77 scope (Right-Click / Scope) from the signal tower to eliminate raiders among the freight cars.';
                    } else if (mission.stage === 2) {
                        titleEl.innerText = 'Intercept the Armory Convoy';
                        descEl.innerText = 'Syndicate gunrunners are moving along the south highway. Pick them off from long range or push down.';
                    } else if (mission.stage === 3) {
                        titleEl.innerText = 'Secure the North Freight Depot';
                        descEl.innerText = 'Advance across the tracks to the North Depot and neutralize the tactical security detachment.';
                    } else if (mission.stage === 4) {
                        titleEl.innerText = 'Eliminate the Arms Broker';
                        descEl.innerText = 'A heavily armored Syndicate Arms Broker is directing shipments at the East Armory Shed. Take the shot.';
                    } else {
                        titleEl.innerText = 'Hold the Overwatch Tower';
                        descEl.innerText = 'Return to the Signal Tower ridge and eliminate the remaining counter-sniper strike team.';
                    }
                    return;
                }

                if (mission.campaign === 'cbd') {
                    if (mission.stage === 1) {
                        titleEl.innerText = 'Torch the North Barricade';
                        descEl.innerText = 'Push down Eloff Street with your Flamethrower and clear the looters blocking the intersection.';
                    } else if (mission.stage === 2) {
                        titleEl.innerText = 'Sweep Commissioner Street';
                        descEl.innerText = 'Syndicate enforcers have locked down the central avenue. Burn through their roadblocks.';
                    } else if (mission.stage === 3) {
                        titleEl.innerText = 'Breach the Metro Depot';
                        descEl.innerText = 'Rogue security units are hoarding fuel and ammo in the southwest block. Wipe them out.';
                    } else if (mission.stage === 4) {
                        titleEl.innerText = 'Incinerate the Syndicate Captain';
                        descEl.innerText = 'The Syndicate Warlord is fortified outside Carlton Plaza. Neutralize him and his guard.';
                    } else {
                        titleEl.innerText = 'Extract at Carlton Plaza';
                        descEl.innerText = 'Clear the plaza perimeter and reach the extraction beacon to secure the CBD corridor.';
                    }
                    return;
                }

                if (mission.stage === 1) {
                    titleEl.innerText = 'Clear the Main Intersection';
                    descEl.innerText = 'Step outside the compound and neutralize the looters and attack dogs blocking the central crossroads.';
                } else if (mission.stage === 2) {
                    titleEl.innerText = 'Eliminate the Syndicate Ambush';
                    descEl.innerText = 'Armed Syndicate raiders have set up barricades to the east. Wipe out their squad.';
                } else if (mission.stage === 3) {
                    titleEl.innerText = 'Breach the Rogue Checkpoint';
                    descEl.innerText = 'Rogue private security forces are holding the southern avenue. Eliminate them.';
                } else if (mission.stage === 4) {
                    titleEl.innerText = 'Assassinate the Warlord';
                    descEl.innerText = 'A heavily armored Warlord is leading an assault near Substation #4. Take him down.';
                } else {
                    titleEl.innerText = 'Secure Substation #4';
                    descEl.innerText = 'Eliminate the final defenders and step into the Substation #4 extraction zone to restore power.';
                }
            }

            function updateMissionDirector() {
                if (!mission || !player) return;
                const activeHostiles = enemies.filter((e) => e.hp > 0 && !e.isUnarmed && e.panicState !== 'fleeing').length;
                const progEl = document.getElementById('missionProgress');

                if (mission.campaign === 'training') {
                    const adultsLeft = enemies.filter((e) => e.hp > 0).length;
                    const distFlag = Math.floor(Math2.dist(player.x, player.y, mission.targetX, mission.targetY));
                    if (mission.stage === 1) {
                        progEl.innerText = `ADULT MILSIM PLAYERS REMAINING: ${adultsLeft}`;
                        if (adultsLeft <= 3) {
                            mission.stage = 2;
                            updateMissionUI();
                            showBanner('STAGE 2: CAPTURE THE ADULTS\' HQ FLAG ON THE EAST RIDGE!', 2600);
                        }
                    } else {
                        progEl.innerText = adultsLeft > 0
                            ? `ADULTS LEFT: ${adultsLeft} | FLAG DIST: ${distFlag}m`
                            : `BUNKER CLEAR! TOUCH HQ FLAG (${distFlag}m)`;
                        if (adultsLeft === 0 && distFlag < 110) {
                            triggerEndScreen(true, 'YOUTH SQUAD VICTORY!', `Younger C, Younger G, and Younger Blaze captured the Adults' HQ Flag and tagged out ${kills} grown-up MilSim players!`);
                        }
                    }
                    return;
                }

                if (mission.campaign === 'mall') {
                    const goonsAlive = enemies.filter((e) => e.hp > 0 && e.faction === 'blockade_goon').length;
                    const stagedCar = vehicles.find((v) => v.isPlayerStagedCar);

                    if (mission.stage === 1) {
                        const dEsc = Math.floor(Math2.dist(player.x, player.y, 1330, 1340));
                        progEl.innerText = currentMallFloor === 'L1'
                            ? `L1 ESCALATOR DOWN: ${dEsc}m (PRESS [E])`
                            : `FLOOR ${currentMallFloor} REACHED!`;
                        if (currentMallFloor === 'G' || currentMallFloor === 'B1') {
                            mission.stage = 2;
                            updateMissionUI();
                            showBanner('OBJECTIVE: FIND 7" BLADE ON [G] & OPEN CAR BOOT IN [B1]!', 2600);
                        }
                    } else if (mission.stage === 2) {
                        const dCar = stagedCar ? Math.floor(Math2.dist(player.x, player.y, stagedCar.x, stagedCar.y)) : 0;
                        progEl.innerText = currentMallFloor === 'B1'
                            ? `CAR BOOT (GO-BAG + MOLLE): ${dCar}m (PRESS [E])`
                            : `TAKE SOUTH STAIRS [1330, 1760] DOWN TO B1`;
                        if (player.hasGoBag) {
                            mission.stage = 3;
                            mission.targetFloor = 'L2';
                            mission.targetX = 2760;
                            mission.targetY = 1110;
                            updateMissionUI();
                        }
                    } else if (mission.stage === 3) {
                        progEl.innerText = `CURRENT FLOOR: ${currentMallFloor} -> ASCEND TO L2 SKYBRIDGE`;
                        if (currentMallFloor === 'L2') {
                            mission.stage = 4;
                            updateMissionUI();
                            showBanner('L2 SKYBRIDGE REACHED — CLEAR THE TAXI RANK BLOCKADE!', 2600);
                        }
                    } else {
                        const distTaxi = Math.floor(Math2.dist(player.x, player.y, 2760, 1110));
                        progEl.innerText = goonsAlive > 0
                            ? `AK-47 BLOCKADE GOONS: ${goonsAlive} | TAXIS: ${distTaxi}m`
                            : `BLOCKADE BROKEN! REACH TAXIS (${distTaxi}m)`;
                        if (currentMallFloor === 'L2' && goonsAlive === 0 && distTaxi < 135) {
                            triggerEndScreen(true, 'BLOCKADE BROKEN — EXFIL SECURED', `C fought from L1 Golden Dragon down to B1 for her Go-Bag & MOLLE rig, bypassed the shuttered escalators, neutralized ${kills} hostiles, and secured R${cashCollected.toLocaleString()} at the taxi rank.`);
                        }
                    }
                    return;
                }

                if (mission.campaign === 'sniper') {
                    if (mission.stage === 1) {
                        progEl.innerText = `RAIL YARD RAIDERS: ${activeHostiles}`;
                        if (activeHostiles === 0) {
                            mission.stage = 2;
                            spawnEnemySquad(2100, 2520, 6, 'syndicate', 340, false);
                            updateMissionUI();
                            showBanner('STAGE 2: INTERCEPT THE HIGHWAY CONVOY!', 2600);
                        }
                    } else if (mission.stage === 2) {
                        progEl.innerText = `CONVOY RAIDERS: ${activeHostiles}`;
                        if (activeHostiles === 0) {
                            mission.stage = 3;
                            spawnEnemySquad(780, 960, 6, 'security', 260, false);
                            updateMissionUI();
                            showBanner('STAGE 3: CLEAR THE NORTH FREIGHT DEPOT!', 2600);
                        }
                    } else if (mission.stage === 3) {
                        progEl.innerText = `DEPOT GUARDS: ${activeHostiles}`;
                        if (activeHostiles === 0) {
                            mission.stage = 4;
                            spawnEnemySquad(3480, 940, 6, 'syndicate', 240, true);
                            updateMissionUI();
                            showBanner('STAGE 4: ELIMINATE THE ARMS BROKER AT EAST SHED!', 2600);
                        }
                    } else if (mission.stage === 4) {
                        progEl.innerText = `BROKER & ESCORTS: ${activeHostiles}`;
                        if (activeHostiles === 0) {
                            mission.stage = 5;
                            mission.targetX = 2080;
                            mission.targetY = 2840;
                            spawnEnemySquad(2080, 2680, 6, 'security', 320, false);
                            updateMissionUI();
                            showBanner('FINAL STAGE: DEFEND THE SIGNAL TOWER!', 2600);
                        }
                    } else if (mission.stage === 5) {
                        const dist = Math.floor(Math2.dist(player.x, player.y, mission.targetX, mission.targetY));
                        progEl.innerText = activeHostiles > 0
                            ? `STRIKE TEAM LEFT: ${activeHostiles}`
                            : `AREA CLEAR! RETURN TO TOWER (${dist}m)`;
                        if (activeHostiles === 0 && dist < 170) {
                            triggerEndScreen(true, 'OVERWATCH COMPLETE', `The Uncle locked down the rail corridor, eliminating ${kills} hostiles with precision fire.`);
                        }
                    }
                    return;
                }

                if (mission.campaign === 'cbd') {
                    if (mission.stage === 1) {
                        progEl.innerText = `BARRICADE HOSTILES: ${activeHostiles}`;
                        if (activeHostiles === 0) {
                            mission.stage = 2;
                            spawnEnemySquad(2400, 1520, 7, 'syndicate', 280, false);
                            updateMissionUI();
                            showBanner('STAGE 2: SWEEP COMMISSIONER STREET!', 2600);
                        }
                    } else if (mission.stage === 2) {
                        progEl.innerText = `SYNDICATE ENFORCERS: ${activeHostiles}`;
                        if (activeHostiles === 0) {
                            mission.stage = 3;
                            spawnEnemySquad(1520, 2860, 7, 'security', 260, false);
                            updateMissionUI();
                            showBanner('STAGE 3: BREACH THE METRO DEPOT!', 2600);
                        }
                    } else if (mission.stage === 3) {
                        progEl.innerText = `ROGUE SECURITY LEFT: ${activeHostiles}`;
                        if (activeHostiles === 0) {
                            mission.stage = 4;
                            spawnEnemySquad(3280, 3120, 6, 'syndicate', 230, true);
                            updateMissionUI();
                            showBanner('STAGE 4: INCINERATE THE SYNDICATE WARLORD!', 2600);
                        }
                    } else if (mission.stage === 4) {
                        progEl.innerText = `WARLORD & GUARD: ${activeHostiles}`;
                        if (activeHostiles === 0) {
                            mission.stage = 5;
                            mission.targetX = 3600;
                            mission.targetY = 3600;
                            spawnEnemySquad(3540, 3540, 6, 'security', 260, false);
                            updateMissionUI();
                            showBanner('FINAL STAGE: EXTRACT AT CARLTON PLAZA!', 2600);
                        }
                    } else if (mission.stage === 5) {
                        const dist = Math.floor(Math2.dist(player.x, player.y, mission.targetX, mission.targetY));
                        progEl.innerText = activeHostiles > 0
                            ? `PLAZA DEFENDERS: ${activeHostiles}`
                            : `PLAZA CLEAR! MOVE TO BEACON (${dist}m)`;
                        if (activeHostiles === 0 && dist < 170) {
                            triggerEndScreen(true, 'CBD CORRIDOR CLEARED', `Blaze torched every Syndicate roadblock in downtown Joburg, neutralizing ${kills} hostiles.`);
                        }
                    }
                    return;
                }

                if (mission.stage === 1) {
                    progEl.innerText = `TARGETS REMAINING: ${activeHostiles}`;
                    if (activeHostiles === 0) {
                        mission.stage = 2;
                        spawnEnemySquad(2700, 1700, 7, 'syndicate', 280, false);
                        updateMissionUI();
                        showBanner('STAGE 2: SYNDICATE AMBUSH AT EAST AVENUE!', 2600);
                    }
                } else if (mission.stage === 2) {
                    progEl.innerText = `SYNDICATE RAIDERS: ${activeHostiles}`;
                    if (activeHostiles === 0) {
                        mission.stage = 3;
                        spawnEnemySquad(1700, 2700, 7, 'security', 260, false);
                        updateMissionUI();
                        showBanner('STAGE 3: ROGUE SECURITY AT SOUTH CHECKPOINT!', 2600);
                    }
                } else if (mission.stage === 3) {
                    progEl.innerText = `ROGUE SECURITY LEFT: ${activeHostiles}`;
                    if (activeHostiles === 0) {
                        mission.stage = 4;
                        spawnEnemySquad(2700, 2700, 6, 'syndicate', 220, true);
                        updateMissionUI();
                        showBanner('STAGE 4: HEAVILY ARMORED WARLORD DETECTED!', 2600);
                    }
                } else if (mission.stage === 4) {
                    progEl.innerText = `WARLORD & ESCORTS: ${activeHostiles}`;
                    if (activeHostiles === 0) {
                        mission.stage = 5;
                        mission.targetX = 3200;
                        mission.targetY = 3200;
                        spawnEnemySquad(3200, 3200, 6, 'security', 260, false);
                        updateMissionUI();
                        showBanner('FINAL STAGE: SECURE SUBSTATION #4!', 2600);
                    }
                } else if (mission.stage === 5) {
                    const dist = Math.floor(Math2.dist(player.x, player.y, mission.targetX, mission.targetY));
                    progEl.innerText = activeHostiles > 0
                        ? `DEFENDERS REMAINING: ${activeHostiles}`
                        : `SECTOR CLEAR! REACH SUBSTATION (${dist}m)`;
                    if (activeHostiles === 0 && dist < 165) {
                        triggerEndScreen(true, 'POWER RESTORED', `Substation #4 is back online. G neutralized ${kills} hostiles and secured the neighborhood.`);
                    }
                }
            }

            // ============================================================================
            // VISUAL HELPERS & HUD UPDATES
            // ============================================================================
            function createBlood(x, y, angle, count = 5) {
                const fl = (mission && mission.campaign === 'mall') ? currentMallFloor : null;
                if (decals.length < 520) {
                    decals.push(new Decal(x + Math2.rand(-6, 6), y + Math2.rand(-6, 6), 'blood', Math2.rand(0, Math.PI * 2), Math2.rand(6, 13), fl));
                }
                for (let i = 0; i < count; i++) {
                    particles.push(new Particle(x, y, angle + Math2.rand(-0.9, 0.9), '#dc2626', Math2.rand(2, 4), Math2.rand(40, 150), Math2.rand(0.2, 0.4)));
                }
            }

            function createBBHit(x, y, angle) {
                if (decals.length < 520) {
                    decals.push(new Decal(x + Math2.rand(-4, 4), y + Math2.rand(-4, 4), 'bb', 0, 1));
                }
                for (let i = 0; i < 4; i++) {
                    particles.push(new Particle(x, y, angle + Math.PI + Math2.rand(-1.1, 1.1), '#ffffff', 1.8, Math2.rand(60, 150), 0.16));
                }
            }

            function isPlayerIlluminatedByEnvironment() {
                if (!player || !mission || mission.campaign !== 'mall') return false;
                for (let i = 0; i < mallLights.length; i++) {
                    const ml = mallLights[i];
                    if (ml.floor && ml.floor !== currentMallFloor) continue;
                    if (Math2.dist(player.x, player.y, ml.x, ml.y) < ml.r * 0.65) {
                        return true;
                    }
                }
                return false;
            }

            const hudHTMLCache = new WeakMap();
            const hudTextCache = new WeakMap();
            function setHudHTML(element, markup) {
                if (!element || hudHTMLCache.get(element) === markup) return;
                hudHTMLCache.set(element, markup);
                element.innerHTML = markup;
            }
            function setHudText(element, text) {
                if (!element || hudTextCache.get(element) === String(text)) return;
                hudTextCache.set(element, String(text));
                element.textContent = text;
            }
            const slotBarElement = document.getElementById('slotBar');
            slotBarElement.addEventListener('click', (event) => {
                const slot = event.target.closest('.wep-slot[data-index]');
                if (!slot || !slotBarElement.contains(slot)) return;
                if (gameState === 'playing' && player && !player.vehicle) {
                    const index = Number(slot.dataset.index);
                    if (WEAPONS[index]?.unlocked) player.switchWeapon(index);
                }
            });

            function renderAmmoVisuals(wep) {
                const roundsLabel = document.getElementById('magRoundsLabel');
                const roundsGrid = document.getElementById('magRoundsGrid');
                const magLabel = document.getElementById('magCountLabel');
                const magIcons = document.getElementById('magCountIcons');
                if (!roundsLabel || !roundsGrid || !magLabel || !magIcons) return;

                if (!wep || wep.type === 'melee') {
                    setHudText(roundsLabel, 'MELEE BLADE // READY');
                    setHudHTML(roundsGrid, '');
                    setHudText(magLabel, 'NO MAGAZINE');
                    setHudHTML(magIcons, '');
                    return;
                }

                const unitLabel = wep.isAirsoft ? 'BBs' : (wep.type === 'flame' ? 'FUEL' : 'ROUNDS');
                setHudText(roundsLabel, `${unitLabel} IN MAG (${wep.mag} / ${wep.magMax})`);

                const maxPips = wep.type === 'flame' ? 25 : wep.magMax;
                const filledPips = wep.type === 'flame'
                    ? Math.ceil((wep.mag / wep.magMax) * maxPips)
                    : wep.mag;
                const isCompact = maxPips > 20;

                let pipsHtml = '';
                for (let i = 0; i < maxPips; i++) {
                    const isLoaded = i < filledPips;
                    let cls = 'round-pip';
                    if (isCompact) cls += ' compact';
                    if (isLoaded) {
                        cls += ' loaded';
                        if (wep.isAirsoft) cls += ' bb-pellet';
                        else if (wep.type === 'flame') cls += ' flame-cell';
                        else if (wep.id === 'glock26' && wep.ammoLoad === 'jhp') cls += ' jhp-tip';
                        else if (wep.pierce) cls += ' ap-tip';
                    }
                    pipsHtml += `<div class="${cls}"></div>`;
                }
                setHudHTML(roundsGrid, pipsHtml);

                const spareMags = wep.magMax > 0 ? Math.ceil(wep.reserve / wep.magMax) : 0;
                const magNoun = wep.type === 'flame' ? 'SPARE TANKS' : 'SPARE MAGS';
                setHudText(magLabel, `${magNoun} (${spareMags})`);

                if (spareMags <= 0) {
                    setHudHTML(magIcons, `<span class="mag-empty-text">EMPTY</span>`);
                } else {
                    const isPink = (wep.id === 'glock26' || wep.id === 'airsoft_pistol');
                    const isBB = Boolean(wep.isAirsoft);
                    const isFuel = (wep.type === 'flame');
                    const showCount = Math.min(spareMags, 8);
                    let magsHtml = '';
                    for (let m = 0; m < showCount; m++) {
                        const isLastPartial = (m === spareMags - 1) && (wep.reserve % wep.magMax !== 0);
                        let mCls = 'mag-icon';
                        if (isPink) mCls += ' pink-mag';
                        if (isBB) mCls += ' bb-mag';
                        if (isFuel) mCls += ' fuel-can';
                        if (isLastPartial) mCls += ' partial';
                        magsHtml += `<div class="${mCls}"></div>`;
                    }
                    if (spareMags > 8) {
                        magsHtml += `<span style="font-family:ui-monospace,monospace;font-size:10px;font-weight:800;color:#cbd5e1;margin-left:2px;">+${spareMags - 8}</span>`;
                    }
                    setHudHTML(magIcons, magsHtml);
                }
            }

            function updateHUD() {
                if (!player) return;
                const isTraining = (mission && mission.campaign === 'training');
                const isMall = (mission && mission.campaign === 'mall');
                document.getElementById('hpLabelText').innerText = isTraining ? 'HIT POINTS' : 'HEALTH';
                document.getElementById('armorLabelText').innerText = isTraining ? 'VEST PAD' : 'ARMOR';

                document.getElementById('hpVal').innerText = Math.ceil(player.hp);
                document.getElementById('hpBar').style.width = `${(player.hp / player.maxHp) * 100}%`;

                document.getElementById('armorVal').innerText = Math.ceil(player.armor);
                document.getElementById('armorBar').style.width = `${player.armor}%`;

                document.getElementById('stamVal').innerText = Math.ceil(player.stamina);
                document.getElementById('stamBar').style.width = `${player.stamina}%`;

                const floorEl = document.getElementById('floorIndicator');
                if (floorEl) {
                    floorEl.style.display = isMall ? 'block' : 'none';
                    if (isMall) floorEl.innerText = MALL_FLOOR_TITLES[currentMallFloor] || `FLOOR: ${currentMallFloor}`;
                }

                const stanceEl = document.getElementById('stanceStatus');
                if (stanceEl) {
                    if (player.vehicle) {
                        stanceEl.innerText = 'STANCE: DRIVING VEHICLE';
                        stanceEl.classList.remove('sneaking');
                    } else if (player.isSneaking) {
                        stanceEl.innerText = 'STANCE [C]: SNEAK / CROUCH (SILENT)';
                        stanceEl.classList.add('sneaking');
                    } else {
                        stanceEl.innerText = 'STANCE [C]: RUN (NORMAL)';
                        stanceEl.classList.remove('sneaking');
                    }
                }

                const stealthEl = document.getElementById('stealthStatus');
                if (stealthEl) {
                    if (!isMall) {
                        stealthEl.innerText = isTraining ? 'MODE: 6mm AIRSOFT SKIRMISH' : 'VISIBILITY: DAYLIGHT / URBAN';
                        stealthEl.style.color = isTraining ? '#4ade80' : '#94a3b8';
                    } else if (player.lightMode === 'strobe') {
                        stealthEl.innerText = 'LIGHT [T]: TACTICAL STROBE (EXPOSED)';
                        stealthEl.style.color = '#e0f2fe';
                    } else if (player.lightMode === 'beam') {
                        stealthEl.innerText = 'LIGHT [F]: BEAM ON (HIGH VISIBILITY)';
                        stealthEl.style.color = '#fde047';
                    } else if (isPlayerIlluminatedByEnvironment()) {
                        stealthEl.innerText = 'SIGNATURE: EMERGENCY LANTERN';
                        stealthEl.style.color = '#fb923c';
                    } else if (player.isSneaking) {
                        stealthEl.innerText = 'SIGNATURE: DEEP SHADOW CROUCH';
                        stealthEl.style.color = '#4ade80';
                    } else {
                        stealthEl.innerText = 'SIGNATURE: SHADOW CONCEALED';
                        stealthEl.style.color = '#38bdf8';
                    }
                }

                const opticsEl = document.getElementById('opticsStatus');
                if (opticsEl) {
                    if (!player.hasGoBag) {
                        opticsEl.innerText = 'OPTICS [V]: LOCKED IN B1 CAR BOOT';
                        opticsEl.style.color = '#f87171';
                    } else {
                        const cellPct = Math.round(player.opticCharge);
                        const mahLeft = Math.round(player.powerBankMah);
                        if (player.opticsMode === 'nvg') {
                            opticsEl.innerText = `OPTICS [V]: NVG + IR (${cellPct}% | ${mahLeft}mAh)`;
                            opticsEl.style.color = '#4ade80';
                        } else if (player.opticsMode === 'thermal') {
                            opticsEl.innerText = `OPTICS [V]: THERMAL (${cellPct}% | ${mahLeft}mAh)`;
                            opticsEl.style.color = '#fb923c';
                        } else {
                            opticsEl.innerText = `OPTICS [V]: OFF (${cellPct}% | ${mahLeft}mAh)`;
                            opticsEl.style.color = '#94a3b8';
                        }
                    }
                }

                const loadToggleEl = document.getElementById('ammoTypeToggle');
                const activeWep = WEAPONS[player.weaponIdx];
                if (loadToggleEl) {
                    if (!player.vehicle && activeWep && activeWep.id === 'glock26') {
                        loadToggleEl.style.display = 'inline-block';
                        if (activeWep.ammoLoad === 'jhp') {
                            loadToggleEl.innerText = `LOAD: 120GR (+P) JHP [${activeWep.jhpReserve}] [B]`;
                            loadToggleEl.classList.add('jhp-active');
                        } else {
                            loadToggleEl.innerText = `LOAD: 100GR FMJ [${activeWep.fmjReserve}] [B]`;
                            loadToggleEl.classList.remove('jhp-active');
                        }
                    } else {
                        loadToggleEl.style.display = 'none';
                    }
                }

                if (isMobileDevice) {
                    const btnVeh = document.getElementById('btnVehicle');
                    const btnSpr = document.getElementById('btnSprint');
                    const btnSnk = document.getElementById('btnSneak');
                    const btnUtil = document.getElementById('btnUtil');
                    const btnStr = document.getElementById('btnStrobe');
                    const btnOpt = document.getElementById('btnOptics');
                    if (btnVeh) btnVeh.innerText = player.vehicle ? 'EXIT' : 'USE [E]';
                    if (btnSpr) btnSpr.innerText = player.vehicle ? 'BRAKE' : 'SPRINT';
                    if (btnSnk) {
                        btnSnk.style.display = player.vehicle ? 'none' : 'flex';
                        btnSnk.innerText = player.isSneaking ? 'SNEAKING' : 'SNEAK';
                        btnSnk.classList.toggle('active', player.isSneaking);
                    }
                    if (btnUtil) {
                        btnUtil.style.display = player.vehicle ? 'none' : 'flex';
                        btnUtil.innerText = player.lightMode === 'beam' ? 'BEAM ON' : 'LIGHT [F]';
                        btnUtil.classList.toggle('active', player.lightMode === 'beam');
                    }
                    if (btnStr) {
                        btnStr.style.display = player.vehicle ? 'none' : 'flex';
                        btnStr.innerText = player.lightMode === 'strobe' ? 'STROBE!' : 'STROBE';
                        btnStr.classList.toggle('strobe-active', player.lightMode === 'strobe');
                    }
                    if (btnOpt) {
                        btnOpt.style.display = player.vehicle ? 'none' : 'flex';
                        btnOpt.classList.remove('optics-nvg', 'optics-thermal');
                        if (!player.hasGoBag) {
                            btnOpt.innerText = 'NO OPTIC';
                        } else if (player.opticsMode === 'nvg') {
                            btnOpt.innerText = `NVG ${Math.round(player.opticCharge)}%`;
                            btnOpt.classList.add('optics-nvg');
                        } else if (player.opticsMode === 'thermal') {
                            btnOpt.innerText = `FLIR ${Math.round(player.opticCharge)}%`;
                            btnOpt.classList.add('optics-thermal');
                        } else {
                            btnOpt.innerText = `OPT ${Math.round(player.opticCharge)}%`;
                        }
                    }
                }

                const wep = WEAPONS[player.weaponIdx];
                if (player.vehicle) {
                    document.getElementById('wepName').innerText = `${player.vehicle.type.toUpperCase()} (ARMORED RAM)`;
                    setHudHTML(document.getElementById('ammoDisplay'), `${Math.ceil(player.vehicle.hp)} <span>CHASSIS HP</span>`);
                    document.getElementById('reloadIndicator').innerText = isMobileDevice ? 'TAP [EXIT] TO LEAVE VEHICLE' : 'PRESS [E] TO EXIT VEHICLE';
                    renderAmmoVisuals(null);
                    return;
                }

                document.getElementById('wepName').innerText = wep.name;
                if (wep.type === 'melee') {
                    setHudHTML(document.getElementById('ammoDisplay'), `INF <span>MELEE</span>`);
                } else {
                    setHudHTML(document.getElementById('ammoDisplay'), `${wep.mag} <span>/ ${wep.reserve}</span>`);
                }

                if (player.reloading) {
                    const pct = Math.min(100, Math.floor(((performance.now() - player.reloadStart) / wep.reloadTime) * 100));
                    document.getElementById('reloadIndicator').innerText = `SWAPPING MAG... ${pct}%`;
                } else {
                    document.getElementById('reloadIndicator').innerText = '';
                }

                renderAmmoVisuals(wep);

                let slotsMarkup = '';
                for (let i = 0; i < WEAPONS.length; i++) {
                    const w = WEAPONS[i];
                    const shortLabel = w.id === 'airsoft_pistol' ? 'G26'
                        : w.id === 'rubber_knife' ? 'KNIFE'
                        : w.id === 'airsoft_aeg' ? 'M4 AEG'
                        : w.id === 'glock26' ? 'G26'
                        : w.id === 'knife' ? '7" BLADE'
                        : w.id === 'ak47' ? 'AK47'
                        : w.id.toUpperCase();
                    const klass = 'wep-slot' + (w.unlocked ? ' unlocked' : '') + (i === player.weaponIdx ? ' active' : '');
                    slotsMarkup += `<div class="${klass}" data-index="${i}">${i + 1}:${shortLabel}</div>`;
                }
                setHudHTML(slotBarElement, slotsMarkup);
            }

            // ============================================================================
            // WORLD, LIGHTING & RADAR RENDERERS
            // ============================================================================
            function drawWoodlandEnvironment(ctx) {
                ctx.fillStyle = '#112618';
                ctx.fillRect(0, 0, WORLD_SIZE, WORLD_SIZE);

                ctx.fillStyle = '#15301e';
                for (let gx = 80; gx < WORLD_SIZE; gx += 180) {
                    for (let gy = 80; gy < WORLD_SIZE; gy += 180) {
                        if ((gx + gy) % 360 === 0) {
                            ctx.beginPath();
                            ctx.arc(gx, gy, 46, 0, Math.PI * 2);
                            ctx.fill();
                        }
                    }
                }

                if (woodlandCreek && woodlandCreek.length > 1) {
                    ctx.save();
                    ctx.lineCap = 'round';
                    ctx.lineJoin = 'round';
                    ctx.strokeStyle = '#3f2e21';
                    ctx.lineWidth = 96;
                    ctx.beginPath();
                    ctx.moveTo(woodlandCreek[0].x, woodlandCreek[0].y);
                    for (let i = 1; i < woodlandCreek.length; i++) {
                        ctx.lineTo(woodlandCreek[i].x, woodlandCreek[i].y);
                    }
                    ctx.stroke();

                    ctx.strokeStyle = '#0369a1';
                    ctx.lineWidth = 64;
                    ctx.stroke();

                    ctx.strokeStyle = 'rgba(125, 211, 252, 0.35)';
                    ctx.lineWidth = 10;
                    ctx.setLineDash([28, 24]);
                    ctx.lineDashOffset = -performance.now() * 0.03;
                    ctx.stroke();
                    ctx.restore();
                }

                ctx.strokeStyle = '#4ade80';
                ctx.lineWidth = 3;
                ctx.strokeRect(460, 1600, 3, 28);
                ctx.fillStyle = '#22c55e';
                ctx.fillRect(463, 1600, 18, 12);

                ctx.strokeStyle = '#f87171';
                ctx.lineWidth = 3;
                ctx.strokeRect(2780, 1600, 3, 28);
                ctx.fillStyle = '#ef4444';
                ctx.fillRect(2783, 1600, 18, 12);
            }

            function drawWoodlandCanopies(ctx) {
                for (let i = 0; i < woodlandTrees.length; i++) {
                    const tr = woodlandTrees[i];
                    if (tr.x + tr.canopyR < camera.x || tr.x - tr.canopyR > camera.x + canvas.width ||
                        tr.y + tr.canopyR < camera.y || tr.y - tr.canopyR > camera.y + canvas.height) {
                        continue;
                    }

                    ctx.fillStyle = 'rgba(0, 0, 0, 0.34)';
                    ctx.beginPath();
                    ctx.arc(tr.x + 8, tr.y + 10, tr.canopyR * 0.92, 0, Math.PI * 2);
                    ctx.fill();

                    ctx.fillStyle = '#451a03';
                    ctx.beginPath();
                    ctx.arc(tr.x, tr.y, tr.trunkR, 0, Math.PI * 2);
                    ctx.fill();

                    ctx.fillStyle = tr.shade;
                    ctx.beginPath();
                    ctx.arc(tr.x, tr.y, tr.canopyR, 0, Math.PI * 2);
                    ctx.fill();

                    ctx.fillStyle = 'rgba(74, 222, 128, 0.14)';
                    ctx.beginPath();
                    ctx.arc(tr.x - tr.canopyR * 0.22, tr.y - tr.canopyR * 0.22, tr.canopyR * 0.58, 0, Math.PI * 2);
                    ctx.fill();
                }
            }

            function drawWorld(ctx) {
                const isMall = (mission && mission.campaign === 'mall');
                const isTraining = (mission && mission.campaign === 'training');

                if (isTraining) {
                    drawWoodlandEnvironment(ctx);
                } else {
                    ctx.fillStyle = isMall ? '#0b0f17' : '#181c24';
                    ctx.fillRect(0, 0, WORLD_SIZE, WORLD_SIZE);
                }

                if (!isMall && !isTraining) {
                    ctx.strokeStyle = 'rgba(255, 255, 255, 0.025)';
                    ctx.lineWidth = 1;
                    const gridStep = 100;
                    const startX = Math.floor(camera.x / gridStep) * gridStep;
                    const startY = Math.floor(camera.y / gridStep) * gridStep;
                    for (let x = startX; x < camera.x + canvas.width + gridStep; x += gridStep) {
                        ctx.beginPath(); ctx.moveTo(x, camera.y); ctx.lineTo(x, camera.y + canvas.height); ctx.stroke();
                    }
                    for (let y = startY; y < camera.y + canvas.height + gridStep; y += gridStep) {
                        ctx.beginPath(); ctx.moveTo(camera.x, y); ctx.lineTo(camera.x + canvas.width, y); ctx.stroke();
                    }
                }

                // Indoor Mall Zones (Using Pre-Cached Tile Pattern)
                SpriteAtlas.init();
                for (let i = 0; i < mallZones.length; i++) {
                    const mz = mallZones[i];
                    if (i === 0 && SpriteAtlas.tilePatterns.mall) {
                        ctx.fillStyle = currentMallFloor === 'B1' ? SpriteAtlas.tilePatterns.parkade : SpriteAtlas.tilePatterns.mall;
                    } else {
                        ctx.fillStyle = mz.floor;
                    }
                    ctx.fillRect(mz.x, mz.y, mz.w, mz.h);
                    ctx.strokeStyle = 'rgba(148, 163, 184, 0.14)';
                    ctx.lineWidth = 2;
                    ctx.strokeRect(mz.x, mz.y, mz.w, mz.h);
                    if (mz.label) {
                        ctx.fillStyle = 'rgba(148, 163, 184, 0.18)';
                        ctx.font = '900 17px ui-monospace, monospace';
                        ctx.textAlign = 'center';
                        ctx.fillText(mz.label, mz.x + mz.w / 2, mz.y + 38);
                    }
                }

                if (isMall) {
                    for (let i = 0; i < stairwells.length; i++) {
                        const st = stairwells[i];
                        if (st.fromFloor !== currentMallFloor) continue;
                        ctx.save();
                        ctx.fillStyle = st.blocked ? 'rgba(239, 68, 68, 0.16)' : 'rgba(56, 189, 248, 0.16)';
                        ctx.strokeStyle = st.blocked ? '#ef4444' : '#38bdf8';
                        ctx.lineWidth = 2;
                        ctx.beginPath();
                        ctx.roundRect(st.x - 42, st.y - 32, 84, 64, 8);
                        ctx.fill();
                        ctx.stroke();

                        ctx.strokeStyle = st.blocked ? 'rgba(248, 113, 113, 0.55)' : 'rgba(125, 211, 252, 0.55)';
                        for (let s = -22; s <= 22; s += 11) {
                            ctx.beginPath();
                            ctx.moveTo(st.x - 30, st.y + s);
                            ctx.lineTo(st.x + 30, st.y + s);
                            ctx.stroke();
                        }

                        ctx.fillStyle = st.blocked ? '#fca5a5' : '#bae6fd';
                        ctx.font = '900 9px ui-monospace, monospace';
                        ctx.textAlign = 'center';
                        ctx.fillText(st.blocked ? 'SHUTTER BLOCKED' : `STAIRS -> ${st.toFloor}`, st.x, st.y - 38);
                        ctx.restore();
                    }

                    if (currentMallFloor === 'G') {
                        ctx.fillStyle = '#38bdf8';
                        ctx.font = '900 9.5px ui-monospace, monospace';
                        ctx.textAlign = 'center';
                        ctx.fillText('CCTV CONSOLE [E]', 2080, 1465);
                    }
                }

                for (let i = 0; i < railTracks.length; i++) {
                    const ry = railTracks[i].y;
                    ctx.fillStyle = '#292524';
                    ctx.fillRect(0, ry - 26, WORLD_SIZE, 52);

                    ctx.fillStyle = '#44403c';
                    for (let tx = 20; tx < WORLD_SIZE; tx += 36) {
                        ctx.fillRect(tx, ry - 20, 14, 40);
                    }

                    ctx.fillStyle = '#94a3b8';
                    ctx.fillRect(0, ry - 13, WORLD_SIZE, 4);
                    ctx.fillRect(0, ry + 9, WORLD_SIZE, 4);
                }

                ctx.fillStyle = '#262b36';
                for (let i = 0; i < roads.length; i++) {
                    const r = roads[i];
                    ctx.fillRect(r.x, r.y, r.w, r.h);
                }

                ctx.strokeStyle = '#eab308';
                ctx.lineWidth = 3;
                ctx.setLineDash([28, 28]);
                for (let i = 0; i < roads.length; i++) {
                    const r = roads[i];
                    ctx.beginPath();
                    if (r.dir === 'h') {
                        ctx.moveTo(r.x, r.y + r.h / 2);
                        ctx.lineTo(r.x + r.w, r.y + r.h / 2);
                    } else {
                        ctx.moveTo(r.x + r.w / 2, r.y);
                        ctx.lineTo(r.x + r.w / 2, r.y + r.h);
                    }
                    ctx.stroke();
                }
                ctx.setLineDash([]);

                ctx.fillStyle = 'rgba(248, 250, 252, 0.25)';
                for (let i = 0; i < crosswalks.length; i++) {
                    const cw = crosswalks[i];
                    if (cw.dir === 'h') {
                        for (let sx = cw.x + 8; sx < cw.x + cw.w - 8; sx += 22) {
                            ctx.fillRect(sx, cw.y, 11, cw.h);
                        }
                    } else {
                        for (let sy = cw.y + 8; sy < cw.y + cw.h - 8; sy += 22) {
                            ctx.fillRect(cw.x, sy, cw.w, 11);
                        }
                    }
                }

                if (mission && mission.targetX !== undefined && (!isMall || !mission.targetFloor || mission.targetFloor === currentMallFloor)) {
                    const pulse = 1 + Math.sin(performance.now() * 0.006) * 0.12;
                    ctx.save();
                    ctx.strokeStyle = isTraining ? 'rgba(74, 222, 128, 0.72)' : 'rgba(56, 189, 248, 0.55)';
                    ctx.lineWidth = 3;
                    ctx.beginPath();
                    ctx.arc(mission.targetX, mission.targetY, 54 * pulse, 0, Math.PI * 2);
                    ctx.stroke();
                    ctx.fillStyle = isTraining ? 'rgba(74, 222, 128, 0.14)' : 'rgba(56, 189, 248, 0.12)';
                    ctx.fill();
                    ctx.restore();
                }

                for (let i = 0; i < decals.length; i++) {
                    decals[i].draw(ctx);
                }

                for (let i = 0; i < corpses.length; i++) {
                    corpses[i].draw(ctx);
                }

                if (isMall) {
                    for (let i = 0; i < enemies.length; i++) {
                        enemies[i].drawVisionCone(ctx);
                    }
                }

                for (let i = 0; i < shells.length; i++) {
                    shells[i].draw(ctx);
                }
                for (let i = 0; i < droppedMags.length; i++) {
                    droppedMags[i].draw(ctx);
                }
                for (let i = 0; i < pickups.length; i++) {
                    pickups[i].draw(ctx);
                }
                for (let i = 0; i < vehicles.length; i++) {
                    vehicles[i].draw(ctx);
                }
                for (let i = 0; i < civilians.length; i++) {
                    civilians[i].draw(ctx);
                }
                for (let i = 0; i < allies.length; i++) {
                    allies[i].draw(ctx);
                }
                for (let i = 0; i < enemies.length; i++) {
                    enemies[i].draw(ctx);
                }

                if (player && player.hp > 0) {
                    player.draw(ctx);
                }

                for (let i = 0; i < flameJets.length; i++) {
                    flameJets[i].draw(ctx);
                }
                for (let i = 0; i < bullets.length; i++) {
                    bullets[i].draw(ctx);
                }
                for (let i = 0; i < particles.length; i++) {
                    particles[i].draw(ctx);
                }

                for (let i = 0; i < buildings.length; i++) {
                    const b = buildings[i];
                    if (b.x + b.w < camera.x - 100 || b.x > camera.x + canvas.width + 100 ||
                        b.y + b.h < camera.y - 100 || b.y > camera.y + canvas.height + 100) {
                        continue;
                    }

                    ctx.fillStyle = 'rgba(0, 0, 0, 0.52)';
                    ctx.fillRect(b.x + 12, b.y + 14, b.w, b.h);

                    ctx.fillStyle = b.color;
                    ctx.fillRect(b.x, b.y, b.w, b.h);

                    if (!b.isLowWall) {
                        const cx = camera.x + canvas.width / 2;
                        const cy = camera.y + canvas.height / 2;
                        const offX = Math2.clamp((b.x + b.w / 2 - cx) * 0.035, -16, 16);
                        const offY = Math2.clamp((b.y + b.h / 2 - cy) * 0.035, -16, 16);

                        ctx.fillStyle = b.roof;
                        ctx.fillRect(b.x + offX, b.y + offY, b.w, b.h);
                        ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
                        ctx.lineWidth = 1.5;
                        ctx.strokeRect(b.x + offX, b.y + offY, b.w, b.h);

                        if (b.label) {
                            ctx.fillStyle = 'rgba(248, 250, 252, 0.72)';
                            ctx.font = '800 13px ui-monospace, monospace';
                            ctx.textAlign = 'center';
                            ctx.fillText(b.label, b.x + b.w / 2 + offX, b.y + b.h / 2 + offY + 4);
                        }
                    } else {
                        ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)';
                        ctx.strokeRect(b.x, b.y, b.w, b.h);
                        if (b.label) {
                            ctx.fillStyle = '#fef3c7';
                            ctx.font = '900 10px ui-monospace, monospace';
                            ctx.textAlign = 'center';
                            ctx.fillText(b.label, b.x + b.w / 2, b.y + b.h / 2 + 4);
                        }
                    }
                }

                if (isTraining) {
                    drawWoodlandCanopies(ctx);
                }

                ctx.strokeStyle = '#ef4444';
                ctx.lineWidth = 6;
                ctx.strokeRect(0, 0, WORLD_SIZE, WORLD_SIZE);
            }

            function renderOpticsAndLightingOverlay() {
                if (!player) return;
                const isMall = (mission && mission.campaign === 'mall');
                const optics = player.hasGoBag ? player.opticsMode : 'normal';

                if (optics === 'nvg') {
                    ctx.save();
                    ctx.fillStyle = 'rgba(16, 185, 129, 0.26)';
                    ctx.fillRect(0, 0, canvas.width, canvas.height);

                    ctx.fillStyle = 'rgba(0, 25, 10, 0.22)';
                    for (let y = 0; y < canvas.height; y += 4) {
                        ctx.fillRect(0, y, canvas.width, 1.5);
                    }

                    const cx = canvas.width / 2;
                    const cy = canvas.height / 2;
                    const vig = ctx.createRadialGradient(cx, cy, canvas.height * 0.28, cx, cy, canvas.height * 0.65);
                    vig.addColorStop(0, 'rgba(0, 0, 0, 0)');
                    vig.addColorStop(1, 'rgba(0, 12, 5, 0.72)');
                    ctx.fillStyle = vig;
                    ctx.fillRect(0, 0, canvas.width, canvas.height);
                    ctx.restore();
                    return;
                }

                if (optics === 'thermal') {
                    ctx.save();
                    ctx.fillStyle = 'rgba(9, 13, 24, 0.76)';
                    ctx.fillRect(0, 0, canvas.width, canvas.height);

                    const drawHeatSignature = (wx, wy, radius, intensity = 1.0) => {
                        const sx = wx - camera.x;
                        const sy = wy - camera.y;
                        if (sx < -80 || sx > canvas.width + 80 || sy < -80 || sy > canvas.height + 80) return;
                        const g = ctx.createRadialGradient(sx, sy, 2, sx, sy, radius);
                        g.addColorStop(0, `rgba(255, 255, 255, ${0.96 * intensity})`);
                        g.addColorStop(0.5, `rgba(253, 186, 116, ${0.58 * intensity})`);
                        g.addColorStop(1, 'rgba(249, 115, 22, 0)');
                        ctx.fillStyle = g;
                        ctx.beginPath();
                        ctx.arc(sx, sy, radius, 0, Math.PI * 2);
                        ctx.fill();
                    };

                    if (player.hp > 0) drawHeatSignature(player.x, player.y, 26, 0.9);
                    for (let i = 0; i < enemies.length; i++) {
                        const e = enemies[i];
                        if (e.hp > 0 && (!isMall || e.floor === currentMallFloor)) {
                            drawHeatSignature(e.x, e.y, e.isBoss ? 32 : 25, 1.0);
                        }
                    }
                    for (let i = 0; i < corpses.length; i++) {
                        const cp = corpses[i];
                        if (!isMall || cp.floor === currentMallFloor) {
                            drawHeatSignature(cp.x, cp.y, 20, 0.35);
                        }
                    }
                    for (let i = 0; i < allies.length; i++) {
                        const al = allies[i];
                        if (!al.isOut) drawHeatSignature(al.x, al.y, 24, 0.9);
                    }
                    for (let i = 0; i < civilians.length; i++) {
                        const c = civilians[i];
                        if (!c.dead && (!isMall || c.floor === currentMallFloor)) {
                            drawHeatSignature(c.x, c.y, 23, 0.92);
                        }
                    }
                    for (let i = 0; i < vehicles.length; i++) {
                        const v = vehicles[i];
                        if (!v.destroyed && (!isMall || v.floor === currentMallFloor) && (v.driver || v.type === 'taxi')) {
                            drawHeatSignature(v.x, v.y, 44, 0.65);
                        }
                    }

                    ctx.strokeStyle = 'rgba(255, 255, 255, 0.16)';
                    ctx.lineWidth = 1;
                    const cx = canvas.width / 2;
                    const cy = canvas.height / 2;
                    ctx.beginPath();
                    ctx.moveTo(cx - 24, cy); ctx.lineTo(cx + 24, cy);
                    ctx.moveTo(cx, cy - 24); ctx.lineTo(cx, cy + 24);
                    ctx.stroke();

                    if (player.opticCharge < 20) {
                        ctx.fillStyle = 'rgba(239, 68, 68, 0.16)';
                        ctx.fillRect(0, 0, canvas.width, canvas.height);
                    }
                    ctx.restore();
                    return;
                }

                if (!isMall) return;

                lightCtx.globalCompositeOperation = 'source-over';
                lightCtx.fillStyle = 'rgba(3, 6, 14, 0.91)';
                lightCtx.fillRect(0, 0, lightCanvas.width, lightCanvas.height);

                lightCtx.globalCompositeOperation = 'destination-out';

                const px = player.x - camera.x;
                const py = player.y - camera.y;
                const selfGrad = lightCtx.createRadialGradient(px, py, 10, px, py, 76);
                selfGrad.addColorStop(0, 'rgba(0,0,0,0.88)');
                selfGrad.addColorStop(1, 'rgba(0,0,0,0)');
                lightCtx.fillStyle = selfGrad;
                lightCtx.beginPath();
                lightCtx.arc(px, py, 76, 0, Math.PI * 2);
                lightCtx.fill();

                if (!player.vehicle) {
                    if (player.lightMode === 'beam') {
                        const beamLen = 460;
                        const halfAngle = 0.34;
                        lightCtx.save();
                        lightCtx.translate(px, py);
                        lightCtx.rotate(player.angle);
                        const beamGrad = lightCtx.createRadialGradient(12, 0, 8, 12, 0, beamLen);
                        beamGrad.addColorStop(0, 'rgba(0,0,0,1)');
                        beamGrad.addColorStop(0.75, 'rgba(0,0,0,0.85)');
                        beamGrad.addColorStop(1, 'rgba(0,0,0,0)');
                        lightCtx.fillStyle = beamGrad;
                        lightCtx.beginPath();
                        lightCtx.moveTo(10, 0);
                        lightCtx.arc(10, 0, beamLen, -halfAngle, halfAngle);
                        lightCtx.closePath();
                        lightCtx.fill();
                        lightCtx.restore();
                    } else if (player.lightMode === 'strobe') {
                        const pulseOn = Math.sin(player.strobePhase * Math.PI * 2) > 0.15;
                        if (pulseOn) {
                            const beamLen = 380;
                            const halfAngle = 0.36;
                            lightCtx.save();
                            lightCtx.translate(px, py);
                            lightCtx.rotate(player.angle);
                            const beamGrad = lightCtx.createRadialGradient(12, 0, 8, 12, 0, beamLen);
                            beamGrad.addColorStop(0, 'rgba(0,0,0,1)');
                            beamGrad.addColorStop(0.85, 'rgba(0,0,0,0.92)');
                            beamGrad.addColorStop(1, 'rgba(0,0,0,0)');
                            lightCtx.fillStyle = beamGrad;
                            lightCtx.beginPath();
                            lightCtx.moveTo(10, 0);
                            lightCtx.arc(10, 0, beamLen, -halfAngle, halfAngle);
                            lightCtx.closePath();
                            lightCtx.fill();
                            lightCtx.restore();
                        }
                    }
                }

                for (let i = 0; i < mallLights.length; i++) {
                    const ml = mallLights[i];
                    if (ml.floor && ml.floor !== currentMallFloor) continue;
                    const flickerMod = ml.flicker ? (0.85 + Math.sin(performance.now() * 0.02 + i) * 0.15) : 1.0;
                    const r = ml.r * flickerMod;
                    const lx = ml.x - camera.x;
                    const ly = ml.y - camera.y;
                    const g = lightCtx.createRadialGradient(lx, ly, 8, lx, ly, r);
                    g.addColorStop(0, 'rgba(0,0,0,0.92)');
                    g.addColorStop(1, 'rgba(0,0,0,0)');
                    lightCtx.fillStyle = g;
                    lightCtx.beginPath();
                    lightCtx.arc(lx, ly, r, 0, Math.PI * 2);
                    lightCtx.fill();
                }

                ctx.drawImage(lightCanvas, 0, 0);

                if (player.lightMode === 'strobe' && !player.vehicle) {
                    const pulseOn = Math.sin(player.strobePhase * Math.PI * 2) > 0.15;
                    if (pulseOn) {
                        ctx.save();
                        ctx.translate(px, py);
                        ctx.rotate(player.angle);
                        const tint = ctx.createRadialGradient(12, 0, 4, 12, 0, 340);
                        tint.addColorStop(0, 'rgba(224, 242, 254, 0.34)');
                        tint.addColorStop(1, 'rgba(56, 189, 248, 0)');
                        ctx.fillStyle = tint;
                        ctx.beginPath();
                        ctx.moveTo(10, 0);
                        ctx.arc(10, 0, 340, -0.34, 0.34);
                        ctx.closePath();
                        ctx.fill();
                        ctx.restore();
                    }
                }
            }

            function drawSniperScopeOverlay(ctx) {
                if (!player || player.vehicle) return;
                const wep = WEAPONS[player.weaponIdx];
                const scoped = (wep && wep.id === 'ruger' && (mouse.rightDown || touchInput.scopeActive));
                if (!scoped) return;

                const cx = isMobileDevice ? canvas.width / 2 : mouse.x;
                const cy = isMobileDevice ? canvas.height / 2 : mouse.y;
                const radius = Math.min(canvas.width, canvas.height) * 0.34;

                ctx.save();
                ctx.fillStyle = 'rgba(4, 7, 15, 0.72)';
                ctx.beginPath();
                ctx.rect(0, 0, canvas.width, canvas.height);
                ctx.arc(cx, cy, radius, 0, Math.PI * 2, true);
                ctx.fill();

                ctx.strokeStyle = '#38bdf8';
                ctx.lineWidth = 2.5;
                ctx.beginPath();
                ctx.arc(cx, cy, radius, 0, Math.PI * 2);
                ctx.stroke();

                ctx.strokeStyle = 'rgba(239, 68, 68, 0.85)';
                ctx.lineWidth = 1.4;
                ctx.beginPath();
                ctx.moveTo(cx - radius, cy);
                ctx.lineTo(cx + radius, cy);
                ctx.moveTo(cx, cy - radius);
                ctx.lineTo(cx, cy + radius);
                ctx.stroke();

                ctx.fillStyle = '#ef4444';
                for (let d = -3; d <= 3; d++) {
                    if (d === 0) continue;
                    ctx.beginPath();
                    ctx.arc(cx + d * (radius * 0.22), cy, 2.2, 0, Math.PI * 2);
                    ctx.arc(cx, cy + d * (radius * 0.22), 2.2, 0, Math.PI * 2);
                    ctx.fill();
                }

                ctx.fillStyle = '#38bdf8';
                ctx.font = '800 11px ui-monospace, monospace';
                ctx.textAlign = 'center';
                ctx.fillText('RUGER M77 // 8X OPTIC ZEROED', cx, cy + radius - 14);
                ctx.restore();
            }

            function renderRadarTerrain() {
                const size = radarCanvas.width;
                const scale = size / WORLD_SIZE;
                const isTraining = (mission && mission.campaign === 'training');
                radarTerrainCtx.fillStyle = isTraining ? '#071a0e' : '#090d16';
                radarTerrainCtx.fillRect(0, 0, size, size);

                radarTerrainCtx.fillStyle = '#334155';
                for (let i = 0; i < roads.length; i++) {
                    const r = roads[i];
                    radarTerrainCtx.fillRect(r.x * scale, r.y * scale, Math.max(1.5, r.w * scale), Math.max(1.5, r.h * scale));
                }

                radarTerrainCtx.fillStyle = '#64748b';
                for (let i = 0; i < railTracks.length; i++) {
                    radarTerrainCtx.fillRect(0, railTracks[i].y * scale, size, 1.5);
                }

                radarTerrainCtx.fillStyle = isTraining ? '#14532d' : '#1e293b';
                for (let i = 0; i < buildings.length; i++) {
                    const b = buildings[i];
                    if (b.isLowWall) continue;
                    radarTerrainCtx.fillRect(b.x * scale, b.y * scale, Math.max(1.5, b.w * scale), Math.max(1.5, b.h * scale));
                }

                radarTerrainDirty = false;
            }

            function drawRadar() {
                const size = radarCanvas.width;
                const scale = size / WORLD_SIZE;
                const isMall = (mission && mission.campaign === 'mall');
                const isTraining = (mission && mission.campaign === 'training');

                if (radarTerrainDirty) renderRadarTerrain();
                radarCtx.drawImage(radarTerrainCanvas, 0, 0);

                if (mission && mission.targetX !== undefined && (!isMall || !mission.targetFloor || mission.targetFloor === currentMallFloor)) {
                    radarCtx.fillStyle = isTraining ? '#4ade80' : '#38bdf8';
                    radarCtx.beginPath();
                    radarCtx.arc(mission.targetX * scale, mission.targetY * scale, 4.5, 0, Math.PI * 2);
                    radarCtx.fill();
                }

                for (let i = 0; i < allies.length; i++) {
                    const al = allies[i];
                    if (al.isOut) continue;
                    radarCtx.fillStyle = '#4ade80';
                    radarCtx.beginPath();
                    radarCtx.arc(al.x * scale, al.y * scale, 3, 0, Math.PI * 2);
                    radarCtx.fill();
                }

                for (let i = 0; i < enemies.length; i++) {
                    const e = enemies[i];
                    if (e.hp <= 0 || (isMall && e.floor !== currentMallFloor)) continue;
                    const cctvOn = isMall && cctvRevealedFloors[currentMallFloor];
                    if (isMall && !cctvOn && Math2.dist(player.x, player.y, e.x, e.y) > 850) continue;
                    if (e.isUnarmed || e.panicState === 'fleeing' || e.panicState === 'wounded_retreat' || e.panicState === 'in_cover') {
                        radarCtx.fillStyle = '#fb923c';
                    } else {
                        radarCtx.fillStyle = e.isBoss ? '#f59e0b' : (e.faction === 'security' ? '#60a5fa' : '#ef4444');
                    }
                    const sz = e.isBoss ? 5 : 2.5;
                    radarCtx.fillRect(e.x * scale - sz / 2, e.y * scale - sz / 2, sz, sz);
                }

                for (let i = 0; i < vehicles.length; i++) {
                    const v = vehicles[i];
                    if (v.destroyed || (isMall && v.floor !== currentMallFloor)) continue;
                    radarCtx.fillStyle = v.isPlayerStagedCar ? '#facc15' : (v.type === 'taxi' ? '#38bdf8' : '#f8fafc');
                    radarCtx.fillRect(v.x * scale - 2, v.y * scale - 2, 4, 4);
                }

                if (player) {
                    radarCtx.fillStyle = '#4ade80';
                    radarCtx.beginPath();
                    radarCtx.arc(player.x * scale, player.y * scale, 3.5, 0, Math.PI * 2);
                    radarCtx.fill();
                }
            }

            // ============================================================================


            // Preserve the mobile control lifecycle from the complete predecessor.
            function syncMobileControlsVisibility() {
                const controls = document.getElementById('mobileControls');
                if (controls) controls.classList.toggle('hidden', !isMobileDevice || gameState !== 'playing');
            }
            function initMobileControls() { initMobileTouchControls(); }

            // Recovered rendering coordinator: source snapshot stopped before its game loop.
            function render() {
                ctx.clearRect(0, 0, canvas.width, canvas.height);
                const shakeX = camera.shake ? (Math.random() - 0.5) * camera.shake : 0;
                const shakeY = camera.shake ? (Math.random() - 0.5) * camera.shake : 0;
                ctx.save();
                ctx.translate(-camera.x + shakeX, -camera.y + shakeY);
                drawWorld(ctx);
                ctx.restore();
                renderOpticsAndLightingOverlay();
                drawSniperScopeOverlay(ctx);
                drawRadar();
            }


            function generateCBDWorld() {
                WORLD_SIZE = 4400;
                buildings = [];
                roads = [];
                crosswalks = [];
                railTracks = [];
                woodlandTrees = [];
                woodlandCreek = null;
                mallZones = [];
                mallLights = [];
                stairwells = [];
                vehicles = [];
                pickups = [];
                decals = [];
                shells = [];
                droppedMags = [];
                bullets = [];
                flameJets = [];
                particles = [];
                enemies = [];
                allies = [];
                civilians = [];

                const avenues = [420, 1140, 1850, 2560, 3270, 3980];
                for (let i = 0; i < avenues.length; i++) {
                    const c = avenues[i];
                    roads.push({ x: 0, y: c - 62, w: WORLD_SIZE, h: 124, dir: 'h' });
                    roads.push({ x: c - 62, y: 0, w: 124, h: WORLD_SIZE, dir: 'v' });
                }

                for (let ix = 0; ix < avenues.length; ix++) {
                    for (let iy = 0; iy < avenues.length; iy++) {
                        const cx = avenues[ix];
                        const cy = avenues[iy];
                        crosswalks.push({ x: cx - 44, y: cy - 78, dir: 'h' });
                        crosswalks.push({ x: cx - 44, y: cy + 66, dir: 'h' });
                        crosswalks.push({ x: cx - 78, y: cy - 44, dir: 'v' });
                        crosswalks.push({ x: cx + 66, y: cy - 44, dir: 'v' });
                    }
                }

                buildings.push({ x: 1620, y: 2660, w: 460, h: 210, color: '#1e293b', roof: '#334155', height: 22, roofProp: 'skylight', label: 'BREE ST TAXI RANK' });
                pickups.push(new Pickup(1810, 2910, 'fuel'));
                pickups.push(new Pickup(1890, 2910, 'health'));
                vehicles.push(new Vehicle(1720, 2950, 0, 'taxi'));
                vehicles.push(new Vehicle(1980, 2950, Math.PI, 'taxi'));

                buildings.push({ x: 2670, y: 1960, w: 480, h: 480, color: '#1f2937', roof: '#374151', height: 30, roofProp: 'skylight', label: 'CENTRAL ARCADE PLAZA' });
                pickups.push(new Pickup(2910, 2490, 'shotgun'));
                pickups.push(new Pickup(2850, 2490, 'fuel'));
                pickups.push(new Pickup(2970, 2490, 'armor'));

                buildings.push({ x: 2670, y: 540, w: 480, h: 480, color: '#172554', roof: '#1e3a8a', height: 34, roofProp: 'helipad', label: 'RESERVE BANK PRECINCT' });
                pickups.push(new Pickup(2910, 1070, 'ar15'));
                pickups.push(new Pickup(2840, 1070, 'fuel'));
                pickups.push(new Pickup(2980, 1070, 'health'));
                vehicles.push(new Vehicle(3235, 820, Math.PI / 2, 'nyala'));

                buildings.push({ x: 540, y: 540, w: 480, h: 480, color: '#451a03', roof: '#78350f', height: 42, roofProp: 'helipad', label: 'CARLTON TOWER PLAZA' });
                pickups.push(new Pickup(710, 1070, 'fuel'));
                pickups.push(new Pickup(850, 1070, 'armor'));

                const cbdWall = ['#1e293b', '#27272a', '#172554', '#292524', '#1f2937'];
                const cbdRoof = ['#334155', '#3f3f46', '#1e3a8a', '#44403c', '#374151'];
                const props = ['hvac', 'helipad', 'skylight', 'hvac'];
                const landmarkCells = new Set(['2,3', '3,2', '3,0', '0,0']);

                for (let gx = 0; gx < 5; gx++) {
                    for (let gy = 0; gy < 5; gy++) {
                        if (landmarkCells.has(`${gx},${gy}`)) continue;
                        const bx = avenues[gx] + 85;
                        const by = avenues[gy] + 85;
                        const bw = 540;
                        const bh = 540;
                        const hash = gx * 7 + gy * 3;

                        if (hash % 3 === 0) {
                            buildings.push({
                                x: bx,
                                y: by,
                                w: bw,
                                h: bh,
                                color: cbdWall[hash % cbdWall.length],
                                roof: cbdRoof[hash % cbdRoof.length],
                                height: 32 + (hash % 3) * 6,
                                roofProp: props[hash % props.length]
                            });
                        } else {
                            const subW = 248;
                            const subH = 248;
                            const offsets = [
                                [0, 0],
                                [bw - subW, 0],
                                [0, bh - subH],
                                [bw - subW, bh - subH]
                            ];
                            for (let s = 0; s < 4; s++) {
                                const cIdx = (hash + s) % cbdWall.length;
                                buildings.push({
                                    x: bx + offsets[s][0],
                                    y: by + offsets[s][1],
                                    w: subW,
                                    h: subH,
                                    color: cbdWall[cIdx],
                                    roof: cbdRoof[cIdx],
                                    height: 24 + ((hash + s) % 4) * 5,
                                    roofProp: props[(hash + s) % props.length]
                                });
                            }
                        }
                    }
                }

                vehicles.push(new Vehicle(2595, 2150, -Math.PI / 2, 'taxi'));
                vehicles.push(new Vehicle(1520, 1815, 0, 'taxi'));
                vehicles.push(new Vehicle(1175, 1480, Math.PI / 2, 'hatchback'));
                vehicles.push(new Vehicle(2180, 1175, Math.PI, 'bakkie'));
                vehicles.push(new Vehicle(3305, 2240, -Math.PI / 2, 'taxi'));

                for (let i = 0; i < 22; i++) {
                    let px = 0;
                    let py = 0;
                    do {
                        px = Math2.rand(200, WORLD_SIZE - 200);
                        py = Math2.rand(200, WORLD_SIZE - 200);
                    } while (pointInsideBuilding(px, py, 24));
                    const pType = i % 4 === 0 ? 'fuel' : (i % 4 === 1 ? 'health' : (i % 4 === 2 ? 'ammo' : 'armor'));
                    pickups.push(new Pickup(px, py, pType));
                }
            }


            function triggerGameOver(victory) {
                if (gameState !== 'playing') return;
                gameState = victory ? 'victory' : 'dead';
                syncMobileControlsVisibility();
                const endOverlay = document.getElementById('endOverlay');
                const endCard = document.getElementById('endCard');
                const endKicker = document.getElementById('endKicker');
                const endTitle = document.getElementById('endTitle');
                const endBody = document.getElementById('endBody');

                endOverlay.classList.remove('hidden');
                const camp = mission ? mission.campaign : 'training';
                if (victory) {
                    endCard.style.borderTopColor = '#22c55e';
                    endKicker.style.color = '#22c55e';
                    if (camp === 'training') {
                        endKicker.innerText = 'PINE RIDGE WOODLAND // YOUTH SQUAD VICTORY';
                        endTitle.innerText = 'FLAG CAPTURED!';
                        endBody.innerText = `Younger C, Younger G, and Younger Blaze outflanked the grown-up MilSim squad through the pine woods, tagged out ${kills} adult players, and captured their HQ flag!`;
                    } else if (camp === 'mall') {
                        endKicker.innerText = 'SANDTON MALL // EXFIL CHECKPOINT REACHED';
                        endTitle.innerText = 'ESCAPED THE BLOCKADE';
                        endBody.innerText = `Descending from Golden Dragon (L1) down to B1 to gear up in your MOLLE rig and thermal monocular, then ascending via the North Service Stairwell to the L2 Skybridge, C broke the Kalashnikov taxi blockade, looted R${cashCollected.toLocaleString()}, and neutralized ${kills} hostiles.`;
                    } else if (camp === 'sniper') {
                        endKicker.innerText = 'INDUSTRIAL RAIL & MINE DUMPS // SECURED';
                        endTitle.innerText = 'OVERWATCH COMPLETE';
                        endBody.innerText = `With precision Ruger M77 bolt-action fire, you cleared the rail yard, eliminated the Arms Broker, and neutralized ${kills} hostiles.`;
                    } else if (camp === 'cbd') {
                        endKicker.innerText = 'JOHANNESBURG CBD // LIBERATED';
                        endTitle.innerText = 'ASHES & VICTORY';
                        endBody.innerText = `You burned through the Syndicate roadblocks, cleared Carlton Tower Plaza, and neutralized ${kills} hostiles across downtown Johannesburg.`;
                    } else {
                        endKicker.innerText = 'DISTRICT SECURED // POWER RESTORED';
                        endTitle.innerText = 'SURVIVED THE AFTERMATH';
                        endBody.innerText = `G cleared Substation #4 with his Vektor LM4, neutralized ${kills} hostiles, and brought the neighborhood grid back online.`;
                    }
                } else {
                    if (camp === 'training') {
                        endCard.style.borderTopColor = '#f59e0b';
                        endKicker.style.color = '#f59e0b';
                        endKicker.innerText = 'AIRSOFT TRAINING // HIT CALLED';
                        endTitle.innerText = 'TAGGED OUT!';
                        endBody.innerText = `You took a 6mm BB hit and raised your orange dead rag! You tagged out ${kills} grown-up players alongside Younger G and Younger Blaze before walking back to staging.`;
                    } else {
                        endCard.style.borderTopColor = '#ef4444';
                        endKicker.style.color = '#ef4444';
                        endKicker.innerText = camp === 'mall'
                            ? 'KIA // SHOPPING MALL SECTOR'
                            : (camp === 'sniper' ? 'KIA // INDUSTRIAL SECTOR' : (camp === 'cbd' ? 'KIA // DOWNTOWN CBD SECTOR' : 'KIA // SUBURBAN SECTOR'));
                        endTitle.innerText = 'FLATLINED';
                        endBody.innerText = `Gunfire in the aftermath is unforgiving. Hostiles neutralized before going down: ${kills}.`;
                    }
                }
            }

            function gameLoop(timestamp) {
                const dt = Math.min(0.05, (timestamp - lastTime) / 1000 || 0.016);
                lastTime = timestamp;

                if (gameState === 'playing' && player) {
                    mouse.worldX = mouse.x + camera.x;
                    mouse.worldY = mouse.y + camera.y;

                    player.update(dt);

                    for (let i = 0; i < vehicles.length; i++) {
                        vehicles[i].update(dt);
                    }

                    for (let i = 0; i < civilians.length; i++) {
                        civilians[i].update(dt);
                    }

                    for (let i = 0; i < allies.length; i++) {
                        allies[i].update(dt);
                    }

                    for (let i = 0; i < enemies.length; i++) {
                        enemies[i].update(dt);
                    }

                    for (let i = 0; i < bullets.length; i++) {
                        bullets[i].update(dt);
                    }
                    for (let i = bullets.length - 1; i >= 0; i--) {
                        if (!bullets[i].active) bullets.splice(i, 1);
                    }

                    for (let i = flameJets.length - 1; i >= 0; i--) {
                        flameJets[i].update(dt);
                        if (!flameJets[i].active) flameJets.splice(i, 1);
                    }

                    for (let i = 0; i < shells.length; i++) {
                        shells[i].update(dt);
                    }
                    if (shells.length > 260) shells.splice(0, shells.length - 260);

                    for (let i = 0; i < droppedMags.length; i++) {
                        droppedMags[i].update(dt);
                    }
                    if (droppedMags.length > 120) droppedMags.splice(0, droppedMags.length - 120);

                    for (let i = 0; i < particles.length - 1; i++) {
                        particles[i].update(dt);
                    }
                    for (let i = particles.length - 1; i >= 0; i--) {
                        if (particles[i].life <= 0) particles.splice(i, 1);
                    }

                    for (let i = 0; i < pickups.length; i++) {
                        pickups[i].update(dt);
                    }

                    const wep = WEAPONS[player.weaponIdx];
                    let lookAhead = 0;
                    if (!player.vehicle && wep && wep.id === 'ruger') {
                        lookAhead = (mouse.rightDown || touchInput.scopeActive) ? 380 : 190;
                    }
                    const aimOffsetX = Math.cos(player.angle) * lookAhead;
                    const aimOffsetY = Math.sin(player.angle) * lookAhead;

                    const targetCamX = Math2.clamp(player.x + aimOffsetX - canvas.width / 2, 0, Math.max(0, WORLD_SIZE - canvas.width));
                    const targetCamY = Math2.clamp(player.y + aimOffsetY - canvas.height / 2, 0, Math.max(0, WORLD_SIZE - canvas.height));
                    camera.x += (targetCamX - camera.x) * Math.min(1, dt * 8);
                    camera.y += (targetCamY - camera.y) * Math.min(1, dt * 8);
                    camera.shake *= Math.pow(0.01, dt);

                    updateMissionDirector();
                    updateHUD();
                }

                render();
                eKeyJustPressed = false;
                mouse.justClicked = false;
                touchInput.justFired = false;
                requestAnimationFrame(gameLoop);
            }

            // ============================================================================
            // START & RESTART HANDLERS
            // ============================================================================
            function selectCampaign(camp) {
                selectedCampaign = camp;
                document.getElementById('campTrainingBtn').classList.toggle('selected', camp === 'training');
                document.getElementById('campMallBtn').classList.toggle('selected', camp === 'mall');
                document.getElementById('campCbdBtn').classList.toggle('selected', camp === 'cbd');
                document.getElementById('campSuburbsBtn').classList.toggle('selected', camp === 'suburbs');
                document.getElementById('campSniperBtn').classList.toggle('selected', camp === 'sniper');

                const kicker = document.getElementById('menuKicker');
                const body = document.getElementById('menuBody');
                if (camp === 'training') {
                    kicker.innerText = 'WOODLAND AIRSOFT ARENA // YOUTH SQUAD TRAINING';
                    body.innerHTML = 'Years before the grid went dark—a Sunday morning airsoft skirmish in a dense pine woodland. Play as <strong>Younger C</strong> alongside <strong>Younger G</strong> and <strong>Younger Blaze</strong> in a 3-player youth squad facing off against an entrenched team of <strong>grown-up MilSim adults</strong>. Use forest cover, coordinate with your teammates, and capture the adults\' base flag!';
                } else if (camp === 'mall') {
                    kicker.innerText = 'SANDTON-SCALE 4-FLOOR MALL // 07:00 AM POWER OUTAGE';
                    body.innerHTML = '07:00 AM — two hours after impact. Having arrived before dawn to help Mr. Chen evacuate stock from <strong>Golden Dragon (Level 1)</strong>, <strong>C</strong> starts in rolled-up olive-check flannel and denims with her concealed <strong>pink Glock 26</strong>. Descend to <strong>Ground [G]</strong> and <strong>B1 Underground Parkade</strong> to recover your <strong>Go-Bag, MOLLE vest, and battery-limited Thermal/NVG optics + 10,000 mAh power bank</strong> from your car boot, then take an alternate stairwell up to the <strong>L2 Skybridge</strong>!';
                } else if (camp === 'sniper') {
                    kicker.innerText = 'GAUTENG INDUSTRIAL BELT // SNIPER OVERWATCH';
                    body.innerHTML = '<strong>The Uncle</strong> takes position on the elevated Signal Overwatch above the freight rail yard. Armed with a high-caliber <strong>Ruger M77 Bolt-Action</strong> rifle and a <strong>Glock 17</strong>, hold <strong>Right-Click</strong> to pan your scope downrange, punch armor-piercing rounds through Syndicate lookouts, and eliminate the Arms Broker atop the Mine Dump Citadel.';
                } else if (camp === 'cbd') {
                    kicker.innerText = 'JOHANNESBURG CBD // INNER-CITY AFTERMATH';
                    body.innerHTML = 'Smoke hangs thick between the concrete towers of downtown Johannesburg. Stepping out near the Bree Street Taxi Rank with a custom <strong>Portable Flamethrower</strong> strapped to her back and a <strong>Glock 17</strong> on her hip, <strong>Blaze</strong> must burn through Syndicate roadblocks, scavenge fuel canisters, and take down the kingpin holding Carlton Plaza.';
                } else {
                    kicker.innerText = 'JOHANNESBURG SUBURBS // +48 HOURS POST-IMPACT';
                    body.innerHTML = 'The grid went dark forty-eight hours ago. Stepping out of his walled suburban compound with a <strong>Vektor LM4</strong> rifle, a <strong>Glock 17</strong>, and a panga, <strong>G</strong> must scavenge heavy hardware, survive turf clashes between Syndicate crews, attack dogs, and Private Security units, and restore power at Substation #4.';
                }
            }

            document.getElementById('campTrainingBtn').addEventListener('click', () => selectCampaign('training'));
            document.getElementById('campMallBtn').addEventListener('click', () => selectCampaign('mall'));
            document.getElementById('campCbdBtn').addEventListener('click', () => selectCampaign('cbd'));
            document.getElementById('campSuburbsBtn').addEventListener('click', () => selectCampaign('suburbs'));
            document.getElementById('campSniperBtn').addEventListener('click', () => selectCampaign('sniper'));

            function startGame() {
                titleMenu.rememberChapter(selectedCampaign);
                sfx.musicEnabled = titleMenu.musicOnStart();
                sfx.init();
                sfx.configureGenreForCampaign(selectedCampaign);
                WEAPONS = createWeapons(selectedCampaign);
                kills = 0;
                cashCollected = 0;
                document.getElementById('killCounter').innerText = selectedCampaign === 'training'
                    ? 'ADULTS TAGGED OUT: 0'
                    : 'HOSTILES NEUTRALIZED: 0';
                const cashEl = document.getElementById('cashCounter');
                if (cashEl) {
                    cashEl.style.display = selectedCampaign === 'mall' ? 'block' : 'none';
                    cashEl.innerText = 'CASH LOOTED: R0';
                }

                if (selectedCampaign === 'training') {
                    generateWoodlandWorld();
                    player = new Player(760, 3260, 'young_c');
                    updatePortraitSVG('young_c');
                    initTrainingMissions();
                } else if (selectedCampaign === 'mall') {
                    generateMallWorld();
                    player = new Player(520, 1680, 'mall');
                    updatePortraitSVG('mall');
                    initMallMissions();
                } else if (selectedCampaign === 'sniper') {
                    generateSniperWorld();
                    player = new Player(920, 2660, 'sniper');
                    updatePortraitSVG('sniper');
                    initSniperMissions();
                } else if (selectedCampaign === 'cbd') {
                    generateCBDWorld();
                    player = new Player(1850, 2930, 'female');
                    updatePortraitSVG('female');
                    initCbdMissions();
                } else {
                    generateSuburbsWorld();
                    player = new Player(1950, 1980, 'male');
                    updatePortraitSVG('male');
                    initSuburbsMissions();
                }

                camera.x = Math2.clamp(player.x - canvas.width / 2, 0, Math.max(0, WORLD_SIZE - canvas.width));
                camera.y = Math2.clamp(player.y - canvas.height / 2, 0, Math.max(0, WORLD_SIZE - canvas.height));
                camera.shake = 0;

                document.getElementById('startOverlay').classList.add('hidden');
                document.getElementById('endOverlay').classList.add('hidden');
                document.getElementById('monologueToast').classList.remove('visible');

                if (gameState !== 'cutscene') {
                    gameState = 'playing';
                }
                syncMobileControlsVisibility();
                updateHUD();
            }


            const titleMenu = setupTitleScreen({
                start: () => {
                    selectCampaign('training');
                    document.getElementById('startOverlay').classList.remove('hidden');
                },
                continueChapter: (chapter) => {
                    selectCampaign(chapter);
                    document.getElementById('startOverlay').classList.remove('hidden');
                }
            });
            document.getElementById('startBtn').addEventListener('click', startGame);
            document.getElementById('restartBtn').addEventListener('click', () => {
                phoneCutscene.close();
                document.getElementById('endOverlay').classList.add('hidden');
                document.getElementById('startOverlay').classList.remove('hidden');
                document.getElementById('phoneToast').classList.remove('visible');
                document.getElementById('monologueToast').classList.remove('visible');
                gameState = 'menu';
                syncMobileControlsVisibility();
            });


            detectPlatform();
            initMobileControls();
            generateWoodlandWorld();
            updatePortraitSVG('young_c');
            camera.x = 550;
            camera.y = 2750;
            requestAnimationFrame(gameLoop);
        })();
