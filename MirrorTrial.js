// ═══════════════════════════════════════════════════════════════════════════
// MirrorTrial.js — the Hall of Reflections, a first try (the Training Ground's TRIAL page).
//
// You step through a mirror into a hall and see through your slime's eyes, a step a tile and a quarter turn at a time. The
// mirror breaks behind you, and the things in the hall take your powers the moment you're in: you can't fight them, only
// get out. They sleep at first, and stay asleep till you come too near or make a noise (a surge, a blink, a knock on a pane,
// a stand turned), and every shard of the way out you take wakes another. Awake, they're bigger than you and they move only
// while nothing sees them, never while you watch, and only ever in
// still poses: far off, asleep, looking like you; nearer, awake and wrong; close, your own face, huge and much too near, then
// pouncing. Watching them holds
// them, but don't meet their eyes: looking straight at one that's awake fills you with dread (the screen darkens, cracks,
// your heart pounds) till you can't bear it and look away, and for a moment nothing watches them. In a mirror they can't
// reach you that way: watch them there. The hall's mirrors see for
// you: the ones at the ends of its corridors show you what's behind, and the mirror stands at its corners (at 45 degrees:
// walk into one to turn it) show you round them, so you can watch two ways at once. Glass you see through, and so do they
// (it's in the way of nothing but walking). A pane of glass and a mirror look the same here, so a mirror can pass for a way
// on: walk into one to tap it (a mirror rings, glass thuds) and you chalk it, an eye for a mirror, a cross for glass.
// You walk slowly. SHIFT drinks one of your three vials of your own goo: a surge of speed for a moment, the view going
// teal and wobbling like jelly, goo dripping down it; they fill back up slowly, one at a time (none while one's running); you come in with one. Held, SHIFT spends two at once on a blink: a white flash and you're a few tiles on,
// past one of them if it's in the way (not through stone or glass). Two sentry slimes (E sets one down where you stand, facing
// your way, its line of sight lit on the floor; E again on it picks it up): they hold nothing, but when one of them comes into
// a sentry's line it squeaks, and you know where. You carry a scrap of paper the hall draws itself on in ink as you see it
// (TAB, held: you hold it up to your face, and nothing watches them): you, your sentries and decoys and their lines, the panes you've chalked (an eye a mirror, a cross glass,
// dotted not yet), shards and glorps you've seen, and them: a red cross where anything of yours sees them now, fading where
// they were last seen. Two decoy slimes (Q, you in pink): set one down and it stares the way you face for a while, and they take
// it for you (anything in its line holds) till it pops. On the floor at your feet, a broken shard: hold it up (SPACE) and you see what's behind you, but the
// view dives into the shard and everything in front of you goes unwatched. Find the three shards the way out is missing,
// and it's whole again: step back through it. Those shards are there only in reflections (the hall's mirrors, its stands,
// your own shard): look straight at where one lies and there's nothing; and a mirror here looks like glass, so where you
// see one may be behind you. If one of them reaches you, it has you.
// Drawn small and scaled up: a ray a column through the tile map, off mirrors and through glass, shaded to black with
// distance and dithered to a few levels a colour; the shard's view the same, turned round and flipped, cut to its shape.
// ═══════════════════════════════════════════════════════════════════════════
class MirrorTrial extends Phaser.Scene {
    static CFG = {
        W: 256, H: 144, FOV: 0.66, FOG: 12, BOUNCES: 4, LEVELS: 11,   // the view, drawn this small; how wide; how far you see; mirrors deep; the dither
        BACK: { W: 96, H: 72, FOV: 0.5 },                           // the shard's view (the size of its art, mt_shard)
        STEP_MS: 340, BOOST_MS: 120, TURN_MS: 160, RAISE_MS: 220,    // your step (surging: BOOST_MS), turn, and lifting the shard
        SURGE: { CHARGES: 3, CHARGE_MS: 9000, MS: 2200, FOV: 1.22, BEAT_MS: 420 },   // surges: at most this many vials (each a flask found), one back every CHARGE_MS, how long one lasts; the view widened; its pulse
        WARD_MS: 7000, WARD_RANGE: 8,                                // decoy slimes (found in the hall): how long one stares, how far
        BLINK: { HOLD_MS: 280, TILES: 3, COST: 2 },                  // SHIFT held this long: a blink, up to TILES on, for COST surges
        SENTRY: { RANGE: 9, LIT_MS: 2500 },                          // sentries (found in the hall): how far one sees (and its line's lit), how long bright just set down
        MAP: { CELL: 5, BIG: 6, UP_MS: 230, LAST_MS: 6000 },         // the map: a tile's size in ink; how big held up; how long a last sighting stays
        ENT_MS: 600, ENT_SHARD: 30, ENT_MIN: 450, GRACE_MS: 5000,    // unseen this long, one moves (quicker by ENT_SHARD a shard found: not far off your walk, so you can't leave one be); none at first
        WAKE: { NEAR: 2, SURGE: 5, BLINK: 6, TAP: 4, TURN: 3, MS: 1500 },   // asleep, one wakes: you this near (tiles), or a noise this near; it takes MS to come to
        HEAR: 10,                                                    // how far off you hear one move
        SEEN_PX: 6, SEEN_BACK: 3, LIT: 0.05, BIG: 1.35,              // this much of one on screen (in the shard), this lit, holds it; how tall they stand
        DREAD: { RISE: 0.2, CLOSE: 1.3, CLOSE_PX: 3500, FALL: 0.3, WAIT: 500, OUT_MS: 1000, AFTER: 0.55, STING: 0.25 },   // a second's straight look at one awake (more the more it fills your view); ebbing after WAIT; full, you look away OUT_MS, back at AFTER; the sting of one turning near
    };
    // # stone, G glass, M mirror, L R mirror stands at 45 degrees (L like /, R like \), O the way out (broken), s a missing shard,
    // h the shard for your hand, g glorps, v a flask of goo, d a decoy slime, n a sentry slime, W one of them, P you (facing north). The corridors end in mirrors; the middle's a room of glass.
    static MAP = [
        '#################',
        'Mg.....W#v.....gM',
        '#.#####.#.#####.#',
        '#.#s.g..M..g.s#.#',
        '#.#.###...###.#.#',
        '#g.n..#.#.#..d.g#',
        '###.#.GGGGG.#.###',
        '#..g#.Gg..G.#g..#',
        '#.#.R.G.s.G.L.#.#',
        '#W#...G..gG...#W#',
        '#.###.GG.GG.###.#',
        '#g...d..h......g#',
        '#.#####...#####.#',
        'Mv..g...P...g..nM',
        '########O########',
    ];
    static DIRS = [[0, -1], [1, 0], [0, 1], [-1, 0]];   // north, east, south, west
    static TEX = ['mt_wall', 'mt_glass', 'mt_mirror', 'mt_broken', 'mt_self', 'mt_twin', 'mt_shard', 'mt_pickup', 'mt_decoy', 'mt_mark_m', 'mt_mark_g', 'mt_sentry', 'mt_glorp', 'mt_map', 'mt_items'];
    static BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5].map(v => (v + 0.5) / 16 - 0.5);

    // From the Training Ground: down into your slime's eyes, and through
    static enter(S) {
        if (S._mirrorBusy || !S.player || !S.scene.get('MirrorTrial')) return;
        S._mirrorBusy = true;
        Training.showPanel(S, false);
        const cam = S.cameras.main, zoom = cam.zoom;
        Sfx.play(S, 'whoosh');
        cam.zoomTo(zoom * 4, 650, 'Cubic.easeIn');
        cam.fadeOut(650, 8, 4, 16);
        S.time.delayedCall(680, () => { S.scene.launch('MirrorTrial', { zoom }); S.scene.pause(); });
    }

    constructor() { super('MirrorTrial'); }

    create(data) {
        const C = MirrorTrial.CFG, W = this.scale.width, H = this.scale.height;
        this.zoom0 = data?.zoom || 1;
        this.map = MirrorTrial.MAP.map(r => r.split(''));
        this.ents = []; this.shards = []; this.glorps = []; this.items = []; this.hand = null; this.gotGlorps = 0;
        this.map.forEach((row, y) => row.forEach((c, x) => {
            if (c === 'P') this.me = { x, y, dir: 0 };
            else if (c === 'W') this.ents.push({ x, y, pose: Math.random() < 0.5 ? 0 : 1, t: 0, seen: false, awake: false });
            else if (c === 's') this.shards.push({ x, y });
            else if (c === 'h') this.hand = { x, y };
            else if (c === 'g') this.glorps.push({ x, y, n: 3 + Math.floor(Math.random() * 4) });
            else if ('vdn'.includes(c)) this.items.push({ x, y, k: c });
            else return;
            row[x] = '.';
        }));
        this.view = { x: this.me.x + 0.5, y: this.me.y + 0.5, a: -Math.PI / 2 };
        Object.assign(this, { found: 0, holding: false, raised: false, t0: this.time.now, done: false, caught: false, leaving: false, moving: false, queued: null,
            charges: 1, vials: 1, chargeT: 0, surging: false, surgeUntil: 0, beatAt: 0, fovK: 1, surgeK: 0, bubbles: [], wards: 0, placed: [], labels: {},
            shiftDown: false, shiftAt: 0, blinked: false, sentries: [], sentryLeft: 0, lines: new Map(), escaped: false, breaks: 0, closest: Infinity,
            dread: 0, dreadAt: 0, blackUntil: 0, heartAt: 0, mapUp: false, known: new Set(), lastSeen: new Map() });
        // the dread's cracks: from the screen's edges in, a little further the more you dread (fixed, so they grow, not jump)
        let seed = 9; const rnd = () => (seed = (seed * 1103515245 + 12345) >>> 0) / 4294967296;
        this.cracks = Array.from({ length: 12 }, (_, i) => {
            const side = i % 4, t = rnd(), pts = [[side === 1 ? W : side === 3 ? 0 : t * W, side === 0 ? 0 : side === 2 ? H : t * H]];
            for (let k = 0; k < 9; k++) { const [x, y] = pts[pts.length - 1], a = Math.atan2(H / 2 - y, W / 2 - x) + (rnd() - 0.5) * 1.4; pts.push([x + Math.cos(a) * (25 + rnd() * 35), y + Math.sin(a) * (25 + rnd() * 35)]); }
            return pts;
        });
        // the textures, as pixels to read
        this.tex = {};
        for (const k of MirrorTrial.TEX) {
            const src = this.textures.get(k).getSourceImage(), c = document.createElement('canvas');
            c.width = src.width; c.height = src.height;
            const x = c.getContext('2d'); x.drawImage(src, 0, 0);
            this.tex[k] = { w: src.width, h: src.height, d: x.getImageData(0, 0, src.width, src.height).data };
        }
        this.tex.mt_twin.fw = this.tex.mt_decoy.fw = this.tex.mt_items.fw = 48;   // strips: its poses, the decoy's four sides, things to find
        if (!this.textures.get('mt_twin').has('face')) this.textures.get('mt_twin').add('face', 0, 4 * 48, 0, 48, 64);
        // the two views: ahead (the screen), and the shard's (behind you), each a canvas drawn every frame
        const canvas = (key, w, h) => {
            const t = this.textures.exists(key) ? this.textures.get(key) : this.textures.createCanvas(key, w, h), ctx = t.getContext();
            return { key, tex: t, ctx, img: ctx.createImageData(w, h), W: w, H: h, zbuf: new Float32Array(w), cols: new Array(w) };
        };
        this.front = canvas('mt_view', C.W, C.H);
        this.back = canvas('mt_back', C.BACK.W, C.BACK.H);
        this.add.image(W / 2, H / 2, 'mt_view').setScale(Math.max(W / C.W, H / C.H));
        this.dim = this.add.rectangle(0, 0, W, H, 0x000000).setOrigin(0).setAlpha(0);   // ahead, unwatched while you look in the shard
        this.shard = this.add.container(0, 0, [this.add.image(0, 0, 'mt_back'), this.add.image(0, 0, 'mt_shard')]).setVisible(false);
        this._shardAt(false, 0);
        // what's said, and the keys
        const T = (y, s, size, col) => this.add.text(W / 2, y, s, { fontSize: size, fontFamily: UIKit.FONT.title, fontStyle: 'bold', color: col, stroke: '#05030a', strokeThickness: 5, align: 'center' }).setOrigin(0.5).setDepth(6);
        this.title = T(H * 0.38, 'THE HALL OF REFLECTIONS', '30px', '#d8c8ff');
        this.sub = T(H * 0.38 + 44, 'The mirror breaks behind you. Something here takes your powers.\nThey\'re sleeping. Woken, they move only while unwatched. Don\'t meet their eyes.', '16px', '#a898c8');
        this.time.delayedCall(1300, () => { Sfx.play(this, 'shatter'); this.cameras.main.shake(200, 0.006); });
        this.time.delayedCall(2300, () => Sfx.play(this, 'e_absorb'));
        this.tweens.add({ targets: [this.title, this.sub], alpha: 0, delay: C.GRACE_MS - 500, duration: 600 });
        this.keysTxt = this.add.text(W / 2, H - 30, '', { fontSize: '13px', fontFamily: 'monospace', align: 'center', lineSpacing: 4, color: '#8a7aa8', stroke: '#05030a', strokeThickness: 3 }).setOrigin(0.5).setDepth(6);
        this.fx = this.add.graphics().setDepth(4);   // the surge's streaks, goo and pulse
        this.surgeGlow = this.add.rectangle(0, 0, W, H, 0x2fe8c8).setOrigin(0).setBlendMode(Phaser.BlendModes.ADD).setAlpha(0).setDepth(3);
        // the surges: three vials of goo, bottom left; an empty one fills back up from the bottom
        const ct = this.textures.get('mt_charge');
        if (!ct.has('full')) { ct.add('full', 0, 0, 0, 10, 13); ct.add('empty', 0, 10, 0, 10, 13); }
        this.cans = Array.from({ length: C.SURGE.CHARGES }, (_, i) => {
            const x = 52 + i * 58, y = H - 92, P = Math.max(W / C.W, H / C.H);   // (drawn the view's pixel size; in from the edge, where the zoom pulses would push it)
            return { glow: this.add.image(x, y, 'vfx_glow').setTint(0x40d8b8).setBlendMode(Phaser.BlendModes.ADD).setScale(0.55).setAlpha(0.35).setDepth(5),
                     empty: this.add.image(x, y, 'mt_charge', 'empty').setScale(P).setDepth(5), full: this.add.image(x, y, 'mt_charge', 'full').setScale(P).setDepth(5), P };
        });
        this.surgeTxt = this.add.text(W / 2, H * 0.3, 'SURGE!', { fontSize: '54px', fontFamily: UIKit.FONT.title, fontStyle: 'bold', color: '#8ff4dc', stroke: '#063a32', strokeThickness: 8 }).setOrigin(0.5).setDepth(6).setAlpha(0);
        this.dreadG = this.add.graphics().setDepth(4.2);   // the dread: the edges darkening, the cracks
        this.black = this.add.rectangle(0, 0, W, H, 0x000000).setOrigin(0).setAlpha(0).setDepth(4.9);   // looking away
        this.stingWash = this.add.rectangle(0, 0, W, H, 0xffffff).setOrigin(0).setBlendMode(Phaser.BlendModes.ADD).setAlpha(0).setDepth(4.3);   // the shock: a flash over it, not hiding it
        this.mapDim = this.add.rectangle(0, 0, W, H, 0x05030a).setOrigin(0).setAlpha(0).setDepth(6.4);
        this.mapCv = canvas('mt_mapview', this.tex.mt_map.w, this.tex.mt_map.h);   // the paper, inked each frame it's out
        this.mapImg = this.add.image(W / 2, H + 400, 'mt_mapview').setDepth(6.5).setVisible(false);
        this.mapHint = this.add.text(W / 2, H - 58, 'AN EYE: A MIRROR · A CROSS: GLASS · DOTTED: NOT TESTED · RED: THEM\nWHILE YOU LOOK AT IT, NOTHING WATCHES THEM', { fontSize: '13px', fontFamily: 'monospace', fontStyle: 'bold', color: '#d6c49a', stroke: '#05030a', strokeThickness: 4, align: 'center' }).setOrigin(0.5).setDepth(6.6).setAlpha(0);
        this.mapMode = null;
        this.input.keyboard.addCapture(Phaser.Input.Keyboard.KeyCodes.TAB);
        this.glorpTxt = this.add.text(W - 24, 20, '', { fontSize: '20px', fontFamily: UIKit.FONT.title, fontStyle: 'bold', color: '#5dffb8', stroke: '#05030a', strokeThickness: 5 }).setOrigin(1, 0).setDepth(6);
        this.noteTxt = this.add.text(W / 2, H * 0.72, '', { fontSize: '18px', fontFamily: UIKit.FONT.title, fontStyle: 'bold', color: '#f0ece0', stroke: '#05030a', strokeThickness: 5 }).setOrigin(0.5).setDepth(6).setAlpha(0);
        this.countTxt = this.add.text(W / 2, 22, '', { fontSize: '15px', fontFamily: UIKit.FONT.title, fontStyle: 'bold', color: '#bfd8ff', stroke: '#05030a', strokeThickness: 4 }).setOrigin(0.5).setDepth(6);
        this._hud();
        this.input.keyboard.on('keydown', this._key, this);
        this.input.keyboard.on('keyup', this._keyUp, this);
        this.input.on('pointerdown', this._boop, this);
        this.events.once('shutdown', () => { this.input.keyboard.off('keydown', this._key, this); this.input.keyboard.off('keyup', this._keyUp, this); this.input.off('pointerdown', this._boop, this); });
        if (typeof Music !== 'undefined') Music.duck(true, 'mirror');
        this.cameras.main.fadeIn(700, 8, 4, 16);
    }

    _hud() {
        const have = [this.holding && 'SPACE (hold) the shard', this.vials && `SHIFT tap: surge${this.vials > 1 ? ', hold: blink (2)' : ''}`,
            (this.wards || this.placed.length) && `Q decoy slime (${this.wards})`, (this.sentryLeft || this.sentries.length) && `E set down / pick up a sentry (${this.sentryLeft})`].filter(Boolean);
        this.keysTxt.setText(`W S step · A D turn · TAB (hold) the map · walk into a pane: tap it, a stand: turn it · ESC leave` + (have.length ? '\n' + have.join(' · ') : ''));   // (only what you've found)
        this.countTxt.setText(this.holding ? `SHARDS OF THE WAY OUT  ${'◆ '.repeat(this.found)}${'◇ '.repeat(this.shards.length - this.found)}`.trim() : '');
    }
    _say(a, b, col = '#d8c8ff', hold = 2600) {
        for (const o of [this.title, this.sub]) { this.tweens.killTweensOf(o); o.setAlpha(1); }
        this.title.setText(a).setColor(col); this.sub.setText(b || '');
        if (hold) this.tweens.add({ targets: [this.title, this.sub], alpha: 0, delay: hold, duration: 600 });
    }
    // the shard: low in your hand, or held up before your eyes (filling the view)
    _shardAt(up, ms) {
        const W = this.scale.width, H = this.scale.height, to = up ? { x: W - 290, y: H / 2 + 30, scale: 6, angle: -3 } : { x: W - 150, y: H - 110, scale: 2.4, angle: -8 };   // (up: at your side, ahead still in view round it)
        this.tweens.killTweensOf([this.shard, this.dim]);
        if (!ms) { this.shard.setPosition(to.x, to.y).setScale(to.scale).setAngle(to.angle); return; }
        this.tweens.add({ targets: this.shard, ...to, duration: ms, ease: 'Cubic.easeOut' });
        this.tweens.add({ targets: this.dim, alpha: up ? 0.12 : 0, duration: ms });
    }

    _key(e) {
        if (this.leaving) return;
        const k = e.code;
        if (k === 'Escape') return this._leave(this.escaped ? 'YOU GOT OUT OF THE HALL OF REFLECTIONS' : null);
        if (this.caught || this.escaped) { if (k === 'KeyR' || (this.escaped && k === 'Enter')) this.scene.restart({ zoom: this.zoom0 }); return; }
        if (k === 'Space') { if (this.holding && !this.raised && !this.mapUp) { this.raised = true; Sfx.play(this, 'hover'); this._shardAt(true, MirrorTrial.CFG.RAISE_MS); } return; }
        if (k === 'ShiftLeft' || k === 'ShiftRight') { if (!e.repeat) { this.shiftDown = true; this.shiftAt = this.time.now; this.blinked = false; } return; }   // (let go soon: a surge; held: a blink, in update)
        if (k === 'Tab') { this.mapUp = true; if (this.raised) { this.raised = false; this._shardAt(false, MirrorTrial.CFG.RAISE_MS); } return; }
        if (this.mapUp) return;   // (looking at the map: nothing else)
        if (k === 'KeyQ') return this._ward();
        if (k === 'KeyE') return this._sentry();
        if (this.moving) { this.queued = k; return; }
        this._act(k);
    }
    _keyUp(e) {
        if (e.code === 'Space' && this.raised) { this.raised = false; this._shardAt(false, MirrorTrial.CFG.RAISE_MS); }
        if ((e.code === 'ShiftLeft' || e.code === 'ShiftRight') && this.shiftDown) { this.shiftDown = false; if (!this.blinked) this._surgeGo(); }
        if (e.code === 'Tab') this.mapUp = false;
    }
    // a click on a decoy (where the view drew it this frame): booped (Achievements.BOOPS), it squishes
    _boop(p) {
        const P = this.scale.width / this.front.W, x = Math.floor(p.x / P), y = Math.floor(p.y / P);
        const hit = (this.front.picks || []).find(k => k.cols.has(x) && y >= k.top && y < k.bottom);
        if (!hit) return;
        hit.w.boopAt = this.time.now;
        CreatureFX.boopFx(this, p.x, p.y, 'decoy');
    }
    // a decoy slime set down where you stand, staring the way you face
    _ward() {
        const C = MirrorTrial.CFG, { x, y, dir } = this.me;
        if (this.wards <= 0 || this.placed.some(w => w.x === x && w.y === y)) return Sfx.play(this, 'deny');
        this.wards--; this.placed.push({ x, y, dir, at: this.time.now, until: this.time.now + C.WARD_MS });
        Sfx.play(this, 'ready'); this._note('A DECOY: YOU, IN PINK, STARING THAT WAY. THEY\'LL TAKE IT FOR YOU.');
        this._hud();
    }
    // the wards' stares: along the way each faces, through glass, to the first thing in the way; burnt out, gone
    _wardsWatch(now) {
        const C = MirrorTrial.CFG;
        this.placed = this.placed.filter(w => w.until > now);
        for (const w of this.placed) {
            const [dx, dy] = MirrorTrial.DIRS[w.dir];
            for (let i = 1; i <= C.WARD_RANGE; i++) {
                const x = w.x + dx * i, y = w.y + dy * i, c = this.map[y]?.[x];
                if (c !== '.' && c !== 'G') break;
                for (const e of this.ents) if (e.x === x && e.y === y) e.seen = true;
            }
        }
    }
    // SHIFT: a vial drunk, a surge (not while one's running)
    _surgeGo() {
        const C = MirrorTrial.CFG, W = this.scale.width, H = this.scale.height;
        if (this.surging) return;
        if (this.charges <= 0 || this.caught || this.leaving) return this._noCans();
        const can = this.cans[--this.charges];
        this.surgeUntil = Math.max(this.surgeUntil, this.time.now) + C.SURGE.MS;
        if (!this.surging) this._surge(true);
        this._noise(this.me.x, this.me.y, C.WAKE.SURGE);
        Sfx.play(this, 'gulp'); this.time.delayedCall(90, () => Sfx.play(this, 'bubbles')); this.time.delayedCall(140, () => Sfx.play(this, 'surge'));
        this.cameras.main.flash(180, 60, 230, 200);
        this.tweens.killTweensOf(this.surgeTxt);
        this.surgeTxt.setAlpha(1).setScale(1.7).setAngle(-6 + Math.random() * 12);
        this.tweens.add({ targets: this.surgeTxt, scale: 1, duration: 260, ease: 'Back.easeOut' });
        this.tweens.add({ targets: this.surgeTxt, alpha: 0, delay: 450, duration: 400 });
        this.tweens.add({ targets: can.full, scale: can.P * 1.2, duration: 90, yoyo: true });
        for (let n = 0; n < 30; n++) this.bubbles.push({ x: can.full.x + (Math.random() - 0.5) * 30, y: can.full.y - 30, vx: (Math.random() - 0.3) * 260, vy: -150 - Math.random() * 380, r: 3 + Math.random() * 6, life: 1 });   // goo, splashing out of it
    }
    _noCans() {
        Sfx.play(this, 'deny');
        for (const c of this.cans) { this.tweens.killTweensOf(c.empty); this.tweens.add({ targets: c.empty, x: c.empty.x + 3, duration: 40, yoyo: true, repeat: 2 }); }
    }
    // SHIFT held: two vials at once, a white flash, and you're a few tiles on (past one of them, not through stone or glass)
    _blink() {
        const C = MirrorTrial.CFG, [dx, dy] = MirrorTrial.DIRS[this.me.dir];
        if (this.surging) return Sfx.play(this, 'deny');   // (not while a surge runs)
        if (this.charges < C.BLINK.COST || this.moving || this.caught || this.leaving) return this._noCans();
        let land = 0;
        for (let i = 1; i <= C.BLINK.TILES; i++) {
            const x = this.me.x + dx * i, y = this.me.y + dy * i;
            if (!this._open(x, y)) break;
            if (!this.ents.some(e => e.x === x && e.y === y)) land = i;
        }
        if (!land) return this._noCans();
        for (let n = 0; n < C.BLINK.COST; n++) { const can = this.cans[--this.charges]; this.tweens.add({ targets: can.full, scale: can.P * 1.2, duration: 90, yoyo: true }); }
        const x = this.me.x + dx * land, y = this.me.y + dy * land;
        this.me.x = x; this.me.y = y; this.moving = true;
        this.cameras.main.flash(280, 255, 255, 255); this.cameras.main.shake(120, 0.006);
        Sfx.play(this, 'dash'); Sfx.play(this, 'whoosh');
        this._noise(x, y, C.WAKE.BLINK);
        this.tweens.add({ targets: this.view, x: x + 0.5, y: y + 0.5, duration: 90, ease: 'Quad.easeOut', onComplete: () => this._moved() });
    }
    // E: a sentry set down where you stand, facing your way; or, standing on one, picked back up
    _sentry() {
        const { x, y, dir } = this.me, i = this.sentries.findIndex(o => o.x === x && o.y === y);
        if (i >= 0) { this.sentries.splice(i, 1); this.sentryLeft++; Sfx.play(this, 'pickup'); this._note('SENTRY PICKED UP'); }
        else if (this.sentryLeft > 0) { this.sentries.push({ x, y, dir, at: this.time.now }); this.sentryLeft--; Sfx.play(this, 'pop'); this._note('A SENTRY, LOOKING THAT WAY. IT\'LL SQUEAK IF ONE CROSSES ITS LINE.'); }
        else Sfx.play(this, 'deny');
        this._hud();
    }
    // the sentries' lines of sight (lit on the floor, brighter just set down): cell -> how bright
    _sentryLines(now) {
        const C = MirrorTrial.CFG, L = this.lines;
        L.clear();
        for (const o of this.sentries) {
            const [dx, dy] = MirrorTrial.DIRS[o.dir], k = 0.22 + 0.55 * Math.max(0, 1 - (now - o.at) / C.SENTRY.LIT_MS);
            for (let i = 1; i <= C.SENTRY.RANGE; i++) {
                const x = o.x + dx * i, y = o.y + dy * i, c = this.map[y]?.[x];
                if (c !== '.' && c !== 'G') break;
                if (c === '.') L.set(y * 64 + x, Math.max(L.get(y * 64 + x) || 0, k));
            }
        }
        for (const w of this.placed) {   // a decoy's stare, in pink (negative: lines' values; its own colour on the floor)
            const [dx, dy] = MirrorTrial.DIRS[w.dir];
            for (let i = 1; i <= C.WARD_RANGE; i++) {
                const x = w.x + dx * i, y = w.y + dy * i, c = this.map[y]?.[x];
                if (c !== '.' && c !== 'G') break;
                if (c === '.') L.set(y * 64 + x, -0.35);
            }
        }
    }
    // Looking straight at one that's awake (not in a mirror, not through a sentry) builds your dread, faster the more of it
    // fills your view; it ebbs when you stop. Full: you look away. One that's just turned horrible stings the first time it's
    // seen, anywhere. The look of it: the edges darkening, cracks creeping in, the colour going, your heart.
    _dread(now, delta) {
        const C = MirrorTrial.CFG, D = C.DREAD, W = this.scale.width, H = this.scale.height, g = this.dreadG, dt = delta / 1000;
        const direct = this.ents.reduce((a, e) => a + (e.pose >= 2 ? e.dpx || 0 : 0), 0);
        for (const e of this.ents) if (e.fresh && e.seen) {
            e.fresh = false;
            Sfx.play(this, 'boom', { big: true }); Sfx.play(this, 'whoosh'); this.cameras.main.shake(260, 0.012);
            this.tweens.killTweensOf(this.stingWash); this.stingWash.setAlpha(0.5); this.tweens.add({ targets: this.stingWash, alpha: 0, duration: 450, ease: 'Quad.easeIn' });
            this.cameras.main.zoomTo(1.12, 50, 'Quad.easeOut', true, (c, p) => p === 1 && c.zoomTo(1, 380));   // (it jumps at the screen)
            if (e.dpx) this.dread = Math.min(1, this.dread + D.STING);
        }
        if (now < this.blackUntil) {}
        else if (direct >= C.SEEN_PX) {
            this.dread = Math.min(1, this.dread + (D.RISE + D.CLOSE * Math.min(1, direct / D.CLOSE_PX)) * dt); this.dreadAt = now;
            if (this.dread >= 1) {
                this.blackUntil = now + D.OUT_MS; this.dread = D.AFTER; this.breaks++;
                Sfx.play(this, 'hurt'); this.cameras.main.shake(300, 0.012);
                this.tweens.killTweensOf(this.black);
                this.tweens.chain({ targets: this.black, tweens: [{ alpha: 1, duration: 120 }, { alpha: 1, duration: D.OUT_MS - 520 }, { alpha: 0, duration: 400 }] });
                this._note('YOU LOOK AWAY. YOU CAN\'T BEAR IT.');
            }
        } else if (now - this.dreadAt > D.WAIT) this.dread = Math.max(0, this.dread - D.FALL * dt);
        const k = this.dread;
        if (k > 0.2 && now - this.heartAt > 1000 - 650 * k) { this.heartAt = now; Sfx.play(this, 'heartbeat', { hard: k }); if (k > 0.7) this.cameras.main.shake(90, 0.003 * k); }
        g.clear();
        if (k < 0.02) return;
        for (let i = 0; i < 9; i++) g.lineStyle(20, 0x000000, 0.1 * k).strokeRect(10 + i * 20, 10 + i * 20, W - 20 - i * 40, H - 20 - i * 40);
        const P = Math.max(W / C.W, H / C.H), snap = v => Math.floor(v / P) * P;   // (the cracks in the view's own chunky pixels)
        for (const pts of this.cracks) {
            const n = Math.floor(pts.length * k);
            for (let i = 1; i < n; i++) {
                const [x0, y0] = pts[i - 1], [x1, y1] = pts[i], len = Math.hypot(x1 - x0, y1 - y0);
                for (let t = 0; t <= len; t += P) {
                    const x = snap(x0 + (x1 - x0) * t / len), y = snap(y0 + (y1 - y0) * t / len);
                    g.fillStyle(0x05030a, 0.8 * k).fillRect(x + P, y + P, P, P);
                    g.fillStyle(0xe8e0ff, 0.55 * k).fillRect(x, y, P, P);
                }
            }
        }
    }
    // The map held up to your face (TAB: it swings up from below), or put away
    _mapShow(mode) {
        if (mode === this.mapMode) return;
        const C = MirrorTrial.CFG.MAP, W = this.scale.width, H = this.scale.height, img = this.mapImg, prev = this.mapMode;
        this.mapMode = mode;
        this.tweens.killTweensOf([img, this.mapDim, this.mapHint, this.keysTxt]);
        if (mode === 'big') {
            img.setVisible(true);
            img.setPosition(W / 2, H + 320).setAngle(-9).setScale(C.BIG);
            Sfx.play(this, 'hover');
            this.tweens.add({ targets: img, x: W / 2, y: H / 2 - 8, angle: -1.5, scale: C.BIG, duration: C.UP_MS, ease: 'Cubic.easeOut' });
            this.tweens.add({ targets: this.mapDim, alpha: 0.6, duration: C.UP_MS });
            this.tweens.add({ targets: this.mapHint, alpha: 1, duration: C.UP_MS });
            this.tweens.add({ targets: this.keysTxt, alpha: 0, duration: C.UP_MS });   // (the hint where the keys were)
        } else {
            this.tweens.add({ targets: img, y: H + 320, angle: -9, duration: 190, ease: 'Cubic.easeIn', onComplete: () => img.setVisible(false) });
            this.tweens.add({ targets: [this.mapDim, this.mapHint], alpha: 0, duration: 190 });
            this.tweens.add({ targets: this.keysTxt, alpha: 1, duration: 190 });
        }
    }
    // The hall in ink on the paper, a tile CELL pixels: what you've seen of it (stone hatched, panes as you've chalked them,
    // stands, the way out), glorps and shards, your decoys and sentries and their lines dotted, them (a red cross: where
    // anything of yours sees them now, blinking, or saw them last, fading), and you, an arrow
    _mapInk(now) {
        const C = MirrorTrial.CFG, V = this.mapCv, d = V.img.data, P = this.tex.mt_map.d, MW = V.W, MH = V.H, S = C.MAP.CELL;
        const rows = this.map.length, cols = this.map[0].length, ox = Math.floor((MW - cols * S) / 2), oy = Math.floor((MH - 8 - rows * S) / 2);
        d.set(P);
        const ink = (x, y, hex, a = 1) => {   // (only on the paper)
            x = Math.round(x); y = Math.round(y);
            if (x < 0 || y < 0 || x >= MW || y >= MH) return;
            const i = (y * MW + x) * 4;
            if (!P[i + 3]) return;
            d[i] += (((hex >> 16) & 255) - d[i]) * a; d[i + 1] += (((hex >> 8) & 255) - d[i + 1]) * a; d[i + 2] += ((hex & 255) - d[i + 2]) * a;
        };
        const cell = (cx, cy, fn) => { for (let v = 0; v < S; v++) for (let u = 0; u < S; u++) fn(ox + cx * S + u, oy + cy * S + v, u, v); };
        const mid = (cx, cy) => [ox + cx * S + (S >> 1), oy + cy * S + (S >> 1)];
        for (let y = 0; y < rows; y++) for (let x = 0; x < cols; x++) {
            if (!this.known.has(y * 64 + x)) continue;
            const c = this.map[y][x], lab = this.labels[y * 64 + x];
            if (c === '#') cell(x, y, (px, py) => ink(px, py, (px + py) % 2 ? 0x4a3418 : 0x6b4c28, 0.9));
            else if (c === 'M' || c === 'G') cell(x, y, (px, py, u, v) => {
                const edge = !u || !v || u === S - 1 || v === S - 1, m = S >> 1;
                if (lab === 'M') ink(px, py, u === m && v === m ? 0xffffff : 0x5a7ab0, 0.95);                       // a mirror: filled, an eye
                else if (lab === 'G') { if (edge || u === v || u + v === S - 1) ink(px, py, 0x5a7ab0, 0.9); }      // glass: framed, a cross
                else if (edge && (u + v) % 2 === 0) ink(px, py, 0x7a6a4a, 0.9);                                    // not tested: dotted
            });
            else if (c === 'L' || c === 'R') cell(x, y, (px, py, u, v) => { if (c === 'L' ? u + v === S - 1 : u === v) ink(px, py, 0x606880, 1); });
            else if (c === 'O' || c === 'Q') cell(x, y, (px, py, u, v) => ink(px, py, c === 'Q' ? (u === 2 && v === 2 ? 0xffffff : 0x9a6ad8) : 0x5a3a70, 0.9));
        }
        for (const o of this.glorps) if (!o.got && this.known.has(o.y * 64 + o.x)) { const [x, y] = mid(o.x, o.y); for (const [a, b] of [[0, 0], [1, 0], [0, 1], [1, 1]]) ink(x + a - 1, y + b, 0x1f9a5a); }
        for (const o of this.items) if (!o.got && this.known.has(o.y * 64 + o.x)) { const [x, y] = mid(o.x, o.y); for (const [a, b] of [[0, 0], [1, 0], [0, 1], [1, 1], [0, -1], [1, -1]]) ink(x + a - 1, y + b, o.k === 'd' ? 0xd0508a : 0x1f8a78); }   // (things to find: pink a decoy, teal goo or a sentry)
        for (const o of this.shards) if (!o.got && o.seen) { const [x, y] = mid(o.x, o.y); for (const [a, b] of [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1]]) ink(x + a, y + b, a || b ? 0x8a9ab8 : 0xffffff); }
        const line = (o, col, range, live) => {
            const [dx, dy] = MirrorTrial.DIRS[o.dir], [x0, y0] = mid(o.x, o.y);
            for (let i = 1; i <= range; i++) { const c = this.map[o.y + dy * i]?.[o.x + dx * i]; if (c !== '.' && c !== 'G') break; for (let k = 0; k < S; k += 2) ink(x0 + dx * (i * S - k), y0 + dy * (i * S - k), col, 0.8); }
            for (const [a, b] of [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [-1, -1], [1, -1], [-1, 1]]) ink(x0 + a, y0 + b, col, live && Math.floor(now / 200) % 2 ? 0.4 : 1);
        };
        this.placed.forEach(w => line(w, 0xd0508a, C.WARD_RANGE));
        this.sentries.forEach(o => line(o, 0x1f8a78, C.SENTRY.RANGE, o.sees));
        for (const [e, l] of this.lastSeen) {   // them
            const age = now - l.at; if (age > C.MAP.LAST_MS) continue;
            const live = age < 50; if (live && Math.floor(now / 160) % 3 === 2) continue;
            const [x, y] = mid(l.x, l.y), a = live ? 1 : 0.9 * (1 - age / C.MAP.LAST_MS);
            for (let k = -2; k <= 2; k++) for (const t of [0, 1]) { ink(x + k + t, y + k, 0xc01830, a); ink(x + k + t, y - k, 0xc01830, a); }   // (two pixels thick: it has to catch your eye)
        }
        const [mx, my] = mid(this.me.x, this.me.y), [dx, dy] = MirrorTrial.DIRS[this.me.dir];   // you: an arrow the way you face
        for (const [f, s2] of [[2, 0], [1, -1], [1, 0], [1, 1], [0, -2], [0, -1], [0, 0], [0, 1], [0, 2], [-1, 0], [-2, 0]]) ink(mx + dx * f - dy * s2, my + dy * f + dx * s2, 0x0e6a5c);
        V.ctx.putImageData(V.img, 0, 0);
        V.tex.refresh();
    }
    // the sentries: one of them in a sentry's line (through glass, to the first thing in the way) is seen there (on the map);
    // coming into it, the sentry squeaks
    _sentryWatch() {
        const C = MirrorTrial.CFG;
        for (const o of this.sentries) {
            const [dx, dy] = MirrorTrial.DIRS[o.dir], was = o.sees;
            o.sees = false;
            for (let i = 1; i <= C.SENTRY.RANGE; i++) {
                const x = o.x + dx * i, y = o.y + dy * i, c = this.map[y]?.[x];
                if (c !== '.' && c !== 'G') break;
                for (const e of this.ents) if (e.x === x && e.y === y) { e.spot = true; o.sees = true; }
            }
            if (o.sees && !was) { Sfx.play(this, 'blip'); this.time.delayedCall(110, () => Sfx.play(this, 'blip')); this._note('A SENTRY SQUEAKS: ONE\'S IN ITS LINE.'); }
        }
    }
    _note(t) {
        this.tweens.killTweensOf(this.noteTxt);
        this.noteTxt.setText(t).setAlpha(1);
        this.tweens.add({ targets: this.noteTxt, alpha: 0, delay: 1300, duration: 500 });
    }
    // the surge on or off: the view widens, the goo comes
    _surge(on) {
        const C = MirrorTrial.CFG;
        this.surging = on;
        this.tweens.killTweensOf(this);
        this.tweens.add({ targets: this, fovK: on ? C.SURGE.FOV : 1, surgeK: on ? 1 : 0, duration: on ? 180 : 450, ease: 'Quad.easeOut' });
        if (on) this.cameras.main.shake(160, 0.005);
        else Sfx.play(this, 'hover');
    }
    // every frame: the surge running out, the vials filling back; its pulse, streaks, goo dripping down the view and globs of it
    // floating up, the screen's edge pulsing
    _surgeTick(now, delta) {
        const C = MirrorTrial.CFG, S = C.SURGE, W = this.scale.width, H = this.scale.height, g = this.fx, k = this.surgeK;
        if (this.surging && now >= this.surgeUntil) this._surge(false);
        if (this.charges < this.vials) {
            if ((this.chargeT += delta) >= S.CHARGE_MS) {
                this.chargeT = 0; const can = this.cans[this.charges++];
                Sfx.play(this, 'ready');
                this.tweens.add({ targets: can.full, scale: can.P * 1.15, duration: 120, yoyo: true });
            }
        } else this.chargeT = 0;
        this.cans.forEach((c, i) => {
            for (const o of [c.empty, c.glow]) o.setVisible(i < this.vials);   // (a flask not found yet: not there)
            const f = i >= this.vials ? 0 : i < this.charges ? 1 : i === this.charges ? this.chargeT / S.CHARGE_MS : 0;
            const rows = Math.round(13 * f);   // (it fills a pixel row at a time)
            c.full.setVisible(rows > 0).setCrop(0, 13 - rows, 10, rows);
            c.glow.setAlpha(i < this.charges ? 0.25 + 0.15 * Math.sin(now / 300 + i) : 0);
        });
        const beat = this.surging ? Math.max(0, 1 - ((now - this.beatAt) / C.SURGE.BEAT_MS) * 3) : 0;
        if (this.surging && now - this.beatAt >= S.BEAT_MS) { this.beatAt = now; this.cameras.main.zoomTo(1.025, 70, 'Quad.easeOut', true, (cam, p) => p === 1 && cam.zoomTo(1, 200)); }
        this.surgeGlow.setAlpha(k * (0.06 + 0.07 * beat));
        g.clear();
        // (all of it in the view's own chunky pixels, P screen pixels each)
        const P = Math.max(W / C.W, H / C.H), snap = v => Math.floor(v / P) * P;
        const blob = (cx, cy, r, col, a) => { g.fillStyle(col, a); for (let y = -r; y <= r; y += P) for (let x = -r; x <= r; x += P) if (x * x + y * y <= r * r) g.fillRect(snap(cx + x), snap(cy + y), P, P); };
        if (k > 0.02) {
            for (let i = 0; i < 26; i++) {   // the world rushing past
                const a = Math.random() * Math.PI * 2, r0 = H * (0.4 + Math.random() * 0.32), len = 40 + Math.random() * 160 * k;
                g.fillStyle(Math.random() < 0.35 ? 0xffffff : Math.random() < 0.5 ? 0x8ff4dc : 0x2fe8c8, 0.4 * k);
                for (let t = 0; t < len; t += P) g.fillRect(snap(W / 2 + Math.cos(a) * (r0 + t)), snap(H / 2 + Math.sin(a) * (r0 + t) * 0.7), P, P);
            }
            const edge = P * (1 + Math.round(2 * beat));   // the edge of the screen, pulsing with it
            g.fillStyle(0x2fe8c8, (0.25 + 0.35 * beat) * k).fillRect(0, 0, W, edge).fillRect(0, H - edge, W, edge).fillRect(0, 0, edge, H).fillRect(W - edge, 0, edge, H);
            if (Math.random() < 0.5) this.bubbles.push({ x: Math.random() * W, y: H + 8, vx: (Math.random() - 0.5) * 30, vy: -90 - Math.random() * 160, r: 3 + Math.random() * 7, life: 1 });   // globs of goo floating up
            if (Math.random() < 0.12) (this.drips ||= []).push({ x: Math.random() * W, y: -4, v: 30 + Math.random() * 60, r: 5 + Math.random() * 7, len: 0 });   // goo dripping down from the top
        }
        const dt = delta / 1000;
        this.bubbles = this.bubbles.filter(b => (b.life -= dt * 0.7) > 0 && b.y > -10);
        for (const b of this.bubbles) {   // goo globs: wobbling as they go
            b.x += (b.vx + Math.sin((now + b.r * 200) / 160) * 40) * dt; b.y += b.vy * dt; b.vy *= 0.995;
            blob(b.x, b.y, Math.max(P, b.r), 0x2fb8a2, 0.6 * b.life);
            g.fillStyle(0x8ff4dc, 0.8 * b.life).fillRect(snap(b.x - b.r * 0.4), snap(b.y - b.r * 0.4), P, P);
        }
        this.drips = (this.drips || []).filter(p => p.y < H + 30);
        for (const p of this.drips) {   // drips: a streak from the top, a drop at its end, sliding down and gone when the surge ends
            p.v += 60 * dt; p.y += p.v * dt; p.len = Math.min(p.y, 140);
            const a = 0.6 * Math.max(this.surgeK, 0.2), w = p.r > 8 ? 2 * P : P;
            g.fillStyle(0x2fb8a2, a).fillRect(snap(p.x - w / 2), 0, w, snap(p.y));
            blob(p.x, p.y, p.r, 0x2fb8a2, a);
            g.fillStyle(0x8ff4dc, a).fillRect(snap(p.x - p.r * 0.4), snap(p.y - p.r * 0.3), P, P);
        }
        if (this.surgeK <= 0.02) this.drips = [];
    }
    // walking into a pane: a mirror rings, glass thuds, and it's chalked (an eye, a cross)
    _tap(x, y, c) {
        this.labels[y * 64 + x] = c;
        this._noise(x, y, MirrorTrial.CFG.WAKE.TAP);
        Sfx.play(this, c === 'M' ? 'clink' : 'bonk');
        this.cameras.main.shake(60, 0.002);
        this._note(c === 'M' ? 'IT RINGS: A MIRROR. CHALKED.' : 'A DULL KNOCK: GLASS. CHALKED.');
    }
    _act(k) {
        if (k === 'KeyW' || k === 'ArrowUp') this._step(1);
        else if (k === 'KeyS' || k === 'ArrowDown') this._step(-1);
        else if (k === 'KeyA' || k === 'ArrowLeft') this._turn(-1);
        else if (k === 'KeyD' || k === 'ArrowRight') this._turn(1);
    }
    _open(x, y) { return this.map[y]?.[x] === '.'; }
    _step(s) {
        const [dx, dy] = MirrorTrial.DIRS[this.me.dir], x = this.me.x + dx * s, y = this.me.y + dy * s;
        if (this.done && this.map[y]?.[x] === 'Q') return this._escape();   // back through the mirror, whole
        const c = this.map[y]?.[x];
        if (c === 'L' || c === 'R') { this.map[y][x] = c === 'L' ? 'R' : 'L'; Sfx.play(this, 'switch'); this.cameras.main.shake(60, 0.003); this._noise(x, y, MirrorTrial.CFG.WAKE.TURN); return; }   // a stand: turned a quarter
        if (c === 'M' || c === 'G') return this._tap(x, y, c);
        if (!this._open(x, y) || this.ents.some(e => e.x === x && e.y === y)) { this.cameras.main.shake(80, 0.004); return; }
        this.me.x = x; this.me.y = y; this.moving = true;
        this.tweens.add({ targets: this.view, x: x + 0.5, y: y + 0.5, duration: this.surging ? MirrorTrial.CFG.BOOST_MS : MirrorTrial.CFG.STEP_MS, ease: this.surging ? 'Linear' : 'Sine.easeInOut', onComplete: () => this._moved() });
    }
    _turn(s) {
        this.me.dir = (this.me.dir + s + 4) % 4; this.moving = true;
        this.tweens.add({ targets: this.view, a: this.view.a + s * Math.PI / 2, duration: MirrorTrial.CFG.TURN_MS, ease: 'Sine.easeInOut', onComplete: () => this._moved() });
    }
    _moved() {
        this.moving = false;
        this._pickUp();
        const q = this.queued; this.queued = null;
        if (q && !this.caught && !this.leaving) this._act(q);
    }
    // standing on a shard: the one for your hand, or one of the way out's (all three: it's whole); on glorps: yours (the purse
    // you came in with)
    _pickUp() {
        const { x, y } = this.me, gl = this.glorps.find(o => !o.got && o.x === x && o.y === y), it = this.items.find(o => !o.got && o.x === x && o.y === y);
        if (it) {   // a tool, and what it does
            it.got = true; Sfx.play(this, 'pickup'); this.time.delayedCall(90, () => Sfx.play(this, 'ready'));
            if (it.k === 'v') {
                const can = this.cans[this.vials++]; this.charges++;
                this.tweens.add({ targets: can.full, scale: can.P * 1.3, duration: 140, yoyo: true });
                this._say('A FLASK OF YOUR GOO', this.vials === 1 ? 'Tap SHIFT: a surge of speed. It fills back up, slowly.' : this.vials === 2 ? 'Two now. Hold SHIFT: a blink, through one of them, for both.' : 'A third. They fill back up one at a time.', '#8ff4dc', 3200);
            } else if (it.k === 'd') { this.wards++; this._say('A DECOY SLIME, ASLEEP', 'Q sets it down, staring the way you face.\nThey take it for you: whatever it stares at holds.', '#ffaad2', 3600); }
            else { this.sentryLeft++; this._say('A SENTRY SLIME, ASLEEP', 'E sets it down, watching the way you face.\nIt squeaks when one crosses its line, and they show on your map.', '#8ff4dc', 3600); }
            this._hud();
        }
        if (gl) {
            const G = this.scene.get('Game'), W = this.scale.width, H = this.scale.height;
            gl.got = true; this.gotGlorps += gl.n;
            if (G) { G.totalGlorps = (G.totalGlorps || 0) + gl.n; try { localStorage.setItem('glorps', G.totalGlorps); } catch (e) {} }
            Sfx.play(this, 'coin'); this.time.delayedCall(70, () => Sfx.play(this, 'pickup'));
            this.glorpTxt.setText(`✦ ${this.gotGlorps}`).setScale(1.5);
            this.tweens.add({ targets: this.glorpTxt, scale: 1, duration: 260, ease: 'Back.easeOut' });
            const pop = this.add.text(W / 2, H * 0.62, `+${gl.n}`, { fontSize: '40px', fontFamily: UIKit.FONT.title, fontStyle: 'bold', color: '#5dffb8', stroke: '#05030a', strokeThickness: 6 }).setOrigin(0.5).setDepth(6);
            this.tweens.add({ targets: pop, y: pop.y - 70, alpha: 0, scale: 1.3, duration: 700, ease: 'Quad.easeOut', onComplete: () => pop.destroy() });
            this.cameras.main.flash(90, 60, 200, 120);
        }
        if (this.hand && this.hand.x === x && this.hand.y === y) {
            this.hand = null; this.holding = true; this.shard.setVisible(true);
            Sfx.play(this, 'pickup');
            this._say('A SHARD OF MIRROR', 'Hold SPACE to see what\'s behind you.\nThe way out\'s missing shards are there only in mirrors: look for them in reflections.', '#bfd8ff', 4600);
            this._hud();
            return;
        }
        const s = this.shards.find(o => !o.got && o.x === x && o.y === y);
        if (!s) return;
        s.got = true; this.found++;
        const sleepers = this.ents.filter(e => !e.awake).sort((a, b) => (Math.abs(a.x - x) + Math.abs(a.y - y)) - (Math.abs(b.x - x) + Math.abs(b.y - y)));   // (each shard wakes the nearest still asleep)
        if (sleepers[0]) this._wake(sleepers[0]);
        Sfx.play(this, 'pickup');
        if (this.found < this.shards.length) this._say(`A SHARD OF THE WAY OUT  ${this.found}/${this.shards.length}`, 'They\'re getting restless.', '#bfd8ff', 1800);
        else {
            this.done = true;
            this.map.forEach(row => row.forEach((c, i) => { if (c === 'O') row[i] = 'Q'; }));
            Sfx.play(this, 'surge');
            this._say('THE MIRROR IS WHOLE', 'Go back the way you came. Through it.', '#bfeeff', 3200);
        }
        this._hud();
    }

    update(time, delta) {
        const C = MirrorTrial.CFG, now = this.time.now;
        this._surgeTick(now, delta);
        if (this.shiftDown && !this.blinked && now - this.shiftAt >= C.BLINK.HOLD_MS) { this.blinked = true; this._blink(); }
        // ahead (watching, the shard held up covering some of it), and the shard's view: behind you, flipped as a mirror shows it;
        // the wards' stares; the sentries' lines
        for (const e of this.ents) { e.seen = false; e.spot = false; e.dpx = 0; }
        this._sentryLines(now);
        this.front.cover = this.raised && this.shard;
        this._render(this.front, this.view.a, C.FOV * this.fovK, false, !this.mapUp);
        if (this.holding) this._render(this.back, this.view.a + Math.PI, C.BACK.FOV, true, this.raised);
        if (now < this.blackUntil) for (const e of this.ents) e.seen = false;   // (you've looked away: you hold nothing)
        this._dread(now, delta);
        this._wardsWatch(now);
        this._sentryWatch();
        for (const e of this.ents) if (e.spot) this.lastSeen.set(e, { x: e.x, y: e.y, at: now });   // (anything of yours saw it)
        this._mapShow(this.mapUp ? 'big' : null);
        if (this.mapImg.visible) this._mapInk(now);
        if (!this.caught && !this.escaped && !this.leaving && now - this.t0 > C.GRACE_MS) {
            const ms = Math.max(C.ENT_MIN, C.ENT_MS - C.ENT_SHARD * this.found);
            for (const e of this.ents) {
                if (!e.awake) { if (Math.abs(e.x - this.me.x) + Math.abs(e.y - this.me.y) <= C.WAKE.NEAR) this._wake(e); continue; }   // (asleep: still, till you come too near)
                if (e.seen) e.t = 0;
                else if ((e.t += delta) >= ms * (0.85 + 0.3 * ((e.x * 7 + e.y * 3) % 5) / 4)) { e.t = 0; this._entStep(e); if (this.caught) break; }   // (not all in step)
            }
        }
    }

    // Unseen long enough: a step toward you (the shortest way, round the others), in a new pose for how near it is; next to
    // you, it has you
    _entStep(e) {
        const me = this.me, key = (x, y) => y * 64 + x, from = new Map([[key(e.x, e.y), null]]), q = [[e.x, e.y]];
        const blocked = (x, y) => this.ents.some(o => o !== e && o.x === x && o.y === y);
        while (q.length) {
            const [x, y] = q.shift();
            if (x === me.x && y === me.y) break;
            for (const [dx, dy] of MirrorTrial.DIRS) {
                const nx = x + dx, ny = y + dy, k = key(nx, ny);
                if (!from.has(k) && this._open(nx, ny) && !blocked(nx, ny)) { from.set(k, [x, y]); q.push([nx, ny]); }
            }
        }
        if (!from.has(key(me.x, me.y))) return;
        let at = [me.x, me.y]; const path = [at];
        while (from.get(key(...at))) { at = from.get(key(...at)); path.unshift(at); }
        const [nx, ny] = path[1];
        if (nx === me.x && ny === me.y) return this._caught();
        e.x = nx; e.y = ny;
        this.closest = Math.min(this.closest, Math.abs(nx - me.x) + Math.abs(ny - me.y));
        const near = path.length - 2, pick = near >= 3 ? [2, 3] : [4, 5];
        if (near <= 2 && e.pose < 4) e.fresh = true;   // (turned horrible: the first time you see it, the sting)
        e.pose = pick[0] === e.pose ? pick[1] : pick[1] === e.pose ? pick[0] : pick[Math.random() < 0.5 ? 0 : 1];
        this._hear(e);
    }
    // one moving, heard: from where it is, left or right of the way you face, louder the nearer, dull through stone
    _hear(e) {
        const dx = e.x - this.me.x, dy = e.y - this.me.y, d = Math.hypot(dx, dy);
        if (d > MirrorTrial.CFG.HEAR) return;
        const a = this.view.a, pan = (dx * -Math.sin(a) + dy * Math.cos(a)) / (d || 1);
        let muffled = false;
        for (let i = 1, n = Math.ceil(d * 2); i < n && !muffled; i++) { const c = this.map[Math.floor(this.me.y + 0.5 + dy * i / n)]?.[Math.floor(this.me.x + 0.5 + dx * i / n)]; muffled = c === '#' || c === 'O' || c === 'Q'; }
        Sfx.play(this, 'shift', { pan, near: Math.max(0, 1 - d / MirrorTrial.CFG.HEAR), muffled });
    }
    // one wakes: its eyes open (seen as it happens: a jolt)
    _wake(e) {
        if (e.awake) return;
        e.awake = true; e.pose = 2; e.t = -MirrorTrial.CFG.WAKE.MS;   // (coming to: a moment before its first step, to see it coming)
        Sfx.play(this, 'tell');
        this._note('SOMETHING WOKE UP.');
        if (e.seen) { this.tweens.killTweensOf(this.stingWash); this.stingWash.setAlpha(0.25); this.tweens.add({ targets: this.stingWash, alpha: 0, duration: 500 }); this.cameras.main.shake(140, 0.006); }
    }
    // a noise at (x, y): any asleep within r tiles wakes
    _noise(x, y, r) { for (const e of this.ents) if (!e.awake && Math.abs(e.x - x) + Math.abs(e.y - y) <= r) this._wake(e); }
    // Out: how it went (your time and your best, the glorps, how often you broke, how close they came)
    _escape() {
        if (this.escaped) return;
        this.escaped = true;
        const W = this.scale.width, H = this.scale.height, t = (this.time.now - this.t0) / 1000;
        let best = 0; try { best = parseFloat(localStorage.getItem('mt_best')) || 0; } catch (e) {}
        const isBest = !best || t < best; if (isBest) try { localStorage.setItem('mt_best', t.toFixed(1)); } catch (e) {}
        const clock = v => `${Math.floor(v / 60)}:${(v % 60).toFixed(1).padStart(4, '0')}`;
        Sfx.play(this, 'fanfare'); this.cameras.main.flash(400, 200, 170, 255);
        for (const o of [this.title, this.sub, this.noteTxt, this.countTxt, this.keysTxt]) { this.tweens.killTweensOf(o); o.setAlpha(0); }   // (what was being said: gone)
        this.add.rectangle(0, 0, W, H, 0x05030a).setOrigin(0).setAlpha(0.82).setDepth(7);
        const line = (y, s, size, col) => this.add.text(W / 2, y, s, { fontSize: size, fontFamily: y < H * 0.3 ? UIKit.FONT.title : 'monospace', fontStyle: 'bold', color: col, stroke: '#05030a', strokeThickness: 5, align: 'center' }).setOrigin(0.5).setDepth(8);
        line(H * 0.24, 'YOU GOT OUT', '44px', '#d8c8ff');
        line(H * 0.38, `TIME  ${clock(t)}`, '24px', '#f0ece0');
        line(H * 0.38 + 34, isBest ? (best ? `NEW BEST  (was ${clock(best)})` : 'YOUR FIRST TIME OUT') : `BEST  ${clock(best)}`, '16px', isBest ? '#ffd84a' : '#a898c8');
        line(H * 0.52, `GLORPS  +${this.gotGlorps}`, '18px', '#5dffb8');
        line(H * 0.52 + 30, this.breaks ? `YOU LOOKED AWAY ${this.breaks} TIME${this.breaks > 1 ? 'S' : ''}` : 'YOU NEVER LOOKED AWAY', '18px', '#f0ece0');
        line(H * 0.52 + 60, this.closest === Infinity ? 'NONE OF THEM GOT NEAR YOU' : `CLOSEST CALL  ${this.closest} TILE${this.closest > 1 ? 'S' : ''} AWAY`, '18px', '#ff9ab8');
        line(H * 0.8, 'ENTER  again        ESC  leave', '16px', '#8a7aa8');
    }
    _caught() {
        const W = this.scale.width, H = this.scale.height;
        this.caught = true; this.raised = false;
        Sfx.play(this, 'bosshit'); this.cameras.main.shake(300, 0.012);
        this.add.image(W / 2, H / 2 + H * 0.1, 'mt_twin', 'face').setScale(H / 64 * 1.3).setDepth(5);
        this._say('IT HAS YOU', 'R  try again        ESC  leave', '#ff8aa0', 0);
        this.title.setY(H * 0.8); this.sub.setY(H * 0.8 + 40);   // (under its face)
    }
    _leave(msg) {
        if (this.leaving) return;
        this.leaving = true;
        if (msg) Sfx.play(this, 'whoosh');
        this.cameras.main.fadeOut(450, 0, 0, 0);
        this.time.delayedCall(470, () => {
            const G = this.scene.get('Game'), zoom = this.zoom0;
            if (typeof Music !== 'undefined') Music.duck(false, 'mirror');
            this.scene.stop();
            if (!G) return;
            G.scene.resume();
            G._mirrorBusy = false;
            G.cameras.main.setZoom(zoom); G.cameras.main.fadeIn(500, 8, 4, 16);
            G.updateHUD?.();   // (the glorps picked up in here)
            if (msg && G.player) G.showStatusText?.(G.player.x, G.player.y - 40, msg, '#d8c8ff');
        });
    }

    // ── A VIEW ────────────────────────────────────────────────────────────────
    // Into view V (a canvas), from where you stand, facing angle a: a ray down each column, through glass (its sheet kept, to lay
    // over what's behind), off up to BOUNCES mirrors (their frames kept the same way), on to stone or the way out. Then, column
    // by column, far to near: the sheets and frames, and what stands there: them and the shards (in front of the first mirror
    // or wall), and in the first mirror you and them again (mirrored across its face, behind it and in front of what it shows
    // next). flip: drawn left to right reversed (the shard's). watch: the ones it shows are seen (held).
    _render(V, a, fov, flip, watch) {
        const C = MirrorTrial.CFG, W = V.W, H = V.H, d = V.img.data;
        const px = this.view.x, py = this.view.y, dx = Math.cos(a), dy = Math.sin(a), plx = -dy * fov, ply = dx * fov;
        const lit = t => { const k = Math.max(0, 1 - t / C.FOG); return Math.min(1, k * k * 1.15); };
        const lines = V === this.front && this.lines.size ? this.lines : null;
        // the floor (its flagstones' joints, for knowing where you are) and the dark above
        const r0x = dx - plx, r0y = dy - ply, r1x = dx + plx, r1y = dy + ply;
        for (let y = 0; y < H; y++) {
            const below = y >= H / 2, t = (H / 2) / Math.max(0.5, Math.abs(y - H / 2) + 0.5), b = lit(t * 0.9);
            let fx = px + t * r0x, fy = py + t * r0y;
            const sx = t * (r1x - r0x) / W, sy = t * (r1y - r0y) / W;
            for (let x = 0; x < W; x++, fx += sx, fy += sy) {
                const i = (y * W + x) * 4;
                let r = 14, g = 10, bl = 22;
                if (below) {
                    const ex = fx - Math.floor(fx), ey = fy - Math.floor(fy), joint = ex < 0.04 || ex > 0.96 || ey < 0.04 || ey > 0.96; r = joint ? 16 : 46; g = joint ? 11 : 36; bl = joint ? 26 : 62;
                    const hl = lines && lines.get(Math.floor(fy) * 64 + Math.floor(fx));   // a sentry's line of sight
                    if (hl > 0 && !joint) { g += 70 * hl; bl += 60 * hl; } else if (hl < 0 && !joint) { r -= 140 * hl; bl -= 70 * hl; }   // (teal: a sentry's; pink: a decoy's)
                }
                d[i] = r * b; d[i + 1] = g * b; d[i + 2] = bl * b; d[i + 3] = 255;
            }
        }
        // the rays
        const groups = new Map();
        for (let x = 0; x < W; x++) {
            const cx = 2 * x / W - 1; let rx = dx + plx * cx, ry = dy + ply * cx; const n = Math.hypot(rx, ry); rx /= n; ry /= n;
            const cos = rx * dx + ry * dy, ov = [];
            let ox = px, oy = py, T = 0, first = null, after = Infinity, zOpaque = Infinity;
            for (let b = 0; ; b++) {
                const h = this._cast(ox, oy, rx, ry, ov, T);
                T += h.t;
                if (b === 1) after = T * cos;
                if ((h.c === 'M' || h.c === 'Q' || h.diag) && b < C.BOUNCES) {
                    ov.push({ k: h.diag ? 'mt_mirror' : 'mt_glass', T, u: h.u, tint: h.c === 'Q' ? 2 : h.diag ? 1 : 0 });   // (a mirror in a wall looks like glass)
                    if (this.labels[h.cell]) ov.push({ k: 'mt_mark_m', T, u: h.u });
                    if (b === 0) { zOpaque = T * cos; first = { key: h.diag ? h.c + ':' + h.k : h.side + ':' + h.plane, side: h.side, plane: h.plane, diag: h.diag && h.c, k: h.k, z: T * cos }; if (!groups.has(first.key)) groups.set(first.key, first); }
                    if (h.diag) [rx, ry] = h.c === 'L' ? [-ry, -rx] : [ry, rx];
                    else if (h.side === 0) rx = -rx; else ry = -ry;
                    ox = h.hx; oy = h.hy;
                    continue;
                }
                if (b === 0) zOpaque = T * cos;
                this._slice(V, x, T * cos, h.c === 'O' ? 'mt_broken' : h.c === 'M' || h.c === 'Q' || h.diag ? 'mt_mirror' : 'mt_wall', h.u, lit(T));
                break;
            }
            V.zbuf[x] = zOpaque;
            V.cols[x] = { cos, ov, mirror: first && first.key, mz: first ? first.z : Infinity, after };
        }
        // what stands in the hall: them, the shards on the floor, and in each mirror you and them again
        const sprites = [];
        for (const e of this.ents) sprites.push({ x: e.x + 0.5, y: e.y + 0.5, k: 'mt_twin', f: e.pose, ent: e, big: C.BIG });
        if (V === this.back) for (const s of this.shards) if (!s.got) sprites.push({ x: s.x + 0.5, y: s.y + 0.5, k: 'mt_pickup', f: 0, glint: true, shard: s });   // (the way out's shards: only in reflections, your shard one)
        if (this.hand) sprites.push({ x: this.hand.x + 0.5, y: this.hand.y + 0.5, k: 'mt_pickup', f: 0, glint: true });
        const now = this.time.now;
        for (const w of this.placed) {   // the decoys, from whichever side you see them (its face, back, right, left), flickering as they give out
            if (w.until - now < 1500 && Math.floor(now / 90) % 2) continue;
            const [fx, fy] = MirrorTrial.DIRS[w.dir], vx = w.x + 0.5 - px, vy = w.y + 0.5 - py, n = Math.hypot(vx, vy) || 1, dot = (fx * vx + fy * vy) / n;
            const sq = Math.max(0, 1 - (now - (w.boopAt || -1e9)) / 260);   // (booped: a squish)
            sprites.push({ x: w.x + 0.5, y: w.y + 0.5, k: 'mt_decoy', f: dot < -0.7 ? 0 : dot > 0.7 ? 1 : fx * -dy + fy * dx > 0 ? 2 : 3, glint: true, w, sq: 1 - 0.25 * sq, sw: 1 + 0.3 * sq });
        }
        for (const o of this.sentries) sprites.push({ x: o.x + 0.5, y: o.y + 0.5, k: 'mt_sentry', f: 0, glint: true });
        for (const o of this.glorps) if (!o.got) sprites.push({ x: o.x + 0.5, y: o.y + 0.5, k: 'mt_glorp', f: 0, glint: true });
        for (const o of this.items) if (!o.got) sprites.push({ x: o.x + 0.5, y: o.y + 0.5, k: 'mt_items', f: 'vdn'.indexOf(o.k), glint: true });
        for (const g of groups.values()) {
            const m = (vx, vy) => g.diag === 'L' ? { x: g.k - vy, y: g.k - vx } : g.diag === 'R' ? { x: vy + g.k, y: vx - g.k }
                : g.side === 0 ? { x: 2 * g.plane - vx, y: vy } : { x: vx, y: 2 * g.plane - vy };
            sprites.push({ ...m(px, py), k: 'mt_self', f: 0, in: g.key });
            for (const e of this.ents) sprites.push({ ...m(e.x + 0.5, e.y + 0.5), k: 'mt_twin', f: e.pose, ent: e, big: C.BIG, in: g.key });
            for (const o of this.shards) if (!o.got) sprites.push({ ...m(o.x + 0.5, o.y + 0.5), k: 'mt_pickup', f: 0, glint: true, in: g.key, shard: o });
        }
        const inv = 1 / (plx * dy - dx * ply), per = Array.from({ length: W }, () => []);
        if (V === this.front) V.picks = [];   // (the decoys as drawn, for a click: _boop)
        for (const s of sprites) {
            const rx = s.x - px, ry = s.y - py, tX = inv * (dy * rx - dx * ry), tY = inv * (-ply * rx + plx * ry);
            if (tY < 0.15) continue;
            const sx = (W / 2) * (1 + tX / tY), h = H / tY * (s.big || 1) * (s.sq || 1), w = h * 0.75 * (s.sw || 1) / (s.sq || 1), x0 = Math.floor(sx - w / 2), x1 = Math.ceil(sx + w / 2);
            const pick = s.w && !s.in && V === this.front ? { w: s.w, cols: new Set(), top: Math.floor(H / 2 + H / tY / 2 - h), bottom: Math.ceil(H / 2 + H / tY / 2) } : null;
            if (pick) V.picks.push(pick);
            for (let x = Math.max(0, x0); x < Math.min(W, x1); x++) {
                const col = V.cols[x];
                if (s.in ? (col.mirror !== s.in || tY <= col.mz || tY >= col.after) : tY >= V.zbuf[x]) continue;
                per[x].push({ s, z: tY, u: (x - (sx - w / 2)) / w, h });
                if (s.shard) s.shard.seen = true;   // (seen in a reflection: on the map now)
                pick?.cols.add(x);
            }
        }
        const px0 = new Map(this.ents.map(e => [e, 0])), straight = watch && V === this.front;
        for (let x = 0; x < W; x++) {
            const col = V.cols[x], items = col.ov.map(o => ({ o, z: o.T * col.cos })).concat(per[x]).sort((p, q) => q.z - p.z);
            for (const it of items) {
                if (it.o) { this._slice(V, x, it.z, it.o.k, it.o.u, lit(it.o.T), it.o.tint); continue; }
                const b = lit(it.z / col.cos), n = this._sprite(V, x, it.z, it.s, it.u, it.s.glint ? Math.max(0.55, b) : b, it.h);
                if (it.s.ent) { px0.set(it.s.ent, px0.get(it.s.ent) + n); if (straight && !it.s.in) it.s.ent.dpx += n; }   // (straight on, not in a mirror: the dread's)
            }
        }
        for (const e of this.ents) if (px0.get(e) >= (V === this.back ? C.SEEN_BACK : C.SEEN_PX)) { e.spot = true; if (watch) e.seen = true; }
        // the dither (each channel to a few levels, a 4x4 Bayer pattern between them); flipped, for the shard; cut to its shape
        // (surging, the view ahead: its colours pushed to your teal, and wobbling like jelly, row by row)
        const L = C.LEVELS - 1, BAY = MirrorTrial.BAYER, cut = V === this.back ? this.tex.mt_shard.d : null, sk = V === this.front ? this.surgeK : 0;
        const grey = V === this.front ? this.dread * 0.75 : 0;
        const gain = [1 + 0.05 * sk, 1 + 0.55 * sk, 1 + 0.5 * sk], lift = 12 * sk, wob = 3 * sk, row = this._row ||= new Uint8ClampedArray(W * 4 + 8);
        for (let y = 0; y < H; y++) {
            if (flip) for (let x = 0; x < W / 2; x++) { const i = (y * W + x) * 4, j = (y * W + W - 1 - x) * 4; for (let c = 0; c < 4; c++) { const t = d[i + c]; d[i + c] = d[j + c]; d[j + c] = t; } }
            const sh = wob ? Math.round(Math.sin(y * 0.16 + now / 85) * wob) : 0;
            if (sh) { row.set(d.subarray(y * W * 4, (y + 1) * W * 4)); for (let x = 0; x < W; x++) { const i = (y * W + x) * 4, j = Math.max(0, Math.min(W - 1, x - sh)) * 4; d[i] = row[j]; d[i + 1] = row[j + 1]; d[i + 2] = row[j + 2]; } }
            for (let x = 0; x < W; x++) {
                const i = (y * W + x) * 4, o = BAY[(y & 3) * 4 + (x & 3)];
                if (grey) { const l = d[i] * 0.3 + d[i + 1] * 0.59 + d[i + 2] * 0.11; d[i] += (l - d[i]) * grey; d[i + 1] += (l - d[i + 1]) * grey; d[i + 2] += (l - d[i + 2]) * grey; }
                for (let c = 0; c < 3; c++) d[i + c] = Math.max(0, Math.min(L, Math.round((d[i + c] * gain[c] + lift) / 255 * L + o))) * 255 / L;
                if (cut) d[i + 3] = cut[i + 3] ? 255 : 0;
            }
        }
        V.ctx.putImageData(V.img, 0, 0);
        V.tex.refresh();
    }

    // along a ray from (ox, oy) to the first stone, mirror or the way out; the glass on the way kept in `ov` (at T0 + its distance).
    // (The cell it starts in isn't looked at: off a stand's mirror, the ray goes on from inside its cell.)
    _cast(ox, oy, rx, ry, ov, T0) {
        let mx = Math.floor(ox), my = Math.floor(oy);
        const ddx = Math.abs(1 / rx), ddy = Math.abs(1 / ry), sx = rx < 0 ? -1 : 1, sy = ry < 0 ? -1 : 1;
        let tx = (rx < 0 ? ox - mx : mx + 1 - ox) * ddx, ty = (ry < 0 ? oy - my : my + 1 - oy) * ddy;
        for (let n = 0; n < 64; n++) {
            let side, t;
            if (tx < ty) { t = tx; tx += ddx; mx += sx; side = 0; } else { t = ty; ty += ddy; my += sy; side = 1; }
            if (T0 + t < MirrorTrial.CFG.FOG) this.known.add(my * 64 + mx);   // (seen: on the map)
            const c = this.map[my]?.[mx] ?? '#';
            if (c === '.') continue;
            if (c === 'L' || c === 'R') {   // a stand: its mirror runs corner to corner (L: x + y = k, R: x - y = k); a ray may pass it by
                const k = c === 'L' ? mx + my + 1 : mx - my, den = c === 'L' ? rx + ry : rx - ry;
                const td = Math.abs(den) < 1e-9 ? -1 : (c === 'L' ? k - ox - oy : k - ox + oy) / den;
                if (td >= t - 1e-9 && td <= Math.min(tx, ty) + 1e-9) { const hx = ox + rx * td, hy = oy + ry * td; return { t: td, c, diag: true, k, u: hx - mx, hx, hy }; }
                continue;
            }
            const hx = ox + rx * t, hy = oy + ry * t, u = side === 0 ? hy - Math.floor(hy) : hx - Math.floor(hx);
            if (c === 'G') { ov.push({ k: 'mt_glass', T: T0 + t, u }); if (this.labels[my * 64 + mx]) ov.push({ k: 'mt_mark_g', T: T0 + t, u }); continue; }
            return { t, c, side, u, hx, hy, cell: my * 64 + mx, plane: side === 0 ? (sx > 0 ? mx : mx + 1) : (sy > 0 ? my : my + 1) };
        }
        return { t: 64, c: '#', side: 0, u: 0, hx: ox, hy: oy, plane: 0 };
    }
    // a texture's column u, a tile tall at depth z, over column x of view V (blended by its alpha; tint: a mirror's cold
    // sheen first, 2 the way out's, whole again, violet)
    _slice(V, x, z, k, u, b, tint) {
        const W = V.W, H = V.H, tex = this.tex[k], d = V.img.data, h = H / z, top = H / 2 - h / 2;
        const tx = Math.min(tex.w - 1, Math.floor(u * tex.w)), [tr, tg, tb] = tint === 2 ? [200, 150, 255] : [160, 200, 255], ta = tint === 2 ? 0.25 : 0.12;
        for (let y = Math.max(0, Math.floor(top)), y1 = Math.min(H, Math.ceil(top + h)); y < y1; y++) {
            const i = (y * W + x) * 4;
            if (tint) { d[i] = d[i] * (1 - ta) + tr * ta * b; d[i + 1] = d[i + 1] * (1 - ta) + tg * ta * b; d[i + 2] = d[i + 2] * (1 - ta) + tb * ta * b; }
            const j = (Math.max(0, Math.min(tex.h - 1, Math.floor((y - top) / h * tex.h))) * tex.w + tx) * 4, al = tex.d[j + 3] / 255;
            if (!al) continue;
            for (let c = 0; c < 3; c++) d[i + c] = d[i + c] * (1 - al) + tex.d[j + c] * b * al;
        }
    }
    // view V's pixel (x, y) behind the shard held up (its glass, its edge, your hand): there, you can't see
    _covered(V, x, y) {
        const S = V.cover, P = this.scale.width / V.W, T = this.tex.mt_shard;
        const u = Math.floor(((x + 0.5) * P - (S.x - T.w / 2 * S.scaleX)) / S.scaleX), v = Math.floor(((y + 0.5) * P - (S.y - T.h / 2 * S.scaleY)) / S.scaleY);
        return u >= 0 && v >= 0 && u < T.w && v < T.h && T.d[(v * T.w + u) * 4 + 3] > 0;
    }
    // a sprite's column u (its pose f, in a strip), standing on the floor at depth z (s.big: taller); how many lit pixels it put down
    _sprite(V, x, z, s, u, b, sh) {
        const C = MirrorTrial.CFG, W = V.W, H = V.H, tex = this.tex[s.k], fw = tex.fw || tex.w, d = V.img.data, h = sh || H / z * (s.big || 1), top = H / 2 + H / z / 2 - h;
        const tx = s.f * fw + Math.min(fw - 1, Math.max(0, Math.floor(u * fw)));
        let n = 0;
        for (let y = Math.max(0, Math.floor(top)), y1 = Math.min(H, Math.ceil(top + h)); y < y1; y++) {
            const j = (Math.max(0, Math.min(tex.h - 1, Math.floor((y - top) / h * tex.h))) * tex.w + tx) * 4, al = tex.d[j + 3] / 255;
            if (al < 0.5) continue;
            const i = (y * W + x) * 4;
            for (let c = 0; c < 3; c++) d[i + c] = tex.d[j + c] * b + 30 * b * (c === 2);
            if (b >= C.LIT && !(V.cover && this._covered(V, x, y))) n++;
        }
        return n;
    }
}
