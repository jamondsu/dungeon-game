// ═══════════════════════════════════════════════════════════════════════════
// Sound.js — every sound in the game, synthesized with Web Audio. No files.
//
//   Sfx.play(scene, 'hit', { el: 'fire' })
//
// Each sound is a few oscillators and filtered noise, built when it plays and thrown away
// after. It rides Phaser's own AudioContext (scene.sound.context), so Phaser's unlock-on-
// first-input handles the browser's autoplay rule; until that happens, play() is silent.
// Nothing here touches audio when the file LOADS, so it can be loaded outside a browser.
//
// Volume and mute persist in localStorage ('sfxVolume' 0-1, 'sfxMuted'). M toggles mute in
// a level (GameScene); the pause menu has both volumes. Music (the Music object at the
// bottom) is synthesized the same way: a little step sequencer per track. Every sound has a minimum gap (GAP ms) so a crowd of hits reads as a
// rattle rather than a wall of noise, and a little pitch jitter so repeats don't drone.
// ═══════════════════════════════════════════════════════════════════════════

const Sfx = {
    GAP: { cspierce: 60, csbeam: 80, csplace: 60, hit: 45, kill: 60, hurt: 120, pickup: 50, hover: 60, click: 40, eshoot: 70, block: 60, clink: 90, heal: 200,
           w_orb_emitter: 70, w_lightning_fists: 50, zap: 35, orbhit: 60, blburst: 120, w_ice_fists: 50, w_flame_fists: 50, boom: 50, freeze: 80, shatter: 80, pop: 60, ignite: 90, sburn: 110,
           lava_splat: 70, meteor_fall: 220, meteor_hit: 80, kindle_boom: 90, gale: 150, lava_pop: 120, sear: 120, blip: 60, bosshit: 70,
           tell: 120, swing: 60, slam: 80, laser_charge: 150, laser_fire: 80, portal: 120, lob: 80, pulse: 150, mine: 80, spawn: 60, split: 100, status: 200, rready: 300, snap: 100, coin: 40, splash: 90, bubbles: 200 },
    _last: {},
    _noiseBuf: null,
    _master: null,

    volume() {
        try { const v = parseFloat(localStorage.getItem('sfxVolume')); return isNaN(v) ? 0.5 : Math.max(0, Math.min(1, v)); }
        catch (e) { return 0.5; }
    },
    muted() {
        try { return localStorage.getItem('sfxMuted') === 'true'; } catch (e) { return false; }
    },
    setMuted(m) {
        try { localStorage.setItem('sfxMuted', m ? 'true' : 'false'); } catch (e) {}
        if (this._master) this._master.gain.value = m ? 0 : this.volume();
        Music._applyVolume();
    },
    setVolume(v) {
        try { localStorage.setItem('sfxVolume', String(Math.max(0, Math.min(1, v)))); } catch (e) {}
        if (this._master && !this.muted()) this._master.gain.value = this.volume();
    },
    toggleMute() { this.setMuted(!this.muted()); return this.muted(); },

    // The context, a master gain on it, and a second of white noise to cut sounds from.
    _ctx(scene) {
        const ctx = scene?.sound?.context;
        if (!ctx || ctx.state === 'closed') return null;
        if (!this._master || this._master.context !== ctx) {
            this._master = ctx.createGain();
            this._master.gain.value = this.muted() ? 0 : this.volume();
            this._master.connect(ctx.destination);
            this._noiseBuf = null;
            // a space for the cosmic sounds to ring out in: two tapped echoes, darkened as they
            // repeat (sounds opt in with `space`)
            const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 3200;
            const d1 = ctx.createDelay(1), d2 = ctx.createDelay(1), fb = ctx.createGain(), wet = ctx.createGain();
            d1.delayTime.value = 0.19; d2.delayTime.value = 0.31; fb.gain.value = 0.42; wet.gain.value = 0.55;
            this._space = ctx.createGain();
            this._space.connect(d1); this._space.connect(d2);
            d1.connect(lp); d2.connect(lp); lp.connect(fb); fb.connect(d1); lp.connect(wet); wet.connect(this._master);
        }
        if (!this._samplesAsked) { this._samplesAsked = true; this._loadSamples(ctx); }
        if (!this._noiseBuf) {
            const b = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate), d = b.getChannelData(0);
            for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
            this._noiseBuf = b;
        }
        return ctx;
    },

    // Recorded sounds (assets/sfx), fetched and decoded once there's an audio context. A sound that uses one plays its
    // synth version until it's in (or if it never loads).
    // (CC0 from Freesound, Pixabay for the snap: see assets/sfx/CREDITS.md)
    SAMPLES: Object.fromEntries(['evil_laugh', 'snap', 'roar', 'roar_big', 'bossdie', 'lava_loop', 'lava_pop1', 'lava_pop2', 'sear', 'crackle',
        'ice_crack', 'ice_crack2', 'coin', 'page', 'splash', 'splash_big', 'bubbles', 'dash_whoosh', 'fire_whoosh', 'fire_dash', 'ice_dash', 'frost_shield', 'fire_burst', 'zap', 'magic_whoosh',
        'splat1', 'splat2', 'splat_big', 'squelch', 'punch', 'sword', 'chest_open', 'potion', 'boom1', 'boom2', 'eshot', 'block', 'door', 'gust', 'wind',
        'lava_erupt', 'slam', 'thud', 'powerup', 'buzz', 'click'].map(k => [k, `assets/sfx/${k}.wav`])),
    _buf: {},
    _loadSamples(ctx) {
        if (typeof fetch !== 'function') return;
        for (const [k, url] of Object.entries(this.SAMPLES))
            fetch(url).then(r => r.arrayBuffer()).then(b => ctx.decodeAudioData(b)).then(buf => { this._buf[k] = buf; }).catch(() => {});
    },
    // A recorded sound. rate pitches it (under 1: deeper and slower), grit mixes in a distorted copy filtered to a
    // crackle, double a second voice a shade lower drifting against the first, growl the voice ring-modulated at 45Hz
    // (a demon's buzz), space sends that share into the echoes. False if it isn't loaded.
    _sample(ctx, t, { name, rate = 1, vol = 1, grit = 0, double = 0, growl = 0, space = 0, lp = 0 }) {
        const buf = this._buf[name];
        if (!buf) return false;
        const g = ctx.createGain(), end = t + buf.duration / rate + 0.2;
        g.gain.value = vol;
        if (lp) { const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = lp; g.connect(f); f.connect(this._master); }   // (lp: its top end off, Hz)
        else g.connect(this._master);
        if (space && this._space) { const sg = ctx.createGain(); sg.gain.value = space; g.connect(sg); sg.connect(this._space); }
        const voice = (r, level) => { const s = ctx.createBufferSource(), lg = ctx.createGain(); s.buffer = buf; s.playbackRate.value = r; lg.gain.value = level; s.connect(lg); lg.connect(g); s.start(t); return s; };
        const s = voice(rate, 1);
        if (double) voice(rate * 0.97, double);
        if (grit) {
            const ws = ctx.createWaveShaper(), bp = ctx.createBiquadFilter(), gg = ctx.createGain(), c = new Float32Array(1024);
            for (let i = 0; i < c.length; i++) c[i] = Math.tanh((i / (c.length - 1) * 2 - 1) * 6);
            ws.curve = c; bp.type = 'bandpass'; bp.frequency.value = 1400; bp.Q.value = 0.7; gg.gain.value = grit;
            s.connect(ws); ws.connect(bp); bp.connect(gg); gg.connect(g);
        }
        if (growl) {
            const rm = ctx.createGain(), osc = ctx.createOscillator(), mg = ctx.createGain();
            rm.gain.value = 0; osc.frequency.value = 45; osc.connect(rm.gain); mg.gain.value = growl;
            s.connect(rm); rm.connect(mg); mg.connect(g); osc.start(t); osc.stop(end);
        }
        return true;
    },

    // Several recordings at once (each { name, at (s later), and _sample's options }); true if the first one was there to play
    _rec(ctx, t, ...specs) {
        if (!this._buf[specs[0].name]) return false;
        for (const sp of specs) this._sample(ctx, t + (sp.at || 0), sp);
        return true;
    },

    // An oscillator gliding f0 → f1 over dur seconds, with a fast attack and an exponential tail.
    _tone(ctx, t, { type = 'sine', f0, f1 = f0, dur, vol = 0.3, attack = 0.004, out, space = false }) {
        const o = ctx.createOscillator(), g = ctx.createGain();
        o.type = type;
        o.frequency.setValueAtTime(f0, t);
        o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
        g.gain.setValueAtTime(0.0001, t);
        g.gain.exponentialRampToValueAtTime(vol, t + attack);
        g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
        o.connect(g); g.connect(out || this._master);
        if (space && this._space) g.connect(this._space);
        o.start(t); o.stop(t + dur + 0.02);
    },
    // A bell: a sine whose pitch is wobbled by another at a non-integer ratio, the wobble dying
    // away faster than the note, so it strikes bright and rings out pure. Into the space.
    _bell(ctx, t, { f, dur = 1.2, vol = 0.05, ratio = 2.76, depth = 2.2 }) {
        const c = ctx.createOscillator(), m = ctx.createOscillator(), mg = ctx.createGain(), g = ctx.createGain();
        c.frequency.value = f; m.frequency.value = f * ratio;
        mg.gain.setValueAtTime(f * depth, t); mg.gain.exponentialRampToValueAtTime(1, t + dur * 0.6);
        m.connect(mg); mg.connect(c.frequency);
        g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + 0.006); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
        c.connect(g); g.connect(this._master); if (this._space) g.connect(this._space);
        c.start(t); m.start(t); c.stop(t + dur + 0.05); m.stop(t + dur + 0.05);
    },

    // Noise through a filter whose centre glides f0 → f1.
    _noise(ctx, t, { filter = 'bandpass', f0, f1 = f0, q = 1, dur, vol = 0.3, attack = 0.003, out, space = false }) {
        const s = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain();
        s.buffer = this._noiseBuf;
        f.type = filter; f.Q.value = q;
        f.frequency.setValueAtTime(f0, t);
        f.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
        g.gain.setValueAtTime(0.0001, t);
        g.gain.exponentialRampToValueAtTime(vol, t + attack);
        g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
        s.connect(f); f.connect(g); g.connect(out || this._master);
        if (space && this._space) g.connect(this._space);
        s.start(t, Math.random() * 0.5); s.stop(t + dur + 0.02);
    },

    // Bubbles: n little sines each sweeping up fast (a bubble's pop), scattered over spread seconds.
    _bubbles(ctx, t, { n = 4, spread = 0.2, f = 400, vol = 0.05 } = {}) {
        for (let k = 0; k < n; k++) {
            const f0 = f * (0.6 + Math.random() * 0.9);
            this._tone(ctx, t + Math.random() * spread, { type: 'sine', f0, f1: f0 * (1.6 + Math.random() * 0.8), dur: 0.03 + Math.random() * 0.04, vol: vol * (0.6 + Math.random() * 0.4), attack: 0.003 });
        }
    },
    // Crackle: n tiny clicks of noise scattered over spread seconds (fire, frost spreading, gravel).
    _crackle(ctx, t, { n = 8, spread = 0.3, f = 1200, vol = 0.05, q = 0.9 } = {}) {
        for (let k = 0; k < n; k++) this._noise(ctx, t + Math.random() * spread, { filter: 'bandpass', f0: f * (0.6 + Math.random() * 0.8), q, dur: 0.008 + Math.random() * 0.014, vol: vol * (0.4 + Math.random() * 0.6), attack: 0.001 });
    },
    // Glass: n bright pings at random pitches ringing briefly (ice shards).
    _glass(ctx, t, { n = 6, spread = 0.08, f = 2400, vol = 0.04, dur = 0.25 } = {}) {
        for (let k = 0; k < n; k++) { const f0 = f * (0.7 + Math.random() * 1.1); this._tone(ctx, t + Math.random() * spread, { type: 'sine', f0, f1: f0 * 0.98, dur: dur * (0.5 + Math.random()), vol: vol * (0.5 + Math.random() * 0.5) }); }
    },

    // A sound that lasts as long as something keeps asking for it (the flamethrower): each call holds it ms longer, and
    // left alone it fades out and stops. LOOPS[name](ctx, t) builds it, started: { out (a gain at 0), vol, nodes }.
    _held: {},
    sustain(scene, name, ms = 300, level = 1) {
        if (this.muted()) return;
        const ctx = this._ctx(scene);
        if (!ctx || ctx.state !== 'running') return;
        const t = ctx.currentTime;
        let h = this._held[name];
        if (!h || h.ctx !== ctx || h.dead) h = this._held[name] = { ctx, ...this.LOOPS[name].call(this, ctx, t) };
        const g = h.out.gain;
        g.cancelScheduledValues(t); g.setValueAtTime(g.value, t);
        g.linearRampToValueAtTime(h.vol * level, t + 0.06);
        g.setTargetAtTime(0.0001, t + ms / 1000, 0.08);
        clearTimeout(h.timer);
        h.timer = setTimeout(() => {
            h.dead = true;
            for (const n of h.nodes) { try { n.stop(); } catch (e) {} }
            h.out.disconnect();
            if (this._held[name] === h) delete this._held[name];
        }, ms + 800);
    },
    // For the LOOPS: looping noise through a filter into out, and a slow wobble on a param (both pushed on nodes to stop)
    _band(ctx, t, out, nodes, type, f, q, v) {
        const s = ctx.createBufferSource(), fl = ctx.createBiquadFilter(), g = ctx.createGain();
        s.buffer = this._noiseBuf; s.loop = true; fl.type = type; fl.frequency.value = f; fl.Q.value = q; g.gain.value = v;
        s.connect(fl); fl.connect(g); g.connect(out); s.start(t, Math.random()); nodes.push(s);
        return { fl, g };
    },
    _lfo(ctx, t, nodes, f, depth, param) {
        const l = ctx.createOscillator(), lg = ctx.createGain(); l.frequency.value = f * (0.9 + Math.random() * 0.2); lg.gain.value = depth;
        l.connect(lg); lg.connect(param); l.start(t); nodes.push(l);
    },
    LOOPS: {
        // the flamethrower: a breathy roar flickering, a low rumble under it, a hiss on top (blue: hotter and hissier)
        flame(ctx, t, blue = false) {
            const out = ctx.createGain(), nodes = []; out.gain.value = 0.0001; out.connect(this._master);
            const roar = this._band(ctx, t, out, nodes, 'bandpass', blue ? 900 : 620, 0.7, 1);
            this._band(ctx, t, out, nodes, 'lowpass', 170, 0.7, 0.9);
            this._band(ctx, t, out, nodes, 'bandpass', blue ? 1800 : 1300, 0.9, blue ? 0.3 : 0.18);
            for (const [f, depth, param] of [[5.3, 180, roar.fl.frequency], [11.7, 0.25, roar.g.gain], [2.1, 90, roar.fl.frequency]]) this._lfo(ctx, t, nodes, f, depth, param);   // the flicker
            return { out, vol: 0.16, nodes };
        },
        blueflame(ctx, t) { return this.LOOPS.flame.call(this, ctx, t, true); },
        // lava near you: a boil: a gurgle wandering in the middle, a low simmer under it, a soft sear fluttering over them
        lava(ctx, t) {
            const out = ctx.createGain(), nodes = []; out.gain.value = 0.0001; out.connect(this._master);
            const rec = this._buf.lava_loop;
            if (rec) {   // the recording (a seamless 4s loop)
                const s = ctx.createBufferSource(); s.buffer = rec; s.loop = true; s.connect(out); s.start(t, Math.random() * rec.duration); nodes.push(s);
                return { out, vol: 0.3, nodes };
            }
            const sear = this._band(ctx, t, out, nodes, 'bandpass', 1100, 1.2, 0.25);
            const mid = this._band(ctx, t, out, nodes, 'bandpass', 380, 2.5, 0.7);
            const low = this._band(ctx, t, out, nodes, 'lowpass', 120, 0.8, 1);
            for (const [f, depth, param] of [[6, 0.2, sear.g.gain], [2.3, 220, mid.fl.frequency], [4.1, 0.45, mid.g.gain], [0.7, 0.3, low.g.gain]]) this._lfo(ctx, t, nodes, f, depth, param);
            return { out, vol: 0.2, nodes };
        },
    },

    // A held charge (the Void Blade, the cosmic charge bar): a power-up riser. A bright pad
    // swells and opens, a shimmer rises through it, and a twinkling arpeggio climbs a major
    // scale, faster and higher the fuller the charge; full, it holds on a sparkling chord.
    // Returns { set(f), stop() }; a no-op handle when audio isn't available.
    charge(scene, kind = 'ult') {
        const none = { set() {}, stop() {} };
        if (kind === 'blade') return this._bladeCharge(scene) || none;
        if (this.muted()) return none;
        const ctx = this._ctx(scene);
        if (!ctx || ctx.state !== 'running') return none;
        const t = ctx.currentTime, out = ctx.createGain(), lp = ctx.createBiquadFilter();
        lp.type = 'lowpass'; lp.frequency.value = 900;
        out.gain.setValueAtTime(0.0001, t); out.gain.exponentialRampToValueAtTime(0.05, t + 0.3);
        lp.connect(out); out.connect(this._master); if (this._space) out.connect(this._space);
        const pad = [['sine', 261.6], ['sine', 392], ['triangle', 523.3 * 1.003]].map(([type, f]) => {
            const o = ctx.createOscillator(); o.type = type; o.frequency.value = f; o.connect(lp); o.start(t); return [o, f];
        });
        const sh = ctx.createBufferSource(), sf = ctx.createBiquadFilter(), sg = ctx.createGain();
        sh.buffer = this._noiseBuf; sh.loop = true; sf.type = 'bandpass'; sf.frequency.value = 1200; sf.Q.value = 3; sg.gain.value = 0;
        sh.connect(sf); sf.connect(sg); sg.connect(this._master); if (this._space) sg.connect(this._space); sh.start(t);
        const SCALE = [0, 2, 4, 7, 9, 12, 14, 16, 19, 21, 24];   // major pentatonic, climbing
        let noteAt = t, step = 0, stopped = false;
        return {
            set: (f) => {
                if (stopped) return;
                const now = ctx.currentTime, k = Math.max(0, Math.min(1, f));
                for (const [o, base] of pad) o.frequency.setTargetAtTime(base * Math.pow(2, k * 0.5), now, 0.1);   // up a fifth-ish
                lp.frequency.setTargetAtTime(900 + 5000 * k, now, 0.1);
                out.gain.setTargetAtTime(0.04 + 0.07 * k, now, 0.1);
                sf.frequency.setTargetAtTime(1200 + 6000 * k, now, 0.1);
                sg.gain.setTargetAtTime(0.03 + 0.08 * k, now, 0.1);
                if (now >= noteAt) {
                    noteAt = now + (k >= 1 ? 0.09 : 0.22 - 0.14 * k);
                    const i = k >= 1 ? 6 + (step % 5) : Math.min(SCALE.length - 1, Math.floor(k * 7) + (step % 3));
                    step++;
                    this._bell(ctx, now, { f: 523.3 * Math.pow(2, SCALE[i] / 12), dur: 0.35, vol: 0.025 + 0.02 * k, depth: 1.2 });
                }
            },
            stop: () => {
                if (stopped) return;
                stopped = true;
                const now = ctx.currentTime;
                out.gain.cancelScheduledValues(now); out.gain.setTargetAtTime(0.0001, now, 0.05);
                sg.gain.cancelScheduledValues(now); sg.gain.setTargetAtTime(0, now, 0.05);
                for (const [o] of pad) o.stop(now + 0.4);
                sh.stop(now + 0.4);
            },
        };
    },

    // The Void Blade's charge: steel being drawn and sharpened. A thin singing edge that
    // climbs and tightens (two close tones beating faster as they rise), a whetstone hiss
    // pulsing quicker and quicker, and a glint of a high bell at each step up.
    _bladeCharge(scene) {
        if (this.muted()) return null;
        const ctx = this._ctx(scene);
        if (!ctx || ctx.state !== 'running') return null;
        const t = ctx.currentTime, out = ctx.createGain(), bp = ctx.createBiquadFilter();
        bp.type = 'bandpass'; bp.frequency.value = 1400; bp.Q.value = 2;
        out.gain.setValueAtTime(0.0001, t); out.gain.exponentialRampToValueAtTime(0.04, t + 0.2);
        bp.connect(out); out.connect(this._master); if (this._space) out.connect(this._space);
        const edge = [['sawtooth', 660], ['sawtooth', 664], ['sine', 1320]].map(([type, f]) => {
            const o = ctx.createOscillator(); o.type = type; o.frequency.value = f; o.connect(bp); o.start(t); return [o, f];
        });
        let hissAt = t, glint = 0, stopped = false;
        return {
            set: (f) => {
                if (stopped) return;
                const now = ctx.currentTime, k = Math.max(0, Math.min(1, f));
                edge[0][0].frequency.setTargetAtTime(660 * (1 + k), now, 0.08);
                edge[1][0].frequency.setTargetAtTime(660 * (1 + k) + 4 + 18 * k, now, 0.08);   // the beat quickens
                edge[2][0].frequency.setTargetAtTime(1320 * (1 + k), now, 0.08);
                bp.frequency.setTargetAtTime(1400 + 3000 * k, now, 0.08);
                out.gain.setTargetAtTime(0.03 + 0.05 * k, now, 0.1);
                if (now >= hissAt) {   // a whetstone stroke, faster as it sharpens
                    hissAt = now + 0.4 - 0.3 * k;
                    this._noise(ctx, now, { filter: 'highpass', f0: 3000 + 3000 * k, f1: 7000, dur: 0.12, vol: 0.05 + 0.05 * k, attack: 0.03 });
                }
                const step = Math.floor(k * 5);
                if (step > glint) { glint = step; this._bell(ctx, now, { f: 1568 * Math.pow(2, step / 6), dur: 0.5, vol: 0.035, ratio: 3.5, depth: 1.5 }); }
            },
            stop: () => {
                if (stopped) return;
                stopped = true;
                const now = ctx.currentTime;
                out.gain.cancelScheduledValues(now); out.gain.setTargetAtTime(0.0001, now, 0.04);
                for (const [o] of edge) o.stop(now + 0.3);
            },
        };
    },

    play(scene, name, o = {}) {
        if (this.muted()) return;
        const ctx = this._ctx(scene);
        if (!ctx || ctx.state !== 'running') return;
        const now = ctx.currentTime * 1000, gap = this.GAP[name] ?? 0;
        if (gap && now - (this._last[name] ?? -1e9) < gap) return;
        this._last[name] = now;
        const fn = this.SOUNDS[name];
        if (fn) fn.call(this, ctx, ctx.currentTime, o, 1 + (Math.random() - 0.5) * 0.12);
    },

    // name → (ctx, t, opts, j) where j is the pitch jitter (about ±6%).
    SOUNDS: {
        // A hit, coloured by the element that dealt it.
        hit(ctx, t, o, j) {
            this._noise(ctx, t, { filter: 'lowpass', f0: 1800, f1: 300, dur: 0.07, vol: 0.18 });
            if (o.el === 'fire') this._noise(ctx, t, { filter: 'bandpass', f0: 900 * j, f1: 400, q: 0.8, dur: 0.12, vol: 0.16 });
            else if (o.el === 'ice') this._tone(ctx, t, { type: 'sine', f0: 1900 * j, f1: 1500, dur: 0.12, vol: 0.09 });
            else if (o.el === 'lightning') this._tone(ctx, t, { type: 'square', f0: 1400 * j, f1: 300, dur: 0.06, vol: 0.06 });
            else if (o.el === 'cosmic') this._tone(ctx, t, { type: 'sine', f0: 700 * j, f1: 260, dur: 0.12, vol: 0.12 });
            else this._tone(ctx, t, { type: 'triangle', f0: 220 * j, f1: 120, dur: 0.06, vol: 0.14 });
        },
        // ── TELLS AND ATTACKS: what bosses and enemies do to you, so you hear it coming ──
        tell(ctx, t, o, j) {               // a wind-up: a low whum swelling and rising (o.ms its length, o.big for a boss)
            const d = (o.ms || 500) / 1000, v = o.big ? 1 : 0.65;
            this._tone(ctx, t, { type: 'triangle', f0: 90 * j, f1: 220 * j, dur: d, vol: 0.2 * v, attack: d * 0.85 });
            this._noise(ctx, t, { filter: 'bandpass', f0: 250, f1: 900, q: 1.5, dur: d, vol: 0.3 * v, attack: d * 0.85 });
        },
        swing(ctx, t, o, j) {              // a heavy swing through the air (o.soft: a slime's lunge)
            if (this._rec(ctx, t, { name: 'dash_whoosh', rate: 0.75 + Math.random() * 0.15, vol: o.soft ? 0.14 : 0.35 })) return;
            const v = o.soft ? 0.45 : 1;
            this._noise(ctx, t, { filter: 'bandpass', f0: 300 * j, f1: 1300 * j, q: 1.4, dur: 0.18, vol: 0.3 * v, attack: 0.06 });
            this._tone(ctx, t + 0.05, { type: 'sine', f0: 160 * j, f1: 80, dur: 0.12, vol: 0.08 * v });
        },
        slam(ctx, t, o, j) {               // something heavy hitting the floor: a deep thud and debris (o.small: lighter)
            if (this._rec(ctx, t, { name: o.small ? 'thud' : 'slam', rate: 0.9 + Math.random() * 0.2, vol: o.small ? 0.35 : 0.35, lp: 3000 })) return;
            const v = o.small ? 0.5 : 1;
            this._tone(ctx, t, { type: 'sine', f0: 85 * j, f1: 30, dur: 0.4, vol: 0.32 * v });
            this._noise(ctx, t, { filter: 'lowpass', f0: 1600, f1: 120, dur: 0.35, vol: 0.24 * v });
            this._crackle(ctx, t + 0.03, { n: o.small ? 4 : 9, spread: 0.25, f: 700, vol: 0.1 * v, q: 1.2 });
        },
        laser_charge(ctx, t, o, j) {       // a beam locking on: a tone climbing (o.ms its length)
            const d = (o.ms || 600) / 1000;
            this._tone(ctx, t, { type: 'sawtooth', f0: 180 * j, f1: 900 * j, dur: d, vol: 0.085, attack: d * 0.9 });
            this._tone(ctx, t, { type: 'sine', f0: 360 * j, f1: 1800 * j, dur: d, vol: 0.07, attack: d * 0.9 });
        },
        laser_fire(ctx, t, o, j) {         // the beam going off: a hard buzz falling away
            this._tone(ctx, t, { type: 'sawtooth', f0: 700 * j, f1: 140, dur: 0.35, vol: 0.08 });
            this._noise(ctx, t, { filter: 'bandpass', f0: 1200, f1: 400, q: 1.2, dur: 0.3, vol: 0.18 });
        },
        portal(ctx, t, o, j) {             // a rift opening: a wavering whoosh and a hollow note (o.close: shutting, falling)
            const up = !o.close;
            this._noise(ctx, t, { filter: 'bandpass', f0: up ? 250 : 1100, f1: up ? 1100 : 250, q: 3, dur: 0.4, vol: 0.32, attack: 0.1 });
            this._tone(ctx, t, { type: 'sine', f0: (up ? 180 : 420) * j, f1: (up ? 420 : 160) * j, dur: 0.35, vol: 0.08 });
        },
        lob(ctx, t, o, j) {                // a mortar lobbing a shell: a hollow thoomp
            this._tone(ctx, t, { type: 'sine', f0: 210 * j, f1: 80, dur: 0.14, vol: 0.16 });
            this._noise(ctx, t, { filter: 'lowpass', f0: 900, f1: 200, dur: 0.12, vol: 0.1 });
        },
        pulse(ctx, t, o, j) {              // a wave going out from something: a deep swelling wub (o.heal: bright and rising instead)
            if (o.heal) {
                this._tone(ctx, t, { type: 'sine', f0: 440 * j, f1: 880 * j, dur: 0.35, vol: 0.06, attack: 0.05 });
                this._tone(ctx, t + 0.08, { type: 'sine', f0: 660 * j, f1: 1320 * j, dur: 0.3, vol: 0.04 });
                return;
            }
            this._tone(ctx, t, { type: 'sine', f0: 150 * j, f1: 60, dur: 0.45, vol: 0.18, attack: 0.04 });
            this._noise(ctx, t, { filter: 'lowpass', f0: 600, f1: 180, dur: 0.4, vol: 0.11, attack: 0.05 });
        },
        mine(ctx, t, o, j) {               // a void mine set down: a dark soft ping
            this._tone(ctx, t, { type: 'sine', f0: 230 * j, f1: 220 * j, dur: 0.4, vol: 0.08 });
            this._tone(ctx, t, { type: 'sine', f0: 345 * j, f1: 330 * j, dur: 0.3, vol: 0.04 });
        },
        spawn(ctx, t, o, j) {              // something appearing: a soft swirl and a pop
            if (this._rec(ctx, t, { name: 'magic_whoosh', rate: 1.35, vol: 0.2 })) return;
            this._noise(ctx, t, { filter: 'bandpass', f0: 400, f1: 1200, q: 2, dur: 0.18, vol: 0.12, attack: 0.08 });
            this._tone(ctx, t + 0.12, { type: 'sine', f0: 300 * j, f1: 600 * j, dur: 0.06, vol: 0.1 });
        },
        split(ctx, t, o, j) {              // a splitter coming apart: a wet tearing pop, two little ones after
            if (this._rec(ctx, t, { name: 'splat1', rate: 1.3, vol: 0.3 }, { name: 'splat2', rate: 1.6, vol: 0.2, at: 0.06 })) return;
            this._tone(ctx, t, { type: 'sine', f0: 380 * j, f1: 90, dur: 0.14, vol: 0.2 });
            this._bubbles(ctx, t + 0.05, { n: 2, spread: 0.08, f: 260, vol: 0.08 });
        },
        status(ctx, t, o, j) {             // a status catching you (o.kind root, poison, bleed, slow; anything else a daze wobble)
            const k = o.kind;
            if (k === 'root') { this._tone(ctx, t, { type: 'triangle', f0: 140, f1: 70, dur: 0.18, vol: 0.18 }); this._crackle(ctx, t + 0.04, { n: 5, spread: 0.2, f: 500, vol: 0.1 }); }
            else if (k === 'poison') { this._bubbles(ctx, t, { n: 4, spread: 0.2, f: 200, vol: 0.07 }); this._tone(ctx, t, { type: 'sawtooth', f0: 180, f1: 120, dur: 0.25, vol: 0.04 }); }
            else if (k === 'bleed') { this._noise(ctx, t, { filter: 'bandpass', f0: 900, f1: 400, q: 1.5, dur: 0.12, vol: 0.2 }); this._tone(ctx, t, { type: 'sine', f0: 200, f1: 90, dur: 0.15, vol: 0.12 }); }
            else if (k === 'slow') this._tone(ctx, t, { type: 'sine', f0: 600, f1: 200, dur: 0.35, vol: 0.07 });
            else if (k === 'glu') { this._tone(ctx, t, { type: 'sine', f0: 240, f1: 120, dur: 0.22, vol: 0.14 }); this._bubbles(ctx, t + 0.04, { n: 3, spread: 0.15, f: 160, vol: 0.07 }); }   // stuck: a thick squelch
            else { this._tone(ctx, t, { type: 'triangle', f0: 500, f1: 480, dur: 0.08, vol: 0.06 }); this._tone(ctx, t + 0.09, { type: 'triangle', f0: 420, f1: 400, dur: 0.08, vol: 0.05 }); }
        },
        rready(ctx, t, o, j) {             // a weapon's R ready: two quick notes up (o.el: warm for fire, glassy for ice)
            const [a, b, type] = o.el === 'fire' ? [392, 587, 'triangle'] : o.el === 'ice' ? [880, 1319, 'sine'] : [523, 784, 'triangle'];
            this._tone(ctx, t, { type, f0: a, dur: 0.09, vol: 0.07 });
            this._tone(ctx, t + 0.07, { type, f0: b, dur: 0.16, vol: 0.07 });
            if (o.el === 'ice') this._glass(ctx, t + 0.07, { n: 3, spread: 0.06, f: 2600, vol: 0.02, dur: 0.25 });
        },
        snap(ctx, t, o, j) {               // a finger snap (Fork's), ringing out
            if (!this._sample(ctx, t, { name: 'snap', vol: 1.5, space: 0.35 })) { this.SOUNDS.e_snap.call(this, ctx, t, o, j); return; }
            this._tone(ctx, t + 0.01, { type: 'sine', f0: 120, f1: 38, dur: 0.45, vol: 0.32 });   // the world dropping still under it
        },
        coin(ctx, t, o, j) {               // glorps: a coin landing in the purse, a purchase
            if (!this._sample(ctx, t, { name: 'coin', rate: 0.9 + Math.random() * 0.25, vol: 0.4 })) this.SOUNDS.pickup.call(this, ctx, t, o, j);
        },
        splash(ctx, t, o, j) {             // water: a step in it (soft), a body going in or a wave (o.big)
            if (this._sample(ctx, t, { name: o.big ? 'splash_big' : 'splash', rate: (o.big ? 0.85 : 1) * j * (0.92 + Math.random() * 0.16), vol: o.big ? 0.5 : o.soft ? 0.18 : 0.3 })) return;
            this._noise(ctx, t, { filter: 'lowpass', f0: o.big ? 1400 : 2000, f1: 300, dur: o.big ? 0.35 : 0.12, vol: o.big ? 0.22 : 0.1 });
            this._bubbles(ctx, t + 0.03, { n: o.big ? 5 : 2, spread: 0.2, f: 300, vol: 0.05 });
        },
        bubbles(ctx, t, o, j) {            // a rush of bubbles (going under)
            if (!this._sample(ctx, t, { name: 'bubbles', rate: j, vol: 0.3 })) this._bubbles(ctx, t, { n: 8, spread: 0.5, f: 260, vol: 0.06 });
        },
        // A hit on a boss: the element's hit with weight under it, the dull thud of a big body.
        bosshit(ctx, t, o, j) {
            this.SOUNDS.hit.call(this, ctx, t, o, j);
            this._tone(ctx, t, { type: 'sine', f0: 120 * j, f1: 55, dur: 0.12, vol: 0.1 });
            this._noise(ctx, t, { filter: 'lowpass', f0: 900, f1: 200, dur: 0.08, vol: 0.07 });
        },
        // A slime bursting: a wet pop and a falling thump.
        kill(ctx, t, o, j) {
            if (this._rec(ctx, t, { name: Math.random() < 0.5 ? 'splat1' : 'splat2', rate: 0.9 + Math.random() * 0.35, vol: 0.4 })) return;   // a slime bursting: a wet splat
            this._tone(ctx, t, { type: 'sine', f0: 420 * j, f1: 70, dur: 0.18, vol: 0.28 });
            this._noise(ctx, t, { filter: 'bandpass', f0: 1200 * j, f1: 250, q: 1.4, dur: 0.16, vol: 0.2 });
        },
        // You took a hit: a harsh low buzz.
        hurt(ctx, t, o, j) {
            if (this._rec(ctx, t, { name: 'squelch', rate: 0.95 + Math.random() * 0.15, vol: 0.5 })) return;
            this._tone(ctx, t, { type: 'square', f0: 240 * j, f1: 90, dur: 0.16, vol: 0.12 });
            this._noise(ctx, t, { filter: 'lowpass', f0: 900, f1: 150, dur: 0.14, vol: 0.2 });
        },
        // A dash, each element its own (o.el): a fire whoosh, a whoosh with ice cracking under it, an electric zap (the blink),
        // a magic whoosh (the cosmic hop); air rushing past when the recordings aren't in
        dash(ctx, t, o, j) {
            const r = 0.94 + Math.random() * 0.12;
            if (o.el === 'fire' ? this._sample(ctx, t, { name: 'fire_dash', rate: r * 1.08, vol: 0.27 })
                : o.el === 'ice' ? this._rec(ctx, t, { name: 'dash_whoosh', rate: r, vol: 0.3 }, { name: 'ice_dash', rate: r, vol: 0.28 })
                : o.el === 'cosmic' ? this._sample(ctx, t, { name: 'magic_whoosh', rate: r, vol: 0.45 })
                : this._sample(ctx, t, { name: 'dash_whoosh', rate: r, vol: 0.4 })) {
                if (o.el === 'lightning') this._sample(ctx, t + 0.02, { name: 'zap', rate: 1.5, vol: 0.12 });   // a tick of static on the whoosh, not a full zap
                return;
            }
            this._noise(ctx, t, { filter: 'bandpass', f0: 500 * j, f1: 2400 * j, q: 1.2, dur: 0.17, vol: 0.32, attack: 0.02 });
        },
        // The Frost Shield going up: an icy cast, crystal ringing round you.
        frost_shield(ctx, t, o, j) {
            if (!this._sample(ctx, t, { name: 'frost_shield', vol: 0.36 })) this.SOUNDS.freeze.call(this, ctx, t, o, j);
        },
        // A Cheerleader Slime's cheer: three shakes of its pompoms and a bright rising "yay" of notes.
        cheer(ctx, t, o, j) {
            for (let k = 0; k < 3; k++) this._noise(ctx, t + k * 0.09, { filter: 'bandpass', f0: 1100, f1: 1700, q: 1.4, dur: 0.07, vol: 0.13, attack: 0.008 });
            [523, 659, 784, 1047].forEach((f, k) => this._tone(ctx, t + 0.12 + k * 0.06, { type: 'triangle', f0: f * j, dur: 0.12, vol: 0.08 }));
            this._tone(ctx, t + 0.38, { type: 'sine', f0: 1568 * j, f1: 1760 * j, dur: 0.25, vol: 0.05 });
        },
        // Two quick notes, rising: the element changed.
        switch(ctx, t, o, j) {
            this._tone(ctx, t, { type: 'triangle', f0: 520, dur: 0.07, vol: 0.12 });
            this._tone(ctx, t + 0.06, { type: 'triangle', f0: 780, dur: 0.09, vol: 0.12 });
        },
        // An ult going off: a rising swell under a burst of air.
        ult(ctx, t, o, j) {
            this._tone(ctx, t, { type: 'sawtooth', f0: 110, f1: 440, dur: 0.38, vol: 0.09, attack: 0.05 });
            this._tone(ctx, t, { type: 'sine', f0: 220, f1: 880, dur: 0.4, vol: 0.12, attack: 0.05 });
            this._noise(ctx, t + 0.05, { filter: 'highpass', f0: 800, f1: 3000, dur: 0.4, vol: 0.12, attack: 0.08 });
        },
        // A glorp picked up: a bright chirp.
        pluck(ctx, t, o) {                 // a crop popping out of its mound: up a pentatonic step each (o.i), softer for sowing
            const st = [0, 2, 4, 7, 9, 12, 14, 16][Math.min(7, o.i || 0)], f = (o.soft ? 392 : 523) * Math.pow(2, st / 12), v = o.soft ? 0.5 : 1;
            this._noise(ctx, t, { filter: 'bandpass', f0: 900, dur: 0.03, vol: 0.07 * v });
            this._tone(ctx, t + 0.01, { type: 'triangle', f0: f, dur: 0.13, vol: 0.1 * v });
            this._tone(ctx, t + 0.01, { type: 'sine', f0: f * 2, dur: 0.08, vol: 0.04 * v });
        },
        pickup(ctx, t, o, j) {
            this._tone(ctx, t, { type: 'sine', f0: 900 * j, dur: 0.06, vol: 0.12 });
            this._tone(ctx, t + 0.05, { type: 'sine', f0: 1350 * j, dur: 0.09, vol: 0.12 });
        },
        // You died: everything falling away.
        death(ctx, t, o, j) {
            if (this._rec(ctx, t, { name: 'splat_big', rate: 0.8, vol: 0.6 }, { name: 'boom2', vol: 0.25, lp: 1500, at: 0.05 })) return;
            this._tone(ctx, t, { type: 'sawtooth', f0: 330, f1: 40, dur: 1.1, vol: 0.12, attack: 0.01 });
            this._tone(ctx, t, { type: 'sine', f0: 165, f1: 30, dur: 1.3, vol: 0.2 });
            this._noise(ctx, t, { filter: 'lowpass', f0: 1200, f1: 60, dur: 1.2, vol: 0.18 });
        },
        // ── WEAPONS (WeaponSystem.fireEquippedWeapon plays w_<id> whenever a weapon fires) ──
        w_flame_fists(ctx, t, o, j) {      // a punch that catches: thump, then a lick of flame
            if (this._rec(ctx, t, { name: 'punch', rate: 0.9 + Math.random() * 0.2, vol: 0.22 }, { name: 'fire_burst', rate: 1.5, vol: 0.12 })) return;
            this._tone(ctx, t, { type: 'triangle', f0: 180 * j, f1: 70, dur: 0.08, vol: 0.2 });
            this._noise(ctx, t + 0.01, { filter: 'bandpass', f0: 700 * j, f1: 1800, q: 0.7, dur: 0.14, vol: 0.16 });
        },
        w_flame_sword(ctx, t, o, j) {      // a swish through the air, sizzling
            if (this._rec(ctx, t, { name: 'sword', rate: 0.9 + Math.random() * 0.2, vol: 0.4 }, { name: 'fire_whoosh', rate: 1.5, vol: 0.18 })) return;
            this._noise(ctx, t, { filter: 'bandpass', f0: 600 * j, f1: 3200 * j, q: 2, dur: 0.16, vol: 0.26, attack: 0.02 });
            this._noise(ctx, t + 0.06, { filter: 'highpass', f0: 3000, f1: 5000, dur: 0.18, vol: 0.06 });
            this._tone(ctx, t, { type: 'sawtooth', f0: 300 * j, f1: 150, dur: 0.1, vol: 0.04 });
        },
        w_magma_staff(ctx, t, o, j) {      // a glob of lava flung: it pulls free with a gloopy blorp, heat breathing off it, a bubble popping
            if (this._rec(ctx, t, { name: 'fire_whoosh', rate: 1.6 + Math.random() * 0.2, vol: 0.3 }, { name: Math.random() < 0.5 ? 'lava_pop1' : 'lava_pop2', rate: 1.15, vol: 0.2 })) return;   // a lava bubble popping off the staff and a rush of heat (a pitched-down splat sounded like retching)
            this._tone(ctx, t, { type: 'sine', f0: 70 * j, f1: 150 * j, dur: 0.07, vol: 0.28, attack: 0.008 });
            this._tone(ctx, t + 0.06, { type: 'sine', f0: 150 * j, f1: 60, dur: 0.16, vol: 0.24 });
            this._noise(ctx, t, { filter: 'lowpass', f0: 500, f1: 1400, dur: 0.14, vol: 0.12, attack: 0.03 });
            this._bubbles(ctx, t + 0.05, { n: 2, spread: 0.12, f: 280, vol: 0.05 });
        },
        lava_splat(ctx, t, o, j) {         // a glob of lava landing: a wet slap, a hot rush, bubbles
            if (this._rec(ctx, t, { name: 'splat2', rate: 0.65 + Math.random() * 0.15, vol: 0.3 }, { name: 'sear', rate: 1.1, vol: 0.12, at: 0.03 })) return;
            this._noise(ctx, t, { filter: 'lowpass', f0: 1600 * j, f1: 250, dur: 0.12, vol: 0.18 });
            this._tone(ctx, t, { type: 'sine', f0: 110 * j, f1: 45, dur: 0.18, vol: 0.18 });
            this._noise(ctx, t + 0.04, { filter: 'bandpass', f0: 1200, f1: 700, q: 1, dur: 0.3, vol: 0.06, attack: 0.04 });
            this._bubbles(ctx, t + 0.05, { n: 3, spread: 0.3, f: 220, vol: 0.05 });
        },
        magma_surge(ctx, t, o, j) {        // the Surge: a deep whump, lava rolling out and bubbling, a long breath of heat (o.f: the heat spent, 0-1)
            if (this._rec(ctx, t, { name: 'lava_erupt', vol: 0.3 }, { name: 'slam', rate: 0.8, vol: 0.18, lp: 1200 }, { name: 'lava_pop1', rate: 0.8, vol: 0.25, at: 0.25 })) return;
            const f = o.f ?? 1, v = 0.6 + 0.4 * f;
            this._tone(ctx, t, { type: 'sine', f0: 90 * j, f1: 30, dur: 0.5, vol: 0.3 * v });
            this._noise(ctx, t, { filter: 'lowpass', f0: 2200, f1: 150, dur: 0.35, vol: 0.22 * v });
            this._noise(ctx, t + 0.05, { filter: 'lowpass', f0: 300, f1: 700, dur: 0.6 + 0.6 * f, vol: 0.16 * v, attack: 0.15 });   // rolling outward
            this._bubbles(ctx, t + 0.1, { n: 5 + Math.round(6 * f), spread: 0.5 + 0.6 * f, f: 200, vol: 0.05 });
            this._noise(ctx, t + 0.15, { filter: 'bandpass', f0: 1000, f1: 500, q: 0.8, dur: 0.8 + 0.5 * f, vol: 0.08, attack: 0.2 });
        },
        blip(ctx, t, o, j) {               // a few letters of NPC speech (o.v the speaker): a short soft beep, its pitch wandering
            const [f0, type, vol] = { glurp: [210, 'triangle', 0.07], glerp: [420, 'square', 0.03] }[o.v] || [330, 'square', 0.03];
            const f = f0 * j * (0.94 + Math.random() * 0.12);
            this._tone(ctx, t, { type, f0: f, f1: f * 0.97, dur: 0.045, vol, attack: 0.003 });
        },
        lava_pop(ctx, t, o, j) {           // a bubble bursting on the lava
            if (this._sample(ctx, t, { name: Math.random() < 0.5 ? 'lava_pop1' : 'lava_pop2', rate: 0.85 + Math.random() * 0.3, vol: 0.32 })) return;
            this._bubbles(ctx, t, { n: 2, spread: 0.08, f: 170, vol: 0.06 });
        },
        sear(ctx, t, o, j) {               // something standing in lava catching: a hot pop and a sizzle
            if (this._sample(ctx, t, { name: 'sear', rate: j, vol: 0.4 })) return;
            this._noise(ctx, t, { filter: 'bandpass', f0: 1400 * j, f1: 800, q: 1, dur: 0.25, vol: 0.24, attack: 0.01 });
            this._crackle(ctx, t, { n: 5, spread: 0.15, f: 900, vol: 0.14 });
        },
        flameburst(ctx, t, o, j) {         // the fire dash's path erupting: a burst of flame
            if (!this._sample(ctx, t, { name: 'fire_burst', rate: 0.92 + Math.random() * 0.16, vol: 0.45 })) this.SOUNDS.erupt.call(this, ctx, t, o, j);
        },
        // (Ignition has no w_ sound: its flame is LOOPS.flame, held while it burns)
        kindle_boom(ctx, t, o, j) {        // a kindled mark going up (G): a gassy whoomph and a crackle
            if (this._rec(ctx, t, { name: 'boom1', rate: 0.85, vol: 0.4, lp: 3500 }, { name: 'fire_burst', vol: 0.3 }, { name: 'crackle', rate: 1.1, vol: 0.25, at: 0.12 })) return;
            this._noise(ctx, t, { filter: 'lowpass', f0: 300, f1: 2600, dur: 0.12, vol: 0.2, attack: 0.04 });
            this._noise(ctx, t + 0.1, { filter: 'lowpass', f0: 2600, f1: 200, dur: 0.4, vol: 0.2 });
            this._tone(ctx, t + 0.05, { type: 'sine', f0: 130 * j, f1: 40, dur: 0.35, vol: 0.24 });
            if (!this._sample(ctx, t + 0.12, { name: 'crackle', rate: 1.1, vol: 0.3 })) this._crackle(ctx, t + 0.12, { n: 8, spread: 0.4, f: 1000, vol: 0.07 });
        },
        meteor_fall(ctx, t, o, j) {        // a meteor coming down (o.ms its fall): a whistle dropping, a fire roar swelling (o.small: a Meteor Strike one)
            if (this._rec(ctx, t, { name: 'fire_whoosh', rate: o.small ? 1.4 : 1.15, vol: o.small ? 0.15 : 0.32 })) return;
            const d = (o.ms || 520) / 1000, v = o.small ? 0.45 : 1;
            this._tone(ctx, t, { type: 'sine', f0: 1700 * j, f1: 500 * j, dur: d, vol: 0.1 * v, attack: d * 0.7 });
            this._noise(ctx, t, { filter: 'bandpass', f0: 1400, f1: 350, q: 1.2, dur: d, vol: 0.4 * v, attack: d * 0.8 });
        },
        meteor_hit(ctx, t, o, j) {         // it lands: a deep boom, the rock breaking up, flames crackling as it settles
            if (this._rec(ctx, t, { name: o.small ? 'boom1' : 'boom2', rate: 0.9 + Math.random() * 0.2, vol: o.small ? 0.3 : 0.5, lp: 4000 }, { name: 'crackle', rate: 0.9 + Math.random() * 0.2, vol: o.small ? 0.15 : 0.32, at: 0.15 })) return;
            const v = o.small ? 0.55 : 1;
            this._tone(ctx, t, { type: 'sine', f0: 95 * j, f1: 28, dur: 0.55, vol: 0.32 * v });
            this._noise(ctx, t, { filter: 'lowpass', f0: 3000, f1: 140, dur: 0.5, vol: 0.26 * v });
            this._crackle(ctx, t + 0.02, { n: 7, spread: 0.12, f: 700, vol: 0.14 * v, q: 1.2 });
            if (!this._sample(ctx, t + 0.15, { name: 'crackle', rate: 0.9 + Math.random() * 0.2, vol: 0.32 * v })) this._crackle(ctx, t + 0.15, { n: o.small ? 4 : 10, spread: 0.6, f: 1000, vol: 0.06 * v });
        },
        w_ice_fists(ctx, t, o, j) {        // a crisp crack of ice
            if (this._rec(ctx, t, { name: 'punch', rate: 0.9 + Math.random() * 0.2, vol: 0.22 }, { name: 'ice_crack', rate: 1.35, vol: 0.16 })) return;
            this._noise(ctx, t, { filter: 'highpass', f0: 3000, f1: 1500, dur: 0.05, vol: 0.14 });
            this._tone(ctx, t, { type: 'sine', f0: 2200 * j, f1: 1700, dur: 0.07, vol: 0.06 });
            this._tone(ctx, t, { type: 'triangle', f0: 200 * j, f1: 90, dur: 0.06, vol: 0.14 });
        },
        w_icicle_cannon(ctx, t, o, j) {    // a hollow thunk and a whistle away
            this._tone(ctx, t, { type: 'square', f0: 110 * j, f1: 55, dur: 0.1, vol: 0.12 });
            this._noise(ctx, t, { filter: 'lowpass', f0: 1200, f1: 200, dur: 0.1, vol: 0.2 });
            this._tone(ctx, t + 0.03, { type: 'sine', f0: 2600 * j, f1: 1400, dur: 0.22, vol: 0.05 });
        },
        w_fractal_shard(ctx, t, o, j) {    // a spray of glass chimes
            [1, 1.26, 1.5, 2].forEach((m, i) => this._tone(ctx, t + i * 0.025, { type: 'sine', f0: 1500 * m * j, dur: 0.18, vol: 0.045 }));
            this._noise(ctx, t, { filter: 'highpass', f0: 5000, dur: 0.08, vol: 0.06 });
        },
        w_lightning_fists(ctx, t, o, j) {  // a jab with a spark on it
            if (this._rec(ctx, t, { name: 'punch', rate: 0.9 + Math.random() * 0.2, vol: 0.22 }, { name: 'zap', rate: 1 + Math.random() * 0.4, vol: 0.18 })) return;
            this._tone(ctx, t, { type: 'square', f0: 1800 * j, f1: 400, dur: 0.05, vol: 0.06 });
            this._noise(ctx, t, { filter: 'bandpass', f0: 3500, q: 3, dur: 0.06, vol: 0.12 });
            this._tone(ctx, t, { type: 'triangle', f0: 190 * j, f1: 90, dur: 0.05, vol: 0.12 });
        },
        w_orb_emitter(ctx, t, o, j) {      // a tesla coil spinning up and spitting the orb out
            this._tone(ctx, t, { type: 'sawtooth', f0: 220 * j, f1: 880 * j, dur: 0.12, vol: 0.05, attack: 0.01 });
            this._tone(ctx, t + 0.02, { type: 'sine', f0: 1200 * j, f1: 2400 * j, dur: 0.08, vol: 0.06 });
            this._noise(ctx, t + 0.04, { filter: 'bandpass', f0: 4200 * j, f1: 2600, q: 2.5, dur: 0.09, vol: 0.1 });
        },
        // ── LIGHTNING ────────────────────────────────────────────────────────
        zap(ctx, t, o, j) {                // one fork: an electric zap (a recording, pitched about so a chain doesn't repeat itself)
            const v = o.soft ? 0.5 : 1;
            if (this._sample(ctx, t, { name: 'zap', rate: 0.8 + Math.random() * 0.5, vol: 0.14 * v })) return;
            this._noise(ctx, t, { filter: 'bandpass', f0: (3000 + Math.random() * 2500) * j, f1: 1800, q: 3, dur: 0.05, vol: 0.13 * v });
            this._tone(ctx, t, { type: 'square', f0: (900 + Math.random() * 900) * j, f1: 220, dur: 0.035, vol: 0.035 * v });
            this._noise(ctx, t + 0.02, { filter: 'highpass', f0: 6000, dur: 0.025, vol: 0.06 * v });
        },
        orbhit(ctx, t, o, j) {             // the orb striking: a bright snap and a short buzz
            this._noise(ctx, t, { filter: 'highpass', f0: 2500, f1: 5000, dur: 0.04, vol: 0.16 });
            this._tone(ctx, t, { type: 'sawtooth', f0: 160 * j, f1: 90, dur: 0.12, vol: 0.06 });
            this._tone(ctx, t, { type: 'square', f0: 2100 * j, f1: 600, dur: 0.05, vol: 0.04 });
        },
        blburst(ctx, t, o, j) {            // ball lightning letting go: a crackling spray
            this._noise(ctx, t, { filter: 'bandpass', f0: 1500 * j, f1: 5000, q: 1.2, dur: 0.3, vol: 0.18, attack: 0.01 });
            for (let i = 0; i < 5; i++) this._noise(ctx, t + 0.03 + i * 0.045 + Math.random() * 0.02, { filter: 'bandpass', f0: 2500 + Math.random() * 3000, q: 4, dur: 0.03, vol: 0.09 });
            this._tone(ctx, t, { type: 'sine', f0: 260 * j, f1: 70, dur: 0.25, vol: 0.14 });
        },
        w_ball_lightning(ctx, t, o, j) {   // a crackling hum swelling up
            this._tone(ctx, t, { type: 'sawtooth', f0: 80 * j, f1: 160, dur: 0.35, vol: 0.07, attack: 0.08 });
            for (let i = 0; i < 4; i++) this._noise(ctx, t + 0.05 + i * 0.06, { filter: 'bandpass', f0: 2500 + 1500 * Math.random(), q: 4, dur: 0.04, vol: 0.1 });
        },
        w_cosmic_fists(ctx, t, o, j) {     // a deep thud with a shimmer
            if (this._rec(ctx, t, { name: 'punch', rate: 0.85 + Math.random() * 0.1, vol: 0.24 }, { name: 'magic_whoosh', rate: 1.6, vol: 0.12 })) return;
            this._tone(ctx, t, { type: 'sine', f0: 130 * j, f1: 55, dur: 0.14, vol: 0.26 });
            this._tone(ctx, t + 0.02, { type: 'sine', f0: 1320 * j, f1: 990, dur: 0.16, vol: 0.04 });
        },
        w_barrier_staff(ctx, t, o, j) {    // wards raised: a bright two-note chime
            this._tone(ctx, t, { type: 'sine', f0: 880, dur: 0.3, vol: 0.08 });
            this._tone(ctx, t + 0.08, { type: 'sine', f0: 1320, dur: 0.4, vol: 0.07 });
            this._tone(ctx, t, { type: 'triangle', f0: 220, f1: 330, dur: 0.3, vol: 0.06, attack: 0.05 });
        },
        w_astrolabe(ctx, t, o, j) {        // starfall: a twinkling run downward
            [2093, 1760, 1568, 1319, 1175, 1047].forEach((f, i) => this._tone(ctx, t + i * 0.05, { type: 'sine', f0: f, dur: 0.22, vol: 0.05 }));
        },
        w_singularity_staff(ctx, t, o, j) { // the well opening: everything sucked down
            this._tone(ctx, t, { type: 'sine', f0: 600, f1: 50, dur: 0.6, vol: 0.18, attack: 0.02 });
            this._noise(ctx, t, { filter: 'bandpass', f0: 3000, f1: 200, q: 2, dur: 0.6, vol: 0.12, attack: 0.05 });
        },
        w_void_blade(ctx, t, o, j) {       // a dark slash
            if (this._rec(ctx, t, { name: 'sword', rate: 0.75 + Math.random() * 0.1, vol: 0.42 }, { name: 'magic_whoosh', rate: 0.9, vol: 0.18 })) return;
            this._noise(ctx, t, { filter: 'bandpass', f0: 400 * j, f1: 2000, q: 1.5, dur: 0.2, vol: 0.28, attack: 0.02 });
            this._tone(ctx, t, { type: 'sawtooth', f0: 110 * j, f1: 55, dur: 0.22, vol: 0.06 });
        },
        // ── THE FIGHT ──
        eshoot(ctx, t, o, j) {             // an enemy shot leaving: a low pew
            if (this._rec(ctx, t, { name: 'eshot', rate: 0.9 + Math.random() * 0.3, vol: 0.12 })) return;
            this._tone(ctx, t, { type: 'square', f0: 520 * j, f1: 180, dur: 0.09, vol: 0.035 });
        },
        block(ctx, t, o, j) {              // a ward eats a shot: glassy clang
            if (this._rec(ctx, t, { name: 'block', rate: 0.9 + Math.random() * 0.2, vol: 0.12 })) return;
            this._tone(ctx, t, { type: 'triangle', f0: 1200 * j, f1: 900, dur: 0.18, vol: 0.1 });
            this._tone(ctx, t, { type: 'sine', f0: 1800 * j, dur: 0.25, vol: 0.05 });
            this._noise(ctx, t, { filter: 'highpass', f0: 4000, dur: 0.05, vol: 0.08 });
        },
        clink(ctx, t, o, j) {              // a hit glancing off a resistance
            if (this._rec(ctx, t, { name: 'block', rate: 1.5 + Math.random() * 0.3, vol: 0.07 })) return;
            this._tone(ctx, t, { type: 'square', f0: 2400 * j, f1: 2000, dur: 0.05, vol: 0.03 });
            this._tone(ctx, t, { type: 'sine', f0: 3100 * j, dur: 0.09, vol: 0.03 });
        },
        boom(ctx, t, o, j) {               // an explosion: gadgets, collapses, bursts
            if (this._rec(ctx, t, { name: o.big ? 'boom2' : 'boom1', rate: 0.9 + Math.random() * 0.2, vol: o.big ? 0.4 : 0.32, lp: 4000 })) return;
            const big = o.big ? 1.6 : 1;
            this._tone(ctx, t, { type: 'sine', f0: 120 * j, f1: 35, dur: 0.35 * big, vol: 0.3 });
            this._noise(ctx, t, { filter: 'lowpass', f0: 2500, f1: 120, dur: 0.4 * big, vol: 0.26 });
        },
        freeze(ctx, t, o, j) {             // ice closing over something: frost crackling across it, then a glassy set
            if (!this._sample(ctx, t, { name: 'ice_crack', rate: 1.1 * j, vol: 0.32 })) this._crackle(ctx, t, { n: 10, spread: 0.18, f: 2200, vol: 0.12, q: 1.5 });
            this._tone(ctx, t + 0.12, { type: 'sine', f0: 2600 * j, f1: 2500 * j, dur: 0.3, vol: 0.05 });
            this._tone(ctx, t + 0.12, { type: 'sine', f0: 3900 * j, dur: 0.2, vol: 0.02 });
        },
        shatter(ctx, t, o, j) {            // ice breaking apart: a hard crack, shards ringing out, a scatter of pieces
            if (!this._sample(ctx, t, { name: 'ice_crack2', rate: j, vol: 0.5 })) this._noise(ctx, t, { filter: 'bandpass', f0: 1800, f1: 900, q: 1, dur: 0.06, vol: 0.22 });
            this._tone(ctx, t, { type: 'triangle', f0: 260 * j, f1: 120, dur: 0.08, vol: 0.16 });
            this._glass(ctx, t + 0.01, { n: 7, spread: 0.06, f: 2600 * j, vol: 0.035, dur: 0.3 });
            this._crackle(ctx, t + 0.06, { n: 6, spread: 0.25, f: 1800, vol: 0.06 });
        },
        blizzard(ctx, t, o, j) {           // the Blizzard: a gust howling in, frost cracking over the screen, a shimmer of snow
            if (this._rec(ctx, t, { name: 'wind', vol: 0.55 }, { name: 'ice_crack', rate: 0.9, vol: 0.3, at: 0.15 }, { name: 'ice_crack2', rate: 1.1, vol: 0.25, at: 0.45 })) return;
            for (const [f0, f1, q, v] of [[300, 900, 6, 1.0], [500, 1400, 8, 0.55]]) this._noise(ctx, t, { filter: 'bandpass', f0, f1, q, dur: 1.6, vol: v, attack: 0.5 });
            this._noise(ctx, t, { filter: 'lowpass', f0: 400, f1: 200, dur: 1.4, vol: 0.5, attack: 0.3 });
            this._crackle(ctx, t + 0.1, { n: 14, spread: 0.5, f: 2000, vol: 0.1, q: 1.5 });
            this._glass(ctx, t + 0.4, { n: 8, spread: 0.8, f: 3200, vol: 0.04, dur: 0.5 });
        },
        gale(ctx, t, o, j) {               // a gale spinning up: wind whirling up and away
            if (this._rec(ctx, t, { name: 'gust', rate: 0.9 + Math.random() * 0.25, vol: 0.3 })) return;
            this._noise(ctx, t, { filter: 'bandpass', f0: 250 * j, f1: 1100 * j, q: 4, dur: 0.6, vol: 0.5, attack: 0.25 });
            this._noise(ctx, t + 0.2, { filter: 'bandpass', f0: 1100 * j, f1: 350 * j, q: 4, dur: 0.7, vol: 0.4, attack: 0.15 });
        },
        e_crack(ctx, t, o, j) {            // a Geode plate cracking: a sharp rock crack, gravel trickling
            this._noise(ctx, t, { filter: 'bandpass', f0: 1200, f1: 500, q: 1, dur: 0.05, vol: 0.24 });
            this._tone(ctx, t, { type: 'triangle', f0: 160 * j, f1: 70, dur: 0.1, vol: 0.16 });
            this._crackle(ctx, t + 0.03, { n: 8, spread: 0.3, f: 700, vol: 0.07 });
        },
        heal(ctx, t, o, j) {                     // a warm rising sparkle
            if (this._rec(ctx, t, { name: 'potion', vol: 0.5 })) return;
            [523, 659, 784].forEach((f, i) => this._tone(ctx, t + i * 0.06, { type: 'sine', f0: f, dur: 0.22, vol: 0.06 }));
        },
        pop(ctx, t, o, j) {                // something soft popping (the decoy, a voidlet)
            this._tone(ctx, t, { type: 'sine', f0: 700 * j, f1: 200, dur: 0.1, vol: 0.14 });
        },
        gadget(ctx, t, o, j) {             // a gadget thrown
            this._noise(ctx, t, { filter: 'bandpass', f0: 900 * j, f1: 1800, q: 1.5, dur: 0.12, vol: 0.12, attack: 0.02 });
            this._tone(ctx, t, { type: 'triangle', f0: 400 * j, f1: 600, dur: 0.08, vol: 0.06 });
        },
        // ── MOMENTS ──
        ready(ctx, t, o, j) {                 // an ult gem filled
            if (this._rec(ctx, t, { name: 'powerup', vol: 0.16 })) return;
            this._tone(ctx, t, { type: 'triangle', f0: 1046, dur: 0.12, vol: 0.06 });
            this._tone(ctx, t + 0.09, { type: 'triangle', f0: 1568, dur: 0.2, vol: 0.06 });
        },
        deny(ctx, t, o, j) {                     // nope
            if (this._rec(ctx, t, { name: 'buzz', vol: 0.13 })) return;
            this._tone(ctx, t, { type: 'square', f0: 140, dur: 0.08, vol: 0.06 });
            this._tone(ctx, t + 0.09, { type: 'square', f0: 110, dur: 0.1, vol: 0.06 });
        },
        chest(ctx, t, o, j) {                    // a lid creaking open, then the sparkle
            if (this._rec(ctx, t, { name: 'chest_open', vol: 0.5 })) { this._tone(ctx, t + 0.5, { type: 'sine', f0: 1320, dur: 0.3, vol: 0.04 }); this._tone(ctx, t + 0.58, { type: 'sine', f0: 1760, dur: 0.35, vol: 0.035 }); return; }   // (and a little sparkle)
            this._noise(ctx, t, { filter: 'bandpass', f0: 300, f1: 700, q: 5, dur: 0.25, vol: 0.12, attack: 0.05 });
            [784, 988, 1175, 1568].forEach((f, i) => this._tone(ctx, t + 0.22 + i * 0.07, { type: 'sine', f0: f, dur: 0.3, vol: 0.06 }));
        },
        clear(ctx, t, o, j) {                    // a room cleared: doors grinding open
            if (this._rec(ctx, t, { name: 'door', vol: 0.45, lp: 5000 })) return;
            this._noise(ctx, t, { filter: 'lowpass', f0: 400, f1: 150, dur: 0.5, vol: 0.18, attack: 0.05 });
            this._tone(ctx, t + 0.1, { type: 'triangle', f0: 392, dur: 0.15, vol: 0.07 });
            this._tone(ctx, t + 0.22, { type: 'triangle', f0: 523, dur: 0.3, vol: 0.07 });
        },
        // ── THE ENCHANTER'S ISLE ──
        e_chain(ctx, t) {                  // chains straining: links rattling against each other
            for (let k = 0; k < 6; k++) { const d = k * 0.045 + Math.random() * 0.02; this._noise(ctx, t + d, { filter: 'bandpass', f0: 3800 + Math.random() * 2400, q: 9, dur: 0.05, vol: 0.09 }); this._tone(ctx, t + d, { type: 'square', f0: 1700 + Math.random() * 600, dur: 0.025, vol: 0.02 }); }
        },
        e_heart(ctx, t, o) {               // a heartbeat, low and felt: lub-dub, louder as it builds (o.v 0..1)
            const v = 0.18 + 0.2 * (o.v || 0);
            this._tone(ctx, t, { type: 'sine', f0: 70, f1: 38, dur: 0.16, vol: v });
            this._tone(ctx, t + 0.17, { type: 'sine', f0: 62, f1: 34, dur: 0.2, vol: v * 0.8 });
            this._noise(ctx, t, { filter: 'lowpass', f0: 220, dur: 0.1, vol: v * 0.4 });
        },
        e_thunder(ctx, t) {                // lightning on the altar: a sharp crack, then a rolling rumble
            this._noise(ctx, t, { filter: 'highpass', f0: 3000, f1: 900, dur: 0.12, vol: 0.32 });
            this._noise(ctx, t + 0.05, { filter: 'lowpass', f0: 600, f1: 90, dur: 1.1, vol: 0.28, space: true });
            this._tone(ctx, t + 0.04, { type: 'triangle', f0: 90, f1: 30, dur: 0.8, vol: 0.18 });
        },
        e_snap(ctx, t) {                   // the chains snap: a crack, a thump, a ring
            this._noise(ctx, t, { filter: 'highpass', f0: 2500, f1: 800, dur: 0.22, vol: 0.28 });
            this._tone(ctx, t, { type: 'triangle', f0: 140, f1: 45, dur: 0.35, vol: 0.3 });
            this._bell(ctx, t + 0.03, { f: 1400, dur: 0.9, vol: 0.04 });
        },
        e_beam(ctx, t) {                   // light pouring down: a swell rising into a shimmer
            this._noise(ctx, t, { filter: 'bandpass', f0: 400, f1: 4200, q: 1.5, dur: 0.9, vol: 0.12, attack: 0.6, space: true });
            [220, 330, 440].forEach((f, i) => this._tone(ctx, t, { type: 'sine', f0: f, f1: f * 2, dur: 0.95, vol: 0.05, attack: 0.7 - i * 0.1, space: true }));
        },
        e_burst(ctx, t) {                  // the book bursts open
            this._noise(ctx, t, { filter: 'lowpass', f0: 5000, f1: 300, dur: 0.5, vol: 0.25 });
            this._tone(ctx, t, { type: 'sine', f0: 180, f1: 60, dur: 0.4, vol: 0.3 });
            [1046, 1318, 1568, 2093].forEach((f, i) => this._bell(ctx, t + 0.05 + i * 0.05, { f, dur: 0.8, vol: 0.025 }));
        },
        e_tick(ctx, t, o) {                // a card ticking past an enchant: higher as it slows
            const p = o.p || 0;
            this._tone(ctx, t, { type: 'triangle', f0: 520 + 700 * p, dur: 0.05, vol: 0.06 });
            this._noise(ctx, t, { filter: 'highpass', f0: 3000, dur: 0.02, vol: 0.05 });
        },
        e_flip(ctx, t, o, j) {             // a card turning over, a page of the diary: paper
            if (this._sample(ctx, t, { name: 'page', rate: 0.9 + Math.random() * 0.2, vol: 0.35 })) return;
            this._noise(ctx, t, { filter: 'bandpass', f0: 1200, f1: 3200, q: 2, dur: 0.12, vol: 0.12 });
        },
        // the hush before a big one lands: a riser, longer and wider the rarer it is
        e_riser(ctx, t, o) {
            const r = o.r || 3, d = 0.8 + (r - 3) * 0.5;
            this._noise(ctx, t, { filter: 'bandpass', f0: 250, f1: 6000, q: 2, dur: d, vol: 0.14, attack: d * 0.85, space: true });
            this._tone(ctx, t, { type: 'sawtooth', f0: 110, f1: 440, dur: d, vol: 0.045, attack: d * 0.85 });
            if (r >= 4) this._tone(ctx, t, { type: 'sawtooth', f0: 113, f1: 452, dur: d, vol: 0.04, attack: d * 0.85 });
            for (let k = 0; k < 6 + r * 2; k++) this._tone(ctx, t + d * k / (6 + r * 2), { type: 'square', f0: 300 + k * 60, dur: 0.03, vol: 0.02 });   // a heartbeat of ticks speeding up
        },
        // a book landing, by rarity: a chime, a pair, an arpeggio, a chord with a boom, a choir, a glitch
        e_land(ctx, t, o) {
            const r = o.r || 0;
            if (r === 5) {   // corrupted: a low drone, a falling tritone, static
                this._tone(ctx, t, { type: 'sawtooth', f0: 55, f1: 41, dur: 1.8, vol: 0.12, attack: 0.02 });
                [[466, 0], [330, 0.18], [233, 0.36], [165, 0.54]].forEach(([f, d]) => this._tone(ctx, t + d, { type: 'square', f0: f, f1: f * 0.97, dur: 0.3, vol: 0.05 }));
                for (let k = 0; k < 10; k++) this._noise(ctx, t + Math.random() * 1.2, { filter: 'bandpass', f0: 500 + Math.random() * 5000, q: 6, dur: 0.04, vol: 0.12 });
                this._bell(ctx, t + 0.8, { f: 311, dur: 2.2, vol: 0.06, ratio: 1.41, depth: 4 });
                return;
            }
            if (r >= 3) { this._tone(ctx, t, { type: 'sine', f0: 110, f1: 38, dur: 0.6, vol: 0.4 }); this._noise(ctx, t, { filter: 'lowpass', f0: 1800, f1: 200, dur: 0.8, vol: 0.18 }); }
            const chords = [[880], [880, 1318], [659, 880, 1108, 1318], [523, 659, 784, 1046, 1318, 1568], [440, 554, 659, 880, 1108, 1318, 1760]];
            chords[Math.min(4, r)].forEach((f, i) => this._bell(ctx, t + i * (r >= 3 ? 0.07 : 0.06), { f, dur: 0.9 + r * 0.3, vol: 0.05 - Math.min(0.02, r * 0.004) }));
            if (r >= 3) [523, 659, 784].forEach(f => this._tone(ctx, t + 0.05, { type: 'triangle', f0: f, dur: 1.6, vol: 0.05, attack: 0.05, space: true }));
            if (r === 4) [220, 277, 330, 440].forEach((f, i) => { this._tone(ctx, t, { type: 'sawtooth', f0: f, dur: 2.4, vol: 0.022, attack: 0.25, space: true }); this._tone(ctx, t, { type: 'sawtooth', f0: f * 1.006, dur: 2.4, vol: 0.022, attack: 0.25 }); });   // a choir
            if (r >= 2) this._noise(ctx, t, { filter: 'highpass', f0: 6000, dur: 0.9 + r * 0.2, vol: 0.05, attack: 0.05, space: true });   // shimmer
        },
        e_quality(ctx, t) {                // a Pristine or Perfect roll: a bright double ding
            this._bell(ctx, t, { f: 1568, dur: 0.6, vol: 0.05 }); this._bell(ctx, t + 0.09, { f: 2093, dur: 0.9, vol: 0.05 });
        },
        e_dip(ctx, t, o) {                 // a book going into the crucible: a thick bloop and a fizz
            this._tone(ctx, t, { type: 'sine', f0: o.big ? 220 : 300, f1: 90, dur: 0.22, vol: o.big ? 0.3 : 0.2 });
            this._noise(ctx, t + 0.04, { filter: 'bandpass', f0: 2500, f1: 900, q: 2, dur: 0.35, vol: 0.12 });
            for (let k = 0; k < 4; k++) this._tone(ctx, t + 0.08 + k * 0.06, { type: 'sine', f0: 600 + Math.random() * 500, f1: 900, dur: 0.06, vol: 0.04 });
        },
        // a reforged quality landing, by the threshold it reached: a dull thud, a chime, a bright arpeggio,
        // a gold fanfare with a boom, then for a Perfect the whole choir
        e_qland(ctx, t, o) {
            const g = o.g || 0;
            if (g === 0) { this._tone(ctx, t, { type: 'triangle', f0: 180, f1: 90, dur: 0.4, vol: 0.2 }); return; }
            const notes = [[], [784], [659, 880, 1108], [523, 659, 784, 1046, 1318], [523, 659, 784, 1046, 1318, 1568, 2093]][g];
            notes.forEach((f, i) => this._bell(ctx, t + i * 0.06, { f, dur: 0.8 + g * 0.3, vol: 0.05 }));
            if (g >= 3) { this._tone(ctx, t, { type: 'sine', f0: 110, f1: 40, dur: 0.6, vol: 0.4 }); this._noise(ctx, t, { filter: 'lowpass', f0: 1800, f1: 200, dur: 0.7, vol: 0.16 }); }
            if (g === 4) [262, 330, 392, 523].forEach(f => { this._tone(ctx, t, { type: 'sawtooth', f0: f, dur: 2.4, vol: 0.022, attack: 0.25, space: true }); this._tone(ctx, t, { type: 'sawtooth', f0: f * 1.006, dur: 2.4, vol: 0.022, attack: 0.25 }); });
            if (g >= 2) this._noise(ctx, t, { filter: 'highpass', f0: 6000, dur: 0.8 + g * 0.2, vol: 0.05, attack: 0.05, space: true });
        },
        e_absorb(ctx, t) {                 // the number drawn down into the book: a rising whoosh that snaps shut
            this._noise(ctx, t, { filter: 'bandpass', f0: 300, f1: 4000, q: 2, dur: 0.6, vol: 0.12, attack: 0.5 });
            this._tone(ctx, t + 0.62, { type: 'triangle', f0: 880, f1: 1320, dur: 0.15, vol: 0.12 });
        },
        e_seal(ctx, t) {                   // a padlock snapping shut on a book: a heavy clunk, a low note sinking
            this._noise(ctx, t, { filter: 'bandpass', f0: 1800, q: 4, dur: 0.06, vol: 0.25 });
            this._tone(ctx, t, { type: 'triangle', f0: 160, f1: 60, dur: 0.3, vol: 0.3 });
            this._tone(ctx, t + 0.05, { type: 'sine', f0: 330, f1: 220, dur: 1.2, vol: 0.06, attack: 0.05, space: true });
        },
        e_bind(ctx, t) {                   // a book binding into a weapon: a thrum that rises and locks
            this._tone(ctx, t, { type: 'sine', f0: 110, f1: 220, dur: 0.7, vol: 0.22, attack: 0.25 });
            this._noise(ctx, t, { filter: 'bandpass', f0: 500, f1: 3000, q: 3, dur: 0.6, vol: 0.1, attack: 0.4, space: true });
            this._tone(ctx, t + 0.6, { type: 'triangle', f0: 220, f1: 110, dur: 0.15, vol: 0.2 });
            [659, 988, 1318].forEach((f, i) => this._bell(ctx, t + 0.62 + i * 0.06, { f, dur: 1.0, vol: 0.04 }));
        },
        e_reforge(ctx, t, o) {             // the reel stopping: up a scale if it went up, down if it fell
            const d = o.d || 0;
            if (d > 0) { [659, 784, 988, 1318].slice(0, d > 30 ? 4 : d > 10 ? 3 : 2).forEach((f, i) => this._bell(ctx, t + i * 0.07, { f, dur: 0.8, vol: 0.045 })); if (o.q >= 85) this._noise(ctx, t, { filter: 'highpass', f0: 6000, dur: 1.0, vol: 0.06, space: true }); }
            else if (d < 0) { this._tone(ctx, t, { type: 'triangle', f0: 392, f1: 196, dur: 0.5, vol: 0.12 }); this._tone(ctx, t + 0.12, { type: 'triangle', f0: 311, f1: 155, dur: 0.5, vol: 0.1 }); }
            else this._tone(ctx, t, { type: 'triangle', f0: 440, dur: 0.12, vol: 0.08 });
        },
        e_combine(ctx, t) {                // two books into one: two notes sliding together into a chord
            this._tone(ctx, t, { type: 'sine', f0: 523, f1: 784, dur: 0.4, vol: 0.08 }); this._tone(ctx, t, { type: 'sine', f0: 1046, f1: 784, dur: 0.4, vol: 0.06 });
            [784, 988, 1175, 1568].forEach((f, i) => this._bell(ctx, t + 0.4 + i * 0.04, { f, dur: 1.0, vol: 0.04 }));
        },
        e_salvage(ctx, t) {                // ground to dust: a crumble and a few motes
            this._noise(ctx, t, { filter: 'lowpass', f0: 3200, f1: 250, dur: 0.6, vol: 0.2 });
            for (let k = 0; k < 5; k++) this._tone(ctx, t + 0.2 + k * 0.08, { type: 'sine', f0: 2000 + Math.random() * 1500, dur: 0.12, vol: 0.025 });
        },
        fanfare(ctx, t) {                  // the level is yours
            [[523, 0], [659, 0.12], [784, 0.24], [1046, 0.4]].forEach(([f, d]) => {
                this._tone(ctx, t + d, { type: 'square', f0: f, dur: d === 0.4 ? 0.7 : 0.14, vol: 0.05 });
                this._tone(ctx, t + d, { type: 'triangle', f0: f / 2, dur: d === 0.4 ? 0.7 : 0.14, vol: 0.08 });
            });
        },
        roar(ctx, t, o, j) {               // a boss wakes up (o.big: the long roar), or a creature rears up
            if (this._sample(ctx, t, { name: o.big ? 'roar_big' : 'roar', rate: (o.big ? 0.9 : 1) * (1 + (j - 1) * 0.5), vol: o.big ? 0.55 : 0.45, space: 0.25 })) return;
            this._tone(ctx, t, { type: 'sawtooth', f0: 70, f1: 45, dur: 1.0, vol: 0.14, attack: 0.1 });
            this._noise(ctx, t, { filter: 'lowpass', f0: 900, f1: 200, dur: 1.0, vol: 0.2, attack: 0.15 });
        },
        bossdie(ctx, t) {                  // a boss down: its dying breath (or a long collapse), then a chime
            if (!this._sample(ctx, t, { name: 'bossdie', vol: 0.25, space: 0.3 })) {
                this._tone(ctx, t, { type: 'sine', f0: 200, f1: 30, dur: 1.4, vol: 0.28 });
                this._noise(ctx, t, { filter: 'lowpass', f0: 3000, f1: 80, dur: 1.4, vol: 0.24 });
            }
            [523, 784, 1046].forEach((f, i) => this._tone(ctx, t + 1 + i * 0.1, { type: 'sine', f0: f, dur: 0.6, vol: 0.06 }));
        },
        fragment(ctx, t) {                 // fragments earned: crystal shimmer
            [1319, 1760, 2093, 2637].forEach((f, i) => this._tone(ctx, t + i * 0.05, { type: 'sine', f0: f, dur: 0.35, vol: 0.05 }));
        },
        whoosh(ctx, t, o, j) {             // a transition, a rift
            this._noise(ctx, t, { filter: 'bandpass', f0: 300, f1: 2500, q: 0.8, dur: 0.45, vol: 0.18, attack: 0.15 });
        },
        // ── COSMIC: ethereal, ringing, and with weight under it ──
        fissure(ctx, t, o, j) {            // stone splitting: a dry crack, a crackle running off it, a low groan under
            this._noise(ctx, t, { filter: 'highpass', f0: 2500, f1: 900, dur: 0.06, vol: 0.18 });
            for (let k = 1; k < 4; k++) this._noise(ctx, t + k * 0.035 + Math.random() * 0.02, { filter: 'bandpass', f0: 1800 / k, f1: 600, q: 2, dur: 0.04, vol: 0.08 });
            this._tone(ctx, t, { type: 'sawtooth', f0: 70 * j, f1: 45 * j, dur: 0.5, vol: 0.05, attack: 0.08 });
        },
        erupt(ctx, t, o, j) {              // the fissure bursting: a deep thump, a roar of fire, a hiss trailing off
            this._tone(ctx, t, { type: 'sine', f0: 110 * j, f1: 40, dur: 0.35, vol: 0.22 });
            this._noise(ctx, t, { filter: 'lowpass', f0: 1800, f1: 300, dur: 0.45, vol: 0.2 });
            this._noise(ctx, t + 0.08, { filter: 'highpass', f0: 3000, f1: 6000, dur: 0.5, vol: 0.05, attack: 0.1 });
        },
        ignite(ctx, t, o, j) {             // a burn stack catching: a soft whoosh of flame and a crackle
            this._noise(ctx, t, { filter: 'lowpass', f0: 2200 * j, f1: 500, dur: 0.16, vol: 0.07, attack: 0.02 });
            this._noise(ctx, t + 0.03, { filter: 'highpass', f0: 3500, f1: 6000, dur: 0.12, vol: 0.025 });
        },
        sburn(ctx, t, o, j) {              // a Super Burn stack: deeper, a thump under a roar
            this._tone(ctx, t, { type: 'sine', f0: 140 * j, f1: 60, dur: 0.18, vol: 0.09 });
            this._noise(ctx, t, { filter: 'lowpass', f0: 1600 * j, f1: 300, dur: 0.28, vol: 0.11, attack: 0.03 });
            this._noise(ctx, t + 0.05, { filter: 'highpass', f0: 3000, f1: 5500, dur: 0.2, vol: 0.03 });
        },
        laugh(ctx, t, o, j) {              // the fire ult: a recorded laugh (assets/sfx), pitched down and gritty, ringing out, over a rumble
            const L = { rate: 0.7, vol: 0.27, grit: 0.35, double: 0.6, growl: 0.5, space: 0.45 };   // the knobs: rate under 1 is deeper and slower
            if (!this._sample(ctx, t, { name: 'evil_laugh', ...L, rate: L.rate * (1 + (j - 1) * 0.5) }))   // (half the usual pitch jitter)
            [[0, 230, 190, 0.11], [0.2, 215, 175, 0.11], [0.42, 250, 150, 0.22]].forEach(([dt, f0, f1, dur], i) => {   // not loaded: the synth laugh, "ha... ha... HA"
                this._tone(ctx, t + dt, { type: 'sawtooth', f0, f1, dur, vol: 0.09 + i * 0.02, attack: 0.01 });
                this._tone(ctx, t + dt, { type: 'square', f0: f0 * 2.02, f1: f1 * 2.02, dur: dur * 0.8, vol: 0.025 });
                this._noise(ctx, t + dt, { filter: 'bandpass', f0: 900, f1: 600, q: 1.5, dur: 0.05, vol: 0.06 });
            });
            this._tone(ctx, t, { type: 'sine', f0: 70, f1: 40, dur: 1.1, vol: 0.18 });
            this._noise(ctx, t + 0.3, { filter: 'lowpass', f0: 600, f1: 120, dur: 0.9, vol: 0.12 });
        },
        astropop(ctx, t, o, j) {           // an astral mark popped: a gold bell a step higher each pop in a chain, a shimmer, a soft thump
            const SC = [0, 2, 4, 7, 9], n = o.n || 0, f = 1046.5 * Math.pow(2, (SC[n % 5] + 12 * Math.min(1, Math.floor(n / 5))) / 12);
            this._bell(ctx, t, { f, dur: 0.8, vol: 0.06, ratio: 3.0, depth: 1.6 });
            this._bell(ctx, t + 0.04, { f: f * 1.5, dur: 0.5, vol: 0.025, ratio: 2.4, depth: 1.2 });
            this._noise(ctx, t, { filter: 'highpass', f0: 5000, f1: 9000, dur: 0.18, vol: 0.05 });
            this._tone(ctx, t, { type: 'sine', f0: 160, f1: 70, dur: 0.18, vol: 0.09 });
        },
        csplace(ctx, t, o, j) {            // an object set in place: a soft struck bell
            this._bell(ctx, t, { f: (o.gold ? 1318 : 988) * j, dur: 0.9, vol: 0.045 });
            this._tone(ctx, t, { type: 'sine', f0: 220 * j, f1: 330 * j, dur: 0.25, vol: 0.05, attack: 0.03, space: true });
        },
        cslaunch(ctx, t, o, j) {           // the pair let go: a shimmering rush rising
            this._noise(ctx, t, { filter: 'bandpass', f0: 300, f1: 4200, q: 2.5, dur: 0.55, vol: 0.12, attack: 0.18, space: true });
            this._tone(ctx, t, { type: 'sine', f0: 330, f1: 1320, dur: 0.5, vol: 0.05, attack: 0.15, space: true });
            this._tone(ctx, t, { type: 'triangle', f0: 335, f1: 1335, dur: 0.5, vol: 0.03, attack: 0.15 });
        },
        cspierce(ctx, t, o, j) {           // passing through something: a glassy tick
            this._bell(ctx, t, { f: 2349 * j, dur: 0.25, vol: 0.025, ratio: 3.1, depth: 1 });
        },
        collapse(ctx, t, o, j) {           // the objects meeting: a deep implosion, then a chord rings out
            const big = o.big ? 1.4 : 1;
            this._tone(ctx, t, { type: 'sine', f0: 160, f1: 34, dur: 0.9 * big, vol: 0.42 });              // the weight
            this._tone(ctx, t, { type: 'triangle', f0: 82, f1: 41, dur: 0.6 * big, vol: 0.2 });
            this._noise(ctx, t, { filter: 'lowpass', f0: 1800, f1: 70, dur: 0.7 * big, vol: 0.26, space: true });
            this._noise(ctx, t, { filter: 'highpass', f0: 6000, f1: 2500, dur: 0.3, vol: 0.06, space: true });   // the crack of it
            const chord = o.gold ? [523, 659, 784, 1046] : [440, 554, 659, 880];
            chord.forEach((f, i) => this._bell(ctx, t + 0.04 + i * 0.03, { f: f * j, dur: 1.6 * big, vol: 0.035 }));
        },
        cslam(ctx, t, o) {                 // the rift slam: a sub drop and a vast ringing gong
            this._tone(ctx, t, { type: 'sine', f0: 120, f1: 28, dur: 1.3, vol: 0.5 });
            this._noise(ctx, t, { filter: 'lowpass', f0: 2500, f1: 50, dur: 1.0, vol: 0.32, space: true });
            this._bell(ctx, t, { f: 110, dur: 2.4, vol: 0.09, ratio: 1.41, depth: 3 });
            this._bell(ctx, t + 0.02, { f: o.gold ? 660 : 523, dur: 1.8, vol: 0.04 });
        },
        csbeam(ctx, t, o, j) {             // a voidbeam: a thin singing ray
            this._tone(ctx, t, { type: 'sine', f0: 1760 * j, f1: 1320 * j, dur: 0.22, vol: 0.035, space: true });
            this._tone(ctx, t, { type: 'square', f0: 880 * j, f1: 660 * j, dur: 0.12, vol: 0.012 });
        },
        csrift(ctx, t) {                   // the portal opening
            this._noise(ctx, t, { filter: 'bandpass', f0: 2500, f1: 200, q: 3, dur: 0.8, vol: 0.14, attack: 0.05, space: true });
            this._tone(ctx, t, { type: 'sine', f0: 880, f1: 110, dur: 0.8, vol: 0.06, space: true });
        },
        ascendant(ctx, t) {                // the full transformation: a drop, a choir, a cymbal swell
            this._tone(ctx, t, { type: 'sine', f0: 90, f1: 28, dur: 1.6, vol: 0.4 });
            this._noise(ctx, t, { filter: 'lowpass', f0: 4000, f1: 60, dur: 1.2, vol: 0.3 });
            [262, 330, 392, 523, 659, 784].forEach((f, i) => {
                this._tone(ctx, t + 0.15 + i * 0.05, { type: 'sine', f0: f, dur: 2.4, vol: 0.05, attack: 0.25 });
                this._tone(ctx, t + 0.15 + i * 0.05, { type: 'triangle', f0: f * 1.003, dur: 2.2, vol: 0.025, attack: 0.3 });
            });
            this._noise(ctx, t + 0.1, { filter: 'highpass', f0: 3000, f1: 9000, dur: 1.8, vol: 0.09, attack: 0.9 });
            [1568, 2093, 2637, 3136].forEach((f, i) => this._tone(ctx, t + 0.9 + i * 0.08, { type: 'sine', f0: f, dur: 0.6, vol: 0.035 }));
        },
        transform(ctx, t) {                // the cosmic turn: a rising choir of sines
            [220, 277, 330, 440].forEach((f, i) => this._tone(ctx, t + i * 0.1, { type: 'sine', f0: f, f1: f * 2, dur: 1.4, vol: 0.06, attack: 0.3 }));
            this._noise(ctx, t, { filter: 'bandpass', f0: 400, f1: 3000, q: 1, dur: 1.5, vol: 0.08, attack: 0.5 });
        },
        // Menu feedback.
        hover(ctx, t) { this._tone(ctx, t, { type: 'sine', f0: 1500, dur: 0.025, vol: 0.04 }); },
        click(ctx, t, o, j) {
            if (this._rec(ctx, t, { name: 'click', rate: 0.95 + Math.random() * 0.1, vol: 0.1 })) return;
            this._tone(ctx, t, { type: 'triangle', f0: 600, f1: 300, dur: 0.06, vol: 0.12 });
            this._noise(ctx, t, { filter: 'highpass', f0: 2000, dur: 0.03, vol: 0.06 });
        },
    },
};

// ═══════════════════════════════════════════════════════════════════════════
// Music — synthesized dungeon chiptune, one little step sequencer per track.
//
//   Music.play(scene, 'gauntlet')   (no-op if that track is already on; crossfades otherwise)
//   Music.play(scene, null)         fade out
//
// A track is a key, a tempo, a four-chord loop and a few voices: a bass, an arpeggio, a
// sparse lead (a motif made from the track's seed, so it's the same tune every time), a
// pad, and drums. Notes are scheduled a little ahead of the audio clock from a timer that
// lives outside any scene, so the music carries straight across scene changes.
// Volume: 'musicVolume' (0-1, default 0.4) and 'musicMuted'; the master mute (Sfx) mutes it too.
// ═══════════════════════════════════════════════════════════════════════════
const Music = {
    STEP_AHEAD: 0.15,
    // scales as semitones from the root
    SCALES: { minor: [0, 2, 3, 5, 7, 8, 10], phrygian: [0, 1, 3, 5, 7, 8, 10], dorian: [0, 2, 3, 5, 7, 9, 10],
              harmonic: [0, 2, 3, 5, 7, 8, 11], major: [0, 2, 4, 5, 7, 9, 11], locrian: [0, 1, 3, 5, 6, 8, 10], lydian: [0, 2, 4, 6, 7, 9, 11] },
    // chords as scale degrees (0-based) of the loop's 4 bars. Patterns are 16 steps per bar:
    // bass/arp/kick/snare/hat: 1 = play. arp walks the chord's tones.
    TRACKS: {
        menu:     { bpm: 72,  root: 50, scale: 'minor',    chords: [0, 5, 3, 4], seed: 3,  lead: 0.18, wave: 'triangle',
                    bass: '1000000010000000', arp: '1010101010101010', pad: true, kick: '', snare: '', hat: '' },
        tutorial: { bpm: 96,  root: 48, scale: 'dorian',   chords: [0, 3, 4, 3], seed: 7,  lead: 0.3, wave: 'square',
                    bass: '1000100010001000', arp: '1000101010001010', pad: false, kick: '1000000010000000', snare: '0000100000001000', hat: '0010001000100010' },
        shop:     { bpm: 112, root: 53, scale: 'dorian',   chords: [0, 3, 1, 4], seed: 11, lead: 0.35, wave: 'square',
                    bass: '1000101010001010', arp: '0010001000100010', pad: false, kick: '1000000010000000', snare: '0000100000001000', hat: '1010101010101010' },
        gauntlet: { bpm: 118, root: 52, scale: 'phrygian', chords: [0, 1, 0, 6], seed: 21, lead: 0.32, wave: 'square',
                    bass: '1010001010100010', arp: '1011101110111011', pad: false, kick: '1000001010000000', snare: '0000100000001000', hat: '0010001000100010' },
        voidrift: { bpm: 92,  root: 49, scale: 'harmonic', chords: [0, 5, 1, 4], seed: 33, lead: 0.22, wave: 'sine',
                    bass: '1000000010000000', arp: '1001001001001001', pad: true, kick: '1000000000000000', snare: '0000000010000000', hat: '0000100000001000' },
        fracture: { bpm: 126, root: 45, scale: 'minor',    chords: [0, 6, 5, 4], seed: 45, lead: 0.36, wave: 'square',
                    bass: '1010101010101010', arp: '1000100010001000', pad: false, kick: '1000100010001000', snare: '0000100000001000', hat: '0011001100110011' },
        cistern:  { bpm: 76,  root: 42, scale: 'minor',    chords: [0, 5, 2, 6], seed: 57, lead: 0.2, wave: 'sine', echo: true,
                    bass: '1000000000100000', arp: '1000010000100001', pad: true, kick: '1000000000000000', snare: '', hat: '0000001000000010' },
        // the Tower: a chord walk that keeps climbing, driving but not the boss's panic
        // the Isle: a slow harp walking the chords over a soft pulse, a bell-like lead, lots of space
        isle:     { bpm: 76,  root: 55, scale: 'major',    chords: [0, 5, 3, 4], seed: 23, lead: 0.35, wave: 'triangle', echo: true,
                    bass: '1000000010000000', arp: '1010101010101010', pad: true, kick: '1000000000000000', snare: '', hat: '0000001000000010' },
        // sleeping in the garden: a slow music-box lullaby
        lullaby:  { bpm: 50,  root: 60, scale: 'major',    chords: [0, 3, 4, 0], seed: 5,  lead: 0.15, wave: 'sine', echo: true, chimes: 0.08,
                    bass: '1000000000000000', arp: '1000100010001000', pad: true, kick: '', snare: '', hat: '' },
        // the Underwell: slow and weightless, a lydian haze of pads, glass chimes falling at random (chimes: their chance a step), no drums
        underwell:{ bpm: 58,  root: 50, scale: 'lydian',   chords: [0, 4, 5, 3], seed: 41, lead: 0.2, wave: 'sine', echo: true, chimes: 0.2,
                    bass: '1000000000000000', arp: '1000000100000100', pad: true, kick: '', snare: '', hat: '' },
        tower:    { bpm: 124, root: 47, scale: 'harmonic', chords: [0, 2, 4, 5], seed: 99, lead: 0.34, wave: 'triangle', echo: true,
                    bass: '1000101010001010', arp: '1010101110101011', pad: true, kick: '1000001010000010', snare: '0000100000001000', hat: '0010101000101010' },
        // transformed: the partial form's rift (urgent, minor, echoing) and the full form's
        // anthem (major, bright, driving)
        rift:     { bpm: 136, root: 47, scale: 'harmonic', chords: [0, 5, 3, 4], seed: 77, lead: 0.45, wave: 'square', echo: true,
                    bass: '1010101010101010', arp: '1111111111111111', pad: true, kick: '1000100010001000', snare: '0000100000001000', hat: '0010001000100010' },
        ascendant:{ bpm: 144, root: 50, scale: 'major',    chords: [0, 4, 5, 3], seed: 88, lead: 0.55, wave: 'sawtooth', echo: true,
                    bass: '1010101010101010', arp: '1111111111111111', pad: true, kick: '1000100010001000', snare: '0000100000001000', hat: '1111111111111111' },
        boss:     { bpm: 148, root: 45, scale: 'harmonic', chords: [0, 0, 5, 4], seed: 66, lead: 0.5, wave: 'sawtooth',
                    bass: '1110111011101110', arp: '1111111111111111', pad: false, kick: '1000100010001000', snare: '0000100000001000', hat: '1111111111111111' },
    },
    _cur: null, _bus: null, _echo: null, _timer: null, _step: 0, _next: 0, _ctxRef: null, _scene: null,

    volume() { try { const v = parseFloat(localStorage.getItem('musicVolume')); return isNaN(v) ? 0.4 : Math.max(0, Math.min(1, v)); } catch (e) { return 0.4; } },
    muted() { try { return localStorage.getItem('musicMuted') === 'true' || Sfx.muted(); } catch (e) { return false; } },
    setVolume(v) { try { localStorage.setItem('musicVolume', String(Math.max(0, Math.min(1, v)))); } catch (e) {} this._applyVolume(); },
    setMuted(m) { try { localStorage.setItem('musicMuted', m ? 'true' : 'false'); } catch (e) {} this._applyVolume(); },
    _level() { return this.muted() || this._ducked ? 0 : this.volume() * 0.55; },
    // Cut the music out for a moment (a charge building) and bring it back after.
    duck(on) { this._ducked = !!on; this._applyVolume(); },
    _applyVolume() {
        const b = this._bus;
        if (b) { const t = b.context.currentTime; b.gain.cancelScheduledValues(t); b.gain.setTargetAtTime(this._level(), t, 0.1); }
    },

    play(scene, name) {
        this._scene = scene;
        if (this._ducked) this.duck(false);   // a duck's un-duck can die with its scene (the Isle's corrupted pull): a new scene never inherits silence
        if (name === this._cur) return;
        this._cur = name;
        const ctx = scene?.sound?.context;
        if (!ctx || typeof ctx.createGain !== 'function') return;
        // crossfade: every bus still up (not just the last one) fades and is dropped; a new one comes up
        for (const old of (this._buses || [])) {
            const t = old.context.currentTime;
            old.gain.cancelScheduledValues(0); old.gain.setValueAtTime(old.gain.value, t); old.gain.setTargetAtTime(0, t, 0.12);
            setTimeout(() => { try { old.disconnect(); } catch (e) {} }, 900);
        }
        this._buses = [];
        this._bus = null;
        if (!name || !this.TRACKS[name]) return;
        Sfx._ctx(scene);   // makes the shared noise buffer the drums cut from
        const bus = ctx.createGain();
        bus.gain.value = 0;
        bus.connect(ctx.destination);
        // the new track waits for the old one to be gone, so the two never play over each other
        const t0 = ctx.currentTime + 0.6;
        bus.gain.setTargetAtTime(this._level(), t0, 0.3);
        this._bus = bus; this._ctxRef = ctx; this._buses.push(bus);
        // an echo for tracks that want space (the Cistern)
        this._echo = null;
        if (this.TRACKS[name].echo) {
            const d = ctx.createDelay(1), fb = ctx.createGain(), wet = ctx.createGain();
            d.delayTime.value = 60 / this.TRACKS[name].bpm * 0.75; fb.gain.value = 0.38; wet.gain.value = 0.5;
            d.connect(fb); fb.connect(d); d.connect(wet); wet.connect(bus);
            this._echo = d;
        }
        this._motif = this._makeMotif(this.TRACKS[name]);
        this._step = 0; this._next = t0;
        if (!this._timer) this._timer = setInterval(() => this._tick(), 30);
    },

    // A 2-bar lead motif from the track's seed: scale degrees per 8th note, -1 = rest.
    _makeMotif(T) {
        let x = T.seed * 9301 + 49297;
        const rnd = () => ((x = (x * 9301 + 49297) % 233280) / 233280);
        const m = [];
        let deg = 4;
        for (let i = 0; i < 16; i++) {
            if (rnd() > T.lead + 0.3) { m.push(-1); continue; }
            deg = Math.max(0, Math.min(9, deg + Math.round((rnd() - 0.5) * 4)));
            m.push(deg);
        }
        return m;
    },

    _tick() {
        const ctx = this._ctxRef, T = this.TRACKS[this._cur];
        if (!ctx || !T || !this._bus) return;
        if (ctx.state !== 'running') { this._next = ctx.currentTime + 0.1; return; }
        if (this._next < ctx.currentTime - 0.5) this._next = ctx.currentTime + 0.05;   // the tab was asleep
        const stepDur = 60 / (T.bpm * (this.rate || 1)) / 4;   // rate: a scene can push the tempo (the Fracture's cracks do)
        while (this._next < ctx.currentTime + this.STEP_AHEAD) {
            this._playStep(ctx, T, this._step, this._next, stepDur);
            this._step = (this._step + 1) % 64;
            this._next += stepDur;
        }
    },

    _note(ctx, t, midi, { type = 'square', dur = 0.2, vol = 0.05, cutoff = 2200, echo = false }) {
        const o = ctx.createOscillator(), g = ctx.createGain(), f = ctx.createBiquadFilter();
        o.type = type; o.frequency.value = 440 * Math.pow(2, (midi - 69) / 12);
        f.type = 'lowpass'; f.frequency.value = cutoff;
        g.gain.setValueAtTime(0.0001, t);
        g.gain.exponentialRampToValueAtTime(vol, t + 0.008);
        g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
        o.connect(f); f.connect(g); g.connect(this._bus);
        if (echo && this._echo) g.connect(this._echo);
        o.start(t); o.stop(t + dur + 0.05);
    },
    // a glass chime: a sine rung by another at an inharmonic ratio, the shimmer dying away, long tail into the echo
    _chime(ctx, t, midi, vol) {
        const f = 440 * Math.pow(2, (midi - 69) / 12), o = ctx.createOscillator(), m = ctx.createOscillator(), mg = ctx.createGain(), g = ctx.createGain();
        o.type = 'sine'; o.frequency.value = f; m.type = 'sine'; m.frequency.value = f * 3.53;
        mg.gain.setValueAtTime(f * 1.4, t); mg.gain.exponentialRampToValueAtTime(1, t + 1.2);
        g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + 0.004); g.gain.exponentialRampToValueAtTime(0.0001, t + 2.8);
        m.connect(mg); mg.connect(o.frequency); o.connect(g); g.connect(this._bus); if (this._echo) g.connect(this._echo);
        o.start(t); m.start(t); o.stop(t + 2.9); m.stop(t + 2.9);
    },
    _drum(ctx, t, kind) {
        if (kind === 'kick') {
            const o = ctx.createOscillator(), g = ctx.createGain();
            o.frequency.setValueAtTime(140, t); o.frequency.exponentialRampToValueAtTime(40, t + 0.12);
            g.gain.setValueAtTime(0.35, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.16);
            o.connect(g); g.connect(this._bus); o.start(t); o.stop(t + 0.2);
            return;
        }
        if (!Sfx._noiseBuf) return;
        const s = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain();
        s.buffer = Sfx._noiseBuf;
        f.type = kind === 'hat' ? 'highpass' : 'bandpass'; f.frequency.value = kind === 'hat' ? 7000 : 1800; f.Q.value = kind === 'hat' ? 0.7 : 0.9;
        const dur = kind === 'hat' ? 0.04 : 0.13, vol = kind === 'hat' ? 0.05 : 0.14;
        g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
        s.connect(f); f.connect(g); g.connect(this._bus); s.start(t, Math.random() * 0.5); s.stop(t + dur + 0.02);
    },

    _playStep(ctx, T, step, t, sd) {
        const sc = this.SCALES[T.scale], bar = Math.floor(step / 16), s = step % 16;
        const deg = T.chords[bar % T.chords.length];
        const pitch = (d, oct = 0) => T.root + sc[((d % 7) + 7) % 7] + 12 * (Math.floor(d / 7) + oct);
        const on = (pat) => pat && pat[s] === '1';
        if (on(T.bass)) this._note(ctx, t, pitch(deg, -1), { type: 'triangle', dur: sd * 1.8, vol: 0.16, cutoff: 900 });
        if (on(T.arp)) {
            const tones = [0, 2, 4, 7], k = Math.floor(step / (T.arp.split('1').length > 12 ? 1 : 2)) % tones.length;
            this._note(ctx, t, pitch(deg + tones[k], 1), { type: T.wave === 'sawtooth' ? 'square' : T.wave, dur: sd * 1.4, vol: 0.035, cutoff: 1800, echo: true });
        }
        // the lead: the motif on 8th notes, every other pair of bars
        if (s % 2 === 0 && Math.floor(bar / 2) % 2 === 1) {
            const d = this._motif[(Math.floor(step / 2)) % 16];
            if (d >= 0) this._note(ctx, t, pitch(deg + d, 1), { type: T.wave, dur: sd * 2.6, vol: T.wave === 'sine' ? 0.07 : 0.04, cutoff: 2600, echo: true });
        }
        if (T.pad && s === 0) for (const k of [0, 2, 4]) this._note(ctx, t, pitch(deg + k, 0), { type: 'sine', dur: sd * 15, vol: 0.035, cutoff: 1200, echo: true });
        if (T.chimes && Math.random() < T.chimes) this._chime(ctx, t + Math.random() * sd, pitch(deg + [0, 2, 4, 6, 7, 9][Math.floor(Math.random() * 6)], 2), 0.02 + Math.random() * 0.03);
        if (on(T.kick)) this._drum(ctx, t, 'kick');
        if (on(T.snare)) this._drum(ctx, t, 'snare');
        if (on(T.hat)) this._drum(ctx, t, 'hat');
    },
};
