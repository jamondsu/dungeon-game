// ═══════════════════════════════════════════════════════════════════════════
// Rimeguard.js — the Rimeguard (ice, tier 4): a tower shield of glacier ice and a short maul
// Click: a SLAM. A short wind-up, then the maul comes down: everything in a CONE REACH tiles toward the cursor takes DMG,
// more the more armor you have (x 1 + armor/ARMOR: armor upgrades are its damage upgrades too), CHILL_FREE Chills, and is
// TAUNTED for TAUNT_MS: it comes for you (decoys and allies forgotten) TAUNT_SPD faster and attacks TAUNT_ATK faster.
// Behind the raised shield the maul is a short jab: REACH_BLOCK, one Chill, no taunt, BLOCK_SLOW times slower.
// Held, hold right-click (or the weapon's second key) to RAISE THE SHIELD toward your aim: a hit from an enemy within GUARD
// either side of it is BLOCKED (you take 1 - BLOCK) and is a charge more of Rime.
// RIME, whatever element you're on while it's your ice weapon: every hit an enemy lands on you is a charge of it (a big
// one, BIG of your max HP or more, two), GAP apart at most, frost growing on you as it fills. At HITS it goes off on its
// own: SHATTERBACK. Held, R lets it go early (RIME_MIN or more). After MELT_DELAY unhurt a charge melts every MELT_MS.
// SHATTERBACK: ice spikes burst out of the floor round you to RADIUS tiles (FULL_R more at full): each enemy takes
// BASE + SHARE of your max HP (by how full it was) and a big chill (CHILL of the bar): it sets up whatever you're holding.
// Art: assets/art/fx_rimeguard (slam_0-3, spike_0-3, shard/flake/mist, flare_e/ne/s/se_0-1, crys_0-2).
// ═══════════════════════════════════════════════════════════════════════════
class Rimeguard {
    static CFG = { CD: 700, WIND: 130, REACH: 3, REACH_BLOCK: 1.5, CONE: Math.PI / 2, DMG: 22, ARMOR: 200, CHILL_FREE: 1.5,
        TAUNT_MS: 3000, TAUNT_SPD: 1.4, TAUNT_ATK: 1.4,   // (ARMOR: +1 damage share per this much armor)
        BLOCK: 0.7, BLOCK_UP: 0.08, GUARD: 70 * Math.PI / 180, BLOCK_SLOW: 2,   // (BLOCK_UP a level of Thick Ice)
        HITS: 8, RIME_MIN: 3, GAP: 250, BIG: 0.15, MELT_DELAY: 5000, MELT_MS: 1500,
        BASE: 15, SHARE: 0.4, RELEASE_UP: 1.2, RADIUS: 2.5, FULL_R: 1, SNAP_UP: 0.5, CHILL: 1.5, RING_MS: 60 };   // (CHILL in stacks: half the bar; RING_MS a tile)
    // eighths of a turn clockwise from east: the shield's frame, and whether it's flipped both ways
    static DIRS = [['e', 0], ['se', 0], ['s', 0], ['ne', 1], ['e', 1], ['se', 1], ['s', 1], ['ne', 0]];
    // where frost grows on you: off the body's middle (px), the Rime it needs, mirrored
    static SLOTS = [[-8, -4, 0.02, 0], [7, -6, 0.18, 1], [-1, -8, 0.36, 0], [12, 0, 0.55, 1], [-13, 2, 0.72, 0], [4, -9, 0.86, 1]];
    static held(S) { return S.currentElement === 'ice' && Rimeguard.worn(S); }
    static worn(S) { return S.equippedWeapons?.ice === 'rimeguard'; }   // (your ice weapon: its Rime works on every element)
    static st(S) {
        if (!S._rg) {
            S._rg = { rime: 0, slamAt: -1e9, hurtAt: -1e9, blockAt: -1e9, releaseAt: 0, crys: [], fx: null };
            S.events.once('shutdown', () => { S._rg = null; S._rgBar = null; });
            const A = S.anims, mk = (key, frames, rate) => { if (!A.exists(key)) A.create({ key, frames: frames.map(f => ({ key: 'fx_rimeguard', frame: f })), frameRate: rate, repeat: 0 }); };
            mk('rg_slam', ['slam_0', 'slam_1', 'slam_2', 'slam_3'], 14);
            mk('rg_spike', ['spike_0', 'spike_1', 'spike_1', 'spike_1', 'spike_2', 'spike_3'], 16);
        }
        return S._rg;
    }
    static perk(k) { return WeaponLevels.perk('rimeguard', k) || 0; }
    static block() { return Math.min(0.94, Rimeguard.CFG.BLOCK + Rimeguard.CFG.BLOCK_UP * Rimeguard.perk('block')); }
    static armorMult() { return 1 + PlayerStats.armor() / Rimeguard.CFG.ARMOR; }
    static cap() { return Rimeguard.CFG.HITS; }
    static aim(S) {
        const cam = S.cameras.main;
        return Math.atan2((S.pointerY ?? 0) + cam.scrollY - S._shotY(), (S.pointerX ?? 0) + cam.scrollX - S._shotX());
    }
    static dir(a) { return Rimeguard.DIRS[((Math.round(a / (Math.PI / 4)) % 8) + 8) % 8]; }
    // the middle of your body (the slime's is the lower part of its frame), and how squashed it is
    static body(S) {
        const p = S.player, sx = Math.abs((p.scaleX || 1.2) / 1.2), sy = Math.abs((p.scaleY || 1.2) / 1.2);
        return { x: p.x, y: p.y + 13 * sy, sx, sy };
    }

    // The frost, a scene's particle emitters, made the first time: shards of ice flung off (a cone of them when F.dir is
    // set: [degrees, spread]), flakes drifting, mist rolling, a cold glow; all white -> pale cyan -> blue over their life
    static fx(S) {
        const st = Rimeguard.st(S), ADD = Phaser.BlendModes.ADD;
        if (st.fx?.shard?.active) return st.fx;
        const F = { dir: null };
        const ang = () => F.dir ? F.dir[0] + (Math.random() - 0.5) * F.dir[1] : Math.random() * 360;
        const size = (lo, hi, end) => ({ onEmit: p => (p._s = lo + Math.random() * (hi - lo)), onUpdate: (p, k, t) => (p._s || lo) * (1 + (end - 1) * t) });
        F.shard = S.add.particles(0, 0, 'fx_rimeguard', { frame: ['shard_0', 'shard_1', 'shard_2'], emitting: false,
            lifespan: { min: 260, max: 620 }, speed: { min: 60, max: 190 }, angle: { onEmit: ang }, gravityY: 220,
            scale: size(1, 1.8, 0.5), alpha: { start: 0.9, end: 0 }, color: [0xe8fbff, 0xbfeeff, 0x7fc8f8, 0x3a86c8], colorEase: 'quad.out', blendMode: ADD }).setDepth(3.45);
        F.flake = S.add.particles(0, 0, 'fx_rimeguard', { frame: ['flake_0', 'flake_1'], emitting: false,
            lifespan: { min: 500, max: 1100 }, speed: { min: 8, max: 45 }, angle: { onEmit: ang }, gravityY: 18,
            scale: size(0.7, 1.3, 0.6), alpha: { start: 0.9, end: 0 }, color: [0xffffff, 0xcff4ff, 0x7fc8ff], blendMode: ADD }).setDepth(3.46);
        F.mist = S.add.particles(0, 0, 'fx_rimeguard', { frame: ['mist_0', 'mist_1'], emitting: false,
            lifespan: { min: 380, max: 820 }, speed: { min: 6, max: 40 }, angle: { onEmit: ang },
            scale: size(0.8, 1.25, 1.5), alpha: { start: 0.26, end: 0 }, color: [0xe8fbff, 0x9fdcff, 0x3a7ab8], blendMode: ADD }).setDepth(3.4);
        F.glow = S.add.particles(0, 0, 'vfx_glow', { emitting: false, lifespan: { min: 240, max: 420 }, speed: { min: 0, max: 15 },
            scale: { start: 0.4, end: 0.15 }, alpha: { start: 0.16, end: 0 }, color: [0xbff0ff, 0x5aa8e8, 0x1a3a7a], blendMode: ADD }).setDepth(3.39);
        return (st.fx = F);
    }
    // An ice spike bursting out of the floor at (x, y) (its foot), after `delay` ms: it rises, holds, cracks and shatters
    static spike(S, x, y, scale, delay = 0, front = true) {
        S.time.delayedCall(delay, () => {
            if (!S.sys?.isActive()) return;
            const sp = S.add.sprite(x, y, 'fx_rimeguard', 'spike_0').setOrigin(0.5, 0.92).setScale(scale).setFlipX(Math.random() < 0.5).setDepth(front ? 3.05 : 0.95);
            sp.play({ key: 'rg_spike', frameRate: 14 + Math.random() * 5 });
            sp.once('animationcomplete', () => {
                const F = Rimeguard.fx(S);
                if (Math.random() < 0.6) F.shard.emitParticleAt(x, y - 9 * scale, 1);
                if (Math.random() < 0.25) F.mist.emitParticleAt(x, y - 4, 1);
                S.tweens.add({ targets: sp, alpha: 0, duration: 160, onComplete: () => sp.destroy() });
            });
        });
    }

    // An ice hit on e: the damage the way the ice weapons deal it (through resistance, brittle and your damage; not
    // damageEnemy, whose ice hits have a free chance to cube), then `chill` (applyChill's weight). Ice elementals only chill.
    static hit(S, e, dmg, chill) {
        if (!e.iceImmune) {
            const d = S.resolveElementalHit(e, dmg, 'ice');
            if (d === null) return;
            e.health -= d;
            S.showDamageNumber(e.sprite.x, e.sprite.y - 10, d, '#88eeff');
            CombatSystem.hitFlash(S, e, d, 'ice', true);
            S.updateEnemyHealthBar(e);
            S.gainUltCharge(S.ultChargePerHit);
            if (e.health <= 0) { S._destroyChillIndicator?.(e); S.killEnemy(e); return; }
        }
        S.applyChill(e, chill);
    }

    // ── the slam ──
    static attack(S, targetX, targetY) {
        const C = Rimeguard.CFG, st = Rimeguard.st(S), now = S.time.now;
        if (now - st.slamAt < C.CD * (st.blocking ? C.BLOCK_SLOW : 1)) return;   // (the shield up: the maul's slower)
        st.slamAt = now; S._gearFiredAt = now;   // (Creatures.gear swings the maul; its sound)
        const cam = S.cameras.main, aim = Math.atan2(targetY + cam.scrollY - S._shotY(), targetX + cam.scrollX - S._shotX());
        // the wind-up: frost drawn in to the maul's head as it's raised
        const hx = S._shotX() + Math.cos(aim) * 6, hy = S._shotY() - 18;
        for (let i = 0; i < 6; i++) {
            const a = Math.random() * Math.PI * 2, d = 18 + Math.random() * 16;
            const m = S.add.sprite(hx + Math.cos(a) * d, hy + Math.sin(a) * d, 'fx_rimeguard', i % 2 ? 'flake_0' : 'shard_2').setScale(1.2).setTint(0xcff4ff).setBlendMode(Phaser.BlendModes.ADD).setDepth(3.3);
            S.tweens.add({ targets: m, x: hx, y: hy, scale: 0.5, alpha: 0.4, duration: C.WIND * (0.7 + Math.random() * 0.3), ease: 'Quad.easeIn', onComplete: () => m.destroy() });
        }
        const blk = !!st.blocking;
        S.time.delayedCall(C.WIND, () => Rimeguard.slam(S, aim, blk));
    }
    static slam(S, aim, blk = false) {
        if (!S.player?.active || S._deathScreenActive) return;
        const C = Rimeguard.CFG, T = S.TILE_SIZE, F = Rimeguard.fx(S), ox = S.playerX, oy = S.playerY, cx = S._shotX(), cy = S._shotY(), now = S.time.now;
        const dmg = C.DMG * (S.damageScaling || 1) * Rimeguard.armorMult(), deg = aim * 180 / Math.PI, reach = blk ? C.REACH_BLOCK : C.REACH;
        const inCone = (dx, dy) => { const d = Math.hypot(dx, dy); return d >= 0.5 && d <= reach + 0.25 && Math.abs(Phaser.Math.Angle.Wrap(Math.atan2(dy, dx) - aim)) <= C.CONE / 2 + 0.12; };
        for (const e of [...(S.enemies || [])]) {
            if (!e.sprite?.active || e.health <= 0 || S._phasedOut?.(e)) continue;
            if (!inCone(e.x - ox, e.y - oy) || !S.isInCurrentRoom(e.x, e.y)) continue;
            Rimeguard.hit(S, e, dmg, S._chillCfg().DIRECT * (blk ? 1 : C.CHILL_FREE));
            if (!blk && e.sprite?.active && e.health > 0 && !e.isBoss) {   // the free swing taunts what it hits
                if (!((e._rgTauntUntil || 0) > now)) S.showStatusText?.(e.sprite.x, e.sprite.y - 18, 'TAUNTED', '#9fdcff');
                e._rgTauntUntil = now + C.TAUNT_MS;
            }
            if (e.sprite?.active) {   // ice bursting off it, the way the blow went
                S._vfxFlash?.(e.sprite.x, e.sprite.y - 6, 22, 0x9fdcff, 150, 0.5);
                F.dir = [deg, 70]; F.shard.emitParticleAt(e.sprite.x, e.sprite.y - 4, 4); F.dir = null;
            }
        }
        // a boss (once, whichever of its tiles is in the cone) and queens
        const R = Math.ceil(reach + 0.25), seen = new Set();
        let boss = false;
        for (let dx = -R; dx <= R; dx++) for (let dy = -R; dy <= R; dy++) {
            if (!inCone(dx, dy)) continue;
            const x = ox + dx, y = oy + dy;
            if (!boss && S.damageBossAtTile?.(x, y, dmg, undefined, 'ice')) boss = true;
            const p = S.getPortalAt?.(x, y);
            if (p && !seen.has(p)) { seen.add(p); S.damagePortal(p, dmg); }
        }
        // the look: the crater where it lands, spikes jutting along the cone, ice and mist thrown down it
        const ix = cx + Math.cos(aim) * T * 0.95, iy = cy + Math.sin(aim) * T * 0.95;
        const imp = S.add.sprite(ix, iy, 'fx_rimeguard', 'slam_0').setScale(2.4).setDepth(0.66).play('rg_slam');
        imp.once('animationcomplete', () => S.tweens.add({ targets: imp, alpha: 0, duration: 380, onComplete: () => imp.destroy() }));
        S._vfxFlash?.(ix, iy, 44, 0x9fdcff, 200, 0.35);
        S.cameras.main.shake(80, 0.004);
        (blk ? [[1.15, 3, 0.55]] : [[1.35, 3, 0.6], [2.05, 5, 0.72], [2.75, 6, 0.74]]).forEach(([r, n, half], k) => {
            for (let i = 0; i < n; i++) {
                const a = aim + (n > 1 ? (i / (n - 1) - 0.5) * 2 * half : 0) + (Math.random() - 0.5) * 0.15;
                Rimeguard.spike(S, cx + Math.cos(a) * r * T, cy + Math.sin(a) * r * T + 4, 0.85 + 0.15 * k + Math.random() * 0.2, 25 + k * 45 + Math.random() * 20, Math.sin(a) > -0.3);
            }
        });
        F.dir = [deg, 85];
        for (let i = 0; i < 10; i++) F.shard.emitParticleAt(ix + (Math.random() - 0.5) * 18, iy + (Math.random() - 0.5) * 14, 1);
        for (let i = 0; i < 6; i++) { const r = (0.4 + Math.random() * 1.6) * T, a = aim + (Math.random() - 0.5) * C.CONE; F.mist.emitParticleAt(cx + Math.cos(a) * r, cy + Math.sin(a) * r, 1); }
        F.flake.emitParticleAt(ix, iy, 4);
        F.dir = null;
        F.glow.emitParticleAt(ix, iy, 1);
    }

    // A hit on you (CombatSystem.takeDamage, before armor and the talents): an enemy's is a charge of Rime (at full it goes
    // off); on the raised shield it's blocked and a charge more, or parried. Returns what's left of it.
    static guard(S, amount) {
        if (!Rimeguard.worn(S) || !(amount > 0) || !S.player) return amount;
        const src = S._hitBy?.sprite;
        if (!src) return amount;   // (burns, bleeds, the floor: no one to answer, nothing to turn the shield to)
        const C = Rimeguard.CFG, st = Rimeguard.st(S), now = S.time.now, was = st.rime;
        const a = Math.atan2(src.y - S.player.y, src.x - S.player.x);
        const front = Rimeguard.held(S) && st.blocking && Math.abs(Phaser.Math.Angle.Wrap(a - Rimeguard.aim(S))) <= C.GUARD;
        st.hurtAt = now;
        if (now - (st.countAt || -1e9) >= C.GAP) {
            st.countAt = now;
            st.rime = Math.min(C.HITS, st.rime + (amount >= C.BIG * (S.maxHealth || 100) ? 2 : 1) + (front ? 1 : 0));
            if (Rimeguard.held(S) && was < C.RIME_MIN && st.rime >= C.RIME_MIN) Sfx.play(S, 'rready', { el: 'ice' });
            if (st.rime >= C.HITS) S.time.delayedCall(120, () => Rimeguard.release(S, true));
        }
        if (!front) return amount;
        Rimeguard.flare(S, a);
        return amount * (1 - Rimeguard.block());
    }
    // the shield's face flaring toward what it blocked, frost thrown back at it
    static flare(S, a) {
        const st = Rimeguard.st(S), F = Rimeguard.fx(S), b = Rimeguard.body(S), [f, fl] = Rimeguard.dir(a);
        const x = b.x + Math.cos(a) * 17, y = b.y - 3 + Math.sin(a) * 13;
        st.blockAt = S.time.now;
        const s = S.add.sprite(x, y, 'fx_rimeguard', `flare_${f}_1`).setFlip(!!fl, !!fl).setTint(0xbfe8ff).setAlpha(0.9).setBlendMode(Phaser.BlendModes.ADD).setScale(1.3).setDepth(3.5);
        S.tweens.add({ targets: s, alpha: 0, scale: 1.9, duration: 260, ease: 'Quad.easeOut', onComplete: () => s.destroy() });
        F.dir = [a * 180 / Math.PI, 80]; F.shard.emitParticleAt(x, y, 5); F.flake.emitParticleAt(x, y, 2); F.dir = null;
        S._vfxFlash?.(x, y, 26, 0x9fdcff, 160, 0.45);
        Sfx.play(S, 'block');
    }

    // Every frame: the Rime melts once you've gone unhurt a while; the shield's face toward your aim, the frost on you
    // and the bar over you, while you hold it
    static tick(S, time) {
        const st = S._rg || (Rimeguard.worn(S) && S.player?.active ? Rimeguard.st(S) : null);
        if (!st) { if (S._rgBar) Rimeguard.bar(S); return; }
        const C = Rimeguard.CFG, dt = Math.min(100, time - (st.tickAt ?? time));
        st.tickAt = time;
        // the shield raised: right-click held, or toggled with the weapon's second key (a touch screen's G button); put down
        // when you switch away
        if (!st.blockKey) {   // (a tap, however quick)
            st.blockKey = true;
            S.input.keyboard?.on('keydown-' + Settings.key('detonate'), ev => { if (!ev?.repeat && Rimeguard.held(S) && !S._pauseMenuOpen && !S._deathScreenActive && S._rg) S._rg.toggled = !S._rg.toggled; });
        }
        if (!Rimeguard.held(S)) st.toggled = false;
        const up = Rimeguard.held(S) && S.player?.active && !S._pauseMenuOpen && !S._deathScreenActive
            && (!!(!S._touch && S.input.activePointer?.rightButtonDown?.()) || !!st.toggled);
        if (up && !st.blocking) st.blockFrom = time;
        st.blocking = up;
        const melting = st.rime > 0 && time - st.hurtAt > C.MELT_DELAY;
        if (melting && time - (st.meltAt || 0) >= C.MELT_MS) { st.meltAt = time; st.rime = Math.max(0, Math.ceil(st.rime) - 1); }
        Rimeguard.look(S, time, melting);
        Rimeguard.bar(S);
    }
    static look(S, time, melting) {
        const st = S._rg, p = S.player, ADD = Phaser.BlendModes.ADD;
        const show = Rimeguard.worn(S) && p?.active && p.visible !== false && (p.alpha ?? 1) > 0.05 && !S._deathScreenActive && !(S._iceShellUntil > time);
        if (!st.guard?.active) {
            st.guard = S.add.sprite(0, 0, 'fx_rimeguard', 'flare_e_0').setBlendMode(ADD).setDepth(3.3);
            st.glow = S.add.image(0, 0, 'vfx_glow').setTint(0x7fd0ff).setBlendMode(ADD).setDepth(0.98);
            st.crys = Rimeguard.SLOTS.map(() => S.add.image(0, 0, 'fx_rimeguard', 'crys_0').setOrigin(0.5, 1));
        }
        if (!show) { st.guard.setVisible(false); st.glow.setVisible(false); st.crys.forEach(c => c.setVisible(false)); return; }
        const b = Rimeguard.body(S), aim = Rimeguard.aim(S), [f, fl] = Rimeguard.dir(aim);
        const hot = Math.max(0, 1 - (time - st.blockAt) / 300);
        const raise = Math.min(1, (time - (st.blockFrom || 0)) / 90);   // (it comes up fast)
        st.guard.setVisible(!!st.blocking || hot > 0).setFrame(`flare_${f}_0`).setFlip(!!fl, !!fl).setScale((st.blocking ? 1.25 + 0.3 * raise : 1.25) + 0.2 * hot)
            .setPosition(b.x + Math.cos(aim) * 17, b.y - 3 + Math.sin(aim) * 13).setAlpha((st.blocking ? 0.7 + 0.1 * Math.sin(time * 0.006) : 0) + 0.3 * hot);
        // the Rime on you: crystals growing, a cold glow, glints; mist coming off it as it melts
        const k = Math.min(1, st.rime / Rimeguard.cap()), F = Rimeguard.fx(S), up = [];
        Rimeguard.SLOTS.forEach(([dx, dy, at, flip], i) => {
            const c = st.crys[i], g = k - at;
            if (g <= 0) { c.setVisible(false); return; }
            c.setVisible(true).setFrame('crys_' + (g > 0.2 ? 2 : g > 0.07 ? 1 : 0)).setFlipX(!!flip)
                .setPosition(b.x + dx * b.sx, b.y + dy * b.sy + 4).setScale(1.05).setDepth((p.depth ?? 1) + 0.03).setAlpha(p.alpha ?? 1);
            up.push(c);
        });
        st.glow.setVisible(k > 0).setPosition(b.x, b.y).setScale(0.45 + 0.15 * k).setAlpha(k > 0 ? 0.06 + 0.2 * k + (k >= 1 ? 0.06 * Math.sin(time * 0.01) : 0) : 0);
        if (up.length && time - (st.glintAt || 0) > (k >= 1 ? 140 : 320)) {
            st.glintAt = time;
            const c = up[Math.floor(Math.random() * up.length)];
            (melting ? F.mist : F.flake).emitParticleAt(c.x + (Math.random() - 0.5) * 4, c.y - 6 - Math.random() * 4, 1);
        }
    }
    // the Rime you carry over you (a notch a hit), only while it's out (on another element the frost on you shows it)
    static bar(S) {
        const st = S._rg, B = S._rgBar;
        if (!st || !Rimeguard.held(S) || !S.player?.active) {
            if (B) { B.g.destroy(); B.label.destroy(); S._rgBar = null; }
            return;
        }
        const C = Rimeguard.CFG, cap = Rimeguard.cap(), px = S.player.x, py = S.player.y - 18, ready = st.rime >= C.RIME_MIN;
        const b = S._rgBar ||= { g: S.add.graphics().setDepth(5.6), label: S.add.text(px, py + 7, '', { fontSize: '8px', fontFamily: UIKit.FONT.title, fontStyle: 'bold', color: '#7fd0ff', stroke: '#06121e', strokeThickness: 3, resolution: 2 }).setOrigin(0.5, 0).setDepth(5.7) };
        if (!b.g.active) { S._rgBar = null; return; }
        UIKit.rBar(b.g.clear(), px - 20, py - 3, 48, Math.min(1, st.rime / cap), { col: 0x4fb0e6, hot: 0xd8fff4, dark: 0x06121e, time: S.time.now, ready, segs: cap });
        b.label.setPosition(px, py + 7).setText(`RIME ${Math.floor(st.rime)}/${Math.round(cap)}  ·  SHATTERBACK [${Settings.label(Settings.key('surge'))}]  ·  BLOCK [RMB/${Settings.label(Settings.key('detonate'))}]`).setColor(ready ? '#d8fff4' : '#7fd0ff');
    }

    // ── Shatterback: R while you hold it, or on its own at full ──
    static release(S, auto = false) {
        const C = Rimeguard.CFG, st = Rimeguard.st(S), now = S.time.now, T = S.TILE_SIZE;
        if (auto && (st.rime < C.HITS || !S.player?.active || S._deathScreenActive)) return;
        if (st.rime < C.RIME_MIN) { Sfx.play(S, 'deny'); S.showStatusText?.(S.player.x, S.player.y - 34, `RIME ${Math.floor(st.rime)}/${C.RIME_MIN} FOR A SHATTERBACK`, '#9fdcff'); return; }
        if (now < st.releaseAt) return;
        const rime = st.rime, full = rime >= C.HITS;
        st.rime = 0; st.releaseAt = now + 400; S._gearFiredAt = now;
        const R = C.RADIUS + C.SNAP_UP * Rimeguard.perk('snap') + (full ? C.FULL_R : 0);
        const dmg = (C.BASE + C.SHARE * (S.maxHealth || 100) * rime / C.HITS) * Math.pow(C.RELEASE_UP, Rimeguard.perk('rime')) * (S.damageScaling || 1);   // (your max HP: the health tree is its damage)
        const ox = S.playerX, oy = S.playerY, cx = S._shotX(), cy = S._shotY(), F = Rimeguard.fx(S), b = Rimeguard.body(S);
        S.showStatusText?.(S.player.x, S.player.y - 34, `SHATTERBACK  ${Math.round(dmg)}`, '#d8fff4');
        Sfx.play(S, 'shatter'); Sfx.play(S, 'slam');
        S.cameras.main.shake(170, full ? 0.008 : 0.006);
        S._vfxFlash?.(cx, cy, R * T * 0.8, 0x7fd0ff, 320, 0.5);
        // the frost on you bursts off
        for (const c of st.crys) if (c.visible) { F.shard.emitParticleAt(c.x, c.y - 4, 3); F.flake.emitParticleAt(c.x, c.y - 4, 1); }
        F.shard.emitParticleAt(b.x, b.y - 4, 10); F.glow.emitParticleAt(b.x, b.y, 4);
        // spikes bursting out of the floor ring by ring, mist rolling out with them
        for (let r = 0.7; r <= R + 0.01; r += 0.7) {
            const n = Math.max(5, Math.round(Math.PI * 2 * r * T / 21)), off = Math.random() * Math.PI * 2, at = r * C.RING_MS;
            for (let i = 0; i < n; i++) {
                const a = off + (i + (Math.random() - 0.5) * 0.5) / n * Math.PI * 2, rr = (r + (Math.random() - 0.5) * 0.2) * T;
                Rimeguard.spike(S, cx + Math.cos(a) * rr, cy + Math.sin(a) * rr + 4, 0.8 + Math.random() * 0.3 + (full ? 0.12 : 0), at + Math.random() * 30, Math.sin(a) > -0.3);
            }
            S.time.delayedCall(at, () => {
                for (let i = 0; i < n / 3; i++) { const a = Math.random() * Math.PI * 2; F.mist.emitParticleAt(cx + Math.cos(a) * r * T, cy + Math.sin(a) * r * T, 1); }
                F.glow.emitParticleAt(cx + Math.cos(off) * r * T, cy + Math.sin(off) * r * T, 1);
            });
        }
        // each enemy as the spikes reach it: the hit and a big chill (already chilled: a cube)
        const chill = C.CHILL / S._chillCfg().RATE;
        for (const e of [...(S.enemies || [])]) {
            if (!e.sprite?.active || e.health <= 0 || S._phasedOut?.(e)) continue;
            const d = Math.hypot(e.x - ox, e.y - oy);
            if (d > R + 0.3 || !S.isInCurrentRoom(e.x, e.y)) continue;
            S.time.delayedCall(d * C.RING_MS + 40, () => {
                if (!e.sprite?.active || e.health <= 0 || S._deathScreenActive) return;
                Rimeguard.hit(S, e, dmg, chill);
                if (e.sprite?.active) { S._vfxFlash?.(e.sprite.x, e.sprite.y - 6, 30, 0x9fdcff, 200, 0.55); F.shard.emitParticleAt(e.sprite.x, e.sprite.y - 6, 5); }
            });
        }
        // a boss (once) and queens
        const Rt = Math.ceil(R);
        let boss = false;
        for (let dx = -Rt; dx <= Rt && !boss; dx++) for (let dy = -Rt; dy <= Rt && !boss; dy++) {
            if (Math.hypot(dx, dy) > R || S.world[ox + dx]?.[oy + dy] !== S.FLOOR) continue;
            if (S.damageBossAtTile?.(ox + dx, oy + dy, dmg, undefined, 'ice')) boss = true;
        }
        S._hitPortalsAround?.(ox, oy, R, dmg);
        Rimeguard.bar(S);
    }
}
