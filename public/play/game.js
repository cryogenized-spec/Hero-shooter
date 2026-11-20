
        (function () {
            const canvas = document.getElementById('gameCanvas');
            const ctx = canvas.getContext('2d');
            const miniCanvas = document.getElementById('minimapCanvas');
            const miniCtx = miniCanvas.getContext('2d');

            // ============================================================================
            // DECOUPLED ASSET MANIFEST (READY FOR EXTERNAL WEBP / SQUOOSHED IMAGES)
            // ============================================================================
            window.HERO_ASSETS = window.HERO_ASSETS || {
                portraits: {
                    training: null,
                    mall: null,
                    cbd: null,
                    sniper: null,
                    suburbs: null
                }
            };
            // Approved circular anime portrait of C for the Golden Dragon stage.
            // Preserve an explicitly configured external artwork override.
            window.HERO_ASSETS.portraits = window.HERO_ASSETS.portraits || {};
            window.HERO_ASSETS.portraits.mall ||= '../assets/portraits/c-portrait.webp';

            // Approved original soundtrack recording for Golden Dragon.
            // The committed MP3 is byte-identical to the user's original upload.
            // Check source-provider reuse terms before commercial redistribution.
            const PHOENIX_TRACK_URL = '../assets/music/phoenix-arise.mp3';

            // ============================================================================
            // CUSTOM INLINE SVG CHARACTER PORTRAITS (DYNAMIC GEAR + TOGGLEABLE EARBUDS)
            // ============================================================================
            function getCharacterPortraitSVG(heroType, hasEarbuds = false, hasMolleVest = false) {
                const earbudsLayer = hasEarbuds ? `
                    <circle cx="48" cy="54" r="3.4" fill="#ffffff" stroke="#0f172a" stroke-width="1"/>
                    <circle cx="72" cy="54" r="3.4" fill="#ffffff" stroke="#0f172a" stroke-width="1"/>
                    <path d="M48 57 Q44 76 52 94" stroke="#f8fafc" stroke-width="2" fill="none"/>
                    <path d="M72 57 Q76 76 68 94" stroke="#f8fafc" stroke-width="2" fill="none"/>
                ` : '';

                if (heroType === 'young_c') {
                    return `<svg viewBox="0 0 120 120" xmlns="http://www.w3.org/2000/svg">
                        <defs><linearGradient id="bgYC" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stop-color="#064e3b"/><stop offset="100%" stop-color="#14532d"/></linearGradient></defs>
                        <rect width="120" height="120" fill="url(#bgYC)"/>
                        <circle cx="84" cy="30" r="14" fill="#090d16"/>
                        <path d="M78 24 Q98 30 92 56 Q84 46 76 36 Z" fill="#090d16"/>
                        <path d="M35 50 Q35 20 60 20 Q85 20 85 50 L84 68 L36 68 Z" fill="#090d16"/>
                        <path d="M43 44 Q43 27 60 27 Q77 27 77 44 L76 62 Q76 76 60 79 Q44 76 44 62 Z" fill="#c98e6b"/>
                        <rect x="42" y="42" width="36" height="11" rx="3" fill="rgba(186,230,253,0.45)" stroke="#e2e8f0" stroke-width="1.8"/>
                        <line x1="58" y1="42" x2="62" y2="53" stroke="#ffffff" stroke-width="1.2" opacity="0.7"/>
                        <circle cx="51" cy="48" r="2.2" fill="#090d16"/><circle cx="69" cy="48" r="2.2" fill="#090d16"/>
                        <path d="M54 65 Q60 69 66 65" stroke="#854d3d" stroke-width="2" fill="none" stroke-linecap="round"/>
                        <path d="M22 120 L32 82 L88 82 L98 120 Z" fill="#3f6212"/>
                        <rect x="44" y="84" width="32" height="36" fill="#4d7c0f"/>
                        ${earbudsLayer}
                        <rect x="74" y="76" width="22" height="11" rx="2" fill="#ec4899" stroke="#111827" stroke-width="1.4"/>
                        <rect x="76" y="71" width="20" height="6" rx="1" fill="#1e293b"/>
                        <circle cx="96" cy="74" r="2.5" fill="#f97316"/>
                    </svg>`;
                }

                if (heroType === 'israeli_c') {
                    const torsoSVG = hasMolleVest ? `
                        <path d="M20 120 L30 82 L90 82 L100 120 Z" fill="#365314"/>
                        <rect x="38" y="82" width="44" height="38" rx="4" fill="#3f6212" stroke="#1a2e05" stroke-width="1.5"/>
                        <line x1="40" y1="92" x2="80" y2="92" stroke="#1a2e05" stroke-width="2"/>
                        <line x1="40" y1="101" x2="80" y2="101" stroke="#1a2e05" stroke-width="2"/>
                        <line x1="40" y1="110" x2="80" y2="110" stroke="#1a2e05" stroke-width="2"/>
                        <rect x="44" y="84" width="10" height="14" rx="1.5" fill="#1e293b" stroke="#ec4899" stroke-width="1"/>
                    ` : `
                        <path d="M20 120 L30 82 L90 82 L100 120 Z" fill="#3f6212"/>
                        <path d="M36 82 L84 82 L86 120 L34 120 Z" fill="#4d7c0f"/>
                        <line x1="60" y1="82" x2="60" y2="120" stroke="#1a2e05" stroke-width="1.8"/>
                        <line x1="36" y1="95" x2="84" y2="95" stroke="#1a2e05" stroke-width="1.3"/>
                        <line x1="35" y1="108" x2="85" y2="108" stroke="#1a2e05" stroke-width="1.3"/>
                        <line x1="47" y1="82" x2="47" y2="120" stroke="#1a2e05" stroke-width="1.2"/>
                        <line x1="73" y1="82" x2="73" y2="120" stroke="#1a2e05" stroke-width="1.2"/>
                        <path d="M46 82 L60 93 L74 82" fill="#1e293b"/>
                    `;

                    return `<svg viewBox="0 0 120 120" xmlns="http://www.w3.org/2000/svg">
                        <defs><linearGradient id="bgC" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stop-color="#1e1b4b"/><stop offset="100%" stop-color="#31102f"/></linearGradient></defs>
                        <rect width="120" height="120" fill="url(#bgC)"/>
                        <path d="M33 50 Q33 18 60 18 Q87 18 87 50 L89 88 L31 88 Z" fill="#090d16"/>
                        <path d="M43 44 Q43 26 60 26 Q77 26 77 44 L76 62 Q76 77 60 80 Q44 77 44 62 Z" fill="#c68663"/>
                        <path d="M35 45 Q46 25 63 26 Q77 27 83 45 Q75 34 61 34 Q46 34 35 45 Z" fill="#090d16"/>
                        <path d="M48 44 L56 46 M64 46 L72 44" stroke="#090d16" stroke-width="2.2" stroke-linecap="round"/>
                        <circle cx="52" cy="50" r="2.4" fill="#090d16"/><circle cx="68" cy="50" r="2.4" fill="#090d16"/>
                        <path d="M55 66 Q60 69 65 66" stroke="#7c3f2c" stroke-width="2" fill="none" stroke-linecap="round"/>
                        ${torsoSVG}
                        ${earbudsLayer}
                        <rect x="74" y="76" width="22" height="11" rx="2" fill="#ec4899" stroke="#111827" stroke-width="1.4"/>
                        <rect x="76" y="71" width="20" height="6" rx="1" fill="#1e293b"/>
                        <rect x="78" y="67" width="6" height="4" rx="1" fill="#0f172a" stroke="#ef4444" stroke-width="0.9"/>
                        <rect x="85" y="87" width="7" height="13" rx="1" fill="#1e293b" stroke="#ec4899" stroke-width="1"/>
                    </svg>`;
                } else if (heroType === 'female') {
                    return `<svg viewBox="0 0 120 120" xmlns="http://www.w3.org/2000/svg">
                        <defs><linearGradient id="bgF" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stop-color="#431407"/><stop offset="100%" stop-color="#1e293b"/></linearGradient></defs>
                        <rect width="120" height="120" fill="url(#bgF)"/>
                        <circle cx="85" cy="34" r="16" fill="#9a3412"/><circle cx="91" cy="48" r="13" fill="#c2410c"/>
                        <path d="M22 120 L32 82 L88 82 L98 120 Z" fill="#1f2937"/>
                        <path d="M40 82 L80 82 L76 120 L44 120 Z" fill="#ea580c"/>
                        <path d="M42 46 Q42 24 60 24 Q78 24 78 46 L76 64 Q76 78 60 80 Q44 78 44 64 Z" fill="#fed7aa"/>
                        <path d="M38 48 Q40 20 62 20 Q82 20 82 46 Q72 32 58 34 Q45 36 38 48 Z" fill="#dc2626"/>
                        <rect x="44" y="45" width="13" height="7" rx="2" fill="#0f172a" stroke="#facc15" stroke-width="1.3"/>
                        <rect x="63" y="45" width="13" height="7" rx="2" fill="#0f172a" stroke="#facc15" stroke-width="1.3"/>
                        <line x1="57" y1="48" x2="63" y2="48" stroke="#facc15" stroke-width="1.5"/>
                        ${earbudsLayer}
                        <path d="M54 67 Q60 71 66 67" stroke="#9a3412" stroke-width="2.2" fill="none" stroke-linecap="round"/>
                        <rect x="74" y="72" width="32" height="11" rx="3" fill="#475569" stroke="#0f172a" stroke-width="1.5"/>
                        <circle cx="106" cy="77" r="4" fill="#f97316"/>
                    </svg>`;
                } else if (heroType === 'sniper') {
                    return `<svg viewBox="0 0 120 120" xmlns="http://www.w3.org/2000/svg">
                        <defs><linearGradient id="bgS" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stop-color="#0f172a"/><stop offset="100%" stop-color="#334155"/></linearGradient></defs>
                        <rect width="120" height="120" fill="url(#bgS)"/>
                        <path d="M18 120 L28 80 L92 80 L102 120 Z" fill="#3f6212"/>
                        <rect x="38" y="84" width="44" height="36" rx="4" fill="#57534e"/>
                        <path d="M40 44 Q40 24 60 24 Q80 24 80 44 L78 68 Q78 80 60 82 Q42 80 42 68 Z" fill="#e2b49a"/>
                        <path d="M41 56 Q42 78 60 82 Q78 78 79 56 Q72 64 60 64 Q48 64 41 56 Z" fill="#cbd5e1"/>
                        <path d="M51 64 Q60 61 69 64 Q66 69 60 68 Q54 69 51 64 Z" fill="#94a3b8"/>
                        <path d="M38 36 Q42 16 60 16 Q78 16 82 36 Z" fill="#4d7c0f"/>
                        <path d="M36 36 L86 38 L82 42 L36 39 Z" fill="#365314"/>
                        <circle cx="51" cy="48" r="2.3" fill="#0f172a"/><circle cx="69" cy="48" r="2.3" fill="#0f172a"/>
                        ${earbudsLayer}
                        <line x1="20" y1="98" x2="108" y2="74" stroke="#78350f" stroke-width="7" stroke-linecap="round"/>
                        <line x1="56" y1="81" x2="94" y2="70" stroke="#0f172a" stroke-width="5" stroke-linecap="round"/>
                    </svg>`;
                } else {
                    return `<svg viewBox="0 0 120 120" xmlns="http://www.w3.org/2000/svg">
                        <defs><linearGradient id="bgM" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stop-color="#1e293b"/><stop offset="100%" stop-color="#0f172a"/></linearGradient></defs>
                        <rect width="120" height="120" fill="url(#bgM)"/>
                        <path d="M18 120 L28 80 L92 80 L102 120 Z" fill="#1e293b"/>
                        <rect x="38" y="84" width="44" height="36" rx="4" fill="#475569"/>
                        <rect x="44" y="92" width="8" height="22" rx="1" fill="#0f172a"/><rect x="56" y="92" width="8" height="22" rx="1" fill="#0f172a"/><rect x="68" y="92" width="8" height="22" rx="1" fill="#0f172a"/>
                        <path d="M40 44 Q40 22 60 22 Q80 22 80 44 L78 66 Q78 79 60 81 Q42 79 42 66 Z" fill="#e2b49a"/>
                        <path d="M38 42 Q38 18 60 18 Q82 18 82 42 Q76 28 60 28 Q44 28 38 42 Z" fill="#f1f5f9"/>
                        <path d="M46 65 Q60 62 74 65 L72 78 Q60 82 48 78 Z" fill="#cbd5e1"/>
                        <circle cx="51" cy="47" r="2.3" fill="#0f172a"/><circle cx="69" cy="47" r="2.3" fill="#0f172a"/>
                        ${earbudsLayer}
                        <line x1="26" y1="96" x2="104" y2="76" stroke="#0f172a" stroke-width="6" stroke-linecap="round"/>
                    </svg>`;
                }
            }

            function renderAvatarHTML(key, fallbackHeroType, hasEarbuds = false, hasMolle = false) {
                const customUrl = window.HERO_ASSETS && window.HERO_ASSETS.portraits ? window.HERO_ASSETS.portraits[key] : null;
                if (customUrl) {
                    return `<img src="${customUrl}" alt="${key}" class="w-full h-full object-cover" onerror="this.style.display='none'">`;
                }
                return getCharacterPortraitSVG(fallbackHeroType, hasEarbuds, hasMolle);
            }

            function updatePortraitSVG(heroType) {
                const el = document.getElementById('hudPortrait');
                const hasMolle = (player && player.hasMolleVest);
                const key = (currentCampaign === 'mall') ? 'mall' : currentCampaign;
                if (el) {
                    el.innerHTML = renderAvatarHTML(key, heroType, sfx.musicEnabled, hasMolle);
                    el.classList.toggle('is-c-portrait', key === 'mall');
                }
                const monoAv = document.getElementById('monoAvatar');
                if (monoAv) {
                    monoAv.innerHTML = renderAvatarHTML(key, heroType, sfx.musicEnabled, hasMolle);
                    monoAv.classList.toggle('is-c-portrait', key === 'mall');
                }
            }

            function initMenuAvatars() {
                const tEl = document.getElementById('cardAvatarTraining');
                const mEl = document.getElementById('cardAvatarMall');
                const cEl = document.getElementById('cardAvatarCBD');
                const sEl = document.getElementById('cardAvatarSniper');
                const gEl = document.getElementById('cardAvatarSuburbs');
                if (tEl) tEl.innerHTML = renderAvatarHTML('training', 'young_c', false, false);
                if (mEl) mEl.innerHTML = renderAvatarHTML('mall', 'israeli_c', false, false);
                if (cEl) cEl.innerHTML = renderAvatarHTML('cbd', 'female', false, false);
                if (sEl) sEl.innerHTML = renderAvatarHTML('sniper', 'sniper', false, false);
                if (gEl) gEl.innerHTML = renderAvatarHTML('suburbs', 'male', false, false);
            }

            // ============================================================================
            // PRE-CACHED PROCEDURAL TILE & SPRITE ATLAS
            // ============================================================================
            const SpriteAtlas = {
                patterns: {},
                init(ctx) {
                    this.patterns.mallTile = this.createMallTilePattern(ctx);
                    this.patterns.parkadeAsphalt = this.createParkadePattern(ctx);
                    this.patterns.woodlandGrass = this.createWoodlandPattern(ctx);
                    this.patterns.urbanAsphalt = this.createUrbanPattern(ctx);
                },
                createMallTilePattern(ctx) {
                    const c = document.createElement('canvas');
                    c.width = 160;
                    c.height = 160;
                    const g = c.getContext('2d');
                    g.fillStyle = '#0c1220';
                    g.fillRect(0, 0, 160, 160);
                    g.fillStyle = 'rgba(30, 41, 59, 0.35)';
                    g.fillRect(2, 2, 76, 76);
                    g.fillRect(82, 82, 76, 76);
                    g.strokeStyle = 'rgba(71, 85, 105, 0.25)';
                    g.lineWidth = 1;
                    g.strokeRect(0, 0, 80, 80);
                    g.strokeRect(80, 0, 80, 80);
                    g.strokeRect(0, 80, 80, 80);
                    g.strokeRect(80, 80, 80, 80);
                    return ctx.createPattern(c, 'repeat');
                },
                createParkadePattern(ctx) {
                    const c = document.createElement('canvas');
                    c.width = 160;
                    c.height = 160;
                    const g = c.getContext('2d');
                    g.fillStyle = '#090d14';
                    g.fillRect(0, 0, 160, 160);
                    g.strokeStyle = 'rgba(51, 65, 85, 0.25)';
                    g.lineWidth = 2;
                    g.strokeRect(0, 0, 160, 160);
                    for (let i = 0; i < 40; i++) {
                        g.fillStyle = i % 2 === 0 ? 'rgba(148,163,184,0.04)' : 'rgba(2,6,23,0.22)';
                        g.fillRect((i * 37) % 156, (i * 53) % 156, 3, 3);
                    }
                    return ctx.createPattern(c, 'repeat');
                },
                createWoodlandPattern(ctx) {
                    const c = document.createElement('canvas');
                    c.width = 160;
                    c.height = 160;
                    const g = c.getContext('2d');
                    g.fillStyle = '#193118';
                    g.fillRect(0, 0, 160, 160);
                    g.fillStyle = 'rgba(20, 83, 45, 0.45)';
                    g.beginPath();
                    g.arc(40, 45, 22, 0, Math.PI * 2);
                    g.arc(125, 115, 28, 0, Math.PI * 2);
                    g.fill();
                    g.fillStyle = 'rgba(113, 63, 18, 0.14)';
                    g.fillRect(65, 20, 18, 12);
                    return ctx.createPattern(c, 'repeat');
                },
                createUrbanPattern(ctx) {
                    const c = document.createElement('canvas');
                    c.width = 160;
                    c.height = 160;
                    const g = c.getContext('2d');
                    g.fillStyle = '#181e28';
                    g.fillRect(0, 0, 160, 160);
                    g.strokeStyle = 'rgba(51, 65, 85, 0.22)';
                    g.strokeRect(0, 0, 160, 160);
                    return ctx.createPattern(c, 'repeat');
                }
            };

            // ============================================================================
            // PLATFORM & DEVICE DETECTION
            // ============================================================================
            let isMobileDevice = false;
            function detectPlatform() {
                const hasCoarsePointer = window.matchMedia && window.matchMedia('(pointer: coarse)').matches;
                const smallViewport = window.innerWidth <= 860 && ('ontouchstart' in window || navigator.maxTouchPoints > 0);
                isMobileDevice = Boolean(hasCoarsePointer || smallViewport);

                const mobileEl = document.getElementById('mobileControls');
                const desktopHint = document.getElementById('desktopControlsHint');
                if (isMobileDevice) {
                    mobileEl.style.display = 'block';
                    desktopHint.style.display = 'none';
                } else {
                    mobileEl.style.display = 'none';
                    desktopHint.style.display = '';
                }
            }

            let width = window.innerWidth;
            let height = window.innerHeight;
            function resizeCanvas() {
                width = window.innerWidth;
                height = window.innerHeight;
                canvas.width = width;
                canvas.height = height;
                detectPlatform();
            }
            window.addEventListener('resize', resizeCanvas);
            resizeCanvas();

            // ============================================================================
            // PRO-GRADE WEB AUDIO ENGINE (LOOKAHEAD 150 BPM PSYTRANCE, FM, SIDECHAIN & REVERB)
            // ============================================================================
            const sfx = {
                ctx: null,
                distCurve: null,
                masterComp: null,
                reverbNode: null,
                reverbGain: null,
                musicBus: null,
                musicFilter: null,
                sidechainGain: null,
                delayWet: null,
                musicEnabled: false,
                schedulerTimer: null,
                nextNoteTime: 0,
                musicStep: 0,
                barCount: 0,
                musicGenre: 'psytrance',
                phoenixAudio: null,
                phoenixUnavailable: false,
                phoenixPlayPending: false,

                isPhoenixStage() {
                    return this.musicGenre === 'psytrance' && currentCampaign === 'mall';
                },

                isPhoenixPlaying() {
                    return this.isPhoenixStage() && !!this.phoenixAudio && !this.phoenixAudio.paused &&
                        !this.phoenixAudio.error && !this.phoenixUnavailable;
                },

                pausePhoenixTrack() {
                    if (this.phoenixAudio) this.phoenixAudio.pause();
                },

                syncPhoenixTrack() {
                    const shouldPlay = this.musicEnabled && gameState === 'playing' && this.isPhoenixStage();
                    if (!shouldPlay) {
                        this.pausePhoenixTrack();
                        return;
                    }
                    if (this.phoenixUnavailable || this.phoenixPlayPending || !this.ctx) return;
                    if (!this.phoenixAudio) {
                        const audio = new Audio(PHOENIX_TRACK_URL);
                        audio.preload = 'auto';
                        audio.loop = true;
                        // Leave the gunfire, footsteps, dialogue and alerts audible.
                        audio.volume = 0.43;
                        audio.addEventListener('error', () => {
                            this.phoenixUnavailable = true;
                            this.phoenixPlayPending = false;
                            this.pausePhoenixTrack();
                            this.updateMusicUI();
                        });
                        audio.addEventListener('playing', () => this.updateMusicUI());
                        this.phoenixAudio = audio;
                    }
                    if (this.phoenixAudio.paused) {
                        this.phoenixPlayPending = true;
                        Promise.resolve(this.phoenixAudio.play()).then(() => {
                            this.phoenixPlayPending = false;
                            // Do not resume after a chapter change or pause.
                            if (!this.musicEnabled || gameState !== 'playing' || !this.isPhoenixStage()) {
                                this.pausePhoenixTrack();
                            }
                            this.updateMusicUI();
                        }).catch((error) => {
                            this.phoenixPlayPending = false;
                            // The original procedural arrangement remains playable
                            // if the soundtrack file is missing or the codec fails.
                            // Autoplay denial isn't permanent: the next user gesture
                            // can try again.
                            if (error?.name !== 'NotAllowedError') this.phoenixUnavailable = true;
                            this.updateMusicUI();
                        });
                    }
                },

                init() {
                    if (!this.ctx) {
                        const AudioCtx = window.AudioContext || window.webkitAudioContext;
                        if (AudioCtx) {
                            this.ctx = new AudioCtx();
                            const n = 44100;
                            const curve = new Float32Array(n);
                            for (let i = 0; i < n; i++) {
                                const x = (i * 2) / n - 1;
                                curve[i] = Math.tanh(x * 4.5);
                            }
                            this.distCurve = curve;
                            this.setupAudioGraph();
                        }
                    }
                    if (this.ctx && this.ctx.state === 'suspended') {
                        this.ctx.resume();
                    }
                },

                setupAudioGraph() {
                    if (!this.ctx) return;

                    this.masterComp = this.ctx.createDynamicsCompressor();
                    this.masterComp.threshold.value = -14;
                    this.masterComp.knee.value = 18;
                    this.masterComp.ratio.value = 6;
                    this.masterComp.attack.value = 0.004;
                    this.masterComp.release.value = 0.16;
                    this.masterComp.connect(this.ctx.destination);

                    this.reverbNode = this.ctx.createConvolver();
                    this.reverbGain = this.ctx.createGain();
                    this.reverbGain.gain.value = 0.28;
                    this.reverbNode.buffer = this.buildImpulseResponse(0.85, 3.2);
                    this.reverbNode.connect(this.reverbGain);
                    this.reverbGain.connect(this.masterComp);

                    this.musicBus = this.ctx.createGain();
                    this.musicBus.gain.value = 0.85;

                    this.musicFilter = this.ctx.createBiquadFilter();
                    this.musicFilter.type = 'lowpass';
                    this.musicFilter.frequency.value = 18000;
                    this.musicFilter.Q.value = 1.2;

                    this.musicBus.connect(this.musicFilter);
                    this.musicFilter.connect(this.masterComp);

                    this.sidechainGain = this.ctx.createGain();
                    this.sidechainGain.gain.value = 1.0;
                    this.sidechainGain.connect(this.musicBus);

                    const delayL = this.ctx.createDelay(1.0);
                    const delayR = this.ctx.createDelay(1.0);
                    delayL.delayTime.value = 0.30;
                    delayR.delayTime.value = 0.30;

                    const fbL = this.ctx.createGain();
                    const fbR = this.ctx.createGain();
                    fbL.gain.value = 0.36;
                    fbR.gain.value = 0.36;

                    const delayTone = this.ctx.createBiquadFilter();
                    delayTone.type = 'bandpass';
                    delayTone.frequency.value = 1600;
                    delayTone.Q.value = 0.9;

                    const merger = this.ctx.createChannelMerger(2);
                    this.delayWet = this.ctx.createGain();
                    this.delayWet.gain.value = 0.32;

                    this.delayWet.connect(delayTone);
                    delayTone.connect(delayL);
                    delayL.connect(fbL);
                    fbL.connect(delayR);
                    delayR.connect(fbR);
                    fbR.connect(delayL);

                    delayL.connect(merger, 0, 0);
                    delayR.connect(merger, 0, 1);
                    merger.connect(this.sidechainGain);
                },

                buildImpulseResponse(duration, decay) {
                    const rate = this.ctx.sampleRate;
                    const length = Math.floor(rate * duration);
                    const impulse = this.ctx.createBuffer(2, length, rate);
                    for (let ch = 0; ch < 2; ch++) {
                        const data = impulse.getChannelData(ch);
                        for (let i = 0; i < length; i++) {
                            const t = i / length;
                            const early = i < rate * 0.045 ? (Math.sin(i * 0.19) * 0.35) : 0;
                            data[i] = ((Math.random() * 2 - 1) + early) * Math.pow(1 - t, decay);
                        }
                    }
                    return impulse;
                },

                configureGenreForCampaign(camp) {
                    this.pausePhoenixTrack();
                    if (this.phoenixAudio) this.phoenixAudio.currentTime = 0;
                    this.musicGenre = (camp === 'mall' || camp === 'training') ? 'psytrance' : 'metal';
                    if (this.reverbNode && this.ctx) {
                        const isIndoor = (camp === 'mall');
                        this.reverbNode.buffer = this.buildImpulseResponse(isIndoor ? 0.92 : 0.24, isIndoor ? 2.8 : 4.5);
                        if (this.reverbGain) this.reverbGain.gain.value = isIndoor ? 0.34 : 0.14;
                    }
                    if (this.schedulerTimer) {
                        clearInterval(this.schedulerTimer);
                        this.schedulerTimer = null;
                    }
                    this.musicStep = 0;
                    this.barCount = 0;
                    if (this.ctx) {
                        this.nextNoteTime = this.ctx.currentTime + 0.05;
                    }

                    this.schedulerTimer = setInterval(() => {
                        this.syncPhoenixTrack();
                        if (!this.musicEnabled || !this.ctx || gameState !== 'playing') return;
                        if (this.isPhoenixPlaying()) {
                            // The OST recording replaces (not overlays) synthesized
                            // music. Keep the procedural clock current for fallback.
                            this.nextNoteTime = this.ctx.currentTime + 0.05;
                            return;
                        }
                        this.updateStealthMusicFilter();
                        const stepDur = this.musicGenre === 'psytrance' ? 0.10 : 0.115;
                        while (this.nextNoteTime < this.ctx.currentTime + 0.14) {
                            if (this.musicGenre === 'psytrance') {
                                this.schedulePsytranceStep(this.musicStep, this.barCount, this.nextNoteTime);
                            } else {
                                this.scheduleMetalStep(this.musicStep, this.nextNoteTime);
                            }
                            this.nextNoteTime += stepDur;
                            this.musicStep++;
                            if (this.musicStep >= 16) {
                                this.musicStep = 0;
                                this.barCount = (this.barCount + 1) % 32;
                            }
                        }
                    }, 25);

                    this.updateMusicUI();
                },

                updateStealthMusicFilter() {
                    if (!this.ctx || !this.musicFilter) return;
                    const now = this.ctx.currentTime;
                    const sneaking = (player && player.isSneaking && !player.vehicle);
                    const targetFreq = sneaking ? 520 : 18000;
                    this.musicFilter.frequency.setTargetAtTime(targetFreq, now, 0.12);
                },

                toggleMusic() {
                    this.init();
                    this.musicEnabled = !this.musicEnabled;
                    this.syncPhoenixTrack();
                    if (this.musicEnabled && this.ctx) {
                        this.nextNoteTime = this.ctx.currentTime + 0.04;
                    }
                    this.updateMusicUI();
                    if (player) {
                        updatePortraitSVG(player.gender);
                    }
                    const label = this.musicGenre === 'psytrance'
                        ? (this.musicEnabled ? (this.isPhoenixPlaying()
                            ? 'IPODS: PHOENIX, ARISE! // ON'
                            : 'IPODS: 150 BPM FULL-ON PSYTRANCE // ON') : 'IPODS: OFF (EARBUDS STOWED)')
                        : (this.musicEnabled ? 'IPODS: HEAVY METAL // ON' : 'IPODS: OFF (EARBUDS STOWED)');
                    showBanner(label, 1600);
                },

                updateMusicUI() {
                    const el = document.getElementById('radioStatus');
                    if (!el) return;
                    if (!this.musicEnabled) {
                        el.innerText = 'IPODS [M]: OFF';
                        el.style.color = '#64748b';
                    } else if (this.isPhoenixPlaying()) {
                        el.innerText = 'IPODS [M]: PHOENIX, ARISE! // ON';
                        el.style.color = '#f472b6';
                    } else if (this.musicGenre === 'psytrance') {
                        el.innerText = 'IPODS [M]: PSYTRANCE 150BPM // ON';
                        el.style.color = '#f472b6';
                    } else {
                        el.innerText = 'IPODS [M]: HEAVY METAL // ON';
                        el.style.color = '#eab308';
                    }
                },

                schedulePsytranceStep(step, bar, t) {
                    if (!this.ctx || !this.musicBus || !this.sidechainGain) return;

                    const isIntro = (bar < 4);
                    const isBuild = (bar >= 4 && bar < 8);
                    const isBreakdown = (bar >= 24 && bar < 28);
                    const isSneaking = (player && player.isSneaking && !player.vehicle);
                    const kickActive = !isIntro && !isBreakdown && !isSneaking;

                    // 1. Sub-Heavy Psytrance Kick + Sidechain Ducking Envelope
                    if (step % 4 === 0 && kickActive) {
                        const kickOsc = this.ctx.createOscillator();
                        const clickOsc = this.ctx.createOscillator();
                        const kickGain = this.ctx.createGain();
                        const clickGain = this.ctx.createGain();

                        kickOsc.type = 'sine';
                        kickOsc.frequency.setValueAtTime(185, t);
                        kickOsc.frequency.exponentialRampToValueAtTime(62, t + 0.025);
                        kickOsc.frequency.exponentialRampToValueAtTime(41.2, t + 0.095);

                        kickGain.gain.setValueAtTime(0.14, t);
                        kickGain.gain.exponentialRampToValueAtTime(0.001, t + 0.098);

                        clickOsc.type = 'triangle';
                        clickOsc.frequency.setValueAtTime(1400, t);
                        clickOsc.frequency.exponentialRampToValueAtTime(120, t + 0.012);
                        clickGain.gain.setValueAtTime(0.055, t);
                        clickGain.gain.exponentialRampToValueAtTime(0.001, t + 0.014);

                        kickOsc.connect(kickGain);
                        clickOsc.connect(clickGain);
                        kickGain.connect(this.musicBus);
                        clickGain.connect(this.musicBus);

                        kickOsc.start(t);
                        kickOsc.stop(t + 0.10);
                        clickOsc.start(t);
                        clickOsc.stop(t + 0.016);

                        this.sidechainGain.gain.cancelScheduledValues(t);
                        this.sidechainGain.gain.setValueAtTime(0.14, t);
                        this.sidechainGain.gain.exponentialRampToValueAtTime(1.0, t + 0.088);
                    }

                    // 2. Rolling K-B-B-B 16th-Note Sub-Bassline (Phrygian Dominant: F1 -> Gb1 -> Bb1)
                    if (!isIntro && (!isBreakdown || bar >= 26)) {
                        if (step % 4 !== 0 || isBreakdown) {
                            let rootFreq = 43.65;
                            if (bar % 8 === 6) rootFreq = 46.25;
                            else if (bar % 8 === 7 && step >= 8) rootFreq = 58.27;

                            const bassOsc = this.ctx.createOscillator();
                            const subOsc = this.ctx.createOscillator();
                            const bassFilter = this.ctx.createBiquadFilter();
                            const bassGain = this.ctx.createGain();

                            bassOsc.type = 'sawtooth';
                            bassOsc.frequency.setValueAtTime(rootFreq, t);
                            subOsc.type = 'sine';
                            subOsc.frequency.setValueAtTime(rootFreq, t);

                            const buildRatio = isBuild ? (0.35 + ((bar - 4) * 16 + step) / 96) : (isBreakdown ? 0.3 : 1.0);
                            const cutoffPeak = (step % 4 === 2 ? 1280 : 940) * buildRatio;

                            bassFilter.type = 'lowpass';
                            bassFilter.Q.value = 6.2;
                            bassFilter.frequency.setValueAtTime(Math.max(180, cutoffPeak), t);
                            bassFilter.frequency.exponentialRampToValueAtTime(125, t + 0.078);

                            const vel = (step % 4 === 2 ? 0.078 : 0.062) * Math.min(1, buildRatio + 0.25);
                            bassGain.gain.setValueAtTime(vel, t);
                            bassGain.gain.exponentialRampToValueAtTime(0.001, t + 0.086);

                            bassOsc.connect(bassFilter);
                            subOsc.connect(bassFilter);
                            bassFilter.connect(bassGain);
                            bassGain.connect(this.sidechainGain);

                            bassOsc.start(t);
                            subOsc.start(t);
                            bassOsc.stop(t + 0.09);
                            subOsc.stop(t + 0.09);
                        }
                    }

                    // 3. Psychedelic Dark Drone Pad on Downbeats of 4-Bar Phrases
                    if (step === 0 && bar % 4 === 0) {
                        const padFreqs = (bar % 8 === 4) ? [174.61, 220.0, 277.18] : [174.61, 207.65, 261.63];
                        for (let p = 0; p < padFreqs.length; p++) {
                            const padOsc = this.ctx.createOscillator();
                            const padFilt = this.ctx.createBiquadFilter();
                            const padGain = this.ctx.createGain();
                            padOsc.type = p === 0 ? 'sawtooth' : 'triangle';
                            padOsc.frequency.setValueAtTime(padFreqs[p], t);
                            padOsc.detune.setValueAtTime((p - 1) * 9, t);

                            padFilt.type = 'bandpass';
                            padFilt.Q.value = 3.5;
                            padFilt.frequency.setValueAtTime(420, t);
                            padFilt.frequency.linearRampToValueAtTime(1150, t + 0.8);
                            padFilt.frequency.linearRampToValueAtTime(380, t + 1.55);

                            padGain.gain.setValueAtTime(0.001, t);
                            padGain.gain.linearRampToValueAtTime(0.016, t + 0.35);
                            padGain.gain.exponentialRampToValueAtTime(0.0008, t + 1.58);

                            padOsc.connect(padFilt);
                            padFilt.connect(padGain);
                            padGain.connect(this.sidechainGain);
                            padOsc.start(t);
                            padOsc.stop(t + 1.6);
                        }
                    }

                    // 4. Crisp 909 Offbeat Hi-Hats & Snare Roll Risers
                    if (!isBreakdown) {
                        if (step % 4 === 2) {
                            this.scheduleNoiseAt(t, 0.045, 9200, 'highpass', 0.028, this.sidechainGain);
                        } else if (step % 2 === 1 && !isIntro) {
                            this.scheduleNoiseAt(t, 0.02, 10500, 'highpass', 0.012, this.sidechainGain);
                        }
                    }

                    const isSnareRiser = (bar === 7 || bar === 27);
                    if (isSnareRiser) {
                        const hitInterval = step >= 12 ? 1 : (step >= 8 ? 2 : 4);
                        if (step % hitInterval === 0) {
                            const riseGain = 0.02 + (step / 16) * 0.045;
                            this.scheduleNoiseAt(t, 0.075, 2200 + step * 180, 'bandpass', riseGain, this.sidechainGain);
                        }
                    } else if (!isIntro && !isBreakdown && (step === 4 || step === 12)) {
                        this.scheduleNoiseAt(t, 0.09, 2400, 'bandpass', 0.036, this.sidechainGain);
                    }

                    // 5. True FM Synthesis Liquid Acid Squelches & Alien Zaps -> Stereo Ping-Pong Delay
                    const scale = [349.23, 369.99, 440.00, 466.16, 523.25, 554.37, 698.46, 739.99];
                    const patternA = [0, -1, 2, 1, -1, 4, 3, -1, 5, 4, -1, 6, 2, -1, 7, 3];
                    const patternB = [4, 5, -1, 7, 6, -1, 3, 4, -1, 2, 1, -1, 5, 6, 7, -1];
                    const noteIdx = (bar % 4 < 2) ? patternA[step] : patternB[step];

                    if (noteIdx >= 0 && (!isIntro || step % 4 === 3)) {
                        const carrierFreq = scale[noteIdx];
                        const modOsc = this.ctx.createOscillator();
                        const modGain = this.ctx.createGain();
                        const carOsc = this.ctx.createOscillator();
                        const acidFilter = this.ctx.createBiquadFilter();
                        const envGain = this.ctx.createGain();

                        modOsc.type = 'sine';
                        modOsc.frequency.setValueAtTime(carrierFreq * 2.0, t);
                        modGain.gain.setValueAtTime(carrierFreq * 1.65, t);
                        modGain.gain.exponentialRampToValueAtTime(12, t + 0.085);

                        carOsc.type = 'sawtooth';
                        carOsc.frequency.setValueAtTime(carrierFreq, t);
                        if (noteIdx === 7) {
                            carOsc.frequency.exponentialRampToValueAtTime(carrierFreq * 0.5, t + 0.09);
                        }

                        const lfoSweep = 900 + Math.sin(t * 1.4) * 550 + (bar % 8) * 140;
                        acidFilter.type = 'bandpass';
                        acidFilter.Q.value = 11.5;
                        acidFilter.frequency.setValueAtTime(lfoSweep, t);
                        acidFilter.frequency.exponentialRampToValueAtTime(lfoSweep * 2.6, t + 0.085);

                        const leadLevel = isIntro ? 0.016 : 0.025;
                        envGain.gain.setValueAtTime(leadLevel, t);
                        envGain.gain.exponentialRampToValueAtTime(0.0008, t + 0.092);

                        modOsc.connect(modGain);
                        modGain.connect(carOsc.frequency);
                        carOsc.connect(acidFilter);
                        acidFilter.connect(envGain);

                        envGain.connect(this.sidechainGain);
                        if (this.delayWet) envGain.connect(this.delayWet);

                        modOsc.start(t);
                        carOsc.start(t);
                        modOsc.stop(t + 0.095);
                        carOsc.stop(t + 0.095);
                    }
                },

                scheduleNoiseAt(t, duration, freq, filterType, gainVal, dest) {
                    if (!this.ctx) return;
                    const bufferSize = Math.floor(this.ctx.sampleRate * duration);
                    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
                    const data = buffer.getChannelData(0);
                    for (let i = 0; i < bufferSize; i++) {
                        data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (bufferSize * 0.32));
                    }
                    const src = this.ctx.createBufferSource();
                    src.buffer = buffer;

                    const filter = this.ctx.createBiquadFilter();
                    filter.type = filterType;
                    filter.frequency.setValueAtTime(freq, t);

                    const gain = this.ctx.createGain();
                    gain.gain.setValueAtTime(gainVal, t);
                    gain.gain.exponentialRampToValueAtTime(0.001, t + duration);

                    src.connect(filter);
                    filter.connect(gain);
                    gain.connect(dest || this.masterComp);
                    src.start(t);
                },

                scheduleMetalStep(step, t) {
                    if (!this.ctx || !this.distCurve) return;
                    const riff = [
                        82.41, 82.41, 0, 82.41,
                        82.41, 0, 98.00, 82.41,
                        82.41, 0, 116.54, 110.00,
                        82.41, 82.41, 87.31, 73.42
                    ];
                    const freq = riff[step];
                    if (freq > 0) {
                        const isAccent = (step === 6 || step === 10 || step === 11 || step === 14 || step === 15);
                        const dur = isAccent ? 0.19 : 0.095;

                        const osc1 = this.ctx.createOscillator();
                        const osc2 = this.ctx.createOscillator();
                        osc1.type = 'sawtooth';
                        osc2.type = 'sawtooth';
                        osc1.frequency.setValueAtTime(freq, t);
                        osc2.frequency.setValueAtTime(freq * 1.498, t);

                        const shaper = this.ctx.createWaveShaper();
                        shaper.curve = this.distCurve;

                        const cab = this.ctx.createBiquadFilter();
                        cab.type = 'lowpass';
                        cab.frequency.setValueAtTime(isAccent ? 2100 : 1150, t);

                        const g = this.ctx.createGain();
                        g.gain.setValueAtTime(0.036, t);
                        g.gain.exponentialRampToValueAtTime(0.001, t + dur);

                        osc1.connect(shaper);
                        osc2.connect(shaper);
                        shaper.connect(cab);
                        cab.connect(g);
                        g.connect(this.musicBus || this.ctx.destination);

                        osc1.start(t);
                        osc2.start(t);
                        osc1.stop(t + dur);
                        osc2.stop(t + dur);
                    }

                    if ([0, 3, 6, 8, 11, 14].includes(step)) {
                        const kOsc = this.ctx.createOscillator();
                        const kGain = this.ctx.createGain();
                        kOsc.type = 'sine';
                        kOsc.frequency.setValueAtTime(115, t);
                        kOsc.frequency.exponentialRampToValueAtTime(34, t + 0.085);
                        kGain.gain.setValueAtTime(0.075, t);
                        kGain.gain.exponentialRampToValueAtTime(0.001, t + 0.085);
                        kOsc.connect(kGain);
                        kGain.connect(this.musicBus || this.ctx.destination);
                        kOsc.start(t);
                        kOsc.stop(t + 0.085);
                    }

                    if (step === 4 || step === 12) {
                        this.scheduleNoiseAt(t, 0.11, 2400, 'lowpass', 0.062, this.musicBus);
                    } else if (step % 2 === 0) {
                        this.scheduleNoiseAt(t, 0.03, 6500, 'highpass', 0.014, this.musicBus);
                    }
                },

                createSpatialChain(wx, wy, sendReverb = true) {
                    if (!this.ctx) return null;
                    const dest = this.masterComp || this.ctx.destination;
                    if (wx === undefined || wy === undefined || !player) {
                        return { input: dest, atten: 1.0 };
                    }

                    const dist = Math2.dist(player.x, player.y, wx, wy);
                    const atten = Math2.clamp(1.0 - dist / 1450, 0.12, 1.0);
                    const occluded = !hasLoS(player.x, player.y, wx, wy);

                    const occFilter = this.ctx.createBiquadFilter();
                    occFilter.type = 'lowpass';
                    occFilter.frequency.value = occluded ? 780 : 16000;

                    if (this.ctx.createStereoPanner) {
                        const panner = this.ctx.createStereoPanner();
                        panner.pan.value = Math2.clamp((wx - player.x) / 520, -0.92, 0.92);
                        occFilter.connect(panner);
                        panner.connect(dest);
                        if (sendReverb && this.reverbNode) {
                            panner.connect(this.reverbNode);
                        }
                    } else {
                        occFilter.connect(dest);
                        if (sendReverb && this.reverbNode) {
                            occFilter.connect(this.reverbNode);
                        }
                    }

                    return { input: occFilter, atten };
                },

                playNoise(duration, filterFreq, gainVal, wx, wy, sendReverb = false) {
                    if (!this.ctx) return;
                    const spatial = this.createSpatialChain(wx, wy, sendReverb);
                    const bufferSize = Math.floor(this.ctx.sampleRate * duration);
                    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
                    const data = buffer.getChannelData(0);
                    for (let i = 0; i < bufferSize; i++) {
                        data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (bufferSize * 0.35));
                    }
                    const src = this.ctx.createBufferSource();
                    src.buffer = buffer;

                    const filter = this.ctx.createBiquadFilter();
                    filter.type = 'lowpass';
                    filter.frequency.value = filterFreq;

                    const gain = this.ctx.createGain();
                    gain.gain.setValueAtTime(gainVal * spatial.atten, this.ctx.currentTime);
                    gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + duration);

                    src.connect(filter);
                    filter.connect(gain);
                    gain.connect(spatial.input);
                    src.start();
                },

                playTone(startFreq, endFreq, duration, type, gainVal, wx, wy, sendReverb = false) {
                    if (!this.ctx) return;
                    const spatial = this.createSpatialChain(wx, wy, sendReverb);
                    const osc = this.ctx.createOscillator();
                    const gain = this.ctx.createGain();
                    osc.type = type;
                    osc.frequency.setValueAtTime(startFreq, this.ctx.currentTime);
                    osc.frequency.exponentialRampToValueAtTime(Math.max(20, endFreq), this.ctx.currentTime + duration);

                    gain.gain.setValueAtTime(gainVal * spatial.atten, this.ctx.currentTime);
                    gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + duration);

                    osc.connect(gain);
                    gain.connect(spatial.input);
                    osc.start();
                    osc.stop(this.ctx.currentTime + duration);
                },

                playGunshot(wepId, wx, wy) {
                    if (wepId === 'airsoft_pistol' || wepId === 'airsoft_aeg') {
                        this.playNoise(0.055, 3600, 0.08, wx, wy, false);
                        this.playTone(540, 210, 0.045, 'square', 0.065, wx, wy, false);
                    } else if (wepId === 'glock26_jhp') {
                        this.playNoise(0.19, 3100, 0.25, wx, wy, true);
                        this.playTone(240, 42, 0.15, 'sawtooth', 0.18, wx, wy, true);
                    } else if (wepId === 'ruger') {
                        this.playNoise(0.38, 3400, 0.32, wx, wy, true);
                        this.playTone(185, 28, 0.28, 'sawtooth', 0.22, wx, wy, true);
                    } else if (wepId === 'shotgun') {
                        this.playNoise(0.28, 1600, 0.25, wx, wy, true);
                        this.playTone(140, 35, 0.22, 'sawtooth', 0.16, wx, wy, true);
                    } else if (wepId === 'lm4' || wepId === 'ak47' || wepId === 'ar15') {
                        this.playNoise(0.15, 2800, 0.19, wx, wy, true);
                        this.playTone(220, 48, 0.12, 'triangle', 0.14, wx, wy, true);
                    } else {
                        this.playNoise(0.12, 2500, 0.15, wx, wy, true);
                        this.playTone(260, 55, 0.095, 'triangle', 0.12, wx, wy, true);
                    }
                },

                playPainGroan(wx, wy) {
                    const pitch = Math2.rand(145, 215);
                    this.playTone(pitch, pitch * 0.56, 0.28, 'sawtooth', 0.095, wx, wy, true);
                    this.playNoise(0.18, 950, 0.05, wx, wy, true);
                },

                playBBImpact() {
                    this.playTone(1650, 950, 0.03, 'triangle', 0.055);
                },

                playBoltCycle() {
                    this.playTone(950, 1450, 0.055, 'square', 0.06);
                    setTimeout(() => this.playTone(1350, 820, 0.065, 'square', 0.06), 130);
                },

                playFlamethrower() {
                    this.playNoise(0.13, 950, 0.12);
                    this.playTone(110, 65, 0.1, 'sawtooth', 0.06);
                },

                playMelee() {
                    this.playNoise(0.09, 1200, 0.12);
                    this.playTone(320, 90, 0.09, 'sine', 0.1);
                },

                playExecution() {
                    this.playNoise(0.11, 900, 0.16);
                    this.playTone(240, 45, 0.14, 'sawtooth', 0.14);
                },

                playReload() {
                    this.playTone(480, 310, 0.065, 'square', 0.085);
                    setTimeout(() => this.playTone(680, 960, 0.08, 'square', 0.08), 140);
                },

                playMagClatter() {
                    this.playTone(320, 190, 0.045, 'triangle', 0.05);
                },

                playClick() {
                    this.playTone(1400, 900, 0.035, 'square', 0.06);
                },

                playStairs() {
                    this.playTone(220, 160, 0.07, 'triangle', 0.08);
                    setTimeout(() => this.playTone(260, 190, 0.07, 'triangle', 0.08), 95);
                },

                playOpticsWhine() {
                    this.playTone(420, 1850, 0.14, 'sine', 0.055);
                },

                playStrobeHum() {
                    this.playTone(2400, 3100, 0.04, 'sine', 0.04);
                },

                playAlarmShout(wx, wy) {
                    this.playTone(460, 620, 0.12, 'sawtooth', 0.09, wx, wy, true);
                    setTimeout(() => this.playTone(580, 410, 0.14, 'sawtooth', 0.09, wx, wy, true), 110);
                },

                playPhonePing() {
                    this.playTone(880, 1320, 0.09, 'sine', 0.09);
                    setTimeout(() => this.playTone(1320, 1760, 0.12, 'sine', 0.09), 95);
                },

                playHit() {
                    this.playTone(180, 60, 0.08, 'sawtooth', 0.12);
                },

                playExplosion(wx, wy) {
                    this.playNoise(0.75, 700, 0.45, wx, wy, true);
                    this.playTone(95, 22, 0.65, 'sawtooth', 0.35, wx, wy, true);
                },

                playPickup() {
                    this.playTone(480, 880, 0.12, 'triangle', 0.1);
                },

                playHorn() {
                    this.playTone(340, 330, 0.18, 'sawtooth', 0.08);
                    this.playTone(425, 420, 0.18, 'sawtooth', 0.08);
                }
            };

            // ============================================================================
            // MATH & GEOMETRY HELPERS (WITH FLOOR-AWARE LINE OF SIGHT)
            // ============================================================================
            const Math2 = {
                dist: (x1, y1, x2, y2) => Math.hypot(x2 - x1, y2 - y1),
                angle: (x1, y1, x2, y2) => Math.atan2(y2 - y1, x2 - x1),
                lerp: (a, b, t) => a + (b - a) * t,
                clamp: (v, min, max) => Math.max(min, Math.min(max, v)),
                rand: (min, max) => Math.random() * (max - min) + min,
                randInt: (min, max) => Math.floor(Math.random() * (max - min + 1)) + min,
                angleDiff: (a, b) => {
                    let diff = (b - a + Math.PI) % (Math.PI * 2) - Math.PI;
                    return diff < -Math.PI ? diff + Math.PI * 2 : diff;
                }
            };

            function segmentCircleIntersectT(x1, y1, x2, y2, cx, cy, r) {
                const dx = x2 - x1;
                const dy = y2 - y1;
                const fx = x1 - cx;
                const fy = y1 - cy;
                const a = dx * dx + dy * dy;
                if (a < 1e-8) return null;
                const b = 2 * (fx * dx + fy * dy);
                const c = (fx * fx + fy * fy) - r * r;
                let disc = b * b - 4 * a * c;
                if (disc < 0) return null;
                disc = Math.sqrt(disc);
                const t1 = (-b - disc) / (2 * a);
                const t2 = (-b + disc) / (2 * a);
                if (t1 >= 0 && t1 <= 1) return t1;
                if (t2 >= 0 && t2 <= 1) return t2;
                return null;
            }

            function segmentRectIntersectT(x1, y1, x2, y2, rx, ry, rw, rh) {
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
                        if (q < 0) return null;
                    } else {
                        const r = q / p;
                        if (p < 0) {
                            if (r > t1) return null;
                            if (r > t0) t0 = r;
                        } else {
                            if (r < t0) return null;
                            if (r < t1) t1 = r;
                        }
                    }
                }
                return t0 <= t1 ? t0 : null;
            }

            function raycastBuildingsT(x1, y1, x2, y2, floor = null) {
                let bestT = null;
                const activeF = (floor !== null) ? floor : (currentCampaign === 'mall' ? currentMallFloor : null);
                for (let i = 0; i < buildings.length; i++) {
                    const b = buildings[i];
                    if (b.floor && activeF && b.floor !== activeF) continue;
                    if (b.transparent) continue;
                    const t = segmentRectIntersectT(x1, y1, x2, y2, b.x, b.y, b.w, b.h);
                    if (t !== null && (bestT === null || t < bestT)) {
                        bestT = t;
                    }
                }
                return bestT;
            }

            function hasLoS(x1, y1, x2, y2, floor = null) {
                return raycastBuildingsT(x1, y1, x2, y2, floor) === null;
            }

            function hasLightConeExposure(tx, ty, maxRange = 450) {
                if (!player || !player.flashlightOn || player.vehicle) return false;
                const d = Math2.dist(player.x, player.y, tx, ty);
                if (d > maxRange) return false;
                const angToTarget = Math2.angle(player.x, player.y, tx, ty);
                const diff = Math.abs(Math2.angleDiff(player.angle, angToTarget));
                if (diff > 0.44) return false;
                return hasLoS(player.x, player.y, tx, ty);
            }

            // ============================================================================
            // WEAPONS & AMMUNITION DEFINITIONS (REALISTIC HIGH-VELOCITY BALLISTICS)
            // ============================================================================
            const WEAPONS = {
                airsoft_pistol: {
                    id: 'airsoft_pistol',
                    name: 'PINK G26 GBB [6MM]',
                    magSize: 15,
                    fireRate: 170,
                    damage: 26,
                    speed: 4600,
                    spread: 0.032,
                    pellets: 1,
                    auto: false,
                    color: '#ffffff',
                    trailLen: 26,
                    recoil: 2,
                    alertRadius: 190,
                    flashSize: 0.25,
                    isAirsoft: true
                },
                glock26: {
                    id: 'glock26',
                    name: 'GLOCK 26 [PINK 3D]',
                    magSize: 15,
                    fireRate: 185,
                    damage: 34,
                    speed: 14500,
                    spread: 0.024,
                    pellets: 1,
                    auto: false,
                    color: '#fef08a',
                    trailLen: 85,
                    recoil: 5,
                    alertRadius: 560,
                    flashSize: 0.9
                },
                glock26_jhp: {
                    id: 'glock26_jhp',
                    name: 'GLOCK 26 [120GR +P JHP]',
                    magSize: 15,
                    fireRate: 215,
                    damage: 64,
                    speed: 15200,
                    spread: 0.036,
                    pellets: 1,
                    auto: false,
                    color: '#f472b6',
                    trailLen: 105,
                    recoil: 9,
                    alertRadius: 880,
                    flashSize: 1.65,
                    isJHP: true
                },
                flamethrower: {
                    id: 'flamethrower',
                    name: 'INCINERATOR FLAMER',
                    magSize: 120,
                    fireRate: 52,
                    damage: 14,
                    speed: 1350,
                    spread: 0.22,
                    pellets: 2,
                    auto: true,
                    color: '#f97316',
                    trailLen: 45,
                    recoil: 2,
                    isFlame: true,
                    alertRadius: 480,
                    flashSize: 1.2
                },
                ruger: {
                    id: 'ruger',
                    name: 'RUGER M77 .308',
                    magSize: 5,
                    fireRate: 920,
                    damage: 195,
                    speed: 35000,
                    spread: 0.002,
                    pellets: 1,
                    auto: false,
                    color: '#fde047',
                    trailLen: 220,
                    recoil: 13,
                    boltAction: true,
                    alertRadius: 1200,
                    flashSize: 1.5
                },
                lm4: {
                    id: 'lm4',
                    name: 'VEKTOR LM4 5.56',
                    magSize: 35,
                    fireRate: 108,
                    damage: 42,
                    speed: 29000,
                    spread: 0.025,
                    pellets: 1,
                    auto: true,
                    color: '#facc15',
                    trailLen: 150,
                    recoil: 5,
                    alertRadius: 950,
                    flashSize: 1.15
                },
                shotgun: {
                    id: 'shotgun',
                    name: 'M870 BREACHER 12G',
                    magSize: 8,
                    fireRate: 560,
                    damage: 28,
                    speed: 15500,
                    spread: 0.14,
                    pellets: 6,
                    auto: false,
                    color: '#fed7aa',
                    trailLen: 95,
                    recoil: 12,
                    alertRadius: 1050,
                    flashSize: 1.4
                },
                smg: {
                    id: 'smg',
                    name: 'BXP-9 CARBINE',
                    magSize: 30,
                    fireRate: 78,
                    damage: 28,
                    speed: 15000,
                    spread: 0.06,
                    pellets: 1,
                    auto: true,
                    color: '#38bdf8',
                    trailLen: 90,
                    recoil: 3.5,
                    alertRadius: 720,
                    flashSize: 0.9
                }
            };

            // ============================================================================
            // WORLD & CAMPAIGN STATE
            // ============================================================================
            const WORLD_SIZE = 3200;
            const MALL_FLOORS = ['L2', 'L1', 'G', 'B1'];
            let currentMallFloor = 'L1';
            let gameState = 'menu';
            let currentCampaign = 'mall';
            let kills = 0;
            let cashCollected = 0;
            let elapsedTime = 0;
            let lastTimestamp = 0;

            const camera = { x: 1600, y: 1600, shake: 0 };
            const input = {
                keys: {},
                mouse: { x: width / 2, y: height / 2, worldX: 1600, worldY: 1600, down: false },
                leftStick: { active: false, id: null, startX: 0, startY: 0, dx: 0, dy: 0 },
                rightStick: { active: false, id: null, startX: 0, startY: 0, dx: 0, dy: 0 }
            };

            let player = null;
            let vehicles = [];
            let enemies = [];
            let allies = [];
            let civilians = [];
            let stairs = [];
            let securityDoors = [];
            let cctvTerminals = [];
            let corpses = [];
            let bullets = [];
            let particles = [];
            let decals = [];
            let droppedMags = [];
            let pickups = [];
            let buildings = [];
            let trees = [];
            let roads = [];
            let mission = { step: 0, title: '', desc: '', targetX: 0, targetY: 0, targetFloor: 'L1', timer: 0 };
            let lastKnownPos = { active: false, x: 0, y: 0, floor: 'L1', timer: 0 };
            let cctvRevealTimer = 0;

            // ============================================================================
            // CLICK/TAP-DRIVEN CHECKPOINT SMARTPHONE MESSENGER CUTSCENE ENGINE
            // ============================================================================
            const phoneCutscene = {
                active: false,
                data: null,
                msgIndex: 0,
                onComplete: null,

                start(config) {
                    this.active = true;
                    this.data = config;
                    this.msgIndex = 0;
                    this.onComplete = config.onComplete || null;

                    input.mouse.down = false;
                    input.keys = {};
                    input.leftStick.active = false;
                    input.leftStick.dx = 0;
                    input.leftStick.dy = 0;

                    document.getElementById('phoneClock').innerText = config.clock || '07:02 AM';
                    document.getElementById('phoneOpsecBar').innerText = config.opsec || 'OPSEC WARNING: UNENCRYPTED CELLULAR // NO DMR RADIOS STAGED';
                    document.getElementById('phoneContactName').innerText = config.contactName || 'CONTACT';
                    document.getElementById('phoneContactSub').innerText = config.contactSub || 'BURNER SMS';
                    document.getElementById('phoneContactAvatar').innerHTML = renderAvatarHTML(config.contactAvatar || 'sniper', config.contactAvatar || 'sniper', false, false);

                    const stream = document.getElementById('phoneChatStream');
                    stream.innerHTML = '';

                    document.getElementById('phoneCutscene').classList.add('active');
                    this.renderNextBubble();
                },

                renderNextBubble() {
                    if (!this.active || !this.data) return;
                    const msgs = this.data.messages || [];
                    if (this.msgIndex >= msgs.length) {
                        this.finish();
                        return;
                    }

                    const m = msgs[this.msgIndex];
                    const stream = document.getElementById('phoneChatStream');
                    const bubble = document.createElement('div');
                    bubble.className = `chat-bubble ${m.side === 'outgoing' ? 'outgoing' : 'incoming'}`;
                    bubble.innerHTML = `
                        <div class="text-[9px] font-mono opacity-75 mb-0.5">${m.sender} &bull; ${m.time || ''}</div>
                        <div>${m.text}</div>
                    `;
                    stream.appendChild(bubble);
                    stream.scrollTop = stream.scrollHeight;
                    sfx.playPhonePing();

                    this.msgIndex++;
                    const btn = document.getElementById('btnPhoneNext');
                    if (btn) {
                        btn.innerText = this.msgIndex >= msgs.length ? 'RESUME OPERATION [CLICK / SPACE]' : 'NEXT MESSAGE [CLICK / SPACE]';
                    }
                },

                advance() {
                    if (!this.active) return;
                    this.renderNextBubble();
                },

                skip() {
                    if (!this.active) return;
                    this.finish();
                },

                finish() {
                    this.active = false;
                    document.getElementById('phoneCutscene').classList.remove('active');
                    lastTimestamp = performance.now();
                    if (this.onComplete) {
                        const cb = this.onComplete;
                        this.onComplete = null;
                        cb();
                    }
                }
            };

            document.getElementById('phoneCutscene').addEventListener('click', () => {
                if (phoneCutscene.active) phoneCutscene.advance();
            });

            // ============================================================================
            // INTERNAL MONOLOGUE & BANNER HELPERS (2X SCALE)
            // ============================================================================
            let bannerTimeout = null;
            function showBanner(text, duration = 2600) {
                const el = document.getElementById('alertBanner');
                el.innerText = text;
                el.classList.remove('hidden');
                clearTimeout(bannerTimeout);
                bannerTimeout = setTimeout(() => el.classList.add('hidden'), duration);
            }

            let monoTimeout = null;
            function triggerMonologue(speaker, text, duration = 5600) {
                const el = document.getElementById('monologueToast');
                if (!el) return;
                document.getElementById('monoTag').innerText = `INTERNAL MONOLOGUE // ${speaker}`;
                document.getElementById('monoText').innerText = `"${text}"`;
                if (player) updatePortraitSVG(player.gender);
                el.classList.add('visible');
                clearTimeout(monoTimeout);
                monoTimeout = setTimeout(() => el.classList.remove('visible'), duration);
            }

            function triggerLKP(x, y, radius = 650, floor = null) {
                const activeF = (floor !== null) ? floor : (currentCampaign === 'mall' ? currentMallFloor : null);
                lastKnownPos.active = true;
                lastKnownPos.x = x;
                lastKnownPos.y = y;
                lastKnownPos.floor = activeF;
                lastKnownPos.timer = 15.0;

                for (let i = 0; i < enemies.length; i++) {
                    const e = enemies[i];
                    if (activeF && e.floor && e.floor !== activeF) continue;
                    const d = Math2.dist(e.x, e.y, x, y);
                    if (d <= radius) {
                        e.alertLKP(x, y);
                    }
                }
            }

            // ============================================================================
            // PHYSICAL DROPPED MAGAZINE ENTITY
            // ============================================================================
            class DroppedMag {
                constructor(x, y, angle, magStyle, hadRounds, floor = null) {
                    this.x = x;
                    this.y = y;
                    this.floor = floor;
                    const ejectAngle = angle - Math.PI / 2 + Math2.rand(-0.35, 0.35);
                    const speed = Math2.rand(95, 165);
                    this.vx = Math.cos(ejectAngle) * speed;
                    this.vy = Math.sin(ejectAngle) * speed;
                    this.rot = angle + Math2.rand(-0.5, 0.5);
                    this.vRot = Math2.rand(-11, 11);
                    this.z = 12;
                    this.vz = Math2.rand(45, 85);
                    this.magStyle = magStyle;
                    this.hadRounds = hadRounds;
                    this.bounced = false;
                }

                update(dt) {
                    if (this.z > 0 || Math.abs(this.vx) > 2 || Math.abs(this.vy) > 2) {
                        this.x += this.vx * dt;
                        this.y += this.vy * dt;
                        this.rot += this.vRot * dt;
                        this.z += this.vz * dt;
                        this.vz -= 340 * dt;
                        if (this.z <= 0) {
                            this.z = 0;
                            if (!this.bounced) {
                                this.bounced = true;
                                sfx.playMagClatter();
                            }
                            this.vz = Math.abs(this.vz) * 0.25;
                            this.vx *= 0.52;
                            this.vy *= 0.52;
                            this.vRot *= 0.45;
                        }
                    }
                }

                draw(ctx) {
                    ctx.save();
                    ctx.translate(this.x, this.y - this.z * 0.35);
                    ctx.rotate(this.rot);
                    const isPink = (this.magStyle === 'pink-ext');
                    const isCompact = (this.magStyle === 'compact');
                    const w = isCompact ? 11 : (isPink ? 15 : 13);
                    const h = 6;
                    ctx.fillStyle = '#1e293b';
                    ctx.strokeStyle = isPink ? '#f472b6' : '#64748b';
                    ctx.lineWidth = 1.2;
                    ctx.fillRect(-w / 2, -h / 2, w, h);
                    ctx.strokeRect(-w / 2, -h / 2, w, h);
                    if (isPink) {
                        ctx.fillStyle = '#ec4899';
                        ctx.fillRect(-w / 2, -h / 2, 4, h);
                    }
                    if (this.hadRounds) {
                        ctx.fillStyle = '#facc15';
                        ctx.fillRect(w / 2 - 2.5, -h / 2 + 1, 2.5, h - 2);
                    }
                    ctx.restore();
                }
            }

            // ============================================================================
            // PERSISTENT MULTI-POSE CORPSE ENTITY
            // ============================================================================
            class Corpse {
                constructor(x, y, angle, faction, floor = null, pose = 0) {
                    this.x = x;
                    this.y = y;
                    this.angle = angle;
                    this.faction = faction;
                    this.floor = floor;
                    this.pose = pose;
                    this.heat = 1.0;
                }

                update(dt) {
                    if (this.heat > 0.15) {
                        this.heat = Math.max(0.15, this.heat - dt * 0.015);
                    }
                }

                draw(ctx, thermalMode = false) {
                    ctx.save();
                    ctx.translate(this.x, this.y);
                    ctx.rotate(this.angle);

                    const bodyCol = thermalMode
                        ? `rgba(180, 195, 210, ${0.35 + this.heat * 0.55})`
                        : (this.faction === 'blockade_goon' ? '#451a1a' : (this.faction === 'security' ? '#172554' : '#334155'));
                    const limbCol = thermalMode ? 'rgba(148, 163, 184, 0.5)' : '#1e293b';
                    const skinCol = thermalMode ? 'rgba(226, 232, 240, 0.65)' : '#6b442a';

                    // Sprawled limbs by pose variant (0..3)
                    ctx.strokeStyle = limbCol;
                    ctx.lineWidth = 5;
                    ctx.lineCap = 'round';
                    ctx.beginPath();
                    if (this.pose === 0) {
                        ctx.moveTo(-14, -4); ctx.lineTo(-27, -11);
                        ctx.moveTo(-14, 4); ctx.lineTo(-26, 9);
                        ctx.moveTo(4, -8); ctx.lineTo(14, -18);
                        ctx.moveTo(4, 8); ctx.lineTo(-4, 18);
                    } else if (this.pose === 1) {
                        ctx.moveTo(-12, -3); ctx.lineTo(-22, 12);
                        ctx.moveTo(-12, 3); ctx.lineTo(-25, 4);
                        ctx.moveTo(5, -7); ctx.lineTo(18, -3);
                        ctx.moveTo(3, 7); ctx.lineTo(12, 17);
                    } else if (this.pose === 2) {
                        ctx.moveTo(-10, -4); ctx.lineTo(-18, -14);
                        ctx.moveTo(-10, 4); ctx.lineTo(-16, 14);
                        ctx.moveTo(4, -6); ctx.lineTo(-6, -15);
                        ctx.moveTo(4, 6); ctx.lineTo(16, 11);
                    } else {
                        ctx.moveTo(-14, -3); ctx.lineTo(-28, -2);
                        ctx.moveTo(-14, 4); ctx.lineTo(-24, 13);
                        ctx.moveTo(6, -7); ctx.lineTo(20, -12);
                        ctx.moveTo(5, 7); ctx.lineTo(19, 8);
                    }
                    ctx.stroke();

                    // Torso
                    ctx.fillStyle = bodyCol;
                    ctx.beginPath();
                    ctx.ellipse(-2, 0, 15, 9, 0, 0, Math.PI * 2);
                    ctx.fill();

                    // Head
                    ctx.fillStyle = skinCol;
                    ctx.beginPath();
                    ctx.arc(14, this.pose === 1 ? 3 : -1, 6.5, 0, Math.PI * 2);
                    ctx.fill();

                    ctx.restore();
                }
            }

            // ============================================================================
            // STAIRWELL / ELEVATOR TRANSITION NODE (4-FLOOR MALL)
            // ============================================================================
            class StairNode {
                constructor(x, y, fromFloor, toFloor, destX, destY, label, blocked = false) {
                    this.x = x;
                    this.y = y;
                    this.fromFloor = fromFloor;
                    this.toFloor = toFloor;
                    this.destX = destX;
                    this.destY = destY;
                    this.label = label;
                    this.blocked = blocked;
                }

                draw(ctx) {
                    ctx.save();
                    ctx.translate(this.x, this.y);
                    ctx.fillStyle = this.blocked ? 'rgba(127, 29, 29, 0.35)' : 'rgba(14, 116, 144, 0.25)';
                    ctx.strokeStyle = this.blocked ? '#ef4444' : '#38bdf8';
                    ctx.lineWidth = 2;
                    ctx.fillRect(-34, -24, 68, 48);
                    ctx.strokeRect(-34, -24, 68, 48);

                    for (let i = -24; i <= 20; i += 8) {
                        ctx.strokeStyle = this.blocked ? 'rgba(248,113,113,0.45)' : 'rgba(125,211,252,0.45)';
                        ctx.beginPath();
                        ctx.moveTo(i, -20);
                        ctx.lineTo(i, 20);
                        ctx.stroke();
                    }

                    if (this.blocked) {
                        ctx.strokeStyle = '#ef4444';
                        ctx.lineWidth = 3;
                        ctx.beginPath();
                        ctx.moveTo(-30, -20); ctx.lineTo(30, 20);
                        ctx.moveTo(30, -20); ctx.lineTo(-30, 20);
                        ctx.stroke();
                    }

                    ctx.font = '900 10px ui-monospace, monospace';
                    ctx.textAlign = 'center';
                    ctx.fillStyle = this.blocked ? '#fca5a5' : '#bae6fd';
                    ctx.fillText(this.label, 0, -30);
                    ctx.restore();
                }
            }

            // ============================================================================
            // BREACHABLE SECURITY COMPLEX DOOR & CCTV MONITOR TERMINAL
            // ============================================================================
            class SecurityDoor {
                constructor(x, y, w, h, floor) {
                    this.x = x;
                    this.y = y;
                    this.w = w;
                    this.h = h;
                    this.floor = floor;
                    this.open = false;
                    this.wallRef = { x: x - w / 2, y: y - h / 2, w: w, h: h, floor: floor, color: '#334155', roofColor: '#475569' };
                    buildings.push(this.wallRef);
                }

                breach() {
                    if (this.open) return;
                    this.open = true;
                    const idx = buildings.indexOf(this.wallRef);
                    if (idx !== -1) buildings.splice(idx, 1);
                    sfx.playMelee();
                    camera.shake = 7;
                    for (let i = 0; i < 14; i++) {
                        particles.push(new Particle(this.x, this.y, Math2.rand(-180, 180), Math2.rand(-180, 180), Math2.rand(0.25, 0.55), '#fde047', 3, this.floor));
                    }
                    showBanner('SECURITY STEEL DOOR PRIED OPEN!', 2200);
                }

                draw(ctx) {
                    if (this.open) return;
                    ctx.save();
                    ctx.fillStyle = '#475569';
                    ctx.strokeStyle = '#f59e0b';
                    ctx.lineWidth = 2.5;
                    ctx.fillRect(this.x - this.w / 2, this.y - this.h / 2, this.w, this.h);
                    ctx.strokeRect(this.x - this.w / 2, this.y - this.h / 2, this.w, this.h);
                    ctx.font = '900 9px ui-monospace, monospace';
                    ctx.fillStyle = '#fde047';
                    ctx.textAlign = 'center';
                    ctx.fillText('BARRED DOOR', this.x, this.y - 12);
                    ctx.restore();
                }
            }

            class CCTVTerminal {
                constructor(x, y, floor) {
                    this.x = x;
                    this.y = y;
                    this.floor = floor;
                    this.activated = false;
                }

                activate() {
                    this.activated = true;
                    cctvRevealTimer = 45.0;
                    sfx.playPhonePing();
                    showBanner('CCTV MATRIX ONLINE: ALL MALL HOSTILES MAPPED ON RADAR!', 2800);
                    triggerMonologue('C', 'Got the security feeds up. Every looter and lookout on this floor is lit up on my radar now.');
                }

                draw(ctx) {
                    ctx.save();
                    ctx.translate(this.x, this.y);
                    ctx.fillStyle = '#0f172a';
                    ctx.strokeStyle = this.activated ? '#34d399' : '#38bdf8';
                    ctx.lineWidth = 2;
                    ctx.fillRect(-20, -14, 40, 28);
                    ctx.strokeRect(-20, -14, 40, 28);
                    ctx.fillStyle = this.activated ? '#10b981' : '#0284c7';
                    ctx.fillRect(-15, -9, 13, 10);
                    ctx.fillRect(2, -9, 13, 10);
                    ctx.font = '900 9px ui-monospace, monospace';
                    ctx.fillStyle = '#bae6fd';
                    ctx.textAlign = 'center';
                    ctx.fillText('CCTV CONSOLE', 0, -20);
                    ctx.restore();
                }
            }

            // ============================================================================
            // CIVILIAN / SHOPKEEPER / HOSTAGE ENTITY
            // ============================================================================
            class Civilian {
                constructor(x, y, label = 'SHOPPER', floor = null, isHostage = false) {
                    this.x = x;
                    this.y = y;
                    this.radius = 12;
                    this.floor = floor;
                    this.label = label;
                    this.isHostage = isHostage;
                    this.rescued = false;
                    this.dead = false;
                    this.angle = Math2.rand(0, Math.PI * 2);
                    this.cowerPhase = Math2.rand(0, Math.PI * 2);
                    this.rewardGiven = false;
                }

                takeDamage(amount, hitAngle) {
                    if (this.dead) return;
                    this.dead = true;
                    createBlood(this.x, this.y, hitAngle, 7);
                    sfx.playPainGroan(this.x, this.y);
                    decals.push(new Decal(this.x, this.y, 'blood', hitAngle, 16, this.floor));
                    corpses.push(new Corpse(this.x, this.y, hitAngle, 'civilian', this.floor, 2));
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
                                { side: 'incoming', sender: 'MR. CHEN', time: '07:03', text: '小C，还好你留下来帮我锁后仓……外面抢劫的人太多了，凌晨五点就把商场卷帘门撬开了，根本没法讲道理！ [Little C, thank goodness you stayed to help me lock the back storeroom... there are too many looters outside, they pried open the mall shutters at 5 AM, no reasoning with them!]' },
                                { side: 'outgoing', sender: 'C', time: '07:03', text: '老陈，把后门从里面反锁死，千万别开灯。我现在下中央扶梯去一楼 [G]，再去地下 B1 停车场拿我的装备包。 [Old Chen, bolt the back shutter from the inside and keep the lights off. I am taking the central escalator down to Ground [G] and B1 parkade for my go-bag.]' },
                                { side: 'incoming', sender: 'MR. CHEN', time: '07:03', text: '小心点！一楼 [G] 户外狩猎店柜台后面，我表弟留了一把七寸碳钢猎刀，带皮刀鞘。这些现金和水你拿着，路上用得着！ [Be careful! Behind the counter in the Ground [G] Outdoor & Hunting section, my cousin left a 7-inch carbon-steel hunting knife with a leather scabbard. Take this cash and water too, you will need it!]' }
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

                    if (this.isHostage && !this.rescued) {
                        this.rescued = true;
                        this.isHostage = false;
                        cashCollected += 750;
                        const cashEl = document.getElementById('cashCounter');
                        if (cashEl) {
                            cashEl.style.display = 'block';
                            cashEl.innerText = `CASH LOOTED: R${cashCollected.toLocaleString()}`;
                        }
                        sfx.playPickup();
                        showBanner('HOSTAGE RESCUED! +R750 CASH & INTEL SHARED', 2300);
                        triggerMonologue('C', 'Stay low behind the counter until the corridor is clear. Do not turn on any lights.');
                    }
                }

                update(dt) {
                    if (this.dead) return;
                    this.cowerPhase += dt * (this.isHostage ? 7.5 : 4.5);
                }

                draw(ctx) {
                    if (this.dead) return;
                    ctx.save();
                    ctx.translate(this.x, this.y);
                    const tremble = Math.sin(this.cowerPhase) * (this.isHostage ? 1.8 : 1.0);
                    ctx.fillStyle = this.isHostage ? '#fbbf24' : '#38bdf8';
                    ctx.beginPath();
                    ctx.arc(tremble, 0, this.radius, 0, Math.PI * 2);
                    ctx.fill();
                    ctx.strokeStyle = '#0f172a';
                    ctx.lineWidth = 2;
                    ctx.stroke();

                    ctx.fillStyle = '#fde68a';
                    ctx.beginPath();
                    ctx.arc(tremble, 0, 5.5, 0, Math.PI * 2);
                    ctx.fill();

                    ctx.font = '800 9px ui-monospace, monospace';
                    ctx.fillStyle = this.isHostage ? '#fde047' : '#bae6fd';
                    ctx.textAlign = 'center';
                    ctx.fillText(this.isHostage ? 'HOSTAGE [KNEELING]' : this.label, 0, -18);
                    ctx.restore();
                }
            }

            // ============================================================================
            // PLAYER CLASS (SNEAK STANCE, SILENT EXECUTIONS, BATTERY OPTICS, MAG FORFEITURE)
            // ============================================================================
            class Player {
                constructor(x, y, config = {}) {
                    this.x = x;
                    this.y = y;
                    this.radius = 15;
                    this.angle = 0;

                    this.baseSpeed = config.baseSpeed || 245;
                    this.sprintSpeed = config.sprintSpeed || 365;
                    this.sneakSpeed = 122;
                    this.isSneaking = false;

                    this.hp = config.hp || 100;
                    this.maxHp = config.maxHp || 100;
                    this.armor = config.armor !== undefined ? config.armor : 35;
                    this.maxArmor = config.maxArmor || 100;
                    this.stamina = 100;
                    this.condition = HeroCondition.create({ fieldCare: config.fieldCare !== undefined ? config.fieldCare : (config.weaponId === 'airsoft_pistol' ? 0 : 1) });

                    this.gender = config.gender || 'israeli_c';
                    this.heroTitle = config.heroTitle || 'C';
                    this.hasKnife = config.hasKnife !== undefined ? config.hasKnife : true;
                    this.hasMolleVest = config.hasMolleVest !== undefined ? config.hasMolleVest : false;
                    this.hasGoBag = config.hasGoBag !== undefined ? config.hasGoBag : true;

                    this.activeAmmoType = 'fmj';
                    this.jhpMags = 0;
                    this.weapon = { ...WEAPONS[config.weaponId || 'glock26'] };
                    this.ammo = this.weapon.magSize;
                    this.spareMags = config.spareMags !== undefined ? config.spareMags : 3;
                    this.magStyles = config.magStyles ? [...config.magStyles] : [];
                    this.currentMagStyle = config.currentMagStyle || 'standard';

                    this.lastShot = 0;
                    this.reloading = false;
                    this.reloadTimer = 0;
                    this.meleeCooldown = 0;
                    this.meleeAnim = 0;
                    this.animPhase = 0;
                    this.vehicle = null;
                    this.invulnTimer = 0;

                    // Lighting, Strobe & Battery-Limited Thermal/NVG Optics
                    this.hasFlashlight = Boolean(config.hasFlashlight);
                    this.flashlightOn = Boolean(config.flashlightOn);
                    this.strobeActive = false;
                    this.strobeTimer = 0;
                    this.strobePulsePhase = 0;
                    this.opticsMode = 0;
                    this.opticsBattery = config.opticsBattery !== undefined ? config.opticsBattery : 100;
                    this.powerBankMah = config.powerBankMah !== undefined ? config.powerBankMah : 10000;
                    this.lowAmmoMonoShown = false;
                }

                toggleSneak() {
                    if (this.vehicle) return;
                    this.isSneaking = !this.isSneaking;
                    sfx.playClick();
                    const el = document.getElementById('stanceIndicator');
                    if (el) {
                        el.innerText = this.isSneaking ? 'STANCE: SNEAK [C]' : 'STANCE: RUN [C]';
                        el.style.color = this.isSneaking ? '#34d399' : '#fcd34d';
                    }
                    showBanner(this.isSneaking ? 'SNEAK STANCE: LOW PROFILE & SILENT STEPS' : 'RUN STANCE: FULL MOBILITY', 1100);
                }

                toggleAmmoType() {
                    if (currentCampaign !== 'mall' || !this.hasGoBag) {
                        showBanner('100GR FMJ RANGE LOAD ONLY', 1200);
                        return;
                    }
                    if (this.activeAmmoType === 'fmj') {
                        if (this.jhpMags <= 0 && this.weapon.id !== 'glock26_jhp') {
                            showBanner('NO 120GR +P JHP MAGAZINES SCAVENGED YET', 1400);
                            return;
                        }
                        this.activeAmmoType = 'jhp';
                        this.weapon = { ...WEAPONS.glock26_jhp };
                        this.ammo = Math.min(this.ammo, this.weapon.magSize);
                        sfx.playClick();
                        showBanner('LOADED 120GR +P JHP (HIGH STOPPING POWER // BRIGHT FLASH)', 1800);
                    } else {
                        this.activeAmmoType = 'fmj';
                        this.weapon = { ...WEAPONS.glock26 };
                        sfx.playClick();
                        showBanner('LOADED 100GR FMJ (LOW FLASH // LOW RECOIL)', 1600);
                    }
                    this.updateHUD();
                }

                toggleFlashlight() {
                    if (!this.hasFlashlight) return;
                    this.flashlightOn = !this.flashlightOn;
                    if (!this.flashlightOn) this.strobeActive = false;
                    sfx.playClick();
                    showBanner(this.flashlightOn ? 'UNDERBARREL LIGHT: ON (VISIBLE TO ENEMIES)' : 'UNDERBARREL LIGHT: OFF (SHADOW CONCEALED)', 1400);
                }

                triggerStrobe() {
                    if (!this.hasFlashlight) return;
                    this.flashlightOn = true;
                    this.strobeActive = !this.strobeActive;
                    this.strobeTimer = this.strobeActive ? 3.2 : 0;
                    sfx.playClick();
                    if (this.strobeActive) {
                        sfx.playStrobeHum();
                        showBanner('TACTICAL STROBE ACTIVE — BLINDS HOSTILES IN BEAM!', 1500);
                    }
                }

                cycleOptics() {
                    if (!this.hasGoBag) {
                        sfx.playClick();
                        triggerMonologue('C', 'My thermal monocular and spare cells are locked inside my go-bag in the B1 parkade boot.');
                        return;
                    }
                    if (this.opticsMode === 0 && this.opticsBattery <= 4) {
                        sfx.playClick();
                        triggerMonologue('C', 'Monocular battery is drained. Needs a few seconds off to trickle-charge from the power bank.');
                        return;
                    }
                    this.opticsMode = (this.opticsMode + 1) % 3;
                    sfx.playOpticsWhine();
                    const labels = [
                        'OPTICS: STANDARD VISION',
                        'OPTICS: PHOSPHOR NIGHT VISION (NVG + IR LASER)',
                        'OPTICS: WHITE-HOT THERMAL (FLIR + IR LASER)'
                    ];
                    showBanner(labels[this.opticsMode], 1500);
                }

                update(dt) {
                    const ongoingLoss = HeroCondition.update(this.condition, dt);
                    if (ongoingLoss > 0) {
                        this.hp = Math.max(0, this.hp - ongoingLoss);
                        if (this.hp <= 0) {
                            triggerEndGame(false);
                            return;
                        }
                    }
                    if (this.invulnTimer > 0) this.invulnTimer -= dt;
                    if (this.meleeCooldown > 0) this.meleeCooldown -= dt;
                    if (this.meleeAnim > 0) this.meleeAnim -= dt * 4;

                    if (this.strobeActive) {
                        this.strobeTimer -= dt;
                        this.strobePulsePhase += dt * 42;
                        if (this.strobeTimer <= 0) {
                            this.strobeActive = false;
                        }
                    }

                    // Battery Drain & Finite 10,000 mAh Trickle Recharge
                    if (this.hasGoBag) {
                        if (this.opticsMode > 0) {
                            const drainRate = this.opticsMode === 2 ? 2.8 : 1.9;
                            this.opticsBattery = Math.max(0, this.opticsBattery - drainRate * dt);
                            if (this.opticsBattery <= 0) {
                                this.opticsMode = 0;
                                sfx.playClick();
                                showBanner('THERMAL MONOCULAR BATTERY DEPLETED — TRICKLE CHARGING', 2000);
                                triggerMonologue('C', 'Battery flat. Power bank is trickle-charging the cell now.');
                            }
                        } else if (this.opticsBattery < 100 && this.powerBankMah > 0) {
                            const chargeGain = 3.2 * dt;
                            const mahUsed = chargeGain * 14.0;
                            if (this.powerBankMah >= mahUsed) {
                                this.powerBankMah = Math.max(0, this.powerBankMah - mahUsed);
                                this.opticsBattery = Math.min(100, this.opticsBattery + chargeGain);
                            }
                        }
                    }

                    // Strobe disorientation pulse against enemies in beam
                    if (this.flashlightOn && this.strobeActive && !this.vehicle) {
                        const activeF = (currentCampaign === 'mall') ? currentMallFloor : null;
                        for (let i = 0; i < enemies.length; i++) {
                            const e = enemies[i];
                            if (activeF && e.floor && e.floor !== activeF) continue;
                            if (hasLightConeExposure(e.x, e.y, 440)) {
                                e.applyStrobeBlinding(2.8);
                            }
                        }
                    }

                    if (this.reloading) {
                        this.reloadTimer -= dt;
                        if (this.reloadTimer <= 0) {
                            this.reloading = false;
                            if (this.spareMags > 0) {
                                this.spareMags--;
                                if (this.magStyles.length > 0) {
                                    this.currentMagStyle = this.magStyles.shift();
                                }
                                if (this.activeAmmoType === 'jhp' && this.jhpMags > 0) {
                                    this.jhpMags--;
                                }
                            }
                            this.ammo = this.weapon.magSize;
                            this.updateHUD();
                        }
                    }

                    if (this.vehicle) {
                        this.x = this.vehicle.x;
                        this.y = this.vehicle.y;
                        this.angle = this.vehicle.angle;
                        this.updateHUD();
                        return;
                    }

                    let moveX = 0;
                    let moveY = 0;

                    if (input.leftStick.active) {
                        moveX = input.leftStick.dx;
                        moveY = input.leftStick.dy;
                    } else {
                        if (input.keys['KeyW'] || input.keys['ArrowUp']) moveY -= 1;
                        if (input.keys['KeyS'] || input.keys['ArrowDown']) moveY += 1;
                        if (input.keys['KeyA'] || input.keys['ArrowLeft']) moveX -= 1;
                        if (input.keys['KeyD'] || input.keys['ArrowRight']) moveX += 1;
                        const len = Math.hypot(moveX, moveY);
                        if (len > 0) {
                            moveX /= len;
                            moveY /= len;
                        }
                    }

                    const isMoving = Math.hypot(moveX, moveY) > 0.08;
                    if (isMoving && input.keys['ShiftLeft'] && this.isSneaking) {
                        this.isSneaking = false;
                        const el = document.getElementById('stanceIndicator');
                        if (el) {
                            el.innerText = 'STANCE: RUN [C]';
                            el.style.color = '#fcd34d';
                        }
                    }

                    const wantsSprint = !this.isSneaking && (input.keys['ShiftLeft'] || input.keys['ShiftRight']) && isMoving && this.stamina > 5;
                    let speed = (this.isSneaking ? this.sneakSpeed : this.baseSpeed) * HeroCondition.mobilityFactor(this.condition);

                    if (wantsSprint) {
                        speed = this.sprintSpeed * HeroCondition.mobilityFactor(this.condition);
                        this.stamina = Math.max(0, this.stamina - 32 * dt);
                        if (currentCampaign === 'mall' && Math.random() < 0.08) {
                            triggerLKP(this.x, this.y, 175, currentMallFloor);
                        }
                    } else {
                        this.stamina = Math.min(100, this.stamina + 24 * dt);
                    }

                    if (isMoving) {
                        this.animPhase += dt * (wantsSprint ? 15 : (this.isSneaking ? 6.5 : 10.5));
                        const nextX = this.x + moveX * speed * dt;
                        const nextY = this.y + moveY * speed * dt;
                        const resolved = resolveCircleWorldCollision(nextX, nextY, this.radius);
                        this.x = resolved.x;
                        this.y = resolved.y;
                    }

                    if (input.rightStick.active) {
                        if (Math.hypot(input.rightStick.dx, input.rightStick.dy) > 0.15) {
                            this.angle = Math.atan2(input.rightStick.dy, input.rightStick.dx);
                        }
                    } else if (!isMobileDevice) {
                        this.angle = Math2.angle(this.x, this.y, input.mouse.worldX, input.mouse.worldY);
                    }

                    if ((input.mouse.down || input.rightStick.active) && !this.reloading) {
                        this.tryShoot();
                    }

                    this.updateHUD();
                }

                tryShoot() {
                    const now = performance.now();
                    if (now - this.lastShot < this.weapon.fireRate) return;

                    if (this.ammo <= 0) {
                        sfx.playClick();
                        this.lastShot = now;
                        this.reload();
                        return;
                    }

                    this.lastShot = now;
                    this.ammo--;
                    camera.shake = Math.min(14, camera.shake + this.weapon.recoil);

                    if (this.weapon.isFlame) {
                        sfx.playFlamethrower();
                    } else {
                        sfx.playGunshot(this.weapon.id, this.x, this.y);
                        if (this.weapon.boltAction) {
                            setTimeout(() => sfx.playBoltCycle(), 260);
                        }
                    }

                    if (!this.weapon.isAirsoft) {
                        triggerLKP(this.x, this.y, this.weapon.alertRadius || 680);
                    } else {
                        triggerLKP(this.x, this.y, 320);
                    }

                    const muzzleDist = 22;
                    const mx = this.x + Math.cos(this.angle) * muzzleDist;
                    const my = this.y + Math.sin(this.angle) * muzzleDist;

                    if (!this.weapon.isFlame && !this.weapon.isAirsoft) {
                        const fScale = this.weapon.flashSize || 1.0;
                        particles.push(new Particle(mx, my, Math.cos(this.angle) * 140, Math.sin(this.angle) * 140, 0.085, this.weapon.isJHP ? '#f472b6' : '#fef08a', 11 * fScale, currentMallFloor));
                        if (!this.weapon.boltAction) {
                            const ejectAngle = this.angle + Math.PI / 2 + Math2.rand(-0.3, 0.3);
                            particles.push(new Particle(this.x + Math.cos(this.angle) * 8, this.y + Math.sin(this.angle) * 8, Math.cos(ejectAngle) * Math2.rand(90, 150), Math.sin(ejectAngle) * Math2.rand(90, 150), 0.38, '#eab308', 3, currentMallFloor, true));
                        }
                    }

                    for (let i = 0; i < this.weapon.pellets; i++) {
                        const spreadAngle = this.angle + Math2.rand(-this.weapon.spread, this.weapon.spread);
                        const spd = this.weapon.isFlame ? this.weapon.speed * Math2.rand(0.8, 1.15) : this.weapon.speed;
                        bullets.push(new Bullet(mx, my, spreadAngle, spd, this.weapon.damage, 'player', this, this.weapon.isFlame, this.weapon.isAirsoft, this.weapon.isJHP));
                    }

                    if (this.ammo === 0 && this.spareMags === 0 && !this.lowAmmoMonoShown && currentCampaign === 'mall') {
                        this.lowAmmoMonoShown = true;
                        triggerMonologue('C', 'Slide locked back. Zero spare magazines left—time to rely on the 7-inch blade and shadows.');
                    }

                    this.updateHUD();
                }

                meleeOrExecute() {
                    if (this.vehicle || this.meleeCooldown > 0) return false;
                    const activeF = (currentCampaign === 'mall') ? currentMallFloor : null;

                    if (this.hasKnife) {
                        for (let i = 0; i < enemies.length; i++) {
                            const e = enemies[i];
                            if (activeF && e.floor && e.floor !== activeF) continue;
                            if (e.faction === 'airsoft_adult') continue;
                            const d = Math2.dist(this.x, this.y, e.x, e.y);
                            if (d <= 54 && e.isExecutionVulnerable(this)) {
                                this.meleeCooldown = 0.65;
                                this.meleeAnim = 1.0;
                                sfx.playExecution();
                                e.takeDamage(999, this.angle, false, true);
                                showBanner('SILENT 7-INCH BLADE EXECUTION!', 1500);
                                return true;
                            }
                        }
                    }

                    if (!this.hasKnife) {
                        showBanner('NO BLADE EQUIPPED — CHECK GROUND [G] HUNTING AISLE', 1400);
                        return false;
                    }

                    this.meleeCooldown = 0.42;
                    this.meleeAnim = 1.0;
                    sfx.playMelee();

                    const reach = 58;
                    for (let i = enemies.length - 1; i >= 0; i--) {
                        const e = enemies[i];
                        if (activeF && e.floor && e.floor !== activeF) continue;
                        const d = Math2.dist(this.x, this.y, e.x, e.y);
                        if (d <= reach + e.radius) {
                            const ang = Math2.angle(this.x, this.y, e.x, e.y);
                            if (Math.abs(Math2.angleDiff(this.angle, ang)) < 1.15) {
                                e.takeDamage(95, ang);
                            }
                        }
                    }
                    return true;
                }

                reload() {
                    if (this.reloading) return;
                    if (this.spareMags <= 0) {
                        showBanner('NO SPARE MAGAZINES LEFT!', 1200);
                        return;
                    }
                    const forfeited = this.ammo;
                    const activeF = (currentCampaign === 'mall') ? currentMallFloor : null;
                    droppedMags.push(new DroppedMag(this.x, this.y, this.angle, this.currentMagStyle, forfeited > 0, activeF));

                    this.ammo = 0;
                    this.reloading = true;
                    this.reloadTimer = 1.05;
                    sfx.playReload();

                    if (forfeited > 0) {
                        showBanner(`MAG TOSSED (${forfeited} UNFIRED ROUNDS FORFEITED)`, 1600);
                    }
                    this.updateHUD();
                }

                useFieldCare() {
                    const outcome = HeroCondition.useFieldCare(this.condition);
                    showBanner(outcome.reason, 1700);
                    this.updateHUD();
                    return outcome.ok;
                }

                takeDamage(amount) {
                    if (this.invulnTimer > 0) return;
                    sfx.playHit();
                    camera.shake = Math.min(18, camera.shake + 7);

                    if (this.armor > 0) {
                        const absorbed = Math.min(this.armor, amount * 0.65);
                        this.armor -= absorbed;
                        amount -= absorbed;
                    }
                    this.hp = Math.max(0, this.hp - amount);
                    if (currentCampaign !== 'training' && amount > 0) {
                        HeroCondition.recordInjury(this.condition, amount);
                    }
                    this.updateHUD();

                    if (this.hp <= 0) {
                        triggerEndGame(false);
                    }
                }

                updateHUD() {
                    document.getElementById('hudHeroName').innerText = this.heroTitle;
                    const floorEl = document.getElementById('hudFloorBadge');
                    if (floorEl) {
                        if (currentCampaign === 'mall') {
                            floorEl.style.display = 'inline-block';
                            floorEl.innerText = `FLOOR: ${currentMallFloor}`;
                        } else {
                            floorEl.style.display = 'none';
                        }
                    }

                    const conditionEl = document.getElementById('conditionStatus');
                    if (conditionEl) {
                        conditionEl.textContent = this.condition.bleeding > 0
                            ? `BLEEDING · FIELD CARE [H] · ${this.condition.fieldCare} LEFT`
                            : (this.condition.injury > 0 ? `INJURED · ${this.condition.fieldCare} CARE KITS` : `STABLE · ${this.condition.fieldCare} CARE KITS`);
                        conditionEl.style.color = this.condition.bleeding > 0 ? '#fda4af' : '#86efac';
                    }
                    const hpPct = Math.ceil((this.hp / this.maxHp) * 100);
                    document.getElementById('hpValue').innerText = `${hpPct}%`;
                    document.getElementById('hpBar').style.width = `${hpPct}%`;

                    const armorRow = document.getElementById('armorRow');
                    const armorTrack = document.getElementById('armorTrack');
                    if (this.maxArmor <= 0) {
                        armorRow.style.display = 'none';
                        armorTrack.style.display = 'none';
                    } else {
                        armorRow.style.display = 'flex';
                        armorTrack.style.display = 'block';
                        const armorPct = Math.ceil((this.armor / this.maxArmor) * 100);
                        document.getElementById('armorValue').innerText = `${Math.ceil(this.armor)}`;
                        document.getElementById('armorBar').style.width = `${armorPct}%`;
                    }

                    const stamPct = Math.ceil(this.stamina);
                    document.getElementById('staminaValue').innerText = `${stamPct}%`;
                    document.getElementById('staminaBar').style.width = `${stamPct}%`;

                    document.getElementById('weaponName').innerText = this.weapon.name;
                    const loadBadge = document.getElementById('ammoLoadBadge');
                    if (loadBadge) {
                        if (this.weapon.isAirsoft) {
                            loadBadge.innerText = '0.25G 6MM BBS';
                        } else if (this.weapon.isJHP) {
                            loadBadge.innerText = `120GR +P JHP (${this.jhpMags} MAGS) [B]`;
                        } else if (currentCampaign === 'mall') {
                            loadBadge.innerText = this.jhpMags > 0 ? `100GR FMJ (${this.jhpMags} JHP) [B]` : '100GR FMJ [B]';
                        } else {
                            loadBadge.innerText = 'BALLISTIC LOAD';
                        }
                    }

                    const ammoEl = document.getElementById('ammoCount');
                    if (this.reloading) {
                        ammoEl.innerText = 'SWAPPING MAG...';
                        ammoEl.className = 'text-[11px] font-mono font-extrabold text-amber-400 shrink-0';
                    } else {
                        ammoEl.innerText = `${this.ammo} / ${this.spareMags} MAGS`;
                        ammoEl.className = this.ammo <= 3
                            ? 'text-[11px] font-mono font-extrabold text-rose-400 shrink-0'
                            : 'text-[11px] font-mono font-extrabold text-white shrink-0';
                    }

                    const roundsTray = document.getElementById('magRoundsTray');
                    const roundKey = `${this.weapon.id}|${this.weapon.magSize}|${this.ammo}|${Boolean(this.weapon.isAirsoft)}|${Boolean(this.weapon.isJHP)}`;
                    if (roundsTray && roundsTray.dataset.renderKey !== roundKey) {
                        const displayMax = Math.min(this.weapon.magSize, 35);
                        const ratio = this.weapon.magSize / displayMax;
                        const activeIcons = Math.ceil(this.ammo / ratio);
                        let html = '';
                        for (let i = 0; i < displayMax; i++) {
                            const cls = this.weapon.isAirsoft ? 'bb' : (this.weapon.isJHP ? 'jhp' : '');
                            const spent = i >= activeIcons ? 'spent' : '';
                            html += `<span class="cartridge-icon ${cls} ${spent}"></span>`;
                        }
                        roundsTray.innerHTML = html;
                        roundsTray.dataset.renderKey = roundKey;
                    }

                    const spareTray = document.getElementById('spareMagsTray');
                    const spareLbl = document.getElementById('spareMagLabel');
                    if (spareLbl) spareLbl.innerText = `${this.spareMags} LEFT`;
                    const spareKey = `${this.spareMags}|${this.magStyles.join(',')}`;
                    if (spareTray && spareTray.dataset.renderKey !== spareKey) {
                        let mHtml = '';
                        for (let i = 0; i < this.spareMags; i++) {
                            const st = this.magStyles[i] || 'standard';
                            mHtml += `<span class="spare-mag-icon ${st}"></span>`;
                        }
                        if (this.spareMags === 0) {
                            mHtml = `<span class="spare-mag-icon empty-slot"></span><span class="text-[9px] font-mono text-rose-400 ml-1">EMPTY</span>`;
                        }
                        spareTray.innerHTML = mHtml;
                        spareTray.dataset.renderKey = spareKey;
                    }

                    const stealthEl = document.getElementById('stealthIndicator');
                    if (stealthEl) {
                        if (this.flashlightOn) {
                            stealthEl.innerText = this.strobeActive ? 'SIGNATURE: STROBE FLASHING' : 'SIGNATURE: LIGHT EXPOSED';
                            stealthEl.style.color = this.strobeActive ? '#f472b6' : '#fbbf24';
                        } else if (this.isSneaking) {
                            stealthEl.innerText = 'SIGNATURE: SHADOW CROUCH';
                            stealthEl.style.color = '#34d399';
                        } else {
                            stealthEl.innerText = 'SIGNATURE: DARK / SILENT';
                            stealthEl.style.color = '#38bdf8';
                        }
                    }

                    const opticsEl = document.getElementById('opticsIndicator');
                    const bankEl = document.getElementById('powerBankIndicator');
                    if (opticsEl && bankEl) {
                        if (currentCampaign === 'mall' || this.hasGoBag) {
                            opticsEl.style.display = 'inline';
                            bankEl.style.display = 'inline';
                            if (!this.hasGoBag) {
                                opticsEl.innerText = 'OPTICS [V]: IN B1 CAR BOOT';
                                opticsEl.style.color = '#94a3b8';
                                bankEl.innerText = 'GO-BAG: UNRECOVERED';
                                bankEl.style.color = '#64748b';
                            } else {
                                const bat = Math.ceil(this.opticsBattery);
                                if (this.opticsMode === 0) {
                                    opticsEl.innerText = `OPTICS [V]: OFF (${bat}%)`;
                                    opticsEl.style.color = '#94a3b8';
                                } else if (this.opticsMode === 1) {
                                    opticsEl.innerText = `NVG [V]: ${bat}%`;
                                    opticsEl.style.color = '#4ade80';
                                } else {
                                    opticsEl.innerText = `FLIR [V]: ${bat}%`;
                                    opticsEl.style.color = '#f8fafc';
                                }
                                bankEl.innerText = `BANK: ${Math.round(this.powerBankMah).toLocaleString()} mAh`;
                                bankEl.style.color = this.powerBankMah > 1500 ? '#38bdf8' : '#f59e0b';
                            }
                        } else {
                            opticsEl.style.display = 'none';
                            bankEl.style.display = 'none';
                        }
                    }
                }

                draw(ctx) {
                    if (this.vehicle) return;

                    ctx.save();
                    ctx.translate(this.x, this.y);
                    ctx.rotate(this.angle);

                    const stanceScale = this.isSneaking ? 0.88 : 1.0;
                    ctx.scale(stanceScale, stanceScale);

                    // Invisible Infrared (IR) Laser visible only when NVG or Thermal is active
                    if (this.opticsMode > 0) {
                        const maxLaser = 680;
                        const lx = this.x + Math.cos(this.angle) * maxLaser;
                        const ly = this.y + Math.sin(this.angle) * maxLaser;
                        const wallT = raycastBuildingsT(this.x, this.y, lx, ly);
                        const actualDist = wallT !== null ? wallT * maxLaser : maxLaser;

                        ctx.save();
                        ctx.strokeStyle = this.opticsMode === 2 ? 'rgba(248, 250, 252, 0.85)' : 'rgba(74, 222, 128, 0.85)';
                        ctx.lineWidth = 1.6;
                        ctx.beginPath();
                        ctx.moveTo(22, 4);
                        ctx.lineTo(actualDist, 0);
                        ctx.stroke();

                        ctx.fillStyle = this.opticsMode === 2 ? '#ffffff' : '#86efac';
                        ctx.beginPath();
                        ctx.arc(actualDist, 0, 3.2, 0, Math.PI * 2);
                        ctx.fill();
                        ctx.restore();
                    }

                    const swing = Math.sin(this.animPhase) * (this.isSneaking ? 3 : 5);
                    ctx.fillStyle = '#0f172a';
                    ctx.beginPath();
                    ctx.arc(-5, -8 + swing, 4.5, 0, Math.PI * 2);
                    ctx.arc(-5, 8 - swing, 4.5, 0, Math.PI * 2);
                    ctx.fill();

                    if (this.meleeAnim > 0 && this.hasKnife) {
                        ctx.save();
                        ctx.rotate(-0.9 + (1 - this.meleeAnim) * 2.1);
                        ctx.strokeStyle = '#e2e8f0';
                        ctx.lineWidth = 3.5;
                        ctx.beginPath();
                        ctx.moveTo(10, 4);
                        ctx.lineTo(36, 12);
                        ctx.stroke();
                        ctx.restore();
                    }

                    // Torso / Outfit
                    if (this.gender === 'young_c') {
                        ctx.fillStyle = '#3f6212';
                    } else if (this.gender === 'israeli_c') {
                        ctx.fillStyle = this.hasMolleVest ? '#365314' : '#4d7c0f';
                    } else if (this.gender === 'female') {
                        ctx.fillStyle = '#ea580c';
                    } else if (this.gender === 'sniper') {
                        ctx.fillStyle = '#4d7c0f';
                    } else {
                        ctx.fillStyle = '#1e293b';
                    }
                    ctx.beginPath();
                    ctx.arc(0, 0, this.radius, 0, Math.PI * 2);
                    ctx.fill();
                    ctx.lineWidth = 2;
                    ctx.strokeStyle = this.isSneaking ? '#34d399' : '#090d16';
                    ctx.stroke();

                    // Flannel check grid or MOLLE plate carrier straps
                    if (this.gender === 'israeli_c') {
                        if (this.hasMolleVest) {
                            ctx.fillStyle = '#1a2e05';
                            ctx.fillRect(-7, -9, 13, 18);
                            ctx.strokeStyle = '#65a30d';
                            ctx.lineWidth = 1;
                            ctx.strokeRect(-7, -9, 13, 18);
                        } else {
                            ctx.strokeStyle = 'rgba(15, 23, 42, 0.55)';
                            ctx.lineWidth = 1.2;
                            ctx.beginPath();
                            ctx.moveTo(-10, -4); ctx.lineTo(10, -4);
                            ctx.moveTo(-10, 4); ctx.lineTo(10, 4);
                            ctx.moveTo(-3, -11); ctx.lineTo(-3, 11);
                            ctx.moveTo(4, -11); ctx.lineTo(4, 11);
                            ctx.stroke();
                        }
                    }

                    // Weapon
                    if (this.weapon.id === 'glock26' || this.weapon.id === 'glock26_jhp' || this.weapon.id === 'airsoft_pistol') {
                        ctx.fillStyle = '#ec4899';
                        ctx.fillRect(10, 2, 12, 5);
                        ctx.fillStyle = '#0f172a';
                        ctx.fillRect(11, 2.5, 11, 4);
                        ctx.fillStyle = '#334155';
                        ctx.fillRect(14, 1.5, 6, 6);
                        if (this.flashlightOn) {
                            ctx.fillStyle = '#fef08a';
                            ctx.fillRect(21, 3, 3, 3);
                        }
                    } else {
                        ctx.fillStyle = this.weapon.id === 'ruger' ? '#78350f' : '#111827';
                        ctx.fillRect(8, 2, 23, 5);
                    }

                    // Head
                    ctx.fillStyle = (this.gender === 'israeli_c' || this.gender === 'young_c') ? '#c68663' : (this.gender === 'female' ? '#fed7aa' : '#e2b49a');
                    ctx.beginPath();
                    ctx.arc(2, 0, 8.5, 0, Math.PI * 2);
                    ctx.fill();

                    // Hair
                    ctx.fillStyle = (this.gender === 'israeli_c' || this.gender === 'young_c') ? '#090d16' : (this.gender === 'female' ? '#dc2626' : (this.gender === 'sniper' ? '#365314' : '#f1f5f9'));
                    ctx.beginPath();
                    ctx.arc(-1, 0, 8, Math.PI * 0.55, Math.PI * 1.45);
                    ctx.fill();

                    if (this.gender === 'young_c') {
                        ctx.fillStyle = '#090d16';
                        ctx.beginPath();
                        ctx.arc(-11, 0, 4.5, 0, Math.PI * 2);
                        ctx.fill();
                    }

                    if (sfx.musicEnabled) {
                        ctx.fillStyle = '#ffffff';
                        ctx.beginPath();
                        ctx.arc(2, -7.8, 2.2, 0, Math.PI * 2);
                        ctx.arc(2, 7.8, 2.2, 0, Math.PI * 2);
                        ctx.fill();
                    }

                    ctx.restore();
                }
            }

            // ============================================================================
            // VEHICLE CLASS
            // ============================================================================
            class Vehicle {
                constructor(x, y, angle, type = 'police', floor = null) {
                    this.x = x;
                    this.y = y;
                    this.angle = angle;
                    this.type = type;
                    this.floor = floor;
                    this.w = type === 'taxi' ? 84 : (type === 'hatchback' ? 76 : 80);
                    this.h = 44;
                    this.speed = 0;
                    this.hp = type === 'taxi' ? 400 : 280;
                    this.maxHp = this.hp;
                    this.destroyed = false;
                    this.sirenPhase = Math2.rand(0, Math.PI * 2);
                }

                update(dt) {
                    if (this.destroyed) return;
                    this.sirenPhase += dt * 10;
                    if (player.vehicle === this) {
                        let throttle = 0;
                        let steer = 0;
                        if (input.leftStick.active) {
                            throttle = -input.leftStick.dy;
                            steer = input.leftStick.dx;
                        } else {
                            if (input.keys['KeyW'] || input.keys['ArrowUp']) throttle += 1;
                            if (input.keys['KeyS'] || input.keys['ArrowDown']) throttle -= 1;
                            if (input.keys['KeyA'] || input.keys['ArrowLeft']) steer -= 1;
                            if (input.keys['KeyD'] || input.keys['ArrowRight']) steer += 1;
                        }
                        if (throttle > 0) this.speed += 520 * throttle * dt;
                        else if (throttle < 0) this.speed += 380 * throttle * dt;
                        else this.speed *= Math.pow(0.25, dt);

                        this.speed = Math2.clamp(this.speed, -220, 620);
                        if (Math.abs(this.speed) > 15) {
                            this.angle += steer * 2.8 * (this.speed > 0 ? 1 : -1) * dt;
                        }
                        const nx = this.x + Math.cos(this.angle) * this.speed * dt;
                        const ny = this.y + Math.sin(this.angle) * this.speed * dt;
                        const res = resolveCircleWorldCollision(nx, ny, 26);
                        this.x = res.x;
                        this.y = res.y;
                    }
                }

                takeDamage(amount) {
                    if (this.destroyed) return;
                    this.hp -= amount;
                    if (this.hp <= 0) {
                        this.hp = 0;
                        this.destroyed = true;
                        this.speed = 0;
                        sfx.playExplosion(this.x, this.y);
                        camera.shake = 18;
                        decals.push(new Decal(this.x, this.y, 'scorch', this.angle, 48, this.floor));
                        if (player.vehicle === this) player.vehicle = null;
                    }
                }

                draw(ctx) {
                    ctx.save();
                    ctx.translate(this.x, this.y);
                    ctx.rotate(this.angle);

                    ctx.fillStyle = 'rgba(0,0,0,0.45)';
                    ctx.fillRect(-this.w / 2 + 5, -this.h / 2 + 7, this.w, this.h);

                    ctx.fillStyle = this.destroyed ? '#1f2937' : (this.type === 'taxi' ? '#f8fafc' : (this.type === 'hatchback' ? '#334155' : '#1e3a8a'));
                    ctx.beginPath();
                    ctx.roundRect(-this.w / 2, -this.h / 2, this.w, this.h, 8);
                    ctx.fill();
                    ctx.lineWidth = 2;
                    ctx.strokeStyle = this.type === 'hatchback' ? '#38bdf8' : '#0f172a';
                    ctx.stroke();

                    if (!this.destroyed && this.type === 'taxi') {
                        ctx.fillStyle = '#0284c7';
                        ctx.fillRect(-this.w / 2 + 4, -this.h / 2 + 4, this.w - 8, 6);
                        ctx.fillRect(-this.w / 2 + 4, this.h / 2 - 10, this.w - 8, 6);
                    }

                    ctx.fillStyle = this.destroyed ? '#090d16' : '#38bdf8';
                    ctx.fillRect(this.w / 2 - 24, -this.h / 2 + 5, 13, this.h - 10);

                    if (!this.destroyed && this.type === 'police') {
                        const flash = Math.sin(this.sirenPhase) > 0;
                        ctx.fillStyle = flash ? '#ef4444' : '#3b82f6';
                        ctx.fillRect(-4, -14, 7, 13);
                        ctx.fillStyle = !flash ? '#ef4444' : '#3b82f6';
                        ctx.fillRect(-4, 1, 7, 13);
                    }

                    ctx.restore();
                }
            }

            // ============================================================================
            // ALLY AI (YOUNGER G & YOUNGER BLAZE IN AIRSOFT SKIRMISH)
            // ============================================================================
            class Ally {
                constructor(x, y, name, heroType, weaponId, floor = null) {
                    this.x = x;
                    this.y = y;
                    this.radius = 14;
                    this.name = name;
                    this.heroType = heroType;
                    this.floor = floor;
                    this.hp = 100;
                    this.maxHp = 100;
                    this.angle = 0;
                    this.speed = 215;
                    this.weapon = { ...WEAPONS[weaponId] };
                    this.lastShot = 0;
                    this.animPhase = Math2.rand(0, 6);
                    this.isOut = false;
                }

                takeDamage(amount) {
                    if (this.isOut) return;
                    this.hp -= amount;
                    if (this.hp <= 0) {
                        this.hp = 0;
                        this.isOut = true;
                        showBanner(`${this.name}: "HIT! I'M OUT!"`, 1800);
                    }
                }

                update(dt) {
                    if (this.isOut) return;
                    const activeF = (currentCampaign === 'mall') ? currentMallFloor : null;

                    let target = null;
                    let bestDist = 660;
                    for (let i = 0; i < enemies.length; i++) {
                        const e = enemies[i];
                        if (activeF && e.floor && e.floor !== activeF) continue;
                        const d = Math2.dist(this.x, this.y, e.x, e.y);
                        if (d < bestDist && hasLoS(this.x, this.y, e.x, e.y, activeF)) {
                            bestDist = d;
                            target = e;
                        }
                    }

                    if (target) {
                        this.angle = Math2.angle(this.x, this.y, target.x, target.y);
                        const now = performance.now();
                        if (now - this.lastShot >= this.weapon.fireRate * 1.45) {
                            this.lastShot = now;
                            sfx.playGunshot(this.weapon.id, this.x, this.y);
                            const mx = this.x + Math.cos(this.angle) * 20;
                            const my = this.y + Math.sin(this.angle) * 20;
                            bullets.push(new Bullet(mx, my, this.angle + Math2.rand(-0.06, 0.06), this.weapon.speed, this.weapon.damage, 'player', this, false, true));
                        }
                    }

                    const dPlayer = Math2.dist(this.x, this.y, player.x, player.y);
                    if (dPlayer > 115) {
                        const followAng = Math2.angle(this.x, this.y, player.x, player.y);
                        if (!target) this.angle = followAng;
                        const res = resolveCircleWorldCollision(this.x + Math.cos(followAng) * this.speed * dt, this.y + Math.sin(followAng) * this.speed * dt, this.radius);
                        this.x = res.x;
                        this.y = res.y;
                        this.animPhase += dt * 11;
                    }
                }

                draw(ctx) {
                    ctx.save();
                    ctx.translate(this.x, this.y);
                    ctx.rotate(this.angle);
                    ctx.globalAlpha = this.isOut ? 0.55 : 1.0;

                    ctx.fillStyle = this.heroType === 'young_blaze' ? '#9a3412' : '#1e3a8a';
                    ctx.beginPath();
                    ctx.arc(0, 0, this.radius, 0, Math.PI * 2);
                    ctx.fill();
                    ctx.lineWidth = 2;
                    ctx.strokeStyle = '#34d399';
                    ctx.stroke();

                    ctx.fillStyle = '#0f172a';
                    ctx.fillRect(8, 2, 20, 4.5);

                    ctx.fillStyle = '#f1c27d';
                    ctx.beginPath();
                    ctx.arc(2, 0, 7.5, 0, Math.PI * 2);
                    ctx.fill();

                    ctx.fillStyle = this.heroType === 'young_blaze' ? '#dc2626' : '#451a03';
                    ctx.beginPath();
                    ctx.arc(-1, 0, 7, Math.PI * 0.55, Math.PI * 1.45);
                    ctx.fill();

                    if (this.isOut) {
                        ctx.fillStyle = '#f97316';
                        ctx.fillRect(-6, -12, 12, 7);
                    }
                    ctx.restore();

                    ctx.save();
                    ctx.font = '800 9px ui-monospace, monospace';
                    ctx.fillStyle = this.isOut ? '#fdba74' : '#6ee7b7';
                    ctx.textAlign = 'center';
                    ctx.fillText(this.isOut ? `${this.name} [OUT]` : this.name, this.x, this.y - 20);
                    ctx.restore();
                }
            }

            // ============================================================================
            // TACTICAL FACTION AI (SIGHT CONES, ISIZULU BARKS, PAIN CRIES & WOUNDED LIMP)
            // ============================================================================
            const ZULU_HOSTAGE_BARKS = [
                'HLALA PHANSI!',
                'VULA I-SAFE MANJE!',
                'THULA WENA!',
                'NGIZOKUDUBULA!',
                'LETHA IMALI!'
            ];
            const ZULU_ALARM_BARKS = [
                'NANGU UMUNTU!',
                'NAYA IMPI!',
                'BAMBA LO!',
                'MCASHELE!',
                'BALEKANI!'
            ];
            const ZULU_LOOT_BARKS = [
                'VULA LO MNYANGO!',
                'PHUSHA, PHUSHA!',
                'THATHA LEZO ZINTO!',
                'SHESHISA!'
            ];
            const PAIN_CRIES = [
                'EISH!', 'EINA!', 'HAWU!', 'HAYI BO!',
                'NGICELA USIZO!', 'MAMA!', 'NKOSI YAMI!',
                'NGIYAZWA!', 'NGISIZENI!', 'AYI!' // Provisional: native-speaker review before voice work.
            ];

            class Enemy {
                constructor(x, y, faction = 'looter', isBoss = false, floor = null, activity = null) {
                    this.x = x;
                    this.y = y;
                    this.faction = faction;
                    this.isBoss = isBoss;
                    this.floor = floor;
                    this.activity = activity;
                    this.radius = isBoss ? 22 : (faction === 'dog' ? 11 : 14);

                    this.isUnarmed = (faction === 'looter_unarmed');
                    this.isMeleeLooter = (faction === 'melee_looter');
                    this.isSpotter = this.isUnarmed && (Math.random() < 0.42);
                    this.spotterWarnTimer = 0;
                    this.spotterCooldown = 0;

                    this.hesitationBase = faction === 'airsoft_adult' ? 0.35
                        : (faction === 'blockade_goon' || faction === 'security' ? 0.40
                        : (faction === 'hostage_taker' ? 0.55 : Math2.rand(0.85, 1.45)));
                    this.hesitationTimer = 0;
                    this.blindTimer = 0;
                    this.blindPanicShotTimer = 0;
                    this.dashTimer = 0;
                    this.dashCooldown = Math2.rand(1.5, 3.5);

                    this.hostageTarget = null;
                    this.hostageExecuteTimer = 5.5;

                    this.lkpX = null;
                    this.lkpY = null;
                    this.lkpSearchTimer = 0;

                    this.panicState = 'normal';
                    this.panicTimer = 0;
                    this.fleeAngle = 0;
                    this.woundedSpeedFactor = 1.0;
                    this.nearbyAllyDeaths = 0;
                    this.barkText = '';
                    this.barkTimer = 0;
                    this.barkCooldown = Math2.rand(2.0, 6.0);

                    if (faction === 'airsoft_adult') {
                        this.hp = 60;
                        this.speed = 185;
                        this.dmg = 34;
                        this.fireDelay = 520;
                        this.attackRange = 540;
                    } else if (faction === 'dog') {
                        this.hp = 45;
                        this.speed = 310;
                        this.dmg = 22;
                        this.fireDelay = 650;
                        this.attackRange = 32;
                    } else if (faction === 'blockade_goon' || faction === 'security') {
                        this.hp = isBoss ? 340 : 115;
                        this.speed = isBoss ? 145 : 175;
                        this.dmg = isBoss ? 38 : 34;
                        this.fireDelay = isBoss ? 360 : 540;
                        this.attackRange = isBoss ? 680 : 620;
                    } else if (faction === 'hostage_taker') {
                        this.hp = 85;
                        this.speed = 140;
                        this.dmg = 24;
                        this.fireDelay = 720;
                        this.attackRange = 460;
                    } else if (this.isMeleeLooter) {
                        this.hp = 78;
                        this.speed = 215;
                        this.dmg = 26;
                        this.fireDelay = 700;
                        this.attackRange = 36;
                    } else if (this.isUnarmed) {
                        this.hp = 60;
                        this.speed = 225;
                        this.dmg = 0;
                        this.fireDelay = 9999;
                        this.attackRange = 0;
                    } else {
                        this.hp = 82;
                        this.speed = 175;
                        this.dmg = 22;
                        this.fireDelay = 860;
                        this.attackRange = 460;
                    }

                    this.maxHp = this.hp;
                    this.lastShot = 0;
                    this.angle = Math2.rand(0, Math.PI * 2);
                    this.wanderTimer = Math2.rand(1, 4);
                    this.animPhase = Math2.rand(0, 6);
                }

                sayZulu(phrase, dur = 2.4) {
                    this.barkText = phrase;
                    this.barkTimer = dur;
                }

                sayPainCry() {
                    const cry = PAIN_CRIES[Math2.randInt(0, PAIN_CRIES.length - 1)];
                    this.barkText = cry;
                    this.barkTimer = 2.2;
                    sfx.playPainGroan(this.x, this.y);
                }

                isExecutionVulnerable(attacker) {
                    if (this.isBoss || this.faction === 'dog') return false;
                    if (this.blindTimer > 0.25) return true;
                    if (this.panicState === 'wounded_retreat' || this.panicState === 'fleeing') return true;
                    const angToPlayer = Math2.angle(this.x, this.y, attacker.x, attacker.y);
                    const facingDiff = Math.abs(Math2.angleDiff(this.angle, angToPlayer));
                    return facingDiff > 1.75;
                }

                getVisionConeParams() {
                    const isDarkMall = (currentCampaign === 'mall' && this.floor !== 'L2');
                    if (this.blindTimer > 0) return { range: 45, halfAngle: 0.35 };
                    if (this.faction === 'airsoft_adult') return { range: 580, halfAngle: 0.78 };
                    if (this.faction === 'blockade_goon') return { range: 620, halfAngle: 0.80 };
                    if (!isDarkMall) return { range: 540, halfAngle: 0.75 };

                    if (player && player.flashlightOn) return { range: 540, halfAngle: 0.85 };
                    if (player && player.isSneaking) return { range: 95, halfAngle: 0.58 };
                    return { range: 175, halfAngle: 0.68 };
                }

                canDetectPlayer() {
                    if (!player || player.vehicle) return false;
                    if (this.blindTimer > 0) return false;
                    const activeF = (currentCampaign === 'mall') ? currentMallFloor : null;
                    if (activeF && this.floor && this.floor !== activeF) return false;

                    const d = Math2.dist(this.x, this.y, player.x, player.y);
                    if (!hasLoS(this.x, this.y, player.x, player.y, activeF)) return false;

                    const cone = this.getVisionConeParams();
                    const angToPlayer = Math2.angle(this.x, this.y, player.x, player.y);
                    const facingDiff = Math.abs(Math2.angleDiff(this.angle, angToPlayer));

                    if (d <= 64) return true;
                    if (facingDiff <= cone.halfAngle && d <= cone.range) return true;

                    if (player.flashlightOn && hasLightConeExposure(this.x, this.y, 460)) {
                        return true;
                    }
                    return false;
                }

                applyStrobeBlinding(duration = 2.6) {
                    if (this.blindTimer <= 0.3) {
                        this.hesitationTimer = 0;
                    }
                    this.blindTimer = Math.max(this.blindTimer, duration);
                }

                alertLKP(x, y) {
                    if (this.blindTimer > 0.5) return;
                    this.lkpX = x + Math2.rand(-28, 28);
                    this.lkpY = y + Math2.rand(-28, 28);
                    this.lkpSearchTimer = Math2.rand(9.0, 14.0);
                    if (this.isUnarmed && this.panicState === 'normal') {
                        this.sayZulu('BALEKANI!', 2.0);
                        this.panicState = 'fleeing';
                        this.panicTimer = 6.5;
                        this.fleeAngle = Math2.angle(x, y, this.x, this.y) + Math2.rand(-0.4, 0.4);
                    }
                }

                onNearbyAllyKilled(killerX, killerY) {
                    if (this.faction === 'airsoft_adult') return;
                    this.nearbyAllyDeaths++;
                    if (this.isBoss || this.faction === 'dog') return;
                    if (this.faction === 'blockade_goon' && this.nearbyAllyDeaths < 4) return;
                    if (this.nearbyAllyDeaths >= 2 && this.panicState !== 'fleeing') {
                        this.sayZulu('BALEKANI! BALEKANI!', 2.2);
                        this.panicState = 'fleeing';
                        this.panicTimer = 8.0;
                        this.fleeAngle = Math2.angle(killerX, killerY, this.x, this.y) + Math2.rand(-0.4, 0.4);
                    }
                }

                takeDamage(amount, hitAngle, isJHP = false, isSilentExec = false) {
                    const isAirsoft = (this.faction === 'airsoft_adult');
                    if (isAirsoft) {
                        this.hp = 0;
                        sfx.playBBImpact();
                    } else {
                        this.hp -= amount;
                        if (!isSilentExec) {
                            this.alertLKP(this.x - Math.cos(hitAngle) * 140, this.y - Math.sin(hitAngle) * 140);
                        }
                    }

                    if (!isAirsoft) {
                        createBlood(this.x, this.y, hitAngle, isSilentExec ? 9 : (isJHP ? 7 : 4));
                    }

                    if (this.hp <= 0) {
                        kills++;
                        const activeF = (currentCampaign === 'mall') ? currentMallFloor : null;

                        if (!isAirsoft) {
                            decals.push(new Decal(this.x, this.y, 'blood', hitAngle, 18, activeF));
                            corpses.push(new Corpse(this.x, this.y, hitAngle, this.faction, activeF, Math2.randInt(0, 3)));
                            if (corpses.length > 140) corpses.shift();
                        } else {
                            decals.push(new Decal(this.x, this.y, 'bb_hit', hitAngle, 12, activeF));
                        }

                        if (!isSilentExec) {
                            for (let i = 0; i < enemies.length; i++) {
                                const other = enemies[i];
                                if (other === this) continue;
                                if (activeF && other.floor && other.floor !== activeF) continue;
                                if (Math2.dist(this.x, this.y, other.x, other.y) < 340) {
                                    other.onNearbyAllyKilled(this.x, this.y);
                                }
                            }
                        }

                        const dropRoll = Math.random();
                        if (currentCampaign === 'mall') {
                            if (dropRoll < 0.36) pickups.push(new Pickup(this.x, this.y, 'cash', activeF));
                            else if (dropRoll < 0.56) pickups.push(new Pickup(this.x, this.y, 'food', activeF));
                            else if (dropRoll < 0.65 && !this.isUnarmed && !this.isMeleeLooter) pickups.push(new Pickup(this.x, this.y, 'ammo', activeF));
                        } else if (!isAirsoft && dropRoll < 0.42) {
                            pickups.push(new Pickup(this.x, this.y, dropRoll < 0.22 ? 'ammo' : 'medkit', activeF));
                        }

                        const idx = enemies.indexOf(this);
                        if (idx !== -1) enemies.splice(idx, 1);
                    } else if (!isAirsoft) {
                        this.sayPainCry();
                        this.woundedSpeedFactor = Math.min(this.woundedSpeedFactor, Math2.rand(0.42, 0.56));
                        if (!this.isBoss && this.faction !== 'dog' && this.panicState !== 'fleeing') {
                            const isLooter = (this.faction === 'looter' || this.isUnarmed || this.isMeleeLooter);
                            const hpRatio = this.hp / this.maxHp;
                            const retreatChance = isJHP ? 0.96 : (isLooter ? 0.85 : (hpRatio < 0.65 ? 0.72 : 0.35));
                            if (Math.random() < retreatChance) {
                                this.panicState = 'wounded_retreat';
                                this.panicTimer = Math2.rand(8.0, 13.0);
                                this.fleeAngle = hitAngle + Math2.rand(-0.55, 0.55);
                                this.hesitationTimer = 0;
                            }
                        }
                    }
                }

                update(dt) {
                    if (this.spotterCooldown > 0) this.spotterCooldown -= dt;
                    if (this.dashCooldown > 0) this.dashCooldown -= dt;
                    if (this.dashTimer > 0) this.dashTimer -= dt;
                    if (this.barkTimer > 0) this.barkTimer -= dt;
                    this.barkCooldown -= dt;

                    // Preoccupied ambient mall activities & isiZulu barks
                    if (this.barkCooldown <= 0 && this.panicState === 'normal') {
                        this.barkCooldown = Math2.rand(4.5, 9.0);
                        if (this.faction === 'hostage_taker') {
                            this.sayZulu(ZULU_HOSTAGE_BARKS[Math2.randInt(0, ZULU_HOSTAGE_BARKS.length - 1)], 2.6);
                        } else if (this.activity === 'pry_shutter' || this.activity === 'haul_crate' || this.activity === 'rummage') {
                            if (Math.random() < 0.55) {
                                this.sayZulu(ZULU_LOOT_BARKS[Math2.randInt(0, ZULU_LOOT_BARKS.length - 1)], 2.2);
                            }
                        }
                    }

                    if (this.activity === 'pry_shutter' && this.panicState === 'normal' && Math.random() < 0.06 && particles.length < 360) {
                        particles.push(new Particle(this.x + Math.cos(this.angle) * 16, this.y + Math.sin(this.angle) * 16, Math2.rand(-70, 70), Math2.rand(-70, 70), 0.25, '#fde047', 2.5, this.floor));
                    }

                    // Strobe disorientation state
                    if (this.blindTimer > 0) {
                        this.blindTimer -= dt;
                        this.angle += Math2.rand(-4.2, 4.2) * dt;
                        const stumbleSpeed = this.speed * 0.35 * this.woundedSpeedFactor;
                        this.x += Math.cos(this.angle) * stumbleSpeed * dt;
                        this.y += Math.sin(this.angle) * stumbleSpeed * dt;
                        this.animPhase += dt * 7;

                        if (!this.isUnarmed && !this.isMeleeLooter && this.faction !== 'dog' && this.blindTimer > 0.7) {
                            this.blindPanicShotTimer += dt;
                            if (this.blindPanicShotTimer > 0.65 && Math.random() < 0.04) {
                                this.blindPanicShotTimer = 0;
                                const isAirsoft = (this.faction === 'airsoft_adult');
                                const isRifle = (this.faction === 'security' || this.faction === 'blockade_goon');
                                sfx.playGunshot(isAirsoft ? 'airsoft_aeg' : (isRifle ? 'ak47' : 'glock'), this.x, this.y);
                                const mx = this.x + Math.cos(this.angle) * 18;
                                const my = this.y + Math.sin(this.angle) * 18;
                                bullets.push(new Bullet(mx, my, this.angle + Math2.rand(-0.72, 0.72), isAirsoft ? 4400 : 14000, this.dmg, 'enemy', this, false, isAirsoft, false));
                            }
                        }

                        const res = resolveCircleWorldCollision(this.x, this.y, this.radius);
                        this.x = res.x;
                        this.y = res.y;
                        return;
                    }

                    // Wounded self-preservation retreat (slow hobble/limp)
                    if (this.panicState === 'wounded_retreat') {
                        this.panicTimer -= dt;
                        this.angle = this.fleeAngle;
                        const limpGait = 0.62 + 0.38 * Math.abs(Math.sin(this.animPhase));
                        const stumbleSpeed = this.speed * this.woundedSpeedFactor * limpGait;
                        this.x += Math.cos(this.angle) * stumbleSpeed * dt;
                        this.y += Math.sin(this.angle) * stumbleSpeed * dt;
                        this.animPhase += dt * 7.5;

                        if (Math.random() < 0.16 && decals.length < 520) {
                            decals.push(new Decal(this.x, this.y, 'blood', Math2.rand(0, Math.PI * 2), 4, this.floor));
                        }

                        const res = resolveCircleWorldCollision(this.x, this.y, this.radius);
                        this.x = res.x;
                        this.y = res.y;

                        if (this.panicTimer <= 0 || !hasLoS(this.x, this.y, player.x, player.y, this.floor)) {
                            this.panicState = 'hunkered';
                            this.panicTimer = 999;
                        }
                        return;
                    }

                    if (this.panicState === 'hunkered') {
                        if (this.canDetectPlayer() && Math2.dist(this.x, this.y, player.x, player.y) < 130) {
                            this.angle = Math2.angle(this.x, this.y, player.x, player.y);
                            this.hesitationTimer += dt;
                            if (this.hesitationTimer > 0.95 && !this.isUnarmed && !this.isMeleeLooter) {
                                const now = performance.now();
                                if (now - this.lastShot >= this.fireDelay * 1.4) {
                                    this.lastShot = now;
                                    sfx.playGunshot('glock', this.x, this.y);
                                    bullets.push(new Bullet(this.x, this.y, this.angle + Math2.rand(-0.18, 0.18), 14000, this.dmg, 'enemy', this, false, false, false));
                                }
                            }
                        }
                        return;
                    }

                    if (this.panicState === 'fleeing') {
                        this.panicTimer -= dt;
                        this.angle = this.fleeAngle;
                        const fleeSpd = this.speed * 1.15 * this.woundedSpeedFactor;
                        this.x += Math.cos(this.angle) * fleeSpd * dt;
                        this.y += Math.sin(this.angle) * fleeSpd * dt;
                        this.animPhase += dt * 15 * this.woundedSpeedFactor;
                        const res = resolveCircleWorldCollision(this.x, this.y, this.radius);
                        this.x = res.x;
                        this.y = res.y;
                        if (this.panicTimer <= 0) {
                            this.panicState = 'normal';
                        }
                        return;
                    }

                    // Unarmed looters & spotters
                    if (this.isUnarmed) {
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

                    if (this.isUnarmed && this.spotterWarnTimer > 0) {
                        this.spotterWarnTimer -= dt;
                        if (player) this.angle = Math2.angle(this.x, this.y, player.x, player.y);
                        if (this.spotterWarnTimer <= 0) {
                            sfx.playAlarmShout(this.x, this.y);
                            this.sayZulu(ZULU_ALARM_BARKS[Math2.randInt(0, ZULU_ALARM_BARKS.length - 1)], 2.6);
                            triggerLKP(player.x, player.y, 620, this.floor);
                            this.spotterCooldown = 14.0;
                            this.panicState = 'fleeing';
                            this.panicTimer = 7.0;
                            this.fleeAngle = Math2.angle(player.x, player.y, this.x, this.y);
                        }
                        return;
                    }

                    // Hostage taker countdown if alerted
                    if (this.faction === 'hostage_taker' && this.hostageTarget && !this.hostageTarget.dead && !this.hostageTarget.rescued) {
                        if (this.lkpSearchTimer > 0 || this.canDetectPlayer()) {
                            this.hostageExecuteTimer -= dt;
                            if (this.hostageExecuteTimer <= 0) {
                                this.sayZulu('NGIZOKUDUBULA!', 2.0);
                                sfx.playGunshot('glock', this.x, this.y);
                                this.hostageTarget.takeDamage(100, Math2.angle(this.x, this.y, this.hostageTarget.x, this.hostageTarget.y));
                                showBanner('HOSTAGE EXECUTED BY CAPTORS!', 2200);
                                this.hostageTarget = null;
                            }
                        }
                    }

                    // Target Acquisition (Player or Active Allies in Airsoft)
                    let target = null;
                    if (this.canDetectPlayer()) {
                        target = player;
                        this.lkpX = player.x;
                        this.lkpY = player.y;
                        this.lkpSearchTimer = 8.0;
                    } else if (this.faction === 'airsoft_adult') {
                        for (let i = 0; i < allies.length; i++) {
                            const a = allies[i];
                            if (!a.isOut && Math2.dist(this.x, this.y, a.x, a.y) < 520 && hasLoS(this.x, this.y, a.x, a.y)) {
                                target = a;
                                break;
                            }
                        }
                    }

                    if (target) {
                        const d = Math2.dist(this.x, this.y, target.x, target.y);
                        this.angle = Math2.angle(this.x, this.y, target.x, target.y);

                        const aimingAtMe = (target === player) && Math.abs(Math2.angleDiff(player.angle, Math2.angle(player.x, player.y, this.x, this.y))) < 0.28;
                        const effectiveHesitation = aimingAtMe ? this.hesitationBase * 1.35 : this.hesitationBase;
                        this.hesitationTimer += dt;

                        if (this.isMeleeLooter && d < 240 && d > 52 && this.dashCooldown <= 0 && this.woundedSpeedFactor > 0.8) {
                            this.dashTimer = 0.65;
                            this.dashCooldown = 4.5;
                            this.sayZulu('BAMBA LO!', 1.5);
                        }
                        const moveMult = (this.dashTimer > 0 ? 2.15 : 1.0) * this.woundedSpeedFactor;

                        if (d > this.attackRange * 0.85) {
                            this.x += Math.cos(this.angle) * (this.speed * moveMult) * dt;
                            this.y += Math.sin(this.angle) * (this.speed * moveMult) * dt;
                            this.animPhase += dt * 13 * moveMult;
                        } else if (this.faction !== 'dog' && !this.isMeleeLooter && d < this.attackRange * 0.45) {
                            this.x -= Math.cos(this.angle) * this.speed * 0.55 * this.woundedSpeedFactor * dt;
                            this.y -= Math.sin(this.angle) * this.speed * 0.55 * this.woundedSpeedFactor * dt;
                            this.animPhase += dt * 8 * this.woundedSpeedFactor;
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
                                    sfx.playGunshot(isAirsoft ? 'airsoft_aeg' : (isRifle ? 'ak47' : 'glock'), this.x, this.y);
                                    const mx = this.x + Math.cos(this.angle) * 18;
                                    const my = this.y + Math.sin(this.angle) * 18;
                                    const spread = isAirsoft ? 0.06 : (isRifle ? 0.07 : 0.11);
                                    const spd = isAirsoft ? 4600 : (isRifle ? 28000 : 14000);
                                    bullets.push(new Bullet(mx, my, this.angle + Math2.rand(-spread, spread), spd, this.dmg, 'enemy', this, false, isAirsoft, false));
                                }
                            }
                        }
                    } else if (this.lkpSearchTimer > 0 && this.lkpX !== null) {
                        this.hesitationTimer = Math.max(0, this.hesitationTimer - dt * 0.6);
                        this.lkpSearchTimer -= dt;
                        const dLkp = Math2.dist(this.x, this.y, this.lkpX, this.lkpY);
                        if (dLkp > 36) {
                            this.angle = Math2.angle(this.x, this.y, this.lkpX, this.lkpY);
                            const searchSpd = this.speed * 0.82 * this.woundedSpeedFactor;
                            this.x += Math.cos(this.angle) * searchSpd * dt;
                            this.y += Math.sin(this.angle) * searchSpd * dt;
                            this.animPhase += dt * 10 * this.woundedSpeedFactor;
                        } else {
                            this.angle += Math.sin(performance.now() * 0.004 + this.x) * 1.4 * dt;
                        }
                    } else {
                        this.hesitationTimer = 0;
                        if (this.activity === 'pry_shutter' || this.faction === 'hostage_taker') {
                            this.angle += Math.sin(performance.now() * 0.003 + this.y) * 0.25 * dt;
                        } else {
                            this.wanderTimer -= dt;
                            if (this.wanderTimer <= 0) {
                                this.wanderTimer = Math2.rand(2.0, 4.5);
                                this.angle += Math2.rand(-1.6, 1.6);
                            }
                            const patrolSpd = this.speed * 0.36 * this.woundedSpeedFactor;
                            this.x += Math.cos(this.angle) * patrolSpd * dt;
                            this.y += Math.sin(this.angle) * patrolSpd * dt;
                            this.animPhase += dt * 6 * this.woundedSpeedFactor;
                        }
                    }

                    const res = resolveCircleWorldCollision(this.x, this.y, this.radius);
                    this.x = res.x;
                    this.y = res.y;
                }

                draw(ctx) {
                    ctx.save();
                    ctx.translate(this.x, this.y);
                    ctx.rotate(this.angle);

                    // Keep perception in AI logic, not as visible geometry for players.
                    if (window.HERO_DEBUG_VISION === true) {
                        const cone = this.getVisionConeParams();
                        const coneGrad = ctx.createRadialGradient(0, 0, 8, 0, 0, cone.range);
                        const isAlerted = (this.lkpSearchTimer > 0 || this.hesitationTimer > 0.1);
                        coneGrad.addColorStop(0, isAlerted ? 'rgba(248, 113, 113, 0.14)' : 'rgba(250, 204, 21, 0.075)');
                        coneGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
                        ctx.fillStyle = coneGrad;
                        ctx.beginPath();
                        ctx.moveTo(0, 0);
                        ctx.arc(0, 0, cone.range, -cone.halfAngle, cone.halfAngle);
                        ctx.closePath();
                        ctx.fill();
                    }

                    if (this.faction === 'dog') {
                        ctx.fillStyle = '#78350f';
                        ctx.beginPath();
                        ctx.ellipse(0, 0, 14, 7, 0, 0, Math.PI * 2);
                        ctx.fill();
                        ctx.fillStyle = '#451a03';
                        ctx.beginPath();
                        ctx.arc(11, 0, 5.5, 0, Math.PI * 2);
                        ctx.fill();
                        ctx.restore();
                        return;
                    }

                    const thermalActive = (player && player.opticsMode === 2);

                    if (thermalActive) {
                        ctx.fillStyle = '#f8fafc';
                        ctx.shadowColor = '#ffffff';
                        ctx.shadowBlur = 12;
                    } else if (this.faction === 'airsoft_adult') {
                        ctx.fillStyle = '#3f6212';
                    } else if (this.faction === 'security') {
                        ctx.fillStyle = '#1d4ed8';
                    } else if (this.faction === 'blockade_goon') {
                        ctx.fillStyle = '#7f1d1d';
                    } else if (this.isSpotter) {
                        ctx.fillStyle = '#ca8a04';
                    } else if (this.isUnarmed) {
                        ctx.fillStyle = '#475569';
                    } else {
                        ctx.fillStyle = '#991b1b';
                    }

                    ctx.beginPath();
                    ctx.arc(0, 0, this.radius, 0, Math.PI * 2);
                    ctx.fill();
                    ctx.shadowBlur = 0;
                    ctx.lineWidth = 2;
                    ctx.strokeStyle = this.blindTimer > 0 ? '#f472b6' : (this.isBoss ? '#facc15' : '#090d16');
                    ctx.stroke();

                    if (this.activity === 'haul_crate' && this.panicState === 'normal') {
                        ctx.fillStyle = '#92400e';
                        ctx.strokeStyle = '#fbbf24';
                        ctx.lineWidth = 1;
                        ctx.fillRect(10, -9, 13, 18);
                        ctx.strokeRect(10, -9, 13, 18);
                    } else if (this.isMeleeLooter) {
                        ctx.strokeStyle = '#cbd5e1';
                        ctx.lineWidth = 3;
                        ctx.beginPath();
                        ctx.moveTo(8, 5);
                        ctx.lineTo(24, 5);
                        ctx.stroke();
                    } else if (!this.isUnarmed) {
                        ctx.fillStyle = '#111827';
                        ctx.fillRect(8, 3, (this.faction === 'security' || this.faction === 'blockade_goon' || this.faction === 'airsoft_adult') ? 21 : 13, 4);
                    }

                    ctx.fillStyle = thermalActive ? '#ffffff' : '#6b442a';
                    ctx.beginPath();
                    ctx.arc(1, 0, this.isBoss ? 9 : 6.8, 0, Math.PI * 2);
                    ctx.fill();

                    ctx.restore();

                    ctx.save();
                    ctx.font = '900 10px ui-monospace, monospace';
                    ctx.textAlign = 'center';
                    if (this.barkTimer > 0 && this.barkText) {
                        const isPain = (this.woundedSpeedFactor < 1.0 && (this.barkText.includes('AA') || this.barkText.includes('UGH') || this.barkText.includes('EISH') || this.barkText.includes('GAAH') || this.barkText.includes('GOD')));
                        ctx.fillStyle = isPain ? '#fca5a5' : '#fde047';
                        ctx.fillText(isPain ? this.barkText : `"${this.barkText}"`, this.x, this.y - 26);
                    } else if (this.blindTimer > 0) {
                        ctx.fillStyle = '#f472b6';
                        ctx.fillText('BLINDED!', this.x, this.y - 22);
                    } else if (this.panicState === 'wounded_retreat' || this.panicState === 'hunkered') {
                        ctx.fillStyle = '#fb923c';
                        ctx.fillText(this.panicState === 'hunkered' ? 'COVER' : 'LIMPING', this.x, this.y - 22);
                    } else if (this.panicState === 'fleeing') {
                        ctx.fillStyle = '#38bdf8';
                        ctx.fillText('FLEEING', this.x, this.y - 22);
                    } else if (this.hesitationTimer > 0.05 && this.hesitationTimer < this.hesitationBase) {
                        ctx.fillStyle = '#facc15';
                        ctx.fillText('?', this.x, this.y - 22);
                    }
                    ctx.restore();
                }
            }

            // ============================================================================
            // BULLETS (HIGH-VELOCITY SWEPT BALLISTICS + CROSS-NPC FRIENDLY FIRE)
            // ============================================================================
            class Bullet {
                constructor(x, y, angle, speed, damage, ownerType, ownerRef, isFlame = false, isAirsoft = false, isJHP = false) {
                    this.x = x;
                    this.y = y;
                    this.prevX = x;
                    this.prevY = y;
                    this.vx = Math.cos(angle) * speed;
                    this.vy = Math.sin(angle) * speed;
                    this.angle = angle;
                    this.damage = damage;
                    this.ownerType = ownerType;
                    this.ownerRef = ownerRef;
                    this.isFlame = isFlame;
                    this.isAirsoft = isAirsoft;
                    this.isJHP = isJHP;
                    this.life = isFlame ? Math2.rand(0.28, 0.42) : (isAirsoft ? 0.24 : 0.14);
                    this.dead = false;
                }

                update(dt) {
                    const steps = this.isFlame ? 1 : 4;
                    const subDt = dt / steps;
                    const activeF = (currentCampaign === 'mall') ? currentMallFloor : null;

                    for (let s = 0; s < steps; s++) {
                        if (this.dead) break;
                        this.prevX = this.x;
                        this.prevY = this.y;
                        this.x += this.vx * subDt;
                        this.y += this.vy * subDt;
                        this.life -= subDt;

                        if (this.isFlame) {
                            this.vx *= 0.94;
                            this.vy *= 0.94;
                        } else if (this.isAirsoft) {
                            this.vx *= 0.975;
                            this.vy *= 0.975;
                        }

                        if (this.life <= 0) {
                            this.dead = true;
                            break;
                        }

                        const wallT = raycastBuildingsT(this.prevX, this.prevY, this.x, this.y, activeF);
                        if (wallT !== null) {
                            const hitX = this.prevX + (this.x - this.prevX) * wallT;
                            const hitY = this.prevY + (this.y - this.prevY) * wallT;
                            this.x = hitX;
                            this.y = hitY;
                            this.dead = true;
                            if (!this.isFlame && !this.isAirsoft) {
                                particles.push(new Particle(hitX, hitY, Math2.rand(-90, 90), Math2.rand(-90, 90), 0.16, '#fde047', 2.5, activeF));
                            }
                            break;
                        }

                        let bestT = 2.0;
                        let hitKind = null;
                        let hitTarget = null;

                        // Check all enemies (allows cross-NPC friendly fire!)
                        for (let i = 0; i < enemies.length; i++) {
                            const e = enemies[i];
                            if (e === this.ownerRef) continue;
                            if (activeF && e.floor && e.floor !== activeF) continue;
                            const t = segmentCircleIntersectT(this.prevX, this.prevY, this.x, this.y, e.x, e.y, e.radius + (this.isFlame ? 10 : 2));
                            if (t !== null && t < bestT) {
                                bestT = t;
                                hitKind = 'enemy';
                                hitTarget = e;
                            }
                        }

                        // Check player & allies
                        if (this.ownerType !== 'player') {
                            if (player && !player.vehicle) {
                                const t = segmentCircleIntersectT(this.prevX, this.prevY, this.x, this.y, player.x, player.y, player.radius + (this.isFlame ? 8 : 1));
                                if (t !== null && t < bestT) {
                                    bestT = t;
                                    hitKind = 'player';
                                    hitTarget = player;
                                }
                            }
                            for (let i = 0; i < allies.length; i++) {
                                const a = allies[i];
                                if (a.isOut) continue;
                                const t = segmentCircleIntersectT(this.prevX, this.prevY, this.x, this.y, a.x, a.y, a.radius + 2);
                                if (t !== null && t < bestT) {
                                    bestT = t;
                                    hitKind = 'ally';
                                    hitTarget = a;
                                }
                            }
                        }

                        // Check civilians/hostages in crossfire
                        for (let i = 0; i < civilians.length; i++) {
                            const c = civilians[i];
                            if (c.dead) continue;
                            if (activeF && c.floor && c.floor !== activeF) continue;
                            const t = segmentCircleIntersectT(this.prevX, this.prevY, this.x, this.y, c.x, c.y, c.radius + 1);
                            if (t !== null && t < bestT) {
                                bestT = t;
                                hitKind = 'civilian';
                                hitTarget = c;
                            }
                        }

                        // Check vehicles
                        for (let i = 0; i < vehicles.length; i++) {
                            const v = vehicles[i];
                            if (v === player.vehicle) continue;
                            if (activeF && v.floor && v.floor !== activeF) continue;
                            const t = segmentCircleIntersectT(this.prevX, this.prevY, this.x, this.y, v.x, v.y, 26);
                            if (t !== null && t < bestT) {
                                bestT = t;
                                hitKind = 'vehicle';
                                hitTarget = v;
                            }
                        }

                        if (hitKind !== null) {
                            this.x = this.prevX + (this.x - this.prevX) * bestT;
                            this.y = this.prevY + (this.y - this.prevY) * bestT;
                            if (hitKind === 'enemy') {
                                hitTarget.takeDamage(this.damage, this.angle, this.isJHP);
                                if (!this.isFlame) this.dead = true;
                            } else if (hitKind === 'player') {
                                hitTarget.takeDamage(this.damage);
                                if (!this.isAirsoft) createBlood(hitTarget.x, hitTarget.y, this.angle, 3);
                                this.dead = true;
                            } else if (hitKind === 'ally') {
                                hitTarget.takeDamage(this.damage);
                                this.dead = true;
                            } else if (hitKind === 'civilian') {
                                hitTarget.takeDamage(this.damage, this.angle);
                                this.dead = true;
                            } else if (hitKind === 'vehicle') {
                                hitTarget.takeDamage(this.damage * 0.45);
                                this.dead = true;
                            }
                        }
                    }
                }

                draw(ctx) {
                    if (this.isFlame) {
                        const progress = 1 - Math2.clamp(this.life / 0.38, 0, 1);
                        const r = 7 + progress * 22;
                        ctx.save();
                        ctx.globalAlpha = 1 - progress * 0.85;
                        ctx.fillStyle = progress < 0.35 ? '#fef08a' : (progress < 0.7 ? '#f97316' : '#dc2626');
                        ctx.beginPath();
                        ctx.arc(this.x, this.y, r, 0, Math.PI * 2);
                        ctx.fill();
                        ctx.restore();
                        return;
                    }

                    if (this.isAirsoft) {
                        ctx.save();
                        ctx.fillStyle = '#ffffff';
                        ctx.beginPath();
                        ctx.arc(this.x, this.y, 2.5, 0, Math.PI * 2);
                        ctx.fill();
                        ctx.restore();
                        return;
                    }

                    ctx.save();
                    ctx.strokeStyle = this.ownerType === 'player' ? (this.isJHP ? '#f472b6' : '#fef08a') : '#fb7185';
                    ctx.lineWidth = this.isJHP ? 2.8 : 2.0;
                    ctx.beginPath();
                    ctx.moveTo(this.x, this.y);
                    const len = this.isJHP ? 85 : 68;
                    ctx.lineTo(this.x - Math.cos(this.angle) * len, this.y - Math.sin(this.angle) * len);
                    ctx.stroke();
                    ctx.restore();
                }
            }

            class Particle {
                constructor(x, y, vx, vy, life, color, size, floor = null, isCasing = false) {
                    this.x = x;
                    this.y = y;
                    this.vx = vx;
                    this.vy = vy;
                    this.life = life;
                    this.maxLife = life;
                    this.color = color;
                    this.size = size;
                    this.floor = floor;
                    this.isCasing = isCasing;
                    this.rot = Math2.rand(0, Math.PI * 2);
                    this.vRot = Math2.rand(-18, 18);
                }

                update(dt) {
                    this.x += this.vx * dt;
                    this.y += this.vy * dt;
                    this.vx *= 0.90;
                    this.vy *= 0.90;
                    this.rot += this.vRot * dt;
                    this.life -= dt;
                }

                draw(ctx) {
                    ctx.save();
                    ctx.globalAlpha = Math.max(0, this.life / this.maxLife);
                    if (this.isCasing) {
                        ctx.translate(this.x, this.y);
                        ctx.rotate(this.rot);
                        ctx.fillStyle = this.color;
                        ctx.fillRect(-3.5, -1.5, 7, 3);
                    } else {
                        ctx.fillStyle = this.color;
                        ctx.beginPath();
                        ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
                        ctx.fill();
                    }
                    ctx.restore();
                }
            }

            class Decal {
                constructor(x, y, type, angle, radius, floor = null) {
                    this.x = x;
                    this.y = y;
                    this.type = type;
                    this.angle = angle;
                    this.radius = radius;
                    this.floor = floor;
                }

                draw(ctx) {
                    ctx.save();
                    ctx.translate(this.x, this.y);
                    ctx.rotate(this.angle);
                    if (this.type === 'blood') {
                        ctx.fillStyle = 'rgba(136, 19, 55, 0.72)';
                        ctx.beginPath();
                        ctx.ellipse(0, 0, this.radius, this.radius * 0.65, 0, 0, Math.PI * 2);
                        ctx.fill();
                    } else if (this.type === 'bb_hit') {
                        ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
                        ctx.beginPath();
                        ctx.arc(0, 0, 3, 0, Math.PI * 2);
                        ctx.fill();
                    } else if (this.type === 'scorch') {
                        ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
                        ctx.beginPath();
                        ctx.arc(0, 0, this.radius, 0, Math.PI * 2);
                        ctx.fill();
                    }
                    ctx.restore();
                }
            }

            class Pickup {
                constructor(x, y, type, floor = null) {
                    this.x = x;
                    this.y = y;
                    this.type = type;
                    this.floor = floor;
                    this.bob = Math2.rand(0, Math.PI * 2);
                }

                update(dt) {
                    this.bob += dt * 4;
                    const activeF = (currentCampaign === 'mall') ? currentMallFloor : null;
                    if (activeF && this.floor && this.floor !== activeF) return;

                    if (Math2.dist(this.x, this.y, player.x, player.y) < player.radius + 20) {
                        sfx.playPickup();
                        if (this.type === 'cash') {
                            const amt = Math2.randInt(350, 950);
                            cashCollected += amt;
                            const cashEl = document.getElementById('cashCounter');
                            if (cashEl) {
                                cashEl.style.display = 'block';
                                cashEl.innerText = `CASH LOOTED: R${cashCollected.toLocaleString()}`;
                            }
                            showBanner(`SCAVENGED R${amt} CASH!`, 1300);
                        } else if (this.type === 'food') {
                            HeroCondition.eatAndDrink(player.condition);
                            player.stamina = Math.min(100, player.stamina + 18);
                            showBanner('FOOD & WATER — CONDITION IMPROVED (NO INSTANT HEALING)', 1700);
                        } else if (this.type === 'knife_7inch') {
                            player.hasKnife = true;
                            showBanner('EQUIPPED 7-INCH HUNTING KNIFE IN LEATHER SCABBARD! [Q / RMB / E]', 2600);
                            triggerMonologue('C', 'Seven inches of high-carbon steel in a stitched leather sheath. Strapped to my belt—quiet and final.');
                        } else if (this.type === 'ammo_jhp') {
                            player.jhpMags += 2;
                            player.spareMags += 2;
                            player.magStyles.push('pink-ext', 'pink-ext');
                            showBanner('STASH FOUND: +2 MAGS 120GR +P JHP HOLLOW POINTS! [PRESS B]', 2400);
                            triggerMonologue('C', 'Two boxes of 120-grain +P jacketed hollow points. Heavier recoil and bigger muzzle flash, but one hit stops an attacker cold.');
                        } else if (this.type === 'medkit') {
                            player.condition.fieldCare += 1;
                            showBanner('FIELD-CARE SUPPLIES +1 · USE [H] IF BLEEDING', 1650);
                        } else if (this.type === 'armor') {
                            player.maxArmor = Math.max(player.maxArmor, 75);
                            player.armor = Math.min(player.maxArmor, player.armor + 35);
                            showBanner('+35 BODY ARMOR', 1200);
                        } else if (this.type === 'ammo') {
                            player.spareMags += 1;
                            player.magStyles.push('standard');
                            showBanner('+1 SPARE MAGAZINE SCAVENGED', 1400);
                        }
                        player.updateHUD();
                        const idx = pickups.indexOf(this);
                        if (idx !== -1) pickups.splice(idx, 1);
                    }
                }

                draw(ctx) {
                    const yOff = Math.sin(this.bob) * 3;
                    ctx.save();
                    ctx.translate(this.x, this.y + yOff);

                    ctx.fillStyle = this.type === 'cash' ? 'rgba(16, 185, 129, 0.25)'
                        : (this.type === 'food' ? 'rgba(249, 115, 22, 0.25)'
                        : (this.type === 'knife_7inch' ? 'rgba(226, 232, 240, 0.28)'
                        : (this.type === 'ammo_jhp' ? 'rgba(236, 72, 153, 0.28)' : 'rgba(250, 204, 21, 0.22)')));
                    ctx.beginPath();
                    ctx.arc(0, 0, 17, 0, Math.PI * 2);
                    ctx.fill();

                    if (this.type === 'cash') {
                        ctx.fillStyle = '#10b981';
                        ctx.fillRect(-10, -6, 20, 12);
                        ctx.strokeStyle = '#ecfdf5';
                        ctx.lineWidth = 1.5;
                        ctx.strokeRect(-10, -6, 20, 12);
                    } else if (this.type === 'food') {
                        ctx.fillStyle = '#f97316';
                        ctx.beginPath();
                        ctx.arc(-3, 0, 6, 0, Math.PI * 2);
                        ctx.fill();
                        ctx.fillStyle = '#38bdf8';
                        ctx.fillRect(4, -6, 5, 12);
                    } else if (this.type === 'knife_7inch') {
                        ctx.fillStyle = '#78350f';
                        ctx.fillRect(-11, -3, 10, 6);
                        ctx.fillStyle = '#e2e8f0';
                        ctx.beginPath();
                        ctx.moveTo(-1, -3);
                        ctx.lineTo(13, 0);
                        ctx.lineTo(-1, 3);
                        ctx.closePath();
                        ctx.fill();
                    } else if (this.type === 'ammo_jhp') {
                        ctx.fillStyle = '#be185d';
                        ctx.fillRect(-10, -7, 20, 14);
                        ctx.strokeStyle = '#fbcfe8';
                        ctx.lineWidth = 1.5;
                        ctx.strokeRect(-10, -7, 20, 14);
                    } else if (this.type === 'medkit') {
                        ctx.fillStyle = '#ffffff';
                        ctx.fillRect(-9, -9, 18, 18);
                        ctx.fillStyle = '#ef4444';
                        ctx.fillRect(-2.5, -6, 5, 12);
                        ctx.fillRect(-6, -2.5, 12, 5);
                    } else if (this.type === 'armor') {
                        ctx.fillStyle = '#0284c7';
                        ctx.beginPath();
                        ctx.arc(0, 0, 10, 0, Math.PI * 2);
                        ctx.fill();
                    } else {
                        ctx.fillStyle = '#eab308';
                        ctx.fillRect(-8, -6, 16, 12);
                    }
                    ctx.restore();
                }
            }

            function createBlood(x, y, angle, count) {
                const activeF = (currentCampaign === 'mall') ? currentMallFloor : null;
                for (let i = 0; i < count; i++) {
                    const a = angle + Math2.rand(-0.7, 0.7);
                    const spd = Math2.rand(40, 160);
                    particles.push(new Particle(x, y, Math.cos(a) * spd, Math.sin(a) * spd, Math2.rand(0.25, 0.5), '#be123c', Math2.rand(2.5, 5), activeF));
                }
            }

            // ============================================================================
            // WORLD COLLISION & GENERATION
            // ============================================================================
            function resolveCircleWorldCollision(x, y, r) {
                x = Math2.clamp(x, r + 40, WORLD_SIZE - r - 40);
                y = Math2.clamp(y, r + 40, WORLD_SIZE - r - 40);
                const activeF = (currentCampaign === 'mall') ? currentMallFloor : null;

                for (let i = 0; i < buildings.length; i++) {
                    const b = buildings[i];
                    if (b.floor && activeF && b.floor !== activeF) continue;
                    const closestX = Math2.clamp(x, b.x, b.x + b.w);
                    const closestY = Math2.clamp(y, b.y, b.y + b.h);
                    const dx = x - closestX;
                    const dy = y - closestY;
                    const distSq = dx * dx + dy * dy;
                    if (distSq < r * r) {
                        const dist = Math.sqrt(distSq) || 0.001;
                        const overlap = r - dist;
                        x += (dx / dist) * overlap;
                        y += (dy / dist) * overlap;
                    }
                }
                return { x, y };
            }

            function selectCampaign(camp) {
                currentCampaign = camp;
                const map = {
                    training: 'btnCampTraining',
                    mall: 'btnCampMall',
                    cbd: 'btnCampCBD',
                    sniper: 'btnCampSniper',
                    suburbs: 'btnCampSuburbs'
                };
                Object.keys(map).forEach(k => {
                    const btn = document.getElementById(map[k]);
                    if (!btn) return;
                    if (k === camp) {
                        btn.classList.add('border-2', 'border-pink-400', 'bg-slate-800/90');
                        btn.classList.remove('border', 'border-slate-700', 'bg-slate-800/50');
                    } else {
                        btn.classList.remove('border-2', 'border-pink-400', 'bg-slate-800/90');
                        btn.classList.add('border', 'border-slate-700', 'bg-slate-800/50');
                    }
                });
            }

            function generateWorld(camp) {
                buildings = [];
                trees = [];
                roads = [];
                vehicles = [];
                enemies = [];
                allies = [];
                civilians = [];
                stairs = [];
                securityDoors = [];
                cctvTerminals = [];
                corpses = [];
                bullets = [];
                particles = [];
                decals = [];
                droppedMags = [];
                pickups = [];
                kills = 0;
                cashCollected = 0;
                elapsedTime = 0;
                cctvRevealTimer = 0;
                lastKnownPos.active = false;
                currentMallFloor = 'L1';

                const cashEl = document.getElementById('cashCounter');
                if (cashEl) {
                    cashEl.style.display = camp === 'mall' ? 'block' : 'none';
                    cashEl.innerText = 'CASH LOOTED: R0';
                }

                if (camp === 'training') {
                    // PROLOGUE: PINE RIDGE WOODLAND AIRSOFT SKIRMISH
                    player = new Player(520, 1600, {
                        weaponId: 'airsoft_pistol',
                        gender: 'young_c',
                        heroTitle: 'YOUNGER C // AIRSOFT',
                        hp: 100,
                        maxHp: 100,
                        armor: 0,
                        maxArmor: 0,
                        spareMags: 3,
                        magStyles: ['pink-ext', 'pink-ext', 'compact'],
                        currentMagStyle: 'pink-ext',
                        hasFlashlight: false,
                        flashlightOn: false,
                        hasKnife: false,
                        hasGoBag: false
                    });

                    allies.push(new Ally(470, 1520, 'YOUNGER G', 'young_g', 'lm4'));
                    allies.push(new Ally(470, 1680, 'YOUNGER BLAZE', 'young_blaze', 'smg'));

                    buildings.push({ x: 960, y: 1380, w: 32, h: 170, color: '#78350f', roofColor: '#92400e', tag: 'WOOD PALLET BUNKER' });
                    buildings.push({ x: 960, y: 1650, w: 32, h: 170, color: '#78350f', roofColor: '#92400e', tag: 'WOOD PALLET BUNKER' });
                    buildings.push({ x: 1480, y: 1240, w: 40, h: 240, color: '#57534e', roofColor: '#78716c', tag: 'SANDBAG RIDGE' });
                    buildings.push({ x: 1480, y: 1720, w: 40, h: 240, color: '#57534e', roofColor: '#78716c', tag: 'SANDBAG RIDGE' });
                    buildings.push({ x: 2040, y: 1440, w: 36, h: 320, color: '#78350f', roofColor: '#92400e', tag: 'OUTPOST BARRICADE' });
                    buildings.push({ x: 2560, y: 1460, w: 180, h: 280, color: '#365314', roofColor: '#4d7c0f', tag: 'ADULT TEAM HQ' });

                    for (let i = 0; i < 125; i++) {
                        const tx = Math2.rand(240, 2960);
                        const ty = Math2.rand(240, 2960);
                        if (Math2.dist(tx, ty, 520, 1600) > 180 && Math2.dist(tx, ty, 2650, 1600) > 220) {
                            trees.push({ x: tx, y: ty, r: Math2.rand(18, 30) });
                        }
                    }

                    const adultSpawns = [
                        [1060, 1460], [1060, 1740], [1420, 1340], [1420, 1860],
                        [1780, 1520], [1780, 1680], [2140, 1480], [2140, 1720],
                        [2440, 1480], [2440, 1720]
                    ];
                    adultSpawns.forEach(pt => enemies.push(new Enemy(pt[0], pt[1], 'airsoft_adult')));

                    mission = {
                        step: 0,
                        title: 'PINE RIDGE WOODLAND AIRSOFT',
                        desc: 'Advance through the pines with Younger G & Blaze and tag out the Adult Team HQ',
                        targetX: 2560,
                        targetY: 1600,
                        timer: 0
                    };
                    document.getElementById('radarTitle').innerText = 'WOODLAND GPS';

                    phoneCutscene.start({
                        clock: '14:15 PM',
                        opsec: 'FIELD RADIO CH-04 // SUNDAY AIRSOFT SKIRMISH',
                        contactName: 'YOUNGER G & YOUNGER BLAZE',
                        contactSub: 'JUNIOR SQUAD &bull; PINE RIDGE WOODS',
                        contactAvatar: 'suburbs',
                        messages: [
                            { side: 'incoming', sender: 'YOUNGER G', time: '14:14', text: 'Check your eye-pro, C. Those grown-up MilSim guys took the sandbag ridge and the creek footbridge.' },
                            { side: 'incoming', sender: 'YOUNGER BLAZE', time: '14:14', text: 'They think we are easy targets! Use the pine trunks for cover—if you get hit, call it fair.' },
                            { side: 'outgoing', sender: 'YOUNGER C', time: '14:15', text: 'Pink G26 is gassed up. Stick to the trees and push their HQ flag together.' }
                        ]
                    });

                } else if (camp === 'mall') {
                    // STAGE 1: THE MALL BLOCKADE (4-FLOOR SANDTON MALL: L1 -> G -> B1 -> L2)
                    player = new Player(640, 660, {
                        weaponId: 'glock26',
                        gender: 'israeli_c',
                        heroTitle: 'C // CIVILIAN FLANNEL',
                        hp: 100,
                        maxHp: 100,
                        armor: 0,
                        maxArmor: 0,
                        spareMags: 3,
                        magStyles: ['pink-ext', 'pink-ext', 'compact'],
                        currentMagStyle: 'pink-ext',
                        hasFlashlight: true,
                        flashlightOn: false,
                        hasKnife: false,
                        hasMolleVest: false,
                        hasGoBag: false
                    });

                    // Outer Mall Structural Shell (All 4 Floors)
                    buildings.push({ x: 320, y: 320, w: 2360, h: 40, color: '#0f172a', roofColor: '#1e293b' });
                    buildings.push({ x: 320, y: 2480, w: 2360, h: 40, color: '#0f172a', roofColor: '#1e293b' });
                    buildings.push({ x: 320, y: 320, w: 40, h: 2200, color: '#0f172a', roofColor: '#1e293b' });
                    buildings.push({ x: 2640, y: 320, w: 40, h: 2200, color: '#0f172a', roofColor: '#1e293b' });

                    // --- LEVEL 1 (L1): GOLDEN DRAGON & SHUTTERED BOUTIQUES ---
                    buildings.push({ x: 480, y: 480, w: 460, h: 30, floor: 'L1', color: '#450a0a', roofColor: '#7f1d1d', tag: 'GOLDEN DRAGON' });
                    buildings.push({ x: 480, y: 480, w: 30, h: 360, floor: 'L1', color: '#450a0a', roofColor: '#7f1d1d' });
                    buildings.push({ x: 480, y: 840, w: 310, h: 30, floor: 'L1', color: '#450a0a', roofColor: '#7f1d1d' });
                    buildings.push({ x: 1120, y: 480, w: 480, h: 300, floor: 'L1', color: '#1e293b', roofColor: '#334155', tag: 'SHUTTERED ELECTRONICS' });
                    buildings.push({ x: 1780, y: 480, w: 540, h: 300, floor: 'L1', color: '#1e293b', roofColor: '#334155', tag: 'DESIGNER FASHION' });
                    buildings.push({ x: 520, y: 1140, w: 460, h: 340, floor: 'L1', color: '#1e293b', roofColor: '#334155', tag: 'JEWELRY ARCADE' });
                    buildings.push({ x: 1180, y: 1140, w: 440, h: 340, floor: 'L1', color: '#0f172a', roofColor: '#1e293b', tag: 'ATRIUM VOID' });
                    buildings.push({ x: 1800, y: 1140, w: 520, h: 340, floor: 'L1', color: '#1e293b', roofColor: '#334155', tag: 'BOOKSTORE' });

                    stairs.push(new StairNode(1400, 1660, 'L1', 'G', 1400, 1660, 'CENTRAL ESCALATOR -> [G]'));
                    stairs.push(new StairNode(2460, 520, 'L1', 'L2', 2460, 520, 'NORTH STAIRS -> [L2]'));

                    civilians.push(new Civilian(560, 570, 'MR. CHEN [E]', 'L1', false));
                    civilians.push(new Civilian(550, 720, 'SHOP ASSISTANT', 'L1', false));

                    // --- GROUND FLOOR (G): SAFARI OUTDOOR, SUPERMARKET, HOSTAGES & SECURITY COMPLEX ---
                    buildings.push({ x: 500, y: 500, w: 520, h: 320, floor: 'G', color: '#14532d', roofColor: '#166534', tag: 'SAFARI OUTDOOR & BUTCHERY' });
                    buildings.push({ x: 1820, y: 500, w: 520, h: 320, floor: 'G', color: '#1e293b', roofColor: '#334155', tag: 'SANDTON HYPERMARKET' });
                    buildings.push({ x: 1180, y: 1140, w: 440, h: 340, floor: 'G', color: '#1e293b', roofColor: '#334155', tag: 'FOUNTAIN PLAZA' });

                    // Walkable Ground-Floor Security Complex with Ingress Corridor & Breachable Steel Door
                    buildings.push({ x: 480, y: 1120, w: 500, h: 28, floor: 'G', color: '#1e3a8a', roofColor: '#1d4ed8', tag: 'SECURITY CONTROL COMPLEX' });
                    buildings.push({ x: 480, y: 1120, w: 28, h: 420, floor: 'G', color: '#1e3a8a', roofColor: '#1d4ed8' });
                    buildings.push({ x: 480, y: 1512, w: 500, h: 28, floor: 'G', color: '#1e3a8a', roofColor: '#1d4ed8' });
                    buildings.push({ x: 952, y: 1120, w: 28, h: 170, floor: 'G', color: '#1e3a8a', roofColor: '#1d4ed8' });
                    buildings.push({ x: 952, y: 1370, w: 28, h: 170, floor: 'G', color: '#1e3a8a', roofColor: '#1d4ed8' });
                    securityDoors.push(new SecurityDoor(966, 1330, 24, 80, 'G'));
                    cctvTerminals.push(new CCTVTerminal(580, 1240, 'G'));

                    stairs.push(new StairNode(1400, 1660, 'G', 'L1', 1400, 1660, 'COLLAPSED SHUTTER [BLOCKED]', true));
                    stairs.push(new StairNode(1400, 2260, 'G', 'B1', 1400, 2260, 'SOUTH STAIRS -> [B1 PARKADE]'));
                    stairs.push(new StairNode(2460, 520, 'G', 'L1', 2460, 520, 'NORTH SERVICE STAIRS -> [L1]'));

                    // Hostage situation inside Ground Hypermarket
                    const gHostage1 = new Civilian(1940, 880, 'CASHIER HOSTAGE', 'G', true);
                    const gHostage2 = new Civilian(2010, 895, 'MANAGER HOSTAGE', 'G', true);
                    civilians.push(gHostage1, gHostage2);
                    const cap1 = new Enemy(1910, 930, 'hostage_taker', false, 'G');
                    cap1.hostageTarget = gHostage1;
                    const cap2 = new Enemy(2040, 935, 'hostage_taker', false, 'G');
                    cap2.hostageTarget = gHostage2;
                    enemies.push(cap1, cap2);

                    pickups.push(new Pickup(760, 865, 'knife_7inch', 'G'));
                    pickups.push(new Pickup(620, 1380, 'ammo_jhp', 'G'));
                    pickups.push(new Pickup(680, 1430, 'cash', 'G'));

                    // --- B1 UNDERGROUND PARKADE: CONCRETE PILLARS & STAGED HATCHBACK ---
                    const pillars = [
                        [760, 760], [1180, 760], [1600, 760], [2020, 760],
                        [760, 1240], [1180, 1240], [1600, 1240], [2020, 1240],
                        [760, 1720], [1180, 1720], [1600, 1720], [2020, 1720]
                    ];
                    pillars.forEach(p => buildings.push({ x: p[0], y: p[1], w: 68, h: 68, floor: 'B1', color: '#1e293b', roofColor: '#334155' }));

                    const cHatchback = new Vehicle(940, 1020, 0, 'hatchback', 'B1');
                    cHatchback.isCGoBagCar = true;
                    vehicles.push(cHatchback);
                    vehicles.push(new Vehicle(1820, 980, Math.PI, 'taxi', 'B1'));

                    stairs.push(new StairNode(1400, 2260, 'B1', 'G', 1400, 2260, 'SOUTH STAIRS -> [GROUND G]'));

                    // --- LEVEL 2 (L2): SKYBRIDGE & OUTER TAXI RANK BLOCKADE ---
                    buildings.push({ x: 520, y: 520, w: 620, h: 340, floor: 'L2', color: '#1e293b', roofColor: '#334155', tag: 'FOOD COURT PAVILION' });
                    buildings.push({ x: 1620, y: 520, w: 620, h: 340, floor: 'L2', color: '#1e293b', roofColor: '#334155', tag: 'CINEMA COMPLEX' });
                    buildings.push({ x: 520, y: 1180, w: 620, h: 360, floor: 'L2', color: '#1e293b', roofColor: '#334155', tag: 'SKYBRIDGE ATRIUM' });
                    buildings.push({ x: 1620, y: 1180, w: 620, h: 360, floor: 'L2', color: '#1e293b', roofColor: '#334155', tag: 'ROOFTOP TERRACE' });
                    stairs.push(new StairNode(2460, 520, 'L2', 'L1', 2460, 520, 'NORTH STAIRS -> [L1]'));

                    const taxi1 = new Vehicle(1380, 2320, 0, 'taxi', 'L2');
                    const taxi2 = new Vehicle(1520, 2320, 0, 'taxi', 'L2');
                    const taxi3 = new Vehicle(1240, 2320, 0, 'taxi', 'L2');
                    vehicles.push(taxi1, taxi2, taxi3);

                    // Populate active mall looters across all 4 floors
                    const mallLooterSpawns = [
                        // L1
                        [1020, 620, 'looter_unarmed', 'pry_shutter', 'L1'],
                        [1060, 680, 'melee_looter', 'pry_shutter', 'L1'],
                        [1680, 640, 'looter_unarmed', 'haul_crate', 'L1'],
                        [1730, 710, 'looter', 'rummage', 'L1'],
                        [1080, 1280, 'looter_unarmed', 'haul_crate', 'L1'],
                        [1720, 1320, 'melee_looter', 'rummage', 'L1'],
                        [1380, 1520, 'looter', 'rummage', 'L1'],
                        // Ground (G)
                        [1120, 640, 'looter_unarmed', 'pry_shutter', 'G'],
                        [1160, 710, 'melee_looter', 'rummage', 'G'],
                        [1660, 660, 'looter_unarmed', 'haul_crate', 'G'],
                        [1710, 740, 'looter', 'rummage', 'G'],
                        [1090, 1340, 'melee_looter', 'pry_shutter', 'G'],
                        [1720, 1380, 'looter_unarmed', 'haul_crate', 'G'],
                        [1420, 1980, 'looter', 'rummage', 'G'],
                        [2360, 660, 'melee_looter', 'rummage', 'G'],
                        // B1 Underground Parkade
                        [1080, 960, 'melee_looter', 'rummage', 'B1'],
                        [1150, 1120, 'looter', 'rummage', 'B1'],
                        [1520, 1080, 'looter_unarmed', 'haul_crate', 'B1'],
                        [1640, 1420, 'looter', 'rummage', 'B1'],
                        [980, 1560, 'melee_looter', 'rummage', 'B1'],
                        // L2 Skybridge & Outer Taxi Blockade
                        [2240, 720, 'looter', 'rummage', 'L2'],
                        [1920, 1020, 'melee_looter', 'haul_crate', 'L2'],
                        [1380, 1840, 'blockade_goon', null, 'L2'],
                        [1460, 1960, 'blockade_goon', null, 'L2'],
                        [1290, 2120, 'blockade_goon', null, 'L2'],
                        [1510, 2140, 'blockade_goon', null, 'L2']
                    ];
                    mallLooterSpawns.forEach(s => {
                        enemies.push(new Enemy(s[0], s[1], s[2], false, s[4], s[3]));
                    });
                    enemies.push(new Enemy(1400, 2240, 'blockade_goon', true, 'L2'));

                    const mallLoot = [
                        [820, 620, 'food', 'L1'], [1660, 820, 'cash', 'L1'], [2180, 960, 'cash', 'L1'],
                        [620, 960, 'food', 'L1'], [1680, 1480, 'cash', 'L1'],
                        [840, 860, 'food', 'G'], [1760, 860, 'cash', 'G'], [1560, 1780, 'cash', 'G'],
                        [2280, 980, 'food', 'G'], [1240, 2160, 'cash', 'G'],
                        [860, 1380, 'cash', 'B1'], [1480, 880, 'food', 'B1'], [1940, 1560, 'ammo', 'B1'],
                        [1380, 980, 'cash', 'L2'], [1520, 1680, 'food', 'L2']
                    ];
                    mallLoot.forEach(l => pickups.push(new Pickup(l[0], l[1], l[2], l[3])));

                    mission = {
                        step: 0,
                        title: 'THE MALL BLOCKADE // 07:00 AM',
                        desc: 'Speak to Mr. Chen [E] or take Central Escalator down to Ground [G] & B1 Parkade',
                        targetX: 1400,
                        targetY: 1660,
                        targetFloor: 'L1',
                        timer: 0
                    };
                    document.getElementById('radarTitle').innerText = 'MALL FLOOR RADAR';

                    phoneCutscene.start({
                        clock: '07:01 AM',
                        opsec: 'OPSEC WARNING: CELL NETWORK MONITORED // NO DMR RADIOS STAGED',
                        contactName: 'DAVID // EXFIL OPS',
                        contactSub: 'BURNER SMS &bull; SANDTON SECTOR',
                        contactAvatar: 'sniper',
                        messages: [
                            { side: 'incoming', sender: 'DAVID', time: '06:58', text: 'C, grid substations tripped across Sandton at 05:10. Looters breached the perimeter shutters faster than anyone predicted.' },
                            { side: 'outgoing', sender: 'C', time: '07:00', text: 'I am inside Golden Dragon on Level 1 with Mr. Chen. Only have my concealed pink G26 and three mags on my belt—my MOLLE vest and thermal pack are in my car boot on B1.' },
                            { side: 'incoming', sender: 'DAVID', time: '07:01', text: 'Keep text short—cell towers are being scraped. Get down to B1 for your go-bag, then extract via the L2 Skybridge taxi rank. Watch for AK crews outside.' }
                        ],
                        onComplete: () => {
                            triggerMonologue('C', 'Lights are dead. Keep the weapon light off unless I need to clear a corner—and stay quiet.');
                        }
                    });

                } else if (camp === 'cbd') {
                    player = new Player(480, 1600, {
                        weaponId: 'flamethrower',
                        gender: 'female',
                        heroTitle: 'BLAZE',
                        hp: 100,
                        maxHp: 100,
                        armor: 45,
                        maxArmor: 100,
                        spareMags: 3,
                        hasKnife: true,
                        hasGoBag: false
                    });

                    roads.push({ x: 0, y: 1480, w: WORLD_SIZE, h: 240, dir: 'h' });
                    roads.push({ x: 1480, y: 0, w: 240, h: WORLD_SIZE, dir: 'v' });

                    const blocks = [
                        { x: 420, y: 620, w: 920, h: 720, tag: 'CARLTON TOWER' },
                        { x: 1860, y: 620, w: 920, h: 720, tag: 'STANDARD BANK' },
                        { x: 420, y: 1860, w: 920, h: 720, tag: 'GANDHI SQUARE' },
                        { x: 1860, y: 1860, w: 920, h: 720, tag: 'BREE TAXI RANK' }
                    ];
                    blocks.forEach(b => buildings.push({ x: b.x, y: b.y, w: b.w, h: b.h, color: '#1e293b', roofColor: '#334155', tag: b.tag }));

                    vehicles.push(new Vehicle(760, 1550, 0, 'taxi'));
                    vehicles.push(new Vehicle(1380, 1540, Math.PI / 2, 'taxi'));
                    vehicles.push(new Vehicle(2180, 1620, Math.PI, 'police'));

                    for (let i = 0; i < 16; i++) {
                        enemies.push(new Enemy(Math2.rand(900, 2750), 1600 + Math2.rand(-90, 90), i % 3 === 0 ? 'blockade_goon' : 'looter'));
                    }
                    enemies.push(new Enemy(2780, 1600, 'blockade_goon', true));

                    mission = {
                        step: 0,
                        title: 'JOBURG CBD CORRIDOR',
                        desc: 'Torch the Syndicate barricade on Commissioner Street and clear the taxi rank',
                        targetX: 2780,
                        targetY: 1600,
                        timer: 0
                    };
                    document.getElementById('radarTitle').innerText = 'CBD SECTOR GPS';

                } else if (camp === 'sniper') {
                    player = new Player(440, 1600, {
                        weaponId: 'ruger',
                        gender: 'sniper',
                        heroTitle: 'THE UNCLE',
                        hp: 100,
                        maxHp: 100,
                        armor: 40,
                        maxArmor: 100,
                        spareMags: 4,
                        hasKnife: true,
                        hasGoBag: false
                    });

                    const trainCars = [
                        { x: 760, y: 1120, w: 340, h: 70, tag: 'TRANSNET FREIGHT' },
                        { x: 1240, y: 1120, w: 380, h: 70, tag: 'CONTAINER 44B' },
                        { x: 1780, y: 1120, w: 360, h: 70, tag: 'COAL HOPPER' },
                        { x: 920, y: 2020, w: 420, h: 70, tag: 'FLATBED CAR' },
                        { x: 1580, y: 2020, w: 420, h: 70, tag: 'STEEL COIL CAR' }
                    ];
                    trainCars.forEach(c => buildings.push({ x: c.x, y: c.y, w: c.w, h: c.h, color: '#451a03', roofColor: '#78350f', tag: c.tag }));

                    for (let i = 0; i < 14; i++) {
                        enemies.push(new Enemy(Math2.rand(1050, 2750), Math2.rand(1240, 1940), 'blockade_goon'));
                    }
                    enemies.push(new Enemy(2720, 1580, 'blockade_goon', true));

                    mission = {
                        step: 0,
                        title: 'RAIL YARD OVERWATCH',
                        desc: 'Eliminate the Syndicate Arms Broker at the east rail switching yard',
                        targetX: 2720,
                        targetY: 1580,
                        timer: 0
                    };
                    document.getElementById('radarTitle').innerText = 'RAIL YARD SCOPE';

                } else {
                    player = new Player(520, 1600, {
                        weaponId: 'lm4',
                        gender: 'male',
                        heroTitle: 'OPERATIVE G',
                        hp: 100,
                        maxHp: 100,
                        armor: 60,
                        maxArmor: 100,
                        spareMags: 4,
                        hasKnife: true,
                        hasGoBag: false
                    });

                    roads.push({ x: 0, y: 1520, w: WORLD_SIZE, h: 160, dir: 'h' });
                    roads.push({ x: 1520, y: 0, w: 160, h: WORLD_SIZE, dir: 'v' });

                    const houses = [
                        { x: 520, y: 820, w: 380, h: 280, tag: 'G COMPOUND' },
                        { x: 1020, y: 820, w: 360, h: 280, tag: 'RESIDENCE 14' },
                        { x: 1840, y: 820, w: 420, h: 280, tag: 'CLINIC' },
                        { x: 520, y: 1940, w: 400, h: 300, tag: 'CORNER CAFE' },
                        { x: 1920, y: 1940, w: 540, h: 360, tag: 'SUBSTATION #4' }
                    ];
                    houses.forEach(h => buildings.push({ x: h.x, y: h.y, w: h.w, h: h.h, color: '#334155', roofColor: '#475569', tag: h.tag }));

                    for (let i = 0; i < 15; i++) {
                        enemies.push(new Enemy(Math2.rand(1100, 2650), Math2.rand(950, 2350), i % 4 === 0 ? 'dog' : 'looter'));
                    }
                    enemies.push(new Enemy(2190, 2120, 'blockade_goon', true));

                    mission = {
                        step: 0,
                        title: 'THE SUBURBS // SUBSTATION #4',
                        desc: 'Clear hostiles from Substation #4 and restore the local grid',
                        targetX: 2190,
                        targetY: 2120,
                        timer: 0
                    };
                    document.getElementById('radarTitle').innerText = 'SUBURB RADAR';
                }

                updatePortraitSVG(player.gender);
                player.updateHUD();
                document.getElementById('missionHeader').innerText = mission.title;
                document.getElementById('missionText').innerText = mission.desc;
            }

            // ============================================================================
            // MISSION DIRECTOR & FLOOR / INTERACTION HANDLING
            // ============================================================================
            function updateMissionDirector(dt) {
                if (!player) return;

                if (cctvRevealTimer > 0) {
                    cctvRevealTimer = Math.max(0, cctvRevealTimer - dt);
                }

                if (lastKnownPos.active) {
                    lastKnownPos.timer -= dt;
                    if (lastKnownPos.timer <= 0) lastKnownPos.active = false;
                }

                // Update contextual [E] prompt
                const promptEl = document.getElementById('interactPrompt');
                let promptText = '';

                if (currentCampaign === 'mall') {
                    for (let i = 0; i < stairs.length; i++) {
                        const s = stairs[i];
                        if (s.fromFloor === currentMallFloor && Math2.dist(player.x, player.y, s.x, s.y) < 58) {
                            promptText = s.blocked ? 'SHUTTER COLLAPSED — USE NORTH SERVICE STAIRS' : `[E] ${s.label}`;
                            break;
                        }
                    }
                    if (!promptText) {
                        for (let i = 0; i < securityDoors.length; i++) {
                            const sd = securityDoors[i];
                            if (!sd.open && sd.floor === currentMallFloor && Math2.dist(player.x, player.y, sd.x, sd.y) < 62) {
                                promptText = player.hasKnife ? '[E] PRY OPEN BARRED SECURITY DOOR' : 'BARRED STEEL DOOR (NEED BLADE / PRY TOOL)';
                                break;
                            }
                        }
                    }
                    if (!promptText) {
                        for (let i = 0; i < cctvTerminals.length; i++) {
                            const ct = cctvTerminals[i];
                            if (ct.floor === currentMallFloor && Math2.dist(player.x, player.y, ct.x, ct.y) < 52) {
                                promptText = '[E] ACCESS MALL CCTV MATRIX';
                                break;
                            }
                        }
                    }
                    if (!promptText) {
                        for (let i = 0; i < civilians.length; i++) {
                            const c = civilians[i];
                            if (!c.dead && c.floor === currentMallFloor && Math2.dist(player.x, player.y, c.x, c.y) < 54) {
                                promptText = c.isHostage ? '[E] UNTIE & RESCUE HOSTAGE' : `[E] SPEAK TO ${c.label.replace(' [E]', '')}`;
                                break;
                            }
                        }
                    }
                    if (!promptText && currentMallFloor === 'B1' && !player.hasGoBag) {
                        for (let i = 0; i < vehicles.length; i++) {
                            const v = vehicles[i];
                            if (v.isCGoBagCar && v.floor === 'B1' && Math2.dist(player.x, player.y, v.x, v.y) < 76) {
                                promptText = '[E] OPEN CAR BOOT & EQUIP GO-BAG + MOLLE VEST';
                                break;
                            }
                        }
                    }
                    if (!promptText && currentMallFloor === 'L2') {
                        for (let i = 0; i < vehicles.length; i++) {
                            const v = vehicles[i];
                            if (v.type === 'taxi' && v.floor === 'L2' && Math2.dist(player.x, player.y, v.x, v.y) < 78) {
                                promptText = '[E] BOARD EXFIL TAXI';
                                break;
                            }
                        }
                    }
                }

                if (!promptText && player.hasKnife) {
                    const activeF = (currentCampaign === 'mall') ? currentMallFloor : null;
                    for (let i = 0; i < enemies.length; i++) {
                        const e = enemies[i];
                        if (activeF && e.floor && e.floor !== activeF) continue;
                        if (e.faction !== 'airsoft_adult' && Math2.dist(player.x, player.y, e.x, e.y) <= 54 && e.isExecutionVulnerable(player)) {
                            promptText = '[E] SILENT 7-INCH BLADE EXECUTION';
                            break;
                        }
                    }
                }

                if (promptText) {
                    promptEl.innerText = promptText;
                    promptEl.classList.remove('hidden');
                } else {
                    promptEl.classList.add('hidden');
                }

                // Campaign-specific mission objectives
                if (currentCampaign === 'training') {
                    const remaining = enemies.length;
                    document.getElementById('enemyCounter').innerText = `ADULT TEAM: ${remaining}`;
                    if (remaining === 0 || Math2.dist(player.x, player.y, 2650, 1600) < 120) {
                        triggerEndGame(true);
                    }
                } else if (currentCampaign === 'mall') {
                    const floorHostiles = enemies.filter(e => e.floor === currentMallFloor && !e.isUnarmed).length;
                    document.getElementById('enemyCounter').innerText = `${currentMallFloor} THREATS: ${floorHostiles}`;

                    if (mission.step === 0 && currentMallFloor === 'G') {
                        mission.step = 1;
                        mission.title = 'GROUND FLOOR [G] // SAFARI & B1 ACCESS';
                        mission.desc = 'Grab the 7-inch blade in Safari Outdoor, check Security, then take South Stairs to B1';
                        mission.targetX = 1400;
                        mission.targetY = 2260;
                        mission.targetFloor = 'G';
                        document.getElementById('missionHeader').innerText = mission.title;
                        document.getElementById('missionText').innerText = mission.desc;
                    } else if (mission.step === 1 && currentMallFloor === 'B1') {
                        mission.step = 2;
                        mission.title = 'B1 PARKADE // RECOVER GO-BAG';
                        mission.desc = 'Open your parked hatchback boot [E] to equip your MOLLE plate carrier & thermal optics';
                        mission.targetX = 940;
                        mission.targetY = 1020;
                        mission.targetFloor = 'B1';
                        document.getElementById('missionHeader').innerText = mission.title;
                        document.getElementById('missionText').innerText = mission.desc;
                    } else if (mission.step === 2 && player.hasGoBag) {
                        mission.step = 3;
                        mission.title = 'ASCEND VIA NORTH SERVICE STAIRS';
                        mission.desc = 'Central escalator is blocked on [G] — flank via North Service Stairs to L1 & L2 Skybridge';
                        mission.targetX = 1400;
                        mission.targetY = 2260;
                        mission.targetFloor = 'B1';
                        document.getElementById('missionHeader').innerText = mission.title;
                        document.getElementById('missionText').innerText = mission.desc;
                    } else if (mission.step === 3 && currentMallFloor === 'L2') {
                        mission.step = 4;
                        mission.title = 'L2 SKYBRIDGE // TAXI RANK BLOCKADE';
                        mission.desc = 'Eliminate the AK-47 blockade crew and board an idling taxi [E]';
                        mission.targetX = 1380;
                        mission.targetY = 2320;
                        mission.targetFloor = 'L2';
                        document.getElementById('missionHeader').innerText = mission.title;
                        document.getElementById('missionText').innerText = mission.desc;
                    }
                } else {
                    const remaining = enemies.length;
                    document.getElementById('enemyCounter').innerText = `HOSTILES: ${remaining}`;
                    if (remaining === 0) {
                        triggerEndGame(true);
                    }
                }
            }

            function handleInteract() {
                if (!player || gameState !== 'playing' || phoneCutscene.active) return;

                if (currentCampaign === 'mall') {
                    // 1. Stairwells
                    for (let i = 0; i < stairs.length; i++) {
                        const s = stairs[i];
                        if (s.fromFloor === currentMallFloor && Math2.dist(player.x, player.y, s.x, s.y) < 58) {
                            if (s.blocked) {
                                sfx.playClick();
                                triggerMonologue('C', 'Heavy steel shutter crashed down across the central escalator. Need to flank around to the North Service Stairs.');
                                return;
                            }
                            currentMallFloor = s.toFloor;
                            player.x = s.destX;
                            player.y = s.destY;
                            sfx.playStairs();
                            player.updateHUD();
                            showBanner(`MOVED TO FLOOR: ${currentMallFloor}`, 1300);
                            return;
                        }
                    }

                    // 2. Barred Security Door
                    for (let i = 0; i < securityDoors.length; i++) {
                        const sd = securityDoors[i];
                        if (!sd.open && sd.floor === currentMallFloor && Math2.dist(player.x, player.y, sd.x, sd.y) < 62) {
                            if (player.hasKnife) {
                                sd.breach();
                            } else {
                                sfx.playClick();
                                triggerMonologue('C', 'Steel security door is barred from the inside. Need a heavy blade or crowbar from Safari Outdoor to pry the latch.');
                            }
                            return;
                        }
                    }

                    // 3. CCTV Monitor Console
                    for (let i = 0; i < cctvTerminals.length; i++) {
                        const ct = cctvTerminals[i];
                        if (ct.floor === currentMallFloor && Math2.dist(player.x, player.y, ct.x, ct.y) < 52) {
                            ct.activate();
                            return;
                        }
                    }

                    // 4. Civilians / Shopkeepers / Hostages
                    for (let i = 0; i < civilians.length; i++) {
                        const c = civilians[i];
                        if (!c.dead && c.floor === currentMallFloor && Math2.dist(player.x, player.y, c.x, c.y) < 54) {
                            c.interact();
                            return;
                        }
                    }

                    // 5. C's Hatchback Go-Bag in B1
                    if (currentMallFloor === 'B1' && !player.hasGoBag) {
                        for (let i = 0; i < vehicles.length; i++) {
                            const v = vehicles[i];
                            if (v.isCGoBagCar && v.floor === 'B1' && Math2.dist(player.x, player.y, v.x, v.y) < 76) {
                                player.hasGoBag = true;
                                player.hasMolleVest = true;
                                player.maxArmor = 65;
                                player.armor = 55;
                                player.spareMags += 2;
                                player.magStyles.push('pink-ext', 'standard');
                                player.heroTitle = 'C // MOLLE KIT';
                                sfx.playPickup();
                                updatePortraitSVG(player.gender);
                                player.updateHUD();
                                showBanner('GO-BAG RECOVERED: MOLLE VEST (+55 ARMOR) & THERMAL OPTICS [V] ONLINE!', 2800);
                                triggerMonologue('C', 'Plate carrier strapped, spare mags seated, and the thermal monocular is powered up on the 10,000 mAh bank. Time to ascend.');
                                return;
                            }
                        }
                    }

                    // 6. Exfil Taxi on L2
                    if (currentMallFloor === 'L2') {
                        for (let i = 0; i < vehicles.length; i++) {
                            const v = vehicles[i];
                            if (v.type === 'taxi' && v.floor === 'L2' && Math2.dist(player.x, player.y, v.x, v.y) < 78) {
                                const goonsLeft = enemies.filter(e => e.floor === 'L2' && e.faction === 'blockade_goon').length;
                                if (goonsLeft > 0) {
                                    showBanner(`CLEAR ${goonsLeft} AK-47 BLOCKADE GOONS BEFORE BOARDING TAXI!`, 1800);
                                    return;
                                }
                                sfx.playHorn();
                                triggerEndGame(true);
                                return;
                            }
                        }
                    }
                }

                // 7. Silent 7-inch Blade Execution
                player.meleeOrExecute();
            }

            // ============================================================================
            // RENDERING ENGINE (PRE-CACHED TILES, LIGHTING, NVG/THERMAL & MINIMAP)
            // ============================================================================
            function renderWorld() {
                ctx.save();
                const shakeX = camera.shake > 0 ? Math2.rand(-camera.shake, camera.shake) : 0;
                const shakeY = camera.shake > 0 ? Math2.rand(-camera.shake, camera.shake) : 0;
                camera.shake = Math.max(0, camera.shake - 0.8);

                const camX = player.x - width / 2 + shakeX;
                const camY = player.y - height / 2 + shakeY;
                camera.x = camX;
                camera.y = camY;

                ctx.translate(-camX, -camY);

                // Floor Texture
                if (currentCampaign === 'mall') {
                    ctx.fillStyle = currentMallFloor === 'B1'
                        ? (SpriteAtlas.patterns.parkadeAsphalt || '#090d14')
                        : (SpriteAtlas.patterns.mallTile || '#0c1220');
                } else if (currentCampaign === 'training') {
                    ctx.fillStyle = SpriteAtlas.patterns.woodlandGrass || '#193118';
                } else {
                    ctx.fillStyle = SpriteAtlas.patterns.urbanAsphalt || '#181e28';
                }
                // Canvas clips offscreen pixels anyway; bounding the fill also avoids
                // processing the invisible portion of the 3,200-unit world.
                const bgLeft = Math.max(0, camX);
                const bgTop = Math.max(0, camY);
                const bgRight = Math.min(WORLD_SIZE, camX + width);
                const bgBottom = Math.min(WORLD_SIZE, camY + height);
                if (bgRight > bgLeft && bgBottom > bgTop) {
                    ctx.fillRect(bgLeft, bgTop, bgRight - bgLeft, bgBottom - bgTop);
                }

                // Roads (CBD & Suburbs)
                for (let i = 0; i < roads.length; i++) {
                    const r = roads[i];
                    if (r.x + r.w < camX || r.x > camX + width || r.y + r.h < camY || r.y > camY + height) continue;
                    ctx.fillStyle = '#0f172a';
                    ctx.fillRect(r.x, r.y, r.w, r.h);
                }

                // Decals
                const activeF = (currentCampaign === 'mall') ? currentMallFloor : null;
                for (let i = 0; i < decals.length; i++) {
                    const d = decals[i];
                    if (activeF && d.floor && d.floor !== activeF) continue;
                    d.draw(ctx);
                }

                // Persistent Multi-Pose Corpses
                const thermalActive = (player && player.opticsMode === 2);
                for (let i = 0; i < corpses.length; i++) {
                    const cp = corpses[i];
                    if (activeF && cp.floor && cp.floor !== activeF) continue;
                    cp.draw(ctx, thermalActive);
                }

                // Dropped Magazines
                for (let i = 0; i < droppedMags.length; i++) {
                    const dm = droppedMags[i];
                    if (activeF && dm.floor && dm.floor !== activeF) continue;
                    dm.draw(ctx);
                }

                // Last Known Position (LKP) Ring
                if (lastKnownPos.active && (!activeF || lastKnownPos.floor === activeF)) {
                    ctx.save();
                    ctx.strokeStyle = 'rgba(248, 113, 113, 0.42)';
                    ctx.lineWidth = 2;
                    ctx.setLineDash([6, 6]);
                    ctx.beginPath();
                    ctx.arc(lastKnownPos.x, lastKnownPos.y, 28, 0, Math.PI * 2);
                    ctx.stroke();
                    ctx.font = '800 9px ui-monospace, monospace';
                    ctx.fillStyle = 'rgba(248, 113, 113, 0.7)';
                    ctx.textAlign = 'center';
                    ctx.fillText('LKP', lastKnownPos.x, lastKnownPos.y - 34);
                    ctx.restore();
                }

                // Stairs & CCTV Terminals
                if (currentCampaign === 'mall') {
                    for (let i = 0; i < stairs.length; i++) {
                        if (stairs[i].fromFloor === currentMallFloor) stairs[i].draw(ctx);
                    }
                    for (let i = 0; i < cctvTerminals.length; i++) {
                        if (cctvTerminals[i].floor === currentMallFloor) cctvTerminals[i].draw(ctx);
                    }
                    for (let i = 0; i < securityDoors.length; i++) {
                        if (securityDoors[i].floor === currentMallFloor) securityDoors[i].draw(ctx);
                    }
                }

                // Pickups
                for (let i = 0; i < pickups.length; i++) {
                    const p = pickups[i];
                    if (activeF && p.floor && p.floor !== activeF) continue;
                    p.draw(ctx);
                }

                // Civilians & Hostages
                for (let i = 0; i < civilians.length; i++) {
                    const c = civilians[i];
                    if (activeF && c.floor && c.floor !== activeF) continue;
                    c.draw(ctx);
                }

                // Vehicles
                for (let i = 0; i < vehicles.length; i++) {
                    const v = vehicles[i];
                    if (activeF && v.floor && v.floor !== activeF) continue;
                    v.draw(ctx);
                }

                // Allies
                for (let i = 0; i < allies.length; i++) {
                    allies[i].draw(ctx);
                }

                // Enemies
                for (let i = 0; i < enemies.length; i++) {
                    const e = enemies[i];
                    if (activeF && e.floor && e.floor !== activeF) continue;
                    e.draw(ctx);
                }

                // Player
                player.draw(ctx);

                // Buildings & Walls
                for (let i = 0; i < buildings.length; i++) {
                    const b = buildings[i];
                    if (b.floor && activeF && b.floor !== activeF) continue;
                    ctx.fillStyle = b.color || '#1e293b';
                    ctx.fillRect(b.x, b.y, b.w, b.h);
                    ctx.strokeStyle = b.roofColor || '#334155';
                    ctx.lineWidth = 2;
                    ctx.strokeRect(b.x, b.y, b.w, b.h);

                    if (b.tag) {
                        ctx.font = '900 11px ui-monospace, monospace';
                        ctx.fillStyle = 'rgba(226, 232, 240, 0.72)';
                        ctx.textAlign = 'center';
                        ctx.fillText(b.tag, b.x + b.w / 2, b.y + b.h / 2 + 4);
                    }
                }

                // Trees (Woodland Airsoft)
                for (let i = 0; i < trees.length; i++) {
                    const tr = trees[i];
                    ctx.fillStyle = '#052e16';
                    ctx.beginPath();
                    ctx.arc(tr.x, tr.y, tr.r + 4, 0, Math.PI * 2);
                    ctx.fill();
                    ctx.fillStyle = '#15803d';
                    ctx.beginPath();
                    ctx.arc(tr.x - 3, tr.y - 3, tr.r * 0.78, 0, Math.PI * 2);
                    ctx.fill();
                }

                // Bullets & Particles
                for (let i = 0; i < bullets.length; i++) {
                    bullets[i].draw(ctx);
                }
                for (let i = 0; i < particles.length; i++) {
                    const pt = particles[i];
                    if (activeF && pt.floor && pt.floor !== activeF) continue;
                    pt.draw(ctx);
                }

                ctx.restore();

                // Dark Mall Atmospheric Lighting, Flashlight Cone & NVG/Thermal Filter
                renderLightingAndOptics();
                renderMinimap();
            }

            function renderLightingAndOptics() {
                if (!player) return;

                if (player.opticsMode === 1) {
                    // Phosphor-Green Night Vision
                    ctx.save();
                    ctx.fillStyle = 'rgba(16, 185, 129, 0.22)';
                    ctx.fillRect(0, 0, width, height);
                    const grad = ctx.createRadialGradient(width / 2, height / 2, width * 0.25, width / 2, height / 2, width * 0.65);
                    grad.addColorStop(0, 'rgba(0,0,0,0)');
                    grad.addColorStop(1, 'rgba(2, 20, 10, 0.78)');
                    ctx.fillStyle = grad;
                    ctx.fillRect(0, 0, width, height);
                    ctx.restore();
                    return;
                }

                if (player.opticsMode === 2) {
                    // White-Hot Thermal Imaging (FLIR)
                    ctx.save();
                    ctx.fillStyle = 'rgba(15, 23, 42, 0.42)';
                    ctx.fillRect(0, 0, width, height);
                    ctx.restore();
                    return;
                }

                // Pitch-dark indoor Mall (L1, G, B1)
                if (currentCampaign === 'mall' && currentMallFloor !== 'L2') {
                    ctx.save();
                    const px = player.x - camera.x;
                    const py = player.y - camera.y;

                    const darkGrad = ctx.createRadialGradient(px, py, 36, px, py, 340);
                    darkGrad.addColorStop(0, 'rgba(4, 7, 15, 0.12)');
                    darkGrad.addColorStop(0.55, 'rgba(4, 7, 15, 0.72)');
                    darkGrad.addColorStop(1, 'rgba(2, 4, 10, 0.90)');
                    ctx.fillStyle = darkGrad;
                    ctx.fillRect(0, 0, width, height);

                    // Flashlight / Strobe Beam
                    const strobeOn = !player.strobeActive || Math.sin(player.strobePulsePhase) > 0;
                    if (player.flashlightOn && strobeOn) {
                        ctx.save();
                        ctx.globalCompositeOperation = 'lighter';
                        const beamGrad = ctx.createRadialGradient(px, py, 14, px, py, 460);
                        beamGrad.addColorStop(0, player.strobeActive ? 'rgba(255, 255, 255, 0.48)' : 'rgba(254, 249, 195, 0.34)');
                        beamGrad.addColorStop(1, 'rgba(254, 249, 195, 0)');
                        ctx.fillStyle = beamGrad;
                        ctx.beginPath();
                        ctx.moveTo(px, py);
                        ctx.arc(px, py, 460, player.angle - 0.42, player.angle + 0.42);
                        ctx.closePath();
                        ctx.fill();
                        ctx.restore();
                    }
                    ctx.restore();
                }
            }

            function renderMinimap() {
                miniCtx.clearRect(0, 0, 132, 132);
                const scale = 132 / WORLD_SIZE;
                const activeF = (currentCampaign === 'mall') ? currentMallFloor : null;

                // Walls
                miniCtx.fillStyle = '#334155';
                for (let i = 0; i < buildings.length; i++) {
                    const b = buildings[i];
                    if (b.floor && activeF && b.floor !== activeF) continue;
                    miniCtx.fillRect(b.x * scale, b.y * scale, Math.max(2, b.w * scale), Math.max(2, b.h * scale));
                }

                // Stairs
                if (currentCampaign === 'mall') {
                    for (let i = 0; i < stairs.length; i++) {
                        const s = stairs[i];
                        if (s.fromFloor === currentMallFloor) {
                            miniCtx.fillStyle = s.blocked ? '#ef4444' : '#38bdf8';
                            miniCtx.fillRect(s.x * scale - 2.5, s.y * scale - 2.5, 5, 5);
                        }
                    }
                }

                // Objective marker
                if (!activeF || mission.targetFloor === activeF) {
                    miniCtx.fillStyle = '#facc15';
                    miniCtx.beginPath();
                    miniCtx.arc(mission.targetX * scale, mission.targetY * scale, 4, 0, Math.PI * 2);
                    miniCtx.fill();
                }

                // Enemies (visible if close or CCTV matrix active)
                for (let i = 0; i < enemies.length; i++) {
                    const e = enemies[i];
                    if (activeF && e.floor && e.floor !== activeF) continue;
                    const dist = Math2.dist(player.x, player.y, e.x, e.y);
                    if (cctvRevealTimer > 0 || dist < 480 || currentCampaign !== 'mall') {
                        miniCtx.fillStyle = e.isUnarmed ? '#94a3b8' : '#f43f5e';
                        miniCtx.fillRect(e.x * scale - 1.5, e.y * scale - 1.5, 3, 3);
                    }
                }

                // Player
                miniCtx.fillStyle = '#ec4899';
                miniCtx.beginPath();
                miniCtx.arc(player.x * scale, player.y * scale, 3.5, 0, Math.PI * 2);
                miniCtx.fill();
            }

            // ============================================================================
            // MAIN SIMULATION LOOP
            // ============================================================================
            function updateSimulation(dt) {
                if (gameState !== 'playing' || phoneCutscene.active) return;
                elapsedTime += dt;

                player.update(dt);

                for (let i = 0; i < vehicles.length; i++) vehicles[i].update(dt);
                for (let i = 0; i < allies.length; i++) allies[i].update(dt);
                for (let i = 0; i < civilians.length; i++) civilians[i].update(dt);
                for (let i = 0; i < corpses.length; i++) corpses[i].update(dt);
                for (let i = 0; i < droppedMags.length; i++) droppedMags[i].update(dt);

                const activeF = (currentCampaign === 'mall') ? currentMallFloor : null;
                for (let i = enemies.length - 1; i >= 0; i--) {
                    const e = enemies[i];
                    if (activeF && e.floor && e.floor !== activeF) continue;
                    e.update(dt);
                }

                for (let i = pickups.length - 1; i >= 0; i--) {
                    pickups[i].update(dt);
                }

                for (let i = bullets.length - 1; i >= 0; i--) {
                    bullets[i].update(dt);
                    if (bullets[i].dead) bullets.splice(i, 1);
                }

                for (let i = particles.length - 1; i >= 0; i--) {
                    particles[i].update(dt);
                    if (particles[i].life <= 0) particles.splice(i, 1);
                }

                input.mouse.worldX = input.mouse.x + camera.x;
                input.mouse.worldY = input.mouse.y + camera.y;

                updateMissionDirector(dt);
            }

            function gameLoop(timestamp) {
                if (!lastTimestamp) lastTimestamp = timestamp;
                const dt = Math.min(0.05, (timestamp - lastTimestamp) / 1000);
                lastTimestamp = timestamp;

                if (gameState === 'playing') {
                    updateSimulation(dt);
                    renderWorld();
                }
                requestAnimationFrame(gameLoop);
            }

            // ============================================================================
            // INPUT LISTENERS (KEYBOARD, MOUSE & MOBILE TOUCH)
            // ============================================================================
            window.addEventListener('keydown', (e) => {
                if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code) && gameState === 'playing') {
                    e.preventDefault();
                }

                if (phoneCutscene.active) {
                    if (e.code === 'Space' || e.code === 'Enter') {
                        e.preventDefault();
                        phoneCutscene.advance();
                    }
                    return;
                }

                input.keys[e.code] = true;
                if (gameState !== 'playing' || !player) return;

                if (e.code === 'KeyR') player.reload();
                else if (e.code === 'KeyC') player.toggleSneak();
                else if (e.code === 'KeyF') player.toggleFlashlight();
                else if (e.code === 'KeyT') player.triggerStrobe();
                else if (e.code === 'KeyV') player.cycleOptics();
                else if (e.code === 'KeyB') player.toggleAmmoType();
                else if (e.code === 'KeyQ') player.meleeOrExecute();
                else if (e.code === 'KeyE') handleInteract();
                else if (e.code === 'KeyM') sfx.toggleMusic();
                else if (e.code === 'KeyH') player.useFieldCare();
            });

            window.addEventListener('keyup', (e) => {
                input.keys[e.code] = false;
            });

            canvas.addEventListener('mousemove', (e) => {
                input.mouse.x = e.clientX;
                input.mouse.y = e.clientY;
                input.mouse.worldX = e.clientX + camera.x;
                input.mouse.worldY = e.clientY + camera.y;
            });

            canvas.addEventListener('mousedown', (e) => {
                if (gameState !== 'playing' || phoneCutscene.active) return;
                sfx.init();
                if (e.button === 0) input.mouse.down = true;
                else if (e.button === 2 && player) player.meleeOrExecute();
            });

            window.addEventListener('mouseup', (e) => {
                if (e.button === 0) input.mouse.down = false;
            });

            canvas.addEventListener('contextmenu', (e) => e.preventDefault());

            // Mobile Touch Sticks & Buttons
            function bindStick(zoneId, knobId, stickObj) {
                const zone = document.getElementById(zoneId);
                const knob = document.getElementById(knobId);
                if (!zone || !knob) return;

                zone.addEventListener('touchstart', (e) => {
                    e.preventDefault();
                    sfx.init();
                    const t = e.changedTouches[0];
                    const rect = zone.getBoundingClientRect();
                    stickObj.active = true;
                    stickObj.id = t.identifier;
                    stickObj.startX = rect.left + rect.width / 2;
                    stickObj.startY = rect.top + rect.height / 2;
                }, { passive: false });

                zone.addEventListener('touchmove', (e) => {
                    e.preventDefault();
                    for (let i = 0; i < e.changedTouches.length; i++) {
                        const t = e.changedTouches[i];
                        if (t.identifier === stickObj.id) {
                            const maxR = 42;
                            const rawX = t.clientX - stickObj.startX;
                            const rawY = t.clientY - stickObj.startY;
                            const dist = Math.hypot(rawX, rawY);
                            const clamped = Math.min(dist, maxR);
                            const ang = Math.atan2(rawY, rawX);
                            stickObj.dx = (Math.cos(ang) * clamped) / maxR;
                            stickObj.dy = (Math.sin(ang) * clamped) / maxR;
                            knob.style.transform = `translate(${stickObj.dx * maxR}px, ${stickObj.dy * maxR}px)`;
                        }
                    }
                }, { passive: false });

                const endStick = (e) => {
                    for (let i = 0; i < e.changedTouches.length; i++) {
                        if (e.changedTouches[i].identifier === stickObj.id) {
                            stickObj.active = false;
                            stickObj.id = null;
                            stickObj.dx = 0;
                            stickObj.dy = 0;
                            knob.style.transform = 'translate(0px, 0px)';
                        }
                    }
                };
                zone.addEventListener('touchend', endStick);
                zone.addEventListener('touchcancel', endStick);
            }

            bindStick('leftStickZone', 'leftKnob', input.leftStick);
            bindStick('rightStickZone', 'rightKnob', input.rightStick);

            document.getElementById('btnMobileSneak').addEventListener('click', () => { if (player) player.toggleSneak(); });
            document.getElementById('btnMobileStrobe').addEventListener('click', () => { if (player) player.triggerStrobe(); });
            document.getElementById('btnMobileLight').addEventListener('click', () => { if (player) player.toggleFlashlight(); });
            document.getElementById('btnMobileOptics').addEventListener('click', () => { if (player) player.cycleOptics(); });
            document.getElementById('btnMobileInteract').addEventListener('click', () => { handleInteract(); });
            document.getElementById('btnMobileReload').addEventListener('click', () => { if (player) player.reload(); });
            document.getElementById('btnMobileCare').addEventListener('click', () => { if (player) player.useFieldCare(); });

            // ============================================================================
            // GAME STATE TRANSITIONS & BOOTSTRAP
            // ============================================================================
            function startGame() {
                sfx.init();
                try {
                    window.localStorage.setItem('hero-shooter:last-chapter', currentCampaign);
                    sfx.musicEnabled = window.localStorage.getItem('hero-shooter:music-on-start') === 'true';
                } catch {
                    sfx.musicEnabled = false;
                }
                sfx.configureGenreForCampaign(currentCampaign);
                document.getElementById('startModal').classList.add('hidden');
                document.getElementById('endModal').classList.add('hidden');
                generateWorld(currentCampaign);
                gameState = 'playing';
                sfx.syncPhoenixTrack();
                lastTimestamp = performance.now();
            }

            function openMenu() {
                gameState = 'menu';
                phoneCutscene.active = false;
                document.getElementById('phoneCutscene').classList.remove('active');
                document.getElementById('endModal').classList.add('hidden');
                document.getElementById('startModal').classList.remove('hidden');
            }

            function triggerEndGame(victory) {
                gameState = 'gameover';
                const badge = document.getElementById('endBadge');
                const title = document.getElementById('endTitle');
                const sub = document.getElementById('endSubtitle');

                if (victory) {
                    badge.className = 'inline-block px-3 py-1 rounded-full bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 text-xs font-extrabold tracking-widest uppercase mb-3';
                    badge.innerText = 'MISSION COMPLETE';
                    title.innerText = currentCampaign === 'training' ? 'SKIRMISH WON' : 'EXTRACTED';
                    sub.innerText = currentCampaign === 'mall'
                        ? `C recovered her go-bag and cleared the L2 taxi rank with R${cashCollected.toLocaleString()} scavenged.`
                        : 'Objective secured. Area cleared.';
                } else {
                    badge.className = 'inline-block px-3 py-1 rounded-full bg-rose-500/20 border border-rose-500/40 text-rose-300 text-xs font-extrabold tracking-widest uppercase mb-3';
                    badge.innerText = 'OPERATION FAILED';
                    title.innerText = 'FLATLINED';
                    sub.innerText = 'Lethal incoming fire overwhelmed your position. Use cover, shadows, and strobe discipline.';
                }

                document.getElementById('statKills').innerText = kills;
                document.getElementById('statTime').innerText = currentCampaign === 'mall' ? `R${cashCollected.toLocaleString()}` : `${Math.floor(elapsedTime)}s`;
                document.getElementById('endModal').classList.remove('hidden');
            }

            window.selectCampaign = selectCampaign;
            window.openMenu = openMenu;
            window.sfx = sfx;
            window.phoneCutscene = phoneCutscene;

            document.getElementById('btnStartGame').addEventListener('click', startGame);
            document.getElementById('btnRestartGame').addEventListener('click', startGame);
            document.getElementById('btnBackMenu').addEventListener('click', openMenu);

            window.onload = function () {
                SpriteAtlas.init(ctx);
                initMenuAvatars();
                const chapterFromLink = new URLSearchParams(window.location.search).get('chapter');
                selectCampaign(['training', 'mall', 'cbd', 'sniper', 'suburbs'].includes(chapterFromLink) ? chapterFromLink : 'mall');
                requestAnimationFrame(gameLoop);
            };
        })();
    