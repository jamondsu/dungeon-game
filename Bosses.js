// ═══════════════════════════════════════════════════════════════════════════
// Bosses.js: how the bosses and their attacks look.
//
// A mixin like Visuals.js and Creatures.js (GameScene borrows each method through a one-line
// proxy), plus static helpers any scene can call: tower defense shares the enemy shots, the
// mortar and the sniper sights, so those are BossFX.shot, BossFX.mark and friends.
// Everything in here is presentation. The attack code still decides where things are, when they
// land and what they hit; this file only draws that, and every telegraph is built from the same
// numbers the hit test reads.
//
//   telegraphs  danger tiles on the floor that are exactly the tiles a hit lands on: they fill in
//               as the wind-up runs out and flash when it lands
//   shots       pixel-art bolts, shards, darts and orbs that point the way they fly, each with a
//               wake, a light and an impact in its own colour
//   bosses      the Voltslime crackles, the Void Sovereign is a slime of night sky with a ring and
//               a floating crown, the Fracture Core turns smoothly, the Queen glows red
//   rifts       void portals in the floor (the snipers, the maw) open, swirl, idle and close
// The pixel art is in BossFX.art(); colours and sizes worth tuning in _bfxCfg().
// ═══════════════════════════════════════════════════════════════════════════
class BossFX {

    // ── THE ART ──────────────────────────────────────────────────────────────
    // Rows of characters, one per pixel ('.' is clear; k is the slimes' outline colour). Shots
    // point right (+x) and are turned to their heading. slime: the silhouette every slime sheet
    // shares (frame 0 from row 22, frame 18 from row 23); bodies: a boss's colours for it.
    static art() {
        if (BossFX._art) return BossFX._art;
        return (BossFX._art = {
 "shots": {
  "bolt": {"pal": {"r": "#b8281a", "o": "#ff6a2a", "y": "#ffc44a", "W": "#fff6e0"}, "rows": [
    "....kkkk...",
    "..kkrooyk..",
    "kkrrooyyWWk",
    "..kkrooyk..",
    "....kkkk..."]},
  "shard": {"pal": {"p": "#7a2ad0", "v": "#b45cff", "V": "#e6b8ff", "W": "#ffffff"}, "rows": [
    "..kk....",
    ".kpvkk..",
    "kpvvVWkk",
    ".kpvkk..",
    "..kk...."]},
  "maw": {"pal": {"p": "#6a1cc0", "v": "#c070ff", "V": "#f0c8ff", "W": "#ffffff"}, "rows": [
    "...kkk...",
    ".kkpvVkk.",
    "kppvVVWWk",
    ".kkpvVkk.",
    "...kkk..."]},
  "dart": {"pal": {"f": "#ff7a2a", "s": "#c89a40", "y": "#ffd84a", "Y": "#fff3a8", "W": "#ffffff"}, "rows": [
    "kk.......k...",
    "kfk......kyk.",
    ".kfkkkkkkkyYk",
    "..kssssssyYWk",
    ".kfkkkkkkkyYk",
    "kfk......kyk.",
    "kk.......k..."]},
  "volt": {"pal": {"c": "#2fb8ff", "C": "#9ff6ff", "W": "#ffffff"}, "rows": [
    "...k...",
    "..kck..",
    ".kcCck.",
    "kcCWCck",
    ".kcCck.",
    "..kck..",
    "...k..."]},
  "zap": {"pal": {"m": "#d22aa8", "M": "#ff8ae6", "W": "#ffffff"}, "rows": [
    "..kkk..",
    ".kmMmk.",
    "kmMWMmk",
    "kMWWWMk",
    "kmMWMmk",
    ".kmMmk.",
    "..kkk.."]},
  "homing": {"pal": {"d": "#3a0f6a", "p": "#8a3aff", "v": "#c88cff", "W": "#ffffff"}, "rows": [
    "....kkk....",
    "..kkpvpkk..",
    ".kpvvVvvpk.",
    ".kvvdddvvk.",
    "kpvdWWWdvpk",
    "kvVdWWWdVvk",
    "kpvdWWWdvpk",
    ".kvvdddvvk.",
    ".kpvvVvvpk.",
    "..kkpvpkk..",
    "....kkk...."]},
  "ripple": {"pal": {"d": "#2a0a4a", "p": "#9a3aff", "v": "#d79cff", "W": "#ffffff"}, "rows": [
    "..kkk..",
    ".kpvpk.",
    "kpvWvpk",
    "kvWdWvk",
    "kpvWvpk",
    ".kpvpk.",
    "..kkk.."]},
  "shell": {"pal": {"i": "#3a4252", "I": "#5d6a80", "h": "#9aa8c0", "o": "#ff7a1a", "y": "#ffd060"}, "rows": [
    "...kkkkk...",
    "..kiIhIik..",
    ".kiIhhIiik.",
    "kiIhIIiiiik",
    "kiIIiiiiiik",
    "koyoyoyoyok",
    "kiiiiiiiiik",
    "kiiiiiiiiik",
    ".kiiiiiiik.",
    "..kiiiiik..",
    "...kkkkk..."]},
  "frag": {"pal": {"d": "#1a0830", "p": "#4a1890", "v": "#9a4cff", "V": "#e6b8ff", "W": "#ffffff", "g": "#ff6ae8"}, "rows": [
    "......k......",
    ".....kVk.....",
    "....kVWvk....",
    "....kVvpk....",
    "...kVvvpdk...",
    "...kVvpddk...",
    "..kVvpdddpk..",
    "..kVvdgWgdk..",
    "..kvvdggdpk..",
    "...kvpddpk...",
    "...kvvpdpk...",
    "....kvpdk....",
    "....kvppk....",
    ".....kpk.....",
    "......k......"]},
  "vcrown": {"pal": {"d": "#24104a", "v": "#5a2aa6", "V": "#b07cff", "g": "#ff4ad8", "G": "#ffb8f4", "W": "#ffffff"}, "rows": [
    "k.....k.....k",
    "kk...kVk...kk",
    "kVk..kGk..kVk",
    "kvVkkvgvkkVvk",
    "kvvVvvvvvVvvk",
    "kVGVVgWgVVGVk",
    "kdddddddddddk",
    ".kkkkkkkkkkk."]},
  "ember": {"pal": {"o": "#ff9a3a", "y": "#fff0a0"}, "rows": [
    ".o.",
    "oyo",
    ".o."]}
 },
 "slime": {
  "f0": [
    "..............kkkkk.............",
    "............kkbmmmbkk...........",
    "...........kbmhhhmmmbk..........",
    "..........kmmhhmmmmmbbk.........",
    ".........kbmmmmmmmmbbbbk........",
    ".........kbmmmmmmmbbbbbk........",
    "........kbbbmmmmbbbbbbbbk.......",
    "........kbbbbbbbbbbbbbbbk.......",
    "........kbbbbbbbbbbbbbbbk.......",
    ".........kkkkkkkkkkkkkkk........"],
  "f18": [
    ".............kkkkkkk............",
    "...........kkmmhhhmbkk..........",
    "..........kbhhhmmmmmbbk.........",
    ".........kbmmmmmmmmmmbbk........",
    "........kbmmmmmmmmmmbbbbk.......",
    ".......kbbmmmmmmmmbbbbbbbk......",
    ".......kbbbmmmbbbbbbbbbbbk......",
    ".......kbbbbbbbbbbbbbbbbbk......",
    "........kkkkkkkkkkkkkkkkk......."]
 },
 "bodies": {
  "volt": {"pal": {"k": "#0a1430", "b": "#1d63ff", "m": "#3fd4ff", "h": "#f4ffe0"}},
  "void": {"pal": {"k": "#07040d", "b": "#2a0f52", "m": "#5a2aa6", "h": "#c99cff"}, "deco": {"0": [[12, 28, "#ffffff"], [19, 29, "#ffb0f0"], [22, 27, "#ffffff"], [15, 30, "#9fd8ff"], [17, 26, "#ffffff"]], "18": [[13, 29, "#ffb0f0"], [18, 30, "#ffffff"], [21, 28, "#9fd8ff"], [10, 29, "#ffffff"], [16, 27, "#ffffff"]]}}
 }
});
    }

    static pix(ctx, x0, y0, rows, pal) {
        const BASE = { k: '#1c1728', K: '#0b0812', w: '#ffffff' };
        rows.forEach((row, j) => {
            for (let i = 0; i < row.length; i++) {
                const ch = row[i];
                if (ch === '.' || ch === ' ') continue;
                ctx.fillStyle = (pal && pal[ch]) || BASE[ch] || '#ff00ff';
                ctx.fillRect(x0 + i, y0 + j, 1, 1);
            }
        });
    }

    // Every shot's frame in one canvas, built once per game by whichever scene asks first.
    static sheet(scene) {
        const tm = scene?.textures;
        if (!tm) return false;
        if (tm.exists('bfx_shots')) return true;
        const list = Object.entries(BossFX.art().shots);
        let W = 1, H = 1;
        for (const [, b] of list) { W += b.rows[0].length + 1; H = Math.max(H, b.rows.length + 1); }
        const t = tm.createCanvas('bfx_shots', W, H), ctx = t.getContext();
        let x = 0;
        for (const [name, b] of list) {
            BossFX.pix(ctx, x, 0, b.rows, b.pal);
            t.add(name, 0, x, 0, b.rows[0].length, b.rows.length);
            x += b.rows[0].length + 1;
        }
        t.refresh();
        return true;
    }

    // A boss body: the slime silhouette (so eyes and hats sit where they do on any slime) in the
    // boss's own colours, painted from art rather than read back from a sheet. Frames 0 and 18
    // like a slime sheet, key 'slime_<name>' (Creatures.js only puts eyes on slime_ textures),
    // and an idle animation '<name>_idle'.
    static body(scene, name) {
        const tm = scene?.textures, key = 'slime_' + name;
        if (!tm) return null;
        if (!tm.exists(key)) {
            const A = BossFX.art(), B = A.bodies[name];
            if (!B) return null;
            const t = tm.createCanvas(key, 64, 32), ctx = t.getContext();
            [[0, 22, A.slime.f0], [18, 23, A.slime.f18]].forEach(([f, y0, rows], i) => {
                BossFX.pix(ctx, i * 32, y0, rows, B.pal);
                for (const [x, y, c] of (B.deco?.[f] || [])) { ctx.fillStyle = c; ctx.fillRect(i * 32 + x, y, 1, 1); }
            });
            t.add(0, 0, 0, 0, 32, 32);
            t.add(18, 0, 32, 0, 32, 32);
            t.refresh();
        }
        const anim = name + '_idle';
        if (scene.anims && !scene.anims.exists(anim)) {
            scene.anims.create({ key: anim, frames: [{ key, frame: 0 }, { key, frame: 18 }], frameRate: 2, repeat: -1 });
        }
        return key;
    }

    // What each kind of shot looks like: its frame, colour, wake, the Visuals.js burst its impact
    // borrows, and its light. `turn`: it points the way it flies.
    static kinds() {
        return BossFX._kinds || (BossFX._kinds = {
            bolt:   { frame: 'bolt',   color: 0xff6a2a, wake: 'bolt', burst: 'fire',      light: 26, turn: true },
            shard:  { frame: 'shard',  color: 0xc46cff, wake: 'void', burst: 'cosmic',    light: 22, turn: true },
            maw:    { frame: 'maw',    color: 0xd27aff, wake: 'void', burst: 'cosmic',    light: 26, turn: true },
            dart:   { frame: 'dart',   color: 0xffd84a, wake: 'dart', burst: 'lightning', light: 24, turn: true },
            vine:   { frame: 'ember',  color: 0x5aff8a, wake: 'vine', burst: null,        light: 30 },
            volt:   { frame: 'volt',   color: 0x5ff0ff, wake: 'volt', burst: 'ice',       light: 22 },
            zap:    { frame: 'zap',    color: 0xff5ad8, wake: 'zap',  burst: 'cosmic',    light: 22 },
            homing: { frame: 'homing', color: 0xb070ff, wake: 'void', burst: 'cosmic',    light: 46 },
            ripple: { frame: 'ripple', color: 0xb45cff, wake: 'void', burst: 'cosmic',    light: 24 },
            shell:  { frame: 'shell',  color: 0xff7a1a, wake: 'bolt', burst: 'fire',      light: 30 },
        });
    }
    static kindOf(p) {
        return p._bfxKind || (p.isRopeTendril ? 'vine' : p._isShotgunPellet ? 'shard' : p.isRicochetArrow ? 'dart' : 'bolt');
    }

    // ── SHOTS (any scene) ────────────────────────────────────────────────────
    static shot(scene, kind, x, y, angle = 0, depth = 2.6) {
        BossFX.sheet(scene);
        const K = BossFX.kinds()[kind] || BossFX.kinds().bolt;
        const img = scene.add.image(x, y, 'bfx_shots', K.frame).setDepth(depth).setRotation(angle);
        scene._vfxSort?.(img);
        return img;
    }

    // Where a shot ends: a ring and a few sparks in its colour, and a flare of light.
    static pop(scene, kind, x, y, n = 5) {
        const K = BossFX.kinds()[kind] || BossFX.kinds().bolt;
        if (scene.textures?.exists('vfx_ring')) {
            const r = scene.add.image(x, y, 'vfx_ring').setBlendMode(Phaser.BlendModes.ADD).setTint(K.color)
                .setDepth(3.1).setScale(0.1).setAlpha(0.95);
            scene._vfxSort?.(r);
            scene.tweens.add({ targets: r, scale: 0.34, alpha: 0, duration: 200, ease: 'Cubic.easeOut', onComplete: () => r.destroy() });
        }
        const B = K.burst && scene._vfxBursts?.[K.burst];
        if (B && n > 0) B.explode(n, x, y);
        scene._vfxFlash?.(x, y, 36, K.color, 150, 0.55);
    }

    // A shot leaving: a flash at the muzzle and a spray of sparks the way it goes.
    static muzzle(scene, kind, x, y, angle = 0, big = false) {
        const K = BossFX.kinds()[kind] || BossFX.kinds().bolt;
        if (scene.textures?.exists('vfx_glow')) {
            const f = scene.add.image(x, y, 'vfx_glow').setBlendMode(Phaser.BlendModes.ADD).setTint(K.color)
                .setDepth(3.1).setScale(big ? 0.45 : 0.26);
            scene._vfxSort?.(f);
            scene.tweens.add({ targets: f, scale: big ? 0.75 : 0.4, alpha: 0, duration: big ? 240 : 150, ease: 'Quad.easeOut', onComplete: () => f.destroy() });
        }
        const B = K.burst && scene._vfxBursts?.[K.burst];
        if (B) B.explode(big ? 8 : 3, x + Math.cos(angle) * 6, y + Math.sin(angle) * 6);
        scene._vfxFlash?.(x, y, big ? 72 : 44, K.color, big ? 220 : 140, 0.7);
    }

    // A blast exactly as wide as its damage: a ring that opens to radius R, sparks and light.
    static blast(scene, x, y, R, kind) {
        const K = BossFX.kinds()[kind] || BossFX.kinds().bolt;
        if (scene.textures?.exists('vfx_ring')) {
            // vfx_ring's bright band sits at about 0.83 of its 32px radius
            const k = R / 26.5;
            const r = scene.add.image(x, y, 'vfx_ring').setBlendMode(Phaser.BlendModes.ADD).setTint(K.color)
                .setDepth(3.05).setScale(k * 0.3).setAlpha(1);
            const core = scene.add.image(x, y, 'vfx_glow').setBlendMode(Phaser.BlendModes.ADD).setTint(K.color)
                .setDepth(3.04).setScale(R / 64).setAlpha(0.9);
            scene._vfxSort?.(r); scene._vfxSort?.(core);
            scene.tweens.add({ targets: r, scale: k, duration: 160, ease: 'Cubic.easeOut' });
            scene.tweens.add({ targets: r, alpha: 0, delay: 120, duration: 260, onComplete: () => r.destroy() });
            scene.tweens.add({ targets: core, alpha: 0, scale: R / 50, duration: 300, ease: 'Quad.easeOut', onComplete: () => core.destroy() });
        }
        const B = K.burst && scene._vfxBursts?.[K.burst];
        if (B) B.explode(14, x, y);
        scene._vfxFlash?.(x, y, R * 1.6, K.color, 320, 1);
    }

    // ── TELEGRAPHS (any scene) ───────────────────────────────────────────────
    // Floor tiles where a player standing still would be caught: hit(px, py) is asked at the centre
    // of every floor tile within `reach` tiles of (cx, cy).
    static tilesWhere(scene, cx, cy, reach, hit) {
        const T = scene.TILE_SIZE || 24, W = scene.world, out = [];
        const tx0 = Math.floor(cx / T), ty0 = Math.floor(cy / T);
        for (let x = tx0 - reach; x <= tx0 + reach; x++) {
            for (let y = ty0 - reach; y <= ty0 + reach; y++) {
                if (W && W[x]?.[y] !== scene.FLOOR) continue;
                if (hit(x * T + T / 2, y * T + T / 2)) out.push([x, y]);
            }
        }
        return out;
    }
    // Within R of (cx, cy). `sprite`: the attack reads the player's sprite, which is drawn
    // SLIME_Y_OFFSET above its tile's centre, so in tile terms the area sits that much lower.
    static tilesInRadius(scene, cx, cy, R, sprite = false) {
        const off = sprite ? (scene.SLIME_Y_OFFSET || 0) : 0, T = scene.TILE_SIZE || 24;
        return BossFX.tilesWhere(scene, cx, cy - off, Math.ceil(R / T) + 1, (px, py) => Math.hypot(px - cx, py + off - cy) <= R);
    }
    static tilesManhattan(scene, tx, ty, r) {
        const T = scene.TILE_SIZE || 24;
        return BossFX.tilesWhere(scene, tx * T + T / 2, ty * T + T / 2, r, (px, py) =>
            Math.abs(Math.floor(px / T) - tx) + Math.abs(Math.floor(py / T) - ty) <= r);
    }

    // Danger tiles, drawn into g: a fill that comes up as the wind-up runs out (p 0..1), a charge
    // growing out of each tile's middle, corner ticks, and a bright rim round the whole area that
    // beats faster near the end. (ox, oy): where g itself sits, for a graphics that is not at 0,0.
    static drawTiles(g, T, tiles, color, p, now, ox = 0, oy = 0, o = {}) {
        if (!tiles?.length) return;
        const has = new Set();
        for (const [x, y] of tiles) has.add(x * 8192 + y);
        const IN = (x, y) => has.has(x * 8192 + y);
        const beat = 0.5 + 0.5 * Math.sin(now * (0.008 + 0.03 * p * p));
        const base = o.fill ?? 0.07;
        g.fillStyle(color, base + 0.16 * p + 0.1 * beat * p);
        for (const [x, y] of tiles) g.fillRect(x * T - ox, y * T - oy, T, T);
        // o.ticks false: a wide area (the collapse) reads as one glow with a rim, not a grid
        if (p < 1 && o.ticks !== false) {
            const s = Math.round((T - 4) * p);
            if (s > 1) {
                g.fillStyle(color, 0.12 + 0.16 * p);
                for (const [x, y] of tiles) g.fillRect(x * T - ox + (T - s) / 2, y * T - oy + (T - s) / 2, s, s);
            }
        }
        // a tick in each corner, so every tile reads as its own target
        const ta = 0.35 + 0.5 * p, L = 4;
        g.fillStyle(o.tick ?? color, ta);
        if (o.ticks !== false) for (const [x, y] of tiles) {
            const X = x * T - ox + 2, Y = y * T - oy + 2, E = T - 4;
            g.fillRect(X, Y, L, 1); g.fillRect(X, Y, 1, L);
            g.fillRect(X + E - L, Y, L, 1); g.fillRect(X + E - 1, Y, 1, L);
            g.fillRect(X, Y + E - 1, L, 1); g.fillRect(X, Y + E - L, 1, L);
            g.fillRect(X + E - L, Y + E - 1, L, 1); g.fillRect(X + E - 1, Y + E - L, 1, L);
        }
        // the rim round the whole area
        const rim = Math.min(1, 0.45 + 0.4 * p + 0.15 * beat);
        for (const [w, col, a] of [[3, color, rim * 0.45], [1, o.rim ?? 0xffffff, rim * (0.35 + 0.6 * p)]]) {
            g.fillStyle(col, a);
            for (const [x, y] of tiles) {
                const X = x * T - ox, Y = y * T - oy;
                if (!IN(x, y - 1)) g.fillRect(X, Y, T, w);
                if (!IN(x, y + 1)) g.fillRect(X, Y + T - w, T, w);
                if (!IN(x - 1, y)) g.fillRect(X, Y, w, T);
                if (!IN(x + 1, y)) g.fillRect(X + T - w, Y, w, T);
            }
        }
    }

    // A telegraph that lives on its own (tower defense has no per-frame hook for it): the tiles
    // fill over `ms`, hold until done() (the hit lands: they flash and fade) or kill().
    static mark(scene, tiles, color, ms, o = {}) {
        const g = scene.add.graphics().setDepth(o.depth ?? 0.45).setBlendMode(Phaser.BlendModes.ADD);
        scene._vfxSort?.(g);
        const T = scene.TILE_SIZE || 24;
        const m = { g, tiles: tiles || [], color, t0: scene.time.now, ms: Math.max(1, ms), live: true };
        (scene._liveMarks ||= new Set()).add(m);   // what's about to land, for anything that wants to read the floor
        const draw = () => {
            if (!m.live || !g.active) return;
            const now = scene.time.now;
            g.clear();
            BossFX.drawTiles(g, T, m.tiles, m.color, Math.min(1, (now - m.t0) / m.ms), now, 0, 0, o);
        };
        m.timer = scene.time.addEvent({ delay: 33, loop: true, callback: draw });
        draw();
        m.done = (fade = 280) => {
            if (!m.live) return;
            m.live = false; m.timer?.remove(); scene._liveMarks?.delete(m);
            if (!g.active) return;
            g.clear();
            g.fillStyle(m.color, 0.55);
            for (const [x, y] of m.tiles) g.fillRect(x * T, y * T, T, T);
            g.fillStyle(0xffffff, 0.35);
            for (const [x, y] of m.tiles) g.fillRect(x * T + 3, y * T + 3, T - 6, T - 6);
            scene.tweens.add({ targets: g, alpha: 0, duration: fade, ease: 'Quad.easeOut', onComplete: () => g.destroy() });
        };
        m.kill = () => { m.live = false; m.timer?.remove(); scene._liveMarks?.delete(m); if (g.active) g.destroy(); };
        return m;
    }

    // A jagged arc from (x0, y0) to (x1, y1): a soft glow, the bolt, a white-hot core.
    static arc(g, x0, y0, x1, y1, col, jag = 5, segs = 5, w = 2) {
        const dx = x1 - x0, dy = y1 - y0, len = Math.hypot(dx, dy) || 1, nx = -dy / len, ny = dx / len;
        const pts = [[x0, y0]];
        for (let i = 1; i < segs; i++) {
            const t = i / segs, j = (Math.random() - 0.5) * 2 * jag;
            pts.push([x0 + dx * t + nx * j, y0 + dy * t + ny * j]);
        }
        pts.push([x1, y1]);
        for (const [lw, c, a] of [[w * 2.6, col, 0.22], [w, col, 0.85], [1, 0xffffff, 0.95]]) {
            g.lineStyle(lw, c, a);
            g.beginPath(); g.moveTo(pts[0][0], pts[0][1]);
            for (let i = 1; i < pts.length; i++) g.lineTo(pts[i][0], pts[i][1]);
            g.strokePath();
        }
    }

    // How far a shot can fly from (x, y) along (dx, dy) before a wall stops it.
    static rayLen(scene, x, y, dx, dy, max) {
        const T = scene.TILE_SIZE || 24, W = scene.world;
        if (!W) return max;
        for (let d = 8; d < max; d += 6) {
            const v = W[Math.floor((x + dx * d) / T)]?.[Math.floor((y + dy * d) / T)];
            if (v === undefined || v === scene.WALL || v === scene.NOTHING) return d;
        }
        return max;
    }

    // A ranged enemy taking aim: dashes march toward you while it tracks, then the line goes solid
    // and bright once it locks (that is the line its shots fly), stopping where a wall stops them.
    static sight(scene, g, ex, ey, dx, dy, len, locked, e) {
        const now = scene.time.now;
        const L = BossFX.rayLen(scene, ex, ey, dx, dy, len);
        const col = e?._upgradedSniper ? 0xffc83a : 0xff4a2a;
        if (g.depth !== 0.97) g.setDepth(0.97);
        g.clear();
        if (locked) {
            const k = 0.8 + 0.2 * Math.sin(now * 0.06);
            g.lineStyle(4, col, 0.22 * k); g.lineBetween(ex, ey, ex + dx * L, ey + dy * L);
            g.lineStyle(1.5, col, 0.95 * k); g.lineBetween(ex, ey, ex + dx * L, ey + dy * L);
            g.lineStyle(1, 0xfff0e0, 0.6 * k); g.lineBetween(ex, ey, ex + dx * L, ey + dy * L);
            const hx = ex + dx * L, hy = ey + dy * L;
            g.fillStyle(0xfff0e0, 0.9 * k); g.fillRect(hx - 1, hy - 1, 3, 3);
            g.lineStyle(1, col, 0.8 * k); g.strokeCircle(hx, hy, 5 + 2 * Math.sin(now * 0.02));
        } else {
            const STEP = 14, DASH = 8, off = (now * 0.07) % STEP;
            g.lineStyle(1.5, col, 0.55);
            for (let d = off - STEP; d < L; d += STEP) {
                const a = Math.max(0, d), b = Math.min(L, d + DASH);
                if (b > a) g.lineBetween(ex + dx * a, ey + dy * a, ex + dx * b, ey + dy * b);
            }
        }
        g.fillStyle(col, locked ? 1 : 0.7); g.fillCircle(ex, ey, locked ? 3 : 2);
    }

    // ═══ GAME SCENE (mixin) ══════════════════════════════════════════════════

    _bfxCfg() {
        if (this._bfxCfgCache) return this._bfxCfgCache;
        return (this._bfxCfgCache = {
            VOLT: 0x5ff0ff, SPARK: 0xfff27a, VOID: 0xb45cff, VOID_HOT: 0xff7ae8, QUEEN: 0xff3a4a, CORE: 0xffa63a, VINE: 0x5aff8a,
            SHOT_LIGHTS: 14,      // at most this many shots carry a light at once (nearest you first)
            ARC_MS: 70,           // how often the Voltslime's arcs jump
            CORE_SPIN: 45,        // the Fracture Core's turn, degrees a second
        });
    }

    // From GameScene.create (after Creatures.js): the shared drawing layers and emitters.
    _bfxInit() {
        BossFX.sheet(this);
        this._bfxOn = true;
        this._bfxRifts = [];
        this._bfxSingList = this._bfxSingList || [];
        this._bfxRiftG = this.add.graphics().setDepth(0.93);      // rifts lie on the floor, under units
        this._bfxRootG = this.add.graphics().setDepth(1.004);     // roots wrap over your body
        this._bfxSingG = this.add.graphics().setDepth(0.45).setBlendMode(Phaser.BlendModes.ADD);
        for (const g of [this._bfxRiftG, this._bfxRootG, this._bfxSingG]) this._vfxSort?.(g);
        if (this.add.particles && this.textures.exists('vfx_dot')) {
            const mk = (tint, cfg = {}) => {
                const p = this.add.particles(0, 0, 'vfx_dot', Object.assign({
                    speed: { min: 0, max: 10 }, angle: { min: 0, max: 360 }, lifespan: { min: 150, max: 260 },
                    scale: { start: 0.7, end: 0 }, alpha: { start: 0.8, end: 0 }, tint, blendMode: 'ADD', emitting: false,
                }, cfg)).setDepth(3.2);
                this._vfxSort?.(p);
                return p;
            };
            this._bfxWake = {
                bolt: mk([0xff6a2a, 0xffb04a], { gravityY: -30 }),
                void: mk([0xb45cff, 0xff7ae8], { lifespan: { min: 220, max: 380 } }),
                dart: mk([0xffd84a, 0xfff3a8], { lifespan: { min: 110, max: 190 } }),
                vine: mk([0x5aff8a, 0xb6ff7a], { gravityY: 40, speed: { min: 5, max: 20 } }),
                volt: mk([0x5ff0ff, 0xffffff], { lifespan: { min: 90, max: 170 }, speed: { min: 10, max: 40 } }),
                zap:  mk([0xff5ad8, 0xffc8f4], { lifespan: { min: 120, max: 220 } }),
            };
            // motes that rise off things: the Voltslime's sparks, the void's dust, the core's embers
            this._bfxMotes = mk([0xffffff], { speedY: { min: -40, max: -12 }, speedX: { min: -14, max: 14 }, lifespan: { min: 400, max: 800 },
                                              scale: { start: 0.6, end: 0 }, alpha: { start: 0.9, end: 0 } });
            this._bfxMotes.setDepth(3.3);
        }
        this.events.once('shutdown', () => {
            this._bfxOn = false; this._bfxRifts = null; this._bfxWake = null; this._bfxMotes = null;
            this._bfxRiftG = this._bfxRootG = this._bfxSingG = null; this._bfxSingList = null; this._bfxCalls = null;
            this._bfxCollapse = null; this._bfxFrags = null;
        });
        // void snipers placed while the level was built opened the old drawn portal (this layer wasn't on yet): rifts now
        for (const e of this.enemies || []) {
            if (!e.isVoidSniper || !e._portalGfx?.active || !e.sprite) continue;
            if (e._portalSpinTween) { e._portalSpinTween.stop(); e._portalSpinTween = null; }
            const g = e._portalGfx; e._portalGfx = null;
            this._bfxSniperRift(e, g.x, g.y); g.destroy();
        }
    }

    // Every frame, from GameScene.update (after Creatures.js).
    _bfxUpdate(time, delta) {
        if (!this._bfxOn) return;
        const now = this.time.now, dt = Math.min(100, delta || 16);
        this._bfxBosses(now, dt);
        this._bfxFragTick(dt);
        this._bfxDrawRifts(now, dt);
        this._bfxRootFx(now);
        this._bfxSings(now);
        this._bfxCollapseTick(now);
    }

    // ── SHOTS IN PLAY ────────────────────────────────────────────────────────
    // An enemy shot the game just made as a drawing (EnemyManager, the maw) becomes its pixel-art
    // shot, pointing the way it flies: same place, same depth, same list entry. `muzzle`: a flash
    // where it leaves (once a volley, not once a pellet).
    _bfxSwap(g, kind, angle = 0, muzzle = false) {
        if (!this._bfxOn || !g?.active) return g;
        const img = BossFX.shot(this, kind, g.x, g.y, angle, g.depth || 2.6);
        if (muzzle) BossFX.muzzle(this, kind, g.x, g.y, angle);
        g.destroy();
        return img;
    }
    // The Voltslime's own shots (its update moves them; it drew them as circles every frame).
    _bfxVoltShot(kind, x, y) {
        if (!this._bfxOn) return null;
        const img = BossFX.shot(this, kind, x, y, Math.random() * Math.PI * 2, 3);
        if (kind === 'homing') img.setScale(1.2);
        return img;
    }

    // Dark-matter fragments: their reach rings follow them, and they turn as they orbit.
    _bfxFragTick(dt) {
        const list = this._bfxFrags;
        if (!list?.length) return;
        for (let i = list.length - 1; i >= 0; i--) {
            const f = list[i];
            if (!f.active) { list.splice(i, 1); continue; }
            f.rotation += dt * 0.0025;
            if (f._bfxRing?.active) f._bfxRing.setPosition(f.x, f.y);
        }
    }

    // ── WAKES AND LIGHT (from Visuals.js) ────────────────────────────────────
    // From _vfxTrails: every enemy shot leaves a wake in its own colour (a tendril from its tip).
    _bfxTrails() {
        const W = this._bfxWake;
        if (!W) return;
        const K = BossFX.kinds();
        for (const p of this.enemyProjectiles || []) {
            const q = p.gfx;
            if (!q?.active) continue;
            const k = K[BossFX.kindOf(p)];
            W[k.wake]?.emitParticleAt(q.x, q.y, 1);
        }
        // the Voltslime's volleys are dense: a share of them leave a wake each frame
        const vb = this.voltslimeBoss;
        if (vb?.active) {
            const share = Math.min(1, 14 / Math.max(1, vb.projectiles.length));
            for (const p of vb.projectiles) if (p.g?.active && Math.random() < share) (p.type === 'ricochet' ? W.zap : W.volt).emitParticleAt(p.g.x, p.g.y, 1);
            for (const p of vb.homingProjectiles) if (p.g?.active) W.void.emitParticleAt(p.g.x + (Math.random() - 0.5) * 8, p.g.y + (Math.random() - 0.5) * 8, 1);
        }
        for (const r of this._voidRipples || []) if (r.gfx?.active && Math.random() < 0.5) W.void.emitParticleAt(r.gfx.x, r.gfx.y, 1);
    }

    // From _vfxLights: the lights the attacks give off. Shots in their own colours (the nearest few),
    // rifts, mines.
    _bfxLights(time) {
        const out = [], K = BossFX.kinds(), C = this._bfxCfg();
        const shots = [];
        for (const p of this.enemyProjectiles || []) {
            const q = p.gfx;
            if (q?.active) shots.push([q.x, q.y, K[BossFX.kindOf(p)]]);
        }
        const vb = this.voltslimeBoss;
        if (vb?.active) {
            for (const p of vb.projectiles) if (p.g?.active) shots.push([p.g.x, p.g.y, p.type === 'ricochet' ? K.zap : K.volt]);
            for (const p of vb.homingProjectiles) if (p.g?.active) shots.push([p.g.x, p.g.y, K.homing]);
        }
        for (const r of this._voidRipples || []) if (r.gfx?.active) shots.push([r.gfx.x, r.gfx.y, K.ripple]);
        if (shots.length > C.SHOT_LIGHTS && this.player) {
            const px = this.player.x, py = this.player.y;
            shots.sort((a, b) => ((a[0] - px) ** 2 + (a[1] - py) ** 2) - ((b[0] - px) ** 2 + (b[1] - py) ** 2));
            shots.length = C.SHOT_LIGHTS;
        }
        for (const [x, y, k] of shots) out.push({ x, y, r: k.light, color: k.color, a: 0.6, g: 0.3 });
        for (const R of this._bfxRifts || []) {
            if (R.open > 0.05) out.push({ x: R.x, y: R.y, r: 26 + R.r * 1.3 * R.open, color: R.color, a: 0.7 * R.open, g: 0.34 * R.open });
        }
        const vs = this.voidSovereignBoss;
        if (vs?.active) {
            for (const m of vs._voidMines || []) if (m.gfx?.active) out.push({ x: m.gfx.x, y: m.gfx.y, r: 34 + 26 * (m._bfxP || 0), color: C.VOID, a: 0.5, g: 0.22 });
        }
        return out;
    }

    // A boss saying what it is about to do: bold, in the attack's colour, over the boss, and gone in
    // a second and a half. (The 11px status line they used was easy to miss, and some were near-black.)
    _bfxCallout(x, y, text, color = '#e0b8ff') {
        const list = this._bfxCalls || (this._bfxCalls = []);
        for (let i = list.length - 1; i >= 0; i--) if (!list[i].active) list.splice(i, 1);
        let y0 = y;
        for (let k = 0; k < 4; k++) {
            const hit = list.find(t => Math.abs(t.x - x) < 140 && Math.abs(t._y0 - y0) < 15);
            if (!hit) break;
            y0 = hit._y0 - 16;
        }
        let col = typeof color === 'number' ? '#' + color.toString(16).padStart(6, '0') : color;
        // a near-black colour (the collapse and the horizon were called in #220044, #110022)
        // can't be read on the dark floor: those get the void's own light lilac
        const rgb = /^#[0-9a-f]{6}$/i.test(col) ? [1, 3, 5].map(i => parseInt(col.slice(i, i + 2), 16)) : null;
        if (rgb && 0.3 * rgb[0] + 0.59 * rgb[1] + 0.11 * rgb[2] < 90) col = '#e0b8ff';
        const t = this.add.text(x, y0, text, {
            fontSize: '13px', fontFamily: 'monospace', fontStyle: 'bold', color: col, stroke: '#05060a', strokeThickness: 4,
            padding: { x: 8, y: 8 },
        }).setOrigin(0.5).setDepth(10.5).setScale(1.4).setAlpha(0);
        t.setShadow(0, 0, col, 8, true, true);
        t._y0 = y0;
        this._vfxSort?.(t);
        list.push(t);
        this.tweens.add({ targets: t, alpha: 1, scale: 1, duration: 170, ease: 'Back.easeOut' });
        this.tweens.add({ targets: t, y: y0 - 14, alpha: 0, delay: 1250, duration: 420, ease: 'Quad.easeIn', onComplete: () => t.destroy() });
        return t;
    }

    // ── BOSSES, EVERY FRAME ──────────────────────────────────────────────────
    // Each boss is dressed the first frame it is seen, then kept moving.
    _bfxBosses(now, dt) {
        const vb = this.voltslimeBoss;
        if (vb?.container?.active) {
            if (!vb._bfx) this._bfxVoltDress(vb);
            this._bfxVoltTick(vb, now, dt);
        }
        const vs = this.voidSovereignBoss;
        if (vs?.container?.active) {
            if (!vs._bfx) this._bfxVoidDress(vs);
            this._bfxVoidTick(vs, now, dt);
        }
        const fc = this.fractureCore;
        if (fc?.container?.active) this._bfxCoreTick(fc, now, dt);
        for (const q of this.portals || []) {
            if (!q.active || !q.container?.active) continue;
            if (!q._bfx) this._bfxQueenDress(q);
            this._bfxQueenTick(q, now);
        }
        for (const b of [vb, vs, ...(this.portals || [])]) if (b?.active && b.container?.active && !b._barHidden) this._bfxHideBars(b);
        this._bfxBossBar();
    }

    // The HUD's boss bar (HUD.js) for the boss you are fighting: the nearest one within reach.
    _bfxBossBar() {
        // a boss is yours to see when it's in the room you're in (on a level of rooms; a wall between you is not near),
        // or within 16 tiles where there are no rooms (the Tower's arena)
        const T = this.TILE_SIZE, ri = this.getCurrentPlayerRoom?.() ?? -1, R = this._roomGated?.() && ri >= 0 ? this.rooms?.[ri] : null;
        const far = (x, y) => { const tx = Math.floor(x / T), ty = Math.floor(y / T); return R ? !(tx >= R.x && tx < R.x + R.w && ty >= R.y && ty < R.y + R.h) : this._roomGated?.() || Math.hypot(x / T - this.playerX, y / T - this.playerY) > 16; };   // (in a corridor of a level of rooms: none)
        const vb = this.voltslimeBoss, vs = this.voidSovereignBoss, fc = this.fractureCore;
        const bars = [];   // every boss in reach gets its own bar, stacked: [key, frac, name, colour, line]
        if (fc?.active && fc.geode) bars.push(['core', fc.health / fc.maxHealth, 'THE GEODE', 0xffa63a, fc.state === 'vuln' ? 'its heart is exposed: hit it' : fc.state === 'armored' ? `${fc.plates.filter(p => !p.broken).length} plates  ·  fire, then ice, shatters one` : '', fc.container?.x ?? (fc.tileX + 0.5) * T, fc.container?.y ?? (fc.tileY + 0.5) * T]);
        else if (fc?.active) bars.push(['core', fc.health / fc.maxHealth, 'THE FRACTURE CORE', 0xffa63a, fc.state === 'vuln' ? 'exposed: hit it' : fc.state === 'rhythm' ? 'keep the rhythm' : `the floor is breaking  ·  ${this._fissures?.length || 0} cracks`, fc.container?.x ?? (fc.tileX + 0.5) * T, fc.container?.y ?? (fc.tileY + 0.5) * T]);
        // its ice on its bar: the chill building (full while it's cubed) and the health its cube's decay took (LevelManager._bossIceWatch)
        const K = this._chillCfg?.(), ice = b => K ? { chill: b._iceCubeUntil ? 1 : Math.min(1, (b.chillStacks || 0) / K.MAX), cubed: !!b._iceCubeUntil, decay: (b._decayOwed || 0) / b.maxHp } : null;
        if (vb?.active && vb.container && !far(vb.container.x, vb.container.y)) bars.push(['volt', vb.hp / vb.maxHp, 'THE VOLTSLIME', 0x5ff0ff, '', vb.container.x, vb.container.y, ice(vb)]);
        if (vs?.active && vs.container && !far(vs.container.x, vs.container.y)) bars.push(['sovereign', vs.hp / vs.maxHp, 'THE VOID SOVEREIGN', 0xb45cff, '', vs.container.x, vs.container.y, ice(vs)]);
        const qs = (this.portals || []).filter(q => q.active && q.container && !far(q.container.x, q.container.y))
            .sort((a, b) => Math.hypot(a.tileX - this.playerX, a.tileY - this.playerY) - Math.hypot(b.tileX - this.playerX, b.tileY - this.playerY));
        for (const q of qs) bars.push(q.tide ? ['tide', q.hp / q.maxHp, 'THE TIDE MOTHER', TideMother.CFG.COL, q.tide.line, q.container.x, q.container.y]   // the Cistern's (TideMother.js)
                                             : ['queen' + this.portals.indexOf(q), q.hp / q.maxHp, 'THE QUEEN SLIME', 0xff3a4a, `brood ${q.ammo ?? 0} / ${q.ammoMax ?? 0}`, q.container.x, q.container.y]);
        const meet = !this.trainingRun && !this._bossIntroOn && !(R === null && this._roomGated?.()) && bars.find(b => !this._bossIntroSeen?.[b[0].replace(/\d+$/, '')]);   // one not met yet: its intro first (once you're in a room, not seen down a corridor)
        if (meet && this._bossIntro?.(meet[0], meet[2], meet[3], meet[5], meet[6])) return;
        bars.slice(0, 4).forEach(([key, frac, name, col, line, , , ice], i) => this._bossBar(frac, name, col, line, key, i, ice));
        this._bossBarsKeep(bars.slice(0, 4).map(b => b[0]));
    }

    // Its old health bar, name and pips over its head stop drawing (the boss bar has them now).
    _bfxHideBars(b) {
        b._barHidden = true;
        const y = b.hpBar?.y;
        for (const o of b.container.list) if (o === b.hpBar || o.type === 'Text' || (o.type === 'Rectangle' && y !== undefined && Math.abs(o.y - y) < 1)) o.setVisible(false);
        for (const sg of b.ammoSegs || []) { sg.bg?.setVisible(false); sg.fill?.setAlpha(0); }
    }

    // Text inside a container is not seen by Visuals.js, which renders world text at twice the
    // density: done here for a boss's name and labels.
    _bfxCrisp(cont) {
        for (const o of cont?.list || []) {
            if (o.type === 'Text' && o.style && o.style.resolution !== 2) {
                o.setResolution(2);
                o.texture?.setFilter?.(Phaser.Textures.FilterMode.LINEAR);
            }
        }
    }

    // A boss's own ice: the creatures' pixel block (Creatures.js), scaled over its body, in place of
    // the square freeze drawing (which still exists and is cleaned up by the game; it only stops
    // drawing). It follows the bob; when the freeze ends it breaks.
    _bfxBossIce(b, k, dy) {
        const F = b._bfx;
        const frozen = b.active && b._isFrozen;
        if (frozen && !F.ice && this.textures.exists('cfx_ice')) {
            F.ice = this.add.image(b.container.x, b.container.y + dy, 'cfx_ice', 'ice').setOrigin(0.5, 1)
                .setScale(k).setDepth(3.4).setAlpha(0.92);
            this._vfxSort?.(F.ice);
            const fv = b._bossProxy?.freezeVisuals;
            if (fv && typeof CreatureFX !== 'undefined') {
                CreatureFX.mute(fv.iceBlock); CreatureFX.mute(fv.iceBorder); CreatureFX.mute(fv.multiplierText);
                for (const l of fv._extraLayers || []) CreatureFX.mute(l);
            }
            F.ice.setScale(k * 1.15, k * 0.85);
            this.tweens.add({ targets: F.ice, scaleX: k, scaleY: k, duration: 160, ease: 'Back.easeOut' });
        } else if (F.ice && !frozen) {
            const ice = F.ice, x = ice.x, y = ice.y - ice.displayHeight / 2;
            F.ice = null;
            this.tweens.killTweensOf(ice);
            ice.destroy();
            this._vfxBursts?.ice?.explode(26, x, y);
            this._vfxFlash?.(x, y, 120, 0x9fe6ff, 300, 0.8);
            if (this.textures.exists('vfx_ring')) {
                const r = this.add.image(x, y, 'vfx_ring').setTint(0xbff0ff).setBlendMode(Phaser.BlendModes.ADD).setDepth(3.5).setScale(0.6);
                this._vfxSort?.(r);
                this.tweens.add({ targets: r, scale: 2.4, alpha: 0, duration: 380, ease: 'Cubic.easeOut', onComplete: () => r.destroy() });
            }
        }
        if (F.ice?.active) F.ice.setPosition(b.container.x, b.container.y + dy);
    }

    // A white flash on a boss's body when a hit lands (not more than every 90ms; not in its ice).
    _bfxHitFlash(b) {
        const s = b?.body;
        if (!s?.active || b._isFrozen) return;
        const now = this.time.now;
        if (now - (b._bfxFlashAt || -1e9) < 90) return;
        b._bfxFlashAt = now;
        s.setTintFill(0xffffff);
        this.time.delayedCall(60, () => { if (s.active && s.tintFill) s.clearTint(); });
    }

    // ── VOLTSLIME ────────────────────────────────────────────────────────────
    // A slime of electric blue with arcs crawling over it. Its body is anchored at its base, so the
    // slam's squash presses it into the floor instead of lifting it off.
    _bfxVoltDress(b) {
        b._bfx = {};
        const s = b.body, c = b.container;
        const key = BossFX.body(this, 'volt');
        if (key && s?.active) {
            s.setTexture(key, 0).clearTint();
            if (this.anims.exists('volt_idle')) s.play('volt_idle');
            const k = Math.abs(s.scaleY || 4.5);
            s.setY(s.y + (1 - s.originY) * 32 * k).setOrigin(0.5, 1);
        }
        // the bob, kept so the slam can plant it
        b._bfx.bob = this.tweens.getTweensOf(c).find(t => t.loop !== 0 || t.repeat !== 0) || this.tweens.getTweensOf(c)[0] || null;
        // a cold glow on the floor under it
        const glow = this.make.image({ x: 0, y: 2, key: 'vfx_glow' }, false).setBlendMode(Phaser.BlendModes.ADD)
            .setTint(0x3fd4ff).setAlpha(0.32).setScale(1.25, 0.5);
        c.addAt(glow, 0);
        b._bfx.glow = glow;
        if (b.aura?.active) b.aura.setBlendMode(Phaser.BlendModes.ADD).setDepth(3.5);
        this._bfxCrisp(c);
    }

    // A Z drifting up off something asleep, swaying, growing and fading
    _bfxZzz(x, y, size) {
        const z = this.add.text(x, y, Math.random() < 0.5 ? 'Z' : 'z', { fontSize: size + 'px', fontFamily: UIKit.FONT.title, fontStyle: 'bold', color: '#d8e8ff', stroke: '#1a2030', strokeThickness: 3, resolution: 2 })
            .setOrigin(0.5).setDepth(5).setAlpha(0).setScale(0.6);
        this.tweens.add({ targets: z, y: y - 34, x: x + 14, scale: 1.2, duration: 1600, ease: 'Sine.easeOut' });
        const all = this._zzzAll ||= new Set(); all.add(z);
        this.tweens.add({ targets: z, alpha: { from: 0.95, to: 0 }, duration: 1600, ease: 'Quad.easeIn', onComplete: () => { all.delete(z); z.destroy(); } });
        return z;
    }
    _bfxVoltTick(b, now, dt) {
        const F = b._bfx, c = b.container, s = b.body, C = this._bfxCfg();
        this._bfxBossIce(b, 3.4, 9);
        if (b._asleep) {   // dozing: dim, no arcs, eyes shut, its brood too, Zs drifting up
            F.glow?.setAlpha(0.07); b.aura?.clear?.();
            if (s?._cfx) s._cfx.expr = 'blink';
            if (now - (F.zAt || 0) > 650) { F.zAt = now; this._bfxZzz(c.x + 16, c.y - 70, 22); }
            for (const e of b._sleepers || []) {
                if (!e.sprite?.active) continue;
                if (e.sprite._cfx) e.sprite._cfx.expr = 'blink';
                if (Math.random() < dt / 1400) this._bfxZzz(e.sprite.x + 6, e.sprite.y - 8, 11);
            }
            return;
        }
        if (F.glow?.active) F.glow.setAlpha(0.26 + 0.1 * Math.sin(now * 0.011) + (F.slam && now < F.slam.end ? 0.25 : 0));
        if (!b.active || !s?.active) { b.aura?.clear?.(); return; }
        // sparks lifting off it now and then
        if (this._bfxMotes && Math.random() < dt / 90) {
            this._bfxMotes.setParticleTint?.(Math.random() < 0.5 ? 0x9ff6ff : 0xfff27a);
            this._bfxMotes.emitParticleAt(c.x + (Math.random() - 0.5) * 60, c.y - 10 - Math.random() * 24, 1);
        }
        const g = b.aura;
        if (!g?.active || now < (F.arcAt || 0)) return;
        const slam = F.slam && now < F.slam.end;
        F.arcAt = now + C.ARC_MS * (slam ? 0.6 : 1) + Math.random() * 40;
        g.clear();
        // the dome of its body: centre, half width, half height (it squashes for the slam)
        const kx = Math.abs(s.scaleX) / 4.5, ky = Math.abs(s.scaleY) / 4.5;
        const ex = c.x, ey = c.y + 7 - 22 * ky, rx = 36 * kx, ry = 22 * ky;
        const on = a => [ex + Math.cos(a) * rx, ey + Math.sin(a) * ry * (Math.sin(a) < 0 ? 1 : 0.55)];
        const n = slam ? 4 : 2;
        for (let i = 0; i < n; i++) {
            const a0 = -Math.PI * Math.random(), a1 = a0 + (0.6 + Math.random() * 0.9) * (Math.random() < 0.5 ? -1 : 1);
            const [x0, y0] = on(a0), [x1, y1] = on(a1);
            BossFX.arc(g, x0, y0, x1, y1, Math.random() < 0.3 ? C.SPARK : C.VOLT, 5, 5, 1.6);
        }
        // and now and then one grounds itself on the floor beside it
        if (Math.random() < (slam ? 0.8 : 0.22)) {
            const side = Math.random() < 0.5 ? -1 : 1, d = 40 + Math.random() * 24;
            const [x0, y0] = on(-Math.PI / 2 + side * (0.9 + Math.random() * 0.6));
            const x1 = c.x + side * d, y1 = c.y + 4 + (Math.random() - 0.3) * 18;
            BossFX.arc(g, x0, y0, x1, y1, C.SPARK, 7, 6, 1.4);
            this._vfxFlash?.(x1, y1, 34, C.SPARK, 120, 0.6);
        }
        // in the slam's wind-up, arcs run out to the tiles it will hit
        if (slam && F.slam.tiles?.length) {
            const T = this.TILE_SIZE;
            for (let i = 0; i < 2; i++) {
                const [tx, ty] = F.slam.tiles[Math.floor(Math.random() * F.slam.tiles.length)];
                BossFX.arc(g, ex + (Math.random() - 0.5) * 20, ey + 6, tx * T + T / 2, ty * T + T / 2, C.SPARK, 6, 6, 1.4);
            }
        }
    }

    // The slam: it plants itself on its own tile (the bob stops; it settles onto the floor) and the
    // diamond it will hit (Manhattan 2 from that tile, the hit test's own area) lights up.
    _bfxSlamWarn(b, ms) {
        if (!b?._bfx) return null;
        const T = this.TILE_SIZE, c = b.container, F = b._bfx;
        F.unplant?.remove?.();
        if (F.bob) { F.bob.stop?.(); F.bob = null; }
        this.tweens.add({ targets: c, y: b._baseY, duration: Math.min(260, ms * 0.4), ease: 'Quad.easeIn' });
        const tx = Math.floor(c.x / T), ty = Math.floor(b._baseY / T);
        const tiles = BossFX.tilesManhattan(this, tx, ty, 2);
        const m = BossFX.mark(this, tiles, this._bfxCfg().SPARK, ms);
        F.slam = { tiles, end: this.time.now + ms, m };
        return m;
    }

    _bfxSlamHit(b, m) {
        const F = b?._bfx;
        m?.done?.(320);
        if (!F) return;
        const c = b.container, T = this.TILE_SIZE, C = this._bfxCfg();
        // lightning into every tile it reached, a ring to the edge of the diamond, light
        const g = this.add.graphics().setDepth(3.5).setBlendMode(Phaser.BlendModes.ADD);
        this._vfxSort?.(g);
        for (const [tx, ty] of F.slam?.tiles || []) {
            if (Math.random() < 0.55) BossFX.arc(g, c.x + (Math.random() - 0.5) * 30, c.y - 6, tx * T + T / 2, ty * T + T / 2, C.SPARK, 6, 5, 1.5);
        }
        this.tweens.add({ targets: g, alpha: 0, duration: 260, onComplete: () => g.destroy() });
        BossFX.blast(this, c.x, c.y + 10, 2.5 * T, 'volt');
        this._vfxBursts?.lightning?.explode(18, c.x, c.y);
        F.slam = null;
        // back to its bob once the dust settles
        F.unplant = this.time.delayedCall(600, () => {
            if (!b.active || !c.active) return;
            F.bob = this.tweens.add({ targets: c, y: b._baseY - 8, duration: 800, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
        });
    }

    // A minion of the spawner phase: its pulse jumps to the four tiles next to it (the tiles its
    // zap reaches, Manhattan 1) instead of three random scribbles.
    _bfxVoltZap(e, g) {
        if (!g?.active || !e?.sprite?.active) return;
        const T = this.TILE_SIZE, C = this._bfxCfg(), x = e.sprite.x, y = e.sprite.y + 6;
        if (g.blendMode !== Phaser.BlendModes.ADD) g.setBlendMode(Phaser.BlendModes.ADD);
        g.clear();
        for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
            const tx = (e.x + dx) * T + T / 2, ty = (e.y + dy) * T + T / 2;
            if (this.world?.[e.x + dx]?.[e.y + dy] !== this.FLOOR) continue;
            BossFX.arc(g, x, y, tx, ty, C.VOLT, 4, 4, 1.3);
            g.fillStyle(C.VOLT, 0.25); g.fillRect(tx - T / 2 + 2, ty - T / 2 + 2, T - 4, T - 4);
        }
        this.tweens.killTweensOf(g);
        g.setAlpha(1);
        this.tweens.add({ targets: g, alpha: 0, duration: 380, ease: 'Quad.easeIn' });
    }

    // Its death: a discharge in every direction, a splash of its blue, the crown thrown up.
    _bfxVoltDeath(b) {
        const c = b.container, x = c.x, y = c.y - 14, C = this._bfxCfg();
        this._vfxFlash?.(x, y, 280, 0x9ff6ff, 700, 1);
        const g = this.add.graphics().setDepth(5).setBlendMode(Phaser.BlendModes.ADD);
        this._vfxSort?.(g);
        for (let i = 0; i < 12; i++) {
            const a = i / 12 * Math.PI * 2 + Math.random() * 0.3, d = 60 + Math.random() * 50;
            BossFX.arc(g, x, y, x + Math.cos(a) * d, y + Math.sin(a) * d * 0.7, i % 3 ? C.VOLT : C.SPARK, 9, 7, 2);
        }
        this.tweens.add({ targets: g, alpha: 0, duration: 420, ease: 'Quad.easeIn', onComplete: () => g.destroy() });
        BossFX.blast(this, x, y + 10, 90, 'volt');
        const goo = this._vfxBursts?.goo;
        if (goo) { goo.setParticleTint?.(0x3fd4ff); goo.explode(34, x, y); }
        this._vfxBursts?.lightning?.explode(30, x, y);
        if (this.textures.exists('vfx_splat')) {
            const sp = this.add.image(x, c.y + 8, 'vfx_splat').setTint(0x3fd4ff).setAlpha(0.6).setDepth(0.2).setScale(2.2);
            this._vfxSort?.(sp);
            this.tweens.add({ targets: sp, alpha: 0, delay: 2500, duration: 3000, onComplete: () => sp.destroy() });
        }
        if (this.textures.exists('cfx_face')) {
            const cr = this.add.image(x, c.y + 7, 'cfx_face', 'h_volt_0').setOrigin(0.5, 1).setScale(4.5).setDepth(5.1);
            this._vfxSort?.(cr);
            this.tweens.add({ targets: cr, y: c.y - 60, angle: 200, duration: 520, ease: 'Quad.easeOut' });
            this.tweens.add({ targets: cr, alpha: 0, delay: 380, duration: 300, onComplete: () => cr.destroy() });
        }
    }

    // ── VOID SOVEREIGN ───────────────────────────────────────────────────────
    // A slime of night sky (stars that twinkle as it breathes) with a ring of light round it, shards
    // riding the ring, and a crown floating over its head. The ring's back half goes behind it.
    _bfxVoidDress(b) {
        b._bfx = {};
        const s = b.body, c = b.container;
        // the drawn ring, crown, orbiting dots and the debug hitbox square all stop drawing: the
        // ring and crown below replace them (they are only ever Graphics in its container)
        if (typeof CreatureFX !== 'undefined') for (const o of c.list) if (o.type === 'Graphics') CreatureFX.mute(o);
        const key = BossFX.body(this, 'void');
        if (key && s?.active) {
            s.setTexture(key, 0).clearTint();
            if (this.anims.exists('void_idle')) s.play('void_idle');
        }
        const back = this.make.graphics({}, false), front = this.make.graphics({}, false);
        c.addAt(back, Math.max(0, c.getIndex(s)));
        c.add(front);
        const halo = this.make.image({ x: 0, y: -58, key: 'vfx_glow' }, false).setBlendMode(Phaser.BlendModes.ADD)
            .setTint(0xff4ad8).setAlpha(0.45).setScale(0.55, 0.32);
        const crown = this.make.image({ x: 0, y: -58, key: 'bfx_shots', frame: 'vcrown' }, false).setScale(3);
        const under = this.make.image({ x: 0, y: 4, key: 'vfx_glow' }, false).setBlendMode(Phaser.BlendModes.ADD)
            .setTint(0x8a3aff).setAlpha(0.35).setScale(1.4, 0.5);
        c.addAt(under, 0);
        c.add([halo, crown]);
        b._bfx = { back, front, crown, halo, under, frozenAt: 0 };
        this._bfxCrisp(c);
    }

    _bfxVoidTick(b, now, dt) {
        const F = b._bfx, c = b.container;
        this._bfxBossIce(b, 3.8, 12);
        if (!c.visible) return;
        // frozen, the ring stops turning
        if (b._isFrozen) F.frozenAt = F.frozenAt || now; else F.frozenAt = 0;
        const t = F.frozenAt || now;
        const { back, front } = F;
        back.clear(); front.clear();
        const cy = -15, RX = 64, RY = 14, N = 80;
        for (let i = 0; i < N; i++) {
            const a = i / N * Math.PI * 2, sn = Math.sin(a);
            const run = 0.5 + 0.5 * Math.sin(a * 3 - t * 0.0032);
            const g = sn < 0 ? back : front;
            g.fillStyle(run > 0.86 ? 0xffd0ff : run > 0.5 ? 0xb46cff : 0x6a2ad0, (sn < 0 ? 0.45 : 0.85) * (0.35 + 0.65 * run));
            g.fillRect(Math.round(Math.cos(a) * RX) - 1, Math.round(cy + sn * RY), 2, run > 0.86 ? 2 : 1);
        }
        for (let i = 0; i < 8; i++) {
            const a = i / 8 * Math.PI * 2 + t * 0.0009, sn = Math.sin(a), lane = i % 3;
            const x = Math.round(Math.cos(a) * (RX + 6 + lane * 4)), y = Math.round(cy + sn * (RY + 2 + lane));
            const g = sn < 0 ? back : front, lit = sn < 0 ? 0.5 : 1;
            g.fillStyle(0x12061f, 0.95 * lit); g.fillRect(x - 2, y - 3, 4, 7);
            g.fillStyle(i % 2 ? 0xb46cff : 0xff7ae8, lit); g.fillRect(x - 1, y - 2, 2, 5);
            g.fillStyle(0xffffff, lit); g.fillRect(x - 1, y - 2, 1, 1);
        }
        const bob = Math.sin(t * 0.0024) * 2.5;
        F.crown.y = -58 + bob; F.halo.y = -56 + bob;
        F.halo.setAlpha(0.35 + 0.15 * Math.sin(t * 0.004));
        if (b.active && this._bfxMotes && Math.random() < dt / 160) {
            this._bfxMotes.setParticleTint?.(Math.random() < 0.6 ? 0xc99cff : 0xffffff);
            this._bfxMotes.emitParticleAt(c.x + (Math.random() - 0.5) * 70, c.y - Math.random() * 30, 1);
        }
    }

    // A void mine: the tiles it will catch (the blast reads your sprite, SLIME_Y_OFFSET over your
    // tile, so they are worked out the same way) filling in as it counts down, a heart that beats
    // faster, and a ring closing round it like a clock. Drawn into the mine's own graphics.
    _bfxDrawMine(m, p, now) {
        const g = m.gfx, T = this.TILE_SIZE, R = m.radius * T;
        if (!m._bfxTiles) m._bfxTiles = BossFX.tilesInRadius(this, g.x, g.y, R, true);
        m._bfxP = p;
        if (g.blendMode !== Phaser.BlendModes.ADD) g.setBlendMode(Phaser.BlendModes.ADD).setDepth(0.45);
        g.clear();
        BossFX.drawTiles(g, T, m._bfxTiles, 0xb45cff, p, now, g.x, g.y, { fill: 0.05 });
        const beat = Math.max(0, Math.sin(now * (0.012 + 0.03 * p)));
        g.fillStyle(0x6a2ad0, 0.5); g.fillCircle(0, 0, 9);
        g.fillStyle(0xff7ae8, 0.55 + 0.45 * beat); g.fillCircle(0, 0, 3 + 2.5 * beat);
        g.fillStyle(0xffffff, 0.8 * beat); g.fillCircle(0, 0, 1.5);
        g.lineStyle(2, 0xffb8ff, 0.9);
        g.beginPath(); g.arc(0, 0, 12, -Math.PI / 2, -Math.PI / 2 + p * Math.PI * 2, false); g.strokePath();
    }

    // It goes off: the tiles flash, a ring opens exactly to its reach, void sparks.
    _bfxMineBlast(m) {
        const g = m.gfx, T = this.TILE_SIZE, R = m.radius * T, off = this.SLIME_Y_OFFSET || 0;
        const fl = this.add.graphics().setDepth(0.46).setBlendMode(Phaser.BlendModes.ADD);
        this._vfxSort?.(fl);
        fl.fillStyle(0xd27aff, 0.6);
        for (const [x, y] of m._bfxTiles || []) fl.fillRect(x * T, y * T, T, T);
        fl.fillStyle(0xffffff, 0.3);
        for (const [x, y] of m._bfxTiles || []) fl.fillRect(x * T + 4, y * T + 4, T - 8, T - 8);
        this.tweens.add({ targets: fl, alpha: 0, duration: 340, ease: 'Quad.easeOut', onComplete: () => fl.destroy() });
        BossFX.blast(this, g.x, g.y - off, R, 'ripple');
    }

    // The laser grid's beams. While it warns: thin dashes. Live: a soft band as wide as the hit test
    // (half-width `half` either side), the beam, and a white-hot core.
    _bfxBeams(g, segs, col, alpha, half) {
        g.clear();
        if (g.blendMode !== Phaser.BlendModes.ADD) g.setBlendMode(Phaser.BlendModes.ADD);
        const line = ([x1, y1, x2, y2]) => g.lineBetween(x1, y1, x2, y2);
        if (alpha < 0.6) {
            g.lineStyle(1, col, Math.min(1, alpha * 1.6));
            for (const [x1, y1, x2, y2] of segs) {
                const len = Math.hypot(x2 - x1, y2 - y1), ux = (x2 - x1) / (len || 1), uy = (y2 - y1) / (len || 1);
                for (let d = 0; d < len; d += 12) g.lineBetween(x1 + ux * d, y1 + uy * d, x1 + ux * Math.min(len, d + 7), y1 + uy * Math.min(len, d + 7));
            }
            return;
        }
        g.lineStyle(half * 2, col, 0.2 * alpha); segs.forEach(line);
        g.lineStyle(3, col, 0.8 * alpha); segs.forEach(line);
        g.lineStyle(1, 0xffffff, 0.9 * alpha); segs.forEach(line);
    }

    // A dark-matter fragment: a crystal of void that turns as it orbits. Its touch reaches 1.2 tiles,
    // shown as a faint ring of dark round it.
    _bfxFragment() {
        BossFX.sheet(this);
        const img = this.add.image(0, 0, 'bfx_shots', 'frag').setDepth(3.5).setScale(1.6);
        this._vfxSort?.(img);
        const T = this.TILE_SIZE;
        const ring = this.add.graphics().setDepth(0.46).setBlendMode(Phaser.BlendModes.ADD);
        this._vfxSort?.(ring);
        ring.lineStyle(2, 0xb45cff, 0.5); ring.strokeCircle(0, 0, T * 1.2);
        ring.fillStyle(0x6a2ad0, 0.12); ring.fillCircle(0, 0, T * 1.2);
        img._bfxRing = ring;
        img.on('destroy', () => { if (ring.active) ring.destroy(); });
        (this._bfxFrags || (this._bfxFrags = [])).push(img);
        return img;
    }

    // Something breaking into shards of its colour: the shards fly, sparks, a flash and a ring.
    _bfxShatter(x, y, color = 0xb45cff, n = 10) {
        BossFX.sheet(this);
        for (let i = 0; i < n; i++) {
            const a = i / n * Math.PI * 2 + Math.random() * 0.4, d = 26 + Math.random() * 26;
            const s = this.add.image(x, y, 'bfx_shots', 'shard').setDepth(4.6).setRotation(a).setScale(1.2).setTint(color);
            this._vfxSort?.(s);
            this.tweens.add({ targets: s, x: x + Math.cos(a) * d, y: y + Math.sin(a) * d, alpha: 0, scale: 0.4,
                              duration: 380 + Math.random() * 160, ease: 'Quad.easeOut', onComplete: () => s.destroy() });
        }
        this._vfxBursts?.cosmic?.explode(16, x, y);
        this._vfxFlash?.(x, y, 90, color, 300, 0.9);
        if (this.textures.exists('vfx_ring')) {
            const r = this.add.image(x, y, 'vfx_ring').setTint(color).setBlendMode(Phaser.BlendModes.ADD).setDepth(4.5).setScale(0.3);
            this._vfxSort?.(r);
            this.tweens.add({ targets: r, scale: 1.5, alpha: 0, duration: 320, ease: 'Cubic.easeOut', onComplete: () => r.destroy() });
        }
    }

    // The stomp's target, redrawn as it follows you: the tiles it will crush (radius 2.5 tiles read
    // against your sprite, as the hit test does), a reticle, and its shadow growing as it falls.
    _bfxStompTrack(g, x, y, p) {
        const T = this.TILE_SIZE, now = this.time.now, off = this.SLIME_Y_OFFSET || 0;
        if (g.depth !== 0.45) g.setDepth(0.45);
        const tiles = BossFX.tilesInRadius(this, x, y, 2.5 * T, true);
        g._bfxTiles = tiles;
        BossFX.drawTiles(g, T, tiles, 0xff4a2a, Math.min(1, p), now, 0, 0, { fill: 0.06 });
        const cy = y - off;
        const sh = 0.25 + 0.75 * Math.min(1, p);
        g.fillStyle(0x000000, 0.18 + 0.3 * p); g.fillEllipse(x, cy + 2, 70 * sh, 22 * sh);
        const r = 2.5 * T, k = 0.75 + 0.25 * Math.sin(now * 0.015);
        g.lineStyle(2, 0xff6a3a, 0.7 * k);
        for (let i = 0; i < 4; i++) {
            const a = i * Math.PI / 2 + now * 0.002;
            g.beginPath(); g.arc(x, cy, r, a - 0.35, a + 0.35, false); g.strokePath();
        }
    }

    // It lands: the tiles flash, a ring opens to exactly its reach, dust, cracks in the floor.
    _bfxStompLand(x, y, R, tiles) {
        const T = this.TILE_SIZE, off = this.SLIME_Y_OFFSET || 0, cy = y - off;
        const t = tiles || BossFX.tilesInRadius(this, x, y, R, true);
        const fl = this.add.graphics().setDepth(0.46).setBlendMode(Phaser.BlendModes.ADD);
        this._vfxSort?.(fl);
        fl.fillStyle(0xff5a2a, 0.55);
        for (const [tx, ty] of t) fl.fillRect(tx * T, ty * T, T, T);
        fl.fillStyle(0xffffff, 0.3);
        for (const [tx, ty] of t) fl.fillRect(tx * T + 4, ty * T + 4, T - 8, T - 8);
        this.tweens.add({ targets: fl, alpha: 0, duration: 420, ease: 'Quad.easeOut', onComplete: () => fl.destroy() });
        BossFX.blast(this, x, cy, R, 'bolt');
        const cr = this.add.graphics().setDepth(0.35);
        this._vfxSort?.(cr);
        cr.lineStyle(2, 0x07040d, 0.75);
        for (let i = 0; i < 7; i++) {
            let a = i / 7 * Math.PI * 2 + Math.random() * 0.5, px = x, py = cy;
            cr.beginPath(); cr.moveTo(px, py);
            for (let k = 0; k < 4; k++) { a += (Math.random() - 0.5) * 0.8; px += Math.cos(a) * 9; py += Math.sin(a) * 6; cr.lineTo(px, py); }
            cr.strokePath();
        }
        this.tweens.add({ targets: cr, alpha: 0, delay: 1400, duration: 1200, onComplete: () => cr.destroy() });
        const goo = this._vfxBursts?.goo;
        if (goo) { goo.setParticleTint?.(0x8a7a9a); goo.explode(20, x, cy); }
    }

    // ── RIFTS ────────────────────────────────────────────────────────────────
    // A rift in the floor: an oval of swirling void with a lit rim and motes drawn into it.
    //   ms     how long it takes to open to full size
    //   idle   it opens only part way and turns slowly (a sniper waiting in there)
    //   rays   the directions something will fire out of it, shown as it finishes opening
    _bfxRift(x, y, r, o = {}) {
        const R = {
            x, y, r, open: 0, size: o.idle ? 0.55 : 1, spin: Math.random() * 6, t0: this.time.now, ms: o.ms ?? 500,
            owner: o.owner || null, closing: false, closeMs: 300, color: o.color ?? 0xb45cff, idle: !!o.idle,
            eyes: 0, rays: o.rays || null, big: !!o.big,
        };
        (this._bfxRifts || (this._bfxRifts = [])).push(R);
        return R;
    }
    _bfxRiftClose(R, ms = 300, burst = false) {
        if (!R || R.closing) return;
        R.closing = true; R.closeMs = ms; R.closeT0 = this.time.now; R.openAtClose = R.open;
        if (burst) {
            this._vfxBursts?.cosmic?.explode(14, R.x, R.y - 8);
            this._vfxFlash?.(R.x, R.y, 70, R.color, 260, 0.9);
            if (this.textures.exists('vfx_ring')) {
                const ring = this.add.image(R.x, R.y, 'vfx_ring').setTint(0xe0a8ff).setBlendMode(Phaser.BlendModes.ADD)
                    .setDepth(0.95).setScale(R.r / 26, R.r / 60);
                this._vfxSort?.(ring);
                this.tweens.add({ targets: ring, scaleX: R.r / 14, scaleY: R.r / 32, alpha: 0, duration: 300, ease: 'Cubic.easeOut', onComplete: () => ring.destroy() });
            }
        }
    }

    _bfxDrawRifts(now, dt) {
        const g = this._bfxRiftG, list = this._bfxRifts;
        if (!g?.active || !list) return;
        g.clear();
        const v = this.cameras.main.worldView;   // only the ones in view get drawn (a level can hold dozens)
        for (let i = list.length - 1; i >= 0; i--) {
            const R = list[i];
            // an owner that died takes its rift with it
            if (R.owner && !R.closing && (!R.owner.sprite?.active || R.owner.health <= 0)) this._bfxRiftClose(R, 260);
            if (R.closing) {
                const k = Math.min(1, (now - R.closeT0) / R.closeMs);
                R.open = R.openAtClose * (1 - k * k);
                if (k >= 1) { list.splice(i, 1); continue; }
            } else {
                const k = Math.min(1, (now - R.t0) / Math.max(1, R.ms));
                R.open = R.size * (1 - (1 - k) * (1 - k));
            }
            R.spin += dt * 0.001 * (R.idle ? 1.2 : 3.2 + 2 * R.open) * (R.closing ? 2.2 : 1);
            // something about to climb out: its eyes show in the dark for the last 700ms
            if (R.exitAt && !R.closing) R.eyes = Math.max(0, Math.min(1, (now - (R.exitAt - 700)) / 300));
            const m = R.r * 3 + 40;
            if (R.x + m < v.x || R.x - m > v.right || R.y + m < v.y || R.y - m > v.bottom) continue;
            this._bfxDrawRift(g, R, now);
        }
    }

    _bfxDrawRift(g, R, now) {
        const o = R.open;
        if (o < 0.02) return;
        const rx = R.r * o, ry = rx * 0.42, x = R.x, y = R.y;
        // the glow round it, the rim, the dark inside
        g.fillStyle(R.color, 0.16); g.fillEllipse(x, y, rx * 2.5, ry * 2.6);
        g.fillStyle(0x05020c, 0.92); g.fillEllipse(x, y, rx * 2, ry * 2);
        // arms of light turning into the middle
        const arms = R.big ? 5 : 3;
        for (let a = 0; a < arms; a++) {
            g.lineStyle(R.big ? 2 : 1.5, a % 2 ? 0xff7ae8 : 0xb46cff, 0.85);
            g.beginPath();
            for (let s = 0; s <= 10; s++) {
                const t = s / 10, ang = R.spin + a * Math.PI * 2 / arms + t * 2.4, rr = 1 - t;
                const px = x + Math.cos(ang) * rx * rr, py = y + Math.sin(ang) * ry * rr;
                if (s === 0) g.moveTo(px, py); else g.lineTo(px, py);
            }
            g.strokePath();
        }
        g.lineStyle(2, 0xe0a8ff, 0.95); g.strokeEllipse(x, y, rx * 2, ry * 2);
        g.lineStyle(1, 0xffffff, 0.5); g.strokeEllipse(x, y - 1, rx * 1.7, ry * 1.6);
        // motes falling in
        for (let k = 0; k < (R.big ? 10 : 5); k++) {
            const ph = (now * 0.0007 + k / (R.big ? 10 : 5)) % 1, ang = R.spin * 0.6 + k * 2.39996;
            const rr = 1.5 - ph * 1.3;
            g.fillStyle(k % 2 ? 0xffffff : 0xff9af0, 0.9 * Math.min(1, ph * 3));
            g.fillRect(Math.round(x + Math.cos(ang) * rx * rr), Math.round(y + Math.sin(ang) * ry * rr), 2, 2);
        }
        // eyes in the dark: something is about to come out
        if (R.eyes > 0) {
            const blink = Math.floor(now / 120) % 9 === 0 ? 0 : 1;
            g.fillStyle(0xff8cff, R.eyes * blink); g.fillRect(x - 5, y - 2, 3, 2); g.fillRect(x + 3, y - 2, 3, 2);
            g.fillStyle(0xffffff, R.eyes * blink); g.fillRect(x - 4, y - 2, 1, 1); g.fillRect(x + 4, y - 2, 1, 1);
        }
        // where it will fire: thin rays out of it as it finishes opening
        if (R.rays && !R.closing && o > R.size * 0.6) {
            const k = (o / R.size - 0.6) / 0.4;
            g.lineStyle(1, 0xff9af0, 0.55 * k);
            for (const a of R.rays) {
                const cx = Math.cos(a), sy = Math.sin(a);
                g.lineBetween(x + cx * 20, y - 10 + sy * 20, x + cx * (20 + 70 * k), y - 10 + sy * (20 + 70 * k));
            }
        }
    }

    // A void sniper's portal, at the moments its routine (moveEnemies) opens one: when it is made
    // (idle: it waits in there), when it is about to come out (it opens, its eyes show in the dark
    // for the last moments), and when it goes back in (under it as it sinks).
    _bfxSniperRift(e, x, y) {
        const T = this.TILE_SIZE, fy = y - (this.SLIME_Y_OFFSET || -10) + 4, now = this.time.now;
        const old = e._bfxRift;
        // closed this very moment at this very spot (the retreat closes it and opens it again): it stays
        if (old && old.closing && now - old.closeT0 < 60 && Math.hypot(old.x - x, old.y - fy) < 6) {
            old.closing = false; old.idle = true; old.size = 0.55; old.t0 = now - 400; old.ms = 400;
            e._bfxRift = old;
            if (!this._bfxRifts.includes(old)) this._bfxRifts.push(old);
            return true;
        }
        if (old) this._bfxRiftClose(old, 260);
        const exiting = !!(e._inDimension && e._sniperExiting);
        const R = this._bfxRift(x, fy, T * 0.62, { idle: !exiting && e._inDimension, ms: exiting ? 1200 : 260, owner: e });
        if (exiting) R.exitAt = now + 1500;
        e._bfxRift = R;
        return true;
    }
    _bfxSniperRiftClose(e) {
        const R = e._bfxRift;
        if (!R) return;
        e._bfxRift = null;
        // it just came out of it: the rift bursts; it just went in: the rift swallows the light
        this._bfxRiftClose(R, e._sniperVulnerable ? 220 : 260, !!e._sniperVulnerable);
    }

    // ── FRACTURE CORE ────────────────────────────────────────────────────────
    // A cut amber crystal: eight facets lit from the top left, a molten heart, hairline cracks.
    _bfxCoreDraw(g) {
        g.clear();
        const R = 28, Ri = 15;
        const pts = (r, off) => Array.from({ length: 8 }, (_, i) => { const a = i / 8 * Math.PI * 2 + off; return [Math.cos(a) * r, Math.sin(a) * r]; });
        const O = pts(R, -Math.PI / 8), I = pts(Ri, 0);
        g.fillStyle(0x1c0f08, 1); g.fillPoints(pts(R + 2, -Math.PI / 8).map(([x, y]) => ({ x, y })), true);
        const shade = [0xffd27a, 0xffb84a, 0xf08a2a, 0xc8601a, 0x9a4512, 0xb8581a, 0xe07a26, 0xffc460];
        for (let i = 0; i < 8; i++) {
            const a = O[i], b = O[(i + 1) % 8], c = I[(i + 1) % 8], d = I[i];
            g.fillStyle(shade[i], 1);
            g.fillTriangle(a[0], a[1], b[0], b[1], c[0], c[1]);
            g.fillTriangle(a[0], a[1], c[0], c[1], d[0], d[1]);
        }
        g.fillStyle(0xffe6a8, 1); g.fillPoints(I.map(([x, y]) => ({ x, y })), true);
        g.fillStyle(0xfff8e0, 1); g.fillCircle(0, 0, 8);
        g.fillStyle(0xffffff, 1); g.fillCircle(-2, -2, 3);
        g.lineStyle(1, 0x5a2a08, 0.8);
        g.lineBetween(-20, -6, -9, -2); g.lineBetween(-9, -2, -11, 6);
        g.lineBetween(12, 14, 18, 4); g.lineBetween(4, -24, 7, -14);
        g.lineStyle(1.5, 0xfff2c8, 0.9);
        g.beginPath(); g.moveTo(O[5][0], O[5][1]); g.lineTo(O[6][0], O[6][1]); g.lineTo(O[7][0], O[7][1]); g.strokePath();
    }

    // (Its name and health are the HUD's boss bar now; kept by name for its proxy.)
    _bfxCoreLayout() {}

    _bfxCoreTick(core, now, dt) {
        const C = this._bfxCfg(), c = core.container;
        const kick = core._bfxKick || 0;
        c.angle += (C.CORE_SPIN + kick) * dt / 1000;
        core._bfxKick = kick * Math.pow(0.04, dt / 1000);
        if (c.visible && this._bfxMotes && Math.random() < dt / 120) {
            this._bfxMotes.setParticleTint?.(Math.random() < 0.5 ? 0xffc460 : 0xff8a2a);
            this._bfxMotes.emitParticleAt(c.x + (Math.random() - 0.5) * 40, c.y + (Math.random() - 0.5) * 30, 1);
        }
    }
    // A hit on a weak point kicks its spin, and the spin settles back (it used to restart a tween,
    // which jerked it to a new speed every time).
    _bfxCoreKick(core) {
        core._bfxKick = Math.min(900, (core._bfxKick || 0) + 420);
        const c = core.container;
        if (c?.active) this._vfxFlash?.(c.x, c.y, 70, this._bfxCfg().CORE, 160, 0.7);
    }

    // It breaks: amber shards, sparks, a ring and a flash where it was.
    _bfxCoreDeath(core) {
        const c = core.container, x = c.x, y = c.y;
        this._bfxShatter(x, y, 0xffa63a, 16);
        BossFX.blast(this, x, y, 70, 'shell');
        this._vfxBursts?.fire?.explode(30, x, y);
        this._vfxFlash?.(x, y, 260, 0xffb44a, 700, 1);
    }

    // A debris tile landing: a puff of dust that spreads where it fell (it used to fly off toward the
    // map's corner, scaled about the graphics' origin).
    _bfxDust(px, py) {
        const T = this.TILE_SIZE;
        if (this.textures.exists('vfx_glow')) {
            const d = this.add.image(px, py, 'vfx_glow').setTint(0xccbbaa).setAlpha(0.45).setDepth(3.4).setScale(T * 1.6 / 128);
            this._vfxSort?.(d);
            this.tweens.add({ targets: d, scale: T * 3.2 / 128, alpha: 0, duration: 420, ease: 'Quad.easeOut', onComplete: () => d.destroy() });
        }
    }

    // ── QUEEN ────────────────────────────────────────────────────────────────
    // Her drawn crown (Creatures.js wears a pixel one), the orange box round her and the orange
    // rectangle under her stop drawing. Under her: a red glow that breathes. Her hurtbox (the
    // same qr the hit test reads) is shown by four corner brackets instead of a box.
    _bfxQueenDress(q) {
        q._bfx = {};
        const c = q.container;
        if (typeof CreatureFX !== 'undefined') for (const o of c.list) if (o.type === 'Graphics') CreatureFX.mute(o);
        for (const o of c.list) if (o.type === 'Rectangle' && o.width === 24 && o.height === 16) o.setVisible(false);
        if (this.textures.exists('vfx_glow')) {
            q.glowImg = this.make.image({ x: 0, y: 6, key: 'vfx_glow' }, false).setBlendMode(Phaser.BlendModes.ADD)
                .setTint(q.tide ? TideMother.CFG.COL : 0xff3a4a).setAlpha(0.35).setScale(0.9, 0.36);
            c.addAt(q.glowImg, 1);
        }
        const r = q.hitR || this.TILE_SIZE * 1.25, L = 7, br = this.make.graphics({}, false);
        for (const [w, col, a] of [[3, 0x000000, 0.35], [1.5, q.tide ? 0x7fe0ff : 0xff5a6a, 0.7]]) {
            br.lineStyle(w, col, a);
            for (const [sx, sy] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) {
                br.beginPath(); br.moveTo(sx * r, sy * r + -sy * L); br.lineTo(sx * r, sy * r); br.lineTo(sx * r - sx * L, sy * r); br.strokePath();
            }
        }
        c.add(br);
        q._bfx.brackets = br;
        this._bfxCrisp(c);
    }
    _bfxQueenTick(q, now) {
        const g = q.glowImg;
        if (g?.active) g.setAlpha(0.3 + 0.12 * Math.sin(now * 0.006 + q.tileX));
        const br = q._bfx?.brackets;
        if (br?.active) br.setAlpha(0.55 + 0.25 * Math.sin(now * 0.004));
    }

    // Her pulse: the tiles it reaches light up red while it comes, and flash when it lands.
    _bfxQueenPulse(q, px, py, R, ms) {
        const tiles = BossFX.tilesInRadius(this, px, py, R, false);
        return BossFX.mark(this, tiles, this._bfxCfg().QUEEN, ms, { fill: 0.04 });
    }

    // Her death: a burst of her red, a ring, and her crown thrown off.
    _bfxQueenDeath(q, px, py) {
        const c = q.container, x = c?.x ?? px, y = (c?.y ?? py) - 14, col = q.tide ? TideMother.CFG.COL : 0xff3a4a;
        const goo = this._vfxBursts?.goo;
        if (goo) { goo.setParticleTint?.(col); goo.explode(q.tide ? 60 : 30, x, y); }
        BossFX.blast(this, x, y + 14, q.tide ? 110 : 60, q.tide ? 'volt' : 'bolt');
        this._vfxFlash?.(x, y, 200, q.tide ? col : this._bfxCfg().QUEEN, 600, 1);
        if (this.textures.exists('cfx_face') && c) {
            const cr = this.add.image(x, c.y - 40, 'cfx_face', 'h_queen_0').setScale(3.2).setDepth(5.1);
            this._vfxSort?.(cr);
            this.tweens.add({ targets: cr, y: c.y - 110, angle: -160, duration: 560, ease: 'Quad.easeOut' });
            this.tweens.add({ targets: cr, alpha: 0, delay: 420, duration: 300, onComplete: () => cr.destroy() });
        }
        if (this.textures.exists('vfx_splat')) {
            const sp = this.add.image(x, y + 22, 'vfx_splat').setTint(col).setAlpha(0.55).setDepth(0.2).setScale(q.tide ? 2.6 : 1.8);
            this._vfxSort?.(sp);
            this.tweens.add({ targets: sp, alpha: 0, delay: 2500, duration: 3000, onComplete: () => sp.destroy() });
        }
    }

    // ── THE ROOTER ───────────────────────────────────────────────────────────
    // The pull tendril, from the rooter to its tip: a vine of dark stem and leaf-green skin with thorns,
    // a clawed pod at the tip, dirt where it comes out of the ground. The graphics sits at the tip
    // (so whatever reads its position, its wake, its light, a block, finds the tip, not 0,0).
    _bfxDrawVine(p, retract = 0) {
        const g = p.gfx;
        if (!g?.active) return;
        const tipX = p._tipX, tipY = p._tipY, sx = p.startX, sy = p.startY + 8;
        g.setPosition(tipX, tipY);
        if (g.depth !== 1.05) g.setDepth(1.05);
        const now = this.time.now, t = (now - (p._createdAt || 0)) / 1000;
        const ex = tipX + (sx - tipX) * retract, ey = tipY + (sy - tipY) * retract;
        const dx = ex - sx, dy = ey - sy, len = Math.hypot(dx, dy) || 1, nx = -dy / len, ny = dx / len;
        const SEGS = Math.max(6, Math.min(24, Math.round(len / 8)));
        const pts = [];
        for (let s = 0; s <= SEGS; s++) {
            const f = s / SEGS, w = Math.sin(f * Math.PI * 2.5 - t * 6) * 3.5 * Math.sin(f * Math.PI);
            pts.push([sx + dx * f + nx * w - tipX, sy + dy * f + ny * w - tipY]);
        }
        g.clear();
        const stroke = (w, col, a, ox = 0, oy = 0) => {
            g.lineStyle(w, col, a); g.beginPath(); g.moveTo(pts[0][0] + ox, pts[0][1] + oy);
            for (let i = 1; i < pts.length; i++) g.lineTo(pts[i][0] + ox, pts[i][1] + oy);
            g.strokePath();
        };
        stroke(6, 0x0b1a0d, 0.95);
        stroke(4, 0x2f7a3a, 1);
        stroke(1.5, 0x8aff9a, 0.7, -nx * 1, -ny * 1);
        // thorns and leaves along it
        for (let s = 2; s < SEGS; s += 2) {
            const [x0, y0] = pts[s], [x1, y1] = pts[s + 1] || pts[s];
            const sl = Math.hypot(x1 - x0, y1 - y0) || 1, ux = (x1 - x0) / sl, uy = (y1 - y0) / sl;
            const side = (s / 2) % 2 ? 1 : -1, px = -uy * side, py = ux * side;
            if ((s / 2) % 3 === 0) {
                g.fillStyle(0x46c24e, 1);
                g.fillTriangle(x0 + px * 2, y0 + py * 2, x0 + px * 7 + ux * 4, y0 + py * 7 + uy * 4, x0 + ux * 5 + px * 2, y0 + uy * 5 + py * 2);
                g.fillStyle(0xb6ff7a, 0.8); g.fillRect(x0 + px * 4, y0 + py * 4, 1, 1);
            } else {
                g.fillStyle(0xd8e8c0, 0.9);
                g.fillTriangle(x0 + px * 2 - ux, y0 + py * 2 - uy, x0 + px * 2 + ux * 2, y0 + py * 2 + uy * 2, x0 + px * 6, y0 + py * 6);
            }
        }
        // the pod at the tip, its claws open toward you
        const [ax, ay] = pts[pts.length - 1], [bx, by] = pts[pts.length - 2] || pts[0];
        const hd = Math.atan2(ay - by, ax - bx), cs = Math.cos(hd), sn = Math.sin(hd);
        const open = 0.6 + 0.4 * Math.sin(now * 0.02);
        g.fillStyle(0x0b1a0d, 1); g.fillCircle(ax, ay, 6);
        g.fillStyle(0x46c24e, 1); g.fillCircle(ax, ay, 4.5);
        g.fillStyle(0xb6ff7a, 1); g.fillCircle(ax - cs, ay - sn, 2);
        g.lineStyle(2, 0xd8e8c0, 1);
        for (const sd of [-1, 1]) {
            const a = hd + sd * 0.55 * open;
            g.beginPath(); g.moveTo(ax + Math.cos(a) * 4, ay + Math.sin(a) * 4);
            g.lineTo(ax + Math.cos(a) * 9 + Math.cos(hd + sd * 1.6) * 3, ay + Math.sin(a) * 9 + Math.sin(hd + sd * 1.6) * 3);
            g.strokePath();
        }
        // torn ground where it comes up
        const [rx0, ry0] = pts[0];
        g.fillStyle(0x0b0d10, 0.7); g.fillEllipse(rx0, ry0 + 2, 16, 6);
        g.fillStyle(0x3a2c22, 0.9); g.fillRect(rx0 - 7, ry0, 3, 2); g.fillRect(rx0 + 4, ry0 + 1, 3, 2);
    }

    // It ends (it caught you, or hit a wall, or ran out): it whips back down into the ground.
    _bfxVineSnap(p) {
        const g = p.gfx;
        if (!g?.active || p._bfxSnap) return false;
        p._bfxSnap = true;
        const o = { k: 0 };
        this._vfxBursts?.goo && (this._vfxBursts.goo.setParticleTint?.(0x46c24e), this._vfxBursts.goo.explode(6, p._tipX, p._tipY));
        this.tweens.add({
            targets: o, k: 1, duration: 260, ease: 'Quad.easeIn',
            onUpdate: () => {
                if (!g.active) return;
                p._tipX += (p.startX - p._tipX) * o.k * 0.3; p._tipY += (p.startY + 8 - p._tipY) * o.k * 0.3;
                this._bfxDrawVine(p, o.k);
            },
            onComplete: () => { if (g.active) g.destroy(); },
        });
        return true;
    }

    // The ground thump: the tiles it reaches (Manhattan from its tile, as the root test reads) flash
    // green, roots burst up in them, and a ring runs out to the edge of that diamond.
    _bfxThump(enemy, r) {
        const T = this.TILE_SIZE, C = this._bfxCfg();
        const tiles = BossFX.tilesManhattan(this, enemy.x, enemy.y, r);
        const g = this.add.graphics().setDepth(0.46).setBlendMode(Phaser.BlendModes.ADD);
        this._vfxSort?.(g);
        BossFX.drawTiles(g, T, tiles, C.VINE, 1, this.time.now, 0, 0, { fill: 0.2 });
        this.tweens.add({ targets: g, alpha: 0, duration: 520, ease: 'Quad.easeIn', onComplete: () => g.destroy() });
        // the sprouts grow up from the floor: scaled about the row's mean height, not world 0
        const oy = tiles.length ? tiles.reduce((a, [, ty]) => a + ty, 0) / tiles.length * T + T / 2 + 6 : 0;
        const sp = this.add.graphics().setDepth(1.06).setPosition(0, oy);
        this._vfxSort?.(sp);
        for (const [tx, ty] of tiles) {
            if (Math.random() < 0.4) continue;
            const x = tx * T + T / 2 + (Math.random() - 0.5) * 8, y = ty * T + T / 2 + 6 - oy;
            sp.fillStyle(0x0b1a0d, 1); sp.fillTriangle(x - 3, y, x + 3, y, x, y - 10);
            sp.fillStyle(0x46c24e, 1); sp.fillTriangle(x - 2, y, x + 2, y, x, y - 8);
            sp.fillStyle(0xb6ff7a, 1); sp.fillRect(x, y - 7, 1, 2);
        }
        sp.setScale(1, 0.2);
        this.tweens.add({ targets: sp, scaleY: 1, duration: 120, ease: 'Back.easeOut' });
        this.tweens.add({ targets: sp, alpha: 0, delay: 360, duration: 300, onComplete: () => sp.destroy() });
        BossFX.blast(this, enemy.x * T + T / 2, enemy.y * T + T / 2, (r + 0.5) * T, 'vine');
        this._vfxBursts?.goo && (this._vfxBursts.goo.setParticleTint?.(0x5a4a3a), this._vfxBursts.goo.explode(12, enemy.x * T + T / 2, enemy.y * T + T / 2));
    }

    // ── YOU, ROOTED ──────────────────────────────────────────────────────────
    // While you are held in place: tendrils come up out of the floor and wrap your base. Thorny vines
    // from a rooter, void tendrils from the Sovereign.
    _bfxRootFx(now) {
        const g = this._bfxRootG, p = this.player;
        if (!g?.active) return;
        g.clear();
        if (!this._playerRooted || !p?.active || p.visible === false) return;
        const vine = this._bfxRootKind === 'vine';
        const dark = vine ? 0x0b1a0d : 0x12061f, mid = vine ? 0x2f7a3a : 0x6a2ad0, hi = vine ? 0xb6ff7a : 0xff9af0;
        const T = this.TILE_SIZE, bx = p.x, base = p.y - (this.SLIME_Y_OFFSET || 0) + 10;
        const grow = Math.min(1, (now - (this._bfxRootT0 || now)) / 160);
        for (let i = 0; i < 5; i++) {
            const side = i - 2, sw = Math.sin(now * 0.008 + i * 1.7) * 1.5;
            const x0 = bx + side * 6, x1 = bx + side * 2.2 + sw, y1 = base - (7 + (i % 2) * 4) * grow;
            g.lineStyle(4, dark, 1); g.lineBetween(x0, base, x1, y1);
            g.lineStyle(2, mid, 1); g.lineBetween(x0, base, x1, y1);
            g.fillStyle(hi, 1); g.fillRect(Math.round(x1), Math.round(y1), 1, 1);
        }
        g.fillStyle(dark, 0.6); g.fillEllipse(bx, base, 30, 6);
    }

    // ── SINGULARITY SLIMES ───────────────────────────────────────────────────
    // Their slam's warning tiles: the game makes them (moveEnemies) and only takes them away when the
    // slam lands, so one that died mid wind-up left them pulsing on the floor for good. They are
    // cleared here when their slime is gone, and drawn as danger tiles filling over the wind-up.
    _bfxSings(now) {
        const list = this._bfxSingList, g = this._bfxSingG;
        if (!list || !g?.active) return;
        g.clear();
        const T = this.TILE_SIZE;
        for (let i = list.length - 1; i >= 0; i--) {
            const e = list[i];
            const alive = e.sprite?.active && e.health > 0 && (this.enemies || []).includes(e);
            const wt = e._singWarningTiles;
            if (!alive) {
                if (wt) { for (const w of wt) { this.tweens.killTweensOf(w); w.destroy(); } e._singWarningTiles = []; }
                list.splice(i, 1);
                continue;
            }
            if (!wt?.length) continue;
            const tiles = [];
            for (const w of wt) {
                if (!w.active) continue;
                if (!w._cfxMuted && typeof CreatureFX !== 'undefined') CreatureFX.mute(w);
                tiles.push([Math.floor(w.x / T), Math.floor(w.y / T)]);
            }
            const p = Math.min(1, (now - (e._singChargeStart || now)) / (e._singChargeDur || 700));
            BossFX.drawTiles(g, T, tiles, 0xb45cff, p, now, 0, 0, { fill: 0.06 });
        }
    }

    // ── SINGULARITY COLLAPSE ─────────────────────────────────────────────────
    // The room goes dark (in the world now: on the HUD camera it hid the boss and dimmed the HUD),
    // you and the boss stay lit above it, and the floor the pull will reach glows: every tile that
    // can see the centre, worked out with the attack's own line-of-sight walk from your sprite. The
    // tiles behind walls stay dark: that is cover.
    _bfxCollapseStart(cx, cy, ms) {
        const T = this.TILE_SIZE, room = this.rooms?.[6], off = this.SLIME_Y_OFFSET || 0;
        const W = this.WORLD_WIDTH * T, H = this.WORLD_HEIGHT * T;
        const dark = this.add.rectangle(W / 2, H / 2, W, H, 0x02010a, 1).setDepth(15).setAlpha(0);
        this._vfxSort?.(dark);
        const danger = [], safe = [];
        if (room) {
            for (let x = room.x; x < room.x + room.w; x++) {
                for (let y = room.y; y < room.y + room.h; y++) {
                    if (this.world[x]?.[y] !== this.FLOOR) continue;
                    const px = x * T + T / 2, py = y * T + T / 2 + off;
                    const dx = cx - px, dy = cy - py, steps = Math.ceil(Math.sqrt(dx * dx + dy * dy) / (T * 0.5));
                    let blocked = false;
                    for (let s = 1; s <= steps; s++) {
                        const t = s / steps;
                        if (this.world[Math.floor((px + dx * t) / T)]?.[Math.floor((py + dy * t) / T)] === this.WALL) { blocked = true; break; }
                    }
                    (blocked ? safe : danger).push([x, y]);
                }
            }
        }
        const g = this.add.graphics().setDepth(15.2).setBlendMode(Phaser.BlendModes.ADD);
        this._vfxSort?.(g);
        let motes = null;
        if (this.add.particles && this.textures.exists('vfx_dot')) {
            motes = this.add.particles(0, 0, 'vfx_dot', {
                lifespan: { min: 600, max: 1100 }, scale: { start: 0.9, end: 0.2 }, alpha: { start: 0.2, end: 1 },
                tint: [0xb46cff, 0xff7ae8, 0xffffff], blendMode: 'ADD', emitting: false, moveToX: cx, moveToY: cy,
            }).setDepth(16.1);
            this._vfxSort?.(motes);
        }
        const p = this.player;
        if (p) { p._bfxDepth = p.depth; p.setDepth(15.6); }
        this._bfxCollapse = { dark, g, motes, danger, safe, cx, cy, t0: this.time.now, ms, live: true };
        return dark;
    }

    _bfxCollapseTick(now) {
        const S = this._bfxCollapse;
        if (!S?.live || !S.g?.active) return;
        const T = this.TILE_SIZE, t = Math.min(1, (now - S.t0) / S.ms), tt = t * t * t;
        const g = S.g;
        g.clear();
        BossFX.drawTiles(g, T, S.danger, 0x9a3aff, Math.min(1, t * 1.3), now, 0, 0, { fill: 0.02, rim: 0xffb8ff, ticks: false });
        // cover: a cool outline on each tile the pull cannot reach
        g.fillStyle(0x5ad8ff, 0.18 + 0.12 * Math.sin(now * 0.006));
        for (const [x, y] of S.safe) { g.fillRect(x * T + 6, y * T + 6, T - 12, 2); g.fillRect(x * T + 6, y * T + T - 8, T - 12, 2); }
        if (S.motes && Math.random() < 0.3 + 0.7 * tt) {
            const n = 1 + Math.floor(tt * 5);
            for (let i = 0; i < n; i++) {
                const a = Math.random() * Math.PI * 2, r = (4 + Math.random() * 6) * T;
                S.motes.emitParticleAt(S.cx + Math.cos(a) * r, S.cy + Math.sin(a) * r, 1);
            }
        }
    }

    _bfxCollapseEnd() {
        const S = this._bfxCollapse;
        if (!S) return;
        S.live = false;
        this._bfxCollapse = null;
        const p = this.player;
        if (p && p._bfxDepth !== undefined) { p.setDepth(p._bfxDepth); p._bfxDepth = undefined; }
        if (S.g?.active) this.tweens.add({ targets: S.g, alpha: 0, duration: 500, onComplete: () => S.g.destroy() });
        if (S.motes?.active) this.time.delayedCall(1200, () => S.motes?.destroy());
        BossFX.blast(this, S.cx, S.cy, 4 * this.TILE_SIZE, 'ripple');
    }

    // ── EVENT HORIZON ────────────────────────────────────────────────────────
    // Its ring: a band of dark with light racing round it. Its pulse: a shockwave whose bright band is
    // as wide as the band that catches you (within 0.6 tiles of its radius).
    _bfxHorizonRing(g, b, r, ang) {
        const x = b.container.x, y = b.container.y;
        g.clear();
        g.lineStyle(10, 0x05020c, 0.85); g.strokeCircle(x, y, r);
        g.lineStyle(2, 0x6a2ad0, 0.9); g.strokeCircle(x, y, r + 5);
        for (let i = 0; i < 10; i++) {
            const a = ang + i / 10 * Math.PI * 2;
            g.lineStyle(3, i % 2 ? 0xff7ae8 : 0xd8b0ff, 0.9);
            g.beginPath(); g.arc(x, y, r, a, a + 0.32, false); g.strokePath();
            g.fillStyle(0xffffff, 0.9); g.fillRect(Math.round(x + Math.cos(a + 0.32) * r) - 1, Math.round(y + Math.sin(a + 0.32) * r) - 1, 2, 2);
        }
    }
    _bfxHorizonPulse(g, x, y, r, pt) {
        const band = this.TILE_SIZE * 0.6, a = 1 - pt;
        g.clear();
        if (g.blendMode !== Phaser.BlendModes.ADD) g.setBlendMode(Phaser.BlendModes.ADD);
        g.lineStyle(band * 2, 0x9a3aff, 0.22 * a); g.strokeCircle(x, y, r);
        g.lineStyle(3, 0xd8a0ff, 0.9 * a); g.strokeCircle(x, y, r);
        g.lineStyle(1, 0xffffff, 0.8 * a); g.strokeCircle(x, y, r);
    }

    // ── PHASE TWO: THE PILLARS GO ────────────────────────────────────────────
    // The game has made each pillar tile floor (this.world). Every tile in and round them gets the
    // frame Visuals.js would paint for it now (the walls lose their faces, the floor round them its
    // contact shadow), the lifted wall caps over them go, and they crumble: dust, rubble, pebbles.
    // The tiles are bobs in two blitters on the atlas: the world (depth 0) and the caps above it.
    _bfxCrumble(tiles) {
        const T = this.TILE_SIZE;
        if (!tiles?.length || !this._vfxFrame) return;
        const key = (x, y) => x + ',' + y;
        const near = new Set();
        for (const [x, y] of tiles) for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) near.add(key(x + dx, y + dy));
        const blits = this.children.list.filter(o => o.type === 'Blitter' && o.texture?.key === 'vfx_atlas');
        const bobsOf = bl => {
            const m = new Map();
            for (const b of bl?.children?.list || []) {
                const k = key(Math.round(b.x / T), Math.round(b.y / T));
                if (near.has(k)) m.set(k, b);
            }
            return m;
        };
        const world = bobsOf(blits.find(o => (o.depth || 0) === 0));
        const capLayer = blits.find(o => o.depth > 0 && o.depth < 0.5), caps = bobsOf(capLayer);
        const TH = this._vfxTheme?.() || { floor: 0xffffff, wall: 0xffffff };
        for (const k of near) {
            const [x, y] = k.split(',').map(Number), fr = this._bfxTileFrame(x, y);
            if (!fr) continue;
            const b = world.get(k);
            if (b) { b.setFrame(fr.frame); b.setTint(fr.floor ? TH.floor : TH.wall); }
            let c = caps.get(k);
            if (!c && fr.lift && capLayer) { c = capLayer.create(x * T, y * T, fr.lift); if (TH.wall !== 0xffffff) c.setTint(TH.wall); }   // a wall that rose (the Tower's shift)
            if (!c) continue;
            c.setVisible(!!fr.lift);
            if (fr.lift) c.setFrame(fr.lift);
        }
        const a = this._vfxAtlas?.();
        const pebbles = this._vfxPaintDecal ? this._vfxFrame('dc_pebbles', (ctx, X, Y, S) => this._vfxPaintDecal(ctx, X, Y, S, 'dc_pebbles')) : null;
        if (a?._vfxDirty) { a.refresh(); a._vfxDirty = false; }
        tiles.forEach(([x, y], i) => {
            const px = x * T + T / 2, py = y * T + T / 2;
            this.time.delayedCall(i * 40, () => {
                const goo = this._vfxBursts?.goo;
                if (goo) { goo.setParticleTint?.(0x6a6e82); goo.explode(8, px, py); }
                if (this.textures.exists('vfx_glow')) {
                    const d = this.add.image(px, py, 'vfx_glow').setTint(0x9a8e9a).setAlpha(0.5).setDepth(3.4).setScale(0.3);
                    this._vfxSort?.(d);
                    this.tweens.add({ targets: d, scale: 0.7, alpha: 0, duration: 700, ease: 'Quad.easeOut', onComplete: () => d.destroy() });
                }
            });
            if (pebbles && this.world[x]?.[y] === this.FLOOR) {
                const r = this.add.image(px, py, 'vfx_atlas', pebbles).setDepth(0.1).setAngle(90 * ((x + y) & 3));
                if (TH.floor !== 0xffffff) r.setTint(TH.floor);
                this._vfxSort?.(r);
            }
        });
    }

    // The atlas frame Visuals.js would paint for tile (x, y) as the world stands now.
    _bfxTileFrame(x, y) {
        return this._vfxTileFrame(x, y);
    }

    // Its death: it folds in on itself (a star of light, the ring and its shards thrown out), then
    // goes off in a burst of night.
    _bfxVoidDeath(b) {
        const c = b.container, x = c.x, y = c.y - 15;
        this._vfxFlash?.(x, y, 300, 0xc99cff, 1400, 1);
        for (let i = 0; i < 6; i++) {
            this.time.delayedCall(i * 140, () => {
                const a = Math.random() * Math.PI * 2, d = 10 + Math.random() * 40;
                this._bfxShatter(x + Math.cos(a) * d, y + Math.sin(a) * d * 0.6, i % 2 ? 0xb45cff : 0xff7ae8, 6);
            });
        }
        this.time.delayedCall(800, () => {
            BossFX.blast(this, x, y, 120, 'ripple');
            this._vfxBursts?.cosmic?.explode(40, x, y);
            const goo = this._vfxBursts?.goo;
            if (goo) { goo.setParticleTint?.(0x2a0f52); goo.explode(30, x, y); }
            if (this.textures.exists('vfx_splat')) {
                const sp = this.add.image(x, y + 24, 'vfx_splat').setTint(0x5a2aa6).setAlpha(0.6).setDepth(0.2).setScale(2.6);
                this._vfxSort?.(sp);
                this.tweens.add({ targets: sp, alpha: 0, delay: 3000, duration: 3000, onComplete: () => sp.destroy() });
            }
        });
        for (const R of this._bfxRifts || []) this._bfxRiftClose(R, 300);
    }
}
