// ═══════════════════════════════════════════════════════════════════════════
// TIDEMOTHER.JS - the Cistern's boss: the Queen herself, risen in the Reservoir (its round last room)
// ═══════════════════════════════════════════════════════════════════════════
// She is a Queen Slime (LevelManager.spawnPortal: every weapon already knows how to hit one) with `tide` set, so
// updatePortals hands her to TideMother.update instead of the brood and the pulse, and _destroyPortal calls die().
// She holds the middle of the round room, and every attack sends you somewhere:
//   UNDERTOW    the water draws back to her, then a ring wave crashes out over the whole room. Nothing outruns it:
//               dash through the crest (the crest is CREST tiles either side of its line, so a dash's DASH_IFRAMES
//               have to cover it the whole way through; a dash spent early is stamina you won't have for the next)
//   PARTING     a seam across the middle, then a wall of water down it, rim to rim but for the last PART_ENDS tiles
//               at each end: get to an end
//   HIGH TIDE   the walls weep, then the outer TIDE_RIM tiles flood deep: hurting and slowing while you're in it.
//               Get in, towards her
//   GEYSERS     a spout under where you stood a beat ago: keep moving, don't double back
//   SPRAY       a spinning spiral of droplets, a puddle wherever each one lands
//   TIDAL CLOCK (last phase) a Parting turned into a clock hand that sweeps the room rim to rim, while Undertow rings
//               come short, short, long
// Phases by her health: under P2 High Tide joins and attacks pair up (High Tide with a Parting; a Parting and then
// an Undertow, which finds you at the line's end); under P3 the clock. Her brood is the Cistern's own, each where it
// hurts: two Tidal Guards on the rim from the start, three Leeches at LEECH_AT, Ripplerunners with every High Tide
// (the flooded rim is their road), two Drowners in the rim at DROWN_AT, a Conduit at each end of a Parting from
// CONDUIT_AT (dry the pocket or it's live). Nothing joins in the last phase, and the brood goes with her.
class TideMother {
    static CFG = {
        HP: 2600, SCALE: 1.35, HUE: 190, COL: 0x3fd0ff, COL_PART: 0x6fe8ff, COL_TIDE: 0x2a7fff, COL_DROP: 0x7fd0ff,
        FIRST_MS: 1800, GAP: [1100, 800, 600],   // her first move after you walk in, and the breath between moves (by phase)
        P2: 0.6, P3: 0.25, LEECH_AT: 0.75, DROWN_AT: 0.5, CONDUIT_AT: 0.4, PULSE_MS: 7000,
        UNDER_TELL: 950, UNDER_SPEED: 12, CREST: 0.55, UNDER_DMG: 16,          // tiles a second; the crest's half-width
        PART_TELL: 1300, PART_HALF: 2.5, PART_ENDS: 3, PART_DMG: 20, PART_WET_MS: 2500,
        TIDE_TELL: 1600, TIDE_RIM: 4, TIDE_MS: 7000, TIDE_DMG: 5, TIDE_TICK: 500, RIPPLERS: 2,
        GEY_MS: 4200, GEY_EVERY: 420, GEY_TELL: 800, GEY_DMG: 12, GEY_WET_MS: 3000,
        SPRAY_MS: 2400, SPRAY_EVERY: 110, ARMS: 3, SPIN: 2.2, DROP_SPEED: 5, DROP_RANGE: 9, DROP_DMG: 6, DROP_WET_MS: 8000,
        CLOCK_MS: 16000, CLOCK_IN: 1500, CLOCK_SPIN: 0.33, CLOCK_HALF: 1.5, CLOCK_DMG: 8, CLOCK_TICK: 450,   // rad a second
        CLOCK_BAR: 4400, CLOCK_RINGS: [0, 800], CLOCK_RING_TELL: 650,   // the rings: at these ms of every bar (short, short, long)
    };

    // From spawnLevel6Enemies: her, in the middle of room ri (its `round`: the arena's centre and radius, WorldGen)
    static spawn(S, ri) {
        const C = TideMother.CFG, r = S.rooms[ri], o = r.round || { cx: r.x + (r.w >> 1), cy: r.y + (r.h >> 1), R: Math.min(r.w, r.h) / 2 - 1 };
        const q = S.createQueenSlimePortal(o.cx, o.cy, ri, 9);
        q.hp = q.maxHp = C.HP;
        q.spawnCap = 0; q.pulseInterval = C.PULSE_MS;
        q.tide = { cx: o.cx, cy: o.cy, R: o.R, ri, haz: [], later: [], bag: [], done: {}, line: '' };
        // the Queen's red, gone to the colour of deep water (a hue turn survives her hit flashes; a tint wouldn't)
        q.container.setScale(C.SCALE); q.hitR *= C.SCALE;
        if (q.sprite?.preFX) q.sprite.preFX.addColorMatrix().hue(C.HUE); else q.sprite?.setTint(C.COL);
        for (const s of [-1, 1]) TideMother._add(S, q, 'guard', o.cx + s * (o.R - 2), o.cy);   // two Tidal Guards on the rim, facing in
        return q;
    }

    // Every frame you're in her room (updatePortals)
    static update(S, q, now) {
        const T = q.tide, C = TideMother.CFG;
        if (S._bossIntroOn || !S.player?.active) return;
        if (!T.t0) { T.t0 = now; T.next = now + C.FIRST_MS; }
        const f = q.hp / q.maxHp;
        T.phase = f > C.P2 ? 1 : f > C.P3 ? 2 : 3;
        TideMother._brood(S, q, f);
        if (T.phase < 3) S._queenPulse(q, now);   // her own Royal Pulse: camping her costs you
        for (const l of T.later.filter(l => now >= l.at)) { T.later.splice(T.later.indexOf(l), 1); l.fn(now); }
        T.haz = T.haz.filter(h => h.tick(now) !== false);
        if (now >= T.next && !T.haz.some(h => h.blocks) && !T.later.length) T.next = now + TideMother._attack(S, q, now) + C.GAP[T.phase - 1];
    }

    // She falls: everything of hers stops, and her brood goes with her
    static die(S, q) {
        const T = q.tide;
        if (!T) return;
        for (const h of T.haz) h.kill?.();
        T.haz = []; T.later = [];
        for (const e of [...(S.enemies || [])]) if (e._motherBrood && e.sprite?.active) S.killEnemy(e);
        const TS = S.TILE_SIZE;
        S.showStatusText((T.cx + 0.5) * TS, (T.cy + 0.5) * TS + 40, 'the water goes still', '#9fe8ff');
    }

    // ── WHAT SHE DOES NEXT ───────────────────────────────────────────────────
    static _attack(S, q, now) {
        const T = q.tide, C = TideMother.CFG, P = T.phase;
        const pool = P === 1 ? ['undertow', 'parting', 'geysers', 'spray']
                   : P === 2 ? ['tide_parting', 'parting_undertow', 'undertow', 'geysers', 'spray', 'tide']
                   : ['clock', 'spray'];
        if (T.bagPhase !== P || !T.bag.length) {
            T.bag = P === 3 ? [...pool] : pool.map(a => [Math.random(), a]).sort((a, b) => a[0] - b[0]).map(a => a[1]);
            if (T.bag[0] === T.last && T.bag.length > 1) T.bag.push(T.bag.shift());   // never the same move twice running
            T.bagPhase = P;
        }
        const a = T.last = T.bag.shift();
        if (a === 'undertow') return TideMother._undertow(S, q, now);
        if (a === 'parting') return TideMother._parting(S, q, now);
        if (a === 'geysers') return TideMother._geysers(S, q, now);
        if (a === 'spray') return TideMother._spray(S, q, now);
        if (a === 'tide') return TideMother._highTide(S, q, now);
        if (a === 'tide_parting') {   // the flood comes in as the line does: one half of the middle or the other
            TideMother._highTide(S, q, now);
            return TideMother._parting(S, q, now, { tell: C.TIDE_TELL });
        }
        if (a === 'parting_undertow') {   // the line drives you to an end, and the ring finds you there
            const ms = TideMother._parting(S, q, now);
            T.later.push({ at: now + ms - 100, fn: n => TideMother._undertow(S, q, n) });
            return ms;
        }
        return TideMother._clock(S, q, now);
    }

    // ── UNDERTOW ─────────────────────────────────────────────────────────────
    static _undertow(S, q, now, o = {}) {
        const T = q.tide, C = TideMother.CFG, TS = S.TILE_SIZE, tell = o.tell ?? C.UNDER_TELL;
        const x = (T.cx + 0.5) * TS, y = (T.cy + 0.5) * TS, k = px => px / 26.5;   // vfx_ring's bright band: 26.5 of its 32px
        const ring = S.add.image(x, y, 'vfx_ring').setBlendMode(Phaser.BlendModes.ADD).setTint(C.COL).setDepth(3.1).setAlpha(0);
        S._vfxSort?.(ring);
        Sfx.play(S, 'tell', { ms: tell, big: true });
        TideMother._say(S, q, 'UNDERTOW', 'dash through the wave');
        if (!T.hinted) { T.hinted = true; S.showStatusText(S.player.x, S.player.y - 34, 'DASH THROUGH IT', '#bff4ff'); }
        const t0 = now;
        let hit = false, out = false;
        T.haz.push({ blocks: o.blocks ?? true, kill: () => ring.destroy(), tick: n => {
            const u = (n - t0) / tell;
            if (u < 1) { ring.setScale(k((T.R + 0.5) * TS * (1 - u) + 6)).setAlpha(0.25 + 0.55 * u); return; }   // the water draws back to her
            if (!out) { out = true; Sfx.play(S, 'splash'); S.cameras.main.shake(140, 0.006); }
            const r = (n - t0 - tell) / 1000 * C.UNDER_SPEED;
            if (r > T.R + 1.5) { ring.destroy(); return false; }
            ring.setScale(k(Math.max(4, r * TS))).setAlpha(1 - 0.5 * r / (T.R + 1.5));
            // the crest is on you: you take it unless a dash covers you (every frame it's on you, not just the first)
            if (!hit && Math.abs(TideMother._dist(S, T) - r) <= C.CREST && n >= (S._dashInvulnUntil || 0)) { hit = true; TideMother._hurt(S, C.UNDER_DMG); }
        } });
        return tell + (T.R + 1.5) / C.UNDER_SPEED * 1000;
    }

    // ── PARTING ──────────────────────────────────────────────────────────────
    static _parting(S, q, now, o = {}) {
        const T = q.tide, C = TideMother.CFG, tell = o.tell ?? C.PART_TELL;
        const a = (o.angle ?? [0, 0.25, 0.5, 0.75][Math.floor(Math.random() * 4)]) * Math.PI, ux = Math.cos(a), uy = Math.sin(a);
        const reach = T.R - C.PART_ENDS;
        const tiles = TideMother._tiles(S, T, (dx, dy) => Math.abs(-uy * dx + ux * dy) <= C.PART_HALF && Math.abs(ux * dx + uy * dy) <= reach);
        const set = new Set(tiles.map(([x, y]) => x + ',' + y));
        const m = BossFX.mark(S, tiles, C.COL_PART, tell, { fill: 0.05 });
        Sfx.play(S, 'tell', { ms: tell, big: true });
        TideMother._say(S, q, 'PARTING', 'get to an end of the line');
        if (q.hp / q.maxHp <= C.CONDUIT_AT && T.phase < 3) {   // a Conduit at each end: a wet pocket is a live one
            const have = TideMother._count(S, 'conduit');
            for (const s of [-1, 1].slice(0, Math.max(0, 2 - have))) TideMother._add(S, q, 'conduit', T.cx + s * ux * (T.R - 1.5), T.cy + s * uy * (T.R - 1.5));
        }
        const t0 = now;
        T.haz.push({ blocks: true, kill: () => m.kill(), tick: n => {
            if (n - t0 < tell) return;
            m.done();
            Sfx.play(S, 'slam'); S.cameras.main.shake(180, 0.01);
            if (set.has(S.playerX + ',' + S.playerY)) TideMother._hurt(S, C.PART_DMG);
            for (const [x, y] of tiles) S.addWater(x, y, C.PART_WET_MS);
            return false;
        } });
        return tell + 400;
    }

    // ── HIGH TIDE ────────────────────────────────────────────────────────────
    static _highTide(S, q, now) {
        const T = q.tide, C = TideMother.CFG;
        const tiles = TideMother._tiles(S, T, (dx, dy) => Math.hypot(dx, dy) >= T.R - C.TIDE_RIM);
        const set = new Set(tiles.map(([x, y]) => x + ',' + y));
        const m = BossFX.mark(S, tiles, C.COL_TIDE, C.TIDE_TELL, { fill: 0.04 });
        Sfx.play(S, 'tell', { ms: C.TIDE_TELL });
        TideMother._say(S, q, 'HIGH TIDE', 'off the rim');
        const t0 = now, h = { blocks: true, kill: () => m.kill() };
        let landed = false, nextTick = 0;
        h.tick = n => {
            if (n - t0 < C.TIDE_TELL) return;
            if (!landed) {
                landed = true; h.blocks = false; m.done(500);
                Sfx.play(S, 'splash'); S.cameras.main.shake(220, 0.006);
                for (const [x, y] of tiles) S.addWater(x, y, C.TIDE_MS);
                const have = TideMother._count(S, 'ripple');   // the flooded rim is the Ripplerunners' road
                for (let i = have; i < C.RIPPLERS; i++) { const a = Math.random() * Math.PI * 2; TideMother._add(S, q, 'ripple', T.cx + Math.cos(a) * (T.R - 1.5), T.cy + Math.sin(a) * (T.R - 1.5)); }
            }
            if (n - t0 > C.TIDE_TELL + C.TIDE_MS) return false;
            if (set.has(S.playerX + ',' + S.playerY) && n >= nextTick) {   // deep: it hurts while you're in it, and keeps you slow
                nextTick = n + C.TIDE_TICK;
                TideMother._hurt(S, C.TIDE_DMG);
                S._waterSlowUntil = Math.max(S._waterSlowUntil || 0, n + 700);
            }
        };
        T.haz.push(h);
        return C.TIDE_TELL + 300;
    }

    // ── GEYSERS ──────────────────────────────────────────────────────────────
    static _geysers(S, q, now) {
        const T = q.tide, C = TideMother.CFG, t0 = now, spouts = [];
        let at = now;
        TideMother._say(S, q, 'GEYSERS', 'keep moving');
        T.haz.push({ blocks: true, kill: () => spouts.forEach(g => g.m.kill()), tick: n => {
            if (n - t0 < C.GEY_MS && n >= at) {   // one under you now, going off a beat later
                at = n + C.GEY_EVERY;
                const px = S.playerX, py = S.playerY;
                const tiles = [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1]].map(([dx, dy]) => [px + dx, py + dy]).filter(([x, y]) => S.world?.[x]?.[y] === S.FLOOR);
                spouts.push({ tiles, t: n, m: BossFX.mark(S, tiles, C.COL, C.GEY_TELL, { fill: 0.08 }) });
                Sfx.play(S, 'bubbles', { soft: true });
            }
            for (const g of spouts.filter(g => n - g.t >= C.GEY_TELL)) {
                spouts.splice(spouts.indexOf(g), 1);
                g.m.done();
                Sfx.play(S, 'splash', { soft: true });
                if (g.tiles.some(([x, y]) => x === S.playerX && y === S.playerY)) TideMother._hurt(S, C.GEY_DMG);
                for (const [x, y] of g.tiles) S.addWater(x, y, C.GEY_WET_MS);
            }
            if (n - t0 >= C.GEY_MS && !spouts.length) return false;
        } });
        return C.GEY_MS + C.GEY_TELL;
    }

    // ── SPRAY ────────────────────────────────────────────────────────────────
    static _spray(S, q, now) {
        const T = q.tide, C = TideMother.CFG, TS = S.TILE_SIZE, t0 = now, a0 = Math.random() * Math.PI * 2, dir = Math.random() < 0.5 ? 1 : -1;
        let at = now;
        TideMother._say(S, q, 'SPRAY', 'weave through it');
        Sfx.play(S, 'tell', { ms: 400 });
        T.haz.push({ blocks: true, tick: n => {
            if (n - t0 >= C.SPRAY_MS) return false;
            if (n < at) return;
            at = n + C.SPRAY_EVERY;
            const c = q.container, x = c.x, y = c.y - 30 * C.SCALE, spin = a0 + dir * C.SPIN * (n - t0) / 1000;
            for (let i = 0; i < C.ARMS; i++) {
                const a = spin + i * Math.PI * 2 / C.ARMS, v = C.DROP_SPEED * TS;
                const g = BossFX.shot(S, 'volt', x, y, a, 2.8);
                g.setTint?.(C.COL_DROP);
                S.enemyProjectiles.push({ gfx: g, vx: Math.cos(a) * v, vy: Math.sin(a) * v, damage: C.DROP_DMG * (S.enemyDamageScale || 1),
                                          startX: x, startY: y, maxDist: C.DROP_RANGE * TS, _bfxKind: 'volt' });
                // where it comes down it leaves a puddle (the room's water is hers)
                const lx = Math.floor((x + Math.cos(a) * C.DROP_RANGE * TS) / TS), ly = Math.floor((y + Math.sin(a) * C.DROP_RANGE * TS) / TS);
                S.time.delayedCall(C.DROP_RANGE / C.DROP_SPEED * 1000, () => { if (q.active) S.addWater(lx, ly, C.DROP_WET_MS); });
            }
        } });
        return C.SPRAY_MS + 300;
    }

    // ── TIDAL CLOCK ──────────────────────────────────────────────────────────
    static _clock(S, q, now) {
        const T = q.tide, C = TideMother.CFG, TS = S.TILE_SIZE, t0 = now, th0 = Math.random() * Math.PI, dir = Math.random() < 0.5 ? 1 : -1;
        const g = S.add.graphics().setDepth(0.46).setBlendMode(Phaser.BlendModes.ADD);
        S._vfxSort?.(g);
        TideMother._say(S, q, 'TIDAL CLOCK', 'stay ahead of the hand, dash the rings');
        Sfx.play(S, 'tell', { ms: C.CLOCK_IN, big: true });
        let nextTick = 0, bar = 0;
        T.haz.push({ blocks: true, kill: () => g.destroy(), tick: n => {
            const t = n - t0;
            if (t >= C.CLOCK_MS) { g.destroy(); return false; }
            const th = th0 + dir * C.CLOCK_SPIN * Math.max(0, t - C.CLOCK_IN) / 1000, ux = Math.cos(th), uy = Math.sin(th);
            const tiles = TideMother._tiles(S, T, (dx, dy) => Math.abs(-uy * dx + ux * dy) <= C.CLOCK_HALF);
            g.clear();
            BossFX.drawTiles(g, TS, tiles, C.COL_PART, Math.min(1, t / C.CLOCK_IN), n, 0, 0, { fill: 0.1 });
            if (t < C.CLOCK_IN) return;
            if (n >= nextTick && tiles.some(([x, y]) => x === S.playerX && y === S.playerY)) { nextTick = n + C.CLOCK_TICK; TideMother._hurt(S, C.CLOCK_DMG); }
            // the rings, on the bar's beats
            const b = Math.floor((t - C.CLOCK_IN) / C.CLOCK_BAR);
            if (b >= bar && t - C.CLOCK_IN + C.CLOCK_BAR * 0.5 < C.CLOCK_MS - C.CLOCK_IN) {
                bar = b + 1;
                for (const off of C.CLOCK_RINGS) T.later.push({ at: t0 + C.CLOCK_IN + b * C.CLOCK_BAR + off + 400, fn: m => TideMother._undertow(S, q, m, { tell: C.CLOCK_RING_TELL, blocks: false }) });
            }
        } });
        return C.CLOCK_MS;
    }

    // ── HER BROOD ────────────────────────────────────────────────────────────
    static _brood(S, q, f) {
        const T = q.tide, C = TideMother.CFG, once = (k, fn) => { if (!T.done[k]) { T.done[k] = true; fn(); } };
        const rim = (a, d = 1.5) => [T.cx + Math.cos(a) * (T.R - d), T.cy + Math.sin(a) * (T.R - d)];
        if (f <= C.LEECH_AT) once('leech', () => { for (let i = 0; i < 3; i++) TideMother._add(S, q, 'leech', ...rim(Math.PI / 2 + i * Math.PI * 2 / 3, 3)); });
        if (f <= C.DROWN_AT) once('drown', () => { for (const a of [-Math.PI / 2, Math.PI / 2]) TideMother._add(S, q, 'drowner', ...rim(a, 2)); });
    }

    // One of hers, on the nearest open floor to (x, y), in her room
    static _add(S, q, kind, x, y) {
        const T = q.tide, ri = T.ri;
        let at = null;
        for (let d = 0; d <= 4 && !at; d++) for (let dx = -d; dx <= d && !at; dx++) for (let dy = -d; dy <= d; dy++) {
            const tx = Math.round(x) + dx, ty = Math.round(y) + dy;
            if (S.world?.[tx]?.[ty] !== S.FLOOR || S.getEnemyAt?.(tx, ty) || S._portalCoversTile(q, tx, ty) || (tx === S.playerX && ty === S.playerY)) continue;
            at = [tx, ty]; break;
        }
        if (!at) return null;
        const make = { guard: S.createTidalGuard, ripple: S.createRipplerunner, drowner: S.createDrowner, conduit: S.createConduit, leech: S.createLeech }[kind];
        const e = make?.call(S, at[0], at[1], ri);
        if (!e) return null;
        e.tutorialRoomIndex = ri;
        e._motherBrood = kind;
        if (kind !== 'leech') e._waterNative = true;   // the Cistern's own wade unslowed
        Sfx.play(S, 'spawn');
        return e;
    }
    static _count(S, kind) { return (S.enemies || []).filter(e => e._motherBrood === kind && e.sprite?.active && e.health > 0).length; }

    // ── BITS ─────────────────────────────────────────────────────────────────
    // The arena's floor tiles where fn(dx, dy) holds (dx, dy from her centre, in tiles)
    static _tiles(S, T, fn) {
        const out = [];
        for (let x = T.cx - T.R; x <= T.cx + T.R; x++) for (let y = T.cy - T.R; y <= T.cy + T.R; y++) {
            const dx = x - T.cx, dy = y - T.cy;
            if (S.world?.[x]?.[y] === S.FLOOR && Math.hypot(dx, dy) <= T.R + 0.5 && fn(dx, dy)) out.push([x, y]);
        }
        return out;
    }
    // How far you are from her centre, in tiles, where you're drawn (between tiles mid-step)
    static _dist(S, T) {
        const TS = S.TILE_SIZE, px = S.player.x / TS - 0.5, py = (S.player.y - (S.SLIME_Y_OFFSET || 0)) / TS - 0.5;
        return Math.hypot(px - T.cx, py - T.cy);
    }
    static _hurt(S, dmg) { if (S.player?.active) S.takeDamage(dmg * (S.enemyDamageScale || 1)); }
    // Her move's name over her, and on her boss bar
    static _say(S, q, name, hint) {
        q.tide.line = `${name}  ·  ${hint}`;
        const c = q.container;
        S.showStatusText(c.x, c.y - 70 * TideMother.CFG.SCALE, '≋ ' + name, '#7fe0ff');
    }
}
