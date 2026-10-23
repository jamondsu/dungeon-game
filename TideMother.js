// ═══════════════════════════════════════════════════════════════════════════
// TIDEMOTHER.JS - the Cistern's last room, the Reservoir: free Riyal from her mother
// ═══════════════════════════════════════════════════════════════════════════
// Riyal is your childhood friend: a water slime with huge water powers, who could always talk and hid it. Her
// mother, the Tide Mother, queen of the sea kingdom, found out. Five rune statues round the room hold Riyal down
// in the middle and pull her power into her mother, and the Tide Mother can't be hurt. So you don't fight her: you
// survive her while you break the runes, and when the last one goes, Riyal ends it in one blow.
//
// The Tide Mother is a Queen Slime (LevelManager.spawnPortal) with `tide` set: damagePortal hands her hits to hit()
// (she shrugs them off), updatePortals hands her to update().
//
// THE RUNES break only to her own bubbles. She throws cavitation bubbles, each bearing one rune's sign (the element
// icons, and a wave for the tide rune); landed, a bubble drifts after you, slower than you and turning slowly, so you
// can lead it. Lead it into the statue with its sign and the rune cracks (RUNE_HITS each). Let it reach you and it
// bursts on you for BUB.DMG; into the wrong statue, or when its time runs out, it bursts where it is (BUB.POP_DMG
// within BUB.POP_R). Weapons pass through them. Each rune broken snaps its chain, and Riyal helps more: from SHIELD_AT
// she catches her mother's next big blow on you (SHIELD_CD), from SLOW_AT the Undertow comes slower. Her mother gets
// desperate: PHASE_AT runes broken bring the paired moves, then the clock, and the bubbles come faster, two at once.
//
// HER MOVES, centred on the room (the whole Reservoir's water is hers), every one drawn as lit tiles:
//   UNDERTOW    the water draws back to the middle, then a ring of tiles crashes out over the whole room. Nothing
//               outruns it: dash through it (it's a tile thick, so a dash's DASH_IFRAMES have to cover it the whole way)
//   PARTING     a seam across the middle, then a wall of water down it, rim to rim but for the last PART_ENDS tiles
//   HIGH TIDE   the outer TIDE_RIM tiles flood deep: hurting and slowing while you're in it
//   GEYSERS     a spout under where you stood a beat ago: keep moving, don't double back
//   SPRAY       a spinning spiral of droplets from her, a puddle wherever each one lands
//   CAVITATION  huge bubbles boil up round the room and burst where they sit; a Ripplerunner near one throws it at you
//   TIDAL CLOCK (last phase) a Parting turned into a clock hand sweeping the room, and Undertow rings, short short long
//
// HER BROOD. The SMASHERS are hers alone, her guard (mantis shrimp, true to life): close enough, one winds up for
// SMASH.WIND_MS and swings its club too fast to see, SMASH.DMG to the six tiles in front of it (two deep, three wide);
// the strike leaves a dormant cavitation bubble that drifts SMASH.DRIFT tiles over SMASH.DORMANT_MS, then bursts over
// SMASH.CAV_R tiles for a third of that (unless a Ripplerunner takes it in its trance and sends it at you first).
// Stand in both and both land. Two guard her from the start, one more at each of SMASH.AT runes broken (SMASH.MAX
// at once); three Leeches come at LEECH_AT, Ripplerunners with every High Tide. Nothing joins in the last phase, and
// the brood goes with her.
class TideMother {
    static CFG = {
        COL: 0x3fd0ff, COL_PART: 0x6fe8ff, COL_TIDE: 0x2a7fff, COL_DROP: 0x7fd0ff,
        MOTHER_SCALE: 1.8, MOTHER_HUE: 205, RIYAL_HUE: 165, RIYAL_SCALE: 1.35,
        FIRST_MS: 1800, GAP: [1700, 1300, 1000],   // her first move after the card, and the breath between moves (by phase)
        PULSE_MS: 7000,
        RUNES: [['fire', -150], ['ice', 150], ['lightning', 90], ['cosmic', 30], ['tide', -30]], RUNE_R: 8.5,   // each rune and its angle (degrees, 0 = east) round the middle
        RUNE_COL: { fire: 0xff6a2a, ice: 0x7fd8ff, lightning: 0xffe040, cosmic: 0xb070ff, tide: 0x3fd0ff },
        RUNE_HITS: 2,
        BUB: { EVERY: [7000, 6000, 5200], PAIR_AT: 2, MAX: 3, THROW_MS: 750, SHORT: 2.5, SPEED: 2.6, TURN: 2.4, LIFE: 12000, WARN: 1500,
               TOUCH: 0.6, RUNE_R: 1.0, DMG: 40, POP_R: 2.2, POP_DMG: 16, WET_MS: 4000 },   // SHORT: it lands that many tiles short of you; SPEED tiles a second; TURN rad a second
        SMASH: { HP: 90, MOVE: 0.8, REACH: 1.6, WIND_MS: 280, DMG: 24, DRIFT: 1, DORMANT_MS: 2000, CAV_R: 4, CD: 2200, AT: [2, 3], MAX: 3 },   // its bubble drifts DRIFT tiles over DORMANT_MS, then bursts over CAV_R
        FIELD: { N: [3, 4, 5], FORM_MS: 700, FUSE: 3200, R: 3.5, DMG: 20, SIZE: 3, COL: 0x9fe8ff, GAP: 4 },   // her huge bubbles (by phase); GAP tiles between them
        PHASE_AT: [2, 4], LEECH_AT: 1, SHIELD_AT: 2, SHIELD_CD: 15000, SLOW_AT: 4,
        UNDER_TELL: 950, UNDER_SPEED: 12, UNDER_SPEED_FREE: 9, CREST: 0.5, UNDER_DMG: 16,   // tiles a second; the ring's half-thickness, in tiles
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
        const T = q.tide = { cx: o.cx, cy: o.cy, R: o.R, ri, haz: [], later: [], bag: [], done: {}, line: '', runes: [], bubbles: [], smashers: [],
                             freed: 0, throws: 0, shieldReady: false, shieldAt: 0 };
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
        // her guard: two Smashers, either side of her (kept out of the room's first-encounter cards till her scene's done: _intro)
        for (const s of [-1, 1]) TideMother._add(S, q, 'smasher', o.cx + s * 3, o.cy - o.R + 5);
        for (const e of T.smashers) e.tutorialRoomIndex = -1;
        return q;
    }

    // One rune statue at (x, y), its sign floating over it, its chain to Riyal
    static _rune(S, q, el, x, y) {
        const C = TideMother.CFG, T = q.tide, TS = S.TILE_SIZE, col = C.RUNE_COL[el];
        const px = (x + 0.5) * TS, py = (y + 0.5) * TS;
        const container = S.add.container(px, py).setDepth(1.55);
        const img = S.add.image(0, TS / 2, 'tm_statue').setOrigin(0.5, 1).setScale(2);
        const glyph = S.add.image(0, TS / 2 - 26, 'vfx_rune').setScale(0.24).setTint(col).setBlendMode(Phaser.BlendModes.ADD).setAlpha(0);
        container.add([img, glyph]);
        S._vfxSort?.(container);
        // its sign, over it: what a bubble has to bear to break it
        const glow = S.add.image(px, py - 46, 'vfx_glow').setTint(col).setBlendMode(Phaser.BlendModes.ADD).setScale(0.4).setAlpha(0).setDepth(3.3);
        const sym = S.add.image(px, py - 46, TideMother._symKey(el), '0').setScale(1.6).setAlpha(0).setDepth(3.35);
        S.tweens.add({ targets: [sym, glow], y: py - 50, duration: 900, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
        // the chain, Riyal to the statue
        const rx = (T.cx + 0.5) * TS, ry = (T.cy + 0.5) * TS, len = Math.hypot(px - rx, py - ry);
        const chain = S.add.tileSprite(rx, ry, len, 10, 'tm_chain').setOrigin(0, 0.5).setRotation(Math.atan2(py - ry, px - rx))
            .setTileScale(2).setTint(col).setAlpha(0.55).setDepth(0.9);
        return { el, tileX: x, tileY: y, cx: px, cy: py - 10, hits: 0, done: false, container, img, glyph, glow, sym, chain };
    }
    static _symKey(el) { return el === 'tide' ? 'tm_sym_tide' : 'el_icon_' + el; }
    static _symFrame(S, img, el, now, k = 0) { if (el !== 'tide' && img?.active) img.setFrame(String((Math.floor(now / 140) + k) % 4)); }

    // ── EVERY FRAME (updatePortals, while you're in the room) ─────────────────
    static update(S, q, now) {
        const T = q.tide, C = TideMother.CFG;
        if (T.scene || S._bossIntroOn || !S.player?.active) return;
        if (!T.introDone) { TideMother._intro(S, q); return; }
        if (T.freed >= T.runes.length) { TideMother._finale(S, q); return; }
        if (!T.t0) { T.t0 = now; T.next = now + C.FIRST_MS; T.bubAt = now + C.FIRST_MS + 1500; }
        const dt = Math.min(0.05, (S.game.loop.delta || 16) / 1000);
        T.phase = T.freed >= C.PHASE_AT[1] ? 3 : T.freed >= C.PHASE_AT[0] ? 2 : 1;
        TideMother._brood(S, q);
        if (now >= T.bubAt) TideMother._throwTurn(S, q, now);
        TideMother._bubblesTick(S, q, now, dt);
        for (const r of T.runes) if (!r.done) TideMother._symFrame(S, r.sym, r.el, now, r.tileX);
        TideMother._shieldTick(S, q, now);
        if (T.phase < 3) S._queenPulse(q, now);   // her Royal Pulse: no standing at her side
        for (const l of T.later.filter(l => now >= l.at)) { T.later.splice(T.later.indexOf(l), 1); l.fn(now); }
        T.haz = T.haz.filter(h => h.tick(now) !== false);
        if (now >= T.next && !T.haz.some(h => h.blocks) && !T.later.length) T.next = now + TideMother._attack(S, q, now) + C.GAP[T.phase - 1];
    }

    // A hit on her (damagePortal hands it over before anything else): she can't be hurt
    static hit(S, p) {
        const now = S.time.now;
        if (now - (p._saidAt || -1e9) < 900) return;
        p._saidAt = now;
        S.showStatusText(p.container.x, p.container.y - 110, 'UNTOUCHABLE: BREAK THE RUNES', '#9fe8ff');
    }

    // ── HER BUBBLES ──────────────────────────────────────────────────────────
    // Her turn to throw: one, or two of different signs once PAIR_AT runes are broken (every other throw)
    static _throwTurn(S, q, now) {
        const T = q.tide, B = TideMother.CFG.BUB;
        T.bubAt = now + B.EVERY[T.phase - 1];
        const left = T.runes.filter(r => !r.done).map(r => r.el).sort(() => Math.random() - 0.5);
        const n = Math.min(left.length, B.MAX - T.bubbles.length, T.freed >= B.PAIR_AT && T.throws % 2 ? 2 : 1);
        T.throws++;
        for (let i = 0; i < n; i++) T.later.push({ at: now + i * 300, fn: m => TideMother._throw(S, q, left[i], m) });
    }
    // A bubble bearing el's sign, thrown from her to a few tiles short of you
    static _throw(S, q, el, now) {
        const T = q.tide, B = TideMother.CFG.BUB, TS = S.TILE_SIZE, col = TideMother.CFG.RUNE_COL[el];
        const mx = q.container.x, my = q.container.y - 40, px = S.player.x, py = S.player.y - (S.SLIME_Y_OFFSET || 0);
        const a = Math.atan2(py - my, px - mx);
        let lx = px - Math.cos(a) * B.SHORT * TS, ly = py - Math.sin(a) * B.SHORT * TS;
        const cx = (T.cx + 0.5) * TS, cy = (T.cy + 0.5) * TS, d = Math.hypot(lx - cx, ly - cy), lim = (T.R - 1) * TS;
        if (d > lim) { lx = cx + (lx - cx) * lim / d; ly = cy + (ly - cy) * lim / d; }
        const cont = S.add.container(mx, my).setDepth(3.2);
        const ring = LevelManager.cavSprite(S, 0, 0, col).setScale(1.45);
        const glow = S.add.image(0, 0, 'vfx_glow').setTint(col).setBlendMode(Phaser.BlendModes.ADD).setScale(0.32).setAlpha(0.5);
        const sym = S.add.image(0, 0, TideMother._symKey(el), '0').setScale(1.1);
        cont.add([glow, ring, sym]);
        S._vfxSort?.(cont);
        const b = { el, x: mx, y: my, a, t0: 0, live: false, cont, ring, sym };
        // a Ripplerunner sends it at you: it's a burst at your feet then, not a sign for a rune (LevelManager._rippleGod)
        b.redirect = (tx, ty, r = {}) => {
            const i = T.bubbles.indexOf(b);
            if (i < 0) return;
            T.bubbles.splice(i, 1); cont.destroy(); b.gone = true;
            S._cavBubble(b.x, b.y, tx, ty, { r: B.POP_R, dmg: B.POP_DMG, col, atYou: true, ms: r.ms, ease: r.ease });
        };
        T.bubbles.push(b);
        const m = BossFX.mark(S, [[Math.floor(lx / TS), Math.floor(ly / TS)]], col, B.THROW_MS, { fill: 0.1 });
        Sfx.play(S, 'lob');
        TideMother._say(S, q, 'BUBBLE', 'lead it into the rune with its sign');
        if (!T.bubHinted) { T.bubHinted = true; S.showStatusText(S.player.x, S.player.y - 34, 'LEAD IT TO ITS RUNE', '#bff4ff'); }
        S.tweens.addCounter({ from: 0, to: 1, duration: B.THROW_MS, onUpdate: tw => {   // a lob
            const u = tw.getValue();
            b.x = mx + (lx - mx) * u; b.y = my + (ly - my) * u;
            cont.setPosition(b.x, b.y - Math.sin(Math.PI * u) * 70);
        }, onComplete: () => {
            m.done();
            if (!cont.active) return;
            b.live = true; b.t0 = S.time.now;
            Sfx.play(S, 'bubbles', { soft: true });
        } });
    }
    // Her bubbles a Ripplerunner can turn onto you (the landed ones)
    static redirectables(S) { return (S.portals || []).find(p => p.tide && p.active)?.tide.bubbles.filter(b => b.live && !b.held && !b.atYou) || []; }
    static _bubblesTick(S, q, now, dt) {
        const T = q.tide, B = TideMother.CFG.BUB, TS = S.TILE_SIZE;
        const px = S.player.x, py = S.player.y - (S.SLIME_Y_OFFSET || 0), cx = (T.cx + 0.5) * TS, cy = (T.cy + 0.5) * TS, lim = (T.R - 0.3) * TS;
        for (const b of [...T.bubbles]) {
            if (!b.live || b.held) continue;   // (held: a Ripplerunner has it)
            const age = now - b.t0;
            // after you, turning slowly: lead it round
            let turn = Math.atan2(py - b.y, px - b.x) - b.a;
            turn = Math.atan2(Math.sin(turn), Math.cos(turn));
            b.a += Math.max(-B.TURN * dt, Math.min(B.TURN * dt, turn));
            b.x += Math.cos(b.a) * B.SPEED * TS * dt; b.y += Math.sin(b.a) * B.SPEED * TS * dt;
            const d = Math.hypot(b.x - cx, b.y - cy);
            if (d > lim) { b.x = cx + (b.x - cx) * lim / d; b.y = cy + (b.y - cy) * lim / d; }
            const wob = 1 + 0.06 * Math.sin(now * 0.012 + b.t0);
            b.cont.setPosition(b.x, b.y).setScale(wob, 2 - wob);
            b.ring.setAlpha(age > B.LIFE - B.WARN && Math.floor(now / 110) % 2 ? 0.35 : 1);   // about to burst: it blinks
            TideMother._symFrame(S, b.sym, b.el, now);
            const rune = T.runes.find(r => !r.done && Math.hypot(b.x - r.cx, b.y - r.cy) <= B.RUNE_R * TS);
            if (rune) {
                if (rune.el === b.el) { TideMother._pop(S, q, b, { quiet: true }); TideMother._runeHit(S, q, rune); }
                else { S.showStatusText(rune.cx, rune.cy - 40, 'WRONG RUNE', '#ff9a8a'); TideMother._pop(S, q, b); }
                continue;
            }
            if (Math.hypot(b.x - px, b.y - py) <= B.TOUCH * TS && now >= (S._dashInvulnUntil || 0)) {   // it caught you
                TideMother._hurt(S, q, B.DMG);
                TideMother._pop(S, q, b, { spare: true });
                continue;
            }
            if (age >= B.LIFE) TideMother._pop(S, q, b);
        }
    }
    // A bubble bursts: over POP_R round it (unless it burst on you, or into its rune)
    static _pop(S, q, b, o = {}) {
        const T = q.tide, B = TideMother.CFG.BUB, TS = S.TILE_SIZE;
        T.bubbles.splice(T.bubbles.indexOf(b), 1);
        b.cont.destroy(); b.gone = true;
        LevelManager.cavFlash(S, b.x, b.y, (o.quiet ? 0.8 : B.POP_R) * TS, TideMother.CFG.RUNE_COL[b.el]);   // it collapses, as they do
        Sfx.play(S, 'splash', { big: !o.quiet });
        if (o.quiet) return;
        const px = S.player.x, py = S.player.y - (S.SLIME_Y_OFFSET || 0);
        if (!o.spare && Math.hypot(b.x - px, b.y - py) <= B.POP_R * TS) TideMother._hurt(S, q, B.POP_DMG);
        const tx = Math.floor(b.x / TS), ty = Math.floor(b.y / TS);
        for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) S.addWater(tx + dx, ty + dy, B.WET_MS);
    }

    // ── THE RUNES ────────────────────────────────────────────────────────────
    static _runeHit(S, q, r) {
        const C = TideMother.CFG;
        r.hits++;
        S._vfxFlash?.(r.cx, r.cy, 90, C.RUNE_COL[r.el], 260, 0.8);
        S.cameras.main.shake(110, 0.005);
        S.tweens.add({ targets: r.container, x: r.container.x + 3, duration: 50, yoyo: true, repeat: 3 });
        if (r.hits >= C.RUNE_HITS) return TideMother._free(S, q, r);
        Sfx.play(S, 'ice_crack');
        r.img.setTint(0xd8d2c8);   // cracked
        S.showStatusText(r.cx, r.cy - 40, `CRACKED ${r.hits} / ${C.RUNE_HITS}`, '#' + C.RUNE_COL[r.el].toString(16).padStart(6, '0'));
    }
    // A rune undone: the statue breaks, its chain snaps, Riyal is a little freer
    static _free(S, q, r) {
        const T = q.tide, C = TideMother.CFG;
        if (r.done) return;
        r.done = true;
        T.freed++;
        const col = C.RUNE_COL[r.el];
        r.img.setTexture('tm_statue_broken').clearTint();
        for (const o of [r.glyph, r.sym, r.glow]) { S.tweens.killTweensOf(o); o.destroy(); }
        BossFX.blast(S, r.cx, r.cy - 10, 70, r.el === 'fire' ? 'bolt' : r.el === 'cosmic' ? 'shard' : r.el === 'lightning' ? 'dart' : 'volt');
        S._vfxFlash?.(r.cx, r.cy - 10, 120, col, 300, 0.8);
        Sfx.play(S, 'snap'); S.cameras.main.shake(160, 0.007);
        // its chain snaps in two and falls away
        const c = r.chain;
        if (c?.active) {
            const half = c.width / 2, a = c.rotation;
            const tail = S.add.tileSprite(c.x + Math.cos(a) * half, c.y + Math.sin(a) * half, half, 10, 'tm_chain').setOrigin(0, 0.5).setRotation(a).setTileScale(2).setTint(col).setDepth(0.9);
            c.setSize(half, 10);
            S.tweens.add({ targets: [c, tail], alpha: 0, y: '+=10', duration: 700, ease: 'Quad.easeIn', onComplete: () => { c.destroy(); tail.destroy(); } });
        }
        const rr = T.riyal;
        if (rr?.active) {
            const k = S.SLIME_SCALE * C.RIYAL_SCALE;
            rr.setScale(k, k * (0.82 + 0.036 * T.freed));   // standing a little taller with each
            S._vfxFlash?.(rr.x, rr.y, 90, 0x6fffd8, 260, 0.7);
        }
        const LINES = ['I can feel it loosen!', "Two! I'll catch her next big hit for you.", "Three... don't stop!", "Her waves are slowing! One more!", "That's all of them!"];
        if (rr?.active) S.showStatusText(rr.x, rr.y - 34, LINES[Math.min(T.freed, LINES.length) - 1], '#9ff8e4');
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
        const pool = P === 1 ? ['undertow', 'parting', 'geysers', 'field']
                   : P === 2 ? ['tide_parting', 'parting_undertow', 'undertow', 'geysers', 'spray', 'tide', 'field']
                   : ['clock', 'field', 'spray'];
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
        if (a === 'field') return TideMother._field(S, q, now);
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
        const g = S.add.graphics().setDepth(0.47).setBlendMode(Phaser.BlendModes.ADD);   // the ring, as lit tiles: exactly the ones that hit
        S._vfxSort?.(g);
        Sfx.play(S, 'tell', { ms: tell, big: true });
        TideMother._say(S, q, 'UNDERTOW', 'dash through the wave');
        if (!T.hinted) { T.hinted = true; S.showStatusText(S.player.x, S.player.y - 34, 'DASH THROUGH IT', '#bff4ff'); }
        const t0 = now, band = r => TideMother._tiles(S, T, (dx, dy) => Math.abs(Math.hypot(dx, dy) - r) <= C.CREST);
        let hit = false, out = false;
        T.haz.push({ blocks: o.blocks ?? true, kill: () => g.destroy(), tick: n => {
            const u = (n - t0) / tell;
            g.clear();
            if (u < 1) { BossFX.drawTiles(g, TS, band((T.R + 0.5) * (1 - u)), C.COL, 0.25 + 0.5 * u, n, 0, 0, { fill: 0.06 }); return; }   // the water draws back to the middle
            if (!out) { out = true; Sfx.play(S, 'splash'); S.cameras.main.shake(140, 0.006); }
            const r = (n - t0 - tell) / 1000 * speed;
            if (r > T.R + 1.5) { g.destroy(); return false; }
            const tiles = band(r);
            BossFX.drawTiles(g, TS, tiles, C.COL, 1, n, 0, 0, { fill: 0.35 });
            // on your tile: you take it unless a dash covers you (every frame it's on you, not just the first)
            if (!hit && n >= (S._dashInvulnUntil || 0) && tiles.some(([x, y]) => x === S.playerX && y === S.playerY)) { hit = true; TideMother._hurt(S, q, C.UNDER_DMG); }
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

    // ── CAVITATION FIELD ─────────────────────────────────────────────────────
    // Huge bubbles boil up at FIELD.N spots round the room (LevelManager._cavBubble, `field`), each bursting where it
    // sits once FIELD.FUSE runs out, unless a Ripplerunner near one goes into its trance and sends it at you
    // (LevelManager._rippleGod). Each spot is marked the whole time it's there.
    static _field(S, q, now) {
        const T = q.tide, F = TideMother.CFG.FIELD, TS = S.TILE_SIZE, spots = [];
        const free = TideMother._tiles(S, T, (dx, dy) => { const d = Math.hypot(dx, dy); return d >= 2.5 && d <= T.R - 1.5; })
            .filter(([x, y]) => Math.hypot(x - S.playerX, y - S.playerY) >= 2.5 && !T.runes.some(r => Math.hypot(r.tileX - x, r.tileY - y) < 2))
            .sort(() => Math.random() - 0.5);
        for (const p of free) if (spots.length < F.N[T.phase - 1] && spots.every(o => Math.hypot(o[0] - p[0], o[1] - p[1]) >= F.GAP)) spots.push(p);
        for (const [x, y] of spots) {
            const px = (x + 0.5) * TS, py = (y + 0.5) * TS;
            S._cavBubble(px, py, px, py, { form: F.FORM_MS, ms: F.FUSE, r: F.R, dmg: F.DMG, size: F.SIZE, col: F.COL, field: true });
        }
        Sfx.play(S, 'bubbles');
        TideMother._say(S, q, 'CAVITATION', (S.enemies || []).some(e => e._isRipplerunner && e.sprite?.active) ? 'the Ripplerunners will throw them at you' : 'keep clear of them');
        return F.FORM_MS + 600;
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
        C.SMASH.AT.forEach((n, i) => {   // another of her guard, from beside her
            if (T.freed >= n && T.phase < 3) once('smash' + i, () => { if (TideMother._count(S, 'smasher') < C.SMASH.MAX) TideMother._add(S, q, 'smasher', T.cx + (i % 2 ? 3 : -3), T.cy - T.R + 5); });
        });
    }

    // One of hers, on the nearest open floor to (x, y), in her room
    static _add(S, q, kind, x, y) {
        const T = q.tide, ri = T.ri;
        let at = null;
        for (let d = 0; d <= 4 && !at; d++) for (let dx = -d; dx <= d && !at; dx++) for (let dy = -d; dy <= d; dy++) {
            const tx = Math.round(x) + dx, ty = Math.round(y) + dy;
            if (S.world?.[tx]?.[ty] !== S.FLOOR || S.getEnemyAt?.(tx, ty) || S.getPortalAt?.(tx, ty) || (tx === S.playerX && ty === S.playerY) || (tx === T.cx && ty === T.cy)
                || T.runes.some(r => r.tileX === tx && r.tileY === ty)) continue;
            at = [tx, ty]; break;
        }
        if (!at) return null;
        const make = { smasher: (x, y, ri) => TideMother._smasher(S, q, x, y, ri), ripple: S.createRipplerunner, leech: S.createLeech }[kind];
        const e = make?.call(S, at[0], at[1], ri);
        if (!e) return null;
        e.tutorialRoomIndex = ri;
        e._motherBrood = kind;
        if (kind !== 'leech') e._waterNative = true;   // the Cistern's own wade unslowed
        if (T.introDone) Sfx.play(S, 'spawn');
        return e;
    }
    static _count(S, kind) { return (S.enemies || []).filter(e => e._motherBrood === kind && e.sprite?.active && e.health > 0).length; }

    // ── THE SMASHER ──────────────────────────────────────────────────────────
    // Hers, and in the Training Ground (makeSmasher); LevelManager._updateCisternEnemies runs smashTick every frame
    // wherever one is, and killEnemy's _clearCisternGfx takes its clubs.
    static _smasher(S, q, x, y, ri) {
        const e = TideMother.makeSmasher(S, x, y, ri);
        q.tide.smashers.push(e);
        return e;
    }
    static makeSmasher(S, x, y, ri) {
        const K = TideMother.CFG.SMASH, e = S.createEnemy(x, y, K.HP);
        e.tutorialRoomIndex = ri; e._isSmasher = true; e._waterNative = true; e._moveCdMult = K.MOVE;
        e._smash = { state: 'idle', readyAt: S.time.now + 800 + Math.random() * 600 };
        const k = LevelManager.bodyKey(S, 'smasher');   // (assets/art/slime_smasher.png)
        if (k) { e.sprite.setTexture(k, e.sprite.frame?.name ?? 0); e.sprite.play(k + '_idle'); }
        e._clubs = [-1, 1].map(s => S.add.image(e.sprite.x + s * 12, e.sprite.y, 'tm_club').setScale(1.3).setFlipX(s < 0).setDepth((e.sprite.depth || 1) + 0.02));
        e._clubs.forEach(c => S._vfxSort?.(c));
        return e;
    }
    // Every frame, each one: close in, it swings at you (the strike, and the bubble the strike leaves, hanging there
    // for a Ripplerunner to take)
    static smashTick(S, e, now) {
        const K = TideMother.CFG.SMASH, TS = S.TILE_SIZE, s = e._smash, sp = e.sprite;
        if (!sp?.active || e.health <= 0 || !s) return;
        // its clubs ride at its sides; drawn back on a wind-up, snapped out on the strike
        const back = s.state !== 'idle' ? 1 : 0, flick = Math.max(0, 1 - (now - (s.struckAt || -1e9)) / 160);
        const fx = s.dir ? s.dir[0] : 0, fy = s.dir ? s.dir[1] : 0;
        e._clubs?.forEach((c, i) => {
            const side = i ? 1 : -1;
            c.setPosition(sp.x + side * 12 - fx * 5 * back + fx * 14 * flick, sp.y + 2 - fy * 5 * back + fy * 14 * flick)
             .setVisible(sp.visible).setAlpha(sp.alpha).clearTint();
            if (back && Math.floor(now / 60) % 2) c.setTintFill(0xffffff);   // the wind-up: its clubs flash
        });
        if ((e.stunnedUntil || 0) > now || e._iceCube) {   // dazed or frozen: no swing
            if (s.state !== 'idle') { s.state = 'idle'; s.m?.kill(); e._moveCdMult = K.MOVE; }
            return;
        }
        if (s.state === 'idle') {
            if (now < s.readyAt) return;
            const dx = S.playerX - e.x, dy = S.playerY - e.y;
            if (Math.hypot(dx, dy) <= K.REACH) {   // you, close: the swing
                s.dir = [Math.sign(dx), Math.sign(dy)];
                const [fx, fy] = s.dir, seen = new Set();   // the swing: two tiles deep, three wide
                s.tiles = [];
                for (const k of [1, 2]) for (const w of [-1, 0, 1]) {
                    const x = e.x + fx * k - fy * w, y = e.y + fy * k + fx * w;
                    if (S.world?.[x]?.[y] === S.FLOOR && !seen.has(x + ',' + y)) { seen.add(x + ',' + y); s.tiles.push([x, y]); }
                }
                s.state = 'wind'; s.until = now + K.WIND_MS;
                e._moveCdMult = 99;   // it plants itself for the swing
                s.m = BossFX.mark(S, s.tiles, 0xff8a3a, K.WIND_MS, { fill: 0.14 });
                Sfx.play(S, 'tell', { ms: K.WIND_MS });
                return;
            }
            return;
        }
        if (now < s.until) return;
        // the strike: faster than you can see
        s.state = 'idle'; s.readyAt = now + K.CD; s.struckAt = now; e._moveCdMult = K.MOVE;
        s.m?.done(120);
        Sfx.play(S, 'swing'); Sfx.play(S, 'slam');
        S.cameras.main.shake(70, 0.004);
        if (now >= (S._dashInvulnUntil || 0) && s.tiles.some(([x, y]) => x === S.playerX && y === S.playerY)) {
            S.takeDamage(K.DMG * (S.enemyDamageScale || 1));
            S.showStatusText(S.player.x, S.player.y - 30, 'SMASH', '#ffb070');
        }
        // the cavitation bubble the strike leaves: dormant, drifting on a tile, then a wide burst (LevelManager._cavBubble: a
        // Ripplerunner near it takes it and sends it at you)
        const [dx, dy] = s.dir, sx = (e.x + dx + 0.5) * TS, sy = (e.y + dy + 0.5) * TS, n = Math.hypot(dx, dy) || 1;
        S._cavBubble(sx, sy, sx + dx / n * K.DRIFT * TS, sy + dy / n * K.DRIFT * TS, { ms: K.DORMANT_MS, ease: 'Linear', r: K.CAV_R, dmg: K.DMG / 3, wet: false });
    }

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
        at(900, () => {   // her guard clacks its clubs at her
            for (const g of T.smashers) if (g?.sprite?.active) S.showStatusText(g.sprite.x, g.sprite.y - 26, 'CLACK! CLACK!', '#ffb070');
            Sfx.play(S, 'swing');
        });
        T.runes.forEach((r, i) => at(1500 + i * 240, () => {   // the runes light, one by one, and their signs rise over them
            S.tweens.add({ targets: [r.glyph, r.sym], alpha: 1, duration: 200 });
            S.tweens.add({ targets: r.glow, alpha: 0.6, duration: 200 });
            S.tweens.add({ targets: r.chain, alpha: 0.95, duration: 200 });
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
            for (const e of T.smashers) e.tutorialRoomIndex = T.ri;   // her guard's card comes after hers
            if (!S._seenEnemies?.().has('smasher')) (S._encounterQueue ||= []).push('smasher');
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
                ['Riyal', 'You can\'t beat her. Not like this. Her bubbles... lead them into the runes with the same sign. Break the runes, and I can.'],
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
        T.bubble?.destroy();
        for (const b of [...T.bubbles]) b.cont.destroy();
        T.bubbles = [];
        S._cavClear?.();
        for (const p of [...(S.enemyProjectiles || [])]) if (p._tideDrop) { p.gfx?.destroy(); S.enemyProjectiles.splice(S.enemyProjectiles.indexOf(p), 1); }
        TideMother._broodGone(S, q);   // the water goes still: her brood with it
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
    static _broodGone(S, q) {
        for (const e of [...(S.enemies || [])]) if (e._motherBrood && e.sprite?.active) S.killEnemy(e);   // (a Smasher's clubs go with it: _clearCisternGfx)
        q.tide.smashers = [];
    }
    // Everything of hers stops, and her brood goes with her (from _gone, and _destroyPortal should anything kill her)
    static die(S, q) {
        const T = q.tide;
        if (!T) return;
        for (const h of T.haz) h.kill?.();
        T.haz = []; T.later = [];
        T.bubble?.destroy();
        for (const b of T.bubbles) b.cont.destroy();
        T.bubbles = [];
        S._cavClear?.();
        for (const r of T.runes) { r.chain?.destroy?.(); for (const o of [r.sym, r.glow, r.glyph]) if (o?.active) { S.tweens.killTweensOf(o); o.destroy(); } }
        TideMother._broodGone(S, q);
    }

    // ── RIYAL'S CALL (yours once she's free: localStorage ally_riyal) ─────────
    // Your key (Settings 'call'): she comes up out of the floor beside you (at once out of water you're standing in),
    // her wave goes out over CALL.R tiles as a ring of lit tiles and hits only them (CALL.DMG, a CALL.DAZE_MS daze,
    // and it leaves the ground wet), and for CALL.TAUNT_MS she draws whatever's within CALL.TAUNT tiles onto herself
    // (_addAlly, as the Decoy does). Then she sinks. Once every CALL.CD.
    static CALL = { CD: 40000, R: 5, DMG: 28, DAZE_MS: 1200, TAUNT: 5, TAUNT_MS: 3500, HP: 120, RISE_MS: 600, RISE_WET_MS: 150, WET_MS: 6000, WAVE_MS: 380 };
    static hasCall() { try { return localStorage.getItem('ally_riyal') === '1'; } catch (e) { return false; } }
    static call(S) {
        const C = TideMother.CALL, now = S.time.now, TS = S.TILE_SIZE;
        if (!TideMother.hasCall() || !S.player?.active || S._cinemaUntil > now || S.isTutorial || S._rtrial) return;
        const say = (t, c = '#9ff8e4') => S.showStatusText(S.player.x, S.player.y - 28, t, c);
        if ((S.portals || []).some(p => p.tide?.runes.some(r => !r.done))) return say("SHE'S BOUND: FREE HER");   // (the Reservoir, played again)
        if (now < (S._riyalReadyAt || 0)) return say(`${Math.ceil((S._riyalReadyAt - now) / 1000)}s`, '#9ab8b0');
        const wet = S.isWaterAt?.(S.playerX, S.playerY);
        const free = (x, y) => S.world?.[x]?.[y] === S.FLOOR && !S.getEnemyAt?.(x, y) && !(x === S.playerX && y === S.playerY);
        let spot = null;
        for (let r = 1; r <= 2 && !spot; r++) {
            const ring = [];
            for (let dx = -r; dx <= r; dx++) for (let dy = -r; dy <= r; dy++) if (Math.max(Math.abs(dx), Math.abs(dy)) === r && free(S.playerX + dx, S.playerY + dy)) ring.push([S.playerX + dx, S.playerY + dy]);
            spot = ring.sort((a, b) => S.isWaterAt?.(b[0], b[1]) - S.isWaterAt?.(a[0], a[1]))[0] || null;   // water first
        }
        if (!spot) return say('NO ROOM');
        S._riyalReadyAt = now + C.CD;
        const [sx, sy] = spot, px = (sx + 0.5) * TS, py = (sy + 0.5) * TS + (S.SLIME_Y_OFFSET || 0), k = S.SLIME_SCALE * TideMother.CFG.RIYAL_SCALE, rise = wet ? C.RISE_WET_MS : C.RISE_MS;
        const s = S.add.sprite(px, py + 16, 'slime_red', 0).setScale(k, k * 0.2).setAlpha(0).setDepth(S.player.depth - 0.02);
        if (S.anims.exists('red_idle')) s.play('red_idle');
        if (s.preFX) s.preFX.addColorMatrix().hue(TideMother.CFG.RIYAL_HUE); else s.setTint(0x6fffd8);
        S._vfxSort?.(s);
        if (typeof CreatureFX !== 'undefined') CreatureFX.face(S, s, { mood: 'kind' });
        Sfx.play(S, 'bubbles');
        S.tweens.add({ targets: s, y: py, scaleY: k, alpha: 1, duration: rise, ease: 'Back.easeOut' });
        S.showStatusText(px, py - 30, 'RIYAL!', '#9ff8e4');
        let ally = null;
        S.time.delayedCall(rise, () => {
            if (!s.active) return;
            // her wave, on your side this time: a ring of lit tiles going out
            const g = S.add.graphics().setDepth(0.47).setBlendMode(Phaser.BlendModes.ADD);
            S._vfxSort?.(g);
            const band = r => { const out = []; for (let x = sx - C.R - 1; x <= sx + C.R + 1; x++) for (let y = sy - C.R - 1; y <= sy + C.R + 1; y++) { const d = Math.hypot(x - sx, y - sy); if (d <= C.R + 0.5 && Math.abs(d - r) <= 0.6 && S.world?.[x]?.[y] === S.FLOOR) out.push([x, y]); } return out; };
            S.tweens.addCounter({ from: 0, to: 1, duration: C.WAVE_MS, ease: 'Quad.easeOut', onUpdate: tw => { g.clear(); BossFX.drawTiles(g, TS, band(tw.getValue() * C.R), 0x6fffd8, 1, S.time.now, 0, 0, { fill: 0.3 }); },
                onComplete: () => S.tweens.add({ targets: g, alpha: 0, duration: 200, onComplete: () => g.destroy() }) });
            Sfx.play(S, 'splash', { big: true }); S.cameras.main.shake(120, 0.005);
            const dmg = C.DMG * (S.damageScaling || 1), t = S.time.now;
            for (const e of [...(S.enemies || [])]) {
                if (!e.sprite?.active || e.health <= 0 || Math.hypot(e.x - sx, e.y - sy) > C.R || S._phasedOut?.(e)) continue;
                S.damageEnemy(e, dmg, 'physical');
                if (e.health > 0) { e.isStunned = true; e.stunnedUntil = Math.max(e.stunnedUntil || 0, t + C.DAZE_MS); }
            }
            S._hitPortalsAround?.(sx, sy, C.R, dmg);
            for (const b of [S.voltslimeBoss, S.voidSovereignBoss, S.fractureCore]) if (b?.active && Math.hypot(b.tileX - sx, b.tileY - sy) <= C.R) S.damageBossAtTile(b.tileX, b.tileY, dmg, 'riyal', 'physical');
            for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) S.addWater?.(sx + dx, sy + dy, C.WET_MS);
            // and everything near her comes for her instead of you, for a while
            ally = S._addAlly({ x: sx, y: sy, hp: C.HP, taunt: C.TAUNT, until: t + C.TAUNT_MS,
                hurt: amt => { ally.hp -= amt; if (s.active) { s.setTintFill(0xffffff); S.time.delayedCall(80, () => s.active && s.clearTint()); } },
                onEnd: () => S.tweens.add({ targets: s, y: py + 16, scaleY: k * 0.2, alpha: 0, duration: 400, ease: 'Quad.easeIn', onComplete: () => s.destroy() }) });
        });
    }
    // Her socket, left of the gadgets' (FieldKit.updateFieldKit, every frame): her face, its key, the cooldown sweeping down
    static callHud(S) {
        const on = TideMother.hasCall() && S.player?.active && !S.isTutorial && !S._rtrial && !S._deathScreenActive;
        const H = S._riyalSock;
        if (!on) { if (H) { H.g.setVisible(false); H.face.setVisible(false); H.key.setVisible(false); H.txt.setVisible(false); } return; }
        const W = S.scale.width, cx = W / 2 - 236 - 54, cy = S.scale.height - 34, R = 21;   // left of the gadgets (right of them is the gems)
        if (!H || !H.g.active) {
            const g = S.add.graphics().setScrollFactor(0).setDepth(40);
            const face = S.add.sprite(cx, cy + 4, 'slime_red', 0).setScrollFactor(0).setDepth(40.5).setScale(1.1);
            if (face.preFX) face.preFX.addColorMatrix().hue(TideMother.CFG.RIYAL_HUE); else face.setTint(0x6fffd8);
            const key = S.add.text(cx, cy + R + 7, Settings.label(Settings.key('call')), { fontSize: '11px', fontFamily: 'monospace', fontStyle: 'bold', color: '#d2bf98', stroke: '#000', strokeThickness: 2 }).setOrigin(0.5).setScrollFactor(0).setDepth(41);
            const txt = S.add.text(cx, cy, '', { fontSize: '16px', fontFamily: 'monospace', fontStyle: 'bold', color: '#ffffff', stroke: '#000', strokeThickness: 3 }).setOrigin(0.5).setScrollFactor(0).setDepth(41);
            S._riyalSock = { g, face, key, txt };
        }
        const K = S._riyalSock, left = Math.max(0, (S._riyalReadyAt || 0) - S.time.now), frac = left / TideMother.CALL.CD;
        K.face.setVisible(true).setAlpha(left > 0 ? 0.45 : 1); K.key.setVisible(true);
        K.g.clear().setVisible(true);
        K.g.fillStyle(0x000000, 0.5).fillCircle(cx + 1, cy + 2, R + 3);
        K.g.fillStyle(0x2e2a26, 1).fillCircle(cx, cy, R + 2);
        K.g.fillStyle(0x12201e, 1).fillCircle(cx, cy, R - 1);
        K.g.fillStyle(0x6fffd8, left > 0 ? 0.1 : 0.28).fillCircle(cx, cy, R - 4);
        if (left > 0) { K.g.fillStyle(0x000000, 0.55).slice(cx, cy, R - 1, -Math.PI / 2, -Math.PI / 2 + frac * Math.PI * 2, false).fillPath(); }
        K.txt.setText(left > 0 ? String(Math.ceil(left / 1000)) : '').setVisible(left > 0);
    }

    // ── BITS ─────────────────────────────────────────────────────────────────
    // The arena's floor tiles where fn(dx, dy) holds (dx, dy from the middle, in tiles)
    static _tiles(S, T, fn) {
        const out = [];
        for (let x = T.cx - T.R; x <= T.cx + T.R; x++) for (let y = T.cy - T.R; y <= T.cy + T.R; y++) {
            const dx = x - T.cx, dy = y - T.cy;
            if (S.world?.[x]?.[y] === S.FLOOR && Math.hypot(dx, dy) <= T.R + 0.5 && fn(dx, dy)) out.push([x, y]);
        }
        return out;
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
