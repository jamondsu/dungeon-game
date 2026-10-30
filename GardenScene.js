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
        reg('STALL', null, this.add.image(this._px(sx), this._py(sy + sh), 'gd3_kiosk').setOrigin(0, 1).setScale(k).setDepth(this._py(sy + sh)));
        reg('STALL', null, this.add.text(this._px(sx) + 40 * k, this._py(sy) + 18.5 * k, 'SEEDS', { fontSize: `${Math.round(T * 0.22)}px`, fontFamily: UIKit.FONT.title, fontStyle: 'bold', color: '#3a2414' }).setOrigin(0.5).setDepth(this._py(sy + sh) + 1));
        for (const [lx2, ly2, col] of [[77.5, 21.5, 0xd8a8ff], [40, 22, 0x9aff8a], [7, 49, 0x9aff8a]]) {   // the lantern, the jars on the shelf, the crate of bulbs   // the kiosk's crystal caps and its crystal ball, glowing
            const g = reg('STALL', null, this.add.image(this._px(sx) + lx2 * k, this._py(sy) + ly2 * k, 'mn_glow').setTint(col).setBlendMode(Phaser.BlendModes.ADD).setDisplaySize(T * 1.6, T * 1.6).setAlpha(0.5).setDepth(this._py(sy + sh) + 2));
            this.tweens.add({ targets: g, alpha: 0.22, duration: 1100 + lx2 * 10, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
        }
        GardenScene.TREES.forEach(([tx, ty], i) => reg('TREES', i, this.add.image(this._px(tx) + T / 2, this._py(ty + 1), 'gd2_tree_' + ((tx + ty) & 1)).setOrigin(0.5, 1).setScale(k).setDepth(this._py(ty + 1))));
        GardenScene.CRYSTAL_TREES.forEach(([tx, ty], i) => {
            const x = this._px(tx) + T / 2, y = this._py(ty + 1), col = [0xd8a8ff, 0x8affd8, 0x9ad8ff][i % 3];
            reg('CRYSTAL_TREES', i, this.add.image(x, y, 'gd3_ctree_' + (i % 3)).setOrigin(0.5, 1).setScale(k).setDepth(y));
            const g = reg('CRYSTAL_TREES', i, this.add.image(x, y - T * 1.6, 'mn_glow').setTint(col).setBlendMode(Phaser.BlendModes.ADD).setDisplaySize(T * 3, T * 3).setAlpha(0.4).setDepth(y + 1));
            this.tweens.add({ targets: g, alpha: 0.15, duration: 1600 + i * 120, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
            reg('CRYSTAL_TREES', i, this.add.particles(0, 0, 'mn_px2', { x: { min: x - T, max: x + T }, y: { min: y - T * 2.6, max: y - T }, lifespan: 1600, speedY: { min: 4, max: 14 }, scale: { start: 1.6, end: 0 }, tint: [col, 0xffffff], blendMode: 'ADD', frequency: 300 }).setDepth(y + 2));
        });
        // the moonwell, the bench, the dock
        const [wx0, wy0, ww, wh] = GardenScene.WELL;
        reg('WELL', null, this.add.image(this._px(wx0), this._py(wy0 + wh), 'gd3_well').setOrigin(0, 1).setScale(k).setDepth(this._py(wy0 + wh)));
        const wg = reg('WELL', null, this.add.image(this._px(wx0 + ww / 2), this._py(wy0 + 1), 'mn_glow').setTint(0xb8c8ff).setBlendMode(Phaser.BlendModes.ADD).setDisplaySize(T * 4, T * 3).setAlpha(0.5).setDepth(this._py(wy0 + wh) + 1));
        this.tweens.add({ targets: wg, alpha: 0.25, duration: 2200, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
        reg('WELL', null, this.add.particles(0, 0, 'mn_px2', { x: { min: this._px(wx0) + T * 0.6, max: this._px(wx0 + ww) - T * 0.6 }, y: { min: this._py(wy0) + T * 0.6, max: this._py(wy0 + 1) + T * 0.4 }, lifespan: 1400, speedY: { min: -18, max: -6 },
            scale: { start: 1.4, end: 0 }, tint: [0xffffff, 0xd8e0ff], blendMode: 'ADD', frequency: 200 }).setDepth(this._py(wy0 + wh) + 2));
        const [bx0, by0] = GardenScene.BENCH;
        reg('BENCH', null, this.add.image(this._px(bx0), this._py(by0 + 1), 'gd3_bench').setOrigin(0, 1).setScale(k).setDepth(this._py(by0 + 1)));
        const [cx0, cy0] = GardenScene.CHEST;
        reg('CHEST', null, this.add.image(this._px(cx0) + T / 2, this._py(cy0 + 1) - 2 * k, 'gd3_chest').setOrigin(0.5, 1).setScale(k).setDepth(this._py(cy0 + 1)));   // (up a little into its tile's empty top)
        const [dx0, dy0, dw, dh] = GardenScene.DOCK;
        this.add.image(this._px(dx0), this._py(dy0), 'gd3_dock').setOrigin(0).setScale(k).setDepth(3);
        const dl = this.add.image(this._px(dx0 + dw) - 5 * k, this._py(dy0 + dh) - 32 * k, 'mn_glow').setTint(0xffc060).setBlendMode(Phaser.BlendModes.ADD).setDisplaySize(T * 2, T * 2).setAlpha(0.55).setDepth(this._py(dy0 + dh) + 1);
        this.tweens.add({ targets: dl, alpha: 0.35, duration: 900, yoyo: true, repeat: -1 });
        if (!this._lakeOpen()) {   // the Lagoon before its floor: a sign at the dock's foot
            this.add.text(this._px(dx0 + 1), this._py(dy0) - T * 0.2, `the lake stirs at\nTower floor ${Garden.LAKE_FLOOR}`, { fontSize: '12px', fontFamily: 'monospace', fontStyle: 'bold', color: '#d8e8ff', align: 'center', backgroundColor: '#0a0618cc', padding: { x: 6, y: 4 } }).setOrigin(0.5, 1).setDepth(this._py(dy0) + 2);
        }
        // the waystone: old, carved, its runes alive
        const [stx0, sty0] = GardenScene.STONE, stx = this._px(stx0 + 1), sty = this._py(sty0 + 1);
        reg('STONE', null, this.add.image(stx, sty, 'gd2_stone').setOrigin(0.5, 1).setScale(k).setDepth(sty));
        const runes = reg('STONE', null, this.add.image(stx, sty, 'gd2_runes').setOrigin(0.5, 1).setScale(k).setDepth(sty + 1).setBlendMode(Phaser.BlendModes.ADD));
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
        { const [tx, ty] = GardenScene.TRAMPOLINE, y = this._py(ty + 1); this._tramp = this.add.image(this._px(tx + 1), y, 'gd4_tramp').setOrigin(0.5, 1).setScale(k).setDepth(y); }
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
        if (TouchControls.on(this)) TouchControls.garden(this);   // a phone: a stick to walk, E on the screen
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
        const lo = this.T * 0.1;   // (just under its feet: 0.26 stopped it a quarter tile short of anything below it, the chest most of all)
        for (const [px, py] of [[x - hw, y - hh], [x + hw, y - hh], [x - hw, y + lo], [x + hw, y + lo]]) { const [tx, ty] = this._tile(px, py); if (!this._open(tx, ty)) return false; }
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
        const img = this.add.image(x, y, 'gd3_mud').setScale(k).setDepth(this._py(my) + 2).setInteractive({ useHandCursor: true });
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
    // A worm, 32px, poking up out of its hole and swaying, four frames: each kind its own build as well as colour (gd_catch)
    _wormTex(Wm) { return this._typedSheet('gd4_worm_' + Wm.id, 'gd_catch', 'worm_' + Wm.id, 4, 8); }
    _wormGame(k) {
        this._closePanel(true);
        const W = this.scale.width, H = this.scale.height, D = 8000, objs = this._panelObjs = [], keep = o => { objs.push(o); o?.setScrollFactor?.(0); return o; }, s = Garden.state();
        const tier = s.tier, grab = 30 + (tier - 1) * 9, slow = 1 + (tier - 1) * 0.12, LEN = 36000;
        const bw = Math.min(W - 80, 900), bh = Math.min(H - 170, 500), bx = W / 2 - bw / 2, by = H / 2 - bh / 2 + 20;
        keep(this.add.rectangle(0, 0, W, H, 0x05030a, 0.7).setOrigin(0).setDepth(D).setInteractive());
        const board = keep(this.add.container(0, 0).setDepth(D + 1));
        const frame = this.add.graphics(); frame.fillStyle(0x3a2414, 1); frame.fillRect(bx - 16, by - 16, bw + 32, bh + 32); frame.fillStyle(0x7a5434, 1); frame.fillRect(bx - 12, by - 12, bw + 24, bh + 24); frame.fillStyle(0x9a7448, 1); frame.fillRect(bx - 12, by - 12, bw + 24, 6);
        const soil = this.add.image(bx, by, 'gd4_soil').setOrigin(0).setDisplaySize(bw, bh);
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
    // Each kind its own build, in two layers (behind the fish, in front of them), PNGs gd6_tank_<kind>_back/_front:
    //   river   a glass tank on a carved oak cabinet: river pebbles, a driftwood arch, reeds, a little waterwheel
    //   lake    a wrought-iron tank on a stone plinth, green-gone-teal water: silt, crystal shards, an open clam
    //           with its pearl, kelp, lily pads on top
    //   cosmic  not a tank at all: a pool sunk in a ring of cave rock, its violet fluid swirling, crystals growing
    //           out of the rim; its fish swim at the surface
    // Tended (lit): sparkles drift in the water, bubbles rise, the fish swim. Untended: murky, the fish doze.
    _tankArt(kind, layer) { return `gd6_tank_${kind}_${layer}`; }
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
    // Each its own creature, 32px, four frames (gd_catch): a moth of light with its wings opening and folding, a crystal fox
    // swishing its tail, a teacup dragon flapping, an owl of night sky blinking its star eyes
    _petTex(Pt) { return this._typedSheet('gd4_pet_' + Pt.id, 'gd_catch', 'pet_' + Pt.id, 4, 6); }
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
        const seed = this.add.image(x, y, 'gd3_stardrop').setScale(T / 16).setDepth(y + 2).setInteractive({ useHandCursor: true });
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
    _sickleTex() { return 'gd4_sickle'; }

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
    _rodTex(R) { return 'gd3_rod_' + R.id; }
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
    // Every fish its own, typed (gd_catch): eight frames of swimming for one of the usual shape, six for one drawn whole
    // (an eel, a jelly, a ray, a puffer, the angler, the seahorse, a whale calf, the sky creatures)
    _fishTex(F) {
        const t = this._artPx('gd_catch').fr[`fish_${F.id}_7`] ? 8 : 6;
        return this._typedSheet('gd5_fish_' + F.id, 'gd_catch', 'fish_' + F.id, t, t === 8 ? 9 : 6);
    }

    // ── THE CROPS ─────────────────────────────────────────────────────────────
    // Every crop its own, grown in stages: 0 a seed in a little mound (its own seed), 1-3 growing, 4 ripe, glowing and
    // alive; six frames each (gd_crops). A seed with no drawing of its own grows as the Dust Sprout.
    _cropTex(S, st, bare = false) {   // bare: no mound of its own (it stands in a tilled field)
        const b = bare ? 'b' : '', fr = this._artPx('gd_crops').fr;
        return this._typedSheet(`gd4_crop_${S.id}_${st}${b}`, 'gd_crops', `${fr[`${S.id}_${st}${b}_0`] ? S.id : 'sprout'}_${st}${b}`, 6, 6);
    }
    // frames name_0 .. name_<n-1> of a typed atlas, made one texture with frames '0'.. as _sheet makes them, and its loop
    _typedSheet(key, atlas, name, n, fps) {
        if (!this.textures.exists(key)) {
            const A = this._artPx(atlas), f0 = A.fr[name + '_0'], w = f0.cutWidth, h = f0.cutHeight, t = this.textures.createCanvas(key, w * n, h), ctx = t.getContext(), img = ctx.createImageData(w * n, h);
            for (let f = 0; f < n; f++) { const fr = A.fr[name + '_' + f]; for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) { const o = ((fr.cutY + j) * A.W + fr.cutX + i) * 4, p = (j * w * n + f * w + i) * 4; for (let c = 0; c < 4; c++) img.data[p + c] = A.d[o + c]; } }
            ctx.putImageData(img, 0, 0); t.refresh();
            for (let f = 0; f < n; f++) t.add(String(f), 0, f * w, 0, w, h);
        }
        if (!this.anims.exists(key)) this.anims.create({ key, frames: Array.from({ length: n }, (_, f) => ({ key, frame: String(f) })), frameRate: fps, repeat: -1 });
        return key;
    }
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
    // the ripe bubble's sickle: a fat steel crescent with a dark edge and a shine, a wooden grip with a gold band
    _sickleIcon() { return 'gd4_sickleicon'; }
    // a tree's fruit for its ripe bubble: a round fruit in its colour, shaded, a leaf and a shine
    _fruitIcon(Tr) { return MenuArt.tex(this, 'gd4_fruiticon_' + Tr.id, 16, 16, P => this._lay(P, 'gd_crops', 'fruit_' + (this._artPx('gd_crops').fr['fruit_' + Tr.id] ? Tr.id : 'moonpeach'), 0, 0)); }
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
        const plot = 'gd6_plot';   // dark starlit soil in a ring of pale stones
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
    // a tree's stage (0 sapling, 1 young, 2 grown, 3 bearing fruit): six frames from the typed sheet (gd_trees)
    _treeTex(Tr, st) { return this._typedSheet(`gd6_tree_${Tr.id}_${st}`, 'gd_trees', `${Tr.id}_${st}`, 6, 5); }
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
                const key = kind === 'book' || kind === 'ench' ? ShopScene.bookIcon(this, kind === 'book' ? -1 : 3) : 'gd3_drift_' + kind;
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
            const r = size / 2, fk = (size > 60 ? 'bar_l' : 'bar_s') + (on ? '_on' : ''), sc = size / this.textures.getFrame('gd_ui', fk).width;   // (typed, gd_ui)
            keep(this.add.image(x + 3, by + 5, 'gd_ui', fk).setScale(sc).setTintFill(0x000000).setAlpha(0.45).setDepth(D)); keep(this.add.image(x, by, 'gd_ui', fk).setScale(sc).setDepth(D));
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
    _seedTex(S) { return MenuArt.tex(this, 'gd4_seed_' + S.id, 7, 5, P => this._lay(P, 'gd_crops', 'seed_' + (this._artPx('gd_crops').fr['seed_' + S.id] ? S.id : 'sprout'), 0, 0)); }
    // A Hay Day style wicker basket, 96 x 76: an over-under weave shaded round its belly, a twisted rim, a braided handle, a
    // red gingham cloth draped over the near rim. front: only what sits in front of the seeds (the near rim, the cloth, the belly)
    _basketTex(front = false) { return 'gd5_basket' + (front ? 'F' : 'B'); }

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
            items.push({ name: `Violet Lantern  ·  you have ${mine('lamp')}`, icon: 'gd2_lantern', desc: 'A lantern with a violet flame. Set it down in build mode (B).', price: `✧ ${Garden.DECOR.lamp.cost}`, ok: Enchants.dust() >= Garden.DECOR.lamp.cost, buy: () => Garden.buyDecor('lamp') });
            items.push({ name: `Potted Star Tree  ·  you have ${mine('pot')}`, icon: 'gd6_potico', desc: 'A little orchard tree in a clay pot, a different kind each one. Just for looks: it never fruits. Set it down in build mode (B).', price: `✧ ${Garden.DECOR.pot.cost}`, ok: Enchants.dust() >= Garden.DECOR.pot.cost, buy: () => Garden.buyDecor('pot') });
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
    _rakeTex() { return 'gd4_rake'; }

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
        const spx = (lx + pw + rx) / 2, sH = Math.round((bh - 8) / 2);   // the spine, its headbands, the pages' curling corners (typed, gd_ui, drawn 2x)
        keep(this.add.image(spx - 6, by + 4, MenuArt.tex(this, `diary_spine_${sH}`, 6, sH, P => { for (let y = 0; y < sH; y += 5) this._lay(P, 'gd_ui', 'spine', 0, y, 0, null, Math.min(5, sH - y)); })).setOrigin(0).setScale(2).setDepth(D + 1.4));
        for (const hy of [py - 6, py + ph + 1]) keep(this.add.image(spx - 7, hy, 'gd_ui', 'hband').setOrigin(0).setScale(2).setDepth(D + 1.4));
        for (const [cx2, d] of [[lx, 1], [rx + pw, -1]]) keep(this.add.image(cx2, py + ph, 'gd_ui', 'curl').setOrigin(d > 0 ? 0 : 1, 1).setFlipX(d < 0).setScale(2).setDepth(D + 1.4));
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
        const ci = CH.findIndex(c => c[0] === ch), RW = 54, RG = 10;   // (each ribbon typed in its colour, gd_ui rib_<chapter>[_on], drawn 2x)
        const rx0 = rx + pw - 24 - CH.length * (RW + RG) + RG;
        CH.forEach(([id, name], i) => {
            const on = i === ci, x0 = rx0 + i * (RW + RG), top = by - (on ? 62 : 50), fk = `rib_${id}${on ? '_on' : ''}`;
            keep(this.add.image(x0 + 3, top + 4, 'gd_ui', fk).setOrigin(0).setScale(2).setTintFill(0x000000).setAlpha(0.35).setDepth(D + 1.44))._ribbon = true;   // its shadow
            keep(this.add.image(x0, top, 'gd_ui', fk).setOrigin(0).setScale(2).setDepth(D + 1.45))._ribbon = true;
            const sample = id === 'plants' ? this._cropTex(Garden.SEEDS[0], 4) : id === 'orchard' ? this._treeTex(Garden.TREES[1], 3) : id === 'fish' ? this._fishTex(Garden.FISH[0]) : id === 'worms' ? this._wormTex(Garden.WORMS[0]) : id === 'pets' ? this._petTex(Garden.PETS[0]) : null;
            if (sample) { const ic = keep(this.add.sprite(x0 + RW / 2, top + 24, sample, '0').setDepth(D + 1.46)); ic.setScale(24 / Math.max(ic.width, ic.height)); ic._ribbon = true; if (on) ic.play(sample); else ic.setAlpha(0.8); }
            else keep(this.add.image(x0 + RW / 2, top + 26, 'gd_ui', 'rib_hat').setScale(2).setDepth(D + 1.46))._ribbon = true;   // a top hat
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
    // A leaf turning, painted at half size in the diary's own paper (or leather, for the cover: their typed tiles, gd_ui), as
    // FLIP_N frames: flat on the right, lifting with its free edge leading so the paper bends, upright over the spine,
    // falling, flat on the left. Each column is shaded by how it faces you, its top and bottom edges darker, its free
    // edge darker still, and its shadow is painted onto the page under it. Frames are cached per size and kind.
    _flipFrames(kind, w, h) {
        const N = 9, W2 = Math.max(8, Math.round(w / 2)), H2 = Math.max(8, Math.round(h / 2)), LIFT = Math.round(H2 * 0.05) + 2, M = MenuArt.mix;
        const PAL = kind === 'cover' ? { back: 0x3e241a, edge: 0x1e0c06, trim: 0xc8a050 } : { back: 0xcfb98c, edge: 0xb89a68, trim: 0x8a6a40 };
        const T = this._artPx('gd_ui'), tf = T.fr[kind === 'cover' ? 'cv_fill0' : 'pg_fill0'], tile = (x, y) => { const o = ((tf.cutY + (y & 31)) * T.W + tf.cutX + (x & 31)) * 4; return (T.d[o] << 16) | (T.d[o + 1] << 8) | T.d[o + 2]; };
        const ext = (this._flipExt ||= {});
        return Array.from({ length: N }, (_, f) => MenuArt.tex(this, `diary_flip_${kind}_${W2}x${H2}_${f}`, W2 * 2, H2 + LIFT * 2, P => {
            const th = Math.PI * f / (N - 1), bend = 0.9 * Math.sin(th), S = 48;
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
                const up = C.c >= 0, lit = 0.35 + 0.65 * Math.abs(C.c), top = Math.round(LIFT - C.lift), bot = Math.round(LIFT + H2 - 1 + C.lift * 0.4);
                for (let px = Math.floor(C.x0); px <= Math.ceil(C.x1) && px < W2 * 2; px++) {
                    if (px < 0) continue;
                    for (let y = top; y <= bot; y++) {
                        const edgeY = y === top || y === bot;
                        let col = up ? tile(px, y) : M(tile(px, y), PAL.back, 0.35);
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
    // the diary's leather and paper, laid at half size (so they read as pixels) from their typed pieces (gd_ui): the fill
    // repeated (each tile flipped its own way, each row of them shifted its own way, so it never reads as a grid), on a page its
    // rules, margin, gutter shade and foxing, then the rims along the edges and the corners; on the cover its emblem; a page
    // bowing into the spine ('pageLC', 'pageRC') dips at the gutter
    _diaryTex(kind, w, h) {
        const W = Math.max(8, Math.round(w / 2)), H = Math.max(8, Math.round(h / 2)), key = `diary_${kind}_${W}x${H}`;
        return MenuArt.tex(this, key, W, H, P => {
            const R = MenuArt.rng(W * 7 + H), A = this._artPx('gd_ui'), fr = A.fr, lay = (n, x, y, sw, sh) => this._lay(P, 'gd_ui', n, x, y, 0, sw, sh);
            const pre = kind === 'cover' ? 'cv' : kind === 'card' ? 'cd' : 'pg', left = kind.startsWith('pageL'), ts = fr[pre + '_fill0'].cutWidth;
            for (let y = 0; y < H; y += ts) for (let x = -Math.floor(R() * ts); x < W; x += ts) lay(pre + '_fill' + Math.floor(R() * 4), x, y);
            if (pre === 'pg') {
                for (let y = 30; y < H - 6; y += 12) for (let x = 6; x < W - 6; x += 32) lay('pg_rule', x, y, Math.min(32, W - 6 - x));
                if (left) for (let y = 5; y < H; y += 32) lay('pg_margin', 16, y);
                for (let y = 0; y < H; y += 16) { lay(left ? 'pg_gutL' : 'pg_gutR', left ? W - 36 : 0, y); lay('pg_hi', Math.round(W * (left ? 0.55 : 0.25)), y); }
                for (let k = 0; k < W * H / 900; k++) lay('pg_fox' + Math.floor(R() * 3), Math.floor(R() * (W - 12)) + 6, Math.floor(R() * (H - 12)) + 6);
            }
            const c = fr[pre + '_tl'].cutWidth, tb = fr[pre + '_t'], lr = fr[pre + '_l'];
            for (let x = c; x < W - c; x += tb.cutWidth) { const sw = Math.min(tb.cutWidth, W - c - x); lay(pre + '_t', x, 0, sw); lay(pre + '_b', x, H - tb.cutHeight, sw); }
            for (let y = c; y < H - c; y += lr.cutHeight) { const sh = Math.min(lr.cutHeight, H - c - y); lay(pre + '_l', 0, y, null, sh); lay(pre + '_r', W - lr.cutWidth, y, null, sh); }
            lay(pre + '_tl', 0, 0); lay(pre + '_tr', W - c, 0); lay(pre + '_bl', 0, H - c); lay(pre + '_br', W - c, H - c);
            if (pre === 'cv') lay('cv_emb', Math.floor(W / 2) - 13, Math.floor(H / 2) - 13);
            if (kind.endsWith('C')) for (const [n, top] of [[left ? 'pg_dipTL' : 'pg_dipTR', true], [left ? 'pg_dipBL' : 'pg_dipBR', false]]) {   // magenta: paper that isn't there
                const f = fr[n], x0 = left ? W - f.cutWidth : 0, y0 = top ? 0 : H - f.cutHeight;
                for (let j = 0; j < f.cutHeight; j++) for (let i = 0; i < f.cutWidth; i++) {
                    const o = ((f.cutY + j) * A.W + f.cutX + i) * 4, d = A.d;
                    if (!d[o + 3]) continue;
                    if (d[o] === 255 && !d[o + 1] && d[o + 2] === 255) P.clear(x0 + i, y0 + j); else P.put(x0 + i, y0 + j, (d[o] << 16) | (d[o + 1] << 8) | d[o + 2], d[o + 3] / 255);
                }
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
    _canTex(C) { return 'gd4_can_' + C.id; }
    _dropTex() { return 'gd4_drop'; }   // a drop of water: this bed wants watering
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
    _fertTex() { return 'gd3_fert'; }   // a little sack of fertilizer, tied off, a glowing sprout on it
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
        const sc = sz / 27;   // (typed, gd_ui: the slot 27 x 27, its tank inside at (2, 3))
        keep(this.add.image(x, y, 'gd_ui', on ? 'slot_on' : 'slot').setOrigin(0).setScale(sc).setDepth(D));
        if (!o) return;
        if (o.k === 'fish') {   // a little tank of its own water, the fish swimming back and forth in it
            const F = Garden.FISH.find(q => q.id === o.id);
            keep(this.add.image(x + 2 * sc, y + 3 * sc, 'gd_ui', 'slotw_' + (['lake', 'mud', 'cosmic'].includes(F.where) ? F.where : 'river')).setOrigin(0).setScale(sc).setDepth(D));
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
                const c = keep(this.add.container(cx, cy).setDepth(D + 4).setScale(0.2)), hand = HK.keys.indexOf(o.k + ':' + o.id), on = hand >= 0, r = Math.max(1, Math.round(32 * k / 11.5)) * 11.5, up = 1 + 11.5 / r, picked = this._packPick === o.k + ':' + o.id;   // (the disc a whole number of times its size, and one more when it's lifted: even pixels)
                const disc = this.add.image(0, 0, 'gd_ui', on ? 'disc_on' : 'disc').setScale(r / 11.5), paint = hov => disc.setFrame(on ? 'disc_on' : hov ? 'disc_hov' : 'disc');   // (typed, gd_ui, 23 across)
                c.add([this.add.image(3, 5, 'gd_ui', 'disc').setScale(r / 11.5).setTintFill(0x000000).setAlpha(0.35), disc]);
                if (picked) { const gl = this.add.image(0, 0, 'mn_glow').setTint(0xffd060).setBlendMode(Phaser.BlendModes.ADD).setDisplaySize(r * 4, r * 4).setAlpha(0.8); c.addAt(gl, 0); this.tweens.add({ targets: gl, alpha: 0.35, duration: 500, yoyo: true, repeat: -1 }); }
                const ic = this._itemIcon(o, 0, 0, r * 1.25, 0); c.add(ic.setScale(Math.max(1, Math.round(ic.scaleX))));
                const cnt = this._itemCount(o); if (cnt) c.add(this.add.text(r * 0.72, r * 0.62, cnt, { fontSize: '11px', fontFamily: 'monospace', fontStyle: 'bold', color: '#fff6d8', backgroundColor: '#2a1a08', padding: { x: 3, y: 1 } }).setOrigin(0.5));
                if (on) c.add(this.add.text(-r * 0.7, -r * 0.7, String(hand + 1), { fontSize: '13px', fontFamily: 'monospace', fontStyle: 'bold', color: '#1a1006', backgroundColor: hand === HK.on ? '#ffe08a' : '#c8b898', padding: { x: 5, y: 1 } }).setOrigin(0.5));
                const z = this.add.circle(0, 0, r).setInteractive({ useHandCursor: true }); c.add(z);
                c.list.forEach(q => q.setScrollFactor(0));
                z.on('pointerover', () => { paint(true); label.setText(this._itemName(o)); this.tweens.add({ targets: c, scale: up, duration: 100 }); })
                 .on('pointerout', () => { paint(false); this.tweens.add({ targets: c, scale: picked ? up : 1, duration: 100 }); label.setText(pk ? `${this._itemName(pk).replace(/ \(.*\)$/, '')}: put it in hand 1 or 2 (click the hand, or press 1 / 2)` : 'click a thing, then a hand to put it in'); })
                 .on('pointerdown', () => { this._packPick = picked ? null : o.k + ':' + o.id; Sfx.play(this, 'click'); this._backpack(page, true); });
                this.tweens.add({ targets: c, x, y: y - (picked ? 10 : 0), scale: picked ? up : 1, duration: again ? 1 : 340, delay: again ? 0 : 60 + j * 18, ease: 'Back.easeOut' });   // flung out of the backpack (the picked one lifted)
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
            const xb = keep(this.add.container(cx + R2 * 0.78, cy - R2 * 0.78).setDepth(D + 6));
            xb.add([this.add.image(2, 3, 'gd_ui', 'xbtn').setScale(2).setTintFill(0x1a0806), this.add.image(0, 0, 'gd_ui', 'xbtn').setScale(2), this.add.text(0, -1, '✕', { fontSize: '20px', fontFamily: 'monospace', fontStyle: 'bold', color: '#fff6d8' }).setOrigin(0.5), this.add.circle(0, 0, 20).setInteractive({ useHandCursor: true }).on('pointerdown', () => this._packAway())]);
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
    _packTex() { return 'gd5_pack'; }
    // the bottom bar's icons (24 x 24): a book, a hammer, a backpack
    _hudIcon(kind) { return kind === 'pack' ? 'gd5_pack' : 'gd5_hud_' + kind; }
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
                    : this.add.image(0, 0, kind === 'lamp' ? 'gd2_lantern' : this._crystalTex(G[key][i2][3], 22)).setOrigin(0.5, 1).setScale(T / 16).setDepth(6500);
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
        // the typed water (gd_water): ripple tiles in three depths, foam, wavelets, twinkles, lotus, each this place's own
        const A = this._artPx('gd_water'), set = this._cfg ? this._cfg().where : 'river', BR = this._bridges ?? GardenScene.BRIDGES, dry = x => { const b = bank[Math.max(0, Math.min(W2 - 1, Math.round(x)))]; return b[1] - b[0] < 6; };
        const tile = name => { const f = A.fr[name], w = f.cutWidth, h = f.cutHeight, c = new Int32Array(w * h), a = new Uint8Array(w * h); for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) { const o = ((f.cutY + j) * A.W + f.cutX + i) * 4; c[j * w + i] = (A.d[o] << 16) | (A.d[o + 1] << 8) | A.d[o + 2]; a[j * w + i] = A.d[o + 3]; } return { w, h, c, a }; };
        const kit = s => ({ depth: [0, 1, 2].map(di => [0, 1, 2, 3].map(f => tile(`${s}_${di}_${f}`))), fn: [0, 1, 2, 3].map(f => tile(`${s}_fn${f}`)), ff: [0, 1, 2, 3].map(f => tile(`${s}_ff${f}`)), wv: [0, 1, 2].map(f => tile(`${s}_wv${f}`)) });
        const RV = kit(set), LK = set === 'river' ? kit('lake') : RV, TW = { w: [0, 1].map(i => tile('tw_w' + i)), l: [0, 1].map(i => tile('tw_l' + i)) }, LOT = ['pink', 'mint', 'lilac'].map(c => tile('lotus_' + c));
        const waves = Array.from({ length: Math.floor(W2 * H2 / 260) }, () => ({ x: Math.random() * W2, u: Math.random(), p: Math.random() * 6, v: 0.6 + Math.random() * 0.6 }));
        const stars = Array.from({ length: Math.floor(W2 / 7) }, () => ({ x: Math.floor(Math.random() * W2), u: Math.random(), p: Math.random() * 6, c: Math.random() < 0.3 ? 'l' : 'w' }));
        const lotus = Array.from({ length: this._lotus ?? 16 }, () => ({ x: Math.random() * W2, u: 0.2 + Math.random() * 0.6, v: 0.15 + Math.random() * 0.25, c: Math.floor(Math.random() * 3) }));
        const bridgeX = BR.map(b => (this.gx0 + b) * 16 + 16);
        const put = (x, y, c, a = 255) => {   // over what's there (a stamp's soft pixels blend into the water)
            if (x < 0 || y < 0 || x >= W2 || y >= H2 || !a) return; const i = (y * W2 + x) * 4;
            if (a < 255 && d[i + 3]) { const m = a / 255; d[i] += (((c >> 16) & 255) - d[i]) * m; d[i + 1] += (((c >> 8) & 255) - d[i + 1]) * m; d[i + 2] += ((c & 255) - d[i + 2]) * m; return; }
            d[i] = (c >> 16) & 255; d[i + 1] = (c >> 8) & 255; d[i + 2] = c & 255; d[i + 3] = a;
        };
        const stampT = (S, x, y) => { for (let j = 0; j < S.h; j++) for (let i = 0; i < S.w; i++) { const q = j * S.w + i; if (S.a[q]) put(x + i, y + j, S.c[q], S.a[q]); } };
        const yAt = (x, u) => { const [t0, t1] = bank[Math.max(0, Math.min(W2 - 1, Math.round(x)))]; return Math.round(t0 - top + 3 + u * (t1 - t0 - 6)); };
        // the lake is its own water: a touch greener and deeper than the river, easing in where they meet
        const L0 = GardenScene.LAKE;
        const lakeMix = Array.from({ length: W2 }, (_, x) => { if (set !== 'river' || !L0) return 0; const dx = x / 16 - this.gx0; return Math.max(0, Math.min(1, Math.min(dx - L0[0], L0[1] - dx) / 3)); });
        let last = 0;
        this._ticks.push(t => {
            if (t - last < 100) return; last = t;
            const cam = this.cameras.main, x0 = Math.max(0, Math.floor(cam.scrollX / k) - 8), x1 = Math.min(W2, Math.ceil((cam.scrollX + this.scale.width / cam.zoom) / k) + 8);
            const fr = Math.floor(t / 280) % 4, drift = Math.floor(t * 0.004);
            d.fill(0);
            for (let x = x0; x < x1; x++) {
                const a = bank[x][0] - top, b = bank[x][1] - top, half = Math.max(1, (b - a) / 2);
                if (b < a) continue;   // dry here
                const mix = lakeMix[x], K2 = mix > 0.5 ? LK : RV, tx = (((x - drift) % 32) + 32) % 32, fx = (((x - drift) % 16) + 16) % 16;
                for (let y = a; y <= b; y++) {
                    const K3 = mix > 0 && mix < 1 ? (mix > MenuArt.bayer(x, y) ? LK : RV) : K2, deep = Math.min(y - a, b - y) / half + (MenuArt.bayer(x, y) - 0.5) * 0.2;   // 0 at a bank, 1 in the middle
                    const Tt = K3.depth[y - a < 3 || deep < 0.3 ? 0 : deep < 0.62 ? 1 : 2][fr];
                    put(x, y, Tt.c[(y % 16) * 32 + tx]);
                }
                const fn = K2.fn[fr], ff = K2.ff[fr];   // foam lapping both banks
                for (let j = 0; j < 2; j++) { if (fn.a[j * 16 + fx]) put(x, a + j, fn.c[j * 16 + fx], 235); if (ff.a[j * 16 + fx]) put(x, b - 1 + j, ff.c[j * 16 + fx], 210); }
            }
            for (const w of waves) {   // wavelets riding the current: rising, cresting, breaking
                w.x = (w.x + w.v) % W2; const xx = Math.round(w.x); if (xx < x0 || xx >= x1 || dry(xx)) continue;
                const a = Math.sin(t * 0.0025 + w.p); if (a < 0.1) continue;
                stampT((lakeMix[xx] > 0.5 ? LK : RV).wv[a < 0.45 ? 0 : a < 0.85 ? 1 : 2], xx - 2, yAt(xx, w.u) - 1);
            }
            for (const S of stars) {
                if (S.x < x0 || S.x >= x1 || dry(S.x)) continue;
                const a = Math.sin(t * 0.003 + S.p);
                if (a > 0.9) stampT(TW[S.c][1], S.x - 1, yAt(S.x, S.u) - 1); else if (a > 0.4) stampT(TW[S.c][0], S.x, yAt(S.x, S.u));
            }
            for (const L of lotus) {
                L.x = (L.x + L.v) % W2;
                const xx = Math.round(L.x); if (xx < x0 || xx >= x1 || dry(xx) || bridgeX.some(bx => Math.abs(xx - bx) < 22)) continue;
                stampT(LOT[L.c], xx - 3, yAt(xx, L.u) - 3);
            }
            ctx.putImageData(img, 0, 0); tex.refresh();
        });
        BR.forEach((b, i) => {   // the bridges, over the water: their top, a run of planks as long as the river is wide, their foot
            const bx = (this.gx0 + b) * 16, t0 = Math.min(bank[bx][0], bank[bx + 31][0]) - 5, t1 = Math.max(bank[bx][1], bank[bx + 31][1]) + 5, bh = t1 - t0;
            this.add.image(this.ox + (bx - 1) * k, this.oy + t0 * k, MenuArt.tex(this, `gd3_bridge_${bh}`, 34, bh + 2, P => {
                const foot = bh + 2 - 6;
                for (let y = 8; y < foot; y += 4) this._lay(P, 'gd_ground', 'br_mid', 0, y);
                this._lay(P, 'gd_ground', 'br_top', 0, 0); this._lay(P, 'gd_ground', 'br_foot', 0, foot);
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
            reg('POTS', i, this.add.image(x, y, 'gd6_pot').setOrigin(0.5, 1).setScale(k).setDepth(y + 0.1));
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
            reg('STONES', i, this.add.image(x, y, 'gd3_menhir').setOrigin(0.5, 1).setScale(k).setDepth(y));
        });
        G.LAMPS.forEach(([tx, ty], i) => {   // lanterns along the paths, violet-flamed
            const x = this._px(tx), y = this._py(ty);
            reg('LAMPS', i, this.add.image(x, y, 'gd2_lantern').setOrigin(0.5, 1).setScale(k).setDepth(y));
            const f = reg('LAMPS', i, this.add.image(x, y - 22 * k, 'mn_glow').setTint(0xb07aff).setBlendMode(Phaser.BlendModes.ADD).setDisplaySize(T * 2.4, T * 2.4).setAlpha(0.55).setDepth(y + 1));
            this.tweens.add({ targets: f, alpha: { from: 0.35, to: 0.65 }, duration: 160 + Math.random() * 200, yoyo: true, repeat: -1 });
        });
        for (let i = 0; i < 40; i++) {   // luminous mushrooms in the grass
            const tx = -26 + Math.random() * 78, ty = 2 + Math.random() * 12, ltx = Math.floor(tx), lty = Math.floor(ty);
            if (!this._clear(tx, ty, 0)) continue;
            const x = this._px(tx), y = this._py(ty), col = [0x8affd8, 0x9ad8ff, 0xff9ad8][i % 3];
            this.add.image(x, y, 'gd2_shroom' + (i % 3)).setOrigin(0.5, 1).setScale(k).setDepth(y);
            const g = this.add.image(x, y - 2 * k, 'mn_glow').setTint(col).setBlendMode(Phaser.BlendModes.ADD).setDisplaySize(T * 0.9, T * 0.9).setAlpha(0.4).setDepth(y + 1);
            this.tweens.add({ targets: g, alpha: 0.15, duration: 1500 + i * 70, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
        }
        const au = this.add.image(W / 2, H / 2, MenuArt.tex(this, 'gd2_aurora', 64, 36, P => { for (let y = 0; y < 36; y++) for (let x = 0; x < 64; x++) { const v = Math.sin(x * 0.12 + y * 0.05) * 0.5 + 0.5; P.put(x, y, MenuArt.mix(0x8affd8, 0xb07aff, v), 0.12 * (1 - y / 36)); } }, { linear: true })).setDisplaySize(W, H).setBlendMode(Phaser.BlendModes.ADD).setDepth(4850).setScrollFactor(0);
        this.tweens.add({ targets: au, alpha: { from: 0.7, to: 1 }, duration: 4000, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    }
    _decorTex(id) { return id === 'lamp' ? 'gd2_lantern' : id === 'pot' ? 'gd6_potico' : this._crystalTex(0xd8a8ff, 18); }
    // decor only on open grass: no water (bridges included), nothing placed, r tiles round it and above (it stands up)
    _clear(lx, ly, r = 1) {
        for (let dx = -r; dx <= r; dx++) for (let dy = -r; dy <= 0; dy++) {
            const x = Math.floor(lx) + dx + this.gx0, y = Math.floor(ly) + dy + this.gy0;
            if (this._wet.has(x + ',' + y) || !this._open(x, y) || GardenScene.TREES.concat(GardenScene.CRYSTAL_TREES).some(([tx, ty]) => tx === x - this.gx0 && ty === y - this.gy0) || GardenScene.ORCHARD.some(([ox, oy]) => x - this.gx0 >= ox && x - this.gx0 < ox + 3 && y - this.gy0 === oy) || GardenScene.BEDS.some(([bx, by]) => x - this.gx0 >= bx && x - this.gx0 < bx + 4 && y - this.gy0 >= by && y - this.gy0 < by + 2)) return false;   // (fields are walkable now, not empty ground)
        }
        return true;
    }
    // a crystal cluster, in its colour, h tall (typed in gd_crystal at the heights the Isle uses: the nearest one)
    _crystalTex(col, h) {
        const A = this._artPx('gd_crystal'), hex = col.toString(16).padStart(6, '0'), hs = [...new Set(Object.keys(A.fr).map(n => +n.split('_')[0]))];
        const hh = hs.reduce((a, b) => Math.abs(b - h) < Math.abs(a - h) ? b : a), f = A.fr[`${hh}_${hex}`] || A.fr[`${hh}_d8a8ff`];
        return MenuArt.tex(this, `gd2_cry_${col}_${h}`, f.cutWidth, f.cutHeight, P => this._lay(P, 'gd_crystal', f.name, 0, 0));
    }

    // ── THE ART (16 px a tile, drawn T/16, a 3/4 view) ───────────────────────
    // A typed atlas read back as pixels (cached per scene), to lay its frames into a painter or the live water.
    _artPx(key) {
        const c = (this._artCache ||= {});
        if (c[key]) return c[key];
        const t = this.textures.get(key), img = t.getSourceImage(), cv = document.createElement('canvas');
        cv.width = img.width; cv.height = img.height;
        const ctx = cv.getContext('2d', { willReadFrequently: true }); ctx.drawImage(img, 0, 0);
        const d = ctx.getImageData(0, 0, img.width, img.height).data, fr = {};
        for (const [n, f] of Object.entries(t.frames)) if (n !== '__BASE') fr[n] = f;
        return (c[key] = { d, W: img.width, fr });
    }
    // lays frame `name` of a typed atlas into painter P with its top left at (x, y); sx/sw: only those columns of it
    _lay(P, key, name, x, y, sx = 0, sw = null, sh = null) {
        const A = this._artPx(key), f = A.fr[name], d = A.d;
        if (!f) return;
        for (let j = 0; j < (sh ?? f.cutHeight); j++) for (let i = sx; i < sx + (sw ?? f.cutWidth); i++) {
            const o = ((f.cutY + j) * A.W + f.cutX + i) * 4, a = d[o + 3];
            if (a) P.put(x + i - sx, y + j, (d[o] << 16) | (d[o + 1] << 8) | d[o + 2], a / 255);
        }
    }
    // The ground, laid from typed tiles (gd_ground): grass (the Grove's moonlit, creeping in over three tiles), the cobbled
    // paths with grass over their edges, the fence, the river's banks column by column, reeds, the beds' tilled fields, flowers.
    _paintGround(P) {
        const R = MenuArt.rng(17), K = 'gd_ground', lay = (n, x, y, sx, sw) => this._lay(P, K, n, x, y, sx, sw), gx = this.gx0, gy = this.gy0;
        const toP = (tx, ty) => [(gx + tx) * 16, (gy + ty) * 16], cols = P.w / 16, rows = P.h / 16;
        const pick = () => { const r = R(); return (r < 0.62 ? ['0', '0m', '1', '1m'] : r < 0.86 ? ['2', '2m', '3', '3m'] : r < 0.95 ? ['4', '4m'] : ['5', '5m'])[Math.floor(R() * (r < 0.86 ? 4 : 2))]; };
        const grass = lx => lx >= 0 ? 'g' : lx < -3 ? 'v' : `x${-lx}_`;
        for (let ty = 0; ty < rows; ty++) for (let tx = 0; tx < cols; tx++) lay(grass(tx - gx) + pick(), tx * 16, ty * 16);
        const bedT = (lx, ly) => GardenScene.BEDS.some(([bx, by]) => lx >= bx && lx < bx + 4 && ly >= by && ly < by + 2), path = new Set();   // the path stops at a bed
        for (const [a, b, c, d] of [[11, 2, 13, 11], [13, 6, 20, 7], [11, 13, 13, 15], [-26, 7, 11, 8], [13, 7, 37, 8], [-16, 8, -14, 11], [-16, 13, -14, 15]])
            for (let lx = a; lx < c; lx++) for (let ly = b; ly < d; ly++) if (!bedT(lx, ly)) path.add(lx + ',' + ly);
        const isPath = (lx, ly) => path.has(lx + ',' + ly);
        for (const s of path) {
            const [lx, ly] = s.split(',').map(Number), [x, y] = toP(lx, ly), e = lx < -2 ? 'pv_' : 'pe_';
            lay('path' + ['0', '1', '0m', '1m'][Math.floor(R() * 4)], x, y);
            if (!isPath(lx, ly - 1)) lay(e + 't', x, y);
            if (!isPath(lx, ly + 1)) lay(e + 'b', x, y + 12);
            if (!isPath(lx - 1, ly)) lay(e + 'l', x, y);
            if (!isPath(lx + 1, ly)) lay(e + 'r', x + 12, y);
        }
        const fy = gy * 16 + 16 + 4;   // the fence along the top: a post every 18 px, rails between
        for (let x = 4 - 18; x < P.w; x += 18) lay('fence', x, fy - 2);
        // the banks (the water itself is live: _waterSetup), a column at a time; stones and crystal grit on them
        for (let x = 0; x < P.w; x++) {
            const [t0, t1] = this._bank[x], v = x / 16 - gx < -2 ? 'v' : '';
            lay('bank_n' + v, x, t0 - 6, x % 16, 1); lay('bank_f' + v, x, t1 + 1, x % 16, 1);
            for (let y = t0; y <= t1; y++) P.put(x, y, 0x10284a);
            if (R() < 0.05) { const up = R() < 0.5; lay('bstone' + (R() < 0.6 ? 0 : 1), x, up ? t0 - 4 : t1 + 1); }
            else if (R() < 0.03) lay('grit', x, R() < 0.5 ? t0 - 4 : t1 + 2);
        }
        for (let k = 0; k < P.w / 7; k++) {   // reeds and cattails along the banks
            const x = Math.floor(R() * P.w), lxx = Math.floor(x / 16) - gx, n = 'reed' + Math.floor(R() * 3), up = R() < 0.5;
            if (GardenScene.BRIDGES.some(b => lxx >= b - 1 && lxx <= b + 2) || (lxx >= GardenScene.DOCK[0] - 1 && lxx <= GardenScene.DOCK[0] + 2)) continue;
            const h = this._artPx(K).fr[n].cutHeight;
            lay(n, x, up ? this._bank[x][0] - h - 1 : this._bank[x][1] + 3 - h);
        }
        for (const [bx, by] of GardenScene.BEDS) { const [x0, y0] = toP(bx, by); lay('bed', x0 - 1, y0 - 1); }   // the beds: a tilled field each
        // flowers, in clumps on open grass (the Grove's moonlit)
        const busy = (x, y) => { const tx = Math.floor(x / 16) - gx, ty = Math.floor(y / 16) - gy; return ty < 2 || this._wet.has(Math.floor(x / 16) + ',' + Math.floor(y / 16)) || this._wet.has(Math.floor(x / 16) + ',' + Math.floor(y / 16 + 0.5)) || isPath(tx, ty) || GardenScene.BEDS.some(([bx, by]) => tx >= bx - 1 && tx < bx + 5 && ty >= by - 1 && ty < by + 3) || (tx >= 19 && tx <= 25 && ty <= 7); };
        for (let k = 0; k < P.w * P.h / 700; k++) {
            const x = Math.floor(R() * P.w), y = Math.floor(R() * P.h), grove = x / 16 - gx < 0, col = grove ? ['lilac', 'blue', 'white'][Math.floor(R() * 3)] : ['pink', 'gold', 'blue', 'white', 'amber'][Math.floor(R() * 5)], i = Math.floor(R() * 3);
            if (busy(x, y) || busy(x + 7, y + 6)) continue;
            lay(`fl_${col}${i}`, x, y);
        }
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
                 fishLabel: 'fish the cosmic fluid', exitLabel: 'climb back up to the Grove', back: { fromWell: true }, hint: 'Esc or the moonlight to climb back up',
                 banner: ['THE UNDERWELL', 'Beneath the Isle runs a deep sea of cosmic fluid. Things live in it.', '#e8d0ff', '#2a0a4a', '#c8b8e8', 0xb07aff, [200, 160, 255]] };
    }
    create() {
        const W = this.scale.width, H = this.scale.height, C = this._cfg();
        MenuArt.basics(this);
        Music.play(this, C.music);
        this._panelObjs = null; this._busy = false; this._ticks = []; this._fish = null; this._leaving = false; this._rest = null; this._hudObjs = null; this._bookCam = null; this._build = null; this._reg = {};
        this._area = C.area;
        this._bridges = []; this._lotus = C.lotus;
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
        if (TouchControls.on(this)) TouchControls.garden(this);   // a phone: a stick to walk, E on the screen
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
        const R = MenuArt.rng(9), lay = (n, x, y, sx, sw) => this._lay(P, 'gd_ground', n, x, y, sx, sw), wall = (this.gy0 + 2) * 16;
        for (let ty = 0; ty < P.h / 16; ty++) for (let tx = 0; tx < P.w / 16; tx++) { const r = R(); lay((r < 0.55 ? 'uf0' : r < 0.85 ? 'uf1' : 'uf2') + (R() < 0.5 ? 'm' : ''), tx * 16, ty * 16); }
        for (let k = 0; k < P.w * P.h / 5000; k++) lay('ucrack' + Math.floor(R() * 3), Math.floor(R() * P.w), Math.floor(R() * P.h));
        for (let y = wall - 22; y > -16; y -= 16) for (let x = 0; x < P.w; x += 16) lay(y === wall - 22 ? 'urock2' : 'urock', x, y);
        for (let x = 0; x < P.w; x += 32) lay('ulip', x, wall - 6);
        for (let x = 0; x < P.w; x++) if (R() < 0.05) lay('ustal' + Math.floor(R() * 3), x, wall + 1);
        for (let x = 0; x < P.w; x++) {
            const [t0, t1] = this._bank[x]; if (t1 < t0) continue;
            lay('ubank_n', x, t0 - 4, x % 16, 1);
            for (let y = t0; y <= t1; y++) P.put(x, y, 0x12042a);
            lay('ubank_f', x, t1 + 1, x % 16, 1);
            if (R() < 0.08) lay('uspark', x, R() < 0.5 ? t0 - 3 : t1 + 1);
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
                 fishLabel: 'fish the clouds', exitLabel: 'bounce back down to the garden', back: { fromSky: true }, hint: 'Esc or the trampoline to bounce back down', lotus: 0,
                 banner: ['THE CLOUD SEA', 'Above the Isle the clouds pile up into a sea. Things swim in it.', '#ffffff', '#3a6aa8', '#d8e8ff', 0x8ac8ff, [255, 255, 255]] };
    }
    // the trampoline you came up on
    _exitArt(sx, sy) {
        this._tramp = this.add.image(sx, sy, 'gd4_tramp').setOrigin(0.5, 1).setScale(this.T / 16).setDepth(sy);
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
        const gull = 'gd_gull_2';   // wings up, wings down
        if (!this.anims.exists(gull)) this.anims.create({ key: gull, frames: [{ key: gull, frame: '0' }, { key: gull, frame: '1' }], repeat: -1 });
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
        const R = MenuArt.rng(21), lay = (n, x, y, sx, sw) => this._lay(P, 'gd_ground', n, x, y, sx, sw), wall = (this.gy0 + 2) * 16;
        for (let y = 0; y < wall - 48; y++) for (let x = 0; x < P.w; x++) P.put(x, y, 0x5a9ae0);   // the sky, deepest up high
        for (let x = 0; x < P.w; x += 16) lay('sky', x, wall - 48);                                    // paling down to the bank
        lay('sun', Math.round(P.w * 0.7) - 13, Math.round(wall * 0.45) - 10);
        for (let ty = wall / 16; ty < P.h / 16; ty++) for (let tx = 0; tx < P.w / 16; tx++) lay('skc' + (R() < 0.6 ? 0 : 1) + (R() < 0.5 ? 'm' : ''), tx * 16, ty * 16);   // the cloud bank
        for (let x = 0; x < P.w; x += 35) lay('sktop', x, wall - 6);                                  // its top, billowing against the sky
        for (let x = 0; x < P.w; x++) {   // its edge over the sea: a lip and a blue shadow; the sea's floor colour (the live layer draws it)
            const [t0] = this._bank[x];
            for (let y = t0; y < P.h; y++) P.put(x, y, 0xc2d6f2);
            lay('sklip', x, t0 - 3, x % 16, 1);
            if (R() < 0.05) lay('skglint', x, wall + 8 + Math.floor(R() * Math.max(1, t0 - wall - 16)));   // a glint of sun in the cloud
        }
    }
}
