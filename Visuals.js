// ═══════════════════════════════════════════════════════════════════════════
// Visuals.js — how the dungeon looks.
//
// A mixin like the others: GameScene borrows each method through a one-line proxy.
// Everything in here is presentation. Nothing in it changes a number the game plays by,
// and every hook into the rest of the game is a single call (see _vfxInit, _vfxUpdate,
// _vfxRenderWorld, and the hit/death hooks in CombatSystem).
//
//   camera  the world zoomed 1.5x; the HUD on its own unzoomed camera
//   world   generated stone floors, walls drawn as lines where they meet the floor, tinted per level;
//           torches, bones, cobwebs; sealed doorways as curtains of red light
//   light   unlit floor sits in the dark; you, your attacks, torches, lava and pickups light it
//   bloom   bright things glow (a post pass on the world camera, WebGL only)
//   air     a starry void behind the map, dust in the light, a soft vignette
//   combat  sparks, rings and flares on hits, splashes and stains on kills, wakes behind
//           projectiles, numbers that merge, status words that count instead of piling up
//   HUD     the status card, the glorp pill, the red edge, the ult banners
// Every size, colour and rate worth tuning is in _vfxCfg (and the level looks in _vfxTheme).
// ═══════════════════════════════════════════════════════════════════════════
class VisualFX {
    // px from the top of a brick face down to a sconce's bowl (the torch flame stands in it)
    static SCONCE_BOWL = 9;

    _vfxCfg() {
        if (this._vfxCfgCache) return this._vfxCfgCache;
        return (this._vfxCfgCache = {
            ZOOM: 1.75,          // ~30x17 tiles at 1280x720: closer, while the 7-tile gadget throw and ranged weapons still fit on screen
            // The shade over the floor: how dark an unlit tile is, and the light you carry.
            DARK: 0.76, DARK_COLOR: 0x03040a,
            PLAYER_LIGHT: 175,
            MAX_LIGHTS: 32,
            SHADE_DEPTH: 0.3,       // above floor and walls (0), below floor effects (0.4+) and units (1)
            GLOW_DEPTH: 0.31,
            LIGHT_PAD: 96,          // shade margin past the view edge, so a fast camera never shows its border
            VIGNETTE: 0.3,
            // Bloom: anything brighter than THRESHOLD (its brightest channel, 0-1) glows.
            // STRENGTH 0 turns the pass off entirely.
            BLOOM: { STRENGTH: 1.0, THRESHOLD: 0.64, KNEE: 0.3 },
            EL: { fire: 0xff7a30, ice: 0x72dcff, lightning: 0xffe14a, cosmic: 0xb47cff },
            // Walls in 3/4 view (the floors, wall tops and brick faces are each level's sheet: TILESETS). A wall with floor
            // below shows its brick FACE (a lit lip on top, a dark baseboard); every other wall is the CAP, the top of the
            // rock, with a lit RIM px wide wherever it meets floor. CAP_STRIP: the cap a face
            // carries itself when nothing above it is wall. SHADOW: px of shade the face casts
            // on the floor below it (SIDE_SHADOW from side walls). Everything that isn't room
            // is solid rock. LIFT: the rims and lips are drawn a second time above the shade at
            // this alpha (LIFT_DEPTH), so a room keeps its outline in the dark.
            WALL: {
                RIM: 3, CAP_STRIP: 6, SHADOW: 8, SIDE_SHADOW: 4,
                LIFT: 0.42, LIFT_DEPTH: 0.35,
                lip: '#9aa1bc', rim: '#5b6077', rimHi: '#9aa1bc', edge: '#08090c',
                rock: '#111218',
            },
            // Torches on the walls: one in about every TORCH_EVERY wall faces, never two closer
            // than TORCH_GAP tiles. Their light flickers between TORCH_LIGHT and +12%.
            TORCH_EVERY: 4, TORCH_GAP: 6, TORCH_LIGHT: 78,
            // Bones, pebbles and the like on about DECALS percent of the floor; cobwebs in
            // about WEBS percent of the corners.
            DECALS: 3, WEBS: 40,
        });
    }

    // Levels with their own hand-made tiles, one sheet each laid out alike (row 0 six floors, row 1 the wall top, three bits of
    // clutter and the lamp, rows 2-3 two wall faces two tiles tall): its floors, walls, lamps and clutter in place of the stone.
    // FLOOR: which of its six floors stands in for each stone variant (_vfxPaintFloor's 0-11: mostly the first, now and then the
    // others; the sixth where the rune was, as rarely); PICK: its clutter, by how often
    static TILESETS = {
        2: { key: 'gt', tex: 'gt_tiles', DECALS: { gt_nuts: 1, gt_cable: 2, gt_drip: 3 }, PICK: ['gt_nuts', 'gt_nuts', 'gt_cable', 'gt_drip'] },   // the Gauntlet: steel, iron, copper, storm lamps
        5: { key: 'cs', tex: 'cs_tiles', DECALS: { cs_shell: 1, cs_algae: 2, cs_pebbles: 3 }, PICK: ['cs_algae', 'cs_pebbles', 'cs_algae', 'cs_shell'], FLOOR: [0, 0, 0, 0, 3, 0, 1, 0, 4, 2, 1, 5] },   // the Cistern, a drowned hall: wet flagstones, moss, water in its cracks and drains, brass lanterns burning cold
        4: { key: 'fr', tex: 'fr_tiles', DECALS: { fr_shard: 1, fr_flecks: 2, fr_pebbles: 3 }, PICK: ['fr_flecks', 'fr_flecks', 'fr_shard', 'fr_pebbles'], FLOOR: [0, 0, 0, 0, 0, 0, 3, 0, 4, 2, 1, 5] },   // the Fracture, a geode: banded agate, amber in its cracks, amethyst lining its walls
        3: { key: 'vr', tex: 'vr_tiles', DECALS: { vr_shard: 1, vr_dust: 2, vr_rubble: 3 }, PICK: ['vr_dust', 'vr_dust', 'vr_shard', 'vr_rubble'], FLOOR: [0, 0, 0, 0, 3, 3, 3, 0, 4, 2, 1, 5] },   // the Void Rift, a cave: raw rock, the void through its cracks, crystal lighting it (a crack, a cluster, a pool each about one tile in sixteen)
        // every other level (the Tutorial, Level 1, the Tower, the Training Ground, tower defense): the plain stone, its twelve
        // floors in a row, its sconce a torch (TORCH: the full flame), and the cobweb and the open rock every level shares
        stone: { key: 'st', tex: 'st_tiles', FLOOR: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11], TORCH: true,
                 DECALS: { dc_pebbles: 1, dc_bones: 2, dc_skull: 3, dc_web: 5 }, PICK: ['dc_pebbles', 'dc_pebbles', 'dc_pebbles', 'dc_bones', 'dc_bones', 'dc_pebbles', 'dc_bones', 'dc_skull'] },
    };
    _vfxTileArt() {
        const i = this.currentLevelIndex ?? 0;
        if (this._vfxArtFor === i) return this._vfxArtObj;
        this._vfxArtFor = i;
        const T = VisualFX.TILESETS[i] || VisualFX.TILESETS.stone;
        return (this._vfxArtObj = this.textures?.exists(T.tex)
            ? { FLOOR: [0, 0, 1, 0, 3, 3, 1, 0, 4, 2, 1, 5], ...T, img: this.textures.get(T.tex).getSourceImage(), CAP: [0, 1], LAMP: [4, 1], FACE_Y: 48 }
            : null);
    }
    // Each level's look: a tint over its stone and the colour its torches and dust burn.
    _vfxTheme() {
        const i = this.currentLevelIndex ?? 0;
        if (this._vfxThemeFor === i && this._vfxThemeObj) return this._vfxThemeObj;
        const T = {
            stone:  { floor: 0xffffff, wall: 0xffffff, torch: 0xff9a3c, dust: 0xffffff },
            ember:  { floor: 0xffe0d4, wall: 0xffd8cc, torch: 0xff6428, dust: 0xffa060 },
            storm:  { floor: 0xffffff, wall: 0xffffff, torch: 0x7ad8ff, dust: 0xbfe8ff },   // the Gauntlet: its own tiles (gt_tiles), lamps the colour of the storm
            void:   { floor: 0xe2d6ff, wall: 0xd8ccff, torch: 0xb47cff, dust: 0xc8a8ff },   // the Void Rift
            rift:   { floor: 0xffffff, wall: 0xffffff, torch: 0xb47cff, dust: 0xd8c0ff },
            geode:  { floor: 0xffffff, wall: 0xffffff, torch: 0xffb44a, dust: 0xffe0a0 },
            drowned:{ floor: 0xffffff, wall: 0xffffff, torch: 0x5ce0ff, dust: 0x9ff0ff },   // the Cistern with its own tiles (cs_tiles): its lanterns' cold light   // the Fracture with its own tiles (fr_tiles): amber crystal light   // the Void Rift with its own tiles (vr_tiles): rune stones' violet
            amber:  { floor: 0xf4e8d4, wall: 0xeee0cc, torch: 0xffb44a, dust: 0xffe0a0 },   // the Fracture
            tide:   { floor: 0xd4eee8, wall: 0xcce6e4, torch: 0x5ce0ff, dust: 0x9ff0ff },   // the Cistern
            frost:  { floor: 0xdce6ff, wall: 0xd4deff, torch: 0x9fd8ff, dust: 0xdff2ff },
        };
        const pick = i === 2 ? (this._vfxTileArt?.() ? 'storm' : 'ember') : i === 3 ? (this._vfxTileArt?.() ? 'rift' : 'void') : i === 4 ? (this._vfxTileArt?.() ? 'geode' : 'amber') : i === 5 ? (this._vfxTileArt?.() ? 'drowned' : 'tide')
                   : i >= 6 ? ['stone', 'frost', 'void', 'ember'][(i - 6) % 4] : 'stone';
        this._vfxThemeFor = i;
        return (this._vfxThemeObj = T[pick]);
    }

    // Menus (title, level select, shop) get the same starfield, dust and vignette as the
    // dungeon. Static, so any scene can call it: VisualFX.dressMenu(this).
    static dressMenu(scene, { depth = -50, vignette = 0.55, dust = true, bloom = false } = {}) {
        if (bloom && VisualFX.bloomPipeline(scene.game)) {
            const B = VisualFX.prototype._vfxCfg.call({}).BLOOM;
            scene.cameras.main.setPostPipeline('VfxBloom');
            let p = scene.cameras.main.getPostPipeline?.('VfxBloom');
            if (Array.isArray(p)) p = p[0];
            if (p) { p.strength = B.STRENGTH; p.threshold = B.THRESHOLD; p.knee = B.KNEE; }
        }
        VisualFX.prototype._vfxSoftTextures.call(scene);
        const W = scene.scale.width, H = scene.scale.height, out = {};
        out.stars = scene.add.tileSprite(W / 2, H / 2, W, H, 'vfx_void').setScrollFactor(0).setDepth(depth);
        scene.tweens.add({ targets: out.stars, tilePositionX: 192, duration: 90000, repeat: -1 });
        if (dust && scene.add.particles) {
            out.dust = scene.add.particles(0, 0, 'vfx_dot', {
                x: { min: 0, max: W }, y: { min: 0, max: H },
                lifespan: { min: 3000, max: 6000 }, speedY: { min: -14, max: -4 }, speedX: { min: -6, max: 6 },
                scale: { start: 0.7, end: 0.2 }, alpha: { start: 0.35, end: 0 }, frequency: 110, blendMode: 'ADD',
            }).setScrollFactor(0).setDepth(depth + 1);
        }
        out.vignette = scene.add.image(W / 2, H / 2, 'vfx_edge').setDisplaySize(W, H).setTint(0x000000)
            .setAlpha(vignette).setScrollFactor(0).setDepth(depth + 2);
        return out;
    }

    // Tower defense keeps its own camera, HUD and effects. It gets the dungeon's stone, walls and
    // torches (its create() calls _vfxRenderWorld, without the bones) and the same rock past the
    // map's edge instead of flat black.
    static dressTD(scene) {
        VisualFX.prototype._vfxSoftTextures.call(scene);
        scene.cameras.main.setBackgroundColor(VisualFX.prototype._vfxCfg.call({}).WALL.rock);
    }

    // The world camera's zoom: ZOOM at 1280x720, and closer on a bigger window, so it always shows about the same 30x17 tiles
    // (at a flat ZOOM a big window showed half the dungeon, everything tiny)
    static worldZoom(scene) { return VisualFX.prototype._vfxCfg.call({}).ZOOM * Math.max(1, Math.min(scene.scale.width / 1280, scene.scale.height / 720)); }

    // ── SETUP ────────────────────────────────────────────────────────────────
    // Called once, at the end of GameScene.create().
    _vfxInit() {
        const C = this._vfxCfg(), cam = this.cameras.main;
        cam.setZoom(VisualFX.worldZoom(this));
        cam.setRoundPixels(true);

        // The HUD camera: unzoomed and unscrolled. Everything pinned to the screen (scrollFactor 0,
        // depth >= 0) draws here and only here, and the world camera skips it. Pinned things
        // below depth 0 are backdrops (the Cistern's flood field, the void): they stay with
        // the world, behind the tiles.
        this._uiCam = this.cameras.add(0, 0, this.scale.width, this.scale.height).setName('hud');
        this._vfxQueue = [];
        for (const o of this.children.list) this._vfxSort(o);
        const ev = this.events;
        ev.on('addedtoscene', this._vfxQueueObj, this);
        ev.on('removedfromscene', this._vfxUnsort, this);
        ev.on('postupdate', this._vfxFlush, this);
        // A fade on the world camera fades the HUD with it, as it did when they were one camera.
        cam.on('camerafadeoutstart', this._vfxFadeOut, this);
        cam.on('camerafadeinstart', this._vfxFadeIn, this);
        ev.once('shutdown', () => {
            ev.off('addedtoscene', this._vfxQueueObj, this);
            ev.off('removedfromscene', this._vfxUnsort, this);
            ev.off('postupdate', this._vfxFlush, this);
            cam.off('camerafadeoutstart', this._vfxFadeOut, this);
            cam.off('camerafadeinstart', this._vfxFadeIn, this);
            this._shade = null; this._glows = null; this._uiCam = null;
            this._vfxBursts = null; this._vfxShadows = null; this._vfxNums = null; this._vfxFlashes = null;
            this._vfxTorches = null; this._vfxWards = null; this._vfxStatus = null; this._vfxTrail = null;
            this._vfxRune = null; this._vfxRuneImg = null; this._vfxFreezeTxt = null;
        });

        this._vfxBuildAir();
        this._vfxBuildLight();
        this._vfxBuildBursts();
        this._vfxBuildBloom();
        this._vfxWrapPlayerTint();
    }

    // The game tints you to say what's going on (orange through the fire ult, green while
    // poisoned, a flash of colour on a switch). A tint multiplies, and on a blue-green slime
    // most of those came out olive or black, so here they become a glow around you instead
    // (see _vfxLights). setTintFill, the hurt flash, still paints you solid as before.
    _vfxWrapPlayerTint() {
        const p = this.player, self = this;
        if (!p || p._vfxTintWrapped || typeof p.setTint !== 'function') return;
        const orig = Object.getPrototypeOf(p).setTint;
        if (typeof orig !== 'function') return;
        p._vfxTintWrapped = true;
        this._vfxPlayerGlow = null;
        p.setTint = function (c, ...rest) {
            self._vfxPlayerGlow = (c === undefined || c === 0xffffff) ? null : c;
            return orig.call(this, 0xffffff);
        };
        p.setTintFill = function (c, ...rest) {
            orig.call(this, c, ...rest);
            this.tintFill = true;
            return this;
        };
    }

    // ── BLOOM ────────────────────────────────────────────────────────────────
    // A post pass on the world camera: whatever is bright (fire, sparks, bolts, runes, the
    // numbers) bleeds a soft glow into the dark around it. The threshold keeps the stone out
    // of it. Quarter resolution, so it costs about one extra full-screen copy. WebGL only.
    _vfxBuildBloom() {
        const B = this._vfxCfg().BLOOM, cam = this.cameras.main;
        if (!B || !(B.STRENGTH > 0) || !cam.setPostPipeline || (typeof Settings !== 'undefined' && (!Settings.glow() || Settings.low()))) return;
        const cls = VisualFX.bloomPipeline(this.game);
        if (!cls) return;
        cam.setPostPipeline('VfxBloom');
        let p = cam.getPostPipeline?.('VfxBloom');
        if (Array.isArray(p)) p = p[0];
        if (p) { p.strength = B.STRENGTH; p.threshold = B.THRESHOLD; p.knee = B.KNEE; }
    }

    // ── AURAS ────────────────────────────────────────────────────────────────
    // A soft glow for an area (a healer's reach, a mortar's blind spot, a totem's circle):
    // no hard line, just light that thickens toward the edge and fades out past it. White
    // textures drawn once, tinted per use, added on top (ADD) so they read as light.
    //   style 'field'  faint all over, brighter toward the rim, gone at the edge
    //   style 'ring'   a thin soft band at the rim, for ripples that expand
    // Returns an Image scaled to `radius` px, so callers move it with .x/.y and destroy it.

    // A hit landing, in its element's own shape rather than a disc of light: ice cracks into a star
    // of shards, fire licks out in flames, lightning spits forks, cosmic flares a four-point star,
    // anything else kicks out short impact lines. `size` is about its reach in px (a plain hit 10,
    // a burst 30+). Over in a fifth of a second.
    static impact(scene, x, y, el, size = 10) {
        const ADD = Phaser.BlendModes.ADD, g = scene.add.graphics().setDepth(4.4).setPosition(x, y);
        const L = size, rot = Math.random() * Math.PI, ms = 170 + size * 2;
        const ray = (a, len, w, col, alpha) => {   // a thin diamond pointing out at angle a
            const c = Math.cos(a), s = Math.sin(a), px = -s * w, py = c * w;
            g.fillStyle(col, alpha);
            g.fillTriangle(c * len, s * len, px + c * len * 0.25, py + s * len * 0.25, -px + c * len * 0.25, -py + s * len * 0.25);
            g.fillTriangle(0, 0, px + c * len * 0.25, py + s * len * 0.25, -px + c * len * 0.25, -py + s * len * 0.25);
        };
        if (el === 'ice') {
            for (let k = 0; k < 6; k++) { const a = rot + k * Math.PI / 3; ray(a, L * (k % 2 ? 0.7 : 1), 2.2, 0x9ad8ff, 0.95); ray(a, L * (k % 2 ? 0.5 : 0.75), 0.9, 0xffffff, 1); }
            for (let k = 0; k < 3; k++) {          // chips thrown off
                const a = Math.random() * Math.PI * 2, d = scene.add.rectangle(x, y, 2, 4, k ? 0xd8f4ff : 0xffffff).setDepth(4.45).setRotation(a);
                scene.tweens.add({ targets: d, x: x + Math.cos(a) * L * 1.6, y: y + Math.sin(a) * L * 1.6 + 4, angle: 200, alpha: 0, duration: ms + 120, ease: 'Quad.easeOut', onComplete: () => d.destroy() });
            }
        } else if (el === 'fire') {
            g.setBlendMode(ADD);
            for (let k = 0; k < 5; k++) { const a = -Math.PI / 2 + (k - 2) * 0.55 + (Math.random() - 0.5) * 0.3; ray(a, L * (k === 2 ? 1.2 : 0.8), 2.8, 0xff7a1a, 0.9); ray(a, L * 0.55, 1.4, 0xffe08a, 1); }
            ray(rot, L * 0.5, 3, 0xff5a1a, 0.7); ray(rot + Math.PI, L * 0.5, 3, 0xff5a1a, 0.7);
        } else if (el === 'lightning') {   // four little bolts spat out of it (the hand-drawn pieces, WeaponSystem.bolt)
            for (let k = 0; k < 4; k++) { const a = rot + k * Math.PI / 2 + (WeaponSystem.vr() - 0.5) * 0.6; WeaponSystem.bolt(scene, x, y, x + Math.cos(a) * L * 1.2, y + Math.sin(a) * L * 1.2, k % 2 ? 'y' : 'w', { life: ms, thin: true, br: 0, glow: false, d: 4.4 }); }
        } else if (el === 'cosmic') {
            g.setBlendMode(ADD);
            for (let k = 0; k < 4; k++) { ray(rot + k * Math.PI / 2, L, 2.4, 0xb47cff, 0.9); ray(rot + k * Math.PI / 2, L * 0.6, 1, 0xffffff, 1); }
            for (let k = 0; k < 4; k++) ray(rot + Math.PI / 4 + k * Math.PI / 2, L * 0.45, 1.4, 0xff7ae8, 0.8);
        } else {
            g.lineStyle(1.5, 0xf0f0f0, 0.9);
            for (let k = 0; k < 6; k++) { const a = rot + k * Math.PI / 3, c = Math.cos(a), s = Math.sin(a); g.lineBetween(c * L * 0.35, s * L * 0.35, c * L, s * L); }
        }
        g.setScale(0.55).setRotation((Math.random() - 0.5) * 0.3);
        scene.tweens.add({ targets: g, scale: 1.1, duration: ms * 0.45, ease: 'Back.easeOut' });
        scene.tweens.add({ targets: g, alpha: 0, delay: ms * 0.35, duration: ms * 0.65, ease: 'Quad.easeIn', onComplete: () => g.destroy() });
        return g;
    }

    // A shot breaking on a wall: a spray in its element's colours thrown back off the wall's face (a cone
    // round the face's normal, falling a little), chips and a puff of stone dust, and a mark on the face that
    // fades (scorch, frost, a burn, a violet stain). (vx, vy) is the shot's velocity, which gives the face.
    static wallImpact(scene, x, y, el, vx = 0, vy = 0) {
        const now = scene.time.now;   // a volley into a wall: at most a few a moment, they'd only pile into one blot
        if (now - (scene._wallFxAt || 0) < 40 && (scene._wallFxN = (scene._wallFxN || 0) + 1) > 4) return;
        if (now - (scene._wallFxAt || 0) >= 40) { scene._wallFxAt = now; scene._wallFxN = 0; }
        const ADD = Phaser.BlendModes.ADD, horiz = Math.abs(vx) >= Math.abs(vy);
        const nx = horiz ? -Math.sign(vx || 1) : 0, ny = horiz ? 0 : -Math.sign(vy || 1), na = Math.atan2(ny, nx);
        const PAL = { fire: [0xffe08a, 0xff8a2a, 0xff4a1a], ice: [0xffffff, 0xbfe8ff, 0x6ac8ff], lightning: [0xffffff, 0xfff6a0, 0xffd84a], cosmic: [0xffffff, 0xd8a8ff, 0xb47cff] }[el] || [0xf0f0f0, 0xc8c0b8, 0x9a9090];
        const glow = el === 'fire' || el === 'lightning' || el === 'cosmic';
        // the mark on the face, flat along it (fx_ground's wm_*: scorch, frost, a spark's zigzag, a violet stain, a scuff), turned a quarter to lie along a side wall
        const m = scene.add.image(x - nx * 2, y - ny * 2, 'fx_ground', 'wm_' + (['fire', 'ice', 'lightning', 'cosmic'].includes(el) ? el : 'plain'))
            .setOrigin(0.5, 0.6).setDepth(0.95).setRotation(na + Math.PI / 2);
        scene.tweens.add({ targets: m, alpha: 0, delay: 500, duration: 700, onComplete: () => m.destroy() });
        // the spray, thrown back off the face
        for (let k = 0; k < 8; k++) {
            const a = na + (Math.random() - 0.5) * 2.4, sp = 18 + Math.random() * 30, c = PAL[k % 3];
            const p = scene.add.rectangle(x, y, k % 3 ? 2 : 3, 2, c).setDepth(3.6).setRotation(a);
            if (glow) p.setBlendMode(ADD);
            scene.tweens.add({ targets: p, x: x + Math.cos(a) * sp, y: y + Math.sin(a) * sp + 5, alpha: 0, scale: 0.3, duration: 220 + Math.random() * 180, ease: 'Quad.easeOut', onComplete: () => p.destroy() });
        }
        // stone chips and a puff of dust off the wall itself
        for (let k = 0; k < 3; k++) {
            const a = na + (Math.random() - 0.5) * 1.6, ch = scene.add.rectangle(x, y, 2, 2, k ? 0x8a8478 : 0xb8b0a4).setDepth(3.55);
            scene.tweens.add({ targets: ch, x: x + Math.cos(a) * 12, y: y + Math.sin(a) * 12 + 8, angle: 180, alpha: 0, duration: 380, ease: 'Quad.easeOut', onComplete: () => ch.destroy() });
        }
        if (scene.textures.exists('vfx_glow')) {
            const d = scene.add.image(x + nx * 4, y + ny * 4, 'vfx_glow').setTint(0xa09888).setAlpha(0.3).setDepth(3.5).setScale(0.1);
            scene.tweens.add({ targets: d, scale: 0.24, alpha: 0, duration: 320, ease: 'Quad.easeOut', onComplete: () => d.destroy() });
        }
        VisualFX.impact(scene, x + nx * 2, y + ny * 2, el, 6);
        scene._vfxFlash?.(x, y, 22, PAL[1], 140, 0.4);
    }

    // A force field round the slime, drawn into g about its centre (g ADD-blended): a bubble whose rim is
    // bright and whose middle is nearly clear (looking through more of it at the edge), a hex lattice
    // shimmering over it (brightest near the rim, drifting), a highlight sliding round the rim, a band of
    // energy sweeping up through it, and where it was just hit, a ripple and the lattice lit up there.
    // o: { col, rim, R (width radius), ry (height), t (ms), fade (0..1), hit (0..1 since the last hit),
    // hitA (the hit's angle), sparkle: a colour for motes in it }
    static forceField(g, o) {
        const { col, rim, R, t } = o, ry = o.ry ?? R * 0.86, a0 = o.fade ?? 1, hit = o.hit ?? 0, TAU = Math.PI * 2;
        for (let k = 0; k < 7; k++) { const u = k / 7; g.fillStyle(col, (0.025 + 0.11 * Math.pow(u, 2.2)) * a0); g.fillEllipse(0, 0, R * 2 * (1 - u * 0.12) * 1, ry * 2 * (1 - u * 0.12)); }   // fresnel: thicker toward the rim
        // the lattice: hex cells laid on the bubble, squashed toward the rim, shimmering in a slow wave
        const cell = R * 0.26, drift = (t * 0.00004) % 1;
        for (let q = -4; q <= 4; q++) for (let r2 = -4; r2 <= 4; r2++) {
            const hx = (q + r2 * 0.5 + drift) * cell * 1.5, hy = r2 * cell * 1.3;
            const nx = hx / R, ny = hy / ry, d = nx * nx + ny * ny; if (d > 0.92) continue;
            const edge = Math.sqrt(d), s = 1 - edge * 0.45, shim = 0.5 + 0.5 * Math.sin(t * 0.003 - edge * 6 + q * 0.7);
            let al = (0.05 + 0.3 * Math.pow(edge, 2.5)) * (0.5 + 0.5 * shim) * a0;
            if (hit > 0) { const ha = Math.atan2(ny, nx), dA = Math.abs(((ha - (o.hitA ?? 0)) + Math.PI * 3) % TAU - Math.PI); al += hit * Math.max(0, 1 - dA * 1.2) * 0.6; }
            g.lineStyle(1, rim, al); g.beginPath();
            for (let j = 0; j <= 6; j++) { const b = j / 6 * TAU + Math.PI / 6, px = hx * (1 - edge * 0.12) + Math.cos(b) * cell * 0.5 * s, py = hy * (1 - edge * 0.12) + Math.sin(b) * cell * 0.5 * s * 0.86; j ? g.lineTo(px, py) : g.moveTo(px, py); }
            g.strokePath();
        }
        // the band sweeping up through it
        const by = ry - ((t * 0.06) % (ry * 3)); if (Math.abs(by) < ry) { const w = R * Math.sqrt(1 - (by / ry) ** 2); g.fillStyle(rim, 0.14 * a0); g.fillRect(-w, by - 1.5, w * 2, 3); g.fillStyle(0xffffff, 0.1 * a0); g.fillRect(-w * 0.8, by - 0.5, w * 1.6, 1); }
        // the rim, and a highlight sliding round it
        g.lineStyle(2.5, rim, (0.7 + 0.3 * hit) * a0); g.strokeEllipse(0, 0, R * 2, ry * 2);
        g.lineStyle(1, 0xffffff, 0.35 * a0); g.strokeEllipse(0, 0, R * 2 - 4, ry * 2 - 4);
        const hA = t * 0.0015; g.lineStyle(3, 0xffffff, 0.7 * a0);
        g.beginPath(); for (let j = 0; j <= 10; j++) { const b = hA + j * 0.06; const px = Math.cos(b) * R, py = Math.sin(b) * ry; j ? g.lineTo(px, py) : g.moveTo(px, py); } g.strokePath();
        g.fillStyle(0xffffff, 0.5 * a0); g.fillEllipse(-R * 0.42, -ry * 0.5, R * 0.34, ry * 0.16);   // the window highlight, top left
        // a hit: a ripple running out round the rim from where it struck
        if (hit > 0) { const r = 1 + (1 - hit) * 0.25; g.lineStyle(2, 0xffffff, hit * 0.9); g.strokeEllipse(0, 0, R * 2 * r, ry * 2 * r); }
    }

    // A fissure torn across a floor tile along (dx, dy), drawn into g about the tile's centre. `grow` (0..1) opens
    // it: a hairline at 0, a wide molten seam at 1, its side fractures creeping out as it goes, the floor round it
    // lifting into plates; `heat` (0..1) lights the magma in it, `t` (ms) makes the light boil.
    static crackTile(g, T, seed, dx, dy, heat = 0.5, grow = 1, t = 0) {
        let s = (seed * 2654435761) >>> 0;
        const r = () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
        const ax = dx || (dy ? 0 : 1), ay = dy, px = -ay, py = ax, h = T / 2 + 1;
        const pts = []; for (let k = 0; k <= 8; k++) { const u = -1 + k / 4, off = k === 0 || k === 8 ? 0 : (r() - 0.5) * T * 0.34; pts.push([ax * u * h + px * off, ay * u * h + py * off]); }
        const branches = Array.from({ length: 5 }, () => { const i = 1 + Math.floor(r() * 7), side = r() < 0.5 ? -1 : 1, L = T * (0.18 + r() * 0.24), tw = (r() - 0.5); return { i, side, L, tw }; });
        const path = (w, c, a) => { g.lineStyle(w, c, a); g.beginPath(); pts.forEach(([x, y], k) => (k ? g.lineTo(x, y) : g.moveTo(x, y))); g.strokePath(); };
        const boil = 0.5 + 0.5 * Math.sin(t * 0.02 + seed);
        g.fillStyle(0x1a0c06, 0.25 + 0.3 * grow); g.fillEllipse(0, 0, ax ? T * (0.7 + 0.5 * grow) : T * (0.3 + 0.3 * grow), ay ? T * (0.7 + 0.5 * grow) : T * (0.3 + 0.3 * grow));   // scorch
        if (grow > 0.5) for (const sd of [-1, 1]) {   // the floor tilting up into plates either side of the opening
            const lift = (grow - 0.5) * 2, o = T * 0.18 * sd;
            g.fillStyle(0x3a302a, 0.6 * lift); g.fillPoints(pts.map(([x, y]) => ({ x: x + px * o * 1.4, y: y + py * o * 1.4 - lift * 1.5 })), false);
        }
        path(2 + 6 * grow, 0x140806, 0.9);                                                          // the dark opening
        path(1 + 4 * grow, 0xff4a12, (0.35 + 0.65 * heat) * (0.75 + 0.25 * boil));                // magma
        path(0.6 + 1.8 * grow, 0xffe08a, (0.3 + 0.7 * heat) * (0.6 + 0.4 * boil));                // its white-hot core
        for (const B of branches) {   // side fractures, creeping out as it opens
            const [x0, y0] = pts[B.i], L = B.L * Math.min(1, grow * 1.4), x1 = x0 + (px * B.side + ax * B.tw) * L, y1 = y0 + (py * B.side + ay * B.tw) * L;
            g.lineStyle(1 + 1.5 * grow, 0x140806, 0.85); g.lineBetween(x0, y0, x1, y1);
            g.lineStyle(1, 0xff7a2a, (0.3 + 0.7 * heat) * grow); g.lineBetween(x0, y0, (x0 + x1) / 2, (y0 + y1) / 2);
        }
        for (let k = 0; k < 4; k++) { g.fillStyle(0x2a140a, 0.6); g.fillRect((r() - 0.5) * T * 0.8, (r() - 0.5) * T * 0.8, 1.5, 1.5); }
    }

    static auraTex(scene, style) {
        const key = 'vfx_aura2_' + style;
        if (scene.textures.exists(key)) return key;
        const N = 256, c = scene.textures.createCanvas(key, N, N), ctx = c.getContext(), h = N / 2;
        const g = ctx.createRadialGradient(h, h, 0, h, h, h);
        const stops = style === 'ring'
            ? [[0, 0], [0.72, 0], [0.9, 0.55], [0.96, 0.25], [1, 0]]
            : [[0, 0.04], [0.6, 0.07], [0.86, 0.2], [0.95, 0.1], [1, 0]];
        for (const [t, a] of stops) g.addColorStop(t, `rgba(255,255,255,${a})`);
        ctx.fillStyle = g; ctx.fillRect(0, 0, N, N);
        c.refresh();
        return key;
    }
    // Drawn on the floor under the darkness (depth 0.3) by default, so it only shows where the
    // room is lit and never glows out through the walls.
    // A puff of smoke, 64 x 64, white so it takes a tint (assets/art/fx_smoke, hand-drawn: a lumpy body, a soft stepped fringe)
    static smokeKey(scene) { return 'fx_smoke'; }
    static aura(scene, x, y, radius, color, { style = 'field', depth = 0.25, alpha = 1, breathe = true } = {}) {
        const img = scene.add.image(x, y, VisualFX.auraTex(scene, style))
            .setTint(color).setBlendMode(Phaser.BlendModes.ADD).setDepth(depth).setAlpha(alpha);
        img.setDisplaySize(radius * 2, radius * 2);
        VisualFX.clipAura(scene, img);
        if (breathe) scene.tweens.add({ targets: img, alpha: alpha * 0.55, duration: 1400, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
        return img;
    }
    // Keep an aura inside the room it stands in, so it doesn't spill into the void past the
    // walls. Call again after moving it (cheap: a lookup and a crop).
    static clipAura(scene, img) {
        const R = scene.rooms, TS = scene.TILE_SIZE;
        if (!R?.length || !TS || !img?.active) return;
        const tx = Math.floor(img.x / TS), ty = Math.floor(img.y / TS);
        const room = R.find(r => tx >= r.x && tx < r.x + r.w && ty >= r.y && ty < r.y + r.h);
        if (!room) { img.setCrop(); return; }
        const k = img.frame.width / img.displayWidth, x0 = img.x - img.displayWidth / 2, y0 = img.y - img.displayHeight / 2;
        const L = (room.x - 0.5) * TS, T = (room.y - 0.5) * TS, Rr = (room.x + room.w + 0.5) * TS, B = (room.y + room.h + 0.5) * TS;
        const cx = Math.max(0, (L - x0) * k), cy = Math.max(0, (T - y0) * k);
        img.setCrop(cx, cy, Math.max(0, (Rr - x0) * k - cx), Math.max(0, (B - y0) * k - cy));
    }
    // A ripple: a soft ring that grows from `from` to `to` px and fades.
    static ripple(scene, x, y, from, to, color, { depth = 1.2, duration = 700, alpha = 0.9 } = {}) {
        const img = scene.add.image(x, y, VisualFX.auraTex(scene, 'ring'))
            .setTint(color).setBlendMode(Phaser.BlendModes.ADD).setDepth(depth).setAlpha(alpha);
        img.setDisplaySize(from * 2, from * 2);
        const s = to / from;
        img.setDisplaySize(to * 2, to * 2); VisualFX.clipAura(scene, img); img.setDisplaySize(from * 2, from * 2);   // crop is in texture px: same at every scale
        scene.tweens.add({ targets: img, scaleX: img.scaleX * s, scaleY: img.scaleY * s, alpha: 0, duration, ease: 'Quad.easeOut', onComplete: () => img.destroy() });
        return img;
    }

    // The pipeline class, made and registered once per game (it needs Phaser's WebGL classes,
    // so it can't be declared at load time on a canvas-only build).
    static bloomPipeline(game) {
        const R = game.renderer, PF = Phaser.Renderer?.WebGL?.Pipelines?.PostFXPipeline;
        if (!PF || !R || R.type !== Phaser.WEBGL || !R.pipelines) return null;
        if (!VisualFX._bloomCls) {
            const head = '#ifdef GL_FRAGMENT_PRECISION_HIGH\nprecision highp float;\n#else\nprecision mediump float;\n#endif\n' +
                         'uniform sampler2D uMainSampler;\nvarying vec2 outTexCoord;\n';
            // 16 taps over the 4x4 block of the scene each quarter-res pixel covers, each tap
            // thresholded on its own so a thin bright line still counts.
            let taps = '';
            for (const y of [-1.5, -0.5, 0.5, 1.5]) for (const x of [-1.5, -0.5, 0.5, 1.5]) taps += `    s += tap(vec2(${x.toFixed(1)}, ${y.toFixed(1)}));\n`;
            const BRIGHT = '#define SHADER_NAME VFX_BLOOM_BRIGHT\n' + head +
                'uniform vec2 uTexel;\nuniform float uThreshold;\nuniform float uKnee;\n' +
                'vec3 tap(vec2 o) {\n    vec3 c = texture2D(uMainSampler, outTexCoord + o * uTexel).rgb;\n' +
                '    float m = max(c.r, max(c.g, c.b));\n    return c * smoothstep(uThreshold, uThreshold + uKnee, m);\n}\n' +
                'void main() {\n    vec3 s = vec3(0.0);\n' + taps + '    gl_FragColor = vec4(s / 16.0, 1.0);\n}\n';
            const BLUR = '#define SHADER_NAME VFX_BLOOM_BLUR\n' + head +
                'uniform vec2 uDir;\nvoid main() {\n' +
                '    vec4 c = texture2D(uMainSampler, outTexCoord) * 0.2270270;\n' +
                '    c += texture2D(uMainSampler, outTexCoord + uDir * 1.3846154) * 0.3162162;\n' +
                '    c += texture2D(uMainSampler, outTexCoord - uDir * 1.3846154) * 0.3162162;\n' +
                '    c += texture2D(uMainSampler, outTexCoord + uDir * 3.2307692) * 0.0702703;\n' +
                '    c += texture2D(uMainSampler, outTexCoord - uDir * 3.2307692) * 0.0702703;\n' +
                '    gl_FragColor = c;\n}\n';
            const COMBINE = '#define SHADER_NAME VFX_BLOOM_COMBINE\n' + head +
                'uniform sampler2D uBloom;\nuniform float uStrength;\nvoid main() {\n' +
                '    vec4 base = texture2D(uMainSampler, outTexCoord);\n' +
                '    vec3 b = texture2D(uBloom, outTexCoord).rgb * uStrength;\n' +
                '    gl_FragColor = vec4(base.rgb + b * (1.0 - base.rgb * 0.35), base.a);\n}\n';
            VisualFX._bloomCls = class VfxBloom extends PF {
                constructor(g) {
                    super({ game: g, name: 'VfxBloom', renderTarget: [{ scale: 1 }, { scale: 0.25 }, { scale: 0.25 }],
                            shaders: [{ name: 'bright', fragShader: BRIGHT }, { name: 'blur', fragShader: BLUR },
                                      { name: 'combine', fragShader: COMBINE }] });
                    this.strength = 1; this.threshold = 0.62; this.knee = 0.3;
                }
                onDraw(src) {
                    const [, a, b] = this.renderTargets, [sBright, sBlur, sCombine] = this.shaders, gl = this.gl;
                    if (!a || !b || !sCombine) { this.bindAndDraw(src); return; }
                    this.set2f('uTexel', 1 / src.width, 1 / src.height, sBright);
                    this.set1f('uThreshold', this.threshold, sBright);
                    this.set1f('uKnee', this.knee, sBright);
                    this.bindAndDraw(src, a, true, true, sBright);
                    for (const k of [1, 2]) {        // two blurs, the second wider
                        this.set2f('uDir', k / a.width, 0, sBlur);
                        this.bindAndDraw(a, b, true, true, sBlur);
                        this.set2f('uDir', 0, k / a.height, sBlur);
                        this.bindAndDraw(b, a, true, true, sBlur);
                    }
                    this.set1i('uBloom', 1, sCombine);
                    this.set1f('uStrength', this.strength, sCombine);
                    gl.activeTexture(gl.TEXTURE1);
                    gl.bindTexture(gl.TEXTURE_2D, a.texture);
                    this.bindAndDraw(src, undefined, true, true, sCombine);
                    gl.activeTexture(gl.TEXTURE1);
                    gl.bindTexture(gl.TEXTURE_2D, null);
                    gl.activeTexture(gl.TEXTURE0);
                }
            };
        }
        R.pipelines.addPostPipeline('VfxBloom', VisualFX._bloomCls);
        return VisualFX._bloomCls;
    }

    // The ice ult's frozen screen, a pass over the world camera (the HUD stays clear): frost creeps in from the edges, bending
    // and blurring what's under it like ice on glass, and the glass cracks out from the corners, every shard shifted a touch.
    // `grow` is how far the frost has crept (0..1), `crack` how far the cracks reach, `alpha` the whole thing (thawing).
    static iceScreenPipeline(game) {
        const R = game.renderer, PF = Phaser.Renderer?.WebGL?.Pipelines?.PostFXPipeline;
        if (!PF || !R || R.type !== Phaser.WEBGL || !R.pipelines) return null;
        if (!VisualFX._iceScreenCls) {
            const FRAG = `#define SHADER_NAME VFX_ICE_SCREEN
#ifdef GL_FRAGMENT_PRECISION_HIGH
precision highp float;
#else
precision mediump float;
#endif
uniform sampler2D uMainSampler; varying vec2 outTexCoord;
uniform float uGrow, uCrack, uAlpha, uTime; uniform vec2 uRes;
float h(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
vec2 h2(vec2 p) { return fract(sin(vec2(dot(p, vec2(127.1, 311.7)), dot(p, vec2(269.5, 183.3)))) * 43758.5453); }
float n(vec2 p) { vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
    return mix(mix(h(i), h(i + vec2(1.0, 0.0)), f.x), mix(h(i + vec2(0.0, 1.0)), h(i + vec2(1.0, 1.0)), f.x), f.y); }
float fbm(vec2 p) { float s = 0.0, a = 0.5; for (int i = 0; i < 5; i++) { s += a * n(p); p *= 2.03; a *= 0.5; } return s; }
// Voronoi: x = distance to the nearest cell edge, y = this cell's id, z = the id of the cell across that edge (the exact edge
// distance: a nearest pass, then its neighbours)
vec3 vor(vec2 x) {
    vec2 ip = floor(x), fp = fract(x), mg = vec2(0.0), mr = vec2(0.0); float md = 8.0, nb = 0.0;
    for (int j = -1; j <= 1; j++) for (int i = -1; i <= 1; i++) { vec2 g = vec2(float(i), float(j)), r = g + h2(ip + g) - fp; float d = dot(r, r); if (d < md) { md = d; mr = r; mg = g; } }
    md = 8.0;
    for (int j = -2; j <= 2; j++) for (int i = -2; i <= 2; i++) { vec2 g = mg + vec2(float(i), float(j)), r = g + h2(ip + g) - fp; vec2 e = r - mr;
        if (dot(e, e) > 0.00001) { float d = dot(0.5 * (mr + r), normalize(e)); if (d < md) { md = d; nb = h(ip + g); } } }
    return vec3(md, h(ip + mg), nb);
}
void main() {
    vec2 uv = outTexCoord, A = vec2(uRes.x / uRes.y, 1.0), p = uv * A;
    vec3 base = texture2D(uMainSampler, uv).rgb;
    if (uAlpha <= 0.0) { gl_FragColor = vec4(base, 1.0); return; }
    // the frost: in from the edges, furthest at the corners, its edge ragged
    float dx = min(uv.x, 1.0 - uv.x) * A.x, dy = min(uv.y, 1.0 - uv.y);
    vec2 c0 = vec2(uv.x < 0.5 ? 0.0 : A.x, uv.y < 0.5 ? 0.0 : 1.0);
    float zd = length(p - c0), edge = mix(min(dx, dy), length(vec2(dx, dy)), 0.3);   // to the nearest corner (the cracks); into the frame (the frost: all four edges, a little further at the corners)
    if (edge - 0.14 > uGrow * 0.13 + 0.03 && zd - 0.09 > uCrack * 0.27) { gl_FragColor = vec4(base, 1.0); return; }   // the clear middle: no frost, no cracks, nothing to work out
    float field = edge - fbm(p * 5.0) * 0.1 - fbm(p * 21.0) * 0.035;
    float reach = uGrow * 0.13, frost = smoothstep(reach, reach - 0.035, field), deep = smoothstep(reach, reach - 0.22, field);
    // the cracks: the ice round the nearest corner broken into shards, small by the corner and longer further out (sampling
    // at a scale that shrinks with distance stretches them outward), bent a little, each shard sitting a little off
    vec2 q = p - c0; float cid = c0.x * 3.0 + c0.y, k = 15.0 / (1.0 + zd * 7.0);
    vec3 v = vor(q * k + cid * 13.7 + (vec2(n(q * 7.0 + cid), n(q * 7.0 + cid + 5.2)) - 0.5) * 0.45 + (vec2(n(q * 30.0), n(q * 30.0 + 3.1)) - 0.5) * 0.03);
    float zone = smoothstep(uCrack * 0.27, uCrack * 0.27 - 0.05, zd - fbm(vec2(atan(q.y, q.x) * 3.0, cid)) * 0.08);
    float d = v.x / k, wide = mix(1.0, 0.6, smoothstep(0.0, 0.27, zd));   // thinner as they run out
    float line = smoothstep(0.0034 * wide, 0.0012 * wide, d) * zone, shade = smoothstep(0.008 * wide, 0.0025, d) * zone;
    vec2 shard = (h2(vec2(v.y * 91.0, cid)) - 0.5) * 0.006 * zone;
    // bent and blurred under the frost
    vec2 g = vec2(fbm(p * 8.0 + vec2(0.07, 0.0)) - fbm(p * 8.0 - vec2(0.07, 0.0)), fbm(p * 8.0 + vec2(0.0, 0.07)) - fbm(p * 8.0 - vec2(0.0, 0.07)));
    vec2 o = uv + g * 0.05 * frost + shard; float b = 0.0045 * frost;
    vec3 c = texture2D(uMainSampler, o).rgb * 0.36 + (texture2D(uMainSampler, o + vec2(b, 0.0)).rgb + texture2D(uMainSampler, o - vec2(b, 0.0)).rgb
        + texture2D(uMainSampler, o + vec2(0.0, b)).rgb + texture2D(uMainSampler, o - vec2(0.0, b)).rgb) * 0.16;
    vec3 ice = vec3(0.80, 0.92, 1.0);
    float feather = pow(1.0 - abs(fbm(p * 13.0) * 2.0 - 1.0), 7.0), fine = pow(1.0 - abs(fbm(p * 38.0 + 3.0) * 2.0 - 1.0), 12.0);
    c = mix(c, ice * 0.8, frost * (0.14 + 0.42 * deep));   // milky, thicker toward the edge
    c += ice * (feather * 0.28 + fine * 0.4) * frost * (0.5 + 0.5 * deep);        // frost ferns
    c += ice * smoothstep(0.025, 0.0, abs(field - reach)) * 0.35 * step(0.01, uGrow);   // the creeping edge catches light
    c += vec3(1.0) * step(0.985, h(floor(p * 260.0))) * frost * (0.5 + 0.5 * sin(uTime * 3.0 + h(floor(p * 260.0)) * 40.0));   // glints
    c = mix(c, c * 0.5, shade * 0.6);
    c = mix(c, vec3(0.94, 1.0, 1.0), line * 0.9);
    gl_FragColor = vec4(mix(base, c, uAlpha), 1.0);
}`;
            VisualFX._iceScreenCls = class VfxIceScreen extends PF {
                constructor(g) { super({ game: g, name: 'VfxIceScreen', fragShader: FRAG }); this.grow = 0; this.crack = 0; this.alpha = 0; }
                onPreRender() {
                    this.set1f('uGrow', this.grow); this.set1f('uCrack', this.crack); this.set1f('uAlpha', this.alpha);
                    this.set1f('uTime', this.game.loop.time / 1000); this.set2f('uRes', this.renderer.width, this.renderer.height);
                }
            };
        }
        R.pipelines.addPostPipeline('VfxIceScreen', VisualFX._iceScreenCls);
        return VisualFX._iceScreenCls;
    }

    _vfxQueueObj(o) { if (this._vfxQueue) this._vfxQueue.push(o); }
    _vfxFlush() {
        const q = this._vfxQueue;
        if (!q || !q.length) return;
        this._vfxQueue = [];
        for (const o of q) this._vfxSort(o);
    }
    // Which camera draws this. A container's children are left alone: the container decides.
    _vfxSort(o) {
        if (!o || !o.scene || o.parentContainer || o._vfxCam || !this._uiCam) return;
        const pinned = o.scrollFactorX === 0 && o.scrollFactorY === 0 && (o.depth || 0) >= 0;
        o._vfxCam = pinned ? 'hud' : 'world';
        (pinned ? this.cameras.main : this._uiCam).ignore(o);
        // Text in the world is drawn 1.5x by the zoom: render it at twice the density and
        // filter it smoothly, or it comes out blocky.
        if (!pinned && o.type === 'Text' && o.style) {   // (the hot paths create theirs at 2 already: no second render)
            if (o.style.resolution !== 2) o.setResolution(2);
            o.texture?.setFilter?.(Phaser.Textures.FilterMode.LINEAR);
        }
    }
    // Phaser batches every object on the list each frame, on screen or not. World objects well outside the view are
    // hidden from the world camera alone (its bit in cameraFilter, which nothing else of ours uses), so nothing that
    // reads .visible notices. Graphics, emitters and the like are left alone: their x, y says nothing about where they draw.
    _vfxCull() {
        const cam = this.cameras.main, v = cam.worldView, bit = cam.id, M = 96;
        if (!bit || !v.width) return;
        const l = v.x - M, r = v.right + M, t = v.y - M, b = v.bottom + M;
        for (const o of this.children.list) {
            if (o._vfxCam !== 'world' || o.scrollFactorX !== 1) continue;
            const ty = o.type;
            if (ty !== 'Sprite' && ty !== 'Image' && ty !== 'Container' && ty !== 'Text' && ty !== 'Rectangle' && ty !== 'Ellipse' && ty !== 'Arc' && !o._vfxBox) continue;
            let x0, x1, y0, y1;
            if (o._vfxBox) [x0, y0, x1, y1] = o._vfxBox;   // a chunk of the floor (blitChunks): it spans rooms, so fog doesn't hide it
            else if (ty === 'Container') {   // only small ones gathered round their own spot (a wide one at 0,0 is never culled)
                if (o.list.length > 8) continue;
                let m = 0; for (const c of o.list) m = Math.max(m, Math.abs(c.x) + Math.abs(c.displayWidth || 0), Math.abs(c.y) + Math.abs(c.displayHeight || 0));
                if (m > 200) continue;
                const e = (m + 32) * Math.max(Math.abs(o.scaleX), Math.abs(o.scaleY));
                x0 = o.x - e; x1 = o.x + e; y0 = o.y - e; y1 = o.y + e;
            } else {
                const w = Math.abs(o.displayWidth || 0), h = Math.abs(o.displayHeight || 0);
                x0 = o.x - (o.originX ?? 0.5) * w; x1 = x0 + w; y0 = o.y - (o.originY ?? 0.5) * h; y1 = y0 + h;
            }
            const out = x1 < l || x0 > r || y1 < t || y0 > b || (!o._vfxBox && this._fogHides((x0 + x1) / 2, (y0 + y1) / 2));   // off screen, or in a room still under fog
            if (out !== !!o._vfxCulled) { o._vfxCulled = out; if (out) o.cameraFilter |= bit; else o.cameraFilter &= ~bit; }
        }
    }
    // ROOM FOG: in a level of rooms, a room you haven't reached yet lies under smoke, what's in it unseen (and not drawn:
    // _vfxCull). Coming within FOG_NEAR tiles of it lifts its fog for good. Not the Tower or the Training Ground: one room.
    // Each room's fog: a dark core, its edge two rings of soft smoke puffs spilling past the room, pale wisps drifting over it.
    // The puffs are painted once into the room's own texture (they were most of what a level drew: ~190 a room, 570 sprites
    // a frame in the Cistern's first view), which breathes slowly as a whole; lifting, they're made for real for the moment
    // and roll outward, thinning away, and the texture goes.
    _fogUpdate(time) {
        if (this.towerRun || this.trainingRun || !this.rooms?.length || !this.player) return;
        const T = this.TILE_SIZE, NEAR = 2, DARK = 0x05060a;
        if (!this._fog) {
            const key = VisualFX.smokeKey(this), stamp = this._fogStamp = (this._fogStamp || 0) + 1;
            const brush = this.make.image({ x: 0, y: 0, key }, false).setTint(DARK);   // (each puff painted with it into its room's texture; never on the scene itself)
            this._fog = this.rooms.map((r, i) => {
                const x0 = (r.x - 0.5) * T, y0 = (r.y - 2) * T, x1 = (r.x + r.w + 0.5) * T, y1 = (r.y + r.h + 0.5) * T;   // (up over its wall's face too)
                const c = this.add.container(0, 0).setDepth(4.95), puffs = [];
                const core = this.add.graphics();
                core.fillStyle(DARK, 0.97).fillRect(x0 + T * 1.6, y0 + T * 1.6, x1 - x0 - T * 3.2, y1 - y0 - T * 3.2);
                c.add(core);
                const W = x1 - x0, H = y1 - y0;
                for (const [inset, gap, size] of [[T * 0.4, 0.7, 3.2], [T * 1.7, 1.1, 4.2]]) {   // two rings of puffs: the ragged edge, and one further in to hide where the core starts
                const per = 2 * (W + H - 4 * inset), n = Math.ceil(per / (T * gap)), bx0 = x0 + inset, by0 = y0 + inset, bx1 = x1 - inset, by1 = y1 - inset, BW = bx1 - bx0, BH = by1 - by0;
                for (let k = 0; k < n; k++) {
                    let d = (k + Math.random() * 0.6) / n * per, x, y;
                    if (d < BW) { x = bx0 + d; y = by0; } else if ((d -= BW) < BH) { x = bx1; y = by0 + d; } else if ((d -= BH) < BW) { x = bx1 - d; y = by1; } else { d -= BW; x = bx0; y = by1 - d; }
                    const ox = (x0 + x1) / 2 - x, oy = (y0 + y1) / 2 - y, ol = Math.hypot(ox, oy) || 1, j = (Math.random() - 0.5) * T * 1.1;
                    const sc = (size * (0.75 + Math.random() * 0.5)) * T / 64;
                    puffs.push({ x: x + ox / ol * j, y: y + oy / ol * j, sx: sc * (0.9 + Math.random() * 0.25), sy: sc, rot: Math.floor(Math.random() * 4) * Math.PI / 2, ox: -ox / ol, oy: -oy / ol });   // (turned only by quarters: it's drawn in pixels)
                }
                }
                // a puff that would billow into another room shrinks to stop at its edge, or goes if it sits in it: fog is its own room's
                const others = this.rooms.filter(o => o !== r);
                for (let k = puffs.length - 1; k >= 0; k--) {
                    const p = puffs[k];
                    let room = Infinity;
                    for (const o of others) room = Math.min(room, Math.hypot(Math.max(o.x * T - p.x, 0, p.x - (o.x + o.w) * T), Math.max(o.y * T - p.y, 0, p.y - (o.y + o.h) * T)));
                    const reach = 64 * p.sx * 0.48;   // how far its smoke shows from its middle
                    if (room >= reach) continue;
                    if (room < reach * 0.3) { puffs.splice(k, 1); continue; }
                    p.sx *= room / reach; p.sy *= room / reach;
                }
                // painted into the room's texture (with room round the edge for the breathing)
                let bx0 = Infinity, by0 = Infinity, bx1 = -Infinity, by1 = -Infinity;
                for (const p of puffs) { const hw = 32 * Math.max(p.sx, p.sy) * 1.45; bx0 = Math.min(bx0, p.x - hw); by0 = Math.min(by0, p.y - hw); bx1 = Math.max(bx1, p.x + hw); by1 = Math.max(by1, p.y + hw); }
                let img = null, tkey = null;
                if (puffs.length) {
                    bx0 = Math.floor(bx0); by0 = Math.floor(by0);
                    tkey = `fog_${stamp}_${i}`;
                    const dt = this.textures.addDynamicTexture(tkey, Math.ceil(bx1 - bx0), Math.ceil(by1 - by0));
                    dt.beginDraw();
                    for (const p of puffs) dt.batchDraw(brush.setScale(p.sx, p.sy).setRotation(p.rot), p.x - bx0, p.y - by0);
                    dt.endDraw();
                    img = this.add.image((bx0 + bx1) / 2, (by0 + by1) / 2, tkey);
                    c.add(img);
                }
                const wisps = [], wt = [];
                for (let k = 0; k < Math.max(2, Math.round(r.w * r.h / 30)); k++) {   // pale wisps drifting over it
                    const w = this.add.image(x0 + T + Math.random() * (W - 2 * T), y0 + T + Math.random() * (H - 2 * T), key).setTint(0x30323a).setAlpha(0.1 + Math.random() * 0.08)
                        .setScale((3 + Math.random() * 3) * T / 64, (1.6 + Math.random() * 1.4) * T / 64);
                    wt.push(this.tweens.add({ targets: w, x: w.x + (Math.random() < 0.5 ? -1 : 1) * T * (1 + Math.random() * 1.5), duration: 5000 + Math.random() * 4000, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' }));
                    wisps.push(w);
                }
                c.add(wisps);
                this._vfxSort?.(c);
                return { r, c, core, img, tkey, puffs, wisps, wt, ph: Math.random() * 6.28, x0, y0, x1, y1, lifted: false };
            });
            brush.destroy();
            const fogs = this._fog;
            this.events.once('shutdown', () => { for (const f of fogs) if (f.tkey && this.textures.exists(f.tkey)) this.textures.remove(f.tkey); });   // (textures outlive a scene)
        }
        const px = this.playerX, py = this.playerY, v = this.cameras.main.worldView;
        for (const f of this._fog) {
            if (f.lifted) continue;
            const r = f.r;
            if (px >= r.x - NEAR && px < r.x + r.w + NEAR && py >= r.y - NEAR && py < r.y + r.h + NEAR) {   // close enough: it lifts, rolling away
                f.lifted = true;
                this.tweens.killTweensOf(f.wisps);
                this.tweens.add({ targets: [f.core, ...f.wisps], alpha: 0, duration: 700, ease: 'Quad.easeOut' });
                const key = VisualFX.smokeKey(this);   // its puffs, made for real now, take over from the texture and roll out
                f.img?.setVisible(false);
                for (const p of f.puffs) {
                    const o = this.add.image(p.x, p.y, key).setTint(DARK).setScale(p.sx, p.sy).setRotation(p.rot);
                    f.c.add(o);
                    this.tweens.add({ targets: o, x: p.x + p.ox * T * (1 + Math.random() * 1.5), y: p.y + p.oy * T * (1 + Math.random() * 1.5), scaleX: p.sx * 1.6, scaleY: p.sy * 1.6, alpha: 0,
                        duration: 900 + Math.random() * 500, delay: Math.random() * 200, ease: 'Quad.easeOut' });
                }
                if (!f.c.visible) f.c.setVisible(true);
                this.time.delayedCall(1700, () => { f.c.destroy(); if (f.tkey && this.textures.exists(f.tkey)) this.textures.remove(f.tkey); });
                continue;
            }
            const off = f.x1 < v.x - T * 3 || f.x0 > v.right + T * 3 || f.y1 < v.y - T * 3 || f.y0 > v.bottom + T * 3;   // (puffs spill ~2.2 tiles past the room)
            if (f.c.visible === off) { f.c.setVisible(!off); for (const t of f.wt) off ? t.pause() : t.resume(); }   // off screen it isn't drawn (_vfxCull skips big containers), its wisps still
            if (off) continue;
            f.img?.setScale(1 + 0.012 * Math.sin(time * 0.0012 + f.ph));   // on screen: the whole of it breathes
        }
    }
    // Is (x, y) inside a room still under fog?
    _fogHides(x, y) {
        const F = this._fog;
        if (!F) return false;
        for (const f of F) if (!f.lifted && x >= f.x0 && x < f.x1 && y >= f.y0 && y < f.y1) return true;
        return false;
    }
    _vfxUnsort(o) {
        if (o && o.parentContainer && o._vfxCam) { o.cameraFilter = 0; o._vfxCam = null; }
    }
    _vfxFadeOut(cam, fx, duration, r, g, b) { this._uiCam?.fadeOut(duration, r, g, b); }
    _vfxFadeIn(cam, fx, duration, r, g, b) { this._uiCam?.fadeIn(duration, r, g, b); }

    // Pointer -> the coordinates the game passes around. Everything downstream turns them into
    // world coordinates by adding cameras.main.scrollX/Y, which was only exact at zoom 1. Taken
    // through the zoom here, the same sum still lands on the world point under the cursor.
    // (Computed from scroll and zoom rather than getWorldPoint, whose matrix only updates when
    // a frame renders.)
    _aim(pointer) {
        const c = this.cameras.main, ox = c.width * c.originX, oy = c.height * c.originY;
        return { x: ox + (pointer.x - c.x - ox) / c.zoom, y: oy + (pointer.y - c.y - oy) / c.zoom };
    }
    // World -> screen, for things pinned to the screen at a world point (pickup text, sparks).
    _scrX(wx) { const c = this.cameras.main, o = c.width * c.originX; return c.x + o + (wx - c.scrollX - o) * c.zoom; }
    _scrY(wy) { const c = this.cameras.main, o = c.height * c.originY; return c.y + o + (wy - c.scrollY - o) * c.zoom; }

    // Every frame, from GameScene.update().
    _vfxUpdate(time, delta) {
        if (!this._uiCam) return;
        const cam = this.cameras.main;
        if (this._void?.active) {
            this._void.tilePositionX = cam.scrollX * 0.22;
            this._void.tilePositionY = cam.scrollY * 0.22;
        }
        this._vfxUpdateLight(time);
        this._vfxPerfWatch(time, delta);
        this._fogUpdate(time);
        this._vfxCull();
        this._vfxUpdateShadows();
        this._vfxUpdateTorches(time);
        this._vfxUpdateRune(delta);
        this._vfxTrails();
        this._vfxTileFx(time, delta);
        this._vfxDrawHud();
    }

    // Every projectile leaves a short glowing wake in its colour.
    _vfxTrails() {
        const tr = this._vfxTrail;
        if (!tr) return;
        for (const f of this.fireballs || []) {
            const s = f.sprite;
            if (s?.active) (f._isSupernova ? tr.cosmic : tr.fire).emitParticleAt(s.x, s.y, 1);
        }
        for (const s of this.iceShards || []) if (s.sprite?.active && !s.isCannonShard) tr.ice.emitParticleAt(s.sprite.x, s.sprite.y, 1);   // (an icicle lays its own tail of frost: a dot a frame over it was a string of beads)
        for (const o of this.lightningOrbs || []) {
            const q = o.sprite || o.gfx || o.container || o;
            if (q && q.active !== false && q.x !== undefined) tr.lightning.emitParticleAt(q.x, q.y, 1);
        }
        if (this._bfxOn) this._bfxTrails?.();   // Bosses.js: every enemy shot in its own colour
        else for (const e of this.enemyProjectiles || []) {
            const q = e.gfx || e.sprite;
            if (q?.active) tr.enemy.emitParticleAt(q.x, q.y, 1);
        }
        const bh = this.cosmicBlackHoleProjectile;
        if (bh?.active) tr.cosmic.emitParticleAt(bh.x, bh.y, 2);
    }

    // ── TEXTURES ─────────────────────────────────────────────────────────────
    // One shared canvas atlas for every tile frame. Frames are painted the first time a level
    // asks for them and kept for the rest of the session.
    _vfxAtlas() {
        const tm = this.textures;
        if (tm.exists('vfx_atlas')) return tm.get('vfx_atlas');
        const a = tm.createCanvas('vfx_atlas', 2048, 1024);   // (it keeps every frame for the session: about 1000 once every level's been seen)
        a._vfxNext = 0;
        return a;
    }
    // Each frame sits in a gutter of G pixels copied out from its own edge: a GPU sampling a hair past a tile's edge (the 1.5x
    // zoom, a fractional scroll) picks up that tile's own edge, not the next frame's, which drew a seam along every row.
    _vfxFrame(name, paint) {
        const a = this._vfxAtlas();
        if (a.has(name)) return name;
        const T = this.TILE_SIZE, G = 2, C = T + G * 2, cols = Math.floor(a.width / C), rows = Math.floor(a.height / C);
        const i = a._vfxNext++;
        if (i >= cols * rows) return a.has('f0') ? 'f0' : '__BASE';
        const x = (i % cols) * C + G, y = Math.floor(i / cols) * C + G;
        // painted on a scratch canvas and the gutter filled pixel by pixel there (a canvas drawn onto itself stalls Chrome:
        // a GPU sync each time, a minute and more over a level's frames), then put into the atlas in one go
        const S = VisualFX._frameCanvas ||= document.createElement('canvas'); S.width = C; S.height = C;   // (resizing clears it)
        const sc = S.getContext('2d', { willReadFrequently: true });
        paint(sc, G, G, T);
        const img = sc.getImageData(0, 0, C, C), d = img.data;
        const copy = (fx, fy, tx, ty) => { const f = (fy * C + fx) * 4, t = (ty * C + tx) * 4; d[t] = d[f]; d[t + 1] = d[f + 1]; d[t + 2] = d[f + 2]; d[t + 3] = d[f + 3]; };
        for (let k = 0; k < C; k++) {
            const e = Math.min(G + T - 1, Math.max(G, k));   // the nearest frame pixel along the edge (the corners take the corner)
            for (let g = 0; g < G; g++) { copy(e, G, k, g); copy(e, G + T - 1, k, G + T + g); copy(G, e, g, k); copy(G + T - 1, e, G + T + g, k); }
        }
        a.getContext().putImageData(img, x - G, y - G);
        a.add(name, 0, x, y, T, T);
        a._vfxDirty = true;
        return name;
    }
    // A small seeded random, so a frame paints the same way every time.
    _vfxRng(seed) {
        let s = (seed >>> 0) || 1;
        return () => { s = (s + 0x6D2B79F5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
    }

    // The soft round textures: light (erases the shade), glow (tinted, additive), dot (dust). (The void behind the menus is
    // assets/art/vfx_void, hand-placed stars.)
    _vfxSoftTextures() {
        const tm = this.textures;
        const radial = (key, size, stops, rgb = '255,255,255') => {
            if (tm.exists(key)) return;
            const t = tm.createCanvas(key, size, size), ctx = t.getContext(), h = size / 2;
            const g = ctx.createRadialGradient(h, h, 0, h, h, h);
            for (const [at, a] of stops) g.addColorStop(at, `rgba(${rgb},${a})`);
            ctx.fillStyle = g; ctx.fillRect(0, 0, size, size);
            t.refresh();
            t.setFilter(Phaser.Textures.FilterMode.LINEAR);
        };
        radial('vfx_light', 128, [[0, 1], [0.35, 0.85], [0.7, 0.32], [1, 0]]);
        radial('vfx_glow', 128, [[0, 0.9], [0.25, 0.55], [0.6, 0.16], [1, 0]]);
        radial('vfx_dot', 8, [[0, 1], [0.5, 0.6], [1, 0]]);
        radial('vfx_shadow', 64, [[0, 0.75], [0.55, 0.45], [1, 0]], '0,0,0');
        if (!tm.exists('vfx_edge')) {      // clear in the middle, solid at the rim (tinted red by the HUD)
            const S = 256, t = tm.createCanvas('vfx_edge', S, S), ctx = t.getContext();
            const g = ctx.createRadialGradient(S / 2, S / 2, S * 0.3, S / 2, S / 2, S * 0.72);
            g.addColorStop(0, 'rgba(255,255,255,0)'); g.addColorStop(0.6, 'rgba(255,255,255,0.35)'); g.addColorStop(1, 'rgba(255,255,255,1)');
            ctx.fillStyle = g; ctx.fillRect(0, 0, S, S);
            t.refresh(); t.setFilter(Phaser.Textures.FilterMode.LINEAR);
        }
        if (!tm.exists('vfx_flame')) {     // a teardrop, white-hot at the base (tinted by whoever uses it)
            const W = 16, H = 24, t = tm.createCanvas('vfx_flame', W, H), ctx = t.getContext();
            for (let y = 0; y < H; y++) {
                for (let x = 0; x < W; x++) {
                    const dx = (x + 0.5 - W / 2) / 6.5, dy = (y + 0.5 - 17) / (y < 17 ? 15 : 6);
                    const d = Math.sqrt(dx * dx * (1 + Math.max(0, -dy) * 0.9) + dy * dy);
                    if (d >= 1) continue;
                    const a = Math.pow(1 - d, 1.4);
                    ctx.fillStyle = `rgba(255,${Math.round(200 + 55 * (1 - d))},${Math.round(150 + 105 * (1 - d))},${a.toFixed(3)})`;
                    ctx.fillRect(x, y, 1, 1);
                }
            }
            t.refresh(); t.setFilter(Phaser.Textures.FilterMode.LINEAR);
        }
        if (!tm.exists('vfx_ring')) {      // a thin soft ring, for impacts and spawns
            const S = 64, t = tm.createCanvas('vfx_ring', S, S), ctx = t.getContext(), h = S / 2;
            const g = ctx.createRadialGradient(h, h, h * 0.62, h, h, h);
            g.addColorStop(0, 'rgba(255,255,255,0)'); g.addColorStop(0.55, 'rgba(255,255,255,1)'); g.addColorStop(1, 'rgba(255,255,255,0)');
            ctx.fillStyle = g; ctx.fillRect(0, 0, S, S);
            t.refresh(); t.setFilter(Phaser.Textures.FilterMode.LINEAR);
        }
        if (!tm.exists('vfx_splat')) {     // a stain: a blob and a few droplets
            const S = 40, t = tm.createCanvas('vfx_splat', S, S), ctx = t.getContext(), R = VisualFX.prototype._vfxRng(29);
            ctx.fillStyle = '#ffffff';
            const blob = (x, y, r) => { ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill(); };
            blob(20, 20, 8);
            for (let i = 0; i < 6; i++) { const a = R() * Math.PI * 2, d = 5 + R() * 6; blob(20 + Math.cos(a) * d, 20 + Math.sin(a) * d, 3 + R() * 3); }
            for (let i = 0; i < 7; i++) { const a = R() * Math.PI * 2, d = 12 + R() * 6; blob(20 + Math.cos(a) * d, 20 + Math.sin(a) * d, 1 + R() * 1.5); }
            t.refresh();
        }
    }

    // ── WORLD ────────────────────────────────────────────────────────────────
    // Replaces WorldGen.renderWorld for the main game (TD keeps its own). One image per tile,
    // all from the atlas so they batch into a handful of draws.
    _vfxRenderWorld({ decals = true } = {}) {
        this._vfxSoftTextures();
        const W = this.world, T = this.TILE_SIZE, FL = this.FLOOR, WL = this.WALL;
        const ww = this.WORLD_WIDTH, wh = this.WORLD_HEIGHT;
        const at = (x, y) => (x < 0 || y < 0 || x >= ww || y >= wh) ? 0 : W[x][y];
        const fl = (x, y) => at(x, y) === FL;
        const C = this._vfxCfg(), TH = this._vfxTheme();
        const torchSpots = [], decalList = [];
        // Every tile is a Bob in a Blitter: thousands of plain quads from one texture cost far
        // less to draw than an Image each, and none of them ever moves.
        const atl = this._vfxAtlas();   // the Blitter takes its texture now: it has to exist first
        // a new level starts the atlas over once it's half full (every level seen in one session filled it, and a full atlas
        // handed out its whole sheet as a tile: the mosaic after the Gauntlet). Nothing from the last level is still drawn.
        if (atl._vfxNext > 1300) { for (const k of Object.keys(atl.frames)) if (k !== '__BASE') atl.remove(k); atl._vfxNext = 0; }
        const bob = VisualFX.blitChunks(this, b => b);
        const lift = [];
        // mostly pebbles and bones; a skull is rarer (it catches the eye)
        const DECAL_PICK = this._vfxTileArt?.()?.PICK || [];   // (each level's own clutter: TILESETS)
        // The Cistern's space between rooms is open deep water (MenuArt.cistern: the drowned hall
        // and what swims in it), not rock: leave it unpainted there so the backdrop shows. The same
        // on a floor open to the sky (the Gauntlet's roof: MenuArt.stormSky).
        const openWater = !!this.isLevel6 || !!this._floorPlan?.()?.sky;
        for (let x = 0; x < ww; x++) {
            for (let y = 0; y < wh; y++) {
                const fr = this._vfxTileFrame(x, y), h = fr.h, m = fr.m;
                if (openWater && fr.kind === 'rock') continue;
                if (fr.kind === 'floor') {
                    // a cobweb where two walls meet above it, now and then something on the floor
                    if ((m & 1) && (m & 8) && (h >>> 11) % 100 < C.WEBS) decalList.push([x, y, 'dc_web', 1]);
                    else if ((m & 1) && (m & 2) && (h >>> 11) % 100 < C.WEBS) decalList.push([x, y, 'dc_web', -1]);
                    else if (!m && (h >>> 17) % 100 < C.DECALS) decalList.push([x, y, DECAL_PICK[(h >>> 23) % DECAL_PICK.length], (h >>> 5) & 3]);
                }
                // a straight stretch of wall facing a room: somewhere to hang a torch
                if (fr.kind === 'face' && at(x - 1, y) === WL && at(x + 1, y) === WL && fl(x - 1, y + 1) && fl(x + 1, y + 1) && fl(x, y + 2)
                    && (h >>> 7) % C.TORCH_EVERY === 0) torchSpots.push([x, y, h]);
                if (fr.lift) lift.push([x, y, fr.lift]);
                const tint = fr.kind === 'floor' ? TH.floor : TH.wall;
                if (tint !== 0xffffff) bob(x, y, fr.frame).setTint(tint); else bob(x, y, fr.frame);
            }
        }
        this._vfxWallLift?.(lift, TH.wall);
        if (decals) this._vfxPlaceDecals(decalList, TH);
        this._vfxPlaceTorches(torchSpots, TH);
        // Frames painted now for things that appear later, so the atlas uploads once.
        for (let v = 0; v < 4; v++) {
            this._vfxFrame(`water${v}`, (ctx, X, Y, S) => this._vfxPaintWater(ctx, X, Y, S, v, false));
            this._vfxFrame(`waterhl${v}`, (ctx, X, Y, S) => this._vfxPaintWater(ctx, X, Y, S, v, true));
            this._vfxFrame(`ice${v}`, (ctx, X, Y, S) => this._vfxPaintIce(ctx, X, Y, S, v));
            this._vfxFrame(`sludge${v}`, (ctx, X, Y, S) => this._vfxPaintSludge(ctx, X, Y, S, v));
            this._vfxFrame(`fog${v}`, (ctx, X, Y, S) => this._vfxPaintFog(ctx, X, Y, S, v));
        }
        this._vfxFrame('ward_v', (ctx, X, Y, S) => this._vfxPaintWard(ctx, X, Y, S, true));
        this._vfxFrame('ward_h', (ctx, X, Y, S) => this._vfxPaintWard(ctx, X, Y, S, false));
        const a = this._vfxAtlas();
        if (a._vfxDirty) { a.refresh(); a._vfxDirty = false; }
    }

    // What tile (x, y) looks like as the world stands now, and its atlas frame. The bosses call
    // this too when they reshape the map. Walls are drawn two tiles tall in 3/4 view: the extra
    // height goes on the tile ABOVE a wall that has floor below it, never on floor, so what you
    // see still matches what you collide with.
    //   floor  walkable stone (m: what isn't floor around it, for its contact shadow)
    //   face   a wall with floor below: the lower half of the brick face
    //   upper  whatever is above a face (wall or rock): the upper half, with the cap on top
    //   cap    any other wall, or the rock beside an upper face that tops a side wall
    //   rock   everything else
    // lift: the frame of its lines for the copy above the shade (null: nothing to lift).
    _vfxTileFrame(x, y) {
        const W = this.world, FL = this.FLOOR, WL = this.WALL, ww = this.WORLD_WIDTH, wh = this.WORLD_HEIGHT;
        const P = this._vfxCfg().WALL;
        const at = (a, b) => (a < 0 || b < 0 || a >= ww || b >= wh) ? 0 : W[a][b];
        const fl = (a, b) => at(a, b) === FL;
        const isFace = (a, b) => at(a, b) === WL && fl(a, b + 1);
        const kind = (a, b) => {
            const t = at(a, b);
            if (t === FL) return 'floor';
            if (isFace(a, b)) return 'face';
            if (isFace(a, b + 1)) return 'upper';
            if (t === WL || (at(a, b + 1) === WL && (isFace(a - 1, b + 1) || isFace(a + 1, b + 1)))) return 'cap';
            return 'rock';
        };
        // 8 neighbours: N E S W NE SE SW NW
        const mask = test =>
            (test(x, y - 1) ? 1 : 0) | (test(x + 1, y) ? 2 : 0) | (test(x, y + 1) ? 4 : 0) | (test(x - 1, y) ? 8 : 0) |
            (test(x + 1, y - 1) ? 16 : 0) | (test(x + 1, y + 1) ? 32 : 0) | (test(x - 1, y + 1) ? 64 : 0) | (test(x - 1, y - 1) ? 128 : 0);
        let h = (x * 374761393 + y * 668265263) >>> 0; h = Math.imul(h ^ (h >>> 13), 1274126177); h = (h ^ (h >>> 16)) >>> 0;
        const k = kind(x, y), A = this._vfxTileArt?.(), pre = A ? A.key + '_' : '';   // (the atlas lasts the session: a level with its own tiles names its own frames)
        if (k === 'floor') {
            // Mostly whole slabs (calm under the fighting), some split ones, the odd crack or moss;
            // a rune in about one tile in ninety.
            const PICK = [0, 0, 1, 1, 2, 2, 3, 3, 4, 4, 5, 6, 7, 8, 9, 10];
            const v = ((h >>> 9) % 89 === 0) ? 11 : PICK[(h >>> 3) % PICK.length];
            const m = mask((a, b) => !fl(a, b));
            return { kind: k, floor: true, h, m, frame: this._vfxFrame(`${pre}f${v}_${m}`, (ctx, X, Y, S) => this._vfxPaintFloor(ctx, X, Y, S, v, m)), lift: null };
        }
        if (k === 'rock') {
            const v = h % 4;
            return { kind: k, h, m: 0, frame: this._vfxFrame(`rk${v}`, (ctx, X, Y, S) => VisualFX.paintRock(ctx, X, Y, S, v, this.textures)), lift: null };
        }
        const m = mask(fl), vm = mask((a, b) => kind(a, b) === 'rock');
        const wall = (name, opts) => this._vfxFrame(opts.linesOnly ? name : pre + name, (ctx, X, Y, S) => VisualFX.paintWall(ctx, X, Y, S, m, vm, P, { ...opts, art: A }));
        if (k === 'face' || k === 'upper') {
            const upper = k === 'upper', v = h % 4, tag = upper ? 'wu' : 'wf';
            return { kind: k, face: true, h, m, vm, frame: wall(`${tag}${v}_${m}_${vm}`, { face: true, upper, v }),
                     lift: (upper || (m & 1)) ? wall(`${tag}l_${m}_${vm}`, { face: true, upper, linesOnly: true }) : null };
        }
        const v = h % 3;
        return { kind: k, h, m, vm, frame: wall(`wt${v}_${m}_${vm}`, { face: false, v }),
                 lift: m ? wall(`wc_${m}_${vm}`, { face: false, linesOnly: true }) : null };
    }

    // Floor variants (each level's sheet, row 0; the stone's in this order): 0-3 a whole slab, 4-5 a slab over two, 6 four
    // squares, 7 staggered, 8 a cracked slab, 9 three planks, 10 a mossy slab, 11 a slab with a rune.
    _vfxPaintFloor(ctx, X, Y, T, v, m) {
        const A = this._vfxTileArt?.();
        ctx.clearRect(X, Y, T, T);
        if (A) ctx.drawImage(A.img, A.FLOOR[v] * 24, 0, 24, 24, X, Y, T, T);
        this._vfxPaintAO(ctx, X, Y, T, m);
    }

    // Where the floor meets a wall: the shade the wall casts. Deepest under a brick face (wall
    // to the north), a thin band beside side walls. m: what isn't floor around it.
    _vfxPaintAO(ctx, X, Y, T, m) {
        const P = this._vfxCfg().WALL;
        const band = (x, y, w, h, a) => { ctx.fillStyle = `rgba(0,0,0,${a.toFixed(3)})`; ctx.fillRect(X + x, Y + y, w, h); };
        if (m & 1) for (let i = 0; i < P.SHADOW; i++) band(0, i, T, 1, 0.5 * (1 - i / P.SHADOW));
        if (m & 8) for (let i = 0; i < P.SIDE_SHADOW; i++) band(i, 0, 1, T, 0.3 * (1 - i / P.SIDE_SHADOW));
        if (m & 2) for (let i = 0; i < P.SIDE_SHADOW; i++) band(T - 1 - i, 0, 1, T, 0.3 * (1 - i / P.SIDE_SHADOW));
        // the corner where a face's shadow meets a side wall's
        if (!(m & 1) && (m & 128)) for (let i = 0; i < P.SIDE_SHADOW; i++) band(0, i, P.SIDE_SHADOW - i, 1, 0.3 * (1 - i / P.SIDE_SHADOW));
        if (!(m & 1) && (m & 16)) for (let i = 0; i < P.SIDE_SHADOW; i++) band(T - P.SIDE_SHADOW + i, i, P.SIDE_SHADOW - i, 1, 0.3 * (1 - i / P.SIDE_SHADOW));
    }

    // A wall in 3/4 view. Static, so tower defense and the bosses paint the same walls.
    // m: the floor around it, vm: the rock around it (N E S W NE SE SW NW = 1 2 4 8 16 32 64 128).
    //   face   brick, two tiles tall: the lower half (floor below it, a baseboard where they
    //          meet) and the upper half (upper: true) with CAP_STRIP px of cap and a lit lip on
    //          top. Rows are counted from the floor so they run on across the two tiles. A face
    //          with floor straight above (a wall one tile thick) carries the cap strip itself.
    //   cap    dark rock with a lit rim along every side that meets floor, a joint where floor
    //          touches only a corner, and a dark edge where it meets open rock.
    // linesOnly: just the rims and the lip, on a clear tile (the copy lifted above the shade).
    static paintWall(ctx, X, Y, T, m, vm, P, { face = false, upper = false, v = 0, linesOnly = false, art = null } = {}) {
        const px = (x, y, w, h, c) => { ctx.fillStyle = c; ctx.fillRect(X + x, Y + y, w, h); };
        const shade = (x, y, w, h, a) => { ctx.fillStyle = `rgba(0,0,0,${a})`; ctx.fillRect(X + x, Y + y, w, h); };
        const N = m & 1, E = m & 2, Wf = m & 8, Rm = P.RIM;
        ctx.clearRect(X, Y, T, T);
        const capH = face ? ((upper || N) ? P.CAP_STRIP : 0) : T;
        if (!linesOnly && capH && art) ctx.drawImage(art.img, art.CAP[0] * 24, art.CAP[1] * 24, 24, capH, X, Y, T, capH);   // (the sheet's wall top)
        if (!linesOnly && capH) {
            // where the cap meets open rock: a dark edge, so the wall's thickness reads
            if (vm & 1) px(0, 0, T, 1, P.edge);
            if (!face && (vm & 4)) px(0, T - 1, T, 1, P.edge);
            if (vm & 8) px(0, 0, 1, capH, P.edge);
            if (vm & 2) px(T - 1, 0, 1, capH, P.edge);
        }
        if (face) {
            if (!linesOnly && art) {   // the sheet's face, two tiles tall: the upper tile its top half, this its foot
                ctx.drawImage(art.img, (v === 3 ? 24 : 0), art.FACE_Y + (upper ? 0 : 24) + capH, 24, 24 - capH, X, Y + capH, T, T - capH);   // (its second face, cracked or vented, one wall in four)
                // an open side (a pillar's corner, the end of a wall): its edge turns away into shade
                if (Wf) shade(0, capH, 2, T - capH, 0.35);
                if (E) shade(T - 2, capH, 2, T - capH, 0.35);
            }
            if (capH) px(0, capH, T, 1, P.lip);                               // the lip, where cap turns into face
            if (N) { px(0, 0, T, Rm, P.rim); px(0, 0, T, 1, P.rimHi); }       // floor beyond the cap: a rim on its far side
            if (Wf && capH) px(0, 0, 1, capH, P.rim);
            if (E && capH) px(T - 1, 0, 1, capH, P.rim);
            return;
        }
        // the cap: a lit rim along every side that meets floor
        if (N) px(0, 0, T, Rm, P.rim);
        if (Wf) px(0, 0, Rm, T, P.rim);
        if (E) px(T - Rm, 0, Rm, T, P.rim);
        // floor at a corner only: a joint where the two rims beside it would meet
        if ((m & 16) && !N && !E) px(T - Rm, 0, Rm, Rm, P.rim);
        if ((m & 128) && !N && !Wf) px(0, 0, Rm, Rm, P.rim);
        // the brightest edge, right against the floor
        if (N) px(0, 0, T, 1, P.rimHi);
        if (Wf) px(0, 0, 1, T, P.rimHi);
        if (E) px(T - 1, 0, 1, T, P.rimHi);
    }

    // Open rock between the rooms, every level's: near black with a few grains (the stone sheet, row 1, columns 6-9).
    static paintRock(ctx, X, Y, T, v, tm) {
        ctx.clearRect(X, Y, T, T);
        if (tm.exists('st_tiles')) ctx.drawImage(tm.get('st_tiles').getSourceImage(), (6 + v) * 24, 24, 24, 24, X, Y, T, T);
    }

    // The rims and lips again, above the shade at LIFT alpha, so a wall stays a crisp line out
    // in the dark. One Blitter: one draw.
    _vfxWallLift(list, tint) {
        const P = this._vfxCfg().WALL, T = this.TILE_SIZE;
        const bob = this._vfxLiftBob = P.LIFT > 0 ? VisualFX.blitChunks(this, b => b.setDepth(P.LIFT_DEPTH).setAlpha(P.LIFT)) : null;   // (kept: a wall that rises later gets its lines in its own chunk, BossFX._bfxCrumble)
        if (!list?.length || !bob) return;
        for (const [x, y, f] of list) {
            const b = bob(x, y, f);
            if (tint !== 0xffffff) b.setTint(tint);
        }
    }
    // A Blitter draws every one of its bobs every frame, on screen or not (7,500 a frame in the Cistern from one for the
    // whole level), so the tiles go in a Blitter for each CHUNK x CHUNK tiles and _vfxCull hides the ones out of view.
    // Returns bob(tx, ty, frame); setup(blitter) dresses each new one.
    static blitChunks(scene, setup) {
        const T = scene.TILE_SIZE, N = 8, P = N * T, chunks = new Map();
        return (x, y, frame) => {
            const cx = Math.floor(x / N), cy = Math.floor(y / N), k = cx * 4096 + cy;
            let b = chunks.get(k);
            if (!b) { chunks.set(k, b = setup(scene.add.blitter(0, 0, 'vfx_atlas'))); b._vfxBox = [cx * P, cy * P, cx * P + P, cy * P + P]; }
            return b.create(x * T, y * T, frame);
        };
    }

    // ── DRESSING ─────────────────────────────────────────────────────────────
    // Bones, a skull, pebbles, cobwebs in the corners: under the shade, in the level's tint.
    _vfxPlaceDecals(list, TH) {
        const T = this.TILE_SIZE;
        for (const [x, y, kind, v] of list) {
            const f = this._vfxFrame(kind, (ctx, X, Y, S) => this._vfxPaintDecal(ctx, X, Y, S, kind));
            const img = this.add.image(x * T + T / 2, y * T + T / 2, 'vfx_atlas', f).setDepth(0.1);
            img.setFlipX(kind === 'dc_web' ? v < 0 : !!(v & 1));   // (flipped, never turned: the light stays on their top)
            if (TH.floor !== 0xffffff) img.setTint(TH.floor);
        }
    }
    _vfxPaintDecal(ctx, X, Y, T, kind) {
        ctx.clearRect(X, Y, T, T);
        const A = this._vfxTileArt?.(), S = VisualFX.TILESETS.stone;
        if (A && A.DECALS[kind] != null) ctx.drawImage(A.img, A.DECALS[kind] * 24, 24, 24, 24, X, Y, T, T);   // (a level's own clutter)
        else if (S.DECALS[kind] != null && this.textures.exists(S.tex)) ctx.drawImage(this.textures.get(S.tex).getSourceImage(), S.DECALS[kind] * 24, 24, 24, 24, X, Y, T, T);   // (the cobweb, every level's)
    }

    // Torches: an iron sconce on the wall face, a flame above the shade, and a warm light that
    // breathes (see _vfxLights; the flames flicker in _vfxUpdateTorches).
    _vfxPlaceTorches(spots, TH) {
        const C = this._vfxCfg(), T = this.TILE_SIZE, kept = [];
        const A = this._vfxTileArt?.(), lamp = A && !A.TORCH, sz = lamp ? 0.45 : 1;   // a level's own lamp (the Gauntlet's caged bulb, the Rift's rune stone): a small glow in it; the stone's sconce, a torch
        const sconce = this._vfxFrame((A?.key || 'st') + '_lamp', (ctx, X, Y, S) => this._vfxPaintSconce(ctx, X, Y, S));
        for (const [x, y, h] of spots) {
            if (kept.some(k => Math.abs(k.tx - x) < C.TORCH_GAP && Math.abs(k.ty - y) < C.TORCH_GAP)) continue;
            const px = x * T + T / 2, py = y * T + T / 2;
            const s = this.add.image(px, py, 'vfx_atlas', sconce);
            if (TH.wall !== 0xffffff) s.setTint(TH.wall);
            // the flame stands in the sconce's bowl, high on the brick face
            const fy = py - T / 2 + VisualFX.SCONCE_BOWL;
            const flame = this.add.image(px, fy, 'vfx_flame').setOrigin(0.5, lamp ? 0.6 : 0.9).setBlendMode(Phaser.BlendModes.ADD)
                .setTint(TH.torch).setDepth(0.9);
            const core = this.add.image(px, fy, 'vfx_flame').setOrigin(0.5, 0.9).setBlendMode(Phaser.BlendModes.ADD)
                .setTint(0xfff2c8).setScale(0.55).setDepth(0.9);
            if (lamp) core.setOrigin(0.5, 0.6);
            kept.push({ tx: x, ty: y, x: px, y: py, flame, core, ph: (h % 628) / 100, sz });
        }
        this._vfxTorches = kept;
    }
    // The level's lamp, from its sheet (row 1, column 4): the stone's is an iron bowl on a bracket bolted to the bricks, soot
    // above it, its rim at SCONCE_BOWL (the flame stands in it).
    _vfxPaintSconce(ctx, X, Y, T) {
        const A = this._vfxTileArt?.();
        ctx.clearRect(X, Y, T, T);
        if (A) ctx.drawImage(A.img, A.LAMP[0] * 24, A.LAMP[1] * 24, 24, 24, X, Y, T, T);
    }
    _vfxUpdateTorches(time) {
        const list = this._vfxTorches;
        if (!list?.length) return;
        const v = this.cameras.main.worldView;
        for (const t of list) {
            if (t.x < v.x - 40 || t.x > v.right + 40 || t.y < v.y - 40 || t.y > v.bottom + 60) continue;
            const k = 1 + 0.12 * Math.sin(time * 0.019 + t.ph) + 0.07 * Math.sin(time * 0.047 + t.ph * 2.3);
            const z = t.sz ?? 1;
            t.flame.setScale(0.62 * z * (1.5 - k * 0.5), 0.62 * z * k).setAlpha(0.85 + 0.15 * Math.sin(time * 0.031 + t.ph));
            t.core.setScale(0.32 * z, 0.36 * z * k);
        }
    }

    // A sealed doorway (lockTutorialDoors): a curtain of red light rather than a flat red tile.
    // `vertical` is which way the curtain runs; left out, it is worked out from the floor around.
    _vfxWard(px, py, vertical) {
        const T = this.TILE_SIZE;
        if (vertical === undefined) {
            const tx = Math.floor(px / T), ty = Math.floor(py / T), fl = (x, y) => this.world?.[x]?.[y] === this.FLOOR;
            vertical = (fl(tx - 1, ty) && fl(tx + 1, ty)) || !(fl(tx, ty - 1) && fl(tx, ty + 1));
        }
        const img = this.add.image(px, py, 'vfx_atlas', vertical ? 'ward_v' : 'ward_h')
            .setBlendMode(Phaser.BlendModes.ADD).setDepth(0.9).setAlpha(0.9);
        const list = this._vfxWards || (this._vfxWards = []);
        img._vfxLit = list.length % 2 === 0;
        list.push(img);
        return img;
    }
    _vfxPaintWard(ctx, X, Y, T, vertical) { VisualFX.ground(ctx, X, Y, T, this.textures, vertical ? 'ward_v' : 'ward_h'); }
    // One frame of fx_ground (the floor's water, ice, sludge, fog, wards: hand-drawn) into an atlas frame.
    static ground(ctx, X, Y, T, tm, name) {
        ctx.clearRect(X, Y, T, T);
        const fr = tm.exists('fx_ground') && tm.get('fx_ground').get(name);
        if (fr && fr.name === name) ctx.drawImage(fr.source.image, fr.cutX, fr.cutY, fr.cutWidth, fr.cutHeight, X, Y, T, T);
    }

    // A tile of the poison a thumping slime leaves (EnemyManager's ring): a murky pool, a dark rim, a bubble, a toxic glint.
    _vfxSludgeTile(cx, cy) {
        return this.add.image(cx, cy, 'vfx_atlas', `sludge${Math.floor(Math.random() * 4)}`).setDepth(0.65);
    }
    _vfxPaintSludge(ctx, X, Y, T, v) { VisualFX.ground(ctx, X, Y, T, this.textures, 'sludge' + v); }

    // Fog (dried water): wisps in three greys thinning to nothing at the rim, so a field of it reads as one bank, not a grid
    _vfxFogTile(cx, cy) {
        return this.add.image(cx, cy, 'vfx_atlas', `fog${Math.floor(Math.random() * 4)}`).setDepth(0.6).setAlpha(0);
    }
    _vfxPaintFog(ctx, X, Y, T, v) { VisualFX.ground(ctx, X, Y, T, this.textures, 'fog' + v); }

    // The ice ult's flash-freeze, one tile of it: frosted glass with a few bright facets.
    // Starts invisible; the caller fades it in and out and destroys it.
    _vfxIceTile(cx, cy) {
        return this.add.image(cx, cy, 'vfx_atlas', `ice${Math.floor(Math.random() * 4)}`).setDepth(1.8).setAlpha(0);
    }
    _vfxPaintIce(ctx, X, Y, T, v) { VisualFX.ground(ctx, X, Y, T, this.textures, 'ice' + v); }

    // ── AIR ──────────────────────────────────────────────────────────────────
    _vfxBuildAir() {
        this._vfxSoftTextures();
        const C = this._vfxCfg(), cam = this.cameras.main, W = this.scale.width, H = this.scale.height;
        // Past the map's edge: the same rock as between the rooms (_vfxRenderWorld paints that).
        // Not in the Cistern, where it's open water and the deep-sea backdrop fills it.
        if (!this.isLevel6 && !this._floorPlan?.()?.sky) cam.setBackgroundColor(C.WALL.rock);
        // Dust in the light around you.
        if (this.player && this.add.particles && !(typeof Settings !== 'undefined' && Settings.low())) {   // (not on low graphics)
            this._dust = this.add.particles(0, 0, 'vfx_dot', {
                lifespan: { min: 2600, max: 4200 },
                speedX: { min: -7, max: 7 }, speedY: { min: -12, max: -3 },
                scale: { start: 0.55, end: 0.15 }, alpha: { start: 0.42, end: 0 },
                frequency: 140, quantity: 1, blendMode: 'ADD', tint: this._vfxTheme().dust,
                emitZone: { type: 'random', source: new Phaser.Geom.Circle(0, 0, C.PLAYER_LIGHT * 0.8) },
            }).setDepth(2.6);
            this._dust.startFollow(this.player);
        }
        // The vignette: one image on the HUD camera rather than a postFX pass over the world.
        this._vignette = this.add.image(W / 2, H / 2, 'vfx_edge').setDisplaySize(W, H).setTint(0x000000)
            .setAlpha(C.VIGNETTE).setScrollFactor(0).setDepth(1);
        // A faint rune circle turning under you in your element's colour; it flares when you switch.
        // (fx_rune: drawn lying flat on the floor, six frames turning it a tick at a time.)
        if (this.player && this.textures.exists('fx_rune')) {
            const img = this.add.image(0, 0, 'fx_rune', 'rune0').setBlendMode(Phaser.BlendModes.ADD)
                .setTint(C.EL[this.currentElement] ?? 0xbfd2ff);
            this._vfxRune = this.add.container(this.player.x, this.player.y, [img]).setDepth(0.94).setAlpha(0.3);
            this._vfxRuneTurn = 0;
            this._vfxRuneImg = img;
            this._vfxRuneEl = this.currentElement;
        }
    }

    // The rune follows you; a new element tints it and flares it.
    _vfxUpdateRune(delta) {
        const r = this._vfxRune, img = this._vfxRuneImg, p = this.player;
        if (!r?.active || !img?.active || !p?.active) return;
        const C = this._vfxCfg();
        r.setPosition(p.x, p.y - (this.SLIME_Y_OFFSET || 0) + 7).setVisible(p.visible !== false);
        this._vfxRuneTurn = ((this._vfxRuneTurn || 0) + (delta || 16) * 0.0007) % (Math.PI / 2);   // a tick (15 degrees) a frame
        const fr = 'rune' + Math.floor(this._vfxRuneTurn / (Math.PI / 12)) % 6;
        if (img.frame.name !== fr) img.setFrame(fr);
        if (this._vfxRuneEl !== this.currentElement) {
            this._vfxRuneEl = this.currentElement;
            Sfx.play(this, 'switch');
            const col = C.EL[this.currentElement] ?? 0xbfd2ff;
            img.setTint(col);
            this.tweens.killTweensOf([r, img]);
            r.setAlpha(0.95); img.setScale(1.5);
            this.tweens.add({ targets: r, alpha: 0.3, duration: 420, ease: 'Cubic.easeOut' });
            this.tweens.add({ targets: img, scale: 1, duration: 420, ease: 'Cubic.easeOut' });
            this._vfxFlash(p.x, p.y, 120, col, 300, 0.7);
        }
    }

    // ── LIGHT ────────────────────────────────────────────────────────────────
    _vfxBuildLight() {
        const C = this._vfxCfg(), cam = this.cameras.main;
        // Half resolution, drawn at 2x: light is soft anyway, and it's a quarter of the fill. A quarter on low graphics.
        const LR = this._lightRes = typeof Settings !== 'undefined' && Settings.low() ? 4 : 2;
        const w = Math.ceil((cam.width / cam.zoom + C.LIGHT_PAD * 2) / LR);
        const h = Math.ceil((cam.height / cam.zoom + C.LIGHT_PAD * 2) / LR);
        this._shade = this.add.renderTexture(0, 0, w, h).setOrigin(0, 0).setScale(LR).setDepth(C.SHADE_DEPTH);
        this._shade.texture?.setFilter?.(Phaser.Textures.FilterMode.LINEAR);
        this._glows = [];
        for (let i = 0; i < C.MAX_LIGHTS; i++) {
            this._glows.push(this.add.image(0, 0, 'vfx_glow').setBlendMode(Phaser.BlendModes.ADD)
                .setDepth(C.GLOW_DEPTH).setVisible(false));
        }
        this._vfxFlashes = [];
    }

    // A light that flares and fades: explosions, impacts, casts.
    _vfxFlash(x, y, r, color, ms = 220, a = 1) {
        if (!this._vfxFlashes) return;
        if (this._vfxFlashes.length > 60) this._vfxFlashes.shift();
        this._vfxFlashes.push({ x, y, r, color, ms, a, t: this.time.now });
    }

    // Everything that gives off light this frame: { x, y, r, color, a (how much shade it
    // clears), g (how strongly it tints the floor) }.
    _vfxLights(time) {
        const C = this._vfxCfg(), T = this.TILE_SIZE, out = [];
        const add = (x, y, r, color, a, g) => { if (x !== undefined && !isNaN(x)) out.push({ x, y, r, color, a, g }); };
        const p = this.player;
        if (p) {
            add(p.x, p.y, C.PLAYER_LIGHT, C.EL[this.currentElement] ?? 0xbfd2ff, 1, 0.14);
            if (this._vfxPlayerGlow) add(p.x, p.y, 64, this._vfxPlayerGlow, 0.8, 0.6);   // a tint the game gave you
            if (this.ignitionActive) add(p.x, p.y, C.PLAYER_LIGHT * 1.25, C.EL.fire, 1, 0.16);
            if (this.lightningUltActive) add(p.x, p.y, C.PLAYER_LIGHT * 1.2, C.EL.lightning, 1, 0.28);
            if (this.tsunamiActive) add(p.x, p.y, C.PLAYER_LIGHT * 1.3, C.EL.ice, 1, 0.12);
        }
        for (const f of this.fireballs || []) {
            const s = f.sprite;
            if (s?.active) add(s.x, s.y, f._isSupernova ? 70 : 50, f._isSupernova ? 0x4a8cff : C.EL.fire, 0.9, 0.42);
        }
        for (const s of this.iceShards || []) if (s.sprite?.active) add(s.sprite.x, s.sprite.y, 30, C.EL.ice, 0.7, 0.3);
        for (const o of this.lightningOrbs || []) {
            const q = o.sprite || o.gfx || o.container || o;
            if (q && q.active !== false && q.x !== undefined) add(q.x, q.y, 46, C.EL.lightning, 0.9, 0.38);
        }
        if (!this._bfxOn) for (const e of this.enemyProjectiles || []) {
            const q = e.gfx || e.sprite;
            if (q?.active) add(q.x, q.y, 26, 0xff4466, 0.6, 0.32);
        }
        for (const t of this.ignitionPierceTrails || []) add(t.x, t.y, 30, 0xff6a2a, 0.75, 0.2);
        for (const d of this.groundDrops || []) {
            const c = d.container;
            if (c?.active) add(c.x, c.y, 24, d.type === 'glorp' ? 0x3dffb0 : d.type === 'healthpot' ? 0xff5577 : 0xe8e0ff, 0.6, 0.3);
        }
        for (const q of this.portals || []) if (q.active) add(q.tileX * T + T / 2, q.tileY * T + T / 2, 64, q.tide ? TideMother.CFG.COL : this._bfxOn ? 0xff3a4a : C.EL.cosmic, 0.8, 0.3);
        // torches breathe; sealed doorways and the boss door glow
        const TH = this._vfxTheme();
        for (const t of this._vfxTorches || []) {
            if (t.off) { if (t.red) add(t.x, t.y + 18, C.TORCH_LIGHT * (0.55 + 0.1 * Math.sin(time * 0.006 + t.ph)), 0xff2a1a, 0.45, 0.2); continue; }   // out (the power cut: LevelManager._lamps); a red emergency lamp glows dimly
            const k = 1 + 0.08 * Math.sin(time * 0.019 + t.ph) + 0.05 * Math.sin(time * 0.047 + t.ph * 2.3);
            add(t.x, t.y + 18, C.TORCH_LIGHT * k, TH.torch, 0.8, 0.18);   // centred in front of the wall, not on it
        }
        const wards = this._vfxWards;
        if (wards?.length) {
            for (let i = wards.length - 1; i >= 0; i--) {
                const w = wards[i];
                if (!w.active) { wards.splice(i, 1); continue; }
                if (w._vfxLit && w.visible) add(w.x, w.y, 42, w._vfxLight ?? 0xff3a22, 0.55, 0.3 * Math.min(1, w.alpha + 0.1));   // (a breaker's door: its own colour)
            }
        }
        const bd = this._bossDoor;
        if (bd?.locked && bd.gfx?.active) add((bd.tileX + bd.w / 2) * T, (bd.tileY + 1) * T, 72, 0xcc44ff, 0.7, 0.3);
        // the special enemies carry a little light of their own; bosses a lot
        const SPECIAL = [['isElectrical', C.EL.lightning], ['isVoidSniper', C.EL.cosmic], ['isSingularitySlime', C.EL.cosmic],
                         ['isUltAbsorber', 0xe8f4ff], ['isHealerTotem', 0x44ff88], ['isBerserker', 0xff5a2a], ['isMortar', 0xffa040]];
        for (const e of this.enemies || []) {
            const s = e.sprite;
            if (!s?.active || s.visible === false) continue;
            for (const [k, col] of SPECIAL) if (e[k]) { add(s.x, s.y, 42, col, 0.55, 0.22); break; }
        }
        for (const [b, col] of [[this.voltslimeBoss, this._bfxOn ? 0x5ff0ff : C.EL.lightning], [this.voidSovereignBoss, C.EL.cosmic], [this.fractureCore, 0xffb44a]]) {
            if (!b || b.active === false) continue;
            const q = b.container || b.sprite || b.body || b;
            if (q && typeof q.x === 'number' && (q.active !== false)) add(q.x, q.y, 130, col, 0.85, 0.28);
        }
        if (this.cosmicBlackHole) add(this.cosmicBlackHole.x, this.cosmicBlackHole.y, this.cosmicBlackHoleRadius * T, C.EL.cosmic, 0.9, 0.34);
        if (this.cosmicBlackHoleProjectile?.active) add(this.cosmicBlackHoleProjectile.x, this.cosmicBlackHoleProjectile.y, 60, C.EL.cosmic, 0.9, 0.4);
        for (const L of this._cfxLights?.(time) || []) add(L.x, L.y, L.r, L.color, L.a, L.g);   // Creatures.js
        for (const L of this._condLights || []) add(L.x, L.y, L.r, L.color, L.a, L.g);   // the Conductor's wires
        for (const L of this._bfxLights?.(time) || []) add(L.x, L.y, L.r, L.color, L.a, L.g);   // Bosses.js
        const fl = this._vfxFlashes || [];
        for (let i = fl.length - 1; i >= 0; i--) {
            const f = fl[i], k = 1 - (time - f.t) / f.ms;
            if (k <= 0) { fl.splice(i, 1); continue; }
            add(f.x, f.y, f.r * (0.65 + 0.35 * k), f.color, f.a * k, 0.55 * k);
        }
        return out;
    }

    // Graphics on AUTO: the first level watched from 3s in to 8s; under 40 fps on average and it switches to low graphics,
    // taking off what it can at once (the bloom, the dust) and the rest from the next level and launch.
    _vfxPerfWatch(time, delta) {
        if (typeof Settings === 'undefined' || Settings.quality() !== 'auto' || Settings.low() || this._perfDone) return;
        const W = this._perfW ||= { t0: time, n: 0, ms: 0 };
        const age = time - W.t0;
        if (age < 3000) return;
        W.n++; W.ms += delta || 16;
        if (age < 8000) return;
        this._perfDone = true;
        if (W.ms / W.n <= 25) return;   // 40 fps or better
        Settings._set('perf_low', '1');
        this.cameras.main.resetPostPipeline?.();
        this._dust?.destroy(); this._dust = null;
        this.showStatusText?.(this.player.x, this.player.y - 40, 'RUNNING SLOW: GRAPHICS SET TO LOW', '#c8d8ff');
    }

    _vfxUpdateLight(time) {
        const sh = this._shade;
        if (!sh?.active || !this.player) return;
        const C = this._vfxCfg(), cam = this.cameras.main;
        const ox = cam.width / 2, oy = cam.height / 2;
        const left = cam.scrollX + ox - ox / cam.zoom - C.LIGHT_PAD;
        const top = cam.scrollY + oy - oy / cam.zoom - C.LIGHT_PAD;
        const LR = this._lightRes || 2, W = sh.width * LR, H = sh.height * LR;
        if (LR > 2 && (this._lightSkip = !this._lightSkip)) return;   // low graphics: the light redrawn every other frame (moved with it, so it stays on the world)
        sh.setPosition(left, top);
        // Only what reaches the view, nearest you first, capped.
        const px = this.player.x, py = this.player.y;
        const lights = this._vfxLights(time)
            .filter(L => L.x + L.r > left && L.x - L.r < left + W && L.y + L.r > top && L.y - L.r < top + H)
            .sort((a, b) => ((a.x - px) ** 2 + (a.y - py) ** 2) - ((b.x - px) ** 2 + (b.y - py) ** 2))
            .slice(0, C.MAX_LIGHTS);
        sh.clear();
        sh.fill(C.DARK_COLOR, Math.min(0.9, C.DARK + (this._lightsOut ? 0.1 : 0)));   // (the power cut: darker still)
        // The Cistern's water under the map (Menus.js) shows through: part of the dark is
        // erased over the void, through a mask a pixel a tile, softened at the walls.
        const veil = this._vfxVoidVeil;
        const veiled = !!(veil?.key && this.textures.exists(veil.key));
        if (lights.length || veiled) {
            sh.beginDraw();
            if (veiled) sh.stamp(veil.key, null, -left / LR, -top / LR,
                { originX: 0, originY: 0, scale: this.TILE_SIZE / LR, alpha: veil.alpha, skipBatch: true });
            for (const L of lights) sh.stamp('vfx_light', null, (L.x - left) / LR, (L.y - top) / LR, { scale: L.r / 64 / LR, alpha: Math.min(1, L.a), skipBatch: true });
            sh.endDraw(true);
        }
        const gl = this._glows;
        for (let i = 0; i < gl.length; i++) {
            const L = lights[i], g = gl[i];
            if (!L || L.g <= 0.01) { if (g.visible) g.setVisible(false); continue; }
            g.setPosition(L.x, L.y).setScale(L.r / 64 * 0.95).setTint(L.color).setAlpha(Math.min(1, L.g)).setVisible(true);
        }
    }

    // ── HITS AND DEATHS ──────────────────────────────────────────────────────
    // One burst emitter per element, fired with explode() at the hit point.
    _vfxBuildBursts() {
        if (!this.add.particles) return;
        const C = this._vfxCfg();
        const mk = (tint, cfg = {}) => this.add.particles(0, 0, 'vfx_dot', Object.assign({
            speed: { min: 40, max: 130 }, angle: { min: 0, max: 360 },
            lifespan: { min: 180, max: 380 }, scale: { start: 0.7, end: 0 },
            alpha: { start: 1, end: 0 }, tint, blendMode: 'ADD', emitting: false,
        }, cfg)).setDepth(4.5);
        this._vfxBursts = {
            fire: mk(C.EL.fire, { gravityY: -140 }),
            ice: mk(C.EL.ice, { gravityY: 180, speed: { min: 60, max: 150 } }),
            lightning: mk(C.EL.lightning, { lifespan: { min: 80, max: 180 }, speed: { min: 140, max: 280 } }),
            cosmic: mk(C.EL.cosmic, { speed: { min: 18, max: 60 }, lifespan: { min: 380, max: 650 } }),
            phys: mk(0xffffff),
            goo: mk(0xffffff, { blendMode: 'NORMAL', gravityY: 300, speed: { min: 50, max: 170 },
                                scale: { start: 1.1, end: 0.3 }, lifespan: { min: 320, max: 560 } }),
        };
        // Wakes behind projectiles (see _vfxTrails): slow, short, fading as they shrink.
        const wake = (tint, cfg = {}) => this.add.particles(0, 0, 'vfx_dot', Object.assign({
            speed: { min: 0, max: 10 }, angle: { min: 0, max: 360 }, lifespan: { min: 160, max: 280 },
            scale: { start: 0.8, end: 0 }, alpha: { start: 0.75, end: 0 }, tint, blendMode: 'ADD', emitting: false,
        }, cfg)).setDepth(3.2);
        this._vfxTrail = {
            fire: wake(C.EL.fire, { gravityY: -40 }),
            ice: wake(C.EL.ice, { lifespan: { min: 120, max: 200 } }),
            lightning: wake(C.EL.lightning, { lifespan: { min: 90, max: 160 }, speed: { min: 10, max: 40 } }),
            cosmic: wake(C.EL.cosmic, { lifespan: { min: 260, max: 420 } }),
            enemy: wake(0xff4a66, { scale: { start: 0.65, end: 0 } }),
        };
    }

    // Something new in the room: a ring and a puff where it appears (not for the ones a level
    // starts with). From createEnemy.
    _vfxSpawn(enemy) {
        const s = enemy?.sprite;
        if (!s?.active || !this._vfxBursts || !this._uiCam) return;
        const col = this._vfxUnitColor(s);
        Sfx.play(this, 'spawn');
        const ring = this.add.image(s.x, s.y + 4, 'vfx_ring').setBlendMode(Phaser.BlendModes.ADD).setTint(col)
            .setDepth(0.96).setScale(0.6, 0.3).setAlpha(0.9);
        this.tweens.add({ targets: ring, scaleX: 0.15, scaleY: 0.08, alpha: 0, duration: 420, ease: 'Cubic.easeIn', onComplete: () => ring.destroy() });
        this._vfxBursts.cosmic.explode(6, s.x, s.y);
        this._vfxFlash(s.x, s.y, 50, col, 300, 0.6);
    }

    // From damageEnemy, after the hit lands: sparks in the hit's colour and a flare of light.
    _vfxHit(enemy, dmg, el) {
        Sfx.play(this, 'hit', { el });
        const s = enemy?.sprite;
        if (!this._vfxBursts || !s?.active) return;
        const now = this.time.now;
        if (now - (enemy._vfxHitAt || -1e9) < 70) return;
        enemy._vfxHitAt = now;
        const C = this._vfxCfg(), col = C.EL[el] ?? 0xffffff;
        (this._vfxBursts[el] || this._vfxBursts.phys).explode(Math.min(9, 3 + Math.floor((dmg || 0) / 8)), s.x, s.y - 4);
        // a glint of light where it lands; a big flash per pellet stacked into a floodlight
        this._vfxFlash(s.x, s.y, 16 + Math.min(18, (dmg || 0) * 0.5), col, 120, 0.35);
        // a real hit (not a burn tick) breaks in its element's shape
        if ((dmg || 0) >= 3) VisualFX.impact(this, s.x + (Math.random() - 0.5) * 6, s.y - 4 + (Math.random() - 0.5) * 6, el, 8 + Math.min(10, dmg / 3));
    }

    // From killEnemy: a splash of its colour, a flare, and a stain that fades.
    _vfxDeath(enemy) {
        Sfx.play(this, 'kill');
        const s = enemy?.sprite;
        if (!this._vfxBursts || !s?.active) return;
        const own = s.texture?.has?.('die_0');   // a sheet with its own death: the eyes cross, it bursts, what it was made of is left
        const col = own ? this.textures.getPixel(12, 28, s.texture.key, '0')?.color ?? this._vfxUnitColor(s) : this._vfxUnitColor(s);
        if (own) {
            const d = this.add.sprite(s.x, s.y, s.texture.key, 'die_0').setOrigin(s.originX, s.originY).setScale(s.scaleX, s.scaleY).setFlipX(s.flipX).setDepth(s.depth ?? 1);
            this._vfxSort?.(d);
            let n = 0; while (s.texture.has('die_' + (n + 1))) n++;
            this.tweens.addCounter({ from: 0, to: n + 0.99, duration: 110 * (n + 1), onUpdate: t => { if (d.active) d.setFrame('die_' + Math.floor(t.getValue())); },
                onComplete: () => this.tweens.add({ targets: d, alpha: 0, delay: 500, duration: 700, onComplete: () => d.destroy() }) });
        }
        const goo = this._vfxBursts.goo;
        goo.setParticleTint?.(col);
        goo.explode(12, s.x, s.y);
        this._vfxFlash(s.x, s.y, 64, col, 260, 0.8);
        if (this.textures.exists('vfx_splat')) {
            const sp = this.add.image(s.x, s.y + 8, 'vfx_splat').setTint(col).setAlpha(0.5).setDepth(0.2)
                .setScale(0.7 + Math.random() * 0.4).setAngle(Math.random() * 360);
            this.tweens.add({ targets: sp, alpha: 0, duration: 2400, delay: 900, onComplete: () => sp.destroy() });
        }
    }
    _vfxUnitColor(sprite) {
        const k = sprite.texture?.key || '';
        if (sprite.tintTopLeft !== undefined && sprite.isTinted && !sprite.tintFill && sprite.tintTopLeft !== 0xffffff) return sprite.tintTopLeft;
        return k.includes('red') ? 0xff4a5a : k.includes('orange') ? 0xff9a3a : k.includes('purple') ? 0xb47cff
             : k.includes('green') ? 0x5aff8a : k.includes('blue') ? 0x4ad8ff : 0xcfd6e4;
    }

    // From takeDamage: the screen edges flash red (and stay faintly red while you're low).
    _vfxPlayerHurt(dmg) {
        Sfx.play(this, 'hurt');
        this._vfxHurtAt = this.time.now;
        this._vfxHurtAmt = dmg || 0;
        if (this.player) this._vfxFlash(this.player.x, this.player.y, 70, 0xff3344, 200, 0.5);
    }

    // From _ultCastFx: the ult's name slams in at the top of the screen in its colour, and
    // the room flares with its light.
    _vfxUltBanner(el) {
        Sfx.play(this, 'ult');
        const C = this._vfxCfg(), col = C.EL[el] ?? 0xffffff, css = '#' + col.toString(16).padStart(6, '0');
        const stage = parseInt((() => { try { return localStorage.getItem('ultStage_' + el); } catch (e) { return '1'; } })() || '1');
        const NAMES = { fire: 'SCORCH', ice: 'BLIZZARD', lightning: 'FORK', cosmic: 'BLACK HOLE' };
        const FORMS = { fire: 'the Magma Armor', ice: 'the Ice King', lightning: 'the Lightning God', cosmic: 'the dark between stars' };
        const name = (NAMES[el] || el.toUpperCase()) + (stage >= 2 ? ' II' : '');
        const W = this.scale.width, H = this.scale.height, y = Math.round(H * 0.2), all = [];
        const band = this.add.graphics().setScrollFactor(0).setDepth(25.5).setAlpha(0);
        for (let i = 0; i < 12; i++) { band.fillStyle(0x000000, 0.06); band.fillRect(0, y - 46 + i * 2, W, 92 - i * 4); }
        band.lineStyle(1.5, col, 0.6); band.lineBetween(W / 2 - 260, y - 30, W / 2 + 260, y - 30); band.lineBetween(W / 2 - 260, y + 38, W / 2 + 260, y + 38);
        for (const sx of [-1, 1]) { band.fillStyle(col, 0.9); band.fillTriangle(W / 2 + sx * 266, y - 30, W / 2 + sx * 258, y - 34, W / 2 + sx * 258, y - 26); band.fillTriangle(W / 2 + sx * 266, y + 38, W / 2 + sx * 258, y + 34, W / 2 + sx * 258, y + 42); }
        all.push(band);
        const t = this.add.text(W / 2, y, name, {
            fontSize: '46px', fontFamily: UIKit.FONT.title, fontStyle: 'bold', color: '#ffffff', stroke: css, strokeThickness: 5,
            padding: { x: 22, y: 22 },          // room for the glow, or it's clipped to a box
        }).setOrigin(0.5).setScrollFactor(0).setDepth(26).setAlpha(0).setScale(1.6);
        t.setShadow(0, 0, css, 20, true, true); all.push(t);
        const sub = this.add.text(W / 2, y + 30, FORMS[el] || '', { fontSize: '16px', fontFamily: UIKit.FONT.title, fontStyle: 'italic', color: css, stroke: '#05060a', strokeThickness: 4 })
            .setOrigin(0.5, 0).setScrollFactor(0).setDepth(26).setAlpha(0);
        all.push(sub);
        this.tweens.add({ targets: t, alpha: 1, scale: 1, duration: 220, ease: 'Back.easeOut' });
        this.tweens.add({ targets: [band, sub], alpha: 1, duration: 260, delay: 60 });
        this.tweens.add({ targets: all, alpha: 0, duration: 420, delay: 900, ease: 'Quad.easeIn', onComplete: () => all.forEach(o => o.destroy()) });
        if (this.player) this._vfxFlash(this.player.x, this.player.y, 300, col, 650, 1);
    }

    // While the ice ult holds everything frozen: one line under its banner instead of a
    // "1.5x DMG" over every enemy, and the reminder that a second press shatters it all.
    // It goes when the freeze does (see _vfxDrawHud).
    _vfxFreezeBanner(mult) {
        this._vfxFreezeTxt?.destroy();
        const W = this.scale.width, y = Math.round(this.scale.height * 0.2) + 78;
        const key = this._ultCfg?.().KEYS?.ice || 'X';
        const t = this.add.text(W / 2, y, `DEEP FREEZE  ·  x2 from fire, lightning and cosmic  ·  it shatters in 3s`, {
            fontSize: '16px', fontFamily: UIKit.FONT.title, fontStyle: 'bold italic', color: '#bff0ff', stroke: '#05060a', strokeThickness: 4,
            padding: { x: 12, y: 12 },
        }).setOrigin(0.5).setScrollFactor(0).setDepth(26).setAlpha(0);
        t.setShadow(0, 0, '#72dcff', 10, true, true);
        this.tweens.add({ targets: t, alpha: 1, duration: 160 });
        this._vfxFreezeTxt = t;
    }

    // ── NUMBERS ──────────────────────────────────────────────────────────────
    // Whole numbers (one decimal under 10), bigger for bigger hits, a pop then a float. Hits
    // landing on the same spot within a moment add up into one number instead of stacking a
    // column of "-0.8".
    _vfxDamageNumber(x, y, amount, color = '#ffffff') {
        if (!amount || amount <= 0) return true;
        const now = this.time.now, list = this._vfxNums || (this._vfxNums = []);
        const fmt = v => v >= 9.95 ? String(Math.round(v)) : v.toFixed(1);
        const size = v => Math.round(10 + Math.min(8, Math.log2(1 + v) * 1.3));   // world px, so x1.5 on screen
        for (let i = list.length - 1; i >= 0; i--) {
            const n = list[i];
            if (!n.txt.active || now - n.t > 1000) { list.splice(i, 1); continue; }
            // (30px: an AoE landing on a packed crowd sums into one number instead of a column)
            if (n.color === color && now - n.t < 300 && Math.abs(n.x - x) < 30 && Math.abs(n.y - y) < 30) {
                n.total += amount; n.t = now;
                this.tweens.killTweensOf(n.txt);
                n.txt.setText(fmt(n.total)).setFontSize(size(n.total)).setAlpha(1).setPosition(n.x, n.y0).setScale(1.35);
                this._vfxFloat(n.txt);
                return true;
            }
        }
        // a different number already popping right here (another element, a burn tick): sit above it
        let y0 = y - 16;
        for (let k = 0; k < 3; k++) {
            const hit = list.find(n => now - n.t < 300 && Math.abs(n.x - x) < 30 && Math.abs(n.y0 - y0) < size(n.total) * 1.2);
            if (!hit) break;
            y0 = hit.y0 - size(hit.total) * 1.3 - 2;   // a step as tall as that number (a big one is drawn ~1.5x its font size)
        }
        const txt = this.add.text(x + (Math.random() - 0.5) * 10, y0, fmt(amount), {
            fontSize: `${size(amount)}px`, fontFamily: UIKit.FONT.title, fontStyle: 'bold',
            color, stroke: '#05060a', strokeThickness: 4, resolution: 2,
        }).setOrigin(0.5).setDepth(10).setScale(1.5);
        list.push({ txt, x: txt.x, y, y0, t: now, total: amount, color });
        this._vfxFloat(txt);
        return true;
    }
    // Status words (WET, BRITTLE, SLOWED...). The same word popping on several enemies at once
    // becomes one word with a count ("WET ×5"), and different words at one spot stack instead of
    // printing over each other. From showStatusText.
    _vfxStatusText(x, y, text, color = '#ffffff') {
        if (text === undefined || text === null) return true;
        text = String(text);
        const now = this.time.now, list = this._vfxStatus || (this._vfxStatus = []);
        for (let i = list.length - 1; i >= 0; i--) if (!list[i].txt.active || now - list[i].t > 900) list.splice(i, 1);
        for (const s of list) {
            // the same word anywhere in the pack: one word and a count for all of them
            if (s.text === text && now - s.t < 520 && Math.abs(s.x - x) < 140 && Math.abs(s.y - y) < 80) {
                s.n++; s.t = now;
                this.tweens.killTweensOf(s.txt);
                // a word that already carries a number ("MARKED x3") just pops again: "x3 ×8" reads as noise
                s.txt.setText(/\d/.test(text) ? text : `${text} ×${s.n}`).setAlpha(1).setY(s.y0).setScale(1.25);
                this._vfxStatusFloat(s.txt);
                return true;
            }
        }
        // three different words already up here: a fourth wouldn't be read, it would only bury them
        if (list.filter(s => s.txt.active && Math.abs(s.x - x) < 130 && Math.abs(s.y - y) < 80).length >= 3) return true;
        // stack above any word still on screen here (a merged word pops back into its own slot,
        // so a slot stays taken for as long as its word is up)
        let y0 = y - 40;   // above the damage numbers' lane (they pop at y - 16 and rise ~26): the two used to print over each other
        for (let k = 0; k < 4; k++) {
            const hit = list.find(s => s.txt.active && Math.abs(s.x - x) < 46 && Math.abs(s.y0 - y0) < 11);
            if (!hit) break;
            y0 = hit.y0 - 12;
        }
        const txt = this.add.text(x, y0, text, {
            fontSize: '11px', fontFamily: UIKit.FONT.title, fontStyle: 'bold italic', color, stroke: '#05060a', strokeThickness: 3, resolution: 2,
        }).setOrigin(0.5).setDepth(10).setScale(1.3);
        list.push({ txt, text, x, y, y0, t: now, n: 1 });
        this._vfxStatusFloat(txt);
        return true;
    }
    _vfxStatusFloat(txt) {
        this.tweens.add({ targets: txt, scale: 1, duration: 120, ease: 'Back.easeOut' });
        this.tweens.add({ targets: txt, y: txt.y - 18, alpha: 0, duration: 760, delay: 180, ease: 'Quad.easeIn',
                          onComplete: () => txt.destroy() });
    }

    _vfxFloat(txt) {
        this.tweens.add({ targets: txt, scale: 1, duration: 140, ease: 'Back.easeOut' });
        this.tweens.add({ targets: txt, y: txt.y - 26, alpha: 0, duration: 650, delay: 260, ease: 'Quad.easeIn',
                          onComplete: () => txt.destroy() });
    }

    // ── LAVA ─────────────────────────────────────────────────────────────────
    // A lava tile (spawnIgnitionTrail): a ragged molten slab (hand-drawn, fx_fire_w lava_0-2: plates of cooling crust
    // drifting on it, seams glowing between) plus two flickering glows. Returns [base, glow, core].
    _vfxLavaTile(x, y) {
        const base = this.add.image(x, y, 'fx_fire_w', 'lava_' + Math.floor(Math.random() * 3)).setDepth(0.5).setAlpha(0.95)
            .setAngle(90 * Math.floor(Math.random() * 4));
        // (the glows are faint on purpose: a field of lava stacks them, and the bloom adds its own)
        const glow = this.add.image(x, y, 'vfx_glow').setBlendMode(Phaser.BlendModes.ADD).setTint(0xff5a1a)
            .setScale(0.45).setAlpha(0.2).setDepth(0.5);
        const core = this.add.image(x, y, 'vfx_glow').setBlendMode(Phaser.BlendModes.ADD).setTint(0xffb03a)
            .setScale(0.18).setAlpha(0.22).setDepth(0.5);
        this.tweens.add({ targets: glow, alpha: 0.34, scale: 0.5, duration: 220 + Math.random() * 120, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
        this.tweens.add({ targets: core, alpha: 0.42, duration: 140 + Math.random() * 80, yoyo: true, repeat: -1, ease: 'Sine.easeInOut', delay: 60 });
        return [base, glow, core];
    }

    // ── WATER ────────────────────────────────────────────────────────────────
    // A water tile (the ice ult's flood, melt puddles, shatter splashes): deep blue with
    // ripples, and a separate glint layer the callers already breathe. In place of two
    // flat rectangles; the callers' alpha tweens work on these the same way.
    // The water sits under the shade (lit by what's near it, like the floor); its glints sit
    // above it, so a flood still sparkles in the dark.
    _vfxWaterImg(x, y, glint) {
        const v = Math.floor(Math.random() * 4);
        return this.add.image(x, y, 'vfx_atlas', glint ? `waterhl${v}` : `water${v}`).setDepth(glint ? 0.5 : 0.28);
    }
    _vfxPaintWater(ctx, X, Y, T, v, glint) { VisualFX.ground(ctx, X, Y, T, this.textures, (glint ? 'waterhl' : 'water') + v); }

    // Flood water (the Cistern's, the Tower's pools, a flood): one bake for the whole map (LevelManager._bakeWater). Here only
    // its flat stand-in, for a map too big to bake; the bake paints the hand-drawn water itself (_vfxWaterUnder).
    _vfxDrawWater(g, sh, tiles, steam) {
        const T = this.TILE_SIZE;
        g.setDepth(0.25);
        g.clear(); if (sh?.active) sh.clear();
        g.fillStyle(0x0f4573, 0.88);
        for (const t of tiles) g.fillRect(t.tx * T, t.ty * T, T, T);
    }
    // The baked water, hand-drawn (fx_ground), into the bake's canvas (ox, oy: its corner in the world): each tile's water (a
    // pool, not a grid: the far lip in shadow, foam along the near side, its outer corners cut round), and on the shimmer layer
    // its glints. It replaces the Graphics' stand-in, so that's cleared before the bake draws it.
    _vfxWaterUnder(ctx, layer, gfx, ox, oy) {
        const tm = this.textures, T = this.TILE_SIZE;
        if (!tm.exists('fx_ground') || !this.waterTiles) return;
        gfx.clear();
        const G = tm.get('fx_ground'), src = G.getSourceImage(), has = new Set();
        for (const t of this.waterTiles.values()) has.add(t.tx + ',' + t.ty);
        const wet = (x, y) => has.has(x + ',' + y);
        const blit = (name, x, y, fx = 1, fy = 1) => {   // (a flip only: the corner's cut, mirrored for each corner)
            const fr = G.get(name);
            ctx.setTransform(fx, 0, 0, fy, x + (fx < 0 ? T : 0), y + (fy < 0 ? T : 0));
            ctx.drawImage(src, fr.cutX, fr.cutY, fr.cutWidth, fr.cutHeight, 0, 0, T, T);
        };
        for (const t of this.waterTiles.values()) {
            const x = t.tx * T - ox, y = t.ty * T - oy, h = ((t.tx * 73856093) ^ (t.ty * 19349663)) >>> 0;
            if (layer !== 'base') { blit('waterhl' + (h & 3), x, y); continue; }
            const n = !wet(t.tx, t.ty - 1), s = !wet(t.tx, t.ty + 1), w = !wet(t.tx - 1, t.ty), e = !wet(t.tx + 1, t.ty);
            ctx.globalAlpha = 0.9; blit('water' + ((h >>> 3) & 3), x, y); ctx.globalAlpha = 1;
            if (n) blit('wedge_n', x, y);
            if (s) blit('wedge_s', x, y);
            if (w) blit('wedge_w', x, y);
            if (e) blit('wedge_e', x, y);
            if ((n || s) && (w || e)) {
                ctx.globalCompositeOperation = 'destination-out';
                if (n && w) blit('wcorner', x, y);
                if (n && e) blit('wcorner', x, y, -1, 1);
                if (s && w) blit('wcorner', x, y, 1, -1);
                if (s && e) blit('wcorner', x, y, -1, -1);
                ctx.globalCompositeOperation = 'source-over';
            }
        }
        ctx.setTransform(1, 0, 0, 1, 0, 0);
    }

    // ── LIVING TILES ─────────────────────────────────────────────────────────
    // Steam, lava and water move, drawn every frame from the game's own state: no tween per
    // tile (a drained lake leaves a hundred steam tiles, the Cistern has hundreds of water).
    //   steam  damp dark stone with a film of condensation, and wisps boiling off it that
    //          thin to a thread over its 12s; it hisses into being (_vfxSteamPuff)
    //   lava   embers lifting off it, and now and then a bubble swelling and popping
    //   water  ripple rings opening on the water in view
    _vfxTileEmitters() {
        if (this._vfxSteamFx?.active) return true;
        if (!this.add.particles || !this.textures.exists('vfx_glow')) return false;
        this._vfxSteamFx = this.add.particles(0, 0, 'vfx_glow', {
            emitting: false, lifespan: { min: 1100, max: 1800 },
            speedX: { min: -6, max: 6 }, speedY: { min: -30, max: -14 }, accelerationX: { min: -12, max: 12 },
            scale: { start: 0.06, end: 0.3 }, alpha: { start: 0.5, end: 0 },
            tint: [0xeef6f8, 0xdbe8ee, 0xc8dae2], maxParticles: 480,
        }).setDepth(3.6);
        this._vfxEmberFx = this.add.particles(0, 0, 'vfx_dot', {
            emitting: false, lifespan: { min: 500, max: 1000 },
            speedX: { min: -8, max: 8 }, speedY: { min: -36, max: -16 },
            scale: { start: 0.6, end: 0.1 }, alpha: { start: 1, end: 0 },
            tint: [0xffd27a, 0xff8a2a, 0xff5a1a], blendMode: 'ADD', maxParticles: 260,
        }).setDepth(1.05);
        this._vfxTileG = this.add.graphics().setDepth(0.27);     // under the shade: damp stone, ripples
        this._vfxTileG2 = this.add.graphics().setDepth(0.52);    // over the lava tiles: its bubbles
        this._vfxRipples = [];
        return true;
    }

    _vfxTileFx(time, delta) {
        if (!(this.steamTiles?.size || this.waterTiles?.size || this.ignitionPierceTrails?.length || this._vfxRipples?.length)) {
            if (this._vfxTileG?.active) { this._vfxTileG.clear(); this._vfxTileG2.clear(); }
            return;
        }
        if (!this._vfxTileEmitters()) return;
        const T = this.TILE_SIZE, dt = Math.min(100, delta || 16), v = this.cameras.main.worldView;
        const inView = (x, y) => x > v.x - T * 2 && y > v.y - T * 2 && x < v.x + v.width + T * 2 && y < v.y + v.height + T * 2;
        const g = this._vfxTileG, g2 = this._vfxTileG2, rip = this._vfxRipples;
        g.clear(); g2.clear();
        // STEAM
        const life = this._waterCfg?.().STEAM_MS || 12000;
        if (this._fogImgs?.size) {   // the fog tiles (LevelManager._fogOn): rolling slowly, thinning as they run out
            for (const [k, img] of this._fogImgs) {
                const exp = this.steamTiles?.get(k);
                if (exp == null || !img.active) continue;
                if (!inView(img._fx, img._fy)) continue;
                const left = (exp - time) / life, born = 1 - left;
                img.setAlpha(0.9 * Math.min(1, born * 8, left * 2.5));
                img.setPosition(img._fx + Math.sin(time / 1700 + img._fy * 0.05) * 2.5, img._fy + Math.sin(time / 2300 + img._fx * 0.07) * 1.5);
            }
        }
        // LAVA
        const lava = this.ignitionPierceTrails;
        if (lava?.length) {
            const thin = lava.length > 60 ? 60 / lava.length : 1;     // a big field isn't a firework
            for (const t of lava) {
                if (!inView(t.x, t.y)) continue;
                if (Math.random() < dt / 480 * thin) this._vfxEmberFx.emitParticleAt(t.x + (Math.random() - 0.5) * (T - 6), t.y + (Math.random() - 0.5) * (T - 8), 1);
                if (Math.random() < dt / 2400 * thin) {   // a bubble rising through it and popping (hand-drawn)
                    if (!this.anims.exists('fw_bub')) WeaponSystem.fireArt(this);
                    const b = this.add.sprite(t.x + (Math.random() - 0.5) * (T - 12), t.y + (Math.random() - 0.5) * (T - 12), 'fx_fire_w', 'bub_0').setDepth(0.55).play('fw_bub');
                    b.once('animationcomplete', () => b.destroy());
                }
            }
        }
        // WATER: a few ripples a second somewhere in view
        const wt = this.waterTiles;
        if (wt?.size && Math.random() < dt / 240 && rip.length < 120) {
            for (let k = 0; k < 8; k++) {
                const x = v.x + Math.random() * v.width, y = v.y + Math.random() * v.height;
                if (wt.has(Math.floor(x / T) + ',' + Math.floor(y / T))) { rip.push({ x, y, born: time, life: 1200 }); break; }
            }
        }
        for (let i = rip.length - 1; i >= 0; i--) {
            const r = rip[i], k = (time - r.born) / r.life;
            if (k >= 1 || k < 0) { rip.splice(i, 1); continue; }
            const w = 4 + 18 * k;
            g.lineStyle(1, 0xa8e4ff, 0.55 * (1 - k)); g.strokeEllipse(r.x, r.y, w, w * 0.45);
            if (k < 0.5) { g.lineStyle(1, 0xdff6ff, 0.4 * (1 - 2 * k)); g.strokeEllipse(r.x, r.y, w * 0.5, w * 0.22); }
        }
    }

    // Water flashing to steam: a hiss of vapour, droplets kicked up and falling back, a ring.
    _vfxSteamPuff(tx, ty) {
        if (!this._vfxTileEmitters()) return false;
        const T = this.TILE_SIZE, x = tx * T + T / 2, y = ty * T + T / 2;
        for (let i = 0; i < 5; i++) this._vfxSteamFx.emitParticleAt(x + (Math.random() - 0.5) * (T - 4), y + (Math.random() - 0.5) * (T - 8), 1);
        for (let i = 0; i < 6; i++) {
            const a = -Math.PI / 2 + (Math.random() - 0.5) * 2.4, s = 12 + Math.random() * 14;
            const d = this.add.image(x, y, 'vfx_dot').setTint(0xdff4ff).setBlendMode(Phaser.BlendModes.ADD).setScale(0.5).setDepth(3.61);
            this.tweens.add({ targets: d, x: x + Math.cos(a) * s, y: y + Math.sin(a) * s, duration: 240, ease: 'Quad.easeOut',
                onComplete: () => this.tweens.add({ targets: d, y: d.y + 9, alpha: 0, duration: 240, ease: 'Quad.easeIn', onComplete: () => d.destroy() }) });
        }
        if (this.textures.exists('vfx_ring')) {
            const ring = this.add.image(x, y, 'vfx_ring').setTint(0xe6f2f6).setBlendMode(Phaser.BlendModes.ADD).setDepth(3.6).setScale(0.12).setAlpha(0.8);
            this.tweens.add({ targets: ring, scale: 0.5, alpha: 0, duration: 380, ease: 'Cubic.easeOut', onComplete: () => ring.destroy() });
        }
        return true;
    }

    // ── UNITS ────────────────────────────────────────────────────────────────
    // A soft shadow under you and every enemy, so they sit on the floor.
    _vfxUpdateShadows() {
        if (!this.textures.exists('vfx_shadow')) return;
        const map = this._vfxShadows || (this._vfxShadows = new Map());
        const live = new Set();
        const put = (key, s, w) => {
            let sh = map.get(key);
            if (!sh || !sh.active) { sh = this.add.image(0, 0, 'vfx_shadow').setDepth(0.95); map.set(key, sh); }
            const k = Math.abs(s.scaleX || 1) / (this.SLIME_SCALE || 1.2);
            sh.setPosition(s.x, s.y - (this.SLIME_Y_OFFSET || 0) + 7)
              .setScale(w * k, w * k * 0.4).setAlpha(0.6 * Math.min(1, s.alpha ?? 1)).setVisible(s.visible !== false);
            live.add(key);
        };
        if (this.player?.active) put(this.player, this.player, 0.66);
        for (const e of this.enemies || []) {
            const s = e.sprite;
            if (!s?.active || s.scaleX === undefined) { if (e._decayBar) { e._decayBar.destroy(); e._decayBar = null; } continue; }
            put(e, s, 0.66);
            // Health bars: a dark frame, and only once it's been hurt (a full bar on every slime
            // in the room was noise). Hiding uses visible; the game's own hiding uses alpha.
            const bg = e.healthBarBg, fill = e.healthBarFill;
            if (bg?.active && fill?.active) {
                if (!e._vfxBar) {
                    // above the water (0.4) and the darkness (0.3), which used to wash them out
                    e._vfxBar = true; bg.setFillStyle?.(0x12070b, 1); bg.setStrokeStyle?.(1, 0x000000, 0.9); fill.setFillStyle?.(0xff4560, 1);
                    bg.setDepth(4.3); fill.setDepth(4.31);
                }
                // shown once it's been hurt, and kept: healed back to full, or overhealed past it (a
                // healer totem), it used to vanish. Armour chipped counts: a CEO's or knight's hits all
                // go to its armour, and it showed only the grey armour bar
                if (e.health < (e.maxHealth || 0) - 0.01 || e.health > (e.maxHealth || 0) + 0.01 || e._plate < e._plateMax) e._vfxHurt = true;
                const show = !!e._vfxHurt;
                if (bg.visible !== show) { bg.setVisible(show); fill.setVisible(show); }
                // a cube's decay: the cut-off HP as an ice-blue piece after the fill, shrinking as it's locked in or grows back
                if (e._decayOwed > 0 && show) {
                    // (from where the fill is DRAWN: its pivot is set once and kept while its width changes, so getBounds disagrees)
                    const fx = fill.x - fill.displayOriginX + fill.width, fy = fill.y - fill.displayOriginY, w = 24 * e._decayOwed / (e.maxHealth || 1);
                    if (!e._decayBar?.active) e._decayBar = this.add.rectangle(0, 0, 1, 1, 0x9ae8ff, 0.95).setOrigin(0, 0).setDepth(4.32);
                    e._decayBar.setPosition(fx, fy).setSize(Math.max(0.5, Math.min(w, 24 - fill.width)), fill.height).setVisible(fill.alpha > 0.05);
                } else if (e._decayBar) { e._decayBar.destroy(); e._decayBar = null; }
                // overhealed (a healer slime, up to three times full): the second hundred percent a yellow bar over the red from its
                // left, the third a green one over the yellow
                const op = (e.health || 0) / (e.maxHealth || 1);
                for (const [k, lo, col] of [['_hpBarY', 1, 0xffd34a], ['_hpBarG', 2, 0x5cff8a]]) {
                    const f = Phaser.Math.Clamp(op - lo, 0, 1);
                    if (f > 0.001 && show) {
                        if (!e[k]?.active) e[k] = this.add.rectangle(0, 0, 1, 1, col, 1).setOrigin(0, 0).setDepth(4.31 + lo * 0.002);
                        e[k].setPosition(fill.x - fill.displayOriginX, fill.y - fill.displayOriginY).setSize(24 * f, fill.height).setAlpha(fill.alpha).setVisible(fill.visible);
                    } else if (e[k]) { e[k].destroy(); e[k] = null; }
                }
            }
        }
        for (const [k, sh] of map) if (!live.has(k)) { sh.destroy(); map.delete(k); }
    }

    // A squash and stretch when a slime hops a tile. `base` is its resting scale, `dur` the step it rides (the player's walk
    // passes its step): one sine pulse to x1.11 / x0.9 and back, so steps run into each other without a snap.
    // (It used to jump straight to x1.14 / x0.86 and spring back in 150ms: a jolt every tile.)
    _vfxHop(sprite, base, dur = 150) {
        if (!sprite?.active || sprite.scaleX === undefined) return;
        base = base || this.SLIME_SCALE;
        if (sprite._vfxHopTween) sprite._vfxHopTween.stop();
        const q = { v: 0 };
        sprite._vfxHopTween = this.tweens.add({ targets: q, v: 1, duration: dur, ease: 'Linear',
            onUpdate: () => { const s = Math.sin(Math.PI * q.v); sprite.setScale(base * (1 + 0.11 * s), base * (1 - 0.1 * s)); },
            onComplete: () => { sprite.setScale(base); sprite._vfxHopTween = null; } });
    }

    // ── HUD ──────────────────────────────────────────────────────────────────
    // The status card, top left: health (with a trail that shows the last hit), your element,
    // and the scrap bank. Built from createHUD; the old pieces it replaces stay, hidden,
    // because other code still writes to them.
    _vfxBuildHud() {
        this._vfxSoftTextures();
        for (const o of [this.hudBg, this._hudRule, this.healthBarBg, this.healthBarBorder, this.healthBarFill,
                         this.healthText, this.elementText]) o?.setVisible?.(false);
        let dev = false;
        try { dev = localStorage.getItem('devMode') === 'true'; } catch (e) {}
        if (this.posText && !dev) this.posText.setVisible(false);
        const W = this.scale.width, H = this.scale.height;
        this._hudCard = this.add.graphics().setScrollFactor(0).setDepth(29);
        const txt = (x, y, size, color, ox = 0) => this.add.text(x, y, '', {
            fontSize: `${size}px`, fontFamily: 'monospace', fontStyle: 'bold', color, stroke: '#05060a', strokeThickness: 3,
        }).setOrigin(ox, 0.5).setScrollFactor(0).setDepth(31);
        this._hudHp = txt(238, 27, 14, '#ffffff');
        this._hudEl = txt(44, 62, 15, '#ffffff');
        this._hudTrail = this.health;
        // The scrap bank moves into the card's third row.
        const rowY = 88, bx = 82, bw = 96, bh = 8;
        this._orbBarX = bx; this._orbBarY = rowY; this._orbBarW = bw; this._orbBarH = bh;
        this.orbBarBg?.setPosition(bx, rowY).setSize(bw, bh);
        this.orbBarBorder?.setPosition(bx, rowY).setSize(bw, bh);
        this.orbBarLabel?.setOrigin(0, 0.5).setPosition(18, rowY).setStyle({ color: '#5fae8e', fontSize: '12px', fontStyle: 'bold' });
        this.orbCountText?.setPosition(bx + bw + 8, rowY).setFontSize(12);
        // Glorps get a card like this one, top right, with a coin (drawn in _vfxDrawHud); the level line a quieter look.
        if (this.glorpText) {
            const gt = this.glorpText, set = gt.setText;
            gt.setPosition(W - 20, 25).setOrigin(1, 0.5).setFontSize(18).setColor('#7dffc4');
            // every caller writes "✦ n Glorps": the card draws the coin, the number gets its commas
            gt.setText = v => set.call(gt, String(v).replace(/^✦ (\d+) Glorps$/, (_, n) => Number(n).toLocaleString('en-US')));
            gt.setText(gt.text);
        }
        this.levelLabel?.setStyle({ color: '#59627f', fontSize: '12px' }).setOrigin(0, 1).setPosition(12, H - 7);
        // The red edge for a hit, and for low health.
        if (this.textures.exists('vfx_edge')) {
            this._hudEdge = this.add.image(W / 2, H / 2, 'vfx_edge').setDisplaySize(W, H).setTint(0xff2a3a)
                .setAlpha(0).setScrollFactor(0).setDepth(28);
        }
    }

    _vfxDrawHud() {
        const g = this._hudCard;
        if (!g?.active) return;
        const C = this._vfxCfg(), now = this.time.now;
        const max = this.maxHealth || 100, hp = Math.max(0, this.health || 0);
        if (this._hudTrail === undefined || this._hudTrail < hp) this._hudTrail = hp;
        else this._hudTrail = Math.max(hp, this._hudTrail - Math.max(0.15, (this._hudTrail - hp) * 0.06));
        g.clear();
        // the card, as wide as its longest line (the gadget readout can run long)
        const ot = this.orbCountText;
        const cw = Math.max(332, ot?.visible && ot.text ? Math.ceil(ot.x + ot.width) + 6 : 0);
        const ch = this.orbBarBg?.visible ? 98 : 74;   // the third row (lightning's scrap bank) only when it's showing
        g.fillStyle(0x090b14, 0.82); g.fillRoundedRect(8, 8, cw, ch, 8);
        g.lineStyle(1, 0x2b3256, 0.9); g.strokeRoundedRect(8.5, 8.5, cw - 1, ch - 1, 8);
        // heart: beats when you're low
        const low = hp / max < 0.3;
        const beat = low ? 1 + 0.18 * Math.max(0, Math.sin(now / 120)) : 1;
        this._vfxHeart(26, 27, beat, low);
        // health bar: trail, fill, sheen, a tick every 10
        const bx = 42, by = 21, bw = 188, bh = 12, iw = bw - 2;
        g.fillStyle(0x1b0a12, 1); g.fillRoundedRect(bx, by, bw, bh, 4);
        const f = Math.min(1, hp / max), t = Math.min(1, this._hudTrail / max), over = hp > max;
        if (t > f) { g.fillStyle(0xffd0d8, 0.75); g.fillRect(bx + 1 + iw * f, by + 1, iw * (t - f), bh - 2); }
        if (f > 0) {
            g.fillStyle(over ? 0x1fd9ae : 0xe2344c, 1); g.fillRoundedRect(bx + 1, by + 1, Math.max(4, iw * f), bh - 2, 3);
            g.fillStyle(over ? 0x8affe4 : 0xff8494, 0.85); g.fillRect(bx + 3, by + 2, Math.max(0, iw * f - 5), 2);
        }
        // a shield (the Ember Scythe's slide), gold after your health, or over its end when you're near full
        const sh = this._scyShield && now < this._scyShield.until ? Math.max(0, this._scyShield.hp) : 0, sf = Math.min(1, sh / max);
        if (sf > 0) {
            const s0 = Math.min(f, 1 - sf), blink = this._scyShield.until - now < 700 && Math.floor(now / 90) % 2;
            g.fillStyle(0xffb040, blink ? 0.5 : 1); g.fillRect(bx + 1 + iw * s0, by + 1, Math.max(2, iw * sf), bh - 2);
            g.fillStyle(0xfff0b0, blink ? 0.4 : 0.9); g.fillRect(bx + 1 + iw * s0, by + 2, Math.max(1, iw * sf - 1), 2);
        }
        // the Boreal Trident's Frostkin shell, pale ice after that
        const fs = Math.max(0, this._tri?.shell?.hp || 0), ff = Math.min(1, fs / max);
        if (ff > 0) { const f0 = Math.min(Math.min(1, f + sf), 1 - ff); g.fillStyle(0x9fe4ff, 1); g.fillRect(bx + 1 + iw * f0, by + 1, Math.max(2, iw * ff), bh - 2); g.fillStyle(0xe8fbff, 0.9); g.fillRect(bx + 1 + iw * f0, by + 2, Math.max(1, iw * ff - 1), 2); }
        g.fillStyle(0x000000, 0.35);
        const step = 10 * Math.ceil(max / 400);   // a tick every 10 HP, at most 40 of them (a big health pool gets a tick every 20, 30...)
        for (let k = step; k < max; k += step) g.fillRect(Math.round(bx + 1 + iw * (k / max)), by + 3, 1, bh - 6);
        g.lineStyle(1, 0x000000, 0.9); g.strokeRoundedRect(bx, by, bw, bh, 4);
        // stamina, under it (GameScene._stamSpend), with a dash's chevrons beside it: a notch at each dash's worth; red a
        // moment when a dash is refused
        const sm = this._stamMax?.() || 0;
        this._hudChev?.setVisible(sm > 0 && this._stam != null);
        if (sm > 0 && this._stam != null) {
            const sy = 38, sh = 8, sf = Math.max(0, Math.min(1, this._stam / sm)), no = now - (this._stamDeniedAt || 0) < 350, cost = this._stamCost();
            this._vfxHudBit('_hudChev', 26, sy + sh / 2, no ? 'chev_no' : sf >= cost / sm ? 'chev_ok' : 'chev_short');
            g.fillStyle(no ? 0x2a0a12 : 0x0a1424, 1); g.fillRoundedRect(bx, sy, bw, sh, 2);
            const wind = (this._windedUntil || 0) > now;   // WINDED (GameScene.applyWinded): not refilling, so grey and cracked (fx_winded)
            if (sf > 0) { g.fillStyle(wind ? 0x5c6472 : sf >= 1 ? 0x62ccff : 0x2c8ae0, 1); g.fillRoundedRect(bx + 1, sy + 1, Math.max(2, iw * sf), sh - 2, 1); }
            if (!this._hudCracks?.[0]?.active && this.textures.exists('fx_winded')) this._hudCracks = [0.18, 0.47, 0.76].map((k, i) => { const o = this.add.image(0, 0, 'fx_winded', 'crack_' + (i % 2)).setScrollFactor(0).setDepth(29.5); this._vfxSort?.(o); o._k = k; return o; });
            for (const o of this._hudCracks || []) o.setVisible(wind).setPosition(Math.round(bx + 1 + iw * o._k), sy + sh / 2);
            g.fillStyle(0x000000, 0.55);
            for (let k = cost; k < sm - 0.5; k += cost) g.fillRect(Math.round(bx + 1 + iw * (k / sm)), sy, 1, sh);
            g.lineStyle(1, no ? 0xff4a5a : 0x000000, 0.9); g.strokeRoundedRect(bx, sy, bw, sh, 2);
        }
        this._hudHp.setText(`${Math.ceil(hp)}/${max}` + (sh > 0 ? `  +${Math.ceil(sh)}` : '')).setColor(sh > 0 ? '#ffd27a' : low ? '#ff8a98' : '#ffffff');
        // element
        const el = this.currentElement, col = C.EL[el] ?? 0xffffff;
        this._vfxElIcon(26, 62, el);
        this._hudEl.setText((el || '').toUpperCase()).setColor('#' + col.toString(16).padStart(6, '0'));
        // glorp card: the coin, then the number
        const gt = this.glorpText;
        if (gt?.visible) {
            if (!this._hudCoin?.active && this.textures.exists('cfx_bits')) { this._hudCoin = this.add.image(0, 25, 'cfx_bits', 'glorp').setScale(2.6).setScrollFactor(0).setDepth(31); this._vfxSort?.(this._hudCoin); }
            const w = gt.displayWidth + 52, x0 = gt.x + 12 - w;   // displayWidth: the card grows with the number's pop
            g.fillStyle(0x090b14, 0.82); g.fillRoundedRect(x0, 8, w, 34, 8);
            g.lineStyle(1, 0x2b3256, 0.9); g.strokeRoundedRect(x0 + 0.5, 8.5, w - 1, 33, 8);
            this._hudCoin?.setPosition(x0 + 20, 25);
        }
        this._hudCoin?.setVisible(!!gt?.visible);
        // the ice ult's freeze line leaves with the freeze
        const ft = this._vfxFreezeTxt;
        if (ft?.active && !this._iceUltDomainActive && !ft._going) {
            ft._going = true;
            this.tweens.add({ targets: ft, alpha: 0, y: ft.y - 10, duration: 260, onComplete: () => ft.destroy() });
        }
        // red edge: a hit flashes it, low health keeps it breathing
        if (this._hudEdge) {
            const hurt = Math.max(0, 1 - (now - (this._vfxHurtAt || -1e9)) / 420) * Math.min(1, 0.35 + (this._vfxHurtAmt || 0) / 25);
            const breathe = low ? 0.22 + 0.14 * Math.sin(now / 260) : 0;
            this._hudEdge.setAlpha(Math.min(0.6, Math.max(hurt, breathe)));
        }
    }

    // The card's little art (ui_hudbits, hand-drawn): the heart (beating when you're low), the dash chevrons, your element.
    // Made the first time they're asked for, then only moved, scaled and re-framed.
    _vfxHudBit(key, x, y, frame, scale = 1) {
        let img = this[key];
        if (!img?.active) {
            if (!this.textures.exists('ui_hudbits')) return null;
            img = this[key] = this.add.image(x, y, 'ui_hudbits', frame).setScrollFactor(0).setDepth(30);
            this._vfxSort?.(img);
        }
        if (img.frame.name !== frame) img.setFrame(frame);
        return img.setPosition(x, y).setScale(scale).setVisible(true);
    }
    _vfxHeart(x, y, beat, low) { this._vfxHudBit('_hudHeart', x, y, low ? 'heart_low' : 'heart', beat); }
    _vfxElIcon(x, y, el) {
        if (!['fire', 'ice', 'lightning', 'cosmic'].includes(el)) { this._hudElIcon?.setVisible(false); return; }
        this._vfxHudBit('_hudElIcon', x, y, 'el_' + el);
    }
}
