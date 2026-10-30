// ═══════════════════════════════════════════════════════════════════════
// FORK.JS — what the lightning ult looks like (assets/art/fx_fork, typed by hand)
// ═══════════════════════════════════════════════════════════════════════
// What it does lives in ElementSystem (_forkBegin and on); this is its art: the snap, you as a ball of lightning, its
// strikes, the floor lit where you step, and the Lightning God's armour while its aftermath runs. Much of it plays in
// stopped time (the scene clock and its animations held), so frames are stepped by tweens started then, and bolts by
// the pool's own clock (WeaponSystem.zap).
class Fork {
    // a sprite run through its frames over ms by a tween (an animation would hold in stopped time), then gone
    static flare(S, x, y, frames, { key = 'fx_fork', s = 2, ms = 260, d = 4.8, a = 1 } = {}) {
        const f = S.add.image(x, y, key, frames[0]).setScale(s).setBlendMode(Phaser.BlendModes.ADD).setDepth(d).setAlpha(a).setFlip(WeaponSystem.vr() < 0.5, WeaponSystem.vr() < 0.5);
        S.tweens.addCounter({ from: 0, to: frames.length - 0.01, duration: ms, onUpdate: tw => f.active && f.setFrame(frames[Math.floor(tw.getValue())]), onComplete: () => f.destroy() });
        return f;
    }
    // the hand-drawn sparks thrown off the snap in a ring, racing out (the scene's, made the first time)
    static ring(S) {
        if (S._forkRing?.active) return S._forkRing;
        return (S._forkRing = S.add.particles(0, 0, 'fx_storm', { frame: [0, 1, 2, 3, 5, 6].map(i => 'spk_' + i), emitting: false, lifespan: { min: 280, max: 460 },
            speed: { min: 380, max: 560 }, angle: { min: 0, max: 360 }, scale: { start: 2.2, end: 1.2 }, alpha: { start: 1, end: 0 },
            color: [0xffffff, 0xfff6b0, 0xffd23a, 0xa86a10], colorEase: 'quad.out', blendMode: 'ADD', maxParticles: 400 }).setDepth(4.75));
    }
    // The snap of your fingers: the flare off your hand, bolts cracking out every way (each of the eight, a little off it),
    // a ring of sparks racing off and a shower falling
    static snap(S, x, y) {
        Fork.flare(S, x, y, [0, 1, 2, 3, 4].map(i => 'snap_' + i), { s: 2.5, ms: 360 });
        for (let k = 0; k < 8; k++) {
            const a = (k + (WeaponSystem.vr() - 0.5) * 0.7) * Math.PI / 4, L = 52 + WeaponSystem.vr() * 48;
            WeaponSystem.bolt(S, x, y, x + Math.cos(a) * L, y + Math.sin(a) * L, k & 1 ? 'y' : 'w', { life: 420, br: 1, d: 4.75, key: 'fx_fork' });
        }
        Fork.ring(S).explode(40, x, y);
        WeaponSystem.zapSparks(S, 'y').explode(14, x, y); WeaponSystem.zapSparks(S, 'w').explode(8, x, y);
    }
    // the bolt going through one (big: when the web goes off): a strike flaring on it, sparks
    static hit(S, x, y, big = false) {
        Fork.flare(S, x, y, [0, 1, 2, 3].map(i => `zap${i}_y`), { key: 'fx_storm', s: big ? 2.2 : 1.7, ms: big ? 300 : 220 });
        WeaponSystem.zapSparks(S, 'y').explode(big ? 10 : 7, x, y);
    }
    // You as a ball of lightning at (x, y), s its size, crackling (t: real ms), its streak behind it the way it flies
    // (dx, dy): one of eight ways, never turned (east, south-east, south, north-east typed; the rest those flipped both ways)
    static head(ball, streak, x, y, dx, dy, t, s) {
        ball.setPosition(x, y).setScale(s).setFrame('ball_' + (Math.floor(t / 45) & 3)).setFlip(!!(Math.floor(t / 180) & 1), false);
        if (!(dx || dy) || !s) return streak.setVisible(false);
        const k = ((Math.round(Math.atan2(dy, dx) / (Math.PI / 4)) % 8) + 8) % 8, D = WeaponSystem.ZAP_DIR[k], m = (k & 1 ? 5 : 7) * s, back = k >= 3 && k <= 6;
        streak.setFrame('streak_' + ['e', 'se', 's', 'ne'][k % 4]).setFlip(back, back).setScale(s).setPosition(x - D[0] * m, y - D[1] * m).setVisible(true);
    }
    // a floor tile lit with current where you stepped (a of full), fading; a dim one now and then left dark, so it's cracks, not a grid
    static floor(S, x, y, a, T) {
        if (a < 0.7 && WeaponSystem.vr() < 0.35) return;
        const f = S.add.image(x, y, 'fx_fork', 'floor_' + Math.floor(WeaponSystem.vr() * 4)).setScale(T / 12).setFlip(WeaponSystem.vr() < 0.5, WeaponSystem.vr() < 0.5)
            .setBlendMode(Phaser.BlendModes.ADD).setDepth(0.27).setAlpha(a);
        S.tweens.add({ targets: f, alpha: 0, duration: 260, onComplete: () => f.destroy() });
    }

    // ── THE LIGHTNING GOD ── the ult's armour while its aftermath runs (CreatureFX.ultArmor hands lightning here): the slime
    // a storm-dark plate (its own frame, tinted) with a rim of gold light, circuits glowing on it, eyes alight, a crackling
    // halo over it, a ring of static under it, arcs crawling over it, now and then a bolt from the halo to the ground,
    // sparks rising off it.
    // `target`: another creature wearing it (an Ult Absorber with the ult it stole): thinner, no halo strikes or sparks.
    static armour(scene, ms, target = null) {
        const p = target || scene.player, part = !!target, holder = part ? target : scene;
        if (!p?.active) return;
        holder._ultArmor?.end?.();
        const ADD = Phaser.BlendModes.ADD, t0 = scene.time.now, fw = p.frame.width, fh = p.frame.height, vr = WeaponSystem.vr;
        const shell = scene.add.sprite(p.x, p.y, p.texture.key, p.frame.name).setTintFill(0x1a1a34);
        const rim = scene.add.sprite(p.x, p.y, p.texture.key, p.frame.name).setTintFill(0xffe14a).setBlendMode(ADD);
        const floor = scene.add.image(p.x, p.y, 'vfx_glow').setTint(0xffe14a).setBlendMode(ADD);
        const halo = scene.add.image(p.x, p.y, 'fx_fork', 'halo_0').setBlendMode(ADD).setVisible(!part);
        const ring = scene.add.image(p.x, p.y, 'fx_fork', 'ring_0').setBlendMode(ADD).setVisible(!part);   // the ring of static on the floor under it
        const circ = [0, 1].map(i => scene.add.image(p.x, p.y, 'fx_fork', 'circ_' + i).setBlendMode(ADD));
        const eyes = [0.38, 0.62].map(u => ({ u, img: scene.add.image(p.x, p.y, 'fx_fork', 'eye_0').setBlendMode(ADD) }));
        const motes = part ? null : scene.add.particles(0, 0, 'fx_storm', { frame: [0, 4, 6, 7].map(i => 'spk_' + i), lifespan: { min: 600, max: 1000 }, frequency: 70,
            speedY: { min: -46, max: -20 }, speedX: { min: -10, max: 10 }, scale: { start: 1.4, end: 0.8 }, alpha: { start: 0.9, end: 0 },
            color: [0xfff6b0, 0xffd23a, 0xa86a10], blendMode: 'ADD', emitZone: { type: 'random', source: new Phaser.Geom.Rectangle(-24, -3, 48, 6) } });
        let arcAt = 0, boltAt = t0 + 400;
        const tick = () => {
            const now = scene.time.now, tt = now - t0;
            if (!shell.active || !rim.active) { scene.events.off('postupdate', tick); if (holder._ultArmor === A) holder._ultArmor = null; return; }   // destroyed under it (a floor change, a death)
            if (!p.active || tt >= ms) return A.end();
            const fade = Math.min(1, tt / 200, (ms - tt) / 300), d = p.depth ?? 1, sx = p.scaleX, sy = p.scaleY, vis = p.visible, al = (p.alpha ?? 1) * fade;
            for (const [o, ds, a, k] of [[shell, 0.0004, 0.82 * (part ? 0.6 : 1), 1], [rim, -0.01, 0.55 * (0.7 + 0.3 * Math.sin(now * 0.05)), 1.12]])
                o.setTexture(p.texture.key, p.frame.name).setPosition(p.x, p.y).setOrigin(p.originX, p.originY).setScale(sx * k, sy * k).setFlipX(p.flipX).setDepth(d + ds).setAlpha(a * al).setVisible(vis);
            const ox = fw * p.originX, oy = fh * p.originY, px = Math.max(1, Math.abs(sx));
            const wx = u => p.flipX ? p.x + (ox - u * fw) * Math.abs(sx) : p.x + (u * fw - ox) * Math.abs(sx), wy = v => p.y + (v * fh - oy) * Math.abs(sy);
            const cx = wx(0.5), top = wy(0.6), feet = wy(1.0), W = fw * Math.abs(sx) * 0.42, on = vis && al > 0.05;
            floor.setPosition(cx, feet - px * 2).setDisplaySize(W * 3.2, W * 1.1).setDepth(d - 0.02).setAlpha((0.35 + 0.15 * Math.sin(now * 0.006)) * al).setVisible(vis);
            const hy = top - W * 0.55 + Math.round(Math.sin(now * 0.004) * 1.5) * px;   // the halo bobbing over it, its nodes going round
            ring.setPosition(Math.round(cx), Math.round(feet)).setScale(px).setFrame('ring_' + (Math.floor(tt / 110) & 3)).setDepth(d - 0.03).setAlpha(al * (0.75 + 0.25 * Math.sin(now * 0.006))).setVisible(vis && !part);
            halo.setPosition(Math.round(cx), Math.round(hy)).setScale(px).setFrame('halo_' + (Math.floor(tt / 90) & 3)).setDepth(d + 0.0009).setAlpha(al).setVisible(vis && !part);
            const lit = 0.5 + 0.5 * Math.sin(now * 0.02);
            circ.forEach((c, i) => c.setPosition(cx, wy(0.86)).setScale(px).setFlipX(p.flipX).setDepth(d + 0.0007 + i * 0.0001).setAlpha(al * (i ? 0.35 + 0.65 * lit : 0.9)).setVisible(vis));
            for (const e of eyes) e.img.setPosition(wx(e.u), wy(0.78)).setScale(px).setFrame(Math.floor(now / 120) % 7 ? 'eye_0' : 'eye_1').setDepth(d + 0.0009).setAlpha(al).setVisible(vis);
            if (motes) { motes.setPosition(cx, feet).setDepth(d + 0.01); motes.emitting = on; }
            if (on && now > arcAt) {   // arcs crawling over it, a few at a time, each a moment
                arcAt = now + 70;
                for (let n = 0; n < 2; n++) WeaponSystem.bolt(scene, wx(0.22 + vr() * 0.56), wy(0.7 + vr() * 0.26), wx(0.22 + vr() * 0.56), wy(0.7 + vr() * 0.26), n ? 'w' : 'y', { life: 70, thin: true, br: 0, glow: false, a: al, d: d + 0.001 });
            }
            if (on && !part && now > boltAt) {   // a bolt from the halo to the ground beside it
                boltAt = now + 500 + vr() * 600;
                const side = vr() < 0.5 ? -1 : 1, gx = cx + side * W * (1 + vr());
                WeaponSystem.bolt(scene, cx + side * W * 0.6, hy, gx, feet, 'y', { life: 170, br: 1, d: d + 0.03 });
                WeaponSystem.zapFlare(scene, gx, feet, 'y', 1, d + 0.03); WeaponSystem.zapSparks(scene, 'y').explode(4, gx, feet);
                scene._vfxFlash?.(gx, feet, 26, 0xffe14a, 140, 0.6);
            }
        };
        const A = holder._ultArmor = { el: 'lightning', end: () => {
            scene.events.off('postupdate', tick);
            for (const o of [shell, rim, floor, halo, ring, ...circ, ...eyes.map(e => e.img)]) o?.destroy();
            if (motes?.active) { motes.stop(); scene.time.delayedCall(1100, () => motes.destroy()); }
            if (holder._ultArmor === A) holder._ultArmor = null;
        } };
        scene.events.on('postupdate', tick); scene.events.once('shutdown', A.end);   // after the scene's own update, where the step glide moves the slime
        tick();
        // putting it on (once Fork's stopped time is over: you're lightning till then): the slime flashing gold, a bolt
        // from the sky onto it, sparks (the snap has just lit it: no more light, or the pack goes white)
        const don = () => {
            if (!p.active || !shell.active) return;
            const flash = scene.add.sprite(p.x, p.y, p.texture.key, p.frame.name).setOrigin(p.originX, p.originY).setScale(p.scaleX * 1.3, p.scaleY * 1.3).setFlipX(p.flipX).setTintFill(0xffe14a).setBlendMode(ADD).setDepth((p.depth ?? 1) + 0.03).setAlpha(0.9);
            scene.tweens.add({ targets: flash, scaleX: p.scaleX, scaleY: p.scaleY, alpha: 0, duration: 320, onComplete: () => flash.destroy() });
            if (part) return;
            WeaponSystem.bolt(scene, p.x + (vr() - 0.5) * 40, p.y - 180, p.x, p.y - 4, 'w', { life: 340, br: 2, d: (p.depth ?? 1) + 0.04, key: 'fx_fork' });
            WeaponSystem.zapSparks(scene, 'y').explode(16, p.x, p.y + 6);
            scene.cameras.main.shake(180, 0.006);
        };
        if (part) don(); else scene.time.delayedCall(0, don);
    }
}
