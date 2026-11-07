// ═══════════════════════════════════════════════════════════════════════════
// Fractal.js — the Fractal Shard (ice, tier 3)
// Click: a heavy crystal flies where you aim, fast. Every spike that hits an enemy SPLITS: two smaller ones fork on from
// there at ANGLE either side of its line (the first split makes 2 + Burst Fan), and those split again on their hits, down to
// the smallest (MAX_GEN): one shot grows a tree of ice through a pack. Branches seek nothing: they fly straight from where
// they forked, shorter each size, and smash on walls. No enemy is hit twice by one shot's tree. One target takes the
// crystal's own hit, the heavy one; a crowd takes the tree. Every spike chills (CHILL, by size); one that hits an enemy
// frozen into a cube splits even at the smallest size. R: Fractal Bloom (Fractal._fractalBloom), a charge a shot
// when its tree forks CHARGE_GEN deep or hits a cube.
// The look: the crystal forms at your hand and launches; crystal grows up out of the floor along each spike's path (glass,
// no outline, as the Bloom's arms) and erupts outlined at each split, so the shot stands as one tree of ice with an outlined
// spike at each growing tip; a hit cracks (the crystal's first one holds the game still a beat); HOLD after its last spike
// stops, the whole tree shatters from its root out.
// Art: assets/art/fx_fractal (br0/br1/br2 the spikes 16 ways, brk the crack where one splits, glass_*/crystal_* what grows;
// the frost and chips: Fractal.fractalArt / frost).
// ═══════════════════════════════════════════════════════════════════════════
class Fractal {
    static CFG = { CD: 750, MAX_GEN: 3, CHARGE_GEN: 2,
        // by size: the crystal, a branch, a twig, the last (HIT: how near a spike's path an enemy is hit, px)
        DMG: [38, 24, 15, 9], CHILL: [1, 0.7, 0.55, 0.45], SPEED: [900, 760, 660, 580], REACH: [9, 4, 3, 2.2], HIT: [18, 15, 13, 11],
        ANGLE: 0.52,   // a split's two branches, this far either side of its line (radians: 30 degrees)
        ART: ['br0', 'br1', 'br2', 'br2'], SCALE: [2.1, 1.9, 1.75, 1.45], LIMB_GAP: [16, 15, 14, 13],   // (px between the crystals growing along a spike's path)
        CHARGE_MS: 70, HOLD: 200, STOP: 40,   // the crystal forming at your hand; the tree standing before it shatters; the first hit's hitstop (real ms)
        BRANCH_UP: 0.25,   // Splinter: branch damage a level
        BOSS: 0.75 };   // of a hit, to a boss (it's one hit a tree there, as on one enemy, but never cubed: the whole hit had it 1.34x its tier's on a boss)
    static held(S) { return S.currentElement === 'ice' && S.equippedWeapons?.ice === 'fractal_shard'; }
    static perk(k) { return WeaponLevels.perk('fractal_shard', k) || 0; }
    static st(S) {
        if (!S._frac) { S._frac = { at: -1e9, shards: [] }; S.events.once('shutdown', () => { S._frac = null; }); }
        return S._frac;
    }

    static attack(S, targetX, targetY) {
        const C = Fractal.CFG, st = Fractal.st(S), now = S.time.now;
        if (now - st.at < C.CD * WeaponLevels.cdMult('fractal_shard')) return;
        st.at = now; S._gearFiredAt = now;
        const x = S._shotX(), y = S._shotY(), cam = S.cameras.main;
        const a = Math.atan2(targetY + cam.scrollY - y, targetX + cam.scrollX - x);
        Fractal.fractalArt(S); Fractal.frost(S).glint.emitParticleAt(x, y, 2);
        Fractal.spawn(S, x, y, a, 0, { charged: false, hit: new Set(), boss: false, portals: new Set(), live: 0, limbs: [], knots: [], root: [x, y] });
    }

    // the spike drawn the way it flies, to the nearest sixteenth of a turn (typed frames, never the art turned)
    static frame(gen, a) { return `${Fractal.CFG.ART[gen]}_${((Math.round(a / (Math.PI / 8)) % 16) + 16) % 16}`; }

    // a spike of size `gen` from (x, y) along `a`; `shot` is the click it came from (what its whole tree has hit)
    static spawn(S, x, y, a, gen, shot) {
        const C = Fractal.CFG, T = S.TILE_SIZE, sc = C.SCALE[gen], sp = C.SPEED[gen];
        const spr = S.add.image(x, y, 'fx_fractal', Fractal.frame(gen, a)).setScale(sc * 0.45).setDepth(3.5 - gen * 0.02);
        const s = { spr, gen, shot, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, a, left: C.REACH[gen] * T, tile: null, gap: 0, hold: !gen };
        shot.live++;
        if (gen) S.tweens.add({ targets: spr, scale: sc, duration: 70, ease: 'Quad.easeOut' });   // a branch grows out of the split
        else {   // the crystal forms at your hand, then launches
            spr.setAlpha(0.5); S._vfxFlash?.(x, y, 26, 0x9fe8ff, C.CHARGE_MS + 40, 0.7);
            S.tweens.add({ targets: spr, scale: sc, alpha: 1, duration: C.CHARGE_MS, ease: 'Back.easeOut', onComplete: () => {
                if (!spr.active) return;
                s.hold = false;
                Fractal.fracMuzzle(S, spr.x, spr.y, true);
                Fractal.frostPuff(S, spr.x + Math.cos(a) * 14, spr.y + Math.sin(a) * 14, 4, 1, 10);   // its blast thrown on ahead
                S._vfxFlash?.(spr.x, spr.y, 40, 0x7fd8ff, 150, 0.8);
            } });
        }
        Fractal.st(S).shards.push(s);
    }

    // crystal growing up out of the floor where a spike has flown: the limb of the tree behind its tip (one every LIMB_GAP px,
    // glass, a little either side of the line and of its own size); `knot`: the outlined cluster bursting up where one split
    static grow(S, shot, x, y, gen, knot) {
        const sc = knot ? [2, 1.7, 1.45, 1.2][gen] : [1.25, 1.1, 0.95, 0.8][gen] * (0.8 + Math.random() * 0.4);
        const c = S.add.sprite(x, y + 6, 'fx_fractal', knot ? 'crystal_0' : 'glass_0').setOrigin(0.5, 1).setScale(sc).setFlipX(Math.random() < 0.5)
            .setDepth(0.95 + y * 0.00001 + (knot ? 0.000005 : 0)).play(knot ? 'frac_grow' : 'frac_glass');   // (round the enemies' feet, under them: they stay readable)
        shot.limbs.push(c);
    }
    static limb(S, s, ox, oy, nx, ny, step) {
        const gap = Fractal.CFG.LIMB_GAP[s.gen], px = -Math.sin(s.a), py = Math.cos(s.a);
        for (s.gap += step; s.gap >= gap; s.gap -= gap) {
            const k = 1 - (s.gap - gap) / Math.max(1, step), j = (Math.random() - 0.5) * 6;   // (how far along this frame's step it lies; how far off the line)
            Fractal.grow(S, s.shot, ox + (nx - ox) * k + px * j, oy + (ny - oy) * k + py * j, s.gen, false);
        }
    }

    // a spike gone; the last one of its shot leaves the tree standing HOLD, then it shatters
    static end(S, s) {
        if (--s.shot.live <= 0) S.time.delayedCall(Fractal.CFG.HOLD, () => Fractal.shatter(S, s.shot));
    }

    // the whole tree breaking, from its root out: each crystal jolts and falls apart, frost bursting off every few; at its knots
    // a flash and big chips flying
    static shatter(S, shot) {
        if (shot.shattered) return;
        shot.shattered = true;
        const [rx, ry] = shot.root, far = p => Math.hypot(p[0] - rx, p[1] - ry) * 0.35;   // (ms: the break running out along the limbs)
        if (shot.limbs.length) Sfx.play(S, 'shatter');
        shot.limbs.forEach((p, i) => S.time.delayedCall(far([p.x, p.y]), () => {
            if (!p.active) return;
            if (i % 3 === 0) Fractal.frostPuff(S, p.x, p.y - 6, 2, 0.6 + 0.2 * Math.abs(p.scaleX), 8);
            if (i % 5 === 0) Fractal.frost(S).glint.emitParticleAt(p.x, p.y - 8, 1);
            S.tweens.add({ targets: p, y: p.y - 3, duration: 40, ease: 'Quad.easeOut', onComplete: () => p.active && S.tweens.add({ targets: p, y: p.y + 7, scaleY: 0.15, scaleX: p.scaleX * 1.3, alpha: 0, duration: 150 + Math.random() * 80, ease: 'Quad.easeIn', onComplete: () => p.destroy() }) });
        }));
        shot.knots.slice(0, 7).forEach(([x, y, gen]) => S.time.delayedCall(far([x, y]), () => {
            for (let i = 0; i < (gen ? 1 : 2); i++) Fractal.fracChip(S, x, y, 16 + Math.random() * 20, gen ? 1.5 : 2);
            Fractal.frostPuff(S, x, y - 4, gen ? 3 : 5, gen ? 0.8 : 1);
            S._vfxFlash?.(x, y, gen ? 26 : 44, 0x9fe8ff, 140, gen ? 0.5 : 0.8);
        }));
        if (shot.knots.length > 2) S.cameras.main.shake(60, 0.002);
        shot.limbs = [];
    }

    // a spike splitting at (x, y): its branches fork on, either side of its line (a cube lets the smallest split too)
    static split(S, s, x, y, cube) {
        const C = Fractal.CFG;
        Fractal.crack(S, x, y, s.gen); s.shot.knots.push([x, y, s.gen]); Fractal.grow(S, s.shot, x, y, s.gen, true);
        if (s.gen >= C.MAX_GEN && !cube) return;
        const gen = Math.min(C.MAX_GEN, s.gen + 1), n = 2 + (s.gen === 0 ? Fractal.perk('fan') : 0), half = C.ANGLE * Enchants.spread('fractal_shard');
        for (let i = 0; i < n; i++) Fractal.spawn(S, x, y, s.a - half + 2 * half * i / (n - 1), gen, s.shot);
    }

    // where a spike splits: a crisp crack of light, a puff of frost, big chips of crystal thrown out (fewer, smaller down the tree)
    static crack(S, x, y, gen) {
        Fractal.fractalArt(S);
        if (!S.anims.exists('frac_crack')) S.anims.create({ key: 'frac_crack', frames: [0, 1, 2, 3].map(i => ({ key: 'fx_fractal', frame: 'brk_' + i })), frameRate: 24 });
        const f = S.add.sprite(x, y, 'fx_fractal', 'brk_0').setScale([2.6, 1.5, 1.2, 1][gen]).setTint([0xffffff, 0xaeeaff, 0x8adcff, 0x7fd0f8][gen]).setDepth(4.62).play({ key: 'frac_crack', frameRate: gen ? 24 : 13 });   // (the crystal's own crack white; down the tree ever bluer, smaller)
        f.setFlip(Math.random() < 0.5, Math.random() < 0.5);   // (mirrored at random, so no two cracks match)
        f.once('animationcomplete', () => f.destroy());
        Fractal.frostPuff(S, x, y, [8, 5, 4, 3][gen], [1.1, 0.9, 0.75, 0.6][gen]);
        for (let i = 0; i < [3, 2, 1, 1][gen]; i++) Fractal.fracChip(S, x, y, 14 + Math.random() * [20, 14, 10, 8][gen], [2, 1.7, 1.4, 1.2][gen]);
        S._vfxFlash?.(x, y, [60, 36, 26, 20][gen], 0x6fd2ff, [220, 150, 110, 90][gen], [1, 0.7, 0.55, 0.45][gen]);   // the light of it
        if (!gen) { S.cameras.main.shake(70, 0.004); Glaive.hitstop(S, Fractal.CFG.STOP); }   // the crystal's own hit: you feel it
    }

    // R's charge, once a shot
    static charge(S, shot, x, y) {
        if (shot.charged || S._fracBlooming) return;
        shot.charged = true;
        const N = S._fractalCfg().CHARGES;
        S._fracCharge = Math.min(N, (S._fracCharge || 0) + 1);
        if (S._fracCharge >= N) Sfx.play(S, 'rready', { el: 'ice' });
        S._vfxFlash?.(x, y, 36, 0x9fe8ff, 160, 0.7);
        CombatSystem.essence(S, x, y, 'fx_fractal', 'glass_0', 0xbff4ff, 1.4);
        S.showStatusText?.(x, y - 30, S._fracCharge >= N ? 'R READY' : `+1  ${S._fracCharge}/${N}`, '#bff4ff');
    }

    // a spike's hit: the resolved ice damage, no more (damageEnemy's chance of a free cube would land on most of a pack each shot)
    static hit(S, e, dmg) {
        if (S._roomGated?.() && e.tutorialRoomIndex !== undefined && e.tutorialRoomIndex !== S.getCurrentPlayerRoom()) return;   // a room you haven't entered
        const d = S.resolveElementalHit(e, dmg, 'ice');
        if (d === null) return;
        e.health -= d;
        S.showDamageNumber(e.sprite.x, e.sprite.y - 10, Math.round(d), '#aaeeff');
        CombatSystem.hitFlash(S, e, d, 'ice', true);
        S.updateEnemyHealthBar(e);
        S.gainUltCharge?.(S.ultChargePerHit);
        if (e.health <= 0) S.killEnemy(e);
    }

    static tick(S, time) {
        const st = S._frac; if (!st?.shards.length) return;
        const C = Fractal.CFG, T = S.TILE_SIZE, dt = Math.min(50, S.game.loop.delta || 16) / 1000 * (S.time.timeScale ?? 1);   // (a hitstop holds them too)
        const branchUp = 1 + C.BRANCH_UP * Fractal.perk('shards'), scale = S.damageScaling || 1;
        const F = Fractal.frost(S);
        for (let i = st.shards.length - 1; i >= 0; i--) {
            const s = st.shards[i], ox = s.spr.x, oy = s.spr.y, shot = s.shot, dmg = C.DMG[s.gen] * (s.gen ? branchUp : 1) * scale;
            let dead = false;
            if (s.hold) { s.spr.setPosition(S._shotX(), S._shotY()); continue; }   // (forming at your hand)
            const step = Math.min(Math.hypot(s.vx, s.vy) * dt, s.left);
            const nx = ox + Math.cos(s.a) * step, ny = oy + Math.sin(s.a) * step;
            s.left -= step;
            const tx = Math.floor(nx / T), ty = Math.floor(ny / T);
            if (S.world?.[tx]?.[ty] !== S.FLOOR) { Fractal.fractalBurst(S, ox, oy, false); dead = true; }   // a wall: it smashes
            else {
                s.spr.setPosition(nx, ny);
                Fractal.frostTrail(S, ox, oy, nx, ny, [5, 5, 6, 7][s.gen], [1.2, 0.95, 0.8, 0.65][s.gen]);   // one unbroken tail of frost behind it
                Fractal.limb(S, s, ox, oy, nx, ny, step);
                if (s.gen === 0) { F.mist.emitParticleAt(nx, ny, 1); if (Math.random() < 0.3) F.glint.emitParticleAt(nx + (Math.random() - 0.5) * 6, ny + (Math.random() - 0.5) * 6, 1); }
                // the first enemy on its path this frame that its tree hasn't hit
                let e = null, ed = Infinity;
                for (const o of S.enemies || []) {
                    if (shot.hit.has(o) || !o.sprite?.active || o.health <= 0 || S._phasedOut?.(o)) continue;
                    if (S.distancePointToSegment(o.sprite.x, o.sprite.y, ox, oy, nx, ny) >= C.HIT[s.gen]) continue;
                    const d = (o.sprite.x - ox) ** 2 + (o.sprite.y - oy) ** 2; if (d < ed) { ed = d; e = o; }
                }
                if (e) {
                    const ex = e.sprite.x, ey = e.sprite.y, cube = !!e._iceCube;
                    shot.hit.add(e);
                    Fractal.hit(S, e, dmg);
                    if (e.health > 0 && e.sprite?.active) S.applyChill(e, C.CHILL[s.gen]);
                    if (cube || s.gen >= C.CHARGE_GEN) Fractal.charge(S, shot, ex, ey);
                    Fractal.split(S, s, ex, ey, cube);
                    dead = true;
                } else if (`${tx},${ty}` !== s.tile) {   // a boss on the tile it's crossing (once a tree); a portal
                    s.tile = `${tx},${ty}`;
                    if (!shot.boss && S.damageBossAtTile?.(tx, ty, dmg * C.BOSS, 'fractal', 'ice')) { shot.boss = true; if (s.gen >= C.CHARGE_GEN) Fractal.charge(S, shot, nx, ny); Fractal.split(S, s, nx, ny, false); dead = true; }
                    const p = !dead && S.getPortalAt?.(tx, ty); if (p && !shot.portals.has(p)) { shot.portals.add(p); S.damagePortal(p, dmg); Fractal.split(S, s, nx, ny, false); dead = true; }
                }
                if (!dead && s.left <= 0) {   // the end of its reach: it melts away
                    S.tweens.add({ targets: s.spr, alpha: 0, scale: s.spr.scale * 0.5, duration: 120, onComplete: () => s.spr.destroy() });
                    st.shards.splice(i, 1); Fractal.end(S, s); continue;
                }
            }
            if (dead) { s.spr.destroy(); st.shards.splice(i, 1); Fractal.end(S, s); }
        }
    }

    // The Fractal Shard's art (assets/art/fx_fractal, typed by hand: tools/fractal_bake.mjs) and its animations, made once
    static fractalArt(scene) {
        const A = scene.anims, mk = (key, frames, rate, repeat = 0) => { if (!A.exists(key)) A.create({ key, frames: frames.map(f => ({ key: 'fx_fractal', frame: f })), frameRate: rate, repeat }); };
        mk('frac_tumble', ['shard_0', 'shard_1', 'shard_2', 'shard_3'], 14, -1);
        mk('frac_burst', ['burst_0', 'burst_1', 'burst_2', 'burst_3'], 22);
        mk('frac_grow', ['crystal_0', 'crystal_1', 'crystal_2'], 24);
        mk('frac_glass', ['glass_0', 'glass_1', 'glass_2'], 24);
        mk('frac_chunk', ['chunk_0', 'chunk_1', 'chunk_2', 'chunk_3'], 16, -1);
        return { key: 'fx_fractal' };
    }
    // Frost, the scene's particle emitters (made the first time): glints flaring and going (the hand-drawn ones) and a
    // pale mist, both light added; and frost with no outline (haze_*, drawn normally, pale cyan cooling to deep blue), so
    // where it crowds it runs together into one body, never a heap of pieces: haze lies still (trails), puff is thrown out
    // (bursts); k sizes the next ones
    static frost(S) {
        if (S._fracFx?.glint?.active) return S._fracFx;
        const ADD = Phaser.BlendModes.ADD;
        const glint = S.add.particles(0, 0, 'fx_fractal', { frame: ['glint_0', 'glint_1', 'glint_2'], emitting: false, lifespan: { min: 180, max: 420 },
            speed: { min: 5, max: 40 }, angle: { min: 0, max: 360 }, gravityY: 20, scale: { start: 2, end: 0.6 }, alpha: { start: 1, end: 0 },
            color: [0xffffff, 0xdff8ff, 0x9fe4ff, 0x4a90c8], blendMode: ADD }).setDepth(3.45);
        const mist = S.add.particles(0, 0, 'vfx_glow', { emitting: false, lifespan: { min: 220, max: 380 }, speed: { min: 0, max: 15 },
            scale: { start: 0.28, end: 0.1 }, alpha: { start: 0.22, end: 0 }, color: [0xdff8ff, 0x7fd0ff, 0x2a6a9a], blendMode: ADD }).setDepth(3.4);
        const fx = { glint, mist, k: 1 }, H = ['haze_0', 'haze_1', 'haze_2', 'haze_3', 'haze_4', 'haze_5'], COLS = [0xa8e8ff, 0x6cc8f4, 0x4aa8e8, 0x2a78c0, 0x1e5a96];
        const size = (lo, hi, end) => ({   // (mirrored at random, never turned)
            scaleX: { onEmit: p => (p._sx = (Math.random() < 0.5 ? -1 : 1) * fx.k * (lo + Math.random() * (hi - lo))), onUpdate: (p, key, t) => p._sx * (1 + (end - 1) * t) },
            scaleY: { onEmit: p => (p._sy = Math.abs(p._sx) * (0.8 + Math.random() * 0.4)), onUpdate: (p, key, t) => p._sy * (1 + (end - 1) * t) } });
        fx.haze = S.add.particles(0, 0, 'fx_fractal', { frame: H, emitting: false, lifespan: { min: 150, max: 300 }, speed: { min: 0, max: 5 }, angle: { min: 0, max: 360 },
            ...size(1.1, 1.7, 0.6), alpha: { start: 0.6, end: 0 }, color: COLS, colorEase: 'quad.out' }).setDepth(3.3);
        fx.puff = S.add.particles(0, 0, 'fx_fractal', { frame: H, emitting: false, lifespan: { min: 260, max: 520 }, speed: { min: 14, max: 64 }, angle: { min: 0, max: 360 },
            ...size(1.4, 2.2, 1.5), alpha: { start: 0.62, end: 0 }, color: COLS, colorEase: 'quad.out' }).setDepth(4.55);
        return (S._fracFx = fx);
    }
    // Frost laid along what flew from (x0, y0) to (x1, y1), a puff every gap px (k their size): one unbroken tail, thinning as it ages
    static frostTrail(S, x0, y0, x1, y1, gap, k = 1) {
        const F = Fractal.frost(S), n = Math.max(1, Math.round(Math.hypot(x1 - x0, y1 - y0) / gap));
        F.k = k; for (let i = 1; i <= n; i++) F.haze.emitParticleAt(x0 + (x1 - x0) * i / n, y0 + (y1 - y0) * i / n, 1); F.k = 1;
    }
    // A burst of frost at (x, y): n puffs thrown out (from within r px), running together into one cloud
    static frostPuff(S, x, y, n, k = 1, r = 6) {
        const F = Fractal.frost(S); F.k = k;
        for (let i = 0; i < n; i++) F.puff.emitParticleAt(x + (Math.random() - 0.5) * r, y + (Math.random() - 0.5) * r, 1);
        F.k = 1;
    }
    // A big chip of crystal (fx_fractal's shard, outlined: the few crisp pieces in a break) tumbling from (x, y) to d px away
    static fracChip(S, x, y, d, scale = 1.7) {
        Fractal.fractalArt(S);
        const a = Math.random() * Math.PI * 2, c = S.add.sprite(x, y, 'fx_fractal', 'shard_0').setScale(scale).setDepth(4.6).play('frac_tumble');
        c.anims.setProgress(Math.random());
        S.tweens.add({ targets: c, x: x + Math.cos(a) * d, y: y + Math.sin(a) * d * 0.7 + 6, alpha: 0, scale: scale * 0.6, duration: 360 + Math.random() * 160, ease: 'Quad.easeOut', onComplete: () => c.destroy() });
    }
    // A big chunk of crystal (outlined) thrown from (x, y) out along a (give or take) d px, hopping, tumbling: the bloom's shatter
    static fracChunk(S, x, y, a, d) {
        Fractal.fractalArt(S);
        const b = a + (Math.random() - 0.5) * 0.9, ex = x + Math.cos(b) * d, ey = y + Math.sin(b) * d * 0.75, h = 14 + Math.random() * 16;
        const c = S.add.sprite(x, y, 'fx_fractal', 'chunk_0').setScale(2).setDepth(4.6).setFlipX(Math.random() < 0.5).play('frac_chunk');
        c.anims.setProgress(Math.random());
        S._vfxSort?.(c);
        S.tweens.addCounter({ from: 0, to: 1, duration: 420 + Math.random() * 160, ease: 'Quad.easeOut', onUpdate: tw => {
            const u = tw.getValue(); c.setPosition(x + (ex - x) * u, y + (ey - y) * u - h * 4 * u * (1 - u)).setAlpha(Math.min(1, (1 - u) / 0.3));
        }, onComplete: () => c.destroy() });
    }
    // A crack of light shot through the floor from (x, y) the way a points, to the nearest eighth (e, se, s, ne typed; the
    // rest those flipped both ways, the root kept at the point): it flares and fades
    static fracCrack(S, x, y, a, scale, delay = 0) {
        const k = ((Math.round(a / (Math.PI / 4)) % 8) + 8) % 8, [f, fl, ox, oy] = [['crack_e', 0, 0, 0.5], ['crack_se', 0, 0, 0], ['crack_s', 0, 0.5, 0], ['crack_ne', 1, 0, 1],
            ['crack_e', 1, 0, 0.5], ['crack_se', 1, 0, 0], ['crack_s', 1, 0.5, 0], ['crack_ne', 0, 0, 1]][k];
        const c = S.add.image(x, y, 'fx_fractal', f).setOrigin(fl ? 1 - ox : ox, fl ? 1 - oy : oy).setFlip(!!fl, !!fl).setScale(scale)
            .setBlendMode(Phaser.BlendModes.ADD).setDepth(0.5).setAlpha(0);
        S._vfxSort?.(c);
        S.tweens.add({ targets: c, alpha: 1, delay, duration: 40, onComplete: () => S.tweens.add({ targets: c, alpha: 0, delay: 140, duration: 420, ease: 'Quad.easeIn', onComplete: () => c.destroy() }) });
    }
    // A burst of ice at (x, y): the hand-drawn flare blooming into a ring of shards, a cloud of frost thrown out with it (big: the spikes')
    static fracMuzzle(S, x, y, big) {
        Fractal.fractalArt(S);
        const b = S.add.sprite(x, y, 'fx_fractal', 'burst_0').setScale(big ? 2.4 : 1.7).setBlendMode(Phaser.BlendModes.ADD).setDepth(4.6).play('frac_burst');
        b.once('animationcomplete', () => b.destroy());
        Fractal.frostPuff(S, x, y, big ? 7 : 4, big ? 1 : 0.8);
        Fractal.frost(S).glint.emitParticleAt(x + (Math.random() - 0.5) * 10, y + (Math.random() - 0.5) * 10, 2);
        if (big) S.cameras.main.shake(40, 0.002);
    }
    // A shard breaking (on a hit, on a wall): one cloud of frost bursting off it, a big chip or two of crystal tumbling out
    // (the only outlined pieces: its fan is the rest), a glint, (the crystal's own break) a flash
    static fractalBurst(scene, x, y, crit) {
        Fractal.frostPuff(scene, x, y, crit ? 9 : 6, crit ? 1.1 : 0.9);
        for (let i = 0; i < (crit ? 2 : 1); i++) Fractal.fracChip(scene, x, y, 16 + Math.random() * 16);
        Fractal.frost(scene).glint.emitParticleAt(x + (Math.random() - 0.5) * 8, y + (Math.random() - 0.5) * 8, crit ? 2 : 1);
        if (crit) scene._vfxFlash?.(x, y, 40, 0x9fe4ff, 140, 0.8);
    }

    // ── FRACTAL SHARD'S R: FRACTAL BLOOM ─────────────────────────────────────
    // CHARGES shots whose chain broke all the way down (Fractal.js) make R ready: FRACTAL BLOOM. A seed crystal flies to where
    // you aim (BLOOM_RANGE tiles at most, short of a wall) and blooms: a snowflake of crystal bursting up out of the floor,
    // six arms of ARM[0] tiles growing out from it, each forking at its end into two of ARM[1] (a sixth of a turn either
    // way), and those again into two of ARM[2]: a fractal, each fork smaller. The crystals race out a tile every BLOOM_STEP;
    // each cracks what stands on its tile (BLOOM_DMG and BLOOM_CHILL of a chill bar), the last forks' tips freeze it into a
    // cube. BLOOM_HOLD after the last has grown the whole flake shatters at once: BLOOM_SHATTER to everything standing in it.
    _fractalCfg() { return { CHARGES: 5, BLOOM_RANGE: 9, SEED_MS: 220, ARM: [3, 2, 1], BLOOM_STEP: 55, BLOOM_DMG: 16, BLOOM_CHILL: 0.34, BLOOM_HOLD: 900, BLOOM_SHATTER: 28 }; }
    // An icicle landing on a boss counts toward the Frost Shield as one on an enemy does (boss hits never did)
    _shardBossSig(s) {
        if (s.isCannonShard && !(this._frostShieldUntil > this.time.now)) { this._icicleHitCounter = Math.min(28, (this._icicleHitCounter || 0) + 1); this._updateIcicleChargeBar(); }
    }
    _fractalBloom() {
        const FC = this._fractalCfg(), p = this.player, T = this.TILE_SIZE, ADD = Phaser.BlendModes.ADD;
        if ((this._fracCharge || 0) < FC.CHARGES) { this.showStatusText(p.x, p.y - 28, `NOT CHARGED  ${this._fracCharge || 0}/${FC.CHARGES}`, '#8ab8d0'); return; }
        if (this._fracBlooming) return;
        this._fracCharge = 0; this._fracBlooming = true; this._gearFiredAt = this.time.now;
        Fractal.fractalArt(this);
        // where it blooms: toward the cursor, BLOOM_RANGE at most, short of a wall
        const cam = this.cameras.main, ox = this._shotX(), oy = this._shotY();   // (aimed as the shots are: the pointer, plus the camera)
        const mx = (this.pointerX ?? 0) + cam.scrollX, my = (this.pointerY ?? 0) + cam.scrollY, ang = Math.atan2(my - oy, mx - ox);
        const want = Math.min(FC.BLOOM_RANGE, Math.hypot(mx - ox, my - oy) / T);
        let cx = this.playerX, cy = this.playerY;
        for (let d = 0.5; d <= want; d += 0.5) { const x = Math.round(this.playerX + Math.cos(ang) * d), y = Math.round(this.playerY + Math.sin(ang) * d); if (this.world[x]?.[y] !== this.FLOOR) break; cx = x; cy = y; }
        // the flake: every tile it grows on, when, and whether it's a last fork's tip; a branch stops at a wall (and doesn't fork)
        // (a knot: the middle and each arm's end, where it forks)
        const cells = new Map(), put = (x, y, t, tip, knot) => { const c = cells.get(x + ',' + y); if (!c || c.t > t) cells.set(x + ',' + y, { x, y, t, tip, knot }); };
        const grow = (x0, y0, a, gen, t) => {
            let lx = x0, ly = y0;
            for (let k = 1; k <= FC.ARM[gen]; k++) {
                const x = Math.round(x0 + Math.cos(a) * k), y = Math.round(y0 + Math.sin(a) * k);
                if (this.world[x]?.[y] !== this.FLOOR) return;
                t += FC.BLOOM_STEP; put(x, y, t, gen === FC.ARM.length - 1 && k === FC.ARM[gen], gen === 0 && k === FC.ARM[0]); lx = x; ly = y;
            }
            if (gen + 1 < FC.ARM.length) for (const sd of [-1, 1]) grow(lx, ly, a + sd * Math.PI / 3, gen + 1, t);
        };
        put(cx, cy, 0, false, true);
        for (let i = 0; i < 6; i++) grow(cx, cy, ang + i * Math.PI / 3, 0, 0);
        // the seed, flung there trailing frost
        const tx = cx * T + T / 2, ty = cy * T + T / 2, seed = this.add.image(ox, oy, 'fx_fractal', 'mark').setScale(2.2).setDepth(4.6), F = Fractal.frost(this);
        Fractal.fracMuzzle(this, ox, oy, false);
        Sfx.play(this, 'w_fractal_shard');
        let lx = ox, ly = oy;
        this.tweens.add({ targets: seed, x: tx, y: ty - 6, duration: FC.SEED_MS, ease: 'Quad.easeIn', onUpdate: () => { Fractal.frostTrail(this, lx, ly, seed.x, seed.y, 5, 1.1); lx = seed.x; ly = seed.y; F.mist.emitParticleAt(seed.x, seed.y, 1); },
            onComplete: () => {
                seed.destroy();
                Fractal.fracMuzzle(this, tx, ty, true);
                Sfx.play(this, 'freeze'); this.cameras.main.shake(140, 0.005);
                const crystals = [], hit = new Set(), dmg = FC.BLOOM_DMG * (this.damageScaling || 1);
                let last = 0, bossHit = false;
                for (const c of cells.values()) {
                    last = Math.max(last, c.t);
                    this.time.delayedCall(c.t, () => {   // a crystal bursting up out of the floor, cracking what stands on it
                        if (this._deathScreenActive) return;
                        const px = c.x * T + T / 2, py = c.y * T + T / 2 + 8;
                        // grown thick with no outline (so the arms run together into one body of crystal), the outlined crystal only at the knots
                        const cr = this.add.sprite(px, py, 'fx_fractal', c.knot ? 'crystal_0' : 'glass_0').setOrigin(0.5, 1).setScale(c.knot ? 2.2 : 1.5 + Math.random() * 0.5).setFlipX(Math.random() < 0.5).setDepth(2.4 + c.y * 0.0001 + (c.knot ? 0.00005 : 0)).play(c.knot ? 'frac_grow' : 'frac_glass');
                        crystals.push({ c, cr });
                        if (Math.random() < 0.5) F.glint.emitParticleAt(px + (Math.random() - 0.5) * T, py - 10 - Math.random() * 14, 1);
                        F.mist.emitParticleAt(px, py - 8, 1);
                        if (c.t % (FC.BLOOM_STEP * 2) < FC.BLOOM_STEP) Sfx.play(this, 'ice_crack', { soft: true });
                        for (const e of [...this.enemies]) {
                            if (e.x !== c.x || e.y !== c.y || !e.sprite?.active || e.health <= 0 || this._phasedOut?.(e)) continue;
                            this.damageEnemy(e, dmg, 'ice');
                            if (e.sprite?.active && e.health > 0) this.applyChill?.(e, c.tip ? 1 : FC.BLOOM_CHILL);   // (a tip: a full bar, a cube)
                        }
                        if (!bossHit && this.damageBossAtTile?.(c.x, c.y, dmg)) bossHit = true;
                    });
                }
                this.time.delayedCall(last + FC.BLOOM_HOLD, () => {   // and the whole flake shatters at once
                    this._fracBlooming = false;
                    if (this._deathScreenActive) { crystals.forEach(o => o.cr.destroy()); return; }
                    Sfx.play(this, 'shatter'); Sfx.play(this, 'boom', { big: true }); this.time.delayedCall(70, () => Sfx.play(this, 'ice_crack'));   // a crack, a boom, the ice ringing out
                    this.cameras.main.shake(240, 0.013);
                    const sdmg = FC.BLOOM_SHATTER * (this.damageScaling || 1);
                    // a white flash at its heart, cracks of light shot through the floor from it (all eight ways) and on out from each arm's knot
                    const fl = this.add.image(tx, ty - 8, 'vfx_glow').setTint(0xffffff).setBlendMode(ADD).setDepth(4.7).setScale(1.2);
                    this._vfxSort?.(fl);
                    this.tweens.add({ targets: fl, scale: 3.2, alpha: 0, duration: 120, ease: 'Quad.easeOut', onComplete: () => fl.destroy() });
                    for (let k = 0; k < 8; k++) Fractal.fracCrack(this, tx, ty, k * Math.PI / 4, 2.2);
                    F.k = 1.2;
                    crystals.forEach(({ c, cr }, i) => {   // the knots burst into big chunks thrown outward, the rest is gone in a thin quick haze
                        const px = cr.x, py = cr.y - 10, a = c.x === cx && c.y === cy ? null : Math.atan2(c.y - cy, c.x - cx);
                        if (c.knot) {
                            const b = this.add.sprite(px, py, 'fx_fractal', 'burst_0').setScale(2.6).setBlendMode(ADD).setDepth(4.6).play('frac_burst');
                            this._vfxSort?.(b);
                            b.once('animationcomplete', () => b.destroy());
                            if (a !== null) Fractal.fracCrack(this, c.x * T + T / 2, c.y * T + T / 2, a, 1.5, 50);
                            for (let k = 0; k < 3; k++) Fractal.fracChunk(this, px, py, a ?? Math.random() * Math.PI * 2, 40 + Math.random() * 40);
                        } else if (i % 2) F.haze.emitParticleAt(px, py, 1);
                        cr.destroy();
                        for (const e of [...this.enemies]) {
                            if (e.x !== c.x || e.y !== c.y || hit.has(e) || !e.sprite?.active || e.health <= 0 || this._phasedOut?.(e)) continue;
                            hit.add(e); this.damageEnemy(e, sdmg, 'ice');
                        }
                    });
                    F.k = 1;
                    this._vfxFlash?.(tx, ty, T * 7, 0xffffff, 200, 1);
                });
            } });
        this._updateFractalBar();
    }

    // Every frame, while it's out: the charge over you
    _updateFractalBar() {
        const now = this.time.now, FC = this._fractalCfg();
        const out = this.currentElement === 'ice' && this.equippedWeapons?.ice === 'fractal_shard' && this.player?.active;
        if (!out) { if (this._fracBar?.active) this._fracBar.destroy(); this._fracBar = null; return; }
        if (!this._fracBar?.active) this._fracBar = this.add.graphics().setDepth(6);
        UIKit.rBar(this._fracBar.clear(), this.player.x - 18, this.player.y - 16, 39, (this._fracCharge || 0) / FC.CHARGES, { col: 0x9fe8ff, hot: 0xffffff, dark: 0x08141c, time: now, segs: FC.CHARGES });   // a notch a combo
    }
}
