// ═══════════════════════════════════════════════════════════════════════════
// Menus.js — the art of the menus, and the Cistern's water under the map.
//
// A static helper (not a mixin), like UIKit and Transitions, so any scene can call it:
//
//   icons     a pixel-art icon for every weapon, four frames of idle each (flames flicker,
//             ice glints, bolts crackle, stars turn), shown on its shop card on a lit plinth
//             with its element drifting off it: MenuArt.weaponShowcase
//   levels    a painted diorama on every level card, with its life on top (torches, rain and
//             lightning, the rift breathing, current running the traces, the horde, the
//             Sovereign on its throne): MenuArt.diorama
//   cistern   level 5's drowned hall under the map, caustics and shafts of light, built for
//             the zoomed world camera: MenuArt.cistern (from GameScene.create)
//
// Everything is painted at runtime into small pixel buffers (MenuArt.Px) and kept as
// textures, so nothing here loads a file. Motion is tweens, timers and emitters on a handful
// of objects, all torn down with the card (or the scene) that owns them.
// ═══════════════════════════════════════════════════════════════════════════
class MenuArt {

    // ── SHARED ───────────────────────────────────────────────────────────────
    static rng(seed) {
        let a = (seed >>> 0) || 1;
        return () => {
            a = (a + 0x6D2B79F5) >>> 0;
            let t = Math.imul(a ^ (a >>> 15), a | 1);
            t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
            return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
        };
    }

    // Smooth value noise. With `period` set it wraps every `period` cells, so a texture
    // built from it tiles without a seam.
    static noise(seed, period = 0) {
        const h = (x, y) => {
            if (period) { x = ((x % period) + period) % period; y = ((y % period) + period) % period; }
            let n = (Math.imul(x, 374761393) + Math.imul(y, 668265263) + Math.imul(seed, 2246822519)) >>> 0;
            n = Math.imul(n ^ (n >>> 13), 1274126177) >>> 0;
            return ((n ^ (n >>> 16)) >>> 0) / 4294967296;
        };
        const s = t => t * t * (3 - 2 * t);
        return (x, y) => {
            const x0 = Math.floor(x), y0 = Math.floor(y), fx = s(x - x0), fy = s(y - y0);
            const a = h(x0, y0), b = h(x0 + 1, y0), c = h(x0, y0 + 1), d = h(x0 + 1, y0 + 1);
            return a + (b - a) * fx + (c - a) * fy + (a - b - c + d) * fx * fy;
        };
    }
    // A few octaves of it, 0..1.
    static fbm(n, x, y, oct = 3) {
        let v = 0, amp = 0.5, f = 1, tot = 0;
        for (let i = 0; i < oct; i++) { v += n(x * f, y * f) * amp; tot += amp; amp *= 0.5; f *= 2; }
        return v / tot;
    }

    static mix(c0, c1, t) {
        t = Math.max(0, Math.min(1, t));
        const r = ((c0 >> 16) & 255) + (((c1 >> 16) & 255) - ((c0 >> 16) & 255)) * t;
        const g = ((c0 >> 8) & 255) + (((c1 >> 8) & 255) - ((c0 >> 8) & 255)) * t;
        const b = (c0 & 255) + ((c1 & 255) - (c0 & 255)) * t;
        return (Math.round(r) << 16) | (Math.round(g) << 8) | Math.round(b);
    }
    static hex(s) { return typeof s === 'number' ? s : parseInt(String(s).replace('#', ''), 16); }

    // The 4x4 ordered-dither threshold at a pixel, 0..1. Gradients in this file step between
    // a few flat colours through this pattern, the way pixel art does, instead of smoothing.
    static bayer(x, y) {
        const B = MenuArt._BAYER || (MenuArt._BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5]);
        return (B[(y & 3) * 4 + (x & 3)] + 0.5) / 16;
    }

    // A texture painted once into a pixel buffer and kept for the rest of the game.
    static tex(scene, key, w, h, paint, { linear = false } = {}) {
        const tm = scene.textures;
        if (tm.exists(key)) return key;
        const P = new MenuArt.Px(w, h);
        paint(P);
        P.toTexture(scene, key, linear);
        return key;
    }

    // An old map's parchment, painted at half size (drawn 2x): torn, ragged edges with bites
    // ripped out and a corner gone, a scorched rim, grain and fibres, water stains and rings,
    // fold creases, and a couple of burnt holes. `holes` / `corner` say where the paper isn't,
    // in full-size pixels from its top left (for the nails and anything else that wants to know).
    static parchment(scene, key, fw, fh, seed = 1337) {
        const W = Math.ceil(fw / 2), H = Math.ceil(fh / 2), R = MenuArt.rng(seed), n = MenuArt.noise(seed), n2 = MenuArt.noise(seed + 7);
        const bites = [];
        for (let k = 0; k < 7; k++) bites.push({ side: Math.floor(R() * 4), at: R(), depth: 5 + R() * 11, wd: 6 + R() * 16 });
        const holes = [0, 1].map(() => ({ x: W * (0.15 + R() * 0.7), y: H * (0.2 + R() * 0.6), r: 2.5 + R() * 2.5 }));
        const stains = Array.from({ length: 14 }, () => ({ x: R() * W, y: R() * H, r: 6 + R() * 30, ring: R() < 0.4, a: 0.08 + R() * 0.14 }));
        const CORNER = 46;
        const rag = (side, along, len) => {
            let v = 1.5 + MenuArt.fbm(n, along * 0.07, side * 13.1, 3) * 6 + n2(along * 0.7, side * 5) * 1.6;
            for (const b of bites) if (b.side === side) {
                const t = Math.abs(along - b.at * len) / b.wd;
                if (t < 1) v += b.depth * Math.pow(1 - t, 1.4) * (0.75 + 0.5 * n2(along * 0.9, b.at * 50));
            }
            return v;
        };
        const key2 = MenuArt.tex(scene, key, W, H, P => {
            const RL = [], RR = [], RT = [], RB = [];
            for (let y = 0; y < H; y++) { RL[y] = rag(0, y, H); RR[y] = rag(1, y, H); }
            for (let x = 0; x < W; x++) { RT[x] = rag(2, x, W); RB[x] = rag(3, x, W); }
            const foldX = W / 2, foldY = [H / 3, H * 2 / 3];
            for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
                const cornerD = (W - 1 - x) + (H - 1 - y) - (CORNER + n(x * 0.3, y * 0.3) * 6);   // the bottom right corner, torn away
                let de = Math.min(x - RL[y], W - 1 - RR[y] - x, y - RT[x], H - 1 - RB[x] - y, cornerD);
                let hole = Infinity;
                for (const h of holes) hole = Math.min(hole, Math.hypot(x - h.x, y - h.y) - h.r - n(x * 0.5, y * 0.5) * 1.5);
                de = Math.min(de, hole);
                if (de < 0) continue;
                // the paper: grain, fibres
                let c = MenuArt.mix(0xc4a87c, 0xe8d6ae, MenuArt.fbm(n, x * 0.035, y * 0.035, 4));
                const fib = n2(x * 0.7, y * 0.7);   // fibres as specks every way (stretched one way, they read as rain)
                if (fib > 0.86) c = MenuArt.mix(c, 0xf2e4c4, 0.25); else if (fib < 0.1) c = MenuArt.mix(c, 0xa88c60, 0.18);
                for (const st of stains) {
                    const d = Math.hypot(x - st.x, y - st.y) / st.r;
                    if (st.ring ? Math.abs(d - 1) < 0.07 : d < 1) c = MenuArt.mix(c, 0x8a6a3a, st.ring ? st.a * 2.2 : st.a * (1 - d * d));
                }
                // creases: a dark valley with a lit ridge beside it, wandering a little
                const fx = foldX + (n(y * 0.05, 3) - 0.5) * 3;
                if (Math.abs(x - fx) < 0.6) c = MenuArt.mix(c, 0x7a5a32, 0.5); else if (Math.abs(x - fx - 1) < 0.6) c = MenuArt.mix(c, 0xf6ead0, 0.4);
                for (const fy0 of foldY) {
                    const fy = fy0 + (n(x * 0.05, fy0) - 0.5) * 3;
                    if (Math.abs(y - fy) < 0.6) c = MenuArt.mix(c, 0x7a5a32, 0.45); else if (Math.abs(y - fy - 1) < 0.6) c = MenuArt.mix(c, 0xf6ead0, 0.35);
                }
                // scorched toward the edge (dithered bands, the way pixel art steps a gradient)
                const th = MenuArt.bayer(x, y);
                if (de < 1.2) c = 0x24140a;
                else if (de < 2.6) c = MenuArt.mix(0x4a2a10, c, th * 0.3);
                else if (de < 6) c = MenuArt.mix(c, 0x6a4018, (1 - (de - 2.6) / 3.4) * 0.85 > th ? 0.75 : 0.25);
                else if (de < 14) c = MenuArt.mix(c, 0x9a7444, (1 - (de - 6) / 8) * 0.5);
                P.put(x, y, c);
            }
        });
        return { key: key2, scale: 2, holes: holes.map(h => ({ x: h.x * 2, y: h.y * 2 })), corner: CORNER * 2 };
    }

    // The small shared textures: a pixel, a soft glow, a soft shaft of light, a pixel ring.
    static basics(scene) {
        const tm = scene.textures;
        if (tm.exists('mn_px')) return;
        MenuArt.tex(scene, 'mn_px', 1, 1, P => P.put(0, 0, 0xffffff));
        MenuArt.tex(scene, 'mn_px2', 2, 2, P => P.rect(0, 0, 2, 2, 0xffffff));
        MenuArt.tex(scene, 'mn_streak', 1, 5, P => { for (let y = 0; y < 5; y++) P.put(0, y, 0xffffff, 0.35 + y * 0.16); });
        MenuArt.tex(scene, 'mn_spark', 5, 5, P => {
            P.put(2, 0, 0xffffff, 0.6); P.put(2, 4, 0xffffff, 0.6); P.put(0, 2, 0xffffff, 0.6); P.put(4, 2, 0xffffff, 0.6);
            P.put(2, 1, 0xffffff); P.put(2, 3, 0xffffff); P.put(1, 2, 0xffffff); P.put(3, 2, 0xffffff); P.put(2, 2, 0xffffff);
        });
        MenuArt.tex(scene, 'mn_flake', 5, 5, P => {
            for (const [x, y] of [[2, 0], [2, 4], [0, 2], [4, 2], [1, 1], [3, 3], [1, 3], [3, 1]]) P.put(x, y, 0xffffff, 0.75);
            P.put(2, 2, 0xffffff);
        });
        MenuArt.tex(scene, 'mn_ring', 15, 9, P => P.ringE(7, 4, 7, 4, 0xffffff, 1));
        // soft things want smooth filtering
        MenuArt.tex(scene, 'mn_glow', 64, 64, P => {
            for (let y = 0; y < 64; y++) for (let x = 0; x < 64; x++) {
                const d = Math.hypot(x + 0.5 - 32, y + 0.5 - 32) / 32;
                if (d < 1) P.put(x, y, 0xffffff, Math.pow(1 - d, 2.2));
            }
        }, { linear: true });
        MenuArt.tex(scene, 'mn_shaft', 32, 128, P => {
            for (let y = 0; y < 128; y++) for (let x = 0; x < 32; x++) {
                const across = 1 - Math.abs(x + 0.5 - 16) / 16, along = y / 128;
                const a = Math.pow(across, 1.6) * Math.min(1, along * 3) * Math.pow(1 - along, 0.7);
                if (a > 0.004) P.put(x, y, 0xffffff, a);
            }
        }, { linear: true });
        MenuArt.tex(scene, 'mn_fade', 4, 64, P => {   // opaque at the bottom, clear at the top
            for (let y = 0; y < 64; y++) for (let x = 0; x < 4; x++) P.put(x, y, 0xffffff, Math.pow(y / 63, 1.4));
        }, { linear: true });
    }

    // ── WEAPON ICONS ─────────────────────────────────────────────────────────
    // Each icon is a 24x24 map of materials (built from a few shapes), shaded from the top
    // left, outlined in the slimes' outline colour, and then dressed with its idle effect,
    // one of four frames: flames that flicker, bolts that crackle, glints that travel, stars
    // that turn. Uppercase is the material, lowercase forces its brightest tone, '1' is a
    // seam in the material's darkest tone.
    static ICON_MAT() {
        return MenuArt._mat || (MenuArt._mat = {
            S: [0x2f3644, 0x56627a, 0x8e9bb0, 0xdbe6f2],   // steel
            G: [0x6b4a12, 0xa8781e, 0xe8b432, 0xfff0a0],   // brass
            W: [0x3a2213, 0x5e3a1e, 0x8a5a2e, 0xb88048],   // wood
            L: [0x2a1a14, 0x4a2c1e, 0x6e4430, 0x94604a],   // leather
            F: [0x5c120a, 0xa8260e, 0xe85a1c, 0xffb050],   // red-hot iron
            M: [0x4a0c06, 0xc8300c, 0xff7a1a, 0xffe070],   // magma
            I: [0x163e72, 0x2f78c8, 0x5cb8ff, 0xd8f2ff],   // blue steel
            C: [0x2a76b8, 0x62c8f4, 0xb4ecff, 0xffffff],   // ice crystal
            Y: [0x7a5a0c, 0xd4a218, 0xffe14a, 0xfffbd0],   // storm gold
            O: [0xc89a10, 0xffe14a, 0xfff6b0, 0xffffff],   // a charged orb
            V: [0x140a24, 0x2e1650, 0x55289a, 0x9a5cf0],   // void iron
            P: [0x5a2aa0, 0x9a5cf0, 0xc99cff, 0xf4e6ff],   // violet light
            B: [0x000000, 0x06030c, 0x140a22, 0x3a2060],   // a black hole
        });
    }

    // The shapes. `m` draws materials into the map; fx are [kind, layer, ...args].
    static ICONS() {
        if (MenuArt._icons) return MenuArt._icons;
        const fist = (m, mat, cuff) => {             // a clenched fist from the front
            for (const [x, w] of [[5, 3], [9, 3], [13, 3], [17, 2]]) { m.rect(x, 10, w, 6, mat); m.set(x + w - 1, 10, '.'); }
            m.rect(5, 15, 14, 3, mat);
            m.rect(4, 14, 11, 3, mat);                    // the thumb across them
            m.line(4, 14, 14, 14, '1'); m.set(15, 14, '1');
            for (const x of [8, 12, 16]) m.line(x, 11, x, 13, '1');
            m.line(5, 15, 12, 15, mat.toLowerCase());
            m.rect(6, 18, 12, 4, cuff); m.line(6, 19, 16, 19, cuff.toLowerCase());
        };
        const side = (m, mat, cuff) => {              // a fist from the side, punching right
            m.rect(9, 8, 10, 9, mat); m.set(18, 8, '.'); m.set(18, 16, '.'); m.set(9, 16, '.');
            m.rect(10, 6, 6, 3, mat); m.set(10, 6, '.');  // the thumb on top
            m.line(16, 10, 18, 10, '1'); m.line(15, 12, 18, 12, '1'); m.line(15, 14, 18, 14, '1');
            m.line(15, 9, 15, 15, '1');
            m.line(11, 7, 14, 7, mat.toLowerCase());
            m.rect(3, 10, 6, 6, cuff); m.line(3, 11, 7, 11, cuff.toLowerCase());
        };
        return (MenuArt._icons = {
            flame_fists: { el: 'fire', draw: m => fist(m, 'F', 'S'),
                fx: [['flame', 'back', 4, 20, 13, 10], ['ember', 'front', 3, 0, 21, 8, 4]] },
            flame_sword: { el: 'fire', draw: m => {
                    m.line(9, 14, 19, 4, 'F', 3); m.set(20, 3, 'F'); m.set(21, 2, 'F'); m.set(20, 2, 'F'); m.set(21, 3, '.');
                    m.line(10, 12, 19, 3, 'f');
                    m.line(5, 12, 11, 18, 'G', 2); m.line(4, 11, 4, 11, 'G'); m.set(12, 19, 'G');
                    m.line(8, 16, 4, 20, 'L', 2);
                    m.disc(3, 21, 1.6, 'G');
                }, fx: [['flameLine', 'back', 9, 13, 21, 1, 5], ['ember', 'front', 10, 0, 23, 10, 3]] },
            magma_staff: { el: 'fire', draw: m => {
                    m.rect(11, 10, 2, 13, 'W'); m.rect(10, 9, 4, 2, 'G'); m.rect(11, 22, 2, 1, 'G'); m.rect(10, 15, 4, 1, 'G');
                    m.disc(11.5, 5.5, 3.8, 'M'); m.set(10, 3, 'm'); m.set(9, 4, 'm'); m.set(10, 4, 'm');
                    m.line(9, 10, 7, 7, 'G'); m.line(7, 7, 7, 4, 'G'); m.line(14, 10, 16, 7, 'G'); m.line(16, 7, 16, 4, 'G');
                }, fx: [['flame', 'back', 7, 16, 6, 6], ['drip', 'front', 12, 9, 7, 0xff7a1a], ['ember', 'front', 5, 0, 18, 6, 3]] },
            ignition: { el: 'fire', draw: m => {   // a flamethrower: the fuel canister slung under a vented barrel, a brass nozzle
                    m.rect(2, 9, 3, 3, 'S'); m.rect(4, 8, 10, 4, 'S'); m.line(4, 8, 13, 8, 's');   // stock and body
                    m.rect(14, 9, 5, 2, 'S'); for (const x of [15, 17]) m.set(x, 10, '1');   // the barrel's vents
                    m.poly([[18.5, 8.5], [23, 6.5], [23, 13.5], [18.5, 11.5]], 'G'); m.line(22, 9, 22, 10, '1');   // the nozzle bell
                    m.line(7, 12, 6, 18, 'W', 2); m.line(9, 12, 10, 14, 'S'); m.set(9, 13, '1');   // grip and trigger guard
                    m.rect(11, 13, 9, 4, 'F'); m.set(11, 13, '.'); m.set(11, 16, '.'); m.set(19, 13, '.'); m.set(19, 16, '.');   // the canister
                    m.line(12, 13, 12, 16, 'G'); m.line(18, 13, 18, 16, 'G'); m.line(13, 14, 17, 14, 'f');
                    m.set(13, 12, 'S'); m.set(17, 12, 'S');   // its clamps
                    m.line(11, 15, 9, 16, 'L'); m.line(9, 16, 8, 13, 'L');   // the fuel line
                }, fx: [['muzzle', 'front', 23, 10], ['ember', 'front', 16, 2, 23, 6, 3]] },
            ice_fists: { el: 'ice', draw: m => {
                    fist(m, 'I', 'S');
                    m.poly([[5, 11], [5.5, 4], [8, 11]], 'C'); m.poly([[9, 11], [11, 1], [12.5, 11]], 'C');
                    m.poly([[13, 11], [16, 5], [16, 11]], 'C'); m.poly([[17, 11], [19.5, 7], [19, 12]], 'C');
                    m.line(10, 4, 10, 9, 'c'); m.line(6, 6, 6, 9, 'c');
                }, fx: [['glint', 'front', 11, 1, 11, 9], ['star', 'front', 4, 3, 0], ['star', 'front', 18, 5, 2]] },
            icicle_cannon: { el: 'ice', draw: m => {
                    m.line(6, 15, 14, 7, 'S', 4); m.line(5, 13, 12, 6, 's');
                    m.line(8, 17, 16, 9, 'I', 1); m.line(10, 11, 13, 14, 'I', 2);
                    m.disc(15.5, 6.5, 2.4, 'S');
                    m.disc(7, 19, 3, 'W'); m.set(7, 19, 'G');
                    m.poly([[17, 6], [23, 0], [19, 7]], 'C'); m.poly([[17, 9], [23, 7], [18, 11]], 'C'); m.poly([[15, 4], [17, 0], [17, 5]], 'C');
                }, fx: [['glint', 'front', 18, 6, 23, 0], ['star', 'front', 22, 9, 1]] },
            fractal_shard: { el: 'ice', draw: m => {
                    m.poly([[11, 0], [16.5, 7], [14, 20], [9, 22.5], [5.5, 9]], 'C');
                    m.line(11, 1, 11, 21, '1'); m.line(6, 9, 10, 9, 'c'); m.line(7, 8, 10, 3, 'c');
                    m.poly([[19, 11], [22.5, 14], [19.5, 18], [17, 14.5]], 'C');
                    m.poly([[18, 2], [21, 4], [19.5, 8], [17, 5.5]], 'C');
                    m.poly([[3.5, 16], [6, 19], [4, 23], [1.5, 19.5]], 'C');
                }, fx: [['glint', 'front', 8, 4, 13, 18], ['star', 'front', 20, 1, 0], ['star', 'front', 2, 13, 2]] },
            lightning_fists: { el: 'lightning', draw: m => side(m, 'Y', 'S'),
                fx: [['bolt', 'front', 19, 9, 23, 3], ['bolt', 'front', 19, 13, 23, 18], ['spark', 'front', 1, 2, 23, 22, 4, 0xffe14a]] },
            orb_emitter: { el: 'lightning', draw: m => {
                    m.line(3, 21, 8, 16, 'W', 2); m.rect(8, 14, 3, 3, 'G');
                    m.line(10, 14, 11, 5, 'Y', 2); m.line(10, 15, 19, 14, 'Y', 2);
                    m.set(12, 4, 'Y'); m.set(20, 13, 'Y');
                    m.disc(16, 9, 3.3, 'O');
                }, fx: [['bolt', 'front', 12, 5, 15, 7], ['bolt', 'front', 19, 13, 17, 11], ['spark', 'front', 12, 3, 23, 15, 3, 0xfff6b0]] },
            ball_lightning: { el: 'lightning', draw: m => {
                    m.disc(12, 12, 7.2, 'O'); m.disc(12, 12, 4.6, 'o');
                    m.line(9, 9, 12, 12, 'Y'); m.line(12, 12, 10, 15, 'Y'); m.line(12, 12, 16, 11, 'Y');
                }, fx: [['bolt', 'front', 18, 8, 23, 3], ['bolt', 'front', 6, 16, 1, 21], ['bolt', 'front', 6, 7, 1, 3], ['bolt', 'front', 18, 16, 23, 21]] },
            conductor: { el: 'lightning', draw: m => {   // a staff with a spool of wire for a head, the wire trailing to a clamp
                    m.line(4, 22, 10, 14, 'W', 2); m.rect(9, 12, 3, 3, 'G');
                    m.disc(13, 8, 5.4, 'G'); m.disc(13, 8, 4, 'Y'); m.disc(13, 8, 1.6, 'G');
                    m.line(17, 11, 20, 17, 'Y'); m.rect(19, 17, 3, 3, 'S'); m.set(20, 20, 'S'); m.set(22, 20, 'S');
                }, frames: 10, fps: 12,   // a pulse of current winds round the spool, runs down the wire, and the clamp sparks
                fx: [['current', 'front', [[13, 4], [16, 5], [17, 8], [16, 11], [13, 12], [10, 11], [9, 8], [10, 5], [13, 5], [15, 7], [15, 9], [17, 11], [18, 13], [19, 15], [20, 17]], 6]] },
            cosmic_fists: { el: 'cosmic', draw: m => { side(m, 'V', 'P'); m.set(12, 11, 'P'); m.set(10, 13, 'p'); m.set(13, 14, 'P'); },
                fx: [['streak', 'back', 0, 6, 2, 16], ['star', 'front', 20, 4, 1], ['star', 'front', 21, 18, 3]] },
            barrier_staff: { el: 'cosmic', draw: m => {
                    m.rect(11, 11, 2, 12, 'W'); m.rect(10, 10, 4, 2, 'G'); m.rect(11, 22, 2, 1, 'G');
                    m.poly([[7, 2], [17, 2], [17, 6.5], [12, 11], [7, 6.5]], 'P');
                    m.poly([[9.5, 3.5], [14.5, 3.5], [14.5, 6], [12, 8.5], [9.5, 6]], 'V');
                    m.set(12, 5, 'p'); m.set(11, 5, 'P');
                }, fx: [['orbit', 'both', 12, 6, 10, 4, 3, 0xc99cff]] },
            astrolabe: { el: 'cosmic', draw: m => {
                    m.disc(12, 13, 9.2, 'G'); m.disc(12, 13, 7.2, 'V'); m.disc(12, 13, 2, 'G');
                    m.ellipseRing(12, 13, 5, 2.4, 'g');
                    m.rect(11, 2, 3, 2, 'G'); m.set(12, 2, '.'); m.set(12, 1, 'G');
                }, fx: [['hand', 'front', 12, 13, 6], ['star', 'front', 21, 3, 0], ['star', 'front', 3, 21, 2]] },
            singularity_staff: { el: 'cosmic', draw: m => {
                    m.rect(11, 12, 2, 11, 'V'); m.rect(10, 11, 4, 2, 'P'); m.rect(11, 22, 2, 1, 'P');
                    m.disc(11.5, 6, 4.6, 'B');
                }, fx: [['disk', 'both', 11.5, 6, 9, 2.6], ['orbit', 'front', 11.5, 6, 9, 2.6, 2, 0xffffff]] },
            void_blade: { el: 'cosmic', draw: m => {
                    m.poly([[6, 16], [9, 10], [14, 5], [21, 1], [17, 6], [13, 11], [9, 17]], 'V');
                    m.line(8, 13, 14, 6, 'P'); m.line(14, 6, 20, 2, 'p');
                    m.line(4, 14, 9, 19, 'G', 2);
                    m.line(6, 18, 3, 21, 'L', 2); m.set(2, 22, 'G');
                }, fx: [['glint', 'front', 9, 12, 20, 2], ['spark', 'front', 8, 0, 23, 16, 3, 0xc99cff]] },
        });
    }

    // Paints frame `f` (0-3) of icon `id` into P at (ox, oy).
    static paintIcon(P, id, f = 0, ox = 0, oy = 0) {
        const def = MenuArt.ICONS()[id];
        if (!def) return;
        const N = 24, MAT = MenuArt.ICON_MAT();
        const map = Array.from({ length: N }, () => new Array(N).fill('.'));
        const at = (x, y) => (x >= 0 && y >= 0 && x < N && y < N) ? map[y][x] : '.';
        const m = {
            set(x, y, c) { x = Math.round(x); y = Math.round(y); if (x >= 0 && y >= 0 && x < N && y < N) map[y][x] = c; },
            rect(x, y, w, h, c) { for (let j = y; j < y + h; j++) for (let i = x; i < x + w; i++) m.set(i, j, c); },
            line(x0, y0, x1, y1, c, w = 1) {
                const n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0), 1);
                for (let k = 0; k <= n; k++) {
                    const x = Math.round(x0 + (x1 - x0) * k / n), y = Math.round(y0 + (y1 - y0) * k / n);
                    for (let a = 0; a < w; a++) for (let b = 0; b < w; b++) m.set(x + a - Math.floor((w - 1) / 2), y + b - Math.floor((w - 1) / 2), c);
                }
            },
            disc(cx, cy, r, c) { for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) if ((x + 0.5 - cx) ** 2 + (y + 0.5 - cy) ** 2 <= r * r) m.set(x, y, c); },
            ellipseRing(cx, cy, rx, ry, c) { for (let k = 0; k < 64; k++) { const t = k / 64 * Math.PI * 2; m.set(cx + Math.cos(t) * rx - 0.5, cy + Math.sin(t) * ry - 0.5, c); } },
            poly(pts, c) {
                for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
                    const px = x + 0.5, py = y + 0.5;
                    let inside = false;
                    for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
                        const [xi, yi] = pts[i], [xj, yj] = pts[j];
                        if ((yi > py) !== (yj > py) && px < (xj - xi) * (py - yi) / (yj - yi) + xi) inside = !inside;
                    }
                    if (inside) m.set(x, y, c);
                }
            },
        };
        def.draw(m);
        const fx = def.fx || [];
        for (const e of fx) if (e[1] === 'back' || e[1] === 'both') MenuArt._iconFx(P, e, f, ox, oy, 'back');
        // outline first (it may cover back effects), then the shaded body
        const body = (x, y) => at(x, y) !== '.';
        for (let y = -1; y <= N; y++) for (let x = -1; x <= N; x++) {
            if (body(x, y)) continue;
            if (body(x - 1, y) || body(x + 1, y) || body(x, y - 1) || body(x, y + 1)) P.put(ox + x, oy + y, 0x1c1728);
        }
        const matOf = ch => ch === '1' ? null : (MAT[ch] ? ch : MAT[ch.toUpperCase()] ? ch.toUpperCase() : null);
        for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
            const ch = map[y][x];
            if (ch === '.') continue;
            if (ch === '1') {   // a seam: the darkest tone of whatever material is beside it
                const near = [at(x - 1, y), at(x + 1, y), at(x, y - 1), at(x, y + 1)].map(matOf).find(Boolean);
                P.put(ox + x, oy + y, near ? MAT[near][0] : 0x1c1728);
                continue;
            }
            const mat = matOf(ch);
            if (!mat) continue;
            const ramp = MAT[mat];
            if (ch !== mat) { P.put(ox + x, oy + y, ramp[3]); continue; }
            const same = (i, j) => matOf(at(i, j)) === mat || at(i, j) === '1';
            const tone = (!same(x, y - 1) || !same(x - 1, y)) ? 2 : (!same(x, y + 1) || !same(x + 1, y)) ? 0 : 1;
            P.put(ox + x, oy + y, ramp[tone]);
        }
        for (const e of fx) if (e[1] === 'front' || e[1] === 'both') MenuArt._iconFx(P, e, f, ox, oy, 'front');
    }

    // One idle effect for one frame. Positions are icon pixels.
    static _iconFx(P, e, f, ox, oy, layer) {
        const kind = e[0], R = MenuArt.rng(1 + f * 7919 + e.slice(2).reduce((s, v) => s + Math.round(v * 13), 0));
        const put = (x, y, c, a = 1) => P.put(ox + x, oy + y, c, a);
        const FIRE = [0xfff2c0, 0xffd060, 0xff8a2a, 0xe8401a, 0x9a1c0c];
        if (kind === 'flame' || kind === 'flameLine') {
            // columns of flame rising from a base line, their heights rolled per frame
            let x0, x1, base0, base1, h;
            if (kind === 'flame') { [, , x0, x1, base0, h] = e; base1 = base0; }
            else { const [, , ax, ay, bx, by, hh] = e; x0 = ax; x1 = bx; base0 = ay; base1 = by; h = hh; }
            const n = MenuArt.noise(17 + Math.round(x0 * 3));
            for (let x = x0; x <= x1; x++) {
                const t = (x - x0) / Math.max(1, x1 - x0);
                const base = Math.round(base0 + (base1 - base0) * t);
                const prof = kind === 'flame' ? Math.sin(Math.PI * (0.15 + 0.7 * t)) : 0.75 + 0.25 * Math.sin(t * 9 + f);
                const hh = Math.max(1, Math.round(h * prof * (0.55 + 0.6 * n(x * 0.9, f * 0.8))));
                for (let k = 0; k < hh; k++) {
                    const q = k / hh;
                    const c = q < 0.25 ? FIRE[1] : q < 0.55 ? FIRE[2] : q < 0.85 ? FIRE[3] : FIRE[4];
                    put(x, base - k, c, q > 0.85 ? 0.85 : 1);
                }
                if (R() < 0.35) put(x, base - hh - 1 - Math.floor(R() * 2), FIRE[3], 0.8);
            }
        } else if (kind === 'ember') {
            const [, , x0, y0, x1, y1, n] = e;
            for (let i = 0; i < n; i++) {
                const x = x0 + Math.floor(R() * (x1 - x0 + 1)), y = y0 + Math.floor(R() * (y1 - y0 + 1));
                put(x, y, R() < 0.5 ? FIRE[1] : FIRE[2]);
            }
        } else if (kind === 'drip') {
            const [, , x, y0, len, col] = e;
            const y = y0 + Math.round(f * len / 3);
            put(x, y, col); put(x, y + 1, col, 0.7);
            if (f === 3) { put(x - 1, y + 1, col, 0.6); put(x + 1, y + 1, col, 0.6); }
        } else if (kind === 'muzzle') {
            const [, , x, y] = e;
            if (f % 2 === 0) {
                const big = f === 0;
                for (let k = -2; k <= 2; k++) put(x + Math.abs(k) * 0, y + k, k === 0 ? 0xffffff : FIRE[1], Math.abs(k) === 2 ? 0.6 : 1);
                put(x + 1, y, FIRE[1]); if (big) { put(x + 1, y - 1, FIRE[2]); put(x + 1, y + 1, FIRE[2]); put(x - 1, y - 2, FIRE[2], 0.7); put(x - 1, y + 2, FIRE[2], 0.7); }
            } else { put(x, y, FIRE[2], 0.8); put(x + 1, y, FIRE[3], 0.6); }
        } else if (kind === 'bolt') {
            const [, , x0, y0, x1, y1] = e;
            if (f === 3) return;                          // a beat of darkness between strikes
            const steps = 4;
            let px = x0, py = y0;
            for (let s = 1; s <= steps; s++) {
                const t = s / steps;
                const nx = Math.round(x0 + (x1 - x0) * t + (s < steps ? (R() - 0.5) * 4 : 0));
                const ny = Math.round(y0 + (y1 - y0) * t + (s < steps ? (R() - 0.5) * 3 : 0));
                const n = Math.max(Math.abs(nx - px), Math.abs(ny - py), 1);
                for (let k = 0; k <= n; k++) {
                    const x = Math.round(px + (nx - px) * k / n), y = Math.round(py + (ny - py) * k / n);
                    put(x, y, f === 1 ? 0xffffff : 0xfff6b0);
                    if (f !== 2) put(x + 1, y, 0xffe14a, 0.45);
                }
                px = nx; py = ny;
            }
        } else if (kind === 'current') {
            // a bright head and its tail running the path over the first `run` frames, then pixel bolts crackling off its
            // end for a few frames, then a beat of quiet
            const [, , path, run] = e, n = path.length - 1;
            if (f < run) {
                const head = (f + 1) / run * n;
                for (let k = 0; k < 4; k++) {
                    const t = head - k * 0.8; if (t < 0) continue;
                    const i = Math.min(n - 1, Math.floor(t)), u = t - i, [ax, ay] = path[i], [bx, by] = path[i + 1];
                    put(Math.round(ax + (bx - ax) * u), Math.round(ay + (by - ay) * u), k === 0 ? 0xffffff : k === 1 ? 0xfff6b0 : 0xffe14a, 1 - k * 0.22);
                }
            } else if (f < run + 3) {
                const [x0, y0] = path[n];
                for (let b = 0; b < 3; b++) {   // jagged pixel bolts off the clamp
                    let x = x0, y = y0; const dx = R() < 0.5 ? -1 : 1, dy = R() < 0.5 ? -1 : 1;
                    for (let s = 0; s < 4; s++) {
                        x += R() < 0.6 ? dx : 0; y += R() < 0.6 ? dy : 0;
                        put(x, y, s === 0 || f === run ? 0xffffff : 0xfff6b0, 1 - s * 0.15);
                    }
                }
                put(x0, y0, 0xffffff);
            }
        } else if (kind === 'spark') {
            const [, , x0, y0, x1, y1, n, col] = e;
            for (let i = 0; i < n; i++) {
                const x = x0 + Math.floor(R() * (x1 - x0 + 1)), y = y0 + Math.floor(R() * (y1 - y0 + 1));
                if (P.alpha(ox + x, oy + y) > 0.5) continue;
                put(x, y, col);
                if (R() < 0.5) put(x + (R() < 0.5 ? 1 : -1), y, col, 0.5);
            }
        } else if (kind === 'glint') {
            const [, , x0, y0, x1, y1] = e;
            const t = f / 3, x = Math.round(x0 + (x1 - x0) * t), y = Math.round(y0 + (y1 - y0) * t);
            if (P.alpha(ox + x, oy + y) > 0.5) { put(x, y, 0xffffff); put(x + 1, y, 0xffffff, 0.6); put(x, y + 1, 0xffffff, 0.5); }
        } else if (kind === 'star') {
            const [, , x, y, ph] = e;
            const s = [0, 1, 2, 1][(f + ph) % 4];
            put(x, y, 0xffffff);
            for (let k = 1; k <= s; k++) {
                const a = k === s ? 0.55 : 0.9;
                put(x + k, y, 0xffffff, a); put(x - k, y, 0xffffff, a); put(x, y + k, 0xffffff, a); put(x, y - k, 0xffffff, a);
            }
        } else if (kind === 'streak') {
            const [, , x0, x1, y0, y1] = e;
            for (let y = y0; y <= y1; y += 3) {
                const len = 2 + Math.floor(R() * (x1 - x0));
                for (let k = 0; k < len; k++) put(x1 - k, y + ((y >> 1) & 1), k < 2 ? 0xc99cff : 0x7a2ad0, 1 - k / (len + 1));
            }
        } else if (kind === 'orbit') {
            const [, , cx, cy, rx, ry, n, col] = e;
            for (let i = 0; i < n; i++) {
                const t = (f / 4 + i / n) * Math.PI * 2, front = Math.sin(t) > 0;
                if ((layer === 'front') !== front && e[1] === 'both') continue;
                const x = Math.round(cx + Math.cos(t) * rx - 0.5), y = Math.round(cy + Math.sin(t) * ry - 0.5);
                put(x, y, 0xffffff); put(x + 1, y, col); put(x, y + 1, col); put(x - 1, y, col, 0.6); put(x, y - 1, col, 0.6);
            }
        } else if (kind === 'disk') {
            // an accretion ring: the half behind the hole on the back layer, the near half in front
            const [, , cx, cy, rx, ry] = e;
            for (let k = 0; k < 72; k++) {
                const t = k / 72 * Math.PI * 2, front = Math.sin(t) > 0;
                if (front !== (layer === 'front')) continue;
                const x = Math.round(cx + Math.cos(t) * rx - 0.5), y = Math.round(cy + Math.sin(t) * ry - 0.5);
                const hot = ((k + f * 4) % 18) < 3;
                put(x, y, hot ? 0xffffff : front ? 0xc99cff : 0x7a2ad0);
            }
        } else if (kind === 'hand') {
            // the astrolabe's pointer, a quarter turn a frame, with a star on its tip
            const [, , cx, cy, r] = e;
            const t = f / 4 * Math.PI * 2 - Math.PI / 2;
            for (let k = 1; k <= r; k++) put(Math.round(cx + Math.cos(t) * k - 0.5), Math.round(cy + Math.sin(t) * k - 0.5), k === r ? 0xffffff : 0xfff0a0);
            const tx = Math.round(cx + Math.cos(t) * r - 0.5), ty = Math.round(cy + Math.sin(t) * r - 0.5);
            put(tx + 1, ty, 0xffe14a, 0.8); put(tx - 1, ty, 0xffe14a, 0.8); put(tx, ty + 1, 0xffe14a, 0.8); put(tx, ty - 1, 0xffe14a, 0.8);
        }
    }

    // ── SHOP: THE WEAPONS ON DISPLAY ─────────────────────────────────────────
    // A weapon's icon as a strip of frames (26x26: the 24px art and its outline; 4 unless its entry asks for more) and
    // the idle animation that cycles them.
    static iconSheet(scene, id) {
        const def = MenuArt.ICONS()[id];
        if (!def) return null;
        const key = 'mn_icon_' + id, NF = def.frames || 4;
        if (!scene.textures.exists(key)) {
            const F = 26, P = new MenuArt.Px(F * NF, F);
            for (let f = 0; f < NF; f++) MenuArt.paintIcon(P, id, f, f * F + 1, 1);
            const t = P.toTexture(scene, key, false);
            for (let f = 0; f < NF; f++) t.add(String(f), 0, f * F, 0, F, F);
        }
        if (!scene.anims.exists(key)) {
            scene.anims.create({ key, frames: Array.from({ length: NF }, (_, f) => ({ key, frame: String(f) })), frameRate: def.fps || 6, repeat: -1 });
        }
        return key;
    }

    // A weapon on its card: a back-light in the element's colour, a lit plinth, the icon idling
    // on it at a whole-pixel scale, and its element drifting off it (embers, frost, sparks,
    // motes). The objects go into the card's container; `live` is the focus card.
    static weaponShowcase(scene, id, el, x, y, w, h, { accent = 0xffffff, live = true } = {}) {
        MenuArt.basics(scene);
        const key = MenuArt.iconSheet(scene, id);
        const objs = [];
        if (!key) return { objs };
        const s = Math.max(2, Math.floor(Math.min(w, h * 1.1) * 0.6 / 26));
        const iy = y - 2 * s, py = iy + 12 * s;
        const glow = scene.add.image(x, iy, 'mn_glow').setTint(accent).setBlendMode(Phaser.BlendModes.ADD)
            .setDisplaySize(Math.min(w, 34 * s), Math.min(h * 1.1, 30 * s)).setAlpha(live ? 0.5 : 0.3);
        const g = scene.add.graphics();
        g.fillStyle(0x05070c, 0.85); g.fillEllipse(x, py + s, 19 * s, 5 * s);
        g.fillStyle(MenuArt.mix(accent, 0x0c111b, 0.78), 1); g.fillEllipse(x, py, 17 * s, 4 * s);
        g.fillStyle(MenuArt.mix(accent, 0xffffff, 0.2), live ? 0.5 : 0.25); g.fillEllipse(x, py - s * 0.6, 12 * s, 1.6 * s);
        g.lineStyle(2, accent, live ? 0.8 : 0.4); g.strokeEllipse(x, py, 17 * s, 4 * s);
        const icon = scene.add.sprite(x, iy, key, '0').setScale(s);
        if (live) icon.play(key);
        const aura = typeof ShopScene !== 'undefined' ? ShopScene.enchAura(scene, icon, id) : [];   // enchanted: the halo behind it, the sparks over it
        objs.push(glow, g, ...aura.filter(o => o.depth < icon.depth), icon, ...aura.filter(o => o.depth > icon.depth));
        if (!live) return { objs };
        scene.tweens.add({ targets: icon, y: iy - 1.5 * s, duration: 1300, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
        scene.tweens.add({ targets: glow, alpha: 0.72, duration: 1700, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
        const kind = { fire: 'ember', ice: 'flake', lightning: 'spark' }[el] || 'mote';
        const tex = { ember: 'mn_px2', flake: 'mn_flake', spark: 'mn_spark', mote: 'mn_px2' }[kind];
        const cols = { ember: [0xffb050, 0xff6a2a, 0xffd27a], flake: [0xd8f2ff, 0x9fdcff], spark: [0xfff6b0, 0xffe14a],
                       mote: [0xc99cff, 0xffd060, 0xf4e6ff] }[kind];
        const ev = scene.time.addEvent({ delay: kind === 'spark' ? 260 : 150, loop: true, callback: () => {
            const c = icon.parentContainer;
            if (!icon.active || !c) return;
            const px = x + (Math.random() - 0.5) * 14 * s, sy = kind === 'flake' ? iy - 10 * s : iy + (Math.random() - 0.3) * 8 * s;
            const p = scene.add.image(px, sy, tex).setTint(cols[Math.floor(Math.random() * cols.length)])
                .setBlendMode(Phaser.BlendModes.ADD).setScale(kind === 'flake' ? s * 0.45 : s * 0.55);
            c.add(p);
            if (kind === 'spark') {
                p.setAlpha(0);
                scene.tweens.add({ targets: p, alpha: 1, scale: s * 0.8, duration: 90, yoyo: true, onComplete: () => p.destroy() });
                return;
            }
            const rise = kind === 'flake' ? 18 * s : -(10 + Math.random() * 8) * s;
            scene.tweens.add({ targets: p, y: sy + rise, x: px + (Math.random() - 0.5) * 6 * s, alpha: 0,
                duration: 1100 + Math.random() * 700, ease: 'Sine.easeOut', onComplete: () => p.destroy() });
        } });
        icon.once('destroy', () => ev.remove());
        return { objs };
    }

    // ── LEVEL SELECT: A LIVING DIORAMA ON EVERY CARD ─────────────────────────
    // A slime, 18x16, in the house style: a dome, lit from the top left, two eyes.
    static slimeTex(scene, key, col, { mood = 'friend', crown = false, horns = false } = {}) {
        if (scene.textures.exists(key)) return key;
        const P = new MenuArt.Px(20, 18), c = MenuArt.hex(col);
        const dk = MenuArt.mix(c, 0x000000, 0.42), lt = MenuArt.mix(c, 0xffffff, 0.5);
        for (let y = 5; y <= 16; y++) for (let x = 1; x <= 18; x++) {
            const u = (x + 0.5 - 10) / 8.6, v = (y + 0.5 - 15) / 10;
            if (u * u + v * v > 1) continue;
            const shade = y >= 15 ? dk : (u < -0.25 && v < -0.55) ? lt : c;
            P.put(x, y, shade);
        }
        P.put(6, 8, 0xffffff); P.put(7, 7, 0xffffff); P.put(5, 9, lt);
        const eye = (ex) => {
            P.rect(ex, 10, 2, 3, 0xffffff);
            P.put(ex + (mood === 'angry' ? 1 : 0), 11, 0x14101c); P.put(ex + (mood === 'angry' ? 1 : 0), 12, 0x14101c);
            if (mood === 'angry') { P.put(ex - 1, 9, 0x14101c); P.put(ex, 9, 0x14101c); P.put(ex + 1, 9, 0x14101c); }
        };
        eye(7); eye(11);
        if (mood === 'angry') { P.put(7, 9, 0x14101c); P.put(12, 9, 0x14101c); P.put(8, 8, c); P.put(11, 8, c); }
        if (crown) {
            P.rect(6, 3, 8, 2, 0xffd060);
            for (const x of [6, 9, 10, 13]) P.put(x, 2, 0xffd060);
            P.put(6, 1, 0xfff0a0); P.put(13, 1, 0xfff0a0); P.put(9, 1, 0xfff0a0); P.put(10, 1, 0xfff0a0);
            P.put(9, 3, 0xff5fd2); P.put(10, 3, 0xff5fd2);
        }
        if (horns) { P.put(4, 5, 0xe8e0d0); P.put(3, 4, 0xe8e0d0); P.put(15, 5, 0xe8e0d0); P.put(16, 4, 0xe8e0d0); }
        P.outline(0x1c1728);
        P.toTexture(scene, key, false);
        return key;
    }

    // The painting behind each card's title: 132x32 pixels (the props on a 100-wide stage in the
    // middle), shown at a whole-pixel scale.
    static levelArt(scene, idx) {
        const key = 'mn_lv' + idx;
        if (scene.textures.exists(key)) return key;
        const W = 132, H = 32, X0 = 16, P = new MenuArt.Px(W, H), R = MenuArt.rng(idx * 977 + 13), N = MenuArt.noise(idx * 31 + 7);
        // Q draws the props, laid out on a 100-wide stage centred in the painting
        const Q = {
            rect: (x, y, w, h, c, a) => P.rect(x + X0, y, w, h, c, a), line: (a0, b0, a1, b1, c, a) => P.line(a0 + X0, b0, a1 + X0, b1, c, a),
            ellipse: (x, y, rx, ry, c, a) => P.ellipse(x + X0, y, rx, ry, c, a), poly: (pts, c, a) => P.poly(pts.map(([x, y]) => [x + X0, y]), c, a),
            put: (x, y, c, a) => P.put(x + X0, y, c, a), add: (x, y, c, a) => P.add(x + X0, y, c, a),
        };
        const kind = (typeof Transitions !== 'undefined' && Transitions.infoFor) ? Transitions.infoFor(idx).kind : 'duality';
        const floor = (y0, c0, c1, seam) => {
            P.vgrad(0, y0, W, H - y0, [[0, c0], [1, c1]]);
            for (let x = (y0 * 3) % 9; x < W; x += 9) P.line(x, y0 + 1, x - 2, H, seam, 0.55);
            P.line(0, y0, W, y0, MenuArt.mix(c0, 0xffffff, 0.18));
        };
        const bricks = (y0, y1, c, seam) => {
            P.rect(0, y0, W, y1 - y0, c);
            for (let y = y0 + 3; y < y1; y += 4) P.line(0, y, W, y, seam, 0.8);
            for (let y = y0; y < y1; y += 4) for (let x = ((y / 4) % 2) * 4; x < W; x += 8) P.line(x, y, x, Math.min(y1 - 1, y + 3), seam, 0.8);
        };
        const ridge = (yBase, amp, c, sc) => {
            for (let x = 0; x < W; x++) {
                const h = Math.round(amp * MenuArt.fbm(N, x * sc, 3.7));
                for (let y = yBase - h; y < yBase; y++) P.put(x, y, c);
            }
        };
        const stars = (n, y1, c = 0xffffff) => { for (let i = 0; i < n; i++) P.put(Math.floor(R() * W), Math.floor(R() * y1), c, 0.4 + R() * 0.6); };
        switch (kind) {
            case 'duality': {   // a torchlit training hall, a banner split fire and ice, two dummies
                bricks(0, 26, 0x3a2a1e, 0x22180f);
                for (const x of [18, 82]) { Q.rect(x - 1, 9, 3, 2, 0x6e6e78); Q.rect(x, 7, 1, 2, 0x55555e); }
                Q.rect(44, 2, 12, 15, 0xc0392b); Q.rect(50, 2, 6, 15, 0x2f78c8); Q.line(44, 17, 50, 20, 0xc0392b); Q.line(55, 17, 50, 20, 0x2f78c8);
                Q.rect(46, 7, 3, 4, 0xffb050); Q.rect(51, 7, 3, 4, 0xd8f2ff); Q.rect(43, 1, 14, 1, 0x8a6a3a);
                for (const x of [30, 70]) { Q.rect(x, 15, 1, 11, 0x6b4a2a); Q.ellipse(x + 0.5, 15, 3.5, 4, 0xc8a050); Q.line(x - 3, 17, x + 4, 17, 0x8a6a3a); Q.put(x - 1, 13, 0x6b4a2a); Q.put(x + 2, 13, 0x6b4a2a); }
                floor(26, 0x4a3b2c, 0x241a12, 0x1a120c);
                break;
            }
            case 'storm': {     // a stormy sky over the Gauntlet's walls, wet stone
                P.vgrad(0, 0, W, 26, [[0, 0x060914], [0.6, 0x141d33], [1, 0x232f4a]]);
                for (let i = 0; i < 6; i++) { const cx = R() * W, cy = 2 + R() * 7; P.ellipse(cx, cy, 10 + R() * 8, 2.5 + R() * 2, 0x1d2638, 0.9); }
                ridge(26, 9, 0x0a0e1a, 0.11);
                for (const x of [10, 34, 92, 116]) { P.rect(x, 12, 4, 14, 0x0f1424); P.rect(x - 1, 11, 6, 2, 0x161c30); }
                floor(26, 0x262c3c, 0x10131c, 0x0a0c12);
                for (let i = 0; i < 9; i++) { const x = Math.floor(R() * (W - 8)), y = 28 + Math.floor(R() * 5); P.line(x, y, x + 3 + Math.floor(R() * 5), y, 0x5a6a8a, 0.6); }
                break;
            }
            case 'rift': {      // deep space, a torn rift, rocks adrift
                P.vgrad(0, 0, W, 27, [[0, 0x05020c], [0.7, 0x140a2a], [1, 0x221040]]);
                stars(55, 26);
                let x = 56;
                for (let y = 0; y < 24; y++) { x += Math.round((R() - 0.55) * 2); Q.put(x, y, 0xf4e6ff); Q.add(x - 1, y, 0x9a5cf0, 0.7); Q.add(x + 1, y, 0x9a5cf0, 0.7); Q.add(x - 2, y, 0x5a2aa0, 0.5); Q.add(x + 2, y, 0x5a2aa0, 0.5); }
                for (const [cx, cy, r] of [[18, 10, 4], [84, 7, 3], [72, 16, 2.5], [30, 19, 2], [-8, 14, 3], [108, 12, 3.5]]) { Q.ellipse(cx, cy, r + 1, r, 0x1a1030); Q.line(cx - r, cy - r + 1, cx + r - 1, cy - r + 1, 0x3a2a60); }
                floor(27, 0x22183a, 0x0c0816, 0x08060e);
                break;
            }
            case 'fracture': {  // a cavern split by a glowing fault, the core above it
                P.vgrad(0, 0, W, 26, [[0, 0x030a0c], [1, 0x0c2228]]);
                for (let i = 0; i < 12; i++) { const x = Math.floor(R() * W), l = 2 + Math.floor(R() * 6); for (let k = 0; k < l; k++) P.put(x, k, 0x081a1e); P.put(x + 1, 0, 0x081a1e); }
                ridge(26, 6, 0x061416, 0.15);
                floor(26, 0x1e3236, 0x0a1416, 0x061012);
                let y = 26;
                for (let x = 0; x < W; x++) { if (R() < 0.35) y += R() < 0.5 ? -1 : 1; y = Math.max(27, Math.min(33, y)); P.put(x, y, 0xdfffff); P.add(x, y - 1, 0x45e0e0, 0.6); P.add(x, y + 1, 0x45e0e0, 0.6); }
                Q.poly([[50, 6], [55, 10], [55, 16], [50, 20], [45, 16], [45, 10]], 0x1aa6a6); Q.poly([[50, 7], [54, 10], [50, 13], [46, 10]], 0x8ff8f0); Q.put(48, 9, 0xffffff);
                break;
            }
            case 'blueprint': { // a fortress drawn in lines on blueprint paper
                P.rect(0, 0, W, H, 0x04170f);
                for (let x = 0; x < W; x += 5) P.line(x, 0, x, H, 0x0b2e1e);
                for (let y = 0; y < H; y += 5) P.line(0, y, W, y, 0x0b2e1e);
                const L = (a, b, c2, d) => Q.line(a, b, c2, d, 0x3ddc84);
                L(30, 26, 70, 26); L(30, 26, 30, 14); L(70, 26, 70, 14); L(30, 14, 70, 14); L(44, 14, 44, 8); L(56, 14, 56, 8); L(44, 8, 56, 8);
                for (const x of [30, 34, 38, 42, 58, 62, 66, 70]) Q.rect(x - 1, 12, 2, 2, 0x3ddc84);
                for (const x of [14, 86]) { L(x - 3, 26, x - 3, 16); L(x + 3, 26, x + 3, 16); L(x - 3, 16, x + 3, 16); L(x - 4, 14, x + 4, 14); L(x, 14, x, 11); }
                Q.rect(48, 19, 4, 7, 0x0e4a2e); L(48, 19, 52, 19);
                P.line(0, 26, W, 26, 0x2aa868);
                break;
            }
            case 'flood': {     // a drowned hall: arches, a pipe, the water line
                P.vgrad(0, 0, W, 14, [[0, 0x050f16], [1, 0x0d2632]]);
                for (let x = 2; x < W; x += 30) { P.ellipse(x + 15, 13, 13, 9, 0x030a10); P.rect(x - 1, 4, 3, 22, 0x0c1e28); }
                P.rect(0, 5, W, 2, 0x2a4450); P.line(0, 5, W, 5, 0x4a6a78); for (const x of [24, 62]) { Q.rect(x, 3, 3, 6, 0x3a5a68); Q.put(x + 1, 2, 0x6a8a98); }
                P.vgrad(0, 14, W, H - 14, [[0, 0x0f4a66], [0.35, 0x0a3048], [1, 0x041420]]);
                for (let x = 0; x < W; x++) { if ((x + idx) % 7 < 4) P.put(x, 14, 0x8fe8ff, 0.8); }
                for (let i = 0; i < 18; i++) P.put(Math.floor(R() * W), 16 + Math.floor(R() * 16), 0x5cc2ff, 0.5);
                break;
            }
            case 'gate': {      // a portal ring standing in a dark hall
                P.vgrad(0, 0, W, 26, [[0, 0x07040c], [1, 0x160c22]]);
                stars(14, 20, 0xc99cff);
                Q.ellipse(50, 14, 12, 12, 0x2a2238); Q.ellipse(50, 14, 9, 9, 0x0a0614);
                for (let k = 0; k < 40; k++) { const t = k / 40 * Math.PI * 2, r = 2 + k / 40 * 7; Q.put(50 + Math.cos(t * 2.5) * r, 14 + Math.sin(t * 2.5) * r, k % 3 ? 0x9a5cf0 : 0xf4e6ff); }
                for (let k = 0; k < 16; k++) { const t = k / 16 * Math.PI * 2; Q.put(50 + Math.cos(t) * 11, 14 + Math.sin(t) * 11, 0x4a3a60); }
                floor(26, 0x241a30, 0x0c0814, 0x08050e);
                for (const x of [26, 74]) { Q.rect(x, 28, 1, 3, 0x9a5cf0, 0.7); Q.rect(x - 1, 29, 3, 1, 0x9a5cf0, 0.7); }
                break;
            }
            case 'circuit': {   // traces and nodes on a dark board
                P.rect(0, 0, W, H, 0x120a05);
                const T = (pts) => { for (let i = 0; i + 1 < pts.length; i++) Q.line(pts[i][0], pts[i][1], pts[i + 1][0], pts[i + 1][1], 0x6a3a14); };
                const paths = MenuArt.CIRCUIT();
                for (const p of paths) T(p);
                for (const p of paths) for (const [x, y] of [p[0], p[p.length - 1]]) { Q.rect(x - 1, y - 1, 3, 3, 0x2a1a0c); Q.put(x, y, 0xff9f45); }
                break;
            }
            case 'alert': {     // the last stand: a red sky, the horde on the ridge
                P.vgrad(0, 0, W, 26, [[0, 0x0c0202], [0.6, 0x2a0606], [1, 0x4a0c08]]);
                ridge(26, 5, 0x160404, 0.2);
                for (let i = 0; i < 34; i++) { const x = 3 + i * 3.8 + R() * 2, r = 1.6 + R() * 1.6; P.ellipse(x, 22.5, r + 0.6, r, 0x1e0606); P.put(x - 0.5, 21.5, 0xff5f52, 0.8); }
                floor(26, 0x2a1210, 0x0c0404, 0x080202);
                break;
            }
            default: {          // THE END: the Sovereign's throne room
                P.vgrad(0, 0, W, 26, [[0, 0x080410], [1, 0x1c0e2c]]);
                for (const x of [8, 30, 102, 124]) { P.rect(x - 2, 0, 5, 26, 0x2a1840); P.line(x - 2, 0, x - 2, 25, 0x4a3060); P.rect(x - 3, 0, 7, 2, 0xb8842a); P.rect(x - 3, 24, 7, 2, 0xb8842a); }
                Q.rect(40, 4, 20, 18, 0x3a1a5a); Q.rect(42, 2, 16, 2, 0x3a1a5a); Q.line(40, 4, 59, 4, 0xffd060); Q.put(50, 1, 0xffd060); Q.rect(49, 6, 2, 3, 0xff5fd2);
                for (let s = 0; s < 3; s++) Q.rect(34 - s * 4, 22 + s * 1.5, 32 + s * 8, 2, s % 2 ? 0x2a1840 : 0x3a2458);
                floor(26, 0x24142e, 0x0a0610, 0x070410);
                break;
            }
        }
        P.toTexture(scene, key, false);
        return key;
    }

    // The traces the circuit level's card draws, and its current runs along.
    static CIRCUIT() {
        return MenuArt._circ || (MenuArt._circ = [
            [[4, 6], [30, 6], [30, 16], [52, 16]], [[52, 16], [52, 28], [80, 28]], [[10, 28], [10, 20], [40, 20], [40, 30]],
            [[60, 4], [60, 10], [92, 10], [92, 22]], [[70, 18], [70, 24], [96, 24]], [[20, 12], [20, 2]],
        ]);
    }

    // The card's lit band: the painting at 4x, then what moves in it. `live`: the focus card
    // (its neighbours keep the still painting).
    static diorama(scene, idx, x, y, w, h, { live = true } = {}) {
        MenuArt.basics(scene);
        const AW = 132, AH = 32, X0 = 16, objs = [], S = Math.max(2, Math.floor(Math.min(w / AW, h / AH)));
        const key = MenuArt.levelArt(scene, idx);
        const art = scene.add.image(x, y, key).setScale(S);
        objs.push(art);
        const L = x - AW / 2 * S, T = y - AH / 2 * S, P = (px, py) => [L + (px + X0) * S, T + py * S];   // stage pixel -> card
        const wide = () => -X0 + Math.random() * AW;   // anywhere across the painting
        const kind = (typeof Transitions !== 'undefined' && Transitions.infoFor) ? Transitions.infoFor(idx).kind : 'duality';
        const add = o => { objs.push(o); return o; };
        // A character in the painting is the game's own: its slime sprite (a boss's body for a boss), idling, in the
        // colour it wears in the level, at the size it is there relative to the scene.
        // (These were flat drawn slimes blown up to fill the card: they looked like nothing in the game.)
        const COLS = { 'mn_sl_glerp': ['slime_orange'], 'mn_sl_volt': ['volt', 1.5], 'mn_sl_void': ['slime_purple'], 'mn_sl_drown': ['slime_blue', 1, 0x3fb6e8], 'mn_sl_sov': ['void', 1.3] };
        const slime = (k, col, px, py, opts, sc = 1) => {
            const [sx, sy] = P(px, py), def = COLS[k] || ['slime_red', 1, col];
            let key = def[0];
            if (key === 'volt' || key === 'void') key = typeof BossFX !== 'undefined' ? BossFX.body(scene, key) : null;
            if (!key || !scene.textures.exists(key)) {   // a scene without the sheets loaded: the old drawn slime
                MenuArt.slimeTex(scene, k, col, opts);
                return add(scene.add.image(sx, sy, k).setOrigin(0.5, 1).setScale(S * sc));
            }
            const sk = S * 0.75 * (def[1] ?? 1) * Math.min(1.3, sc);
            const cont = add(scene.add.container(sx, sy));   // the slime and its eyes together, so a bob or squash moves both
            const spr = scene.add.sprite(0, 0, key, 0).setOrigin(0.5, 1).setScale(sk);
            const anim = { slime_orange: 'orange_idle', slime_purple: 'purple_idle', slime_red: 'red_idle', slime_blue: 'idle' }[key] || (def[0] + '_idle');
            if (!scene.anims.exists(anim) && scene.textures.exists(key)) scene.anims.create({ key: anim, frames: [{ key, frame: 0 }, { key, frame: 18 }], frameRate: 2, repeat: -1 });
            if (live) spr.play(anim);
            if (def[2] !== undefined) spr.setTint(def[2]);
            cont.add(spr);
            const angry = (opts?.mood || 'angry') !== 'friend', u = sk;   // a pair of eyes (the menus have no face pass): dark, a glint, brows for a foe
            for (const d of [-1, 1]) {
                cont.add(scene.add.rectangle(d * 3 * u, -5.5 * u, 1.6 * u, 2.2 * u, 0x0a0614));
                cont.add(scene.add.rectangle(d * 3 * u - 0.3 * u, -6.2 * u, 0.7 * u, 0.8 * u, 0xffffff));
                if (angry) cont.add(scene.add.rectangle(d * 3 * u, -7.6 * u, 2.4 * u, 0.8 * u, 0x0a0614).setRotation(d * 0.4));
            }
            if (opts?.crown) cont.add(scene.add.image(0, -16 * u, 'mn_px2').setTint(0xffd060).setScale(u * 0.6, u * 0.25));
            cont.setSize(32 * sk, 32 * sk);
            return cont;
        };
        const glowAt = (px, py, col, size, a) => { const [gx, gy] = P(px, py); return add(scene.add.image(gx, gy, 'mn_glow').setTint(col).setBlendMode(Phaser.BlendModes.ADD).setDisplaySize(size * S, size * S).setAlpha(a)); };
        const timers = [];
        const every = (ms, fn) => timers.push(scene.time.addEvent({ delay: ms, loop: true, callback: () => { if (art.active && art.parentContainer) fn(art.parentContainer); } }));
        const bob = (o, dy, ms) => live && scene.tweens.add({ targets: o, y: o.y - dy * S, duration: ms, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
        const squash = (o, ms) => live && scene.tweens.add({ targets: o, scaleY: o.scaleY * 0.86, scaleX: o.scaleX * 1.08, duration: ms, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
        const mote = (c, tex, px, py, col, dx, dy, ms, sc = 1, blend = Phaser.BlendModes.ADD) => {
            const [mx, my] = P(px, py);
            const m = scene.add.image(mx, my, tex).setTint(col).setBlendMode(blend).setScale(S * sc * 0.5);
            c.add(m);
            scene.tweens.add({ targets: m, x: mx + dx * S, y: my + dy * S, alpha: 0, duration: ms, ease: 'Sine.easeOut', onComplete: () => m.destroy() });
        };
        switch (kind) {
            case 'duality': {
                for (const tx of [18, 82]) {
                    const g = glowAt(tx, 6, 0xff9a3a, 26, 0.55);
                    const [fx, fy] = P(tx + 0.5, 7);
                    const fl = add(scene.add.image(fx, fy, 'mn_px2').setTint(0xffd060).setScale(S * 0.9, S * 1.6).setOrigin(0.5, 1).setBlendMode(Phaser.BlendModes.ADD));
                    if (live) {
                        scene.tweens.add({ targets: g, alpha: 0.85, duration: 140 + Math.random() * 90, yoyo: true, repeat: -1 });
                        scene.tweens.add({ targets: fl, scaleY: S * 2.3, duration: 110 + Math.random() * 60, yoyo: true, repeat: -1 });
                    }
                }
                const gl = slime('mn_sl_glerp', 0xff9a3a, 50, 31, { mood: 'friend' }, 1);
                squash(gl, 520); bob(gl, 1.5, 520);
                if (live) every(260, c => mote(c, 'mn_px2', 16 + Math.random() * 68, 8, Math.random() < 0.5 ? 0xffb050 : 0xff6a2a, (Math.random() - 0.5) * 4, -8, 900));
                break;
            }
            case 'storm': {
                const vs = slime('mn_sl_volt', 0x6ff0ff, 82, 31, { mood: 'angry' }, 1.6);
                squash(vs, 700);
                const fl = add(scene.add.rectangle(x, y, AW * S, 26 * S, 0xd8e8ff, 1).setOrigin(0.5, 1).setY(T + 26 * S).setAlpha(0).setBlendMode(Phaser.BlendModes.ADD));
                if (live) {
                    every(55, c => mote(c, 'mn_streak', wide(), -2, 0x9fb4d8, -3, 30, 420, 1, Phaser.BlendModes.NORMAL));
                    every(2600, c => {
                        const g = scene.add.graphics().setBlendMode(Phaser.BlendModes.ADD); c.add(g);
                        let bx = wide(), by = 0; g.lineStyle(2, 0xfffbd0, 1); g.beginPath(); g.moveTo(...P(bx, by));
                        while (by < 22) { bx += (Math.random() - 0.5) * 6; by += 3 + Math.random() * 3; g.lineTo(...P(bx, by)); }
                        g.strokePath();
                        scene.tweens.add({ targets: g, alpha: 0, duration: 260, onComplete: () => g.destroy() });
                        scene.tweens.add({ targets: fl, alpha: 0.32, duration: 60, yoyo: true });
                    });
                    every(180, c => mote(c, 'mn_spark', 76 + Math.random() * 12, 22 + Math.random() * 6, 0xffe14a, 0, 0, 160, 1));
                }
                break;
            }
            case 'rift': {
                const g = glowAt(55, 12, 0xb388ff, 30, 0.55);
                if (live) scene.tweens.add({ targets: g, alpha: 0.9, scale: g.scale * 1.15, duration: 1400, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
                const v = slime('mn_sl_void', 0x9a5cf0, 30, 30, { mood: 'angry' }, 1);
                squash(v, 800);
                for (const [rx, ry] of [[18, 10], [84, 7]]) { const r = glowAt(rx, ry, 0x5a2aa0, 12, 0.25); bob(r, 1, 1600 + Math.random() * 600); }
                if (live) every(140, c => {
                    const [sx, sy] = P(wide(), Math.random() * 24);
                    const s = scene.add.image(sx, sy, 'mn_spark').setTint(0xf4e6ff).setScale(0).setBlendMode(Phaser.BlendModes.ADD); c.add(s);
                    scene.tweens.add({ targets: s, scale: S * 0.5, duration: 260, yoyo: true, onComplete: () => s.destroy() });
                });
                break;
            }
            case 'fracture': {
                const core = glowAt(50, 13, 0x45e0e0, 26, 0.6);
                if (live) scene.tweens.add({ targets: core, alpha: 0.95, duration: 900, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
                const crack = glowAt(50, 29, 0x45e0e0, 60, 0.25).setDisplaySize(AW * S, 8 * S);
                if (live) scene.tweens.add({ targets: crack, alpha: 0.5, duration: 1200, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
                if (live) every(200, c => mote(c, 'mn_px2', wide(), 27 + Math.random() * 4, 0x8ff8f0, (Math.random() - 0.5) * 3, -10, 1000));
                break;
            }
            case 'blueprint': {
                const [, ly] = P(0, 0);
                const scan = add(scene.add.rectangle(x, ly, AW * S, S, 0x3ddc84, 0.6).setBlendMode(Phaser.BlendModes.ADD));
                if (live) scene.tweens.add({ targets: scan, y: ly + 31 * S, duration: 2200, repeat: -1, ease: 'Linear' });
                for (const [tx, ty] of [[14, 11], [86, 11], [50, 8]]) { const l = glowAt(tx, ty, 0x3ddc84, 8, 0.8); if (live) scene.tweens.add({ targets: l, alpha: 0.1, duration: 500 + Math.random() * 400, yoyo: true, repeat: -1 }); }
                break;
            }
            case 'flood': {
                const sh = glowAt(50, 14, 0x8fe8ff, 60, 0.18).setDisplaySize(AW * S, 4 * S);
                if (live) scene.tweens.add({ targets: sh, alpha: 0.45, duration: 1100, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
                const d = slime('mn_sl_drown', 0x3fb6e8, 70, 30, { mood: 'angry' }, 1); bob(d, 1.5, 1300);
                if (live) {
                    every(180, c => mote(c, 'mn_px2', wide(), 31, 0xbff4ff, (Math.random() - 0.5) * 2, -17, 1500));
                    every(1100, c => { for (const px of [25.5, 63.5]) if (Math.random() < 0.6) mote(c, 'mn_px2', px, 9, 0x8fe8ff, 0, 5, 380, 0.8, Phaser.BlendModes.NORMAL); });
                }
                break;
            }
            case 'gate': {
                const [gx, gy] = P(50, 14);
                const ring = add(scene.add.image(gx, gy, 'mn_ring').setTint(0xc99cff).setBlendMode(Phaser.BlendModes.ADD).setScale(S * 1.25, S * 2.1).setAlpha(0.8));
                const g = glowAt(50, 14, 0x9a5cf0, 22, 0.6);
                if (live) {
                    scene.tweens.add({ targets: ring, angle: 360, duration: 4200, repeat: -1 });
                    scene.tweens.add({ targets: g, alpha: 0.9, duration: 700, yoyo: true, repeat: -1 });
                    every(160, c => { const a = Math.random() * Math.PI * 2; mote(c, 'mn_px2', 50 + Math.cos(a) * 14, 14 + Math.sin(a) * 12, 0xf4e6ff, -Math.cos(a) * 12, -Math.sin(a) * 11, 700); });
                }
                break;
            }
            case 'circuit': {
                for (const [nx, ny] of MenuArt.CIRCUIT().flatMap(p => [p[0], p[p.length - 1]])) {
                    const l = glowAt(nx, ny, 0xff9f45, 7, 0.6);
                    if (live) scene.tweens.add({ targets: l, alpha: 0.15, duration: 400 + Math.random() * 500, yoyo: true, repeat: -1 });
                }
                if (live) every(380, c => {
                    const path = MenuArt.CIRCUIT()[Math.floor(Math.random() * MenuArt.CIRCUIT().length)];
                    const [sx, sy] = P(...path[0]);
                    const dot = scene.add.image(sx, sy, 'mn_px2').setTint(0xffe0a0).setBlendMode(Phaser.BlendModes.ADD).setScale(S * 0.7); c.add(dot);
                    const steps = path.slice(1).map(([px, py]) => { const [qx, qy] = P(px, py); return { x: qx, y: qy, duration: 90 + Math.hypot(qx - sx, qy - sy) * 2.2 }; });
                    scene.tweens.chain({ targets: dot, tweens: steps, onComplete: () => dot.destroy() });
                });
                break;
            }
            case 'alert': {
                const g = glowAt(50, 26, 0xff3a2a, 90, 0.18).setDisplaySize(AW * S, 30 * S);
                if (live) scene.tweens.add({ targets: g, alpha: 0.45, duration: 600, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
                const cols = [0xff5f52, 0xff9a3a, 0x9a5cf0, 0x6ff0ff, 0x7ad860];
                for (let i = 0; i < 5; i++) { const s = slime('mn_sl_h' + i, cols[i], 14 + i * 18, 31, { mood: 'angry', horns: i === 2 }, 0.8); bob(s, 1.2, 380 + i * 70); }
                break;
            }
            default: {
                const g = glowAt(50, 14, 0xffd060, 34, 0.35);
                if (live) scene.tweens.add({ targets: g, alpha: 0.6, duration: 1500, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
                const k = slime('mn_sl_sov', 0x9a5cf0, 50, 22.5, { mood: 'angry', crown: true }, 1.25);
                squash(k, 1100);
                if (live) every(170, c => mote(c, 'mn_px2', 30 + Math.random() * 40, 24, Math.random() < 0.5 ? 0xffd060 : 0xc99cff, (Math.random() - 0.5) * 6, -16, 1300));
                break;
            }
        }
        art.once('destroy', () => timers.forEach(t => t.remove()));
        return { objs };
    }

    // ── THE CISTERN, UNDER THE MAP ───────────────────────────────────────────
    // Level 5's void is the deep sea: black water with a little light far above, marine snow
    // falling through it, and things living down there. A leviathan crosses now and then, a
    // giant squid hangs in the dark, jellies drift up glowing, an anglerfish's lure bobs, small
    // fish go by in schools. Silhouettes, never lit: you see them against the faint light from
    // above, or by their own glow, or not at all.
    // Pinned behind the tiles (scrollFactor 0, depth < 0: the world camera, zoomed, so only the
    // middle of W x H is ever on screen), with parallax off the camera.
    // Visuals.js lifts some of the darkness off the void here (_vfxVoidVeil), so it shows.
    static cistern(scene) {
        MenuArt.basics(scene);
        const W = scene.scale.width, H = scene.scale.height, objs = [];
        // This runs during the level's create(), before Visuals.js sets the world camera's zoom,
        // so read the zoom it will have rather than the one it has now.
        const cam = scene.cameras.main;
        const Z = (typeof VisualFX !== 'undefined' ? VisualFX.worldZoom(scene) : 0) || cam.zoom || 1;
        // what the zoomed camera shows of a pinned object's coordinates
        const X0 = W / 2 - W / (2 * Z), X1 = W / 2 + W / (2 * Z), Y0 = H / 2 - H / (2 * Z), Y1 = H / 2 + H / (2 * Z);
        const VW = X1 - X0, VH = Y1 - Y0;
        const INK = 0x01070c, RIM = 0x15394a;      // the silhouettes, and the light along their backs
        // The water: a smooth vertical gradient, drawn with the canvas's own gradient at full
        // height and filtered linearly. (A 4x128 pixel texture stretched over the screen showed
        // its steps as hard horizontal streaks.)
        if (!scene.textures.exists('mn_sea_deep')) {
            const gt = scene.textures.createCanvas('mn_sea_deep', 4, 512), gc = gt.getContext();
            const gr = gc.createLinearGradient(0, 0, 0, 512);
            for (const [at, col] of [[0, '#14485c'], [0.3, '#0b2c3c'], [0.62, '#061826'], [1, '#020a12']]) gr.addColorStop(at, col);
            gc.fillStyle = gr; gc.fillRect(0, 0, 4, 512);
            gt.refresh(); gt.setFilter(Phaser.Textures.FilterMode.LINEAR);
        }
        // A sperm whale's shape, facing right, 192 x 56: the box of its head, a hump, the flukes.
        MenuArt.tex(scene, 'mn_sea_whale', 192, 56, P => {
            const cy = 30;
            const back = x => (x < 18 ? 0 : x < 46 ? 2.5 + (x - 18) * 0.12 : x < 128 ? 5.9 + 10.5 * Math.sin((x - 46) / 82 * Math.PI / 2)
                : x < 184 ? 16.4 + (x - 128) * 0.02 : 17.5 - (x - 184) * 0.9) + 2.6 * Math.exp(-(((x - 66) / 7) ** 2));
            const belly = x => x < 18 ? 0 : x < 46 ? 2.5 + (x - 18) * 0.1 : x < 120 ? 5.3 + 8.5 * Math.sin((x - 46) / 74 * Math.PI / 2)
                : x < 176 ? 13.8 - (x - 120) * 0.04 : 11.6 - (x - 176) * 0.5;
            for (let x = 18; x < 192; x++) {
                const t = back(x), b = belly(x);
                if (t <= 0.5 || b <= 0.5) continue;
                const y0 = Math.round(cy - t), y1 = Math.round(cy + b);
                P.rect(x, y0, 1, y1 - y0, INK);
                P.put(x, y0, RIM, 0.9);
                if (x % 3 === 0) P.put(x, y0 + 1, RIM, 0.35);
            }
            P.poly([[0, cy - 14], [7, cy - 12], [21, cy - 2], [21, cy + 2], [7, cy + 12], [0, cy + 14], [8, cy]], INK);
            P.line(0, cy - 14, 7, cy - 12, RIM, 0.8);
            P.poly([[117, cy + 9], [134, cy + 11], [125, cy + 21], [119, cy + 19]], INK);   // a pectoral fin
            P.line(146, cy + 10, 187, cy + 8, 0x000306);                                     // the long jaw
            P.put(160, cy + 1, 0x24606f);                                                     // an eye, just
            const R = MenuArt.rng(5);
            for (let i = 0; i < 30; i++) {                                                    // old scars
                const x = 60 + Math.floor(R() * 120), y = cy - 9 + Math.floor(R() * 17);
                if (P.alpha(x, y) > 0.9 && P.alpha(x, y - 2) > 0.9) P.put(x, y, 0x0b2532, 0.9);
            }
        });
        // A giant squid hanging head down, 48 x 128: fins, mantle, a pale eye, arms, two long
        // tentacles with clubs.
        MenuArt.tex(scene, 'mn_sea_squid', 48, 128, P => {
            const cx = 24;
            P.poly([[cx, 0], [cx + 14, 11], [cx, 20], [cx - 14, 11]], INK);
            for (let y = 4; y < 47; y++) {
                const t = (y - 4) / 43, hw = 3 + 7 * Math.sin(Math.min(1, t * 1.4) * Math.PI / 2) - (t > 0.86 ? (t - 0.86) * 22 : 0);
                P.rect(Math.round(cx - hw), y, Math.round(hw * 2), 1, INK);
                P.put(Math.round(cx - hw), y, RIM, 0.5);
            }
            P.ellipse(cx, 51, 7, 6, INK);
            P.put(cx - 5, 50, 0x3f8a9e); P.put(cx - 5, 51, 0x24606f);
            for (let k = 0; k < 8; k++) {
                const off = (k - 3.5) * 1.6, len = 26 + (k % 3) * 5, ph = k * 0.9;
                for (let s = 0; s <= len; s++) {
                    const x = cx + off * (1 + s / 14) + Math.sin(s / 6 + ph) * (s / 10);
                    P.rect(Math.round(x), 55 + s, s < len * 0.6 ? 2 : 1, 1, INK);
                }
            }
            for (const side of [-1, 1]) {
                let x = cx;
                for (let s = 0; s <= 64; s++) { x = cx + side * (2 + s * 0.08) + Math.sin(s / 9 + side) * 3; P.put(Math.round(x), 55 + s, INK); }
                P.ellipse(x, 121, 2.2, 4.5, INK);
            }
        });
        // An anglerfish facing left, 52 x 40: a lumpy body, the jaw hanging open on needle teeth,
        // the rod arching out in front (its lure is a light of its own, below).
        MenuArt.tex(scene, 'mn_sea_angler', 52, 40, P => {
            P.ellipse(30, 22, 15, 13, INK);
            P.poly([[42, 18], [52, 9], [50, 22], [52, 35], [42, 27]], INK);
            P.poly([[16, 21], [9, 30], [25, 35], [31, 29]], INK);
            P.poly([[15, 21], [28, 24], [12, 28]], 0x000000);
            for (const [x, y] of [[15, 22], [18, 23], [21, 23], [24, 24], [13, 27], [16, 26], [19, 26], [22, 25]]) P.put(x, y, 0x6d8f9c);
            for (let s = 0; s <= 22; s++) {
                const t = s / 22, x = 25 - t * 19, y = 11 - Math.sin(t * Math.PI) * 7 + t * 2;
                P.put(Math.round(x), Math.round(y), INK);
            }
            P.put(22, 16, 0x3f7f90);
            P.poly([[30, 34], [36, 39], [38, 33]], INK);
            P.poly([[27, 10], [33, 3], [39, 10]], INK);
            for (let x = 18; x < 44; x++) for (let y = 8; y < 14; y++) if (P.alpha(x, y) > 0.9 && P.alpha(x, y - 1) < 0.5) P.put(x, y, RIM, 0.7);
        });
        // A jelly, white (tinted and added when drawn), 22 x 44: a dome brighter at the rim,
        // frilled arms, long thin threads.
        MenuArt.tex(scene, 'mn_sea_jelly', 22, 44, P => {
            for (let y = 0; y < 13; y++) for (let x = 0; x < 22; x++) {
                const u = (x + 0.5 - 11) / 10.5, v = (y + 0.5 - 13) / 12.5, d = u * u + v * v;
                if (d <= 1) P.put(x, y, 0xffffff, 0.18 + 0.6 * d * d);
            }
            for (let x = 1; x < 21; x++) P.put(x, 13 + (x % 3 === 0 ? 1 : 0), 0xffffff, 0.85);
            for (let k = 0; k < 6; k++) {
                const x0 = 3 + k * 3.2, end = 44 - (k % 2) * 9;
                for (let y = 14; y < end; y++) P.put(Math.round(x0 + Math.sin(y / 4 + k) * 1.5), y, 0xffffff, 0.55 * (1 - (y - 14) / (end - 14)));
            }
            for (let y = 14; y < 24; y++) P.rect(9 + Math.round(Math.sin(y / 2) * 1), y, 4, 1, 0xffffff, 0.35);
        });
        MenuArt.tex(scene, 'mn_sea_fish', 9, 5, P => {
            P.ellipse(5.5, 2.5, 3.5, 1.8, INK);
            P.poly([[0, 0], [3, 2.5], [0, 5]], INK);
            P.put(7, 2, 0x3f8a9e);
        });

        // A manta ray from above, 96 x 44: broad wings, the head fins, a whip of a tail.
        MenuArt.tex(scene, 'mn_sea_manta', 96, 44, P => {
            for (let x = 0; x < 96; x++) {
                const u = (x - 48) / 48, span = 1 - Math.abs(u);                     // 0 at the wingtips
                const front = 18 - 12 * span * span - 3 * span, back = 18 + 9 * Math.pow(span, 1.6);
                if (span < 0.04) continue;
                P.rect(x, Math.round(front), 1, Math.max(1, Math.round(back - front)), INK);
                P.put(x, Math.round(front), RIM, 0.9);
            }
            P.rect(44, 4, 2, 5, INK); P.rect(50, 4, 2, 5, INK);                          // the head fins
            P.line(48, 27, 48, 43, INK);                                                  // the tail
        });

        const pin = o => { o.setScrollFactor(0); objs.push(o); return o; };
        const ADD = Phaser.BlendModes.ADD;
        pin(scene.add.image(W / 2, H / 2, 'mn_sea_deep').setDisplaySize(W * 1.1, H * 1.1).setDepth(-19));
        // Slow clouds of murk: a few big soft patches of light drifting through the water. (A
        // stretched noise texture did this before, and read as hard horizontal streaks.)
        const murk = [];
        for (let i = 0; i < 6; i++) {
            murk.push({ o: pin(scene.add.image(0, 0, 'mn_glow').setTint(i % 2 ? 0x2a8aa6 : 0x1f6f88).setBlendMode(ADD)
                .setDisplaySize(VW * (0.5 + 0.2 * (i % 3)), VH * (0.35 + 0.15 * (i % 2))).setAlpha(0.07).setDepth(-18.95)),
                x: X0 + VW * ((i * 0.37) % 1), y: Y0 + VH * (0.2 + (i * 0.29) % 0.7), vx: 3 + i, ph: i * 1.7 });
        }
        // the little light there is, far above
        pin(scene.add.image(W / 2, Y0 - VH * 0.12, 'mn_glow').setDisplaySize(VW * 1.5, VH * 1.1).setTint(0x2a8aa6)
            .setBlendMode(ADD).setAlpha(0.3).setDepth(-18.9));
        const rays = [];
        for (let i = 0; i < 3; i++) {
            const s = pin(scene.add.image(X0 + VW * (0.22 + i * 0.28), Y0 - VH * 0.1, 'mn_shaft').setOrigin(0.5, 0)
                .setDisplaySize(70 + i * 22, VH * 1.05).setTint(0x7fd8f0).setBlendMode(ADD).setAlpha(0.05).setDepth(-18.88));
            s.rotation = -0.1 + i * 0.08;
            rays.push(s);
        }
        // the things down here: each drifts on its own, wrapped round a span wider than the view
        // (the wider, the rarer it passes), and slides with the camera a little (k)
        const swimmers = [];
        // The world camera zooms pinned objects too, so sizes are divided by it: otherwise every
        // creature shows Z times too big, with chunky pixel steps.
        const zs = v => v / Z;
        const swim = (o, s) => { swimmers.push(Object.assign({ o, ph: Math.random() * 6.283, vx: 0, vy: 0, bob: 0, k: 0.05, mx: 0, my: 0 }, s)); return o; };
        // A faint teal glow just behind a big silhouette, so its shape reads against the dark water.
        const rim = (o, a = 0.22) => pin(scene.add.image(0, 0, o.texture.key).setTint(0x3fb6e8).setBlendMode(ADD).setAlpha(a)
            .setScale(o.scaleX * 1.05, o.scaleY * 1.08).setDepth(o.depth - 0.01));
        // far off: a second whale, small and pale with distance, slow
        const far = pin(scene.add.image(0, 0, 'mn_sea_whale').setScale(zs(1.1)).setAlpha(0.45).setTint(0x2a5a6a).setDepth(-18.86));
        swim(far, { x: X0 + VW * 0.7, y: Y0 + VH * 0.18, vx: -4, k: 0.015, bob: 3, mx: 900 });
        const whale = pin(scene.add.image(0, 0, 'mn_sea_whale').setScale(zs(2.3)).setAlpha(0.95).setDepth(-18.8));
        swim(whale, { x: X0 + VW * 0.15, y: Y0 + VH * 0.3, vx: 9, k: 0.03, bob: 5, mx: 1100, rim: rim(whale) });
        const squid = pin(scene.add.image(0, 0, 'mn_sea_squid').setScale(zs(1.6)).setDepth(-18.6));
        swim(squid, { x: X0 + VW * 0.2, y: Y0 + VH * 0.62, vy: -3.2, k: 0.06, my: 520, sway: 0.08, rim: rim(squid) });
        // a manta, gliding across with slow beats of its wings
        const manta = pin(scene.add.image(0, 0, 'mn_sea_manta').setScale(zs(1.8)).setDepth(-18.55));
        swim(manta, { x: X0 + VW * 0.55, y: Y0 + VH * 0.5, vx: 12, k: 0.07, bob: 10, mx: 800, flap: true, rim: rim(manta, 0.18) });
        const jellies = [];
        for (let i = 0; i < 4; i++) {
            const j = pin(scene.add.image(0, 0, 'mn_sea_jelly').setScale(zs(1.6 + (i % 2) * 0.5)).setTint(i % 2 ? 0xb68cff : 0x5fe0ff)
                .setBlendMode(ADD).setAlpha(0.45).setDepth(-18.5));
            jellies.push(swim(j, { x: X0 + VW * (0.32 + i * 0.19), y: Y0 + VH * (0.25 + (i * 0.37) % 0.7), vy: -(5 + i * 1.3), k: 0.05 + i * 0.012, my: 260, pulse: true }));
        }
        const angler = pin(scene.add.image(0, 0, 'mn_sea_angler').setScale(zs(2)).setDepth(-18.45));
        swim(angler, { x: X0 + VW * 0.78, y: Y0 + VH * 0.8, vx: -4, k: 0.08, bob: 6, mx: 700, rim: rim(angler, 0.16) });
        const lure = pin(scene.add.image(0, 0, 'mn_glow').setTint(0x7affe8).setBlendMode(ADD).setDepth(-18.44));
        const lureCore = pin(scene.add.image(0, 0, 'mn_px2').setTint(0xeafff8).setBlendMode(ADD).setDepth(-18.43));
        const schools = [];
        for (let s = 0; s < 2; s++) {
            const fish = [];
            for (let i = 0; i < 13; i++) {
                const f = pin(scene.add.image(0, 0, 'mn_sea_fish').setScale(zs(2)).setAlpha(0.95).setDepth(-18.3));
                fish.push({ o: f, dx: (Math.random() - 0.5) * 70, dy: (Math.random() - 0.5) * 34, ph: Math.random() * 6.283 });
            }
            schools.push(swim(fish[0].o, { x: X0 + VW * (s ? 0.7 : 0.1), y: Y0 + VH * (s ? 0.42 : 0.55), vx: s ? -15 : 18, k: 0.11, bob: 18, mx: 900, pad: 40, fish }));
        }
        // marine snow falling; now and then something alive glints
        if (scene.add.particles) {
            const breathe = { onEmit: () => 0, onUpdate: (p, key, t) => Math.sin(t * Math.PI) };
            pin(scene.add.particles(0, 0, 'mn_px', {
                x: { min: X0, max: X1 }, y: { min: Y0, max: Y1 }, lifespan: { min: 7000, max: 12000 },
                speedY: { min: 3, max: 10 }, speedX: { min: -3, max: 3 }, scale: { min: 1, max: 2 },
                alpha: { onEmit: () => 0, onUpdate: (p, key, t) => 0.45 * Math.sin(t * Math.PI) },
                tint: [0xcfe8ef, 0x9fbcc8, 0x7fa8b8], frequency: 70,
            }).setDepth(-18.2));
            pin(scene.add.particles(0, 0, 'mn_px2', {
                x: { min: X0, max: X1 }, y: { min: Y0 + VH * 0.3, max: Y1 }, lifespan: { min: 1800, max: 3600 },
                speed: { min: 0, max: 4 }, scale: { min: 0.5, max: 1 }, alpha: breathe,
                tint: [0x6ff0ff, 0x9a7cff, 0x5cffc0], frequency: 260, blendMode: ADD,
            }).setDepth(-18.1));
        }
        const wrap = (v, lo, hi) => { const s = hi - lo; return lo + ((((v - lo) % s) + s) % s); };
        let t = 0;                       // seconds this backdrop has run (a pause stops it; a hitch can't fling things)
        const tick = (time, delta) => {
            t += Math.min(delta || 0, 100) * 0.001;
            for (const m of murk) m.o.setPosition(wrap(m.x + m.vx * t - cam.scrollX * 0.02, X0 - VW * 0.4, X1 + VW * 0.4), m.y + 14 * Math.sin(t * 0.15 + m.ph));
            for (let i = 0; i < rays.length; i++) {
                rays[i].rotation = -0.1 + i * 0.08 + 0.03 * Math.sin(t * 0.3 + i * 1.9);
                rays[i].alpha = 0.035 + 0.025 * Math.sin(t * 0.4 + i * 2.3);
            }
            for (const s of swimmers) {
                const hw = s.o.displayWidth / 2 + 20 + (s.pad || 0), hh = s.o.displayHeight / 2 + 20 + (s.pad || 0);
                let x = s.x + s.vx * t - cam.scrollX * s.k, y = s.y + s.vy * t - cam.scrollY * s.k * 0.6;
                if (s.vx) x = wrap(x, X0 - hw - s.mx, X1 + hw);
                if (s.vy) y = wrap(y, Y0 - hh - s.my, Y1 + hh);
                y += s.bob * Math.sin(t * 0.5 + s.ph);
                if (s.fish) {                                    // a school: each fish keeps near the middle
                    for (const f of s.fish) {
                        f.o.setPosition(x + f.dx + 4 * Math.sin(t * 1.3 + f.ph), y + f.dy + 3 * Math.sin(t * 1.9 + f.ph * 2)).setFlipX(s.vx < 0);
                    }
                    continue;
                }
                s.o.setPosition(x, y);
                if (s.sway) s.o.rotation = s.sway * Math.sin(t * 0.4 + s.ph);
                if (s.flap) {                                   // a manta's wings beat, slow and deep
                    const sc = s.o._base || (s.o._base = s.o.scaleX);
                    s.o.setScale(sc, sc * (0.72 + 0.28 * Math.abs(Math.sin(t * 0.9 + s.ph))));
                }
                if (s.pulse) {                                  // a jelly's bell squeezes, and it rises a little on each squeeze
                    const q = Math.sin(t * 1.6 + s.ph), sc = s.o._base || (s.o._base = s.o.scaleX);
                    s.o.setScale(sc * (1 + 0.06 * q), sc * (1 - 0.07 * q));
                    s.o.alpha = 0.38 + 0.12 * Math.max(0, q);
                }
                if (s.vx) s.o.setFlipX(s.vx < 0 !== (s.o === angler));
                if (s.rim) s.rim.setPosition(s.o.x, s.o.y - 2).setRotation(s.o.rotation).setFlipX(s.o.flipX)
                    .setScale(s.o.scaleX * 1.05, s.o.scaleY * 1.08);
            }
            // the lure: at the tip of the angler's rod, breathing
            const fl = angler.flipX ? -1 : 1;
            const lx = angler.x + fl * (6 - 26) * angler.scaleX, ly = angler.y + (12 - 20) * angler.scaleY;
            const pulse = 0.5 + 0.5 * Math.sin(t * 2.2);
            lure.setPosition(lx, ly).setDisplaySize(26 + 10 * pulse, 26 + 10 * pulse).setAlpha(0.45 + 0.4 * pulse);
            lureCore.setPosition(lx - 1, ly - 1).setAlpha(0.7 + 0.3 * pulse);
        };
        tick(0, 0);
        const life = MenuArt._life(scene, objs, tick);
        scene._vfxVoidVeil = { key: MenuArt.voidMask(scene), alpha: 0.8 };   // most of the dark lifted over the open water
        return { objs, destroy: () => life.destroy() };
    }

    // ── THE GAUNTLET'S ROOF, UNDER THE MAP ───────────────────────────────────
    // The top of the storm tower is open to the sky: past its edge, storm cloud far below and all round, two layers drifting
    // with the wind at their own depths (parallax off the camera), over the dark. LevelManager._stormFlash lights them up.
    static stormSky(scene) {
        const W = scene.scale.width, H = scene.scale.height, objs = [], cam = scene.cameras.main;
        const Z = (typeof VisualFX !== 'undefined' ? VisualFX.worldZoom(scene) : 0) || cam.zoom || 1;   // (the zoom it will have: see cistern)
        const X0 = W / 2 - W / (2 * Z), Y0 = H / 2 - H / (2 * Z), VW = W / Z, VH = H / Z;
        const pin = o => { objs.push(o); return o.setScrollFactor(0); };
        pin(scene.add.rectangle(X0, Y0, VW, VH, 0x070910).setOrigin(0).setDepth(-19));
        const far = pin(scene.add.tileSprite(X0, Y0, VW, VH, 'sky_storm').setOrigin(0).setDepth(-18.9).setTileScale(2.2 / Z).setAlpha(0.5).setTint(0x6a7690));
        const near = pin(scene.add.tileSprite(X0, Y0, VW, VH, 'sky_storm').setOrigin(0).setDepth(-18.8).setTileScale(3.6 / Z).setAlpha(0.75).setTint(0x9aa6c0));
        far._tint = 0x6a7690; near._tint = 0x9aa6c0;
        let t = 0;
        const tick = (now, dt) => {
            t += dt / 1000;
            far.setTilePosition((cam.scrollX * 0.12 + t * 6) / far.tileScaleX, cam.scrollY * 0.12 / far.tileScaleY);
            near.setTilePosition((cam.scrollX * 0.3 + t * 18) / near.tileScaleX, (cam.scrollY * 0.3 + t * 4) / near.tileScaleY);
        };
        tick(0, 0);
        const life = MenuArt._life(scene, objs, tick);
        scene._vfxVoidVeil = { key: MenuArt.voidMask(scene), alpha: 0.75 };   // the dark lifted over the drop
        return { objs, layers: [far, near], destroy: () => life.destroy() };
    }

    // The map's void as a mask, one pixel a tile, softened a tile's width: Visuals.js erases
    // that much of the darkness over it, so a backdrop can show in the dark. A wall is only its
    // line now, so a wall with void beside it is open water past the line (less of it lifted,
    // so the floor's edge stays dark); a block with no void around it stays dark.
    static voidMask(scene) {
        const key = 'mn_voidmask';
        if (scene.textures.exists(key)) scene.textures.remove(key);
        const ww = scene.WORLD_WIDTH, wh = scene.WORLD_HEIGHT, W0 = scene.world;
        if (!W0 || !ww || !wh) return null;
        const at = (x, y) => (x < 0 || y < 0 || x >= ww || y >= wh) ? -1 : W0[x][y];
        const isVoid = (x, y) => { const t = at(x, y); return t !== scene.FLOOR && t !== scene.WALL; };
        const open = (x, y) => {
            const t = at(x, y);
            if (t === scene.FLOOR) return false;
            if (t !== scene.WALL) return true;
            for (let j = -1; j <= 1; j++) for (let i = -1; i <= 1; i++) if (isVoid(x + i, y + j)) return true;
            return false;
        };
        const P = new MenuArt.Px(ww, wh);
        for (let y = 0; y < wh; y++) for (let x = 0; x < ww; x++) {
            if (!open(x, y)) continue;
            let near = 0;
            for (let j = -1; j <= 1; j++) for (let i = -1; i <= 1; i++) if (at(x + i, y + j) === scene.FLOOR) near++;
            P.put(x, y, 0xffffff, near ? 0.3 : (at(x, y) === scene.WALL ? 0.6 : 1));
        }
        P.toTexture(scene, key, true);
        return key;
    }

    // Removes `fn` from the scene's update and the objects from the display when either the
    // owner or the scene goes away.
    static _life(scene, objs, fn) {
        let alive = true;
        const off = () => { alive = false; if (fn) scene.events.off('update', fn); };
        if (fn) scene.events.on('update', fn);
        scene.events.once('shutdown', off);
        return {
            get alive() { return alive; },
            destroy() {
                if (!alive) return;
                off();
                scene.events.off('shutdown', off);
                for (const o of objs) if (o?.active) { scene.tweens.killTweensOf(o); o.destroy(); }
                objs.length = 0;
            }
        };
    }
}

// ── THE PIXEL BUFFER ─────────────────────────────────────────────────────────
// RGBA bytes plus the few drawing calls the painters need. Colours are 0xRRGGBB numbers;
// `a` blends over what is there.
MenuArt.Px = class {
    constructor(w, h) { this.w = w; this.h = h; this.d = new Uint8ClampedArray(w * h * 4); }

    put(x, y, c, a = 1) {
        x = Math.floor(x); y = Math.floor(y);
        if (x < 0 || y < 0 || x >= this.w || y >= this.h || !(a > 0)) return;
        const i = (y * this.w + x) * 4, d = this.d;
        const r = (c >> 16) & 255, g = (c >> 8) & 255, b = c & 255;
        if (a >= 1) { d[i] = r; d[i + 1] = g; d[i + 2] = b; d[i + 3] = 255; return; }
        const da = d[i + 3] / 255, oa = a + da * (1 - a);
        if (oa <= 0) return;
        d[i] = (r * a + d[i] * da * (1 - a)) / oa;
        d[i + 1] = (g * a + d[i + 1] * da * (1 - a)) / oa;
        d[i + 2] = (b * a + d[i + 2] * da * (1 - a)) / oa;
        d[i + 3] = oa * 255;
    }
    // Adds light: brightens what is there (or lays down glow where nothing is).
    add(x, y, c, a = 1) {
        x = Math.floor(x); y = Math.floor(y);
        if (x < 0 || y < 0 || x >= this.w || y >= this.h || !(a > 0)) return;
        const i = (y * this.w + x) * 4, d = this.d;
        d[i] += ((c >> 16) & 255) * a; d[i + 1] += ((c >> 8) & 255) * a; d[i + 2] += (c & 255) * a;
        d[i + 3] = Math.max(d[i + 3], 255 * Math.min(1, a));
    }
    // Darkens what is there by k (0 = untouched, 1 = black); keeps alpha.
    dim(x, y, k) {
        x = Math.floor(x); y = Math.floor(y);
        if (x < 0 || y < 0 || x >= this.w || y >= this.h) return;
        const i = (y * this.w + x) * 4, d = this.d, m = 1 - k;
        d[i] *= m; d[i + 1] *= m; d[i + 2] *= m;
    }
    alpha(x, y) { return (x < 0 || y < 0 || x >= this.w || y >= this.h) ? 0 : this.d[(y * this.w + x) * 4 + 3] / 255; }
    get(x, y) {
        if (x < 0 || y < 0 || x >= this.w || y >= this.h) return -1;
        const i = (y * this.w + x) * 4, d = this.d;
        return d[i + 3] ? (d[i] << 16) | (d[i + 1] << 8) | d[i + 2] : -1;
    }
    clear(x, y) { if (x >= 0 && y >= 0 && x < this.w && y < this.h) this.d[(y * this.w + x) * 4 + 3] = 0; }

    rect(x, y, w, h, c, a = 1) {
        for (let j = Math.max(0, Math.floor(y)); j < Math.min(this.h, Math.floor(y + h)); j++)
            for (let i = Math.max(0, Math.floor(x)); i < Math.min(this.w, Math.floor(x + w)); i++) this.put(i, j, c, a);
    }
    line(x0, y0, x1, y1, c, a = 1) {
        x0 = Math.round(x0); y0 = Math.round(y0); x1 = Math.round(x1); y1 = Math.round(y1);
        const dx = Math.abs(x1 - x0), dy = -Math.abs(y1 - y0), sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1;
        let err = dx + dy;
        for (;;) {
            this.put(x0, y0, c, a);
            if (x0 === x1 && y0 === y1) break;
            const e2 = 2 * err;
            if (e2 >= dy) { err += dy; x0 += sx; }
            if (e2 <= dx) { err += dx; y0 += sy; }
        }
    }
    disc(cx, cy, r, c, a = 1) { this.ellipse(cx, cy, r, r, c, a); }
    ellipse(cx, cy, rx, ry, c, a = 1) {
        for (let y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y++)
            for (let x = Math.floor(cx - rx); x <= Math.ceil(cx + rx); x++) {
                const u = (x + 0.5 - cx) / rx, v = (y + 0.5 - cy) / ry;
                if (u * u + v * v <= 1) this.put(x, y, c, a);
            }
    }
    // A one-pixel ellipse outline.
    ringE(cx, cy, rx, ry, c, a = 1) {
        const n = Math.ceil((rx + ry) * 4);
        let lx = null, ly = null;
        for (let k = 0; k <= n; k++) {
            const t = k / n * Math.PI * 2;
            const x = Math.round(cx + Math.cos(t) * rx), y = Math.round(cy + Math.sin(t) * ry);
            if (x !== lx || y !== ly) { this.put(x, y, c, a); lx = x; ly = y; }
        }
    }
    // Filled polygon, even-odd, sampled at pixel centres.
    poly(pts, c, a = 1) {
        let y0 = Infinity, y1 = -Infinity;
        for (const p of pts) { y0 = Math.min(y0, p[1]); y1 = Math.max(y1, p[1]); }
        for (let y = Math.max(0, Math.floor(y0)); y <= Math.min(this.h - 1, Math.ceil(y1)); y++) {
            const yc = y + 0.5, xs = [];
            for (let i = 0; i < pts.length; i++) {
                const [ax, ay] = pts[i], [bx, by] = pts[(i + 1) % pts.length];
                if ((ay <= yc && by > yc) || (by <= yc && ay > yc)) xs.push(ax + (yc - ay) / (by - ay) * (bx - ax));
            }
            xs.sort((p, q) => p - q);
            for (let k = 0; k + 1 < xs.length; k += 2)
                for (let x = Math.max(0, Math.ceil(xs[k] - 0.5)); x <= Math.min(this.w - 1, Math.floor(xs[k + 1] - 0.5)); x++) this.put(x, y, c, a);
        }
    }
    // Vertical gradient through `stops` ([t, colour], t from 0 at the top to 1 at the bottom),
    // dithered between neighbouring stops.
    vgrad(x, y, w, h, stops, a = 1) {
        for (let j = 0; j < h; j++) {
            const t = h > 1 ? j / (h - 1) : 0;
            let k = 0;
            while (k < stops.length - 2 && t > stops[k + 1][0]) k++;
            const [t0, c0] = stops[k], [t1, c1] = stops[Math.min(k + 1, stops.length - 1)];
            const f = t1 > t0 ? (t - t0) / (t1 - t0) : 0;
            for (let i = 0; i < w; i++) this.put(x + i, y + j, f > MenuArt.bayer(x + i, y + j) ? c1 : c0, a);
        }
    }
    // Rows of characters, one pixel each ('.' clear), coloured from `pal`.
    rows(x0, y0, rows, pal) {
        rows.forEach((row, j) => {
            for (let i = 0; i < row.length; i++) {
                const ch = row[i];
                if (ch === '.' || ch === ' ' || pal[ch] === undefined) continue;
                this.put(x0 + i, y0 + j, MenuArt.hex(pal[ch]));
            }
        });
    }
    // A one-pixel outline in `c` around everything opaque (4-neighbourhood).
    outline(c, a = 1, diag = false) {
        const w = this.w, h = this.h, src = new Uint8Array(w * h);
        for (let i = 0; i < w * h; i++) src[i] = this.d[i * 4 + 3] > 40 ? 1 : 0;
        const on = (x, y) => x >= 0 && y >= 0 && x < w && y < h && src[y * w + x];
        for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
            if (src[y * w + x]) continue;
            if (on(x - 1, y) || on(x + 1, y) || on(x, y - 1) || on(x, y + 1) ||
                (diag && (on(x - 1, y - 1) || on(x + 1, y - 1) || on(x - 1, y + 1) || on(x + 1, y + 1)))) this.put(x, y, c, a);
        }
    }
    // Copies another buffer in at (x, y), blending.
    blit(src, x, y, a = 1) {
        for (let j = 0; j < src.h; j++) for (let i = 0; i < src.w; i++) {
            const k = (j * src.w + i) * 4, sa = src.d[k + 3] / 255;
            if (sa > 0) this.put(x + i, y + j, (src.d[k] << 16) | (src.d[k + 1] << 8) | src.d[k + 2], sa * a);
        }
    }
    toTexture(scene, key, linear) {
        const t = scene.textures.createCanvas(key, this.w, this.h);
        t.getContext().putImageData(new ImageData(this.d, this.w, this.h), 0, 0);
        t.refresh();
        if (linear) t.setFilter(Phaser.Textures.FilterMode.LINEAR);
        return t;
    }
};
