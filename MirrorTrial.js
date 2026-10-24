// ═══════════════════════════════════════════════════════════════════════════
// MirrorTrial.js — the Hall of Reflections, a first try (the Training Ground's TRIAL page).
//
// You step through a mirror into a hall and see through your slime's eyes, a step a tile and a quarter turn at a time. The
// mirror breaks behind you, and the things in the hall take your powers the moment you're in: you can't fight them, only
// get out. They're bigger than you and they move only while nothing sees them, never while you watch, and only ever in
// still poses: far off, asleep, looking like you; nearer, awake and wrong; close, all mouth and eyes. Watching them holds
// them, but don't meet their eyes: looking straight at one that's awake fills you with dread (the screen darkens, cracks,
// your heart pounds) till you can't bear it and look away, and for a moment nothing watches them. In a mirror they can't
// reach you that way: watch them there. The hall's mirrors see for
// you: the ones at the ends of its corridors show you what's behind, and the mirror stands at its corners (at 45 degrees:
// walk into one to turn it) show you round them, so you can watch two ways at once. Glass you see through, and so do they
// (it's in the way of nothing but walking). A pane of glass and a mirror look the same here, so a mirror can pass for a way
// on: walk into one to tap it (a mirror rings, glass thuds) and you chalk it, an eye for a mirror, a cross for glass.
// You walk slowly. SHIFT cracks open one of your three surges: a rush of speed for a moment, the screen fizzing with it;
// they come back slowly, one at a time. Held, SHIFT spends two at once on a blink: a white flash and you're a few tiles on,
// past one of them if it's in the way (not through stone or glass). Two sentry slimes (E sets one down where you stand, facing
// your way, its line of sight lit on the floor; E again on it picks it up): they hold nothing, but hold F and you see through
// one's eye (A D: the other), and while you do, nothing watches you. Two decoy slimes (Q, you in pink): set one down and it stares the way you face for a while, and they take
// it for you (anything in its line holds) till it pops. On the floor at your feet, a broken shard: hold it up (SPACE) and you see what's behind you, but the
// view dives into the shard and everything in front of you goes unwatched. Find the three shards the way out is missing,
// and it's whole again: step back through it. If one of them reaches you, it has you.
// Drawn small and scaled up: a ray a column through the tile map, off mirrors and through glass, shaded to black with
// distance and dithered to a few levels a colour; the shard's view the same, turned round and flipped, cut to its shape.
// ═══════════════════════════════════════════════════════════════════════════
class MirrorTrial extends Phaser.Scene {
    static CFG = {
        W: 256, H: 144, FOV: 0.66, FOG: 12, BOUNCES: 4, LEVELS: 11,   // the view, drawn this small; how wide; how far you see; mirrors deep; the dither
        BACK: { W: 96, H: 72, FOV: 0.5 },                           // the shard's view (the size of its art, mt_shard)
        STEP_MS: 340, BOOST_MS: 120, TURN_MS: 160, RAISE_MS: 220,    // your step (surging: BOOST_MS), turn, and lifting the shard
        SURGE: { CHARGES: 3, CHARGE_MS: 9000, MS: 2200, FOV: 1.22, BEAT_MS: 420 },   // surges: how many, one back every CHARGE_MS, how long one lasts; the view widened; its heartbeat
        WARDS: 2, WARD_MS: 7000, WARD_RANGE: 8,                      // decoy slimes: how many, how long one stares, how far
        BLINK: { HOLD_MS: 280, TILES: 3, COST: 2 },                  // SHIFT held this long: a blink, up to TILES on, for COST surges
        SENTRY: { N: 2, RANGE: 9, LIT_MS: 2500, SIGHT: 1.4 },          // sentries: how many, how far one's line is lit, how bright just set down; how much further they see
        ENT_MS: 900, ENT_SHARD: 90, ENT_MIN: 520, GRACE_MS: 3200,    // unseen this long, one moves (quicker by ENT_SHARD a shard found); none at first
        SEEN_PX: 6, SEEN_BACK: 3, LIT: 0.05, BIG: 1.35,              // this much of one on screen (in the shard), this lit, holds it; how tall they stand
        DREAD: { RISE: 0.2, CLOSE: 1.3, CLOSE_PX: 3500, FALL: 0.3, WAIT: 500, OUT_MS: 1700, AFTER: 0.55, STING: 0.25 },   // a second's straight look at one awake (more the more it fills your view); ebbing after WAIT; full, you look away OUT_MS, back at AFTER; the sting of one turning near
    };
    // # stone, G glass, M mirror, L R mirror stands at 45 degrees (L like /, R like \), O the way out (broken), s a missing shard,
    // h the shard for your hand, g glorps, W one of them, P you (facing north). The corridors end in mirrors; the middle's a room of glass.
    static MAP = [
        '#################',
        'Mg.....W#......gM',
        '#.#####.#.#####.#',
        '#.#s.g..#..g.s#.#',
        '#.#.###...###.#.#',
        '#g....#.#.#....g#',
        '###.#.GGGGG.#.###',
        '#..g#.Gg..G.#g..#',
        '#.#.R.G.s.G.L.#.#',
        '#W#...G..gG...#W#',
        '#.###.GG.GG.###.#',
        '#g......h......g#',
        '#.#####...#####.#',
        'M...g...P...g...M',
        '########O########',
    ];
    static DIRS = [[0, -1], [1, 0], [0, 1], [-1, 0]];   // north, east, south, west
    static TEX = ['mt_wall', 'mt_glass', 'mt_mirror', 'mt_broken', 'mt_self', 'mt_twin', 'mt_shard', 'mt_pickup', 'mt_decoy', 'mt_mark_m', 'mt_mark_g', 'mt_sentry', 'mt_glorp'];
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
        this.ents = []; this.shards = []; this.glorps = []; this.hand = null; this.gotGlorps = 0;
        this.map.forEach((row, y) => row.forEach((c, x) => {
            if (c === 'P') this.me = { x, y, dir: 0 };
            else if (c === 'W') this.ents.push({ x, y, pose: 0, t: 0, seen: false });
            else if (c === 's') this.shards.push({ x, y });
            else if (c === 'h') this.hand = { x, y };
            else if (c === 'g') this.glorps.push({ x, y, n: 3 + Math.floor(Math.random() * 4) });
            else return;
            row[x] = '.';
        }));
        this.view = { x: this.me.x + 0.5, y: this.me.y + 0.5, a: -Math.PI / 2 };
        Object.assign(this, { found: 0, holding: false, raised: false, t0: this.time.now, done: false, caught: false, leaving: false, moving: false, queued: null,
            charges: C.SURGE.CHARGES, chargeT: 0, surging: false, surgeUntil: 0, beatAt: 0, fovK: 1, surgeK: 0, bubbles: [], wards: C.WARDS, placed: [], labels: {},
            shiftDown: false, shiftAt: 0, blinked: false, sentries: [], sentryLeft: C.SENTRY.N, linked: false, linkIdx: 0, lines: new Map(),
            dread: 0, dreadAt: 0, blackUntil: 0, heartAt: 0 });
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
        this.tex.mt_twin.fw = this.tex.mt_decoy.fw = 48;   // strips: its poses, the decoy's four sides
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
        this.sub = T(H * 0.38 + 44, 'The mirror breaks behind you. Something here takes your powers.\nThey move only while unwatched. Don\'t meet their eyes: watch them in mirrors.', '16px', '#a898c8');
        this.time.delayedCall(1300, () => { Sfx.play(this, 'shatter'); this.cameras.main.shake(200, 0.006); });
        this.time.delayedCall(2300, () => Sfx.play(this, 'e_absorb'));
        this.tweens.add({ targets: [this.title, this.sub], alpha: 0, delay: C.GRACE_MS - 500, duration: 600 });
        this.keysTxt = this.add.text(W / 2, H - 30, '', { fontSize: '13px', fontFamily: 'monospace', align: 'center', lineSpacing: 4, color: '#8a7aa8', stroke: '#05030a', strokeThickness: 3 }).setOrigin(0.5).setDepth(6);
        this.fx = this.add.graphics().setDepth(4);   // the surge's streaks, fizz and pulse
        this.surgeGlow = this.add.rectangle(0, 0, W, H, 0x8cff3a).setOrigin(0).setBlendMode(Phaser.BlendModes.ADD).setAlpha(0).setDepth(3);
        // the surges: three cans, bottom left; an empty one fills back up from the bottom
        const ct = this.textures.get('mt_charge');
        if (!ct.has('full')) { ct.add('full', 0, 0, 0, 20, 36); ct.add('empty', 0, 20, 0, 20, 36); }
        this.cans = Array.from({ length: C.SURGE.CHARGES }, (_, i) => {
            const x = 40 + i * 50, y = H - 78;
            return { glow: this.add.image(x, y, 'vfx_glow').setTint(0x8cff3a).setBlendMode(Phaser.BlendModes.ADD).setScale(0.5).setAlpha(0.35).setDepth(5),
                     empty: this.add.image(x, y, 'mt_charge', 'empty').setScale(2).setDepth(5), full: this.add.image(x, y, 'mt_charge', 'full').setScale(2).setDepth(5) };
        });
        this.surgeTxt = this.add.text(W / 2, H * 0.3, 'SURGE!', { fontSize: '54px', fontFamily: UIKit.FONT.title, fontStyle: 'bold', color: '#c8ff3a', stroke: '#0d2a06', strokeThickness: 8 }).setOrigin(0.5).setDepth(6).setAlpha(0);
        this.dreadG = this.add.graphics().setDepth(4.2);   // the dread: the edges darkening, the cracks
        this.black = this.add.rectangle(0, 0, W, H, 0x000000).setOrigin(0).setAlpha(0).setDepth(4.9);   // looking away
        this.stingWash = this.add.rectangle(0, 0, W, H, 0xff1030).setOrigin(0).setBlendMode(Phaser.BlendModes.ADD).setAlpha(0).setDepth(4.3);   // the sting: red over it, not hiding it
        this.linkG = this.add.graphics().setDepth(4.5);   // seeing through a sentry: scanlines, static, its frame
        this.linkTxt = this.add.text(24, 20, '', { fontSize: '15px', fontFamily: 'monospace', fontStyle: 'bold', color: '#8ff4dc', stroke: '#05030a', strokeThickness: 4 }).setDepth(6).setVisible(false);
        this.glorpTxt = this.add.text(W - 24, 20, '', { fontSize: '20px', fontFamily: UIKit.FONT.title, fontStyle: 'bold', color: '#5dffb8', stroke: '#05030a', strokeThickness: 5 }).setOrigin(1, 0).setDepth(6);
        this.noteTxt = this.add.text(W / 2, H * 0.72, '', { fontSize: '18px', fontFamily: UIKit.FONT.title, fontStyle: 'bold', color: '#f0ece0', stroke: '#05030a', strokeThickness: 5 }).setOrigin(0.5).setDepth(6).setAlpha(0);
        this.countTxt = this.add.text(W / 2, 22, '', { fontSize: '15px', fontFamily: UIKit.FONT.title, fontStyle: 'bold', color: '#bfd8ff', stroke: '#05030a', strokeThickness: 4 }).setOrigin(0.5).setDepth(6);
        this._hud();
        this.input.keyboard.on('keydown', this._key, this);
        this.input.keyboard.on('keyup', this._keyUp, this);
        this.events.once('shutdown', () => { this.input.keyboard.off('keydown', this._key, this); this.input.keyboard.off('keyup', this._keyUp, this); });
        if (typeof Music !== 'undefined') Music.duck(true, 'mirror');
        this.cameras.main.fadeIn(700, 8, 4, 16);
    }

    _hud() {
        this.keysTxt.setText(`W S step · A D turn · SHIFT tap: surge, hold: blink (2)${this.holding ? ' · SPACE (hold) the shard' : ''} · walk into a pane: tap it, a stand: turn it\n`
            + `Q decoy slime (${this.wards}) · E set down / pick up a sentry (${this.sentryLeft}) · F (hold) see through it, A D the other · ESC leave`);
        this.countTxt.setText(this.holding ? `SHARDS OF THE WAY OUT  ${'◆ '.repeat(this.found)}${'◇ '.repeat(this.shards.length - this.found)}`.trim() : '');
    }
    _say(a, b, col = '#d8c8ff', hold = 2600) {
        for (const o of [this.title, this.sub]) { this.tweens.killTweensOf(o); o.setAlpha(1); }
        this.title.setText(a).setColor(col); this.sub.setText(b || '');
        if (hold) this.tweens.add({ targets: [this.title, this.sub], alpha: 0, delay: hold, duration: 600 });
    }
    // the shard: low in your hand, or held up before your eyes (filling the view)
    _shardAt(up, ms) {
        const W = this.scale.width, H = this.scale.height, to = up ? { x: W / 2, y: H / 2, scale: H * 0.94 / 72, angle: 0 } : { x: W - 150, y: H - 110, scale: 2.4, angle: -8 };
        this.tweens.killTweensOf([this.shard, this.dim]);
        if (!ms) { this.shard.setPosition(to.x, to.y).setScale(to.scale).setAngle(to.angle); return; }
        this.tweens.add({ targets: this.shard, ...to, duration: ms, ease: 'Cubic.easeOut' });
        this.tweens.add({ targets: this.dim, alpha: up ? 0.95 : 0, duration: ms });
    }

    _key(e) {
        if (this.leaving) return;
        const k = e.code;
        if (k === 'Escape') return this._leave();
        if (this.caught) { if (k === 'KeyR') this.scene.restart({ zoom: this.zoom0 }); return; }
        if (k === 'Space') { if (this.holding && !this.raised && !this.linked) { this.raised = true; Sfx.play(this, 'hover'); this._shardAt(true, MirrorTrial.CFG.RAISE_MS); } return; }
        if (k === 'ShiftLeft' || k === 'ShiftRight') { if (!e.repeat) { this.shiftDown = true; this.shiftAt = this.time.now; this.blinked = false; } return; }   // (let go soon: a surge; held: a blink, in update)
        if (k === 'KeyF') { if (!e.repeat && this.sentries.length) { this.linked = true; this.linkIdx = Math.min(this.linkIdx, this.sentries.length - 1); this.shard.setVisible(false); Sfx.play(this, 'e_bind'); } return; }
        if (this.linked) { if (k === 'KeyA' || k === 'KeyD' || k === 'ArrowLeft' || k === 'ArrowRight') { this.linkIdx = (this.linkIdx + 1) % this.sentries.length; Sfx.play(this, 'blip'); } return; }   // (in a trance: only the other sentry)
        if (k === 'KeyQ') return this._ward();
        if (k === 'KeyE') return this._sentry();
        if (this.moving) { this.queued = k; return; }
        this._act(k);
    }
    _keyUp(e) {
        if (e.code === 'Space' && this.raised) { this.raised = false; this._shardAt(false, MirrorTrial.CFG.RAISE_MS); }
        if ((e.code === 'ShiftLeft' || e.code === 'ShiftRight') && this.shiftDown) { this.shiftDown = false; if (!this.blinked) this._surgeGo(); }
        if (e.code === 'KeyF' && this.linked) { this.linked = false; this.shard.setVisible(this.holding); }
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
    // SHIFT: a can cracked open, a surge (another while one runs adds to it)
    _surgeGo() {
        const C = MirrorTrial.CFG, W = this.scale.width, H = this.scale.height;
        if (this.charges <= 0 || this.caught || this.leaving) return this._noCans();
        const can = this.cans[--this.charges];
        this.surgeUntil = Math.max(this.surgeUntil, this.time.now) + C.SURGE.MS;
        if (!this.surging) this._surge(true);
        Sfx.play(this, 'gulp'); this.time.delayedCall(110, () => Sfx.play(this, 'surge'));
        this.cameras.main.flash(180, 150, 255, 70);
        this.tweens.killTweensOf(this.surgeTxt);
        this.surgeTxt.setAlpha(1).setScale(1.7).setAngle(-6 + Math.random() * 12);
        this.tweens.add({ targets: this.surgeTxt, scale: 1, duration: 260, ease: 'Back.easeOut' });
        this.tweens.add({ targets: this.surgeTxt, alpha: 0, delay: 450, duration: 400 });
        this.tweens.add({ targets: can.full, scale: 2.7, duration: 90, yoyo: true });
        for (let n = 0; n < 40; n++) this.bubbles.push({ x: can.full.x + (Math.random() - 0.5) * 30, y: can.full.y - 30, vx: (Math.random() - 0.3) * 260, vy: -150 - Math.random() * 380, r: 2 + Math.random() * 5, life: 1 });   // the fizz, spraying out of it
    }
    _noCans() {
        Sfx.play(this, 'deny');
        for (const c of this.cans) { this.tweens.killTweensOf(c.empty); this.tweens.add({ targets: c.empty, x: c.empty.x + 3, duration: 40, yoyo: true, repeat: 2 }); }
    }
    // SHIFT held: two cans at once, a white flash, and you're a few tiles on (past one of them, not through stone or glass)
    _blink() {
        const C = MirrorTrial.CFG, [dx, dy] = MirrorTrial.DIRS[this.me.dir];
        if (this.charges < C.BLINK.COST || this.moving || this.caught || this.leaving || this.linked) return this._noCans();
        let land = 0;
        for (let i = 1; i <= C.BLINK.TILES; i++) {
            const x = this.me.x + dx * i, y = this.me.y + dy * i;
            if (!this._open(x, y)) break;
            if (!this.ents.some(e => e.x === x && e.y === y)) land = i;
        }
        if (!land) return this._noCans();
        for (let n = 0; n < C.BLINK.COST; n++) { const can = this.cans[--this.charges]; this.tweens.add({ targets: can.full, scale: 2.7, duration: 90, yoyo: true }); }
        const x = this.me.x + dx * land, y = this.me.y + dy * land;
        this.me.x = x; this.me.y = y; this.moving = true;
        this.cameras.main.flash(280, 255, 255, 255); this.cameras.main.shake(120, 0.006);
        Sfx.play(this, 'dash'); Sfx.play(this, 'whoosh');
        this.tweens.add({ targets: this.view, x: x + 0.5, y: y + 0.5, duration: 90, ease: 'Quad.easeOut', onComplete: () => this._moved() });
    }
    // E: a sentry set down where you stand, facing your way; or, standing on one, picked back up
    _sentry() {
        const { x, y, dir } = this.me, i = this.sentries.findIndex(o => o.x === x && o.y === y);
        if (i >= 0) { this.sentries.splice(i, 1); this.sentryLeft++; Sfx.play(this, 'pickup'); this._note('SENTRY PICKED UP'); }
        else if (this.sentryLeft > 0) { this.sentries.push({ x, y, dir, at: this.time.now }); this.sentryLeft--; Sfx.play(this, 'pop'); this._note('A SENTRY, LOOKING THAT WAY. HOLD F TO SEE WHAT IT SEES.'); }
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
            Sfx.play(this, 'stinger', { big: true }); this.cameras.main.shake(260, 0.01);
            this.tweens.killTweensOf(this.stingWash); this.stingWash.setAlpha(0.45); this.tweens.add({ targets: this.stingWash, alpha: 0, duration: 650, ease: 'Quad.easeIn' });
            this.cameras.main.zoomTo(1.08, 60, 'Quad.easeOut', true, (c, p) => p === 1 && c.zoomTo(1, 400));   // (it lunges at the screen)
            if (e.dpx) this.dread = Math.min(1, this.dread + D.STING);
        }
        if (now < this.blackUntil) {}
        else if (direct >= C.SEEN_PX) {
            this.dread = Math.min(1, this.dread + (D.RISE + D.CLOSE * Math.min(1, direct / D.CLOSE_PX)) * dt); this.dreadAt = now;
            if (this.dread >= 1) {
                this.blackUntil = now + D.OUT_MS; this.dread = D.AFTER;
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
        for (const pts of this.cracks) {
            const n = Math.floor(pts.length * k);
            if (n < 2) continue;
            g.lineStyle(3, 0x05030a, 0.8 * k); g.beginPath(); g.moveTo(...pts[0]); for (const p of pts.slice(1, n)) g.lineTo(p[0] + 1, p[1] + 1); g.strokePath();
            g.lineStyle(1.5, 0xe8e0ff, 0.6 * k); g.beginPath(); g.moveTo(...pts[0]); for (const p of pts.slice(1, n)) g.lineTo(...p); g.strokePath();
        }
    }
    // seeing through a sentry: its frame, scanlines and static over the view, and the warning
    _linkFx(now, S) {
        const W = this.scale.width, H = this.scale.height, g = this.linkG;
        g.clear(); this.linkTxt.setVisible(!!S);
        if (!S) return;
        for (let y = 0; y < H; y += 4) g.fillStyle(0x000000, 0.22).fillRect(0, y, W, 2);
        for (let n = 0; n < 70; n++) g.fillStyle(0xc8fff0, Math.random() * 0.25).fillRect(Math.random() * W, Math.random() * H, 3, 2);
        g.lineStyle(10, 0x40d8b8, 0.3 + 0.2 * Math.sin(now / 110)).strokeRect(5, 5, W - 10, H - 10);
        this.linkTxt.setText(`SENTRY ${this.linkIdx + 1} OF ${this.sentries.length}      NOTHING IS WATCHING YOU`);
    }
    _note(t) {
        this.tweens.killTweensOf(this.noteTxt);
        this.noteTxt.setText(t).setAlpha(1);
        this.tweens.add({ targets: this.noteTxt, alpha: 0, delay: 1300, duration: 500 });
    }
    // the surge on or off: the view widens, the screen fizzes
    _surge(on) {
        const C = MirrorTrial.CFG;
        this.surging = on;
        this.tweens.killTweensOf(this);
        this.tweens.add({ targets: this, fovK: on ? C.SURGE.FOV : 1, surgeK: on ? 1 : 0, duration: on ? 180 : 450, ease: 'Quad.easeOut' });
        if (on) this.cameras.main.shake(160, 0.005);
        else Sfx.play(this, 'hover');
    }
    // every frame: the surge running out, the cans coming back; its heartbeat, streaks, fizz and the screen's edge pulsing
    _surgeTick(now, delta) {
        const C = MirrorTrial.CFG, S = C.SURGE, W = this.scale.width, H = this.scale.height, g = this.fx, k = this.surgeK;
        if (this.surging && now >= this.surgeUntil) this._surge(false);
        if (this.charges < S.CHARGES) {
            if ((this.chargeT += delta) >= S.CHARGE_MS) {
                this.chargeT = 0; const can = this.cans[this.charges++];
                Sfx.play(this, 'ready');
                this.tweens.add({ targets: can.full, scale: 2.5, duration: 120, yoyo: true });
            }
        } else this.chargeT = 0;
        this.cans.forEach((c, i) => {
            const f = i < this.charges ? 1 : i === this.charges ? this.chargeT / S.CHARGE_MS : 0;
            c.full.setVisible(f > 0).setCrop(0, 36 * (1 - f), 20, 36 * f);
            c.glow.setAlpha(i < this.charges ? 0.25 + 0.15 * Math.sin(now / 300 + i) : 0);
        });
        const beat = this.surging ? Math.max(0, 1 - ((now - this.beatAt) / C.SURGE.BEAT_MS) * 3) : 0;
        if (this.surging && now - this.beatAt >= S.BEAT_MS) { this.beatAt = now; this.cameras.main.zoomTo(1.025, 70, 'Quad.easeOut', true, (cam, p) => p === 1 && cam.zoomTo(1, 200)); }
        this.surgeGlow.setAlpha(k * (0.06 + 0.07 * beat));
        g.clear();
        if (k > 0.02) {
            for (let i = 0; i < 34; i++) {   // the world rushing past
                const a = Math.random() * Math.PI * 2, r0 = H * (0.4 + Math.random() * 0.32), len = 40 + Math.random() * 160 * k;
                g.lineStyle(1 + Math.random() * 2.5, Math.random() < 0.35 ? 0xffffff : Math.random() < 0.5 ? 0xc8ff3a : 0x5afff0, 0.4 * k);
                g.lineBetween(W / 2 + Math.cos(a) * r0, H / 2 + Math.sin(a) * r0 * 0.7, W / 2 + Math.cos(a) * (r0 + len), H / 2 + Math.sin(a) * (r0 + len) * 0.7);
            }
            const edge = 6 + 14 * beat;   // the edge of the screen, pulsing with it
            g.lineStyle(edge, 0x8cff3a, (0.25 + 0.35 * beat) * k).strokeRect(edge / 2, edge / 2, W - edge, H - edge);
            for (let n = 0; n < 3; n++) this.bubbles.push({ x: Math.random() * W, y: H + 8, vx: (Math.random() - 0.5) * 30, vy: -120 - Math.random() * 240, r: 2 + Math.random() * 6, life: 1 });   // fizz rising up the screen
        }
        const dt = delta / 1000;
        this.bubbles = this.bubbles.filter(b => (b.life -= dt * 0.7) > 0 && b.y > -10);
        for (const b of this.bubbles) {
            b.x += (b.vx + Math.sin((now + b.r * 200) / 160) * 40) * dt; b.y += b.vy * dt; b.vy *= 0.995;
            g.lineStyle(1.5, b.r > 5 ? 0xffffff : 0xc8ff3a, 0.7 * b.life).strokeCircle(b.x, b.y, b.r);
            if (b.r > 4) g.fillStyle(0xffffff, 0.6 * b.life).fillCircle(b.x - b.r * 0.35, b.y - b.r * 0.35, 1.2);
        }
    }
    // walking into a pane: a mirror rings, glass thuds, and it's chalked (an eye, a cross)
    _tap(x, y, c) {
        this.labels[y * 64 + x] = c;
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
        if (this.done && this.map[y]?.[x] === 'Q') return this._leave('YOU GOT OUT OF THE HALL OF REFLECTIONS');   // back through the mirror, whole
        const c = this.map[y]?.[x];
        if (c === 'L' || c === 'R') { this.map[y][x] = c === 'L' ? 'R' : 'L'; Sfx.play(this, 'switch'); this.cameras.main.shake(60, 0.003); return; }   // a stand: turned a quarter
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
        const { x, y } = this.me, gl = this.glorps.find(o => !o.got && o.x === x && o.y === y);
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
            this._say('A SHARD OF MIRROR', 'Hold SPACE to see what\'s behind you.\nWhile you do, nothing watches what\'s in front.', '#bfd8ff', 3800);
            this._hud();
            return;
        }
        const s = this.shards.find(o => !o.got && o.x === x && o.y === y);
        if (!s) return;
        s.got = true; this.found++;
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
        // ahead (watching, unless the shard is up), and the shard's view: behind you, flipped as a mirror shows it; or, linked, a
        // sentry's (watching nothing); the wards' stares
        for (const e of this.ents) { e.seen = false; e.dpx = 0; }
        this._sentryLines(now);
        const S = this.linked && this.sentries[this.linkIdx];
        if (S) this._render(this.front, (S.dir - 1) * Math.PI / 2, C.FOV, false, false, { x: S.x + 0.5, y: S.y + 0.5 });
        else this._render(this.front, this.view.a, C.FOV * this.fovK, false, !this.raised);
        if (this.holding && !S) this._render(this.back, this.view.a + Math.PI, C.BACK.FOV, true, this.raised);
        if (now < this.blackUntil) for (const e of this.ents) e.seen = false;   // (you've looked away: you hold nothing)
        this._dread(now, delta);
        this._wardsWatch(now);
        this._linkFx(now, S);
        if (!this.caught && !this.leaving && now - this.t0 > C.GRACE_MS) {
            const ms = Math.max(C.ENT_MIN, C.ENT_MS - C.ENT_SHARD * this.found);
            for (const e of this.ents) {
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
        const near = path.length - 2, pick = near >= 6 ? [0, 1] : near >= 3 ? [2, 3] : [4, 5];
        if (near <= 2 && e.pose < 4) e.fresh = true;   // (turned horrible: the first time you see it, the sting)
        e.pose = pick[0] === e.pose ? pick[1] : pick[1] === e.pose ? pick[0] : pick[Math.random() < 0.5 ? 0 : 1];
        if (near <= 5) Sfx.play(this, 'snap');
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
    // next). flip: drawn left to right reversed (the shard's). watch: the ones it shows are seen (held). eye: a sentry's, seen
    // from instead of you (further, in its own colours, them picked out red; you in a mirror not drawn).
    _render(V, a, fov, flip, watch, eye) {
        const C = MirrorTrial.CFG, W = V.W, H = V.H, d = V.img.data, fog = C.FOG * (eye ? C.SENTRY.SIGHT : 1);
        const px = eye ? eye.x : this.view.x, py = eye ? eye.y : this.view.y, dx = Math.cos(a), dy = Math.sin(a), plx = -dy * fov, ply = dx * fov;
        const lit = t => { const k = Math.max(0, 1 - t / fog); return Math.min(1, k * k * 1.15); };
        const lines = !eye && V === this.front && this.lines.size ? this.lines : null, red = V.red ||= new Uint8Array(W * H);
        V.eye = !!eye; if (eye) red.fill(0);
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
        for (const s of this.shards) if (!s.got) sprites.push({ x: s.x + 0.5, y: s.y + 0.5, k: 'mt_pickup', f: 0, glint: true });
        if (this.hand) sprites.push({ x: this.hand.x + 0.5, y: this.hand.y + 0.5, k: 'mt_pickup', f: 0, glint: true });
        const now = this.time.now;
        for (const w of this.placed) {   // the decoys, from whichever side you see them (its face, back, right, left), flickering as they give out
            if (w.until - now < 1500 && Math.floor(now / 90) % 2) continue;
            const [fx, fy] = MirrorTrial.DIRS[w.dir], vx = w.x + 0.5 - px, vy = w.y + 0.5 - py, n = Math.hypot(vx, vy) || 1, dot = (fx * vx + fy * vy) / n;
            sprites.push({ x: w.x + 0.5, y: w.y + 0.5, k: 'mt_decoy', f: dot < -0.7 ? 0 : dot > 0.7 ? 1 : fx * -dy + fy * dx > 0 ? 2 : 3, glint: true });
        }
        for (const o of this.sentries) if (!eye || o.x + 0.5 !== px || o.y + 0.5 !== py) sprites.push({ x: o.x + 0.5, y: o.y + 0.5, k: 'mt_sentry', f: 0, glint: true });
        for (const o of this.glorps) if (!o.got) sprites.push({ x: o.x + 0.5, y: o.y + 0.5, k: 'mt_glorp', f: 0, glint: true });
        for (const g of groups.values()) {
            const m = (vx, vy) => g.diag === 'L' ? { x: g.k - vy, y: g.k - vx } : g.diag === 'R' ? { x: vy + g.k, y: vx - g.k }
                : g.side === 0 ? { x: 2 * g.plane - vx, y: vy } : { x: vx, y: 2 * g.plane - vy };
            if (!eye) sprites.push({ ...m(px, py), k: 'mt_self', f: 0, in: g.key });
            for (const e of this.ents) sprites.push({ ...m(e.x + 0.5, e.y + 0.5), k: 'mt_twin', f: e.pose, ent: e, big: C.BIG, in: g.key });
        }
        const inv = 1 / (plx * dy - dx * ply), per = Array.from({ length: W }, () => []);
        for (const s of sprites) {
            const rx = s.x - px, ry = s.y - py, tX = inv * (dy * rx - dx * ry), tY = inv * (-ply * rx + plx * ry);
            if (tY < 0.15) continue;
            const sx = (W / 2) * (1 + tX / tY), h = H / tY * (s.big || 1), w = h * 0.75, x0 = Math.floor(sx - w / 2), x1 = Math.ceil(sx + w / 2);
            for (let x = Math.max(0, x0); x < Math.min(W, x1); x++) {
                const col = V.cols[x];
                if (s.in ? (col.mirror !== s.in || tY <= col.mz || tY >= col.after) : tY >= V.zbuf[x]) continue;
                per[x].push({ s, z: tY, u: (x - (sx - w / 2)) / w });
            }
        }
        const px0 = new Map(this.ents.map(e => [e, 0])), straight = watch && V === this.front;
        for (let x = 0; x < W; x++) {
            const col = V.cols[x], items = col.ov.map(o => ({ o, z: o.T * col.cos })).concat(per[x]).sort((p, q) => q.z - p.z);
            for (const it of items) {
                if (it.o) { this._slice(V, x, it.z, it.o.k, it.o.u, lit(it.o.T), it.o.tint); continue; }
                const b = lit(it.z / col.cos), n = this._sprite(V, x, it.z, it.s, it.u, it.s.glint ? Math.max(0.55, b) : eye && it.s.ent ? Math.max(0.6, b) : b);
                if (it.s.ent) { px0.set(it.s.ent, px0.get(it.s.ent) + n); if (straight && !it.s.in) it.s.ent.dpx += n; }   // (straight on, not in a mirror: the dread's)
            }
        }
        if (watch) for (const e of this.ents) if (px0.get(e) >= (V === this.back ? C.SEEN_BACK : C.SEEN_PX)) e.seen = true;
        // the dither (each channel to a few levels, a 4x4 Bayer pattern between them); flipped, for the shard; cut to its shape
        // (surging, the view ahead: its colours pushed toward neon, and split, red one way and blue the other)
        const L = C.LEVELS - 1, BAY = MirrorTrial.BAYER, cut = V === this.back ? this.tex.mt_shard.d : null, sk = V === this.front ? this.surgeK : 0;
        const grey = V === this.front ? this.dread * 0.75 : 0;
        const gain = [1 + 0.25 * sk, 1 + 0.7 * sk, 1 + 0.45 * sk], lift = 14 * sk, split = Math.round(3 * sk), row = this._row ||= new Uint8ClampedArray(W * 4 + 8);
        for (let y = 0; y < H; y++) {
            if (flip) for (let x = 0; x < W / 2; x++) { const i = (y * W + x) * 4, j = (y * W + W - 1 - x) * 4; for (let c = 0; c < 4; c++) { const t = d[i + c]; d[i + c] = d[j + c]; d[j + c] = t; } }
            if (split) { row.set(d.subarray(y * W * 4, (y + 1) * W * 4)); for (let x = 0; x < W; x++) { const i = (y * W + x) * 4; d[i] = row[Math.max(0, x - split) * 4]; d[i + 2] = row[Math.min(W - 1, x + split) * 4 + 2]; } }
            for (let x = 0; x < W; x++) {
                const i = (y * W + x) * 4, o = BAY[(y & 3) * 4 + (x & 3)];
                if (grey) { const l = d[i] * 0.3 + d[i + 1] * 0.59 + d[i + 2] * 0.11; d[i] += (l - d[i]) * grey; d[i + 1] += (l - d[i + 1]) * grey; d[i + 2] += (l - d[i + 2]) * grey; }
                if (eye && !red[y * W + x]) { const l = d[i] * 0.3 + d[i + 1] * 0.59 + d[i + 2] * 0.11; d[i] = l * 0.35; d[i + 1] = l * 1.1; d[i + 2] = l * 0.95; }   // (a sentry's eye: its own colours; them, red)
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
            const j = (Math.min(tex.h - 1, Math.floor((y - top) / h * tex.h)) * tex.w + tx) * 4, al = tex.d[j + 3] / 255;
            if (!al) continue;
            for (let c = 0; c < 3; c++) d[i + c] = d[i + c] * (1 - al) + tex.d[j + c] * b * al;
        }
    }
    // a sprite's column u (its pose f, in a strip), standing on the floor at depth z (s.big: taller); how many lit pixels it put down
    _sprite(V, x, z, s, u, b) {
        const C = MirrorTrial.CFG, W = V.W, H = V.H, tex = this.tex[s.k], fw = tex.fw || tex.w, d = V.img.data, h = H / z * (s.big || 1), top = H / 2 + H / z / 2 - h;
        const tx = s.f * fw + Math.min(fw - 1, Math.max(0, Math.floor(u * fw)));
        let n = 0;
        for (let y = Math.max(0, Math.floor(top)), y1 = Math.min(H, Math.ceil(top + h)); y < y1; y++) {
            const j = (Math.min(tex.h - 1, Math.floor((y - top) / h * tex.h)) * tex.w + tx) * 4, al = tex.d[j + 3] / 255;
            if (al < 0.5) continue;
            const i = (y * W + x) * 4;
            if (V.eye && s.ent) { const l = (tex.d[j] + tex.d[j + 1] + tex.d[j + 2]) / 765; d[i] = 255 * b; d[i + 1] = (50 + 200 * l) * b; d[i + 2] = (70 + 180 * l) * b; V.red[y * W + x] = 1; }
            else for (let c = 0; c < 3; c++) d[i + c] = tex.d[j + c] * b + 30 * b * (c === 2);
            if (b >= C.LIT) n++;
        }
        return n;
    }
}
