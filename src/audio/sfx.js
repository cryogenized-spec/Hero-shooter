// Original procedural soundtrack and sound effects, extracted with dependency injection.
// The game owns its state; audio receives read-only callbacks instead of global variables.
export function createAudioEngine({ getGameState, getPlayer, onPortraitUpdate, onBanner }) {
return {
                ctx: null,
                distCurve: null,
                musicEnabled: false, // Starts OFF by default; pressing [M] toggles music + earbuds!
                musicTimer: null,
                musicStep: 0,
                musicGenre: 'psytrance', // 'psytrance' (150 BPM for Yael) | 'metal' (for Blaze, Uncle, G)

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
                        }
                    }
                    if (this.ctx && this.ctx.state === 'suspended') {
                        this.ctx.resume();
                    }
                },

                configureGenreForCampaign(camp) {
                    this.musicGenre = (camp === 'mall' || camp === 'training') ? 'psytrance' : 'metal';
                    if (this.musicTimer) {
                        clearInterval(this.musicTimer);
                        this.musicTimer = null;
                    }
                    this.musicStep = 0;
                    // 150 BPM Psytrance = 100ms per 16th-note step; Heavy Metal = 115ms per step
                    const stepMs = this.musicGenre === 'psytrance' ? 100 : 115;
                    this.musicTimer = setInterval(() => {
                        if (!this.musicEnabled || !this.ctx || getGameState() !== 'playing') return;
                        if (this.musicGenre === 'psytrance') {
                            this.playPsytranceStep(this.musicStep);
                        } else {
                            this.playMetalStep(this.musicStep);
                        }
                        this.musicStep = (this.musicStep + 1) % 16;
                    }, stepMs);
                    this.updateMusicUI();
                },

                toggleMusic() {
                    this.init();
                    this.musicEnabled = !this.musicEnabled;
                    this.updateMusicUI();
                    if (getPlayer()) {
                        onPortraitUpdate(getPlayer().gender);
                    }
                    const label = this.musicGenre === 'psytrance'
                        ? (this.musicEnabled ? 'IPODS: 150 BPM PSYTRANCE // ON' : 'IPODS: OFF (EARBUDS STOWED)')
                        : (this.musicEnabled ? 'IPODS: HEAVY METAL // ON' : 'IPODS: OFF (EARBUDS STOWED)');
                    onBanner(label, 1600);
                },

                updateMusicUI() {
                    const el = document.getElementById('radioStatus');
                    if (!el) return;
                    if (!this.musicEnabled) {
                        el.innerText = 'IPODS [M]: OFF';
                        el.style.color = '#64748b';
                    } else if (this.musicGenre === 'psytrance') {
                        el.innerText = 'IPODS [M]: PSYTRANCE 150BPM // ON';
                        el.style.color = '#f472b6';
                    } else {
                        el.innerText = 'IPODS [M]: HEAVY METAL // ON';
                        el.style.color = '#eab308';
                    }
                },

                // 150 BPM Psychedelic Trance (Rolling K-B-B-B 16th Bass + Punchy Kick + Acid Squelch)
                playPsytranceStep(step) {
                    if (!this.ctx) return;
                    const now = this.ctx.currentTime;

                    // 4-on-the-floor Psytrance Kick on 0, 4, 8, 12
                    if (step % 4 === 0) {
                        const kickOsc = this.ctx.createOscillator();
                        const kickGain = this.ctx.createGain();
                        kickOsc.type = 'sine';
                        kickOsc.frequency.setValueAtTime(165, now);
                        kickOsc.frequency.exponentialRampToValueAtTime(42, now + 0.085);

                        kickGain.gain.setValueAtTime(0.085, now);
                        kickGain.gain.exponentialRampToValueAtTime(0.001, now + 0.095);

                        kickOsc.connect(kickGain);
                        kickGain.connect(this.ctx.destination);
                        kickOsc.start(now);
                        kickOsc.stop(now + 0.095);
                    } else {
                        // Rolling 16th-note Psytrance Bassline (K-B-B-B pattern in F Phrygian Dominant)
                        const rootFreq = (step >= 12) ? 46.25 : 43.65; // F1 -> Gb1 tension on bar end
                        const bassOsc = this.ctx.createOscillator();
                        const bassFilter = this.ctx.createBiquadFilter();
                        const bassGain = this.ctx.createGain();

                        bassOsc.type = 'sawtooth';
                        bassOsc.frequency.setValueAtTime(rootFreq, now);

                        bassFilter.type = 'lowpass';
                        bassFilter.Q.value = 5.5;
                        bassFilter.frequency.setValueAtTime(860, now);
                        bassFilter.frequency.exponentialRampToValueAtTime(135, now + 0.075);

                        const accent = (step % 4 === 2) ? 0.052 : 0.04;
                        bassGain.gain.setValueAtTime(accent, now);
                        bassGain.gain.exponentialRampToValueAtTime(0.001, now + 0.082);

                        bassOsc.connect(bassFilter);
                        bassFilter.connect(bassGain);
                        bassGain.connect(this.ctx.destination);
                        bassOsc.start(now);
                        bassOsc.stop(now + 0.085);
                    }

                    // Crisp Offbeat Psy Hi-Hat on 2, 6, 10, 14
                    if (step % 4 === 2) {
                        this.playNoise(0.032, 8200, 0.022);
                    }

                    // Squelchy 303 Acid Lead Synth on syncopated steps
                    const acidNotes = {
                        3: 349.23,  // F4
                        6: 369.99,  // Gb4
                        10: 440.00, // A4
                        13: 523.25, // C5
                        15: 466.16  // Bb4
                    };
                    if (acidNotes[step]) {
                        const leadOsc = this.ctx.createOscillator();
                        const leadFilter = this.ctx.createBiquadFilter();
                        const leadGain = this.ctx.createGain();

                        leadOsc.type = 'sawtooth';
                        leadOsc.frequency.setValueAtTime(acidNotes[step], now);

                        leadFilter.type = 'bandpass';
                        leadFilter.Q.value = 9.0;
                        const sweep = 650 + Math.sin(performance.now() * 0.0015) * 450;
                        leadFilter.frequency.setValueAtTime(sweep, now);
                        leadFilter.frequency.exponentialRampToValueAtTime(sweep * 2.4, now + 0.09);

                        leadGain.gain.setValueAtTime(0.022, now);
                        leadGain.gain.exponentialRampToValueAtTime(0.001, now + 0.095);

                        leadOsc.connect(leadFilter);
                        leadFilter.connect(leadGain);
                        leadGain.connect(this.ctx.destination);
                        leadOsc.start(now);
                        leadOsc.stop(now + 0.098);
                    }
                },

                playMetalStep(step) {
                    if (!this.ctx || !this.distCurve) return;
                    const now = this.ctx.currentTime;

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
                        osc1.frequency.setValueAtTime(freq, now);
                        osc2.frequency.setValueAtTime(freq * 1.498, now);

                        const shaper = this.ctx.createWaveShaper();
                        shaper.curve = this.distCurve;

                        const cab = this.ctx.createBiquadFilter();
                        cab.type = 'lowpass';
                        cab.frequency.setValueAtTime(isAccent ? 2100 : 1150, now);

                        const g = this.ctx.createGain();
                        g.gain.setValueAtTime(0.032, now);
                        g.gain.exponentialRampToValueAtTime(0.001, now + dur);

                        osc1.connect(shaper);
                        osc2.connect(shaper);
                        shaper.connect(cab);
                        cab.connect(g);
                        g.connect(this.ctx.destination);

                        osc1.start(now);
                        osc2.start(now);
                        osc1.stop(now + dur);
                        osc2.stop(now + dur);
                    }

                    if ([0, 3, 6, 8, 11, 14].includes(step)) {
                        this.playTone(115, 34, 0.085, 'sine', 0.072);
                    }

                    if (step === 4 || step === 12) {
                        this.playNoise(0.11, 2400, 0.062);
                        this.playTone(190, 85, 0.07, 'triangle', 0.04);
                    } else if (step % 2 === 0) {
                        this.playNoise(0.03, 6500, 0.013);
                    }
                },

                playNoise(duration, filterFreq, gainVal) {
                    if (!this.ctx) return;
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
                    gain.gain.setValueAtTime(gainVal, this.ctx.currentTime);
                    gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + duration);

                    src.connect(filter);
                    filter.connect(gain);
                    gain.connect(this.ctx.destination);
                    src.start();
                },

                playTone(startFreq, endFreq, duration, type, gainVal) {
                    if (!this.ctx) return;
                    const osc = this.ctx.createOscillator();
                    const gain = this.ctx.createGain();
                    osc.type = type;
                    osc.frequency.setValueAtTime(startFreq, this.ctx.currentTime);
                    osc.frequency.exponentialRampToValueAtTime(Math.max(20, endFreq), this.ctx.currentTime + duration);

                    gain.gain.setValueAtTime(gainVal, this.ctx.currentTime);
                    gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + duration);

                    osc.connect(gain);
                    gain.connect(this.ctx.destination);
                    osc.start();
                    osc.stop(this.ctx.currentTime + duration);
                },

                playGunshot(wepId) {
                    if (wepId === 'airsoft_pistol' || wepId === 'airsoft_aeg') {
                        // Crisp green-gas blowback / AEG gearbox pop
                        this.playNoise(0.055, 3600, 0.08);
                        this.playTone(540, 210, 0.045, 'square', 0.065);
                    } else if (wepId === 'glock26_jhp') {
                        // Louder +P 120gr JHP concussive bark out of short 3.4" barrel
                        this.playNoise(0.18, 2900, 0.23);
                        this.playTone(230, 42, 0.14, 'sawtooth', 0.17);
                    } else if (wepId === 'ruger') {
                        this.playNoise(0.38, 3400, 0.32);
                        this.playTone(185, 28, 0.28, 'sawtooth', 0.22);
                    } else if (wepId === 'shotgun') {
                        this.playNoise(0.28, 1600, 0.25);
                        this.playTone(140, 35, 0.22, 'sawtooth', 0.16);
                    } else if (wepId === 'lm4' || wepId === 'ak47' || wepId === 'ar15') {
                        this.playNoise(0.14, 2800, 0.18);
                        this.playTone(220, 48, 0.11, 'triangle', 0.13);
                    } else {
                        this.playNoise(0.11, 2400, 0.14);
                        this.playTone(260, 55, 0.09, 'triangle', 0.11);
                    }
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

                playOpticsWhine() {
                    this.playTone(420, 1850, 0.14, 'sine', 0.055);
                },

                playStrobeHum() {
                    this.playTone(2400, 3100, 0.04, 'sine', 0.04);
                },

                playAlarmShout() {
                    this.playTone(460, 620, 0.12, 'sawtooth', 0.09);
                    setTimeout(() => this.playTone(580, 410, 0.14, 'sawtooth', 0.09), 110);
                },

                playPhonePing() {
                    this.playTone(880, 1320, 0.09, 'sine', 0.09);
                    setTimeout(() => this.playTone(1320, 1760, 0.12, 'sine', 0.09), 95);
                },

                playHit() {
                    this.playTone(180, 60, 0.08, 'sawtooth', 0.12);
                },

                playExplosion() {
                    this.playNoise(0.75, 700, 0.45);
                    this.playTone(95, 22, 0.65, 'sawtooth', 0.35);
                },

                playPickup() {
                    this.playTone(480, 880, 0.12, 'triangle', 0.1);
                },

                playHorn() {
                    this.playTone(340, 330, 0.18, 'sawtooth', 0.08);
                    this.playTone(425, 420, 0.18, 'sawtooth', 0.08);
                }
            };
}
