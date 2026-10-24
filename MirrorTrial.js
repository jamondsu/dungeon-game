// ═══════════════════════════════════════════════════════════════════════════
// MirrorTrial.js — the Hall of Reflections, a first try (the Training Ground's TRIAL page).
//
// You step through a mirror into a hall and see through your slime's eyes, a step a tile and a quarter turn at a time. The
// mirror breaks behind you, and the things in the hall take your powers the moment you're in: you can't fight them, only
// get out. They're bigger than you and they move only while nothing sees them, never while you watch, and only ever in
// still poses, nearer and worse each time (in a mirror they show another pose than they hold). The mirrors on the walls
// see for you too. On the floor at your feet, a broken shard: hold it up (SPACE) and you see what's behind you, but the
// view dives into the shard and everything in front of you goes unwatched. Find the three shards the way out is missing,
// and it's whole again: step back through it. If one of them reaches you, it has you.
// Drawn small and scaled up: a ray a column through the tile map, off mirrors and through glass, shaded to black with
// distance and dithered to a few levels a colour; the shard's view the same, turned round and flipped, cut to its shape.
// ═══════════════════════════════════════════════════════════════════════════
class MirrorTrial extends Phaser.Scene {
    static CFG = {
        W: 256, H: 144, FOV: 0.66, FOG: 10, BOUNCES: 4, LEVELS: 11,   // the view, drawn this small; how wide; how far you see; mirrors deep; the dither
        BACK: { W: 96, H: 72, FOV: 0.5 },                           // the shard's view (the size of its art, mt_shard)
        STEP_MS: 170, TURN_MS: 150, RAISE_MS: 220,                   // your step, turn, and lifting the shard
        ENT_MS: 900, ENT_SHARD: 90, ENT_MIN: 520, GRACE_MS: 3200,    // unseen this long, one moves (quicker by ENT_SHARD a shard found); none at first
        SEEN_PX: 6, SEEN_BACK: 3, LIT: 0.05, BIG: 1.35,              // this much of one on screen (in the shard), this lit, holds it; how tall they stand
    };
    // # stone, G glass, M mirror, O the way out (broken), s a missing shard, h the shard for your hand, W one of them, P you (facing north)
    static MAP = [
        '#################',
        '#s..#...s...#..s#',
        '#...#.......#...#',
        '#.#.#..#.#..#.#.#',
        '#.#....#W#....#.#',
        '#...M.......G...#',
        '##.###.#.#.###.##',
        '#W.............W#',
        '#.#.#.#.M.#.#.#.#',
        '#...............#',
        '#.#.#.#.#.#.#.#.#',
        '#...............#',
        '#.......h.......#',
        '#.......P.......#',
        '########O########',
    ];
    static DIRS = [[0, -1], [1, 0], [0, 1], [-1, 0]];   // north, east, south, west
    static TEX = ['mt_wall', 'mt_glass', 'mt_mirror', 'mt_broken', 'mt_self', 'mt_twin', 'mt_shard', 'mt_pickup'];
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
        this.ents = []; this.shards = []; this.hand = null;
        this.map.forEach((row, y) => row.forEach((c, x) => {
            if (c === 'P') this.me = { x, y, dir: 0 };
            else if (c === 'W') this.ents.push({ x, y, pose: 0, t: 0, seen: false });
            else if (c === 's') this.shards.push({ x, y });
            else if (c === 'h') this.hand = { x, y };
            else return;
            row[x] = '.';
        }));
        this.view = { x: this.me.x + 0.5, y: this.me.y + 0.5, a: -Math.PI / 2 };
        Object.assign(this, { found: 0, holding: false, raised: false, t0: this.time.now, done: false, caught: false, leaving: false, moving: false, queued: null });
        // the textures, as pixels to read
        this.tex = {};
        for (const k of MirrorTrial.TEX) {
            const src = this.textures.get(k).getSourceImage(), c = document.createElement('canvas');
            c.width = src.width; c.height = src.height;
            const x = c.getContext('2d'); x.drawImage(src, 0, 0);
            this.tex[k] = { w: src.width, h: src.height, d: x.getImageData(0, 0, src.width, src.height).data };
        }
        this.tex.mt_twin.fw = 48;   // a strip of poses, 48 wide each
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
        this.sub = T(H * 0.38 + 44, 'The mirror breaks behind you.\nSomething here takes your powers.', '16px', '#a898c8');
        this.time.delayedCall(1300, () => { Sfx.play(this, 'shatter'); this.cameras.main.shake(200, 0.006); });
        this.time.delayedCall(2300, () => Sfx.play(this, 'e_absorb'));
        this.tweens.add({ targets: [this.title, this.sub], alpha: 0, delay: C.GRACE_MS - 500, duration: 600 });
        this.keysTxt = this.add.text(W / 2, H - 24, '', { fontSize: '13px', fontFamily: 'monospace', color: '#8a7aa8', stroke: '#05030a', strokeThickness: 3 }).setOrigin(0.5).setDepth(6);
        this.countTxt = this.add.text(W / 2, 22, '', { fontSize: '15px', fontFamily: UIKit.FONT.title, fontStyle: 'bold', color: '#bfd8ff', stroke: '#05030a', strokeThickness: 4 }).setOrigin(0.5).setDepth(6);
        this._hud();
        this.input.keyboard.on('keydown', this._key, this);
        this.input.keyboard.on('keyup', this._keyUp, this);
        this.events.once('shutdown', () => { this.input.keyboard.off('keydown', this._key, this); this.input.keyboard.off('keyup', this._keyUp, this); });
        if (typeof Music !== 'undefined') Music.duck(true, 'mirror');
        this.cameras.main.fadeIn(700, 8, 4, 16);
    }

    _hud() {
        this.keysTxt.setText('W S  step     A D  turn' + (this.holding ? '     SPACE (hold)  look in the shard' : '') + '     ESC  leave');
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
        if (k === 'Space') { if (this.holding && !this.raised) { this.raised = true; Sfx.play(this, 'hover'); this._shardAt(true, MirrorTrial.CFG.RAISE_MS); } return; }
        if (this.moving) { this.queued = k; return; }
        this._act(k);
    }
    _keyUp(e) {
        if (e.code === 'Space' && this.raised) { this.raised = false; this._shardAt(false, MirrorTrial.CFG.RAISE_MS); }
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
    // standing on a shard: the one for your hand, or one of the way out's (all three: it's whole)
    _pickUp() {
        const { x, y } = this.me;
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
        // ahead (watching, unless the shard is up), and the shard's view: behind you, flipped as a mirror shows it
        this._render(this.front, this.view.a, C.FOV, false, !this.raised);
        if (this.holding) this._render(this.back, this.view.a + Math.PI, C.BACK.FOV, true, this.raised);
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
        const near = path.length - 2, pick = near >= 6 ? [0, 3] : near >= 3 ? [1, 2] : [4, 5];
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
        // the floor (its flagstones' joints, for knowing where you are) and the dark above
        const r0x = dx - plx, r0y = dy - ply, r1x = dx + plx, r1y = dy + ply;
        for (let y = 0; y < H; y++) {
            const below = y >= H / 2, t = (H / 2) / Math.max(0.5, Math.abs(y - H / 2) + 0.5), b = lit(t * 0.9);
            let fx = px + t * r0x, fy = py + t * r0y;
            const sx = t * (r1x - r0x) / W, sy = t * (r1y - r0y) / W;
            for (let x = 0; x < W; x++, fx += sx, fy += sy) {
                const i = (y * W + x) * 4;
                let r = 14, g = 10, bl = 22;
                if (below) { const ex = fx - Math.floor(fx), ey = fy - Math.floor(fy), joint = ex < 0.04 || ex > 0.96 || ey < 0.04 || ey > 0.96; r = joint ? 16 : 46; g = joint ? 11 : 36; bl = joint ? 26 : 62; }
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
                if ((h.c === 'M' || h.c === 'Q') && b < C.BOUNCES) {
                    ov.push({ k: 'mt_mirror', T, u: h.u, tint: h.c === 'Q' ? 2 : 1 });
                    if (b === 0) { zOpaque = T * cos; first = { key: h.side + ':' + h.plane, side: h.side, plane: h.plane, z: T * cos }; if (!groups.has(first.key)) groups.set(first.key, first); }
                    if (h.side === 0) rx = -rx; else ry = -ry;
                    ox = h.hx; oy = h.hy;
                    continue;
                }
                if (b === 0) zOpaque = T * cos;
                this._slice(V, x, T * cos, h.c === 'O' ? 'mt_broken' : h.c === 'M' || h.c === 'Q' ? 'mt_mirror' : 'mt_wall', h.u, lit(T));
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
        for (const g of groups.values()) {
            const m = (vx, vy) => g.side === 0 ? { x: 2 * g.plane - vx, y: vy } : { x: vx, y: 2 * g.plane - vy };
            sprites.push({ ...m(px, py), k: 'mt_self', f: 0, in: g.key });
            for (const e of this.ents) sprites.push({ ...m(e.x + 0.5, e.y + 0.5), k: 'mt_twin', f: (e.pose + 1) % 6, ent: e, big: C.BIG, in: g.key });
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
        const px0 = new Map(this.ents.map(e => [e, 0]));
        for (let x = 0; x < W; x++) {
            const col = V.cols[x], items = col.ov.map(o => ({ o, z: o.T * col.cos })).concat(per[x]).sort((p, q) => q.z - p.z);
            for (const it of items) {
                if (it.o) { this._slice(V, x, it.z, it.o.k, it.o.u, lit(it.o.T), it.o.tint); continue; }
                const b = lit(it.z / col.cos), n = this._sprite(V, x, it.z, it.s, it.u, it.s.glint ? Math.max(0.55, b) : b);
                if (it.s.ent) px0.set(it.s.ent, px0.get(it.s.ent) + n);
            }
        }
        if (watch) for (const e of this.ents) e.seen = px0.get(e) >= (V === this.back ? C.SEEN_BACK : C.SEEN_PX);
        // the dither (each channel to a few levels, a 4x4 Bayer pattern between them); flipped, for the shard; cut to its shape
        const L = C.LEVELS - 1, BAY = MirrorTrial.BAYER, cut = V === this.back ? this.tex.mt_shard.d : null;
        for (let y = 0; y < H; y++) {
            if (flip) for (let x = 0; x < W / 2; x++) { const i = (y * W + x) * 4, j = (y * W + W - 1 - x) * 4; for (let c = 0; c < 4; c++) { const t = d[i + c]; d[i + c] = d[j + c]; d[j + c] = t; } }
            for (let x = 0; x < W; x++) {
                const i = (y * W + x) * 4, o = BAY[(y & 3) * 4 + (x & 3)];
                for (let c = 0; c < 3; c++) d[i + c] = Math.max(0, Math.min(L, Math.round(d[i + c] / 255 * L + o))) * 255 / L;
                if (cut) d[i + 3] = cut[i + 3] ? 255 : 0;
            }
        }
        V.ctx.putImageData(V.img, 0, 0);
        V.tex.refresh();
    }

    // along a ray from (ox, oy) to the first stone, mirror or the way out; the glass on the way kept in `ov` (at T0 + its distance)
    _cast(ox, oy, rx, ry, ov, T0) {
        let mx = Math.floor(ox), my = Math.floor(oy);
        const ddx = Math.abs(1 / rx), ddy = Math.abs(1 / ry), sx = rx < 0 ? -1 : 1, sy = ry < 0 ? -1 : 1;
        let tx = (rx < 0 ? ox - mx : mx + 1 - ox) * ddx, ty = (ry < 0 ? oy - my : my + 1 - oy) * ddy;
        for (let n = 0; n < 64; n++) {
            let side, t;
            if (tx < ty) { t = tx; tx += ddx; mx += sx; side = 0; } else { t = ty; ty += ddy; my += sy; side = 1; }
            const c = this.map[my]?.[mx] ?? '#';
            if (c === '.') continue;
            const hx = ox + rx * t, hy = oy + ry * t, u = side === 0 ? hy - Math.floor(hy) : hx - Math.floor(hx);
            if (c === 'G') { ov.push({ k: 'mt_glass', T: T0 + t, u }); continue; }
            return { t, c, side, u, hx, hy, plane: side === 0 ? (sx > 0 ? mx : mx + 1) : (sy > 0 ? my : my + 1) };
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
            for (let c = 0; c < 3; c++) d[i + c] = tex.d[j + c] * b + 30 * b * (c === 2);
            if (b >= C.LIT) n++;
        }
        return n;
    }
}
