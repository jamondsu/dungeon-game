// ═══════════════════════════════════════════════════════════════════════════
// EnchantScene.js — the Enchanter's Isle: an island off the map's route where the enchanting
// happens (Enchants.js). A floating island over a night sea, a rune altar ringed by crystal
// pillars, and a sealed book turning over it. Spend dust there to unseal books (a pull each),
// reforge a book's quality, combine two into the next level, salvage what you don't want into
// dust, and bind books into your weapons' slots (for glorps).
//
// Left: the island (painted once into pixel textures, then animated with a few live objects).
// Right: the panel (your weapons, the chosen one's slots, your books, the chosen book).
// ═══════════════════════════════════════════════════════════════════════════

class EnchantScene extends Phaser.Scene {
    constructor() { super({ key: 'Enchant' }); }

    // The island's water: rivers from a spring under the dais out to the front rim, where each one
    // falls ([x on the rim, its width in strands, its drop in px]); and falls off the back rim,
    // mostly hidden behind the island.
    static FALLS = [[26, 4, 260], [52, 7, 340], [122, 3, 210], [148, 5, 300], [174, 8, 370]];
    static BACK_FALLS = [[46, 4, 430], [80, 3, 390], [132, 3, 410], [160, 5, 450]];   // inside the outline: hidden behind it, seen only falling below
    // a point along river k (0..1), on the island's own pixels
    static river(k, t, back = false) {
        const [fx, n] = (back ? EnchantScene.BACK_FALLS : EnchantScene.FALLS)[k], cx = 105, top = 62, rx = 90, ry = 24;
        const ex = fx + n / 2, ey = top + (back ? -1 : 1) * ry * Math.sqrt(Math.max(0, 1 - ((ex - cx) / rx) ** 2)) + (back ? 2 : -1);   // to the far rim, or the near one
        const sx = cx + (ex - cx) * 0.2, sy = top - 2, mx = (sx + ex) / 2 + (k % 2 ? 9 : -9), my = (sy + ey) / 2 + 2;
        const u = 1 - t, wob = Math.sin(t * Math.PI * 3 + k * 1.9) * 2.2 * Math.sin(t * Math.PI);   // it winds
        return [u * u * sx + 2 * u * t * mx + t * t * ex + wob, u * u * sy + 2 * u * t * my + t * t * ey];
    }

    create(data = {}) {
        this.anims.resumeAll();   // the game's pause freezes every animation game-wide; never carry that into a menu
        const W = this.scale.width, H = this.scale.height;
        MenuArt.basics(this);
        Music.play(this, 'isle');
        this.glorps = parseInt(localStorage.getItem('glorps') || '0', 10) || 0;
        const owned = new Set(['flame_fists', 'ice_fists', 'lightning_fists', 'cosmic_fists', ...JSON.parse(localStorage.getItem('unlockedWeapons') || '[]')]);
        this._weapons = ShopScene.CATALOGUE.filter(w => owned.has(w.id));
        this._w = this._weapons.find(w => w.id === data.weapon) || this._weapons.find(w => localStorage.getItem('equip_' + w.element) === w.id) || this._weapons[0];
        this._book = null; this._page = 0;
        // the scene object outlives a visit: what the last one left must not carry over (a stale
        // _leaving swallowed the way back to the map on the second visit)
        this._leaving = false; this._enchFx = null; this._panelObjs = null; this._sayTxt = null; this._ticks = []; this._tip = null; this._el = null; this._busy = false; this._rwObjs = null; this._codexObjs = null;

        this._mode = null; this._stationObjs = null; this._confirmObjs = null; this._roomObjs = null; this._roomTicks = []; this._picks = []; this._pickObjs = null; this._pickOpened = false; this._stationBooks = null; this._roomBusy = false;
        this._paintWorld(W, H);
        this._cz = { t: 0 }; this._spin = 0; this._closeObjs = null;
        this._minis();
        this._stations();
        this._panel();
        this.input.keyboard.on('keydown-ESC', () => { if (this._codexObjs) { this._closeCodex(); return; } if (this._confirmObjs) { this._closeConfirm(); return; } if (this._enchFx || this._busy) return; if (this._pickObjs) { this._closePicker(); return; } if (this._mode) { this._leaveRoom(); return; } if (this._cz.t > 0) { this._closeUp(false); return; } this._leave(); });
        this.cameras.main.fadeIn(400, 5, 3, 12);
    }

    update(t) { for (const f of this._ticks) f(t); }

    _leave() {
        if (this._leaving) return;
        this._leaving = true;
        this.cameras.main.fadeOut(300, 5, 3, 12);
        this.time.delayedCall(320, () => this.scene.start('LevelSelect'));
    }

    // ── THE ISLE ──────────────────────────────────────────────────────────────
    // The sky and sea (one painted texture, 4x), the island (another, 3x), and what moves.
    _paintWorld(W, H) {
        const AW = W;   // the island is the room: the stations' drawers slide over it
        const sky = MenuArt.tex(this, 'isle_sky2_' + AW, Math.ceil(AW / 4), Math.ceil(H / 4), P => {
            const n = MenuArt.noise(41), R = MenuArt.rng(9), sea = Math.round(P.h * 0.74);
            for (let y = 0; y < P.h; y++) for (let x = 0; x < P.w; x++) {
                let c;
                if (y < sea) {   // the night: indigo overhead to violet at the horizon, banded by dither
                    const t = y / sea + (MenuArt.fbm(n, x * 0.04, y * 0.08) - 0.5) * 0.25;
                    c = t + MenuArt.bayer(x, y) * 0.12 < 0.45 ? 0x0c0a22 : t + MenuArt.bayer(x, y) * 0.12 < 0.75 ? 0x1a1240 : t < 0.95 ? 0x2c1a5a : 0x46287a;
                    if (MenuArt.fbm(n, x * 0.03 + 9, y * 0.05) > 0.66) c = MenuArt.mix(c, 0x5a3a9a, 0.35);   // drifting cloud
                } else {         // the sea, in perspective: rows of swell, thin and tight at the horizon, broad near
                    const t = (y - sea) / (P.h - sea), row = Math.pow(t, 0.55) * 26, fr = row - Math.floor(row);
                    c = MenuArt.mix(0x2a2066, 0x060410, Math.pow(t, 0.7));
                    if (t < 0.06) c = MenuArt.mix(c, 0x5a46a8, (0.06 - t) * 9);                                // haze on the horizon
                    const sw = MenuArt.noise(81)(x * (0.05 + (1 - t) * 0.12), Math.floor(row) * 3.1);          // each row's swell, longer near
                    if (fr < 0.35 && sw > 0.55) c = MenuArt.mix(c, 0x4a3a92, 0.55 * (1 - t * 0.6));            // the lit face of a swell
                    else if (fr > 0.7 && sw < 0.45) c = MenuArt.mix(c, 0x05030c, 0.4);                        // its trough
                    if (MenuArt.bayer(x, y) < 0.18 && sw > 0.6) c = MenuArt.mix(c, 0x6a5ab8, 0.4);
                    const mx2 = P.w * 0.72 + (MenuArt.noise(79)(y * 0.7, 2) - 0.5) * (4 + t * 10), half = 1.5 + t * 14 + MenuArt.noise(77)(y * 0.9, 1) * 5;   // the moon's path, widening toward you
                    if (Math.abs(x - mx2) < half && fr < 0.5 && MenuArt.noise(80)(x * 0.35, y * 0.8) > 0.3) c = MenuArt.mix(0x8a7ad0, 0xe8e0ff, 1 - t * 0.8);
                }
                P.put(x, y, c);
            }
            for (let k = 0; k < 90; k++) { const x = R() * P.w, y = R() * sea * 0.9; P.put(x, y, R() < 0.2 ? 0xffffff : 0x9a8ad8); }
            // the moon
            const mx = P.w * 0.72, my = sea * 0.22;
            for (let y = -8; y <= 8; y++) for (let x = -8; x <= 8; x++) {
                const d = Math.hypot(x, y);
                if (d < 7.5) P.put(mx + x, my + y, d < 6 && Math.hypot(x + 2, y - 1) > 2.2 ? 0xf0e8ff : 0xc8b8f0);
                else if (d < 11) P.put(mx + x, my + y, 0x6a5aaa, 0.25);
            }
        });
        this.add.image(0, 0, sky).setOrigin(0).setScale(4).setDepth(0);
        // twinkling stars and the sea's moving glints
        const tw = this.add.graphics().setDepth(1);
        const stars = Array.from({ length: 26 }, () => ({ x: Math.random() * AW, y: Math.random() * H * 0.6, p: Math.random() * 6 }));
        // wave crests: rows from the horizon down, each crest longer and slower the nearer it is, brightest under the moon
        const seaY = Math.round(H / 4 * 0.74) * 4, crests = [];
        for (let r = 0; r < 26; r++) { const tt = Math.pow((r + 0.5) / 26, 1 / 0.55), y = seaY + tt * (H - seaY); for (let k = 0; k < 3 + r * 0.6; k++) crests.push({ y, tt, x: Math.random() * AW, p: Math.random() * 6, l: 4 + tt * 46, v: (Math.random() < 0.5 ? -1 : 1) * (4 + tt * 14) }); }
        this._ticks.push((t) => {
            tw.clear();
            for (const s of stars) { const a = 0.5 + 0.5 * Math.sin(t * 0.002 + s.p); tw.fillStyle(0xffffff, a); tw.fillRect(Math.round(s.x), Math.round(s.y), 2, 2); }
            for (const c of crests) {
                const a = Math.max(0, Math.sin(t * 0.0009 + c.p)), x = ((c.x + c.v * t * 0.001) % (AW + 60) + AW + 60) % (AW + 60) - 30, moon = Math.max(0, 1 - Math.abs(x - AW * 0.72) / (60 + c.tt * 220));
                if (a < 0.05) continue;
                tw.fillStyle(MenuArt.mix(0x6a5ab8, 0xe8e0ff, moon), a * (0.35 + 0.55 * moon) * (0.5 + c.tt * 0.5)); tw.fillRect(Math.round(x), Math.round(c.y), Math.round(c.l * (0.6 + 0.4 * a)), c.tt > 0.5 ? 3 : 2);
                if (c.tt > 0.45) { tw.fillStyle(0x05030c, a * 0.35); tw.fillRect(Math.round(x + 2), Math.round(c.y + 3), Math.round(c.l * 0.7), 2); }   // the shadow under a near crest
            }
        });

        // the island, floating
        const S = 3, IW = 210, IH = 170;
        const isle = MenuArt.tex(this, 'isle_land_top', IW, IH, P => this._paintIsland(P, IW, IH, 'top'));   // the rock under it turns: _rockDraw
        const ix = AW / 2 - IW * S / 2, iy = 80;
        const land = this._land = this.add.container(0, 0).setDepth(2);
        land.add(this.add.image(ix, iy, isle).setOrigin(0).setScale(S));
        this._isleGeo = { ix, iy, S, cx: 105, top: 62, rx: 90, ry: 24 };
        this._spinSetup(land, IW, IH);
        // its glow on the water under it
        this.add.image(AW / 2, H * 0.8, 'mn_glow').setTint(0x7a5ad8).setBlendMode(Phaser.BlendModes.ADD).setDisplaySize(520, 120).setAlpha(0.35).setDepth(1);
        // waterfalls off the front rim, wide and narrow: each strand starts on the curved edge,
        // spills over the soil and breaks up into spray and mist at its own length
        const cx = 105, top = 62, rx = 90, ry = 24;
        const rimY = tx => iy + (top + ry * Math.sqrt(Math.max(0, 1 - ((tx - cx) / rx) ** 2))) * S;
        const FALLS = EnchantScene.FALLS;
        const fall = this.add.graphics().setDepth(2.5), splash = [];
        land.add(fall);
        // every river, where it meets the rim as the island has turned: in front (it pours over the
        // lip) or behind (it pours down the far side), easing in and out at the edges
        const rivers = () => [[EnchantScene.FALLS, false], [EnchantScene.BACK_FALLS, true]].flatMap(([list, bk]) => list.map(([, n, len], k) => {
            const [ex, ey] = EnchantScene.river(k, 1, bk), u = (ex - cx) / rx, v = (ey - top) / ry, a = Math.atan2(v, u) + this._spinA * Math.PI / 180;
            return { k, n, len, x: cx + Math.cos(a) * rx, front: Math.sin(a) > 0, fade: Math.min(1, Math.abs(Math.sin(a)) * 3) };
        }));
        for (const [fx, n, len] of FALLS) {
            const ex = ix + fx * S + n * 1.5, ey = rimY(fx) + len;
            land.add(this.add.particles(0, 0, 'mn_px2', { x: { min: ex - n * 4, max: ex + n * 4 }, y: { min: ey - 10, max: ey + 6 }, lifespan: 3200,
                speedY: { min: -8, max: 4 }, speedX: { min: -8, max: 8 }, gravityY: 4, scale: { start: 1.6 + n * 0.3, end: 0 }, alpha: { start: 0.4, end: 0 },
                tint: [0xe8f4ff, 0x9ac8f0], frequency: 160 - n * 15 }).setDepth(2.6));
            splash.push(land.list[land.list.length - 1]);
        }
        // the falls off the back rim: behind the island, seen only past its edges and under it
        const back = this.add.graphics();
        land.addAt(back, 0);
        const backY = tx => iy + (top - ry * Math.sqrt(Math.max(0, 1 - ((tx - cx) / rx) ** 2))) * S;
        // the rivers' current: light drifting slowly down each channel
        const flow = this.add.graphics().setDepth(2.4);
        land.add(flow);
        let backAt = 0;
        this._ticks.push((t) => {
            if (t - backAt < 33) return; backAt = t;   // the falls are slow: half the frames is plenty
            back.clear();
            for (const R2 of rivers()) if (!R2.front) {
                curtain(back, ix + R2.x * S, backY(R2.x), R2.len * (0.9 + 0.1 * Math.sin(t * 0.0006 + R2.k)), R2.n, R2.k * 3 + 11, true, x => backY((x - ix) / S));
            }
            flow.clear();
            for (const [list, back] of [[EnchantScene.BACK_FALLS, true], [EnchantScene.FALLS, false]]) list.forEach(([, n], k) => {
                for (let j = 0; j < 3 + n; j++) {
                    const tt = ((t * 0.00006 + j / (3 + n) + k * 0.17) % 1);
                    const [x, y] = this._spinPt(...EnchantScene.river(k, tt, back)), w = 1.2 + n * 0.35;
                    flow.fillStyle(0xe8f4ff, 0.7 * Math.sin(tt * Math.PI));
                    flow.fillRect(ix + (x - w * 0.5 + Math.sin(j * 1.7) * w * 0.4) * S, iy + y * S, S * 2, S);
                }
            });
        });
        // The falls, in the river's own colours: a blue sheet with darker edges and a soft lighter
        // dither drifting slowly down it (far off and huge, so slow), a white glint only now and
        // then, fading as it gives out into spray.
        // A waterfall as a curtain of water, not strands: it widens as it falls, its body shaded (the
        // left in shadow, the right moonlit, darker rims), streaks of light washing down it at their
        // own speeds, a foam lip where it tips over, and it thins to mist toward the bottom.
        // `rim` (screen x -> screen y) is the edge it pours over: each column starts there, so the lip follows the island's curve
        const curtain = (g, cx, y0, L, n, seed, far, rim) => {
            const t = t0(), w0 = (3.4 + n * 0.7) * S, A = far ? 0.6 : 1;   // as wide as the river that feeds it (its channel is 2.4 + 0.7n)
            for (let y = 0; y < L; y += 2) {
                const u = y / L, w = w0 * (1 + u * 0.35), fade = Math.min(1, (L - y) / 90) * A, sway = Math.sin((y + t * 0.01) * 0.025 + seed) * u * 3;
                const cols = Math.max(2, Math.round(w / S));
                for (let c = 0; c < cols; c++) {
                    const f = (c + 0.5) / cols, x = cx - w / 2 + c * S + sway, top = rim ? rim(x) - rim(cx) : 0;
                    if (u > 0.55 && ((c * 7 + y + seed) % 9 === 0) && Math.random() < u) continue;   // breaking up into spray
                    const sp = 0.009 + ((c * 13 + seed) % 5) * 0.0018, ph = (((y - Math.floor(t * sp) + c * 17 + seed * 5) % 23) + 23) % 23;
                    let col = f < 0.2 ? 0x24508a : f > 0.82 ? 0x5a98d8 : 0x3a78c8;                     // shadow side, moonlit side, body
                    if (c === 0 || c === cols - 1) col = 0x1e4278;                                       // its rims
                    else if (ph < 2) col = f > 0.5 ? 0xbfe0ff : 0x8ac0f0; else if (ph < 4) col = 0x5a98d8;   // streaks washing down
                    if (y < 6) col = y < 2 ? 0xffffff : 0xd8ecff;                                          // the foam lip
                    else if (((y * 3 + c * 11 - Math.floor(t * sp) * 3 + seed) % 53 + 53) % 53 === 0) col = 0xffffff;   // a glint
                    g.fillStyle(col, fade * (u > 0.7 ? 0.85 : 1)); g.fillRect(x, y0 + top + y, S, 2);
                }
            }
        };
        let tNow = 0; const t0 = () => tNow;
        let fallAt = 0;
        this._ticks.push((t) => {
            tNow = t;
            if (t - fallAt < 33) return; fallAt = t;
            fall.clear();
            for (const ps of splash) ps.setVisible(!this._spinA);   // the front falls' spray stands still: hidden while the island turns
            for (const R2 of rivers()) if (R2.front) {
                const fx = Math.round(R2.x - R2.n / 2), n = R2.n, len = R2.len * R2.fade;
                const top0 = rimY(fx + n / 2);   // the river's mouth: the fall pours over the rim's curve there
                curtain(fall, ix + (fx + n / 2) * S, top0 - 3, len + Math.sin(t * 0.0008 + R2.k) * 6, n, R2.k * 5 + 3, false, x => rimY((x - ix) / S));
                const ex = ix + fx * S, ey = rimY(fx) + len * 0.85;   // giving out: drops drifting apart
                for (let d = 0; d < n * 3; d++) {
                    const ph = (t * 0.0004 + d * 1.37) % 1, ox = Math.sin(d * 2.1) * n * 5 * ph;
                    fall.fillStyle(0xa8d0f0, 0.5 * (1 - ph)); fall.fillRect(ex + n * 1.5 + ox, ey + ph * 40, 2, 2);
                }
            }
        });
        this._landFloat = this.tweens.add({ targets: land, y: -6, duration: 2600, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });

        // the altar, live: the rune ring turning, the crystals breathing, motes rising, the book
        const ax = ix + 105 * S, ay = iy + 58 * S;
        this._altar = { x: ax, y: ay };
        const rune = this.add.graphics().setDepth(3).setBlendMode(Phaser.BlendModes.ADD);
        rune._z = iy + 62 * S + 0.5; this._bb.add(rune);   // on the dais, among what stands on the island
        this._ticks.push((t) => {
            rune.clear();
            const spin = t * 0.0006;
            for (let k = 0; k < 18; k++) {
                const a = spin + k / 18 * Math.PI * 2, x = ax + Math.cos(a) * 80, y = ay + Math.sin(a) * 23;
                rune.fillStyle(k % 3 ? 0x9a6aff : 0xe0c8ff, 0.5 + 0.4 * Math.sin(t * 0.004 + k));
                rune.fillRect(Math.round(x) - 2, Math.round(y) - 1, k % 3 ? 3 : 5, 3);
            }
            rune.lineStyle(2, 0x8a5aff, 0.18 + 0.1 * Math.sin(t * 0.003)); rune.strokeEllipse(ax, ay, 186, 56);
        });
        const motes = this.add.particles(0, 0, 'mn_px2', { x: { min: ax - 90, max: ax + 90 }, y: { min: ay - 10, max: ay + 20 }, lifespan: 2600,
            speedY: { min: -30, max: -12 }, speedX: { min: -5, max: 5 }, scale: { start: 1.4, end: 0 }, alpha: { start: 0.8, end: 0 },
            tint: [0xd8b8ff, 0x9a6aff, 0xffffff], blendMode: 'ADD', frequency: 70 }).setDepth(3.2);
        land.add(motes);
        const halo = this.add.image(ax, ay - 92, 'mn_glow').setTint(0xc8a0ff).setBlendMode(Phaser.BlendModes.ADD).setDisplaySize(120, 120).setAlpha(0.6).setDepth(3.3);
        const book = this.add.image(ax, ay - 92, ShopScene.bookIcon(this, -1), '0').setScale(2.2).setDepth(3.4);
        halo._z = book._z = iy + 62 * S + 1; this._bb.add([halo, book]);
        this.tweens.add({ targets: [book, halo], y: '-=10', duration: 1300, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
        this.tweens.add({ targets: book, angle: { from: -6, to: 6 }, duration: 1900, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
        this._altarBook = book; this._altarHalo = halo;

        // the way back, and the place's name
        UIKit.button(this, { x: 90, y: 34, w: 140, h: 34, label: '◂ MAP', accent: UIKit.PALETTE.line, depth: 20, fontSize: '13px', fireOn: 'down', onClick: () => { if (!this._mode && !this._roomBusy && !this._cz.t && !this._busy) this._leave(); } });   // never from inside a room (its own back button sits right over this one)
        UIKit.button(this, { x: AW - 90, y: 34, w: 140, h: 34, label: 'CODEX', accent: 0x9a6aff, depth: 20, fontSize: '13px', fireOn: 'down', onClick: () => { if (!this._busy) this._codex(); } });
        this.add.text(AW / 2, 30, "THE ENCHANTER'S ISLE", { fontSize: '26px', fontFamily: UIKit.FONT.title, fontStyle: 'bold', color: '#e0c8ff', stroke: '#0a0618', strokeThickness: 5 }).setOrigin(0.5).setDepth(20);

        // the altar's buttons, on the water under the island
        this._altarUI = [];
        this._drawAltarUI();
    }

    // The island: grass on top, a stone dais with steps, a pedestal, four crystal pillars; under
    // it, layered rock tapering to a point, roots and vines hanging off its rim.
    // ── THE TURNING ISLAND ───────────────────────────────────────────────────
    // Up close the island turns like a disk. Its top (the base layer's grass, rivers and flowers)
    // is unrolled once into a flat disk and drawn back each frame turned by _spinA degrees; what
    // stands on it (the crystal pillars, the five places, the book over the dais) is placed where
    // the turn carries it and sorted front to back; the dais in the middle stays put.
    _spinSetup(land, IW, IH) {
        const { ix, iy, S, cx, top, rx, ry } = this._isleGeo;
        this._spinA = 0;
        const P = new MenuArt.Px(IW, IH); this._paintIsland(P, IW, IH, 'base');
        const R = 96, Dm = 2 * R, map = new Int32Array(Dm * Dm).fill(-1);
        for (let my = 0; my < Dm; my++) for (let mx = 0; mx < Dm; mx++) {
            const u = (mx - R) / R, v = (my - R) / R;
            const r2 = u * u + v * v;
            if (r2 > 1) continue;
            // under the dais (which doesn't sit on the turning point) the springs and their water would
            // swing out from under it as it turns: grass there, the rivers start at its edge
            map[my * Dm + mx] = r2 < 0.21 ? (MenuArt.noise(5)(mx * 0.3, my * 0.3) > 0.5 ? 0x447a3a : 0x34602e) : P.get(Math.round(cx + u * rx), Math.round(top + v * ry));
        }
        // the rock under it, drawn turned (behind the island's top, which sits over its upper edge)
        this._rockSetup(land, IW, IH);
        const w = 2 * rx + 1, h = 2 * ry + 1, key = 'isle_spin';
        const tex = this.textures.exists(key) ? this.textures.get(key) : this.textures.createCanvas(key, w, h);
        const ctx = tex.getContext(), img = ctx.createImageData(w, h);
        const spinImg = this.add.image(ix + (cx - rx) * S, iy + (top - ry) * S, key).setOrigin(0).setScale(S).setVisible(false);
        land.add(spinImg);
        let drawnA = null;
        this._spinDraw = () => {
            const A = this._spinA;
            spinImg.setVisible(!!A);
            if (A !== this._rockA) this._rockDraw(A);
            if (!A || A === drawnA) return;
            drawnA = A;
            const th = -A * Math.PI / 180, c = Math.cos(th), sn = Math.sin(th), d = img.data;
            for (let y = 0; y < h; y++) {
                const v = (y - ry) / ry;
                for (let x = 0; x < w; x++) {
                    const u = (x - rx) / rx, i = (y * w + x) * 4;
                    if (u * u + v * v > 1) { d[i + 3] = 0; continue; }
                    const col = map[Math.round(R + (u * sn + v * c) * R) * Dm + Math.round(R + (u * c - v * sn) * R)];
                    if (col < 0) { d[i + 3] = 0; continue; }
                    d[i] = (col >> 16) & 255; d[i + 1] = (col >> 8) & 255; d[i + 2] = col & 255; d[i + 3] = 255;
                }
            }
            ctx.putImageData(img, 0, 0); tex.refresh();
        };
        // a point on the island's top (its own pixels), turned with it
        this._spinPt = (x, y, A = this._spinA) => {
            if (!A) return [x, y];
            const u = (x - cx) / rx, v = (y - top) / ry, t = A * Math.PI / 180, c = Math.cos(t), sn = Math.sin(t);
            return [cx + (u * c - v * sn) * rx, top + (u * sn + v * c) * ry];
        };
        // what stands on it
        const B = this._bb = this.add.container(0, 0);
        land.add(B);
        const dais = this.add.image(ix, iy, MenuArt.tex(this, 'isle_land_dais', IW, IH, Q => this._paintIsland(Q, IW, IH, 'dais'))).setOrigin(0).setScale(S);
        dais._z = iy + top * S;
        B.add(dais);
        this._pillars = [[72, 50, 20], [138, 50, 20], [62, 66, 26], [148, 66, 26]].map(([px, py, ph]) => {
            const spr = this.add.image(0, 0, this._pillarTex(ph)).setOrigin(0.5, 1).setScale(S);
            const gl = this.add.image(0, 0, 'mn_glow').setTint(0xa070ff).setBlendMode(Phaser.BlendModes.ADD).setDisplaySize(90 * ph / 22, 90 * ph / 22).setAlpha(0.5);
            this.tweens.add({ targets: gl, alpha: 0.2, duration: 1400 + Math.random() * 800, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
            B.add([gl, spr]);
            return { px, py, spr, gl };
        });
        this._placeBillboards = () => {
            for (const p of this._pillars) {
                const [x, y] = this._spinPt(p.px + 0.5, p.py + 1);
                p.spr.setPosition(ix + Math.round(x) * S, iy + Math.round(y) * S); p.spr._z = p.spr.y;
                p.gl.setPosition(p.spr.x, p.spr.y - 5 * S); p.gl._z = p.spr._z - 0.01;
            }
        };
        this._placeBillboards();
    }
    // The rock hanging under the island, as something solid that turns with it: cones hanging from
    // the disk (a big one in the middle, smaller ones round it, behind as well as in front), each
    // swept for the current turn and kept per pixel only where it's nearest you. The boulders' cracks
    // are fixed to the rock (they're laid out by the angle round each cone, less the turn), the moon
    // lights whichever side faces right, and the crystals and vines hanging off it turn with it.
    _rockSetup(land, IW, IH) {
        const { ix, iy, S } = this._isleGeo, key = 'isle_rock';
        const tex = this.textures.exists(key) ? this.textures.get(key) : this.textures.createCanvas(key, IW, IH);
        this._rock = { tex, ctx: tex.getContext(), img: tex.getContext().createImageData(IW, IH), IW, IH, n: MenuArt.noise(6), nw: MenuArt.noise(5),
            // [radial offset, angle deg, depth, max half width]
            lobes: [[0, 0, 90, 62], [0.5, 175, 56, 34], [0.5, 5, 62, 32], [0.48, 235, 50, 30], [0.48, 305, 54, 30], [0.42, 112, 36, 22]],
            crystals: [[0, -20, 30, 1], [0, 50, 22, 0.8], [1, 30, 24, 0.7], [0, 160, 50, 0.9], [3, 10, 20, 0.8], [4, -30, 26, 0.9]],   // [lobe, angle round it, depth, size]
            vines: Array.from({ length: 22 }, (_, k) => [k / 22 * 360 + MenuArt.rng(k + 3)() * 12, 10 + MenuArt.rng(k + 9)() * 30, MenuArt.rng(k + 17)() * 6]) };
        const img = this.add.image(ix, iy, key).setOrigin(0).setScale(S);
        land.addAt(img, land.list.length - 1);
        this._rockA = null;
        this._rockDraw(0);
    }
    _rockDraw(A) {
        this._rockA = A;
        const K = this._rock, { IW, IH } = K, cx = 105, top = 62, rx = 90, ry = 24, th = A * Math.PI / 180, d = K.img.data;
        d.fill(0);
        const zb = new Float32Array(IW), who = new Int8Array(IW), ss = new Float32Array(IW), hws = new Float32Array(IW), cell = (a, b) => MenuArt.rng(a * 73 + b * 151)();
        const put = (x, y, c) => { if (x < 0 || y < 0 || x >= IW || y >= IH) return; const i = (y * IW + x) * 4; d[i] = (c >> 16) & 255; d[i + 1] = (c >> 8) & 255; d[i + 2] = c & 255; d[i + 3] = 255; };
        const geo = (L, y) => { const [rho, phi, depth, mw] = L, t = (y - top) / depth; if (t >= 1 || t < 0) return null; const a = phi * Math.PI / 180 + th; return { X: cx + rho * rx * Math.cos(a), Z: rho * Math.sin(a) * 90, hw: mw * Math.pow(1 - t, 1.15) * (0.8 + 0.4 * K.n(y * 0.15, phi)) }; };
        for (let y = top; y < IH; y++) {
            zb.fill(-1e9); who.fill(-1);
            K.lobes.forEach((L, li) => {
                const g = geo(L, y); if (!g || g.hw < 0.5) return;
                for (let x = Math.floor(g.X - g.hw); x <= Math.ceil(g.X + g.hw); x++) {
                    const sx = (x + 0.5 - g.X) / g.hw; if (sx < -1 || sx > 1 || x < 0 || x >= IW) continue;
                    const z = g.Z + g.hw * Math.sqrt(1 - sx * sx);
                    if (z > zb[x]) { zb[x] = z; who[x] = li; ss[x] = sx; hws[x] = g.hw; }
                }
            });
            for (let x = 0; x < IW; x++) {
                const li = who[x]; if (li < 0) continue;
                const sx = ss[x], U = (Math.asin(sx) - th) * K.lobes[li][3] + li * 400, V = y;
                const jx = U + K.n(U * 0.1, V * 0.1) * 8, jy = V + K.n(U * 0.1 + 5, V * 0.1) * 6, cxl = Math.floor(jx / 13), cyl = Math.floor(jy / 9), fx = jx / 13 - cxl, fy = jy / 9 - cyl, sh = cell(cxl, cyl);
                let c = sh > 0.66 ? 0x4a4468 : sh > 0.33 ? 0x3c3658 : 0x302a4a;
                if (fy < 0.1 || fx < 0.07) c = 0x1a1530; else if (fy < 0.22) c = MenuArt.mix(c, 0x6a6290, 0.45);   // the cracks, each boulder's lit top
                if (sx > 0.55) c = MenuArt.mix(c, 0x9a8ad0, 0.55 * (sx - 0.55) / 0.45 + 0.2); else if (sx < -0.5) c = MenuArt.mix(c, 0x0e0a1c, 0.5);   // the moon on its right
                if (y - top < 5) c = MenuArt.mix(c, 0x0e0a1c, 0.55 - (y - top) * 0.09);
                const dep = (y - top) / 90; if (dep > 0.55 && MenuArt.bayer(x, y) < (dep - 0.55) * 1.6) c = MenuArt.mix(c, 0x0e0a1c, 0.5);
                put(x, y, c);
            }
        }
        // the outline, where the rock meets the sky
        const a0 = i => d[i + 3];
        const out = [];
        for (let y = top; y < IH; y++) for (let x = 0; x < IW; x++) { const i = (y * IW + x) * 4; if (!a0(i)) continue; if (x === 0 || x === IW - 1 || y === IH - 1 || !a0(i - 4) || !a0(i + 4) || !a0(i + IW * 4)) out.push([x, y]); }
        for (const [x, y] of out) put(x, y, 0x0c0818);
        // crystals growing out of it, on whichever lobe faces you
        for (const [li, ang, dy, sz] of K.crystals) {
            const L = K.lobes[li], y0 = top + dy, g = geo(L, y0); if (!g) continue;
            const a = ang * Math.PI / 180 + th; if (Math.cos(a) < 0.15) continue;
            const x0 = Math.round(g.X + g.hw * Math.sin(a) * 0.85);
            if (g.Z + g.hw * Math.cos(a) < zb[x0] - 6) continue;
            for (const [ox, h, w] of [[0, 11 * sz, 2.2], [-3, 7 * sz, 1.5], [3, 8 * sz, 1.5]]) for (let j = 0; j < h; j++) { const ww = Math.max(0.4, w * (1 - j / h)); for (let x = -ww; x <= ww; x += 1) put(Math.round(x0 + ox + x), y0 + j, j >= h - 1.5 ? 0xffffff : x < 0 ? 0xe0ccff : x > ww / 2 ? 0x4a2a8a : 0x9a6af0); }
        }
        // vines off the rim, those on the near half
        for (const [deg, len, ph] of K.vines) {
            const a = deg * Math.PI / 180 + th; if (Math.sin(a) < 0.12) continue;
            const x0 = cx + Math.cos(a) * rx * 0.96, y0 = Math.round(top + Math.sin(a) * ry + 4);
            let x = x0;
            for (let j = 0; j < len; j++) { x = x0 + Math.sin(j * 0.22 + ph) * (1.5 + j * 0.06); put(Math.round(x), y0 + j, 0x22381e); if (j % 4 === 2) { const sd = (j / 4) % 2 ? 1 : -1; put(Math.round(x + sd), y0 + j, 0x4a8a3a); put(Math.round(x + sd * 2), y0 + j - 1, 0x6aa84a); } }
            if (ph > 3) { put(Math.round(x), y0 + len, 0x9affd8); put(Math.round(x), y0 + len + 1, 0x5ad8b0); }
        }
        K.ctx.putImageData(K.img, 0, 0); K.tex.refresh();
    }
    // a crystal pillar alone (as the island painter draws them), standing on its foot
    _pillarTex(h) {
        return MenuArt.tex(this, 'isle_pillar_' + h, 13, h + 5, P => {
            const px = 6, py = h + 4;
            for (let y = py - 3; y <= py; y++) for (let x = px - 4; x <= px + 4; x++) P.put(x, y, y === py - 3 ? 0xa8a6c0 : 0x5a5874);
            for (const [ox, hh, w] of [[0, h, 3], [-3, h * 0.6, 2], [3, h * 0.7, 2]]) for (let j = 0; j < hh; j++) {
                const ww = Math.max(0.5, w * (1 - j / hh));
                for (let x = -ww; x <= ww; x++) P.put(px + ox + x, py - 4 - j, x < -ww / 3 ? 0xe0ccff : x > ww / 3 ? 0x4a2a8a : 0x8a5ae0);
            }
        });
    }
    // layer: 'base' (rock, soil, grass, rivers), 'dais' (the dais, its steps and pedestal, alone), or 'all'
    _paintIsland(P, IW, IH, layer = 'all') {
        const n = MenuArt.noise(5), n2 = MenuArt.noise(6), R = MenuArt.rng(21), cx = 105, top = 62, rx = 90, ry = 24;
        if (layer !== 'dais') {
        // The underside: three lobes of rock hanging off it (one deep in the middle, two
        // shallower), their union is the silhouette. The moon is on the right: the right faces
        // catch it, the left ones fall into shadow.
        const lobes = [[105, 90, 62], [64, 56, 34], [148, 62, 32]];   // [x, depth, half width]
        const inside = (x, y) => {
            if (y < top) return false;
            for (const [lx, d, hw] of lobes) {
                const t = (y - top) / d;
                if (t >= 1) continue;
                const w = hw * Math.pow(1 - t, 1.15) * (0.8 + 0.4 * n(y * 0.15, lx));
                if (Math.abs(x - lx) <= w) return true;
            }
            return false;
        };
        const rock = [];
        if (layer !== 'top') for (let y = top; y < IH; y++) for (let x = 0; x < IW; x++) if (inside(x, y)) rock.push([x, y]);   // ('top': the turning rock is drawn on its own, _rockDraw)
        for (const [x, y] of rock) {
            // chunky boulders: cells with cracks between them, each its own shade
            const jx = x + n2(x * 0.1, y * 0.1) * 8, jy = y + n2(x * 0.1 + 5, y * 0.1) * 6;
            const cxl = Math.floor(jx / 13), cyl = Math.floor(jy / 9), fx = jx / 13 - cxl, fy = jy / 9 - cyl;
            const cellShade = MenuArt.rng(cxl * 73 + cyl * 151)();
            let c = cellShade > 0.66 ? 0x4a4468 : cellShade > 0.33 ? 0x3c3658 : 0x302a4a;
            if (fy < 0.1 || fx < 0.07) c = 0x1a1530;                                        // the cracks
            else if (fy < 0.22) c = MenuArt.mix(c, 0x6a6290, 0.45);                           // each boulder's lit top edge
            const lit = !inside(x + 2, y) || !inside(x + 3, y - 1), shade = !inside(x - 2, y);
            if (lit) c = MenuArt.mix(c, 0x9a8ad0, 0.55);                                      // moonlit right faces
            if (shade) c = MenuArt.mix(c, 0x0e0a1c, 0.5);
            if (y - top < 5) c = MenuArt.mix(c, 0x0e0a1c, 0.55 - (y - top) * 0.09);          // shadow under the lip
            const depth = (y - top) / 90;
            if (depth > 0.55 && MenuArt.bayer(x, y) < (depth - 0.55) * 1.6) c = MenuArt.mix(c, 0x0e0a1c, 0.5);
            if (!inside(x, y + 1) || !inside(x - 1, y) || !inside(x + 1, y)) c = 0x0c0818;   // outline
            P.put(x, y, c);
        }
        // crystal clusters growing out of it, and a glow on the rock round them
        if (layer !== 'top') for (const [x0, y0, sz] of [[92, top + 30, 1], [128, top + 22, 0.8], [70, top + 24, 0.7], [110, top + 50, 0.9]]) {
            for (const [ox, h, w] of [[0, 11 * sz, 2.2], [-3, 7 * sz, 1.5], [3, 8 * sz, 1.5]]) {
                for (let j = 0; j < h; j++) {
                    const ww = Math.max(0.4, w * (1 - j / h));
                    for (let x = -ww; x <= ww; x += 1) P.put(x0 + ox + x, y0 + j, j >= h - 1.5 ? 0xffffff : x < 0 ? 0xe0ccff : x > ww / 2 ? 0x4a2a8a : 0x9a6af0);
                }
                P.put(x0 + ox - 1, y0, 0x0c0818); P.put(x0 + ox + 1, y0, 0x0c0818);
            }
        }
        // the dirt lip and the grass on top
        for (let y = top - ry; y <= top + ry + 9; y++) for (let x = cx - rx - 2; x <= cx + rx + 2; x++) {
            const e = ((x - cx) / rx) ** 2 + ((y - top) / ry) ** 2;
            const e2 = ((x - cx) / rx) ** 2 + ((y - top - 8) / ry) ** 2;
            if (e <= 1) {
                const g = MenuArt.fbm(n, x * 0.08, y * 0.12, 3);
                let c = g > 0.6 ? 0x5a9a4a : g > 0.42 ? 0x447a3a : 0x34602e;
                if (x < cx - 10 && y < top - 4 && MenuArt.bayer(x, y) < 0.4) c = MenuArt.mix(c, 0x8ac06a, 0.5);
                if (e > 0.9) c = 0x2a4a26;
                P.put(x, y, c);
            } else if (e2 <= 1 && y > top - 4) P.put(x, y, MenuArt.noise(3)(x * 0.4, y * 0.6) > 0.7 ? 0x7a5a40 : (x > cx + rx * 0.5 ? 0x6a4a30 : MenuArt.bayer(x, y) < 0.5 ? 0x4a2e1c : 0x3a2214));   // soil, pebbles, lit on the right
        }
        // tufts, flowers
        for (let k = 0; k < 60; k++) {
            const a = R() * Math.PI * 2, d = Math.sqrt(R()), x = cx + Math.cos(a) * rx * d * 0.95, y = top + Math.sin(a) * ry * d * 0.95;
            if (Math.hypot((x - cx) / 40, (y - top + 4) / 13) < 1) continue;   // not on the dais
            P.put(x, y, R() < 0.15 ? [0xff8ad8, 0xffe08a, 0xa8d8ff][Math.floor(R() * 3)] : 0x7ab85a); P.put(x, y - 1, 0x6aa84a);
        }
        // vines hanging off the rim: curling, leaves to either side, a glowing berry at the end
        if (layer !== 'top') for (let k = 0; k < 16; k++) {
            const x0 = cx + (R() - 0.5) * rx * 1.7, y0 = top + ry * Math.sqrt(Math.max(0, 1 - ((x0 - cx) / rx) ** 2)) + 4, len = 10 + R() * 30, ph = R() * 6;
            let x = x0;
            for (let j = 0; j < len; j++) {
                x = x0 + Math.sin(j * 0.22 + ph) * (1.5 + j * 0.06);
                P.put(x, y0 + j, 0x22381e);
                if (j % 4 === 2) { const sd = (j / 4) % 2 ? 1 : -1; P.put(x + sd, y0 + j, 0x4a8a3a); P.put(x + sd * 2, y0 + j - 1, 0x6aa84a); }
            }
            if (R() < 0.5) { P.put(x, y0 + len, 0x9affd8); P.put(x, y0 + len + 1, 0x5ad8b0); }
        }
        // the grass's fringe hanging over the soil
        for (let x = cx - rx + 4; x < cx + rx - 4; x++) {
            const yb = top + ry * Math.sqrt(Math.max(0, 1 - ((x - cx) / rx) ** 2));
            const h = 1 + Math.floor(n(x * 0.5, 9) * 4);
            for (let j = 0; j < h; j++) P.put(x, yb + 1 + j, j === h - 1 ? 0x2a4a26 : 0x447a3a);
        }
        // rivers: banks of dark grass, a water channel, from a spring under the dais to the rim
        for (const [list, back] of [[EnchantScene.BACK_FALLS, true], [EnchantScene.FALLS, false]]) list.forEach(([, n], k) => {
            const w = 1.2 + n * 0.35 * (back ? 0.8 : 1);   // the far ones, a touch narrower (they're further off)
            for (let t = 0; t <= 1; t += 0.004) { const [x, y] = EnchantScene.river(k, t, back); for (let dx = -w - 1.4; dx <= w + 1.4; dx++) P.put(x + dx, y, 0x24421f); }
            for (let t = 0; t <= 1; t += 0.004) {
                const [x, y] = EnchantScene.river(k, t, back);
                for (let dx = -w; dx <= w; dx++) P.put(x + dx, y, Math.abs(dx) > w - 1 ? 0x2a5a9a : MenuArt.bayer(Math.round(x + dx), Math.round(y)) < 0.3 ? 0x7ab8f0 : 0x3a78c8);
            }
        });
        }
        if (layer !== 'base') {
        // the dais: its side, its top (stone flags), the rune ring cut into it, steps down the front
        const dx = cx, dy = top - 4, drx = 40, dry = 11;
        for (let y = dy - dry; y <= dy + dry + 4; y++) for (let x = dx - drx; x <= dx + drx; x++) {
            const e = ((x - dx) / drx) ** 2 + ((y - dy) / dry) ** 2, eSide = ((x - dx) / drx) ** 2 + ((y - dy - 4) / dry) ** 2;
            if (e <= 1) {
                let c = MenuArt.fbm(n2, x * 0.2, y * 0.3) > 0.5 ? 0x8a88a4 : 0x7a7894;
                if ((x + Math.floor(y / 4) * 5) % 10 === 0 || y % 4 === 0) c = 0x5a5874;   // the flags' seams
                if (Math.abs(e - 0.62) < 0.06) c = 0x6a4aa8;                            // the ring
                if (e > 0.92) c = 0xa8a6c0;
                P.put(x, y, c);
            } else if (eSide <= 1) P.put(x, y, y > dy + dry ? 0x3a384c : 0x4a4860);
        }
        for (let s = 0; s < 3; s++) for (let x = dx - 9 + s * 2; x <= dx + 9 - s * 2; x++) { P.put(x, dy + dry + 1 + s * 2, 0x9a98b4); P.put(x, dy + dry + 2 + s * 2, 0x4a4860); }
        // the pedestal
        for (let y = dy - 20; y <= dy; y++) for (let x = dx - 5; x <= dx + 5; x++) P.put(x, y, x < dx - 3 ? 0xb0aec8 : x > dx + 3 ? 0x5a5874 : 0x8a88a4);
        for (let x = dx - 8; x <= dx + 8; x++) { P.put(x, dy - 21, 0xc8c6dc); P.put(x, dy - 20, 0x6a6884); }
        for (let y = dy - 16; y <= dy - 4; y += 4) P.put(dx, y, 0xb88aff);
        }
        // four crystal pillars round it: a stone foot, a cluster of shards
        const pillar = (px, py, h) => {
            for (let y = py - 3; y <= py; y++) for (let x = px - 4; x <= px + 4; x++) P.put(x, y, y === py - 3 ? 0xa8a6c0 : 0x5a5874);
            for (const [ox, hh, w] of [[0, h, 3], [-3, h * 0.6, 2], [3, h * 0.7, 2]]) {
                for (let j = 0; j < hh; j++) {
                    const ww = Math.max(0.5, w * (1 - j / hh));
                    for (let x = -ww; x <= ww; x++) P.put(px + ox + x, py - 4 - j, x < -ww / 3 ? 0xe0ccff : x > ww / 3 ? 0x4a2a8a : 0x8a5ae0);
                }
            }
        };
        if (layer === 'all') { pillar(72, 50, 20); pillar(138, 50, 20); pillar(62, 66, 26); pillar(148, 66, 26); }
        this._pillarPaint = pillar;   // (the turning island stands them up as sprites: _pillarTex)
    }

    // ── THE ALTAR'S BUTTONS ───────────────────────────────────────────────────
    _drawAltarUI() {
        for (const o of this._altarUI) o.destroy?.();
        this._altarUI = [];
        const keep = o => { this._altarUI.push(o); return o; };
        const AW = this.scale.width, H = this.scale.height, y = H - 92, P = UIKit.PALETTE;
        const books = Enchants.books(), dust = Enchants.dust(), pity = Enchants.pity(), U = Enchants.UNSEAL;
        // nothing to unseal: the book over the altar goes dark and its light goes out
        if (this._altarBook) { if (books) this._altarBook.clearTint(); else this._altarBook.setTint(0x2e2a3a); this._altarHalo.setVisible(books > 0); }
        const plate = keep(this.add.graphics().setDepth(19));
        plate.fillStyle(0x0a0618, 0.82); plate.fillRoundedRect(AW / 2 - 300, y - 44, 600, 120, 10);
        plate.lineStyle(2, 0x8a5aff, 0.7); plate.strokeRoundedRect(AW / 2 - 300, y - 44, 600, 120, 10);
        keep(this.add.image(AW / 2 - 270, y - 18, ShopScene.bookIcon(this, -1), '0').setScale(1.4).setDepth(20));
        keep(this.add.text(AW / 2 - 246, y - 30, `${books} sealed`, { fontSize: '15px', fontFamily: UIKit.FONT.title, fontStyle: 'bold', color: '#f4e8cc' }).setDepth(20));
        keep(this.add.text(AW / 2 - 246, y - 10, `✧ ${dust} dust`, { fontSize: '13px', fontFamily: 'monospace', fontStyle: 'bold', color: '#c8b8ff' }).setDepth(20));
        keep(this.add.text(AW / 2 + 280, y - 30, `Epic+ within ${Enchants.PITY_EPIC - pity.e}\nLegendary+ within ${Enchants.PITY_LEG - pity.l}`, { fontSize: '11px', fontFamily: 'monospace', color: UIKit.CSS.textLo, align: 'right' }).setOrigin(1, 0).setDepth(20));
        const can = k => books >= k && dust >= U * k;
        const go = k => {
            if (this._busy) return;
            if (!books) { Sfx.play(this, 'deny'); this._say('No sealed books. The Tower drops them.'); return; }
            const n = Math.min(k, books, Math.floor(dust / U));
            if (n < 1) { Sfx.play(this, 'deny'); this._say(`Unsealing takes ✧${U} dust. Salvage books you don't want, or climb the Tower.`); return; }
            this._unseal(n);
        };
        UIKit.button(this, { x: AW / 2 - 110, y: y + 40, w: 200, h: 44, label: `UNSEAL  ·  ✧${U}`, accent: can(1) ? 0x9a6aff : P.line, depth: 21, fontSize: '15px', fireOn: 'down', onClick: () => go(1) }).objs.forEach(keep);
        UIKit.button(this, { x: AW / 2 + 110, y: y + 40, w: 200, h: 44, label: `UNSEAL 10  ·  ✧${U * 10}`, accent: can(2) ? P.accentGold : P.line, depth: 21, fontSize: '15px', fireOn: 'down', onClick: () => go(10) }).objs.forEach(keep);
    }

    // A pull: a beam falls on the altar, the book there bursts, then the reveal (ShopScene._enchReveal).
    // The opening at the altar: the sealed book strains at its chains while the rune circle
    // flares; the chains snap and fly apart; rings of light come down a beam from the sky onto
    // it as it rises; it bursts open, and the cards come out of it (the reveal).
    _unseal(n) {
        if (this._busy) return;
        const got = [];
        for (let i = 0; i < n; i++) { const b = Enchants.open(); if (!b) break; got.push(b); }
        if (!got.length) return;
        this._busy = true;
        const bk = this._altarBook, bx = bk.x, by = bk.y + (this._land?.y || 0), D = 31, objs = [], keep = o => { objs.push(o); return o; }, bkDepth = bk.depth;   // (31: over the menus, which the dark covers)
        const best = Math.max(...got.map(b => Enchants.def(b.id).r)), col = best >= 3 ? Enchants.RARITY[best].col : 0xc8a0ff;
        this._spend('book', got.length, { x: bx, y: by }); this._spend('dust', Enchants.UNSEAL * got.length, { x: bx, y: by });   // what it cost, flying to the altar
        // 0. the wind-up: the world goes dark round the altar and the music drops; three heartbeats, quicker each time, the
        // camera punching in on each, a ring pulsing off it, cracks of light spreading over the seal. The light in them is
        // a tell: Epic or better and it turns that colour on the last beat, lightning striking it from the sky.
        const W0 = this.scale.width, H0 = this.scale.height;
        const dark = keep(this.add.rectangle(W0 / 2, H0 / 2, W0 * 3, H0 * 3, 0x05030a, 0).setDepth(D - 1).setScrollFactor(0));
        this.tweens.add({ targets: dark, fillAlpha: 0.88, duration: 500 });
        bk.setDepth(D + 0.5);   // the book, lit, above the dark
        const cam = this.cameras.main, Z = 2.3;   // the camera closes in on the book
        cam.pan(bx, by, 600, 'Cubic.easeInOut'); cam.zoomTo(Z, 600, 'Cubic.easeInOut');
        Music.duck(true);
        const cracks = keep(this.add.graphics().setDepth(D + 3).setBlendMode(Phaser.BlendModes.ADD)), CR = MenuArt.rng(got.length * 31 + best);
        const paths = Array.from({ length: 7 }, () => { const a = CR() * Math.PI * 2; return { a, pts: [[0, 0]] }; });
        const halo = keep(this.add.image(bx, by, 'mn_glow').setTint(0xc8a0ff).setBlendMode(Phaser.BlendModes.ADD).setDisplaySize(40, 40).setAlpha(0).setDepth(D + 0.2));   // light swelling behind it, beat by beat
        const beats = [500, 1000, 1380], build = 1700;
        beats.forEach((t, i) => this.time.delayedCall(t, () => {
            const last = i === beats.length - 1, c = last && best >= 2 ? col : 0xc8a0ff, v = (i + 1) / beats.length;
            Sfx.play(this, 'e_heart', { v });
            if (i) { cam.zoomTo(Z * (1.04 + v * 0.06), 90, 'Quad.easeOut'); this.time.delayedCall(110, () => cam.zoomTo(Z, 260, 'Quad.easeIn')); }
            const pr = keep(this.add.circle(bx, by, 24).setStrokeStyle(3 + i * 2, c, 0.9).setDepth(D + 2));
            this.tweens.add({ targets: pr, scale: 4 + i * 2, alpha: 0, duration: 520, ease: 'Quad.easeOut' });
            this.tweens.add({ targets: bk, scale: bk.scale * (1.08 + i * 0.04), duration: 80, yoyo: true });
            halo.setTint(c); this.tweens.add({ targets: halo, alpha: 0.5 + v * 0.4, displayWidth: 60 + v * 90, displayHeight: 60 + v * 90, duration: 120, ease: 'Quad.easeOut' });
            for (const P of paths) for (let k = 0; k < 2; k++) { const [x, y] = P.pts[P.pts.length - 1], a = P.a + (CR() - 0.5) * 1.1, len = 5 + CR() * 6; P.pts.push([x + Math.cos(a) * len, y + Math.sin(a) * len * 0.8]); }
            cracks.clear();
            for (const P of paths) for (let k = 1; k < P.pts.length; k++) { cracks.lineStyle(6, c, 0.45); cracks.lineBetween(bx + P.pts[k - 1][0], by + P.pts[k - 1][1], bx + P.pts[k][0], by + P.pts[k][1]); cracks.lineStyle(2.5, 0xffffff, 1); cracks.lineBetween(bx + P.pts[k - 1][0], by + P.pts[k - 1][1], bx + P.pts[k][0], by + P.pts[k][1]); }
            if (last && best >= 2) { Sfx.play(this, 'e_thunder'); this._bolt(bx, by, col, D + 4); this.cameras.main.flash(120, (col >> 16) & 255, (col >> 8) & 255, col & 255); }
        }));
        this.time.delayedCall(build, () => cracks.destroy());
        const go = () => {
            // 1. it strains: two chains crossed over it and a padlock where they meet; the book shakes
            // against them, the links heat from grey to white, the circle on the dais flares
            this.tweens.add({ targets: bk, angle: { from: -10, to: 10 }, duration: 60, yoyo: true, repeat: 7 });
            const link = this._linkTex(), links = [];
            for (const s2 of [-1, 1]) for (let k = -5; k <= 5; k++) {
                if (k === 0) continue;   // the lock sits there
                const l = keep(this.add.image(bx + k * 7, by + s2 * k * 5, link).setScale(2).setDepth(D + 1).setAngle(Math.atan2(s2 * 5, 7) * 180 / Math.PI + (k % 2 ? 90 : 0)));
                l._k = k; l._s = s2; l._x0 = l.x; l._y0 = l.y; links.push(l);
            }
            const lock = keep(this.add.image(bx, by + 2, this._lockTex()).setScale(2.4).setDepth(D + 2));
            const heat = { v: 0 };
            this.tweens.add({ targets: heat, v: 1, duration: 560, ease: 'Quad.easeIn', onUpdate: () => {
                const v = heat.v, c = Phaser.Display.Color.Interpolate.ColorWithColor(Phaser.Display.Color.ValueToColor(0xffffff), Phaser.Display.Color.ValueToColor(0xffd0ff), 100, Math.round(v * 100));
                for (const l of links) { l.setTint(Phaser.Display.Color.GetColor(c.r, c.g, c.b)); l.x = l._x0 + (Math.random() - 0.5) * 3 * v; l.y = l._y0 + (Math.random() - 0.5) * 3 * v; }
                lock.x = bx + (Math.random() - 0.5) * 4 * v; lock.setScale(2.4 + v * 0.3);
            } });
            const flare = keep(this.add.graphics().setDepth(D - 0.5).setBlendMode(Phaser.BlendModes.ADD));
            this.tweens.addCounter({ from: 0, to: 1, duration: 700, onUpdate: tw => { const v = tw.getValue(); flare.clear(); flare.lineStyle(2 + v * 3, 0xb88aff, 0.25 + v * 0.35); flare.strokeEllipse(this._altar.x, this._altar.y + (this._land?.y || 0), 190 + v * 40, 56 + v * 12); } });
            Sfx.play(this, 'e_chain'); this.time.delayedCall(260, () => Sfx.play(this, 'e_chain'));
            // 2. the lock bursts, and the chains unravel from the middle out: each link drops off in turn,
            // tumbling and fading into sparks
            this.time.delayedCall(560, () => {
                Sfx.play(this, 'e_snap'); this.cameras.main.shake(200, 0.006);
                const fl = keep(this.add.image(bx, by, 'mn_glow').setTint(0xffe0ff).setBlendMode(Phaser.BlendModes.ADD).setDisplaySize(30, 30).setDepth(D + 3));
                this.tweens.add({ targets: fl, displayWidth: 200, displayHeight: 200, alpha: 0, duration: 400, ease: 'Quad.easeOut' });
                for (let k = 0; k < 8; k++) {   // the padlock in pieces
                    const sh = keep(this.add.rectangle(bx, by, 4, 4, k % 2 ? 0xc8a040 : 0xffe08a).setDepth(D + 2)), a = k / 8 * Math.PI * 2;
                    this.tweens.add({ targets: sh, x: bx + Math.cos(a) * 60, y: by + Math.sin(a) * 40 + 30, angle: 360, alpha: 0, duration: 600, ease: 'Quad.easeOut' });
                }
                lock.destroy();
                for (const l of links) {
                    const out = Math.abs(l._k), dir = Math.sign(l._k);
                    this.tweens.add({ targets: l, delay: out * 45, x: l.x + dir * (30 + Math.random() * 30), y: l.y + 70 + Math.random() * 40, angle: l.angle + dir * (200 + Math.random() * 260),
                        alpha: 0, duration: 650, ease: 'Quad.easeIn', onStart: () => l.setTint(0xd8b8ff) });
                }
                const sp = keep(this.add.particles(0, 0, 'mn_px2', { x: { min: bx - 40, max: bx + 40 }, y: { min: by - 20, max: by + 20 }, lifespan: 700, speedY: { min: 20, max: 90 },
                    speedX: { min: -40, max: 40 }, scale: { start: 1.6, end: 0 }, tint: [0xd8b8ff, 0xffffff], blendMode: 'ADD', frequency: 25 }).setDepth(D + 1));
                this.time.delayedCall(500, () => sp.stop());
            });
            // 3. a beam from the sky, rings of light coming down it, the book rising into it
            this.time.delayedCall(700, () => {
                const beam = keep(this.add.image(bx, -20, 'mn_shaft').setOrigin(0.5, 0).setTint(col).setBlendMode(Phaser.BlendModes.ADD).setDisplaySize(40, by + 20).setAlpha(0).setDepth(D));
                this.tweens.add({ targets: beam, alpha: 1, displayWidth: 150, duration: 450 });
                for (let k = 0; k < 4; k++) {
                    const ring = keep(this.add.graphics().setDepth(D + 2).setBlendMode(Phaser.BlendModes.ADD));
                    this.tweens.addCounter({ from: 0, to: 1, delay: k * 120, duration: 500, ease: 'Quad.easeIn', onUpdate: tw => {
                        const v = tw.getValue(), yy = 20 + (by - 20) * v, w = 120 - v * 70;
                        ring.clear(); ring.lineStyle(3, k % 2 ? 0xffffff : col, 1 - v * 0.5); ring.strokeEllipse(bx, yy, w, w * 0.3);
                    } });
                }
                this.tweens.add({ targets: bk, y: bk.y - 26, scale: 3.4, duration: 650, ease: 'Cubic.easeOut' });
                Sfx.play(this, 'e_beam');
                if (best >= 2) for (let q = 0; q < best - 1; q++) this.time.delayedCall(q * 180, () => this._bolt(bx, by - 26, col, D + 4));
            });
            // 4. it bursts open
            this.time.delayedCall(1350, () => {
                this.cameras.main.flash(260, (col >> 16) & 255, (col >> 8) & 255, col & 255);
                const p = this.add.particles(0, 0, 'mn_px2', { x: bx, y: by - 26, lifespan: 900, speed: { min: 80, max: 260 }, gravityY: 120, scale: { start: 2, end: 0 }, alpha: { start: 1, end: 0 },
                    tint: [col, 0xffffff, 0xd8c8ff], blendMode: 'ADD', emitting: false }).setDepth(D + 3);
                p.explode(70 + best * 25); this.time.delayedCall(1100, () => p.destroy()); Sfx.play(this, 'e_burst');
                Music.duck(false); dark.destroy(); bk.setDepth(bkDepth);
                cam.pan(this.scale.width / 2, this.scale.height / 2, 1); cam.setZoom(1); cam.setScroll(0, 0);   // snapped back under the flash
                this.tweens.timeScale = 0.3; this.time.timeScale = 0.3;   // a breath of slow motion as it opens
                setTimeout(() => { this.tweens.timeScale = 1; this.time.timeScale = 1; }, 380);
                const W = this.scale.width, H = this.scale.height;   // a shockwave over the whole screen
                const sw = this.add.circle(bx, by - 26, 30).setStrokeStyle(10, col, 0.9).setDepth(D + 4);
                this.tweens.add({ targets: sw, scale: Math.hypot(W, H) / 30, alpha: 0, duration: 900, ease: 'Cubic.easeOut', onComplete: () => sw.destroy() });
                const sw2 = this.add.circle(bx, by - 26, 30).setStrokeStyle(4, 0xffffff, 0.9).setDepth(D + 4);
                this.tweens.add({ targets: sw2, scale: Math.hypot(W, H) / 50, alpha: 0, duration: 700, delay: 80, ease: 'Cubic.easeOut', onComplete: () => sw2.destroy() });
                this.cameras.main.shake(320, 0.006 + best * 0.002);
                objs.forEach(o => { if (o?.active) { this.tweens.killTweensOf(o); o.destroy(); } });
                this.tweens.add({ targets: bk, y: bk.y + 26, scale: 2.2, angle: 0, duration: 400, ease: 'Quad.easeOut' });
                this._busy = false;
                this._enchReveal(got, () => { this._drawAltarUI(); this._panel(); });
            });
        };
        this.time.delayedCall(build, go);
    }
    // a jagged bolt from the top of the screen down to (x, y), white-hot in col, gone in a blink
    _bolt(x, y, col, D) {
        const g = this.add.graphics().setDepth(D).setBlendMode(Phaser.BlendModes.ADD), pts = [[x + (Math.random() - 0.5) * 160, -10]];
        for (let k = 1; k <= 10; k++) { const u = k / 10; pts.push([pts[0][0] + (x - pts[0][0]) * u + (k < 10 ? (Math.random() - 0.5) * 50 : 0), -10 + (y + 10) * u]); }
        for (const [w, c, a] of [[12, col, 0.35], [5, col, 0.9], [2, 0xffffff, 1]]) { g.lineStyle(w, c, a); g.beginPath(); g.moveTo(...pts[0]); for (const p of pts.slice(1)) g.lineTo(...p); g.strokePath(); }
        const gl = this.add.image(x, y, 'mn_glow').setTint(col).setBlendMode(Phaser.BlendModes.ADD).setDisplaySize(140, 140).setDepth(D);
        this.tweens.add({ targets: [g, gl], alpha: 0, duration: 260, delay: 60, onComplete: () => { g.destroy(); gl.destroy(); } });
        Sfx.play(this, 'e_thunder');
    }
    // ── THE PULL ──────────────────────────────────────────────────────────────
    // The sealed book trembles over a summoning circle while light pours into it; then it opens
    // onto a card that spins through enchants it could have been (rarer ones as it slows,
    // teasing upward) before it lands on what you got: a flash, a shockwave, rays, sparks, and
    // the quality filling in. Ten at once spin together and land one by one, the best last.
    _enchReveal(got, onDone) {
        this._closeReveal();
        const W = this.scale.width, H = this.scale.height, D = 90, fx = [], keep = o => { fx.push(o); return o; };
        this._enchFx = fx; this._busy = true;
        const cx = W / 2, cy = H / 2 - 30, one = got.length === 1, best = Math.max(...got.map(b => Enchants.def(b.id).r));
        const veil = keep(this.add.rectangle(cx, H / 2, W, H, 0x05030a, 0).setDepth(D).setInteractive());
        this.tweens.add({ targets: veil, fillAlpha: 0.94, duration: 300 });
        // the summoning circle
        const circ = keep(this.add.graphics().setDepth(D + 1).setPosition(cx, cy + (one ? 40 : 0)).setScale(0.2).setAlpha(0));
        // a circle on the floor (flat, so it turns by its runes moving round it, not by rotating)
        let circCol = 0x9a6aff;
        const drawCirc = (col) => { circCol = col; };
        const tickCirc = (t) => {
            if (!circ.active) return;
            const ph = t * 0.0007, col = circCol;
            circ.clear();
            circ.lineStyle(3, col, 0.9); circ.strokeEllipse(0, 0, 420, 150);
            circ.lineStyle(1.5, col, 0.6); circ.strokeEllipse(0, 0, 360, 126); circ.strokeEllipse(0, 0, 250, 86);
            for (let k = 0; k < 24; k++) { const a = k / 24 * Math.PI * 2 + ph; circ.fillStyle(col, 0.85); circ.fillRect(Math.cos(a) * 195 - 3, Math.sin(a) * 69 - 2, k % 3 ? 4 : 8, 4); }
            for (let k = 0; k < 16; k++) { const a = k / 16 * Math.PI * 2 - ph * 1.6; circ.fillStyle(0xffffff, 0.6); circ.fillRect(Math.cos(a) * 152 - 1, Math.sin(a) * 53 - 1, 3, 3); }
            for (let k = 0; k < 6; k++) { const a = k / 6 * Math.PI * 2 + ph * 0.5, b = a + Math.PI * 2 / 3; circ.lineStyle(1.5, col, 0.5); circ.lineBetween(Math.cos(a) * 180, Math.sin(a) * 63, Math.cos(b) * 180, Math.sin(b) * 63); }
        };
        this._ticks.push(this._circTick = tickCirc);
        this.tweens.add({ targets: circ, scale: one ? 1 : 1.6, alpha: 1, duration: 500, ease: 'Back.easeOut' });
        // light drawn in from all round
        const inflow = keep(this.add.particles(0, 0, 'mn_px2', { x: { min: cx - 380, max: cx + 380 }, y: { min: cy - 260, max: cy + 260 }, moveToX: cx, moveToY: cy,
            lifespan: 700, scale: { start: 0.4, end: 2 }, alpha: { start: 0, end: 1 }, tint: [0xd8b8ff, 0x9a6aff, 0xffffff], blendMode: 'ADD', frequency: 14 }).setDepth(D + 2));
        Sfx.play(this, 'clink');
        // the cards: a sealed book each, trembling, then spinning
        const cols = Math.min(5, got.length), sc = one ? 1.25 : 0.62;
        const spot = j => one ? [cx, cy] : [cx + ((j % cols) - (cols - 1) / 2) * 190, cy - 90 + Math.floor(j / cols) * 230];
        const order = got.map((b, i) => ({ b, i })).sort((a, b) => Enchants.def(a.b.id).r - Enchants.def(b.b.id).r);
        const cards = order.map(({ b }, j) => this._revealCard(keep, ...spot(j), sc, b, D + 3));
        const shake = this.tweens.add({ targets: cards.map(c => c.c), angle: { from: -3, to: 3 }, duration: 60, yoyo: true, repeat: 10 });
        let landed = 0;
        this.time.delayedCall(800, () => {
            inflow.stop();
            this.cameras.main.flash(160, 200, 170, 255);
            Sfx.play(this, 'e_flip');
            cards.forEach((c, j) => {
                const r = Enchants.def(c.b.id).r, n = one ? 22 + r * 5 : 14 + j * 3 + r * 2;
                c.spin(n, () => {
                    landed++;
                    if (c.r >= best) drawCirc(Enchants.RARITY[best].col);
                    if (landed === cards.length) this.time.delayedCall(500, () => {
                        const hint = keep(this.add.text(W / 2, H - 40, 'click to continue', { fontSize: '13px', fontFamily: 'monospace', color: UIKit.CSS.textLo }).setOrigin(0.5).setDepth(D + 9));
                        this.tweens.add({ targets: hint, alpha: 0.4, duration: 600, yoyo: true, repeat: -1 });
                        veil.once('pointerdown', () => { this._closeReveal(); this._busy = false; onDone?.(); });
                    });
                });
            });
        });
    }
    // One card of the pull: built sealed, then spin(n, onLand) runs it through n enchants,
    // slowing, the last few climbing toward its real rarity, and lands it.
    _revealCard(keep, x, y, sc, b, D) {
        const d = Enchants.def(b.id), r = d.r, R = Enchants.RARITY[r], CWd = 150 * sc, CH = 200 * sc;
        const c = keep(this.add.container(x, y).setDepth(D));
        const rays = this.add.graphics().setAlpha(0);
        const frame = this.add.graphics();
        const icon = this.add.sprite(0, -CH * 0.16, ShopScene.bookIcon(this, -1), '0').setScale(3.4 * sc);
        const name = this.add.text(0, CH * 0.2, '', { fontSize: `${Math.round(17 * sc + 4)}px`, fontFamily: UIKit.FONT.title, fontStyle: 'bold', color: '#ffffff', stroke: '#000', strokeThickness: 4, align: 'center', wordWrap: { width: CWd * 1.4 } }).setOrigin(0.5);
        const tag = this.add.text(0, CH * 0.33, '', { fontSize: `${Math.round(9 * sc + 4)}px`, fontFamily: 'monospace', fontStyle: 'bold', color: '#ffffff', stroke: '#000', strokeThickness: 3 }).setOrigin(0.5);
        c.add([rays, frame, icon, name, tag]);
        const paint = (col, lit) => {
            frame.clear();
            frame.fillStyle(0x0d0a14, 0.92); frame.fillRoundedRect(-CWd / 2, -CH / 2, CWd, CH, 10 * sc);
            frame.lineStyle(lit ? 4 : 2, col, 1); frame.strokeRoundedRect(-CWd / 2, -CH / 2, CWd, CH, 10 * sc);
            frame.lineStyle(1, col, 0.5); frame.strokeRoundedRect(-CWd / 2 + 6, -CH / 2 + 6, CWd - 12, CH - 12, 8 * sc);
        };
        paint(0x6a5a80, false);
        const show = (dd, rr) => { const bk = ShopScene.bookIcon(this, rr, dd.b, dd.id); icon.setTexture(bk, '0'); if (this.anims.exists(bk)) icon.play(bk); name.setText(dd.name); tag.setText(Enchants.RARITY[rr].name).setColor(UIKit._hex(Enchants.RARITY[rr].col)); paint(Enchants.RARITY[rr].col, false); };
        const spin = (n, onLand) => {
            // what it shows on the way: mostly low rarities, the last few stepping up toward r
            const seq = [];
            for (let i = 0; i < n; i++) {
                const left = n - i;
                const rr = left <= r + 1 ? Math.max(0, r - (left - 1)) : Math.random() < 0.7 ? 0 : Math.random() < 0.7 ? 1 : 2;
                const rrr = Math.min(rr, r, 4), pool = Enchants.LIST.filter(e => e.r === rrr);   // a corrupted one never shows itself early
                seq.push([pool[Math.floor(Math.random() * pool.length)], rrr]);
            }
            let i = 0;
            const step = () => {
                if (!c.active || !name.active) return;
                if (i < n) {
                    const [dd, rr] = seq[i]; show(dd, rr);
                    this.tweens.add({ targets: icon, scale: { from: 3.8 * sc, to: 3.4 * sc }, duration: 80 });
                    Sfx.play(this, 'e_tick', { p: i / n });
                    const t = i / n; i++;
                    this.time.delayedCall(45 + 330 * Math.pow(t, 3), step);
                    return;
                }
                // a big one: everything holds its breath first (the music drops, the card trembles in its colour, a riser)
                if (r >= 3 && !c._teased) {
                    c._teased = true;
                    const hold = 800 + (r - 3) * 500;
                    Sfx.play(this, 'e_riser', { r }); if (r < 5) Music.duck(true);
                    const tg = keep(this.add.image(c.x, c.y, 'mn_glow').setTint(r === 5 ? 0x7aff5a : R.col).setBlendMode(Phaser.BlendModes.ADD).setDisplaySize(60, 60).setAlpha(0).setDepth(D - 1));
                    this.tweens.add({ targets: tg, alpha: 0.9, displayWidth: 300 * sc + r * 40, displayHeight: 300 * sc + r * 40, duration: hold, ease: 'Quad.easeIn' });
                    this.tweens.add({ targets: c, angle: { from: -2, to: 2 }, duration: 50, yoyo: true, repeat: Math.floor(hold / 100) });
                    this.cameras.main.zoomTo(1.04 + (r - 3) * 0.02, hold, 'Quad.easeIn');
                    this.time.delayedCall(hold, () => { this.cameras.main.zoomTo(1, 200); if (r < 5) Music.duck(false); if (tg.active) tg.destroy(); step(); });
                    return;
                }
                // a corrupted one: the card breaks before it lands
                if (r === 5 && !c._torn) { c._torn = true; this._corruptBreak(keep, c, () => step()); return; }
                // it lands: the card flips over onto what it is
                this.tweens.add({ targets: c, scaleX: 0, duration: 90, ease: 'Quad.easeIn', onComplete: () => {
                    show(d, r); paint(R.col, true); name.setText(r >= 4 ? d.name : `${d.name} ${Enchants.roman(b.lvl)}`);
                    if (r === 5) this._glitchName(name, d.name);
                    c.setScale(0, 1.25); this.tweens.add({ targets: c, scaleX: 1, scaleY: 1, duration: 360, ease: 'Back.easeOut' });
                } });
                if (r >= 2) {   // a pillar of its colour, standing behind it
                    const pil = keep(this.add.image(c.x, c.y + CH / 2, 'mn_shaft').setOrigin(0.5, 1).setTint(R.col).setBlendMode(Phaser.BlendModes.ADD).setDisplaySize(CWd * 0.9, 0).setAlpha(0.7).setDepth(D - 2));
                    this.tweens.add({ targets: pil, displayHeight: this.scale.height, duration: 380, ease: 'Cubic.easeOut' });
                    this.tweens.add({ targets: pil, alpha: 0.35, duration: 900, yoyo: true, repeat: -1, delay: 400 });
                }
                if (r >= 3) {   // glyphs circling it
                    const gr = keep(this.add.graphics().setDepth(D + 2).setPosition(c.x, c.y).setBlendMode(Phaser.BlendModes.ADD));
                    for (let k = 0; k < 12; k++) { const a = k / 12 * Math.PI * 2; gr.fillStyle(k % 3 ? R.col : 0xffffff, 0.9); gr.fillRect(Math.cos(a) * CWd * 0.9 - 2, Math.sin(a) * CWd * 0.9 - 2, k % 3 ? 4 : 6, 4); }
                    this.tweens.add({ targets: gr, angle: 360, duration: 6000, repeat: -1 });
                }
                const glow = keep(this.add.image(c.x, c.y, 'mn_glow').setTint(R.col).setBlendMode(Phaser.BlendModes.ADD).setDisplaySize(10, 10).setDepth(D - 1));
                this.tweens.add({ targets: glow, displayWidth: 420 * sc + r * 80, displayHeight: 420 * sc + r * 80, alpha: { from: 1, to: 0.35 }, duration: 500, ease: 'Quad.easeOut' });
                const ring = keep(this.add.graphics().setDepth(D - 1).setPosition(c.x, c.y));
                ring.lineStyle(6, R.col, 1); ring.strokeCircle(0, 0, 40);
                this.tweens.add({ targets: ring, scale: 6 + r * 2, alpha: 0, duration: 700, ease: 'Quad.easeOut' });
                const sp = keep(this.add.particles(0, 0, 'mn_px2', { x: c.x, y: c.y, lifespan: 1100, speed: { min: 80, max: 260 + r * 60 }, gravityY: 160,
                    scale: { start: 2.2, end: 0 }, alpha: { start: 1, end: 0 }, tint: [R.col, 0xffffff], blendMode: 'ADD', emitting: false }).setDepth(D + 4));
                sp.explode(24 + r * 22);
                if (r >= 1) {
                    const nr = 8 + r * 4;
                    for (let k = 0; k < nr; k++) { const a = k / nr * Math.PI * 2; rays.fillStyle(R.col, 0.3); rays.fillTriangle(0, 0, Math.cos(a - 0.07) * 260 * sc, Math.sin(a - 0.07) * 260 * sc, Math.cos(a + 0.07) * 260 * sc, Math.sin(a + 0.07) * 260 * sc); }
                    this.tweens.add({ targets: rays, alpha: 1, duration: 250 });
                    this.tweens.add({ targets: rays, angle: 360, duration: 9000, repeat: -1 });
                }
                Sfx.play(this, 'e_land', { r });
                if (r === 5) this._banner('C O R R U P T E D', '#7aff5a');
                else if (r === 4) this._banner('M Y T H I C', '#ff4a5a');
                else if (r === 3) this._banner('L E G E N D A R Y', '#ffc23a');
                if (r >= 3) { this.cameras.main.flash(300, (R.col >> 16) & 255, (R.col >> 8) & 255, R.col & 255); this.cameras.main.shake(350, 0.008); }
                // the quality, filling in under it
                const bw = CWd * 1.1, by = c.y + CH / 2 + 14, gr = Enchants.grade(b.q);
                const bar = keep(this.add.graphics().setDepth(D + 1)), fill = { v: 0 };
                const qtx = keep(this.add.text(c.x, by + 16, '', { fontSize: `${Math.round(10 * sc + 4)}px`, fontFamily: 'monospace', fontStyle: 'bold', color: UIKit._hex(gr.col), stroke: '#000', strokeThickness: 3 }).setOrigin(0.5).setDepth(D + 1));
                this.tweens.add({ targets: fill, v: b.q, delay: 200, duration: 500 + b.q * 7, ease: 'Cubic.easeOut', onUpdate: (tw) => {
                    if (!qtx.active || !bar.active) { tw.stop(); return; }   // the reveal was closed under it
                    const col = Enchants.grade(fill.v).col;
                    bar.clear(); bar.fillStyle(0x000000, 0.75); bar.fillRect(c.x - bw / 2 - 2, by - 2, bw + 4, 9);
                    bar.fillStyle(col, 1); bar.fillRect(c.x - bw / 2, by, bw * fill.v / 100, 5);
                    qtx.setText(`${Enchants.grade(fill.v).name}  ${Math.round(fill.v)}%`).setColor(UIKit._hex(col));
                }, onComplete: () => { if (!qtx.active) return; if (b.q >= 85) { Sfx.play(this, 'e_quality'); this.tweens.add({ targets: qtx, scale: { from: 1.7, to: 1 }, duration: 320, ease: 'Back.easeOut' }); } onLand?.(); } });
                if (sc > 1) keep(this.add.text(c.x, by + 40, `${Enchants.lines(b).join('\n')}\n${d.b} build  ·  fits ${Enchants.fitsText(d.id)}`, { fontSize: '14px', fontFamily: 'monospace', color: UIKit.CSS.textMid, align: 'center', wordWrap: { width: 460 } }).setOrigin(0.5, 0).setDepth(D + 1));
            };
            step();
        };
        return { c, b, r, spin };
    }
    // The corrupted pull: the music cuts out, the screen tears into bands of static, the card
    // splits and shudders, then snaps back together on what it really is.
    _corruptBreak(keep, c, then) {
        const W = this.scale.width, H = this.scale.height;
        Music.duck(true); Sfx.play(this, 'collapse');
        this.time.delayedCall(1400, () => Music.duck(false));
        const bands = keep(this.add.graphics().setDepth(c.depth + 5));
        let k = 0;
        const glitch = this.time.addEvent({ delay: 60, repeat: 18, callback: () => {
            bands.clear(); k++;
            for (let i = 0; i < 9; i++) {
                bands.fillStyle([0x7aff5a, 0xff3aa0, 0x000000, 0xffffff][Math.floor(Math.random() * 4)], 0.18 + Math.random() * 0.35);
                bands.fillRect(Math.random() * W * 0.3, Math.random() * H, W * (0.3 + Math.random() * 0.7), 2 + Math.random() * 14);
            }
            c.x += (Math.random() - 0.5) * 18; c.angle = (Math.random() - 0.5) * 10;
            this.cameras.main.setScroll((Math.random() - 0.5) * 8, (Math.random() - 0.5) * 6);
        } });
        this.cameras.main.flash(120, 122, 255, 90);
        const x0 = c.x;
        this.time.delayedCall(1200, () => {
            glitch.remove(); bands.destroy(); c.x = x0; c.angle = 0; this.cameras.main.setScroll(0, 0);
            this.cameras.main.flash(400, 255, 58, 160);
            then();
        });
    }
    // A corrupted name: some of its letters keep turning into the wrong ones.
    _glitchName(text, real) {
        const G = '#%@&$!?*01░▒▓';
        const ev = this.time.addEvent({ delay: 110, loop: true, callback: () => {
            if (!text.active) { ev.remove(); return; }
            text.setText(real.split('').map(ch => ch !== ' ' && Math.random() < 0.18 ? G[Math.floor(Math.random() * G.length)] : ch).join(''));
            text.setColor(Math.random() < 0.15 ? '#ff3aa0' : '#7aff5a');
        } });
    }
    // A word across the screen, then gone (the mythic and corrupted pulls).
    _banner(s, col) {
        const W = this.scale.width, t = this.add.text(W / 2, 70, s, { fontSize: '40px', fontFamily: UIKit.FONT.title, fontStyle: 'bold', color: col, stroke: '#000', strokeThickness: 7 }).setOrigin(0.5).setDepth(120).setScale(0.6).setAlpha(0);
        this.tweens.add({ targets: t, scale: 1, alpha: 1, duration: 300, ease: 'Back.easeOut' });
        this.tweens.add({ targets: t, alpha: 0, delay: 2200, duration: 500, onComplete: () => t.destroy() });
    }

    _closeReveal() {
        for (const o of (this._enchFx || [])) { if (o?.active) { this.tweens.killTweensOf(o); o.destroy(); } }
        this._enchFx = null;
        this._ticks = (this._ticks || []).filter(f => f !== this._circTick);
    }

    // ── REFORGE ───────────────────────────────────────────────────────────────
    // Over the altar: the book in a ring of runes, its quality spinning through numbers and
    // slowing onto the roll; better than before, it bursts gold; worse, it greys and keeps the old.
    _reforgeFx(i) {
        if (this._busy) return;
        const before = Enchants.collection()[i], res = Enchants.reforge(i);
        if (!res) return;
        this._busy = true; this._book = null; this._panel();   // the book leaves the shelf for the crucible
        for (const o of (this._panelObjs || [])) o?.setVisible?.(false);   // and the satchel shuts, so it can't give the roll away
        const d = Enchants.def(before.id), R = Enchants.RARITY[d.r], D = 80, objs = [], keep = o => { objs.push(o); return o; };
        const k = this._roomK || 1, [ox, oy] = this._roomO || [0, 0], A = this._altarPt || { x: 390, y: 290 };
        const mx = A.x, mouth = oy + (470 - 40 * 3 + 7 * 3) * k;   // the crucible's surface, on screen
        this._spend('dust', Enchants.REFORGE[d.r], { x: mx, y: mouth });   // the dust it costs, into the crucible
        const G = [[98, 4], [85, 3], [60, 2], [25, 1], [0, 0]].find(([q]) => res.rolled >= q)[1];   // which threshold it landed on: 0 Flawed .. 4 Perfect
        const gr = Enchants.grade(res.rolled), FL = 0xb07aff;
        keep(this.add.rectangle(0, 0, this.scale.width, this.scale.height, 0x05030a, 0.45).setOrigin(0).setDepth(D - 1));
        keep(this.add.text(mx, 70, `REFORGING  ${d.name} ${Enchants.roman(before.lvl)}  ·  was ${before.q}%`, { fontSize: '16px', fontFamily: UIKit.FONT.title, fontStyle: 'bold', color: UIKit._hex(R.col), stroke: '#000', strokeThickness: 4 }).setOrigin(0.5).setDepth(D + 3));
        // the book, and a mask so what's under the surface is hidden: it really goes in
        const ik = ShopScene.bookIcon(this, d.r, d.b, d.id), book = keep(this.add.sprite(mx, A.y - 30, ik, '0').setScale(3).setDepth(D + 1)).play(ik);
        const mg = this.make.graphics({ add: false }); mg.fillRect(0, 0, this.scale.width, mouth);
        book.setMask(mg.createGeometryMask());
        const surf = keep(this.add.image(mx, mouth, 'mn_glow').setTint(FL).setBlendMode(Phaser.BlendModes.ADD).setDisplaySize(170 * k, 34 * k).setAlpha(0.5).setDepth(D + 2));
        const splash = (big) => {
            Sfx.play(this, 'e_dip', { big });
            // thick: heavy gobs that barely lift and fall back, a few bright flecks among them
            const sp = keep(this.add.particles(0, 0, 'mn_px2', { x: { min: mx - 26, max: mx + 26 }, y: mouth, lifespan: 1100, speedY: { min: -150, max: -60 }, speedX: { min: -50, max: 50 }, gravityY: 320,
                scale: { start: 4.5, end: 2 }, tint: [0x4a1a86, 0x6a2ac0, 0x8a4ae0], emitting: false }).setDepth(D + 2));
            sp.explode(big ? 22 : 12);
            const gl2 = keep(this.add.particles(0, 0, 'mn_px2', { x: { min: mx - 20, max: mx + 20 }, y: mouth, lifespan: 800, speedY: { min: -170, max: -80 }, speedX: { min: -40, max: 40 }, gravityY: 300,
                scale: { start: 1.6, end: 0 }, tint: [0xffe8ff, 0xd8a8ff], blendMode: 'ADD', emitting: false }).setDepth(D + 2));
            gl2.explode(big ? 14 : 8);
            this.tweens.add({ targets: surf, alpha: { from: 1, to: 0.5 }, displayWidth: { from: 230 * k, to: 170 * k }, duration: 400 });
        };
        // 1. three dips, each deeper and longer; the book takes on the fluid's glow
        const dips = [[40, 260], [70, 320], [110, 380]];
        let step = 0;
        const dip = () => {
            if (step < 3) {
                const [deep, ms] = dips[step];
                this.tweens.add({ targets: book, y: mouth + deep * 0.5, angle: step % 2 ? 8 : -8, duration: ms, ease: 'Quad.easeIn', onComplete: () => {
                    splash(step === 2);
                    book.setTint(Phaser.Display.Color.GetColor(255 - step * 30, 255 - step * 50, 255));
                    if (step === 2) { step++; this.time.delayedCall(250, roll); return; }   // the last dip: it stays under
                    this.tweens.add({ targets: book, y: A.y - 30, angle: 0, duration: ms, ease: 'Quad.easeOut', delay: 120, onComplete: () => { step++; dip(); } });
                } });
                return;
            }
        };
        // 2. under the surface the fire roars, and the number rolls big over it
        const ny = Math.max(150, A.y - 150);
        const roll = () => {
            const fire = keep(this.add.particles(0, 0, 'mn_px2', { x: { min: mx - 60 * k, max: mx + 60 * k }, y: mouth, lifespan: 700, speedY: { min: -160, max: -60 },
                scale: { start: 3, end: 0 }, tint: [FL, 0xe0ccff, 0xffffff], blendMode: 'ADD', frequency: 10 }).setDepth(D + 2));
            let cur = null, n = 0;
            const N = 22 + G * 4;   // the better it lands, the longer it teases
            const show = (v, last) => {
                const g2 = Enchants.grade(v);
                cur?.destroy();
                cur = keep(this.add.text(mx, ny, `${v}%`, { fontSize: last ? '78px' : '62px', fontFamily: UIKit.FONT.title, fontStyle: 'bold', color: UIKit._hex(g2.col), stroke: '#000', strokeThickness: 8 }).setOrigin(0.5).setDepth(D + 4));
                if (!last) this.tweens.add({ targets: cur, scale: { from: 1.15, to: 1 }, duration: 60 });
            };
            const tick = () => {
                if (n < N) {
                    const t = n / N, v = t > 0.8 && G >= 3 ? 70 + Math.floor(Math.random() * 30) : Math.floor(Math.random() * 101);   // near the end of a big one it hovers high
                    show(v, false); Sfx.play(this, 'e_tick', { p: t }); n++;
                    this.time.delayedCall(40 + 340 * Math.pow(t, 3), tick); return;
                }
                fire.stop();
                show(res.rolled, true);
                land(cur);
            };
            tick();
        };
        // 3. where it lands: the bigger the threshold, the bigger the moment
        const land = (num) => {
            Sfx.play(this, 'e_qland', { g: G });
            const cam = this.cameras.main;
            this.tweens.add({ targets: num, scale: { from: 1.9 + G * 0.15, to: 1 }, duration: 380, ease: 'Back.easeOut' });
            keep(this.add.text(mx, ny + 56, res.rolled >= 98 ? 'PERFECT!' : gr.name, { fontSize: `${18 + G * 4}px`, fontFamily: UIKit.FONT.title, fontStyle: 'bold', color: UIKit._hex(gr.col), stroke: '#000', strokeThickness: 5 }).setOrigin(0.5).setDepth(D + 4));
            if (G >= 2) {
                const burst = keep(this.add.particles(0, 0, 'mn_px2', { x: mx, y: ny, lifespan: 1000, speed: { min: 80, max: 200 + G * 80 }, gravityY: 120, scale: { start: 2.4, end: 0 },
                    tint: [gr.col, 0xffffff], blendMode: 'ADD', emitting: false }).setDepth(D + 3)); burst.explode(20 + G * 25);
            }
            if (G >= 3) { cam.flash(260, (gr.col >> 16) & 255, (gr.col >> 8) & 255, gr.col & 255); cam.shake(320, 0.006 + G * 0.002); }
            if (G === 4) {   // Perfect: rays wheel out behind the number and everything slows for a breath
                const rays = keep(this.add.graphics().setDepth(D + 2).setPosition(mx, ny).setBlendMode(Phaser.BlendModes.ADD));
                for (let r = 0; r < 16; r++) { const a = r / 16 * Math.PI * 2; rays.fillStyle(r % 2 ? 0xffffff : gr.col, 0.3); rays.fillTriangle(0, 0, Math.cos(a - 0.06) * 420, Math.sin(a - 0.06) * 420, Math.cos(a + 0.06) * 420, Math.sin(a + 0.06) * 420); }
                this.tweens.add({ targets: rays, angle: 90, alpha: { from: 1, to: 0 }, duration: 2400 });
                this.tweens.timeScale = 0.5; this.time.delayedCall(500, () => { this.tweens.timeScale = 1; });
            }
            const hold = [500, 600, 800, 1000, 1300][G];
            this.time.delayedCall(hold, () => rise(num));
        };
        // 4. the book rises out, dripping glimmering fluid; 5. the number spins down into it and is absorbed
        const rise = (num) => {
            book.clearMask(); mg.destroy();
            Sfx.play(this, 'e_dip', { big: false });
            // it comes out coated: a skin of goo over it that slowly slides off, and thick strands that
            // stretch down from it, bulb, and let go, slowly
            const coat = keep(this.add.sprite(book.x, book.y, book.texture.key, book.frame.name).setScale(book.scaleX).setDepth(D + 1.5).setTintFill(0x4a1a86).setAlpha(0.85));
            const coatMask = this.make.graphics({ add: false }), cm = { top: 0 };
            coat.setMask(coatMask.createGeometryMask());
            this.tweens.add({ targets: cm, top: 1, duration: 3200, ease: 'Sine.easeIn' });
            const strands = keep(this.add.graphics().setDepth(D + 1.4)), PX = 3, ST = [];
            let nextS = 0;
            const drip = { stop: () => { drip.stopped = true; } };
            const goo = t => {
                if (!strands.active) return;
                coat.setPosition(book.x, book.y).setAngle(book.angle);
                coatMask.clear(); coatMask.fillStyle(0xffffff); const hb = book.displayHeight; coatMask.fillRect(book.x - 60, book.y - hb / 2 + hb * cm.top, 120, hb);
                if (!drip.stopped && t > nextS) { nextS = t + 260 + Math.random() * 380; ST.push({ x: book.x + (Math.random() - 0.5) * book.displayWidth * 0.7, t0: t, life: 1800 + Math.random() * 1400, fall: 0 }); }
                strands.clear();
                const by2 = book.y + book.displayHeight / 2 - 4;
                for (let i = ST.length - 1; i >= 0; i--) {
                    const S2 = ST[i], u = (t - S2.t0) / S2.life;
                    if (u < 1) {   // stretching, thinning, a bulb gathering at its end
                        const len = Math.round(Math.pow(u, 1.5) * 26 / PX) * PX, w = u < 0.5 ? PX * 2 : PX;
                        strands.fillStyle(0x521e92, 1); strands.fillRect(Math.round(S2.x / PX) * PX, by2, w, len);
                        strands.fillStyle(0x6e30b8, 1); strands.fillRect(Math.round(S2.x / PX) * PX - PX, by2 + len, PX * 3, PX * 2);
                        strands.fillStyle(0xe8d8ff, 1); strands.fillRect(Math.round(S2.x / PX) * PX, by2 + len, PX, PX);
                    } else {       // let go: the gob falls slowly and is gone
                        S2.fall = (S2.fall || 0) + 1.2 + (u - 1) * 4;
                        const y = by2 + 26 + S2.fall;
                        strands.fillStyle(0x6e30b8, Math.max(0, 1.6 - u)); strands.fillRect(Math.round(S2.x / PX) * PX - PX, y, PX * 3, PX * 2);
                        if (u > 1.6) ST.splice(i, 1);
                    }
                }
            };
            this._ticks.push(goo);
            this.time.delayedCall(7000, () => { this._ticks = this._ticks.filter(f => f !== goo); coatMask.destroy(); });
            keep(this.add.particles(0, 0, 'mn_px2', { follow: book, followOffset: { y: 10 }, x: { min: -22, max: 22 }, y: { min: -20, max: 20 }, lifespan: 900, speed: 0,
                scale: { start: 1.2, end: 0 }, tint: [0xffe8a0, 0xffffff, 0xd8a8ff], blendMode: 'ADD', frequency: 140 }).setDepth(D + 2));   // glimmers in the goo
            this.tweens.add({ targets: book, y: A.y - 40, angle: 0, duration: 1800, ease: 'Sine.easeOut', onComplete: () => {
                this.time.delayedCall(2600, () => drip.stop());
                Sfx.play(this, 'e_absorb');
                this.tweens.add({ targets: num, x: book.x, y: book.y, angle: 720, scale: 0.15, duration: 700, ease: 'Cubic.easeIn', onComplete: () => {
                    num.destroy();
                    book.clearTint();
                    const ring = keep(this.add.graphics().setDepth(D + 2).setPosition(book.x, book.y)); ring.lineStyle(5, gr.col, 1); ring.strokeCircle(0, 0, 24);
                    this.tweens.add({ targets: ring, scale: 4 + G, alpha: 0, duration: 600 });
                    const gl = keep(this.add.image(book.x, book.y, 'mn_glow').setTint(gr.col).setBlendMode(Phaser.BlendModes.ADD).setDisplaySize(40, 40));
                    this.tweens.add({ targets: gl, displayWidth: 200 + G * 60, displayHeight: 200 + G * 60, alpha: 0, duration: 700 });
                    this.tweens.add({ targets: book, scale: { from: 3.8, to: 3 }, duration: 300, ease: 'Back.easeOut' });
                    const delta = res.rolled - before.q;
                    keep(this.add.text(book.x, book.y + 60, `${before.q}% → ${res.rolled}%  (${delta > 0 ? '+' : ''}${delta})`, { fontSize: '18px', fontFamily: UIKit.FONT.title, fontStyle: 'bold', color: delta > 0 ? '#9aff8a' : delta < 0 ? '#ff7a6a' : '#d8d8d8', stroke: '#000', strokeThickness: 4 }).setOrigin(0.5).setDepth(D + 4));
                    this._say(delta > 0 ? `Up ${delta}: ${d.name} is ${res.rolled}% now.` : delta < 0 ? `Down ${-delta}. That's the gamble.` : 'Not a hair of difference.');
                    this.time.delayedCall(1500, () => { objs.forEach(o => { if (o?.active) { this.tweens.killTweensOf(o); o.destroy(); } }); this._busy = false; this._book = i; this._refreshAll?.(); });
                } });
            } });
        };
        dip();
    }

    // ── BIND ──────────────────────────────────────────────────────────────────
    // The book lifts off the shelf, arcs into the weapon trailing light, and bursts there in its
    // rarity's colour; the weapon's aura grows (it's drawn from how many enchants it holds).
    _bindFx(i, w, cost) {
        if (this._busy) return;
        const b = Enchants.collection()[i], from = this._bookCards[i], to = this._weaponCards[w.id];
        if (!b || !from || !to) return;
        this._busy = true;
        const d = Enchants.def(b.id), R = Enchants.RARITY[d.r], D = 70;
        const ik = ShopScene.bookIcon(this, d.r, d.b, d.id), book = this.add.sprite(from.x, from.y, ik, '0').setScale(1.4).setDepth(D).play(ik);
        const trail = this.add.particles(0, 0, 'mn_px2', { follow: book, lifespan: 500, speed: { min: 5, max: 30 }, scale: { start: 1.8, end: 0 }, alpha: { start: 1, end: 0 },
            tint: [R.col, 0xffffff], blendMode: 'ADD', frequency: 12 }).setDepth(D - 1);
        Sfx.play(this, 'e_bind'); this._spend('glorp', cost, to);
        const p = { t: 0 }, mx = (from.x + to.x) / 2 - 60, my = Math.min(from.y, to.y) - 120;
        this.tweens.add({ targets: book, scale: 2.4, duration: 250, yoyo: true, hold: 200 });
        this.tweens.add({ targets: p, t: 1, duration: 750, ease: 'Cubic.easeIn', onUpdate: () => {
            const t = p.t, u = 1 - t;
            book.setPosition(u * u * from.x + 2 * u * t * mx + t * t * to.x, u * u * from.y + 2 * u * t * my + t * t * to.y);
            book.angle = t * 540;
        }, onComplete: () => {
            book.destroy(); trail.stop(); this.time.delayedCall(600, () => trail.destroy());
            Enchants.put(w.id, i); this.glorps -= cost; localStorage.setItem('glorps', this.glorps); this._book = null;
            const ring = this.add.graphics().setDepth(D).setPosition(to.x, to.y);
            ring.lineStyle(5, R.col, 1); ring.strokeCircle(0, 0, 20);
            this.tweens.add({ targets: ring, scale: 4, alpha: 0, duration: 600, ease: 'Quad.easeOut', onComplete: () => ring.destroy() });
            const burst = this.add.particles(0, 0, 'mn_px2', { x: to.x, y: to.y, lifespan: 800, speed: { min: 60, max: 200 }, scale: { start: 2, end: 0 }, alpha: { start: 1, end: 0 },
                tint: [R.col, 0xffffff, 0xffe08a], blendMode: 'ADD', emitting: false }).setDepth(D);
            burst.explode(50); this.time.delayedCall(1000, () => burst.destroy());
            this.cameras.main.flash(200, (R.col >> 16) & 255, (R.col >> 8) & 255, R.col & 255);
            // (e_bind's lock lands with it)
            this._say(`${d.name} ${Enchants.roman(b.lvl)}, bound into the ${w.name}.`);
            this._busy = false; this._refreshAll?.();
        } });
    }

    // Unbinding: the camera closes on the weapon and two forces take hold of it from either side, a
    // tether of the book's light pulling left and one of dust pulling right. It shakes harder and
    // harder until the enchant comes free: the sealed book yanked out to the left, the essence as
    // dust to the right. Both fly to your purse, and the weapon settles again without it.
    _unbindFx(w, i) {
        const b = Enchants.on(w.id)[i];
        if (!b || this._busy) return;
        const cost = Enchants.unbindCost(b);
        this._busy = true;
        const d = Enchants.def(b.id), col = Enchants.RARITY[d.r].col, A = this._altarPt, D = 85, cam = this.cameras.main, objs = [], keep = o => { objs.push(o); return o; };
        const hid = (this._panelObjs || []).filter(o => o?.texture?.key === MenuArt.iconSheet(this, w.id) && Math.abs(o.x - A.x) < 4);
        hid.forEach(o => o.setVisible(false));
        const ik = MenuArt.iconSheet(this, w.id), sc = 3.4;
        const Wp = keep(this.add.sprite(A.x, A.y, ik, '0').setScale(sc).setDepth(D));
        const pull = keep(this.add.graphics().setDepth(D - 1).setBlendMode(Phaser.BlendModes.ADD));
        Sfx.play(this, 'e_riser', { r: 3 }); Sfx.play(this, 'e_chain'); this._spend('glorp', cost, A);
        cam.pan(A.x, A.y, 600, 'Cubic.easeInOut'); cam.zoomTo(2.2, 600, 'Cubic.easeInOut');
        // 1. the two forces take hold and it shakes, harder and harder
        const st = { v: 0 }, reach = 150;
        this.tweens.add({ targets: st, v: 1, duration: 1800, ease: 'Quad.easeIn', onUpdate: () => {
            const v = st.v, j = 1 + v * 9;
            Wp.x = A.x + (Math.random() - 0.5) * j; Wp.y = A.y + (Math.random() - 0.5) * j * 0.6; Wp.angle = (Math.random() - 0.5) * v * 14;
            pull.clear();
            for (const [dir, c] of [[-1, col], [1, 0xb88aff]]) for (let k = 0; k < 3; k++) {   // the tethers, wavering, thickening as they pull
                pull.lineStyle(1 + v * 4 - k, k ? 0xffffff : c, (0.25 + v * 0.6) * (k ? 0.5 : 1));
                pull.beginPath(); pull.moveTo(Wp.x, Wp.y);
                for (let s2 = 1; s2 <= 8; s2++) pull.lineTo(Wp.x + dir * reach * s2 / 8, Wp.y + Math.sin(s2 + this.time.now * 0.02 + k) * (2 + v * 6));
                pull.strokePath();
            }
        }, onComplete: () => {
            // 2. it comes free
            Sfx.play(this, 'e_snap'); cam.flash(220, (col >> 16) & 255, (col >> 8) & 255, col & 255); cam.shake(260, 0.012);
            pull.clear(); Wp.setPosition(A.x, A.y).setAngle(0);
            this.tweens.add({ targets: Wp, scale: { from: sc * 1.12, to: sc }, duration: 400, ease: 'Back.easeOut' });   // and settles
            const burst = keep(this.add.particles(0, 0, 'mn_px2', { x: A.x, y: A.y, lifespan: 900, speed: { min: 60, max: 240 }, scale: { start: 2.2, end: 0 }, tint: [col, 0xffffff, 0xd8a8ff], blendMode: 'ADD', emitting: false }).setDepth(D + 2));
            burst.explode(60);
            // 3. what it held: the sealed book yanked out left, the essence as dust right
            const book = keep(this.add.image(A.x, A.y, ShopScene.bookIcon(this, -1), '0').setScale(0.5).setDepth(D + 2));
            const Rt = { x: A.x + 90, y: A.y };
            this.tweens.add({ targets: book, x: A.x - 90, scale: 2.4, angle: -20, duration: 380, ease: 'Cubic.easeOut' });
            const cloud = keep(this.add.particles(0, 0, 'mn_px2', { x: { min: Rt.x - 16, max: Rt.x + 16 }, y: { min: Rt.y - 16, max: Rt.y + 16 }, lifespan: 1200, speed: { min: 2, max: 12 },
                scale: { start: 2.4, end: 0.6 }, tint: [0xc8b8ff, 0x9a6aff, 0xffffff], blendMode: 'ADD', frequency: 14 }).setDepth(D + 2));
            const streak = keep(this.add.particles(0, 0, 'mn_px2', { x: A.x, y: A.y, lifespan: 400, speedX: { min: 200, max: 320 }, speedY: { min: -30, max: 30 }, scale: { start: 2, end: 0 }, tint: [0xc8b8ff, 0xffffff], blendMode: 'ADD', emitting: false }).setDepth(D + 2));
            streak.explode(30);
            Sfx.play(this, 'e_burst');
            {
                // 4. the camera steps back; both fly to the purse
                this.time.delayedCall(700, () => {
                    const res = Enchants.unbind(w.id, i);
                    this.glorps -= cost; localStorage.setItem('glorps', this.glorps);
                    cam.zoomTo(1, 500, 'Cubic.easeInOut'); cam.pan(this.scale.width / 2, this.scale.height / 2, 500, 'Cubic.easeInOut');
                    this.time.delayedCall(520, () => {
                        cam.resetFX(); cam.setZoom(1); cam.setScroll(0, 0);
                        cloud.stop(); book.setVisible(false); hid.forEach(o => o.active && o.setVisible(true));
                        this._gain('book', 1, { x: book.x, y: book.y }); this._gain('dust', res.dust, { x: Rt.x, y: Rt.y });
                        this.time.delayedCall(700, () => {
                            Sfx.play(this, 'pickup');
                            this._say(`${d.name} pulled out of the ${w.name}: +1 sealed book, +✧${res.dust}.`);
                            objs.forEach(o => { if (o?.active) { this.tweens.killTweensOf(o); o.destroy(); } });
                            this._busy = false; this._refreshAll?.();
                        });
                    });
                });
            }
        } });
    }

    // ── CURRENCY THAT MOVES ───────────────────────────────────────────────────
    // Whatever you gain flies into your purse, and whatever you spend flies out of it to where it
    // went: sealed books as little books, dust as motes, glorps as gold stars.
    _counterPt(kind) {
        const W = this.scale.width, H = this.scale.height;
        if (this._mode) return { x: W - 80, y: 34 };   // the satchel's purse (or the crucible's)
        return kind === 'book' ? { x: W / 2 - 266, y: H - 112 } : { x: W / 2 - 214, y: H - 96 };   // the altar's plate
    }
    _fly(kind, n, from, to, onLand) {
        const count = kind === 'dust' ? Math.min(16, 4 + Math.ceil(n / 10)) : kind === 'glorp' ? Math.min(10, 3 + Math.ceil(n / 300)) : Math.min(5, Math.max(1, n));
        const D = 95;
        for (let k = 0; k < count; k++) {
            const o = kind === 'book' ? this.add.image(from.x, from.y, ShopScene.bookIcon(this, -1), '0').setScale(1.4)
                : kind === 'glorp' ? this.add.text(from.x, from.y, '✦', { fontSize: '18px', color: '#ffd34a', stroke: '#5a3a0a', strokeThickness: 3 }).setOrigin(0.5)
                : this.add.image(from.x, from.y, 'mn_px2').setTint(k % 2 ? 0xc8b8ff : 0xffffff).setBlendMode(Phaser.BlendModes.ADD).setScale(3);
            o.setDepth(D);
            const sx = from.x + (Math.random() - 0.5) * 30, sy = from.y + (Math.random() - 0.5) * 20, mx = (sx + to.x) / 2 + (Math.random() - 0.5) * 80, my = Math.min(sy, to.y) - 60 - Math.random() * 60, p = { t: 0 };
            this.tweens.add({ targets: p, t: 1, delay: k * 45, duration: 620 + Math.random() * 160, ease: 'Cubic.easeIn', onUpdate: () => {
                const t = p.t, u = 1 - t; o.setPosition(u * u * sx + 2 * u * t * mx + t * t * to.x, u * u * sy + 2 * u * t * my + t * t * to.y);
                if (kind === 'book') o.setAngle(t * 360);
            }, onComplete: () => {
                o.destroy();
                if (k === count - 1) {
                    const ring = this.add.circle(to.x, to.y, 6).setStrokeStyle(2, kind === 'glorp' ? 0xffd34a : 0xc8b8ff, 1).setDepth(D);
                    this.tweens.add({ targets: ring, scale: 3, alpha: 0, duration: 300, onComplete: () => ring.destroy() });
                    Sfx.play(this, kind === 'glorp' ? 'pickup' : 'hover');
                    onLand?.();
                }
            } });
        }
    }
    _gain(kind, n, from) { if (n > 0) this._fly(kind, n, from, this._counterPt(kind)); }
    _spend(kind, n, to) { if (n > 0) this._fly(kind, n, this._counterPt(kind), to); }

    _say(s) {
        this._sayTxt?.destroy();
        const AW = this._mode ? this.scale.width - 490 : this.scale.width, t = this._sayTxt = this.add.text(AW / 2, 74, s, { fontSize: '13px', fontFamily: 'monospace', color: '#f4e8cc', backgroundColor: '#0a0618', padding: { x: 10, y: 6 }, align: 'center', wordWrap: { width: 600 } })
            .setOrigin(0.5).setDepth(40);
        this.tweens.add({ targets: t, alpha: 0, delay: 2600, duration: 500, onComplete: () => t.destroy() });
    }

    // ── THE STATIONS ──────────────────────────────────────────────────────────
    // The main room is the altar (unsealing). Down the left, the four stations; each opens its
    // own drawer from the right with only what that job needs.
    static STATIONS = [
        { id: 'bind',    name: 'BIND',    sub: 'books into weapons',   col: 0x6ad86a },
        { id: 'reforge', name: 'REFORGE', sub: 'reroll a quality',     col: 0x9a6aff },
        { id: 'combine', name: 'COMBINE', sub: 'copies into a level up', col: 0xf0b84a },
        { id: 'reseal',  name: 'RESEAL',  sub: 'seal it again, or dust', col: 0x7ad8ff },
        { id: 'garden',  name: 'GARDEN',  sub: 'dust grows here',       col: 0x8affd8 },
    ];
    // Each station's room: where on the island the camera dives in (from the island's middle), and its look.
    static ROOMS = {
        bind:    { name: 'THE BINDING RING', col: 0x6ad86a, pt: [-165, 22], say: 'Pick a weapon and a book. The ring binds it in.' },
        reforge: { name: 'THE CRUCIBLE',     col: 0x9a6aff, pt: [165, 22],  say: 'Drop a book in the fire. Its quality comes out new, better or worse.' },
        combine: { name: 'THE TWIN POOLS',   col: 0xf0b84a, pt: [-80, 54],   say: 'Two or more copies of one book. More quality, better odds. A miss costs a copy.' },
        reseal:  { name: 'THE CHAIN SHRINE', col: 0x7ad8ff, pt: [80, 54],    say: 'Seal a book again for a fresh pull, or grind it to dust.' },
        garden:  { name: 'THE DUST GARDEN',  col: 0x8affd8, pt: [-235, -10], say: '' },   // walked, not a room: GardenScene
    };
    _stations() {
        for (const o of (this._stationObjs || [])) { if (o?.active) this.tweens.killTweensOf(o); o?.destroy?.(); }
        const objs = this._stationObjs = [], keep = o => { objs.push(o); return o; }, D = 21, x = 26, w = 214, h = 60;
        // a random book on each, new every time you come back out
        this._stationBooks ||= EnchantScene.STATIONS.map(() => Enchants.LIST.filter(d => d.r < 5)[Math.floor(Math.random() * Enchants.LIST.filter(d => d.r < 5).length)]);
        EnchantScene.STATIONS.forEach((st, k) => {
            const y = 120 + k * (h + 12), bk = this._stationBooks[k];
            const g = keep(this.add.graphics().setDepth(D));
            g.fillStyle(0x000000, 0.4); g.fillRoundedRect(x + 4, y + 5, w, h, 10);
            g.fillStyle(0x0e0a1c, 0.94); g.fillRoundedRect(x, y, w, h, 10);
            g.lineStyle(2, st.col, 0.6); g.strokeRoundedRect(x, y, w, h, 10);
            g.fillStyle(st.col, 0.7); g.fillRoundedRect(x, y, 6, h, { tl: 10, bl: 10, tr: 0, br: 0 });
            const ik = st.id === 'garden' ? this._cropTex(4) : ShopScene.bookIcon(this, bk.r, bk.b, bk.id);
            const ic = keep(this.add.sprite(x + 34, y + h / 2, ik, '0').setScale(st.id === 'garden' ? 1.3 : 1.5).setDepth(D + 1));
            keep(this.add.text(x + 62, y + 14, st.name, { fontSize: '18px', fontFamily: UIKit.FONT.title, fontStyle: 'bold', color: UIKit._hex(st.col) }).setDepth(D + 1));
            keep(this.add.text(x + 62, y + 38, st.sub, { fontSize: '10px', fontFamily: 'monospace', color: UIKit.CSS.textMid }).setDepth(D + 1));
            const z = keep(this.add.zone(x, y, w, h).setOrigin(0).setInteractive({ useHandCursor: true }).setDepth(D + 2));
            z.on('pointerover', () => { ic.play(ik); g.lineStyle(2, st.col, 1); g.strokeRoundedRect(x, y, w, h, 10); });
            z.on('pointerout', () => { ic.stop().setFrame('0'); });
            z.on('pointerdown', () => { if (!this._busy && !this._enchFx) this._enterRoom(st.id); });
        });
    }
    // The five places on the island itself: a light over each that swells when you point at it,
    // its name, and a click dives in.
    // ── THE ISLAND'S PLACES ───────────────────────────────────────────────────
    // A tiny diorama of each place, painted on the island's own 3x pixel grid and palette, standing
    // round the dais. Point at the island and it offers a closer look; up close it turns slowly, the
    // places circling round it, and a click on one dives in.
    static MINI_AT = { reforge: 0, reseal: 72, garden: 144, bind: 216, combine: 288 };   // where each stands on the island: evenly round the dais, in the gaps between the crystal pillars (degrees; 90 is the front)
    _miniTex(id) {
        return ShopScene.icon(this, 'isle_mini_' + id, 20, { s: '#5e5c7c', S: '#8a88a8', d: '#3a3854', f: '#4c4668', F: '#2a2440', g: '#ffffff', G: '#6ad86a', v: '#9a6aff', V: '#e0ccff',
            w: '#2a4a8a', W: '#8ac0f0', y: '#ffd060', b: '#5a4030', c: '#e8e0c8', o: '#ff8a3a', m: '#8affd8', M: '#d8fff0', n: '#3a2414', t: '#9a9ab8', q: '#3a6230', Q: '#5a9a4a', x: '#14121e', e: '#5a7a6a', E: '#8aa898' }, (m, f) => {
            const floor = (rx, ry) => { for (let y = -ry; y <= ry; y++) for (let x = -rx; x <= rx; x++) if ((x / rx) ** 2 + (y / ry) ** 2 <= 1) m.set(10 + x, 17 + y, (x + y) % 3 ? 'f' : 'F'); };
            if (id === 'bind') {
                floor(8, 2.5);
                for (const [sx, top] of [[3, 9], [16, 10]]) { m.rect(sx, top, 2, 16 - top, 's'); m.set(sx + 1, top + 1, 'S'); m.set(sx, top, 'Q'); m.set(sx + 1, 14, 'q'); m.set(sx, 11 + (f % 2) * 2, 'G'); m.set(sx + 1, top + 3, 'x'); }   // old standing stones: mossed, cracked, a rune lit on each
                m.rect(7, 12, 6, 5, 's'); m.rect(7, 12, 6, 1, 'S'); m.rect(6, 11, 8, 1, 'S'); m.set(6, 11, 'Q'); m.set(7, 11, 'q'); m.set(12, 15, 'q'); m.set(9, 13, 'x'); m.set(10, 14, 'G'); m.set(9, 15, 'G');   // the plinth, its capstone mossed
                m.set(14, 16, 'S'); m.set(5, 16, 'd');   // rubble
                if (f % 2 === 0) m.set(10, 9, 'g'); else m.set(10, 8, 'G');
            } else if (id === 'reforge') {
                floor(8, 2.5);
                m.line(6, 16, 7, 13, 'd'); m.line(14, 16, 13, 13, 'd'); m.set(10, 16, 'd');   // legs
                m.rect(6, 11, 9, 3, 'e'); m.rect(7, 14, 7, 1, 'q'); m.rect(5, 10, 11, 1, 'E'); m.set(13, 11, 'E'); m.set(8, 12, 'x');   // the bowl, old bronze gone green, and its rim
                m.set(3, 16, 'S'); m.set(16, 16, 'd');
                m.rect(7, 9, 7, 1, 'V'); const fl = [[8, 8], [10, 7], [12, 8], [9, 6], [11, 6]];
                fl.forEach(([x, y], k) => (k + f) % 3 && m.set(x, y - (f % 2), k % 2 ? 'v' : 'V'));   // its violet fire, flickering
                m.set(2, 15, 'V'); m.set(2, 14, 'v'); m.set(18, 15, 'V'); m.set(18, 13, 'v'); m.set(18, 14, 'v');   // crystals by it
            } else if (id === 'combine') {
                for (const px of [4, 16]) for (let y = -1; y <= 1; y++) for (let x = -3; x <= 3; x++) if ((x / 3.4) ** 2 + (y / 1.6) ** 2 <= 1) m.set(px + x, 16 + y, y < 0 || Math.abs(x) > 2 ? 'S' : (x + f) % 4 === 0 ? 'W' : 'w');   // the twin pools
                m.rect(9, 11, 3, 6, 's'); m.set(11, 12, 'S'); m.set(9, 15, 'q'); m.set(10, 13, 'x'); m.rect(8, 10, 5, 1, 'y'); m.set(8, 10, 'b'); m.set(10, 9, f % 2 ? 'y' : 'g');   // the pedestal, worn, gold on top
                m.rect(1, 9, 2, 5, 's'); m.set(1, 9, 'Q'); m.set(2, 10, 'x'); m.set(19, 13, 'S'); m.set(18, 14, 'd');   // a broken column, rubble
                m.line(7, 16, 8, 16, 'y'); m.line(12, 16, 13, 16, 'y');
            } else if (id === 'reseal') {
                floor(8, 2.5);
                m.rect(3, 6, 2, 11, 's'); m.rect(15, 8, 2, 9, 's'); m.rect(2, 5, 11, 2, 'S'); m.rect(13, 7, 5, 1, 'S');   // the arch, its lintel broken on one side
                m.set(2, 5, 'Q'); m.set(5, 5, 'Q'); m.set(9, 4, 'Q'); m.set(3, 9, 'q'); m.set(4, 12, 'q'); m.set(16, 10, 'q'); m.set(4, 8, 'x'); m.set(15, 12, 'x'); m.set(12, 16, 'S'); m.set(17, 16, 'd');   // moss, cracks, rubble
                for (let y = 7; y < 11; y++) { m.set(7, y, 't'); m.set(13, y, 't'); }   // chains hanging from it
                m.rect(9, 14, 2, 3, 'd'); m.rect(8, 12, 4, 2, 'b');   // the lectern
                for (const x of [6, 14]) { m.set(x, 16, 'c'); m.set(x, 15, f % 2 ? 'y' : 'o'); }   // candles
            } else {   // garden
                for (let y = -2; y <= 2; y++) for (let x = -8; x <= 8; x++) if ((x / 8.5) ** 2 + (y / 2.6) ** 2 <= 1) m.set(10 + x, 16 + y, Math.abs(y) === 2 || Math.abs(x) >= 8 ? 'f' : 'n');
                for (const [x, h] of [[5, 4], [10, 5], [15, 4]]) { m.line(x, 16, x, 16 - h, 'm'); m.set(x - 1, 15 - h + 2, 'M'); m.set(x + 1, 16 - h + 2, 'm'); if ((x + f) % 2) m.set(x, 15 - h, 'g'); }
            }
        }, 4);
    }
    _minis() {
        const W = this.scale.width, land = this._land, B = this._bb, { ix, iy, S, cx, top, rx, ry } = this._isleGeo;
        land.bringToTop(B);
        this._miniObjs = {};
        for (const st of EnchantScene.STATIONS) {
            const mc = this.add.container(0, 0), ik = this._miniTex(st.id);
            const glow = this.add.image(0, -10, 'mn_glow').setTint(st.col).setBlendMode(Phaser.BlendModes.ADD).setDisplaySize(64, 34).setAlpha(0.3);
            const ring = this.add.graphics().setBlendMode(Phaser.BlendModes.ADD);
            const spr = this.add.sprite(0, 3, ik, '0').setOrigin(0.5, 1).setScale(3).play(ik);
            const lab = this.add.text(0, -66, st.name, { fontSize: '13px', fontFamily: UIKit.FONT.title, fontStyle: 'bold', color: UIKit._hex(st.col), stroke: '#0a0618', strokeThickness: 4 }).setOrigin(0.5).setAlpha(0);
            const z = this.add.zone(0, -24, 66, 60).setInteractive({ useHandCursor: true });
            mc.add([glow, ring, spr, lab, z]);
            B.add(mc);
            const a = EnchantScene.MINI_AT[st.id] * Math.PI / 180;   // its fixed place on the island
            const M = this._miniObjs[st.id] = { mc, ring, lab, glow, hot: false, gx: cx + Math.cos(a) * rx * 0.8, gy: top + Math.sin(a) * ry * 0.8 };
            z.on('pointerover', () => { M.hot = true; if (this._cz.t >= 1) this.tweens.add({ targets: lab, alpha: 1, duration: 140 }); });
            z.on('pointerout', () => { M.hot = false; if (this._cz.t >= 1) lab.setAlpha(0.75); });
            z.on('pointerdown', (p) => {
                if (this._busy || this._enchFx || this._mode || this._roomBusy) return;
                if (this._cz.t < 1) { this._closeUp(true); return; }   // from afar, a click on the island looks closer first
                this._dragStart(p, st.id);
            });
            z.on('pointerup', () => { const d = this._drag; if (d?.id === st.id && !d.moved && !this._mode) this._enterRoom(st.id); });
        }
        // a click (or a hover) anywhere on the island's top offers the closer look
        const iz = this._islandZone = this.add.zone(W / 2, 270, 560, 150).setInteractive({ useHandCursor: true });
        land.addAt(iz, land.list.indexOf(B));
        const hint = this._closeHint = this.add.text(W / 2, 372, 'click the island to look closer', { fontSize: '13px', fontFamily: 'monospace', fontStyle: 'bold', color: '#e0ccff', backgroundColor: '#0a0618', padding: { x: 8, y: 4 } }).setOrigin(0.5).setDepth(22).setAlpha(0);
        iz.on('pointerover', () => { if (this._cz.t === 0 && !this._mode) this.tweens.add({ targets: hint, alpha: 1, duration: 160 }); });
        iz.on('pointerout', () => this.tweens.add({ targets: hint, alpha: 0, duration: 160 }));
        iz.on('pointerdown', (p) => { if (!this._busy && !this._enchFx && !this._mode && this._cz.t === 0) this._closeUp(true); else if (this._cz.t >= 1) this._dragStart(p); });
        // up close, you turn the island by dragging it (left and right); a click without a drag still picks a place
        this.input.on('pointermove', (p) => {
            const d = this._drag;
            if (!d || !p.isDown) return;
            const dx = p.x - d.x, now = this.time.now;
            if (Math.abs(p.x - d.x0) > 6) d.moved = true;
            this._spinA = ((this._spinA - dx * 0.35) % 360 + 360) % 360 || 0.001;
            this._spinV = -dx * 0.35 / Math.max(8, now - d.t); d.x = p.x; d.t = now;
            this.input.setDefaultCursor('grabbing');
        });
        this.input.on('pointerup', () => { if (this._drag) { this.time.delayedCall(0, () => { this._drag = null; }); this.input.setDefaultCursor('default'); } });
        let last = 0;
        this._ticks.push(t => {
            if (!B.active) return;
            const dt = last ? Math.min(50, t - last) : 0; last = t;
            if (this._cz.t >= 1 && !this._mode && !this._drag && Math.abs(this._spinV || 0) > 0.001) { this._spinA = ((this._spinA + this._spinV * dt) % 360 + 360) % 360 || 0.001; this._spinV *= Math.pow(0.996, dt); }   // a flick keeps it turning, easing to a stop
            this._spinDraw(); this._placeBillboards();
            EnchantScene.STATIONS.forEach((st, k) => {
                const M = this._miniObjs[st.id], [x, y] = this._spinPt(M.gx, M.gy), back = y < top;
                M.mc.setPosition(ix + Math.round(x) * S, iy + Math.round(y) * S); M.mc._z = M.mc.y;   // on the island's pixel grid
                M.mc.setAlpha(back ? 0.75 : 1);
                M.ring.clear();
                const p = (t * 0.0012 + k * 0.3) % 1, on = M.hot || this._cz.t >= 1;
                M.ring.lineStyle(2, st.col, (1 - p) * (on ? 0.9 : 0.4)); M.ring.strokeEllipse(0, 0, 24 + p * (on ? 46 : 28), 8 + p * (on ? 16 : 10));
            });
            B.sort('_z');
        });
    }
    _dragStart(p, id = null) { this._drag = { x: p.x, x0: p.x, t: this.time.now, id, moved: false }; this._spinV = 0; }
    // Up close (true) or back out: the island grows round its middle (the minis start circling), the
    // side buttons and the altar's plate step aside, and a way back appears.
    _closeUp(on) {
        if (this._closing || (on ? this._cz.t > 0 : this._cz.t === 0)) return;
        this._closing = true;
        const W = this.scale.width, H = this.scale.height, land = this._land, k = Math.min(1.9, (H * 0.62) / 330), py = H * 0.4;
        Sfx.play(this, on ? 'e_beam' : 'e_flip');
        this._closeHint.setAlpha(0);
        if (on) {
            this._landFloat?.pause(); land.y = 0;
            for (const o of [...(this._stationObjs || []), ...(this._altarUI || [])]) o?.destroy?.();
            this._stationObjs = []; this._altarUI = [];
            const objs = this._closeObjs = [];
            UIKit.button(this, { x: W / 2, y: H - 46, w: 200, h: 38, label: '◂ STEP BACK', accent: UIKit.PALETTE.line, depth: 22, fontSize: '13px', fireOn: 'down', onClick: () => this._closeUp(false) }).objs.forEach(o => objs.push(o));
            objs.push(this.add.text(W / 2, H - 90, 'drag to turn the island  ·  click a place to go there', { fontSize: '13px', fontFamily: 'monospace', color: '#c8b8e8', stroke: '#0a0618', strokeThickness: 3 }).setOrigin(0.5).setDepth(22));
        } else { for (const o of (this._closeObjs || [])) o?.destroy?.(); this._closeObjs = null; for (const M of Object.values(this._miniObjs)) M.lab.setAlpha(0); }
        if (!on && this._spinA) { const A = this._spinA % 360, h = { a: A }; this.tweens.add({ targets: h, a: A > 180 ? 360 : 0, duration: 800, ease: 'Cubic.easeInOut', onUpdate: () => { this._spinA = h.a % 360 || (h.a ? 0.001 : 0); }, onComplete: () => { this._spinA = 0; } }); }   // it turns back home
        this._czTw = [this.tweens.add({ targets: this._cz, t: on ? 1 : 0, duration: 800, ease: 'Cubic.easeInOut' })];
        this._czTw.push(this.tweens.add({ targets: land, scaleX: on ? k : 1, scaleY: on ? k : 1, x: on ? W / 2 - (W / 2) * k : 0, y: on ? py - 266 * k : 0, duration: 800, ease: 'Cubic.easeInOut', onComplete: () => {
            this._closing = false;
            if (on) for (const M of Object.values(this._miniObjs)) M.lab.setAlpha(0.75);
            else { this._landFloat?.resume(); this._stations(); this._drawAltarUI(); }
        } }));
    }
    // a place's mini, where it is on screen now (the dive aims at it)
    _roomPt(id) {
        const M = this._miniObjs?.[id], land = this._land;
        if (!M) return [this.scale.width / 2, 266];
        return [land.x + M.mc.x * land.scaleX, land.y + (M.mc.y - 20) * land.scaleY];
    }
    _open(mode) { if (mode) this._enterRoom(mode); else this._leaveRoom(); }

    // ── THE ROOMS ─────────────────────────────────────────────────────────────
    // The camera dives at that part of the island, and you're there: its own painted ground, its
    // own mini altar and what moves round it, your books in a satchel on the right.
    _enterRoom(id) {
        if (this._busy || this._roomBusy || this._mode) return;
        this._roomBusy = true;
        const cam = this.cameras.main, W = this.scale.width, H = this.scale.height, [px, py] = this._roomPt(id);
        Sfx.play(this, 'e_beam'); this._hideTip();
        cam.pan(px, py, 560, 'Cubic.easeIn'); cam.zoomTo(3.4, 560, 'Cubic.easeIn');
        this.time.delayedCall(440, () => cam.fadeOut(160, 10, 6, 24));
        if (id === 'garden') { this.time.delayedCall(620, () => this.scene.start('Garden', {})); return; }   // the garden is a place you walk (GardenScene)
        this.time.delayedCall(620, () => {
            cam.resetFX(); cam.setZoom(1); cam.setScroll(0, 0);   // stop the dive's zoom and pan dead, or a slow frame leaves the room drawn zoomed
            this._mode = id; this._book = null; this._page = 0; this._picks = [];
            this._buildRoom(id); this._panel();
            if (this._cz.t > 0) {   // came from up close: behind the room, the island steps back out (leaving lands zoomed out)
                for (const tw of (this._czTw || [])) tw?.stop?.(); this._closing = false;
                this._cz.t = 0; this._spinA = 0; this._land.setScale(1).setPosition(0, 0); this._landFloat?.resume();
                for (const o of (this._closeObjs || [])) o?.destroy?.(); this._closeObjs = null;
                for (const M of Object.values(this._miniObjs)) M.lab.setAlpha(0);
                this._drawAltarUI();
            }
            cam.fadeIn(360, 10, 6, 24);
            this._say(EnchantScene.ROOMS[id].say);
            this._roomBusy = false;
        });
    }
    _leaveRoom() {
        if (!this._mode || this._busy || this._roomBusy) return;
        const cam = this.cameras.main, W = this.scale.width, H = this.scale.height, [px, py] = this._roomPt(this._mode);
        this._roomBusy = true; this._hideTip();
        cam.fadeOut(160, 10, 6, 24);
        this.time.delayedCall(170, () => {
            for (const o of [...(this._roomObjs || []), ...(this._panelObjs || []), ...(this._pickObjs || [])]) { if (o?.active) this.tweens.killTweensOf(o); o?.destroy?.(); }
            this._roomObjs = this._panelObjs = this._pickObjs = null; this._pickOpened = false;
            this._ticks = this._ticks.filter(f => !(this._roomTicks || []).includes(f)); this._roomTicks = [];
            this._mode = null; this._picks = []; this._stationBooks = null; this._stations();
            this._sayTxt?.destroy();
            cam.setZoom(3.4); cam.centerOn(px, py); cam.fadeIn(200, 10, 6, 24);
            cam.zoomTo(1, 560, 'Cubic.easeOut'); cam.pan(W / 2, H / 2, 560, 'Cubic.easeOut');
            this.time.delayedCall(600, () => { cam.resetFX(); cam.setZoom(1); cam.setScroll(0, 0); this._roomBusy = false; });
            Sfx.play(this, 'e_flip');
        });
    }
    // the altar stands at (400, 470) in every room; what sits on it floats at _altarPt
    _buildRoom(id) {
        const W = this.scale.width, H = this.scale.height, D = 30, R = EnchantScene.ROOMS[id], objs = this._roomObjs = [], keep = o => { objs.push(o); return o; };
        this._roomTicks = [];
        // The room is drawn in a 1280x720 design space (the altar at 400, 470) and scaled to cover the
        // window: the art left of the satchel fills it, the rest runs on under the satchel.
        const SX = id === 'reforge' ? W : W - 490, k = Math.max(SX / 800, H / 720), ox = (SX - 800 * k) / 2, oy = (H - 720 * k) / 2;   // the crucible stands in the middle (its books come in a popup)
        const C = keep(this.add.container(ox, oy).setScale(k).setDepth(D)), art = o => { C.add(o); return o; };
        this._roomK = k; this._roomO = [ox, oy];
        keep(this.add.rectangle(0, 0, W, H, 0x05030a, 1).setOrigin(0).setDepth(D - 0.5).setInteractive());   // nothing of the main room shows or takes a click
        const tick = f => { this._roomTicks.push(f); this._ticks.push(f); };
        art(this.add.image(0, 0, MenuArt.tex(this, 'isle_room_' + id, 320, 180, P => this._paintRoom(P, id))).setOrigin(0).setScale(4).setDepth(D).setInteractive());
        const AX = 400, AY = 470, sz = EnchantScene.ALTAR[id] || [1, 1];
        if (id !== 'garden') art(this.add.image(AX, AY, MenuArt.tex(this, 'isle_altar_' + id, sz[0], sz[1], P => this._paintAltar(P, id))).setOrigin(0.5, 1).setScale(3).setDepth(D + 2));
        this._altarPt = { x: ox + AX * k, y: oy + (AY - sz[1] * 3 - (id === 'bind' ? 70 : 46)) * k };
        // the altar's own light, breathing
        const gl = art(this.add.image(AX, AY - sz[1] * 1.5, 'mn_glow').setTint(R.col).setBlendMode(Phaser.BlendModes.ADD).setDisplaySize(sz[0] * 6, sz[1] * 5).setAlpha(0.35).setDepth(D + 1));
        this.tweens.add({ targets: gl, alpha: 0.18, duration: 1600, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
        const fx = art(this.add.graphics().setDepth(D + 1.5));
        if (id === 'bind') {
            // runes running round the ring on the ground, and the standing stones' runes pulsing
            tick(t => { if (!fx.active) return; fx.clear(); const ph = t * 0.0005;
                for (let k = 0; k < 36; k++) { const a = k / 36 * Math.PI * 2 + ph; fx.fillStyle(k % 4 ? 0x6ad86a : 0xd8ffd8, 0.5 + 0.4 * Math.sin(t * 0.003 + k)); fx.fillRect(AX + Math.cos(a) * 250 - 2, AY + 2 + Math.sin(a) * 66 - 2, k % 4 ? 4 : 6, 3); } });
            for (const [sx, sy] of [[160, 380], [280, 332], [520, 332], [640, 380]]) {
                const rg = art(this.add.image(sx, sy, 'mn_glow').setTint(0x6ad86a).setBlendMode(Phaser.BlendModes.ADD).setDisplaySize(60, 80).setAlpha(0.4).setDepth(D + 1));
                this.tweens.add({ targets: rg, alpha: 0.1, duration: 900 + sx, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
            }
            art(this.add.particles(0, 0, 'mn_px2', { x: { min: AX - 240, max: AX + 240 }, y: { min: AY - 30, max: AY + 40 }, lifespan: 2600, speedY: { min: -26, max: -8 },
                scale: { start: 1.4, end: 0 }, alpha: { start: 0.8, end: 0 }, tint: [0x6ad86a, 0xd8ffd8], blendMode: 'ADD', frequency: 120 }).setDepth(D + 1));
        } else if (id === 'reforge') {
            // the crucible's brew: thick, slow violet goo. Its surface swirls, bubbles swell and pop,
            // now and then a gob creeps over the rim and down the side; a heavy vapour rolls off it
            // drawn as pixels at the room's own scale (a small canvas, x3): bands of colour that swirl
            // slowly into each other with dithered edges, a dark meniscus, a gloss, bubbles that swell
            // and pop, and gobs oozing over the rim and down the bowl
            const MY = AY - sz[1] * 3 + 24, GW = 48, GH = 11, DW = 48, DH = 26;
            const gk = 'cru_goo', dk = 'cru_drip';
            const gt = this.textures.exists(gk) ? this.textures.get(gk) : this.textures.createCanvas(gk, GW, GH), dt2 = this.textures.exists(dk) ? this.textures.get(dk) : this.textures.createCanvas(dk, DW, DH);
            const gctx = gt.getContext(), gimg = gctx.createImageData(GW, GH), dctx = dt2.getContext(), dimg = dctx.createImageData(DW, DH);
            art(this.add.image(AX, MY, gk).setScale(3).setDepth(D + 2.6));
            art(this.add.image(AX, MY + GH * 1.5 - 3, dk).setOrigin(0.5, 0).setScale(3).setDepth(D + 2.55));
            const PAL = [0x18042c, 0x260848, 0x3a1268, 0x521e92, 0x6e30b8, 0x9a5ae8], nz = MenuArt.noise(301), nz2 = MenuArt.noise(302), bub = [], drips = [];
            let nextB = 0, nextD = 0, lastDraw = 0;
            const put = (img, w, x, y, c, a = 255) => { if (x < 0 || y < 0 || x >= w) return; const i = (y * w + x) * 4, d = img.data; if (i < 0 || i >= d.length) return; d[i] = (c >> 16) & 255; d[i + 1] = (c >> 8) & 255; d[i + 2] = c & 255; d[i + 3] = a; };
            tick(t => {
                if (t - lastDraw < 66) return; lastDraw = t;
                const d = gimg.data; d.fill(0);
                const cx = GW / 2 - 0.5, cy = GH / 2 - 0.5, rx = GW / 2, ry = GH / 2;
                for (let y = 0; y < GH; y++) for (let x = 0; x < GW; x++) {
                    const u = (x - cx) / rx, v = (y - cy) / ry, e = u * u + v * v;
                    if (e > 1) continue;
                    // a slow swirl: the field is sampled along a turning, wobbling path
                    const a = Math.atan2(v, u) + t * 0.00012 * (1 - e), r = Math.sqrt(e), sx = Math.cos(a) * r * 6, sy = Math.sin(a) * r * 6;
                    let f = MenuArt.fbm(nz, sx + t * 0.00006, sy * 1.6 + 3, 3) * 0.75 + nz2(sx * 2 + t * 0.0001, sy * 2) * 0.25;
                    f += MenuArt.bayer(x, y) * 0.12 - 0.06;                                   // dithered steps between bands
                    let i2 = Math.max(0, Math.min(4, Math.floor(f * 6.2 - 0.6)));
                    if (e > 0.78) i2 = Math.max(0, i2 - 2);                                   // the meniscus, dark against the rim
                    if (v < -0.2 && u < -0.1 && u > -0.75 && Math.abs(v + 0.45 + u * 0.15) < 0.14) i2 = 5;   // the gloss
                    put(gimg, GW, x, y, PAL[i2]);
                }
                if (t > nextB) { nextB = t + 500 + Math.random() * 700; const a = Math.random() * Math.PI * 2, r = Math.sqrt(Math.random()) * 0.7; bub.push({ x: Math.round(cx + Math.cos(a) * rx * r), y: Math.round(cy + Math.sin(a) * ry * r), t0: t, life: 1800 + Math.random() * 1800, big: Math.random() < 0.35 }); }
                for (let i = bub.length - 1; i >= 0; i--) {
                    const B = bub[i], u = (t - B.t0) / B.life;
                    if (u >= 1.3) { bub.splice(i, 1); continue; }
                    if (u < 1) {   // it swells: a dome of lighter goo, a rim, a glint
                        const r = (B.big ? 2 : 1) * Math.min(1, u * 1.6);
                        for (let yy = -2; yy <= 1; yy++) for (let xx = -2; xx <= 2; xx++) { const q = (xx * xx) / Math.max(0.3, r * r) + (yy * yy) / Math.max(0.3, r * r * 0.6); if (q <= 1) put(gimg, GW, B.x + xx, B.y + yy, q > 0.6 ? PAL[2] : PAL[4]); }
                        if (r >= 1) put(gimg, GW, B.x - 1, B.y - 1, 0xe8d8ff);
                    } else {   // and pops: a ring of pixels thrown out
                        const v2 = (u - 1) / 0.3, rr = 1 + v2 * 3;
                        for (let k = 0; k < 8; k++) { const a = k / 8 * Math.PI * 2; put(gimg, GW, Math.round(B.x + Math.cos(a) * rr), Math.round(B.y + Math.sin(a) * rr * 0.5), PAL[5], Math.round(255 * (1 - v2))); }
                    }
                }
                gctx.putImageData(gimg, 0, 0); gt.refresh();
                // the drips down the front of the bowl: a gob gathers on the rim, oozes down, thinning, then drops
                dimg.data.fill(0);
                if (t > nextD) { nextD = t + 1600 + Math.random() * 2200; drips.push({ x: 6 + Math.floor(Math.random() * (DW - 12)), t0: t, life: 5000 + Math.random() * 2500 }); }
                for (let i = drips.length - 1; i >= 0; i--) {
                    const Dp = drips[i], u = (t - Dp.t0) / Dp.life;
                    if (u >= 1) { drips.splice(i, 1); continue; }
                    const len = Math.min(DH - 4, Math.floor(Math.pow(u, 1.6) * DH * 1.2)), w = u < 0.2 ? 3 : u < 0.6 ? 2 : 1;
                    for (let y = 0; y < len; y++) for (let x = 0; x < w; x++) put(dimg, DW, Dp.x + x, y, x === 0 ? PAL[2] : PAL[3]);
                    const bw = u < 0.85 ? 2 : 1; for (let yy = 0; yy < 2; yy++) for (let xx = -1; xx < bw; xx++) put(dimg, DW, Dp.x + xx, len + yy, yy === 0 ? PAL[3] : PAL[1]);   // the bulb at its end
                    put(dimg, DW, Dp.x, Math.max(0, len - 1), PAL[5]);
                }
                dctx.putImageData(dimg, 0, 0); dt2.refresh();
            });
            // the crystals in a ring round it, faceted and glimmering, grown up out of the flags (each
            // sits in its own shadow and a scatter of broken stone), fed by runic channels of cosmic
            // fluid running out from under the crucible; each glows up and fades on its own, never the same twice
            const CR = [[-160, 26], [-128, 30], [-90, 28], [-52, 28], [-20, 24], [18, 20], [58, 15], [122, 16], [162, 21]].map(([deg, h], i) => {
                const a = deg * Math.PI / 180; return [Math.round(AX + Math.cos(a) * 290), Math.round(AY + 8 + Math.sin(a) * 78), h, i + 1];
            });
            const pulse = CR.map(() => ({ t0: 0, len: 1, amp: 0 }));
            const foot = art(this.add.graphics().setDepth(D + 1.15));
            const crys = CR.map(([x, y, h, sd]) => {
                const z = D + (y < AY + 8 ? 1.3 : 3.4) + y * 0.0001;
                foot.fillStyle(0x0a0612, 0.55); foot.fillEllipse(x, y + 2, h * 4.2, h * 0.9);   // its shadow on the flags
                const R = MenuArt.rng(sd * 31);
                for (let r = 0; r < 7; r++) { const rx = x + (R() - 0.5) * h * 4, ry = y + (R() - 0.3) * h * 0.6; foot.fillStyle(R() < 0.5 ? 0x4a4868 : 0x3a3854, 1); foot.fillRect(Math.round(rx / 4) * 4, Math.round(ry / 4) * 4, 8, 4); foot.fillStyle(0x6a6888, 1); foot.fillRect(Math.round(rx / 4) * 4, Math.round(ry / 4) * 4, 4, 4); }
                const gl = art(this.add.image(x, y - h * 2, 'mn_glow').setTint(0xa070ff).setBlendMode(Phaser.BlendModes.ADD).setDisplaySize(h * 6, h * 9).setAlpha(0.2).setDepth(z - 0.01));
                art(this.add.image(x, y + 4, this._crystalTex(h, sd)).setOrigin(0.5, 1).setScale(4).setDepth(z));
                const fl = art(this.add.image(x, y + 4, this._crystalTex(h, sd)).setOrigin(0.5, 1).setScale(4).setDepth(z + 0.001).setTintFill(0xd8b8ff).setBlendMode(Phaser.BlendModes.ADD).setAlpha(0));
                art(this.add.particles(0, 0, 'mn_px2', { x: { min: x - h * 0.4, max: x + h * 0.4 }, y: { min: y - h * 3.6, max: y - 8 }, lifespan: 900, speed: 0, scale: { start: 2, end: 0 },
                    tint: [0xffffff, 0xe0ccff], blendMode: 'ADD', frequency: 400 + sd * 50 }).setDepth(z + 0.002));   // glints winking over its facets
                return { gl, fl };
            });
            const ch = art(this.add.graphics().setDepth(D + 1.1)), PX2 = 4, AX0 = AX, AY0 = AY + 6;
            const paths = CR.map(([x, y]) => { const pts = [], n2 = 40; for (let j = 0; j <= n2; j++) { const u = j / n2; pts.push([AX0 + (x - AX0) * u + Math.sin(u * Math.PI * 2 + x) * 10 * Math.sin(u * Math.PI), AY0 + (y - AY0) * u + Math.sin(u * Math.PI) * 10]); } return pts; });
            tick(t => {
                if (!ch.active) return;
                ch.clear();
                paths.forEach((pts, i) => {
                    for (let j = 0; j < pts.length; j++) {   // the groove, a dark violet channel cut in the flags
                        const [x, y] = pts[j];
                        ch.fillStyle(0x1a0830, 0.85); ch.fillRect(Math.round(x / PX2) * PX2 - PX2, Math.round(y / PX2) * PX2 - 2, PX2 * 2, PX2);
                        ch.fillStyle(0x4a1a86, 0.9); ch.fillRect(Math.round(x / PX2) * PX2 - PX2 / 2, Math.round(y / PX2) * PX2 - 2, PX2, PX2 * 0.5);
                        if (j % 6 === 3) {   // a rune cut beside it every so often, lit as the fluid passes
                            const lit = Math.max(0, Math.sin(t * 0.004 - j * 0.35 + i));
                            ch.fillStyle(0xc89aff, 0.25 + lit * 0.7); ch.fillRect(Math.round(x / PX2) * PX2 + PX2 * 1.5, Math.round(y / PX2) * PX2 - PX2, PX2, PX2 * 2); ch.fillRect(Math.round(x / PX2) * PX2 + PX2 * 1.5 - PX2 / 2, Math.round(y / PX2) * PX2 - PX2 / 2, PX2 * 2, PX2 * 0.5);
                        }
                    }
                    for (let p2 = 0; p2 < 3; p2++) {   // pulses of fluid running out along it, oozing (slow, uneven)
                        const u = ((t * 0.00018 + p2 / 3 + i * 0.13) % 1), j = Math.floor(Math.pow(u, 1.2) * (pts.length - 1)), [x, y] = pts[j];
                        for (let tl = 0; tl < 5; tl++) { const [tx2, ty2] = pts[Math.max(0, j - tl)]; ch.fillStyle(tl === 0 ? 0xffe8ff : 0x9a5ae8, (1 - tl / 5) * 0.95); ch.fillRect(Math.round(tx2 / PX2) * PX2 - PX2 / 2, Math.round(ty2 / PX2) * PX2 - 2, PX2, PX2 * 0.75); }
                    }
                    const Q = pulse[i];   // the crystal it feeds: a slow swell and fade, its strength and length new each time
                    if (t >= Q.t0 + Q.len) { Q.t0 = t + Math.random() * 900; Q.len = 2200 + Math.random() * 2600; Q.amp = 0.15 + Math.random() * 0.85; }
                    const v = t < Q.t0 ? 0 : Math.sin((t - Q.t0) / Q.len * Math.PI) ** 2 * Q.amp;
                    crys[i].fl.setAlpha(v * 0.4); crys[i].gl.setAlpha(0.15 + v * 0.45);
                });
                ch.fillStyle(0x9a5ae8, 0.6 + Math.sin(t * 0.004) * 0.2); ch.fillRect(AX0 - 6, AY0 - 4, 12, 6);   // the spring under the crucible
            });
            art(this.add.particles(0, 0, 'mn_px2', { x: { min: AX - 50, max: AX + 50 }, y: MY - 4, lifespan: 3200, speedY: { min: -26, max: -10 }, speedX: { min: -6, max: 6 },
                scale: { start: 3, end: 7 }, alpha: { start: 0.18, end: 0 }, tint: [0x8a4ae0, 0xb07aff], frequency: 140 }).setDepth(D + 3));   // the vapour, slow and heavy
            art(this.add.particles(0, 0, 'mn_px2', { x: AX, y: MY - 4, lifespan: 1600, speed: { min: 20, max: 60 }, angle: { min: 240, max: 300 }, gravityY: 30,
                scale: { start: 1.2, end: 0 }, tint: [0xffe0ff, 0xd8a8ff], blendMode: 'ADD', frequency: 420 }).setDepth(D + 3));
            for (const [sx, sy] of [[120, 300], [700, 320]]) { const sg = art(this.add.image(sx, sy, 'mn_glow').setTint(0x9a6aff).setBlendMode(Phaser.BlendModes.ADD).setDisplaySize(160, 260).setAlpha(0.3).setDepth(D + 1)); this.tweens.add({ targets: sg, alpha: 0.12, duration: 1400, yoyo: true, repeat: -1 }); }
        } else if (id === 'combine') {
            // the two pools glinting, light running along the channels into the dais
            tick(t => { if (!fx.active) return; fx.clear();
                for (const [cx2, cy2] of [[220, 500], [580, 500]]) for (let k = 0; k < 7; k++) { const a = Math.max(0, Math.sin(t * 0.002 + k * 1.3 + cx2)); fx.fillStyle(0xfff0c0, a * 0.7); fx.fillRect(cx2 - 90 + k * 26 + Math.sin(t * 0.001 + k) * 6, cy2 - 10 + (k % 3) * 9, 10, 2); }
                for (const s2 of [-1, 1]) { const u = (t * 0.0006 + (s2 > 0 ? 0.5 : 0)) % 1; fx.fillStyle(0xffd060, 0.9 * Math.sin(u * Math.PI)); fx.fillCircle(AX + s2 * (300 - u * 220), AY + 24 - u * 10, 4); } });
        } else if (id === 'reseal') {
            // candles flickering, the hanging chains swaying
            for (const [cx2, cy2] of [[250, 488], [292, 506], [508, 506], [550, 488], [330, 520], [470, 520]]) {
                const f = art(this.add.image(cx2, cy2 - 14, 'mn_glow').setTint(0xffc060).setBlendMode(Phaser.BlendModes.ADD).setDisplaySize(36, 44).setAlpha(0.7).setDepth(D + 1));
                this.tweens.add({ targets: f, alpha: { from: 0.4, to: 0.85 }, scaleX: f.scaleX * 0.85, duration: 120 + Math.random() * 160, yoyo: true, repeat: -1 });
            }
            const link = this._linkTex();
            for (const [cx2, n, top] of [[250, 7, 170], [330, 5, 170], [410, 6, 170], [560, 4, 174]]) {   // hung from the lintel's underside (and its fallen end)
                const c = art(this.add.container(cx2, top).setDepth(D + 1));
                for (let k = 0; k < n; k++) c.add(this.add.image(0, k * 16, link).setScale(2.2).setAngle(k % 2 ? 90 : 0).setTint(0x8a8aa8));
                this.tweens.add({ targets: c, angle: { from: -3, to: 3 }, duration: 1800 + cx2 * 2, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
            }
            art(this.add.particles(0, 0, 'mn_px2', { x: { min: 220, max: 580 }, y: { min: 200, max: 480 }, lifespan: 3000, speedY: { min: -8, max: 8 }, speedX: { min: -6, max: 6 },
                scale: { start: 1, end: 0 }, alpha: { start: 0.6, end: 0 }, tint: [0x7ad8ff, 0xd8f0ff], blendMode: 'ADD', frequency: 140 }).setDepth(D + 1));
        }
        C.sort('depth');
        // the room's name and the way back
        keep(this.add.text(SX / 2, 30, R.name, { fontSize: '26px', fontFamily: UIKit.FONT.title, fontStyle: 'bold', color: UIKit._hex(MenuArt.mix(R.col, 0xffffff, 0.35)), stroke: '#0a0618', strokeThickness: 5 }).setOrigin(0.5).setDepth(D + 6));
        UIKit.button(this, { x: 90, y: 34, w: 150, h: 34, label: '◂ THE ISLE', accent: UIKit.PALETTE.line, depth: D + 6, fontSize: '13px', fireOn: 'down', onClick: () => this._leaveRoom() }).objs.forEach(keep);
    }
    // the garden's beds, in the room's quarter-size pixels (six; the tiers open them in order)
    static ALTAR = { bind: [48, 40], reforge: [56, 40], combine: [96, 36], reseal: [40, 50] };   // each altar's size in its own pixels (drawn 3x in its room, small on the island)
    // a dust crystal crop at stage 0 (a seed in the soil) to 4 (ripe: a full glowing cluster)
    _cropTex(st) {
        return ShopScene.icon(this, 'isle_crop_' + st, 16, { a: '#8affd8', b: '#d8fff0', d: '#2a8a6a', g: '#ffffff', s: '#6aa84a' }, (m, f) => {
            if (st === 0) { m.rect(6, 13, 4, 2, 'd'); m.set(8, 12, 's'); return; }
            m.line(8, 15, 8, 13, 's'); m.set(7, 13, 's'); m.set(9, 14, 's');
            const H2 = [0, 4, 7, 10, 12][st];
            for (const [ox, h, w] of [[0, H2, 2], [-3, H2 * 0.6, 1.4], [3, H2 * 0.7, 1.4]]) {
                if (st < 2 && ox) continue;
                for (let j = 0; j < h; j++) { const ww = Math.max(0.4, w * (1 - j / h)); for (let x = -ww; x <= ww; x++) m.set(8 + ox + x, 13 - j, x < 0 ? 'b' : x > ww / 2 ? 'd' : 'a'); }
            }
            if (st === 4 && f % 2 === 0) { m.set(3, 2, 'g'); m.set(13, 4, 'g'); m.set(8, 0, 'g'); }   // it sparkles: ready
        }, 4);
    }
    // a ripe crystal crop (the garden's station icon)
    _cropTex(st) { return GardenScene.prototype._cropTex.call(this, Garden.SEEDS[0], st); }
    _sheet(...a) { return GardenScene.prototype._sheet.apply(this, a); }
    // A crystal cluster, h px tall: three to five hexagonal shards from a rocky foot, each with a lit
    // left facet, a mid face and a deep right facet, veins of light inside, bright edges and a white tip.
    _crystalTex(h, seed) {
        const w = Math.round(h * 0.75);
        return MenuArt.tex(this, `cru_crystal_${h}_${seed}`, w, h + 4, P => {
            const R = MenuArt.rng(seed * 17 + h), cx = w / 2;
            const shards = [[0, h, Math.max(3, h * 0.11), 0], [-w * 0.24, h * 0.62, Math.max(2, h * 0.08), -0.25], [w * 0.24, h * 0.7, Math.max(2, h * 0.08), 0.22]];
            if (h > 45) shards.push([-w * 0.36, h * 0.38, 2, -0.45], [w * 0.38, h * 0.42, 2, 0.4]);
            shards.sort((a, b) => a[1] - b[1]);   // the small ones behind
            for (const [ox, sh, sw, lean] of shards) {
                const base = h + 1;
                for (let j = 0; j < sh; j++) {
                    const tip = j > sh - sw * 1.6, ww = tip ? sw * (sh - j) / (sw * 1.6) : sw, x0 = cx + ox + lean * j;
                    for (let x = -ww; x <= ww; x++) {
                        const f = (x + ww) / (2 * ww + 0.001), y = base - j;
                        let c = f < 0.33 ? 0xe8d8ff : f < 0.66 ? 0x9a6af0 : 0x4a2a9a;     // facets
                        if (f >= 0.33 && f < 0.66 && (j + Math.floor(x)) % 7 === 0) c = 0xc8a8ff;   // veins of light in the face
                        if (Math.abs(f - 0.33) < 0.08 || Math.abs(f - 0.66) < 0.08) c = f < 0.5 ? 0xffffff : 0x7a4ad8;   // the edges between facets
                        if (tip) c = f < 0.5 ? 0xffffff : 0xb88aff;
                        P.put(x0 + x, y, c);
                    }
                }
            }
            for (let y = h - 1; y < h + 4; y++) for (let x = 0; x < w; x++) if (((x - cx) / (w * 0.36)) ** 2 + ((y - h - 1.5) / 2.2) ** 2 <= 1 && R() < 0.8) P.put(x, y, R() < 0.35 ? 0x2a2438 : (x + y) % 3 ? 0x4a4868 : 0x5e5c7c);   // broken flags heaved up round its base
            for (let y = 0; y < P.h; y++) for (let x = 0; x < P.w; x++) if (P.alpha(x, y) && [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => !P.alpha(x + dx, y + dy))) P.put(x, y, 0x1a0e30);
        });
    }
    // a chain link and a padlock (the reseal shrine, the unsealing)
    _linkTex() { return ShopScene.icon(this, 'isle_link', 8, { a: '#9a9ab8', b: '#e0e0f0', d: '#4a4a62' }, m => { m.ring(4, 4, 3.6, 1.6, 'a'); m.set(2, 2, 'b'); m.set(3, 1, 'b'); m.set(5, 6, 'd'); m.set(6, 5, 'd'); }); }
    _lockTex() { return ShopScene.icon(this, 'isle_lock', 12, { a: '#c8a040', b: '#ffe08a', d: '#6a4a1a', s: '#9a9ab8' }, m => { m.ring(6, 4.5, 3.4, 1.4, 's'); m.rect(2, 5, 8, 6, 'a'); m.rect(2, 5, 8, 1, 'b'); m.rect(5, 7, 2, 3, 'd'); m.set(3, 6, 'b'); }); }

    // Old stone, the Isle's ruins: blocks laid in courses, each its own shade, mortar between,
    // cracks, chipped edges, a jagged broken top if `broken`, moonlight on the right face, damp
    // and dark toward the foot, moss creeping into the joints and over the tops, ivy hanging off,
    // and (if `rune`) a worn carving glowing in it. x0, y0: top left; w, h: its size.
    static ruin(P, x0, y0, w, h, o = {}) {
        const seed = o.seed ?? 7, R = MenuArt.rng(seed), n = MenuArt.noise(seed), bw = o.bw ?? 7, bh = o.bh ?? 4, base = o.base ?? 0x5e5c7c;
        const top = x => o.broken ? Math.floor(n(x * 0.35, 1) * o.broken + (R() < 0.1 ? 1 : 0)) : 0;
        const tops = Array.from({ length: w }, (_, i) => top(i));
        const blockShade = (bx, by) => MenuArt.rng(bx * 73 + by * 151 + seed)();
        for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) {
            if (j < tops[i]) continue;
            const row = Math.floor(j / bh), off = (row % 2) * Math.floor(bw / 2), col = Math.floor((i + off) / bw), sh = blockShade(col, row);
            let c = MenuArt.mix(base, sh > 0.5 ? 0x8a88a8 : 0x3e3c5a, Math.abs(sh - 0.5) * 0.9);
            const mortar = (i + off) % bw === 0 || j % bh === 0;
            if (mortar) c = MenuArt.mix(c, 0x1a1828, 0.55);
            if (n(i * 0.5 + 9, j * 0.5) > 0.74) c = MenuArt.mix(c, 0x2a2840, 0.35);                 // stains
            const lit = i > w * 0.72, shade = i < w * 0.2;
            if (lit) c = MenuArt.mix(c, 0xb8b8d8, 0.22); else if (shade) c = MenuArt.mix(c, 0x10101c, 0.25);
            c = MenuArt.mix(c, 0x10101c, Math.max(0, (j / h - 0.6)) * 0.6);                             // damp toward the foot
            // moss: in the joints low down, and on any surface open to the sky
            const openAbove = j === tops[i] || j === 0;
            if ((openAbove && R() < (o.moss ?? 0.6)) || (mortar && j > h * 0.55 && n(i * 0.4, j * 0.4 + 3) > 0.55)) c = MenuArt.bayer(i, j) < 0.5 ? 0x4a7a3a : 0x3a6230;
            if (openAbove && n(i * 0.6, 7) > 0.6) P.put(x0 + i, y0 + j - 1, 0x5a9a4a);                // moss spilling over the top
            P.put(x0 + i, y0 + j, c);
        }
        // chips knocked out of the edges
        if (o.chip !== false) for (let k = 0; k < (w + h) / 5; k++) { const side = R() < 0.5, j = Math.floor(R() * h); P.clear(side ? x0 : x0 + w - 1, y0 + j); if (R() < 0.4) P.clear(side ? x0 + 1 : x0 + w - 2, y0 + j); }   // (not on a painted scene: clearing would cut a hole in it)
        // cracks: a few running down through the blocks
        for (let k = 0; k < Math.max(1, Math.floor(w * h / 220)); k++) {
            let x = x0 + 2 + R() * (w - 4), y = y0 + tops[Math.floor(x - x0)] + 1;
            for (let s2 = 0; s2 < h * 0.6; s2++) { if (P.alpha(Math.floor(x), Math.floor(y))) P.put(x, y, 0x14121e); x += (R() - 0.5) * 1.6; y += 1; }
        }
        // ivy hanging from the top
        if (o.ivy) for (let k = 0; k < o.ivy; k++) {
            let x = x0 + R() * w; const len = 4 + R() * h * 0.6;
            for (let j = 0; j < len; j++) { x += (R() - 0.5) * 0.8; P.put(x, y0 + tops[Math.max(0, Math.min(w - 1, Math.floor(x - x0)))] + j, 0x2a4a26); if (j % 3 === 1) P.put(x + (j % 2 ? 1 : -1), y0 + j + tops[0], 0x5a9a4a); }
        }
        // a worn carving, glowing
        if (o.rune) { const cx = x0 + Math.floor(w / 2), cy = y0 + Math.floor(h * 0.45); for (const [dx, dy] of [[0, -3], [0, -2], [0, -1], [0, 0], [0, 1], [-1, -2], [1, 0], [-2, 1], [2, -1], [0, 2]]) { P.put(cx + dx, cy + dy, MenuArt.mix(o.rune, 0x1a1828, 0.25)); P.add(cx + dx, cy + dy, o.rune, 0.6); } }
    }
    // rubble: a few fallen blocks and chips at a foot
    static rubble(P, x0, y0, w, seed = 3) {
        const R = MenuArt.rng(seed);
        for (let k = 0; k < w / 3; k++) { const x = x0 + R() * w, s2 = 1 + Math.floor(R() * 3); for (let j = 0; j < s2; j++) for (let i = 0; i < s2 + 1; i++) P.put(x + i, y0 - j, j === s2 - 1 ? 0x8a88a8 : i === s2 ? 0x2c2a44 : 0x5e5c7c); }
    }
    // A room's ground, at a quarter size: the night over the island's far rim, then its grass close
    // up, a flagstone floor under the altar, and what makes each room itself.
    _paintRoom(P, id) {
        const W = P.w, H = P.h, n = MenuArt.noise(17), n2 = MenuArt.noise(23), R = MenuArt.rng(7 + id.length * 13), HZ = 66, AX = 100, AY = 117;
        for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
            let c;
            if (y < HZ) {   // the sky, banded by dither, clouds drifting low
                const t = y / HZ + (MenuArt.fbm(n, x * 0.03, y * 0.07) - 0.5) * 0.3;
                c = t + MenuArt.bayer(x, y) * 0.12 < 0.4 ? 0x0c0a22 : t + MenuArt.bayer(x, y) * 0.12 < 0.72 ? 0x1a1240 : 0x2c1a5a;
                if (MenuArt.fbm(n2, x * 0.025, y * 0.06) > 0.62) c = MenuArt.mix(c, 0x5a3a9a, 0.35);
            } else {        // the grass, finer far off, coarser close
                const d = (y - HZ) / (H - HZ), g = MenuArt.fbm(n, x * (0.09 - d * 0.05), (y - HZ) * (0.22 - d * 0.12), 3);
                c = g > 0.6 ? 0x4a8a3e : g > 0.42 ? 0x3a6e34 : 0x2c5428;
                c = MenuArt.mix(c, 0x10182a, 0.55 * (1 - d));   // dark and blue far away
                if (g > 0.66 && MenuArt.bayer(x, y) < 0.3) c = MenuArt.mix(c, 0x8ac06a, 0.35 * d);
            }
            P.put(x, y, c);
        }
        for (let k = 0; k < 70; k++) { const x = R() * W, y = R() * HZ * 0.85; P.put(x, y, R() < 0.2 ? 0xffffff : 0x9a8ad8); }
        // the far rim: the grass ends against the sky in a dark fringe, crystals beyond it
        for (let x = 0; x < W; x++) { const h = 1 + Math.floor(n(x * 0.4, 3) * 3); for (let j = 0; j < h; j++) P.put(x, HZ - j, 0x1c3a20); P.put(x, HZ + 1, 0x162c1a); }
        for (const [x0, h] of [[14, 16], [22, 10], [292, 18], [302, 11], [250, 8]]) for (let j = 0; j < h; j++) { const w = Math.max(0.5, 2.2 * (1 - j / h)); for (let x = -w; x <= w; x++) P.put(x0 + x, HZ - j, x < 0 ? 0x6a4aa8 : 0x3a2a6a); }
        // the flagstone floor round the altar
        if (id !== 'garden') for (let y = AY - 20; y <= AY + 20; y++) for (let x = AX - 74; x <= AX + 74; x++) {
            const e = ((x - AX) / 72) ** 2 + ((y - AY) / 19) ** 2;
            if (e > 1) continue;
            const cx = Math.floor((x + (Math.floor(y / 5) % 2) * 6) / 12), cy2 = Math.floor(y / 5), r2 = MenuArt.rng(cx * 31 + cy2 * 17), sh = r2(), gone = r2() < 0.12 && e < 0.85;
            if (gone) { if (MenuArt.bayer(x, y) < 0.35) P.put(x, y, 0x4a8a3e); continue; }   // a flag missing: grass come up through
            let c = sh > 0.6 ? 0x5a5478 : sh > 0.3 ? 0x4c4668 : 0x403a5a;
            if ((x + (Math.floor(y / 5) % 2) * 6) % 12 === 0 || y % 5 === 0) c = n(x * 0.3, y * 0.3) > 0.55 ? 0x3a6230 : 0x2a2440;   // the seams, moss in many
            if (n(x * 0.7 + 4, y * 0.7) > 0.8) c = 0x2c2640;                    // worn hollows
            if (sh > 0.85 && (x + y) % 7 === 0) c = 0x1a1626;                     // cracks across a flag
            if (e > 0.88) c = 0x26203a;
            P.put(x, y, c);
        }
        const rune = (x, y, c) => { P.add(x, y, c, 0.9); P.add(x + 1, y, c, 0.5); };
        const RU = EnchantScene.ruin, RB = EnchantScene.rubble;
        if (id === 'bind') {
            // standing stones round the ring: old monoliths, leaning, cracked, mossed, each with its rune
            for (const [sx, h, w, lean, sd] of [[40, 32, 14, -1, 11], [70, 26, 12, 0, 12], [130, 26, 12, 0, 13], [160, 32, 14, 1, 14]]) {
                const base = sx === 40 || sx === 160 ? 100 : 90;
                RU(P, sx - w / 2 + lean, base - h, w, h, { seed: sd, bw: 6, bh: 5, broken: 3, moss: 0.7, ivy: 2, rune: 0x6ad86a, chip: false });
                RB(P, sx - w / 2 - 2, base + 1, w + 4, sd);
            }
            for (let k = 0; k < 220; k++) { const a = k / 220 * Math.PI * 2; P.add(AX + Math.cos(a) * 64, AY + 1 + Math.sin(a) * 17, 0x3a8a4a, 0.5); }
        } else if (id === 'reforge') {
            // behind the crucible, what's left of an old wall and a broken column; the crystals grew through it
            RU(P, 24, 70, 70, 18, { chip: false, seed: 21, broken: 8, moss: 0.6, ivy: 3 });
            RU(P, 118, 74, 58, 14, { chip: false, seed: 22, broken: 7, moss: 0.6, ivy: 2 });
            RU(P, 150, 52, 10, 40, { chip: false, seed: 23, bw: 10, bh: 6, broken: 4, moss: 0.5, rune: 0x9a6aff });
            // (the crystals and the runic channels feeding them are sprites and live drawing: _buildRoom)
        } else if (id === 'combine') {
            RU(P, 8, 60, 12, 46, { chip: false, seed: 31, bw: 12, bh: 6, broken: 6, moss: 0.6, ivy: 2 });     // two broken columns flanking it
            RU(P, 182, 70, 12, 36, { chip: false, seed: 32, bw: 12, bh: 6, broken: 5, moss: 0.6, ivy: 1 });
            RB(P, 4, 108, 24, 33); RB(P, 176, 108, 26, 34);
            for (const px of [55, 145]) for (let y = AY - 4; y <= AY + 20; y++) for (let x = px - 36; x <= px + 36; x++) {   // the pools, in old carved rims
                const e = ((x - px) / 32) ** 2 + ((y - AY - 8) / 9) ** 2;
                if (e > 1.3) continue;
                let c;
                if (e > 0.92) { const sh = MenuArt.rng(Math.floor(Math.atan2(y - AY - 8, x - px) * 4) + px)(); c = MenuArt.mix(0x5e5c7c, sh > 0.5 ? 0x8a88a8 : 0x3a3854, 0.5); if (n(x * 0.5, y * 0.5) > 0.6) c = 0x3a6230; if (e > 1.22) c = 0x1a1828; }
                else { c = MenuArt.mix(0x1a2a5a, 0x0a1230, (y - AY + 2) / 20); if (Math.abs(x - px - 6) < 3 + (y - AY) * 0.4 && (y % 2 === 0)) c = MenuArt.mix(c, 0xe0e8ff, 0.5); }
                P.put(x, y, c);
            }
            for (const s2 of [-1, 1]) for (let x = 0; x < 50; x++) { const xx = AX + s2 * (24 + x), y = AY + 6 - x * 0.05; P.put(xx, y, 0x8a6a2a); P.add(xx, y - 1, 0xffd060, 0.35); }
        } else if (id === 'reseal') {
            for (let y = HZ - 30; y < H; y++) for (let x = 0; x < W; x++) if (y > HZ) P.dim(x, y, 0.25);   // a darker, colder place
            // an ancient arch: two cracked, mossed pillars, the lintel broken through on one side, ivy all over
            RU(P, 52, 42, 16, AY - 46, { chip: false, seed: 41, bw: 8, bh: 6, moss: 0.5, ivy: 4 });
            RU(P, 132, 41, 16, AY - 45, { chip: false, seed: 42, bw: 8, bh: 6, broken: 4, moss: 0.5, ivy: 3 });
            RU(P, 46, 30, 76, 12, { chip: false, seed: 43, bw: 12, bh: 6, moss: 0.7, ivy: 5 });
            RU(P, 128, 34, 26, 9, { chip: false, seed: 44, bw: 12, bh: 5, broken: 4, moss: 0.7, ivy: 2 });   // the lintel's far end, fallen lower
            for (let x = 70; x <= 112; x += 6) P.add(x, 36, 0x7ad8ff, 0.7);   // runes cut along it, still lit
            RB(P, 112, AY - 2, 40, 45); RB(P, 46, AY, 24, 46);
            for (const [cx2, cy2] of [[62, 122], [73, 126], [127, 126], [138, 122], [82, 130], [118, 130]]) { P.rect(cx2 - 1, cy2 - 4, 3, 5, 0xe8e0c8); P.put(cx2 - 1, cy2 - 4, 0xc8b898); P.put(cx2, cy2 - 5, 0xffd060); P.put(cx2, cy2 - 6, 0xff8a3a); P.put(cx2 + 2, cy2, 0xd8d0b8); }   // candles, wax pooled at their feet
        }
        for (let k = 0; k < 90; k++) {   // tufts in the foreground
            const x = R() * W, y = AY + 22 + R() * (H - AY - 22);
            if (Math.abs(x - AX) < 76 && y < AY + 22) continue;
            const h2 = 2 + Math.floor(R() * 3);
            for (let j = 0; j < h2; j++) P.put(x + (j > 1 ? (R() < 0.5 ? -1 : 1) : 0), y - j, j === h2 - 1 ? 0x8ac06a : 0x4a8a3e);
            if (R() < 0.12) P.put(x, y - h2, [0xff8ad8, 0xffe08a, 0xa8d8ff][Math.floor(R() * 3)]);
        }
    }
    // each room's mini altar (drawn 3x)
    _paintAltar(P, id) {
        const W = P.w, H = P.h, K = 0x120e20, RU = EnchantScene.ruin;
        const outline = () => { for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (P.alpha(x, y) && [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => !P.alpha(x + dx, y + dy))) P.put(x, y, K); };
        if (id === 'bind') {   // an old runed plinth: courses of worn stone, its capstone cracked, moss up the joints, the binding runes still glowing
            for (let y = 10; y < H; y++) { const w = 30 + (y - 10) * 0.5; RU(P, Math.round(W / 2 - w / 2), y, Math.round(w), 1, { seed: 51 + y, bw: 6, bh: 99, moss: 0 }); }
            RU(P, 6, 10, W - 12, H - 10, { seed: 52, bw: 6, bh: 5, moss: 0.4, ivy: 2 });
            RU(P, 2, 3, W - 4, 7, { seed: 53, bw: 11, bh: 7, broken: 2, moss: 0.8 });   // the capstone
            for (let x = 10; x < W - 10; x += 4) { P.add(x, 18, 0x6ad86a, 0.9); P.add(x + 1, 19, 0x6ad86a, 0.6); P.add(x, 27, 0x6ad86a, 0.7); P.add(x + 2, 28, 0x8aff9a, 0.6); }
            for (let y = 14; y < H - 4; y++) P.add(W / 2, y, 0x6ad86a, 0.5);
        } else if (id === 'reforge') {   // an ancient crucible: green-bronze gone to verdigris, cracked stone feet, runes round its belly
            for (const lx of [W / 2 - 18, W / 2, W / 2 + 18]) RU(P, Math.round(lx - 3 + (lx < W / 2 ? -3 : lx > W / 2 ? 3 : 0)), 26, 6, H - 26, { seed: 60 + lx, bw: 6, bh: 4, moss: 0.3 });
            for (let y = 8; y < 28; y++) { const w = 26 * Math.sqrt(Math.max(0, 1 - ((y - 8) / 22) ** 2)); for (let x = W / 2 - w; x <= W / 2 + w; x++) {
                const t = (x - (W / 2 - w)) / (2 * w + 1), n = MenuArt.noise(61)(x * 0.4, y * 0.4);
                let c = t > 0.72 ? 0x8aa898 : t > 0.3 ? 0x5a7a6a : 0x34483e;   // old bronze, green with age
                if (n > 0.62) c = MenuArt.mix(c, 0x6ac8a0, 0.4); if (n < 0.25) c = MenuArt.mix(c, 0x2a2a34, 0.4);
                if ((y === 14 || y === 22) && x % 2 === 0) c = 0x2a3a32;      // bands
                P.put(x, y, c);
            } }
            for (let x = 8; x < W - 8; x += 5) { P.add(x, 18, 0x9a6aff, 0.8); P.add(x + 1, 17, 0x9a6aff, 0.5); }   // runes round its belly
            for (let y = 4; y < 12; y++) for (let x = 2; x < W - 2; x++) { const e = ((x - W / 2) / 26) ** 2 + ((y - 8) / 4) ** 2; if (e <= 1 && e > 0.62) P.put(x, y, (x + y) % 3 ? 0xa8b8a8 : 0x6a7a70); }   // the rim
            for (const [cx, cy] of [[W / 2 - 14, 12], [W / 2 + 9, 20], [W / 2 - 4, 25]]) { P.put(cx, cy, 0x14121e); P.put(cx + 1, cy + 1, 0x14121e); P.put(cx + 1, cy + 2, 0x14121e); }   // cracks
        } else if (id === 'combine') {   // a worn dais with two weathered pedestals and a small one between, gold inlay faded
            RU(P, 4, 26, W - 8, H - 26, { seed: 71, bw: 9, bh: 4, moss: 0.5 });
            for (let x = 4; x < W - 4; x++) P.put(x, 26, (x % 5) ? 0xb8b0a0 : 0x8a8478);
            for (const [cx, top, w, sd] of [[13, 4, 14, 72], [W - 13, 4, 14, 73], [W / 2, 16, 10, 74]]) {
                RU(P, cx - w / 2, top + 2, w, 26 - top - 2, { seed: sd, bw: w, bh: 5, moss: 0.4, ivy: 1 });
                for (let x = cx - w / 2 - 2; x <= cx + w / 2 + 1; x++) { P.put(x, top, (x % 3) ? 0xd8c890 : 0xa88a40); P.put(x, top + 1, 0x8a6a2a); }
                P.add(cx, top + 6, 0xffd060, 0.7);
            }
            for (let x = 20; x < W - 20; x += 3) P.add(x, 31, 0xffd060, 0.35);
        } else if (id === 'reseal') {   // an old stone lectern, chained, its book-rest worn smooth, wax and moss on it
            RU(P, 6, H - 8, W - 12, 8, { seed: 81, bw: 9, bh: 4, moss: 0.5 });
            RU(P, W / 2 - 6, 14, 12, H - 22, { seed: 82, bw: 12, bh: 5, moss: 0.4, ivy: 2 });
            for (let y = 0; y < 12; y++) for (let x = 4 + (11 - y) * 0.4; x < W - 4 - (11 - y) * 0.2; x++) P.put(x, y + 2, y < 2 ? 0x9a98b4 : y < 9 ? (MenuArt.noise(83)(x * 0.5, y) > 0.6 ? 0x4a7a3a : 0x6a6888) : 0x3a3854);
            for (let k = 0; k < 6; k++) { const y = 18 + k * 4; P.put(W / 2 - 7 + (k % 2) * 12, y, 0xa89a88); P.put(W / 2 - 5 + (k % 2) * 8, y + 1, 0x7a6a5a); P.put(W / 2 - 3 + (k % 2) * 4, y + 2, 0xa89a88); }   // the chain, rusted
            P.rect(W / 2 - 3, 30, 6, 5, 0xa88a40); P.put(W / 2, 32, 0x5a3a1a); P.put(W / 2 - 3, 30, 0xd8b860);
            P.rect(W - 9, 2, 3, 4, 0xe8e0c8); P.put(W - 8, 1, 0xffd060); P.rect(W - 10, 6, 5, 1, 0xd8d0b8);   // a candle stub on the rest
        }
        outline();
    }

    // Are you sure? (salvaging can't be undone)
    _confirm(title, body, yes, onYes) {
        this._closeConfirm();
        const W = this.scale.width, H = this.scale.height, D = 70, objs = this._confirmObjs = [], keep = o => { objs.push(o); return o; };
        keep(this.add.rectangle(0, 0, W, H, 0x05030a, 0.7).setOrigin(0).setDepth(D).setInteractive());
        const bw = 440, bh = 190, x = W / 2 - bw / 2, y = H / 2 - bh / 2, g = keep(this.add.graphics().setDepth(D + 1));
        g.fillStyle(0x140e22, 1); g.fillRoundedRect(x, y, bw, bh, 10); g.lineStyle(3, 0xff8a4a, 0.9); g.strokeRoundedRect(x, y, bw, bh, 10);
        keep(this.add.text(W / 2, y + 30, title, { fontSize: '20px', fontFamily: UIKit.FONT.title, fontStyle: 'bold', color: '#ffb07a' }).setOrigin(0.5).setDepth(D + 2));
        keep(this.add.text(W / 2, y + 76, body, { fontSize: '13px', fontFamily: 'monospace', color: '#f4e8cc', align: 'center', wordWrap: { width: bw - 40 } }).setOrigin(0.5).setDepth(D + 2));
        UIKit.button(this, { x: W / 2 - 100, y: y + bh - 38, w: 170, h: 40, label: 'KEEP IT', accent: UIKit.PALETTE.line, depth: D + 3, fontSize: '14px', fireOn: 'down', onClick: () => { Sfx.play(this, 'click'); this._closeConfirm(); } }).objs.forEach(keep);
        UIKit.button(this, { x: W / 2 + 100, y: y + bh - 38, w: 170, h: 40, label: yes, accent: 0xff8a4a, depth: D + 3, fontSize: '14px', fireOn: 'down', onClick: () => { this._closeConfirm(); onYes(); } }).objs.forEach(keep);
        Sfx.play(this, 'deny');
    }
    // unbinding loses the enchant for good, so it asks three times
    _askUnbind(w, i) {
        const b = Enchants.on(w.id)[i]; if (!b || this._busy) return;
        const d = Enchants.def(b.id), uc = Enchants.unbindCost(b), name = `${d.name} ${Enchants.roman(b.lvl)}`;
        if (this.glorps < uc) { Sfx.play(this, 'deny'); this._say(`Pulling it out takes ✦${uc} glorps.`); return; }
        this._confirm('UNBIND IT?', `${name} (${b.q}%) comes out of the ${w.name} for ✦${uc}.\nYou get a sealed book and ✧${Enchants.salvageValue(b)} dust back.`, 'UNBIND', () =>
            this._confirm('ARE YOU SURE?', `The enchant itself is destroyed.\n${name} at ${b.q}% is gone for good: the book you get back is sealed, a new pull.`, 'YES, I\'M SURE', () =>
                this._confirm('LAST CHANCE', `Really pull ${name} out of the ${w.name}?`, 'PULL IT OUT', () => this._unbindFx(w, i))));
    }
    _closeConfirm() { for (const o of (this._confirmObjs || [])) o?.destroy?.(); this._confirmObjs = null; }

    // ── THE PANEL ─────────────────────────────────────────────────────────────
    // Your weapons (pick one), its slots, your books (pick one), and what to do with that book.
    _panel() {
        for (const o of (this._panelObjs || [])) { if (o?.active) this.tweens.killTweensOf(o); o?.destroy?.(); }
        this._hideTip();
        const objs = this._panelObjs = [], keep = o => { objs.push(o); return o; };
        const mode = this._mode, ST = EnchantScene.STATIONS.find(s => s.id === mode);
        if (!mode) return;
        if (!this._roomObjs) this._buildRoom(mode);   // opened straight into (no dive): its room first
        this._refreshAll = () => { this._panel(); this._drawAltarUI(); };   // set before the crucible's early return (it never got one, so its hidden click zone stayed hidden after one reforge)
        if (mode === 'reforge') return this._crucibleUI(keep);
        const W = this.scale.width, H = this.scale.height, D = 40, P = UIKit.PALETTE;
        const px = W - 490, pw = 474, py = 14, ph = H - 28, bindMode = mode === 'bind';
        this._auraD = D + 3;
        // your satchel: a leather bag, not a box. Its top arches, its sides bulge, its bottom sags; a flap over the top with a
        // scalloped, stitched edge and a brass buckle; stitching that follows its shape; brass rivets; leather grain
        this._satchel(keep, px, py, pw, ph, ST.col, D);
        keep(this.add.text(px + 22, py + 20, ST.name, { fontSize: '17px', fontFamily: UIKit.FONT.title, fontStyle: 'bold', color: UIKit._hex(MenuArt.mix(ST.col, 0xffffff, 0.3)) }).setOrigin(0, 0.5).setDepth(D + 1));
        const g = keep(this.add.graphics().setDepth(D + 2));
        const txt = (x, y, s, o = {}) => keep(this.add.text(x, y, s, Object.assign({ fontSize: '12px', fontFamily: 'monospace', color: UIKit.CSS.textMid }, o)).setDepth(D + 3));
        const btn = o => { const k = UIKit.button(this, Object.assign({ depth: D + 4, fontSize: '11px', fireOn: 'down', shape: 'rune' }, o)); objs.push(...k.objs); return k; };
        txt(px + pw - 22, py + 20, `✦ ${this.glorps}   ✧ ${Enchants.dust()}`, { fontSize: '12px', fontStyle: 'bold', color: '#f0d890' }).setOrigin(1, 0.5);
        const L = px + 18, R = px + pw - 18, CW = R - L;
        const refresh = () => { this._panel(); this._drawAltarUI(); };
        this._refreshAll = refresh;

        // ── the elements: one page each, its weapons as cards (binding only) ──
        const by0 = bindMode ? this._weaponSection(keep, g, txt, btn, L, R, CW, py + 12, D, refresh) : py + 88;   // (12: under the flap and its buckle)
        const w = this._w;
        if (bindMode) this._weaponCards[w.id] = { ...this._altarPt };   // a bound book flies to the weapon on the altar
        this._roomCenter(keep, D, w);
        const sub = { reforge: 'Pick a book and reroll its quality. A gamble: the new roll replaces the old, worse or better.',
                      combine: 'Pick two or more copies of one book (same level). The more quality in, the better the odds. A miss loses the worst copy.',
                      reseal: 'Reseal a book (costs dust) for a fresh pull later, or grind it into dust.' }[mode];
        if (sub) txt(L, by0 - 26, sub, { fontSize: '10px', color: UIKit.CSS.textLo, wordWrap: { width: CW } });
        this._booksAndActions(keep, g, txt, btn, L, R, CW, py, ph, D, by0, w, refresh, objs);
    }

    // the element pages, the weapons and the chosen weapon's slots; returns where the books start
    _weaponSection(keep, g, txt, btn, L, R, CW, py, D, refresh) {
        const P = UIKit.PALETTE;
        const ELS = [['fire', 'FIRE', 0xff8a3a], ['ice', 'ICE', 0x7ad8ff], ['lightning', 'LIGHTNING', 0xffe14a], ['cosmic', 'COSMIC', 0xb388ff]];
        const el = this._el = this._el || this._w.element;
        const tw = (CW - 9) / 4;
        ELS.forEach(([id, name, col], k) => {
            const x = L + k * (tw + 3), on = id === el, has = this._weapons.some(w => w.element === id);
            const hh = on ? 28 : 22, rib = [{ x, y: py + 38 }, { x: x + tw, y: py + 38 }, { x: x + tw, y: py + 38 + hh }, { x: x + tw / 2, y: py + 32 + hh }, { x, y: py + 38 + hh }];   // a cloth bookmark, its tail notched
            g.fillStyle(MenuArt.mix(col, 0x14100c, on ? 0.35 : 0.72), has ? 1 : 0.4); g.fillPoints(rib, true);
            g.fillStyle(0xffffff, on ? 0.18 : 0.06); g.fillRect(x + 3, py + 39, tw - 6, 3);
            if (on) { g.lineStyle(2, MenuArt.mix(col, 0xffffff, 0.35), 1); g.strokePoints(rib, true); }
            txt(x + tw / 2, py + 52, name, { fontSize: '11px', fontStyle: 'bold', color: UIKit._hex(on ? col : MenuArt.mix(col, 0x6a5a48, 0.5)) }).setOrigin(0.5);
            if (has) keep(this.add.zone(x + tw / 2, py + 52, tw, 24).setInteractive({ useHandCursor: true }).setDepth(D + 5)).on('pointerdown', () => {
                this._el = id; this._w = this._weapons.find(w => w.element === id && w === this._w) || this._weapons.find(w => w.element === id); Sfx.play(this, 'click'); this._panel();
            });
        });
        const mine = this._weapons.filter(w => w.element === el);
        if (this._w.element !== el) this._w = mine[0];
        const w = this._w;
        const wy = py + 72, wh = 58, ww = (CW - (mine.length - 1) * 6) / Math.max(1, mine.length);
        this._weaponCards = {};
        mine.forEach((it, k) => {
            const x = L + k * (ww + 6), on = it === w, n = Enchants.on(it.id).length, slots = Enchants.slots(it.id);
            const cx2 = x + ww / 2, pw2 = Math.min(ww, 120);   // a little stone pedestal (as wide as a card at most); the chosen one lit from below
            if (on) { g.fillStyle(0xd8b8ff, 0.16); g.fillEllipse(cx2, wy + 30, pw2 * 0.9, 44); }
            g.fillStyle(0x1a1420, 0.6); g.fillEllipse(cx2, wy + 40, pw2 * 0.62, 12);
            g.fillStyle(on ? 0x6a5a80 : 0x463c54, 1); g.fillRect(cx2 - pw2 * 0.22, wy + 32, pw2 * 0.44, 7); g.fillEllipse(cx2, wy + 32, pw2 * 0.44, 8);
            g.fillStyle(on ? 0x9a88b8 : 0x5e5270, 1); g.fillEllipse(cx2, wy + 31, pw2 * 0.4, 6);
            if (on) { g.lineStyle(1.5, 0xd8b8ff, 0.9); g.strokeEllipse(cx2, wy + 31, pw2 * 0.46, 9); }
            this._aura(keep, x + ww / 2, wy + 22, n, slots, Enchants.corrupted(it.id));
            const ik = MenuArt.iconSheet(this, it.id);
            if (ik) ShopScene.enchAura(this, keep(this.add.sprite(x + ww / 2, wy + 22, ik, '0').setScale(1.3).setDepth(D + 4)).play(ik), it.id).forEach(keep);
            txt(x + ww / 2, wy + 42, it.name, { fontSize: '10px', fontStyle: 'bold', color: on ? UIKit.CSS.textHi : UIKit.CSS.textMid }).setOrigin(0.5, 0);
            for (let s = 0; s < slots; s++) {   // a pip per slot, lit when it's filled
                const sx = x + ww - 8 - (slots - 1 - s) * 8, b = Enchants.on(it.id)[s];
                g.fillStyle(b ? Enchants.rarity(b.id).col : 0x3a3048, 1); g.fillCircle(sx, wy + 8, 3);
            }
            this._weaponCards[it.id] = { x: x + ww / 2, y: wy + 22 };
            keep(this.add.zone(x + ww / 2, wy + wh / 2, ww, wh).setInteractive({ useHandCursor: true }).setDepth(D + 5)).on('pointerdown', () => { this._w = it; Sfx.play(this, 'click'); this._panel(); });
        });

        // ── the chosen weapon's slots (fixed room for three) ──
        const slots = Enchants.slots(w.id), on = Enchants.on(w.id), sy0 = wy + wh + 10;
        for (let i = 0; i < 3; i++) {   // a rune socket each: hollow when empty, the book sitting in it when bound, chained shut past what it holds
            const b = on[i], sx = L + CW * (i + 0.5) / 3, sy = sy0 + 24, locked = i >= slots, col = b ? Enchants.rarity(b.id).col : 0x8a7aa8;
            g.fillStyle(0x0a0612, locked ? 0.4 : 0.85); g.fillCircle(sx, sy, 19);
            g.lineStyle(3, locked ? 0x3a3048 : MenuArt.mix(col, 0x2a2238, b ? 0.1 : 0.5), 1); g.strokeCircle(sx, sy, 19);
            for (let r = 0; r < 6; r++) { const a = r / 6 * Math.PI * 2 + 0.3; g.fillStyle(locked ? 0x3a3048 : col, b ? 1 : 0.45); g.fillCircle(sx + Math.cos(a) * 23, sy + Math.sin(a) * 23, 1.6); }   // its runes
            if (locked) { g.lineStyle(2, 0x5a4a3a, 0.8); g.lineBetween(sx - 14, sy - 14, sx + 14, sy + 14); g.lineBetween(sx + 14, sy - 14, sx - 14, sy + 14); if (i === slots) txt(L + CW * (slots + (3 - slots) / 2) / 3, sy + 32, `the ${w.name} holds ${slots}`, { fontSize: '10px', color: '#6a5a4a' }).setOrigin(0.5, 0); continue; }
            if (!b) { txt(sx, sy + 30, 'empty', { fontSize: '10px', color: UIKit.CSS.textLo }).setOrigin(0.5, 0); continue; }
            const d = Enchants.def(b.id);
            const gl = keep(this.add.image(sx, sy, 'mn_glow').setTint(col).setBlendMode(Phaser.BlendModes.ADD).setDisplaySize(64, 64).setAlpha(0.35).setDepth(D + 2));
            this.tweens.add({ targets: gl, alpha: 0.15, duration: 1200 + i * 200, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
            keep(this.add.image(sx, sy, ShopScene.bookIcon(this, d.r, d.b, d.id), '0').setScale(1.3).setDepth(D + 3));
            txt(sx, sy + 26, `${d.name} ${Enchants.roman(b.lvl)}`, { fontSize: '10px', fontStyle: 'bold', color: UIKit._hex(col) }).setOrigin(0.5, 0);
            txt(sx, sy + 38, `${b.q}%`, { fontSize: '10px', color: UIKit._hex(Enchants.grade(b.q).col) }).setOrigin(0.5, 0);
        }

        return sy0 + 3 * 30 + 8;
    }

    // the books, and the drawer's own action under them
    _booksAndActions(keep, g, txt, btn, L, R, CW, py, ph, D, by0, w, refresh, objs) {
        const P = UIKit.PALETTE, mode = this._mode, bindMode = mode === 'bind';
        // ── your books: a fixed grid, 4 across, glowing by quality ──
        g.lineStyle(1, 0x9a6aff, 0.35); g.lineBetween(L, by0, R, by0);
        const all = Enchants.collection();
        const order = all.map((b, i) => ({ ...b, i })).sort((a, b) => Enchants.def(b.id).r - Enchants.def(a.id).r || b.q - a.q || a.id.localeCompare(b.id) || b.lvl - a.lvl);
        // the action sits at the bottom of the satchel; the shelf of books fills whatever's between
        const actH = mode === 'reseal' ? 150 : mode === 'combine' ? 116 : 100, ay = py + ph - actH, gy = by0 + 28;
        const COLS = 4, ch = 70, ROWS = Math.max(2, Math.floor((ay - 10 - gy) / (ch + 6))), PER = COLS * ROWS, cw = (CW - (COLS - 1) * 6) / COLS;
        const pages = Math.max(1, Math.ceil(order.length / PER)), page = this._page = Math.min(this._page, pages - 1);
        txt(L, by0 + 8, `YOUR BOOKS  ·  ${all.length}`, { fontStyle: 'bold', color: UIKit.CSS.textHi });
        if (pages > 1) {
            txt(R - 40, by0 + 8, `${page + 1}/${pages}`).setOrigin(0.5, 0);
            for (const [dx, dir, s] of [[-80, -1, '‹'], [0, 1, '›']]) txt(R + dx, by0 + 3, s, { fontSize: '18px', color: UIKit.CSS.textHi }).setOrigin(1, 0)
                .setInteractive({ useHandCursor: true }).on('pointerdown', () => { this._page = (page + dir + pages) % pages; this._panel(); });
        }
        if (order.length) {   // a bookshelf: a dark wooden back, a plank under each row (the books stand on them); only as tall as this page's books
            const used = Math.max(1, Math.ceil(Math.min(PER, order.length - this._page * PER) / COLS)), sh = used * (ch + 6);
            g.fillStyle(0x1c120a, 0.92); g.fillRoundedRect(L - 6, gy - 8, CW + 12, sh + 4, 6);
            for (let x = L + cw + 3; x < R - 4; x += cw + 6) { g.fillStyle(0x120a06, 0.8); g.fillRect(x - 1, gy - 6, 2, sh); }
            for (let r = 0; r < used; r++) {
                const py2 = gy + r * (ch + 6) + ch - 20;
                g.fillStyle(0x000000, 0.35); g.fillRect(L - 6, py2 + 7, CW + 12, 4);
                g.fillStyle(0x7a5434, 1); g.fillRect(L - 8, py2, CW + 16, 7);
                g.fillStyle(0xa07a50, 1); g.fillRect(L - 8, py2, CW + 16, 2);
                g.fillStyle(0x4a3020, 1); g.fillRect(L - 8, py2 + 6, CW + 16, 1);
            }
        }
        else this._emptySatchel(keep, L + CW / 2, (gy + ay) / 2, CW, D + 3);
        this._bookCards = {};
        order.slice(page * PER, page * PER + PER).forEach((b, j) => {
            const d = Enchants.def(b.id), col = Enchants.RARITY[d.r].col, gr = Enchants.grade(b.q);
            const cx = L + (j % COLS) * (cw + 6), cy = gy + Math.floor(j / COLS) * (ch + 6), sel = this._book === b.i;
            const first0 = this._picks?.length ? all[this._picks[0]] : null;
            const fit = bindMode ? Enchants.fits(b.id, w.id) : mode === 'combine' ? (first0 ? b.id === first0.id && b.lvl === first0.lvl : Enchants.canCombine(b.i)) : true;   // combining: only copies of the first pick stay lit
            const picked = mode === 'combine' && this._picks.includes(b.i);   // binding: crossed out if it won't go in; combining: dimmed without a pair
            const first = objs.length, ix = cx + cw / 2, iy = cy + ch - 40 - (sel ? 6 : 0);   // standing on its plank; the chosen one lifted off it
            if (sel) { g.fillStyle(0xffd060, 0.22); g.fillEllipse(ix, cy + ch - 20, cw * 0.8, 10); }
            g.fillStyle(col, fit ? 0.9 : 0.3); g.fillRect(ix - 10, cy + ch - 22, 20, 2);   // its rarity, a strip of colour on the plank
            this._bookGlow(keep, ix, iy, b.q, col);
            const ik = ShopScene.bookIcon(this, d.r, d.b, d.id), icon = keep(this.add.sprite(ix, iy, ik, '0').setScale(2.2).setDepth(D + 4)).play(ik);
            this.tweens.add({ targets: icon, y: iy - 2, duration: 900 + (j % 4) * 120, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
            if (b.q >= 98) this.tweens.addCounter({ from: 0, to: 360, duration: 2400, repeat: -1, onUpdate: tw => icon.active && icon.setTint(Phaser.Display.Color.HSVToRGB(tw.getValue() / 360, 0.35, 1).color) });
            const nm = txt(ix, cy + ch - 12, d.name, { fontSize: '10px', fontStyle: 'bold', color: UIKit._hex(col) }).setOrigin(0.5, 0);
            if (d.r === 5) { this._glitchName(nm, d.name); this.tweens.add({ targets: icon, alpha: 0.55, duration: 70, yoyo: true, repeat: -1, repeatDelay: 900 + Math.random() * 1500 }); }
            txt(cx + 4, cy + 2, Enchants.roman(b.lvl), { fontSize: '10px', fontStyle: 'bold', color: UIKit.CSS.textHi });
            txt(cx + cw - 4, cy + 2, `${b.q}%`, { fontSize: '10px', fontStyle: 'bold', color: UIKit._hex(gr.col) }).setOrigin(1, 0);
            if (!fit && !bindMode) objs.slice(first).forEach(o => o.setAlpha?.(0.4));
            else if (!fit) {
                objs.slice(first).forEach(o => o.setAlpha?.(0.4));
                txt(ix + 16, iy - 18, '✕', { fontSize: '14px', fontStyle: 'bold', color: '#f0503c', stroke: '#1a0806', strokeThickness: 3 }).setOrigin(0.5);   // won't go in
            }
            this._bookCards[b.i] = { x: ix, y: iy };
            const z = keep(this.add.zone(cx + cw / 2, cy + ch / 2, cw, ch).setInteractive({ useHandCursor: true }).setDepth(D + 6));
            if (picked) { g.fillStyle(0xffd060, 0.3); g.fillEllipse(ix, cy + ch - 20, cw * 0.85, 12); txt(ix + 16, iy - 18, '✓', { fontSize: '15px', fontStyle: 'bold', color: '#ffd060', stroke: '#1a1006', strokeThickness: 3 }).setOrigin(0.5); }
            z.on('pointerdown', () => {
                if (mode === 'combine') {   // pick and unpick copies; a book that isn't a copy of the first starts over
                    const f0 = this._picks.length ? all[this._picks[0]] : null;
                    if (this._picks.includes(b.i)) this._picks = this._picks.filter(k => k !== b.i);
                    else if (f0 && (b.id !== f0.id || b.lvl !== f0.lvl)) this._picks = [b.i];
                    else this._picks.push(b.i);
                    this._book = this._picks[0] ?? null;
                } else this._book = b.i;
                Sfx.play(this, 'hover'); this._panel();
            });
            z.on('pointerover', () => this._showTip(b, cx, cy, w));
            z.on('pointerout', () => this._hideTip());
        });

        // ── what to do with the chosen book (fixed, at the bottom) ──
        const sel = this._book != null ? all[this._book] : null;
        g.lineStyle(1, 0x9a6aff, 0.35); g.lineBetween(L, ay, R, ay);
        const bty = ay + 50, bh = 44, hint = { bind: 'Pick a book to bind into the weapon above.', reforge: 'Pick a book to reforge.', combine: 'Pick a book that has a twin (the lit ones).', salvage: 'Pick a book to salvage.' }[mode];
        if (!sel) txt(L, ay + 8, hint, { fontSize: '11px', color: UIKit.CSS.textLo });
        else {
            const d = Enchants.def(sel.id), gr = Enchants.grade(sel.q);
            txt(L, ay + 8, `${d.name} ${Enchants.roman(sel.lvl)}`, { fontSize: '14px', fontFamily: UIKit.FONT.title, fontStyle: 'bold', color: UIKit._hex(Enchants.rarity(sel.id).col) });
            txt(R, ay + 10, `${gr.name} ${sel.q}%`, { fontSize: '11px', fontStyle: 'bold', color: UIKit._hex(gr.col) }).setOrigin(1, 0);
        }
        const d = sel && Enchants.def(sel.id), why = sel && Enchants.blocked(w.id, sel);
        const cost = sel ? Enchants.cost(sel) : 0, rf = sel ? Enchants.REFORGE[d.r] : 0, cb = sel ? Enchants.COMBINE[d.r] : 0, sv = sel ? Enchants.salvageValue(sel) : 0;
        const can = sel ? { bind: !why && this.glorps >= cost, reforge: Enchants.dust() >= rf && sel.q < 100, combine: Enchants.canCombine(this._book) && Enchants.dust() >= cb } : {};
        const none = () => { Sfx.play(this, 'deny'); this._say('Pick a book first.'); };
        const corrupt = sel && d.r === 5;
        const big = (label, accent, onClick) => btn({ x: L + CW / 2, y: bty, w: CW, h: bh, fontSize: '15px', label, accent, onClick: () => sel ? onClick() : none() });
        if (mode === 'bind') big(!sel ? 'BIND' : why === 'fit' ? "WON'T FIT" : why === 'dupe' ? 'ALREADY HAS IT' : why === 'full' ? 'SLOTS FULL' : why === 'corrupt' ? 'HAS A CORRUPTED ONE' : `BIND INTO THE ${w.name.toUpperCase()}  ·  ✦${cost}`, can.bind ? P.accentGreen : P.line, () => {
            if (!can.bind) { Sfx.play(this, 'deny'); this._say(why === 'fit' ? `${d.name} won't work on the ${w.name}.` : why === 'dupe' ? `The ${w.name} already has ${d.name}. One of each.` : why === 'full' ? `The ${w.name} is full. Take one out first.` : why === 'corrupt' ? `The ${w.name} already carries a corrupted book. One is all it can bear.` : `${cost - this.glorps} more glorps to bind it.`); return; }
            this._bindFx(this._book, w, cost);
        });
        if (mode === 'reforge') big(corrupt ? 'REWRITE (SACRIFICE BOOKS)' : sel ? `REFORGE  ·  ✧${rf}` : 'REFORGE', corrupt ? 0x7aff5a : can.reforge ? 0x9a6aff : P.line, () => {
            if (corrupt) return this._rewritePanel(this._book);
            if (!can.reforge) { Sfx.play(this, 'deny'); this._say(sel.q >= 100 ? "It's already perfect." : `Reforging takes ✧${rf} dust.`); return; }
            this._reforgeFx(this._book);
        });
        if (mode === 'combine') {
            const pk = this._picks || [], okSet = Enchants.canCombineMany(pk), ch2 = pk.length >= 2 ? Math.round(Enchants.combineChance(pk) * 100) : 0;
            const cbc = pk.length ? Enchants.COMBINE[Enchants.def(all[pk[0]].id).r] : 0;
            if (pk.length) txt(L + CW / 2, bty + 34, pk.length < 2 ? 'Pick at least one more copy.' : `${pk.length} copies  ·  ${ch2}% to take  ·  a miss loses the worst`, { fontSize: '11px', fontStyle: 'bold', color: pk.length < 2 ? UIKit.CSS.textLo : '#ffd060' }).setOrigin(0.5);
            btn({ x: L + CW / 2, y: bty, w: CW, h: bh, fontSize: '15px', label: !pk.length ? 'COMBINE' : corrupt ? "CORRUPTED BOOKS DON'T COMBINE" : !okSet ? (all[pk[0]].lvl >= Enchants.def(all[pk[0]].id).max ? 'MAX LEVEL' : 'PICK MORE COPIES') : `COMBINE  ·  ${ch2}%  ·  ✧${cbc}`,
                accent: okSet && Enchants.dust() >= cbc ? P.accentGold : P.line, onClick: () => {
                    if (!pk.length) return none();
                    if (!okSet) { Sfx.play(this, 'deny'); this._say(corrupt ? "Corrupted books don't combine." : pk.length < 2 ? 'Pick another copy of it.' : 'It\'s already at its top level.'); return; }
                    if (Enchants.dust() < cbc) { Sfx.play(this, 'deny'); this._say(`Combining takes ✧${cbc} dust.`); return; }
                    this._combineFx(pk);
                } });
        }
        if (mode === 'reseal') {
            const hw = (CW - 10) / 2;
            const rsc = sel ? Enchants.RESEAL[d.r] : 0;
            btn({ x: L + hw / 2, y: bty, w: hw, h: bh, fontSize: '14px', label: sel ? `RESEAL  ·  ✧${rsc}` : 'RESEAL', accent: sel && Enchants.dust() >= rsc ? 0x7ad8ff : P.line, onClick: () => {
                if (!sel) return none();
                if (Enchants.dust() < rsc) { Sfx.play(this, 'deny'); this._say(`Resealing it takes ✧${rsc} dust.`); return; }
                const i = this._book, rare = d.r >= 3 || sel.q >= 85;
                this._confirm('RESEAL IT?', `${d.name} ${Enchants.roman(sel.lvl)} (${sel.q}%) goes back under its seal for ✧${rsc} dust: +1 sealed book.\nUnsealing it again is a whole new pull.${rare ? `\nIt's ${d.r >= 3 ? Enchants.RARITY[d.r].name.toLowerCase() : Enchants.grade(sel.q).name.toLowerCase()}!` : ''}`, 'RESEAL', () => this._resealFx(i));
            } });
            btn({ x: L + hw * 1.5 + 10, y: bty, w: hw, h: bh, fontSize: '14px', label: sel ? `SALVAGE  ·  +✧${sv}` : 'SALVAGE', accent: sel ? P.accentOrange : P.line, onClick: () => {
                if (!sel) return none();
                const i = this._book, rare = d.r >= 3 || sel.q >= 85;
                this._confirm('SALVAGE IT?', `${d.name} ${Enchants.roman(sel.lvl)} (${sel.q}%) turns into ✧${sv} dust.${rare ? `\nIt's ${d.r >= 3 ? Enchants.RARITY[d.r].name.toLowerCase() : Enchants.grade(sel.q).name.toLowerCase()}!` : ''}\nIt can't be undone.`, 'SALVAGE', () => {
                    const at = this._bookCards[i];
                    const v = Enchants.salvage(i); this._book = null; Sfx.play(this, 'e_salvage');
                    if (at) { this._dustBurst(at.x, at.y); this._gain('dust', v, at); }
                    this._say(`Ground to dust: +✧${v}.`); refresh();
                });
            } });
            const junk = b => Enchants.def(b.id).r === 0 && b.q < 30, nJunk = all.filter(junk).length;
            btn({ x: L + CW / 2, y: py + ph - 26, w: CW, h: 28, fontSize: '11px', label: `SALVAGE COMMONS UNDER 30%  ·  ${nJunk} book${nJunk === 1 ? '' : 's'}`, accent: nJunk ? P.accentOrange : P.line, onClick: () => {
                if (!nJunk) { Sfx.play(this, 'deny'); return; }
                const dust = all.filter(junk).reduce((a, b) => a + Enchants.salvageValue(b), 0);
                this._confirm('SALVAGE THEM ALL?', `${nJunk} Common book${nJunk === 1 ? '' : 's'} under 30% turn into ✧${dust} dust.\nThey can't be brought back.`, 'SALVAGE ALL', () => {
                    const r = Enchants.salvageWhere(junk); this._book = null; Sfx.play(this, 'e_salvage'); this._gain('dust', r.dust, { x: this.scale.width - 250, y: this.scale.height - 60 }); this._say(`${r.n} book${r.n === 1 ? '' : 's'} ground to dust: +✧${r.dust}.`); refresh();
                });
            } });
        }
    }

    // The crucible's own room: no satchel. A bobbing arrow over the crucible; click it and your books
    // rise out of it in a popup; pick one, see the cost, confirm, and in it goes.
    _crucibleUI(keep) {
        const W = this.scale.width, A = this._altarPt, D = 40, k = this._roomK || 1;
        keep(this.add.text(W - 20, 22, `✧ ${Enchants.dust()} dust`, { fontSize: '15px', fontFamily: 'monospace', fontStyle: 'bold', color: '#d8c8ff', backgroundColor: '#0a0618cc', padding: { x: 8, y: 5 } }).setOrigin(1, 0).setDepth(D));
        const ar = keep(this.add.graphics().setDepth(D).setPosition(A.x, A.y - 40));
        ar.fillStyle(0x0a0618, 1); ar.fillTriangle(-16, -6, 16, -6, 0, 18); ar.fillStyle(0xd8a8ff, 1); ar.fillTriangle(-12, -4, 12, -4, 0, 13); ar.fillStyle(0xffffff, 0.8); ar.fillTriangle(-8, -3, -2, -3, -3, 5);
        this.tweens.add({ targets: ar, y: A.y - 26, duration: 600, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
        keep(this.add.text(A.x, A.y - 74, 'click the crucible', { fontSize: '13px', fontFamily: 'monospace', fontStyle: 'bold', color: '#e0ccff', stroke: '#0a0618', strokeThickness: 4 }).setOrigin(0.5).setDepth(D));
        const z = keep(this.add.zone(A.x, A.y + 70 * k, 220 * k, 200 * k).setInteractive({ useHandCursor: true }).setDepth(D + 1));
        z.on('pointerdown', () => { if (!this._busy && !this._pickObjs) this._bookPicker(); });
    }
    _closePicker(then) {
        const objs = this._pickObjs || [];
        this._pickObjs = null; this._pickOpened = false; this._hideTip();
        if (!objs.length) return then?.();
        const A = this._altarPt;
        this.tweens.add({ targets: objs.filter(o => o.scale !== undefined && o.type !== 'Zone'), alpha: 0, duration: 160, onComplete: () => { objs.forEach(o => o?.destroy?.()); then?.(); } });
    }
    // the satchel's leather: outline(ins) walks its edge (arched top, bulging sides, sagging bottom), inset by ins
    _satchel(keep, px, py, pw, ph, col, D) {
        const M = MenuArt.mix, sg = keep(this.add.graphics().setDepth(D)), N = 40;
        const outline = (ins, dy = 0) => {
            const P = [], x0 = px + ins, x1 = px + pw - ins, y0 = py + ins + dy, y1 = py + ph - ins + dy;
            for (let i = 0; i <= N; i++) { const t = i / N; P.push({ x: x0 + 8 + (x1 - x0 - 16) * t, y: y0 + 7 - 7 * Math.sin(Math.PI * t) }); }
            for (let i = 1; i <= N; i++) { const t = i / N; P.push({ x: x1 - 3 + 3 * Math.sin(Math.PI * t), y: y0 + 7 + (y1 - y0 - 18) * t }); }
            for (let i = 1; i <= N; i++) { const t = i / N; P.push({ x: x1 - 8 - (x1 - x0 - 16) * t, y: y1 - 11 + 8 * Math.sin(Math.PI * t) }); }
            for (let i = 1; i < N; i++) { const t = i / N; P.push({ x: x0 + 3 - 3 * Math.sin(Math.PI * t), y: y1 - 11 - (y1 - y0 - 18) * t }); }
            return P;
        };
        const leather = M(col, 0x1a1008, 0.82), dark = M(col, 0x0a0604, 0.9), lite = M(col, 0x6a4a30, 0.7);
        sg.fillStyle(0x000000, 0.45); sg.fillPoints(outline(0, 8).map(p => ({ x: p.x + 6, y: p.y })), true);
        sg.fillStyle(dark, 1); sg.fillPoints(outline(0), true);
        sg.fillStyle(leather, 0.97); sg.fillPoints(outline(3), true);
        const R = MenuArt.rng(px + ph);
        for (let k = 0; k < pw * ph / 260; k++) { sg.fillStyle(R() < 0.5 ? 0x000000 : 0xffffff, 0.05); sg.fillRect(px + 10 + R() * (pw - 20), py + 10 + R() * (ph - 20), 2, 1); }   // grain
        const stitch = (pts, c) => { for (let i = 0; i < pts.length - 1; i += 2) { sg.lineStyle(2, c, 0.85); sg.lineBetween(pts[i].x, pts[i].y, pts[i + 1].x, pts[i + 1].y); } };
        stitch(outline(10), M(col, 0xf2e2bc, 0.5));
        // the flap: over the top, its lower edge scalloped and stitched, a brass buckle at its middle
        const fy = py + 40, flap = outline(0).slice(0, N + 1), scal = [];
        for (let i = 0; i <= 60; i++) { const t = 1 - i / 60, x = px + 2 + (pw - 4) * t, dip = 6 * Math.sin(Math.PI * t), sc = 3 * Math.abs(Math.sin(t * Math.PI * 7)); scal.push({ x, y: fy + dip + sc }); }
        sg.fillStyle(0x000000, 0.35); sg.fillPoints([...flap, ...scal.map(p => ({ x: p.x, y: p.y + 4 }))], true);
        sg.fillStyle(lite, 1); sg.fillPoints([...flap, ...scal], true);
        sg.fillStyle(0xffffff, 0.08); sg.fillRect(px + 14, py + 8, pw - 28, 3);
        stitch(scal.map(p => ({ x: p.x, y: p.y - 6 })), M(col, 0xf2e2bc, 0.55));
        const bx = px + pw / 2, by = fy + 6;
        sg.fillStyle(dark, 1); sg.fillRect(bx - 9, by - 4, 18, 26); sg.fillStyle(M(col, 0x2a1a10, 0.6), 1); sg.fillRect(bx - 7, by - 4, 14, 24);   // the strap
        sg.fillStyle(0x3a2a10, 1); sg.fillRoundedRect(bx - 15, by - 9, 30, 20, 4); sg.fillStyle(0xd8a838, 1); sg.fillRoundedRect(bx - 13, by - 8, 26, 17, 3);
        sg.fillStyle(leather, 1); sg.fillRect(bx - 8, by - 4, 16, 9); sg.fillStyle(0xfff0a0, 0.9); sg.fillRect(bx - 12, by - 7, 10, 2); sg.fillStyle(0xd8a838, 1); sg.fillRect(bx - 1, by - 4, 2, 9);
        for (const [rx, ry] of [[px + 16, py + ph - 20], [px + pw - 16, py + ph - 20], [px + 14, fy + 18], [px + pw - 14, fy + 18]]) {   // brass rivets
            sg.fillStyle(0x2a1a08, 1); sg.fillCircle(rx, ry, 5); sg.fillStyle(0xc89830, 1); sg.fillCircle(rx, ry, 4); sg.fillStyle(0xfff0a0, 1); sg.fillRect(rx - 2, ry - 2, 2, 2);
        }
    }

    // no books yet: a sealed book bobbing in its glow, and where books come from
    _emptySatchel(keep, x, y, w, depth) {
        const n = Enchants.books(), ik = ShopScene.bookIcon(this, -1);
        const gl = keep(this.add.image(x, y - 40, 'mn_glow').setTint(0xb07aff).setBlendMode(Phaser.BlendModes.ADD).setDisplaySize(150, 150).setAlpha(0.45).setDepth(depth));
        this.tweens.add({ targets: gl, alpha: 0.2, duration: 1400, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
        const bk = keep(this.add.sprite(x, y - 40, ik, '0').setScale(3.2).setAlpha(0.85).setDepth(depth + 1));
        if (this.anims.exists(ik)) bk.play(ik);
        this.tweens.add({ targets: bk, y: y - 48, duration: 1300, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
        keep(this.add.text(x, y + 22, 'Your satchel is empty', { fontSize: '20px', fontFamily: UIKit.FONT.title, fontStyle: 'bold', color: '#e8dcff' }).setOrigin(0.5).setDepth(depth + 1));
        keep(this.add.text(x, y + 50, n ? `You have ${n} sealed book${n === 1 ? '' : 's'}: open them at the altar.` : 'Sealed books drop in the Tower and Glurp sells them.\nOpen them at the altar.',
            { fontSize: '12px', fontFamily: 'monospace', color: n ? '#ffd890' : '#a898c8', align: 'center', lineSpacing: 4, wordWrap: { width: w - 40 } }).setOrigin(0.5, 0).setDepth(depth + 1));
    }
    _bookPicker(page = 0, pick = null) {
        (this._pickObjs || []).forEach(o => o?.destroy?.());
        const W = this.scale.width, H = this.scale.height, D = 60, objs = this._pickObjs = [], keep = o => { objs.push(o); return o; }, P = UIKit.PALETTE;
        const all = Enchants.collection(), order = all.map((b, i) => ({ ...b, i })).sort((a, b) => Enchants.def(b.id).r - Enchants.def(a.id).r || b.q - a.q);
        const COLS = 5, ROWS = 3, PER = COLS * ROWS, cw = 104, ch = 92, pw = COLS * (cw + 8) + 32, ph = ROWS * (ch + 8) + 200, px = W / 2 - pw / 2, py = H / 2 - ph / 2;
        const pages = Math.max(1, Math.ceil(order.length / PER)); page = Math.min(page, pages - 1);
        keep(this.add.rectangle(0, 0, W, H, 0x05030a, 0.55).setOrigin(0).setDepth(D).setInteractive()).on('pointerdown', () => this._closePicker());
        const box = keep(this.add.container(W / 2, H / 2).setDepth(D + 1)), add = o => { box.add(o); return o; };
        const g = add(this.add.graphics());
        g.fillStyle(0x140a24, 0.98); g.fillRoundedRect(-pw / 2, -ph / 2, pw, ph, 14); g.lineStyle(3, 0x9a6aff, 0.9); g.strokeRoundedRect(-pw / 2, -ph / 2, pw, ph, 14);
        add(this.add.text(-pw / 2 + 20, -ph / 2 + 16, 'WHICH BOOK GOES IN?', { fontSize: '20px', fontFamily: UIKit.FONT.title, fontStyle: 'bold', color: '#e0ccff' }));
        add(this.add.text(-pw / 2 + 20, -ph / 2 + 44, 'Its quality comes out new: better or worse, the new roll stays. High rolls are rare.', { fontSize: '11px', fontFamily: 'monospace', color: '#a898c8' }));
        if (!order.length) this._emptySatchel(add, 0, -20, pw - 40, 0);
        else {   // a bookshelf: a dark back, a plank under each row
            const sx0 = -pw / 2 + 12, sy0 = -ph / 2 + 64, rows = Math.min(ROWS, Math.ceil(order.slice(page * PER).length / COLS));
            g.fillStyle(0x1c120a, 0.92); g.fillRoundedRect(sx0, sy0, pw - 24, rows * (ch + 8) + 2, 6);
            for (let r = 0; r < rows; r++) { const py2 = sy0 + 6 + r * (ch + 8) + ch - 30; g.fillStyle(0x000000, 0.35); g.fillRect(sx0, py2 + 7, pw - 24, 4); g.fillStyle(0x7a5434, 1); g.fillRect(sx0 - 2, py2, pw - 20, 7); g.fillStyle(0xa07a50, 1); g.fillRect(sx0 - 2, py2, pw - 20, 2); }
        }
        order.slice(page * PER, page * PER + PER).forEach((b, j) => {
            const d = Enchants.def(b.id), col = Enchants.RARITY[d.r].col, gr = Enchants.grade(b.q), sel = pick === b.i;
            const cx = -pw / 2 + 16 + (j % COLS) * (cw + 8), cy = -ph / 2 + 70 + Math.floor(j / COLS) * (ch + 8);
            const pl = cy + ch - 30;   // standing on its plank; the chosen one lifted, gold under it
            if (sel) { g.fillStyle(0xffd060, 0.3); g.fillEllipse(cx + cw / 2, pl + 2, cw * 0.8, 12); }
            g.fillStyle(col, 0.9); g.fillRect(cx + cw / 2 - 12, pl - 2, 24, 2);
            const ik = ShopScene.bookIcon(this, d.r, d.b, d.id), ic = add(this.add.sprite(cx + cw / 2, pl - 20 - (sel ? 6 : 0), ik, '0').setScale(2.4)).play(ik);
            add(this.add.text(cx + cw / 2, pl + 9, `${d.name} ${Enchants.roman(b.lvl)}`, { fontSize: '10px', fontFamily: 'monospace', fontStyle: 'bold', color: UIKit._hex(col) }).setOrigin(0.5, 0));
            add(this.add.text(cx + cw / 2, pl + 21, `${gr.name} ${b.q}%`, { fontSize: '10px', fontFamily: 'monospace', fontStyle: 'bold', color: UIKit._hex(gr.col) }).setOrigin(0.5, 0));
            add(this.add.zone(cx, cy, cw, ch).setOrigin(0).setInteractive({ useHandCursor: true })).on('pointerdown', () => { Sfx.play(this, 'hover'); this._bookPicker(page, b.i); });
        });
        if (pages > 1) for (const [dx, dir, sym] of [[-60, -1, '‹'], [60, 1, '›']]) add(this.add.text(dx, -ph / 2 + 70 + ROWS * (ch + 8) + 2, sym, { fontSize: '22px', color: '#e0ccff' }).setOrigin(0.5, 0).setInteractive({ useHandCursor: true })).on('pointerdown', () => this._bookPicker((page + dir + pages) % pages, pick));
        // the chosen one: its cost, and the confirmation
        const by = ph / 2 - 70, sel = pick != null ? all[pick] : null;
        if (order.length) { g.lineStyle(1, 0x9a6aff, 0.4); g.lineBetween(-pw / 2 + 20, by - 18, pw / 2 - 20, by - 18); }
        if (!sel) { if (order.length) add(this.add.text(0, by + 10, 'pick a book', { fontSize: '13px', fontFamily: 'monospace', color: '#a898c8' }).setOrigin(0.5)); }
        else {
            const d = Enchants.def(sel.id), corrupt = d.r === 5, cost = Enchants.REFORGE[d.r], can = !corrupt && sel.q < 100 && Enchants.dust() >= cost;
            add(this.add.text(-pw / 2 + 20, by - 4, `${d.name} ${Enchants.roman(sel.lvl)}  ·  now ${sel.q}%`, { fontSize: '15px', fontFamily: UIKit.FONT.title, fontStyle: 'bold', color: UIKit._hex(Enchants.RARITY[d.r].col) }));
            add(this.add.text(-pw / 2 + 20, by + 20, corrupt ? 'Corrupted: rewritten by sacrificing books, not reforged.' : sel.q >= 100 ? 'Already perfect.' : `costs ✧${cost} dust  (you have ✧${Enchants.dust()})`, { fontSize: '11px', fontFamily: 'monospace', color: can || corrupt ? '#c8b8e8' : '#ff8a7a' }));
            UIKit.button(this, { x: W / 2 + pw / 2 - 110, y: H / 2 + by + 14, w: 180, h: 44, fontSize: '14px', depth: D + 3, fireOn: 'down', label: corrupt ? 'REWRITE IT' : `REFORGE · ✧${cost}`, accent: can || corrupt ? 0x9a6aff : P.line, onClick: () => {
                if (corrupt) { this._closePicker(() => this._rewritePanel(pick)); return; }
                if (!can) { Sfx.play(this, 'deny'); this._say(sel.q >= 100 ? "It's already perfect." : `Reforging takes ✧${cost} dust.`); return; }
                Sfx.play(this, 'click');
                this._closePicker(() => this._confirm('REFORGE IT?', `${d.name} ${Enchants.roman(sel.lvl)} goes into the crucible for ✧${cost} dust.\nIts ${sel.q}% is gone either way: whatever it rolls, it keeps.`, 'REFORGE', () => this._reforgeFx(pick)));
            } }).objs.forEach(keep);
        }
        // it rises out of the crucible
        if (!this._pickOpened) { this._pickOpened = true; const A = this._altarPt; box.setPosition(A.x, A.y + 40).setScale(0.1).setAlpha(0); this.tweens.add({ targets: box, x: W / 2, y: H / 2, scale: 1, alpha: 1, duration: 320, ease: 'Back.easeOut' }); Sfx.play(this, 'e_dip', { big: false }); }
    }

    // What sits on the room's altar: the weapon you're binding into (its slots as sockets round it),
    // the book in the fire, the copies on the pedestals, the book on the lectern.
    _roomCenter(keep, D, w) {
        const mode = this._mode, A = this._altarPt, all = Enchants.collection(), sel = this._book != null ? all[this._book] : null;
        const float = (o, dy = 8) => this.tweens.add({ targets: o, y: o.y - dy, duration: 1300, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
        const bookAt = (b, x, y, sc) => {
            const d = Enchants.def(b.id), col = Enchants.RARITY[d.r].col, ik = ShopScene.bookIcon(this, d.r, d.b, d.id);
            const gl = keep(this.add.image(x, y, 'mn_glow').setTint(col).setBlendMode(Phaser.BlendModes.ADD).setDisplaySize(40 * sc, 40 * sc).setAlpha(0.6).setDepth(D - 2));
            const ic = keep(this.add.sprite(x, y, ik, '0').setScale(sc).setDepth(D - 1)).play(ik);
            float(ic); float(gl);
            return ic;
        };
        if (mode === 'bind') {
            const ik = MenuArt.iconSheet(this, w.id);
            if (ik) { const ws = keep(this.add.sprite(A.x, A.y, ik, '0').setScale(3.4).setDepth(D - 1)).play(ik); ShopScene.enchAura(this, ws, w.id).forEach(keep); float(ws); }
            const slots = Enchants.slots(w.id), on = Enchants.on(w.id);
            for (let i = 0; i < slots; i++) {   // a socket per slot, round under the weapon, lit with its book
                const a = -Math.PI / 2 + (i - (slots - 1) / 2) * 0.55, x = A.x + Math.cos(a) * 120, y = A.y + 20 + Math.sin(a) * 120, b = on[i];   // in an arc over it
                const sk = keep(this.add.graphics().setDepth(D - 2)), sc = b ? Enchants.rarity(b.id).col : 0x6ad86a; sk.fillStyle(0x0a1a12, 0.55); sk.fillCircle(x, y, 17); sk.lineStyle(2, sc, b ? 1 : 0.55); sk.strokeCircle(x, y, 17); for (let q = 0; q < 8; q++) { const qa = q / 8 * Math.PI * 2; sk.fillStyle(sc, b ? 0.9 : 0.5); sk.fillRect(x + Math.cos(qa) * 17 - 1.5, y + Math.sin(qa) * 17 - 1.5, 3, 3); }   // a socket: a ring of runes, lit by the book in it
                if (b) {   // hover a filled socket to see it; click it to unbind (it asks three times: the enchant is lost)
                    const d = Enchants.def(b.id), bk = keep(this.add.sprite(x, y, ShopScene.bookIcon(this, d.r, d.b, d.id), '0').setScale(1.1).setDepth(D - 1)), uc = Enchants.unbindCost(b);
                    const hv = keep(this.add.graphics().setDepth(D - 1.5));
                    const tip = keep(this.add.text(x, y - 30, `${d.name} ${Enchants.roman(b.lvl)}\nclick to unbind  ·  ✦${uc}`, { fontSize: '11px', fontFamily: 'monospace', fontStyle: 'bold', color: '#ffd8c8', align: 'center', backgroundColor: '#0a0618dd', padding: { x: 6, y: 4 } }).setOrigin(0.5, 1).setDepth(D + 6).setVisible(false));
                    keep(this.add.zone(x, y, 40, 40).setInteractive({ useHandCursor: true }).setDepth(D + 5))
                        .on('pointerover', () => { tip.setVisible(true); bk.setScale(1.35); hv.lineStyle(3, 0xff6a5a, 1); hv.strokeCircle(x, y, 19); })
                        .on('pointerout', () => { tip.setVisible(false); bk.setScale(1.1); hv.clear(); })
                        .on('pointerdown', () => this._askUnbind(w, i));
                }
            }
            keep(this.add.text(A.x, 600, w.name, { fontSize: '15px', fontFamily: UIKit.FONT.title, fontStyle: 'bold', color: '#e8ffe8', stroke: '#0a0618', strokeThickness: 4 }).setOrigin(0.5).setDepth(D - 1));
        } else if (mode === 'combine') {
            const pk = this._picks || [], spots = [[-150, 26], [150, 26], [-75, 48], [75, 48], [0, 64]];
            pk.slice(0, 5).forEach((i, k) => all[i] && bookAt(all[i], A.x + spots[k][0], A.y + spots[k][1], 2));
            if (pk.length >= 2) keep(this.add.text(A.x, A.y + 10, `${Math.round(Enchants.combineChance(pk) * 100)}%`, { fontSize: '30px', fontFamily: UIKit.FONT.title, fontStyle: 'bold', color: '#ffd060', stroke: '#0a0618', strokeThickness: 5 }).setOrigin(0.5).setDepth(D));
        } else if (sel) bookAt(sel, A.x, A.y, 3);
        if (!sel && mode !== 'bind') keep(this.add.text(A.x, A.y + 10, 'pick a book', { fontSize: '13px', fontFamily: 'monospace', color: '#b8a8d8', stroke: '#0a0618', strokeThickness: 3 }).setOrigin(0.5).setDepth(D - 1));
    }

    // Combining: the copies lift off their pedestals and spiral into the middle; it takes (a flash, a
    // level higher) or it cracks (one copy shatters, the rest drop back).
    _combineFx(pk) {
        if (this._busy) return;
        const all = Enchants.collection(), d = Enchants.def(all[pk[0]].id), R = Enchants.RARITY[d.r], A = this._altarPt, D = 80;
        const res = Enchants.combineMany(pk);
        if (!res) return;
        this._busy = true; this._picks = []; this._book = null; this._panel();
        this._spend('dust', Enchants.COMBINE[d.r], this._altarPt);
        const objs = [], keep = o => { objs.push(o); return o; };
        keep(this.add.rectangle(0, 0, this.scale.width - 490, this.scale.height, 0x05030a, 0.55).setOrigin(0).setDepth(D));
        const ik = ShopScene.bookIcon(this, d.r, d.b, d.id), n = pk.length;
        const bks = pk.map((_, k) => keep(this.add.sprite(A.x + Math.cos(k / n * Math.PI * 2) * 150, A.y + Math.sin(k / n * Math.PI * 2) * 60, ik, '0').setScale(2.2).setDepth(D + 2)).play(ik));
        Sfx.play(this, 'e_beam');
        const spin = { t: 0 };
        this.tweens.add({ targets: spin, t: 1, duration: 1300, ease: 'Cubic.easeIn', onUpdate: () => {
            bks.forEach((b, k) => { const a = k / n * Math.PI * 2 + spin.t * 9, r = 150 * (1 - spin.t); b.setPosition(A.x + Math.cos(a) * r, A.y + Math.sin(a) * r * 0.45); b.angle = spin.t * 720; });
        }, onComplete: () => {
            bks.forEach(b => b.destroy());
            const ring = keep(this.add.graphics().setDepth(D + 1).setPosition(A.x, A.y));
            ring.lineStyle(6, res.ok ? 0xffd060 : 0x8a7a68, 1); ring.strokeCircle(0, 0, 30);
            this.tweens.add({ targets: ring, scale: 6, alpha: 0, duration: 700, ease: 'Quad.easeOut' });
            const sp = keep(this.add.particles(0, 0, 'mn_px2', { x: A.x, y: A.y, lifespan: 1000, speed: { min: 80, max: 280 }, gravityY: 150, scale: { start: 2.2, end: 0 }, alpha: { start: 1, end: 0 },
                tint: res.ok ? [0xffd060, 0xffffff, R.col] : [0x8a7a68, 0x5a5068], blendMode: res.ok ? 'ADD' : 'NORMAL', emitting: false }).setDepth(D + 3));
            sp.explode(res.ok ? 80 : 40);
            if (res.ok) {
                this.cameras.main.flash(240, 255, 210, 110); this.cameras.main.shake(260, 0.008); Sfx.play(this, 'e_combine');
                const nb = keep(this.add.sprite(A.x, A.y, ik, '0').setScale(4).setDepth(D + 2)).play(ik);
                this.tweens.add({ targets: nb, scale: { from: 5, to: 3.4 }, duration: 360, ease: 'Back.easeOut' });
                keep(this.add.text(A.x, A.y + 80, `${d.name} ${Enchants.roman(res.book.lvl)}!`, { fontSize: '24px', fontFamily: UIKit.FONT.title, fontStyle: 'bold', color: '#ffd060', stroke: '#000', strokeThickness: 5 }).setOrigin(0.5).setDepth(D + 3));
                this._say(`It took: ${d.name} ${Enchants.roman(res.book.lvl)}, ${res.book.q}%.`);
            } else {
                this.cameras.main.shake(200, 0.005); Sfx.play(this, 'e_reforge', { d: -1 });
                keep(this.add.text(A.x, A.y + 80, `IT CRACKED`, { fontSize: '24px', fontFamily: UIKit.FONT.title, fontStyle: 'bold', color: '#ff7a6a', stroke: '#000', strokeThickness: 5 }).setOrigin(0.5).setDepth(D + 3));
                keep(this.add.text(A.x, A.y + 108, `lost one copy (${res.lost.q}%), the rest are back`, { fontSize: '13px', fontFamily: 'monospace', color: '#d8c8b8', stroke: '#000', strokeThickness: 3 }).setOrigin(0.5).setDepth(D + 3));
                this._say(`It didn't take (${Math.round(res.chance * 100)}%). One copy is gone.`);
            }
            this.time.delayedCall(1700, () => { objs.forEach(o => { if (o?.active) { this.tweens.killTweensOf(o); o.destroy(); } }); this._busy = false; this._refreshAll?.(); });
        } });
    }

    // Resealing: chains whip in round the book on the lectern, the padlock drops on and clicks, the
    // book darkens to a sealed one and sinks into the lectern.
    _resealFx(i) {
        if (this._busy) return;
        const b = Enchants.collection()[i];
        if (!b || !Enchants.reseal(i)) return;
        this._busy = true; this._book = null; this._panel();   // the lectern empties: the animation's book takes its place
        const A = this._altarPt, D = 80, d = Enchants.def(b.id), objs = [], keep = o => { objs.push(o); return o; };
        this._spend('dust', Enchants.RESEAL[d.r], A);
        const ik = ShopScene.bookIcon(this, d.r, d.b, d.id), book = keep(this.add.sprite(A.x, A.y, ik, '0').setScale(3).setDepth(D)).play(ik);
        const link = this._linkTex(), links = [];
        for (const s2 of [-1, 1]) for (let k = 0; k < 9; k++) {   // two chains, each link flying in from its side to its place on an X
            const t = (k - 4) / 4, tx = A.x + t * 46, ty = A.y + s2 * t * 34;
            const l = keep(this.add.image(A.x + s2 * 380, A.y - 160 + k * 30, link).setScale(2.4).setDepth(D + 1).setAngle(Math.atan2(s2 * 34, 46) * 180 / Math.PI + (k % 2 ? 90 : 0)));
            this.tweens.add({ targets: l, x: tx, y: ty, delay: 120 + k * 35 + (s2 > 0 ? 160 : 0), duration: 280, ease: 'Cubic.easeOut', onComplete: () => k === 8 && Sfx.play(this, 'e_chain') });
            links.push(l);
        }
        const lock = keep(this.add.image(A.x, A.y - 140, this._lockTex()).setScale(3).setDepth(D + 2).setAlpha(0));
        this.tweens.add({ targets: lock, y: A.y + 4, alpha: 1, delay: 820, duration: 260, ease: 'Bounce.easeOut', onComplete: () => {
            Sfx.play(this, 'e_seal'); this.cameras.main.shake(140, 0.006);
            book.stop(); book.setTexture(ShopScene.bookIcon(this, -1), '0');
            this.tweens.add({ targets: [book, lock, ...links], tint: 0x6a6a8a, duration: 200 });
            const ring = keep(this.add.graphics().setDepth(D).setPosition(A.x, A.y)); ring.lineStyle(4, 0x7ad8ff, 1); ring.strokeCircle(0, 0, 26);
            this.tweens.add({ targets: ring, scale: 4, alpha: 0, duration: 500 });
            this.tweens.add({ targets: [book, lock, ...links], y: `+=${90}`, alpha: 0, delay: 500, duration: 600, ease: 'Cubic.easeIn' });
            const t = keep(this.add.text(A.x, A.y - 70, '+1 SEALED BOOK', { fontSize: '20px', fontFamily: UIKit.FONT.title, fontStyle: 'bold', color: '#a8e8ff', stroke: '#000', strokeThickness: 5 }).setOrigin(0.5).setDepth(D + 3));
            this.tweens.add({ targets: t, y: t.y - 30, delay: 300, duration: 900 });
            this._say(`${d.name} is sealed again. Unseal it at the altar for a fresh pull.`);
            this.time.delayedCall(900, () => this._gain('book', 1, { x: A.x, y: A.y + 60 }));
            this.time.delayedCall(1500, () => { objs.forEach(o => { if (o?.active) { this.tweens.killTweensOf(o); o.destroy(); } }); this._busy = false; this._drawAltarUI(); this._refreshAll?.(); });
        } });
    }

    // A weapon's aura, by how many enchants it holds: none, a soft glow, a brighter pulsing
    // one, then rays turning behind it (all slots full on a three-slot weapon).
    _aura(keep, x, y, n, slots, corrupt = false) {
        if (!n) return;
        if (corrupt) {   // a corrupted weapon: a dark, unstable aura, flickering green and pink
            const dark = keep(this.add.image(x, y, 'mn_glow').setTint(0x10001a).setDisplaySize(80, 80).setAlpha(0.9).setDepth(this._mode ? 43 : 13));
            const fl = keep(this.add.image(x, y, 'mn_glow').setTint(0x7aff5a).setBlendMode(Phaser.BlendModes.ADD).setDisplaySize(56, 56).setAlpha(0.3).setDepth(this._mode ? 43 : 13));
            this.tweens.add({ targets: fl, alpha: 0.05, duration: 90, yoyo: true, repeat: -1, repeatDelay: 300 });
            this.tweens.add({ targets: dark, scale: dark.scale * 1.15, duration: 700, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
            keep(this.add.particles(0, 0, 'mn_px2', { x: { min: x - 20, max: x + 20 }, y: { min: y - 16, max: y + 16 }, lifespan: 700, speedY: { min: -30, max: -8 },
                scale: { start: 1.4, end: 0 }, alpha: { start: 1, end: 0 }, tint: [0x7aff5a, 0xff3aa0], frequency: 90 }).setDepth(this._mode ? 44 : 14));
            return;
        }
        const D = this._mode ? (this._auraD ?? 43) : 13, full = n >= slots;
        const glow = keep(this.add.image(x, y, 'mn_glow').setTint(n >= 3 ? 0xffd34a : n === 2 ? 0xd8a0ff : 0x9a7aff).setBlendMode(Phaser.BlendModes.ADD).setDisplaySize(40 + n * 14, 40 + n * 14).setAlpha(0.35 + n * 0.12).setDepth(D));
        if (n >= 2 || full) this.tweens.add({ targets: glow, alpha: 0.2, duration: 900, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
        if (n >= 3) {
            const rays = keep(this.add.graphics().setPosition(x, y).setBlendMode(Phaser.BlendModes.ADD).setDepth(D));
            for (let k = 0; k < 8; k++) { const a = k / 8 * Math.PI * 2; rays.fillStyle(0xffe08a, 0.22); rays.fillTriangle(0, 0, Math.cos(a - 0.12) * 34, Math.sin(a - 0.12) * 34, Math.cos(a + 0.12) * 34, Math.sin(a + 0.12) * 34); }
            this.tweens.add({ targets: rays, angle: 360, duration: 7000, repeat: -1 });
        }
    }

    // A book's glow, by quality: a faint one, brighter, then pulsing with sparkles (Pristine),
    // and a prism shimmer at Perfect (the icon's own tint, in _panel).
    _bookGlow(keep, x, y, q, col) {
        const D = this._mode ? (this._auraD ?? 43) : 13;
        if (q < 25) return;
        const gl = keep(this.add.image(x, y, 'mn_glow').setTint(q >= 85 ? 0xffe08a : col).setBlendMode(Phaser.BlendModes.ADD).setDisplaySize(30 + q * 0.4, 30 + q * 0.4).setAlpha(0.15 + q / 220).setDepth(D));
        if (q >= 60) this.tweens.add({ targets: gl, alpha: 0.12, duration: 800 + (100 - q) * 10, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
        if (q >= 85) keep(this.add.particles(0, 0, 'mn_px2', { x: { min: x - 16, max: x + 16 }, y: { min: y - 14, max: y + 14 }, lifespan: 900, speedY: { min: -18, max: -6 },
            scale: { start: 1.2, end: 0 }, alpha: { start: 1, end: 0 }, tint: [0xffffff, 0xffe08a, col], blendMode: 'ADD', frequency: q >= 98 ? 60 : 160 }).setDepth(D + 2));
    }

    // The hover card for a book: everything about it, over the island so it covers nothing.
    _showTip(b, cx, cy, w) {
        this._hideTip();
        const d = Enchants.def(b.id), R = Enchants.RARITY[d.r], gr = Enchants.grade(b.q), D = 50, TW = 300;
        const fit = Enchants.fits(b.id, w.id);
        const lines = [
            [`${d.name} ${Enchants.roman(b.lvl)}`, { fontSize: '16px', fontFamily: UIKit.FONT.title, fontStyle: 'bold', color: UIKit._hex(R.col) }],
            [`${R.name}  ·  ${d.b}${d.b2 ? ' + ' + d.b2 : ''} BUILD`, { fontSize: '10px', fontStyle: 'bold', color: UIKit._hex(R.col) }],
            [`Quality ${b.q}%  ·  ${gr.name}`, { fontSize: '11px', fontStyle: 'bold', color: UIKit._hex(gr.col) }],
            ...Enchants.lines(b).map(l => [l, { fontSize: '12px', color: l.startsWith('CURSE') ? '#ff6a8a' : '#f4e8cc', wordWrap: { width: TW - 24 } }]),
            [`Fits ${Enchants.fitsText(d.id)}.${fit ? '' : `  Not the ${w.name}.`}`, { fontSize: '10px', color: fit ? '#a89370' : '#f0604c', wordWrap: { width: TW - 24 } }],
            [d.r === 5 ? `One per weapon. No combining, no reforging: rewrite a line by sacrificing books.  ·  salvages for ✧${Enchants.salvageValue(b)}` : `Level ${Enchants.roman(b.lvl)} of ${Enchants.roman(d.max)}  ·  salvages for ✧${Enchants.salvageValue(b)}`, { fontSize: '10px', color: '#a89370', wordWrap: { width: TW - 24 } }],
        ];
        const objs = this._tip = [], x = Math.max(16, cx - TW - 12);
        let y = 0;
        const texts = lines.map(([s, st]) => { const t = this.add.text(x + 12, 0, s, Object.assign({ fontFamily: 'monospace' }, st)).setDepth(D + 1); objs.push(t); return t; });
        texts.forEach(t => { t.y = y; y += t.height + 4; });
        const th = y + 16, ty = Math.min(this.scale.height - th - 10, Math.max(10, cy - 10));
        texts.forEach(t => { t.y += ty + 10; });
        const bg = this.add.graphics().setDepth(D);
        bg.fillStyle(0x0d0a14, 0.96); bg.fillRoundedRect(x, ty, TW, th, 8); bg.lineStyle(2, R.col, 0.9); bg.strokeRoundedRect(x, ty, TW, th, 8);
        objs.push(bg);
    }
    _hideTip() { for (const o of (this._tip || [])) o.destroy(); this._tip = null; }

    // ── THE CODEX ─────────────────────────────────────────────────────────────
    // Every book there is, one rarity a page: a card per book (found ones lit, the rest dark),
    // and the chosen one read out on the right, from level I to its top level.
    _codex(page = null, pick = null) {
        this._closeCodex();
        this._hideTip();
        const W = this.scale.width, H = this.scale.height, D = 60, objs = this._codexObjs = [], keep = o => { objs.push(o); return o; };
        const seen = Enchants.seen(), RA = Enchants.RARITY, L = Enchants.LIST;
        page ??= this._codexPage ?? 0; this._codexPage = page;
        const books = L.filter(d => d.r === page), R = RA[page];
        pick = books.find(d => d.id === pick) || books.find(d => seen.has(d.id)) || books[0];
        // the backdrop and the tome's frame
        keep(this.add.rectangle(0, 0, W, H, 0x05030c, 0.88).setOrigin(0).setDepth(D).setInteractive());
        const PX = 70, PY = 60, PW = W - 140, PH = H - 110, g = keep(this.add.graphics().setDepth(D));
        g.fillStyle(0x140e22, 1); g.fillRoundedRect(PX, PY, PW, PH, 12);
        g.fillStyle(0x1c142e, 1); g.fillRoundedRect(PX + 8, PY + 96, PW - 16, PH - 104, 8);
        g.lineStyle(3, 0x9a6aff, 0.9); g.strokeRoundedRect(PX, PY, PW, PH, 12);
        g.lineStyle(1, 0x9a6aff, 0.35); g.strokeRoundedRect(PX + 6, PY + 6, PW - 12, PH - 12, 9);
        keep(this.add.text(PX + 24, PY + 16, 'THE CODEX', { fontSize: '26px', fontFamily: UIKit.FONT.title, fontStyle: 'bold', color: '#e0c8ff' }).setDepth(D + 1));
        keep(this.add.text(PX + 200, PY + 26, `${L.filter(d => seen.has(d.id)).length} of ${L.length} books found`, { fontSize: '12px', fontFamily: 'monospace', color: '#a898c8' }).setDepth(D + 1));
        objs.push(...UIKit.button(this, { x: PX + PW - 40, y: PY + 30, w: 44, h: 32, label: 'X', accent: UIKit.PALETTE.line, depth: D + 2, fontSize: '14px', fireOn: 'down', onClick: () => this._closeCodex() }).objs);
        // the rarity tabs
        const TW = (PW - 48) / RA.length;
        RA.forEach((ra, i) => {
            const x = PX + 24 + i * TW, y = PY + 56, on = i === page, n = L.filter(d => d.r === i), got = n.filter(d => seen.has(d.id)).length;
            const tg = keep(this.add.graphics().setDepth(D + 1));
            tg.fillStyle(on ? ra.col : 0x241a38, on ? 0.28 : 1); tg.fillRoundedRect(x, y, TW - 8, 34, { tl: 8, tr: 8, bl: 0, br: 0 });
            tg.lineStyle(2, ra.col, on ? 1 : 0.4); tg.strokeRoundedRect(x, y, TW - 8, 34, { tl: 8, tr: 8, bl: 0, br: 0 });
            keep(this.add.text(x + (TW - 8) / 2, y + 11, ra.name, { fontSize: '13px', fontFamily: UIKit.FONT.title, fontStyle: 'bold', color: UIKit._hex(on ? ra.col : MenuArt.mix(ra.col, 0x241a38, 0.4)) }).setOrigin(0.5).setDepth(D + 2));
            keep(this.add.text(x + (TW - 8) / 2, y + 26, `${got} / ${n.length}`, { fontSize: '9px', fontFamily: 'monospace', color: on ? '#ffffff' : '#8a7aa8' }).setOrigin(0.5).setDepth(D + 2));
            if (!on) keep(this.add.zone(x, y, TW - 8, 34).setOrigin(0).setInteractive({ useHandCursor: true }).setDepth(D + 3)).on('pointerdown', () => { Sfx.play(this, 'click'); this._codex(i); });
        });
        // the cards
        const GX = PX + 24, GY = PY + 112, GW = PW * 0.56, cols = books.length > 12 ? 5 : 4, CW = (GW - 12 * (cols - 1)) / cols, rows = Math.ceil(books.length / cols);
        const CH = Math.min(138, Math.floor((PH - 152 - 12 * (rows - 1)) / rows)), k2 = CH / 138;   // a big page packs its cards smaller
        const pct = page === 5 ? Enchants.CORRUPT_BASE * 100 : R.w, odds = `${pct}% of pulls (about 1 in ${Math.round(100 / pct).toLocaleString()})`;   // both forms, so Mythic and Corrupted compare at a glance
        keep(this.add.text(GX, PY + PH - 26, `${R.name}: ${odds}`, { fontSize: '11px', fontFamily: 'monospace', color: UIKit._hex(R.col) }).setDepth(D + 1));
        books.forEach((d, k) => {
            const cx = GX + (k % cols) * (CW + 12), cy = GY + Math.floor(k / cols) * (CH + 12), got = seen.has(d.id), sel = d === pick;
            const cg = keep(this.add.graphics().setDepth(D + 1));
            cg.fillStyle(sel ? 0x2e2246 : 0x170f26, 1); cg.fillRoundedRect(cx, cy, CW, CH, 8);
            cg.lineStyle(sel ? 3 : 1.5, got ? R.col : 0x3a2e52, sel ? 1 : 0.7); cg.strokeRoundedRect(cx, cy, CW, CH, 8);
            if (got) { const gl = keep(this.add.image(cx + CW / 2, cy + 50 * k2, 'mn_glow').setTint(R.col).setBlendMode(Phaser.BlendModes.ADD).setDisplaySize(90, 90).setAlpha(sel ? 0.5 : 0.25).setDepth(D + 1)); if (sel) this.tweens.add({ targets: gl, alpha: 0.25, duration: 900, yoyo: true, repeat: -1 }); }
            const ik = ShopScene.bookIcon(this, d.r, d.b, d.id), ic = keep(this.add.sprite(cx + CW / 2, cy + 50 * k2, ik, '0').setScale(2.6 * Math.max(0.75, k2)).setDepth(D + 2));
            if (got) ic.play(ik); else ic.setTint(0x1a1428);
            keep(this.add.text(cx + CW / 2, cy + 92 * k2, got ? d.name : '???', { fontSize: k2 < 0.9 ? '12px' : '14px', fontFamily: UIKit.FONT.title, fontStyle: 'bold', color: got ? '#f4e8cc' : '#5a4e72' }).setOrigin(0.5).setDepth(D + 2));
            keep(this.add.text(cx + CW / 2, cy + CH - 22 * Math.max(0.8, k2), d.b2 ? d.b + '+' + d.b2 : d.b, { fontSize: '10px', fontFamily: 'monospace', fontStyle: 'bold', color: UIKit._hex(got ? Enchants.BUILDS[d.b] : 0x4a3e62),
                backgroundColor: '#0d0a14', padding: { x: 5, y: 2 } }).setOrigin(0.5).setDepth(D + 2));
            keep(this.add.zone(cx, cy, CW, CH).setOrigin(0).setInteractive({ useHandCursor: true }).setDepth(D + 3)).on('pointerdown', () => { if (!sel) { Sfx.play(this, 'hover'); this._codex(page, d.id); } });
        });
        // the chosen book, read out
        const RX = GX + GW + 24, RW = PX + PW - 24 - RX, got = seen.has(pick.id), rg = keep(this.add.graphics().setDepth(D + 1));
        rg.fillStyle(0x0d0a14, 1); rg.fillRoundedRect(RX, GY, RW, PH - 150, 8); rg.lineStyle(2, R.col, 0.6); rg.strokeRoundedRect(RX, GY, RW, PH - 150, 8);
        const ik = ShopScene.bookIcon(this, pick.r, pick.b, pick.id), big = keep(this.add.sprite(RX + 60, GY + 62, ik, '0').setScale(3.6).setDepth(D + 2));
        if (got) big.play(ik); else big.setTint(0x1a1428);
        keep(this.add.text(RX + 116, GY + 30, pick.name, { fontSize: '22px', fontFamily: UIKit.FONT.title, fontStyle: 'bold', color: UIKit._hex(R.col) }).setDepth(D + 2));
        keep(this.add.text(RX + 116, GY + 60, `${pick.b}${pick.b2 ? ' + ' + pick.b2 : ''} BUILD`, { fontSize: '11px', fontFamily: 'monospace', fontStyle: 'bold', color: UIKit._hex(Enchants.BUILDS[pick.b]) }).setDepth(D + 2));
        keep(this.add.text(RX + 116, GY + 78, got ? 'found' : 'not found yet', { fontSize: '11px', fontFamily: 'monospace', color: got ? '#7fd06a' : '#8a7aa8' }).setDepth(D + 2));
        let y = GY + 124;
        const head = s => { keep(this.add.text(RX + 18, y, s, { fontSize: '10px', fontFamily: 'monospace', fontStyle: 'bold', color: '#8a7aa8' }).setDepth(D + 2)); y += 16; };
        const body = (s, col = '#f4e8cc') => { const t = keep(this.add.text(RX + 18, y, s, { fontSize: '13px', fontFamily: 'monospace', color: col, wordWrap: { width: RW - 36 }, lineSpacing: 3 }).setDepth(D + 2)); y += t.height + 12; };
        head(pick.max > 1 ? 'AT LEVEL I' : 'WHAT IT DOES'); body(Enchants._line({ id: pick.id, lvl: 1, q: 50 }));
        if (pick.max > 1) { head(`AT LEVEL ${Enchants.roman(pick.max)} (ITS TOP)`); body(Enchants._line({ id: pick.id, lvl: pick.max, q: 50 })); }
        head('FITS'); body(Enchants.fitsText(pick.id).replace(/^./, c => c.toUpperCase()) + '.', '#d8c8a8');
        if (pick.r === 4) { head('MYTHIC'); body('Comes with 2 more random properties on top.', '#ffb0b0'); }
        if (pick.r === 5) { head('CORRUPTED'); body('Comes with 3 more random properties and a curse. Quality can go past 100%. One per weapon.', '#a8ff90'); }
        keep(this.add.text(RX + 18, GY + PH - 176, 'numbers shown at 50% quality (0% is x0.7, 100% is x1.3)', { fontSize: '9px', fontFamily: 'monospace', color: '#6a5a88', wordWrap: { width: RW - 36 } }).setDepth(D + 2));
    }
    _closeCodex() {
        for (const o of (this._codexObjs || [])) { if (o?.active) this.tweens.killTweensOf(o); o?.destroy?.(); }
        this._codexObjs = null;
    }

    // Salvaging: the book bursts into dust that drifts up.
    _dustBurst(x, y) {
        const p = this.add.particles(0, 0, 'mn_px2', { x, y, lifespan: 900, speed: { min: 40, max: 140 }, angle: { min: 200, max: 340 }, gravityY: 120,
            scale: { start: 1.8, end: 0 }, alpha: { start: 1, end: 0 }, tint: [0xc8b8ff, 0xffffff, 0x9a6aff], blendMode: 'ADD', emitting: false }).setDepth(60);
        p.explode(40);
        this.time.delayedCall(1200, () => p.destroy());
    }
}
