// ═══════════════════════════════════════════════════════════════════════════
// SlimeModels.js — enemy bodies drawn as their own creatures, not tints of the red slime.
//
// A model is the red slime's sheet redrawn: every frame recoloured to the model's five
// shades (by brightness, as LevelManager.slimeRecolor does), then painted over with what
// makes it itself: a shell, a crack, a crest, a board. Painted into the frames, not laid
// over them, so it squashes, breathes and hops with the body. Things worn on the head
// stay hats (Creatures.js art().hats), which follow the body the same way.
//
// SlimeModels.key(scene, kind) builds a model's texture (and its two-frame idle) once and
// returns the key, or null for a kind with no model. The body is ~17x10 pixels at the bottom
// of a 32x32 frame; a painter gets the frame's body bounds to place things by.
// A model with a file in assets/art (slime_m_<kind>, typed by hand: its atk_* frames too) is that file; an empty DEF
// is just its name.
// ═══════════════════════════════════════════════════════════════════════════

const SlimeModels = {
    key(scene, kind) {
        const def = SlimeModels.DEFS[kind], TX = scene?.textures;
        if (!def || !TX) return null;
        const key = 'slime_m_' + kind;
        if (!TX.exists(key)) {
            const src = TX.exists('slime_red') ? TX.get('slime_red') : null, img = src?.getSourceImage();
            if (!img) return null;
            const work = document.createElement('canvas'); work.width = img.width; work.height = img.height;
            const wctx = work.getContext('2d', { willReadFrequently: true });   // pixel work on the CPU
            wctx.drawImage(img, 0, 0);
            const d = wctx.getImageData(0, 0, img.width, img.height), px = d.data, W = img.width;
            for (const name of src.getFrameNames()) SlimeModels._frame(px, W, src.get(name), def);
            wctx.putImageData(d, 0, 0);
            const t = TX.createCanvas(key, img.width, img.height);
            t.getContext().drawImage(work, 0, 0);
            for (const name of src.getFrameNames()) { const f = src.get(name); t.add(name, 0, f.cutX, f.cutY, f.cutWidth, f.cutHeight); }
            t.refresh();
        }
        if (!scene.anims.exists(key + '_idle')) scene.anims.create({ key: key + '_idle', frames: [{ key, frame: 0 }, { key, frame: 18 }], frameRate: 2, repeat: -1 });
        return key;
    },
    // Put model `kind` on a sprite (keeping its frame), its tint cleared. True if it had one.
    wear(scene, sprite, kind) {
        const k = SlimeModels.key(scene, kind);
        if (!k || !sprite?.setTexture) return false;
        if (sprite._cfxTint) sprite._cfxTint.base = null;   // (keepTint would put the maker's tint back over the model)
        sprite.clearTint?.();
        sprite.setTexture(k, 0); sprite.play(k + '_idle');
        return true;
    },

    _frame(px, W, f, def) {
        const x0 = f.cutX, y0 = f.cutY, fw = f.cutWidth, fh = f.cutHeight;
        const at = (x, y) => ((y0 + y) * W + x0 + x) * 4;
        const inF = (x, y) => x >= 0 && y >= 0 && x < fw && y < fh;
        const solid = (x, y) => inF(x, y) && px[at(x, y) + 3] > 0;
        let top = Infinity, bot = -1;
        for (let y = 0; y < fh; y++) for (let x = 0; x < fw; x++) if (solid(x, y)) { top = Math.min(top, y); bot = Math.max(bot, y); }
        if (bot < 0) return;
        const tone = new Map();   // each body pixel's shade, 0 (outline) to 4 (highlight), from the red slime
        for (let y = top; y <= bot; y++) for (let x = 0; x < fw; x++) {
            if (!solid(x, y)) continue;
            const i = at(x, y), L = (0.3 * px[i] + 0.59 * px[i + 1] + 0.11 * px[i + 2]) / 255, t = L < 0.15 ? 0 : L < 0.33 ? 1 : L < 0.5 ? 2 : L < 0.7 ? 3 : 4;
            tone.set(x + ',' + y, t);
            if (def.pal) { const c = def.pal[t]; px[i] = c[0]; px[i + 1] = c[1]; px[i + 2] = c[2]; }
        }
        const rowL = y => { for (let x = 0; x < fw; x++) if (solid(x, y)) return x; return -1; };
        const rowR = y => { for (let x = fw - 1; x >= 0; x--) if (solid(x, y)) return x; return -1; };
        const P = {
            w: fw, h: fh, top, bot, cx: Math.round((rowL(bot - 1) + rowR(bot - 1)) / 2), l: rowL, r: rowR, solid,
            tone: (x, y) => tone.get(x + ',' + y) ?? -1,
            put(x, y, c, a = 255) { if (!inF(x, y)) return; const i = at(x, y); px[i] = c >> 16 & 255; px[i + 1] = c >> 8 & 255; px[i + 2] = c & 255; px[i + 3] = a; },
            clear(x, y) { if (inF(x, y)) px[at(x, y) + 3] = 0; },
            alpha(x, y, a) { if (solid(x, y)) px[at(x, y) + 3] = a; },
            // pixel rows ('.' skipped) with a palette of one-letter colours, top-left at (x, y)
            stamp(rows, x, y, pal) { rows.forEach((row, j) => [...row].forEach((ch, i) => { if (ch !== '.' && pal[ch] !== undefined) P.put(x + i, y + j, pal[ch]); })); },
            hash: (a, b) => (((a * 73856093) ^ (b * 19349663)) >>> 0) % 100,
        };
        def.paint?.(P);
    },

    // shared bits
    hsv(h, s, v) {   // a colour from hue (degrees), saturation and value, as 0xRRGGBB
        const f = n => { const k = (n + h / 60) % 6; return v - v * s * Math.max(0, Math.min(k, 4 - k, 1)); };
        return (Math.round(f(5) * 255) << 16) | (Math.round(f(3) * 255) << 8) | Math.round(f(1) * 255);
    },
    _plates(P, cell, seam, lit, crack) {   // stone or steel plates over the body: seams in a brick lay, light on each plate's top
        for (let y = P.top + 1; y < P.bot; y++) for (let x = 0; x < P.w; x++) {
            const t = P.tone(x, y);
            if (t <= 0) continue;
            const ox = x + (Math.floor(y / 3) % 2) * 2, lx = ox % cell, ly = y % 3, cx = Math.floor(ox / cell), cy = Math.floor(y / 3);
            if (lx === cell - 1 || ly === 2) P.put(x, y, crack && P.hash(cx + 3, cy + 9) < 16 ? crack : seam);
            else if (ly === 0 && lit) P.put(x, y, lit);
        }
    },

    DEFS: {
        // ── the Wave Rider, the Tidecaller, the Ripplerunner, the Drowner, the Tidal Guard: drawn by hand (assets/art/slime_m_<kind>.png)
        waverider: {},
        tidecaller: {},
        // ── the Budding Slime and its copy, the Storm Elemental: drawn by hand (assets/art/slime_m_<kind>.png; pal: their card's colours)
        bud: { pal: [[20, 48, 18], [52, 120, 40], [98, 180, 66], [168, 228, 110], [236, 255, 200]] },
        budcopy: { pal: [[20, 48, 18], [52, 120, 40], [98, 180, 66], [168, 228, 110], [236, 255, 200]] },
        lightningelem: { pal: [[23, 36, 14], [74, 138, 56], [178, 212, 42], [230, 250, 72], [255, 252, 196]] },
        // ── the plain slime (frames 0 and 18 the red slime's own), the Spitter, the Berserker, the Splitter, the Mortar, the
        // Rooter, the Sniper, the Void Sniper: drawn by hand, their head gear on them (assets/art/slime_m_<kind>.png)
        slime: {}, ranged: {}, berserker: {}, splitter: {}, mortar: {}, rooter: {}, sniper: {}, voidsniper: {},
        // ── the Encased Slime, the Singularity Slime, the Armored Slime (and its four open sides), the Frostborn: drawn by hand
        encased: { pal: [[22, 18, 14], [70, 62, 54], [104, 94, 82], [140, 130, 114], [186, 178, 160]] },
        ripplerunner: {},
        drowner: {},
        tidalguard: {},
        singularity: { pal: [[14, 4, 24], [50, 12, 80], [90, 32, 140], [140, 72, 200], [214, 156, 255]] },
        // ── the Gem: drawn by hand (assets/art/slime_m_gem.png; its colours turn round the wheel as it lives: LevelManager._gemTick)
        gem: {},
        armored: { pal: [[18, 20, 26], [70, 78, 92], [112, 122, 140], [162, 172, 190], [226, 232, 244]] },
        armored_E: {}, armored_W: {}, armored_N: {}, armored_S: {},
        // ── the Slime CEO, the Wishing Well, the Conduit: drawn by hand (assets/art/slime_m_<kind>.png)
        ceo: {},
        wishingwell: {},
        conduit: {},
        frostborn: { pal: [[6, 16, 40], [16, 48, 110], [36, 96, 190], [96, 170, 250], [200, 236, 255]] },
        // ── the Blinder: drawn by hand (assets/art/slime_m_blinder.png; pal: its card's colours)
        blinder: { pal: [[21, 15, 30], [76, 65, 102], [108, 94, 136], [154, 136, 180], [220, 202, 238]] },
    },
};
