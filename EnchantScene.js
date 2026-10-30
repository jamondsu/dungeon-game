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

    // The island's shape, picked by hand (the art in isle2_rock / isle2_isle is typed to it): how far its rim reaches every
    // 10 degrees round (0 right, 90 toward you; 1 = rx), how deep the rock hangs under each, the lumps hanging under that
    // ([out, angle, rows under the rim, depth, width, lean, swell down its length]), the rivers' mouths (degrees), what
    // stands where ([degrees, out]) and the rocks adrift under it (island pixels).
    static ISLE = { W: 232, H: 200, cx: 116, cy: 58, rx: 100, ry: 30, LIP: 6, UW: 628,
        R: [1, 0.97, 0.93, 0.95, 0.99, 0.92, 0.88, 0.91, 0.97, 1, 1.02, 1.04, 1.07, 1.09, 1.06, 0.99, 0.95, 0.99, 1.02, 1, 0.96, 0.93, 0.95, 0.99, 1.01, 0.98, 0.94, 0.96, 1, 1.03, 1.01, 0.97, 0.95, 0.98, 1.02, 1.03],
        D: [40, 42, 46, 52, 58, 66, 74, 82, 88, 92, 90, 84, 76, 68, 60, 52, 46, 42, 40, 38, 40, 44, 50, 56, 62, 66, 62, 58, 54, 58, 62, 58, 52, 48, 44, 42],
        TEETH: [[0.36, 128, 26, 50, 0.27, 0.1, [1, 1.12, 0.94, 1.08, 0.8, 1]], [0.42, 52, 24, 44, 0.25, 0.08, [1, 0.9, 1.1, 0.96, 1.05, 1]], [0.6, 168, 12, 34, 0.18, 0.14, [1, 1.1, 0.9, 1, 1, 1]],
                [0.58, 14, 14, 38, 0.17, 0.12, [1, 0.92, 1.12, 0.9, 1, 1]], [0.12, 98, 70, 50, 0.14, -0.04, [1, 1.2, 0.9, 1.05, 0.8, 1]], [0.5, 250, 22, 50, 0.24, 0.1, [1, 1.1, 0.9, 1, 1, 1]], [0.5, 300, 20, 44, 0.22, 0.1, [1, 0.9, 1.1, 1, 1, 1]]],
        MOUTHS: [74, 150],
        PLACES: { reforge: [0, 0.7], reseal: [72, 0.66], garden: [144, 0.72], bind: [216, 0.68], combine: [288, 0.68] },
        LIGHT: { bind: 0x6ad86a, reforge: 0xb07aff, combine: 0xffd060, reseal: 0x7ad8ff, garden: 0x8affd8 }, FRAMES: { bind: 6, reforge: 4, combine: 2, reseal: 4, garden: 3 },
        PILLARS: [[205, 0.36, 20], [335, 0.36, 20], [160, 0.42, 26], [20, 0.42, 26]],
        BITS: [[20, 0.5, 'tuft'], [36, 0.86, 'flower'], [64, 0.5, 'tuft2'], [100, 0.6, 'bush'], [112, 0.88, 'tuft'], [128, 0.4, 'stone'], [160, 0.5, 'tuft2'], [178, 0.86, 'bush'], [196, 0.62, 'flower'], [236, 0.5, 'tuft'],
               [252, 0.86, 'stone'], [266, 0.6, 'tuft2'], [304, 0.62, 'flower'], [318, 0.86, 'tuft'], [340, 0.55, 'bush'], [350, 0.86, 'tuft2'], [84, 0.84, 'tuft'], [140, 0.72, 'flower'], [6, 0.72, 'stone'], [46, 0.64, 'tuft']],
        FLOATERS: [[30, 112, 'c'], [194, 118, 'a'], [52, 140, 'b'], [176, 150, 'b'], [212, 104, 'b'], [70, 162, 'a']],
        CLOUDS: [[10, 58, 'mid_mid'], [228, 72, 'wisp_mid'], [350, 60, 'mid_mid'], [118, 30, 'wisp_mid'], [-20, 150, 'mid_near'], [372, 148, 'wisp_near']] };
    static BAYER = [[0, 8, 2, 10], [12, 4, 14, 6], [3, 11, 1, 9], [15, 7, 13, 5]];
    static lerpList(L, deg) { const n = L.length, f = ((deg % 360) + 360) % 360 / (360 / n), i = Math.floor(f), t = f - i; return L[i] * (1 - t) + L[(i + 1) % n] * t; }

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
        this._panelIntro = false; this._cruBoost = null; this._altarWeapon = null; this._wipe = null;
        // the typed moving bits (isle_fx): a twinkle, a firefly, a candle's flame, a ripple
        for (const [key, pre, rate, repeat, yoyo] of [['isle_spark', 'spark', 14, 0, false], ['isle_fly', 'fly', 5, -1, true], ['isle_flame', 'flame', 8, -1, false], ['isle_rip', 'rip', 7, 0, false]])
            if (!this.anims.exists(key)) this.anims.create({ key, frames: this.anims.generateFrameNames('isle_fx', { prefix: pre, start: 0, end: 3 }), frameRate: rate, repeat, yoyo });
        if (!this.anims.exists('isle_twinkle')) this.anims.create({ key: 'isle_twinkle', frames: ['spark0', 'spark1', 'spark2', 'spark1', 'spark0', 'spark3'].map(frame => ({ key: 'isle_fx', frame })), frameRate: 10, repeat: -1 });
        this._paintWorld(W, H);
        this._cz = { t: 0 }; this._spin = 0; this._closeObjs = null;
        this._minis();
        this._stations();
        this._panel();
        this.input.keyboard.on('keydown-ESC', () => { if (this._codexObjs) { this._closeCodex(); return; } if (this._confirmObjs) { this._closeConfirm(); return; } if (this._enchFx || this._busy) return; if (this._pickObjs) { this._closePicker(); return; } if (this._mode) { this._leaveRoom(); return; } if (this._cz.t > 0) { this._closeUp(false); return; } this._leave(); });
        this.cameras.main.fadeIn(400, 5, 3, 12);
    }

    update(t) { for (const f of this._ticks) f(t); }

    // A burst of light over everything, in a colour, that fades (a camera flash paints the whole screen solid for a frame)
    _flash(col, a = 0.5, ms = 260) {
        const W = this.scale.width, H = this.scale.height;
        const r = this.add.rectangle(W / 2, H / 2, W * 3, H * 3, col, 1).setDepth(150).setAlpha(a).setScrollFactor(0).setBlendMode(Phaser.BlendModes.ADD);
        this.tweens.add({ targets: r, alpha: 0, duration: ms, ease: 'Quad.easeOut', onComplete: () => r.destroy() });
    }
    // Typed twinkles (isle_fx spark0-3) thrown out from x, y: n of them, tinted, with o's emitter settings over the defaults
    _sparks(x, y, tint, n, D, o = {}) {
        const p = this.add.particles(0, 0, 'isle_fx', Object.assign({ frame: 'spark0', anim: 'isle_spark', x, y, lifespan: 700, speed: { min: 60, max: 220 }, gravityY: 140,
            scale: { start: 3, end: 2 }, tint, blendMode: 'ADD', emitting: false }, o)).setDepth(D);
        p.explode(n);
        this.time.delayedCall((o.lifespan || 700) + 200, () => p.destroy());
        return p;
    }

    // ── THE BOARD'S PIECES (isle2_ui, typed, 2x) ───────────────────────────────
    // a nine-sliced piece at (x, y), w x h on screen: 'board' (a panel bound in gold), 'board_s' (a small one: cards, the
    // tooltip), 'board_d' (the same, darker inside), 'rim_s' (a white rim to tint over a card), 'inset' (a dark recess)
    _ns(x, y, w, h, kind, D) {
        const m = { board: 16, board_s: 8, board_d: 8, rim_s: 8, inset: 4 }[kind];
        return this.add.nineslice(x, y, 'isle2_ui', kind, Math.max(m * 2, Math.round(w / 2)), Math.max(m * 2, Math.round(h / 2)), m, m, m, m).setOrigin(0).setScale(2).setDepth(D);
    }
    // a gold rule across, a jewel in its middle (its stone in col)
    _rule(keep, x, y, w, D, col = 0x9a6aff) {
        keep(this.add.nineslice(x, y, 'isle2_ui', 'rule', Math.round(w / 2), 2, 1, 1).setOrigin(0, 0.5).setScale(2).setDepth(D));
        keep(this.add.image(x + w / 2, y, 'isle2_ui', 'jewel').setScale(2).setTint(MenuArt.mix(col, 0xffffff, 0.3)).setDepth(D));
    }
    // a tab: its cloth (tinted) in a gold mount, a gem at its left
    _tab(keep, x, y, w, h, col, on, D) {
        const fill = keep(this.add.nineslice(x, y, 'isle2_ui', 'tab_fill', Math.round(w / 2), Math.round(h / 2), 5, 5, 4, 4).setOrigin(0).setScale(2).setTint(on ? MenuArt.mix(col, 0x0c0918, 0.5) : 0x221a3c).setDepth(D));
        const rim = keep(this.add.nineslice(x, y, 'isle2_ui', 'tab_rim', Math.round(w / 2), Math.round(h / 2), 5, 5, 4, 4).setOrigin(0).setScale(2).setAlpha(on ? 1 : 0.7).setDepth(D));
        const gem = keep(this.add.image(x + 14, y + h / 2, 'isle2_ui', 'gem').setScale(2).setTint(on ? 0xffffff : MenuArt.mix(col, 0x2a2246, 0.3)).setDepth(D));
        return [fill, rim, gem];
    }
    // a button: a stone plate (its face in the colour of what it does) in a gold rim; grey (P.line) is a button that can't yet
    _btn(o) {
        const D = o.depth ?? 21, off = o.accent === UIKit.PALETTE.line, col = off ? 0x4a4468 : (o.accent ?? 0x9a6aff), w = Math.round(o.w / 2), h = Math.max(10, Math.round(o.h / 2));
        const dim = MenuArt.mix(col, 0x0c0918, off ? 0.5 : 0.42), lit = MenuArt.mix(col, 0x0c0918, off ? 0.4 : 0.22);
        const fill = this.add.nineslice(o.x, o.y, 'isle2_ui', 'btn_fill', w, h, 7, 7, 5, 5).setScale(2).setTint(dim).setDepth(D);
        const rim = this.add.nineslice(o.x, o.y, 'isle2_ui', 'btn_rim', w, h, 7, 7, 5, 5).setScale(2).setAlpha(off ? 0.55 : 1).setDepth(D);
        const t = this.add.text(o.x, o.y, o.label, { fontSize: o.fontSize || '14px', fontFamily: UIKit.FONT.title, fontStyle: 'bold', color: off ? '#9a90b8' : '#fff6e0', stroke: '#0a0618', strokeThickness: 3 }).setOrigin(0.5).setDepth(D + 0.1);
        const z = this.add.zone(o.x, o.y, o.w, o.h).setInteractive({ useHandCursor: true }).setDepth(D + 0.2), all = [fill, rim, t];
        const at = dy => all.forEach(q => { if (q.active) q.y = o.y + dy; });
        z.on('pointerover', () => { fill.setTint(lit); Sfx.play(this, 'hover'); });
        z.on('pointerout', () => { fill.setTint(dim); at(0); });
        z.on('pointerdown', () => { at(2); Sfx.play(this, 'click'); if (o.fireOn !== 'up') { this.time.delayedCall(80, () => at(0)); o.onClick?.(); } });
        z.on('pointerup', () => { at(0); if (o.fireOn === 'up') o.onClick?.(); });
        return { objs: [...all, z] };
    }
    // a ring wave (typed: isle2_fx ring0-3) going out from (x, y) in col: it steps up through the typed sizes as it fades
    _ring(x, y, col, D, { ms = 520, scale = 3, from = 0, to = 3, alpha = 1 } = {}) {
        const r = this.add.image(x, y, 'isle2_fx', 'ring' + from).setScale(scale).setTint(col).setBlendMode(Phaser.BlendModes.ADD).setDepth(D).setAlpha(alpha);
        this.tweens.addCounter({ from, to: to + 0.99, duration: ms, onUpdate: tw => { if (r.active) r.setFrame('ring' + Math.floor(tw.getValue())); }, onComplete: () => r.destroy() });
        this.tweens.add({ targets: r, alpha: 0, delay: ms * 0.45, duration: ms * 0.55 });
        return r;
    }
    // runes (typed: isle2_fx glyph0-5) thrown out from (x, y)
    _glyphs(x, y, tint, n, D, o = {}) {
        const p = this.add.particles(0, 0, 'isle2_fx', Object.assign({ frame: ['glyph0', 'glyph1', 'glyph2', 'glyph3', 'glyph4', 'glyph5'], x, y, lifespan: 900, speed: { min: 50, max: 160 }, gravityY: -20,
            scale: 3, alpha: { start: 1, end: 0 }, tint, blendMode: 'ADD', emitting: false }, o)).setDepth(D);
        p.explode(n);
        this.time.delayedCall((o.lifespan || 900) + 200, () => p.destroy());
        return p;
    }

    _leave() {
        if (this._leaving) return;
        this._leaving = true;
        this.cameras.main.fadeOut(300, 5, 3, 12);
        this.time.delayedCall(320, () => this.scene.start('LevelSelect'));
    }

    // ── THE ISLE ──────────────────────────────────────────────────────────────
    // The night (isle2_night, typed, 3x) and its clouds drifting by; the island, drawn live from its typed rock and top as
    // it turns (_isleDraw), its falls, the rocks adrift under it, and what stands on it.
    _paintWorld(W, H) {
        const AW = W, G = EnchantScene.ISLE, S = 3, nx = Math.round((W - 1284) / 2), ny = Math.round(H * 0.6917) - 498;
        this.add.rectangle(0, 0, W, H, 0x07061a).setOrigin(0).setDepth(0);
        this.add.rectangle(0, ny + 498, W, H, 0x0a0822).setOrigin(0).setDepth(0);
        const night = this._night = this.add.container(0, 0).setDepth(0);
        night.add(this.add.image(nx, ny, 'isle2_night').setOrigin(0).setScale(3));
        if (nx > 0) for (const s of [-1, 1]) night.add(this.add.image(s < 0 ? nx : nx + 1284, ny, 'isle2_night').setOrigin(s < 0 ? 1 : 0, 0).setScale(3).setFlipX(true));   // a window wider than the night: it carries on, mirrored
        night.add(this.add.image(nx + 341 * 3, ny + 33 * 3, 'mn_glow').setTint(0x6a5ab0).setBlendMode(Phaser.BlendModes.ADD).setDisplaySize(300, 300).setAlpha(0.35));
        // the clouds drift left, a pixel of the night at a time, the near ones faster
        const clouds = G.CLOUDS.map(([x, y, f]) => ({ img: this.add.image(nx + x * 3, ny + y * 3, 'isle2_clouds', f).setOrigin(0).setScale(3).setDepth(f.endsWith('near') ? 2.9 : 0.5), x: nx + x * 3, v: f.endsWith('near') ? 9 : 4 }));
        let ct = 0;
        this._ticks.push(t => { const dt = ct ? Math.min(50, t - ct) : 0; ct = t;
            for (const c of clouds) { c.x -= c.v * dt / 1000; if (c.x < -c.img.displayWidth) c.x = W + 10; c.img.x = Math.round(c.x / 3) * 3; } });
        // stars twinkling, glints running on the moon's road
        const tw = this.add.graphics().setDepth(1), roadX = nx + 341 * 3;
        const stars = Array.from({ length: 22 }, () => ({ x: Math.round(Math.random() * AW / 3) * 3, y: Math.round(Math.random() * (ny + 380) / 3) * 3, p: Math.random() * 6 }));
        const glints = Array.from({ length: 16 }, (_, i) => { const y = ny + 506 + Math.pow(i / 16, 1.3) * (H - ny - 506); return { x: roadX + (Math.random() - 0.5) * (20 + (y - ny - 500) * 0.5), y: Math.round(y / 3) * 3, p: Math.random() * 6, l: 6 + i }; });
        this._ticks.push(t => { tw.clear();
            for (const s of stars) { const a = Math.max(0, Math.sin(t * 0.002 + s.p)); if (a > 0.6) { tw.fillStyle(0xffffff, a); tw.fillRect(s.x, s.y, 3, 3); } }
            for (const g of glints) { const a = Math.max(0, Math.sin(t * 0.0016 + g.p)); if (a > 0.3) { tw.fillStyle(0xe8e0ff, a * 0.8); tw.fillRect(Math.round((g.x + Math.sin(t * 0.0005 + g.p) * 6) / 3) * 3, g.y, Math.round(g.l * a / 3) * 3, 3); } } });
        // the island, floating; its light on the water under it
        const ix = Math.max(Math.round(AW / 2 - G.W * S / 2), 252), iy = Math.round(H * 0.083);   // (on a narrow window it moves right, clear of the station cards)
        this.add.image(ix + G.W * S / 2, ny + 560, 'mn_glow').setTint(0x5a3ab0).setBlendMode(Phaser.BlendModes.ADD).setDisplaySize(720, 140).setAlpha(0.22).setDepth(1);
        const land = this._land = this.add.container(0, 0).setDepth(2);
        this._isleGeo = { ix, iy, S, cx: G.cx, top: G.cy, rx: G.rx, ry: G.ry };
        if (!this.anims.exists('isle2_fall')) this.anims.create({ key: 'isle2_fall', frames: [0, 1, 2, 3].map(i => ({ key: 'isle2_isle', frame: 'fall_' + i })), frameRate: 9, repeat: -1 });
        this._falls = G.MOUTHS.map(() => ({ back: this.add.sprite(0, 0, 'isle2_isle', 'fall_0').setOrigin(8 / 17, 0).setScale(S).play('isle2_fall'), front: this.add.sprite(0, 0, 'isle2_isle', 'fall_0').setOrigin(8 / 17, 0).setScale(S).play('isle2_fall') }));
        land.add(this._falls.map(f => f.back));
        this._isleSetup();
        land.add(this.add.image(ix, iy, 'isle2_view').setOrigin(0).setScale(S));
        land.add(this._falls.map(f => f.front));
        for (const [x, y, k] of G.FLOATERS) {   // rocks adrift under it, each bobbing on its own
            const f = this.add.image(ix + x * S, iy + y * S, 'isle2_isle', 'float_' + k).setOrigin(0).setScale(S); land.add(f);
            this.tweens.add({ targets: f, y: f.y - 3 * S, duration: 1700 + Math.random() * 1400, yoyo: true, repeat: -1, ease: 'Sine.easeInOut', delay: Math.random() * 1000 });
        }
        this._spinSetup(land);
        this._isleDraw(0);
        this._landFloat = this.tweens.add({ targets: land, y: -6, duration: 2600, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });

        // the altar, live: its rune ring breathing, motes rising, the sealed book turning over the pedestal
        const ax = ix + G.cx * S, ay = iy + 55 * S;
        this._altar = { x: ax, y: ay };
        const rune = this.add.image(ax, ay, 'mn_glow').setTint(0x9a6aff).setBlendMode(Phaser.BlendModes.ADD).setDisplaySize(170, 44).setAlpha(0.35);
        rune._z = iy + (G.cy + 6) * S + 0.5; this._bb.add(rune);
        this.tweens.add({ targets: rune, alpha: 0.15, duration: 1500, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
        land.add(this.add.particles(0, 0, 'mn_px2', { x: { min: ax - 70, max: ax + 70 }, y: { min: ay - 10, max: ay + 14 }, lifespan: 2600,
            speedY: { min: -30, max: -12 }, speedX: { min: -5, max: 5 }, scale: { start: 1.4, end: 0 }, alpha: { start: 0.8, end: 0 }, tint: [0xd8b8ff, 0x9a6aff, 0xffffff], blendMode: 'ADD', frequency: 80 }).setDepth(3.2));
        const by = iy + 30 * S, halo = this.add.image(ax, by, 'mn_glow').setTint(0xc8a0ff).setBlendMode(Phaser.BlendModes.ADD).setDisplaySize(110, 110).setAlpha(0.6);
        const bk0 = ShopScene.bookIcon(this, -1), book = this.add.sprite(ax, by, bk0, '0').setScale(2.2);
        if (this.anims.exists(bk0)) book.play(bk0);
        halo._z = book._z = iy + (G.cy + 6) * S + 1; this._bb.add([halo, book]);
        this.tweens.add({ targets: [book, halo], y: '-=9', duration: 1300, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
        this.tweens.add({ targets: halo, alpha: 0.35, duration: 1900, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
        land.add(this.add.particles(0, 0, 'isle_fx', { frame: 'fly0', anim: 'isle_fly', x: { min: ax - 260, max: ax + 260 }, y: { min: ay - 60, max: ay + 50 }, lifespan: 4200,
            speedX: { min: -10, max: 10 }, speedY: { min: -12, max: 2 }, scale: 3, alpha: { onUpdate: (p, k, t) => Math.min(1, Math.sin(t * Math.PI) * 2.5) }, frequency: 650 }).setDepth(3.25));
        this._altarBook = book; this._altarHalo = halo;

        // the way back, and the place's name
        this._btn({ x: 90, y: 34, w: 140, h: 34, label: '◂ MAP', accent: UIKit.PALETTE.line, depth: 20, fontSize: '13px', fireOn: 'down', onClick: () => { if (!this._mode && !this._roomBusy && !this._cz.t && !this._busy) this._leave(); } });   // never from inside a room (its own back button sits right over this one)
        this._btn({ x: AW - 90, y: 34, w: 140, h: 34, label: 'CODEX', accent: 0x9a6aff, depth: 20, fontSize: '13px', fireOn: 'down', onClick: () => { if (!this._busy) this._codex(); } });
        this._title = this.add.text(AW / 2, 30, "THE ENCHANTER'S ISLE", { fontSize: '26px', fontFamily: UIKit.FONT.title, fontStyle: 'bold', color: '#e0c8ff', stroke: '#0a0618', strokeThickness: 5 }).setOrigin(0.5).setDepth(20);

        // the altar's buttons, on the water under the island
        this._altarUI = [];
        this._drawAltarUI();
    }

    // ── THE TURNING ISLAND ───────────────────────────────────────────────────
    // Up close the island turns. Its rock is swept round from the hand-picked rim and depths, each pixel the nearest of what
    // lands there, its stone taken from the band typed all round it (isle2_rock, one copy per light: the moon is to the right
    // and in front, so a face takes the light it turns into); the top at rest (isle2_isle top) is turned onto it; the falls
    // pour in front or behind; what stands on it is placed where the turn carries it and sorted front to back.
    _isleSetup() {
        const G = EnchantScene.ISLE, T = this.textures;
        const read = (key, frame) => { const f = T.getFrame(key, frame), cv = document.createElement('canvas'); cv.width = f.cutWidth; cv.height = f.cutHeight;
            const c = cv.getContext('2d'); c.drawImage(f.source.image, f.cutX, f.cutY, f.cutWidth, f.cutHeight, 0, 0, f.cutWidth, f.cutHeight);
            return new Uint32Array(c.getImageData(0, 0, f.cutWidth, f.cutHeight).data.buffer); };
        const tex = T.exists('isle2_view') ? T.get('isle2_view') : T.createCanvas('isle2_view', G.W, G.H), img = tex.getContext().createImageData(G.W, G.H);
        this._rk = { lv: ['lit', 'mid', 'dark', 'deep'].map(k => read('isle2_rock', k)), top: read('isle2_isle', 'top'), tex, img, px: new Uint32Array(img.data.buffer), Z: new Float32Array(G.W * G.H), A: null };
    }
    _isleDraw(A) {
        const K = this._rk; if (!K || K.A === A) return; K.A = A;
        const G = EnchantScene.ISLE, { W, H, cx, cy, rx, ry, LIP, UW } = G, px = K.px, Z = K.Z, lv = K.lv, VH = 146, BY = EnchantScene.BAYER, L2 = EnchantScene.lerpList;
        px.fill(0); Z.fill(-1e9);
        const shade = (L) => L > 0.5 ? 0 : L > -0.05 ? 1 : L > -0.55 ? 2 : 3;
        const shrink = t => t < 0.06 ? 1 : Math.pow(1 - Math.pow((t - 0.06) / 0.94, 1.25), 0.85), taper = t => Math.pow(1 - t, 1.1) * (t < 0.15 ? 0.85 + t : 1);
        for (let s = 0; s < 1440; s++) {   // the rock under the rim
            const d = s / 4, r0 = L2(G.R, d), D = Math.round(L2(G.D, d)), a = (d + A) * Math.PI / 180, ca = Math.cos(a), sa = Math.sin(a);
            if (sa < -0.25) continue;
            const u = Math.round(d / 360 * UW) % UW, light = Math.cos(a - 0.7);
            for (let j = 0; j <= D; j++) {
                const t = j / D, r = r0 * shrink(t), x = Math.round(cx + r * rx * ca), y = Math.round(cy + r * ry * sa + j), z = r * sa;
                if (x < 0 || y < 0 || x >= W || y >= H) continue;
                const i = y * W + x; if (z <= Z[i]) continue; Z[i] = z;
                const L = light + BY[y & 3][x & 3] / 16 * 0.3 - 0.15 - (t > 0.45 ? (t - 0.45) * 1.6 : 0) - (j >= LIP && j < LIP + 3 ? 0.5 : 0);
                px[i] = lv[shade(L)][Math.min(VH - 1, j) * UW + u];
            }
        }
        G.TEETH.forEach(([rho, phi, v0, dep, mw, lean, wob], ti) => {   // the lumps hanging under it, each round its own axis
            const pa = (phi + A) * Math.PI / 180, X = cx + rho * rx * Math.cos(pa), Yc = cy + rho * ry * Math.sin(pa), Zc = rho * Math.sin(pa), cpa = Math.cos(pa);
            for (let s2 = 0; s2 < 360; s2++) {
                const ps = s2 * Math.PI / 180, cp = Math.cos(ps), sp = Math.sin(ps); if (sp < -0.3) continue;
                const u = ((Math.round(ti * 97 + (s2 - A) / 360 * 2 * Math.PI * mw * rx) % UW) + UW) % UW, light = Math.cos(ps - 0.7);
                for (let j = 0; j <= dep; j++) {
                    const t = j / dep, w = mw * taper(t) * L2(wob, t * 300), x = Math.round(X + (w * cp + lean * t * cpa) * rx), y = Math.round(Yc + v0 + j + w * ry * sp), z = Zc + w * sp;
                    if (x < 0 || y < 0 || x >= W || y >= H) continue;
                    const i = y * W + x; if (z <= Z[i]) continue; Z[i] = z;
                    px[i] = lv[shade(light + BY[y & 3][x & 3] / 16 * 0.3 - 0.3 - t * 0.7)][Math.min(VH - 1, v0 + j) * UW + u];
                }
            }
        });
        const cA = Math.cos(A * Math.PI / 180), sA = Math.sin(A * Math.PI / 180), top = K.top;   // the top, turned
        for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
            const u = (x + 0.5 - cx) / rx, v = (y + 0.5 - cy) / ry, tx = Math.floor(cx + (u * cA + v * sA) * rx), ty = Math.floor(cy + (v * cA - u * sA) * ry);
            if (tx < 0 || ty < 0 || tx >= W || ty >= H) continue;
            const c = top[ty * W + tx]; if (c >>> 24) px[y * W + x] = c;
        }
        const on = (x, y) => x >= 0 && y >= 0 && x < W && y < H && (px[y * W + x] >>> 24) === 255, ol = [];   // its outline where rock meets the sky below or away from the moon
        for (let y = cy + 1; y < H; y++) for (let x = 0; x < W; x++) if (on(x, y) && (!on(x, y + 1) || !on(x - 1, y) || (!on(x + 1, y) && y > cy + 30))) ol.push(y * W + x);
        for (const i of ol) px[i] = 0xff1c0b0e;
        K.tex.getContext().putImageData(K.img, 0, 0); K.tex.refresh();
        const { ix, iy, S } = this._isleGeo;   // the falls, at their mouths as the island has turned: in front, or behind it
        G.MOUTHS.forEach((d, k) => { const a = (d + A) * Math.PI / 180, r = L2(G.R, d) * 0.98, x = ix + Math.round(cx + r * rx * Math.cos(a)) * S, y = iy + Math.round(cy + r * ry * Math.sin(a)) * S, front = Math.sin(a) > 0.08, F = this._falls[k];
            F.front.setPosition(x, y).setVisible(front); F.back.setPosition(x, y).setVisible(!front); });
    }
    _spinSetup(land) {
        const G = EnchantScene.ISLE, { ix, iy, S, cx, top, rx, ry } = this._isleGeo;
        this._spinA = 0;
        this._spinDraw = () => this._isleDraw(Math.round((this._spinA || 0) * 2) / 2);   // (to half a degree: a still island isn't redrawn)
        // a point on the island's top (its own pixels), turned with it
        this._spinPt = (x, y, A = this._spinA) => {
            if (!A) return [x, y];
            const u = (x - cx) / rx, v = (y - top) / ry, t = A * Math.PI / 180, c = Math.cos(t), sn = Math.sin(t);
            return [cx + (u * c - v * sn) * rx, top + (u * sn + v * c) * ry];
        };
        // what stands on it: the dais (it stays put), the crystal pillars and the turf's bits (each upright, carried round)
        const B = this._bb = this.add.container(0, 0);
        land.add(B);
        const dais = this.add.image(ix + (cx - 25) * S, iy + (top - 23) * S, 'isle2_isle', 'dais').setOrigin(0).setScale(S);
        dais._z = iy + (top + 6) * S; B.add(dais);
        const at = (deg, rho) => [cx + Math.cos(deg * Math.PI / 180) * rx * rho, top + Math.sin(deg * Math.PI / 180) * ry * rho];
        this._pillars = G.PILLARS.map(([deg, rho, ph]) => {
            const [px, py] = at(deg, rho), spr = this.add.image(0, 0, 'isle_pillar_' + ph).setOrigin(0.5, 1).setScale(S);
            const gl = this.add.image(0, 0, 'mn_glow').setTint(0xa070ff).setBlendMode(Phaser.BlendModes.ADD).setDisplaySize(90 * ph / 22, 90 * ph / 22).setAlpha(0.5);
            this.tweens.add({ targets: gl, alpha: 0.2, duration: 1400 + Math.random() * 800, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
            B.add([gl, spr]);
            return { px, py, spr, gl };
        });
        this._bits = G.BITS.map(([deg, rho, k]) => { const [px, py] = at(deg, rho), spr = this.add.image(0, 0, 'isle2_isle', 'bit_' + k).setOrigin(0.5, 1).setScale(S); B.add(spr); return { px, py, spr }; });
        this._placeBillboards = () => {
            for (const p of this._pillars) {
                const [x, y] = this._spinPt(p.px, p.py);
                p.spr.setPosition(ix + Math.round(x) * S, iy + Math.round(y + 1) * S); p.spr._z = p.spr.y;
                p.gl.setPosition(p.spr.x, p.spr.y - 5 * S); p.gl._z = p.spr._z - 0.01;
            }
            for (const b of this._bits) { const [x, y] = this._spinPt(b.px, b.py); b.spr.setPosition(ix + Math.round(x) * S, iy + Math.round(y + 1) * S); b.spr._z = b.spr.y - 0.5; }
        };
        this._placeBillboards();
    }
    // ── THE ALTAR'S BUTTONS ───────────────────────────────────────────────────
    _drawAltarUI(slide = false) {
        for (const o of this._altarUI) { if (o?.active) this.tweens.killTweensOf(o); o.destroy?.(); }
        this._altarUI = [];
        if (this._cz?.t > 0 || this._closing) return;   // up close the plate has stepped aside (it comes back with the stations)
        const keep = o => { this._altarUI.push(o); return o; };
        const AW = this.scale.width, H = this.scale.height, y = H - 92, P = UIKit.PALETTE;
        const books = Enchants.books(), dust = Enchants.dust(), pity = Enchants.pity(), U = Enchants.UNSEAL;
        // nothing to unseal: the book over the altar goes dark and its light goes out
        if (this._altarBook) { if (books) this._altarBook.clearTint(); else this._altarBook.setTint(0x2e2a3a); this._altarHalo.setVisible(books > 0); }
        // the plate: the board (isle2_ui board, nine-sliced at 2x)
        keep(this._ns(AW / 2 - 300, y - 44, 600, 120, 'board', 19));

        keep(this.add.image(AW / 2 - 270, y - 18, ShopScene.bookIcon(this, -1), '0').setScale(1.4).setDepth(20));
        keep(this.add.text(AW / 2 - 246, y - 30, `${books} sealed`, { fontSize: '15px', fontFamily: UIKit.FONT.title, fontStyle: 'bold', color: '#f4e8cc' }).setDepth(20));
        keep(this.add.text(AW / 2 - 246, y - 10, `✧ ${dust} dust`, { fontSize: '13px', fontFamily: 'monospace', fontStyle: 'bold', color: '#c8b8ff' }).setDepth(20));
        keep(this.add.text(AW / 2 + 280, y - 30, `Epic+ within ${Enchants.PITY_EPIC - pity.e}\nLegendary+ within ${Enchants.PITY_LEG - pity.l}`, { fontSize: '12px', fontFamily: 'monospace', color: UIKit.CSS.textMid, align: 'right', lineSpacing: 2 }).setOrigin(1, 0).setDepth(20));
        const can = k => books >= k && dust >= U * k;
        const go = k => {
            if (this._busy) return;
            if (!books) { Sfx.play(this, 'deny'); this._say('No sealed books. The Tower drops them.'); return; }
            const n = Math.min(k, books, Math.floor(dust / U));
            if (n < 1) { Sfx.play(this, 'deny'); this._say(`Unsealing takes ✧${U} dust. Salvage books you don't want, or climb the Tower.`); return; }
            this._unseal(n);
        };
        this._btn({ x: AW / 2 - 110, y: y + 40, w: 200, h: 44, label: `UNSEAL  ·  ✧${U}`, accent: can(1) ? 0x9a6aff : P.line, depth: 21, fontSize: '15px', fireOn: 'down', onClick: () => go(1) }).objs.forEach(keep);
        this._btn({ x: AW / 2 + 110, y: y + 40, w: 200, h: 44, label: `UNSEAL 10  ·  ✧${U * 10}`, accent: can(2) ? P.accentGold : P.line, depth: 21, fontSize: '15px', fireOn: 'down', onClick: () => go(10) }).objs.forEach(keep);
        if (slide) this._slideIn(this._altarUI, 0, 150, 0);   // back from up close: it rises into place
    }
    // A group of UI pieces sliding in from (dx, dy) away, fading up, each delay ms after the last group; and away again
    _slideIn(objs, dx, dy, delay, ms = 380, fade = true) {
        for (const o of objs) {
            if (!o?.active || o.x === undefined) continue;
            const x = o.x, y = o.y, a = o.alpha ?? 1, to = {};
            if (dx) to.x = x; if (dy) to.y = y;   // (only what moves: a bobbing book keeps its own y)
            o.setPosition(x + dx, y + dy);
            if (fade && !this.tweens.getTweensOf(o).length) { o.setAlpha?.(0); to.alpha = a; }   // (one already breathing keeps its own light)
            this.tweens.add({ targets: o, ...to, delay, duration: ms, ease: 'Cubic.easeOut' });
        }
    }
    _slideOut(objs, dx, dy, ms = 260, then) {
        const live = objs.filter(o => o?.active && o.x !== undefined);
        for (const o of live) { this.tweens.killTweensOf(o); if (o.input) o.disableInteractive(); }
        if (!live.length) { then?.(); return; }
        this.tweens.add({ targets: live, x: `+=${dx}`, y: `+=${dy}`, alpha: 0, duration: ms, ease: 'Cubic.easeIn', onComplete: () => { live.forEach(o => o.destroy()); then?.(); } });
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
            this._ring(bx, by, c, D + 2, { ms: 520, scale: 2 + i });   // (typed: isle2_fx ring0-3)
            this.tweens.add({ targets: bk, scale: bk.scale * (1.08 + i * 0.04), duration: 80, yoyo: true });
            halo.setTint(c); this.tweens.add({ targets: halo, alpha: 0.5 + v * 0.4, displayWidth: 60 + v * 90, displayHeight: 60 + v * 90, duration: 120, ease: 'Quad.easeOut' });
            for (const P of paths) for (let k = 0; k < 2; k++) { const [x, y] = P.pts[P.pts.length - 1], a = P.a + (CR() - 0.5) * 1.1, len = 5 + CR() * 6; P.pts.push([x + Math.cos(a) * len, y + Math.sin(a) * len * 0.8]); }
            cracks.clear();
            for (const P of paths) for (let k = 1; k < P.pts.length; k++) { cracks.lineStyle(6, c, 0.45); cracks.lineBetween(bx + P.pts[k - 1][0], by + P.pts[k - 1][1], bx + P.pts[k][0], by + P.pts[k][1]); cracks.lineStyle(2.5, 0xffffff, 1); cracks.lineBetween(bx + P.pts[k - 1][0], by + P.pts[k - 1][1], bx + P.pts[k][0], by + P.pts[k][1]); }
            if (last && best >= 2) { Sfx.play(this, 'e_thunder'); this._bolt(bx, by, col, D + 4); this._flash(col, 0.35, 180); }
        }));
        this.time.delayedCall(build, () => cracks.destroy());
        const go = () => {
            // 1. it strains: two chains crossed over it and a padlock where they meet; the book shakes
            // against them, the links heat from grey to white, the circle on the dais flares
            const bx0 = bk.x;   // it strains side to side against the chains (never tilted)
            this.tweens.addCounter({ from: 0, to: 1, duration: 840, onUpdate: tw => { if (bk.active) bk.x = bx0 + Math.round((Math.random() - 0.5) * 6 * (0.4 + tw.getValue())); }, onComplete: () => bk.active && bk.setX(bx0) });
            const links = [];
            for (const s2 of [-1, 1]) for (let k = -5; k <= 5; k++) {
                if (k === 0) continue;   // the lock sits there
                const l = keep(this.add.image(bx + k * 6, by + s2 * k * 6, 'isle_fx', k % 2 ? 'link_e' : 'link_d').setScale(2).setDepth(D + 1).setFlipX(s2 > 0));   // typed diagonal links, the X at 45 degrees
                l._k = k; l._s = s2; l._x0 = l.x; l._y0 = l.y; links.push(l);
            }
            const lock = keep(this.add.image(bx, by + 2, this._lockTex()).setScale(2.4).setDepth(D + 2));
            const heat = { v: 0 };
            this.tweens.add({ targets: heat, v: 1, duration: 560, ease: 'Quad.easeIn', onUpdate: () => {
                const v = heat.v, c = Phaser.Display.Color.Interpolate.ColorWithColor(Phaser.Display.Color.ValueToColor(0xffffff), Phaser.Display.Color.ValueToColor(0xffd0ff), 100, Math.round(v * 100));
                for (const l of links) { l.setTint(Phaser.Display.Color.GetColor(c.r, c.g, c.b)); l.x = l._x0 + (Math.random() - 0.5) * 3 * v; l.y = l._y0 + (Math.random() - 0.5) * 3 * v; }
                lock.x = bx + (Math.random() - 0.5) * 4 * v; lock.setScale(2.4 + v * 0.3);
            } });
            const flare = keep(this.add.image(this._altar.x, this._altar.y + (this._land?.y || 0), 'mn_glow').setTint(0xb88aff).setBlendMode(Phaser.BlendModes.ADD).setDepth(D - 0.5).setDisplaySize(190, 56).setAlpha(0.3));
            this.tweens.add({ targets: flare, displayWidth: 250, displayHeight: 76, alpha: 0.8, duration: 700 });   // the dais's rune ring flares
            Sfx.play(this, 'e_chain'); this.time.delayedCall(260, () => Sfx.play(this, 'e_chain'));
            // 2. the lock bursts, and the chains unravel from the middle out: each link drops off in turn,
            // tumbling and fading into sparks
            this.time.delayedCall(560, () => {
                Sfx.play(this, 'e_snap'); this.cameras.main.shake(200, 0.006);
                const fl = keep(this.add.image(bx, by, 'mn_glow').setTint(0xffe0ff).setBlendMode(Phaser.BlendModes.ADD).setDisplaySize(30, 30).setDepth(D + 3));
                this.tweens.add({ targets: fl, displayWidth: 200, displayHeight: 200, alpha: 0, duration: 400, ease: 'Quad.easeOut' });
                this._sparks(bx, by, [0xffe08a, 0xc8a040, 0xffffff], 12, D + 2, { speed: { min: 60, max: 160 }, gravityY: 260, lifespan: 600 });   // the padlock in pieces
                lock.destroy();
                for (const l of links) {
                    const out = Math.abs(l._k), dir = Math.sign(l._k);
                    this.tweens.add({ targets: l, delay: out * 45, x: l.x + dir * (30 + Math.random() * 30), y: l.y + 70 + Math.random() * 40,
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
                    const ring = keep(this.add.image(bx, 20, 'isle2_fx', 'circle').setTint(k % 2 ? 0xffffff : col).setBlendMode(Phaser.BlendModes.ADD).setDepth(D + 2).setScale(0.85).setAlpha(0));   // typed rings (isle2_fx circle) coming down the beam
                    this.tweens.add({ targets: ring, y: by, scale: 0.36, alpha: { from: 1, to: 0.5 }, delay: k * 120, duration: 500, ease: 'Quad.easeIn' });
                }
                this.tweens.add({ targets: bk, y: bk.y - 26, scale: 3.4, duration: 650, ease: 'Cubic.easeOut' });
                Sfx.play(this, 'e_beam');
                if (best >= 2) for (let q = 0; q < best - 1; q++) this.time.delayedCall(q * 180, () => this._bolt(bx, by - 26, col, D + 4));
            });
            // 4. it bursts open
            this.time.delayedCall(1350, () => {
                this._flash(col, 0.5 + best * 0.06, 420);
                const p = this.add.particles(0, 0, 'mn_px2', { x: bx, y: by - 26, lifespan: 900, speed: { min: 80, max: 260 }, gravityY: 120, scale: { start: 2, end: 0 }, alpha: { start: 1, end: 0 },
                    tint: [col, 0xffffff, 0xd8c8ff], blendMode: 'ADD', emitting: false }).setDepth(92);   // (over the reveal's dark, which is already down)
                p.explode(70 + best * 25); this.time.delayedCall(1100, () => p.destroy()); Sfx.play(this, 'e_burst');
                Music.duck(false); bk.setDepth(bkDepth);
                cam.pan(this.scale.width / 2, this.scale.height / 2, 1); cam.setZoom(1); cam.setScroll(0, 0);   // snapped back under the flash
                this.tweens.timeScale = 0.3; this.time.timeScale = 0.3;   // a breath of slow motion as it opens
                setTimeout(() => { this.tweens.timeScale = 1; this.time.timeScale = 1; }, 380);
                const W = this.scale.width, H = this.scale.height;   // a shockwave over the whole screen
                const sw = this.add.image(bx, by - 26, 'isle2_fx', 'ring3').setTint(col).setBlendMode(Phaser.BlendModes.ADD).setDepth(92).setScale(1.2);   // the typed ring, thrown out over the whole screen
                this.tweens.add({ targets: sw, scale: Math.min(12, Math.hypot(W, H) / 48), alpha: 0, duration: 700, ease: 'Cubic.easeOut', onComplete: () => sw.destroy() });
                const sw2 = this.add.image(bx, by - 26, 'isle2_fx', 'ring2').setTint(0xffffff).setBlendMode(Phaser.BlendModes.ADD).setDepth(92).setScale(1.2);
                this.tweens.add({ targets: sw2, scale: Math.min(9, Math.hypot(W, H) / 64), alpha: 0, duration: 560, delay: 80, ease: 'Cubic.easeOut', onComplete: () => sw2.destroy() });
                this._glyphs(bx, by - 26, [col, 0xffffff], 18 + best * 6, 92, { speed: { min: 120, max: 360 }, lifespan: 1100 });
                this.cameras.main.shake(320, 0.006 + best * 0.002);
                objs.forEach(o => { if (o?.active) { this.tweens.killTweensOf(o); o.destroy(); } });
                this.tweens.add({ targets: bk, y: bk.y + 26, scale: 2.2, duration: 400, ease: 'Quad.easeOut' });
                this._busy = false;
                this._enchReveal(got, () => { this._drawAltarUI(); this._panel(); }, true);   // its dark goes down at once: the isle never shows between the two
                dark.destroy();
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
    _enchReveal(got, onDone, fromDark = false) {
        this._closeReveal();
        const W = this.scale.width, H = this.scale.height, D = 90, fx = [], keep = o => { fx.push(o); return o; };
        this._enchFx = fx; this._busy = true;
        const cx = W / 2, cy = H / 2 - 30, one = got.length === 1, best = Math.max(...got.map(b => Enchants.def(b.id).r));
        const veil = keep(this.add.rectangle(cx, H / 2, W, H, 0x05030a, fromDark ? 0.94 : 0).setDepth(D).setInteractive());
        if (!fromDark) this.tweens.add({ targets: veil, fillAlpha: 0.94, duration: 300 });
        // the summoning circle
        // a circle on the floor (typed: isle2_fx circle, 3x; flat, so it turns by its runes going round it, never by rotating)
        const circ = keep(this.add.container(cx, cy + (one ? 40 : 0)).setDepth(D + 1).setScale(0.2).setAlpha(0));
        const cring = this.add.image(0, 0, 'isle2_fx', 'circle').setScale(3).setTint(0x9a6aff).setBlendMode(Phaser.BlendModes.ADD);
        const crunes = Array.from({ length: 14 }, (_, k) => this.add.image(0, 0, 'isle2_fx', 'glyph' + (k % 6)).setScale(3).setTint(0xd8c8ff).setBlendMode(Phaser.BlendModes.ADD));
        circ.add([cring, ...crunes]);
        const drawCirc = (col) => { cring.setTint(col); crunes.forEach(r => r.setTint(MenuArt.mix(col, 0xffffff, 0.5))); };
        const tickCirc = (t) => {
            if (!circ.active) return;
            const ph = t * 0.0006;
            crunes.forEach((r, k) => { const a = k / crunes.length * Math.PI * 2 + ph; r.setPosition(Math.round(Math.cos(a) * 63) * 3, Math.round(Math.sin(a) * 20) * 3).setAlpha(0.5 + 0.5 * Math.max(0, Math.sin(a))); });
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
        this.tweens.addCounter({ from: 0, to: 1, duration: 760, onUpdate: () => cards.forEach(c => { if (c.c.active) c.c.x = c.x0 + Math.round((Math.random() - 0.5) * 5); }), onComplete: () => cards.forEach(c => c.c.active && c.c.setX(c.x0)) });   // trembling, side to side
        let landed = 0;
        this.time.delayedCall(800, () => {
            inflow.stop();
            this._flash(0xc8aaff, 0.4, 160);
            Sfx.play(this, 'e_flip');
            cards.forEach((c, j) => {
                const r = Enchants.def(c.b.id).r, n = one ? 22 + r * 5 : 14 + j * 3 + r * 2;
                c.spin(n, () => {
                    landed++;
                    if (c.r >= best) drawCirc(Enchants.RARITY[best].col);
                    if (landed === cards.length) this.time.delayedCall(500, () => {
                        const hint = keep(this.add.text(W / 2, H - 40, 'click to continue', { fontSize: '13px', fontFamily: 'monospace', color: UIKit.CSS.textLo }).setOrigin(0.5).setDepth(D + 9));
                        this.tweens.add({ targets: hint, alpha: 0.4, duration: 600, yoyo: true, repeat: -1 });
                        veil.once('pointerdown', () => { Sfx.play(this, 'click'); this.tweens.add({ targets: fx.filter(o => o?.active && o.alpha !== undefined), alpha: 0, duration: 200, onComplete: () => { this._closeReveal(); this._busy = false; onDone?.(); } }); });
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
        const ns = (f, a = 1) => this.add.nineslice(0, 0, 'isle2_ui', f, 75, 100, 8, 8, 8, 8).setScale(2 * sc).setAlpha(a);   // the card, 150x200 at sc (typed: isle2_ui board_d, its rim rim_s in what it lands on)
        const body = ns('board_d'), rim = ns('rim_s', 0.6), rimLit = ns('rim_s');
        const icon = this.add.sprite(0, -CH * 0.16, ShopScene.bookIcon(this, -1), '0').setScale(3.4 * sc);
        const name = this.add.text(0, CH * 0.2, '', { fontSize: `${Math.round(17 * sc + 4)}px`, fontFamily: UIKit.FONT.title, fontStyle: 'bold', color: '#ffffff', stroke: '#000', strokeThickness: 4, align: 'center', wordWrap: { width: CWd * 1.4 } }).setOrigin(0.5);
        const tag = this.add.text(0, CH * 0.33, '', { fontSize: `${Math.round(9 * sc + 4)}px`, fontFamily: 'monospace', fontStyle: 'bold', color: '#ffffff', stroke: '#000', strokeThickness: 3 }).setOrigin(0.5);
        c.add([rays, body, rim, rimLit, icon, name, tag]);
        const paint = (col, lit) => { rim.setTint(col).setVisible(!lit); rimLit.setTint(col).setVisible(lit); };
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
                    this.tweens.addCounter({ from: 0, to: 1, duration: hold, onUpdate: tw => { if (c.active) c.x = x + Math.round((Math.random() - 0.5) * (2 + tw.getValue() * 6)); }, onComplete: () => c.active && c.setX(x) });   // trembling harder and harder
                    this.cameras.main.zoomTo(1.04 + (r - 3) * 0.02, hold, 'Quad.easeIn');
                    this.time.delayedCall(hold, () => { this.cameras.main.zoomTo(1, 200); if (r < 5) Music.duck(false); if (tg.active) tg.destroy(); step(); });
                    return;
                }
                // a corrupted one: the card breaks before it lands
                if (r === 5 && !c._torn) { c._torn = true; this._corruptBreak(keep, c, () => step()); return; }
                // it lands: rarer ones hang a beat first, swelling (a hitstop), then the card flips over onto what it is
                if (r >= 2 && !c._held) { c._held = true; this.tweens.add({ targets: c, scale: 1.1, duration: [0, 0, 110, 170, 230, 230][r], ease: 'Quad.easeOut', onComplete: step }); return; }
                const cam = this.cameras.main;
                if (r >= 1) { cam.zoomTo(1 + 0.012 * (r + 1), 70, 'Quad.easeOut'); this.time.delayedCall(80, () => cam.zoomTo(1, 280, 'Quad.easeIn')); }
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
                this._ring(c.x, c.y, R.col, D - 1, { ms: 700 + r * 60, scale: 3 + r });
                if (r >= 2) this._glyphs(c.x, c.y, [R.col, 0xffffff], 6 + r * 4, D + 4, { speed: { min: 80, max: 220 + r * 40 } });
                const sp = keep(this.add.particles(0, 0, 'mn_px2', { x: c.x, y: c.y, lifespan: 1100, speed: { min: 80, max: 260 + r * 60 }, gravityY: 160,
                    scale: { start: 2.2, end: 0 }, alpha: { start: 1, end: 0 }, tint: [R.col, 0xffffff], blendMode: 'ADD', emitting: false }).setDepth(D + 4));
                sp.explode(24 + r * 22);
                this._sparks(c.x, c.y, [R.col, 0xffffff], 6 + r * 8, D + 4, { speed: { min: 80, max: 220 + r * 60 }, lifespan: 900 + r * 100, gravityY: 120 });
                if (r >= 2) {   // a shower of twinkles over it, longer and thicker the rarer it is
                    const sh = keep(this.add.particles(0, 0, 'isle_fx', { frame: 'spark0', anim: 'isle_twinkle', x: { min: c.x - 120 - r * 30, max: c.x + 120 + r * 30 }, y: c.y - CH - 40, lifespan: 2400,
                        speedY: { min: 40, max: 110 }, speedX: { min: -18, max: 18 }, scale: 3, alpha: { start: 1, end: 0 }, tint: [R.col, 0xffffff], blendMode: 'ADD', frequency: 110 - r * 18 }).setDepth(D + 4));
                    this.time.delayedCall(700 + r * 400, () => sh.active && sh.stop());
                }
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
                else if (r === 2) this._banner(R.name.toUpperCase().split('').join(' '), UIKit._hex(MenuArt.mix(R.col, 0xffffff, 0.2)), 30);
                if (r >= 3) { this._flash(R.col, r >= 4 ? 0.55 : 0.4, 360); this.cameras.main.shake(350, 0.008); }
                else if (r === 2) this.cameras.main.shake(160, 0.004);
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
        return { c, b, r, spin, x0: x };
    }
    // The corrupted pull: the music cuts out, the screen tears into bands of static, the card
    // splits and shudders, then snaps back together on what it really is.
    _corruptBreak(keep, c, then) {
        const W = this.scale.width, H = this.scale.height;
        Music.duck(true); Sfx.play(this, 'collapse');
        this.time.delayedCall(1400, () => Music.duck(false));
        const bands = keep(this.add.graphics().setDepth(c.depth + 5));
        let k = 0;
        const x0 = c.x, glitch = this.time.addEvent({ delay: 60, repeat: 18, callback: () => {
            bands.clear(); k++;
            for (let i = 0; i < 9; i++) {
                bands.fillStyle([0x7aff5a, 0xff3aa0, 0x000000, 0xffffff][Math.floor(Math.random() * 4)], 0.18 + Math.random() * 0.35);
                bands.fillRect(Math.random() * W * 0.3, Math.random() * H, W * (0.3 + Math.random() * 0.7), 2 + Math.random() * 14);
            }
            c.x = x0 + Math.round((Math.random() - 0.5) * 18);
            this.cameras.main.setScroll((Math.random() - 0.5) * 8, (Math.random() - 0.5) * 6);
        } });
        this._flash(0x7aff5a, 0.4, 160);
        this.time.delayedCall(1200, () => {
            glitch.remove(); bands.destroy(); c.x = x0; this.cameras.main.setScroll(0, 0);
            this._flash(0xff3aa0, 0.5, 420);
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
    _banner(s, col, size = 40) {
        const W = this.scale.width, t = this.add.text(W / 2, 104, s, { fontSize: size + 'px', fontFamily: UIKit.FONT.title, fontStyle: 'bold', color: col, stroke: '#000', strokeThickness: 7 }).setOrigin(0.5).setDepth(120).setScale(0.6).setAlpha(0);
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
        const dim = keep(this.add.rectangle(0, 0, this.scale.width, this.scale.height, 0x05030a, 0.45).setOrigin(0).setDepth(D - 1).setAlpha(0));
        this.tweens.add({ targets: dim, alpha: 1, duration: 300 });   // the room dims round the crucible
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
                this.tweens.add({ targets: book, y: mouth + deep * 0.5, duration: ms, ease: 'Quad.easeIn', onComplete: () => {
                    splash(step === 2);
                    book.setTint(Phaser.Display.Color.GetColor(255 - step * 30, 255 - step * 50, 255));
                    if (step === 2) { step++; this.time.delayedCall(250, roll); return; }   // the last dip: it stays under
                    this.tweens.add({ targets: book, y: A.y - 30, duration: ms, ease: 'Quad.easeOut', delay: 120, onComplete: () => { step++; dip(); } });
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
                    this._cruBoost = { v: 0.2 + t * 0.6, t: this.time.now, ms: 260 };   // each number stirs the crystals round it, harder as it slows
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
            this._cruBoost = { v: 0.4 + G * 0.15, t: this.time.now, ms: 900 + G * 350, ring: G >= 3 };   // the crystals answer it: a ring of light running round them on a big one
            this.tweens.add({ targets: num, scale: { from: 1.9 + G * 0.15, to: 1 }, duration: 380, ease: 'Back.easeOut' });
            const label = keep(this.add.text(mx, ny + 56, res.rolled >= 98 ? 'PERFECT!' : gr.name, { fontSize: `${18 + G * 4}px`, fontFamily: UIKit.FONT.title, fontStyle: 'bold', color: UIKit._hex(gr.col), stroke: '#000', strokeThickness: 5 }).setOrigin(0.5).setDepth(D + 4));
            if (G >= 2) {
                const burst = keep(this.add.particles(0, 0, 'mn_px2', { x: mx, y: ny, lifespan: 1000, speed: { min: 80, max: 200 + G * 80 }, gravityY: 120, scale: { start: 2.4, end: 0 },
                    tint: [gr.col, 0xffffff], blendMode: 'ADD', emitting: false }).setDepth(D + 3)); burst.explode(20 + G * 25);
                this._sparks(mx, ny, [gr.col, 0xffffff], 6 + G * 8, D + 4, { speed: { min: 100, max: 220 + G * 60 }, lifespan: 900 });
            }
            if (G >= 3) { this._flash(gr.col, 0.25 + (G - 3) * 0.15, 320); cam.shake(320, 0.006 + G * 0.002); }
            if (G === 4) {   // Perfect: rays wheel out behind the number and everything slows for a breath
                const rays = keep(this.add.graphics().setDepth(D + 2).setPosition(mx, ny).setBlendMode(Phaser.BlendModes.ADD));
                for (let r = 0; r < 16; r++) { const a = r / 16 * Math.PI * 2; rays.fillStyle(r % 2 ? 0xffffff : gr.col, 0.3); rays.fillTriangle(0, 0, Math.cos(a - 0.06) * 420, Math.sin(a - 0.06) * 420, Math.cos(a + 0.06) * 420, Math.sin(a + 0.06) * 420); }
                this.tweens.add({ targets: rays, angle: 90, alpha: { from: 1, to: 0 }, duration: 2400 });
                this.tweens.timeScale = 0.5; this.time.delayedCall(500, () => { this.tweens.timeScale = 1; });
            }
            const hold = [500, 600, 800, 1000, 1300][G];
            this.time.delayedCall(hold, () => rise(num, label));
        };
        // 4. the book rises out, dripping glimmering fluid; 5. the number spins down into it and is absorbed
        const rise = (num, label) => {
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
                this.tweens.add({ targets: label, alpha: 0, y: label.y - 12, duration: 300 });   // its name goes; the number itself sinks into the book
                this.tweens.add({ targets: num, x: book.x, y: book.y, scale: 0.15, duration: 700, ease: 'Cubic.easeIn', onComplete: () => {
                    num.destroy();
                    book.clearTint();
                    this._ring(book.x, book.y, gr.col, D + 2, { ms: 600, scale: 2 + G * 0.5 });
                    const gl = keep(this.add.image(book.x, book.y, 'mn_glow').setTint(gr.col).setBlendMode(Phaser.BlendModes.ADD).setDisplaySize(40, 40));
                    this.tweens.add({ targets: gl, displayWidth: 200 + G * 60, displayHeight: 200 + G * 60, alpha: 0, duration: 700 });
                    this.tweens.add({ targets: book, scale: { from: 3.8, to: 3 }, duration: 300, ease: 'Back.easeOut' });
                    const delta = res.rolled - before.q;
                    const dt = keep(this.add.text(mx, ny, `${before.q}% → ${res.rolled}%  (${delta > 0 ? '+' : ''}${delta})`, { fontSize: '24px', fontFamily: UIKit.FONT.title, fontStyle: 'bold', color: delta > 0 ? '#9aff8a' : delta < 0 ? '#ff7a6a' : '#d8d8d8', stroke: '#000', strokeThickness: 5 }).setOrigin(0.5).setDepth(D + 4));
                    this.tweens.add({ targets: dt, scale: { from: 1.4, to: 1 }, duration: 300, ease: 'Back.easeOut' });   // where the roll stood: what it came to
                    this._say(delta > 0 ? `Up ${delta}: ${d.name} is ${res.rolled}% now.` : delta < 0 ? `Down ${-delta}. That's the gamble.` : 'Not a hair of difference.');
                    this.time.delayedCall(1500, () => {   // and the room comes back up round it
                        objs.forEach(o => { if (o?.active && o.stop && o.emitting !== undefined) o.stop(); });
                        this.tweens.add({ targets: objs.filter(o => o?.active && o.alpha !== undefined && !o.mask), alpha: 0, duration: 320, onComplete: () => {
                            objs.forEach(o => { if (o?.active) { this.tweens.killTweensOf(o); o.destroy(); } }); this._busy = false; this._book = i; this._refreshAll?.(); } });
                    });
                } });
            } });
        };
        dip();
    }

    // the Binding Ring answers a bind: the circle on its ground lights, and each standing stone in turn throws its light into the weapon
    _ringAnswer(D) {
        if (this._mode !== 'bind') return;
        const k = this._roomK || 1, [ox, oy] = this._roomO || [0, 0], A = this._altarPt, P = (x, y) => [ox + x * k, oy + y * k];
        const [rx, ry] = P(400, 472), g = this.add.image(rx, ry, 'mn_glow').setTint(0x6ad86a).setBlendMode(Phaser.BlendModes.ADD).setDisplaySize(540 * k, 150 * k).setAlpha(0).setDepth(D - 2);
        this.tweens.add({ targets: g, alpha: 0.7, duration: 280, yoyo: true, hold: 520, onComplete: () => g.destroy() });
        [[160, 380], [280, 332], [520, 332], [640, 380]].forEach(([sx, sy], i) => this.time.delayedCall(i * 90, () => {
            const [x, y] = P(sx, sy - 40), st = this.add.image(x, y, 'mn_glow').setTint(0x8aff7a).setBlendMode(Phaser.BlendModes.ADD).setDisplaySize(70 * k, 110 * k).setAlpha(0).setDepth(D - 2);
            this.tweens.add({ targets: st, alpha: 0.8, duration: 160, yoyo: true, hold: 480, onComplete: () => st.destroy() });
            const beam = this.add.particles(0, 0, 'mn_px2', { x, y, moveToX: A.x, moveToY: A.y, lifespan: 360, frequency: 18, scale: { start: 2.2, end: 1 }, tint: [0xb8ffa0, 0xffffff], blendMode: 'ADD' }).setDepth(D - 1);
            this.time.delayedCall(520, () => { beam.stop(); this.time.delayedCall(420, () => beam.destroy()); });
        }));
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
        const glow = this.add.image(from.x, from.y, 'mn_glow').setTint(R.col).setBlendMode(Phaser.BlendModes.ADD).setDisplaySize(30, 30).setAlpha(0).setDepth(D - 1);
        const trail = this.add.particles(0, 0, 'isle_fx', { frame: 'spark0', anim: 'isle_spark', follow: book, lifespan: 520, speed: { min: 5, max: 30 }, scale: 2,
            tint: [R.col, 0xffffff], blendMode: 'ADD', frequency: 28, emitting: false }).setDepth(D - 1);
        Sfx.play(this, 'e_bind'); this._spend('glorp', cost, to);
        // 1. it lifts off the shelf, swelling in its own light, and hangs there a beat
        const y0 = from.y - 18, p = { t: 0 }, mx = (from.x + to.x) / 2 - 60, my = Math.min(y0, to.y) - 120;
        this.tweens.add({ targets: book, y: y0, scale: 2.4, duration: 240, ease: 'Back.easeOut' });
        this.tweens.add({ targets: glow, y: y0, alpha: 0.85, displayWidth: 90, displayHeight: 90, duration: 240, ease: 'Quad.easeOut' });
        // 2. then it's flung in an arc into the weapon, shrinking as it goes, trailing sparks
        this._glyphs(from.x, y0, [R.col, 0xffffff], 8, D, { speed: { min: 20, max: 70 }, lifespan: 700, gravityY: -30 });
        this.tweens.add({ targets: p, t: 1, delay: 300, duration: 620, ease: 'Cubic.easeIn', onStart: () => { trail.start(); Sfx.play(this, 'whoosh'); this._ringAnswer(D); }, onUpdate: () => {
            const t = p.t, u = 1 - t;
            book.setPosition(u * u * from.x + 2 * u * t * mx + t * t * to.x, u * u * y0 + 2 * u * t * my + t * t * to.y).setScale(2.4 - t * 1.1);
            glow.setPosition(book.x, book.y);
        }, onComplete: () => {
            // 3. it strikes: a flash of its colour round the weapon, sparks, the weapon jolted, the socket it went into lit
            book.destroy(); glow.destroy(); trail.stop(); this.time.delayedCall(600, () => trail.destroy());
            Enchants.put(w.id, i); this.glorps -= cost; localStorage.setItem('glorps', this.glorps); this._book = null;
            this._ring(to.x, to.y, R.col, D, { ms: 600, scale: 3 }); this._glyphs(to.x, to.y, [R.col, 0xffffff], 10 + d.r * 4, D + 1);
            const burst = this.add.particles(0, 0, 'mn_px2', { x: to.x, y: to.y, lifespan: 800, speed: { min: 60, max: 200 }, scale: { start: 2, end: 0 }, alpha: { start: 1, end: 0 },
                tint: [R.col, 0xffffff, 0xffe08a], blendMode: 'ADD', emitting: false }).setDepth(D);
            burst.explode(40); this.time.delayedCall(1000, () => burst.destroy());
            this._sparks(to.x, to.y, [R.col, 0xffffff], 14 + d.r * 6, D + 1, { speed: { min: 90, max: 260 }, lifespan: 800 });
            const hit = this.add.image(to.x, to.y, 'mn_glow').setTint(R.col).setBlendMode(Phaser.BlendModes.ADD).setDisplaySize(60, 60).setDepth(D);
            this.tweens.add({ targets: hit, displayWidth: 320, displayHeight: 320, alpha: 0, duration: 420, ease: 'Quad.easeOut', onComplete: () => hit.destroy() });
            this._flash(R.col, d.r >= 2 ? 0.3 : 0.16, 240); this.cameras.main.shake(130, 0.004);
            // (e_bind's lock lands with it)
            this._say(`${d.name} ${Enchants.roman(b.lvl)}, bound into the ${w.name}.`);
            this._busy = false; this._refreshAll?.();
            const ws = this._altarWeapon, si = Enchants.on(w.id).findIndex(x => x.id === b.id), sk = this._roomSockets?.[si];
            if (ws?.active) this.tweens.add({ targets: ws, scaleX: { from: 3.4 * 1.2, to: 3.4 }, scaleY: { from: 3.4 * 0.82, to: 3.4 }, duration: 380, ease: 'Back.easeOut' });
            if (sk?.active) { this.tweens.add({ targets: sk, scale: { from: 3, to: 2 }, duration: 420, ease: 'Back.easeOut' });
                const sg = this.add.image(sk.x, sk.y, 'mn_glow').setTint(R.col).setBlendMode(Phaser.BlendModes.ADD).setDisplaySize(30, 30).setDepth(sk.depth + 0.1);
                this.tweens.add({ targets: sg, displayWidth: 140, displayHeight: 140, alpha: 0, duration: 600, onComplete: () => sg.destroy() }); }
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
            Wp.x = A.x + Math.round((Math.random() - 0.5) * j); Wp.y = A.y + Math.round((Math.random() - 0.5) * j * 0.6);
            pull.clear();
            for (const [dir, c] of [[-1, col], [1, 0xb88aff]]) for (let k = 0; k < 3; k++) {   // the tethers, wavering, thickening as they pull
                pull.lineStyle(1 + v * 4 - k, k ? 0xffffff : c, (0.25 + v * 0.6) * (k ? 0.5 : 1));
                pull.beginPath(); pull.moveTo(Wp.x, Wp.y);
                for (let s2 = 1; s2 <= 8; s2++) pull.lineTo(Wp.x + dir * reach * s2 / 8, Wp.y + Math.sin(s2 + this.time.now * 0.02 + k) * (2 + v * 6));
                pull.strokePath();
            }
        }, onComplete: () => {
            // 2. it comes free
            Sfx.play(this, 'e_snap'); this._flash(col, 0.4, 260); cam.shake(260, 0.012);
            pull.clear(); Wp.setPosition(A.x, A.y);
            this._sparks(A.x, A.y, [col, 0xffffff], 18, D + 2, { speed: { min: 80, max: 240 } });
            this.tweens.add({ targets: Wp, scale: { from: sc * 1.12, to: sc }, duration: 400, ease: 'Back.easeOut' });   // and settles
            const burst = keep(this.add.particles(0, 0, 'mn_px2', { x: A.x, y: A.y, lifespan: 900, speed: { min: 60, max: 240 }, scale: { start: 2.2, end: 0 }, tint: [col, 0xffffff, 0xd8a8ff], blendMode: 'ADD', emitting: false }).setDepth(D + 2));
            burst.explode(60);
            // 3. what it held: the sealed book yanked out left, the essence as dust right
            const book = keep(this.add.image(A.x, A.y, ShopScene.bookIcon(this, -1), '0').setScale(0.5).setDepth(D + 2));
            const Rt = { x: A.x + 90, y: A.y };
            this.tweens.add({ targets: book, x: A.x - 90, scale: 2.4, duration: 380, ease: 'Back.easeOut' });
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
            }, onComplete: () => {
                o.destroy();
                if (k === count - 1) {
                    this._ring(to.x, to.y, kind === 'glorp' ? 0xffd34a : 0xc8b8ff, D, { ms: 300, scale: 2, to: 1 });
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
        const cru = this._mode === 'reforge', AW = this._mode && !cru ? this.scale.width - 490 : this.scale.width, t = this._sayTxt = this.add.text(AW / 2, cru ? this.scale.height - 56 : 74, s, { fontSize: '13px', fontFamily: 'monospace', color: '#f4e8cc', backgroundColor: '#0a0618', padding: { x: 10, y: 6 }, align: 'center', wordWrap: { width: Math.min(600, AW - 40) } })
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
    _stations(slide = true) {
        for (const o of (this._stationObjs || [])) { if (o?.active) this.tweens.killTweensOf(o); o?.destroy?.(); }
        const objs = this._stationObjs = [], keep = o => { objs.push(o); return o; }, D = 21, x = 26, w = 214, h = 60;
        // a random book on each, new every time you come back out
        this._stationBooks ||= EnchantScene.STATIONS.map(() => Enchants.LIST.filter(d => d.r < 5)[Math.floor(Math.random() * Enchants.LIST.filter(d => d.r < 5).length)]);
        // each card a small board (isle2_ui board_d, 2x), its rim (rim_s) and its colour strip (isle_fx cstrip) in its station's colour
        const ns = (f, cx, cy) => this.add.nineslice(cx, cy, 'isle2_ui', f, w / 2, h / 2, 8, 8, 8, 8).setOrigin(0).setScale(2).setDepth(D);
        EnchantScene.STATIONS.forEach((st, k) => {
            const y = 120 + k * (h + 12), bk = this._stationBooks[k], card = [];
            const put = o => { card.push(keep(o)); return o; };
            put(ns('board_d', x + 4, y + 5).setTint(0x000000).setAlpha(0.4));
            const body = put(ns('board_d', x, y).setAlpha(0.97));
            const rim = put(ns('rim_s', x, y).setTint(st.col).setAlpha(0.4)), rimOn = put(ns('rim_s', x, y).setTint(MenuArt.mix(st.col, 0xffffff, 0.2)).setVisible(false));
            put(this.add.image(x, y, 'isle_fx', 'cstrip').setOrigin(0).setScale(2).setTint(st.col).setAlpha(0.75).setDepth(D));
            const ik = st.id === 'garden' ? this._cropTex(4) : ShopScene.bookIcon(this, bk.r, bk.b, bk.id);
            const ic = put(this.add.sprite(x + 34, y + h / 2, ik, '0').setScale(st.id === 'garden' ? 1.3 : 1.5).setDepth(D + 1));
            const nm = put(this.add.text(x + 62, y + 13, st.name, { fontSize: '18px', fontFamily: UIKit.FONT.title, fontStyle: 'bold', color: UIKit._hex(st.col), stroke: '#0a0618', strokeThickness: 3 }).setDepth(D + 1));
            put(this.add.text(x + 62, y + 37, st.sub, { fontSize: '11px', fontFamily: 'monospace', color: UIKit.CSS.textMid }).setDepth(D + 1));
            const z = keep(this.add.zone(x, y, w, h).setOrigin(0).setInteractive({ useHandCursor: true }).setDepth(D + 2));
            // pointed at: the card steps out to the right, its rim lights and thickens, its book opens
            card.forEach(o => { o._bx = o.x; });
            const lift = on => this.tweens.add({ targets: card, x: o => o._bx + (on ? 6 : 0), duration: 120, ease: 'Quad.easeOut' });
            z.on('pointerover', () => { if (this._busy) return; ic.play(ik); rim.setVisible(false); rimOn.setVisible(true); body.setTint(MenuArt.mix(0xffffff, st.col, 0.3)); nm.setColor(UIKit._hex(MenuArt.mix(st.col, 0xffffff, 0.35))); lift(true); Sfx.play(this, 'hover'); });
            z.on('pointerout', () => { ic.stop().setFrame('0'); rim.setVisible(true); rimOn.setVisible(false); body.clearTint(); nm.setColor(UIKit._hex(st.col)); lift(false); });
            z.on('pointerdown', () => { if (!this._busy && !this._enchFx) { Sfx.play(this, 'click'); this._enterRoom(st.id); } });
            if (slide) this._slideIn(card, -60, 0, 60 + k * 55, 360);
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
        const key = 'isle2_' + id, n = EnchantScene.ISLE.FRAMES[id];
        if (!this.anims.exists(key)) this.anims.create({ key, frames: Array.from({ length: n }, (_, i) => ({ key: 'isle2_isle', frame: `${id}_${i}` })), frameRate: id === 'bind' ? 5 : 6, repeat: -1 });
        return key;
    }
    // a name on a typed plate (isle2_ui plate_fill, its rim plate_rim in the place's colour), nine-sliced at 2x
    _plate(s, col, size = 13) {
        const t = this.add.text(0, 0, s, { fontSize: size + 'px', fontFamily: UIKit.FONT.title, fontStyle: 'bold', color: UIKit._hex(MenuArt.mix(col, 0xffffff, 0.45)), stroke: '#0a0618', strokeThickness: 3 }).setOrigin(0.5);
        const w = Math.ceil((t.width + 20) / 2), h = Math.ceil((t.height + 6) / 2);
        return this.add.container(0, 0, [this.add.nineslice(0, 0, 'isle2_ui', 'plate_fill', w, h, 3, 3, 3, 3).setScale(2), this.add.nineslice(0, 0, 'isle2_ui', 'plate_rim', w, h, 3, 3, 3, 3).setScale(2).setTint(col), t]);
    }
    _minis() {
        const W = this.scale.width, land = this._land, B = this._bb, G = EnchantScene.ISLE, { ix, iy, S, cx, top, rx, ry } = this._isleGeo;
        land.bringToTop(B);
        this._miniObjs = {};
        for (const st of EnchantScene.STATIONS) {
            const mc = this.add.container(0, 0), ik = this._miniTex(st.id), fr = this.textures.getFrame('isle2_isle', st.id + '_0'), bw = fr.width * S, bh = fr.height * S, col = G.LIGHT[st.id];
            const glow = this.add.image(0, -bh * 0.45, 'mn_glow').setTint(col).setBlendMode(Phaser.BlendModes.ADD).setDisplaySize(bw * 1.7, bh * 1.4).setAlpha(0.3);
            const sh = this.add.image(0, 0, 'isle2_isle', fr.width > 32 ? 'shadow_l' : fr.width > 26 ? 'shadow_m' : 'shadow_s').setScale(S);
            const spr = this.add.sprite(0, S, ik).setOrigin(0.5, 1).setScale(S).play(ik);
            const lab = this._plate(st.name, col).setPosition(0, -bh - 16).setAlpha(0);
            const z = this.add.zone(0, -bh / 2, bw, bh + 6).setInteractive({ useHandCursor: true });
            mc.add([sh, glow, spr, lab, z]);
            B.add(mc);
            const a = EnchantScene.MINI_AT[st.id] * Math.PI / 180, rho = G.PLACES[st.id][1];   // its fixed place on the island
            const M = this._miniObjs[st.id] = { mc, lab, glow, spr, col, hot: false, lift: 0, gx: cx + Math.cos(a) * rx * rho, gy: top + Math.sin(a) * ry * rho };
            z.on('pointerover', () => { M.hot = true; if (this._cz.t >= 1) { this.tweens.add({ targets: lab, alpha: 1, duration: 140 }); lab.list[1].setTint(0xffe08a); Sfx.play(this, 'hover'); } });
            z.on('pointerout', () => { M.hot = false; lab.list[1].setTint(col); if (this._cz.t >= 1) lab.setAlpha(0.8); });
            z.on('pointerdown', (p) => {
                if (this._busy || this._enchFx || this._mode || this._roomBusy) return;
                if (this._cz.t < 1) { this._closeUp(true); return; }   // from afar, a click on the island looks closer first
                this._dragStart(p, st.id);
            });
            z.on('pointerup', () => { const d = this._drag; if (d?.id === st.id && !d.moved && !this._mode) this._enterRoom(st.id); });
        }
        // a click (or a hover) anywhere on the island's top offers the closer look
        const iz = this._islandZone = this.add.zone(ix + cx * S, iy + top * S, G.rx * 2 * S, G.ry * 2 * S + 30).setInteractive({ useHandCursor: true });
        land.addAt(iz, land.list.indexOf(B));
        const hint = this._closeHint = this.add.text(ix + cx * S, iy + (top + G.ry) * S + 50, 'click the island to look closer', { fontSize: '13px', fontFamily: 'monospace', fontStyle: 'bold', color: '#e0ccff', backgroundColor: '#0a0618', padding: { x: 8, y: 4 } }).setOrigin(0.5).setDepth(22).setAlpha(0);
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
                M.lift += ((M.hot && this._cz.t >= 1 ? -2 : 0) - M.lift) * Math.min(1, dt / 70);   // pointed at, up close: it rises a couple of the island's pixels
                M.mc.setPosition(ix + Math.round(x) * S, iy + Math.round(y) * S); M.mc._z = M.mc.y;   // on the island's pixel grid
                M.spr.y = S + Math.round(M.lift) * S;
                M.glow.setAlpha((M.hot && this._cz.t >= 1 ? 0.6 : 0.26) + 0.08 * Math.sin(t * 0.003 + k));   // its light, breathing; brighter pointed at
                M.mc.setAlpha(back ? 0.8 : 1);
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
        const W = this.scale.width, H = this.scale.height, land = this._land, k = 5 / 3, py = H * 0.47, G = this._isleGeo, ty = G.iy + G.top * G.S;   // up close the island rests at 5x (whole pixels)
        Sfx.play(this, on ? 'e_beam' : 'e_flip');
        this._closeHint.setAlpha(0);
        if (on) {
            this._landFloat?.pause(); land.y = 0;
            // the station cards slide off to the left and the altar's plate sinks away, as the island comes closer
            this._slideOut(this._stationObjs || [], -280, 0, 300); this._slideOut(this._altarUI || [], 0, 170, 300);
            this._stationObjs = []; this._altarUI = [];
            const objs = this._closeObjs = [];
            this._btn({ x: W / 2, y: H - 46, w: 200, h: 38, label: '◂ STEP BACK', accent: UIKit.PALETTE.line, depth: 22, fontSize: '13px', fireOn: 'down', onClick: () => this._closeUp(false) }).objs.forEach(o => objs.push(o));
            objs.push(this.add.text(W / 2, H - 90, 'drag to turn the island  ·  click a place to go there', { fontSize: '14px', fontFamily: 'monospace', color: '#d8c8f0', stroke: '#0a0618', strokeThickness: 4 }).setOrigin(0.5).setDepth(22));
            this._slideIn(objs, 0, 60, 380, 360);
        } else { this._slideOut(this._closeObjs || [], 0, 60, 220); this._closeObjs = null; for (const M of Object.values(this._miniObjs)) M.lab.setAlpha(0); }
        if (!on && this._spinA) { const A = this._spinA % 360, h = { a: A }; this.tweens.add({ targets: h, a: A > 180 ? 360 : 0, duration: 800, ease: 'Cubic.easeInOut', onUpdate: () => { this._spinA = h.a % 360 || (h.a ? 0.001 : 0); }, onComplete: () => { this._spinA = 0; } }); }   // it turns back home
        this._czTw = [this.tweens.add({ targets: this._cz, t: on ? 1 : 0, duration: 800, ease: 'Cubic.easeInOut' }), this.tweens.add({ targets: this._night, y: on ? 18 : 0, duration: 800, ease: 'Cubic.easeInOut' }), this.tweens.add({ targets: this._title, alpha: on ? 0 : 1, duration: 300 })];   // (up close the places' plates take the top of the window)   // the night holds back: it only shifts a little
        this._czTw.push(this.tweens.add({ targets: land, scaleX: on ? k : 1, scaleY: on ? k : 1, x: on ? W / 2 - (G.ix + G.cx * G.S) * k : 0, y: on ? py - ty * k : 0, duration: 800, ease: 'Cubic.easeInOut', onComplete: () => {
            this._closing = false;
            if (on) for (const M of Object.values(this._miniObjs)) M.lab.setAlpha(0.8);
            else { this._landFloat?.resume(); this._stations(); this._drawAltarUI(true); }
        } }));
    }
    // a place's mini, where it is on screen now (the dive aims at it)
    _roomPt(id) {
        const M = this._miniObjs?.[id], land = this._land;
        if (!M) return [this.scale.width / 2, 266];
        return [land.x + M.mc.x * land.scaleX, land.y + (M.mc.y - 20) * land.scaleY];
    }
    _open(mode) { if (mode) this._enterRoom(mode); else this._leaveRoom(); }

    // The cloud cover going into a room and out: fourteen cumulus (typed: isle2_cumulus <shape>_<depth>_<billow frame>) at
    // three depths, each [shape, depth, where it rests as fractions of the window] (laid so that at rest they leave no gap at
    // either window size), the far ones behind and paler at 5x, the near ones in front and a touch darker at 7x
    static COVER = [["L1","near",0.46,0.28],["L2","near",0.49,0.74],["T1","near",0.83,0.3],["T1","near",0.15,0.4],["L1","near",0.82,0.84],["L2","near",0.15,0.86],["T2","mid",0.52,0],["L1","mid",0.17,0.02],["L2","mid",0.45,0.44],["M1","mid",0.87,-0.02],["T2","mid",0.99,0.48],["M2","far",0.93,0.16],["M1","far",0.86,0.66],["S1","far",0.5,0.96]];
    // They come in from all round the edges, each from the way it lies from the middle (the far ones slower, starting
    // closer; the near ones rushing in last and leaning into the others), swelling as they arrive; while they're there each
    // billows (its upper lumps a pixel off, now and then) and bobs. Covered, then() swaps what's behind; _clouds(false)
    // holds them a beat, then they part from the middle outward, each off the way it came, swelling past you.
    _clouds(cover, then) {
        const W = this.scale.width, H = this.scale.height, D = 120, K = { far: 5, mid: 6, near: 7 }, Z = { far: 0, mid: 1, near: 2 };
        if (cover) {
            if (this._wipe?.list) { this._wipe.list.forEach(c => c.box.destroy()); this._ticks = this._ticks.filter(f => f !== this._wipe.tick); }
            const list = EnchantScene.COVER.map(([id, dp, fx, fy], i) => {
                const tx = fx * W, ty = fy * H, a = Math.atan2(ty - H / 2 + ((i % 3) - 1) * 24, tx - W / 2 + (i % 2 ? 36 : -36)), far = Math.hypot(W, H) * (dp === 'near' ? 0.72 : dp === 'mid' ? 0.58 : 0.44);
                const box = this.add.container(tx + Math.cos(a) * far, ty + Math.sin(a) * far).setDepth(D + Z[dp] + i * 0.01).setScrollFactor(0).setScale(0.88);
                const img = this.add.image(0, 0, 'isle2_cumulus', `${id}_${dp}_0`).setScale(K[dp]); box.add(img);
                return { box, img, id, dp, tx, ty, a, far, ph: i * 0.7, f: 0, d: Math.hypot(tx - W / 2, ty - H / 2) };
            });
            for (const c of list) this.tweens.add({ targets: c.box, x: c.tx, y: c.ty, scale: 1, duration: { far: 760, mid: 700, near: 640 }[c.dp], delay: { far: 0, mid: 50, near: 110 }[c.dp], ease: v => Phaser.Math.Easing.Back.Out(v, 0.9) });
            const tick = t => { for (const c of list) { if (!c.img.active) continue; const f = Math.floor(t / 420 + c.ph) % 2; if (f !== c.f) { c.f = f; c.img.setFrame(`${c.id}_${c.dp}_${f}`); } c.img.y = Math.round(Math.sin(t * 0.0021 + c.ph) * 1.4) * K[c.dp]; } };
            this._ticks.push(tick);
            this._wipe = { list, tick, at: 0 };
            Sfx.play(this, 'cloud_in');
            this.time.delayedCall(760, () => { if (this._wipe) this._wipe.at = this.time.now; then?.(); });
            return;
        }
        const Wp = this._wipe; this._wipe = null;
        if (!Wp?.list) return then?.();
        const hold = Math.max(0, 140 - (this.time.now - (Wp.at || this.time.now)));   // a beat all cloud (the room built under it counts toward it)
        this.time.delayedCall(hold, () => {
            Sfx.play(this, 'cloud_out');
            [...Wp.list].sort((p, q) => p.d - q.d).forEach((c, n) => this.tweens.add({ targets: c.box, x: c.tx + Math.cos(c.a) * c.far * 1.1, y: c.ty + Math.sin(c.a) * c.far * 1.1, scale: 1.14,
                duration: { far: 720, mid: 660, near: 600 }[c.dp], delay: n * 16, ease: 'Cubic.easeIn' }));
            this.time.delayedCall(980, () => { Wp.list.forEach(c => c.box.destroy()); this._ticks = this._ticks.filter(f => f !== Wp.tick); then?.(); });
        });
    }
    // ── THE ROOMS ─────────────────────────────────────────────────────────────
    // The island swells toward that place as clouds close over it; they part on its room: its own ground and altar and what
    // moves round it, your books on the board on the right.
    _enterRoom(id) {
        if (this._busy || this._roomBusy || this._mode) return;
        this._roomBusy = true;
        const cam = this.cameras.main, W = this.scale.width, H = this.scale.height, [px, py] = this._roomPt(id), land = this._land;
        Sfx.play(this, 'e_beam'); this._hideTip();
        const k = land.scaleX * 1.8;   // the island grows round the place you picked
        const dive = this.tweens.add({ targets: land, scaleX: k, scaleY: k, x: px - (px - land.x) * 1.8, y: py - (py - land.y) * 1.8, duration: 560, ease: 'Cubic.easeIn' });
        this._clouds(true, () => {
            if (id === 'garden') { this.scene.start('Garden', {}); return; }   // the garden is a place you walk (GardenScene)
            cam.resetFX(); cam.setZoom(1); cam.setScroll(0, 0);
            this._mode = id; this._book = null; this._page = 0; this._picks = [];
            dive.stop(); for (const tw of (this._czTw || [])) tw?.stop?.(); this._closing = false;   // behind the room the island goes back to rest
            this._cz.t = 0; this._spinA = 0; this._spinV = 0; land.setScale(1).setPosition(0, 0); this._night.y = 0; this._title?.setAlpha(1); this._landFloat?.resume();
            for (const o of (this._closeObjs || [])) o?.destroy?.(); this._closeObjs = null;
            for (const M of Object.values(this._miniObjs)) M.lab.setAlpha(0);
            this._drawAltarUI();
            this._buildRoom(id); this._panel();
            // and you arrive: the clouds part, the room's name drops in, the board swings in from the right
            this._clouds(false);
            if (this._roomTitle) this._slideIn([this._roomTitle], 0, -24, 260, 420);
            if (id === 'reforge') this._slideIn(this._panelObjs || [], 0, -36, 320, 400);
            else this._slideIn(this._panelObjs || [], 520, 0, 200, 460, false);
            this._say(EnchantScene.ROOMS[id].say);
            this.time.delayedCall(500, () => { this._roomBusy = false; });
        });
    }
    _leaveRoom() {
        if (!this._mode || this._busy || this._roomBusy) return;
        this._roomBusy = true; this._hideTip();
        const from = this._roomPt(this._mode), land = this._land;
        if (this._mode !== 'reforge') { this._slideOut(this._panelObjs || [], 300, 0, 150); this._panelObjs = null; }   // the board swings away as you go
        this._clouds(true, () => {
            for (const o of [...(this._roomObjs || []), ...(this._panelObjs || []), ...(this._pickObjs || [])]) { if (o?.active) this.tweens.killTweensOf(o); o?.destroy?.(); }
            this._roomObjs = this._panelObjs = this._pickObjs = null; this._pickOpened = false;
            this._ticks = this._ticks.filter(f => !(this._roomTicks || []).includes(f)); this._roomTicks = [];
            this._mode = null; this._picks = []; this._stationBooks = null; this._stations();
            this._sayTxt?.destroy();
            Sfx.play(this, 'e_flip');
            this._landFloat?.pause(); land.setScale(1.6).setPosition(from[0] - from[0] * 1.6, from[1] - from[1] * 1.6);
            this.tweens.add({ targets: land, scaleX: 1, scaleY: 1, x: 0, y: 0, delay: 150, duration: 620, ease: 'Cubic.easeOut', onComplete: () => this._landFloat?.resume() });
            this._clouds(false, () => { this._roomBusy = false; });
        });
    }
    // the altar stands at (400, 470) in every room; what sits on it floats at _altarPt
    _buildRoom(id) {
        const W = this.scale.width, H = this.scale.height, D = 30, R = EnchantScene.ROOMS[id], objs = this._roomObjs = [], keep = o => { objs.push(o); return o; };
        this._roomTicks = [];
        // The room is drawn in a 1280x720 design space (the altar at 400, 470) and scaled to cover the
        // window: the art left of the satchel fills it, the rest runs on under the satchel.
        const SX = id === 'reforge' ? W : W - 490, k = id === 'combine' ? Math.min(Math.max(SX / 800, H / 720), SX / 640) : Math.max(SX / 800, H / 720), ox = (SX - 800 * k) / 2, oy = id === 'combine' && 720 * k < H ? H - 720 * k : (H - 720 * k) / 2;   // the Twin Pools: both pools stay in, its foot on the window's   // the crucible stands in the middle (its books come in a popup)
        const C = keep(this.add.container(ox, oy).setScale(k).setDepth(D)), art = o => { C.add(o); return o; };
        this._roomK = k; this._roomO = [ox, oy];
        keep(this.add.rectangle(0, 0, W, H, 0x07061a, 1).setOrigin(0).setDepth(D - 0.5).setInteractive());   // nothing of the main room shows or takes a click
        const tick = f => { this._roomTicks.push(f); this._ticks.push(f); };
        art(this.add.image(0, 0, 'isle2_room_' + id).setOrigin(0).setScale(4).setDepth(D).setInteractive());
        const AX = 400, AY = 470, sz = EnchantScene.ALTAR[id] || [1, 1];
        if (id !== 'garden') art(this.add.image(AX, AY, 'isle2_altar_' + id).setOrigin(0.5, 1).setScale(3).setDepth(D + 2));
        this._altarPt = { x: ox + AX * k, y: oy + (AY - sz[1] * 3 - (id === 'bind' ? 70 : 46)) * k };
        // the altar's own light, breathing
        const gl = art(this.add.image(AX, AY - sz[1] * 1.5, 'mn_glow').setTint(R.col).setBlendMode(Phaser.BlendModes.ADD).setDisplaySize(sz[0] * 6, sz[1] * 5).setAlpha(0.35).setDepth(D + 1));
        this.tweens.add({ targets: gl, alpha: 0.18, duration: 1600, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
        const fx = art(this.add.graphics().setDepth(D + 1.5));
        if (id !== 'reforge') {
            // the wind in the grass: each tuft in the open (isle_fx tf_<room>_<x>_<y>_<lean>, cut from the room's own pixels)
            // leans with a gust rolling across from the left, then stands again
            const tufts = this.textures.get('isle2_tufts').getFrameNames().filter(f => f.startsWith(`tf_${id}_`) && f.endsWith('_1')).map(f => {
                const [, , x, y] = f.split('_').map(Number);
                return (ox + x * 4 * k < SX + 8) ? { x, img: art(this.add.image(x * 4, y * 4, 'isle2_tufts', f).setOrigin(0).setScale(4).setDepth(D + 0.5)), base: f.slice(0, -1), f: 1 } : null;
            }).filter(Boolean);
            let windAt = 0;
            tick(t => {
                if (t - windAt < 110) return; windAt = t;
                for (const T of tufts) {
                    const g2 = Math.sin(t * 0.0011 - T.x * 0.045) + 0.45 * Math.sin(t * 0.0029 - T.x * 0.11);   // a slow swell and a quicker flutter on it
                    const f = g2 > 0.95 ? 2 : g2 < -1.15 ? 0 : 1;
                    if (f !== T.f) { T.f = f; T.img.setFrame(T.base + f); }
                }
            });
            // fireflies over the grass
            art(this.add.particles(0, 0, 'isle_fx', { frame: 'fly0', anim: 'isle_fly', x: { min: 30, max: 790 }, y: { min: 330, max: 680 }, lifespan: 5200,
                speedX: { min: -12, max: 12 }, speedY: { min: -10, max: 4 }, scale: 4, alpha: { onUpdate: (p, key, u) => Math.min(1, Math.sin(u * Math.PI) * 2.5) },
                tint: id === 'reseal' ? [0xb8f0ff, 0xffffff] : 0xffffff, frequency: 700 }).setDepth(D + 3));
        }
        if (id === 'bind') {
            // the ring inlaid in the flags lights arc by arc round it (typed: isle2_roomfx ringlit_0-7), and each standing stone's
            // rune flares in turn, round the ring the same way
            const arcs = Array.from({ length: 8 }, (_, k) => art(this.add.image(36 * 4, 101 * 4, 'isle2_roomfx', 'ringlit_' + k).setOrigin(0).setScale(4).setBlendMode(Phaser.BlendModes.ADD).setAlpha(0).setDepth(D + 0.7)));
            const runes = [[158, 328], [282, 296], [522, 296], [646, 328]].map(([sx, sy]) => art(this.add.image(sx, sy, 'mn_glow').setTint(0x6ad86a).setBlendMode(Phaser.BlendModes.ADD).setDisplaySize(44, 60).setAlpha(0.15).setDepth(D + 1)));
            tick(t => { const ph = t * 0.0011;
                arcs.forEach((a, k) => a.setAlpha(0.15 + 0.75 * Math.max(0, Math.cos(ph - k * Math.PI / 4)) ** 3));
                runes.forEach((r, k) => r.setAlpha(0.12 + 0.6 * Math.max(0, Math.sin(t * 0.0016 - k * 1.3)) ** 4)); });
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
            const crys = CR.map(([x, y, h, sd]) => {
                const z = D + (y < AY + 8 ? 1.3 : 3.4) + y * 0.0001;
                // its shadow on the flags and the broken stone round its foot (typed: isle_fx csh_s/m/l, chip0-3), on the room's pixels
                art(this.add.image(Math.round(x / 4) * 4, Math.round((y + 2) / 4) * 4, 'isle_fx', h <= 16 ? 'csh_s' : h <= 24 ? 'csh_m' : 'csh_l').setScale(4).setDepth(D + 1.15));
                const R = MenuArt.rng(sd * 31);
                for (let r = 0; r < 7; r++) { const rx = x + (R() - 0.5) * h * 4, ry = y + (R() - 0.3) * h * 0.6; art(this.add.image(Math.round(rx / 4) * 4, Math.round(ry / 4) * 4, 'isle_fx', 'chip' + (Math.floor(R() * 4))).setOrigin(0).setScale(4).setDepth(D + 1.16)); }
                const gl = art(this.add.image(x, y - h * 2, 'mn_glow').setTint(0xa070ff).setBlendMode(Phaser.BlendModes.ADD).setDisplaySize(h * 6, h * 9).setAlpha(0.2).setDepth(z - 0.01));
                art(this.add.image(x, y + 4, 'isle_crystal', h + '_' + sd).setOrigin(0.5, 1).setScale(4).setDepth(z));
                const fl = art(this.add.image(x, y + 4, 'isle_crystal', h + '_' + sd).setOrigin(0.5, 1).setScale(4).setDepth(z + 0.001).setTintFill(0xd8b8ff).setBlendMode(Phaser.BlendModes.ADD).setAlpha(0));
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
                    const B = this._cruBoost, bv = B ? Math.max(0, B.v * (1 - (t - B.t) / B.ms)) * (B.ring ? Math.max(0, Math.sin((t - B.t) * 0.012 - i * 0.7)) : 1) : 0;   // the reforge stirs them all (a ring of light running round on a big roll)
                    const v = Math.min(1, (t < Q.t0 ? 0 : Math.sin((t - Q.t0) / Q.len * Math.PI) ** 2 * Q.amp) + bv);
                    crys[i].fl.setAlpha(v * 0.55); crys[i].gl.setAlpha(0.15 + v * 0.55);
                });
                ch.fillStyle(0x9a5ae8, 0.6 + Math.sin(t * 0.004) * 0.2); ch.fillRect(AX0 - 6, AY0 - 4, 12, 6);   // the spring under the crucible
            });
            art(this.add.particles(0, 0, 'mn_px2', { x: { min: AX - 50, max: AX + 50 }, y: MY - 4, lifespan: 3200, speedY: { min: -26, max: -10 }, speedX: { min: -6, max: 6 },
                scale: { start: 3, end: 7 }, alpha: { start: 0.18, end: 0 }, tint: [0x8a4ae0, 0xb07aff], frequency: 140 }).setDepth(D + 3));   // the vapour, slow and heavy
            art(this.add.particles(0, 0, 'mn_px2', { x: AX, y: MY - 4, lifespan: 1600, speed: { min: 20, max: 60 }, angle: { min: 240, max: 300 }, gravityY: 30,
                scale: { start: 1.2, end: 0 }, tint: [0xffe0ff, 0xd8a8ff], blendMode: 'ADD', frequency: 420 }).setDepth(D + 3));
            for (const [sx, sy] of [[120, 300], [700, 320]]) { const sg = art(this.add.image(sx, sy, 'mn_glow').setTint(0x9a6aff).setBlendMode(Phaser.BlendModes.ADD).setDisplaySize(160, 260).setAlpha(0.3).setDepth(D + 1)); this.tweens.add({ targets: sg, alpha: 0.12, duration: 1400, yoyo: true, repeat: -1 }); }
        } else if (id === 'combine') {
            // the two pools stirring: ripples (isle_fx rip0-3) open and fade at spots on the water, now here, now there; light
            // (isle_fx glint) runs along the gold channels into the dais
            const SPOTS = [[30, 124], [44, 127], [69, 126], [72, 129], [36, 130], [60, 131], [32, 122], [76, 124],
                           [120, 125], [132, 128], [158, 126], [164, 129], [126, 131], [150, 131], [166, 123], [140, 124]];
            const rips = SPOTS.map(([x, y]) => { const r = art(this.add.sprite(x * 4, y * 4, 'isle_fx', 'rip0').setOrigin(0).setScale(4).setDepth(D + 0.6).setVisible(false)); r.on('animationcomplete', () => r.setVisible(false)); return r; });
            let ripAt = 0;
            tick(t => { if (t < ripAt) return; ripAt = t + 260 + Math.random() * 420; const r = rips[Math.floor(Math.random() * rips.length)]; if (!r.visible) r.setVisible(true).play('isle_rip'); });
            // water dripping off the ends of the gold channels into the pools, a ring opening where each drop lands
            for (const [dx, dy] of [[27, 121], [174, 121]]) { const rp = art(this.add.sprite((dx - 3) * 4, (dy + 6) * 4, 'isle_fx', 'rip0').setOrigin(0).setScale(4).setDepth(D + 0.65).setVisible(false)); rp.on('animationcomplete', () => rp.setVisible(false));
                let next = 600 + Math.random() * 900;
                tick(t => { if (t < next) return; next = t + 1500 + Math.random() * 1400;
                    const dp = art(this.add.image(dx * 4, dy * 4, 'mn_px2').setScale(2).setTint(0xb8dcff).setDepth(D + 0.7)); C.sort('depth');
                    this.tweens.add({ targets: dp, y: (dy + 6) * 4, duration: 280, ease: 'Quad.easeIn', onComplete: () => { dp.destroy(); rp.setVisible(true).play('isle_rip'); } }); }); }
            const glints = [-1, 1].map(() => art(this.add.image(0, 0, 'isle_fx', 'glint').setScale(4).setBlendMode(Phaser.BlendModes.ADD).setDepth(D + 1.6)));
            this._poolGlow = [220, 580].map(px => art(this.add.image(px, 505, 'mn_glow').setTint(0xffd060).setBlendMode(Phaser.BlendModes.ADD).setDisplaySize(300, 90).setAlpha(0).setDepth(D + 1.4)));
            tick(t => glints.forEach((g2, i) => { const s2 = i ? 1 : -1, u = (t * 0.0006 + (s2 > 0 ? 0.5 : 0)) % 1;
                g2.setPosition(Math.round((AX + s2 * (300 - u * 220)) / 4) * 4, Math.round((AY + 24 - u * 10) / 4) * 4).setAlpha(Math.sin(u * Math.PI)); }));
        } else if (id === 'reseal') {
            // candles flickering, the hanging chains swaying
            // each candle (where the room's PNG has them, [x, y] in its own pixels): its flame flickering through typed
            // frames (isle_fx flame0-3) over the baked one, and its light breathing with it
            for (const [cx2, cy2] of [[62, 122], [73, 126], [127, 126], [138, 122], [82, 130], [118, 130]]) {
                const f = art(this.add.image(cx2 * 4, cy2 * 4 - 14, 'mn_glow').setTint(0xffc060).setBlendMode(Phaser.BlendModes.ADD).setDisplaySize(36, 44).setAlpha(0.7).setDepth(D + 1));
                this.tweens.add({ targets: f, alpha: { from: 0.4, to: 0.85 }, scaleX: f.scaleX * 0.85, duration: 120 + Math.random() * 160, yoyo: true, repeat: -1 });
                const fl = art(this.add.sprite((cx2 - 1) * 4, (cy2 - 8) * 4, 'isle_fx', 'flame0').setOrigin(0).setScale(4).setDepth(D + 0.6));
                fl.play({ key: 'isle_flame', startFrame: Math.floor(Math.random() * 4), frameRate: 6 + Math.random() * 5 });
            }
            // the chains hung from the lintel's underside (and its fallen end) swing: each link stays upright and is carried
            // a little further the lower it hangs, in steps of the room's pixels (a pendulum, not a turned picture)
            const link = this._linkTex(), chains = [];
            for (const [cx2, n, top] of [[250, 7, 170], [330, 5, 170], [410, 6, 170], [560, 4, 174]]) {
                const ls = [];
                for (let j = 0; j < n; j++) ls.push(art(this.add.image(cx2, top + j * 16, link).setScale(2.2).setAngle(j % 2 ? 90 : 0).setTint(0x8a8aa8).setDepth(D + 1)));
                chains.push({ ls, x: cx2, p: cx2 * 0.013, w: 1 / (1800 + cx2 * 2) });
            }
            tick(t => { for (const Ch of chains) { const s = Math.sin(t * Math.PI * 2 * Ch.w * 0.5 + Ch.p); Ch.ls.forEach((l, j) => l.setX(Ch.x + Math.round(s * j * 0.45) * 2)); } });
            // the runes cut along the lintel, lit one after another across it
            const lr = Array.from({ length: 8 }, (_, k) => art(this.add.image((70 + k * 6) * 4 + 4, 36 * 4 + 2, 'mn_glow').setTint(0x7ad8ff).setBlendMode(Phaser.BlendModes.ADD).setDisplaySize(26, 18).setAlpha(0.1).setDepth(D + 1)));
            tick(t => lr.forEach((g, k) => g.setAlpha(0.08 + 0.7 * Math.max(0, Math.sin(t * 0.0021 - k * 0.55)) ** 6)));
            art(this.add.particles(0, 0, 'mn_px2', { x: { min: 220, max: 580 }, y: { min: 200, max: 480 }, lifespan: 3000, speedY: { min: -8, max: 8 }, speedX: { min: -6, max: 6 },
                scale: { start: 1, end: 0 }, alpha: { start: 0.6, end: 0 }, tint: [0x7ad8ff, 0xd8f0ff], blendMode: 'ADD', frequency: 140 }).setDepth(D + 1));
        }
        C.sort('depth');
        // the room's name and the way back
        this._roomTitle = keep(this.add.text(SX / 2, 30, R.name, { fontSize: '26px', fontFamily: UIKit.FONT.title, fontStyle: 'bold', color: UIKit._hex(MenuArt.mix(R.col, 0xffffff, 0.35)), stroke: '#0a0618', strokeThickness: 5 }).setOrigin(0.5).setDepth(D + 6));
        if (this._roomTitle.x - this._roomTitle.width / 2 < 176) this._roomTitle.setX(176 + this._roomTitle.width / 2);   // a narrow window: clear of the way back
        this._btn({ x: 90, y: 34, w: 150, h: 34, label: '◂ THE ISLE', accent: UIKit.PALETTE.line, depth: D + 6, fontSize: '13px', fireOn: 'down', onClick: () => this._leaveRoom() }).objs.forEach(keep);
    }
    static ALTAR = { bind: [48, 40], reforge: [56, 40], combine: [96, 36], reseal: [40, 50] };   // each altar's size in its own pixels (drawn 3x in its room, small on the island)
    // a ripe crystal crop (the garden's station icon): the Dust Garden's own, drawn by a stand-in with the garden's methods
    _cropTex(st) {
        const g = this._gardenArt ??= Object.assign(Object.create(GardenScene.prototype), { textures: this.textures, anims: this.anims, add: this.add, make: this.make, sys: this.sys, cache: this.cache });
        return GardenScene.prototype._cropTex.call(g, Garden.SEEDS[0], st);
    }
    _sheet(...a) { return GardenScene.prototype._sheet.apply(this, a); }
    // a chain link and a padlock (the reseal shrine, the unsealing)
    _linkTex() { return 'isle_link'; }
    _lockTex() { return 'isle_lock'; }

    // Are you sure? (salvaging can't be undone)
    _confirm(title, body, yes, onYes) {
        this._closeConfirm();
        const W = this.scale.width, H = this.scale.height, D = 70, objs = this._confirmObjs = [], keep = o => { objs.push(o); return o; };
        const veil = keep(this.add.rectangle(0, 0, W, H, 0x05030a, 0.7).setOrigin(0).setDepth(D).setInteractive());
        const bw = 440, bh = 190, x = W / 2 - bw / 2, y = H / 2 - bh / 2;
        // the box: the board (isle2_ui board, 2x), an inner rim in the warning's orange
        keep(this._ns(x, y, bw, bh, 'board', D + 1));
        keep(this._ns(x + 10, y + 10, bw - 20, bh - 20, 'rim_s', D + 1).setTint(0xff8a4a).setAlpha(0.6));
        keep(this.add.text(W / 2, y + 30, title, { fontSize: '20px', fontFamily: UIKit.FONT.title, fontStyle: 'bold', color: '#ffb07a', stroke: '#0a0618', strokeThickness: 3 }).setOrigin(0.5).setDepth(D + 2));
        keep(this.add.text(W / 2, y + 76, body, { fontSize: '13px', fontFamily: 'monospace', color: '#f4e8cc', align: 'center', lineSpacing: 2, wordWrap: { width: bw - 40 } }).setOrigin(0.5).setDepth(D + 2));
        this._btn({ x: W / 2 - 100, y: y + bh - 38, w: 170, h: 40, label: 'KEEP IT', accent: UIKit.PALETTE.line, depth: D + 3, fontSize: '14px', fireOn: 'down', onClick: () => { Sfx.play(this, 'click'); this._closeConfirm(); } }).objs.forEach(keep);
        this._btn({ x: W / 2 + 100, y: y + bh - 38, w: 170, h: 40, label: yes, accent: 0xff8a4a, depth: D + 3, fontSize: '14px', fireOn: 'down', onClick: () => { this._closeConfirm(); onYes(); } }).objs.forEach(keep);
        // it drops in over a darkening screen
        veil.setAlpha(0); this.tweens.add({ targets: veil, alpha: 1, duration: 160 });
        this._slideIn(objs.filter(o => o !== veil), 0, -14, 0, 200);
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
    _closeConfirm() { for (const o of (this._confirmObjs || [])) { if (o?.active) this.tweens.killTweensOf(o); o?.destroy?.(); } this._confirmObjs = null; }

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
        this._satchel(keep, px, py, ph, D);
        keep(this.add.text(px + 102, py + 20, ST.name, { fontSize: '17px', fontFamily: UIKit.FONT.title, fontStyle: 'bold', color: '#ffffff', stroke: '#0a0618', strokeThickness: 3 }).setOrigin(0.5).setDepth(D + 1));
        const g = keep(this.add.graphics().setDepth(D + 2));
        const txt = (x, y, s, o = {}) => keep(this.add.text(x, y, s, Object.assign({ fontSize: '12px', fontFamily: 'monospace', color: UIKit.CSS.textMid }, o)).setDepth(D + 3));
        const btn = o => { const k = this._btn(Object.assign({ depth: D + 4, fontSize: '11px', fireOn: 'down' }, o)); objs.push(...k.objs); return k; };
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
        if (sub) txt(L, by0 - 26, sub, { fontSize: '10px', color: UIKit.CSS.textMid, wordWrap: { width: CW } });
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
            // a cloth bookmark, its tail notched (typed: isle_fx tab_on / tab_off, grey cloth tinted to the element)
            const ty = py + (on ? 22 : 26), tb = this._tab(keep, x, ty, tw, 24, col, on, D + 2); if (!has) tb.forEach(o => o.setAlpha(0.4));   // a gem tab (typed: isle2_ui tab_fill, tab_rim, gem)
            const lab = txt(x + tw / 2 + 6, ty + 12, name, { fontSize: '11px', fontStyle: 'bold', color: UIKit._hex(on ? MenuArt.mix(col, 0xffffff, 0.55) : MenuArt.mix(col, 0x8a7aa8, 0.55)), stroke: '#0a0618', strokeThickness: 3 }).setOrigin(0.5);
            if (has) keep(this.add.zone(x + tw / 2, ty + 12, tw, 26).setInteractive({ useHandCursor: true }).setDepth(D + 5))
                .on('pointerover', () => { if (on) return; tb[0].setTint(MenuArt.mix(col, 0x0c0918, 0.7)); lab.setColor(UIKit._hex(MenuArt.mix(col, 0xffffff, 0.3))); Sfx.play(this, 'hover'); })
                .on('pointerout', () => { if (on) return; tb[0].setTint(0x221a3c); lab.setColor(UIKit._hex(MenuArt.mix(col, 0x8a7aa8, 0.55))); })
                .on('pointerdown', () => {
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
            if (on) keep(this.add.image(cx2, wy + 30, 'mn_glow').setTint(0xd8b8ff).setBlendMode(Phaser.BlendModes.ADD).setDisplaySize(pw2 * 0.9, 44).setAlpha(0.3).setDepth(D + 2));
            const stand = keep(this.add.image(cx2, wy + 27, 'isle2_ui', 'plinth').setOrigin(0.5, 0).setScale(2).setDepth(D + 2));   // its plinth (typed: isle2_ui plinth)
            this._aura(keep, x + ww / 2, wy + 22, n, slots, Enchants.corrupted(it.id));
            const ik = MenuArt.iconSheet(this, it.id);
            if (ik) ShopScene.enchAura(this, keep(this.add.sprite(x + ww / 2, wy + 22, ik, '0').setScale(1.3).setDepth(D + 4)).play(ik), it.id).forEach(keep);
            txt(x + ww / 2, wy + 42, it.name, { fontSize: '10px', fontStyle: 'bold', color: on ? UIKit.CSS.textHi : UIKit.CSS.textMid }).setOrigin(0.5, 0);
            for (let s = 0; s < slots; s++) {   // a pip per slot, lit when it's filled
                const sx = x + ww - 8 - (slots - 1 - s) * 8, b = Enchants.on(it.id)[s];
                keep(this.add.image(sx, wy + 8, 'isle_fx', 'pip').setScale(2).setTint(b ? Enchants.rarity(b.id).col : 0x3a3048).setDepth(D + 3));
            }
            this._weaponCards[it.id] = { x: x + ww / 2, y: wy + 22 };
            keep(this.add.zone(x + ww / 2, wy + wh / 2, ww, wh).setInteractive({ useHandCursor: true }).setDepth(D + 5))
                .on('pointerover', () => { if (!on) { stand.setTint(0xd8ccff); Sfx.play(this, 'hover'); } })
                .on('pointerout', () => { if (!on) stand.clearTint(); })
                .on('pointerdown', () => { this._w = it; Sfx.play(this, 'click'); this._panel(); });
        });

        // ── the chosen weapon's slots (fixed room for three) ──
        const slots = Enchants.slots(w.id), on = Enchants.on(w.id), sy0 = wy + wh + 10;
        for (let i = 0; i < 3; i++) {   // a rune socket each: hollow when empty, the book sitting in it when bound, chained shut past what it holds
            const b = on[i], sx = L + CW * (i + 0.5) / 3, sy = sy0 + 24, locked = i >= slots, col = b ? Enchants.rarity(b.id).col : 0x8a7aa8;
            keep(this.add.image(sx, sy, 'isle2_ui', locked ? 'socket_x' : 'socket').setScale(2).setDepth(D + 2)   // a ring of rune stones (typed: isle2_ui socket / socket_x), lit in its book's colour
                .setTint(locked ? 0xffffff : b ? col : 0x7a70a0).setAlpha(locked ? 0.85 : 1));
            if (locked) { if (i === slots) txt(L + CW * (slots + (3 - slots) / 2) / 3, sy + 32, `the ${w.name} holds ${slots}`, { fontSize: '10px', color: UIKit.CSS.textLo }).setOrigin(0.5, 0); continue; }
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
        this._rule(keep, L, by0, R - L, D + 2, EnchantScene.STATIONS.find(s => s.id === mode)?.col);
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
            keep(this._ns(L - 6, gy - 8, CW + 12, sh + 4, 'inset', D + 1.9));
            for (let x = L + cw + 3; x < R - 4; x += cw + 6) keep(this.add.tileSprite(Math.round(x - 1), gy - 6, 1, Math.round(sh / 2), 'isle_fx', 'post').setOrigin(0).setScale(2).setAlpha(0.85).setDepth(D + 1.91));   // the uprights between the books, behind the planks (typed: isle_fx post)
            for (let r = 0; r < used; r++) keep(this.add.nineslice(L - 8, gy + r * (ch + 6) + ch - 20, 'isle2_ui', 'plank', Math.round((CW + 16) / 2), 5, 3, 3).setOrigin(0).setScale(2).setDepth(D + 1.92));
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
            if (sel) keep(this.add.image(ix, cy + ch - 20, 'mn_glow').setTint(0xffd060).setBlendMode(Phaser.BlendModes.ADD).setDisplaySize(cw * 0.9, 16).setAlpha(0.5).setDepth(D + 2));
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
            if (picked) { keep(this.add.image(ix, cy + ch - 20, 'mn_glow').setTint(0xffd060).setBlendMode(Phaser.BlendModes.ADD).setDisplaySize(cw * 0.95, 18).setAlpha(0.6).setDepth(D + 2)); txt(ix + 16, iy - 18, '✓', { fontSize: '15px', fontStyle: 'bold', color: '#ffd060', stroke: '#1a1006', strokeThickness: 3 }).setOrigin(0.5); }
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
        this._rule(keep, L, ay, R - L, D + 2, EnchantScene.STATIONS.find(s => s.id === mode)?.col);
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
            if (corrupt) { Sfx.play(this, 'deny'); this._say('Rewriting corrupted books isn\'t open yet.'); return; }   // (the rewrite panel isn't built yet)
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
                    if (at) this._crumble(at, d, () => this._gain('dust', v, at));
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
        const ar = keep(this.add.image(A.x, A.y - 40, 'isle_fx', 'arrow').setOrigin(0.5, 0.25).setScale(2).setDepth(D));   // (typed: isle_fx arrow)
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
    // the board: a grimoire's cover bound in gold (isle2_ui board, 2x), its crest on the top edge holding the station's gem,
    // the station's name on a ribbon (rib) in its colour
    _satchel(keep, px, py, ph, D) {
        const col = EnchantScene.STATIONS.find(s => s.id === this._mode)?.col ?? 0x9a6aff;
        keep(this._ns(px, py, 474, ph, 'board', D));
        keep(this.add.image(px + 237, py, 'isle2_ui', 'crest').setOrigin(0.5, 0).setScale(2).setDepth(D + 0.5));
        keep(this.add.image(px + 237, py + 9, 'isle2_ui', 'gem').setScale(2).setTint(col).setDepth(D + 0.6));
        keep(this.add.nineslice(px + 24, py + 12, 'isle2_ui', 'rib', 78, 8, 6, 6).setOrigin(0).setScale(2).setTint(col).setDepth(D + 0.5));
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
        const ns = (x, y, w, h, f) => add(this._ns(x, y, w, h, f, 0));
        ns(-pw / 2, -ph / 2, pw, ph, 'board');
        add(this.add.text(-pw / 2 + 20, -ph / 2 + 16, 'WHICH BOOK GOES IN?', { fontSize: '20px', fontFamily: UIKit.FONT.title, fontStyle: 'bold', color: '#e0ccff' }));
        add(this.add.text(-pw / 2 + 20, -ph / 2 + 44, 'Its quality comes out new: better or worse, the new roll stays. High rolls are rare.', { fontSize: '11px', fontFamily: 'monospace', color: '#a898c8' }));
        if (!order.length) this._emptySatchel(add, 0, -20, pw - 40, 0);
        else {   // a bookshelf: a dark back, a plank under each row
            const sx0 = -pw / 2 + 12, sy0 = -ph / 2 + 64, rows = Math.min(ROWS, Math.ceil(order.slice(page * PER).length / COLS));
            ns(sx0, sy0, pw - 24, rows * (ch + 8) + 2, 'inset');
            for (let r = 0; r < rows; r++) add(this.add.nineslice(sx0 - 2, sy0 + 6 + r * (ch + 8) + ch - 30, 'isle2_ui', 'plank', Math.round((pw - 20) / 2), 5, 3, 3).setOrigin(0).setScale(2));
        }
        const g = add(this.add.graphics());   // the chosen book's glow and each book's rarity, over the shelf
        order.slice(page * PER, page * PER + PER).forEach((b, j) => {
            const d = Enchants.def(b.id), col = Enchants.RARITY[d.r].col, gr = Enchants.grade(b.q), sel = pick === b.i;
            const cx = -pw / 2 + 16 + (j % COLS) * (cw + 8), cy = -ph / 2 + 70 + Math.floor(j / COLS) * (ch + 8);
            const pl = cy + ch - 30;   // standing on its plank; the chosen one lifted, gold under it
            if (sel) add(this.add.image(cx + cw / 2, pl + 2, 'mn_glow').setTint(0xffd060).setBlendMode(Phaser.BlendModes.ADD).setDisplaySize(cw * 0.9, 16).setAlpha(0.55));
            g.fillStyle(col, 0.9); g.fillRect(cx + cw / 2 - 12, pl - 2, 24, 2);
            const ik = ShopScene.bookIcon(this, d.r, d.b, d.id), ic = add(this.add.sprite(cx + cw / 2, pl - 20 - (sel ? 6 : 0), ik, '0').setScale(2.4)).play(ik);
            add(this.add.text(cx + cw / 2, pl + 9, `${d.name} ${Enchants.roman(b.lvl)}`, { fontSize: '10px', fontFamily: 'monospace', fontStyle: 'bold', color: UIKit._hex(col) }).setOrigin(0.5, 0));
            add(this.add.text(cx + cw / 2, pl + 21, `${gr.name} ${b.q}%`, { fontSize: '10px', fontFamily: 'monospace', fontStyle: 'bold', color: UIKit._hex(gr.col) }).setOrigin(0.5, 0));
            add(this.add.zone(cx, cy, cw, ch).setOrigin(0).setInteractive({ useHandCursor: true })).on('pointerdown', () => { Sfx.play(this, 'hover'); this._bookPicker(page, b.i); });
        });
        if (pages > 1) for (const [dx, dir, sym] of [[-60, -1, '‹'], [60, 1, '›']]) add(this.add.text(dx, -ph / 2 + 70 + ROWS * (ch + 8) + 2, sym, { fontSize: '22px', color: '#e0ccff' }).setOrigin(0.5, 0).setInteractive({ useHandCursor: true })).on('pointerdown', () => this._bookPicker((page + dir + pages) % pages, pick));
        // the chosen one: its cost, and the confirmation
        const by = ph / 2 - 70, sel = pick != null ? all[pick] : null;
        if (order.length) add(this.add.nineslice(-pw / 2 + 20, by - 18, 'isle2_ui', 'rule', Math.round((pw - 40) / 2), 2, 1, 1).setOrigin(0, 0.5).setScale(2));
        if (!sel) { if (order.length) add(this.add.text(0, by + 10, 'pick a book', { fontSize: '13px', fontFamily: 'monospace', color: '#a898c8' }).setOrigin(0.5)); }
        else {
            const d = Enchants.def(sel.id), corrupt = d.r === 5, cost = Enchants.REFORGE[d.r], can = !corrupt && sel.q < 100 && Enchants.dust() >= cost;
            add(this.add.text(-pw / 2 + 20, by - 4, `${d.name} ${Enchants.roman(sel.lvl)}  ·  now ${sel.q}%`, { fontSize: '15px', fontFamily: UIKit.FONT.title, fontStyle: 'bold', color: UIKit._hex(Enchants.RARITY[d.r].col) }));
            add(this.add.text(-pw / 2 + 20, by + 20, corrupt ? 'Corrupted: rewritten by sacrificing books, not reforged.' : sel.q >= 100 ? 'Already perfect.' : `costs ✧${cost} dust  (you have ✧${Enchants.dust()})`, { fontSize: '11px', fontFamily: 'monospace', color: can || corrupt ? '#c8b8e8' : '#ff8a7a' }));
            this._btn({ x: W / 2 + pw / 2 - 110, y: H / 2 + by + 14, w: 180, h: 44, fontSize: '14px', depth: D + 3, fireOn: 'down', label: corrupt ? 'REWRITE IT' : `REFORGE · ✧${cost}`, accent: can || corrupt ? 0x9a6aff : P.line, onClick: () => {
                if (corrupt) { Sfx.play(this, 'deny'); this._say('Rewriting corrupted books isn\'t open yet.'); return; }   // (the rewrite panel isn't built yet)
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
            this._roomSockets = [];
            const ik = MenuArt.iconSheet(this, w.id);
            this._altarWeapon = null;
            if (ik) { const ws = this._altarWeapon = keep(this.add.sprite(A.x, A.y, ik, '0').setScale(3.4).setDepth(D - 1)).play(ik); ShopScene.enchAura(this, ws, w.id).forEach(keep); float(ws); }
            const slots = Enchants.slots(w.id), on = Enchants.on(w.id);
            for (let i = 0; i < slots; i++) {   // a socket per slot, round under the weapon, lit with its book
                const a = -Math.PI / 2 + (i - (slots - 1) / 2) * 0.55, x = A.x + Math.cos(a) * 120, y = A.y + 20 + Math.sin(a) * 120, b = on[i];   // in an arc over it
                const sc = b ? Enchants.rarity(b.id).col : 0x6ad86a, sk = keep(this.add.image(x, y, 'isle2_ui', 'socket').setScale(2).setTint(sc).setAlpha(b ? 1 : 0.75).setDepth(D - 2));   // a socket: a ring of rune stones, lit by the book in it (typed: isle2_ui socket)
                (this._roomSockets ||= [])[i] = sk;
                if (b) {   // hover a filled socket to see it; click it to unbind (it asks three times: the enchant is lost)
                    const d = Enchants.def(b.id), bk = keep(this.add.sprite(x, y, ShopScene.bookIcon(this, d.r, d.b, d.id), '0').setScale(1.1).setDepth(D - 1)), uc = Enchants.unbindCost(b);
                    const tip = keep(this.add.text(x, y - 30, `${d.name} ${Enchants.roman(b.lvl)}\nclick to unbind  ·  ✦${uc}`, { fontSize: '11px', fontFamily: 'monospace', fontStyle: 'bold', color: '#ffd8c8', align: 'center', backgroundColor: '#0a0618dd', padding: { x: 6, y: 4 } }).setOrigin(0.5, 1).setDepth(D + 6).setVisible(false));
                    keep(this.add.zone(x, y, 40, 40).setInteractive({ useHandCursor: true }).setDepth(D + 5))
                        .on('pointerover', () => { tip.setVisible(true); bk.setScale(1.35); sk.setTint(0xff6a5a); Sfx.play(this, 'hover'); })
                        .on('pointerout', () => { tip.setVisible(false); bk.setScale(1.1); sk.setTint(sc); })
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
        const dim = keep(this.add.rectangle(0, 0, this.scale.width - 490, this.scale.height, 0x05030a, 0.55).setOrigin(0).setDepth(D).setAlpha(0));
        this.tweens.add({ targets: dim, alpha: 1, duration: 300 });
        for (const pg of (this._poolGlow || [])) this.tweens.add({ targets: pg, alpha: 0.55, duration: 1300, ease: 'Quad.easeIn' });   // the pools wake as the copies circle
        const ik = ShopScene.bookIcon(this, d.r, d.b, d.id), n = pk.length;
        const bks = pk.map((_, k) => keep(this.add.sprite(A.x + Math.cos(k / n * Math.PI * 2) * 150, A.y + Math.sin(k / n * Math.PI * 2) * 60, ik, '0').setScale(2.2).setDepth(D + 2)).play(ik));
        Sfx.play(this, 'e_beam');
        const spin = { t: 0 };
        this.tweens.add({ targets: spin, t: 1, duration: 1300, ease: 'Cubic.easeIn', onUpdate: () => {
            bks.forEach((b, k) => { const a = k / n * Math.PI * 2 + spin.t * 9, r = 150 * (1 - spin.t); b.setPosition(A.x + Math.cos(a) * r, A.y + Math.sin(a) * r * 0.45).setScale(2.2 - spin.t * 0.8); });
        }, onComplete: () => {
            bks.forEach(b => b.destroy());
            this._ring(A.x, A.y, res.ok ? 0xffd060 : 0x8a7a68, D + 1, { ms: 700, scale: 4 }); if (res.ok) this._glyphs(A.x, A.y, [0xffd060, 0xffffff], 20, D + 4, { speed: { min: 100, max: 280 } });
            const sp = keep(this.add.particles(0, 0, 'mn_px2', { x: A.x, y: A.y, lifespan: 1000, speed: { min: 80, max: 280 }, gravityY: 150, scale: { start: 2.2, end: 0 }, alpha: { start: 1, end: 0 },
                tint: res.ok ? [0xffd060, 0xffffff, R.col] : [0x8a7a68, 0x5a5068], blendMode: res.ok ? 'ADD' : 'NORMAL', emitting: false }).setDepth(D + 3));
            sp.explode(res.ok ? 80 : 40);
            if (res.ok) {
                this._flash(0xffd060, 0.35, 300); this.cameras.main.shake(260, 0.008); Sfx.play(this, 'e_combine');
                this._sparks(A.x, A.y, [0xffd060, 0xffffff, R.col], 30, D + 4, { speed: { min: 100, max: 300 }, lifespan: 1000 });
                for (const pg of (this._poolGlow || [])) this.tweens.add({ targets: pg, alpha: { from: 1, to: 0 }, duration: 1600, ease: 'Quad.easeOut' });
                const nb = keep(this.add.sprite(A.x, A.y, ik, '0').setScale(4).setDepth(D + 2)).play(ik);
                this.tweens.add({ targets: nb, scale: { from: 5, to: 3.4 }, duration: 360, ease: 'Back.easeOut' });
                keep(this.add.text(A.x, A.y + 80, `${d.name} ${Enchants.roman(res.book.lvl)}!`, { fontSize: '24px', fontFamily: UIKit.FONT.title, fontStyle: 'bold', color: '#ffd060', stroke: '#000', strokeThickness: 5 }).setOrigin(0.5).setDepth(D + 3));
                this._say(`It took: ${d.name} ${Enchants.roman(res.book.lvl)}, ${res.book.q}%.`);
            } else {
                this.cameras.main.shake(200, 0.005); Sfx.play(this, 'e_reforge', { d: -1 }); Sfx.play(this, 'e_crack');
                for (const pg of (this._poolGlow || [])) this.tweens.add({ targets: pg, alpha: 0, duration: 500 });
                keep(this.add.text(A.x, A.y + 80, `IT CRACKED`, { fontSize: '24px', fontFamily: UIKit.FONT.title, fontStyle: 'bold', color: '#ff7a6a', stroke: '#000', strokeThickness: 5 }).setOrigin(0.5).setDepth(D + 3));
                keep(this.add.text(A.x, A.y + 108, `lost one copy (${res.lost.q}%), the rest are back`, { fontSize: '13px', fontFamily: 'monospace', color: '#d8c8b8', stroke: '#000', strokeThickness: 3 }).setOrigin(0.5).setDepth(D + 3));
                this._say(`It didn't take (${Math.round(res.chance * 100)}%). One copy is gone.`);
            }
            this.time.delayedCall(1700, () => this.tweens.add({ targets: objs.filter(o => o?.active && o.alpha !== undefined), alpha: 0, duration: 300, onComplete: () => {
                objs.forEach(o => { if (o?.active) { this.tweens.killTweensOf(o); o.destroy(); } }); this._busy = false; this._refreshAll?.(); } }));
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
            const t = (k - 4) / 4, tx = A.x + t * 40, ty = A.y + s2 * t * 40;
            const l = keep(this.add.image(A.x + s2 * 380, A.y - 160 + k * 30, 'isle_fx', k % 2 ? 'link_e' : 'link_d').setScale(2.4).setDepth(D + 1).setFlipX(s2 > 0));
            this.tweens.add({ targets: l, x: tx, y: ty, delay: 120 + k * 35 + (s2 > 0 ? 160 : 0), duration: 280, ease: 'Cubic.easeOut', onComplete: () => k === 8 && Sfx.play(this, 'e_chain') });
            links.push(l);
        }
        const lock = keep(this.add.image(A.x, A.y - 140, this._lockTex()).setScale(3).setDepth(D + 2).setAlpha(0));
        this.tweens.add({ targets: lock, y: A.y + 4, alpha: 1, delay: 820, duration: 260, ease: 'Bounce.easeOut', onComplete: () => {
            Sfx.play(this, 'e_seal'); this.cameras.main.shake(140, 0.006);
            this._sparks(A.x, A.y + 4, [0x7ad8ff, 0xffffff], 14, D + 3, { speed: { min: 60, max: 180 }, lifespan: 600 });
            book.stop(); book.setTexture(ShopScene.bookIcon(this, -1), '0');
            this.tweens.add({ targets: [book, lock, ...links], tint: 0x6a6a8a, duration: 200 });
            this._ring(A.x, A.y, 0x7ad8ff, D, { ms: 500, scale: 3 });
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
        // the card: a small board (isle2_ui board_d, 2x), its rim (rim_s) the book's rarity
        objs.push(this.add.nineslice(x, ty, 'isle2_ui', 'board_d', TW / 2, Math.max(16, Math.ceil(th / 2)), 8, 8, 8, 8).setOrigin(0).setScale(2).setAlpha(0.98).setDepth(D));
        objs.push(this.add.nineslice(x, ty, 'isle2_ui', 'rim_s', TW / 2, Math.max(16, Math.ceil(th / 2)), 8, 8, 8, 8).setOrigin(0).setScale(2).setTint(R.col).setAlpha(0.8).setDepth(D));
    }
    _hideTip() { for (const o of (this._tip || [])) o.destroy(); this._tip = null; }

    // ── THE CODEX ─────────────────────────────────────────────────────────────
    // Every book there is, one rarity a page: a card per book (found ones lit, the rest dark),
    // and the chosen one read out on the right, from level I to its top level.
    _codex(page = null, pick = null) {
        const fresh = !this._codexObjs;
        this._closeCodex();
        this._hideTip();
        const W = this.scale.width, H = this.scale.height, D = 60, objs = this._codexObjs = [], keep = o => { objs.push(o); return o; };
        const seen = Enchants.seen(), RA = Enchants.RARITY, L = Enchants.LIST;
        page ??= this._codexPage ?? 0; this._codexPage = page;
        const books = L.filter(d => d.r === page), R = RA[page];
        pick = books.find(d => d.id === pick) || books.find(d => seen.has(d.id)) || books[0];
        // the backdrop and the tome's frame
        keep(this.add.rectangle(0, 0, W, H, 0x05030c, 0.88).setOrigin(0).setDepth(D).setInteractive());
        const PX = 70, PY = 60, PW = W - 140, PH = H - 110;
        const ns = (x, y, w, h, f, d = D) => keep(this._ns(x, y, w, h, f, d));
        ns(PX, PY, PW, PH, 'board'); ns(PX + 12, PY + 96, PW - 24, PH - 108, 'inset');

        keep(this.add.text(PX + 24, PY + 16, 'THE CODEX', { fontSize: '26px', fontFamily: UIKit.FONT.title, fontStyle: 'bold', color: '#e0c8ff' }).setDepth(D + 1));
        keep(this.add.text(PX + 200, PY + 26, `${L.filter(d => seen.has(d.id)).length} of ${L.length} books found`, { fontSize: '12px', fontFamily: 'monospace', color: '#a898c8' }).setDepth(D + 1));
        objs.push(...this._btn({ x: PX + PW - 40, y: PY + 30, w: 44, h: 32, label: 'X', accent: UIKit.PALETTE.line, depth: D + 2, fontSize: '14px', fireOn: 'down', onClick: () => this._closeCodex() }).objs);
        // the rarity tabs
        const TW = (PW - 48) / RA.length;
        RA.forEach((ra, i) => {
            const x = PX + 24 + i * TW, y = PY + 56, on = i === page, n = L.filter(d => d.r === i), got = n.filter(d => seen.has(d.id)).length;
            this._tab(keep, x, y, TW - 8, 34, ra.col, on, D + 1);

            keep(this.add.text(x + (TW - 8) / 2, y + 11, ra.name, { fontSize: '13px', fontFamily: UIKit.FONT.title, fontStyle: 'bold', color: UIKit._hex(on ? ra.col : MenuArt.mix(ra.col, 0x241a38, 0.4)) }).setOrigin(0.5).setDepth(D + 2));
            keep(this.add.text(x + (TW - 8) / 2, y + 26, `${got} / ${n.length}`, { fontSize: '10px', fontFamily: 'monospace', color: on ? '#ffffff' : '#8a7aa8' }).setOrigin(0.5).setDepth(D + 2));
            if (!on) keep(this.add.zone(x, y, TW - 8, 34).setOrigin(0).setInteractive({ useHandCursor: true }).setDepth(D + 3)).on('pointerdown', () => { Sfx.play(this, 'click'); this._codex(i); });
        });
        // the cards
        const GX = PX + 24, GY = PY + 112, GW = PW * 0.56, cols = books.length > 12 ? 5 : 4, CW = (GW - 12 * (cols - 1)) / cols, rows = Math.ceil(books.length / cols);
        const CH = Math.min(138, Math.floor((PH - 152 - 12 * (rows - 1)) / rows)), k2 = CH / 138;   // a big page packs its cards smaller
        const pct = page === 5 ? Enchants.CORRUPT_BASE * 100 : R.w, odds = `${pct}% of pulls (about 1 in ${Math.round(100 / pct).toLocaleString()})`;   // both forms, so Mythic and Corrupted compare at a glance
        keep(this.add.text(GX, PY + PH - 26, `${R.name}: ${odds}`, { fontSize: '11px', fontFamily: 'monospace', color: UIKit._hex(R.col) }).setDepth(D + 1));
        books.forEach((d, k) => {
            const cx = GX + (k % cols) * (CW + 12), cy = GY + Math.floor(k / cols) * (CH + 12), got = seen.has(d.id), sel = d === pick;
            ns(cx, cy, CW, CH, 'board_d', D + 1).setTint(sel ? 0xd8ccff : 0xffffff);
            ns(cx, cy, CW, CH, 'rim_s', D + 1).setTint(got ? R.col : 0x3a2e52).setAlpha(sel ? 1 : 0.5);
            if (got) { const gl = keep(this.add.image(cx + CW / 2, cy + 50 * k2, 'mn_glow').setTint(R.col).setBlendMode(Phaser.BlendModes.ADD).setDisplaySize(90, 90).setAlpha(sel ? 0.5 : 0.25).setDepth(D + 1)); if (sel) this.tweens.add({ targets: gl, alpha: 0.25, duration: 900, yoyo: true, repeat: -1 }); }
            const ik = ShopScene.bookIcon(this, d.r, d.b, d.id), ic = keep(this.add.sprite(cx + CW / 2, cy + 50 * k2, ik, '0').setScale(2.6 * Math.max(0.75, k2)).setDepth(D + 2));
            if (got) ic.play(ik); else ic.setTint(0x1a1428);
            keep(this.add.text(cx + CW / 2, cy + 92 * k2, got ? d.name : '???', { fontSize: k2 < 0.9 ? '12px' : '14px', fontFamily: UIKit.FONT.title, fontStyle: 'bold', color: got ? '#f4e8cc' : '#5a4e72' }).setOrigin(0.5).setDepth(D + 2));
            keep(this.add.text(cx + CW / 2, cy + CH - 22 * Math.max(0.8, k2), d.b2 ? d.b + '+' + d.b2 : d.b, { fontSize: '10px', fontFamily: 'monospace', fontStyle: 'bold', color: UIKit._hex(got ? Enchants.BUILDS[d.b] : 0x4a3e62),
                backgroundColor: '#0d0a14', padding: { x: 5, y: 2 } }).setOrigin(0.5).setDepth(D + 2));
            keep(this.add.zone(cx, cy, CW, CH).setOrigin(0).setInteractive({ useHandCursor: true }).setDepth(D + 3)).on('pointerdown', () => { if (!sel) { Sfx.play(this, 'hover'); this._codex(page, d.id); } });
        });
        // the chosen book, read out
        const RX = GX + GW + 24, RW = PX + PW - 24 - RX, got = seen.has(pick.id);
        ns(RX, GY, RW, PH - 150, 'board_d', D + 1); ns(RX, GY, RW, PH - 150, 'rim_s', D + 1).setTint(R.col).setAlpha(0.6);
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
        keep(this.add.text(RX + 18, GY + PH - 176, 'numbers shown at 50% quality (0% is x0.7, 100% is x1.3)', { fontSize: '10px', fontFamily: 'monospace', color: '#7a6a98', wordWrap: { width: RW - 36 } }).setDepth(D + 2));
        if (fresh) { objs[0].setAlpha(0); this.tweens.add({ targets: objs[0], alpha: 1, duration: 200 }); this._slideIn(objs.slice(1), 0, 18, 40, 260); Sfx.play(this, 'e_flip'); }
    }
    _closeCodex() {
        for (const o of (this._codexObjs || [])) { if (o?.active) this.tweens.killTweensOf(o); o?.destroy?.(); }
        this._codexObjs = null;
    }

    // A book ground to dust: it shudders where it stood, goes white, and bursts
    _crumble(at, d, then) {
        const ik = ShopScene.bookIcon(this, d.r, d.b, d.id), bk = this.add.sprite(at.x, at.y, ik, '0').setScale(2.2).setDepth(60);
        this.tweens.addCounter({ from: 0, to: 1, duration: 240, onUpdate: tw => bk.setX(at.x + Math.round((Math.random() - 0.5) * 6 * tw.getValue())), onComplete: () => {
            bk.setX(at.x).setTintFill(0xffffff);
            this.time.delayedCall(60, () => {
                bk.destroy(); this._dustBurst(at.x, at.y); this.cameras.main.shake(100, 0.003); this._ring(at.x, at.y, 0xc8b8ff, 61, { ms: 420, scale: 2 });
                this._sparks(at.x, at.y, [0xc8b8ff, 0xffffff], 10, 61, { speed: { min: 40, max: 150 }, gravityY: 60 });
                then?.();
            });
        } });
    }
    // Salvaging: the book bursts into dust that drifts up.
    _dustBurst(x, y) {
        const p = this.add.particles(0, 0, 'mn_px2', { x, y, lifespan: 900, speed: { min: 40, max: 140 }, angle: { min: 200, max: 340 }, gravityY: 120,
            scale: { start: 1.8, end: 0 }, alpha: { start: 1, end: 0 }, tint: [0xc8b8ff, 0xffffff, 0x9a6aff], blendMode: 'ADD', emitting: false }).setDepth(60);
        p.explode(40);
        this.time.delayedCall(1200, () => p.destroy());
    }
}
