// ═══════════════════════════════════════════════════════════════════════════
// MirrorTrial.js — the Hall of Reflections, a first try (the Training Ground's TRIAL page).
//
// You step through a mirror into a hall and see through your slime's eyes, a step a tile and a quarter turn at a time. The
// mirror breaks behind you, and the things in the hall take your powers the moment you're in: you can't fight them, only
// get out. They're far beyond you, and you're a game to them: they don't want to hurt you, they want to scare you. They
// sleep at first, and stay asleep till you come too near or make a noise (a dash, a knock on a pane, a stand turned), and
// every fragment of the way out you take wakes another. Awake, they're bigger than you and they move only while nothing
// sees them, never while you watch, and only ever in still poses: far off, asleep, looking like you; nearer, awake and
// wrong; close, your own face, huge and much too near, then BOO. They giggle (where they are, to your ears) when they wake
// and after they've made you jump. Watching them holds them, but don't meet their eyes: looking straight at one that's
// awake fills you with dread (the screen darkens, cracks, your heart pounds) till you can't bear it and look away, and for a
// moment nothing watches them. In a reflection they can't reach you that way: watch them there.
// The way out's three fragments are in mirrors in the hall's walls, and every pane is a mirror or glass. The mirrors here
// don't show you anything straight on: they look just like glass, and you see through both. Only a reflection of a
// reflection shows: turn your back on a pane and hold up your shard (SPACE), and in it a mirror shows you, glass what's beyond.
// But behind some glass one of them stands, only ever seen in a reflection, posed just like you: yours holds up the shard
// as you do (a beat behind you); it doesn't. Your decoys and sentries are made of reflection: a mirror shows them even
// straight on. C marks a pane (your guess, glass or mirror). Walk into a pane to chalk it: a mirror rings (an eye; its
// fragment, if it holds one); glass shatters (a cross), and they hear it: the sleepers near wake, the awake lunge at you,
// and the one behind it, if one was, is awake right there. All three fragments, and the way out is whole again: step back
// through it. They can't hurt you, but they can scare you: one reaching you pranks you (a third of your stress, for good;
// it goes back to sleep far off), and your dread from looking at them goes on top: full dread, you black out for a moment
// (two pranks in, that does it; three, a moment's look); full stress, you're scared to death. The more they've got you, the
// more your heart pounds and the dark pulses in. Hold one in a reflection (your shard, a stand) a while and it slinks off.
// The shard: held up you see behind you, and the view ahead is unwatched behind it; your arm tires (the shard shakes and
// sinks), and when it gives out the shard drops till it's rested a little. The mirror stands at the hall's corners (at 45
// degrees: walk into one to turn it) do show you round them. You walk slowly. SHIFT drinks one of your vials of goo (up to
// three, one a flask found; you come in with one; they fill back up slowly): a dash, a few tiles on in a flash, past one
// of them if it's in the way (not through stone or glass), loud. Found in the hall: decoy slimes (Q, you in pink: set one
// down and it stares the way you face for a while; they take it for you, and anything in its line holds) and sentry
// slimes (E sets one down: one of them coming within its reach, even a wall away, sets it off: it pings twice, each ping
// showing you where they are for a moment, then it's spent). Your map (TAB, held up to your face: nothing watches them) is
// the whole hall: its panes as you've chalked or marked them, your decoys and sentries, you; them only as a ping shows.
// Drawn small and scaled up: a ray a column through the tile map, off mirrors and through glass, shaded to black with
// distance and dithered to a few levels a colour; the shard's view the same, turned round and flipped, cut to its shape.
// ═══════════════════════════════════════════════════════════════════════════
class MirrorTrial extends Phaser.Scene {
    static CFG = {
        W: 256, H: 144, FOV: 0.66, FOG: 12, BOUNCES: 4, LEVELS: 11,   // the view, drawn this small; how wide; how far you see; mirrors deep; the dither
        BACK: { W: 96, H: 72, FOV: 0.5 },                           // the shard's view (the size of its art, mt_shard)
        STEP_MS: 340, TURN_MS: 160, RAISE_MS: 220,                   // your step, turn, and lifting the shard
        ARM: { HOLD_MS: 4000, REST_MS: 10000, BACK: 0.35 },         // the shard held up: your arm gives out after HOLD_MS, rests in REST_MS, back up at BACK
        BLUR: { GROW_MS: 25000, WIPE_MS: 1500, UP: 0.35 },           // the shard down, it fogs up (thick in GROW_MS); held up you see through it better (UP of it); F held wipes it clean in WIPE_MS
        GOO: { VIALS: 3, CHARGE_MS: 9000, FOV: 1.22 },              // your goo: at most this many vials (each a flask found), one back every CHARGE_MS; the view widened as you dash
        WARD_MS: 7000, WARD_RANGE: 8,                                // decoy slimes (found in the hall): how long one stares, how far
        DASH: { TILES: 3, COST: 1 },                                 // SHIFT: a dash, up to TILES on, for COST vials
        SENTRY: { R: 3.5, WALLS: 1, PINGS: 2, EVERY_MS: 3000, SHOW_MS: 1000, LIT_MS: 2500 },   // sentries (found in the hall): their reach (a squircle, through WALLS of stone); set off, PINGS pings EVERY_MS apart, each showing them SHOW_MS; their reach lit, just set down
        MAP: { CELL: 5, BIG: 6, UP_MS: 230 },                        // the map: a tile's size in ink; how big held up
        ENT_MS: 600, ENT_SHARD: 30, ENT_MIN: 450, GRACE_MS: 5000,    // unseen this long, one moves (quicker by ENT_SHARD a shard found: not far off your walk, so you can't leave one be); none at first
        WAKE: { NEAR: 2, DASH: 6, TAP: 4, TURN: 3, MS: 1500 },         // asleep, one wakes: you this near (tiles), or a noise this near; it takes MS to come to
        HEAR: 10,                                                    // how far off you hear one move
        MIRRORS: 0.45, FRAGMENTS: 3, SHATTER: { WAKE: 7, LUNGE: 2 },     // a pane's odds of being a mirror; the way out's fragments (in mirrors); glass struck: sleepers this near wake, the awake lunge this many steps
        TWINS: 0.35, ECHO_MS: 300,                                   // a glass pane's odds of a twin behind it (in reflections, posed like you); how far behind you your reflection is
        SEEN_PX: 6, SEEN_BACK: 3, LIT: 0.05, BIG: 1.35,              // this much of one on screen (in the shard), this lit, holds it; how tall they stand
        SHOO_MS: 2000,                                               // one held in a reflection (your shard, a stand) this long leaves: they don't like being caught there
        DREAD: { RISE: 0.12, CLOSE: 0.6, CLOSE_PX: 3500, FALL: 0.35, WAIT: 500, STING: 0.25, OUT_MS: 1000, AFTER: 0.55 },   // a second's straight look at one awake (more the more it fills your view); ebbing after WAIT; the sting of one turning near; full: you black out OUT_MS, back at AFTER
        STRESS: { PRANK: 0.3, DREAD: 0.4, CALM_MS: 2000 },            // your stress: each prank of theirs adds PRANK for good, your dread on top (full: DREAD); 1: scared to death (two pranks and a full dread; three and a moment's). After a prank, CALM_MS with none of them moving
    };
    // # stone, P a pane (each a mirror or glass, at random; every one a window, open both sides), L R mirror stands at 45 degrees
    // (L like /, R like \), O the way out (broken), h the shard for your hand, g glorps, v a flask of goo, d a decoy slime, n a
    // sentry slime, W one of them, @ you (facing north). An outer ring and an inner one, a glass gallery in the middle (two stands
    // in it), closets off the sides; the inner ring's walls are windows onto the outer, the gallery's onto the inner.
    static MAP = [
        '###################',
        '#W...g...g...g...W#',
        '#.#####P#.#P#####.#',
        '#...P.........P...#',
        '#.#W#.#P#.#P#.#v#g#',
        '#.P.PgP....gPdP.P.#',
        '#.###.#.L...#.###.#',
        '#n....P.....P....n#',
        '#.###.#...R.#.###.#',
        '#.P.PdP..g..PgP.P.#',
        '#g#v#.#P#.#P#.#W#.#',
        '#.#.P....h....P.#.#',
        '#.#.###P#.#P###.#.#',
        '#..g.....@.....g..#',
        '#########O#########',
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
        this.ents = []; this.glorps = []; this.items = []; this.hand = null; this.gotGlorps = 0;
        this.map.forEach((row, y) => row.forEach((c, x) => {
            if (c === '@') this.me = { x, y, dir: 0 };
            else if (c === 'P') { row[x] = Math.random() < C.MIRRORS ? 'M' : 'G'; return; }
            else if (c === 'W') this.ents.push({ x, y, pose: Math.random() < 0.5 ? 0 : 1, t: 0, seen: false, awake: false });
            else if (c === 'h') this.hand = { x, y };
            else if (c === 'g') this.glorps.push({ x, y, n: 3 + Math.floor(Math.random() * 4) });
            else if ('vdn'.includes(c)) this.items.push({ x, y, k: c });
            else return;
            row[x] = '.';
        }));
        this.view = { x: this.me.x + 0.5, y: this.me.y + 0.5, a: -Math.PI / 2 };
        // the way out's fragments, in mirrors picked at random (cell keys); at least a few more mirrors than fragments
        const mirrors = [];
        this.map.forEach((row, y) => row.forEach((c, x) => { if (c === 'M') mirrors.push(y * 64 + x); }));
        for (let i = 0; mirrors.length < C.FRAGMENTS + 3 && i < 200; i++) { const y = Math.floor(Math.random() * this.map.length), x = Math.floor(Math.random() * this.map[0].length); if (this.map[y][x] === 'G') { this.map[y][x] = 'M'; mirrors.push(y * 64 + x); } }
        this.frags = new Set(mirrors.sort(() => Math.random() - 0.5).slice(0, C.FRAGMENTS));
        // twins: behind some glass, in the cell beyond it, one of them posed just like you, only ever seen in a reflection (so
        // in nobody's way)
        this.twins = [];
        this.map.forEach((row, y) => row.forEach((c, x) => {
            if (c !== 'G' || Math.random() >= C.TWINS) return;
            const sides = MirrorTrial.DIRS.filter(([dx, dy]) => this._open(x + dx, y + dy) && this._open(x - dx, y - dy));   // (seen from the other side)
            if (!sides.length) return;
            const [dx, dy] = sides[Math.floor(Math.random() * sides.length)];
            this.twins.push({ x: x + dx, y: y + dy, pane: y * 64 + x });
        }));
        Object.assign(this, { found: 0, holding: false, raised: false, t0: this.time.now, done: false, caught: false, leaving: false, moving: false, queued: null,
            charges: 1, vials: 1, chargeT: 0, fovK: 1, gooK: 0, bubbles: [], drips: [], echoes: [], wards: 0, placed: [], labels: {}, marks: {}, sentries: [], sentryLeft: 0, lines: new Map(), escaped: false, pranks: 0, breaks: 0, closest: Infinity,
            dread: 0, dreadAt: 0, scarred: 0, stress: 0, calmUntil: 0, blackUntil: 0, heartAt: 0, arm: 1, armOut: false, blur: 0, wiping: false, mapUp: false });
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
        this.tex.mt_twin.fw = this.tex.mt_decoy.fw = this.tex.mt_items.fw = this.tex.mt_self.fw = 48;   // strips: its poses, the decoy's four sides, things to find, you (the shard down, up)
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
        const at = this.textures.get('mt_arm');   // your arm's strength, by the shard: a tendril of your goo holding one, lit as far as it has left
        if (!at.has('full')) { at.add('full', 0, 0, 0, 9, 30); at.add('spent', 0, 9, 0, 9, 30); }
        this.arms = ['spent', 'full'].map(f => this.add.image(0, 0, 'mt_arm', f).setScale(Math.max(W / C.W, H / C.H)).setDepth(5).setVisible(false));
        this._shardAt(false, 0);
        // what's said, and the keys
        const T = (y, s, size, col) => this.add.text(W / 2, y, s, { fontSize: size, fontFamily: UIKit.FONT.title, fontStyle: 'bold', color: col, stroke: '#05030a', strokeThickness: 5, align: 'center' }).setOrigin(0.5).setDepth(6);
        this.title = T(H * 0.38, 'THE HALL OF REFLECTIONS', '30px', '#d8c8ff');
        this.sub = T(H * 0.38 + 44, 'The way out\'s three fragments are in mirrors. Walk into a pane to chalk it.\nBut half the panes are glass, and glass shatters. They\'re asleep. Don\'t wake them: they\'ll want to play.\nThey can\'t hurt you. But they can scare you out of your mind.', '16px', '#a898c8');
        this.time.delayedCall(1300, () => { Sfx.play(this, 'shatter'); this.cameras.main.shake(200, 0.006); });
        this.time.delayedCall(2300, () => Sfx.play(this, 'e_absorb'));
        this.tweens.add({ targets: [this.title, this.sub], alpha: 0, delay: C.GRACE_MS - 500, duration: 600 });
        this.keysTxt = this.add.text(W / 2, H - 30, '', { fontSize: '13px', fontFamily: 'monospace', align: 'center', lineSpacing: 4, color: '#8a7aa8', stroke: '#05030a', strokeThickness: 3 }).setOrigin(0.5).setDepth(6);
        this.fx = this.add.graphics().setDepth(4);   // a dash's streaks and goo
        this.gooGlow = this.add.rectangle(0, 0, W, H, 0x2fe8c8).setOrigin(0).setBlendMode(Phaser.BlendModes.ADD).setAlpha(0).setDepth(3);
        // your goo: three vials, bottom left; an empty one fills back up from the bottom
        const ct = this.textures.get('mt_charge');
        if (!ct.has('full')) { ct.add('full', 0, 0, 0, 10, 13); ct.add('empty', 0, 10, 0, 10, 13); }
        this.cans = Array.from({ length: C.GOO.VIALS }, (_, i) => {
            const x = 52 + i * 58, y = H - 92, P = Math.max(W / C.W, H / C.H);   // (drawn the view's pixel size; in from the edge, where the zoom pulses would push it)
            return { glow: this.add.image(x, y, 'vfx_glow').setTint(0x40d8b8).setBlendMode(Phaser.BlendModes.ADD).setScale(0.55).setAlpha(0.35).setDepth(5),
                     empty: this.add.image(x, y, 'mt_charge', 'empty').setScale(P).setDepth(5), full: this.add.image(x, y, 'mt_charge', 'full').setScale(P).setDepth(5), P };
        });
        this.dreadG = this.add.graphics().setDepth(4.2);   // the dread: the edges darkening, the cracks
        this.black = this.add.rectangle(0, 0, W, H, 0x000000).setOrigin(0).setAlpha(0).setDepth(5.5);
        this.faint = this.add.rectangle(0, 0, W, H, 0x000000).setOrigin(0).setAlpha(0).setDepth(5.4);   // (stressed: the dark pulsing in)   // blacking out (over a prank's face)
        this.stingWash = this.add.rectangle(0, 0, W, H, 0xffffff).setOrigin(0).setBlendMode(Phaser.BlendModes.ADD).setAlpha(0).setDepth(4.3);   // the shock: a flash over it, not hiding it
        this.mapDim = this.add.rectangle(0, 0, W, H, 0x05030a).setOrigin(0).setAlpha(0).setDepth(6.4);
        this.mapCv = canvas('mt_mapview', this.tex.mt_map.w, this.tex.mt_map.h);   // the paper, inked each frame it's out
        this.mapImg = this.add.image(W / 2, H + 400, 'mt_mapview').setDepth(6.5).setVisible(false);
        this.mapHint = this.add.text(W / 2, H - 58, 'AN EYE: A MIRROR · A CROSS: GLASS · PENCIL: YOUR MARK (C) · DOTTED: NOT TESTED\nWHILE YOU LOOK AT IT, NOTHING WATCHES THEM', { fontSize: '13px', fontFamily: 'monospace', fontStyle: 'bold', color: '#d6c49a', stroke: '#05030a', strokeThickness: 4, align: 'center' }).setOrigin(0.5).setDepth(6.6).setAlpha(0);
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
        const have = [this.holding && 'SPACE (hold) the shard · F (hold) wipe it', this.vials && 'SHIFT dash',
            (this.wards || this.placed.length) && `Q decoy slime (${this.wards})`, (this.sentryLeft || this.sentries.length) && `E set down / pick up a sentry (${this.sentryLeft})`].filter(Boolean);
        this.keysTxt.setText(`W S step · A D turn · TAB (hold) the map · walk into a pane: chalk it · C mark it · a stand: turn it · ESC leave` + (have.length ? '\n' + have.join(' · ') : ''));   // (only what you've found)
        this.countTxt.setText(`FRAGMENTS OF THE WAY OUT  ${'◆ '.repeat(this.found)}${'◇ '.repeat(MirrorTrial.CFG.FRAGMENTS - this.found)}`.trim());
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
        if (k === 'Space') { if (e.repeat) return; if (this.holding && !this.raised && !this.mapUp && this.armOut) return Sfx.play(this, 'deny'); if (this.holding && !this.raised && !this.mapUp) { this.raised = true; Sfx.play(this, 'hover'); this._shardAt(true, MirrorTrial.CFG.RAISE_MS); } return; }
        if ((k === 'ShiftLeft' || k === 'ShiftRight') && e.repeat) return;   // (held: one dash)
        if (k === 'Tab') { this.mapUp = true; if (this.raised) { this.raised = false; this._shardAt(false, MirrorTrial.CFG.RAISE_MS); } return; }
        if (this.mapUp) return;   // (looking at the map: nothing else)
        if (k === 'KeyQ') return this._ward();
        if (k === 'KeyE') return this._sentry();
        if (k === 'KeyC') return this._mark();
        if (k === 'KeyF') { if (!e.repeat && this.holding) this.wiping = true; return; }
        if (this.moving) { this.queued = k; return; }
        this._act(k);
    }
    _keyUp(e) {
        if (e.code === 'Space' && this.raised) { this.raised = false; this._shardAt(false, MirrorTrial.CFG.RAISE_MS); }
        if (e.code === 'Tab') this.mapUp = false;
        if (e.code === 'KeyF') this.wiping = false;
    }
    // a click on a decoy (where the view drew it this frame): booped (Achievements.BOOPS), it squishes
    _boop(p) {
        const P = this.scale.width / this.front.W, x = Math.floor(p.x / P), y = Math.floor(p.y / P);
        const hit = (this.front.picks || []).find(k => k.cols.has(x) && y >= k.top && y < k.bottom);
        if (!hit) return;
        hit.w.boopAt = this.time.now;
        CreatureFX.boopFx(this, p.x, p.y, 'decoy');
    }
    // C: your own mark on a pane (the one you face; the shard up, the one right behind you): glass, then mirror, then none.
    // Not a test: only what you think it is
    _mark() {
        const [dx, dy] = MirrorTrial.DIRS[this.me.dir], s = this.raised ? -1 : 1, x = this.me.x + dx * s, y = this.me.y + dy * s, c = this.map[y]?.[x], k = y * 64 + x;
        if ((c !== 'M' && c !== 'G') || this.labels[k]) return Sfx.play(this, 'deny');
        this.marks[k] = !this.marks[k] ? 'G' : this.marks[k] === 'G' ? 'M' : null;
        Sfx.play(this, 'click');
        this._note(this.marks[k] === 'G' ? 'MARKED: GLASS, YOU THINK' : this.marks[k] === 'M' ? 'MARKED: A MIRROR, YOU THINK' : 'MARK RUBBED OUT');
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
                if (c !== '.' && c !== 'G' && c !== 'M') break;
                for (const e of this.ents) if (e.x === x && e.y === y) e.seen = true;
            }
        }
    }
    _noCans() {
        Sfx.play(this, 'deny');
        for (const c of this.cans) { this.tweens.killTweensOf(c.empty); this.tweens.add({ targets: c.empty, x: c.empty.x + 3, duration: 40, yoyo: true, repeat: 2 }); }
    }
    // SHIFT: a vial drunk, a dash: a white flash and you're a few tiles on (past one of them, not through stone or glass), goo
    // splashing out of the vial and the view wobbling teal like jelly for a moment
    _dash() {
        const C = MirrorTrial.CFG, [dx, dy] = MirrorTrial.DIRS[this.me.dir];
        if (this.charges < C.DASH.COST || this.moving || this.caught || this.leaving) return this._noCans();
        let land = 0;
        for (let i = 1; i <= C.DASH.TILES; i++) {
            const x = this.me.x + dx * i, y = this.me.y + dy * i;
            if (!this._open(x, y)) break;
            if (!this.ents.some(e => e.x === x && e.y === y)) land = i;
        }
        if (!land) return this._noCans();
        for (let n = 0; n < C.DASH.COST; n++) {
            const can = this.cans[--this.charges];
            this.tweens.add({ targets: can.full, scale: can.P * 1.2, duration: 90, yoyo: true });
            for (let k = 0; k < 30; k++) this.bubbles.push({ x: can.full.x + (Math.random() - 0.5) * 30, y: can.full.y - 30, vx: (Math.random() - 0.3) * 260, vy: -150 - Math.random() * 380, r: 3 + Math.random() * 6, life: 1 });
        }
        const x = this.me.x + dx * land, y = this.me.y + dy * land;
        this.me.x = x; this.me.y = y; this.moving = true;
        this.cameras.main.flash(280, 255, 255, 255); this.cameras.main.shake(120, 0.006);
        Sfx.play(this, 'gulp'); Sfx.play(this, 'dash'); Sfx.play(this, 'whoosh');
        this._noise(x, y, C.WAKE.DASH);
        this.tweens.killTweensOf(this);
        this.tweens.add({ targets: this, gooK: 1, fovK: C.GOO.FOV, duration: 90, hold: 260, yoyo: true, ease: 'Quad.easeOut' });
        this.tweens.add({ targets: this.view, x: x + 0.5, y: y + 0.5, duration: 90, ease: 'Quad.easeOut', onComplete: () => this._moved() });
    }
    // E: a sentry set down where you stand; or, standing on one that hasn't gone off, picked back up
    _sentry() {
        const { x, y } = this.me, i = this.sentries.findIndex(o => o.x === x && o.y === y && !o.pings);
        if (i >= 0) { this.sentries.splice(i, 1); this.sentryLeft++; Sfx.play(this, 'pickup'); this._note('SENTRY PICKED UP'); }
        else if (this.sentryLeft > 0) {
            const o = { x, y, at: this.time.now, pings: 0, next: 0, showUntil: 0, cells: [] };
            this.map.forEach((row, cy) => row.forEach((c, cx) => { if (c === '.' && this._inReach(o, cx, cy)) o.cells.push(cy * 64 + cx); }));
            this.sentries.push(o); this.sentryLeft--; Sfx.play(this, 'pop'); this._note('A SENTRY. IF ONE OF THEM COMES NEAR IT, IT\'LL PING.');
        }
        else Sfx.play(this, 'deny');
        this._hud();
    }
    // a sentry's reach: a squircle round it, through no more than SENTRY.WALLS of stone (or panes, or stands)
    _inReach(o, x, y) {
        const S = MirrorTrial.CFG.SENTRY, dx = x - o.x, dy = y - o.y;
        if (dx ** 4 + dy ** 4 > S.R ** 4) return false;
        let walls = 0, last = -1;
        for (let i = 1, n = Math.ceil(Math.hypot(dx, dy) * 3); i < n; i++) {
            const cx = Math.floor(o.x + 0.5 + dx * i / n), cy = Math.floor(o.y + 0.5 + dy * i / n), k = cy * 64 + cx;
            if (k !== last && this.map[cy]?.[cx] !== '.') { walls++; last = k; }
        }
        return walls <= S.WALLS;
    }
    // lit on the floor: a sentry's reach (just set down, and as it pings) and a decoy's stare: cell -> how bright
    _sentryLines(now) {
        const C = MirrorTrial.CFG, L = this.lines;
        L.clear();
        for (const o of this.sentries) {
            const k = Math.max(0.3 * Math.max(0, 1 - (now - o.at) / C.SENTRY.LIT_MS), 0.8 * Math.max(0, 1 - (now - (o.pingAt || -1e9)) / 700));
            if (k > 0.01) for (const c of o.cells) L.set(c, Math.max(L.get(c) || 0, k));
        }
        for (const w of this.placed) {   // a decoy's stare, in pink (negative: lines' values; its own colour on the floor)
            const [dx, dy] = MirrorTrial.DIRS[w.dir];
            for (let i = 1; i <= C.WARD_RANGE; i++) {
                const x = w.x + dx * i, y = w.y + dy * i, c = this.map[y]?.[x];
                if (c !== '.' && c !== 'G' && c !== 'M') break;
                if (c === '.') L.set(y * 64 + x, -0.35);
            }
        }
    }
    // Your dread: looking straight at one that's awake (not in a reflection) builds it, faster the more of it fills your view;
    // it ebbs when you stop. One that's just turned horrible stings the first time it's seen, anywhere. Full: you black out for
    // a moment (and nothing watches them). Your stress: what their pranks left you with, for good, and your dread on top; full,
    // you're scared to death (two pranks in, a full dread does it; three, a moment's). The look of it: the edges darkening, the
    // colour going (your dread); cracks creeping in (your stress: as far as the pranks took them, they stay); and once they've
    // got you, your heart going all the time and the dark pulsing in, like you're about to faint, worse with every prank.
    _dread(now, delta) {
        const C = MirrorTrial.CFG, D = C.DREAD, W = this.scale.width, H = this.scale.height, g = this.dreadG, dt = delta / 1000;
        const direct = this.ents.reduce((a, e) => a + (e.pose >= 2 ? e.dpx || 0 : 0), 0);
        for (const e of this.ents) if (e.fresh && e.seen) {
            e.fresh = false;
            Sfx.play(this, 'boom', { big: true }); Sfx.play(this, 'whoosh'); this.cameras.main.shake(260, 0.012);
            this.tweens.killTweensOf(this.stingWash); this.stingWash.setAlpha(0.5); this.tweens.add({ targets: this.stingWash, alpha: 0, duration: 450, ease: 'Quad.easeIn' });
            this.cameras.main.zoomTo(1.12, 50, 'Quad.easeOut', true, (c, p) => p === 1 && c.zoomTo(1, 380));   // (it jumps at the screen)
            if (e.dpx) this.dread += D.STING;
            this.time.delayedCall(420, () => !this.caught && this._giggle(e, 1));   // (got you)
        }
        if (this.caught || now < this.blackUntil) {}
        else if (direct >= C.SEEN_PX) { this.dread += (D.RISE + D.CLOSE * Math.min(1, direct / D.CLOSE_PX)) * dt; this.dreadAt = now; }
        else if (now - this.dreadAt > D.WAIT) this.dread = Math.max(0, this.dread - D.FALL * dt);
        this.dread = Math.min(this.dread, 1);
        this.stress = this.scarred + this.dread * C.STRESS.DREAD;
        if (this.stress >= 0.999 && !this.caught) this._die();
        if (this.dread >= 1 && !this.caught && now >= this.blackUntil) {
            this.blackUntil = now + D.OUT_MS; this.dread = D.AFTER; this.breaks++;
            Sfx.play(this, 'hurt'); this.cameras.main.shake(300, 0.012);
            this.tweens.killTweensOf(this.black);
            this.tweens.chain({ targets: this.black, tweens: [{ alpha: 1, duration: 120 }, { alpha: 1, duration: D.OUT_MS - 520 }, { alpha: 0, duration: 400 }] });
            this._note('YOU BLACK OUT. YOU CAN\'T BEAR IT.');
        }
        const sp = Math.min(1, this.scarred / (3 * C.STRESS.PRANK)), hk = Math.max(this.dread, sp && 0.25 + 0.6 * sp), k = Math.max(this.dread, 0.7 * sp), cs = this.stress;   // (sp: how far their pranks have got you, 0-1 by the third)
        if (hk > 0.2 && !this.caught && now - this.heartAt > 1000 - 650 * hk) { this.heartAt = now; Sfx.play(this, 'heartbeat', { hard: hk }); if (hk > 0.7) this.cameras.main.shake(90, 0.003 * hk); }
        const per = 5000 - 2600 * sp, beat = sp && !this.caught ? Math.max(0, Math.sin((now % per) / per * Math.PI * 2)) ** 3 : 0;   // (the dark pulsing in)
        this.faint.setAlpha(beat * (0.12 + 0.5 * sp * sp));
        g.clear();
        if (k < 0.02 && cs < 0.02) return;
        for (let i = 0; i < 9; i++) g.lineStyle(20, 0x000000, 0.1 * k).strokeRect(10 + i * 20, 10 + i * 20, W - 20 - i * 40, H - 20 - i * 40);
        const P = Math.max(W / C.W, H / C.H), snap = v => Math.floor(v / P) * P;   // (the cracks in the view's own chunky pixels)
        for (const pts of this.cracks) {
            const n = Math.floor(pts.length * cs);
            for (let i = 1; i < n; i++) {
                const [x0, y0] = pts[i - 1], [x1, y1] = pts[i], len = Math.hypot(x1 - x0, y1 - y0);
                for (let t = 0; t <= len; t += P) {
                    const x = snap(x0 + (x1 - x0) * t / len), y = snap(y0 + (y1 - y0) * t / len);
                    g.fillStyle(0x05030a, 0.8 * cs).fillRect(x + P, y + P, P, P);
                    g.fillStyle(0xe8e0ff, 0.55 * cs).fillRect(x, y, P, P);
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
    // The hall in ink on the paper, a tile CELL pixels: all of it (stone hatched, panes as you've chalked them, stands, the way
    // out), your decoys (their stares dotted) and sentries (their reach), and you, an arrow. Not them, but where a ping shows them
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
            const c = this.map[y][x], lab = this.labels[y * 64 + x], mk = this.marks[y * 64 + x];
            if (c === '#') cell(x, y, (px, py) => ink(px, py, (px + py) % 2 ? 0x4a3418 : 0x6b4c28, 0.9));
            else if (c === 'M' || c === 'G') cell(x, y, (px, py, u, v) => {
                const edge = !u || !v || u === S - 1 || v === S - 1, m = S >> 1;
                if (lab === 'M') ink(px, py, u === m && v === m ? 0xffffff : 0x5a7ab0, 0.95);                       // a mirror: filled, an eye
                else if (lab === 'G') { if (edge || u === v || u + v === S - 1) ink(px, py, 0x5a7ab0, 0.9); }      // glass: framed, a cross
                else if (mk === 'M') { if (edge || (u === m && v === m)) ink(px, py, 0x8a8478, 0.9); }             // marked (not tested): pencil
                else if (mk === 'G') { if (u === v || u + v === S - 1) ink(px, py, 0x8a8478, 0.9); }
                else if (edge && (u + v) % 2 === 0) ink(px, py, 0x7a6a4a, 0.9);                                    // not tested: dotted
            });
            else if (c === 'L' || c === 'R') cell(x, y, (px, py, u, v) => { if (c === 'L' ? u + v === S - 1 : u === v) ink(px, py, 0x606880, 1); });
            else if (c === 'O' || c === 'Q') cell(x, y, (px, py, u, v) => ink(px, py, c === 'Q' ? (u === 2 && v === 2 ? 0xffffff : 0x9a6ad8) : 0x5a3a70, 0.9));
        }
        const line = (o, col, range, live) => {
            const [dx, dy] = MirrorTrial.DIRS[o.dir], [x0, y0] = mid(o.x, o.y);
            for (let i = 1; i <= range; i++) { const c = this.map[o.y + dy * i]?.[o.x + dx * i]; if (c !== '.' && c !== 'G' && c !== 'M') break; for (let k = 0; k < S; k += 2) ink(x0 + dx * (i * S - k), y0 + dy * (i * S - k), col, 0.8); }
            for (const [a, b] of [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [-1, -1], [1, -1], [-1, 1]]) ink(x0 + a, y0 + b, col, live && Math.floor(now / 200) % 2 ? 0.4 : 1);
        };
        this.placed.forEach(w => line(w, 0xd0508a, C.WARD_RANGE));
        for (const o of this.sentries) {
            for (const c of o.cells) { const [x, y] = mid(c % 64, Math.floor(c / 64)); ink(x, y, 0x1f8a78, 0.6); }
            const [x0, y0] = mid(o.x, o.y), live = now < o.showUntil;
            for (const [a, b] of [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [-1, -1], [1, -1], [-1, 1]]) ink(x0 + a, y0 + b, 0x1f8a78, live && Math.floor(now / 200) % 2 ? 0.4 : 1);
        }
        for (const e of this.ents) if (e.pinged) { const [x, y] = mid(e.x, e.y); for (let k = -2; k <= 2; k++) for (const t of [0, 1]) { ink(x + k + t, y + k, 0xc01830); ink(x + k + t, y - k, 0xc01830); } }   // (a ping's: where they are)
        const [mx, my] = mid(this.me.x, this.me.y), [dx, dy] = MirrorTrial.DIRS[this.me.dir];   // you: an arrow the way you face
        for (const [f, s2] of [[2, 0], [1, -1], [1, 0], [1, 1], [0, -2], [0, -1], [0, 0], [0, 1], [0, 2], [-1, 0], [-2, 0]]) ink(mx + dx * f - dy * s2, my + dy * f + dx * s2, 0x0e6a5c);
        V.ctx.putImageData(V.img, 0, 0);
        V.tex.refresh();
    }
    // the sentries: one of them coming within reach sets one off. It pings, and again EVERY_MS on; each ping shows you where
    // any of them in its reach are, live, for SHOW_MS (through the walls ahead of you, and on your map); then it's spent
    _sentryWatch(now) {
        const S = MirrorTrial.CFG.SENTRY;
        for (const e of this.ents) e.pinged = false;
        for (const o of this.sentries) {
            const near = this.ents.filter(e => this._inReach(o, e.x, e.y));
            if (o.pings < S.PINGS && now >= o.next && (o.pings || near.length)) {
                o.pings++; o.next = now + S.EVERY_MS; o.showUntil = now + S.SHOW_MS; o.pingAt = now;
                Sfx.play(this, 'blip'); this.time.delayedCall(110, () => Sfx.play(this, 'blip'));
                if (o.pings === 1) this._note('A SENTRY PINGS: ONE OF THEM IS NEAR IT.');
            }
            if (now < o.showUntil) for (const e of near) e.pinged = true;
            if (o.pings >= S.PINGS && now >= o.showUntil) { o.spent = true; Sfx.play(this, 'pop'); }
        }
        this.sentries = this.sentries.filter(o => !o.spent);
    }
    _note(t) {
        this.tweens.killTweensOf(this.noteTxt);
        this.noteTxt.setText(t).setAlpha(1);
        this.tweens.add({ targets: this.noteTxt, alpha: 0, delay: 1300, duration: 500 });
    }
    // every frame: the vials filling back; a dash's streaks, goo dripping down the view and globs of it floating up, the screen's
    // edge flaring
    _gooTick(now, delta) {
        const C = MirrorTrial.CFG, S = C.GOO, W = this.scale.width, H = this.scale.height, g = this.fx, k = this.gooK;
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
        this.gooGlow.setAlpha(k * 0.13);
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
            const edge = P * (1 + Math.round(2 * k));   // the edge of the screen, flaring
            g.fillStyle(0x2fe8c8, 0.6 * k).fillRect(0, 0, W, edge).fillRect(0, H - edge, W, edge).fillRect(0, 0, edge, H).fillRect(W - edge, 0, edge, H);
            if (Math.random() < 0.5) this.bubbles.push({ x: Math.random() * W, y: H + 8, vx: (Math.random() - 0.5) * 30, vy: -90 - Math.random() * 160, r: 3 + Math.random() * 7, life: 1 });   // globs of goo floating up
            if (Math.random() < 0.3) this.drips.push({ x: Math.random() * W, y: -4, v: 30 + Math.random() * 60, r: 5 + Math.random() * 7, len: 0 });   // goo dripping down from the top
        }
        const dt = delta / 1000;
        this.bubbles = this.bubbles.filter(b => (b.life -= dt * 0.7) > 0 && b.y > -10);
        for (const b of this.bubbles) {   // goo globs: wobbling as they go
            b.x += (b.vx + Math.sin((now + b.r * 200) / 160) * 40) * dt; b.y += b.vy * dt; b.vy *= 0.995;
            blob(b.x, b.y, Math.max(P, b.r), 0x2fb8a2, 0.6 * b.life);
            g.fillStyle(0x8ff4dc, 0.8 * b.life).fillRect(snap(b.x - b.r * 0.4), snap(b.y - b.r * 0.4), P, P);
        }
        this.drips = this.drips.filter(p => p.y < H + 30);
        for (const p of this.drips) {   // drips: a streak from the top, a drop at its end, sliding down and off
            p.v += 60 * dt; p.y += p.v * dt; p.len = Math.min(p.y, 140);
            const a = 0.6 * Math.max(k, 0.2), w = p.r > 8 ? 2 * P : P;
            g.fillStyle(0x2fb8a2, a).fillRect(snap(p.x - w / 2), 0, w, snap(p.y));
            blob(p.x, p.y, p.r, 0x2fb8a2, a);
            g.fillStyle(0x8ff4dc, a).fillRect(snap(p.x - p.r * 0.4), snap(p.y - p.r * 0.3), P, P);
        }
    }
    // walking into a pane: chalking it. A mirror rings and takes your chalk (an eye), and gives up the fragment in it, if
    // there's one; glass shatters (marked with a cross, after), and they hear it. One already chalked or cracked: nothing.
    _tap(x, y, c) {
        const C = MirrorTrial.CFG, key = y * 64 + x;
        if (this.labels[key]) return this.cameras.main.shake(60, 0.002);
        this.labels[key] = c;
        if (c === 'G') return this._shatter(x, y);
        this._noise(x, y, C.WAKE.TAP);
        Sfx.play(this, 'clink'); this.cameras.main.shake(60, 0.002);
        if (!this.frags.has(key)) return this._note('IT RINGS: A MIRROR. CHALKED. NOTHING IN IT.');
        this.frags.delete(key); this.found++;
        Sfx.play(this, 'pickup'); this.time.delayedCall(120, () => Sfx.play(this, 'ready')); this.cameras.main.flash(260, 200, 220, 255);
        const sleepers = this.ents.filter(e => !e.awake).sort((a, b) => (Math.abs(a.x - x) + Math.abs(a.y - y)) - (Math.abs(b.x - x) + Math.abs(b.y - y)));   // (each fragment wakes the nearest still asleep)
        if (sleepers[0]) this._wake(sleepers[0]);
        if (this.found < C.FRAGMENTS) this._say(`A FRAGMENT OF THE WAY OUT  ${this.found}/${C.FRAGMENTS}`, 'It comes out of the mirror into your hand. They\'re getting restless.', '#bfd8ff', 2400);
        else {
            this.done = true;
            this.map.forEach(row => row.forEach((ch, i) => { if (ch === 'O') row[i] = 'Q'; }));
            Sfx.play(this, 'surge');
            this._say('THE MIRROR IS WHOLE', 'Go back the way you came. Through it.', '#bfeeff', 3200);
        }
        this._hud();
    }
    // glass, chalked: it shatters, loud. The awake lunge at you (LUNGE steps, watched or not); the asleep near it wake
    _shatter(x, y) {
        const C = MirrorTrial.CFG;
        this.shattered = (this.shattered || 0) + 1;
        Sfx.play(this, 'shatter'); Sfx.play(this, 'boom', { big: true }); this.cameras.main.shake(320, 0.012);
        this.tweens.killTweensOf(this.stingWash); this.stingWash.setAlpha(0.3); this.tweens.add({ targets: this.stingWash, alpha: 0, duration: 400 });
        this._note('GLASS. IT SHATTERS. THEY HEARD THAT.');
        for (const e of this.ents) if (e.awake) for (let k = 0; k < C.SHATTER.LUNGE && !this.caught; k++) this._entStep(e);
        if (!this.caught) this._noise(x, y, C.SHATTER.WAKE);
        const i = this.twins.findIndex(t => t.pane === y * 64 + x);
        if (i >= 0 && !this.caught) {   // the one behind it, that you took for you: awake, right there (if there's room)
            const [t] = this.twins.splice(i, 1), e = { x: t.x, y: t.y, pose: 0, t: 0, seen: false, awake: false };
            if ([this.me, ...this.ents].some(o => o.x === t.x && o.y === t.y)) return;
            this.ents.push(e); this._wake(e); e.pose = 4; e.fresh = true;
            this._note('GLASS. AND THAT WASN\'T YOU.');
        }
    }
    _act(k) {
        if (k === 'KeyW' || k === 'ArrowUp') this._step(1);
        else if (k === 'KeyS' || k === 'ArrowDown') this._step(-1);
        else if (k === 'KeyA' || k === 'ArrowLeft') this._turn(-1);
        else if (k === 'KeyD' || k === 'ArrowRight') this._turn(1);
        else if (k === 'ShiftLeft' || k === 'ShiftRight') this._dash();
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
        this.tweens.add({ targets: this.view, x: x + 0.5, y: y + 0.5, duration: MirrorTrial.CFG.STEP_MS, ease: 'Sine.easeInOut', onComplete: () => this._moved() });
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
                this._say('A FLASK OF YOUR GOO', this.vials === 1 ? 'SHIFT: a dash, a few tiles on in a flash, past one of them if it\'s in the way.\nLoud. It fills back up, slowly.' : this.vials === 2 ? 'Two now. They fill back up one at a time.' : 'A third.', '#8ff4dc', 3200);
            } else if (it.k === 'd') { this.wards++; this._say('A DECOY SLIME, ASLEEP', 'Q sets it down, staring the way you face.\nThey take it for you: whatever it stares at holds. It\'s made of reflection: a mirror shows it, even straight on.', '#ffaad2', 3600); }
            else { this.sentryLeft++; this._say('A SENTRY SLIME, ASLEEP', 'E sets it down. When one of them comes near it (even a wall away), it pings twice:\neach ping shows you where they are. Then it\'s spent. It\'s made of reflection: a mirror shows it, even straight on.', '#8ff4dc', 3600); }
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
            this._say('A SHARD OF MIRROR', 'Hold SPACE to see what\'s behind you, while your arm holds out.\nThe mirrors here only show you in it. And not everything that looks like you is you.\nHold one of them in it a while: they don\'t like being caught in a reflection.', '#bfd8ff', 5200);
            this._hud();
            return;
        }
    }

    update(time, delta) {
        const C = MirrorTrial.CFG, now = this.time.now;
        this._gooTick(now, delta);
        // your reflection: a beat behind you (where you were ECHO_MS ago, the shard up or not)
        this.echoes.push({ at: now, x: this.view.x, y: this.view.y, up: this.raised });
        while (this.echoes.length > 1 && now - this.echoes[1].at >= C.ECHO_MS) this.echoes.shift();
        // ahead (watching, the shard held up covering some of it), and the shard's view: behind you, flipped as a mirror shows it;
        // the wards' stares; the sentries' lines
        for (const e of this.ents) { e.seen = false; e.dpx = 0; e.rpx = 0; }
        this._sentryWatch(now);
        this._sentryLines(now);
        // the shard held up: your arm tiring (the shard shaking, sinking) till it gives out and drops it; down, resting
        if (this.raised) {
            this.arm -= delta / C.ARM.HOLD_MS;
            if (this.arm <= 0) { this.arm = 0; this.armOut = true; this.raised = false; this._shardAt(false, C.RAISE_MS); Sfx.play(this, 'deny'); this._note('YOUR ARM GIVES OUT.'); }
        } else if ((this.arm = Math.min(1, this.arm + delta / C.ARM.REST_MS)) >= C.ARM.BACK) this.armOut = false;
        const [spent, full] = this.arms, Wd = this.scale.width, Hd = this.scale.height, up = Math.max(0, Math.min(1, (this.shard.scaleX - 2.4) / 3.6)), rows = Math.round(30 * this.arm);   // (beside the shard, low or held up)
        for (const a of this.arms) a.setVisible(this.holding).setPosition(Wd - 290 - 320 * up, Hd - 100 - (Hd / 2 - 130) * up);
        full.setVisible(this.holding && rows > 0).setCrop(0, 30 - rows, 9, rows);
        spent.setAlpha(this.armOut && Math.floor(now / 220) % 2 ? 0.45 : 1);
        // the shard fogging up while it's down; F held rubs it clean
        if (this.holding && !this.raised) {
            if (this.wiping) { this.blur = Math.max(0, this.blur - delta / C.BLUR.WIPE_MS); if (now - (this.wipeAt || 0) > 260) { this.wipeAt = now; Sfx.play(this, 'hover'); } }
            else this.blur = Math.min(1, this.blur + delta / C.BLUR.GROW_MS);
            if (this.blur > 0.5 && !this.toldBlur) { this.toldBlur = true; this._note('YOUR SHARD\'S FOGGING UP. HOLD F TO WIPE IT.'); }
        }
        const tire = this.raised ? (1 - this.arm) ** 2 : 0, rub = this.wiping && !this.raised ? Math.sin(now / 40) * 2 : 0;
        for (const c of this.shard.list) c.setPosition((Math.random() - 0.5) * 2.4 * tire + rub, (Math.random() - 0.5) * 2.4 * tire + 5 * tire);
        this.front.cover = this.raised && this.shard;
        this._render(this.front, this.view.a, C.FOV * this.fovK, false, !this.mapUp);
        if (this.holding) this._render(this.back, this.view.a + Math.PI, C.BACK.FOV, true, this.raised);
        if (now < this.blackUntil) for (const e of this.ents) e.seen = false;   // (blacked out: you hold nothing)
        this._dread(now, delta);
        // one caught in a reflection, held there: it fades and, long enough, leaves
        for (const e of this.ents) {
            if (e.awake && e.rpx >= C.SEEN_BACK && now >= this.blackUntil && !this.caught) { if ((e.shy = (e.shy || 0) + delta) >= C.SHOO_MS) this._shoo(e); }
            else e.shy = Math.max(0, (e.shy || 0) - delta);
        }
        this._wardsWatch(now);
        this._mapShow(this.mapUp ? 'big' : null);
        if (this.mapImg.visible) this._mapInk(now);
        if (!this.caught && !this.escaped && !this.leaving && now - this.t0 > C.GRACE_MS && now >= this.calmUntil) {
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
        if (nx === me.x && ny === me.y) return this._prank(e);
        e.x = nx; e.y = ny;
        this.closest = Math.min(this.closest, Math.abs(nx - me.x) + Math.abs(ny - me.y));
        const near = path.length - 2, pick = near >= 3 ? [2, 3] : [4, 5];
        if (near <= 2 && e.pose < 4) e.fresh = true;   // (turned horrible: the first time you see it, the sting)
        e.pose = pick[0] === e.pose ? pick[1] : pick[1] === e.pose ? pick[0] : pick[Math.random() < 0.5 ? 0 : 1];
        this._hear(e);
    }
    // where one is, to your ears: left or right of the way you face, louder the nearer, dull through stone (null: too far off)
    _where(e) {
        const dx = e.x - this.me.x, dy = e.y - this.me.y, d = Math.hypot(dx, dy);
        if (d > MirrorTrial.CFG.HEAR) return null;
        const a = this.view.a, pan = (dx * -Math.sin(a) + dy * Math.cos(a)) / (d || 1);
        let muffled = false;
        for (let i = 1, n = Math.ceil(d * 2); i < n && !muffled; i++) { const c = this.map[Math.floor(this.me.y + 0.5 + dy * i / n)]?.[Math.floor(this.me.x + 0.5 + dx * i / n)]; muffled = c === '#' || c === 'O' || c === 'Q'; }
        return { pan, near: Math.max(0, 1 - d / MirrorTrial.CFG.HEAR), muffled };
    }
    // one moving, heard
    _hear(e) { const w = this._where(e); if (w) Sfx.play(this, 'shift', w); }
    // one giggling (far off: faint, from nowhere you can tell)
    _giggle(e, n = 0) { Sfx.play(this, 'hall_giggle', { ...(this._where(e) || { near: 0.1, muffled: true }), n }); }
    // one wakes: its eyes open (seen as it happens: a jolt)
    _wake(e) {
        if (e.awake) return;
        e.awake = true; e.pose = 2; e.t = -MirrorTrial.CFG.WAKE.MS;   // (coming to: a moment before its first step, to see it coming)
        Sfx.play(this, 'tell'); this.time.delayedCall(500, () => !this.caught && this._giggle(e));
        this._note('SOMETHING WOKE UP. IT WANTS TO PLAY.');
        if (e.seen) { this.tweens.killTweensOf(this.stingWash); this.stingWash.setAlpha(0.25); this.tweens.add({ targets: this.stingWash, alpha: 0, duration: 500 }); this.cameras.main.shake(140, 0.006); }
    }
    // a noise at (x, y): any asleep within r tiles wakes
    _noise(x, y, r) { for (const e of this.ents) if (!e.awake && Math.abs(e.x - x) + Math.abs(e.y - y) <= r) this._wake(e); }
    // Out: how it went (your time and your best, the glorps, how often they got you, how close they came)
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
        line(H * 0.52 + 30, this.pranks ? `THEY GOT YOU ${this.pranks} TIME${this.pranks > 1 ? 'S' : ''}` : 'THEY NEVER GOT YOU', '18px', '#f0ece0');
        line(H * 0.52 + 90, this.shattered ? `GLASS YOU SHATTERED  ${this.shattered}` : 'YOU NEVER SHATTERED THE GLASS', '18px', '#bfd8ff');
        line(H * 0.52 + 150, this.shooed ? `YOU SENT ${this.shooed} OF THEM OFF` : 'YOU NEVER SENT ONE OFF', '18px', '#8ff4dc');
        line(H * 0.52 + 120, this.breaks ? `YOU BLACKED OUT ${this.breaks} TIME${this.breaks > 1 ? 'S' : ''}` : 'YOU NEVER BLACKED OUT', '18px', '#f0ece0');
        line(H * 0.52 + 60, this.closest === Infinity ? 'NONE OF THEM GOT NEAR YOU' : `CLOSEST CALL  ${this.closest} TILE${this.closest > 1 ? 'S' : ''} AWAY`, '18px', '#ff9ab8');
        line(H * 0.8, 'ENTER  again        ESC  leave', '16px', '#8a7aa8');
    }
    // One reached you: a prank, the biggest scare it has, slammed into your face; a beat, then it laughs, and it's gone (asleep
    // again, far off). It stays with you: STRESS.PRANK more stress, for good. While you get your breath back, none of them moves
    _prank(e) {
        const C = MirrorTrial.CFG, W = this.scale.width, H = this.scale.height, cam = this.cameras.main, s = H / 64 * 1.3, now = this.time.now;
        if (now < this.calmUntil) return;
        this.pranks++; this.scarred = Math.min(1, this.scarred + C.STRESS.PRANK); this.calmUntil = now + C.STRESS.CALM_MS;
        if (this.raised) { this.raised = false; this._shardAt(false, C.RAISE_MS); }
        Sfx.play(this, 'boom', { big: true }); Sfx.play(this, 'bosshit'); Sfx.play(this, 'whoosh');
        cam.shake(420, 0.02); cam.zoomTo(1.18, 60, 'Quad.easeOut', true, (c, p) => p === 1 && c.zoomTo(1, 500));
        this.tweens.killTweensOf(this.stingWash); this.stingWash.setAlpha(0.7); this.tweens.add({ targets: this.stingWash, alpha: 0, duration: 600, ease: 'Quad.easeIn' });
        const face = this.add.image(W / 2, H / 2 + H * 0.1, 'mt_twin', 'face').setScale(s * 1.8).setDepth(5);
        this.tweens.add({ targets: face, scale: s, duration: 140, ease: 'Back.easeOut' });
        this.tweens.add({ targets: face, alpha: 0, delay: 900, duration: 350, onComplete: () => face.destroy() });
        this._sendOff(e);
        this.time.delayedCall(900, () => {
            Sfx.play(this, 'hall_giggle', { near: 1, n: 3 });
            if (this.scarred >= 0.999) return this._die();
            this._note(this.scarred + C.STRESS.DREAD * 0.5 >= 1 ? 'GOT YOU. YOUR HEART CAN\'T TAKE MUCH MORE.' : 'GOT YOU. IT\'S LAUGHING.');
        });
    }
    // one of them off: asleep again, anywhere open far from you that nobody's in
    _sendOff(e) {
        const far = [];
        this.map.forEach((row, y) => row.forEach((c, x) => { if (c === '.' && Math.abs(x - this.me.x) + Math.abs(y - this.me.y) >= 8 && !this.ents.some(o => o.x === x && o.y === y)) far.push([x, y]); }));
        if (far.length) [e.x, e.y] = far[Math.floor(Math.random() * far.length)];
        Object.assign(e, { awake: false, pose: Math.random() < 0.5 ? 0 : 1, t: 0, fresh: false, shy: 0 });
    }
    // held in a reflection long enough: it doesn't like being caught there, and slinks off
    _shoo(e) {
        this._giggle(e); Sfx.play(this, 'whoosh');
        this.shooed = (this.shooed || 0) + 1;
        this._note('CAUGHT IN A REFLECTION. IT SLINKS OFF.');
        this._sendOff(e);
    }
    // Your stress full: scared to death. Your heart, hard, twice, and then not; the dark; they giggle all round you. Over
    _die() {
        if (this.caught) return;
        const H = this.scale.height;
        this.caught = true;
        if (this.raised) { this.raised = false; this._shardAt(false, MirrorTrial.CFG.RAISE_MS); }
        Sfx.play(this, 'heartbeat', { hard: 1 }); this.time.delayedCall(260, () => Sfx.play(this, 'heartbeat', { hard: 1 })); this.cameras.main.shake(300, 0.012);
        this.tweens.killTweensOf([this.black, this.noteTxt]); this.noteTxt.setAlpha(0);
        this.tweens.add({ targets: this.black, alpha: 1, duration: 900, ease: 'Quad.easeIn' });
        [-0.8, 0.7, 0].forEach((pan, i) => this.time.delayedCall(700 + i * 380, () => Sfx.play(this, 'hall_giggle', { pan, near: 0.7 - i * 0.15, n: i })));
        this.time.delayedCall(1500, () => {
            this._say('SCARED TO DEATH', `They got you ${this.pranks} time${this.pranks === 1 ? '' : 's'}, and your heart gave out. They'll want to play again.\nR  again        ESC  leave`, '#ff8aa0', 0);
            this.title.setY(H * 0.42); this.sub.setY(H * 0.42 + 52);
        });
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
        const groups = new Map(), ghosts = new Map();
        for (let x = 0; x < W; x++) {
            const cx = 2 * x / W - 1; let rx = dx + plx * cx, ry = dy + ply * cx; const n = Math.hypot(rx, ry); rx /= n; ry /= n;
            const cos = rx * dx + ry * dy, ov = [];
            let ox = px, oy = py, T = 0, first = null, after = Infinity, zOpaque = Infinity;
            for (let b = 0; ; b++) {
                const h = this._cast(ox, oy, rx, ry, ov, T, V === this.front && b === 0);
                T += h.t;
                if (b === 1) after = T * cos;
                if ((h.c === 'M' || h.c === 'Q' || h.diag) && b < C.BOUNCES) {
                    ov.push({ k: h.diag ? 'mt_mirror' : 'mt_glass', T, u: h.u, tint: h.c === 'Q' ? 2 : h.diag ? 1 : 0 });   // (a mirror in a wall looks like glass)
                    const lab = this.labels[h.cell] || this.marks[h.cell];
                    if (lab) ov.push({ k: lab === 'M' ? 'mt_mark_m' : 'mt_mark_g', T, u: h.u });
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
            const sw = ov.find(o => o.see), ghost = sw && { key: sw.see.side + ':' + sw.see.plane, ...sw.see, z: sw.T * cos };   // (the first wall mirror looked through)
            if (ghost && !ghosts.has(ghost.key)) ghosts.set(ghost.key, ghost);
            V.cols[x] = { cos, ov, mirror: first && first.key, mz: first ? first.z : Infinity, after, ghost };
        }
        // what stands in the hall: them, the shards on the floor, and in each mirror you and them again
        const sprites = [];
        for (const e of this.ents) sprites.push({ x: e.x + 0.5, y: e.y + 0.5, k: 'mt_twin', f: e.pose, ent: e, big: C.BIG });
        if (this.hand) sprites.push({ x: this.hand.x + 0.5, y: this.hand.y + 0.5, k: 'mt_pickup', f: 0, glint: true });
        const now = this.time.now;
        // the decoys, from whichever side you see them (its face, back, right, left: f), flickering as they give out
        const side = (sx, sy, fx, fy) => { const vx = sx - px, vy = sy - py, n = Math.hypot(vx, vy) || 1, dot = (fx * vx + fy * vy) / n; return dot < -0.7 ? 0 : dot > 0.7 ? 1 : fx * -dy + fy * dx > 0 ? 2 : 3; };
        const decoys = this.placed.filter(w => !(w.until - now < 1500 && Math.floor(now / 90) % 2));
        for (const w of decoys) {
            const [fx, fy] = MirrorTrial.DIRS[w.dir], sq = Math.max(0, 1 - (now - (w.boopAt || -1e9)) / 260);   // (booped: a squish)
            sprites.push({ x: w.x + 0.5, y: w.y + 0.5, k: 'mt_decoy', f: side(w.x + 0.5, w.y + 0.5, fx, fy), glint: true, w, sq: 1 - 0.25 * sq, sw: 1 + 0.3 * sq });
        }
        for (const o of this.sentries) sprites.push({ x: o.x + 0.5, y: o.y + 0.5, k: 'mt_sentry', f: 0, glint: true });
        if (V === this.front) for (const e of this.ents) if (e.pinged) sprites.push({ x: e.x + 0.5, y: e.y + 0.5, k: 'mt_twin', f: e.pose, big: C.BIG, xray: true });
        for (const o of this.glorps) if (!o.got) sprites.push({ x: o.x + 0.5, y: o.y + 0.5, k: 'mt_glorp', f: 0, glint: true });
        for (const o of this.items) if (!o.got) sprites.push({ x: o.x + 0.5, y: o.y + 0.5, k: 'mt_items', f: 'vdn'.indexOf(o.k), glint: true });
        if (V === this.back) for (const t of this.twins) sprites.push({ x: t.x + 0.5, y: t.y + 0.5, k: 'mt_self', f: 0 });   // (only ever in a reflection: the shard's)
        const E = this.echoes[0] || { x: px, y: py, up: false };
        for (const g of groups.values()) {
            const m = (vx, vy) => g.diag === 'L' ? { x: g.k - vy, y: g.k - vx } : g.diag === 'R' ? { x: vy + g.k, y: vx - g.k }
                : g.side === 0 ? { x: 2 * g.plane - vx, y: vy } : { x: vx, y: 2 * g.plane - vy };
            sprites.push({ ...m(E.x, E.y), k: 'mt_self', f: E.up ? 1 : 0, in: g.key });
            for (const t of this.twins) sprites.push({ ...m(t.x + 0.5, t.y + 0.5), k: 'mt_self', f: 0, in: g.key });
            for (const e of this.ents) sprites.push({ ...m(e.x + 0.5, e.y + 0.5), k: 'mt_twin', f: e.pose, ent: e, big: C.BIG, in: g.key });
        }
        for (const g of ghosts.values()) {   // a wall mirror looked at straight on shows nothing but reflections: the slimes you set down (they're made of them)
            const m = (vx, vy) => g.side === 0 ? { x: 2 * g.plane - vx, y: vy } : { x: vx, y: 2 * g.plane - vy };
            for (const w of decoys) { const [fx, fy] = MirrorTrial.DIRS[w.dir], p = m(w.x + 0.5, w.y + 0.5); sprites.push({ ...p, k: 'mt_decoy', f: side(p.x, p.y, g.side === 0 ? -fx : fx, g.side === 0 ? fy : -fy), glint: true, ghost: g.key }); }
            for (const o of this.sentries) sprites.push({ ...m(o.x + 0.5, o.y + 0.5), k: 'mt_sentry', f: 0, glint: true, ghost: g.key });
        }
        const inv = 1 / (plx * dy - dx * ply), per = Array.from({ length: W }, () => []);
        if (V === this.front) V.picks = [];   // (the decoys as drawn, for a click: _boop)
        for (const s of sprites) {
            const rx = s.x - px, ry = s.y - py, tX = inv * (dy * rx - dx * ry), tY = inv * (-ply * rx + plx * ry);
            if (tY < 0.15) continue;
            const sx = (W / 2) * (1 + tX / tY), h = H / tY * (s.big || 1) * (s.sq || 1), w = h * 0.75 * (s.sw || 1) / (s.sq || 1), x0 = Math.floor(sx - w / 2), x1 = Math.ceil(sx + w / 2);
            const pick = s.w && !s.in && !s.ghost && V === this.front ? { w: s.w, cols: new Set(), top: Math.floor(H / 2 + H / tY / 2 - h), bottom: Math.ceil(H / 2 + H / tY / 2) } : null;
            if (pick) V.picks.push(pick);
            for (let x = Math.max(0, x0); x < Math.min(W, x1); x++) {
                const col = V.cols[x];
                if (!s.xray && (s.ghost ? (col.ghost?.key !== s.ghost || tY <= col.ghost.z) : s.in ? (col.mirror !== s.in || tY <= col.mz || tY >= col.after) : tY >= V.zbuf[x])) continue;
                per[x].push({ s, z: tY, k: s.xray ? 1e-3 : s.ghost && col.ghost.z - 0.001, u: (x - (sx - w / 2)) / w, h });   // (k: a reflection on a mirror's face; a ping's outline, over everything)   // (k: drawn on the mirror's face, over what's seen through it)
                pick?.cols.add(x);
            }
        }
        const px0 = new Map(this.ents.map(e => [e, 0])), straight = watch && V === this.front;
        for (let x = 0; x < W; x++) {
            const col = V.cols[x], items = col.ov.map(o => ({ o, z: o.T * col.cos })).concat(per[x]).sort((p, q) => (q.k || q.z) - (p.k || p.z));
            for (const it of items) {
                if (it.o) { this._slice(V, x, it.z, it.o.k, it.o.u, lit(it.o.T), it.o.tint); continue; }
                const b = lit(it.z / col.cos), n = this._sprite(V, x, it.z, it.s, it.u, it.s.glint ? Math.max(0.55, b) : b, it.h);
                if (it.s.ent) { px0.set(it.s.ent, px0.get(it.s.ent) + n); if (straight && !it.s.in) it.s.ent.dpx += n; if (watch && (V === this.back || it.s.in)) it.s.ent.rpx += n; }   // (straight on, not in a mirror: the dread's; in a reflection: the shoo's)
            }
        }
        for (const e of this.ents) if (px0.get(e) >= (V === this.back ? C.SEEN_BACK : C.SEEN_PX)) { if (watch) e.seen = true; }
        // the dither (each channel to a few levels, a 4x4 Bayer pattern between them); flipped, for the shard; cut to its shape
        // (dashing, the view ahead: its colours pushed to your teal, and wobbling like jelly, row by row)
        const fog = V === this.back ? this.blur * (this.raised ? C.BLUR.UP : 1) : 0;   // (the shard fogged up)
        if (fog > 0.02) {
            const r = Math.ceil(fog * 3), tmp = this._fogRow ||= new Float32Array(Math.max(W, H) * 3);
            for (const [len, n, at] of [[W, H, (a, i) => (a * W + i) * 4], [H, W, (a, i) => (i * W + a) * 4]]) for (let a = 0; a < n; a++) {
                for (let i = 0; i < len; i++) { let sr = 0, sg = 0, sb = 0, m = 0; for (let j = Math.max(0, i - r); j <= Math.min(len - 1, i + r); j++) { const q = at(a, j); sr += d[q]; sg += d[q + 1]; sb += d[q + 2]; m++; } tmp[i * 3] = sr / m; tmp[i * 3 + 1] = sg / m; tmp[i * 3 + 2] = sb / m; }
                for (let i = 0; i < len; i++) { const q = at(a, i); d[q] = tmp[i * 3] + (120 - tmp[i * 3]) * fog * 0.3; d[q + 1] = tmp[i * 3 + 1] + (118 - tmp[i * 3 + 1]) * fog * 0.3; d[q + 2] = tmp[i * 3 + 2] + (140 - tmp[i * 3 + 2]) * fog * 0.3; }
            }
        }
        const L = C.LEVELS - 1, BAY = MirrorTrial.BAYER, cut = V === this.back ? this.tex.mt_shard.d : null, sk = V === this.front ? this.gooK : 0;
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
    // thru: a look straight on, which goes through a mirror in a wall as through glass (kept in `ov` too, `see`: its plane).
    // (The cell it starts in isn't looked at: off a stand's mirror, the ray goes on from inside its cell.)
    _cast(ox, oy, rx, ry, ov, T0, thru) {
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
            if (c === 'G' || (thru && c === 'M')) {
                ov.push({ k: 'mt_glass', T: T0 + t, u, see: c === 'M' && { side, plane: side === 0 ? (sx > 0 ? mx : mx + 1) : (sy > 0 ? my : my + 1) } });
                const lab = this.labels[my * 64 + mx] || this.marks[my * 64 + mx];
                if (lab) ov.push({ k: lab === 'M' ? 'mt_mark_m' : 'mt_mark_g', T: T0 + t, u });
                continue;
            }
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
        const S = V.cover, P = this.scale.width / V.W, T = this.tex.mt_shard, o = S.list[1];   // (o: shaking in your hand)
        const u = Math.floor(((x + 0.5) * P - S.x) / S.scaleX - o.x + T.w / 2), v = Math.floor(((y + 0.5) * P - S.y) / S.scaleY - o.y + T.h / 2);
        return u >= 0 && v >= 0 && u < T.w && v < T.h && T.d[(v * T.w + u) * 4 + 3] > 0;
    }
    // a sprite's column u (its pose f, in a strip), standing on the floor at depth z (s.big: taller); how many lit pixels it put down
    _sprite(V, x, z, s, u, b, sh) {
        const C = MirrorTrial.CFG, W = V.W, H = V.H, tex = this.tex[s.k], fw = tex.fw || tex.w, d = V.img.data, h = sh || H / z * (s.big || 1), top = H / 2 + H / z / 2 - h;
        const tx = s.f * fw + Math.min(fw - 1, Math.max(0, Math.floor(u * fw))), fade = s.ent?.shy ? 0.8 * s.ent.shy / C.SHOO_MS : 0;
        let n = 0;
        for (let y = Math.max(0, Math.floor(top)), y1 = Math.min(H, Math.ceil(top + h)); y < y1; y++) {
            const j = (Math.max(0, Math.min(tex.h - 1, Math.floor((y - top) / h * tex.h))) * tex.w + tx) * 4, al = tex.d[j + 3] / 255;
            if (al < 0.5) continue;
            const i = (y * W + x) * 4;
            if (s.xray) { if ((x + y) % 2) { d[i] += (143 - d[i]) * 0.6; d[i + 1] += (244 - d[i + 1]) * 0.6; d[i + 2] += (220 - d[i + 2]) * 0.6; } continue; }   // (a ping's: a teal ghost of it)
            if (b >= C.LIT && !(V.cover && this._covered(V, x, y))) n++;
            if (fade && Math.random() < fade) continue;   // (being shooed: coming apart)
            for (let c = 0; c < 3; c++) d[i + c] = tex.d[j + c] * b + 30 * b * (c === 2);
        }
        return n;
    }
}
