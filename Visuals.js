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
            FLOOR: {
                mortar: '#18191f',
                stones: ['#3b3e4e', '#3f4253', '#383b4a', '#424557', '#3a3d4c', '#3d404f'],
                hi: '#4a4e62', lo: '#2e3040', speckLight: '#45495b', speckDark: '#33364a',
                crack: '#1d1e26', moss: ['#29403a', '#2f4a42', '#253832'], rune: '#3a7d86',
            },
            // Walls in 3/4 view. A wall with floor below shows its brick FACE (BRICK_H rows,
            // a lit lip on top, a dark baseboard); every other wall is the CAP, the top of the
            // rock, with a lit RIM px wide wherever it meets floor. CAP_STRIP: the cap a face
            // carries itself when nothing above it is wall. SHADOW: px of shade the face casts
            // on the floor below it (SIDE_SHADOW from side walls). Everything that isn't room
            // is solid rock. LIFT: the rims and lips are drawn a second time above the shade at
            // this alpha (LIFT_DEPTH), so a room keeps its outline in the dark.
            WALL: {
                RIM: 3, BRICK_H: 6, BRICK_W: 12, CAP_STRIP: 6, SHADOW: 8, SIDE_SHADOW: 4,
                LIFT: 0.42, LIFT_DEPTH: 0.35,
                bricks: ['#4b4f64', '#474b5f', '#50546a', '#44485b', '#4d5166'],
                mortar: '#22232d', brickHi: '#61667e', brickLo: '#35384a', lip: '#9aa1bc', base: '#191a22',
                cap: '#2c2e3b', capSpeck: '#353847', capDark: '#252733', rim: '#5b6077', rimHi: '#9aa1bc', edge: '#08090c',
                rock: '#111218', rockSpeck: ['#15161d', '#0d0e13', '#181921'],
            },
            // Torches on the walls: one in about every TORCH_EVERY wall faces, never two closer
            // than TORCH_GAP tiles. Their light flickers between TORCH_LIGHT and +12%.
            TORCH_EVERY: 4, TORCH_GAP: 6, TORCH_LIGHT: 78,
            // Bones, pebbles and the like on about DECALS percent of the floor; cobwebs in
            // about WEBS percent of the corners.
            DECALS: 3, WEBS: 40,
        });
    }

    // Each level's look: a tint over its stone and the colour its torches and dust burn.
    _vfxTheme() {
        const i = this.currentLevelIndex ?? 0;
        if (this._vfxThemeFor === i && this._vfxThemeObj) return this._vfxThemeObj;
        const T = {
            stone:  { floor: 0xffffff, wall: 0xffffff, torch: 0xff9a3c, dust: 0xffffff },
            ember:  { floor: 0xffe0d4, wall: 0xffd8cc, torch: 0xff6428, dust: 0xffa060 },   // the Gauntlet
            void:   { floor: 0xe2d6ff, wall: 0xd8ccff, torch: 0xb47cff, dust: 0xc8a8ff },   // the Void Rift
            amber:  { floor: 0xf4e8d4, wall: 0xeee0cc, torch: 0xffb44a, dust: 0xffe0a0 },   // the Fracture
            tide:   { floor: 0xd4eee8, wall: 0xcce6e4, torch: 0x5ce0ff, dust: 0x9ff0ff },   // the Cistern
            frost:  { floor: 0xdce6ff, wall: 0xd4deff, torch: 0x9fd8ff, dust: 0xdff2ff },
        };
        const pick = i === 2 ? 'ember' : i === 3 ? 'void' : i === 4 ? 'amber' : i === 5 ? 'tide'
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

    // ── SETUP ────────────────────────────────────────────────────────────────
    // Called once, at the end of GameScene.create().
    _vfxInit() {
        const C = this._vfxCfg(), cam = this.cameras.main;
        cam.setZoom(C.ZOOM);
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
    // A tile frozen over, drawn into g about its centre (g sits on the tile's centre): a slab of
    // pale ice with a lit top-left bevel and a deep bottom-right one, a few cracks from one
    // point, and a glint. `seed` keeps each tile's cracks its own.
    static iceTile(g, T, seed = 0) {
        let s = (seed * 2654435761) >>> 0;
        const r = () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
        const h = T / 2 - 0.5;
        g.clear();
        g.fillStyle(0x7cc4ec, 0.55); g.fillRect(-h, -h, h * 2, h * 2);
        g.fillStyle(0xc4ecff, 0.45); g.fillRect(-h + 2, -h + 2, h * 2 - 4, h * 2 - 4);
        g.fillStyle(0xeefaff, 0.35); g.fillTriangle(-h + 2, -h + 2, h - 2, -h + 2, -h + 2, h - 2);
        g.fillStyle(0xffffff, 0.8); g.fillRect(-h, -h, h * 2, 1.5); g.fillRect(-h, -h, 1.5, h * 2);
        g.fillStyle(0x3a86c0, 0.7); g.fillRect(-h, h - 1.5, h * 2, 1.5); g.fillRect(h - 1.5, -h, 1.5, h * 2);
        const cx = (r() - 0.5) * h, cy = (r() - 0.5) * h;
        g.lineStyle(1, 0xffffff, 0.75);
        for (let k = 0, n = 3 + Math.floor(r() * 2); k < n; k++) {
            const a = k / n * Math.PI * 2 + r(), len = h * (0.5 + r() * 0.5);
            const mx = cx + Math.cos(a + 0.3) * len * 0.5, my = cy + Math.sin(a + 0.3) * len * 0.5;
            g.beginPath(); g.moveTo(cx, cy); g.lineTo(mx, my);
            g.lineTo(Math.max(-h, Math.min(h, cx + Math.cos(a) * len)), Math.max(-h, Math.min(h, cy + Math.sin(a) * len))); g.strokePath();
        }
        g.lineStyle(1.5, 0xffffff, 0.9); g.lineBetween(h * 0.25, -h * 0.65, h * 0.6, -h * 0.3);   // the glint
    }

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
        } else if (el === 'lightning') {
            g.setBlendMode(ADD);
            for (let k = 0; k < 4; k++) {
                let a = rot + k * Math.PI / 2, px = 0, py = 0;
                g.lineStyle(1.6, k % 2 ? 0xffe14a : 0xfff6c0, 1); g.beginPath(); g.moveTo(0, 0);
                for (let j = 0; j < 3; j++) { a += (Math.random() - 0.5) * 1.1; px += Math.cos(a) * L / 3; py += Math.sin(a) * L / 3; g.lineTo(px, py); }
                g.strokePath();
            }
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
        // the mark on the face, flat along it
        const m = scene.add.graphics().setDepth(0.95).setPosition(x - nx * 2, y - ny * 2).setRotation(na + Math.PI / 2);
        if (el === 'fire') { m.fillStyle(0x1a0e08, 0.55); m.fillEllipse(0, 0, 14, 5); m.fillStyle(0xff6a1a, 0.6); m.fillEllipse(0, 0, 6, 2); }
        else if (el === 'ice') { m.lineStyle(1, 0xd8f4ff, 0.9); for (let k = -2; k <= 2; k++) m.lineBetween(k * 2.5, 0, k * 3.5, -3 - Math.abs(k)); m.fillStyle(0xbfe8ff, 0.45); m.fillEllipse(0, 0, 13, 3); }
        else if (el === 'lightning') { m.fillStyle(0x14100a, 0.5); m.fillEllipse(0, 0, 10, 4); m.lineStyle(1, 0xfff6a0, 0.9); m.lineBetween(-5, 0, -1, -2); m.lineBetween(-1, -2, 2, 1); m.lineBetween(2, 1, 6, -1); }
        else if (el === 'cosmic') { m.fillStyle(0x6a3ab0, 0.55); m.fillEllipse(0, 0, 12, 4); m.fillStyle(0xffffff, 0.8); m.fillRect(-1, -1, 2, 2); }
        else { m.fillStyle(0x000000, 0.35); m.fillEllipse(0, 0, 10, 4); }
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
    // A puff of smoke, 64 x 64, white so it takes a tint: a soft round falloff broken up by cloudy noise
    static smokeKey(scene) {
        return MenuArt.tex(scene, 'fx_smoke', 64, 64, P => {
            const n = MenuArt.noise(41), n2 = MenuArt.noise(77);
            for (let y = 0; y < 64; y++) for (let x = 0; x < 64; x++) {
                const d = Math.hypot(x + 0.5 - 32, y + 0.5 - 32) / 32, cl = 0.55 + 0.45 * (0.65 * n(x * 0.09, y * 0.09) + 0.35 * n2(x * 0.22, y * 0.22));
                const a = Math.max(0, 1 - d * d * (1.25 - 0.5 * cl)) * cl;
                if (a > 0.01) P.put(x, y, 0xffffff, Math.min(1, a * 1.15));
            }
        });
    }
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
            if (ty !== 'Sprite' && ty !== 'Image' && ty !== 'Container' && ty !== 'Text' && ty !== 'Rectangle' && ty !== 'Ellipse' && ty !== 'Arc') continue;
            let x0, x1, y0, y1;
            if (ty === 'Container') {   // only small ones gathered round their own spot (a wide one at 0,0 is never culled)
                if (o.list.length > 8) continue;
                let m = 0; for (const c of o.list) m = Math.max(m, Math.abs(c.x) + Math.abs(c.displayWidth || 0), Math.abs(c.y) + Math.abs(c.displayHeight || 0));
                if (m > 200) continue;
                const e = (m + 32) * Math.max(Math.abs(o.scaleX), Math.abs(o.scaleY));
                x0 = o.x - e; x1 = o.x + e; y0 = o.y - e; y1 = o.y + e;
            } else {
                const w = Math.abs(o.displayWidth || 0), h = Math.abs(o.displayHeight || 0);
                x0 = o.x - (o.originX ?? 0.5) * w; x1 = x0 + w; y0 = o.y - (o.originY ?? 0.5) * h; y1 = y0 + h;
            }
            const out = x1 < l || x0 > r || y1 < t || y0 > b || this._fogHides((x0 + x1) / 2, (y0 + y1) / 2);   // off screen, or in a room still under fog
            if (out !== !!o._vfxCulled) { o._vfxCulled = out; if (out) o.cameraFilter |= bit; else o.cameraFilter &= ~bit; }
        }
    }
    // ROOM FOG: in a level of rooms, a room you haven't reached yet lies under smoke, what's in it unseen (and not drawn:
    // _vfxCull). Coming within FOG_NEAR tiles of it lifts its fog for good. Not the Tower or the Training Ground: one room.
    // Each room's fog: a dark core, its edge a ring of soft smoke puffs spilling past the room and breathing slowly, pale wisps
    // drifting over it; lifting, the puffs roll outward and thin away. (One container a room: too many children for _vfxCull.)
    _fogUpdate(time) {
        if (this.towerRun || this.trainingRun || !this.rooms?.length || !this.player) return;
        const T = this.TILE_SIZE, NEAR = 2, DARK = 0x05060a;
        if (!this._fog) {
            const key = VisualFX.smokeKey(this);
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
                    const s = (size * (0.75 + Math.random() * 0.5)) * T / 64;
                    const p = this.add.image(x + ox / ol * j, y + oy / ol * j, key).setTint(DARK).setAlpha(1).setScale(s * (0.9 + Math.random() * 0.25), s).setRotation(Math.random() * 6.28);
                    p._s = p.scaleX; p._sy = p.scaleY; p._ph = Math.random() * 6.28; p._ox = -ox / ol; p._oy = -oy / ol;
                    puffs.push(p);
                }
                }
                // a puff that would billow into another room shrinks to stop at its edge, or goes if it sits in it: fog is its own room's
                const others = this.rooms.filter(o => o !== r);
                for (let k = puffs.length - 1; k >= 0; k--) {
                    const p = puffs[k];
                    let room = Infinity;
                    for (const o of others) room = Math.min(room, Math.hypot(Math.max(o.x * T - p.x, 0, p.x - (o.x + o.w) * T), Math.max(o.y * T - p.y, 0, p.y - (o.y + o.h) * T)));
                    const reach = p.displayWidth * 0.48;   // how far its smoke shows from its middle (and it breathes 8% bigger)
                    if (room >= reach) continue;
                    if (room < reach * 0.3) { p.destroy(); puffs.splice(k, 1); continue; }
                    p.setScale(p.scaleX * room / reach, p.scaleY * room / reach); p._s = p.scaleX; p._sy = p.scaleY;
                }
                c.add(puffs);
                const wisps = [];
                for (let k = 0; k < Math.max(2, Math.round(r.w * r.h / 30)); k++) {   // pale wisps drifting over it
                    const w = this.add.image(x0 + T + Math.random() * (W - 2 * T), y0 + T + Math.random() * (H - 2 * T), key).setTint(0x30323a).setAlpha(0.1 + Math.random() * 0.08)
                        .setScale((3 + Math.random() * 3) * T / 64, (1.6 + Math.random() * 1.4) * T / 64).setRotation((Math.random() - 0.5) * 0.4);
                    this.tweens.add({ targets: w, x: w.x + (Math.random() < 0.5 ? -1 : 1) * T * (1 + Math.random() * 1.5), rotation: w.rotation + (Math.random() - 0.5) * 0.5, duration: 5000 + Math.random() * 4000, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
                    wisps.push(w);
                }
                c.add(wisps);
                this._vfxSort?.(c);
                return { r, c, core, puffs, wisps, x0, y0, x1, y1, lifted: false };
            });
        }
        const px = this.playerX, py = this.playerY, v = this.cameras.main.worldView;
        for (const f of this._fog) {
            if (f.lifted) continue;
            const r = f.r;
            if (px >= r.x - NEAR && px < r.x + r.w + NEAR && py >= r.y - NEAR && py < r.y + r.h + NEAR) {   // close enough: it lifts, rolling away
                f.lifted = true;
                this.tweens.killTweensOf(f.wisps);
                this.tweens.add({ targets: [f.core, ...f.wisps], alpha: 0, duration: 700, ease: 'Quad.easeOut' });
                for (const p of f.puffs) this.tweens.add({ targets: p, x: p.x + p._ox * T * (1 + Math.random() * 1.5), y: p.y + p._oy * T * (1 + Math.random() * 1.5), scaleX: p._s * 1.6, scaleY: p._sy * 1.6, alpha: 0, rotation: p.rotation + (Math.random() - 0.5),
                    duration: 900 + Math.random() * 500, delay: Math.random() * 200, ease: 'Quad.easeOut' });
                this.time.delayedCall(1700, () => f.c.destroy());
                continue;
            }
            const off = f.x1 < v.x - T * 3 || f.x0 > v.right + T * 3 || f.y1 < v.y - T * 3 || f.y0 > v.bottom + T * 3;   // (puffs spill ~2.2 tiles past the room)
            if (f.c.visible === off) f.c.setVisible(!off);   // off screen it isn't drawn: hundreds of puffs a room, and _vfxCull skips big containers
            if (off) continue;
            for (const p of f.puffs) { const b = 1 + 0.08 * Math.sin(time * 0.0012 + p._ph); p.setScale(p._s * b, p._sy * b); }   // on screen: its edge breathes
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
        for (const s of this.iceShards || []) if (s.sprite?.active) tr.ice.emitParticleAt(s.sprite.x, s.sprite.y, 1);
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

    // The soft round textures: light (erases the shade), glow (tinted, additive), dot (dust),
    // and the void behind the map.
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
        if (!tm.exists('vfx_rune')) {      // a rune circle: two rings, ticks between, four marks
            const S = 64, t = tm.createCanvas('vfx_rune', S, S), ctx = t.getContext(), h = S / 2;
            ctx.strokeStyle = 'rgba(255,255,255,0.9)'; ctx.lineWidth = 1.5;
            ctx.beginPath(); ctx.arc(h, h, 29, 0, Math.PI * 2); ctx.stroke();
            ctx.lineWidth = 1; ctx.strokeStyle = 'rgba(255,255,255,0.6)';
            ctx.beginPath(); ctx.arc(h, h, 22, 0, Math.PI * 2); ctx.stroke();
            for (let i = 0; i < 24; i++) {
                const a = i / 24 * Math.PI * 2, r0 = i % 2 ? 24 : 23, r1 = i % 2 ? 26 : 28;
                ctx.beginPath(); ctx.moveTo(h + Math.cos(a) * r0, h + Math.sin(a) * r0); ctx.lineTo(h + Math.cos(a) * r1, h + Math.sin(a) * r1); ctx.stroke();
            }
            ctx.fillStyle = 'rgba(255,255,255,0.95)';
            for (let i = 0; i < 4; i++) {
                const a = i / 4 * Math.PI * 2 + Math.PI / 4, x = h + Math.cos(a) * 29, y = h + Math.sin(a) * 29;
                ctx.beginPath(); ctx.moveTo(x, y - 3); ctx.lineTo(x + 2.5, y); ctx.lineTo(x, y + 3); ctx.lineTo(x - 2.5, y); ctx.closePath(); ctx.fill();
            }
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
        if (!tm.exists('vfx_void')) {
            const S = 192, t = tm.createCanvas('vfx_void', S, S), ctx = t.getContext(), R = VisualFX.prototype._vfxRng(7);
            ctx.fillStyle = '#05060c'; ctx.fillRect(0, 0, S, S);
            for (let i = 0; i < 260; i++) {
                ctx.fillStyle = R() < 0.5 ? '#0a0c16' : '#0c0f1c';
                ctx.fillRect(Math.floor(R() * S), Math.floor(R() * S), 2, 2);
            }
            for (let i = 0; i < 46; i++) {
                const b = R();
                ctx.fillStyle = b < 0.7 ? '#1d2236' : b < 0.93 ? '#33395a' : '#6a73a8';
                ctx.fillRect(Math.floor(R() * S), Math.floor(R() * S), 1, 1);
            }
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
        // Every tile is a Bob in one Blitter: thousands of plain quads from one texture cost far
        // less to draw than an Image each, and none of them ever moves.
        this._vfxAtlas();   // the Blitter takes its texture now: it has to exist first
        const layer = this.add.blitter(0, 0, 'vfx_atlas');
        const lift = [];
        // mostly pebbles and bones; a skull is rarer (it catches the eye)
        const DECAL_PICK = ['dc_pebbles', 'dc_pebbles', 'dc_pebbles', 'dc_bones', 'dc_bones', 'dc_pebbles', 'dc_bones', 'dc_skull'];
        // The Cistern's space between rooms is open deep water (MenuArt.cistern: the drowned hall
        // and what swims in it), not rock: leave it unpainted there so the backdrop shows.
        const openWater = !!this.isLevel6;
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
                const bob = layer.create(x * T, y * T, fr.frame);
                const tint = fr.kind === 'floor' ? TH.floor : TH.wall;
                if (tint !== 0xffffff) bob.setTint(tint);
            }
        }
        this._vfxWallLift?.(lift, TH.wall);
        if (decals) this._vfxPlaceDecals(decalList, TH);
        this._vfxPlaceTorches(torchSpots, TH);
        // Frames painted now for things that appear later, so the atlas uploads once.
        for (let v = 0; v < 4; v++) {
            this._vfxFrame(`lava${v}`, (ctx, X, Y, S) => this._vfxPaintLava(ctx, X, Y, S, v));
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
        const k = kind(x, y);
        if (k === 'floor') {
            // Mostly whole slabs (calm under the fighting), some split ones, the odd crack or moss;
            // a rune in about one tile in ninety.
            const PICK = [0, 0, 1, 1, 2, 2, 3, 3, 4, 4, 5, 6, 7, 8, 9, 10];
            const v = ((h >>> 9) % 89 === 0) ? 11 : PICK[(h >>> 3) % PICK.length];
            const m = mask((a, b) => !fl(a, b));
            return { kind: k, floor: true, h, m, frame: this._vfxFrame(`f${v}_${m}`, (ctx, X, Y, S) => this._vfxPaintFloor(ctx, X, Y, S, v, m)), lift: null };
        }
        if (k === 'rock') {
            const v = h % 4;
            return { kind: k, h, m: 0, frame: this._vfxFrame(`rk${v}`, (ctx, X, Y, S) => VisualFX.paintRock(ctx, X, Y, S, v, P)), lift: null };
        }
        const m = mask(fl), vm = mask((a, b) => kind(a, b) === 'rock');
        const wall = (name, opts) => this._vfxFrame(name, (ctx, X, Y, S) => VisualFX.paintWall(ctx, X, Y, S, m, vm, P, opts));
        if (k === 'face' || k === 'upper') {
            const upper = k === 'upper', v = h % 4, tag = upper ? 'wu' : 'wf';
            return { kind: k, face: true, h, m, vm, frame: wall(`${tag}${v}_${m}_${vm}`, { face: true, upper, v }),
                     lift: (upper || (m & 1)) ? wall(`${tag}l_${m}_${vm}`, { face: true, upper, linesOnly: true }) : null };
        }
        const v = h % 3;
        return { kind: k, h, m, vm, frame: wall(`wt${v}_${m}_${vm}`, { face: false, v }),
                 lift: m ? wall(`wc_${m}_${vm}`, { face: false, linesOnly: true }) : null };
    }

    // Floor variants: 0-3 a whole slab, 4-5 a slab over two, 6 four squares, 7 staggered,
    // 8 a cracked slab, 9 three planks, 10 a mossy slab, 11 a slab with a rune.
    _vfxPaintFloor(ctx, X, Y, T, v, m) {
        const P = this._vfxCfg().FLOOR, R = this._vfxRng(v * 7919 + 101);
        const SLAB = [[0, 0, 24, 24]];
        const LAYOUT = {
            4: [[0, 0, 24, 12], [0, 12, 12, 12], [12, 12, 12, 12]],
            5: [[0, 0, 12, 12], [12, 0, 12, 12], [0, 12, 24, 12]],
            6: [[0, 0, 12, 12], [12, 0, 12, 12], [0, 12, 12, 12], [12, 12, 12, 12]],
            7: [[0, 0, 16, 12], [16, 0, 8, 12], [0, 12, 8, 12], [8, 12, 16, 12]],
            9: [[0, 0, 8, 24], [8, 0, 8, 24], [16, 0, 8, 24]],
        };
        const L = LAYOUT[v] || SLAB;
        const s = T / 24;
        ctx.fillStyle = P.mortar; ctx.fillRect(X, Y, T, T);
        for (const [sx0, sy0, sw0, sh0] of L) {
            const sx = sx0 * s, sy = sy0 * s, sw = sw0 * s, sh = sh0 * s;
            ctx.fillStyle = P.stones[Math.floor(R() * P.stones.length)];
            ctx.fillRect(X + sx, Y + sy, sw - 1, sh - 1);
            ctx.fillStyle = P.hi; ctx.fillRect(X + sx, Y + sy, sw - 1, 1);
            ctx.fillStyle = P.lo; ctx.fillRect(X + sx, Y + sy + sh - 2, sw - 1, 1);
            const n = Math.floor((sw * sh) / 70);
            for (let k = 0; k < n; k++) {
                const px = sx + 2 + Math.floor(R() * Math.max(1, sw - 5)), py = sy + 2 + Math.floor(R() * Math.max(1, sh - 5));
                ctx.fillStyle = R() < 0.5 ? P.speckLight : P.speckDark;
                ctx.fillRect(X + px, Y + py, 1, 1);
            }
        }
        if (v === 8) {   // a crack wandering down the slab
            let cx = 6 + Math.floor(R() * 10), cy = 3;
            ctx.fillStyle = P.crack;
            for (let k = 0; k < 14; k++) { ctx.fillRect(X + cx, Y + cy, 1, 1); cy += 1; const r = R(); cx += r < 0.3 ? -1 : r > 0.7 ? 1 : 0; }
        }
        if (v === 10) {  // moss creeping in from the edges
            for (let k = 0; k < 12; k++) {
                ctx.fillStyle = P.moss[Math.floor(R() * P.moss.length)];
                const edge = R() < 0.5;
                ctx.fillRect(X + (edge ? Math.floor(R() * (T - 3)) : Math.floor(R() * 4)), Y + (edge ? Math.floor(R() * 4) : Math.floor(R() * (T - 3))), 2, 1);
            }
        }
        if (v === 11) {  // a rune cut into the slab: a carved ring and a stave, the grooves lit from below
            const c = Math.floor(T / 2), dot = (x, y, col) => { ctx.fillStyle = col; ctx.fillRect(X + c + x, Y + c + y, 1, 1); };
            for (let k = 0; k < 32; k++) {
                const a = k / 32 * Math.PI * 2;
                dot(Math.round(Math.cos(a) * 6), Math.round(Math.sin(a) * 6), P.crack);
                if (Math.sin(a) > 0.3) dot(Math.round(Math.cos(a) * 5), Math.round(Math.sin(a) * 5), P.rune);
            }
            for (let y = -2; y <= 2; y++) dot(0, y, P.crack);
            dot(-1, -1, P.crack); dot(-2, -2, P.crack); dot(1, -1, P.crack); dot(2, -2, P.crack);
            dot(1, 0, P.rune); dot(1, 1, P.rune); dot(1, 2, P.rune);
        }
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
    static paintWall(ctx, X, Y, T, m, vm, P, { face = false, upper = false, v = 0, linesOnly = false } = {}) {
        const px = (x, y, w, h, c) => { ctx.fillStyle = c; ctx.fillRect(X + x, Y + y, w, h); };
        const shade = (x, y, w, h, a) => { ctx.fillStyle = `rgba(0,0,0,${a})`; ctx.fillRect(X + x, Y + y, w, h); };
        const R = VisualFX.prototype._vfxRng(v * 977 + m * 31 + (face ? (upper ? 11 : 7) : 3));
        const N = m & 1, E = m & 2, Wf = m & 8, Rm = P.RIM;
        ctx.clearRect(X, Y, T, T);
        const capH = face ? ((upper || N) ? P.CAP_STRIP : 0) : T;
        if (!linesOnly && capH) {
            px(0, 0, T, capH, P.cap);
            for (let k = 0; k < (capH * T) / 40; k++) px(Math.floor(R() * T), Math.floor(R() * capH), 1, 1, R() < 0.6 ? P.capSpeck : P.capDark);
            // where the cap meets open rock: a dark edge, so the wall's thickness reads
            if (vm & 1) px(0, 0, T, 1, P.edge);
            if (!face && (vm & 4)) px(0, T - 1, T, 1, P.edge);
            if (vm & 8) px(0, 0, 1, capH, P.edge);
            if (vm & 2) px(T - 1, 0, 1, capH, P.edge);
        }
        if (face) {
            const BH = P.BRICK_H, BW = P.BRICK_W, off = upper ? T : 0;
            // d: px up from the floor across the whole face. Tile row y is d = T - 1 - y + off.
            const rowY = d => T - 1 + off - d;
            if (!linesOnly) {
                px(0, capH, T, T - capH, P.mortar);
                for (let r = 0; ; r++) {
                    const dLo = 2 + r * BH, dHi = dLo + BH - 2;              // the brick; the px above it is mortar
                    const y0 = Math.max(capH, rowY(dHi)), y1 = Math.min(T - 1, rowY(dLo));
                    if (rowY(dLo) < capH) break;
                    if (y1 < y0) continue;
                    const hh = y1 - y0 + 1, dim = Math.min(0.32, 0.045 * r).toFixed(3);   // higher rows sit further from the light
                    for (let x = (r % 2) ? -BW / 2 : 0; x < T; x += BW) {
                        const x0 = Math.max(0, x), x1 = Math.min(T, x + BW - 1);
                        if (x1 - x0 < 2) continue;
                        px(x0, y0, x1 - x0, hh, P.bricks[Math.floor(R() * P.bricks.length)]);
                        if (rowY(dHi) >= capH) px(x0, y0, x1 - x0, 1, P.brickHi);
                        if (rowY(dLo) <= T - 1) px(x0, y1, x1 - x0, 1, P.brickLo);
                        if (R() < 0.3 && hh > 2) px(x0 + 2 + Math.floor(R() * Math.max(1, x1 - x0 - 4)), y0 + 1 + Math.floor(R() * (hh - 2)), 1, 1, P.brickLo);
                        shade(x0, y0, x1 - x0, hh, dim);
                    }
                }
                if (!upper) px(0, T - 2, T, 2, P.base);                       // the baseboard, where it meets the floor
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

    // Open rock between the rooms: near-black, a few specks so it isn't a flat fill. Specks only,
    // no strokes, so the tiles never show a seam.
    static paintRock(ctx, X, Y, T, v, P) {
        const R = VisualFX.prototype._vfxRng(v * 4441 + 17);
        ctx.fillStyle = P.rock; ctx.fillRect(X, Y, T, T);
        for (let k = 0; k < 14; k++) {
            ctx.fillStyle = P.rockSpeck[Math.floor(R() * P.rockSpeck.length)];
            ctx.fillRect(X + Math.floor(R() * (T - 1)), Y + Math.floor(R() * (T - 1)), R() < 0.3 ? 2 : 1, 1);
        }
    }

    // The rims and lips again, above the shade at LIFT alpha, so a wall stays a crisp line out
    // in the dark. One Blitter: one draw.
    _vfxWallLift(list, tint) {
        const P = this._vfxCfg().WALL, T = this.TILE_SIZE;
        if (!list?.length || !(P.LIFT > 0)) return;
        const layer = this.add.blitter(0, 0, 'vfx_atlas').setDepth(P.LIFT_DEPTH).setAlpha(P.LIFT);
        for (const [x, y, f] of list) {
            const b = layer.create(x * T, y * T, f);
            if (tint !== 0xffffff) b.setTint(tint);
        }
    }

    // ── DRESSING ─────────────────────────────────────────────────────────────
    // Bones, a skull, pebbles, cobwebs in the corners: under the shade, in the level's tint.
    _vfxPlaceDecals(list, TH) {
        const T = this.TILE_SIZE;
        for (const [x, y, kind, v] of list) {
            const f = this._vfxFrame(kind, (ctx, X, Y, S) => this._vfxPaintDecal(ctx, X, Y, S, kind));
            const img = this.add.image(x * T + T / 2, y * T + T / 2, 'vfx_atlas', f).setDepth(0.1);
            if (kind === 'dc_web') img.setFlipX(v < 0);
            else if (kind === 'dc_skull') img.setFlipX(!!(v & 1));
            else img.setAngle(90 * v);
            if (TH.floor !== 0xffffff) img.setTint(TH.floor);
        }
    }
    _vfxPaintDecal(ctx, X, Y, T, kind) {
        ctx.clearRect(X, Y, T, T);
        const px = (x, y, c) => { ctx.fillStyle = c; ctx.fillRect(X + x, Y + y, 1, 1); };
        const R = this._vfxRng(kind.length * 131 + kind.charCodeAt(3));
        if (kind === 'dc_web') {
            // threads fanning out of the top-left corner, three sagging rings across them
            const angles = [0.02, 0.4, 0.78, 1.17, 1.55], ends = [];
            for (const a of angles) {
                const L = 14 + Math.floor(R() * 5);
                for (let d = 0; d <= L; d++) px(Math.round(Math.cos(a) * d), Math.round(Math.sin(a) * d), 'rgba(205,212,230,0.30)');
                ends.push(a);
            }
            for (const r of [5, 9, 13]) {
                for (let i = 0; i < ends.length - 1; i++) {
                    const a0 = ends[i], a1 = ends[i + 1];
                    for (let k = 0; k <= 6; k++) {
                        const t = k / 6, a = a0 + (a1 - a0) * t, sag = Math.sin(t * Math.PI) * 1.2;
                        px(Math.round(Math.cos(a) * (r - sag)), Math.round(Math.sin(a) * (r - sag)), 'rgba(205,212,230,0.26)');
                    }
                }
            }
            return;
        }
        if (kind === 'dc_bones') {
            const bone = (x0, y0, dx, dy, n) => {
                for (let i = 0; i <= n; i++) { px(x0 + dx * i, y0 + dy * i + 1, 'rgba(10,10,14,0.45)'); }
                for (let i = 0; i <= n; i++) px(x0 + dx * i, y0 + dy * i, '#8f8a7b');
                for (const [ex, ey] of [[x0, y0], [x0 + dx * n, y0 + dy * n]]) {
                    px(ex - 1, ey, '#a39e8f'); px(ex + 1, ey, '#a39e8f'); px(ex, ey - 1, '#a39e8f'); px(ex, ey + 1, '#79746a');
                }
            };
            bone(5, 8, 1, 1, 8);           // a long bone and a short one lying apart, not a cross
            bone(14, 15, 1, -1, 5);
            px(17, 17, '#6c675c'); px(9, 5, '#6c675c');
            return;
        }
        if (kind === 'dc_skull') {
            const S = '#a8a292', D = '#787366', H = '#c2bcac', K = '#121218';
            ctx.fillStyle = 'rgba(8,8,12,0.45)'; ctx.fillRect(X + 8, Y + 16, 9, 2);
            ctx.fillStyle = S; ctx.fillRect(X + 8, Y + 8, 8, 6); ctx.fillRect(X + 9, Y + 7, 6, 1); ctx.fillRect(X + 9, Y + 14, 6, 2);
            ctx.fillStyle = H; ctx.fillRect(X + 9, Y + 8, 3, 1);
            ctx.fillStyle = D; ctx.fillRect(X + 8, Y + 13, 8, 1);
            ctx.fillStyle = K; ctx.fillRect(X + 9, Y + 10, 2, 2); ctx.fillRect(X + 13, Y + 10, 2, 2); ctx.fillRect(X + 12, Y + 12, 1, 1);
            for (let i = 0; i < 3; i++) ctx.fillRect(X + 10 + i * 2, Y + 15, 1, 1);
            px(17, 15, '#79746a'); px(18, 15, '#8f8a7b'); px(19, 16, '#8f8a7b');
            return;
        }
        // pebbles
        const cols = ['#5c6072', '#4c5062', '#6a6e82', '#555869'];
        for (let i = 0; i < 6; i++) {
            const x = 3 + Math.floor(R() * 17), y = 3 + Math.floor(R() * 17), w = 1 + Math.floor(R() * 2.4), h = 1 + Math.floor(R() * 1.6);
            ctx.fillStyle = 'rgba(8,8,12,0.5)'; ctx.fillRect(X + x, Y + y + h, w, 1);
            ctx.fillStyle = cols[i % cols.length]; ctx.fillRect(X + x, Y + y, w, h);
            ctx.fillStyle = 'rgba(255,255,255,0.12)'; ctx.fillRect(X + x, Y + y, 1, 1);
        }
    }

    // Torches: an iron sconce on the wall face, a flame above the shade, and a warm light that
    // breathes (see _vfxLights; the flames flicker in _vfxUpdateTorches).
    _vfxPlaceTorches(spots, TH) {
        const C = this._vfxCfg(), T = this.TILE_SIZE, kept = [];
        const sconce = this._vfxFrame('torch', (ctx, X, Y, S) => this._vfxPaintSconce(ctx, X, Y, S));
        for (const [x, y, h] of spots) {
            if (kept.some(k => Math.abs(k.tx - x) < C.TORCH_GAP && Math.abs(k.ty - y) < C.TORCH_GAP)) continue;
            const px = x * T + T / 2, py = y * T + T / 2;
            const s = this.add.image(px, py, 'vfx_atlas', sconce);
            if (TH.wall !== 0xffffff) s.setTint(TH.wall);
            // the flame stands in the sconce's bowl, high on the brick face
            const fy = py - T / 2 + VisualFX.SCONCE_BOWL;
            const flame = this.add.image(px, fy, 'vfx_flame').setOrigin(0.5, 0.9).setBlendMode(Phaser.BlendModes.ADD)
                .setTint(TH.torch).setDepth(0.9);
            const core = this.add.image(px, fy, 'vfx_flame').setOrigin(0.5, 0.9).setBlendMode(Phaser.BlendModes.ADD)
                .setTint(0xfff2c8).setScale(0.55).setDepth(0.9);
            kept.push({ tx: x, ty: y, x: px, y: py, flame, core, ph: (h % 628) / 100 });
        }
        this._vfxTorches = kept;
    }
    // An iron bowl on a bracket bolted to the brick face (the flame stands in it), with the soot
    // it has left on the bricks above.
    _vfxPaintSconce(ctx, X, Y, T) {
        ctx.clearRect(X, Y, T, T);
        const c = Math.floor(T / 2), b = VisualFX.SCONCE_BOWL;   // b: the bowl's rim
        const px = (x, y, w, h, col) => { ctx.fillStyle = col; ctx.fillRect(X + x, Y + y, w, h); };
        for (let i = 0; i < b; i++) { ctx.fillStyle = `rgba(0,0,0,${(0.28 * i / b).toFixed(3)})`; ctx.fillRect(X + c - 3, Y + i, 6, 1); }
        px(c - 3, b + 6, 6, 4, '#2a2b33'); px(c - 2, b + 7, 1, 1, '#5a5d6c'); px(c + 1, b + 7, 1, 1, '#5a5d6c');   // the plate and its bolts
        px(c - 1, b + 3, 2, 4, '#24252d');                       // the bracket
        px(c - 4, b, 8, 3, '#1b1c22');                           // the bowl
        px(c - 4, b, 8, 1, '#4a4d5c'); px(c - 4, b + 1, 1, 2, '#3a3c48'); px(c + 3, b + 1, 1, 2, '#3a3c48');
        px(c - 3, b, 6, 1, '#ffb45a');                           // embers in it
    }
    _vfxUpdateTorches(time) {
        const list = this._vfxTorches;
        if (!list?.length) return;
        const v = this.cameras.main.worldView;
        for (const t of list) {
            if (t.x < v.x - 40 || t.x > v.right + 40 || t.y < v.y - 40 || t.y > v.bottom + 60) continue;
            const k = 1 + 0.12 * Math.sin(time * 0.019 + t.ph) + 0.07 * Math.sin(time * 0.047 + t.ph * 2.3);
            t.flame.setScale(0.62 * (1.5 - k * 0.5), 0.62 * k).setAlpha(0.85 + 0.15 * Math.sin(time * 0.031 + t.ph));
            t.core.setScale(0.32, 0.36 * k);
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
    _vfxPaintWard(ctx, X, Y, T, vertical) {
        ctx.clearRect(X, Y, T, T);
        const c = T / 2;
        const line = (o, w, a, col) => {           // a stripe `w` wide at offset `o` from the core
            ctx.fillStyle = `rgba(${col},${a})`;
            if (vertical) ctx.fillRect(X + Math.round(c + o), Y, w, T); else ctx.fillRect(X, Y + Math.round(c + o), T, w);
        };
        for (let o = -12; o < 12; o++) {           // the haze, strongest at the core
            const d = Math.abs(o + 0.5) / 12;
            line(o, 1, (0.1 + 0.55 * Math.pow(1 - d, 2.5)).toFixed(3), '255,60,36');
        }
        line(-1, 2, 0.95, '255,110,70');
        line(0, 1, 0.9, '255,214,190');
        // two sigils hanging in the curtain
        const R = this._vfxRng(vertical ? 41 : 43);
        for (const at of [6, 17]) {
            const off = R() < 0.5 ? -4 : 4;
            const pts = [[0, -2], [-1, -1], [1, -1], [-2, 0], [2, 0], [-1, 1], [1, 1], [0, 2]];
            ctx.fillStyle = 'rgba(255,170,140,0.85)';
            for (const [a, b] of pts) {
                const x = vertical ? c + off + a : at + a, y = vertical ? at + b : c + off + b;
                ctx.fillRect(X + Math.round(x), Y + Math.round(y), 1, 1);
            }
        }
    }

    // A tile of the poison a thumping slime leaves (EnemyManager's ring): a murky pool with a
    // few toxic glints, in place of a green square with a bright outline.
    _vfxSludgeTile(cx, cy) {
        return this.add.image(cx, cy, 'vfx_atlas', `sludge${Math.floor(Math.random() * 4)}`).setDepth(0.65)
            .setAngle(90 * Math.floor(Math.random() * 4));
    }
    _vfxPaintSludge(ctx, X, Y, T, v) {
        const R = this._vfxRng(v * 3571 + 17);
        ctx.clearRect(X, Y, T, T);
        for (let y = 0; y < T; y++) {
            for (let x = 0; x < T; x++) {
                const dx = (x + 0.5) / T - 0.5, dy = (y + 0.5) / T - 0.5;
                const d = Math.max(Math.abs(dx), Math.abs(dy)) * 0.75 + Math.hypot(dx, dy) * 0.35;
                const edge = 0.52 + (R() - 0.5) * 0.08;
                if (d > edge) continue;
                const n = R(), deep = 1 - d / edge;
                ctx.fillStyle = deep < 0.15 ? 'rgba(10,26,16,0.85)'
                    : n < 0.06 ? 'rgba(120,255,150,0.75)'
                    : n < 0.3 ? 'rgba(38,92,52,0.9)' : 'rgba(20,52,30,0.9)';
                ctx.fillRect(X + x, Y + y, 1, 1);
            }
        }
    }

    // Fog (dried water): a tile of drifting smoke in the same hand as the lava and the sludge, banded wisps in three greys,
    // thinning to nothing at its rim so a field of it reads as one bank, not a grid
    _vfxFogTile(cx, cy) {
        return this.add.image(cx, cy, 'vfx_atlas', `fog${Math.floor(Math.random() * 4)}`).setDepth(0.6).setAlpha(0)
            .setAngle(90 * Math.floor(Math.random() * 4));
    }
    _vfxPaintFog(ctx, X, Y, T, v) {
        const R = this._vfxRng(v * 7919 + 41), a1 = R() * 6.28, a2 = R() * 6.28, f1 = 0.22 + R() * 0.12, f2 = 0.31 + R() * 0.1;
        ctx.clearRect(X, Y, T, T);
        for (let y = 0; y < T; y++) {
            for (let x = 0; x < T; x++) {
                const dx = (x + 0.5) / T - 0.5, dy = (y + 0.5) / T - 0.5, rim = Math.max(0, 1 - Math.max(Math.abs(dx), Math.abs(dy)) * 1.25);
                const w = Math.sin(x * f1 + Math.sin(y * 0.18 + a1) * 2.2) * 0.5 + Math.sin(y * f2 + x * 0.09 + a2) * 0.5;   // swirling bands
                const d = (w * 0.5 + 0.5) * (0.7 + 0.3 * rim) + (R() - 0.5) * 0.08;
                if (d < 0.3) continue;
                ctx.fillStyle = d > 0.78 ? `rgba(230,238,242,${(0.62 * (0.4 + 0.6 * rim)).toFixed(2)})`
                    : d > 0.6 ? `rgba(176,190,200,${(0.5 * (0.4 + 0.6 * rim)).toFixed(2)})`
                    : `rgba(120,132,142,${(0.34 * (0.4 + 0.6 * rim)).toFixed(2)})`;
                ctx.fillRect(X + x, Y + y, 1, 1);
            }
        }
    }

    // The ice ult's flash-freeze, one tile of it: frosted glass with a few bright facets.
    // Starts invisible; the caller fades it in and out and destroys it.
    _vfxIceTile(cx, cy) {
        return this.add.image(cx, cy, 'vfx_atlas', `ice${Math.floor(Math.random() * 4)}`).setDepth(1.8).setAlpha(0)
            .setAngle(90 * Math.floor(Math.random() * 4));
    }
    _vfxPaintIce(ctx, X, Y, T, v) {
        const R = this._vfxRng(v * 613 + 29);
        ctx.clearRect(X, Y, T, T);
        ctx.fillStyle = 'rgba(150,215,255,0.30)'; ctx.fillRect(X, Y, T, T);
        // facets: a few pale wedges
        for (let k = 0; k < 3; k++) {
            const x0 = Math.floor(R() * T), y0 = Math.floor(R() * T), w = 5 + Math.floor(R() * 8);
            for (let i = 0; i < w; i++) {
                ctx.fillStyle = `rgba(220,245,255,${(0.10 + 0.12 * (1 - i / w)).toFixed(3)})`;
                ctx.fillRect(X + Math.min(T - 1, x0 + i), Y + Math.max(0, y0 - i), Math.max(1, w - i), 1);
            }
        }
        // a crack wandering across half the tiles (every tile cracked read as shattered glass)
        for (let k = 0; k < (v < 2 ? 1 : 0); k++) {
            let x = Math.floor(R() * T), y = 0;
            const dx = R() < 0.5 ? 1 : -1;
            ctx.fillStyle = 'rgba(240,252,255,0.5)';
            for (let i = 0; i < T + 4 && x >= 0 && x < T && y < T; i++) {
                ctx.fillRect(X + x, Y + y, 1, 1);
                y += 1; if (R() < 0.45) x += dx;
            }
        }
        // a glint at the upper left
        ctx.fillStyle = 'rgba(255,255,255,0.65)'; ctx.fillRect(X + 3, Y + 3, 3, 1); ctx.fillRect(X + 3, Y + 4, 1, 2);
    }

    // ── AIR ──────────────────────────────────────────────────────────────────
    _vfxBuildAir() {
        this._vfxSoftTextures();
        const C = this._vfxCfg(), cam = this.cameras.main, W = this.scale.width, H = this.scale.height;
        // Past the map's edge: the same rock as between the rooms (_vfxRenderWorld paints that).
        // Not in the Cistern, where it's open water and the deep-sea backdrop fills it.
        if (!this.isLevel6) cam.setBackgroundColor(C.WALL.rock);
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
        // (The image turns inside a container squashed flat, so it lies on the floor like the shadows.)
        if (this.player && this.textures.exists('vfx_rune')) {
            const img = this.add.image(0, 0, 'vfx_rune').setBlendMode(Phaser.BlendModes.ADD)
                .setTint(C.EL[this.currentElement] ?? 0xbfd2ff).setScale(0.6);
            this._vfxRune = this.add.container(this.player.x, this.player.y, [img]).setDepth(0.94).setAlpha(0.3).setScale(1, 0.55);
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
        img.rotation += (delta || 16) * 0.0007;
        if (this._vfxRuneEl !== this.currentElement) {
            this._vfxRuneEl = this.currentElement;
            Sfx.play(this, 'switch');
            const col = C.EL[this.currentElement] ?? 0xbfd2ff;
            img.setTint(col);
            this.tweens.killTweensOf([r, img]);
            r.setAlpha(0.95); img.setScale(0.9);
            this.tweens.add({ targets: r, alpha: 0.3, duration: 420, ease: 'Cubic.easeOut' });
            this.tweens.add({ targets: img, scale: 0.6, duration: 420, ease: 'Cubic.easeOut' });
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
            if (this.ignitionActive) add(p.x, p.y, C.PLAYER_LIGHT * 1.25, C.EL.fire, 1, 0.3);
            if (this.lightningUltActive) add(p.x, p.y, C.PLAYER_LIGHT * 1.2, C.EL.lightning, 1, 0.28);
            if (this.tsunamiActive) add(p.x, p.y, C.PLAYER_LIGHT * 1.3, C.EL.ice, 1, 0.22);
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
        for (const q of this.portals || []) if (q.active) add(q.tileX * T + T / 2, q.tileY * T + T / 2, 64, this._bfxOn ? 0xff3a4a : C.EL.cosmic, 0.8, 0.3);
        // torches breathe; sealed doorways and the boss door glow
        const TH = this._vfxTheme();
        for (const t of this._vfxTorches || []) {
            const k = 1 + 0.08 * Math.sin(time * 0.019 + t.ph) + 0.05 * Math.sin(time * 0.047 + t.ph * 2.3);
            add(t.x, t.y + 18, C.TORCH_LIGHT * k, TH.torch, 0.8, 0.18);   // centred in front of the wall, not on it
        }
        const wards = this._vfxWards;
        if (wards?.length) {
            for (let i = wards.length - 1; i >= 0; i--) {
                const w = wards[i];
                if (!w.active) { wards.splice(i, 1); continue; }
                if (w._vfxLit && w.visible) add(w.x, w.y, 42, 0xff3a22, 0.55, 0.3 * Math.min(1, w.alpha + 0.1));
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
        sh.fill(C.DARK_COLOR, C.DARK);
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
        const col = this._vfxUnitColor(s);
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
    // A lava tile (spawnIgnitionTrail): a ragged molten slab plus two flickering glows, in
    // place of three flat rectangles. Returns [base, glow, core] like the rectangles were.
    _vfxLavaTile(x, y) {
        const v = Math.floor(Math.random() * 4);
        const base = this.add.image(x, y, 'vfx_atlas', `lava${v}`).setDepth(0.5).setAlpha(0.95)
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
    _vfxPaintLava(ctx, X, Y, T, v) {
        const R = this._vfxRng(v * 4099 + 11);
        ctx.clearRect(X, Y, T, T);
        for (let y = 0; y < T; y++) {
            for (let x = 0; x < T; x++) {
                const dx = (x + 0.5) / T - 0.5, dy = (y + 0.5) / T - 0.5;
                const d = Math.max(Math.abs(dx), Math.abs(dy)) * 0.8 + Math.hypot(dx, dy) * 0.28;
                const edge = 0.5 + (R() - 0.5) * 0.07;
                if (d > edge) continue;
                const heat = 1 - d / edge, n = R();
                ctx.fillStyle = heat < 0.16 ? (n < 0.5 ? '#4a0c05' : '#5e1206')
                    : n < 0.09 ? '#2a0604'
                    : heat > 0.55 && n < 0.18 ? '#ffc04a'
                    : n < 0.55 ? '#e8501a' : '#b8300c';
                ctx.fillRect(X + x, Y + y, 1, 1);
            }
        }
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
    _vfxPaintWater(ctx, X, Y, T, v, glint) {
        const R = this._vfxRng(v * 2311 + (glint ? 977 : 5));
        if (glint) {                // a glint or two; one tile in four has none, so it doesn't read as a grid
            ctx.clearRect(X, Y, T, T);
            for (let k = 0; k < [2, 1, 1, 0][v]; k++) {
                ctx.fillStyle = k ? '#8fcff5' : '#d6f1ff';
                ctx.fillRect(X + 2 + Math.floor(R() * (T - 9)), Y + 2 + Math.floor(R() * (T - 4)), 3 + Math.floor(R() * 3), 1);
            }
            return;
        }
        ctx.fillStyle = '#0f4a7c'; ctx.fillRect(X, Y, T, T);
        for (let k = 0; k < 5; k++) {
            ctx.fillStyle = '#0c3e6c';
            ctx.fillRect(X + Math.floor(R() * (T - 6)), Y + Math.floor(R() * T), 5 + Math.floor(R() * 7), 1);
        }
        for (let k = 0; k < 2; k++) {
            ctx.fillStyle = '#1d649e';
            ctx.fillRect(X + Math.floor(R() * (T - 6)), Y + Math.floor(R() * T), 3 + Math.floor(R() * 4), 1);
        }
    }

    // Flood water (the Cistern's): still one graphics for the whole map, now deep blue with a
    // lit lip where it meets dry floor, glints on the shimmer layer, and under the shade, so
    // it sits in the dark until something lights it.
    _vfxDrawWater(g, sh, tiles, steam) {
        const T = this.TILE_SIZE, has = new Set();
        for (const t of tiles) has.add(t.tx + ',' + t.ty);
        const wet = (x, y) => has.has(x + ',' + y);
        g.setDepth(0.25);
        g.clear(); if (sh?.active) sh.clear();
        // a pool, not a grid: outer corners rounded, deeper in the middle than at its shallow edges, the top
        // edge a shadowed lip (the water sits below the floor), a line of foam along the bottom
        const R = Math.round(T * 0.45);
        for (const t of tiles) {
            const x = t.tx * T, y = t.ty * T, n = !wet(t.tx, t.ty - 1), s2 = !wet(t.tx, t.ty + 1), w = !wet(t.tx - 1, t.ty), e = !wet(t.tx + 1, t.ty);
            const edge = n || s2 || w || e, r = { tl: n && w ? R : 0, tr: n && e ? R : 0, bl: s2 && w ? R : 0, br: s2 && e ? R : 0 };
            g.fillStyle(edge ? 0x14507f : 0x0f4573, 0.88);
            if (r.tl || r.tr || r.bl || r.br) g.fillRoundedRect(x, y, T, T, r); else g.fillRect(x, y, T, T);
            if (n) { g.fillStyle(0x04101c, 0.55); g.fillRect(x + (w ? R * 0.6 : 0), y, T - (w ? R * 0.6 : 0) - (e ? R * 0.6 : 0), 3); g.fillStyle(0x5cc2ff, 0.45); g.fillRect(x + (w ? R : 0), y + 3, T - (w ? R : 0) - (e ? R : 0), 1); }
            if (s2) { g.fillStyle(0xa8e4ff, 0.45); for (let k = (x / 2) % 2; k < T - 2; k += 3) g.fillRect(x + k + (w ? R * 0.5 : 0) * 0, y + T - 2, 2, 1); }
            if (w) { g.fillStyle(0x5cc2ff, 0.3); g.fillRect(x + 1, y + (n ? R : 0), 1, T - (n ? R : 0) - (s2 ? R : 0)); }
            if (e) { g.fillStyle(0x04101c, 0.3); g.fillRect(x + T - 2, y + (n ? R : 0), 2, T - (n ? R : 0) - (s2 ? R : 0)); }
        }
        if (sh?.active) {
            for (const t of tiles) {
                const h = ((t.tx * 73856093) ^ (t.ty * 19349663)) >>> 0;
                sh.fillStyle(0xa8e4ff, 0.6);
                sh.fillRect(t.tx * T + 2 + h % (T - 8), t.ty * T + 3 + (h >>> 5) % (T - 6), 4, 1);
                if (h & 1) sh.fillRect(t.tx * T + 3 + (h >>> 9) % (T - 9), t.ty * T + 3 + (h >>> 13) % (T - 6), 3, 1);
            }
        }
        // fog (dried water, steamTiles): damp dark stone with a film of condensation, baked with the water (_bakeWater) since it sits still;
        // _vfxTileFx adds the wisps boiling off it
        // (fog has its own tiles now: LevelManager._fogOn)
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
                if (Math.random() < dt / 2400 * thin && rip.length < 120) {
                    rip.push({ x: t.x + (Math.random() - 0.5) * (T - 12), y: t.y + (Math.random() - 0.5) * (T - 12), born: time, life: 700, lava: true });
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
            if (r.lava) {   // swells, then pops into a ring
                if (k < 0.6) { g2.fillStyle(0xffc04a, 0.95); g2.fillCircle(r.x, r.y, 0.8 + 2 * k / 0.6); g2.fillStyle(0xfff0b0, 0.9); g2.fillRect(r.x - 0.5, r.y - 1.5, 1, 1); }
                else { g2.lineStyle(1, 0xffd27a, (1 - k) / 0.4); g2.strokeCircle(r.x, r.y, 2.4 + 4 * (k - 0.6) / 0.4); }
            } else {
                const w = 4 + 18 * k;
                g.lineStyle(1, 0xa8e4ff, 0.55 * (1 - k)); g.strokeEllipse(r.x, r.y, w, w * 0.45);
                if (k < 0.5) { g.lineStyle(1, 0xdff6ff, 0.4 * (1 - 2 * k)); g.strokeEllipse(r.x, r.y, w * 0.5, w * 0.22); }
            }
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
                // healer totem), it used to vanish
                if (e.health < (e.maxHealth || 0) - 0.01 || e.health > (e.maxHealth || 0) + 0.01) e._vfxHurt = true;
                const show = !!e._vfxHurt;
                if (bg.visible !== show) { bg.setVisible(show); fill.setVisible(show); }
                // a cube's decay: the cut-off HP as an ice-blue piece after the fill, shrinking as it's locked in or grows back
                if (e._decayOwed > 0 && show) {
                    // (from where the fill is DRAWN: its pivot is set once and kept while its width changes, so getBounds disagrees)
                    const fx = fill.x - fill.displayOriginX + fill.width, fy = fill.y - fill.displayOriginY, w = 24 * e._decayOwed / (e.maxHealth || 1);
                    if (!e._decayBar?.active) e._decayBar = this.add.rectangle(0, 0, 1, 1, 0x9ae8ff, 0.95).setOrigin(0, 0).setDepth(4.32);
                    e._decayBar.setPosition(fx, fy).setSize(Math.max(0.5, Math.min(w, 24 - fill.width)), fill.height).setVisible(fill.alpha > 0.05);
                } else if (e._decayBar) { e._decayBar.destroy(); e._decayBar = null; }
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
        this._hudEl = txt(44, 52, 15, '#ffffff');
        this._hudTrail = this.health;
        // The scrap bank moves into the card's third row.
        const rowY = 76, bx = 82, bw = 96, bh = 8;
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
        const ch = this.orbBarBg?.visible ? 86 : 62;   // the third row (lightning's scrap bank) only when it's showing
        g.fillStyle(0x090b14, 0.82); g.fillRoundedRect(8, 8, cw, ch, 8);
        g.lineStyle(1, 0x2b3256, 0.9); g.strokeRoundedRect(8.5, 8.5, cw - 1, ch - 1, 8);
        // heart: beats when you're low
        const low = hp / max < 0.3;
        const beat = low ? 1 + 0.18 * Math.max(0, Math.sin(now / 120)) : 1;
        this._vfxHeart(g, 26, 27, 7 * beat, low ? 0xff2d4a : 0xff5a6e);
        // health bar: trail, fill, sheen, a tick every 10
        const bx = 42, by = 21, bw = 188, bh = 12, iw = bw - 2;
        g.fillStyle(0x1b0a12, 1); g.fillRoundedRect(bx, by, bw, bh, 4);
        const f = Math.min(1, hp / max), t = Math.min(1, this._hudTrail / max), over = hp > max;
        if (t > f) { g.fillStyle(0xffd0d8, 0.75); g.fillRect(bx + 1 + iw * f, by + 1, iw * (t - f), bh - 2); }
        if (f > 0) {
            g.fillStyle(over ? 0x1fd9ae : 0xe2344c, 1); g.fillRoundedRect(bx + 1, by + 1, Math.max(4, iw * f), bh - 2, 3);
            g.fillStyle(over ? 0x8affe4 : 0xff8494, 0.85); g.fillRect(bx + 3, by + 2, Math.max(0, iw * f - 5), 2);
        }
        g.fillStyle(0x000000, 0.35);
        const step = 10 * Math.ceil(max / 400);   // a tick every 10 HP, at most 40 of them (a big health pool gets a tick every 20, 30...)
        for (let k = step; k < max; k += step) g.fillRect(Math.round(bx + 1 + iw * (k / max)), by + 3, 1, bh - 6);
        g.lineStyle(1, 0x000000, 0.9); g.strokeRoundedRect(bx, by, bw, bh, 4);
        this._hudHp.setText(`${Math.ceil(hp)}/${max}`).setColor(low ? '#ff8a98' : '#ffffff');
        // element
        const el = this.currentElement, col = C.EL[el] ?? 0xffffff;
        this._vfxElIcon(g, 26, 52, el, col);
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

    _vfxHeart(g, x, y, r, color) {
        g.fillStyle(color, 1);
        g.fillCircle(x - r * 0.5, y - r * 0.25, r * 0.55);
        g.fillCircle(x + r * 0.5, y - r * 0.25, r * 0.55);
        g.fillTriangle(x - r * 1.02, y - r * 0.05, x + r * 1.02, y - r * 0.05, x, y + r * 0.95);
        g.fillStyle(0xffffff, 0.55); g.fillCircle(x - r * 0.55, y - r * 0.4, r * 0.18);
    }

    // The four element icons (the same shapes as the ult gems), small.
    _vfxElIcon(g, x, y, el, color, s = 0.85) {
        const P = pts => pts.map(([px, py]) => ({ x: x + px * s, y: y + py * s }));
        g.fillStyle(color, 1); g.lineStyle(1.8 * s, color, 1);
        if (el === 'fire') {
            g.fillPoints(P([[0, -8], [3, -3], [5.5, 1], [5, 4.5], [2.5, 7], [0, 7.5], [-2.5, 7], [-5, 4.5], [-5.5, 1], [-3.5, -1], [-2.2, -4.5]]), true);
            g.fillStyle(0xffd27a, 1); g.fillPoints(P([[0, -0.5], [2, 2.5], [2.2, 5], [0, 6.2], [-2.2, 5], [-2, 2.5]]), true);
        } else if (el === 'ice') {
            for (let k = 0; k < 3; k++) {
                const a = Math.PI / 2 + k * Math.PI / 3, c = Math.cos(a) * s, sn = Math.sin(a) * s;
                g.lineBetween(x - c * 7.5, y - sn * 7.5, x + c * 7.5, y + sn * 7.5);
            }
        } else if (el === 'lightning') {
            g.fillPoints(P([[2, -8], [-4, 1.5], [-0.5, 1.5], [-2.5, 8], [4.5, -1.5], [1, -1.5], [3.5, -8]]), true);
        } else {
            g.fillPoints(P([[0, -8], [1.8, -1.8], [8, 0], [1.8, 1.8], [0, 8], [-1.8, 1.8], [-8, 0], [-1.8, -1.8]]), true);
        }
    }
}
