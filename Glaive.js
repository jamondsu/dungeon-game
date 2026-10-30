// ═══════════════════════════════════════════════════════════════════════════
// Glaive.js — the Thunder Glaive (lightning, tier 5): a long stormwood glaive, its blade alight with current
// Click: PIVOT STRIKE. The enemy nearest the cursor within PIVOT_R tiles of you (more with Long Pivot) is your pivot: while
// you hold the glaive a thin arc reaches for it from the blade and its crackle flares. You dash through it and on past it (the
// closer you start, the further you pierce: PIERCE_K less how far it was, PIERCE_MIN to PIERCE_MAX tiles), short of a wall or
// a boss, landing on the last free tile (in a pack you can land in the middle of it). Untouchable while you go. Everything on
// the line takes DMG and is Amped, all but the insulated (armoured, or made of lightning: hit, never Amped); each enemy struck
// is a VOLT (VOLT_MAX in the tank). Each dash leaves a ROPE of crackling current along the way you went. Click a new pivot
// within STREAK_MS of landing and the STREAK goes on, each link LINK_UP harder (never off the same enemy twice running; no one
// to pivot off, a click does nothing).
// THE NETWORK does the damage: the ropes (live ROPE_LIFE after their boom, ROPE_CAP at most), the cage's fences and the coils'.
// Every PULSE_MS, while there are volts, current runs through it: every Amped enemy (never the insulated) within NET_R tiles of
// a line (more with Thick Ropes), within ZAP_R of a coil or inside the cage picks it up, and it jumps on from enemy to Amped
// enemy within CHAIN_R (FRONT_R more a level of Storm Front), FORKS ways from each, CHAIN_CAP enemies at most. Each one it
// reaches takes PULSE_DMG x (1 + CHAIN_UP for every other enemy in the chain), at most x CHAIN_MAX (a level of Storm Front: FRONT_UP
// and FRONT_MAX more): a crowd takes it everywhere at once, a little harder each.
// VOLTS ARE FUEL: pulsing costs PULSE_COST volts a PULSE_MS (whatever the pulse rate), and every coil with an enemy near it
// draws a volt every DRAIN_MS. At 0 the network goes quiet (the coils dim, no zaps, no pulses, no coil fences) till you dash for more.
// The STREAK ENDS when its time runs out, no pivot is left, or at MAX_LINKS: a FUSE races down the ropes in the order you laid
// them (FUSE_MS), then they all go off at once: everything within DET_R tiles of one takes ROPE_DMG x (1 + ROPE_UP a link: the streak is what makes it),
// x AMP_MUL if it's Amped, and is dazed DAZE_MS; the insulated take nothing; a rope over water runs through the pool. The boom
// POWERS the network: REFUND volts a link back, and OVERLOAD for OVL_MS a link past the first (the pulses OVL_RATE times as
// often, for no more volts a second, and OVL_MUL as hard). Then END_CD before a new one.
// The boom leaves a CAGE for CAGE_MS: a post where each linked enemy stood, and live FENCES post to post (from three posts,
// round from the last back to the first). A new boom's cage takes the old one's place.
// R (PLANT volts): a TESLA COIL at your feet for COIL_MS, up to COIL_MAX standing (another takes the oldest's place, one planted
// on a coil takes that one's). Coils within LINK_R tiles of each other are fenced together, and each cage post to its nearest
// coil in reach. Every ZAP_MS a powered coil zaps the ZAP_N enemies nearest it within ZAP_R tiles: ZAP_DMG (x AMP_MUL if it's
// Amped), Amped. While coils stand every rope runs a spoke to its nearest one, and when a streak of SKY_L links or more goes off
// a bolt from the sky slams onto each, bursting COIL_R tiles round it (COIL_DMG x (1 + SKY_UP a link): the show, not the damage).
// A fence (the cage's or a coil's): an enemy that crosses it (or steps onto or off one) is shocked: FENCE_DMG (x AMP_MUL if it's
// Amped), Amped, dazed FENCE_DAZE; once a fence every FENCE_CD at most; the insulated shrug fences and zaps off.
// Overcharge (a perk): a kill on a link's line keeps the streak open OVER_MS longer.
// A BOSS: with no one else to pivot off, you dash at it, stop short and strike it (a volt). The current and the coils' zaps reach
// it at BOSS_MUL, and it passes nothing on; the sky bursts never hit it.
// Art: assets/art/fx_glaive (glaive_e/ne/s/se_0-2, trail_*, hit_0-3, coil_0-3, post_0-3, mote_0-7); ropes, fences, zaps and bolts are WeaponSystem.bolt.
// ═══════════════════════════════════════════════════════════════════════════
class Glaive {
    static CFG = { PIVOT_R: 5, PIVOT_UP: 1, PIERCE_K: 6, PIERCE_MIN: 1.5, PIERCE_MAX: 4, MS: 110, HOLD: 170, WIDTH: 0.8, SCALE: 1.5, JAB: 12,   // (JAB: px the glaive is thrust out ahead of you)
        DMG: 8, LINK_UP: 0.2, STREAK_MS: 1000, LINK_GAP: 200, MAX_LINKS: 10, GRACE: 150, END_CD: 500, OVER_MS: 600, AIM_MS: 80,   // (GRACE: a beat after you land before "no pivot left" ends it; AIM_MS: the arc to your pivot re-strikes this often)
        ROPE_DMG: 4, ROPE_UP: 1.25, DET_R: 1, THICK_UP: 0.25, AMP_MUL: 1.5, ROPE_MS: 60, DAZE_MS: 500,   // (ROPE_MS: how often a rope's crackle is laid again)
        FUSE_MS: 250, SPOKE_MS: 90, STOP_MS: 70, PIERCE_STOP: 35,   // the fuse down the ropes, then down the spokes to a coil; the hitstops (ms, real time)
        PLANT: 1, COIL_MS: 15000, COIL_MAX: 3, LINK_R: 8, COIL_R: 2.5, COIL_UP: 0.15, COIL_DMG: 2, SKY_UP: 0.25, SKY_L: 2,   // the coils: cost, time, how many, fence reach, burst (COIL_UP tiles a link; SKY_L links for it)
        ZAP_MS: 1000, ZAP_N: 5, ZAP_R: 3, ZAP_DMG: 5, BOSS_MUL: 0.4,   // a coil's zaps (BOSS_MUL: a boss takes this much of a zap, or of the current)
        ROPE_LIFE: 6000, ROPE_CAP: 16, NET_R: 1, PULSE_MS: 500, PULSE_DMG: 9, CHAIN_R: 2.5, FORKS: 3, CHAIN_UP: 0.1, CHAIN_MAX: 1.5, CHAIN_CAP: 12, FRONT_R: 0.5, FRONT_UP: 0.05, FRONT_MAX: 0.15,   // the network (a level of Storm Front: FRONT_R tiles, FRONT_UP on CHAIN_UP, FRONT_MAX on CHAIN_MAX)
        VOLT_MAX: 24, LOW: 6, PULSE_COST: 0.5, DRAIN_MS: 1000, REFUND: 2, OVL_MS: 600, OVL_RATE: 2, OVL_MUL: 2,   // the fuel, and the boom's overload (OVL_MS a link past the first)
        CAGE_MS: 6000, FENCE_DMG: 6, FENCE_DAZE: 400, FENCE_CD: 1000, FENCE_MS: 80, POST_S: 1.25, POST_TOP: 17 };   // the cage (POST_TOP: px from a post's foot up to its insulator, where the fences hang)
    // eighths of a turn clockwise from east: the frame, and whether it's flipped both ways
    static DIRS = [['e', 0], ['se', 0], ['s', 0], ['ne', 1], ['e', 1], ['se', 1], ['s', 1], ['ne', 0]];
    static held(S) { return S.currentElement === 'lightning' && S.equippedWeapons?.lightning === 'thunder_glaive'; }
    static perk(k) { return WeaponLevels.perk('thunder_glaive', k) || 0; }
    static range() { return Glaive.CFG.PIVOT_R + Glaive.CFG.PIVOT_UP * Glaive.perk('reach'); }
    static insulated(e) { return !!(e._isArmored || e.isElectrical); }
    static st(S) {
        if (!S._glv) {
            S._glv = { volts: 0, readyAt: 0, streak: null, coils: [], cage: null, seen: new Map(), cd: new Map(), fenceAt: 0, press: null, thrust: null, ropeAt: 0, aimAt: 0, fx: null,
                ropes: [], netAt: 0, ropeNetAt: 0, pulseAt: 0, hot: false, ovlUntil: 0, ovlMs: 0, draw: 0 };   // (ropes: the boomed ones still live; draw: volts a second going out)
            S.events.once('shutdown', () => { S._glv = null; S._glvBar = null; });
            const A = S.anims, mk = (key, frames, rate, repeat = 0) => { if (!A.exists(key)) A.create({ key, frames: frames.map(f => ({ key: 'fx_glaive', frame: f })), frameRate: rate, repeat }); };
            mk('glv_hit', ['hit_0', 'hit_1', 'hit_2', 'hit_3'], 22);
            mk('glv_coil', ['coil_0', 'coil_1', 'coil_2', 'coil_3'], 10, -1);
            mk('glv_post', ['post_0', 'post_1', 'post_2', 'post_3'], 12, -1);
            for (const d of ['e', 'ne', 's', 'se']) { mk('glv_' + d, [0, 1, 2].map(k => `glaive_${d}_${k}`), 16, -1); mk('glv_trail_' + d, [0, 1, 2].map(k => `trail_${d}_${k}`), 11); }
        }
        return S._glv;
    }
    // The current, a scene's particle emitters, made the first time: sparks cooling white -> gold -> amber, sparks cooling
    // white -> electric blue, a soft blue light. F.dir ([degrees, spread]) throws them one way.
    static fx(S) {
        const st = Glaive.st(S), ADD = Phaser.BlendModes.ADD;
        if (st.fx?.gold?.active) return st.fx;
        const F = { dir: null }, motes = Array.from({ length: 8 }, (_, i) => 'mote_' + i);
        const ang = () => F.dir ? F.dir[0] + (Math.random() - 0.5) * F.dir[1] : Math.random() * 360;
        F.gold = S.add.particles(0, 0, 'fx_glaive', { frame: motes, emitting: false, lifespan: { min: 220, max: 560 }, speed: { min: 50, max: 190 },
            angle: { onEmit: ang }, gravityY: 260, scale: { start: 1.6, end: 1 }, alpha: { start: 1, end: 0 },
            color: [0xffffff, 0xfff6b0, 0xffd23a, 0xb86a10, 0x5a2a08], colorEase: 'quad.out', blendMode: ADD, maxParticles: 500 }).setDepth(4.3);
        F.blue = S.add.particles(0, 0, 'fx_glaive', { frame: motes, emitting: false, lifespan: { min: 160, max: 420 }, speed: { min: 30, max: 150 },
            angle: { onEmit: ang }, gravityY: 120, scale: { start: 1.5, end: 0.9 }, alpha: { start: 1, end: 0 },
            color: [0xffffff, 0xd4f6ff, 0x5ac8ff, 0x1a5090], colorEase: 'quad.out', blendMode: ADD, maxParticles: 500 }).setDepth(4.25);
        F.glow = S.add.particles(0, 0, 'vfx_glow', { emitting: false, lifespan: { min: 180, max: 320 }, speed: { min: 0, max: 12 },
            scale: { start: 0.3, end: 0.1 }, alpha: { start: 0.16, end: 0 }, color: [0xd4f6ff, 0x5ac8ff, 0x1a3a8a], blendMode: ADD }).setDepth(4.2);
        return (st.fx = F);
    }

    // A lightning hit on e: through resistance and your damage (resolveElementalHit), its number, the charge. 'kill' if it died.
    static hit(S, e, dmg) {
        if (S._roomGated?.() && e.tutorialRoomIndex !== undefined && e.tutorialRoomIndex !== S.getCurrentPlayerRoom()) return false;   // a room you haven't entered
        const d = S.resolveElementalHit(e, dmg, 'lightning');
        if (d === null) return false;
        e.health -= d; e._hurtAt = S.time.now;
        S.showDamageNumber(e.sprite.x, e.sprite.y - 10, d, '#ffff44');
        CombatSystem.hitFlash(S, e, d, 'lightning', true);
        S.updateEnemyHealthBar(e);
        if (!e._noUlt) S.gainUltCharge?.(S.ultChargePerLightningHit, 'lightning');
        if (e.health <= 0) { S.killEnemy(e); return 'kill'; }
        return true;
    }
    // Amp it, unless it's insulated (then it says so, now and then)
    static amp(S, e) {
        if (!e.sprite?.active || e.health <= 0) return;
        if (!Glaive.insulated(e)) { S._superconduct(e); return; }
        if (S.time.now - (e._insulatedAt || -1e9) > 2500) { e._insulatedAt = S.time.now; S.showStatusText?.(e.sprite.x, e.sprite.y - 20, 'INSULATED', '#cdbf9f'); }
    }
    // A boss or a queen standing on (x, y) (a Lunge stops short of one), or null
    static bigAt(S, x, y) {
        for (const p of S.portals || []) if (p.active && S._portalCoversTile?.(p, x, y)) return p;
        for (const B of Glaive.bosses(S)) if (Math.abs(x - B.x) <= B.r && Math.abs(y - B.y) <= B.r) return B.b;
        return null;
    }
    // the bosses about: [{ b, x, y, r, px, py }] (its tile, how many tiles round it its body reaches, its middle in px)
    static bosses(S) {
        const T = S.TILE_SIZE, out = [];
        for (const b of [S.voltslimeBoss, S.voidSovereignBoss, S.fractureCore]) {
            if (!b?.active || !b.container) continue;
            out.push({ b, x: b.tileX ?? Math.floor(b.container.x / T), y: b.tileY ?? Math.floor(b.container.y / T), r: b === S.voidSovereignBoss ? 2 : 1, px: b.container.x, py: b.container.y - 6 });
        }
        return out;
    }
    static gain(S, n) {
        const C = Glaive.CFG, st = Glaive.st(S), was = st.volts;
        st.volts = Math.min(C.VOLT_MAX, st.volts + n);
        if (was < C.PLANT && st.volts >= C.PLANT && Glaive.held(S)) Sfx.play(S, 'rready', { el: 'lightning' });
    }
    // the fuel going out (volts are kept to the hundredth; empty, the network goes quiet)
    static spend(S, n) {
        const st = S._glv, was = st?.volts;
        if (!st) return;
        st.volts = Math.max(0, Math.round((st.volts - n) * 100) / 100);
        if (was > 0 && !st.volts && Glaive.held(S)) Sfx.play(S, 'deny', { soft: true });   // (the network going quiet)
    }
    static overload(S) { return (S._glv?.ovlUntil || 0) > S.time.now; }
    static powered(S) { return (S._glv?.volts || 0) > 0 || Glaive.overload(S); }
    // the coil nearest tile (x, y) within r tiles, or null
    static nearCoil(S, x, y, r = Infinity) {
        let best = null, bd = r;
        for (const c of S._glv?.coils || []) { const d = Math.hypot(c.x - x, c.y - y); if (d <= bd) { best = c; bd = d; } }
        return best;
    }

    // ── the pivot ──
    // Your dash off enemy e: the line from you through it and on past it, tile by tile, short of a wall (or a corner it can't
    // squeeze past) or a boss; it has to get through e. You land on the last free tile past e, else the last free one short of
    // it. Null if the line can't get through it.
    static plan(S, e) {
        const C = Glaive.CFG, ox = S.playerX, oy = S.playerY, d0 = Math.hypot(e.x - ox, e.y - oy);
        if (d0 < 0.5) return null;
        const ux = (e.x - ox) / d0, uy = (e.y - oy) / d0, total = d0 + Math.min(C.PIERCE_MAX, Math.max(C.PIERCE_MIN, C.PIERCE_K - d0));   // (the closer you start, the further you pierce)
        const tiles = [];
        let px = ox, py = oy, big = null;
        for (let s = 0.25; s <= total + 0.01; s += 0.25) {
            const x = Math.round(ox + ux * s), y = Math.round(oy + uy * s);
            if (x === px && y === py) continue;
            if (!S._dashCanEnter(x, y) || (x !== px && y !== py && !S._dashCanEnter(px, y) && !S._dashCanEnter(x, py))) break;
            const b = Glaive.bigAt(S, x, y);
            if (b) { big = { b, x, y }; break; }
            tiles.push([x, y]); px = x; py = y;
        }
        const at = tiles.findIndex(([x, y]) => x === e.x && y === e.y);
        if (at < 0) return null;
        let land = null;
        for (let i = tiles.length - 1; i > at && !land; i--) if (!S.getEnemyAt(...tiles[i])) land = tiles[i];
        for (let i = at - 1; i >= 0 && !land; i--) if (!S.getEnemyAt(...tiles[i])) land = tiles[i];
        return { e, ux, uy, tiles, land, end: tiles[tiles.length - 1], big };
    }
    // Your dash at boss B (one of bosses()): the line toward it, short of a wall, till its body; you stop on the last free tile
    // short of it and strike it. Null if the line doesn't reach it.
    static planBoss(S, B) {
        const ox = S.playerX, oy = S.playerY, d0 = Math.hypot(B.x - ox, B.y - oy), tiles = [];
        if (d0 < 0.5) return null;
        const ux = (B.x - ox) / d0, uy = (B.y - oy) / d0;
        let px = ox, py = oy, big = null;
        for (let s = 0.25; s <= d0 + 0.01; s += 0.25) {
            const x = Math.round(ox + ux * s), y = Math.round(oy + uy * s);
            if (x === px && y === py) continue;
            if (!S._dashCanEnter(x, y) || (x !== px && y !== py && !S._dashCanEnter(px, y) && !S._dashCanEnter(x, py))) break;
            const b = Glaive.bigAt(S, x, y);
            if (b) { if (b === B.b) big = { b, x, y }; break; }
            tiles.push([x, y]); px = x; py = y;
        }
        if (!big) return null;
        let land = null;
        for (let i = tiles.length - 1; i >= 0 && !land; i--) if (!S.getEnemyAt(...tiles[i])) land = tiles[i];
        return { e: B.b, at: [B.x, B.y], px: B.px, py: B.py, ux, uy, tiles, land, end: tiles[tiles.length - 1] || [ox, oy], big };
    }
    // The pivot for a cursor at (wx, wy) (world px): the enemy nearest it within reach of you that you can dash through (never
    // the one you last pivoted off), and its plan; null if there's none
    static pick(S, wx, wy) {
        const T = S.TILE_SIZE, last = S._glv?.streak?.last, cx = wx / T - 0.5, cy = wy / T - 0.5, R = Glaive.range();
        const near = (S.enemies || []).filter(e => e !== last && e.sprite?.active && e.health > 0 && !S._phasedOut?.(e)
            && Math.hypot(e.x - S.playerX, e.y - S.playerY) <= R && S.isInCurrentRoom(e.x, e.y))
            .sort((a, b) => Math.hypot(a.x - cx, a.y - cy) - Math.hypot(b.x - cx, b.y - cy));
        for (const e of near.slice(0, 6)) { const p = Glaive.plan(S, e); if (p) return p; }
        for (const B of Glaive.bosses(S)) if (B.b !== last && Math.hypot(B.x - S.playerX, B.y - S.playerY) <= R + B.r) { const p = Glaive.planBoss(S, B); if (p) return p; }   // (no one else to pivot off: a boss)
        return null;
    }

    // ── click: Pivot Strike ──
    static attack(S, targetX, targetY) {
        const C = Glaive.CFG, st = Glaive.st(S), now = S.time.now, T = S.TILE_SIZE;
        const press = S.input?.activePointer?.downTime;
        if (press != null && press === st.press) return;   // (a link a click: held down, it doesn't chain itself)
        if (S._lifting || S._deathScreenActive || !S.player?.active || now < (S._glideUntil || 0)) return;   // (still dashing)
        if (st.streak ? st.streak.fuse || now < st.streak.landAt + C.LINK_GAP : now < st.readyAt) return;   // (lit, it's going off)
        const cam = S.cameras.main, p = Glaive.pick(S, targetX + cam.scrollX, targetY + cam.scrollY);
        if (!p) return;   // no one to pivot off: nothing, and a streak keeps its time
        st.press = press; S._gearFiredAt = now;
        const ox = S.playerX, oy = S.playerY, sk = st.streak ||= { links: 0, ropes: [], pivots: [], start: [ox, oy], last: null, landAt: 0, until: 0 };
        const link = ++sk.links;
        sk.last = p.e; sk.pivots.push([p.e, ...(p.at || [p.e.x, p.e.y])]);   // (where it stood, if it's gone by the boom)
        const dmg = C.DMG * (1 + C.LINK_UP * (link - 1)) * (S.damageScaling || 1), a = Math.atan2(p.uy, p.ux), deg = a * 180 / Math.PI;
        const k8 = ((Math.round(a / (Math.PI / 4)) % 8) + 8) % 8;
        // you go: the glide (as a dash's), untouchable till just after you land; rooted, you strike from where you stand
        const land = S._playerRooted || S._csRooted?.() || S._frostPinned?.() ? null : p.land;
        const x0 = S.player.x, y0 = S.player.y;
        let x1 = x0, y1 = y0;
        if (land) {
            const [lx, ly] = land;
            x1 = lx * T + T / 2; y1 = ly * T + T / 2 + (S.SLIME_Y_OFFSET || 0);
            S.tweens.killTweensOf(S.player);
            S.playerX = lx; S.playerY = ly; S._step = null; S.lastMoveTime = now;
            S._glideUntil = now + C.MS; S._glide = { x0, y0, x1, y1, t0: now, dur: C.MS, ice: false };
            S._updateGlide?.(now + 16);
            S._checkRoomNameDisplay?.(); S._onPlayerStepWater?.(lx, ly, now);
            if (S.isLevel4) S._onPlayerStepCrumble?.(lx, ly);
        }
        S._dashInvulnUntil = Math.max(S._dashInvulnUntil || 0, now + C.MS + 120);
        sk.landAt = now + C.MS; sk.until = sk.landAt + C.STREAK_MS;
        Glaive.thrustFx(S, k8, x0, y0, x1, y1, land ? Math.max(Math.abs(land[0] - ox), Math.abs(land[1] - oy)) : 0);
        // the rope, along the way you went (to the pivot, if you couldn't get past it)
        const to = land || p.at || [p.e.x, p.e.y];
        sk.ropes.push({ ax: ox * T + T / 2, ay: oy * T + T / 2 + 4, bx: to[0] * T + T / 2, by: to[1] * T + T / 2 + 4, tx0: ox, ty0: oy, tx1: to[0], ty1: to[1], at: sk.landAt });
        // the hits along the line (to where it stopped), each as you pass it
        const [ex, ey] = p.end, len = Math.max(1, Math.hypot(ex - ox, ey - oy));
        for (const e of (S.enemies || []).filter(o => o.sprite?.active && o.health > 0 && !S._phasedOut?.(o) && (o.x !== ox || o.y !== oy)
            && S.distancePointToSegment(o.x, o.y, ox, oy, ex, ey) <= C.WIDTH)) {
            const along = (e.x - ox) * p.ux + (e.y - oy) * p.uy;
            S.time.delayedCall(C.MS * Math.min(1, Math.max(0, along - 0.5) / len), () => {
                if (!e.sprite?.active || e.health <= 0 || S._deathScreenActive) return;
                const hx = e.sprite.x, hy = e.sprite.y - 6, r = Glaive.hit(S, e, dmg);
                if (r === false) return;
                Glaive.gain(S, 1);
                if (r === 'kill') { if (Glaive.perk('over') && st.streak === sk) { sk.until += C.OVER_MS; S.showStatusText?.(S.player.x, S.player.y - 34, 'OVERCHARGE', '#fff3a0'); } }
                else Glaive.amp(S, e);
                Glaive.flare(S, hx, hy, deg);
                Glaive.volt(S, hx, hy);
                if (e === p.e) { Glaive.hitstop(S, C.PIERCE_STOP); Sfx.play(S, 'orbhit'); S.cameras.main.shake(60, 0.004); }   // (the pivot: a crack you feel)
                else Sfx.play(S, 'zap', { soft: true });
            });
        }
        // a boss or queen it stopped at
        if (p.big) {
            const { b, x, y } = p.big;
            if (S.portals?.includes(b)) S.damagePortal(b, dmg); else S.damageBossAtTile?.(x, y, dmg, undefined, 'lightning');
            Glaive.gain(S, 1); Glaive.flare(S, x * T + T / 2, y * T + T / 2, deg);
        }
        if (link > 1) S.showStatusText?.(S.player.x, S.player.y - 40, `×${link}`, '#fff3a0');
        Glaive.bar(S);
    }

    // A dash's look: the glaive thrust out along it (crackling, then gone), your streak down the line and your
    // afterimages, sparks thrown back from where you left and a flash where you land
    static thrustFx(S, k8, x0, y0, x1, y1, steps) {
        const C = Glaive.CFG, st = Glaive.st(S), F = Glaive.fx(S), T = S.TILE_SIZE, ADD = Phaser.BlendModes.ADD, [f, fl] = Glaive.DIRS[k8], now = S.time.now;
        st.thrust?.spr?.destroy(); st.thrust?.glow?.destroy();
        const z = (S.player.depth ?? 1) + (k8 >= 5 ? -0.03 : 0.03);   // (aimed up, it's behind you)
        const spr = S.add.sprite(x0, y0, 'fx_glaive', `glaive_${f}_0`).setScale(C.SCALE).setFlip(!!fl, !!fl).setDepth(z).play('glv_' + f);
        const glow = S.add.image(x0, y0, 'vfx_glow').setTint(0x7ad8ff).setBlendMode(ADD).setScale(0.4).setAlpha(0.22).setDepth(z - 0.01);
        st.thrust = { spr, glow, t0: now, a: k8 * Math.PI / 4 };
        S._scytheSpinUntil = now + C.MS + C.HOLD + 60;   // (the glaive in your hand is the one thrust out)
        const a = k8 * Math.PI / 4, ux = Math.cos(a), uy = Math.sin(a), deg = k8 * 45, back = deg + 180;
        // where you leave from: a crack of light, sparks thrown back
        S._vfxFlash?.(x0, y0 - (S.SLIME_Y_OFFSET || 0), 28, 0x9fe8ff, 160, 0.35);
        F.dir = [back, 70]; F.blue.emitParticleAt(x0, y0 + 4, 10); F.gold.emitParticleAt(x0, y0 + 4, 4); F.dir = null;
        if (!steps) return;
        // the streak: a piece a tile, each lit as you pass it, fraying out behind you
        const tf = { 0: 'e', 1: 'se', 2: 's', 3: 'ne', 4: 'e', 5: 'se', 6: 's', 7: 'ne' }[k8], dx = (x1 - x0) / steps, dy = (y1 - y0) / steps;
        for (let k = 0; k < steps; k++) S.time.delayedCall(C.MS * k / steps, () => {
            const px = x0 + dx * (k + 0.5), py = y0 + dy * (k + 0.5) - (S.SLIME_Y_OFFSET || 0) + 4;
            const t = S.add.sprite(px, py, 'fx_glaive', `trail_${tf}_0`).setScale(2).setBlendMode(ADD).setAlpha(0.85).setDepth(0.95).setFlip(Math.random() < 0.5, Math.random() < 0.5).play({ key: 'glv_trail_' + tf, delay: 40 + 30 * (steps - k) });   // (on the floor, under what it struck)
            t.once('animationcomplete', () => S.tweens.add({ targets: t, alpha: 0, duration: 120, onComplete: () => t.destroy() }));
            F.blue.emitParticleAt(px + (Math.random() - 0.5) * T * 0.6, py + (Math.random() - 0.5) * T * 0.4, 2);
            F.glow.emitParticleAt(px, py, 1);
        });
        // your afterimages down the line, in the current's blue
        const p = S.player;
        for (let k = 1; k <= 3; k++) {
            const g = S.add.sprite(x0 + (x1 - x0) * (k / 4), y0 + (y1 - y0) * (k / 4), p.texture.key, p.frame.name).setScale(p.scaleX, p.scaleY).setFlipX(p.flipX)
                .setTintFill(k === 3 ? 0xd4f6ff : 0x5ac8ff).setBlendMode(ADD).setAlpha(0.2 + 0.12 * k).setDepth(p.depth - 0.01);
            S.tweens.add({ targets: g, alpha: 0, duration: 200 + 40 * k, delay: C.MS * k / 4, onComplete: () => g.destroy() });
        }
        // and where you land
        S.time.delayedCall(C.MS, () => {
            if (!S.player?.active) return;
            S._vfxFlash?.(x1 + ux * 10, y1 - (S.SLIME_Y_OFFSET || 0) + uy * 10, 32, 0xd4f6ff, 180, 0.35);
            F.dir = [deg, 80]; F.gold.emitParticleAt(x1 + ux * 16, y1 + uy * 16, 8); F.blue.emitParticleAt(x1 + ux * 16, y1 + uy * 16, 6); F.dir = null;
        });
    }
    // a hit's flare at (x, y), the strike's direction `deg`: the hand-drawn burst, sparks thrown on the way it went
    static flare(S, x, y, deg) {
        const F = Glaive.fx(S), h = S.add.sprite(x, y, 'fx_glaive', 'hit_0').setScale(1.25).setAlpha(0.85).setBlendMode(Phaser.BlendModes.ADD).setDepth(4.35).setFlip(Math.random() < 0.5, Math.random() < 0.5).play('glv_hit');
        h.once('animationcomplete', () => h.destroy());
        F.dir = [deg, 90]; F.blue.emitParticleAt(x, y, 6); F.gold.emitParticleAt(x, y, 3); F.dir = null;
        S._vfxFlash?.(x, y, 18, 0x9fe8ff, 120, 0.3);
    }
    // a volt flying from (x, y) to you
    static volt(S, x, y) {
        const m = S.add.image(x, y, 'fx_glaive', 'mote_3').setScale(1.8).setTint(0xffe14a).setBlendMode(Phaser.BlendModes.ADD).setDepth(4.4);
        S.tweens.add({ targets: m, x: { getEnd: () => S.player?.x ?? x }, y: { getEnd: () => (S.player?.y ?? y) - 4 }, scale: 1, duration: 260, delay: 60, ease: 'Quad.easeIn',
            onComplete: () => { m.destroy(); if (S.player?.active) Glaive.fx(S).gold.emitParticleAt(S.player.x, S.player.y - 4, 2); } });
    }


    // A beat of held time (ms, real time): tweens, timers and animations all but stop, then go on (a hit you feel)
    static hitstop(S, ms) {
        if (S._pauseMenuOpen || S._forkStop || !(ms > 0)) return;
        const until = performance.now() + ms;
        if ((S._glvStopUntil || 0) >= until) return;
        S._glvStopUntil = until;
        S._glvPrev ||= [S.tweens.timeScale, S.time.timeScale, S.anims.globalTimeScale];   // (whatever pace it ran at, back after)
        S.tweens.timeScale = S.time.timeScale = S.anims.globalTimeScale = 0.02;
        setTimeout(() => {
            if (performance.now() + 2 < S._glvStopUntil || !S._glvPrev) return;
            [S.tweens.timeScale, S.time.timeScale, S.anims.globalTimeScale] = S._glvPrev; S._glvPrev = null;
        }, ms);
    }

    // ── the streak's end ──
    // Its fuse is lit: current races down the ropes in the order you laid them (then in along the spokes to the coils); tick
    // draws it and sets the boom off when it's done
    static light(S) {
        const sk = S._glv?.streak;
        if (!sk || sk.fuse) return;
        sk.fuse = { t0: S.time.now, ms: Glaive.CFG.FUSE_MS, spokes: S._glv.coils.length ? Glaive.CFG.SPOKE_MS : 0 };
        Sfx.play(S, 'blburst');
    }
    // the web as segments: each rope, and with coils up a spoke from each rope's end to its nearest ([tile x0, y0, x1, y1, px x0, y0, x1, y1])
    static web(S, sk) {
        const out = sk.ropes.map(r => [r.tx0, r.ty0, r.tx1, r.ty1, r.ax, r.ay, r.bx, r.by]);
        for (const r of sk.ropes) { const c = Glaive.nearCoil(S, r.tx1, r.ty1); if (c) out.push([r.tx1, r.ty1, c.x, c.y, r.bx, r.by, c.px, c.py]); }
        return out;
    }
    // e struck for d (x AMP_MUL if it's Amped), its flare, dazed `daze` (if any); into `caught`
    static strike(S, e, d, caught, daze) {
        const x = e.sprite.x, y = e.sprite.y - 6, amped = e.isSuperConducted && e.superConductUntil > S.time.now;
        if (Glaive.hit(S, e, d * (amped ? Glaive.CFG.AMP_MUL : 1)) === false) return;
        caught.push(e); Glaive.flare(S, x, y, Math.random() * 360);
        if (daze && e.sprite?.active && e.health > 0) S._condDaze?.(e, daze);
    }
    // The boom: every rope (and spoke) goes off at once, scaled by the streak's links, the sky strikes every coil, and it
    // leaves its cage. Returns what it caught.
    static boom(S) {
        const C = Glaive.CFG, st = S._glv, sk = st?.streak, T = S.TILE_SIZE, now = S.time.now;
        if (!sk) return [];
        st.streak = null; st.readyAt = now + C.END_CD;
        const L = sk.links, k = Math.min(1, (L - 1) / (C.MAX_LINKS - 1)), F = Glaive.fx(S), segs = Glaive.web(S, sk);
        const R = C.DET_R + C.THICK_UP * Glaive.perk('thick'), dmg = C.ROPE_DMG * (1 + C.ROPE_UP * L) * (S.damageScaling || 1);
        Glaive.hitstop(S, C.STOP_MS + 30 * k);
        // the web bursts: each line struck gold and white, flaring and throwing sparks down its length; a brief warm light
        let cx = 0, cy = 0;
        for (const [, , , , ax, ay, bx, by] of segs) {
            WeaponSystem.bolt(S, ax, ay, bx, by, 'y', { life: 300 + 120 * k, br: 2, d: 0.99, glow: false });
            const n = Math.max(1, Math.round(Math.hypot(bx - ax, by - ay) / (T * 1.6)));
            for (let i = 0; i <= n; i++) {
                const x = ax + (bx - ax) * i / n, y = ay + (by - ay) * i / n;
                WeaponSystem.zapFlare(S, x, y, 'y', 0.7 + 0.4 * k, 1);
                F.gold.emitParticleAt(x, y, 2 + Math.round(3 * k)); if (k > 0.6) F.blue.emitParticleAt(x, y, 1);
            }
            cx += (ax + bx) / 2; cy += (ay + by) / 2;
        }
        cx /= segs.length; cy /= segs.length;
        S._vfxFlash?.(cx, cy, 60 + 60 * k, 0xffd890, 260, 0.14 + 0.1 * k);   // (a brief warm light, never a white-out)
        S.cameras.main.shake(140 + 40 * L, Math.min(0.013, 0.004 + 0.0016 * L));
        Sfx.play(S, 'glaive_boom', { k });
        if (L >= 4) Sfx.play(S, 'e_thunder');
        // what it catches: within reach of any line; more if it's Amped; dazed; the insulated shrug it off
        const near = (x, y) => segs.some(g => S.distancePointToSegment(x, y, g[0], g[1], g[2], g[3]) <= R), caught = [];
        const strike = (e, d) => Glaive.strike(S, e, d, caught, C.DAZE_MS);
        for (const e of [...(S.enemies || [])]) {
            if (!e.sprite?.active || e.health <= 0 || S._phasedOut?.(e) || !near(e.x, e.y)) continue;
            if (Glaive.insulated(e)) { Glaive.amp(S, e); continue; }   // (it says INSULATED)
            strike(e, dmg);
        }
        // a boss or queen the web crosses (once), and the water a line lies over (through the pool)
        let boss = false;
        const queens = new Set();
        for (const [x0, y0, x1, y1] of segs) {
            const n = Math.max(1, Math.ceil(Math.hypot(x1 - x0, y1 - y0) * 2));
            let wet = false;
            for (let i = 0; i <= n; i++) {
                const x = Math.round(x0 + (x1 - x0) * i / n), y = Math.round(y0 + (y1 - y0) * i / n);
                for (const [dx, dy] of [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1]]) if (!boss && S.damageBossAtTile?.(x + dx, y + dy, dmg, undefined, 'lightning')) boss = true;
                const q = S.getPortalAt?.(x, y);
                if (q && !queens.has(q)) { queens.add(q); S.damagePortal(q, dmg); }
                if (!wet && S.isWaterAt?.(x, y)) { wet = true; S._energizePool?.(x, y, dmg); }
            }
        }
        // the climax of a streak, with coils up: a bolt from the sky slams onto each, and it bursts round it
        if (L >= C.SKY_L) for (const c of [...st.coils]) if (c.spr?.active) Glaive.burst(S, c, L, caught, C.DAZE_MS);
        Glaive.cage(S, sk, L);
        // and it powers the network: its ropes stay live, volts back a link, and an overload the longer the streak
        for (const r of sk.ropes) st.ropes.push({ ...r, until: now + C.ROPE_LIFE });
        if (st.ropes.length > C.ROPE_CAP) st.ropes.splice(0, st.ropes.length - C.ROPE_CAP);
        Glaive.gain(S, C.REFUND * L);
        if (L > 1) {
            st.ovlMs = C.OVL_MS * (L - 1); st.ovlUntil = Math.max(st.ovlUntil, now + st.ovlMs); st.pulseAt = Math.min(st.pulseAt, now + 60);
            S.showStatusText?.(S.player.x, S.player.y - 48, `OVERLOAD ${(st.ovlMs / 1000).toFixed(1)}s`, '#fff3a0');
        }
        Glaive.bar(S);
        return caught;
    }
    // A bolt from the sky slams onto coil `coil` and it bursts COIL_R tiles round it (more the longer the streak, L links):
    // COIL_DMG, dazing `daze`; what it catches goes in `caught`
    static burst(S, coil, L, caught, daze) {
        const C = Glaive.CFG, T = S.TILE_SIZE, F = Glaive.fx(S), k = Math.min(1, (L - 1) / (C.MAX_LINKS - 1));
        const top = coil.py - 30, r = C.COIL_R + C.COIL_UP * L, cd = C.COIL_DMG * (1 + C.SKY_UP * L) * (S.damageScaling || 1);
        WeaponSystem.bolt(S, coil.px + (Math.random() - 0.5) * 30, top - 320, coil.px, top, 'y', { life: 360, br: 3, d: 4.3, key: 'fx_fork' });
        WeaponSystem.bolt(S, coil.px + (Math.random() - 0.5) * 20, top - 300, coil.px, top, 'w', { life: 220, br: 1, d: 4.31, key: 'fx_fork' });
        WeaponSystem.zapFlare(S, coil.px, top, 'y', 1.6 + 0.6 * k);
        const ring = 5 + Math.ceil(L / 2);   // (flares thrown round it to the burst's edge)
        for (let i = 0; i < ring; i++) {
            const a = i / ring * Math.PI * 2 + Math.random() * 0.3, d = (0.55 + Math.random() * 0.45) * r * T;
            S.time.delayedCall(20 + Math.random() * 60, () => { WeaponSystem.bolt(S, coil.px, coil.py, coil.px + Math.cos(a) * d, coil.py + Math.sin(a) * d * 0.8, 'y', { life: 220, thin: true, br: 1, d: 4.2, glow: false }); if (i % 2) WeaponSystem.zapFlare(S, coil.px + Math.cos(a) * d, coil.py + Math.sin(a) * d * 0.8, 'y', 0.8, 1); });
        }
        F.gold.emitParticleAt(coil.px, top, 10 + 2 * L); F.blue.emitParticleAt(coil.px, coil.py, 6);
        S._vfxFlash?.(coil.px, coil.py - 10, 50 + 15 * L, 0xfff0b0, 280, 0.2);
        S.cameras.main.shake(260, Math.min(0.016, 0.007 + 0.0015 * L));
        for (const e of [...(S.enemies || [])]) {
            if (!e.sprite?.active || e.health <= 0 || S._phasedOut?.(e) || Math.hypot(e.x - coil.x, e.y - coil.y) > r) continue;
            if (Glaive.insulated(e)) { Glaive.amp(S, e); continue; }
            Glaive.strike(S, e, cd, caught, daze);
        }
        S._hitPortalsAround?.(coil.x, coil.y, r, cd);
    }

    // ── the cage ──
    // The boom's cage: a post where each linked enemy stands (where it stood, if it's gone), sprung up out of the floor;
    // nothing if there's no fence to hang (one post and no coil in reach)
    static cage(S, sk, L) {
        const C = Glaive.CFG, st = S._glv, T = S.TILE_SIZE, nodes = [];
        Glaive.uncage(S);
        for (const [e, x0, y0] of sk.pivots) {
            const [x, y] = e.sprite?.active && e.health > 0 ? [e.x, e.y] : [x0, y0];
            if (!nodes.some(q => q[0] === x && q[1] === y)) nodes.push([x, y, x * T + T / 2, y * T + T / 2 + 6 - C.POST_TOP]);
        }
        if (nodes.length < 2 && !Glaive.nearCoil(S, nodes[0]?.[0], nodes[0]?.[1], C.LINK_R)) return;
        const posts = nodes.map(([, , px, py], i) => {
            const p = S.add.sprite(px, py + C.POST_TOP, 'fx_glaive', 'post_0').setOrigin(0.5, 1).setScale(C.POST_S, 0.2).setDepth(0.99).setFlipX(i % 2 === 1).play({ key: 'glv_post', startFrame: i % 4 });
            S.tweens.add({ targets: p, scaleY: C.POST_S, duration: 160, delay: 30 * i, ease: 'Back.easeOut' });   // (they spring up)
            return p;
        });
        st.cage = { nodes, L, posts, until: S.time.now + C.CAGE_MS };
    }
    static uncage(S) {
        const cg = S._glv?.cage;
        if (!cg) return;
        S._glv.cage = null;
        for (const p of cg.posts) { S.tweens.killTweensOf(p); S.tweens.add({ targets: p, alpha: 0, scaleY: 0.3, duration: 220, onComplete: () => p.destroy() }); }
    }
    // Every live fence ([tile x0, y0, x1, y1, px x0, y0, x1, y1]): the cage's, post to post (round from the last to the first,
    // from three posts), and each post to its nearest coil in reach (the first `.cage` of them); then coil to coil in reach
    static fences(S) {
        const C = Glaive.CFG, st = S._glv, n = st?.cage?.nodes || [], cs = Glaive.powered(S) ? st?.coils || [] : [], out = [];   // (out of volts, the coils' fences are dead)
        n.forEach((a, i) => {
            const b = n[(i + 1) % n.length], c = Glaive.nearCoil(S, a[0], a[1], C.LINK_R);
            if (i < n.length - 1 || n.length > 2) out.push([a[0], a[1], b[0], b[1], a[2], a[3], b[2], b[3]]);
            if (c && cs.length) out.push([a[0], a[1], c.x, c.y, a[2], a[3], c.px, c.py - 30]);
        });
        out.cage = out.length;
        cs.forEach((a, i) => { for (const b of cs.slice(i + 1)) if (Math.hypot(a.x - b.x, a.y - b.y) <= C.LINK_R) out.push([a.x, a.y, b.x, b.y, a.px, a.py - 30, b.px, b.py - 30]); });
        return out;
    }
    // The fences every frame: crackling (the cage's flickering in its last second), and an enemy that's moved across one (or
    // onto or off one) since last frame shocked by it, once a fence every FENCE_CD at most
    static fenceTick(S, st, time) {
        const C = Glaive.CFG, segs = Glaive.fences(S), cg = st.cage, dying = cg && cg.until - time < 1000;
        if (!segs.length) { st.seen.clear(); st.cd.clear(); return; }
        if (time >= st.fenceAt) {
            st.fenceAt = time + C.FENCE_MS;
            const flick = Math.floor(time / 120) % 2 ? 0.2 : 0.65;
            segs.forEach(([, , , , ax, ay, bx, by], i) => {
                const a = dying && i < segs.cage ? flick : 0.8;
                WeaponSystem.bolt(S, ax, ay, bx, by, 'c', { life: C.FENCE_MS + 40, thin: true, br: 0, a, d: 1.04, glow: false });
                if (Math.random() < 0.3) WeaponSystem.bolt(S, ax, ay, bx, by, 'y', { life: C.FENCE_MS, thin: true, br: 1, a: a * 0.8, d: 1.041, glow: false });
            });
            if (cg) for (const p of cg.posts) p.setAlpha(dying ? flick + 0.35 : 1);
            const f = segs[Math.floor(Math.random() * segs.length)], u = Math.random();
            Glaive.fx(S).blue.emitParticleAt(f[4] + (f[6] - f[4]) * u, f[5] + (f[7] - f[5]) * u, 1);   // (sparks spitting off a fence, a post's insulator arcing)
            if (cg && Math.random() < 0.3) { const [, , px, py] = cg.nodes[Math.floor(Math.random() * cg.nodes.length)]; WeaponSystem.zapFlare(S, px, py, 'c', 0.6 * (dying ? flick : 0.8) + 0.2, 1.05); }
        }
        const seen = new Map();
        for (const e of [...(S.enemies || [])]) {
            if (!e.sprite?.active || e.health <= 0) continue;
            const was = st.seen.get(e), [x, y] = [e.x, e.y];
            seen.set(e, [x, y]);
            if (!was || (was[0] === x && was[1] === y) || S._phasedOut?.(e)) continue;
            const n = Math.max(1, Math.ceil(Math.hypot(x - was[0], y - was[1]) * 4)), cd = st.cd.get(e) || {};   // (its way sampled every quarter tile)
            const on = g => { for (let j = 0; j <= n; j++) if (S.distancePointToSegment(was[0] + (x - was[0]) * j / n, was[1] + (y - was[1]) * j / n, g[0], g[1], g[2], g[3]) <= 0.3) return true; return false; };
            const g = segs.find(g => time >= (cd[g.slice(0, 4).join()] || 0) && on(g));
            if (!g) continue;
            cd[g.slice(0, 4).join()] = time + C.FENCE_CD; st.cd.set(e, cd);
            Glaive.shock(S, e, g);
        }
        st.seen = seen;
    }
    // e shocked by fence g: the whole fence flares gold, a crack onto it; FENCE_DMG, Amped, dazed (the insulated shrug it off)
    static shock(S, e, g) {
        const C = Glaive.CFG, [, , , , ax, ay, bx, by] = g, x = e.sprite.x, y = e.sprite.y - 6;
        WeaponSystem.bolt(S, ax, ay, bx, by, 'y', { life: 180, br: 1, d: 4.2, glow: false });
        const t = Math.max(0, Math.min(1, ((x - ax) * (bx - ax) + (y - ay) * (by - ay)) / ((bx - ax) ** 2 + (by - ay) ** 2 || 1)));   // (the nearest point on it)
        WeaponSystem.bolt(S, ax + (bx - ax) * t, ay + (by - ay) * t, x, y, 'w', { life: 140, thin: true, br: 1, d: 4.25 });
        if (Glaive.insulated(e)) return Glaive.amp(S, e);
        const caught = [];
        Glaive.strike(S, e, C.FENCE_DMG * (S.damageScaling || 1), caught, C.FENCE_DAZE);
        if (!caught.length) return;
        Glaive.amp(S, e);
        Sfx.play(S, 'zap', { soft: true });
    }

    // ── the network ──
    // Every line of it ([tile x0, y0, x1, y1, px x0, y0, x1, y1]): the boomed ropes still live, the streak's laid so far, the fences
    static net(S) {
        const st = S._glv, now = S.time.now, rope = r => [r.tx0, r.ty0, r.tx1, r.ty1, r.ax, r.ay, r.bx, r.by];
        return [...st.ropes.map(rope), ...(st.streak?.ropes || []).filter(r => now >= r.at).map(rope), ...Glaive.fences(S)];
    }
    // A pulse: current into every Amped enemy touching the network (within reach of a line or a coil, or inside the cage), and on
    // from each enemy it reaches to the nearest Amped ones in reach; all it reaches take PULSE_DMG, more the more there are. A boss
    // in reach of the network (or of an enemy it reached) takes BOSS_MUL of a hop, and passes nothing on. How many it reached.
    static pulse(S, ovl) {
        const C = Glaive.CFG, st = S._glv, now = S.time.now;
        const cond = (S.enemies || []).filter(e => e.sprite?.active && e.health > 0 && e.isSuperConducted && e.superConductUntil > now
            && !Glaive.insulated(e) && !S._phasedOut?.(e) && S.isInCurrentRoom(e.x, e.y));
        const segs = Glaive.net(S), R = C.NET_R + C.THICK_UP * Glaive.perk('thick'), cg = st.cage?.nodes || [];
        const inCage = (x, y) => {   // (the posts as a ring, from three)
            let k = false;
            if (cg.length > 2) for (let i = 0, j = cg.length - 1; i < cg.length; j = i++) { const [xi, yi] = cg[i], [xj, yj] = cg[j]; if ((yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) k = !k; }
            return k;
        };
        // where something at tile (x, y), px (ex, ey), r tiles across, picks it up: the nearest point of a line in reach, a coil in
        // reach, or the nearest post if it's inside the cage; null if none
        const touch = (x, y, ex, ey, r) => {
            let g = null, bd = Infinity;
            for (const s of segs) { const d = S.distancePointToSegment(x, y, s[0], s[1], s[2], s[3]); if (d <= R + r && d < bd) { bd = d; g = s; } }
            if (g) { const [, , , , ax, ay, bx, by] = g, u = Math.max(0, Math.min(1, ((ex - ax) * (bx - ax) + (ey - ay) * (by - ay)) / ((bx - ax) ** 2 + (by - ay) ** 2 || 1))); return [ax + (bx - ax) * u, ay + (by - ay) * u]; }
            const c = Glaive.nearCoil(S, x, y, C.ZAP_R + r);
            if (c) return [c.px, c.py - 30];
            if (inCage(x, y)) { const p = cg.reduce((a, b) => Math.hypot(b[0] - x, b[1] - y) < Math.hypot(a[0] - x, a[1] - y) ? b : a); return [p[2], p[3]]; }
            return null;
        };
        const got = new Map(), links = [];   // (enemy -> where its current came from, px)
        for (const e of cond) {
            if (got.size >= C.CHAIN_CAP) break;
            const from = touch(e.x, e.y, e.sprite.x, e.sprite.y - 6, 0);
            if (from) got.set(e, from);
        }
        const front = Glaive.perk('front'), hop = C.CHAIN_R + C.FRONT_R * front, q = [...got.keys()];
        while (q.length && got.size < C.CHAIN_CAP) {   // and on, enemy to enemy
            const a = q.shift();
            for (const o of cond.filter(o => !got.has(o) && Math.hypot(o.x - a.x, o.y - a.y) <= hop).sort((p, r) => Math.hypot(p.x - a.x, p.y - a.y) - Math.hypot(r.x - a.x, r.y - a.y)).slice(0, C.FORKS)) {
                if (got.size >= C.CHAIN_CAP) break;
                got.set(o, null); links.push([a, o]); q.push(o);
            }
        }
        const n = got.size, d = C.PULSE_DMG * Math.min(C.CHAIN_MAX + C.FRONT_MAX * front, 1 + (C.CHAIN_UP + C.FRONT_UP * front) * Math.max(0, n - 1)) * (ovl ? C.OVL_MUL : 1) * (S.damageScaling || 1), pal = ovl ? 'y' : 'c';
        let big = 0;
        for (const B of Glaive.bosses(S)) {   // a boss: from the network, else from an enemy the current reached; a dead end
            let from = touch(B.x, B.y, B.px, B.py, B.r);
            if (!from) for (const e of got.keys()) if (e.sprite?.active && Math.hypot(e.x - B.x, e.y - B.y) <= hop + B.r) { from = [e.sprite.x, e.sprite.y - 6]; break; }
            if (!from || !S.damageBossAtTile?.(B.x, B.y, d * C.BOSS_MUL, undefined, 'lightning')) continue;
            big++;
            WeaponSystem.bolt(S, from[0], from[1], B.px, B.py, pal, { life: 150, thin: true, br: 1, d: 4.2, glow: false });
            WeaponSystem.zapFlare(S, B.px, B.py, pal, 0.8, 1);
        }
        if (!n && !big) return 0;
        for (const [e, from] of got) if (from) WeaponSystem.bolt(S, from[0], from[1], e.sprite.x, e.sprite.y - 6, pal, { life: 150, thin: true, br: 1, d: 4.2, glow: false });
        for (const [a, o] of links) WeaponSystem.bolt(S, a.sprite.x, a.sprite.y - 6, o.sprite.x, o.sprite.y - 6, pal, { life: 170, thin: n < 4, br: 1, d: 4.22, glow: ovl });
        for (const e of got.keys()) {
            if (!e.sprite?.active || e.health <= 0) continue;
            const x = e.sprite.x, y = e.sprite.y - 6;
            if (Glaive.hit(S, e, d) !== false) WeaponSystem.zapFlare(S, x, y, pal, 0.5 + 0.06 * n, 1);
        }
        Sfx.play(S, 'zap', { soft: n < 4 });
        return n + big;
    }

    // ── R: a tesla coil ──
    static r(S) { Glaive.plant(S); }
    static deny(S, text) { Sfx.play(S, 'deny'); S.showStatusText?.(S.player.x, S.player.y - 34, text, '#ffe08a'); }
    static plant(S) {
        const C = Glaive.CFG, st = Glaive.st(S), T = S.TILE_SIZE, F = Glaive.fx(S);
        if (!S.player?.active) return;
        if (st.volts < C.PLANT) return Glaive.deny(S, `${C.PLANT} VOLT${C.PLANT === 1 ? '' : 'S'} TO PLANT A COIL (${Math.floor(st.volts)})`);
        st.volts -= C.PLANT; S._gearFiredAt = S.time.now;
        const x = S.playerX, y = S.playerY, px = x * T + T / 2, py = y * T + T / 2 + 6;
        Glaive.unplant(S, st.coils.find(c => c.x === x && c.y === y) || (st.coils.length >= C.COIL_MAX ? st.coils[0] : null));   // (planted on a coil, it takes that one's place; one too many, the oldest's)
        const spr = S.add.sprite(px, py, 'fx_glaive', 'coil_0').setOrigin(0.5, 1).setScale(1.5).setDepth(1.02).play('glv_coil');
        const glow = S.add.image(px, py - 32, 'vfx_glow').setTint(0x7ad8ff).setBlendMode(Phaser.BlendModes.ADD).setScale(0.32).setAlpha(0.3).setDepth(1.01);
        S.tweens.add({ targets: glow, alpha: 0.16, scale: 0.28, duration: 220, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
        spr.setScale(1.5, 0.2); S.tweens.add({ targets: spr, scaleY: 1.5, duration: 160, ease: 'Back.easeOut' });   // (it springs up)
        st.coils.push({ x, y, px, py, spr, glow, until: S.time.now + C.COIL_MS, arcAt: 0, zapAt: S.time.now + C.ZAP_MS / 2, dark: false });
        WeaponSystem.zapFlare(S, px, py - 30, 'c', 1.4); F.blue.emitParticleAt(px, py - 30, 10); F.gold.emitParticleAt(px, py, 6);
        S.showStatusText?.(S.player.x, S.player.y - 34, `TESLA COIL ${st.coils.length}/${C.COIL_MAX}`, '#9fe8ff');
        Sfx.play(S, 'orbhit'); Sfx.play(S, 'w_ball_lightning');
        Glaive.bar(S);
    }
    static unplant(S, c) {
        const st = S._glv;
        if (!st || !c) return;
        st.coils = st.coils.filter(o => o !== c);
        S.tweens.killTweensOf([c.spr, c.glow]);
        Glaive.fx(S).blue.emitParticleAt(c.px, c.py - 30, 8);
        S.tweens.add({ targets: [c.spr, c.glow], alpha: 0, duration: 260, onComplete: () => { c.spr.destroy(); c.glow.destroy(); } });
    }
    // Coil c zaps the ZAP_N enemies nearest it within ZAP_R tiles (never the insulated): a bolt down onto each, ZAP_DMG (x AMP_MUL
    // if it's Amped), Amped; and a boss in reach besides, BOSS_MUL as hard
    static coilZap(S, c) {
        const C = Glaive.CFG, top = c.py - 30, caught = [];
        const near = (S.enemies || []).filter(e => e.sprite?.active && e.health > 0 && !S._phasedOut?.(e) && !Glaive.insulated(e) && Math.hypot(e.x - c.x, e.y - c.y) <= C.ZAP_R)
            .sort((a, b) => Math.hypot(a.x - c.x, a.y - c.y) - Math.hypot(b.x - c.x, b.y - c.y)).slice(0, C.ZAP_N);
        let big = 0;
        for (const B of Glaive.bosses(S)) if (Math.hypot(B.x - c.x, B.y - c.y) <= C.ZAP_R + B.r && S.damageBossAtTile?.(B.x, B.y, C.ZAP_DMG * C.BOSS_MUL * (S.damageScaling || 1), undefined, 'lightning')) {
            big++; WeaponSystem.bolt(S, c.px, top, B.px, B.py, 'c', { life: 170, br: 1, d: 4.2 });
        }
        if (!near.length && !big) return;
        for (const e of near) {
            WeaponSystem.bolt(S, c.px, top, e.sprite.x, e.sprite.y - 6, 'c', { life: 170, br: 1, d: 4.2 });
            WeaponSystem.bolt(S, c.px, top, e.sprite.x, e.sprite.y - 6, 'w', { life: 110, thin: true, br: 0, d: 4.21, glow: false });
            Glaive.strike(S, e, C.ZAP_DMG * (S.damageScaling || 1), caught, 0);
        }
        caught.forEach(e => Glaive.amp(S, e));
        WeaponSystem.zapFlare(S, c.px, top, 'c', 1.1);
        Sfx.play(S, 'zap', { soft: true });
    }

    // Every frame: the glaive thrust out follows you; while you hold it, an arc reaching from the blade for your pivot; the
    // streak's ropes crackle (harder as its time runs out), its fuse races down them, and the boom; the coils hum, zap and go
    // out; the fences crackle and shock
    static tick(S, time) {
        const st = S._glv || (Glaive.held(S) && S.player?.active ? Glaive.st(S) : null);
        if (!st) { if (S._glvBar) Glaive.bar(S); return; }
        const C = Glaive.CFG, T = S.TILE_SIZE, th = st.thrust, F = Glaive.fx(S);
        if (th) {
            const t = time - th.t0, out = t < C.MS ? t / C.MS : Math.max(0, 1 - (t - C.MS) / C.HOLD);
            if (t > C.MS + C.HOLD || !S.player?.active) { th.spr.destroy(); th.glow.destroy(); st.thrust = null; }
            else {
                const x = S._shotX() + Math.cos(th.a) * C.JAB * out, y = S._shotY() + Math.sin(th.a) * C.JAB * out;
                th.spr.setPosition(x, y).setAlpha(t > C.MS + C.HOLD * 0.6 ? 1 - (t - C.MS - C.HOLD * 0.6) / (C.HOLD * 0.4) : 1);
                th.glow.setPosition(x + Math.cos(th.a) * 26, y + Math.sin(th.a) * 26).setAlpha(0.3 * th.spr.alpha);
            }
        }
        // the coils: humming, an arc to the floor now and then, zapping what's near, each drawing volts while it has work
        // (an enemy in reach); with none left, quiet and dim till you refuel; out when their time's up
        const now = S.time.now, dt = Math.min(250, Math.max(0, now - (st.netAt || now))), ovl = Glaive.overload(S), live = Glaive.powered(S);
        st.netAt = now;
        let draw = 0;
        for (const c of [...st.coils]) {
            if (time >= c.until || !c.spr.active) { Glaive.unplant(S, c); continue; }
            if (c.dark === live) {   // (it goes quiet, or comes back on)
                c.dark = !live;
                if (live) { c.spr.clearTint().setAlpha(1).anims.resume(); c.glow.setVisible(true); WeaponSystem.zapFlare(S, c.px, c.py - 30, 'c', 1.2); F.blue.emitParticleAt(c.px, c.py - 30, 6); }
                else { c.spr.setTint(0x6a7890).setAlpha(0.6).anims.pause(); c.glow.setVisible(false); }
            }
            if (!live) { c.zapAt = Math.max(c.zapAt, time + C.ZAP_MS / 2); continue; }
            if ((S.enemies || []).some(e => e.sprite?.active && e.health > 0 && Math.hypot(e.x - c.x, e.y - c.y) <= C.ZAP_R) || Glaive.bosses(S).some(B => Math.hypot(B.x - c.x, B.y - c.y) <= C.ZAP_R + B.r)) draw += 1000 / C.DRAIN_MS;
            if (time >= c.zapAt) { c.zapAt = time + C.ZAP_MS; Glaive.coilZap(S, c); }
            if (time < c.arcAt) continue;
            c.arcAt = time + 180 + Math.random() * 220;
            const a = Math.random() * Math.PI * 2, d = 10 + Math.random() * 16;
            WeaponSystem.bolt(S, c.px, c.py - 30, c.px + Math.cos(a) * d, c.py - 2 + Math.sin(a) * d * 0.5, 'c', { life: 120, thin: true, br: 0, d: 1.03, glow: false });
            if (c.until - time < 1500) c.spr.setAlpha(Math.floor(time / 120) % 2 ? 0.5 : 1);   // (flickering out)
        }
        if (st.cage && time >= st.cage.until) Glaive.uncage(S);   // the cage: live till its time's up
        Glaive.fenceTick(S, st, time);
        // the network: its ropes crackling (faintly with no volts), and its pulse; what it all costs
        st.ropes = st.ropes.filter(r => r.until > now);
        if (st.ropes.length && now >= st.ropeNetAt) {
            st.ropeNetAt = now + (live ? 110 : 220);
            for (const r of st.ropes) {
                const a = (live ? (ovl ? 0.6 : 0.4) : 0.14) * Math.min(1, (r.until - now) / 1000);
                WeaponSystem.bolt(S, r.ax, r.ay, r.bx, r.by, ovl ? 'y' : 'c', { life: 150, thin: true, br: 0, a, d: 0.965, glow: false });
            }
        }
        const per = C.PULSE_MS / (ovl ? C.OVL_RATE : 1);
        if (!live) st.pulseAt = Math.max(st.pulseAt, now);
        else if (now >= st.pulseAt) { st.pulseAt = now + per; st.hot = Glaive.pulse(S, ovl) > 0; if (st.hot) Glaive.spend(S, C.PULSE_COST * per / C.PULSE_MS); }
        if (draw) Glaive.spend(S, draw * dt / 1000);
        st.draw = live ? draw + (st.hot ? C.PULSE_COST * 1000 / C.PULSE_MS : 0) : 0;
        const sk = st.streak, dashing = time < (S._glideUntil || 0);
        let p = null;
        if (Glaive.held(S) && S.player?.active && !S._deathScreenActive && !dashing && !sk?.fuse && (sk || time >= st.readyAt)) {
            const cam = S.cameras.main;
            p = Glaive.pick(S, (S.pointerX ?? 0) + cam.scrollX, (S.pointerY ?? 0) + cam.scrollY);
        }
        // the streak ends: its time's up, or (a beat after you land) it's at its last link or there's no one left to pivot off
        if (sk && !sk.fuse && time >= sk.landAt && (time >= sk.until || (time >= sk.landAt + C.GRACE && (sk.links >= C.MAX_LINKS || !p)))) { Glaive.light(S); p = null; }
        if (st.streak) {
            const s = st.streak, f = s.fuse;
            if (time >= st.ropeAt) {   // the ropes (and spokes) crackling
                st.ropeAt = time + C.ROPE_MS;
                const a = 0.45 + 0.4 * (1 - Math.max(0, Math.min(1, (s.until - time) / C.STREAK_MS)));
                for (const r of s.ropes) {
                    if (time < r.at) continue;   // (laid as you arrive)
                    WeaponSystem.bolt(S, r.ax, r.ay, r.bx, r.by, 'c', { life: C.ROPE_MS + 30, thin: true, br: 0, a, d: 0.97, glow: false });
                    if (Math.random() < 0.3) WeaponSystem.bolt(S, r.ax, r.ay, r.bx, r.by, 'y', { life: C.ROPE_MS, thin: true, br: 1, a: a * 0.7, d: 0.971, glow: false });
                    const c = Glaive.nearCoil(S, r.tx1, r.ty1);
                    if (c) WeaponSystem.bolt(S, r.bx, r.by, c.px, c.py, 'c', { life: C.ROPE_MS + 30, thin: true, br: 0, a: a * 0.6, d: 0.968, glow: false });
                }
            }
            if (f) {   // the fuse: a bright head racing down each rope in turn, what it's passed burning gold; then in along the spokes
                const el = time - f.t0, per = f.ms / s.ropes.length;
                s.ropes.forEach((r, i) => {
                    const u = (el - i * per) / per;
                    if (u <= 0) return;
                    const q = Math.min(1, u), hx = r.ax + (r.bx - r.ax) * q, hy = r.ay + (r.by - r.ay) * q;
                    WeaponSystem.bolt(S, r.ax, r.ay, hx, hy, 'y', { life: 0, thin: q < 1, br: 0, a: 0.95, d: 0.985, glow: false });
                    if (u < 1) { WeaponSystem.zap(S, 'mote_3', hx, hy, 0, 1, 4.4, 2.2, false, true, 0, 'fx_glaive'); F.gold.emitParticleAt(hx, hy, 1); }
                });
                if (f.spokes && el > f.ms) {
                    const q = Math.min(1, (el - f.ms) / f.spokes);
                    for (const r of s.ropes) {
                        const c = Glaive.nearCoil(S, r.tx1, r.ty1);
                        if (!c) continue;
                        const hx = r.bx + (c.px - r.bx) * q, hy = r.by + (c.py - r.by) * q;
                        WeaponSystem.bolt(S, r.bx, r.by, hx, hy, 'y', { life: 0, thin: true, br: 0, a: 0.9, d: 0.985, glow: false });
                        WeaponSystem.zap(S, 'mote_3', hx, hy, 0, 1, 4.4, 2, false, true, 0, 'fx_glaive');
                    }
                }
                if (el >= f.ms + f.spokes) Glaive.boom(S);
            }
        }
        // your pivot: an arc reaching for it from the blade, re-striking; its crackle flaring (a faint flicker if it isn't Amped)
        if (p && time >= st.aimAt) {
            st.aimAt = time + C.AIM_MS;
            const e = p.e, ex = p.px ?? e.sprite.x, ey = p.py ?? e.sprite.y - 6, amped = !p.px && e.isSuperConducted && e.superConductUntil > time;
            const tip = (typeof CreatureFX !== 'undefined' && CreatureFX.gearTip?.(S)) || { x: S._shotX(), y: S._shotY() };
            WeaponSystem.bolt(S, tip.x, tip.y, ex, ey, 'c', { life: C.AIM_MS + 40, thin: true, br: 0, a: 0.55, d: 4.15, glow: false });
            WeaponSystem.zapGlow(S, ex, ey, 0.22, amped ? 0xffe14a : 0x7ad8ff, 0.14, C.AIM_MS + 40);
            if (amped) for (let i = 0; i < 3; i++) { const a = Math.random() * Math.PI * 2; WeaponSystem.bolt(S, ex, ey, ex + Math.cos(a) * 13, ey + Math.sin(a) * 10, 'y', { life: C.AIM_MS + 10, thin: true, br: 0, a: 0.9, d: 4.3, glow: false }); }
            else for (let i = 0; i < 3; i++) WeaponSystem.zap(S, 'mote_' + Math.floor(Math.random() * 8), ex + (Math.random() - 0.5) * 18, ey + (Math.random() - 0.5) * 14, C.AIM_MS + 10, 0.85, 4.3, 1.5, Math.random() < 0.5, true, 0, 'fx_glaive').setTint(0x9fe8ff);
            if (p.land) WeaponSystem.zap(S, 'mote_1', p.land[0] * T + T / 2, p.land[1] * T + T / 2 + 4, C.AIM_MS + 20, 0.35, 0.98, 1.5, false, true, 0, 'fx_glaive').setTint(0x9fe8ff);   // (a spark where you'd land)
        }
        Glaive.bar(S);
    }
    // the volts you carry over you, the streak's time left under it, and what R does now; only while the glaive's out
    static bar(S) {
        const st = S._glv, B = S._glvBar;
        if (!st || !Glaive.held(S) || !S.player?.active) {
            if (B) { B.g.destroy(); B.label.destroy(); S._glvBar = null; }
            return;
        }
        const C = Glaive.CFG, now = S.time.now, px = S.player.x, py = S.player.y - 18, sk = st.streak, ovl = Glaive.overload(S), v = Math.floor(st.volts);
        const low = st.volts < C.LOW, blink = low && Math.floor(now / 160) % 2;
        const b = S._glvBar ||= { g: S.add.graphics().setDepth(5.6), label: S.add.text(px, py + 7, '', { fontSize: '8px', fontFamily: UIKit.FONT.title, fontStyle: 'bold', color: '#ffd84a', stroke: '#14100a', strokeThickness: 3, resolution: 2 }).setOrigin(0.5, 0).setDepth(5.7) };
        if (!b.g.active) { S._glvBar = null; return; }
        // the tank: gold, white-gold in an overload, amber and blinking when it's low; what's draining off it in the next 2s, dark
        UIKit.rBar(b.g.clear(), px - 20, py - 3, 48, Math.min(1, st.volts / C.VOLT_MAX), { col: ovl ? 0xfff0a0 : low ? (blink ? 0xff7a2a : 0xc85a1a) : 0xe0b020, hot: 0xfff6b0, dark: 0x14100a, time: now, ready: ovl, segs: C.VOLT_MAX / 4 });
        const out = Math.min(st.volts, st.draw * 2) / C.VOLT_MAX;
        if (out > 0) b.g.fillStyle(0x14100a, 0.55).fillRect(px - 20 + 48 * (st.volts / C.VOLT_MAX - out), py - 2, 48 * out, 3);
        const left = sk && !sk.fuse ? [(sk.until - now) / C.STREAK_MS, 0.3, 0x9fe8ff] : ovl ? [(st.ovlUntil - now) / st.ovlMs, 0, 0xfff6b0] : st.cage ? [(st.cage.until - now) / C.CAGE_MS, 0.2, 0xffe14a] : null;
        if (left) {   // under it: the streak's window, else the overload's time, else the cage's, running out
            const k = Math.max(0, Math.min(1, left[0]));
            b.g.fillStyle(0x14100a, 0.85).fillRect(px - 21, py + 5, 50, 4).fillStyle(k < left[1] ? 0xff9a3a : left[2], 1).fillRect(px - 20, py + 6, 48 * k, 2);
        }
        const state = ovl ? `OVERLOAD ${Math.max(0, (st.ovlUntil - now) / 1000).toFixed(1)}s` : !st.volts ? 'NO VOLTS: DASH!' : st.draw ? `-${st.draw.toFixed(1)}/s${low ? '  LOW' : ''}` : '';
        b.label.setPosition(px, py + (left ? 10 : 7)).setText(`VOLTS ${v}/${C.VOLT_MAX}${state ? '  ' + state : ''}  ·  ${sk ? `STREAK ×${sk.links}  ·  ` : ''}COILS ${st.coils.length}/${C.COIL_MAX}  ·  TESLA [${Settings.label(Settings.key('surge'))}]`)
            .setColor(ovl ? '#fff3a0' : low ? (blink ? '#ff9a3a' : '#ffb060') : '#ffd84a');
    }
}
