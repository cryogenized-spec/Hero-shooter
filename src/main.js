import { setupTitleScreen } from './ui/title-screen.js';
import { Math2 } from './core/math.js';
import { createWeapons } from './data/weapons.js';
import { getPortraitSVG } from './ui/portraits.js';
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

            // Offscreen lighting canvas for indoor darkness & flashlight/strobe cone
            const lightCanvas = document.createElement('canvas');
            const lightCtx = lightCanvas.getContext('2d');

            const WORLD_SIZE = 4400;

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
                onPortraitUpdate: (archetype) => updatePortraitSVG(archetype),
                onBanner: (label, duration) => showBanner(label, duration)
            });

            // ============================================================================
            // WEAPON DEFINITIONS PER CAMPAIGN
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
            let gameState = 'menu'; // 'menu' | 'playing' | 'cutscene' | 'dead' | 'victory'
            let kills = 0;
            let cashCollected = 0;
            let bannerTimer = null;
            let phoneTimer = null;

            let player = null;
            let buildings = [];
            let roads = [];
            let crosswalks = [];
            let railTracks = [];
            let woodlandTrees = [];
            let woodlandCreek = null;
            let mallZones = [];
            let mallLights = [];
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
            let pickups = [];
            let mission = null;

            // ============================================================================
            // INLINE SVG PORTRAIT GENERATOR (EARBUDS APPEAR ONLY WHEN IPODS ARE ON!)
            // ============================================================================
            function updatePortraitSVG(archetype) {
                const portraitEl = document.getElementById('portrait');
                if (portraitEl) portraitEl.innerHTML = getPortraitSVG(archetype, sfx.musicEnabled);
            }

            function populateStartCardAvatars() {
                const map = {
                    avatarTraining: 'young_yael',
                    avatarMall: 'mall',
                    avatarCbd: 'female',
                    avatarSuburbs: 'male',
                    avatarSniper: 'sniper'
                };
                Object.keys(map).forEach((id) => {
                    const el = document.getElementById(id);
                    if (el) el.innerHTML = getPortraitSVG(map[id], false);
                });
            }

            // ============================================================================
            // SMARTPHONE COMMS & CHECKPOINT MESSENGER CUTSCENE ENGINE
            // ============================================================================
            function showBanner(text, duration = 2000) {
                const banner = document.getElementById('promptBanner');
                banner.innerText = text;
                banner.classList.add('visible');
                if (bannerTimer) clearTimeout(bannerTimer);
                bannerTimer = setTimeout(() => {
                    banner.classList.remove('visible');
                }, duration);
            }

            function showPhoneMessage(sender, timeStr, message, duration = 6400) {
                const toast = document.getElementById('phoneToast');
                if (!toast) return;
                document.getElementById('phoneSender').innerText = sender;
                document.getElementById('phoneTime').innerText = timeStr;
                document.getElementById('phoneMsg').innerText = message;
                toast.classList.add('visible');
                sfx.playPhonePing();
                if (phoneTimer) clearTimeout(phoneTimer);
                phoneTimer = setTimeout(() => {
                    toast.classList.remove('visible');
                }, duration);
            }

            const phoneCutscene = {
                active: false,
                messages: [],
                index: 0,
                typingTimer: null,

                start(config) {
                    if (!config || !config.messages || config.messages.length === 0) return;
                    this.active = true;
                    this.messages = config.messages;
                    this.index = 0;

                    gameState = 'cutscene';
                    mouse.down = false;
                    touchInput.firing = false;
                    syncMobileControlsVisibility();

                    const overlay = document.getElementById('cutsceneOverlay');
                    const stream = document.getElementById('phoneChatStream');
                    const opsecEl = document.getElementById('phoneOpsecBanner');
                    document.getElementById('phoneClockTop').innerText = config.clock || '07:00 AM';
                    opsecEl.innerText = config.opsec || 'OPSEC WARNING: CELLULAR SIGNAL UNENCRYPTED (NO DMR RADIO)';
                    opsecEl.classList.toggle('training-banner', Boolean(config.isTraining));
                    document.getElementById('phoneContactName').innerText = config.contactName || 'EXFIL RELAY';
                    document.getElementById('phoneContactSub').innerText = config.contactSub || 'CELLULAR TOWER BACKUP // ACTIVE';

                    const avatarEl = document.getElementById('phoneContactAvatar');
                    if (avatarEl) {
                        avatarEl.innerHTML = getPortraitSVG(config.contactAvatar || 'male', false);
                    }

                    stream.innerHTML = '';
                    overlay.classList.remove('hidden');
                    this.revealNext();
                },

                revealNext() {
                    if (!this.active) return;
                    if (this.typingTimer) {
                        clearTimeout(this.typingTimer);
                        this.typingTimer = null;
                    }

                    if (this.index >= this.messages.length) {
                        this.close();
                        return;
                    }

                    const msg = this.messages[this.index];
                    this.index++;

                    const stream = document.getElementById('phoneChatStream');
                    const bubble = document.createElement('div');
                    bubble.className = `chat-bubble ${msg.side || 'incoming'}`;

                    if (msg.side === 'system') {
                        bubble.innerText = msg.text;
                    } else {
                        bubble.innerHTML = `
                            <div class="chat-sender-tag">
                                <span>${msg.sender}</span>
                                <span>${msg.time || ''}</span>
                            </div>
                            <div>${msg.text}</div>
                        `;
                    }

                    stream.appendChild(bubble);
                    stream.scrollTop = stream.scrollHeight;
                    sfx.playPhonePing();

                    const typingBar = document.getElementById('phoneTypingBar');
                    const nextBtn = document.getElementById('btnCutsceneNext');

                    if (this.index < this.messages.length) {
                        const upcoming = this.messages[this.index];
                        typingBar.innerText = upcoming.side === 'outgoing'
                            ? 'Composing reply...'
                            : `${upcoming.sender} is typing...`;
                        nextBtn.innerText = isMobileDevice ? 'NEXT MESSAGE' : 'NEXT [SPACE]';

                        this.typingTimer = setTimeout(() => {
                            if (this.active) this.revealNext();
                        }, 1850);
                    } else {
                        typingBar.innerText = 'End of transmission — standing by.';
                        nextBtn.innerText = isMobileDevice ? 'RESUME ACTION' : 'RESUME [SPACE]';
                    }
                },

                close() {
                    if (this.typingTimer) {
                        clearTimeout(this.typingTimer);
                        this.typingTimer = null;
                    }
                    this.active = false;
                    document.getElementById('cutsceneOverlay').classList.add('hidden');
                    if (gameState === 'cutscene') {
                        gameState = 'playing';
                        syncMobileControlsVisibility();
                    }
                }
            };

            document.getElementById('btnCutsceneNext').addEventListener('click', () => phoneCutscene.revealNext());
            document.getElementById('btnCutsceneSkip').addEventListener('click', () => phoneCutscene.close());
            document.getElementById('phoneChatStream').addEventListener('click', () => phoneCutscene.revealNext());

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

                if (k === 'b' && !player.vehicle) {
                    player.toggleAmmoLoad();
                }

                if (k === 'v' && !player.vehicle) {
                    player.cycleOptics();
                }

                if (k === 'f' && !player.vehicle) {
                    player.toggleFlashlight();
                }

                if (k === 't' && !player.vehicle) {
                    player.toggleStrobe();
                }

                if (['1', '2', '3', '4', '5', '6'].includes(e.key) && !player.vehicle) {
                    const idx = parseInt(e.key, 10) - 1;
                    if (WEAPONS[idx] && WEAPONS[idx].unlocked) {
                        player.wepIdx = idx;
                        player.isReloading = false;
                        updateHUD();
                    }
                }

                if (k === 'r' && !player.vehicle) {
                    player.reloadWeapon();
                }

                if (k === 'e') {
                    player.toggleVehicle();
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
                if (gameState === 'cutscene') return;
                if (e.button === 0) {
                    mouse.down = true;
                    mouse.justClicked = true;
                    sfx.init();
                } else if (e.button === 2) {
                    mouse.rightDown = true;
                }
            });

            window.addEventListener('mouseup', (e) => {
                if (e.button === 0) {
                    mouse.down = false;
                } else if (e.button === 2) {
                    mouse.rightDown = false;
                }
            });

            canvas.addEventListener('contextmenu', (e) => e.preventDefault());
            document.getElementById('radioStatus').addEventListener('click', () => sfx.toggleMusic());
            document.getElementById('opticsStatus').addEventListener('click', () => {
                if (gameState === 'playing' && player && !player.vehicle) player.cycleOptics();
            });
            document.getElementById('ammoTypeToggle').addEventListener('click', () => {
                if (gameState === 'playing' && player && !player.vehicle) player.toggleAmmoLoad();
            });

            window.addEventListener('wheel', (e) => {
                if (gameState !== 'playing' || !player || player.vehicle) return;
                const dir = e.deltaY > 0 ? 1 : -1;
                let next = player.wepIdx;
                for (let i = 0; i < WEAPONS.length; i++) {
                    next = (next + dir + WEAPONS.length) % WEAPONS.length;
                    if (WEAPONS[next].unlocked) {
                        player.wepIdx = next;
                        player.isReloading = false;
                        updateHUD();
                        break;
                    }
                }
            });

            // ============================================================================
            // PLATFORM DETECTION & MOBILE TOUCH CONTROLS
            // ============================================================================
            function syncMobileControlsVisibility() {
                const mobEl = document.getElementById('mobileControls');
                if (!mobEl) return;
                if (isMobileDevice && gameState === 'playing') {
                    mobEl.classList.remove('hidden');
                } else {
                    mobEl.classList.add('hidden');
                }
            }

            function detectPlatform() {
                const hasTouch = ('ontouchstart' in window) || (navigator.maxTouchPoints > 0);
                const coarsePointer = window.matchMedia && window.matchMedia('(pointer: coarse)').matches;
                const mobileUA = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
                const detected = Boolean(mobileUA || (hasTouch && (coarsePointer || window.innerWidth <= 920)));

                if (detected !== isMobileDevice) {
                    isMobileDevice = detected;
                    document.body.classList.toggle('mobile-mode', isMobileDevice);

                    const controlsGrid = document.getElementById('controlsGrid');
                    if (controlsGrid) {
                        if (isMobileDevice) {
                            controlsGrid.innerHTML = `
                                <div><strong>Left Stick:</strong> Move &amp; Drive</div>
                                <div><strong>Right Stick:</strong> Aim &amp; Auto-Fire</div>
                                <div><strong>Optics / Light:</strong> NVG/FLIR &bull; Beam &bull; Strobe</div>
                                <div><strong>Ammo Badge:</strong> Tap to Swap FMJ / +P JHP</div>
                                <div><strong>Reload Button:</strong> Toss Mag (Forfeits Rounds)</div>
                                <div><strong>Weapon Bar:</strong> Tap Slots to Switch</div>
                            `;
                        } else {
                            controlsGrid.innerHTML = `
                                <div><strong>WASD / Arrows:</strong> Move &amp; Drive</div>
                                <div><strong>LMB / RMB:</strong> Fire &amp; Sniper Scope</div>
                                <div><strong>M (iPods):</strong> Toggle Earbuds + 150 BPM Psytrance / Metal</div>
                                <div><strong>V / F / T / B:</strong> Optics &bull; Light &bull; Strobe &bull; FMJ/JHP</div>
                                <div><strong>R (Reload):</strong> Toss Mag (Forfeits Leftover Rounds)</div>
                                <div><strong>1–6 / E / H:</strong> Weapons &bull; Vehicle &bull; Horn</div>
                            `;
                        }
                    }
                    syncMobileControlsVisibility();
                }
            }

            function initMobileControls() {
                const leftZone = document.getElementById('leftStickZone');
                const leftBase = document.getElementById('leftStickBase');
                const leftKnob = document.getElementById('leftStickKnob');

                const rightZone = document.getElementById('rightStickZone');
                const rightBase = document.getElementById('rightStickBase');
                const rightKnob = document.getElementById('rightStickKnob');

                let leftTouchId = null;
                let rightTouchId = null;
                const maxRadius = 38;

                function handleStickMove(touch, baseEl, knobEl, isLeft) {
                    const rect = baseEl.getBoundingClientRect();
                    const cx = rect.left + rect.width / 2;
                    const cy = rect.top + rect.height / 2;
                    const dx = touch.clientX - cx;
                    const dy = touch.clientY - cy;
                    const dist = Math.hypot(dx, dy);
                    const clamped = Math.min(dist, maxRadius);
                    const ang = Math.atan2(dy, dx);
                    const nx = dist > 0.001 ? (Math.cos(ang) * clamped) : 0;
                    const ny = dist > 0.001 ? (Math.sin(ang) * clamped) : 0;

                    knobEl.style.transform = `translate(${nx}px, ${ny}px)`;

                    if (isLeft) {
                        touchInput.moveX = nx / maxRadius;
                        touchInput.moveY = ny / maxRadius;
                    } else {
                        if (dist > 6) {
                            touchInput.aimAngle = ang;
                            touchInput.aimActive = true;
                        }
                        if (dist > 14) {
                            if (!touchInput.firing) touchInput.justFired = true;
                            touchInput.firing = true;
                        } else {
                            touchInput.firing = false;
                        }
                    }
                }

                leftZone.addEventListener('touchstart', (e) => {
                    e.preventDefault();
                    sfx.init();
                    if (leftTouchId === null && e.changedTouches.length > 0) {
                        const t = e.changedTouches[0];
                        leftTouchId = t.identifier;
                        handleStickMove(t, leftBase, leftKnob, true);
                    }
                }, { passive: false });

                leftZone.addEventListener('touchmove', (e) => {
                    e.preventDefault();
                    for (let i = 0; i < e.changedTouches.length; i++) {
                        const t = e.changedTouches[i];
                        if (t.identifier === leftTouchId) {
                            handleStickMove(t, leftBase, leftKnob, true);
                        }
                    }
                }, { passive: false });

                function resetLeftStick(e) {
                    for (let i = 0; i < e.changedTouches.length; i++) {
                        if (e.changedTouches[i].identifier === leftTouchId) {
                            leftTouchId = null;
                            touchInput.moveX = 0;
                            touchInput.moveY = 0;
                            leftKnob.style.transform = 'translate(0px, 0px)';
                        }
                    }
                }
                leftZone.addEventListener('touchend', resetLeftStick);
                leftZone.addEventListener('touchcancel', resetLeftStick);

                rightZone.addEventListener('touchstart', (e) => {
                    e.preventDefault();
                    sfx.init();
                    if (rightTouchId === null && e.changedTouches.length > 0) {
                        const t = e.changedTouches[0];
                        rightTouchId = t.identifier;
                        touchInput.justFired = true;
                        handleStickMove(t, rightBase, rightKnob, false);
                    }
                }, { passive: false });

                rightZone.addEventListener('touchmove', (e) => {
                    e.preventDefault();
                    for (let i = 0; i < e.changedTouches.length; i++) {
                        const t = e.changedTouches[i];
                        if (t.identifier === rightTouchId) {
                            handleStickMove(t, rightBase, rightKnob, false);
                        }
                    }
                }, { passive: false });

                function resetRightStick(e) {
                    for (let i = 0; i < e.changedTouches.length; i++) {
                        if (e.changedTouches[i].identifier === rightTouchId) {
                            rightTouchId = null;
                            touchInput.aimActive = false;
                            touchInput.firing = false;
                            rightKnob.style.transform = 'translate(0px, 0px)';
                        }
                    }
                }
                rightZone.addEventListener('touchend', resetRightStick);
                rightZone.addEventListener('touchcancel', resetRightStick);

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
                    if (player && !player.vehicle) player.reloadWeapon();
                }, { passive: false });

                const btnVehicle = document.getElementById('btnVehicle');
                btnVehicle.addEventListener('touchstart', (e) => {
                    e.preventDefault();
                    if (player) player.toggleVehicle();
                }, { passive: false });

                const btnOptics = document.getElementById('btnOptics');
                btnOptics.addEventListener('touchstart', (e) => {
                    e.preventDefault();
                    if (player && !player.vehicle) player.cycleOptics();
                }, { passive: false });

                const btnUtil = document.getElementById('btnUtil');
                btnUtil.addEventListener('touchstart', (e) => {
                    e.preventDefault();
                    if (!player) return;
                    if (player.vehicle) {
                        sfx.playHorn();
                    } else if (player.hasFlashlight) {
                        player.toggleFlashlight();
                    } else {
                        touchInput.scopeActive = !touchInput.scopeActive;
                        btnUtil.classList.toggle('active', touchInput.scopeActive);
                    }
                }, { passive: false });

                const btnStrobe = document.getElementById('btnStrobe');
                btnStrobe.addEventListener('touchstart', (e) => {
                    e.preventDefault();
                    if (!player || player.vehicle) return;
                    player.toggleStrobe();
                }, { passive: false });

                window.addEventListener('resize', detectPlatform);
                window.addEventListener('touchstart', () => {
                    if (!isMobileDevice) detectPlatform();
                }, { once: true, passive: true });
            }

            // ============================================================================
            // PERSISTENT DECALS, BRASS SHELLS, TOSSED MAGAZINES & PARTICLES
            // ============================================================================
            class Decal {
                constructor(x, y, type, angle = 0, size = 6) {
                    this.x = x;
                    this.y = y;
                    this.type = type;
                    this.angle = angle;
                    this.size = size;
                    this.alpha = type === 'skid' ? 0.34 : (type === 'scorch' ? 0.52 : (type === 'bb_scatter' ? 0.85 : 0.72));
                }
                draw(ctx) {
                    ctx.save();
                    ctx.translate(this.x, this.y);
                    ctx.rotate(this.angle);
                    ctx.globalAlpha = this.alpha;
                    if (this.type === 'bb_scatter') {
                        ctx.fillStyle = '#f8fafc';
                        for (let i = 0; i < 4; i++) {
                            ctx.beginPath();
                            ctx.arc(Math.cos(i * 1.7) * 5, Math.sin(i * 2.1) * 5, 1.5, 0, Math.PI * 2);
                            ctx.fill();
                        }
                    } else if (this.type === 'blood') {
                        ctx.fillStyle = '#7f1d1d';
                        ctx.beginPath();
                        ctx.arc(0, 0, this.size, 0, Math.PI * 2);
                        ctx.fill();
                        ctx.beginPath();
                        ctx.arc(this.size * 0.65, this.size * 0.3, this.size * 0.45, 0, Math.PI * 2);
                        ctx.fill();
                    } else if (this.type === 'scorch') {
                        const grad = ctx.createRadialGradient(0, 0, 1, 0, 0, this.size);
                        grad.addColorStop(0, 'rgba(9, 13, 22, 0.92)');
                        grad.addColorStop(0.6, 'rgba(28, 25, 23, 0.58)');
                        grad.addColorStop(1, 'rgba(28, 25, 23, 0)');
                        ctx.fillStyle = grad;
                        ctx.beginPath();
                        ctx.arc(0, 0, this.size, 0, Math.PI * 2);
                        ctx.fill();
                    } else if (this.type === 'skid') {
                        ctx.fillStyle = '#090d16';
                        ctx.fillRect(-this.size, -2.5, this.size * 2, 5);
                    }
                    ctx.restore();
                }
            }

            class Shell {
                constructor(x, y, ejectAngle) {
                    this.x = x;
                    this.y = y;
                    this.z = 12;
                    const speed = Math2.rand(70, 145);
                    this.vx = Math.cos(ejectAngle) * speed;
                    this.vy = Math.sin(ejectAngle) * speed;
                    this.vz = Math2.rand(75, 130);
                    this.rot = Math2.rand(0, Math.PI * 2);
                    this.vRot = Math2.rand(-18, 18);
                    this.settled = false;
                }
                update(dt) {
                    if (this.settled) return;
                    this.x += this.vx * dt;
                    this.y += this.vy * dt;
                    this.z += this.vz * dt;
                    this.vz -= 480 * dt;
                    this.rot += this.vRot * dt;

                    if (this.z <= 0) {
                        this.z = 0;
                        if (Math.abs(this.vz) > 35) {
                            this.vz = -this.vz * 0.42;
                            this.vx *= 0.55;
                            this.vy *= 0.55;
                            this.vRot *= 0.5;
                        } else {
                            this.settled = true;
                        }
                    }
                }
                draw(ctx) {
                    ctx.save();
                    ctx.translate(this.x, this.y - this.z * 0.35);
                    ctx.rotate(this.rot);
                    ctx.fillStyle = this.settled ? '#b45309' : '#facc15';
                    ctx.fillRect(-2.4, -1.1, 4.8, 2.2);
                    ctx.restore();
                }
            }

            class DroppedMag {
                constructor(x, y, tossAngle, wepId, hasLiveRounds = false) {
                    this.x = x;
                    this.y = y;
                    this.z = 14;
                    const speed = Math2.rand(95, 165);
                    this.vx = Math.cos(tossAngle) * speed;
                    this.vy = Math.sin(tossAngle) * speed;
                    this.vz = Math2.rand(95, 145);
                    this.rot = tossAngle + Math2.rand(-0.5, 0.5);
                    this.vRot = Math2.rand(-14, 14);
                    this.wepId = wepId;
                    this.hasLiveRounds = hasLiveRounds;
                    this.settled = false;
                }

                update(dt) {
                    if (this.settled) return;
                    this.x += this.vx * dt;
                    this.y += this.vy * dt;
                    this.z += this.vz * dt;
                    this.vz -= 510 * dt;
                    this.rot += this.vRot * dt;

                    if (this.z <= 0) {
                        this.z = 0;
                        if (Math.abs(this.vz) > 42) {
                            this.vz = -this.vz * 0.38;
                            this.vx *= 0.5;
                            this.vy *= 0.5;
                            this.vRot *= 0.45;
                            sfx.playMagClatter();
                        } else {
                            this.settled = true;
                        }
                    }
                }

                draw(ctx) {
                    ctx.save();
                    ctx.translate(this.x, this.y - this.z * 0.35);
                    ctx.rotate(this.rot);

                    if (!this.settled && this.z > 1) {
                        ctx.fillStyle = 'rgba(0, 0, 0, 0.35)';
                        ctx.fillRect(-5, this.z * 0.35 - 2, 11, 5);
                    }

                    if (this.wepId === 'flamethrower') {
                        ctx.fillStyle = '#ea580c';
                        ctx.fillRect(-6, -3.5, 12, 7);
                        ctx.fillStyle = '#facc15';
                        ctx.fillRect(-2, -3.5, 4, 7);
                    } else if (this.wepId === 'shotgun') {
                        ctx.fillStyle = '#dc2626';
                        ctx.fillRect(-4, -1.6, 6, 3.2);
                        ctx.fillStyle = '#facc15';
                        ctx.fillRect(2, -1.6, 2.2, 3.2);
                    } else {
                        const isRifle = (this.wepId === 'lm4' || this.wepId === 'ar15' || this.wepId === 'ak47' || this.wepId === 'airsoft_aeg');
                        const len = isRifle ? 12 : 9.5;
                        const wid = isRifle ? 4.4 : 3.8;

                        ctx.fillStyle = this.wepId === 'ak47' ? '#78350f' : '#1e293b';
                        ctx.fillRect(-len / 2, -wid / 2, len, wid);
                        ctx.strokeStyle = '#64748b';
                        ctx.lineWidth = 0.8;
                        ctx.strokeRect(-len / 2, -wid / 2, len, wid);

                        if (this.wepId === 'glock26' || this.wepId === 'airsoft_pistol') {
                            ctx.fillStyle = '#ec4899';
                            ctx.fillRect(-len / 2 - 1.5, -wid / 2 - 0.5, 2.6, wid + 1);
                        } else {
                            ctx.fillStyle = '#475569';
                            ctx.fillRect(-len / 2 - 1.2, -wid / 2 - 0.4, 2.2, wid + 0.8);
                        }

                        if (this.hasLiveRounds) {
                            ctx.fillStyle = (this.wepId === 'airsoft_pistol' || this.wepId === 'airsoft_aeg') ? '#f8fafc' : '#facc15';
                            ctx.fillRect(len / 2 - 1.5, -wid / 2 + 0.7, 2.6, wid - 1.4);
                        }
                    }

                    ctx.restore();
                }
            }

            class Particle {
                constructor(x, y, angle, color, size, speed, life) {
                    this.x = x;
                    this.y = y;
                    this.vx = Math.cos(angle) * speed;
                    this.vy = Math.sin(angle) * speed;
                    this.color = color;
                    this.size = size;
                    this.life = life;
                    this.maxLife = life;
                }
                update(dt) {
                    this.x += this.vx * dt;
                    this.y += this.vy * dt;
                    this.vx *= Math.pow(0.08, dt);
                    this.vy *= Math.pow(0.08, dt);
                    this.life -= dt;
                }
                draw(ctx) {
                    if (this.life <= 0) return;
                    ctx.save();
                    ctx.globalAlpha = Math2.clamp(this.life / this.maxLife, 0, 1);
                    ctx.fillStyle = this.color;
                    ctx.beginPath();
                    ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
                    ctx.fill();
                    ctx.restore();
                }
            }

            function createBlood(x, y, angle, count = 6) {
                if (decals.length > 520) decals.shift();
                decals.push(new Decal(x + Math2.rand(-6, 6), y + Math2.rand(-6, 6), 'blood', Math2.rand(0, Math.PI * 2), Math2.rand(4, 10)));
                for (let i = 0; i < count; i++) {
                    const spread = angle + Math2.rand(-0.7, 0.7);
                    particles.push(new Particle(x, y, spread, '#b91c1c', Math2.rand(2, 4.5), Math2.rand(50, 180), Math2.rand(0.2, 0.45)));
                }
            }

            function createBBHit(x, y, angle) {
                if (decals.length > 520) decals.shift();
                decals.push(new Decal(x + Math2.rand(-4, 4), y + Math2.rand(-4, 4), 'bb_scatter', Math2.rand(0, Math.PI * 2), 4));
                for (let i = 0; i < 6; i++) {
                    const spread = angle + Math.PI + Math2.rand(-0.9, 0.9);
                    particles.push(new Particle(x, y, spread, '#f8fafc', 2.0, Math2.rand(65, 165), Math2.rand(0.16, 0.3)));
                }
            }

            function createExplosion(x, y, radius = 140, maxDmg = 130) {
                sfx.playExplosion();
                camera.shake = Math.max(camera.shake, 18);
                if (decals.length > 520) decals.shift();
                decals.push(new Decal(x, y, 'scorch', 0, radius * 0.55));

                for (let i = 0; i < 42; i++) {
                    const ang = Math2.rand(0, Math.PI * 2);
                    const spd = Math2.rand(60, 380);
                    const col = i % 3 === 0 ? '#facc15' : (i % 3 === 1 ? '#f97316' : '#334155');
                    particles.push(new Particle(x, y, ang, col, Math2.rand(3, 8), spd, Math2.rand(0.35, 0.85)));
                }

                if (player && player.hp > 0) {
                    const d = Math2.dist(x, y, player.x, player.y);
                    if (d < radius) {
                        player.takeDamage(Math.round(maxDmg * (1 - d / radius)));
                    }
                }

                for (let i = 0; i < enemies.length; i++) {
                    const e = enemies[i];
                    if (e.hp <= 0) continue;
                    const d = Math2.dist(x, y, e.x, e.y);
                    if (d < radius) {
                        e.takeDamage(Math.round(maxDmg * (1 - d / radius)), Math2.angle(x, y, e.x, e.y), true);
                    }
                }

                for (let i = 0; i < vehicles.length; i++) {
                    const v = vehicles[i];
                    if (v.destroyed) continue;
                    const d = Math2.dist(x, y, v.x, v.y);
                    if (d < radius && d > 5) {
                        v.takeDamage(Math.round(maxDmg * 0.75 * (1 - d / radius)));
                    }
                }
            }

            function broadcastGunshot(x, y, radius = 680, isSpotterShout = false) {
                for (let i = 0; i < enemies.length; i++) {
                    const e = enemies[i];
                    if (e.hp <= 0) continue;
                    if (Math2.dist(x, y, e.x, e.y) <= radius) {
                        if (isSpotterShout) {
                            e.onHearSpotterShout(x, y);
                        } else {
                            e.onHearGunshot(x, y);
                        }
                    }
                }
                if (!isSpotterShout) {
                    for (let i = 0; i < civilians.length; i++) {
                        const c = civilians[i];
                        if (Math2.dist(x, y, c.x, c.y) <= radius) {
                            c.onHearGunshot(x, y);
                        }
                    }
                }
            }

            function isPlayerIlluminatedByEnvironment() {
                if (!player) return false;
                if (!mission || mission.campaign !== 'mall') return true;
                if (player.x > 3610) return true;
                for (let i = 0; i < mallLights.length; i++) {
                    const ml = mallLights[i];
                    if (Math2.dist(player.x, player.y, ml.x, ml.y) < ml.r * 0.78) {
                        return true;
                    }
                }
                return false;
            }

            // ============================================================================
            // FLAMETHROWER INCENDIARY STREAM
            // ============================================================================
            class FlameJet {
                constructor(x, y, angle, speed, dmg, ownerType, ownerRef) {
                    this.x = x;
                    this.y = y;
                    this.angle = angle;
                    this.vx = Math.cos(angle) * speed;
                    this.vy = Math.sin(angle) * speed;
                    this.dmg = dmg;
                    this.ownerType = ownerType;
                    this.ownerRef = ownerRef;
                    this.life = 0.44;
                    this.maxLife = 0.44;
                    this.radius = 6;
                    this.active = true;
                    this.hitEntities = new Set();
                }

                update(dt) {
                    if (!this.active) return;
                    this.life -= dt;
                    if (this.life <= 0) {
                        this.active = false;
                        return;
                    }

                    const progress = 1 - this.life / this.maxLife;
                    this.radius = 6 + progress * 22;

                    const nextX = this.x + this.vx * dt;
                    const nextY = this.y + this.vy * dt;
                    this.vx *= Math.pow(0.18, dt);
                    this.vy *= Math.pow(0.18, dt);

                    for (let i = 0; i < buildings.length; i++) {
                        const b = buildings[i];
                        if (b.isLowWall) continue;
                        if (nextX > b.x - 4 && nextX < b.x + b.w + 4 && nextY > b.y - 4 && nextY < b.y + b.h + 4) {
                            this.active = false;
                            if (Math.random() < 0.35 && decals.length < 520) {
                                decals.push(new Decal(this.x, this.y, 'scorch', 0, Math2.rand(10, 18)));
                            }
                            return;
                        }
                    }

                    this.x = nextX;
                    this.y = nextY;

                    if (Math.random() < 0.08 && decals.length < 520) {
                        decals.push(new Decal(this.x, this.y, 'scorch', 0, Math2.rand(10, 20)));
                    }

                    for (let i = 0; i < enemies.length; i++) {
                        const e = enemies[i];
                        if (e.hp <= 0 || e === this.ownerRef || this.hitEntities.has(e)) continue;
                        if (Math2.dist(this.x, this.y, e.x, e.y) <= this.radius + e.r) {
                            this.hitEntities.add(e);
                            e.burnTimer = Math.max(e.burnTimer, 3.2);
                            e.takeDamage(this.dmg, this.angle, true);
                        }
                    }

                    for (let i = 0; i < vehicles.length; i++) {
                        const v = vehicles[i];
                        if (v.destroyed || this.hitEntities.has(v)) continue;
                        const vr = Math.max(v.w, v.h) * 0.44;
                        if (Math2.dist(this.x, this.y, v.x, v.y) <= this.radius + vr) {
                            this.hitEntities.add(v);
                            v.takeDamage(this.dmg * 0.85);
                        }
                    }
                }

                draw(ctx) {
                    if (!this.active) return;
                    const t = 1 - this.life / this.maxLife;
                    ctx.save();
                    const grad = ctx.createRadialGradient(this.x, this.y, 1, this.x, this.y, this.radius);
                    if (t < 0.35) {
                        grad.addColorStop(0, 'rgba(254, 249, 195, 0.95)');
                        grad.addColorStop(0.5, 'rgba(251, 146, 60, 0.8)');
                        grad.addColorStop(1, 'rgba(234, 88, 12, 0)');
                    } else if (t < 0.75) {
                        grad.addColorStop(0, 'rgba(251, 146, 60, 0.78)');
                        grad.addColorStop(0.55, 'rgba(220, 38, 38, 0.52)');
                        grad.addColorStop(1, 'rgba(127, 29, 29, 0)');
                    } else {
                        grad.addColorStop(0, 'rgba(87, 83, 78, 0.42)');
                        grad.addColorStop(1, 'rgba(28, 25, 23, 0)');
                    }
                    ctx.fillStyle = grad;
                    ctx.beginPath();
                    ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
                    ctx.fill();
                    ctx.restore();
                }
            }

            // ============================================================================
            // HIGH-VELOCITY SWEPT-SEGMENT BALLISTICS & 6MM AIRSOFT BBS
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
                    this.life = isAirsoft ? 0.42 : (pierce ? 0.75 : 0.55);
                    this.active = true;
                }

                update(dt) {
                    if (!this.active) return;
                    this.life -= dt;
                    if (this.life <= 0) {
                        this.active = false;
                        return;
                    }

                    const subSteps = 2;
                    const subDt = dt / subSteps;

                    for (let step = 0; step < subSteps; step++) {
                        if (!this.active) return;
                        this.prevX = this.x;
                        this.prevY = this.y;
                        const nextX = this.x + this.vx * subDt;
                        const nextY = this.y + this.vy * subDt;

                        // Check solid walls
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

                        // Check woodland tree trunks
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

                        // Check Player hit (for hostile bullets)
                        if (this.ownerType === 'enemy' && player && player.hp > 0 && !player.vehicle) {
                            const t = segmentCircleIntersectT(this.prevX, this.prevY, nextX, nextY, player.x, player.y, player.r);
                            if (t !== null && t < bestT) {
                                bestT = t;
                                hitTarget = player;
                                hitKind = 'player';
                            }
                        }

                        // Check Friendly Allies hit (for hostile bullets in Training stage)
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

                        // Check Enemies hit
                        for (let i = 0; i < enemies.length; i++) {
                            const e = enemies[i];
                            if (e.hp <= 0 || e === this.ownerRef || this.hitSet.has(e)) continue;
                            if (this.ownerType === 'enemy' && this.ownerRef && e.faction === this.ownerRef.faction) continue;
                            const t = segmentCircleIntersectT(this.prevX, this.prevY, nextX, nextY, e.x, e.y, e.r);
                            if (t !== null && t < bestT) {
                                bestT = t;
                                hitTarget = e;
                                hitKind = 'enemy';
                            }
                        }

                        // Check Vehicles hit
                        for (let i = 0; i < vehicles.length; i++) {
                            const v = vehicles[i];
                            if (v.destroyed) continue;
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
                        const tx = this.x - Math.cos(this.angle) * 22;
                        const ty = this.y - Math.sin(this.angle) * 22;
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

                    const tailLen = this.pierce ? 85 : (this.isJHP ? 54 : 46);
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
                    ctx.lineWidth = this.pierce ? 3.0 : (this.isJHP ? 2.4 : 2.1);
                    ctx.beginPath();
                    ctx.moveTo(tx, ty);
                    ctx.lineTo(this.x, this.y);
                    ctx.stroke();

                    ctx.fillStyle = '#ffffff';
                    ctx.beginPath();
                    ctx.arc(this.x, this.y, this.pierce ? 2.4 : 1.7, 0, Math.PI * 2);
                    ctx.fill();
                    ctx.restore();
                }
            }

            // ============================================================================
            // PICKUPS & STASHES (INCLUDING 120GR +P JHP STASHES & AIRSOFT CRATES)
            // ============================================================================
            class Pickup {
                constructor(x, y, type) {
                    this.x = x;
                    this.y = y;
                    this.type = type;
                    this.r = 15;
                    this.collected = false;
                    this.bob = Math2.rand(0, Math.PI * 2);
                }

                update(dt) {
                    if (this.collected || !player || player.hp <= 0) return;
                    this.bob += dt * 4;
                    const px = player.vehicle ? player.vehicle.x : player.x;
                    const py = player.vehicle ? player.vehicle.y : player.y;
                    if (Math2.dist(this.x, this.y, px, py) < 28) {
                        this.apply();
                    }
                }

                apply() {
                    this.collected = true;
                    sfx.playPickup();
                    let msg = '';
                    if (this.type === 'jhp_stash') {
                        const g26 = WEAPONS.find((w) => w.id === 'glock26');
                        if (g26) {
                            g26.jhpReserve += 15;
                            g26.ammoLoad = 'jhp';
                            g26.reserve = g26.jhpReserve;
                            g26.mag = Math.min(g26.magMax, g26.jhpReserve);
                            g26.jhpReserve -= g26.mag;
                            g26.reserve = g26.jhpReserve;
                            msg = 'STASH FOUND: 120GR +P JHP HOLLOW POINTS LOADED! [B: TOGGLE FMJ/JHP]';
                        }
                    } else if (this.type === 'airsoft_aeg') {
                        const idx = WEAPONS.findIndex((w) => w.id === 'airsoft_aeg');
                        if (idx !== -1) {
                            WEAPONS[idx].unlocked = true;
                            WEAPONS[idx].mag = WEAPONS[idx].magMax;
                            WEAPONS[idx].reserve += 90;
                            player.wepIdx = idx;
                            sfx.playReload();
                            msg = `EQUIPPED: AIRSOFT M4 CQB AEG [SLOT ${idx + 1}]`;
                        }
                    } else if (this.type === 'bb_bag') {
                        for (let i = 0; i < WEAPONS.length; i++) {
                            const w = WEAPONS[i];
                            if (w.unlocked && w.type !== 'melee') {
                                w.reserve += w.magMax * 2;
                            }
                        }
                        msg = 'RESUPPLIED: 6MM AIRSOFT BBS & GREEN GAS';
                    } else if (this.type === 'cash') {
                        const amount = Math2.randInt(3, 12) * 100;
                        cashCollected += amount;
                        const cashEl = document.getElementById('cashCounter');
                        if (cashEl) {
                            cashEl.style.display = 'block';
                            cashEl.innerText = `CASH LOOTED: R${cashCollected.toLocaleString()}`;
                        }
                        msg = `LOOTED: CASH STACK (+R${amount})`;
                    } else if (this.type === 'food') {
                        player.hp = Math.min(100, player.hp + 25);
                        player.stamina = Math.min(100, player.stamina + 25);
                        cashCollected += 150;
                        const cashEl = document.getElementById('cashCounter');
                        if (cashEl && mission && mission.campaign === 'mall') {
                            cashEl.style.display = 'block';
                            cashEl.innerText = `CASH LOOTED: R${cashCollected.toLocaleString()}`;
                        }
                        msg = 'CONSUMED: CANNED FOOD (+25 HP, +25 STAMINA)';
                    } else if (this.type === 'water') {
                        player.stamina = Math.min(100, player.stamina + 50);
                        player.hp = Math.min(100, player.hp + 10);
                        cashCollected += 100;
                        const cashEl = document.getElementById('cashCounter');
                        if (cashEl && mission && mission.campaign === 'mall') {
                            cashEl.style.display = 'block';
                            cashEl.innerText = `CASH LOOTED: R${cashCollected.toLocaleString()}`;
                        }
                        msg = 'CONSUMED: BOTTLED WATER (+50 STAMINA, +10 HP)';
                    } else if (this.type === 'health') {
                        player.hp = Math.min(100, player.hp + 45);
                        msg = (mission && mission.campaign === 'training')
                            ? 'STAGING MEDIC: HYDRATION & COOLING TOWEL (+45 STAMINA/READY)'
                            : 'PICKED UP: FIRST-AID KIT (+45 HP)';
                    } else if (this.type === 'armor') {
                        player.armor = Math.min(100, player.armor + 35);
                        msg = (mission && mission.campaign === 'training')
                            ? 'EQUIPPED: PADDED CHEST RIG (+35 PROTECTION)'
                            : 'PICKED UP: KEVLAR INSERT (+35 ARMOR)';
                    } else if (this.type === 'fuel') {
                        const fWep = WEAPONS.find((w) => w.id === 'flamethrower');
                        if (fWep) {
                            fWep.unlocked = true;
                            fWep.reserve += 150;
                        }
                        msg = 'PICKED UP: NAPALM FUEL CANISTER (+150 FUEL)';
                    } else if (this.type === 'ammo') {
                        const isMall = mission && mission.campaign === 'mall';
                        for (let i = 0; i < WEAPONS.length; i++) {
                            const w = WEAPONS[i];
                            if (w.unlocked && w.type !== 'melee') {
                                if (w.id === 'glock26') {
                                    w.fmjReserve += w.magMax;
                                    if (w.ammoLoad === 'fmj') w.reserve = w.fmjReserve;
                                } else {
                                    w.reserve += isMall ? w.magMax : (w.type === 'flame' ? 120 : w.magMax * 2);
                                }
                            }
                        }
                        msg = isMall ? 'SCAVENGED: +1 SPARE 100GR FMJ MAGAZINE' : 'PICKED UP: SPARE MAGAZINES & FUEL';
                    } else if (this.type === 'shotgun') {
                        const idx = WEAPONS.findIndex((w) => w.id === 'shotgun');
                        if (idx !== -1) {
                            WEAPONS[idx].unlocked = true;
                            WEAPONS[idx].mag = WEAPONS[idx].magMax;
                            WEAPONS[idx].reserve += (mission && mission.campaign === 'mall') ? 8 : 24;
                            player.wepIdx = idx;
                            sfx.playReload();
                            msg = `ACQUIRED: PUMP SHOTGUN [SLOT ${idx + 1}]`;
                        }
                    } else if (this.type === 'ak47') {
                        const idx = WEAPONS.findIndex((w) => w.id === 'ak47');
                        if (idx !== -1) {
                            WEAPONS[idx].unlocked = true;
                            WEAPONS[idx].mag = WEAPONS[idx].magMax;
                            WEAPONS[idx].reserve += 30;
                            player.wepIdx = idx;
                            sfx.playReload();
                            msg = `ACQUIRED: KALASHNIKOV AK-47 [SLOT ${idx + 1}]`;
                        }
                    } else if (this.type === 'ar15') {
                        const idx = WEAPONS.findIndex((w) => w.id === 'ar15');
                        if (idx !== -1) {
                            WEAPONS[idx].unlocked = true;
                            WEAPONS[idx].mag = WEAPONS[idx].magMax;
                            WEAPONS[idx].reserve += 90;
                            player.wepIdx = idx;
                            sfx.playReload();
                            msg = `ACQUIRED: TACTICAL AR-15 [SLOT ${idx + 1}]`;
                        }
                    }
                    showBanner(msg, 2400);
                    updateHUD();
                }

                draw(ctx) {
                    if (this.collected) return;
                    const offset = Math.sin(this.bob) * 3;
                    ctx.save();
                    ctx.translate(this.x, this.y + offset);

                    const glowColors = {
                        jhp_stash: 'rgba(239, 68, 68, 0.48)',
                        airsoft_aeg: 'rgba(74, 222, 128, 0.45)',
                        bb_bag: 'rgba(248, 250, 252, 0.4)',
                        cash: 'rgba(34, 197, 94, 0.38)',
                        food: 'rgba(249, 115, 22, 0.38)',
                        water: 'rgba(56, 189, 248, 0.42)',
                        health: 'rgba(239, 68, 68, 0.35)',
                        armor: 'rgba(56, 189, 248, 0.35)',
                        fuel: 'rgba(249, 115, 22, 0.45)',
                        ammo: 'rgba(250, 204, 21, 0.35)',
                        shotgun: 'rgba(245, 158, 11, 0.45)',
                        ak47: 'rgba(245, 158, 11, 0.45)',
                        ar15: 'rgba(245, 158, 11, 0.5)'
                    };

                    ctx.fillStyle = glowColors[this.type] || 'rgba(255,255,255,0.25)';
                    ctx.beginPath();
                    ctx.arc(0, 0, 17, 0, Math.PI * 2);
                    ctx.fill();

                    if (this.type === 'jhp_stash') {
                        ctx.fillStyle = '#7f1d1d';
                        ctx.fillRect(-11, -7, 22, 14);
                        ctx.fillStyle = '#fca5a5';
                        ctx.fillRect(-7, -2.5, 14, 5);
                    } else if (this.type === 'bb_bag') {
                        ctx.fillStyle = '#e2e8f0';
                        ctx.fillRect(-8, -9, 16, 18);
                        ctx.fillStyle = '#16a34a';
                        ctx.fillRect(-6, -3, 12, 6);
                    } else if (this.type === 'cash') {
                        ctx.fillStyle = '#16a34a';
                        ctx.fillRect(-10, -6, 20, 12);
                        ctx.fillStyle = '#bbf7d0';
                        ctx.fillRect(-3, -6, 6, 12);
                    } else if (this.type === 'food') {
                        ctx.fillStyle = '#ea580c';
                        ctx.beginPath();
                        ctx.arc(0, 0, 8, 0, Math.PI * 2);
                        ctx.fill();
                        ctx.fillStyle = '#fef08a';
                        ctx.fillRect(-5, -2.5, 10, 5);
                    } else if (this.type === 'water') {
                        ctx.fillStyle = '#0ea5e9';
                        ctx.fillRect(-5, -9, 10, 18);
                        ctx.fillStyle = '#f8fafc';
                        ctx.fillRect(-3, -11, 6, 3);
                    } else if (this.type === 'health') {
                        ctx.fillStyle = '#f8fafc';
                        ctx.fillRect(-10, -8, 20, 16);
                        ctx.fillStyle = '#dc2626';
                        ctx.fillRect(-2.5, -5, 5, 10);
                        ctx.fillRect(-5, -2.5, 10, 5);
                    } else if (this.type === 'armor') {
                        ctx.fillStyle = '#0284c7';
                        ctx.beginPath();
                        ctx.moveTo(-8, -9);
                        ctx.lineTo(8, -9);
                        ctx.lineTo(10, 4);
                        ctx.lineTo(0, 11);
                        ctx.lineTo(-10, 4);
                        ctx.closePath();
                        ctx.fill();
                    } else if (this.type === 'fuel') {
                        ctx.fillStyle = '#ea580c';
                        ctx.fillRect(-8, -10, 16, 20);
                        ctx.fillStyle = '#facc15';
                        ctx.fillRect(-5, -3, 10, 6);
                    } else if (this.type === 'ammo') {
                        ctx.fillStyle = '#3f6212';
                        ctx.fillRect(-11, -7, 22, 14);
                        ctx.fillStyle = '#facc15';
                        ctx.fillRect(-7, -2, 14, 4);
                    } else {
                        ctx.fillStyle = '#1e293b';
                        ctx.fillRect(-16, -4, 32, 8);
                        ctx.fillStyle = this.type === 'airsoft_aeg' ? '#4ade80' : '#f59e0b';
                        ctx.fillRect(-6, -2, 12, 4);
                    }
                    ctx.restore();
                }
            }

            // ============================================================================
            // DRIVABLE SOUTH AFRICAN VEHICLES
            // ============================================================================
            class Vehicle {
                constructor(x, y, angle, kind = 'bakkie', lockedBlockade = false) {
                    this.x = x;
                    this.y = y;
                    this.angle = angle;
                    this.kind = kind;
                    this.lockedBlockade = lockedBlockade;
                    this.speed = 0;
                    this.driver = null;
                    this.destroyed = false;

                    if (kind === 'nyala') {
                        this.w = 74;
                        this.h = 36;
                        this.maxSpeed = 340;
                        this.accel = 420;
                        this.hp = 450;
                        this.maxHp = 450;
                        this.color = '#1e3a8a';
                    } else if (kind === 'saps') {
                        this.w = 68;
                        this.h = 32;
                        this.maxSpeed = 390;
                        this.accel = 500;
                        this.hp = 260;
                        this.maxHp = 260;
                        this.color = '#f8fafc';
                    } else if (kind === 'taxi') {
                        this.w = 68;
                        this.h = 32;
                        this.maxSpeed = 400;
                        this.accel = 510;
                        this.hp = 230;
                        this.maxHp = 230;
                        this.color = '#f8fafc';
                    } else if (kind === 'hatchback') {
                        this.w = 54;
                        this.h = 28;
                        this.maxSpeed = 450;
                        this.accel = 580;
                        this.hp = 165;
                        this.maxHp = 165;
                        this.color = '#dc2626';
                    } else {
                        this.w = 64;
                        this.h = 30;
                        this.maxSpeed = 420;
                        this.accel = 540;
                        this.hp = 250;
                        this.maxHp = 250;
                        this.color = '#e2e8f0';
                    }
                }

                takeDamage(amount) {
                    if (this.destroyed) return;
                    this.hp -= amount;
                    if (this.hp <= 0) {
                        this.hp = 0;
                        this.destroyed = true;
                        if (this.driver) {
                            const drv = this.driver;
                            this.driver = null;
                            drv.vehicle = null;
                            drv.x = this.x + Math.cos(this.angle + Math.PI / 2) * 34;
                            drv.y = this.y + Math.sin(this.angle + Math.PI / 2) * 34;
                        }
                        createExplosion(this.x, this.y, 155, 130);
                    }
                }

                update(dt) {
                    if (this.destroyed) return;

                    if (this.driver === player) {
                        let throttle = 0;
                        if (keys['w'] || keys['arrowup']) throttle += 1;
                        if (keys['s'] || keys['arrowdown']) throttle -= 1;
                        if (Math.abs(touchInput.moveY) > 0.15) throttle -= touchInput.moveY;
                        throttle = Math2.clamp(throttle, -1, 1);

                        let turn = 0;
                        if (keys['a'] || keys['arrowleft']) turn -= 1;
                        if (keys['d'] || keys['arrowright']) turn += 1;
                        if (Math.abs(touchInput.moveX) > 0.15) turn += touchInput.moveX;
                        turn = Math2.clamp(turn, -1, 1);

                        const handbrake = keys['space'] || touchInput.sprint;

                        if (keys['h']) {
                            keys['h'] = false;
                            sfx.playHorn();
                        }

                        if (throttle > 0) {
                            this.speed += this.accel * dt;
                        } else if (throttle < 0) {
                            this.speed -= this.accel * 0.85 * dt;
                        } else {
                            this.speed *= Math.pow(0.18, dt);
                        }

                        if (handbrake) {
                            this.speed *= Math.pow(0.06, dt);
                        }

                        this.speed = Math2.clamp(this.speed, -this.maxSpeed * 0.45, this.maxSpeed);

                        if (Math.abs(this.speed) > 12) {
                            const dir = this.speed >= 0 ? 1 : -1;
                            const turnRate = handbrake ? 3.6 : 2.6;
                            this.angle += turn * turnRate * dir * dt;

                            if (handbrake && Math.abs(turn) > 0 && Math.abs(this.speed) > 140) {
                                if (decals.length > 520) decals.shift();
                                decals.push(new Decal(this.x, this.y, 'skid', this.angle, 8));
                            }
                        }
                    } else {
                        this.speed *= Math.pow(0.08, dt);
                    }

                    if (Math.abs(this.speed) > 1) {
                        this.x += Math.cos(this.angle) * this.speed * dt;
                        this.y += Math.sin(this.angle) * this.speed * dt;
                    }

                    this.x = Math2.clamp(this.x, 45, WORLD_SIZE - 45);
                    this.y = Math2.clamp(this.y, 45, WORLD_SIZE - 45);

                    const vr = Math.min(this.w, this.h) * 0.52;
                    for (let i = 0; i < buildings.length; i++) {
                        const b = buildings[i];
                        const proxy = { x: this.x, y: this.y, r: vr };
                        if (circleRectResolve(proxy, b)) {
                            this.x = proxy.x;
                            this.y = proxy.y;
                            this.speed *= -0.35;
                        }
                    }

                    if (Math.abs(this.speed) > 110) {
                        for (let i = 0; i < enemies.length; i++) {
                            const e = enemies[i];
                            if (e.hp <= 0) continue;
                            if (Math2.dist(this.x, this.y, e.x, e.y) < vr + e.r) {
                                e.takeDamage(Math.round(Math.abs(this.speed) * 0.45), this.angle, true);
                                this.speed *= 0.88;
                            }
                        }
                    }

                    if (this.driver === player) {
                        player.x = this.x;
                        player.y = this.y;
                        player.angle = this.angle;
                    }

                    if (this.hp < this.maxHp * 0.45 && Math.random() < 0.25) {
                        particles.push(new Particle(
                            this.x + Math.cos(this.angle) * (this.w * 0.35),
                            this.y + Math.sin(this.angle) * (this.w * 0.35),
                            -Math.PI / 2 + Math2.rand(-0.4, 0.4),
                            '#475569',
                            Math2.rand(4, 8),
                            Math2.rand(25, 65),
                            0.6
                        ));
                    }
                }

                draw(ctx) {
                    ctx.save();
                    ctx.translate(this.x, this.y);
                    ctx.rotate(this.angle);

                    const hw = this.w / 2;
                    const hh = this.h / 2;

                    ctx.fillStyle = 'rgba(0, 0, 0, 0.42)';
                    ctx.fillRect(-hw + 4, -hh + 5, this.w, this.h);

                    ctx.fillStyle = this.destroyed ? '#1e293b' : this.color;
                    ctx.beginPath();
                    ctx.roundRect(-hw, -hh, this.w, this.h, 5);
                    ctx.fill();

                    if (!this.destroyed) {
                        if (this.kind === 'taxi') {
                            ctx.fillStyle = '#0284c7';
                            ctx.fillRect(-hw + 3, -hh + 1, this.w - 6, 4);
                            ctx.fillRect(-hw + 3, hh - 5, this.w - 6, 4);
                            ctx.fillStyle = '#facc15';
                            ctx.fillRect(-8, -4, 14, 8);
                        } else if (this.kind === 'saps') {
                            ctx.fillStyle = '#1d4ed8';
                            ctx.fillRect(-hw + 3, -hh + 1, this.w - 6, 4);
                            ctx.fillRect(-hw + 3, hh - 5, this.w - 6, 4);
                            ctx.fillStyle = '#facc15';
                            ctx.fillRect(-hw + 5, -hh + 5, this.w - 10, 2.5);
                            const flash = Math.sin(performance.now() * 0.02) > 0;
                            ctx.fillStyle = flash ? '#38bdf8' : '#1e3a8a';
                            ctx.fillRect(0, -hh + 3, 6, this.h - 6);
                        } else if (this.kind === 'bakkie') {
                            ctx.fillStyle = '#0f172a';
                            ctx.fillRect(-hw + 4, -hh + 3, hw * 0.85, this.h - 6);
                            ctx.strokeStyle = '#94a3b8';
                            ctx.lineWidth = 2;
                            ctx.beginPath();
                            ctx.moveTo(-2, -hh + 3);
                            ctx.lineTo(-2, hh - 3);
                            ctx.stroke();
                        } else if (this.kind === 'nyala') {
                            ctx.fillStyle = '#172554';
                            ctx.fillRect(-hw + 6, -hh + 4, this.w - 14, this.h - 8);
                            ctx.fillStyle = '#38bdf8';
                            ctx.fillRect(0, -4, 8, 8);
                        }

                        ctx.fillStyle = '#0f172a';
                        ctx.fillRect(hw * 0.25, -hh + 3, hw * 0.35, this.h - 6);

                        if (this.driver || this.lockedBlockade) {
                            ctx.fillStyle = 'rgba(254, 249, 195, 0.2)';
                            ctx.beginPath();
                            ctx.moveTo(hw, -hh + 4);
                            ctx.lineTo(hw + 135, -hh - 24);
                            ctx.lineTo(hw + 135, hh + 24);
                            ctx.lineTo(hw, hh - 4);
                            ctx.closePath();
                            ctx.fill();
                        }
                    }

                    ctx.restore();
                }
            }

            // ============================================================================
            // FRIENDLY YOUTH SQUAD ALLIES (YOUNGER G & YOUNGER BLAZE IN WOODLAND AIRSOFT)
            // ============================================================================
            class Ally {
                constructor(x, y, identity) {
                    this.x = x;
                    this.y = y;
                    this.spawnX = x;
                    this.spawnY = y;
                    this.identity = identity; // 'young_g' | 'young_blaze'
                    this.name = identity === 'young_g' ? 'YOUNGER G' : 'YOUNGER BLAZE';
                    this.r = 10.5;
                    this.hp = 110;
                    this.maxHp = 110;
                    this.angle = -Math.PI / 4;
                    this.lastShot = 0;
                    this.isOut = false;
                    this.respawnTimer = 0;
                    this.formationOffsetAngle = identity === 'young_g' ? -0.95 : 0.95;
                }

                takeDamage(amount) {
                    if (this.isOut) return;
                    this.hp -= amount;
                    if (this.hp <= 0) {
                        this.hp = 0;
                        this.isOut = true;
                        this.respawnTimer = 6.5;
                        showBanner(`${this.name}: "HIT! WALKING BACK TO STAGING!"`, 1800);
                    }
                }

                update(dt) {
                    if (this.isOut) {
                        this.respawnTimer -= dt;
                        // Jog back toward youth staging camp while holding orange dead rag
                        const dHome = Math2.dist(this.x, this.y, this.spawnX, this.spawnY);
                        if (dHome > 25) {
                            this.angle = Math2.angle(this.x, this.y, this.spawnX, this.spawnY);
                            this.x += Math.cos(this.angle) * 165 * dt;
                            this.y += Math.sin(this.angle) * 165 * dt;
                        }
                        if (this.respawnTimer <= 0) {
                            this.isOut = false;
                            this.hp = this.maxHp;
                            showBanner(`${this.name} IS BACK IN THE SKIRMISH!`, 1500);
                        }
                        return;
                    }

                    // Find closest active adult airsoft player in sight
                    let target = null;
                    let bestDist = 480;
                    for (let i = 0; i < enemies.length; i++) {
                        const e = enemies[i];
                        if (e.hp <= 0) continue;
                        const d = Math2.dist(this.x, this.y, e.x, e.y);
                        if (d < bestDist && hasLoS(this.x, this.y, e.x, e.y)) {
                            bestDist = d;
                            target = e;
                        }
                    }

                    if (target) {
                        this.angle = Math2.angle(this.x, this.y, target.x, target.y);
                        if (bestDist > 260) {
                            this.x += Math.cos(this.angle) * 155 * dt;
                            this.y += Math.sin(this.angle) * 155 * dt;
                        } else if (bestDist < 140) {
                            this.x -= Math.cos(this.angle) * 110 * dt;
                            this.y -= Math.sin(this.angle) * 110 * dt;
                        }

                        const now = performance.now();
                        const delay = this.identity === 'young_blaze' ? 210 : 270;
                        if (now - this.lastShot >= delay) {
                            this.lastShot = now;
                            sfx.playGunshot('airsoft_aeg');
                            const mx = this.x + Math.cos(this.angle) * 18;
                            const my = this.y + Math.sin(this.angle) * 18;
                            bullets.push(new Bullet(mx, my, this.angle + Math2.rand(-0.07, 0.07), 2650, 22, 'ally', this, false, true, false));
                        }
                    } else if (player && player.hp > 0) {
                        // Advance in tactical buddy formation alongside Younger Yael
                        const desiredX = player.x + Math.cos(player.angle + Math.PI + this.formationOffsetAngle) * 78;
                        const desiredY = player.y + Math.sin(player.angle + Math.PI + this.formationOffsetAngle) * 78;
                        const distToSlot = Math2.dist(this.x, this.y, desiredX, desiredY);
                        if (distToSlot > 26) {
                            this.angle = Math2.angle(this.x, this.y, desiredX, desiredY);
                            const spd = distToSlot > 180 ? 235 : 185;
                            this.x += Math.cos(this.angle) * spd * dt;
                            this.y += Math.sin(this.angle) * spd * dt;
                        } else {
                            this.angle = player.angle;
                        }
                    }

                    this.x = Math2.clamp(this.x, 40, WORLD_SIZE - 40);
                    this.y = Math2.clamp(this.y, 40, WORLD_SIZE - 40);
                    for (let i = 0; i < buildings.length; i++) {
                        circleRectResolve(this, buildings[i]);
                    }
                    for (let i = 0; i < woodlandTrees.length; i++) {
                        const tr = woodlandTrees[i];
                        circleRectResolve(this, { x: tr.x - tr.trunkR, y: tr.y - tr.trunkR, w: tr.trunkR * 2, h: tr.trunkR * 2 });
                    }
                }

                draw(ctx) {
                    ctx.save();
                    ctx.translate(this.x, this.y);
                    ctx.rotate(this.angle);

                    ctx.fillStyle = 'rgba(0,0,0,0.35)';
                    ctx.beginPath();
                    ctx.ellipse(2, 3, 10, 12, 0, 0, Math.PI * 2);
                    ctx.fill();

                    // Torso
                    ctx.fillStyle = this.identity === 'young_g' ? '#334155' : '#18181b';
                    ctx.beginPath();
                    ctx.ellipse(-2, 0, 8.8, 11.5, 0, 0, Math.PI * 2);
                    ctx.fill();

                    // Airsoft AEG Carbine
                    ctx.fillStyle = '#0f172a';
                    ctx.fillRect(5, 2.8, 18, 3.6);
                    ctx.fillStyle = '#f97316';
                    ctx.fillRect(22, 3.0, 2.5, 3.2); // Orange airsoft tip

                    // Head
                    ctx.fillStyle = this.identity === 'young_g' ? '#d4a373' : '#fbd3b0';
                    ctx.beginPath();
                    ctx.arc(0, 0, 6.2, 0, Math.PI * 2);
                    ctx.fill();

                    if (this.identity === 'young_g') {
                        // Younger G's dark brown hair
                        ctx.fillStyle = '#451a03';
                        ctx.beginPath();
                        ctx.arc(-1, 0, 6.7, Math.PI * 0.45, Math.PI * 1.55);
                        ctx.fill();
                    } else {
                        // Younger Blaze's fiery red hair & ponytail
                        ctx.fillStyle = '#ea580c';
                        ctx.beginPath();
                        ctx.arc(-1, 0, 6.8, Math.PI * 0.42, Math.PI * 1.58);
                        ctx.fill();
                        ctx.fillStyle = '#c2410c';
                        ctx.beginPath();
                        ctx.arc(-10, 0, 4.0, 0, Math.PI * 2);
                        ctx.fill();
                    }

                    ctx.restore();

                    // Nameplate / HIT Dead Rag
                    ctx.font = '900 9.5px ui-monospace, monospace';
                    ctx.textAlign = 'center';
                    if (this.isOut) {
                        ctx.fillStyle = '#fb923c';
                        ctx.fillText('HIT! (RESPAWNING)', this.x, this.y - 18);
                    } else {
                        ctx.fillStyle = '#4ade80';
                        ctx.fillText(this.name, this.x, this.y - 17);
                    }
                }
            }

            // ============================================================================
            // FRIGHTENED MALL SHOPPERS (CIVILIANS TRAPPED IN THE MALL)
            // ============================================================================
            class Civilian {
                constructor(x, y) {
                    this.x = x;
                    this.y = y;
                    this.r = 10.5;
                    this.angle = Math2.rand(0, Math.PI * 2);
                    this.state = 'huddled';
                    this.panicTimer = 0;
                    this.fleeAngle = this.angle;
                    this.shirtColor = ['#38bdf8', '#a855f7', '#eab308', '#14b8a6', '#f43f5e'][Math2.randInt(0, 4)];
                }

                onHearGunshot(gx, gy) {
                    this.state = 'fleeing';
                    this.panicTimer = Math2.rand(3.0, 5.5);
                    this.fleeAngle = Math2.angle(gx, gy, this.x, this.y) + Math2.rand(-0.5, 0.5);
                }

                update(dt) {
                    if (this.state === 'fleeing') {
                        this.panicTimer -= dt;
                        this.angle = this.fleeAngle;
                        this.x += Math.cos(this.angle) * 165 * dt;
                        this.y += Math.sin(this.angle) * 165 * dt;

                        this.x = Math2.clamp(this.x, 480, 3580);
                        this.y = Math2.clamp(this.y, 480, 3500);

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
                    ctx.save();
                    ctx.translate(this.x, this.y);
                    ctx.rotate(this.angle);

                    ctx.fillStyle = 'rgba(0,0,0,0.35)';
                    ctx.beginPath();
                    ctx.ellipse(2, 2, 9.5, 11.5, 0, 0, Math.PI * 2);
                    ctx.fill();

                    ctx.fillStyle = this.shirtColor;
                    ctx.beginPath();
                    ctx.ellipse(-1, 0, 8.5, 11, 0, 0, Math.PI * 2);
                    ctx.fill();

                    ctx.fillStyle = '#8d5524';
                    ctx.beginPath();
                    ctx.arc(0, 0, 5.8, 0, Math.PI * 2);
                    ctx.fill();

                    ctx.restore();

                    if (this.state === 'fleeing') {
                        ctx.fillStyle = '#fef08a';
                        ctx.font = '900 11px ui-monospace, monospace';
                        ctx.textAlign = 'center';
                        ctx.fillText('!', this.x, this.y - 16);
                    }
                }
            }

            // ============================================================================
            // TACTICAL FACTION AI (INCLUDING GROWN-UP AIRSOFT ADULTS)
            // ============================================================================
            class Enemy {
                constructor(x, y, faction = 'looter', isBoss = false) {
                    this.x = x;
                    this.y = y;
                    this.faction = faction;
                    this.isBoss = isBoss;
                    this.angle = Math2.rand(0, Math.PI * 2);
                    this.lastShot = 0;
                    this.burnTimer = 0;
                    this.burnTick = 0;
                    this.wanderAngle = this.angle;
                    this.wanderTimer = Math2.rand(1, 3);

                    this.isUnarmed = (faction === 'unarmed_looter');
                    this.isSpotter = this.isUnarmed && Math.random() < 0.38;
                    this.spotterWarnTimer = 0;
                    this.spotterCooldown = 0;

                    this.panicState = 'normal';
                    this.panicTimer = 0;
                    this.fleeAngle = 0;
                    this.nearbyAllyDeaths = 0;
                    this.moraleThreshold = isBoss ? 99 : Math2.randInt(2, 3);
                    this.carryingLoot = this.isUnarmed && !this.isSpotter && Math.random() < 0.65;

                    this.lkpX = null;
                    this.lkpY = null;
                    this.lkpTimer = 0;

                    this.hesitationTimer = 0;
                    this.blindTimer = 0;
                    this.blindPanicShotTimer = 0;

                    if (faction === 'airsoft_adult') {
                        this.r = 12.5;
                        this.hp = isBoss ? 140 : 65;
                        this.maxHp = this.hp;
                        this.speed = 148;
                        this.dmg = 16;
                        this.fireDelay = 310;
                        this.sightRange = 510;
                        this.attackRange = 390;
                        this.hesitationRequired = 0.42;
                    } else if (faction === 'dog') {
                        this.r = 9;
                        this.hp = 48;
                        this.maxHp = 48;
                        this.speed = 235;
                        this.dmg = 18;
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
                        this.sightRange = 360;
                        this.attackRange = 0;
                        this.hesitationRequired = 0.6;
                    } else if (faction === 'blockade_goon') {
                        this.r = 12.5;
                        this.hp = isBoss ? 250 : 115;
                        this.maxHp = this.hp;
                        this.speed = 138;
                        this.dmg = 34;
                        this.fireDelay = 340;
                        this.sightRange = 540;
                        this.attackRange = 410;
                        this.hesitationRequired = 0.48;
                    } else if (faction === 'security') {
                        this.r = 12;
                        this.hp = isBoss ? 220 : 110;
                        this.maxHp = this.hp;
                        this.speed = 135;
                        this.dmg = 30;
                        this.fireDelay = 360;
                        this.sightRange = 500;
                        this.attackRange = 370;
                        this.hesitationRequired = 0.52;
                    } else if (faction === 'syndicate') {
                        this.r = isBoss ? 15 : 12;
                        this.hp = isBoss ? 300 : 90;
                        this.maxHp = this.hp;
                        this.speed = isBoss ? 122 : 145;
                        this.dmg = isBoss ? 36 : 26;
                        this.fireDelay = isBoss ? 270 : 440;
                        this.sightRange = 490;
                        this.attackRange = 340;
                        this.hesitationRequired = isBoss ? 0.4 : 0.72;
                    } else {
                        this.r = 11.5;
                        this.hp = 68;
                        this.maxHp = 68;
                        this.speed = 160;
                        this.dmg = 24;
                        this.fireDelay = 580;
                        this.sightRange = 430;
                        this.attackRange = 260;
                        this.hesitationRequired = Math2.rand(0.95, 1.45);
                    }
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
                        this.setLKP(sourceX + Math2.rand(-90, 90), sourceY + Math2.rand(-90, 90), 4.0);
                    }
                    this.blindTimer = Math.max(this.blindTimer, newBlind);
                }

                onHearGunshot(gx, gy) {
                    if (this.hp <= 0 || this.panicState === 'fleeing' || this.panicState === 'wounded_retreat') return;

                    if (this.isUnarmed) {
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

                        if (isAirsoft) {
                            showBanner(this.isBoss ? 'ADULT SQUAD CAPTAIN: "HIT! GOOD SHOT!"' : 'ADULT PLAYER: "HIT! OUT!"', 1300);
                        }

                        for (let i = 0; i < enemies.length; i++) {
                            const other = enemies[i];
                            if (other !== this && other.hp > 0) {
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
                            if (this.faction === 'blockade_goon' && r < 0.25) {
                                pickups.push(new Pickup(this.x, this.y, 'ammo'));
                            } else if (r < 0.35) {
                                pickups.push(new Pickup(this.x, this.y, 'cash'));
                            } else if (r < 0.52) {
                                pickups.push(new Pickup(this.x, this.y, Math.random() < 0.5 ? 'food' : 'water'));
                            }
                        } else if (Math.random() < 0.32) {
                            const dropType = (mission && mission.campaign === 'cbd' && Math.random() < 0.45)
                                ? 'fuel'
                                : (Math.random() < 0.55 ? 'ammo' : 'health');
                            pickups.push(new Pickup(this.x, this.y, dropType));
                        }
                    } else if (!isAirsoft) {
                        if (!this.isBoss && this.faction !== 'dog' && this.panicState !== 'fleeing') {
                            const isLooter = (this.faction === 'looter' || this.isUnarmed);
                            const hpRatio = this.hp / this.maxHp;
                            // 120gr +P JHP causes massive flesh trauma -> guaranteed immediate stagger/retreat!
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

                canDetectPlayer() {
                    if (!player || player.hp <= 0) return false;
                    const d = Math2.dist(this.x, this.y, player.x, player.y);
                    if (!hasLoS(this.x, this.y, player.x, player.y)) return false;

                    const angToPlayer = Math2.angle(this.x, this.y, player.x, player.y);
                    const viewDiff = Math2.angleDiff(this.angle, angToPlayer);
                    const inFrontCone = viewDiff <= 1.38;

                    const isDarkMall = (mission && mission.campaign === 'mall' && player.x <= 3610 && this.faction !== 'blockade_goon');
                    if (isDarkMall) {
                        if (player.flashlightOn && !player.vehicle) {
                            if (inFrontCone && d < 470) return true;
                            const beamAng = Math2.angle(player.x, player.y, this.x, this.y);
                            if (d < 450 && Math2.angleDiff(player.angle, beamAng) < 0.38) return true;
                        }
                        if (isPlayerIlluminatedByEnvironment() && inFrontCone && d < 280) {
                            return true;
                        }
                        const isSprinting = (keys['shift'] || touchInput.sprint) && (keys['w'] || keys['a'] || keys['s'] || keys['d'] || Math.hypot(touchInput.moveX, touchInput.moveY) > 0.2);
                        if (isSprinting && d < 195) {
                            return true;
                        }
                        const shadowRadius = inFrontCone ? 92 : 52;
                        return d < shadowRadius;
                    }

                    if (inFrontCone && d < this.sightRange) return true;
                    return d < 125;
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

                    // Also check friendly youth allies (Younger G & Younger Blaze) in Training stage!
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
                        if (other.faction === this.faction) continue;
                        if ((this.faction === 'syndicate' && other.faction === 'dog') || (this.faction === 'dog' && other.faction === 'syndicate')) continue;
                        if ((this.faction === 'blockade_goon' && other.faction === 'looter') || (this.faction === 'looter' && other.faction === 'blockade_goon')) continue;

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

                    if (this.spotterCooldown > 0) this.spotterCooldown -= dt;

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

                        if (!this.isUnarmed && this.faction !== 'dog' && this.blindTimer > 0.7) {
                            this.blindPanicShotTimer += dt;
                            if (this.blindPanicShotTimer > 0.65 && Math.random() < 0.04) {
                                this.blindPanicShotTimer = 0;
                                const isAirsoft = (this.faction === 'airsoft_adult');
                                const isRifle = (this.faction === 'security' || this.faction === 'blockade_goon');
                                sfx.playGunshot(isAirsoft ? 'airsoft_aeg' : (isRifle ? 'ak47' : 'glock'));
                                const mx = this.x + Math.cos(this.angle) * 18;
                                const my = this.y + Math.sin(this.angle) * 18;
                                bullets.push(new Bullet(mx, my, this.angle + Math2.rand(-0.72, 0.72), isAirsoft ? 2450 : 3400, this.dmg, 'enemy', this, false, isAirsoft, false));
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

                        if (Math.random() < 0.14 && decals.length < 520) {
                            decals.push(new Decal(this.x, this.y, 'blood', Math2.rand(0, Math.PI * 2), 4));
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
                                if (player) {
                                    broadcastGunshot(player.x, player.y, 580, true);
                                    if (mission && mission.campaign === 'mall') {
                                        showBanner('LOOTER SPOTTER RAISED THE ALARM! RELOCATE IN THE DARK!', 2100);
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
                                this.angle = Math2.angle(this.x, this.y, player.x, player.y);
                                return;
                            } else {
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

                        const desiredAngle = Math2.angle(this.x, this.y, target.x, target.y);
                        this.angle = desiredAngle;
                        const d = Math2.dist(this.x, this.y, target.x, target.y);

                        let effectiveHesitation = this.hesitationRequired;
                        if (target === player && (this.faction === 'looter' || this.faction === 'syndicate')) {
                            const pAimDiff = Math2.angleDiff(player.angle, Math2.angle(player.x, player.y, this.x, this.y));
                            if (pAimDiff < 0.25) effectiveHesitation += 0.32;
                        }

                        this.hesitationTimer += dt;

                        if (d > this.attackRange * 0.85) {
                            this.x += Math.cos(this.angle) * this.speed * dt;
                            this.y += Math.sin(this.angle) * this.speed * dt;
                        } else if (this.faction !== 'dog' && d < this.attackRange * 0.45) {
                            this.x -= Math.cos(this.angle) * this.speed * 0.55 * dt;
                            this.y -= Math.sin(this.angle) * this.speed * 0.55 * dt;
                        }

                        if (this.hesitationTimer >= effectiveHesitation && d <= this.attackRange) {
                            const now = performance.now();
                            if (now - this.lastShot >= this.fireDelay) {
                                this.lastShot = now;
                                if (this.faction === 'dog') {
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
                                    const spd = isAirsoft ? 2450 : (isRifle ? 4800 : 3650);
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
                        } else {
                            this.angle += Math.sin(performance.now() * 0.006 + this.x) * 2.4 * dt;
                        }
                    } else {
                        this.hesitationTimer = Math.max(0, this.hesitationTimer - dt);
                        this.wanderTimer -= dt;
                        if (this.wanderTimer <= 0) {
                            this.wanderTimer = Math2.rand(1.5, 4.0);
                            this.wanderAngle += Math2.rand(-1.8, 1.8);
                        }
                        this.angle = this.wanderAngle;
                        this.x += Math.cos(this.angle) * (this.speed * 0.35) * dt;
                        this.y += Math.sin(this.angle) * (this.speed * 0.35) * dt;
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

                draw(ctx) {
                    if (this.hp <= 0) return;
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

                    ctx.fillStyle = 'rgba(0,0,0,0.38)';
                    ctx.beginPath();
                    ctx.ellipse(2, 3, 11, 13.5, 0, 0, Math.PI * 2);
                    ctx.fill();

                    const bodyColors = {
                        airsoft_adult: this.isBoss ? '#3f6212' : '#4d7c0f',
                        unarmed_looter: this.isSpotter ? '#eab308' : '#d97706',
                        looter: '#b45309',
                        blockade_goon: '#991b1b',
                        syndicate: '#15803d',
                        security: '#1d4ed8'
                    };
                    ctx.fillStyle = (this.isBoss && this.faction !== 'airsoft_adult') ? '#7f1d1d' : (bodyColors[this.faction] || '#b45309');
                    ctx.beginPath();
                    ctx.ellipse(-2, 0, 9.5, this.isBoss ? 15.5 : 13, 0, 0, Math.PI * 2);
                    ctx.fill();

                    if (this.blindTimer > 0) {
                        ctx.fillStyle = '#5c3a21';
                        ctx.beginPath(); ctx.arc(6, -4, 3, 0, Math.PI * 2); ctx.fill();
                        ctx.beginPath(); ctx.arc(6, 4, 3, 0, Math.PI * 2); ctx.fill();
                    } else if (this.isUnarmed) {
                        if (this.carryingLoot) {
                            ctx.fillStyle = '#78350f';
                            ctx.fillRect(6, -6, 9, 12);
                        }
                    } else if (this.faction === 'airsoft_adult') {
                        ctx.fillStyle = '#1e293b';
                        ctx.fillRect(5, 3, 18, 3.6);
                        ctx.fillStyle = '#f97316';
                        ctx.fillRect(22, 3.1, 2.5, 3.4); // Orange airsoft muzzle tip
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

                    if (this.faction === 'airsoft_adult') {
                        // Grown-up MilSim boonie hat
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
                    if (this.blindTimer > 0) {
                        ctx.fillStyle = '#e0f2fe';
                        ctx.fillText('BLINDED', this.x, this.y - 19);
                    } else if (this.spotterWarnTimer > 0) {
                        ctx.fillStyle = '#facc15';
                        ctx.fillText('! ALARM !', this.x, this.y - 19);
                    } else if (this.panicState === 'wounded_retreat') {
                        ctx.fillStyle = '#f87171';
                        ctx.fillText('WOUNDED', this.x, this.y - 19);
                    } else if (this.panicState === 'in_cover') {
                        ctx.fillStyle = '#94a3b8';
                        ctx.fillText('COVER', this.x, this.y - 19);
                    } else if (this.panicState === 'fleeing' || this.panicState === 'frozen') {
                        ctx.fillStyle = this.panicState === 'frozen' ? '#38bdf8' : '#facc15';
                        ctx.fillText(this.panicState === 'frozen' ? '?!' : 'FLEE', this.x, this.y - 19);
                    } else if (this.hesitationTimer > 0.08 && this.hesitationTimer < this.hesitationRequired) {
                        ctx.fillStyle = '#fde047';
                        ctx.fillText('?', this.x, this.y - 19);
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
            // PLAYER CONTROLLER (WITH 100GR FMJ vs 120GR JHP, OPTICS & EARBUD TOGGLE)
            // ============================================================================
            class Player {
                constructor(x, y, archetype = 'young_yael') {
                    this.x = x;
                    this.y = y;
                    this.gender = archetype;
                    this.angle = 0;
                    this.speed = (archetype === 'mall' || archetype === 'young_yael') ? 206 : 192;
                    this.r = (archetype === 'mall' || archetype === 'young_yael') ? 10.5 : 12;
                    this.hp = 100;
                    this.armor = archetype === 'young_yael' ? 25 : (archetype === 'mall' ? 16 : 28);
                    this.stamina = 100;
                    this.wepIdx = 0;
                    this.lastShot = 0;
                    this.vehicle = null;
                    this.isReloading = false;
                    this.reloadStart = 0;
                    this.portraitFlashTimer = 0;
                    this.hasFlashlight = (archetype === 'mall');
                    this.lightMode = (archetype === 'mall') ? 'steady' : 'off';
                    this.opticsMode = 'standard'; // 'standard' | 'nvg' | 'thermal'
                }

                get flashlightOn() {
                    return this.lightMode !== 'off';
                }

                // Toggle between 100gr FMJ and 120gr +P JHP on Yael's Glock 26
                toggleAmmoLoad() {
                    const wep = WEAPONS[this.wepIdx];
                    if (!wep || wep.id !== 'glock26') {
                        showBanner('AMMO LOAD SELECT: GLOCK 26 ONLY', 1200);
                        return;
                    }
                    if (wep.ammoLoad === 'fmj') {
                        if (wep.jhpReserve <= 0) {
                            showBanner('NO 120GR +P JHP IN STASH YET — CHECK MALL SECURITY OFFICE!', 1800);
                            return;
                        }
                        // Return current FMJ mag rounds to FMJ reserve and swap to 120gr +P JHP
                        wep.fmjReserve += wep.mag;
                        wep.ammoLoad = 'jhp';
                        const loadAmt = Math.min(wep.magMax, wep.jhpReserve);
                        wep.mag = loadAmt;
                        wep.jhpReserve -= loadAmt;
                        wep.reserve = wep.jhpReserve;
                        sfx.playReload();
                        showBanner('LOADED: 120GR +P JHP (HIGH STOPPING POWER • BRIGHT FLASH • LOUD)', 2100);
                    } else {
                        wep.jhpReserve += wep.mag;
                        wep.ammoLoad = 'fmj';
                        const loadAmt = Math.min(wep.magMax, wep.fmjReserve);
                        wep.mag = loadAmt;
                        wep.fmjReserve -= loadAmt;
                        wep.reserve = wep.fmjReserve;
                        sfx.playReload();
                        showBanner('LOADED: 100GR FMJ BALL (LOW FLASH • LOWER RECOIL)', 1800);
                    }
                    updateHUD();
                }

                cycleOptics() {
                    const order = ['standard', 'nvg', 'thermal'];
                    const nextIdx = (order.indexOf(this.opticsMode) + 1) % order.length;
                    this.opticsMode = order[nextIdx];
                    sfx.playOpticsWhine();
                    if (this.opticsMode === 'nvg') {
                        showBanner('OPTICS: NIGHT VISION [NVG] + INVISIBLE IR LASER ACTIVE', 1700);
                    } else if (this.opticsMode === 'thermal') {
                        showBanner('OPTICS: THERMAL IMAGING [FLIR] + INVISIBLE IR LASER ACTIVE', 1700);
                    } else {
                        showBanner('OPTICS: STANDARD VISION (IR LASER OFF)', 1400);
                    }
                    updateHUD();
                }

                toggleFlashlight() {
                    if (!this.hasFlashlight) {
                        showBanner('NO TACTICAL LIGHT ATTACHED', 1200);
                        return;
                    }
                    this.lightMode = (this.lightMode === 'off') ? 'steady' : 'off';
                    sfx.playClick();
                    showBanner(this.lightMode === 'steady' ? 'UNDER-BARREL LIGHT: STEADY ON' : 'UNDER-BARREL LIGHT: OFF (STEALTH)', 1200);
                    updateHUD();
                }

                toggleStrobe() {
                    if (!this.hasFlashlight) {
                        showBanner('NO TACTICAL STROBE ATTACHED', 1200);
                        return;
                    }
                    this.lightMode = (this.lightMode === 'strobe') ? 'steady' : 'strobe';
                    sfx.playStrobeHum();
                    showBanner(this.lightMode === 'strobe' ? 'TACTICAL STROBE: ACTIVE (DISORIENTING)' : 'UNDER-BARREL LIGHT: STEADY', 1300);
                    updateHUD();
                }

                takeDamage(amount) {
                    if (this.hp <= 0) return;
                    let rem = amount;
                    if (this.armor > 0) {
                        const absorbed = Math.min(this.armor, rem * 0.45);
                        this.armor -= absorbed;
                        rem -= absorbed;
                    }
                    this.hp = Math.max(0, this.hp - rem);
                    this.portraitFlashTimer = 0.28;
                    camera.shake = Math.max(camera.shake, (mission && mission.campaign === 'training') ? 3.5 : 8.5);
                    updateHUD();

                    if (this.hp <= 0) {
                        triggerGameOver(false);
                    }
                }

                reloadWeapon() {
                    const wep = WEAPONS[this.wepIdx];
                    if (wep.id === 'glock26') {
                        wep.reserve = wep.ammoLoad === 'jhp' ? wep.jhpReserve : wep.fmjReserve;
                    }
                    if (this.isReloading || wep.type === 'melee' || wep.mag === wep.magMax || wep.reserve <= 0) return;

                    // Eject current magazine immediately: any unspent rounds left in it are forfeited!
                    const forfeitedRounds = wep.mag;
                    wep.mag = 0;
                    this.isReloading = true;
                    this.reloadStart = performance.now();
                    sfx.playReload();

                    const tossAngle = this.angle - Math.PI / 2 + Math2.rand(-0.4, 0.4);
                    const dropX = this.x + Math.cos(tossAngle) * 10;
                    const dropY = this.y + Math.sin(tossAngle) * 10;
                    droppedMags.push(new DroppedMag(dropX, dropY, tossAngle, wep.id, forfeitedRounds > 0));

                    if (forfeitedRounds > 0 && wep.type !== 'flame') {
                        const unitName = wep.isAirsoft ? 'BBS' : 'UNSPENT ROUNDS';
                        showBanner(`MAG TOSSED — ${forfeitedRounds} ${unitName} FORFEITED`, 1600);
                    }

                    updateHUD();
                }

                toggleVehicle() {
                    if (this.vehicle) {
                        const v = this.vehicle;
                        const exitX = v.x + Math.cos(v.angle - Math.PI / 2) * (v.h * 0.85 + 14);
                        const exitY = v.y + Math.sin(v.angle - Math.PI / 2) * (v.h * 0.85 + 14);
                        this.x = Math2.clamp(exitX, 30, WORLD_SIZE - 30);
                        this.y = Math2.clamp(exitY, 30, WORLD_SIZE - 30);
                        v.driver = null;
                        this.vehicle = null;
                        showBanner('EXITED VEHICLE', 1200);
                        updateHUD();
                        return;
                    }

                    let closest = null;
                    let bestDist = 56;
                    for (let i = 0; i < vehicles.length; i++) {
                        const v = vehicles[i];
                        if (v.destroyed || v.driver || v.lockedBlockade) continue;
                        const d = Math2.dist(this.x, this.y, v.x, v.y);
                        if (d < bestDist) {
                            bestDist = d;
                            closest = v;
                        }
                    }

                    if (closest) {
                        closest.driver = this;
                        this.vehicle = closest;
                        this.isReloading = false;
                        sfx.playHorn();
                        const label = closest.kind === 'nyala' ? 'ARMORED NYALA' : (closest.kind === 'taxi' ? 'MINIBUS TAXI' : closest.kind.toUpperCase());
                        showBanner(`DRIVING: ${label} [SPACE: HANDBRAKE • H: HORN]`, 2200);
                        updateHUD();
                    }
                }

                update(dt) {
                    if (this.hp <= 0) return;

                    if (this.portraitFlashTimer > 0) {
                        this.portraitFlashTimer -= dt;
                        const frame = document.getElementById('portraitFrame');
                        if (frame) frame.style.borderColor = this.portraitFlashTimer > 0 ? '#ef4444' : '#475569';
                    }

                    if (this.vehicle) return;

                    let mx = 0;
                    let my = 0;
                    if (keys['w'] || keys['arrowup']) my -= 1;
                    if (keys['s'] || keys['arrowdown']) my += 1;
                    if (keys['a'] || keys['arrowleft']) mx -= 1;
                    if (keys['d'] || keys['arrowright']) mx += 1;

                    if (Math.abs(touchInput.moveX) > 0.12 || Math.abs(touchInput.moveY) > 0.12) {
                        mx += touchInput.moveX;
                        my += touchInput.moveY;
                    }

                    const isMoving = Math.hypot(mx, my) > 0.08;

                    if (isMobileDevice) {
                        if (touchInput.aimActive) {
                            this.angle = touchInput.aimAngle;
                        } else if (isMoving) {
                            this.angle = Math.atan2(my, mx);
                        }
                    } else {
                        this.angle = Math2.angle(this.x, this.y, mouse.worldX, mouse.worldY);
                    }

                    const sprinting = isMoving && (keys['shift'] || touchInput.sprint) && this.stamina > 2;

                    if (sprinting) {
                        this.stamina = Math.max(0, this.stamina - 34 * dt);
                    } else {
                        this.stamina = Math.min(100, this.stamina + 22 * dt);
                    }

                    if (isMoving) {
                        const len = Math.max(1, Math.hypot(mx, my));
                        const moveSpeed = this.speed * (sprinting ? 1.52 : 1.0);
                        this.x += (mx / len) * moveSpeed * dt;
                        this.y += (my / len) * moveSpeed * dt;
                    }

                    this.x = Math2.clamp(this.x, 25, WORLD_SIZE - 25);
                    this.y = Math2.clamp(this.y, 25, WORLD_SIZE - 25);

                    for (let i = 0; i < buildings.length; i++) {
                        circleRectResolve(this, buildings[i]);
                    }
                    for (let i = 0; i < woodlandTrees.length; i++) {
                        const tr = woodlandTrees[i];
                        circleRectResolve(this, { x: tr.x - tr.trunkR, y: tr.y - tr.trunkR, w: tr.trunkR * 2, h: tr.trunkR * 2 });
                    }

                    if (this.lightMode === 'strobe') {
                        const isDarkAmbient = (mission && mission.campaign === 'mall' && this.x <= 3610);
                        const strobeRange = isDarkAmbient ? 430 : 240;
                        for (let i = 0; i < enemies.length; i++) {
                            const e = enemies[i];
                            if (e.hp <= 0) continue;
                            const d = Math2.dist(this.x, this.y, e.x, e.y);
                            if (d <= strobeRange) {
                                const angToEnemy = Math2.angle(this.x, this.y, e.x, e.y);
                                if (Math2.angleDiff(this.angle, angToEnemy) <= 0.35 && hasLoS(this.x, this.y, e.x, e.y)) {
                                    e.applyStrobeDaze(this.x, this.y, isDarkAmbient);
                                }
                            }
                        }
                    }

                    const wep = WEAPONS[this.wepIdx];
                    if (this.isReloading) {
                        const elapsed = performance.now() - this.reloadStart;
                        if (elapsed >= wep.reloadTime) {
                            if (wep.id === 'glock26') {
                                const pool = wep.ammoLoad === 'jhp' ? wep.jhpReserve : wep.fmjReserve;
                                const loadAmount = Math.min(wep.magMax, pool);
                                wep.mag = loadAmount;
                                if (wep.ammoLoad === 'jhp') {
                                    wep.jhpReserve -= loadAmount;
                                    wep.reserve = wep.jhpReserve;
                                } else {
                                    wep.fmjReserve -= loadAmount;
                                    wep.reserve = wep.fmjReserve;
                                }
                            } else {
                                const loadAmount = Math.min(wep.magMax, wep.reserve);
                                wep.mag = loadAmount;
                                wep.reserve -= loadAmount;
                            }
                            this.isReloading = false;
                            updateHUD();
                        }
                    }

                    const isFiringHeld = mouse.down || touchInput.firing;
                    const isFiringTap = mouse.justClicked || touchInput.justFired;

                    if (!this.isReloading) {
                        if ((wep.type === 'auto' || wep.type === 'flame') && isFiringHeld) {
                            this.fireWeapon();
                        } else if ((wep.type === 'semi' || wep.type === 'bolt' || wep.type === 'melee') && (isFiringTap || touchInput.firing)) {
                            this.fireWeapon();
                        }
                    }

                    let nearVeh = false;
                    for (let i = 0; i < vehicles.length; i++) {
                        const v = vehicles[i];
                        if (!v.destroyed && !v.driver && !v.lockedBlockade && Math2.dist(this.x, this.y, v.x, v.y) < 54) {
                            nearVeh = true;
                            break;
                        }
                    }
                    const banner = document.getElementById('promptBanner');
                    const enterPrompt = isMobileDevice ? 'TAP [CAR] TO ENTER VEHICLE' : 'PRESS [E] TO ENTER VEHICLE';
                    if (nearVeh && !banner.classList.contains('visible')) {
                        banner.innerText = enterPrompt;
                        banner.classList.add('visible');
                    } else if (!nearVeh && (banner.innerText === 'PRESS [E] TO ENTER VEHICLE' || banner.innerText === 'TAP [CAR] TO ENTER VEHICLE')) {
                        banner.classList.remove('visible');
                    }
                }

                fireWeapon() {
                    const now = performance.now();
                    const wep = WEAPONS[this.wepIdx];
                    if (now - this.lastShot < wep.delay) return;

                    if (wep.type === 'melee') {
                        this.lastShot = now;
                        sfx.playMelee();
                        camera.shake = Math.max(camera.shake, 2.5);
                        for (let i = 0; i < enemies.length; i++) {
                            const e = enemies[i];
                            if (e.hp <= 0) continue;
                            const d = Math2.dist(this.x, this.y, e.x, e.y);
                            if (d <= wep.range + e.r) {
                                const angDiff = Math2.angleDiff(Math2.angle(this.x, this.y, e.x, e.y), this.angle);
                                if (angDiff < 0.95) {
                                    e.takeDamage(wep.dmg, this.angle, false, false);
                                }
                            }
                        }
                        return;
                    }

                    if (wep.id === 'glock26') {
                        wep.reserve = wep.ammoLoad === 'jhp' ? wep.jhpReserve : wep.fmjReserve;
                    }

                    if (wep.mag <= 0) {
                        if (wep.reserve > 0) {
                            this.reloadWeapon();
                        } else {
                            sfx.playClick();
                            this.lastShot = now;
                            showBanner('OUT OF AMMO — SWITCH TO BLADE [2] OR SCAVENGE!', 1500);
                        }
                        return;
                    }

                    this.lastShot = now;
                    wep.mag--;

                    const isJHP = (wep.id === 'glock26' && wep.ammoLoad === 'jhp');
                    const effectiveRecoil = isJHP ? 5.5 : wep.recoil;
                    const effectiveDmg = isJHP ? 68 : wep.dmg;
                    const effectiveSpeed = isJHP ? 3850 : wep.bulletSpeed;
                    const alertRadius = wep.isAirsoft ? 320 : (isJHP ? 880 : 560);

                    camera.shake = Math.max(camera.shake, effectiveRecoil);

                    if (wep.type === 'flame') {
                        sfx.playFlamethrower();
                        const nozzleX = this.x + Math.cos(this.angle) * 28;
                        const nozzleY = this.y + Math.sin(this.angle) * 28;
                        for (let j = 0; j < 2; j++) {
                            const spreadAngle = this.angle + Math2.rand(-wep.spread, wep.spread);
                            flameJets.push(new FlameJet(nozzleX, nozzleY, spreadAngle, wep.bulletSpeed * Math2.rand(0.88, 1.12), wep.dmg, 'player', this));
                        }
                        if (wep.mag === 0 && wep.reserve > 0) {
                            this.reloadWeapon();
                        }
                        updateHUD();
                        return;
                    }

                    sfx.playGunshot(isJHP ? 'glock26_jhp' : wep.id);
                    broadcastGunshot(this.x, this.y, alertRadius, false);

                    const barrelDist = (wep.id === 'glock' || wep.id === 'glock26' || wep.id === 'airsoft_pistol') ? 20 : (wep.id === 'ruger' ? 36 : 28);
                    const muzzleX = this.x + Math.cos(this.angle) * barrelDist;
                    const muzzleY = this.y + Math.sin(this.angle) * barrelDist;

                    const pellets = wep.pellets || 1;
                    for (let p = 0; p < pellets; p++) {
                        const spreadAngle = this.angle + Math2.rand(-wep.spread, wep.spread);
                        bullets.push(new Bullet(muzzleX, muzzleY, spreadAngle, effectiveSpeed, effectiveDmg, 'player', this, !!wep.pierce, !!wep.isAirsoft, isJHP));
                    }

                    if (!wep.isAirsoft) {
                        if (wep.type === 'bolt') {
                            const shotAng = this.angle;
                            setTimeout(() => {
                                if (this.hp > 0 && gameState === 'playing') {
                                    sfx.playBoltCycle();
                                    const ex = this.x + Math.cos(shotAng) * 12;
                                    const ey = this.y + Math.sin(shotAng) * 12;
                                    shells.push(new Shell(ex, ey, shotAng + Math.PI / 2 + Math2.rand(-0.25, 0.25)));
                                }
                            }, 460);
                        } else {
                            const ejectX = this.x + Math.cos(this.angle) * 10;
                            const ejectY = this.y + Math.sin(this.angle) * 10;
                            shells.push(new Shell(ejectX, ejectY, this.angle + Math.PI / 2 + Math2.rand(-0.35, 0.35)));
                        }
                    }

                    if (wep.mag === 0 && wep.reserve > 0) {
                        this.reloadWeapon();
                    }
                    updateHUD();
                }

                draw(ctx) {
                    if (this.hp <= 0 || this.vehicle) return;

                    const wep = WEAPONS[this.wepIdx];
                    const isYoungYael = this.gender === 'young_yael';
                    const isMall = this.gender === 'mall';
                    const isFemale = this.gender === 'female';
                    const isSniper = this.gender === 'sniper';
                    const skinTone = (isMall || isYoungYael) ? '#d6986a' : (isFemale ? '#fbd3b0' : '#d4a373');
                    const hasFlamer = WEAPONS.some((w) => w.id === 'flamethrower' && w.unlocked);

                    ctx.save();
                    ctx.translate(this.x, this.y);
                    ctx.rotate(this.angle);

                    ctx.fillStyle = 'rgba(0, 0, 0, 0.42)';
                    ctx.beginPath();
                    ctx.ellipse(2, 3, (isMall || isYoungYael) ? 10.5 : 12, (isMall || isYoungYael) ? 12 : (isFemale ? 13.5 : 15), 0, 0, Math.PI * 2);
                    ctx.fill();

                    if (hasFlamer) {
                        ctx.fillStyle = '#c2410c';
                        ctx.fillRect(-13, -7, 7, 14);
                        ctx.strokeStyle = '#facc15';
                        ctx.lineWidth = 1.2;
                        ctx.strokeRect(-12, -5, 5, 10);
                    }

                    ctx.fillStyle = isYoungYael ? '#3f6212' : (isMall ? '#1e293b' : (isSniper ? '#365314' : (isFemale ? '#18181b' : '#1e293b')));
                    ctx.beginPath();
                    ctx.ellipse(-2, 0, (isMall || isYoungYael) ? 8.5 : 9.5, (isMall || isYoungYael) ? 11.2 : (isFemale ? 12.5 : 14), 0, 0, Math.PI * 2);
                    ctx.fill();

                    ctx.fillStyle = skinTone;
                    if (wep.type === 'melee') {
                        const swing = Math.max(0, 1 - (performance.now() - this.lastShot) / 220);
                        ctx.rotate(-swing * 1.1);
                        ctx.beginPath(); ctx.arc(8, -7, 3.0, 0, Math.PI * 2); ctx.fill();
                        ctx.beginPath(); ctx.arc(10, 7, 3.0, 0, Math.PI * 2); ctx.fill();
                        ctx.fillStyle = wep.isAirsoft ? '#f97316' : '#cbd5e1';
                        ctx.fillRect(9, 5.5, 22, 3.2);
                    } else if (wep.type === 'flame') {
                        ctx.beginPath(); ctx.arc(13, -4, 3.1, 0, Math.PI * 2); ctx.fill();
                        ctx.beginPath(); ctx.arc(8, 5, 3.1, 0, Math.PI * 2); ctx.fill();

                        ctx.strokeStyle = '#334155';
                        ctx.lineWidth = 2;
                        ctx.beginPath();
                        ctx.moveTo(-9, 6);
                        ctx.quadraticCurveTo(0, 11, 8, 6);
                        ctx.stroke();

                        ctx.fillStyle = '#3f3f46';
                        ctx.fillRect(4, 2, 20, 5);
                        ctx.fillStyle = '#eab308';
                        ctx.fillRect(22, 1.5, 5, 6);

                        ctx.fillStyle = '#fb923c';
                        ctx.beginPath();
                        ctx.arc(29, 4.5, 3 + Math.sin(performance.now() * 0.04) * 1.2, 0, Math.PI * 2);
                        ctx.fill();
                    } else if (wep.id === 'glock26' || wep.id === 'airsoft_pistol') {
                        ctx.beginPath(); ctx.arc(11, -2.5, 2.8, 0, Math.PI * 2); ctx.fill();
                        ctx.beginPath(); ctx.arc(9, 5.5, 2.8, 0, Math.PI * 2); ctx.fill();

                        ctx.fillStyle = '#ec4899';
                        ctx.fillRect(5, 2.2, 11, 4.6);
                        ctx.fillStyle = '#0f172a';
                        ctx.fillRect(5, 2.8, 12, 3.4);
                        if (wep.id === 'airsoft_pistol') {
                            ctx.fillStyle = '#f97316';
                            ctx.fillRect(16.5, 3.0, 2.2, 3.0);
                        } else {
                            ctx.fillStyle = '#ef4444';
                            ctx.fillRect(7.5, 4.0, 2.2, 1.2);
                            ctx.fillStyle = '#94a3b8';
                            ctx.fillRect(14, 2.6, 4.5, 2.4);
                        }
                        if (this.flashlightOn) {
                            const strobeOn = this.lightMode !== 'strobe' || (Math.sin(performance.now() * 0.105) > 0);
                            if (strobeOn) {
                                ctx.fillStyle = this.lightMode === 'strobe' ? '#e0f2fe' : '#fef9c3';
                                ctx.beginPath();
                                ctx.arc(19.2, 3.8, this.lightMode === 'strobe' ? 3.2 : 2.1, 0, Math.PI * 2);
                                ctx.fill();
                            }
                        }
                    } else {
                        ctx.beginPath(); ctx.arc(13, -3, 3.2, 0, Math.PI * 2); ctx.fill();
                        ctx.beginPath(); ctx.arc(8, 5, 3.2, 0, Math.PI * 2); ctx.fill();

                        ctx.fillStyle = wep.color;
                        const barrelLen = wep.id === 'glock' ? 13 : (wep.id === 'ruger' ? 30 : 22);
                        ctx.fillRect(5, 3, barrelLen, 4);

                        if (wep.isAirsoft) {
                            ctx.fillStyle = '#f97316';
                            ctx.fillRect(5 + barrelLen - 1, 3.1, 2.5, 3.8);
                        }

                        if (wep.id === 'ruger') {
                            ctx.fillStyle = '#090d16';
                            ctx.fillRect(9, 2.3, 13, 5.4);
                            ctx.strokeStyle = (mouse.rightDown || touchInput.scopeActive) ? 'rgba(239, 68, 68, 0.38)' : 'rgba(239, 68, 68, 0.14)';
                            ctx.lineWidth = 1;
                            ctx.beginPath();
                            ctx.moveTo(35, 5);
                            ctx.lineTo(680, 5);
                            ctx.stroke();
                        }
                    }

                    // Muzzle Flash (Larger +P fireball when firing 120gr JHP!)
                    if (wep.type !== 'melee' && wep.type !== 'flame' && !wep.isAirsoft && performance.now() - this.lastShot < 52) {
                        const isJHP = (wep.id === 'glock26' && wep.ammoLoad === 'jhp');
                        const barrelLen = (wep.id === 'glock' || wep.id === 'glock26') ? 13 : (wep.id === 'ruger' ? 30 : 22);
                        const tip = 5 + barrelLen;
                        const flashRad = isJHP ? 66 : 36;
                        const glow = ctx.createRadialGradient(tip + 8, 5, 1, tip + 8, 5, flashRad);
                        glow.addColorStop(0, 'rgba(255, 255, 255, 0.98)');
                        glow.addColorStop(0.42, isJHP ? 'rgba(251, 146, 60, 0.65)' : 'rgba(250, 204, 21, 0.45)');
                        glow.addColorStop(1, 'rgba(250, 204, 21, 0)');
                        ctx.fillStyle = glow;
                        ctx.beginPath();
                        ctx.arc(tip + 8, 5, flashRad, 0, Math.PI * 2);
                        ctx.fill();

                        const flameReach = isJHP ? 34 : 22;
                        ctx.fillStyle = isJHP ? '#fed7aa' : '#fef9c3';
                        ctx.beginPath();
                        ctx.moveTo(tip, 3);
                        ctx.lineTo(tip + flameReach * 0.65, isJHP ? -4 : -2);
                        ctx.lineTo(tip + flameReach, 5);
                        ctx.lineTo(tip + flameReach * 0.65, isJHP ? 14 : 12);
                        ctx.lineTo(tip, 7);
                        ctx.closePath();
                        ctx.fill();
                    }

                    // Head
                    ctx.fillStyle = skinTone;
                    ctx.beginPath();
                    ctx.arc(0, 0, (isMall || isYoungYael) ? 6.0 : 6.8, 0, Math.PI * 2);
                    ctx.fill();

                    if (isYoungYael) {
                        // Black hair + sporty ponytail + protective clear airsoft goggles
                        ctx.fillStyle = '#090d16';
                        ctx.beginPath();
                        ctx.arc(-1.2, 0, 6.5, Math.PI * 0.38, Math.PI * 1.62);
                        ctx.fill();
                        const sway = Math.sin(performance.now() * 0.012) * 1.8;
                        ctx.beginPath();
                        ctx.arc(-9.5, sway, 3.6, 0, Math.PI * 2);
                        ctx.fill();

                        // Clear airsoft goggles
                        ctx.fillStyle = 'rgba(186, 230, 253, 0.55)';
                        ctx.fillRect(4.2, -4.8, 2.4, 9.6);

                        if (sfx.musicEnabled) {
                            ctx.fillStyle = '#ffffff';
                            ctx.fillRect(-1.2, 5.2, 2.2, 2.0);
                        }
                    } else if (isMall) {
                        ctx.fillStyle = '#090d16';
                        ctx.beginPath();
                        ctx.arc(-1.2, 0, 6.5, Math.PI * 0.38, Math.PI * 1.62);
                        ctx.fill();
                        if (sfx.musicEnabled) {
                            ctx.fillStyle = '#ffffff';
                            ctx.fillRect(-1.2, 5.2, 2.2, 2.0);
                        }
                    } else if (isSniper) {
                        ctx.fillStyle = '#4d7c0f';
                        ctx.beginPath();
                        ctx.arc(-0.5, 0, 9.2, 0, Math.PI * 2);
                        ctx.fill();
                        ctx.fillStyle = '#365314';
                        ctx.beginPath();
                        ctx.arc(-0.5, 0, 6.2, 0, Math.PI * 2);
                        ctx.fill();
                        if (sfx.musicEnabled) {
                            ctx.fillStyle = '#ffffff';
                            ctx.fillRect(-1.5, -7.8, 2.5, 2.2);
                            ctx.fillRect(-1.5, 5.6, 2.5, 2.2);
                        }
                    } else if (isFemale) {
                        ctx.fillStyle = '#ea580c';
                        ctx.beginPath();
                        ctx.arc(-1, 0, 7.3, Math.PI * 0.42, Math.PI * 1.58);
                        ctx.fill();

                        const sway = Math.sin(performance.now() * 0.012) * 2.2;
                        ctx.fillStyle = '#c2410c';
                        ctx.beginPath();
                        ctx.moveTo(-6, -2);
                        ctx.quadraticCurveTo(-15, sway - 3, -19, sway);
                        ctx.quadraticCurveTo(-15, sway + 4, -6, 2);
                        ctx.closePath();
                        ctx.fill();

                        if (sfx.musicEnabled) {
                            ctx.fillStyle = '#ffffff';
                            ctx.fillRect(-1.5, -7.8, 2.5, 2.2);
                            ctx.fillRect(-1.5, 5.6, 2.5, 2.2);
                        }
                    } else {
                        ctx.fillStyle = '#cbd5e1';
                        ctx.beginPath();
                        ctx.arc(-1, 0, 7.2, Math.PI * 0.52, Math.PI * 1.48);
                        ctx.fill();

                        if (sfx.musicEnabled) {
                            ctx.fillStyle = '#ffffff';
                            ctx.fillRect(-1.5, -7.8, 2.5, 2.2);
                            ctx.fillRect(-1.5, 5.6, 2.5, 2.2);
                        }
                    }

                    // Render Tactical NVG / FLIR Goggles mounted over eyes when active
                    if (this.opticsMode !== 'standard') {
                        const goggleColor = this.opticsMode === 'nvg' ? '#4ade80' : '#fb923c';
                        ctx.fillStyle = '#090d16';
                        ctx.fillRect(4.5, -5.2, 3.8, 10.4);
                        ctx.fillStyle = goggleColor;
                        ctx.fillRect(6.5, -4.2, 2.5, 3.2);
                        ctx.fillRect(6.5, 1.0, 2.5, 3.2);
                    }

                    ctx.restore();
                }
            }

            // ============================================================================
            // WORLD GENERATION (WOODLAND AIRSOFT, MALL, SUBURBS, CBD, SNIPER)
            // ============================================================================
            function resetWorldArrays() {
                radarTerrainDirty = true; // New chapter generates a different static minimap.
                buildings = [];
                roads = [];
                crosswalks = [];
                railTracks = [];
                woodlandTrees = [];
                woodlandCreek = null;
                mallZones = [];
                mallLights = [];
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
            }

            function generateWoodlandWorld() {
                resetWorldArrays();

                // Winding Woodland Creek running NW to SE across the middle of the forest
                woodlandCreek = [
                    { x: 0, y: 1250 },
                    { x: 1100, y: 1680 },
                    { x: 2200, y: 2200 },
                    { x: 3250, y: 2780 },
                    { x: WORLD_SIZE, y: 3150 }
                ];

                // Youth Squad Staging Camp (South-West)
                buildings.push({ x: 640, y: 3360, w: 220, h: 130, color: '#3f2e21', roof: '#5c4033', height: 14, label: 'YOUTH SQUAD STAGING' });
                buildings.push({ x: 620, y: 3320, w: 110, h: 14, color: '#78350f', roof: '#92400e', isLowWall: true });
                buildings.push({ x: 770, y: 3320, w: 110, h: 14, color: '#78350f', roof: '#92400e', isLowWall: true });
                pickups.push(new Pickup(710, 3290, 'bb_bag'));
                pickups.push(new Pickup(810, 3290, 'armor'));

                // Timber Footbridge & Mid-Forest Pallet Bunker Outpost (Center)
                buildings.push({ x: 2080, y: 2090, w: 240, h: 180, color: '#451a03', roof: '#78350f', height: 12, label: 'TIMBER CREEK BRIDGE' });
                buildings.push({ x: 1940, y: 2340, w: 110, h: 18, color: '#78350f', roof: '#b45309', isLowWall: true });
                buildings.push({ x: 2330, y: 1980, w: 110, h: 18, color: '#78350f', roof: '#b45309', isLowWall: true });
                pickups.push(new Pickup(2200, 2050, 'airsoft_aeg'));
                pickups.push(new Pickup(2140, 2050, 'bb_bag'));
                pickups.push(new Pickup(2260, 2050, 'health'));

                // Sandbag Ridge Strongpoint (North-Center)
                buildings.push({ x: 2740, y: 1420, w: 140, h: 20, color: '#713f12', roof: '#a16207', isLowWall: true });
                buildings.push({ x: 2960, y: 1520, w: 140, h: 20, color: '#713f12', roof: '#a16207', isLowWall: true });
                pickups.push(new Pickup(2880, 1470, 'bb_bag'));
                pickups.push(new Pickup(2940, 1470, 'armor'));

                // Grown-Up MilSim Adults' Base Camp & Capture Flag (North-East)
                buildings.push({ x: 3420, y: 740, w: 320, h: 210, color: '#1e293b', roof: '#334155', height: 18, label: 'ADULT MILSIM HQ CAMP' });
                buildings.push({ x: 3340, y: 990, w: 160, h: 18, color: '#3f6212', roof: '#4d7c0f', isLowWall: true });
                buildings.push({ x: 3580, y: 990, w: 160, h: 18, color: '#3f6212', roof: '#4d7c0f', isLowWall: true });
                pickups.push(new Pickup(3540, 1040, 'health'));

                // Scattered Wooden Pallet Bunkers across the Forest
                const bunkers = [
                    [1180, 2940, 110, 18], [1420, 2760, 18, 110],
                    [1650, 2580, 120, 18], [1540, 1980, 110, 18],
                    [2540, 1780, 18, 120], [3120, 1220, 120, 18]
                ];
                for (let i = 0; i < bunkers.length; i++) {
                    const bk = bunkers[i];
                    buildings.push({ x: bk[0], y: bk[1], w: bk[2], h: bk[3], color: '#78350f', roof: '#92400e', isLowWall: true });
                }

                // Dense Woodland Pine & Acacia Trees (Provide real cover + bullet stops!)
                for (let i = 0; i < 165; i++) {
                    const tx = Math2.rand(180, WORLD_SIZE - 180);
                    const ty = Math2.rand(180, WORLD_SIZE - 180);
                    // Keep staging camps, bridge, and main sightlines clear
                    if (Math2.dist(tx, ty, 780, 3260) < 280) continue;
                    if (Math2.dist(tx, ty, 2200, 2180) < 260) continue;
                    if (Math2.dist(tx, ty, 3550, 920) < 300) continue;
                    if (pointInsideBuilding(tx, ty, 45)) continue;

                    woodlandTrees.push({
                        x: tx,
                        y: ty,
                        trunkR: Math2.rand(10, 16),
                        canopyR: Math2.rand(36, 58),
                        shade: i % 3 === 0 ? '#14532d' : (i % 3 === 1 ? '#166534' : '#15803d')
                    });
                }

                // Extra woodland supply drops
                for (let i = 0; i < 12; i++) {
                    let px = 0;
                    let py = 0;
                    do {
                        px = Math2.rand(350, WORLD_SIZE - 350);
                        py = Math2.rand(350, WORLD_SIZE - 350);
                    } while (pointInsideBuilding(px, py, 30));
                    pickups.push(new Pickup(px, py, i % 2 === 0 ? 'bb_bag' : 'health'));
                }
            }

            function generateMallWorld() {
                resetWorldArrays();

                roads.push({ x: 3740, y: 0, w: 380, h: WORLD_SIZE, dir: 'v' });
                roads.push({ x: 3650, y: 1920, w: 750, h: 260, dir: 'h' });

                mallZones.push({ x: 450, y: 450, w: 3200, h: 3100, floor: '#1e2430', tile: true });
                mallZones.push({ x: 520, y: 2480, w: 780, h: 960, floor: '#261b1c', label: 'GOLDEN DRAGON DISCOUNT SHOP' });
                mallZones.push({ x: 1580, y: 1580, w: 940, h: 840, floor: '#232b38', label: 'CENTRAL ATRIUM FOOD COURT' });
                mallZones.push({ x: 1580, y: 540, w: 1120, h: 760, floor: '#1b222e', label: 'NORTH CONCOURSE & SUPERSTORE' });
                mallZones.push({ x: 2740, y: 1760, w: 910, h: 580, floor: '#252d3b', label: 'EAST ENTRANCE CONCOURSE' });

                buildings.push({ x: 450, y: 450, w: 1590, h: 42, color: '#1e293b', roof: '#334155', height: 20 });
                buildings.push({ x: 2240, y: 450, w: 1410, h: 42, color: '#1e293b', roof: '#334155', height: 20 });
                buildings.push({ x: 450, y: 3508, w: 3200, h: 42, color: '#1e293b', roof: '#334155', height: 20 });
                buildings.push({ x: 450, y: 450, w: 42, h: 3100, color: '#1e293b', roof: '#334155', height: 20 });
                buildings.push({ x: 3608, y: 450, w: 42, h: 1430, color: '#1e293b', roof: '#334155', height: 20 });
                buildings.push({ x: 3608, y: 2220, w: 42, h: 1330, color: '#1e293b', roof: '#334155', height: 20 });

                buildings.push({ x: 1290, y: 2680, w: 28, h: 770, color: '#3f1d24', roof: '#581c2c', height: 14 });
                buildings.push({ x: 520, y: 2480, w: 540, h: 28, color: '#3f1d24', roof: '#581c2c', height: 14 });
                buildings.push({ x: 640, y: 2940, w: 160, h: 24, color: '#78350f', roof: '#b45309', isLowWall: true });
                buildings.push({ x: 920, y: 2940, w: 160, h: 24, color: '#78350f', roof: '#b45309', isLowWall: true });
                buildings.push({ x: 640, y: 2740, w: 160, h: 24, color: '#78350f', roof: '#b45309', isLowWall: true });
                buildings.push({ x: 920, y: 2740, w: 160, h: 24, color: '#78350f', roof: '#b45309', isLowWall: true });
                buildings.push({ x: 1120, y: 3180, w: 110, h: 32, color: '#991b1b', roof: '#dc2626', isLowWall: true });

                mallLights.push({ x: 780, y: 3060, r: 115, color: 'rgba(239, 68, 68, 0.28)', flicker: true });
                mallLights.push({ x: 1080, y: 2620, r: 110, color: 'rgba(250, 204, 21, 0.22)', flicker: true });
                mallLights.push({ x: 2050, y: 2000, r: 290, color: 'rgba(148, 163, 184, 0.34)', flicker: false });
                mallLights.push({ x: 2140, y: 780, r: 210, color: 'rgba(148, 163, 184, 0.26)', flicker: false });
                mallLights.push({ x: 3420, y: 2050, r: 260, color: 'rgba(253, 224, 71, 0.28)', flicker: true });

                buildings.push({ x: 520, y: 1420, w: 780, h: 420, color: '#1e293b', roof: '#334155', height: 16, label: 'ANCHOR FASHION STORE' });
                buildings.push({ x: 1580, y: 2720, w: 860, h: 460, color: '#1e293b', roof: '#334155', height: 16, label: 'HOMEWARE & APPLIANCES' });
                buildings.push({ x: 2740, y: 2560, w: 640, h: 560, color: '#172554', roof: '#1e3a8a', height: 18, label: 'SECURITY CONTROL OFFICE' });
                buildings.push({ x: 2740, y: 740, w: 640, h: 720, color: '#1f2937', roof: '#374151', height: 18, label: 'HYPERMARKET STORAGE' });
                buildings.push({ x: 720, y: 680, w: 580, h: 480, color: '#27272a', roof: '#3f3f46', height: 16, label: 'CELLULAR & TECH ARCADE' });

                buildings.push({ x: 1820, y: 1820, w: 42, h: 42, color: '#334155', roof: '#475569', height: 16 });
                buildings.push({ x: 2240, y: 1820, w: 42, h: 42, color: '#334155', roof: '#475569', height: 16 });
                buildings.push({ x: 1820, y: 2180, w: 42, h: 42, color: '#334155', roof: '#475569', height: 16 });
                buildings.push({ x: 2240, y: 2180, w: 42, h: 42, color: '#334155', roof: '#475569', height: 16 });

                civilians.push(new Civilian(620, 3260));
                civilians.push(new Civilian(670, 3310));
                civilians.push(new Civilian(860, 3290));
                civilians.push(new Civilian(1010, 3240));
                civilians.push(new Civilian(1680, 2120));
                civilians.push(new Civilian(2180, 1660));

                vehicles.push(new Vehicle(3820, 1840, Math.PI / 2, 'taxi'));
                vehicles.push(new Vehicle(3820, 2260, -Math.PI / 2, 'taxi'));
                vehicles.push(new Vehicle(3940, 2050, Math.PI, 'taxi'));
                vehicles.push(new Vehicle(4190, 1890, Math.PI, 'saps', true));
                vehicles.push(new Vehicle(4190, 2210, Math.PI, 'nyala', true));

                const mallCollectibles = [
                    [1150, 3130, 'cash'], [600, 2840, 'water'], [980, 2650, 'food'],
                    [1440, 3100, 'cash'], [1440, 2600, 'food'], [1440, 2100, 'water'],
                    [1440, 1320, 'cash'], [980, 1280, 'food'], [640, 1980, 'water'],
                    [1920, 1950, 'food'], [2050, 2020, 'water'], [2160, 1920, 'food'],
                    [2020, 1740, 'cash'], [2020, 2280, 'cash'],
                    [1460, 880, 'cash'], [1950, 1040, 'jhp_stash'], [2380, 920, 'water'],
                    [2540, 1180, 'food'], [2540, 1520, 'cash'],
                    [2650, 2820, 'shotgun'], [2650, 2900, 'jhp_stash'], [2650, 2740, 'armor'],
                    [2140, 620, 'ammo'], [3120, 1920, 'cash'], [3240, 2160, 'food']
                ];
                for (let i = 0; i < mallCollectibles.length; i++) {
                    const mc = mallCollectibles[i];
                    pickups.push(new Pickup(mc[0], mc[1], mc[2]));
                }
            }

            function generateSuburbsWorld() {
                resetWorldArrays();

                const roadCoords = [420, 1220, 2100, 2980, 3820];
                for (let i = 0; i < roadCoords.length; i++) {
                    const c = roadCoords[i];
                    roads.push({ x: 0, y: c - 65, w: WORLD_SIZE, h: 130, dir: 'h' });
                    roads.push({ x: c - 65, y: 0, w: 130, h: WORLD_SIZE, dir: 'v' });
                }

                buildings.push({ x: 1850, y: 1820, w: 220, h: 140, color: '#334155', roof: '#475569', height: 14, label: "G'S COMPOUND" });
                buildings.push({ x: 1820, y: 1800, w: 16, h: 250, color: '#475569', roof: '#64748b', isLowWall: true });
                buildings.push({ x: 2074, y: 1800, w: 16, h: 250, color: '#475569', roof: '#64748b', isLowWall: true });
                buildings.push({ x: 1820, y: 2034, w: 100, h: 16, color: '#475569', roof: '#64748b', isLowWall: true });
                buildings.push({ x: 2000, y: 2034, w: 90, h: 16, color: '#475569', roof: '#64748b', isLowWall: true });

                pickups.push(new Pickup(1875, 2005, 'ammo'));
                pickups.push(new Pickup(2035, 2005, 'health'));
                vehicles.push(new Vehicle(2025, 1935, Math.PI / 2, 'bakkie'));

                buildings.push({ x: 2740, y: 1340, w: 460, h: 250, color: '#1e293b', roof: '#334155', height: 22, roofProp: 'skylight', label: 'STRIPPED SHOPPING CENTRE' });
                pickups.push(new Pickup(2970, 1640, 'shotgun'));
                pickups.push(new Pickup(2920, 1640, 'armor'));
                pickups.push(new Pickup(3020, 1640, 'ammo'));

                buildings.push({ x: 2800, y: 3120, w: 380, h: 240, color: '#1e3a8a', roof: '#1d4ed8', height: 20, roofProp: 'helipad', label: 'PRIVATE SECURITY FOB' });
                pickups.push(new Pickup(2990, 3410, 'ar15'));
                pickups.push(new Pickup(2930, 3410, 'health'));
                pickups.push(new Pickup(3050, 3410, 'ammo'));
                vehicles.push(new Vehicle(3240, 3250, Math.PI, 'nyala'));

                buildings.push({ x: 640, y: 640, w: 360, h: 260, color: '#7f1d1d', roof: '#991b1b', height: 24, roofProp: 'hvac', label: 'SUBSTATION #4' });
                pickups.push(new Pickup(820, 950, 'armor'));
                pickups.push(new Pickup(760, 950, 'health'));

                const blockCoords = [
                    [560, 1360, 340, 240], [1360, 560, 320, 260], [2240, 560, 360, 250], [3120, 560, 420, 260],
                    [560, 2240, 320, 280], [1360, 2240, 310, 260], [2240, 2240, 350, 280], [3120, 2240, 400, 270],
                    [560, 3120, 350, 260], [1360, 3120, 330, 250], [2240, 3120, 340, 260], [3960, 1360, 280, 320],
                    [3960, 2240, 280, 320], [1360, 3960, 340, 260], [2240, 3960, 340, 260]
                ];

                const wallPalette = ['#334155', '#292524', '#1f2937', '#3f3f46'];
                const roofPalette = ['#475569', '#44403c', '#374151', '#52525b'];

                for (let i = 0; i < blockCoords.length; i++) {
                    const bc = blockCoords[i];
                    const idx = i % wallPalette.length;
                    buildings.push({
                        x: bc[0],
                        y: bc[1],
                        w: bc[2],
                        h: bc[3],
                        color: wallPalette[idx],
                        roof: roofPalette[idx],
                        height: 15
                    });
                }

                vehicles.push(new Vehicle(2135, 1650, -Math.PI / 2, 'hatchback'));
                vehicles.push(new Vehicle(1650, 2135, 0, 'bakkie'));
                vehicles.push(new Vehicle(2980, 2065, Math.PI, 'taxi'));
                vehicles.push(new Vehicle(1255, 2650, Math.PI / 2, 'hatchback'));

                for (let i = 0; i < 18; i++) {
                    let px = 0;
                    let py = 0;
                    do {
                        px = Math2.rand(200, WORLD_SIZE - 200);
                        py = Math2.rand(200, WORLD_SIZE - 200);
                    } while (pointInsideBuilding(px, py, 24));
                    const pType = i % 3 === 0 ? 'health' : (i % 3 === 1 ? 'ammo' : 'armor');
                    pickups.push(new Pickup(px, py, pType));
                }
            }

            function generateCBDWorld() {
                resetWorldArrays();

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

            function generateSniperWorld() {
                resetWorldArrays();

                const horizRoads = [650, 1750, 2950, 3850];
                const vertRoads = [650, 2150, 3650];
                for (let i = 0; i < horizRoads.length; i++) {
                    roads.push({ x: 0, y: horizRoads[i] - 68, w: WORLD_SIZE, h: 136, dir: 'h' });
                }
                for (let i = 0; i < vertRoads.length; i++) {
                    roads.push({ x: vertRoads[i] - 68, y: 0, w: 136, h: WORLD_SIZE, dir: 'v' });
                }

                const trackYs = [2260, 2330, 2400, 2470];
                for (let i = 0; i < trackYs.length; i++) {
                    railTracks.push({ x: 180, y: trackYs[i], w: WORLD_SIZE - 360 });
                }

                buildings.push({ x: 780, y: 2680, w: 280, h: 170, color: '#334155', roof: '#475569', height: 22, roofProp: 'hvac', label: 'SIGNAL OVERWATCH NEST' });
                buildings.push({ x: 780, y: 2635, w: 120, h: 14, color: '#475569', roof: '#64748b', isLowWall: true });
                buildings.push({ x: 940, y: 2635, w: 120, h: 14, color: '#475569', roof: '#64748b', isLowWall: true });
                pickups.push(new Pickup(840, 2660, 'ammo'));
                pickups.push(new Pickup(1010, 2660, 'armor'));
                vehicles.push(new Vehicle(720, 2780, 0, 'bakkie'));

                const railcars = [
                    { x: 1120, y: 2248, w: 190, h: 24, color: '#7f1d1d', roof: '#991b1b' },
                    { x: 1350, y: 2248, w: 190, h: 24, color: '#1e3a8a', roof: '#1d4ed8' },
                    { x: 1760, y: 2318, w: 210, h: 24, color: '#3f3f46', roof: '#52525b' },
                    { x: 2280, y: 2388, w: 200, h: 24, color: '#78350f', roof: '#92400e' },
                    { x: 2520, y: 2388, w: 200, h: 24, color: '#14532d', roof: '#166534' },
                    { x: 2980, y: 2458, w: 210, h: 24, color: '#1e293b', roof: '#334155' }
                ];
                for (let i = 0; i < railcars.length; i++) {
                    const rc = railcars[i];
                    buildings.push({ x: rc.x, y: rc.y, w: rc.w, h: rc.h, color: rc.color, roof: rc.roof, height: 10 });
                }

                buildings.push({ x: 2680, y: 980, w: 340, h: 210, color: '#1f2937', roof: '#374151', height: 22, roofProp: 'skylight', label: 'CONTAINER TERMINAL' });
                const containers = [
                    [2540, 1250, 140, 34, '#b91c1c', '#dc2626'],
                    [2740, 1320, 150, 34, '#1d4ed8', '#2563eb'],
                    [2950, 1250, 140, 34, '#b45309', '#d97706'],
                    [2620, 1430, 150, 34, '#15803d', '#16a34a'],
                    [2860, 1440, 140, 34, '#334155', '#475569']
                ];
                for (let i = 0; i < containers.length; i++) {
                    const c = containers[i];
                    buildings.push({ x: c[0], y: c[1], w: c[2], h: c[3], color: c[4], roof: c[5], height: 11 });
                }
                pickups.push(new Pickup(2850, 1250, 'ar15'));
                pickups.push(new Pickup(2780, 1250, 'health'));
                pickups.push(new Pickup(2920, 1250, 'ammo'));
                vehicles.push(new Vehicle(2460, 1340, 0, 'bakkie'));

                buildings.push({ x: 2860, y: 3180, w: 380, h: 240, color: '#172554', roof: '#1e3a8a', height: 24, roofProp: 'hvac', label: 'REFINERY FUEL DEPOT' });
                buildings.push({ x: 2700, y: 3220, w: 110, h: 110, color: '#475569', roof: '#94a3b8', height: 18 });
                buildings.push({ x: 2700, y: 3360, w: 110, h: 110, color: '#475569', roof: '#94a3b8', height: 18 });
                pickups.push(new Pickup(3050, 3490, 'shotgun'));
                pickups.push(new Pickup(2970, 3490, 'armor'));
                pickups.push(new Pickup(3130, 3490, 'ammo'));
                vehicles.push(new Vehicle(3320, 3340, Math.PI, 'nyala'));

                buildings.push({ x: 960, y: 900, w: 380, h: 260, color: '#78350f', roof: '#92400e', height: 28, roofProp: 'helipad', label: 'MINE DUMP CITADEL' });
                buildings.push({ x: 820, y: 1220, w: 220, h: 65, color: '#a16207', roof: '#ca8a04', height: 9 });
                buildings.push({ x: 1260, y: 1220, w: 220, h: 65, color: '#a16207', roof: '#ca8a04', height: 9 });
                pickups.push(new Pickup(1080, 1250, 'health'));
                pickups.push(new Pickup(1210, 1250, 'ammo'));

                const warehouses = [
                    [320, 320, 240, 190, '#27272a', '#3f3f46'],
                    [1650, 320, 300, 180, '#1e293b', '#334155'],
                    [2550, 320, 320, 190, '#292524', '#44403c'],
                    [3880, 340, 260, 210, '#1e293b', '#334155'],
                    [1720, 1080, 260, 200, '#a16207', '#ca8a04'],
                    [3880, 1250, 280, 240, '#27272a', '#3f3f46'],
                    [320, 1950, 240, 210, '#1e293b', '#334155'],
                    [3880, 2150, 280, 240, '#292524', '#44403c'],
                    [1550, 3250, 320, 220, '#27272a', '#3f3f46'],
                    [3880, 3250, 280, 230, '#1e293b', '#334155'],
                    [420, 4020, 320, 190, '#292524', '#44403c'],
                    [2350, 4020, 340, 190, '#1e293b', '#334155']
                ];
                for (let i = 0; i < warehouses.length; i++) {
                    const wh = warehouses[i];
                    buildings.push({ x: wh[0], y: wh[1], w: wh[2], h: wh[3], color: wh[4], roof: wh[5], height: 16 });
                }

                vehicles.push(new Vehicle(2185, 1950, Math.PI / 2, 'bakkie'));
                vehicles.push(new Vehicle(1550, 2915, 0, 'hatchback'));
                vehicles.push(new Vehicle(3615, 1950, -Math.PI / 2, 'bakkie'));

                for (let i = 0; i < 20; i++) {
                    let px = 0;
                    let py = 0;
                    do {
                        px = Math2.rand(200, WORLD_SIZE - 200);
                        py = Math2.rand(200, WORLD_SIZE - 200);
                    } while (pointInsideBuilding(px, py, 24));
                    const pType = i % 3 === 0 ? 'ammo' : (i % 3 === 1 ? 'health' : 'armor');
                    pickups.push(new Pickup(px, py, pType));
                }
            }

            // ============================================================================
            // MISSION DIRECTORS & CHECKPOINT MESSENGER CUTSCENES FOR ALL 5 CAMPAIGNS
            // ============================================================================
            function initTrainingMissions() {
                mission = {
                    campaign: 'training',
                    stage: 1,
                    targetX: 2200,
                    targetY: 2050,
                    stage2Spawned: false,
                    bossSpawned: false
                };

                // Spawn Younger G and Younger Blaze as your friendly squadmates!
                allies.push(new Ally(710, 3230, 'young_g'));
                allies.push(new Ally(810, 3230, 'young_blaze'));

                // Stage 1 Grown-Up Adult Patrol near the Creek Bridge
                const creekAdults = [
                    [1980, 2380], [2180, 2240], [2340, 2040], [2100, 1950]
                ];
                for (let i = 0; i < creekAdults.length; i++) {
                    enemies.push(new Enemy(creekAdults[i][0], creekAdults[i][1], 'airsoft_adult'));
                }

                // Mid-forest roaming grown-up adult players
                for (let i = 0; i < 12; i++) {
                    let ex = 0;
                    let ey = 0;
                    do {
                        ex = Math2.rand(1200, 3600);
                        ey = Math2.rand(750, 2900);
                    } while (pointInsideBuilding(ex, ey, 35) || Math2.dist(ex, ey, 760, 3250) < 950);
                    enemies.push(new Enemy(ex, ey, 'airsoft_adult'));
                }

                updateMissionUI();

                phoneCutscene.start({
                    clock: '09:30 AM',
                    isTraining: true,
                    opsec: 'WOODLAND AIRSOFT SKIRMISH // EYE-PRO MANDATORY • CALL YOUR HITS!',
                    contactName: 'YOUNGER G & YOUNGER BLAZE',
                    contactSub: 'YOUTH SQUAD GROUP CHAT // PINE RIDGE FIELD',
                    contactAvatar: 'young_g',
                    messages: [
                        { side: 'system', text: 'SUNDAY MORNING SKIRMISH // 3 YOUTH PLAYERS VS. GROWN-UP MILSIM SQUAD' },
                        { side: 'incoming', sender: 'YOUNGER G', time: '09:29', text: 'Those grown-ups brought full plate carriers and heavy AEGs. Good thing there are three of us—stay behind the pine trunks and flank them.' },
                        { side: 'incoming', sender: 'YOUNGER BLAZE', time: '09:30', text: 'I have point on the right flank! Yael, watch your reload discipline—if you drop a mag early, those BBs stay in the grass.' },
                        { side: 'outgoing', sender: 'YOUNGER YAEL', time: '09:30', text: 'Goggles sealed, pink G26 gassed up! Let us push north-east to the Timber Creek Bridge and grab the spare M4 AEG.' }
                    ]
                });
            }

            function initMallMissions() {
                mission = {
                    campaign: 'mall',
                    stage: 1,
                    targetX: 1450,
                    targetY: 2560,
                    stage2Spawned: false,
                    stage3Spawned: false,
                    blockadeSpawned: false
                };

                const initialLooters = [
                    [1420, 2560, 'unarmed_looter'],
                    [1490, 2630, 'unarmed_looter'],
                    [1380, 2480, 'looter'],
                    [1510, 2450, 'looter'],
                    [1450, 2360, 'unarmed_looter']
                ];
                for (let i = 0; i < initialLooters.length; i++) {
                    enemies.push(new Enemy(initialLooters[i][0], initialLooters[i][1], initialLooters[i][2]));
                }

                for (let i = 0; i < 42; i++) {
                    let ex = 0;
                    let ey = 0;
                    do {
                        ex = Math2.rand(540, 3450);
                        ey = Math2.rand(540, 3400);
                    } while (pointInsideBuilding(ex, ey, 22) || Math2.dist(ex, ey, 740, 3150) < 750);

                    const kind = Math.random() < 0.65 ? 'unarmed_looter' : 'looter';
                    enemies.push(new Enemy(ex, ey, kind));
                }

                const blockadeSquad = [
                    [3760, 1940, false],
                    [3760, 2160, false],
                    [3880, 2000, true],
                    [3880, 2110, false],
                    [3990, 1950, false],
                    [3990, 2150, false]
                ];
                for (let i = 0; i < blockadeSquad.length; i++) {
                    enemies.push(new Enemy(blockadeSquad[i][0], blockadeSquad[i][1], 'blockade_goon', blockadeSquad[i][2]));
                }

                updateMissionUI();

                phoneCutscene.start({
                    clock: '07:00 AM',
                    opsec: 'OPSEC WARNING: CELLULAR SIGNAL UNENCRYPTED (NO DMR RADIO)',
                    contactName: 'DAVID // EXFIL OPS',
                    contactSub: 'BURNER SIM &bull; MALL CELL RELAY',
                    contactAvatar: 'male',
                    messages: [
                        { side: 'system', text: '2 HOURS POST-IMPACT // POWER GRID OFFLINE' },
                        { side: 'incoming', sender: 'DAVID', time: '07:00', text: 'Yael, tell me your battery is still holding. Nobody had encrypted DMR handsets staged when the grid went down—keep texts short, local towers are being scraped.' },
                        { side: 'outgoing', sender: 'YAEL', time: '07:00', text: 'Copy. Inside Golden Dragon shop with four terrified shoppers. Lights are dead. I have my pink Glock 26 loaded with 100gr FMJ, two extended mags, and one tucked 10-rounder.' },
                        { side: 'incoming', sender: 'DAVID', time: '07:01', text: 'Kill your white light [F] to sneak, or use NVG/Thermal [V] + invisible IR laser. Check the North Concourse or Security Office for 120gr +P JHP hollow-point stashes [B]—bigger flash and louder bang, but huge stopping power.' }
                    ]
                });
            }

            function initSuburbsMissions() {
                mission = {
                    campaign: 'suburbs',
                    stage: 1,
                    targetX: 2100,
                    targetY: 2540,
                    stage2Spawned: false,
                    stage3Spawned: false,
                    bossSpawned: false
                };

                const blockLooters = [
                    [2040, 2480], [2160, 2530], [2090, 2610]
                ];
                for (let i = 0; i < blockLooters.length; i++) {
                    enemies.push(new Enemy(blockLooters[i][0], blockLooters[i][1], 'looter'));
                }

                for (let i = 0; i < 38; i++) {
                    let ex = 0;
                    let ey = 0;
                    do {
                        ex = Math2.rand(250, WORLD_SIZE - 250);
                        ey = Math2.rand(250, WORLD_SIZE - 250);
                    } while (pointInsideBuilding(ex, ey) || Math2.dist(ex, ey, 1950, 1950) < 1150);

                    const roll = Math.random();
                    if (roll < 0.35) {
                        enemies.push(new Enemy(ex, ey, 'looter'));
                    } else if (roll < 0.72) {
                        enemies.push(new Enemy(ex, ey, 'syndicate'));
                        if (Math.random() < 0.45) {
                            enemies.push(new Enemy(ex + 22, ey + 18, 'dog'));
                        }
                    } else {
                        enemies.push(new Enemy(ex, ey, 'security'));
                    }
                }

                updateMissionUI();

                phoneCutscene.start({
                    clock: '06:15 AM',
                    opsec: 'OPSEC WARNING: CELLULAR DATA INTERCEPTABLE // NO DMR',
                    contactName: 'SAREL // SECTOR RELAY',
                    contactSub: 'PREPAID SIM &bull; SUBURBAN TOWER',
                    contactAvatar: 'sniper',
                    messages: [
                        { side: 'system', text: '+48 HOURS POST-IMPACT // SUBURBAN SECTOR' },
                        { side: 'incoming', sender: 'SAREL', time: '06:14', text: 'G, analog walkie channels are flooded and nobody outside military units carries encrypted DMR rigs. Use this burner thread sparingly—they triangulate long calls.' },
                        { side: 'outgoing', sender: 'G', time: '06:15', text: 'Understood. Vektor LM4 is loaded and the bakkie is fueled. Stepping out of the compound now to clear the avenue.' },
                        { side: 'incoming', sender: 'SAREL', time: '06:15', text: 'Watch your magazine discipline—tossing a half-full mag forfeits every round still inside it. Clear the block first, then push north-east to the shopping strip.' }
                    ]
                });
            }

            function initCBDMissions() {
                mission = {
                    campaign: 'cbd',
                    stage: 1,
                    targetX: 1850,
                    targetY: 2450,
                    stage2Spawned: false,
                    stage3Spawned: false,
                    bossSpawned: false
                };

                const stage1Coords = [
                    [1800, 2430], [1900, 2470], [1840, 2380], [1920, 2410]
                ];
                for (let i = 0; i < stage1Coords.length; i++) {
                    enemies.push(new Enemy(stage1Coords[i][0], stage1Coords[i][1], i < 2 ? 'looter' : 'syndicate'));
                }

                for (let i = 0; i < 44; i++) {
                    let ex = 0;
                    let ey = 0;
                    do {
                        ex = Math2.rand(250, WORLD_SIZE - 250);
                        ey = Math2.rand(250, WORLD_SIZE - 250);
                    } while (pointInsideBuilding(ex, ey) || Math2.dist(ex, ey, 1850, 2920) < 950);

                    const roll = Math.random();
                    if (roll < 0.3) {
                        enemies.push(new Enemy(ex, ey, 'looter'));
                    } else if (roll < 0.68) {
                        enemies.push(new Enemy(ex, ey, 'syndicate'));
                        if (Math.random() < 0.45) {
                            enemies.push(new Enemy(ex + 22, ey + 18, 'dog'));
                        }
                    } else {
                        enemies.push(new Enemy(ex, ey, 'security'));
                    }
                }

                updateMissionUI();

                phoneCutscene.start({
                    clock: '14:20 PM',
                    opsec: 'OPSEC WARNING: CELLULAR RELAY UNENCRYPTED',
                    contactName: 'KABELO // ROOFTOP SPOTTER',
                    contactSub: 'BURNER SMS &bull; BREE ST SECTOR',
                    contactAvatar: 'male',
                    messages: [
                        { side: 'system', text: 'DAY 1 AFTERNOON // JOHANNESBURG CBD' },
                        { side: 'incoming', sender: 'KABELO', time: '14:19', text: 'Blaze, cellular towers downtown are running on generator backup—Syndicate scanners are sniffing SMS traffic, so keep moving.' },
                        { side: 'outgoing', sender: 'BLAZE', time: '14:20', text: 'Pressure gauge on the portable flamethrower is green. Stepping out of Bree Street Taxi Rank now.' },
                        { side: 'incoming', sender: 'KABELO', time: '14:20', text: 'Syndicate crews blockaded the avenue straight north of you. Burn through their roadblock and push east toward Central Arcade.' }
                    ]
                });
            }

            function initSniperMissions() {
                mission = {
                    campaign: 'sniper',
                    stage: 1,
                    targetX: 1450,
                    targetY: 2365,
                    stage2Spawned: false,
                    stage3Spawned: false,
                    bossSpawned: false
                };

                const railTargets = [
                    [1280, 2365], [1420, 2435], [1560, 2295], [1640, 2435], [1490, 2365]
                ];
                for (let i = 0; i < railTargets.length; i++) {
                    enemies.push(new Enemy(railTargets[i][0], railTargets[i][1], i % 2 === 0 ? 'syndicate' : 'looter'));
                }

                for (let i = 0; i < 40; i++) {
                    let ex = 0;
                    let ey = 0;
                    do {
                        ex = Math2.rand(250, WORLD_SIZE - 250);
                        ey = Math2.rand(250, WORLD_SIZE - 250);
                    } while (pointInsideBuilding(ex, ey) || Math2.dist(ex, ey, 920, 2660) < 950);

                    const roll = Math.random();
                    if (roll < 0.32) {
                        enemies.push(new Enemy(ex, ey, 'looter'));
                    } else if (roll < 0.7) {
                        enemies.push(new Enemy(ex, ey, 'syndicate'));
                        if (Math.random() < 0.4) {
                            enemies.push(new Enemy(ex + 24, ey + 18, 'dog'));
                        }
                    } else {
                        enemies.push(new Enemy(ex, ey, 'security'));
                    }
                }

                updateMissionUI();

                phoneCutscene.start({
                    clock: '17:45 PM',
                    opsec: 'OPSEC WARNING: CELLULAR SIGNAL UNENCRYPTED',
                    contactName: 'DAVID // EXFIL OPS',
                    contactSub: 'BURNER SIM &bull; INDUSTRIAL FREIGHT BELT',
                    contactAvatar: 'mall',
                    messages: [
                        { side: 'system', text: 'DAY 1 DUSK // SOUTH FREIGHT RAIL YARD' },
                        { side: 'incoming', sender: 'DAVID', time: '17:44', text: 'Uncle, since nobody had encrypted DMR radios pre-issued before the grid fell, we are stuck using burner phones. Keep your screen dim.' },
                        { side: 'outgoing', sender: 'THE UNCLE', time: '17:45', text: 'In position on the Signal Overwatch nest. Ruger M77 bolt-action is zeroed and my iPods are queued up.' },
                        { side: 'incoming', sender: 'DAVID', time: '17:45', text: 'Syndicate lookouts are spotting the freight lines below you. Use [Right-Click] to pan your scope and punch armor-piercing rounds through them.' }
                    ]
                });
            }

            function updateMissionDirector() {
                if (!mission || !player) return;

                if (mission.campaign === 'training') {
                    if (mission.stage === 1) {
                        let bridgeAdults = 0;
                        for (let i = 0; i < enemies.length; i++) {
                            const e = enemies[i];
                            if (e.hp > 0 && Math2.dist(e.x, e.y, 2200, 2150) < 420) {
                                bridgeAdults++;
                            }
                        }
                        const d = Math2.dist(player.x, player.y, mission.targetX, mission.targetY);
                        document.getElementById('missionProgress').innerText = bridgeAdults > 0
                            ? `CREEK BRIDGE ADULTS: ${bridgeAdults}`
                            : `CROSS TIMBER BRIDGE (${Math.round(d / 10)}m)`;

                        if (bridgeAdults === 0 && d < 220) {
                            mission.stage = 2;
                            mission.targetX = 2880;
                            mission.targetY = 1470;
                            if (!mission.stage2Spawned) {
                                mission.stage2Spawned = true;
                                enemies.push(new Enemy(2780, 1450, 'airsoft_adult'));
                                enemies.push(new Enemy(2940, 1490, 'airsoft_adult'));
                                enemies.push(new Enemy(3040, 1410, 'airsoft_adult'));
                            }
                            updateMissionUI();
                            phoneCutscene.start({
                                clock: '09:42 AM',
                                isTraining: true,
                                opsec: 'TIMBER BRIDGE SECURED // PUSHING TO SANDBAG RIDGE',
                                contactName: 'YOUNGER G & YOUNGER BLAZE',
                                contactSub: 'YOUTH SQUAD GROUP CHAT // PINE RIDGE FIELD',
                                contactAvatar: 'young_blaze',
                                messages: [
                                    { side: 'incoming', sender: 'YOUNGER BLAZE', time: '09:42', text: 'Nice push across the creek! We tagged out their forward scouts. The rest of the grown-ups fell back behind the Sandbag Ridge up the hill.' },
                                    { side: 'outgoing', sender: 'YOUNGER YAEL', time: '09:42', text: 'Grabbed the spare M4 AEG from the bridge crate. Advancing up the ridge with you two now!' }
                                ]
                            });
                        }
                    } else if (mission.stage === 2) {
                        let ridgeAdults = 0;
                        for (let i = 0; i < enemies.length; i++) {
                            const e = enemies[i];
                            if (e.hp > 0 && Math2.dist(e.x, e.y, 2880, 1470) < 420) {
                                ridgeAdults++;
                            }
                        }
                        const d = Math2.dist(player.x, player.y, mission.targetX, mission.targetY);
                        document.getElementById('missionProgress').innerText = ridgeAdults > 0
                            ? `SANDBAG RIDGE DEFENDERS: ${ridgeAdults}`
                            : `BREACH SANDBAG RIDGE (${Math.round(d / 10)}m)`;

                        if (ridgeAdults === 0 && d < 220) {
                            mission.stage = 3;
                            mission.targetX = 3540;
                            mission.targetY = 1040;
                            if (!mission.bossSpawned) {
                                mission.bossSpawned = true;
                                enemies.push(new Enemy(3540, 1020, 'airsoft_adult', true));
                                enemies.push(new Enemy(3420, 1060, 'airsoft_adult'));
                                enemies.push(new Enemy(3650, 1060, 'airsoft_adult'));
                                enemies.push(new Enemy(3490, 1130, 'airsoft_adult'));
                            }
                            updateMissionUI();
                            phoneCutscene.start({
                                clock: '09:55 AM',
                                isTraining: true,
                                opsec: 'FINAL OBJECTIVE // ADULT MILSIM HQ FLAG',
                                contactName: 'YOUNGER G & YOUNGER BLAZE',
                                contactSub: 'YOUTH SQUAD GROUP CHAT // PINE RIDGE FIELD',
                                contactAvatar: 'young_g',
                                messages: [
                                    { side: 'incoming', sender: 'YOUNGER G', time: '09:55', text: 'Their HQ camp and flag are just through the north-east pines! Their squad captain is holding the sandbags with a heavy support AEG.' },
                                    { side: 'incoming', sender: 'YOUNGER BLAZE', time: '09:55', text: 'Suppressing on your mark—tag them out and touch their flag to win the match!' }
                                ]
                            });
                        }
                    } else if (mission.stage === 3) {
                        let hqAdults = 0;
                        for (let i = 0; i < enemies.length; i++) {
                            const e = enemies[i];
                            if (e.hp > 0 && Math2.dist(e.x, e.y, 3540, 1040) < 460) {
                                hqAdults++;
                            }
                        }
                        const d = Math2.dist(player.x, player.y, mission.targetX, mission.targetY);
                        document.getElementById('missionProgress').innerText = hqAdults > 0
                            ? `ADULT HQ DEFENDERS: ${hqAdults}`
                            : `CAPTURE BASE FLAG (${Math.round(d / 10)}m)`;

                        if (hqAdults === 0 && d < 175) {
                            triggerGameOver(true);
                        }
                    }
                    return;
                }

                if (mission.campaign === 'mall') {
                    if (mission.stage === 1) {
                        const d = Math2.dist(player.x, player.y, mission.targetX, mission.targetY);
                        document.getElementById('missionProgress').innerText = `REACH SOUTH CONCOURSE (${Math.round(d / 10)}m)`;
                        if (d < 170) {
                            mission.stage = 2;
                            mission.targetX = 2050;
                            mission.targetY = 2000;
                            if (!mission.stage2Spawned) {
                                mission.stage2Spawned = true;
                                enemies.push(new Enemy(1920, 1980, 'looter'));
                                enemies.push(new Enemy(2080, 2040, 'looter'));
                                enemies.push(new Enemy(2160, 1940, 'looter'));
                                enemies.push(new Enemy(2000, 2120, 'unarmed_looter'));
                                enemies.push(new Enemy(2140, 2100, 'unarmed_looter'));
                            }
                            updateMissionUI();
                            phoneCutscene.start({
                                clock: '07:09 AM',
                                opsec: 'OPSEC WARNING: TOWER HANDOFF DETECTED',
                                contactName: 'DAVID // EXFIL OPS',
                                contactSub: 'BURNER SIM &bull; CENTRAL ATRIUM',
                                contactAvatar: 'male',
                                messages: [
                                    { side: 'incoming', sender: 'DAVID', time: '07:09', text: 'You made it out of the discount shop. Watch the Central Atrium Food Court ahead—yellow-shirt spotters are calling out lone shoppers to armed looters.' },
                                    { side: 'outgoing', sender: 'YAEL', time: '07:09', text: 'Copy. Checking my spare mags—only a few left.' },
                                    { side: 'incoming', sender: 'DAVID', time: '07:09', text: 'If gunfire breaks out, switch off your white light [F], use Thermal/NVG [V] to track them silently, and slip away from your Last Known Position.' }
                                ]
                            });
                        }
                    } else if (mission.stage === 2) {
                        let atriumArmed = 0;
                        for (let i = 0; i < enemies.length; i++) {
                            const e = enemies[i];
                            if (e.hp > 0 && !e.isUnarmed && e.panicState === 'normal' && Math2.dist(e.x, e.y, 2050, 2000) < 420) {
                                atriumArmed++;
                            }
                        }
                        const d = Math2.dist(player.x, player.y, mission.targetX, mission.targetY);
                        document.getElementById('missionProgress').innerText = atriumArmed > 0
                            ? `ATRIUM GUNMEN ACTIVE: ${atriumArmed}`
                            : `MOVE INTO ATRIUM CENTER (${Math.round(d / 10)}m)`;

                        if (atriumArmed === 0 && d < 220) {
                            mission.stage = 3;
                            mission.targetX = 3380;
                            mission.targetY = 2050;
                            if (!mission.stage3Spawned) {
                                mission.stage3Spawned = true;
                                enemies.push(new Enemy(3240, 1980, 'looter'));
                                enemies.push(new Enemy(3340, 2120, 'looter'));
                                enemies.push(new Enemy(3440, 2040, 'blockade_goon'));
                            }
                            updateMissionUI();
                            phoneCutscene.start({
                                clock: '07:16 AM',
                                opsec: 'OPSEC WARNING: LOCAL CELL TRAFFIC SPIKE',
                                contactName: 'DAVID // EXFIL OPS',
                                contactSub: 'BURNER SIM &bull; EAST CONCOURSE',
                                contactAvatar: 'male',
                                messages: [
                                    { side: 'incoming', sender: 'DAVID', time: '07:16', text: 'Police radio bands are jammed near the East Mall Entrance. Heavily armed AK-47 goons with idling minibus taxis are holding the outer road so SAPS cannot breach.' },
                                    { side: 'outgoing', sender: 'YAEL', time: '07:16', text: 'Heading toward the East Entrance doors now. Will check the Security Office if I need 120gr +P JHP hollow points or heavier gear.' }
                                ]
                            });
                        }
                    } else if (mission.stage === 3) {
                        const d = Math2.dist(player.x, player.y, mission.targetX, mission.targetY);
                        document.getElementById('missionProgress').innerText = `EAST ENTRANCE DOORS (${Math.round(d / 10)}m)`;
                        if (d < 190) {
                            mission.stage = 4;
                            mission.targetX = 3980;
                            mission.targetY = 2050;
                            updateMissionUI();
                            showPhoneMessage(
                                'PHONE // DAVID (EXFIL OPS)',
                                '07:22 AM',
                                'You are at the doors! Neutralize the Kalashnikov goons guarding the taxis and reach the police perimeter checkpoint!'
                            );
                        }
                    } else if (mission.stage === 4) {
                        let goonsLeft = 0;
                        for (let i = 0; i < enemies.length; i++) {
                            const e = enemies[i];
                            if (e.hp > 0 && e.faction === 'blockade_goon') {
                                goonsLeft++;
                            }
                        }
                        const d = Math2.dist(player.x, player.y, mission.targetX, mission.targetY);
                        document.getElementById('missionProgress').innerText = goonsLeft > 0
                            ? `AK-47 BLOCKADE GOONS: ${goonsLeft}`
                            : `REACH EXFIL CHECKPOINT (${Math.round(d / 10)}m)`;

                        if (goonsLeft === 0 && d < 180) {
                            triggerGameOver(true);
                        }
                    }
                    return;
                }

                if (mission.campaign === 'sniper') {
                    if (mission.stage === 1) {
                        let railSpotters = 0;
                        for (let i = 0; i < enemies.length; i++) {
                            const e = enemies[i];
                            if (e.hp > 0 && Math2.dist(e.x, e.y, 1450, 2365) < 420) {
                                railSpotters++;
                            }
                        }
                        document.getElementById('missionProgress').innerText = `RAIL YARD SPOTTERS IN SIGHTS: ${railSpotters}`;

                        if (railSpotters === 0) {
                            mission.stage = 2;
                            mission.targetX = 2850;
                            mission.targetY = 1250;
                            if (!mission.stage2Spawned) {
                                mission.stage2Spawned = true;
                                enemies.push(new Enemy(2710, 1290, 'syndicate'));
                                enemies.push(new Enemy(2850, 1310, 'syndicate'));
                                enemies.push(new Enemy(2980, 1290, 'looter'));
                                enemies.push(new Enemy(2810, 1380, 'dog'));
                            }
                            updateMissionUI();
                            phoneCutscene.start({
                                clock: '18:02 PM',
                                opsec: 'OPSEC WARNING: CELLULAR SIGNAL UNENCRYPTED',
                                contactName: 'DAVID // EXFIL OPS',
                                contactSub: 'BURNER SIM &bull; CONTAINER YARD',
                                contactAvatar: 'mall',
                                messages: [
                                    { side: 'incoming', sender: 'DAVID', time: '18:02', text: 'Rail tracks are clear. Syndicate runners moved their weapon crates into the Container Terminal north-east of your nest.' },
                                    { side: 'outgoing', sender: 'THE UNCLE', time: '18:02', text: 'Moving down from the tower now. Will sweep the containers and grab that Tactical AR-15.' }
                                ]
                            });
                        }
                    } else if (mission.stage === 2) {
                        let terminalHostiles = 0;
                        for (let i = 0; i < enemies.length; i++) {
                            const e = enemies[i];
                            if (e.hp > 0 && Math2.dist(e.x, e.y, 2850, 1250) < 420) {
                                terminalHostiles++;
                            }
                        }
                        const gotAR15 = WEAPONS.some((w) => w.id === 'ar15' && w.unlocked);
                        document.getElementById('missionProgress').innerText = gotAR15
                            ? `CLEAR CONTAINER TERMINAL (${terminalHostiles})`
                            : `RECOVER AR-15 & CLEAR TERMINAL (${terminalHostiles})`;

                        if (terminalHostiles === 0 && gotAR15) {
                            mission.stage = 3;
                            mission.targetX = 3050;
                            mission.targetY = 3490;
                            if (!mission.stage3Spawned) {
                                mission.stage3Spawned = true;
                                enemies.push(new Enemy(2920, 3500, 'security'));
                                enemies.push(new Enemy(3050, 3530, 'security'));
                                enemies.push(new Enemy(3180, 3500, 'security'));
                                enemies.push(new Enemy(3100, 3570, 'security'));
                            }
                            showBanner('STAGE 3: BREACH REFINERY FUEL DEPOT', 2800);
                            updateMissionUI();
                        }
                    } else if (mission.stage === 3) {
                        let depotGuards = 0;
                        for (let i = 0; i < enemies.length; i++) {
                            const e = enemies[i];
                            if (e.hp > 0 && Math2.dist(e.x, e.y, 3050, 3490) < 430) {
                                depotGuards++;
                            }
                        }
                        const gotShotgun = WEAPONS.some((w) => w.id === 'shotgun' && w.unlocked);
                        document.getElementById('missionProgress').innerText = gotShotgun
                            ? `NEUTRALIZE REMAINING PMC UNITS (${depotGuards})`
                            : `SECURE SHOTGUN & CLEAR DEPOT (${depotGuards})`;

                        if (depotGuards === 0 && gotShotgun) {
                            mission.stage = 4;
                            mission.targetX = 1150;
                            mission.targetY = 1230;
                            if (!mission.bossSpawned) {
                                mission.bossSpawned = true;
                                enemies.push(new Enemy(1150, 1215, 'syndicate', true));
                                enemies.push(new Enemy(1050, 1255, 'syndicate'));
                                enemies.push(new Enemy(1240, 1255, 'syndicate'));
                                enemies.push(new Enemy(1090, 1300, 'dog'));
                                enemies.push(new Enemy(1200, 1300, 'dog'));
                            }
                            updateMissionUI();
                            phoneCutscene.start({
                                clock: '18:34 PM',
                                opsec: 'OPSEC WARNING: CELLULAR SIGNAL UNENCRYPTED',
                                contactName: 'DAVID // EXFIL OPS',
                                contactSub: 'BURNER SIM &bull; MINE DUMP CITADEL',
                                contactAvatar: 'mall',
                                messages: [
                                    { side: 'incoming', sender: 'DAVID', time: '18:34', text: 'Thermal drone caught the Syndicate Arms Broker retreating up the Mine Dump Citadel in the north-west with attack hounds.' },
                                    { side: 'outgoing', sender: 'THE UNCLE', time: '18:34', text: 'Cycling a fresh 5-round clip into the Ruger. Ending this now.' }
                                ]
                            });
                        }
                    } else if (mission.stage === 4) {
                        let bossAlive = false;
                        let guardsLeft = 0;
                        for (let i = 0; i < enemies.length; i++) {
                            const e = enemies[i];
                            if (e.hp > 0) {
                                if (e.isBoss) bossAlive = true;
                                if (Math2.dist(e.x, e.y, 1150, 1230) < 440) guardsLeft++;
                            }
                        }
                        document.getElementById('missionProgress').innerText = bossAlive
                            ? `ARMS BROKER ACTIVE (${guardsLeft} ESCORTS)`
                            : `CLEAR REMAINING ESCORTS (${guardsLeft})`;

                        if (!bossAlive && guardsLeft === 0) {
                            triggerGameOver(true);
                        }
                    }
                    return;
                }

                if (mission.campaign === 'cbd') {
                    if (mission.stage === 1) {
                        let rankHostiles = 0;
                        for (let i = 0; i < enemies.length; i++) {
                            const e = enemies[i];
                            if (e.hp > 0 && Math2.dist(e.x, e.y, 1850, 2450) < 360) {
                                rankHostiles++;
                            }
                        }
                        document.getElementById('missionProgress').innerText = `TAXI RANK ROADBLOCK: ${rankHostiles}`;

                        if (rankHostiles === 0) {
                            mission.stage = 2;
                            mission.targetX = 2910;
                            mission.targetY = 2490;
                            if (!mission.stage2Spawned) {
                                mission.stage2Spawned = true;
                                enemies.push(new Enemy(2790, 2490, 'syndicate'));
                                enemies.push(new Enemy(2910, 2520, 'syndicate'));
                                enemies.push(new Enemy(3030, 2490, 'looter'));
                                enemies.push(new Enemy(2860, 2570, 'dog'));
                            }
                            updateMissionUI();
                            phoneCutscene.start({
                                clock: '14:38 PM',
                                opsec: 'OPSEC WARNING: CELLULAR RELAY UNENCRYPTED',
                                contactName: 'KABELO // ROOFTOP SPOTTER',
                                contactSub: 'BURNER SMS &bull; CENTRAL ARCADE',
                                contactAvatar: 'male',
                                messages: [
                                    { side: 'incoming', sender: 'KABELO', time: '14:38', text: 'Bree Street intersection is clear! Syndicate gunmen fell back into Central Arcade Plaza to the east.' },
                                    { side: 'outgoing', sender: 'BLAZE', time: '14:38', text: 'On my way. Keep an eye out for spare fuel canisters on the corners.' }
                                ]
                            });
                        }
                    } else if (mission.stage === 2) {
                        let arcadeHostiles = 0;
                        for (let i = 0; i < enemies.length; i++) {
                            const e = enemies[i];
                            if (e.hp > 0 && Math2.dist(e.x, e.y, 2910, 2490) < 380) {
                                arcadeHostiles++;
                            }
                        }
                        const gotShotgun = WEAPONS.some((w) => w.id === 'shotgun' && w.unlocked);
                        document.getElementById('missionProgress').innerText = gotShotgun
                            ? `CLEAR ARCADE DEFENDERS (${arcadeHostiles})`
                            : `CLAIM SHOTGUN & CLEAR ARCADE (${arcadeHostiles})`;

                        if (arcadeHostiles === 0 && gotShotgun) {
                            mission.stage = 3;
                            mission.targetX = 2910;
                            mission.targetY = 1070;
                            if (!mission.stage3Spawned) {
                                mission.stage3Spawned = true;
                                enemies.push(new Enemy(2780, 1080, 'security'));
                                enemies.push(new Enemy(2910, 1110, 'security'));
                                enemies.push(new Enemy(3040, 1080, 'security'));
                                enemies.push(new Enemy(2960, 1160, 'security'));
                            }
                            showBanner('STAGE 3: BREACH RESERVE BANK PRECINCT', 2800);
                            updateMissionUI();
                        }
                    } else if (mission.stage === 3) {
                        let bankGuards = 0;
                        for (let i = 0; i < enemies.length; i++) {
                            const e = enemies[i];
                            if (e.hp > 0 && Math2.dist(e.x, e.y, 2910, 1070) < 380) {
                                bankGuards++;
                            }
                        }
                        const gotAR15 = WEAPONS.some((w) => w.id === 'ar15' && w.unlocked);
                        document.getElementById('missionProgress').innerText = gotAR15
                            ? `NEUTRALIZE REMAINING PMC UNITS (${bankGuards})`
                            : `RECOVER AR-15 & CLEAR PRECINCT (${bankGuards})`;

                        if (bankGuards === 0 && gotAR15) {
                            mission.stage = 4;
                            mission.targetX = 780;
                            mission.targetY = 1070;
                            if (!mission.bossSpawned) {
                                mission.bossSpawned = true;
                                enemies.push(new Enemy(780, 1060, 'syndicate', true));
                                enemies.push(new Enemy(690, 1090, 'syndicate'));
                                enemies.push(new Enemy(870, 1090, 'syndicate'));
                                enemies.push(new Enemy(720, 1140, 'dog'));
                                enemies.push(new Enemy(840, 1140, 'dog'));
                            }
                            updateMissionUI();
                            phoneCutscene.start({
                                clock: '15:10 PM',
                                opsec: 'OPSEC WARNING: CELLULAR RELAY UNENCRYPTED',
                                contactName: 'KABELO // ROOFTOP SPOTTER',
                                contactSub: 'BURNER SMS &bull; CARLTON TOWER PLAZA',
                                contactAvatar: 'male',
                                messages: [
                                    { side: 'incoming', sender: 'KABELO', time: '15:10', text: 'Reserve Bank is yours! Only Carlton Tower Plaza in the north-west remains—the CBD Kingpin is holed up there with his attack dogs.' },
                                    { side: 'outgoing', sender: 'BLAZE', time: '15:10', text: 'Rolling west now. Time to burn them out.' }
                                ]
                            });
                        }
                    } else if (mission.stage === 4) {
                        let bossAlive = false;
                        let guardsLeft = 0;
                        for (let i = 0; i < enemies.length; i++) {
                            const e = enemies[i];
                            if (e.hp > 0) {
                                if (e.isBoss) bossAlive = true;
                                if (Math2.dist(e.x, e.y, 780, 1070) < 400) guardsLeft++;
                            }
                        }
                        document.getElementById('missionProgress').innerText = bossAlive
                            ? `CBD KINGPIN ACTIVE (${guardsLeft} ESCORTS)`
                            : `CLEAR REMAINING ESCORTS (${guardsLeft})`;

                        if (!bossAlive && guardsLeft === 0) {
                            triggerGameOver(true);
                        }
                    }
                    return;
                }

                // Chapter 4: The Suburbs (Protagonist: G)
                if (mission.stage === 1) {
                    let nearbyLooters = 0;
                    for (let i = 0; i < enemies.length; i++) {
                        const e = enemies[i];
                        if (e.hp > 0 && Math2.dist(e.x, e.y, 2100, 2540) < 340) {
                            nearbyLooters++;
                        }
                    }
                    document.getElementById('missionProgress').innerText = `LOOTERS ON THE BLOCK: ${nearbyLooters}`;

                    if (nearbyLooters === 0) {
                        mission.stage = 2;
                        mission.targetX = 2970;
                        mission.targetY = 1640;
                        if (!mission.stage2Spawned) {
                            mission.stage2Spawned = true;
                            enemies.push(new Enemy(2860, 1650, 'looter'));
                            enemies.push(new Enemy(2970, 1680, 'syndicate'));
                            enemies.push(new Enemy(3080, 1650, 'looter'));
                            enemies.push(new Enemy(2930, 1730, 'dog'));
                        }
                        updateMissionUI();
                        phoneCutscene.start({
                            clock: '06:32 AM',
                            opsec: 'OPSEC WARNING: CELLULAR DATA INTERCEPTABLE',
                            contactName: 'SAREL // SECTOR RELAY',
                            contactSub: 'PREPAID SIM &bull; COMMERCIAL STRIP',
                            contactAvatar: 'sniper',
                            messages: [
                                { side: 'incoming', sender: 'SAREL', time: '06:32', text: 'Block is quiet, G. Syndicate scavengers just breached the Stripped Shopping Centre to the north-east.' },
                                { side: 'outgoing', sender: 'G', time: '06:32', text: 'Copy. Moving north-east to secure the strip and recover that Pump Shotgun.' }
                            ]
                        });
                    }
                } else if (mission.stage === 2) {
                    let mallHostiles = 0;
                    for (let i = 0; i < enemies.length; i++) {
                        const e = enemies[i];
                        if (e.hp > 0 && Math2.dist(e.x, e.y, 2970, 1640) < 350) {
                            mallHostiles++;
                        }
                    }
                    const gotShotgun = WEAPONS.some((w) => w.id === 'shotgun' && w.unlocked);
                    document.getElementById('missionProgress').innerText = gotShotgun
                        ? `CLEAR REMAINING HOSTILES (${mallHostiles})`
                        : `RECOVER PUMP SHOTGUN & CLEAR HOSTILES (${mallHostiles})`;

                    if (mallHostiles === 0 && gotShotgun) {
                        mission.stage = 3;
                        mission.targetX = 2990;
                        mission.targetY = 3410;
                        if (!mission.stage3Spawned) {
                            mission.stage3Spawned = true;
                            enemies.push(new Enemy(2860, 3420, 'security'));
                            enemies.push(new Enemy(2990, 3450, 'security'));
                            enemies.push(new Enemy(3120, 3420, 'security'));
                            enemies.push(new Enemy(3040, 3500, 'security'));
                        }
                        showBanner('STAGE 3: BREACH PRIVATE SECURITY FOB FOR AR-15', 2800);
                        updateMissionUI();
                    }
                } else if (mission.stage === 3) {
                    let fobGuards = 0;
                    for (let i = 0; i < enemies.length; i++) {
                        const e = enemies[i];
                        if (e.hp > 0 && Math2.dist(e.x, e.y, 2990, 3410) < 360) {
                            fobGuards++;
                        }
                    }
                    const gotAR15 = WEAPONS.some((w) => w.id === 'ar15' && w.unlocked);
                    document.getElementById('missionProgress').innerText = gotAR15
                        ? `NEUTRALIZE REMAINING PMC GUARDS (${fobGuards})`
                        : `SECURE TACTICAL AR-15 & CLEAR FOB (${fobGuards})`;

                    if (fobGuards === 0 && gotAR15) {
                        mission.stage = 4;
                        mission.targetX = 820;
                        mission.targetY = 950;
                        if (!mission.bossSpawned) {
                            mission.bossSpawned = true;
                            enemies.push(new Enemy(820, 940, 'syndicate', true));
                            enemies.push(new Enemy(740, 960, 'syndicate'));
                            enemies.push(new Enemy(900, 960, 'syndicate'));
                            enemies.push(new Enemy(770, 1010, 'dog'));
                            enemies.push(new Enemy(870, 1010, 'dog'));
                        }
                        updateMissionUI();
                        phoneCutscene.start({
                            clock: '07:05 AM',
                            opsec: 'OPSEC WARNING: CELLULAR DATA INTERCEPTABLE',
                            contactName: 'SAREL // SECTOR RELAY',
                            contactSub: 'PREPAID SIM &bull; SUBSTATION #4',
                            contactAvatar: 'sniper',
                            messages: [
                                { side: 'incoming', sender: 'SAREL', time: '07:05', text: 'FOB breached! Substation #4 in the north-west is the last relay keeping our neighborhood grid dark. A Syndicate Warlord is holding the courtyard.' },
                                { side: 'outgoing', sender: 'G', time: '07:05', text: 'Taking the Nyala north-west now. Going dark on cellular until the substation is ours.' }
                            ]
                        });
                    }
                } else if (mission.stage === 4) {
                    let bossAlive = false;
                    let guardsLeft = 0;
                    for (let i = 0; i < enemies.length; i++) {
                        const e = enemies[i];
                        if (e.hp > 0) {
                            if (e.isBoss) bossAlive = true;
                            if (Math2.dist(e.x, e.y, 820, 950) < 380) guardsLeft++;
                        }
                    }
                    document.getElementById('missionProgress').innerText = bossAlive
                        ? `SYNDICATE WARLORD ACTIVE (${guardsLeft} ESCORTS)`
                        : `CLEAR REMAINING ESCORTS (${guardsLeft})`;

                    if (!bossAlive && guardsLeft === 0) {
                        triggerGameOver(true);
                    }
                }
            }

            function updateMissionUI() {
                if (!mission) return;
                const phaseEl = document.getElementById('missionPhase');
                const titleEl = document.getElementById('missionTitle');
                const descEl = document.getElementById('missionDesc');

                if (mission.campaign === 'training') {
                    if (mission.stage === 1) {
                        phaseEl.innerText = 'TRAINING 1 / 3 — PINE WOODLAND CREEK';
                        titleEl.innerText = 'Advance to the Timber Creek Bridge';
                        descEl.innerText = 'Team up with Younger G and Younger Blaze. Use pine trunks and pallet bunkers for cover against the grown-up MilSim adults, and grab the M4 AEG at the bridge.';
                    } else if (mission.stage === 2) {
                        phaseEl.innerText = 'TRAINING 2 / 3 — SANDBAG RIDGE';
                        titleEl.innerText = 'Flank the Grown-Ups on Sandbag Ridge';
                        descEl.innerText = 'Push up the wooded hill past the creek and tag out the grown-up adult defenders holding the sandbag emplacements.';
                    } else if (mission.stage === 3) {
                        phaseEl.innerText = 'TRAINING 3 / 3 — ADULT MILSIM HQ';
                        titleEl.innerText = 'Capture the Adults\' Base Flag';
                        descEl.innerText = 'Tag out the grown-up squad captain and his defenders in the north-east clearing, then touch their HQ flag to win the skirmish!';
                    }
                    return;
                }

                if (mission.campaign === 'mall') {
                    if (mission.stage === 1) {
                        phaseEl.innerText = 'STAGE 1 / 4 — GOLDEN DRAGON SHOP (07:00 AM)';
                        titleEl.innerText = 'Escape the Dark Discount Shop';
                        descEl.innerText = 'Kill white light [F] to sneak or use NVG/Thermal [V] + invisible IR laser. Find 120gr +P JHP stashes [B] for higher stopping power. Reloading forfeits unspent rounds.';
                    } else if (mission.stage === 2) {
                        phaseEl.innerText = 'STAGE 2 / 4 — CENTRAL ATRIUM FOOD COURT';
                        titleEl.innerText = 'Break Through the Looter Crowd';
                        descEl.innerText = 'Cross the Central Atrium. Watch for yellow-shirt looter spotters raising the alarm—relocate in the dark to break their Last Known Position.';
                    } else if (mission.stage === 3) {
                        phaseEl.innerText = 'STAGE 3 / 4 — EAST ENTRANCE CONCOURSE';
                        titleEl.innerText = 'Push to the East Mall Doors';
                        descEl.innerText = 'Fight east toward the main entrance doors. Check the Security Office for a 120gr +P JHP stash and shotgun.';
                    } else if (mission.stage === 4) {
                        phaseEl.innerText = 'STAGE 4 / 4 — TAXI RANK BLOCKADE';
                        titleEl.innerText = 'Clear the AK-47 Goons & Exfil';
                        descEl.innerText = 'Hardened goons with Kalashnikov rifles are posted around idling taxis keeping SAPS back. Eliminate them and reach the police perimeter checkpoint!';
                    }
                    return;
                }

                if (mission.campaign === 'sniper') {
                    if (mission.stage === 1) {
                        phaseEl.innerText = 'STAGE 1 / 4 — SOUTH RAIL OVERWATCH';
                        titleEl.innerText = 'Snipe the Freight Yard Lookouts';
                        descEl.innerText = 'Hold [Right-Click] to pan your Ruger M77 scope downrange, line up collateral armor-piercing shots, and clear the Syndicate spotters along the rail tracks.';
                    } else if (mission.stage === 2) {
                        phaseEl.innerText = 'STAGE 2 / 4 — CONTAINER TERMINAL';
                        titleEl.innerText = 'Infiltrate the Container Maze';
                        descEl.innerText = 'Push north-east across the rail lines into the shipping container yard, eliminate the Syndicate riflemen, and recover the Tactical AR-15.';
                    } else if (mission.stage === 3) {
                        phaseEl.innerText = 'STAGE 3 / 4 — REFINERY FUEL DEPOT';
                        titleEl.innerText = 'Break the PMC Refinery Perimeter';
                        descEl.innerText = 'Rogue PMC contractors have locked down the south-east fuel silos. Pick them off from distance, claim the Pump Shotgun, and seize their armored Nyala.';
                    } else if (mission.stage === 4) {
                        phaseEl.innerText = 'STAGE 4 / 4 — MINE DUMP CITADEL';
                        titleEl.innerText = 'Eliminate the Syndicate Arms Broker';
                        descEl.innerText = 'The Syndicate Arms Broker and his attack dogs are entrenched on the north-west tailings ridge. Take him out to shut down the contraband pipeline.';
                    }
                    return;
                }

                if (mission.campaign === 'cbd') {
                    if (mission.stage === 1) {
                        phaseEl.innerText = 'STAGE 1 / 4 — BREE STREET TAXI RANK';
                        titleEl.innerText = 'Torch the Inner-City Roadblock';
                        descEl.innerText = 'Step out of the Bree Street Taxi Rank with your Portable Flamethrower and clear the Syndicate ambush blocking the avenue north.';
                    } else if (mission.stage === 2) {
                        phaseEl.innerText = 'STAGE 2 / 4 — CENTRAL ARCADE PLAZA';
                        titleEl.innerText = 'Burn Through Central Arcade';
                        descEl.innerText = 'Fight east into Central Arcade Plaza, incinerate the Syndicate defenders, and grab the Pump Shotgun and spare fuel.';
                    } else if (mission.stage === 3) {
                        phaseEl.innerText = 'STAGE 3 / 4 — RESERVE BANK PRECINCT';
                        titleEl.innerText = 'Breach the PMC Bank Perimeter';
                        descEl.innerText = 'Heavily armed Private Security units are holding the Reserve Bank block. Break their cordon, claim the Tactical AR-15, and hijack their armored Nyala.';
                    } else if (mission.stage === 4) {
                        phaseEl.innerText = 'STAGE 4 / 4 — CARLTON TOWER PLAZA';
                        titleEl.innerText = 'Eliminate the CBD Kingpin';
                        descEl.innerText = 'The Syndicate Kingpin and his attack hounds have fortified Carlton Tower Plaza in the north-west. Burn them out to take back downtown.';
                    }
                    return;
                }

                if (mission.stage === 1) {
                    phaseEl.innerText = 'STAGE 1 / 4 — SUBURBAN PERIMETER';
                    titleEl.innerText = 'Clear the Immediate Block';
                    descEl.innerText = 'Grab the spare ammo and medkit in your compound, then clear the looters down the avenue with your Vektor LM4 before rolling out.';
                } else if (mission.stage === 2) {
                    phaseEl.innerText = 'STAGE 2 / 4 — COMMERCIAL STRIP';
                    titleEl.innerText = 'Raid the Stripped Shopping Centre';
                    descEl.innerText = 'Move north-east to the looted shopping centre, eliminate the hostiles, and recover the Pump Shotgun.';
                } else if (mission.stage === 3) {
                    phaseEl.innerText = 'STAGE 3 / 4 — SECURITY CHECKPOINT';
                    titleEl.innerText = 'Breach the Private Security FOB';
                    descEl.innerText = 'Rogue PMC contractors have locked down the south-east compound. Neutralize them to secure the Tactical AR-15 and armored Nyala.';
                } else if (mission.stage === 4) {
                    phaseEl.innerText = 'STAGE 4 / 4 — POWER GRID RESTORATION';
                    titleEl.innerText = 'Eliminate the Syndicate Warlord';
                    descEl.innerText = 'Assault Substation #4 in the north-west, take down the Syndicate Warlord and his attack dogs, and restore local power.';
                }
            }

            // ============================================================================
            // HUD & PHYSICAL ROUND / MAGAZINE RENDERING (TOP-LEFT UNDER PORTRAIT)
            // ============================================================================
            // Replacing identical innerHTML every animation frame destroys/recreates dozens
            // of elements and listeners. The cache is per DOM node and reset by the DOM itself.
            const hudHTMLCache = new WeakMap();
            function setHudHTML(element, markup) {
                if (!element || hudHTMLCache.get(element) === markup) return false;
                element.innerHTML = markup;
                hudHTMLCache.set(element, markup);
                return true;
            }
            function setHudText(element, value) {
                const text = String(value);
                if (element.textContent !== text) element.textContent = text;
            }
            function setHudWidth(element, value) {
                if (element.style.width !== value) element.style.width = value;
            }

            function updateHUD() {
                if (!player) return;
                const isTraining = mission && mission.campaign === 'training';
                setHudText(document.getElementById('hpLabelText'), isTraining ? 'IN-PLAY' : 'HEALTH');
                setHudText(document.getElementById('armorLabelText'), isTraining ? 'VEST PAD' : 'ARMOR');

                setHudText(document.getElementById('hpVal'), Math.ceil(player.hp));
                setHudWidth(document.getElementById('hpBar'), `${player.hp}%`);
                setHudText(document.getElementById('armorVal'), Math.ceil(player.armor));
                setHudWidth(document.getElementById('armorBar'), `${player.armor}%`);
                setHudText(document.getElementById('stamVal'), Math.ceil(player.stamina));
                setHudWidth(document.getElementById('stamBar'), `${player.stamina}%`);

                // Optics Mode Status
                const opticsEl = document.getElementById('opticsStatus');
                if (opticsEl) {
                    if (player.opticsMode === 'nvg') {
                        setHudText(opticsEl, 'OPTICS [V]: NVG + IR LASER');
                        opticsEl.style.color = '#4ade80';
                    } else if (player.opticsMode === 'thermal') {
                        setHudText(opticsEl, 'OPTICS [V]: THERMAL + IR LASER');
                        opticsEl.style.color = '#fb923c';
                    } else {
                        setHudText(opticsEl, 'OPTICS [V]: STANDARD');
                        opticsEl.style.color = '#94a3b8';
                    }
                }

                // Update Stealth / Squad Signature Indicator
                const stealthEl = document.getElementById('stealthStatus');
                if (stealthEl) {
                    if (isTraining) {
                        const activeAllies = allies.filter((a) => !a.isOut).length;
                        setHudText(stealthEl, `SQUAD ACTIVE: ${1 + activeAllies} / 3 (YAEL, G, BLAZE)`);
                        stealthEl.style.color = '#4ade80';
                    } else {
                        let searchingCount = 0;
                        let spottedCount = 0;
                        for (let i = 0; i < enemies.length; i++) {
                            const e = enemies[i];
                            if (e.hp <= 0 || e.isUnarmed) continue;
                            if (e.hesitationTimer > 0.1) spottedCount++;
                            else if (e.lkpTimer > 0) searchingCount++;
                        }
                        if (spottedCount > 0) {
                            setHudText(stealthEl, 'SIGNATURE: SPOTTED // IN CONTACT');
                            stealthEl.style.color = '#ef4444';
                        } else if (searchingCount > 0) {
                            setHudText(stealthEl, `SIGNATURE: SEARCHING LKP (${searchingCount})`);
                            stealthEl.style.color = '#facc15';
                        } else if (mission && mission.campaign === 'mall' && !player.flashlightOn && !isPlayerIlluminatedByEnvironment()) {
                            setHudText(stealthEl, player.opticsMode !== 'standard'
                                ? 'SIGNATURE: SHADOW + IR STEALTH'
                                : 'SIGNATURE: SHADOW CONCEALED');
                            stealthEl.style.color = '#4ade80';
                        } else if (player.lightMode === 'strobe') {
                            setHudText(stealthEl, 'SIGNATURE: STROBE ACTIVE');
                            stealthEl.style.color = '#38bdf8';
                        } else {
                            setHudText(stealthEl, player.flashlightOn ? 'SIGNATURE: BEAM EXPOSED' : 'SIGNATURE: LOW PROFILE');
                            stealthEl.style.color = player.flashlightOn ? '#fb923c' : '#38bdf8';
                        }
                    }
                }

                const wep = WEAPONS[player.wepIdx];
                const ammoVisualRow = document.getElementById('ammoVisualRow');
                const ammoTypeToggle = document.getElementById('ammoTypeToggle');
                const magRoundsLabel = document.getElementById('magRoundsLabel');
                const magRoundsGrid = document.getElementById('magRoundsGrid');
                const magCountLabel = document.getElementById('magCountLabel');
                const magCountIcons = document.getElementById('magCountIcons');

                if (player.vehicle) {
                    const vNames = {
                        nyala: 'ARMORED NYALA (4x4)',
                        saps: 'SAPS RESPONSE VAN',
                        taxi: 'MINIBUS TAXI',
                        bakkie: 'DOUBLE-CAB BAKKIE',
                        hatchback: 'COMPACT HATCHBACK'
                    };
                    setHudText(document.getElementById('wepName'), vNames[player.vehicle.kind] || 'VEHICLE');
                    setHudHTML(document.getElementById('ammoDisplay'), `${Math.ceil(player.vehicle.hp)} <span>CHASSIS HP</span>`);
                    setHudText(document.getElementById('reloadIndicator'), isMobileDevice ? 'TAP [EXIT] • [BRAKE] DRIFT' : '[E] EXIT • [SPACE] DRIFT');
                    if (ammoVisualRow) ammoVisualRow.style.display = 'none';
                    if (ammoTypeToggle) ammoTypeToggle.style.display = 'none';
                } else {
                    if (ammoVisualRow) ammoVisualRow.style.display = 'flex';
                    setHudText(document.getElementById('wepName'), wep.name);

                    if (ammoTypeToggle) {
                        if (wep.id === 'glock26') {
                            ammoTypeToggle.style.display = 'inline-block';
                            const isJhp = wep.ammoLoad === 'jhp';
                            ammoTypeToggle.classList.toggle('jhp-active', isJhp);
                            setHudText(ammoTypeToggle, isJhp
                                ? `LOAD: 120GR +P JHP [B] (FMJ: ${wep.fmjReserve})`
                                : `LOAD: 100GR FMJ [B] (JHP STASH: ${wep.jhpReserve})`);
                        } else {
                            ammoTypeToggle.style.display = 'none';
                        }
                    }

                    if (wep.type === 'melee') {
                        setHudHTML(document.getElementById('ammoDisplay'), wep.isAirsoft ? `&infin; <span>RUBBER EDGE</span>` : `&infin; <span>BLADE</span>`);
                    } else if (wep.isAirsoft) {
                        setHudHTML(document.getElementById('ammoDisplay'), `${wep.mag} <span>/ ${wep.reserve} BBS</span>`);
                    } else if (wep.type === 'flame') {
                        setHudHTML(document.getElementById('ammoDisplay'), `${wep.mag} <span>/ ${wep.reserve} FUEL</span>`);
                    } else if (wep.id === 'glock26') {
                        wep.reserve = wep.ammoLoad === 'jhp' ? wep.jhpReserve : wep.fmjReserve;
                        const lightTag = player.lightMode === 'strobe'
                            ? '<span style="color:#38bdf8;font-weight:900;">STROBE [T]</span>'
                            : (player.lightMode === 'steady'
                                ? '<span style="color:#facc15;">LIGHT: ON [F]</span>'
                                : '<span style="color:#64748b;">LIGHT: OFF [F]</span>');
                        setHudHTML(document.getElementById('ammoDisplay'), `${wep.mag} <span>/ ${wep.reserve} (${lightTag})</span>`);
                    } else {
                        setHudHTML(document.getElementById('ammoDisplay'), `${wep.mag} <span>/ ${wep.reserve}</span>`);
                    }
                    setHudText(document.getElementById('reloadIndicator'), player.isReloading
                        ? (wep.type === 'flame' ? 'SWAPPING FUEL TANK...' : 'SWAPPING MAGAZINE...')
                        : '');

                    // Render Physical Rounds / BBs in Magazine & Physical Spare Magazine Count
                    if (magRoundsGrid && magCountIcons) {
                        if (wep.type === 'melee') {
                            setHudText(magRoundsLabel, 'MELEE EDGE');
                            setHudHTML(magRoundsGrid, '<span style="font-family:ui-monospace,monospace;font-size:10px;font-weight:800;color:#cbd5e1;">READY // NO AMMO REQUIRED</span>');
                            setHudText(magCountLabel, 'RESERVE');
                            setHudHTML(magCountIcons, '<span style="font-family:ui-monospace,monospace;font-size:10px;font-weight:800;color:#64748b;">&mdash;</span>');
                        } else if (wep.type === 'flame') {
                            const totalCells = 20;
                            const activeCells = Math.ceil((wep.mag / wep.magMax) * totalCells);
                            setHudText(magRoundsLabel, `TANK PRESSURE (${wep.mag}%)`);
                            let cellsHtml = '';
                            for (let i = 0; i < totalCells; i++) {
                                cellsHtml += `<div class="round-pip ${i < activeCells ? 'loaded flame-cell' : ''}"></div>`;
                            }
                            setHudHTML(magRoundsGrid, cellsHtml);

                            const spareTanks = Math.ceil(wep.reserve / wep.magMax);
                            setHudText(magCountLabel, `SPARE TANKS (${spareTanks})`);
                            if (spareTanks <= 0) {
                                setHudHTML(magCountIcons, '<span class="mag-empty-text">NONE</span>');
                            } else {
                                let tanksHtml = '';
                                for (let m = 0; m < Math.min(spareTanks, 8); m++) {
                                    tanksHtml += '<div class="mag-icon fuel-can"></div>';
                                }
                                setHudHTML(magCountIcons, tanksHtml);
                            }
                        } else {
                            const roundLabelWord = wep.isAirsoft ? 'BBS IN MAG' : 'ROUNDS IN MAG';
                            setHudText(magRoundsLabel, player.isReloading
                                ? `MAG EJECTED (0 / ${wep.magMax})`
                                : `${roundLabelWord} (${wep.mag} / ${wep.magMax})`);

                            const compact = wep.magMax > 20 ? ' compact' : '';
                            const tipCls = wep.isAirsoft
                                ? ' bb-pellet'
                                : (wep.pierce ? ' ap-tip' : ((wep.id === 'glock26' && wep.ammoLoad === 'jhp') ? ' jhp-tip' : ''));
                            let pipsHtml = '';
                            for (let i = 0; i < wep.magMax; i++) {
                                const isLoaded = i < wep.mag;
                                pipsHtml += `<div class="round-pip${compact}${isLoaded ? ' loaded' + tipCls : ''}"></div>`;
                            }
                            setHudHTML(magRoundsGrid, pipsHtml);

                            const fullMags = Math.floor(wep.reserve / wep.magMax);
                            const remainderRounds = wep.reserve % wep.magMax;
                            const totalSpareMags = fullMags + (remainderRounds > 0 ? 1 : 0);

                            setHudText(magCountLabel, wep.id === 'shotgun'
                                ? `SPARE TUBES (${totalSpareMags})`
                                : `SPARE MAGS (${totalSpareMags})`);

                            if (totalSpareMags <= 0) {
                                setHudHTML(magCountIcons, '<span class="mag-empty-text">DRY</span>');
                            } else {
                                const pinkCls = (wep.id === 'glock26' || wep.id === 'airsoft_pistol') ? ' pink-mag' : '';
                                const bbCls = wep.isAirsoft ? ' bb-mag' : '';
                                let magsHtml = '';
                                const maxIcons = Math.min(totalSpareMags, 10);
                                for (let m = 0; m < maxIcons; m++) {
                                    const isPartialLast = (m === totalSpareMags - 1) && remainderRounds > 0;
                                    magsHtml += `<div class="mag-icon${pinkCls}${bbCls}${isPartialLast ? ' partial' : ''}"></div>`;
                                }
                                if (totalSpareMags > 10) {
                                    magsHtml += `<span style="font-family:ui-monospace,monospace;font-size:10px;font-weight:800;color:#facc15;">+${totalSpareMags - 10}</span>`;
                                }
                                setHudHTML(magCountIcons, magsHtml);
                            }
                        }
                    }
                }

                if (isMobileDevice) {
                    const btnVeh = document.getElementById('btnVehicle');
                    const btnSpr = document.getElementById('btnSprint');
                    const btnUtil = document.getElementById('btnUtil');
                    const btnStr = document.getElementById('btnStrobe');
                    const btnOpt = document.getElementById('btnOptics');
                    if (btnVeh) setHudText(btnVeh, player.vehicle ? 'EXIT' : 'CAR [E]');
                    if (btnSpr) setHudText(btnSpr, player.vehicle ? 'BRAKE' : 'SPRINT');
                    if (btnOpt) {
                        btnOpt.classList.remove('optics-nvg', 'optics-thermal');
                        if (player.opticsMode === 'nvg') {
                            setHudText(btnOpt, 'NVG');
                            btnOpt.classList.add('optics-nvg');
                        } else if (player.opticsMode === 'thermal') {
                            setHudText(btnOpt, 'FLIR');
                            btnOpt.classList.add('optics-thermal');
                        } else {
                            setHudText(btnOpt, 'OPTICS');
                        }
                    }
                    if (btnUtil) {
                        if (player.vehicle) {
                            setHudText(btnUtil, 'HORN');
                            btnUtil.classList.remove('active');
                        } else if (player.hasFlashlight) {
                            setHudText(btnUtil, player.flashlightOn ? 'LIGHT ON' : 'LIGHT OFF');
                            btnUtil.classList.toggle('active', player.flashlightOn);
                        } else {
                            setHudText(btnUtil, 'SCOPE');
                        }
                    }
                    if (btnStr) {
                        btnStr.style.display = (!player.vehicle && player.hasFlashlight) ? 'flex' : 'none';
                        btnStr.classList.toggle('strobe-active', player.lightMode === 'strobe');
                    }
                }

                const slots = document.getElementById('slotBar');
                if (slots) {
                    const shortLabels = {
                        airsoft_pistol: 'G26 GBB',
                        rubber_knife: 'KNIFE',
                        airsoft_aeg: 'M4 AEG',
                        glock26: 'G26 PINK',
                        knife: 'BLADE',
                        ak47: 'AK-47',
                        lm4: 'LM4',
                        ruger: 'RUGER',
                        flamethrower: 'FLAMER',
                        glock: 'G17',
                        panga: 'PANGA',
                        shotgun: 'SHOTGUN',
                        ar15: 'AR-15'
                    };
                    const slotMarkup = WEAPONS.map((w, idx) => {
                        const cls = [
                            'wep-slot',
                            w.unlocked ? 'unlocked' : '',
                            (!player.vehicle && idx === player.wepIdx) ? 'active' : ''
                        ].filter(Boolean).join(' ');
                        return `<div class="${cls}" data-slot="${idx}">${idx + 1}: ${shortLabels[w.id] || w.id.toUpperCase()}</div>`;
                    }).join('');
                    setHudHTML(slots, slotMarkup);
                }
            }

            const slotBarElement = document.getElementById('slotBar');
            slotBarElement.addEventListener('click', (event) => {
                const slot = event.target.closest('.wep-slot.unlocked');
                if (!slot || !slotBarElement.contains(slot) || !player || player.vehicle) return;
                const idx = Number(slot.dataset.slot);
                if (WEAPONS[idx]?.unlocked) {
                    player.wepIdx = idx;
                    player.isReloading = false;
                    updateHUD();
                }
            });

            function renderRadarTerrain() {
                const w = radarCanvas.width;
                const h = radarCanvas.height;
                const scale = w / WORLD_SIZE;

                radarTerrainCtx.fillStyle = (mission && mission.campaign === 'training') ? '#102114' : '#090d16';
                radarTerrainCtx.fillRect(0, 0, w, h);

                if (woodlandCreek) {
                    radarTerrainCtx.strokeStyle = '#0284c7';
                    radarTerrainCtx.lineWidth = 3;
                    radarTerrainCtx.beginPath();
                    radarTerrainCtx.moveTo(woodlandCreek[0].x * scale, woodlandCreek[0].y * scale);
                    for (let i = 1; i < woodlandCreek.length; i++) {
                        radarTerrainCtx.lineTo(woodlandCreek[i].x * scale, woodlandCreek[i].y * scale);
                    }
                    radarTerrainCtx.stroke();
                }

                for (let i = 0; i < mallZones.length; i++) {
                    const mz = mallZones[i];
                    radarTerrainCtx.fillStyle = mz.floor;
                    radarTerrainCtx.fillRect(mz.x * scale, mz.y * scale, mz.w * scale, mz.h * scale);
                }

                radarTerrainCtx.fillStyle = '#1e293b';
                for (let i = 0; i < roads.length; i++) {
                    const r = roads[i];
                    radarTerrainCtx.fillRect(r.x * scale, r.y * scale, r.w * scale, r.h * scale);
                }

                radarTerrainCtx.fillStyle = '#57534e';
                for (let i = 0; i < railTracks.length; i++) {
                    const tr = railTracks[i];
                    radarTerrainCtx.fillRect(tr.x * scale, tr.y * scale, tr.w * scale, 1.5);
                }

                radarTerrainCtx.fillStyle = '#334155';
                for (let i = 0; i < buildings.length; i++) {
                    const b = buildings[i];
                    radarTerrainCtx.fillRect(b.x * scale, b.y * scale, b.w * scale, b.h * scale);
                }

            }

            function renderRadar() {
                if (!player) return;
                if (radarTerrainDirty) {
                    renderRadarTerrain();
                    radarTerrainDirty = false;
                }
                radarCtx.drawImage(radarTerrainCanvas, 0, 0);
                const w = radarCanvas.width;
                const h = radarCanvas.height;
                const scale = w / WORLD_SIZE;

                for (let i = 0; i < pickups.length; i++) {
                    const p = pickups[i];
                    if (p.collected) continue;
                    radarCtx.fillStyle = p.type === 'jhp_stash' ? '#ef4444' : (p.type === 'cash' ? '#22c55e' : (p.type === 'fuel' ? '#f97316' : '#38bdf8'));
                    radarCtx.fillRect(p.x * scale - 1.5, p.y * scale - 1.5, 3, 3);
                }

                radarCtx.fillStyle = '#eab308';
                for (let i = 0; i < vehicles.length; i++) {
                    const v = vehicles[i];
                    if (v.destroyed) continue;
                    radarCtx.fillRect(v.x * scale - 2, v.y * scale - 2, 4, 4);
                }

                // Friendly Allies on Radar
                for (let i = 0; i < allies.length; i++) {
                    const al = allies[i];
                    if (al.isOut) continue;
                    radarCtx.fillStyle = '#38bdf8';
                    radarCtx.beginPath();
                    radarCtx.arc(al.x * scale, al.y * scale, 3, 0, Math.PI * 2);
                    radarCtx.fill();
                }

                for (let i = 0; i < enemies.length; i++) {
                    const e = enemies[i];
                    if (e.hp <= 0) continue;
                    if (e.isUnarmed || e.panicState === 'fleeing' || e.panicState === 'wounded_retreat' || e.panicState === 'in_cover') {
                        radarCtx.fillStyle = '#fb923c';
                    } else {
                        radarCtx.fillStyle = e.isBoss ? '#f59e0b' : (e.faction === 'security' ? '#60a5fa' : '#ef4444');
                    }
                    const sz = e.isBoss ? 5 : 2.5;
                    radarCtx.fillRect(e.x * scale - sz / 2, e.y * scale - sz / 2, sz, sz);
                }

                if (mission) {
                    const pulse = 3 + Math.sin(performance.now() * 0.008) * 1.5;
                    radarCtx.strokeStyle = '#facc15';
                    radarCtx.lineWidth = 1.5;
                    radarCtx.beginPath();
                    radarCtx.arc(mission.targetX * scale, mission.targetY * scale, pulse, 0, Math.PI * 2);
                    radarCtx.stroke();
                }

                radarCtx.fillStyle = '#22c55e';
                radarCtx.beginPath();
                radarCtx.arc(player.x * scale, player.y * scale, 3.5, 0, Math.PI * 2);
                radarCtx.fill();
            }

            // ============================================================================
            // INDOOR POWER-OUTAGE DARKNESS, FLASHLIGHT/STROBE & NVG/THERMAL OPTICS
            // ============================================================================
            function renderMallLighting() {
                if (!mission || mission.campaign !== 'mall' || !player) return;
                if (player.opticsMode === 'thermal') return;

                lightCtx.globalCompositeOperation = 'source-over';
                lightCtx.clearRect(0, 0, lightCanvas.width, lightCanvas.height);

                const mallScreenX = 450 - camera.x;
                const mallScreenY = 450 - camera.y;
                const darknessAlpha = player.opticsMode === 'nvg' ? 0.36 : 0.90;
                lightCtx.fillStyle = `rgba(4, 7, 15, ${darknessAlpha})`;
                lightCtx.fillRect(mallScreenX, mallScreenY, 3200, 3100);

                const entranceX = 3630 - camera.x;
                const entranceY = 2050 - camera.y;
                lightCtx.globalCompositeOperation = 'destination-out';
                const dawnGrad = lightCtx.createRadialGradient(entranceX, entranceY, 30, entranceX, entranceY, 340);
                dawnGrad.addColorStop(0, 'rgba(0, 0, 0, 0.95)');
                dawnGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
                lightCtx.fillStyle = dawnGrad;
                lightCtx.beginPath();
                lightCtx.arc(entranceX, entranceY, 340, 0, Math.PI * 2);
                lightCtx.fill();

                for (let i = 0; i < mallLights.length; i++) {
                    const ml = mallLights[i];
                    const sx = ml.x - camera.x;
                    const sy = ml.y - camera.y;
                    if (sx < -400 || sx > lightCanvas.width + 400 || sy < -400 || sy > lightCanvas.height + 400) continue;
                    const flick = ml.flicker ? (0.85 + Math.sin(performance.now() * 0.03 + i * 2) * 0.15) : 1;
                    const rad = ml.r * flick;
                    const g = lightCtx.createRadialGradient(sx, sy, 8, sx, sy, rad);
                    g.addColorStop(0, 'rgba(0, 0, 0, 0.82)');
                    g.addColorStop(1, 'rgba(0, 0, 0, 0)');
                    lightCtx.fillStyle = g;
                    lightCtx.beginPath();
                    lightCtx.arc(sx, sy, rad, 0, Math.PI * 2);
                    lightCtx.fill();
                }

                const px = player.x - camera.x;
                const py = player.y - camera.y;

                const ambientG = lightCtx.createRadialGradient(px, py, 12, px, py, 92);
                ambientG.addColorStop(0, 'rgba(0, 0, 0, 0.92)');
                ambientG.addColorStop(1, 'rgba(0, 0, 0, 0)');
                lightCtx.fillStyle = ambientG;
                lightCtx.beginPath();
                lightCtx.arc(px, py, 92, 0, Math.PI * 2);
                lightCtx.fill();

                const isStrobe = player.lightMode === 'strobe';
                const strobePulse = !isStrobe || (Math.sin(performance.now() * 0.105) > 0);

                if (player.flashlightOn && !player.vehicle && strobePulse) {
                    const beamLen = isStrobe ? 475 : 460;
                    const halfSpread = isStrobe ? 0.36 : 0.34;
                    const beamGrad = lightCtx.createRadialGradient(px, py, 14, px, py, beamLen);
                    beamGrad.addColorStop(0, 'rgba(0, 0, 0, 1)');
                    beamGrad.addColorStop(0.68, 'rgba(0, 0, 0, 0.9)');
                    beamGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');

                    lightCtx.fillStyle = beamGrad;
                    lightCtx.beginPath();
                    lightCtx.moveTo(px, py);
                    lightCtx.arc(px, py, beamLen, player.angle - halfSpread, player.angle + halfSpread);
                    lightCtx.closePath();
                    lightCtx.fill();
                }

                // Muzzle flash burst illuminates the dark room (bigger burst for 120gr +P JHP!)
                if (performance.now() - player.lastShot < 68) {
                    const wep = WEAPONS[player.wepIdx];
                    const isJHP = (wep && wep.id === 'glock26' && wep.ammoLoad === 'jhp');
                    const flashBurstRad = isJHP ? 370 : 230;
                    const flashG = lightCtx.createRadialGradient(px, py, 10, px, py, flashBurstRad);
                    flashG.addColorStop(0, 'rgba(0, 0, 0, 0.96)');
                    flashG.addColorStop(1, 'rgba(0, 0, 0, 0)');
                    lightCtx.fillStyle = flashG;
                    lightCtx.beginPath();
                    lightCtx.arc(px, py, flashBurstRad, 0, Math.PI * 2);
                    lightCtx.fill();
                }

                ctx.drawImage(lightCanvas, 0, 0);

                if (player.flashlightOn && !player.vehicle && strobePulse) {
                    ctx.save();
                    const beamLen = isStrobe ? 465 : 440;
                    const halfSpread = isStrobe ? 0.35 : 0.33;
                    const tint = ctx.createRadialGradient(px, py, 12, px, py, beamLen);
                    if (isStrobe) {
                        tint.addColorStop(0, 'rgba(224, 242, 254, 0.34)');
                        tint.addColorStop(0.6, 'rgba(186, 230, 253, 0.14)');
                        tint.addColorStop(1, 'rgba(186, 230, 253, 0)');
                    } else {
                        tint.addColorStop(0, 'rgba(254, 249, 195, 0.16)');
                        tint.addColorStop(1, 'rgba(254, 249, 195, 0)');
                    }
                    ctx.fillStyle = tint;
                    ctx.beginPath();
                    ctx.moveTo(px, py);
                    ctx.arc(px, py, beamLen, player.angle - halfSpread, player.angle + halfSpread);
                    ctx.closePath();
                    ctx.fill();
                    ctx.restore();
                }

                for (let i = 0; i < mallLights.length; i++) {
                    const ml = mallLights[i];
                    const sx = ml.x - camera.x;
                    const sy = ml.y - camera.y;
                    if (sx < -300 || sx > canvas.width + 300 || sy < -300 || sy > canvas.height + 300) continue;
                    const g = ctx.createRadialGradient(sx, sy, 4, sx, sy, ml.r * 0.75);
                    g.addColorStop(0, ml.color);
                    g.addColorStop(1, 'rgba(0, 0, 0, 0)');
                    ctx.fillStyle = g;
                    ctx.beginPath();
                    ctx.arc(sx, sy, ml.r * 0.75, 0, Math.PI * 2);
                    ctx.fill();
                }
            }

            // Render NVG Phosphor Green / FLIR White-Hot Thermal Overlay + Invisible IR Aiming Laser
            function renderOpticsOverlay(shakeX, shakeY) {
                if (!player || player.opticsMode === 'standard') return;

                if (player.opticsMode === 'nvg') {
                    ctx.save();
                    ctx.fillStyle = 'rgba(16, 185, 129, 0.24)';
                    ctx.fillRect(0, 0, canvas.width, canvas.height);

                    ctx.fillStyle = 'rgba(4, 47, 46, 0.16)';
                    for (let y = 0; y < canvas.height; y += 4) {
                        ctx.fillRect(0, y, canvas.width, 1.5);
                    }

                    const vig = ctx.createRadialGradient(
                        canvas.width / 2, canvas.height / 2, canvas.height * 0.34,
                        canvas.width / 2, canvas.height / 2, canvas.width * 0.65
                    );
                    vig.addColorStop(0, 'rgba(0, 0, 0, 0)');
                    vig.addColorStop(1, 'rgba(2, 18, 12, 0.72)');
                    ctx.fillStyle = vig;
                    ctx.fillRect(0, 0, canvas.width, canvas.height);
                    ctx.restore();
                } else if (player.opticsMode === 'thermal') {
                    ctx.save();
                    ctx.fillStyle = 'rgba(7, 13, 32, 0.68)';
                    ctx.fillRect(0, 0, canvas.width, canvas.height);

                    ctx.translate(-camera.x + shakeX, -camera.y + shakeY);

                    for (let i = 0; i < vehicles.length; i++) {
                        const v = vehicles[i];
                        if (v.destroyed) continue;
                        ctx.save();
                        ctx.translate(v.x, v.y);
                        ctx.rotate(v.angle);
                        ctx.fillStyle = 'rgba(251, 146, 60, 0.55)';
                        ctx.fillRect(v.w * 0.15, -v.h * 0.35, v.w * 0.3, v.h * 0.7);
                        ctx.restore();
                    }

                    for (let i = 0; i < allies.length; i++) {
                        const al = allies[i];
                        const g = ctx.createRadialGradient(al.x, al.y, 2, al.x, al.y, 18);
                        g.addColorStop(0, 'rgba(255, 255, 255, 0.96)');
                        g.addColorStop(0.55, 'rgba(186, 230, 253, 0.55)');
                        g.addColorStop(1, 'rgba(56, 189, 248, 0)');
                        ctx.fillStyle = g;
                        ctx.beginPath();
                        ctx.arc(al.x, al.y, 18, 0, Math.PI * 2);
                        ctx.fill();
                    }

                    for (let i = 0; i < civilians.length; i++) {
                        const c = civilians[i];
                        const g = ctx.createRadialGradient(c.x, c.y, 2, c.x, c.y, 18);
                        g.addColorStop(0, 'rgba(255, 255, 255, 0.96)');
                        g.addColorStop(0.55, 'rgba(253, 224, 71, 0.55)');
                        g.addColorStop(1, 'rgba(251, 146, 60, 0)');
                        ctx.fillStyle = g;
                        ctx.beginPath();
                        ctx.arc(c.x, c.y, 18, 0, Math.PI * 2);
                        ctx.fill();
                    }

                    for (let i = 0; i < enemies.length; i++) {
                        const e = enemies[i];
                        if (e.hp <= 0) continue;
                        const rad = e.isBoss ? 26 : (e.faction === 'dog' ? 14 : 20);
                        const g = ctx.createRadialGradient(e.x, e.y, 2, e.x, e.y, rad);
                        g.addColorStop(0, 'rgba(255, 255, 255, 1)');
                        g.addColorStop(0.5, e.burnTimer > 0 ? 'rgba(249, 115, 22, 0.85)' : 'rgba(254, 240, 138, 0.65)');
                        g.addColorStop(1, 'rgba(234, 88, 12, 0)');
                        ctx.fillStyle = g;
                        ctx.beginPath();
                        ctx.arc(e.x, e.y, rad, 0, Math.PI * 2);
                        ctx.fill();
                    }

                    for (let i = 0; i < flameJets.length; i++) {
                        const fj = flameJets[i];
                        if (!fj.active) continue;
                        ctx.fillStyle = 'rgba(255, 255, 255, 0.88)';
                        ctx.beginPath();
                        ctx.arc(fj.x, fj.y, fj.radius, 0, Math.PI * 2);
                        ctx.fill();
                    }

                    if (!player.vehicle) {
                        const pg = ctx.createRadialGradient(player.x, player.y, 2, player.x, player.y, 18);
                        pg.addColorStop(0, 'rgba(255, 255, 255, 0.95)');
                        pg.addColorStop(0.6, 'rgba(186, 230, 253, 0.45)');
                        pg.addColorStop(1, 'rgba(56, 189, 248, 0)');
                        ctx.fillStyle = pg;
                        ctx.beginPath();
                        ctx.arc(player.x, player.y, 18, 0, Math.PI * 2);
                        ctx.fill();
                    }

                    ctx.restore();
                }

                // Draw Invisible Infrared (IR) Aiming Laser (Visible ONLY through NVG or Thermal!)
                if (!player.vehicle && WEAPONS[player.wepIdx].type !== 'melee') {
                    ctx.save();
                    ctx.translate(-camera.x + shakeX, -camera.y + shakeY);

                    const wep = WEAPONS[player.wepIdx];
                    const maxLaserDist = wep.id === 'ruger' ? 1150 : 760;
                    const startX = player.x + Math.cos(player.angle) * 18;
                    const startY = player.y + Math.sin(player.angle) * 18;
                    const rawEndX = startX + Math.cos(player.angle) * maxLaserDist;
                    const rawEndY = startY + Math.sin(player.angle) * maxLaserDist;

                    let hitT = raycastBuildingsT(startX, startY, rawEndX, rawEndY);

                    for (let i = 0; i < enemies.length; i++) {
                        const e = enemies[i];
                        if (e.hp <= 0) continue;
                        const t = segmentCircleIntersectT(startX, startY, rawEndX, rawEndY, e.x, e.y, e.r);
                        if (t !== null && t < hitT) {
                            hitT = t;
                        }
                    }

                    const endX = startX + (rawEndX - startX) * hitT;
                    const endY = startY + (rawEndY - startY) * hitT;

                    const isNvg = player.opticsMode === 'nvg';
                    ctx.strokeStyle = isNvg ? 'rgba(134, 239, 172, 0.72)' : 'rgba(255, 255, 255, 0.78)';
                    ctx.lineWidth = 1.6;
                    ctx.beginPath();
                    ctx.moveTo(startX, startY);
                    ctx.lineTo(endX, endY);
                    ctx.stroke();

                    ctx.fillStyle = isNvg ? '#bbf7d0' : '#ffffff';
                    ctx.beginPath();
                    ctx.arc(endX, endY, 3.2, 0, Math.PI * 2);
                    ctx.fill();

                    ctx.restore();
                }
            }

            // ============================================================================
            // MAIN SCENE RENDERER
            // ============================================================================
            function isInView(x, y, margin = 160) {
                return x >= camera.x - margin && x <= camera.x + canvas.width + margin &&
                    y >= camera.y - margin && y <= camera.y + canvas.height + margin;
            }

            function render() {
                const isTraining = mission && mission.campaign === 'training';
                ctx.fillStyle = isTraining ? '#162918' : '#181c24';
                ctx.fillRect(0, 0, canvas.width, canvas.height);

                const shakeX = camera.shake > 0.1 ? Math2.rand(-camera.shake, camera.shake) : 0;
                const shakeY = camera.shake > 0.1 ? Math2.rand(-camera.shake, camera.shake) : 0;

                ctx.save();
                ctx.translate(-camera.x + shakeX, -camera.y + shakeY);

                // Woodland Creek & Dirt Trails (Training Stage)
                if (isTraining && woodlandCreek) {
                    ctx.save();
                    ctx.strokeStyle = '#0369a1';
                    ctx.lineWidth = 68;
                    ctx.lineCap = 'round';
                    ctx.lineJoin = 'round';
                    ctx.beginPath();
                    ctx.moveTo(woodlandCreek[0].x, woodlandCreek[0].y);
                    for (let i = 1; i < woodlandCreek.length; i++) {
                        ctx.lineTo(woodlandCreek[i].x, woodlandCreek[i].y);
                    }
                    ctx.stroke();

                    ctx.strokeStyle = 'rgba(125, 211, 252, 0.35)';
                    ctx.lineWidth = 28;
                    ctx.stroke();

                    // Forest dirt path from Youth Staging -> Bridge -> Sandbag Ridge -> Adult HQ
                    ctx.strokeStyle = 'rgba(120, 53, 15, 0.38)';
                    ctx.lineWidth = 46;
                    ctx.setLineDash([18, 12]);
                    ctx.beginPath();
                    ctx.moveTo(780, 3260);
                    ctx.lineTo(2200, 2150);
                    ctx.lineTo(2880, 1470);
                    ctx.lineTo(3540, 1040);
                    ctx.stroke();
                    ctx.setLineDash([]);
                    ctx.restore();
                }

                // Indoor Mall Zones
                for (let i = 0; i < mallZones.length; i++) {
                    const mz = mallZones[i];
                    ctx.fillStyle = mz.floor;
                    ctx.fillRect(mz.x, mz.y, mz.w, mz.h);
                    ctx.strokeStyle = 'rgba(148, 163, 184, 0.14)';
                    ctx.lineWidth = 2;
                    ctx.strokeRect(mz.x, mz.y, mz.w, mz.h);
                    if (mz.label) {
                        ctx.fillStyle = 'rgba(148, 163, 184, 0.16)';
                        ctx.font = '900 18px ui-monospace, monospace';
                        ctx.textAlign = 'center';
                        ctx.fillText(mz.label, mz.x + mz.w / 2, mz.y + 42);
                    }
                }

                // Sidewalk / Mall Tile Grid (Omitted in natural woodland)
                if (!isTraining) {
                    ctx.strokeStyle = 'rgba(255, 255, 255, 0.035)';
                    ctx.lineWidth = 1;
                    const gridStep = (mission && mission.campaign === 'mall') ? 64 : 100;
                    const startGridX = Math.floor(camera.x / gridStep) * gridStep;
                    const startGridY = Math.floor(camera.y / gridStep) * gridStep;
                    for (let gx = startGridX; gx < camera.x + canvas.width + gridStep; gx += gridStep) {
                        ctx.beginPath();
                        ctx.moveTo(gx, camera.y);
                        ctx.lineTo(gx, camera.y + canvas.height);
                        ctx.stroke();
                    }
                    for (let gy = startGridY; gy < camera.y + canvas.height + gridStep; gy += gridStep) {
                        ctx.beginPath();
                        ctx.moveTo(camera.x, gy);
                        ctx.lineTo(camera.x + canvas.width, gy);
                        ctx.stroke();
                    }
                }

                // Asphalt Roads
                for (let i = 0; i < roads.length; i++) {
                    const r = roads[i];
                    if (r.x > camera.x + canvas.width + 80 || r.x + r.w < camera.x - 80 ||
                        r.y > camera.y + canvas.height + 80 || r.y + r.h < camera.y - 80) continue;
                    ctx.fillStyle = '#11141c';
                    ctx.fillRect(r.x, r.y, r.w, r.h);

                    ctx.strokeStyle = 'rgba(250, 204, 21, 0.32)';
                    ctx.lineWidth = 2;
                    ctx.setLineDash([22, 24]);
                    ctx.beginPath();
                    if (r.dir === 'h') {
                        ctx.moveTo(r.x, r.y + r.h / 2);
                        ctx.lineTo(r.x + r.w, r.y + r.h / 2);
                    } else {
                        ctx.moveTo(r.x + r.w / 2, r.y);
                        ctx.lineTo(r.x + r.w / 2, r.y + r.h);
                    }
                    ctx.stroke();
                    ctx.setLineDash([]);
                }

                // Freight Rail Tracks
                for (let i = 0; i < railTracks.length; i++) {
                    const tr = railTracks[i];
                    if (tr.x > camera.x + canvas.width + 80 || tr.x + tr.w < camera.x - 80 ||
                        tr.y > camera.y + canvas.height + 80 || tr.y < camera.y - 80) continue;
                    ctx.fillStyle = '#1c1917';
                    ctx.fillRect(tr.x, tr.y - 8, tr.w, 16);
                    ctx.fillStyle = '#44403c';
                    for (let tx = tr.x + 6; tx < tr.x + tr.w - 6; tx += 14) {
                        ctx.fillRect(tx, tr.y - 7, 5, 14);
                    }
                    ctx.strokeStyle = '#94a3b8';
                    ctx.lineWidth = 1.5;
                    ctx.beginPath();
                    ctx.moveTo(tr.x, tr.y - 4);
                    ctx.lineTo(tr.x + tr.w, tr.y - 4);
                    ctx.moveTo(tr.x, tr.y + 4);
                    ctx.lineTo(tr.x + tr.w, tr.y + 4);
                    ctx.stroke();
                }

                // Downtown Pedestrian Crosswalks
                ctx.fillStyle = 'rgba(226, 232, 240, 0.24)';
                for (let i = 0; i < crosswalks.length; i++) {
                    const cw = crosswalks[i];
                    if (!isInView(cw.x + 44, cw.y + 44)) continue;
                    if (cw.dir === 'h') {
                        for (let s = 0; s < 88; s += 16) {
                            ctx.fillRect(cw.x + s, cw.y, 9, 12);
                        }
                    } else {
                        for (let s = 0; s < 88; s += 16) {
                            ctx.fillRect(cw.x, cw.y + s, 12, 9);
                        }
                    }
                }

                // Ground Decals
                for (let i = 0; i < decals.length; i++) {
                    if (isInView(decals[i].x, decals[i].y)) decals[i].draw(ctx);
                }

                // Subtle Tactical Last Known Position (LKP) ghost reticle
                if (player && player.hp > 0) {
                    let activeLkp = null;
                    for (let i = 0; i < enemies.length; i++) {
                        const e = enemies[i];
                        if (e.hp > 0 && !e.isUnarmed && e.lkpTimer > 1.2 && e.lkpX !== null && e.hesitationTimer < 0.1) {
                            if (Math2.dist(player.x, player.y, e.lkpX, e.lkpY) > 70) {
                                activeLkp = { x: e.lkpX, y: e.lkpY };
                                break;
                            }
                        }
                    }
                    if (activeLkp) {
                        const pulse = 16 + Math.sin(performance.now() * 0.008) * 4;
                        ctx.save();
                        ctx.strokeStyle = 'rgba(250, 204, 21, 0.45)';
                        ctx.lineWidth = 1.5;
                        ctx.setLineDash([5, 4]);
                        ctx.beginPath();
                        ctx.arc(activeLkp.x, activeLkp.y, pulse, 0, Math.PI * 2);
                        ctx.stroke();
                        ctx.setLineDash([]);
                        ctx.fillStyle = 'rgba(250, 204, 21, 0.65)';
                        ctx.font = '800 9px ui-monospace, monospace';
                        ctx.textAlign = 'center';
                        ctx.fillText('LKP', activeLkp.x, activeLkp.y - pulse - 4);
                        ctx.restore();
                    }
                }

                // Spent Brass Shells
                for (let i = 0; i < shells.length; i++) {
                    if (isInView(shells[i].x, shells[i].y)) shells[i].draw(ctx);
                }

                // Tossed / Dropped Magazines
                for (let i = 0; i < droppedMags.length; i++) {
                    if (isInView(droppedMags[i].x, droppedMags[i].y)) droppedMags[i].draw(ctx);
                }

                // Pickups
                for (let i = 0; i < pickups.length; i++) {
                    if (isInView(pickups[i].x, pickups[i].y)) pickups[i].draw(ctx);
                }

                // Vehicles
                for (let i = 0; i < vehicles.length; i++) {
                    if (isInView(vehicles[i].x, vehicles[i].y)) vehicles[i].draw(ctx);
                }

                // Trapped Shoppers / Civilians
                for (let i = 0; i < civilians.length; i++) {
                    if (isInView(civilians[i].x, civilians[i].y)) civilians[i].draw(ctx);
                }

                // Friendly Allies (Younger G & Younger Blaze)
                for (let i = 0; i < allies.length; i++) {
                    if (isInView(allies[i].x, allies[i].y)) allies[i].draw(ctx);
                }

                // Enemies
                for (let i = 0; i < enemies.length; i++) {
                    if (isInView(enemies[i].x, enemies[i].y)) enemies[i].draw(ctx);
                }

                // Player
                if (player) {
                    player.draw(ctx);
                }

                // Flamethrower Jets
                for (let i = 0; i < flameJets.length; i++) {
                    if (isInView(flameJets[i].x, flameJets[i].y)) flameJets[i].draw(ctx);
                }

                // Bullets & 6mm BBs
                for (let i = 0; i < bullets.length; i++) {
                    if (isInView(bullets[i].x, bullets[i].y)) bullets[i].draw(ctx);
                }

                // 2.5D Buildings with Rooftop Details
                const viewCenterX = camera.x + canvas.width / 2;
                const viewCenterY = camera.y + canvas.height / 2;

                for (let i = 0; i < buildings.length; i++) {
                    const b = buildings[i];
                    if (b.x + b.w < camera.x - 120 || b.x > camera.x + canvas.width + 120 ||
                        b.y + b.h < camera.y - 120 || b.y > camera.y + canvas.height + 120) {
                        continue;
                    }

                    if (b.isLowWall) {
                        ctx.fillStyle = b.roof;
                        ctx.fillRect(b.x, b.y, b.w, b.h);
                        ctx.strokeStyle = '#94a3b8';
                        ctx.lineWidth = 1;
                        ctx.strokeRect(b.x, b.y, b.w, b.h);
                        continue;
                    }

                    const depth = b.height || 16;
                    const offX = Math2.clamp(((b.x + b.w / 2) - viewCenterX) * 0.035, -depth, depth);
                    const offY = Math2.clamp(((b.y + b.h / 2) - viewCenterY) * 0.035, -depth, depth);

                    ctx.fillStyle = b.color;
                    ctx.beginPath();
                    ctx.moveTo(b.x, b.y);
                    ctx.lineTo(b.x + offX, b.y + offY);
                    ctx.lineTo(b.x + b.w + offX, b.y + offY);
                    ctx.lineTo(b.x + b.w, b.y);
                    ctx.closePath();
                    ctx.fill();

                    ctx.beginPath();
                    ctx.moveTo(b.x, b.y + b.h);
                    ctx.lineTo(b.x + offX, b.y + b.h + offY);
                    ctx.lineTo(b.x + b.w + offX, b.y + b.h + offY);
                    ctx.lineTo(b.x + b.w, b.y + b.h);
                    ctx.closePath();
                    ctx.fill();

                    ctx.beginPath();
                    ctx.moveTo(b.x, b.y);
                    ctx.lineTo(b.x + offX, b.y + offY);
                    ctx.lineTo(b.x + offX, b.y + b.h + offY);
                    ctx.lineTo(b.x, b.y + b.h);
                    ctx.closePath();
                    ctx.fill();

                    ctx.beginPath();
                    ctx.moveTo(b.x + b.w, b.y);
                    ctx.lineTo(b.x + b.w + offX, b.y + offY);
                    ctx.lineTo(b.x + b.w + offX, b.y + b.h + offY);
                    ctx.lineTo(b.x + b.w, b.y + b.h);
                    ctx.closePath();
                    ctx.fill();

                    const rx = b.x + offX;
                    const ry = b.y + offY;
                    ctx.fillStyle = b.roof;
                    ctx.fillRect(rx, ry, b.w, b.h);
                    ctx.strokeStyle = 'rgba(148, 163, 184, 0.25)';
                    ctx.lineWidth = 1.5;
                    ctx.strokeRect(rx, ry, b.w, b.h);

                    if (b.roofProp === 'helipad') {
                        const cx = rx + b.w / 2;
                        const cy = ry + b.h / 2;
                        ctx.strokeStyle = 'rgba(250, 204, 21, 0.55)';
                        ctx.lineWidth = 3;
                        ctx.beginPath();
                        ctx.arc(cx, cy, Math.min(b.w, b.h) * 0.26, 0, Math.PI * 2);
                        ctx.stroke();
                        ctx.fillStyle = 'rgba(250, 204, 21, 0.55)';
                        ctx.font = '900 28px system-ui, sans-serif';
                        ctx.textAlign = 'center';
                        ctx.textBaseline = 'middle';
                        ctx.fillText('H', cx, cy);
                    } else if (b.roofProp === 'skylight') {
                        ctx.fillStyle = 'rgba(56, 189, 248, 0.16)';
                        ctx.fillRect(rx + 28, ry + 28, b.w - 56, b.h - 56);
                        ctx.strokeStyle = 'rgba(125, 211, 252, 0.35)';
                        ctx.lineWidth = 1.5;
                        ctx.strokeRect(rx + 28, ry + 28, b.w - 56, b.h - 56);
                    } else if (b.roofProp === 'hvac') {
                        ctx.fillStyle = 'rgba(15, 23, 42, 0.45)';
                        ctx.fillRect(rx + 24, ry + 24, 34, 24);
                        ctx.fillRect(rx + b.w - 58, ry + b.h - 48, 34, 24);
                    }

                    if (b.label) {
                        ctx.fillStyle = 'rgba(248, 250, 252, 0.85)';
                        ctx.font = '800 11px ui-monospace, monospace';
                        ctx.textAlign = 'center';
                        ctx.textBaseline = 'alphabetic';
                        ctx.fillText(b.label, rx + b.w / 2, ry + b.h / 2 + 4);
                    }
                }

                // Woodland Pine & Acacia Tree Trunks + Translucent Overhead Canopies
                for (let i = 0; i < woodlandTrees.length; i++) {
                    const tr = woodlandTrees[i];
                    if (tr.x + tr.canopyR < camera.x - 80 || tr.x - tr.canopyR > camera.x + canvas.width + 80 ||
                        tr.y + tr.canopyR < camera.y - 80 || tr.y - tr.canopyR > camera.y + canvas.height + 80) {
                        continue;
                    }
                    // Ground shadow
                    ctx.fillStyle = 'rgba(0, 0, 0, 0.32)';
                    ctx.beginPath();
                    ctx.arc(tr.x + 8, tr.y + 10, tr.canopyR * 0.92, 0, Math.PI * 2);
                    ctx.fill();

                    // Solid trunk
                    ctx.fillStyle = '#451a03';
                    ctx.beginPath();
                    ctx.arc(tr.x, tr.y, tr.trunkR, 0, Math.PI * 2);
                    ctx.fill();

                    // Translucent pine canopy (so you can still see players underneath!)
                    ctx.save();
                    ctx.globalAlpha = 0.76;
                    ctx.fillStyle = tr.shade;
                    ctx.beginPath();
                    ctx.arc(tr.x, tr.y, tr.canopyR, 0, Math.PI * 2);
                    ctx.fill();
                    ctx.strokeStyle = '#052e16';
                    ctx.lineWidth = 2;
                    ctx.stroke();
                    ctx.restore();
                }

                // Particles
                for (let i = 0; i < particles.length; i++) {
                    if (isInView(particles[i].x, particles[i].y)) particles[i].draw(ctx);
                }

                // Adults' HQ Capture Flag (Training Stage)
                if (isTraining) {
                    const pulse = 32 + Math.sin(performance.now() * 0.006) * 7;
                    ctx.strokeStyle = 'rgba(245, 158, 11, 0.85)';
                    ctx.lineWidth = 3;
                    ctx.beginPath();
                    ctx.arc(3540, 1040, pulse, 0, Math.PI * 2);
                    ctx.stroke();
                    // Flagpole + waving orange flag
                    ctx.fillStyle = '#f8fafc';
                    ctx.fillRect(3538, 1005, 3, 35);
                    ctx.fillStyle = '#f97316';
                    ctx.beginPath();
                    ctx.moveTo(3541, 1005);
                    ctx.lineTo(3566, 1014);
                    ctx.lineTo(3541, 1023);
                    ctx.closePath();
                    ctx.fill();
                    ctx.fillStyle = '#fde047';
                    ctx.font = '900 10.5px ui-monospace, monospace';
                    ctx.textAlign = 'center';
                    ctx.fillText('ADULT HQ FLAG', 3540, 1056);
                }

                // Exfil Checkpoint Marker (Mall Blockade Stage 4)
                if (mission && mission.campaign === 'mall') {
                    const pulse = 36 + Math.sin(performance.now() * 0.006) * 8;
                    ctx.strokeStyle = 'rgba(34, 197, 94, 0.75)';
                    ctx.lineWidth = 3;
                    ctx.beginPath();
                    ctx.arc(3980, 2050, pulse, 0, Math.PI * 2);
                    ctx.stroke();
                    ctx.fillStyle = '#4ade80';
                    ctx.font = '900 11px ui-monospace, monospace';
                    ctx.textAlign = 'center';
                    ctx.fillText('EXFIL CHECKPOINT', 3980, 2000);
                }

                // Objective Direction Pointer around Player
                if (mission && player && player.hp > 0) {
                    const distToObj = Math2.dist(player.x, player.y, mission.targetX, mission.targetY);
                    if (distToObj > 140) {
                        const ang = Math2.angle(player.x, player.y, mission.targetX, mission.targetY);
                        const px = player.x + Math.cos(ang) * 44;
                        const py = player.y + Math.sin(ang) * 44;
                        ctx.save();
                        ctx.translate(px, py);
                        ctx.rotate(ang);
                        ctx.fillStyle = '#facc15';
                        ctx.beginPath();
                        ctx.moveTo(8, 0);
                        ctx.lineTo(-5, -5);
                        ctx.lineTo(-2, 0);
                        ctx.lineTo(-5, 5);
                        ctx.closePath();
                        ctx.fill();
                        ctx.restore();
                    }
                }

                ctx.restore();

                // Indoor Mall Power-Outage Darkness + Yael's Tactical Flashlight / Strobe Beam
                renderMallLighting();

                // NVG / Thermal Imaging Overlay + Invisible IR Aiming Laser
                renderOpticsOverlay(shakeX, shakeY);

                renderRadar();
            }

            // ============================================================================
            // GAME LOOP & LIFECYCLE
            // ============================================================================
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
                        endBody.innerText = `Younger Yael, Younger G, and Younger Blaze outflanked the grown-up MilSim squad through the pine woods, tagged out ${kills} adult players, and captured their HQ flag!`;
                    } else if (camp === 'mall') {
                        endKicker.innerText = 'SHOPPING MALL // EXFIL CHECKPOINT REACHED';
                        endTitle.innerText = 'ESCAPED THE BLOCKADE';
                        endBody.innerText = `Fighting out of the pitch-dark discount shop with your pink Glock 26, you broke the looter mobs, cleared the Kalashnikov taxi blockade, looted R${cashCollected.toLocaleString()}, and neutralized ${kills} hostiles.`;
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

                    const wep = WEAPONS[player.wepIdx];
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
                    body.innerHTML = 'Years before the grid went dark—a Sunday morning airsoft skirmish in a dense pine woodland. Play as <strong>Younger Yael</strong> alongside <strong>Younger G</strong> and <strong>Younger Blaze</strong> in a 3-player youth squad facing off against an entrenched team of <strong>grown-up MilSim adults</strong>. Use forest cover, coordinate with your teammates, and capture the adults\' base flag!';
                } else if (camp === 'mall') {
                    kicker.innerText = 'SHOPPING MALL // 07:00 AM POWER OUTAGE';
                    body.innerHTML = '07:00 AM — two hours after the initial impact. Trapped inside a pitch-dark Chinese discount shop, <strong>Yael</strong> packs a custom <strong>Glock 26</strong> loaded with <strong>100gr FMJ</strong> (and can scavenge <strong>120gr +P JHP</strong> hollow-point stashes <strong>[B]</strong>—bigger flash and louder bang, but huge stopping power), under-barrel light (<strong>[F]</strong>) + strobe (<strong>[T]</strong>), and <strong>NVG / Thermal goggles ([V])</strong>.';
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
                    player = new Player(760, 3260, 'young_yael');
                    updatePortraitSVG('young_yael');
                    initTrainingMissions();
                } else if (selectedCampaign === 'mall') {
                    generateMallWorld();
                    player = new Player(740, 3150, 'mall');
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
                    initCBDMissions();
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
                gameState = 'menu';
                syncMobileControlsVisibility();
            });

            // Initialize platform detection, start card portraits, and preview backdrop
            populateStartCardAvatars();
            detectPlatform();
            initMobileControls();
            generateWoodlandWorld();
            updatePortraitSVG('young_yael');
            camera.x = 550;
            camera.y = 2750;
            requestAnimationFrame(gameLoop);
        })();
