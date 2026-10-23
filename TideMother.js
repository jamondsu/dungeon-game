// ═══════════════════════════════════════════════════════════════════════════
// TIDEMOTHER.JS - the Cistern's last room, the Reservoir: free Riyal from her mother
// ═══════════════════════════════════════════════════════════════════════════
// Riyal is your childhood friend: a water slime with huge water powers, who could always talk and hid it. Her
// mother, the Tide Mother, queen of the sea kingdom, found out. Five rune statues round the room hold Riyal down
// in the middle and pull her power into her mother, and the Tide Mother can't be hurt. So you don't fight her: you
// survive her while you break the runes, and when the last one goes, Riyal ends it in one blow.
//
// The Tide Mother is a Queen Slime (LevelManager.spawnPortal) with `tide` set, and each rune is a portal-shaped
// object of its own with `rune` set: every weapon in the game already knows how to hit a portal, and damagePortal
// hands both to hit() here. updatePortals hands her to update(); _energizePool calls energized().
//
// THE RUNES, each undone its own way:
//   FIRE       sits in a pool: hits with fire dry its tile, then burn it (FIRE_NEED)
//   ICE        hits with ice freeze it (ICE_NEED); frozen, a hit from any other element shatters it, in FROZEN_MS
//   LIGHTNING  takes current only through water: lightning into a pool that touches it, ZAPS times
//   COSMIC     stand in its circle (CHANNEL_R) for CHANNEL_MS
//   GUARD      two Tidal Guards ward it; with them gone, anything breaks it (GUARD_NEED)
// A rune left alone RESEAL_AFTER slowly seals again (RESEAL a second). Each one broken snaps its chain, and Riyal
// helps more: from SHIELD_AT broken she catches her mother's next big hit on you (SHIELD_CD), from SLOW_AT the
// Undertow comes slower. Her mother gets desperate: PHASE_AT runes broken bring the paired moves, then the clock.
//
// HER MOVES, centred on the room (the whole Reservoir's water is hers):
//   UNDERTOW    the water draws back to the middle, then a ring wave crashes out over the whole room. Nothing
//               outruns it: dash through the crest (the crest is CREST tiles either side of its line, so a dash's
//               DASH_IFRAMES have to cover it the whole way through)
//   PARTING     a seam across the middle, then a wall of water down it, rim to rim but for the last PART_ENDS tiles
//   HIGH TIDE   the outer TIDE_RIM tiles flood deep: hurting and slowing while you're in it
//   GEYSERS     a spout under where you stood a beat ago: keep moving, don't double back
//   SPRAY       a spinning spiral of droplets from her, a puddle wherever each one lands
//   TIDAL CLOCK (last phase) a Parting turned into a clock hand sweeping the room, and Undertow rings, short short long
// Her brood: two Tidal Guards at the guarded rune from the start, three Leeches at LEECH_AT runes broken,
// Ripplerunners with every High Tide, two Drowners in the rim at DROWN_AT, a Conduit at each end of a Parting from
// CONDUIT_AT. Nothing joins in the last phase, and the brood goes with her.
class TideMother {
    static CFG = {
        COL: 0x3fd0ff, COL_PART: 0x6fe8ff, COL_TIDE: 0x2a7fff, COL_DROP: 0x7fd0ff,
        MOTHER_SCALE: 1.8, MOTHER_HUE: 205, RIYAL_HUE: 165, RIYAL_SCALE: 1.35,
        FIRST_MS: 1800, GAP: [1100, 800, 600],   // her first move after the card, and the breath between moves (by phase)
        PULSE_MS: 7000,
        RUNES: [['fire', -150], ['ice', 150], ['lightning', 90], ['cosmic', 30], ['guard', -30]], RUNE_R: 8.5,   // each rune and its angle (degrees, 0 = east) round the middle
        RUNE_COL: { fire: 0xff6a2a, ice: 0x7fd8ff, lightning: 0xffe040, cosmic: 0xb070ff, guard: 0x3fd0ff },
        FIRE_NEED: 70, ICE_NEED: 60, FROZEN_MS: 3500, ZAPS: 3, CHANNEL_MS: 4000, CHANNEL_R: 1.6, GUARD_NEED: 140,
        RESEAL_AFTER: 2500, RESEAL: 0.08, SPRING_MS: 4000,   // SPRING_MS: the lightning rune's pool wells back up
        PHASE_AT: [2, 4], LEECH_AT: 1, DROWN_AT: 2, CONDUIT_AT: 3, SHIELD_AT: 2, SHIELD_CD: 15000, SLOW_AT: 4,
        UNDER_TELL: 950, UNDER_SPEED: 12, UNDER_SPEED_FREE: 9, CREST: 0.55, UNDER_DMG: 16,   // tiles a second; the crest's half-width
        PART_TELL: 1300, PART_HALF: 2.5, PART_ENDS: 3, PART_DMG: 20, PART_WET_MS: 2500,
        TIDE_TELL: 1600, TIDE_RIM: 4, TIDE_MS: 7000, TIDE_DMG: 5, TIDE_TICK: 500, RIPPLERS: 2,
        GEY_MS: 4200, GEY_EVERY: 420, GEY_TELL: 800, GEY_DMG: 12, GEY_WET_MS: 3000,
        SPRAY_MS: 2400, SPRAY_EVERY: 110, ARMS: 3, SPIN: 2.2, DROP_SPEED: 6, DROP_RANGE: 16, DROP_DMG: 6, DROP_WET_MS: 8000,
        CLOCK_MS: 16000, CLOCK_IN: 1500, CLOCK_SPIN: 0.33, CLOCK_HALF: 1.5, CLOCK_DMG: 8, CLOCK_TICK: 450,   // rad a second
        CLOCK_BAR: 4400, CLOCK_RINGS: [0, 800], CLOCK_RING_TELL: 650,   // the rings: at these ms of every bar (short, short, long)
    };

    // ── SETTING THE ROOM ─────────────────────────────────────────────────────
    // From spawnLevel6Enemies: room ri's `round` (WorldGen) is the arena's centre and radius
    static spawn(S, ri) {
        const C = TideMother.CFG, r = S.rooms[ri], o = r.round || { cx: r.x + (r.w >> 1), cy: r.y + (r.h >> 1), R: Math.min(r.w, r.h) / 2 - 1 };
        const TS = S.TILE_SIZE;
        // her mother looms at the far edge, out of the water, untouchable
        const q = S.createQueenSlimePortal(o.cx, o.cy - o.R + 3, ri, 9);
        q.spawnCap = 0; q.pulseInterval = C.PULSE_MS;
        const T = q.tide = { cx: o.cx, cy: o.cy, R: o.R, ri, haz: [], later: [], bag: [], done: {}, line: '', runes: [], freed: 0, shieldReady: false, shieldAt: 0 };
        q.container.setScale(C.MOTHER_SCALE).setAlpha(0); q.hitR *= C.MOTHER_SCALE;
        if (q.sprite?.preFX) q.sprite.preFX.addColorMatrix().hue(C.MOTHER_HUE); else q.sprite?.setTint(C.COL);
        (S._bossIntroSeen ||= {}).tide = true;   // her card comes at the end of the scene below, not when her bar first shows
        // Riyal, held down in the middle
        const rx = (o.cx + 0.5) * TS, ry = (o.cy + 0.5) * TS + (S.SLIME_Y_OFFSET || 0);
        const riyal = T.riyal = S.add.sprite(rx, ry, 'slime_red', 0).setScale(S.SLIME_SCALE * C.RIYAL_SCALE, S.SLIME_SCALE * C.RIYAL_SCALE * 0.82).setDepth(1.6);
        if (S.anims.exists('red_idle')) riyal.play('red_idle');
        if (riyal.preFX) riyal.preFX.addColorMatrix().hue(C.RIYAL_HUE); else riyal.setTint(0x6fffd8);
        S._vfxSort?.(riyal);
        if (typeof CreatureFX !== 'undefined') CreatureFX.face(S, riyal, { mood: 'kind' });
        T.riyalShiver = S.tweens.add({ targets: riyal, x: rx + 1.5, duration: 90, yoyo: true, repeat: -1 });
        // the five runes and their chains
        for (const [el, deg] of C.RUNES) {
            const a = deg * Math.PI / 180;
            T.runes.push(TideMother._rune(S, q, el, Math.round(o.cx + Math.cos(a) * C.RUNE_R), Math.round(o.cy + Math.sin(a) * C.RUNE_R)));
        }
        T.ringG = S.add.graphics().setDepth(3.3);
        S._vfxSort?.(T.ringG);
        S._tmRunes = T.runes;   // (_energizePool reads it)
        return q;
    }

    // One rune statue at (x, y): an object every weapon can hit (a portal's shape), its chain to Riyal
    static _rune(S, q, el, x, y) {
        const C = TideMother.CFG, T = q.tide, TS = S.TILE_SIZE, col = C.RUNE_COL[el];
        const px = (x + 0.5) * TS, py = (y + 0.5) * TS;
        const container = S.add.container(px, py).setDepth(1.55);
        const img = S.add.image(0, TS / 2, 'tm_statue').setOrigin(0.5, 1).setScale(2);
        const glyph = S.add.image(0, TS / 2 - 26, 'vfx_rune').setScale(0.24).setTint(col).setBlendMode(Phaser.BlendModes.ADD).setAlpha(0);
        container.add([img, glyph]);
        S._vfxSort?.(container);
        // the chain, Riyal to the statue
        const rx = (T.cx + 0.5) * TS, ry = (T.cy + 0.5) * TS, len = Math.hypot(px - rx, py - ry);
        const chain = S.add.tileSprite(rx, ry, len, 10, 'tm_chain').setOrigin(0, 0.5).setRotation(Math.atan2(py - ry, px - rx))
            .setTileScale(2).setTint(col).setAlpha(0.55).setDepth(0.9);
        const p = { rune: { el, p: 0, lastAt: 0, frozenUntil: 0, saidAt: 0, done: false, springAt: 0 }, tileX: x, tileY: y,
                    hitR: TS * 0.6, hitOffY: -6, hp: 1, maxHp: 1, active: true, tutorialRoomIndex: T.ri,
                    container, img, glyph, chain, gfxObjs: [container, chain], sprite: null };
        S.portals.push(p);
        if (el === 'fire' || el === 'lightning') TideMother._pool(S, x, y);   // they sit in water
        if (el === 'guard') for (const dx of [-1, 1]) T.guards = [...(T.guards || []), TideMother._add(S, q, 'guard', x + dx * 2, y)];
        return p;
    }
    static _pool(S, x, y) { for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) S.addWater(x + dx, y + dy, 0); }

    // ── EVERY FRAME (updatePortals, while you're in the room) ─────────────────
    static update(S, q, now) {
        const T = q.tide, C = TideMother.CFG;
        if (T.scene || S._bossIntroOn || !S.player?.active) return;
        if (!T.introDone) { TideMother._intro(S, q); return; }
        if (T.freed >= T.runes.length) { TideMother._finale(S, q); return; }
        if (!T.t0) { T.t0 = now; T.next = now + C.FIRST_MS; }
        T.phase = T.freed >= C.PHASE_AT[1] ? 3 : T.freed >= C.PHASE_AT[0] ? 2 : 1;
        TideMother._brood(S, q);
        TideMother._runesTick(S, q, now);
        TideMother._shieldTick(S, q, now);
        if (T.phase < 3) S._queenPulse(q, now);   // her Royal Pulse: no standing at her side
        for (const l of T.later.filter(l => now >= l.at)) { T.later.splice(T.later.indexOf(l), 1); l.fn(now); }
        T.haz = T.haz.filter(h => h.tick(now) !== false);
        if (now >= T.next && !T.haz.some(h => h.blocks) && !T.later.length) T.next = now + TideMother._attack(S, q, now) + C.GAP[T.phase - 1];
    }

    // A hit on her or on a rune (damagePortal hands them over before anything else)
    static hit(S, p, dmg, opts = {}) {
        const now = S.time.now, C = TideMother.CFG;
        if (p.tide) {
            if (now - (p._saidAt || -1e9) > 900) { p._saidAt = now; S.showStatusText(p.container.x, p.container.y - 110, 'UNTOUCHABLE: BREAK THE RUNES', '#9fe8ff'); }
            return;
        }
        const R = p.rune;
        if (!R || R.done || !p.active) return;
        const el = opts.freeze || opts.chill ? 'ice' : S.currentElement;
        if (p.img?.active) { p.img.setTintFill(0xffffff); S.time.delayedCall(60, () => { if (p.img?.active) TideMother._runeTint(S, p); }); }
        if (R.el === 'fire') {
            if (el !== 'fire') return TideMother._nope(S, p, 'FIRE');
            if (S.isWaterAt(p.tileX, p.tileY)) { S.evaporateWater(p.tileX, p.tileY, 3); return TideMother._nope(S, p, 'SOAKED: DRY IT'); }
            return TideMother._charge(S, p, dmg / C.FIRE_NEED);
        }
        if (R.el === 'ice') {
            if (R.frozenUntil > now) { if (el !== 'ice') TideMother._free(S, p); return; }   // frozen solid: another element shatters it
            if (el !== 'ice') return TideMother._nope(S, p, 'ICE');
            return TideMother._charge(S, p, dmg / C.ICE_NEED);
        }
        if (R.el === 'lightning') return TideMother._nope(S, p, el === 'lightning' ? 'ONLY THROUGH WATER' : 'LIGHTNING, THROUGH WATER');
        if (R.el === 'cosmic') return TideMother._nope(S, p, 'STAND IN ITS CIRCLE');
        if ((TideMother._q(S)?.tide.guards || []).some(g => g?.sprite?.active && g.health > 0)) return TideMother._nope(S, p, 'WARDED BY ITS GUARDS');
        return TideMother._charge(S, p, dmg / C.GUARD_NEED);
    }

    // Lightning into water (_energizePool, `pool` its tiles as 'x,y'): the lightning rune takes it if its pool's part of it
    static energized(S, pool) {
        const p = (S._tmRunes || []).find(r => r.rune.el === 'lightning' && !r.rune.done && r.active);
        if (!p) return;
        for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) {
            if (!pool.has((p.tileX + dx) + ',' + (p.tileY + dy))) continue;
            TideMother._charge(S, p, 1 / TideMother.CFG.ZAPS + 0.001);
            return;
        }
    }

    // ── THE RUNES ────────────────────────────────────────────────────────────
    static _charge(S, p, amt) {
        const R = p.rune, C = TideMother.CFG;
        R.p = Math.min(1, R.p + amt); R.lastAt = S.time.now;
        if (R.p < 1) return;
        if (R.el !== 'ice') return TideMother._free(S, p);
        R.frozenUntil = S.time.now + C.FROZEN_MS;   // frozen solid, for a moment
        Sfx.play(S, 'ice_crack');
        S.showStatusText(p.container.x, p.container.y - 48, 'FROZEN: SHATTER IT', '#bfeaff');
        TideMother._runeTint(S, p);
    }
    static _nope(S, p, why) {
        const R = p.rune, now = S.time.now;
        if (now - R.saidAt < 900) return;
        R.saidAt = now;
        S.showStatusText(p.container.x, p.container.y - 48, why, '#' + TideMother.CFG.RUNE_COL[R.el].toString(16).padStart(6, '0'));
    }
    static _runeTint(S, p) {
        if (!p.img?.active) return;
        if (p.rune.frozenUntil > S.time.now) p.img.setTint(0xbfe8ff); else p.img.clearTint();
    }
    static _runesTick(S, q, now) {
        const T = q.tide, C = TideMother.CFG, TS = S.TILE_SIZE, g = T.ringG, dt = S.game.loop.delta || 16;
        g.clear();
        for (const p of T.runes) {
            const R = p.rune;
            if (R.done) continue;
            if (R.el === 'ice' && R.frozenUntil && now > R.frozenUntil) { R.frozenUntil = 0; R.p = 0.6; S.showStatusText(p.container.x, p.container.y - 48, 'THAWED', '#bfeaff'); TideMother._runeTint(S, p); }
            if (R.el === 'cosmic') {   // you, standing in its circle
                const d = Math.hypot(S.playerX - p.tileX, S.playerY - p.tileY);
                if (d <= C.CHANNEL_R) TideMother._charge(S, p, dt / C.CHANNEL_MS);
                g.lineStyle(2, C.RUNE_COL.cosmic, d <= C.CHANNEL_R ? 0.85 : 0.35).strokeCircle(p.container.x, p.container.y, (C.CHANNEL_R + 0.5) * TS);
            }
            if (R.el === 'lightning' && now >= R.springAt) { R.springAt = now + C.SPRING_MS; TideMother._pool(S, p.tileX, p.tileY); }
            if (!R.frozenUntil && now - R.lastAt > C.RESEAL_AFTER) R.p = Math.max(0, R.p - C.RESEAL * dt / 1000);   // left alone, it seals again
            // its progress, a ring round the statue
            const x = p.container.x, y = p.container.y - 10, col = C.RUNE_COL[R.el];
            g.lineStyle(3, 0x000000, 0.45).strokeCircle(x, y, 17);
            if (R.p > 0) { g.lineStyle(3, col, 0.95).beginPath(); g.arc(x, y, 17, -Math.PI / 2, -Math.PI / 2 + R.p * Math.PI * 2); g.strokePath(); }
            p.glyph.setAlpha(0.55 + 0.45 * Math.sin(now * 0.005 + p.tileX));
        }
    }
    // A rune undone: the statue breaks, its chain snaps, Riyal is a little freer
    static _free(S, p) {
        const T = TideMother._q(S)?.tide, C = TideMother.CFG, R = p.rune;
        if (!T || R.done) return;
        R.done = true; R.p = 1; p.active = false;
        S.portals.splice(S.portals.indexOf(p), 1);
        T.freed++;
        const x = p.container.x, y = p.container.y, col = C.RUNE_COL[R.el];
        p.img.setTexture('tm_statue_broken').clearTint();
        p.glyph.destroy();
        BossFX.blast(S, x, y - 20, 70, R.el === 'fire' ? 'bolt' : R.el === 'cosmic' ? 'shard' : R.el === 'lightning' ? 'dart' : 'volt');
        S._vfxFlash?.(x, y - 20, 120, col, 300, 0.8);
        Sfx.play(S, 'snap'); S.cameras.main.shake(160, 0.007);
        // its chain snaps in two and falls away
        const c = p.chain;
        if (c?.active) {
            const half = c.width / 2, a = c.rotation;
            const tail = S.add.tileSprite(c.x + Math.cos(a) * half, c.y + Math.sin(a) * half, half, 10, 'tm_chain').setOrigin(0, 0.5).setRotation(a).setTileScale(2).setTint(col).setDepth(0.9);
            c.setSize(half, 10);
            S.tweens.add({ targets: [c, tail], alpha: 0, y: '+=10', duration: 700, ease: 'Quad.easeIn', onComplete: () => { c.destroy(); tail.destroy(); } });
        }
        const r = T.riyal;
        if (r?.active) {
            const k = S.SLIME_SCALE * C.RIYAL_SCALE;
            r.setScale(k, k * (0.82 + 0.036 * T.freed));   // standing a little taller with each
            S._vfxFlash?.(r.x, r.y, 90, 0x6fffd8, 260, 0.7);
        }
        const LINES = ['I can feel it loosen!', "Two! I'll catch her next big hit for you.", "Three... don't stop!", "Her waves are slowing! One more!", "That's all of them!"];
        if (r?.active) S.showStatusText(r.x, r.y - 34, LINES[Math.min(T.freed, LINES.length) - 1], '#9ff8e4');
        if (T.freed === C.SHIELD_AT) T.shieldReady = true;
    }

    // ── RIYAL'S SHIELD ───────────────────────────────────────────────────────
    static _shieldTick(S, q, now) {
        const T = q.tide, C = TideMother.CFG;
        if (T.freed < C.SHIELD_AT) return;
        if (!T.shieldReady && now >= T.shieldAt) T.shieldReady = true;
        if (!T.bubble?.active) T.bubble = S.add.image(0, 0, 'vfx_ring').setBlendMode(Phaser.BlendModes.ADD).setTint(0x6fffd8).setDepth(3.4).setScale(0.75);
        T.bubble.setVisible(T.shieldReady).setPosition(S.player.x, S.player.y - 4).setAlpha(0.45 + 0.2 * Math.sin(now * 0.008));
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
        const speed = T.freed >= C.SLOW_AT ? C.UNDER_SPEED_FREE : C.UNDER_SPEED;
        const x = (T.cx + 0.5) * TS, y = (T.cy + 0.5) * TS;
        // drawn exactly as wide as the crest that hits (CREST either side), so a dash can be timed off it
        const ring = S.add.graphics().setDepth(3.1).setBlendMode(Phaser.BlendModes.ADD);
        S._vfxSort?.(ring);
        const draw = (r, w, a) => { ring.clear(); ring.lineStyle(w, C.COL, 0.4 * a).strokeCircle(x, y, r); ring.lineStyle(2, 0xffffff, 0.85 * a).strokeCircle(x, y, r); };
        Sfx.play(S, 'tell', { ms: tell, big: true });
        TideMother._say(S, q, 'UNDERTOW', 'dash through the wave');
        if (!T.hinted) { T.hinted = true; S.showStatusText(S.player.x, S.player.y - 34, 'DASH THROUGH IT', '#bff4ff'); }
        const t0 = now;
        let hit = false, out = false;
        T.haz.push({ blocks: o.blocks ?? true, kill: () => ring.destroy(), tick: n => {
            const u = (n - t0) / tell;
            if (u < 1) { draw((T.R + 0.5) * TS * (1 - u) + 6, 6, 0.3 + 0.6 * u); return; }   // the water draws back to the middle
            if (!out) { out = true; Sfx.play(S, 'splash'); S.cameras.main.shake(140, 0.006); }
            const r = (n - t0 - tell) / 1000 * speed;
            if (r > T.R + 1.5) { ring.destroy(); return false; }
            draw(Math.max(4, r * TS), C.CREST * 2 * TS, 1 - 0.4 * r / (T.R + 1.5));
            // the crest is on you: you take it unless a dash covers you (every frame it's on you, not just the first)
            if (!hit && Math.abs(TideMother._dist(S, T) - r) <= C.CREST && n >= (S._dashInvulnUntil || 0)) { hit = true; TideMother._hurt(S, q, C.UNDER_DMG); }
        } });
        return tell + (T.R + 1.5) / speed * 1000;
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
        if (T.freed >= C.CONDUIT_AT && T.phase < 3) {   // a Conduit at each end: a wet pocket is a live one
            const have = TideMother._count(S, 'conduit');
            for (const s of [-1, 1].slice(0, Math.max(0, 2 - have))) TideMother._add(S, q, 'conduit', T.cx + s * ux * (T.R - 1.5), T.cy + s * uy * (T.R - 1.5));
        }
        const t0 = now;
        T.haz.push({ blocks: true, kill: () => m.kill(), tick: n => {
            if (n - t0 < tell) return;
            m.done();
            Sfx.play(S, 'slam'); S.cameras.main.shake(180, 0.01);
            if (set.has(S.playerX + ',' + S.playerY)) TideMother._hurt(S, q, C.PART_DMG);
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
                Sfx.play(S, 'splash', { big: true }); S.cameras.main.shake(220, 0.006);
                for (const [x, y] of tiles) S.addWater(x, y, C.TIDE_MS);
                const have = TideMother._count(S, 'ripple');   // the flooded rim is the Ripplerunners' road
                for (let i = have; i < C.RIPPLERS; i++) { const a = Math.random() * Math.PI * 2; TideMother._add(S, q, 'ripple', T.cx + Math.cos(a) * (T.R - 1.5), T.cy + Math.sin(a) * (T.R - 1.5)); }
            }
            if (n - t0 > C.TIDE_TELL + C.TIDE_MS) return false;
            if (set.has(S.playerX + ',' + S.playerY) && n >= nextTick) {   // deep: it hurts while you're in it, and keeps you slow
                nextTick = n + C.TIDE_TICK;
                TideMother._hurt(S, q, C.TIDE_DMG, true);
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
                if (g.tiles.some(([x, y]) => x === S.playerX && y === S.playerY)) TideMother._hurt(S, q, C.GEY_DMG);
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
            const c = q.container, x = c.x, y = c.y - 30 * C.MOTHER_SCALE, spin = a0 + dir * C.SPIN * (n - t0) / 1000;
            for (let i = 0; i < C.ARMS; i++) {
                const a = spin + i * Math.PI * 2 / C.ARMS, v = C.DROP_SPEED * TS;
                const g = BossFX.shot(S, 'volt', x, y, a, 2.8);
                g.setTint?.(C.COL_DROP);
                S.enemyProjectiles.push({ gfx: g, vx: Math.cos(a) * v, vy: Math.sin(a) * v, damage: C.DROP_DMG * (S.enemyDamageScale || 1),
                                          startX: x, startY: y, maxDist: C.DROP_RANGE * TS, _bfxKind: 'volt', _tideDrop: true });
                // where it comes down it leaves a puddle (the room's water is hers)
                const lx = Math.floor((x + Math.cos(a) * C.DROP_RANGE * TS) / TS), ly = Math.floor((y + Math.sin(a) * C.DROP_RANGE * TS) / TS);
                S.time.delayedCall(C.DROP_RANGE / C.DROP_SPEED * 1000, () => { if (q.active && !q.tide.over) S.addWater(lx, ly, C.DROP_WET_MS); });
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
            if (n >= nextTick && tiles.some(([x, y]) => x === S.playerX && y === S.playerY)) { nextTick = n + C.CLOCK_TICK; TideMother._hurt(S, q, C.CLOCK_DMG, true); }
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
    static _brood(S, q) {
        const T = q.tide, C = TideMother.CFG, once = (k, fn) => { if (!T.done[k]) { T.done[k] = true; fn(); } };
        const rim = (a, d = 1.5) => [T.cx + Math.cos(a) * (T.R - d), T.cy + Math.sin(a) * (T.R - d)];
        if (T.freed >= C.LEECH_AT) once('leech', () => { for (let i = 0; i < 3; i++) TideMother._add(S, q, 'leech', ...rim(Math.PI / 2 + i * Math.PI * 2 / 3, 3)); });
        if (T.freed >= C.DROWN_AT) once('drown', () => { for (const a of [Math.PI, 0]) TideMother._add(S, q, 'drowner', ...rim(a, 2)); });
    }

    // One of hers, on the nearest open floor to (x, y), in her room
    static _add(S, q, kind, x, y) {
        const T = q.tide, ri = T.ri;
        let at = null;
        for (let d = 0; d <= 4 && !at; d++) for (let dx = -d; dx <= d && !at; dx++) for (let dy = -d; dy <= d; dy++) {
            const tx = Math.round(x) + dx, ty = Math.round(y) + dy;
            if (S.world?.[tx]?.[ty] !== S.FLOOR || S.getEnemyAt?.(tx, ty) || S.getPortalAt?.(tx, ty) || (tx === S.playerX && ty === S.playerY) || (tx === T.cx && ty === T.cy)) continue;
            at = [tx, ty]; break;
        }
        if (!at) return null;
        const make = { guard: S.createTidalGuard, ripple: S.createRipplerunner, drowner: S.createDrowner, conduit: S.createConduit, leech: S.createLeech }[kind];
        const e = make?.call(S, at[0], at[1], ri);
        if (!e) return null;
        e.tutorialRoomIndex = ri;
        e._motherBrood = kind;
        if (kind !== 'leech') e._waterNative = true;   // the Cistern's own wade unslowed
        if (T.introDone) Sfx.play(S, 'spawn');
        return e;
    }
    static _count(S, kind) { return (S.enemies || []).filter(e => e._motherBrood === kind && e.sprite?.active && e.health > 0).length; }

    // ── THE SCENES ───────────────────────────────────────────────────────────
    // The game holds while they play (_cinemaUntil: GameScene._frame runs only the effects), on the scene clock,
    // which keeps going; the dialogue box takes clicks as ever.
    static _cineOn(S) {
        const W = S.scale.width, H = S.scale.height, LB = 76, cam = S.cameras.main;
        S._cinemaUntil = Infinity; S.isPointerDown = false;
        const top = S.add.rectangle(0, -LB, W, LB, 0x000000, 1).setOrigin(0).setScrollFactor(0).setDepth(60);
        const btm = S.add.rectangle(0, H, W, LB, 0x000000, 1).setOrigin(0).setScrollFactor(0).setDepth(60);
        S.tweens.add({ targets: top, y: 0, duration: 320, ease: 'Quad.easeOut' });
        S.tweens.add({ targets: btm, y: H - LB, duration: 320, ease: 'Quad.easeOut' });
        cam.stopFollow();
        return { top, btm, z0: cam.zoom };
    }
    static _cineOff(S, c) {
        const cam = S.cameras.main, H = S.scale.height;
        S.tweens.add({ targets: c.top, y: -c.top.height, duration: 350, onComplete: () => c.top.destroy() });
        S.tweens.add({ targets: c.btm, y: H, duration: 350, onComplete: () => c.btm.destroy() });
        cam.zoomTo(c.z0, 500, 'Cubic.easeInOut', true);
        if (S.player) { cam.pan(S.player.x, S.player.y, 450, 'Sine.easeInOut', true); S.time.delayedCall(460, () => cam.startFollow(S.player, true, 0.1, 0.1)); }
        S._cinemaUntil = 0;
    }
    static _look(S, at, ms = 800, zoom = 1.4, c) { const cam = S.cameras.main; cam.pan(at.x, at.y, ms, 'Sine.easeInOut', true); if (c) cam.zoomTo(c.z0 * zoom, ms, 'Cubic.easeInOut', true); }
    // Lines in turn, each with its speaker's face, then done()
    static _talk(S, lines, done) {
        const name = TideMother._hero(S), LOOKS = {
            Riyal: { key: 'slime_red', anim: 'red_idle', hue: TideMother.CFG.RIYAL_HUE, mood: 'kind' },
            hero: { key: 'slime_blue', anim: 'idle', mood: 'friend' },
        };
        const go = i => {
            if (i >= lines.length) return done();
            const [who, text] = lines[i];
            S.showTutorialDialogue(text.replace(/\{name\}/g, name), who === 'hero' ? name : who, () => go(i + 1), null, LOOKS[who]);
        };
        go(0);
    }
    static _hero(S) { try { return S.playerName || localStorage.getItem('playerName') || 'Hero'; } catch (e) { return 'Hero'; } }

    // You walk in on it: Riyal held down, the runes lighting, her mother rising. Then the boss card.
    static _intro(S, q) {
        const T = q.tide, TS = S.TILE_SIZE, c = TideMother._cineOn(S), at = (ms, fn) => S.time.delayedCall(ms, fn);
        T.scene = true;
        let met = false;
        try { met = localStorage.getItem('riyal_met') === '1'; } catch (e) {}
        const mid = { x: (T.cx + 0.5) * TS, y: (T.cy + 0.5) * TS }, mum = q.container;
        TideMother._look(S, mid, 900, 1.4, c);
        at(900, () => {   // the guards babble at her
            for (const g of T.guards || []) if (g?.sprite?.active) S.showStatusText(g.sprite.x, g.sprite.y - 26, 'BLUB! BLUB BLUB!', '#9fd8ff');
            Sfx.play(S, 'bubbles');
        });
        T.runes.forEach((p, i) => at(1500 + i * 240, () => {   // the runes light, one by one
            S.tweens.add({ targets: p.glyph, alpha: 1, duration: 200 });
            S.tweens.add({ targets: p.chain, alpha: 0.95, duration: 200 });
            Sfx.play(S, 'tell', { ms: 200 });
        }));
        const rise = then => {   // her mother rises behind her
            TideMother._look(S, { x: mum.x, y: mum.y - 30 }, 700);
            at(700, () => {
                const y0 = mum.y;
                mum.y = y0 + 40;
                S.tweens.add({ targets: mum, alpha: 1, y: y0, duration: 1100, ease: 'Cubic.easeOut' });
                Sfx.play(S, 'roar', { big: true }); S.cameras.main.shake(600, 0.01);
                S._vfxFlash?.(mum.x, mum.y, 160, TideMother.CFG.COL, 600, 0.8);
            });
            at(2300, () => { TideMother._look(S, mid, 600); at(650, then); });
        };
        const end = () => {
            try { localStorage.setItem('riyal_met', '1'); } catch (e) {}
            TideMother._cineOff(S, c);
            T.scene = false; T.introDone = true;
            at(520, () => { delete S._bossIntroSeen.tide; S._bossIntro?.('tide', 'THE TIDE MOTHER', TideMother.CFG.COL, mum.x, mum.y); });
        };
        at(2900, () => {
            if (met) return rise(end);   // seen it before (a retry): the runes and her, no words
            TideMother._talk(S, [
                ['Riyal', '...{name}? No. Get out of here, please.'],
                ['hero', 'Riyal?! You can TALK?'],
                ['Riyal', 'Same as you. Always could. I hid it... even from you. I\'m sorry.'],
                ['Riyal', 'My mother found out. Her runes hold me down, and she\'s pulling my power into herself.'],
            ], () => rise(() => TideMother._talk(S, [
                ['Riyal', 'You can\'t beat her. Not like this. But break the runes, and I can.'],
            ], end)));
        });
    }

    // The last rune: Riyal, free, takes every drop in the room and ends it in one blow
    static _finale(S, q) {
        const T = q.tide, C = TideMother.CFG, TS = S.TILE_SIZE, at = (ms, fn) => S.time.delayedCall(ms, fn);
        if (T.scene || T.over) return;
        T.scene = true; T.over = true;
        for (const h of T.haz) h.kill?.();
        T.haz = []; T.later = [];
        T.ringG?.clear(); T.bubble?.destroy();
        for (const p of [...(S.enemyProjectiles || [])]) if (p._tideDrop) { p.gfx?.destroy(); S.enemyProjectiles.splice(S.enemyProjectiles.indexOf(p), 1); }
        for (const e of [...(S.enemies || [])]) if (e._motherBrood && e.sprite?.active) S.killEnemy(e);   // the water goes still: her brood with it
        const c = TideMother._cineOn(S), r = T.riyal, mum = q.container, mid = { x: r.x, y: r.y };
        T.riyalShiver?.stop();
        TideMother._look(S, mid, 700, 1.5, c);
        at(700, () => {   // every drop in the room comes to her
            const k = S.SLIME_SCALE * C.RIYAL_SCALE;
            S.tweens.add({ targets: r, scaleX: k * 1.5, scaleY: k * 1.5, duration: 1300, ease: 'Back.easeOut' });
            for (let i = 0; i < 3; i++) at(i * 380, () => {
                const ring = S.add.image(r.x, r.y, 'vfx_ring').setBlendMode(Phaser.BlendModes.ADD).setTint(0x6fffd8).setDepth(3.2).setScale(T.R * TS / 26.5);
                S.tweens.add({ targets: ring, scale: 0.2, alpha: 0.2, duration: 700, ease: 'Quad.easeIn', onComplete: () => ring.destroy() });
                Sfx.play(S, 'bubbles');
            });
        });
        at(2300, () => {   // one wave, straight through her mother
            TideMother._look(S, { x: (r.x + mum.x) / 2, y: (r.y + mum.y) / 2 }, 400);
            const n = 9;
            for (let i = 1; i <= n; i++) at(i * 55, () => BossFX.blast(S, r.x + (mum.x - r.x) * i / n, r.y + (mum.y - r.y) * i / n, 60 + i * 6, 'volt'));
            at(n * 55 + 60, () => {
                Sfx.play(S, 'splash', { big: true }); Sfx.play(S, 'bossdie');
                S.cameras.main.shake(700, 0.02); S._vfxFlash?.(mum.x, mum.y, 260, 0xffffff, 700, 1);
                S.showStatusText(mum.x, mum.y - 120, 'ONE BLOW', '#ffffff');
                S.tweens.add({ targets: mum, alpha: 0, y: mum.y + 50, scaleY: mum.scaleY * 0.3, duration: 1600, ease: 'Quad.easeIn' });   // back to the deep
            });
        });
        at(4600, () => {
            TideMother._look(S, mid, 600);
            S.tweens.add({ targets: r, scaleX: S.SLIME_SCALE * C.RIYAL_SCALE, scaleY: S.SLIME_SCALE * C.RIYAL_SCALE, duration: 600 });
            at(700, () => TideMother._talk(S, [
                ['Riyal', '...She\'s gone back to the deep.'],
                ['Riyal', 'You came for me. Even after I lied to you all those years.'],
                ['hero', 'You\'re my friend. That\'s all that matters.'],
                ['Riyal', 'Then I\'m with you. Wherever there\'s water, call me, and I\'ll come.'],
            ], () => {
                try { localStorage.setItem('ally_riyal', '1'); } catch (e) {}
                TideMother._unlockCard(S);
                at(2600, () => {
                    TideMother._cineOff(S, c);
                    T.scene = false;
                    TideMother._gone(S, q);
                });
            }));
        });
    }
    // RIYAL'S CALL, across the middle of the screen
    static _unlockCard(S) {
        const W = S.scale.width, H = S.scale.height;
        const t1 = S.add.text(W / 2, H / 2 - 30, "RIYAL'S CALL", { fontSize: '44px', fontFamily: UIKit.FONT.title, fontStyle: 'bold', color: '#f3e3b8', stroke: '#07060a', strokeThickness: 9 })
            .setOrigin(0.5).setScrollFactor(0).setDepth(62).setScale(2.4).setAlpha(0);
        const t2 = S.add.text(W / 2, H / 2 + 20, 'unlocked: call her, and she comes', { fontSize: '18px', fontFamily: UIKit.FONT.title, fontStyle: 'italic', color: '#9ff8e4', stroke: '#05060a', strokeThickness: 5 })
            .setOrigin(0.5).setScrollFactor(0).setDepth(62).setAlpha(0);
        t1.setShadow(0, 0, '#3fd0ff', 16, true, true);
        S.tweens.add({ targets: t1, scale: 1, alpha: 1, duration: 260, ease: 'Back.easeOut', onComplete: () => Sfx.play(S, 'stinger', { big: true }) });
        S.tweens.add({ targets: t2, alpha: 1, delay: 300, duration: 300 });
        S.tweens.add({ targets: [t1, t2], alpha: 0, delay: 2300, duration: 400, onComplete: () => { t1.destroy(); t2.destroy(); } });
    }
    // Her mother out of the room for good: everything of hers goes, so the room (and the Cistern) clears
    static _gone(S, q) {
        TideMother.die(S, q);
        q.active = false;
        for (const g of q.gfxObjs || []) if (g?.active) { S.tweens.killTweensOf(g); g.destroy(); }
        const i = S.portals.indexOf(q);
        if (i >= 0) S.portals.splice(i, 1);
    }
    // Everything of hers stops, and her brood goes with her (from _gone, and _destroyPortal should anything kill her)
    static die(S, q) {
        const T = q.tide;
        if (!T) return;
        for (const h of T.haz) h.kill?.();
        T.haz = []; T.later = [];
        T.ringG?.destroy(); T.bubble?.destroy();
        for (const p of T.runes) { p.active = false; const i = S.portals.indexOf(p); if (i >= 0) S.portals.splice(i, 1); p.chain?.destroy?.(); }
        S._tmRunes = null;
        for (const e of [...(S.enemies || [])]) if (e._motherBrood && e.sprite?.active) S.killEnemy(e);
    }

    // ── BITS ─────────────────────────────────────────────────────────────────
    static _q(S) { return (S.portals || []).find(p => p.tide && p.active); }
    // The arena's floor tiles where fn(dx, dy) holds (dx, dy from the middle, in tiles)
    static _tiles(S, T, fn) {
        const out = [];
        for (let x = T.cx - T.R; x <= T.cx + T.R; x++) for (let y = T.cy - T.R; y <= T.cy + T.R; y++) {
            const dx = x - T.cx, dy = y - T.cy;
            if (S.world?.[x]?.[y] === S.FLOOR && Math.hypot(dx, dy) <= T.R + 0.5 && fn(dx, dy)) out.push([x, y]);
        }
        return out;
    }
    // How far you are from the middle, in tiles, where you're drawn (between tiles mid-step)
    static _dist(S, T) {
        const TS = S.TILE_SIZE, px = S.player.x / TS - 0.5, py = (S.player.y - (S.SLIME_Y_OFFSET || 0)) / TS - 0.5;
        return Math.hypot(px - T.cx, py - T.cy);
    }
    // One of her blows landing on you: Riyal catches it if her shield's up (not the flood's or the clock's steady ticks)
    static _hurt(S, q, dmg, tick = false) {
        if (!S.player?.active) return;
        const T = q.tide;
        if (!tick && T.shieldReady && S.time.now >= (S._dashInvulnUntil || 0)) {
            T.shieldReady = false; T.shieldAt = S.time.now + TideMother.CFG.SHIELD_CD;
            BossFX.blast(S, S.player.x, S.player.y, 50, 'volt');
            S.showStatusText(S.player.x, S.player.y - 30, 'RIYAL CAUGHT IT', '#9ff8e4');
            return;
        }
        S.takeDamage(dmg * (S.enemyDamageScale || 1));
    }
    // Her move's name over her, and on her boss bar
    static _say(S, q, name, hint) {
        q.tide.line = `${name}  ·  ${hint}`;
        const c = q.container;
        S.showStatusText(c.x, c.y - 70 * TideMother.CFG.MOTHER_SCALE, '≋ ' + name, '#7fe0ff');
    }
    // Her boss bar: how hard she still holds Riyal (the runes left), and what she's doing
    static bar(q) {
        const T = q.tide, n = T.runes.length;
        return { frac: 1 - T.freed / n, line: `runes ${T.freed} / ${n}` + (T.line ? '   ·   ' + T.line : '') };
    }
}
