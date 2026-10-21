// ═══════════════════════════════════════════════════════════════════════════
// GardenScene — the Dust Garden, a corner of the Enchanter's Isle you walk round as the slime.
// Three areas side by side, the camera following you between them:
//   Starfall Grove (left): crystal trees, a moonwell, a bench to rest on, and a secret seed.
//   The garden (middle): the beds, the seed kiosk, the waystone back to the Isle.
//   The Lagoon (right): the river opens into a lake with a dock (opens at Tower floor
//   Garden.LAKE_FLOOR), with fish of its own.
// WASD to walk, E (or Space) to tend, fish, rest or shop; hold E to reel; L for the Garden Log
// (Plantdex, fish, wardrobe); Esc or the waystone to go back. The rules live in Garden.js.
//
// Laid out on a design grid 15 tiles tall, three areas of 26 tiles across (the garden's tiles run
// 0..25, the Grove's -26..-1, the Lagoon's 26..51), painted once at 16 px a tile in a 3/4 view.
// ═══════════════════════════════════════════════════════════════════════════

class GardenScene extends Phaser.Scene {
    constructor(key = 'Garden') { super(key); }

    static BEDS = [[2, 3], [8, 3], [14, 3], [2, 7], [8, 7], [14, 7]];   // design-grid tiles, each bed 4 x 2
    static STALL = [20, 2, 5, 4];   // x, y, w, h
    static RIVER = 11; static BRIDGES = [11, -15]; static STONE = [11, 13];
    static TREES = [[0, 4], [25, 9], [5, 13], [19, 14], [24, 13], [-1, 9], [29, 3], [50, 4], [45, 3], [31, 14], [49, 14]];
    static CRYSTAL_TREES = [[-22, 4], [-7, 4], [-19, 9], [-4, 9], [-25, 13], [-26, 10]];
    static WELL = [-15, 5, 3, 2]; static BENCH = [-11, 8, 2, 1];
    static LAKE = [30, 48, 39]; static DOCK = [37, 6, 2, 4];   // the lake: from x, to x, its middle; the dock: x, y, w, h
    static CHEST = [18, 4];
    static POTS = [];   // potted star trees you've set down: x, y (its foot), which tree it is (an index into Garden.TREES); decor, no fruit
    static ORCHARD = [[-20, 13], [-13, 13], [-9, 13], [-5, 13], [-27, 3], [-20, 3], [-11, 2], [-5, 3]];   // the Grove's orchard plots, south of the river then along the fence (x, y; 3 x 1, the tree on the middle tile); the kiosk clears the later ones
    static TANKS = { river: [17, 9, 3, 2], lake: [28, 4, 3, 2], cosmic: [-3, 5, 3, 2] };   // the aquariums, once bought (x, y, w, h)
    static CRYSTALS = [[1, 2.2, 1.4, 0x8affd8], [24.2, 10.4, 1.6, 0xd8a8ff], [7.2, 13.6, 1.1, 0x8affd8], [21.8, 6.6, 1, 0x9ad8ff], [17, 13.8, 1.3, 0xd8a8ff], [6.6, 6.2, 0.9, 0x9ad8ff],
        [-24, 7, 1.5, 0xd8a8ff], [-1.2, 13.4, 1.2, 0x8affd8], [-1.2, 2.6, 1, 0xd8a8ff], [-16, 2.4, 1.3, 0x9ad8ff], [33, 5, 1.1, 0x9ad8ff], [46, 6.4, 1.3, 0x8affd8], [28, 13.5, 1, 0xd8a8ff]];   // crystal clusters: x, y, size, colour
    static STONES = Array.from({ length: 8 }, (_, k) => [-13.5 + Math.cos(k / 8 * Math.PI * 2) * 4, 6 + Math.sin(k / 8 * Math.PI * 2) * 2.4]);   // the Grove's ring of old standing stones
    static LAMPS = [[13.5, 4.2], [13.6, 7.6], [13.5, 9.4], [18.6, 7.2], [-6, 7.6], [-20, 7.6], [30, 7.6], [36, 5.6]];   // lanterns (their foot)   // the storage chest (1 tile)
    static EGG = [-21.6, 13.6];
    static MUD = [40, 4];   // the Lagoon's mud patch (design tiles, 2 x 1): the mudskipper's   // where Stardrop glimmers (design tiles)
    static TRAMPOLINE = [5, 16];   // in the south meadow (design tiles, 2 x 1): it springs you up to the Cloud Sea
    static SOUTH = 6;   // rows of open ground below the first screen
    static AREAS = [[-26, 'STARFALL GROVE', '#d8a8ff'], [0, 'THE DUST GARDEN', '#d8fff0'], [26, 'THE LAGOON', '#9ad8ff']];

    create(data = {}) {
        this.anims.resumeAll();   // the game's pause freezes every animation game-wide; never carry that into a menu
        const W = this.scale.width, H = this.scale.height;
        this._applyLayout(); this._reg = {}; this._build = null;
        const reg = (key, i, ...o) => { (this._reg[key + (i ?? '')] ||= []).push(...o); return o[0]; };
        MenuArt.basics(this);
        Music.play(this, 'isle');
        this._panelObjs = null; this._busy = false; this._ticks = []; this._fish = null; this._leaving = false; this._rest = null; this._area = null; this._hudObjs = null; this._bookCam = null;
        this.glorps = parseInt(localStorage.getItem('glorps') || '0', 10) || 0;
        const T = this.T = Math.max(32, Math.floor(Math.min(W / 27, H / 16)));
        const base = Math.ceil(H / T) + 1, rows = this.rows = base + GardenScene.SOUTH, cols = this.cols = 80;   // a screen tall, plus SOUTH rows to roam below it
        this.gx0 = 27; this.gy0 = Math.floor((base - 15) / 2) + 1;
        this.ox = 0; this.oy = Math.round((H - base * T) / 2);
        const k = T / 16, cam = this.cameras.main;
        this._waterMap();
        const gk = `gd3_ground_${cols}x${rows}_${JSON.stringify(Garden.layout()).split('').reduce((h, c) => (h * 31 + c.charCodeAt(0)) | 0, 7)}`;   // beds are painted into the ground: a new layout, a new ground
        for (const key of this.textures.getTextureKeys()) if (key.startsWith('gd3_ground_') && key !== gk) this.textures.remove(key);
        this.add.image(this.ox, this.oy, MenuArt.tex(this, gk, cols * 16, rows * 16, P => this._paintGround(P))).setOrigin(0).setScale(k).setDepth(0);
        cam.setBounds(0, Math.min(0, this.oy), cols * T, Math.max(H, this.oy + rows * T - Math.min(0, this.oy)));
        // what stands up: sorted by its foot
        const [sx, sy, sw, sh] = GardenScene.STALL;
        reg('STALL', null, this.add.image(this._px(sx), this._py(sy + sh), MenuArt.tex(this, 'gd3_kiosk', sw * 16, sh * 16 + 10, P => this._paintStall(P, sw * 16, sh * 16 + 10))).setOrigin(0, 1).setScale(k).setDepth(this._py(sy + sh)));
        reg('STALL', null, this.add.text(this._px(sx) + 40 * k, this._py(sy) + 18.5 * k, 'SEEDS', { fontSize: `${Math.round(T * 0.22)}px`, fontFamily: UIKit.FONT.title, fontStyle: 'bold', color: '#3a2414' }).setOrigin(0.5).setDepth(this._py(sy + sh) + 1));
        for (const [lx2, ly2, col] of [[77.5, 21.5, 0xd8a8ff], [40, 22, 0x9aff8a], [7, 49, 0x9aff8a]]) {   // the lantern, the jars on the shelf, the crate of bulbs   // the kiosk's crystal caps and its crystal ball, glowing
            const g = reg('STALL', null, this.add.image(this._px(sx) + lx2 * k, this._py(sy) + ly2 * k, 'mn_glow').setTint(col).setBlendMode(Phaser.BlendModes.ADD).setDisplaySize(T * 1.6, T * 1.6).setAlpha(0.5).setDepth(this._py(sy + sh) + 2));
            this.tweens.add({ targets: g, alpha: 0.22, duration: 1100 + lx2 * 10, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
        }
        GardenScene.TREES.forEach(([tx, ty], i) => reg('TREES', i, this.add.image(this._px(tx) + T / 2, this._py(ty + 1), MenuArt.tex(this, 'gd2_tree_' + ((tx + ty) & 1), 40, 48, P => this._paintTree(P, (tx + ty) & 1))).setOrigin(0.5, 1).setScale(k).setDepth(this._py(ty + 1))));
        GardenScene.CRYSTAL_TREES.forEach(([tx, ty], i) => {
            const x = this._px(tx) + T / 2, y = this._py(ty + 1), col = [0xd8a8ff, 0x8affd8, 0x9ad8ff][i % 3];
            reg('CRYSTAL_TREES', i, this.add.image(x, y, MenuArt.tex(this, 'gd3_ctree_' + (i % 3), 40, 52, P => this._paintCrystalTree(P, col))).setOrigin(0.5, 1).setScale(k).setDepth(y));
            const g = reg('CRYSTAL_TREES', i, this.add.image(x, y - T * 1.6, 'mn_glow').setTint(col).setBlendMode(Phaser.BlendModes.ADD).setDisplaySize(T * 3, T * 3).setAlpha(0.4).setDepth(y + 1));
            this.tweens.add({ targets: g, alpha: 0.15, duration: 1600 + i * 120, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
            reg('CRYSTAL_TREES', i, this.add.particles(0, 0, 'mn_px2', { x: { min: x - T, max: x + T }, y: { min: y - T * 2.6, max: y - T }, lifespan: 1600, speedY: { min: 4, max: 14 }, scale: { start: 1.6, end: 0 }, tint: [col, 0xffffff], blendMode: 'ADD', frequency: 300 }).setDepth(y + 2));
        });
        // the moonwell, the bench, the dock
        const [wx0, wy0, ww, wh] = GardenScene.WELL;
        reg('WELL', null, this.add.image(this._px(wx0), this._py(wy0 + wh), MenuArt.tex(this, 'gd3_well', ww * 16, wh * 16 + 6, P => this._paintWell(P, ww * 16, wh * 16 + 6))).setOrigin(0, 1).setScale(k).setDepth(this._py(wy0 + wh)));
        const wg = reg('WELL', null, this.add.image(this._px(wx0 + ww / 2), this._py(wy0 + 1), 'mn_glow').setTint(0xb8c8ff).setBlendMode(Phaser.BlendModes.ADD).setDisplaySize(T * 4, T * 3).setAlpha(0.5).setDepth(this._py(wy0 + wh) + 1));
        this.tweens.add({ targets: wg, alpha: 0.25, duration: 2200, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
        reg('WELL', null, this.add.particles(0, 0, 'mn_px2', { x: { min: this._px(wx0) + T * 0.6, max: this._px(wx0 + ww) - T * 0.6 }, y: { min: this._py(wy0) + T * 0.6, max: this._py(wy0 + 1) + T * 0.4 }, lifespan: 1400, speedY: { min: -18, max: -6 },
            scale: { start: 1.4, end: 0 }, tint: [0xffffff, 0xd8e0ff], blendMode: 'ADD', frequency: 200 }).setDepth(this._py(wy0 + wh) + 2));
        const [bx0, by0] = GardenScene.BENCH;
        reg('BENCH', null, this.add.image(this._px(bx0), this._py(by0 + 1), MenuArt.tex(this, 'gd3_bench', 32, 22, P => this._paintBench(P))).setOrigin(0, 1).setScale(k).setDepth(this._py(by0 + 1)));
        const [cx0, cy0] = GardenScene.CHEST;
        reg('CHEST', null, this.add.image(this._px(cx0) + T / 2, this._py(cy0 + 1), MenuArt.tex(this, 'gd3_chest', 16, 16, P => this._paintChest(P))).setOrigin(0.5, 1).setScale(k).setDepth(this._py(cy0 + 1)));
        const [dx0, dy0, dw, dh] = GardenScene.DOCK;
        this.add.image(this._px(dx0), this._py(dy0), MenuArt.tex(this, 'gd3_dock', dw * 16, dh * 16 + 6, P => this._paintDock(P, dw * 16, dh * 16 + 6))).setOrigin(0).setScale(k).setDepth(3);
        const dl = this.add.image(this._px(dx0 + dw) - 5 * k, this._py(dy0 + dh) - 32 * k, 'mn_glow').setTint(0xffc060).setBlendMode(Phaser.BlendModes.ADD).setDisplaySize(T * 2, T * 2).setAlpha(0.55).setDepth(this._py(dy0 + dh) + 1);
        this.tweens.add({ targets: dl, alpha: 0.35, duration: 900, yoyo: true, repeat: -1 });
        if (!this._lakeOpen()) {   // the Lagoon before its floor: a sign at the dock's foot
            this.add.text(this._px(dx0 + 1), this._py(dy0) - T * 0.2, `the lake stirs at\nTower floor ${Garden.LAKE_FLOOR}`, { fontSize: '12px', fontFamily: 'monospace', fontStyle: 'bold', color: '#d8e8ff', align: 'center', backgroundColor: '#0a0618cc', padding: { x: 6, y: 4 } }).setOrigin(0.5, 1).setDepth(this._py(dy0) + 2);
        }
        // the waystone: old, carved, its runes alive
        const [stx0, sty0] = GardenScene.STONE, stx = this._px(stx0 + 1), sty = this._py(sty0 + 1);
        reg('STONE', null, this.add.image(stx, sty, MenuArt.tex(this, 'gd2_stone', 24, 34, P => this._paintStone(P))).setOrigin(0.5, 1).setScale(k).setDepth(sty));
        const runes = reg('STONE', null, this.add.image(stx, sty, MenuArt.tex(this, 'gd2_runes', 24, 34, P => this._paintRunes(P))).setOrigin(0.5, 1).setScale(k).setDepth(sty + 1).setBlendMode(Phaser.BlendModes.ADD));
        this.tweens.add({ targets: runes, alpha: { from: 1, to: 0.45 }, duration: 1300, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
        const sg = reg('STONE', null, this.add.image(stx, sty - T * 0.9, 'mn_glow').setTint(0xc8a0ff).setBlendMode(Phaser.BlendModes.ADD).setDisplaySize(T * 3, T * 3.4).setAlpha(0.45).setDepth(sty - 1));
        this.tweens.add({ targets: sg, alpha: 0.2, duration: 1300, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
        reg('STONE', null, this.add.particles(0, 0, 'mn_px2', { x: { min: stx - T * 0.5, max: stx + T * 0.5 }, y: { min: sty - T * 1.8, max: sty - T * 0.4 }, lifespan: 1800, speedY: { min: -26, max: -8 },
            scale: { start: 1.4, end: 0 }, alpha: { start: 0.9, end: 0 }, tint: [0xd8a8ff, 0xffffff], blendMode: 'ADD', frequency: 120 }).setDepth(sty + 2));
        this._waterSetup();
        this._ethereal();
        this._tanksSetup();
        this._sky();
        this._egg();
        this._mud();
        this._drifters();
        this.add.particles(0, 0, 'mn_px2', { x: { min: 0, max: cols * T }, y: { min: 0, max: H }, lifespan: 3600, speedX: { min: -10, max: 10 }, speedY: { min: -8, max: 4 },
            scale: { start: 1.6, end: 0 }, alpha: { start: 0.9, end: 0 }, tint: [0xd8ffb0, 0x8affd8, 0xffe8a0], blendMode: 'ADD', frequency: 90 }).setDepth(5000);
        this.add.image(W / 2, H / 2, MenuArt.tex(this, 'gd2_vig', 64, 36, P => { for (let y = 0; y < 36; y++) for (let x = 0; x < 64; x++) { const d = Math.hypot((x - 31.5) / 32, (y - 17.5) / 18); if (d > 0.7) P.put(x, y, 0x081008, Math.min(0.5, (d - 0.7) * 1.4)); } }, { linear: true })).setDisplaySize(W, H).setDepth(4900).setScrollFactor(0);
        { const [tx, ty] = GardenScene.TRAMPOLINE, y = this._py(ty + 1); this._tramp = this.add.image(this._px(tx + 1), y, this._trampTex()).setOrigin(0.5, 1).setScale(k).setDepth(y); }
        // the crops (redrawn as they grow)
        this._crops = [];
        // the slime: free movement, its feet at (fx, fy); its rod on its side
        if (!this.anims.exists('idle')) this.anims.create({ key: 'idle', frames: [{ key: 'slime_blue', frame: 0 }, { key: 'slime_blue', frame: 18 }], frameRate: 2, repeat: -1 });
        this.fx = data.fx ?? this._cx(this.gx0 + 12); this.fy = data.fy ?? this._cy(this.gy0 + 9) + T * 0.25;
        if (data.fromSky) { const [tx, ty] = GardenScene.TRAMPOLINE; this.fx = this._px(tx + 1); this.fy = this._py(ty + 1) + T * 0.6; }   // bounced back down
        if (data.fromWell) { this.fx = this._px(GardenScene.WELL[0] + GardenScene.WELL[2] / 2); this.fy = this._py(GardenScene.WELL[1] + GardenScene.WELL[3]) + T * 0.5; }   // climbed back out of the moonwell
        this.face = { x: 0, y: -1 };
        this.shadow = this.add.ellipse(this.fx, this.fy, T * 0.75, T * 0.2, 0x000000, 0.32).setDepth(1);
        this.player = this.add.sprite(this.fx, this.fy, 'slime_blue', 0).setScale(T / 16).play('idle');
        if (typeof CreatureFX !== 'undefined') {
            const u = CreatureFX.face(this, this.player, { mood: 'friend', look: 'pointer' });
            const hat = Garden.state().hat; if (u && hat) CreatureFX.dress(u, hat);
        }
        this.rodSpr = this.add.image(0, 0, this._rodTex(Garden.rod())).setOrigin(0.15, 0.85).setScale(k);
        this.heldSpr = this.add.sprite(0, 0, '__DEFAULT').setOrigin(0.5, 0.85).setVisible(false);   // whatever else the hotbar has you holding
        this.prompt = this.add.text(0, 0, '', { fontSize: '13px', fontFamily: 'monospace', fontStyle: 'bold', color: '#ffffff', backgroundColor: '#0a0618cc', padding: { x: 6, y: 3 } }).setOrigin(0.5, 1).setDepth(6000);
        cam.startFollow(this.player, true, 0.1, 0.1, 0, T * 0.3);
        this._petSetup();
        this._hud();
        this._drawCrops();
        this.keys = this.input.keyboard.addKeys('W,A,S,D,UP,DOWN,LEFT,RIGHT,E,SPACE,ESC,L,B,I,TAB,ONE,TWO');
        for (const k of ['I', 'TAB']) this.keys[k].on('down', () => this._pack ? this._closePanel() : this._backpack());
        this.keys.ONE.on('down', () => this._useHand(0)); this.keys.TWO.on('down', () => this._useHand(1));
        this.keys.B.on('down', () => this._toggleBuild());
        this.input.on('pointermove', p => this._buildMove(p));
        this.input.on('pointerdown', p => this._buildClick(p));
        this.input.on('pointerdown', p => this._scytheStart(p)); this.input.on('pointermove', p => this._scytheMove(p)); this.input.on('pointerup', () => this._scytheEnd());
        this.keys.E.on('down', () => this._interact()); this.keys.SPACE.on('down', () => this._interact());
        this.keys.L.on('down', () => { if (!this._fish && !this._rest) this._panelObjs ? this._closePanel() : this._logPanel(); });
        this.keys.ESC.on('down', () => { if (this._sprk) this._sprinkleEnd(false); else if (this._build) this._toggleBuild(); else if (this._rest) this._getUp(); else if (this._fish) this._endFish('reeled in'); else if (this._panelObjs) this._closePanel(); else this._leave(); });
        this.time.addEvent({ delay: 1000, loop: true, callback: () => { if (!this._panelObjs) this._drawCrops(); this._hud(); this._batchGlows(); } });
        this._place();
        this._batchGlows();
        cam.fadeIn(400, 10, 6, 24);
        if (data.build) this._toggleBuild();
    }

    // Every additive glow in the world onto one depth just under the vignette. Sorted in among the trees and props by their foot,
    // each one switched the blend mode and flushed the batch: 83 draw calls a frame for a still garden (2026-10-20). Light adds,
    // so where it sits in the order doesn't change the picture; it runs again each second for the glows crops make later.
    _batchGlows() {
        for (const o of this.children.list) if (o.blendMode === Phaser.BlendModes.ADD && o.scrollFactorX !== 0 && o.depth < 4890) o.setDepth(4890);
    }

    // design-grid tiles to world, and back
    _px(x) { return this.ox + (this.gx0 + x) * this.T; }
    _py(y) { return this.oy + (this.gy0 + y) * this.T; }
    _cx(tx) { return this.ox + tx * this.T + this.T / 2; }
    _cy(ty) { return this.oy + ty * this.T + this.T / 2; }
    _tile(x, y) { return [Math.floor((x - this.ox) / this.T), Math.floor((y - this.oy) / this.T)]; }
    _bridge(lx) { return GardenScene.BRIDGES.some(b => lx === b || lx === b + 1); }
    _dock(lx, ly) { const [x0, y0, w, h] = GardenScene.DOCK; return lx >= x0 && lx < x0 + w && ly >= y0 && ly < y0 + h; }
    _lakeOpen() { return (typeof TowerFloors !== 'undefined' ? TowerFloors.best() : 0) >= Garden.LAKE_FLOOR; }
    _inLake(lx) { return lx > GardenScene.LAKE[0] && lx < GardenScene.LAKE[1]; }

    // The river and the lake: per 16px column, the water's top and bottom (in ground pixels), and
    // which grid tiles are water. The river runs the whole way; in the Lagoon it opens into a lake.
    _waterMap() {
        const n = MenuArt.noise(91), W2 = this.cols * 16, [lx0, lx1, lmid] = GardenScene.LAKE, base = (this.gy0 + GardenScene.RIVER) * 16;
        this._bank = [];
        for (let x = 0; x < W2; x++) {
            const dx = x / 16 - this.gx0;
            let t0 = base + 3 + Math.round(Math.sin(x * 0.05) * 1.2 + n(x * 0.2, 7) * 2 - 1), t1 = base + 29 + Math.round(Math.sin(x * 0.04 + 2) * 1.2 - n(x * 0.2, 9) * 2 + 1);
            if (dx > lx0 && dx < lx1) { const u = (dx - lmid) / ((lx1 - lx0) / 2), e = Math.sqrt(Math.max(0, 1 - u * u)); t0 -= Math.round(e * 52 + n(x * 0.08, 3) * 6 * e); t1 += Math.round(e * 12); }
            this._bank.push([t0, t1]);
        }
        this._wet = new Set();
        for (let tx = 0; tx < this.cols; tx++) for (let ty = 0; ty < this.rows; ty++) {
            const [a, b] = this._bank[tx * 16 + 8], cy = ty * 16 + 8;
            if (cy >= a && cy <= b) this._wet.add(tx + ',' + ty);
        }
    }
    _river(lx, ly) { return this._wet.has((lx + this.gx0) + ',' + (ly + this.gy0)) && !this._bridge(lx) && !this._dock(lx, ly); }

    update(t, dt) {
        for (const f of this._ticks) f(t);
        if (this._panelObjs || this._leaving || this._fish || this._rest || t < (this._dazedUntil || 0)) { this._place(); return; }
        const K = this.keys, ix = (K.D.isDown || K.RIGHT.isDown) - (K.A.isDown || K.LEFT.isDown), iy = (K.S.isDown || K.DOWN.isDown) - (K.W.isDown || K.UP.isDown);
        if (ix || iy) {
            const len = Math.hypot(ix, iy), sp = this.T * 3.6 * Math.min(50, dt) / 1000, vx = ix / len * sp, vy = iy / len * sp;
            this.face = { x: ix, y: iy };
            if (ix) this.player.setFlipX(ix < 0);
            // one axis at a time, so it slides along whatever stops it
            this._unstick();
            if (this._free(this.fx + vx, this.fy)) this.fx += vx;
            if (this._free(this.fx, this.fy + vy)) this.fy += vy;
            this._step = (this._step || 0) + dt;
        } else this._step = 0;
        this._place();
        this._areaCheck();
        if (this._build) { this._buildMove(this.input.activePointer); return; }
        const it = this._near();
        if (it && !this._panelObjs && !this._sprk) this.prompt.setText(it.label).setPosition(this.fx, this.fy - this.T * 0.95).setVisible(true);
        else this.prompt.setVisible(false);   // (hidden under any panel)
    }
    // The slime's body is the bottom 10 rows of its 32px frame, so the frame's foot goes on the feet;
    // its shadow under the body; its rod at its side, angled by what it's doing (this._rodA).
    _place() {
        const T = this.T, sc = T / 16, bob = this._step ? Math.abs(Math.sin(this._step * 0.012)) * T * 0.08 : 0;
        const z = this._hopZ ?? this.fy;   // (over the well's rim while jumping in)
        this.player.setPosition(this.fx, this.fy - 15.5 * sc - bob - (this._hop || 0)).setDepth(z);
        if (!this._rest) this.player.setScale(sc, sc * (1 - bob / T * 0.6));
        this.shadow.setPosition(this.fx, this.fy + T * 0.02).setDepth(1);
        const fc = this.player._cfx; if (fc) { fc.eyes?.setDepth(z + 0.001); fc.hat?.setDepth(z + 0.002); }
        const dir = this.player.flipX ? -1 : 1;
        const it = this._heldItem, rodOut = !!this._fish || it?.k === 'rod', show = !this._rest && !this._hideGear;
        this.heldSpr.setVisible(show && !rodOut).setPosition(this.fx + dir * T * 0.36, this.fy - T * 0.08 - bob).setFlipX(dir < 0).setDepth(this.fy + 0.01).setAngle(dir * Math.sin(this.time.now * 0.004) * 4);
        this.rodSpr.setOrigin(dir < 0 ? 0.85 : 0.15, 0.85);   // the grip is the pivot, whichever way it faces
        this.rodSpr.setVisible(show && rodOut).setPosition(this.fx + dir * T * 0.32, this.fy - T * 0.2 - bob).setFlipX(dir < 0)
            .setAngle(dir * (this._rodA ?? -35)).setDepth(this.fy + 0.01);
    }
    // the tip of the rod, in the world (where the line starts)
    _rodTip() { const r = this.rodSpr, w = r.width, h = r.height, vx = (w - 0.5 - w * 0.15) * r.scaleX * (r.flipX ? -1 : 1), vy = (0.5 - h * 0.85) * r.scaleY, a = r.rotation; return [r.x + vx * Math.cos(a) - vy * Math.sin(a), r.y + vx * Math.sin(a) + vy * Math.cos(a)]; }
    // a banner as you walk into another area
    _areaCheck() {
        const lx = Math.floor((this.fx - this.ox) / this.T) - this.gx0, A = [...GardenScene.AREAS].reverse().find(([x0]) => lx >= x0) || GardenScene.AREAS[0];
        if (this._area === A[1]) return;
        const first = this._area === null; this._area = A[1];
        if (first) return;
        const W = this.scale.width, t = this.add.text(W / 2, 110, A[1], { fontSize: '30px', fontFamily: UIKit.FONT.title, fontStyle: 'bold', color: A[2], stroke: '#0a0618', strokeThickness: 6 }).setOrigin(0.5).setScrollFactor(0).setDepth(7100).setAlpha(0);
        this.tweens.add({ targets: t, alpha: 1, y: 100, duration: 400, onComplete: () => this.tweens.add({ targets: t, alpha: 0, delay: 1400, duration: 600, onComplete: () => t.destroy() }) });
        Sfx.play(this, 'e_flip'); this._hud();
    }
    // standing somewhere that turned solid (a tree planted on it, a moved bed): hop to the nearest open spot
    _unstick() {
        if (this._free(this.fx, this.fy)) return;
        const st = this.T / 4;
        for (let r = 1; r <= 24; r++) for (let a = 0; a < 16; a++) {
            const x = this.fx + Math.cos(a * Math.PI / 8) * r * st, y = this.fy + Math.sin(a * Math.PI / 8) * r * st;
            if (this._free(x, y)) { this.fx = x; this.fy = y; return; }
        }
    }
    // the slime's footprint (half a tile wide, a third deep) on open ground
    _free(x, y) {
        const hw = this.T * 0.25, hh = this.T * 0.14;
        for (const [px, py] of [[x - hw, y - hh], [x + hw, y - hh], [x - hw, y + this.T * 0.26], [x + hw, y + this.T * 0.26]]) { const [tx, ty] = this._tile(px, py); if (!this._open(tx, ty)) return false; }
        return true;
    }
    // where the slime can stand
    _open(x, y) {
        if (x < 1 || y < 2 || x >= this.cols - 1 || y >= this.rows - 1) return false;
        const lx = x - this.gx0, ly = y - this.gy0, inR = r => lx >= r[0] && lx < r[0] + r[2] && ly >= r[1] && ly < r[1] + r[3];
        if (ly < 2) return false;   // the fence
        if (this._dock(lx, ly)) return true;
        if (inR(GardenScene.STALL) || inR(GardenScene.WELL) || inR(GardenScene.BENCH) || inR([...GardenScene.CHEST, 1, 1]) || Object.keys(Garden.TANK_KINDS).some(kd => Garden.tank(kd) && inR(GardenScene.TANKS[kd]))) return false;
        if (this._river(lx, ly)) return false;
        if ([...GardenScene.TREES, ...GardenScene.CRYSTAL_TREES].some(([tx, ty]) => lx === tx && ly === ty)) return false;
        if (GardenScene.ORCHARD.some(([ox, oy], k) => lx === ox + 1 && ly === oy && this._orchPlots?.[k]?.tree)) return false;   // an orchard tree's trunk
        const [wx, wy] = GardenScene.STONE;
        if (lx >= wx && lx <= wx + 1 && ly === wy) return false;
        return true;
    }

    // what the slime is standing by, and what E would do there
    _near() {
        const [tx, ty] = this._tile(this.fx, this.fy), lx = tx - this.gx0, ly = ty - this.gy0;
        const by = (x0, y0, w, h) => lx >= x0 - 1 && lx <= x0 + w && ly >= y0 - 1 && ly <= y0 + h;
        const s = Garden.state();
        for (let k = 0; k < GardenScene.BEDS.length; k++) {
            const [bx, bY] = GardenScene.BEDS[k];
            if (!by(bx, bY, 4, 2)) continue;
            if (k >= s.plots.length) { const nt = Garden.TIERS.findIndex(t => t.plots > k); return { kind: 'locked', k, label: `overgrown: the rake (tier ${['I', 'II', 'III', 'IV'][nt]}) clears it` }; }
            const p = s.plots[k], b = Garden.bed(p, Date.now(), s), held = this._held();
            const sow = held?.k === 'seed' && b.empty && Garden.canPlant(k, held.id, s) && !b.ripe ? { kind: 'sow', k, id: held.id, label: `E  sprinkle seeds (starting with ${Garden.seed(held.id).name})` } : null;
            if (!b.n) return sow || { kind: 'plant', k, label: 'E  pick up the basket and sprinkle seeds' };
            if (Garden.infested(p)) return { kind: 'worms', k, label: Garden.hasRake() ? 'E  worms in the bed! pick them out' : 'worms in the bed: a rake from the kiosk would get them out' };
            if (b.dry) return { kind: 'water', k, label: `E  water it  ·  ${Garden.can().name}` };
            if (b.ripe) return { kind: 'harvest', k, label: `drag the mouse over it to scythe  ·  E  harvest all ${b.ripe}  ·  then sow again` };
            if (sow) return sow;
            return { kind: 'grow', k, label: `E  the bed: ripe in ${this._time(b.left)}${b.paused ? ' (resting)' : ''}${b.empty ? `  ·  ${b.empty} spot${b.empty > 1 ? 's' : ''} free` : ''}` };
        }
        const orch = Garden.orchard().orchard;
        for (let k = 0; k < GardenScene.ORCHARD.length; k++) {
            const [ox, oy] = GardenScene.ORCHARD[k], p = orch[k];
            if (!by(ox, oy, 3, 1)) continue;
            if (!p) return { kind: 'locked', label: 'an overgrown orchard plot: the seed kiosk clears it (its ORCHARD page)' };
            if (!p.tree) return { kind: 'tplant', k, label: 'E  plant a sapling' };
            const st = Garden.treeState(p);
            if (st.ripe) return { kind: 'tpick', k, label: `E  pick the ${st.T.fruit}  +✧${st.T.dust}` };
            return { kind: 'tree', k, label: st.grown < 1 ? `E  ${st.T.name}: grown in ${this._time(st.growLeft)}` : `E  ${st.T.name}: ${st.T.fruit} in ${this._time(st.fruitLeft)}` };
        }
        const [sx, sy, sw, sh] = GardenScene.STALL;
        if (by(sx, sy, sw, sh)) return { kind: 'shop', label: 'E  the seed kiosk' };
        const [wx, wy] = GardenScene.STONE;
        if (by(wx, wy, 2, 1)) return { kind: 'exit', label: 'E  back to the Isle' };
        for (const kd of Object.keys(Garden.TANK_KINDS)) if (Garden.tank(kd) && by(...GardenScene.TANKS[kd])) return { kind: 'tank', tank: kd, label: `E  the ${Garden.TANK_KINDS[kd].name.toLowerCase()}${Garden.tankLit(kd) ? '' : '  ·  it\'s gone murky'}` };
        if (by(...GardenScene.MUD, 2, 1)) return { kind: 'mud', label: 'E  cast into the mud?' };
        if (by(...GardenScene.CHEST, 1, 1)) return { kind: 'chest', label: 'E  open the chest' };
        const [bx0, by0, bw, bh] = GardenScene.BENCH;
        if (by(bx0, by0, bw, bh)) { const left = Garden.sleepLeft(); return left > 0 ? { kind: 'rest', label: `E  rest a while  ·  rested: sleep again in ${this._time(left)}` } : { kind: 'sleep', label: `E  sleep on the bench  ·  crops grow ${Garden.SLEEP_H}h` }; }
        const [wl0, wl1, wlw, wlh] = GardenScene.WELL;
        if (by(wl0, wl1, wlw, wlh)) return { kind: 'well', label: 'E  look into the moonwell' };
        if (by(...GardenScene.TRAMPOLINE, 2, 1)) return { kind: 'jump', label: (typeof TowerFloors !== 'undefined' ? TowerFloors.best() : 0) >= Garden.SKY_FLOOR ? 'E  bounce up to the Cloud Sea' : 'E  have a bounce' };
        // water: the water you face, or any beside you. The lake (the Lagoon) waits on its floor.
        const near = [[Math.sign(this.face.x), Math.sign(this.face.y)], [1, 0], [-1, 0], [0, 1], [0, -1]].find(([dx, dy]) => (dx || dy) && this._river(lx + dx, ly + dy));
        if (near) {
            const lake = this._inLake(lx + near[0]);
            if (lake && !this._lakeOpen()) return { kind: 'locked', label: `the lake is still: Tower floor ${Garden.LAKE_FLOOR} wakes it` };
            return { kind: 'fish', where: lake ? 'lake' : 'river', label: `E  fish the ${lake ? 'lake' : 'river'}  ·  ${Garden.rod().name}` };
        }
        return null;
    }
    _time(ms) { const m = Math.ceil(ms / 60000); return m >= 60 ? `${Math.floor(m / 60)}h ${m % 60}m` : `${m}m`; }

    _interact() {
        if (this._sleeping) return;
        if (this._sprk) return this._sprinkleEnd(true);
        if (this._rest) return this._getUp();
        if (this._fish) return this._fishPress();
        if (this._panelObjs || this._busy) return;
        const it = this._near();
        if (!it) return;
        const held = this._held();
        if (it.kind === 'plant') this._sprinkleStart(it.k);
        else if (it.kind === 'grow' && held?.k === 'fert') { if (Garden.fertilize(it.k)) { Sfx.play(this, 'e_bind'); const [bx, by] = GardenScene.BEDS[it.k]; this._float(this._px(bx + 2), this._py(by), 'fertilized: x2 harvest', '#ffe08a'); this._drawCrops(); this._hud(); } else { Sfx.play(this, 'deny'); this._float(this.fx, this.fy - this.T * 1.4, Garden.state().fert < 1 ? 'no fertilizer left' : 'already fertilized', '#e8d8b0'); } }
        else if (it.kind === 'grow') this._growPanel(it.k);
        else if (it.kind === 'harvest') this._harvest(it.k);
        else if (it.kind === 'sow') this._sprinkleStart(it.k, it.id);
        else if (it.kind === 'tplant') this._saplingPanel(it.k);
        else if (it.kind === 'tpick') this._pickFruit(it.k);
        else if (it.kind === 'tree') this._treePanel(it.k);
        else if (it.kind === 'shop') this._shopPanel();
        else if (it.kind === 'exit') this._leave();
        else if (it.kind === 'fish') this._cast(it.where);
        else if (it.kind === 'rest') this._sit();
        else if (it.kind === 'sleep') this._sleep();
        else if (it.kind === 'chest') this._backpack();
        else if (it.kind === 'water') this._water(it.k);
        else if (it.kind === 'tank') this._tankPanel(it.tank);
        else if (it.kind === 'worms') { if (Garden.hasRake()) this._wormGame(it.k); else { Sfx.play(this, 'deny'); this._float(this.fx, this.fy - this.T * 1.4, 'you need a rake (the seed kiosk)', '#e8d8b0'); } }
        else if (it.kind === 'mud') this._mudCast();
        else if (it.kind === 'well') this._well();
        else if (it.kind === 'jump') this._bounce();
        else Sfx.play(this, 'deny');
    }

    // ── THE MUD PATCH ─────────────────────────────────────────────────────────
    // A sad little puddle of mud in the Lagoon with a sign stuck in it. It burps. Click it (or E by it)
    // and you cast your line into the mud, and only the mud's own bite there (the mudskipper by day, the sludge gulper by night).
    _mud() {
        const T = this.T, k = T / 16, [mx, my] = GardenScene.MUD, x = this._px(mx + 1), y = this._py(my) + T * 0.5;
        const img = this.add.image(x, y, MenuArt.tex(this, 'gd3_mud', 40, 22, P => {
            const n = MenuArt.noise(77);
            for (let yy = 0; yy < 22; yy++) for (let xx = 0; xx < 40; xx++) {
                const e = ((xx - 19.5) / 19) ** 2 + ((yy - 13) / 8) ** 2 + (n(xx * 0.3, yy * 0.3) - 0.5) * 0.5;
                if (e > 1) continue;
                P.put(xx, yy, e > 0.8 ? 0x3a2a18 : e < 0.3 && (xx + yy) % 5 === 0 ? 0x8a6a3a : n(xx * 0.5, yy * 0.5) > 0.6 ? 0x6a4a28 : 0x5a3e20);
            }
            for (const [bx, by] of [[12, 12], [26, 15], [19, 10]]) { P.put(bx, by, 0x9a7a48); P.put(bx + 1, by, 0x9a7a48); P.put(bx, by - 1, 0xb89a68); }
            for (let yy = 0; yy < 12; yy++) P.put(31, yy, 0x5a3a20);   // the sign, stuck in it at an angle
            for (let yy = 0; yy < 6; yy++) for (let xx = 0; xx < 10; xx++) P.put(27 + xx, yy, yy === 0 || yy === 5 || xx === 0 || xx === 9 ? 0x3a2414 : 0xc8a878);
            for (const xx of [29, 30, 32, 34]) P.put(xx, 2, 0x3a2414); P.put(31, 3, 0x3a2414);
        })).setScale(k).setDepth(this._py(my) + 2).setInteractive({ useHandCursor: true });
        const tip = this.add.text(x, y - T * 0.9, 'a mud patch. something is in there.', { fontSize: '11px', fontFamily: 'monospace', fontStyle: 'bold', color: '#e8d8b0', backgroundColor: '#0a0618cc', padding: { x: 5, y: 3 } }).setOrigin(0.5, 1).setDepth(6000).setVisible(false);
        img.on('pointerover', () => tip.setVisible(true)).on('pointerout', () => tip.setVisible(false))
            .on('pointerdown', () => { if (!this._build) this._mudCast(); });
        this.time.addEvent({ delay: 2600, loop: true, callback: () => {   // it burps
            const b = this.add.circle(x + (Math.random() - 0.5) * T, y + (Math.random() - 0.3) * T * 0.3, k * 1.5, 0x9a7a48).setDepth(this._py(my) + 3);
            this.tweens.add({ targets: b, scale: 2.2, duration: 500, onComplete: () => { b.destroy(); this._ripple(b.x, b.y); } });
        } });
    }
    _mudCast() {
        if (this._fish || this._rest || this._panelObjs || this._busy || this._leaving) return;
        const T = this.T, [mx, my] = GardenScene.MUD, x = this._px(mx + 1), y = this._py(my) + T * 0.5;
        if (Math.hypot(x - this.fx, y - this.fy) > T * 5) { this._float(this.fx, this.fy - T * 1.4, 'too far to cast into the mud', '#e8d8b0'); return; }
        this.player.setFlipX(x < this.fx); this.face = { x: Math.sign(x - this.fx), y: 0 };
        this._cast('mud', [x + (Math.random() - 0.5) * T * 0.6, y]);
    }

    // ── WORM PICKING ──────────────────────────────────────────────────────────
    // A worm, 32px, poking up out of the soil and wiggling: each kind its own shape as well as colour.
    _wormTex(Wm) {
        const M = MenuArt.mix;
        return this._sheet('gd4_worm_' + Wm.id, 4, (P, f) => {
            const sw = Math.sin(f / 4 * Math.PI * 2), c = Wm.col, id = Wm.id, fat = id === 'borer' ? 4.2 : id === 'earthworm' ? 3.4 : 2.6;
            for (let j = 0; j < 22; j++) {
                const y = 30 - j, x = 16 + Math.sin(j * 0.28 + f * 1.5) * (j / 22) * 3.5 + sw * (j / 22) * 1.5, r = fat * (j < 3 ? 1.1 : j > 18 ? 0.85 : 1);
                let col = c;
                if (id === 'rotworm') col = (j >> 1) % 2 ? 0x5a1a14 : c;
                if (id === 'borer') col = j % 3 === 0 ? M(c, 0x8a6a40, 0.4) : c;
                if (id === 'earthworm') col = j % 4 === 0 ? M(c, 0x8a3a4a, 0.35) : c;
                if (id === 'glowworm') col = j % 3 === 0 ? 0xd8ffc8 : c;
                if (id === 'starworm') col = (j + f) % 5 === 0 ? 0xffffff : j % 2 ? c : 0xd8a83a;
                if (id === 'riftworm') col = (j + f * 2) % 4 < 2 ? c : 0x1a0a2a;
                P.disc(x, y, r, col);
                if (j > 18) { P.disc(x, y, r * 0.95, id === 'rotworm' ? 0x2a0a08 : id === 'borer' ? 0xb88a5a : col); }
            }
            const hx = 16 + Math.sin(21 * 0.28 + f * 1.5) * 3.5 + sw * 1.5, hy = 9;
            if (id === 'borer') { P.line(hx - 2, hy - 3, hx - 3, hy - 5, 0x5a3a1a); P.line(hx + 2, hy - 3, hx + 3, hy - 5, 0x5a3a1a); }
            if (id === 'earthworm') { P.ell(hx + 3, hy + 6, 2.6, 1.4, 0x5aba48); P.put(hx + 4, hy + 5, 0x9aff8a); }
            if (id === 'glowworm' || id === 'starworm') P.spark(hx + 4, hy - 3, id === 'starworm' ? 0xfff0a0 : 0xd8ffc8);
            if (id === 'riftworm' && f % 2) for (let x = 8; x < 24; x++) { const v = P.get(x, 18); if (v >= 0) { P.put(x + 2, 18, v); P.put(x, 18, -1); } }
            if (id !== 'rotworm') { P.put(hx - 1, hy, 0x0a0614); P.put(hx + 1, hy, 0x0a0614); }
            else { P.put(hx - 1, hy, 0xff4a2a, 1); P.put(hx + 1, hy, 0xff4a2a, 1); }
            P.ell(16, 30, 7, 2, 0x3a2414);   // the hole it's in
        }, 8);
    }
    _soilTex() {   // a close-up of a bed's soil: dark loam, pebbles, roots
        return MenuArt.tex(this, 'gd4_soil', 180, 100, P => {
            const n = MenuArt.noise(57), R = MenuArt.rng(57);
            for (let y = 0; y < 100; y++) for (let x = 0; x < 180; x++) { const v = MenuArt.fbm(n, x * 0.06, y * 0.06, 3) + (MenuArt.bayer(x, y) - 0.5) * 0.15; P.put(x, y, v > 0.62 ? 0x6a4a30 : v > 0.48 ? 0x5a3e28 : v > 0.36 ? 0x4a3020 : 0x3a2418); }
            for (let k2 = 0; k2 < 90; k2++) { const x = R() * 180, y = R() * 100; P.put(x, y, R() < 0.5 ? 0x8a8478 : 0x6a6458); P.put(x + 1, y, 0x4a4438); }
            for (let k2 = 0; k2 < 6; k2++) { let x = R() * 180, y = 0; for (let j = 0; j < 40; j++) { x += (R() - 0.5) * 2; y += 1.5; P.put(x, y, 0x2a1a10); } }
        });
    }
    _wormGame(k) {
        this._closePanel(true);
        const W = this.scale.width, H = this.scale.height, D = 8000, objs = this._panelObjs = [], keep = o => { objs.push(o); o?.setScrollFactor?.(0); return o; }, s = Garden.state();
        const tier = s.tier, grab = 30 + (tier - 1) * 9, slow = 1 + (tier - 1) * 0.12, LEN = 36000;
        const bw = Math.min(W - 80, 900), bh = Math.min(H - 170, 500), bx = W / 2 - bw / 2, by = H / 2 - bh / 2 + 20;
        keep(this.add.rectangle(0, 0, W, H, 0x05030a, 0.7).setOrigin(0).setDepth(D).setInteractive());
        const board = keep(this.add.container(0, 0).setDepth(D + 1));
        const frame = this.add.graphics(); frame.fillStyle(0x3a2414, 1); frame.fillRect(bx - 16, by - 16, bw + 32, bh + 32); frame.fillStyle(0x7a5434, 1); frame.fillRect(bx - 12, by - 12, bw + 24, bh + 24); frame.fillStyle(0x9a7448, 1); frame.fillRect(bx - 12, by - 12, bw + 24, 6);
        const soil = this.add.image(bx, by, this._soilTex()).setOrigin(0).setDisplaySize(bw, bh);
        board.add([frame, soil]);
        board.setScale(0.25); board.x = W / 2 * 0.75; board.y = H / 2 * 0.75;
        this.tweens.add({ targets: board, scale: 1, x: 0, y: 0, duration: 450, ease: 'Cubic.easeOut' });
        const hud = (x, y, t, o = {}) => keep(this.add.text(x, y, t, Object.assign({ fontSize: '16px', fontFamily: UIKit.FONT.title, fontStyle: 'bold', color: '#fff0c0', stroke: '#1a0e08', strokeThickness: 4 }, o)).setDepth(D + 5));
        const title = hud(W / 2, by - 50, 'PICK THE PESTS  ·  LEAVE THE HELPERS', { fontSize: '20px' }).setOrigin(0.5);
        const info = hud(bx, by - 26, ''), bar = keep(this.add.graphics().setDepth(D + 5));
        const G = this._worm = { k, objs, worms: [], caught: 0, strikes: 0, t0: 0, over: false, live: false };
        const draw = () => {
            info.setText(`picked ${G.caught}    ${'✖'.repeat(G.strikes)}${'·'.repeat(5 - G.strikes)}`);
            bar.clear(); if (!G.live) return;
            const u = Math.max(0, 1 - (this.time.now - G.t0) / LEN); bar.fillStyle(0x1a0e08, 1); bar.fillRect(bx + bw - 260, by - 26, 260, 14); bar.fillStyle(u < 0.25 ? 0xffb040 : 0x9aff8a, 1); bar.fillRect(bx + bw - 258, by - 24, 256 * u, 10);
        };
        const start = () => {
            const cd = hud(W / 2, H / 2, '3', { fontSize: '96px' }).setOrigin(0.5);
            ['3', '2', '1', 'GO!'].forEach((t, i) => this.time.delayedCall(i * 650, () => { if (!cd.active) return; cd.setText(t).setScale(1.4).setAlpha(1); this.tweens.add({ targets: cd, scale: 1, duration: 300, ease: 'Back.easeOut' }); Sfx.play(this, i < 3 ? 'e_tick' : 'e_quality', { p: 0.5 + i * 0.2 }); if (i === 3) this.tweens.add({ targets: cd, alpha: 0, delay: 350, duration: 250 }); }));
            this.time.delayedCall(4 * 650, () => { if (G.over || !this._panelObjs) return; G.live = true; G.t0 = this.time.now; G.next = 0; });
        };
        // the first time: who's who
        if (!s.wormTut) {
            const cg = keep(this.add.graphics().setDepth(D + 6)), cw = 560, ch = 300, cx = W / 2 - cw / 2, cy = H / 2 - ch / 2;
            cg.fillStyle(0x140e22, 0.97); cg.fillRoundedRect(cx, cy, cw, ch, 12); cg.lineStyle(3, 0xffd070, 1); cg.strokeRoundedRect(cx, cy, cw, ch, 12);
            const card = [cg];
            card.push(hud(W / 2, cy + 28, 'WHO\'S WHO IN THE SOIL', { fontSize: '20px' }).setOrigin(0.5).setDepth(D + 7));
            Garden.WORMS.slice(0, 4).forEach((Wm, i) => {
                const x = cx + 80 + i * 133, ik = this._wormTex(Wm);
                card.push(keep(this.add.sprite(x, cy + 140, ik, '0').setScale(2.6).setDepth(D + 7)).play(ik));
                card.push(hud(x, cy + 172, Wm.name, { fontSize: '13px' }).setOrigin(0.5, 0).setDepth(D + 7));
                card.push(hud(x, cy + 194, Wm.pest ? 'PICK IT' : 'LEAVE IT', { fontSize: '14px', color: Wm.pest ? '#ff8a6a' : '#9aff8a' }).setOrigin(0.5, 0).setDepth(D + 7));
            });
            const b = UIKit.button(this, { x: W / 2, y: cy + ch - 34, w: 180, h: 38, label: 'GOT IT', accent: 0xffd070, depth: D + 8, fontSize: '14px', fireOn: 'down', onClick: () => { const st = Garden.state(); st.wormTut = true; Garden._set(st); card.forEach(o => o.destroy()); b.objs.forEach(o => o.destroy()); start(); } });
            b.objs.forEach(keep);
        } else start();
        const spawn = t => {
            const u = (t - G.t0) / LEN, Wm = Garden.pickWorm(), ik = this._wormTex(Wm), x = bx + 50 + Math.random() * (bw - 100), y = by + 70 + Math.random() * (bh - 100);
            const spr = keep(this.add.sprite(x, y, ik, '0').setOrigin(0.5, 0.95).setScale(3.2, 0).setDepth(D + 2 + y * 0.0001)).play(ik);
            this.tweens.add({ targets: spr, scaleY: 3.2, duration: 220, ease: 'Back.easeOut' });
            G.worms.push({ Wm, spr, born: t, life: (2700 - u * 900) * slow, vx: (Math.random() - 0.5) * 0.03, flashed: false });
        };
        const end = () => {
            if (G.over) return; G.over = true; G.live = false;
            const perfect = G.strikes === 0 && G.caught > 0, bonus = G.strikes >= 5 ? 1 + 0.01 * Math.min(G.caught, 10) : perfect ? 1.25 : 1.15;
            if (G.caught > 0 || G.strikes < 5) Garden.clearWorms(k, bonus); else Garden.skipWorms(k);
            G.worms.forEach(w => w.spr.destroy()); G.worms = [];
            const cg = keep(this.add.graphics().setDepth(D + 6)), cw = 460, ch = 230, cx = W / 2 - cw / 2, cy = H / 2 - ch / 2;
            cg.fillStyle(0x140e22, 0.97); cg.fillRoundedRect(cx, cy, cw, ch, 12); cg.lineStyle(3, perfect ? 0xffd070 : 0x9aff8a, 1); cg.strokeRoundedRect(cx, cy, cw, ch, 12);
            hud(W / 2, cy + 36, perfect ? 'PERFECT!' : G.strikes >= 5 ? 'THAT\'S FIVE STRIKES' : 'BED CLEARED', { fontSize: '26px', color: perfect ? '#ffd070' : '#d8ffd8' }).setOrigin(0.5).setDepth(D + 7);
            hud(W / 2, cy + 92, `${G.caught} pest${G.caught === 1 ? '' : 's'} picked  ·  ${G.strikes} strike${G.strikes === 1 ? '' : 's'}\nthis bed's harvest: +${Math.round((bonus - 1) * 100)}% dust`, { fontSize: '15px', align: 'center', fontFamily: 'monospace' }).setOrigin(0.5).setDepth(D + 7);
            UIKit.button(this, { x: W / 2, y: cy + ch - 36, w: 220, h: 38, label: 'BACK TO THE GARDEN', accent: 0x9aff8a, depth: D + 8, fontSize: '13px', fireOn: 'down', onClick: () => this._closePanel() }).objs.forEach(keep);
            Sfx.play(this, perfect ? 'e_land' : 'e_quality', { r: perfect ? 3 : 1 });
            if (perfect) { const sp = keep(this.add.particles(0, 0, 'mn_px2', { x: W / 2, y: cy + 36, lifespan: 1000, speed: { min: 80, max: 260 }, scale: { start: 2.4, end: 0 }, tint: [0xffd070, 0xffffff, 0x9aff8a], blendMode: 'ADD', emitting: false }).setDepth(D + 7)); sp.explode(60); }
        };
        const strike = (x, y, why) => {
            G.strikes++; Sfx.play(this, 'deny'); this.cameras.main.shake(120, 0.004);
            const t = hud(x, y - 40, why, { fontSize: '14px', color: '#ff8a6a' }).setOrigin(0.5); this.tweens.add({ targets: t, y: y - 80, alpha: 0, duration: 800, onComplete: () => t.destroy() });
            if (G.strikes >= 5) end();
        };
        keep(this.add.zone(bx, by, bw, bh).setOrigin(0).setInteractive({ useHandCursor: true }).setDepth(D + 4)).on('pointerdown', p => {
            if (!G.live) return;
            let best = null, bd = grab;
            for (const w of G.worms) { if (w.gone) continue; const d = Math.hypot(w.spr.x - p.x, w.spr.y - 30 - p.y); if (d < bd) { bd = d; best = w; } }
            if (!best) return;
            best.gone = true; G.worms = G.worms.filter(w => w !== best);
            if (best.Wm.pest) {   // pulled out: up, wriggling, spinning off, with a pop of soil
                G.caught++; Garden.logWorm(best.Wm.id); Sfx.play(this, 'pickup');
                const sp = keep(this.add.particles(0, 0, 'mn_px2', { x: best.spr.x, y: best.spr.y, lifespan: 500, speed: { min: 40, max: 150 }, angle: { min: 200, max: 340 }, gravityY: 300, scale: { start: 2, end: 0 }, tint: [0x5a3e28, 0x8a6a40], emitting: false }).setDepth(D + 3)); sp.explode(14);
                this.tweens.add({ targets: best.spr, y: best.spr.y - 120, angle: (Math.random() < 0.5 ? -1 : 1) * 540, alpha: 0, scaleX: 3, duration: 520, ease: 'Quad.easeOut', onComplete: () => best.spr.destroy() });
                if (best.Wm.w <= 3) { const t = hud(best.spr.x, best.spr.y - 50, `a ${best.Wm.name.toUpperCase()}!`, { fontSize: '16px', color: '#ffe08a' }).setOrigin(0.5); this.tweens.add({ targets: t, y: t.y - 40, alpha: 0, duration: 1200, onComplete: () => t.destroy() }); }
            } else {
                best.spr.setTint(0xff6a5a); this.tweens.add({ targets: best.spr, scaleY: 0, duration: 200, onComplete: () => best.spr.destroy() });
                strike(best.spr.x, best.spr.y, 'that one was a helper!');
            }
        });
        G.tick = t => {
            if (!this._panelObjs || this._worm !== G) { this._ticks = this._ticks.filter(f => f !== G.tick); return; }
            draw();
            if (!G.live) return;
            const u = (t - G.t0) / LEN;
            if (u >= 1) return end();
            if (t >= G.next) { spawn(t); G.next = t + (1100 - u * 520) * slow * (0.7 + Math.random() * 0.6); }
            for (const w of [...G.worms]) {
                const age = t - w.born; w.spr.x += w.vx * 16;
                if (w.Wm.pest && !w.flashed && age > w.life - 520) { w.flashed = true; this.tweens.add({ targets: w.spr, alpha: 0.3, duration: 90, yoyo: true, repeat: 2 }); }
                if (age > w.life) {
                    w.gone = true; G.worms = G.worms.filter(q => q !== w);
                    this.tweens.add({ targets: w.spr, scaleY: 0, duration: 200, onComplete: () => w.spr.destroy() });
                    if (w.Wm.pest) strike(w.spr.x, w.spr.y, 'it got away');
                    if (G.over) return;
                }
            }
        };
        this._ticks.push(G.tick);
        Sfx.play(this, 'e_flip');
    }

    // ── AQUARIUMS ─────────────────────────────────────────────────────────────
    // Each kind its own build, painted in two layers (behind the fish, in front of them):
    //   river   a glass tank on a carved oak cabinet: river pebbles, a driftwood arch, reeds, a little waterwheel
    //   lake    a wrought-iron tank on a stone plinth, green-gone-teal water: silt, crystal shards, an open clam
    //           with its pearl, kelp, lily pads on top
    //   cosmic  not a tank at all: a pool sunk in a ring of cave rock, its violet fluid swirling, crystals growing
    //           out of the rim; its fish swim at the surface
    // Tended (lit): sparkles drift in the water, bubbles rise, the fish swim. Untended: murky, the fish doze.
    _tankArt(kind, layer) {
        const W2 = 48, H2 = kind === 'cosmic' ? 32 : 46, M = MenuArt.mix;
        return MenuArt.tex(this, `gd6_tank_${kind}_${layer}`, W2, H2, P => {
            const R = MenuArt.rng(kind.length * 31 + (layer === 'front' ? 7 : 0)), n = MenuArt.noise(kind.length * 13);
            const out = () => { for (let y = 0; y < H2; y++) for (let x = 0; x < W2; x++) if (P.alpha(x, y) > 0.9 && [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => P.alpha(x + dx, y + dy) < 0.5)) P.put(x, y, 0x1c1728); };
            if (kind === 'cosmic') {
                const cx = 23.5, cy = 15.5, ell = (x, y, rx, ry) => ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2;
                if (layer === 'back') {
                    for (let y = 0; y < H2; y++) for (let x = 0; x < W2; x++) {
                        const e = ell(x, y, 23, 14);
                        if (e > 1) continue;
                        if (ell(x, y, 19, 10) <= 1) {   // the fluid: banded violet, a swirl, deeper toward the middle
                            const a = Math.atan2(y - cy, (x - cx) * 0.55), d = Math.sqrt(ell(x, y, 19, 10)), v = Math.sin(a * 2 + d * 6) * 0.5 + 0.5;
                            P.put(x, y, d < 0.35 ? 0x1a0838 : v > 0.75 ? 0x8a4ae0 : v > 0.4 ? 0x5a2aa8 : 0x3a1878);
                            if ((x * 7 + y * 13) % 41 === 0) P.put(x, y, 0xd8a8ff);
                        } else {   // the rock: chunky blocks, lit from the top left, cracks with fluid glowing in them
                            const blk = Math.floor(Math.atan2(y - cy, x - cx) * 3.2 + 10), sh = MenuArt.rng(blk * 17)(), top = y < cy;
                            let c = M(sh > 0.5 ? 0x5a5070 : 0x463e5c, top ? 0x8a80a8 : 0x241e34, top ? 0.25 : 0.35);
                            if (ell(x, y, 21.5, 12.5) > 1 && !top) c = 0x2a2438;
                            if (Math.floor(Math.atan2(y - cy, x - cx) * 3.2 + 10.02) !== blk) c = 0x1c1728;
                            P.put(x, y, c);
                        }
                    }
                    for (const [x, y, h, col] of [[5, 9, 8, 0xb07aff], [41, 8, 10, 0xd8a8ff], [36, 4, 6, 0x8affd8], [9, 21, 5, 0x8affd8]]) for (let j = 0; j < h; j++) { const w = Math.max(0.5, 1.6 * (1 - j / h)); for (let i = -w; i <= w; i++) P.put(x + i, y - j, j > h - 2 ? 0xffffff : i < 0 ? M(col, 0xffffff, 0.5) : col); }
                } else {   // the near lip of the rim, over the fish
                    for (let y = 0; y < H2; y++) for (let x = 0; x < W2; x++) { const e = ell(x, y, 23, 14); if (e > 1 || ell(x, y, 19, 10) <= 1 || y < cy + 3) continue; const blk = Math.floor(Math.atan2(y - cy, x - cx) * 3.2 + 10); P.put(x, y, Math.floor(Math.atan2(y - cy, x - cx) * 3.2 + 10.02) !== blk ? 0x1c1728 : MenuArt.rng(blk * 17)() > 0.5 ? 0x5a5070 : 0x463e5c); }
                    for (let x = 6; x < 42; x++) { const y = Math.round(cy + 10 * Math.sqrt(Math.max(0, 1 - ((x - cx) / 19) ** 2))); P.put(x, y, 0xb07aff); }
                    out();
                }
                return;
            }
            const lake = kind === 'lake', wTop = 3, wBot = 31;
            if (layer === 'back') {
                for (let y = wTop; y < wBot; y++) for (let x = 2; x < W2 - 2; x++) {   // the water, deeper toward the bottom, faint light shafts
                    const u = (y - wTop) / (wBot - wTop); let c = lake ? M(0x5ac8a8, 0x15524a, u) : M(0x7ac8f0, 0x2a5aa0, u);
                    if (Math.abs(((x - y * 0.4) % 11) - 5) < 1.2 && u < 0.7) c = M(c, 0xffffff, 0.12 * (1 - u));
                    P.put(x, y, c);
                }
                if (!lake) {
                    for (let x = 2; x < W2 - 2; x++) for (let y = 27; y < wBot; y++) if (y > 27 + n(x * 0.5, 2) * 2) P.put(x, y, [0x9a9488, 0xb8a888, 0x7a7468, 0xc8b898][Math.floor(R() * 4)]);   // gravel
                    for (const [px, py, r, c] of [[7, 27, 2.5, 0x8a8a90], [13, 28, 1.8, 0xa8a090], [33, 27, 2.2, 0x7a8a8a], [41, 28, 1.6, 0x9a9488]]) for (let y = -r; y <= r; y++) for (let x = -r * 1.3; x <= r * 1.3; x++) if ((x / 1.3) ** 2 + y * y <= r * r) P.put(px + x, py + y, y < -r * 0.3 ? M(c, 0xffffff, 0.3) : c);   // river pebbles
                    for (let a = 0; a <= Math.PI; a += 0.05) for (let t = 0; t < 2; t++) P.put(22 + Math.cos(a) * (8 - t), 27 - Math.sin(a) * (7 - t), t ? 0x5a3a20 : 0x8a6040);   // driftwood arch
                    for (let y = 19; y < 27; y++) P.put(10, y, 0x6a4628);
                } else {
                    for (let x = 2; x < W2 - 2; x++) for (let y = 27; y < wBot; y++) if (y > 27 + n(x * 0.4, 5) * 2) P.put(x, y, (x + y) % 3 ? 0x2a3a30 : 0x3a4a38);   // silt
                    for (const [x, y, h, c] of [[8, 28, 9, 0x8affd8], [11, 28, 6, 0xd8fff0], [37, 28, 7, 0x8affd8]]) for (let j = 0; j < h; j++) { const w = Math.max(0.5, 1.4 * (1 - j / h)); for (let i = -w; i <= w; i++) P.put(x + i, y - j, j > h - 2 ? 0xffffff : i < 0 ? 0xd8fff0 : c); }   // crystal shards
                    for (let x = -4; x <= 4; x++) { P.put(24 + x, 28, 0xd8c8b8); P.put(24 + x, 27 - Math.abs(x) * 0.6 - 2, 0xe8dcd0); } P.put(24, 26, 0xffffff); P.put(25, 26, 0xf0f0ff); P.put(24, 25, 0xe8e8ff);   // an open clam, its pearl
                }
            } else {
                // the frame: river a pale wooden-cornered glass tank with a brass rim; lake dark iron with teal patina
                const FR = lake ? [0x2a3038, 0x4a5868, 0x5ac8a8] : [0x6a4630, 0x8a6040, 0xd8b84a];
                for (let y = 0; y < 34; y++) for (const x of [0, 1, W2 - 2, W2 - 1]) P.put(x, y, x === 0 || x === W2 - 1 ? FR[0] : FR[1]);
                for (let x = 0; x < W2; x++) { P.put(x, 0, FR[2]); P.put(x, 1, FR[1]); P.put(x, 2, FR[0]); P.put(x, 32, FR[1]); P.put(x, 33, FR[0]); }
                for (const [cx2, cy2] of [[0, 0], [W2 - 3, 0], [0, 30], [W2 - 3, 30]]) for (let j = 0; j < 4; j++) for (let i = 0; i < 3; i++) P.put(cx2 + i, cy2 + j, lake ? (i + j) % 2 ? 0x5ac8a8 : 0x3a8a78 : 0xd8b84a);
                                for (let k = 0; k < 6; k++) P.put(W2 - 6 + k * 0.3, 20 + k, 0xffffff, 0.3);
                if (lake) for (const [lx, c] of [[12, 0x4a9a58], [30, 0x5aaa68]]) { for (let x = -3; x <= 3; x++) P.put(lx + x, 4, c); P.put(lx + 1, 3, 0xff9ad8); P.put(lx + 2, 3, 0xffd8f0); }   // lily pads
                // the stand
                for (let y = 34; y < H2; y++) for (let x = 2; x < W2 - 2; x++) {
                    let c;
                    if (lake) c = (y - 34) % 4 === 0 || (x + Math.floor((y - 34) / 4) * 4) % 9 === 0 ? 0x3a3854 : y < 36 ? 0x9a98b0 : 0x6a6880;   // stone blocks
                    else c = y === 34 ? 0xa07a50 : y === H2 - 1 ? 0x3a2414 : x % 11 === 0 ? 0x4a2e1e : (x > 6 && x < 20 && y > 36 && y < 43) || (x > 27 && x < 41 && y > 36 && y < 43) ? (x === 7 || x === 28 || y === 37 ? 0x4a2e1e : 0x7a5434) : 0x6a4630;   // oak with two carved panels
                    P.put(x, y, c);
                }
                if (!lake) { P.put(13, 40, 0xd8b84a); P.put(34, 40, 0xd8b84a); }
                out();
            }
        });
    }
    _tankSetup(kind) {
        const t = Garden.tank(kind); if (!t) return;
        const [tx, ty, tw, th] = GardenScene.TANKS[kind], T = this.T, k = T / 16, x0 = this._px(tx), y1 = this._py(ty + th), cos = kind === 'cosmic', H2 = cos ? 32 : 46, z = y1;
        const reg = o => { (this._reg['TANKS' + kind] ||= []).push(o); return o; };
        reg(this.add.image(x0, y1, this._tankArt(kind, 'back')).setOrigin(0, 1).setScale(k).setDepth(cos ? 1.5 : z - 0.6));
        const top = y1 - H2 * k, water = cos ? { x: x0 + 8 * k, y: top + 8 * k, w: 32 * k, h: 16 * k } : { x: x0 + 3 * k, y: top + 4 * k, w: 42 * k, h: 22 * k };
        const fish = t.fish.map((id, i) => {
            const F = Garden.FISH.find(f => f.id === id), ik = this._fishTex(F), sp = reg(this.add.sprite(water.x + water.w * Math.random(), water.y + 4 * k + (water.h - 9 * k) * ((i * 0.618) % 1), ik, '0').setScale(k * (cos ? 0.3 : 0.28)).setDepth(cos ? 1.6 : z - 0.5).play(ik));
            sp._a = Math.random() * 6.28; sp._v = (Math.random() < 0.5 ? -1 : 1) * (0.01 + Math.random() * 0.008); sp._y0 = sp.y; return sp;
        });
        const murk = reg(cos ? this.add.ellipse(x0 + 23.5 * k, top + 15.5 * k, 38 * k, 20 * k, 0x0a0614, 0.5).setDepth(1.65) : this.add.rectangle(water.x, water.y - k, water.w, water.h + 5 * k, 0x1a2a2a, 0.45).setOrigin(0).setDepth(z - 0.45));
        const sparks = reg(this.add.particles(0, 0, 'mn_px2', { x: { min: water.x, max: water.x + water.w }, y: { min: water.y, max: water.y + water.h }, lifespan: 1400, speed: { min: 2, max: 8 }, scale: { start: 0, end: 1.1, ease: 'Sine.easeInOut' }, alpha: { start: 0.9, end: 0 }, tint: cos ? [0xffffff, 0xd8a8ff, 0xff9ad8] : kind === 'lake' ? [0xffffff, 0xd8fff0] : [0xffffff, 0xfff0c0], blendMode: 'ADD', frequency: 260 }).setDepth(cos ? 1.7 : z - 0.4));
        const bub = reg(this.add.particles(0, 0, 'mn_px2', { x: { min: water.x + 4, max: water.x + water.w - 4 }, y: water.y + water.h, lifespan: 1400, speedY: { min: -24, max: -10 }, scale: { start: 1, end: 0.4 }, alpha: { start: 0.6, end: 0 }, tint: 0xffffff, frequency: 420 }).setDepth(z - 0.45));
        if (cos) bub.setVisible(false);
        reg(this.add.image(x0, y1, this._tankArt(kind, 'front')).setOrigin(0, 1).setScale(k).setDepth(cos ? 1.8 : z - 0.3));
        // what moves, drawn every frame in the tank's own pixels: behind the fish (light, plants, the wheel; in the
        // pool its swirl), and over them (the surface and the glass's glare; in the pool a thin film of the fluid)
        const back = reg(this.add.graphics().setDepth(cos ? 1.55 : z - 0.55)), over = reg(this.add.graphics().setDepth(cos ? 1.65 : z - 0.35));
        if (!cos) over.setBlendMode(Phaser.BlendModes.ADD);
        const X = u => x0 + u * k, Y = v => top + v * k, ADD = Phaser.BlendModes.ADD;
        const halos = cos ? fish.map(f => reg(this.add.sprite(f.x, f.y, f.texture.key, '0').setScale(f.scaleX * 1.25).setTintFill(0xd8a8ff).setAlpha(0.45).setBlendMode(ADD).setDepth(1.58))) : [];
        const ripples = [];
        const drawLive = (tt, lit) => {
            back.clear(); over.clear();
            if (cos) {
                const cx = 23.5, cy = 15.5;
                // the fluid turning: three spiral arms of light, a breathing core, blobs that swell and pop
                back.setBlendMode(ADD);
                for (let arm = 0; arm < 3; arm++) for (let i = 0; i < 26; i++) {
                    const r = 0.15 + i / 26 * 0.85, a = arm * 2.094 + r * 4.2 + tt * 0.0009 * (lit ? 1 : 0.3);
                    back.fillStyle(i % 3 ? 0x8a4ae0 : 0xd8a8ff, (1 - r) * 0.55); back.fillRect(X(cx + Math.cos(a) * 18 * r) - k * 0.5, Y(cy + Math.sin(a) * 9 * r) - k * 0.5, k, k);
                }
                const br = 0.5 + 0.5 * Math.sin(tt * 0.002); back.fillStyle(0xb07aff, 0.18 + 0.12 * br); back.fillEllipse(X(cx), Y(cy), 12 * k * (0.9 + 0.2 * br), 6 * k * (0.9 + 0.2 * br));
                for (let b = 0; b < 4; b++) { const ph = (tt * 0.0004 + b * 0.25) % 1, bx = cx + Math.cos(b * 2.3) * 12, by = cy + Math.sin(b * 1.7) * 6; back.lineStyle(1, 0xd8a8ff, (1 - ph) * 0.7); back.strokeEllipse(X(bx), Y(by), ph * 6 * k, ph * 3 * k); }
                // the fish are in it, not on it: a film of the fluid's light passes over them, and they leave ripples
                over.setBlendMode(ADD);
                for (let i = 0; i < 18; i++) { const a = i * 0.35 + tt * 0.0006, r = 0.3 + (i % 6) * 0.11; over.fillStyle(0x5a2aa8, 0.22); over.fillEllipse(X(cx + Math.cos(a) * 17 * r), Y(cy + Math.sin(a) * 8.5 * r), 4 * k, 1.6 * k); }
                for (const [i, f] of fish.entries()) {
                    const h = halos[i]; if (h?.active) { h.setPosition(f.x, f.y).setFlipX(f.flipX).setFrame(f.frame.name); h.setAlpha(lit ? 0.45 + 0.15 * Math.sin(tt * 0.004 + i) : 0.15); }
                    if (lit && tt - (f._ripAt || 0) > 520) { f._ripAt = tt; ripples.push({ x: f.x, y: f.y + k, t: tt }); }
                }
                for (let i = ripples.length - 1; i >= 0; i--) { const r = ripples[i], u = (tt - r.t) / 1100; if (u >= 1) { ripples.splice(i, 1); continue; } over.lineStyle(1, 0xe8d0ff, 0.6 * (1 - u)); over.strokeEllipse(r.x, r.y, (2 + u * 9) * k, (1 + u * 4) * k); }
                return;
            }
            const lake = kind === 'lake', sp = lit ? 1 : 0.3;
            // light shafts from the surface and caustics wandering over the back and the floor
            for (let i = 0; i < 3; i++) { const sx = 8 + i * 14 + Math.sin(tt * 0.0005 + i) * 3; back.fillStyle(0xffffff, (0.05 + 0.03 * Math.sin(tt * 0.0013 + i * 2)) * sp); back.fillPoints([{ x: X(sx), y: Y(4) }, { x: X(sx + 4), y: Y(4) }, { x: X(sx - 2), y: Y(28) }, { x: X(sx - 8), y: Y(28) }], true); }
            for (let i = 0; i < 7; i++) { const u = ((i * 0.37 + tt * 0.00005 * (1 + i % 3)) % 1), v = 0.25 + ((i * 0.53) % 1) * 0.6; back.fillStyle(0xffffff, 0.09 * sp); back.fillEllipse(X(3 + u * 42), Y(4 + v * 24) + Math.sin(tt * 0.003 + i) * k, (3 + (i % 3)) * k, 1.4 * k); }
            // plants swaying, rooted on the floor
            const sway = (x, h, c1, c2, leaf) => { let px = X(x), py = Y(28); for (let j = 1; j <= h; j++) { const nx = X(x + Math.sin(tt * 0.0018 * (lit ? 1 : 0.4) + x * 0.7 + j * 0.25) * j * 0.07), ny = Y(28 - j); back.lineStyle(k, j % 3 ? c1 : c2, 1); back.lineBetween(px, py, nx, ny); if (leaf && j % 4 === 2) { back.fillStyle(c2, 1); back.fillEllipse(nx + k * 1.5 * (j % 8 ? 1 : -1), ny, 3 * k, 1.2 * k); } px = nx; py = ny; } };
            if (!lake) { for (const [x, h] of [[38, 15], [40, 19], [43, 16]]) sway(x, h, 0x4a8a3a, 0x6aaa48, false); }
            else for (const [x, h] of [[16, 20], [31, 18], [42, 21]]) sway(x, h, 0x3a7a5a, 0x5aa87a, true);
            if (!lake) {   // the waterwheel turning
                const a0 = tt * 0.0012 * sp; back.lineStyle(k, 0x8a6040, 1); back.strokeCircle(X(10), Y(15), 4 * k);
                for (let s2 = 0; s2 < 6; s2++) { const a = a0 + s2 * Math.PI / 3; back.lineStyle(k, 0x6a4628, 1); back.lineBetween(X(10), Y(15), X(10 + Math.cos(a) * 5), Y(15 + Math.sin(a) * 5)); back.fillStyle(0xa07a50, 1); back.fillRect(X(10 + Math.cos(a) * 5) - k, Y(15 + Math.sin(a) * 5) - k, 2 * k, 2 * k); }
                back.lineStyle(k, 0x6a4628, 1); back.lineBetween(X(10), Y(19), X(10), Y(27));
            }
            // over the fish: the surface rippling, and the glass's glare sliding slowly across
            for (let x = 2; x < 46; x += 2) { const w = Math.sin(x * 0.55 + tt * 0.004) * 0.5; over.fillStyle(0xffffff, 0.35); over.fillRect(X(x), Y(3.6 + w), 2 * k, k * 0.8); over.fillStyle(lake ? 0x8affd8 : 0xbfe8ff, 0.2); over.fillRect(X(x), Y(4.6 + w), 2 * k, k); }
            const gx = 4 + ((tt * 0.004) % 60) - 8;
            over.fillStyle(0xffffff, 0.07); over.fillPoints([{ x: X(gx), y: Y(3) }, { x: X(gx + 5), y: Y(3) }, { x: X(gx - 4), y: Y(31) }, { x: X(gx - 9), y: Y(31) }], true);
            over.fillStyle(0xffffff, 0.12); over.fillPoints([{ x: X(5), y: Y(5) }, { x: X(6.5), y: Y(5) }, { x: X(12), y: Y(19) }, { x: X(10.5), y: Y(19) }], true);
        };
        let last = 0;
        this._ticks.push(tt => {
            if (!murk.active) return;
            const lit = Garden.tankLit(kind), dt = Math.min(100, tt - (last || tt)); last = tt;
            murk.setVisible(!lit); sparks.emitting = lit; bub.emitting = lit && !cos;
            if (!lit) murk.setAlpha(0.4 + 0.08 * Math.sin(tt * 0.0015));
            drawLive(tt, lit);
            for (const f of fish) {
                if (cos) {   // round and round the pool, at its surface
                    f._a += f._v * dt * 0.08 * (lit ? 1 : 0.25);
                    const rx = water.w * 0.42 * (0.6 + 0.4 * ((f._y0 * 7) % 1)), ry = water.h * 0.42;
                    const nx = x0 + 23.5 * k + Math.cos(f._a) * rx, ny = top + 15.5 * k + Math.sin(f._a) * ry;
                    f.setFlipX(nx > f.x); f.setPosition(nx, ny);
                } else {
                    f.x += f._v * dt * (lit ? 1 : 0.2) * k;
                    if (f.x < water.x + 5 * k || f.x > water.x + water.w - 5 * k) { f._v *= -1; f.x = Phaser.Math.Clamp(f.x, water.x + 5 * k, water.x + water.w - 5 * k); }
                    f.setFlipX(f._v > 0);
                    const ty2 = lit ? f._y0 : water.y + water.h - 4 * k; f.y += (ty2 + Math.sin(tt * 0.002 + f.x) * k - f.y) * 0.05;
                }
                f.setTint(lit ? 0xffffff : 0x7a8080); if (lit) f.anims.resume(); else f.anims.pause();
            }
        });
    }
    // sprinkling: a handful of stardust thrown from the slime, glowing as it flies (it lights the ground it passes
    // over), settling into the water in a shimmer that fades back to the tank's own gentle sparkle
    _sprinkleFx(kind) {
        const T = this.T, [tx, ty, tw, th] = GardenScene.TANKS[kind], ex = this._px(tx + tw / 2), ey = this._py(ty + th * 0.4), sx = this.fx, sy = this.fy - T * 0.6;
        this.player.setScale(T / 16 * 1.08, T / 16 * 0.92); this.time.delayedCall(160, () => this.player.setScale(T / 16));
        Sfx.play(this, 'e_quality');
        for (let i = 0; i < 14; i++) {
            const d = this.add.image(sx, sy, 'mn_px2').setTint(i % 3 ? 0xd8c8ff : 0xfff0c0).setBlendMode(Phaser.BlendModes.ADD).setScale(1.6).setDepth(6000);
            const lt = this.add.image(sx, sy, 'mn_glow').setTint(0xc8b0ff).setBlendMode(Phaser.BlendModes.ADD).setDisplaySize(T * 1.2, T * 1.2).setAlpha(0.35).setDepth(5999);
            const o = { u: 0 }, dx = (Math.random() - 0.5) * T * 1.4, hy = T * (1 + Math.random() * 0.8);
            this.tweens.add({ targets: o, u: 1, duration: 600 + i * 30, delay: i * 25, ease: 'Sine.easeIn', onUpdate: () => {
                const x = sx + (ex + dx - sx) * o.u, y = sy + (ey - sy) * o.u - Math.sin(o.u * Math.PI) * hy; d.setPosition(x, y); lt.setPosition(x, y);
            }, onComplete: () => { d.destroy(); this.tweens.add({ targets: lt, alpha: 0, duration: 900, onComplete: () => lt.destroy() }); } });
        }
        this.time.delayedCall(900, () => {
            const glow = this.add.image(ex, ey, 'mn_glow').setTint(0xd8c8ff).setBlendMode(Phaser.BlendModes.ADD).setDisplaySize(T * 4, T * 3).setAlpha(0.5).setDepth(this._py(ty + th) + 1);
            this.tweens.add({ targets: glow, alpha: 0, duration: 2200, ease: 'Quad.easeOut', onComplete: () => glow.destroy() });
            const sp = this.add.particles(0, 0, 'mn_px2', { x: { min: ex - T, max: ex + T }, y: { min: ey - T * 0.5, max: ey + T * 0.5 }, lifespan: 1000, speed: { min: 10, max: 40 }, scale: { start: 1.6, end: 0 }, tint: [0xffffff, 0xd8c8ff, 0xfff0c0], blendMode: 'ADD', emitting: false }).setDepth(this._py(ty + th) + 2);
            sp.explode(30); this.time.delayedCall(1100, () => sp.destroy());
            this._float(ex, ey - T, 'the tank comes alive', '#d8c8ff');
        });
    }
    _tanksSetup() { for (const kind of Object.keys(Garden.TANK_KINDS)) { (this._reg['TANKS' + kind] || []).forEach(o => o.destroy()); this._reg['TANKS' + kind] = []; this._tankSetup(kind); } }
    _tankPanel(kind) {
        this._closePanel(true);
        Garden.tankTick(kind);
        const s = Garden.slots(), t = Garden.tank(kind), W = this.scale.width, H = this.scale.height, D = 8000, objs = this._panelObjs = [], keep = o => { objs.push(o); o?.setScrollFactor?.(0); return o; };
        const INK = '#3b2716', FADE = '#8a7254', HAND = 'Georgia, "Times New Roman", serif', pw = Math.min(W - 40, 820), ph = Math.min(H - 40, 600), px = W / 2 - pw / 2, py = H / 2 - ph / 2;
        keep(this.add.rectangle(0, 0, W, H, 0x05030a, 0.65).setOrigin(0).setDepth(D).setInteractive()).on('pointerdown', () => this._closePanel());
        keep(this.add.image(px, py, this._diaryTex('cover', pw, ph)).setOrigin(0).setDisplaySize(pw, ph).setDepth(D + 1));
        keep(this.add.image(px + 18, py + 18, this._diaryTex('pageR', pw - 36, ph - 36)).setOrigin(0).setDisplaySize(pw - 36, ph - 36).setDepth(D + 1.2)).setInteractive();
        const txt = (x, y, t2, o = {}) => keep(this.add.text(x, y, t2, Object.assign({ fontSize: '13px', fontFamily: HAND, fontStyle: 'italic', color: INK }, o)).setDepth(D + 3));
        const lit = Garden.tankLit(kind), left = Math.max(0, (t.lit || 0) - Date.now()), water = { river: 'river', lake: 'lagoon', cosmic: 'Underwell' }[kind];
        keep(this.add.image(px + pw - 120, py + 58, this._tankArt(kind, 'back')).setScale(1.6).setDepth(D + 2)); keep(this.add.image(px + pw - 120, py + 58, this._tankArt(kind, 'front')).setScale(1.6).setDepth(D + 2.1));
        txt(px + 40, py + 30, Garden.TANK_KINDS[kind].name, { fontSize: '26px', fontFamily: UIKit.FONT.title, fontStyle: 'bold' });
        txt(px + 42, py + 64, lit ? `lively for ${this._time(left)}  ·  ✧${Garden.tankRate(t).toFixed(1)} an hour  ·  ${new Set(t.fish).size} kinds on show` : 'it\'s gone murky: the fish are dozing. A sprinkle of stardust livens it up.', { color: lit ? '#2a6a4a' : '#8a4a2a' });
        txt(px + 42, py + 84, `only ${water} fish live in it`, { color: FADE, fontSize: '12px' });
        UIKit.button(this, { x: px + pw - 46, y: py + 42, w: 40, h: 30, label: 'X', accent: UIKit.PALETTE.line, depth: D + 4, fontSize: '12px', fireOn: 'down', onClick: () => this._closePanel() }).objs.forEach(keep);
        const btn = (x, y, w, label, ok, fn) => UIKit.button(this, { x, y, w, h: 36, label, accent: ok ? UIKit.PALETTE.accentGold : UIKit.PALETTE.line, depth: D + 4, fontSize: '12px', fireOn: 'down', onClick: () => { if (!ok) { Sfx.play(this, 'deny'); return; } fn(); } }).objs.forEach(keep);
        btn(px + 150, py + 124, 220, `SPRINKLE STARDUST  ✧${Garden.SPRINKLE}`, Enchants.dust() >= Garden.SPRINKLE, () => { Garden.sprinkle(kind); this._closePanel(); this._sprinkleFx(kind); });
        const acc = Math.floor(t.acc || 0);
        btn(px + 390, py + 124, 200, acc ? `COLLECT  ✧${acc}` : 'NOTHING TO COLLECT', acc > 0, () => { Garden.tankCollect(kind); Sfx.play(this, 'pickup'); this._tankPanel(kind); this._hud(); });
        const card = (x, y, F, sub, onClick) => {
            keep(this.add.image(x + 55, y + 55, this._diaryTex('card', 110, 110)).setDisplaySize(110, 110).setDepth(D + 1.7));
            const ik = this._fishTex(F); keep(this.add.sprite(x + 55, y + 48, ik, '0').setScale(1.8).setDepth(D + 2)).play(ik);
            txt(x + 55, y + 82, F.name, { fontSize: '11px', fontStyle: 'bold italic' }).setOrigin(0.5, 0);
            if (sub) txt(x + 55, y + 96, sub, { fontSize: '10px', color: FADE }).setOrigin(0.5, 0);
            keep(this.add.zone(x, y, 110, 110).setOrigin(0).setInteractive({ useHandCursor: true }).setDepth(D + 4)).on('pointerdown', onClick);
        };
        txt(px + 42, py + 164, `IN IT  ${t.fish.length} / ${t.slots}  (click one to take it out)`, { fontSize: '12px', fontStyle: 'bold', fontFamily: 'monospace' });
        const cols = Math.floor((pw - 80) / 118);
        for (let i = 0; i < t.slots; i++) {
            const x = px + 40 + (i % cols) * 118, y = py + 186 + Math.floor(i / cols) * 118, id = t.fish[i];
            if (id) card(x, y, Garden.FISH.find(f => f.id === id), null, () => { Garden.tankTake(kind, i); Sfx.play(this, 'e_dip', { big: false }); this._tankPanel(kind); this._hud(); });
            else { const g = keep(this.add.graphics().setDepth(D + 1.7)); g.lineStyle(2, 0xb8a07a, 0.8); g.strokeRoundedRect(x + 4, y + 4, 102, 102, 8); txt(x + 55, y + 50, 'empty', { color: FADE }).setOrigin(0.5); }
        }
        const yy = py + 194 + Math.ceil(t.slots / cols) * 118;
        const mine = [...s.bag, ...s.chest].filter(o => o && o.k === 'fish' && Garden.tankWater(Garden.FISH.find(f => f.id === o.id)) === kind);
        txt(px + 42, yy, mine.length ? `YOUR ${water.toUpperCase()} FISH  (click one to put it in)` : `YOUR ${water.toUpperCase()} FISH: none in your bag or chest`, { fontSize: '12px', fontStyle: 'bold', fontFamily: 'monospace' });
        mine.slice(0, cols * 2).forEach((o, i) => card(px + 40 + (i % cols) * 118, yy + 22 + Math.floor(i / cols) * 118, Garden.FISH.find(f => f.id === o.id), `x${o.n}`, () => {
            if (!Garden.tankAdd(kind, o.id)) { Sfx.play(this, 'deny'); return; } Sfx.play(this, 'e_dip', { big: true }); this._tankPanel(kind); this._hud();
        }));
    }

    // ── PETS ──────────────────────────────────────────────────────────────────
    // Each its own creature, 32px, four frames: a moth of light with fluttering wings, a crystal fox with a
    // swishing tail, a teacup dragon flapping, an owl of night sky blinking its star eyes.
    _petTex(Pt) {
        return this._sheet('gd4_pet_' + Pt.id, 4, (P, f) => {
            const b = [0, -1, -1, 0][f];
            if (Pt.id === 'mothsprite') {
                const w = [6, 4, 2, 4][f];
                for (const d of [-1, 1]) { P.ell(16 + d * (4 + w * 0.6), 12 + b, 3 + w * 0.5, 5, (x, y) => ((x + y) % 3 ? 0xfff0c0 : 0xffe08a)); P.ell(16 + d * (3 + w * 0.4), 19 + b, 2 + w * 0.3, 3, 0xffd8a0); P.put(16 + d * (4 + w * 0.6), 11 + b, 0xc88a3a); }
                P.ell(16, 15 + b, 2, 6, (x, y) => (y % 2 ? 0xfff8e0 : 0xe8d0a0)); P.disc(16, 9 + b, 2.2, 0xfff8e0);
                P.line(15, 7 + b, 13, 4 + b, 0xc8a878); P.line(17, 7 + b, 19, 4 + b, 0xc8a878); P.put(15, 9 + b, 0x0a0614); P.put(17, 9 + b, 0x0a0614);
                P.spark(16 + [6, -7, 5, -6][f], 24 - f, 0xfff0a0);
            } else if (Pt.id === 'glimfox') {
                const t = [0, 2, 3, 1][f];
                P.poly([[20, 20], [27, 14 - t], [30, 10 - t], [26, 19]], (x, y) => ((x + y) % 2 ? 0x8affd8 : 0xd8fff0)); P.put(29, 10 - t, 0xffffff, 1);
                P.ell(16, 21, 7, 4, (x, y) => (y < 20 ? 0x8affd8 : x % 3 ? 0x5ac8a8 : 0xd8fff0));
                for (const lx of [11, 14, 18, 21]) P.line(lx, 24, lx, 28, 0x3a8a78);
                P.ell(9, 15 + b, 4.5, 4, (x, y) => (x < 8 ? 0xd8fff0 : 0x8affd8)); P.poly([[6, 12 + b], [7, 6 + b], [9, 11 + b]], 0x8affd8); P.poly([[10, 11 + b], [12, 6 + b], [13, 12 + b]], 0x8affd8);
                P.line(4, 16 + b, 6, 17 + b, 0x2a6a58); P.put(8, 14 + b, 0x0a0614); P.put(11, 14 + b, 0x0a0614); P.put(4, 16 + b, 0x2a1a3a);
            } else if (Pt.id === 'puddlewyrm') {
                const w = [-4, -1, 3, 0][f];
                P.poly([[14, 14], [8, 6 + w], [11, 15]], 0x9ad8ff); P.poly([[18, 14], [24, 6 + w], [21, 15]], 0x9ad8ff);
                P.ell(16, 19 + b, 5, 6, (x, y) => (y > 21 ? 0xd8f0ff : (x + y) % 3 ? 0x6ab8ff : 0x3a88d8));
                P.line(20, 23 + b, 26, 26, 0x6ab8ff); P.put(27, 25, 0x9ad8ff);
                P.disc(15, 12 + b, 3.5, 0x6ab8ff); P.ell(12, 13 + b, 2, 1.4, 0x9ad8ff); P.put(14, 11 + b, 0x0a0614); P.put(17, 11 + b, 0x0a0614);
                P.put(14, 8 + b, 0xd8f0ff); P.put(17, 8 + b, 0xd8f0ff);
                if (f === 2) P.disc(10, 30, 1, 0x9ad8ff);
            } else {
                const blink = f === 3;
                P.ell(16, 18 + b, 7, 9, (x, y) => ((x * 7 + y * 3) % 11 === 0 ? 0xffffff : y > 22 ? 0x3a2a7a : 0x2a1a5a));
                P.poly([[10, 11 + b], [11, 6 + b], [13, 10 + b]], 0x2a1a5a); P.poly([[22, 11 + b], [21, 6 + b], [19, 10 + b]], 0x2a1a5a);
                for (const ex of [13, 19]) { P.disc(ex, 14 + b, 2.4, 0x140a30); if (!blink) { P.disc(ex, 14 + b, 1.2, 0xfff0a0); P.put(ex, 14 + b, 0xffffff, 1); } else P.line(ex - 2, 14 + b, ex + 2, 14 + b, 0xfff0a0); }
                P.poly([[15, 16 + b], [17, 16 + b], [16, 18 + b]], 0xe8b84a);
                P.ell(9, 19 + b, 2, 5, 0x1a0e40); P.ell(23, 19 + b, 2, 5, 0x1a0e40);
                P.line(14, 27, 14, 29, 0xe8b84a); P.line(18, 27, 18, 29, 0xe8b84a);
            }
        }, 6);
    }
    // the pet you have out: hovering after you, now and then flying to a growing bed to tend it
    _petSetup() {
        this._petSpr?.destroy(); this._petGlow?.destroy();
        const Pt = Garden.pet(); if (!Pt) return;
        const T = this.T, ik = this._petTex(Pt);
        this._petSpr = this.add.sprite(this.fx - T, this.fy - T, ik, '0').setOrigin(0.5, 0.9).setScale(T / 32 * 0.9).play(ik);
        this._petGlow = this.add.image(0, 0, 'mn_glow').setTint(Pt.col).setBlendMode(Phaser.BlendModes.ADD).setDisplaySize(T * 1.4, T * 1.4).setAlpha(0.35);
        const P = { x: this.fx - T, y: this.fy, task: null, next: this.time.now + 8000 };
        this._ticks.push(this._petTick = t => {
            const sp = this._petSpr; if (!sp?.active) return;
            let tx = this.fx + (this.player.flipX ? T * 0.9 : -T * 0.9), ty = this.fy - T * 0.2;
            if (!P.task && t > P.next && !this._fish && !this._rest) {
                const s = Garden.state(), k = GardenScene.BEDS.findIndex((_, i) => { const p = s.plots[i]; return p && Garden.bed(p, Date.now(), s).growing > 0; });
                P.next = t + 15000 + Math.random() * 15000;
                if (k >= 0) { const [bx, by] = GardenScene.BEDS[k]; P.task = { x: this._px(bx + 1 + Math.random() * 2), y: this._py(by + 1), until: t + 3500, k }; }
            }
            if (P.task) {
                tx = P.task.x; ty = P.task.y;
                if (Math.hypot(P.x - tx, P.y - ty) < 6 && !P.task.done) {
                    P.task.done = true;
                    const sp2 = this.add.particles(0, 0, 'mn_px2', { x: tx, y: ty - T * 0.3, lifespan: 900, speed: { min: 20, max: 60 }, scale: { start: 1.6, end: 0 }, tint: [Pt.col, 0xffffff], blendMode: 'ADD', emitting: false }).setDepth(ty + 2);
                    sp2.explode(20); this.time.delayedCall(1000, () => sp2.destroy());
                }
                if (t > P.task.until) P.task = null;
            }
            P.x += (tx - P.x) * 0.06; P.y += (ty - P.y) * 0.06;
            const hov = Math.sin(t * 0.004) * T * 0.12;
            sp.setPosition(P.x, P.y - T * 0.5 + hov).setFlipX(tx > P.x + 2).setDepth(P.y + 0.5);
            this._petGlow.setPosition(P.x, P.y - T * 0.8 + hov).setDepth(P.y + 0.4);
        });
    }

    // ── DAY AND NIGHT ─────────────────────────────────────────────────────────
    // The garden's own day (Garden.DAY_MS): a deep blue wash over everything at night with stars out, warm
    // light at dusk and dawn, and a little clock under the purse saying which it is and how long it lasts.
    _sky() {
        const W = this.scale.width, H = this.scale.height, D = 4840;
        const wash = this.add.rectangle(0, 0, W, H, 0x0a1040, 0).setOrigin(0).setScrollFactor(0).setDepth(D);
        const warm = this.add.rectangle(0, 0, W, H, 0xff9a50, 0).setOrigin(0).setScrollFactor(0).setDepth(D + 1).setBlendMode(Phaser.BlendModes.ADD);
        const stars = this.add.particles(0, 0, 'mn_px2', { x: { min: 0, max: W }, y: { min: 0, max: H }, lifespan: 2600, speed: 0, scale: { start: 1.3, end: 0 }, alpha: { start: 0, end: 1 }, tint: [0xffffff, 0xd8e0ff, 0xfff0a0], blendMode: 'ADD', frequency: 60, emitting: false }).setScrollFactor(0).setDepth(D + 2);
        const clock = this.add.text(W - 20, 58, '', { fontSize: '13px', fontFamily: 'monospace', fontStyle: 'bold', color: '#fff0c0', backgroundColor: '#0a0618cc', padding: { x: 8, y: 4 } }).setOrigin(1, 0).setScrollFactor(0).setDepth(7000);
        let last = 0, was = null;
        this._ticks.push(t => {
            if (t - last < 250) return; last = t;
            const now = Date.now(), p = Garden.phase(now), [n0, n1] = Garden.NIGHT, night = Garden.isNight(now);
            const ramp = (a, b, x) => Math.max(0, Math.min(1, (x - a) / (b - a)));
            const dark = p < n0 ? ramp(n0 - 0.05, n0, p) : p < n1 ? 1 - ramp(n1 - 0.02, n1, p) : 0;
            const glow = p >= n0 - 0.07 && p < n0 + 0.02 ? Math.sin(ramp(n0 - 0.07, n0 + 0.02, p) * Math.PI) : p >= n1 - 0.02 && p < n1 + 0.05 ? Math.sin(ramp(n1 - 0.02, n1 + 0.05, p) * Math.PI) : 0;
            wash.fillAlpha = dark * 0.5; warm.fillAlpha = glow * 0.14;
            stars.emitting = dark > 0.5;
            const next = night ? n1 : p < n0 ? n0 : 1 + n0, mins = Math.ceil((next - p) * Garden.DAY_MS / 60000);
            clock.setText(`${night ? '☾ NIGHT' : '☀ DAY'}  ·  ${night ? 'dawn' : 'nightfall'} in ${mins}m`).setColor(night ? '#c8d8ff' : '#fff0c0');
            clock.setVisible(!this._logOpen);   // (put away with the HUD while the diary's open)
            if (was !== null && was !== night) { this._float(this.fx, this.fy - this.T * 1.6, night ? 'night falls: the night fish are out' : 'the sun is up', night ? '#c8d8ff' : '#fff0c0'); this._drawCrops(); }
            was = night;
        });
    }

    // ── THE MOONWELL ──────────────────────────────────────────────────────────
    // Until your best Tower floor reaches Garden.WELL_FLOOR, you gaze in and it gazes back, and that's
    // all. After that, you stare into it... and jump: the slime hops onto the rim and drops in, the
    // water closes over it, and you come down in the Underwell.
    _well() {
        const T = this.T, best = typeof TowerFloors !== 'undefined' ? TowerFloors.best() : 0;
        if (best < Garden.WELL_FLOOR) {
            Sfx.play(this, 'e_tick', { p: 0.3 });
            this._float(this.fx, this.fy - T * 1.4, 'You gaze into the moonwell.', '#d8e0ff');
            this.time.delayedCall(1100, () => this._float(this.fx, this.fy - T * 1.4, 'It stares back at you.', '#b8a8e8'));
            this.time.delayedCall(2300, () => this._float(this.fx, this.fy - T * 1.4, 'Nothing happens.', '#7a7090'));
            return;
        }
        this._leaving = true; this.prompt.setVisible(false);
        Sfx.play(this, 'e_riser', { r: 2 });
        this._float(this.fx, this.fy - T * 1.4, 'You stare into the moonwell...', '#d8e0ff');
        const [wx, wy, ww] = GardenScene.WELL, cx = this._px(wx + ww / 2), cy = this._py(wy + 1);
        this.time.delayedCall(1300, () => {
            this._float(this.fx, this.fy - T * 1.4, 'You jump in.', '#ffffff');
            Sfx.play(this, 'whoosh'); this.player.setFlipX(cx < this.fx);
            const hop = { u: 0 }, x0 = this.fx, y0 = this.fy;
            this._hopZ = this._py(wy + GardenScene.WELL[3]) + 10;
            this.tweens.add({ targets: hop, u: 1, duration: 650, ease: 'Sine.easeInOut', onUpdate: () => {   // up onto the rim and over
                this.fx = x0 + (cx - x0) * hop.u; this.fy = y0 + (cy - y0) * hop.u; this._hop = Math.sin(hop.u * Math.PI) * T * 1.6;
            }, onComplete: () => {
                this._hop = 0;
                this.tweens.add({ targets: [this.player, this.player._cfx?.eyes, this.player._cfx?.hat].filter(Boolean), scaleX: 0.2, scaleY: 0.2, alpha: 0, y: '+=' + T * 0.4, duration: 260, ease: 'Quad.easeIn' });
                this.shadow.setVisible(false); this._hideGear = true;
                this._ripple(cx, cy); this._ripple(cx, cy);
                const sp = this.add.particles(0, 0, 'mn_px2', { x: cx, y: cy, lifespan: 700, speed: { min: 40, max: 140 }, angle: { min: 200, max: 340 }, gravityY: 260, scale: { start: 2, end: 0 }, tint: [0xffffff, 0xb8c8ff, 0xd8a8ff], blendMode: 'ADD', emitting: false }).setDepth(6000);
                sp.explode(40); Sfx.play(this, 'e_dip', { big: true });
                this.cameras.main.fadeOut(900, 20, 6, 40);
                this.time.delayedCall(950, () => this.scene.start('Underwell'));
            } });
        });
    }

    // ── THE TRAMPOLINE ────────────────────────────────────────────────────────
    // A few bounces, higher each time. From Tower floor SKY_FLOOR the last one doesn't come down: up through
    // the clouds to the Cloud Sea. Before that it's just a trampoline.
    _bounce() {
        const T = this.T, [tx, ty] = GardenScene.TRAMPOLINE, cx = this._px(tx + 1), cy = this._py(ty + 1) - T * 0.35;
        const best = typeof TowerFloors !== 'undefined' ? TowerFloors.best() : 0, up = best >= Garden.SKY_FLOOR;
        this._leaving = true; this.prompt.setVisible(false);
        this.fx = cx; this.fy = cy; this._hopZ = this._tramp.depth + 1;   // on it, so drawn over it
        const hops = [1.2, 2, 3.2], at = { h: 0 };
        const one = (i) => {
            if (i >= hops.length) {
                if (!up) { this._leaving = false; this._hopZ = null; this._float(cx, cy - T * 1.4, `it could go higher (Tower floor ${Garden.SKY_FLOOR})`, '#d8e8ff'); return; }
                Sfx.play(this, 'whoosh'); Sfx.play(this, 'e_riser', { r: 2 });
                this.tweens.add({ targets: at, h: T * 14, duration: 900, ease: 'Quad.easeIn', onUpdate: () => { this._hop = at.h; } });
                this.cameras.main.fadeOut(900, 235, 245, 255);
                this.time.delayedCall(920, () => this.scene.start('Sky'));
                return;
            }
            Sfx.play(this, 'e_land', { r: 1 + i });
            this.tweens.add({ targets: this._tramp, scaleY: this._tramp.scaleX * 0.8, duration: 70, yoyo: true });
            this.tweens.add({ targets: at, h: T * hops[i], duration: 260 + i * 60, ease: 'Quad.easeOut', yoyo: true, onUpdate: () => { this._hop = at.h; }, onComplete: () => one(i + 1) });
        };
        one(0);
    }
    // a round trampoline: four legs, a blue padded rim, a black mat with a shine on it
    _trampTex() {
        return MenuArt.tex(this, 'gd4_tramp', 32, 18, P => {
            for (const x of [5, 12, 20, 27]) P.line(x, 9, x + (x < 16 ? -1 : 1), 17, 0x3a3a48);
            P.ellipse(16, 8, 15, 5.5, 0x2a6ab8); P.ellipse(16, 7.5, 14, 4.8, 0x5aa8f0);
            P.ellipse(16, 8, 11.5, 3.6, 0x14141c); P.ellipse(13, 7, 6, 1.4, 0x3a3a50);
            for (let a = 0; a < 12; a++) { const x = 16 + Math.cos(a / 12 * Math.PI * 2) * 13, y = 8 + Math.sin(a / 12 * Math.PI * 2) * 4.6; P.put(x, y, 0xd8ecff); }
        });
    }

    // ── RESTING (the Grove's bench) ───────────────────────────────────────────
    // The slime settles on the bench, the camera eases in, and the Grove carries on round you: stars
    // drifting up, the odd firefly. E (or Esc) to get up.
    _sit() {
        const [bx, by] = GardenScene.BENCH, T = this.T;
        this._rest = { fx: this.fx, fy: this.fy };
        this.fx = this._px(bx + 1); this.fy = this._py(by) + T * 0.55;
        this.player.setScale(T / 16 * 1.08, T / 16 * 0.86);
        this.cameras.main.zoomTo(1.25, 1200, 'Sine.easeInOut');
        const zz = this.add.particles(0, 0, 'mn_px2', { x: { min: this.fx - T * 4, max: this.fx + T * 4 }, y: { min: this.fy - T * 3, max: this.fy + T }, lifespan: 4000, speedY: { min: -12, max: -4 },
            scale: { start: 1.6, end: 0 }, tint: [0xffffff, 0xd8a8ff, 0x8affd8], blendMode: 'ADD', frequency: 120 }).setDepth(5200);
        const hint = this.add.text(this.scale.width / 2, this.scale.height - 60, 'resting...  (E to get up)', { fontSize: '13px', fontFamily: 'monospace', color: '#e0d8ff', stroke: '#0a0618', strokeThickness: 4 }).setOrigin(0.5).setScrollFactor(0).setDepth(7100);
        this._rest.objs = [zz, hint];
        this.prompt.setVisible(false);
    }
    // Sleeping: the slime curls up flat on the bench, eyes shut, z's drifting up; night falls (the sky darkens,
    // stars and fireflies come out, a lullaby); the crops grow while it's dark, a sparkle on each bed; then dawn
    // comes up warm, it stretches, and you see what grew (and now and then a dream gift).
    _sleep() {
        if (this._busy || this._sleeping) return;
        this._sit(); this._sleeping = true; this._busy = true;
        this._rest.objs.forEach(o => o.setVisible(false));
        const T = this.T, W = this.scale.width, H = this.scale.height, D = 4950, objs = [], fix = o => { objs.push(o); return o.setScrollFactor(0); }, u = this.player._cfx;
        this.tweens.add({ targets: this.player, scaleY: T / 16 * 0.62, scaleX: T / 16 * 1.18, duration: 700, ease: 'Sine.easeInOut' });
        u?.eyes?.setVisible(false);
        const lids = this.add.graphics().setDepth(this.fy + 0.01); objs.push(lids);
        this._ticks.push(this._lidTick = () => { lids.clear(); if (!this._sleeping) return; lids.fillStyle(0x0a0614, 1); const x = this.player.x, y = this.player.y + T * 0.1; lids.fillRect(x - T * 0.22, y, T * 0.14, 2); lids.fillRect(x + T * 0.06, y, T * 0.14, 2); });
        const zz = this.time.addEvent({ delay: 650, loop: true, callback: () => {
            const z = this.add.text(this.player.x + T * 0.3, this.player.y - T * 0.2, 'z', { fontSize: `${Math.round(T * (0.3 + Math.random() * 0.2))}px`, fontFamily: UIKit.FONT.title, fontStyle: 'bold', color: '#d8e0ff', stroke: '#0a0618', strokeThickness: 3 }).setDepth(6000);
            this.tweens.add({ targets: z, x: z.x + T * 0.6, y: z.y - T * 1.4, alpha: 0, angle: 15, duration: 1800, onComplete: () => z.destroy() });
        } });
        Music.play(this, 'lullaby');
        // night
        const night = fix(this.add.rectangle(0, 0, W, H, 0x0a0a30, 0).setOrigin(0).setDepth(D));
        this.tweens.add({ targets: night, fillAlpha: 0.6, duration: 1400, ease: 'Sine.easeInOut' });
        const stars = fix(this.add.particles(0, 0, 'mn_px2', { x: { min: 0, max: W }, y: { min: 0, max: H * 0.7 }, lifespan: 2400, speed: 0, scale: { start: 0, end: 0, ease: 'Sine.easeInOut' }, alpha: { start: 0, end: 1, ease: 'Sine.easeInOut' }, tint: [0xffffff, 0xd8e0ff, 0xfff0a0], blendMode: 'ADD', frequency: 40 }).setDepth(D + 1));
        stars.setParticleScale?.(1.6);
        const flies = this.add.particles(0, 0, 'mn_px2', { x: { min: this.fx - T * 8, max: this.fx + T * 8 }, y: { min: this.fy - T * 5, max: this.fy + T * 3 }, lifespan: 3000, speedX: { min: -12, max: 12 }, speedY: { min: -10, max: 6 }, scale: { start: 1.8, end: 0 }, tint: [0xd8ffa0, 0xffe08a], blendMode: 'ADD', frequency: 90 }).setDepth(D + 2); objs.push(flies);
        // the crops grow in the dark
        this.time.delayedCall(2200, () => {
            const r = Garden.sleep(), s = Garden.state();
            this._drawCrops();
            GardenScene.BEDS.forEach(([bx, by], k) => {
                const p = s.plots[k]; if (!p?.cells?.some(c => c && Garden.watered(c))) return;
                const sp = this.add.particles(0, 0, 'mn_px2', { x: { min: this._px(bx), max: this._px(bx + 4) }, y: { min: this._py(by), max: this._py(by + 2) }, lifespan: 900, speedY: { min: -60, max: -20 }, scale: { start: 2, end: 0 }, tint: [0xffffff, 0x9aff8a, 0xffe08a], blendMode: 'ADD', emitting: false }).setDepth(D + 3);
                sp.explode(26); objs.push(sp);
            });
            Sfx.play(this, 'e_quality');
            this._sleepResult = r;
        });
        // dawn
        this.time.delayedCall(3800, () => {
            this.tweens.add({ targets: night, fillAlpha: 0, duration: 1600, ease: 'Sine.easeInOut' });
            const dawn = fix(this.add.rectangle(0, 0, W, H, 0xffa860, 0).setOrigin(0).setDepth(D + 0.5).setBlendMode(Phaser.BlendModes.ADD));
            this.tweens.add({ targets: dawn, fillAlpha: 0.22, duration: 900, yoyo: true, ease: 'Sine.easeInOut' });
            stars.stop(); flies.stop(); zz.remove();
            Music.play(this, 'isle');
        });
        this.time.delayedCall(5000, () => {
            this._sleeping = false; u?.eyes?.setVisible(true);
            this.tweens.add({ targets: this.player, scaleY: T / 16 * 1.15, scaleX: T / 16 * 0.9, duration: 260, yoyo: true, ease: 'Quad.easeOut', onComplete: () => this.player.setScale(T / 16) });   // a stretch
            const r = this._sleepResult || {}, s = Garden.state();
            GardenScene.BEDS.forEach(([bx, by], k) => { const p = s.plots[k]; if (p?.cells?.some(c => c && Garden.watered(c))) this._float(this._px(bx + 2), this._py(by), `+${r.h || Garden.SLEEP_H}h growth`, '#9aff8a'); });
            if (!r.beds) this._float(this.fx, this.fy - T * 1.6, 'a good sleep (nothing was growing)', '#d8e0ff');
            if (r.gift) this.time.delayedCall(600, () => this._float(this.fx, this.fy - T * 1.8, r.gift === 'fert' ? 'a dream gift: +1 fertilizer' : r.gift === 'dust' ? `a dream gift: +✧${r.dust}` : `a dream gift: ${r.seed?.dust ? `+✧${r.seed.dust}` : `a ${Garden.seed(r.seed?.id)?.name} seed`}`, '#ffe08a'));
            this.time.delayedCall(1800, () => { objs.forEach(o => o.destroy?.()); this._ticks = this._ticks.filter(f => f !== this._lidTick); this._busy = false; this._getUp(); this._hud(); });
        });
    }
    _getUp() {
        const R = this._rest; if (!R) return;
        this._rest = null;
        R.objs.forEach(o => o.destroy());
        this.fx = R.fx; this.fy = R.fy;
        this.cameras.main.zoomTo(1, 600, 'Sine.easeInOut');
    }

    // ── THE SECRET SEED (Starfall Grove) ──────────────────────────────────────
    // A faint glimmer at the foot of a crystal tree across the Grove's bridge. Click it: it rises,
    // turns, flares, SECRET SEED FOUND, and flies into the Garden Log. Once.
    _egg() {
        if (Garden.foundEgg()) return;
        const [ex, ey] = GardenScene.EGG, x = this._px(ex), y = this._py(ey), T = this.T;
        const g = this.add.image(x, y - 4, 'mn_glow').setTint(0xfff0a0).setBlendMode(Phaser.BlendModes.ADD).setDisplaySize(T * 0.9, T * 0.9).setAlpha(0.5).setDepth(y + 1);
        this.tweens.add({ targets: g, alpha: 0.15, duration: 700, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
        const seed = this.add.image(x, y, MenuArt.tex(this, 'gd3_stardrop', 7, 7, P => { P.put(3, 0, 0xffffff); P.put(3, 6, 0xffffff); P.put(0, 3, 0xffffff); P.put(6, 3, 0xffffff); for (let j = 1; j < 6; j++) for (let i = 1; i < 6; i++) if (Math.abs(i - 3) + Math.abs(j - 3) <= 2) P.put(i, j, Math.abs(i - 3) + Math.abs(j - 3) <= 1 ? 0xffffff : 0xfff0a0); })).setScale(T / 16).setDepth(y + 2).setInteractive({ useHandCursor: true });
        this.tweens.add({ targets: seed, angle: 45, duration: 1600, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
        seed.on('pointerdown', () => {
            if (!Garden.findEgg()) return;
            seed.disableInteractive(); g.destroy();
            const cam = this.cameras.main;
            Sfx.play(this, 'e_riser', { r: 4 });
            this.tweens.killTweensOf(seed);
            this.tweens.add({ targets: seed, y: y - T * 2.2, scale: T / 16 * 3, angle: 720, duration: 1200, ease: 'Cubic.easeOut', onComplete: () => {
                Sfx.play(this, 'e_land', { r: 4 }); cam.flash(300, 255, 240, 170); cam.shake(240, 0.006);
                this.add.particles(0, 0, 'mn_px2', { x: seed.x, y: seed.y, lifespan: 1100, speed: { min: 80, max: 260 }, gravityY: 80, scale: { start: 2.4, end: 0 }, tint: [0xfff0a0, 0xffffff, 0xd8a8ff], blendMode: 'ADD', emitting: false }).setDepth(6000).explode(80);
                const ban = this.add.text(this.scale.width / 2, this.scale.height * 0.32, 'SECRET SEED FOUND', { fontSize: '34px', fontFamily: UIKit.FONT.title, fontStyle: 'bold', color: '#fff0a0', stroke: '#0a0618', strokeThickness: 7 }).setOrigin(0.5).setScrollFactor(0).setDepth(7200).setScale(0.4);
                const sub = this.add.text(this.scale.width / 2, this.scale.height * 0.32 + 40, 'Stardrop: added to your Garden Log', { fontSize: '15px', fontFamily: 'monospace', fontStyle: 'bold', color: '#ffffff', stroke: '#0a0618', strokeThickness: 4 }).setOrigin(0.5).setScrollFactor(0).setDepth(7200).setAlpha(0);
                this.tweens.add({ targets: ban, scale: 1, duration: 420, ease: 'Back.easeOut' }); this.tweens.add({ targets: sub, alpha: 1, delay: 300, duration: 300 });
                this.time.delayedCall(1300, () => {   // it flies to the Garden Log button
                    const fly = this.add.image(seed.x - cam.scrollX, seed.y - cam.scrollY, seed.texture.key).setScale(seed.scale).setScrollFactor(0).setDepth(7300);
                    seed.destroy();
                    this.tweens.add({ targets: fly, x: 250, y: 34, scale: T / 16, angle: 360, duration: 800, ease: 'Cubic.easeIn', onComplete: () => { fly.destroy(); Sfx.play(this, 'pickup'); this._hud(); } });
                    this.tweens.add({ targets: [ban, sub], alpha: 0, delay: 800, duration: 500, onComplete: () => { ban.destroy(); sub.destroy(); } });
                });
            } });
        });
    }

    // a bed spot's place in the world (on its mound, _paintGround)
    _cellXY(k, i, c = Garden.state().plots[k]?.cells?.[i]) {   // where plant i stands: Garden.sow keeps x 0.06-0.94, y 0.14-0.9, stretched here over the whole field; a plain grid for an empty one
        const [bx, by] = GardenScene.BEDS[k], T = this.T;
        return c ? [this._px(bx) + (0.07 + (c.x - 0.06) / 0.88 * 0.86) * 4 * T, this._py(by) + (0.14 + (c.y - 0.14) / 0.76 * 0.8) * 2 * T] : [this._px(bx) + ((i % 6) + 0.5) / 6 * 4 * T, this._py(by) + (Math.floor(i / 6) % 4 + 0.8) / 4 * 2 * T];
    }
    // every ripe spot pops out of its mound in turn, a note higher each, and streams to the purse; then the seeds go back in
    _harvest(k, only = null) {
        const cs = Garden.state().plots[k]?.cells || [], was = cs.map(c => c && Garden.seed(c.seed)), pos = cs.map((c, i) => c && this._cellXY(k, i, c));
        const r = Garden.harvest(k, Date.now(), only);
        if (!r) return;
        const T = this.T, k16 = T / 16, [bx, by] = GardenScene.BEDS[k], x = this._px(bx + 2), y = this._py(by + 1), gap = only ? 0 : 40;
        this._busy = !only;
        if (!only) r.ripe.forEach((i, j) => this.time.delayedCall(j * gap, () => {
            const S = was[i], [cx, cy] = pos[i], ik = this._cropTex(S, 4, true);
            const sp = this.add.sprite(cx, cy, ik, '0').setOrigin(0.5, 0.94).setScale(k16 * 0.56).setDepth(6050).play(ik);
            this._puff(cx, cy, 0x6a4a30, 6);
            this.tweens.add({ targets: sp, y: cy - T * 1.1, scale: k16 * 0.8, angle: (Math.random() - 0.5) * 50, duration: 260, ease: 'Back.easeOut', onComplete: () => {
                this._toPurse(sp.x, sp.y, 2, S.col);
                this.tweens.add({ targets: sp, scale: 0, alpha: 0, duration: 180, onComplete: () => sp.destroy() });
            } });
            if (j % 3 === 0) Sfx.play(this, 'pluck', { i: (j / 3) % 8 });
        }));
        const end = r.ripe.length * gap + 200;
        this.time.delayedCall(end, () => {
            this._busy = false;
            Sfx.play(this, 'e_quality');
            this._float(x, y - T, `+✧${r.dust}`, '#d8fff0');
            this.cameras.main.shake(90, 0.0025);
            r.blessed.forEach((S, j) => { this.time.delayedCall(350 + j * 450, () => { this._float(x, y - T * (1.7 + j * 0.6), `BLESSING BANKED: ${S.bless.toUpperCase()}`, UIKit._hex(S.col)); Sfx.play(this, 'e_bind'); }); });
            if (r.full.length) this.time.delayedCall(350 + r.blessed.length * 450, () => this._float(x, y - T * (1.7 + r.blessed.length * 0.6), 'no room for another blessing', '#b8b0c8'));
            this._drawCrops(); this._hud();
        });
    }
    // held a seed and pressed E: every empty spot sown and watered at once
    // ── THE SICKLE ────────────────────────────────────────────────────────────
    // Press on a ripe field in reach and drag: every ripe plant the blade crosses pops out and streams to the purse,
    // a note higher each. Let go and they're paid (Garden.harvest with just those) and sown again where they grew.
    // a pointer's place in the world, through the main camera (p.worldX can be the HUD camera's)
    _wp(p) { const w = this.cameras.main.getWorldPoint(p.x, p.y); return { button: p.button, worldX: w.x, worldY: w.y, x: p.x, y: p.y, _p: p }; }
    _scytheStart(p) {
        p = this._wp(p);
        if (this._sprk || this._build || this._panelObjs || this._fish || this._busy || this._leaving || this._rest || p.button !== 0 || this.input.hitTestPointer(p._p).length) return;
        const T = this.T, s = Garden.state(), now = Date.now(), ripe = {};
        let on = false;
        GardenScene.BEDS.forEach(([bx, by], k) => {
            const p2 = s.plots[k]; if (!p2) return;
            const x0 = this._px(bx), y0 = this._py(by), near = Math.hypot(Math.max(x0 - this.fx, 0, this.fx - x0 - 4 * T), Math.max(y0 - this.fy, 0, this.fy - y0 - 2 * T)) < T * 3;
            const list = p2.cells.map((c, i) => c && Garden.watered(c) && Garden.growth(c, now, s).f >= 1 ? [i, ...this._cellXY(k, i, c), Garden.seed(c.seed)] : null).filter(Boolean);
            if (!list.length) return;
            ripe[k] = list;   // every ripe field: a drag that starts on one in reach sweeps on through the others it crosses
            if (near && p.worldX > x0 - T * 0.5 && p.worldX < x0 + 4.5 * T && p.worldY > y0 - T * 0.5 && p.worldY < y0 + 2.5 * T) on = true;
        });
        if (!on) return;
        const blade = this.add.image(p.worldX, p.worldY, this._sickleTex()).setScale(T / 16 * 1.4).setDepth(6200).setOrigin(0.2, 0.8);
        this._scythe = { ripe, cut: {}, last: [p.worldX, p.worldY], trail: this.add.graphics().setDepth(6190).setBlendMode(Phaser.BlendModes.ADD), pts: [], blade, n: 0 };
        Sfx.play(this, 'whoosh');
        this._scytheMove(p);
    }
    _scytheMove(p) {
        const Z = this._scythe; if (!Z) return;
        p = this._wp(p);
        const T = this.T, [ax, ay] = Z.last, bx = p.worldX, by = p.worldY, R = T * 0.55;
        Z.blade.setPosition(bx, by).setRotation(Math.atan2(by - ay, bx - ax) || Z.blade.rotation);
        Z.pts.push([bx, by, this.time.now]); Z.pts = Z.pts.filter(q => this.time.now - q[2] < 160);
        Z.trail.clear(); for (let i = 1; i < Z.pts.length; i++) { const u = i / Z.pts.length; Z.trail.lineStyle(T * 0.22 * u, 0xd8f0ff, 0.5 * u); Z.trail.lineBetween(Z.pts[i - 1][0], Z.pts[i - 1][1], Z.pts[i][0], Z.pts[i][1]); }
        const dx = bx - ax, dy = by - ay, L2 = dx * dx + dy * dy || 1;
        for (const k in Z.ripe) for (const [i, x, y, S] of Z.ripe[k]) {
            if (Z.cut[k]?.has(i)) continue;
            const t = Math.max(0, Math.min(1, ((x - ax) * dx + (y - T * 0.3 - ay) * dy) / L2));
            if (Math.hypot(ax + dx * t - x, ay + dy * t - (y - T * 0.3)) > R) continue;
            (Z.cut[k] ||= new Set()).add(i);
            this._cropSpr?.[k]?.[i]?.setVisible(false);
            const ik = this._cropTex(S, 4, true), sp = this.add.sprite(x, y, ik, '0').setOrigin(0.5, 0.94).setScale(T / 16 * 0.56).setDepth(6050).play(ik);
            this._puff(x, y - T * 0.2, 0x6aba58, 4);
            this.tweens.add({ targets: sp, y: y - T * 0.9, angle: (Math.random() - 0.5) * 80, duration: 220, ease: 'Back.easeOut', onComplete: () => { this._toPurse(sp.x, sp.y, 2, S.col); this.tweens.add({ targets: sp, scale: 0, alpha: 0, duration: 160, onComplete: () => sp.destroy() }); } });
            if (Z.n++ % 2 === 0) Sfx.play(this, 'pluck', { i: Math.min(7, Math.floor(Z.n / 3)) });
            if (Z.n % 6 === 0) this.cameras.main.shake(60, 0.0018);
        }
        Z.last = [bx, by];
    }
    _scytheEnd() {
        const Z = this._scythe; if (!Z) return;
        this._scythe = null;
        this.tweens.add({ targets: [Z.blade, Z.trail], alpha: 0, duration: 180, onComplete: () => { Z.blade.destroy(); Z.trail.destroy(); } });
        const ks = Object.keys(Z.cut);
        if (!ks.length) return;
        this.time.delayedCall(300, () => ks.forEach(k => this._harvest(+k, Z.cut[k])));
    }
    // a curved sickle: a pale crescent of blade on a short wooden grip
    _sickleTex() {
        return MenuArt.tex(this, 'gd4_sickle', 16, 16, P => {
            P.line(2, 14, 6, 9, 0x6a4a2a); P.line(3, 14, 7, 9, 0x8a6a3a);
            for (let a = -3.4; a < -0.2; a += 0.05) { const x = 9 + Math.cos(a) * 6, y = 8 + Math.sin(a) * 6; P.put(x, y, 0xe8f0ff); P.put(x + Math.cos(a) * -1, y + Math.sin(a) * -1, 0x9aa8c0); }
        });
    }

    // a handful sprinkled over the field: one seed (held in your hand) or a mix ({ id: weight }, the picker's)
    _sow(k, mix) {
        if (typeof mix === 'string') mix = { [mix]: 1 };
        const spots = Garden.sow(k, mix);
        if (!spots.length) { Sfx.play(this, 'deny'); return; }
        this._sowFx(k, spots);
        const [bx, by] = GardenScene.BEDS[k], ids = Object.keys(mix).filter(id => mix[id] > 0);
        this._float(this._px(bx + 2), this._py(by), ids.length > 1 ? `a mix of ${ids.length} sprinkled and watered` : `${Garden.seed(ids[0]).name} sprinkled and watered`, '#d8ffe8');
        this.time.delayedCall(spots.length * 22 + 300, () => { this._drawCrops(); this._hud(); });
    }
    // seeds dropping into their mounds, a puff of soil and a splash each
    _sowFx(k, spots, from = null) {   // each seed arcs out of the slime's hand (or the basket) and lands where it grows
        const T = this.T, cells = Garden.state().plots[k].cells, [x0, y0] = from || [this.fx, this.fy - T * 0.6];
        spots.forEach((i, j) => this.time.delayedCall(j * 22, () => {
            const c = cells[i]; if (!c) return;
            const [cx, cy] = this._cellXY(k, i, c), col = Garden.seed(c.seed).col, sd = this.add.circle(x0, y0, T * (from ? 0.1 : 0.05), MenuArt.mix(col, 0xffffff, 0.3)).setStrokeStyle(from ? 2 : 0, 0x2a1a0e).setDepth(6050), u = { t: 0 };
            this.tweens.add({ targets: u, t: 1, duration: 300 + Math.random() * 120, ease: 'Sine.easeOut', onUpdate: () => { sd.setPosition(x0 + (cx - x0) * u.t, y0 + (cy - y0) * u.t - Math.sin(u.t * Math.PI) * T * 1.2); },
                onComplete: () => { sd.destroy(); this._puff(cx, cy, 0x6a4a30, 3); this._puff(cx, cy - 2, 0x8ac8ff, 2); } });
            if (j % 3 === 0) Sfx.play(this, 'pluck', { i: (j / 3) % 8, soft: true });
        }));
    }
    _puff(x, y, col, n) {
        for (let q = 0; q < n; q++) {
            const a = -Math.PI * (0.15 + Math.random() * 0.7), d = this.T * (0.2 + Math.random() * 0.3);
            const c = this.add.circle(x, y, this.T * (0.03 + Math.random() * 0.03), col).setDepth(6040);
            this.tweens.add({ targets: c, x: x + Math.cos(a) * d, y: y + Math.sin(a) * d, alpha: 0, duration: 300 + Math.random() * 150, ease: 'Quad.easeOut', onComplete: () => c.destroy() });
        }
    }
    // motes lifting off (in the world) and streaming to the purse (on the screen)
    _toPurse(x, y, n, col) {
        const cam = this.cameras.main;
        for (let i = 0; i < n; i++) {
            const m = this.add.image(x - cam.scrollX + (Math.random() - 0.5) * this.T * 3, y - cam.scrollY, 'mn_px2').setTint(i % 2 ? col : 0xffffff).setBlendMode(Phaser.BlendModes.ADD).setScale(3).setDepth(7050).setScrollFactor(0);
            this.tweens.add({ targets: m, y: m.y - 40 - Math.random() * 40, duration: 320, ease: 'Quad.easeOut', onComplete: () =>
                this.tweens.add({ targets: m, x: this._purse.x - 40, y: this._purse.y + 10, scale: 1, delay: i * 20, duration: 520, ease: 'Cubic.easeIn', onComplete: () => m.destroy() }) });
        }
    }
    _float(x, y, s, col) {
        const t = this.add.text(x, y, s, { fontSize: '16px', fontFamily: UIKit.FONT.title, fontStyle: 'bold', color: col, stroke: '#0a0618', strokeThickness: 4 }).setOrigin(0.5).setDepth(6100);
        this.tweens.add({ targets: t, y: y - 40, alpha: 0, delay: 900, duration: 700, onComplete: () => t.destroy() });
    }

    // ── FISHING ───────────────────────────────────────────────────────────────
    // The rod swings back over the slime's head and whips forward; the bobber arcs off its tip into
    // the water you face. It floats; it dips (press E, quick); then the reel: hold E to lift the catch
    // bar and keep the fish inside it until the line fills. Your rod's luck widens the bar.
    _cast(where = 'river', at = null) {
        const T = this.T;
        let tgt = at;
        if (!tgt) for (const [dx, dy] of [[Math.sign(this.face.x), Math.sign(this.face.y)], [0, 1], [0, -1], [1, 0], [-1, 0]]) {
            if (!dx && !dy) continue;
            for (let r = 2; r >= 1; r--) { const [tx, ty] = this._tile(this.fx + dx * T * r, this.fy + dy * T * r); if (this._river(tx - this.gx0, ty - this.gy0)) { const deep = this._river(tx + dx - this.gx0, ty + dy - this.gy0); tgt = [this._cx(tx) + (deep ? dx * T * 0.6 : 0), this._cy(ty) + (deep ? dy * T * 0.6 : 0)]; break; } }
            if (tgt) { if (dx) this.player.setFlipX(dx < 0); break; }
        }
        if (!tgt) return;   // (it lands out past the bank when there's room)
        const F = this._fish = { state: 'cast', where, x: tgt[0], y: tgt[1] };
        this.prompt.setVisible(false);
        // the swing: back over its head, then forward
        const rod = { a: this._rodA ?? -35 };
        this.tweens.add({ targets: rod, a: -120, duration: 260, ease: 'Quad.easeOut', onUpdate: () => { this._rodA = rod.a; }, onComplete: () => {
            Sfx.play(this, 'whoosh');
            this.tweens.add({ targets: rod, a: 10, duration: 140, ease: 'Quad.easeIn', onUpdate: () => { this._rodA = rod.a; }, onComplete: () => this._launch(F) });
        } });
        this.player.setScale(T / 16 * 1.06, T / 16 * 0.94);
    }
    _launch(F) {
        if (this._fish !== F) return;
        const T = this.T, [tx0, ty0] = this._rodTip();
        F.line = this.add.graphics().setDepth(5600);
        // the bobber, a pixel float: a quill tip, a red cap with a shine, a dark band, a white belly (sunk below the waterline once it lands)
        F.bob = this.add.image(tx0, ty0, MenuArt.tex(this, 'gd3_bobber', 7, 12, P => {
            P.put(3, 0, 0xffffff); P.put(3, 1, 0x3a3048); P.put(3, 2, 0x3a3048);
            for (let y = 3; y < 12; y++) for (let x = 0; x < 7; x++) {
                const r = y < 7 ? [2, 1, 1, 1][y - 3] : [1, 1, 1, 2, 3][y - 7]; if (x < r || x > 6 - r) continue;
                P.put(x, y, y < 7 ? (x <= r ? 0xff9a8a : x >= 5 - r ? 0xa02a24 : 0xe04a3a) : y === 7 ? 0x1a1020 : x >= 5 - r ? 0xb8c0d0 : 0xf4f4f8);
            }
            P.put(2, 4, 0xffffff);
            for (let y = 0; y < P.h; y++) for (let x = 0; x < P.w; x++) if (P.alpha(x, y) > 0.9 && y > 2 && [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => P.alpha(x + dx, y + dy) < 0.5)) P.put(x, y, 0x1a1020);
        })).setOrigin(0.5, 8 / 12).setScale(T / 16).setDepth(5601);
        this.tweens.add({ targets: F.bob, x: F.x, duration: 460, ease: 'Linear' });
        this.tweens.add({ targets: F.bob, y: { from: ty0, to: F.y }, duration: 460, ease: 'Back.easeIn', onComplete: () => {
            if (this._fish !== F) return;
            Sfx.play(this, 'e_dip', { big: false }); this._ripple(F.x, F.y);
            F.bob.setCrop(0, 0, 7, 8);   // floating: the belly under water
            this._rodA = -20;
            F.state = 'wait'; F.biteAt = this.time.now + 1500 + Math.random() * 3500;
            F.bobTw = this.tweens.add({ targets: F.bob, y: F.y - 3, duration: 700, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
        } });
        F.tick = t => {
            if (this._fish !== F) return;
            // the line: one smooth curve from the rod's tip to the bobber's quill, slack while it waits,
            // pulled taut on a bite or the reel, drawn in pixels like everything else
            const [rx, ry] = this._rodTip(), k = T / 16, bx = F.bob.x, by = F.bob.y - 7 * k, d = Math.hypot(bx - rx, by - ry);
            const sag = (F.state === 'wait' ? 0.22 : F.state === 'cast' ? 0.08 : 0.02) * d, cx = (rx + bx) / 2, cy = Math.max(ry, by) + sag, px = Math.max(1, Math.round(k * 0.5));
            F.line.clear(); F.line.fillStyle(0xe8f0ff, 0.9);
            const n = Math.max(8, Math.ceil(d / px));
            for (let i = 0; i <= n; i++) { const u = i / n, v = 1 - u, x = v * v * rx + 2 * v * u * cx + u * u * bx, y = v * v * ry + 2 * v * u * cy + u * u * by; F.line.fillRect(Math.round(x / px) * px, Math.round(y / px) * px, px, px); }
            if (F.state === 'wait' && Math.random() < 0.01) this._ripple(F.x, F.y);
            if (F.state === 'wait' && t >= F.biteAt) {   // a bite: it dips, an ! over you, a short window to strike
                F.state = 'bite'; F.fishDef = Garden.bite(Math.random, F.where); F.until = t + 900 + (Garden.rod().ctl || 0) * 150;
                F.bobTw?.stop(); this.tweens.add({ targets: F.bob, y: F.y + T * 0.2, duration: 120, yoyo: true, repeat: 2 });
                this._ripple(F.x, F.y); Sfx.play(this, 'e_tick', { p: 1 }); this._rodA = -5;
                F.bang = this.add.text(this.fx, this.fy - T * 1.5, '!', { fontSize: `${Math.round(T * 0.7)}px`, fontFamily: UIKit.FONT.title, fontStyle: 'bold', color: '#ffe060', stroke: '#0a0618', strokeThickness: 5 }).setOrigin(0.5).setDepth(6000);
            }
            if (F.state === 'bite' && t > F.until) this._endFish('it got away');
            if (F.state === 'reel') this._reelTick(t);
        };
        this._ticks.push(F.tick);
    }
    _ripple(x, y) {
        const r = this.add.ellipse(x, y, this.T * 0.3, this.T * 0.1).setStrokeStyle(2, 0xd8f0ff, 0.9).setDepth(3);
        this.tweens.add({ targets: r, scaleX: 4, scaleY: 4, alpha: 0, duration: 800, onComplete: () => r.destroy() });
    }
    _fishPress() {
        const F = this._fish;
        if (F.state === 'wait' || F.state === 'cast') return this._endFish('reeled in');
        if (F.state === 'bite') { F.bang?.destroy(); this._reelStart(); }
    }
    // The reel: a tall panel beside you, water in a column. The fish darts about in it (the rarer, the
    // faster and the more often it changes its mind); the catch bar falls unless you hold E. While the
    // fish is inside the bar the line fills, outside it drains; full, it's yours; empty, it's gone.
    _reelStart() {
        const F = this._fish, D = F.fishDef, rod = Garden.rod();
        F.state = 'reel'; F.prog = 0.3; F.fy = 0.5; F.ft = 0.5; F.nextMove = 0; F.bar = 0.25; F.vel = 0; F.last = this.time.now;
        F.ctl = rod.ctl || 0; F.barH = Math.min(0.55, D.zone * 1.25 + F.ctl * 0.04);   // control: a bigger bar
        const W = this.scale.width, H = this.scale.height, ui = F.ui = [], fix = o => { ui.push(o); return o.setScrollFactor(0).setDepth(6200); };
        const px = Math.min(W - 120, this.fx - this.cameras.main.scrollX + this.T * 2.4), py = H / 2 - 150;
        F.px = px; F.py = py;
        F.g = fix(this.add.graphics());
        F.fishSpr = fix(this.add.sprite(px, py, this._fishTex(D), '0').setScale(1.4)).setDepth(6202).play(this._fishTex(D));
        F.label = fix(this.add.text(px + 14, py - 34, 'HOLD E TO REEL', { fontSize: '12px', fontFamily: 'monospace', fontStyle: 'bold', color: '#ffffff', stroke: '#0a0618', strokeThickness: 4 }).setOrigin(0.5)).setDepth(6203);
        F.bubbles = fix(this.add.particles(0, 0, 'mn_px2', { x: { min: px - 18, max: px + 18 }, y: py + 270, lifespan: 2600, speedY: { min: -120, max: -60 }, scale: { start: 1.4, end: 0.4 }, alpha: { start: 0.8, end: 0 }, tint: [0xd8f0ff, 0x9ad8ff], frequency: 140 })).setDepth(6201);
        Sfx.play(this, 'e_flip');
    }
    _reelTick(t) {
        const F = this._fish, D = F.fishDef, dt = Math.min(50, t - F.last) / 1000; F.last = t;
        // the fish: picks a new spot now and then, swims there (the rare ones dart)
        if (t > F.nextMove) { F.ft = Math.random(); F.nextMove = t + (900 - D.speed * 260) * (0.5 + Math.random()); }
        F.fy += (F.ft - F.fy) * Math.min(1, dt * (1.2 + D.speed * 1.4) * (1 - F.ctl * 0.06)) + Math.sin(t * 0.01 * D.speed) * 0.004 * (1 - F.ctl * 0.15);   // control calms it
        F.fy = Math.max(0, Math.min(1, F.fy));
        // the bar: you lift it, it sinks
        const hold = this.keys.E.isDown || this.keys.SPACE.isDown || this.input.activePointer.isDown;
        F.vel += (hold ? 2.6 : -2.2 * (1 - F.ctl * 0.08)) * dt; F.vel *= 0.93 - F.ctl * 0.012;   // control: it sinks slower, overshoots less
        F.bar += F.vel * dt; if (F.bar < 0) { F.bar = 0; F.vel = Math.abs(F.vel) * 0.3; } if (F.bar > 1 - F.barH) { F.bar = 1 - F.barH; F.vel = 0; }
        const fishPos = 1 - F.fy, inside = fishPos >= F.bar && fishPos <= F.bar + F.barH;   // (the bar's 0 is the bottom)
        F.prog += (inside ? 0.32 * (1 + F.ctl * 0.05) : -0.22 * (1 - F.ctl * 0.08)) * dt;
        this._rodA = -20 + Math.sin(t * 0.03) * (inside ? 6 : 2);
        if (inside && Math.floor(t / 90) !== F.tickN) { F.tickN = Math.floor(t / 90); Sfx.play(this, 'e_tick', { p: 0.3 + F.prog * 0.6 }); }
        this._reelDraw(inside);
        if (F.prog >= 1) this._landFish();
        else if (F.prog <= 0) this._endFish('it slipped the hook');
    }
    _reelDraw(inside) {
        const F = this._fish, g = F.g, x = F.px, y = F.py, CH = 260, CW = 46, top = y, bot = y + CH;
        g.clear();
        // the frame: dark wood, brass corners, a crystal at the top
        g.fillStyle(0x000000, 0.4); g.fillRoundedRect(x - CW / 2 - 10, top - 14, CW + 52, CH + 28, 10);
        g.fillStyle(0x3a2414, 1); g.fillRoundedRect(x - CW / 2 - 14, top - 18, CW + 52, CH + 28, 10);
        g.lineStyle(2, 0xd8b84a, 1); g.strokeRoundedRect(x - CW / 2 - 14, top - 18, CW + 52, CH + 28, 10);
        for (const [cx, cy] of [[x - CW / 2 - 8, top - 12], [x + CW / 2 + 32, top - 12], [x - CW / 2 - 8, bot + 4], [x + CW / 2 + 32, bot + 4]]) { g.fillStyle(0xd8b84a, 1); g.fillCircle(cx, cy, 3); }
        // the water column: deeper toward the bottom
        for (let i = 0; i < 13; i++) { g.fillStyle(MenuArt.mix(0x3e7aa8, 0x0c1a3a, i / 12), 1); g.fillRect(x - CW / 2, top + i * CH / 13, CW, CH / 13 + 1); }
        // the catch bar
        const by = bot - (F.bar + F.barH) * CH, bh = F.barH * CH;
        g.fillStyle(inside ? 0x8affd8 : 0x5ab890, inside ? 0.85 : 0.55); g.fillRoundedRect(x - CW / 2 + 3, by, CW - 6, bh, 6);
        g.lineStyle(2, inside ? 0xffffff : 0x8affd8, 1); g.strokeRoundedRect(x - CW / 2 + 3, by, CW - 6, bh, 6);
        // the line's progress, on the right
        g.fillStyle(0x0a0618, 1); g.fillRect(x + CW / 2 + 12, top, 12, CH);
        g.fillStyle(F.prog > 0.66 ? 0x9aff8a : F.prog > 0.33 ? 0xffe08a : 0xff8a6a, 1); g.fillRect(x + CW / 2 + 12, bot - CH * F.prog, 12, CH * F.prog);
        g.lineStyle(1.5, 0xd8b84a, 1); g.strokeRect(x + CW / 2 + 12, top, 12, CH);
        F.fishSpr.setPosition(x + (inside ? Math.sin(this.time.now * 0.05) * 2 : 0), top + F.fy * CH).setFlipX(Math.sin(this.time.now * 0.002) > 0);
        F.label.setText(inside ? 'HOLD IT...' : 'HOLD E TO REEL').setColor(inside ? '#9aff8a' : '#ffffff');
    }
    _landFish() {
        const F = this._fish, r = Garden.catchFish(F.fishDef.id), T = this.T, kept = Garden.keepFish(F.fishDef.id);
        const fish = this.add.sprite(F.x, F.y, this._fishTex(r.fish), '0').setScale(T / 32 * 1.6).setDepth(6050).play(this._fishTex(r.fish));
        this._ripple(F.x, F.y); Sfx.play(this, 'e_dip', { big: true });
        this.tweens.add({ targets: fish, x: this.fx, duration: 600, ease: 'Linear' });
        this.tweens.add({ targets: fish, y: { from: F.y, to: this.fy - T * 1.8 }, duration: 300, ease: 'Quad.easeOut', yoyo: true, onComplete: () => {
            Sfx.play(this, r.fish.w <= 8 ? 'e_quality' : 'pickup');
            if (r.fish.w <= 2) { this.cameras.main.flash(260, 255, 220, 255); Sfx.play(this, 'e_land', { r: 4 }); }
            this._float(this.fx, this.fy - T * 1.6, `${r.fish.name.toUpperCase()}  +✧${r.dust}${r.wary ? ' (the fish are wary)' : ''}`, UIKit._hex(r.fish.col));
            let dy = 2.3;
            const extra = s2 => { const yy = dy; this.time.delayedCall(400 + (yy - 2.3) * 400, () => this._float(this.fx, this.fy - T * yy, s2, '#9aff8a')); dy += 0.7; };
            if (!kept) extra('your bag and chest are full: it swims off');
            if (r.seed) extra(r.seed.dust ? `a spare seed: +✧${r.seed.dust}` : `+1 ${Garden.seed(r.seed.id).name.toUpperCase()} SEED`);
            for (const tr of r.treasure) extra(tr === 'fertilizer' ? 'TREASURE: FERTILIZER' : tr === 'book' ? 'TREASURE: A SEALED BOOK!' : tr.startsWith('pet:') ? `A ${Garden.PETS.find(p => p.id === tr.slice(4)).name.toUpperCase()} FOLLOWS YOU HOME!` : tr.startsWith('sapling:') ? `TREASURE: A ${Garden.tree(tr.slice(8)).name.toUpperCase()} SAPLING (the orchard)` : tr.startsWith('decor:') ? `TREASURE: A ${tr.endsWith('lamp') ? 'LANTERN' : 'CRYSTAL CLUSTER'} (place it in build mode)` : `TREASURE: A HAT (${tr.slice(4).toUpperCase()})`);
            this._toPurse(this.fx, this.fy - T, 10, r.fish.col);
            if (r.treasure.some(t2 => t2.startsWith('pet:'))) { this._petSetup(); this.cameras.main.flash(300, 255, 240, 200); Sfx.play(this, 'e_land', { r: 4 }); }
            this.tweens.add({ targets: fish, alpha: 0, scale: 0.2, duration: 400, onComplete: () => fish.destroy() });
            this._hud();
        } });
        this._endFish(null);
    }
    _endFish(why) {
        const F = this._fish; if (!F) return;
        this._fish = null; this._rodA = -35;
        if (F.tick) this._ticks = this._ticks.filter(f => f !== F.tick);
        F.bobTw?.stop(); F.line?.destroy(); F.bob?.destroy(); F.bang?.destroy(); for (const o of (F.ui || [])) o.destroy();
        if (why) this._float(this.fx, this.fy - this.T * 1.4, why, '#c8d8e8');
    }
    // a rod, 16px on the diagonal (handle at the bottom left), in its own colours
    _rodTex(R) {
        const hex = v => '#' + v.toString(16).padStart(6, '0');
        return ShopScene.icon(this, 'gd3_rod_' + R.id, 16, { a: hex(R.col), b: hex(MenuArt.mix(R.col, 0xffffff, 0.45)), d: hex(MenuArt.mix(R.col, 0x0a0614, 0.5)), t: hex(R.tip), h: '#3a2414', g: '#ffffff', s: '#c8c8d8' }, m => {
            m.line(2, 14, 14, 2, 'a'); m.line(3, 14, 14, 3, 'b'); m.line(1, 15, 4, 12, 'h'); m.rect(4, 11, 2, 2, 's'); m.set(5, 10, 'd');   // the pole, the grip, the reel
            m.set(14, 2, 't'); m.set(15, 1, 't'); if (R.luck >= 2) { m.set(13, 1, 'g'); m.set(15, 3, 'g'); }
        });
    }
    // ── THE PAINTER (fish and crops) ──────────────────────────────────────────
    // A 32px sheet of animation frames, painted with real colours, then outlined dark; its animation
    // has the same key. P: put/get/disc/ell/line/poly, colours as numbers (or a function of x, y).
    _sheet(key, frames, paint, fps = 6, N = 32) {
        if (!this.textures.exists(key)) {
            const t = this.textures.createCanvas(key, N * frames, N), ctx = t.getContext(), img = ctx.createImageData(N * frames, N), d = img.data;
            for (let f = 0; f < frames; f++) {
                const buf = new Int32Array(N * N).fill(-1), glow = new Uint8Array(N * N);
                const col = (c, x, y) => typeof c === 'function' ? c(x, y) : c;
                const P = {
                    N,
                    put(x, y, c, g) { x = Math.round(x); y = Math.round(y); if (x < 0 || y < 0 || x >= N || y >= N || c == null || c < 0) return; buf[y * N + x] = c; glow[y * N + x] = g ? 1 : 0; },
                    get(x, y) { x = Math.round(x); y = Math.round(y); return x >= 0 && y >= 0 && x < N && y < N ? buf[y * N + x] : -1; },
                    ell(cx, cy, rx, ry, c) { for (let y = Math.floor(cy - ry); y <= cy + ry; y++) for (let x = Math.floor(cx - rx); x <= cx + rx; x++) if (((x + 0.5 - cx) / rx) ** 2 + ((y + 0.5 - cy) / ry) ** 2 <= 1) P.put(x, y, col(c, x, y)); },
                    disc(cx, cy, r, c) { P.ell(cx, cy, r, r, c); },
                    line(x0, y0, x1, y1, c) { const n = Math.max(1, Math.ceil(Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0)))); for (let k = 0; k <= n; k++) { const x = x0 + (x1 - x0) * k / n, y = y0 + (y1 - y0) * k / n; P.put(x, y, col(c, x, y)); } },
                    poly(pts, c) {
                        for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
                            let inside = false;
                            for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) { const [xi, yi] = pts[i], [xj, yj] = pts[j]; if ((yi > y + 0.5) !== (yj > y + 0.5) && x + 0.5 < (xj - xi) * (y + 0.5 - yi) / (yj - yi) + xi) inside = !inside; }
                            if (inside) P.put(x, y, col(c, x, y));
                        }
                    },
                    spark(x, y, c = 0xffffff) { P.put(x, y, c, 1); P.put(x - 1, y, c, 1); P.put(x + 1, y, c, 1); P.put(x, y - 1, c, 1); P.put(x, y + 1, c, 1); },
                };
                paint(P, f, frames);
                // the house style's grit: light from the top left (a rim of light there, a shadow inside the bottom
                // right edge), shades dithered rather than smooth, and a little speckle in the colour
                const M = MenuArt.mix, solid = (x, y) => x >= 0 && y >= 0 && x < N && y < N && buf[y * N + x] >= 0 && !glow[y * N + x], out = buf.slice();
                for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
                    const i = y * N + x, c = buf[i]; if (c < 0 || glow[i]) continue;
                    let v = 0;
                    if (!solid(x, y - 1) || !solid(x - 1, y)) v = 0.28;
                    else if (!solid(x, y + 1) || !solid(x + 1, y)) v = -0.32;
                    let o = v >= 0 ? M(c, 0xfff4e0, v) : M(c, 0x140a1e, -v);
                    const q = ch => Math.min(255, Math.round(ch / 36) * 36 + 8);   // flat colour bands, not gradients
                    o = (q((o >> 16) & 255) << 16) | (q((o >> 8) & 255) << 8) | q(o & 255);
                    out[i] = o;
                }
                buf.set(out);
                for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
                    const i = y * N + x, o = ((y * N * frames) + f * N + x) * 4;
                    let c = buf[i], a = 255;
                    if (c < 0) {   // an outline round what's drawn (sparkles and glows go without one)
                        if (![[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => { const j = (y + dy) * N + x + dx; return x + dx >= 0 && x + dx < N && y + dy >= 0 && y + dy < N && buf[j] >= 0 && !glow[j]; })) continue;
                        c = 0x1c1728;
                    }
                    d[o] = (c >> 16) & 255; d[o + 1] = (c >> 8) & 255; d[o + 2] = c & 255; d[o + 3] = a;
                }
            }
            ctx.putImageData(img, 0, 0); t.refresh();
            for (let f = 0; f < frames; f++) t.add(String(f), 0, f * N, 0, N, N);
        }
        if (!this.anims.exists(key)) this.anims.create({ key, frames: Array.from({ length: frames }, (_, f) => ({ key, frame: String(f) })), frameRate: fps, repeat: -1 });
        return key;
    }

    // ── THE FISH ──────────────────────────────────────────────────────────────
    // Every fish its own: a body built from its outline (nose, depth, belly), shaded top to belly with
    // its own pattern over it, its own tail, fins and extras (barbels, a lure, crystal spikes, a comet's
    // tail...), and six frames of swimming. Some aren't fish-shaped at all (rays, eels, jellies, the
    // puffers, the angler, the seahorse, the whale calf, the mudskipper) and are drawn whole.
    _fishTex(F) {
        const M = MenuArt.mix, spec = GardenScene.FISH_ART[F.id] || {}, n = spec.draw ? 6 : 8;
        return this._sheet('gd5_fish_' + F.id, n, (P, f) => (spec.draw || GardenScene._fishBody)(P, f, F, spec, M, n), spec.draw ? 6 : 9);
    }
    // A fish in profile, nose to the left. Its outline: a rounded head, the deepest point a third of the way
    // back (o.peak), tapering to a narrow wrist (o.ped of its depth) that the tail grows out of. A swimming
    // wave runs down it from nose to tail, so the tail leads and the head barely moves. Fins are rays of two
    // tones, thinning to translucent tips; the body is shaded top to belly with scale rows and a lateral line
    // over it (o.scales: false for a smooth skin), its own pattern on top (o.pat).
    static _fishBody(P, f, F, o, M, n = 8) {
        const ph = f / n * Math.PI * 2, sw = Math.sin(ph), x0 = o.x0 ?? 4, x1 = Math.min(o.x1 ?? 22, 23), cy = o.cy ?? 16, H = o.h ?? 6, B = o.belly ?? 1;   // (23: room for the tail in 32px)
        const C = Object.assign({ top: M(F.col, 0x0a0614, 0.4), side: F.col, belly: M(F.col, 0xffffff, 0.55), fin: F.fin, fin2: M(F.fin, 0xffffff, 0.45) }, o.c || {});
        const peak = o.peak ?? 0.34, ped = o.ped ?? 0.3, nose = o.nose ?? 0.6;
        const prof = u => u < peak ? Math.pow(Math.sin(Math.min(1, u / peak) * Math.PI / 2), nose) : ped + (1 - ped) * Math.pow(Math.cos((u - peak) / (1 - peak) * Math.PI / 2), 1.3);
        const amp = o.wag ?? 1.6, wag = u => amp * Math.pow(u, 1.6) * Math.sin(ph - u * 2.4);
        const ty = u => cy - prof(u) * H, by = u => cy + prof(u) * H * B, X = u => x0 + (x1 - x0) * u;
        const geo = { x0, x1, cy, H, ty, by, wag, X, sw, C, ph };
        // a fin's colour at (x, y): rays fanning out from its root (rx, ry), fading to a lighter, thinner edge
        const rays = (rx, ry, reach = 7) => (x, y) => { const a = Math.atan2(y - ry, x - rx), d = Math.hypot(x - rx, y - ry); const r = Math.floor(a * 5 + 10) % 2 ? C.fin : M(C.fin, C.fin2, 0.6); return d > reach * 0.75 ? M(r, C.fin2, 0.55) : r; };
        // the tail, behind, from the wrist; it swings a little behind the body's wave
        const tx = x1 - 0.5, tc = cy + wag(1), tw = amp * 1.7 * Math.sin(ph - 3.1), th = prof(1) * H;
        const tail = o.tail || 'fork', tf = rays(tx, tc, 8);
        if (tail === 'fork') P.poly([[tx, tc - th], [tx + 8, tc - 7 + tw], [tx + 5, tc + tw * 0.6], [tx + 8, tc + 7 + tw], [tx, tc + th]], tf);
        else if (tail === 'fan') P.poly([[tx, tc - th], [tx + 6, tc - 6 + tw], [tx + 8.5, tc + tw], [tx + 6, tc + 6 + tw], [tx, tc + th]], tf);
        else if (tail === 'round') P.ell(tx + 3.5, tc + tw * 0.5, 4, 4.5, tf);
        else if (tail === 'veil') { P.poly([[tx, tc - th], [tx + 7, tc - 8 + tw * 1.4], [tx + 10, tc - 2 + tw * 1.8], [tx + 9, tc + 4 + tw * 1.8], [tx + 6, tc + 9 + tw * 1.4], [tx, tc + th]], rays(tx, tc, 10)); }
        else if (tail === 'lyre') { P.poly([[tx, tc - th], [tx + 9, tc - 8 + tw], [tx + 4, tc - 1 + tw * 0.5], [tx + 4, tc + 1 + tw * 0.5], [tx + 9, tc + 8 + tw], [tx, tc + th]], tf); }
        // the dorsal and the fins under, behind the body; their tips ripple a beat behind the wave
        const rip = Math.sin(ph - 1.5), dors = o.dorsal || 'small';
        if (dors === 'sail') P.poly([[X(0.22), ty(0.22) + wag(0.22)], [X(0.3), ty(0.3) - 7 - rip * 0.6], [X(0.6), ty(0.55) - 6 + rip], [X(0.78), ty(0.78) + wag(0.78)]], rays(X(0.5), ty(0.5), 8));
        else if (dors === 'spines') for (let k = 0; k < 6; k++) { const u = 0.26 + k * 0.08, y0 = ty(u) + wag(u); P.line(X(u), y0, X(u) + 1, y0 - 4 - (k === 1 ? 1 : 0) + rip * 0.4, C.fin); if (k < 5) P.poly([[X(u), y0], [X(u) + 1, y0 - 3], [X(u + 0.08), y0 - 2], [X(u + 0.08), ty(u + 0.08) + wag(u + 0.08)]], M(C.fin, C.fin2, 0.5)); }
        else if (dors === 'small') P.poly([[X(0.36), ty(0.36) + wag(0.36)], [X(0.46), ty(0.42) - 4 + rip * 0.5], [X(0.62), ty(0.62) + wag(0.62)]], rays(X(0.48), ty(0.48), 5));
        else if (dors === 'long') P.poly([[X(0.28), ty(0.28) + wag(0.28)], [X(0.36), ty(0.33) - 3 + rip * 0.4], [X(0.84), ty(0.84) - 3 + rip], [X(0.92), ty(0.92) + wag(0.92)]], rays(X(0.6), ty(0.6), 6));
        P.poly([[X(0.58), by(0.58) + wag(0.58)], [X(0.7), by(0.66) + 3.5 - rip], [X(0.82), by(0.82) + wag(0.82)]], rays(X(0.7), by(0.7), 4));       // the anal fin
        P.poly([[X(0.3), by(0.3) + wag(0.3)], [X(0.36), by(0.34) + 3 + rip * 0.6], [X(0.42), by(0.42) + wag(0.42)]], rays(X(0.36), by(0.36), 3));  // the pelvic fin
        // the body
        const scaled = o.scales !== false;
        for (let x = Math.floor(x0); x <= Math.ceil(x1); x++) {
            const u = Math.max(0, Math.min(1, (x - x0) / (x1 - x0))), t0 = ty(u), b0 = by(u), w = wag(u);
            for (let y = Math.ceil(t0); y <= b0; y++) {
                const v = (y - t0) / Math.max(1, b0 - t0);
                let c = v < 0.35 ? M(C.top, C.side, v / 0.35) : v < 0.66 ? C.side : M(C.side, C.belly, (v - 0.66) / 0.34);
                if (v < 0.1) c = M(c, 0xffffff, 0.22);                                                                  // light along the back
                if (v > 0.9) c = M(c, 0x0a0614, 0.22);                                                                  // shade under the belly
                if (scaled && u > 0.24 && u < 0.94 && v > 0.08 && v < 0.88 && (y % 3 === 0) && ((x + Math.floor(y / 3) * 1.5) % 3 < 1)) c = M(c, 0x0a0614, 0.14);   // scale rows
                if (u > 0.24 && u < 0.92 && Math.abs(v - 0.42) < 0.05 && x % 2 === 0) c = M(c, 0xffffff, 0.22);                // the lateral line
                const p = o.pat ? o.pat(x, y, u, v, f, M, C) : null;
                P.put(x, y + w, p ?? c);
            }
        }
        // the gill cover, the pectoral fin rowing, the mouth and the eye
        const gu = o.gill ?? 0.22;
        for (let y = Math.ceil(ty(gu)) + 1; y < by(gu) - 1; y++) P.put(X(gu) + Math.abs(y - cy) * 0.25 + Math.max(0, Math.sin(ph * 2)) * 0.6, y + wag(gu), M(C.side, 0x0a0614, 0.4));
        const pr = Math.sin(ph * 2) * 1.6, pu = gu + 0.06;
        P.poly([[X(pu), cy + 1 + wag(pu)], [X(pu) + 4, cy + 3 + pr], [X(pu) + 5.5, cy + 1 + pr * 0.5], [X(pu) + 1.5, cy + wag(pu)]], rays(X(pu), cy + 1, 5));
        P.line(X(0.0) + 0.5, cy + 0.5 + H * 0.12, X(0.06) + 0.5, cy + 1 + H * 0.1, M(C.side, 0x0a0614, 0.55));
        const ex = X(o.eyeU ?? 0.11), ey = cy - H * (o.eyeV ?? 0.22), er = o.eye ?? 1.7;
        P.disc(ex, ey, er + 0.7, o.eyeRim ?? 0xf4f0e8); P.disc(ex - 0.2, ey, er * 0.75, o.iris ?? M(C.side, 0xffc040, 0.55)); P.disc(ex - 0.4, ey, er * 0.42, o.pupil ?? 0x0a0614); P.put(ex - 1, ey - 1, 0xffffff, 1);
        if (o.ex) o.ex(P, f, geo, M);
    }
    // A ray seen from above, nose to the left: a broad diamond of wings that flap (the tips lift and the span
    // narrows), a ripple running along their edges, eyes at the front, a whip of a tail. o: body, top (the
    // raised back), rim, eye colours; mark(P, x, y, f) draws on its back.
    static _ray(P, f, o) {
        const ph = f / 6 * Math.PI * 2, flap = 0.78 + 0.22 * Math.cos(ph), x0 = 3, x1 = 24, cy = 15;
        for (let x = x0; x <= x1; x++) {
            const u = (x - x0) / (x1 - x0), W = 11 * flap * (u < 0.42 ? Math.pow(Math.sin(u / 0.42 * Math.PI / 2), 0.8) : Math.pow(Math.cos((u - 0.42) / 0.58 * Math.PI / 2), 1.25));
            const rip = Math.sin(ph * 1.5 - u * 5) * 0.9;
            for (let y = -W - rip; y <= W + rip; y++) {
                const d = Math.abs(y) / Math.max(1, W), edge = d > 0.86;
                let c = d < 0.32 && u > 0.12 && u < 0.78 ? o.top : o.body;
                if (y < -W * 0.2 && !edge) c = MenuArt.mix(c, 0xffffff, 0.12);                  // the light on its near wing
                P.put(x, cy + y, edge ? o.rim : c, edge && o.glowRim);
            }
        }
        for (let k = 0; k < 9; k++) P.put(x1 + 1 + k, cy + Math.sin(ph - k * 0.6) * (k * 0.35), k < 3 ? o.body : o.rim);   // the tail
        if (o.mark) o.mark(P, 14, cy, f);
        for (const dy of [-2.5, 2.5]) { P.disc(6, cy + dy, 1, o.eye); P.put(5.6, cy + dy - 0.5, 0xffffff, 1); }
    }
    // A jelly: a bell that pulses (squeezing down and springing back as it swims), lit from inside, a frilled rim, and
    // arms trailing below that wave in turn. o: bell colours (top, mid, rim), arm colours, inner(P, x, y, f) for its core.
    static _jelly(P, f, o) {
        const ph = f / 6 * Math.PI * 2, sq = Math.sin(ph), rx = 8 + sq * 1.2, ry = 6.5 - sq * 1, cx = 16, cy = 10 - sq * 0.8, M = MenuArt.mix;
        for (let k = 0; k < 4; k++) {   // the arms, frilled, waving one after another
            const bx = cx - 6 + k * 4;
            for (let y = 0; y < 17; y++) { const x = bx + Math.sin(y * 0.45 - ph + k * 1.3) * (0.6 + y * 0.09); P.put(x, cy + ry + y, y % 3 ? o.arm : o.arm2); if (k % 2 === 0 && y % 4 === 1) P.put(x + 1, cy + ry + y, o.arm2); }
        }
        for (let k = 0; k < 7; k++) { const x = cx - 7 + k * 2.3; for (let y = 0; y < 4; y++) P.put(x + Math.sin(ph + k) * 0.4, cy + ry + y, M(o.rim, o.arm, y / 4)); }   // short frills under the rim
        P.ell(cx, cy, rx, ry, (x, y) => { const v = (y - (cy - ry)) / (ry * 2), d = Math.hypot((x - cx) / rx, (y - cy) / ry); return d > 0.82 ? o.rim : v < 0.35 ? o.top : o.mid; });
        for (let x = Math.ceil(cx - rx); x <= cx + rx; x++) P.put(x, Math.round(cy + ry * 0.92), (x + f) % 2 ? o.rim : o.arm2);   // the frilled rim
        o.inner(P, cx, cy, f, ph);
        P.put(cx - rx * 0.45, cy - ry * 0.55, 0xffffff, 1); P.put(cx - rx * 0.45 + 1, cy - ry * 0.55, 0xffffff, 1);   // a gloss
    }
    static FISH_ART = {
        // ── the river ──
        mudgill: { h: 6, belly: 1.1, nose: 0.35, tail: 'fan', dorsal: 'long', c: { top: 0x4a3a24, belly: 0xc8b088 },
            pat: (x, y, u, v) => ((x * 7 + y * 13) % 11 === 0 && v < 0.7 ? 0x3a2a18 : (x * 5 + y * 3) % 17 === 0 ? 0xa8946a : null),
            ex: (P, f, g) => { const mx = g.X(0.02), my = g.cy + 1, s = g.sw; P.line(mx, my, mx - 3, my + 3 + s, 0x6a5a3a); P.line(mx, my + 1, mx - 2, my + 5 - s, 0x6a5a3a); P.line(mx + 1, my - 1, mx - 3, my - 1 + s, 0x6a5a3a); } },   // barbels, wobbling
        pebblefin: { h: 4.5, x0: 3, x1: 24, nose: 0.7, tail: 'fork', dorsal: 'small', c: { top: 0x5a5e66, side: 0x8a8e96, belly: 0xd8dce0 },
            pat: (x, y, u, v) => { const k = ((Math.floor(x / 3) * 31 + Math.floor(y / 3) * 17) % 7); return v < 0.7 && k === 0 && (x % 3 + y % 3) > 1 ? 0xc8ccd0 : k === 1 && v < 0.6 && x % 3 === 1 ? 0x4a4e56 : null; } },   // pebble spots
        glimmer: { h: 7, belly: 1.05, nose: 0.5, tail: 'veil', dorsal: 'sail', c: { top: 0xd88a1a, side: 0xffc040, belly: 0xfff0b0, fin: 0xff7a2a, fin2: 0xffd08a },
            pat: (x, y, u, v, f) => { const sc = (x + (y % 2) * 1.5) % 3 < 1 && v > 0.1 && v < 0.8; const shine = Math.abs(((x - y) - f * 4) % 24) < 2; return shine ? 0xffffff : sc ? 0xffe070 : null; } },   // gold scales, a glint sweeping across
        mosstrout: { h: 5, x0: 3, x1: 24, nose: 0.6, tail: 'fork', dorsal: 'none', c: { top: 0x3a5a2a, side: 0x6a9a4a, belly: 0xe8e0c0, fin: 0x4a7a3a },
            pat: (x, y, u, v) => (v > 0.45 && v < 0.6 && u > 0.1 && u < 0.9 ? 0xd8584a : (x * 13 + y * 7) % 9 === 0 && v < 0.5 ? 0x1a2a10 : null),
            ex: (P, f, g) => { for (let k = 0; k < 5; k++) { const u = 0.3 + k * 0.1, x = g.X(u), y = g.ty(u); P.line(x, y, x - 1 + (k + f) % 2, y - 3, 0x5a8a3a); P.put(x + 1, y - 2, 0x8aba5a); } } },   // a red stripe, moss growing on its back
        lanternguppy: { h: 3.6, x0: 6, x1: 17, nose: 0.6, tail: 'veil', dorsal: 'small', c: { top: 0xb88a3a, side: 0xffe8a0, belly: 0xfff8e0, fin: 0xff8a3a, fin2: 0x5ad8ff },
            ex: (P, f, g) => { const p = 0.5 + 0.5 * Math.sin(f / 6 * Math.PI * 2); P.disc(g.X(0.5), g.cy + 2, 1.4 + p * 0.8, 0xfff0a0); P.put(g.X(0.5), g.cy + 2, 0xffffff, 1); if (p > 0.5) { P.put(g.X(0.5) - 3, g.cy + 2, 0xffe08a, 1); P.put(g.X(0.5) + 3, g.cy + 2, 0xffe08a, 1); } } },   // the lantern on its belly, pulsing
        moonfin: { draw: (P, f) => GardenScene._ray(P, f, { body: 0xb8c8f0, top: 0xe0e8ff, rim: 0x7a90d8, eye: 0x2a3a7a,
            mark: (P2, x, y) => { P2.disc(x + 1, y, 3, 0xfff6d0); P2.disc(x + 2.4, y - 0.8, 2.6, 0xd8e2ff); } }) },   // a pale ray, a crescent moon on its back
        stareel: { draw: (P, f, F, o, M) => {   // a long eel winding, stars in its skin twinkling one after another
            for (let x = 2; x < 30; x++) { const y = 16 + Math.sin(x * 0.42 - f * 1.05) * 3.2, h = x < 5 ? 1.5 : x > 26 ? 1 : 2.2; for (let j = -h; j <= h; j++) P.put(x, y + j, j < -h * 0.4 ? 0x5a2a9a : j > h * 0.5 ? 0xe8c8ff : 0xb07aff); if (x > 6 && x < 27 && x % 2 === 0) P.put(x, y - h - 1, 0x8a4ae0); }
            for (let k = 0; k < 6; k++) { const x = 6 + k * 4, y = 16 + Math.sin(x * 0.42 - f * 1.05) * 3.2; if ((k + f) % 3 === 0) P.spark(x, y, 0xffffff); else P.put(x, y, 0xfff0a0); }
            P.disc(3.5, 15 + Math.sin(3.5 * 0.42 - f * 1.05) * 3.2, 1, 0xffe060); P.put(3, 14.5 + Math.sin(3 * 0.42 - f * 1.05) * 3.2, 0x0a0614);
        } },
        riverwisp: { draw: (P, f) => GardenScene._jelly(P, f, { top: 0xd8fff8, mid: 0x8ae8d8, rim: 0x4ab8a8, arm: 0x6ad8c8, arm2: 0xd8fff0,
            inner: (P2, x, y, f2, ph) => { const p = 0.5 + 0.5 * Math.sin(ph); P2.disc(x, y, 2.4 + p, 0xffffff); P2.disc(x, y, 1.4, 0xfffbe0, 1); P2.put(x - 3, y - 1, 0x0a0614); P2.put(x + 3, y - 1, 0x0a0614); } }) },   // a ghostly bell of the river, its core glowing, two small eyes
        // ── the lake ──
        lakeperch: { h: 6, belly: 1, nose: 0.55, tail: 'fork', dorsal: 'spines', c: { top: 0x4a6a3a, side: 0x8aaa6a, belly: 0xe8e8c8, fin: 0xe87a3a, fin2: 0xffb07a },
            pat: (x, y, u, v) => (v < 0.75 && Math.floor((x - 4) / 3) % 2 === 0 && u > 0.15 && u < 0.85 ? 0x2a4a22 : null) },   // dark bands, orange fins, a spiny back
        bluegill: { h: 7.5, belly: 1, nose: 0.45, x0: 5, x1: 22, tail: 'fan', dorsal: 'long', c: { top: 0x1a3a7a, side: 0x3a6ad8, belly: 0xffd060, fin: 0x2a4a9a, fin2: 0x6a9aff },
            pat: (x, y, u, v) => (u > 0.18 && u < 0.3 && v > 0.25 && v < 0.5 ? 0x0a0614 : u < 0.2 && v > 0.4 && v < 0.75 && (x + y) % 3 === 0 ? 0x8ae8ff : null) },   // a deep round body, its dark ear spot, blue cheek lines
        crystalpike: { h: 4, x0: 2, x1: 25, nose: 1.1, tail: 'fork', dorsal: 'none', c: { top: 0x2a8a7a, side: 0x6ad8c0, belly: 0xe0fff8, fin: 0x8affd8, fin2: 0xffffff },
            pat: (x, y, u, v) => ((x + y * 2) % 7 === 0 && v < 0.7 ? 0xd8fff0 : (x - y * 2) % 7 === 0 && v < 0.7 ? 0x3aa898 : null),
            ex: (P, f, g) => { for (let k = 0; k < 5; k++) { const u = 0.28 + k * 0.12, x = g.X(u), y = g.ty(u) + g.wag(u); P.poly([[x - 1, y], [x + 0.5, y - 4 - (k % 2)], [x + 2, y]], (k + f) % 4 === 0 ? 0xffffff : 0xb8fff0); } } },   // crystal spikes along its back, facets catching light
        mirrorbass: { h: 6.5, nose: 0.4, tail: 'fork', dorsal: 'spines', c: { top: 0x5a6070, side: 0xc8d0dc, belly: 0xf4f6fa, fin: 0x8a94a8, fin2: 0xd8e0e8 },
            pat: (x, y, u, v, f) => { const band = ((x + y) - f * 5 + 60) % 30; return band < 3 && v < 0.9 ? 0xffffff : band < 5 && v < 0.9 ? 0xe8f0ff : (x % 3 === 0 && y % 2 === 0 && v < 0.6) ? 0x9aa4b4 : null; },
            ex: (P, f, g) => { P.line(g.X(0), g.cy + 1, g.X(0.12), g.cy + 2, 0x2a2e38); } },   // mirror scales with a reflection sweeping over, a big mouth
        puffglow: { draw: (P, f, F, o, M) => {   // a puffer breathing in and out, spines out when it's big, cheeks glowing
            const b = Math.sin(f / 6 * Math.PI * 2), r = 7.5 + b * 1.6;
            if (b > 0) for (let k = 0; k < 12; k++) { const a = k / 12 * Math.PI * 2; P.line(15 + Math.cos(a) * r, 16 + Math.sin(a) * r, 15 + Math.cos(a) * (r + 2.5), 16 + Math.sin(a) * (r + 2.5), 0xffe0f0); }
            P.disc(15, 16, r, (x, y) => (y < 16 - r * 0.4 ? 0xffc0e0 : y > 16 + r * 0.4 ? 0xfff0f8 : 0xff9ad8));
            for (let k = 0; k < 8; k++) P.put(12 + (k * 5) % 8, 13 + (k * 3) % 7, 0xd86ab0);
            P.poly([[15 + r - 1, 15], [24 + b, 11], [24 + b, 21], [15 + r - 1, 17]], 0xffd0e8);
            P.disc(10, 18, 1.6, 0xff6ac8, 1); P.disc(10, 13.5, 1.8, 0xffffff); P.disc(9.6, 13.5, 1, 0x0a0614); P.line(7.5, 17, 8.5, 17, 0x8a2a6a);
        } },
        // ── the Cloud Sea: cloud-fluff fish, winged fish, and the great sky beasts ──
        puffwisp: { draw: (P, f) => GardenScene._skyPuff(P, f) },
        breezefin: { draw: (P, f) => GardenScene._skyWinged(P, f, { body: 0xa8d8ff, top: 0x5a98d8, belly: 0xf0f8ff, wing: [0xffffff, 0xd8ecff, 0x8ac8ff], tail: 0x8ac8ff, len: 14, wingLen: 11 }) },
        dewguppy: { draw: (P, f) => GardenScene._skyDrop(P, f) },
        sunskipper: { draw: (P, f) => GardenScene._skyWinged(P, f, { body: 0xffd860, top: 0xe89a30, belly: 0xfff4c8, wing: [0xfff0a0, 0xffb84a, 0xe86a2a], tail: 0xffb84a, len: 11, wingLen: 9, sun: true }) },
        moonmoth: { draw: (P, f) => GardenScene._skyMoth(P, f) },
        prismtrout: { draw: (P, f) => GardenScene._skyWinged(P, f, { body: 0xf0f0ff, top: 0x9a8ad8, belly: 0xffffff, wing: [0xff8a8a, 0xffd860, 0x8affb0, 0x8ac8ff, 0xc89aff], tail: 0xc89aff, len: 15, wingLen: 12, rainbow: true }) },
        thunderjelly: { draw: (P, f) => GardenScene._skyStorm(P, f) },
        stormeel: { draw: (P, f) => GardenScene._skyDragon(P, f) },
        sunrisekoi: { draw: (P, f) => GardenScene._skyPhoenix(P, f) },
        skywhale: { draw: (P, f) => {   // a whale pup of the clouds: a big round sky-blue head, a body tapering to flukes, a white grooved belly, cloud dapples on its back, a little cloud puffed from its blowhole, a big happy eye
            const ph = f / 6 * Math.PI * 2, s = Math.sin(ph), bob = Math.round(Math.sin(ph) * 0.6);
            const top = x => x < 9 ? 16 - 7 * Math.sqrt(Math.max(0, 1 - ((x - 9) / 7) ** 2)) : 9 + (x - 9) * 0.33, bot = x => x < 12 ? 16 + 6 * Math.sqrt(Math.max(0, 1 - ((x - 12) / 10) ** 2)) : 22 - (x - 12) * 0.42;
            for (let x = 2; x <= 26; x++) { const w = x > 20 ? s * (x - 20) * 0.25 : 0, t0 = top(x) + bob + w, b0 = bot(x) + bob + w; for (let y = Math.ceil(t0); y <= b0; y++) { const v = (y - t0) / Math.max(1, b0 - t0); P.put(x, y, v > 0.6 ? ((y + x) % 3 === 0 ? 0xd8e8f8 : 0xffffff) : v < 0.18 ? 0x4a7ab8 : (x * 5 + y * 3) % 11 === 0 && v < 0.45 ? 0xe8f4ff : 0x7ab0e8); } }
            const fy = 15.5 + bob + s * 2.2; P.poly([[25, fy], [31, fy - 5 + s], [29, fy], [31, fy + 5 + s]], 0x5a8ac8);   // the flukes, beating
            P.poly([[11, 20 + bob], [15, 25 + bob + s], [17, 21 + bob]], 0x5a8ac8);   // the flipper
            P.disc(6, 15.5 + bob, 1.6, 0x0a1430); P.put(5.4, 14.8 + bob, 0xffffff, 1); P.put(6.4, 16.2 + bob, 0x6aa8e8, 1);   // a big bright eye
            P.line(2, 19 + bob, 6, 20 + bob, 0x2a4a7a); P.put(7, 19.6 + bob, 0xff9ad8, 0.8);   // a smile, a blush
            const pf = f % 3;   // a cloud puffed up from its blowhole, rising and thinning
            for (const [dx, dy, r] of [[0, 0, 1.6], [1.8, -0.6, 1.3], [-1.6, -0.4, 1.2]]) P.disc(10 + dx, 6 + bob - pf * 1.4 + dy, r * (1 - pf * 0.18), 0xffffff, 1 - pf * 0.25);
        } },
        nebulajelly: { draw: (P, f) => GardenScene._jelly(P, f, { top: 0xd8a8ff, mid: 0x8a4ae0, rim: 0x5a2aa8, arm: 0xff9ad8, arm2: 0xffd8f0,
            inner: (P2, x, y, f2, ph) => { for (let k = 0; k < 14; k++) { const a = k * 0.6 + ph * 0.5, r = 1 + k * 0.35; P2.put(x + Math.cos(a) * r, y + Math.sin(a) * r * 0.7, k % 3 ? 0xff9ad8 : 0xffffff, 1); } if (f2 % 2 === 0) P2.spark(x - 4, y - 2, 0xffffff); } }) },   // a nebula swirling inside the bell, stars in it
        voidkoi: { h: 6, belly: 1, nose: 0.5, tail: 'veil', dorsal: 'none', eye: 1.2, eyeRim: 0xff6ae0, pupil: 0x2a0a3a, c: { top: 0x0a0418, side: 0x2a1a4a, belly: 0x4a3a7a, fin: 0xff6ae0, fin2: 0x8a3ab0 },
            pat: (x, y, u, v, f) => { const m = Math.sin(x * 0.6 + y * 0.9) + Math.sin(x * 0.25 - y * 1.3 + f * 0.5); return m > 1.3 ? 0xff6ae0 : m > 1.0 ? 0xb03ab0 : null; },
            ex: (P, f, g) => { const mx = g.X(0.03), s = g.sw; P.line(mx, g.cy, mx - 4, g.cy + 4 + s * 2, 0xff6ae0); P.line(mx, g.cy - 1, mx - 5, g.cy - 3 - s * 2, 0xff6ae0); } },   // dark, marbled in neon, long whiskers trailing
        abyssangler: { draw: (P, f, F, o, M) => {   // the angler: a deep lumpy body, a jaw full of teeth, its lure bobbing and glowing
            const s = Math.sin(f / 6 * Math.PI * 2);
            P.poly([[22, 14], [30, 8 + s], [28, 16], [30, 23 - s], [22, 18]], 0x2a3a6a);
            P.poly([[5, 17], [8, 9], [15, 7], [22, 10], [24, 17], [20, 24], [10, 25]], (x, y) => (y < 11 ? 0x2a3a7a : y > 21 ? 0x3a4a8a : (x * 3 + y) % 7 === 0 ? 0x0a1430 : 0x1a2a5a));
            P.poly([[4, 18], [12, 17], [12, 22], [6, 23]], 0x0a0614); for (let x = 5; x < 12; x += 2) { P.put(x, 18, 0xf4f0e8); P.put(x + 1, 22, 0xf4f0e8); }
            P.line(12, 8, 10, 3, 0x3a4a8a); P.line(10, 3, 6, 2 + s, 0x3a4a8a);
            const g2 = 1.4 + (s + 1) * 0.5; P.disc(5, 3 + s, g2, 0x9affe8); P.put(5, 3 + s, 0xffffff, 1); P.spark(5, 3 + s, 0xd8fff8);
            P.disc(13, 12, 1.8, 0xd8e8ff); P.put(13, 12, 0x0a0614); P.line(16, 9, 18, 21, 0x0a1430);
            for (let k = 0; k < 4; k++) P.put(14 + k * 2, 14 + (k % 2) * 3, 0x9affe8, 1);
        } },
        // ── the mud patch ──
        mudskipper: { draw: (P, f) => {   // the goofy one: propped on its arm fins, eyes up on top of its head rolling about, a frilly sail, a wide grin
            const hop = f % 3 === 1 ? -1 : 0, M = MenuArt.mix, cy = 20 + hop;
            const prof = u => Math.pow(Math.sin(Math.PI * Math.min(1, u * 0.95 + 0.05)), 0.7);
            for (let x = 3; x <= 28; x++) { const u = (x - 3) / 25, h = 4.2 * prof(u) * (u < 0.3 ? 1.1 : 1), t0 = cy - h, b0 = cy + h * 0.8;
                for (let y = Math.ceil(t0); y <= b0; y++) { const v = (y - t0) / Math.max(1, b0 - t0); let c = v < 0.3 ? 0x5a4a2c : v > 0.75 ? 0xc8b888 : 0x8a7a4a; if ((x + Math.floor(y / 2)) % 3 === 0 && v > 0.15 && v < 0.75) c = M(c, 0x2a1e10, 0.25); if ((x * 7 + y * 3) % 11 === 0 && v < 0.6) c = 0x4a8ab8; P.put(x, y, c); } }   // mottled, with blue spots
            P.poly([[25, cy - 2], [31, cy - 5 + (f % 2)], [29, cy], [31, cy + 4 - (f % 2)], [25, cy + 2]], (x, y) => ((x + y) % 2 ? 0x4a8ab8 : 0x8ac8f0));   // its tail fin
            P.poly([[12, cy - 4], [14, cy - 11], [17, cy - 12], [21, cy - 10], [23, cy - 4]], (x, y) => (x % 2 ? 0x4a8ab8 : 0x8ac8f0)); for (const x of [15, 18, 21]) P.line(x, cy - 4, x, cy - 11, 0x2a5a8a);   // the sail, its rays
            for (const [x, d] of [[9, -1], [13, 1]]) { P.line(x, cy + 3, x + d, cy + 7, 0x6a5a34); P.line(x + d - 1, cy + 7, x + d + 1, cy + 7, 0x6a5a34); }   // arm fins, propping it up
            for (const ex of [6, 9.5]) { P.disc(ex, cy - 5, 2.4, 0xf4f0e8); const dx = [0, 1, 0, -1, 1, -1][f], dy = [0, 0, 1, 0, -1, 1][f]; P.disc(ex + dx * 0.8, cy - 5 + dy * 0.8, 1.1, 0x0a0614); P.put(ex - 0.8, cy - 6, 0xffffff, 1); }   // eyes on top, rolling
            P.line(2, cy + 1, 7, cy + 2, 0x2a1a10); P.put(7, cy + 1, 0x2a1a10); P.put(3, cy + 2, 0xf4f0e8);   // the grin, a tooth
            if (f % 3 === 0) { P.put(1, 28, 0x6a5a34); P.put(30, 27, 0x6a5a34); }   // mud flicked up
        } },
        // ── the Underwell ──
        driftling: { h: 5, x0: 7, x1: 20, nose: 0.4, tail: 'fan', dorsal: 'small', c: { top: 0x4a2a8a, side: 0x8a6ad8, belly: 0xd8c8ff, fin: 0xd8b8ff, fin2: 0xffffff },
            pat: (x, y, u, v) => (v > 0.3 && v < 0.6 && x % 4 === 0 ? 0xb89aff : null),
            ex: (P, f, g) => { for (let k = 0; k < 5; k++) { const x = g.x1 + 6 + k * 1.6, y = g.cy + Math.sin(k + f) * 2; if ((k + f) % 2 === 0) P.put(x, y, 0xffffff, 1); else P.put(x, y, 0xd8a8ff, 1); } } },   // drifting, a trail of stardust behind
        starmote: { draw: (P, f, F, o, M) => {   // a round puff of light with five star-point fins, turning slowly
            const b = Math.sin(f / 6 * Math.PI * 2), r = 6.5 + b * 0.6, rot = f / 6 * Math.PI * 0.4;
            for (let k = 0; k < 5; k++) { const a = rot + k / 5 * Math.PI * 2; P.poly([[16 + Math.cos(a - 0.35) * r, 16 + Math.sin(a - 0.35) * r], [16 + Math.cos(a) * (r + 6), 16 + Math.sin(a) * (r + 6)], [16 + Math.cos(a + 0.35) * r, 16 + Math.sin(a + 0.35) * r]], 0xfff0a0); }
            P.disc(16, 16, r, (x, y) => (Math.hypot(x - 14, y - 14) < 3 ? 0xffffff : y > 18 ? 0xb8b0e8 : 0xd8d0ff));
            P.disc(13, 15, 1.4, 0x0a0614); P.disc(18, 15, 1.4, 0x0a0614); P.put(13, 14, 0xffffff, 1); P.put(18, 14, 0xffffff, 1); P.line(15, 19, 16, 19, 0x6a5aa0);
            if (f % 2 === 0) P.spark(26, 6, 0xfff0a0);
        } },
        nebulite: { draw: (P, f, F, o, M) => {   // a little sea dragon of nebula: a curled tail, a snout, a frilled back rippling
            const s = Math.sin(f / 6 * Math.PI * 2), body = (x, y) => (Math.sin(x * 0.7 + y * 0.5 + f) > 0.5 ? 0xff8ad8 : (x + y) % 2 ? 0xb05ae0 : 0x8a4ae0);
            P.ell(16, 13, 4, 6, body); P.ell(17, 20, 3.5, 4, body);
            for (let k = 0; k < 10; k++) { const a = k * 0.55, r = 4 - k * 0.3; P.disc(18 + Math.cos(a) * r * 1.2, 25 + Math.sin(a) * r, 1.6 - k * 0.1, body); }
            P.poly([[13, 9], [8, 7 + s * 0.5], [8, 9], [13, 11]], body); P.put(8, 8 + s * 0.5, 0x0a0614);
            P.ell(14, 6, 3, 2.6, body); for (let k = 0; k < 6; k++) P.put(20 + Math.sin(k + f) * 0.8, 9 + k * 2, k % 2 ? 0xffd8f0 : 0xff8ad8);
            P.disc(14, 6, 1.1, 0xffffff); P.put(13.6, 6, 0x0a0614);
            P.spark(25, 8 + (f % 3) * 2, 0xffd8ff);
        } },
        voidray: { draw: (P, f) => GardenScene._ray(P, f, { body: 0x1a0c34, top: 0x2a1450, rim: 0xb07aff, eye: 0xff6ae0, glowRim: true,
            mark: (P2, x, y, f2) => { const st = [[-3, -2], [0, -3], [3, -1], [1, 2], [-2, 2]]; st.forEach(([dx, dy], k) => { if (k) P2.line(x + st[k - 1][0], y + st[k - 1][1], x + dx, y + dy, 0x5a3a9a); }); st.forEach(([dx, dy], k) => P2.put(x + dx, y + dy, (k + f2) % 3 ? 0xd8c8ff : 0xffffff, 1)); } }) },   // the dark between stars, edged in violet, a constellation on its back
        cometkoi: { h: 5.5, x0: 3, x1: 17, nose: 0.5, tail: 'veil', dorsal: 'small', eye: 1.5, c: { top: 0xe8c890, side: 0xfff0d0, belly: 0xffffff, fin: 0x6ad8ff, fin2: 0xd8f8ff },
            pat: (x, y, u, v) => (u > 0.35 && v < 0.55 && (x * 3 + y) % 5 === 0 ? 0xffb050 : null),
            ex: (P, f, g) => {   // a comet's tail streaming back from its own: strands of light that waver and thin out to sparks
                const ph = f / 8 * Math.PI * 2;
                for (let j = 0; j < 5; j++) { const y0 = g.cy - 3 + j * 1.5; for (let i = 0; i < 8; i++) { const x = g.x1 + 9 + i, y = y0 + Math.sin(i * 0.6 - ph + j) * (0.4 + i * 0.12); if ((i + j + f) % 4 === 3) continue; P.put(x, y, i < 2 ? 0xffffff : i < 5 ? 0xbfefff : 0x6ad8ff, 1); } }
                if (f % 2 === 0) P.spark(Math.min(30, g.x1 + 15), g.cy + Math.sin(ph) * 3, 0xd8f8ff);
            } },   // white-gold, its veil tail running on as a comet's
        starwhale: { draw: (P, f) => {   // a whale calf of the deep sky: a big round head, a body tapering to flukes, a pale grooved belly, stars in its skin, a puff of sparkle from its blowhole
            const ph = f / 6 * Math.PI * 2, s = Math.sin(ph), bob = Math.round(Math.sin(ph) * 0.6);
            const top = x => x < 9 ? 16 - 7 * Math.sqrt(Math.max(0, 1 - ((x - 9) / 7) ** 2)) : 9 + (x - 9) * 0.33, bot = x => x < 12 ? 16 + 6 * Math.sqrt(Math.max(0, 1 - ((x - 12) / 10) ** 2)) : 22 - (x - 12) * 0.42;
            for (let x = 2; x <= 26; x++) { const t0 = top(x) + bob + (x > 20 ? s * (x - 20) * 0.25 : 0), b0 = bot(x) + bob + (x > 20 ? s * (x - 20) * 0.25 : 0); for (let y = Math.ceil(t0); y <= b0; y++) { const v = (y - t0) / Math.max(1, b0 - t0); P.put(x, y, v > 0.62 ? ((y + x) % 3 === 0 ? 0xa8b8e8 : 0xd8e0ff) : v < 0.2 ? 0x2a3a8a : 0x1e2c72); } }
            const fy = 15.5 + bob + s * 2.2; P.poly([[25, fy], [31, fy - 5 + s], [29, fy], [31, fy + 5 + s]], 0x1a2a6a);   // the flukes, beating
            P.poly([[11, 20 + bob], [15, 25 + bob + s], [17, 21 + bob]], 0x1a2a6a);   // the flipper
            for (const [x, y] of [[8, 12], [13, 11], [17, 13], [21, 13], [11, 15]]) P.put(x, y + bob, (x + f) % 3 ? 0xd8e0ff : 0xffffff, 1);
            P.disc(6, 16 + bob, 1.2, 0x0a0614); P.put(5.6, 15.4 + bob, 0xffffff, 1); P.line(2, 19 + bob, 7, 20 + bob, 0x0a1430);
            for (let k = 0; k < 4; k++) P.put(9 + (k - 1.5) * (1 + (f % 3) * 0.5), 8 + bob - k - (f % 3), k % 2 ? 0x9ad8ff : 0xffffff, 1);
        } },
        riftwyrm: { draw: (P, f) => {   // a serpent out of a rift: black plates and green flesh between them, a frill of green spines, a horned head with a red eye; now and then a row of it slips sideways
            const ph = f / 6 * Math.PI * 2, Y = x => 16 + Math.sin(x * 0.32 - ph) * 3.6 * Math.min(1, (x - 3) / 8 + 0.3);
            for (let x = 6; x < 31; x++) {
                const y = Y(x), h = x > 26 ? 2.4 - (x - 26) * 0.45 : 2.4, plate = Math.floor((x - 6) / 3) % 2;
                if (x % 3 === 0 && x < 28) P.poly([[x - 1, y - h], [x + 0.5, y - h - 3.5 + Math.sin(ph + x) * 0.6], [x + 1.5, y - h]], 0x7aff5a);
                for (let j = -h; j <= h; j++) { const v = (j + h) / (2 * h); P.put(x, y + j, plate ? (v < 0.35 ? 0x2a1640 : v > 0.75 ? 0x120820 : 0x1e0e30) : (v < 0.4 ? 0x9aff7a : v > 0.75 ? 0x2a7a1a : 0x5ad83a)); }
            }
            const hy = Y(6);   // the head: a wedge with a jaw, two horns back, a red eye, a green glow in the mouth
            P.poly([[1, hy + 0.5], [4, hy - 3], [8, hy - 3], [8, hy + 3], [3, hy + 2.5]], (x, y) => (y < hy - 1 ? 0x2a1640 : 0x1e0e30));
            P.poly([[1.5, hy + 1.5], [6, hy + 1.5], [6, hy + 2.5], [3, hy + 2.5]], 0x7aff5a, 1);
            P.line(6, hy - 3, 10, hy - 6, 0x8a7ab0); P.line(7, hy - 3, 11, hy - 4.5, 0x6a5a90);
            P.disc(5, hy - 1, 1, 0xff3a3a); P.put(5, hy - 1, 0xffd0d0, 1);
            if (f % 2 === 0) { const gy = Math.round(11 + (f * 3) % 10); for (let x = 30; x >= 0; x--) { const c = P.get(x, gy); if (c >= 0) { P.put(x + 2, gy, c); P.put(x, gy, -1); } } }
        } },
        // ── the newer catches ──
        glassminnow: { h: 3.5, x0: 6, x1: 21, nose: 0.7, tail: 'fork', dorsal: 'small', scales: false, c: { top: 0xb8d8e0, side: 0xd8f0f0, belly: 0xf0ffff, fin: 0xa8d8e0, fin2: 0xffffff },
            pat: (x, y, u, v) => (Math.abs(v - 0.45) < 0.1 && u > 0.15 ? 0x8aa8b8 : x % 2 === 0 && v > 0.2 && v < 0.75 && u > 0.25 && u < 0.7 ? 0xa8c8d0 : Math.hypot((u - 0.32) * 3, v - 0.68) < 0.18 ? 0xff9a8a : null) },   // see-through: its spine, its ribs, its little red heart
        thornback: { h: 6, belly: 1.1, nose: 0.45, tail: 'fan', dorsal: 'spines', c: { top: 0x4a5a1a, side: 0x7a8a3a, belly: 0xd8d0a0, fin: 0xb85a2a, fin2: 0xffb06a },
            pat: (x, y, u, v) => ((x * 11 + y * 7) % 13 === 0 && v < 0.6 ? 0xd8c060 : null) },   // olive, thorn-spotted, a crest of red spines
        ribbonfin: { h: 4, x0: 5, x1: 18, nose: 0.55, tail: 'veil', dorsal: 'sail', scales: false, c: { top: 0xb878b0, side: 0xe8a8e0, belly: 0xfff0ff, fin: 0xb07aff, fin2: 0xffd8ff },
            pat: (x, y, u, v, f) => (Math.abs((x + y - f * 3) % 16) < 1.5 ? 0xffffff : null) },   // all fins and ribbons, a sheen running over it
        zebradart: { h: 3.8, x0: 3, x1: 24, nose: 0.8, tail: 'fork', dorsal: 'small', c: { top: 0x8a8478, side: 0xe8e0d0, belly: 0xffffff, fin: 0x2a2a3a, fin2: 0x8a8a9a },
            pat: (x, y, u, v) => (u > 0.12 && u < 0.95 && v < 0.85 && Math.floor(x + v * 3) % 4 < 2 ? 0x2a2a3a : null) },
        crownedcichlid: { h: 7, nose: 0.4, peak: 0.3, tail: 'round', dorsal: 'long', c: { top: 0x1a4a9a, side: 0x3a8ad8, belly: 0xa8d8ff, fin: 0xffb83a, fin2: 0xfff0a0 },
            pat: (x, y, u, v) => (x % 5 === 0 && v < 0.8 && u > 0.2 ? 0x2a6ab8 : null),
            ex: (P, f, g) => { const x = g.X(0.14), y = g.ty(0.14) + g.wag(0.14); P.ell(x, y - 1, 3, 2.4, 0xffb83a); for (const d of [-2, 0, 2]) P.line(x + d, y - 3, x + d, y - 5 - (d === 0 ? 1 : 0), 0xffe08a); P.put(x, y - 6, 0xffffff, 1); } },   // a gold hump on its head like a crown
        bubbleeye: { h: 6.5, belly: 1.15, nose: 0.4, tail: 'veil', dorsal: 'none', eyeU: 0.13, eyeV: 0.35, c: { top: 0xd85a2a, side: 0xff8a4a, belly: 0xffd8b0, fin: 0xffd0a0, fin2: 0xfff4e8 },
            ex: (P, f, g) => { const ex = g.X(0.13), ey = g.cy - g.H * 0.35 + 3.2, w = Math.sin(f / 8 * Math.PI * 2) * 0.3; P.ell(ex, ey, 3.2 + w, 2.6 - w, (x, y) => (y < ey - 1 ? 0xfff0e8 : 0xffd8c8)); P.put(ex - 1.5, ey - 1, 0xffffff, 1); } },   // the wobbling sacs under its eyes
        sludgegulper: { h: 7.5, belly: 1.2, nose: 0.25, peak: 0.25, tail: 'round', dorsal: 'small', eye: 1.2, c: { top: 0x3a2a14, side: 0x5a4a2a, belly: 0x8a9a4a, fin: 0x8a9a4a, fin2: 0xb8c87a },
            pat: (x, y, u, v) => ((x * 7 + y * 11) % 15 === 0 ? 0x7a6a3a : null),
            ex: (P, f, g) => { const x0 = g.X(0), gape = f % 4 < 2 ? 3 : 1.5; P.poly([[x0 - 0.5, g.cy - 1], [g.X(0.2), g.cy + 1], [x0 - 0.5, g.cy + 1 + gape]], 0x1a0a0a); P.put(x0 + 1, g.cy, 0xf4f0e8); P.put(x0 + 2, g.cy + 2, 0xf4f0e8); } },   // all mouth
        orbitfish: { h: 6, nose: 0.5, tail: 'fan', dorsal: 'small', c: { top: 0x2a4a8a, side: 0x5a8ad8, belly: 0xd8e8ff, fin: 0xd8e8ff, fin2: 0xffffff },
            pat: (x, y) => ((x * 13 + y * 7) % 17 === 0 ? 0xffffff : null),
            ex: (P, f, g) => { const a = f / 8 * Math.PI * 2, mx = g.X(0.45) + Math.cos(a) * 11, my = g.cy - 1 + Math.sin(a) * 3.5; P.disc(mx, my, Math.sin(a) < 0 ? 1.2 : 1.7, 0xd8d0c0); P.put(mx + 0.5, my, 0x8a8478); } },   // a little moon of its own going round it
        prismfin: { h: 5.5, nose: 0.55, tail: 'lyre', dorsal: 'sail', scales: false, c: { top: 0xa8d8f0, side: 0xd8f8ff, belly: 0xffffff, fin: 0xff9ad8, fin2: 0xd8f8ff },
            pat: (x, y, u, v, f, M) => (v > 0.15 && v < 0.8 && (x + y) % 2 ? M([0xff9ad8, 0xffe08a, 0x9affd8, 0x6ad8ff, 0xc8a8ff][((Math.floor((x - y * 0.6 + f * 2) / 3) % 5) + 5) % 5], 0xffffff, 0.3) : null) },   // light through a prism, running over it
        gazer: { h: 7, nose: 0.3, peak: 0.4, tail: 'round', dorsal: 'none', eye: 3.6, eyeU: 0.26, eyeV: 0.05, iris: 0x9aff6a, scales: false, c: { top: 0x1a0a2a, side: 0x3a1a4a, belly: 0x6a3a7a, fin: 0x9aff6a, fin2: 0x3a1a4a },
            pat: (x, y) => ((x * 3 + y * 7) % 19 === 0 ? 0x7aff5a : null),
            ex: (P, f, g) => { if (f === 5) { const ex = g.X(0.26), ey = g.cy - g.H * 0.05; P.ell(ex, ey, 4.4, 4.4, 0x3a1a4a); P.line(ex - 4, ey, ex + 4, ey, 0x9aff6a); } } },   // one great eye, and a slow blink
        emberloach: { draw: (P, f) => {   // a small dark loach winding along, embers in its skin glowing one after another, whiskers
            const Y = x => 16 + Math.sin(x * 0.28 - f * 1.05) * 1.8;
            for (let x = 4; x < 27; x++) { const y = Y(x), h = x < 7 ? 1.6 + (x - 4) * 0.4 : x > 22 ? 2.8 - (x - 22) * 0.4 : 2.8; for (let j = -h; j <= h; j++) P.put(x, y + j, j < -h * 0.3 ? 0x3a1a10 : j > h * 0.5 ? 0x8a4a2a : 0x5a2a1a); }
            for (let k = 0; k < 6; k++) { const x = 8 + k * 3; P.put(x, Y(x) - 0.5, (k + f) % 3 === 0 ? 0xffd060 : 0xff6a2a, 1); if ((k + f) % 3 === 0) P.put(x + 1, Y(x) - 0.5, 0xff8a3a, 1); }
            const hy = Y(4); P.line(4, hy + 1, 1, hy + 3, 0x8a4a2a); P.line(4, hy, 1, hy - 1, 0x8a4a2a); P.disc(6, hy - 0.8, 0.9, 0xffb03a); P.put(6, hy - 0.8, 0x0a0614);
            P.poly([[26, Y(26) - 2.5], [30, Y(26) - 3 + Math.sin(f) * 1.5], [30, Y(26) + 3 + Math.sin(f) * 1.5], [26, Y(26) + 2.5]], (x, y) => (x % 2 ? 0xff8a3a : 0xd85a2a));
        } },
        haloeel: { draw: (P, f) => {   // a pale gold eel, rings of light around it sliding down its length
            const Y = x => 16 + Math.sin(x * 0.25 - f * 1.05) * 2;
            for (let x = 2; x < 30; x++) { const y = Y(x), h = x < 5 ? 1.6 : x > 25 ? 2.4 - (x - 25) * 0.4 : 2.4; for (let j = -h; j <= h; j++) P.put(x, y + j, j < -h * 0.3 ? 0xc8b070 : j > h * 0.5 ? 0xfff8e0 : 0xf0e0a8); if (x > 5 && x < 27 && x % 2) P.put(x, y - h - 1, 0xd8c890); }
            for (let k = 0; k < 3; k++) { const x = 7 + ((k * 7 + f * 1.2) % 20), y = Y(x); for (let a = 0; a < Math.PI * 2; a += 0.35) P.put(x + Math.cos(a) * 1.4, y + Math.sin(a) * 4.4, Math.cos(a) > 0 ? 0xffffff : 0xffd060, 1); }
            const hy = Y(4); P.disc(4, hy - 0.6, 0.9, 0x0a0614); P.put(3.6, hy - 1.1, 0xffffff, 1);
        } },
        seahorse: { draw: (P, f) => {   // a seahorse with a lantern on its brow: an upright curl of a body, the snout, the tail coiled, the back fin fluttering
            const bob = Math.sin(f / 6 * Math.PI * 2) * 0.8, cx = 15, top = 6 + bob;
            for (let j = 0; j < 18; j++) { const y = top + 4 + j, x = cx + Math.sin(j / 18 * Math.PI) * 3.2, w = j < 12 ? 3 - j * 0.12 : 1.4; for (let d = -w; d <= w; d++) P.put(x + d, y, d < -w * 0.3 ? 0xffe08a : j % 3 === 0 ? 0xd88a2a : 0xffc85a); }
            for (let t = 0; t < 4.5; t += 0.15) P.put(cx + 2 + Math.cos(t) * (3 - t * 0.5), top + 22 + Math.sin(t) * (3 - t * 0.5), 0xd88a2a);   // the curled tail
            P.ell(cx, top + 3, 3, 2.6, 0xffc85a); P.line(cx - 2, top + 4, cx - 7, top + 5, 0xd88a2a); P.line(cx - 2, top + 3, cx - 7, top + 4, 0xffc85a);   // head and snout
            P.disc(cx, top + 2.5, 0.9, 0x0a0614); P.put(cx - 0.4, top + 2, 0xffffff, 1);
            for (let j = 0; j < 6; j++) P.line(cx + 4 + Math.sin(j * 0.6) * 0.5, top + 9 + j, cx + 7 + Math.sin(f * 1.5 + j) * 1.2, top + 9 + j, j % 2 ? 0x5ad8c8 : 0x9affe8);   // the back fin, fluttering
            P.line(cx + 1, top + 1, cx + 3, top - 3, 0xd88a2a); P.disc(cx + 3.5, top - 4, 1.4, 0x9affe8); P.put(cx + 3.5, top - 4, 0xffffff, 1);   // its lantern
        } },
        mossturtle: { draw: (P, f) => {   // a little turtle paddling along, its shell grown over with moss and a sprout
            const ph = f / 6 * Math.PI * 2, cy = 17;
            for (const [x, s] of [[9, 1], [20, -1]]) { const a = Math.sin(ph + (s > 0 ? 0 : Math.PI)) * 0.6; P.poly([[x, cy + 2], [x + Math.cos(1.2 + a) * 6 * -s, cy + 2 + Math.sin(1.2 + a) * 6], [x + 2, cy + 3]], 0x6a8a5a); }
            P.ell(15, cy, 10, 6, (x, y) => (y > cy + 3 ? 0xc8b878 : (Math.floor(x / 4) + Math.floor(y / 3)) % 2 ? 0x5a8a4a : 0x4a6a3a));
            for (let x = 8; x < 23; x++) if (x % 2) P.put(x, cy - 6 + Math.abs(x - 15) * 0.3 - (x % 4 === 1 ? 1 : 0), 0x8ab85a);   // moss
            P.line(15, cy - 6, 15, cy - 9, 0x5a9a3a); P.ell(14, cy - 9.5, 1.6, 0.8, 0x8ad85a); P.ell(17, cy - 9, 1.6, 0.8, 0x8ad85a);
            P.ell(4.5, cy + 1 + Math.sin(ph) * 0.4, 3, 2.2, 0x7a9a6a); P.put(3.5, cy + 0.5, 0x0a0614); P.line(2, cy + 2, 4, cy + 2.4, 0x3a4a2a);
            P.poly([[25, cy + 1], [29, cy + Math.sin(ph) * 1.5], [26, cy + 3]], 0x6a8a5a);
        } },
        crawdad: { draw: (P, f) => {   // a red crawdad from the bog: a segmented tail, legs, two big claws snapping, feelers waving
            const open = f % 3 === 0 ? 1.5 : 0.3, cy = 18;
            for (let k = 0; k < 5; k++) P.ell(17 + k * 2.4, cy + k * 0.4, 2.2 - k * 0.2, 2.6 - k * 0.25, k % 2 ? 0xb84a2a : 0xd85a3a);   // the tail segments
            P.poly([[28, cy + 1], [31, cy - 1], [31, cy + 4]], 0x8a2a1a);
            P.ell(12, cy - 0.5, 5, 3, (x, y) => (y < cy - 1 ? 0xe86a4a : 0xb84a2a));
            for (let k = 0; k < 4; k++) P.line(10 + k * 2, cy + 2, 9 + k * 2 + ((k + f) % 2), cy + 5, 0x8a2a1a);
            for (const s of [-1, 1]) { const by = cy - 1 + s * 2.5; P.line(8, by, 4, by + s, 0xb84a2a); P.ell(2.5, by + s - open * 0.5, 2.2, 1.1, 0xd85a3a); P.ell(2.5, by + s + open * 0.5, 2.2, 1, 0xb84a2a); }
            P.line(8, cy - 3, 1, cy - 8 + Math.sin(f) * 1.5, 0x8a2a1a); P.line(9, cy - 3, 4, cy - 9 - Math.sin(f) * 1.5, 0x8a2a1a);
            P.put(9, cy - 3, 0x0a0614); P.put(10, cy - 3.5, 0x0a0614);
        } },
        cometsquid: { draw: (P, f) => {   // a pale squid jetting through the dark, a comet's trail behind it, its arms streaming
            const ph = f / 6 * Math.PI * 2, pulse = Math.sin(ph), cx = 9, cy = 15;
            for (let k = 0; k < 8; k++) P.put(28 - k * 2 + (f % 2), cy + Math.sin(k + ph) * (k * 0.3), k < 3 ? 0x6ad8ff : 0x3a7ac8, 1);   // the comet trail
            for (let k = 0; k < 5; k++) for (let j = 0; j < 9; j++) P.put(cx + 7 + j, cy - 2 + k + Math.sin(j * 0.6 - ph + k) * (0.4 + j * 0.08), j % 3 ? 0xb8c8e8 : 0x8aa8d8);   // arms streaming back
            P.ell(cx, cy, 8 - pulse * 0.6, 4.4 + pulse * 0.4, (x, y) => (y < cy - 1 ? 0xf0f8ff : (x + y) % 4 === 0 ? 0x9ad8ff : 0xd8e8ff));
            P.poly([[cx - 6, cy], [cx - 10, cy - 3 - pulse], [cx - 8, cy]], 0xb8d8f0); P.poly([[cx - 6, cy], [cx - 10, cy + 3 + pulse], [cx - 8, cy]], 0xb8d8f0);   // its mantle fins
            P.disc(cx + 4, cy, 1.3, 0x0a0614); P.put(cx + 3.6, cy - 0.5, 0x6ad8ff, 1);
            P.spark(cx - 3, cy - 1, 0xffffff);
        } },
    };

    // ── THE CROPS ─────────────────────────────────────────────────────────────
    // Every crop its own, grown in stages: 0 a seed in a little mound (its own seed), 1-3 growing
    // (each plant drawn at its growth, buds closed), 4 ripe, glowing and alive. Six frames: swaying,
    // pulsing, sparkling.
    _cropTex(S, st, bare = false) {   // bare: no mound of its own (it stands in a tilled field)
        const M = MenuArt.mix, art = GardenScene.CROP_ART[S.id] || GardenScene.CROP_ART.sprout;
        return this._sheet(`gd4_crop_${S.id}_${st}${bare ? 'b' : ''}`, 6, (P, f) => {
            const g = [0, 0.35, 0.6, 0.82, 1][st], sw = Math.sin(f / 6 * Math.PI * 2);
            if (bare && st === 0) {   // just sown: a seed pressed into the furrow, a first green tip in its colour
                const c = art.seed ?? S.col; P.put(16, 29, M(c, 0x2a1a0e, 0.3)); P.put(15, 29, M(c, 0x2a1a0e, 0.5));
                P.put(16, 28, 0x6aba58); P.put(16 + (f % 2), 27, 0x8ada6a); return;
            }
            if (!bare) P.ell(16, 29, 7, 2.2, (x, y) => ((x + y) % 3 ? 0x5a3a24 : 0x6a4a30));   // its mound of soil
            if (st === 0) { const c = art.seed ?? S.col; P.ell(16, 27, 1.8, 1.3, c); P.put(15, 26.5, M(c, 0xffffff, 0.6)); if (f % 3 === 0) P.put(18, 25, 0x8aba5a); return; }
            art.draw(P, f, g, sw, S, M, st === 4);
        });
    }
    static CROP_ART = {
        cloudcotton: { seed: 0xe8f0ff, draw: (P, f, g, sw, S, M, ripe) => {   // a cotton plant whose bolls are little clouds, drifting a touch on their stalks
            P.line(16, 28, 16 + sw * 0.5, 28 - 14 * g, 0x6a9a58);
            for (const [ox, oy, r] of [[0, 15, 4], [-5, 10, 3], [5, 11, 3.2], [-2, 6, 2.4], [3, 5, 2.2]]) {
                const R = r * g; if (R < 1) continue; const x = 16 + ox * g + sw * 0.6, y = 28 - oy * g * 1.1;
                P.line(16, y + R, x, y, 0x5a8a48);
                P.ell(x, y, R * 1.3, R, (px, py) => (py < y - R * 0.3 ? 0xffffff : py > y + R * 0.4 ? 0xc8d8f0 : 0xf0f4ff));
            }
            if (ripe) { P.spark(9 + (f % 3) * 6, 5 + (f % 2) * 3, 0xffffff); if (f % 2) P.put(23, 9, 0xd8f0ff, 1); }
        } },
        skybloom: { seed: 0x8ac8ff, draw: (P, f, g, sw, S, M, ripe) => {   // a tall flower whose petals are bits of blue sky, a little sun for a heart, a breeze through it
            const top = 28 - 20 * g, hx = 16 + sw * 1.2 * g;
            P.line(16, 28, hx, top, 0x5a9a48); P.line(16, 22, 12, 19 - 2 * g, 0x6aba58); P.line(16, 20, 20, 17 - 2 * g, 0x6aba58);
            if (g > 0.5) { const r = 4.5 * g; for (let k = 0; k < 6; k++) { const a = k / 6 * Math.PI * 2 + sw * 0.1; P.ell(hx + Math.cos(a) * r, top + Math.sin(a) * r * 0.8, 2.2, 1.6, k % 2 ? 0x8ac8ff : 0xb8e0ff); } P.disc(hx, top, 1.8, 0xffe060); P.put(hx - 0.5, top - 0.5, 0xffffff); }
            if (ripe) { const w = (f % 6) * 3; P.line(4 + w, 10, 8 + w, 10, 0xffffff, 0.6); P.spark(hx + 6, top - 3, 0xfff0a0); }
        } },
        sprout: { draw: (P, f, g, sw, S, M, ripe) => {   // dust crystals growing out of the soil, mint and faceted, sparkling when ripe
            P.line(16, 28, 16, 25, 0x5a9a48); P.put(15, 26, 0x6aba58);
            for (const [ox, h, w, lean] of [[0, 18, 2.6, 0], [-5, 12, 1.8, -0.25], [5, 13, 1.8, 0.22], [-2.5, 8, 1.4, -0.1], [3, 9, 1.4, 0.12]]) {
                const H = h * g; if (H < 2) continue;
                for (let j = 0; j < H; j++) { const tip = j > H - w * 1.6, ww = tip ? w * (H - j) / (w * 1.6) : w; for (let x = -ww; x <= ww; x++) { const fr = (x + ww) / (2 * ww + 0.01); P.put(16 + ox + x + lean * j, 26 - j, tip ? 0xffffff : fr < 0.35 ? 0xd8fff0 : fr < 0.7 ? 0x8affd8 : 0x3aa890); } }
            }
            if (ripe) { P.spark(8 + (f % 3) * 7, 6 + (f % 2) * 4); if (f % 2) P.put(22, 12, 0xffffff, 1); }
        } },
        glowroot: { seed: 0x9aff8a, draw: (P, f, g, sw, S, M, ripe) => {   // a glowing bulb root swelling half out of the soil, broad leaves over it, its veins pulsing
            const r = 6 * g, p = 0.5 + 0.5 * sw;
            for (const [a, L] of [[-2.2, 12], [-1.6, 13], [-0.9, 11], [-2.6, 9]]) { const ll = L * g; for (let j = 0; j < ll; j++) { const x = 16 + Math.cos(a + sw * 0.05) * j, y = 22 - r + Math.sin(a) * j; P.put(x, y, 0x4a9a3a); if (j > 2 && j < ll - 1) { P.put(x + 1, y, 0x6aca4a); P.put(x, y + 1, 0x3a7a2a); } } }
            P.ell(16, 26 - r * 0.4, r, r * 0.9, (x, y) => (Math.abs(x - 16 + (y - 24) * 0.3) < 0.8 ? (ripe ? M(0xffffff, 0x9aff8a, 1 - p) : 0xb8ff9a) : y < 23 ? 0xc8ffb0 : 0x7ae85a));
            for (let k = 0; k < 4; k++) P.line(16 + (k - 1.5) * 2, 28, 16 + (k - 1.5) * 4, 31, 0x9aff8a);
            if (ripe) { P.put(13, 20, 0xffffff, 1); if (p > 0.6) { P.spark(23, 18, 0xd8ffc8); P.spark(9, 21, 0xd8ffc8); } }
        } },
        mossbell: { seed: 0xc8f08a, draw: (P, f, g, sw, S, M, ripe) => {   // a mossy stem arching up and over, bell flowers hanging off it on threads, swaying
            const pt = t => [10 + 15 * t * g, 28 - Math.sin(t * Math.PI * 0.8) * 19 * g];
            for (let t = 0; t <= 1; t += 0.02) { const [x, y] = pt(t); P.put(x, y, 0x4a8a3a); P.put(x, y + 1, 0x3a6a2a); if (Math.round(t * 50) % 7 === 0) { P.put(x - 1, y - 1, 0x8aca5a); P.put(x + 1, y - 1, 0x6aaa4a); } }
            const n = ripe ? 4 : Math.floor(g * 4);
            for (let k = 0; k < n; k++) {
                const [ax, ay] = pt(0.5 + k * 0.16), L = 2 + (k % 2), bx = ax + sw * (0.6 + k * 0.25), by = ay + L + 1;
                P.line(ax, ay + 1, bx, by - 1, 0x4a8a3a);
                if (g < 0.8) { P.disc(bx, by + 1, 1.2, 0x9aca6a); continue; }
                P.poly([[bx - 2, by + 4], [bx - 1.2, by], [bx + 1.2, by], [bx + 2, by + 4]], (x, y) => (x < bx ? 0xf0ffd8 : 0xc8f08a)); P.put(bx, by + 4, 0xfff0a0, 1);
            }
            if (ripe && f % 3 === 0) P.spark(26, 6, 0xe8ffc8);
        } },
        starbloom: { seed: 0xffe08a, draw: (P, f, g, sw, S, M, ripe) => {   // a tall stem, leaves paired up it, a five-pointed golden star of a flower that twinkles
            const H = 20 * g, top = 28 - H, x0 = 16 + sw * 0.6;
            P.line(16, 28, x0, top, 0x4a8a3a); for (let k = 1; k < 4; k++) { const y = 28 - H * k / 4; if (H * k / 4 < 3) continue; P.line(16, y, 12 - k * 0.5, y - 2, 0x6aaa4a); P.line(16, y - 1, 20 + k * 0.5, y - 3, 0x5a9a48); }
            if (g < 0.8) { P.disc(x0, top, 1.6, 0x8aaa4a); P.put(x0, top - 1, 0xffe08a); return; }
            const r = ripe ? 6 : 4;
            for (let k = 0; k < 5; k++) { const a = -Math.PI / 2 + k * Math.PI * 2 / 5 + (ripe ? sw * 0.06 : 0); P.poly([[x0 + Math.cos(a - 0.6) * r * 0.4, top + Math.sin(a - 0.6) * r * 0.4], [x0 + Math.cos(a) * r, top + Math.sin(a) * r], [x0 + Math.cos(a + 0.6) * r * 0.4, top + Math.sin(a + 0.6) * r * 0.4]], k % 2 ? 0xffe08a : 0xfff0b0); }
            P.disc(x0, top, 1.6, 0xffb040);
            if (ripe) { P.spark(x0 + [6, -7, 8, -5, 7, -8][f], top - 5 + (f % 3) * 3, 0xfff8d0); P.put(x0, top, 0xffffff, 1); }
        } },
        frostfern: { seed: 0x9ad8ff, draw: (P, f, g, sw, S, M, ripe) => {   // fronds of frost curling up and out, rimed white at the tips, ice crystals glinting
            for (let k = 0; k < 5; k++) {
                const a0 = -Math.PI / 2 + (k - 2) * 0.55, L = (11 + (k % 2) * 4) * g;
                for (let j = 0; j < L; j++) {
                    const a = a0 + (j / L) * (k < 2 ? -0.25 : k > 2 ? 0.25 : 0) * g + sw * 0.03, x = 16 + Math.cos(a) * j, y = 28 + Math.sin(a) * j;
                    P.put(x, y, j > L - 2 ? 0xffffff : 0x6ab8e8);
                    if (j % 2 === 0 && j > 1 && j < L - 1) { P.put(x + Math.cos(a + 1.5) * 1.6, y + Math.sin(a + 1.5) * 1.6, 0x9ad8ff); P.put(x + Math.cos(a - 1.5) * 1.6, y + Math.sin(a - 1.5) * 1.6, 0xc8ecff); }
                }
            }
            if (ripe) { for (const [x, y, k] of [[9, 9, 0], [23, 11, 2], [16, 5, 4]]) if ((f + k) % 3 === 0) P.spark(x, y, 0xffffff); else P.put(x, y, 0xd8f4ff, 1); }
        } },
        sunpetal: { seed: 0xffb86a, draw: (P, f, g, sw, S, M, ripe) => {   // a sunflower turning to the light: a ring of orange petals round a seeded face, big leaves
            const H = 17 * g, top = 28 - H; P.line(16, 28, 16, top, 0x5a9a3a); P.line(17, 28, 17, top, 0x3a7a2a);
            for (const [y, d] of [[24, -1], [20, 1]]) if (28 - y < H) P.ell(16 + d * 4, y, 3.5, 1.6, (x, yy) => ((x + yy) % 3 ? 0x6aba4a : 0x4a9a3a));
            if (g < 0.8) { P.disc(16, top, 2.2, 0x6a9a3a); return; }
            const r = ripe ? 7 : 5, rot = f / 6 * Math.PI * 2 / 12;
            for (let k = 0; k < 12; k++) { const a = rot + k / 12 * Math.PI * 2; P.ell(16 + Math.cos(a) * r * 0.75, top + Math.sin(a) * r * 0.75, 1.8, 1.8, k % 2 ? 0xffb040 : 0xffd060); }
            P.disc(16, top, r * 0.45, (x, y) => ((x * 3 + y * 5) % 4 === 0 ? 0xc87a2a : 0x6a3a1a));
            if (ripe && f % 2 === 0) P.spark(26, top - 4, 0xfff0a0);
        } },
        emberheart: { seed: 0xff9a6a, draw: (P, f, g, sw, S, M, ripe) => {   // charred stalks cradling a heart-shaped fruit of ember, a small flame licking up off it
            for (const [dx, h] of [[-4, 12], [4, 13], [0, 9]]) { const H = h * g; P.line(16, 28, 16 + dx, 28 - H, 0x3a2a24); P.line(16 + Math.sign(dx), 28, 16 + dx + Math.sign(dx), 28 - H, 0x5a3a2a); if (H > 4) P.put(16 + dx, 28 - H, 0xff6a2a, 1); }
            if (g < 0.6) return;
            const cy = 28 - 13 * g, s = ripe ? 1 : 0.7, hc = (x, y) => (y < cy - 1 ? 0xff8a5a : (x + y + f) % 4 === 0 ? 0xffd060 : 0xd83a2a);
            P.disc(16 - 2.2 * s, cy - 1, 2.8 * s, hc); P.disc(16 + 2.2 * s, cy - 1, 2.8 * s, hc); P.poly([[16 - 5 * s, cy], [16 + 5 * s, cy], [16, cy + 6 * s]], hc);
            P.put(14, cy - 2, 0xffffff, 1);
            if (ripe) { const fl = [0, 1, 2, 1, 0, -1][f]; P.poly([[14, cy - 3], [16 + fl * 0.5, cy - 9 - Math.abs(fl)], [18, cy - 3]], 0xffb040); P.poly([[15, cy - 3], [16 + fl * 0.5, cy - 6 - Math.abs(fl)], [17, cy - 3]], 0xfff0a0); }
        } },
        voidlily: { seed: 0xd8a8ff, draw: (P, f, g, sw, S, M, ripe) => {   // a lily of the void: long dark petals curling back round a black heart that swallows light
            const H = 15 * g, top = 28 - H; P.line(16, 28, 16 + sw * 0.5, top, 0x3a2a5a); P.ell(12, 25, 3, 1.2, 0x4a3a6a); P.ell(20, 23, 3, 1.2, 0x4a3a6a);
            if (g < 0.8) { P.ell(16, top, 1.6, 3, 0x6a4a9a); return; }
            const r = ripe ? 8 : 5;
            for (let k = 0; k < 6; k++) { const a = -Math.PI / 2 + (k - 2.5) * 0.55; P.poly([[16, top], [16 + Math.cos(a - 0.2) * r, top + Math.sin(a - 0.2) * r], [16 + Math.cos(a) * (r + 1.5), top + Math.sin(a) * (r + 1.5) + 1.5], [16 + Math.cos(a + 0.2) * r, top + Math.sin(a + 0.2) * r]], (x, y) => (Math.hypot(x - 16, y - top) > r * 0.7 ? 0xe8c8ff : (x + y) % 2 ? 0x8a4ae0 : 0xb07aff)); }
            P.disc(16, top, 2.2, 0x06020e);
            if (ripe) { for (let k = 0; k < 4; k++) { const a = k / 4 * Math.PI * 2 + f * 0.5; P.put(16 + Math.cos(a) * (4 - f % 3), top + Math.sin(a) * (4 - f % 3), 0xd8a8ff, 1); } }
        } },
        nebulorchid: { seed: 0xb07aff, draw: (P, f, g, sw, S, M, ripe) => {   // an orchid of nebula: a curving cane, frilled petals in violet and rose, motes drifting off it
            const H = 18 * g; for (let j = 0; j < H; j++) P.put(16 + Math.sin(j * 0.25) * 2 + sw * j / 30, 28 - j, j % 5 === 4 ? 0x4a8a3a : 0x5a9a48);
            const tx = 16 + Math.sin(H * 0.25) * 2, ty = 28 - H;
            if (g < 0.8) { P.ell(tx, ty, 1.5, 2.5, 0x8a5ab0); return; }
            const neb = (x, y) => { const v = Math.sin(x * 0.8 + y * 0.6 + f * 0.6); return v > 0.5 ? 0xff9ad8 : v > -0.3 ? 0xb07aff : 0x6a3ab0; };
            P.ell(tx - 4, ty - 1, 3.5, 2.2, neb); P.ell(tx + 4, ty - 1, 3.5, 2.2, neb); P.ell(tx, ty - 4, 2.2, 3.5, neb); P.ell(tx, ty + 2.5, 3, 2.5, (x, y) => ((x + y) % 2 ? 0xffd8f0 : 0xff9ad8));
            P.disc(tx, ty, 1.2, 0xfff0a0, 1);
            if (ripe) for (let k = 0; k < 3; k++) P.put(tx + 6 + k * 2, ty - 6 - ((f + k * 2) % 6), k % 2 ? 0xff9ad8 : 0xffffff, 1);
        } },
        tidelotus: { seed: 0x7ad8ff, draw: (P, f, g, sw, S, M, ripe) => {   // a lotus on its own little pool: a pad, a closed bud rising, then pink-and-tide petals open, a drop rolling
            P.ell(16, 27, 11, 3.5, (x, y) => ((x + f) % 5 === 0 && y === 27 ? 0xd8f4ff : 0x2a6aa8)); P.ell(16, 27, 8 * Math.max(0.5, g), 2.4, (x, y) => ((x * 2 + y) % 5 ? 0x3a8a4a : 0x5aaa5a));
            if (g < 0.6) return;
            const top = 25 - 6 * g;
            if (g < 0.9) { P.ell(16, top, 2, 3.2, (x, y) => (x < 16 ? 0xffc0e0 : 0xe08ac0)); return; }
            for (const [dx, h, c] of [[-6, 3, 0x7ad8ff], [6, 3, 0x7ad8ff], [-3.5, 6, 0xffb0d8], [3.5, 6, 0xffb0d8], [0, 8, 0xffd8f0]]) P.poly([[16 + dx * 0.4 - 2, 25], [16 + dx, 25 - h], [16 + dx * 0.4 + 2, 25]], (x, y) => (y < 25 - h + 2 ? 0xffffff : c));
            P.disc(16, 22, 1.2, 0xfff0a0, 1);
            if (ripe) P.disc(9 + f * 0.6, 26 - (f % 2), 0.9, 0xd8f4ff);
        } },
        pearlkelp: { seed: 0xe8f0ff, draw: (P, f, g, sw, S, M, ripe) => {   // ribbons of kelp waving as if under water, pearls held in its fronds
            for (let k = 0; k < 4; k++) { const L = (14 + k * 2) * g, bx = 11 + k * 3.4; for (let j = 0; j < L; j++) { const x = bx + Math.sin(j * 0.35 + f * 1.05 + k) * (j / 8), y = 28 - j; P.put(x, y, k % 2 ? 0x5a8a3a : 0x3a7a5a); P.put(x + 1, y, k % 2 ? 0x8aba5a : 0x5aa87a); } if (ripe || g > 0.8) { const j = L * 0.7, x = bx + Math.sin(j * 0.35 + f * 1.05 + k) * (j / 8); P.disc(x + 2, 28 - j, 1.4, 0xf4f8ff); P.put(x + 1.6, 27.4 - j, 0xffffff, 1); } }
            if (ripe && f % 2) P.spark(25, 8, 0xe8f0ff);
        } },
        abyssbloom: { seed: 0x5a7aff, draw: (P, f, g, sw, S, M, ripe) => {   // a cluster of deep-sea mushrooms, caps spotted with light that pulses in turn
            for (const [dx, h, r, k] of [[0, 12, 6, 0], [-6, 7, 4, 1], [6, 8, 4, 2], [-3, 4, 2.5, 3]]) {
                const H = h * g, R = r * Math.max(0.4, g); if (H < 2) continue;
                P.line(16 + dx, 28, 16 + dx, 28 - H, 0xc8d0e8); P.line(17 + dx, 28, 17 + dx, 28 - H, 0x9aa4c8);
                P.ell(16.5 + dx, 28 - H, R, R * 0.55, (x, y) => (y < 28 - H - R * 0.2 ? 0x3a5aff : 0x2a3aa8));
                for (let q = 0; q < 3; q++) { const on = ripe && (f + k + q) % 3 === 0; P.put(15 + dx + q * 1.5, 28 - H - 1 + (q % 2), on ? 0x9affe8 : 0x6a8aff, on); }
                P.line(16.5 + dx - R + 1, 28 - H + R * 0.5, 16.5 + dx + R - 1, 28 - H + R * 0.5, 0x1a2a6a);
            }
        } },
        cosmicseed: { seed: 0xb07aff, draw: (P, f, g, sw, S, M, ripe) => {   // a little tree whose crown is a planet of violet light, motes orbiting it
            const H = 12 * g; P.line(16, 28, 16, 28 - H, 0x4a3a6a); P.line(15, 28, 13, 26, 0x4a3a6a); P.line(17, 28, 19, 26, 0x4a3a6a); P.line(16, 28 - H * 0.6, 12, 28 - H * 0.8, 0x4a3a6a);
            const r = 6 * g, cy = 28 - H - r * 0.6;
            P.disc(16, cy, r, (x, y) => { const d = Math.hypot(x - 14.5, y - cy + 1.5); return d < r * 0.35 ? 0xffffff : d < r * 0.7 ? 0xd8a8ff : 0x8a4ae0; });
            if (g > 0.8) { P.ell(16, cy, r + 3, 1.2, (x, y) => (Math.abs(x - 16) > r - 1 ? 0xb88aff : -1)); }
            if (ripe) for (let k = 0; k < 3; k++) { const a = f / 6 * Math.PI * 2 + k * 2.1; P.put(16 + Math.cos(a) * (r + 4), cy + Math.sin(a) * 2, 0xffffff, 1); }
        } },
        corruptseed: { seed: 0x7aff5a, draw: (P, f, g, sw, S, M, ripe) => {   // a fungus gone wrong: twisted green-and-black stalks, a cap that glitches sideways now and then, a red eye open in it
            const H = 16 * g; for (let j = 0; j < H; j++) { const x = 16 + Math.sin(j * 0.6) * 2, y = 28 - j; P.put(x, y, j % 3 ? 0x2a1a3a : 0x5aca3a); P.put(x + 1, y, 0x1a0a2a); }
            const r = 7 * g, cy = 28 - H;
            P.ell(16, cy, r, r * 0.6, (x, y) => ((x + y) % 4 === 0 ? 0x0a0614 : y < cy ? 0x9aff6a : 0x4aaa3a));
            for (let k = 0; k < 3; k++) P.line(16 - r + k * r * 0.7 + 1, cy + r * 0.5, 16 - r + k * r * 0.7, cy + r * 0.5 + 2 + (k + f) % 3, 0x5aca3a);
            if (ripe) { P.disc(16, cy, 1.5, 0xff3a3a); P.put(16, cy, 0x0a0614); }
            if (f === 3 || f === 4) { const gy = Math.round(cy - 1 + (f - 3) * 2); for (let x = 0; x < 32; x++) { const c = P.get(x, gy); if (c >= 0) { P.put(x - 2, gy, c); P.put(x, gy, -1); } } }   // the glitch
        } },
        stardrop: { seed: 0xfff0a0, draw: (P, f, g, sw, S, M, ripe) => {   // a slender silver branch bowing under one hanging star of a fruit, softly glowing, chiming
            const H = 16 * g; for (let j = 0; j < H; j++) P.put(16 - Math.sin(j / 16 * Math.PI * 0.8) * 4 * g, 28 - j, j % 4 ? 0xc8c8d8 : 0xe8e8f8);
            const tx = 16 - Math.sin(H / 16 * Math.PI * 0.8) * 4 * g, ty = 28 - H;
            P.line(tx, ty, tx + 7 * g, ty + 1, 0xc8c8d8);
            if (g < 0.8) { P.disc(tx + 7 * g, ty + 3, 1.3, 0xd8d0a0); return; }
            const sx = tx + 7 + sw * 0.8, sy = ty + 6;
            P.line(tx + 7, ty + 1, sx, sy - 3, 0xe8e8f8);
            for (let k = 0; k < 5; k++) { const a = -Math.PI / 2 + k * Math.PI * 2 / 5; P.poly([[sx + Math.cos(a - 0.5) * 1.4, sy + Math.sin(a - 0.5) * 1.4], [sx + Math.cos(a) * 4.5, sy + Math.sin(a) * 4.5], [sx + Math.cos(a + 0.5) * 1.4, sy + Math.sin(a + 0.5) * 1.4]], 0xfff0a0); }
            P.disc(sx, sy, 1.6, 0xffffff, 1);
            if (ripe) P.spark(sx + [5, -5, 4, -4, 6, -3][f], sy - 4 + (f % 3) * 3, 0xfff8d0);
        } },        puffcap: { seed: 0xffb8d8, draw: (P, f, g, sw, S, M, ripe) => {   // a huddle of pink toadstools, white-spotted, puffing spores when ripe
            [[-5, 9, 4], [4, 12, 5], [0, 6, 3]].forEach(([dx, h, r], k) => {
                const H = h * g, R = r * g, x = 16 + dx, top = 28 - H;
                for (let j = 0; j < H; j++) { P.put(x, 28 - j, 0xf4ead8); if (R > 2) P.put(x + 1, 28 - j, 0xd8c8b8); }
                P.ell(x, top, R + 1, R * 0.7, (xx, yy) => (yy > top + R * 0.3 ? 0xc85a8a : ((xx * 5 + yy * 3) % 7 === 0 ? 0xffffff : yy < top - R * 0.3 ? 0xffd0e8 : 0xffb8d8)));
            });
            if (ripe) for (let k = 0; k < 4; k++) { const y = 14 - ((f + k * 2) % 6) * 2, x = 12 + k * 3 + Math.sin(f + k) * 1.5; P.put(x, y, 0xffe0f0, 1); }
        } },
        twinklegrass: { seed: 0xd8e8ff, draw: (P, f, g, sw, S, M, ripe) => {   // a tuft of blue-silver grass, every blade tipped with a star that twinkles in turn
            for (let k = 0; k < 9; k++) {
                const a = -Math.PI / 2 + (k - 4) * 0.16 + sw * 0.05, L = (10 + (k * 5) % 7) * g, x0 = 13 + k * 0.8;
                let x = x0, y = 28; for (let j = 0; j < L; j++) { x = x0 + Math.cos(a) * j + (j * j) * 0.01 * (k - 4); y = 28 + Math.sin(a) * j; P.put(x, y, j < 3 ? 0x4a6a8a : k % 2 ? 0x8aa8d8 : 0xb8c8e8); }
                if (g > 0.8) (ripe && (k + f) % 3 === 0) ? P.spark(x, y - 1, 0xffffff) : P.put(x, y - 1, ripe ? 0xfff0a0 : 0xd8e8ff, ripe);
            }
        } },
        bubblewort: { seed: 0x9ae8ff, draw: (P, f, g, sw, S, M, ripe) => {   // a rosette of round leaves blowing soap bubbles that drift up and pop
            for (let k = 0; k < 6; k++) { const a = Math.PI + k * Math.PI / 5, r = 6 * g; P.ell(16 + Math.cos(a) * r, 26 + Math.sin(a) * r * 0.5, 2.6 * g + 0.6, 1.6 * g + 0.4, k % 2 ? 0x5aa8a8 : 0x7ac8b8); }
            const H = 9 * g; P.line(16, 27, 16, 27 - H, 0x5aa8a8); P.ell(16, 26 - H, 2, 1.5, 0x9ae8ff);
            if (g < 0.8) return;
            const bubs = ripe ? 4 : 2;
            for (let k = 0; k < bubs; k++) { const t = ((f + k * 1.5) % 6) / 6, x = 16 + Math.sin(t * 6 + k) * 3 + (k - 1.5), y = 22 - H - t * 14, r = 1.4 + t * 1.6; if (t > 0.85) { P.put(x - 1, y, 0xffffff, 1); P.put(x + 1, y, 0xffffff, 1); continue; } P.disc(x, y, r, (xx, yy) => (Math.hypot(xx + 0.5 - x, yy + 0.5 - y) > r * 0.7 ? 0x7ac8f0 : 0xd8f8ff)); P.put(x - r * 0.4, y - r * 0.4, 0xffffff, 1); }
        } },
        pinwheel: { seed: 0xff6a8a, draw: (P, f, g, sw, S, M, ripe) => {   // a stiff stem and a poppy whose four petals turn like a pinwheel in the wind
            const H = 17 * g; P.line(16, 28, 16 + sw * 0.6, 28 - H, 0x4a8a3a); P.ell(13, 24, 2.5, 1, 0x5aaa4a); P.ell(19, 22, 2.5, 1, 0x5aaa4a);
            const cx = 16 + sw * 0.6, cy = 28 - H;
            if (g < 0.8) { P.ell(cx, cy, 1.6, 2.2, 0x8a3a4a); return; }
            const rot = (ripe ? f : 0) / 6 * Math.PI / 2;
            for (let k = 0; k < 4; k++) { const a = rot + k * Math.PI / 2; P.poly([[cx, cy], [cx + Math.cos(a) * 7, cy + Math.sin(a) * 7], [cx + Math.cos(a + 0.9) * 5, cy + Math.sin(a + 0.9) * 5]], k % 2 ? 0xff6a8a : 0xffb83a); P.line(cx, cy, cx + Math.cos(a) * 6, cy + Math.sin(a) * 6, 0xffe0e8); }
            P.disc(cx, cy, 1.2, 0x2a1a2a);
        } },
        emberpepper: { seed: 0xff5a3a, draw: (P, f, g, sw, S, M, ripe) => {   // a bushy pepper plant, its peppers glowing like coals, embers lifting off them
            for (const [dx, dy, r] of [[-4, -7, 4], [4, -8, 4], [0, -12, 4.5]]) P.ell(16 + dx * g, 28 + dy * g, r * g + 0.5, r * g * 0.7 + 0.5, (x, y) => ((x + y) % 4 ? 0x3a7a2a : 0x5a9a3a));
            P.line(16, 28, 16, 28 - 6 * g, 0x3a5a2a);
            if (g < 0.8) return;
            [[-5, -4], [1, -6], [6, -3]].forEach(([dx, dy], k) => { const x = 16 + dx, y = 28 + dy + sw * 0.4; P.poly([[x - 1.4, y], [x + 1.4, y], [x + 0.4, y + 6], [x - 0.2, y + 6.5]], ripe ? ((x2, y2) => (y2 > y + 3 && (f + k) % 2 ? 0xffb03a : 0xff4a2a)) : 0x6a9a3a); P.put(x, y - 1, 0x2a5a1a); });
            if (ripe) for (let k = 0; k < 3; k++) P.put(11 + k * 5 + (f % 2), 18 - ((f + k * 2) % 6) * 2, (f + k) % 2 ? 0xffd060 : 0xff7a3a, 1);
        } },
        eyestalk: { seed: 0x9aff6a, draw: (P, f, g, sw, S, M, ripe) => {   // three wobbly stalks from somewhere else, each with an eye on top: shut buds, then wide open and looking about
            [[-5, 13, -0.3], [1, 18, 0.1], [6, 11, 0.35]].forEach(([dx, h, lean], k) => {
                const H = h * g; let x = 16 + dx, y = 28;
                for (let j = 0; j < H; j++) { x = 16 + dx + lean * j + Math.sin(j * 0.4 + f + k) * 0.5; y = 28 - j; P.put(x, y, j % 3 ? 0x5aaa4a : 0x3a8a3a); }
                if (!ripe) { P.ell(x, y - 1, 1.6, 2, 0x6aba4a); P.line(x - 1, y - 1, x + 1, y - 1, 0x2a5a2a); return; }
                const look = [-1, 0, 1, 1, 0, -1][(f + k * 2) % 6];
                if ((f + k) % 6 === 5) { P.ell(x, y - 2, 2.6, 1, 0x6aba4a); return; }   // a blink
                P.disc(x, y - 2, 2.6, 0xf4f0e8); P.disc(x + look, y - 2, 1.5, 0x9aff6a); P.put(x + look, y - 2, 0x0a0614); P.put(x - 1, y - 3, 0xffffff, 1);
            });
        } },
        galaxygourd: { seed: 0x6a6aff, draw: (P, f, g, sw, S, M, ripe) => {   // a vine along the soil, and a round gourd with a whole galaxy turning slowly inside it
            for (let x = 6; x < 26; x++) P.put(x, 27 + Math.sin(x * 0.6) * 0.8, 0x4a7a3a);
            P.ell(9, 25, 2.4, 1.4, 0x5a9a4a); P.ell(23, 25, 2.4, 1.4, 0x5a9a4a);
            const r = 7 * g, cx = 16, cy = 27 - r;
            P.line(cx, cy - r, cx + 2, cy - r - 2, 0x4a7a3a);
            P.disc(cx, cy, r, (x, y) => { const dx = x + 0.5 - cx, dy = y + 0.5 - cy, d = Math.hypot(dx, dy) / r, a = Math.atan2(dy, dx) - (ripe ? f / 6 * Math.PI : 0); if (d > 0.85) return 0x2a2a6a; if (!ripe || g < 0.8) return (x + y) % 3 ? 0x4a4a9a : 0x3a3a8a; const arm = Math.sin(a * 2 + d * 6); return d < 0.2 ? 0xfff0d0 : arm > 0.6 ? 0xb8a8ff : arm > 0 ? 0x6a6aff : 0x1a1a4a; });
            if (ripe) { P.put(cx - 3, cy + 2, 0xffffff, 1); P.put(cx + 4, cy - 3, 0xffffff, 1); }
        } },
        reedwhistle: { seed: 0xc8a86a, draw: (P, f, g, sw, S, M, ripe) => {   // river reeds with velvet heads; the wind whistles through them, you can see the notes
            [[-5, 15, -0.08], [-1, 20, 0], [3, 17, 0.06], [7, 13, 0.12]].forEach(([dx, h, lean], k) => {
                const H = h * g, x0 = 16 + dx; let x = x0, y = 28;
                for (let j = 0; j < H; j++) { x = x0 + (lean + sw * 0.02) * j; y = 28 - j; P.put(x, y, j < H * 0.5 ? 0x6a8a3a : 0x8aaa4a); }
                if (g >= 0.8) P.ell(x, y + 2, 1.3, 2.6, (xx, yy) => (yy < y + 1 ? 0xa87a4a : 0x7a5030));
            });
            P.line(10, 28, 7, 20, 0x6a8a3a); P.line(22, 28, 25, 21, 0x6a8a3a);
            if (ripe) { const nx = 22 + (f % 3), ny = 10 - (f % 3) * 2; P.put(nx, ny, 0xfff0c0, 1); P.put(nx, ny - 1, 0xfff0c0, 1); P.put(nx, ny - 2, 0xfff0c0, 1); P.put(nx - 1, ny + 1, 0xfff0c0, 1); P.put(nx + 1, ny - 2, 0xfff0c0, 1); }
        } },
        lanternlily: { seed: 0xffe08a, draw: (P, f, g, sw, S, M, ripe) => {   // a lily pad on the soil and one curled bud lifted on a stalk, lit from inside like a paper lantern
            P.ell(16, 27, 9 * g + 1, 2.6, (x, y) => (x > 16 && x < 18 && y < 27 ? -1 : (x + y) % 4 ? 0x3a8a5a : 0x5aaa6a));
            const H = 13 * g; P.line(16, 27, 16 + sw * 0.5, 27 - H, 0x4a8a4a);
            const cx = 16 + sw * 0.5, cy = 25 - H;
            if (g < 0.8) { P.ell(cx, cy, 1.8, 2.6, 0xc8b86a); return; }
            P.ell(cx, cy, 3.6, 4.2, (x, y) => (Math.round(x - cx) % 2 ? 0xffc85a : 0xffe08a));
            P.line(cx - 2, cy - 4, cx + 2, cy - 4, 0x8a5a2a); P.line(cx - 2, cy + 4, cx + 2, cy + 4, 0x8a5a2a);
            if (ripe) { P.disc(cx, cy, 1.4 + (f % 2) * 0.5, 0xfff8d0); P.put(cx, cy, 0xffffff, 1); }
        } },
        coralfan: { seed: 0xff8a9a, draw: (P, f, g, sw, S, M, ripe) => {   // a fan of coral branching out of the soil, its polyps opening when ripe
            const grow = (x, y, a, L, d) => { if (d > 4 || L < 1.5) return; const x2 = x + Math.cos(a) * L * g, y2 = y + Math.sin(a) * L * g; P.line(x, y, x2, y2, d < 2 ? 0xd85a6a : 0xff8a9a); P.line(x + 1, y, x2 + 1, y2, 0xc84a5a); grow(x2, y2, a - 0.45, L * 0.72, d + 1); grow(x2, y2, a + 0.45, L * 0.72, d + 1); if (d === 4 && ripe) P.put(x2, y2 - 1, (Math.round(x2) + f) % 3 ? 0xffe0e8 : 0xffffff, 1); };
            grow(16, 28, -Math.PI / 2 + sw * 0.03, 7, 0);
        } },
        moonmelon: { seed: 0xd8f0a0, draw: (P, f, g, sw, S, M, ripe) => {   // a pale melon on the soil, its stripes crescent moons, a curl of vine and a big leaf
            P.ell(23, 26, 4 * g + 1, 2.4 * g + 0.6, (x, y) => ((x + y) % 3 ? 0x4a8a3a : 0x6aaa4a));
            const rx = 7.5 * g, ry = 5.5 * g, cx = 14, cy = 28 - ry;
            P.ell(cx, cy, rx, ry, (x, y) => { const u = (x + 0.5 - cx) / rx; return Math.abs(Math.sin(u * 4.2)) > 0.85 && (y + 0.5 - cy) / ry < 0.6 ? 0xe8f8d8 : y < cy - ry * 0.4 ? 0xe0f0b0 : 0xb8d880; });
            for (let t = 0; t < 1; t += 0.1) P.put(cx + rx + t * 4, cy - ry + Math.sin(t * 9) * 1.5, 0x4a7a3a);
            if (ripe) { GardenScene._crescent(P, cx - 2, cy - 1, 2, 0.9, -0.6, 0xfffff0); P.put(cx - 3, cy - 2, 0xffffff, 1); if (f % 3 === 0) P.spark(cx + 5, cy - ry - 2, 0xf0ffd0); }
        } },
        starvine: { seed: 0xfff0a0, draw: (P, f, g, sw, S, M, ripe) => {   // a vine winding up a silver stick, star-shaped blossoms opening along it
            const H = 22 * g; P.line(16, 28, 16, 28 - H, 0xa8a8c0);
            const flowers = [];
            for (let j = 0; j < H; j += 0.5) { const x = 16 + Math.sin(j * 0.5) * 2.5, y = 28 - j; P.put(x, y, Math.cos(j * 0.5) > 0 ? 0x5a9a4a : 0x3a6a3a); if (Math.round(j * 2) % 13 === 0 && j > 3) flowers.push([x, y]); }
            flowers.forEach(([x, y], k) => {
                if (g < 0.8) { P.disc(x, y, 1, 0xc8c08a); return; }
                for (let q = 0; q < 5; q++) { const a = -Math.PI / 2 + q * Math.PI * 2 / 5 + (ripe ? f * 0.2 : 0); P.line(x, y, x + Math.cos(a) * 2.4, y + Math.sin(a) * 2.4, 0xfff0a0); }
                P.put(x, y, ripe ? 0xffffff : 0xffd060, ripe);
            });
        } },
        riftroot: { seed: 0xff6ae0, draw: (P, f, g, sw, S, M, ripe) => {   // dark roots prising the soil apart around a little tear in the air, stars on the far side of it
            for (let k = 0; k < 5; k++) { const a = Math.PI + k * Math.PI / 4; let x = 16, y = 26; for (let j = 0; j < 8 * g; j++) { x += Math.cos(a + Math.sin(j * 0.5 + k) * 0.4); y += Math.sin(a) * 0.6 - 0.2; P.put(x, y, 0x3a1a3a); } }
            const ry = 9 * g, rx = (2.4 + (ripe ? Math.abs(sw) * 0.8 : 0)) * g + 0.6, cy = 25 - ry;
            P.ell(16, cy, rx + 1, ry + 1, 0xff6ae0); P.ell(16, cy, rx, ry, (x, y) => ((x * 7 + y * 11 + f) % 9 === 0 ? 0xffffff : (x * 3 + y) % 5 === 0 ? 0x6a3aff : 0x0a0618));
            if (ripe) { P.spark(16 + [4, -4, 5, -5, 3, -3][f], cy - ry * 0.6 + (f % 3) * 3, 0xffb8f0); P.put(16, cy - ry - 1, 0xffd8ff, 1); P.put(16, cy + ry + 1, 0xffd8ff, 1); }
        } },
        bogbean: { seed: 0x8a9a4a, draw: (P, f, g, sw, S, M, ripe) => {   // a fat little plant in a puddle of mud, bean pods hanging fat off it, the mud bubbling
            P.ell(16, 28, 9, 2.2, (x, y) => ((x + y) % 3 ? 0x4a3a1a : 0x5a4a28));
            const b = (f * 3) % 14; P.disc(10 + b, 28, ripe ? 1.2 : 0.8, 0x7a6a3a);
            const H = 11 * g; P.line(16, 28, 16, 28 - H, 0x5a7a2a); P.line(15, 28, 15, 28 - H * 0.8, 0x4a6a2a);
            for (const [dx, dy] of [[-5, -0.8], [5, -0.7], [-3, -1]]) P.ell(16 + dx * g, 28 + dy * H, 3 * g + 0.5, 1.4 * g + 0.4, 0x6a9a3a);
            if (g < 0.8) return;
            [[-4, -0.5], [4, -0.6], [0, -0.9]].forEach(([dx, dy], k) => { const x = 16 + dx, y = 28 + dy * H + sw * 0.3; P.ell(x, y + 2, 1.5, 3, ripe ? 0x9aba5a : 0x6a8a3a); for (let q = 0; q < 3; q++) P.put(x, y + q * 1.6 + 0.5, ripe ? 0xd8f08a : 0x8aaa5a); });
        } },
    };
    // Something just ripened: a burst of sparkles and a chime where it is, then a gold READY badge that
    // bobs over it (and its count) until it's picked. key: which bed or tree; n: how many are ripe there.
    // a field's overlays, baked once (64 x 32, the field in 16px tiles; 'rim' has 5px of glow round it): 'wet', its
    // rounded patch of darker soil; 'rim', a soft gold glow ring round its edge
    _fieldTex(kind) {
        return MenuArt.tex(this, 'gd4_field_' + kind, kind === 'rim' ? 74 : 64, kind === 'rim' ? 42 : 32, P => {
            const W = P.w, H = P.h, pad = kind === 'rim' ? 5 : 0, r = 4;
            const inside = (x, y) => { const dx = Math.max(pad + r - x, 0, x - (W - pad - r - 1)), dy = Math.max(pad + r - y, 0, y - (H - pad - r - 1)); return Math.hypot(dx, dy) - r; };   // < 0 inside the rounded field
            for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
                const d = inside(x, y);
                if (kind === 'wet') { if (d < 0) P.put(x, y, 0x140a04, 0.26); continue; }
                const a = Math.max(0, 1 - Math.abs(d + 0.5) / 4.5); if (a > 0) P.put(x, y, 0xffd060, a * 0.75);
            }
        });
    }
    // ── the Cloud Sea's creatures (32 x 32, 6 frames) ──
    // a puff of cloud with a face: overlapping white lobes shaded blue-grey underneath, a wispy tail, a little trail
    static _skyPuff(P, f) {
        const ph = f / 6 * Math.PI * 2, s = Math.sin(ph), bob = Math.round(s * 0.7);
        for (let k = 0; k < 3; k++) P.disc(26 - k * 2.4 + (f % 2), 16 + bob + Math.sin(ph + k) * 2, 1.6 - k * 0.4, 0xe8f0fa);   // wisps trailing
        const lobes = [[11, 16, 5.5], [16, 12.5, 5], [20, 15.5, 4.6], [15, 19, 5], [8, 13.5, 3.4], [22, 12, 3]];
        for (const [x, y, r] of lobes) P.disc(x, y + bob, r + 0.8, 0x8aa0c0);   // its outline shade
        for (const [x, y, r] of lobes) P.ell(x, y + bob, r, r, (px, py) => (py > y + bob + r * 0.35 ? 0xc8d8ea : py < y + bob - r * 0.4 ? 0xffffff : 0xf2f6fc));
        for (const [x, y] of [[23, 9], [24, 13], [7, 10]]) P.disc(x + s * 0.4, y + bob, 1.4, 0xffffff);   // fluff tufts
        P.disc(10, 15 + bob, 1.5, 0x1a2a4a); P.put(9.5, 14.4 + bob, 0xffffff); P.put(13, 17 + bob, 0xff9ab8); P.line(7, 18 + bob, 9, 18.6 + bob, 0x5a6a8a);   // eye, blush, smile
    }
    // a slim fish with feathered wings beating: o = { body, top, belly, wing: [colours, base to tip], tail, len, wingLen, sun, rainbow }
    static _skyWinged(P, f, o) {
        const ph = f / 6 * Math.PI * 2, s = Math.sin(ph), bob = Math.round(-s * 1.2), cy = 17 + bob, x0 = 16 - o.len / 2, x1 = 16 + o.len / 2;
        const wing = (back) => GardenScene._skyWing(P, 15, cy - 1.5, o.wingLen, s + (back ? 0.35 : 0), o.wing, back, o.rainbow);
        wing(true);
        for (let x = x0; x <= x1; x++) {   // the body, pointed at both ends
            const u = (x - x0) / (x1 - x0), h = 3.6 * Math.sin(Math.min(1, u * 1.15) * Math.PI) + 0.4;
            for (let y = Math.round(cy - h); y <= cy + h; y++) P.put(x, y, y < cy - h * 0.4 ? o.top : y > cy + h * 0.3 ? o.belly : o.body);
        }
        if (o.rainbow) for (let x = x0 + 3; x < x1 - 1; x++) P.put(x, cy, o.wing[Math.floor((x + f) / 2) % o.wing.length]);   // its rainbow stripe
        const tw = s * 2; P.poly([[x1 - 1, cy], [x1 + 5, cy - 4 + tw], [x1 + 3, cy], [x1 + 5, cy + 4 + tw]], o.tail);   // a forked tail
        wing(false);
        P.disc(x0 + 2.5, cy - 0.8, 1.1, 0x0a1430); P.put(x0 + 2, cy - 1.4, 0xffffff);
        if (o.sun) for (let k = 0; k < 4; k++) { const a = k / 4 * Math.PI * 2 + ph * 0.5; P.put(x0 - 2 + Math.cos(a) * 3, cy - 6 + Math.sin(a) * 3, 0xfff0a0, 1); }
        if (o.rainbow) for (let k = 0; k < 4; k++) P.put(x1 + 6 + k * 2, cy + Math.sin(ph + k) * 1.5, o.wing[(k + f) % o.wing.length], 1);
    }
    // a bird's wing from a shoulder at (x, y): long feathers fanned back toward the tail, longest in the middle, each its own
    // line with a gap of sky between, base colour to tip (cols), lifted by beat (-1..1); back: the far wing, darker
    static _skyWing(P, x, y, len, beat, cols, back, rainbow) {
        const n = 7, lift = beat * 0.55;
        for (let k = 0; k < n; k++) {
            const u = k / (n - 1), a = -Math.PI * 0.62 + u * 1.25 - lift, L = len * (0.55 + 0.45 * Math.sin(Math.min(1, u * 1.3) * Math.PI * 0.75));
            for (let j = 1; j < L; j++) {
                const t = j / L, c0 = rainbow ? cols[k % cols.length] : cols[Math.min(cols.length - 1, Math.floor(t * cols.length))], c = back ? MenuArt.mix(c0, 0x2a3a5a, 0.4) : c0;
                P.put(x + Math.cos(a) * j, y + Math.sin(a) * j * (back ? 0.7 : 1), c);
                if (j < L * 0.5) P.put(x + Math.cos(a) * j + 1, y + Math.sin(a) * j * (back ? 0.7 : 1), c);   // thicker near the shoulder
            }
        }
    }
    // a falling raindrop with fins: a clear blue drop, a bright highlight, a little fin and tail, droplets trailing up
    static _skyDrop(P, f) {
        const ph = f / 6 * Math.PI * 2, s = Math.sin(ph), cy = 18 + Math.round(s * 0.6);
        P.poly([[10, cy], [21, cy - 6], [24, cy], [21, cy + 6]], 0x3a8ac8);   // the drop, lying on its side, point to the tail
        P.ell(13.5, cy, 5.5, 5.4, (x, y) => (y < cy - 2 ? 0xc8ecff : y > cy + 2 ? 0x4a9ad8 : 0x8ad0ff));
        P.poly([[19, cy - 4.5], [23.5, cy - 0.5], [19, cy + 4.5]], (x, y) => (y < cy ? 0x8ad0ff : 0x5aa8e8));
        P.poly([[23, cy], [28, cy - 3 + s], [27, cy], [28, cy + 3 + s]], 0xa8e0ff);
        P.line(11, cy - 3, 12.5, cy - 4, 0xffffff); P.put(10.6, cy - 2, 0xffffff);
        P.disc(11, cy + 0.5, 1, 0x0a2a4a); P.put(10.6, cy, 0xffffff);
        for (let k = 0; k < 3; k++) P.disc(27 + k * 1.5, cy - 5 - k * 2 - (f % 3), 0.7, 0xc8ecff);
    }
    // a moon moth: two pairs of soft lilac wings with crescent-moon eyespots, a fluffy white body, feathered antennae
    static _skyMoth(P, f) {
        const ph = f / 6 * Math.PI * 2, s = Math.sin(ph), fl = 0.65 + 0.35 * Math.abs(Math.cos(ph)), cx = 16, cy = 16 + Math.round(s * 0.6);
        for (const side of [-1, 1]) {
            P.ell(cx + side * 6.5 * fl, cy - 3, 6.5 * fl, 5.5, (x, y) => (Math.abs(x - cx) > 11 * fl ? 0x8a7ac8 : y < cy - 6 ? 0xe8e0ff : 0xc8b8f0));   // forewing
            P.ell(cx + side * 5 * fl, cy + 4, 4.6 * fl, 4.2, (x, y) => (y > cy + 6 ? 0x8a7ac8 : 0xb8a8e8));   // hindwing
            const ex = cx + side * 7 * fl, ey = cy - 3; P.disc(ex, ey, 2, 0xfff6d0); P.disc(ex + side * 0.9, ey - 0.4, 1.6, 0xc8b8f0);   // a crescent moon
            P.line(cx + side * 3 * fl, cy + 7, cx + side * 4 * fl, cy + 11 - s, 0xb8a8e8);   // the long tails moon moths have
        }
        P.ell(cx, cy + 0.5, 1.8, 6, (x, y) => ((x + y) % 2 ? 0xffffff : 0xe8e8f8));   // the fluffy body
        for (const side of [-1, 1]) for (let j = 0; j < 5; j++) { const x = cx + side * (1 + j * 0.9), y = cy - 6 - j * 0.9; P.put(x, y, 0xd8c8a0); if (j > 1) P.put(x + side * 0.6, y + 1, 0xd8c8a0); }   // feathered antennae
        P.put(cx - 0.6, cy - 4.4, 0x2a1a4a); P.put(cx + 0.6, cy - 4.4, 0x2a1a4a);
        if (f % 2) P.spark(cx + 9, cy - 9, 0xfff6d0);
    }
    // a little storm cloud jellyfish: a dark grey fluffy bell lit from inside, lightning tentacles flickering down
    static _skyStorm(P, f) {
        const ph = f / 6 * Math.PI * 2, s = Math.sin(ph), cy = 11 + Math.round(s * 0.8), lit = f % 3 === 0;
        for (let k = 0; k < 5; k++) {   // the bolts it trails
            let x = 9 + k * 3.5, y = cy + 4;
            for (let j = 0; j < 4; j++) { const nx = x + (((k + j + f) % 3) - 1) * 1.6, ny = y + 3; P.line(x, y, nx, ny, lit && k % 2 ? 0xffffff : 0xffe060); x = nx; y = ny; }
        }
        for (const [x, y, r] of [[10, cy, 4.2], [16, cy - 2, 5], [22, cy, 4.2], [13, cy + 2, 3.4], [19, cy + 2, 3.4]]) P.disc(x, y, r + 0.8, 0x3a4058);
        for (const [x, y, r] of [[10, cy, 4.2], [16, cy - 2, 5], [22, cy, 4.2], [13, cy + 2, 3.4], [19, cy + 2, 3.4]]) P.ell(x, y, r, r, (px, py) => (py < y - r * 0.4 ? 0x9aa0b8 : lit ? 0xc8c0e8 : 0x6a7088));
        P.disc(16, cy, 2, lit ? 0xffffff : 0xffe060, 1);   // the spark inside
        P.disc(13, cy + 0.5, 0.9, 0x1a1a2a); P.disc(19, cy + 0.5, 0.9, 0x1a1a2a); P.line(15, cy + 2.5, 17, cy + 2.5, 0x1a1a2a);
    }
    // a storm dragon: a long serpent body rippling through the sky, blue-grey scales and a pale belly, a white cloud mane
    // down its back, horns and whiskers on a proud head, lightning crackling off it
    static _skyDragon(P, f) {
        const ph = f / 6 * Math.PI * 2, Y = x => 17 + Math.sin(x * 0.3 - ph) * 3.5 * Math.min(1, (x - 4) / 10 + 0.35);
        for (let x = 30; x >= 8; x--) {
            const y = Y(x), h = x > 25 ? 2.4 - (x - 25) * 0.4 : 2.4;
            for (let d = -h; d <= h; d++) P.put(x, y + d, d > h * 0.35 ? 0xd8e4f0 : (x + Math.round(d)) % 3 === 0 ? 0x3a5078 : 0x5a7aa8);
            if (x % 2 === 0 && x < 28) P.disc(x, y - h - 1, 1.3 + Math.sin(x + ph) * 0.3, 0xffffff);   // the cloud mane
        }
        P.poly([[28, Y(28) - 1], [32, Y(28) - 4], [31, Y(28)], [32, Y(28) + 3]], 0xffffff);   // a cloud tuft at its tail
        const hy = Y(8);   // the head: a broad skull, a long snout, antlers swept back
        P.ell(7, hy - 0.5, 4.5, 3.6, (x, y) => (y > hy + 1.2 ? 0xd8e4f0 : y < hy - 2 ? 0x7a9ac8 : 0x5a7aa8)); P.ell(2.5, hy + 0.6, 3, 2, (x, y) => (y > hy + 1 ? 0xd8e4f0 : 0x6a8ab8));
        P.line(1, hy + 1.6, 5, hy + 1.6, 0x2a3a5a);   // its mouth
        for (const [bx, by, l] of [[8, hy - 3, 6], [6, hy - 3, 5]]) { P.line(bx, by, bx + l, by - l * 0.8, 0xfff0c0); P.line(bx + l * 0.5, by - l * 0.4, bx + l * 0.5 + 1.5, by - l * 0.4 - 2.5, 0xfff0c0); }   // antlers
        P.line(2, hy + 1, 0, hy + 3 + Math.sin(ph) * 1.5, 0xffffff); P.line(3, hy + 1.5, 1, hy + 5 + Math.sin(ph + 1) * 1.5, 0xffffff);   // whiskers
        P.disc(6.5, hy - 1, 1.2, 0xffe060); P.put(6, hy - 1.5, 0xffffff);
        for (const [x, s2] of [[14, 0], [22, 1]]) if ((f + s2) % 3 === 0) { const y = Y(x) - 4; P.line(x, y, x + 1.5, y - 3, 0xffe060); P.line(x + 1.5, y - 3, x, y - 5, 0xffffff); }   // lightning crackling
    }
    // a dawn phoenix koi: a koi of red and gold with fiery wing fins sweeping up and long flowing tail feathers, embers off it
    static _skyPhoenix(P, f) {
        const ph = f / 6 * Math.PI * 2, s = Math.sin(ph), cy = 16 + Math.round(s * 0.7);
        for (let k = 0; k < 3; k++) {   // the tail feathers, streaming
            let x = 20, y = cy;
            for (let j = 0; j < 10; j++) { const nx = x + 1, ny = y + (k - 1) * 0.6 + Math.sin(ph + j * 0.6 + k) * 0.7; P.line(x, y, nx, ny, j > 7 ? 0xfff0a0 : [0xe83a2a, 0xff8a3a, 0xffc040][k]); P.put(nx, ny + 1, j > 6 ? 0xffd860 : 0xc82a1a); x = nx; y = ny; }
        }
        for (const back of [true, false]) {   // flame wings, sweeping
            GardenScene._skyWing(P, 15, cy - 1.5, 12, s + (back ? 0.35 : 0), [0xe8502a, 0xff8a3a, 0xffc040, 0xfff0a0], back);
            if (back) P.ell(14, cy, 7.5, 4, (x, y) => (y < cy - 1.5 ? 0xd83a2a : y > cy + 1.5 ? 0xfff0c8 : (x * 3 + y) % 5 === 0 ? 0xffffff : 0xff8a3a));   // the body, between the wings
        }
        P.disc(8.5, cy - 0.8, 1.1, 0x1a0a0a); P.put(8, cy - 1.3, 0xffffff); P.line(6.5, cy + 1.5, 7.5, cy + 3, 0xffc040);   // eye, a barbel
        for (let k = 0; k < 3; k++) P.put(18 + ((f * 3 + k * 5) % 12), cy - 6 - ((f + k * 2) % 5), [0xffd860, 0xff8a3a, 0xffffff][k], 1);   // embers
    }
    // the ripe bubble's sickle: a fat steel crescent with a dark edge and a shine, a wooden grip with a gold band
    _sickleIcon() {
        return MenuArt.tex(this, 'gd4_sickleicon', 16, 16, P => {
            for (let a = -3.3; a < -0.15; a += 0.03) for (let r = 4.2; r <= 6.6; r += 0.4) { const x = 9 + Math.cos(a) * r, y = 8 + Math.sin(a) * r; P.put(x, y, r > 6.1 || r < 4.6 ? 0x2a2a3a : a > -1.4 && r < 5.4 ? 0xffffff : 0xb8c4d8); }
            for (let i = 0; i < 6; i++) { P.put(3 + i * 0.6, 14 - i, 0x2a1406); P.put(4 + i * 0.6, 14 - i, 0x9a6a30); P.put(5 + i * 0.6, 14 - i, 0x2a1406); }
            P.put(6, 9, 0xd8a838); P.put(7, 9, 0xd8a838); P.put(6, 10, 0xb88828);
        });
    }
    // a tree's fruit for its ripe bubble: a round fruit in its colour, shaded, a leaf and a shine
    _fruitIcon(Tr) {
        return MenuArt.tex(this, 'gd4_fruiticon_' + Tr.id, 16, 16, P => {
            const c = Tr.col, M = MenuArt.mix;
            P.ellipse(8, 9.5, 5.5, 5, M(c, 0x1a0a14, 0.4)); P.ellipse(7.5, 9, 4.8, 4.4, c); P.ellipse(6, 7.5, 1.6, 1.2, M(c, 0xffffff, 0.6)); P.put(5, 7, 0xffffff);
            P.line(8, 4, 9, 2, 0x5a3a20); P.ellipse(11, 3, 2.4, 1.2, 0x5aba48); P.put(10, 3, 0x8ada6a);
        });
    }
    _ripeMark(key, n, x, y, z, col, icon = null) {   // icon: a texture for the bubble (the sickle when none)
        const was = (this._ripeWas ||= {})[key]; this._ripeWas[key] = n;
        if (!n) return;
        const T = this.T;
        if (was !== undefined && n > was) {
            const sp = this.add.particles(0, 0, 'mn_px2', { x, y: y + T * 0.6, lifespan: 900, speed: { min: 60, max: 200 }, angle: { min: 200, max: 340 }, gravityY: 160, scale: { start: 2.6, end: 0 }, tint: [col, 0xffffff, 0xffe08a], blendMode: 'ADD', emitting: false }).setDepth(6060);
            sp.explode(40); this.time.delayedCall(1000, () => sp.destroy());
            const ring = this.add.circle(x, y + T * 0.6, T * 0.5).setStrokeStyle(3, 0xffe08a).setDepth(6060);
            this.tweens.add({ targets: ring, scale: 4, alpha: 0, duration: 650, ease: 'Cubic.easeOut', onComplete: () => ring.destroy() });
            Sfx.play(this, 'e_quality'); this.time.delayedCall(140, () => Sfx.play(this, 'pickup'));
            this._float(x, y - T * 0.3, 'RIPE!', '#ffe08a');
        }
        // the marker: a big round bubble bobbing over it, a gold sickle (or the fruit) inside, a tail pointing down, a ring pulsing out
        const R = T * 0.62, c = this.add.container(x, y - T * 0.4).setDepth(z + T * 3), g = this.add.graphics();
        g.fillStyle(0x000000, 0.35); g.fillCircle(3, 5, R); g.fillTriangle(-R * 0.35 + 3, R * 0.75 + 5, R * 0.35 + 3, R * 0.75 + 5, 3, R * 1.45 + 5);
        g.fillStyle(0xfff6dc, 1); g.fillCircle(0, 0, R); g.fillTriangle(-R * 0.35, R * 0.75, R * 0.35, R * 0.75, 0, R * 1.45);
        g.fillStyle(MenuArt.mix(col, 0xfff6dc, 0.7), 1); g.fillCircle(0, 2, R * 0.8);
        g.lineStyle(Math.max(3, T / 14), 0xd8a030, 1); g.strokeCircle(0, 0, R); g.fillStyle(0xffffff, 0.6); g.fillEllipse(-R * 0.35, -R * 0.45, R * 0.5, R * 0.25);
        const ic = this.add.image(0, 0, icon || this._sickleIcon()).setScale(R * 1.25 / 16);
        
        const glow = this.add.image(0, 0, 'mn_glow').setTint(0xffe08a).setBlendMode(Phaser.BlendModes.ADD).setDisplaySize(R * 4.2, R * 4.2).setAlpha(0.5);
        c.add([glow, g, ic]);
        const pulse = this.add.circle(x, y - T * 0.4, R).setStrokeStyle(4, 0xffe08a, 1).setDepth(z + T * 3 - 0.1);
        this.tweens.add({ targets: pulse, scale: 2.1, alpha: 0, duration: 1300, repeat: -1, ease: 'Cubic.easeOut' });
        this.tweens.add({ targets: c, y: y - T * 0.4 - T * 0.18, duration: 700, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
        this.tweens.add({ targets: glow, alpha: 0.2, duration: 900, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
        this.tweens.add({ targets: ic, angle: 12, duration: 500, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
        this._crops.push(c, pulse);
    }
    _drawCrops() {
        // rebuilt only when something shows differently (a stage, water, worms, fertilizer, ripeness, a tree's fruit):
        // rebuilding every second restarted every crop's sway mid-swing, a visible hitch once a second
        const s = Garden.state(), T = this.T, now = Date.now(), os = Garden.orchard();
        const sig = JSON.stringify([GardenScene.BEDS, s.plots.map(p => p && [p.fert, Garden.infested(p, now), (p.cells || []).map(c => c && [c.seed, Garden.watered(c) ? Math.min(4, Math.floor(Garden.growth(c, now, s).f * 4)) : -1])]),
            os.orchard.map(p => p.tree ? Garden.treeState(p, now).stage : 0)]);
        if (sig === this._cropSig && this._crops.length && this._crops.every(o => o.active)) { this._drawOrchard(); return; }
        this._cropSig = sig;
        for (const o of this._crops) { this.tweens.killTweensOf(o); o.destroy(); }
        this._crops = []; this._badges = [];
        GardenScene.BEDS.forEach(([bx, by], k) => {
            const p = s.plots[k];
            if (!p) {   // overgrown: weeds and long grass over its mounds
                const wg = this.add.graphics().setDepth(this._py(by + 2) - 1), R = MenuArt.rng(k * 31 + 7);
                for (let i = 0; i < 8; i++) { const [cx, cy] = this._cellXY(k, i); for (let b = 0; b < 7; b++) { const x = cx + (R() - 0.5) * T * 0.8, h = T * (0.2 + R() * 0.35), lean = (R() - 0.5) * T * 0.25; wg.lineStyle(Math.max(2, T / 20), [0x3a6a2a, 0x4a8a3a, 0x6aa848, 0x8a9a3a][b % 4], 1); wg.lineBetween(x, cy, x + lean, cy - h); } if (R() < 0.3) { wg.fillStyle(0xd8c84a, 1); wg.fillCircle(cx + (R() - 0.5) * T * 0.5, cy - T * 0.3, T / 16); } }
                this._crops.push(wg);
                this._crops.push(this.add.text(this._px(bx + 2), this._py(by + 1), 'overgrown', { fontSize: '11px', fontFamily: 'monospace', fontStyle: 'bold', color: '#d8d0e8', backgroundColor: '#0a0618aa', padding: { x: 4, y: 2 } }).setOrigin(0.5).setDepth(this._py(by + 2))); return; }
            const b = Garden.bed(p, Date.now(), s);
            if (!b.n) return;
            if (Garden.infested(p)) for (let w = 0; w < 4; w++) {   // worms poking out of the soil, wiggling
                const W2 = Garden.WORMS[w % 4], ik = this._wormTex(W2), [wx, wy] = this._cellXY(k, [0, 6, 3, 5][w]);   // out of a mound
                const ws = this.add.sprite(wx, wy, ik, '0').setOrigin(0.5, 1).setScale(T / 32 * 0.7).setDepth(this._py(by + 2) + 0.5).play(ik);
                this.tweens.add({ targets: ws, scaleY: { from: T / 32 * 0.2, to: T / 32 * 0.75 }, duration: 600 + w * 170, yoyo: true, repeat: -1, ease: 'Sine.easeInOut', delay: w * 300 });
                this._crops.push(ws);
            }
            if (b.dry) {
                const dx = this._px(bx + 2), dy = this._py(by) - T * 0.15, drop = this.add.image(dx, dy, this._dropTex()).setScale(T / 16 * 0.9).setDepth(this._py(by + 2) + 1);
                this.tweens.add({ targets: drop, y: dy - T * 0.2, duration: 700, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
                this._crops.push(drop);
            }
            const spr0 = (this._cropSpr ||= {})[k] = {}, wn = p.cells.filter(c => c && Garden.watered(c)).length;
            if (wn) this._crops.push(this.add.image(this._px(bx), this._py(by), this._fieldTex('wet')).setOrigin(0).setDisplaySize(4 * T, 2 * T).setAlpha(Math.min(1, wn / Math.max(1, b.n))).setDepth(0.6));   // (a baked image: a Graphics re-tessellates every frame)   // watered: the whole field a shade darker
            p.cells.forEach((cell, i) => {   // every plant where it landed (_paintGround's tilled field), crowding its neighbours
                if (!cell) return;
                const S = Garden.seed(cell.seed), g = Garden.watered(cell) ? Garden.growth(cell, Date.now(), s) : { f: 0 }, st = g.f >= 1 ? 4 : Math.min(3, Math.floor(g.f * 4)), ik = this._cropTex(S, st, true);
                const k16 = T / 16, [x, y] = this._cellXY(k, i, cell);
                const spr = this.add.sprite(x, y, ik, '0').setOrigin(0.5, 0.94).setScale(k16 * (st === 4 ? 0.56 : 0.48)).setDepth(y);
                if (st === 4) spr.play(ik);
                this.tweens.add({ targets: spr, angle: { from: -3, to: 3 }, duration: 1500 + (i * 137) % 600, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
                this._crops.push(spr); spr0[i] = spr;
            });
            const rc = Garden.seed(p.cells.find(c => c && Garden.watered(c) && Garden.growth(c).f >= 1)?.seed || p.cells.find(c => c).seed).col;
            this._ripeMark('bed' + k, b.ripe, this._px(bx + 2), this._py(by) - T * 0.5, this._py(by + 2) + 2, rc);
            if (b.ripe) {   // ripe: the field itself changes. Its rim glows gold, golden motes rise off the crops, the ripe ones bounce
                const x0 = this._px(bx), y0 = this._py(by), share = b.ripe / Math.max(1, b.n);
                const pad = T * 0.3, rim = this.add.image(x0 - pad, y0 - pad, this._fieldTex('rim')).setOrigin(0).setDisplaySize(4 * T + pad * 2, 2 * T + pad * 2).setBlendMode(Phaser.BlendModes.ADD).setDepth(0.62);   // baked, like the wet soil
                const warm = this.add.image(x0, y0, this._fieldTex('wet')).setOrigin(0).setDisplaySize(4 * T, 2 * T).setTint(0xffe08a).setBlendMode(Phaser.BlendModes.ADD).setAlpha(0.35 * share).setDepth(0.61); this._crops.push(warm);
                this.tweens.add({ targets: rim, alpha: 0.45, duration: 800, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
                const motes = this.add.particles(0, 0, 'mn_px2', { x: { min: x0, max: x0 + 4 * T }, y: { min: y0, max: y0 + 2 * T }, lifespan: 1400, speedY: { min: -40, max: -15 }, speedX: { min: -6, max: 6 },
                    scale: { start: 1.8, end: 0 }, alpha: { start: 1, end: 0 }, tint: [0xffe08a, 0xffffff, rc], blendMode: 'ADD', frequency: Math.max(30, 140 - b.ripe * 5) }).setDepth(y0 + 2 * T + 1);
                this._crops.push(rim, motes);
                p.cells.forEach((c, i) => { const sp = spr0[i]; if (sp && c && Garden.watered(c) && Garden.growth(c).f >= 1) this.tweens.add({ targets: sp, scaleY: sp.scaleY * 1.08, y: sp.y - 2, duration: 420 + (i * 53) % 300, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' }); });
            }
            if (p.fert) {   // fertilized: the sack at the field's front corner (clear of the crops and the READY badge), a gold badge, a little glow
                const fx = this._px(bx) + T * 0.1, fy = this._py(by + 2) + T * 0.15, z = this._py(by + 2) + T;
                const gl = this.add.image(fx, fy, 'mn_glow').setTint(0xffd060).setBlendMode(Phaser.BlendModes.ADD).setDisplaySize(T * 1.4, T * 1.4).setAlpha(0.45).setDepth(z);
                this.tweens.add({ targets: gl, alpha: 0.2, duration: 900, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
                const sack = this.add.image(fx, fy, this._fertTex()).setScale(T / 16 * 0.85).setDepth(z + 0.1);
                this.tweens.add({ targets: sack, y: fy - 3, duration: 900, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
                const badge = this.add.text(fx + T * 0.45, fy, `x2 · ${p.fertN ?? Garden.FIELD} left`, { fontSize: `${Math.max(12, Math.round(T * 0.26))}px`, fontFamily: UIKit.FONT.title, fontStyle: 'bold', color: '#ffe08a', stroke: '#2a1a08', strokeThickness: 4 }).setOrigin(0, 0.5).setDepth(z + 0.2);
                this._crops.push(gl, sack, badge);
            }
        });
        this._drawOrchard();
        GardenScene.ORCHARD.forEach(([ox, oy], i) => { const p = os.orchard[i], st = p?.tree && Garden.treeState(p); this._ripeMark('tree' + i, st?.ripe ? 1 : 0, this._px(ox + 1.5), this._py(oy) - T * 3.4, this._py(oy + 1) + 2, st?.T.col, st?.ripe ? this._fruitIcon(st.T) : null); });
    }

    // ── THE ORCHARD ───────────────────────────────────────────────────────────
    // Four plots in Starfall Grove, south of the river. A tree grows from a sapling (stage 0) through a young
    // tree (1) to grown (2), then bears its fruit (3) again and again. Redrawn only when a stage changes.
    _drawOrchard() {
        const s = Garden.orchard(), T = this.T, k = T / 16, now = Date.now();
        const sig = JSON.stringify(GardenScene.ORCHARD) + s.orchard.map(p => p.tree ? p.tree + Garden.treeState(p, now).stage : '-').join();
        if (sig === this._orchSig && this._orch?.length && this._orch[0].active) return;
        this._orchPlots = s.orchard; this._orchSig = sig; for (const o of this._orch || []) { this.tweens.killTweensOf(o); o.destroy(); } this._orch = [];
        const plot = MenuArt.tex(this, 'gd6_plot', 48, 16, P => {   // dark starlit soil in a ring of pale stones
            for (let y = 0; y < 16; y++) for (let x = 0; x < 48; x++) {
                const e = ((x - 23.5) / 22) ** 2 + ((y - 8) / 6.5) ** 2;
                if (e > 1) continue;
                P.put(x, y, e > 0.72 ? ((Math.floor(Math.atan2(y - 8, (x - 23.5) / 3) * 4) & 1) ? 0xc8c0d8 : 0x8a84a0) : (x * 7 + y * 13) % 19 === 0 ? 0x8a6ad8 : (x + y) % 3 ? 0x2a1a30 : 0x3a2440);
            }
        });
        GardenScene.ORCHARD.forEach(([ox, oy], i) => {
            const reg = this._reg['ORCHARD' + i] = [], add = o => { this._orch.push(o); reg.push(o); return o; };
            const x = this._px(ox + 1.5), y = this._py(oy + 1) - T * 0.3;
            const p = s.orchard[i];
            add(this.add.image(x, this._py(oy) + T * 0.55, plot).setScale(k).setDepth(this._py(oy))).setTint(p ? 0xffffff : 0x5a6a4a);
            if (!p) { add(this.add.text(x, this._py(oy) + T * 0.5, 'overgrown', { fontSize: '11px', fontFamily: 'monospace', fontStyle: 'bold', color: '#d8d0e8', backgroundColor: '#0a0618aa', padding: { x: 4, y: 2 } }).setOrigin(0.5).setDepth(this._py(oy) + 1)); return; }
            if (!p.tree) return;
            const st = Garden.treeState(p, now), ik = this._treeTex(st.T, st.stage);
            if (st.stage >= 2) {
                const gl = add(this.add.image(x, y - T * 2, 'mn_glow').setTint(st.T.col).setBlendMode(Phaser.BlendModes.ADD).setDisplaySize(T * 4.5, T * 4.5).setAlpha(st.stage === 3 ? 0.5 : 0.22).setDepth(y - 1));
                this.tweens.add({ targets: gl, alpha: st.stage === 3 ? 0.25 : 0.12, duration: 1400 + i * 150, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
            }
            add(this.add.sprite(x, y, ik, '0').setOrigin(0.5, 1).setScale(k).setDepth(y)).play(ik);
            if (st.stage === 3) add(this.add.particles(0, 0, 'mn_px2', { x: { min: x - T * 1.4, max: x + T * 1.4 }, y: { min: y - T * 3, max: y - T }, lifespan: 1800, speedY: { min: -12, max: -4 }, scale: { start: 1.8, end: 0 }, tint: [st.T.col, 0xffffff], blendMode: 'ADD', frequency: 260 }).setDepth(y + 1));
        });
    }
    _treeTex(Tr, st) {
        const art = GardenScene.TREE_ART[Tr.id];
        return this._sheet(`gd6_tree_${Tr.id}_${st}`, 6, (P, f) => {
            const sw = Math.sin(f / 6 * Math.PI * 2);
            if (st === 0) {   // a sapling: a thin stem, two leaves of the tree's colour, a glint of what it'll be
                for (let j = 0; j < 9; j++) P.put(28 + Math.sin(j * 0.4) * 0.6, 53 - j, 0x5a4a3a);
                P.ell(25 + sw * 0.4, 45, 2.6, 1.3, art.leaf); P.ell(31 + sw * 0.4, 46, 2.6, 1.3, art.leaf);
                P.put(28, 43, Tr.col, 1); if (f % 3 === 0) P.spark(28, 40, 0xffffff);
                return;
            }
            art.draw(P, f, st === 1 ? 0.6 : 1, sw, MenuArt.mix, st === 3, Tr);
        }, 5, 56);
    }
    // a trunk from (x, y) up h pixels, w0 wide at the foot to w1 at the top, leaning `bend` by the top; its top point
    static _trunk(P, x, y, h, w0, w1, c, c2, bend = 0) {
        for (let j = 0; j <= h; j++) {
            const u = j / Math.max(1, h), w = w0 + (w1 - w0) * u, cx = x + bend * u * u;
            for (let dx = -w; dx <= w; dx++) P.put(cx + dx, y - j, dx > w * 0.3 ? c2 : (j * 3 + Math.round(dx) * 5) % 11 === 0 ? c2 : c);
        }
        return [x + bend, y - h];
    }
    // a crescent: the disc at (x, y) less the same disc nudged by (dx, dy)
    static _crescent(P, x, y, r, dx, dy, c) { for (let yy = Math.floor(y - r); yy <= y + r; yy++) for (let xx = Math.floor(x - r); xx <= x + r; xx++) if (Math.hypot(xx + 0.5 - x, yy + 0.5 - y) <= r && Math.hypot(xx + 0.5 - x - dx, yy + 0.5 - y - dy) > r) P.put(xx, yy, c); }
    static TREE_ART = {
        lumenwillow: { leaf: 0x6ad8c8, draw: (P, f, g, sw, M, fruit) => {   // a willow of light: a dark dome, strands of glow hanging off it, swaying in turn, dew-beads of light at their ends
            const [tx, ty] = GardenScene._trunk(P, 28, 53, 22 * g, 1 + 3 * g, 1.5, 0x2a4a5a, 0x1a2a3a, 3 * g), ph = f / 6 * Math.PI * 2;
            P.ell(tx, ty - 1, 14 * g, 10 * g, (x, y) => (y < ty - 6 * g ? 0x4a9a90 : (x * 3 + y * 5) % 7 === 0 ? 0x2a7a70 : y > ty + 3 * g ? 0x144a4a : 0x1a5a5a));
            for (let k = 0; k <= 13; k++) {
                const u = k / 13 * 2 - 1, sx = tx + u * 13 * g, sy = ty - 1 + 10 * g * Math.sqrt(Math.max(0, 1 - u * u)) * 0.85, L = (7 + 11 * (1 - Math.abs(u)) + (k * 7) % 4) * g;
                let x = sx, y = sy;
                for (let j = 0; j < L; j++) { x = sx + Math.sin(j * 0.25 - ph + k) * (j / L) * 1.6; y = sy + j; P.put(x, y, j % 4 ? 0x6ad8c8 : 0x3aa8a0); }
                if (fruit && k % 2 === 0) { P.put(x, y + 1, 0x9affe8, 1); P.put(x, y + 2, 0xffffff, 1); if ((k + f) % 4 === 0) P.spark(x, y + 2, 0xd8fff8); }
            }
        } },
        orreryoak: { leaf: 0x4a4a9a, draw: (P, f, g, sw, M, fruit) => {   // an oak like a night sky, and the little planets that are its fruit orbiting it on their rings
            const [tx, ty] = GardenScene._trunk(P, 28, 53, 18 * g, 1.5 + 3 * g, 2.5 * g, 0x5a3a5a, 0x3a2440);
            P.line(tx, ty + 6, tx - 8 * g, ty + 1, 0x5a3a5a); P.line(tx, ty + 5, tx + 8 * g, ty, 0x5a3a5a);
            const leaf = (x, y) => (x * 13 + y * 7) % 31 === 0 ? 0xfff0c0 : (x * 3 + y * 5) % 7 === 0 ? 0x4a4a9a : y < ty - 6 * g ? 0x3a3a82 : 0x2a2a6a;
            P.ell(tx - 7 * g, ty - 2, 9 * g, 7 * g, leaf); P.ell(tx + 7 * g, ty - 1, 9 * g, 7 * g, leaf); P.ell(tx, ty - 7 * g, 10 * g, 8 * g, leaf);
            if (!fruit) return;
            const cy = ty - 3, ph = f / 6 * Math.PI * 2;
            for (let a = 0; a < Math.PI * 2; a += 0.14) if (Math.round(a / 0.14) % 2) P.put(tx + Math.cos(a) * 21, cy + Math.sin(a) * 6, 0xffe0a0, 1);
            [[0xffc85a, 2.6], [0x6ad8c8, 2], [0xff9ad8, 1.8]].forEach(([c, r], k) => {
                const a = ph + k * Math.PI * 2 / 3, px = tx + Math.cos(a) * 21, py = cy + Math.sin(a) * 6, far = Math.sin(a) < 0;
                P.disc(px, py, far ? r * 0.75 : r, far ? M(c, 0x1a1030, 0.35) : c);
                if (k === 0) P.line(px - 4, py + 1, px + 4, py - 1, 0xfff0c0);   // the ringed one
                P.put(px - 0.6, py - 0.8, 0xffffff, 1);
            });
        } },
        bubblebark: { leaf: 0x9ad8ff, draw: (P, f, g, sw, M, fruit) => {   // a tree blown out of soap bubbles: a column of them, a crown of them, iridescent pods that pop and come back
            const bub = (x, y, r, tint = 0xd8f4ff) => P.disc(x, y, r, (xx, yy) => { const d = Math.hypot(xx + 0.5 - x, yy + 0.5 - y) / r; return d > 0.75 ? 0x7ac8f0 : xx < x - r * 0.2 && yy < y - r * 0.2 && d > 0.35 ? 0xffffff : tint; });
            let tx = 28, ty = 53;
            for (let j = 0; j < 7; j++) { tx = 28 + Math.sin(j * 0.9 + sw * 0.3) * 1.2; ty = 51 - j * 3.4 * g; bub(tx, ty, (2.8 - j * 0.15) * Math.max(0.7, g)); }
            [[0, -9, 6], [-8, -5, 5], [8, -6, 5], [-5, -14, 4.5], [5, -15, 4.5], [-12, -11, 3.5], [12, -12, 3.5], [0, -20, 3.5]].forEach(([dx, dy, r], k) => bub(tx + dx * g, ty + dy * g + Math.sin(f / 6 * Math.PI * 2 + k) * 0.6, r * g, k % 3 ? 0xd8f4ff : 0xe8e0ff));
            if (!fruit) return;
            const cols = [0xff9ad8, 0x9affe8, 0xfff08a, 0xb8a8ff];
            for (let k = 0; k < 4; k++) {
                const px = tx - 10 + k * 7, py = ty + 2 + (k % 2) * 3;
                P.line(px, py - 4, px, py - 2, 0x7ac8f0);
                if (k === f % 4 && f > 1) { for (const [dx, dy] of [[-2, -2], [2, -2], [-2, 2], [2, 2], [0, -3], [0, 3]]) P.put(px + dx, py + dy, 0xffffff, 1); continue; }   // pop!
                bub(px, py, 2, cols[(k + f) % 4]);
            }
        } },
        moonpeach: { leaf: 0x8a7ab8, draw: (P, f, g, sw, M, fruit) => {   // two silver trunks twisted round each other, a soft lilac crown, peaches shaped like the crescent moon
            const h = 20 * g, w = 1 + 1.8 * g, [tx, ty] = GardenScene._trunk(P, 28, 53, h, w, 1.2, 0xb8b8d0, 0x8a8aa8);
            for (let j = 1; j < h; j++) P.put(28 + Math.sin(j * 0.45) * w * 0.9, 53 - j, Math.cos(j * 0.45) > 0 ? 0xe8e8f8 : 0x6a6a88);   // the twist in its bark
            P.ell(tx, ty - 4 * g, 15 * g, 9 * g, (x, y) => (y < ty - 9 * g ? 0xa89ad0 : (x * 5 + y * 3) % 9 === 0 ? 0xb8a8e0 : y > ty ? 0x6a5a98 : 0x8a7ab8));
            if (!fruit) return;
            [[-9, 1], [-3, 4], [4, 3], [10, 0], [0, -6]].forEach(([dx, dy], k) => {
                const x = tx + dx, y = ty + dy + Math.sin(f / 6 * Math.PI * 2 + k) * 0.6;
                GardenScene._crescent(P, x, y, 3.4, 1.6, -1, 0xfff0d8); P.put(x - 2, y + 0.8, 0xffa8b8); P.put(x - 2.4, y, 0xffa8b8); P.put(x - 2, y - 1, 0xffffff, 1);
            });
        } },
        jellyfruit: { leaf: 0xff9ad8, draw: (P, f, g, sw, M, fruit) => {   // a jellyfish of a tree: a wobbling pink cap on a crooked stem, tendrils trailing, jelly fruit bobbing on their ends
            const [tx, ty] = GardenScene._trunk(P, 28, 53, 16 * g, 1 + 2 * g, 1.5, 0x6a4a6a, 0x4a2a4a, -2 * g), ph = f / 6 * Math.PI * 2, rx = (17 + sw * 0.8) * g, ry = (10 - sw * 0.6) * g;
            for (let k = 0; k < 7; k++) { const bx = tx - rx * 0.8 + k * rx * 1.6 / 6; for (let j = 0; j < 8 * g + (k % 3) * 2; j++) P.put(bx + Math.sin(j * 0.5 - ph + k) * 0.9, ty + j, j % 3 ? 0xd87ab8 : 0xffb8e0); }
            P.ell(tx, ty, rx, ry, (x, y) => (y > ty ? -1 : ((x - tx) * 2 + y * 3) % 9 === 0 ? 0xffd8f0 : y < ty - ry * 0.6 ? 0xffb8e0 : 0xff9ad8));
            for (let x = Math.ceil(tx - rx); x <= tx + rx; x++) P.put(x, ty + ((x + f) % 2), 0xd87ab8);
            if (!fruit) return;
            for (let k = 0; k < 4; k++) { const bx = tx - rx * 0.6 + k * rx * 1.2 / 3, by = ty + 10 * g + (k % 2) * 3 + Math.sin(ph + k) * 1; P.ell(bx, by, 2.6, 2, (x, y) => (y < by ? 0xffc8e8 : 0xff7ac8)); P.put(bx, by, 0xffffff, 1); }
        } },
        cometbirch: { leaf: 0x6ab8e8, draw: (P, f, g, sw, M, fruit) => {   // a tall white birch, scarred black, a few blue leaves, and comets, streaking in place, where fruit should be
            const [tx, ty] = GardenScene._trunk(P, 28, 53, 32 * g, 1 + 1.4 * g, 0.8, 0xe8e8f0, 0xb8b8c8, 1);
            for (let j = 2; j < 32 * g; j += 4) P.put(27 + (j % 3), 53 - j, 0x2a2a3a);
            const tips = [[-10, 22], [9, 20], [-7, 28], [8, 27], [0, 32]].map(([dx, j]) => { const by = 53 - j * g, bx = 28 + dx * g; P.line(28, by + 3, bx, by, 0xd8d8e0); P.ell(bx, by - 1, 3.5 * g, 2.2 * g, (x, y) => ((x + y) % 3 ? 0x6ab8e8 : 0x9ad8ff)); return [bx, by]; });
            if (!fruit) return;
            tips.slice(0, 4).forEach(([bx, by], k) => {
                const hx = bx + (k % 2 ? 2 : -2), hy = by + 3;
                for (let j = 1; j < 7; j++) P.put(hx - j * 0.8 * (k % 2 ? -1 : 1), hy - j * 0.6 + ((j + f) % 3 === 0 ? 0.5 : 0), j < 3 ? 0x9ad8ff : 0x4a7ac8, j < 4);
                P.disc(hx, hy, 1.4, 0xffffff); P.put(hx, hy, 0xffffff, 1);
            });
            P.spark(tx + [3, -4, 5, -2, 2, -5][f], ty + 2 + (f % 3), 0xd8f0ff);
        } },
        prismwood: { leaf: 0x9ad0f0, draw: (P, f, g, sw, M, fruit) => {   // a tree of crystal: a faceted column, a crown of prisms, rainbow shards hanging in it
            const h = 22 * g, w = 1 + 2.4 * g;
            P.poly([[28 - w, 53], [28 - w * 0.6, 53 - h], [28, 53 - h - 2], [28, 53]], 0xd8f0ff); P.poly([[28, 53], [28, 53 - h - 2], [28 + w * 0.6, 53 - h], [28 + w, 53]], 0x8ab8d8);
            const tx = 28, ty = 53 - h;
            [[0, -10, 7, 0], [-9, -4, 6, 1], [9, -5, 6, 2], [-5, -15, 5, 1], [6, -14, 5, 0], [-13, -11, 4, 2], [13, -11, 4, 1]].forEach(([dx, dy, r, c]) => {
                const x = tx + dx * g, y = ty + dy * g, R = r * g;
                P.poly([[x - R, y + R * 0.6], [x, y - R], [x + R, y + R * 0.6]], [0xc8f0ff, 0x9ad0f0, 0xe8f8ff][c]); P.line(x, y - R + 1, x - R * 0.4, y + R * 0.4, 0xffffff);
            });
            if (!fruit) return;
            const sp = [0xff6a6a, 0xffd06a, 0x8aff8a, 0x6ad8ff, 0xb07aff];
            [[-8, 3], [-2, 5], [4, 4], [10, 2], [0, -6]].forEach(([dx, dy], k) => { const x = tx + dx, y = ty + dy, c = sp[(k + f) % 5]; P.poly([[x, y - 2.5], [x + 1.5, y], [x, y + 2.5], [x - 1.5, y]], c); P.put(x, y, 0xffffff, 1); });
            if (f % 2) P.spark(tx + (f % 3) * 6 - 6, ty - 12, 0xffffff);
        } },
        spiralgourd: { leaf: 0x6a9a3a, draw: (P, f, g, sw, M, fruit) => {   // a corkscrew trunk curling into a spiral at the top, vines out to each side, glowing lantern gourds hanging off them
            const h = 26 * g;
            for (let j = 0; j <= h; j++) { const a = j * 0.4, x = 28 + Math.sin(a) * 3 * g * (1 - j / h * 0.4); for (let d = -1; d <= 1; d++) P.put(x + d, 53 - j, Math.cos(a) > 0 ? (d > 0 ? 0x4a6a2a : 0x6a8a3a) : 0x3a5a2a); }
            const tx = 28, ty = 53 - h;
            for (let t = 0; t < 14; t += 0.2) { const r = 6 * g * (1 - t / 15); P.put(tx + Math.cos(t * 0.9) * r, ty - 5 * g + Math.sin(t * 0.9) * r, 0x6a8a3a); }
            const hooks = [];
            for (const s of [-1, 1]) for (let t = 0; t <= 1; t += 0.04) { const x = tx + s * t * 16 * g, y = ty + 6 - Math.sin(t * Math.PI) * 6 * g; P.put(x, y, 0x5a7a2a); if (Math.round(t * 25) % 6 === 0) { P.ell(x, y - 1.5, 1.8, 1.1, 0x8aba4a); hooks.push([x, y]); } }
            if (!fruit) return;
            hooks.slice(0, 6).forEach(([x, y], k) => { const gx = x + sw * 0.8 * (k % 2 ? 1 : -1), gy = y + 5; P.line(x, y, gx, gy - 3, 0x3a5a2a); P.ell(gx, gy, 2.4, 3.2, (xx, yy) => (Math.round(xx - gx) === 0 ? 0xffd08a : (Math.round(xx - gx) % 2 ? 0xd86a2a : 0xff9a3a))); P.put(gx, gy, 0xfff0a0, 1); P.put(gx, gy - 3.5, 0x3a5a2a); });
        } },
        voidpine: { leaf: 0x3a1a5a, draw: (P, f, g, sw, M, fruit) => {   // a pine cut out of the night: tiers of black needles with stars caught inside, violet cones glowing at the tips
            GardenScene._trunk(P, 28, 53, 6, 2, 1.5, 0x2a1a2a, 0x1a0a1a);
            const tiers = [[47, 14, 10], [40, 11.5, 9], [33, 9, 8], [26, 6.5, 7]].map(([y, w, hh]) => [53 - (53 - y) * g, w * g, hh * g]);
            for (const [by, w, hh] of tiers) P.poly([[28 - w, by], [28, by - hh - 3], [28 + w, by]], (x, y) => ((x * 7 + y * 13) % 23 === 0 ? (((x + y + f) % 3) ? 0xd8a8ff : 0xffffff) : Math.abs(x - 28) > w * 0.75 * (by - y) / (hh + 3) + 2 ? 0x3a1a5a : 0x1a0a2a));
            if (!fruit) return;
            tiers.forEach(([by, w], k) => { for (const s of [-1, 1]) { const x = 28 + s * (w - 1.5), y = by + 1.5 + Math.sin(f / 6 * Math.PI * 2 + k + s) * 0.5; P.ell(x, y, 1.3, 2, 0x8a4ae0); P.put(x, y - 0.5, 0xd8a8ff, 1); } });
            P.spark(28, 53 - 30 * g, [0xffffff, 0xd8a8ff][f % 2]);
        } },
        nebulapalm: { leaf: 0xd87ab8, draw: (P, f, g, sw, M, fruit) => {   // a ringed, curving palm with fronds of coloured gas, nebula nuts clustered under them, swirling
            const h = 28 * g;
            for (let j = 0; j <= h; j++) { const x = 28 + (j / h) ** 2 * 6 * g; for (let d = -1.5; d <= 1.5; d++) P.put(x + d, 53 - j, j % 3 === 0 ? 0x8a6a9a : d > 0 ? 0x4a2a5a : 0x6a4a7a); }
            const tx = 28 + 6 * g, ty = 53 - h, ph = f / 6 * Math.PI * 2;
            for (let k = 0; k < 7; k++) {
                const a = -Math.PI + k * Math.PI / 6 + Math.sin(ph + k) * 0.05, L = 15 * g;
                for (let t = 0; t <= 1; t += 0.05) { const x = tx + Math.cos(a) * L * t, y = ty + Math.sin(a) * L * t * 0.6 + t * t * 8 * g; const c = M(0xff8ad8, 0x6a4aff, t); P.put(x, y, c); P.put(x, y + 1, M(c, 0x1a0a2a, 0.3)); if (t > 0.3 && Math.round(t * 20) % 3 === 0) P.put(x, y + 2, c); }
            }
            if (!fruit) return;
            [[-2, 3], [2, 3], [0, 5], [-4, 5]].forEach(([dx, dy], k) => P.disc(tx + dx, ty + dy, 2, (x, y) => { const an = Math.atan2(y - ty - dy, x - tx - dx) + ph + k; return Math.sin(an * 2) > 0 ? 0xff8ad8 : 0x6a8aff; }));
            P.put(tx - 2, ty + 2, 0xffffff, 1); P.put(tx + 1, ty + 4, 0xffffff, 1);
        } },
        eyeberry: { leaf: 0x3a7a3a, draw: (P, f, g, sw, M, fruit) => {   // a thick little bush of a tree, and every berry on it is an eye, looking about, now and then blinking
            const [tx, ty] = GardenScene._trunk(P, 28, 53, 12 * g, 2 + 2 * g, 2.5 * g, 0x3a2a1a, 0x2a1a0a);
            const leaf = (x, y) => ((x * 3 + y * 5) % 7 === 0 ? 0x4a8a4a : y < ty - 8 * g ? 0x3a7a3a : 0x2a5a2a);
            P.ell(tx - 8 * g, ty - 3 * g, 9 * g, 7 * g, leaf); P.ell(tx + 8 * g, ty - 3 * g, 9 * g, 7 * g, leaf); P.ell(tx, ty - 10 * g, 11 * g, 8 * g, leaf);
            if (!fruit) return;
            const look = [-1, -1, 0, 1, 1, 0][f];
            [[-11, -3], [-4, -1], [5, -2], [12, -4], [-6, -11], [4, -12], [0, -6]].forEach(([dx, dy], k) => {
                const x = tx + dx, y = ty + dy;
                if (k === f) { P.line(x - 2, y, x + 2, y, 0x1a3a1a); return; }   // a blink
                P.disc(x, y, 2.2, 0xf4f0e8); P.disc(x + look * 0.8, y, 1.3, 0x6aff4a); P.put(x + look * 0.8, y, 0x0a0614); P.put(x - 1, y - 1, 0xffffff, 1);
            });
        } },
        halotree: { leaf: 0xe8d8a0, draw: (P, f, g, sw, M, fruit) => {   // a slender pale tree, a small white crown, and golden halos floating up around it
            const [tx, ty] = GardenScene._trunk(P, 28, 53, 30 * g, 1 + 1.4 * g, 1, 0xf0e8d0, 0xc8b890);
            P.ell(tx, ty - 3 * g, 7 * g, 5 * g, (x, y) => ((x + y) % 3 ? 0xfff8e0 : 0xe8d8a0));
            const n = fruit ? 3 : 1;
            for (let k = 0; k < n; k++) {
                const y = 53 - (10 + k * 9 + f * 0.6) * g, r = (9 - k * 1.2) * g;
                for (let a = 0; a < Math.PI * 2; a += 0.12) { const back = Math.sin(a) < 0; P.put(tx + Math.cos(a) * r, y + Math.sin(a) * 2, back ? 0xc8a040 : 0xffd860, !back); }
            }
            if (fruit) P.spark(tx + [4, -5, 6, -3, 2, -6][f], ty + (f % 3) * 4, 0xfff8d0);
        } },
        eclipsefig: { leaf: 0xc86a2a, draw: (P, f, g, sw, M, fruit) => {   // a gnarled fig with burning autumn leaves, its fruit little black suns, each in its corona
            const [tx, ty] = GardenScene._trunk(P, 28, 53, 16 * g, 2 + 2.5 * g, 2 * g, 0x4a2a1a, 0x2a1408, -1);
            for (const s of [-1, 1]) P.line(28, 52, 28 + s * 6 * g, 53, 0x4a2a1a);   // roots
            const leaf = (x, y) => ((x * 5 + y * 3) % 8 === 0 ? 0xffa84a : y < ty - 8 * g ? 0xd8782a : (x + y) % 4 ? 0xb85a1a : 0x8a3a1a);
            [[-9, -2, 8, 6], [9, -3, 8, 6], [0, -9, 10, 7], [-6, -14, 6, 5], [6, -14, 6, 5]].forEach(([dx, dy, rx, ry]) => P.ell(tx + dx * g, ty + dy * g, rx * g, ry * g, leaf));
            if (!fruit) return;
            [[-10, 1], [-3, -4], [5, 0], [11, -3], [0, -13]].forEach(([dx, dy], k) => {
                const x = tx + dx, y = ty + dy, r = 2.2;
                for (let a = 0; a < Math.PI * 2; a += 0.4) { const fl = (Math.round(a / 0.4) + f + k) % 3 === 0 ? 1 : 0; P.put(x + Math.cos(a) * (r + 1 + fl), y + Math.sin(a) * (r + 1 + fl), fl ? 0xffe08a : 0xffb86a, 1); }
                P.disc(x, y, r, 0x0a0614);
            });
        } },
        tendrilheart: { leaf: 0x7aff5a, draw: (P, f, g, sw, M, fruit) => {   // corrupted: a heart for a trunk, beating, green veins in it, tentacles for branches reaching about, small green hearts on their tips
            const ph = f / 6 * Math.PI * 2, beat = f === 0 || f === 3 ? 1.12 : 1, hx = 28, hy = 53 - 14 * g, R = 6 * g * beat;
            for (const s of [-1, 1]) P.line(28 + s * 2, 53, 28 + s * 3 * g, hy + R * 0.6, 0x2a0a2a);   // the roots it stands on
            const heart = (x, y, r, c, c2) => { P.disc(x - r * 0.5, y - r * 0.2, r * 0.6, c); P.disc(x + r * 0.5, y - r * 0.2, r * 0.6, c); P.poly([[x - r * 1.05, y], [x + r * 1.05, y], [x, y + r * 1.1]], c); if (c2) P.put(x - r * 0.5, y - r * 0.5, c2, 1); };
            const tips = [];
            for (let k = 0; k < 6; k++) {
                const a0 = -Math.PI * 0.95 + k * Math.PI * 0.9 / 5, L = (12 + (k % 2) * 5) * g;
                let x = hx, y = hy - R * 0.4;
                for (let t = 0; t <= L; t++) { const a = a0 + Math.sin(ph + k + t * 0.25) * 0.3; x += Math.cos(a); y += Math.sin(a) * 0.9; P.put(x, y, t > L - 3 ? 0x7aff5a : 0x2a0a2a); if (t < L * 0.5) P.put(x + 1, y, 0x3a0a3a); }
                tips.push([x, y]);
            }
            heart(hx, hy, R, 0x3a0a3a);
            for (const [dx, dy] of [[-2, -1], [-1, 0], [0, 1], [1, 0], [2, 2], [0, -2], [1, -3]]) P.put(hx + dx * g, hy + dy * g, 0x7aff5a, beat > 1);
            if (!fruit) return;
            tips.forEach(([x, y], k) => heart(x, y - 1, k % 2 ? 1.8 : 2.2, 0x7aff5a, (k + f) % 2 ? 0xd8ffc8 : null));
        } },
    };
    // an orchard plot: what's on it, and what you can do there
    _treePanel(k) {
        const s = Garden.orchard(), p = s.orchard[k], st = Garden.treeState(p), Tr = st.T;
        const { keep, x, y, w, D } = this._panel(Tr.name.toUpperCase(), Tr.col, 250);
        const sp = keep(this.add.sprite(x + 70, y + 210, this._treeTex(Tr, st.stage), '0').setOrigin(0.5, 1).setScale(2.6).setDepth(D + 2)); sp.play(sp.texture.key);
        const when = st.grown < 1 ? `Grown in ${this._time(st.growLeft)}  (${Math.floor(st.grown * 100)}%), then its first ${Tr.fruit} ${Tr.every}h after.` : `Its ${Tr.fruit}: ripe in ${this._time(st.fruitLeft)}.`;
        keep(this.add.text(x + 140, y + 56, `${when}${Tr.time ? `\nIt only grows by ${Tr.time === 'night' ? 'night' : 'day'}.` : ''}\nEach crop: ✧${Tr.dust}, and its blessing banked: ${Tr.bless}, ${Tr.text}.`, { fontSize: '12px', fontFamily: 'monospace', color: '#d8e8e0', lineSpacing: 6, wordWrap: { width: w - 160 } }).setDepth(D + 2));
        const bar = keep(this.add.graphics().setDepth(D + 2)), f = st.grown < 1 ? st.grown : st.fruit; bar.fillStyle(0x05030a, 1); bar.fillRect(x + 140, y + 152, w - 160, 10); bar.fillStyle(Tr.col, 1); bar.fillRect(x + 140, y + 152, (w - 160) * f, 10);
        let sure = false;
        const b = UIKit.button(this, { x: x + 140 + (w - 160) / 2, y: y + 206, w: w - 160, h: 38, fontSize: '13px', depth: D + 3, fireOn: 'down', label: 'UPROOT IT (BACK TO A SAPLING)', accent: UIKit.PALETTE.line, onClick: () => {
            if (!sure) { sure = true; b.txt.setText('SURE? ITS GROWTH IS LOST'); Sfx.play(this, 'deny'); return; }
            Garden.uproot(k); Sfx.play(this, 'e_combine'); this._closePanel();
        } });
        b.objs.forEach(keep);
    }
    _pickFruit(k) {
        const r = Garden.pick(k);
        if (!r) return;
        const [ox, oy] = GardenScene.ORCHARD[k], x = this._px(ox + 1.5), y = this._py(oy) - this.T * 1.5;
        Sfx.play(this, 'pickup'); this.time.delayedCall(120, () => Sfx.play(this, 'e_quality'));
        this._toPurse(x, y, 24, r.tree.col);
        this._float(x, y - this.T * 0.5, `${r.tree.fruit}  +✧${r.dust}`, '#d8fff0');
        if (r.blessed) { this.time.delayedCall(350, () => this._float(x, y - this.T * 1.2, `BLESSING BANKED: ${r.tree.bless.toUpperCase()}`, UIKit._hex(r.tree.col))); this.time.delayedCall(350, () => Sfx.play(this, 'e_bind')); }
        else if (r.full) this.time.delayedCall(350, () => this._float(x, y - this.T * 1.2, 'no room for another blessing', '#b8b0c8'));
        this._drawCrops(); this._hud();
    }
    // an empty orchard plot: your saplings, as cards like the seed pouch's. Click one to plant it.
    _saplingPanel(k) {
        this._closePanel(true);
        const s = Garden.orchard(), W = this.scale.width, H = this.scale.height, D = 8000, objs = this._panelObjs = [], keep = o => { objs.push(o); o?.setScrollFactor?.(0); return o; };
        const own = Garden.TREES.filter(t => s.saplings[t.id] > 0), INK = '#3b2716', FADE = '#8a7254', HAND = 'Georgia, "Times New Roman", serif';
        const cols = Math.max(1, Math.min(5, own.length)), cw = 180, chh = 220, gap = 14, rows = Math.max(1, Math.ceil(own.length / cols));
        const pw = Math.min(W - 40, Math.max(620, cols * cw + (cols - 1) * gap + 80)), ph = Math.min(H - 40, 190 + rows * (chh + gap)), px = W / 2 - pw / 2, py = H / 2 - ph / 2;
        keep(this.add.rectangle(0, 0, W, H, 0x05030a, 0.65).setOrigin(0).setDepth(D).setInteractive()).on('pointerdown', () => this._closePanel());
        const shd = keep(this.add.graphics().setDepth(D + 0.5)); shd.fillStyle(0x000000, 0.45); shd.fillRoundedRect(px + 10, py + 12, pw, ph, 14);
        keep(this.add.image(px, py, this._diaryTex('cover', pw, ph)).setOrigin(0).setDisplaySize(pw, ph).setDepth(D + 1));
        keep(this.add.image(px + 18, py + 18, this._diaryTex('pageR', pw - 36, ph - 36)).setOrigin(0).setDisplaySize(pw - 36, ph - 36).setDepth(D + 1.2)).setInteractive();
        const txt = (x, y, t, o = {}) => keep(this.add.text(x, y, t, Object.assign({ fontSize: '13px', fontFamily: HAND, fontStyle: 'italic', color: INK }, o)).setDepth(D + 3));
        txt(px + 40, py + 30, 'Your Saplings', { fontSize: '26px', fontFamily: UIKit.FONT.title, fontStyle: 'bold' });
        txt(px + 42, py + 64, 'pick one for this plot  ·  no water needed, they drink starlight', { color: FADE, wordWrap: { width: pw - 140 } });
        UIKit.button(this, { x: px + pw - 34, y: py + 34, w: 34, h: 30, label: 'X', accent: UIKit.PALETTE.line, depth: D + 4, fontSize: '12px', fireOn: 'down', onClick: () => this._closePanel() }).objs.forEach(keep);
        if (!own.length) { txt(W / 2, py + ph / 2, 'No saplings yet.\nThe seed kiosk sells them (its ORCHARD page).', { fontSize: '16px', align: 'center' }).setOrigin(0.5); return; }
        const gx = W / 2 - (cols * cw + (cols - 1) * gap) / 2, top = py + 108;
        own.forEach((Tr, i) => {
            const cx = gx + (i % cols) * (cw + gap), cy = top + Math.floor(i / cols) * (chh + gap), tilt = ((i * 37) % 7 - 3) * 0.4;
            if (cy + chh > py + ph - 20) return;
            keep(this.add.image(cx + cw / 2 + 2, cy + chh / 2 + 3, this._diaryTex('card', cw, chh)).setDisplaySize(cw, chh).setAngle(tilt).setTint(0x000000).setAlpha(0.18).setDepth(D + 1.6));
            const card = keep(this.add.image(cx + cw / 2, cy + chh / 2, this._diaryTex('card', cw, chh)).setDisplaySize(cw, chh).setAngle(tilt).setDepth(D + 1.7));
            const band = keep(this.add.graphics().setDepth(D + 1.8)); band.fillStyle(MenuArt.mix(Tr.col, 0x1a0e08, 0.35), 1); band.fillRect(cx + 8, cy + 8, cw - 16, 30); band.fillStyle(Tr.col, 1); band.fillRect(cx + 8, cy + 8, cw - 16, 26);
            txt(cx + cw / 2, cy + 14, Tr.name, { fontSize: '14px', fontFamily: UIKit.FONT.title, fontStyle: 'bold', color: '#ffffff', stroke: '#1a0e08', strokeThickness: 3 }).setOrigin(0.5, 0);
            const ik = this._treeTex(Tr, 3), sp = keep(this.add.sprite(cx + cw / 2, cy + 132, ik, '0').setOrigin(0.5, 1).setScale(1.6).setDepth(D + 2)).play(ik);
            txt(cx + cw / 2, cy + 136, `${s.saplings[Tr.id]} in pots  ·  grown in ${Tr.grow}h\n${Tr.fruit} every ${Tr.every}h`, { fontSize: '11px', align: 'center' }).setOrigin(0.5, 0);
            txt(cx + cw / 2, cy + 172, `${Tr.bless}: ${Tr.text}`, { fontSize: '11px', color: Tr.corrupt ? '#8a1a3a' : '#5a3a8a', align: 'center', wordWrap: { width: cw - 20 } }).setOrigin(0.5, 0);
            if (Tr.time) txt(cx + 14, cy + 44, Tr.time === 'night' ? '☾ night' : '☀ day', { fontSize: '12px', fontStyle: 'bold', color: Tr.time === 'night' ? '#3a4a9a' : '#9a6a10' });
            txt(cx + cw - 14, cy + 44, `✧${Tr.dust}`, { fontSize: '12px', fontStyle: 'bold', color: '#7a5a20' }).setOrigin(1, 0);
            keep(this.add.zone(cx, cy, cw, chh).setOrigin(0).setInteractive({ useHandCursor: true }).setDepth(D + 4))
                .on('pointerover', () => { card.setScale(card.scaleX * 1.04, card.scaleY * 1.04); sp.setScale(1.8); Sfx.play(this, 'hover'); })
                .on('pointerout', () => { card.setDisplaySize(cw, chh); sp.setScale(1.6); })
                .on('pointerdown', () => {
                    Garden.plantTree(k, Tr.id); Sfx.play(this, 'e_bind'); this._closePanel();
                    const [ox, oy] = GardenScene.ORCHARD[k]; this._float(this._px(ox + 1.5), this._py(oy), `${Tr.name} planted`, UIKit._hex(Tr.col));
                });
        });
        objs.forEach(o => { if (o.alpha !== undefined && o.depth > D + 0.4) { const a = o.alpha; o.setAlpha(0); this.tweens.add({ targets: o, alpha: a, duration: 220 }); } });
    }

    // ── DRIFTERS ON THE RIVER ─────────────────────────────────────────────────
    // Now and then something floats down the river: a little dust, fertilizer, rarely a sealed book,
    // very rarely an enchanted book. Walk up to it (or click it) to scoop it out.
    _drifters() {
        const T = this.T, k = T / 16;
        this._drift = [];
        let next = this.time.now + 4000;
        this._ticks.push(t => {
            if (t > next && this._drift.length < 3) {
                next = t + 12000 + Math.random() * 18000;
                const r = Math.random(), kind = r < 0.0025 ? 'ench' : r < 0.02 ? 'book' : r < 0.25 ? 'fert' : 'dust';
                const lx = Math.random() * this.cols * 16, [a, b] = this._bank[Math.floor(lx)];
                const key = kind === 'book' || kind === 'ench' ? ShopScene.bookIcon(this, kind === 'book' ? -1 : 3) : MenuArt.tex(this, 'gd3_drift_' + kind, 8, 8, P => {
                    if (kind === 'dust') { for (let j = 0; j < 8; j++) for (let i = 0; i < 8; i++) if ((i - 3.5) ** 2 + (j - 3.5) ** 2 < 10) P.put(i, j, (i + j) % 3 ? 0xc8b8ff : 0xffffff); }
                    else { P.rect(1, 2, 6, 6, 0x8a6a42); P.rect(1, 2, 6, 1, 0xa88a5a); P.put(3, 1, 0x6aa84a); P.put(4, 0, 0x9aff8a); P.put(3, 4, 0xffe08a); }
                });
                const o = this.add.image(this.ox + lx * k, this.oy + (a + (b - a) * (0.3 + Math.random() * 0.4)) * k, key, kind === 'book' || kind === 'ench' ? '0' : undefined).setScale(kind === 'book' || kind === 'ench' ? k * 0.6 : k).setDepth(2.5).setInteractive({ useHandCursor: true });
                const gl = this.add.image(o.x, o.y, 'mn_glow').setTint(kind === 'ench' ? 0xffc23a : kind === 'book' ? 0xd8a8ff : 0xffffff).setBlendMode(Phaser.BlendModes.ADD).setDisplaySize(T, T * 0.6).setAlpha(0.5).setDepth(2.4);
                const D = { o, gl, kind, born: t };
                o.on('pointerdown', () => this._scoop(D));
                this._drift.push(D);
            }
            for (const D of [...this._drift]) {
                D.o.x += 0.35; D.o.y += Math.sin(t * 0.003 + D.born) * 0.08; D.o.angle = Math.sin(t * 0.002 + D.born) * 8; D.gl.setPosition(D.o.x, D.o.y);
                if (Math.hypot(D.o.x - this.fx, D.o.y - this.fy) < T * 1.3 && !this._fish && !this._panelObjs) this._scoop(D);
                else if (D.o.x > this.cols * T || t - D.born > 90000) { D.o.destroy(); D.gl.destroy(); this._drift = this._drift.filter(x => x !== D); }
            }
        });
    }
    _scoop(D) {
        if (!this._drift.includes(D)) return;
        this._drift = this._drift.filter(x => x !== D);
        const x = D.o.x, y = D.o.y; D.o.destroy(); D.gl.destroy();
        this._ripple(x, y); Sfx.play(this, D.kind === 'ench' ? 'e_land' : 'pickup', { r: 3 });
        let msg;
        if (D.kind === 'dust') { const n = 3 + Math.floor(Math.random() * 6); Enchants.addDust(n); msg = `+✧${n} DUST`; this._toPurse(x, y, 8, 0xc8b8ff); }
        else if (D.kind === 'fert') { Garden.buyFert(); msg = '+1 FERTILIZER'; }
        else if (D.kind === 'book') { Enchants.addBooks(1); msg = 'A SEALED BOOK, FROM THE RIVER!'; }
        else {   // an enchanted book: a real one, into your collection
            const L = Enchants.LIST.filter(d => d.r <= 3), d = L[Math.floor(Math.random() * L.length)], b = { id: d.id, lvl: 1, q: Math.floor(Math.pow(Math.random(), 3) * 101) };
            const list = Enchants.collection(); list.push(b); Enchants._keep(list); Enchants._see?.(d.id);
            msg = `AN ENCHANTED BOOK: ${d.name.toUpperCase()}!`; this.cameras.main.flash(240, 255, 210, 120);
        }
        this._float(x, y - this.T, msg, D.kind === 'ench' ? '#ffd060' : D.kind === 'book' ? '#d8a8ff' : '#d8fff0');
        this._hud();
    }

    // ── THE HUD ───────────────────────────────────────────────────────────────
    // The way back, the log, the purse, the blessings banked for your next Tower climb (all fixed to
    // the screen while the camera follows you).
    _hud() {
        // rebuilt only when something it shows has changed (so the hotbar's fish keep swimming)
        const s0 = Garden.state(), sig = JSON.stringify([this._build, s0.bag, s0.chest, s0.bank, s0.fert, s0.seeds, s0.plots.map(p => p.cells.map(c => c?.seed)), s0.tier, s0.rod, s0.can, this.glorps, Enchants.dust(), Enchants.books(), this._area, !!this._build]);
        if (sig === this._hudSig && this._hudObjs) return;
        this._hudSig = sig;
        for (const o of (this._hudObjs || [])) { this.tweens.killTweensOf(o); o.destroy?.(); }
        const objs = this._hudObjs = [], keep = o => { objs.push(o); o?.setScrollFactor?.(0); return o; }, W = this.scale.width, s = Garden.state(), cap = Garden.TIERS[s.tier].bank, D = 7000;
        UIKit.button(this, { x: 90, y: 34, w: 150, h: 34, label: '◂ THE ISLE', accent: UIKit.PALETTE.line, depth: D, fontSize: '13px', fireOn: 'down', onClick: () => this._leave() }).objs.forEach(o => objs.push(o));
        keep(this.add.text(W / 2, 30, this._area || 'THE DUST GARDEN', { fontSize: '26px', fontFamily: UIKit.FONT.title, fontStyle: 'bold', color: '#d8fff0', stroke: '#0a0618', strokeThickness: 5 }).setOrigin(0.5).setDepth(D));
        this._purse = keep(this.add.text(W - 20, 22, `✦ ${this.glorps}   ✧ ${Enchants.dust()}   ✿ ${s.fert}   ▤ ${Enchants.books()}`, { fontSize: '15px', fontFamily: 'monospace', fontStyle: 'bold', color: '#f0e0b0', backgroundColor: '#0a0618cc', padding: { x: 8, y: 5 } }).setOrigin(1, 0).setDepth(D));
        const x = 20, y = 66, w = 270, g = keep(this.add.graphics().setDepth(D - 1));
        g.fillStyle(0x0a0618, 0.82); g.fillRoundedRect(x, y, w, 40 + cap * 30, 8); g.lineStyle(2, 0x8affd8, 0.6); g.strokeRoundedRect(x, y, w, 40 + cap * 30, 8);
        keep(this.add.text(x + 12, y + 10, `BLESSINGS FOR YOUR NEXT CLIMB  ${s.bank.length}/${cap}`, { fontSize: '11px', fontFamily: 'monospace', fontStyle: 'bold', color: '#d8fff0' }).setDepth(D));
        for (let i = 0; i < cap; i++) {
            const S = Garden.seed(s.bank[i]), yy = y + 34 + i * 30;
            g.fillStyle(S ? S.col : 0x2a2440, S ? 0.9 : 1); g.fillCircle(x + 22, yy + 8, 7);
            keep(this.add.text(x + 38, yy, S ? `${S.bless}: ${S.text}` : 'empty: harvest a crop to bank one', { fontSize: '11px', fontFamily: 'monospace', fontStyle: S ? 'bold' : 'normal', color: S ? UIKit._hex(S.col) : '#7a7090' }).setDepth(D));
        }
        // the bottom bar: the log (a book), build mode (a hammer, the Garden's own), the backpack (the biggest), what's in hand
        const H = this.scale.height, by = H - 92, garden = this.scene.key === 'Garden';
        const icon = (x, kind, size, key, label, on, cb) => {
            const g = keep(this.add.graphics().setDepth(D)), r = size / 2;
            g.fillStyle(0x000000, 0.45); g.fillCircle(x + 3, by + 5, r); g.fillStyle(on ? 0x3a2a14 : 0x1e140a, 0.95); g.fillCircle(x, by, r);
            g.lineStyle(on ? 4 : 3, on ? 0xffe08a : 0xc89a5a, 1); g.strokeCircle(x, by, r); g.lineStyle(1.5, 0xffffff, 0.15); g.beginPath(); g.arc(x, by, r - 5, -2.6, -1.0); g.strokePath();
            const im = keep(this.add.image(x, by, this._hudIcon(kind)).setScale(size * 0.62 / 24).setDepth(D + 1));
            if (key) { const kb = keep(this.add.text(x, by - r - 2, key, { fontSize: '12px', fontFamily: 'monospace', fontStyle: 'bold', color: '#1a1006', backgroundColor: '#f2e2bc', padding: { x: 5, y: 1 } }).setOrigin(0.5, 1).setDepth(D + 1)); }
            keep(this.add.text(x, by + r + 2, label, { fontSize: '10px', fontFamily: 'monospace', fontStyle: 'bold', color: '#f2e2bc', stroke: '#0a0618', strokeThickness: 3 }).setOrigin(0.5, 0).setDepth(D + 1));
            keep(this.add.circle(x, by, r).setInteractive({ useHandCursor: true }).setDepth(D + 2)).on('pointerover', () => this.tweens.add({ targets: im, scale: size * 0.72 / 24, duration: 100 })).on('pointerout', () => this.tweens.add({ targets: im, scale: size * 0.62 / 24, duration: 100 })).on('pointerdown', cb);
        };
        icon(W / 2 - 170, 'book', 54, 'L', 'LOG', false, () => { if (!this._fish && !this._rest) this._logPanel(); });
        if (garden) icon(W / 2 - 96, 'hammer', 54, 'B', this._build ? 'DONE' : 'BUILD', !!this._build, () => this._toggleBuild());
        icon(W / 2, 'pack', 92, 'I', 'BACKPACK', false, () => this._pack ? this._closePanel() : this._backpack());
        const hs = 54;   // the two hands
        this._hot = { x: W / 2 + 66, y: by - hs / 2, sz: hs, keep, D };
        this._hotSel();
        keep(this.add.text(W / 2, this.scale.height - 6, this.scene.key === 'Garden' ? 'WASD walk  ·  E tend, fish, rest (hold E to reel)  ·  1 / 2 hands  ·  I backpack  ·  B build  ·  L log  ·  Esc leave  ·  the Grove is west, the Lagoon east' : 'WASD walk  ·  E fish (hold E to reel)  ·  1 / 2 hands  ·  I backpack  ·  L log  ·  ' + (this._cfg?.().hint || 'Esc to leave'), { fontSize: '11px', fontFamily: 'monospace', color: '#c8d8c8', backgroundColor: '#0a0618aa', padding: { x: 6, y: 2 } }).setOrigin(0.5, 1).setDepth(D));
        if (this._logOpen) for (const o of objs) o.setVisible?.(false);   // (rebuilt with the diary open: it stays put away)
    }

    // ── PANELS ────────────────────────────────────────────────────────────────
    _panel(title, col, h, w = 560) {
        this._closePanel(true);
        const W = this.scale.width, H = this.scale.height, objs = this._panelObjs = [], keep = o => { objs.push(o); o?.setScrollFactor?.(0); return o; }, x = W / 2 - w / 2, y = H / 2 - h / 2, D = 8000;
        keep(this.add.rectangle(0, 0, W, H, 0x05030a, 0.6).setOrigin(0).setDepth(D).setInteractive()).on('pointerdown', () => this._closePanel());
        const g = keep(this.add.graphics().setDepth(D + 1));
        g.fillStyle(0x0e1a16, 0.97); g.fillRoundedRect(x, y, w, h, 12); g.lineStyle(3, col, 0.9); g.strokeRoundedRect(x, y, w, h, 12);
        keep(this.add.text(x + 20, y + 16, title, { fontSize: '20px', fontFamily: UIKit.FONT.title, fontStyle: 'bold', color: UIKit._hex(col) }).setDepth(D + 2));
        UIKit.button(this, { x: x + w - 30, y: y + 26, w: 34, h: 28, label: 'X', accent: UIKit.PALETTE.line, depth: D + 3, fontSize: '12px', fireOn: 'down', onClick: () => this._closePanel() }).objs.forEach(keep);
        return { keep, x, y, w, h, D };
    }
    // The diary's camera (big screens): everything of the book (depth 8000 and up) is drawn by it, zoomed, and nothing else; the rest
    // stays on the main camera. Text in the book renders at twice its density so the zoom keeps it sharp. Gone once the book is.
    _bookCamSync() {
        const bc = this._bookCam;
        if (!bc) return;
        const M = this.cameras.main.id, B = bc.id, D = 8000;
        const route = (o, book) => { o.cameraFilter = book ? (o.cameraFilter & ~B) | M : o.cameraFilter | B; if (o.list) for (const c of o.list) route(c, book); };
        if (!this._logOpen) {   // closed (or another panel took over): back to one camera
            const back = o => { o.cameraFilter &= ~B; if (o._bookRoute) o.cameraFilter &= ~M; o._bookRoute = undefined; if (o.list) for (const c of o.list) back(c); };
            for (const o of this.children.list) back(o);
            this.cameras.remove(bc); this._bookCam = null; this.events.off('prerender', this._bookCamSync, this);
            return;
        }
        for (const o of this.children.list) {
            const book = o.depth >= D;
            if (o._bookRoute === book) continue;
            o._bookRoute = book; route(o, book);
            if (book && o.type === 'Text' && (o.style?.resolution || 1) < 2) o.setResolution(2);
        }
    }
    _closePanel(quiet) { if (!quiet) for (const o of this._hudObjs || []) o.setVisible?.(true); this._logOpen = false; this._pack = null; this._packPick = null; this._diaryTurning = false; for (const o of (this._panelObjs || [])) { this.tweens.killTweensOf(o); o.destroy?.(); } this._panelObjs = null; if (!quiet) { this._drawCrops(); this._hud(); if (this.scene.key === 'Garden') this._tanksSetup(); } }

    // ── PLANTING ──────────────────────────────────────────────────────────────
    // Sprinkling by hand: E on a field with room picks up the basket. A tray of your seeds along the bottom (click one, or
    // the mouse wheel); hold the mouse over the field and that seed streams out to the cursor, landing as specks. How long
    // you sprinkled each is the mix (Garden.allot rounds it to the field's places) and each kind grows where it was thrown
    // (Garden.sowAt). E or DONE plants it; Esc puts the seeds back. You can walk about while you do it.
    _sprinkleStart(k, first = null) {
        if (this._sprk) return;
        const s = Garden.state(), own = Garden.SEEDS.filter(S => (s.seeds[S.id] || 0) > 0 && Garden.canPlant(k, S.id, s));
        if (!own.length) { Sfx.play(this, 'deny'); this._float(this.fx, this.fy - this.T * 1.4, 'no seeds free to plant', '#e8d8b0'); return; }
        if (!Garden.bed(s.plots[k]).empty) { Sfx.play(this, 'deny'); return; }
        this.prompt.setVisible(false);
        const Z = this._sprk = { k, own, seed: own.find(S => S.id === first)?.id || own[0].id, times: {}, pts: [], specks: this.add.graphics().setDepth(0.7), ui: [], page: 0, down: false, last: 0 };
        this._holdBasket(true);
        Z.tick = this.time.addEvent({ delay: 45, loop: true, callback: () => this._sprinkleTick() });
        Z.onDown = p => { if (p.button === 0 && !this.input.hitTestPointer(p).length) Z.down = true; };
        Z.onUp = () => { Z.down = false; };
        Z.onWheel = (p, o, dx, dy) => { const i = Z.own.findIndex(S => S.id === Z.seed); this._sprinkleSeed(Z.own[(i + (dy > 0 ? 1 : -1) + Z.own.length) % Z.own.length].id); };
        this.input.on('pointerdown', Z.onDown); this.input.on('pointerup', Z.onUp); this.input.on('wheel', Z.onWheel);
        Sfx.play(this, 'pickup');
        this._sprinkleUI();
    }
    _sprinkleSeed(id) {
        const Z = this._sprk; if (!Z || Z.seed === id) return;
        Z.seed = id; const i = Z.own.findIndex(S => S.id === id); Z.page = Math.floor(i / 8);
        Sfx.play(this, 'pluck', { i: i % 8, soft: true }); this._sprinkleUI();
    }
    // every 45ms the mouse is held over the field: a seed flies from the basket to the cursor and lands as a speck there
    _sprinkleTick() {
        const Z = this._sprk; if (!Z || !Z.down || this._panelObjs) return;
        const T = this.T, p = this.input.activePointer, [bx, by] = GardenScene.BEDS[Z.k], x0 = this._px(bx), y0 = this._py(by);
        const wp = this.cameras.main.getWorldPoint(p.x, p.y), wx = wp.x + (Math.random() - 0.5) * T * 0.5, wy = wp.y + (Math.random() - 0.5) * T * 0.35;   // (p.worldX can be the last camera that hit-tested it: the HUD's)
        const u = ((wx - x0) / (4 * T) - 0.07) / 0.86, v = ((wy - y0) / (2 * T) - 0.14) / 0.8;   // _cellXY, backwards
        if (u < -0.08 || u > 1.08 || v < -0.12 || v > 1.12) return;   // only over the field
        if (Math.hypot(Math.max(x0 - this.fx, 0, this.fx - x0 - 4 * T), Math.max(y0 - this.fy, 0, this.fy - y0 - 2 * T)) > T * 4) { if (this.time.now - Z.last > 900) { Z.last = this.time.now; this._float(this.fx, this.fy - T * 1.4, 'get closer to the field', '#e8d8b0'); } return; }
        const cu = Math.min(1, Math.max(0, u)), cv = Math.min(1, Math.max(0, v)), S = Garden.seed(Z.seed);
        Z.times[Z.seed] = (Z.times[Z.seed] || 0) + 45;
        Z.pts.push({ id: Z.seed, x: 0.06 + cu * 0.88, y: 0.14 + cv * 0.76 });
        const tx = x0 + (0.07 + cu * 0.86) * 4 * T, ty = y0 + (0.14 + cv * 0.8) * 2 * T, sx = this.fx + (this.player.flipX ? -1 : 1) * T * 0.4, sy = this.fy - T * 0.5;
        const sd = this.add.image(sx, sy, this._seedTex(S)).setScale(T / 16 * 0.9).setDepth(6050), q = { t: 0 };
        this.tweens.add({ targets: q, t: 1, duration: 260 + Math.random() * 120, ease: 'Sine.easeOut', onUpdate: () => sd.setPosition(sx + (tx - sx) * q.t, sy + (ty - sy) * q.t - Math.sin(q.t * Math.PI) * T * 0.9).setAngle(q.t * 400),
            onComplete: () => { sd.destroy(); Z.specks.fillStyle(MenuArt.mix(S.col, 0x2a1a0e, 0.2), 1); Z.specks.fillEllipse(tx, ty, T * 0.09, T * 0.06); } });
        this.player.setFlipX(tx < this.fx);
        if (Z.pts.length % 4 === 0) Sfx.play(this, 'pluck', { i: (Z.pts.length / 4) % 8, soft: true });
        if (Z.pts.length % 6 === 0) this._sprinkleUI();
    }
    // the tray: your seeds as round bubbles along the bottom (the one in hand raised, ringed), each with how long you've
    // sprinkled it as a share; DONE and CANCEL
    _sprinkleUI() {
        const Z = this._sprk; if (!Z) return;
        Z.ui.forEach(o => o.destroy()); Z.ui = [];
        const W = this.scale.width, H = this.scale.height, D = 7400, keep = o => { Z.ui.push(o); o.setScrollFactor?.(0); return o; };
        const per = 8, pages = Math.ceil(Z.own.length / per), list = Z.own.slice(Z.page * per, Z.page * per + per), tot = Object.values(Z.times).reduce((a, b) => a + b, 0);
        const gap = 100, w = list.length * gap + 330, cx = W / 2, y = H - 156;
        const bg = keep(this.add.graphics().setDepth(D));   // a woven tray
        bg.fillStyle(0x000000, 0.45); bg.fillRoundedRect(cx - w / 2 + 4, y - 58, w, 112, 30);
        bg.fillStyle(0x6a4420, 1); bg.fillRoundedRect(cx - w / 2, y - 62, w, 112, 30);
        bg.fillStyle(0x9a6a34, 1); bg.fillRoundedRect(cx - w / 2 + 6, y - 56, w - 12, 100, 26);
        for (let r = 0; r < 5; r++) for (let c = 0; c < w / 16; c++) if ((r + c) % 2) { bg.fillStyle(0xb88448, 1); bg.fillRect(cx - w / 2 + 16 + c * 16, y - 46 + r * 18, 14, 8); }
        bg.lineStyle(3, 0xd8a868, 1); bg.strokeRoundedRect(cx - w / 2 + 6, y - 56, w - 12, 100, 26);
        keep(this.add.text(cx, y - 78, 'hold the mouse over the field to sprinkle  ·  scroll or click to switch seed  ·  E done  ·  Esc cancel', { fontSize: '12px', fontFamily: 'monospace', fontStyle: 'bold', color: '#fff6d8', stroke: '#1a1006', strokeThickness: 4 }).setOrigin(0.5).setDepth(D + 1));
        list.forEach((S, j) => {
            const x = cx - w / 2 + 96 + j * gap, on = S.id === Z.seed, by = y - (on ? 10 : 0), share = tot ? Math.round((Z.times[S.id] || 0) / tot * 100) : 0, ik = this._cropTex(S, 4);
            const g = keep(this.add.graphics().setDepth(D + 1));
            g.fillStyle(0x000000, 0.35); g.fillCircle(x + 2, by + 4, 34); g.fillStyle(on ? 0xfff6dc : 0xf2e2bc, 1); g.fillCircle(x, by, 34);
            g.fillStyle(MenuArt.mix(S.col, 0xf2e2bc, 0.72), 1); g.fillCircle(x, by + 4, 28);
            g.lineStyle(on ? 5 : 3, on ? S.col : 0x8a6a3a, 1); g.strokeCircle(x, by, 34);
            if (share) { g.lineStyle(6, S.col, 1); g.beginPath(); g.arc(x, by, 41, -Math.PI / 2, -Math.PI / 2 + share / 100 * Math.PI * 2); g.strokePath(); }
            keep(this.add.sprite(x, by + 14, ik, '0').setOrigin(0.5, 1).setScale(1.6).setDepth(D + 2)).play(ik);
            keep(this.add.text(x, by + 36, share ? `${S.name}\n${share}%` : S.name, { fontSize: '11px', fontFamily: UIKit.FONT.title, fontStyle: 'bold', color: '#fff6d8', stroke: '#2a1a08', strokeThickness: 4 }).setOrigin(0.5, 0).setDepth(D + 2));
            keep(this.add.circle(x, by, 34).setInteractive({ useHandCursor: true }).setDepth(D + 3)).on('pointerdown', () => this._sprinkleSeed(S.id));
        });
        if (pages > 1) for (const [dx, dir, sym] of [[-w / 2 + 22, -1, '‹'], [w / 2 - 22, 1, '›']])
            keep(this.add.text(cx + dx, y, sym, { fontSize: '28px', fontFamily: 'monospace', fontStyle: 'bold', color: '#fff6d8', stroke: '#1a1006', strokeThickness: 5 }).setOrigin(0.5).setDepth(D + 3).setInteractive({ useHandCursor: true }))
                .on('pointerdown', () => { Z.page = (Z.page + dir + pages) % pages; Sfx.play(this, 'e_flip'); this._sprinkleUI(); });
        const n = Garden.bed(Garden.state().plots[Z.k]).empty, sh = tot ? Garden.allot(Z.times, n) : {};
        keep(this.add.text(cx + w / 2 - 110, y - 34, tot ? Object.entries(sh).map(([id, m]) => `${m} ${Garden.seed(id).name}`).join('\n') : `${n} places to fill`, { fontSize: '11px', fontFamily: 'monospace', fontStyle: 'bold', color: '#2a1a08', align: 'center', lineSpacing: 2 }).setOrigin(0.5, 0).setDepth(D + 2));
        UIKit.button(this, { x: cx + w / 2 - 110, y: y + 24, w: 120, h: 34, fontSize: '13px', depth: D + 3, fireOn: 'down', shape: 'rune', label: 'DONE', accent: tot ? 0x9aff8a : UIKit.PALETTE.line, onClick: () => this._sprinkleEnd(true) }).objs.forEach(keep);
    }
    // done (plant what was thrown) or not (the seeds go back, nothing used)
    _sprinkleEnd(plant) {
        const Z = this._sprk; if (!Z) return;
        this._sprk = null;
        Z.tick.remove(); this.input.off('pointerdown', Z.onDown); this.input.off('pointerup', Z.onUp); this.input.off('wheel', Z.onWheel);
        Z.ui.forEach(o => o.destroy()); this._holdBasket(false);
        const spots = plant && Object.keys(Z.times).length ? Garden.sowAt(Z.k, Z.times, Z.pts) : [];
        this.tweens.add({ targets: Z.specks, alpha: 0, duration: 400, onComplete: () => Z.specks.destroy() });
        if (!spots.length) { if (plant) Sfx.play(this, 'deny'); this._drawCrops(); return; }
        const cells = Garden.state().plots[Z.k].cells, T = this.T;
        spots.forEach((i, j) => this.time.delayedCall(j * 30, () => {   // each plant pops up out of the soil where it was thrown
            const c = cells[i]; if (!c) return;
            const [x, y] = this._cellXY(Z.k, i, c), ik = this._cropTex(Garden.seed(c.seed), 0, true), sp = this.add.sprite(x, y, ik, '0').setOrigin(0.5, 0.94).setScale(0).setDepth(y);
            this.tweens.add({ targets: sp, scale: T / 16 * 0.48, duration: 220, ease: 'Back.easeOut', onComplete: () => sp.destroy() });
            this._puff(x, y, 0x6a4a30, 3); if (j % 3 === 0) Sfx.play(this, 'pluck', { i: (j / 3) % 8, soft: true });
        }));
        this.time.delayedCall(spots.length * 30 + 260, () => this._drawCrops());
        const sh = {}; for (const i of spots) sh[cells[i].seed] = (sh[cells[i].seed] || 0) + 1;
        const [bx, by] = GardenScene.BEDS[Z.k];
        this._float(this._px(bx + 2), this._py(by), Object.entries(sh).map(([id, m]) => `${m} ${Garden.seed(id).name}`).join('  ·  '), '#d8ffe8');
        this._hud();
    }
    // the basket in the slime's hand while it sprinkles
    _holdBasket(on) {
        if (on) { this._preHeld = this._heldItem; this._heldItem = { k: 'basket' }; this.heldSpr.setTexture(this._basketTex(true)).setScale(this.T / 16 * 0.16).stop(); }
        else { this.heldSpr.setTexture('__DEFAULT'); this._heldItem = null; this._holdLook(this._preHeld); }
    }

    // a seed: a plump oval in its crop's colour, shaded, a pale stripe and a glint
    _seedTex(S) {
        return MenuArt.tex(this, 'gd4_seed_' + S.id, 7, 5, P => {
            const c = GardenScene.CROP_ART[S.id]?.seed ?? S.col, M = MenuArt.mix;
            P.ellipse(3, 2, 3.2, 2.2, M(c, 0x1a0e06, 0.45)); P.ellipse(3, 1.8, 2.8, 1.8, c); P.line(1, 2, 5, 2, M(c, 0xffffff, 0.35)); P.put(2, 1, 0xffffff);
        });
    }
    // A Hay Day style wicker basket, 96 x 76: an over-under weave shaded round its belly, a twisted rim, a braided handle, a
    // red gingham cloth draped over the near rim. front: only what sits in front of the seeds (the near rim, the cloth, the belly)
    _basketTex(front = false) {
        return MenuArt.tex(this, 'gd5_basket' + (front ? 'F' : 'B'), 96, 76, P => {
            const M = MenuArt.mix, cx = 48, top = 30;
            const W = y => 44 - Math.pow(Math.max(0, y - top) / 40, 1.6) * 12;   // its half-width down the belly
            if (!front) {
                for (let a = Math.PI * 1.04; a <= Math.PI * 1.96; a += 0.006) {   // the handle: a braid of three strands, lit on top
                    const x = cx + Math.cos(a) * 38, y = top + 2 + Math.sin(a) * 28, t = Math.floor(a * 40) % 3;
                    for (let w = -2.6; w <= 2.6; w += 0.5) { const lit = w < -0.8 ? 0.25 : w > 1.4 ? -0.35 : 0; P.put(x + Math.cos(a) * w, y + Math.sin(a) * w, M([0xd8a060, 0xb88040, 0xc89050][t], lit > 0 ? 0xfff0c8 : 0x2a1406, Math.abs(lit))); }
                }
                for (let x = cx - 40; x <= cx + 40; x++) for (let y = top - 6; y <= top + 6; y++) {   // the dark inside, back wall lit by its rim
                    const d = ((x - cx) / 40) ** 2 + ((y - top) / 7) ** 2; if (d > 1) continue;
                    P.put(x, y, M(0x3a2210, 0x1a0c04, (y - top + 6) / 12));
                }
                for (let x = cx - 42; x <= cx + 42; x++) { const y = Math.round(top - 7 * Math.sqrt(Math.max(0, 1 - ((x - cx) / 42) ** 2))); P.put(x, y, 0xe8b878); P.put(x, y - 1, 0xb88040); P.put(x, y + 1, 0x8a5a24); }   // the far rim
                return;
            }
            for (let y = top; y < 72; y++) {   // the belly: an over-under weave
                const hw = W(y), row = Math.floor((y - top) / 5), v = (y - top) % 5;
                for (let x = Math.round(cx - hw); x <= Math.round(cx + hw); x++) {
                    const u = (x - cx) / hw, col = Math.floor((x - cx + 60 + (row % 2) * 4) / 8), over = (col + row) % 2 === 0;
                    let c = over ? 0xd09858 : 0xa87038;
                    if (v === 0) c = 0x6a4018; else if (v === 1 && over) c = 0xe8b878;   // the strand's top catches light
                    if ((x - cx + 60 + (row % 2) * 4) % 8 === 0) c = 0x7a4a1c;   // the stakes between
                    c = M(c, u < -0.3 ? 0xfff0c8 : 0x1a0c04, u < -0.3 ? (-u - 0.3) * 0.25 : Math.max(0, u + 0.1) * 0.55 + (y - top) / 42 * 0.25);   // lit from the left, round
                    P.put(x, y, c);
                }
            }
            for (let x = cx - 32; x <= cx + 32; x++) { P.put(x, 72, 0x4a2a10); P.put(x, 73, 0x2a1406); }   // its foot
            for (let x = cx - 44; x <= cx + 44; x++) {   // the near rim: a twisted rope
                const y = Math.round(top + 7 * Math.sqrt(Math.max(0, 1 - ((x - cx) / 44) ** 2)));
                for (let w = -3; w <= 3; w++) { const tw = (x + w * 2) % 6 < 3; P.put(x, y + w, M(tw ? 0xe8b878 : 0xc08848, 0x2a1406, w > 1 ? 0.4 : w < -1 ? -0 : 0.1)); }
            }
            for (let x = cx - 26; x <= cx + 10; x++) {   // a red gingham cloth over the near rim, its corner hanging down
                const drop = 6 + Math.round(Math.max(0, 1 - Math.abs(x - (cx - 8)) / 18) * 16);
                const y0 = Math.round(top + 7 * Math.sqrt(Math.max(0, 1 - ((x - cx) / 44) ** 2))) - 3;
                for (let y = y0; y < y0 + drop; y++) {
                    const chk = (Math.floor((x - cx) / 3) + Math.floor(y / 3)) % 2 === 0, edge = y === y0 + drop - 1;
                    let c = chk ? 0xd83a3a : 0xf6e8d8; if ((Math.floor((x - cx) / 3) % 2 === 0) && (Math.floor(y / 3) % 2 === 0)) c = 0xb02020;
                    if (edge) c = M(c, 0x1a0806, 0.4); if (x === cx - 26 || x === cx + 10) c = M(c, 0x1a0806, 0.25);
                    P.put(x, y, M(c, 0x1a0806, (y - y0) / drop * 0.2));
                }
            }
            for (let x = cx - 30; x < cx - 6; x += 7) { P.put(x, top + 20, 0xfff0c8); P.put(x + 1, top + 20, 0xe8c890); }   // glints on the weave
        });
    }

    // a bed growing: each spot's crop and when it's ripe, the fertilizer, and planting its empty spots
    _growPanel(k) {
        const s = Garden.state(), p = s.plots[k], b = Garden.bed(p, Date.now(), s);
        const kinds0 = new Set(p.cells.filter(Boolean).map(c => c.seed)).size, top = 56 + Math.max(1, Math.min(5, kinds0)) * 40;
        const { keep, x, y, w, D } = this._panel('THE FIELD', 0x9aff8a, top + 120);
        const kinds = [...new Set(p.cells.filter(Boolean).map(c => c.seed))];   // what's in the field, a row a crop
        kinds.slice(0, 4).forEach((id, j) => {
            const S = Garden.seed(id), mine = p.cells.filter(c => c?.seed === id), gs = mine.map(c => Garden.growth(c, Date.now(), s)), ripe = gs.filter(g => g.f >= 1).length;
            const soon = Math.min(...gs.filter(g => g.f < 1).map(g => g.left)), cy = y + 56 + j * 40, ik = this._cropTex(S, ripe ? 4 : 3);
            keep(this.add.sprite(x + 36, cy + 38, ik, '0').setOrigin(0.5, 1).setScale(1.4).setDepth(D + 2)).play(ik);
            keep(this.add.text(x + 64, cy + 8, `${S.name}  ×${mine.length}`, { fontSize: '13px', fontFamily: UIKit.FONT.title, fontStyle: 'bold', color: UIKit._hex(S.col) }).setDepth(D + 2));
            keep(this.add.text(w + x - 20, cy + 10, ripe ? `${ripe} ripe${ripe < mine.length ? `, the rest in ${this._time(soon)}` : ''}` : `ripe in ${this._time(soon)}`, { fontSize: '11px', fontFamily: 'monospace', color: '#d8e8e0' }).setOrigin(1, 0).setDepth(D + 2));
        });
        if (kinds.length > 4) keep(this.add.text(x + 64, y + 56 + 4 * 40 + 4, `and ${kinds.length - 4} more`, { fontSize: '11px', fontFamily: 'monospace', color: '#8aa898' }).setDepth(D + 2));
        keep(this.add.text(x + 20, y + top + 8, `Each plant gives its share of its crop's dust${p.fert ? ' (fertilized: doubled)' : ''}; each kind banks its blessing.`, { fontSize: '11px', fontFamily: 'monospace', color: '#a8b8b0', wordWrap: { width: w - 40 } }).setDepth(D + 2));
        UIKit.button(this, { x: x + w / 4 + 6, y: y + top + 70, w: w / 2 - 28, h: 40, fontSize: '12px', depth: D + 3, fireOn: 'down', label: p.fert ? `FERTILIZED: x2 ON ${p.fertN ?? Garden.FIELD} MORE` : s.fert ? `FERTILIZE  ·  ✿ ${s.fert} left` : 'NO FERTILIZER',
            accent: !p.fert && s.fert ? 0xffe08a : UIKit.PALETTE.line, onClick: () => {
                if (!Garden.fertilize(k)) { Sfx.play(this, 'deny'); return; }
                Sfx.play(this, 'e_combine'); this._closePanel();
            } }).objs.forEach(keep);
        UIKit.button(this, { x: x + w * 3 / 4 - 6, y: y + top + 70, w: w / 2 - 28, h: 40, fontSize: '12px', depth: D + 3, fireOn: 'down', label: b.empty ? `SOW THE ${b.empty} GAP${b.empty > 1 ? 'S' : ''}` : 'THE FIELD IS FULL',
            accent: b.empty ? 0x9aff8a : UIKit.PALETTE.line, onClick: () => { if (!b.empty) { Sfx.play(this, 'deny'); return; } this._closePanel(true); this._sprinkleStart(k); } }).objs.forEach(keep);
    }

    // the kiosk: the garden's tools for glorps, and rods for dust (the better ones opened by your best Tower floor)
    // The seed kiosk: a shop book with tabs (the garden's tools, rods, decor), every item on its own card with its
    // picture, what it does, and its price on a button under it (gold if you can, grey with why if you can't).
    _shopPanel(tab = this._shopTab || 'garden') {
        this._closePanel(true); this._shopTab = tab;
        const s = Garden.state(), best = typeof TowerFloors !== 'undefined' ? TowerFloors.best() : 0, W = this.scale.width, H = this.scale.height, D = 8000;
        const objs = this._panelObjs = [], keep = o => { objs.push(o); o?.setScrollFactor?.(0); return o; };
        const INK = '#3b2716', FADE = '#8a7254', HAND = 'Georgia, "Times New Roman", serif', pw = Math.min(W - 40, 900), ph = Math.min(H - 40, 640), px = W / 2 - pw / 2, py = H / 2 - ph / 2;
        keep(this.add.rectangle(0, 0, W, H, 0x05030a, 0.65).setOrigin(0).setDepth(D).setInteractive()).on('pointerdown', () => this._closePanel());
        const shd = keep(this.add.graphics().setDepth(D + 0.5)); shd.fillStyle(0x000000, 0.45); shd.fillRoundedRect(px + 10, py + 12, pw, ph, 14);
        keep(this.add.image(px, py, this._diaryTex('cover', pw, ph)).setOrigin(0).setDisplaySize(pw, ph).setDepth(D + 1));
        keep(this.add.image(px + 18, py + 18, this._diaryTex('pageR', pw - 36, ph - 36)).setOrigin(0).setDisplaySize(pw - 36, ph - 36).setDepth(D + 1.2)).setInteractive();
        const txt = (x, y, t, o = {}) => keep(this.add.text(x, y, t, Object.assign({ fontSize: '13px', fontFamily: HAND, fontStyle: 'italic', color: INK }, o)).setDepth(D + 3));
        txt(px + 40, py + 30, 'The Seed Kiosk', { fontSize: '26px', fontFamily: UIKit.FONT.title, fontStyle: 'bold' });
        txt(px + pw - 90, py + 38, `✦ ${this.glorps}    ✧ ${Enchants.dust()}`, { fontSize: '15px', fontStyle: 'bold', fontFamily: 'monospace', color: '#5a3a14' }).setOrigin(1, 0);
        UIKit.button(this, { x: px + pw - 46, y: py + 46, w: 40, h: 30, label: 'X', accent: UIKit.PALETTE.line, depth: D + 4, fontSize: '12px', fireOn: 'down', onClick: () => this._closePanel() }).objs.forEach(keep);
        // the tabs, as ribbons
        const TABS = [['garden', 'FOR THE GARDEN', 0x6ad8a0], ['rods', 'RODS', 0x5aa8e8], ['decor', 'DECOR', 0xb07aff], ['orchard', 'ORCHARD', 0xff8ad8]], tg = keep(this.add.graphics().setDepth(D + 2));
        TABS.forEach(([id, name, col], i) => {
            const on = id === tab, tx = px + 40 + i * 170, ty = py + 72, tw2 = 160;
            tg.fillStyle(MenuArt.mix(col, 0x1a0e08, on ? 0.15 : 0.55), 1); tg.fillRoundedRect(tx, ty, tw2, 30, 6);
            if (on) { tg.lineStyle(2, 0x3b2716, 1); tg.strokeRoundedRect(tx, ty, tw2, 30, 6); }
            txt(tx + tw2 / 2, ty + 15, name, { fontSize: '12px', fontStyle: 'bold', fontFamily: 'monospace', color: on ? '#ffffff' : '#e0d8c8' }).setOrigin(0.5);
            keep(this.add.zone(tx, ty, tw2, 30).setOrigin(0).setInteractive({ useHandCursor: true }).setDepth(D + 4)).on('pointerdown', () => { if (!on) { Sfx.play(this, 'e_flip'); this._shopPanel(id); } });
        });
        // the items
        const items = [];
        if (tab === 'garden') {
            const nt = Garden.nextTier(), why = Garden.rakeBlocked(this.glorps, best), nc = Garden.nextCan();
            items.push({ name: `Rake  ·  tier ${['I', 'II', 'III', 'IV'][s.tier]}`, icon: this._rakeTex(), desc: nt ? `Clears another bed (${nt.plots} in all) and banks ${nt.bank} blessings at once. It picks worms out, too.` : 'Every bed is cleared.',
                price: !nt ? 'ALL CLEARED' : why === 'floor' ? `TOWER FLOOR ${nt.floor}` : `✦ ${nt.cost}`, ok: !why, buy: () => { this.glorps -= nt.cost; Garden.buyRake(); } });
            items.push({ name: nc ? nc.name : Garden.can().name, icon: this._canTex(nc || Garden.can()), desc: nc ? `Crops you water with it grow x${nc.speed} as fast. (You have the ${Garden.can().name}, x${Garden.can().speed}.)` : 'The best can there is.',
                price: !nc ? 'YOURS' : best < nc.floor ? `TOWER FLOOR ${nc.floor}` : `✦ ${nc.cost}`, ok: !!nc && best >= nc.floor && this.glorps >= nc.cost, buy: () => { this.glorps -= nc.cost; Garden.buyCan(); } });
            items.push({ name: `Fertilizer  ·  you have ${s.fert}`, icon: this._fertTex(), desc: 'Doubles one growing bed\'s harvest. Hold it and press E on the bed.', price: `✦ ${Garden.FERT_COST}`, ok: this.glorps >= Garden.FERT_COST, buy: () => { this.glorps -= Garden.FERT_COST; Garden.buyFert(); } });
            for (const [kd, K] of Object.entries(Garden.TANK_KINDS)) {
                const T0 = Garden.tank(kd), open = Garden.tankOpen(kd, best);
                items.push({ name: T0 ? `${K.name}  ·  ${T0.slots} spaces` : K.name, icon: this._tankArt(kd, 'front'), icon2: this._tankArt(kd, 'back'),
                    desc: T0 ? (T0.slots < Garden.TANK_SLOTS_MAX ? 'Room for one more fish.' : 'As big as they come.') : kd === 'river' ? 'A glass tank on an oak cabinet, for river fish.' : kd === 'lake' ? 'An iron tank with a stone plinth, for lagoon fish.' : 'A pool sunk in cave rock, for the Underwell\'s fish.',
                    price: !T0 ? (open ? `✦ ${K.cost}` : kd === 'lake' ? `TOWER FLOOR ${Garden.LAKE_FLOOR}` : 'FIND THE UNDERWELL') : T0.slots >= Garden.TANK_SLOTS_MAX ? 'FULL SIZE' : `✦ ${Garden.TANK_SLOT_COST}`,
                    ok: !T0 ? open && this.glorps >= K.cost : T0.slots < Garden.TANK_SLOTS_MAX && this.glorps >= Garden.TANK_SLOT_COST,
                    buy: () => { if (!T0) { this.glorps -= K.cost; Garden.buyTank(kd); this._tanksSetup(); } else { this.glorps -= Garden.TANK_SLOT_COST; Garden.tankSlot(kd); } } });
            }
        } else if (tab === 'rods') {
            for (const R of Garden.RODS) {
                const own = Garden.ownsRod(R.id), cur = Garden.rod().id === R.id, lock = best < R.floor;
                items.push({ name: R.name, icon: this._rodTex(R), desc: `luck ${'●'.repeat(R.luck)}${'○'.repeat(4 - R.luck)}  rarer bites, more treasure\ncontrol ${'●'.repeat(R.ctl)}${'○'.repeat(4 - R.ctl)}  an easier reel`,
                    price: cur ? 'IN HAND' : own ? 'TAKE IT' : lock ? `TOWER FLOOR ${R.floor}` : `✧ ${R.cost}`, ok: !cur && (own || (!lock && Enchants.dust() >= R.cost)),
                    buy: () => { if (!own) { Enchants.addDust(-R.cost); Garden.buyRod(R.id); } else Garden.useRod(R.id); this.rodSpr.setTexture(this._rodTex(Garden.rod())); } });
            }
        } else if (tab === 'orchard') {
            const o = Garden.orchard(), no = Garden.nextOrch(), today = Garden.stock();
            items.push({ name: `Clear a plot  ·  ${o.orchard.length} of ${Garden.ORCH_TIERS[Garden.ORCH_TIERS.length - 1].n}`, icon: this._rakeTex(), desc: no ? 'Clears one more overgrown orchard plot in Starfall Grove.' : 'Every orchard plot is cleared.',
                price: !no ? 'ALL CLEARED' : best < no.floor ? `TOWER FLOOR ${no.floor}` : `✦ ${no.cost}`, ok: !!no && best >= no.floor && this.glorps >= no.cost, buy: () => { this.glorps -= no.cost; Garden.buyOrch(); } });
            // the starters always, today's two from the stock, then the rare ones (never sold: found)
            for (const Tr of [...Garden.TREES.filter(t => t.src === 'shop'), ...today.map(id => Garden.tree(id)), ...Garden.TREES.filter(t => t.src === 'drop')]) {
                const lock = best < Tr.floor, pots = o.saplings[Tr.id] || 0, rooted = o.orchard.filter(p => p.tree === Tr.id).length, drop = Tr.src === 'drop';
                items.push({ name: `${Tr.name}${pots + rooted ? `  ·  ${pots + rooted} yours` : ''}`, icon: this._treeTex(Tr, 3), frame: '0', tint: drop && !(pots + rooted) ? 0x3a3028 : null,
                    desc: drop ? (Tr.id === 'tendrilheart' ? 'Never sold. Something deep in the Tower carries these.' : Tr.id === 'voidpine' || Tr.id === 'nebulapalm' ? `Never sold. Tower bosses past floor ${Tr.floor} drop them, and the Underwell gives them up.` : `Never sold. Tower bosses past floor ${Tr.floor} drop them.`)
                        : `${Tr.src === 'stock' ? 'today only. ' : ''}${Tr.fruit} every ${Tr.every}h once grown (${Tr.grow}h)${Tr.time ? `, ${Tr.time} only` : ''}.\n${Tr.bless}: ${Tr.text}`,
                    price: drop ? 'FOUND, NOT SOLD' : lock ? `TOWER FLOOR ${Tr.floor}` : `✧ ${Tr.cost}`, ok: !drop && !lock && Enchants.dust() >= Tr.cost, buy: () => Garden.buySapling(Tr.id) });
            }
        } else {
            const mine = k2 => [...Garden.slots().bag, ...Garden.slots().chest].filter(o => o?.k === 'decor' && o.id === k2).length;
            items.push({ name: `Violet Lantern  ·  you have ${mine('lamp')}`, icon: this._lampTex(), desc: 'A lantern with a violet flame. Set it down in build mode (B).', price: `✧ ${Garden.DECOR.lamp.cost}`, ok: Enchants.dust() >= Garden.DECOR.lamp.cost, buy: () => Garden.buyDecor('lamp') });
            items.push({ name: `Potted Star Tree  ·  you have ${mine('pot')}`, icon: this._potTex(), desc: 'A little orchard tree in a clay pot, a different kind each one. Just for looks: it never fruits. Set it down in build mode (B).', price: `✧ ${Garden.DECOR.pot.cost}`, ok: Enchants.dust() >= Garden.DECOR.pot.cost, buy: () => Garden.buyDecor('pot') });
            items.push({ name: `Crystal Cluster  ·  you have ${mine('crystal')}`, icon: this._crystalTex(0xd8a8ff, 18), desc: 'A glowing cluster of Isle crystal. Set it down in build mode (B).', price: `✧ ${Garden.DECOR.crystal.cost}`, ok: Enchants.dust() >= Garden.DECOR.crystal.cost, buy: () => Garden.buyDecor('crystal') });
        }
        const cols = 3, gap = 18, cw = (pw - 80 - gap * (cols - 1)) / cols, chh = 196, top = py + 122;
        const per = cols * Math.max(1, Math.floor((py + ph - 70 - top + gap) / (chh + gap))), pages = Math.ceil(items.length / per);
        this._shopPg ||= {}; const pg = this._shopPg[tab] = Math.min(this._shopPg[tab] || 0, pages - 1);
        if (pages > 1) [[-1, '<'], [1, '>']].forEach(([d, l]) => UIKit.button(this, { x: px + pw / 2 + d * 90, y: py + ph - 44, w: 44, h: 30, label: l, fontSize: '14px', depth: D + 4, fireOn: 'down', accent: (pg + d >= 0 && pg + d < pages) ? UIKit.PALETTE.accentGold : UIKit.PALETTE.line,
            onClick: () => { if (pg + d < 0 || pg + d >= pages) return; this._shopPg[tab] = pg + d; Sfx.play(this, 'e_flip'); this._shopPanel(tab); } }).objs.forEach(keep));
        if (pages > 1) txt(px + pw / 2, py + ph - 44, `${pg + 1} / ${pages}`, { fontSize: '14px', fontStyle: 'bold' }).setOrigin(0.5);
        items.splice(0, pg * per); items.length = Math.min(items.length, per);
        items.forEach((it, i) => {
            const cx = px + 40 + (i % cols) * (cw + gap), cy = top + Math.floor(i / cols) * (chh + gap), tilt = ((i * 37) % 7 - 3) * 0.3;
            if (cy + chh > py + ph - 20) return;
            keep(this.add.image(cx + cw / 2 + 2, cy + chh / 2 + 3, this._diaryTex('card', cw, chh)).setDisplaySize(cw, chh).setAngle(tilt).setTint(0x000000).setAlpha(0.18).setDepth(D + 1.6));
            keep(this.add.image(cx + cw / 2, cy + chh / 2, this._diaryTex('card', cw, chh)).setDisplaySize(cw, chh).setAngle(tilt).setDepth(D + 1.7));
            if (it.icon2) { const i2 = keep(this.add.image(cx + cw / 2, cy + 46, it.icon2).setDepth(D + 2)); i2.setScale(64 / Math.max(i2.width, i2.height)); }
            const ic = keep(this.add.image(cx + cw / 2, cy + 46, it.icon, it.frame).setDepth(D + 2.01)); if (it.tint) ic.setTint(it.tint); ic.setScale((it.icon2 ? 64 : 54) / Math.max(ic.width, ic.height));
            txt(cx + cw / 2, cy + 82, it.name, { fontSize: '15px', fontStyle: 'bold italic' }).setOrigin(0.5, 0);
            txt(cx + cw / 2, cy + 104, it.desc, { fontSize: '11px', color: FADE, align: 'center', wordWrap: { width: cw - 24 }, lineSpacing: 2 }).setOrigin(0.5, 0);
            UIKit.button(this, { x: cx + cw / 2, y: cy + chh - 26, w: cw - 40, h: 32, fontSize: '12px', depth: D + 4, fireOn: 'down', label: it.price, accent: it.ok ? UIKit.PALETTE.accentGold : UIKit.PALETTE.line, onClick: () => {
                if (!it.ok) { Sfx.play(this, 'deny'); return; }
                it.buy(); localStorage.setItem('glorps', this.glorps); Sfx.play(this, 'pickup'); this._shopPanel(tab); this._hud();
            } }).objs.forEach(keep);
        });
    }
    _rakeTex() {
        return MenuArt.tex(this, 'gd4_rake', 16, 16, P => {
            for (let k = 0; k < 13; k++) { P.put(2 + k * 0.85, 14 - k * 0.85, 0x8a6a42); P.put(3 + k * 0.85, 14 - k * 0.85, 0x5a3a20); }
            for (let x = 9; x < 16; x++) P.put(x, 3, 0x9a9eb0); for (const x of [9, 11, 13, 15]) { P.put(x, 4, 0x6a6e80); P.put(x, 5, 0x6a6e80); }
            for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) if (P.alpha(x, y) > 0.9 && [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => P.alpha(x + dx, y + dy) < 0.5)) P.put(x, y, 0x1c1728);
        });
    }

    // ── THE GARDEN LOG ────────────────────────────────────────────────────────
    // An old book, open on the screen. Its ribbons are its chapters (plants, fish, the wardrobe). The
    // left page lists the chapter's entries a page at a time (what you haven't found as a dark shape),
    // the right page shows the one you pick, big and alive: a plant growing through its stages, a fish
    // swimming in its water. Turning a page turns it.
    _logPanel(...a) {
        if (a[3] && this._diaryTurning) return;   // a turn already under way: let it land (spamming next page tore it)
        const opening = !this._logOpen;
        this._logPanelBody(...a);
        if (opening && this._panelObjs) this._diaryOpen();
    }
    _logPanelBody(ch = this._logCh || 'plants', page = 0, pick = null, turn = 0) {
        const opening = !this._logOpen;   // (a fresh open swings the cover; turning within it doesn't)
        // a page turn: the side the leaf lands on keeps its old page until the leaf covers it
        const G0 = this._logGeo, D0 = 8000, onSide = (o, left) => { if (o?.active && o._side) return left ? o._side === 'L' : o._side === 'R'; if (!G0 || !o?.active || o.type === 'Zone' || o.type === 'Graphics' || !o.getBounds || o.depth <= D0 || o.depth >= D0 + 6) return false; const b = o.getBounds(), cx = b.centerX, cy = b.centerY; if (cy < G0.py || cy > G0.py + G0.ph) return false; return left ? cx > G0.lx && cx < G0.lx + G0.pw : cx > G0.rx && cx < G0.rx + G0.pw; };
        // a page turn: photograph both old pages before they're cleared (the leaf's front, and the page it lands on)
        const snap = (left) => { if (!G0 || !this._panelObjs) return null; const key = `diary_snap_${left ? 'L' : 'R'}_${Date.now()}`, dt = this.textures.addDynamicTexture(key, Math.ceil(G0.pw), Math.ceil(G0.ph)); const list = this._panelObjs.filter(o => onSide(o, left) && o.visible).sort((a, b) => a.depth - b.depth); this._stamp(dt, list, left ? G0.lx : G0.rx, G0.py); return key; };
        const oldL = turn ? snap(true) : null, oldR = turn ? snap(false) : null;
        this._closePanel(true);
        this._logCh = ch;
        const W = this.scale.width, H = this.scale.height, D = 8000, objs = this._panelObjs = [], keep = o => { objs.push(o); o?.setScrollFactor?.(0); return o; };
        const s = Garden.state(), bw = Math.min(W - 40, 1000), bh = Math.min(H - 110, 620), bx = W / 2 - bw / 2, by = H / 2 - bh / 2 + 26, INK = '#3b2716', FADE = '#8a7254';
        keep(this.add.rectangle(0, 0, W, H, 0x05030a, 0.65).setOrigin(0).setDepth(D).setInteractive());   // holds the clicks behind the book (it closes from its own button, L or Esc, not a stray click)
        this._logOpen = true;
        for (const o of this._hudObjs || []) o.setVisible?.(false);   // the Garden's own HUD poked out round the book (and under its ribbons): put away while it's open
        // a big screen: the book is laid out at its own size and drawn through a camera of its own, zoomed to fill more of the screen
        const zoom = Math.min((W - 40) / 1040, (H - 30) / 740);
        if (zoom > 1.05 && !this._bookCam) {
            this._bookCam = this.cameras.add(0, 0, W, H).setZoom(zoom);
            this.events.off('prerender', this._bookCamSync, this); this.events.on('prerender', this._bookCamSync, this);
        }
        const g = keep(this.add.graphics().setDepth(D + 1.5));
        // an old diary: tooled leather, brass corners, a stitched spine, yellowed pages ruled in faded ink
        const pw = (bw - 60) / 2, ph = bh - 44, lx = bx + 24, rx = bx + 36 + pw, py = by + 22;
        this._logGeo = { pw, ph, lx, rx, py };
        const shd = keep(this.add.graphics().setDepth(D + 0.9)); shd.fillStyle(0x000000, 0.45); shd.fillRoundedRect(bx + 10, by + 12, bw, bh, 14);
        const cover = keep(this.add.image(bx, by, this._diaryTex('cover', bw, bh)).setOrigin(0).setDisplaySize(bw, bh).setDepth(D + 1));
        const pgL = keep(this.add.image(lx, py, this._diaryTex('pageLC', pw, ph)).setOrigin(0).setDisplaySize(pw, ph).setDepth(D + 1.2)); pgL._side = 'L';
        keep(this.add.image(rx, py, this._diaryTex('pageRC', pw, ph)).setOrigin(0).setDisplaySize(pw, ph).setDepth(D + 1.2));
        // depth: the boards' thickness under the pages, the page blocks' stacked edges, the raised spine with its
        // headbands and stitching, a curl at the outer corners
        const dg = keep(this.add.graphics().setDepth(D + 1.1));
        for (let k = 0; k < 6; k++) { dg.fillStyle(k % 2 ? 0xd8c8a0 : 0xeee0c0, 1); dg.fillRect(lx - 6 + k, py + 2 + k * 0.5, 2, ph - 2); dg.fillRect(rx + pw + 4 - k, py + 2 + k * 0.5, 2, ph - 2); }
        dg.fillStyle(0x1e0c06, 1); dg.fillRect(bx + 4, by + bh - 4, bw - 8, 7); dg.fillStyle(0x3a180c, 1); dg.fillRect(bx + 6, by + bh - 4, bw - 12, 3);
        const sg = keep(this.add.graphics().setDepth(D + 1.4)), spx = (lx + pw + rx) / 2;
        sg.fillStyle(0x2a1208, 1); sg.fillRect(spx - 6, by + 4, 12, bh - 8); sg.fillStyle(0x5a2a16, 1); sg.fillRect(spx - 4, by + 4, 4, bh - 8); sg.fillStyle(0x7a3a1e, 1); sg.fillRect(spx - 3, by + 4, 1, bh - 8);
        for (let y = by + 18; y < by + bh - 18; y += 10) { sg.fillStyle(0xd8c098, 1); sg.fillRect(spx - 1, y, 2, 5); }
        for (const hy of [py - 6, py + ph + 1]) { sg.fillStyle(0xa02a2a, 1); sg.fillRect(spx - 7, hy, 14, 5); sg.fillStyle(0xd8b84a, 1); sg.fillRect(spx - 7, hy + 2, 14, 1); }
        for (const [cx2, d] of [[lx, 1], [rx + pw, -1]]) { sg.fillStyle(0xf8eed0, 1); sg.fillTriangle(cx2, py + ph, cx2 + d * 18, py + ph, cx2, py + ph - 18); sg.fillStyle(0xc8b088, 1); sg.fillTriangle(cx2 + d * 18, py + ph, cx2, py + ph - 18, cx2 + d * 4, py + ph - 4); }
        this._diaryParts = { cover, pgL, g, dg, shd, bx, by, bw, bh, spx, D };
        const SAG = 12, dip = u => SAG * Math.pow(u, 3);   // how far a page's edge dips at u (0 outer edge, 1 the spine), in px
        for (let k = 0; k < 14; k++) { const d = dip(1 - k / pw); g.fillStyle(0x000000, 0.2 * (1 - k / 14)); g.fillRect(lx + pw - k, py + d, 1, ph - d * 1.6); g.fillRect(rx + k - 1, py + d, 1, ph - d * 1.6); }   // the gutter's shadow
        for (let k = 0; k < 4; k++) {   // the page block's edge under each page, stacked, curving down into the spine with it
            g.lineStyle(2, k % 2 ? 0xc8b890 : 0xe0d0a8, 1);
            for (const [x0, sgn] of [[lx, 1], [rx + pw, -1]]) { g.beginPath(); for (let i = 0; i <= 24; i++) { const u = i / 24, x = x0 + sgn * (u * pw - 3 + k); const y = py + ph + k + 1 - dip(u) * 0.6; i ? g.lineTo(x, y) : g.moveTo(x, y); } g.strokePath(); }
        }
        // the chapters: silk ribbon bookmarks tucked into the book, their notched ends standing up over its top edge,
        // each with its chapter's creature stitched on. The open chapter's ribbon is pulled up higher and lit.
        const CH = [['plants', 'Plants', 0x4aa878], ['orchard', 'Orchard', 0xd87ab8], ['fish', 'Fish', 0x3a7ac8], ['worms', 'Worms', 0xc85a6a], ['pets', 'Pets', 0xd8a040], ['wardrobe', 'Hats', 0x8a5ad0]];
        const ci = CH.findIndex(c => c[0] === ch), rg = keep(this.add.graphics().setDepth(D + 1.45)), RW = 54, RG = 10; rg._ribbon = true;
        const rx0 = rx + pw - 24 - CH.length * (RW + RG) + RG;
        CH.forEach(([id, name, col], i) => {
            const on = i === ci, x0 = rx0 + i * (RW + RG), top = by - (on ? 62 : 50), bot = by + 8, dk = MenuArt.mix(col, 0x0a0604, 0.45), hi = MenuArt.mix(col, 0xffffff, 0.35);
            const notch = [{ x: x0, y: top }, { x: x0 + RW / 2, y: top + 12 }, { x: x0 + RW, y: top }, { x: x0 + RW, y: bot }, { x: x0, y: bot }];
            rg.fillStyle(0x000000, 0.35); rg.fillPoints(notch.map(p2 => ({ x: p2.x + 3, y: p2.y + 4 })), true);
            rg.fillStyle(on ? col : MenuArt.mix(col, 0x2a1a10, 0.25), 1); rg.fillPoints(notch, true);
            rg.fillStyle(dk, 0.55); rg.fillRect(x0 + RW - 7, top + 4, 7, bot - top - 4);                    // the fold's shade
            rg.fillStyle(hi, on ? 0.45 : 0.25); rg.fillRect(x0 + 4, top + 6, 4, bot - top - 6);             // the silk's sheen
            rg.lineStyle(1, MenuArt.mix(col, 0xffffff, 0.6), 0.6);                                          // its stitched hem
            for (let y = top + 18; y < bot - 6; y += 7) { rg.lineBetween(x0 + 3, y, x0 + 3, y + 3); rg.lineBetween(x0 + RW - 3, y, x0 + RW - 3, y + 3); }
            rg.fillStyle(0x000000, 0.3); rg.fillRect(x0, by + 2, RW, 6);                                      // where it goes in under the cover's rim
            const sample = id === 'plants' ? this._cropTex(Garden.SEEDS[0], 4) : id === 'orchard' ? this._treeTex(Garden.TREES[1], 3) : id === 'fish' ? this._fishTex(Garden.FISH[0]) : id === 'worms' ? this._wormTex(Garden.WORMS[0]) : id === 'pets' ? this._petTex(Garden.PETS[0]) : null;
            if (sample) { const ic = keep(this.add.sprite(x0 + RW / 2, top + 24, sample, '0').setDepth(D + 1.46)); ic.setScale(24 / Math.max(ic.width, ic.height)); ic._ribbon = true; if (on) ic.play(sample); else ic.setAlpha(0.8); }
            else { rg.fillStyle(0x1a1028, 1); rg.fillRect(x0 + RW / 2 - 8, top + 30, 16, 3); rg.fillRect(x0 + RW / 2 - 5, top + 19, 10, 11); rg.fillStyle(0xd8b84a, 1); rg.fillRect(x0 + RW / 2 - 5, top + 26, 10, 2); }   // a top hat
            keep(this.add.text(x0 + RW / 2, top + 37, name, { fontSize: '12px', fontFamily: UIKit.FONT.title, fontStyle: 'bold', color: '#ffffff', stroke: '#1a0e08', strokeThickness: 3 }).setOrigin(0.5, 0).setDepth(D + 1.46).setAlpha(on ? 1 : 0.85))._ribbon = true;
            keep(this.add.zone(x0, top, RW, by - top + 4).setOrigin(0).setInteractive({ useHandCursor: true }).setDepth(D + 4)).on('pointerdown', () => { if (!on) this._logPanel(id, 0, null, (i > ci ? 1 : -1) * Math.abs(i - ci) * 2); });
        });
        UIKit.button(this, { x: bx + 74, y: by - 30, w: 140, h: 40, label: '✕  CLOSE', accent: UIKit.PALETTE.accentGold, depth: D + 4, fontSize: '15px', fireOn: 'down', onClick: () => this._closePanel() }).objs.forEach(o => { o._close = true; keep(o); });   // up by the book's top-left corner, clear of the ribbons
        const HAND = 'Georgia, "Times New Roman", serif';   // written by hand, in ink
        const txt = (x, y, s2, o = {}) => keep(this.add.text(x, y, s2, Object.assign({ fontSize: '13px', fontFamily: HAND, fontStyle: 'italic', color: INK }, o)).setDepth(D + 2));
        // the chapter's entries
        const L = ch === 'plants' ? Garden.SEEDS : ch === 'orchard' ? Garden.TREES : ch === 'fish' ? Garden.FISH : ch === 'worms' ? Garden.WORMS : ch === 'pets' ? Garden.PETS : Garden.HATS;
        const got = e => ch === 'orchard' ? !!(s.treeLog || {})[e.id] : ch === 'pets' ? Garden.ownsPet(e.id) : ch === 'plants' ? Garden.known(e.id) : ch === 'fish' ? ((s.fishLog || {})[e.id] || 0) > 0 : ch === 'worms' ? (e.pest ? ((s.wormLog || {})[e.id] || 0) > 0 : !!s.wormTut) : (s.hats || []).includes(e);
        const COLS = 3, ROWS = 3, PER = COLS * ROWS, pages = Math.max(1, Math.ceil(L.length / PER)); page = Math.min(page, pages - 1);
        pick ??= L[page * PER];
        const title = ch === 'plants' ? 'The Plantdex' : ch === 'orchard' ? 'The Orchard' : ch === 'fish' ? 'Fish of the Isle' : ch === 'worms' ? 'Things in the Soil' : ch === 'pets' ? 'Companions' : 'The Wardrobe';
        txt(lx + 20, py + 12, title, { fontSize: '26px', fontFamily: UIKit.FONT.title, fontStyle: 'bold' });
        g.lineStyle(1.5, 0x5a3a20, 0.7); g.lineBetween(lx + 20, py + 44, lx + pw - 20, py + 44); g.lineBetween(lx + 20, py + 47, lx + pw * 0.6, py + 47);
        txt(lx + 20, py + 52, `${L.filter(got).length} of ${L.length} ${ch === 'wardrobe' ? 'hats found (rare catches)' : 'found'}`, { fontSize: '11px', color: FADE });
        const cw = (pw - 40 - (COLS - 1) * 10) / COLS, chh = Math.min(118, (ph - 130 - (ROWS - 1) * 10) / ROWS);
        L.slice(page * PER, page * PER + PER).forEach((e, j) => {
            const cx = lx + 20 + (j % COLS) * (cw + 10), cy = py + 72 + Math.floor(j / COLS) * (chh + 10), have = got(e), on = e === pick;
            const tilt = ((j * 37) % 7 - 3) * 0.6;   // pasted-in specimen cards, a touch crooked, taped; the picked one ringed in red ink
            keep(this.add.image(cx + cw / 2 + 2, cy + chh / 2 + 3, this._diaryTex('card', cw, chh)).setDisplaySize(cw, chh).setAngle(tilt).setTint(0x000000).setAlpha(0.18).setDepth(D + 1.6));
            keep(this.add.image(cx + cw / 2, cy + chh / 2, this._diaryTex('card', cw, chh)).setDisplaySize(cw, chh).setAngle(tilt).setTint(have ? 0xffffff : 0xd8ccb0).setDepth(D + 1.7));
            for (const tx2 of [cx + 8, cx + cw - 30]) keep(this.add.rectangle(tx2, cy - 4, 22, 9, 0xf0e8c8, 0.75).setOrigin(0).setAngle(tilt + (tx2 > cx + 20 ? 8 : -8)).setDepth(D + 1.8));
            if (on) { const ring = keep(this.add.graphics().setDepth(D + 1.9)); ring._side = 'L'; ring.lineStyle(2.5, 0xa02a1a, 0.85); ring.strokeEllipse(cx + cw / 2, cy + chh / 2, cw + 12, chh + 10); ring.strokeEllipse(cx + cw / 2 + 1, cy + chh / 2 - 1, cw + 16, chh + 8); }
            const ik = ch === 'plants' ? this._cropTex(e, 4) : ch === 'orchard' ? this._treeTex(e, 3) : ch === 'fish' ? this._fishTex(e) : ch === 'worms' ? this._wormTex(e) : ch === 'pets' ? this._petTex(e) : null;
            if (ik) { const sp = keep(this.add.sprite(cx + cw / 2, cy + chh * 0.45, ik, '0').setScale(ch === 'plants' ? 1.7 : ch === 'orchard' ? 1.05 : 1.5).setDepth(D + 2)); if (have) sp.play(ik); else sp.setTint(0x3a3028); }
            else { const sp = keep(this.add.sprite(cx + cw / 2, cy + chh * 0.5, 'slime_blue', 0).setScale(2.4).setDepth(D + 2)); if (!have) sp.setTint(0x3a3028); else if (typeof CreatureFX !== 'undefined') { const u = CreatureFX.face(this, sp, { mood: 'friend' }); if (u) { CreatureFX.dress(u, e); u.eyes?.setScrollFactor(0).setDepth(D + 3); u.hat?.setScrollFactor(0).setDepth(D + 3); objs.push({ destroy: () => { u.eyes?.destroy(); u.hat?.destroy(); } }); } } }
            txt(cx + cw / 2, cy + chh - 20, have ? (ch === 'wardrobe' ? e : e.name) : '???', { fontSize: '12px', color: have ? INK : FADE }).setOrigin(0.5, 0);
            keep(this.add.zone(cx, cy, cw, chh).setOrigin(0).setInteractive({ useHandCursor: true }).setDepth(D + 4)).on('pointerdown', () => { if (!on) { Sfx.play(this, 'hover'); this._logPanel(ch, page, e); } });
        });
        if (pages > 1) {
            txt(lx + pw / 2, py + ph - 40, `${page + 1} / ${pages}`, { fontSize: '15px', color: FADE }).setOrigin(0.5, 0);
            // the page arrows: an inked arrow in a round paper button, big enough to hit, that lifts when you're over it
            for (const [dx, dir] of [[-78, -1], [78, 1]]) {
                const ax = lx + pw / 2 + dx, ay = py + ph - 31, b = keep(this.add.container(ax, ay).setDepth(D + 3)), gb = this.add.graphics();
                const draw = hov => { gb.clear(); gb.fillStyle(0x000000, 0.18); gb.fillCircle(1, 2, 19); gb.fillStyle(hov ? 0xfff4d8 : 0xf0e2c0, 1); gb.fillCircle(0, 0, 18); gb.lineStyle(2, 0x5a3a20, hov ? 1 : 0.75); gb.strokeCircle(0, 0, 18);
                    gb.fillStyle(0x3b2716, 1); gb.fillTriangle(dir * 9, 0, -dir * 5, -9, -dir * 5, 9); gb.fillStyle(0x3b2716, 1); gb.fillRect(dir > 0 ? -9 : 5, -3, 5, 6); };
                draw(false); b.add(gb);
                keep(this.add.zone(ax, ay, 46, 46).setInteractive({ useHandCursor: true }).setDepth(D + 4))
                    .on('pointerover', () => { draw(true); b.setScale(1.1); }).on('pointerout', () => { draw(false); b.setScale(1); })
                    .on('pointerdown', () => { Sfx.play(this, 'e_flip'); this._logPanel(ch, (page + dir + pages) % pages, null, dir); });
            }
        }
        // the right page: the one you picked, alive
        const cxr = rx + pw / 2;
        if (!pick) return;
        const have = got(pick);
        if (ch === 'plants') {
            const S = pick, big = keep(this.add.sprite(cxr, py + 206, this._cropTex(S, 0), '0').setOrigin(0.5, 1).setScale(5).setDepth(D + 2));
            if (!have) big.setTint(0x3a3028);
            const strip = [0, 1, 2, 3, 4].map(st => { const sp = keep(this.add.sprite(rx + 40 + st * (pw - 80) / 4, py + 268, this._cropTex(S, st), '0').setOrigin(0.5, 1).setScale(1.5).setDepth(D + 2)); if (!have) sp.setTint(0x3a3028); return sp; });
            const stl = txt(cxr, py + 206, '', { fontSize: '10px', fontStyle: 'bold', color: FADE }).setOrigin(0.5, 0);
            let st = 0, held = false;
            const show = () => { if (!big.active) return; const ik = this._cropTex(S, st); big.setTexture(ik, '0'); if (st === 4 && have) big.play(ik); else big.stop(); strip.forEach((sp, j) => sp.setAlpha(j === st ? 1 : 0.35)); stl.setText(have ? ['a seed', 'a sprout', 'growing', 'nearly there', 'ripe'][st] + (held ? '  (held)' : '') : ''); };
            const step = () => { if (held) return; show(); st = (st + 1) % 5; };
            step(); keep(this.time.addEvent({ delay: 700, loop: true, callback: step }));
            // click a stage to hold it there, click it again (or the big one) to let it cycle
            const hold = j => { held = !(held && (j === undefined || j === st)); if (j !== undefined) st = j; else if (held) st = (st + 4) % 5; show(); if (!held) st = (st + 1) % 5; Sfx.play(this, 'hover'); };
            big.setInteractive({ useHandCursor: true }).on('pointerdown', () => hold());
            strip.forEach((sp, j) => sp.setInteractive({ useHandCursor: true }).on('pointerdown', () => hold(j)));
            txt(rx + 24, py + 290, have ? S.name : '???', { fontSize: '22px', fontFamily: UIKit.FONT.title, fontStyle: 'bold' });
            const src = S.src === 'tower' ? `from the Tower (tier ${['', 'I', 'II', 'III'][S.t]}${S.t > 1 ? `, floor ${S.t === 2 ? 10 : 25}+` : ''})` : S.src === 'river' ? 'fished from the river' : S.src === 'lake' ? 'fished from the lake' : S.src === 'cosmic' ? 'fished from the Underwell' : S.src === 'sky' ? 'fished from the Cloud Sea' : S.src === 'mud' ? 'pulled up out of the mud' : S.src === 'feat' ? `the reward for the achievement ${Achievements.def(S.feat)?.name}` : 'a secret: somewhere in the garden';
            txt(rx + 24, py + 322, have ? `${src}${S.time ? (S.time === 'night' ? '  ·  grows only at night' : '  ·  grows only by day') : ''}\nripe in ${this._time(S.hrs * 3600000)}  ·  ✧${S.dust} a harvest  ·  you have ${s.seeds[S.id] || 0}\n\n${S.bless ? `blessing: ${S.bless}\n${S.text}` : 'no blessing: a rare one, for the collection'}` : `${S.secret ? 'somewhere in the garden, something glimmers...' : src}`, { fontSize: '12px', lineSpacing: 5, wordWrap: { width: pw - 48 } });
        } else if (ch === 'orchard') {   // the tree growing up through its stages, over and over
            const Tr = pick, big = keep(this.add.sprite(cxr, py + 236, this._treeTex(Tr, 0), '0').setOrigin(0.5, 1).setScale(3.4).setDepth(D + 2));
            if (!have) big.setTint(0x3a3028);
            let st = 0, held = false;
            const step = () => { if (!big.active || held) return; const ik = this._treeTex(Tr, st); big.setTexture(ik, '0'); if (have) big.play(ik); st = (st + 1) % 4; };
            step(); keep(this.time.addEvent({ delay: 900, loop: true, callback: step }));
            big.setInteractive({ useHandCursor: true }).on('pointerdown', () => { held = !held; Sfx.play(this, 'hover'); });   // click to hold the stage it's on
            txt(rx + 24, py + 256, have ? Tr.name : '???', { fontSize: '22px', fontFamily: UIKit.FONT.title, fontStyle: 'bold' });
            txt(rx + 24, py + 290, have ? `${Tr.src === 'shop' ? 'a sapling from the seed kiosk' : Tr.src === 'stock' ? 'in the kiosk\'s stock some days' : Tr.id === 'tendrilheart' ? 'a deep Tower boss carried it' : 'dropped by Tower bosses, never sold'}${Tr.time ? (Tr.time === 'night' ? '  ·  grows only at night' : '  ·  grows only by day') : ''}\ngrown in ${Tr.grow}h, then ${Tr.fruit} every ${Tr.every}h  ·  ✧${Tr.dust} a crop\npicked ${(s.fruitLog || {})[Tr.id] || 0} times\n\nblessing: ${Tr.bless}\n${Tr.text}` : `Nobody here has planted one yet.${Tr.src === 'drop' ? ` Tower bosses past floor ${Tr.floor} carry these.` : Tr.floor ? ` The kiosk sells it once you reach Tower floor ${Tr.floor}.` : ''}`, { fontSize: '12px', lineSpacing: 5, wordWrap: { width: pw - 48 } });
        } else if (ch === 'fish') {
            const F = pick, wg = keep(this.add.graphics().setDepth(D + 2)); wg._side = 'R';
            const [w0, w1] = { sky: [0x5a98e0, 0xc8e0fa], cosmic: [0x5a30b0, 0x12042a], mud: [0x8a7a4a, 0x2a1a0a], lake: [0x3a8080, 0x0a2232] }[F.where] || [0x5a9ad0, 0x10284a];   // its own water
            for (let i = 0; i < 8; i++) { wg.fillStyle(MenuArt.mix(w0, w1, i / 7), 1); wg.fillRect(rx + 30, py + 40 + i * 24, pw - 60, 24); }
            wg.lineStyle(3, 0x8a6a2a, 1); wg.strokeRect(rx + 30, py + 40, pw - 60, 192);
            (this._bub = keep(this.add.particles(0, 0, 'mn_px2', { x: { min: rx + 40, max: rx + pw - 40 }, y: py + 228, lifespan: 2200, speedY: { min: -90, max: -50 }, scale: { start: 1.4, end: 0.4 }, alpha: { start: 0.8, end: 0 }, tint: [0xd8f0ff], frequency: 160 }).setDepth(D + 2)))._side = 'R';
            const fs = keep(this.add.sprite(cxr, py + 136, this._fishTex(F), '0').setScale(4).setDepth(D + 3));
            if (have) fs.play(this._fishTex(F)); else fs.setTint(0x1a2030);
            this.tweens.add({ targets: fs, x: cxr + 60, duration: 2400, yoyo: true, repeat: -1, ease: 'Sine.easeInOut', onYoyo: () => fs.setFlipX(true), onRepeat: () => fs.setFlipX(false) });
            this.tweens.add({ targets: fs, y: py + 126, duration: 1300, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
            const pool = Garden.FISH.filter(f => f.where === F.where), pct = F.w / pool.reduce((a, f) => a + f.w, 0) * 100;
            txt(rx + 24, py + 250, have ? F.name : '???', { fontSize: '22px', fontFamily: UIKit.FONT.title, fontStyle: 'bold' });
            txt(rx + 24, py + 282, `${F.where === 'river' ? 'the river' : F.where === 'mud' ? 'a mud patch, somewhere' : F.where === 'cosmic' ? 'the Underwell (deep under the Isle)' : F.where === 'sky' ? 'the Cloud Sea (up the trampoline)' : 'the lake (the Lagoon)'}  ·  ${pct < 1 ? pct.toFixed(1) : Math.round(pct)}% of bites there\n${F.time ? (F.time === 'night' ? 'only at night  ·  ' : 'only by day  ·  ') : F.where === 'cosmic' ? '' : 'day or night  ·  '}${have ? `✧${F.dust} a catch${F.seed ? `  ·  ${Math.round(F.seed * 100)}% a seed` : ''}\nlanded ${(s.fishLog || {})[F.id]}` : 'not landed yet'}`, { fontSize: '12px', lineSpacing: 5, wordWrap: { width: pw - 48 } });
        } else if (ch === 'pets') {
            const Pt = pick, ik = this._petTex(Pt), big = keep(this.add.sprite(cxr, py + 200, ik, '0').setScale(6).setDepth(D + 2)), out = Garden.state().pet === Pt.id;
            if (have) big.play(ik); else big.setTint(0x3a3028);
            this.tweens.add({ targets: big, y: py + 190, duration: 1200, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
            txt(rx + 24, py + 290, have ? Pt.name : '???', { fontSize: '22px', fontFamily: UIKit.FONT.title, fontStyle: 'bold' });
            txt(rx + 24, py + 324, have ? `${Pt.text}\nwhile it's with you: ${Pt.perk}` : 'Something lives in the water... very rarely, it follows you home.', { fontSize: '12px', lineSpacing: 5, wordWrap: { width: pw - 48 } });
            if (have) UIKit.button(this, { x: cxr, y: py + ph - 60, w: 240, h: 36, label: out ? 'SEND IT HOME' : 'TAKE IT ALONG', accent: 0xffd070, depth: D + 4, fontSize: '13px', fireOn: 'down', onClick: () => {
                Garden.usePet(out ? null : Pt.id); this._petSetup(); Sfx.play(this, 'pickup'); this._logPanel(ch, page, Pt);
            } }).objs.forEach(keep);
        } else if (ch === 'worms') {
            const Wm = pick, ik = this._wormTex(Wm), big = keep(this.add.sprite(cxr, py + 220, ik, '0').setOrigin(0.5, 0.95).setScale(6).setDepth(D + 2));
            if (have) big.play(ik); else big.setTint(0x3a3028);
            txt(rx + 24, py + 250, have ? Wm.name : '???', { fontSize: '22px', fontFamily: UIKit.FONT.title, fontStyle: 'bold' });
            txt(rx + 24, py + 284, have ? `${Wm.pest ? 'a pest: pick it out' : 'a helper: leave it be'}\n${Wm.text}${Wm.pest ? `\npicked ${(s.wormLog || {})[Wm.id] || 0}` : ''}` : Wm.w <= 3 ? 'something rare turns up in the soil now and then...' : 'worms turn up in growing beds; a rake gets them out', { fontSize: '12px', lineSpacing: 5, wordWrap: { width: pw - 48 } });
        } else {
            const h = pick, wearing = s.hat === h, sp = keep(this.add.sprite(cxr, py + 180, 'slime_blue', 0).setScale(7).setDepth(D + 2));
            if (!have) sp.setTint(0x3a3028);
            else if (typeof CreatureFX !== 'undefined') { const u = CreatureFX.face(this, sp, { mood: 'friend' }); if (u) { CreatureFX.dress(u, h); u.eyes?.setScrollFactor(0).setDepth(D + 3); u.hat?.setScrollFactor(0).setDepth(D + 3); objs.push({ destroy: () => { u.eyes?.destroy(); u.hat?.destroy(); } }); } }
            txt(rx + 24, py + 290, have ? h : '???', { fontSize: '22px', fontFamily: UIKit.FONT.title, fontStyle: 'bold' });
            txt(rx + 24, py + 322, have ? 'A hat for the slime, worn here and in fights.' : 'A rare catch: the better your rod, the likelier.', { fontSize: '12px', wordWrap: { width: pw - 48 } });
            if (have) UIKit.button(this, { x: cxr, y: py + ph - 60, w: 220, h: 36, label: wearing ? 'TAKE IT OFF' : 'WEAR IT', accent: 0xb07aff, depth: D + 4, fontSize: '13px', fireOn: 'down', onClick: () => {
                Garden.wearHat(wearing ? null : h); const u = this.player._cfx; if (u) CreatureFX.dress(u, wearing ? null : h); Sfx.play(this, 'pickup'); this._logPanel(ch, page, h);
            } }).objs.forEach(keep);
        }
        // the page turning: the leaf (old page on its front, new page on its back) bends over the spine. The side it
        // lands on keeps its old page until covered. A jump of several chapters flips plain leaves first.
        if (turn && oldL && oldR) {
            const fwd = turn > 0, land = objs.filter(o => onSide(o, fwd));
            // the side it lands on keeps its old page until the leaf is down on it
            land.forEach(o => { o._a0 = o.alpha; o.setAlpha(0); });
            const stay = keep(this.add.image(fwd ? lx : rx, py, fwd ? oldL : oldR).setOrigin(0).setDepth(D + 5.5));
            const extra = Math.min(4, Math.abs(turn) - 1), spine = (lx + pw + rx) / 2, gap = 110;
            // the leaf (a pixel flipbook, _flip) carries the pages printed on it: its front is the old page it lifts off (the
            // slice of it the leaf still covers, lit as the leaf faces you), its back the new page it lands with. The page
            // under the leaf on the side it lifts from shows through as it goes; the side it lands on is there when it lands.
            const page = o => o.texture?.key?.startsWith?.('diary_page');   // the paper itself stays; only what's written on it is printed
            const ink = land.filter(o => o.visible !== false && !page(o)).sort((a, b) => a.depth - b.depth);
            const newKey = `diary_snap_new_${Date.now()}`, ndt = this.textures.addDynamicTexture(newKey, Math.ceil(pw), Math.ceil(ph));
            land.forEach(o => o.setAlpha(o._a0 ?? 1)); this._stamp(ndt, ink, fwd ? lx : rx, py); land.forEach(o => o.setAlpha(0));
            const fromX = fwd ? rx : lx, toX = fwd ? lx : rx;
            const front = keep(this.add.image(fromX, py, fwd ? oldR : oldL).setOrigin(0).setDepth(D + 6.3));
            const back = keep(this.add.image(toX, py, newKey).setOrigin(0).setDepth(D + 6.3).setVisible(false));
            const onFrame = (cr, cl, lit, isFront, spineX) => {
                const covR = fwd ? cr : cl, covL = fwd ? cl : cr, g = Math.round(255 * lit), tint = Phaser.Display.Color.GetColor(g, g, Math.round(g * 0.96));
                if (isFront) {   // the old page, on the leaf, as much of it as the leaf still covers
                    const w = Math.max(0, covR - Math.abs((fwd ? fromX : fromX + pw) - spineX)); back.setVisible(false);
                    front.setVisible(w > 1).setTint(tint).setCrop(fwd ? 0 : pw - w, 0, w, ph);
                } else {         // the new page, on the leaf's back, as much as it covers on the landing side
                    const w = Math.max(0, covL - Math.abs(spineX - (toX + (fwd ? pw : 0)))); front.setVisible(false);
                    back.setVisible(w > 1).setTint(tint).setCrop(fwd ? pw - w : 0, 0, w, ph);
                }
            };
            const done = () => {
                this._diaryTurning = false;
                stay.destroy(); front.destroy(); back.destroy();
                land.forEach(o => o.active && o.setAlpha(o._a0 ?? 1));   // the page it brought is already in place
                this.time.delayedCall(30, () => { for (const k of [oldL, oldR, newKey]) if (this.textures.exists(k)) this.textures.remove(k); });
            };
            this._diaryTurning = true; this.time.delayedCall(extra * gap + 900, () => { this._diaryTurning = false; });   // (and in case it never lands)
            for (let n = 0; n < extra; n++) this._flip({ spine, y: py, w: pw, h: ph, dir: fwd ? 1 : -1, dur: 300, delay: n * gap, D: D + 6 + n * 0.01, keep });
            this._flip({ spine, y: py, w: pw, h: ph, dir: fwd ? 1 : -1, dur: 560, delay: extra * gap, D: D + 6.2, keep, onFrame, onDone: done });
            for (let n = 0; n <= extra; n++) this.time.delayedCall(n * gap, () => Sfx.play(this, 'e_flip'));
        } else for (const k of [oldL, oldR]) if (k && this.textures.exists(k)) this.textures.remove(k);
    }
    // ── THE PAGE TURN: a pixel flipbook ───────────────────────────────────────
    // A leaf turning, painted at half size in the diary's own paper (or leather, for the cover) like its pages, as
    // FLIP_N frames: flat on the right, lifting with its free edge leading so the paper bends, upright over the spine,
    // falling, flat on the left. Each column is shaded by how it faces you, its top and bottom edges darker, its free
    // edge darker still, and its shadow is painted onto the page under it. Frames are cached per size and kind.
    _flipFrames(kind, w, h) {
        const N = 9, W2 = Math.max(8, Math.round(w / 2)), H2 = Math.max(8, Math.round(h / 2)), LIFT = Math.round(H2 * 0.05) + 2, M = MenuArt.mix;
        const PAL = kind === 'cover' ? { front: [0x5a2a16, 0x3a180c], back: [0x5e3a2a, 0x3e241a], edge: 0x1e0c06, trim: 0xc8a050 }
                                     : { front: [0xeee0bc, 0xd8c498], back: [0xe6d6b0, 0xcfb98c], edge: 0xb89a68, trim: 0x8a6a40 };
        const ext = (this._flipExt ||= {});
        return Array.from({ length: N }, (_, f) => MenuArt.tex(this, `diary_flip_${kind}_${W2}x${H2}_${f}`, W2 * 2, H2 + LIFT * 2, P => {
            const th = Math.PI * f / (N - 1), bend = 0.9 * Math.sin(th), S = 48, n = MenuArt.noise(kind === 'cover' ? 61 : 62);
            let x = W2;   // the spine, in the middle of the canvas; the leaf starts on its right (canvas flipped for a turn back)
            const cols = [];
            for (let i = 0; i < S; i++) {
                const u = (i + 0.5) / S, a = Math.min(Math.PI, Math.max(0, th + bend * u * (1 - u * 0.35))), c = Math.cos(a), nx = x + c * W2 / S;
                cols.push({ x0: Math.min(x, nx), x1: Math.max(x, nx), a, c, u, lift: Math.sin(a) * LIFT * u });
                x = nx;
            }
            // its shadow on the page under it, past the free edge, deepest mid-turn
            const free = cols[S - 1], away = free.c >= 0 ? 1 : -1, sd = Math.sin(th);
            if (f > 0 && f < N - 1) for (let k = 0; k < 10; k++) for (let y = LIFT; y < LIFT + H2; y++) { const sx = Math.round(free.x1 * (away > 0 ? 1 : 0) + free.x0 * (away < 0 ? 1 : 0) + away * k); if (sx >= 0 && sx < W2 * 2) P.put(sx, y, 0x1a0e06, 0.16 * sd * (1 - k / 10)); }
            for (const C of cols) {
                const up = C.c >= 0, base = up ? PAL.front : PAL.back, lit = 0.35 + 0.65 * Math.abs(C.c), top = Math.round(LIFT - C.lift), bot = Math.round(LIFT + H2 - 1 + C.lift * 0.4);
                for (let px = Math.floor(C.x0); px <= Math.ceil(C.x1) && px < W2 * 2; px++) {
                    if (px < 0) continue;
                    for (let y = top; y <= bot; y++) {
                        const v = MenuArt.fbm(n, px * 0.05, y * 0.05, 2), edgeY = y === top || y === bot;
                        let col = M(base[0], base[1], v * 0.8);
                        if (kind !== 'cover' && up && (y - top) > 14 && (y - top) % 6 === 0) col = M(col, 0x8a9ab0, 0.22);   // its faded rules
                        if (kind === 'cover' && (y - top === 3 || bot - y === 3)) col = PAL.trim;                         // the gold tooling
                        col = M(col, 0x2a160a, (1 - lit) * 0.55);
                        if (edgeY) col = PAL.edge;
                        P.put(px, y, col);
                    }
                }
            }
            for (let y = Math.round(LIFT - free.lift); y <= Math.round(LIFT + H2 - 1 + free.lift * 0.4); y++) { const ex = Math.round(free.c >= 0 ? free.x1 : free.x0); if (ex >= 0 && ex < W2 * 2) P.put(ex, y, PAL.edge); }   // the free edge
            // what of each page it covers this frame (half px from the spine, right +), and how lit its face is
            ext[`diary_flip_${kind}_${W2}x${H2}_${f}`] = { r: Math.max(0, ...cols.map(c => c.x1 - W2)), l: Math.max(0, ...cols.map(c => W2 - c.x0)), lit: 0.35 + 0.65 * Math.abs(Math.cos(th)), front: th <= Math.PI / 2 };
        }));
    }
    // Plays the flipbook over the spine: o = { spine (x, or a function of time), y, w, h, dir (1 turns right to left),
    // kind ('page' | 'cover'), dur, delay, D, keep, onLift (once it's off the page it started on), onDone }.
    _flip(o) {
        const fr = this._flipFrames(o.kind || 'page', o.w, o.h), W2 = Math.round(o.w / 2), H2 = Math.round(o.h / 2), LIFT = Math.round(H2 * 0.05) + 2;
        const sx = () => typeof o.spine === 'function' ? o.spine() : o.spine;
        const img = o.keep(this.add.image(sx(), o.y - LIFT * 2, fr[0]).setOrigin(0.5, 0).setScale(2).setScrollFactor(0).setDepth(o.D).setFlipX(o.dir < 0).setVisible(false));
        const st = { f: 0 }; let lifted = false;
        this.tweens.add({ targets: st, f: fr.length - 1, duration: o.dur, delay: o.delay || 0, ease: 'Sine.easeInOut',
            onStart: () => img.setVisible(true),
            onUpdate: () => {
                const k = Math.round(st.f); if (img.texture.key !== fr[k]) img.setTexture(fr[k]); img.x = sx(); if (!lifted && k >= 3) { lifted = true; o.onLift?.(); }
                const E = this._flipExt?.[fr[k]]; if (E && o.onFrame) o.onFrame(E.r * 2, E.l * 2, E.lit, E.front, sx());   // how much of each side (world px) it covers
            },
            onComplete: () => { img.destroy(); o.onDone?.(); } });
        return img;
    }
    // draw objects into a dynamic texture as they sit on screen, relative to (ox, oy) (Phaser places a drawn
    // object AT the x/y it's given, so each goes at its own position less the offset)
    _stamp(dt, list, ox, oy) { for (const o of list) dt.draw(o, o.x - ox, o.y - oy); }
    // A leaf turning over the spine, drawn as thin vertical strips that each turn a little further than the one
    // inside them (the free edge leads, so the paper bends), lift toward you as they rise, and shade as they go
    // edge-on; facing up a strip shows the front's column, past upright the back's. A shadow runs ahead of it.
    _leaf(o) {
        const N = 32, sw = o.w / N, dir = o.dir, bend = o.bend ?? 1.25, f = { t: 0 }, imgs = [], tex = k => this.textures.get(k).getSourceImage();
        const spineX = () => typeof o.spine === 'function' ? o.spine() : o.spine, grow = o.lift ?? 0.13;
        for (let i = 0; i < N; i++) imgs.push(o.keep(this.add.image(0, o.y, o.front).setOrigin(0, 0).setScrollFactor(0).setDepth(o.D).setVisible(false)));
        const shade = o.keep(this.add.graphics().setScrollFactor(0).setDepth(o.D - 0.05)), rim = o.keep(this.add.graphics().setScrollFactor(0).setDepth(o.D + 0.01));
        const draw = () => {
            const t = f.t, base = Math.PI * t, lead = Math.sin(Math.PI * t) * bend, sp = spineX(); let x = sp;
            shade.clear(); rim.clear();
            const tops = [], bots = [];
            for (let i = 0; i < N; i++) {
                const u = (i + 0.5) / N, a = Math.min(Math.PI, Math.max(0, base + lead * u * (1 - u * 0.3))), c = Math.cos(a), nx = x + dir * c * sw, w = Math.abs(nx - x);
                const up = c >= 0, key = up ? o.front : o.back, src = tex(key), tw = src.width, th = src.height, col = up ? (dir > 0 ? i : N - 1 - i) : (dir > 0 ? N - 1 - i : i);
                // a lifted strip is nearer you: taller, and its middle stays put, so the leaf's top and bottom edges arc
                const lift = Math.sin(a) * (0.35 + 0.65 * u), hh = o.h * (1 + grow * lift), y0 = o.y - (hh - o.h) / 2;
                const im = imgs[i], cw = tw / N, sx2 = Math.max(0.0001, (w + 0.6) / cw);
                if (im.texture.key !== key) im.setTexture(key);
                im.setCrop(col * cw, 0, cw, th).setScale(sx2, hh / th).setPosition(Math.min(x, nx) - col * cw * sx2 - 0.3, y0).setVisible(w > 0.05);
                // light: bright where the strip faces you, dark edge-on, a sheen just past the crest of the curl
                const sheen = Math.max(0, 1 - Math.abs(a - Math.PI * 0.42) * 4) * 0.12, l = Math.min(255, Math.round(255 * ((0.42 + 0.58 * Math.abs(c)) * (up ? 1 : 0.9 + 0.1 * t * t) + sheen)));   // (the back lands at full brightness, as the page under it)
                im.setTint(Phaser.Display.Color.GetColor(l, l, Math.round(l * 0.95)));
                tops.push([Math.min(x, nx), y0], [Math.max(x, nx), y0]); bots.push([Math.min(x, nx), y0 + hh], [Math.max(x, nx), y0 + hh]);
                x = nx;
            }
            // the paper's own edges, a hair darker, so its curl reads
            rim.lineStyle(1.5, 0x6a4a2a, 0.55);
            for (const L of [tops, bots]) { rim.beginPath(); L.forEach(([px, py], k) => (k ? rim.lineTo(px, py) : rim.moveTo(px, py))); rim.strokePath(); }
            rim.lineBetween(x, o.y - o.h * grow * 0.3 * Math.sin(Math.PI * t), x, o.y + o.h * (1 + grow * 0.3 * Math.sin(Math.PI * t)));
            // its shadow on the page under it, thrown past the free edge, deepest mid-turn
            const s2 = Math.sin(Math.PI * t), away = x > sp ? 1 : -1;
            for (let k = 0; k < 16; k++) { shade.fillStyle(0x1a0e06, 0.035 * s2 * (16 - k) / 16 * 4); shade.fillRect(x + away * k * 4, o.y, 4, o.h); }
        };
        this.tweens.add({ targets: f, t: 1, duration: o.dur, delay: o.delay || 0, ease: 'Sine.easeInOut', onStart: draw, onUpdate: draw, onComplete: () => { imgs.forEach(im => im.destroy()); shade.destroy(); rim.destroy(); o.onDone?.(); } });
    }
    // Opening the diary: it drops onto the middle of the screen closed (its front cover only), then the cover lifts
    // and swings over the spine, growing toward you as it rises, while the book slides right so the open spread ends
    // up centred. The left page's writing comes up once the cover is down.
    _diaryOpen() {
        const P2 = this._diaryParts, D = P2.D, objs = this._panelObjs, dim = objs[0], G = this._logGeo;
        const book = objs.filter(o => o && o !== dim && o.active && typeof o.setAlpha === 'function' && o.x !== undefined);
        const left = book.filter(o => o !== P2.cover && !o._close && ((o._side === 'L') || (o.getBounds && o.depth > D + 1.15 && o.depth < D + 6 && o.getBounds().centerX < P2.spx - 8)));
        // the left page, printed onto the inside of the cover: it rides over with it and lands with it (it used to fade in after)
        const inKey = `diary_snap_in_${Date.now()}`, idt = this.textures.addDynamicTexture(inKey, Math.ceil(G.pw), Math.ceil(G.ph));
        this._stamp(idt, [...left].sort((a, b) => a.depth - b.depth), G.lx, G.py);
        left.forEach(o => { o._a0 = o.alpha; o.setAlpha(0); });
        P2.g.setAlpha(0); P2.dg.setAlpha(0);
        const half = P2.bw / 2, keep = o => { objs.push(o); return o; };
        // the closed book's face: the cover's right half on top of everything until the cover itself starts to swing
        const shut = keep(this.add.image(P2.spx, P2.by, this._diaryTex('cover', half, P2.bh)).setOrigin(0).setDisplaySize(half, P2.bh).setScrollFactor(0).setDepth(D + 8.9));
        const sh2 = keep(this.add.graphics().setScrollFactor(0).setDepth(D + 0.9)); sh2.fillStyle(0x000000, 0.45); sh2.fillRoundedRect(P2.spx + 10, P2.by + 12, half, P2.bh, 14);
        const inside = keep(this.add.image(G.lx, G.py, inKey).setOrigin(0).setScrollFactor(0).setDepth(D + 9.1).setVisible(false));
        book.push(shut, sh2, inside); P2.shd.setAlpha(0);
        const under = book.filter(o => !left.includes(o) && !o._ribbon && o !== shut && o !== sh2 && o !== inside && o !== P2.g && o !== P2.dg && o !== P2.shd);   // (the right page, and the CLOSE button: there as the cover lifts)
        under.forEach(o => { o._u0 = o.alpha; o.setAlpha(0); });
        // closed and centred: the whole book starts half a page to the left and a little low, and slides up into place, solid (a book doesn't fade in)
        const f = { s: -half / 2, y: 46 };
        book.forEach(o => { o._x0 = o.x; o._y0 = o.y; });
        const place = () => book.forEach(o => { if (!o.active) return; o.x = o._x0 + f.s; o.y = o._y0 + f.y; });
        place();
        const cw = P2.cover.frame.width; P2.cover.setCrop(cw / 2, 0, cw / 2, P2.cover.frame.height);
        this.tweens.add({ targets: f, y: 0, duration: 260, ease: 'Back.easeOut', onUpdate: place, onComplete: () => {
            this.tweens.add({ targets: f, s: 0, duration: 820, ease: 'Sine.easeInOut', onUpdate: place });
            const showUnder = () => { shut.destroy(); under.forEach(o => o.active && o.setAlpha(o._u0 ?? 1)); };   // once the cover is up off them
            this.tweens.add({ targets: sh2, alpha: 0, duration: 820 }); this.tweens.add({ targets: P2.shd, alpha: 1, duration: 820 });
            // past upright, the cover's inside faces you: as much of the left page as it covers, lit as it turns toward you
            const gap = P2.spx - (G.lx + G.pw);
            const onFrame = (cr, cl, lit, isFront) => {
                if (!inside.active) return;
                const w = isFront ? 0 : Math.max(0, Math.min(G.pw, cl - gap)), g = Math.round(255 * lit);
                inside.setVisible(w > 1).setTint(Phaser.Display.Color.GetColor(g, g, Math.round(g * 0.96))).setCrop(G.pw - w, 0, w, G.ph);
            };
            this._flip({ spine: () => P2.spx + f.s, y: P2.by, w: half, h: P2.bh, dir: 1, kind: 'cover', dur: 760, D: D + 9, keep, onLift: showUnder, onFrame, onDone: () => {
                if (!P2.cover.active) return;
                P2.cover.setCrop();
                inside.destroy(); this.time.delayedCall(30, () => { if (this.textures.exists(inKey)) this.textures.remove(inKey); });
                P2.g.setAlpha(1); P2.dg.setAlpha(1);
                left.forEach(o => o.active && o.setAlpha(o._a0 ?? 1));   // down with the cover: there already
            } });
            Sfx.play(this, 'e_flip');
        } });
    }
    // the diary's leather and paper, painted at half size (so they read as pixels)
    _diaryTex(kind, w, h) {
        const W = Math.max(8, Math.round(w / 2)), H = Math.max(8, Math.round(h / 2)), key = `diary_${kind}_${W}x${H}`;
        return MenuArt.tex(this, key, W, H, P => {
            const n = MenuArt.noise(kind === 'cover' ? 61 : 62), R = MenuArt.rng(W * 7 + H), mix = MenuArt.mix, M = MenuArt.mix;
            if (kind === 'cover') {
                for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
                    const v = MenuArt.fbm(n, x * 0.08, y * 0.08, 3), edge = Math.min(x, y, W - 1 - x, H - 1 - y);
                    let c = mix(0x5a2a16, 0x3a180c, v); if (edge < 2) c = 0x1e0c06; else if (edge < 4) c = mix(c, 0x000000, 0.3);
                    if ((x * 3 + y * 7) % 23 === 0) c = mix(c, 0x000000, 0.25);   // the leather's grain
                    P.put(x, y, c);
                }
                for (const d of [5, 7]) { for (let x = d; x < W - d; x++) for (const y of [d, H - 1 - d]) P.put(x, y, d === 5 ? 0xc8a050 : 0x8a6a2a); for (let y = d; y < H - d; y++) for (const x of [d, W - 1 - d]) P.put(x, y, d === 5 ? 0xc8a050 : 0x8a6a2a); }   // tooled gold border
                for (const [cx, cy, sx, sy] of [[0, 0, 1, 1], [W - 1, 0, -1, 1], [0, H - 1, 1, -1], [W - 1, H - 1, -1, -1]]) for (let j = 0; j < 8; j++) for (let i = 0; i < 8 - j; i++) P.put(cx + sx * i, cy + sy * j, i + j > 5 ? 0x8a6a2a : (i + j) % 3 ? 0xd8b05a : 0xffe08a);   // brass corners
                const ex = Math.floor(W / 2), ey = Math.floor(H / 2);   // a tooled gold emblem: a ring with a sprouting leaf in it
                for (let y = -14; y <= 14; y++) for (let x = -14; x <= 14; x++) { const d = Math.hypot(x, y); if (d <= 13 && d >= 11.5) P.put(ex + x, ey + y, (x + y) % 3 ? 0xd8b05a : 0xffe08a); if (d <= 10 && d >= 9.5) P.put(ex + x, ey + y, 0x8a6a2a); }
                for (let j = 0; j < 12; j++) P.put(ex, ey + 6 - j, 0xd8b05a);
                for (const sgn of [-1, 1]) for (let j = 0; j < 6; j++) { P.put(ex + sgn * j, ey - 1 - j * 0.6, 0xffe08a); P.put(ex + sgn * j, ey - j * 0.6 + 1, 0xb8903a); }
            } else if (kind === 'inner') {   // the inside of the cover: dark leather turned in over the board, a marbled endpaper
                for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
                    const e = Math.min(x, y, W - 1 - x, H - 1 - y);
                    let c = e < 5 ? M(0x3a180c, 0x1e0c06, e < 2 ? 1 : 0.3) : (() => { const v = Math.sin(x * 0.18 + Math.sin(y * 0.09) * 3) + Math.sin(y * 0.14 - x * 0.05); return v > 1 ? 0x7a4a34 : v > 0 ? 0x5e3a2a : v > -1 ? 0x4e2e22 : 0x3e241a; })();
                    if (x > W - 4) c = 0x1e0c06;
                    P.put(x, y, c);
                }
            } else if (kind === 'card') {
                for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { const e = Math.min(x, y, W - 1 - x, H - 1 - y); P.put(x, y, e < 1 ? 0xb8a07a : mix(0xf4ead0, 0xe0d0aa, n(x * 0.2, y * 0.2) * 0.8)); }
            } else {
                // a diary page ('pageLC', 'pageRC') bows: its top and bottom edges dip into the gutter
                const left = kind.startsWith('pageL'), curve = kind.endsWith('C');
                const sag = x => curve ? 6 * Math.pow(left ? x / W : 1 - x / W, 3) : 0;
                for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
                    const sg = sag(x);
                    if (y < sg || y > H - 1 - sg * 0.6) continue;
                    const v = MenuArt.fbm(n, x * 0.05 + (left ? 0 : 40), y * 0.05, 3), e = Math.min(x, y, W - 1 - x, H - 1 - y);
                    let c = mix(0xeee0bc, 0xd8c498, v * 0.9);
                    if (e < 6) c = mix(c, 0xb89a68, (6 - e) / 10);   // aged toward the edges
                    const toSpine = left ? x / W : 1 - x / W;   // the page curving down into the gutter, and a soft light where it bows up
                    if (toSpine > 0.85) c = mix(c, 0x6a4a2a, (toSpine - 0.85) * 2.2); else if (toSpine > 0.55 && toSpine < 0.75) c = mix(c, 0xfff8e8, 0.12);
                    if (y > 30 && (y - 30) % 12 === 0 && x > 6 && x < W - 6) c = mix(c, 0x8a9ab0, 0.25);   // faded rules
                    if (left && x === 16 && y > 4) c = mix(c, 0xc04a3a, 0.3);   // a margin line
                    if (R() < W * H / 500 / (W * H) * 9 && e > 6) c = mix(c, 0xa8804a, 0.3);   // foxing
                    P.put(x, y, c);
                }
                for (let k = 0; k < W * H / 600; k++) { const x = Math.floor(R() * W), y = Math.floor(R() * H), r = 1 + R() * 2; for (let j = -2; j <= 2; j++) for (let i = -2; i <= 2; i++) if (i * i + j * j <= r * r) P.put(x + i, y + j, mix(0xd8c498, 0xa8804a, 0.35), 0.5); }   // foxing spots
            }
        });
    }
    // ── THE HOTBAR AND THE CHEST ──────────────────────────────────────────────
    // 1-8 (or a click) holds a slot: a rod is the one you fish with, a seed goes straight into the
    // next empty bed you tend. The chest holds the rest; open it to move things between the two.
    // Two hands (keys 1 and 2): each holds a thing from the backpack, by what it is ('k:id', kept between visits); the
    // one in use is what E does things with. The backpack puts what you click in the hand in use.
    _handsGet() {
        if (!this._hands) { try { const h = JSON.parse(localStorage.getItem('garden_hands') || 'null'); this._hands = h?.keys?.length === 2 ? h : null; } catch (e) {} }
        return this._hands ||= { keys: ['rod:' + Garden.rod().id, 'can:can'], on: 0 };
    }
    _handsSave() { try { localStorage.setItem('garden_hands', JSON.stringify(this._hands)); } catch (e) {} }
    _inHand(i) { const s = Garden.slots(), key = this._handsGet().keys[i]; return [...s.bag, ...s.chest].find(o => o && o.k + ':' + o.id === key) || null; }
    _held() { return this._inHand(this._handsGet().on); }
    _useHand(i) {
        const H = this._handsGet();
        if (this._pack && this._packPick) {   // in the backpack with something picked: it goes in that hand
            const s = Garden.slots(), o = [...s.bag, ...s.chest].find(x => x && x.k + ':' + x.id === this._packPick);
            this._packPick = null; H.on = i; this._select(o); Sfx.play(this, 'pickup'); this._backpack(this._packPage || 0, true); return;
        }
        if (H.on === i) return;
        H.on = i; this._handsSave(); const o = this._held();
        if (o?.k === 'rod') { Garden.useRod(o.id); this.rodSpr.setTexture(this._rodTex(Garden.rod())); }
        Sfx.play(this, 'click'); this._hotSel();
        if (this._pack) this._backpack(this._packPage || 0, true);
    }
    _select(o) {
        if (!o) return;
        const H = this._handsGet(), key = o.k + ':' + o.id, other = 1 - H.on;
        if (H.keys[other] === key) H.keys[other] = H.keys[H.on];   // already in the other hand: they swap
        H.keys[H.on] = key; this._handsSave();
        if (o.k === 'rod') { Garden.useRod(o.id); this.rodSpr.setTexture(this._rodTex(Garden.rod())); }
        Sfx.play(this, 'click'); this._hotSel();
    }
    _hotSel() {   // the two hand boxes: the one in use ringed gold, its number over each, the name of what's in it under
        const H2 = this._hot; if (!H2?.keep) return;
        (H2.objs || []).forEach(x => x.destroy()); H2.objs = [];
        const k2 = x => { H2.objs.push(x); return H2.keep(x); }, H = this._handsGet();
        [0, 1].forEach(i => {
            const o = this._inHand(i), x = H2.x + i * (H2.sz + 14), on = H.on === i;
            this._slot(k2, o, x, H2.y, H2.sz, on, H2.D);
            k2(this.add.text(x + H2.sz / 2, H2.y - 3, String(i + 1), { fontSize: '12px', fontFamily: 'monospace', fontStyle: 'bold', color: on ? '#1a1006' : '#c8b898', backgroundColor: on ? '#ffe08a' : '#2a2014', padding: { x: 5, y: 1 } }).setOrigin(0.5, 1).setDepth(H2.D + 1));
            k2(this.add.text(x + H2.sz / 2, H2.y + H2.sz + 3, o ? this._itemName(o).replace(/ \(.*\)$/, '') : 'empty', { fontSize: '10px', fontFamily: 'monospace', fontStyle: 'bold', color: on ? '#ffe08a' : '#a8a088', stroke: '#0a0618', strokeThickness: 3, align: 'center', wordWrap: { width: H2.sz + 30 } }).setOrigin(0.5, 0).setDepth(H2.D + 1));
            k2(this.add.zone(x, H2.y, H2.sz, H2.sz).setOrigin(0).setInteractive({ useHandCursor: true }).setDepth(H2.D + 3)).on('pointerdown', () => this._useHand(i));
        });
        this._holdLook(this._held());
    }
    _itemIcon(o, x, y, size, D) {
        if (o.k === 'fert') return this.add.image(x, y, this._fertTex()).setScale(size / 16).setDepth(D).setScrollFactor(0);
        if (o.k === 'can') return this.add.image(x, y, this._canTex(Garden.can())).setScale(size / 16).setDepth(D).setScrollFactor(0);
        if (o.k === 'decor') { const im = this.add.image(x, y, this._decorTex(o.id)); return im.setScale(size / Math.max(im.width, im.height)).setDepth(D).setScrollFactor(0); }
        const key = o.k === 'rod' ? this._rodTex(Garden.RODS.find(r => r.id === o.id)) : o.k === 'seed' ? this._cropTex(Garden.seed(o.id), 4) : this._fishTex(Garden.FISH.find(f => f.id === o.id));
        const im = o.k === 'rod' ? this.add.image(x, y, key) : this.add.sprite(x, y, key, '0').play(key);   // seeds sway, fish swim
        return im.setScale(size / Math.max(im.width, im.height)).setDepth(D).setScrollFactor(0);
    }
    // a watering can in its tier's metal (clay, copper, silver, crystal, starwell): a round body, a long spout, a handle
    _canTex(C) {
        return MenuArt.tex(this, 'gd4_can_' + C.id, 16, 16, P => {
            const c = C.col, M = MenuArt.mix, hi = M(c, 0xffffff, 0.5), lo = M(c, 0x0a0614, 0.45);
            for (let y = 6; y < 15; y++) for (let x = 3; x < 11; x++) { const e = ((x - 6.5) / 4) ** 2 + ((y - 10.5) / 4.6) ** 2; if (e <= 1) P.put(x, y, x < 5 ? hi : x > 8 ? lo : c); }
            for (let k = 0; k < 6; k++) { P.put(10 + k, 10 - k * 0.8, c); P.put(10 + k, 11 - k * 0.8, lo); }
            P.put(15, 5, hi); P.put(15, 6, c); P.put(14, 5, hi);
            for (let x = 4; x < 10; x++) P.put(x, 4 + Math.abs(x - 6.5) * 0.4, lo);
            P.put(4, 5, lo); P.put(9, 5, lo);
            if (C.id === 'crystal' || C.id === 'starwell') { P.put(6, 9, 0xffffff); P.put(7, 12, M(c, 0xffffff, 0.7)); }
            if (C.id === 'clay') { P.put(6, 11, M(c, 0x0a0614, 0.6)); P.put(8, 9, M(c, 0x0a0614, 0.6)); }
            for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) if (P.alpha(x, y) > 0.9 && [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => P.alpha(x + dx, y + dy) < 0.5)) P.put(x, y, 0x1c1728);
        });
    }
    _dropTex() {   // a drop of water: this bed wants watering
        return MenuArt.tex(this, 'gd4_drop', 9, 12, P => {
            for (let y = 0; y < 12; y++) for (let x = 0; x < 9; x++) { const w = y < 5 ? y * 0.7 : Math.sqrt(Math.max(0, 16 - (y - 7.5) ** 2)); if (Math.abs(x - 4) <= w) P.put(x, y, x < 4 ? 0xd8f0ff : 0x5aa8f0); }
            P.put(3, 6, 0xffffff); P.put(3, 7, 0xffffff);
            for (let y = 0; y < 12; y++) for (let x = 0; x < 9; x++) if (P.alpha(x, y) > 0.9 && [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => P.alpha(x + dx, y + dy) < 0.5)) P.put(x, y, 0x1c1728);
        });
    }
    // watering a bed: the can tips over it, water pours, and it starts growing
    _water(k) {
        if (this._busy) return;
        this._busy = true;
        const T = this.T, [bx, by] = GardenScene.BEDS[k], cx = this._px(bx + 2), cy = this._py(by) + T * 0.4, C = Garden.can();
        const can = this.add.image(cx - T * 0.8, cy - T * 1.2, this._canTex(C)).setScale(T / 16 * 1.4).setDepth(this._py(by + 2) + 5);
        this.tweens.add({ targets: can, angle: 40, x: cx - T * 0.4, duration: 300, ease: 'Quad.easeOut' });
        const rain = this.add.particles(0, 0, 'mn_px2', { x: { min: cx - T * 1.6, max: cx + T * 1.6 }, y: cy - T * 0.6, lifespan: 380, speedY: { min: 160, max: 240 }, speedX: { min: -10, max: 10 }, scale: { start: 1.4, end: 0.6 }, tint: [0x9ad8ff, 0xd8f0ff], frequency: 14 }).setDepth(this._py(by + 2) + 4);
        Sfx.play(this, 'e_dip', { big: false });
        this.time.delayedCall(900, () => {
            rain.stop(); this.tweens.add({ targets: can, alpha: 0, angle: 0, duration: 250, onComplete: () => can.destroy() });
            this.time.delayedCall(500, () => rain.destroy());
            Garden.water(k); const p = Garden.state().plots[k];
            this._float(cx, this._py(by), `watered · ${C.name}: first ripe in ${this._time(Garden.bed(p).left)}`, '#9ad8ff');
            this._busy = false; this._drawCrops(); this._hud();
        });
    }
    _fertTex() {   // a little sack of fertilizer, tied off, a glowing sprout on it
        return MenuArt.tex(this, 'gd3_fert', 16, 16, P => {
            for (let y = 4; y < 15; y++) for (let x = 3; x < 13; x++) { const w = y < 7 ? 3 + (y - 4) : 5; if (Math.abs(x - 7.5) > w) continue; P.put(x, y, x < 6 ? 0xc8a878 : x > 10 ? 0x7a5a36 : 0xa88a5a); }
            for (let x = 5; x < 11; x++) P.put(x, 5, 0x5a3a20);
            P.put(7, 3, 0x9a7a4a); P.put(8, 3, 0x9a7a4a); P.put(6, 2, 0x9a7a4a); P.put(9, 2, 0x9a7a4a);
            P.put(8, 10, 0x9aff8a); P.put(7, 9, 0x6ad86a); P.put(9, 9, 0x6ad86a); P.put(8, 11, 0x3a8a3a); P.put(8, 12, 0x3a8a3a);
            for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) if (P.alpha(x, y) > 0.9 && [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => P.alpha(x + dx, y + dy) < 0.5)) P.put(x, y, 0x2a1a10);
        });
    }
    // what's in the slime's hand: the rod (its own sprite) or the thing itself, alive (a fish wriggles, a crop sways)
    _holdLook(o) {
        this._heldItem = o || null;
        if (!this.heldSpr || !o || o.k === 'rod') return;
        const k = this.T / 16, key = o.k === 'decor' ? (this._decorTex(o.id)) : o.k === 'can' ? this._canTex(Garden.can()) : o.k === 'fert' ? this._fertTex() : o.k === 'seed' ? this._cropTex(Garden.seed(o.id), 4) : this._fishTex(Garden.FISH.find(f => f.id === o.id));
        if (this.heldSpr.texture.key === key) return;
        const flat = o.k === 'fert' || o.k === 'can' || o.k === 'decor';
        this.heldSpr.setTexture(key, flat ? undefined : '0').setScale(k * (flat ? 0.8 : 0.4));
        if (!flat && this.anims.exists(key)) this.heldSpr.play(key); else this.heldSpr.stop();
    }
    _itemCount(o) { if (o.k === 'can' || o.k === 'decor') return ''; if (o.k === 'fert') return `x${Garden.state().fert}`; return o.k === 'seed' ? `${Garden.free(o.id)}/${Garden.state().seeds[o.id] || 0}` : o.k === 'fish' ? `x${o.n}` : Garden.rod().id === o.id ? '✓' : ''; }
    _itemName(o) { if (o.k === 'decor') return `${Garden.DECOR[o.id].name} (B to place it)`; if (o.k === 'can') return `${Garden.can().name} (E on a planted bed)`; if (o.k === 'fert') return 'Fertilizer (E on a growing bed)'; return o.k === 'rod' ? Garden.RODS.find(r => r.id === o.id).name : o.k === 'seed' ? `${Garden.seed(o.id).name} seed` : Garden.FISH.find(f => f.id === o.id).name; }
    _slot(keep, o, x, y, sz, on, D) {
        const g = keep(this.add.graphics().setDepth(D));
        g.fillStyle(0x0a0618, 0.88); g.fillRoundedRect(x, y, sz, sz, 6); g.lineStyle(on ? 3 : 1.5, on ? 0xffe08a : 0x8affd8, on ? 1 : 0.45); g.strokeRoundedRect(x, y, sz, sz, 6);
        if (!o) return;
        if (o.k === 'fish') {   // a little tank of its own water, the fish swimming back and forth in it
            const F = Garden.FISH.find(q => q.id === o.id), W2 = { river: [0x6aa8e8, 0x1a3a7a], lake: [0x6ac8a8, 0x15524a], mud: [0x9a8458, 0x3a2a14], cosmic: [0xb07aff, 0x1e0a44] }[F.where] || [0x6aa8e8, 0x1a3a7a];
            for (let i = 0; i < 6; i++) { g.fillStyle(MenuArt.mix(W2[0], W2[1], i / 5), 0.9); g.fillRect(x + 4, y + 6 + i * (sz - 14) / 6, sz - 8, (sz - 14) / 6 + 1); }
            g.fillStyle(F.where === 'cosmic' ? 0x3a2a64 : F.where === 'mud' ? 0x2a1a0a : 0x8a7a5a, 1); g.fillRect(x + 4, y + sz - 8, sz - 8, 4);
            for (let i = 0; i < 5; i++) { g.fillStyle(0xffffff, 0.35); g.fillRect(x + 8 + i * 8, y + sz - 9 - (i % 2), 2, 1); }
            g.fillStyle(0xffffff, 0.18); g.fillRect(x + 5, y + 7, 2, sz - 16);
            const fs = keep(this._itemIcon(o, x + sz / 2, y + sz / 2 - 2, sz * 0.62, D + 1));
            this.tweens.add({ targets: fs, x: { from: x + sz * 0.38, to: x + sz * 0.62 }, duration: 1800 + (o.id.length * 97) % 900, yoyo: true, repeat: -1, ease: 'Sine.easeInOut', onYoyo: () => fs.setFlipX(true), onRepeat: () => fs.setFlipX(false) });
            this.tweens.add({ targets: fs, y: y + sz / 2 - 5, duration: 1300, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
            const bub = keep(this.add.circle(x + sz * 0.3, y + sz - 12, 1.5, 0xffffff, 0.6).setDepth(D + 1));
            this.tweens.add({ targets: bub, y: y + 8, alpha: 0, duration: 1600, repeat: -1, delay: (o.id.length * 131) % 1200 });
        } else keep(this._itemIcon(o, x + sz / 2, y + sz / 2 - 2, sz * 0.66, D + 1));
        const c = this._itemCount(o);
        if (c) keep(this.add.text(x + sz - 3, y + sz - 2, c, { fontSize: '10px', fontFamily: 'monospace', fontStyle: 'bold', color: '#ffffff', stroke: '#0a0618', strokeThickness: 3 }).setOrigin(1, 1).setDepth(D + 2));
    }
    // ── THE BACKPACK ──────────────────────────────────────────────────────────
    // A giant backpack drops out of the sky beside you and slams down (the ground shakes, dust rings out, the slime
    // is dazed a moment, stars round its head); its flap flies open and everything in it fans out round it in rings.
    // Click a thing to hold it. Esc, I, the ✕ or the backpack button put it away (it flies back up). The daze is the game's (_daze).
    _backpack(page = 0, again = false) {
        if (this._fish || this._rest || this._sprk || this._build) return;
        const keepPick = again ? this._packPick : null;
        this._closePanel(true); this._packPick = keepPick;
        const W = this.scale.width, H = this.scale.height, T = this.T, D = 8000, cam = this.cameras.main, objs = this._panelObjs = [], keep = o => { objs.push(o); o?.setScrollFactor?.(0); return o; };
        this._pack = true; this.prompt.setVisible(false);
        const k = Math.min(1, H / 1000), R1 = 190 * k, R2 = 300 * k, N1 = 12, N2 = 20, PER = N1 + N2;
        const px = (this.fx - cam.scrollX) * cam.zoom, py = (this.fy - cam.scrollY) * cam.zoom;
        const cx = Math.max(R2 + 50, Math.min(W - R2 - 50, px + (px < W / 2 ? 1 : -1) * T * 1.6)), cy = Math.max(R2 + 40, Math.min(H - R2 - 120, py - T * 0.4));
        keep(this.add.rectangle(0, 0, W, H, 0x05030a, 0.4).setOrigin(0).setDepth(D).setInteractive());   // (blocks clicks; doesn't close)
        const sl = Garden.slots(), items = [...sl.bag, ...sl.chest].filter(Boolean), pages = Math.max(1, Math.ceil(items.length / PER));
        page = ((page % pages) + pages) % pages;
        const mine = items.slice(page * PER, page * PER + PER), HK = this._handsGet(); this._packPage = page;
        const shadow = keep(this.add.ellipse(cx, cy + 86 * k, 230 * k, 50 * k, 0x000000, 0.45).setDepth(D + 1)), BK = 7 * k;
        const bp = keep(this.add.image(cx, cy + 60 * k, this._packTex()).setOrigin(0.5, 0.86).setScale(BK).setDepth(D + 2));
        const label = keep(this.add.text(cx, cy - R2 - 46 * k, '', { fontSize: '14px', fontFamily: UIKit.FONT.title, fontStyle: 'bold', color: '#fff6d8', stroke: '#1a1006', strokeThickness: 5 }).setOrigin(0.5).setDepth(D + 6));
        const showAll = () => {
            const pk = this._packPick && items.find(o => o.k + ':' + o.id === this._packPick); if (!pk) this._packPick = null;
            label.setText(pk ? `${this._itemName(pk).replace(/ \(.*\)$/, '')}: put it in hand 1 or 2 (click the hand, or press 1 / 2)` : `click a thing, then a hand to put it in  ·  ${items.length} of ${Garden.BAG + Garden.CHEST} slots${pages > 1 ? `  ·  ${page + 1}/${pages} (scroll for more)` : ''}`);
            mine.forEach((o, j) => {
                const inner = j < N1, n = inner ? Math.min(N1, mine.length) : mine.length - N1, i = inner ? j : j - N1, R = inner ? R1 : R2;
                const a = -Math.PI / 2 + (i + (inner ? 0 : 0.5)) / n * Math.PI * 2, x = cx + Math.cos(a) * R, y = cy + Math.sin(a) * R * 0.92;
                const c = keep(this.add.container(cx, cy).setDepth(D + 4).setScale(0.2)), g = this.add.graphics(), hand = HK.keys.indexOf(o.k + ':' + o.id), on = hand >= 0, r = 32 * k, picked = this._packPick === o.k + ':' + o.id;
                const paint = hov => { g.clear(); g.fillStyle(0x000000, 0.35); g.fillCircle(3, 5, r); g.fillStyle(on ? 0xfff0c0 : hov ? 0xfff6dc : 0xf2e2bc, 1); g.fillCircle(0, 0, r); g.fillStyle(0xe2cfa4, 1); g.fillCircle(0, 3, r * 0.82); g.lineStyle(on ? 5 : 3, on ? 0xffc040 : 0x8a6a3a, 1); g.strokeCircle(0, 0, r); };
                paint(false); c.add(g);
                if (picked) { const gl = this.add.image(0, 0, 'mn_glow').setTint(0xffd060).setBlendMode(Phaser.BlendModes.ADD).setDisplaySize(r * 4, r * 4).setAlpha(0.8); c.addAt(gl, 0); this.tweens.add({ targets: gl, alpha: 0.35, duration: 500, yoyo: true, repeat: -1 }); }
                const ic = this._itemIcon(o, 0, 0, r * 1.25, 0); c.add(ic);
                const cnt = this._itemCount(o); if (cnt) c.add(this.add.text(r * 0.72, r * 0.62, cnt, { fontSize: '11px', fontFamily: 'monospace', fontStyle: 'bold', color: '#fff6d8', backgroundColor: '#2a1a08', padding: { x: 3, y: 1 } }).setOrigin(0.5));
                if (on) c.add(this.add.text(-r * 0.7, -r * 0.7, String(hand + 1), { fontSize: '13px', fontFamily: 'monospace', fontStyle: 'bold', color: '#1a1006', backgroundColor: hand === HK.on ? '#ffe08a' : '#c8b898', padding: { x: 5, y: 1 } }).setOrigin(0.5));
                const z = this.add.circle(0, 0, r).setInteractive({ useHandCursor: true }); c.add(z);
                c.list.forEach(q => q.setScrollFactor(0));
                z.on('pointerover', () => { paint(true); label.setText(this._itemName(o)); this.tweens.add({ targets: c, scale: 1.12, duration: 100 }); })
                 .on('pointerout', () => { paint(false); this.tweens.add({ targets: c, scale: picked ? 1.22 : 1, duration: 100 }); label.setText(pk ? `${this._itemName(pk).replace(/ \(.*\)$/, '')}: put it in hand 1 or 2 (click the hand, or press 1 / 2)` : 'click a thing, then a hand to put it in'); })
                 .on('pointerdown', () => { this._packPick = picked ? null : o.k + ':' + o.id; Sfx.play(this, 'click'); this._backpack(page, true); });
                this.tweens.add({ targets: c, x, y: y - (picked ? 10 : 0), scale: picked ? 1.22 : 1, duration: again ? 1 : 340, delay: again ? 0 : 60 + j * 18, ease: 'Back.easeOut' });   // flung out of the backpack (the picked one lifted)
            });
            if (!mine.length) label.setText('Your backpack is empty.');
            const hs = 58 * k, hy = cy - hs / 2 + 10 * k;   // the two hands, either side of the backpack: where a picked thing goes
            [0, 1].forEach(i => {
                const hx = cx + (i ? 1 : -1) * (100 * k + hs / 2) - hs / 2, o = this._inHand(i), lit = !!pk;
                if (lit) { const gl = keep(this.add.rectangle(hx + hs / 2, hy + hs / 2, hs + 12, hs + 12, 0xffd060, 0.25).setDepth(D + 4.5)); this.tweens.add({ targets: gl, alpha: 0.6, duration: 450, yoyo: true, repeat: -1 }); }
                this._slot(keep, o, hx, hy, hs, lit || HK.on === i, D + 5);
                keep(this.add.text(hx + hs / 2, hy - 3, String(i + 1), { fontSize: '14px', fontFamily: 'monospace', fontStyle: 'bold', color: '#1a1006', backgroundColor: lit ? '#ffe08a' : HK.on === i ? '#ffe08a' : '#c8b898', padding: { x: 6, y: 1 } }).setOrigin(0.5, 1).setDepth(D + 6));
                keep(this.add.zone(hx, hy, hs, hs).setOrigin(0).setInteractive({ useHandCursor: true }).setDepth(D + 7)).on('pointerdown', () => this._useHand(i));
            });
            const xb = keep(this.add.container(cx + R2 * 0.78, cy - R2 * 0.78).setDepth(D + 6)), xg = this.add.graphics();
            xg.fillStyle(0x1a0806, 1); xg.fillCircle(2, 3, 20); xg.fillStyle(0x8a3a24, 1); xg.fillCircle(0, 0, 20); xg.lineStyle(3, 0xf2e2bc, 1); xg.strokeCircle(0, 0, 20);
            xb.add([xg, this.add.text(0, -1, '✕', { fontSize: '20px', fontFamily: 'monospace', fontStyle: 'bold', color: '#fff6d8' }).setOrigin(0.5), this.add.circle(0, 0, 20).setInteractive({ useHandCursor: true }).on('pointerdown', () => this._packAway())]);
            xb.list.forEach(q => q.setScrollFactor(0));
            if (pages > 1) { const wheel = (p, o2, dx, dy) => { this.input.off('wheel', wheel); if (this._panelObjs === objs) this._backpack(page + (dy > 0 ? 1 : -1), true); }; this.input.on('wheel', wheel); }
        };
        if (again) { showAll(); return; }
        // the drop: from above the screen, a long fall, a slam
        bp.y = -200; shadow.setScale(0.2).setAlpha(0);
        this.tweens.add({ targets: shadow, scale: 1, alpha: 0.45, duration: 520, ease: 'Quad.easeIn' });
        Sfx.play(this, 'whoosh');
        this.tweens.add({ targets: bp, y: cy + 60 * k, duration: 520, ease: 'Quad.easeIn', onComplete: () => {
            cam.shake(260, 0.012); Sfx.play(this, 'e_land', { r: 4 }); Sfx.play(this, 'hurt');
            this.tweens.add({ targets: bp, scaleY: BK * 0.78, scaleX: BK * 1.14, duration: 90, yoyo: true, ease: 'Quad.easeOut' });   // squash
            for (let q = 0; q < 26; q++) {   // dust ringing out from the slam
                const a = q / 26 * Math.PI * 2, d = keep(this.add.circle(cx, cy + 86 * k, (8 + Math.random() * 10) * k, 0xd8c8a8, 0.85).setDepth(D + 1.5));
                this.tweens.add({ targets: d, x: cx + Math.cos(a) * 190 * k, y: cy + 86 * k + Math.sin(a) * 50 * k, alpha: 0, scale: 2, duration: 520 + Math.random() * 200, ease: 'Quad.easeOut' });
            }
            const ring = keep(this.add.ellipse(cx, cy + 88 * k, 60 * k, 16 * k).setStrokeStyle(4, 0xfff0c8, 0.9).setDepth(D + 1.5));
            this.tweens.add({ targets: ring, scale: 6, alpha: 0, duration: 500, ease: 'Cubic.easeOut' });
            this._daze(1400);
            this.time.delayedCall(220, () => { if (this._panelObjs === objs) { Sfx.play(this, 'pickup'); showAll(); } });
        } });
    }
    // put away: the things fly back in, the backpack lifts off and goes back up
    _packAway() {
        const objs = this._panelObjs; if (!this._pack || !objs) return;
        this._pack = null;
        Sfx.play(this, 'whoosh');
        this.tweens.add({ targets: objs.filter(o => o.type === 'Container' || o.type === 'Text'), alpha: 0, scale: 0.3, duration: 180 });
        const bp = objs.find(o => o.type === 'Image');
        this.tweens.add({ targets: bp, y: -300, duration: 420, delay: 120, ease: 'Back.easeIn', onComplete: () => { if (this._panelObjs === objs) this._closePanel(); } });
    }
    // dazed: can't move for ms. The game's own daze (CreatureFX's stun): three cfx_bits stars circling just over its head,
    // passing in front and behind, and its eyes gone to X's
    _daze(ms) {
        const sc = this.T / 16, u = this.player._cfx; this._dazedUntil = this.time.now + ms;
        this._dazeStars?.forEach(x => x.destroy());
        const st = this._dazeStars = this.textures.exists('cfx_bits') ? [0, 1, 2].map(() => this.add.image(0, 0, 'cfx_bits', 'star')) : [];
        const tick = t => {
            if (t >= this._dazedUntil) { st.forEach(x => x.destroy()); if (u) u.expr = null; this._ticks = this._ticks.filter(f => f !== tick); return; }
            if (u) u.expr = 'x';
            const d = this._panelObjs ? 8002 : this.player.depth, cy = this.player.y - 3 * sc, rx = 9 * sc * 1.05, ry = 3.5 * sc;
            st.forEach((o, i) => { const a = this.time.now * 0.006 + i * Math.PI * 2 / 3, sn = Math.sin(a); o.setPosition(this.player.x + Math.cos(a) * rx, cy + sn * ry).setScale((1.05 + 0.25 * sn) * sc).setAlpha(0.8 + 0.2 * sn).setDepth(sn > 0 ? d + 0.006 : d - 0.003); });
        };
        this._ticks.push(tick);
    }
    // the giant backpack (24 x 26): a canvas body, a rolled blanket strapped on top, a front pocket with a flap and a brass
    // buckle, side pockets, a top handle loop
    _packTex() {
        return MenuArt.tex(this, 'gd5_pack', 24, 26, P => {
            const M = MenuArt.mix, body = 0x6a8a3a, dark = 0x3a5a22, lite = 0x9ab85a;
            for (let y = 6; y < 25; y++) for (let x = 3; x < 21; x++) { const e = ((x - 11.5) / 9) ** 4 + ((y - 15.5) / 10) ** 4; if (e <= 1) P.put(x, y, x < 6 ? lite : x > 17 || y > 22 ? dark : body); }
            for (let y = 12; y < 22; y++) { P.put(2, y, dark); P.put(1, y, y % 3 ? body : dark); P.put(22, y, dark); P.put(21, y, y % 3 ? body : dark); }   // side pockets
            for (let y = 14; y < 23; y++) for (let x = 6; x < 18; x++) P.put(x, y, y === 22 || x === 6 || x === 17 ? dark : M(body, 0x000000, 0.12));   // the front pocket
            for (let y = 12; y < 17; y++) for (let x = 6; x < 18; x++) { const curve = Math.abs(x - 11.5) / 6; if (y - 12 < 4 - curve * 2) P.put(x, y, y === 12 ? lite : body); else if (y - 12 < 5 - curve * 2) P.put(x, y, dark); }   // its flap
            P.rect(10, 15, 4, 3, 0xd8a838); P.put(11, 16, 0x6a4a10); P.put(12, 16, 0x6a4a10); P.put(10, 15, 0xfff0a0);   // the buckle
            for (let y = 1; y < 6; y++) for (let x = 3; x < 21; x++) { const e = ((y - 3.5) / 2.6) ** 2 + ((x - 12) / 9.5) ** 6; if (e <= 1) P.put(x, y, (x + y) % 5 === 0 ? 0x8a3a3a : y < 3 ? 0xd85a5a : 0xb04040); }   // the blanket roll
            for (const x of [7, 16]) for (let y = 1; y < 7; y++) P.put(x, y, 0x5a3a1a);   // its straps
            for (let x = 9; x < 15; x++) P.put(x, 0, 0x5a3a1a); P.put(9, 1, 0x5a3a1a); P.put(14, 1, 0x5a3a1a);   // the handle
            for (let y = 7; y < 24; y += 3) P.put(4, y, M(lite, 0xffffff, 0.3));   // a seam's stitches
        });
    }
    // the bottom bar's icons (24 x 24): a book, a hammer, a backpack
    _hudIcon(kind) {
        if (kind === 'pack') return this._packTex();
        return MenuArt.tex(this, 'gd5_hud_' + kind, 24, 24, P => {
            if (kind === 'book') {
                for (let y = 4; y < 21; y++) for (let x = 4; x < 20; x++) P.put(x, y, x < 7 ? 0x5a2a6a : y === 4 || y === 20 || x === 19 ? 0x3a1a4a : 0x8a4ab0);
                for (let y = 6; y < 19; y++) P.put(19, y, y % 2 ? 0xf2e2bc : 0xd8c8a0);
                P.rect(10, 9, 6, 6, 0xd8a838); P.rect(11, 10, 4, 4, 0x8affd8); P.put(11, 10, 0xffffff); for (const y of [6, 18]) for (let x = 8; x < 18; x++) P.put(x, y, 0xd8a838);
            } else {
                for (let i = 0; i < 13; i++) { P.put(6 + i * 0.75, 21 - i, 0x5a3a1a); P.put(7 + i * 0.75, 21 - i, 0xa07040); P.put(8 + i * 0.75, 21 - i, 0x5a3a1a); }   // the handle
                for (let y = 3; y < 10; y++) for (let x = 9; x < 21; x++) { const d = x - 9; if (y < 3 + (d < 3 ? 3 - d : 0)) continue; P.put(x, y, y === 3 ? 0xd8dce8 : x > 18 ? 0x5a5e6a : 0x9aa0b0); }   // the head
                P.rect(13, 5, 3, 4, 0x3a2a14);
            }
        });
    }
    _paintChest(P) {
        for (let y = 13; y < 16; y++) for (let x = 2; x < 15; x++) P.put(x, y, 0x0a1408, 0.35);
        for (let y = 3; y < 14; y++) for (let x = 1; x < 15; x++) {
            const lid = y < 7;
            P.put(x, y, x === 1 || x === 14 || y === 3 || y === 13 ? 0x2a1a10 : y === 7 ? 0xd8b84a : lid ? (y === 4 ? 0xa07a50 : 0x8a6a42) : (x % 4 === 0 ? 0x5a3a20 : 0x7a5434));
        }
        for (const x of [3, 12]) for (let y = 4; y < 13; y++) P.put(x, y, 0xb89a3a);
        P.rect(7, 6, 2, 3, 0x8affd8); P.put(7, 6, 0xffffff);
    }

    // ── BUILD MODE ────────────────────────────────────────────────────────────
    // B: pick up the garden's things and set them down somewhere else (beds keep their crops, the
    // bridges slide along the river). Where you put them is saved; the garden is laid out again.
    _applyLayout() {
        const G = GardenScene, L = Garden.layout(), keys = ['BEDS', 'STALL', 'STONE', 'TREES', 'CRYSTAL_TREES', 'WELL', 'BENCH', 'CHEST', 'BRIDGES', 'CRYSTALS', 'LAMPS', 'STONES', 'TANKS', 'ORCHARD', 'POTS'];
        G.DEF ||= Object.fromEntries(keys.map(k => [k, JSON.parse(JSON.stringify(G[k]))]));
        for (const k of keys) G[k] = JSON.parse(JSON.stringify(L[k] ?? G.DEF[k]));
    }
    _movables() {
        const G = GardenScene, M = [], one = (key, name, r, i, up = 1) => M.push({ key, i, name, r, up });
        G.BEDS.forEach(([x, y], i) => one('BEDS', 'planter', [x, y, 4, 2], i, 0));
        one('STALL', 'seed kiosk', [...G.STALL], undefined, 2);
        one('STONE', 'waystone', [G.STONE[0], G.STONE[1], 2, 1], undefined, 2);
        G.TREES.forEach(([x, y], i) => one('TREES', 'tree', [x, y, 1, 1], i, 2));
        G.CRYSTAL_TREES.forEach(([x, y], i) => one('CRYSTAL_TREES', 'crystal tree', [x, y, 1, 1], i, 2));
        G.ORCHARD.forEach(([x, y], i) => one('ORCHARD', 'orchard plot', [x, y, 3, 1], i, 3));
        G.POTS.forEach(([x, y], i) => one('POTS', 'potted tree', [Math.floor(x), Math.floor(y - 0.01), 1, 1], i, 2));
        one('WELL', 'starwell', [...G.WELL]); one('BENCH', 'bench', [...G.BENCH]); one('CHEST', 'chest', [...G.CHEST, 1, 1]);
        for (const kind of Object.keys(Garden.TANK_KINDS)) if (Garden.tank(kind)) one('TANKS', Garden.TANK_KINDS[kind].name.toLowerCase(), [...G.TANKS[kind]], kind, kind === 'cosmic' ? 0 : 1);
        G.CRYSTALS.forEach(([x, y], i) => one('CRYSTALS', 'crystal cluster', [Math.floor(x), Math.floor(y), 1, 1], i, 1));
        G.LAMPS.forEach(([x, y], i) => one('LAMPS', 'lantern', [Math.floor(x), Math.floor(y - 0.01), 1, 1], i, 2));
        G.STONES.forEach(([x, y], i) => one('STONES', 'standing stone', [Math.floor(x), Math.floor(y - 0.01), 1, 1], i, 1));
        G.BRIDGES.forEach((b, i) => M.push({ key: 'BRIDGES', i, name: 'bridge', r: [b, 0, 2, 0], bridge: true }));
        return M;
    }
    _wetL(a, b) { return this._wet.has((a + this.gx0) + ',' + (b + this.gy0)); }
    // what the eye sees of m: its solid sprites' bounds (glows and sparkles left out); a bed (painted into the ground) is its footprint
    _boundsM(m) {
        const im = (this._reg[m.key + (m.i ?? '')] || []).filter(o => o.type === 'Image' && o.blendMode !== Phaser.BlendModes.ADD && o.visible);
        if (!im.length) { const [x, y, w, h] = m.r; return new Phaser.Geom.Rectangle(this._px(x), this._py(y), w * this.T, h * this.T); }
        return im.map(o => o.getBounds()).reduce((a, b) => Phaser.Geom.Rectangle.Union(a, b));
    }
    _pick(p) {   // the smallest thing under the pointer wins (a lantern over the bed behind it)
        return this._movables().map(m => [m, this._boundsM(m)]).filter(([, b]) => b.contains(p.worldX, p.worldY)).sort((a, b) => a[1].width * a[1].height - b[1].width * b[1].height)[0]?.[0];
    }
    _hitM(m, lx, ly) {
        const [x, y, w, h] = m.r;
        if (m.bridge) return lx >= x && lx < x + 2 && this._wetL(lx, ly);
        return lx >= x && lx < x + w && ly >= y - m.up && ly < y + h;
    }
    // can m stand with its corner at (x, y)? On dry open ground, inside the garden, clear of the rest
    // and of you. A bridge: across the river (not the lake), not on top of the other one.
    _fits(m, x, y) {
        if (m.bridge) {
            if (x < -26 || x > 50 || this._inLake(x) || this._inLake(x + 1) || this._dock(x, GardenScene.DOCK[1]) || GardenScene.BRIDGES.some((b, i) => i !== m.i && Math.abs(b - x) < 4)) return false;
            for (let b = 0; b < this.rows - this.gy0; b++) if (this._wetL(x, b) && this._wetL(x + 1, b)) return true;
            return false;
        }
        const [, , w, h] = m.r, others = this._movables().filter(o => !o.bridge && !(o.key === m.key && o.i === m.i)), [px, py] = this._tile(this.fx, this.fy);
        for (let b = y; b < y + h; b++) for (let a = x; a < x + w; a++) {
            if (a < -26 || a > 52 || b < 2 || b + this.gy0 >= this.rows - 1 || this._wetL(a, b) || this._dock(a, b)) return false;
            if (a === px - this.gx0 && b === py - this.gy0) return false;
            if (others.some(o => a >= o.r[0] && a < o.r[0] + o.r[2] && b >= o.r[1] && b < o.r[1] + o.r[3])) return false;
        }
        return true;
    }
    _toggleBuild() {
        if (this._fish || this._rest || this._panelObjs || this._leaving) return;
        if (this._build) { this._buildCancel(); this._build.objs.forEach(o => o.destroy()); this._build = null; this.prompt.setVisible(false); Sfx.play(this, 'click'); this._hud(); return; }
        const W = this.scale.width, g = this.add.graphics().setDepth(6400);
        // the decor you own but haven't set down: a tray to take one from
        const own = [...Garden.slots().bag, ...Garden.slots().chest].filter(o => o?.k === 'decor'), tray = [];
        ['lamp', 'crystal', 'pot'].forEach((kind, i) => {
            const n = own.filter(o => o.id === kind).length, x = W / 2 - 140 + i * 140, y = 104;
            const b = UIKit.button(this, { x, y, w: 130, h: 34, label: `${kind === 'lamp' ? 'LANTERN' : kind === 'pot' ? 'POT TREE' : 'CRYSTAL'}  x${n}`, accent: n ? 0xffd070 : UIKit.PALETTE.line, depth: 7050, fontSize: '11px', fireOn: 'down', onClick: () => {
                if (!n || this._build?.held) { Sfx.play(this, 'deny'); return; }
                const key = kind === 'lamp' ? 'LAMPS' : kind === 'pot' ? 'POTS' : 'CRYSTALS', G = GardenScene, i2 = G[key].length, T = this.T;
                G[key].push(kind === 'lamp' ? [0, 0] : kind === 'pot' ? [0, 0, i2 % Garden.TREES.length] : [0, 0, 1.2, [0x8affd8, 0xd8a8ff, 0x9ad8ff][i2 % 3]]);
                const spr = kind === 'pot' ? this.add.sprite(0, 0, this._treeTex(Garden.TREES[i2 % Garden.TREES.length], 2), '0').setOrigin(0.5, 1).setScale(T / 16 * 0.6).setDepth(6500)
                    : this.add.image(0, 0, kind === 'lamp' ? this._lampTex() : this._crystalTex(G[key][i2][3], 22)).setOrigin(0.5, 1).setScale(T / 16).setDepth(6500);
                this._reg[key + i2] = [spr];
                const m = { key, i: i2, name: kind === 'lamp' ? 'lantern' : kind === 'pot' ? 'potted tree' : 'crystal cluster', r: [0, 0, 1, 1], up: 1, fresh: kind };
                this._build.held = m; this._build.off = [0, 0]; this._build.orig = [[spr, this._px(0) + T / 2, this._py(1)]];
                Sfx.play(this, 'pickup');
            } });
            b.objs.forEach(o => { o.setScrollFactor?.(0); tray.push(o); });
        });
        const tip = this.add.text(W / 2, 64, 'BUILD MODE  ·  click something to pick it up, click again to set it down  ·  right click puts it back  ·  B or Esc to finish', { fontSize: '12px', fontFamily: 'monospace', fontStyle: 'bold', color: '#ffe08a', backgroundColor: '#0a0618dd', padding: { x: 8, y: 4 } }).setOrigin(0.5).setScrollFactor(0).setDepth(7050);
        this._build = { g, objs: [g, tip, ...tray], held: null };
        Sfx.play(this, 'click'); this._hud();
    }
    _lxy(p) { p.updateWorldPoint?.(this.cameras.main); const [tx, ty] = this._tile(p.worldX, p.worldY); return [tx - this.gx0, ty - this.gy0]; }
    _buildMove(p) {
        const B = this._build; if (!B) return;
        const [lx, ly] = this._lxy(p), g = B.g, T = this.T, box = (x, y, w, h, col) => { g.fillStyle(col, 0.22); g.fillRect(this._px(x), this._py(y), w * T, h * T); g.lineStyle(2, col, 0.9); g.strokeRect(this._px(x), this._py(y), w * T, h * T); };
        g.clear();
        if (B.held) {
            const m = B.held, nx = lx - B.off[0], ny = m.bridge ? m.r[1] : ly - B.off[1], ok = this._fits(m, nx, ny), col = ok ? 0x8aff8a : 0xff5a5a;
            B.at = [nx, ny, ok];
            const dx = (nx - m.r[0]) * T, dy = m.bridge ? 0 : (ny - m.r[1]) * T;
            for (const [o, x, y] of B.orig) o.setPosition(x + dx, y + dy);
            const cb = this._boundsM(m); if ((this._reg[m.key + (m.i ?? '')] || []).length) { g.lineStyle(2, col, 0.9); g.strokeRect(cb.x - 2, cb.y - 2, cb.width + 4, cb.height + 4); }
            if (m.bridge) { for (let b = 0; b < this.rows - this.gy0; b++) if (this._wetL(nx, b) || this._wetL(nx + 1, b)) box(nx, b, 2, 1, col); }
            else {
                if (m.key === 'BEDS') { g.fillStyle(0x4a3020, 0.9); g.fillRoundedRect(this._px(nx) + 2, this._py(ny) + 2, 4 * T - 4, 2 * T - 4, T * 0.25); }
                box(nx, ny, m.r[2], m.r[3], col);
            }
            this.prompt.setText(ok ? `set the ${m.name} down here` : 'it won\'t fit there').setPosition(p.worldX, p.worldY - 14).setVisible(true);
            return;
        }
        const m = this._pick(p);
        if (!m) { this.prompt.setVisible(false); return; }
        const hb = this._boundsM(m); g.lineStyle(2, 0xffe08a, 1); g.strokeRect(hb.x - 2, hb.y - 2, hb.width + 4, hb.height + 4); g.fillStyle(0xffe08a, 0.12); g.fillRect(hb.x - 2, hb.y - 2, hb.width + 4, hb.height + 4);
        this.prompt.setText(`pick up the ${m.name}`).setPosition(p.worldX, p.worldY - 14).setVisible(true);
    }
    _buildClick(p) {
        const B = this._build;
        if (!B || this.input.hitTestPointer(p).some(o => o.scrollFactorX === 0)) return;
        if (p.rightButtonDown()) { this._buildCancel(); return; }
        const [lx, ly] = this._lxy(p);
        if (!B.held) {
            const m = this._pick(p); if (!m) return;
            B.held = m; B.off = [lx - m.r[0], m.bridge ? 0 : Math.max(0, Math.min(m.r[3] - 1, ly - m.r[1]))];
            B.orig = (this._reg[m.key + (m.i ?? '')] || []).map(o => [o, o.x, o.y]);
            if (m.key === 'BEDS') for (const o of this._crops) o.setVisible(false);
            Sfx.play(this, 'pickup'); this._buildMove(p); return;
        }
        const [nx, ny, ok] = B.at || [];
        if (!ok) { Sfx.play(this, 'deny'); return; }
        const m = B.held, G = GardenScene, old = G[m.key][m.i], v = m.bridge ? nx : ['STALL', 'WELL', 'BENCH', 'TANKS'].includes(m.key) ? [nx, ny, m.r[2], m.r[3]]
            : ['CRYSTALS', 'LAMPS', 'STONES', 'POTS'].includes(m.key) ? [old[0] + nx - m.r[0], old[1] + ny - m.r[1], ...old.slice(2)] : [nx, ny];   // decor keeps its place within the tile (and its size, colour)
        let val = v; if (m.i !== undefined) { val = JSON.parse(JSON.stringify(G[m.key])); val[m.i] = v; }
        if (m.fresh) { val[m.i] = m.key === 'LAMPS' ? [nx + 0.5, ny + 1] : m.key === 'POTS' ? [nx + 0.5, ny + 1, val[m.i][2]] : [nx + 0.5, ny, val[m.i][2], val[m.i][3]]; Garden.useDecor(m.fresh); }
        Garden.setLayout(m.key, val);
        Sfx.play(this, 'e_land'); B.held = null;
        this.cameras.main.fadeOut(160, 10, 6, 24);
        this.time.delayedCall(170, () => this.scene.restart({ build: true, fx: this.fx, fy: this.fy }));
    }
    _buildCancel() {
        const B = this._build; if (!B?.held) return;
        for (const [o, x, y] of B.orig) o.setPosition(x, y);
        if (B.held.fresh) { GardenScene[B.held.key].pop(); (this._reg[B.held.key + B.held.i] || []).forEach(o => o.destroy()); delete this._reg[B.held.key + B.held.i]; }
        for (const o of this._crops) o.setVisible(true);
        B.held = null; B.g.clear(); this.prompt.setVisible(false);
    }

    _leave() {
        if (this._leaving) return;
        this._leaving = true;
        this._endFish(null);
        this.cameras.main.fadeOut(300, 10, 6, 24);
        this.time.delayedCall(320, () => this.scene.start('Enchant'));
    }


    // ── THE WATER ─────────────────────────────────────────────────────────────
    // The river and lake, alive: a pixel layer (16 px a tile, like the ground) redrawn ten times a
    // second where the camera can see. Not streaks: depth shading from the banks in, slow soft
    // patches where the sky's clouds reflect, small wavelets (a lit crest, a shadow under it) riding
    // the current, foam lapping the banks, the Isle's stars twinkling, glowing lotuses drifting.
    _waterSetup() {
        const T = this.T, k = T / 16, W2 = this.cols * 16, bank = this._bank;
        const top = Math.min(...bank.map(b => b[0])) - 1, bot = Math.max(...bank.map(b => b[1])) + 1, H2 = bot - top + 1;
        const key = `gd3_water_${W2}_${H2}`, tex = this.textures.exists(key) ? this.textures.get(key) : this.textures.createCanvas(key, W2, H2), ctx = tex.getContext(), img = ctx.createImageData(W2, H2), d = img.data;
        this.add.image(this.ox, this.oy + top * k, key).setOrigin(0).setScale(k).setDepth(1);
        const n = MenuArt.noise(311), PAL = this._waterPal || [0x0e1e44, 0x132a56, 0x1a3866, 0x224878, 0x2c5a8c, 0x3a6ea0], FOAM = this._foam || [0xe8f4ff, 0x9ac8f0, 0x8ab8e0], WAVE = this._waveCol || 0x8ac4f0, BR = this._bridges ?? GardenScene.BRIDGES, dry = x => { const b = bank[Math.max(0, Math.min(W2 - 1, Math.round(x)))]; return b[1] - b[0] < 6; };
        const waves = Array.from({ length: Math.floor(W2 * H2 / 260) }, () => ({ x: Math.random() * W2, u: Math.random(), p: Math.random() * 6, l: 2 + Math.floor(Math.random() * 3), v: 0.6 + Math.random() * 0.6 }));
        const stars = Array.from({ length: Math.floor(W2 / 7) }, () => ({ x: Math.floor(Math.random() * W2), u: Math.random(), p: Math.random() * 6, c: Math.random() < 0.3 ? 0xd8a8ff : 0xffffff }));
        const lotus = Array.from({ length: this._lotus ?? 16 }, () => ({ x: Math.random() * W2, u: 0.2 + Math.random() * 0.6, v: 0.15 + Math.random() * 0.25, c: [0xff9ad8, 0x8affd8, 0xd8a8ff][Math.floor(Math.random() * 3)] }));
        const bridgeX = BR.map(b => (this.gx0 + b) * 16 + 16);
        const put = (x, y, c, a = 255) => { if (x < 0 || y < 0 || x >= W2 || y >= H2) return; const i = (y * W2 + x) * 4; d[i] = (c >> 16) & 255; d[i + 1] = (c >> 8) & 255; d[i + 2] = c & 255; d[i + 3] = a; };
        const yAt = (x, u) => { const [t0, t1] = bank[Math.max(0, Math.min(W2 - 1, Math.round(x)))]; return Math.round(t0 - top + 3 + u * (t1 - t0 - 6)); };
        // the lake is its own water: a touch greener and deeper than the river, easing in where they meet
        const LAKE = [0x0a2232, 0x0e3040, 0x15424e, 0x1e5660, 0x2a6a70, 0x3a8080], L0 = GardenScene.LAKE;
        const lakeMix = Array.from({ length: W2 }, (_, x) => { if (this._waterPal || !L0) return 0; const dx = x / 16 - this.gx0; return Math.max(0, Math.min(1, Math.min(dx - L0[0], L0[1] - dx) / 3)); });
        let last = 0;
        this._ticks.push(t => {
            if (t - last < 100) return; last = t;
            const cam = this.cameras.main, x0 = Math.max(0, Math.floor(cam.scrollX / k) - 8), x1 = Math.min(W2, Math.ceil((cam.scrollX + this.scale.width / cam.zoom) / k) + 8);
            d.fill(0);
            for (let x = x0; x < x1; x++) {
                const a = bank[x][0] - top, b = bank[x][1] - top, half = Math.max(1, (b - a) / 2);
                if (b < a) continue;   // dry here
                for (let y = a; y <= b; y++) {
                    const fromBank = Math.min(y - a, b - y) / half;   // 0 at a bank, 1 in the middle
                    let v = 0.25 + fromBank * 0.55;
                    v += (n(x * 0.035 - t * 0.00025, y * 0.06 + 2) - 0.5) * 0.35;   // slow soft patches: the clouds, reflected
                    if (y - a < 3) v -= 0.25;                                         // the near bank's shadow on the water
                    v += (MenuArt.bayer(x, y) - 0.5) * 0.12;                          // dithered between shades
                    const pc = PAL[Math.max(0, Math.min(5, Math.round((1 - v) * 5)))];
                    put(x, y, lakeMix[x] ? MenuArt.mix(pc, LAKE[Math.max(0, Math.min(5, Math.round((1 - v) * 5)))], lakeMix[x]) : pc);
                }
                put(x, a, (x + Math.floor(t * 0.003)) % 6 < 2 ? FOAM[0] : FOAM[1], 230); put(x, b, (x + 3 + Math.floor(t * 0.003)) % 6 < 2 ? FOAM[0] : FOAM[2], 200);   // foam lapping
            }
            for (const w of waves) {   // wavelets riding the current: a crest of light, its shadow under it, rising and fading
                w.x = (w.x + w.v) % W2; const xx = Math.round(w.x); if (xx < x0 || xx >= x1 || dry(xx)) continue;
                const y = yAt(xx, w.u), a = Math.sin(t * 0.0025 + w.p);
                if (a < 0.1) continue;
                for (let i = 0; i < w.l; i++) { put(xx + i, y, WAVE, Math.round(255 * a)); put(xx + i + 1, y + 1, 0x0a1838, Math.round(160 * a)); }
                put(xx + Math.floor(w.l / 2), y - 1, 0xd8f0ff, Math.round(200 * a));
            }
            for (const S of stars) {
                if (S.x < x0 || S.x >= x1 || dry(S.x)) continue;
                const y = yAt(S.x, S.u), a = Math.sin(t * 0.003 + S.p);
                if (a > 0.4) { put(S.x, y, S.c, Math.round(255 * a)); if (a > 0.9) { put(S.x - 1, y, S.c, 110); put(S.x + 1, y, S.c, 110); put(S.x, y - 1, S.c, 110); put(S.x, y + 1, S.c, 110); } }
            }
            for (const L of lotus) {
                L.x = (L.x + L.v) % W2;
                const xx = Math.round(L.x); if (xx < x0 || xx >= x1 || dry(xx) || bridgeX.some(bx => Math.abs(xx - bx) < 22)) continue;
                const y = yAt(xx, L.u);
                for (let j = -1; j <= 1; j++) for (let i = -3; i <= 3; i++) if ((i * i) / 10 + j * j <= 1.1 && !(i > 0 && j === 0)) put(xx + i, y + j, j < 0 ? 0x4a9a58 : 0x2e7a44);
                put(xx, y - 1, L.c); put(xx - 1, y - 1, L.c); put(xx + 1, y - 1, L.c); put(xx, y - 2, 0xffffff);
            }
            ctx.putImageData(img, 0, 0); tex.refresh();
        });
        BR.forEach((b, i) => {   // the bridges, over the water
            const bx = (this.gx0 + b) * 16, t0 = Math.min(bank[bx][0], bank[bx + 31][0]) - 5, t1 = Math.max(bank[bx][1], bank[bx + 31][1]) + 5, bh = t1 - t0;
            this.add.image(this.ox + (bx - 1) * k, this.oy + t0 * k, MenuArt.tex(this, `gd3_bridge_${bh}`, 34, bh + 2, P => {
                for (let y = 0; y < bh; y++) for (let x = 0; x < 34; x++) { const rail = x < 3 || x >= 31; P.put(x, y, rail ? (x === 0 || x === 33 ? 0x3a2414 : 0x7a5434) : (y % 4 === 0) ? 0x4a3020 : (x + y) % 11 === 0 ? 0x7a5a3a : MenuArt.bayer(x, y) < 0.5 ? 0xa07a50 : 0x8a6a42); }
                for (const xx of [1, 31]) for (const yy of [0, bh - 7]) for (let j = 0; j < 7; j++) { P.put(xx, yy + j, 0x9a7448); P.put(xx + 1, yy + j, 0x5a3a20); }
                for (let x = 0; x < 34; x++) P.put(x, bh + 1, 0x0a1430, 0.5);
            })).setOrigin(0).setScale(k).setDepth(2);
            (this._reg['BRIDGES' + i] ||= []).push(this.children.list[this.children.list.length - 1]);
        });
    }

    // ── WHAT MAKES IT THE ISLE ────────────────────────────────────────────────
    // Crystal clusters glowing in the grass, shards adrift in the air, violet-flamed lanterns along the
    // paths, luminous mushrooms, and a faint aurora over it all.
    _ethereal() {
        const T = this.T, k = T / 16, W = this.scale.width, H = this.scale.height;
        const G = GardenScene, L = Garden.layout(), reg = (key, i, o) => { (this._reg[key + i] ||= []).push(o); return o; };
        // the crystal clusters and lamps can be moved (build mode); the defaults that land somewhere taken are dropped
        if (!L.CRYSTALS) G.CRYSTALS = G.CRYSTALS.filter(([tx, ty]) => this._clear(tx, ty));
        if (!L.LAMPS) G.LAMPS = G.LAMPS.filter(([tx, ty]) => this._clear(tx, ty - 0.5, 0));
        G.CRYSTALS.forEach(([tx, ty, s2, col], i) => {
            const x = this._px(tx), y = this._py(ty) + T;
            const gl = reg('CRYSTALS', i, this.add.image(x, y - T * 0.5 * s2, 'mn_glow').setTint(col).setBlendMode(Phaser.BlendModes.ADD).setDisplaySize(T * 2.2 * s2, T * 2.2 * s2).setAlpha(0.45).setDepth(y - 1));
            this.tweens.add({ targets: gl, alpha: 0.18, duration: 1300 + Math.abs(tx) * 40, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
            reg('CRYSTALS', i, this.add.image(x, y, this._crystalTex(col, Math.round(18 * s2))).setOrigin(0.5, 1).setScale(k).setDepth(y));
            reg('CRYSTALS', i, this.add.particles(0, 0, 'mn_px2', { x: { min: x - T * 0.4, max: x + T * 0.4 }, y: { min: y - T * s2, max: y - 4 }, lifespan: 800, speed: 0, scale: { start: 2, end: 0 }, tint: [0xffffff, col], blendMode: 'ADD', frequency: 380 }).setDepth(y + 1));
        });
        if (this.scene.key === 'Garden') G.POTS.forEach(([tx, ty, ti], i) => {   // potted star trees: a clay pot, a small grown tree of that kind in it
            const x = this._px(tx), y = this._py(ty), Tr = Garden.TREES[ti % Garden.TREES.length], ik = this._treeTex(Tr, 2);
            reg('POTS', i, this.add.image(x, y, MenuArt.tex(this, 'gd6_pot', 14, 9, P => { for (let yy = 0; yy < 9; yy++) for (let xx = 0; xx < 14; xx++) if (Math.abs(xx - 6.5) <= 6.5 - yy * 0.45) P.put(xx, yy, yy === 0 ? 0xe8a070 : xx < 4 ? 0xd88a5a : xx > 10 ? 0x8a4a2a : 0xb86a3a); })).setOrigin(0.5, 1).setScale(k).setDepth(y + 0.1));
            const sp = reg('POTS', i, this.add.sprite(x, y - T * 0.45, ik, '0').setOrigin(0.5, 1).setScale(k * 0.6).setDepth(y)); sp.play(ik);
            const gl = reg('POTS', i, this.add.image(x, y - T * 1.4, 'mn_glow').setTint(Tr.col).setBlendMode(Phaser.BlendModes.ADD).setDisplaySize(T * 2.2, T * 2.2).setAlpha(0.25).setDepth(y - 1));
            this.tweens.add({ targets: gl, alpha: 0.1, duration: 1500 + i * 130, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
        });
        for (let i = 0, tries = 0; i < 18 && tries < 200; tries++) {   // shards adrift in the air, turning slowly, over open grass
            const lx = -26 + Math.random() * 78, ly = 2 + Math.random() * 11;
            if (!this._clear(lx, ly)) continue;
            i++;
            const x = this._px(lx), y = this._py(ly), col = [0x8affd8, 0xd8a8ff, 0x9ad8ff][i % 3];
            const sh = this.add.image(x, y, this._crystalTex(col, 8)).setScale(k * 0.9).setDepth(4800).setAlpha(0.85);
            this.tweens.add({ targets: sh, y: y - T * 0.5, angle: { from: -12, to: 12 }, duration: 2400 + i * 300, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
            const sg = this.add.image(x, y, 'mn_glow').setTint(col).setBlendMode(Phaser.BlendModes.ADD).setDisplaySize(T * 1.2, T * 1.2).setAlpha(0.35).setDepth(4799);
            this.tweens.add({ targets: sg, y: y - T * 0.5, duration: 2400 + i * 300, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
        }
        G.STONES.forEach(([tx, ty], i) => {   // the Grove's standing stones, a rune glowing in each
            const x = this._px(tx), y = this._py(ty);
            reg('STONES', i, this.add.image(x, y, MenuArt.tex(this, 'gd3_menhir', 7, 14, P => {
                for (let yy = 0; yy < 13; yy++) for (let xx = 0; xx < 7; xx++) { const w = yy < 2 ? 2 : 3; if (Math.abs(xx - 3) > w) continue; P.put(xx, yy, xx > 4 ? 0x3a3854 : yy < 2 ? 0x8a88a8 : xx < 2 ? 0x7a789a : 0x5e5c7c); }
                P.put(3, 5, 0x9ad8ff); P.put(3, 6, 0x9ad8ff); P.put(2, 6, 0x9ad8ff); P.put(4, 6, 0x9ad8ff); P.put(3, 7, 0x9ad8ff);
                for (const [xx, yy] of [[1, 9], [2, 11], [5, 3]]) P.put(xx, yy, 0x3a6230);
                for (let xx = 0; xx < 7; xx++) P.put(xx, 13, 0x0a1408, 0.4);
            })).setOrigin(0.5, 1).setScale(k).setDepth(y));
        });
        G.LAMPS.forEach(([tx, ty], i) => {   // lanterns along the paths, violet-flamed
            const x = this._px(tx), y = this._py(ty);
            reg('LAMPS', i, this.add.image(x, y, this._lampTex()).setOrigin(0.5, 1).setScale(k).setDepth(y));
            const f = reg('LAMPS', i, this.add.image(x, y - 22 * k, 'mn_glow').setTint(0xb07aff).setBlendMode(Phaser.BlendModes.ADD).setDisplaySize(T * 2.4, T * 2.4).setAlpha(0.55).setDepth(y + 1));
            this.tweens.add({ targets: f, alpha: { from: 0.35, to: 0.65 }, duration: 160 + Math.random() * 200, yoyo: true, repeat: -1 });
        });
        for (let i = 0; i < 40; i++) {   // luminous mushrooms in the grass
            const tx = -26 + Math.random() * 78, ty = 2 + Math.random() * 12, ltx = Math.floor(tx), lty = Math.floor(ty);
            if (!this._clear(tx, ty, 0)) continue;
            const x = this._px(tx), y = this._py(ty), col = [0x8affd8, 0x9ad8ff, 0xff9ad8][i % 3];
            this.add.image(x, y, MenuArt.tex(this, 'gd2_shroom' + (i % 3), 7, 6, P => { for (let xx = 0; xx < 7; xx++) for (let yy = 0; yy < 3; yy++) if (Math.abs(xx - 3) <= 3 - yy * 0.5) P.put(xx, yy, yy === 0 ? MenuArt.mix(col, 0xffffff, 0.5) : col); P.put(3, 3, 0xe8e0c8); P.put(3, 4, 0xe8e0c8); P.put(1, 1, 0xffffff); })).setOrigin(0.5, 1).setScale(k).setDepth(y);
            const g = this.add.image(x, y - 2 * k, 'mn_glow').setTint(col).setBlendMode(Phaser.BlendModes.ADD).setDisplaySize(T * 0.9, T * 0.9).setAlpha(0.4).setDepth(y + 1);
            this.tweens.add({ targets: g, alpha: 0.15, duration: 1500 + i * 70, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
        }
        const au = this.add.image(W / 2, H / 2, MenuArt.tex(this, 'gd2_aurora', 64, 36, P => { for (let y = 0; y < 36; y++) for (let x = 0; x < 64; x++) { const v = Math.sin(x * 0.12 + y * 0.05) * 0.5 + 0.5; P.put(x, y, MenuArt.mix(0x8affd8, 0xb07aff, v), 0.12 * (1 - y / 36)); } }, { linear: true })).setDisplaySize(W, H).setBlendMode(Phaser.BlendModes.ADD).setDepth(4850).setScrollFactor(0);
        this.tweens.add({ targets: au, alpha: { from: 0.7, to: 1 }, duration: 4000, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    }
    _decorTex(id) { return id === 'lamp' ? this._lampTex() : id === 'pot' ? this._potTex() : this._crystalTex(0xd8a8ff, 18); }
    // the potted star tree, as an icon: a clay pot, a little round crown of lilac leaves
    _potTex() {
        return MenuArt.tex(this, 'gd6_potico', 16, 16, P => {
            for (let y = 11; y < 16; y++) for (let x = 4; x < 12; x++) if (Math.abs(x - 7.5) <= 4 - (y - 11) * 0.4) P.put(x, y, x < 6 ? 0xd88a5a : x > 9 ? 0x8a4a2a : 0xb86a3a);
            for (let x = 3; x < 13; x++) P.put(x, 11, 0xe8a070);
            for (let y = 7; y < 11; y++) P.put(8, y, 0x5a3a4a);
            for (let y = 1; y < 8; y++) for (let x = 3; x < 13; x++) if (((x - 7.8) / 4.6) ** 2 + ((y - 4.5) / 3.4) ** 2 <= 1) P.put(x, y, y < 4 ? 0xd8c8ff : (x + y) % 3 ? 0xa890e0 : 0x8a7ab8);
            P.put(6, 3, 0xffffff); P.put(10, 5, 0xfff0a0);
            for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) if (P.alpha(x, y) > 0.9 && [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => P.alpha(x + dx, y + dy) < 0.5)) P.put(x, y, 0x1c1728);
        });
    }
    _lampTex() {
        return MenuArt.tex(this, 'gd2_lantern', 8, 26, P => {
            for (let yy = 8; yy < 26; yy++) { P.put(3, yy, 0x5a3a20); P.put(4, yy, 0x3a2414); }
            for (let yy = 1; yy < 8; yy++) for (let xx = 1; xx < 7; xx++) P.put(xx, yy, xx === 1 || xx === 6 || yy === 1 || yy === 7 ? 0x2a2440 : yy < 4 ? 0xe8d8ff : 0xb07aff);
            P.put(3, 0, 0x2a2440); P.put(4, 0, 0x2a2440);
        });
    }
    // decor only on open grass: no water (bridges included), nothing placed, r tiles round it and above (it stands up)
    _clear(lx, ly, r = 1) {
        for (let dx = -r; dx <= r; dx++) for (let dy = -r; dy <= 0; dy++) {
            const x = Math.floor(lx) + dx + this.gx0, y = Math.floor(ly) + dy + this.gy0;
            if (this._wet.has(x + ',' + y) || !this._open(x, y) || GardenScene.TREES.concat(GardenScene.CRYSTAL_TREES).some(([tx, ty]) => tx === x - this.gx0 && ty === y - this.gy0) || GardenScene.ORCHARD.some(([ox, oy]) => x - this.gx0 >= ox && x - this.gx0 < ox + 3 && y - this.gy0 === oy) || GardenScene.BEDS.some(([bx, by]) => x - this.gx0 >= bx && x - this.gx0 < bx + 4 && y - this.gy0 >= by && y - this.gy0 < by + 2)) return false;   // (fields are walkable now, not empty ground)
        }
        return true;
    }
    // a crystal cluster, in its colour
    _crystalTex(col, h) {
        return MenuArt.tex(this, `gd2_cry_${col}_${h}`, Math.round(h * 0.8) + 2, h + 2, P => {
            const w = P.w, cx = w / 2, mix = MenuArt.mix;
            for (const [ox, sh, sw] of [[-w * 0.22, h * 0.6, Math.max(1.5, h * 0.1)], [w * 0.22, h * 0.7, Math.max(1.5, h * 0.1)], [0, h, Math.max(2, h * 0.13)]])
                for (let j = 0; j < sh; j++) { const tip = j > sh - sw * 1.5, ww = tip ? sw * (sh - j) / (sw * 1.5) : sw; for (let x = -ww; x <= ww; x++) { const f = (x + ww) / (2 * ww + 0.01); P.put(cx + ox + x, h + 1 - j, tip ? 0xffffff : f < 0.35 ? mix(col, 0xffffff, 0.6) : f < 0.7 ? col : mix(col, 0x0a0614, 0.45)); } }
            for (let y = 0; y < P.h; y++) for (let x = 0; x < P.w; x++) if (P.alpha(x, y) > 0.9 && [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => P.alpha(x + dx, y + dy) < 0.5)) P.put(x, y, mix(col, 0x0a0614, 0.8));
        });
    }

    // ── THE ART (16 px a tile, drawn T/16, a 3/4 view) ───────────────────────
    _paintGround(P) {
        const n = MenuArt.noise(91), n2 = MenuArt.noise(92), R = MenuArt.rng(17), g0 = [this.gx0 * 16, this.gy0 * 16], toP = (tx, ty) => [g0[0] + tx * 16, g0[1] + ty * 16];
        const GR = [0x2c5a2a, 0x356a30, 0x3e7a36, 0x4a8a3e, 0x5a9a48], GROVE = [0x2a4a40, 0x305a4c, 0x386a56, 0x447a62, 0x548a70];
        for (let y = 0; y < P.h; y++) for (let x = 0; x < P.w; x++) {
            const g = MenuArt.fbm(n, x * 0.03, y * 0.03, 3), d = MenuArt.fbm(n2, x * 0.11, y * 0.11, 2), lx = x / 16 - this.gx0;
            let i = g > 0.62 ? 3 : g > 0.48 ? 2 : g > 0.36 ? 1 : 0;
            if (d > 0.62 && MenuArt.bayer(x, y) < 0.45) i = Math.min(4, i + 1); else if (d < 0.32 && MenuArt.bayer(x, y) < 0.3) i = Math.max(0, i - 1);
            const grove = Math.max(0, Math.min(1, (-lx - 0) / 3));   // the Grove's grass goes blue-green, moonlit
            P.put(x, y, grove > 0 ? MenuArt.mix(GR[i], GROVE[i], grove) : GR[i]);
        }
        for (let k = 0; k < P.w * P.h / 30; k++) {
            const x = Math.floor(R() * P.w), y = Math.floor(R() * P.h), h = 1 + Math.floor(R() * 3);
            for (let j = 0; j < h; j++) P.put(x + (j === h - 1 && R() < 0.5 ? (R() < 0.5 ? -1 : 1) : 0), y - j, j === h - 1 ? 0x7ab85a : 0x4a8a3e);
        }
        const fy = g0[1] + 16 + 4;   // the fence along the top
        for (let x = 0; x < P.w; x++) { for (const yy of [fy + 2, fy + 6]) { P.put(x, yy, 0x8a6a42); P.put(x, yy + 1, 0x5a3a20); } }
        for (let x = 4; x < P.w; x += 18) for (let y = fy - 2; y < fy + 12; y++) { P.put(x, y, y === fy - 2 ? 0xa88a5a : 0x7a5a36); P.put(x + 1, y, 0x5a3a20); P.put(x + 2, y + 1, 0x1a1810, 0.3); }
        const bedAt = GardenScene.BEDS.map(([bx, by]) => toP(bx, by)), inBed = (x, y) => bedAt.some(([bx, by]) => x >= bx - 1 && x < bx + 65 && y >= by - 1 && y < by + 33);   // the path stops at a bed (its mounds sit in grass)
        const cobble = (x0, y0, x1, y1) => {
            const put = P.put; P.put = (x, y, ...a) => { if (!inBed(x, y)) put.call(P, x, y, ...a); };
            for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) P.put(x, y, 0x4a3a2a);
            const C = MenuArt.rng(x0 * 7 + y0);
            for (let yy = y0 + 1; yy < y1 - 1; yy += 4) for (let xx = x0 + 1 + ((yy / 4) % 2) * 2; xx < x1 - 1; xx += 5) {
                const w = 3 + Math.floor(C() * 2), h = 2 + Math.floor(C() * 2), sh = C(), base = sh > 0.6 ? 0x9a9488 : sh > 0.3 ? 0x8a8478 : 0x7a7468;
                for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) if (!((i === 0 || i === w - 1) && (j === 0 || j === h - 1))) P.put(xx + i, yy + j, j === 0 ? MenuArt.mix(base, 0xffffff, 0.2) : j === h - 1 ? MenuArt.mix(base, 0x000000, 0.25) : base);
            }
            for (let x = x0; x < x1; x++) for (const yy of [y0, y1 - 1]) if (C() < 0.5) P.put(x, yy, 0x4a8a3e);
            for (let y = y0; y < y1; y++) for (const xx of [x0, x1 - 1]) if (C() < 0.5) P.put(xx, y, 0x4a8a3e);
            P.put = put;
        };
        const sq = (a, b, c, d2) => { const [x0, y0] = toP(a, b), [x1, y1] = toP(c, d2); cobble(x0, y0, x1, y1); };
        sq(11, 2, 13, 11); sq(13, 6, 20, 7); sq(11, 13, 13, 15); sq(-26, 7, 11, 8); sq(13, 7, 37, 8); sq(-16, 8, -14, 11); sq(-16, 13, -14, 15);
        // the banks (the water itself is live: _waterSetup): uneven, wet earth, a moss lip, stones, crystal grit
        for (let x = 0; x < P.w; x++) {
            const [t0, t1] = this._bank[x];
            for (let y = t0 - 4; y < t0; y++) P.put(x, y, y === t0 - 1 ? 0x1a140c : y === t0 - 4 ? 0x3a6230 : 0x3a3020);
            for (let y = t0; y <= t1; y++) P.put(x, y, 0x10284a);
            for (let y = t1 + 1; y < t1 + 4; y++) P.put(x, y, y === t1 + 1 ? 0x6a5a3a : y === t1 + 3 ? 0x4a8a3e : 0x5a4a30);
            if (R() < 0.12) { const sy = R() < 0.5 ? t0 - 2 : t1 + 2; P.put(x, sy, 0x9a9488); P.put(x + 1, sy, 0x7a7468); P.put(x, sy - 1, 0xb8b4a8); }
            if (R() < 0.04) { const sy = R() < 0.5 ? t0 - 3 : t1 + 3; P.put(x, sy, 0x8affd8); P.put(x, sy - 1, 0xd8fff0); }
        }
        for (let k = 0; k < P.w / 7; k++) {   // reeds and cattails along the banks
            const x = Math.floor(R() * P.w), lxx = Math.floor(x / 16) - this.gx0; if (GardenScene.BRIDGES.some(b => lxx >= b - 1 && lxx <= b + 2) || (lxx >= GardenScene.DOCK[0] - 1 && lxx <= GardenScene.DOCK[0] + 2)) continue;
            const yb = R() < 0.5 ? this._bank[x][0] - 1 : this._bank[x][1] + 2, h = 4 + Math.floor(R() * 5);
            for (let j = 0; j < h; j++) P.put(x + (j > h - 3 ? 1 : 0), yb - j, j > h - 3 && R() < 0.5 ? 0x6a3a1a : j % 2 ? 0x6a8a3a : 0x4a6a2a);
            P.put(x + 2, yb - 2, 0x5a8a3a); P.put(x + 3, yb - 3, 0x4a7a32);
        }
        // the beds: a field of tilled soil (flush with the grass, no frame), hoed into furrows along it
        for (const [bx, by] of GardenScene.BEDS) {
            const [x0, y0] = toP(bx, by), x1 = x0 + 64, y1 = y0 + 32;
            for (let y = y0 - 1; y < y1 + 1; y++) for (let x = x0 - 1; x < x1 + 1; x++) {
                const dx = Math.min(x - x0 + 1, x1 - x), dy = Math.min(y - y0 + 1, y1 - y);
                if (dx < 4 && dy < 4 && (4 - dx) ** 2 + (4 - dy) ** 2 > 16 + n(x, y) * 6) continue;     // rounded, ragged corners
                if ((dx === 0 || dy === 0) && n(x * 0.7, y * 0.7) > 0.5) continue;                     // grass nibbling the edge
                const f = (y - y0 + Math.round(Math.sin(x * 0.2) * 0.6)) % 5;                         // furrows, a little wavy
                let c = f === 0 ? 0x6e5034 : f === 1 ? 0x5a3e28 : f === 4 ? 0x3a2616 : MenuArt.bayer(x, y) < 0.5 ? 0x4e3422 : 0x46301e;
                if (dx < 2 || dy < 2) c = MenuArt.mix(c, 0x3a2a18, 0.5);
                if (n(x * 0.6, y * 0.6) > 0.82) c = 0x7a5a3a;                                           // a clod
                P.put(x, y, c);
            }
        }
        // the Grove's ring of old standing stones round the moonwell, and its moonlit flowers
        // (the Grove's standing stones are sprites, movable: _ethereal)
        const busy = (x, y) => { const tx = Math.floor(x / 16) - this.gx0, ty = Math.floor(y / 16) - this.gy0; return ty < 2 || this._wet.has(Math.floor(x / 16) + ',' + Math.floor(y / 16)) || GardenScene.BEDS.some(([bx, by]) => tx >= bx - 1 && tx < bx + 5 && ty >= by - 1 && ty < by + 3) || (tx >= 10 && tx <= 13 && ty > 1) || (tx >= 19 && tx <= 25 && ty <= 7) || ty === 7; };
        for (let k = 0; k < P.w * P.h / 700; k++) {
            const cx = R() * P.w, cy = R() * P.h, grove = cx / 16 - this.gx0 < 0, col = grove ? [0xd8a8ff, 0xa8d8ff, 0xffffff][Math.floor(R() * 3)] : [0xff8ad8, 0xffe08a, 0xa8d8ff, 0xffffff, 0xff9a6a][Math.floor(R() * 5)];
            if (busy(cx, cy)) continue;
            for (let f = 0; f < 3 + R() * 4; f++) { const x = cx + (R() - 0.5) * 8, y = cy + (R() - 0.5) * 5; P.put(x, y + 1, 0x3a7a34); P.put(x, y, col); P.put(x + 1, y, MenuArt.mix(col, 0xffffff, 0.5)); }
        }
    }
    // a crystal tree (the Grove): a dark twisted trunk, a crown of crystal shards in its colour
    _paintCrystalTree(P, col) {
        const R = MenuArt.rng(col & 255), mix = MenuArt.mix;
        for (let y = 46; y < 52; y++) for (let x = 8; x < 32; x++) if (((x - 20) / 12) ** 2 + ((y - 49) / 2.8) ** 2 <= 1) P.put(x, y, 0x0a1408, 0.4);
        for (let y = 26; y < 50; y++) { const w = 2 + (y - 26) / 12; for (let x = -w; x <= w; x++) P.put(20 + x + Math.sin(y * 0.3) * 1.5, y, x < -w / 3 ? 0x5a4a6a : x > w / 3 ? 0x1e1830 : 0x3a2e4a); }
        for (const [bx, by, a] of [[20, 26, -1.9], [20, 28, -1.2], [20, 30, -2.4], [20, 24, -1.6]]) for (let j = 0; j < 10; j++) P.put(bx + Math.cos(a) * j, by + Math.sin(a) * j * 0.6, 0x2a2238);
        const shards = Array.from({ length: 16 }, () => [6 + R() * 28, 4 + R() * 22, 3 + R() * 6, 1 + R() * 1.6]);
        for (const [sx, sy, h, w] of shards.sort((a, b) => a[1] - b[1])) for (let j = 0; j < h; j++) { const ww = Math.max(0.4, w * (1 - j / h)); for (let x = -ww; x <= ww; x++) { const f = (x + ww) / (2 * ww + 0.01); P.put(sx + x, sy + h - j, j > h - 1.5 ? 0xffffff : f < 0.35 ? mix(col, 0xffffff, 0.6) : f < 0.7 ? col : mix(col, 0x0a0614, 0.45)); } }
        for (let y = 0; y < P.h; y++) for (let x = 0; x < P.w; x++) if (P.alpha(x, y) > 0.9 && [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => P.alpha(x + dx, y + dy) < 0.5)) P.put(x, y, 0x140e22);
    }
    // the seed kiosk: pale stone pillars capped with crystals, a dark wood counter carved with runes,
    // a starry canopy with a gold-trimmed hem, hanging pouches, jars of glowing seeds, a crystal ball, its sign
    _paintStall(P, w, h) {
        // a market stall grown old on the Isle: mossy slate shingles over a scalloped violet valance, timber posts
        // carved and mossed at the foot, a plank back wall with shelves of glowing seed jars and herbs drying, a
        // counter under a runner cloth, a crate of glowing bulbs and a sack of seeds out front, a lantern, a hanging sign
        const n = MenuArt.noise(808), R = MenuArt.rng(808), M = MenuArt.mix, sh = (c, x, y, k = 0.18) => M(c, (n(x * 0.4, y * 0.4) > 0.5 ? 0xffffff : 0x000000), k * Math.abs(n(x * 0.4, y * 0.4) - 0.5) * 2);
        const WD = [0x8a6040, 0x6a4630, 0x4a2e1e, 0x2e1c12], SL = [0x5a8a7a, 0x3e6a5e, 0x2a4a44, 0x1c3030];
        for (let y = h - 8; y < h; y++) for (let x = 2; x < w - 2; x++) if (((x - w / 2) / (w / 2)) ** 2 + ((y - h + 4) / 4) ** 2 <= 1) P.put(x, y, 0x0a1408, 0.4);
        // back wall: vertical planks, shelves, jars, herbs
        for (let y = 22; y < 54; y++) for (let x = 9; x < w - 9; x++) { const pl = (x - 9) % 7; P.put(x, y, sh(pl === 0 ? WD[3] : pl === 1 ? WD[1] : WD[2], x, y, 0.25)); }
        for (let y = 22; y < 26; y++) for (let x = 9; x < w - 9; x++) P.put(x, y, M(WD[3], 0x000000, 0.4));   // the roof's shadow on it
        for (const sy of [36, 47]) { for (let x = 10; x < w - 10; x++) { P.put(x, sy, WD[0]); P.put(x, sy + 1, WD[3]); } for (const bx of [12, w - 13]) { P.put(bx, sy + 2, WD[2]); P.put(bx, sy + 3, WD[2]); } }
        const JAR = [0x9aff8a, 0xffe08a, 0x9ad8ff, 0xd8a8ff, 0xff9a6a, 0x8affd8];
        for (let k = 0; k < 7; k++) { const jx = 14 + k * 8, jy = 36, c = JAR[k % 6], tall = 5 + (k % 2); for (let y = jy - tall; y < jy; y++) for (let x = jx - 2; x <= jx + 2; x++) { const edge = x === jx - 2 || x === jx + 2; P.put(x, y, edge ? 0xc8d8e0 : y > jy - tall + 2 ? c : M(c, 0x101828, 0.55)); } P.put(jx - 1, jy - tall + 2, 0xffffff); P.put(jx - 1, jy - tall - 1, WD[1]); P.put(jx, jy - tall - 1, WD[1]); P.put(jx + 1, jy - tall - 1, WD[1]); }
        for (let k = 0; k < 6; k++) { const bx = 15 + k * 10, c = [0x6aaa4a, 0xc8a050, 0x8a6ad8][k % 3]; for (let y = 39; y < 45; y++) { P.put(bx + (y % 2), y, y < 41 ? 0xc8b088 : c); P.put(bx - 1 + ((y + 1) % 2), y, M(c, 0x000000, 0.25)); } }   // herbs and seed pods drying
        for (let k = 0; k < 5; k++) { const bx = 16 + k * 11, c = JAR[(k + 2) % 6]; for (let y = 42; y < 47; y++) for (let x = bx - 3; x <= bx + 3; x++) if (((x - bx) / 3.4) ** 2 + ((y - 45) / 3) ** 2 <= 1) P.put(x, y, y < 43 ? 0xd8c8a0 : x < bx ? 0xc8a878 : 0x9a7a50); P.put(bx, 44, c); }   // little seed sacks on the lower shelf
        // posts: timber, carved rings, moss at the foot
        for (const px of [3, w - 10]) for (let y = 14; y < h - 6; y++) for (let x = 0; x < 7; x++) {
            let c = x === 0 ? WD[3] : x < 2 ? WD[0] : x < 5 ? WD[1] : WD[2];
            if ((y - 14) % 14 === 6 || (y - 14) % 14 === 7) c = M(c, 0x000000, 0.35);
            if (y > h - 14 && n(x * 0.7 + px, y * 0.7) > 0.45) c = y % 2 ? 0x4a7a3a : 0x5a9a48;
            P.put(px + x, y, sh(c, px + x, y, 0.2));
        }
        // the counter, its runner cloth with a gold hem, its carved front, a potted sprout and a scale on it
        for (let y = 52; y < h - 6; y++) for (let x = 8; x < w - 8; x++) { const pl = (x - 8) % 9; P.put(x, y, sh(y === 52 ? WD[0] : pl === 0 ? WD[3] : y === h - 7 ? WD[3] : WD[1], x, y, 0.25)); }
        for (let x = 7; x < w - 7; x++) { P.put(x, 51, 0x3a7a5a); P.put(x, 52, 0x2e6a4a); P.put(x, 53, (x % 4) < 2 ? 0xd8b84a : 0x2e6a4a); }
        for (let x = 30; x < 50; x++) for (let y = 54; y < 62; y++) if (y === 54 || ((x - 30) % 5 === 0 && y < 60)) P.put(x, y, 0x2e6a4a);   // the runner hanging down the front
        for (let y = 55; y < 61; y++) for (let x = 32; x < 48; x++) P.put(x, y, (x + y) % 6 === 0 ? 0xd8b84a : 0x3a7a5a);
        for (let k = 0; k < 4; k++) P.put(36 + k * 3, 58, 0xd8b84a);
        for (let y = 45; y < 51; y++) for (let x = 15; x < 21; x++) P.put(x, y, y < 46 ? 0xb86a3a : x < 17 ? 0xc87a4a : 0x8a4a2a);   // a pot
        P.put(17, 44, 0x5a9a48); P.put(18, 43, 0x6aba58); P.put(16, 42, 0x9aff8a); P.put(19, 42, 0x8affd8); P.put(18, 41, 0xffffff);
        for (let x = 58; x < 66; x++) P.put(x, 50, 0xd8b84a); P.put(62, 49, 0xd8b84a); P.put(62, 48, 0xd8b84a); for (let x = 59; x < 65; x++) P.put(x, 47, 0xd8b84a);   // a brass scale
        // the roof: slate shingles in rows, each scalloped, a ridge beam, moss in the joints, a scalloped valance under it
        for (let y = 2; y < 18; y++) for (let x = 0; x < w; x++) {
            const row = Math.floor((y - 2) / 4), off = (row % 2) * 3, sc = (x + off) % 6, inRow = (y - 2) % 4;
            if (y < 4 && (x < 3 || x > w - 4)) continue;
            let c = inRow === 3 || (inRow === 2 && (sc === 0 || sc === 5)) ? SL[3] : inRow === 0 ? SL[0] : sc < 2 ? SL[1] : SL[2];
            if (n(x * 0.5, y * 0.8) > 0.68 && inRow > 1) c = (x + y) % 2 ? 0x4a7a3a : 0x6a9a4a;
            P.put(x, y, sh(c, x, y, 0.15));
        }
        for (let x = 1; x < w - 1; x++) { P.put(x, 1, WD[1]); P.put(x, 2, WD[3]); }
        for (let x = 0; x < w; x++) { const sc = x % 8, d = sc < 4 ? sc : 7 - sc; for (let y = 18; y < 21 + (d > 1 ? 1 : 0) + (d > 2 ? 1 : 0); y++) P.put(x, y, y === 18 ? 0xd8b84a : (x % 8 === 4 ? 0x5a3a9a : 0x7a4ac0)); }
        // the hanging sign
        P.put(33, 21, WD[3]); P.put(33, 22, WD[3]); P.put(46, 21, WD[3]); P.put(46, 22, WD[3]);
        for (let y = 23; y < 34; y++) for (let x = 28; x < 52; x++) { const e = y === 23 || y === 33 || x === 28 || x === 51; P.put(x, y, e ? WD[3] : (y === 24 ? 0xf0e0b8 : y === 32 ? 0xc8a878 : 0xe8d4a8)); }
        P.put(29, 24, 0x9aff8a); P.put(50, 24, 0x9aff8a); P.put(29, 32, 0x9aff8a); P.put(50, 32, 0x9aff8a);
        // out front: a crate of glowing bulbs (left), a sack of seeds spilling (right)
        for (let y = h - 15; y < h - 4; y++) for (let x = 0; x < 15; x++) P.put(x, y, y === h - 15 ? WD[0] : x % 7 === 0 || y === h - 5 ? WD[3] : (y - (h - 15)) % 5 === 0 ? WD[2] : WD[1]);
        for (const [bx, by, c] of [[3, h - 16, 0x9aff8a], [7, h - 17, 0x8affd8], [11, h - 16, 0x9aff8a], [5, h - 18, 0xffffff]]) { P.put(bx, by, c); P.put(bx + 1, by, c); P.put(bx, by - 1, M(c, 0xffffff, 0.5)); }
        for (let y = h - 17; y < h - 4; y++) for (let x = w - 14; x < w; x++) { const cx = w - 7, e = ((x - cx) / 6.5) ** 2 + ((y - (h - 10)) / 6.5) ** 2; if (e <= 1) P.put(x, y, x < cx - 2 ? 0xd8c8a0 : x > cx + 3 ? 0x9a7a50 : 0xc8a878); }
        for (let x = w - 10; x < w - 3; x++) P.put(x, h - 16, 0x7a5a36);
        for (const [sx2, sy2] of [[w - 16, h - 5], [w - 18, h - 4], [w - 15, h - 3], [w - 20, h - 4]]) P.put(sx2, sy2, 0xffe08a);
        // the lantern off the right post
        for (let y = 24; y < 28; y++) P.put(w - 3, y, WD[3]);
        for (let y = 28; y < 35; y++) for (let x = w - 5; x < w; x++) P.put(x, y, x === w - 5 || x === w - 1 || y === 28 || y === 34 ? 0x2a2440 : y < 31 ? 0xe8d8ff : 0xb07aff);
        // outline
        for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (P.alpha(x, y) > 0.9 && [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => P.alpha(x + dx, y + dy) < 0.5)) P.put(x, y, 0x1a1020);
    }
    // the moonwell: a ring of old mossy stone round dark water full of stars
    _paintWell(P, w, h) {
        const cx = w / 2 - 0.5, cy = h / 2 - 2, rx = w / 2 - 1, ry = h / 2 - 4;
        for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
            const e = ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2;
            if (e > 1 && !(y > cy && y < cy + 6 && Math.abs(x - cx) < rx)) continue;
            let c;
            if (e <= 0.55) { c = MenuArt.mix(0x1a2a6a, 0x060a24, Math.sqrt(e / 0.55)); if ((x * 13 + y * 7) % 23 === 0) c = 0xffffff; else if ((x * 5 + y * 11) % 31 === 0) c = 0xd8e0ff; }
            else if (e <= 1) c = (Math.floor(Math.atan2(y - cy, x - cx) * 5) % 2) ? 0x8a84a0 : 0x6a6480;
            else c = y > cy + 4 ? 0x3a3854 : 0x5e5878;
            if (e > 0.55 && e <= 1 && MenuArt.noise(51)(x * 0.4, y * 0.4) > 0.62) c = 0x3a6230;
            P.put(x, y, c);
        }
        for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (P.alpha(x, y) > 0.9 && [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => P.alpha(x + dx, y + dy) < 0.5)) P.put(x, y, 0x120e20);
    }
    // a stone bench, mossed, in the Grove
    _paintBench(P) {
        for (let y = 18; y < 22; y++) for (let x = 2; x < 30; x++) P.put(x, y, 0x0a1408, 0.35);
        for (const lx of [4, 24]) for (let y = 12; y < 20; y++) for (let x = 0; x < 5; x++) P.put(lx + x, y, x < 2 ? 0x8a84a0 : 0x5e5878);
        for (let y = 8; y < 13; y++) for (let x = 1; x < 31; x++) P.put(x, y, y === 8 ? 0xb8b0c8 : y === 12 ? 0x5e5878 : 0x8a84a0);
        for (const [x, y] of [[6, 8], [7, 8], [18, 8], [19, 9], [26, 8], [12, 12], [27, 15]]) P.put(x, y, 0x3a6230);
        for (let y = 0; y < P.h; y++) for (let x = 0; x < P.w; x++) if (P.alpha(x, y) > 0.9 && [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => P.alpha(x + dx, y + dy) < 0.5)) P.put(x, y, 0x120e20);
    }
    // the Lagoon's dock: planks out over the water on posts, a lantern at its end
    _paintDock(P, w, h) {
        for (let y = 0; y < h - 6; y++) for (let x = 1; x < w - 1; x++) P.put(x, y, (y % 5 === 0) ? 0x4a3020 : (x === 1 || x === w - 2) ? 0x5a3a20 : MenuArt.bayer(x, y) < 0.5 ? 0xa07a50 : 0x8a6a42);
        for (const px of [2, w - 4]) for (let y = 8; y < h; y += 16) for (let j = 0; j < 6; j++) { P.put(px, y + j, 0x5a3a20); P.put(px + 1, y + j, 0x3a2414); }
        for (let x = 1; x < w - 1; x++) P.put(x, h - 6, 0x0a1430, 0.5);
        P.rect(w - 6, h - 34, 2, 22, 0x5a3a20); P.rect(w - 8, h - 38, 6, 5, 0xffd070); P.put(w - 6, h - 36, 0xffffff);
    }
    // a tree: a round canopy shaded from the top left, a trunk, its shadow (two kinds)
    _paintTree(P, kind) {
        const R = MenuArt.rng(kind * 9 + 4), n = MenuArt.noise(kind + 50), cx = 20, cy = 18, col = kind ? [0x2c5a2a, 0x3e7a36, 0x5a9a48, 0x7ab85a] : [0x2a4e3a, 0x3a6a4a, 0x52885e, 0x74a878];
        for (let y = 40; y < 47; y++) for (let x = 6; x < 34; x++) if (((x - 20) / 13) ** 2 + ((y - 43.5) / 3.2) ** 2 <= 1) P.put(x, y, 0x0a1408, 0.4);   // shadow
        for (let y = 28; y < 44; y++) for (let x = 17; x < 24; x++) P.put(x, y, x < 19 ? 0x7a5434 : x > 21 ? 0x3a2414 : 0x5a3a20);   // trunk
        for (const [bx, by, r] of [[cx, cy, 15], [cx - 9, cy + 4, 9], [cx + 10, cy + 3, 9], [cx, cy - 8, 9]]) for (let y = by - r; y <= by + r; y++) for (let x = bx - r; x <= bx + r; x++) {
            const d = Math.hypot(x - bx, (y - by) * 1.1) / r;
            if (d > 1 - n(x * 0.4, y * 0.4) * 0.15) continue;
            const l = (-(x - bx) - (y - by)) / r * 0.5 + 0.5 + (n(x * 0.3, y * 0.3) - 0.5) * 0.5;
            P.put(x, y, col[Math.max(0, Math.min(3, Math.floor(l * 3.6)))]);
        }
        for (let k = 0; k < 8; k++) { const x = 8 + R() * 24, y = 6 + R() * 22; if (P.alpha(Math.floor(x), Math.floor(y))) P.put(x, y, kind ? 0xff9ad8 : 0xffe08a); }   // blossoms / fruit
        for (let y = 0; y < P.h; y++) for (let x = 0; x < P.w; x++) if (P.alpha(x, y) > 0.9 && [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => P.alpha(x + dx, y + dy) < 0.5)) P.put(x, y, 0x10200e);
    }
    // the waystone: a tall carved standing stone, mossed, on a ring of flags
    _paintStone(P) {
        for (let y = 28; y < 34; y++) for (let x = 0; x < 24; x++) if (((x - 11.5) / 12) ** 2 + ((y - 31) / 3) ** 2 <= 1) P.put(x, y, (x + y) % 5 ? 0x6a6480 : 0x4c4668);
        EnchantScene.ruin(P, 6, 4, 12, 26, { seed: 5, bw: 12, bh: 6, broken: 2, moss: 0.6, ivy: 2 });
        for (let y = 0; y < P.h; y++) for (let x = 0; x < P.w; x++) if (P.alpha(x, y) > 0.9 && [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => P.alpha(x + dx, y + dy) < 0.5)) P.put(x, y, 0x120e20);
    }
    // its runes alone (drawn over it, glowing and pulsing)
    _paintRunes(P) {
        const glyph = (cx, cy, pts) => { for (const [dx, dy] of pts) { P.put(cx + dx, cy + dy, 0xe0c0ff); } };
        glyph(12, 9, [[0, 0], [0, 1], [0, 2], [-1, 1], [1, 1]]);
        glyph(12, 15, [[-1, 0], [0, 1], [1, 2], [1, 0], [-1, 2]]);
        glyph(12, 21, [[0, 0], [1, 1], [0, 2], [-1, 1]]);
        for (let y = 7; y < 25; y += 2) { P.put(8, y, 0x9a6aff); P.put(15, y, 0x9a6aff); }
    }
}

// ── THE UNDERWELL ─────────────────────────────────────────────────────────────
// Under the Isle, through the moonwell: a cavern over a lake of thick cosmic fluid. You fish it like
// the river (its fish skewed hard: the common ones always, the rare ones almost never), and it gives
// up the Cosmic and Corrupted seeds. Everything else (walking, the reel, the log, the hotbar) is the
// garden's own; the shaft of moonlight you came down takes you back up.
class UnderwellScene extends GardenScene {
    constructor(key = 'Underwell') { super(key); }
    static EXIT = [5, 4];   // where the moonlight comes down (design tiles)
    // what makes this place itself (SkyScene has its own)
    _cfg() {
        return { music: 'underwell', area: 'THE UNDERWELL', where: 'cosmic', ground: 'uw_ground', fade: [20, 6, 40], seen: 'deep',
                 water: [0x12042a, 0x1e0a44, 0x2e1266, 0x44208a, 0x5e30b0, 0x8a5ae0], foam: [0xffd8ff, 0xc89aff, 0x9a6ae0], wave: 0xd8a8ff,
                 fishLabel: 'fish the cosmic fluid', exitLabel: 'climb back up to the Grove', back: { fromWell: true }, hint: 'Esc or the moonlight to climb back up',
                 banner: ['THE UNDERWELL', 'Beneath the Isle runs a deep sea of cosmic fluid. Things live in it.', '#e8d0ff', '#2a0a4a', '#c8b8e8', 0xb07aff, [200, 160, 255]] };
    }
    create() {
        const W = this.scale.width, H = this.scale.height, C = this._cfg();
        MenuArt.basics(this);
        Music.play(this, C.music);
        this._panelObjs = null; this._busy = false; this._ticks = []; this._fish = null; this._leaving = false; this._rest = null; this._hudObjs = null; this._bookCam = null; this._build = null; this._reg = {};
        this._area = C.area;
        this._waterPal = C.water; this._foam = C.foam; this._waveCol = C.wave; this._bridges = []; this._lotus = C.lotus;
        this.glorps = parseInt(localStorage.getItem('glorps') || '0', 10) || 0;
        const T = this.T = Math.max(32, Math.floor(Math.min(W / 27, H / 16)));
        const rows = this.rows = Math.ceil(H / T) + 1, cols = this.cols = 40;
        this.gx0 = 0; this.gy0 = Math.floor((rows - 15) / 2) + 1;
        this.ox = 0; this.oy = Math.round((H - rows * T) / 2);
        const k = T / 16, cam = this.cameras.main;
        this._waterMap();
        this.add.image(this.ox, this.oy, MenuArt.tex(this, `${C.ground}_${cols}x${rows}`, cols * 16, rows * 16, P => this._paintGround(P))).setOrigin(0).setScale(k).setDepth(0);
        cam.setBounds(0, Math.min(0, this.oy), cols * T, Math.max(H, rows * T));
        this._waterSetup();
        this._ethereal();
        const [ex, ey] = this.constructor.EXIT, sx = this._px(ex) + T / 2, sy = this._py(ey + 1);
        this._exitArt(sx, sy);
        this._crops = [];
        if (!this.anims.exists('idle')) this.anims.create({ key: 'idle', frames: [{ key: 'slime_blue', frame: 0 }, { key: 'slime_blue', frame: 18 }], frameRate: 2, repeat: -1 });
        this.fx = sx; this.fy = sy + T * 0.6; this.face = { x: 1, y: 0 };
        this._enter(C, cam);
    }
    // the shaft of moonlight down from the well, and the dark at the edges
    _exitArt(sx, sy) {
        const W = this.scale.width, H = this.scale.height, T = this.T;
        const beam = this.add.image(sx, sy, MenuArt.tex(this, 'uw_beam', 16, 64, P => { for (let y = 0; y < 64; y++) for (let x = 0; x < 16; x++) { const e = Math.abs(x - 7.5) / 8; P.put(x, y, 0xd8e0ff, Math.max(0, (1 - e * e) * 0.5 * (0.4 + y / 106))); } }, { linear: true }))
            .setOrigin(0.5, 1).setDisplaySize(T * 1.8, sy + T).setBlendMode(Phaser.BlendModes.ADD).setDepth(4700);
        this.tweens.add({ targets: beam, alpha: 0.6, duration: 1800, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
        this.add.particles(0, 0, 'mn_px2', { x: { min: sx - T * 0.6, max: sx + T * 0.6 }, y: { min: 0, max: sy }, lifespan: 2400, speedY: { min: 6, max: 20 }, scale: { start: 1.4, end: 0 }, tint: [0xffffff, 0xd8e0ff], blendMode: 'ADD', frequency: 140 }).setDepth(4701);
        this.add.ellipse(sx, sy - T * 0.1, T * 1.6, T * 0.45, 0xd8e0ff, 0.18).setDepth(1).setBlendMode(Phaser.BlendModes.ADD);
        this.add.image(W / 2, H / 2, MenuArt.tex(this, 'uw_vig', 64, 36, P => { for (let y = 0; y < 36; y++) for (let x = 0; x < 64; x++) { const d = Math.hypot((x - 31.5) / 32, (y - 17.5) / 18); if (d > 0.55) P.put(x, y, 0x06020e, Math.min(0.75, (d - 0.55) * 1.6)); } }, { linear: true })).setDisplaySize(W, H).setDepth(4900).setScrollFactor(0);
    }
    _enter(C, cam) {
        const T = this.T, k = T / 16;
        this.shadow = this.add.ellipse(this.fx, this.fy, T * 0.75, T * 0.2, 0x000000, 0.4).setDepth(1);
        this.player = this.add.sprite(this.fx, this.fy, 'slime_blue', 0).setScale(k).play('idle');
        if (typeof CreatureFX !== 'undefined') { const u = CreatureFX.face(this, this.player, { mood: 'friend', look: 'pointer' }); const hat = Garden.state().hat; if (u && hat) CreatureFX.dress(u, hat); }
        this.rodSpr = this.add.image(0, 0, this._rodTex(Garden.rod())).setOrigin(0.15, 0.85).setScale(k);
        this.heldSpr = this.add.sprite(0, 0, '__DEFAULT').setOrigin(0.5, 0.85).setVisible(false);   // whatever else the hotbar has you holding
        this.prompt = this.add.text(0, 0, '', { fontSize: '13px', fontFamily: 'monospace', fontStyle: 'bold', color: '#ffffff', backgroundColor: '#0a0618cc', padding: { x: 6, y: 3 } }).setOrigin(0.5, 1).setDepth(6000);
        cam.startFollow(this.player, true, 0.1, 0.1, 0, T * 0.3);
        this._hud();
        this.keys = this.input.keyboard.addKeys('W,A,S,D,UP,DOWN,LEFT,RIGHT,E,SPACE,ESC,L,I,TAB,ONE,TWO');
        for (const k of ['I', 'TAB']) this.keys[k].on('down', () => this._pack ? this._closePanel() : this._backpack());
        this.keys.ONE.on('down', () => this._useHand(0)); this.keys.TWO.on('down', () => this._useHand(1));
        this.keys.E.on('down', () => this._interact()); this.keys.SPACE.on('down', () => this._interact());
        this.keys.L.on('down', () => { if (!this._fish && !this._rest) this._panelObjs ? this._closePanel() : this._logPanel(); });
        this.keys.ESC.on('down', () => { if (this._fish) this._endFish('reeled in'); else if (this._panelObjs) this._closePanel(); else this._leave(); });
        this.time.addEvent({ delay: 1000, loop: true, callback: () => this._hud() });
        // dropping in: down the shaft, a bounce, a splash of light
        const drop = { h: T * 6 }; this._hop = drop.h; this._leaving = true;
        this.tweens.add({ targets: drop, h: 0, duration: 700, ease: 'Bounce.easeOut', onUpdate: () => { this._hop = drop.h; }, onComplete: () => { this._hop = 0; this._leaving = false; } });
        this.time.delayedCall(260, () => Sfx.play(this, 'e_land'));
        this._place();
        cam.fadeIn(700, ...C.fade);
        const s = Garden.state();
        if (!s[C.seen]) { s[C.seen] = true; Garden._set(s); this.time.delayedCall(900, () => this._discovered()); }
    }
    // the first time down: a discovery banner
    _discovered() {
        const W = this.scale.width, D = 7500, objs = [], [title, sub, tc, ts, sc, edge, fl] = this._cfg().banner;
        const g = this.add.graphics().setScrollFactor(0).setDepth(D); objs.push(g);
        const bw = Math.min(620, W - 40), bx = W / 2 - bw / 2, by = 90;
        g.fillStyle(0x0a0618, 0.94); g.fillRoundedRect(bx, by, bw, 118, 10); g.lineStyle(3, 0xffd070, 1); g.strokeRoundedRect(bx, by, bw, 118, 10); g.lineStyle(1, edge, 0.8); g.strokeRoundedRect(bx + 6, by + 6, bw - 12, 106, 7);
        const t = (y, s2, o) => { const x = this.add.text(W / 2, by + y, s2, Object.assign({ fontFamily: UIKit.FONT.title, fontStyle: 'bold', color: '#ffd070' }, o)).setOrigin(0.5).setScrollFactor(0).setDepth(D + 1); objs.push(x); return x; };
        t(24, '✦  NEW LOCATION DISCOVERED  ✦', { fontSize: '14px', fontFamily: 'monospace', color: '#ffd070' });
        t(58, title, { fontSize: '32px', color: tc, stroke: ts, strokeThickness: 6 });
        t(94, sub, { fontSize: '12px', fontFamily: 'monospace', fontStyle: 'normal', color: sc });
        objs.forEach(o => { o.setAlpha(0); o.y -= 30; });
        this.tweens.add({ targets: objs, alpha: 1, y: '+=30', duration: 500, ease: 'Back.easeOut' });
        this.cameras.main.flash(400, ...fl); Sfx.play(this, 'e_quality'); Sfx.play(this, 'e_land', { r: 4 });
        const sp = this.add.particles(0, 0, 'mn_px2', { x: { min: bx, max: bx + bw }, y: by + 118, lifespan: 1400, speedY: { min: -60, max: -20 }, scale: { start: 2, end: 0 }, tint: [0xffd070, 0xd8a8ff, 0xffffff], blendMode: 'ADD', emitting: false }).setScrollFactor(0).setDepth(D + 2);
        sp.explode(60); objs.push(sp);
        this.time.delayedCall(4200, () => this.tweens.add({ targets: objs, alpha: 0, duration: 700, onComplete: () => objs.forEach(o => o.destroy()) }));
    }
    // two pools of cosmic fluid: the great lake, and a small one off to the east
    _waterMap() {
        const n = MenuArt.noise(431), W2 = this.cols * 16, my = (this.gy0 + 9.5) * 16;
        this._bank = [];
        for (let x = 0; x < W2; x++) {
            const lx = x / 16, pools = [[8, 30, 4.2], [32.5, 38, 2]].map(([a, b, ry]) => { if (lx <= a || lx >= b) return null; const u = (lx - (a + b) / 2) / ((b - a) / 2), e = Math.sqrt(1 - u * u); return [Math.round(my - e * ry * 16 - n(x * 0.1, 3) * 6 * e), Math.round(my + e * ry * 9 + n(x * 0.1, 5) * 4 * e)]; }).find(Boolean);
            this._bank.push(pools || [Math.round(my), Math.round(my) - 1]);
        }
        this._wet = new Set();
        for (let tx = 0; tx < this.cols; tx++) for (let ty = 0; ty < this.rows; ty++) { const [a, b] = this._bank[tx * 16 + 8], cy = ty * 16 + 8; if (cy >= a && cy <= b) this._wet.add(tx + ',' + ty); }
    }
    _river(lx, ly) { return this._wet.has((lx + this.gx0) + ',' + (ly + this.gy0)); }
    _open(x, y) { const ly = y - this.gy0; return x >= 1 && x < this.cols - 1 && ly >= 2 && y < this.rows - 1 && !this._wet.has(x + ',' + y); }
    _near() {
        const [tx, ty] = this._tile(this.fx, this.fy), lx = tx - this.gx0, ly = ty - this.gy0, [ex, ey] = this.constructor.EXIT, C = this._cfg();
        if (Math.abs(lx - ex) <= 1 && Math.abs(ly - ey) <= 1) return { kind: 'exit', label: 'E  ' + C.exitLabel };
        const near = [[Math.sign(this.face.x), Math.sign(this.face.y)], [1, 0], [-1, 0], [0, 1], [0, -1]].find(([dx, dy]) => (dx || dy) && this._river(lx + dx, ly + dy));
        return near ? { kind: 'fish', where: C.where, label: `E  ${C.fishLabel}  ·  ${Garden.rod().name}` } : null;
    }
    _areaCheck() {}
    _drawCrops() {}
    _toggleBuild() {}
    _hud() { GardenScene.prototype._hud.call(this); }
    _leave() {
        if (this._leaving) return;
        this._leaving = true; this._endFish(null);
        Sfx.play(this, 'whoosh');
        const up = { h: 0 }; this.tweens.add({ targets: up, h: this.T * 6, duration: 600, ease: 'Quad.easeIn', onUpdate: () => { this._hop = up.h; } });
        this.cameras.main.fadeOut(600, ...this._cfg().fade);
        this.time.delayedCall(620, () => this.scene.start('Garden', this._cfg().back));
    }
    _ethereal() {
        const T = this.T, k = T / 16;
        for (const [tx, ty, s2, col] of [[2, 3, 1.6, 0xb07aff], [14, 3.4, 1.2, 0xff8ad8], [24, 3, 1.8, 0xb07aff], [36, 3.6, 1.3, 0x8affd8], [3, 13, 1.3, 0xff8ad8], [20, 14, 1, 0xb07aff], [31, 13, 1.5, 0x8affd8], [38, 12, 1.1, 0xb07aff], [11, 13.6, 1, 0x7aff5a]]) {
            if (!this._open(Math.floor(tx), Math.floor(ty) + this.gy0)) continue;
            const x = this._px(tx), y = this._py(ty) + T;
            const gl = this.add.image(x, y - T * 0.5 * s2, 'mn_glow').setTint(col).setBlendMode(Phaser.BlendModes.ADD).setDisplaySize(T * 2.6 * s2, T * 2.6 * s2).setAlpha(0.5).setDepth(y - 1);
            this.tweens.add({ targets: gl, alpha: 0.2, duration: 1300 + tx * 40, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
            this.add.image(x, y, this._crystalTex(col, Math.round(20 * s2))).setOrigin(0.5, 1).setScale(k).setDepth(y);
        }
        this.add.particles(0, 0, 'mn_px2', { x: { min: 0, max: this.cols * T }, y: { min: this._py(2), max: this._py(14) }, lifespan: 4200, speedX: { min: -8, max: 8 }, speedY: { min: -14, max: -2 },
            scale: { start: 1.6, end: 0 }, alpha: { start: 0.9, end: 0 }, tint: [0xd8a8ff, 0xff8ad8, 0x8affd8, 0xffffff], blendMode: 'ADD', frequency: 60 }).setDepth(5000);
    }
    // the cavern floor: dark stone with veins of glowing fluid, a jagged ceiling of rock with stalactites, the pools' banks
    _paintGround(P) {
        const n = MenuArt.noise(401), R = MenuArt.rng(9), F = [0x120e22, 0x18142c, 0x1e1a38, 0x262044, 0x2e2852], wall = (this.gy0 + 2) * 16;
        for (let y = 0; y < P.h; y++) for (let x = 0; x < P.w; x++) {
            const v = MenuArt.fbm(n, x * 0.04, y * 0.04, 3) + (MenuArt.bayer(x, y) - 0.5) * 0.1;
            P.put(x, y, F[Math.max(0, Math.min(4, Math.floor(v * 5)))]);
        }
        for (let k = 0; k < P.w * P.h / 900; k++) {   // cracks, some with fluid glowing in them
            let x = R() * P.w, y = R() * P.h, a = R() * 6.28; const glow = R() < 0.4;
            for (let j = 0; j < 14 + R() * 30; j++) { a += (R() - 0.5) * 0.9; x += Math.cos(a); y += Math.sin(a) * 0.6; P.put(x, y, glow ? 0x6a3ab0 : 0x0a0614); if (glow && R() < 0.3) P.put(x, y - 1, 0xc89aff); }
        }
        for (let x = 0; x < P.w; x++) {   // the ceiling: a rock face, and stalactites hanging off it
            const edge = wall + Math.round(MenuArt.fbm(n, x * 0.08, 50, 2) * 8 - 4);
            for (let y = 0; y < edge; y++) P.put(x, y, y > edge - 3 ? 0x3a3254 : (x + (y >> 2)) % 9 === 0 ? 0x16122a : MenuArt.mix(0x0c0818, 0x241e3c, y / edge));
            if (R() < 0.12) { const h = 4 + Math.floor(R() * 12); for (let j = 0; j < h; j++) { const w = Math.max(0, Math.round(2 * (1 - j / h))); for (let i = -w; i <= w; i++) P.put(x + i, edge + j, i < 0 ? 0x3a3254 : 0x241e3c); } if (R() < 0.4) P.put(x, edge + h, 0xc89aff); }
        }
        for (let x = 0; x < P.w; x++) {   // the pools' banks: a dark lip, a glowing crust where the fluid has dried
            const [t0, t1] = this._bank[x]; if (t1 < t0) continue;
            for (let y = t0 - 4; y < t0; y++) P.put(x, y, y === t0 - 1 ? 0x06020e : y === t0 - 4 ? 0x5a3a9a : 0x2a1e48);
            for (let y = t0; y <= t1; y++) P.put(x, y, 0x12042a);
            for (let y = t1 + 1; y < t1 + 4; y++) P.put(x, y, y === t1 + 1 ? 0x8a5ae0 : 0x3a2a64);
            if (R() < 0.08) { const sy = R() < 0.5 ? t0 - 3 : t1 + 2; P.put(x, sy, 0xff8ad8); P.put(x, sy - 1, 0xffd8ff); }
        }
    }
}

// Up the trampoline: a bank of cloud to stand on over a sea of cloud tops. You fish the clouds like the river
// (bright quick fish; the Cloud Cotton and Sky Bloom seeds). The trampoline you came up on takes you back down.
class SkyScene extends UnderwellScene {
    constructor() { super('Sky'); }
    static EXIT = [6, 5];   // the trampoline back down (design tiles)
    _cfg() {
        return { music: 'isle', area: 'THE CLOUD SEA', where: 'sky', ground: 'sky_ground', fade: [235, 245, 255], seen: 'sky',
                 water: [0x9ab8e0, 0xaec8ea, 0xc2d6f2, 0xd4e2f8, 0xe4eefc, 0xf6faff], foam: [0xffffff, 0xf0f6ff, 0xd8e6fa], wave: 0xffffff,
                 fishLabel: 'fish the clouds', exitLabel: 'bounce back down to the garden', back: { fromSky: true }, hint: 'Esc or the trampoline to bounce back down', lotus: 0,
                 banner: ['THE CLOUD SEA', 'Above the Isle the clouds pile up into a sea. Things swim in it.', '#ffffff', '#3a6aa8', '#d8e8ff', 0x8ac8ff, [255, 255, 255]] };
    }
    // the trampoline you came up on
    _exitArt(sx, sy) {
        this._tramp = this.add.image(sx, sy, this._trampTex()).setOrigin(0.5, 1).setScale(this.T / 16).setDepth(sy);
    }
    // the cloud bank's edge, wavy, and the sea of cloud below it to the bottom of the world
    _waterMap() {
        const n = MenuArt.noise(517), W2 = this.cols * 16, edge = (this.gy0 + 8.5) * 16, bottom = this.rows * 16;
        this._bank = [];
        for (let x = 0; x < W2; x++) this._bank.push([Math.round(edge + Math.sin(x * 0.03) * 10 + n(x * 0.05, 4) * 14 - 7), bottom]);
        this._wet = new Set();
        for (let tx = 0; tx < this.cols; tx++) for (let ty = 0; ty < this.rows; ty++) { const [a, b] = this._bank[tx * 16 + 8], cy = ty * 16 + 8; if (cy >= a && cy <= b) this._wet.add(tx + ',' + ty); }
    }
    _leave() {
        if (this._leaving) return;
        this._leaving = true; this._endFish(null);
        const T = this.T, [ex, ey] = SkyScene.EXIT, at = { h: 0 };
        this.fx = this._px(ex) + T / 2; this.fy = this._py(ey + 1) - T * 0.35; this._hopZ = this._tramp.depth + 1;   // on it, drawn over it
        Sfx.play(this, 'e_land', { r: 2 });
        this.tweens.add({ targets: this._tramp, scaleY: this._tramp.scaleX * 0.75, duration: 80, yoyo: true });
        this.tweens.add({ targets: at, h: T * 2.4, duration: 300, ease: 'Quad.easeOut', yoyo: true, onUpdate: () => { this._hop = at.h; }, onComplete: () => {
            Sfx.play(this, 'whoosh');
            this.tweens.add({ targets: [this.player, this.player._cfx?.eyes, this.player._cfx?.hat].filter(Boolean), alpha: 0, duration: 400 });
            this.cameras.main.fadeOut(600, 235, 245, 255);
            this.time.delayedCall(620, () => this.scene.start('Garden', { fromSky: true }));
        } });
    }
    // puffs of cloud drifting over the sea, the odd bird, glints of sun
    _ethereal() {
        const T = this.T, W = this.cols * T, puff = MenuArt.tex(this, 'sky_puff', 48, 24, P => {
            for (const [x, y, r] of [[14, 15, 8], [24, 11, 10], [34, 15, 8], [20, 17, 7], [30, 18, 6]]) P.disc(x, y, r, 0xf6faff);
            for (let x = 6; x < 42; x++) for (let y = 16; y < 24; y++) if (P.alpha(x, y) > 0) P.put(x, y, 0xd8e6fa);
        });
        for (let i = 0; i < 12; i++) {
            const y = this._py(9 + (i % 4) * 1.6) + (i * 37 % 20), x = (i * 0.37 % 1) * W, sc = T / 16 * (1.2 + (i % 3) * 0.5);
            const c = this.add.image(x, y, puff).setScale(sc).setAlpha(0.9).setDepth(y + T * 3);
            this.tweens.add({ targets: c, x: x + W * 0.25, duration: 60000 + i * 7000, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
            this.tweens.add({ targets: c, y: y - T * 0.15, duration: 2400 + i * 200, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
        }
        // birds: little pixel gulls flapping across the sky (they were the letter v in monospace)
        // ('g' is the unoutlined colour: a distant bird is a soft dark silhouette, a gull's M, wings up then down)
        const gull = ShopScene.icon(this, 'gd_gull_2', 12, { g: '#4a5a7a' }, (m, f) => {
            const L = f ? [[0, 7], [1, 7], [2, 6], [3, 6], [4, 5]] : [[0, 4], [1, 3], [2, 3], [3, 4], [4, 5]];
            for (const [x, y] of L) { m.set(x, y, 'g'); m.set(11 - x, y, 'g'); }
            m.rect(5, 5, 2, 2, 'g');
        }, 2);
        for (let i = 0; i < 3; i++) {
            const b = this.add.sprite(-40, this._py(1 + i * 0.6), gull).setScale(T / 16 * (1 - i * 0.15)).setDepth(4900);
            b.play({ key: gull, frameRate: 4 + i });
            this.tweens.add({ targets: b, x: W + 40, duration: 40000 + i * 9000, delay: i * 6000, repeat: -1 });
            this.tweens.add({ targets: b, y: b.y - T * 0.3, duration: 1800 + i * 300, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
        }
        this.add.particles(0, 0, 'mn_px2', { x: { min: 0, max: W }, y: { min: this._py(2), max: this._py(14) }, lifespan: 3000, speedX: { min: 4, max: 14 }, speedY: { min: -4, max: 4 },
            scale: { start: 1.4, end: 0 }, alpha: { start: 0.9, end: 0 }, tint: [0xffffff, 0xfff0a0, 0xd8f0ff], blendMode: 'ADD', frequency: 120 }).setDepth(5000);
    }
    // the sky above, the cloud bank (soft, white, shaded blue), its edge, and the cloud sea's base colour
    _paintGround(P) {
        const n = MenuArt.noise(503), R = MenuArt.rng(21), wall = (this.gy0 + 2) * 16;
        for (let y = 0; y < P.h; y++) for (let x = 0; x < P.w; x++) {
            const [t0] = this._bank[x];
            if (y < wall) { P.put(x, y, MenuArt.mix(0x5a9ae0, 0xb8dcff, y / wall)); continue; }   // the sky
            if (y >= t0) { P.put(x, y, 0xc2d6f2); continue; }                                       // the sea's floor colour (the live layer draws it)
            const v = MenuArt.fbm(n, x * 0.035, y * 0.05, 3) + (MenuArt.bayer(x, y) - 0.5) * 0.08;
            P.put(x, y, v > 0.62 ? 0xffffff : v > 0.45 ? 0xf2f6fe : v > 0.3 ? 0xe2ecfa : 0xd0def4);
        }
        for (let x = 0; x < P.w; x++) {   // the bank's top: billows against the sky; its edge over the sea: a lip and a blue shadow
            const top = wall + Math.round(Math.abs(Math.sin(x * 0.09)) * -6 + n(x * 0.1, 8) * 3);
            for (let y = top; y < wall + 2; y++) P.put(x, y, y === top ? 0xd8e6fa : 0xffffff);
            const [t0] = this._bank[x];
            for (let y = t0 - 3; y < t0; y++) P.put(x, y, y === t0 - 1 ? 0xa8c0e4 : 0xffffff);
            for (let y = t0; y < t0 + 3; y++) P.put(x, y, 0x8aa8d4, 0.5);
            if (R() < 0.05) { const y = wall + 8 + R() * (t0 - wall - 16); P.put(x, y, 0xfff0a0); P.put(x, y - 1, 0xffffff); }   // a glint of sun in the cloud
        }
        const sx = P.w * 0.7, sy = wall * 0.45;   // the sun
        for (let y = 0; y < wall; y++) for (let x = Math.max(0, sx - 30); x < Math.min(P.w, sx + 30); x++) { const d = Math.hypot(x - sx, y - sy); if (d < 9) P.put(x, y, d < 7 ? 0xfff8d0 : 0xffe890); else if (d < 26) P.put(x, y, 0xfff6c0, 0.35 * (1 - d / 26)); }
    }
}
