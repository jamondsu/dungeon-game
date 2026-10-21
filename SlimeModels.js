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
    _board(P) {   // a surfboard under it: cream, a red stripe, a pointed nose
        const b = P.bot, L0 = Math.max(0, P.l(b) - 3), R0 = Math.min(P.w - 2, P.r(b) + 3), mid = (L0 + R0) >> 1;
        for (let x = L0; x <= R0; x++) {
            const end = x === L0 || x === R0;
            if (!end) P.put(x, b - 2, 0x1a1210);
            P.put(x, b - 1, end ? 0x1a1210 : Math.abs(x - mid) <= 1 ? 0xe8503a : x < mid - 3 ? 0xfff4dc : 0xf0dcb0);
            if (!end) P.put(x, b, x > R0 - 3 ? 0x1a1210 : 0x8a6a4a);
        }
        P.put(R0 + 1, b - 1, 0x1a1210);
    },
    _flowers(P, n) {   // n tiny flowers on the body: four petals round a sun-yellow middle, pink and white in turn
        const spots = [[-5, 3], [4, 2], [-1, 5], [6, 5], [-7, 6]].slice(0, n);
        spots.forEach(([dx, dy], i) => {
            const x = P.cx + dx, y = P.top + dy, pet = i % 2 ? 0xffffff : 0xff9ad8;
            if (!P.solid(x, y)) return;
            for (const [ox, oy] of [[0, -1], [-1, 0], [1, 0], [0, 1]]) if (P.solid(x + ox, y + oy)) P.put(x + ox, y + oy, pet);
            P.put(x, y, 0xffd84a);
        });
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
        // ── the Wave Rider: a surfer slime, teal and foam, riding its board with a curl of wave over its head
        waverider: { pal: [[6, 30, 40], [18, 98, 120], [38, 162, 182], [120, 222, 230], [232, 255, 255]], paint(P) {
            SlimeModels._board(P);
            P.stamp(['..kkk...', '.kWWwk..', 'kwk.kWk.', 'k....kwk', '......k.'], P.cx - 5, P.top - 5, { k: 0x0a2a3a, W: 0xffffff, w: 0x9fe8ff });   // the curl
        } },
        // ── the Tidecaller: a deep-blue slime bobbing in a red-and-white swim ring (its rain cloud is its hat)
        tidecaller: { pal: [[8, 16, 48], [20, 50, 130], [42, 92, 200], [110, 160, 240], [220, 236, 255]], paint(P) {
            const yt = P.bot - 4, l = P.l(yt + 1) - 2, r = P.r(yt + 1) + 2;
            for (let x = l; x <= r; x++) {
                const stripe = Math.floor((x - l) / 3) % 2 ? 0xffffff : 0xe03a3a, end = x === l || x === r;
                P.put(x, yt, end ? 0x2a0a0a : 0x2a0a0a);
                P.put(x, yt + 1, end ? 0x2a0a0a : (stripe === 0xffffff ? 0xffffff : 0xff6a5a));   // its lit top
                P.put(x, yt + 2, end ? 0x2a0a0a : (stripe === 0xffffff ? 0xd8d8e0 : 0xb82424));
                P.put(x, yt + 3, 0x2a0a0a);
            }
        } },
        // ── the Budding Slime: spring green, little flowers blooming over its body (its head grows its life cycle: hats)
        bud: { pal: [[20, 48, 18], [52, 120, 40], [98, 180, 66], [168, 228, 110], [236, 255, 200]], paint(P) { SlimeModels._flowers(P, 4); } },
        budcopy: { pal: [[20, 48, 18], [52, 120, 40], [98, 180, 66], [168, 228, 110], [236, 255, 200]], paint(P) { SlimeModels._flowers(P, 2); } },
        // ── the Void Sniper: an assassin, near-black (its purple shades and mask are hats)
        voidsniper: { pal: [[8, 6, 14], [26, 20, 40], [46, 36, 68], [76, 62, 104], [128, 108, 168]] },
        // ── the Splitter: an orange slime already coming apart, a glowing seam zigzagging down its middle, a nub either side
        splitter: { pal: [[34, 10, 4], [124, 44, 10], [204, 86, 22], [244, 146, 52], [255, 222, 146]], paint(P) {
            for (let y = P.top + 1; y < P.bot; y++) { const x = P.cx + ((y % 2) ? 0 : 1); P.put(x, y, 0x2a0a02); P.put(x + 1, y, 0xffe08a); if (y % 2) P.put(x - 1, y, 0x8a2a08); }
            for (const s of [-1, 1]) P.stamp(['kk', 'oo'], P.cx + s * 6 - (s < 0 ? 1 : 0), P.top, { k: 0x220802, o: 0xf09040 });   // the two halves bulging apart
        } },
        // ── the Encased Slime: a boulder of plated stone with a slime inside, its eyes and its red glow showing through a slit
        encased: { pal: [[22, 18, 14], [70, 62, 54], [104, 94, 82], [140, 130, 114], [186, 178, 160]], paint(P) {
            for (let y = P.top + 1; y < P.bot; y++) for (let x = P.l(y) + 1; x < P.r(y); x++) {   // a boulder: mottled stone
                const h = P.hash(x, y);
                if (h < 14) P.put(x, y, 0x4a4238); else if (h > 88) P.put(x, y, 0xb4aa94);
            }
            for (const [x0, dx] of [[P.l(P.top + 2) + 2, 1], [P.r(P.top + 2) - 2, -1]]) {   // cracks running down it, lit from inside
                let x = x0; for (let y = P.top + 1; y < P.bot - 1; y++) { P.put(x, y, 0xff9030); if (y % 2) x += dx; }
            }
            const y = P.top + 4;   // the slit across its face, the slime inside glowing red, its eyes looking out
            for (let x = P.cx - 5; x <= P.cx + 5; x++) { P.put(x, y - 1, 0x140806); P.put(x, y, 0xc02018); P.put(x, y + 1, 0x7a0e0e); P.put(x, y + 2, 0x140806); }
        } },
        // ── the Ripplerunner: a sleek water slime, ripples running round it, a splash over its head
        ripplerunner: { pal: [[6, 28, 44], [18, 92, 126], [40, 164, 204], [132, 232, 252], [232, 255, 255]], paint(P) {
            for (const dy of [2, 4]) { const y = P.bot - dy; for (let x = P.l(y) + 1; x < P.r(y); x++) if ((x + dy) % 3 !== 0) P.put(x, y, 0x8ae8ff); }
            const y = P.bot - 4;   // fins out to either side, for skimming the water
            P.stamp(['kk..', 'kWWk', '.kkk'], P.l(y) - 3, y - 1, { k: 0x0a3a52, W: 0x9fe8ff });
            P.stamp(['..kk', 'kWWk', 'kkk.'], P.r(y), y - 1, { k: 0x0a3a52, W: 0x9fe8ff });
        } },
        // ── the Spitter: a sour-yellow slime with a puckered mouth at its front, a bead of spit hanging off it
        ranged: { pal: [[42, 34, 8], [142, 114, 22], [212, 184, 44], [250, 232, 112], [255, 250, 214]], paint(P) {
            P.stamp(['.kkk.', 'kRoRk', '.kgk.', '..g..'], P.cx - 2, P.bot - 4, { k: 0x2a1a06, R: 0xb84a2a, o: 0x3a1206, g: 0x9ad84a });
        } },
        // ── the Mortar: a grey volcano of a slime, its top a cone with lava in the crater
        mortar: { pal: [[22, 22, 26], [62, 64, 72], [102, 106, 114], [142, 146, 152], [190, 192, 198]], paint(P) {
            P.stamp(['.kkkkk.', 'kOoooOk', '.kOOOk.'], P.cx - 3, P.top - 1, { k: 0x16161a, O: 0xff7a1a, o: 0xffd060 });   // the crater in its top, lava in it
            for (const [dx, len] of [[-2, 4], [2, 3]]) for (let k = 0; k < len; k++) P.put(P.cx + dx + (dx < 0 ? -(k >> 1) : (k >> 1)), P.top + 2 + k, k === len - 1 ? 0xff9a3a : 0xd8461a);   // lava running down its flanks
            for (let y = P.top + 3; y < P.bot; y += 2) for (let x = P.l(y) + 2; x < P.r(y) - 1; x += 4) P.put(x + (y % 4 ? 2 : 0), y, 0x4a4c54);   // the rock's pits
        } },
        // ── the Singularity Slime: thick dark goo, glossy, drips running down it and a puddle spreading at its base
        singularity: { pal: [[14, 4, 24], [50, 12, 80], [90, 32, 140], [140, 72, 200], [214, 156, 255]], paint(P) {
            for (const [dx, len] of [[-5, 5], [-1, 3], [4, 6]]) {
                const x = P.cx + dx;
                for (let y = P.top + 2; y < P.top + 2 + len && y < P.bot; y++) P.put(x, y, 0xb070ff);
                P.put(x, P.top + 2 + len, 0xe0b0ff); P.put(x - 1, P.top + 2 + len, 0x8a40d0);
            }
            const b = P.bot, l = P.l(b - 1), r = P.r(b - 1);   // the goo spreading at its foot
            for (const [x, y, c] of [[l - 1, b, 0x3a0e60], [l - 2, b, 0x0e0418], [l - 1, b - 1, 0x0e0418], [r + 1, b, 0x3a0e60], [r + 2, b, 0x0e0418], [r + 1, b - 1, 0x0e0418]]) P.put(x, y, c);
        } },
        // ── the Gem: a slime cut like a jewel: facets in every colour, white edges between them catching light, shards on its
        // back (its colours turn round the wheel as it lives: LevelManager._gemTick)
        gem: { paint(P) {
            const seeds = [[-5, 2], [1, 1], [6, 3], [-6, 7], [-1, 6], [5, 7]];
            const facet = (x, y) => { let best = 0, bd = 1e9; seeds.forEach(([dx, dy], i) => { const d = (x - P.cx - dx) ** 2 + ((y - P.top - dy) * 1.4) ** 2; if (d < bd) { bd = d; best = i; } }); return best; };
            for (let y = P.top + 1; y < P.bot; y++) for (let x = P.l(y) + 1; x < P.r(y); x++) {
                if (P.tone(x, y) <= 0) continue;
                const f = facet(x, y), edge = facet(x + 1, y) !== f || facet(x, y - 1) !== f;
                const lit = 0.74 + 0.26 * (((f * 37) % 10) / 10) + (y < P.top + 3 ? 0.08 : 0) - (y > P.bot - 3 ? 0.14 : 0);
                const c = SlimeModels.hsv((f * 60 + 15) % 360, 0.8, Math.min(1, lit));
                P.put(x, y, edge ? MenuArt.mix(c, 0xffffff, 0.6) : c);   // a facet, its edge a paler line of its own colour
            }
            for (const [x, y] of [[P.cx - 5, P.top + 2], [P.cx + 2, P.top + 3], [P.cx - 1, P.top + 6]]) P.put(x, y, 0xffffff);   // glints
            P.stamp(['..k.....k..', '.kAk...kBk.', '.kaCk.kDbk.', 'kAacCkkDdbk'], P.cx - 5, P.top - 4,
                { k: 0x18142c, A: 0xff6ad8, a: 0xb03aa0, C: 0x6ae8ff, c: 0x2a9ac8, B: 0xffe060, b: 0xd09a20, D: 0x8aff7a, d: 0x3ab84a });
        } },
        // ── the Armored Slime: a steel slime in a fitted helmet (a smooth dome with a riveted rim over its eyes, a crest on top)
        // and chainmail below; the side it left open glows (LevelManager._updateArmored)
        armored: { pal: [[18, 20, 26], [70, 78, 92], [112, 122, 140], [162, 172, 190], [226, 232, 244]], paint(P) {
            const rim = P.top + 3;
            for (let y = P.top + 1; y < rim; y++) for (let x = P.l(y) + 1; x < P.r(y); x++) P.put(x, y, x < P.cx - 2 ? 0xe2e8f4 : x < P.cx + 3 ? 0xb4bccc : 0x8a94a8);   // the dome, lit from the left
            for (let x = P.l(rim); x <= P.r(rim); x++) P.put(x, rim, (x - P.l(rim)) % 4 === 2 ? 0xf0f4fc : 0x2a2e38);   // its rim, riveted
            for (let y = rim + 4; y < P.bot; y++) for (let x = P.l(y) + 1; x < P.r(y); x++) if ((x + y) % 2) P.put(x, y, 0x5a6476);   // chainmail
            P.stamp(['.k.', 'kWk', 'kwk'], P.cx - 1, P.top - 2, { k: 0x10121a, W: 0xe8eef8, w: 0x8a94a6 });   // the crest
        } },
        // ── the Slime CEO: charcoal pinstripe, gold buttons (its hat and tie stay)
        ceo: { pal: [[14, 14, 18], [40, 40, 50], [66, 68, 80], [104, 108, 122], [168, 172, 186]], paint(P) {
            for (let y = P.top + 2; y < P.bot; y++) for (let x = P.l(y) + 2; x < P.r(y) - 1; x += 3) if (P.tone(x, y) > 0) P.put(x, y, 0x5a5c6c);
            for (let y = P.top + 4; y < P.bot - 1; y += 2) P.put(P.cx, y, 0xffd84a);
        } },
        // ── the Wishing Well: a living well, a ring of mossy stone brick with water standing in its top
        wishingwell: { pal: [[20, 22, 22], [70, 74, 72], [110, 114, 108], [150, 152, 142], [190, 192, 180]], paint(P) {
            SlimeModels._plates(P, 4, 0x2a2c2a, 0xc0c2b4, null);
            for (let x = P.l(P.top + 1); x <= P.r(P.top + 1); x++) { P.put(x, P.top, 0x16181a); P.put(x, P.top + 1, (x % 4) ? 0x2a6aa8 : 0x9fe0ff); }
            for (let x = P.l(P.bot - 1) + 1; x < P.r(P.bot - 1); x += 4) P.put(x, P.bot - 1, 0x4a7a3a);   // moss at its foot
        } },
        // ── the Conduit: an electrical part come alive: a steel can with copper bands and a hazard stripe round its middle
        conduit: { pal: [[16, 18, 22], [60, 66, 76], [104, 112, 124], [150, 158, 170], [214, 222, 232]], paint(P) {
            for (const y of [P.top + 2, P.bot - 2]) for (let x = P.l(y) + 1; x < P.r(y); x++) P.put(x, y, x % 3 ? 0xc87a3a : 0xffb070);
            const y = P.top + 5;
            for (let x = P.l(y) + 1; x < P.r(y); x++) { P.put(x, y, ((x >> 1) % 2) ? 0xffd030 : 0x1a1a1a); P.put(x, y + 1, ((x >> 1) % 2) ? 0x1a1a1a : 0xffd030); }
        } },
        // ── the Frostborn (a Frost Slime's second life): deep ice, jagged spikes along its back, cracks of cold light
        frostborn: { pal: [[6, 16, 40], [16, 48, 110], [36, 96, 190], [96, 170, 250], [200, 236, 255]], paint(P) {
            for (let i = 0, n = 5; i < n; i++) {
                const x = P.l(P.top + 2) + 2 + i * 3, h = [3, 5, 6, 5, 3][i], y0 = P.top + 1;
                for (let k = 1; k <= h; k++) { P.put(x, y0 - k, k === h ? 0xffffff : 0x9fe8ff); if (k < h - 1) P.put(x + 1, y0 - k, 0x3a7ad8); }
                P.put(x - 1, y0 - 1, 0x0a1838);
            }
            for (let y = P.top + 2; y < P.bot; y += 2) { const x = P.cx - 4 + ((y * 5) % 9); P.put(x, y, 0x9ffcff); P.put(x + 1, y + 1, 0x9ffcff); }
        } },
    },
};
