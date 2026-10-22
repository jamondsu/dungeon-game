// ═══════════════════════════════════════════════════════════════════════════
// LEVELMANAGER.JS — Real dungeon level logic (level 2+)
// All methods use .call(this) from GameScene via proxy stubs, same as other modules.
// ═══════════════════════════════════════════════════════════════════════════

class LevelManager {

    // ─── CROSS-LEVEL GEOMETRY & DISPATCH HELPERS ───────────────────────────
    // Moved here from TutorialManager.js — these are used by every level
    // (enemy AI, boss attacks, weapon hit detection, dev tools), not tutorial-
    // exclusive logic, even though some originated there historically.

    // ═══════════════════════════════════════════════════════════════════════
    // WATER  — terrain for the flooded levels
    //
    // A water tile is a first-class piece of terrain with its own HP. Fire burns it
    // down; when it hits zero the tile does not simply vanish, it becomes STEAM and
    // refuses to be re-wet for 12 seconds. That refusal is the whole point: the level's
    // enemies paint water faster than any weapon can remove it, so drying a floor would
    // be meaningless if it could be re-flooded the same second. Steam is what turns fire
    // from "the wrong element here" into the terrain-denial answer.
    //
    // Water only ever generates INSIDE rooms, never in corridors. Scattered coverage in a
    // two-tile corridor leaves no dry lane, which turns the movement penalty from a
    // hazard you play around into a tax you cannot avoid — and a penalty you cannot avoid
    // stops being read as a penalty at all.
    // ═══════════════════════════════════════════════════════════════════════
    // ═══════════════════════════════════════════════════════════════════════
    // LEAKING PIPES
    // A pipe sits in the wall outside a room and bleeds inward. Its tiles are permanent
    // water, and once fire's fog clears off one the pipe puts it back -- one tile at a time, nearest
    // the mouth first, so it visibly flows back in rather than popping. That turns
    // "evaporate the floor" from a solution into a delay, and it means the safe ground in
    // a room is a moving thing you have to keep re-earning.
    // ═══════════════════════════════════════════════════════════════════════

    _pipeCfg() {
        return {
            REFILL_MS:   900,   // one tile restored per pipe per tick
            ACCENT: { pool: 0xc47a3a, line: 0x3fb6e8 },   // copper valve vs steel main
        };
    }

    initPipes() {
        this._pipes = [];
        for (const def of (this.pipes || [])) {
            const tiles = this._pipeTiles(def);
            if (!tiles.length) continue;
            this._pipes.push({ ...def, tiles, next: 0, lastRefill: 0 });
        }
        this._drawPipeMouths();
        this._pipeFlow = this.add.graphics().setDepth(0.46);   // the pouring water: on the water's surface, under fog and lava
        // Prime them so the room starts as the pipes would have made it.
        for (const p of this._pipes) for (const t of p.tiles) {
            if (this.world?.[t.x]?.[t.y] === this.FLOOR) this.addWater(t.x, t.y, 0);
        }
    }

    // The tiles a pipe is responsible for, ordered by distance from the mouth so refills
    // read as flowing inward.
    _pipeTiles(def) {
        const out = [], seen = new Set();
        const first = { x: def.mx + def.dx, y: def.my + def.dy };
        // the room this pipe drains into — a main is supposed to cross the whole thing
        const rr = (this.rooms || []).find(r =>
            first.x >= r.x && first.x < r.x + r.w && first.y >= r.y && first.y < r.y + r.h);
        const inRoom = (x, y) => !rr || (x >= rr.x && x < rr.x + rr.w && y >= rr.y && y < rr.y + rr.h);
        const push = (x, y) => {
            const k = x + ',' + y;
            if (seen.has(k)) return false;
            if (this.world?.[x]?.[y] !== this.FLOOR) return false;
            if (!inRoom(x, y)) return false;
            seen.add(k); out.push({ x, y });
            return true;
        };

        if (def.kind === 'line') {
            // A sewer main: a single-tile stream straight across the room, wall to wall.
            // It stops at the far side rather than at some arbitrary length, so the room is
            // genuinely divided by it.
            const span = Math.max(rr ? Math.max(rr.w, rr.h) : 12, 4);
            for (let i = 1; i <= span; i++) {
                if (!push(def.mx + def.dx * i, def.my + def.dy * i)) {
                    // a pillar in the way ends the stream there; it does not jump over
                    if (this.world?.[def.mx + def.dx * i]?.[def.my + def.dy * i] !== this.FLOOR) break;
                }
            }
        } else {
            // A leaking valve: water spills out and spreads in a rough circle centred on
            // the mouth itself, so the hazard hugs the wall it comes from.
            const cx = def.mx + def.dx, cy = def.my + def.dy;
            const r = Math.max(1.5, def.len);
            const cand = [];
            for (let ox = -Math.ceil(r); ox <= Math.ceil(r); ox++)
                for (let oy = -Math.ceil(r); oy <= Math.ceil(r); oy++) {
                    const d = Math.hypot(ox, oy);
                    if (d > r + 0.3) continue;
                    cand.push({ x: cx + ox, y: cy + oy, d });
                }
            cand.sort((a, b) => a.d - b.d);
            for (const c of cand) push(c.x, c.y);
        }
        return out;
    }

    _drawPipeMouths() {
        const TS = this.TILE_SIZE, ACC = this._pipeCfg().ACCENT;
        this._pipeImgs = [];
        for (const p of this._pipes) {
            const g = this.add.graphics().setDepth(0.42);   // above water, below lava
            const px = p.mx * TS + TS / 2, py = p.my * TS + TS / 2;
            // Local frame: `a` runs along the drain direction, `c` across it, both scaled to
            // the tile, so a mouth fills nearly the whole wall tile.
            const ax = p.dx * TS, ay = p.dy * TS;
            const qx = -p.dy * TS, qy = p.dx * TS;
            const pt = (a, c) => ({ x: px + ax * a + qx * c, y: py + ay * a + qy * c });
            const quad = (a0, a1, c0, c1) => [pt(a0, c0), pt(a1, c0), pt(a1, c1), pt(a0, c1)];
            const accent = ACC[p.kind] ?? 0x3fb6e8;

            // A pipe end coming out of the wall toward the room: a barrel shaded across its width
            // (lit on one side), a flange with bolts at the mouth, a dark throat with water standing
            // in it. Mains are square-cut steel with a
            // grate; valves are copper with a wheel, so the two still read apart.
            const steel = p.kind === 'line';
            const PAL = steel ? [0x2a3138, 0x4a5560, 0x6f7d8a, 0x9aa8b4] : [0x3a2414, 0x6b4426, 0x9a6a3a, 0xc89058];
            const W = steel ? 0.34 : 0.28;
            const bands = [[-W, -W * 0.45, 1], [-W * 0.45, W * 0.15, 2], [W * 0.15, W * 0.55, 3], [W * 0.55, W, 1]];
            g.fillStyle(0x000000, 0.35); g.fillPoints(quad(-0.5, 0.36, -W - 0.06, W + 0.06), true);            // its shadow on the wall
            for (const [c0, c1, k] of bands) { g.fillStyle(PAL[k], 1); g.fillPoints(quad(-0.5, 0.24, c0, c1), true); }
            g.fillStyle(PAL[0], 1); for (const a0 of [-0.3, -0.05]) g.fillPoints(quad(a0, a0 + 0.04, -W, W), true);   // seams
            // the flange
            const F = W + 0.1;
            g.fillStyle(PAL[0], 1); g.fillPoints(quad(0.2, 0.4, -F - 0.02, F + 0.02), true);
            g.fillStyle(PAL[2], 1); g.fillPoints(quad(0.22, 0.38, -F, F), true);
            g.fillStyle(PAL[3], 1); g.fillPoints(quad(0.22, 0.27, -F, F), true);
            for (const c of [-F + 0.07, F - 0.07]) { const b = pt(0.3, c); g.fillStyle(PAL[0], 1); g.fillCircle(b.x, b.y, 1.6); g.fillStyle(PAL[3], 1); g.fillCircle(b.x - 0.4, b.y - 0.4, 0.7); }
            // the throat, water standing in it
            g.fillStyle(0x05090c, 1); g.fillPoints(quad(0.38, 0.46, -W + 0.06, W - 0.06), true);
            g.fillStyle(0x16506e, 0.95); g.fillPoints(quad(0.42, 0.46, -W + 0.08, W - 0.08), true);
            if (steel) {
                g.lineStyle(1.2, PAL[1], 1);
                for (const c of [-0.12, 0, 0.12]) { const a0 = pt(0.38, c), a1 = pt(0.46, c); g.lineBetween(a0.x, a0.y, a1.x, a1.y); }
            } else {
                const w0 = pt(-0.2, 0);                                             // the wheel on top
                g.lineStyle(2, PAL[0], 1); g.strokeCircle(w0.x, w0.y, TS * 0.2);
                g.lineStyle(1.2, accent, 0.95); g.strokeCircle(w0.x, w0.y, TS * 0.2);
                for (let i = 0; i < 3; i++) { const a = i * Math.PI / 3 + 0.3; g.lineBetween(w0.x + Math.cos(a) * TS * 0.2, w0.y + Math.sin(a) * TS * 0.2, w0.x - Math.cos(a) * TS * 0.2, w0.y - Math.sin(a) * TS * 0.2); }
                g.fillStyle(PAL[3], 1); g.fillCircle(w0.x, w0.y, 1.5);
            }

            // a bead of water in the lip, both kinds
            const lip = pt(p.kind === 'line' ? 0.46 : 0.44, 0);
            g.fillStyle(0x9fe8ff, 0.8);
            g.fillCircle(lip.x, lip.y, 2.0);
            // They never change: an image each (one texture per kind and facing), not ~300 commands tessellated every frame.
            // One image of them all was hidden, every pipe at once, while the room at its middle still lay under fog.
            this._pipeImgs.push(UIKit.bake(this, g, (p.mx - 1) * TS, (p.my - 1) * TS, TS * 3, TS * 3, `pipe_${p.kind}_${p.dx}_${p.dy}`));
        }
    }

    // Water pouring out of every mouth, redrawn each frame (a pipe reads as running even when all its tiles are wet):
    // a stream from the lip onto the floor with light sliding down it, foam where it lands, rings spreading over the
    // water there, and down a main the current runs as far as its water reaches, so a refilled main flows back in.
    _drawPipeWater(time) {
        const g = this._pipeFlow, TS = this.TILE_SIZE, v = this.cameras.main.worldView;
        if (!g?.active) return;
        g.clear();
        const fr = x => x - Math.floor(x), rnd = n => fr(Math.sin(n * 12.9898) * 43758.5453);
        for (const p of this._pipes) {
            const steel = p.kind === 'line', px = p.mx * TS + TS / 2, py = p.my * TS + TS / 2, R = (steel ? p.tiles.length + 1 : 3) * TS;
            if (px + R < v.x || px - R > v.right || py + R < v.y || py - R > v.bottom) continue;
            // the mouths' frame again: `a` along the drain direction, `c` across it, in tiles from the mouth's centre
            const pt = (a, c) => ({ x: px + (p.dx * a - p.dy * c) * TS, y: py + (p.dy * a + p.dx * c) * TS });
            const line = (a0, c0, a1, c1) => { const s = pt(a0, c0), e = pt(a1, c1); g.lineBetween(s.x, s.y, e.x, e.y); };
            const W = steel ? 0.2 : 0.12, A0 = 0.44, L = 1.1, sw = Math.sin(time / 170 + p.mx * 3 + p.my) * 0.02;   // a main gushes, a valve pours

            // the stream, narrowing as it falls, lit down one side
            g.fillStyle(0x2d86bd, 0.9); g.fillPoints([pt(A0, -W), pt(L, -W * 0.8 + sw), pt(L, W * 0.8 + sw), pt(A0, W)], true);
            g.fillStyle(0x7fd0f2, 0.75); g.fillPoints([pt(A0, -W * 0.65), pt(L, -W * 0.5 + sw), pt(L, -W * 0.05 + sw), pt(A0, -W * 0.1)], true);
            const n = steel ? 4 : 3;
            g.lineStyle(1, 0xeafcff, 0.9);
            for (let k = 0; k < n; k++) { const a = A0 + fr(time / (steel ? 240 : 360) + k / n) * (L - A0 - 0.12), c = W * (rnd(k + p.mx) * 1.3 - 0.65); line(a, c, a + 0.12, c); }

            // where it lands: rings out over the water (small on a main, to stay in its one-tile channel), and foam
            const land = pt(L, sw), th = Math.atan2(p.dy, p.dx);
            if (this.isWaterAt(p.mx + p.dx, p.my + p.dy)) for (let k = 0; k < 3; k++) {
                const f = fr(time / 1100 + k / 3);
                g.lineStyle(1, 0xbfefff, 0.55 * (1 - f));
                g.beginPath(); g.arc(land.x, land.y, (0.15 + f * (steel ? 0.28 : 1.2)) * TS, th - 1.9, th + 1.9); g.strokePath();
            }
            const b = Math.floor(time / 90);   // the foam re-scatters every few frames
            g.fillStyle(0xf2fdff, 0.85);
            for (let k = 0; k < 5; k++) { const s = pt(L - 0.06 + rnd(b + k * 7.1) * 0.16, sw + (rnd(b * 3 + k) - 0.5) * W * 3); g.fillRect(s.x - 1, s.y - 1, 2, 2); }

            // a main's current: streaks drifting down the channel, stopping where its water does
            if (!steel) continue;
            let run = 0;
            while (run < p.tiles.length && this.isWaterAt(p.mx + p.dx * (run + 1), p.my + p.dy * (run + 1))) run++;
            for (let i = 1; i <= run; i++) for (let k = 0; k < 2; k++) {
                const a = i - 0.5 + fr(time / 520 + k / 2 + rnd(i)), c = (rnd(i * 2 + k) - 0.5) * 0.55;
                if (a < L + 0.1) continue;   // (under the splash)
                g.lineStyle(1, 0xcdf3ff, 0.55 - 0.3 * a / (run + 1));
                line(a, c, Math.min(a + 0.28, run + 0.45), c);
            }
        }
    }

    updatePipes(time) {
        if (!this._pipes || !this._pipes.length) return;
        const C = this._pipeCfg();
        for (const p of this._pipes) {
            if (time - (p.lastRefill || 0) < C.REFILL_MS) continue;
            p.lastRefill = time;
            for (let i = 0; i < p.tiles.length; i++) {
                const t = p.tiles[i];
                if (this.world?.[t.x]?.[t.y] !== this.FLOOR) continue;
                if (this.isWaterAt(t.x, t.y)) continue;
                const k = this._wKey(t.x, t.y);
                if (this.steamTiles?.has(k)) continue;   // fog holds the water off, pipe or not (it washed steam out after 2s once: the Cistern never dried)
                this.addWater(t.x, t.y, 0);
                break;                                     // one tile per tick: it flows
            }
        }
        this._drawPipeWater(time);
    }

    // ── RESISTANCE TRAITS ───────────────────────────────────────────────────
    // Resistance is a trait any enemy can carry (ElementResist: the matching element does
    // 40%), so the same type reads differently from room to room. There are no immune
    // enemies any more: every one that used to be is resistant to the same element.
    _tagResist(enemy, kind) {
        if (!enemy || !kind) return enemy;
        enemy.resistTrait = kind;                      // string or array; see ElementResist
        this._buildResistAura(enemy);
        return enemy;
    }

    // After a level spawns: enough of its untagged enemies get a trait to reach the level's
    // share, so resistance is something you meet everywhere, not a gimmick of one level.
    // Seeded per level and enemy, so a level reads the same way every time you play it.
    // Hand-placed traits count toward the share; the tutorials keep only theirs.
    _spreadResistance() {
        const SHARE = { 1: 0.2, 2: 0.3, 3: 0.35, 4: 0.4, 5: 0.45 };   // (0.15-0.35 till 2026-10-20)
        const i = this.currentLevelIndex ?? 0;
        if (i === 0) return;
        const share = SHARE[i] ?? 0.3;
        const all = (this.enemies || []).filter(e => e?.sprite?.active && !e.isFragment);
        let need = Math.round(all.length * share) - all.filter(e => e.resistTrait).length;
        const pool = all.filter(e => !e.resistTrait);
        const R = MenuArt.rng(9001 + i * 131);
        const KINDS = ['fire', 'ice', 'lightning'];
        while (need-- > 0 && pool.length) {
            const e = pool.splice(Math.floor(R() * pool.length), 1)[0];
            this._tagResist(e, this._rollResist(R, i >= 4));
        }
    }
    // After a level spawns: a few of its enemies block ults in a zone round them (TutorialManager._ultBlockerFx),
    // seeded so a level is the same every time. Not in the first room, not on a boss's room's guards, not on anything
    // already special.
    _spreadUltBlockers() {
        const N = { 2: 1, 3: 2, 4: 2, 5: 3 }[this.currentLevelIndex];
        if (!N || this.towerRun || this.trainingRun) return;
        const bossRooms = new Set(this.enemies.filter(e => e.isBoss).map(e => e.tutorialRoomIndex));
        const pool = this.enemies.filter(e => e?.sprite?.active && !e.isUltAbsorber && !e.ultInhibitor && (e.tutorialRoomIndex ?? 0) > 0 && !bossRooms.has(e.tutorialRoomIndex)
            && !e._isGem && !e._isShade && !e.isFragment && !e._trainImmortal);
        const R = MenuArt.rng(7717 + this.currentLevelIndex * 97), used = new Set();
        for (let k = 0; k < N && pool.length; k++) {
            const fresh = pool.filter(e => !used.has(e.tutorialRoomIndex));   // one a room
            const list = fresh.length ? fresh : pool, e = list[Math.floor(R() * list.length)];
            pool.splice(pool.indexOf(e), 1); used.add(e.tutorialRoomIndex);
            this._ultBlockerFx(e, false);
        }
    }
    // What one resists: one element; now and then two (DOUBLE); rarely, where `deep`, three (TRIPLE)
    _rollResist(R, deep) {
        const K = ['fire', 'ice', 'lightning'], r = R(), DOUBLE = 0.14, TRIPLE = 0.04;
        if (deep && r < TRIPLE) return [...K];
        if (r < (deep ? TRIPLE : 0) + DOUBLE) { const a = Math.floor(R() * 3); return [K[a], K[(a + 1 + Math.floor(R() * 2)) % 3]]; }
        return K[Math.floor(R() * 3)];
    }

    // The ward: a sigil on the ground under the enemy, in the colour of what it resists. A
    // ring of runes turning slowly, three notches of the element's glyph, and one more inner
    // band per extra element (a rare double resistance reads as a harder problem before you
    // swing at it). It sits under the body, so it never hides a telegraph or a status. The
    // resisted hit itself is shown by the shield flash (CombatSystem._showResistShield).
    // Every frame, every level: each resistance ring stays at its enemy's feet and hides with
    // it. (This used to live in the Cistern's update only, so everywhere else the rings stayed
    // where the enemy spawned.)
    _followResistMarks() {
        for (const e of this.enemies || []) {
            const m = e._resistMark;
            if (!m?.active || !e.sprite?.active) continue;
            m.x = e.sprite.x; m.y = e.sprite.y + 20;
            m.setVisible(e.sprite.visible !== false && e.sprite.alpha > 0.15);
        }
    }

    _buildResistAura(enemy) {
        if (!enemy?.sprite) return;
        if (enemy._resistMark?.active) { this.tweens.killTweensOf(enemy._resistMark); enemy._resistMark.destroy(); }
        const sup = enemy._resistSuppressed; enemy._resistSuppressed = false;   // what it resists underneath (grounded, it resists nothing for now, but keeps its ring, grey)
        const traits = (typeof ElementResist !== 'undefined') ? ElementResist.traitsOf(enemy) : [];
        enemy._resistSuppressed = sup;
        if (!traits.length) return;
        const grey = !!enemy._resistSuppressed;   // grounded (the Grounding Spike): the same ring, gone grey
        const COL = grey ? { fire: 0x6e6c72, ice: 0x6e6c72, lightning: 0x6e6c72 } : { fire: 0xff8844, ice: 0x88eeff, lightning: 0xffe14a };
        const base = COL[traits[0]] ?? 0xb388ff, R = 17;
        // drawn flat, then squashed into the floor's perspective; drawn once per look and kept as a texture
        const rkey = 'resist_ring_' + traits.join('_') + (grey ? '_g' : '');
        const ring = this.make.graphics({}, false);
        // one element: the whole ring its colour; two or three: the ring split into halves or thirds, each part
        // in its element's colour with its glyph, so you can read a double resistance at a glance
        const n = traits.length, span = Math.PI * 2 / n;
        const arc = (r, w, a0, a1, col, al) => { ring.lineStyle(w, col, al); ring.beginPath(); ring.arc(0, 0, r, a0, a1); ring.strokePath(); };
        traits.forEach((t, i) => {
            const col = COL[t] ?? 0xb388ff, a0 = i * span - Math.PI / 2, a1 = a0 + span;
            arc(R, 2, a0 + 0.04, a1 - 0.04, col, 0.85);
            arc(R - 4, 1, a0 + 0.04, a1 - 0.04, col, 0.45);
            for (let k = 0; k < 12 / n; k++) {             // rune ticks between the two rings
                const a = a0 + (k + 0.5) / (12 / n) * span, big = k % 4 === 0;
                ring.lineStyle(1.5, col, big ? 1 : 0.5);
                ring.lineBetween(Math.cos(a) * (R - 3), Math.sin(a) * (R - 3), Math.cos(a) * (R - (big ? 0 : 1.5)), Math.sin(a) * (R - (big ? 0 : 1.5)));
            }
            for (let k = 0; k < (n === 1 ? 3 : 1); k++) {  // its glyph on the rim: three for one element, one per part otherwise
                const a = n === 1 ? k / 3 * Math.PI * 2 - Math.PI / 2 : a0 + span / 2, x = Math.cos(a) * R, y = Math.sin(a) * R;
                ring.fillStyle(0x0d0a08, 1); ring.fillCircle(x, y, 3.4);
                ring.fillStyle(col, 1);
                if (t === 'fire') ring.fillTriangle(x - 2, y + 2, x + 2, y + 2, x, y - 3);
                else if (t === 'ice') { ring.fillRect(x - 0.5, y - 2.5, 1, 5); ring.fillRect(x - 2.5, y - 0.5, 5, 1); }
                else ring.fillTriangle(x + 1, y - 3, x - 2, y + 1, x + 1, y + 0.5);
            }
        });
        const ringImg = UIKit.bake(this, ring, -(R + 5), -(R + 5), 2 * (R + 5), 2 * (R + 5), rkey).setOrigin(0.5).setPosition(0, 0);
        const glow = this.add.graphics();
        glow.fillStyle(base, 0.14); glow.fillCircle(0, 0, R + 2);
        // at the feet: the slime fills only the bottom of its frame, ~20px below the sprite's origin
        // just under the slime (it stands in the ring rather than behind a sticker), still above
        // the water (0.4) and the darkness (0.3)
        const c = this.add.container(enemy.sprite.x, enemy.sprite.y + 20, [glow, ringImg]).setDepth(Math.max(0.5, (enemy.sprite.depth ?? 1) - 0.04)).setScale(1, 0.5);
        this.tweens.add({ targets: ringImg, angle: 360, duration: 9000, repeat: -1 });
        this.tweens.add({ targets: glow, alpha: 0.35, duration: 1100, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
        enemy._resistMark = c;
    }

    // ═══════════════════════════════════════════════════════════════════════
    // FLOOR SCALING
    // The player's only power curve is buying better weapons -- the shop sells nothing
    // else and damageLevel never moves -- so difficulty has to come from the enemy side.
    //
    // This deliberately does NOT touch damageScaling. That multiplier is on 65 player
    // weapon sites and 11 enemy ones, so raising it buffs your damage and theirs at the
    // same rate and time-to-kill barely moves. That is why progressToNextFloor() was
    // never wired up: as written it would have done almost nothing.
    //
    // Floor 1 is left at 1.0 so the early game plays exactly as it was tuned; the curve
    // only opens up a gap between the first floor and the last.
    _floorCfg() {
        return {
            HP_STEP:  1.15,   // enemy health, compounding per floor
            DMG_STEP: 1.09,   // enemy damage, gentler -- lethality compounds fast in a
                              // game where most threats are dodgeable telegraphs
        };
    }

    applyFloorScaling() {
        if (this.towerRun) return this.towerScaling();   // Tower.js: its own curve
        if (this.trainingRun) return Training.scale(this);   // Training.js: a Tower floor you pick
        const C = this._floorCfg();
        const floor = Math.max(0, (this.currentLevelIndex ?? 0));
        const steps = Math.max(0, floor - 1);          // tutorial and floor 1 stay at 1.0
        this.enemyHealthScale = Math.pow(C.HP_STEP,  steps);
        this.enemyDamageScale = Math.pow(C.DMG_STEP, steps);
        return { floor, hp: this.enemyHealthScale, dmg: this.enemyDamageScale };
    }

    _waterCfg() {
        return {
            HP:          6,      // evaporation points per tile
            STEAM_MS:    15000,  // how long a dried tile stays fog and refuses water (pipes included)
            SLOW_MULT:   1.2,    // player move cooldown multiplier while the soak lasts
            SLOW_MS:     1500,   // how long a step in water keeps slowing you
            ICE_MULT:    0.7,    // ...unless holding ice, which is FASTER than dry land
            LIGHTNING_WET_BONUS: 1.5,   // damage multiplier vs a wet enemy
        };
    }

    initWater() {
        this.waterTiles = new Map();     // 'x,y' -> { tx, ty, hp, until }   until 0 = permanent
        this.steamTiles = new Map();     // 'x,y' -> expiry timestamp
        this._waterDirty = true;
        this._waterSlow = false; this._waterSettleAt = 0;   // (the scene outlives a restart)
        this._fogImgs = new Map();
        // TWO layers, matching the shatter puddle: a 0x0055aa base with a brighter
        // 0x3388cc inset shimmer breathing over it.
        //
        // The shimmer is ONE graphics object for the whole map with ONE tween on its
        // layer alpha, not a tween per tile. A puddle does that per-tile because there
        // are a handful of them; a flooded level has several hundred, and several hundred
        // yoyo tweens is a frame-rate problem for an effect nobody can tell apart from
        // this. Drawn at 0.6 and breathed between 0.67 and 1.0 layer alpha, which lands
        // on the same 0.4-0.6 the shatter puddles use.
        if (!this._waterGfx || !this._waterGfx.active) {
            // Below lava (0.5) so a fire trail laid over water reads as being on top.
            this._waterGfx = this.add.graphics().setDepth(0.4);
        }
        if (!this._waterShimmerGfx || !this._waterShimmerGfx.active) {
            this._waterShimmerGfx = this.add.graphics().setDepth(0.45);
            this._waterShimmerGfx.setAlpha(0.67);
            this.tweens.add({ targets: this._waterShimmerGfx, alpha: 1,
                              duration: 900, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
        }
    }

    _wKey(tx, ty) { return tx + ',' + ty; }

    isWaterAt(tx, ty) { return !!(this.waterTiles && this.waterTiles.has(this._wKey(tx, ty))); }
    isSteamAt(tx, ty) { return !!(this.steamTiles && this.steamTiles.has(this._wKey(tx, ty))); }

    // lifetimeMs 0/undefined = permanent until evaporated.
    addWater(tx, ty, lifetimeMs) {
        if (!this.waterTiles) this.initWater();
        if (!this.world?.[tx] || this.world[tx][ty] !== this.FLOOR) return false;
        if (this.isSteamAt(tx, ty)) return false;        // steam refuses water
        const C = this._waterCfg();
        const k = this._wKey(tx, ty);
        const now = this.time.now;
        const until = lifetimeMs ? now + lifetimeMs : 0;
        const ex = this.waterTiles.get(k);
        if (ex) {
            ex.hp = C.HP;                                 // refreshed to full
            // A permanent tile stays permanent; a timed one takes the LONGER deadline so
            // two overlapping lanes do not cut each other short.
            if (ex.until && until) ex.until = Math.max(ex.until, until);
            else ex.until = 0;
        } else {
            this.waterTiles.set(k, { tx, ty, hp: C.HP, until });
            if (!this._waterPatch?.(tx, ty, 'water')) this._waterDirty = true;   // a new tile patched into the baked water (a pipe refilling, a wave)
        }
        return true;
    }

    // Fire chipping a tile. `power` is how much of the tile's HP this hit removes, which
    // is what makes each fire weapon feel different on this terrain.
    evaporateWater(tx, ty, power) {
        if (!this.waterTiles) return false;
        const k = this._wKey(tx, ty);
        const t = this.waterTiles.get(k);
        if (!t) return false;
        t.hp -= (power || 1);
        if (t.hp > 0) return false;   // (not dirty: a chip changes nothing drawn, and a redraw re-bakes the whole map's water; the flamethrower chips dozens a tick)
        this.waterTiles.delete(k);
        this.steamTiles.set(k, this.time.now + this._waterCfg().STEAM_MS);
        if (!this._waterPatch?.(tx, ty, null)) this._waterDirty = true;   // the water wiped from the bake (a full redraw took ~400ms in the Cistern)
        this._fogOn(tx, ty);
        return true;
    }

    // A fog tile's smoke (Visuals.js paints and drifts it); and gone again
    _fogOn(tx, ty) {
        const k = tx + ',' + ty, T = this.TILE_SIZE, M = this._fogImgs ||= new Map();
        if (M.get(k)?.active || !this._vfxFogTile) return;
        const img = this._vfxFogTile(tx * T + T / 2, ty * T + T / 2);
        img._fx = img.x; img._fy = img.y;
        M.set(k, img);
    }
    _fogOff(k) {
        const img = this._fogImgs?.get(k);
        if (img?.active) img.destroy();
        this._fogImgs?.delete(k);
    }
    _steamPuff(tx, ty) {
        const now = this.time.now;   // a few at a time: the flamethrower or a meteor dries a field at once, and a puff each was hundreds of objects
        if (now - (this._puffWin || 0) > 150) { this._puffWin = now; this._puffN = 0; }
        if (++this._puffN > 6) return;
        if (this._vfxSteamPuff?.(tx, ty)) return;   // Visuals.js: vapour, droplets, a ring
        const TS = this.TILE_SIZE;
        const px = tx * TS + TS / 2, py = ty * TS + TS / 2;
        for (let i = 0; i < 3; i++) {
            const p = this.add.circle(px + (Math.random() - 0.5) * 14, py + (Math.random() - 0.5) * 14,
                                      3 + Math.random() * 3, 0xdfe9ee, 0.55).setDepth(3);
            this.tweens.add({ targets: p, y: p.y - 18 - Math.random() * 12, alpha: 0,
                              scaleX: 1.8, scaleY: 1.8, duration: 420 + Math.random() * 260,
                              ease: 'Quad.easeOut', onComplete: () => p.destroy() });
        }
    }

    // ── LIGHTNING CONDUCTION ─────────────────────────────────────────────────
    // Lightning's identity is crowds: strong as a room fills up, weak against one target.
    // On dry ground that only ever came from chain hops, which reach a handful of tiles.
    // The Cistern is the floor where the identity can finally pay off, because water
    // conducts: a bolt landing in a puddle does not care how far apart the enemies
    // standing in it are, only that they share the puddle.
    //
    // Deliberately a flood fill and NOT a radius check. A radius would make the mechanic
    // about the bolt; a flood fill makes it about the room, so a long pipe-fed channel
    // conducts down its whole length while two puddles one tile apart stay independent.
    // That turns the water layout into something the player reads and plays around, which
    // is the whole reason the pipes exist.
    _energizeCfg() {
        return {
            MAX_TILES:    30,      // flood cap -- past this, one lake is a room-wipe button
            SHARE:        0.60,    // each enemy in the pool takes this much of the trigger
            RETRIGGER_MS: 400,     // per-pool guard, else a fast weapon energises every frame
            ARC:          0x9fe8ff
        };
    }

    // Flood fill the connected body of water containing (tx, ty), capped at `cap` tiles.
    // Extracted from _energizePool because Ball Lightning's cascade needs the same question
    // answered -- "which tiles share this puddle" -- and two copies of a flood fill is how one
    // of them ends up with a different connectivity rule than the other.
    _poolTilesAt(tx, ty, cap = 30) {
        if (!this.waterTiles || !this.isWaterAt(tx, ty)) return new Set();
        const pool = new Set([this._wKey(tx, ty)]);
        const queue = [[tx, ty]];
        while (queue.length && pool.size < cap) {
            const [cx, cy] = queue.shift();
            for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
                const nx = cx + dx, ny = cy + dy;
                const k = this._wKey(nx, ny);
                if (pool.has(k) || !this.isWaterAt(nx, ny)) continue;
                pool.add(k);
                if (pool.size >= cap) break;
                queue.push([nx, ny]);
            }
        }
        return pool;
    }

    // Every live enemy standing in the same pool as (tx, ty). This is what lets a fork relay
    // along a flooded lane instead of only to its physical neighbours.
    enemiesSharingPool(tx, ty, cap = 40) {
        const pool = this._poolTilesAt(tx, ty, cap);
        if (!pool.size) return [];
        const out = [];
        for (const e of (this.enemies || [])) {
            if (!e.sprite?.active) continue;
            if (typeof this._phasedOut === 'function' && this._phasedOut(e)) continue;
            if (pool.has(this._wKey(e.x, e.y))) out.push(e);
        }
        return out;
    }

    // Returns how many enemies were damaged so callers can decide whether to bother with
    // extra feedback. Safe to call on a dry tile -- returns 0.
    _energizePool(tx, ty, triggerDamage, element = 'lightning') {
        if (!this.waterTiles || !this.isWaterAt(tx, ty)) return 0;
        const C = this._energizeCfg();
        const now = this.time.now;

        const pool = this._poolTilesAt(tx, ty, C.MAX_TILES);

        // One cooldown for the whole pool, stamped on every tile in it. Stamping only the
        // tile that was struck would let a second bolt two tiles over re-energise the same
        // body of water on the next frame.
        const origin = this.waterTiles.get(this._wKey(tx, ty));
        if (origin && now - (origin.lastEnergized ?? -1e9) < C.RETRIGGER_MS) return 0;
        for (const k of pool) {
            const t = this.waterTiles.get(k);
            if (t) t.lastEnergized = now;
        }

        // ── damage everything standing in it ────────────────────────────────────
        // Routed through resolveElementalHit, so a lightning-resistant enemy standing in
        // an energised pool is resisted here exactly as it would be on a direct hit --
        // conduction is not a loophole around the resistance table.
        const share = triggerDamage * C.SHARE;
        let hits = 0;
        for (const enemy of [...this.enemies]) {
            if (!enemy.sprite?.active) continue;
            if (!pool.has(this._wKey(enemy.x, enemy.y))) continue;
            if (typeof this._phasedOut === 'function' && this._phasedOut(enemy)) continue;
            // Named _rd* on purpose: the resistance check scans for `.health -=` lines whose
            // value did not come out of resolveElementalHit, and that is the guard which
            // catches a new damage path bypassing the resistance table. A local called
            // `dealt` reads better and trips it, so the convention wins.
            const _rdPool = this.resolveElementalHit(enemy, share, element);
            if (_rdPool === null) continue;
            enemy.health -= _rdPool;
            this.showDamageNumber(enemy.sprite.x, enemy.sprite.y - 10, Math.round(_rdPool), '#9fe8ff');
            this.updateEnemyHealthBar(enemy);
            hits++;
            if (enemy.health <= 0) this.killEnemy(enemy);
        }
        this._energizeFlash(pool, C);
        return hits;
    }

    _energizeFlash(pool, C) {
        const T = this.TILE_SIZE;
        const g = this.add.graphics().setDepth(2.6);
        g.fillStyle(C.ARC, 0.38);
        const pts = [];
        for (const k of pool) {
            const c = k.split(','), tx = +c[0], ty = +c[1];
            g.fillRect(tx * T, ty * T, T, T);
            pts.push({ x: tx * T + T / 2, y: ty * T + T / 2 });
        }
        // Jagged arcs struck across the pool rather than a per-tile twinkle, so it reads
        // as one current running through a single body of water.
        g.lineStyle(1.4, 0xffffff, 0.85);
        for (let i = 0; i < Math.min(6, pts.length); i++) {
            const a = pts[(i * 7) % pts.length], b = pts[(i * 13 + 3) % pts.length];
            const mx = (a.x + b.x) / 2 + (Math.random() - 0.5) * 10;
            const my = (a.y + b.y) / 2 + (Math.random() - 0.5) * 10;
            g.beginPath(); g.moveTo(a.x, a.y); g.lineTo(mx, my); g.lineTo(b.x, b.y); g.strokePath();
        }
        this.tweens.add({ targets: g, alpha: 0, duration: 260, ease: 'Quad.easeOut',
                          onComplete: () => g.destroy() });
    }

    updateWater(time) {
        if (!this.waterTiles) return;
        let dirty = false;
        for (const [k, t] of this.waterTiles) {
            if (t.until && time >= t.until) { this.waterTiles.delete(k); if (!this._waterPatch?.(t.tx, t.ty, null)) dirty = true; }
        }
        for (const [k, exp] of this.steamTiles) {
            if (time < exp) continue;
            this.steamTiles.delete(k); this._fogOff(k);
            const c = k.indexOf(',');
            if (!this._waterPatch?.(+k.slice(0, c), +k.slice(c + 1), null)) dirty = true;   // fog clearing: the tile's patch wiped, not a redraw
        }
        if (dirty) this._waterDirty = true;
        // patches are plain squares: once they stop coming, a full redraw gives the pools their edges back (unless redraws are slow here)
        if (this._waterSettleAt && time >= this._waterSettleAt) { this._waterSettleAt = 0; if (!this._waterSlow) this._waterDirty = true; }
        // a full redraw re-bakes the whole map's water (~400ms in the Cistern): at most every WATER_REDRAW_MS, whatever asks
        if (this._waterDirty && time - (this._waterDrawnAt || -1e9) >= 400) {
            const t0 = performance.now();
            this._waterBakeMade = false;
            this._redrawWater(); this._waterDirty = false; this._waterDrawnAt = time;
            if (!this._waterBakeMade && performance.now() - t0 > 150) this._waterSlow = true;   // a big map (the Cistern took ~400ms): keep to patches from here on
        }
    }

    // One tile changed in the baked water (_bakeWater): wiped, then painted as `kind` ('fog', 'water', or null for bare floor).
    // False if there's no bake to patch (then the caller asks for a full redraw). A patched water tile is plain water, without
    // the lips and foam a full redraw gives pool edges: close enough, and it keeps the full redraw for the level's first draw.
    // Painted on the bake's canvas, and only that tile's square sent to the GPU.
    _waterPatch(tx, ty, kind) {
        const B = this._waterBaked, T = this.TILE_SIZE;
        if (!B?.base?.tex || !B.base.img?.visible || B.px == null) return false;
        const x = tx * T - B.px, y = ty * T - B.py;
        if (x < 0 || y < 0 || x + T > B.base.w || y + T > B.base.h) return false;
        const rgba = (c, a) => `rgba(${c >> 16 & 255},${c >> 8 & 255},${c & 255},${a})`;
        const paint = (b, col, a, px, py, w, h) => { b.tex.context.fillStyle = rgba(col, a); b.tex.context.fillRect(px, py, w, h); };
        for (const b of [B.base, B.shimmer]) b?.tex?.context.clearRect(x, y, T, T);
        if (kind === 'fog') {   // fog's damp stone, as _vfxDrawWater paints it
            paint(B.base, 0x06080b, 0.34, x, y, T, T);
            paint(B.base, 0xd7e6ec, 0.09, x + 2, y + 2, T - 4, T - 4);
        } else if (kind === 'water') {
            paint(B.base, 0x0f4573, 0.88, x, y, T, T);
            const h = ((tx * 73856093) ^ (ty * 19349663)) >>> 0;   // a glint, as the shimmer layer has
            if (B.shimmer?.tex) paint(B.shimmer, 0xa8e4ff, 0.6, x + 2 + h % (T - 8), y + 3 + (h >>> 5) % (T - 6), 4, 1);
        }
        for (const b of [B.base, B.shimmer]) if (b?.tex) (b.dirty ||= []).push([x, y]);
        if (!B.flushQueued) { B.flushQueued = true; this.events.once('prerender', () => this._waterFlush()); }   // uploaded once, before the frame draws
        this._waterSettleAt = this.time.now + 900;   // tidy up with a full redraw once things go quiet (updateWater)
        return true;
    }
    // The tiles patched since the last frame, sent up: each tile's square, or the whole bake once if a lot changed
    // (a level filling its pools at the start patches a thousand tiles in one go)
    _waterFlush() {
        const B = this._waterBaked, T = this.TILE_SIZE;
        if (!B) return;
        B.flushQueued = false;
        for (const b of [B.base, B.shimmer]) {
            if (!b?.tex || !b.dirty?.length) continue;
            if (b.dirty.length > 40) b.tex.refresh();
            else for (const [x, y] of b.dirty) this._texPatchUpload(b.tex, x, y, T, T);
            b.dirty = [];
        }
    }
    // Send one rectangle of a canvas texture to the GPU (texSubImage2D), as Phaser's own full upload does it but a tile's
    // worth instead of the whole 3000px bake.
    _texPatchUpload(tex, x, y, w, h) {
        const R = this.game.renderer, gl = R?.gl, glt = tex.source?.[0]?.glTexture;
        if (!gl || !glt) { tex.refresh(); return; }
        R.flush?.();   // anything already batched drew with the old pixels
        const img = tex.context.getImageData(x, y, w, h);
        gl.activeTexture(gl.TEXTURE0);
        const was = gl.getParameter(gl.TEXTURE_BINDING_2D);
        gl.bindTexture(gl.TEXTURE_2D, glt);
        gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, true);
        gl.texSubImage2D(gl.TEXTURE_2D, 0, x, y, gl.RGBA, gl.UNSIGNED_BYTE, img);
        if (was) gl.bindTexture(gl.TEXTURE_2D, was);
    }

    // Perimeter-only stroking: an edge is drawn where a wet tile borders a dry one, so a
    // 3x3 pool is 12 edges rather than 36. Drawing every tile's full outline is what made
    // the tower-defense water read as a grid of squares instead of a body of liquid.
    _redrawWater() {
        const g = this._waterGfx, sh = this._waterShimmerGfx;
        if (!g || !g.active) return;
        if (this._vfxDrawWater) { this._vfxDrawWater(g, sh, [...this.waterTiles.values()], this.steamTiles); this._bakeWater?.(); return; }
        const T = this.TILE_SIZE;
        g.clear();
        if (sh?.active) sh.clear();

        // Copied from _shatterWaterSplash in WeaponSystem -- the puddle an enemy leaves
        // when it shatters. That is the look being matched, NOT the tsunami's flash-freeze
        // ice overlay, which is a different effect that happens to also be blue.
        //   base    0x0055aa @ 0.65, full tile
        //   shimmer 0x3388cc, inset 4px, breathing between 0.4 and 0.6
        // No outline and no cracks: the splash has neither.
        g.fillStyle(0x0055aa, 0.65);
        for (const t of this.waterTiles.values()) g.fillRect(t.tx * T, t.ty * T, T, T);

        if (sh?.active) {
            // Drawn at 0.6; the layer tween below rides 0.67 -> 1.0 on top of it, which
            // lands on the 0.4 -> 0.6 the splash shimmer actually uses.
            sh.fillStyle(0x3388cc, 0.6);
            for (const t of this.waterTiles.values()) sh.fillRect(t.tx * T + 2, t.ty * T + 2, T - 4, T - 4);
        }

        g.fillStyle(0x7d6a5c, 0.16);
        for (const k of this.steamTiles.keys()) {
            const [sx, sy] = k.split(',').map(Number);
            g.fillRect(sx * T + 2, sy * T + 2, T - 4, T - 4);
        }
        this._bakeWater?.();
    }

    // The water as two images, not two Graphics. A Graphics is re-tessellated every frame it's drawn, and a flooded
    // level's water is ~90k commands (the Cistern: 1600 tiles, half its frame time). Redrawn only when the water changes,
    // so it's painted into a texture each time it does and the Graphics are hidden. Painted on the CPU into a canvas
    // (Graphics.generateTexture) and uploaded, not drawn on the GPU into a DynamicTexture: making a 3000px render target
    // stalled the GPU for seconds as the Cistern loaded. The shimmer's breathing tween moves
    // to its image. Falls back to the Graphics where there's no DynamicTexture or the water's bounds won't fit one.
    _bakeWater() {
        const g = this._waterGfx, sh = this._waterShimmerGfx, T = this.TILE_SIZE, TX = this.textures;
        if (!g?.active || !TX.createCanvas || !g.generateTexture) return;
        let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
        for (const t of this.waterTiles?.values() || []) { x0 = Math.min(x0, t.tx); y0 = Math.min(y0, t.ty); x1 = Math.max(x1, t.tx); y1 = Math.max(y1, t.ty); }
        for (const k of this.steamTiles?.keys() || []) { const [sx, sy] = k.split(',').map(Number); x0 = Math.min(x0, sx); y0 = Math.min(y0, sy); x1 = Math.max(x1, sx); y1 = Math.max(y1, sy); }
        const B = this._waterBaked ||= {};
        if (!(x1 >= x0)) { for (const k in B) B[k].img?.setVisible(false); g.setVisible(true); sh?.setVisible(true); return; }   // no water: nothing to show
        let px = (x0 - 1) * T, py = (y0 - 1) * T, w = (x1 - x0 + 3) * T, h = (y1 - y0 + 3) * T;
        // the bake is kept while the water still fits in it (making one is the cost, ~100ms; drawing into it is nothing);
        // outgrown, the new one takes in the old and PAD tiles more each way, so it's rarely outgrown again
        const o = B.base, PAD = 6 * T;
        if (o?.img?.active && B.px <= px && B.py <= py && B.px + o.w >= px + w && B.py + o.h >= py + h) { px = B.px; py = B.py; w = o.w; h = o.h; }
        else {
            const ax = Math.min(px, o?.img?.active ? B.px : px) - PAD, ay = Math.min(py, o?.img?.active ? B.py : py) - PAD;
            const bx = Math.max(px + w, o?.img?.active ? B.px + o.w : 0) + PAD, by = Math.max(py + h, o?.img?.active ? B.py + o.h : 0) + PAD;
            px = Math.max(0, ax); py = Math.max(0, ay); w = Math.min(this.WORLD_WIDTH * T, bx) - px; h = Math.min(this.WORLD_HEIGHT * T, by) - py;
        }
        B.px = px; B.py = py;   // (_waterPatch works in its space)
        if (w > 4096 || h > 4096) { for (const k in B) B[k].img?.setVisible(false); g.setVisible(true); sh?.setVisible(true); return; }
        for (const [name, gfx] of [['base', g], ['shimmer', sh]]) {
            if (!gfx?.active) continue;
            let b = B[name];
            if (!b || !b.img?.active || b.w !== w || b.h !== h) {   // (re)made at the water's size
                b?.img?.destroy(); if (b?.key) TX.remove(b.key);
                const key = 'water_baked_' + name + '_' + (this._waterBakeN = (this._waterBakeN || 0) + 1);
                const cv = document.createElement('canvas'); cv.width = w; cv.height = h;
                cv.getContext('2d', { willReadFrequently: true });   // kept on the CPU: a patch reads its tile back, and a GPU canvas stalls on every read
                const tex = TX.addCanvas(key, cv);
                const img = this.add.image(px, py, key).setOrigin(0).setDepth(gfx.depth);
                if (name === 'shimmer') { img.setAlpha(0.67); this.tweens.killTweensOf(gfx); this.tweens.add({ targets: img, alpha: 1, duration: 900, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' }); }
                b = B[name] = { key, tex, img, w, h };
                this._waterBakeMade = true;   // (a made bake is the slow part, and doesn't count against redrawing: updateWater)
            }
            const a = gfx.alpha, sf = [gfx.scrollFactorX, gfx.scrollFactorY], pos = [gfx.x, gfx.y];
            b.tex.context.clearRect(0, 0, w, h);
            gfx.setAlpha(1).setVisible(true).setScrollFactor(0).setPosition(gfx.x - px, gfx.y - py);   // (the texture's camera scrolls with the Graphics unless it ignores scroll: so shift it back by the corner)
            gfx.generateTexture(b.key, w, h);   // paints into the canvas and uploads it
            b.dirty = [];
            gfx.setAlpha(a).setVisible(false).setScrollFactor(...sf).setPosition(...pos);
            b.img.setPosition(px, py).setDepth(gfx.depth).setVisible(true);
        }
    }

    // Blobs, not noise. Seeds are placed inside room rectangles only and grown outward, so
    // coverage lands as pools you can path around rather than a uniform sprinkle.
    // `byRoom` lets a level ramp: dry early rooms, swamped late ones.
    generateWaterBlobs(byRoom) {
        this.initWater();
        const rooms = this.rooms || [];
        for (let ri = 0; ri < rooms.length; ri++) {
            const cov = typeof byRoom === 'function' ? byRoom(ri) : (byRoom || 0);
            if (cov <= 0) continue;
            const r = rooms[ri];
            const area = r.w * r.h;
            const target = Math.floor(area * cov);
            let placed = 0, guard = 0;
            while (placed < target && guard++ < target * 12) {
                // Seed, then grow a blob of random size from it.
                let cx = r.x + Math.floor(Math.random() * r.w);
                let cy = r.y + Math.floor(Math.random() * r.h);
                const blob = 6 + Math.floor(Math.random() * 18);
                const frontier = [[cx, cy]];
                let n = 0;
                while (frontier.length && n < blob && placed < target) {
                    const [bx, by] = frontier.splice(Math.floor(Math.random() * frontier.length), 1)[0];
                    if (bx < r.x || bx >= r.x + r.w || by < r.y || by >= r.y + r.h) continue;
                    if (this.isWaterAt(bx, by)) continue;
                    if (!this.addWater(bx, by, 0)) continue;
                    placed++; n++;
                    frontier.push([bx + 1, by], [bx - 1, by], [bx, by + 1], [bx, by - 1]);
                }
            }
        }
        this._redrawWater();
    }

    // Movement multiplier for the player's own move cooldown. Ice is the only element that
    // comes out AHEAD on water — everything else is merely slowed, and cosmic is neutral,
    // which is the shape of cosmic everywhere else too.
    // Stepping in water SOAKS you for SLOW_MS. It is not a tax on standing in it.
    // The old version multiplied every step taken while on a wet tile, and at 30-46%
    // coverage that meant you were slowed nearly all the time -- which reads as the
    // level lowering your base speed rather than the water doing something to you.
    _onPlayerStepWater(tx, ty, time) {
        // Dripping first: the tile you just stepped onto becomes permanent water, and
        // then the soak check below sees it, so moving while dripping compounds.
        const now = time ?? this.time.now;
        if (this._drippingUntil && now < this._drippingUntil
            && this.world?.[tx]?.[ty] === this.FLOOR) {
            this.addWater(tx, ty, 0);
        }
        if (!this.waterTiles || !this.waterTiles.size) return;
        if (!this.isWaterAt(tx, ty)) return;
        Sfx.play(this, 'splash', { soft: true });   // a step in it
        if (this.currentElement === 'ice' || this.currentElement === 'cosmic') return;
        this._waterSlowUntil = (time ?? this.time.now) + this._waterCfg().SLOW_MS;
    }

    playerWaterMult() {
        if (!this.waterTiles || !this.waterTiles.size) return 1;
        const C = this._waterCfg();
        // Ice still glides, but only while actually on the surface.
        if (this.currentElement === 'ice')
            return this.isWaterAt(this.playerX, this.playerY) ? C.ICE_MULT : 1;
        if (this.currentElement === 'cosmic') return 1;
        const now = this.time?.now ?? 0;
        return (this._waterSlowUntil && now < this._waterSlowUntil) ? C.SLOW_MULT : 1;
    }

    getCurrentPlayerRoom() {
        for (let i = 0; i < this.rooms.length; i++) {
            const room = this.rooms[i];
            if (this.playerX >= room.x && this.playerX < room.x + room.w &&
                this.playerY >= room.y && this.playerY < room.y + room.h) {
                return i;
            }
        }
        return -1;
    }

    // Does this level seal rooms until you enter them? One list, so the weapon gate,
    // the damage gate and the enemy AI gate cannot drift apart -- they were three
    // separately-maintained conditions and damageEnemy's only checked isTutorial, which
    // is why projectiles could kill things in rooms you had never opened.
    _roomGated() {
        return !!(this.isTutorial || this.isLevel2 || this.isLevel3 || this.isLevel4 || this.isLevel6);
    }

    isInCurrentRoom(tx, ty) {
        if (!this._roomGated()) return true;
        const ri = this.getCurrentPlayerRoom();
        if (ri < 0) return false;
        const r = this.rooms[ri];
        return tx >= r.x && tx < r.x + r.w && ty >= r.y && ty < r.y + r.h;
    }

    isInLockedRoom(tileX, tileY) {
        if (this._csOutsideDomain?.(tileX, tileY)) return true;   // a cosmic domain's walls are real while it stands
        if (!this._roomGated() || !this.tutorialDoorsLocked) return false;
        for (let i = 0; i < this.rooms.length; i++) {
            if (!this.tutorialDoorsLocked[i]) continue;
            const room = this.rooms[i];
            if (tileX >= room.x && tileX < room.x + room.w &&
                tileY >= room.y && tileY < room.y + room.h) {
                // Only block if player is NOT in this room
                const playerRoom = this.getCurrentPlayerRoom();
                if (playerRoom !== i) return true;
            }
        }
        return false;
    }

    lockTutorialDoors(roomIndex) {
        const room = this.rooms[roomIndex];
        if (!room || !room.doorPositions) return;
        if (!this.lockedDoorTiles) this.lockedDoorTiles = [];
        if (!this.lockedDoorSprites) this.lockedDoorSprites = [];

        for (let door of room.doorPositions) {
            let sealTiles = [];

            if (door.direction === 'east') {
                const ex = room.x + room.w - 1;
                for (let ty = room.y; ty < room.y + room.h; ty++) sealTiles.push({ x: ex, y: ty });
            } else if (door.direction === 'west') {
                const wx = room.x;
                for (let ty = room.y; ty < room.y + room.h; ty++) sealTiles.push({ x: wx, y: ty });
            } else if (door.direction === 'north') {
                const ny = room.y;
                for (let tx = room.x; tx < room.x + room.w; tx++) sealTiles.push({ x: tx, y: ny });
            } else if (door.direction === 'south') {
                const sy = room.y + room.h - 1;
                for (let tx = room.x; tx < room.x + room.w; tx++) sealTiles.push({ x: tx, y: sy });
            }

            // only the doorway, and in the gap itself: for each edge tile with open floor beyond it, the tile
            // beyond (the one between the wall's ends), so the gate sits in the doorway, not in front of it
            const [ox, oy] = { east: [1, 0], west: [-1, 0], north: [0, -1], south: [0, 1] }[door.direction] || [0, 0];
            sealTiles = sealTiles.filter(t => this.world[t.x + ox]?.[t.y + oy] === this.FLOOR).map(t => ({ x: t.x + ox, y: t.y + oy }));
            for (let { x: tx, y: ty } of sealTiles) {
                if (!this.world[tx] || this.world[tx][ty] !== this.FLOOR) continue;
                this.world[tx][ty] = this.WALL;
                this.lockedDoorTiles.push({ x: tx, y: ty, roomIndex });
                const px = tx * this.TILE_SIZE + this.TILE_SIZE / 2;
                const py = ty * this.TILE_SIZE + this.TILE_SIZE / 2;
                const bar = this._vfxWard ? this._vfxWard(px, py, door.direction === 'east' || door.direction === 'west')
                    : this.add.rectangle(px, py, this.TILE_SIZE, this.TILE_SIZE, 0xff2200, 0.55).setDepth(0.9);
                this.tweens.add({ targets: bar, alpha: this._vfxWard ? 0.55 : 0.3, duration: 700, yoyo: true, repeat: -1 });
                this.lockedDoorSprites.push({ sprite: bar, roomIndex });
            }

            // If player is on a sealed tile, nudge them 2 tiles inward
            const onSeal = sealTiles.some(t => t.x === this.playerX && t.y === this.playerY);
            if (onSeal) {
                let nx = 0, ny = 0;
                if (door.direction === 'east')  nx = -2;
                if (door.direction === 'west')  nx =  2;
                if (door.direction === 'north') ny =  2;
                if (door.direction === 'south') ny = -2;
                const tx2 = this.playerX + nx;
                const ty2 = this.playerY + ny;
                const clampedX = Math.max(room.x + 1, Math.min(room.x + room.w - 2, tx2));
                const clampedY = Math.max(room.y + 1, Math.min(room.y + room.h - 2, ty2));
                this.playerX = clampedX;
                this.playerY = clampedY;
                const wx = clampedX * this.TILE_SIZE + this.TILE_SIZE / 2;
                const wy = clampedY * this.TILE_SIZE + this.TILE_SIZE / 2 + this.SLIME_Y_OFFSET;
                this.tweens.killTweensOf(this.player);
                this.tweens.add({ targets: this.player, x: wx, y: wy, duration: 120, ease: 'Power2' });
            }
        }

        // Also seal corridor entrances to chest rooms branching off this combat room
        if (this.isLevel2 && this.rooms) {
            const combatRooms = this.rooms.filter(r => !r.isChestRoom);
            const combatIdx = combatRooms.indexOf(room);
            const tagMap = ['r0','r1','r2','r3','r4','r5','boss'];
            const tag = tagMap[combatIdx] || null;
            if (tag) {
                for (const cr of this.rooms) {
                    if (!cr.isChestRoom || cr.parentTag !== tag) continue;
                    if (!cr.entranceTiles) continue;
                    for (const { x: tx, y: ty } of cr.entranceTiles) {
                        if (!this.world[tx] || this.world[tx][ty] !== this.FLOOR) continue;
                        this.world[tx][ty] = this.WALL;
                        this.lockedDoorTiles.push({ x: tx, y: ty, roomIndex });
                        const px = tx * this.TILE_SIZE + this.TILE_SIZE / 2;
                        const py = ty * this.TILE_SIZE + this.TILE_SIZE / 2;
                        const bar = this._vfxWard ? this._vfxWard(px, py)
                            : this.add.rectangle(px, py, this.TILE_SIZE, this.TILE_SIZE, 0xff2200, 0.55).setDepth(0.9);
                        this.tweens.add({ targets: bar, alpha: this._vfxWard ? 0.55 : 0.3, duration: 700, yoyo: true, repeat: -1 });
                        this.lockedDoorSprites.push({ sprite: bar, roomIndex });
                    }
                }
            }
        }
    }

    unlockTutorialDoors(roomIndex) {
        if (!this.lockedDoorTiles) return;
        if (this.lockedDoorTiles.some(t => t.roomIndex === roomIndex)) Sfx.play(this, 'clear');

        // Remove wall tiles
        for (let i = this.lockedDoorTiles.length - 1; i >= 0; i--) {
            const tile = this.lockedDoorTiles[i];
            if (tile.roomIndex === roomIndex) {
                this.world[tile.x][tile.y] = this.FLOOR;
                this.lockedDoorTiles.splice(i, 1);
            }
        }

        // Remove visual sprites
        if (this.lockedDoorSprites) {
            for (let i = this.lockedDoorSprites.length - 1; i >= 0; i--) {
                const doorSprite = this.lockedDoorSprites[i];
                if (doorSprite.roomIndex === roomIndex) {
                    doorSprite.sprite.destroy();
                    this.lockedDoorSprites.splice(i, 1);
                }
            }
        }
    }

    // ─── ENEMY SPAWN DISPATCH ───────────────────────────────────────────────

    spawnEnemies() {
        if (this.towerRun || this.trainingRun) return;   // Tower.js: the floor comes in waves; Training.js: you spawn them
        // Tutorial level has custom enemy placement
        if (this.currentLevelIndex === 0) {
            if (this.isIceTutorial) {
                this.spawnIceTutorialEnemies();
            } else {
                this.spawnTutorialEnemies();
            }
            return;
        } else if (this.currentLevelIndex === 1) {
            this.spawnLevel1Enemies();
            return;
        } else if (this.currentLevelIndex === 2) {
            this.spawnLevel2Enemies();
            this._unstick();
            return;
        } else if (this.currentLevelIndex === 3) {
            this.spawnLevel3Enemies();
            this._unstick();
            return;
        } else if (this.currentLevelIndex === 4) {
            this.spawnLevel4Enemies();
            this._unstick();
            return;
        } else if (this.currentLevelIndex === 5) {
            this.spawnLevel6Enemies();
            this._unstick();
            return;
        }

        // Fixed enemy range per run: 3–5 enemies per room, skip player's starting room
        const minPerRoom = 3;
        const maxPerRoom = 5;
        const rooms = this.rooms || [];

        for (let i = 0; i < rooms.length; i++) {
            const room = rooms[i];
            const cx = Math.floor(room.x + room.w / 2);
            const cy = Math.floor(room.y + room.h / 2);

            // Skip the room the player starts in
            const distToPlayer = Math.abs(cx - this.playerX) + Math.abs(cy - this.playerY);
            if (distToPlayer < 8) continue;

            const count = minPerRoom + Math.floor(this.rng() * (maxPerRoom - minPerRoom + 1));
            let spawned = 0;
            let attempts = 0;

            while (spawned < count && attempts < 100) {
                attempts++;
                const x = room.x + 1 + Math.floor(this.rng() * (room.w - 2));
                const y = room.y + 1 + Math.floor(this.rng() * (room.h - 2));

                if (this.world[x][y] === this.FLOOR && !this.getEnemyAt(x, y)) {
                    this.createEnemy(x, y);
                    spawned++;
                }
            }
        }
    }

    spawnLevel1Enemies() {
        // Starting room: No enemies

        // Hub room (T-junction): 2 enemies to introduce threat
        const hubPositions = [
            { x: 47, y: 48 },
            { x: 52, y: 51 }
        ];
        for (let pos of hubPositions) {
            this.createEnemy(pos.x, pos.y);
        }

        // Left branch room: 5 enemies in a defensive formation
        const leftPositions = [
            { x: 21, y: 34 },
            { x: 24, y: 36 },
            { x: 21, y: 38 },
            { x: 24, y: 40 },
            { x: 27, y: 38 }
        ];
        for (let pos of leftPositions) {
            this.createEnemy(pos.x, pos.y);
        }

        // Right branch room: 5 enemies clustered
        const rightPositions = [
            { x: 74, y: 35 },
            { x: 77, y: 35 },
            { x: 80, y: 37 },
            { x: 77, y: 40 },
            { x: 74, y: 42 }
        ];
        for (let pos of rightPositions) {
            this.createEnemy(pos.x, pos.y);
        }

        // Boss room: 8 enemies spread throughout
        const bossPositions = [
            { x: 80, y: 44 },
            { x: 84, y: 44 },
            { x: 88, y: 46 },
            { x: 92, y: 46 },
            { x: 84, y: 50 },
            { x: 88, y: 50 },
            { x: 90, y: 54 },
            { x: 94, y: 56 }
        ];
        for (let pos of bossPositions) {
            this.createEnemy(pos.x, pos.y);
        }
    }

    // ─── LEVEL 2 UPDATE LOOP ──────────────────────────────────────────────

    updateLevel2(time) {
        const playerRoom = this.getCurrentPlayerRoom();
        if (playerRoom === -1) return;

        for (let enemy of this.enemies) {
            if (!enemy.sprite || !enemy.sprite.active) continue;
            const mx = enemy.sprite.x, my = enemy.sprite.y;

            if (enemy._fireMark?.active)   enemy._fireMark.setPosition(mx, my - 16);
            if (enemy._inhibitRing?.active) enemy._inhibitRing.setPosition(mx, my);
            if (enemy._inhibitMark?.active) enemy._inhibitMark.setPosition(mx, my - 22);
            if (enemy._shieldMark?.active)  enemy._shieldMark.setPosition(mx, my - 22);
            if (enemy._iceMark?.active)     enemy._iceMark.setPosition(mx, my - 16);
            if (enemy._rangedMark?.active)  enemy._rangedMark.setPosition(mx, my - 22);
            // Chill bar -- ONE Graphics object now, not three dots.
            if (enemy._chillBar?.active) {
                enemy._chillBar.x = enemy.sprite.x - 11;
                enemy._chillBar.y = enemy.sprite.y - 30;
            }
        }

        if (playerRoom !== this.currentTutorialRoom) {
            this.currentTutorialRoom = playerRoom;
            if (this.tutorialDoorsLocked[playerRoom]) this.lockTutorialDoors(playerRoom);
            if (playerRoom === 0) {
                this.tutorialRoomCleared[0] = true;
                this.tutorialDoorsLocked[0] = false;
                this.unlockTutorialDoors(0);
            }
            // Boss room — activate Voltslime when player enters
            const bossRoomIndex = 6;
            if (playerRoom === bossRoomIndex && this.voltslimeBoss && !this.voltslimeBoss._activated) {
                this.voltslimeBoss._activated = true;
                this.voltslimeBoss.phase = 'idle';
                this.time.delayedCall(1500, () => this._voltslimeNextPhase());
            }
        }

        if (!this._roomHadEnemies) this._roomHadEnemies = {};
        if (!this.tutorialRoomCleared[playerRoom]) {
            const roomEnemies = this.enemies.filter(e => e.tutorialRoomIndex === playerRoom);
            if (roomEnemies.length > 0) this._roomHadEnemies[playerRoom] = true;
            if (roomEnemies.length === 0 && this._roomHadEnemies[playerRoom]) {
                const bossRoomIndex = 6;
                if (playerRoom === bossRoomIndex) {
                    if (!this.voltslimeBoss?.active) this._level2RoomClear(playerRoom);
                } else {
                    this._level2RoomClear(playerRoom);
                }
            }
        }

        // Walk-on chest detection
        if (this.tutorialChests) {
            for (const chest of this.tutorialChests) {
                if (chest.opened) continue;
                if (this.playerX !== chest.tileX || this.playerY !== chest.tileY) continue;
                if (chest.isFinalChest) {
                    if (!this.voltslimeBoss?.active) this.openFinalLevelChest(chest);
                } else {
                    this.openTutorialChest(chest.roomIndex, chest.container, null);
                }
            }
        }
    }

    _level2RoomClear(roomIndex) {
        this.tutorialRoomCleared[roomIndex] = true;
        this.unlockTutorialDoors(roomIndex);
        const bossRoomIndex = 6;
        if (roomIndex === bossRoomIndex) {
            this.time.delayedCall(800, () => {
                const chest = (this.tutorialChests || []).find(c => c.isFinalChest && !c.opened);
                if (chest) this.openFinalLevelChest(chest);
            });
            return;
        }
        this.spawnTutorialChest(roomIndex);
    }

    // ─── LEVEL 2 ENEMY SPAWNING ───────────────────────────────────────────

    spawnLevel2Enemies() {
        // Positions as the fixed map placed them, each moved with its room (the map is laid out fresh: LevelLayouts):
        // O is where each story room stood on the fixed map
        const O = [[4, 44], [20, 43], [42, 40], [64, 40], [65, 60], [36, 60], [4, 57]];
        const at = (ri, x, y) => [this.rooms[ri].x + x - O[ri][0], this.rooms[ri].y + y - O[ri][1]];
        const mob = (ri, x, y, hp) => { const e = this.createEnemy(...at(ri, x, y), hp); e.tutorialRoomIndex = ri; return e; };
        const absorber = (ri, x, y, hp) => { const e = mob(ri, x, y, hp); e.isUltAbsorber = true; TutorialManager.prototype._applyUltAbsorberVisual.call(this, e); return e; };

        // R1: pillar gauntlet, an ice elemental flanking
        for (const [x, y] of [[23, 45], [23, 50], [34, 45], [34, 50]]) mob(1, x, y, 30);
        this.createRangedEnemy(...at(1, 29, 47), 1);
        this._tagResist(mob(1, 26, 47, 50), 'ice');

        // R2: wide brawl, an ult absorber healer at the back
        for (const [x, y] of [[45, 43], [50, 54], [55, 43]]) mob(2, x, y, 35);
        for (const [x, y] of [[47, 50], [54, 50]]) this._tagResist(mob(2, x, y, 35), 'fire');
        this.createRangedEnemy(...at(2, 57, 43), 2);
        absorber(2, 52, 47, 55);

        // the side rooms: chests, and the elite den's guards
        this._spawnLevel2ChestRooms();
        this.rooms.forEach((r, ri) => {
            if (r.tpl !== 'elite') return;
            const c = [r.x + Math.floor(r.w / 2), r.y + Math.floor(r.h / 2)];
            for (const [dx, dy] of [[-4, -2], [4, -2], [-4, 2], [4, 2]]) { const e = this.createEnemy(c[0] + dx, c[1] + dy, 70); e.tutorialRoomIndex = ri; }
            this._tagResist(this.createRangedEnemy(c[0], c[1] - 3, ri), Math.random() < 0.5 ? 'fire' : 'ice');
            const T = this.TILE_SIZE, ch = LootFX.chest(this, c[0] * T + T / 2, c[1] * T + T / 2, 'gold');   // what it guards: a gold chest
            (this.tutorialChests ||= []).push({ tileX: c[0], tileY: c[1], roomIndex: ri, container: ch.container, lid: ch.lid, body: ch.body, glow: ch.glow, kind: ch.kind, opened: false, isMimic: false, _mimicTriggered: false });
        });

        // R3: L-shape, an ice elemental and an ult absorber
        for (const [x, y] of [[76, 42], [79, 42], [82, 43]]) mob(3, x, y, 38);
        for (const [x, y] of [[77, 51], [80, 52]]) this._tagResist(mob(3, x, y, 38), 'fire');
        for (const [x, y] of [[78, 46], [82, 48]]) this._tagResist(mob(3, x, y, 55), 'ice');
        absorber(3, 74, 50, 65);

        // R4: the lane maze (no traps: its walls are the puzzle)
        for (const [x, y] of [[70, 62], [75, 69], [82, 65]]) mob(4, x, y, 40);
        // FIRST RESISTANT ENEMY IN THE GAME. Room 4 of level 2, fire-resistant, answered by
        // switching to ice. One enemy, late, so the aura is a curiosity rather than a wall.
        this._tagResist(this.createRangedEnemy(...at(4, 78, 62), 4), 'fire');
        for (const [x, y] of [[80, 62], [80, 68]]) this._tagResist(mob(4, x, y, 60), 'ice');

        // R5: ambush, an ult absorber and more ice elementals
        for (const [x, y] of [[40, 63], [40, 70], [46, 67], [51, 63], [51, 71]]) mob(5, x, y, 40);
        for (const [x, y] of [[45, 62], [53, 70]]) this._tagResist(mob(5, x, y, 40), 'fire');
        // The mirror lesson one room later: ice-resistant, so the player learns the aura COLOUR
        // names the refused element rather than remembering one enemy as "the tanky one".
        this._tagResist(this.createRangedEnemy(...at(5, 55, 63), 5), 'ice'); this.createRangedEnemy(...at(5, 55, 70), 5);
        for (const [x, y] of [[43, 65], [50, 67]]) this._tagResist(mob(5, x, y, 60), 'ice');
        absorber(5, 47, 66, 75);

        // the boss arena: guards, the Voltslime, its chest
        for (const [x, y] of [[8, 61], [24, 61], [8, 73], [24, 73]]) mob(6, x, y, 45);
        this._tagResist(mob(6, 16, 62, 70), 'ice');
        this.spawnVoltslimeBoss(...at(6, 16, 67));
        this.spawnFinalLevelChest(...at(6, 16, 59), 'lightning');
    }

    _spawnLevel2ChestRooms() {
        if (!this.tutorialChests) this.tutorialChests = [];
        for (let i = 0; i < this.rooms.length; i++) {
            const room = this.rooms[i];
            if (!room.isChestRoom) continue;
            let cx = Math.floor(room.x + room.w / 2);
            let cy = Math.floor(room.y + room.h / 2);
            if (this.world[cx]?.[cy] !== this.FLOOR) {
                outer: for (let r = 1; r < Math.max(room.w, room.h); r++) {
                    for (let dx = -r; dx <= r; dx++) for (let dy = -r; dy <= r; dy++) {
                        if (Math.abs(dx) !== r && Math.abs(dy) !== r) continue;
                        const tx = cx+dx, ty = cy+dy;
                        if (this.world[tx]?.[ty] === this.FLOOR) { cx = tx; cy = ty; break outer; }
                    }
                }
            }
            const wx = cx * this.TILE_SIZE + this.TILE_SIZE / 2;
            const wy = cy * this.TILE_SIZE + this.TILE_SIZE / 2;
            const isMimic = Math.random() < 0.12;
            // Loot.js: an oak chest (a mimic's light is a shade too red)
            const { container, body, lid, glow, kind } = LootFX.chest(this, wx, wy, isMimic ? 'mimic' : 'wood');
            this.tutorialChests.push({ tileX:cx, tileY:cy, roomIndex:i, container, lid, body, glow, kind, opened:false, isMimic, _mimicTriggered:false });
        }
    }

    // ─── VOLTSLIME BOSS ───────────────────────────────────────────────────

    spawnVoltslimeBoss(tileX, tileY) {
        const px = tileX * this.TILE_SIZE + this.TILE_SIZE / 2;
        const py = tileY * this.TILE_SIZE + this.TILE_SIZE / 2;
        const offsetY = this.SLIME_Y_OFFSET || -10;
        const container = this.add.container(px, py + offsetY).setDepth(3);
        const body = this.add.sprite(0, -65, 'slime_red', 0).setScale(4.5);
        body.setTint(0x88ffff);
        if (this.anims.exists('red_idle')) body.play('red_idle');

        const crown = this.add.graphics();
        crown.fillStyle(0xffff00,1); crown.fillRect(-16,-46,32,9);
        crown.fillTriangle(-16,-46,-12,-62,-7,-46); crown.fillTriangle(-3,-46,0,-64,3,-46); crown.fillTriangle(7,-46,12,-62,16,-46);
        crown.fillStyle(0x44ffff,1); crown.fillCircle(-12,-42,4);
        crown.fillStyle(0xffff44,1); crown.fillCircle(0,-42,4);
        crown.fillStyle(0x44ffff,1); crown.fillCircle(12,-42,4);
        crown.lineStyle(1.5,0xaaaa00,1); crown.strokeRect(-16,-46,32,9);

        const shadow = this.add.ellipse(0, 10, 64, 16, 0x000000, 0.3);
        const hpBg = this.add.rectangle(0,-66,72,8,0x330033,1); hpBg.setStrokeStyle(1,0x000000,1);
        const hpBar = this.add.rectangle(-36,-66,72,8,0x44ffff,1).setOrigin(0,0.5);
        const hpLabel = this.add.text(0,-78,'VOLTSLIME',{ fontSize:'9px',fontFamily:'monospace',color:'#88ffff',stroke:'#000',strokeThickness:2,fontStyle:'bold' }).setOrigin(0.5);
        const aura = this.add.graphics().setDepth(3.5);
        container.add([shadow,hpBg,hpBar,hpLabel,body,crown]);

        const baseY = py + offsetY;
        this.tweens.add({ targets:container, y:baseY-8, duration:800, yoyo:true, repeat:-1, ease:'Sine.easeInOut' });

        this.voltslimeBoss = {
            tileX, tileY, hp:1200, maxHp:1200, isBoss: true,   // 1500 till 2026-10-20: too long a fight
            container, body, hpBar, aura,
            active:true, phase:'waiting', phaseIndex:-1,
            projectiles:[], homingProjectiles:[],
            _lastAuraTime:0, _baseY:baseY, _activated:false,
        };
        if (this.isLevel2 && !this.trainingRun && !this.towerRun) this._voltSleep(this.voltslimeBoss);
    }
    // The Gauntlet's Voltslime sleeps till you come in (HUD._bossIntro wakes it): grey, its crown on the floor beside it,
    // a brood of speedy slimes dozing round it
    _voltSleep(b) {
        b._asleep = true;
        LevelManager.grey(b.body, true);
        const c = b.container;
        b._floorCrown = this.add.image(c.x + 54, c.y + 6, LevelManager.voltCrownArt(this)).setDepth(2.9).setScale(3.6).setAngle(26);
        b._sleepers = [];
        for (const [dx, dy] of [[-3, -1], [3, -2], [-2, 3], [3, 2], [0, 4], [-4, 1]]) {
            const x = b.tileX + dx, y = b.tileY + dy;
            if (this.world[x]?.[y] !== this.FLOOR || this.getEnemyAt(x, y)) continue;
            const e = this.createEnemy(x, y, 30);
            e.tutorialRoomIndex = 6; e.isElectrical = true;
            e._asleep = true; e._sleepHold = e._moveCdMult; e._moveCdMult = 999;
            LevelManager.grey(e.sprite, true);
            b._sleepers.push(e);
        }
    }
    // Drained of colour (asleep), or back: a greyscale filter where there's WebGL (a tint only darkens a blue slime bluer)
    static grey(sp, on) {
        if (!sp?.active) return;
        if (!sp.preFX) { if (on) sp.setTint(0x9a9aa4); else sp.clearTint(); return; }
        if (on && !sp._grey) { sp._grey = sp.preFX.addColorMatrix(); sp._grey.grayscale(0.9); }
        if (!on && sp._grey) { sp.preFX.remove(sp._grey); sp._grey = null; }
    }
    // Red with fury: the grey filter turned to a red one (it runs after any tint, so a tint alone came out grey)
    static redden(sp, k = 1) {   // (k: how red, 0 grey to 1 furious)
        if (!sp?.active) return;
        if (!sp._grey) { sp.setTint(k < 1 ? 0xff9a90 : 0xff5a48); return; }
        const L = [0.3, 0.59, 0.11], row = m => [m * L[0], m * L[1], m * L[2], 0, 0];
        sp._grey.set([...row(1 + 0.7 * k), ...row(1 - 0.58 * k), ...row(1 - 0.64 * k), 0, 0, 0, 1, 0]);
    }
    // Its crown (the face sheet's 'crown' hat), on its own, to lie on the floor
    static voltCrownArt(scene) {
        const A = CreatureFX.art().hats.crown, pal = { k: '#2a1a10', ...A.pal };
        return MenuArt.tex(scene, 'fx_volt_crown', A.rows[0].length, A.rows.length, P => A.rows.forEach((r, y) => [...r].forEach((ch, x) => { if (pal[ch]) P.put(x, y, parseInt(pal[ch].slice(1), 16)); })));
    }

    _voltslimeNextPhase() {
        const boss = this.voltslimeBoss;
        if (!boss?.active) return;
        // If frozen, queue the next phase to start once thawed
        if (boss._isFrozen) {
            boss._pendingNextPhase = true;
            return;
        }
        this._voltslimeSlam(() => {
            const phases = ['scatter','homing','spawner','spiral','ricochet'];
            boss.phaseIndex = (boss.phaseIndex + 1) % phases.length;
            boss.phase = phases[boss.phaseIndex];
            if      (boss.phase === 'scatter')   this._voltslimeScatter();
            else if (boss.phase === 'homing')    this._voltslimeHoming();
            else if (boss.phase === 'spawner')   this._voltslimeSpawner();
            else if (boss.phase === 'spiral')    this._voltslimeSpiral();
            else if (boss.phase === 'ricochet')  this._voltslimeRicochet();
        });
    }

    _voltslimeSlam(onDone) {
        const boss = this.voltslimeBoss;
        if (!boss?.active) { if (onDone) onDone(); return; }
        boss.phase = 'slam';
        const bpx = boss.container.x, bpy = boss.container.y;

        // Warning. Bosses.js lights the very tiles the slam hits (Manhattan 2 from its tile, the
        // test below) and plants it on the floor; without it, a ring (3 tiles wide: it hits 2).
        const _slam = this._bfxSlamWarn?.(boss, 700);
        Sfx.play(this, 'tell', { ms: 700, big: true });
        if (!_slam) {
            const warn = this.add.circle(bpx, bpy, 8, 0xffff44, 0).setDepth(2.5);
            warn.setStrokeStyle(3, 0xffff44, 0.9);
            this.tweens.add({ targets:warn, radius: 3 * this.TILE_SIZE, alpha:0, duration:700, ease:'Quad.easeOut', onComplete:()=>warn.destroy() });
        }

        // Wind-up squish
        this.tweens.killTweensOf(boss.body);
        this.tweens.add({ targets:boss.body, scaleX:5.5, scaleY:3.2, duration:500, ease:'Power2' });

        this.time.delayedCall(700, () => {
            if (!boss.active) { if (onDone) onDone(); return; }
            this.tweens.killTweensOf(boss.body);
            this.tweens.add({ targets:boss.body, scaleX:4.5, scaleY:4.5, duration:100, ease:'Bounce.easeOut' });
            Sfx.play(this, 'slam');
            this.cameras.main.shake(120, 0.009);

            // AoE damage in 2-tile radius — reduced from 3 tiles for melee viability
            const playerDist = Math.abs(this.playerX - boss.tileX) + Math.abs(this.playerY - boss.tileY);
            if (playerDist <= 2) {
                this.takeDamage((12) * (this.enemyDamageScale || 1));
                this.showStatusText(this.player.x, this.player.y - 20, 'SLAM!', '#ffff44');
            }
            this._damageTowersInTileRadius(boss.tileX, boss.tileY, 2, 12);

            if (_slam) this._bfxSlamHit?.(boss, _slam);   // Bosses.js: lightning into every tile it reached
            else {
                const burst = this.add.circle(boss.container.x, boss.container.y, 12, 0xffff44, 0.9).setDepth(4);
                this.tweens.add({ targets:burst, radius: 3*this.TILE_SIZE, alpha:0, duration:350, ease:'Quad.easeOut', onComplete:()=>burst.destroy() });
            }

            this.time.delayedCall(1000, () => { if (onDone) onDone(); });
        });
    }

    _voltslimeScatter() {
        // 10-shot rings, alternating offset — gaps of previous wave are filled by next
        const boss = this.voltslimeBoss;
        if (!boss?.active) return;
        boss.phase = 'scatter';
        const SHOTS = 10, SPEED = 200;   // was 100, updated twice a frame
        let wave = 0;
        const fireWave = (offset) => {
            if (!boss.active) return;
            this.cameras.main.shake(35, 0.003);
            boss.body.setTint(0xffff44);
            Sfx.play(this, 'blburst');
            this.time.delayedCall(60, () => { if (boss.body?.active) (boss._bfx ? boss.body.clearTint() : boss.body.setTint(0x88ffff)); });
            for (let i = 0; i < SHOTS; i++) {
                const angle = (Math.PI * 2 / SHOTS) * i + offset;
                const g = this._bfxVoltShot?.('volt', 0, 0) || this.add.graphics().setDepth(3);   // Bosses.js
                g.x = boss.container.x; g.y = boss.container.y;
                boss.projectiles.push({ g, vx: Math.cos(angle)*SPEED, vy: Math.sin(angle)*SPEED, startX:g.x, startY:g.y, createdAt:this.time.now });
            }
            wave++;
            if (wave < 4) this.time.delayedCall(800, () => fireWave(offset + Math.PI / SHOTS));
            else this.time.delayedCall(500, () => this._voltslimeNextPhase());
        };
        fireWave(0);
    }

    _voltslimeHoming() {
        const boss = this.voltslimeBoss;
        if (!boss?.active) return;
        boss.phase = 'homing';
        // Slow homing balls — reduced from 4 to 3, damage 45→20, more readable turn rate
        let fired = 0;
        const fireOne = () => {
            if (!boss.active) return;
            Sfx.play(this, 'zap');
            const g = this._bfxVoltShot?.('homing', 0, 0) || this.add.graphics().setDepth(3);   // Bosses.js
            g.x = boss.container.x; g.y = boss.container.y;
            boss.homingProjectiles.push({ g, vx:0, vy:0, speed:50, createdAt:this.time.now, damage:20 });   // 25, twice a frame
            fired++;
            if (fired < 3) this.time.delayedCall(800, fireOne);
            else this.time.delayedCall(4000, () => this._voltslimeNextPhase());
        };
        fireOne();
    }

    _voltslimeSpawner() {
        const boss = this.voltslimeBoss;
        if (!boss?.active) return;
        boss.phase = 'spawner';
        const bossRoom = this.rooms?.[6];
        if (!bossRoom) { this.time.delayedCall(400, () => this._voltslimeNextPhase()); return; }
        let spawned = 0, attempts = 0;
        while (spawned < 4 && attempts < 80) {
            attempts++;
            const rx = bossRoom.x + 1 + Math.floor(Math.random() * (bossRoom.w - 2));
            const ry = bossRoom.y + 1 + Math.floor(Math.random() * (bossRoom.h - 2));
            if (this.world[rx]?.[ry] !== this.FLOOR) continue;
            if (this.getEnemyAt(rx, ry)) continue;
            if (Math.abs(rx - this.playerX) < 2 && Math.abs(ry - this.playerY) < 2) continue;
            const wpx = rx * this.TILE_SIZE + this.TILE_SIZE / 2;
            const wpy = ry * this.TILE_SIZE + this.TILE_SIZE / 2;
            const flash = this.add.circle(wpx, wpy, 10, 0x44ffff, 0.8).setDepth(4);
            Sfx.play(this, 'portal');
            this.tweens.add({ targets:flash, radius:20, alpha:0, duration:300, onComplete:()=>flash.destroy() });
            this.time.delayedCall(300, () => {
                if (!boss.active) return;
                if (this.world[rx]?.[ry] === this.FLOOR && !this.getEnemyAt(rx, ry)) {
                    const e = this.createEnemy(rx, ry, 30);
                    e.tutorialRoomIndex = 6;
                    e.isElectrical = true;
                    Sfx.play(this, 'spawn');
                    e.sprite.setTint(0x44ffff);

                    // Forking lightning aura that pulses every 600ms
                    const auraGfx = this.add.graphics().setDepth(2.5);
                    e._electricalAura = auraGfx;
                    e._electricalAuraTimer = this.time.addEvent({
                        delay: 600, loop: true,
                        callback: () => {
                            if (!e.sprite?.active || !auraGfx.active) { e._electricalAuraTimer?.remove(); auraGfx.destroy(); return; }
                            auraGfx.clear();
                            const bx = e.sprite.x, by = e.sprite.y;
                            if (this._bfxOn) this._bfxVoltZap?.(e, auraGfx);   // Bosses.js: arcs into the 4 tiles it zaps
                            else for (let i = 0; i < 3; i++) {
                                const a = Math.random() * Math.PI * 2;
                                const r1 = 8, r2 = 18 + Math.random() * 8;
                                const ma = a + (Math.random() - 0.5) * 1.2;
                                auraGfx.lineStyle(1.5, 0x44ffff, 0.8);
                                auraGfx.beginPath();
                                auraGfx.moveTo(bx + Math.cos(a)*r1, by + Math.sin(a)*r1);
                                auraGfx.lineTo(bx + Math.cos(ma)*((r1+r2)/2), by + Math.sin(ma)*((r1+r2)/2));
                                auraGfx.lineTo(bx + Math.cos(a)*r2, by + Math.sin(a)*r2);
                                auraGfx.strokePath();
                            }
                            // Micro-stun nearby player
                            const pd = Math.abs(e.x - this.playerX) + Math.abs(e.y - this.playerY);
                            if (pd <= 1) this.takeDamage((5) * (this.enemyDamageScale || 1));
                            this._damageTowersInTileRadius(e.x, e.y, 1, 5);
                        }
                    });
                }
            });
            spawned++;
        }
        boss.body.setTint(0xffffff);
        this.time.delayedCall(80, () => { if (boss.body?.active) (boss._bfx ? boss.body.clearTint() : boss.body.setTint(0x88ffff)); });
        this.time.delayedCall(2000, () => this._voltslimeNextPhase());
    }

    _voltslimeSpiral() {
        const boss = this.voltslimeBoss;
        if (!boss?.active) return;
        boss.phase = 'spiral';
        // Faster, more projectiles — 48 shots = 4 full rotations
        const TOTAL = 48, SPEED = 180;   // was 90, updated twice a frame
        const STEP = (Math.PI * 2) / 12;
        let shot = 0;
        const t = this.time.addEvent({
            delay: 90, repeat: TOTAL - 1,
            callback: () => {
                if (!boss.active) { t.remove(); return; }
                const angle = STEP * shot;
                const g = this._bfxVoltShot?.('volt', 0, 0) || this.add.graphics().setDepth(3);   // Bosses.js
                g.x = boss.container.x; g.y = boss.container.y;
                Sfx.play(this, 'zap', { soft: true });
                boss.projectiles.push({ g, vx:Math.cos(angle)*SPEED, vy:Math.sin(angle)*SPEED, startX:g.x, startY:g.y, createdAt:this.time.now });
                shot++;
                if (shot >= TOTAL) this.time.delayedCall(800, () => this._voltslimeNextPhase());
            }
        });
    }

    _voltslimeRicochet() {
        // Fires 24 projectiles at random angles — each bounces off walls up to 4 times
        // Fills the room with hard-to-avoid shots; forces player to move constantly
        const boss = this.voltslimeBoss;
        if (!boss?.active) return;
        boss.phase = 'ricochet';
        const SPEED = 220, SHOTS = 16;   // was 110, updated twice a frame
        boss.body.setTint(0xff44ff);
        this.time.delayedCall(60, () => { if (boss.body?.active) (boss._bfx ? boss.body.clearTint() : boss.body.setTint(0x88ffff)); });
        this.cameras.main.shake(50, 0.005);
        Sfx.play(this, 'blburst');

        for (let i = 0; i < SHOTS; i++) {
            const angle = (Math.PI * 2 / SHOTS) * i + Math.random() * 0.3;
            const g = this._bfxVoltShot?.('zap', 0, 0) || this.add.graphics().setDepth(3);   // Bosses.js
            g.x = boss.container.x; g.y = boss.container.y;
            boss.projectiles.push({
                g,
                vx: Math.cos(angle) * SPEED,
                vy: Math.sin(angle) * SPEED,
                startX: g.x, startY: g.y,
                createdAt: this.time.now,
                type: 'ricochet',
                bounces: 0,
                maxBounces: 2,
            });
        }
        this.time.delayedCall(3500, () => this._voltslimeNextPhase());
    }

    updateVoltslimeBoss(time, delta) {
        const boss = this.voltslimeBoss;
        if (!boss?.active) return;
        if (boss.phase === 'waiting') return;
        const ds = delta / 1000;
        const playerPx = this.playerX * this.TILE_SIZE + this.TILE_SIZE / 2;
        const playerPy = this.playerY * this.TILE_SIZE + this.TILE_SIZE / 2;

        // Update freeze visual positions — proxy freezeVisuals follow the boss each frame
        if (boss._isFrozen && boss._bossProxy?.freezeVisuals) {
            const fbx = boss.container.x;
            const fby = boss.container.y - 20;
            const fv  = boss._bossProxy.freezeVisuals;
            if (fv.iceBlock)       { fv.iceBlock.x = fbx;       fv.iceBlock.y = fby; }
            if (fv.iceBorder)      { fv.iceBorder.x = fbx;      fv.iceBorder.y = fby; }
            if (fv.multiplierText) {
                fv.multiplierText.x = fbx;
                fv.multiplierText.y = fby - (this.TILE_SIZE * 3.2 * 0.8) / 2 - 8;
            }
        }

        // Track boss shatter/purple mark visual position
        if (boss._shatterMarkVisual) {
            boss._shatterMarkVisual.x = boss.container.x;
            boss._shatterMarkVisual.y = boss.container.y - 100;
        }

        // Update boss burn stack pip positions
        if (boss._burnStackBar) {
            const bx = boss.container.x;
            const by = boss.container.y - 130;
            const stacks = boss._burnStackBar.length;
            const GAP = 8, W = 8;
            const totalW = stacks * W + (stacks - 1) * GAP;
            for (let i = 0; i < stacks; i++) {
                const pip = boss._burnStackBar[i];
                if (!pip?.active) continue;
                pip.x = bx - totalW / 2 + i * (W + GAP) + W / 2;
                pip.y = by;
            }
        }

        // Frozen — visuals still update (overlay tracked above), but no new phase actions
        // Boss keeps shooting existing projectiles and aura; _isFrozen blocks new phase starts
        // via freezeVoltslime / _voltslimeNextPhase guard, not here.
        if (boss._isFrozen && time >= boss._frozenUntil) this._thawVoltslime();

        // Electric aura
        if (!this._bfxOn && time - boss._lastAuraTime > 80) {
            boss._lastAuraTime = time;
            boss.aura.clear();
            const bx = boss.container.x, by = boss.container.y;
            for (let i = 0; i < 6; i++) {
                const a = Math.random()*Math.PI*2, r1 = 28, r2 = 38+Math.random()*12, ma = a+(Math.random()-0.5)*0.9;
                boss.aura.lineStyle(1.5, 0x44ffff, 0.5+Math.random()*0.5);
                boss.aura.beginPath();
                boss.aura.moveTo(bx+Math.cos(a)*r1, by+Math.sin(a)*r1);
                boss.aura.lineTo(bx+Math.cos(ma)*((r1+r2)/2), by+Math.sin(ma)*((r1+r2)/2));
                boss.aura.lineTo(bx+Math.cos(a)*r2, by+Math.sin(a)*r2);
                boss.aura.strokePath();
            }
        }

        // Scatter/spiral projectiles
        for (let i = boss.projectiles.length - 1; i >= 0; i--) {
            const p = boss.projectiles[i];
            p.g.x += p.vx * ds; p.g.y += p.vy * ds;
            if (!p.g.clear) p.g.rotation += ds * 7;   // Bosses.js: a pixel spark, spinning
            else {
                p.g.clear();
                // Ricochet projectiles are magenta, others cyan
                if (p.type === 'ricochet') {
                    p.g.fillStyle(0xff44ff, 0.9); p.g.fillCircle(0,0,5);
                    p.g.fillStyle(0xffffff, 0.7); p.g.fillCircle(0,0,2.5);
                } else {
                    p.g.fillStyle(0x44ffff, 0.9); p.g.fillCircle(0,0,5);
                    p.g.fillStyle(0xffffff, 0.7); p.g.fillCircle(0,0,2.5);
                }
            }
            const maxRange = p.type === 'ricochet' ? 40 * this.TILE_SIZE : 18 * this.TILE_SIZE;
            if (Math.hypot(p.g.x-p.startX, p.g.y-p.startY) > maxRange) { p.g.destroy(); boss.projectiles.splice(i,1); continue; }
            const tx = Math.floor(p.g.x/this.TILE_SIZE), ty = Math.floor(p.g.y/this.TILE_SIZE);
            const outOfBounds = tx < 0 || tx >= this.WORLD_WIDTH || ty < 0 || ty >= this.WORLD_HEIGHT;
            const hitWall = !outOfBounds && this.world[tx][ty] === this.WALL;
            if (outOfBounds || hitWall) {
                if (p.type === 'ricochet' && p.bounces < p.maxBounces) {
                    // Determine bounce axis
                    const fromTx = Math.floor((p.g.x - p.vx * ds) / this.TILE_SIZE);
                    const fromTy = Math.floor((p.g.y - p.vy * ds) / this.TILE_SIZE);
                    const wallOnX = !outOfBounds && this.world[tx]?.[fromTy] === this.WALL;
                    const wallOnY = !outOfBounds && this.world[fromTx]?.[ty] === this.WALL;
                    if (wallOnX && !wallOnY) p.vx = -p.vx;
                    else if (wallOnY && !wallOnX) p.vy = -p.vy;
                    else { p.vx = -p.vx; p.vy = -p.vy; }
                    p.bounces++;
                    p.g.x += p.vx * ds * 3;
                    p.g.y += p.vy * ds * 3;
                } else {
                    p.g.destroy(); boss.projectiles.splice(i,1); continue;
                }
            }
            if (Math.abs(p.g.x-playerPx) < this.TILE_SIZE*0.7 && Math.abs(p.g.y-playerPy) < this.TILE_SIZE*0.7) { this.takeDamage(10 * (this.enemyDamageScale || 1)); p.g.destroy(); boss.projectiles.splice(i,1); continue; }
            if (this.engineerTowers?.length) {
                let towerHit = null;
                for (const tower of this.engineerTowers) {
                    if (!tower.active) continue;
                    if (Math.abs(p.g.x - tower.px) < this.TILE_SIZE*0.6 && Math.abs(p.g.y - tower.py) < this.TILE_SIZE*0.6) { towerHit = tower; break; }
                }
                if (towerHit) { this.damageEngineerTower(towerHit, 10); p.g.destroy(); boss.projectiles.splice(i,1); continue; }
            }
        }

        // Homing projectiles
        for (let i = boss.homingProjectiles.length - 1; i >= 0; i--) {
            const p = boss.homingProjectiles[i];
            const ddx = playerPx-p.g.x, ddy = playerPy-p.g.y;
            if (Math.hypot(ddx,ddy) > 0) {
                const TURN = 1.4, target = Math.atan2(ddy,ddx);   // 0.7, twice a frame
                const cur = Math.atan2(p.vy,p.vx) || target;
                let diff = target - cur;
                while (diff > Math.PI) diff -= Math.PI*2;
                while (diff < -Math.PI) diff += Math.PI*2;
                const newA = cur + Math.sign(diff)*Math.min(Math.abs(diff), TURN*ds);
                p.vx = Math.cos(newA)*p.speed; p.vy = Math.sin(newA)*p.speed;
            }
            p.g.x += p.vx*ds; p.g.y += p.vy*ds;
            const pulse = 0.7 + Math.sin(time/120)*0.3;
            if (!p.g.clear) { p.g.setScale(1.05 + 0.3 * pulse); p.g.rotation += ds * 2; }   // Bosses.js
            else {
                p.g.clear();
                p.g.fillStyle(0xaa44ff, 0.9*pulse); p.g.fillCircle(0,0,10);
                p.g.fillStyle(0xffffff, 0.6); p.g.fillCircle(0,0,4);
                p.g.lineStyle(1, 0xaa44ff, 0.35); p.g.strokeCircle(0,0,16);
            }
            if (time - p.createdAt > 7000) { p.g.destroy(); boss.homingProjectiles.splice(i,1); continue; }
            const tx2 = Math.floor(p.g.x/this.TILE_SIZE), ty2 = Math.floor(p.g.y/this.TILE_SIZE);
            if (tx2 < 0 || tx2 >= this.WORLD_WIDTH || ty2 < 0 || ty2 >= this.WORLD_HEIGHT || this.world[tx2][ty2] === this.WALL) { p.g.destroy(); boss.homingProjectiles.splice(i,1); continue; }
            if (Math.abs(p.g.x-playerPx) < this.TILE_SIZE*0.9 && Math.abs(p.g.y-playerPy) < this.TILE_SIZE*0.9) {
                this.takeDamage((p.damage) * (this.enemyDamageScale || 1));
                this.showStatusText(this.player.x, this.player.y-20, 'HOMING HIT!', '#aa44ff');
                p.g.destroy(); boss.homingProjectiles.splice(i,1);
                continue;
            }
            if (this.engineerTowers?.length) {
                let towerHit = null;
                for (const tower of this.engineerTowers) {
                    if (!tower.active) continue;
                    if (Math.abs(p.g.x - tower.px) < this.TILE_SIZE*0.8 && Math.abs(p.g.y - tower.py) < this.TILE_SIZE*0.8) { towerHit = tower; break; }
                }
                if (towerHit) { this.damageEngineerTower(towerHit, p.damage); p.g.destroy(); boss.homingProjectiles.splice(i,1); continue; }
            }
        }

        boss.tileX = Math.floor(boss.container.x / this.TILE_SIZE);
        boss.tileY = Math.floor(boss.container.y / this.TILE_SIZE);
        boss.hpBar.width = 72 * Math.max(0, boss.hp / boss.maxHp);
        if (boss.hp <= 0) this._killVoltslimeBoss();
    }

    damageVoltslimeBoss(damage) {
        const boss = this.voltslimeBoss;
        damage = this._dmgNote(boss, null, this._afterHit(null, null, damage * this._dmgOutMult(boss) * this._hitRoll(null)));   // your damage (Hex on it included), and a hit's roll and extras, as on any enemy
        if (!boss?.active) return;

        // Shatter: if frozen and not in shatter immunity window
        if (boss._isFrozen && !boss._shatterImmune) {
            damage *= 2.5;
            // Dramatic shatter burst before thawing
            const bx = boss.container.x, by = boss.container.y;
            for (let i = 0; i < 16; i++) {
                const a = (i / 16) * Math.PI * 2;
                const shard = this.add.graphics().setDepth(6);
                shard.x = bx; shard.y = by;
                const sl = 8 + Math.random() * 14, sw = 2.5;
                shard.fillStyle(i % 2 === 0 ? 0xddf8ff : 0xffffff, 0.95);
                shard.beginPath();
                shard.moveTo(Math.cos(a)*6, Math.sin(a)*6);
                shard.lineTo(Math.cos(a)*sl + Math.sin(a)*sw, Math.sin(a)*sl - Math.cos(a)*sw);
                shard.lineTo(Math.cos(a)*sl - Math.sin(a)*sw, Math.sin(a)*sl + Math.cos(a)*sw);
                shard.closePath(); shard.fillPath();
                this.tweens.add({
                    targets: shard,
                    x: bx + Math.cos(a)*(50 + Math.random()*20),
                    y: by + Math.sin(a)*(50 + Math.random()*20),
                    alpha: 0, scaleX: 0.2, scaleY: 0.2, duration: 400 + Math.random()*150,
                    onComplete: () => shard.destroy()
                });
            }
            // Shockwave rings
            for (let r = 0; r < 3; r++) {
                const ring = this.add.graphics().setDepth(5.8);
                ring.x = bx; ring.y = by;
                ring.lineStyle(3 - r, r === 0 ? 0xffffff : 0x88ddff, 0.9 - r*0.2);
                ring.strokeCircle(0, 0, 10 + r*8);
                this.tweens.add({ targets: ring, scaleX: 5 + r, scaleY: 5 + r, alpha: 0, duration: 380 + r*60, ease: 'Quad.easeOut', onComplete: () => ring.destroy() });
            }
            this._thawVoltslime();
            // Clean up mark visual on shatter
            // Mark persists through shatter — only expires via its own timer
            // Brief shatter immunity — prevents cascade from multiple simultaneous splitter hits
            boss._shatterImmune = true;
            this.time.delayedCall(600, () => { if (boss) boss._shatterImmune = false; });
            if (typeof this._shatterWaterSplash === 'function') this._shatterWaterSplash(boss.tileX, boss.tileY);
            this.showStatusText(bx, by - 70, 'SHATTER!', '#aaffff');
            this.cameras.main.shake(160, 0.014);
        }

        boss.hp -= damage;
        boss.hpBar.width = 72 * Math.max(0, boss.hp / boss.maxHp);
        // Show damage number above boss
        this.showDamageNumber(
            boss.container.x + (Math.random() - 0.5) * 30,
            boss.container.y - 90,
            damage,
            boss._isFrozen ? '#aaffff' : '#ffffff'
        );
        if (!boss._isFrozen && boss._bfx) this._bfxHitFlash?.(boss);   // Bosses.js: a white flash
        else if (!boss._isFrozen) {
            boss.body.setTint(0xffffff);
            this.time.delayedCall(80, () => { if (boss.body?.active) (boss._bfx ? boss.body.clearTint() : boss.body.setTint(0x88ffff)); });
        }
        if (boss.hp <= 0) this._killVoltslimeBoss();
    }

    freezeVoltslime(duration) {
        const boss = this.voltslimeBoss;
        if (!boss?.active || boss._isFrozen) return;
        boss._isFrozen = true;
        boss._frozenUntil = this.time.now + duration;
        boss.body.setTint(0x88ccff);

        // Clear per-shard hit tracking on THAW (not on freeze) so shards already
        // in flight can't immediately re-shatter the newly frozen boss
        // (clearing happens in _thawVoltslime)

        const bx = boss.container.x;
        const by = boss.container.y - 20; // body centre in world space

        // Proxy for createFreezeVisual — it adds +10 internally so we subtract 10
        const proxy = {
            sprite: { x: bx, y: by - 10, setTint: () => {}, active: true },
            freezeVisuals: null
        };

        // Scale TILE_SIZE so the block covers the 4.5× boss body
        const origTileSize = this.TILE_SIZE;
        this.TILE_SIZE = origTileSize * 3.2;
        this.createFreezeVisual(proxy);
        this.TILE_SIZE = origTileSize;

        // Set depth high so it's always visible above the boss
        if (proxy.freezeVisuals) {
            const fv = proxy.freezeVisuals;
            if (fv.iceBlock)       fv.iceBlock.setDepth(8);
            if (fv.iceBorder)      fv.iceBorder.setDepth(8.1);
            if (fv.multiplierText) { fv.multiplierText.setDepth(8.2); fv.multiplierText.setText('2.5x DMG'); }
        }

        boss._bossProxy  = proxy;
        boss._iceOverlay = proxy.freezeVisuals?.iceBlock || null;

        if (typeof this.spawnIceSplinter === 'function') {
            this.spawnIceSplinter(bx, by);
            this.spawnIceSplinter(bx, by);
        }

        this.showStatusText(bx, by - origTileSize * 1.5, 'FROZEN!', '#88ccff');
        boss._freezeTimer = this.time.delayedCall(duration, () => this._thawVoltslime());
    }

    _thawVoltslime() {
        const boss = this.voltslimeBoss;
        if (!boss?.active || !boss._isFrozen) return;
        boss._isFrozen = false;
        if (boss._freezeTimer) { boss._freezeTimer.remove(); boss._freezeTimer = null; }
        // Clear shard hit tracking on thaw — shards fired after this can hit again
        boss._hitShards      = new Set();
        boss._frozenByShards = new Set();
        // Clean up freeze visuals via proxy — same path as regular enemy thaw
        if (boss._bossProxy?.freezeVisuals) {
            const fv = boss._bossProxy.freezeVisuals;
            ['iceBlock', 'iceBorder', 'multiplierText'].forEach(k => {
                if (fv[k]) { this.tweens.killTweensOf(fv[k]); fv[k].setVisible(false); fv[k].destroy(); }
            });
            boss._bossProxy.freezeVisuals = null;
        }
        boss._bossProxy  = null;
        boss._iceOverlay = null;
        (boss._bfx ? boss.body.clearTint() : boss.body.setTint(0x88ffff));
        if (boss._pendingNextPhase) {
            boss._pendingNextPhase = false;
            this.time.delayedCall(200, () => this._voltslimeNextPhase());
        }
    }

    // Called by ice weapons (pierce spike, splitter, heal splinter) to
    // accumulate freeze stacks on the boss independently of current element.
    freezeBossFromIceWeapon(instantFreeze) {
        // An ice weapon's hit: chill, as on any enemy (a bar, then a brittle cube that shatters by itself). Only the ult's
        // instant freeze still hard-freezes a boss (below).
        if (!instantFreeze) {
            for (const [boss, hurt] of [[this.voltslimeBoss, d => this.damageVoltslimeBoss(d)], [this.voidSovereignBoss, d => this.damageVoidSovereignBoss?.(d)]]) {
                if (!boss?.active || boss._isFrozen || boss._isInvulnerable || (boss._iceCubeUntil || 0) > this.time.now || (boss._chillImmuneUntil || 0) > this.time.now) continue;
                const C = this._chillCfg();
                boss.chillStacks = Math.round(((boss.chillStacks || 0) + C.RATE * C.BOSS) * 1e4) / 1e4; boss.lastChillTime = this.time.now;
                if (boss.chillStacks >= C.MAX) this._bossCube(boss, hurt);
                this._bossIceWatch();
            }
            return;
        }
        // Voltslime
        if (this.voltslimeBoss?.active) {
            const boss = this.voltslimeBoss;
            if (!boss._isFrozen) {
                if (instantFreeze) {
                    boss._freezeStacks = 0;
                    this.freezeVoltslime(2200);
                } else {
                    boss._freezeStacks = (boss._freezeStacks || 0) + 1;
                    if (boss._freezeStacks >= 3) {
                        boss._freezeStacks = 0;
                        this.freezeVoltslime(2200);
                    }
                }
            }
        }
        // Void Sovereign — same chill stack logic
        if (this.voidSovereignBoss?.active && !this.voidSovereignBoss._isInvulnerable) {
            const boss = this.voidSovereignBoss;
            if (!boss._isFrozen) {
                if (instantFreeze) {
                    boss._freezeStacks = 0;
                    this._freezeVoidSovereign(2200);
                } else {
                    boss._freezeStacks = (boss._freezeStacks || 0) + 1;
                    if (boss._freezeStacks >= 3) {
                        boss._freezeStacks = 0;
                        this._freezeVoidSovereign(2200);
                    }
                }
            }
        }
    }

    // A boss's ice cube: brittle for BOSS_CUBE_MS (BRITTLE_SWAP from other elements, BRITTLE_ICE from ice, in damageBossAtTile),
    // not stopped; then it shatters by itself for the cube's flat part plus its share of what the others dealt, and the
    // boss shrugs off chill for BOSS_IMMUNE_MS
    _bossCube(boss, hurt) {
        const C = this._iceCubeCfg(), K = this._chillCfg(), now = this.time.now;
        boss.chillStacks = 0; boss._cubeDealt = 0; boss._iceCubeUntil = now + K.BOSS_CUBE_MS; boss._cubeHurt = hurt;
        const cut = Math.min(Math.round(boss.maxHp * C.DECAY_BOSS) - (boss._decayOwed || 0), Math.floor(boss.hp - 1));   // decay, as on any cube (one chunk at most)
        if (cut > 0) { boss.hp -= cut; boss._decayOwed = (boss._decayOwed || 0) + cut; if (boss.hpBar) boss.hpBar.width = 72 * Math.max(0, boss.hp / boss.maxHp); }
        const T = this.TILE_SIZE, img = this.add.image(boss.container.x, boss.container.y, 'cfx_ice', 'ice_cracked').setDisplaySize(T * 3.4, T * 2.8).setAlpha(0.78).setDepth(7.9);
        boss._cubeImg?.destroy(); boss._cubeImg = img;
        this.showStatusText(boss.container.x, boss.container.y - 70, 'BRITTLE', '#88eeff');
        Sfx.play(this, 'freeze');
    }
    _bossCubeShatter(boss) {
        const C = this._iceCubeCfg(), K = this._chillCfg(), bx = boss.container.x, by = boss.container.y;
        boss._iceCubeUntil = 0; boss._chillImmuneUntil = this.time.now + K.BOSS_IMMUNE_MS; boss._decayHoldUntil = this.time.now + C.DECAY_HOLD_MS;
        boss._cubeImg?.destroy(); boss._cubeImg = null;
        for (let i = 0; i < 12; i++) {   // the block coming apart
            const a = i / 12 * Math.PI * 2, sh = this.add.rectangle(bx, by, 5, 12, i % 2 ? 0xddf8ff : 0xffffff, 0.95).setDepth(6).setRotation(a);
            this.tweens.add({ targets: sh, x: bx + Math.cos(a) * 60, y: by + Math.sin(a) * 50, alpha: 0, scaleY: 0.3, duration: 420, ease: 'Quad.easeOut', onComplete: () => sh.destroy() });
        }
        this._vfxFlash?.(bx, by, 90, 0xbff0ff, 300, 0.8); this.cameras.main.shake(140, 0.008); Sfx.play(this, 'shatter');
        this.showStatusText(bx, by - 70, 'SHATTER!', '#aaffff');
        const dealt = boss._cubeDealt || 0; boss._cubeDealt = 0;
        boss._cubeHurt?.(C.SHATTER_DMG * (this.damageScaling || 1) + C.SHATTER_SHARE * dealt);
    }
    // One watcher for both bosses' chill: the bar over the boss, its hold-then-drain, the cube following the boss and breaking
    _bossIceWatch() {
        if (this._bossIceOn) return;
        this._bossIceOn = true;
        const g = this.add.graphics().setDepth(6.1);
        const tick = () => {
            const now = this.time.now, K = this._chillCfg(), dt = Math.min(0.25, (now - (g._at ?? now)) / 1000); g._at = now; g.clear();
            for (const boss of [this.voltslimeBoss, this.voidSovereignBoss]) {
                if (!boss?.active) continue;
                if ((boss._csHexUntil || 0) > now) {   // Hex: its motes orbiting the boss, pink to violet (as on any enemy, bigger)
                    const n = Math.min(3, boss._csHexStacks || 1), cx = boss.container.x, cy = boss.container.y - 10;
                    for (let i = 0; i < n; i++) { const a = now * 0.003 + i * Math.PI * 2 / n, col = [0xff7ae8, 0xe060ff, 0xb45cff][i];
                        g.fillStyle(col, 0.35).fillCircle(cx + Math.cos(a) * 46, cy + Math.sin(a) * 18, 7).fillStyle(col, 1).fillCircle(cx + Math.cos(a) * 46, cy + Math.sin(a) * 18, 3.5); }
                }
                if (boss._decayOwed > 0 && boss.hpBar?.active) {   // the decayed chunk on its bar; growing back once the cube's gone
                    if (!boss._iceCubeUntil && now >= (boss._decayHoldUntil || 0)) { const h = Math.min(boss._decayOwed, boss.maxHp * this._iceCubeCfg().DECAY_BOSS * dt * 1000 / this._iceCubeCfg().DECAY_REGEN_MS); boss.hp = Math.min(boss.maxHp, boss.hp + h); boss._decayOwed -= h; boss.hpBar.width = 72 * Math.max(0, boss.hp / boss.maxHp); }
                    if (!boss._barHidden) { const b = boss.hpBar.getBounds(); g.fillStyle(0x9ae8ff, 0.85).fillRect(b.right, b.y, 72 * boss._decayOwed / boss.maxHp, b.height); }   // (with the boss bar up top, it's drawn there)
                }
                if (boss._iceCubeUntil) { boss._cubeImg?.setPosition(boss.container.x, boss.container.y); if (now >= boss._iceCubeUntil) this._bossCubeShatter(boss); continue; }
                if (!(boss.chillStacks > 0)) continue;
                if (now - (boss.lastChillTime || 0) > K.HOLD_MS) boss.chillStacks = Math.max(0, boss.chillStacks - K.DRAIN * dt);
                const W = 60, x = boss.container.x - W / 2, y = boss.container.y - 118, f = Math.min(1, boss.chillStacks / K.MAX);
                if (!boss._barHidden) g.fillStyle(0x001222, 0.75).fillRect(x - 1, y - 1, W + 2, 7).fillStyle(0x11334d, 0.9).fillRect(x, y, W, 5).fillStyle(0x8ae8ff, 1).fillRect(x, y, W * f, 5);   // (with the boss bar up top: under it there)
            }
        };
        this.events.on('update', tick);
        this.events.once('shutdown', () => { this.events.off('update', tick); this._bossIceOn = false; });
    }
    _freezeVoidSovereign(duration) {
        const boss = this.voidSovereignBoss;
        if (!boss?.active || boss._isFrozen) return;
        boss._isFrozen = true;
        boss._frozenUntil = this.time.now + duration;
        boss._freezeStacks = 0;
        if (boss.body?.active) boss.body.setTint(0x88ccff);

        const bx = boss.container.x;
        const by = boss.container.y - 20;

        // Proxy mirrors voltslime pattern — createFreezeVisual expects sprite.x/y
        const proxy = {
            sprite: { x: bx, y: by - 10, setTint: () => {}, active: true },
            freezeVisuals: null
        };

        // Scale TILE_SIZE so the block covers the 5× boss body
        const origTileSize = this.TILE_SIZE;
        this.TILE_SIZE = origTileSize * 3.6;
        this.createFreezeVisual(proxy);
        this.TILE_SIZE = origTileSize;

        if (proxy.freezeVisuals) {
            const fv = proxy.freezeVisuals;
            if (fv.iceBlock)  fv.iceBlock.setDepth(8);
            if (fv.iceBorder) fv.iceBorder.setDepth(8.1);
        }

        boss._bossProxy  = proxy;
        boss._iceOverlay = proxy.freezeVisuals?.iceBlock || null;

        if (typeof this.spawnIceSplinter === 'function') {
            this.spawnIceSplinter(bx, by);
            this.spawnIceSplinter(bx, by);
        }

        this.showStatusText(bx, by - origTileSize * 1.8, 'FROZEN!', '#88ccff');
        boss._freezeTimer = this.time.delayedCall(duration, () => this._thawVoidSovereign());
    }

    _thawVoidSovereign() {
        const boss = this.voidSovereignBoss;
        if (!boss?.active) return;
        boss._isFrozen = false;
        boss._frozenUntil = 0;
        if (boss._freezeTimer) { boss._freezeTimer.remove(); boss._freezeTimer = null; }
        if (boss._bossProxy?.freezeVisuals) {
            const fv = boss._bossProxy.freezeVisuals;
            if (fv._extraLayers) { for (const l of fv._extraLayers) { this.tweens.killTweensOf(l); l.destroy(); } fv._extraLayers = []; }
            ['iceBlock', 'iceBorder'].forEach(k => {
                if (fv[k]) { this.tweens.killTweensOf(fv[k]); fv[k].setVisible(false); fv[k].destroy(); }
            });
            boss._bossProxy.freezeVisuals = null;
        }
        boss._bossProxy  = null;
        boss._iceOverlay = null;
        boss._hitShards  = new Set();
        if (boss.body?.active) (boss._bfx ? boss.body.clearTint() : boss.body.setTint(0x6600aa)); // restore base dark purple
    }

    _killVoltslimeBoss() {
        const boss = this.voltslimeBoss;
        if (!boss?.active) return;
        boss.active = false;
        Sfx.play(this, 'bossdie');
        for (const p of [...boss.projectiles, ...boss.homingProjectiles]) { if (p.g?.active) p.g.destroy(); }
        boss.projectiles = []; boss.homingProjectiles = [];
        if (boss.aura?.active) boss.aura.destroy();
        // Clean up burn stacks
        if (boss._burnDoTTimer) { boss._burnDoTTimer.remove(); boss._burnDoTTimer = null; }
        if (boss._burnStackBar) { for (const pip of boss._burnStackBar) pip.destroy(); boss._burnStackBar = null; }
        boss.burnStacks = 0;
        if (boss._bossProxy?.freezeVisuals) {
            const fv = boss._bossProxy.freezeVisuals;
            ['iceBlock', 'iceBorder', 'multiplierText'].forEach(k => { if (fv[k]) { fv[k].destroy(); } });
            boss._bossProxy.freezeVisuals = null;
        }
        boss._bossProxy = null; boss._iceOverlay = null;
        if (boss._shatterMarkVisual) { boss._shatterMarkVisual.destroy(); boss._shatterMarkVisual = null; }
        if (boss._shatterMarkTimer)  { boss._shatterMarkTimer.remove();  boss._shatterMarkTimer  = null; }
        if (typeof this._recalcMagmaFireballCount === 'function') this._recalcMagmaFireballCount();

        const bpx = boss.container.x, bpy = boss.container.y;
        this._bfxVoltDeath?.(boss);   // Bosses.js: a discharge, a splash of its blue, its crown thrown up
        const flash = this.add.circle(bpx, bpy, 20, 0xffffff, 1).setDepth(6);
        this.tweens.add({ targets:flash, radius:80, alpha:0, duration:500, ease:'Quad.easeOut', onComplete:()=>flash.destroy() });
        if (!this._bfxOn) for (let i = 0; i < 20; i++) {
            const a = (i/20)*Math.PI*2;
            const blob = this.add.circle(bpx, bpy, 5+Math.random()*7, 0x44ffff, 1).setDepth(5);
            this.tweens.add({ targets:blob, x:bpx+Math.cos(a)*(40+Math.random()*40), y:bpy+Math.sin(a)*(40+Math.random()*40), alpha:0, scaleX:0.1, scaleY:0.1, duration:500+Math.random()*200, ease:'Quad.easeOut', onComplete:()=>blob.destroy() });
        }
        this.cameras.main.shake(200, 0.013);
        this.showStatusText(bpx, bpy-50, 'VOLTSLIME DEFEATED!', '#44ffff');
        if (!this.towerRun) Progress.announce(this, Progress.rewardBoss('gauntlet').frags);
        this.tweens.killTweensOf(boss.container);
        this.tweens.add({ targets:boss.container, alpha:0, duration:400, onComplete:()=>boss.container.destroy() });
        this.totalGlorps = (this.totalGlorps || 0) + 80;
        localStorage.setItem('glorps', this.totalGlorps);
        if (this.glorpText) this.glorpText.setText(`✦ ${this.totalGlorps} Glorps`);
        if (!this.towerRun) this._level2RoomClear(6);
    }

    // ─── FINAL CHEST + UNLOCK CINEMATIC ──────────────────────────────────

    spawnFinalLevelChest(tileX, tileY, elementToUnlock) {
        const cx = tileX * this.TILE_SIZE + this.TILE_SIZE / 2;
        const cy = tileY * this.TILE_SIZE + this.TILE_SIZE / 2;
        // Loot.js: the gold chest. It rises off the floor and floats there; its shadow stays down.
        const { container, body, lid, glow, shadow, kind } = LootFX.chest(this, cx, cy, 'gold', { hover: true, depth: 3 });
        const crackleGfx = this.add.graphics().setDepth(3.5);
        const crackCol = { lightning: 0xffe14a, cosmic: 0xc99cff, fire: 0xff7a30, ice: 0x8fe6ff }[elementToUnlock] ?? 0xffe14a;
        const hoverY = cy - 22;
        this.tweens.add({ targets:container, y:hoverY, duration:900, ease:'Sine.easeOut' });
        this.tweens.add({ targets:shadow, y:9 + 22, scaleX:0.26, alpha:0.4, duration:900, ease:'Sine.easeOut' });

        const crackleTimer = this.time.addEvent({ delay:80, loop:true, callback:() => {
            if (!crackleGfx.active) return;
            crackleGfx.clear();
            const bx = container.x, by = container.y;
            for (let i = 0; i < 5; i++) {
                const a = Math.random()*Math.PI*2, r1 = 14+Math.random()*4, r2 = 22+Math.random()*10, ma = a+(Math.random()-0.5)*0.8;
                crackleGfx.lineStyle(1, crackCol, 0.5+Math.random()*0.5);
                crackleGfx.beginPath();
                crackleGfx.moveTo(bx+Math.cos(a)*r1, by+Math.sin(a)*r1);
                crackleGfx.lineTo(bx+Math.cos(ma)*((r1+r2)/2), by+Math.sin(ma)*((r1+r2)/2));
                crackleGfx.lineTo(bx+Math.cos(a)*r2, by+Math.sin(a)*r2);
                crackleGfx.strokePath();
            }
        }});

        if (!this.tutorialChests) this.tutorialChests = [];
        this.tutorialChests.push({ tileX, tileY, roomIndex:-1, container, lid, body, glow, shadow, kind, crackleGfx, crackleTimer, opened:false, isFinalChest:true, elementToUnlock });
    }

    openFinalLevelChest(chest) {
        if (!chest || chest.opened) return;
        chest.opened = true;
        // the next level opens, and the first clear pays its fragments (Progress.js)
        const _clr = Progress.rewardClear(Progress.BY_LEVEL_INDEX[this.currentLevelIndex], this);
        this._firstClear = _clr.first;
        Progress.announce(this, _clr.frags);
        if (chest.crackleTimer) chest.crackleTimer.remove();
        if (chest.crackleGfx) { this.tweens.add({ targets:chest.crackleGfx, alpha:0, duration:200, onComplete:()=>chest.crackleGfx.destroy() }); }
        LootFX.open(this, chest, { spill: 18, keep: 650 });
        this.cameras.main.shake(80, 0.006);

        const element = chest.elementToUnlock;
        let alreadyHad = false;
        if (element) {
            alreadyHad = localStorage.getItem(`unlocked_${element}`) === 'true';
            localStorage.setItem(`unlocked_${element}`, 'true');
            if (!this.unlockedElements) this.unlockedElements = new Set(['fire','ice']);
            this.unlockedElements.add(element);
        }

        this.time.delayedCall(600, () => this._showElementUnlockCinematic(element, alreadyHad));
    }

    // A level cleared: the screen goes dark, light breaks out behind a turning crest with the
    // element's glyph in it (a star for a plain clear), and the words come up under it.
    _showElementUnlockCinematic(element, alreadyUnlocked) {
        const W = this.scale.width, H = this.scale.height, D = 500, ADD = Phaser.BlendModes.ADD;
        if (this._runStats && !this._runStats.tEnd) this._runStats.tEnd = this.time.now;   // the clock stops at the clear
        Telemetry.end(this, 'clear');
        const COL = { lightning: 0xffe14a, cosmic: 0xb47cff, fire: 0xff7a2a, ice: 0x6ad4ff };
        const NAME = { lightning: 'LIGHTNING', cosmic: 'COSMIC', fire: 'FIRE', ice: 'ICE' };
        const KEY = { fire: '1', ice: '2', lightning: '3', cosmic: '4' };
        const col = element ? (COL[element] || 0xffffff) : 0xffd866, css = '#' + col.toString(16).padStart(6, '0');
        const all = [];
        const keep = o => (all.push(o), o.setScrollFactor(0));
        const black = keep(this.add.rectangle(W / 2, H / 2, W, H, 0x050408, 1).setDepth(D).setAlpha(0));
        this.tweens.add({ targets: black, alpha: 0.96, duration: 600, ease: 'Quad.easeIn', onComplete: () => {
            const sx = W / 2, sy = H / 2 - 70, R = Math.min(96, H * 0.11);
            // light: a soft bloom and slow rays turning behind the crest
            if (this.textures.exists('vfx_glow')) {
                const bloom = keep(this.add.image(sx, sy, 'vfx_glow').setTint(col).setBlendMode(ADD).setDepth(D + 1).setAlpha(0).setScale(R * 5 / 128));
                this.tweens.add({ targets: bloom, alpha: 0.55, duration: 700 });
                this.tweens.add({ targets: bloom, scale: R * 5.6 / 128, duration: 1800, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
            }
            const rays = keep(this.add.graphics().setPosition(sx, sy).setDepth(D + 1).setBlendMode(ADD).setAlpha(0));
            for (let k = 0; k < 14; k++) { const a = k / 14 * Math.PI * 2, w = 0.07; rays.fillStyle(col, 0.07); rays.fillTriangle(0, 0, Math.cos(a - w) * R * 4, Math.sin(a - w) * R * 4, Math.cos(a + w) * R * 4, Math.sin(a + w) * R * 4); }
            this.tweens.add({ targets: rays, alpha: 1, duration: 900 });
            this.tweens.add({ targets: rays, angle: 360, duration: 40000, repeat: -1 });
            // the crest: a dark disc, a rune ring that turns, a bright rim, the glyph
            const ring = keep(this.add.graphics().setPosition(sx, sy).setDepth(D + 2));
            ring.lineStyle(2, col, 0.7); ring.strokeCircle(0, 0, R * 1.18);
            for (let k = 0; k < 36; k++) { const a = k / 36 * Math.PI * 2, l = k % 3 ? 4 : 9; ring.lineStyle(k % 3 ? 1.5 : 2.5, col, k % 3 ? 0.5 : 0.9); ring.lineBetween(Math.cos(a) * R * 1.18, Math.sin(a) * R * 1.18, Math.cos(a) * (R * 1.18 + l), Math.sin(a) * (R * 1.18 + l)); }
            for (let k = 0; k < 4; k++) { const a = k * Math.PI / 2 + Math.PI / 4; ring.fillStyle(col, 1); ring.fillTriangle(Math.cos(a) * R * 1.32, Math.sin(a) * R * 1.32, Math.cos(a + 0.06) * R * 1.18, Math.sin(a + 0.06) * R * 1.18, Math.cos(a - 0.06) * R * 1.18, Math.sin(a - 0.06) * R * 1.18); }
            this.tweens.add({ targets: ring, angle: -360, duration: 30000, repeat: -1 });
            const crest = keep(this.add.graphics().setPosition(sx, sy).setDepth(D + 3));
            for (let k = 8; k >= 0; k--) { crest.fillStyle(MenuArt.mix(0x0a0810, col, (1 - k / 8) * 0.35), 1); crest.fillCircle(0, 0, R * (0.55 + k * 0.05)); }   // a dark disc, warmer toward the middle
            crest.lineStyle(4, 0x000000, 0.5); crest.strokeCircle(0, 0, R); crest.lineStyle(2.5, col, 1); crest.strokeCircle(0, 0, R - 1);
            crest.lineStyle(1, 0xffffff, 0.35); crest.beginPath(); crest.arc(0, 0, R - 5, Math.PI * 1.05, Math.PI * 1.6); crest.strokePath();
            const s = R / 9, P = pts => pts.map(([x, y]) => ({ x: x * s, y: y * s }));
            const glyph = (c, a) => {
                crest.fillStyle(c, a); crest.lineStyle(1.8 * s / 2, c, a);
                if (element === 'fire') { crest.fillPoints(P([[0, -8], [3, -3], [5.5, 1], [5, 4.5], [2.5, 7], [0, 7.5], [-2.5, 7], [-5, 4.5], [-5.5, 1], [-3.5, -1], [-2.2, -4.5]]), true); }
                else if (element === 'ice') for (let k = 0; k < 3; k++) {
                    const an = Math.PI / 2 + k * Math.PI / 3, cs = Math.cos(an) * s, sn = Math.sin(an) * s;
                    crest.lineBetween(-cs * 7.5, -sn * 7.5, cs * 7.5, sn * 7.5);
                    for (const d of [-1, 1]) { const bx = d * cs * 4.4, by = d * sn * 4.4, out = an + (d < 0 ? Math.PI : 0); for (const t of [-0.8, 0.8]) crest.lineBetween(bx, by, bx + Math.cos(out + t) * 2.6 * s, by + Math.sin(out + t) * 2.6 * s); }
                }
                else if (element === 'lightning') crest.fillPoints(P([[2, -8], [-4, 1.5], [-0.5, 1.5], [-2.5, 8], [4.5, -1.5], [1, -1.5], [3.5, -8]]), true);
                else crest.fillPoints(P([[0, -8], [1.8, -1.8], [8, 0], [1.8, 1.8], [0, 8], [-1.8, 1.8], [-8, 0], [-1.8, -1.8]]), true);
            };
            crest.setScale(0.6).setAlpha(0);
            glyph(0xffffff, 1);
            this.tweens.add({ targets: crest, scale: 1, alpha: 1, duration: 600, ease: 'Back.easeOut' });
            const burst = keep(this.add.circle(sx, sy, R, 0, 0).setStrokeStyle(3, col, 1).setDepth(D + 2));
            this.tweens.add({ targets: burst, scale: 2.6, alpha: 0, duration: 900, ease: 'Quad.easeOut' });
            for (let k = 0; k < 24; k++) {
                const a = Math.random() * Math.PI * 2, m = keep(this.add.rectangle(sx, sy, 3, 3, k % 3 ? col : 0xffffff).setDepth(D + 2).setBlendMode(ADD));
                this.tweens.add({ targets: m, x: sx + Math.cos(a) * R * (1.6 + Math.random() * 1.6), y: sy + Math.sin(a) * R * (1.6 + Math.random() * 1.6), alpha: 0, duration: 900 + Math.random() * 700, ease: 'Quad.easeOut' });
            }
            Sfx.play(this, 'fanfare');
            // the words
            const T = (y, str, size, style, color, stroke = 6) => keep(this.add.text(W / 2, y, str, { fontSize: size, fontFamily: UIKit.FONT.title, fontStyle: style, color, stroke: '#050408', strokeThickness: stroke, padding: { x: 16, y: 16 } }).setOrigin(0.5).setDepth(D + 4).setAlpha(0));
            const top = sy + R * 1.5 + 20;
            const lines = !element ? [T(top + 20, 'LEVEL COMPLETE', '40px', 'bold', css)]
                : alreadyUnlocked ? [T(top + 20, `${NAME[element]} MASTERED`, '40px', 'bold', css)]
                : [T(top, 'a new element', '18px', 'italic', '#cfc4a8', 4), T(top + 42, NAME[element] || element.toUpperCase(), '52px', 'bold', css)];
            lines[lines.length - 1].setShadow(0, 0, css, 22, true, true);
            if (element && !alreadyUnlocked) lines.push(T(top + 92, `press ${KEY[element]} to wield it`, '16px', 'italic', '#9a917e', 4));
            if (this._fragsThisLevel) lines.push(T(top + (element && !alreadyUnlocked ? 130 : 76), `+${this._fragsThisLevel} fragments`, '20px', 'bold', '#7cc4f4', 5));
            const cont = T(H - 70, 'click to continue', '14px', 'italic', '#6e6758', 3);
            lines.forEach((t, i) => this.tweens.add({ targets: t, alpha: 1, y: t.y - 8, duration: 500, delay: 350 + i * 160, ease: 'Quad.easeOut' }));
            this.tweens.add({ targets: cont, alpha: 0.8, duration: 400, delay: 1000, onComplete: () => this.tweens.add({ targets: cont, alpha: 0.35, duration: 700, yoyo: true, repeat: -1 }) });
            const handler = () => {
                this.input.off('pointerdown', handler);
                for (const o of all) if (o?.active) { this.tweens.killTweensOf(o); this.tweens.add({ targets: o, alpha: 0, duration: 400, onComplete: () => o.destroy() }); }
                this.time.delayedCall(450, () => this._showWinScreen());   // HUD.js: the run's numbers, then the map
            };
            this.time.delayedCall(900, () => this.input.on('pointerdown', handler));
        } });
    }

    // ═══════════════════════════════════════════════════════════════════════
    // LEVEL 3 — THE VOID RIFT
    // ═══════════════════════════════════════════════════════════════════════

    updateLevel3(time) {
        const playerRoom = this.getCurrentPlayerRoom();
        if (playerRoom === -1) return;

        for (let enemy of this.enemies) {
            if (!enemy.sprite || !enemy.sprite.active) continue;
            const mx = enemy.sprite.x, my = enemy.sprite.y;
            if (enemy._fireMark?.active)   enemy._fireMark.setPosition(mx, my - 16);
            if (enemy._inhibitRing?.active) enemy._inhibitRing.setPosition(mx, my);
            if (enemy._iceMark?.active)     enemy._iceMark.setPosition(mx, my - 16);
            if (enemy._lightningMark?.active) enemy._lightningMark.setPosition(mx, my - 16);
            if (enemy._voidMark?.active)    enemy._voidMark.setPosition(mx, my - 22);
            if (enemy._chillBar?.active) { enemy._chillBar.x = mx - 11; enemy._chillBar.y = my - 30; }
            // Void sniper: update charge zone visual
            if (enemy.isVoidSniper && enemy._sniperCharging && enemy._sniperChargeGfx?.active) {
                enemy._sniperChargeGfx.x = enemy.sprite.x;
                enemy._sniperChargeGfx.y = enemy.sprite.y;
            }
        }

        if (playerRoom !== this.currentTutorialRoom) {
            this.currentTutorialRoom = playerRoom;
            if (this.tutorialDoorsLocked[playerRoom]) this.lockTutorialDoors(playerRoom);
            if (playerRoom === 0) {
                this.tutorialRoomCleared[0] = true;
                this.tutorialDoorsLocked[0] = false;
                this.unlockTutorialDoors(0);
            }
            // Boss room — activate Void Sovereign when player enters
            const bossRoomIndex = 6;
            if (playerRoom === bossRoomIndex && this.voidSovereignBoss && !this.voidSovereignBoss._activated) {
                this.voidSovereignBoss._activated = true;
                this.time.delayedCall(1800, () => this._voidSovereignNextAttack());
            }
        }

        if (!this._roomHadEnemies) this._roomHadEnemies = {};
        if (!this.tutorialRoomCleared[playerRoom]) {
            const roomEnemies = this.enemies.filter(e => e.tutorialRoomIndex === playerRoom);
            if (roomEnemies.length > 0) this._roomHadEnemies[playerRoom] = true;
            if (roomEnemies.length === 0 && this._roomHadEnemies[playerRoom]) {
                const bossRoomIndex = 6;
                if (playerRoom === bossRoomIndex) {
                    if (!this.voidSovereignBoss?.active) this._level3RoomClear(playerRoom);
                } else {
                    this._level3RoomClear(playerRoom);
                }
            }
        }

        // Key pickup detection
        if (this._voidKeys?.length) {
            for (const key of this._voidKeys) {
                if (key.collected) continue;
                if (Math.abs(key.tileX - this.playerX) <= 1 && Math.abs(key.tileY - this.playerY) <= 1) {
                    this._collectVoidKey(key);
                }
            }
        }

        // Boss door interaction — player bumping into it tries to unlock
        if (this._bossDoor?.locked) {
            const bd = this._bossDoor;
            for (let dx = 0; dx < bd.w; dx++) {
                if (Math.abs(this.playerX - (bd.tileX + dx)) <= 1 && Math.abs(this.playerY - bd.tileY) <= 1) {
                    if (!this._bossDoorLastTry || this.time.now - this._bossDoorLastTry > 1500) {
                        this._bossDoorLastTry = this.time.now;
                        this._tryUnlockBossDoor();
                    }
                    break;
                }
            }
        }

        // Chest detection
        if (this.tutorialChests) {
            for (const chest of this.tutorialChests) {
                if (chest.opened) continue;
                if (this.playerX !== chest.tileX || this.playerY !== chest.tileY) continue;
                if (chest.isFinalChest) {
                    if (!this.voidSovereignBoss?.active) this.openFinalLevelChest(chest);
                } else {
                    this.openTutorialChest(chest.roomIndex, chest.container, null);
                }
            }
        }

        // Update Void Sovereign boss
        if (this.voidSovereignBoss?.active) {
            this._updateVoidSovereign(time);
        }

        // Update player root
        if (this._playerRooted && time >= this._playerRootUntil) {
            this._playerRooted = false;
            if (this.player?.active) this.player.clearTint();
        }
    }

    _level3RoomClear(roomIndex) {
        this.tutorialRoomCleared[roomIndex] = true;
        this.unlockTutorialDoors(roomIndex);
        const bossRoomIndex = 6;
        if (roomIndex === bossRoomIndex) {
            this.time.delayedCall(800, () => {
                const chest = (this.tutorialChests || []).find(c => c.isFinalChest && !c.opened);
                if (chest) this.openFinalLevelChest(chest);
            });
            return;
        }
        this.spawnTutorialChest(roomIndex);
        // Key rooms: R1 Crucible, R3 Gauntlet, R4 Sniper Hall
        if (roomIndex === 1 || roomIndex === 3 || roomIndex === 4) {
            this.time.delayedCall(600, () => this._spawnVoidKey(roomIndex));
        }
    }

    _spawnVoidKey(roomIndex) {
        const room = this.rooms[roomIndex];
        if (!room) return;
        // Spawn at room center
        const tx = Math.floor(room.x + room.w / 2);
        const ty = Math.floor(room.y + room.h / 2);
        const px = tx * this.TILE_SIZE + this.TILE_SIZE / 2;
        const py = ty * this.TILE_SIZE + this.TILE_SIZE / 2;

        // A cosmic dungeon key (pixel art, LevelManager.voidKeyArt), floating over its shadow in a violet glow, stars twinkling round it
        const img = this.add.image(px, py - 4, LevelManager.voidKeyArt(this)).setDepth(3).setScale(1.3);
        this.tweens.add({ targets: img, y: py - 10, duration: 900, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
        this.tweens.add({ targets: img, angle: { from: -7, to: 7 }, duration: 1700, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
        const shadow = this.add.image(px, py + 12, 'vfx_shadow').setScale(0.32, 0.1).setAlpha(0.55).setDepth(2.9);
        this.tweens.add({ targets: shadow, scaleX: 0.24, alpha: 0.3, duration: 900, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
        const glow = this.add.image(px, py - 6, 'vfx_glow').setTint(0xa050ff).setBlendMode(Phaser.BlendModes.ADD).setScale(0.55).setAlpha(0.5).setDepth(2.95);
        this.tweens.add({ targets: glow, alpha: 0.25, scale: 0.45, duration: 1100, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
        const motes = this.add.particles(0, 0, 'vfx_dot', {
            emitZone: { type: 'random', source: new Phaser.Geom.Circle(px, py - 6, 18) },
            lifespan: 900, speedY: { min: -14, max: -4 }, scale: { start: 0.55, end: 0 }, alpha: { start: 1, end: 0 },
            tint: [0xd8a8ff, 0xffffff, 0xffd34a], blendMode: 'ADD', frequency: 140 }).setDepth(3.05);
        img._extras = [shadow, glow, motes];

        if (!this._voidKeys) this._voidKeys = [];
        this._voidKeys.push({ gfx: img, tileX: tx, tileY: ty, roomIndex, timer: null, collected: false });

        // Label
        const lbl = this.add.text(px, py - 38, 'VOID KEY', {
            fontSize: '9px', fontFamily: UIKit.FONT.title, fontStyle: 'bold', color: '#d8a8ff', resolution: 2,
            stroke: '#000', strokeThickness: 2, fontStyle: 'bold'
        }).setOrigin(0.5).setDepth(4);
        this.tweens.add({ targets: lbl, y: lbl.y - 6, alpha: 0.6, duration: 800, yoyo: true, repeat: -1 });
        img._label = lbl;
    }

    // The Void Key: a dark violet key with a galaxy turning in its bow, gold star points and collar
    static voidKeyArt(scene) {
        return ShopScene.icon(scene, 'fx_void_key', 28, { M: '#5a3a9a', L: '#a58ae0', D: '#34205e', Y: '#ffd34a', y: '#c8901e', v: '#12041e', p: '#7a3ad8', P: '#e0b0ff' }, m => {
            const cx = 14, cy = 7.5;
            m.ring(cx, cy, 6, 2.2, 'M');
            for (let y = 0; y < 16; y++) for (let x = 0; x < 28; x++) {   // lit from the top left
                if (m.get(x, y) !== 'M') continue;
                const d = (x + 0.5 - cx) + (y + 0.5 - cy);
                if (d < -3.5) m.set(x, y, 'L'); else if (d > 3.5) m.set(x, y, 'D');
            }
            m.disc(cx, cy, 3.9, 'v');
            for (let y = 3; y < 13; y++) for (let x = 9; x < 19; x++) {   // the galaxy: two arms round a bright core
                const dx = x + 0.5 - cx, dy = y + 0.5 - cy, r = Math.hypot(dx, dy);
                if (r > 3.9 || m.get(x, y) !== 'v') continue;
                if (Math.sin(Math.atan2(dy, dx) * 2 + r * 1.6) > 0.45) m.set(x, y, r < 2.2 ? 'P' : 'p');
            }
            m.set(13, 7, 'W'); m.set(14, 7, 'P'); m.set(11, 9, 'W'); m.set(16, 5, 'W');
            m.rect(13, 1, 2, 1, 'Y'); m.set(13, 0, 'W'); m.rect(7, 7, 1, 2, 'Y'); m.rect(20, 7, 1, 2, 'Y');   // star points
            m.rect(11, 14, 6, 1, 'Y'); m.rect(11, 15, 6, 1, 'y');   // the collar
            m.rect(13, 16, 1, 10, 'L'); m.rect(14, 16, 1, 10, 'M'); m.rect(13, 26, 2, 1, 'D');   // the shaft
            m.rect(15, 20, 4, 2, 'M'); m.rect(15, 20, 4, 1, 'L'); m.rect(15, 23, 3, 2, 'M'); m.rect(15, 23, 3, 1, 'L');   // the teeth
            m.set(18, 21, 'D'); m.set(17, 24, 'D');
        });
    }

    _spawnBossDoor() {
        // Portcullis across the corridor from R5 to R6, at its mouth in R5. The fixed map's corridor is x:49-51 at y:73;
        // a laid-out map's boss corridor always runs north or south (LevelLayouts.RECIPES.voidrift)
        const entry    = this.rooms[6]?.entryTiles;
        const DOOR_Y   = entry ? entry[0].y : 73;
        const DOOR_X   = entry ? Math.min(...entry.map(t => t.x)) : 49; // left edge
        const DOOR_W   = 3;  // tiles wide
        const T        = this.TILE_SIZE;
        const UP       = this.rooms[6]?.entryDir === 'north' ? T : 0;   // drawn two tiles tall into the corridor, not into R5

        if (!this._bossDoor) {
            const g = this.add.graphics().setDepth(1.5);
            this._bossDoorGfx = g;

            const _draw = () => {
                g.clear();
                for (let dx = 0; dx < DOOR_W; dx++) {
                    const wx = (DOOR_X + dx) * T;
                    const wy = DOOR_Y * T - UP;
                    // Dark stone frame
                    g.fillStyle(0x1a1a2e, 0.95); g.fillRect(wx, wy, T, T * 2);
                    // Metal bars — 3 vertical bars per tile
                    for (let b = 0; b < 3; b++) {
                        const bx = wx + 3 + b * 5;
                        g.fillStyle(0x556677, 1); g.fillRect(bx, wy + 1, 3, T * 2 - 2);
                        g.fillStyle(0x88aacc, 0.6); g.fillRect(bx + 1, wy + 2, 1, T * 2 - 4);
                    }
                    // Horizontal crossbar
                    g.fillStyle(0x445566, 1); g.fillRect(wx, wy + T / 2 - 2, T, 4);
                    g.fillStyle(0x667799, 0.5); g.fillRect(wx, wy + T / 2 - 1, T, 2);
                    // Purple glow edges
                    g.lineStyle(2, 0xcc44ff, 0.35); g.strokeRect(wx, wy, T, T * 2);
                }
                // Lock symbol in center
                const cx = (DOOR_X + DOOR_W / 2) * T;
                const cy = DOOR_Y * T + T - UP;
                g.fillStyle(0xcc44ff, 0.90); g.fillCircle(cx, cy, 6);
                g.fillStyle(0x000000, 1);    g.fillCircle(cx, cy, 3.5);
                g.fillStyle(0xcc44ff, 0.80); g.fillRect(cx - 2, cy, 4, 5);
                g.lineStyle(1.5, 0xee88ff, 0.50); g.strokeCircle(cx, cy, 8);
            };
            _draw();
            // Pulse glow
            this.tweens.add({ targets: g, alpha: 0.80, duration: 800, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });

            // Block the tiles
            for (let dx = 0; dx < DOOR_W; dx++) {
                if (this.world[DOOR_X + dx]?.[DOOR_Y] === this.FLOOR) {
                    this.world[DOOR_X + dx][DOOR_Y] = this.WALL;
                }
            }

            this._bossDoor = { gfx: g, tileX: DOOR_X, tileY: DOOR_Y, w: DOOR_W, locked: true };
        }
    }

    _tryUnlockBossDoor() {
        if (!this._bossDoor?.locked) return;
        const keys = this._level3KeysCollected || 0;
        if (keys < 3) {
            // Flash "need X more keys"
            const needed = 3 - keys;
            const cx = (this._bossDoor.tileX + this._bossDoor.w / 2) * this.TILE_SIZE;
            const cy = this._bossDoor.tileY * this.TILE_SIZE - 16;
            this.showStatusText(cx, cy, `🗝 Need ${needed} more key${needed > 1 ? 's' : ''}`, '#cc44ff');
            this.cameras.main.shake(25, 0.003);
            return;
        }
        // UNLOCK — raise portcullis
        this._bossDoor.locked = false;
        this.tweens.killTweensOf(this._bossDoor.gfx);
        this.cameras.main.shake(60, 0.005);
        // Rise animation
        this.tweens.add({
            targets: this._bossDoor.gfx, y: -this.TILE_SIZE * 3,
            alpha: 0, duration: 600, ease: 'Quad.easeIn',
            onComplete: () => { if (this._bossDoor.gfx?.active) this._bossDoor.gfx.destroy(); }
        });
        // Unblock tiles
        for (let dx = 0; dx < this._bossDoor.w; dx++) {
            if (this.world[this._bossDoor.tileX + dx]?.[this._bossDoor.tileY] === this.WALL) {
                this.world[this._bossDoor.tileX + dx][this._bossDoor.tileY] = this.FLOOR;
            }
        }
        this.showStatusText(
            (this._bossDoor.tileX + 1) * this.TILE_SIZE, this._bossDoor.tileY * this.TILE_SIZE - 24,
            '⚡ BOSS DOOR UNLOCKED', '#cc88ff'
        );
        // Unlock the lockedDoorTiles for R5 south door if it was locked
        if (this.lockedDoorTiles) {
            this.lockedDoorTiles = this.lockedDoorTiles.filter(t => t.y !== this._bossDoor.tileY);
        }
    }

    _collectVoidKey(key) {
        if (key.collected) return;
        key.collected = true;
        key.timer?.remove();
        if (key.gfx?.active) {
            const k = key.gfx;
            const flash = this.add.circle(k.x, k.y, 6, 0xcc44ff, 0.90).setDepth(5);
            this.tweens.add({ targets: flash, radius: 28, alpha: 0, duration: 300, onComplete: () => flash.destroy() });
            VisualFX.ripple(this, k.x, k.y, 6, 34, 0xd8a8ff, { depth: 5, duration: 450 });
            for (const o of k._extras || []) { this.tweens.killTweensOf(o); o.stop?.(); this.tweens.add({ targets: o, alpha: 0, duration: 250, onComplete: () => o.destroy() }); }
            this.tweens.killTweensOf(k);
            this.tweens.add({ targets: k, y: k.y - 24, scale: k.scale * 1.5, angle: 0, duration: 380, ease: 'Quad.easeOut', onComplete: () => k.destroy() });
            this.tweens.add({ targets: k, alpha: 0, delay: 180, duration: 200 });
            if (k._label?.active) this.tweens.add({ targets: k._label, alpha: 0, duration: 200, onComplete: () => k._label.destroy() });
        }
        if (!this._level3KeysCollected) this._level3KeysCollected = 0;
        this._level3KeysCollected++;
        this.cameras.main.shake(30, 0.003);

        // Update HUD
        if (this.keyCounterText) {
            this.keyCounterText.setText(`🗝 ${this._level3KeysCollected} / 3`);
            this.keyCounterText.setVisible(true);
            // Pulse
            this.tweens.add({ targets: this.keyCounterText, scaleX: 1.3, scaleY: 1.3, duration: 150, yoyo: true, ease: 'Quad.easeOut' });
            if (this._level3KeysCollected >= 3) {
                this.keyCounterText.setColor('#ffdd44');
                this.showStatusText(this.player.x, this.player.y - 40, '🗝 ALL KEYS COLLECTED!', '#ffdd44');
            }
        }
        this.showStatusText(this.player.x, this.player.y - 28, `🗝 Key ${this._level3KeysCollected}/3`, '#cc88ff');
    }

    // ─── LEVEL 3 ENEMY SPAWNING ───────────────────────────────────────────

    spawnLevel3Enemies() {
        // Positions as the fixed map placed them (WorldGen._voidRiftFixed), each moved with its room (the map is laid out fresh: LevelLayouts).
        // O is where each story room stood on the fixed map. R0, the spawn, is safe.
        const O = [[43, 28], [18, 22], [44, 10], [63, 23], [40, 44], [37, 61], [34, 78]];
        const at = (ri, x, y) => [this.rooms[ri].x + x - O[ri][0], this.rooms[ri].y + y - O[ri][1]];
        const mob = (ri, x, y, hp) => { const e = this.createEnemy(...at(ri, x, y), hp); e.tutorialRoomIndex = ri; return e; };

        // R1: Elemental Crucible
        this._tagResist(mob(1, 22, 25, 80), 'fire');
        this._tagResist(mob(1, 34, 25, 80), 'ice');
        this.createLightningElemental(...at(1, 22, 33), 1);
        this.createBerserker(...at(1, 29, 29), 1);
        for (const [x, y] of [[28, 28], [34, 34]]) mob(1, x, y, 65);
        this.createQueenSlimePortal(...at(1, 20, 34), 1, 1);
        this.createRangedEnemy(...at(1, 35, 27), 1);
        this.createRangedEnemy(...at(1, 35, 33), 1);

        // R2: Cosmic Observatory: the Gem watching from the far wall, a Wraith and a Leech
        for (const [x, y] of [[47, 17], [53, 17]]) mob(2, x, y, 40);
        this.createGem(...at(2, 50, 11), 2);
        this.createWraith(...at(2, 47, 13), 2);
        this.createLeech(...at(2, 53, 14), 2);

        // R3: Ult Gauntlet
        for (const [x, y] of [[66, 26], [80, 26], [66, 34], [80, 34]]) { const e = mob(3, x, y, 90); e.isUltAbsorber = true; TutorialManager.prototype._applyUltAbsorberVisual.call(this, e); }
        for (const [x, y] of [[70, 29], [75, 29], [70, 33], [75, 33], [73, 31]]) mob(3, x, y, 70);
        this.createVoidSniper(...at(3, 83, 26), 3);
        // On a Berserker rather than a plain slime: from here resistance rides enemies that are
        // already dangerous, so it modifies a threat instead of being a stat block.
        this._tagResist(this.createBerserker(...at(3, 82, 33), 3), 'ice');
        this._tagResist(this.createRangedEnemy(...at(3, 68, 27), 3), 'fire');
        this.createRangedEnemy(...at(3, 68, 34), 3);
        this.createRangedEnemy(...at(3, 78, 27), 3);

        // R4: Sniper Hall
        for (const [x, y] of [[42, 46], [42, 53], [50, 46], [50, 53], [57, 46], [57, 53]]) this.createVoidSniper(...at(4, x, y), 4);
        for (const [x, y] of [[44, 49], [44, 55], [51, 49], [51, 55], [58, 49], [58, 55]]) this.createRangedEnemy(...at(4, x, y), 4);
        this.createHunterSlime(...at(4, 50, 50), 4);   // the ambush: it stalks you while the snipers keep you moving

        // R5: Queen Slime Chamber
        this.createQueenSlimePortal(...at(5, 42, 66), 5, 2);
        this.createQueenSlimePortal(...at(5, 56, 66), 5, 3);
        this._tagResist(mob(5, 43, 63, 75), 'ice');
        this.createLightningElemental(...at(5, 56, 63), 5);
        this.createBerserker(...at(5, 50, 69), 5);
        this._tagResist(this.createRangedEnemy(...at(5, 40, 65), 5), 'lightning');
        this.createRangedEnemy(...at(5, 58, 65), 5);

        // R6: Boss Arena
        for (const [x, y] of [[37, 81], [62, 81], [37, 95], [62, 95]]) mob(6, x, y, 80);
        this.createLightningElemental(...at(6, 50, 79), 6);
        this._tagResist(this.createBerserker(...at(6, 37, 88), 6), 'fire');
        this.createBerserker(...at(6, 62, 88), 6);

        this.spawnVoidSovereignBoss(...at(6, 50, 88));
        this.spawnFinalLevelChest(...at(6, 50, 79), 'cosmic');
        this._spawnLevel3ChestRooms();

        // Key system — spawn boss door and show HUD
        this._level3KeysCollected = 0;
        this._voidKeys = [];
        this._spawnBossDoor();
        if (this.keyCounterText) this.keyCounterText.setVisible(true);
    }

    _spawnLevel3ChestRooms() {
        if (!this.tutorialChests) this.tutorialChests = [];
        for (let i = 0; i < this.rooms.length; i++) {
            const room = this.rooms[i];
            if (!room.isChestRoom) continue;
            let cx = Math.floor(room.x + room.w / 2);
            let cy = Math.floor(room.y + room.h / 2);
            if (this.world[cx]?.[cy] !== this.FLOOR) {
                outer: for (let r = 1; r < Math.max(room.w, room.h); r++) {
                    for (let dx = -r; dx <= r; dx++) for (let dy = -r; dy <= r; dy++) {
                        if (Math.abs(dx) !== r && Math.abs(dy) !== r) continue;
                        const tx = cx+dx, ty = cy+dy;
                        if (this.world[tx]?.[ty] === this.FLOOR) { cx = tx; cy = ty; break outer; }
                    }
                }
            }
            const wx = cx * this.TILE_SIZE + this.TILE_SIZE / 2;
            const wy = cy * this.TILE_SIZE + this.TILE_SIZE / 2;
            // Loot.js: a chest of the void's black glass
            const { container, body, lid, glow, kind } = LootFX.chest(this, wx, wy, 'void');
            this.tutorialChests.push({ tileX:cx, tileY:cy, roomIndex:i, container, lid, body, glow, kind, opened:false, isMimic:false, _mimicTriggered:false });
        }
    }

    // ─── NEW ENEMY TYPES ─────────────────────────────────────────────────

    // ─── LEVEL 4 ENEMY SPAWNING ───────────────────────────────────────────
    // ═══ LEVEL 6 — STORM CHAMBER (flooded) ═══════════════════════════════════
    //
    // Terrain-first level. The world itself is procedural (levels 5+ fall through to the
    // generator), so the authored content here is the WATER and what stands in it rather
    // than a hand-placed room layout.
    //
    // Stocked with the Cistern's own roster -- Drowner, Ripplerunner, Tidecaller,
    // Wave Rider and Conduit -- each placed where the room's water makes its one
    // trick land. See the roster block above for what each of them does.
    spawnLevel6Enemies() {
        // ── LEVEL 6: THE CISTERN ─────────────────────────────────────────────
        // R1-R9 teach one type each, alone, two or three enemies to a room.
        // R10-R14 are STACKS. A room of one thing is a different encounter from a room of
        // one of everything: three Wave Riders overlap their carpets, three Tidal Guards
        // cover each other's safe lanes, four Drowners commit on staggered timers. Wells
        // sit in the stacked rooms because soaking the pack is what makes a pack dangerous,
        // and Ripplerunners are sprinkled through the back half for chip pressure while
        // you are busy reading a telegraph.
        //
        //   R1 water   R2 Ripplerunner  R3 Drowner   R4 pairing   R5 Conduit
        //   R6 Tidecaller  R7 Wave Rider  R8 Tidal Guard  R9 Wishing Well
        //   R10 WAVE RIDERS  R11 GUARDS  R12 CONDUITS  R13 DROWNERS  R14 finale

        // ── WATER ────────────────────────────────────────────────────────────
        //   R0  0%   R1 12%  R2 32%  R3  8%  R4 25%  R5 30%  R6 20%  R7 15%
        //   R8 22%  R9 15%  R10 30%  R11 28%  R12 45%  R13 40%  R14 35%
        // R3 dips on purpose (the Drowner is taught dry) and R9 stays low so you can watch
        // the Well fill it.
        const COVERAGE = [0, 0.12, 0.32, 0.08, 0.25, 0.30, 0.20, 0.15,
                          0.22, 0.15, 0.30, 0.28, 0.45, 0.40, 0.35];
        this.generateWaterBlobs((ri) => COVERAGE[ri] ?? 0.25);
        this.initPipes();   // pipes prime their own tiles and keep refilling them

        // Everything native to the cistern wades unslowed; see EnemyManager's water check.
        const native = (e, ri) => { if (e) { e.tutorialRoomIndex = ri; e._waterNative = true; } return e; };

        // ═══ TEACHING HALF ═══════════════════════════════════════════════════

        // R1: The Shallows — the floor is the only lesson
        native(this.createEnemy(74, 51, 90), 1);
        native(this.createEnemy(83, 46, 90), 1);
        native(this.createEnemy(79, 46, 90), 1);

        // R2: The Runnels — Ripplerunner alone, in flooded lanes
        native(this.createRipplerunner(101, 43, 2), 2);
        native(this.createEnemy(101, 47, 90), 2);
        native(this.createEnemy(105, 51, 90), 2);

        // R3: Stillwell — Drowner alone, on the driest floor in the level
        native(this.createDrowner(102, 22, 3), 3);
        native(this.createEnemy(97, 22, 90), 3);
        native(this.createEnemy(107, 22, 90), 3);

        // R4: Confluence — the two you know, together
        native(this.createRipplerunner(69, 13, 4), 4);
        this._tagResist(native(this.createRipplerunner(80, 24, 4), 4), 'fire');
        native(this.createDrowner(80, 13, 4), 4);
        native(this.createEnemy(69, 24, 110), 4);

        // R5: Switchgear — Conduit alone, with visible dry lanes
        native(this.createConduit(46, 18, 5), 5);
        native(this.createEnemy(38, 11, 90), 5);
        this._tagResist(native(this.createEnemy(55, 24, 90), 5), 'ice');

        // R6: Headrace — Tidecaller alone
        native(this.createTidecaller(12, 21, 6), 6);
        this._tagResist(native(this.createEnemy(25, 21, 90), 6), 'fire');
        native(this.createEnemy(18, 27, 90), 6);

        // R7: The Long Gallery — Wave Rider alone, at the far end
        native(this.createWaveRider(7, 41, 7), 7);
        native(this.createEnemy(34, 44, 110), 7);

        // R8: The Grating — Tidal Guard alone, holding the bottom
        native(this.createTidalGuard(12, 70, 8), 8);
        native(this.createEnemy(9, 56, 90), 8);
        this.createFrostSlime(16, 60, 8);   // the first one: it comes back unless you break the ice

        // R9: The Drawing Room — Wishing Well alone
        native(this.createWishingWell(35, 63, 9), 9);
        native(this.createEnemy(29, 68, 90), 9);
        this._tagResist(native(this.createEnemy(42, 60, 90), 9), 'lightning');

        // ═══ STACKED HALF ════════════════════════════════════════════════════

        // R10: The Torrent — THREE Wave Riders across one long room.
        // Spread along the length so their charges cross the floor at different times and
        // the carpet from one lands in the lane you used to dodge the last. The Well soaks
        // them, which cuts their telegraph from 900ms to 600.
        this._tagResist(native(this.createWaveRider(53, 63, 10), 10), 'fire');
        this._tagResist(native(this.createWaveRider(53, 70, 10), 10), 'lightning');
        this._tagResist(native(this.createWaveRider(78, 66, 10), 10), 'ice');
        native(this.createWishingWell(66, 63, 10), 10);
        native(this.createDrowner(70, 71, 10), 10);
        native(this.createTidalGuard(60, 66, 10), 10);   // a lane you must not stand in while dodging a charge

        // R11: The Picket — THREE Tidal Guards on crossing angles.
        // One trident is a sidestep. Three, aimed down the pickets from different corners,
        // means the safe lane of one is inside the prong of another. Two Ripplerunners keep
        // you moving while you read them.
        this._tagResist(native(this.createTidalGuard(89, 62, 11), 11), 'fire');
        native(this.createTidalGuard(107, 64, 11), 11);
        this._tagResist(native(this.createTidalGuard(99, 75, 11), 11), 'ice');
        native(this.createTidalGuard(101, 69, 11), 11);
        native(this.createWishingWell(94, 67, 11), 11);
        this._tagResist(native(this.createRipplerunner(104, 72, 11), 11), 'lightning');
        native(this.createRipplerunner(91, 71, 11), 11);

        // R12: The Switchyard — SIX Conduits on a 3x2 lattice.
        // Their four-tile fields overlap into ~94% of the floor, and the Well refloods
        // whatever you dry. A fire problem, not a damage problem.
        native(this.createConduit(92, 86, 12), 12);
        this._tagResist(native(this.createConduit(97, 86, 12), 12), 'fire');
        native(this.createConduit(102, 86, 12), 12);
        this._tagResist(native(this.createConduit(92, 91, 12), 12), 'fire');
        native(this.createConduit(97, 91, 12), 12);
        native(this.createConduit(102, 91, 12), 12);
        native(this.createWishingWell(97, 88, 12), 12);

        // R13: The Drowning Pool — FOUR Drowners and two Wells.
        // One Drowner here resists BOTH fire and ice. Double resistance is deliberately
        // almost absent from the game -- two enemies in fifteen rooms -- so that meeting
        // one reads as a specific problem rather than as the level's baseline.
        // Overlapping commits, and every strike on dry ground makes more water, so the
        // ground that saves you shrinks while you fight. Ripplerunners for chip damage.
        this._tagResist(native(this.createDrowner(61, 87, 13), 13), 'fire');
        this._tagResist(native(this.createDrowner(71, 80, 13), 13), ['fire', 'ice']);
        this._tagResist(native(this.createDrowner(78, 92, 13), 13), 'ice');
        native(this.createDrowner(66, 94, 13), 13);
        native(this.createWishingWell(66, 85, 13), 13);
        this._tagResist(native(this.createWishingWell(78, 86, 13), 13), 'fire');
        native(this.createRipplerunner(59, 80, 13), 13);
        this._tagResist(native(this.createRipplerunner(80, 80, 13), 13), 'lightning');
        native(this.createTidalGuard(72, 88, 13), 13);   // punishes standing still to read four commits
        this.createFrostSlime(64, 82, 13);

        // R14: Sluice Gate — the finale, stacked rather than sprinkled.
        // Two Wave Riders with runway, three Ripplerunners so orbs arrive from several
        // angles at once, two Guards on crossing lanes, two Drowners to punish standing
        // still, a Tidecaller and a Well to keep the floor against you.
        this.createQueenSlimePortal(32, 86, 14, 1);
        this._tagResist(native(this.createWaveRider(17, 93, 14), 14), 'fire');
        native(this.createWaveRider(48, 80, 14), 14);
        this._tagResist(native(this.createTidalGuard(24, 80, 14), 14), ['ice', 'lightning']);
        this._tagResist(native(this.createTidalGuard(44, 93, 14), 14), 'ice');
        native(this.createTidalGuard(34, 84, 14), 14);
        native(this.createRipplerunner(20, 86, 14), 14);
        this._tagResist(native(this.createRipplerunner(40, 86, 14), 14), 'lightning');
        native(this.createRipplerunner(34, 94, 14), 14);
        native(this.createDrowner(28, 94, 14), 14);
        this._tagResist(native(this.createDrowner(38, 80, 14), 14), 'fire');
        this._tagResist(native(this.createTidecaller(15, 80, 14), 14), 'ice');
        native(this.createWishingWell(50, 93, 14), 14);
        this.createFrostSlime(26, 88, 14); this.createFrostSlime(42, 84, 14);

        // ── BARRIERS ─────────────────────────────────────────────────────────
        // Nothing to do here. generateLevel6 flags rooms 1-14 as lockable, and
        // _cisternRoomCheck raises the barrier when you walk in.

        // ══════════════════════════════════════════════════════════════════════
        // NON-WATER ENEMIES
        // ══════════════════════════════════════════════════════════════════════
        // The Cistern was a 100% bespoke water roster, which made it monotone: every threat
        // answered to the same two reads -- stay off the wet, watch the telegraph. These are
        // enemies from earlier floors that get HARDER here rather than merely being imported,
        // because water changes what each one costs you:
        //
        //   HEALER TOTEM  stationary, heals 16 HP/s. Everywhere else you walk over and kill it.
        //                 Here the water slows YOU and not the water-natives, so the walk is
        //                 longer and the pack gets a free heal window. Placed beside tanky water
        //                 enemies so the healing actually matters.
        //   SPLITTER      its children are not _waterNative, so every split inherits the water
        //                 slow. That makes a flooded room the place you WANT to fight them --
        //                 the first time water is an advantage on this floor rather than a tax.
        //   QUEEN PORTAL  brood pressure. One already guards the finale; a second, earlier one
        //                 stops room 14 being the first time the player sees it.
        //   MORTAR        arcs OVER walls, so it punishes sheltering in a flooded corridor while
        //                 waiting out a Tidal Guard telegraph. The one addition that makes
        //                 standing still worse than wading.
        //
        // Introduced one at a time through the mid rooms, then stacked late, matching how the
        // water roster is already taught. Deliberately NOT added: Rooter (rooting you in place
        // on a floor of Drowner marks and trident lanes is not difficulty, it is a coin flip)
        // and Anchor Slime (its speed aura does nothing for water-natives, which are already the
        // fast things here).

        // ── Room 6: first Splitter, alone, so the split reads clearly ──
        this.createSplitter(22, 14, 6, 0);

        // ── Room 7: first Healer Totem, behind the room's Wave Rider ──
        // Still authored -- this is the teaching introduction and the position is the lesson --
        // but routed through the same call as every other support, so (6,38) is a FALLBACK rather
        // than a hardcode. If room 7 ever gains a pack, the totem joins it automatically.
        this._placeSupportInCluster(7, (x, y) => this.createHealerTotem(x, y, 7),
                                    { fallback: { x: 6, y: 38 } });

        // ── Room 8: first Mortar, in the Tidal Guard room. Sheltering from the trident is
        //    exactly what a mortar punishes. ──
        this.createMortar(6, 56, 8);

        // ── Room 9: Splitters beside the Wishing Well, which keeps making the water that slows
        //    their own children. Clustered, so their splits overlap into one mass rather than
        //    two tidy lines you can peel apart. ──
        this.spawnCluster(30, 58, [
            (x, y) => this.createSplitter(x, y, 9, 0),
            (x, y) => this.createSplitter(x, y, 9, 0),
            (x, y) => this.createEnemy(x, y, 90),
        ], { roomIndex: 9, waterNative: false });

        // ── Room 10: Healer Totem across the Wave Rider charge lane, so reaching it means
        //    crossing the charge. Placed in the thick of room 10's pack for the same reason. ──
        this._placeSupportInCluster(10, (x, y) => this.createHealerTotem(x, y, 10),
                                    { fallback: { x: 72, y: 62 } });

        // ── Room 11: second Queen portal. Four Tidal Guards already cross here, so a brood
        //    forces movement through the beams instead of waiting them out. ──
        this.createQueenSlimePortal(104, 62, 11, 2);
        this.createMortar(88, 65, 11);

        // ── Room 12: the six-Conduit room. Splitters multiply the bodies the Conduits shelter,
        //    and Conduits are lightning-immune -- this is the room that punishes leaning on
        //    lightning conduction. ──
        this.spawnCluster(92, 84, [
            (x, y) => this.createSplitter(x, y, 12, 0),
            (x, y) => this.createSplitter(x, y, 12, 0),
            (x, y) => this.createEnemy(x, y, 95),
            (x, y) => this.createEnemy(x, y, 95),
        ], { roomIndex: 12 });
        // Totem goes wherever room 12 is thickest, which after the Conduits and the cluster above
        // is not a coordinate worth guessing by hand.
        this._placeSupportInCluster(12, (x, y) => this.createHealerTotem(x, y, 12),
                                    { fallback: { x: 102, y: 84 } });

        // ── Room 13: Healer Totem among four Drowners. The Drowner mark forces you to move, the
        //    totem wants you to commit to a target; those pull in opposite directions. ──
        this.spawnCluster(60, 83, [
            (x, y) => this.createSplitter(x, y, 13, 0),
            (x, y) => this.createSplitter(x, y, 13, 0),
            (x, y) => this.createEnemy(x, y, 95),
        ], { roomIndex: 13 });
        this._placeSupportInCluster(13, (x, y) => this.createHealerTotem(x, y, 13),
                                    { fallback: { x: 76, y: 80 } });

        // ── Room 14 finale: more bodies for the existing Queen portal, no new mechanics ──
        // Two separate knots at opposite ends of the finale rather than a line of four: you
        // have to commit to one and accept the other closing in.
        this.spawnCluster(20, 80, [
            (x, y) => this.createSplitter(x, y, 14, 0),
            (x, y) => this.createEnemy(x, y, 100),
            (x, y) => this.createEnemy(x, y, 100),
        ], { roomIndex: 14 });
        this.spawnCluster(30, 82, [
            (x, y) => this.createSplitter(x, y, 14, 0),
            (x, y) => this.createEnemy(x, y, 100),
            (x, y) => this.createEnemy(x, y, 100),
        ], { roomIndex: 14 });
        this._placeSupportInCluster(14, (x, y) => this.createHealerTotem(x, y, 14),
                                    { fallback: { x: 16, y: 80 } });
        this.createMortar(40, 80, 14);   // mortars WANT the far corner -- they arc over walls

    }

    // ═══════════════════════════════════════════════════════════════════════
    // THE CISTERN'S ROSTER
    // Five types that only make sense standing in water. Each attacks a different
    // assumption: that open water is empty, that you can outrun anything, that
    // drying a room is permanent, that a charge leaves the floor as it found it,
    // and that standing in water is free.
    // ═══════════════════════════════════════════════════════════════════════

    _cisternMark(enemy, draw, dy = -16, depth = 3.0) {
        const m = this.add.graphics().setDepth(depth);
        m.x = enemy.sprite.x; m.y = enemy.sprite.y + dy;
        draw(m);
        enemy._cisternMark = m;
        enemy._cisternMarkDY = dy;
        return m;
    }

    // ── DROWNER — the ambush ────────────────────────────────────────────────
    // Sits submerged and almost invisible until you are within 3.5 tiles. Makes
    // open water something you clear rather than something you cross.
    createDrowner(x, y, ri) {
        const e = this.createEnemy(x, y, 120);
        e.tutorialRoomIndex = ri;
        e._waterNative = true;
        e._isDrowner = true;
        // Walks in the open. It sinks to ATTACK -- being underground is the wind-up,
        // not a hiding place it sits in until you wander past.
        e._drownPhase   = 'idle';
        e._drownCd      = 6000;   // between attempts
        e._drownLastAtk = 0;
        e._drownAtkR    = 6;      // tiles — how close before it commits
        e._drownReachR  = 8;      // tiles — how far it can still reach at resolve
        e._drownTell    = 2000;   // exclamation up, TRACKING you — nothing committed yet
        e._drownDodge   = 900;    // after the mark locks, the window to leave the tile
        e._drownDmg     = 30;
        e._drownStun    = 2000;   // water only
        if (e.sprite.setTint) e.sprite.setTint(0x5a2d6b);
        this._cisternMark(e, m => {
            m.lineStyle(1.4, 0x9fe8ff, 0.50); m.strokeCircle(0, 0, 9);
            m.lineStyle(1.0, 0x6fd0ee, 0.35); m.strokeCircle(0, 0, 13);
        }, 14, 0.9);
        this.tweens.add({ targets: e._cisternMark, scaleX: 1.35, scaleY: 1.35,
            alpha: 0.25, duration: 1400, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
        return e;
    }

    // Dragged under: the sprite is cropped to its top half and dropped so the waterline
    // cuts across it, which reads as being pulled INTO the floor rather than just held.
    // Only used for the water grab -- on dry ground nothing drags you down.
    _drownSubmergePlayer(untilTime) {
        const p = this.player;
        if (!p?.active) return;
        Sfx.play(this, 'splash', { big: true }); Sfx.play(this, 'bubbles');   // dragged under
        const fw = p.frame?.width  ?? p.width  ?? 16;
        const fh = p.frame?.height ?? p.height ?? 16;
        if (p.setCrop) p.setCrop(0, 0, fw, Math.max(1, Math.floor(fh * 0.52)));
        this.tweens.add({ targets: p, y: p.y + fh * 0.26, duration: 150, ease: 'Quad.easeIn' });
        this._submergedUntil = untilTime;
        // waterline ring at the point it swallows you
        const ring = this.add.graphics().setDepth(5.6);
        ring.x = p.x; ring.y = p.y + fh * 0.18;
        ring.lineStyle(2, 0x9fe8ff, 0.85); ring.strokeEllipse(0, 0, 22, 9);
        ring.fillStyle(0x123c52, 0.45);    ring.fillEllipse(0, 0, 22, 9);
        this._submergeRing = ring;
        this.tweens.add({ targets: ring, scaleX: 1.25, scaleY: 1.25, alpha: 0.5,
                          duration: 420, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    }

    _drownSurfacePlayer() {
        const p = this.player;
        if (p?.active) {
            if (p.setCrop) p.setCrop();                  // clear the crop
            const TS = this.TILE_SIZE;
            this.tweens.add({ targets: p,
                y: this.playerY * TS + TS / 2 + (this.SLIME_Y_OFFSET || -10),
                duration: 160, ease: 'Back.easeOut' });
        }
        if (this._submergeRing) {
            this.tweens.killTweensOf(this._submergeRing);
            if (this._submergeRing.active) this._submergeRing.destroy();
            this._submergeRing = null;
        }
        this._submergedUntil = 0;
    }

    // Weeds. Played whenever a Drowner actually gets hold of you, on water OR dry
    // ground, so the grab reads as one attack with two outcomes rather than two
    // different attacks.
    _drownWeeds(px, py, onLand) {
        const N = 8;
        for (let i = 0; i < N; i++) {
            const a   = (i / N) * Math.PI * 2 + Math.random() * 0.3;
            const len = 15 + Math.random() * 13;
            const lean = Math.cos(a) * 6;
            const g = this.add.graphics().setDepth(5.4);
            g.x = px + Math.cos(a) * 9;
            g.y = py + Math.sin(a) * 5 + 4;
            g.lineStyle(2.6, 0x2f6b46, 0.95);
            g.beginPath();
            g.moveTo(0, 0);
            g.lineTo(lean * 0.30, -len * 0.45);
            g.lineTo(lean * 0.90, -len);
            g.strokePath();
            g.lineStyle(1.2, 0x7fd8a0, 0.55);          // wet highlight down one side
            g.beginPath();
            g.moveTo(lean * 0.20, -len * 0.35);
            g.lineTo(lean * 0.75, -len * 0.85);
            g.strokePath();
            g.scaleY = 0.05;
            // whip up out of the floor, hold, then snap back down
            this.tweens.add({
                targets: g, scaleY: 1, duration: 130, delay: i * 14, ease: 'Back.easeOut',
                onComplete: () => this.tweens.add({
                    targets: g, scaleY: 0.1, alpha: 0, duration: 260, delay: 90,
                    ease: 'Quad.easeIn', onComplete: () => g.destroy() })
            });
        }
        // murk pooling at your feet — greener on land, darker in open water
        const pool = this.add.graphics().setDepth(5.3);
        pool.x = px; pool.y = py + 5;
        pool.fillStyle(onLand ? 0x24483a : 0x123c52, 0.55);
        pool.fillEllipse(0, 0, 26, 12);
        this.tweens.add({ targets: pool, alpha: 0, scaleX: 1.6, scaleY: 1.6,
            duration: 480, ease: 'Quad.easeOut', onComplete: () => pool.destroy() });
    }

    // Every graphic a Cistern enemy owns, released in one place. killEnemy splices the
    // enemy out of this.enemies, so the per-frame sweeps can never reach a dead one --
    // anything not destroyed here hangs on screen forever with nothing under it. The
    // Wave Rider's badge is a white triangle in a ring, which is exactly what an
    // orphaned one looks like: a floating scope.
    _clearCisternGfx(enemy) {
        if (!enemy) return;
        for (const k of ['_cisternMark', '_conduitGfx', '_drownWarnGfx', '_drownLockGfx', '_waveTellGfx', '_tgGfx', '_wwRing', '_frostGfx', '_frostRing', '_frostHaze']) {
            const g = enemy[k];
            if (!g) continue;
            this._drownWarns?.delete(g);
            this._drownLocks?.delete(g);
            this._waveTells?.delete(g);
            this._tgAims?.delete(g);
            if (this.tweens) this.tweens.killTweensOf(g);
            if (g.active) g.destroy();
            enemy[k] = null;
        }
        enemy._drownSubmerged = false;
        enemy._drownPhase = 'idle';
        enemy._waveState  = 'walk';
        enemy._tgPhase    = 'idle';
    }

    // The ground mark. Only appears once the Drowner has actually CHOSEN a tile, and
    // contracts over the dodge window so the remaining time is visible.
    _drownLockMark(e, tx, ty) {
        const TS = this.TILE_SIZE;
        const g = this.add.graphics().setDepth(0.95);
        g.x = tx * TS + TS / 2; g.y = ty * TS + TS / 2;
        g.fillStyle(0x5a2d6b, 0.30); g.fillCircle(0, 0, TS * 0.62);
        g.lineStyle(2.2, 0xd8b4ff, 0.95); g.strokeCircle(0, 0, TS * 0.62);
        g.lineStyle(1.4, 0xd8b4ff, 0.55); g.strokeCircle(0, 0, TS * 0.92);
        for (let i = 0; i < 4; i++) {
            const a = i * Math.PI / 2 + Math.PI / 4;
            g.lineStyle(2, 0xffffff, 0.8);
            g.beginPath();
            g.moveTo(Math.cos(a) * TS * 0.42, Math.sin(a) * TS * 0.42);
            g.lineTo(Math.cos(a) * TS * 0.72, Math.sin(a) * TS * 0.72);
            g.strokePath();
        }
        this.tweens.add({ targets: g, scaleX: 0.35, scaleY: 0.35,
                          duration: e._drownDodge, ease: 'Quad.easeIn' });
        e._drownLockGfx = g;
        (this._drownLocks = this._drownLocks || new Set()).add(g);
        g._owner = e;
    }

    // The marker that rides over YOUR head while a Drowner is committed to you.
    _drownWarn(e) {
        Sfx.play(this, 'tell', { ms: 700 });
        const g = this.add.graphics().setDepth(6);
        g.fillStyle(0x5a2d6b, 0.55); g.fillCircle(0, 0, 13);
        g.lineStyle(2.4, 0xd8b4ff, 0.95); g.strokeCircle(0, 0, 13);
        g.fillStyle(0xffffff, 0.95);
        g.fillRect(-1.6, -8, 3.2, 9);            // exclamation
        g.fillCircle(0, 5.5, 1.9);
        g.x = this.player.x; g.y = this.player.y - 34;
        this.tweens.add({ targets: g, scaleX: 1.25, scaleY: 1.25, duration: 330,
                          yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
        e._drownWarnGfx = g;
        (this._drownWarns = this._drownWarns || new Set()).add(g);
        g._owner = e;
        return g;
    }

    // ── RIPPLERUNNER — the chase ────────────────────────────────────────────
    // Quick on water, sluggish on dry stone. The first enemy that gives you a
    // reason to care which tiles you evaporated.
    createRipplerunner(x, y, ri) {
        const e = this.createEnemy(x, y, 55);
        e.tutorialRoomIndex = ri;
        e._waterNative = true;
        e._isRipplerunner = true;
        // It does not melee. It lobs two slow homing orbs, and how fast it can do that
        // depends on what it is standing on -- so drying its lane is a real answer to it.
        e._rippleCdWater = 1900;
        e._rippleCdLand  = 3800;
        e._rippleLastFire = 0;
        e._rippleRange   = 11;    // tiles before an orb pops on its own
        // You move 80 px/s. The orbs open BELOW that and wind up above it, so early on
        // you can walk out of the fan and late on you have to have moved already.
        e._rippleSpeed0   = 55;   // px/s at launch
        e._rippleAccel    = 150;  // px/s gained per second in flight
        e._rippleSpeedMax = 260;
        e._rippleSpread   = 0.75; // rad either side — they leave wide and curve back in
        e._rippleDmg     = 8;
        e._rippleSlowMs  = 2500;
        if (e.sprite.setTint) e.sprite.setTint(0x66f0ff);
        e.sprite.setScale((e.sprite.scaleX || 1) * 0.82);   // small, so it reads as fast
        this._cisternMark(e, m => {
            m.lineStyle(2, 0xbdf6ff, 0.9);
            for (const ox of [-3, 3]) {
                m.beginPath(); m.moveTo(ox - 5, -4); m.lineTo(ox, 0); m.lineTo(ox - 5, 4);
                m.strokePath();
            }
        }, -14);
        return e;
    }

    _fireRippleVolley(e, wet) {
        const TS = this.TILE_SIZE;
        const sx = e.sprite.x, sy = e.sprite.y;
        const base = Math.atan2(this.player.y - sy, this.player.x - sx);
        this._rippleOrbs = this._rippleOrbs || [];
        // On dry stone it manages a single orb straight at you. Standing in water it
        // throws three in a fan -- so the floor decides whether this is a nuisance or
        // a wall of homing water, which is the whole reason to dry its lane.
        const fan = wet ? [-e._rippleSpread, 0, e._rippleSpread] : [0];
        for (const spread of fan) {
            const a = base + spread;
            const g = this.add.graphics().setDepth(2.3);
            g.fillStyle(0x2a5cc8, 0.45); g.fillCircle(0, 0, 7);
            g.fillStyle(0x66f0ff, 0.85); g.fillCircle(0, 0, 4.2);
            g.fillStyle(0xffffff, 0.9);  g.fillCircle(-1.2, -1.2, 1.5);
            g.x = sx; g.y = sy;
            this.tweens.add({ targets: g, scaleX: 1.18, scaleY: 1.18, duration: 420,
                              yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
            this._rippleOrbs.push({
                g, x: sx, y: sy, ang: a,
                speed: e._rippleSpeed0, speed0: e._rippleSpeed0,
                accel: e._rippleAccel, speedMax: e._rippleSpeedMax,
                travelled: 0, maxDist: e._rippleRange * TS,
                dmg: e._rippleDmg, slowMs: e._rippleSlowMs,
            });
        }
        this.showStatusText?.(sx, sy - 24, wet ? 'SURGE' : 'SPIT', '#66f0ff');
    }

    // 3x3 of permanent water, wherever the orb ends its life.
    _rippleDetonate(o) {
        const TS = this.TILE_SIZE;
        Sfx.play(this, 'splash');
        const tx = Math.floor(o.x / TS), ty = Math.floor(o.y / TS);
        for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) {
            const x = tx + dx, y = ty + dy;
            if (this.world?.[x]?.[y] !== this.FLOOR) continue;
            if (this._roomGated() && !this.isInCurrentRoom(x, y)) continue;
            this.addWater(x, y, 0);            // 0 = permanent
        }
        const burst = this.add.graphics().setDepth(2.4);
        burst.x = o.x; burst.y = o.y;
        burst.fillStyle(0x66f0ff, 0.5); burst.fillCircle(0, 0, 10);
        burst.lineStyle(2, 0xbdf6ff, 0.9); burst.strokeCircle(0, 0, 10);
        this.tweens.add({ targets: burst, alpha: 0, scaleX: 2.4, scaleY: 2.4,
            duration: 300, ease: 'Quad.easeOut', onComplete: () => burst.destroy() });
        if (o.g?.active) o.g.destroy();
    }

    _updateRippleOrbs(time, delta) {
        if (!this._rippleOrbs || !this._rippleOrbs.length) return;
        const dt = Math.min(delta, 50) / 1000;
        const px = this.player.x, py = this.player.y;
        for (let i = this._rippleOrbs.length - 1; i >= 0; i--) {
            const o = this._rippleOrbs[i];
            // Accelerates the whole way, and homes HARDER the slower it is going. A
            // fresh orb curves hard onto you; a fast one is committed to its line, so
            // the acceleration buys counterplay instead of removing it.
            o.speed = Math.min(o.speedMax, o.speed + o.accel * dt);
            const want = Math.atan2(py - o.y, px - o.x);
            let diff = want - o.ang;
            while (diff >  Math.PI) diff -= Math.PI * 2;
            while (diff < -Math.PI) diff += Math.PI * 2;
            const rate = 1.9 * Math.min(1, o.speed0 / o.speed);
            const turn = Math.max(-rate * dt, Math.min(rate * dt, diff));
            o.ang += turn;

            const mx = Math.cos(o.ang) * o.speed * dt, my = Math.sin(o.ang) * o.speed * dt;
            o.x += mx; o.y += my;
            o.travelled += Math.hypot(mx, my);
            if (o.g?.active) { o.g.x = o.x; o.g.y = o.y; }

            const TS = this.TILE_SIZE;
            const tx = Math.floor(o.x / TS), ty = Math.floor(o.y / TS);
            const wall = this.world?.[tx]?.[ty] !== this.FLOOR || this.isInLockedRoom(tx, ty);
            const onPlayer = Math.hypot(o.x - px, o.y - py) <= 12;

            if (onPlayer) {
                this.takeDamage(o.dmg * (this.enemyDamageScale || 1));
                this._waterSlowUntil = Math.max(this._waterSlowUntil || 0, time + o.slowMs);
                this.showStatusText?.(px, py - 30, 'SOAKED', '#66f0ff');
                this._rippleDetonate(o); this._rippleOrbs.splice(i, 1); continue;
            }
            if (o.travelled >= o.maxDist || wall) {
                this._rippleDetonate(o); this._rippleOrbs.splice(i, 1); continue;
            }
        }
    }

    // ── TIDECALLER — the water's strength ───────────────────────────────────
    // Doesn't fight. Every enemy within TIDE_R tiles of it attacks faster: ATK_LAND on dry floor, ATK_WATER
    // standing in water (its attack cooldowns are divided by `_atkSpd`). Dry the floor round it, or kill it.
    // Every frame: its field follows it; everything inside it is boosted for a moment
    _tideTick(e, time) {
        const C = this._tideCfg();
        if (e._tideAura?.active) { e._tideAura.setPosition(e.sprite.x, e.sprite.y); VisualFX.clipAura(this, e._tideAura); }
        for (const o of this.enemies) {
            if (!o.sprite?.active || o.health <= 0 || o._isTidecaller || Math.hypot(o.x - e.x, o.y - e.y) > C.TIDE_R) continue;
            const wet = this.isWaterAt(o.x, o.y);
            o._tideUntil = time + 250; o._tideAtk = wet ? C.ATK_WATER : C.ATK_LAND; o._tideWet = wet;
            if (wet && Math.random() < 0.15) {   // charged by the water: a blue spark rising off it
                const m = this.add.image(o.sprite.x + (Math.random() - 0.5) * 18, o.sprite.y + (0.72 - (o.sprite.originY ?? 0.5)) * (o.sprite.displayHeight || 38), 'vfx_dot').setTint(0x6ab8ff).setBlendMode(Phaser.BlendModes.ADD).setDepth((o.sprite.depth ?? 1) + 0.05);
                this.tweens.add({ targets: m, y: m.y - 16, alpha: 0, duration: 500, onComplete: () => m.destroy() });
            }
        }
    }
    // The boost shown on whatever has it, while it lasts: a blue glow on it, and in water rings pulsing off its feet
    _tideLook(e, time) {
        const s = e.sprite, on = (e._tideUntil || 0) > time && s.visible && s.alpha > 0.3;   // (a shrouded one doesn't give itself away)
        if (!on) {
            const g = e._tideFx; e._tideFx = null;
            if (g?.active) { this.tweens.killTweensOf(g); this.tweens.add({ targets: g, alpha: 0, duration: 200, onComplete: () => g.destroy() }); }
            return;
        }
        if (!e._tideFx?.active || e._tideFx._wet !== e._tideWet) {   // in water it glows brighter and quicker than on land
            e._tideFx?.destroy();
            const a = e._tideWet ? 0.5 : 0.28;
            e._tideFx = this.add.image(s.x, s.y, 'vfx_glow').setTint(0x3a9cff).setBlendMode(Phaser.BlendModes.ADD).setScale(0.34).setAlpha(a);
            e._tideFx._wet = e._tideWet;
            this.tweens.add({ targets: e._tideFx, alpha: a * 0.45, scale: 0.3, duration: e._tideWet ? 300 : 520, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
            if (time - (e._tideSaidAt || 0) > 5000) { e._tideSaidAt = time; this.showStatusText(s.x, s.y - 34, 'FASTER ATTACKS', '#6ab8ff'); }
        }
        const H = s.displayHeight || 38, oy = s.originY ?? 0.5;   // the body sits low in its frame: its middle and its feet
        e._tideFx.setPosition(s.x, s.y + (0.72 - oy) * H).setDepth((s.depth ?? 1) + 0.01);   // over the body: it's lit up by the water
        if (e._tideWet && time - (e._tideRingAt || 0) > 600) {   // a ring on the water, flat, spreading from its feet
            e._tideRingAt = time;
            const r = this.add.image(s.x, s.y + (0.92 - oy) * H, VisualFX.auraTex(this, 'ring')).setTint(0x8fd8ff).setBlendMode(Phaser.BlendModes.ADD).setDepth((s.depth ?? 1) - 0.02).setAlpha(0.9);
            r.setDisplaySize(14, 5);
            this.tweens.add({ targets: r, scaleX: r.scaleX * 3, scaleY: r.scaleY * 3, alpha: 0, duration: 600, ease: 'Quad.easeOut', onComplete: () => r.destroy() });
        }
    }
    // How much faster than usual `e` attacks right now (a Tidecaller's boost): its attack cooldowns are divided by this
    _atkSpd(e, now = this.time.now) { return (e?._tideUntil || 0) > now ? (e._tideAtk || 1) : 1; }
    _tideCfg() { return { HP: 120, SPEED: 1.6, TIDE_R: 4, ATK_LAND: 1.2, ATK_WATER: 1.8 }; }
    createTidecaller(x, y, ri) {
        const C = this._tideCfg();
        const e = this.createEnemy(x, y, C.HP);
        e.tutorialRoomIndex = ri;
        e._waterNative = true;
        e._isTidecaller = true;
        e._moveCdMult = C.SPEED;
        if (e.sprite.setTint) e.sprite.setTint(0x2a5cc8);
        e._tideAura = VisualFX.aura(this, e.sprite.x, e.sprite.y, C.TIDE_R * this.TILE_SIZE, 0x3a8cff, { alpha: 0.55 });
        this._cisternMark(e, m => {
            m.lineStyle(2, 0x8fd8ff, 0.90);
            for (let i = 0; i < 3; i++) {
                m.beginPath();
                for (let t = -8; t <= 8; t++) m.lineTo(t, Math.sin(t / 2.6) * 2.2 - 4 + i * 4);
                m.strokePath();
            }
        });
        return e;
    }

    // ── CHEERLEADER SLIME ────────────────────────────────────────────────────
    // A pompom in each hand, and quick on her feet. She never comes for you: she runs to wherever her cheer would
    // reach the most of her friends (within R tiles, keeping KEEP_OFF from you: _cheerSeek). There, every CD, a stage
    // pops up under her, curtains, spotlights and all, and she performs on it for SHOW_MS, standing still. RAISE_AT in,
    // every other enemy within R is ENCOURAGED for DUR: it moves x MOVE as fast and hits x DMG as hard
    // (CombatSystem.takeDamage, moveEnemies), and any that come into range during the show catch it too; it all ends
    // if she dies. On stage she takes x TAKEN damage (_specialHit). She only performs with someone to cheer for.
    // Killed, everything within R of her is DISCOURAGED for DISC_MS: x DISC_SPD as fast, but braced, taking x DISC_TAKEN.
    _cheerCfg() { return { HP: 110, SPEED: 0.16, R: 5, FIRST: 2500, SHOW_MS: 6000, DUR: 6000, CD: 8000, RAISE_AT: 450, MOVE: 1.6, DMG: 3, TAKEN: 0.5,
        DISC_MS: 5000, DISC_SPD: 0.6, DISC_TAKEN: 0.6, SEEK_MS: 500, SEEK_R: 10, KEEP_OFF: 3, COL: 0xff6ad0, CSS: '#ff7ad8', DISC_COL: 0x7080b0, DISC_CSS: '#9aa8d8' }; }
    // her art (made once): a gold pompom, a heart for the ones she cheers (and its two broken halves), a spotlight's beam, the stage and its
    // curtains, her backup dancers
    static cheerArt(scene) {
        const pom = ShopScene.icon(scene, 'fx_pompom', 14, { Y: '#ffd84a', y: '#d8a020', w: '#fff3c0', p: '#ff7ad8', h: '#b04080' }, m => {
            for (let y = 0; y < 12; y++) for (let x = 0; x < 14; x++) {   // a ball of strands, ragged at the edge
                const dx = x + 0.5 - 7, dy = y + 0.5 - 6, r = Math.hypot(dx, dy), a = Math.atan2(dy, dx);
                if (r > 5.6 || (r > 4.4 && Math.sin(a * 9) < -0.2)) continue;
                const st = Math.sin(a * 9 + r * 0.6);
                m.set(x, y, st > 0.55 ? 'w' : st < -0.6 ? 'p' : dx + dy > 3 ? 'y' : 'Y');
            }
            m.rect(6, 11, 2, 3, 'h');
        });
        const heart = ShopScene.icon(scene, 'fx_cheer_heart', 9, { p: '#ff5fb0', P: '#ffb0dc' }, m => {
            m.rect(2, 2, 2, 1, 'p'); m.rect(5, 2, 2, 1, 'p'); m.rect(1, 3, 7, 2, 'p'); m.rect(2, 5, 5, 1, 'p'); m.rect(3, 6, 3, 1, 'p'); m.set(4, 7, 'p');
            m.set(2, 3, 'P'); m.set(2, 2, 'P');
        });
        const inHeart = (x, y) => (y === 2 && (x === 2 || x === 3 || x === 5 || x === 6)) || ((y === 3 || y === 4) && x >= 1 && x <= 7) || (y === 5 && x >= 2 && x <= 6) || (y === 6 && x >= 3 && x <= 5);
        const CRACK = { 2: 4, 3: 5, 4: 4, 5: 3, 6: 4 };   // a zigzag down its middle
        const broke = [true, false].map(left => ShopScene.icon(scene, left ? 'fx_heartbreak_l' : 'fx_heartbreak_r', 9, { p: '#a8507a', P: '#d890b0' }, m => {
            for (let y = 2; y < 7; y++) for (let x = 1; x < 8; x++) if (inHeart(x, y) && (left ? x < CRACK[y] : x > CRACK[y])) m.set(x, y, 'p');
            if (left) m.set(2, 3, 'P');
        }));
        if (!scene.textures.exists('fx_spot')) {   // a cone of light, narrow at its lamp, wide and bright where it lands, soft at its sides
            const W = 64, H = 128, t = scene.textures.createCanvas('fx_spot', W, H), ctx = t.getContext(), img = ctx.createImageData(W, H);
            for (let y = 0; y < H; y++) {
                const f = y / (H - 1), half = 5 + 26 * f;
                for (let x = 0; x < W; x++) {
                    const d = Math.abs(x + 0.5 - W / 2) / half;
                    if (d >= 1) continue;
                    const i = (y * W + x) * 4, a = (1 - d * d) * (0.15 + 0.6 * f) * Math.min(1, f * 6);
                    img.data[i] = 255; img.data[i + 1] = 244; img.data[i + 2] = 214; img.data[i + 3] = Math.round(255 * a);
                }
            }
            ctx.putImageData(img, 0, 0); t.refresh();
        }
        const stage = MenuArt.tex(scene, 'fx_cheer_stage', 96, 20, P => {   // a wooden deck, gold trim, a red skirt hung with bunting
            for (let x = 0; x < 96; x++) {
                for (let y = 0; y < 7; y++) {
                    if ((x < 2 || x > 93) && y === 0) continue;
                    P.put(x, y, y === 0 ? 0xc08a54 : y === 6 ? 0x4a2a14 : x % 9 === 0 ? 0x6a4024 : 0x9a6438);
                }
                P.put(x, 7, 0xffd84a); P.put(x, 8, 0xb8862a);
                const fold = Math.sin(x * 1.1), edge = x === 0 || x === 95;
                for (let y = 9; y < 19; y++) P.put(x, y, edge ? 0x1c1728 : fold > 0.5 ? 0xd83048 : fold < -0.5 ? 0x7a0c20 : 0xb01830);
                P.put(x, 19, 0x2a0610);
                const seg = Math.floor(x / 8), u = x - seg * 8;
                if (!edge) for (let y = 9; y < 9 + 4 - Math.abs(u - 3.5); y++) P.put(x, y, [0xff5fb0, 0xffd84a, 0x6ad8ff, 0xffffff][seg % 4]);
            }
        });
        const back = MenuArt.tex(scene, 'fx_cheer_back', 92, 60, P => {   // the back curtain, side drapes tied with gold, a scalloped valance of bulbs
            for (let y = 6; y < 60; y++) for (let x = 10; x < 82; x++) {
                const f = Math.sin(x * 0.9);
                P.put(x, y, f > 0.6 ? 0x7a1226 : f < -0.6 ? 0x3a0610 : 0x5a0a18);
            }
            for (const side of [0, 1]) for (let y = 4; y < 60; y++) {
                const w = y < 39 ? 12 - (y - 4) / 35 * 5 : 7 + (y - 39) / 21 * 5;
                for (let i = 0; i < w; i++) {
                    const f = Math.sin(i * 1.3 + side);
                    P.put(side ? 91 - i : i, y, i === Math.ceil(w) - 1 ? 0x4a0814 : f > 0.5 ? 0xd83048 : f < -0.5 ? 0x7a0c20 : 0xb01830);
                }
                if (y >= 38 && y <= 40) for (let i = 0; i < 9; i++) P.put(side ? 91 - i : i, y, y === 39 ? 0xffd84a : 0xb8862a);
            }
            for (let x = 0; x < 92; x++) {
                const b = 8 + Math.round(2.5 * Math.abs(Math.sin(x * Math.PI / 12)));
                for (let y = 0; y < b; y++) P.put(x, y, y === 0 ? 0x7a0c20 : 0xc01c34);
                P.put(x, b, 0xffd84a); P.put(x, b + 1, 0x8a5a14);
                if (x % 8 === 3) for (const [bx, by, c] of [[0, 3, 0xfff3c0], [1, 3, 0xfff3c0], [0, 4, 0xffd84a], [1, 4, 0xffd84a]]) P.put(x + bx, by, c);
            }
        });
        // a backup dancer: a little slime with a bow, two frames (down, then up with its pompoms high), in two colours
        const dancer = (key, B, b, L) => ShopScene.icon(scene, key, 18, { B, b, L, Y: '#ffd84a', y: '#c89a2a', w: '#ffffff', r: '#ff7ad8' }, (m, f) => {
            const cy = f ? 11.5 : 12.5, rx = f ? 5.4 : 6.4, ry = f ? 5 : 4;
            for (let y = 0; y < 17; y++) for (let x = 0; x < 18; x++) {
                const dx = (x + 0.5 - 9) / rx, dy = (y + 0.5 - cy) / ry;
                if (y + 0.5 > 16.5 || dx * dx + dy * dy > 1) continue;
                m.set(x, y, dy > 0.45 ? 'b' : dx < -0.2 && dy < -0.2 ? 'L' : 'B');
            }
            const ey = f ? 11 : 12;
            m.set(7, ey, 'k'); m.set(11, ey, 'k'); m.set(7, ey - 1, 'w'); m.set(11, ey - 1, 'w');
            const top = Math.round(cy - ry);
            m.set(8, top - 1, 'r'); m.set(10, top - 1, 'r'); m.set(9, top - 1, 'r'); m.set(8, top - 2, 'r'); m.set(10, top - 2, 'r');   // its bow
            for (const sx of [2.5, 15.5]) m.disc(sx, f ? 5 : 13, 2, 'Y');   // pompoms: low, then thrown up
            m.set(2, f ? 4 : 12, 'w'); m.set(15, f ? 4 : 12, 'w');
        }, 2);
        return { pom, heart, broke, spot: 'fx_spot', stage, back, dancers: [dancer('fx_dancer_a', '#5ad0f0', '#2a7ab0', '#c0f4ff'), dancer('fx_dancer_b', '#ffb84a', '#c06a20', '#ffe8b0')] };
    }
    createCheerleader(x, y, ri) {
        const C = this._cheerCfg();
        const e = this.createEnemy(x, y, C.HP);
        e.tutorialRoomIndex = ri;
        e._isCheer = true; e._special = true;
        e._moveCdMult = C.SPEED; e._cheerNext = this.time.now + C.FIRST;
        const k = LevelManager.bodyKey(this, 'cheer');
        if (k) { e.sprite.setTexture(k, 0); e.sprite.play(k + '_idle'); }
        const A = LevelManager.cheerArt(this);
        e._pomL = this.add.image(e.sprite.x, e.sprite.y, A.pom).setFlipX(true);
        e._pomR = this.add.image(e.sprite.x, e.sprite.y, A.pom);
        e._pomPhase = Math.random() * 6; e._pomUp = [0, 0];
        return e;
    }
    // Where her cheer would reach the most friends (and not too near you): her goal tile, picked again every SEEK_MS
    // (moveEnemies walks her there instead of at you)
    _cheerSeek(e, time, C) {
        if (time - (e._seekAt || 0) < C.SEEK_MS) return;
        e._seekAt = time;
        const fans = this.enemies.filter(o => o !== e && o.sprite?.active && o.health > 0);
        const room = this._roomGated?.() ? this.rooms?.[e.tutorialRoomIndex] : null;
        let best = null, top = -Infinity;
        for (let dx = -C.SEEK_R; dx <= C.SEEK_R; dx++) for (let dy = -C.SEEK_R; dy <= C.SEEK_R; dy++) {
            const x = e.x + dx, y = e.y + dy, here = !dx && !dy;
            if (this.world[x]?.[y] !== this.FLOOR || (!here && this.getEnemyAt(x, y))) continue;
            if (room && (x < room.x || y < room.y || x >= room.x + room.w || y >= room.y + room.h)) continue;
            const pd = Math.hypot(x - this.playerX, y - this.playerY);
            if (pd < C.KEEP_OFF) continue;
            let n = 0, far = 0;
            for (const o of fans) { const d = Math.hypot(o.x - x, o.y - y); if (d <= C.R) { n++; far += d; } }
            const score = n * 10 - (n ? far / n : 0) * 0.8 + (here ? 1 : 0) - Math.hypot(dx, dy) * 0.08 + Math.min(pd, 8) * 0.1;   // the most friends, right at their side; then staying put, near, away from you
            if (score > top) { top = score; best = [x, y]; }
        }
        if (best && (best[0] !== e._goalX || best[1] !== e._goalY)) { e._goalX = best[0]; e._goalY = best[1]; e._goalSince = time; e._committedPath = null; }
    }
    // Every frame: her goal, the show, and the pompoms (swaying at her sides; up and down in turn while she performs)
    _cheerTick(e, time) {
        const C = this._cheerCfg(), s = e.sprite;
        const H = s.displayHeight || 38, mid = s.y + (0.72 - (s.originY ?? 0.5)) * H, side = 0.36 * (s.displayWidth || 38);
        const stuck = e.isFrozen || e.isStunned || e._iceCube || this._deathScreenActive;
        if (e._cheerStart && (stuck || time >= e._cheerStart + C.SHOW_MS)) { this._cheerEnd(e); e._cheerNext = time + C.CD; }
        if (!e._cheerStart) this._cheerSeek(e, time, C);
        const near = () => this.enemies.filter(o => o !== e && o.sprite?.active && o.health > 0 && Math.hypot(o.x - e.x, o.y - e.y) <= C.R);
        if (!e._cheerStart && !stuck && time >= e._cheerNext) {
            const there = e._goalX == null || (e.x === e._goalX && e.y === e._goalY) || time - (e._goalSince || 0) > 2500;
            const gatedOut = this._roomGated?.() && (e.tutorialRoomIndex ?? -1) !== this.getCurrentPlayerRoom();
            if (!there || gatedOut || !near().length) e._cheerNext = time + 300;
            else this._cheerShow(e, time);
        }
        let want = [0, 0];
        if (e._cheerStart) {
            const el = time - e._cheerStart, beat = Math.floor(el / 350);
            if (!e._cheerDone && el >= C.RAISE_AT) this._cheerGo(e, time);
            if (e._cheerDone) for (const o of near()) if (!((o._cheerUntil || 0) > time)) {   // walked into the show: caught up in it
                o._cheerUntil = e._cheerStart + C.RAISE_AT + C.DUR; o._cheerDmg = C.DMG; o._cheerSpd = C.MOVE; o._cheerBy = e;
                this.showStatusText(o.sprite.x, o.sprite.y - 30, 'ENCOURAGED!', C.CSS);
            }
            if (el > 300 && beat !== e._cheerBeat) {   // the routine: a hop on every other beat, both pompoms up every fourth
                e._cheerBeat = beat;
                if (beat % 2 === 0) this._vfxHop?.(s, e._baseScale ?? this.SLIME_SCALE, 220);
                if (beat % 4 === 3) this._cheerConfetti(s, 8);
            }
            const ramp = Math.min(1, el / 250) * Math.min(1, (C.SHOW_MS - el) / 250);
            want = (beat % 4 === 3 ? [1, 1] : beat % 2 ? [1, 0.15] : [0.15, 1]).map(v => v * ramp);
        }
        e._pomUp = e._pomUp.map((u, i) => u + (want[i] - u) * 0.35);
        const bob = Math.sin(time * 0.006 + e._pomPhase), vis = s.visible && !e._phasedOut, al = s.alpha ?? 1;
        [[e._pomL, -1, e._pomUp[0]], [e._pomR, 1, e._pomUp[1]]].forEach(([pm, dir, up]) => {
            if (!pm?.active) return;
            const shake = up > 0.3 ? Math.sin(time * 0.05 + dir) * 0.5 : Math.sin(time * 0.004 + e._pomPhase) * 0.18;
            pm.setVisible(vis).setAlpha(al).setDepth((s.depth ?? 1) + 0.02)
                .setPosition(s.x + dir * (side + 5 * up), mid + 5 + bob * 1.5 * dir - up * 26)
                .setRotation(dir * (0.35 - 0.6 * up) + shake * dir).setScale(1 + 0.2 * up);
        });
        if (e._cheerStage?.active) {
            e._cheerStage.setPosition(...this._cheerAnchor(e)).setDepth((s.depth ?? 1) - 0.03);
            e._cheerDancers.forEach((dn, i) => { dn.y = -1 - Math.abs(Math.sin(time * 0.009 + i * Math.PI / 2)) * 4; dn.setRotation(Math.sin(time * 0.006 + i * 2) * 0.12); });
        }
        if (e._cheerStart && Math.random() < 0.25) {   // dust glittering in the lights
            const feet = s.y + (0.92 - (s.originY ?? 0.5)) * H;
            const m = this.add.image(s.x + (Math.random() - 0.5) * 50, feet - 6 - Math.random() * 50, 'vfx_dot').setTint(0xfff4d0).setBlendMode(Phaser.BlendModes.ADD).setScale(0.4).setDepth((s.depth ?? 1) - 0.025);
            this.tweens.add({ targets: m, y: m.y + 10, alpha: 0, duration: 600, onComplete: () => m.destroy() });
        }
    }
    // Where her stage stands: her tile, at her feet (not her sprite, which may be mid-step)
    _cheerAnchor(e) {
        const s = e.sprite, T = this.TILE_SIZE;
        return [e.x * T + T / 2, e.y * T + T / 2 + (this.SLIME_Y_OFFSET || 0) + (0.92 - (s.originY ?? 0.5)) * (s.displayHeight || 38)];
    }
    // The stage pops up under her (curtains behind, the deck at her feet, a backup dancer each side), she hops on, the lights snap on.
    // All of it in one container just behind her, so it stays round her tile.
    _cheerShow(e, time) {
        const A = LevelManager.cheerArt(this), s = e.sprite, T = this.TILE_SIZE, [ax, ay] = this._cheerAnchor(e);
        e._cheerStart = time; e._cheerDone = false; e._cheerBeat = -1;
        e._cheerHold = e._moveCdMult; e._moveCdMult = 999; e._committedPath = null;
        this.tweens.killTweensOf(s); s.setPosition(e.x * T + T / 2, e.y * T + T / 2 + (this.SLIME_Y_OFFSET || 0)); this.updateEnemyHealthBar?.(e);   // on her mark, centre stage
        const box = this.add.container(ax, ay).setDepth((s.depth ?? 1) - 0.03);
        const back = this.add.image(0, -3, A.back).setOrigin(0.5, 1).setScale(1, 0);
        const stage = this.add.image(0, -5, A.stage).setOrigin(0.5, 0).setScale(1, 0);
        const pool = this.add.image(0, -2, 'vfx_glow').setTint(0xffe8c0).setBlendMode(Phaser.BlendModes.ADD).setScale(0.55, 0.13).setAlpha(0);
        const dancers = A.dancers.map((k, i) => this.add.sprite(i ? 26 : -26, -1, k, '0').setOrigin(0.5, 1).setScale(0).play(k));
        const beams = [-1, 1].map(k => {   // from lamps at the valance's ends down onto her
            const dx = -k * 42, dy = 48;
            return this.add.image(k * 42, -56, A.spot).setOrigin(0.5, 0).setBlendMode(Phaser.BlendModes.ADD).setDisplaySize(44, Math.hypot(dx, dy) + 12)
                .setRotation(Math.atan2(-dx, dy)).setAlpha(0);
        });
        box.add([back, stage, pool, ...dancers, ...beams]);
        e._cheerStage = box; e._cheerDancers = dancers; e._cheerFold = [back, stage];
        this.tweens.add({ targets: back, scaleY: 1, duration: 240, ease: 'Back.easeOut' });
        this.tweens.add({ targets: stage, scaleY: 1, duration: 160, ease: 'Back.easeOut' });
        this.tweens.add({ targets: dancers, scale: 1.2, duration: 220, delay: 180, ease: 'Back.easeOut' });
        this.tweens.add({ targets: [pool, ...beams], alpha: 0.55, delay: 260, duration: 80 });
        this._vfxHop?.(s, e._baseScale ?? this.SLIME_SCALE, 280);
        this.showStatusText(s.x, s.y - 40, 'SHOWTIME!', this._cheerCfg().CSS);
        Sfx.play(this, 'slam', { small: true });
        this.time.delayedCall(260, () => { if (e._cheerStart === time) Sfx.play(this, 'cheer'); });
    }
    _cheerConfetti(s, n) {
        if (!this.textures.exists('__WHITE')) return;
        const conf = this.add.particles(s.x, s.y - 10, '__WHITE', { speed: { min: 80, max: 170 }, angle: { min: 210, max: 330 }, gravityY: 320, lifespan: 1000,
            scale: { min: 0.8, max: 1.4 }, rotate: { min: 0, max: 360 }, alpha: { start: 1, end: 0 }, tint: [0xff5fb0, 0xffd84a, 0x6ad8ff, 0xffffff], emitting: false }).setDepth((s.depth ?? 1) + 0.05);
        conf.explode(n); this.time.delayedCall(1100, () => conf.destroy());
    }
    // The cheer lands: everyone close is encouraged; confetti and a pink ring go out
    _cheerGo(e, time) {
        const C = this._cheerCfg(), s = e.sprite;
        e._cheerDone = true;
        VisualFX.ripple(this, s.x, s.y + 6, 10, C.R * this.TILE_SIZE, C.COL, { duration: 600, alpha: 0.7 });
        this._cheerConfetti(s, 26);
        for (const o of this.enemies) {
            if (o === e || !o.sprite?.active || o.health <= 0 || Math.hypot(o.x - e.x, o.y - e.y) > C.R) continue;
            o._cheerUntil = time + C.DUR; o._cheerDmg = C.DMG; o._cheerSpd = C.MOVE; o._cheerBy = e;
            this.showStatusText(o.sprite.x, o.sprite.y - 30, 'ENCOURAGED!', C.CSS);
        }
    }
    // The show's over (or cut short): the lights go, the stage folds away, she can move again. Dead, her cheer goes with her,
    // and everything close loses heart: discouraged
    _cheerEnd(e, dead) {
        e._cheerStart = 0;
        if (dead) {
            const C = this._cheerCfg(), now = this.time.now;
            for (const o of this.enemies || []) {
                if (o === e || !o.sprite?.active || o.health <= 0) continue;
                if (o._cheerBy === e) { o._cheerUntil = 0; o._cheerBy = null; }
                if (Math.hypot(o.x - e.x, o.y - e.y) > C.R) continue;
                o._discUntil = now + C.DISC_MS; o._discSpd = C.DISC_SPD; o._discTaken = C.DISC_TAKEN;
                this.showStatusText(o.sprite.x, o.sprite.y - 30, 'DISCOURAGED', C.DISC_CSS);
            }
        }
        if (e._cheerHold != null) { e._moveCdMult = e._cheerHold; e._cheerHold = null; }
        const box = e._cheerStage; e._cheerStage = null;
        if (box?.active) {
            for (const g of box.list) this.tweens.killTweensOf(g);
            this.tweens.add({ targets: e._cheerFold, scaleY: 0, duration: 220, ease: 'Quad.easeIn' });
            this.tweens.add({ targets: e._cheerDancers, scale: 0, duration: 160, ease: 'Quad.easeIn' });
            this.tweens.add({ targets: box, alpha: 0, duration: 240, ease: 'Quad.easeIn', onComplete: () => box.destroy() });
        }
    }
    // Discouraged, while it lasts: a grey-blue pall and broken hearts splitting and falling off it (its slowness shows in the chevrons)
    _discLook(e, time) {
        const s = e.sprite, on = (e._discUntil || 0) > time && s.visible && s.alpha > 0.3;
        if (!on) {
            const g = e._discFx; e._discFx = null;
            if (g?.active) { this.tweens.killTweensOf(g); this.tweens.add({ targets: g, alpha: 0, duration: 200, onComplete: () => g.destroy() }); }
            return;
        }
        const H = s.displayHeight || 38, mid = s.y + (0.72 - (s.originY ?? 0.5)) * H, d = s.depth ?? 1;
        if (!e._discFx?.active) {
            e._discFx = this.add.image(s.x, mid, 'vfx_glow').setTint(this._cheerCfg().DISC_COL).setBlendMode(Phaser.BlendModes.ADD).setScale(0.34).setAlpha(0.35);
            this.tweens.add({ targets: e._discFx, alpha: 0.15, duration: 700, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
        }
        e._discFx.setPosition(s.x, mid).setDepth(d + 0.01);
        if (time - (e._breakAt || 0) > 600) {
            e._breakAt = time;
            const x = s.x + (Math.random() - 0.5) * 12, y = mid - 16;
            LevelManager.cheerArt(this).broke.forEach((k, i) => {
                const h = this.add.image(x + (i ? 1 : -1), y, k).setDepth(d + 0.05);
                this.tweens.add({ targets: h, x: h.x + (i ? 4 : -4), y: y + 10, angle: i ? 28 : -28, alpha: 0, duration: 850, ease: 'Quad.easeIn', onComplete: () => h.destroy() });
            });
        }
    }
    // Encouraged, while it lasts: a pink glow on it and hearts rising off it (its speed shows in the chevrons)
    _cheerLook(e, time) {
        const s = e.sprite, on = (e._cheerUntil || 0) > time && s.visible && s.alpha > 0.3;
        if (!on) {
            const g = e._cheerFx; e._cheerFx = null;
            if (g?.active) { this.tweens.killTweensOf(g); this.tweens.add({ targets: g, alpha: 0, duration: 200, onComplete: () => g.destroy() }); }
            return;
        }
        const H = s.displayHeight || 38, mid = s.y + (0.72 - (s.originY ?? 0.5)) * H;
        if (!e._cheerFx?.active) {
            e._cheerFx = this.add.image(s.x, mid, 'vfx_glow').setTint(this._cheerCfg().COL).setBlendMode(Phaser.BlendModes.ADD).setScale(0.36).setAlpha(0.5);
            this.tweens.add({ targets: e._cheerFx, alpha: 0.2, scale: 0.3, duration: 260, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
        }
        e._cheerFx.setPosition(s.x, mid).setDepth((s.depth ?? 1) + 0.01);
        if (time - (e._heartAt || 0) > 420) {
            e._heartAt = time;
            const h = this.add.image(s.x + (Math.random() - 0.5) * 16, mid - 10, LevelManager.cheerArt(this).heart).setDepth((s.depth ?? 1) + 0.05).setScale(0.9);
            this.tweens.add({ targets: h, y: h.y - 18, alpha: 0, scale: 1.2, duration: 700, ease: 'Quad.easeOut', onComplete: () => h.destroy() });
        }
    }

    // ── WAVE RIDER — the terrain ────────────────────────────────────────────
    // Lays water in its own wake, so every pass leaves the floor worse than it
    // found it. Fighting it in place is how the room drowns.
    createWaveRider(x, y, ri) {
        const e = this.createBerserker(x, y, ri);
        e.tutorialRoomIndex = ri;
        e._waterNative = true;
        e._isWaveRider = true;
        e.health = e.maxHealth = Math.round(140 * (this.enemyHealthScale || 1));
        this.updateEnemyHealthBar(e);
        // It walks like anything else and leaves the floor alone. The water only appears
        // when it commits to a charge -- the terrain change IS the attack.
        e._waveState   = 'walk';
        e._waveCd      = 7000;
        e._waveLastEnd = 0;
        e._waveTellMs  = 900;   // dry
        e._waveTellWet = 600;   // soaked — less time to leave the lane
        e._waveEngageR = 14;     // tiles — it is a spatial threat, so it should commit
                                 // from across a room rather than only up close
        // You move 80 px/s (200ms per 16px tile). It starts BELOW that on purpose: the
        // threat is the lane it floods and denies, not the chase. It only becomes
        // frightening if you let it build a long runway.
        //   0 tiles  ->  45 px/s  (0.56x you — walk away)
        //   5 tiles  ->  93 px/s  (1.2x)
        //  10 tiles  -> 141 px/s  (1.8x)
        //  20 tiles  -> 230 px/s  (2.9x, capped)
        e._waveSpeed0  = 45;     // px/s at the start of the charge
        e._waveAccel   = 0.6;    // px/s gained per pixel travelled
        e._waveSpeedMax= 230;
        e._waveHalfW   = 2.5;    // tiles either side -> a 5-wide carpet
        e._waveDmg     = 12;
        e._waveHitGap  = 500;    // ms between hits while you are in it
        if (e.sprite.setTint) e.sprite.setTint(0xdff3ff);
        this._cisternMark(e, m => {
            m.fillStyle(0xffffff, 0.75);
            m.fillTriangle(-9, 4, 0, -6, 9, 4);
            m.lineStyle(1.2, 0x8fd8ff, 0.80); m.strokeCircle(0, 0, 11);
        });
        return e;
    }

    _waveTell(e) {
        Sfx.play(this, 'tell', { ms: 700 });
        const g = this.add.graphics().setDepth(6);
        g.fillStyle(0x1b3f6b, 0.6); g.fillCircle(0, 0, 12);
        g.lineStyle(2.4, 0xdff3ff, 0.95); g.strokeCircle(0, 0, 12);
        g.fillStyle(0xffffff, 0.95);
        g.fillRect(-1.5, -7.5, 3, 8.5);
        g.fillCircle(0, 5, 1.8);
        g.x = e.sprite.x; g.y = e.sprite.y - 30;
        this.tweens.add({ targets: g, scaleX: 1.3, scaleY: 1.3, duration: 220,
                          yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
        e._waveTellGfx = g;
        (this._waveTells = this._waveTells || new Set()).add(g);
        g._owner = e;
    }

    _waveClearTell(e) {
        if (!e._waveTellGfx) return;
        this._waveTells?.delete(e._waveTellGfx);
        if (e._waveTellGfx.active) e._waveTellGfx.destroy();
        e._waveTellGfx = null;
    }

    // Pixel-space charge. Lays a 5-wide carpet, accelerates the further it gets, and
    // only stops at a wall.
    _updateWaveCharge(e, time, delta) {
        const TS = this.TILE_SIZE, dt = Math.min(delta, 50) / 1000;
        e._waveSpeed = Math.min(e._waveSpeedMax, e._waveSpeed0 + e._waveDist * e._waveAccel);
        const mx = e._waveDx * e._waveSpeed * dt, my = e._waveDy * e._waveSpeed * dt;
        const nx = e.sprite.x + mx, ny = e.sprite.y + my;
        const ntx = Math.floor(nx / TS), nty = Math.floor((ny - (this.SLIME_Y_OFFSET || -10)) / TS);

        // Wall ends the charge.
        if (this.world?.[ntx]?.[nty] !== this.FLOOR || this.isInLockedRoom(ntx, nty)) {
            e._waveState = 'walk';
            e._waveLastEnd = time;
            e._moveCdMult = 1.0;
            this._setSpeedIndicator?.(e, 'wave', 'speed_anchor', false);
            this.showStatusText?.(e.sprite.x, e.sprite.y - 26, 'SPENT', '#8fd8ff');
            const crash = this.add.graphics().setDepth(2.4);
            crash.x = e.sprite.x; crash.y = e.sprite.y;
            crash.lineStyle(3, 0xdff3ff, 0.9); crash.strokeCircle(0, 0, 14);
            this.tweens.add({ targets: crash, alpha: 0, scaleX: 3, scaleY: 3,
                duration: 340, onComplete: () => crash.destroy() });
            return;
        }

        e.sprite.x = nx; e.sprite.y = ny;
        e.x = ntx; e.y = nty;
        e._waveDist += Math.hypot(mx, my);

        // Carpet: 5 tiles across, perpendicular to travel.
        const perpX = -e._waveDy, perpY = e._waveDx;
        for (let k = -2; k <= 2; k++) {
            const wx = Math.floor((nx + perpX * k * TS) / TS);
            const wy = Math.floor((ny - (this.SLIME_Y_OFFSET || -10) + perpY * k * TS) / TS);
            if (this.world?.[wx]?.[wy] !== this.FLOOR) continue;
            this.addWater(wx, wy, 0);
        }

        // Are you in the wave? Perpendicular distance inside half-width, and roughly
        // level with the front. Either that or standing right next to the rider.
        const dxp = this.player.x - e.sprite.x, dyp = this.player.y - e.sprite.y;
        const along = dxp * e._waveDx + dyp * e._waveDy;
        const perp  = Math.abs(dxp * perpX + dyp * perpY);
        const inWave = perp <= e._waveHalfW * TS && Math.abs(along) <= 2 * TS;
        const nearRider = Math.hypot(dxp, dyp) <= 2 * TS;

        if ((inWave || nearRider) && time - (e._waveLastHit || 0) >= e._waveHitGap) {
            e._waveLastHit = time;
            this.takeDamage(e._waveDmg * (this.enemyDamageScale || 1));
            this._waterSlowUntil = Math.max(this._waterSlowUntil || 0, time + 1500);
            // Shoved two tiles along the wave, as far as the floor allows.
            let px = this.playerX, py = this.playerY;
            for (let step = 0; step < 2; step++) {
                const tx = px + Math.round(e._waveDx), ty = py + Math.round(e._waveDy);
                if (this.world?.[tx]?.[ty] !== this.FLOOR) break;
                if (this.isInLockedRoom(tx, ty)) break;
                px = tx; py = ty;
            }
            if ((px !== this.playerX || py !== this.playerY) && (this._iceShellUntil || 0) <= this.time.now) {   // (not through the ice ult's shell)
                this.playerX = px; this.playerY = py;
                this.tweens.add({ targets: this.player,
                    x: px * TS + TS / 2, y: py * TS + TS / 2 + (this.SLIME_Y_OFFSET || -10),
                    duration: 120, ease: 'Quad.easeOut' });
            }
            this.showStatusText?.(this.player.x, this.player.y - 30, 'SWEPT', '#dff3ff');
        }
    }

    // ── WISHING WELL — the source ───────────────────────────────────────────
    // The only thing in the level whose whole job is making water. It never attacks and
    // never moves. Every few seconds it LOBS two to four globs of water on a high arc --
    // over pillars, over walls, nothing is checked along the flight -- and each one bursts
    // into a ragged puddle where it lands. It also soaks every ally in reach, so for two
    // seconds they behave as if standing in water. Kill it or the room keeps refilling.
    // ── FROST SLIME ──────────────────────────────────────────────────────────
    // Dies twice. The first time, it encases itself in an ice statue (STATUE_HP × its health,
    // can't move or attack) and a ring of frost fills round it over THAW_MS. Break the statue
    // before the ring closes and it's gone for good. Let it thaw and it hatches FROSTBORN:
    // HP_MULT × its health, much faster, MELEE damage per hit, and a haze of HAZE_R tiles that
    // slows you while you're in it (killEnemy calls _frostEncase; _updateCisternEnemies runs it).
    // Its attack is the FROST GRID (2026-10-20): it stops and lights the square of GRID_R tiles round it like a Tidal Guard's aim,
    // then it all goes off at once. The safe tiles fall at random, never closer than GRID_GAP tiles to each other (GRID_GAP_BORN
    // for a Frostborn), and as many as fit, so one is always a step or two away.
    _frostCfg() { return { STATUE_HP: 2.6, THAW_MS: 11000, HP_MULT: 3, SPEED: 0.45, MELEE: 5, HAZE_R: 2.5, HAZE_SLOW: 1.8,   // (the statue: 1.5x and 7s till 2026-10-20)
        GRID_R: 4, GRID_CD: 4200, GRID_AIM: 1400, GRID_AIM_BORN: 1250, GRID_DMG: 8, GRID_DMG_BORN: 13, GRID_BORN_CD: 0.75, GRID_GAP: 2, GRID_GAP_BORN: 3 }; }
    createFrostSlime(x, y, ri) {
        const e = this.createEnemy(x, y, 120);
        e.tutorialRoomIndex = ri;
        e._waterNative = true;
        e._isFrost = true;
        const fk = LevelManager.frostSlimeKey(this, false);   // its own body: the slime recoloured in ice (it was the red one tinted, then your blue one)
        if (fk) { e.sprite.setTexture(fk, 0); e.sprite.play(fk + '_idle'); }
        this._cisternMark(e, m => {                         // a snowflake
            m.lineStyle(1.6, 0xdff8ff, 0.95);
            for (let k = 0; k < 3; k++) { const a = k * Math.PI / 3; m.lineBetween(-Math.cos(a) * 6, -Math.sin(a) * 6, Math.cos(a) * 6, Math.sin(a) * 6); }
            m.fillStyle(0x9fe8ff, 1); m.fillCircle(0, 0, 1.6);
        });
        return e;
    }
    // From killEnemy, on a frost slime's first death: the statue instead. True if it encased.
    _frostEncase(e) {
        if (!e._isFrost || e._frostStage || !e.sprite?.active) return false;
        const F = this._frostCfg(), now = this.time.now, T = this.TILE_SIZE;
        e._frostStage = 'statue';
        e._frostOrig = e.maxHealth;
        e.maxHealth = e.health = Math.round(e.maxHealth * F.STATUE_HP);
        e._frostUntil = now + F.THAW_MS;
        e._frostMoveCd = e._fgAim ? e._fgHold : e._moveCdMult; e._moveCdMult = 999;
        e.isStunned = true; e.stunnedUntil = e._frostUntil;
        this.updateEnemyHealthBar?.(e);
        const key = LevelManager.frostBlockKey(this);
        e._frostGfx = this.add.image(e.sprite.x, e.sprite.y + 6, key).setScale(1.7).setDepth((e.sprite.depth ?? 1) + 0.02).setAlpha(0);
        e._frostRing = this.add.graphics().setDepth((e.sprite.depth ?? 1) - 0.02);
        this.tweens.add({ targets: e._frostGfx, alpha: 0.92, scale: 1.8, duration: 220, ease: 'Back.easeOut' });
        this._vfxBursts?.ice?.explode(18, e.sprite.x, e.sprite.y);
        Sfx.play(this, 'freeze');
        this.showStatusText(e.sprite.x, e.sprite.y - 28, 'ENCASED!', '#bff4ff');
        return true;
    }
    // Every frame (the Cistern's update): the statue's thaw ring, then the hatch; the
    // Frostborn's haze, and you slowed inside it.
    _frostUpdate(e, time) {
        const F = this._frostCfg(), T = this.TILE_SIZE, s = e.sprite;
        if (e._frostStage !== 'statue') this._frostGridTick(e, time);
        if (e._frostStage === 'statue') {
            const k = 1 - Math.max(0, (e._frostUntil - time) / F.THAW_MS);
            e._frostGfx?.setPosition(s.x + (k > 0.75 ? (Math.random() - 0.5) * 3 * k : 0), s.y + 6);
            const g = e._frostRing;
            if (g?.active) {
                g.clear().setPosition(s.x, s.y + 14);
                g.lineStyle(3, 0x0b2a3a, 0.7).strokeCircle(0, 0, 18);
                g.lineStyle(3, k > 0.75 ? 0xffffff : 0x9fe8ff, 0.95);
                g.beginPath(); g.arc(0, 0, 18, -Math.PI / 2, -Math.PI / 2 + k * Math.PI * 2); g.strokePath();
            }
            if (time >= e._frostUntil && !e._frostCine) { e._frostCine = true; this._rebirthCinematic(s.x, s.y, () => { if (e.sprite?.active && e._frostStage === 'statue') this._frostHatch(e); }); }   // the moment it breaks out, shown up close
            return;
        }
        if (e._frostStage === 'awake') {
            e._frostHaze?.setPosition(s.x, s.y + 8);
            if (Math.random() < 0.15) {
                const a = Math.random() * Math.PI * 2, r = Math.random() * F.HAZE_R * T;
                const m = this.add.image(s.x + Math.cos(a) * r, s.y + Math.sin(a) * r * 0.7, 'vfx_dot').setTint(0xdff8ff).setAlpha(0.7).setDepth(4.2);
                this.tweens.add({ targets: m, y: m.y - 12, alpha: 0, duration: 700, onComplete: () => m.destroy() });
            }
            if (Math.hypot(this.playerX - e.x, this.playerY - e.y) <= F.HAZE_R) {
                this._frostHazeMult = F.HAZE_SLOW;
            }
        }
    }
    // GLU: no dashing while it holds. Given by a Frost Slime's lit grid (while you're in it), an Ult Absorber's stolen lightning
    // (SHORTED), the ice ult's shell; read by every way a dash starts (GameScene's dash queue, the cosmic hops). label: what pops
    // up over you when it takes hold (null: nothing, when something else already says so).
    _applyGlu(ms, label = 'GLU') {
        const now = this.time.now, fresh = !(this._gluUntil > now);
        this._gluUntil = Math.max(this._gluUntil || 0, now + ms);
        if (fresh && label && this.player?.active) { this.showStatusText(this.player.x, this.player.y - 30, label, '#e8c84a'); Sfx.play(this, 'status', { kind: 'glu' }); }
    }
    _glued() { return this._gluUntil > this.time.now; }
    // Every frame: a Frost Slime's grid keeps it on you while you're in it, and while it holds there's goo at your feet
    _updateGlu() {
        if (this._frostPinned()) this._applyGlu(150);
        const p = this.player, on = this._glued() && p?.active;
        if (!on) { if (this._gluFx) { this._gluFx.destroy(); this._gluFx = null; } return; }
        const g = this._gluFx?.active ? this._gluFx : (this._gluFx = this.add.graphics()), t = this.time.now;
        g.clear().setPosition(p.x, p.y + 6).setDepth((p.depth ?? 2) - 0.05);
        g.fillStyle(0xb88a28, 0.6).fillEllipse(0, 0, 30 + Math.sin(t * 0.006) * 2, 10);
        g.fillStyle(0xf0d060, 0.6).fillEllipse(-4, -1, 12, 4);
        for (let k = 0; k < 3; k++) { const a = k / 3 * Math.PI * 2 + t * 0.002; g.fillStyle(0xb88a28, 0.75).fillCircle(Math.cos(a) * 12, Math.sin(a) * 3 - 1, 2); }   // strings of it
    }
    // Inside a Frost Slime's lit grid (its square, while the telegraph runs): no dashing out of it (a Glu, _updateGlu)
    _frostPinned() {
        const R = this._frostCfg().GRID_R;
        return (this.enemies || []).some(e => e._isFrost && e._fgAim && e.sprite?.active && Math.max(Math.abs(this.playerX - e.x), Math.abs(this.playerY - e.y)) <= R);
    }
    // ── BUDDING SLIME ────────────────────────────────────────────────────────
    // A clock you can only beat by killing it. Every BUD_MS it plants itself, swells for SWELL_MS and
    // buds off a copy with its own health, so the family's health doubles each time. Hits don't
    // touch the clock; freezing or stunning it calls off a swell. So kill them fast, or split them up.
    // A family stops growing at FAMILY_MAX bodies.
    // Every bud, the parent and the copy both burst a ring of VOLLEY poison globs (GLOB_DMG each, and POISON_DPS for POISON_MS).
    _budCfg() { return { HP: 90, BUD_MS: 10000, SWELL_MS: 1500, FAMILY_MAX: 8, TINT: 0x9be05a, VOLLEY: 10, GLOB_SPEED: 170, GLOB_RANGE: 7, GLOB_DMG: 6, POISON: [4, 600, 4000], POOL_R: 2, ALL_MAX: 16 }; }   // POISON: the Rooter's dose (dmg, every ms, for ms); POOL_R: the ring of poison tiles a bud leaves; ALL_MAX: buds alive at once, every family
    createBuddingSlime(x, y, ri, family) {
        const B = this._budCfg();
        const e = this.createEnemy(x, y, B.HP);
        e.tutorialRoomIndex = ri;
        e._isBud = true; e._noUlt = true;   // a spawner: no ult charge off any of them
        e._budFamily = family || {};
        e._budAt = this.time.now;   // its clock: hits don't touch it
        const k = LevelManager.bodyKey(this, 'bud');   // spring green, pink speckles
        if (k) { e.sprite.setTexture(k, 0); e.sprite.play(k + '_idle'); }
        return e;
    }
    // A ring of poison globs out of it, every way at once
    _budVolley(e) {
        const B = this._budCfg(), s = e.sprite;
        if (!s?.active) return;
        for (let i = 0; i < B.VOLLEY; i++) {
            const a = i / B.VOLLEY * Math.PI * 2 + Math.random() * 0.2;
            const g = this.add.graphics().setDepth(2.8).setPosition(s.x, s.y);
            g.fillStyle(0x1e3a10, 1).fillCircle(0, 0, 4.5);
            g.fillStyle(0x8ae04a, 1).fillCircle(0, 0, 3.5);
            g.fillStyle(0xd4ff9a, 1).fillCircle(-1, -1, 1.3);
            this.enemyProjectiles.push({ src: e, gfx: g, vx: Math.cos(a) * B.GLOB_SPEED, vy: Math.sin(a) * B.GLOB_SPEED, damage: B.GLOB_DMG * (this.enemyDamageScale || 1),
                startX: s.x, startY: s.y, maxDist: B.GLOB_RANGE * this.TILE_SIZE, _bfxKind: 'vine', onHit: () => this._poisonPlayer(B.POISON[0] * (this.enemyDamageScale || 1), B.POISON[1], B.POISON[2]) });
        }
    }
    // Every frame, every level: the clock, the swell and its ring
    _updateBudding(time) {
        if (!this.enemies?.length || this._devFreezeEnemies) return;
        const B = this._budCfg(), T = this.TILE_SIZE;
        for (const e of this.enemies) {
            if (!e._isBud) continue;
            if (!e.sprite?.active || e.health <= 0) { e._budRing?.destroy(); e._budRing = null; continue; }
            const u = e.sprite._cfx, want = e._budSwell ? 'bud' : 'bud' + Math.min(3, Math.floor(4 * (time - (e._budAt || time)) / B.BUD_MS));   // its head: seed, sprout, bud, opening, then in flower as it swells
            if (u && u.set !== want) CreatureFX.dress(u, want);
            if (e._budSwell) {
                const k = (time - e._budSwell) / B.SWELL_MS;
                if (e.isFrozen || e.isStunned) { this._budCalm(e); e._budAt = time; continue; }   // held mid-swell: called off, its clock started over
                const g = e._budRing;
                g.clear().setPosition(e.sprite.x, e.sprite.y + 10);
                g.fillStyle(B.TINT, 0.12 + 0.18 * k).fillCircle(0, 0, T * (0.45 + 0.25 * k));
                g.lineStyle(3, 0x1a3a12, 0.7).strokeCircle(0, 0, T * 0.6);
                g.lineStyle(3, k > 0.7 && (time / 90 | 0) % 2 ? 0xffffff : 0xffb0dc, 0.95);
                g.beginPath(); g.arc(0, 0, T * 0.6, -Math.PI / 2, -Math.PI / 2 + k * Math.PI * 2); g.strokePath();
                if (k >= 1) this._budSplit(e);
            } else if (time - (e._budAt || 0) >= B.BUD_MS && this.enemies.filter(o => o._budFamily === e._budFamily && o.sprite?.active && o.health > 0).length < B.FAMILY_MAX
                       && this.enemies.filter(o => o._isBud && o.sprite?.active && o.health > 0).length < B.ALL_MAX) {
                e._budSwell = time;
                e._budHold = e._moveCdMult; e._moveCdMult = 999;   // it plants itself to bud
                e._budRing = this.add.graphics().setDepth((e.sprite.depth ?? 1) - 0.02);
                this.showStatusText(e.sprite.x, e.sprite.y - 28, 'BUDDING!', '#ffb0dc');
            }
        }
    }
    _budCalm(e) {
        e._budSwell = 0; e._moveCdMult = e._budHold; e._budHold = undefined;
        e._budRing?.destroy(); e._budRing = null;
    }
    // The copy: a free tile beside it, the parent's health and max health
    _budSplit(e) {
        this._budCalm(e);
        e._budAt = this.time.now;
        const at = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [-1, -1], [1, -1], [-1, 1]].map(([dx, dy]) => [e.x + dx, e.y + dy])
            .find(([x, y]) => this.world[x]?.[y] === this.FLOOR && !(x === this.playerX && y === this.playerY) && !this.enemies.some(o => o.sprite?.active && o.x === x && o.y === y));
        if (!at) return;
        const c = this.createBuddingSlime(at[0], at[1], e.tutorialRoomIndex, e._budFamily);
        c._budCopy = true;   // a copy: no ult charge off it (the original wears the bud)
        this._budVolley(e); this._budVolley(c);
        this._poisonRing(e.x, e.y, this._budCfg().POOL_R);
        if (!this.trainingRun && this.enemies.filter(o => o._budFamily === e._budFamily && o.sprite?.active).length >= this._budCfg().FAMILY_MAX) Achievements.bump('budFull', 1, this, true);
        c.maxHealth = e.maxHealth; c.health = e.health;
        this.updateEnemyHealthBar?.(c);
        const sc = c.sprite.scaleX;
        c.sprite.setScale(sc * 0.3);
        this.tweens.add({ targets: c.sprite, scaleX: sc, scaleY: sc, duration: 260, ease: 'Back.easeOut' });
        for (let i = 0; i < 8; i++) {
            const a = i / 8 * Math.PI * 2, m = this.add.image(e.sprite.x, e.sprite.y, 'vfx_dot').setTint(i % 2 ? 0xffb0dc : 0x9be05a).setDepth(4.2);
            this.tweens.add({ targets: m, x: m.x + Math.cos(a) * 26, y: m.y + Math.sin(a) * 20, alpha: 0, duration: 420, onComplete: () => m.destroy() });
        }
        Sfx.play(this, 'pluck');
    }
    // ── SPECIAL HITS ─────────────────────────────────────────────────────────
    // From both damage paths (damageEnemy and resolveElementalHit), after everything else: what
    // the newer slimes do to a hit. An Adaptive Shade takes the hits of everything in its aura;
    // an Armored Slime's plates; a Shade's resistance; a CEO's or knight's armour.
    _specialHit(e, d, el) {
        if ((e._discUntil || 0) > this.time.now) d *= e._discTaken;   // discouraged by a Cheerleader's death: braced
        if (!e._special && !this._shadeN) return d;
        if (this._shadeN && !e._isShade) {
            const sh = this._shadeGuard(e);
            if (sh) { this._shadeAbsorb(sh, e, d, el); return 0; }
        }
        if (e._armorWeak) d *= this._armorMult(e);
        if (e._isShade) d = this._shadeTake(e, d, el);
        if (e._plate > 0) d = this._plateTake(e, d);
        if (e._isCheer && e._cheerStart) d *= this._cheerCfg().TAKEN;   // on stage
        return d;
    }
    // Clear line between two tiles (walls block it)
    _clearShot(ax, ay, bx, by) {
        let x = ax, y = ay; const dx = Math.abs(bx - ax), dy = Math.abs(by - ay), sx = Math.sign(bx - ax), sy = Math.sign(by - ay);
        let err = dx - dy;
        while (x !== bx || y !== by) {
            const e2 = 2 * err;
            if (e2 > -dy) { err -= dy; x += sx; }
            if (e2 < dx) { err += dx; y += sy; }
            if ((x !== bx || y !== by) && this.world[x]?.[y] !== this.FLOOR) return false;
        }
        return true;
    }
    // Every frame, every level: the newer slimes that need a clock
    _updateElites(time, delta) {
        this._shadeN = 0;
        if (!this.enemies?.length) return;
        const still = this._devFreezeEnemies;   // the Training Ground's Frozen: no attacks, only the looks keep up
        for (const e of [...this.enemies]) {
            if (!e.sprite?.active || e.health <= 0) continue;
            if (e._isShade) this._shadeN++;
            if (still) {
                if (e._shroud) this._shroudLook(e);
                if (e._plate > 0 || e._plateBar) this._plateDraw(e);
                for (const a of [e._healerAura, e._anchorRing, e._shadeAura, e._tideAura]) if (a?.active) { a.setPosition(e.sprite.x, e.sprite.y); VisualFX.clipAura(this, a); }
                continue;
            }
            if (e._isShade) this._shadeTick(e, time);
            if (e._isWraith) { this._wraithTick(e, time); this._wraithDrift(e); }
            if (e._shroudBy) this._shroudKeep(e, time);
            if (e._shroud) this._shroudLook(e);
            if (e._isDiver) this._diverTick(e, time);
            if (e._isLeech) this._leechTick(e, time);
            if (e._isCeo) this._ceoTick(e, time);
            if (e._isGem) this._gemTick(e, time);
            if (e._isTidecaller) this._tideTick(e, time);
            if (e._tideFx || (e._tideUntil || 0) > time) this._tideLook(e, time);
            if (e._isCheer) this._cheerTick(e, time);
            if (e._cheerFx || (e._cheerUntil || 0) > time) this._cheerLook(e, time);
            if (e._discFx || (e._discUntil || 0) > time) this._discLook(e, time);
            if (e._plate > 0 || e._plateBar) this._plateDraw(e);
            for (const a of [e._healerAura, e._anchorRing]) if (a?.active && (a.x !== e.sprite.x || a.y !== e.sprite.y)) { a.setPosition(e.sprite.x, e.sprite.y); VisualFX.clipAura(this, a); }   // their fields glide with them, not a step behind
        }
    }

    // ── WRAITH ───────────────────────────────────────────────────────────────
    // You can see it, but it can't be touched or targeted until you're within REVEAL tiles
    // (the shroud, CombatSystem._phasedOut). Every CLOAK_EVERY it shrouds a random enemy in its
    // AURA the same way: that one stays shrouded while the Wraith lives, unless it's out of the
    // aura for LEAVE_MS.
    _wraithCfg() { return { HP: 160, SPEED: 1.3, REVEAL: 3, AURA: 5, CLOAK_EVERY: 6000, LEAVE_MS: 2000 }; }
    createWraith(x, y, ri) {
        const W = this._wraithCfg();
        const e = this.createEnemy(x, y, W.HP);
        e.tutorialRoomIndex = ri;
        e._isWraith = true; e._shroud = true; e._shroudR = W.REVEAL;
        e._moveCdMult = W.SPEED; e._wraithNext = this.time.now + 2000;
        const k = LevelManager.wraithBodyKey(this);   // a ghost: pale, a ragged hem, fading below
        if (k) { e.sprite.setTexture(k, 0); e.sprite.play(k + '_idle'); }
        return e;
    }
    _wraithTick(w, time) {
        const W = this._wraithCfg();
        if (time < w._wraithNext) return;
        w._wraithNext = time + W.CLOAK_EVERY;
        const near = this.enemies.filter(o => o !== w && o.sprite?.active && o.health > 0 && !o._shroud && !o._isShade && !o._isWraith && Math.hypot(o.x - w.x, o.y - w.y) <= W.AURA);
        const o = near[Math.floor(Math.random() * near.length)];
        if (!o) return;
        o._shroud = true; o._shroudR = W.REVEAL; o._shroudBy = w; o._shroudOut = 0;
        const g = this.add.graphics().setDepth(3).lineStyle(2, 0xbfd8ff, 0.8).lineBetween(w.sprite.x, w.sprite.y, o.sprite.x, o.sprite.y);
        this.tweens.add({ targets: g, alpha: 0, duration: 450, onComplete: () => g.destroy() });
        this.showStatusText(o.sprite.x, o.sprite.y - 28, 'CLOAKED', '#bfd8ff');
    }
    // Pale ghost-fire peeling off it and its body wavering, shrouded or not
    _wraithDrift(w) {
        const s = w.sprite;
        s.setScale((w._baseScale ?? this.SLIME_SCALE) * (1 + 0.04 * Math.sin(this.time.now / 220)), (w._baseScale ?? this.SLIME_SCALE) * (1 - 0.04 * Math.sin(this.time.now / 220)));
        if (Math.random() < 0.3) {
            const m = this.add.image(s.x + (Math.random() - 0.5) * 18, s.y + 4, 'vfx_dot').setTint(Math.random() < 0.5 ? 0xbfe4ff : 0x7aa8e0).setBlendMode(Phaser.BlendModes.ADD).setAlpha(0.7 * s.alpha).setDepth((s.depth ?? 1) - 0.02);
            this.tweens.add({ targets: m, y: m.y - 22, x: m.x + (Math.random() - 0.5) * 10, alpha: 0, scale: 1.6, duration: 900, ease: 'Sine.easeOut', onComplete: () => m.destroy() });
        }
    }
    // A shrouded ally: it stays while its Wraith lives and it hasn't been out of the aura too long
    _shroudKeep(e, time) {
        const w = e._shroudBy, W = this._wraithCfg();
        const out = !w.sprite?.active || w.health <= 0 ? Infinity : Math.hypot(e.x - w.x, e.y - w.y) > W.AURA ? (e._shroudOut ||= time, time - e._shroudOut) : (e._shroudOut = 0);
        if (out < W.LEAVE_MS) return;
        e._shroud = false; e._shroudBy = null;
        e.sprite.setAlpha(1);
        this.showStatusText(e.sprite.x, e.sprite.y - 28, 'REVEALED', '#e8f0ff');
    }
    // Shrouded and out of reach: faint and wavering; in reach: solid
    _shroudLook(e) {
        const far = Math.hypot(this.playerX - e.x, this.playerY - e.y) > e._shroudR;
        e.sprite.setAlpha(far ? 0.28 + 0.08 * Math.sin(this.time.now / 160 + e.x) : 1);
        if (e._shroudFar !== undefined && far !== e._shroudFar && this.time.now - (e._shroudSaidAt || 0) > 600) {   // says so as you step in and out of reach
            e._shroudSaidAt = this.time.now;
            this.showStatusText(e.sprite.x, e.sprite.y - 28, far ? 'CLOAKED' : 'REVEALED!', far ? '#8aa4c8' : '#e8f4ff');
            if (!far) this._vfxFlash?.(e.sprite.x, e.sprite.y, 26, 0xbfd8ff, 160, 0.5);
        }
        e._shroudFar = far;
    }

    // ── ADAPTIVE SHADE ───────────────────────────────────────────────────────
    // A cosmic mini-boss. Hex slides off it. Hit by fire, ice or lightning, it adapts DELAY ms
    // later: its body and crown change to that element's and it takes RESIST of it; it can't
    // adapt again for CD ms, then the next different element turns it again. It takes the hits
    // of every enemy in its AURA (their damage lands on it, and counts toward adapting).
    _shadeCfg() { return { HP: 900, SCALE: 1.6, SPEED: 1.8, MELEE: 6, AURA: 4, RESIST: 0.15, DELAY: 2000, CD: 6000,
        FORMS: {
            void:      { pal: [[60, 56, 70], [150, 146, 160], [206, 204, 214], [236, 235, 242], [255, 255, 255]], glint: [255, 206, 70], set: 'shade',           eye: 0xd8a0ff, col: 0xa060ff },
            fire:      { pal: [[40, 8, 4], [120, 30, 8], [200, 70, 16], [255, 140, 40], [255, 226, 140]], glint: [255, 250, 200], set: 'shade_fire',      eye: 0x3a0800, col: 0xff6a1a },
            ice:       { pal: [[10, 36, 60], [30, 96, 150], [80, 170, 220], [160, 226, 255], [236, 252, 255]], glint: [255, 255, 255], set: 'shade_ice',   eye: 0x0a2a44, col: 0x7fd8ff },
            lightning: { pal: [[40, 34, 6], [110, 96, 10], [190, 170, 20], [250, 236, 70], [255, 252, 200]], glint: [255, 255, 255], set: 'shade_lightning', eye: 0x3a2a00, col: 0xffe040 },
        } }; }
    createAdaptiveShade(x, y, ri) {
        const S = this._shadeCfg();
        const e = this.createEnemy(x, y, S.HP);
        e.tutorialRoomIndex = ri;
        e._isShade = true; e._special = true; e._hexImmune = true;
        e._moveCdMult = S.SPEED; e._meleeDmg = S.MELEE;
        e._baseScale = this.SLIME_SCALE * S.SCALE; e.sprite.setScale(e._baseScale); LevelManager.seat(e, S.SCALE);
        e._hpBarYOff = Math.min(e._hpBarYOff, -20);   // over the crown (it's a size up)
        e._form = 'void'; e._adaptReady = 0;
        e._shadeAura = VisualFX.aura(this, e.sprite.x, e.sprite.y, S.AURA * this.TILE_SIZE, S.FORMS.void.col, { alpha: 0.5 });
        this._shadeForm(e, 'void', true);
        return e;
    }
    _shadeForm(e, form, quiet) {
        const F = this._shadeCfg().FORMS[form];
        e._form = form;
        e._immuneFx = form === 'void' ? null : form;   // its element's own effect can't take hold (burn, chill, amp)
        if (form === 'fire') { e.burnStacks = 0; e.blueBurn = 0; this._burnDecay(e, this.time.now); }
        if (form === 'ice') e.chillStacks = 0;
        if (form === 'lightning') { e.isSuperConducted = false; e.superConductUntil = 0; }
        const k = LevelManager.slimeRecolor(this, 'slime_shade_' + form, F.pal, F.glint);
        if (k) { e.sprite.setTexture(k, e.sprite.frame?.name ?? 0); e.sprite.play(k + '_idle'); }
        if (e.sprite._cfx) CreatureFX.dress(e.sprite._cfx, F.set, F.eye);
        e._shadeAura?.setTint(F.col);
        if (quiet) return;
        this._vfxFlash?.(e.sprite.x, e.sprite.y, 60, F.col, 260, 0.8);
        VisualFX.ripple(this, e.sprite.x, e.sprite.y, 10, 70, F.col, { duration: 500 });
        this.showStatusText(e.sprite.x, e.sprite.y - 40, `RESISTS ${form.toUpperCase()}`, UIKit._hex(F.col));
        Sfx.play(this, 'roar');
    }
    // A hit of `el` landing on it (its own, or one it took for an ally): start adapting if it can
    _shadeNote(e, el) {
        const S = this._shadeCfg(), now = this.time.now;
        if (!S.FORMS[el] || el === 'void' || el === e._form || e._adaptTo || now < e._adaptReady) return;
        e._adaptTo = el; e._adaptAt = now + S.DELAY;
        this.showStatusText(e.sprite.x, e.sprite.y - 40, 'ADAPTING...', UIKit._hex(S.FORMS[el].col));
    }
    _shadeTake(e, d, el) {
        this._shadeNote(e, el);
        if (el !== e._form) return d;
        if (this.time.now - (e._resistAt || 0) > 800) { e._resistAt = this.time.now; this.showStatusText(e.sprite.x, e.sprite.y - 28, 'ADAPTED', '#c8c8d8'); }
        return d * this._shadeCfg().RESIST;
    }
    // The first Shade whose aura covers `e`
    _shadeGuard(e) {
        const R = this._shadeCfg().AURA;
        return this.enemies.find(s => s._isShade && s !== e && s.sprite?.active && s.health > 0 && Math.hypot(s.x - e.x, s.y - e.y) <= R) || null;
    }
    _shadeAbsorb(sh, e, d, el) {
        Sfx.play(this, 'block');
        const dd = this._shadeTake(sh, d, el);
        sh.health -= dd;
        this.updateEnemyHealthBar?.(sh);
        if (dd >= 1 && sh.sprite?.active) this.showDamageNumber(sh.sprite.x, sh.sprite.y - 16, Math.round(dd), '#d8a0ff');
        const now = this.time.now;
        if (e.sprite?.active && now - (e._absorbFxAt || 0) > 140) {   // a thread from what was hit to what took it
            e._absorbFxAt = now;
            const g = this.add.graphics().setDepth(3).lineStyle(2, this._shadeCfg().FORMS[sh._form].col, 0.85).lineBetween(e.sprite.x, e.sprite.y, sh.sprite.x, sh.sprite.y);
            this.tweens.add({ targets: g, alpha: 0, duration: 220, onComplete: () => g.destroy() });
        }
        if (sh.health <= 0) this.killEnemy(sh);
    }
    _shadeTick(e, time) {
        const S = this._shadeCfg(), F = S.FORMS[e._form];
        if (e._shadeAura?.active) { e._shadeAura.setPosition(e.sprite.x, e.sprite.y); VisualFX.clipAura(this, e._shadeAura); }
        if (e._adaptTo) {
            if (time >= e._adaptAt) { const to = e._adaptTo; e._adaptTo = null; e._adaptReady = time + S.CD; this._shadeForm(e, to); }
            else if (time - (e._adaptFxAt || 0) > 120) {   // its new element gathering round it
                e._adaptFxAt = time;
                const col = S.FORMS[e._adaptTo].col, a = Math.random() * Math.PI * 2;
                const m = this.add.image(e.sprite.x + Math.cos(a) * 34, e.sprite.y + Math.sin(a) * 22, 'vfx_dot').setTint(col).setBlendMode(Phaser.BlendModes.ADD).setDepth((e.sprite.depth ?? 1) + 0.06);
                this.tweens.add({ targets: m, x: e.sprite.x, y: e.sprite.y, alpha: 0.2, duration: 380, ease: 'Quad.easeIn', onComplete: () => m.destroy() });
            }
        }
        if (Math.random() < 0.35) {   // its element coming off it
            const m = this.add.image(e.sprite.x + (Math.random() - 0.5) * 30, e.sprite.y + (Math.random() - 0.3) * 14, 'vfx_dot').setTint(F.col).setBlendMode(Phaser.BlendModes.ADD).setDepth((e.sprite.depth ?? 1) + 0.05).setScale(0.7);
            const up = e._form === 'ice' ? 10 : -14;
            this.tweens.add({ targets: m, y: m.y + up, alpha: 0, duration: 600, onComplete: () => m.destroy() });
        }
    }

    // ── TORPEDO DIVER ────────────────────────────────────────────────────────
    // Aims down a line at you, then fires itself along it like a bullet, through you and on to
    // the wall, leaving water. The shot is always instant: what's fair is the aim. The farther
    // away it is, the shorter the aim (TELL_FAR at FAR tiles and beyond: you won't get out of
    // the way); close up, the aim is long enough to step aside. The lit lane shows where it will
    // go. A hit is DMG, and you drip and bleed.
    _diverCfg() { return { HP: 110, SPEED: 1.2, CD: 5000, NEAR: 3, FAR: 8, TELL_NEAR: 1500, TELL_FAR: 220, DMG: 18, ZIP_MS: 12, BLEED_MS: 4000, WATER_MS: 12000, MAX_RUN: 40 }; }
    createTorpedoDiver(x, y, ri) {
        const D = this._diverCfg();
        const e = this.createEnemy(x, y, D.HP);
        e.tutorialRoomIndex = ri;
        e._isDiver = true; e._waterNative = true;
        e._moveCdMult = D.SPEED; e._diveNext = this.time.now + 2500;
        const k = LevelManager.bodyKey(this, 'diver');
        if (k) { e.sprite.setTexture(k, 0); e.sprite.play(k + '_idle'); }
        return e;
    }
    _diverTick(e, time) {
        const D = this._diverCfg();
        if (e._diving || time < e._diveNext || e.isFrozen || e.isStunned || this._deathScreenActive) return;
        const d = Math.hypot(this.playerX - e.x, this.playerY - e.y);
        if (d < 2 || d > 16 || !this._clearShot(e.x, e.y, this.playerX, this.playerY)) return;
        // the line: from it, through where you stand, on until a wall
        const dx = this.playerX - e.x, dy = this.playerY - e.y, n = Math.max(Math.abs(dx), Math.abs(dy));
        const line = [];
        for (let i = 1; i <= D.MAX_RUN; i++) {
            const tx = Math.round(e.x + dx * i / n), ty = Math.round(e.y + dy * i / n);
            if (this.world[tx]?.[ty] !== this.FLOOR) break;
            if (!line.length || line[line.length - 1][0] !== tx || line[line.length - 1][1] !== ty) line.push([tx, ty]);
        }
        if (!line.length) return;
        const k = Phaser.Math.Clamp((d - D.NEAR) / (D.FAR - D.NEAR), 0, 1), tell = D.TELL_NEAR + (D.TELL_FAR - D.TELL_NEAR) * k;
        e._diving = true; e._diveHold = e._moveCdMult; e._moveCdMult = 999;
        const T = this.TILE_SIZE, g = e._diverTell = this.add.graphics().setDepth(0.9);
        const t0 = time;
        const draw = () => {   // the lit lane, like a Tidal Guard's aim: brighter as it nears
            if (!g.active) return;
            const a = Math.min(1, (this.time.now - t0) / tell), flash = a > 0.7 && (this.time.now / 70 | 0) % 2;
            g.clear();
            for (const [tx, ty] of line) {
                g.fillStyle(flash ? 0xffffff : 0x4ad0ff, 0.12 + 0.3 * a).fillRect(tx * T + 2, ty * T + 2, T - 4, T - 4);
                g.lineStyle(1.5, 0x9fe8ff, 0.5 + 0.4 * a).strokeRect(tx * T + 2, ty * T + 2, T - 4, T - 4);
            }
        };
        draw();
        const tick = this.time.addEvent({ delay: 30, loop: true, callback: draw });
        this.time.delayedCall(tell, () => {
            tick.remove(); g.destroy(); e._diverTell = null;
            if (!e.sprite?.active || e.health <= 0) return;
            this._diverZip(e, line);
        });
    }
    _diverZip(e, line) {
        const D = this._diverCfg(), T = this.TILE_SIZE;
        let hit = false;
        Sfx.play(this, 'whoosh');
        line.forEach(([tx, ty], i) => this.time.delayedCall(i * D.ZIP_MS, () => {
            if (!e.sprite?.active) return;
            this.addWater(tx, ty, D.WATER_MS);
            const s = this.add.image(tx * T + T / 2, ty * T + T / 2, 'vfx_dot').setTint(0xbff0ff).setScale(2.2).setAlpha(0.8).setDepth(3);
            this.tweens.add({ targets: s, scale: 0.4, alpha: 0, duration: 260, onComplete: () => s.destroy() });
            if (!hit && tx === this.playerX && ty === this.playerY) {
                hit = true;
                const before = this.health;
                this._hitBy = e; this.takeDamage(D.DMG * (this.enemyDamageScale || 1)); this._hitBy = null;
                if (this.health < before) { this._applyDripping(this.time.now); this._bleedStart(D.BLEED_MS); }
                this.cameras.main.shake(80, 0.006);
            }
        }));
        // it ends at the last free tile of the lane
        const free = [...line].reverse().find(([x, y]) => !(x === this.playerX && y === this.playerY) && !this.enemies.some(o => o !== e && o.sprite?.active && o.x === x && o.y === y)) || [e.x, e.y];
        this.tweens.killTweensOf(e.sprite);
        this.tweens.add({ targets: e.sprite, x: free[0] * T + T / 2, y: free[1] * T + T / 2 + this.SLIME_Y_OFFSET, duration: line.length * D.ZIP_MS, ease: 'Linear', onUpdate: () => this.updateEnemyHealthBar(e),
            onComplete: () => { e.x = free[0]; e.y = free[1]; e._committedPath = null; e.lastMoveTime = this.time.now; e._diving = false; e._moveCdMult = e._diveHold; e._diveNext = this.time.now + D.CD / this._atkSpd(e); } });
    }

    // ── LEECH ────────────────────────────────────────────────────────────────
    // It takes on an element's colour and its ring fills over SETTLE ms; for the last WARN ms it
    // aims a thread at you and that element's gem flashes over your head. Still holding that
    // element when the ring closes (and it can see you): it STEALS the element itself. You're
    // thrown onto another and can't switch back (switchToElement) until it's dead. With its
    // prize it never attacks again: it swells, glows and runs, hiding behind its friends.
    // Swap off in time and nothing happens; it picks again. The whole time it's after one, that element's gem spins
    // over your head. The steal tears the gem out of you and it holds it; your gem at the bottom goes grey with the
    // Leech sat on it, laughing. Kill it and the gem is flung back into you. A thing of the void: with its prize, every
    // PORT_CD it slips into a portal and comes out PORT_DIST further along its escape.
    _leechCfg() { return { HP: 70, SPEED: 1.4, SETTLE: 5000, WARN: 1400, STAGGER: 250, FLEE_MS: 300, PORT_CD: 4000, PORT_DIST: 5, PORT_MS: 420,
        COLS: { fire: 0xff6a1a, ice: 0x7fd8ff, lightning: 0xffe040, cosmic: 0xb070ff },
        PALS: { fire: [[40, 8, 4], [120, 34, 10], [200, 80, 24], [255, 150, 60], [255, 220, 160]], ice: [[10, 36, 60], [30, 96, 150], [80, 170, 220], [160, 226, 255], [236, 252, 255]],
                lightning: [[40, 34, 6], [110, 96, 10], [190, 170, 20], [250, 236, 70], [255, 252, 200]], cosmic: [[20, 8, 36], [56, 22, 96], [100, 50, 160], [160, 110, 220], [230, 200, 255]] } }; }
    createLeech(x, y, ri) {
        const L = this._leechCfg();
        const e = this.createEnemy(x, y, L.HP);
        e.tutorialRoomIndex = ri;
        e._isLeech = true; e._moveCdMult = L.SPEED;
        e._leechRing = this.add.graphics().setDepth((e.sprite.depth ?? 1) + 0.04);
        this._leechPick(e);
        return e;
    }
    _leechPick(e) {
        const L = this._leechCfg(), els = Object.keys(L.COLS).filter(el => this.unlockedElements?.has(el) && !this._elStolen?.[el]);
        e._leechEl = els[Math.floor(Math.random() * els.length)] || 'fire';
        e._leechAt = this.time.now + L.SETTLE;
        const k = LevelManager.slimeRecolor(this, 'slime_leech_' + e._leechEl, L.PALS[e._leechEl]);
        if (k) { e.sprite.setTexture(k, e.sprite.frame?.name ?? 0); e.sprite.play(k + '_idle'); }
        if (e.sprite._cfx) CreatureFX.dress(e.sprite._cfx, 'leech', L.COLS[e._leechEl]);
    }
    _leechTick(e, time) {
        if (time >= (e._twinkleAt || 0) && e.sprite?.visible && e.sprite.alpha > 0.3) {   // stars of the void winking round it
            e._twinkleAt = time + 260 + Math.random() * 300;
            const st = this.add.image(e.sprite.x + (Math.random() - 0.5) * 26, e.sprite.y + (Math.random() - 0.5) * 16, 'vfx_dot').setTint(Math.random() < 0.5 ? 0xffffff : 0xc89aff).setBlendMode(Phaser.BlendModes.ADD).setDepth((e.sprite.depth ?? 1) + 0.03).setScale(0.2);
            this._vfxSort?.(st);
            this.tweens.add({ targets: st, scale: 0.7, alpha: 0, duration: 420, yoyo: false, onComplete: () => st.destroy() });
        }
        if (e._stoleEl) { this._leechFlee(e, time); return; }   // it has what it came for
        if (e.tutorialRoomIndex !== undefined && this.rooms?.[e.tutorialRoomIndex] && e.tutorialRoomIndex !== this.getCurrentPlayerRoom()) {   // not in its room: it waits
            e._leechAt = time + this._leechCfg().SETTLE;
            e._leechRing?.clear(); e._leechIcon?.destroy(); e._leechIcon = null;
            return;
        }
        const L = this._leechCfg(), col = L.COLS[e._leechEl], g = e._leechRing;
        const left = Math.max(0, (e._leechAt - time) / L.SETTLE), warn = e._leechAt - time <= L.WARN;
        const sees = (e.tutorialRoomIndex === undefined || !this._roomGated?.() || e.tutorialRoomIndex === this.getCurrentPlayerRoom()) && this._clearShot(e.x, e.y, this.playerX, this.playerY);
        g?.clear().setPosition(e.sprite.x, e.sprite.y + 10);   // the ring of its colour closing round it
        g?.lineStyle(2, 0x0a0a10, 0.6).strokeCircle(0, 0, 14);
        g?.lineStyle(2, col, warn && (time / 80 | 0) % 2 ? 0.45 : 0.95);
        if (g) { g.beginPath(); g.arc(0, 0, 14, -Math.PI / 2, -Math.PI / 2 + (1 - left) * Math.PI * 2); g.strokePath(); }
        if (warn && sees && this.player?.active) g?.lineStyle(1, col, 0.35 + 0.3 * Math.sin(time / 60)).lineBetween(0, -10, this.player.x - e.sprite.x, this.player.y - e.sprite.y - 10);   // the aim
        if (this.player?.active) this._leechWarn(e, col, time, warn);   // what it wants, spinning over your head the whole time
        if (time < e._leechAt || e.isFrozen || e.isStunned) return;
        if (sees && !this._deathScreenActive && this.currentElement === e._leechEl && !this._elStolen?.[e._leechEl]) { this._leechSteal(e, time); return; }
        this._leechPick(e);
    }
    _leechSteal(e, time) {
        const L = this._leechCfg(), el = e._leechEl, col = L.COLS[el];
        e._stoleEl = el; (this._elStolen ||= {})[el] = e;
        e._leechRing?.destroy(); e._leechRing = null; e._leechIcon?.destroy(); e._leechIcon = null;
        const gem = e._leechHeld = this.add.image(this.player.x, this.player.y - 6, this._leechGemKey(el)).setDepth(5.3).setScale(1.6);   // torn out of you, into its grip
        this._vfxSort?.(gem);
        e._leechHeld.setData('flying', true);
        const hand = this._leechHand(e);
        this.tweens.add({ targets: gem, x: hand.x, y: hand.y, duration: 380, ease: 'Back.easeIn', onComplete: () => gem.setData('flying', false) });
        e._portNext = time + 1500;
        this._staggerUntil = Math.max(this._staggerUntil || 0, time + L.STAGGER);
        const beam = this.add.graphics().setDepth(4.4).lineStyle(4, col, 0.95).lineBetween(this.player.x, this.player.y, e.sprite.x, e.sprite.y);
        this.tweens.add({ targets: beam, alpha: 0, duration: 420, onComplete: () => beam.destroy() });
        for (let i = 0; i < 10; i++) {   // the element pulled out of you and into it
            const m = this.add.image(this.player.x, this.player.y, 'vfx_dot').setTint(col).setBlendMode(Phaser.BlendModes.ADD).setDepth(4.5);
            this.tweens.add({ targets: m, x: e.sprite.x, y: e.sprite.y, delay: i * 40, duration: 320, ease: 'Quad.easeIn', onComplete: () => m.destroy() });
        }
        this.showStatusText(this.player.x, this.player.y - 34, `${el.toUpperCase()} STOLEN: KILL THE LEECH`, UIKit._hex(col));
        const to = ['fire', 'ice', 'lightning', 'cosmic'].find(o => o !== el && this.unlockedElements?.has(o) && !this._elStolen[o]);
        if (to) this.switchToElement(to);
        e.maxHealth = Math.round(e.maxHealth * 1.3); e.health = Math.round(e.health * 1.3);
        e._baseScale = this.SLIME_SCALE * 1.3; e.sprite.setScale(e._baseScale); LevelManager.seat(e, 1.3);   // swollen with it
        e._leechGlow = VisualFX.aura(this, e.sprite.x, e.sprite.y, 34, col, { alpha: 0.95 });
        Sfx.play(this, 'zap');
    }
    // Where it holds its prize: against its side, halfway up its body (the body sits low in its frame, and it's swollen)
    _leechHand(e) {
        const s = e.sprite;
        return { x: s.x + 10 * Math.abs(s.scaleX), y: s.y + (26.5 - s.originY * 32) * s.scaleY - 2 };
    }
    // A gem in an element's colour (the one a Leech is after, or holds)
    _leechGemKey(el) {
        const col = this._leechCfg().COLS[el];
        return ShopScene.icon(this, 'fx_leech_gem_' + el, 10, { G: UIKit._hex(col), g: UIKit._hex(MenuArt.mix(col, 0x000000, 0.45)), W: '#ffffff' }, m => {
            m.poly([[5, 0], [9, 4], [5, 9], [1, 4]], 'G'); m.poly([[5, 0], [9, 4], [5, 9]], 'g'); m.set(4, 3, 'W');
        });
    }
    // The gem it's after, spinning over your head: faint while it settles, bright and flashing as it aims (with a nudge when you're holding it)
    _leechWarn(e, col, time, warn) {
        const p = this.player, holding = this.currentElement === e._leechEl, key = this._leechGemKey(e._leechEl);
        const ic = e._leechIcon?.active ? e._leechIcon : (e._leechIcon = this.add.image(0, 0, key).setDepth(5.2));
        if (ic.texture.key !== key) ic.setTexture(key);
        const s = (holding ? 2 : 1.6) * (warn ? 1.1 : 1);
        ic.setPosition(p.x, p.y - 34 + Math.sin(time / 260) * 2).setScale(s * Math.cos(time / 170), s)   // turning on its axis
          .setAlpha(warn ? ((time / 120 | 0) % 2 ? 1 : 0.5) : 0.75);
        if (warn && holding && time - (e._leechNagAt || 0) > 700) { e._leechNagAt = time; this.showStatusText(p.x, p.y - 50, `SWAP OFF ${e._leechEl.toUpperCase()}`, UIKit._hex(col)); }
    }
    // While it holds your element: its prize held up beside it, and on your HUD the gem grey with the Leech sat on it, laughing
    _leechHold(e, time) {
        const s = e.sprite, held = e._leechHeld;
        if (held?.active) { const h = this._leechHand(e); held.setPosition(h.x, h.y + Math.sin(time / 200) * 1.5).setScale(1.4 * Math.cos(time / 200), 1.4).setDepth((s.depth ?? 1) + 0.05); }
        const u = this._ultGemUI?.find(q => q.el === e._stoleEl);
        if (!u) return;
        const SC = 2.6;   // sat on your gem: big enough to see, its feet on the gem's middle, its face (and eyes) on
        if (!e._hudLeech?.active) {
            e._hudLeech = this.add.sprite(u.x, u.y, s.texture.key, 0).setOrigin(0.5, 1).setScrollFactor(0).setDepth(33).setScale(SC);
            this._vfxSort?.(e._hudLeech);
            CreatureFX.face(this, e._hudLeech, { mood: 'angry', hat: 'leech', eye: this._leechCfg().COLS[e._stoleEl], look: () => null });
        }
        const hl = e._hudLeech, bob = Math.abs(Math.sin(time / 180)) * 3;
        hl.setPosition(u.x + Math.sin(time / 140) * 1.5, u.y + u.r * 0.9 - bob);
        if (time >= (e._laughAt || 0)) {   // now and then a laugh, in a bubble pointing at it
            e._laughAt = time + 3200 + Math.random() * 1600;
            const msg = ['blub ha ha!', 'hehe... glorp!', 'BLUB BLUB BLUB', 'mine now! hee'][Math.floor(Math.random() * 4)];
            const t = this.add.text(0, 0, msg, { fontSize: '11px', fontFamily: UIKit.FONT.title, fontStyle: 'bold', color: '#2a1440' }).setOrigin(0.5);
            const w = t.width + 14, h = t.height + 8, headY = hl.y - 22 * SC * 0.5, bx = hl.x + 18, by = headY - h - 8;
            const bub = this.add.graphics();
            bub.fillStyle(0x1a0a2a, 1).fillRoundedRect(-w / 2 - 1, -h / 2 - 1, w + 2, h + 2, 6);
            bub.fillStyle(0xf6eeff, 1).fillRoundedRect(-w / 2, -h / 2, w, h, 5);
            bub.fillStyle(0xf6eeff, 1).fillTriangle(-w / 2 + 6, h / 2 - 1, -w / 2 + 16, h / 2 - 1, hl.x - bx, headY - by + 2);   // its tail, down to the Leech's head
            bub.lineStyle(1, 0x1a0a2a, 1).lineBetween(-w / 2 + 6, h / 2, hl.x - bx, headY - by + 2).lineBetween(-w / 2 + 16, h / 2, hl.x - bx, headY - by + 2);
            const c = this.add.container(bx, by, [bub, t]).setScrollFactor(0).setDepth(34).setAlpha(0).setScale(0.6);
            this._vfxSort?.(c);
            this.tweens.add({ targets: c, alpha: 1, scale: 1, duration: 160, ease: 'Back.easeOut' });
            this.tweens.add({ targets: c, alpha: 0, delay: 1400, duration: 220, onComplete: () => c.destroy() });
        }
    }
    // With your element: it runs, preferring tiles beside its friends (its bar keeps up with it)
    _leechFlee(e, time) {
        const L = this._leechCfg(), T = this.TILE_SIZE;
        e._moveCdMult = 999;   // it moves itself
        e._leechGlow?.setPosition(e.sprite.x, e.sprite.y);
        if (!e._leechHeld?.getData?.('flying')) this._leechHold(e, time);
        this.updateEnemyHealthBar(e);
        if (e._porting) return;
        if (time >= (e._portNext || 0) && !e.isFrozen && !e.isStunned && this._leechPort(e, time)) return;
        if (time - (e._fleeAt || 0) < L.FLEE_MS || e.isFrozen || e.isStunned) return;
        e._fleeAt = time;
        let best = null, score = -Infinity;
        for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [-1, -1], [1, -1], [-1, 1]]) {
            const x = e.x + dx, y = e.y + dy;
            if (this.world[x]?.[y] !== this.FLOOR || (x === this.playerX && y === this.playerY) || this.enemies.some(o => o !== e && o.sprite?.active && o.x === x && o.y === y)) continue;
            const cover = this.enemies.filter(o => o !== e && o.sprite?.active && Math.abs(o.x - x) + Math.abs(o.y - y) <= 2).length;
            const sc = Math.hypot(x - this.playerX, y - this.playerY) + 0.7 * cover + Math.random() * 0.3;
            if (sc > score) { score = sc; best = [x, y]; }
        }
        if (!best || score <= Math.hypot(e.x - this.playerX, e.y - this.playerY)) return;
        e.x = best[0]; e.y = best[1];
        this.tweens.add({ targets: e.sprite, x: e.x * T + T / 2, y: e.y * T + T / 2 + this.SLIME_Y_OFFSET, duration: L.FLEE_MS * 0.9, ease: 'Sine.easeOut' });
    }
    // Into a portal and out of another PORT_DIST tiles on, the furthest open tile from you round there
    _leechPort(e, time) {
        // anywhere open PORT_DIST-ish away (a ring 3 to PORT_DIST + 2 round it), the furthest from you: backed into a corner
        // it still slips out sideways or past you
        const L = this._leechCfg(), T = this.TILE_SIZE, R = L.PORT_DIST + 2, room = e.tutorialRoomIndex !== undefined ? this.rooms?.[e.tutorialRoomIndex] : null;
        let best = null, bestD = -1;
        for (let dy = -R; dy <= R; dy++) for (let dx = -R; dx <= R; dx++) {
            const r = Math.hypot(dx, dy), x = e.x + dx, y = e.y + dy;
            if (room && (x <= room.x || y <= room.y || x >= room.x + room.w - 1 || y >= room.y + room.h - 1)) continue;   // never out of its own room (past a gate)
            if (r < 3 || r > R || this.world[x]?.[y] !== this.FLOOR || this.isInLockedRoom?.(x, y) || (x === this.playerX && y === this.playerY)
                || this.enemies.some(o => o !== e && o.sprite?.active && o.x === x && o.y === y)) continue;
            const d = Math.hypot(x - this.playerX, y - this.playerY) + Math.random() * 0.5;
            if (d > bestD) { bestD = d; best = [x, y]; }
        }
        if (!best) { e._portNext = time + 1000; return false; }   // nowhere to go: try again in a moment
        e._portNext = time + L.PORT_CD;
        e._porting = true;
        const portal = (x, y) => {   // a swirl of the void opening on the floor, then closing
            const g = this.add.graphics().setDepth((e.sprite.depth ?? 1) - 0.03).setPosition(x, y + 8);
            const st = { k: 0 };
            this.tweens.add({ targets: st, k: 1, duration: L.PORT_MS, yoyo: true, onUpdate: () => {
                g.clear().fillStyle(0x0a0418, 0.9).fillEllipse(0, 0, 30 * st.k, 12 * st.k);
                g.lineStyle(2, 0xb070ff, 0.95).strokeEllipse(0, 0, 30 * st.k, 12 * st.k);
                g.lineStyle(1, 0xffffff, 0.7).strokeEllipse(0, 0, 18 * st.k, 7 * st.k);
            }, onComplete: () => g.destroy() });
            VisualFX.ripple(this, x, y + 8, 6, 26, 0xb070ff, { duration: 300 });
        };
        const s = e.sprite, tx = best[0] * T + T / 2, ty = best[1] * T + T / 2 + this.SLIME_Y_OFFSET;
        portal(s.x, s.y);
        this.tweens.add({ targets: [s, e._leechHeld].filter(Boolean), alpha: 0, duration: L.PORT_MS * 0.8 });
        this.time.delayedCall(L.PORT_MS, () => {
            if (!s.active) return;
            e.x = best[0]; e.y = best[1]; s.setPosition(tx, ty);
            portal(tx, ty);
            this.tweens.add({ targets: [s, e._leechHeld].filter(Boolean), alpha: 1, duration: L.PORT_MS * 0.8, onComplete: () => { e._porting = false; } });
            this.updateEnemyHealthBar(e);
        });
        Sfx.play(this, 'whoosh');
        return true;
    }
    // From killEnemy: the element it stole is yours again
    _leechDie(e) {
        e._leechIcon?.destroy(); e._leechGlow?.destroy(); e._hudLeech?.destroy();
        const el = e._stoleEl, held = e._leechHeld;
        if (!el || this._elStolen?.[el] !== e) { held?.destroy(); return; }
        delete this._elStolen[el];
        const col = this._leechCfg().COLS[el];
        if (held?.active) {   // flung out of its grip and back into you, in an arc
            this.tweens.killTweensOf(held);
            const x0 = held.x, y0 = held.y, st = { t: 0 };
            this.tweens.add({ targets: st, t: 1, duration: 520, ease: 'Sine.easeIn', onUpdate: () => {
                if (!this.player) return;
                const t = st.t; held.setPosition(x0 + (this.player.x - x0) * t, y0 + (this.player.y - 8 - y0) * t - Math.sin(t * Math.PI) * 46).setRotation(t * 9).setAlpha(1);
            }, onComplete: () => { if (this.player) { VisualFX.ripple(this, this.player.x, this.player.y, 6, 30, col, { duration: 260 }); this._vfxFlash?.(this.player.x, this.player.y, 70, col, 260, 0.9); } held.destroy(); } });
        }
        this.showStatusText(this.player.x, this.player.y - 34, `${el.toUpperCase()} RETURNED`, UIKit._hex(col));
        for (let i = 0; i < 10; i++) {
            const m = this.add.image(e.sprite.x, e.sprite.y, 'vfx_dot').setTint(col).setBlendMode(Phaser.BlendModes.ADD).setDepth(4.5);
            this.tweens.add({ targets: m, x: this.player.x, y: this.player.y, delay: i * 35, duration: 380, ease: 'Quad.easeIn', onComplete: () => m.destroy() });
        }
        Sfx.play(this, 'pickup');
    }

    // ── THE GEM ──────────────────────────────────────────────────────────────
    // A crystal that can't be hurt and never moves; it shatters when everything else is dead.
    // Every EVERY ms a gem of one element's colour starts falling at you from high up, taking
    // FALL ms, and SAFE circles of that colour open on the floor. When it lands you must be in one
    // AND holding that element, or it bursts on you for DMG.
    _gemCfg() { return { EVERY: 22000, FIRST: 6000, FALL: 5000, SAFE: 3, SAFE_R: 1.6, SAFE_GAP: 5, DMG: 38, BURST_R: 2.2,
        COLS: { fire: 0xff8a2a, ice: 0x6ac8ff, lightning: 0xffe040, cosmic: 0xb070ff } }; }
    static gemKey(scene, el, col) {
        return ShopScene.icon(scene, 'fx_gem_' + el, 24, { G: UIKit._hex(col), L: UIKit._hex(MenuArt.mix(col, 0xffffff, 0.45)), D: UIKit._hex(MenuArt.mix(col, 0x000000, 0.45)), K: '#0a0612', W: '#ffffff' }, m => {
            m.poly([[12, 1], [21, 8], [12, 23], [3, 8]], 'K');
            m.poly([[12, 3], [19, 8], [12, 21], [5, 8]], 'G');
            m.poly([[12, 3], [19, 8], [12, 8]], 'L'); m.poly([[5, 8], [12, 8], [12, 21]], 'D');
            m.line(7, 6, 9, 5, 'W'); m.set(10, 5, 'W');
        });
    }
    createGem(x, y, ri) {
        const G = this._gemCfg();
        const e = this.createEnemy(x, y, 999);
        e.tutorialRoomIndex = ri;
        e._isGem = true; e._moveCdMult = 999;   // it doesn't move
        e._gemNext = this.time.now + G.FIRST;
        e._gemHue = e.sprite.preFX?.addColorMatrix?.() || null;   // its facets' colours turn round the wheel (WebGL)
        e._gemGlow = VisualFX.aura(this, e.sprite.x, e.sprite.y, 40, 0xd8e8ff, { alpha: 0.7 });
        return e;
    }
    _gemTick(e, time) {
        const G = this._gemCfg(), s = e.sprite;
        e.healthBarBg?.setVisible(false); e.healthBarFill?.setVisible(false);
        const bob = Math.sin(time / 500) * 4;
        e._gemBody?.setPosition(s.x, s.y - 10 + bob).setRotation(Math.sin(time / 900) * 0.08);
        e._gemGlow?.setPosition(s.x, s.y - 6);
        e._gemHue?.hue((time * 0.09) % 360);   // shifting colours
        if (time >= (e._gemGlintAt || 0)) {   // light catching a facet
            e._gemGlintAt = time + 180 + Math.random() * 260;
            const gl = this.add.image(s.x + (Math.random() - 0.5) * 22, s.y + 2 + (Math.random() - 0.5) * 12, 'vfx_dot').setTint(0xffffff).setBlendMode(Phaser.BlendModes.ADD).setDepth((s.depth ?? 1) + 0.03).setScale(0.15);
            this._vfxSort?.(gl);
            this.tweens.add({ targets: gl, scale: 0.9, alpha: 0, duration: 320, onComplete: () => gl.destroy() });
        }
        // it's done when nothing else is left (in the Tower, nothing more coming either; in a level of rooms, nothing left in its room)
        const T = this.towerRun, more = T && (T.wave < T.waves || T.pending?.length);
        const roomed = !T && e.tutorialRoomIndex !== undefined && this._roomGated(), mine = o => !roomed || o.tutorialRoomIndex === e.tutorialRoomIndex;
        if (!more && !this.enemies.some(o => o !== e && !o._isGem && o.sprite?.active && o.health > 0 && mine(o))) {
            this._gemShatter(e); return;
        }
        if (roomed && this.getCurrentPlayerRoom() !== e.tutorialRoomIndex) { e._gemNext = Math.max(e._gemNext, time + 2500); return; }   // not till you're in its room
        if (time >= e._gemNext && !e._gemDrop && !this._deathScreenActive) { e._gemNext = time + G.EVERY; this._gemDrop(e); }
    }
    _gemDrop(e) {
        const G = this._gemCfg(), T = this.TILE_SIZE;
        const els = Object.keys(G.COLS).filter(el => this.unlockedElements?.has(el));   // only what you can hold
        const el = els[Math.floor(Math.random() * els.length)] || 'fire', col = G.COLS[el];
        e._gemDrop = true;
        Sfx.play(this, 'tell', { ms: 1200, big: true });
        e._gemGlow?.setTint(col);   // its glow takes the colour of what's coming
        // the safe circles: open floor in your room, apart from each other
        const room = (this.rooms || []).find(r => this.playerX >= r.x && this.playerX < r.x + r.w && this.playerY >= r.y && this.playerY < r.y + r.h);
        const zones = [];
        for (let i = 0; i < 200 && zones.length < G.SAFE; i++) {
            const x = room ? room.x + 1 + Math.floor(Math.random() * (room.w - 2)) : this.playerX + Math.floor(Math.random() * 17) - 8;
            const y = room ? room.y + 1 + Math.floor(Math.random() * (room.h - 2)) : this.playerY + Math.floor(Math.random() * 17) - 8;
            if (this.world[x]?.[y] !== this.FLOOR || zones.some(z => Math.hypot(z.x - x, z.y - y) < G.SAFE_GAP)) continue;
            zones.push({ x, y, aura: this._gemDome(x * T + T / 2, y * T + T / 2, G.SAFE_R * T, col), rim: VisualFX.aura(this, x * T + T / 2, y * T + T / 2, G.SAFE_R * T, col, { style: 'field', alpha: 0.4 }) });
        }
        this.showStatusText(this.player.x, this.player.y - 44, `${el.toUpperCase()} GEM FALLING`, UIKit._hex(col));
        // the falling gem: high over you, following you down; its shadow grows under you
        const gem = this.add.image(this.player.x, this.player.y - 200, LevelManager.gemKey(this, el, col)).setDepth(6).setScale(2.2);   // (high enough to read as falling, low enough to stay on screen)
        const shadow = this.add.ellipse(this.player.x, this.player.y + 8, 10, 5, 0x000000, 0.35).setDepth(0.96);
        const t0 = this.time.now;
        const follow = () => {
            if (!gem.active || !this.player?.active) return;
            const k = Math.min(1, (this.time.now - t0) / G.FALL), eased = k * k;   // slow at first, quicker at the end
            gem.setPosition(this.player.x, this.player.y - 200 * (1 - eased) - 8).setRotation(k * 4);
            shadow.setPosition(this.player.x, this.player.y + 8).setSize(10 + 40 * k, 5 + 18 * k).setAlpha(0.2 + 0.35 * k);
        };
        this.events.on('update', follow);
        this.time.delayedCall(G.FALL, () => {
            this.events.off('update', follow);
            const safe = zones.some(z => Math.hypot(z.x - this.playerX, z.y - this.playerY) <= G.SAFE_R) && this.currentElement === el;
            const px = this.player.x, py = this.player.y;
            gem.destroy(); shadow.destroy();
            for (const z of zones) for (const o of [z.aura, z.rim]) if (o.active) { this.tweens.killTweensOf(o); o.destroy(); }
            e._gemDrop = false;
            if (safe) {
                this.showStatusText(px, py - 34, 'SAFE', UIKit._hex(col));
                VisualFX.ripple(this, px, py, 6, 40, col, { duration: 400 });
            } else {   // it bursts on you
                VisualFX.ripple(this, px, py, 10, G.BURST_R * T, col, { duration: 520, alpha: 1 });
                this._vfxFlash?.(px, py, G.BURST_R * T, col, 300, 0.9);
                this.cameras.main.shake(160, 0.01);
                this._hitBy = e; this.takeDamage(G.DMG * (this.enemyDamageScale || 1)); this._hitBy = null;
            }
            for (let i = 0; i < 14; i++) {   // shards
                const a = i / 14 * Math.PI * 2, m = this.add.image(px, py, 'vfx_dot').setTint(i % 2 ? col : 0xffffff).setDepth(5);
                this.tweens.add({ targets: m, x: px + Math.cos(a) * 50, y: py + Math.sin(a) * 34, alpha: 0, duration: 450, onComplete: () => m.destroy() });
            }
            Sfx.play(this, 'shatter');
        });
    }
    // A safe zone: a glassy dome of the gem's colour over a ring on the floor, a sheen across it
    _gemDome(x, y, R, col) {
        const g = this.add.graphics().setDepth(4.3).setPosition(x, y);
        const H = R * 0.95, half = (rx, ry, n = 24) => Array.from({ length: n + 1 }, (_, i) => { const t = Math.PI * i / n; return { x: Math.cos(t) * rx, y: -Math.sin(t) * ry }; });
        g.fillStyle(col, 0.16).fillEllipse(0, 0, R * 2, R * 0.9);                        // its footprint
        g.lineStyle(2, col, 0.9).strokeEllipse(0, 0, R * 2, R * 0.9);
        g.fillStyle(col, 0.14).fillPoints(half(R, H), true);                              // the dome
        g.lineStyle(1, MenuArt.mix(col, 0xffffff, 0.5), 0.3);
        for (const k of [0.35, 0.7]) g.strokePoints(half(R * k, H * Math.sqrt(1 - k * k * 0.3)), false);   // meridians
        g.strokeEllipse(0, -H * 0.55, R * 1.7, R * 0.35);                                 // a band round it
        g.lineStyle(2, col, 0.85).strokePoints(half(R, H), false);                        // its rim
        g.lineStyle(3, 0xffffff, 0.45).strokePoints(half(R * 0.8, H * 0.8, 24).slice(14, 21), false);   // the sheen, upper left
        g.setScale(1, 0.1).setAlpha(0);
        this.tweens.add({ targets: g, scaleY: 1, alpha: 1, duration: 380, ease: 'Back.easeOut' });   // rising out of the floor
        this.tweens.add({ targets: g, alpha: 0.75, delay: 400, duration: 700, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
        return g;
    }
    _gemShatter(e) {
        const s = e.sprite;
        for (let i = 0; i < 16; i++) {
            const a = i / 16 * Math.PI * 2, m = this.add.image(s.x, s.y - 10, 'vfx_dot').setTint(i % 2 ? 0xffffff : 0xd8e8ff).setDepth(5).setScale(1.4);
            this.tweens.add({ targets: m, x: s.x + Math.cos(a) * 60, y: s.y - 10 + Math.sin(a) * 44, alpha: 0, duration: 600, onComplete: () => m.destroy() });
        }
        this.showStatusText(s.x, s.y - 40, 'THE GEM SHATTERS', '#e8f0ff');
        Sfx.play(this, 'shatter');
        e._isGem = false;   // (so killEnemy goes through)
        this.killEnemy(e);
    }

    // ── ARMOUR (the CEO's and its knights') ──────────────────────────────────
    // `_plate` up to `_plateMax` (as much as its health): while it holds, every hit does PLATE_TAKE
    // of its damage to the armour and none to the health; what breaks through goes to health in full.
    _plateCfg() { return { PLATE_TAKE: 0.4 }; }
    _plateGive(e, frac = 1) {
        e._plateMax = e._plate = Math.round(e.maxHealth * frac);
        e._special = true;
    }
    _plateTake(e, d) {
        const k = this._plateCfg().PLATE_TAKE, chip = d * k;
        if (chip < e._plate) { e._plate -= chip; return 0; }
        const over = (chip - e._plate) / k;
        e._plate = 0;
        if (e.sprite?.active) { this.showStatusText(e.sprite.x, e.sprite.y - 30, 'ARMOR BROKEN', '#c8d0dc'); Sfx.play(this, 'shatter'); }
        return over;
    }
    // A grey bar over the health bar while the armour holds, and the armour on its body: riveted steel plates
    // (fx_plate_armor, a frame for each of the slime sheet's) worn over its frame, so they hop and squash with it.
    // Broken, the plates drop off.
    _plateDraw(e) {
        if (!(e._plate > 0)) {
            e._plateBar?.destroy(); e._plateBar = null;
            const a = e._plateArmor; e._plateArmor = null;
            if (a?.active) this.tweens.add({ targets: a, y: a.y + 12, alpha: 0, duration: 420, ease: 'Quad.easeIn', onComplete: () => a.destroy() });
            return;
        }
        const g = e._plateBar ||= this.add.graphics().setDepth(4.75), s = e.sprite;
        const a = e._plateArmor ||= this.textures.exists('fx_plate_armor') ? this.add.image(s.x, s.y, 'fx_plate_armor', '0') : null;
        if (a) {
            a.setFrame(a.texture.has(s.frame.name) ? s.frame.name : '0').setPosition(s.x, s.y).setOrigin(s.originX, s.originY).setScale(s.scaleX, s.scaleY)
                .setFlipX(s.flipX).setDepth((s.depth ?? 1) + 0.0005).setAlpha(s.alpha).setVisible(s.visible);
            if (s.isCropped && s._crop) a.setCrop(s._crop.x, s._crop.y, s._crop.width, s._crop.height); else if (a.isCropped) a.setCrop();   // (rising out of the floor as it spawns)
        }
        const bx = e.healthBarBg?.x ?? e.sprite.x, by = (e.healthBarBg?.y ?? e.sprite.y - 20) - 5, w = 24;
        g.clear().fillStyle(0x000000, 0.8).fillRect(bx - w / 2, by - 2, w, 3);
        g.fillStyle(0xb8c4d4, 1).fillRect(bx - w / 2, by - 2, w * e._plate / e._plateMax, 3);
    }

    // ── SLIME CEO ────────────────────────────────────────────────────────────
    // Armoured from the start (its health again as armour). Every KNIGHT_EVERY it knights an
    // unarmoured enemy in its AURA (full armour). Every WAVE_EVERY it sends a slow wave out to
    // the room's edges, a ring a tile further each WAVE_STEP ms, with GAPS openings to step into
    // (or dash through it). Each ring lights, hits and is gone before the next. It goes off wherever you are.
    _ceoCfg() { return { HP: 380, SCALE: 1.7, SPEED: 2.0, MELEE: 5, AURA: 5, KNIGHT_EVERY: 8000, WAVE_EVERY: 6500, WINDUP: 700, WAVE_STEP: 460, RING_MS: 240, WAVE_DMG: 12, GAPS: 2, GAP_HALF: 0.42 }; }
    createSlimeCeo(x, y, ri) {
        const C = this._ceoCfg();
        const e = this.createEnemy(x, y, C.HP);
        e.tutorialRoomIndex = ri;
        e._isCeo = true; e._moveCdMult = C.SPEED; e._meleeDmg = C.MELEE;
        e._baseScale = this.SLIME_SCALE * C.SCALE; e.sprite.setScale(e._baseScale); LevelManager.seat(e, C.SCALE);
        e._hpBarYOff = Math.min(e._hpBarYOff, -20);
        this._plateGive(e);
        e._ceoKnightAt = this.time.now + 3000; e._ceoWaveAt = this.time.now + 3500;
        const k = LevelManager.bodyKey(this, 'ceo');   // a suit, gold at the edges
        if (k) { e.sprite.setTexture(k, 0); e.sprite.play(k + '_idle'); }
        return e;
    }
    _ceoTick(e, time) {
        const C = this._ceoCfg();
        if (e.isFrozen || e.isStunned) return;
        if (time >= e._ceoKnightAt) {
            e._ceoKnightAt = time + C.KNIGHT_EVERY;
            const near = this.enemies.filter(o => o !== e && o.sprite?.active && o.health > 0 && !(o._plate > 0) && !o._isCeo && !o._isShade && Math.hypot(o.x - e.x, o.y - e.y) <= C.AURA);
            const o = near[Math.floor(Math.random() * near.length)];
            if (o) {
                this._plateGive(o); o._knight = true;
                const g = this.add.graphics().setDepth(3).lineStyle(3, 0xffd84a, 0.9).lineBetween(e.sprite.x, e.sprite.y, o.sprite.x, o.sprite.y);
                this.tweens.add({ targets: g, alpha: 0, duration: 500, onComplete: () => g.destroy() });
                this.showStatusText(o.sprite.x, o.sprite.y - 30, 'KNIGHTED!', '#ffd84a');
                Sfx.play(this, 'clink');
            }
        }
        if (time >= e._ceoWaveAt) {
            e._ceoWaveAt = time + C.WAVE_EVERY;
            this.showStatusText(e.sprite.x, e.sprite.y - 40, '!', '#ffd84a');
            VisualFX.ripple(this, e.sprite.x, e.sprite.y, 6, 40, 0xffd84a, { duration: C.WINDUP });
            this.time.delayedCall(C.WINDUP, () => { if (e.sprite?.active && e.health > 0) this._ceoWave(e); });
        }
    }
    _ceoWave(e) {
        const C = this._ceoCfg(), T = this.TILE_SIZE, cx = e.x, cy = e.y;
        const room = (this.rooms || []).find(r => cx >= r.x && cx < r.x + r.w && cy >= r.y && cy < r.y + r.h);
        const x0 = room ? room.x : cx - 14, x1 = room ? room.x + room.w - 1 : cx + 14, y0 = room ? room.y : cy - 14, y1 = room ? room.y + room.h - 1 : cy + 14;
        const far = Math.ceil(Math.max(...[[x0, y0], [x1, y0], [x0, y1], [x1, y1]].map(([x, y]) => Math.hypot(x - cx, y - cy))));
        const gaps = Array.from({ length: C.GAPS }, (_, i) => Math.random() * Math.PI * 2 / C.GAPS + i * Math.PI * 2 / C.GAPS);
        const inGap = (x, y) => { const a = Math.atan2(y - cy, x - cx); return gaps.some(g => Math.abs(Phaser.Math.Angle.Wrap(a - g)) < C.GAP_HALF); };
        let hit = false;
        Sfx.play(this, 'fissure');
        for (let r = 1; r <= far; r++) this.time.delayedCall((r - 1) * C.WAVE_STEP, () => {
            const g = this.add.graphics().setDepth(0.95);
            for (let x = x0; x <= x1; x++) for (let y = y0; y <= y1; y++) {
                if (this.world[x]?.[y] !== this.FLOOR || Math.abs(Math.hypot(x - cx, y - cy) - r) >= 0.5 || inGap(x, y)) continue;
                g.fillStyle(0xffd84a, 0.5).fillRect(x * T + 3, y * T + 3, T - 6, T - 6);
                g.lineStyle(1.5, 0xfff0b0, 0.8).strokeRect(x * T + 3, y * T + 3, T - 6, T - 6);
                if (!hit && x === this.playerX && y === this.playerY) {
                    hit = true;
                    this._hitBy = e; this.takeDamage(C.WAVE_DMG * (this.enemyDamageScale || 1)); this._hitBy = null;
                }
            }
            this.tweens.add({ targets: g, alpha: 0, duration: C.RING_MS, ease: 'Quad.easeIn', onComplete: () => g.destroy() });   // gone a moment before the next ring
        });
    }

    // ── ARMORED SLIME ────────────────────────────────────────────────────────
    // Built for the Tower: plated on three sides that never turn, open on the fourth. A hit
    // from a plated side (judged by where you stand) does ARMOR of its damage; from the open
    // side, WEAK. It's born with the open side away from you, so you have to go round it.
    _armorCfg() { return { HP: 260, ARMOR: 0.05, WEAK: 1.5, SPEED: 1.5, MELEE: 3, SCALE: 1.45 }; }
    createArmoredSlime(x, y, ri) {
        const A = this._armorCfg();
        const e = this.createEnemy(x, y, A.HP);
        e.tutorialRoomIndex = ri;
        e._isArmored = true; e._special = true;
        const dx = x - this.playerX, dy = y - this.playerY;   // the open side faces away from you
        e._armorWeak = Math.abs(dx) >= Math.abs(dy) ? (dx >= 0 ? 'E' : 'W') : (dy >= 0 ? 'S' : 'N');
        e._moveCdMult = A.SPEED; e._meleeDmg = A.MELEE;
        e._modelKey = 'armored_' + e._armorWeak;   // its body shows the open side: a plate gone, the slime glowing through (SlimeModels)
        SlimeModels.wear(this, e.sprite, e._modelKey);
        e._baseScale = this.SLIME_SCALE * A.SCALE; e.sprite.setScale(e._baseScale); LevelManager.seat(e, A.SCALE);   // a big one: it's a tank
        e._armorGfx = this.add.graphics().setDepth((e.sprite.depth ?? 1) + 0.05);
        return e;
    }
    // The side of it you're on: your tile against its, the longer axis deciding (a dead diagonal counts as plated)
    _armorSide(e) {
        const dx = this.playerX - e.x, dy = this.playerY - e.y;
        if (Math.abs(dx) === Math.abs(dy)) return null;
        return Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'E' : 'W') : (dy > 0 ? 'S' : 'N');
    }
    _armorMult(e) {
        const A = this._armorCfg();
        if (this._armorSide(e) === e._armorWeak) return A.WEAK;
        if (this.time.now - (e._armorPingAt || 0) > 700 && e.sprite?.active) {   // say so, now and then
            e._armorPingAt = this.time.now;
            this.showStatusText(e.sprite.x, e.sprite.y - 26, 'ARMORED', '#b8c4d4');
            Sfx.play(this, 'clink');
        }
        return A.ARMOR;
    }
    // Every frame, every level: the plates, and the open side glowing when you're on it
    _updateArmored(time) {
        if (!this.enemies?.length) return;
        for (const e of this.enemies) {
            if (!e._isArmored) continue;
            const g = e._armorGfx;
            if (!e.sprite?.active || e.health <= 0) { g?.destroy(); e._armorGfx = null; continue; }
            if (!g?.active) continue;
            const s = e.sprite, base = this.SLIME_SCALE || 1, kx = Math.abs(s.scaleX) / base, ky = s.scaleY / base;   // its size and the hop's squash both carry to the shields
            g.clear().setPosition(Math.round(s.x), Math.round(s.y + (26.5 - s.originY * 32) * s.scaleY)).setScale(kx, ky).setAlpha(s.alpha);   // round the body, which sits low in its frame
            const open = this._armorSide(e) === e._armorWeak;
            // a soft glow over the gap in its steel: dull while you're round its plates, bright gold when you're on the open side
            const W = e._armorWeak, sx = W === 'E' ? 1 : W === 'W' ? -1 : 0, sy = W === 'S' ? 1 : W === 'N' ? -1 : 0, pulse = 0.55 + 0.45 * Math.sin(time / 140);
            g.fillStyle(open ? 0xffd84a : 0xff7a2a, open ? 0.35 + 0.2 * pulse : 0.12 + 0.08 * pulse).fillCircle(sx * 7, sy * 4, open ? 7 : 5);
        }
    }
    // ── CHEVRONS ─────────────────────────────────────────────────────────────
    // Every frame, every level: chevrons on anything moving faster or slower than its own
    // usual pace (the pace it was born with; for you, your relics and books included), quicker
    // the bigger the change. Whatever already runs its own chevrons (chill, the Anchor's pulse)
    // is left to them.
    _updateSpeedMarks(time) {
        const mark = (who, x, y, r, slowType) => {
            if (Math.abs(r - 1) < 0.12) return;
            if (time - (who._chevAt || 0) < 460 - 300 * Math.min(1, Math.abs(r - 1))) return;
            who._chevAt = time;
            this._spawnSpeedArrow(x, y, r > 1 ? slowType : 'speed_anchor');
        };
        for (const e of this.enemies || []) {
            const s = e.sprite;
            if (!s?.active || e.health <= 0 || e.isFrozen || e._slowIndTimer || e._speedIndTimer || !s.visible || s.alpha < 0.3) continue;
            if (e._isRipplerunner || e._frostStage === 'awake') continue;   // their pace is the terrain's, or a new form's: pulses of their own
            const cd = e._moveCdMult || 1;
            e._chevBase ??= cd < 50 ? cd : 1;   // its own pace, as born
            if (cd >= 50) continue;             // planted to cast or encased: not a pace
            mark(e, s.x, s.y - 10, cd / e._chevBase * (e.isWet ? 2 : 1) / ((e._cheerUntil || 0) > time ? e._cheerSpd : 1) / ((e._discUntil || 0) > time ? e._discSpd : 1), e.isWet ? 'slow_ice' : 'slow_goop');
        }
        if (this.player?.active && this._stepMul && !this._deathScreenActive) mark(this, this.player.x, this.player.y - 6, this._stepMul, (this._frostHazeMult || 1) > 1 || this._ultMoveMult() > 1 ? 'slow_ice' : 'slow_goop');
    }
    // ── HUNTER SLIME ─────────────────────────────────────────────────────────
    // Starts out crawling (SLOW). Every moment it spends chasing you (within CHASE_R) winds it
    // up, to FAST after RAMP_MS, its touch hitting harder all the while (a clock, not tiles run:
    // counting tiles let it wind up faster the faster it got); every time
    // it attacks, pounce or touch, its rage halves. Within POUNCE_R tiles (more, wound up) it
    // marks the ground round you, leaps and vanishes into it, then slashes it for FLURRY_MS, more
    // slashes in that time the angrier it is (SLASHES), sharing FLURRY_DMG between them; the outer tiles cut deepest (RING_MULT). The marked ground grows with it too, from the
    // 3x3 round you to a 5x5 squircle in a frenzy (AREA_R): out of reach only if you dodge out
    // during the tell or keep running. Each slash that finds you hurts and makes you BLEED for BLEED_MS:
    // every tile you move while bleeding costs BLEED_STEP. Wound all the way up it FRENZIES: blood-red, red-eyed, leaving
    // afterimages.
    _hunterCfg() { return { HP: 140, SLOW: 2.4, FAST: 0.55, RAMP_TILES: 16, RAMP_MS: 12000, MELEE0: 2, MELEE1: 6, CHASE_R: 14,
        POUNCE_R: 4, POUNCE_R_MAX: 5, AREA_R: [1.2, 2.3], POUNCE_CD: 7000, TELL: 700, SLASHES: [2, 28], FLURRY_MS: 900, RING_MULT: [0.6, 1, 1.8], FLURRY_DMG: 12, SLASH_RAMP: 1.31,
        BLEED_MS: 6000, BLEED_STEP: 2, BLEED_DASH: 0.5, EYE: 0xffe8d0, FRENZY_EYE: 0xff1a1a }; }
    createHunterSlime(x, y, ri) {
        const H = this._hunterCfg();
        const e = this.createEnemy(x, y, H.HP);
        e.tutorialRoomIndex = ri;
        e._isHunter = true;
        e._huntRun = 0;
        e._huntNext = 0;
        e._moveCdMult = H.SLOW;
        e._meleeDmg = H.MELEE0;
        const k = LevelManager.bodyKey(this, 'hunter');   // charcoal, a red sheen
        if (k) { e.sprite.setTexture(k, 0); e.sprite.play(k + '_idle'); }
        return e;
    }
    _hunterReset(e) { e._huntRun *= 0.5; }   // it attacked: its rage halves, wherever it was
    // Every frame, every level: the chase, the frenzy and the pounce
    _updateHunters(time, delta) {
        if (!this.enemies?.length || this._devFreezeEnemies) return;
        const H = this._hunterCfg();
        for (const e of this.enemies) {
            if (!e._isHunter) continue;
            const s = e.sprite;
            if (!s?.active || e.health <= 0) { e._huntMark?.destroy(); e._huntMark = null; continue; }
            if (e._huntPhase === 'tell' || e._huntPhase === 'gone') continue;   // its timers run those
            const d = Math.hypot(this.playerX - e.x, this.playerY - e.y);
            const held = e.isFrozen || e.isStunned;
            const met = e.tutorialRoomIndex === undefined || !this.rooms?.[e.tutorialRoomIndex] || e.tutorialRoomIndex === this.getCurrentPlayerRoom();   // only once you're in its room: not through the walls before you've met
            if (d <= H.CHASE_R && !held && met) e._huntRun = Math.min(H.RAMP_TILES, e._huntRun + H.RAMP_TILES * Math.min(100, delta || 16) / H.RAMP_MS);   // (its rage kept in RAMP_TILES units: the cools take fractions of it)
            const k = e._huntRun / H.RAMP_TILES;
            e._moveCdMult = H.SLOW + (H.FAST - H.SLOW) * k;
            e._meleeDmg = H.MELEE0 + (H.MELEE1 - H.MELEE0) * k;
            this._hunterFrenzy(e, k >= 1, time);
            const lvl = Math.min(4, Math.floor(k * 4 + 1e-6)), u = s._cfx;   // its ears fill with blood as it winds up
            if (u && u.set !== 'hunter' + lvl) CreatureFX.dress(u, 'hunter' + lvl);
            if (met && d <= H.POUNCE_R + (H.POUNCE_R_MAX - H.POUNCE_R) * k && !held && time >= e._huntNext && !this._deathScreenActive) this._hunterPounce(e, k);
        }
    }
    // Wound all the way up: the blood-red body and red eyes on (or off), afterimages and blood leaking off it
    _hunterFrenzy(e, on, time) {
        const H = this._hunterCfg(), s = e.sprite;
        if (on !== !!e._huntFrenzy) {
            e._huntFrenzy = on;
            const k = on ? LevelManager.bodyKey(this, 'hunter_frenzy')
                         : LevelManager.bodyKey(this, 'hunter');
            if (k) { s.setTexture(k, s.frame?.name ?? 0); s.play(k + '_idle'); }
            if (s._cfx) CreatureFX.dress(s._cfx, undefined, on ? H.FRENZY_EYE : H.EYE);
            if (on) { this.showStatusText(s.x, s.y - 30, 'FRENZY', '#ff2a2a'); Sfx.play(this, 'roar'); }
        }
        if (!on) return;
        if (time - (e._huntGhostAt || 0) > 70) {   // afterimages: the body (and its ears) left behind, fading
            e._huntGhostAt = time;
            const parts = [s, s._cfx?.hat].filter(p => p?.active && p.visible);
            for (const p of parts) {
                const g = this.add.image(p.x, p.y, p.texture.key, p.frame.name).setOrigin(p.originX, p.originY).setScale(p.scaleX, p.scaleY).setFlipX(p.flipX)
                    .setTint(0xff2a2a).setAlpha(0.42).setDepth((s.depth ?? 1) - 0.06);
                this.tweens.add({ targets: g, alpha: 0, duration: 320, ease: 'Quad.easeOut', onComplete: () => g.destroy() });
            }
        }
        if (Math.random() < 0.5) {   // bloodthirst: red drops seeping off it, rising like steam
            const m = this.add.image(s.x + (Math.random() - 0.5) * 18, s.y + 2 + Math.random() * 6, 'vfx_dot').setTint(Math.random() < 0.6 ? 0xc0101e : 0xff4a4a).setAlpha(0.85).setScale(0.6 + Math.random() * 0.5).setDepth((s.depth ?? 1) + 0.05);
            this.tweens.add({ targets: m, y: m.y - 14 - Math.random() * 10, x: m.x + (Math.random() - 0.5) * 8, alpha: 0, scale: 0.2, duration: 500 + Math.random() * 300, onComplete: () => m.destroy() });
        }
    }
    _hunterPounce(e, k) {
        const H = this._hunterCfg(), T = this.TILE_SIZE, tx = this.playerX, ty = this.playerY;
        e._huntPhase = 'tell'; e._moveCdMult = 999;
        // the ground it will strike: tiles inside a squircle growing with its rage (3x3 at a crawl, 5x5 less its corners in a frenzy)
        const R = H.AREA_R[0] + (H.AREA_R[1] - H.AREA_R[0]) * k, area = [];
        for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) if ((dx ** 4 + dy ** 4) ** 0.25 <= R) area.push([dx, dy]);
        const inArea = (x, y) => area.some(([dx, dy]) => dx === x && dy === y), Rn = Math.max(...area.map(([dx]) => Math.abs(dx)));
        const mark = e._huntMark = this.add.graphics().setDepth(0.95).setPosition(tx * T + T / 2, ty * T + T / 2);
        const ring = (dx, dy) => Math.max(Math.abs(dx), Math.abs(dy));   // 0 the middle, 1, 2 the edge: the edge cuts deepest (RING_MULT)
        const draw = (a, flash) => {   // a square per tile, apart from its neighbours, redder and brighter toward the edge
            mark.clear();
            const pad = 3, sz = T - pad * 2;
            for (const [dx, dy] of area) {
                const r = ring(dx, dy), x0 = (dx - 0.5) * T + pad, y0 = (dy - 0.5) * T + pad;
                const col = r === 2 ? 0xff1a1a : r === 1 ? 0xff5a3a : 0xff9a7a, fa = (r === 2 ? 0.28 : r === 1 ? 0.18 : 0.1) + 0.2 * a;
                mark.fillStyle(col, fa).fillRect(x0, y0, sz, sz);
                mark.lineStyle(r === 2 ? 2 : 1, flash ? 0xffffff : col, r === 2 ? 0.95 : 0.7).strokeRect(x0, y0, sz, sz);
                const s2 = sz * (1 - a) * 0.5;   // each square closing in on its middle as the leap comes
                if (s2 > 1) mark.lineStyle(1, col, 0.5).strokeRect(x0 + sz / 2 - s2, y0 + sz / 2 - s2, s2 * 2, s2 * 2);
            }
        };
        draw(0, false);
        this.tweens.addCounter({ from: 0, to: 1, duration: H.TELL, onUpdate: tw => { if (mark.active) draw(tw.getValue(), (this.time.now / 80 | 0) % 2 && tw.getValue() > 0.6); } });
        this.showStatusText(e.sprite.x, e.sprite.y - 28, '!', '#ff3a3a');
        Sfx.play(this, 'whoosh');
        this.time.delayedCall(H.TELL, () => {
            if (!e.sprite?.active || e.health <= 0) { mark.destroy(); return; }
            if (e.isFrozen || e.isStunned) { mark.destroy(); e._huntPhase = null; e._huntNext = this.time.now + 1500; return; }   // caught mid-tell: called off
            e._huntPhase = 'gone';
            this.tweens.killTweensOf(e.sprite);
            this.tweens.add({ targets: e.sprite, alpha: 0, y: e.sprite.y - 18, duration: 120 });
            e.healthBarBg?.setVisible(false); e.healthBarFill?.setVisible(false);
            const cx = tx * T + T / 2, cy = ty * T + T / 2;
            const n = Math.round(H.SLASHES[0] + (H.SLASHES[1] - H.SLASHES[0]) * k), every = H.FLURRY_MS / n;   // the flurry always lasts FLURRY_MS; the angrier, the more slashes in it
            for (let i = 0; i < n; i++) this.time.delayedCall(140 + i * every, () => {
                if (!e.sprite?.active) return;
                this._hunterSlash(cx, cy, i, Rn, area);
                const dx = this.playerX - tx, dy = this.playerY - ty;
                if (inArea(dx, dy)) {
                    const before = this.health;
                    this._hitBy = e; this.takeDamage(H.FLURRY_DMG / n * H.RING_MULT[ring(dx, dy)] * (1 + H.SLASH_RAMP * k) * (this.enemyDamageScale || 1)); this._hitBy = null;
                    if (this.health < before) this._bleedStart(H.BLEED_MS);
                }
            });
            this.time.delayedCall(140 + H.FLURRY_MS, () => {
                mark.destroy(); e._huntMark = null;
                if (!e.sprite?.active) return;
                // out of the flurry on the free tile in the square nearest its middle
                const spots = [...area].sort((a, b) => (a[0] ** 2 + a[1] ** 2) - (b[0] ** 2 + b[1] ** 2)).map(([dx, dy]) => [tx + dx, ty + dy])
                    .filter(([x, y]) => this.world[x]?.[y] === this.FLOOR && !(x === this.playerX && y === this.playerY) && !this.enemies.some(o => o !== e && o.sprite?.active && o.x === x && o.y === y));
                if (spots.length) { [e.x, e.y] = spots[0]; }
                e.sprite.setPosition(e.x * T + T / 2, e.y * T + T / 2 + this.SLIME_Y_OFFSET).setAlpha(1);
                e.healthBarBg?.setVisible(true); e.healthBarFill?.setVisible(true);
                e._committedPath = null; e.lastMoveTime = this.time.now;
                e._huntPhase = null; this._hunterReset(e);   // (its pace and bite follow its rage next frame)
                e._huntNext = this.time.now + H.POUNCE_CD;
                this.updateEnemyHealthBar?.(e);
            });
        });
    }
    // One pass of the flurry: three blade streaks across the square, a different angle each time
    _hunterSlash(cx, cy, i, n = 1, area = []) {
        // a rake of claws across the ground: three curved gashes side by side at a fresh angle each pass, red with a white
        // edge, the tiles they cross flaring and spitting blood
        const T = this.TILE_SIZE, g = this.add.graphics().setDepth(4.6).setPosition(cx, cy).setBlendMode(Phaser.BlendModes.ADD);
        const a = [-0.6, 0.9, 0.15, -1.25, 0.5, -0.2, 1.3][i % 7] + (Math.random() - 0.5) * 0.3, R = T * (0.8 + n), bend = (i % 2 ? 1 : -1) * T * 0.35;
        for (let j = -1; j <= 1; j++) {
            const off = j * T * 0.45, pts = [];
            for (let q = 0; q <= 10; q++) {
                const t = q / 10 * 2 - 1, along = t * R, sweep = bend * (1 - t * t);
                pts.push({ x: Math.cos(a) * along - Math.sin(a) * (off + sweep), y: Math.sin(a) * along + Math.cos(a) * (off + sweep) });
            }
            g.lineStyle(8, 0xc0101e, 0.55).strokePoints(pts, false);
            g.lineStyle(3, 0xff4a4a, 0.95).strokePoints(pts, false);
            g.lineStyle(1, 0xffffff, 1).strokePoints(pts.slice(2, 9), false);
        }
        for (const [dx, dy] of area) if (Math.random() < 0.35) {   // tiles flaring under it
            const f = this.add.rectangle(cx + dx * T, cy + dy * T, T - 6, T - 6, 0xff3a3a, 0.45).setDepth(0.96).setBlendMode(Phaser.BlendModes.ADD);
            this.tweens.add({ targets: f, alpha: 0, duration: 180, onComplete: () => f.destroy() });
        }
        for (let q = 0; q < 6; q++) {   // blood flying off
            const m = this.add.image(cx + (Math.random() - 0.5) * R, cy + (Math.random() - 0.5) * R * 0.6, 'vfx_dot').setTint(0xc0101e).setDepth(4.55).setScale(0.6);
            this.tweens.add({ targets: m, x: m.x + (Math.random() - 0.5) * 30, y: m.y - 10 - Math.random() * 16, alpha: 0, duration: 320, ease: 'Quad.easeOut', onComplete: () => m.destroy() });
        }
        g.setScale(0.6);
        this.tweens.add({ targets: g, scale: 1.05, alpha: 0, duration: 220, ease: 'Cubic.easeOut', onComplete: () => g.destroy() });
        this.cameras.main.shake(40, 0.002);
        Sfx.play(this, 'clink');
    }
    // What's on you, as a row of small pixel icons over your head, each with its time running down beneath:
    // dripping, bleeding, poisoned, rooted, burning, hexed (one graphics, redrawn each frame)
    _playerStatusRow(time) {
        const p = this.player;
        const on = [];
        if ((this._drippingUntil || 0) > time) on.push(['drip', (this._drippingUntil - time) / (this._dripMs || 8000)]);
        if ((this._bleedUntil || 0) > time) on.push(['bleed', (this._bleedUntil - time) / this._hunterCfg().BLEED_MS]);
        if ((this._poisonUntil || 0) > time) on.push(['poison', Math.min(1, (this._poisonUntil - time) / 4000)]);
        if (this._playerRooted && (this._playerRootUntil || 0) > time) on.push(['root', Math.min(1, (this._playerRootUntil - time) / 1500)]);
        if ((this._pBurnUntil || 0) > time) on.push(['burn', (this._pBurnUntil - time) / 3000]);
        if ((this._absHexUntil || 0) > time) on.push(['hex', (this._absHexUntil - time) / 4000]);
        const g = this._statusRowG;
        if (!on.length || !p?.active || this._deathScreenActive) { if (g?.active) g.clear(); return; }
        const G = g?.active ? g : (this._statusRowG = this.add.graphics().setDepth(5.5));
        G.clear().setPosition(Math.round(p.x), Math.round(p.y - 30));
        const ART = {   // 7 x 8, 'k' outline
            drip:   { rows: ['...k...', '..kbk..', '.kbbbk.', 'kbbwbbk', 'kbbbbbk', 'kbbbbbk', '.kbbbk.', '..kkk..'], b: 0x6fd0ee, w: 0xdff6ff },
            bleed:  { rows: ['...k...', '..krk..', '.krrrk.', 'krrwrrk', 'krrrrrk', 'krrrrrk', '.krrrk.', '..kkk..'], r: 0xd8202e, w: 0xffb0b0 },
            poison: { rows: ['.k...k.', 'kgk.kwk', '.k.kgk.', '..kgggk', '.kggwgk', 'kggggk.', 'kgggk..', '.kkk...'], g: 0x8ae04a, w: 0xe8ffd0 },
            root:   { rows: ['..k.k..', '.kvkvk.', '.kvkvk.', '..kvk..', 'k.kvk.k', 'vkkvkkv', '.vvvvv.', '..kkk..'], v: 0x6a4a26 },
            burn:   { rows: ['...k...', '..kok..', '.kooyk.', '.koyok.', 'kooyyok', 'koyyyok', '.koyok.', '..kkk..'], o: 0xff6a20, y: 0xffd040 },
            hex:    { rows: ['.kkkkk.', 'k.khk.k', 'kkhhhkk', 'khhwhhk', 'kkhhhkk', 'k.khk.k', '.kkkkk.', '.......'], h: 0xb05cff, w: 0xf0d0ff },
        };
        const S = 1.5, W = 7 * S, GAP = 4, x0 = -(on.length * (W + GAP) - GAP) / 2;
        on.forEach(([kind, left], i) => {
            const A = ART[kind], ox = x0 + i * (W + GAP), bob = Math.sin(time / 260 + i) * 1;
            A.rows.forEach((row, y) => [...row].forEach((c, x) => {
                if (c === '.') return;
                G.fillStyle(c === 'k' ? 0x14090a : A[c], 1).fillRect(ox + x * S, y * S - 12 + bob, S, S);
            }));
            G.fillStyle(0x14090a, 0.9).fillRect(ox, 1, W, 2.5);   // its time, running down
            G.fillStyle(A.b ?? A.r ?? A.g ?? A.v ?? A.o ?? A.h, 1).fillRect(ox + 0.5, 1.5, Math.max(0, (W - 1) * Math.min(1, left)), 1.5);
        });
    }
    // BLEED: moving hurts. Every tile you go while it lasts (a dash, every tile it covers) costs BLEED_STEP.
    _bleedStart(ms) {
        if (!(this._bleedUntil > this.time.now)) { this._bleedAt = [this.playerX, this.playerY]; Sfx.play(this, 'status', { kind: 'bleed' }); }
        this._bleedUntil = this.time.now + ms;
        this.showStatusText(this.player.x, this.player.y - 34, 'BLEEDING', '#ff4a4a');
    }
    _updateBleed(time) {
        if (!this._bleedUntil) return;
        const p = this.player;
        if (time >= this._bleedUntil || !p?.active) { this._bleedUntil = 0; return; }
        const H = this._hunterCfg(), [bx, by] = this._bleedAt || [this.playerX, this.playerY];
        const steps = Math.abs(this.playerX - bx) + Math.abs(this.playerY - by);
        if (steps > 0) {   // it moved: the wound opens with each tile (a dash too, at BLEED_DASH a tile: a dash's dodge doesn't close your own wound)
            this._bleedAt = [this.playerX, this.playerY];
            const dashing = this.time.now < (this._dashInvulnUntil || 0);
            this._ownWound = true;
            try { this.takeDamage(H.BLEED_STEP * steps * (dashing ? H.BLEED_DASH : 1) * (this.enemyDamageScale || 1)); } finally { this._ownWound = false; }
            for (let k = 0; k < Math.min(6, steps * 2); k++) {
                const m = this.add.image(p.x + (Math.random() - 0.5) * 16, p.y + 4, 'vfx_dot').setTint(0xc81e2a).setDepth((p.depth ?? 2) + 0.1).setScale(0.9);
                this.tweens.add({ targets: m, x: m.x + (Math.random() - 0.5) * 20, y: m.y + 10, alpha: 0, duration: 380, ease: 'Quad.easeOut', onComplete: () => m.destroy() });
            }
        }
        if (time - (this._bleedDripAt || 0) > 150) {   // drips
            this._bleedDripAt = time;
            const m = this.add.image(p.x + (Math.random() - 0.5) * 18, p.y + 2, 'vfx_dot').setTint(0xc81e2a).setDepth((p.depth ?? 2) + 0.1).setScale(0.8);
            this.tweens.add({ targets: m, y: m.y + 14, alpha: 0, duration: 450, ease: 'Quad.easeIn', onComplete: () => m.destroy() });
        }
    }
    // The frost grid: aimed when you're in reach and it's ready; it fires itself once the telegraph runs out
    _frostGridTick(e, time) {
        const F = this._frostCfg(), born = e._frostStage === 'awake';
        if (e._fgAim || e.isStunned || e.isFrozen || e._iceCube) return;
        if (e._fgLast == null) e._fgLast = time - Math.random() * F.GRID_CD;   // a room of them rolls rather than volleys
        if (time - e._fgLast < F.GRID_CD * (born ? F.GRID_BORN_CD : 1)) return;
        const R = F.GRID_R; if (Math.max(Math.abs(this.playerX - e.x), Math.abs(this.playerY - e.y)) > R) return;
        const rr = (this.rooms || []).find(r => e.x >= r.x && e.x < r.x + r.w && e.y >= r.y && e.y < r.y + r.h);
        const area = [];
        for (let dx = -R; dx <= R; dx++) for (let dy = -R; dy <= R; dy++) {
            if (!dx && !dy) continue;
            const x = e.x + dx, y = e.y + dy;
            if (this.world?.[x]?.[y] !== this.FLOOR || this.isInLockedRoom(x, y)) continue;
            if (rr && (x < rr.x || x >= rr.x + rr.w || y < rr.y || y >= rr.y + rr.h)) continue;
            area.push({ x, y });
        }
        // safe tiles at random, none closer than GAP to another, as many as fit (so a gap is always near)
        const GAP = born ? F.GRID_GAP_BORN : F.GRID_GAP, safe = [];
        for (let i = area.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [area[i], area[j]] = [area[j], area[i]]; }
        for (const t of area) if (safe.every(q => Math.max(Math.abs(q.x - t.x), Math.abs(q.y - t.y)) >= GAP)) safe.push(t);
        const tiles = area.filter(t => !safe.includes(t));
        const aim = born ? F.GRID_AIM_BORN : F.GRID_AIM, TS = this.TILE_SIZE;
        e._fgAim = tiles; e._fgHold = e._moveCdMult; e._moveCdMult = 999;   // it stands to cast
        const g = this.add.graphics().setDepth(0.9);
        for (const t of tiles) {
            g.fillStyle(born ? 0x4a9fff : 0x9fe8ff, 0.24); g.fillRect(t.x * TS + 1, t.y * TS + 1, TS - 2, TS - 2);
            g.lineStyle(1.2, 0xdff8ff, 0.6); g.strokeRect(t.x * TS + 1.5, t.y * TS + 1.5, TS - 3, TS - 3);
        }
        this.tweens.add({ targets: g, alpha: 0.45, duration: 160, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
        Sfx.play(this, 'freeze');
        this.time.delayedCall(aim, () => {   // (on its own clock, so a death mid-cast still clears the telegraph)
            this.tweens.killTweensOf(g); g.destroy();
            e._fgAim = null; e._fgLast = this.time.now;
            if (!e.sprite?.active || e._frostStage === 'statue') return;
            e._moveCdMult = e._fgHold;
            if (tiles.some(t => t.x === this.playerX && t.y === this.playerY)) {
                this.takeDamage((born ? F.GRID_DMG_BORN : F.GRID_DMG) * (this.enemyDamageScale || 1));
                this.showStatusText?.(this.player.x, this.player.y - 30, 'FROSTBITTEN', '#bff4ff');
            }
            const f = this.add.graphics().setDepth(2.6);
            for (const t of tiles) { f.fillStyle(0xffffff, 0.8); f.fillRect(t.x * TS + 3, t.y * TS + 3, TS - 6, TS - 6); f.fillStyle(0x9fe8ff, 0.5); f.fillRect(t.x * TS, t.y * TS, TS, TS); }
            this.tweens.add({ targets: f, alpha: 0, duration: 280, ease: 'Quad.easeOut', onComplete: () => f.destroy() });
            this._vfxBursts?.ice?.explode(14, e.sprite.x, e.sprite.y); this.cameras.main.shake(90, 0.004); Sfx.play(this, 'shatter');
        });
    }
    // A rebirth, up close: the fight holds still (GameScene._frame skips play while _cinemaUntil runs), bars slide in, the
    // camera swoops onto (x, y) as the shell shudders, `hatch` breaks it, the new body lands, and it all swings back.
    _rebirthCinematic(x, y, hatch) {
        const cam = this.cameras.main, now = this.time.now, IN = 260, HOLD = 420, AFTER = 650, OUT = 300;
        if (this._cinemaUntil > now || !cam) { hatch(); return; }   // one at a time: a second goes off as it would
        this._cinemaUntil = now + IN + HOLD + AFTER + OUT;
        Music.duck(true, 'rebirth');   // the music holds its breath too
        const z0 = cam.zoom, W = this.scale.width, H = this.scale.height, bh = Math.round(H * 0.09);
        const bars = [0, 1].map(k => { const b = this.add.rectangle(W / 2, k ? H + bh / 2 : -bh / 2, W, bh, 0x000000, 1).setScrollFactor(0).setDepth(4900); this._vfxSort?.(b); return b; });
        bars.forEach((b, k) => this.tweens.add({ targets: b, y: k ? H - bh / 2 : bh / 2, duration: IN, ease: 'Cubic.easeOut' }));
        cam.stopFollow(); cam.pan(x, y, IN, 'Cubic.easeOut'); cam.zoomTo(z0 * 1.9, IN, 'Cubic.easeOut');
        this.time.delayedCall(IN, () => cam.shake(HOLD, 0.004));   // the shell shudders
        this.time.delayedCall(IN + HOLD, () => { hatch(); cam.flash(120, 255, 255, 255); });
        this.time.delayedCall(IN + HOLD + AFTER, () => {
            cam.zoomTo(z0, OUT, 'Cubic.easeInOut');
            if (this.player) cam.pan(this.player.x, this.player.y, OUT, 'Cubic.easeInOut');
            bars.forEach((b, k) => this.tweens.add({ targets: b, y: k ? H + bh / 2 : -bh / 2, duration: OUT, onComplete: () => b.destroy() }));
            this.time.delayedCall(OUT, () => { if (this.player) cam.startFollow(this.player, true, 0.1, 0.1); this._cinemaUntil = 0; Music.duck(false, 'rebirth'); });
        });
    }
    _frostHatch(e) {
        const F = this._frostCfg(), s = e.sprite;
        e._frostStage = 'awake';
        e.maxHealth = e.health = Math.round(e._frostOrig * F.HP_MULT);
        e._moveCdMult = F.SPEED; e._meleeDmg = F.MELEE;
        e.isStunned = false; e.stunnedUntil = 0;
        this.updateEnemyHealthBar?.(e);
        e._frostRing?.destroy(); e._frostRing = null;
        if (e._frostGfx) { const b = e._frostGfx; this.tweens.add({ targets: b, alpha: 0, scale: 2.6, duration: 260, onComplete: () => b.destroy() }); e._frostGfx = null; }
        const bk = LevelManager.frostSlimeKey(this, true);   // the Frostborn's body: deep ice, spikes along its back
        if (bk && s) { s.setTexture(bk, 0); s.play(bk + '_idle'); }
        if (s?._cfx) CreatureFX.dress(s._cfx, null);   // the spikes are its crown now
        if (s) { const sc = s.scaleX; this.tweens.add({ targets: s, scaleX: sc * 1.25, scaleY: s.scaleY * 1.25, duration: 200, ease: 'Back.easeOut' }); }
        e._frostHaze = VisualFX.aura(this, s.x, s.y + 8, F.HAZE_R * this.TILE_SIZE, 0x9fe8ff, { alpha: 1 });
        this._vfxBursts?.ice?.explode(30, s.x, s.y);
        Sfx.play(this, 'shatter'); Sfx.play(this, 'roar');
        this.cameras.main.shake(160, 0.006);
        this.showStatusText(s.x, s.y - 30, 'FROSTBORN!', '#4a9fff');
    }
    // The Frost Slime's own body (and its Frostborn's, `born`): the slime sheet recoloured pixel by pixel into ice by how light
    // each pixel is, a frost glint across it, a few sparkles. Made once, with the red slime's frames and an idle anim of its own.
    // ── LOOKS ───────────────────────────────────────────────────────────────
    // How each enemy is drawn: a body of its own (the red slime redrawn in PAL, with GLINT speckles), or the red or purple
    // slime tinted; its hat and eyes are Creatures.js's TYPES. One table, for the game, the new-enemy card and the index.
    static LOOKS = {
        bud:           { pal: [[20, 48, 18], [52, 120, 40], [98, 180, 66], [168, 228, 110], [236, 255, 200]], glint: [255, 176, 220] },
        hunter:        { pal: [[14, 10, 14], [44, 30, 40], [78, 52, 64], [140, 60, 70], [230, 90, 90]] },
        hunter_frenzy: { pal: [[20, 4, 8], [66, 8, 16], [110, 14, 24], [160, 26, 34], [230, 66, 66]] },
        armored:       { pal: [[40, 44, 54], [92, 100, 116], [140, 150, 166], [190, 200, 214], [240, 246, 252]] },
        wraith:        { pal: [[26, 18, 40], [78, 66, 104], [150, 140, 184], [214, 208, 234], [250, 248, 255]] },   // pale ghost-lavender (the Frost Slime is the icy blue)
        diver:         { pal: [[8, 22, 40], [16, 60, 100], [30, 110, 170], [80, 180, 230], [200, 240, 255]] },
        ceo:           { pal: [[20, 14, 30], [52, 36, 80], [96, 70, 140], [160, 130, 200], [255, 222, 120]] },
        anchor:        { pal: [[16, 22, 34], [44, 58, 80], [84, 104, 134], [130, 156, 190], [200, 220, 240]] },
        healer:        { pal: [[14, 40, 26], [40, 110, 70], [80, 180, 120], [150, 230, 180], [236, 255, 244]] },
        cheer:         { pal: [[56, 10, 36], [140, 30, 86], [220, 74, 146], [255, 140, 196], [255, 226, 242]], glint: [255, 255, 255] },
    };
    static TINTS = { berserker: 0xff4444, ranged: 0xffee88, rooter: 0x226633, splitter: 0xff6600, mortar: 0x445566, voidsniper: 0x6a3aa8, lightningelem: 0xe8ff3a,
                     singularity: 0x440088, drowner: 0x5a2d6b, ripplerunner: 0x66f0ff, tidecaller: 0x2a5cc8, waverider: 0xdff3ff, tidalguard: 0xb8912f,
                     wishingwell: 0x6b8f7a, conduit: 0xe8ff3a, encased: 0x9a8a7a, sniper: 0xffee88 };
    // What kind of trouble each enemy is (the enemy index sorts by these; one can be several)
    static ENEMY_TAGS = {
        DEFS: {
            aggressor:  { name: 'AGGRESSORS',  col: 0xff5a4a, what: 'come at you: contact, charges, lunges' },
            controller: { name: 'CONTROLLERS', col: 0xffc84a, what: 'own space from range: shots, lanes, lit tiles' },
            buffer:     { name: 'BUFFERS',     col: 0x7ae07a, what: 'make the ones round them stronger' },
            water:      { name: 'WATER',       col: 0x5ab8ff, what: 'make water, live in it, or use it' },
            multiplier: { name: 'MULTIPLIERS', col: 0xb8f06a, what: 'turn one into many' },
            tough:      { name: 'TOUGH',       col: 0xb8c4d4, what: 'take a lot, or come back' },
            trickster:  { name: 'TRICKSTERS',  col: 0xc08aff, what: 'hide, steal or ambush' },
        },
        slime: ['aggressor'], berserker: ['aggressor'], ranged: ['controller'], encased: ['controller', 'tough'], rooter: ['controller'],
        anchor: ['buffer', 'tough'], healer: ['buffer', 'tough'], splitter: ['aggressor', 'multiplier'], mortar: ['controller'],
        voidsniper: ['aggressor', 'trickster'], lightningelem: ['controller'], singularity: ['aggressor', 'controller'],
        drowner: ['aggressor', 'water', 'trickster'], ripplerunner: ['controller', 'water'], tidecaller: ['buffer', 'water'],
        waverider: ['aggressor', 'water'], bud: ['aggressor', 'multiplier'], shade: ['buffer', 'tough'], wraith: ['buffer', 'trickster'],
        diver: ['aggressor', 'controller', 'water'], leech: ['trickster'], gem: ['controller', 'tough'], ceo: ['buffer', 'controller', 'tough'],
        armored: ['aggressor', 'tough'], hunter: ['aggressor', 'trickster'], frost: ['controller', 'water', 'tough'], tidalguard: ['controller', 'water'],
        wishingwell: ['buffer', 'water'], conduit: ['controller', 'water'], cheer: ['buffer'],
    };
    static bodyKey(scene, kind) { const L = LevelManager.LOOKS[kind]; return L ? LevelManager.slimeRecolor(scene, 'slime_' + kind, L.pal, L.glint) : null; }
    // { tex, anim, tint } for a codex key, in any scene
    static look(scene, key) {
        let tex = (typeof SlimeModels !== 'undefined' && SlimeModels.key(scene, key === 'armored' ? 'armored_E' : key)) || (key === 'wraith' ? LevelManager.wraithBodyKey(scene) : LevelManager.bodyKey(scene, key));
        if (!tex && key === 'frost') tex = LevelManager.frostSlimeKey(scene, false);
        if (!tex && key.startsWith('shade')) { const F = LevelManager.prototype._shadeCfg().FORMS[key.split('_')[1] || 'void']; tex = LevelManager.slimeRecolor(scene, 'slime_shade_' + (key.split('_')[1] || 'void'), F.pal, F.glint); }
        if (!tex && key === 'leech') tex = LevelManager.slimeRecolor(scene, 'slime_leech_cosmic', LevelManager.prototype._leechCfg().PALS.cosmic);
        if (!tex && key === 'encased') tex = LevelManager.encBodyKey(scene);
        if (tex) return { tex, anim: tex + '_idle', tint: null };
        const purple = key === 'voidsniper' || key === 'singularity';
        return { tex: purple ? 'slime_purple' : 'slime_red', anim: purple ? 'purple_idle' : 'red_idle', tint: LevelManager.TINTS[key] ?? null };
    }

    // A slime drawn K times its usual size, standing on its tile: the body runs to the bottom of its frame, so
    // the origin goes to 1 - 0.5/K and the feet stay where an ordinary slime's are (the old 0.5 + 0.12 per extra
    // scale fell short, and big slimes sank into the tile below). Its health bar lifts over the taller body.
    static seat(e, k) {
        e.sprite.setOrigin(0.5, Math.max(0, 1 - 0.5 / k));
        e._hpBarYOff = Math.min(e._hpBarYOff || 0, -Math.round(Math.max(0, k - 1) * 12));
    }
    static frostSlimeKey(scene, born) {
        if (born && typeof SlimeModels !== 'undefined') { const k = SlimeModels.key(scene, 'frostborn'); if (k) return k; }   // its second life: spiked, not just recoloured
        return LevelManager.slimeRecolor(scene, born ? 'slime_frostborn' : 'slime_frost',
            born ? [[8, 26, 56], [20, 70, 150], [50, 120, 220], [110, 180, 255], [210, 240, 255]] : [[18, 50, 78], [47, 120, 176], [95, 184, 224], [159, 232, 255], [232, 251, 255]],
            [255, 255, 255]);   // frost glints
    }
    // The red slime redrawn in five shades of PAL by brightness, GLINT dotted over its lit side
    static slimeRecolor(scene, key, PAL, glint) {
        const TX = scene.textures;
        if (!TX.exists(key)) {
            const src = TX.exists('slime_red') ? TX.get('slime_red') : null, img = src?.getSourceImage();
            if (!img) return null;
            // the pixel work on a canvas of its own marked willReadFrequently (kept on the CPU): reading back a GPU canvas
            // waited on the graphics card, and with the Cistern's water textures uploading that stalled the first one for seconds
            const work = document.createElement('canvas'); work.width = img.width; work.height = img.height;
            const wctx = work.getContext('2d', { willReadFrequently: true });
            wctx.drawImage(img, 0, 0);
            const d = wctx.getImageData(0, 0, img.width, img.height), px = d.data;
            for (let i = 0; i < px.length; i += 4) {
                if (!px[i + 3]) continue;
                const L = (0.3 * px[i] + 0.59 * px[i + 1] + 0.11 * px[i + 2]) / 255, x = (i / 4) % img.width, y = Math.floor(i / 4 / img.width);
                let c = PAL[L < 0.15 ? 0 : L < 0.33 ? 1 : L < 0.5 ? 2 : L < 0.7 ? 3 : 4];
                if (glint && L > 0.33 && (x + y) % 9 === 0) c = glint;
                px[i] = c[0]; px[i + 1] = c[1]; px[i + 2] = c[2];
            }
            wctx.putImageData(d, 0, 0);
            const t = TX.createCanvas(key, img.width, img.height);
            t.getContext().drawImage(work, 0, 0);
            for (const name of src.getFrameNames()) { const f = src.get(name); t.add(name, 0, f.cutX, f.cutY, f.cutWidth, f.cutHeight); }
            t.refresh();
        }
        if (!scene.anims.exists(key + '_idle')) scene.anims.create({ key: key + '_idle', frames: [{ key, frame: 0 }, { key, frame: 18 }], frameRate: 2, repeat: -1 });
        return key;
    }
    // The Wraith's body: its pale slime with a ghost's ragged hem (the bottom scalloped away) and the lower half fading
    // to see-through, so it reads as a ghost rather than a slime of ice
    static wraithBodyKey(scene) {
        const base = LevelManager.bodyKey(scene, 'wraith'), key = 'slime_wraith_ghost', TX = scene.textures;
        if (!base) return null;
        if (!TX.exists(key)) {
            const src = TX.get(base), img = src.getSourceImage();
            const work = document.createElement('canvas'); work.width = img.width; work.height = img.height;
            const wctx = work.getContext('2d', { willReadFrequently: true });
            wctx.drawImage(img, 0, 0);
            const d = wctx.getImageData(0, 0, img.width, img.height), px = d.data, W = img.width, at = (x, y) => (y * W + x) * 4;
            for (const name of src.getFrameNames()) {
                const f = src.get(name), x0 = f.cutX, y0 = f.cutY, fw = f.cutWidth, fh = f.cutHeight;
                let top = Infinity, bot = -1;
                for (let y = 0; y < fh; y++) for (let x = 0; x < fw; x++) if (px[at(x0 + x, y0 + y) + 3]) { top = Math.min(top, y); bot = Math.max(bot, y); }
                if (bot < 0) continue;
                const h = Math.max(1, bot - top);
                for (let y = top; y <= bot; y++) for (let x = 0; x < fw; x++) {
                    const i = at(x0 + x, y0 + y);
                    if (!px[i + 3]) continue;
                    const fromBot = bot - y, w = x % 5;
                    if (fromBot === 0 && w !== 2) { px[i + 3] = 0; continue; }          // the hem: scallops, a point every few pixels
                    if (fromBot === 1 && (w === 0 || w === 4)) { px[i + 3] = 0; continue; }
                    const k = (y - top) / h;
                    if (k > 0.45) px[i + 3] = Math.round(px[i + 3] * (1 - 0.6 * (k - 0.45) / 0.55));   // fading out toward the hem
                }
            }
            wctx.putImageData(d, 0, 0);
            const t = TX.createCanvas(key, img.width, img.height);
            t.getContext().drawImage(work, 0, 0);
            for (const name of src.getFrameNames()) { const f = src.get(name); t.add(name, 0, f.cutX, f.cutY, f.cutWidth, f.cutHeight); }
            t.refresh();
        }
        if (!scene.anims.exists(key + '_idle')) scene.anims.create({ key: key + '_idle', frames: [{ key, frame: 0 }, { key, frame: 18 }], frameRate: 2, repeat: -1 });
        return key;
    }
    // The Encased Slime's body: the red slime with a broken shell of stone plates over its top half, painted into every
    // frame so the armour squashes, breathes and hops with the body (plates laid over it as a separate drawing floated
    // off it mid-hop). Chipped away in places to show the slime underneath, a dark rim where the shell ends, light on
    // the plates' top edges, a few cracks glowing.
    static encBodyKey(scene) {
        const key = 'slime_encased_armor', TX = scene.textures;
        if (!TX.exists(key)) {
            const src = TX.exists('slime_red') ? TX.get('slime_red') : null, img = src?.getSourceImage();
            if (!img) return null;
            const work = document.createElement('canvas'); work.width = img.width; work.height = img.height;
            const wctx = work.getContext('2d', { willReadFrequently: true });
            wctx.drawImage(img, 0, 0);
            const d = wctx.getImageData(0, 0, img.width, img.height), px = d.data, W = img.width;
            const at = (x, y) => (y * W + x) * 4, solid = (x, y) => px[at(x, y) + 3] > 0;
            const hash = (a, b) => (((a * 73856093) ^ (b * 19349663)) >>> 0) % 100;
            const put = (x, y, c) => { const i = at(x, y); px[i] = c >> 16 & 255; px[i + 1] = c >> 8 & 255; px[i + 2] = c & 255; };
            for (const name of src.getFrameNames()) {
                const f = src.get(name), x0 = f.cutX, y0 = f.cutY, fw = f.cutWidth, fh = f.cutHeight;
                let top = Infinity, bot = -1;
                for (let y = 0; y < fh; y++) for (let x = 0; x < fw; x++) if (solid(x0 + x, y0 + y)) { top = Math.min(top, y); bot = Math.max(bot, y); }
                if (bot < 0) continue;
                const depth = Math.max(4, Math.round((bot - top) * 0.72));
                const rock = new Set();
                for (let x = 0; x < fw; x++) {
                    let ct = -1; for (let y = 0; y < fh; y++) if (solid(x0 + x, y0 + y)) { ct = y; break; }
                    if (ct < 0) continue;
                    if (ct > 0 && hash(Math.floor(x / 3), 41) < 55) { const i = at(x0 + x, y0 + ct - 1); px[i + 3] = 255; rock.add(x + ',' + (ct - 1)); }   // stones standing proud of its outline
                    for (let y = ct; y < Math.min(fh, ct + 1 + depth + (hash(x, 7) % 3) - 1); y++) {   // the outline row stays; a ragged lower edge
                        if (!solid(x0 + x, y0 + y)) continue;
                        const cx = Math.floor((x + (Math.floor(y / 3) % 2) * 2) / 4), cy = Math.floor(y / 3);
                        if (y > ct + 1 && hash(cx + 11, cy + 5) < 20) continue;   // a chip: a plate gone, the slime showing
                        rock.add(x + ',' + y);
                    }
                }
                for (const k of rock) {
                    const [x, y] = k.split(',').map(Number), X = x0 + x, Y = y0 + y;
                    const ox = (x + (Math.floor(y / 3) % 2) * 2), cx = Math.floor(ox / 4), cy = Math.floor(y / 3), lx = ox % 4, ly = y % 3;
                    const below = !rock.has(x + ',' + (y + 1)), above = !rock.has(x + ',' + (y - 1));
                    let c = hash(cx, cy) < 50 ? 0x8c8272 : 0x6e6456;   // two stones, plate by plate
                    if (ly === 0) c = 0xc4baa6;                       // light on its top edge
                    if (lx === 3 || ly === 2) c = 0x3a3128;           // the seam between plates
                    if ((lx === 3 || ly === 2) && hash(cx + 3, cy + 9) < 14) c = 0xffb25a;   // a crack, glowing
                    if (above) c = 0x1e1812;                         // its outline
                    if (below) c = 0x2a221a;                          // the shell's broken rim
                    put(X, Y, c);
                }
            }
            wctx.putImageData(d, 0, 0);
            const t = TX.createCanvas(key, img.width, img.height);
            t.getContext().drawImage(work, 0, 0);
            for (const name of src.getFrameNames()) { const f = src.get(name); t.add(name, 0, f.cutX, f.cutY, f.cutWidth, f.cutHeight); }
            t.refresh();
        }
        if (!scene.anims.exists(key + '_idle')) scene.anims.create({ key: key + '_idle', frames: [{ key, frame: 0 }, { key, frame: 18 }], frameRate: 2, repeat: -1 });
        return key;
    }
    // The statue: a 24px block of ice, darker at its base, a highlight down one face, cracks.
    static frostBlockKey(scene) {
        const key = 'lv_frost_block';
        if (typeof ShopScene === 'undefined' || !ShopScene.icon) return key;
        return ShopScene.icon(scene, key, 24, { k: '#0b2a3a', i: '#9fe8ff', d: '#5fb8e0', w: '#ffffff', c: '#dff8ff' }, (m) => {
            m.poly([[5, 4], [19, 3], [21, 20], [3, 21]], 'i');
            m.poly([[3, 15], [21, 14], [21, 20], [3, 21]], 'd');
            m.line(7, 5, 6, 18, 'w'); m.line(8, 5, 8, 9, 'w');
            m.line(14, 6, 12, 11, 'c'); m.line(12, 11, 15, 15, 'c'); m.line(17, 8, 19, 12, 'c');
        });
    }

    // ── THE ENCASED SLIME (the Fracture) ─────────────────────────────────────
    // A slime that throws the room's rubble with its mind. Its attack, the Rubble Clap: eight lanes centred on
    // you (rows or columns), in pairs: the first two get a stone lifted at each end, CLAP_DIST tiles out, the
    // next two stay clear, and so on; after TELE the stones slam together where you stood. Step into a clear lane.
    // Killed, it encases itself in stone (STONE_HP of its health). Break the stone within STONE_MS or it's
    // reborn: REBORN_HP health, twice the damage and the pace, its attacks half again as often, and its attack is
    // the Crushing Vice: two whole walls of rubble rise VICE_DIST tiles either side of you, across VICE_W lanes, and
    // slam shut on you. Too wide to walk out of: dash into a wall as it arrives (a dash can't be hit) to get past it.
    _encCfg() {
        return {
            HP: 130, RANGE: 7, CD: 5200, TELE: 1100, SLIDE: 520, CLAP_DIST: 10, LANES: 8, CLAP_DMG: 10,
            STONE_HP: 1.6, STONE_MS: 5000,
            REBORN_HP: 4, REBORN_DMG: 2, REBORN_SPEED: 0.5, REBORN_ATK: 1.5,
            VICE_DIST: 5, VICE_W: 11, VICE_TELE: 950, VICE_SLAM: 380, VICE_DMG: 14, DAZE_MS: 1000,
        };
    }
    createEncasedSlime(x, y, ri) {
        const C = this._encCfg(), e = this.createEnemy(x, y, C.HP);
        e.tutorialRoomIndex = ri;
        e._isEncased = true; e._encStage = 'live'; e._encAt = this.time.now + 1500 + Math.random() * 1500;
        e._encDmg = 1; e._encCd = C.CD;
        // its look, so it reads as itself in a crowd: a broken shell of stone over its body (painted into its frames:
        // encBodyKey) and three pebbles circling it, held up by its mind
        const ek = LevelManager.encBodyKey(this);
        if (ek && e.sprite) { e.sprite.clearTint?.(); e.sprite.setTexture(ek, 0); e.sprite.play(ek + '_idle'); }
        else if (e.sprite?.setTint) e.sprite.setTint(0x9a8a7a);
        e._encLook = { pebbles: [0, 1, 2].map(k => this.add.image(0, 0, LevelManager.encRubbleKey(this)).setScale(0.55)), a: Math.random() * 6 };
        for (const o of e._encLook.pebbles) this._vfxSort?.(o);
        return e;
    }
    // killEnemy: its first death is the stone. True if it encased.
    _encEncase(e) {
        if (!e._isEncased || e._encStage !== 'live' || !e.sprite?.active) return false;
        const C = this._encCfg(), now = this.time.now;
        this._encAtkEnd(e);
        e._encStage = 'stone'; e._encOrig = e.maxHealth;
        e.maxHealth = e.health = Math.round(e.maxHealth * C.STONE_HP);
        e._encUntil = now + C.STONE_MS;
        e._encMoveCd = e._moveCdMult; e._moveCdMult = 999;
        e.isStunned = true; e.stunnedUntil = e._encUntil;
        this.updateEnemyHealthBar?.(e);
        e._encGfx = this.add.image(e.sprite.x, e.sprite.y + 4, LevelManager.encStoneKey(this)).setScale(1.8).setDepth((e.sprite.depth ?? 1) + 0.02).setAlpha(0);
        e._encRing = this.add.graphics().setDepth((e.sprite.depth ?? 1) - 0.02);
        this.tweens.add({ targets: e._encGfx, alpha: 1, scale: 1.9, duration: 220, ease: 'Back.easeOut' });
        this._bfxDust?.(e.sprite.x, e.sprite.y);
        Sfx.play(this, 'boom');
        this.showStatusText(e.sprite.x, e.sprite.y - 28, 'ENCASED: BREAK IT', '#d8c8a8');
        return true;
    }
    // killEnemy, once it's really dead: its stone breaks apart (if it died in it), and anything it left up goes.
    _encCleanup(e) {
        this._encAtkEnd(e);
        if (e._encLook) { e._encLook.pebbles.forEach(o => o.destroy()); e._encLook = null; }
        if (e._encGfx?.active) this._geodeStoneBreak?.(e._encGfx.x, e._encGfx.y);   // broken next to the Geode, it smashes a plate
        if (e._encGfx?.active) { const b = e._encGfx; this._bfxShatter?.(b.x, b.y, 0x9a8a7a, 14); this._bfxDust?.(b.x, b.y); this.tweens.add({ targets: b, alpha: 0, scale: 2.4, duration: 220, onComplete: () => b.destroy() }); Sfx.play(this, 'shatter'); }
        e._encRing?.destroy();
        e._encGfx = null; e._encRing = null;
    }
    // Every frame, from the level's update.
    _encUpdate(e, time) {
        const C = this._encCfg(), s = e.sprite;
        const L = e._encLook;
        if (L) {   // the pebbles circle (stilled while it's stone, gone once reborn: it has a body of fire then)
            const live = e._encStage === 'live' && s?.active && s.visible;
            L.a += 0.03;
            L.pebbles.forEach((pb, k) => { const a = L.a + k * 2.094; pb.setVisible(live).setPosition(s.x + Math.cos(a) * 15, s.y + 4 + Math.sin(a) * 6 + Math.sin(time * 0.005 + k) * 1.5).setDepth((s.depth ?? 1) + (Math.sin(a) > 0 ? 0.004 : -0.004)).setRotation(a); });
        }
        if (e._encStage === 'stone') {
            const k = 1 - Math.max(0, (e._encUntil - time) / C.STONE_MS);
            e._encGfx?.setPosition(s.x + (k > 0.7 ? (Math.random() - 0.5) * 4 * k : 0), s.y + 4);
            const g = e._encRing;
            if (g?.active) {
                g.clear().setPosition(s.x, s.y + 14);
                g.lineStyle(3, 0x1a140e, 0.7).strokeCircle(0, 0, 18);
                g.lineStyle(3, k > 0.7 ? 0xff6a2a : 0xffb25a, 0.95);
                g.beginPath(); g.arc(0, 0, 18, -Math.PI / 2, -Math.PI / 2 + k * Math.PI * 2); g.strokePath();
            }
            if (time >= e._encUntil && !e._encCine) { e._encCine = true; this._rebirthCinematic(s.x, s.y, () => { if (e.sprite?.active && e._encStage === 'stone') this._encReborn(e); }); }
            return;
        }
        if (e._encAtk) { this._encAtkTick(e, time); return; }
        if (e.isFrozen || e.isStunned || time < e._encAt) return;
        if (this._roomGated() && (e.tutorialRoomIndex ?? -1) !== this.getCurrentPlayerRoom()) return;
        if (Math.hypot(this.playerX - e.x, this.playerY - e.y) > C.RANGE) return;
        e._encAt = time + e._encCd;
        this._encCast(e, e._encStage === 'reborn' ? 'vice' : 'clap', time);
    }
    _encReborn(e) {
        const C = this._encCfg(), s = e.sprite;
        e._encStage = 'reborn';
        e.maxHealth = e.health = Math.round(e._encOrig * C.REBORN_HP);
        e._moveCdMult = C.REBORN_SPEED; e._encDmg = C.REBORN_DMG; e._encCd = Math.round(C.CD / C.REBORN_ATK); e._meleeDmg = (e._meleeDmg || 1) * C.REBORN_DMG;
        e.isStunned = false; e.stunnedUntil = 0; e._encAt = this.time.now + 900;
        this.updateEnemyHealthBar?.(e);
        e._encRing?.destroy(); e._encRing = null;
        if (e._encGfx) { const b = e._encGfx; this._bfxShatter?.(b.x, b.y, 0x9a8a7a, 14); this.tweens.add({ targets: b, alpha: 0, scale: 2.8, duration: 260, onComplete: () => b.destroy() }); e._encGfx = null; }
        if (s?.setTint) s.setTint(0xff8a3a);
        if (s) this.tweens.add({ targets: s, scaleX: s.scaleX * 1.25, scaleY: s.scaleY * 1.25, duration: 220, ease: 'Back.easeOut' });
        Sfx.play(this, 'roar'); this.cameras.main.shake(180, 0.007);
        this.showStatusText(s.x, s.y - 30, 'REBORN!', '#ff8a3a');
    }
    // An attack: lanes (along the axis, rows when 'h'), stones placed at each end of the ones that close.
    _encCast(e, kind, now) {
        const C = this._encCfg(), T = this.TILE_SIZE, h = Math.random() < 0.5, pa = h ? this.playerX : this.playerY, pb = h ? this.playerY : this.playerX;
        const vice = kind === 'vice', dist = vice ? C.VICE_DIST : C.CLAP_DIST;
        const lanes = vice ? Array.from({ length: C.VICE_W }, (_, i) => pb - (C.VICE_W >> 1) + i)
                           : Array.from({ length: C.LANES }, (_, i) => pb - C.LANES / 2 + i).filter((b, i) => i % 4 < 2);
        const tile = (a, b) => (h ? [a, b] : [b, a]), px = (a, b) => { const [x, y] = tile(a, b); return [x * T + T / 2, y * T + T / 2]; };
        const key = LevelManager.encRubbleKey(this), stones = [];
        for (const b of lanes) for (const side of [-1, 1]) {
            const [x, y] = px(pa + side * dist, b), st = this.add.image(x, y + 4, key).setScale(0).setDepth(2.6).setAngle(Math.random() * 360);
            this.tweens.add({ targets: st, scale: 1.2 + Math.random() * 0.3, y: y - 6, duration: 300, ease: 'Back.easeOut' });   // lifted off the floor
            stones.push({ st, b, side });
        }
        const lane = this.add.graphics().setDepth(0.62), mind = this.add.graphics().setDepth(2.55).setBlendMode(Phaser.BlendModes.ADD);
        e._encSaveCd = e._moveCdMult; e._moveCdMult = 999;   // it holds still to cast
        e._encAtk = { kind, t0: now, h, pa, pb, dist, lanes, stones, lane, mind, tele: vice ? C.VICE_TELE : C.TELE, run: vice ? C.VICE_SLAM : C.SLIDE, done: { '-1': false, '1': false }, hit: false, px, tile };
        Sfx.play(this, 'whoosh');
    }
    _encAtkTick(e, now) {
        const A = e._encAtk, C = this._encCfg(), T = this.TILE_SIZE, t = now - A.t0, vice = A.kind === 'vice';
        const g = A.lane, m = A.mind;
        g.clear(); m.clear();
        if (t < A.tele) {   // the warning: its lanes glow and pulse faster as it comes; its mind holds the stones
            const k = t / A.tele, pulse = 0.5 + 0.5 * Math.sin(t * (0.01 + 0.03 * k));
            for (const b of A.lanes) {
                const [x0, y0] = A.px(A.pa - A.dist, b), [x1, y1] = A.px(A.pa + A.dist, b), w = T * 2 * A.dist + T;
                g.fillStyle(vice ? 0xff4a2a : 0xffa63a, (0.08 + 0.14 * k) * (0.6 + 0.4 * pulse));
                if (A.h) g.fillRect(x0 - T / 2, y0 - T / 2, w, T); else g.fillRect(x0 - T / 2, y0 - T / 2, T, w);
            }
            for (const S of A.stones) { S.st.x += (Math.random() - 0.5) * 1.2 * k; if (Math.random() < 0.08) { m.lineStyle(1, 0xffb25a, 0.35); m.lineBetween(e.sprite.x, e.sprite.y - 6, S.st.x, S.st.y); } }
            return;
        }
        const u = Math.min(1, (t - A.tele) / A.run), ease = u * u, front = A.dist * (1 - ease);   // stones accelerate in
        for (const S of A.stones) { const [x, y] = A.px(A.pa + S.side * front, S.b); S.st.setPosition(x, y - 6 * (1 - u)); S.st.angle += 12 * S.side; }
        // the stones sweep in: if you're in a closing lane out past them, they shove you along it toward where they meet
        {
            const pa0 = A.h ? this.playerX : this.playerY, pb0 = A.h ? this.playerY : this.playerX, d = pa0 - A.pa;
            if (A.lanes.includes(pb0) && Math.abs(d) > front + 0.5 && Math.abs(d) <= A.dist && now >= (this._dashInvulnUntil || 0)) {
                const to = Math.round(A.pa + Math.sign(d) * Math.max(0, Math.floor(front))), [nx, ny] = A.tile(to, pb0);
                if (this.world?.[nx]?.[ny] === this.FLOOR && !this.getEnemyAt?.(nx, ny) && (this._iceShellUntil || 0) <= this.time.now) {   // (not through the ice ult's shell)
                    this.playerX = nx; this.playerY = ny;
                    this.player.setPosition(nx * T + T / 2, ny * T + T / 2 + (this.SLIME_Y_OFFSET || 0));
                    if (!A.shoved) { A.shoved = true; this.showStatusText(this.player.x, this.player.y - 26, 'SHOVED', '#d8c8a8'); }
                }
            }
        }
        // the hit: each side's stones reach you (a dash going through them can't be hit)
        const pa = A.h ? this.playerX : this.playerY, pb = A.h ? this.playerY : this.playerX, inLane = A.lanes.includes(pb), within = Math.abs(pa - A.pa) <= A.dist;
        for (const side of [-1, 1]) {
            if (A.done[side]) continue;
            const pos = A.pa + side * front;
            if (side < 0 ? pos >= pa - 0.4 : pos <= pa + 0.4) {
                A.done[side] = true;
                if (A.hit || !inLane || !within) continue;
                if (this.time.now < (this._dashInvulnUntil || 0)) { this.showStatusText(this.player.x, this.player.y - 26, 'THROUGH!', '#ffe08a'); continue; }
                A.hit = true;
                this.takeDamage((vice ? C.VICE_DMG : C.CLAP_DMG) * e._encDmg * (this.enemyDamageScale || 1));
                if (vice && this._ccGate(C.DAZE_MS)) { this._staggerUntil = Math.max(this._staggerUntil || 0, this.time.now + C.DAZE_MS); this.showStatusText(this.player.x, this.player.y - 26, 'CRUSHED', '#ff6a3a'); }
                this.cameras.main.shake(vice ? 200 : 110, vice ? 0.01 : 0.005);
            }
        }
        if (u >= 1) {   // the stones meet and break
            for (const b of A.lanes) { const [x, y] = A.px(A.pa, b); if (Math.random() < (vice ? 0.4 : 1)) this._bfxDust?.(x, y); }
            Sfx.play(this, 'boom'); this.cameras.main.shake(vice ? 120 : 60, 0.004);
            this._encAtkEnd(e);
        }
    }
    _encAtkEnd(e) {
        const A = e._encAtk; if (!A) return;
        e._encAtk = null;
        A.lane?.destroy(); A.mind?.destroy();
        for (const S of A.stones) { const st = S.st; if (st?.active) this.tweens.add({ targets: st, alpha: 0, scale: 0.4, duration: 180, onComplete: () => st.destroy() }); }
        if (e._encStage !== 'stone') e._moveCdMult = e._encSaveCd;
    }
    // A thrown stone: 16px, a broken lump of the floor, lit from the top left.
    static encRubbleKey(scene) {
        const key = 'lv_enc_rubble';
        if (typeof ShopScene === 'undefined' || !ShopScene.icon) return key;
        return ShopScene.icon(scene, key, 16, { k: '#1a140e', a: '#8a8078', b: '#6a625a', c: '#b8aea2', d: '#4a443e' }, (m) => {
            m.poly([[3, 6], [7, 2], [12, 3], [14, 8], [12, 13], [6, 14], [2, 11]], 'a');
            m.poly([[7, 9], [14, 8], [12, 13], [6, 14]], 'b'); m.poly([[3, 6], [7, 2], [9, 5], [5, 8]], 'c');
            m.line(8, 6, 10, 10, 'd'); m.line(10, 10, 9, 13, 'd');
        });
    }
    // The stone it encases itself in: a boulder in the slime's shape, glowing cracks.
    static encStoneKey(scene) {
        const key = 'lv_enc_stone';
        if (typeof ShopScene === 'undefined' || !ShopScene.icon) return key;
        return ShopScene.icon(scene, key, 24, { k: '#1a140e', a: '#7a7068', b: '#5a524a', c: '#a8a096', o: '#ff8a3a', y: '#ffd27a' }, (m) => {
            m.poly([[3, 20], [5, 10], [10, 5], [15, 5], [20, 10], [22, 20]], 'a');
            m.poly([[3, 20], [12, 15], [22, 20]], 'b'); m.poly([[5, 10], [10, 5], [12, 8], [7, 12]], 'c');
            m.line(12, 8, 11, 13, 'o'); m.line(11, 13, 14, 17, 'o'); m.line(16, 9, 18, 13, 'y'); m.line(7, 15, 9, 18, 'o');
        });
    }

    createWishingWell(x, y, ri) {
        const e = this.createEnemy(x, y, 90);
        e.tutorialRoomIndex = ri;
        e._waterNative = true;
        e._isWishingWell = true;
        e._moveCdMult = 999;       // a fixture, not a chaser
        e._wwRadius   = 7;
        e._wwCd       = 5000;
        e._wwLast     = 0;
        e._wwWetMs    = 2000;
        if (e.sprite.setTint) e.sprite.setTint(0x6b8f7a);
        this._cisternMark(e, m => {
            m.lineStyle(2, 0xcfe6d6, 0.9);  m.strokeCircle(0, 2, 8);      // the mouth
            m.lineStyle(1.6, 0x9fc4ae, 0.8);
            m.beginPath(); m.moveTo(-8, 2); m.lineTo(-8, -6); m.strokePath();
            m.beginPath(); m.moveTo( 8, 2); m.lineTo( 8, -6); m.strokePath();
            m.beginPath(); m.moveTo(-10, -6); m.lineTo(0, -11); m.lineTo(10, -6); m.strokePath();
            m.fillStyle(0x4aa3c4, 0.8); m.fillCircle(0, 3, 4);            // water inside
        });
        // (no ring around it: its reach shows when it soaks, as a ripple)
        return e;
    }

    // Organic puddle. Grown from a seed with a random frontier and a chance to refuse
    // each neighbour, so the edge comes out ragged instead of as a disc.
    _wwBlob(cx, cy, size) {
        // Each puddle gets a random long axis and grows preferentially along it, so they
        // come out as irregular streaks rather than a scatter of identical discs.
        const bias = Math.random() * Math.PI * 2;
        const bx = Math.cos(bias), by = Math.sin(bias);
        let placed = 0;
        const frontier = [[cx, cy]];
        const seen = new Set([cx + ',' + cy]);
        let guard = 0;
        while (placed < size && frontier.length && guard++ < size * 8) {
            const i = Math.floor(Math.random() * frontier.length);
            const [x, y] = frontier.splice(i, 1)[0];
            if (this.world?.[x]?.[y] !== this.FLOOR) continue;
            if (this._roomGated() && !this.isInCurrentRoom(x, y)) continue;
            if (this.addWater(x, y, 0)) placed++;      // 0 = permanent; false if steamed
            for (const [dx, dy] of [[1,0],[-1,0],[0,1],[0,-1]]) {
                const nx = x + dx, ny = y + dy, k = nx + ',' + ny;
                if (seen.has(k)) continue;
                seen.add(k);
                const align = Math.abs(dx * bx + dy * by);      // 0 across, 1 along
                if (Math.random() < 0.42 + 0.48 * align) frontier.push([nx, ny]);
            }
        }
        return placed;
    }

    // Throws a glob of water on a high arc. Nothing is checked along the flight path --
    // it is a lob, so pillars and walls pass underneath it. Only the landing tile has to
    // be somewhere a puddle can exist.
    _wwLob(e, tx, ty, delay) {
        const TS = this.TILE_SIZE;
        const sx = e.sprite.x, sy = e.sprite.y - 6;
        const px = tx * TS + TS / 2, py = ty * TS + TS / 2;
        const dist = Math.hypot(px - sx, py - sy);
        const FLIGHT = 620 + dist * 1.6;                 // further throws hang longer
        const ARC    = 70 + dist * 0.55;                 // ...and go higher

        this.time.delayedCall(delay, () => {
            if (this._deathScreenActive) return;

            // shadow on the ground: this is the tell for where it lands
            const shadow = this.add.ellipse(sx, sy, 10, 5, 0x000000, 0.28).setDepth(0.5);
            this.tweens.add({ targets: shadow, x: px, y: py, scaleX: 2.2, scaleY: 1.8,
                              alpha: 0.42, duration: FLIGHT, ease: 'Linear' });

            const glob = this.add.graphics().setDepth(5);
            const draw = (r) => {
                glob.clear();
                glob.fillStyle(0x2a5cc8, 0.55); glob.fillCircle(0, 0, r + 1.5);
                glob.fillStyle(0x4aa3c4, 0.95); glob.fillCircle(0, 0, r);
                glob.fillStyle(0xbdf6ff, 0.85); glob.fillCircle(-r * 0.35, -r * 0.35, r * 0.33);
            };
            draw(6);
            glob.x = sx; glob.y = sy;

            let elapsed = 0;
            const timer = this.time.addEvent({
                delay: 16, loop: true,
                callback: () => {
                    if (this._deathScreenActive) {
                        timer.remove();
                        if (glob.active) glob.destroy();
                        if (shadow.active) shadow.destroy();
                        return;
                    }
                    elapsed += 16;
                    const t = Math.min(elapsed / FLIGHT, 1);
                    glob.x = sx + (px - sx) * t;
                    glob.y = sy + (py - sy) * t - 4 * ARC * t * (1 - t);
                    // wobbles like a thrown liquid, and flattens as it falls
                    draw(6 + Math.sin(t * 14) * 1.1);
                    glob.setScale(1, 1 - 0.18 * Math.sin(Math.PI * t));
                    if (t < 1) return;

                    timer.remove();
                    if (glob.active) glob.destroy();
                    if (shadow.active) shadow.destroy();

                    // IMPACT — the puddle appears here, not before
                    this._wwBlob(tx, ty, 6 + Math.floor(Math.random() * 8));
                    Sfx.play(this, 'splash');
                    const sp = this.add.graphics().setDepth(2.3);
                    sp.x = px; sp.y = py;
                    sp.lineStyle(2.5, 0xbdf6ff, 0.85); sp.strokeCircle(0, 0, 7);
                    sp.fillStyle(0x4aa3c4, 0.45);       sp.fillCircle(0, 0, 7);
                    this.tweens.add({ targets: sp, alpha: 0, scaleX: 2.6, scaleY: 2.6,
                        duration: 340, ease: 'Quad.easeOut', onComplete: () => sp.destroy() });
                    for (let d = 0; d < 5; d++) {
                        const da = Math.random() * Math.PI * 2, dr = 10 + Math.random() * 16;
                        const dg = this.add.graphics().setDepth(2.4);
                        dg.fillStyle(0x9fe8ff, 0.9); dg.fillCircle(0, 0, 1.6 + Math.random() * 1.4);
                        dg.x = px; dg.y = py;
                        this.tweens.add({ targets: dg, x: px + Math.cos(da) * dr,
                            y: py + Math.sin(da) * dr, alpha: 0, duration: 300 + Math.random() * 160,
                            onComplete: () => dg.destroy() });
                    }
                }
            });
        });
    }

    _wwPulse(e, time) {
        const TS = this.TILE_SIZE;
        Sfx.play(this, 'lob');
        const n = 2 + Math.floor(Math.random() * 3);          // 2-4 globs
        let thrown = 0;
        for (let i = 0; i < n; i++) {
            // Seeds get retried. A seed on a pillar or outside the room used to kill the
            // whole blob silently, so a pulse could land as five tiles instead of thirty.
            let sx = null, sy = null;
            for (let tries = 0; tries < 16 && sx === null; tries++) {
                const a = Math.random() * Math.PI * 2;
                const r = 2 + Math.random() * (e._wwRadius - 2);
                const cx = Math.round(e.x + Math.cos(a) * r);
                const cy = Math.round(e.y + Math.sin(a) * r);
                if (this.world?.[cx]?.[cy] !== this.FLOOR) continue;
                if (this._roomGated() && !this.isInCurrentRoom(cx, cy)) continue;
                sx = cx; sy = cy;
            }
            if (sx === null) continue;
            // staggered, so it reads as throwing them one after another
            this._wwLob(e, sx, sy, thrown * 190);
            thrown++;
        }
        // the soak is immediate — only the water is in flight
        let soaked = 0;
        for (const o of (this.enemies || [])) {
            if (!o?.sprite?.active || o === e) continue;
            if (Math.hypot(o.x - e.x, o.y - e.y) > e._wwRadius) continue;
            o._wetUntil = time + e._wwWetMs;
            soaked++;
        }
        VisualFX.ripple(this, e.sprite.x, e.sprite.y, 10, e._wwRadius * TS, 0x9fe8ff, { depth: 2.2, duration: 600, alpha: 0.7 });
        // a heave animation, so the throw has a source
        if (e.sprite?.active) {
            this.tweens.add({ targets: e.sprite, scaleY: (e.sprite.scaleY || 1) * 0.88,
                duration: 110, yoyo: true, ease: 'Quad.easeOut' });
        }
        this.showStatusText?.(e.sprite.x, e.sprite.y - 28, soaked ? 'WELLSPRING' : 'SPILL', '#9fe8ff');
        e._wwLast = time;
    }

    // "Wet" for an enemy means standing in water OR recently soaked by a Wishing Well.
    // Every floor-dependent behaviour in the roster reads this instead of the tile, so a
    // Well turns a whole pack on at once without moving any of them.
    _enemyWet(e) {
        if (!e) return false;
        if ((e._wetUntil || 0) > (this.time?.now ?? 0)) return true;
        return this.isWaterAt(e.x, e.y);
    }

    // ── TIDAL GUARD — the sidestep ──────────────────────────────────────────
    // Pre-aims a trident: three tiles of shaft straight ahead, then three prongs
    // running to the wall with a one-tile gap either side of the middle. The gaps are
    // the whole enemy -- you do not leave the line, you step INTO it, one tile over.
    // Damage is instant on release, so the telegraph is the only warning you get.
    createTidalGuard(x, y, ri) {
        const e = this.createEnemy(x, y, 110);
        e.tutorialRoomIndex = ri;
        e._waterNative = true;
        e._isTidalGuard = true;
        e._tgPhase    = 'idle';
        e._tgCd       = 4200;
        // Phase-offset so a room full of guards rolls rather than volleying in lockstep
        // the moment you walk in.
        e._tgLastFire = -Math.random() * 4200;
        e._tgAimDry   = 1000;   // telegraph on dry stone
        e._tgAimWet   = 600;    // ...faster when it is standing in water, or soaked
        e._tgRange    = 64;     // unbounded in practice — the ROOM stops it, not this
        e._tgShaft    = 3;      // tiles before it forks
        e._tgSpread   = 2;      // tiles off-axis to each outer prong -> a 1-tile safe lane
        e._tgDmg      = 22;
        e._tgEngageR  = 64;     // if you are in the room, you are in range
        e._tgRootMs   = 1800;   // ...if it is standing in water when it lands
        e._moveCdMult = 1.6;    // ponderous between shots
        // Was 0x1d9ca8, a teal only dE 37 from the water it stands in and dE 30 from the
        // Ripplerunner. Verdigris brass reads as armour instead of more water, and sits
        // dE 98 from the floor and dE 56 from the nearest other enemy.
        if (e.sprite.setTint) e.sprite.setTint(0xb8912f);
        this._cisternMark(e, m => {
            // a little trident
            m.lineStyle(2, 0xbdf6ff, 0.95);
            m.beginPath(); m.moveTo(0, 7); m.lineTo(0, -2); m.strokePath();
            m.beginPath(); m.moveTo(-6, -8); m.lineTo(-6, -1); m.lineTo(6, -1); m.lineTo(6, -8); m.strokePath();
            m.beginPath(); m.moveTo(0, -2); m.lineTo(0, -9); m.strokePath();
        });
        return e;
    }

    // DRIPPING — every tile you walk becomes permanent water. It does not damage you;
    // it punishes moving, which is the opposite of every other threat in this level and
    // is why it is worth having.
    _dripCfg() { return { MS: 8000 }; }

    _applyDripping(time) {
        const C = this._dripCfg();
        this._drippingUntil = Math.max(this._drippingUntil || 0, (time ?? this.time.now) + C.MS);
        this._dripMs = C.MS;   // (its icon is in the row over you: _playerStatusRow)
        this.showStatusText?.(this.player.x, this.player.y - 44, 'DRIPPING', '#6fd0ee');
    }

    _updateDripping(time) {
        if (!this._drippingUntil) return;
        if (time >= this._drippingUntil) { this._drippingUntil = 0; return; }
    }

    // The tile pattern, resolved once at aim time and then frozen. Each prong is traced
    // separately so a pillar stops that prong only -- the telegraph always shows exactly
    // what will be hit, never more.
    // Free-angle trident with exact one-tile gaps.
    //
    // The trick is stepping along the DOMINANT axis one tile at a time and deriving the
    // other coordinate by rounding, so the centre line has exactly one tile per step. A
    // quarter-step raster zigzags -- two tiles in the same column at a stair -- and that
    // is what closed the gaps when the prongs were only two apart. One tile per step
    // means the lit offsets in any given column are exactly {-2, 0, +2}, so the ±1 lane
    // either side is guaranteed walkable at every angle.
    //
    // The centre line runs guard-centre to player-centre, so your tile is always on it:
    // the aim is honest without costing gap width.
    _tgTiles(e, dx, dy) {
        const horiz = Math.abs(dx) >= Math.abs(dy);
        const step  = horiz ? (Math.sign(dx) || 1) : (Math.sign(dy) || 1);
        const slope = horiz ? dy / Math.abs(dx || 1) : dx / Math.abs(dy || 1);
        const SEP   = e._tgSpread;

        // Range is the room. Walls stop a prong, but a doorway would let one spill into a
        // corridor, so the guard's own room rect bounds it too.
        const rr = (this.rooms || []).find(r =>
            e.x >= r.x && e.x < r.x + r.w && e.y >= r.y && e.y < r.y + r.h);
        const ok = (tx, ty) => {
            if (this.world?.[tx]?.[ty] !== this.FLOOR) return false;
            if (this.isInLockedRoom(tx, ty)) return false;
            if (rr && (tx < rr.x || tx >= rr.x + rr.w || ty < rr.y || ty >= rr.y + rr.h)) return false;
            return true;
        };
        // k tiles along the dominant axis, o tiles off it (the minor axis carries the fork)
        const at = (k, o) => horiz
            ? { x: e.x + step * k,                      y: Math.round(e.y + slope * k) + o }
            : { x: Math.round(e.x + slope * k) + o,     y: e.y + step * k };

        const tiles = [];
        const out = new Set();
        const push = (p) => {
            const key = p.x + ',' + p.y;
            if (out.has(key)) return true;
            if (!ok(p.x, p.y)) return false;
            out.add(key); tiles.push(p);
            return true;
        };

        let k = 1;
        for (; k <= e._tgShaft; k++) if (!push(at(k, 0))) return tiles;

        // each prong runs until IT is blocked, so a pillar clips one and not the others
        let a = true, b = true, c = true;
        for (; k <= e._tgRange; k++) {
            if (c && !push(at(k,  0)))   c = false;
            if (a && !push(at(k, -SEP))) a = false;
            if (b && !push(at(k,  SEP))) b = false;
            if (!a && !b && !c) break;
        }
        return tiles;
    }

    _tgAimAt(e, PX, PY) {
        let dx = PX - e.x, dy = PY - e.y;
        if (dx === 0 && dy === 0) dx = 1;
        return this._tgTiles(e, dx, dy);
    }

    _tgDrawAim(e) {
        const TS = this.TILE_SIZE;
        const g = this.add.graphics().setDepth(0.9);
        for (const t of e._tgAimTiles) {
            g.fillStyle(0x7fe8ff, 0.22);
            g.fillRect(t.x * TS + 1, t.y * TS + 1, TS - 2, TS - 2);
            g.lineStyle(1.2, 0xbdf6ff, 0.55);
            g.strokeRect(t.x * TS + 1.5, t.y * TS + 1.5, TS - 3, TS - 3);
        }
        this.tweens.add({ targets: g, alpha: 0.45, duration: 180, yoyo: true, repeat: -1,
                          ease: 'Sine.easeInOut' });
        e._tgGfx = g;
        (this._tgAims = this._tgAims || new Set()).add(g);
        g._owner = e;
    }

    _tgFire(e, time) {
        const TS = this.TILE_SIZE;
        Sfx.play(this, 'swing');   // the trident thrown
        // Hitscan: whatever is standing on a lit tile at this instant takes it.
        const hit = e._tgAimTiles.some(t => t.x === this.playerX && t.y === this.playerY);
        if (hit) {
            this.takeDamage(e._tgDmg * (this.enemyDamageScale || 1));
            // Grounded through the water it is standing in: pins you and leaves you
            // dripping, so the follow-up punishes the thing you want to do next.
            if (this._enemyWet(e) && this._ccGate(e._tgRootMs)) {
                this._playerRooted    = true;
                this._playerRootUntil = Math.max(this._playerRootUntil || 0, time + e._tgRootMs);
                this._applyDripping(time);
                this.showStatusText?.(this.player.x, this.player.y - 30, 'GROUNDED', '#b8912f');
            } else {
                this.showStatusText?.(this.player.x, this.player.y - 30, 'SPEARED', '#bdf6ff');
            }
        }
        const g = this.add.graphics().setDepth(2.6);
        for (const t of e._tgAimTiles) {
            g.fillStyle(0xffffff, 0.85);
            g.fillRect(t.x * TS + 2, t.y * TS + 2, TS - 4, TS - 4);
            g.fillStyle(0x7fe8ff, 0.55);
            g.fillRect(t.x * TS, t.y * TS, TS, TS);
        }
        this.tweens.add({ targets: g, alpha: 0, duration: 260, ease: 'Quad.easeOut',
                          onComplete: () => g.destroy() });
        e._tgLastFire = time;
    }

    // ── CONDUIT — the floor ─────────────────────────────────────────────────
    // Electrifies every wet tile within 4. The room's own floor becomes the
    // hazard, which is the clearest reason in the level to burn a path dry.
    createConduit(x, y, ri) {
        const e = this.createEnemy(x, y, 80);
        e.tutorialRoomIndex = ri;
        e._waterNative = true;
        e._isConduit = true;
        e._moveCdMult = 2.2;                       // an emplacement, not a chaser
        e._arcs = true;                            // throws the lightning elemental's arc (EnemyManager)
        this._tagResist(e, 'lightning');
        e._liveR = 4;
        e._zapCd = 900;
        e._lastZap = 0;
        if (e.sprite.setTint) e.sprite.setTint(0xe8ff3a);
        e._conduitGfx = this.add.graphics().setDepth(0.95);
        this._cisternMark(e, m => {
            m.lineStyle(2, 0xffff44, 0.95);
            m.beginPath(); m.moveTo(-4, -8); m.lineTo(1, -1); m.lineTo(-2, -1); m.lineTo(3, 8);
            m.strokePath();
            m.lineStyle(1.4, 0xffff88, 0.45); m.strokeCircle(0, 0, 11);
        });
        return e;
    }

    // Per-frame behaviour for the roster. Everything is gated on the enemy being in
    // the room you are standing in, so a sealed room's Tidecaller does not flood the
    // level while you are three rooms away.
    _updateCisternEnemies(time, delta) {
        if (!(this.isLevel6 || this.trainingRun || this.towerRun) || !this.enemies) return;   // (the Training Ground and the Tower spawn Cistern kinds too: they stood idle there)
        this._frostHazeMult = 1;   // set again below while you stand in a Frostborn's haze
        const room = this.getCurrentPlayerRoom();
        const PX = this.playerX, PY = this.playerY;

        // Levels 2-4 expire the root in their own room check; level 6 needs its own.
        if (this._playerRooted && time >= (this._playerRootUntil || 0)) this._playerRooted = false;
        if (this._submergedUntil && time >= this._submergedUntil) this._drownSurfacePlayer();

        // A Drowner killed mid-tell would otherwise leave its marker stuck on you.
        this._updateRippleOrbs(time, delta ?? 16);
        this._updateDripping(time);

        if (this._waveTells) {
            for (const g of [...this._waveTells]) {
                const o = g._owner;
                if (!o || !o.sprite?.active || o._waveState !== 'tell') {
                    this._waveTells.delete(g);
                    if (g.active) g.destroy();
                    if (o) o._waveTellGfx = null;
                }
            }
        }

        if (this._tgAims) {
            for (const g of [...this._tgAims]) {
                const o = g._owner;
                if (!o || !o.sprite?.active || o._tgPhase !== 'aim') {
                    this._tgAims.delete(g);
                    if (g.active) g.destroy();
                    if (o) o._tgGfx = null;
                }
            }
        }

        if (this._drownWarns) {
            for (const g of [...this._drownWarns]) {
                const o = g._owner;
                if (!o || !o.sprite?.active || o._drownPhase !== 'track') {
                    this._drownWarns.delete(g);
                    if (g.active) g.destroy();
                    if (o) o._drownWarnGfx = null;
                }
            }
        }
        if (this._drownLocks) {
            for (const g of [...this._drownLocks]) {
                const o = g._owner;
                if (!o || !o.sprite?.active || o._drownPhase !== 'lock') {
                    this._drownLocks.delete(g);
                    if (g.active) g.destroy();
                    if (o) o._drownLockGfx = null;
                }
            }
        }
        // A Drowner killed mid-attack must not stay phased out.
        for (const o of (this.enemies || [])) {
            if (o._isDrowner && o._drownSubmerged && o._drownPhase === 'idle') o._drownSubmerged = false;
        }

        for (const e of [...this.enemies]) {
            if (!e || !e.sprite || !e.sprite.active) continue;
            const mine = (e.tutorialRoomIndex ?? -1) === room;

            if (e._resistMark?.active) {
                e._resistMark.x = e.sprite.x;
                e._resistMark.y = e.sprite.y + 20;  // the ward lies at its feet
                // hidden with its enemy: a ward on empty floor would give a phased or hidden one away
                e._resistMark.setVisible(e.sprite.visible !== false && e.sprite.alpha > 0.15);
            }
            if (e._cisternMark?.active) {
                e._cisternMark.x = e.sprite.x;
                e._cisternMark.y = e.sprite.y + (e._cisternMarkDY ?? -16);
                e._cisternMark.setVisible(mine || !this._roomGated());
            }
            if (!mine) { if (e._conduitGfx?.active) e._conduitGfx.clear(); continue; }

            // ── Drowner: sink, track, lock, resolve ──
            if (e._isDrowner) {
                const dd = Math.hypot(e.x - PX, e.y - PY);
                if (e._drownPhase === 'idle' && dd <= e._drownAtkR
                    && time - (e._drownLastAtk || 0) >= e._drownCd / this._atkSpd(e, time)) {
                    e._drownPhase = 'track';
                    e._drownLastAtk = time;
                    e._drownLockAt = time + e._drownTell;
                    e._drownSubmerged = true;              // _phasedOut: cannot be hit while under
                    e._drownMark = null;                   // nothing chosen yet
                    const bs = e._baseScale ?? e.sprite.scaleX ?? 1;
                    e._drownBaseScale = bs;
                    this.tweens.add({ targets: e.sprite, alpha: 0.06,
                        scaleX: bs * 0.55, scaleY: bs * 0.55, duration: 220 });
                    if (e._cisternMark?.active) e._cisternMark.setVisible(false);
                    this._drownWarn(e);
                    this.showStatusText?.(e.sprite.x, e.sprite.y - 24, 'SINKS', '#b08fd0');
                }

                // TRACKING: the exclamation follows you and the tile is still undecided,
                // so walking during this phase buys you nothing.
                if (e._drownPhase === 'track') {
                    if (e._drownWarnGfx?.active) {
                        e._drownWarnGfx.x = this.player.x;
                        e._drownWarnGfx.y = this.player.y - 34;
                    }
                    if (time >= e._drownLockAt) {
                        e._drownMark = { x: this.playerX, y: this.playerY };
                        // Whether this is dodgeable at all is decided HERE, by what you
                        // are standing on at the moment it commits. Water is not a harder
                        // dodge, it is no dodge: it lands instantly.
                        const lockWet = this.isWaterAt(this.playerX, this.playerY);
                        if (e._drownWarnGfx) {
                            this._drownWarns?.delete(e._drownWarnGfx);
                            if (e._drownWarnGfx.active) e._drownWarnGfx.destroy();
                            e._drownWarnGfx = null;
                        }

                        if (lockWet) {
                            // ── caught in water: instant, no window ──
                            e._drownPhase = 'idle';
                            e._drownSubmerged = false;
                            const bsw = e._drownBaseScale ?? 1;
                            this.tweens.add({ targets: e.sprite, alpha: 1,
                                scaleX: bsw, scaleY: bsw, duration: 200, ease: 'Back.easeOut' });
                            if (e._cisternMark?.active) e._cisternMark.setVisible(true);

                            this.takeDamage(e._drownDmg * (this.enemyDamageScale || 1));
                            this._drownWeeds(this.player.x, this.player.y, false);
                            if (this._ccGate(e._drownStun)) {
                                this._playerRooted    = true;
                                this._playerRootUntil = time + e._drownStun;
                                this._drownSubmergePlayer(time + e._drownStun);
                                this.showStatusText?.(this.player.x, this.player.y - 30, 'DRAGGED UNDER', '#8fd8ff');
                            }
                        } else {
                            // ── caught on dry ground: you get the window ──
                            e._drownPhase = 'lock';
                            e._drownResolveAt = time + e._drownDodge;
                            this._drownLockMark(e, e._drownMark.x, e._drownMark.y);
                            this.showStatusText?.(this.player.x, this.player.y - 30, 'MARKED', '#d8b4ff');
                        }
                    }
                } else if (e._drownPhase === 'lock' && time >= e._drownResolveAt) {
                    // Only ever reached for a LAND commit, so this branch is purely the
                    // dodge check. Reach is tested here as well as at commit, or the grab
                    // would land on you from anywhere in the room once marked.
                    const reach  = Math.hypot(e.x - this.playerX, e.y - this.playerY) <= e._drownReachR;
                    const onSpot = this.playerX === e._drownMark.x && this.playerY === e._drownMark.y;
                    const hit    = reach && onSpot;

                    e._drownPhase = 'idle';
                    e._drownSubmerged = false;
                    const bs = e._drownBaseScale ?? 1;
                    this.tweens.add({ targets: e.sprite, alpha: 1,
                        scaleX: bs, scaleY: bs, duration: 200, ease: 'Back.easeOut' });
                    if (e._cisternMark?.active) e._cisternMark.setVisible(true);
                    if (e._drownLockGfx) {
                        this._drownLocks?.delete(e._drownLockGfx);
                        if (e._drownLockGfx.active) e._drownLockGfx.destroy();
                        e._drownLockGfx = null;
                    }

                    const TS = this.TILE_SIZE;
                    const mt = e._drownMark;
                    // It drags water up with it whether or not it catches you, so every
                    // strike on dry ground leaves a permanent pool -- and that tile is the
                    // undodgeable version next time anything commits there. Dodging buys
                    // you this grab, not the room.
                    if (this.world?.[mt.x]?.[mt.y] === this.FLOOR) this.addWater(mt.x, mt.y, 0);
                    if (hit) {
                        this.takeDamage(e._drownDmg * (this.enemyDamageScale || 1));
                        this._drownWeeds(this.player.x, this.player.y, true);
                        this.showStatusText?.(this.player.x, this.player.y - 30, 'GRABBED', '#b08fd0');
                    } else {
                        // The grab still HAPPENS -- it just closes on empty ground.
                        this._drownWeeds(mt.x * TS + TS / 2, mt.y * TS + TS / 2, true);
                        this.showStatusText?.(this.player.x, this.player.y - 30, 'DODGED', '#9fe8ff');
                    }
                }
            }

            // ── Ripplerunner: speed is a property of the floor ──
            if (e._isRipplerunner) {
                const wet = this._enemyWet(e);
                e._moveCdMult = wet ? 0.5 : 1.7;
                // A burst on each transition rather than a permanent stream: its speed is a
                // property of the tile, so arrows only tell you anything when the tile changes.
                if (e._rippleWasWet !== wet) {
                    e._rippleWasWet = wet;
                    this._setSpeedIndicator?.(e, 'ripple', wet ? 'speed_anchor' : 'slow_goop',
                                              true, 300, 1200);
                }
                const cd = wet ? e._rippleCdWater : e._rippleCdLand;
                if (Math.hypot(e.x - PX, e.y - PY) <= e._rippleRange
                    && time - (e._rippleLastFire || 0) >= cd / this._atkSpd(e, time)) {
                    e._rippleLastFire = time;
                    this._fireRippleVolley(e, wet);
                }
            }


            // ── Wave Rider: walk, telegraph, then charge ──
            if (e._isWaveRider) {
                if (e._waveState === 'walk') {
                    e._moveCdMult = 1.0;
                    if (Math.hypot(e.x - PX, e.y - PY) <= e._waveEngageR
                        && time - (e._waveLastEnd || 0) >= e._waveCd / this._atkSpd(e, time)) {
                        e._waveState = 'tell';
                        e._waveTellEnd = time + (this._enemyWet(e) ? e._waveTellWet : e._waveTellMs);
                        e._moveCdMult = 999;              // plants itself to wind up
                        // Direction is locked NOW, at the start of the tell -- the whole
                        // point is that you can step out of the lane while it winds up.
                        const a = Math.atan2(this.player.y - e.sprite.y, this.player.x - e.sprite.x);
                        e._waveDx = Math.cos(a); e._waveDy = Math.sin(a);
                        this._waveTell(e);
                    }
                } else if (e._waveState === 'tell') {
                    if (e._waveTellGfx?.active) {
                        e._waveTellGfx.x = e.sprite.x; e._waveTellGfx.y = e.sprite.y - 24;
                    }
                    if (time >= e._waveTellEnd) {
                        this._waveClearTell(e);
                        e._waveState = 'charge';
                        e._waveDist = 0;
                        e._waveSpeed = e._waveSpeed0;
                        e._waveLastHit = 0;
                        this.showStatusText?.(e.sprite.x, e.sprite.y - 26, 'TORRENT', '#dff3ff');
                        Sfx.play(this, 'splash', { big: true });   // the wave goes
                        // The charge IS a speedup -- it is the whole threat -- so it gets
                        // up-arrows, cleared when the charge ends below.
                        this._setSpeedIndicator?.(e, 'wave', 'speed_anchor', true, 200);
                    }
                } else if (e._waveState === 'charge') {
                    this._updateWaveCharge(e, time, delta ?? 16);
                }
            }

            // ── Wishing Well: make water, soak the pack ──
            if (e._isFrost) this._frostUpdate(e, time);
            if (e._isWishingWell) {
                if (e._wwRing?.active) { e._wwRing.x = e.sprite.x; e._wwRing.y = e.sprite.y; }
                if (time - (e._wwLast || 0) >= e._wwCd / this._atkSpd(e, time)) this._wwPulse(e, time);
            }

            // ── Tidal Guard: aim the trident, then release ──
            if (e._isTidalGuard) {
                if (e._tgPhase === 'idle') {
                    if (Math.hypot(e.x - PX, e.y - PY) <= e._tgEngageR
                        && time - (e._tgLastFire || 0) >= e._tgCd / this._atkSpd(e, time)) {
                        e._tgAimTiles = this._tgAimAt(e, PX, PY);
                        if (e._tgAimTiles.length) {
                            e._tgPhase = 'aim';
                            e._tgFireAt = time + (this._enemyWet(e) ? e._tgAimWet : e._tgAimDry);
                            e._tgHoldMult = e._moveCdMult;
                            e._moveCdMult = 999;          // plants itself while aiming
                            // Planting is a slowdown to a dead stop, so it reads as one.
                            this._setSpeedIndicator?.(e, 'tgaim', 'slow_anchor', true, 300);
                            this._tgDrawAim(e);
                            this.showStatusText?.(e.sprite.x, e.sprite.y - 26, 'TRIDENT', '#7fe8ff');
                        }
                    }
                } else if (e._tgPhase === 'aim' && time >= e._tgFireAt) {
                    this._tgFire(e, time);
                    e._tgPhase = 'idle';
                    e._moveCdMult = e._tgHoldMult ?? 1.6;
                    this._setSpeedIndicator?.(e, 'tgaim', 'slow_anchor', false);
                    if (e._tgGfx) {
                        this._tgAims?.delete(e._tgGfx);
                        if (e._tgGfx.active) e._tgGfx.destroy();
                        e._tgGfx = null;
                    }
                }
            }

            // ── Conduit: live water ──
            if (e._isConduit) {
                const g = e._conduitGfx;
                if (g?.active) {
                    g.clear();
                    const T = this.TILE_SIZE;
                    g.fillStyle(0xffff44, 0.10);
                    for (const t of this.waterTiles?.values() || []) {   // (no water yet: the Training Ground starts dry)
                        if (Math.hypot(t.tx - e.x, t.ty - e.y) > e._liveR) continue;
                        g.fillRect(t.tx * T, t.ty * T, T, T);
                    }
                }
                if (this.isWaterAt(PX, PY) && Math.hypot(e.x - PX, e.y - PY) <= e._liveR
                    && time - (e._lastZap || 0) >= e._zapCd) {
                    e._lastZap = time;
                    this.takeDamage(6 * (this.enemyDamageScale || 1));
                    this.showStatusText?.(this.player.x, this.player.y - 26, 'LIVE WATER', '#ffff44');
                }
            }
        }
    }

    // ═══════════════════════════════════════════════════════════════════════
    // FIRST-ENCOUNTER CODEX
    // The first time you ever walk into a room containing a type you have not met,
    // the game holds and a card opens naming it and saying what it does. Once per
    // type, ever -- the seen set is persisted, so it never interrupts you twice.
    // ═══════════════════════════════════════════════════════════════════════

    // After a level's spawns: anything standing on a wall (the rooms' cover, WorldGen._dressRooms) steps to the nearest open tile
    _unstick() {
        const T = this.TILE_SIZE;
        for (const e of this.enemies || []) {
            if (!e.sprite?.active || this.world[e.x]?.[e.y] === this.FLOOR) continue;
            let best = null;
            for (let r = 1; r <= 4 && !best; r++) for (let dx = -r; dx <= r && !best; dx++) for (let dy = -r; dy <= r && !best; dy++) {
                const x = e.x + dx, y = e.y + dy;
                if (this.world[x]?.[y] === this.FLOOR && !this.enemies.some(o => o !== e && o.x === x && o.y === y)) best = [x, y];
            }
            if (!best) continue;
            [e.x, e.y] = best;
            e.sprite.setPosition(e.x * T + T / 2, e.y * T + T / 2 + this.SLIME_Y_OFFSET);
            this.updateEnemyHealthBar?.(e);
        }
    }
    _enemyTypeKey(e) {
        if (!e) return null;
        if (e._isFrost)            return 'frost';
        if (e._isBud)              return e._budCopy ? 'budcopy' : 'bud';
        if (e._isHunter)           return 'hunter';
        if (e._isCheer)            return 'cheer';
        if (e._isArmored)          return 'armored';
        if (e._isShade)            return { void: 'shade', fire: 'shade_fire', ice: 'shade_ice', lightning: 'shade_lightning' }[e._form] || 'shade';
        if (e._isWraith)           return 'wraith';
        if (e._isDiver)            return 'diver';
        if (e._isLeech)            return 'leech';
        if (e._isCeo)              return 'ceo';
        if (e._isGem)              return 'gem';
        if (e._isDrowner)          return 'drowner';
        if (e._isRipplerunner)     return 'ripplerunner';
        if (e._isTidecaller)       return 'tidecaller';
        if (e._isWaveRider)        return 'waverider';
        if (e._isConduit)          return 'conduit';
        if (e._isTidalGuard)       return 'tidalguard';
        if (e._isWishingWell)      return 'wishingwell';
        if (e._isEncased)          return 'encased';
        if (e.isMortar)            return 'mortar';
        if (e.isHealerTotem)       return 'healer';
        if (e.isVoidSniper)        return 'voidsniper';
        if (e.isAnchor || e._anchorRange)      return 'anchor';
        if (e._tendrilRange)       return 'rooter';
        if (e._lightningMark)      return 'lightningelem';
        if (e.isSingularitySlime)  return 'singularity';
        if (e._splitterTier !== undefined && e._splitterTier !== null) return 'splitter';
        if (e.isRanged)            return 'ranged';
        if (e._berserkerCooldown)  return 'berserker';
        return 'slime';
    }

    _enemyCodex() {
        const C = {
            slime:        { name: 'Slime',            role: 'Chaser',    tint: 0xcc3333,
                            desc: 'Walks at you and hits you on contact. Five times slower than you are.' },
            berserker:    { name: 'Berserker',        role: 'Charger',   tint: 0xff4444,
                            desc: 'Winds up when you get close, then swings a wide arc in front of it and knocks you back. Get behind it or out of reach during the wind-up.' },
            ranged:       { name: 'Spitter',          role: 'Ranged',    tint: 0xffee88,
                            desc: 'Keeps four to ten tiles away and aims a beam at you, then fires three shots down it. The aim locks a second before it fires: step off the line.' },
            encased:      { name: 'Encased Slime',    role: 'Controller', tint: 0x9a8a7a,
                            desc: 'Throws the rubble at you in lanes: step into a clear one. Killed, it turns to stone. Break the stone in five seconds or it comes back far worse.' },
            rooter:       { name: 'Rooter',           role: 'Control',   tint: 0x226633,
                            desc: 'From up to fourteen tiles it throws a tendril that pulls you toward it. Get within two and it thumps the ground, rooting you and leaving a ring of poison round itself.' },
            anchor:       { name: 'Anchor Slime',     role: 'Support',   tint: 0x7f93b5,
                            desc: 'Slow and heavy, and it follows the fight. Pulses every three seconds: allies speed up, you slow down. Kill it first.' },
            healer:       { name: 'Healer Slime',     role: 'Support',   tint: 0x66ddaa,
                            desc: 'Slow and tough, and it keeps up with its friends. Heals everything within six tiles by a fifth of its health every second, past full up to three times over. Kill it first.' },
            splitter:     { name: 'Splitter',         role: 'Swarm',     tint: 0xcc66cc,
                            desc: 'Bursts when it dies, hurting you if you are close, and splits into two smaller, faster copies, twice over. Kill it where you have room.' },
            mortar:       { name: 'Mortar',           role: 'Artillery', tint: 0x445566,
                            desc: 'Lobs shells over walls at where you stand, from up to thirteen tiles. Inside its glow, five tiles round it, you are safe.' },
            voidsniper:   { name: 'Void Sniper',      role: 'Ambusher',  tint: 0x220044,
                            desc: 'Hides in a pocket dimension where nothing can touch it. A portal opens right next to you, then it steps out, blasts a spread of shots, and stays hittable for a few seconds.' },
            lightningelem:{ name: 'Storm Elemental',  role: 'Zoner',     tint: 0xe8ff3a,
                            desc: 'Arcs at you every few seconds while you are inside its ring and it can see you. Resists lightning.' },
            singularity:  { name: 'Singularity Slime',role: 'Bruiser',   tint: 0x440088,
                            desc: 'Slow and heavy, and leaves slowing goop behind it. Get within two tiles and it lights the square round itself, then slams it: get out before it lands or you are hit and slowed.' },
            drowner:      { name: 'Drowner',          role: 'Ambusher',  tint: 0x5a2d6b,
                            desc: 'Sinks to attack and tracks you for two seconds before it strikes. In water it lands at once and holds you under for two seconds. On dry ground you get a moment to step off the mark, but it leaves a pool either way.' },
            ripplerunner: { name: 'Ripplerunner',     role: 'Skirmisher',tint: 0x66f0ff,
                            desc: 'Fires a homing orb at you, or three at once while it stands in water. Each one slows you and bursts into standing water. Quick on water, sluggish on dry stone.' },
            tidecaller:   { name: 'Tidecaller',       role: 'Booster',   tint: 0x2a5cc8,
                            desc: 'Doesn\'t fight. Everything near it attacks faster: a little on dry floor, far faster standing in water. Dry the floor round it, or kill it first.' },
            cheer:        { name: 'Cheerleader Slime', role: 'Booster',  tint: 0xff6ad0,
                            desc: 'Fast, and never comes for you: she rushes to wherever she can cheer on the most of her friends. Then a stage pops up under her and she performs for six seconds, standing still and taking half damage: everything within five tiles is Encouraged for six seconds, moving faster and hitting three times as hard. Kill her and the cheer stops, but everything near her is Discouraged: slower, and harder to hurt for five seconds.' },
            waverider:    { name: 'Wave Rider',       role: 'Charger',   tint: 0xdff3ff,
                            desc: 'Swings like a Berserker up close. From across the room it winds up, then charges in one locked direction, flooding a five-wide lane and sweeping you along it until it hits a wall. Leave the lane while it winds up.' },
            bud:          { name: 'Budding Slime',    role: 'Grower',    tint: 0x9be05a,
                            desc: 'Every ten seconds it swells and buds off a copy with its full health; both burst a ring of poison globs, and poison pools round it. Hitting it does not stop the clock: kill it, or freeze or stun it mid-swell. No Budding Slime charges your ult. The original wears the bud; a family stops at eight.' },
            shade:        { name: 'Adaptive Shade',   role: 'Mini-boss', tint: 0xa060ff,
                            desc: 'Hex slides off it. Two seconds after fire, ice or lightning hits it, it turns into that element and barely feels it, then can\'t change again for six seconds. It takes the hits of everything near it. Swap elements.' },
            wraith:       { name: 'Wraith',           role: 'Shroud',    tint: 0xc8bce8,
                            desc: 'Untouchable until you\'re within three tiles. Now and then it shrouds an enemy near it the same way, for as long as it lives.' },
            diver:        { name: 'Torpedo Diver',    role: 'Striker',   tint: 0x4ad0ff,
                            desc: 'Lights a lane at you and zips down it, leaving water. From far off the aim is a blink; up close you can step aside. A hit makes you drip and bleed.' },
            leech:        { name: 'Leech',            role: 'Thief',     tint: 0xb070ff,
                            desc: 'A thing of the void. It picks one of your elements, and its gem spins over your head while it does. Still holding that element when its ring closes and it tears the gem out of you and runs, slipping through portals to get ahead, and you cannot switch to it. Kill it and the gem flies back to you.' },
            gem:          { name: 'The Gem',          role: 'Hazard',    tint: 0xd8e8ff,
                            desc: 'Can\'t be hurt. It breaks when everything else on the floor is dead. Now and then a gem falls on you and three safe circles of its colour open: be in one, holding that element, when it lands.' },
            ceo:          { name: 'Slime CEO',        role: 'Commander', tint: 0xffd84a,
                            desc: 'Armoured: hits do 40% to its armour until it breaks. Knights the enemies round it with armour of their own, and sends slow waves to the room\'s edges. Step into a gap or dash through.' },
            armored:      { name: 'Armored Slime',    role: 'Tank',      tint: 0x8a94a6,
                            desc: 'Plated on three sides that never turn: hits from those barely scratch it. One side is open and glows when you stand on it. Go round.' },
            hunter:       { name: 'Hunter Slime',     role: 'Stalker',   tint: 0x8c3c46,
                            desc: 'Crawls at first, and gets faster and hits harder the longer it chases you; its ears fill with blood as it does. Get close and it leaps at the ground round you and slashes it apart, wider the angrier it is (up to five tiles across), the outer tiles cutting deepest. Every attack halves its rage. Its slashes make you bleed: moving hurts for a while.' },
            frost:        { name: 'Frost Slime',      role: 'Zoner',     tint: 0x9fe8ff,
                            desc: 'Stops and lights the tiles round itself, then they all freeze at once. You can\'t dash out while it\'s lit, so step onto an unlit tile. Killed, it seals itself in ice: break the block before the ring closes, or it hatches a faster, harder Frostborn whose haze slows you.' },
            tidalguard:   { name: 'Tidal Guard',      role: 'Zoner',     tint: 0xb8912f,
                            desc: 'Lights a trident at you across the room: a short shaft, then three beams with one safe tile either side of the middle. Don\'t run from the line, step one tile into a lane. It aims faster when it stands in water, and then a hit pins you and leaves you dripping.' },
            wishingwell:  { name: 'Wishing Well',     role: 'Source',    tint: 0x6b8f7a,
                            desc: 'Never moves, never attacks. Every few seconds it throws a few lasting puddles nearby and soaks every ally within seven tiles, so for two seconds they act as though they were in water. Break it first.' },
            conduit:      { name: 'Conduit',          role: 'Emplacement',tint: 0xe8ff3a,
                            desc: 'Arcs lightning at you within five tiles, and electrifies every wet tile within four, so standing in live water hurts on a timer. Resists lightning. Burn a dry path or kill it.' },
        };
        // each card in its body's own colour (SlimeModels / LOOKS), not the old tint it wore over the red slime
        const pal = k => (typeof SlimeModels !== 'undefined' && SlimeModels.DEFS[k]?.pal) || LevelManager.LOOKS[k]?.pal;
        for (const k of Object.keys(C)) { const p = pal(k); if (p) C[k].tint = (p[3][0] << 16) | (p[3][1] << 8) | p[3][2]; }
        if (C.gem) C.gem.tint = 0xff6ad8;   // every colour: its pink
        return C;
    }

    _seenEnemies() {
        if (this._seenSet) return this._seenSet;
        let arr = [];
        try { arr = JSON.parse(localStorage.getItem('seenEnemies') || '[]') || []; } catch (_) { arr = []; }
        this._seenSet = new Set(arr);
        return this._seenSet;
    }

    _markEnemySeen(key) {
        const set = this._seenEnemies();
        set.add(key);
        try { localStorage.setItem('seenEnemies', JSON.stringify([...set])); } catch (_) {}
    }

    // Called on room change. Queues anything new in the room you just walked into.
    _firstEncounterCheck() {
        if (this._bannerActive) return;
        const room = this.getCurrentPlayerRoom();
        if (room < 0) return;
        if (this._lastEncounterRoom === room && !this._encounterQueue?.length) return;
        if (this._lastEncounterRoom !== room) {
            this._lastEncounterRoom = room;
            const seen = this._seenEnemies();
            const codex = this._enemyCodex();
            const fresh = [];
            for (const e of (this.enemies || [])) {
                if (!e?.sprite?.active) continue;
                if (this._roomGated() && (e.tutorialRoomIndex ?? -1) !== room) continue;
                const k = this._enemyTypeKey(e);
                if (!k || seen.has(k) || fresh.includes(k) || !codex[k]) continue;
                fresh.push(k);
            }
            if (fresh.length) this._encounterQueue = (this._encounterQueue || []).concat(fresh);
        }
        if (this._encounterQueue?.length) this._showEnemyBanner(this._encounterQueue.shift());
    }

    _showEnemyBanner(key) {
        const entry = this._enemyCodex()[key];
        if (!entry) return;
        if (this._bannerActive) { (this._encounterQueue ||= []).unshift(key); return; }   // one card at a time: this one waits its turn
        this._markEnemySeen(key);
        this._bannerActive = true;

        const W = this.scale.width, H = this.scale.height, CX = W / 2, CY = H / 2;
        const D = 40;
        const objs = [];
        const dim = this.add.rectangle(CX, CY, W, H, 0x04070d, 0).setScrollFactor(0).setDepth(D);
        objs.push(dim);
        this.tweens.add({ targets: dim, alpha: 0.72, duration: 200 });

        const PW = Math.min(560, W - 80), PH = 210;
        const panel = this.add.container(CX, CY).setScrollFactor(0).setDepth(D + 1);
        objs.push(panel);

        const bg = this.add.graphics();
        bg.fillStyle(0x0b1220, 0.97); bg.fillRoundedRect(-PW/2, -PH/2, PW, PH, 14);
        bg.lineStyle(2, entry.tint, 0.9); bg.strokeRoundedRect(-PW/2, -PH/2, PW, PH, 14);
        bg.fillStyle(entry.tint, 0.10); bg.fillRoundedRect(-PW/2, -PH/2, PW, 44, { tl: 14, tr: 14, bl: 0, br: 0 });
        panel.add(bg);

        const portrait = this.add.graphics();
        portrait.x = -PW/2 + 62; portrait.y = 16;
        portrait.fillStyle(0x000000, 0.35); portrait.fillCircle(0, 0, 36);
        portrait.fillStyle(entry.tint, 0.9);  portrait.fillCircle(0, 0, 27);
        portrait.fillStyle(0xffffff, 0.22);   portrait.fillCircle(-9, -10, 8);
        portrait.lineStyle(2, 0xffffff, 0.30); portrait.strokeCircle(0, 0, 36);
        panel.add(portrait);
        this._cfxPortrait?.(panel, portrait, key, entry);   // Creatures.js: the slime, its hat, its glare
        this.tweens.add({ targets: portrait, scaleX: 1.06, scaleY: 1.06,
            duration: 900, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });

        const head = this.add.text(-PW/2 + 20, -PH/2 + 13, 'NEW ENEMY', {
            fontFamily: 'monospace', fontSize: '13px', color: '#9fb4d0' }).setOrigin(0, 0);
        const nameT = this.add.text(-PW/2 + 112, -PH/2 + 56, entry.name, {
            fontFamily: 'monospace', fontSize: '26px', color: '#ffffff', fontStyle: 'bold' }).setOrigin(0, 0);
        const roleT = this.add.text(-PW/2 + 112, -PH/2 + 88, entry.role.toUpperCase(), {
            fontFamily: 'monospace', fontSize: '12px',
            color: '#' + entry.tint.toString(16).padStart(6, '0') }).setOrigin(0, 0);
        const descT = this.add.text(-PW/2 + 112, -PH/2 + 112, entry.desc, {
            fontFamily: 'monospace', fontSize: '13px', color: '#cddcf0',
            wordWrap: { width: PW - 140 }, lineSpacing: 4 }).setOrigin(0, 0);
        const hint = this.add.text(0, PH/2 - 22, 'press any key', {
            fontFamily: 'monospace', fontSize: '11px', color: '#6d8099' }).setOrigin(0.5, 0);
        panel.add([head, nameT, roleT, descT, hint]);
        // A long description ran out of the card and under the hint: the card grows to fit it.
        const _over = descT.y + descT.height - (PH / 2 - 32);
        if (_over > 0) {
            const PH2 = PH + _over, top = -PH / 2;
            bg.clear();
            bg.fillStyle(0x0b1220, 0.97); bg.fillRoundedRect(-PW/2, top, PW, PH2, 14);
            bg.lineStyle(2, entry.tint, 0.9); bg.strokeRoundedRect(-PW/2, top, PW, PH2, 14);
            bg.fillStyle(entry.tint, 0.10); bg.fillRoundedRect(-PW/2, top, PW, 44, { tl: 14, tr: 14, bl: 0, br: 0 });
            hint.y = top + PH2 - 22;
            panel.y -= _over / 2;
        }
        this.tweens.add({ targets: hint, alpha: 0.35, duration: 700, yoyo: true, repeat: -1 });

        // Expand open: a thin line that grows into the card.
        panel.setScale(1, 0.04);
        this.tweens.add({ targets: panel, scaleY: 1, duration: 260, ease: 'Back.easeOut' });

        // each card closes only itself, and takes both its listeners with it (a key left the click listener behind,
        // and that stale listener later "closed" the next card: the game ran on and the new card stayed up for good)
        const token = this._bannerToken = (this._bannerToken || 0) + 1;
        const close = () => {
            this.input.keyboard?.off('keydown', close); this.input.off('pointerdown', close);
            if (!this._bannerActive || this._bannerToken !== token || this._bannerClosing === token) return;
            this._bannerClosing = token;   // still open (the game stays held) until it has finished closing
            this.tweens.add({
                targets: panel, scaleY: 0.04, alpha: 0, duration: 170, ease: 'Quad.easeIn',
                onComplete: () => {
                    for (const o of objs) { if (o?.destroy) o.destroy(); }
                    if (this._bannerToken === token) this._bannerActive = false;
                    // Another new type in the same room? Show it next.
                    if (this._encounterQueue?.length) {
                        this.time.delayedCall(120, () => this._showEnemyBanner(this._encounterQueue.shift()));
                    }
                }
            });
            this.tweens.add({ targets: dim, alpha: 0, duration: 170 });
        };
        this.time.delayedCall(260, () => {
            if (!this._bannerActive || this._bannerToken !== token) return;
            this.input.keyboard?.on('keydown', close);
            this.input.on('pointerdown', close);
        });
    }

    // Per-frame room-clear check for The Cistern. Mirrors _level3RoomClear's shape: a room
    // counts as cleared once it HAS held enemies and no longer does, so an empty corridor
    // room never counts and a room you have not reached cannot unlock early.
    _cisternRoomCheck() {
        if (!this.isLevel6) return;
        const ri = this.getCurrentPlayerRoom();
        if (ri < 0) return;
        if (!this.tutorialRoomCleared) this.tutorialRoomCleared = {};
        if (!this._roomHadEnemies) this._roomHadEnemies = {};
        if (!this.tutorialDoorsLocked) this.tutorialDoorsLocked = [];

        // Entry: the barrier goes up behind you as you walk in, not at spawn.
        if (ri !== this.currentTutorialRoom) {
            this.currentTutorialRoom = ri;
            if (this.tutorialDoorsLocked[ri]) this.lockTutorialDoors(ri);
        }

        // a reward chest opens when you walk onto it (as in the Void Rift)
        for (const chest of this.tutorialChests || []) {
            if (!chest.opened && this.playerX === chest.tileX && this.playerY === chest.tileY) this.openTutorialChest(chest.roomIndex, chest.container, null);
        }

        if (this.tutorialRoomCleared[ri]) return;

        const live = (this.enemies || []).filter(e => e.tutorialRoomIndex === ri);
        const queenHere = (this.portals || []).some(p => p.active && p.tutorialRoomIndex === ri);
        if (live.length > 0 || queenHere) { this._roomHadEnemies[ri] = true; return; }
        if (!this._roomHadEnemies[ri]) return;

        this.tutorialRoomCleared[ri] = true;
        this.tutorialDoorsLocked[ri] = false;
        this.unlockTutorialDoors(ri);
        const r = this.rooms[ri];
        if (r) {
            const cx = (r.x + r.w / 2) * this.TILE_SIZE;
            const cy = (r.y + r.h / 2) * this.TILE_SIZE;
            this.showStatusText(cx, cy - 40, 'ROOM CLEAR', '#9fe4ff');
        }
        // The last room: every enemy and every portal gone. The Cistern had no ending -- its
        // rooms cleared one by one and then nothing happened -- so it ends the way the others
        // do: LEVEL COMPLETE, then back to the map with the Tower open (Progress.js).
        const anyLeft = (this.enemies || []).some(e => e.sprite?.active) || (this.portals || []).some(p => p.active);
        if (anyLeft) this.spawnTutorialChest(ri);   // a reward for the room (the last one ends the level instead)
        if (!anyLeft && !this._cisternDone) {
            this._cisternDone = true;
            // no single boss down here: its share comes with the clear (Progress.js)
            const _clr = Progress.rewardClear('cistern', this), _boss = Progress.rewardBoss('cistern');
            this._firstClear = _clr.first;
            Progress.announce(this, _clr.frags + _boss.frags);
            this.time.delayedCall(900, () => this._showElementUnlockCinematic(null, false));
        }
    }

    spawnLevel4Enemies() {
        // Positions as the fixed map placed them (WorldGen._fractureFixed), each moved with its room (the map is laid out fresh: LevelLayouts).
        // O is where each story room stood on the fixed map. R0, the spawn, is safe.
        const O = [[43, 28], [22, 22], [4, 22], [63, 23], [92, 23], [37, 44], [31, 64]];
        const at = (ri, x, y) => [this.rooms[ri].x + x - O[ri][0], this.rooms[ri].y + y - O[ri][1]];
        const fb = (ri, x, y) => { const [ax, ay] = at(ri, x, y); return { x: ax, y: ay }; };

        // Mark crumble tile clusters — scattered in R2 (Sinkhole) and R5 (Trap Gauntlet)
        // These are pre-designated tiles that crumble on first step
        this._crumbleZones = new Set([
            // R2: Sinkhole — 8 tiles
            ...[[6, 24], [7, 25], [8, 24], [9, 26], [6, 30], [8, 31], [13, 25], [13, 30]].map(([x, y]) => at(2, x, y)),
            // R5: Trap Gauntlet — 12 tiles spread across corridors
            ...[[40, 47], [42, 48], [44, 50], [46, 52], [48, 54], [50, 53], [53, 47], [55, 48], [57, 50], [59, 52], [61, 54], [58, 53]].map(([x, y]) => at(5, x, y)),
            // R1 and R4: a few scattered tiles
            at(1, 24, 26), at(1, 30, 27), at(4, 96, 26), at(4, 106, 27),
        ].map(([x, y]) => x + ',' + y));

        // R1: Entry Crater — two knots instead of one enemy per corner. A rooter inside a pack
        // is a real problem (rooted next to three slimes); a rooter alone in a corner is a
        // formality you walk up to and kill.
        this.spawnCluster(...at(1, 25, 27), [
            (x, y) => this.createRooter(x, y, 1),
            (x, y) => this.createEnemy(x, y, 50),
            (x, y) => this.createEnemy(x, y, 50),
        ], { roomIndex: 1 });
        this.spawnCluster(...at(1, 32, 30), [
            (x, y) => this.createRooter(x, y, 1),
            (x, y) => this.createEnemy(x, y, 50),
            (x, y) => this.createEnemy(x, y, 50),
        ], { roomIndex: 1 });
        // The Anchor Slime's whole contribution is a speed aura, so it belongs at the centre of
        // whichever knot ended up densest, not parked between them buffing nothing.
        this._placeSupportInCluster(1, (x, y) => this.createAnchorSlime(x, y, 1),
                                    { fallback: fb(1, 27, 29) });

        // R2: Sinkhole — two knots of slow elementals. Bunched, their slowness becomes a wall
        // you have to go around rather than four separate speed bumps.
        this.spawnCluster(...at(2, 7, 25), [
            (x, y) => this.createEnemy(x, y, 60),
            (x, y) => this.createEncasedSlime(x, y, 2),
        ], { roomIndex: 2 });
        this.spawnCluster(...at(2, 14, 31), [
            (x, y) => this.createEnemy(x, y, 60),
            (x, y) => this.createEnemy(x, y, 60),
        ], { roomIndex: 2 });
        this.createMortar(...at(2, 12, 26), 2); // behind internal wall — mortars want the far side
        // Fire-resistant healer: at 16 HP/s it out-heals chip damage, so making fire the wrong
        // answer pushes the player toward ice burst. The resistance is teaching a tactic here,
        // not just adding effective HP.
        this._tagResist(
            this._placeSupportInCluster(2, (x, y) => this.createHealerTotem(x, y, 2),
                                        { fallback: fb(2, 8, 29) }),
            'fire');

        // R3: Chain Gang — the tethered pairs stay paired, but each pair gets bodies around it so
        // the tether crosses something worth crossing.
        this.spawnCluster(...at(3, 66, 26), [
            (x, y) => this.createRooter(x, y, 3),
            (x, y) => this.createRooter(x, y, 3),
            (x, y) => this.createEnemy(x, y, 60),
        ], { roomIndex: 3 });
        this.spawnCluster(...at(3, 81, 32), [
            (x, y) => this.createRooter(x, y, 3),
            (x, y) => this.createRooter(x, y, 3),
            (x, y) => this.createEncasedSlime(x, y, 3),
        ], { roomIndex: 3 });
        // The Upgraded Sniper has no identity of its own -- it is a Void Sniper with +15 HP.
        // A trait on one of the pair is the cheapest way to give it one, and leaving its twin
        // untagged makes the difference legible side by side.
        this._tagResist(this.createUpgradedSniper(...at(3, 72, 28), 3), 'ice'); this.createUpgradedSniper(...at(3, 72, 32), 3);
        this._placeSupportInCluster(3, (x, y) => this.createAnchorSlime(x, y, 3),
                                    { fallback: fb(3, 74, 30) });

        // R4: Splitter Farm — three splitters together, so their children interleave into one
        // mass. Spread out they were three tidy independent problems.
        const _r4 = this.spawnCluster(...at(4, 101, 29), [
            (x, y) => this.createSplitter(x, y, 4, 0),
            (x, y) => this.createSplitter(x, y, 4, 0),
            (x, y) => this.createSplitter(x, y, 4, 0),
        ], { roomIndex: 4, spread: 3 });
        if (_r4[2]) this._tagResist(_r4[2], 'lightning');
        this.createMortar(...at(4, 113, 31), 4); // far corner mortar

        // R5: Trap Gauntlet — three knots of 4, spread across the room rather than eight
        // enemies at eight coordinates. Both supports then go wherever it actually got thickest.
        this.spawnCluster(...at(5, 41, 48), [
            (x, y) => this.createRooter(x, y, 5),
            (x, y) => this.createRooter(x, y, 5),
            (x, y) => this.createEnemy(x, y, 50),
            (x, y) => this.createEnemy(x, y, 50),
        ], { roomIndex: 5, spread: 3 });
        this.spawnCluster(...at(5, 58, 53), [
            (x, y) => this.createRooter(x, y, 5),
            (x, y) => this.createRooter(x, y, 5),
            (x, y) => this.createEncasedSlime(x, y, 5),
            (x, y) => this.createEnemy(x, y, 50),
        ], { roomIndex: 5, spread: 3 });
        this._tagResist(
            this._placeSupportInCluster(5, (x, y) => this.createAnchorSlime(x, y, 5),
                                        { fallback: fb(5, 50, 51) }),
            'fire');
        // Second-densest: pass a radius that ignores the knot the anchor just joined, so the two
        // supports do not end up on top of each other covering one pack twice.
        this._placeSupportInCluster(5, (x, y) => this.createHealerTotem(x, y, 5),
                                    { fallback: fb(5, 45, 47), radius: 2 });

        // R6: Boss Arena — Fracture Core + guards
        // its guards: two plain, two Encased (the stone-throwers belong to the Fracture)
        for (const [x, y] of [[34, 67], [64, 84]]) { const e = this.createEnemy(...at(6, x, y), 80); e.tutorialRoomIndex = 6; }
        for (const [x, y] of [[64, 67], [34, 84]]) this.createEncasedSlime(...at(6, x, y), 6);
        // FIRST MULTI-RESISTANCE in the game: one enemy, final room of level 4. Two of four
        // elements refused, so there is always an answer -- multi-resistance should make you
        // switch, never leave you stuck.
        this._tagResist(this.createRooter(...at(6, 40, 75), 6), ['fire', 'ice']); this.createRooter(...at(6, 58, 75), 6);
        this._tagResist(this.createMortar(...at(6, 48, 66), 6), 'lightning'); // mortar at entrance
        this.spawnFractureCoreStub();

        this._spawnLevel4ChestRooms();
    }

    _spawnLevel4ChestRooms() {
        // Chest off R2 — rooms[7]
        if (this.rooms[7]) {
            const c1 = this.rooms[7];
            const cx = Math.floor(c1.x + c1.w/2), cy = Math.floor(c1.y + c1.h/2);
            this.spawnTutorialChest(7);
        }
        // Chest off R4 — rooms[8]
        if (this.rooms[8]) {
            this.spawnTutorialChest(8);
        }
    }

    spawnFractureCoreStub() {
        // Fracture Core — spawned when player enters R6
        // Actual spawn happens in updateLevel4 on room entry
        this._fractureCoreReady = true;
    }

    // The Fracture's enemies' own business each frame: the Encased slime's attacks and its rebirth from stone, and the marks
    // over rooters, splitters and healers. The Training Ground runs it too (Training.update): there they stood idle, never
    // attacking, never reborn.
    _fractureEnemies(time) {
        for (const enemy of this.enemies) {
            if (!enemy.sprite?.active) continue;
            if (enemy._isEncased) this._encUpdate(enemy, time);
            const mx = enemy.sprite.x, my = enemy.sprite.y;
            if (enemy._rooterMark?.active)  enemy._rooterMark.setPosition(mx, my - 16);
            if (enemy._splitterMark?.active) enemy._splitterMark.setPosition(mx, my - 20);
            if (enemy._healerCross?.active)  enemy._healerCross.setPosition(mx, my - 22);
        }
    }

    updateLevel4(time, delta) {
        const playerRoom = this.getCurrentPlayerRoom();
        if (playerRoom === -1) return;

        this._fractureEnemies(time);

        // Anchor slow expiry
        if (this._anchorSlowUntil && time > this._anchorSlowUntil) {
            this._anchorSlowUntil = 0;
            if (this.moveCooldown > 200) this.moveCooldown = 200;
            if (this._playerSlowIndTimer) { this._playerSlowIndTimer.remove(); this._playerSlowIndTimer = null; }
        }

        if (playerRoom !== this.currentTutorialRoom) {
            this.currentTutorialRoom = playerRoom;
            if (this.tutorialDoorsLocked[playerRoom]) this.lockTutorialDoors(playerRoom);
            if (playerRoom === 0) {
                this.tutorialRoomCleared[0] = true;
                this.tutorialDoorsLocked[0] = false;
                this.unlockTutorialDoors(0);
            }
            // Boss room — spawn Fracture Core on entry
            if (playerRoom === 6 && this._fractureCoreReady && !this.fractureCoreActive) {
                this.fractureCoreActive = true;
                this.time.delayedCall(1500, () => this._spawnFractureCore());
            }
        }

        if (!this._roomHadEnemies) this._roomHadEnemies = {};
        if (!this.tutorialRoomCleared[playerRoom]) {
            const roomEnemies = this.enemies.filter(e => e.tutorialRoomIndex === playerRoom);
            if (roomEnemies.length > 0) this._roomHadEnemies[playerRoom] = true;
            if (roomEnemies.length === 0 && this._roomHadEnemies[playerRoom]) {
                if (playerRoom === 6) {
                    if (!this.fractureCore?.active) this._level4RoomClear(playerRoom);
                } else {
                    this._level4RoomClear(playerRoom);
                }
            }
        }

        // Chest pickup
        if (this.tutorialChests) {
            for (const chest of this.tutorialChests) {
                if (chest.opened) continue;
                if (this.playerX !== chest.tileX || this.playerY !== chest.tileY) continue;
                if (chest.isFinalChest) {
                    if (!this.fractureCore?.active) this.openFinalLevelChest(chest);
                } else {
                    this.openTutorialChest(chest.roomIndex, chest.container, null);
                }
            }
        }

        if (this.fractureCore?.active) this._updateFractureCore(time, delta);

        if (this._playerRooted && time >= this._playerRootUntil) {
            this._playerRooted = false;
            if (this.player?.active) this.player.clearTint();
        }
    }

    _level4RoomClear(roomIndex) {
        this.tutorialRoomCleared[roomIndex] = true;
        this.unlockTutorialDoors(roomIndex);
        if (roomIndex === 6) {
            this.time.delayedCall(800, () => {
                const chest = (this.tutorialChests||[]).find(c => c.isFinalChest && !c.opened);
                if (chest) this.openFinalLevelChest(chest);
            });
            return;
        }
        this.spawnTutorialChest(roomIndex);
    }

    // ══════════════════════════════════════════════════════════════════════
    // FRACTURE CORE BOSS
    // ══════════════════════════════════════════════════════════════════════
    // The floor is breaking. FISSURES open in it and grow through four stages (hairline, open, erupting, splitting);
    // shoot one to knock it back a stage, and knock a hairline crack back far enough to seal it for good. Left alone a
    // fissure spits embers at you (stage 3, only the hottest few you can see), breeds slimes (3), and at 4 shakes, warns, and SPLITS into two new cracks.
    // The more fissures are open, the faster all of it goes (the tempo, up to 2x). The core hides under the worst crack.
    // Now and then (or when the floor is about to give out) it RISES, and a rhythm plays across the fissures: notes to
    // click as their rings close (taps, doubles, triples, slides to drag along). Your accuracy decides what you get: all
    // perfect, an instant blow and the longest window; 60%+, a window to hit it that scales with accuracy; 40-60%, it
    // ducks back; under 40%, it ducks and you're hurt; three misses, you're hurt badly, a crack opens and it dives at
    // once. Every quarter of its health it loses, the floor cracks open again.
    _fcCfg() {
        return {
            HP: 2600,
            START_N: 3, STAGE_MS: 6000, CAP: 10, TEMPO_PER: 0.06, TEMPO_MAX: 1.7, OFF_GROW: 0.4,   // OFF_GROW: a crack off screen grows at this rate (and doesn't shoot)
              // fissure growth a stage, the count cap, tempo
            HIT_COOL: 0.22, HIT_CD: 100,                                      // a hit knocks this much heat off (a stage is 1), at most this often
            SPLIT_WARN: 1500, SPLIT_N: 2, SPLIT_BACK: 3,                       // stage 4: the warning, how many it splits into, where it falls back to
            EMBER_MS: [0, 0, 0, 2600, 1800], EMBER_DMG: 5, EMBER_SPEED: 140, EMBER_SHOOTERS: 3,   // (was every stage-2 crack at 3.2/1.8/1.2s for 6: a bullet storm)
            BREED_MS: 5000, MAX_ADDS: [3, 4, 5, 6],
            SURFACE_EVERY: 13000, FIRST_SURFACE: 9000, RISE_MS: 650, DIVE_MS: 450,
            // the rhythm: beats a minute and notes, by phase (a quarter of its health each); windows in ms either side
            BPM: [100, 112, 124, 136], NOTES: [8, 10, 12, 14], APPROACH: 1000, LEAD_IN: 1200, HIT_R: 30, FOLLOW_R: 40,
            W: { PERFECT: 80, GOOD: 160, OK: 240 }, SCORE: { PERFECT: 300, GOOD: 100, OK: 50, MISS: 0 },
            VULN_MS: 7000, PERFECT_BONUS: 2500, PERFECT_DMG: 0.12, STAY_AT: 0.6, SAFE_AT: 0.4,
            DUCK_DMG: 5, MISS3_DMG: 12, MISS_MAX: 3,   // (10 and 24 until 2026-10-19: with the level's damage scale one lost beat took a third of a fresh player's health)
            BURST_N: 3,                                                       // new cracks at every quarter of its health
        };
    }

    // The Geode (see THE GEODE below): it rises in the middle of the room in its shell
    _spawnFractureCore(room = this.rooms[6], tower = false) {   // (the Tower raises one in its arena: no chest there)
        const C = this._geodeCfg(), TS = this.TILE_SIZE;
        const cx = Math.floor(room.x + room.w / 2), cy = Math.floor(room.y + room.h / 2), now = this.time.now;
        const container = this.add.container(cx * TS + TS / 2, cy * TS + TS / 2).setDepth(3).setScale(0.2).setAlpha(0.3);
        const glow = this.textures.exists('vfx_glow') ? this.make.image({ x: 0, y: 0, key: 'vfx_glow' }, false).setBlendMode(Phaser.BlendModes.ADD).setTint(0xffa63a).setAlpha(0.55).setScale(1.1) : null;
        const body = this.add.graphics();
        this._bfxCoreDraw(body);
        if (glow) container.add(glow);
        container.add(body);
        this.fractureCore = {
            active: true, geode: true, container, body, glow, ringG: this.add.graphics().setDepth(4.8),
            plateG: this.add.graphics().setDepth(3.05), fxG: this.add.graphics().setDepth(0.97),
            health: C.HP, maxHealth: C.HP, tileX: cx, tileY: cy, phase: 0, plates: [], faults: [], rifts: new Set(), riftLines: [],
            state: 'rise', stateAt: now, _surfaced: true, _isInvulnerable: true,
            nextFault: now + 3500, nextAdd: now + 6000, nextHop: now + C.HOP_MS,
        };
        this._debrisBossRoom = room;
        this._debrisTiles = []; this._debrisWarnings = []; this._fissures = [];   // (other code still asks after these)
        this._fractureWeakPoints = []; this._wpSequenceIdx = 0;
        if (!tower) this.spawnFinalLevelChest(cx, room.y + 3, null);
        this.tweens.add({ targets: container, scale: 1, alpha: 1, duration: C.RISE_MS * 1.5, ease: 'Back.easeOut', onComplete: () => this._geodeArm() });
        BossFX.blast(this, container.x, container.y, 60, 'shell'); Sfx.play(this, 'roar', { big: true });
        this._showRhythmSessionBanner('THE GEODE', '#ffb25a', 'Break its shell: heat a plate with fire, then shatter it with ice.');
        this.cameras.main.shake(260, 0.006);
    }

    // ── FISSURES ─────────────────────────────────────────────────────────────
    // A free floor tile for a new crack: in the arena, clear of the chest, other cracks, and (unless near is given) you.
    _fcFree(tx, ty) {
        const R = this._debrisBossRoom;
        if (!R || tx < R.x + 2 || ty < R.y + 2 || tx > R.x + R.w - 3 || ty > R.y + R.h - 3) return false;
        if (this.world[tx]?.[ty] !== this.FLOOR) return false;
        if ((this.tutorialChests || []).some(c => Math.abs(c.tileX - tx) <= 1 && Math.abs(c.tileY - ty) <= 1)) return false;
        return !(this._fissures || []).some(f => Math.abs(f.tx - tx) <= 1 && Math.abs(f.ty - ty) <= 1);
    }
    // Opens a crack: near `from` (a fissure splitting) or anywhere in the arena, never right by you. heat: where it starts.
    _fcOpenFissure(from, heat = 0.6) {
        const C = this._fcCfg(), R = this._debrisBossRoom, TS = this.TILE_SIZE;
        if (!R || this._fissures.length >= C.CAP) return null;
        let tx, ty, ok = false;
        for (let n = 0; n < 70 && !ok; n++) {
            if (from) { const a = Math.random() * Math.PI * 2, d = 2 + Math.random() * 2.5; tx = Math.round(from.tx + Math.cos(a) * d); ty = Math.round(from.ty + Math.sin(a) * d); }
            else { tx = R.x + 2 + Math.floor(Math.random() * (R.w - 4)); ty = R.y + 2 + Math.floor(Math.random() * (R.h - 4)); }
            ok = this._fcFree(tx, ty) && Math.hypot(tx - this.playerX, ty - this.playerY) >= 3 && (n >= 50 || this._fcOnScreen(tx * TS + TS / 2, ty * TS + TS / 2, TS));   // where you can see it, if there's room there
        }
        if (!ok) return null;
        const dirs = [[1, 0], [0, 1], [1, 1], [1, -1]], [dx, dy] = dirs[Math.floor(Math.random() * 4)];
        const f = { tx, ty, px: tx * TS + TS / 2, py: ty * TS + TS / 2, heat, dx, dy, seed: tx * 31 + ty * 17, born: this.time.now,
                    gfx: this.add.graphics().setDepth(0.25).setPosition(tx * TS + TS / 2, ty * TS + TS / 2), warn: this.add.graphics().setDepth(0.97),
                    glow: this.textures.exists('vfx_glow') ? this.add.image(tx * TS + TS / 2, ty * TS + TS / 2, 'vfx_glow').setTint(0xff6a1a).setBlendMode(Phaser.BlendModes.ADD).setDepth(0.7).setScale(TS * 1.6 / 128).setAlpha(0) : null,
                    hitAt: 0, emberAt: 0, breedAt: 0, splitAt: null };
        this._fissures.push(f);
        this._bfxDust?.(f.px, f.py);
        Sfx.play(this, 'fissure');
        return f;
    }
    _fcOnScreen(x, y, inset = 0) { const v = this.cameras.main.worldView; return x >= v.x + inset && x <= v.right - inset && y >= v.y + inset && y <= v.bottom - inset; }
    // an arrow at the screen's edge for every crack you can't see: its heat in its colour, pulsing when it's about to split
    _fcArrows(now) {
        if (!this._fcArrowG?.active) this._fcArrowG = this.add.graphics().setScrollFactor(0).setDepth(30);
        const g = this._fcArrowG, cam = this.cameras.main, v = cam.worldView, W = this.scale.width, H = this.scale.height, M = 34;
        g.clear();
        for (const f of this._fissures || []) {
            if (this._fcOnScreen(f.px, f.py)) continue;
            const sx = (f.px - v.x) * cam.zoom, sy = (f.py - v.y) * cam.zoom, a = Math.atan2(sy - H / 2, sx - W / 2);
            const k = Math.min((W / 2 - M) / Math.abs(Math.cos(a) || 1e-6), (H / 2 - M) / Math.abs(Math.sin(a) || 1e-6)), x = W / 2 + Math.cos(a) * k, y = Math.min(H - 96, H / 2 + Math.sin(a) * k);   // (clear of the gems along the bottom)
            const st = this._fcStage(f), pulse = f.splitAt ? 0.5 + 0.5 * Math.sin(now * 0.025) : 0, r = 8 + st * 2 + pulse * 4, col = f.splitAt ? 0xfff0c0 : st >= 3 ? 0xff8a2a : 0xff5a1a;
            g.fillStyle(0x000000, 0.5).fillTriangle(x + Math.cos(a) * (r + 2), y + Math.sin(a) * (r + 2), x + Math.cos(a + 2.4) * (r + 2), y + Math.sin(a + 2.4) * (r + 2), x + Math.cos(a - 2.4) * (r + 2), y + Math.sin(a - 2.4) * (r + 2));
            g.fillStyle(col, 0.85 + 0.15 * pulse).fillTriangle(x + Math.cos(a) * r, y + Math.sin(a) * r, x + Math.cos(a + 2.4) * r, y + Math.sin(a + 2.4) * r, x + Math.cos(a - 2.4) * r, y + Math.sin(a - 2.4) * r);
        }
    }
    _fcStage(f) { return Math.max(1, Math.min(4, Math.ceil(f.heat))); }
    _fcTempo() { const C = this._fcCfg(); return Math.min(C.TEMPO_MAX, 1 + C.TEMPO_PER * (this._fissures?.length || 0)); }
    _fcDrawFissure(f, now) {
        const T = this.TILE_SIZE, st = this._fcStage(f), h = Math.min(1, f.heat / 4), g = f.gfx;
        if (!g?.active) return;
        g.clear(); g.x = f.px + (st >= 4 ? (Math.random() - 0.5) * 2.5 : 0); g.y = f.py + (st >= 4 ? (Math.random() - 0.5) * 2.5 : 0);
        VisualFX.crackTile(g, T, f.seed, f.dx, f.dy, 0.2 + 0.8 * h, 0.25 + 0.75 * h, now - f.born);
        if (f.glow) f.glow.setAlpha(0.12 + 0.55 * h * (0.85 + 0.15 * Math.sin(now * 0.01 + f.seed))).setTint(st >= 4 ? 0xffe0a0 : st >= 3 ? 0xff8a2a : 0xff6a1a);
        const w = f.warn; w.clear();
        if (f.splitAt) {   // about to split: a warning ring tightening, white-hot
            const k = 1 - Math.max(0, (f.splitAt - now) / this._fcCfg().SPLIT_WARN);
            w.lineStyle(2, 0xfff0c0, 0.5 + 0.5 * k); w.strokeCircle(f.px, f.py, T * (1.8 - 0.9 * k));
            w.lineStyle(1, 0xff6a1a, 0.8); w.strokeCircle(f.px, f.py, T * (1.8 - 0.9 * k) + 3);
        }
        if (st >= 2 && Math.random() < 0.02 * st) { const sm = this.add.circle(f.px + (Math.random() - 0.5) * T * 0.6, f.py, 2.5, 0x2a2420, 0.35).setDepth(3.3); this.tweens.add({ targets: sm, y: sm.y - 18, scale: 2, alpha: 0, duration: 800, onComplete: () => sm.destroy() }); }
    }
    // A hit on a fissure (a shot through it, a blow on its tile): it cools a step; a hairline cooled out seals.
    _fcHitFissure(f) {
        const C = this._fcCfg(), now = this.time.now;
        if (!f || now - f.hitAt < C.HIT_CD) return false;
        f.hitAt = now; f.heat -= C.HIT_COOL; f.splitAt = null;
        for (let k = 0; k < 3; k++) { const st = this.add.circle(f.px + (Math.random() - 0.5) * 10, f.py, 3, 0xe8f0f8, 0.45).setDepth(3.4); this.tweens.add({ targets: st, y: st.y - 16, x: st.x + (Math.random() - 0.5) * 10, scale: 2.2, alpha: 0, duration: 420, onComplete: () => st.destroy() }); }   // steam
        if (f.heat <= 0) this._fcSeal(f); else Sfx.play(this, 'clink');
        return true;
    }
    _fcSeal(f) {
        const i = this._fissures.indexOf(f); if (i >= 0) this._fissures.splice(i, 1);
        f.gfx?.destroy(); f.warn?.destroy(); f.glow?.destroy();
        const scar = this.add.ellipse(f.px, f.py + 2, this.TILE_SIZE * 1.1, this.TILE_SIZE * 0.4, 0x4a4440, 0.6).setDepth(0.24);
        this.tweens.add({ targets: scar, alpha: 0, delay: 1500, duration: 1500, onComplete: () => scar.destroy() });
        this._bfxDust?.(f.px, f.py);
        Sfx.play(this, 'csplace');
        this.showStatusText(f.px, f.py - 16, 'SEALED', '#d8c8a8');
    }
    _fcHitFissureTile(tx, ty) {
        if (!this.isLevel4 || !this.fractureCore?.active) return false;
        const f = (this._fissures || []).find(o => o.tx === tx && o.ty === ty);
        return f ? this._fcHitFissure(f) : false;
    }
    // Called by every projectile each frame (WeaponSystem): one passing over a crack cools it.
    _checkProjectileCrackShrink(wx, wy) {
        if (!this.isLevel4 || !this.fractureCore?.active || !this._fissures?.length) return false;
        const f = this._fissures.find(o => Math.abs(o.px - wx) < 13 && Math.abs(o.py - wy) < 13);
        if (f) this._fcHitFissure(f);
        return false;   // shots fly on through
    }
    _isInCrack() { return null; }   // cracks don't block anything (they used to be rubble piles)

    // Every frame while the core hides: the cracks grow, spit, breed and split, all at the tempo.
    _updateDebris(time, delta) {
        const core = this.fractureCore; if (!core?.active) return;
        const C = this._fcCfg(), dt = Math.min(100, delta || 16), tempo = this._fcTempo(), paused = core.state !== 'burrow';
        this._fcTint?.setAlpha(0.14 * (tempo - 1));
        Music.rate = 1 + (tempo - 1) * 0.35;   // the music quickens with the cracks (back to 1 when it dies)
        const adds = (this.enemies || []).filter(e => e._fcAdd && e.sprite?.active).length;
        let spawned = 0;
        this._fcArrows(time);
        // only the hottest few cracks you can see spit embers at once: a readable crossfire, not a storm
        const shooters = new Set(this._fissures.filter(f => f.heat > 2 && this._fcOnScreen(f.px, f.py)).sort((a, b) => b.heat - a.heat).slice(0, C.EMBER_SHOOTERS));
        for (const f of [...this._fissures]) {
            this._fcDrawFissure(f, time);
            if (paused) continue;
            const seen = this._fcOnScreen(f.px, f.py);
            if (f.heat < 4) f.heat = Math.min(4, f.heat + dt / C.STAGE_MS * tempo * (seen ? 1 : C.OFF_GROW));
            const st = this._fcStage(f);
            if (st >= 4 && !f.splitAt) { f.splitAt = time + C.SPLIT_WARN; Sfx.play(this, 'fissure'); }
            if (f.splitAt && time >= f.splitAt) {
                f.splitAt = null; f.heat = C.SPLIT_BACK;
                if (this._fissures.length + C.SPLIT_N > C.CAP) { this._nextSurfaceTime = 0; continue; }   // the floor's about to give: up it comes
                for (let k = 0; k < C.SPLIT_N; k++) this._fcOpenFissure(f, 0.6);
                this.cameras.main.shake(120, 0.005);
                this.showStatusText(f.px, f.py - 20, 'IT SPLITS', '#ff8a3a');
            }
            const em = seen && shooters.has(f) ? C.EMBER_MS[st] : 0;
            if (em && time >= f.emberAt) {
                f.emberAt = time + em / tempo * (0.8 + Math.random() * 0.4);
                if (f.emberAt - em / tempo > f.born + 400) {
                    const a = Math.atan2(this.player.y - f.py, this.player.x - f.px);
                    this.enemyProjectiles.push({ gfx: BossFX.shot(this, 'bolt', f.px, f.py, a, 2.8), vx: Math.cos(a) * C.EMBER_SPEED, vy: Math.sin(a) * C.EMBER_SPEED,
                        damage: C.EMBER_DMG * (this.enemyDamageScale || 1), startX: f.px, startY: f.py, maxDist: this.TILE_SIZE * 12, _bfxKind: 'bolt' });
                }
            }
            if (st >= 3 && time >= f.breedAt) {
                f.breedAt = time + C.BREED_MS / tempo;
                if (adds + spawned < C.MAX_ADDS[core.phase]) { const near = this._findSpawnTileNear(f.tx, f.ty); if (near) { this.spawnLevel4Enemy(near.x, near.y, core.phase); spawned++; } }
            }
        }
    }
    // (old names, kept for their proxies)
    _initDebris() {}
    _triggerCeilingWarning() { this._fcOpenFissure?.(null, 0.6); }
    _dropDebris() {}
    _redrawDebrisTile() {}
    _pushPlayerOutOfDebris() {}
    _debrisSpawnBurst() {}
    _fcPile() { return null; }
    _fcRocks() {}
    _fcCrumble() {}
    _fcHide() {}

    // ══════════════════════════════════════════════════════════════════════
    // CLUSTERED SPAWNING
    // ══════════════════════════════════════════════════════════════════════
    // Enemies were placed one literal tile at a time, which in a big room reads as scatter: you
    // meet them in ones and twos, nothing covers anything else, and every fight is the same
    // fight at a different coordinate. A pack of four standing together is a genuinely different
    // encounter from four singles -- auras overlap, bodies block lanes, and AoE becomes worth
    // aiming rather than incidental.
    //
    // It also fixes support placement. A Healer Totem or an Anchor Slime is only as good as what
    // it is standing next to; dropped on its own it is a free kill, and the player never sees the
    // mechanic do anything. _placeSupportInCluster finds where bodies are actually densest and
    // puts the support there, so it always has something to support.

    // A tight blob of tiles around (cx, cy), nearest-first, skipping walls, debris and occupied
    // tiles. Returns fewer than requested rather than spilling across the room.
    _clusterTiles(cx, cy, count, spread = 2) {
        const out = [];
        const cand = [];
        for (let dx = -spread; dx <= spread; dx++) {
            for (let dy = -spread; dy <= spread; dy++) {
                cand.push({ dx, dy, d: Math.hypot(dx, dy) });
            }
        }
        cand.sort((a, b) => a.d - b.d);
        const taken = new Set();
        for (const c of cand) {
            if (out.length >= count) break;
            const nx = cx + c.dx, ny = cy + c.dy;
            const key = nx + ',' + ny;
            if (taken.has(key)) continue;
            if (this.world[nx]?.[ny] !== this.FLOOR) continue;
            if (this._debrisTiles?.some(d => d.tx === nx && d.ty === ny)) continue;
            if (this.enemies?.some(e => e.x === nx && e.y === ny)) continue;
            taken.add(key);
            out.push({ x: nx, y: ny });
        }
        return out;
    }

    // spec: array of factory callbacks, one per member, each called as fn(tileX, tileY).
    // Cluster size is meant to sit at 3-5: two is a pair, six is a crowd with no shape.
    spawnCluster(cx, cy, spec, opts = {}) {
        const spread = opts.spread ?? 2;
        const tiles  = this._clusterTiles(cx, cy, spec.length, spread);
        const made   = [];
        for (let i = 0; i < tiles.length; i++) {
            const e = spec[i](tiles[i].x, tiles[i].y);
            if (e) {
                if (opts.roomIndex !== undefined) e.tutorialRoomIndex = opts.roomIndex;
                if (opts.waterNative) e._waterNative = true;
                made.push(e);
            }
        }
        if (!this._spawnClusters) this._spawnClusters = [];
        this._spawnClusters.push({ cx, cy, size: made.length, roomIndex: opts.roomIndex });
        return made;
    }

    // Where in this room are enemies most bunched? Scores every occupied tile by how many other
    // enemies sit within `radius`, and returns the best spot. Falls back to null if the room is
    // empty, so a caller can still hand-place.
    _densestPointInRoom(roomIndex, radius = 4) {
        const pool = (this.enemies || []).filter(e =>
            e.tutorialRoomIndex === roomIndex && e.sprite?.active !== false);
        if (pool.length < 2) return null;
        let best = null, bestN = -1;
        for (const e of pool) {
            let n = 0;
            for (const o of pool) {
                if (o === e) continue;
                if (Math.hypot(o.x - e.x, o.y - e.y) <= radius) n++;
            }
            if (n > bestN) { bestN = n; best = e; }
        }
        if (!best || bestN < 1) return null;
        return { x: best.x, y: best.y, neighbours: bestN };
    }

    // Put a support unit where the bodies are. `factory(tx, ty)` builds it.
    _placeSupportInCluster(roomIndex, factory, opts = {}) {
        const hot = this._densestPointInRoom(roomIndex, opts.radius ?? 4);
        const fb  = opts.fallback;
        let spot = null;
        if (hot) {
            // One ring out from the densest body: inside the pack, not stacked on a slime.
            const ring = this._clusterTiles(hot.x, hot.y, 1, opts.spread ?? 2);
            spot = ring[0] || null;
        }
        if (!spot && fb) spot = this._findSpawnTileNear(fb.x, fb.y) || { x: fb.x, y: fb.y };
        if (!spot) return null;
        const e = factory(spot.x, spot.y);
        if (e && roomIndex !== undefined) e.tutorialRoomIndex = roomIndex;
        return e;
    }

    _findSpawnTileNear(tx, ty) {
        const dirs = [[1,0],[-1,0],[0,1],[0,-1],[1,1],[-1,1],[1,-1],[-1,-1],[2,0],[-2,0],[0,2],[0,-2]];
        for (const [dx, dy] of dirs) {
            const nx = tx + dx, ny = ty + dy;
            if (this.world[nx]?.[ny] === this.FLOOR &&
                !this._debrisTiles?.some(d => d.tx === nx && d.ty === ny) &&
                !this.enemies?.some(e => e.x === nx && e.y === ny)) {
                return { x: nx, y: ny };
            }
        }
        return null;
    }

    // A slime from an erupting crack: a plain one; from the second phase sometimes an Encased Slime, from the third a sniper.
    spawnLevel4Enemy(tx, ty, phase) {
        const r = Math.random(), e = phase >= 1 && r < 0.2 ? this.createEncasedSlime(tx, ty, 6) : phase >= 2 && r < 0.5 ? this.createVoidSniper(tx, ty, 6) : this.createEnemy(tx, ty, 40 + phase * 10);
        if (!e) return null;
        e.tutorialRoomIndex = 6;
        e._fcAdd = true;
        if (e.sprite?.active) { e.sprite.setAlpha(0); this.tweens.add({ targets: e.sprite, alpha: 1, duration: 300 }); }
        return e;
    }

    _cleanupDebris() {
        for (const f of this._fissures || []) { f.gfx?.destroy(); f.warn?.destroy(); f.glow?.destroy(); }
        this._fissures = []; this._debrisTiles = []; this._debrisWarnings = [];
        this._fcTint?.destroy(); this._fcTint = null;
    }

    // ── THE CORE ─────────────────────────────────────────────────────────────
    _fcPhaseOf(core) { return Math.min(3, Math.floor((1 - core.health / core.maxHealth) * 4)); }
    _fcHurt(amount, burst) {
        const core = this.fractureCore;
        if (!core?.active || !(amount > 0)) return;
        core.health -= amount;
        const now = this.time.now, c = core.container;
        if (burst || now - (core._numAt || 0) >= 90) { core._numAt = now; this.showDamageNumber(c.x + (Math.random() - 0.5) * 20, c.y - 30, Math.round(amount), burst ? '#fff0b0' : '#ffb25a'); }
        if (!burst) this._vfxFlash?.(c.x, c.y, 50, 0xffd27a, 90, 0.35);
        if (core.health <= 0) { this._fractureCoreKill(); return; }
        const ph = this._fcPhaseOf(core);
        if (ph > core.phase) {   // a quarter of it gone: the floor cracks open again
            core.phase = ph;
            this._showRhythmSessionBanner('THE FLOOR GIVES', '#ffb25a', 'New cracks. The rhythm quickens.');
            this.cameras.main.shake(300, 0.01);
            for (let i = 0; i < this._fcCfg().BURST_N; i++) this.time.delayedCall(i * 250, () => this.fractureCore?.active && this._fcOpenFissure(null, 1.2));
        }
    }
    damageFractureCore(amount) {
        const core = this.fractureCore;
        if (!core?.active || core.state !== 'vuln') return;
        if (core.geode) { this._geodeHurt(this._afterHit(null, null, amount * this._dmgOutMult(null) * this._hitRoll(null)) * this._geodeCfg().EXPOSE_MULT, false); return; }
        this._fcHurt(this._afterHit(null, null, amount * this._dmgOutMult(null) * this._hitRoll(null)), false);
    }

    // It rises out of the worst crack, and the rhythm begins.
    _fractureCoreSurface() {
        const core = this.fractureCore, C = this._fcCfg();
        if (!core?.active || core.state !== 'burrow') return;
        const worst = [...this._fissures].sort((a, b) => b.heat - a.heat)[0];
        if (worst) { core.tileX = worst.tx; core.tileY = worst.ty; } else { core.tileX = Math.floor(this._debrisBossRoom.x + this._debrisBossRoom.w / 2); core.tileY = Math.floor(this._debrisBossRoom.y + this._debrisBossRoom.h / 2); }
        const T = this.TILE_SIZE, c = core.container.setPosition(core.tileX * T + T / 2, core.tileY * T + T / 2);
        core.state = 'rise'; core.stateAt = this.time.now; core._surfaced = true;
        c.setVisible(true).setScale(0.2).setAlpha(0.3);
        this.tweens.add({ targets: c, scale: 1, alpha: 1, duration: C.RISE_MS, ease: 'Back.easeOut' });
        BossFX.blast(this, c.x, c.y, 46, 'shell'); this._vfxFlash?.(c.x, c.y, 140, 0xffb44a, 400, 0.9);
        this.cameras.main.shake(140, 0.006); Sfx.play(this, 'roar');
        this.time.delayedCall(C.RISE_MS, () => this.fractureCore === core && core.active && this._fcRhythmStart());
    }

    // ── THE RHYTHM ───────────────────────────────────────────────────────────
    // Notes on the cracks (and round the core if there are few on screen), timed to a beat. Each is a circle with an
    // approach ring closing on it and its number; click it as the ring meets it. Doubles and triples land half a beat
    // apart on one crack; a slide is clicked at its start and then dragged along to its end, keeping the cursor on the
    // ball. Notes are judged in order. this._fractureWeakPoints holds them.
    _fcRhythmStart() {
        const core = this.fractureCore, C = this._fcCfg(), T = this.TILE_SIZE, now = this.time.now, ph = core.phase;
        const cam = this.cameras.main, z = cam.zoom || 1, vw = cam.width / z, vh = cam.height / z, vx = cam.scrollX + (cam.width - vw) / 2, vy = cam.scrollY + (cam.height - vh) / 2;
        const onScreen = p => p.x > vx + 30 && p.x < vx + vw - 30 && p.y > vy + 60 && p.y < vy + vh - 80;
        let anchors = this._fissures.map(f => ({ x: f.px, y: f.py })).filter(onScreen);
        for (let k = 0; anchors.length < 5 && k < 20; k++) {   // too few cracks in view: points round the core
            const a = k * 2.4, r = T * (3 + (k % 3)), p = { x: core.container.x + Math.cos(a) * r, y: core.container.y + Math.sin(a) * r * 0.8 };
            if (onScreen(p) && this.world?.[Math.floor(p.x / T)]?.[Math.floor(p.y / T)] === this.FLOOR) anchors.push(p);
        }
        if (!anchors.length) anchors = [{ x: core.container.x, y: core.container.y + T * 2 }];
        const beat = 60000 / C.BPM[ph], notes = [];
        let t = now + C.LEAD_IN, last = -1, num = 1;
        const pick = () => { let i; do { i = Math.floor(Math.random() * anchors.length); } while (anchors.length > 1 && i === last); last = i; return anchors[i]; };
        while (notes.length < C.NOTES[ph]) {
            const r = Math.random(), a = pick();
            if (r < 0.15 && notes.length + 3 <= C.NOTES[ph]) { for (let k = 0; k < 3; k++) notes.push({ x: a.x, y: a.y, hit: t + k * beat / 2, type: 'tap', n: num++ }); t += beat * 2; }        // a triple
            else if (r < 0.35 && notes.length + 2 <= C.NOTES[ph]) { for (let k = 0; k < 2; k++) notes.push({ x: a.x, y: a.y, hit: t + k * beat / 2, type: 'tap', n: num++ }); t += beat * 1.5; }  // a double
            else if (r < 0.55) {                                                                                                                                           // a slide
                const b = anchors.filter(o => o !== a && Math.hypot(o.x - a.x, o.y - a.y) < T * 7 && Math.hypot(o.x - a.x, o.y - a.y) > T * 1.5)[0];
                if (b) { notes.push({ x: a.x, y: a.y, x2: b.x, y2: b.y, hit: t, end: t + beat * 1.5, type: 'slide', n: num++, fin: 0, fout: 0 }); t += beat * 2.5; }
                else { notes.push({ x: a.x, y: a.y, hit: t, type: 'tap', n: num++ }); t += beat; }
            } else { notes.push({ x: a.x, y: a.y, hit: t, type: 'tap', n: num++ }); t += beat; }
        }
        for (const nt of notes) { nt.born = nt.hit; nt.dur = 0; nt.active = true; nt.resolved = false; nt.grade = null; }
        core.rhythm = { notes, misses: 0, g: this.add.graphics().setDepth(4.82), labels: new Map(), endAt: (notes[notes.length - 1].end || notes[notes.length - 1].hit) + C.W.OK + 50 };
        this._fractureWeakPoints = notes; this._wpSequenceIdx = 0;
        core.state = 'rhythm'; core.stateAt = now;
        this._showRhythmSessionBanner('KEEP THE RHYTHM', '#ffe08a', 'Click each crack as its ring closes. Drag the slides.');
    }
    _fcGrade(dt) { const W = this._fcCfg().W, a = Math.abs(dt); return a <= W.PERFECT ? 'PERFECT' : a <= W.GOOD ? 'GOOD' : a <= W.OK ? 'OK' : 'MISS'; }
    _gradeColor(grade) { return { PERFECT: '#fff3c0', GOOD: '#9aff8a', OK: '#ffc24a', MISS: '#ff6a5a' }[grade] || '#ffffff'; }
    _fcJudge(nt, grade) {
        const core = this.fractureCore; nt.grade = grade; nt.resolved = true; nt.active = false;
        this.showStatusText(nt.type === 'slide' ? nt.x2 : nt.x, (nt.type === 'slide' ? nt.y2 : nt.y) - 18, grade === 'MISS' ? 'miss' : grade, this._gradeColor(grade));
        core.rhythm.labels.get(nt)?.destroy(); core.rhythm.labels.delete(nt);
        if (grade === 'MISS') {
            core.rhythm.misses++; Sfx.play(this, 'clink');
            if (core.rhythm.misses >= this._fcCfg().MISS_MAX) this._fcRhythmEnd(true);
        } else {
            Sfx.play(this, grade === 'PERFECT' ? 'csplace' : 'hit', { gold: grade === 'PERFECT' });
            const R = this.add.circle(nt.type === 'slide' ? nt.x2 : nt.x, nt.type === 'slide' ? nt.y2 : nt.y, this._fcCfg().HIT_R, 0, 0).setStrokeStyle(3, Phaser.Display.Color.HexStringToColor(this._gradeColor(grade)).color, 1).setDepth(4.83).setBlendMode(Phaser.BlendModes.ADD);
            this.tweens.add({ targets: R, scale: 1.8, alpha: 0, duration: 260, onComplete: () => R.destroy() });
        }
    }
    // A click while the rhythm plays: the next note, if it's close in time and the click is on it.
    _tryHitCurrentWeakPoint(wx, wy) {
        const core = this.fractureCore, C = this._fcCfg();
        if (core?.state !== 'rhythm' || !core.rhythm) return false;
        const now = this.time.now, nt = core.rhythm.notes.find(n => !n.resolved && !n.started);
        if (!nt) return true;
        const dt = now - nt.hit;
        if (dt < -C.W.OK || Math.hypot(nt.x - wx, nt.y - wy) > C.HIT_R + 8) return true;   // too early or off it: ignored (not a miss)
        const grade = this._fcGrade(dt);
        if (nt.type === 'slide' && grade !== 'MISS') { nt.started = true; nt.startGrade = grade; Sfx.play(this, 'hit'); }
        else this._fcJudge(nt, grade);
        return true;
    }
    _isClickOnActiveWeakPoint() { return this.fractureCore?.state === 'rhythm'; }
    _fcRhythmTick(time, delta) {
        const core = this.fractureCore, R = core.rhythm, C = this._fcCfg(), g = R.g, ADD = Phaser.BlendModes.ADD;
        const cam = this.cameras.main, cur = { x: this.pointerX + cam.scrollX, y: this.pointerY + cam.scrollY };
        g.clear();
        for (let i = R.notes.length - 1; i >= 0; i--) {
            const nt = R.notes[i];
            if (nt.resolved) continue;
            if (!nt.started && time > nt.hit + C.W.OK) { this._fcJudge(nt, 'MISS'); if (core.state !== 'rhythm') return; continue; }
            if (nt.started) {   // a slide in progress: the ball runs to its end; keep the cursor on it with the button held
                const u = Math.min(1, (time - nt.hit) / (nt.end - nt.hit)), bx = nt.x + (nt.x2 - nt.x) * u, by = nt.y + (nt.y2 - nt.y) * u;
                const on = this.isPointerDown && Math.hypot(cur.x - bx, cur.y - by) <= C.FOLLOW_R;
                if (on) nt.fin += delta; else nt.fout += delta;
                g.lineStyle(3, on ? 0xfff0c0 : 0xff6a5a, 0.9); g.strokeCircle(bx, by, C.FOLLOW_R);
                g.fillStyle(0xffe08a, 1); g.fillCircle(bx, by, 9); g.fillStyle(0xffffff, 1); g.fillCircle(bx, by, 4);
                if (time >= nt.end) { const r = nt.fin / Math.max(1, nt.fin + nt.fout); this._fcJudge(nt, r >= 0.75 ? nt.startGrade : r >= 0.4 ? 'OK' : 'MISS'); if (core.state !== 'rhythm') return; }
            }
            const show = nt.hit - C.APPROACH; if (time < show) continue;
            const k = Math.min(1, (time - show) / C.APPROACH), r = C.HIT_R * 0.55, fade = Math.min(1, (time - show) / 200);
            if (nt.type === 'slide') {   // the track, the end circle
                g.lineStyle(r * 2 + 6, 0x2a1408, 0.55 * fade); g.lineBetween(nt.x, nt.y, nt.x2, nt.y2);
                g.lineStyle(r * 2, 0xffb25a, 0.35 * fade); g.lineBetween(nt.x, nt.y, nt.x2, nt.y2);
                g.lineStyle(2, 0xfff0c0, 0.8 * fade); g.strokeCircle(nt.x2, nt.y2, r);
            }
            if (!nt.started) {
                g.fillStyle(0x2a1408, 0.75 * fade); g.fillCircle(nt.x, nt.y, r + 3);
                g.fillStyle(nt.type === 'slide' ? 0xff9a3a : 0xffb25a, 0.95 * fade); g.fillCircle(nt.x, nt.y, r);
                g.lineStyle(2, 0xfff4d8, fade); g.strokeCircle(nt.x, nt.y, r);
                const ar = r + (C.HIT_R * 2.6 - r) * (1 - k);   // the approach ring
                g.lineStyle(2.5, 0xfff4d8, 0.9 * fade); g.strokeCircle(nt.x, nt.y, ar);
                if (!R.labels.has(nt)) { const lb = this.add.text(nt.x, nt.y, String(nt.n), { fontSize: '13px', fontFamily: UIKit.FONT.title, fontStyle: 'bold', color: '#2a1408' }).setOrigin(0.5).setDepth(4.84); this._vfxSort?.(lb); R.labels.set(nt, lb); }
                R.labels.get(nt).setAlpha(fade);
            }
        }
        this._wpSequenceIdx = Math.max(0, R.notes.findIndex(n => !n.resolved));
        if (R.notes.every(n => n.resolved)) this._fcRhythmEnd(false);
    }
    // The rhythm's over: the accuracy decides. aborted: three misses.
    _fcRhythmEnd(aborted) {
        const core = this.fractureCore, C = this._fcCfg(), R = core.rhythm; if (!R) return;
        R.g.destroy(); for (const [, lb] of R.labels) lb.destroy();
        core.rhythm = null; this._fractureWeakPoints = [];
        const c = core.container;
        if (aborted) {
            this.takeDamage(C.MISS3_DMG * (this.enemyDamageScale || 1));
            this._fcOpenFissure(null, 1.5);
            this._showRhythmSessionBanner('YOU LOST THE BEAT', '#ff6a5a', 'It dives, and the floor cracks.');
            this._fractureCoreSubmerge(); return;
        }
        const max = R.notes.length * C.SCORE.PERFECT, got = R.notes.reduce((a, n) => a + C.SCORE[n.grade || 'MISS'], 0), acc = got / max, pct = Math.round(acc * 100);
        if (acc < C.STAY_AT) {
            if (acc < C.SAFE_AT) this.takeDamage(C.DUCK_DMG * (this.enemyDamageScale || 1));
            this._showRhythmSessionBanner(`${pct}%`, acc < C.SAFE_AT ? '#ff6a5a' : '#ffc24a', acc < C.SAFE_AT ? 'Off the beat. It strikes out and ducks back.' : 'Not enough. It ducks back.');
            this._fractureCoreSubmerge(); return;
        }
        const perfect = acc >= 0.999, ms = C.VULN_MS * acc + (perfect ? C.PERFECT_BONUS : 0);
        if (perfect) { this._fcHurt(core.maxHealth * C.PERFECT_DMG, true); this.cameras.main.shake(200, 0.01); this._bfxCoreKick?.(core); if (!core.active) return; }
        this._showRhythmSessionBanner(perfect ? 'PERFECT' : `${pct}%`, perfect ? '#fff3c0' : '#9aff8a', `It's exposed for ${(ms / 1000).toFixed(1)}s. Hit it.`);
        core.state = 'vuln'; core.stateAt = this.time.now; core.vulnUntil = this.time.now + ms; core._isInvulnerable = false;
    }

    // It dives back into its crack (the cracks start growing again).
    _fractureCoreSubmerge() {
        const core = this.fractureCore, C = this._fcCfg();
        if (!core?.active || core.state === 'dive' || core.state === 'burrow') return;
        if (core.rhythm) { core.rhythm.g.destroy(); for (const [, lb] of core.rhythm.labels) lb.destroy(); core.rhythm = null; }
        core.state = 'dive'; core.stateAt = this.time.now; core._isInvulnerable = true;
        core.ringG?.clear();
        this.tweens.add({ targets: core.container, scale: 0.2, alpha: 0, duration: C.DIVE_MS, ease: 'Quad.easeIn', onComplete: () => {
            if (!core.active) return;
            core.container.setVisible(false); core._surfaced = false;
            core.state = 'burrow'; core.stateAt = this.time.now;
            this._nextSurfaceTime = this.time.now + C.SURFACE_EVERY / Math.max(1, this._fcTempo() * 0.8);
        } });
    }
    _fractureCoreSurfaceAbort() { this._fractureCoreSubmerge(); }

    _updateFractureCore(time, delta) {
        const core = this.fractureCore;
        if (!core?.active) return;
        if (core.geode) { this._geodeUpdate(time, delta); return; }
        const C = this._fcCfg();
        this._updateDebris(time, delta || 16);
        if (core.state === 'burrow' && (time >= this._nextSurfaceTime || this._fissures.length >= C.CAP)) this._fractureCoreSurface();
        else if (core.state === 'rhythm') this._fcRhythmTick(time, delta || 16);
        else if (core.state === 'vuln') {
            const c = core.container; c.y = core.tileY * this.TILE_SIZE + this.TILE_SIZE / 2 - 4 + Math.sin(time * 0.004) * 3;
            const g = core.ringG, left = (core.vulnUntil - time) / (core.vulnUntil - core.stateAt);   // the window, closing round it
            g.clear(); g.lineStyle(3, 0xffe08a, 0.85); g.beginPath(); g.arc(c.x, c.y, 34, -Math.PI / 2, -Math.PI / 2 + Math.max(0, left) * Math.PI * 2); g.strokePath();
            if (time >= core.vulnUntil) this._fractureCoreSubmerge();
        }
    }
    _updateSurfaceWindow() {}

    // A screen banner: a title in the title face, a line under it, over a soft dark band.
    _showRhythmSessionBanner(title, color, subtext) {
        const W = this.scale.width, y = Math.round(this.scale.height * 0.2);
        const band = this.add.graphics().setScrollFactor(0).setDepth(30).setAlpha(0);
        for (let i = 0; i < 12; i++) { band.fillStyle(0x000000, 0.05); band.fillRect(0, y - 46 + i * 2, W, 92 - i * 4); }
        band.lineStyle(1, Phaser.Display.Color.HexStringToColor(color).color, 0.5);
        band.lineBetween(W / 2 - 220, y - 24, W / 2 + 220, y - 24); band.lineBetween(W / 2 - 220, y + 34, W / 2 + 220, y + 34);
        const t1 = this.add.text(W / 2, y, title, { fontSize: '30px', fontFamily: UIKit.FONT.title, fontStyle: 'bold', color, stroke: '#0a0604', strokeThickness: 6 })
            .setOrigin(0.5).setScrollFactor(0).setDepth(31).setAlpha(0);
        const t2 = subtext ? this.add.text(W / 2, y + 22, subtext, { fontSize: '14px', fontFamily: UIKit.FONT.title, fontStyle: 'italic', color: '#e8dcc0', stroke: '#0a0604', strokeThickness: 4 })
            .setOrigin(0.5, 0).setScrollFactor(0).setDepth(31).setAlpha(0) : null;
        const all = [band, t1, t2].filter(Boolean);
        t1.setScale(1.15);
        this.tweens.add({ targets: t1, scale: 1, duration: 300, ease: 'Back.easeOut' });
        this.tweens.add({ targets: all, alpha: 1, duration: 220, ease: 'Quad.easeOut' });
        this.tweens.add({ targets: all, alpha: 0, delay: 2000, duration: 450, ease: 'Quad.easeIn', onComplete: () => all.forEach(o => o.destroy()) });
    }

    // (old names, kept for their proxies)
    _gradeWeight(grade) { return { PERFECT: 1, GOOD: 0.33, OK: 0.17 }[grade] || 0; }
    _updateWeakPointBar() {}
    _activateWeakPoint(idx) { this._wpSequenceIdx = idx; }
    _drawWeakPointInner() {}
    _drawWeakPointRing() {}
    _drawWeakPointRing2() {}
    _worseGrade(a, b) { const R = { PERFECT: 3, GOOD: 2, OK: 1, MISS: 0 }; return R[a] <= R[b] ? a : b; }
    _gradeForDiff(d) { return this._fcGrade(d); }
    _resolveWeakPoint(wp, idx, grade) { this._fcJudge(wp, grade); }
    _hitFractureWeakPoint() { return false; }

    _fractureCoreKill() {
        const core = this.fractureCore;
        if (!core?.active) return;
        core.active = false;
        Sfx.play(this, 'bossdie');
        if (!this.towerRun) Progress.announce(this, Progress.rewardBoss('fracture').frags);   // (the Tower pays its own way)
        if (core.rhythm) { core.rhythm.g.destroy(); for (const [, lb] of core.rhythm.labels) lb.destroy(); core.rhythm = null; }
        this._bfxCoreDeath(core);
        this.cameras.main.shake(400, 0.02);
        this._showRhythmSessionBanner('THE CORE SHATTERS', '#ffd27a', 'The floor holds.');
        this.tweens.killTweensOf(core.container);
        core.container.destroy(); core.ringG?.destroy(); core.plateG?.destroy(); core.fxG?.destroy(); this._fcArrowG?.destroy(); this._fcArrowG = null;
        this._bossBarHide?.();
        Music.rate = 1;
        [...(this._fissures || [])].forEach((f, i) => this.time.delayedCall(i * 90, () => this._fcSeal(f)));   // the cracks seal one after another
        this.time.delayedCall((this._fissures?.length || 0) * 90 + 200, () => { this._fcTint?.destroy(); this._fcTint = null; });
        for (const e of [...(this.enemies || [])]) if (e._fcAdd && e.sprite?.active) { e._isEncased = false; this.damageEnemy(e, 1e6, null); }
        this._fractureWeakPoints = [];
        this.fractureCore = null;
    }

    // ══════════════════════════════════════════════════════════════════════
    // THE GEODE (2026-10-20; it replaced the rhythm Core, kept as this.fractureCore so the boss bar, Cosmic and the weapons'
    // boss loops still find it)
    // A crystal heart in a shell of stone plates. Plates take half damage; the elements break them faster: fire heats the
    // plate it hits (up to 3), and ice on a plate at 2+ shatters it outright (THERMAL SHOCK, a chip off the heart too);
    // lightning on a cracked plate arcs to every other cracked one; cosmic Hexes a plate (x2 for 4s). An Encased Slime's
    // stone broken next to it smashes a plate. With every plate gone the heart is exposed for a while, then it re-armours.
    // Its attacks are the level's: fault lines that run across the room through you and erupt; from its second third,
    // rifts that split the floor for good (they burn: dash across); Encased Slimes from the walls; in its last third it
    // sinks and surfaces somewhere else. Three phases, by thirds of its health.
    // ══════════════════════════════════════════════════════════════════════
    _geodeCfg() {
        return {
            HP: 2400,
            PLATES: [4, 5, 6], PLATE_HP: [140, 190, 250],   // by phase
            PLATE_ARMOR: 0.5, CRACKED_AT: 0.5,                 // an ordinary hit on a plate; under this share it's cracked (lightning arcs)
            HEAT_MAX: 3, HEAT_SHOCK: 2, HEAT_DECAY_MS: 2500,   // fire heats a plate a step a hit; ice on HEAT_SHOCK+ shatters it; a step cools off every HEAT_DECAY_MS
            SHOCK_CORE_PCT: 0.03,                              // a thermal shock also cracks this share of its HP off the heart
            ARC_SHARE: 0.6, HEX_MS: 4000, HEX_MULT: 2,
            EXPOSE_MS: 7000, EXPOSE_MULT: 1.25,
            FAULT_MS: [5200, 4200, 3400], FAULT_TELE: 1100, FAULT_DMG: 14,
            RIFT_DMG: 4, RIFT_TICK: 500,
            ADD_MS: [11000, 9000, 7500], ADD_CAP: [2, 3, 4],
            STONE_R: 3, STONE_PLATE: 0.6,                      // an Encased Slime's stone broken this near takes this share off its nearest plate
            HOP_MS: 14000, RISE_MS: 650, DIVE_MS: 450,
        };
    }
    _geodePhase(core) { return Math.min(2, Math.floor((1 - core.health / core.maxHealth) * 3)); }
    // A fresh shell: PLATES[phase] of them, evenly round it
    _geodeArm() {
        const core = this.fractureCore, C = this._geodeCfg();
        if (!core?.active) return;
        const n = C.PLATES[core.phase], hp = C.PLATE_HP[core.phase];
        core.plates = Array.from({ length: n }, (_, i) => ({ a: i / n * Math.PI * 2 - Math.PI / 2, hp, max: hp, heat: 0, heatAt: 0, hexUntil: 0, broken: false }));
        core.state = 'armored'; core.stateAt = this.time.now; core._isInvulnerable = false;
        core.ringG?.clear();
        const c = core.container; this._vfxFlash?.(c.x, c.y, 120, 0xc8b8a0, 260, 0.6); Sfx.play(this, 'e_chain');
    }
    // The plate a hit lands on: the one facing you (the nearest whole one to that side)
    _geodePlateFacing() {
        const core = this.fractureCore, c = core.container, toYou = Math.atan2(this.player.y - c.y, this.player.x - c.x);
        let best = null, bd = Infinity;
        for (const p of core.plates) { if (p.broken) continue; const d = Math.abs(Phaser.Math.Angle.Wrap(p.a - toYou)); if (d < bd) { bd = d; best = p; } }
        return best;
    }
    // A weapon hit on it (CombatSystem.damageBossAtTile, the flamethrower). Raw weapon damage: the multipliers are applied here.
    _geodeHit(damage, el) {
        const core = this.fractureCore, C = this._geodeCfg(), now = this.time.now;
        if (!core?.active || !core.geode) return;
        if (core.state === 'vuln') { this.damageFractureCore(damage); return; }
        if (core.state !== 'armored') return;
        const p = this._geodePlateFacing(); if (!p) return;
        const c = core.container, px = c.x + Math.cos(p.a) * 30, py = c.y + Math.sin(p.a) * 22;
        if (el === 'ice' && p.heat >= C.HEAT_SHOCK) { this._geodeShatter(p, 'THERMAL SHOCK'); this._geodeHurt(core.maxHealth * C.SHOCK_CORE_PCT, true); return; }
        if (el === 'fire') { p.heat = Math.min(C.HEAT_MAX, p.heat + 1); p.heatAt = now; }
        if (el === 'cosmic') p.hexUntil = now + C.HEX_MS;
        const d = damage * this._dmgOutMult(null) * C.PLATE_ARMOR * (p.hexUntil > now ? C.HEX_MULT : 1);
        const wasCracked = p.hp < p.max * C.CRACKED_AT;
        p.hp -= d;
        if (now - (core._numAt || 0) >= 110) { core._numAt = now; this.showDamageNumber(px, py - 10, Math.round(d), '#c8b8a0'); }
        if (el === 'lightning' && wasCracked) for (const q of core.plates) {   // it arcs through the cracks
            if (q === p || q.broken || q.hp >= q.max * C.CRACKED_AT) continue;
            q.hp -= d * C.ARC_SHARE;
            const g = this.add.graphics().setDepth(4.9); g.lineStyle(2, 0xffe14a, 0.95); g.lineBetween(px, py, c.x + Math.cos(q.a) * 30, c.y + Math.sin(q.a) * 22);
            this.tweens.add({ targets: g, alpha: 0, duration: 200, onComplete: () => g.destroy() });
            if (q.hp <= 0) this._geodeShatter(q, null);
        }
        if (p.hp <= 0) this._geodeShatter(p, null);
        else if (!wasCracked && p.hp < p.max * C.CRACKED_AT) Sfx.play(this, 'e_crack');
    }
    _geodeShatter(p, label) {
        const core = this.fractureCore;
        if (!core?.active || p.broken) return;
        p.broken = true; p.hp = 0;
        const c = core.container, x = c.x + Math.cos(p.a) * 30, y = c.y + Math.sin(p.a) * 22;
        this._bfxShatter?.(x, y, label ? 0x9ae8ff : 0x9a8a7a, 12); this._bfxDust?.(x, y);
        Sfx.play(this, 'shatter'); this.cameras.main.shake(label ? 160 : 90, label ? 0.008 : 0.004);
        if (label) { this.showStatusText(x, y - 30, label, '#9ae8ff'); this._vfxFlash?.(x, y, 90, 0x9ae8ff, 240, 0.8); }
        if (core.plates.every(q => q.broken)) this._geodeExpose();
    }
    _geodeExpose() {
        const core = this.fractureCore, C = this._geodeCfg();
        core.state = 'vuln'; core.stateAt = this.time.now; core.vulnUntil = this.time.now + C.EXPOSE_MS;
        const c = core.container; BossFX.blast(this, c.x, c.y, 60, 'shell'); this._vfxFlash?.(c.x, c.y, 200, 0xffd27a, 400, 0.9);
        this._showRhythmSessionBanner('THE HEART IS EXPOSED', '#ffd27a', 'Hit it before it grows its shell back.');
        Sfx.play(this, 'roar');
    }
    _geodeHurt(amount, burst) {
        const core = this.fractureCore;
        if (!core?.active || !(amount > 0)) return;
        core.health -= amount;
        const c = core.container, now = this.time.now;
        if (burst || now - (core._numAt || 0) >= 90) { core._numAt = now; this.showDamageNumber(c.x + (Math.random() - 0.5) * 20, c.y - 30, Math.round(amount), burst ? '#fff0b0' : '#ffb25a'); }
        this._bfxCoreKick?.(core);
        if (core.health <= 0) { this._fractureCoreKill(); return; }
        const ph = this._geodePhase(core);
        if (ph > core.phase) {
            core.phase = ph;
            this.cameras.main.shake(320, 0.012);
            this._geodeRift(ph === 1 ? 'h' : 'v');
            this._showRhythmSessionBanner(ph === 1 ? 'THE FLOOR SPLITS' : 'IT GOES DEEP', '#ffb25a', ph === 1 ? 'Rifts burn. Dash across them.' : 'It sinks and surfaces somewhere else.');
        }
    }
    // A fault line: a crack runs across the room through your tile (a row, a column or a diagonal), glows, then erupts
    _geodeFault() {
        const core = this.fractureCore, R = this._debrisBossRoom; if (!R) return;
        const kind = ['h', 'v', 'd1', 'd2'][Math.floor(Math.random() * 4)], tiles = [];
        for (let i = -40; i <= 40; i++) {
            const [x, y] = kind === 'h' ? [this.playerX + i, this.playerY] : kind === 'v' ? [this.playerX, this.playerY + i] : kind === 'd1' ? [this.playerX + i, this.playerY + i] : [this.playerX + i, this.playerY - i];
            if (x >= R.x && x < R.x + R.w && y >= R.y && y < R.y + R.h && this.world[x]?.[y] === this.FLOOR) tiles.push([x, y]);
        }
        if (tiles.length) core.faults.push({ tiles, at: this.time.now, seed: Math.random() * 100 });
        Sfx.play(this, 'fissure');
    }
    // A rift for good: a jagged band across the room through the middle (h: along it, v: down it)
    _geodeRift(kind) {
        const core = this.fractureCore, R = this._debrisBossRoom; if (!R) return;
        const cx = Math.floor(R.x + R.w / 2), cy = Math.floor(R.y + R.h / 2), line = [];
        const n = kind === 'h' ? R.w : R.h;
        for (let i = 0; i < n; i++) {
            const off = Math.round(Math.sin(i * 0.55 + (kind === 'h' ? 0 : 2)) * 1.6);
            const [x, y] = kind === 'h' ? [R.x + i, cy + off] : [cx + off, R.y + i];
            if (this.world[x]?.[y] === this.FLOOR) { core.rifts.add(x + ',' + y); line.push([x, y]); }
        }
        core.riftLines.push(line);
        Sfx.play(this, 'fissure');
        for (const [x, y] of line) if (Math.random() < 0.3) this._bfxDust?.(x * this.TILE_SIZE + this.TILE_SIZE / 2, y * this.TILE_SIZE + this.TILE_SIZE / 2);
    }
    // An Encased Slime's stone broke (LevelManager._encCleanup): near the Geode, it smashes the closest plate
    _geodeStoneBreak(x, y) {
        const core = this.fractureCore, C = this._geodeCfg();
        if (!core?.active || !core.geode || core.state !== 'armored') return;
        const c = core.container, T = this.TILE_SIZE;
        if (Math.hypot(x - c.x, y - c.y) > C.STONE_R * T) return;
        const a = Math.atan2(y - c.y, x - c.x);
        const p = core.plates.filter(q => !q.broken).sort((q, r) => Math.abs(Phaser.Math.Angle.Wrap(q.a - a)) - Math.abs(Phaser.Math.Angle.Wrap(r.a - a)))[0];
        if (!p) return;
        p.hp -= p.max * C.STONE_PLATE;
        this.showStatusText(c.x + Math.cos(p.a) * 30, c.y - 40, 'STONE STRIKE', '#d8c8a8');
        if (p.hp <= 0) this._geodeShatter(p, null);
    }
    _geodeSpawnAdd() {
        const core = this.fractureCore, C = this._geodeCfg(), R = this._debrisBossRoom;
        if ((this.enemies || []).filter(e => e._fcAdd && e.sprite?.active).length >= C.ADD_CAP[core.phase]) return;
        for (let k = 0; k < 30; k++) {
            const side = Math.floor(Math.random() * 4), t = Math.random();
            const x = side < 2 ? Math.floor(R.x + 1 + t * (R.w - 2)) : side === 2 ? R.x + 1 : R.x + R.w - 2;
            const y = side >= 2 ? Math.floor(R.y + 1 + t * (R.h - 2)) : side === 0 ? R.y + 1 : R.y + R.h - 2;
            if (this.world[x]?.[y] !== this.FLOOR || Math.hypot(x - this.playerX, y - this.playerY) < 5 || this.getEnemyAt?.(x, y)) continue;
            const e = this.createEncasedSlime(x, y, 6);
            if (e) { e._fcAdd = true; if (!this.enemies.includes(e)) this.enemies.push(e); }
            if (e) Sfx.play(this, 'spawn');
            return;
        }
    }
    // It sinks and comes up somewhere else in the room (its last third), shell and all
    _geodeHop() {
        const core = this.fractureCore, C = this._geodeCfg(), R = this._debrisBossRoom, T = this.TILE_SIZE;
        core.state = 'dive'; core.stateAt = this.time.now; core._isInvulnerable = true;
        Sfx.play(this, 'portal', { close: true });
        this.tweens.add({ targets: core.container, scale: 0.2, alpha: 0, duration: C.DIVE_MS, ease: 'Quad.easeIn', onComplete: () => {
            if (!core.active) return;
            let tx = core.tileX, ty = core.tileY;
            for (let k = 0; k < 40; k++) {
                const x = R.x + 3 + Math.floor(Math.random() * (R.w - 6)), y = R.y + 3 + Math.floor(Math.random() * (R.h - 6));
                if (this.world[x]?.[y] === this.FLOOR && !core.rifts.has(x + ',' + y) && Math.hypot(x - this.playerX, y - this.playerY) >= 5) { tx = x; ty = y; break; }
            }
            core.tileX = tx; core.tileY = ty;
            core.container.setPosition(tx * T + T / 2, ty * T + T / 2);
            this.tweens.add({ targets: core.container, scale: 1, alpha: 1, duration: C.RISE_MS, ease: 'Back.easeOut', onComplete: () => { if (core.active) { core.state = 'armored'; core.stateAt = this.time.now; core._isInvulnerable = false; } } });
            BossFX.blast(this, core.container.x, core.container.y, 46, 'shell'); this.cameras.main.shake(140, 0.006);
            Sfx.play(this, 'slam');
        } });
    }
    // Every frame: plates cooling, the window, its attacks, rifts burning you, and the drawing
    _geodeUpdate(time, delta) {
        const core = this.fractureCore, C = this._geodeCfg(), T = this.TILE_SIZE;
        if (!core?.active) return;
        for (const p of core.plates) if (p.heat > 0 && time - p.heatAt >= C.HEAT_DECAY_MS) { p.heat--; p.heatAt = time; }
        if (core.state === 'vuln') {
            const c = core.container, g = core.ringG, left = (core.vulnUntil - time) / C.EXPOSE_MS;
            g.clear(); g.lineStyle(3, 0xffe08a, 0.85); g.beginPath(); g.arc(c.x, c.y, 34, -Math.PI / 2, -Math.PI / 2 + Math.max(0, left) * Math.PI * 2); g.strokePath();
            if (time >= core.vulnUntil) this._geodeArm();
        }
        if (core.state === 'armored' || core.state === 'vuln') {
            if (time >= core.nextFault) { core.nextFault = time + C.FAULT_MS[core.phase]; this._geodeFault(); }
            if (time >= core.nextAdd) { core.nextAdd = time + C.ADD_MS[core.phase]; this._geodeSpawnAdd(); }
            if (core.phase >= 2 && core.state === 'armored' && time >= core.nextHop) { core.nextHop = time + C.HOP_MS; this._geodeHop(); }
        }
        // faults: glowing, then erupting
        for (let i = core.faults.length - 1; i >= 0; i--) {
            const f = core.faults[i];
            if (!f.hit && time - f.at >= C.FAULT_TELE) {
                f.hit = true;
                if (f.tiles.some(([x, y]) => x === this.playerX && y === this.playerY)) this.takeDamage(C.FAULT_DMG * (this.enemyDamageScale || 1));
                for (const [x, y] of f.tiles) if (Math.random() < 0.35) this._vfxFlash?.(x * T + T / 2, y * T + T / 2, 30, 0xff8a2a, 200, 0.6);
                this.cameras.main.shake(120, 0.005); Sfx.play(this, 'erupt');
            }
            if (time - f.at >= C.FAULT_TELE + 350) core.faults.splice(i, 1);
        }
        // rifts burn whoever stands in them (a dash's invulnerability carries you across)
        if (core.rifts.has(this.playerX + ',' + this.playerY) && time - (core._riftAt || 0) >= C.RIFT_TICK) { core._riftAt = time; this.takeDamage(C.RIFT_DMG * (this.enemyDamageScale || 1)); }
        this._geodeDraw(time);
    }
    _geodeDraw(time) {
        const core = this.fractureCore, C = this._geodeCfg(), T = this.TILE_SIZE, g = core.fxG, pg = core.plateG, c = core.container;
        g.clear();
        for (const line of core.riftLines) {   // rifts: one jagged gash through the floor, magma glowing down its middle
            const pts = line.map(([x, y], i) => ({ x: x * T + T / 2 + Math.sin(i * 2.3) * T * 0.12, y: y * T + T / 2 + Math.cos(i * 1.9) * T * 0.12 }));
            if (pts.length < 2) continue;
            const glowA = 0.55 + 0.2 * Math.sin(time * 0.005);
            g.lineStyle(T * 0.75, 0x0c0604, 0.9); g.strokePoints(pts, false);
            g.lineStyle(T * 0.35, 0x7a1e08, 0.9); g.strokePoints(pts, false);
            g.lineStyle(3, 0xff8a2a, glowA); g.strokePoints(pts, false);
            g.lineStyle(1, 0xffe0a0, glowA * 0.8); g.strokePoints(pts, false);
        }
        for (const f of core.faults) {   // a fault: a crack drawn along it, brightening to the eruption, then the eruption
            const k = Math.min(1, (time - f.at) / C.FAULT_TELE), on = time - f.at >= C.FAULT_TELE;
            g.lineStyle(on ? 6 : 1 + 2 * k, on ? 0xffd27a : 0xff6a1a, on ? 0.9 : 0.35 + 0.55 * k);
            g.beginPath();
            f.tiles.forEach(([x, y], i) => { const j = Math.sin(i * 1.7 + f.seed) * T * 0.18, X = x * T + T / 2 + j, Y = y * T + T / 2 - j; if (i) g.lineTo(X, Y); else g.moveTo(X, Y); });
            g.strokePath();
        }
        pg.clear();
        if (!c.visible || core.state === 'vuln' || core.state === 'dive') return;
        const now = time;
        for (const p of core.plates) {   // the shell: a slab of stone each, glowing as it heats, cracked under half, violet while hexed
            if (p.broken) continue;
            const a0 = p.a - Math.PI / core.plates.length * 0.82, a1 = p.a + Math.PI / core.plates.length * 0.82, pts = [];
            for (const [r, a] of [[22, a0], [38, a0 + 0.08], [40, p.a], [38, a1 - 0.08], [22, a1]]) pts.push({ x: c.x + Math.cos(a) * r, y: c.y + Math.sin(a) * r * 0.78 });
            const heat = p.heat / C.HEAT_MAX, base = MenuArt.mix(0x5a5048, 0xff7a2a, heat * 0.85);
            pg.fillStyle(p.hexUntil > now ? MenuArt.mix(base, 0xb07aff, 0.5) : base, 1); pg.fillPoints(pts, true);
            pg.lineStyle(2, p.heat >= C.HEAT_SHOCK ? 0xffd27a : 0x2a221c, 1); pg.strokePoints(pts, true);
            if (p.hp < p.max * C.CRACKED_AT) { pg.lineStyle(1, 0xfff0c8, 0.9); const m = pts[2]; pg.lineBetween(m.x, m.y, (pts[0].x + pts[4].x) / 2, (pts[0].y + pts[4].y) / 2); pg.lineBetween(m.x, m.y, pts[1].x, pts[1].y); }
        }
    }

    createLightningElemental(x, y, tutorialRoomIndex) {
        const e = this.createEnemy(x, y, 90);
        e.tutorialRoomIndex = tutorialRoomIndex;
        e._arcs = true;                    // its arc attack (EnemyManager)
        this._tagResist(e, 'lightning');   // resists lightning (it used to be immune)
        // The only type in the game with no body colour of its own, and the most numerous
        // enemy in The Cistern. Acid yellow rather than the ranged enemy's pale 0xffee88:
        // both are yellow, so they are separated by SATURATION, which survives being
        // glanced at in a crowd better than hue does.
        if (typeof e.sprite.setTint === 'function') e.sprite.setTint(0xe8ff3a);
        e._lightningMark = this._spawnLightningMark(e);
        // Periodic arc attack toward player
        e._arcCooldown = 2500;
        e._lastArcTime = 0;
        // Arc range ring — dashed circle showing 5-tile threat radius
        const ringR = 5 * this.TILE_SIZE;
        const ring = this.add.graphics().setDepth(1.0);
        ring.x = e.sprite.x; ring.y = e.sprite.y;
        const SEGS = 24;
        for (let i = 0; i < SEGS; i++) {
            if (i % 2 === 0) continue; // every other segment → dashed
            const a1 = (i / SEGS) * Math.PI * 2;
            const a2 = ((i + 0.85) / SEGS) * Math.PI * 2;
            ring.lineStyle(1.5, 0xffff44, 0.35);
            ring.beginPath();
            ring.arc(0, 0, ringR, a1, a2, false);
            ring.strokePath();
        }
        this.tweens.add({ targets: ring, alpha: 0.15, duration: 900, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
        e._arcRangeRing = ring;
        return e;
    }

    _spawnLightningMark(enemy) {
        const mark = this.add.graphics().setDepth(3.0);
        mark.x = enemy.sprite.x; mark.y = enemy.sprite.y - 16;
        // Outer glow ring
        mark.lineStyle(1.5, 0xffff44, 0.40); mark.strokeCircle(0, 0, 10);
        // 3 zigzag lightning bolts radiating outward
        const bolts = [0, (2/3)*Math.PI, (4/3)*Math.PI];
        for (const baseA of bolts) {
            mark.lineStyle(2, 0xffff00, 0.95);
            mark.beginPath();
            mark.moveTo(0, 0);
            // zigzag: step out at base angle with offsets
            const r1 = 5, r2 = 9;
            const side = baseA + Math.PI / 2;
            mark.lineTo(Math.cos(baseA)*r1 + Math.cos(side)*2.5, Math.sin(baseA)*r1 + Math.sin(side)*2.5);
            mark.lineTo(Math.cos(baseA)*r2 - Math.cos(side)*2, Math.sin(baseA)*r2 - Math.sin(side)*2);
            mark.strokePath();
            // bright tip dot
            mark.fillStyle(0xffffff, 0.90);
            mark.fillCircle(Math.cos(baseA)*r2 - Math.cos(side)*2, Math.sin(baseA)*r2 - Math.sin(side)*2, 1.5);
        }
        // Centre core
        mark.fillStyle(0xffffff, 1.0); mark.fillCircle(0, 0, 2.5);
        mark.fillStyle(0xffff44, 0.80); mark.fillCircle(0, 0, 4);
        this.tweens.add({ targets: mark, alpha: 0.4, duration: 180, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
        return mark;
    }

    createVoidSniper(x, y, tutorialRoomIndex) {
        const e = this.createEnemy(x, y, 35);
        e.tutorialRoomIndex = tutorialRoomIndex;
        e.isVoidSniper = true;
        e._sniperInvisible = true; // kept for status-immunity guards
        e._inDimension = true;
        e._sniperExiting = false;
        e._sniperVulnerable = false;
        // Stagger first appearance 4-8s
        e._nextDimensionExit = this.time.now + 4000 + Math.random() * 4000;
        // Swap to purple slime sprite
        if (this.anims.exists('purple_idle')) {
            e.sprite.setTexture('slime_purple', 0);
            e.sprite.play('purple_idle');
        }
        // Fully hidden — lives in dimension
        e.sprite.setAlpha(0);
        e.sprite.setTint(0x220044);
        if (e.healthBarBg?.active)   e.healthBarBg.setAlpha(0);
        if (e.healthBarFill?.active) e.healthBarFill.setAlpha(0);
        // Void mark (hidden while in dimension)
        e._voidMark = this._spawnVoidMark(e);
        // Spawn idle portal at starting tile so player can see something exists here
        this._spawnSniperPortal(e, x * this.TILE_SIZE + this.TILE_SIZE / 2, y * this.TILE_SIZE + this.TILE_SIZE / 2 + (this.SLIME_Y_OFFSET || -10));
        return e;
    }

    // ─── SNIPER PORTAL VFX ───────────────────────────────────────────────────
    _spawnSniperPortal(enemy, wx, wy) {
        // Bosses.js: a rift in the floor. It idles half open while the sniper waits in it, opens
        // when it is about to come out (its eyes show in the dark for the last moments), bursts as
        // it does, and swallows the light when it goes back in.
        Sfx.play(this, 'portal');
        if (this._bfxOn && this._bfxSniperRift?.(enemy, wx, wy)) return;
        // Close any existing portal first
        if (enemy._portalGfx?.active) {
            if (enemy._portalSpinTween) { enemy._portalSpinTween.stop(); enemy._portalSpinTween = null; }
            enemy._portalGfx.destroy(); enemy._portalGfx = null;
        }
        const g = this.add.graphics().setDepth(3.2);
        g.x = wx; g.y = wy;
        const R = this.TILE_SIZE * 0.42;
        // Outer ring
        g.lineStyle(3, 0xcc44ff, 0.85); g.strokeCircle(0, 0, R);
        // Inner swirl spokes
        for (let i = 0; i < 8; i++) {
            const a = (i / 8) * Math.PI * 2;
            g.lineStyle(1.5, 0xee88ff, 0.55);
            g.beginPath(); g.moveTo(0, 0); g.lineTo(Math.cos(a) * R * 0.55, Math.sin(a) * R * 0.55); g.strokePath();
        }
        // Dark void centre
        g.fillStyle(0x110022, 0.90); g.fillCircle(0, 0, R * 0.45);
        g.fillStyle(0xcc44ff, 0.60); g.fillCircle(0, 0, R * 0.18);
        // Spin
        const spinTween = this.tweens.add({ targets: g, angle: 360, duration: 1200, repeat: -1 });
        // Pop in
        g.setScale(0.1);
        this.tweens.add({ targets: g, scaleX: 1, scaleY: 1, duration: 280, ease: 'Back.easeOut' });
        enemy._portalGfx = g;
        enemy._portalSpinTween = spinTween;
    }

    _closeSniperPortal(enemy) {
        Sfx.play(this, 'portal', { close: true });
        if (this._bfxOn) this._bfxSniperRiftClose?.(enemy);   // Bosses.js
        if (!enemy._portalGfx?.active) return;
        if (enemy._portalSpinTween) { enemy._portalSpinTween.stop(); enemy._portalSpinTween = null; }
        const g = enemy._portalGfx;
        enemy._portalGfx = null;
        this.tweens.add({
            targets: g, scaleX: 0, scaleY: 0, alpha: 0,
            duration: 220, ease: 'Quad.easeIn',
            onComplete: () => { if (g?.active) g.destroy(); }
        });
    }

    _spawnVoidMark(enemy) {
        const mark = this.add.graphics().setDepth(3.0).setAlpha(0.08);
        mark.x = enemy.sprite.x; mark.y = enemy.sprite.y - 16;
        // Purple crosshair — 4 lines with gap in centre
        const col = 0xcc44ff, colB = 0xee88ff;
        const gap = 3, len = 9;
        mark.lineStyle(2, col, 0.95);
        // cross arms
        mark.beginPath(); mark.moveTo(-gap, 0); mark.lineTo(-len, 0); mark.strokePath();
        mark.beginPath(); mark.moveTo( gap, 0); mark.lineTo( len, 0); mark.strokePath();
        mark.beginPath(); mark.moveTo(0, -gap); mark.lineTo(0, -len); mark.strokePath();
        mark.beginPath(); mark.moveTo(0,  gap); mark.lineTo(0,  len); mark.strokePath();
        // outer circle
        mark.lineStyle(1.5, col, 0.70); mark.strokeCircle(0, 0, len + 2);
        // small tick marks at diagonals
        mark.lineStyle(1, colB, 0.60);
        for (const a of [Math.PI/4, 3*Math.PI/4, 5*Math.PI/4, 7*Math.PI/4]) {
            mark.beginPath();
            mark.moveTo(Math.cos(a)*9, Math.sin(a)*9);
            mark.lineTo(Math.cos(a)*12, Math.sin(a)*12);
            mark.strokePath();
        }
        // centre dot
        mark.fillStyle(colB, 0.90); mark.fillCircle(0, 0, 2);
        this.tweens.add({ targets: mark, alpha: 0.08, duration: 0 }); // starts hidden, shown on reveal
        return mark;
    }

    createQueenSlimePortal(x, y, tutorialRoomIndex, portalId) {
        // portalId was accepted and dropped on the floor; the three call sites pass
        // 1/2/3 and nothing ever received them. Forwarded so the field means something.
        return this.spawnPortal(x, y, tutorialRoomIndex, portalId);
    }

    // ─── QUEEN SLIME PORTAL SYSTEM ───────────────────────────────────────

    // True when `tile` falls inside the queen's hit box — the same orange rectangle
    // drawn around her in spawnPortal, derived from the same two numbers so the picture
    // and the hit test cannot drift apart.
    _portalCoversTile(portal, tileX, tileY) {
        const TS = this.TILE_SIZE;
        const r = portal.hitR ?? TS / 2;
        // Tile centre of the tile being queried.
        const cx = tileX * TS + TS / 2, cy = tileY * TS + TS / 2;
        // Centre of the queen's box. The box hangs off the CONTAINER, which is itself
        // offset by SLIME_Y_OFFSET, so the box sits slightly above her tile centre.
        const qx = portal.tileX * TS + TS / 2;
        const qy = portal.tileY * TS + TS / 2 + (portal.hitOffY || 0);
        return Math.abs(cx - qx) <= r && Math.abs(cy - qy) <= r;
    }

    getPortalAt(tileX, tileY) {
        if (!this.portals) return null;
        // Was `p.tileX === tileX && p.tileY === tileY` — a single tile, for an enemy
        // drawn 3.2 tiles tall whose body centre sits 1.56 tiles ABOVE that tile. Her
        // sprite and her hittable tile did not overlap at all: aiming at the middle of
        // the queen resolved to tileY-2 and every one of the sixteen damage paths in the
        // codebase went through this function, so there was no radius fallback anywhere
        // and she simply could not be hit where she appeared to be.
        return this.portals.find(p => p.active && this._portalCoversTile(p, tileX, tileY)) || null;
    }

    spawnPortal(tileX, tileY, tutorialRoomIndex, portalId) {
        if (!this.portals) this.portals = [];
        const open = (x, y) => { for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) if (this.world?.[x + dx]?.[y + dy] !== this.FLOOR) return false; return true; };
        if (this.world && !open(tileX, tileY)) {   // never in a wall (a room's dressing can stand stone where she was set): the nearest open spot
            let best = null;
            for (let r = 1; r <= 8 && !best; r++) for (let dy = -r; dy <= r && !best; dy++) for (let dx = -r; dx <= r; dx++) {
                if (Math.max(Math.abs(dx), Math.abs(dy)) !== r || !open(tileX + dx, tileY + dy)) continue;
                best = [tileX + dx, tileY + dy]; break;
            }
            if (best) [tileX, tileY] = best;
        }
        const px = tileX * this.TILE_SIZE + this.TILE_SIZE / 2;
        const py = tileY * this.TILE_SIZE + this.TILE_SIZE / 2;

        const container = this.add.container(px, py + (this.SLIME_Y_OFFSET || -10)).setDepth(1.5);

        const shadow = this.add.ellipse(0, 10, 52, 14, 0x000000, 0.25);
        const hpBg = this.add.rectangle(0, -76, 48, 6, 0x330000, 1);
        hpBg.setStrokeStyle(1, 0x000000, 1);
        const hpBar = this.add.rectangle(-24, -76, 48, 6, 0xee2222, 1).setOrigin(0, 0.5);
        const hpLabel = this.add.text(0, -87, 'QUEEN', {
            fontSize: '9px', fontFamily: UIKit.FONT.title, fontStyle: 'bold', color: '#ffc8c8',
            stroke: '#1a0608', strokeThickness: 3, resolution: 2
        }).setOrigin(0.5);

        const sprite = this.add.sprite(0, -40, 'slime_red', 0).setScale(3.2);
        if (this.anims.exists('red_idle')) sprite.play('red_idle');

        const crown = this.add.graphics();
        crown.fillStyle(0xffcc00, 1); crown.fillRect(-13, -38, 26, 8);
        crown.fillTriangle(-13, -38, -10, -52, -6, -38);
        crown.fillTriangle(-3, -38, 0, -54, 3, -38);
        crown.fillTriangle(6, -38, 10, -52, 13, -38);
        crown.fillStyle(0xff2222, 1); crown.fillCircle(-10, -34, 3);
        crown.fillStyle(0x22ffff, 1); crown.fillCircle(0, -34, 3);
        crown.fillStyle(0xff2222, 1); crown.fillCircle(10, -34, 3);
        crown.lineStyle(1.5, 0xaa8800, 1); crown.strokeRect(-13, -38, 26, 8);

        const glow = this.add.rectangle(0, 0, 24, 16, 0xffaa00, 0.2);

        const AMMO_MAX = 10;   // opening burst before she falls back on recharge
        const ammoSegs = [];
        const spawnLabel = this.add.text(0, -66, 'SPAWN', {
            fontSize: '7px', fontFamily: UIKit.FONT.title, fontStyle: 'bold', color: '#ff9a9a',
            stroke: '#1a0608', strokeThickness: 2, resolution: 2
        }).setOrigin(0.5);
        // Laid out from AMMO_MAX instead of the hard-coded `-23 + i * 9`, which was
        // centred for exactly six pips. At ten that ran from -23 to +58 — most of the bar
        // hanging off her right side.
        const PIP_W = 6, PIP_GAP = 1.5, PIP_STEP = PIP_W + PIP_GAP;
        const PIP_X0 = -(AMMO_MAX * PIP_STEP - PIP_GAP) / 2;
        for (let i = 0; i < AMMO_MAX; i++) {
            const sx = PIP_X0 + i * PIP_STEP;
            const bg   = this.add.rectangle(sx, -59, PIP_W, 5, 0x220000, 1).setOrigin(0, 0.5);
            const fill = this.add.rectangle(sx, -59, PIP_W, 5, 0xff4444, 1).setOrigin(0, 0.5);
            ammoSegs.push({ bg, fill, full: true });
            container.add([bg, fill]);
        }

        // THE HIT BOX. This rectangle is the queen's real hurtbox, not decoration —
        // _portalCoversTile reads the same qr and the same container offset, so what is
        // drawn here is exactly what can be hit. Change qr and both move together.
        const qr = this.TILE_SIZE * 1.25;
        const qHitbox = this.add.graphics();
        qHitbox.lineStyle(1.5, 0xff8800, 0.55);
        qHitbox.strokeRect(-qr, -qr, qr * 2, qr * 2);
        container.add([shadow, sprite, crown, glow, hpBg, hpBar, hpLabel, spawnLabel, qHitbox]);
        this.tweens.add({ targets: glow, alpha: 0.45, duration: 400, yoyo: true, repeat: -1 });

        const bobBaseY = py + (this.SLIME_Y_OFFSET || -10);
        this.tweens.add({ targets: container, y: bobBaseY - 6, duration: 700, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });

        const portal = {
            tileX, tileY,
            // ── TUNED AS LIGHTNING'S ENCOUNTER ───────────────────────────
            // She was a 250 HP object that dealt no damage and dripped one 25 HP minion
            // every 4s to a cap of 5 — you out-cleared her roughly 3 to 1, so she was
            // the most harmless thing in the game. The point of her now is VOLUME: an
            // enemy count that fixed-area AoE cannot keep pace with, because clearing a
            // 6-tile arc removes 6 tiles' worth whether the room holds 6 enemies or 20,
            // while chaining scales with how many are actually there.
            //
            // She has to outlive her own brood for that to land, hence the HP: at the
            // free weapon's ~25 DPS she is ~17s of sustained work, and the fight is what
            // happens to you during those 17 seconds.
            hp: 420, maxHp: 420,
            tutorialRoomIndex,
            portalId,
            // Hurtbox, in the same terms the rectangle above is drawn in: half-extent in
            // px, and the y offset of the container the box hangs off.
            hitR: qr, hitOffY: (this.SLIME_Y_OFFSET || -10),
            container, sprite, hpBar, ammoSegs,
            gfxObjs: [container],
            spawnedEnemies: [],
            ammo: AMMO_MAX, ammoMax: AMMO_MAX,
            lastAmmoTime: 0,
            // 900ms, not 4000: sustained ~1.1 minions/sec once the opening burst is spent.
            ammoRecharge: 900,
            spawnRadius: 14,
            // The number that actually creates the encounter. Five was clearable by
            // anything; fourteen is a wall unless you can hit several at once.
            spawnCap: 14,
            pulseInterval: 6000,
            lastPulse: 0,
            _spawning: false,
            active: true,
            _baseScale: 3.2,
        };
        this.portals.push(portal);
        return portal;
    }

    updatePortals(time) {
        if (!this.portals || !this.portals.length) return;
        for (let pi = this.portals.length - 1; pi >= 0; pi--) {
            const queen = this.portals[pi];
            if (!queen.active) continue;
            // Only update when player is in the same room
            if (this.getCurrentPlayerRoom() !== queen.tutorialRoomIndex) continue;

            queen.spawnedEnemies = queen.spawnedEnemies.filter(e => this.enemies.includes(e));

            // Regen is paced by its OWN clock. lastAmmoTime used to be stamped both here
            // and on every spawn, and the check below reads that same field — so a queen
            // that kept spawning restarted her regen timer every time and never got a
            // charge back. Her pressure fell off a cliff instead of sustaining.
            if (queen.lastAmmoTime === 0) queen.lastAmmoTime = time;
            if (queen.ammo < queen.ammoMax && time - queen.lastAmmoTime >= queen.ammoRecharge) {
                queen.ammo = Math.min(queen.ammoMax, queen.ammo + 1);
                queen.lastAmmoTime = time;
            }

            for (let i = 0; i < queen.ammoMax; i++) {
                const seg = queen.ammoSegs[i];
                if (!seg) continue;
                const filled = i < queen.ammo;
                if (filled !== seg.full) { seg.full = filled; seg.fill.setVisible(filled); }
            }

            // Her own attack. Without one she was a stationary object you could stand
            // next to and beat on indefinitely, which is exactly what a pure single-target
            // element wants to do — so the encounter had no answer to it. The pulse makes
            // camping her cost you and pushes you back out into her brood.
            this._queenPulse(queen, time);

            if (!queen._spawning && queen.ammo > 0 && queen.spawnedEnemies.length < queen.spawnCap) {
                const dx = this.playerX - queen.tileX, dy = this.playerY - queen.tileY;
                if (Math.sqrt(dx * dx + dy * dy) <= queen.spawnRadius) {
                    // Spawn ring: the nearest tiles OUTSIDE her hurtbox, nearest first.
                    // The old list was the 8 neighbours, which are now inside her body —
                    // minions would have erupted from the middle of her. Derived from the
                    // footprint rather than hard-coded, so widening qr can never start
                    // spawning them inside her again.
                    if (!queen._spawnRing) {
                        const ring = [];
                        const reach = Math.ceil(queen.hitR / this.TILE_SIZE) + 1;
                        for (let dx = -reach; dx <= reach; dx++) {
                            for (let dy = -reach; dy <= reach; dy++) {
                                if (dx === 0 && dy === 0) continue;
                                if (this._portalCoversTile(queen, queen.tileX + dx, queen.tileY + dy)) continue;
                                ring.push({ x: dx, y: dy, d: dx * dx + dy * dy });
                            }
                        }
                        ring.sort((a, b) => a.d - b.d);
                        queen._spawnRing = ring;
                    }
                    for (const off of queen._spawnRing) {
                        const sx = queen.tileX + off.x, sy = queen.tileY + off.y;
                        if (!this.world[sx] || this.world[sx][sy] !== this.FLOOR) continue;
                        if (this.getEnemyAt(sx, sy)) continue;

                        queen.ammo--;
                        queen._spawning = true;   // pacing is _spawning + the 800ms tell,
                        Sfx.play(this, 'portal');
                                                  // NOT the regen clock (see above)

                        const wpx = sx * this.TILE_SIZE + this.TILE_SIZE / 2;
                        const wpy = sy * this.TILE_SIZE + this.TILE_SIZE / 2;

                        const warn = this.add.text(wpx, wpy - 20, '!', {
                            fontSize: '18px', fontFamily: 'monospace', fontStyle: 'bold',
                            color: '#ff4400', stroke: '#000', strokeThickness: 3
                        }).setOrigin(0.5).setDepth(5);
                        const warnTween = this.tweens.add({
                            targets: warn, scaleX: 1.3, scaleY: 1.3,
                            duration: 200, yoyo: true, repeat: -1
                        });

                        this.tweens.killTweensOf(queen.sprite);
                        this.tweens.add({
                            targets: queen.sprite, scaleX: 2.6, scaleY: 3.8,
                            duration: 350, ease: 'Power2'
                        });

                        this.time.delayedCall(500, () => {
                            warnTween.stop(); warn.destroy();
                            queen._spawning = false;
                            if (!queen.active) return;
                            if (this.world[sx]?.[sy] !== this.FLOOR || this.getEnemyAt(sx, sy)) return;

                            // 32 HP, not 25. Still chaff — two Flame Fists punches — but
                            // it no longer dies to a single tick of anything, so volume is
                            // what you have to solve rather than a formality.
                            const e = this.createEnemy(sx, sy, 32);
                            e.tutorialRoomIndex = queen.tutorialRoomIndex;
                            // The brood closes at 1.7x the speed of everything else in the
                            // game. At the global 1 tile/sec you can simply walk away from
                            // any number of them, which is what made "sheer numbers" an
                            // empty threat: a crowd that cannot reach you is scenery.
                            e._moveCdMult = 0.6;
                            e._queenBrood = true; e._noUlt = true;   // endless: no ult charge off them
                            e.sprite.setTint(0xff8888);
                            queen.spawnedEnemies.push(e);
                            Sfx.play(this, 'spawn');

                            const bs = queen._baseScale || 3.2;
                            this.tweens.killTweensOf(queen.sprite);
                            this.tweens.add({
                                targets: queen.sprite,
                                scaleX: bs * 1.2, scaleY: bs * 0.85,
                                duration: 80, ease: 'Power2',
                                onComplete: () => {
                                    this.tweens.add({
                                        targets: queen.sprite,
                                        scaleX: bs, scaleY: bs,
                                        duration: 120, ease: 'Bounce.easeOut'
                                    });
                                }
                            });
                            const pop = this.add.circle(wpx, wpy, 6, 0xff4444, 0.8).setDepth(3);
                            this.tweens.add({
                                targets: pop, scaleX: 2.5, scaleY: 2.5,
                                alpha: 0, duration: 260,
                                onComplete: () => pop.destroy()
                            });
                        });
                        break;
                    }
                }
            }
        }
    }

    // ── ROYAL PULSE ──────────────────────────────────────────────────────────
    // Telegraphed shockwave on a fixed cadence. Telegraphed, not instant, because the
    // point is to MOVE you rather than to tax you: it is dodgeable on reaction, and
    // dodging it walks you out of melee range and into the brood.
    _queenPulse(queen, time) {
        const RADIUS_TILES = 3.5;
        const DMG          = 14;
        const TELL_MS      = 700;
        if (!queen.lastPulse) queen.lastPulse = time;          // no pulse the instant you walk in
        if (time - queen.lastPulse < (queen.pulseInterval || 6000)) return;
        queen.lastPulse = time;

        const TS = this.TILE_SIZE;
        const px = queen.tileX * TS + TS / 2;
        const py = queen.tileY * TS + TS / 2 + (queen.hitOffY || 0);
        const R  = RADIUS_TILES * TS;

        // Drawn at (0,0) and POSITIONED at the queen, not drawn at her world coords.
        // Phaser scales a Graphics about its own origin, so a circle stroked at (px,py)
        // and then scaled to 0.15 puts its centre at (px*0.15, py*0.15) — the telegraph
        // would expand from the top-left of the map instead of from her.
        const ring = this.add.graphics().setDepth(3.2);
        ring.lineStyle(3, 0xff4466, 0.85);
        ring.strokeCircle(0, 0, R);
        ring.fillStyle(0xff2244, 0.10);
        ring.fillCircle(0, 0, R);
        ring.setPosition(px, py);
        ring.setScale(0.15);
        // Bosses.js: the tiles it reaches (the test below) fill in red while it comes, flash when it
        // lands. The ring stays, unseen: its tween is the pulse's clock.
        const _qm = this._bfxOn ? this._bfxQueenPulse?.(queen, px, py, R, TELL_MS) : null;
        if (_qm) ring.setVisible(false);
        this.showStatusText(px, py - 96, '◎ ROYAL PULSE', '#ff6688');
        Sfx.play(this, 'tell', { ms: TELL_MS, big: true });

        this.tweens.add({
            targets: ring, scaleX: 1, scaleY: 1,
            duration: TELL_MS, ease: 'Quad.easeIn',
            onComplete: () => {
                if (ring.active) {
                    this.tweens.add({ targets: ring, alpha: 0, duration: 180,
                                      onComplete: () => ring.destroy() });
                }
                _qm?.done?.();
                if (!queen.active) return;
                // Tile-space player position, for the same reason the void laser needed it:
                // this.player.y is drawn at SLIME_Y_OFFSET and comparing it to a tile-space
                // circle biases the check by 10px.
                const plx = this.player.x;
                const ply = this.player.y - (this.SLIME_Y_OFFSET || 0);
                if (Math.hypot(plx - px, ply - py) <= R) {
                    this.takeDamage(DMG * (this.enemyDamageScale || 1));
                }
                this.cameras.main.shake(90, 0.005);
                Sfx.play(this, 'pulse');
            }
        });
    }

    damagePortal(portal, damage, opts = {}) {
        damage = this._afterHit(null, null, damage * this._dmgOutMult(null) * this._hitRoll(null));   // your damage, and a hit's roll and extras, as on any enemy
        if (!portal.active) return;
        // opts.src (a projectile): it lands once on this queen, not every frame it overlaps her
        if (opts.src) { const hit = portal._hitBy ||= new WeakSet(); if (hit.has(opts.src)) return; hit.add(opts.src); }
        if (opts.src?.volleyId) damage *= this._volleyMult(portal, opts.src.volleyId);   // a cone of shots on one queen: each after the first counts for less, as on a boss
        Sfx.play(this, 'bosshit', { el: this.currentElement });   // (queens take hits here, not through damageEnemy)
        const time = this.time.now;

        // ── PORTALS USE BRITTLE, NOT FREEZE ──────────────────────────────────
        // This whole block ran the pre-rework ice system long after enemies had moved off it:
        // opts.freeze hard-froze a portal for eight seconds, and the NEXT ice hit shattered it for
        // double damage. So "ice cubes only shatter when their timer expires" held for every enemy
        // in the game except Queen Slime portals -- which, being stationary and in the middle of a
        // fight, are exactly what you end up shooting. That is the shatter that kept appearing.
        //
        // A portal cannot be slowed (it does not move) and stunning it means nothing, so the cube
        // reduces to its damage-amplifier half: BRITTLE, for a fixed window, with no shatter.
        const BRITTLE_MS = 4000;
        if (portal._brittleUntil && time >= portal._brittleUntil) {
            portal._brittleUntil = 0;
            if (portal.sprite?.active) portal.sprite.clearTint();
        }
        if (opts.freeze || opts.chill) {
            const C = (typeof this._iceCubeCfg === 'function') ? this._iceCubeCfg() : { BRITTLE: 1.6 };
            // A pierce spike applies it outright; ordinary chill has to fill the bar first.
            let apply = !!opts.freeze;
            if (!apply) {
                portal.chillStacks = (portal.chillStacks || 0) + 1;
                portal.lastChillTime = time;
                if (portal.chillStacks >= 3) { portal.chillStacks = 0; apply = true; }
            }
            if (apply && !portal._brittleUntil) {
                portal._brittleUntil = time + BRITTLE_MS;
                const px = portal.tileX * this.TILE_SIZE + this.TILE_SIZE / 2;
                const py = portal.tileY * this.TILE_SIZE + this.TILE_SIZE / 2;
                if (portal.sprite?.active) portal.sprite.setTint(0x88ccff);
                this.showStatusText(px, py - 28, 'BRITTLE', '#88eeff');
                if (typeof this.gainUltCharge === 'function') this.gainUltCharge(this.ultChargePerFreeze, 'ice');
                portal._freezeTimer = this.time.delayedCall(BRITTLE_MS, () => {
                    if (portal.active) {
                        portal._brittleUntil = 0;
                        if (portal.sprite?.active) portal.sprite.clearTint();
                    }
                });
            }
        } else if (portal.sprite?.active && !portal._brittleUntil) {
            portal.sprite.setTint(0xaaddff);
            this.time.delayedCall(120, () => {
                if (portal.sprite?.active && !portal._brittleUntil) portal.sprite.clearTint();
            });
        }
        // Amplify rather than consume: brittle lasts its window instead of being spent on one hit.
        if (portal._brittleUntil && time < portal._brittleUntil) {
            const C = (typeof this._iceCubeCfg === 'function') ? this._iceCubeCfg() : { BRITTLE: 1.6 };
            damage *= C.BRITTLE;
        }

        portal.hp -= damage;
        portal.hpBar.width = 48 * Math.max(0, portal.hp / portal.maxHp);

        if (!portal._brittleUntil && portal.sprite?.active && !this._noFlash) {   // (steady ticks skip it)
            // A white FILL: this was setTint(0xffffff), which on a red slime is no change at all,
            // so her hits never showed.
            portal.sprite.setTintFill(0xffffff);
            this.time.delayedCall(70, () => { if (portal.sprite?.active && !portal._brittleUntil) portal.sprite.clearTint(); });
        }

        if (portal.hp <= 0) this._destroyPortal(portal);
    }

    _destroyPortal(portal) {
        portal.active = false;
        Sfx.play(this, 'bossdie');
        // Drop the pending thaw. It is guarded by `if (portal.active)` so it was harmless,
        // but leaving a live 8s timer holding a reference to a dead queen is how the
        // between-run leaks in this codebase start.
        if (portal._freezeTimer) { portal._freezeTimer.remove(); portal._freezeTimer = null; }
        const px = portal.tileX * this.TILE_SIZE + this.TILE_SIZE / 2;
        const py = portal.tileY * this.TILE_SIZE + this.TILE_SIZE / 2;

        this._bfxQueenDeath?.(portal, px, py);   // Bosses.js
        if (!this._bfxOn) for (let i = 0; i < 14; i++) {
            const angle = (i / 14) * Math.PI * 2;
            const blob = this.add.circle(px, py, 4 + Math.random() * 6, 0xff2222, 1).setDepth(4);
            this.tweens.add({
                targets: blob,
                x: px + Math.cos(angle) * (22 + Math.random() * 22),
                y: py + Math.sin(angle) * (22 + Math.random() * 22),
                alpha: 0, scaleX: 0.1, scaleY: 0.1,
                duration: 400 + Math.random() * 150, ease: 'Quad.easeOut',
                onComplete: () => blob.destroy()
            });
        }
        const burst = this.add.circle(px, py, 12, 0xffffff, 0.9).setDepth(4);
        this.tweens.add({ targets: burst, scaleX: 3.5, scaleY: 3.5, alpha: 0, duration: 300, onComplete: () => burst.destroy() });
        this.cameras.main.shake(80, 0.006);
        this.showStatusText(px, py - 40, 'QUEEN SLAIN!', '#ff8888');

        for (const g of portal.gfxObjs) {
            if (g?.active) { this.tweens.killTweensOf(g); g.destroy(); }
        }
        portal.gfxObjs = [];
        const idx = this.portals.indexOf(portal);
        if (idx !== -1) this.portals.splice(idx, 1);
    }

    // ─── VOID SOVEREIGN BOSS ─────────────────────────────────────────────

    spawnVoidSovereignBoss(tileX, tileY) {
        const px = tileX * this.TILE_SIZE + this.TILE_SIZE / 2;
        const py = tileY * this.TILE_SIZE + this.TILE_SIZE / 2;
        const offsetY = this.SLIME_Y_OFFSET || -10;

        const container = this.add.container(px, py + offsetY).setDepth(3);

        // Body — purple slime sprite scaled up
        const body = this.add.sprite(0, -70, 'slime_purple', 0).setScale(5.0);
        body.setTint(0x6600aa); // darken to deep void purple
        if (this.anims.exists('purple_idle')) body.play('purple_idle');

        // Void crown — orbiting dark particles
        const crownGfx = this.add.graphics();
        this._drawVoidCrown(crownGfx);

        // Orbiting void ring
        const orbitRing = this.add.graphics();
        orbitRing.lineStyle(3, 0x6600aa, 0.70); orbitRing.strokeCircle(0, -70, 55);
        orbitRing.lineStyle(1.5, 0xcc44ff, 0.45); orbitRing.strokeCircle(0, -70, 48);

        // Shadow
        const shadow = this.add.ellipse(0, 8, 72, 20, 0x000000, 0.35);

        // HP bar
        const hpBg = this.add.rectangle(0, -88, 88, 9, 0x110022, 1);
        hpBg.setStrokeStyle(1, 0x000000, 1);
        const hpBar = this.add.rectangle(-44, -88, 88, 9, 0xaa22ff, 1).setOrigin(0, 0.5);
        const hpLabel = this.add.text(0, -100, 'VOID SOVEREIGN', {
            fontSize: '9px', fontFamily: 'monospace', color: '#cc88ff',
            stroke: '#000', strokeThickness: 2, fontStyle: 'bold'
        }).setOrigin(0.5);

        // Debug hitbox — shows the ±2 tile damage range (5×5 tiles, centred on tileX/tileY)
        const hitboxRing = this.add.graphics();
        hitboxRing.lineStyle(1.5, 0xff44ff, 0.55);
        const hr = 2 * this.TILE_SIZE; // half the 5-tile box
        hitboxRing.strokeRect(-hr, -hr, hr * 2, hr * 2 - this.TILE_SIZE);
        container.add([shadow, hpBg, hpBar, hpLabel, orbitRing, body, crownGfx, hitboxRing]);

        const baseY = py + offsetY;
        const idleBobTween = this.tweens.add({ targets:container, y:baseY - 10, duration:1200, yoyo:true, repeat:-1, ease:'Sine.easeInOut' });
        // Rotate orbitRing continuously
        this.tweens.add({ targets:orbitRing, angle:360, duration:4000, repeat:-1, ease:'Linear' });

        // Orbiting particle debris — 8 void shards
        const debris = [];
        for (let i = 0; i < 8; i++) {
            const d = this.add.graphics().setDepth(3.5);
            d.fillStyle(i % 2 === 0 ? 0x9922cc : 0xcc44ff, 0.85);
            d.fillCircle(0, 0, 3 + (i % 3));
            container.add(d);
            debris.push({ gfx:d, angle:(i / 8) * Math.PI * 2, radius: 55 + (i % 3) * 6 });
        }

        this.voidSovereignBoss = {
            tileX, tileY, hp: 3000, maxHp: 3000, isBoss: true,
            container, body, hpBar, orbitRing, crownGfx, debris,
            active: true, phase: 'waiting',
            _baseY: baseY, _activated: false, _idleBobTween: idleBobTween,
            _attackQueue: [], _attackIndex: 0,
            _pillarPositions: [[6,59],[24,59],[6,74],[24,74]], // destroyable at 60%
            _pillarsDestroyed: false,
            _phase2Unlocked: false,
            _phase3Unlocked: false,
            _voidMines: [],
            _laserGfx: null,
            _gravityHole: null,
            _fragmentOrbs: [],
            _isInvulnerable: false,
            _singWaveId: 0,
        };

        // Debris orbit update timer
        this.time.addEvent({
            delay: 30, loop: true,
            callback: () => {
                const boss = this.voidSovereignBoss;
                if (!boss?.active) return;
                boss.debris.forEach(d => {
                    d.angle += 0.025;
                    d.gfx.x = Math.cos(d.angle) * d.radius;
                    d.gfx.y = -70 + Math.sin(d.angle) * d.radius * 0.5;
                });
            }
        });
    }

    _drawVoidCrown(g) {
        g.clear();
        g.fillStyle(0xcc44ff, 0.90);
        g.fillRect(-18, -108, 36, 10);
        g.fillTriangle(-18,-108,-14,-128,-9,-108);
        g.fillTriangle(-4,-108, 0,-132, 4,-108);
        g.fillTriangle( 9,-108, 14,-128, 18,-108);
        g.fillStyle(0xffffff, 0.70);
        g.fillCircle(-13,-104, 4); g.fillCircle(0,-104, 4); g.fillCircle(13,-104, 4);
        g.lineStyle(1.5, 0x880099, 1); g.strokeRect(-18,-108,36,10);
    }

    _updateVoidSovereign(time) {
        const boss = this.voidSovereignBoss;
        if (!boss?.active) return;

        // Sync tile position
        boss.tileX = Math.floor(boss.container.x / this.TILE_SIZE);
        boss.tileY = Math.floor(boss.container.y / this.TILE_SIZE);

        // Track freeze visual position
        if (boss._isFrozen && boss._bossProxy?.freezeVisuals) {
            const fbx = boss.container.x;
            const fby = boss.container.y - 20;
            const fv  = boss._bossProxy.freezeVisuals;
            if (fv.iceBlock)  { fv.iceBlock.x  = fbx; fv.iceBlock.y  = fby; }
            if (fv.iceBorder) { fv.iceBorder.x = fbx; fv.iceBorder.y = fby; }
        }

        // Update HP bar
        const hpPct = Math.max(0, boss.hp / boss.maxHp);
        boss.hpBar.width = 88 * hpPct;
        const hpCol = hpPct > 0.6 ? 0xaa22ff : hpPct > 0.3 ? 0xff6600 : 0xff2200;
        boss.hpBar.setFillStyle(hpCol);

        // Update boss burn stack pip positions
        if (boss._burnStackBar) {
            const bx = boss.container.x;
            const by = boss.container.y - 130;
            const stacks = boss._burnStackBar.length;
            const GAP = 8, W = 8;
            const totalW = stacks * W + (stacks - 1) * GAP;
            for (let i = 0; i < stacks; i++) {
                const pip = boss._burnStackBar[i];
                if (!pip?.active) continue;
                pip.x = bx - totalW / 2 + i * (W + GAP) + W / 2;
                pip.y = by;
            }
        }

        // Phase transitions
        if (!boss._phase2Unlocked && hpPct <= 0.60) {
            boss._phase2Unlocked = true;
            this._voidSovereignPhase2Transition();
        }
        if (!boss._phase3Unlocked && hpPct <= 0.30) {
            boss._phase3Unlocked = true;
        }

        // Update void mines — tick timers and handle detonation
        for (let i = boss._voidMines.length - 1; i >= 0; i--) {
            const mine = boss._voidMines[i];
            if (!mine.gfx?.active) { boss._voidMines.splice(i, 1); continue; }
            const elapsed = time - mine.spawnTime;
            const progress = Math.min(elapsed / mine.duration, 1);

            // Draw sweep arc (Bosses.js: the tiles it catches, filling in, and a clock round it)
            if (this._bfxOn) this._bfxDrawMine?.(mine, progress, time);
            else {
                mine.gfx.clear();
                mine.gfx.fillStyle(0x110022, 0.85); mine.gfx.fillCircle(0, 0, mine.radius * this.TILE_SIZE);
                mine.gfx.lineStyle(2, 0x220044, 0.80); mine.gfx.strokeCircle(0, 0, mine.radius * this.TILE_SIZE);
                mine.gfx.fillStyle(0x9922cc, 0.70); mine.gfx.fillCircle(0, 0, 6);
            }
            // Sweep arc
            if (progress < 1 && !this._bfxOn) {
                mine.gfx.lineStyle(3, 0xff44ff, 0.90);
                mine.gfx.beginPath();
                mine.gfx.arc(0, 0, mine.radius * this.TILE_SIZE - 3, -Math.PI/2, -Math.PI/2 + progress * Math.PI * 2, false);
                mine.gfx.strokePath();
            }

            if (progress >= 1) {
                // DETONATE
                this._voidMineDetonate(mine, time);
                mine.gfx.destroy();
                boss._voidMines.splice(i, 1);
            }
        }

        // Gravity hole pull
        if (boss._gravityHole?.active) {
            const gh = boss._gravityHole;
            const now = time;
            if (now - (gh._lastPull || 0) >= 800) {
                gh._lastPull = now;
                const ghTX = Math.floor(gh.x / this.TILE_SIZE);
                const ghTY = Math.floor(gh.y / this.TILE_SIZE);
                const dx = ghTX - this.playerX, dy = ghTY - this.playerY;
                if (Math.sqrt(dx*dx + dy*dy) <= 6 && !this._playerRooted && (this._iceShellUntil || 0) <= this.time.now) {   // (not through the ice ult's shell)
                    const pullX = this.playerX + Math.sign(dx);
                    const pullY = this.playerY + Math.sign(dy);
                    if (this.world[pullX]?.[pullY] === this.FLOOR) {
                        this.playerX = pullX; this.playerY = pullY;
                        this.player.x = pullX * this.TILE_SIZE + this.TILE_SIZE / 2;
                        this.player.y = pullY * this.TILE_SIZE + this.TILE_SIZE / 2 + this.SLIME_Y_OFFSET;
                    }
                }
            }
            if (time >= gh._expiresAt) {
                this.tweens.killTweensOf(gh); gh.destroy();
                boss._gravityHole = null;
            }
        }
    }

    _voidMineDetonate(mine, time) {
        const radiusPx = mine.radius * this.TILE_SIZE;
        const px = this.player.x, py = this.player.y;
        const dx = px - mine.gfx.x, dy = py - mine.gfx.y;

        // Explosion visual
        this._bfxMineBlast?.(mine);   // Bosses.js: its tiles flash, a ring opens to its reach
        const exp = this.add.graphics().setDepth(5).setVisible(!this._bfxOn);
        exp.x = mine.gfx.x; exp.y = mine.gfx.y;
        exp.fillStyle(0x9922cc, 0.55); exp.fillCircle(0, 0, radiusPx * 1.5);
        exp.fillStyle(0xffffff, 0.85); exp.fillCircle(0, 0, radiusPx * 0.4);
        exp.lineStyle(3, 0xcc44ff, 0.90); exp.strokeCircle(0, 0, radiusPx);
        this.tweens.add({ targets:exp, scaleX:1.8, scaleY:1.8, alpha:0, duration:400, ease:'Quad.easeOut', onComplete:()=>exp.destroy() });
        this.cameras.main.shake(50, 0.005);
        Sfx.play(this, 'boom');

        if (Math.sqrt(dx*dx + dy*dy) <= radiusPx) {
            this.takeDamage(10 * this.enemyDamageScale);
            this._rootPlayer(3000, time);
        }
        this._damageTowersInPixelRadius(mine.gfx.x, mine.gfx.y, radiusPx, 10 * this.damageScaling);
    }

    // ── CROWD CONTROL ON YOU ─────────────────────────────────────────────────
    // Every hard effect an enemy puts on you (a root, being grounded, dragged under, pulled, crushed) asks here first.
    // One at a time: while one holds, another can't land, and when it ends you have CC_IMMUNE ms to get away before
    // the next can (a pale shimmer on you while it lasts). Damage still lands; only the hold is refused. True if it may.
    _ccGate(ms) {
        const now = this.time.now, CC_IMMUNE = 1200;
        if (now < (this._ccImmuneUntil || 0)) {
            if (this.player?.active && now - (this._ccResistMsg || 0) > 700) { this._ccResistMsg = now; this.showStatusText(this.player.x, this.player.y - 30, 'RESISTED', '#e8f0ff'); }
            return false;
        }
        this._ccImmuneUntil = now + ms + CC_IMMUNE;
        this.time.delayedCall(ms, () => {   // free: the shimmer of the window you have
            const p = this.player; if (!p?.active) return;
            const sh = this.add.sprite(p.x, p.y, p.texture.key, p.frame.name).setOrigin(p.originX, p.originY).setScale(p.scaleX * 1.15, p.scaleY * 1.15).setFlipX(p.flipX).setTintFill(0xe8f0ff).setBlendMode(Phaser.BlendModes.ADD).setDepth((p.depth ?? 1) + 0.02).setAlpha(0.6);
            this.tweens.add({ targets: sh, alpha: 0, scaleX: p.scaleX * 1.4, scaleY: p.scaleY * 1.4, duration: CC_IMMUNE, onUpdate: () => sh.setPosition(p.x, p.y), onComplete: () => sh.destroy() });
        });
        return true;
    }
    _rootPlayer(duration, time) {
        if (!this._ccGate(duration)) return;
        this._playerRooted = true;
        Sfx.play(this, 'status', { kind: 'root' });
        this._playerRootUntil = (time || this.time.now) + duration;
        // Bosses.js: tendrils come up round you: thorned roots from a rooter, void from the Sovereign
        this._bfxRootT0 = this.time.now; this._bfxRootKind = this._bfxRootNext || 'void'; this._bfxRootNext = null;
        if (this.player?.active) this.player.setTint(0x9922cc);
        const rootTxt = this.add.text(this.player.x, this.player.y - 28, 'ROOTED', {
            fontSize: '10px', fontFamily: 'monospace', color: '#cc44ff',
            stroke: '#000', strokeThickness: 2, fontStyle: 'bold'
        }).setOrigin(0.5).setDepth(10);
        this.tweens.add({ targets:rootTxt, y:rootTxt.y - 14, alpha:0, duration:duration * 0.6, onComplete:()=>rootTxt.destroy() });
        this.time.delayedCall(duration, () => {
            if (this.player?.active) this.player.clearTint();
            this._playerRooted = false;
        });
    }

    _voidSovereignNextAttack() {
        const boss = this.voidSovereignBoss;
        if (!boss?.active) return;

        // Phase 1 attacks
        const p1 = ['voidMines', 'singularitySlimes', 'laserCross'];
        // Phase 2 adds darkFragments + stomp — weighted 2× so they appear more often
        const p2 = [...p1, 'darkFragments', 'darkFragments', 'stomp', 'stomp'];
        // Phase 3 adds singularityCollapse + eventHorizon + voidMaw — weighted 2× alongside boosted p2 attacks
        const p3 = [...p1, 'darkFragments', 'darkFragments', 'stomp', 'stomp',
                          'singularityCollapse', 'singularityCollapse', 'eventHorizon', 'eventHorizon',
                          'voidMaw', 'voidMaw'];

        const pool = boss._phase3Unlocked ? p3 : boss._phase2Unlocked ? p2 : p1;

        // Pick random attack that isn't the same as last
        let attack;
        do { attack = pool[Math.floor(Math.random() * pool.length)]; }
        while (attack === boss._lastAttack && pool.length > 1);
        boss._lastAttack = attack;

        const pauseBetween = boss._phase3Unlocked ? 900 : boss._phase2Unlocked ? 1300 : 1800;

        this.time.delayedCall(pauseBetween, () => {
            if (!boss.active) return;
            this._voidSovereignDoAttack(attack);
        });
    }

    _voidSovereignDoAttack(attack) {
        const boss = this.voidSovereignBoss;
        if (!boss?.active) return;
        if      (attack === 'voidMines')          this._vsAttackVoidMines();
        else if (attack === 'singularitySlimes')   this._vsAttackSingularitySlimes();
        else if (attack === 'laserCross')          this._vsAttackLaserCross();
        else if (attack === 'darkFragments')       this._vsAttackDarkFragments();
        else if (attack === 'stomp')               this._vsAttackStomp();
        else if (attack === 'singularityCollapse') this._vsAttackSingularityCollapse();
        else if (attack === 'eventHorizon')        this._vsAttackEventHorizon();
        else if (attack === 'voidMaw')             this._vsAttackVoidMaw();
    }

    // ─── BOSS ATTACKS ────────────────────────────────────────────────────

    _vsAttackVoidMines() {
        const boss = this.voidSovereignBoss;
        (this._bfxCallout || this.showStatusText).call(this, boss.container.x, boss.container.y - 80, '☠ VOID MINES', '#cc44ff');
        Sfx.play(this, 'tell', { ms: 600, big: true });
        this.cameras.main.shake(30, 0.003);
        const bossRoomBounds = this.rooms[6];

        // Rhythmic waves: 2 mines per tick, 600ms between ticks, 3 waves with a pause
        const waveCounts = boss._phase3Unlocked ? [5, 5, 5] : boss._phase2Unlocked ? [4, 4, 4] : [3, 3, 3];
        const tickInterval = 550;   // ms between each pair of mines within a wave
        const wavePause    = 1800;  // ms gap between waves
        const mineDuration = 1200;  // how fast each mine detonates

        const spawnMine = () => {
            if (!boss.active) return;
            // Always bias to player position so both mines land near you
            for (let m = 0; m < 2; m++) {
                let tx, ty, attempts = 0;
                const biased = Math.random() < 0.75;
                do {
                    if (biased) {
                        const spread = 1 + Math.floor(Math.random() * 4);
                        tx = this.playerX + Math.floor((Math.random() * 2 - 1) * spread);
                        ty = this.playerY + Math.floor((Math.random() * 2 - 1) * spread);
                        tx = Math.max(bossRoomBounds.x + 1, Math.min(bossRoomBounds.x + bossRoomBounds.w - 2, tx));
                        ty = Math.max(bossRoomBounds.y + 1, Math.min(bossRoomBounds.y + bossRoomBounds.h - 2, ty));
                    } else {
                        tx = bossRoomBounds.x + 2 + Math.floor(Math.random() * (bossRoomBounds.w - 4));
                        ty = bossRoomBounds.y + 2 + Math.floor(Math.random() * (bossRoomBounds.h - 4));
                    }
                    attempts++;
                } while ((this.world[tx]?.[ty] !== this.FLOOR || (Math.abs(tx - this.playerX) < 1 && Math.abs(ty - this.playerY) < 1)) && attempts < 30);

                const mpx = tx * this.TILE_SIZE + this.TILE_SIZE / 2;
                const mpy = ty * this.TILE_SIZE + this.TILE_SIZE / 2;
                const mineGfx = this.add.graphics().setDepth(2);
                mineGfx.x = mpx; mineGfx.y = mpy;
                boss._voidMines.push({ gfx: mineGfx, spawnTime: this.time.now, duration: mineDuration, radius: 2.5 });
                Sfx.play(this, 'mine');

                const flash = this.add.circle(mpx, mpy, 8, 0x9922cc, 0.8).setDepth(4);
                this.tweens.add({ targets: flash, radius: 20, alpha: 0, duration: 200, onComplete: () => flash.destroy() });
            }
        };

        let totalDelay = 0;
        for (let w = 0; w < waveCounts.length; w++) {
            const ticks = waveCounts[w];
            for (let t = 0; t < ticks; t++) {
                const delay = totalDelay + t * tickInterval;
                this.time.delayedCall(delay, spawnMine);
            }
            totalDelay += ticks * tickInterval + wavePause;
        }

        // Next attack after all waves finish + last mine detonates
        this.time.delayedCall(totalDelay + mineDuration + 200, () => this._voidSovereignNextAttack());
    }

    _vsAttackSingularitySlimes() {
        const boss = this.voidSovereignBoss;
        (this._bfxCallout || this.showStatusText).call(this, boss.container.x, boss.container.y - 80, '☄ SINGULARITY SLIMES', '#cc44ff');
        Sfx.play(this, 'tell', { ms: 600, big: true });
        this.cameras.main.shake(30, 0.003);

        const bossRoom = this.rooms[6];
        const count = boss._phase3Unlocked ? 18 : boss._phase2Unlocked ? 13 : 8;
        const waveId = ++boss._singWaveId;    // unique ID for this wave

        for (let i = 0; i < count; i++) {
            this.time.delayedCall(i * 200, () => {
                if (!boss.active || boss._singWaveId !== waveId) return;
                let tx, ty, attempts = 0;
                do {
                    tx = bossRoom.x + 2 + Math.floor(Math.random() * (bossRoom.w - 4));
                    ty = bossRoom.y + 2 + Math.floor(Math.random() * (bossRoom.h - 4));
                    attempts++;
                } while ((this.world[tx]?.[ty] !== this.FLOOR) && attempts < 30);

                const spx = tx * this.TILE_SIZE + this.TILE_SIZE / 2;
                const spy = ty * this.TILE_SIZE + this.TILE_SIZE / 2;
                const flash = this.add.circle(spx, spy, 14, 0xcc44ff, 0.8).setDepth(5);
                this.tweens.add({ targets: flash, scaleX: 2.5, scaleY: 2.5, alpha: 0, duration: 280, onComplete: () => flash.destroy() });

                const slime = this.createSingularitySlime(tx, ty, 6);
                slime._singWaveId = waveId; Sfx.play(this, 'spawn');   // tag with this wave
            });
        }

        // Cleanup: only kill slimes from THIS wave
        this.time.delayedCall(8000, () => {
            if (!boss.active) return;
            // Don't kill survivors — they stay in the arena and keep pressuring the player
            this._voidSovereignNextAttack();
        });
    }

    createSingularitySlime(x, y, tutorialRoomIndex) {
        const e = this.createEnemy(x, y, 50);
        e.tutorialRoomIndex = tutorialRoomIndex;
        e.isSingularitySlime = true;
        e._singState    = 'idle';
        e._singLastAtk  = 0;
        e._singCooldown = 2800;
        e._singChargeDur = 700;
        e._singChargeStart = 0;

        // Swap to purple sprite with dark cosmic tint
        if (this.anims.exists('purple_idle')) {
            e.sprite.setTexture('slime_purple', 0);
            e.sprite.play('purple_idle');
        }
        e.sprite.setTint(0x440088);

        // ! mark — hidden until charging
        const markGfx = this.add.graphics().setDepth(3.5).setAlpha(0);
        markGfx.fillStyle(0xcc44ff, 1.0);
        markGfx.fillRect(-3, -12, 6, 9);
        markGfx.fillRect(-3,  -1, 6, 6);
        markGfx.lineStyle(1, 0xee88ff, 0.80);
        markGfx.strokeRect(-3, -12, 6, 9);
        markGfx.strokeRect(-3,  -1, 6, 6);
        markGfx.x = e.sprite.x;
        markGfx.y = e.sprite.y - 26;
        e._singMark = markGfx;
        // Bosses.js: its slam's danger tiles (floor only) fill over the wind-up, and go if it dies mid-way
        this._bfxSingList?.push(e);

        return e;
    }

    _vsAttackLaserCross() {
        const boss = this.voidSovereignBoss;
        (this._bfxCallout || this.showStatusText).call(this, boss.container.x, boss.container.y - 80, '▦ LASER GRID', '#ff44ff');
        Sfx.play(this, 'laser_charge', { ms: 900 });
        this.cameras.main.shake(30, 0.004);

        const bossRoom = this.rooms[6];
        const roomX1 = bossRoom.x * this.TILE_SIZE;
        const roomY1 = bossRoom.y * this.TILE_SIZE;
        const roomX2 = (bossRoom.x + bossRoom.w) * this.TILE_SIZE;
        const roomY2 = (bossRoom.y + bossRoom.h) * this.TILE_SIZE;
        const roomCX = (roomX1 + roomX2) / 2;
        const TS = this.TILE_SIZE;

        const LASER_DMG = 14 * this.damageScaling;
        const WARN_DUR  = 1400;
        const HOLD_DUR  = 2400;
        const BEAM_HALF = TS * 0.20; // tight hitbox — laser is visually 3px wide

        // ── THE PLAYER'S LOGICAL POSITION, NOT ITS SPRITE POSITION ───────────
        // this.player.y is drawn at tileCentreY + SLIME_Y_OFFSET (-10px) so the slime
        // sits nicely in its tile. Every line below is laid out on the TILE grid, so
        // reading the sprite's y compares two different coordinate spaces.
        //
        // That is fatal specifically here, because this is the only attack whose hitbox
        // is TIGHTER than the offset: clearance from a tile centre to the nearest line
        // is 16px, the offset eats 10 of it, and BEAM_HALF is 6.4px. 6 < 6.4, so 45% of
        // the tiles in the arena became unavoidable hits while the beam still LOOKED
        // 10px away. The radius-based attacks share the bias but have thresholds wide
        // enough that it only shifts them slightly.
        //
        // Subtracting the offset rather than recomputing from this.playerY keeps the
        // check smooth during the 100ms step tween instead of teleporting between tiles.
        const hitX = () => this.player.x;
        const hitY = () => this.player.y - (this.SLIME_Y_OFFSET || 0);

        // ── Liang-Barsky clip to room ─────────────────────────────────────────
        const clipSeg = (x1, y1, x2, y2) => {
            let t0 = 0, t1 = 1;
            const dx = x2-x1, dy = y2-y1;
            for (const [p,q] of [[-dx,x1-roomX1],[dx,roomX2-x1],[-dy,y1-roomY1],[dy,roomY2-y1]]) {
                if (p === 0) { if (q < 0) return null; continue; }
                const r = q/p;
                if (p < 0) t0 = Math.max(t0,r); else t1 = Math.min(t1,r);
            }
            if (t0 > t1) return null;
            return [x1+t0*dx, y1+t0*dy, x1+t1*dx, y1+t1*dy];
        };

        // ── Draw segments ─────────────────────────────────────────────────────
        const drawSegs = (gfx, segs, col, alpha) => {
            // Bosses.js: dashes while it warns; live, a band exactly as wide as BEAM_HALF, a beam, a hot core
            if (this._bfxOn) return this._bfxBeams?.(gfx, segs, col, alpha, BEAM_HALF);
            gfx.clear();
            gfx.lineStyle(3, col, alpha);
            for (const [x1,y1,x2,y2] of segs) { gfx.beginPath(); gfx.moveTo(x1,y1); gfx.lineTo(x2,y2); gfx.strokePath(); }
            gfx.lineStyle(1, 0xffffff, alpha * 0.65);
            for (const [x1,y1,x2,y2] of segs) { gfx.beginPath(); gfx.moveTo(x1,y1); gfx.lineTo(x2,y2); gfx.strokePath(); }
        };

        // ── Hit check ─────────────────────────────────────────────────────────
        const checkHit = (segs) => {
            const px = hitX(), py = hitY();
            for (const [x1,y1,x2,y2] of segs) {
                if (Utils.distancePointToSegment(px,py,x1,y1,x2,y2) < BEAM_HALF) {
                    this.takeDamage((LASER_DMG) * (this.enemyDamageScale || 1)); return;
                }
            }
            if (this.engineerTowers?.length) {
                for (const tower of this.engineerTowers) {
                    if (!tower.active) continue;
                    for (const [x1,y1,x2,y2] of segs) {
                        if (Utils.distancePointToSegment(tower.px, tower.py, x1,y1,x2,y2) < BEAM_HALF) {
                            this.damageEngineerTower(tower, LASER_DMG);
                            break;
                        }
                    }
                }
            }
        };

        // ── Flicker then lock in ──────────────────────────────────────────────
        const flickerIn = (gfx, segs, col, cb) => {
            let n = 0;
            const ft = this.time.addEvent({ delay: 120, loop: true, callback: () => {
                n++;
                if (n % 2 === 0) drawSegs(gfx, segs, col, 0.40); else gfx.clear();
                if (n > 6) ft.delay = 65;
            }});
            this.time.delayedCall(WARN_DUR, () => {
                if (!boss.active) { ft.remove(); return; }
                ft.remove(); drawSegs(gfx, segs, col, 0.92);
                this.cameras.main.shake(25, 0.003); Sfx.play(this, 'laser_fire'); cb();
            });
        };

        // ── Fade out then continue ────────────────────────────────────────────
        const fadeOut = (gfx, dt, next) => {
            if (dt) dt.remove();
            this.tweens.add({ targets: gfx, alpha: 0, duration: 220,
                onComplete: () => { if (gfx?.active) gfx.destroy(); this.time.delayedCall(300, next); }
            });
        };

        // ── Random angle grid — two independent angle families, spacing in tiles ─
        const buildRandomGrid = (spacingTiles) => {
            const spacing = spacingTiles * TS;
            // Two random angles, guaranteed not near-parallel (>25° apart)
            const a1 = Math.random() * Math.PI;
            const a2 = a1 + Math.PI * (0.22 + Math.random() * 0.56);
            const ext = Math.max(roomX2-roomX1, roomY2-roomY1) * 2;
            const segs = [];
            for (const angle of [a1, a2]) {
                const cos = Math.cos(angle), sin = Math.sin(angle);
                const perpCos = -sin, perpSin = cos;
                // Bias offset so a gap lands near player
                const px = hitX() - roomCX, py = hitY() - ((roomY1+roomY2)/2);
                const playerPerp = px * perpCos + py * perpSin;
                const baseOff = ((playerPerp % spacing) + spacing) % spacing;
                const offset = (baseOff + spacing * 0.55) % spacing;
                for (let d = -ext + offset; d < ext; d += spacing) {
                    const ox = roomCX + perpCos * d, oy = (roomY1+roomY2)/2 + perpSin * d;
                    const c = clipSeg(ox - cos*ext, oy - sin*ext, ox + cos*ext, oy + sin*ext);
                    if (c) segs.push(c);
                }
            }
            return segs;
        };

        // ── Pattern 3: closing grid — 3 layers, flicker before each ──────────
        // Base 5 tiles → 2.5 → 1.25 — survivable but tight
        const runClosing = (gfx, ox, oy, onDone) => {
            // All lines snapped to tile boundaries — spacing in whole tiles
            // Layer 0: every 4 tiles (3 tile gaps)
            // Layer 1: bisect to every 2 tiles (1 tile gap) — always survivable
            const BASE_TILES = 4;
            const BASE = BASE_TILES * TS;

            // Snap ox/oy to nearest tile boundary so lines always land on tile edges
            const snappedOX = Math.round(ox / TS) * TS;
            const snappedOY = Math.round(oy / TS) * TS;

            const squareLayer = (spacingTiles, offX, offY) => {
                const spacing = spacingTiles * TS;
                const s = [];
                for (let y = roomY1 + offY; y < roomY2; y += spacing) s.push([roomX1, y, roomX2, y]);
                for (let x = roomX1 + offX; x < roomX2; x += spacing) s.push([x, roomY1, x, roomY2]);
                return s;
            };

            let allSegs = squareLayer(BASE_TILES, snappedOX, snappedOY);
            let dmgTimer = this.time.addEvent({ delay: 200, loop: true,
                callback: () => { if (boss.active) checkHit(allSegs); }
            });

            drawSegs(gfx, allSegs, 0xff22ff, 0.92);

            let layer = 0;
            const LAYERS = 2; // base + 1 bisect — final spacing 2 tiles (1-tile safe gaps)
            const LAYER_HOLD = 1200;

            const addLayer = () => {
                if (!boss.active) { dmgTimer.remove(); onDone(); return; }
                layer++;
                // Bisect: new lines fall exactly halfway between existing ones (2-tile spacing)
                // Offset by BASE_TILES/2 tiles from base — guaranteed to land on tile edge
                const halfTiles = BASE_TILES / Math.pow(2, layer);
                const newSegs = squareLayer(BASE_TILES / Math.pow(2, layer - 1),
                    snappedOX + halfTiles * TS, snappedOY + halfTiles * TS);

                // Flicker the new lines in
                const flashGfx = this.add.graphics().setDepth(4.1);
                let fn = 0;
                const ft = this.time.addEvent({ delay: 100, loop: true, callback: () => {
                    fn++;
                    if (fn % 2 === 0) drawSegs(flashGfx, newSegs, 0xffffff, 0.55); else flashGfx.clear();
                    if (fn > 5) ft.delay = 55;
                }});
                this.cameras.main.shake(18 + layer * 8, 0.003);
                Sfx.play(this, 'laser_charge', { ms: 800 });

                this.time.delayedCall(800, () => {
                    if (!boss.active) { ft.remove(); flashGfx.destroy(); dmgTimer.remove(); onDone(); return; }
                    ft.remove(); flashGfx.destroy();
                    allSegs = [...allSegs, ...newSegs];
                    drawSegs(gfx, allSegs, 0xff22ff, 0.92);
                    this.cameras.main.shake(28, 0.004);
                    Sfx.play(this, 'laser_fire');

                    if (layer < LAYERS - 1) {
                        this.time.delayedCall(LAYER_HOLD, addLayer);
                    } else {
                        this.time.delayedCall(HOLD_DUR, () => { dmgTimer.remove(); onDone(); });
                    }
                });
            };

            this.time.delayedCall(LAYER_HOLD, addLayer);
        };

        // ── Pattern 1: random angle, 3-tile spacing ───────────────────────────
        const runP1 = () => {
            if (!boss.active) return;
            this.showStatusText(roomCX, roomY1 + TS, '⚠ FIND THE GAP', '#ff44ff');
            const segs = buildRandomGrid(3);
            const g = this.add.graphics().setDepth(4);
            flickerIn(g, segs, 0xff44ff, () => {
                const dt = this.time.addEvent({ delay: 200, loop: true, callback: () => { if (boss.active) checkHit(segs); } });
                this.time.delayedCall(HOLD_DUR, () => fadeOut(g, dt, runP2));
            });
        };

        // ── Pattern 2: different random angle, 2.5-tile spacing ──────────────
        const runP2 = () => {
            if (!boss.active) return;
            this.showStatusText(roomCX, roomY1 + TS, '⚠ FIND THE GAP', '#cc44ff');
            const segs = buildRandomGrid(2.5);
            const g = this.add.graphics().setDepth(4);
            flickerIn(g, segs, 0xcc44ff, () => {
                const dt = this.time.addEvent({ delay: 200, loop: true, callback: () => { if (boss.active) checkHit(segs); } });
                this.time.delayedCall(HOLD_DUR, () => fadeOut(g, dt, runP3));
            });
        };

        // ── Pattern 3: closing grid ───────────────────────────────────────────
        const runP3 = () => {
            if (!boss.active) return;
            this.showStatusText(roomCX, roomY1 + TS, '▦ CLOSING GRID', '#ff2200');
            const g = this.add.graphics().setDepth(4);
            // Flicker the base layer in first — snapped to tile grid
            const BASE = 4 * TS;
            const px = hitX() - roomX1, py = hitY() - roomY1;
            const rawOX = (Math.round(px / BASE) * BASE - TS * 0.6 + BASE * 10) % BASE;
            const rawOY = (Math.round(py / BASE) * BASE - TS * 0.6 + BASE * 10) % BASE;
            const ox = Math.round(rawOX / TS) * TS;
            const oy = Math.round(rawOY / TS) * TS;
            const baseSegs = [];
            for (let y = roomY1 + oy; y < roomY2; y += BASE) baseSegs.push([roomX1, y, roomX2, y]);
            for (let x = roomX1 + ox; x < roomX2; x += BASE) baseSegs.push([x, roomY1, x, roomY2]);
            flickerIn(g, baseSegs, 0xff2200, () => {
                runClosing(g, ox, oy, () => {
                    if (g?.active) g.destroy();
                    this.time.delayedCall(600, () => this._voidSovereignNextAttack());
                });
            });
        };

        runP1();
    }



    _vsAttackDarkFragments() {
        const boss = this.voidSovereignBoss;
        boss._isInvulnerable = true;
        (this._bfxCallout || this.showStatusText).call(this, boss.container.x, boss.container.y - 80, '◈ DARK MATTER FRAGMENTS', '#9922cc');
        Sfx.play(this, 'tell', { ms: 600, big: true });
        boss.container.setVisible(false);

        const bossRoom = this.rooms[6];
        const cx = (bossRoom.x + bossRoom.w/2) * this.TILE_SIZE;
        const cy = (bossRoom.y + bossRoom.h/2) * this.TILE_SIZE;
        const ORBIT_R = 9 * this.TILE_SIZE;
        const fragCount = 4;
        const fragmentsHP = [1, 1, 1, 1];
        const fragmentsHit = [false, false, false, false];
        const fragGfxList = [];
        let fragAngle = 0;
        let fragsAlive = 4;
        const phaseStart = this.time.now;

        // Escalation — every 5s without a kill, orbits faster and ripples hurt more
        const escalateTimer = this.time.addEvent({
            delay: 5000, loop: true,
            callback: () => {
                if (fragsAlive <= 0) return;
                const elapsed = Math.floor((this.time.now - phaseStart) / 5000);
                // Increase orbit speed
                const orbitBoost = 0.004 * elapsed;
                fragGfxList.forEach(fg => { if (fg._alive) fg._orbitSpeedBoost = orbitBoost; });
                // Flash warning
                if (elapsed >= 2) {
                    this.showStatusText(cx, cy - 60, '⚠ ESCALATING!', '#ff4400');
                    this.cameras.main.shake(30, 0.004);
                }
            }
        });

        for (let i = 0; i < fragCount; i++) {
            // Bosses.js: a crystal of void that turns as it orbits, its reach (1.2 tiles) ringed
            const fg = (this._bfxOn ? this._bfxFragment?.() : null) || this.add.graphics().setDepth(3.5);
            if (fg.clear) {
                fg.fillStyle(0x9922cc, 0.90); fg.fillCircle(0, 0, 14);
                fg.fillStyle(0xcc44ff, 0.70); fg.fillCircle(0, 0, 8);
                fg.fillStyle(0xffffff, 0.85); fg.fillCircle(0, 0, 4);
                fg.lineStyle(2, 0x6600aa, 0.80); fg.strokeCircle(0, 0, 14);
            }
            fg._hp = fragmentsHP[i];
            fg._index = i;
            fg._alive = true;

            // Health bar — bg and fill as separate Graphics
            const hpBg   = this.add.rectangle(0, -22, 28, 4, 0x220033, 1).setDepth(3.6);
            const hpFill = this.add.rectangle(0, -22, 28, 4, 0xcc44ff, 1).setDepth(3.7).setOrigin(0.5, 0.5);
            hpBg.setStrokeStyle(1, 0x000000, 0.8);
            fg._hpBg   = hpBg;
            fg._hpFill = hpFill;

            fragGfxList.push(fg);

            // Fragment fires ripples periodically
            fg._rippleTimer = this.time.addEvent({
                delay: 2000 + i * 300, loop: true,
                callback: () => {
                    if (!fg._alive || !fg.active) return;
                    const elapsed = (this.time.now - phaseStart) / 5000; // 5s intervals
                    const dmgMult = 1 + Math.floor(elapsed) * 0.5; // +50% per 5s
                    this._spawnVoidRipple(fg.x, fg.y, 6, 80, 12 * this.damageScaling * dmgMult, false);
                }
            });
        }

        // Orbit update
        const orbitTimer = this.time.addEvent({
            delay: 30, loop: true,
            callback: () => {
                const speedBoost = fragGfxList.reduce((max, fg) => Math.max(max, fg._orbitSpeedBoost || 0), 0);
                fragAngle += 0.018 + speedBoost;
                fragGfxList.forEach((fg, i) => {
                    if (!fg._alive) return;
                    const a = fragAngle + (i / fragCount) * Math.PI * 2;
                    fg.x = cx + Math.cos(a) * ORBIT_R;
                    fg.y = cy + Math.sin(a) * ORBIT_R;
                    // Update health bar position and width
                    if (fg._hpBg?.active)   { fg._hpBg.x   = fg.x; fg._hpBg.y   = fg.y - 22; }
                    if (fg._hpFill?.active && tempEnemies?.[i]) {
                        const pct = Math.max(0, tempEnemies[i].health / tempEnemies[i].maxHealth);
                        fg._hpFill.x = fg.x - 14 + (28 * pct) / 2; // left-align origin adjustment
                        fg._hpFill.y = fg.y - 22;
                        fg._hpFill.width = 28 * pct;
                        const col = pct > 0.6 ? 0xcc44ff : pct > 0.3 ? 0xff8800 : 0xff2222;
                        fg._hpFill.setFillStyle(col);
                    }
                    // Hit detection vs player
                    const dx = this.player.x - fg.x, dy = this.player.y - fg.y;
                    if (Math.sqrt(dx*dx + dy*dy) < this.TILE_SIZE * 1.2) {
                        this.takeDamage(15 * this.enemyDamageScale);
                    }
                    this._damageTowersInPixelRadius(fg.x, fg.y, this.TILE_SIZE * 1.2, 15 * this.damageScaling);
                });
            }
        });

        // Fragment hit detection — check if player's projectiles hit them
        // We expose them to the damage system via enemies array temporarily
        const tempEnemies = fragGfxList.map((fg, i) => {
            const te = {
                x: Math.floor(cx / this.TILE_SIZE), y: Math.floor(cy / this.TILE_SIZE),
                sprite: fg, health: 1, maxHealth: 1,
                healthBarBg: null, healthBarFill: null,
                isFrozen: false, frozenUntil: 0, frozenByTsunami: false,
                isSlowed: false, slowedUntil: 0, lastMoveTime: 0,
                isStunned: false, stunnedUntil: 0, brittleStacks: 0,
                isBurning: false, burnUntil: 0, lastBurnTick: 0, burnVisual: null,
                isSuperConducted: false, superConductUntil: 0, superConductVisual: null,
                combustionTriggered: false, cosmicMarks: 0, cosmicMarkVisuals: null,
                _fragmentIndex: i, isFragment: true,
            };
            this.enemies.push(te);
            return te;
        });

        // Helper: destroy all lingering marks on a fragment temp enemy
        const cleanFragMarks = (te) => {
            ['_purpleMarkVisual', '_shatterMarkVisual', '_goldMark', '_purpleMark',
             '_fireMark', '_iceMark', '_lightningMark', '_voidMark'].forEach(k => {
                if (te[k]?.active) { this.tweens?.killTweensOf(te[k]); te[k].destroy(); te[k] = null; }
            });
            if (te.freezeVisuals) {
                if (te.freezeVisuals._extraLayers) { for (const l of te.freezeVisuals._extraLayers) { this.tweens?.killTweensOf(l); l.destroy(); } }
                ['iceBlock','iceBorder'].forEach(k => { if (te.freezeVisuals[k]) { this.tweens?.killTweensOf(te.freezeVisuals[k]); te.freezeVisuals[k].destroy(); } });
                te.freezeVisuals = null;
            }
            if (te._chillBar?.active) { te._chillBar.destroy(); } te._chillBar = null;
        };

        const checkFragmentsDead = () => {
            fragsAlive--;
            if (fragsAlive <= 0) {
                escalateTimer.remove();
                // All fragments destroyed — reassemble boss
                orbitTimer.remove();
                fragGfxList.forEach(fg => {
                    if (fg._rippleTimer) fg._rippleTimer.remove();
                    if (fg._hpBg?.active)   fg._hpBg.destroy();
                    if (fg._hpFill?.active) fg._hpFill.destroy();
                    fg.destroy();
                });
                tempEnemies.forEach(te => {
                    cleanFragMarks(te);
                    const idx = this.enemies.indexOf(te);
                    if (idx !== -1) this.enemies.splice(idx, 1);
                });
                boss.container.setVisible(true);
                boss._isInvulnerable = false;
                // Vulnerable window — 4s of 2× damage
                boss._vulnerableUntil = this.time.now + 4000;
                (this._bfxCallout || this.showStatusText).call(this, boss.container.x, boss.container.y - 80, '💥 VULNERABLE! 2× DAMAGE', '#ff4444');
                Sfx.play(this, 'ready');
                const vFlash = this.add.circle(boss.container.x, boss.container.y, 8, 0xff4444, 0.5).setDepth(5);
                this.tweens.add({ targets:vFlash, radius:60, alpha:0, duration:400, onComplete:()=>vFlash.destroy() });
                this.time.delayedCall(4500, () => this._voidSovereignNextAttack());
            }
        };

        // Watch fragment health via update
        const watchTimer = this.time.addEvent({
            delay: 100, loop: true,
            callback: () => {
                tempEnemies.forEach((te, i) => {
                    if (!fragGfxList[i]._alive) return;
                    if (te.health <= 0) {
                        fragGfxList[i]._alive = false;
                        if (fragGfxList[i]._rippleTimer) fragGfxList[i]._rippleTimer.remove();
                        this.tweens.killTweensOf(fragGfxList[i]);
                        if (fragGfxList[i]._hpBg?.active)   fragGfxList[i]._hpBg.destroy();
                        if (fragGfxList[i]._hpFill?.active) fragGfxList[i]._hpFill.destroy();
                        this._bfxShatter?.(fragGfxList[i].x, fragGfxList[i].y);   // Bosses.js
                        fragGfxList[i].destroy();
                        cleanFragMarks(te);
                        const idx = this.enemies.indexOf(te);
                        if (idx !== -1) this.enemies.splice(idx, 1);
                        checkFragmentsDead();
                    }
                });
                if (fragsAlive <= 0) watchTimer.remove();
            }
        });
    }

    _vsAttackStomp() {
        const boss = this.voidSovereignBoss;
        (this._bfxCallout || this.showStatusText).call(this, boss.container.x, boss.container.y - 80, '⬆ STOMP INCOMING', '#ff4444');
        Sfx.play(this, 'swing');

        // Pause the idle bob tween so it doesn't fight over container.y during the stomp sequence
        if (boss._idleBobTween) boss._idleBobTween.pause();

        // Boss flies up (scale down + fade)
        this.tweens.add({ targets:boss.container, scaleY:0.1, alpha:0.1, duration:600, ease:'Quad.easeIn' });

        this.time.delayedCall(700, () => {
            if (!boss.active) return;
            boss.container.setVisible(false);

            // Tracking circle follows player
            const trackGfx = this.add.graphics().setDepth(4.5);
            const TRACK_DUR = 2500;
            const startTime = this.time.now;
            let circleX = this.player.x, circleY = this.player.y;

            const trackTimer = this.time.addEvent({
                delay: 30, loop: true,
                callback: () => {
                    const elapsed = this.time.now - startTime;
                    if (elapsed >= TRACK_DUR) { trackTimer.remove(); return; }
                    // Snap to player's tile centre for accurate targeting
                    circleX = this.playerX * this.TILE_SIZE + this.TILE_SIZE / 2;
                    circleY = this.playerY * this.TILE_SIZE + this.TILE_SIZE / 2;
                    trackGfx.clear();
                    // Bosses.js: the tiles it will crush (read against your sprite, as the hit is), its shadow growing
                    if (this._bfxOn) { this._bfxStompTrack?.(trackGfx, circleX, circleY, elapsed / TRACK_DUR); return; }
                    trackGfx.lineStyle(3, 0xff2200, 0.85); trackGfx.strokeCircle(circleX, circleY, 2.5 * this.TILE_SIZE);
                    trackGfx.lineStyle(1, 0xff6600, 0.50); trackGfx.strokeCircle(circleX, circleY, 1.5 * this.TILE_SIZE);
                    // Crosshair lines
                    trackGfx.lineStyle(1.5, 0xff2200, 0.70);
                    trackGfx.beginPath(); trackGfx.moveTo(circleX - 3*this.TILE_SIZE, circleY); trackGfx.lineTo(circleX + 3*this.TILE_SIZE, circleY); trackGfx.strokePath();
                    trackGfx.beginPath(); trackGfx.moveTo(circleX, circleY - 3*this.TILE_SIZE); trackGfx.lineTo(circleX, circleY + 3*this.TILE_SIZE); trackGfx.strokePath();
                }
            });

            // After tracking, pause — escape window
            this.time.delayedCall(TRACK_DUR, () => {
                if (!boss.active) return;
                trackTimer.remove();
                const finalX = circleX, finalY = circleY;
                // Flash the circle rapidly — escape window 0.8s
                let flashing = true;
                const escapeFlash = this.time.addEvent({ delay:80, repeat:10, callback: () => trackGfx.setVisible(!trackGfx.visible) });
                this.showStatusText(finalX, finalY - 40, 'MOVE!', '#ff2200');

                this.time.delayedCall(800, () => {
                    const _stompTiles = trackGfx._bfxTiles;
                    escapeFlash.remove(); trackGfx.destroy();
                    if (!boss.active) return;

                    // STOMP — land exactly where the circle was
                    boss.container.setVisible(true);
                    boss.container.x = finalX;
                    boss.container.y = finalY + (this.SLIME_Y_OFFSET || -10);
                    boss.container.scaleY = 0.1; boss.container.alpha = 1;
                    this.tweens.add({ targets:boss.container, scaleY:1, duration:220, ease:'Bounce.easeOut' });
                    Sfx.play(this, 'slam');
                    this.cameras.main.shake(180, 0.018);

                    this._bfxStompLand?.(finalX, finalY, 2.5 * this.TILE_SIZE, _stompTiles);   // Bosses.js: the tiles flash, cracks
                    const stompRing = this.add.circle(finalX, finalY, 8, 0xff2200, 0.7).setDepth(5).setVisible(!this._bfxOn);
                    stompRing.setStrokeStyle(4, 0xff6600, 1);
                    this.tweens.add({ targets:stompRing, radius:4*this.TILE_SIZE, alpha:0, duration:400, onComplete:()=>stompRing.destroy() });

                    // Damage player if nearby
                    const dx = this.player.x - finalX, dy = this.player.y - finalY;
                    if (Math.sqrt(dx*dx + dy*dy) <= 2.5 * this.TILE_SIZE) {
                        this.takeDamage(40 * this.enemyDamageScale);
                        this._rootPlayer(2000, this.time.now);
                    }
                    this._damageTowersInPixelRadius(finalX, finalY, 2.5 * this.TILE_SIZE, 40 * this.damageScaling);

                    // Boss returns to original position
                    this.time.delayedCall(600, () => {
                        const bossSpawn = this.rooms[6];
                        const homeX = (bossSpawn.x + bossSpawn.w/2) * this.TILE_SIZE;
                        const homeY = boss._baseY; // use the stored home Y (matches idle bob anchor exactly)
                        this.tweens.add({
                            targets: boss.container, x: homeX, y: homeY, duration: 700, ease: 'Quad.easeOut',
                            onComplete: () => {
                                if (boss._idleBobTween && !boss._idleBobTween.isDestroyed()) boss._idleBobTween.resume();
                            }
                        });
                        this.time.delayedCall(1200, () => this._voidSovereignNextAttack());
                    });
                });
            });
        });
    }

    // ── VOID MAW — boss sinks into a giant portal, reappears flanking the player, ──
    // ── then unleashes a wide shotgun wave of ricocheting pellets ───────────────
    // Void Maw — boss teleports via portal 4 times in one attack, firing an all-around
    // burst at each landing spot. First hop is slow/telegraphed; hops 2-4 ramp up faster.
    _vsAttackVoidMaw() {
        const boss = this.voidSovereignBoss;
        (this._bfxCallout || this.showStatusText).call(this, boss.container.x, boss.container.y - 80, '◉ VOID MAW OPENING', '#cc44ff');
        Sfx.play(this, 'portal');
        if (boss._idleBobTween) boss._idleBobTween.pause();
        this._voidMawHop(boss, 0, boss.container.x, boss.container.y);
    }

    // Performs one teleport-and-fire hop, then either chains to the next hop or returns
    // the boss home after the final one. hopIndex 0 = first (slow) hop, 1-3 = faster hops.
    _voidMawHop(boss, hopIndex, fromX, fromY) {
        const TOTAL_HOPS = 4;
        if (!boss?.active) return;

        // Timing ramps up after the first hop — shorter telegraphs, more pressure
        const isFirst = hopIndex === 0;
        const PORTAL_OPEN_DUR = isFirst ? 1400 : 700;
        const TRAVEL_PAUSE    = isFirst ? 900  : 450;
        const ARRIVE_OPEN_DUR = isFirst ? 900  : 500;
        const RETURN_PAUSE_AFTER_FIRE = isFirst ? 900 : 550;

        const PORTAL_R = 1.6 * this.TILE_SIZE;

        // ── Sink portal at current position ──
        const portalGfx = this.add.graphics().setDepth(2.0);
        portalGfx.x = fromX; portalGfx.y = fromY;
        let portalAngle = 0;
        const drawGiantPortal = (scale) => {
            portalGfx.clear();
            const r = PORTAL_R * scale;
            portalGfx.lineStyle(5, 0xcc44ff, 0.85); portalGfx.strokeCircle(0, 0, r);
            for (let i = 0; i < 10; i++) {
                const a = portalAngle + (i / 10) * Math.PI * 2;
                portalGfx.lineStyle(2, 0xee88ff, 0.50);
                portalGfx.beginPath(); portalGfx.moveTo(0, 0); portalGfx.lineTo(Math.cos(a) * r * 0.6, Math.sin(a) * r * 0.6); portalGfx.strokePath();
            }
            portalGfx.fillStyle(0x110022, 0.92); portalGfx.fillCircle(0, 0, r * 0.55);
            portalGfx.fillStyle(0xcc44ff, 0.55); portalGfx.fillCircle(0, 0, r * 0.22);
        };
        drawGiantPortal(0.05);
        const portalSpinTimer = this.time.addEvent({ delay: 30, loop: true, callback: () => { portalAngle += 0.04; } });
        // Bosses.js: a rift in the floor under it (the drawing stays, unseen, for its timing)
        const _rift = this._bfxOn ? this._bfxRift?.(fromX, fromY - (this.SLIME_Y_OFFSET || -10), PORTAL_R, { ms: PORTAL_OPEN_DUR, big: true }) : null;
        if (_rift) portalGfx.setVisible(false);

        const openStart = this.time.now;
        const portalGrowTimer = this.time.addEvent({
            delay: 30, loop: true,
            callback: () => {
                const t = Math.min((this.time.now - openStart) / PORTAL_OPEN_DUR, 1);
                drawGiantPortal(0.05 + t * 0.95);
                if (t >= 1) portalGrowTimer.remove();
            }
        });

        this.tweens.add({ targets: boss.container, scaleX: 0.15, scaleY: 0.15, alpha: 0.15, duration: PORTAL_OPEN_DUR, ease: 'Quad.easeIn' });

        this.time.delayedCall(PORTAL_OPEN_DUR + 150, () => {
            if (!boss.active) { portalSpinTimer.remove(); portalGfx.destroy(); return; }
            boss.container.setVisible(false);
            if (_rift) this._bfxRiftClose?.(_rift, 400);
            Sfx.play(this, 'portal', { close: true });

            this.tweens.add({
                targets: portalGfx, scaleX: 0.05, scaleY: 0.05, alpha: 0, duration: 400, ease: 'Quad.easeIn',
                onComplete: () => { portalSpinTimer.remove(); portalGfx.destroy(); }
            });

            // ── Travel beneath the arena ──
            this.time.delayedCall(TRAVEL_PAUSE, () => {
                if (!boss.active) return;

                // Pick a new flanking tile near the player (re-rolled every hop)
                const flanks = [];
                for (let ddx = -3; ddx <= 3; ddx++) {
                    for (let ddy = -3; ddy <= 3; ddy++) {
                        const md = Math.abs(ddx) + Math.abs(ddy);
                        if (md < 2 || md > 3) continue;
                        const tx2 = this.playerX + ddx, ty2 = this.playerY + ddy;
                        if (tx2 < 0 || tx2 >= this.WORLD_WIDTH || ty2 < 0 || ty2 >= this.WORLD_HEIGHT) continue;
                        if (this.world[tx2][ty2] !== this.FLOOR) continue;
                        if (!this.isInCurrentRoom(tx2, ty2)) continue;
                        flanks.push({ x: tx2, y: ty2 });
                    }
                }
                let pick = flanks.length ? flanks[Math.floor(Math.random() * flanks.length)] : { x: this.playerX, y: this.playerY };
                const wx = pick.x * this.TILE_SIZE + this.TILE_SIZE / 2;
                const wy = pick.y * this.TILE_SIZE + this.TILE_SIZE / 2 + (this.SLIME_Y_OFFSET || -10);

                // Re-open the giant portal at the new position
                const arrivePortal = this.add.graphics().setDepth(2.0);
                arrivePortal.x = wx; arrivePortal.y = wy;
                let arriveAngle = 0;
                const drawArrivePortal = (scale) => {
                    arrivePortal.clear();
                    const r = PORTAL_R * scale;
                    arrivePortal.lineStyle(5, 0xcc44ff, 0.85); arrivePortal.strokeCircle(0, 0, r);
                    for (let i = 0; i < 10; i++) {
                        const a = arriveAngle + (i / 10) * Math.PI * 2;
                        arrivePortal.lineStyle(2, 0xee88ff, 0.50);
                        arrivePortal.beginPath(); arrivePortal.moveTo(0, 0); arrivePortal.lineTo(Math.cos(a) * r * 0.6, Math.sin(a) * r * 0.6); arrivePortal.strokePath();
                    }
                    arrivePortal.fillStyle(0x110022, 0.92); arrivePortal.fillCircle(0, 0, r * 0.55);
                    arrivePortal.fillStyle(0xcc44ff, 0.55); arrivePortal.fillCircle(0, 0, r * 0.22);
                };
                drawArrivePortal(0.05);
                const arriveSpinTimer = this.time.addEvent({ delay: 30, loop: true, callback: () => { arriveAngle += 0.04; } });
                const _rift2 = this._bfxOn ? this._bfxRift?.(wx, wy - (this.SLIME_Y_OFFSET || -10), PORTAL_R, { ms: ARRIVE_OPEN_DUR, big: true }) : null;
                if (_rift2) { arrivePortal.setVisible(false); _rift2.exitAt = this.time.now + ARRIVE_OPEN_DUR; }

                this.showStatusText(wx, wy - 70, hopIndex < TOTAL_HOPS - 1 ? `⚠ MAW SURFACING (${hopIndex + 1}/${TOTAL_HOPS})` : '⚠ MAW SURFACING — FINAL', '#ff2200');

                const arriveOpenStart = this.time.now;
                const arriveGrowTimer = this.time.addEvent({
                    delay: 30, loop: true,
                    callback: () => {
                        const t = Math.min((this.time.now - arriveOpenStart) / ARRIVE_OPEN_DUR, 1);
                        drawArrivePortal(0.05 + t * 0.95);
                        if (t >= 1) arriveGrowTimer.remove();
                    }
                });

                this.time.delayedCall(ARRIVE_OPEN_DUR, () => {
                    if (!boss.active) { arriveSpinTimer.remove(); arrivePortal.destroy(); return; }

                    boss.container.x = wx; boss.container.y = wy;
                    boss.container.setVisible(true);
                    boss.container.scaleX = 0.1; boss.container.scaleY = 0.1; boss.container.alpha = 1;
                    this.tweens.add({ targets: boss.container, scaleX: 1, scaleY: 1, duration: 300, ease: 'Back.easeOut' });
                    Sfx.play(this, 'portal'); Sfx.play(this, 'slam', { small: true });
                    this.cameras.main.shake(100, 0.010);

                    if (_rift2) this._bfxRiftClose?.(_rift2, 350, true);
                    this.tweens.add({
                        targets: arrivePortal, scaleX: 0.05, scaleY: 0.05, alpha: 0, duration: 350, ease: 'Quad.easeIn',
                        onComplete: () => { arriveSpinTimer.remove(); arrivePortal.destroy(); }
                    });

                    // ── All-around burst — fires in every direction, not aimed at the player ──
                    this.time.delayedCall(250, () => {
                        if (!boss.active) return;
                        this._fireVoidMawShotgun(boss);

                        const nextHop = hopIndex + 1;
                        this.time.delayedCall(RETURN_PAUSE_AFTER_FIRE, () => {
                            if (!boss.active) return;
                            if (nextHop < TOTAL_HOPS) {
                                // Chain to the next hop from this landing spot
                                this._voidMawHop(boss, nextHop, boss.container.x, boss.container.y);
                            } else {
                                // Final hop done — return home
                                const bossSpawn = this.rooms[6];
                                const returnHomeX = (bossSpawn.x + bossSpawn.w / 2) * this.TILE_SIZE;
                                const returnHomeY = boss._baseY;
                                this.tweens.add({
                                    targets: boss.container, x: returnHomeX, y: returnHomeY, duration: 700, ease: 'Quad.easeOut',
                                    onComplete: () => { if (boss._idleBobTween && !boss._idleBobTween.isDestroyed()) boss._idleBobTween.resume(); }
                                });
                                this.time.delayedCall(1200, () => this._voidSovereignNextAttack());
                            }
                        });
                    });
                });
            });
        });
    }

    // All-around burst fired by Void Maw — pellets spread across the FULL 360°,
    // not aimed at the player, so positioning around the boss matters at every landing.
    _fireVoidMawShotgun(boss) {
        const ex = boss.container.x, ey = boss.container.y;
        const PELLETS = 16;
        const SPEED = 230; // medium speed, dodgeable
        const DAMAGE = 11;
        const MAX_DIST = this.TILE_SIZE * 9;

        // Big muzzle flash
        const flash = this.add.graphics().setDepth(4);
        flash.x = ex; flash.y = ey;
        flash.fillStyle(0xcc44ff, 0.85); flash.fillCircle(0, 0, 26);
        flash.lineStyle(3, 0xffffff, 0.90); flash.strokeCircle(0, 0, 34);
        this.tweens.add({ targets: flash, scaleX: 2.2, scaleY: 2.2, alpha: 0, duration: 240, ease: 'Quad.easeOut', onComplete: () => flash.destroy() });
        if (this._bfxOn) { flash.setVisible(false); BossFX.muzzle(this, 'maw', ex, ey, 0, true); }   // Bosses.js
        this.cameras.main.shake(70, 0.008);

        if (!this.enemyProjectiles) this.enemyProjectiles = [];

        for (let i = 0; i < PELLETS; i++) {
            const angle = (i / PELLETS) * Math.PI * 2; // even spread, full circle
            const vx = Math.cos(angle) * SPEED;
            const vy = Math.sin(angle) * SPEED;

            const g = this.add.graphics().setDepth(2.8);
            g.lineStyle(3, 0xdd66ff, 1);
            g.beginPath();
            g.moveTo(-Math.cos(angle) * 6, -Math.sin(angle) * 6);
            g.lineTo( Math.cos(angle) * 6,  Math.sin(angle) * 6);
            g.strokePath();
            g.fillStyle(0xffffff, 0.9); g.fillCircle(0, 0, 3);
            g.x = ex; g.y = ey;

            this.enemyProjectiles.push({
                gfx: this._bfxSwap ? this._bfxSwap(g, 'maw', angle) : g, vx, vy, damage: DAMAGE * (this.enemyDamageScale || 1),
                startX: ex, startY: ey, maxDist: MAX_DIST,
                isRicochetArrow: true, ricochetLeft: 5,
                _bfxKind: 'maw',   // they bounce like darts but are the maw's: drawn, lit and popped in its violet
            });
        }
    }

    _vsAttackSingularityCollapse() {
        const boss = this.voidSovereignBoss;
        boss._isInvulnerable = true;
        const _bossOrigDepth = boss.container.depth;
        (this._bfxCallout || this.showStatusText).call(this, boss.container.x, boss.container.y - 80, '◉ SINGULARITY COLLAPSE', '#220044');
        Sfx.play(this, 'tell', { ms: 1200, big: true });
        this.cameras.main.shake(40, 0.004);

        const bossRoom = this.rooms[6];
        const cx = (bossRoom.x + bossRoom.w / 2) * this.TILE_SIZE;
        const cy = (bossRoom.y + bossRoom.h / 2) * this.TILE_SIZE;
        const centerTX = Math.floor(cx / this.TILE_SIZE);
        const centerTY = Math.floor(cy / this.TILE_SIZE);

        // Full screen darkness — fades in ominously, held until collapse. Covers player/enemies
        // (depth ~1) but NOT the boss itself, which is lifted above the overlay so it stays
        // visible — the void sovereign is the source of the dark, not a victim of it.
        // Bosses.js: the dark in the world (pinned, it went to the HUD camera: it hid the boss and
        // dimmed the HUD), you and the boss lit above it, the tiles the pull can reach glowing and
        // the ones behind walls (cover) outlined. 9000: COLLAPSE_DURATION, declared below.
        const dark = (this._bfxOn ? this._bfxCollapseStart?.(cx, cy, 9000) : null) || this.add.rectangle(this.scale.width/2, this.scale.height/2,
            this.scale.width, this.scale.height, 0x000000, 1).setScrollFactor(0).setDepth(15).setAlpha(0);
        this.tweens.add({ targets: dark, alpha: 0.72, duration: 2000, ease: 'Quad.easeIn' });
        boss.container.setDepth(16);

        // Inward-sucking particles — intensify exponentially as collapse nears
        const COLLAPSE_DURATION = 9000; // total time before the killing collapse fires
        const particleInterval = this.time.addEvent({
            delay: 200, loop: true,
            callback: () => {
                if (!boss?.active) return;
                const elapsed = this.time.now - collapseStartTime;
                const tLin = Math.min(elapsed / COLLAPSE_DURATION, 1);
                const t = Math.pow(tLin, 3); // cubic — stays mild early, ramps hard late
                // More particles + faster travel as we near collapse
                const count = Math.floor(2 + t * 10);
                const travelDur = Math.max(250, 1200 - t * 950);
                for (let i = 0; i < count; i++) {
                    const a = Math.random() * Math.PI * 2;
                    const r = 4 * this.TILE_SIZE + Math.random() * 6 * this.TILE_SIZE;
                    const pg = this.add.graphics().setDepth(16);
                    const col = t > 0.6 ? 0xff44ff : 0xcc44ff;
                    pg.fillStyle(col, 0.70 + t * 0.25);
                    pg.fillCircle(0, 0, 2 + Math.random() * 3 + t * 2);
                    pg.x = cx + Math.cos(a) * r; pg.y = cy + Math.sin(a) * r;
                    this.tweens.add({ targets: pg, x: cx, y: cy, alpha: 0, duration: travelDur, ease: 'Quad.easeIn', onComplete: () => pg.destroy() });
                }
            }
        });
        const collapseStartTime = this.time.now;

        // ── Gradual player suck — starts slow, accelerates EXPONENTIALLY over the duration ──
        // Moves player toward center periodically; interval shrinks exponentially, and the
        // distance pulled per tick also grows late in the sequence for a true "falling in" feel.
        // LOS check each tick — walls block the pull.
        let _suckTimer = null;
        const _scheduleNextSuck = (delay) => {
            _suckTimer = this.time.delayedCall(delay, () => {
                if (!boss?.active) return;
                const elapsed = this.time.now - collapseStartTime;
                if (elapsed >= COLLAPSE_DURATION) return; // collapse fires, stop gradual suck

                // LOS check — wall blocks pull
                const playerPx = this.player.x, playerPy = this.player.y;
                const dxC = cx - playerPx, dyC = cy - playerPy;
                const steps = Math.ceil(Math.sqrt(dxC*dxC + dyC*dyC) / (this.TILE_SIZE * 0.5));
                let blocked = false;
                for (let s = 1; s <= steps; s++) {
                    const t2 = s / steps;
                    const checkX = Math.floor((playerPx + dxC * t2) / this.TILE_SIZE);
                    const checkY = Math.floor((playerPy + dyC * t2) / this.TILE_SIZE);
                    if (this.world[checkX]?.[checkY] === this.WALL) { blocked = true; break; }
                }

                const tLin = Math.min(elapsed / COLLAPSE_DURATION, 1);
                const t = Math.pow(tLin, 3); // matches particle ramp — mild early, brutal late

                if (!blocked && (this._iceShellUntil || 0) <= this.time.now) {   // (not through the ice ult's shell)
                    // Pull distance grows from 1 tile up to 3 tiles per tick as collapse nears
                    const pullTiles = Math.max(1, Math.round(1 + t * 2));
                    const ddx = centerTX - this.playerX;
                    const ddy = centerTY - this.playerY;
                    const dist = Math.sqrt(ddx*ddx + ddy*ddy);
                    if (dist > 1.5) { // don't pull if already at center
                        const stepX = ddx !== 0 ? Math.sign(ddx) : 0;
                        const stepY = ddy !== 0 ? Math.sign(ddy) : 0;
                        // Prefer the dominant axis each step, walking up to pullTiles tiles,
                        // stopping early if a wall blocks further movement along the path.
                        let nx = this.playerX, ny = this.playerY;
                        for (let p = 0; p < pullTiles; p++) {
                            const moveX = Math.abs(ddx) >= Math.abs(ddy) ? stepX : 0;
                            const moveY = Math.abs(ddy) > Math.abs(ddx) ? stepY : 0;
                            const tryX = nx + moveX, tryY = ny + moveY;
                            if (this.world[tryX]?.[tryY] !== this.FLOOR) break;
                            nx = tryX; ny = tryY;
                            if (nx === centerTX && ny === centerTY) break;
                        }
                        if (nx !== this.playerX || ny !== this.playerY) {
                            this.playerX = nx;
                            this.playerY = ny;
                            const npx = nx * this.TILE_SIZE + this.TILE_SIZE / 2;
                            const npy = ny * this.TILE_SIZE + this.TILE_SIZE / 2;
                            this.tweens.add({ targets: this.player, x: npx, y: npy, duration: Math.max(90, 180 - t * 90), ease: 'Quad.easeOut' });
                        }
                    }
                }

                // Acceleration: interval shrinks exponentially from 1100ms → 150ms
                const nextDelay = 1100 * Math.pow(150 / 1100, t);
                _scheduleNextSuck(nextDelay);
            });
        };
        _scheduleNextSuck(1100); // first pull after 1.1s — gives player a moment to react

        // Warning text
        this.time.delayedCall(Math.round(COLLAPSE_DURATION * 0.2), () => {
            if (!boss.active) return;
            this.showStatusText(cx, cy - 80, '⚠ FIND COVER ⚠', '#ff2200');
        });
        this.time.delayedCall(Math.round(COLLAPSE_DURATION * 0.45), () => {
            if (!boss.active) return;
            this.showStatusText(cx, cy - 80, '◉ THE PULL INTENSIFIES', '#9922cc');
            this.cameras.main.shake(60, 0.006);
        });
        this.time.delayedCall(Math.round(COLLAPSE_DURATION * 0.75), () => {
            if (!boss.active) return;
            this.showStatusText(cx, cy - 80, '◉ COLLAPSE IMMINENT', '#9922cc');
            Sfx.play(this, 'tell', { ms: 900, big: true });
            this.cameras.main.shake(80, 0.008);
        });

        // COLLAPSE at the end of the duration — instant suck + 1HP
        this.time.delayedCall(COLLAPSE_DURATION, () => {
            if (!boss.active) return;
            if (_suckTimer) { _suckTimer.remove(); _suckTimer = null; }
            particleInterval.remove();

            this.cameras.main.shake(300, 0.025);
            Sfx.play(this, 'collapse'); Sfx.play(this, 'slam');

            // Suck all enemies to center and kill them
            for (let i = this.enemies.length - 1; i >= 0; i--) {
                const e = this.enemies[i];
                if (!e.sprite?.active) continue;
                this.tweens.add({
                    targets: e.sprite,
                    x: cx, y: cy,
                    duration: 400, ease: 'Quad.easeIn',
                    onComplete: () => { if (e.sprite?.active) this.killEnemy(e); }
                });
            }

            // Final LOS check for the killing blow
            const playerPx = this.player.x, playerPy = this.player.y;
            const dxC = cx - playerPx, dyC = cy - playerPy;
            const steps = Math.ceil(Math.sqrt(dxC*dxC + dyC*dyC) / (this.TILE_SIZE * 0.5));
            let blocked = false;
            for (let s = 1; s <= steps; s++) {
                const t = s / steps;
                const checkX = Math.floor((playerPx + dxC * t) / this.TILE_SIZE);
                const checkY = Math.floor((playerPy + dyC * t) / this.TILE_SIZE);
                if (this.world[checkX]?.[checkY] === this.WALL) { blocked = true; break; }
            }

            if (!blocked && (this._iceShellUntil || 0) <= this.time.now) {   // (not through the ice ult's shell)
                // Instant suck to center + 1HP
                this.tweens.add({
                    targets: this.player,
                    x: cx, y: cy,
                    duration: 500, ease: 'Quad.easeIn',
                    onComplete: () => {
                        this.playerX = Math.floor(cx / this.TILE_SIZE);
                        this.playerY = Math.floor(cy / this.TILE_SIZE);
                    }
                });
                const dmg = Math.max(0, this.health - 1);
                if (dmg > 0) this.takeDamage((dmg) * (this.enemyDamageScale || 1));
                this.showStatusText(cx, cy - 60, '💀 CAUGHT!', '#ff0000');
                this._rootPlayer(2000, this.time.now);
            } else {
                this.showStatusText(playerPx, playerPy - 30, '🛡 BLOCKED!', '#44ff88');
            }

            // Flash and lift darkness
            const flash = this.add.rectangle(this.scale.width/2, this.scale.height/2,
                this.scale.width, this.scale.height, 0xffffff, 0.80).setScrollFactor(0).setDepth(40);
            this.tweens.add({ targets: flash, alpha: 0, duration: 600, onComplete: () => flash.destroy() });
            this._bfxCollapseEnd?.();   // Bosses.js
            this.tweens.add({ targets: dark, alpha: 0, duration: 1200, onComplete: () => dark.destroy() });
            boss.container.setDepth(_bossOrigDepth);

            boss._isInvulnerable = false;
            this.time.delayedCall(2000, () => this._voidSovereignNextAttack());
        });
    }

    _vsAttackEventHorizon() {
        const boss = this.voidSovereignBoss;
        const DURATION = 7000;
        boss._isInvulnerable = true;
        boss._eventHorizonActive = true;
        (this._bfxCallout || this.showStatusText).call(this, boss.container.x, boss.container.y - 80, '🌑 EVENT HORIZON', '#110022');
        Sfx.play(this, 'tell', { ms: 600, big: true });
        this.cameras.main.shake(40, 0.005);

        const startTime = this.time.now;
        const RING_START_R = 2.8 * this.TILE_SIZE;
        const RING_END_R = 1.6 * this.TILE_SIZE; // the safe radius shrinks toward this over the duration

        // Spinning reflective void ring around boss — radius slowly contracts over DURATION
        const ringGfx = this.add.graphics().setDepth(4.5);
        let ringAngle = 0;
        let currentRingR = RING_START_R;
        const drawRing = () => {
            if (this._bfxOn) return this._bfxHorizonRing?.(ringGfx, boss, currentRingR, ringAngle);   // Bosses.js
            ringGfx.clear();
            ringGfx.lineStyle(8, 0x220044, 0.80); ringGfx.strokeCircle(boss.container.x, boss.container.y, currentRingR);
            for (let i = 0; i < 8; i++) {
                const a1 = ringAngle + (i / 8) * Math.PI * 2;
                const a2 = a1 + 0.4;
                ringGfx.lineStyle(3, i % 2 === 0 ? 0xcc44ff : 0xffffff, 0.90);
                ringGfx.beginPath();
                ringGfx.arc(boss.container.x, boss.container.y, currentRingR, a1, a2, false);
                ringGfx.strokePath();
                ringGfx.fillStyle(0xffffff, 0.70);
                ringGfx.fillCircle(
                    boss.container.x + Math.cos(a1) * currentRingR,
                    boss.container.y + Math.sin(a1) * currentRingR, 2.5
                );
            }
        };
        const ringTimer = this.time.addEvent({
            delay: 25, loop: true,
            callback: () => {
                ringAngle += 0.06;
                const t = Math.min((this.time.now - startTime) / DURATION, 1);
                currentRingR = RING_START_R - (RING_START_R - RING_END_R) * t;
                drawRing();
            }
        });

        // ── Reflective pulse — fires outward periodically. Standing inside the pulse's
        // ── radius when it fires gets you knocked back and damaged ("reflected").
        const firePulse = () => {
            if (!boss._eventHorizonActive) return;
            const px = boss.container.x, py = boss.container.y;
            const pulseGfx = this.add.graphics().setDepth(4.4);
            const PULSE_MAX = 6 * this.TILE_SIZE;
            const PULSE_DUR = 550;
            const pulseStart = this.time.now;
            this.cameras.main.shake(20, 0.003);
            Sfx.play(this, 'pulse');
            const pulseTimer = this.time.addEvent({
                delay: 16, loop: true,
                callback: () => {
                    const pt = (this.time.now - pulseStart) / PULSE_DUR;
                    if (pt >= 1) { pulseGfx.destroy(); pulseTimer.remove(); return; }
                    const r = currentRingR + pt * (PULSE_MAX - currentRingR);
                    if (this._bfxOn) this._bfxHorizonPulse?.(pulseGfx, px, py, r, pt);   // Bosses.js
                    else {
                        pulseGfx.clear();
                        pulseGfx.lineStyle(5, 0xcc44ff, 0.85 * (1 - pt));
                        pulseGfx.strokeCircle(px, py, r);
                        pulseGfx.lineStyle(2, 0xffffff, 0.6 * (1 - pt));
                        pulseGfx.strokeCircle(px, py, r);
                    }

                    // Catch the player if the expanding ring sweeps through their position
                    const dist = Math.hypot(this.player.x - px, this.player.y - py);
                    if (!boss._pulseHitThisCycle && Math.abs(dist - r) < this.TILE_SIZE * 0.6) {
                        boss._pulseHitThisCycle = true;
                        this.takeDamage(12 * (this.enemyDamageScale || 1));
                        this.showStatusText(this.player.x, this.player.y - 28, 'REFLECTED!', '#cc44ff');
                        // Knockback away from the boss
                        const dx = this.player.x - px, dy = this.player.y - py;
                        const dlen = Math.hypot(dx, dy) || 1;
                        const knockDist = this.TILE_SIZE * 1.5;
                        let nx = this.player.x + (dx / dlen) * knockDist;
                        let ny = this.player.y + (dy / dlen) * knockDist;
                        const ntx = Math.floor(nx / this.TILE_SIZE), nty = Math.floor(ny / this.TILE_SIZE);
                        if (this.world[ntx]?.[nty] === this.FLOOR && (this._iceShellUntil || 0) <= this.time.now) {   // (not through the ice ult's shell)
                            this.tweens.add({ targets: this.player, x: nx, y: ny, duration: 200, ease: 'Quad.easeOut' });
                            this.playerX = ntx; this.playerY = nty;
                        }
                    }

                    // Same expanding-ring sweep check against any engineer towers
                    if (this.engineerTowers?.length) {
                        if (!boss._pulseTowerHitsThisCycle) boss._pulseTowerHitsThisCycle = new Set();
                        for (const tower of this.engineerTowers) {
                            if (!tower.active || boss._pulseTowerHitsThisCycle.has(tower)) continue;
                            const tDist = Math.hypot(tower.px - px, tower.py - py);
                            if (Math.abs(tDist - r) < this.TILE_SIZE * 0.6) {
                                boss._pulseTowerHitsThisCycle.add(tower);
                                this.damageEngineerTower(tower, 12 * (this.damageScaling || 1));
                            }
                        }
                    }
                }
            });
        };

        const pulseInterval = this.time.addEvent({
            delay: 1500, loop: true,
            callback: () => {
                if (!boss._eventHorizonActive) return;
                boss._pulseHitThisCycle = false;
                boss._pulseTowerHitsThisCycle = null;
                firePulse();
            }
        });

        // Show immunity/warning text periodically
        const immuneTimer = this.time.addEvent({ delay:3600, loop:true, callback:() => {
            if (!boss._eventHorizonActive) return;
            this.showStatusText(boss.container.x, boss.container.y - 60, 'PROJECTILES REFLECTED — STAY MOBILE', '#cc44ff');
        }});

        this.time.delayedCall(DURATION, () => {
            ringTimer.remove(); immuneTimer.remove(); pulseInterval.remove();
            ringGfx.destroy();
            boss._eventHorizonActive = false;
            boss._isInvulnerable = false;
            this._voidSovereignNextAttack();
        });
    }

    _voidSovereignPhase2Transition() {
        const boss = this.voidSovereignBoss;
        (this._bfxCallout || this.showStatusText).call(this, boss.container.x, boss.container.y - 80, '⚠ PHASE 2', '#ff4400');
        Sfx.play(this, 'roar', { big: true }); Sfx.play(this, 'slam');
        this.cameras.main.shake(200, 0.015);

        // Destroy corner pillars. These were the Voltslime arena's coordinates (level 2's room 6):
        // in the Sovereign's room they are empty space, so phase two broke nothing. Its pillars are
        // found instead: the 2x2 blocks of wall standing inside its room.
        const bossRoom = this.towerRun ? this.rooms[0] : this.rooms[6];   // the Tower's arena is its only room
        const pillarPositions = [];
        for (let x = bossRoom.x + 1; x < bossRoom.x + bossRoom.w - 2; x++) {
            for (let y = bossRoom.y + 1; y < bossRoom.y + bossRoom.h - 2; y++) {
                const W = this.world, WL = this.WALL;
                if (W[x]?.[y] !== WL || W[x + 1]?.[y] !== WL || W[x]?.[y + 1] !== WL || W[x + 1]?.[y + 1] !== WL) continue;
                if (!pillarPositions.some(([px, py]) => Math.abs(px - x) <= 1 && Math.abs(py - y) <= 1)) pillarPositions.push([x, y]);
            }
        }
        for (const [px, py] of pillarPositions) {
            for (let dx = 0; dx <= 1; dx++) for (let dy = 0; dy <= 1; dy++) {
                if (this.world[px+dx]?.[py+dy] === this.WALL) {
                    this.world[px+dx][py+dy] = this.FLOOR;
                    // Visual: rubble flash
                    const rx = (px+dx) * this.TILE_SIZE + this.TILE_SIZE/2;
                    const ry = (py+dy) * this.TILE_SIZE + this.TILE_SIZE/2;
                    const rg = this.add.rectangle(rx, ry, this.TILE_SIZE, this.TILE_SIZE, 0x664422, 1).setDepth(0.5);
                    this.tweens.add({ targets:rg, alpha:0, duration:400, onComplete:()=>rg.destroy() });
                }
            }
        }
        boss._pillarsDestroyed = true;
        // Redraw walls. renderWalls is long gone (the world is Visuals.js's), so the map changed under
        // pillars that went on being drawn: Bosses.js repaints them as floor, and they crumble.
        if (this._bfxOn) this._bfxCrumble?.(pillarPositions.flatMap(([x, y]) => [[x, y], [x + 1, y], [x, y + 1], [x + 1, y + 1]]));
        else if (typeof this.renderWalls === 'function') this.renderWalls();
    }

    _spawnVoidRipple(ox, oy, count, speed, damage, slowsPlayer) {
        for (let i = 0; i < count; i++) {
            const angle = (i / count) * Math.PI * 2;
            const g = this.add.graphics().setDepth(2.5);
            g.x = ox; g.y = oy;
            g.fillStyle(0x9922cc, 0.75); g.fillCircle(0, 0, 5);
            g.lineStyle(1.5, 0xcc44ff, 0.60); g.strokeCircle(0, 0, 7);
            const vx = Math.cos(angle) * speed, vy = Math.sin(angle) * speed;
            // Manual movement
            const ripple = { gfx: this._bfxSwap ? this._bfxSwap(g, 'ripple', angle) : g, vx, vy, damage, slowsPlayer, createdAt:this.time.now };
            if (!this._voidRipples) this._voidRipples = [];
            this._voidRipples.push(ripple);
        }
    }

    updateVoidRipples(delta) {
        if (!this._voidRipples) return;
        const ds = delta / 1000;
        for (let i = this._voidRipples.length - 1; i >= 0; i--) {
            const r = this._voidRipples[i];
            if (!r.gfx?.active) { this._voidRipples.splice(i, 1); continue; }
            r.gfx.x += r.vx * ds; r.gfx.y += r.vy * ds;
            // Lifetime check
            if (this.time.now - r.createdAt > 4000) { r.gfx.destroy(); this._voidRipples.splice(i, 1); continue; }
            // Wall check
            const tx = Math.floor(r.gfx.x / this.TILE_SIZE), ty = Math.floor(r.gfx.y / this.TILE_SIZE);
            if (this.world[tx]?.[ty] === this.WALL || !this.world[tx]) { r.gfx.destroy(); this._voidRipples.splice(i, 1); continue; }
            // Player hit
            const dx = this.player.x - r.gfx.x, dy = this.player.y - r.gfx.y;
            if (Math.sqrt(dx*dx + dy*dy) < this.TILE_SIZE * 0.9) {
                this.takeDamage((r.damage || 8) * (this.enemyDamageScale || 1));
                if (r.slowsPlayer) {
                    this.isSlowed = true;
                    this.slowedUntil = this.time.now + 3000;
                    // The player gets arrows on the same terms as an enemy. `this` is the
                    // scene here, and _setSpeedIndicator falls back to the player sprite when
                    // the target has no .sprite of its own.
                    this._setSpeedIndicator?.(this, 'voidripple', 'slow_goop', true, 340, 3000);
                }
                r.gfx.destroy(); this._voidRipples.splice(i, 1);
                continue;
            }
            // Tower hit
            if (this.engineerTowers?.length) {
                let towerHit = null;
                for (const tower of this.engineerTowers) {
                    if (!tower.active) continue;
                    if (Math.hypot(r.gfx.x - tower.px, r.gfx.y - tower.py) < this.TILE_SIZE * 0.9) { towerHit = tower; break; }
                }
                if (towerHit) {
                    this.damageEngineerTower(towerHit, r.damage || 8);
                    r.gfx.destroy(); this._voidRipples.splice(i, 1);
                }
            }
        }
    }

    damageVoidSovereignBoss(amount) {
        const boss = this.voidSovereignBoss;
        amount = this._dmgNote(boss, null, this._afterHit(null, null, amount * this._dmgOutMult(boss) * this._hitRoll(null)));   // your damage (Hex on it included), and a hit's roll and extras, as on any enemy
        if (!boss?.active) return;
        // Not while it is gone: the stomp's leap and the maw's hops hid it but left it hittable
        // where it had been (only the fragments and the collapse made it invulnerable).
        if (boss._isInvulnerable || !boss.container?.visible) return;

        // Shatter if frozen — only the FIRST hit that shatters gets 2× and shows text
        if (boss._isFrozen) {
            const now = this.time.now;
            const alreadyShattering = boss._shatterStartedAt && now - boss._shatterStartedAt < 200;
            if (!alreadyShattering) {
                // First hit this shatter — mark it, show text, clear freeze visuals
                boss._shatterStartedAt = now;
                boss._isFrozen = false;
                boss._frozenUntil = 0;
                boss._freezeStacks = 0;
                if (boss._freezeTimer) { boss._freezeTimer.remove(); boss._freezeTimer = null; }
                if (boss._bossProxy?.freezeVisuals) {
                    const fv = boss._bossProxy.freezeVisuals;
                    if (fv._extraLayers) { for (const l of fv._extraLayers) { this.tweens.killTweensOf(l); l.destroy(); } fv._extraLayers = []; }
                    ['iceBlock', 'iceBorder'].forEach(k => {
                        if (fv[k]) { this.tweens.killTweensOf(fv[k]); fv[k].setVisible(false); fv[k].destroy(); }
                    });
                    boss._bossProxy.freezeVisuals = null;
                }
                boss._bossProxy  = null;
                boss._iceOverlay = null;
                boss._hitShards  = new Set();
                if (boss.body?.active) (boss._bfx ? boss.body.clearTint() : boss.body.setTint(0x6600aa)); // restore base dark purple
                this.showStatusText(boss.container.x, boss.container.y - 75, 'SHATTER!', '#aaffff');
                this.cameras.main.shake(60, 0.006);
                amount *= 2;
            }
            // Subsequent shards in same frame get normal damage, no text
        }

        // 2× vulnerable window (dark fragments phase)
        const mult = (this.time.now < (boss._vulnerableUntil || 0)) ? 2.0 : 1.0;
        const finalDmg = amount * mult;
        boss.hp -= finalDmg;
        if (!boss._isFrozen) this._bfxHitFlash?.(boss);   // Bosses.js

        // Show damage number — deduplicate rapid hits with a cooldown
        const now2 = this.time.now;
        if (!boss._lastDmgNumTime || now2 - boss._lastDmgNumTime >= 60) {
            boss._lastDmgNumTime = now2;
            const col = mult > 1 ? '#ff4444' : boss._isFrozen ? '#aaffff' : '#cc88ff';
            this.showDamageNumber(boss.container.x + (Math.random()-0.5)*20, boss.container.y - 70, Math.round(finalDmg), col);
        }
        if (mult > 1) this.showStatusText(boss.container.x, boss.container.y - 60, `×2! ${Math.round(finalDmg)}`, '#ff4444');

        this.cameras.main.shake(25, 0.003);

        if (boss.hp <= 0) {
            boss.hp = 0;
            boss.active = false;
            this._voidSovereignDeath();
        }
    }

    _voidSovereignDeath() {
        const boss = this.voidSovereignBoss;
        Sfx.play(this, 'bossdie');
        if (!this.towerRun) Progress.announce(this, Progress.rewardBoss('voidrift').frags);
        this.cameras.main.shake(350, 0.025);

        // Clean up any surviving singularity slimes
        for (let i = this.enemies.length - 1; i >= 0; i--) {
            const e = this.enemies[i];
            if (e.isSingularitySlime) {
                if (e._singMark?.active) { this.tweens.killTweensOf(e._singMark); e._singMark.destroy(); }
                if (e._singWarningTiles) { for (const wg of e._singWarningTiles) { this.tweens.killTweensOf(wg); wg.destroy(); } }
                this.killEnemy(e);
            }
        }

        // Death explosion sequence (Bosses.js has its own: it folds in, then a burst of night)
        this._bfxVoidDeath?.(boss);
        if (!this._bfxOn) for (let i = 0; i < 12; i++) {
            this.time.delayedCall(i * 120, () => {
                const a = Math.random() * Math.PI * 2;
                const r = 20 + Math.random() * 50;
                const ex = boss.container.x + Math.cos(a) * r;
                const ey = boss.container.y + Math.sin(a) * r;
                const eg = this.add.circle(ex, ey, 8, 0x9922cc, 0.90).setDepth(5);
                eg.setStrokeStyle(2, 0xffffff, 0.85);
                this.tweens.add({ targets:eg, radius:30, alpha:0, duration:300, onComplete:()=>eg.destroy() });
            });
        }

        this.time.delayedCall(800, () => {
            this.tweens.add({ targets:boss.container, scaleX:2, scaleY:0.1, alpha:0, duration:400, ease:'Quad.easeIn', onComplete:()=>boss.container.destroy() });
            // Drop fragments
            for (let i = 0; i < 8; i++) {
                const a = (i/8)*Math.PI*2;
                const fx = boss.container.x + Math.cos(a)*40, fy = boss.container.y + Math.sin(a)*40;
                const fg = this.add.graphics().setDepth(3);
                fg.fillStyle(0xcc44ff, 0.90); fg.fillCircle(fx, fy, 4);
                this.tweens.add({ targets:fg, alpha:0, duration:800, delay:i*60, onComplete:()=>fg.destroy() });
            }
        });

        // Clear any active attacks
        if (boss._voidMines) boss._voidMines.forEach(m => { if (m.gfx?.active) m.gfx.destroy(); });
        boss._voidMines = [];
        if (boss._gravityHole?.active) { this.tweens.killTweensOf(boss._gravityHole); boss._gravityHole.destroy(); }
        if (this._voidRipples) this._voidRipples.forEach(r => { if (r.gfx?.active) r.gfx.destroy(); }); this._voidRipples = [];
        // Clean up freeze visuals if boss dies while frozen
        if (boss._bossProxy?.freezeVisuals) {
            const fv = boss._bossProxy.freezeVisuals;
            if (fv._extraLayers) { for (const l of fv._extraLayers) { this.tweens.killTweensOf(l); l.destroy(); } }
            ['iceBlock', 'iceBorder'].forEach(k => { if (fv[k]) { this.tweens.killTweensOf(fv[k]); fv[k].destroy(); } });
            boss._bossProxy.freezeVisuals = null;
        }
        if (boss._freezeTimer) { boss._freezeTimer.remove(); boss._freezeTimer = null; }
        boss._bossProxy = null; boss._iceOverlay = null;

        // Clean up burn stacks
        if (boss._burnDoTTimer) { boss._burnDoTTimer.remove(); boss._burnDoTTimer = null; }
        if (boss._burnStackBar) { for (const pip of boss._burnStackBar) pip.destroy(); boss._burnStackBar = null; }
        boss.burnStacks = 0;

        // Drop reward fragments
        if (this.towerRun) for (let i = 0; i < 8; i++) this.spawnOrbScrap(boss.container.x + (Math.random()-0.5)*60, boss.container.y + (Math.random()-0.5)*60);   // scraps: Tower runs only

        if (!this.towerRun) this.time.delayedCall(1500, () => this._level3RoomClear(5));
    }
}