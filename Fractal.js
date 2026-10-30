// ═══════════════════════════════════════════════════════════════════════════
// Fractal.js — the Fractal Shard (ice, tier 3)
// Click: a heavy crystal flies where you aim, fast. Every spike that hits an enemy SPLITS: two smaller ones fork on from
// there at ANGLE either side of its line (the first split makes 2 + Burst Fan), and those split again on their hits, down to
// the smallest (MAX_GEN): one shot grows a tree of ice through a pack. Branches seek nothing: they fly straight from where
// they forked, shorter each size, and smash on walls. No enemy is hit twice by one shot's tree. One target takes the
// crystal's own hit, the heavy one; a crowd takes the tree. Every spike chills (CHILL, by size); one that hits an enemy
// frozen into a cube splits even at the smallest size. R: Fractal Bloom (WeaponSystem._fractalBloom), a charge a shot
// when its tree forks CHARGE_GEN deep or hits a cube.
// The look: the crystal forms at your hand and launches; crystal grows up out of the floor along each spike's path (glass,
// no outline, as the Bloom's arms) and erupts outlined at each split, so the shot stands as one tree of ice with an outlined
// spike at each growing tip; a hit cracks (the crystal's first one holds the game still a beat); HOLD after its last spike
// stops, the whole tree shatters from its root out.
// Art: assets/art/fx_fractal (br0/br1/br2 the spikes 16 ways, brk the crack where one splits, glass_*/crystal_* what grows;
// the frost and chips: WeaponSystem.fractalArt / frost).
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
        WeaponSystem.fractalArt(S); WeaponSystem.frost(S).glint.emitParticleAt(x, y, 2);
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
                WeaponSystem.fracMuzzle(S, spr.x, spr.y, true);
                WeaponSystem.frostPuff(S, spr.x + Math.cos(a) * 14, spr.y + Math.sin(a) * 14, 4, 1, 10);   // its blast thrown on ahead
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
            if (i % 3 === 0) WeaponSystem.frostPuff(S, p.x, p.y - 6, 2, 0.6 + 0.2 * Math.abs(p.scaleX), 8);
            if (i % 5 === 0) WeaponSystem.frost(S).glint.emitParticleAt(p.x, p.y - 8, 1);
            S.tweens.add({ targets: p, y: p.y - 3, duration: 40, ease: 'Quad.easeOut', onComplete: () => p.active && S.tweens.add({ targets: p, y: p.y + 7, scaleY: 0.15, scaleX: p.scaleX * 1.3, alpha: 0, duration: 150 + Math.random() * 80, ease: 'Quad.easeIn', onComplete: () => p.destroy() }) });
        }));
        shot.knots.slice(0, 7).forEach(([x, y, gen]) => S.time.delayedCall(far([x, y]), () => {
            for (let i = 0; i < (gen ? 1 : 2); i++) WeaponSystem.fracChip(S, x, y, 16 + Math.random() * 20, gen ? 1.5 : 2);
            WeaponSystem.frostPuff(S, x, y - 4, gen ? 3 : 5, gen ? 0.8 : 1);
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
        WeaponSystem.fractalArt(S);
        if (!S.anims.exists('frac_crack')) S.anims.create({ key: 'frac_crack', frames: [0, 1, 2, 3].map(i => ({ key: 'fx_fractal', frame: 'brk_' + i })), frameRate: 24 });
        const f = S.add.sprite(x, y, 'fx_fractal', 'brk_0').setScale([2.6, 1.5, 1.2, 1][gen]).setTint([0xffffff, 0xaeeaff, 0x8adcff, 0x7fd0f8][gen]).setDepth(4.62).play({ key: 'frac_crack', frameRate: gen ? 24 : 13 });   // (the crystal's own crack white; down the tree ever bluer, smaller)
        f.setFlip(Math.random() < 0.5, Math.random() < 0.5);   // (mirrored at random, so no two cracks match)
        f.once('animationcomplete', () => f.destroy());
        WeaponSystem.frostPuff(S, x, y, [8, 5, 4, 3][gen], [1.1, 0.9, 0.75, 0.6][gen]);
        for (let i = 0; i < [3, 2, 1, 1][gen]; i++) WeaponSystem.fracChip(S, x, y, 14 + Math.random() * [20, 14, 10, 8][gen], [2, 1.7, 1.4, 1.2][gen]);
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
        const F = WeaponSystem.frost(S);
        for (let i = st.shards.length - 1; i >= 0; i--) {
            const s = st.shards[i], ox = s.spr.x, oy = s.spr.y, shot = s.shot, dmg = C.DMG[s.gen] * (s.gen ? branchUp : 1) * scale;
            let dead = false;
            if (s.hold) { s.spr.setPosition(S._shotX(), S._shotY()); continue; }   // (forming at your hand)
            const step = Math.min(Math.hypot(s.vx, s.vy) * dt, s.left);
            const nx = ox + Math.cos(s.a) * step, ny = oy + Math.sin(s.a) * step;
            s.left -= step;
            const tx = Math.floor(nx / T), ty = Math.floor(ny / T);
            if (S.world?.[tx]?.[ty] !== S.FLOOR) { WeaponSystem.fractalBurst(S, ox, oy, false); dead = true; }   // a wall: it smashes
            else {
                s.spr.setPosition(nx, ny);
                WeaponSystem.frostTrail(S, ox, oy, nx, ny, [5, 5, 6, 7][s.gen], [1.2, 0.95, 0.8, 0.65][s.gen]);   // one unbroken tail of frost behind it
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
}
