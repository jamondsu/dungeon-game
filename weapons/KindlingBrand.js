// ═══════════════════════════════════════════════════════════════════════════
// KindlingBrand.js — the Kindling Brand (fire; 'ignition' in the code): the flamethrower, its brands and their payout,
// and the ignite bar.
// GameScene borrows each method through a one-line proxy, so `this` in them is the scene.
// ═══════════════════════════════════════════════════════════════════════════

class KindlingBrand {

    // A weapon that deals no damage on contact. Every hit STORES its payload on the
    // target as kindling and starts a fuse; when the fuse runs out the whole accumulation
    // detonates at once, scaled by how many times you managed to hit that one enemy.
    //
    // Built on triggerCombustion, which until now had exactly ONE live call site in the
    // entire codebase -- inside the fire ult. The burst, the lava ring, the fire-elemental
    // and ice-elemental handling and the COMBUSTION! readout were all already written and
    // unreachable from any weapon. This gives that system a reason to exist.
    //
    // WHY THERE IS NO DETONATE KEY: hitting a DIFFERENT enemy cashes out the current mark
    // immediately. Walking your aim off the target is the early detonate. That enforces
    // the single-target discipline through the normal act of aiming instead of through a
    // keybind, and it means spreading your fire is self-punishing -- you keep collecting
    // small payouts instead of one large one.
    _kindlingCfg() {
        return {
            COOLDOWN:   130,    // machine-gun cadence, ~7.7 pellets/sec
            // 0.1. A full 60-pellet cycle chips 6 damage against a ~333 detonation — under
            // 2% of the weapon's output. The point is not just that the gun is weak: at
            // 0.4 a full cycle chipped 24, which is enough to kill a 32 HP queen minion
            // outright and throw away the entire bank you had built on it. At 0.1 nothing
            // dies to the pellets, so the detonation always gets to happen.
            PELLET_DMG: 0.1,
            // What a pellet does once the bar is ALREADY FULL. The bar filling no longer
            // detonates -- it opens a window that lasts until the fuse expires, and in
            // that window the gun itself finally bites. This exists because capping early
            // used to just skip the rest of the fuse, so the reward for filling fast was
            // a shorter fight rather than a better one; now filling fast buys you a LONGER
            // window, and how long you have is decided by how well you shot.
            //
            // 5, not the 3 that first looked right: the window costs ~2.8s of waiting for
            // the same detonation, so anything under 5 is a straight dps loss versus just
            // capping and moving on. At 5 the cycle comes out level with the old one and
            // the gradient does the interesting work.
            FULL_DMG:   3,      // a pellet into a full (overkindled) mark (5 before pellets could apply Burn)
            BURN_CHANCE: 0.12,  // a pellet's chance to apply a Burn stack: Ignition feeds fire's burn, and the detonation cashes it in
            BURST:      12,     // pellets in a burst
            BURST_GAP:  25,     // ms between pellets inside a burst -- very fast
            BURST_CHANCE: 0.10 + 0.05 * WeaponLevels.perk('ignition', 'burst'), // every shot rolls for a free burst
            // 10 tiles, not 5. Five was inherited from when this was a short-range brand
            // and never revisited: it left the T4 machine gun reaching barely further than
            // the Flame Sword's 2.6-tile arc while the T3 Magma Staff throws fireballs 15
            // tiles. Ten keeps a real difference from the staff -- the staff is slow
            // artillery with the longer reach, this is a fast stream with less of it --
            // without the gun being outranged by melee.
            // Effectively unlimited: walls stop pellets, so this is only a backstop so a
            // round that escapes the map cannot live forever. No room is 40 tiles across.
            RANGE:      40,     // tiles
            SPEED:      720,    // px/sec
            PELLET_R:   4,      // collision radius, px -- deliberately small
            // Half-angle of the cone, in radians. 0.07 is ~4deg — at the far end of
            // range that is about two thirds of a tile of drift, enough that a long shot
            // can genuinely miss; up close it is a few pixels and you will not notice it.
            // At the old 0.045 the widest possible deviation was still inside the 14px
            // collision reach at any normal distance, so the spread could never actually
            // cause a miss: it was jitter you could not see doing nothing you could feel.
            SPREAD:     0.07,
            // EXP alone sets how much focus is worth: a pellet at the cap is worth
            // (MAX_HITS/10)^(EXP-1) times one at ten hits, so 1.8 over a 60 cap makes late
            // pellets ~4.2x early ones. STORE only scales the whole curve, so the two
            // dials stay independent -- EXP for the shape, STORE for the ceiling.
            // 0.48. STORE has moved every time the burst has, and always for the same
            // reason: the payout is collected when the bar CAPS, so anything that changes
            // how fast pellets land changes dps without touching a damage number. A 10%
            // chance of 8 pellets works out to ~11.5 pellets/sec against 7.7 baseline, so
            // the cap arrives in ~2.6s instead of ~3.8s. The ceiling is what is being held
            // steady across these changes, not this constant.
            STORE:      1.25,   // (3.0 till 2026-10-28: a full bar paid ~650, the burst of a T5 on a T4; 0.42 over the old 60-pellet bar)
            STORE_OLD:  0.42,   // (0.45 before RAMP_DMG moved ~6% of a full mark's payout into the pellets)
            RAMP_DMG:   0.9,    // past RAMP_FROM of the bar a pellet chips up to this much more, rising to the cap: the gun isn't dead while it builds
            RAMP_FROM:  0.3,   // payload banked per pellet, before the exponent (0.21: level with the T3 staff)
            EXP:        1.8,    // see _kindlingPayout -- the whole design lives here
            // 60, doubled. The bar is the commitment: at ~11.5 pellets/sec that is over
            // five seconds of unbroken fire on ONE target to fill, and the payout only
            // reaches its interesting range in the back half of that. Thirty filled too
            // quickly for the exponent to ever really bite.
            MAX_HITS:   20,   // jet ticks to fill (20 x TICK = 4.5s; Blue Flame 3s)   // filling the bar detonates it early, see _brandEnemy 
            // 8s, up from 5. The fuse has to outlast the bar or the cap is unreachable:
            // 60 pellets at the baseline 7.7/sec is 7.8 seconds, so a 5s window would have
            // made the top of the curve literally impossible without burst luck.
            FUSE:       8000,   // (no longer a fuse: kept as the scale the ring's cooling arc is drawn against)
            COOL_DELAY: 2500,   // a mark left unfed this long starts to cool
            COOL_RATE:  3.5,    // ...losing this many ticks of heat a second; cooled to nothing it fizzles
            OVER_MS:    3000,   // overkindled holds while the jet is on it; this long after the jet leaves, it goes off by itself
            CASCADE:    0.25,   // fraction dealt to enemies within CASCADE_R on detonation
            // Under a tile. The detonation is a single-target payoff, so its splash is a
            // courtesy to whatever is pressed right up against the target, not an AoE.
            CASCADE_R:  0.8,    // tiles
            // How many marks can burn at once. Marking a third target detonates the
            // OLDEST rather than refusing the mark, so the limit never blocks you -- it
            // just decides for you which bank cashes out. Two is enough to let you work a
            // pair, and few enough that you cannot quietly seed a whole room and collect
            // later, which would turn a single-target weapon into an area one.
            MAX_MARKS:  2,
            JET_EVAP:   2,      // the flame dries water: this much of a tile's 6 HP a tick (3 ticks, ~0.7s, a tile)
            FUEL_MS:    9000,   // a full tank: this long lit (a fill plus the second ring fits with room to spare)
            REFUEL_MS:  4000,   // empty to full while it's out
            DRY_MS:     1500,   // run dry and it can't relight for this long
            DET_PCT:    0.03,   // a full bar's detonation also takes 3% of the target's max HP (x the overheat: up to 12%; 6% till 2026-10-28)
            DET_BOSS:   0.25,   // story bosses take a quarter of that share
            IGNITE_DUR: 5000 + 1000 * WeaponLevels.perk('ignition', 'burst'),   // Blue Flame (R): this long (Long Flame: +1s a level)
            // ── THE FLAMETHROWER (2026-10-20: it was a machine gun) ── a fan of fire JET_R tiles long, JET_ARC radians either side
            // of your aim, stopped by walls. A tick every TICK (Blue Flame: BLUE_TICK): the MARK_N closest enemies in the flame are
            // its marks (existing marks first) and fill a tick of kindling, taking CHIP (+CHIP_RAMP as they fill; MELT once
            // overkindled); every enemy in it rolls JET_BURN for a burn stack, the overkindled excepted. Blue Flame ignores resistance.
            // (TICK_PCT: every tick on a mark also takes this share of its max HP)
            STORE_MAX: 0.4,   // overkindled and still fed, a second ring fills, up to this share of a bar: the mark starts there again once detonated
            MELT_PCT: 0.002, OVER_BURN: 0.5,   // an overkindled tick: MELT + this share of max HP (instead of TICK_PCT), and this burn chance (instead of JET_BURN)
            JET_R: 7.2 + 0.8 * WeaponLevels.perk('ignition', 'reach'), JET_ARC: 0.62 * (1 + 0.15 * WeaponLevels.perk('ignition', 'spray')), TICK_PCT: 0.001, TICK: 225, BLUE_TICK: 150, MARK_N: 2, CHIP: 1.6, CHIP_RAMP: 2.4, MELT: 10,
            JET_BURN: 0.12 + 0.04 * WeaponLevels.perk('ignition', 'mix'), BLUE_BURN: 0.05,   // perks: Long Nozzle, Wide Spray, Hot Mix
            PASS:       0.8,    // a mark whose target dies hands this share of its heat to the nearest enemy...
            PASS_R:     5,      // ...within this many tiles (in waves the target often died first and the bank was lost)
            IGNITE_COOL: 16000,
        };
    }

    // Total payout for h hits. Superlinear but bounded: the multiplier climbs with hit
    // count so a long uninterrupted focus is worth disproportionately more than the same
    // hits split across two enemies, while MAX_HITS stops an attack-speed buff from
    // turning it into an arbitrarily large number.
    // STORE * h^1.6, capped at MAX_HITS. The exponent is the entire weapon.
    //
    // At 1.6 the payout is superlinear in hit count, so the value of a pellet depends on
    // how many of its neighbours landed on the SAME enemy: around 2 damage per pellet at
    // five hits, around 7 at thirty. Early kindling is deliberately close to worthless --
    // stopping at five hits pays less than the pellets themselves did -- and the weapon
    // only becomes a weapon once you have stayed on one target long enough to earn the
    // curve's steep end.
    //
    // It is also what makes spreading fire legal but bad. Thirty pellets in one enemy pay
    // roughly 1.5x what fifteen-and-fifteen pay and over 2x what three lots of ten pay,
    // so you CAN work a crowd, you just always earn less for the same trigger time.
    _kindlingPayout(hits) {
        const C = this._kindlingCfg();
        const h = Math.min(hits, C.MAX_HITS);
        if (h <= 0) return 0;
        return C.STORE * Math.pow(h, C.EXP) * (this.damageScaling || 1);
    }

    // ── BRANDABLE TARGETS ────────────────────────────────────────────────────
    // Bosses are not in this.enemies and do not share its shape: they carry container/hp
    // where an enemy carries sprite/health, which is why pellets flew straight through
    // them. Portals (Queen Slimes) are a third shape again. These three helpers are the
    // only places that difference is allowed to exist; everything else in the kindle
    // system treats a target as a target.
    _kindleBrandables() {
        const out = (this.enemies || []).slice();
        if (this.voltslimeBoss?.active)     out.push(this.voltslimeBoss);
        if (this.voidSovereignBoss?.active) out.push(this.voidSovereignBoss);
        for (const p of (this.portals || [])) if (p.active) out.push(p);
        return out;
    }

    _kindlePos(o) {
        if (o?.sprite?.active) return { x: o.sprite.x, y: o.sprite.y };
        if (o?.container)      return { x: o.container.x, y: o.container.y };
        if (o?.tileX !== undefined) {
            const TS = this.TILE_SIZE;
            return { x: o.tileX * TS + TS / 2, y: o.tileY * TS + TS / 2 + (o.hitOffY || 0) };
        }
        return null;
    }

    _kindleAlive(o) {
        if (!o) return false;
        if (o === this.voltslimeBoss || o === this.voidSovereignBoss)
            return !!o.active && o.hp > 0;
        if ((this.portals || []).includes(o)) return !!o.active && o.hp > 0;
        return !!o.sprite?.active && o.health > 0 && (this.enemies || []).includes(o);
    }

    // Routes a payout to whichever damage entry point the target actually uses.
    _kindleDamage(o, amount) {
        if (o === this.voltslimeBoss)     { this.damageVoltslimeBoss(amount); return; }
        if (o === this.voidSovereignBoss) { this.damageVoidSovereignBoss(amount); return; }
        if ((this.portals || []).includes(o)) { this.damagePortal(o, amount); return; }
        this.damageEnemy(o, amount, 'fire');
    }

    // The flamethrower: a tick of fire into the fan in front of you (see the JET_ keys in _kindlingCfg)
    kindlingBrandAttack(targetX, targetY) {
        const C = this._kindlingCfg(), now = this.time.now, blue = (this._kindleIgniteUntil || 0) > now;
        if (now - (this._lastKindleTime || 0) < (blue ? C.BLUE_TICK : C.TICK)) return;
        this._lastKindleTime = now;
        Sfx.sustain(this, blue ? 'blueflame' : 'flame', (blue ? C.BLUE_TICK : C.TICK) * 1.8);   // the roar, held while it burns
        this._gearFiredAt = now;   // the held weapon swings now (Creatures.gear)
        const T = this.TILE_SIZE, cam = this.cameras.main, tip = typeof CreatureFX !== 'undefined' ? CreatureFX.gearTip?.(this) : null;   // from the gun's muzzle
        const px = tip?.x ?? this.player.x, py = tip?.y ?? this.player.y - 6;
        const ang = Math.atan2(targetY + cam.scrollY - py, targetX + cam.scrollX - px), R = C.JET_R * T;
        this._jetFx(px, py, ang, blue);
        const clear = (x1, y1) => { const n = Math.ceil(Math.hypot(x1 - px, y1 - py) / (T / 2)); for (let k = 1; k < n; k++) { const x = px + (x1 - px) * k / n, y = py + (y1 - py) * k / n; if (this.world?.[Math.floor(x / T)]?.[Math.floor(y / T)] !== this.FLOOR) return false; } return true; };
        const inFan = [];
        for (const o of this._kindleBrandables()) {
            if (!this._kindleAlive(o)) continue;
            const p = this._kindlePos(o); if (!p) continue;
            const d = Math.hypot(p.x - px, p.y - py), big = o === this.voltslimeBoss || o === this.voidSovereignBoss ? T * 1.5 : 0;
            if (d > R + big || Math.abs(Phaser.Math.Angle.Wrap(Math.atan2(p.y - py, p.x - px) - ang)) > C.JET_ARC + (d < T ? 0.6 : 0) || !clear(p.x, p.y)) continue;
            inFan.push({ o, d });
        }
        inFan.sort((a, b) => a.d - b.d);
        // the marks are fixed: MARK_N at most, kept until detonated (G) or cooled out; a third enemy in the flame isn't marked
        const held = [...(this._kindleMarked || [])].filter(o => this._kindleAlive(o) && o._kindleHits > 0);
        const marks = inFan.filter(f => held.includes(f.o)).map(f => f.o);
        let free = C.MARK_N - held.length;
        for (const f of inFan) if (free > 0 && !marks.includes(f.o)) { marks.push(f.o); free--; }
        for (const o of marks) this._brandEnemy(o, blue);
        for (const f of inFan) {   // the whole fan can catch, overkindled marks far more often
            const e = f.o;
            if (!(this.enemies || []).includes(e) || !(e.health > 0)) continue;
            const r = Math.random();
            if (blue && r < C.BLUE_BURN) this.applyBlueBurn?.(e);   // Blue Flame: now and then a blue burn stack
            else if (r < ((e._kindleHits || 0) >= C.MAX_HITS ? C.OVER_BURN : C.JET_BURN)) this.applyBurnStack?.(e, 1);
        }
        const fc = this.fractureCore;   // the Geode in the flame: a hit of fire on the plate facing you (it heats)
        if (fc?.active && fc.geode && !fc._isInvulnerable && fc.container) {
            const d = Math.hypot(fc.container.x - px, fc.container.y - py);
            if (d <= R + T && Math.abs(Phaser.Math.Angle.Wrap(Math.atan2(fc.container.y - py, fc.container.x - px) - ang)) <= C.JET_ARC + 0.3 && now - (fc._jetAt || 0) >= 450) { fc._jetAt = now; this._geodeHit?.((C.CHIP + C.MELT) * (this.damageScaling || 1), 'fire'); }
        }
        if (this.waterTiles?.size) {   // the flame boils the water it covers off to steam: JET_EVAP of a tile's 6 a tick (Blue Flame all of it)
            const r = Math.ceil(C.JET_R), ptx = Math.floor(px / T), pty = Math.floor(py / T);
            for (let x = ptx - r; x <= ptx + r; x++) for (let y = pty - r; y <= pty + r; y++) {
                if (!this.isWaterAt?.(x, y)) continue;
                const cx = x * T + T / 2, cy = y * T + T / 2, d = Math.hypot(cx - px, cy - py);
                if (d > R || (d > T && Math.abs(Phaser.Math.Angle.Wrap(Math.atan2(cy - py, cx - px) - ang)) > C.JET_ARC) || !clear(cx, cy)) continue;
                this._evaporate(x, y, blue ? 6 : C.JET_EVAP);
            }
        }
    }
    // The jet's look: a CONTINUOUS stream of fire while you hold (the damage ticks underneath, but the flame doesn't pulse
    // with them): a soft body going white-hot to yellow, orange, red and dark at the tip; teardrop tongues licking along it;
    // dark smoke rolling off the end; a glow at the nozzle. Blue Flame swaps to the blue set. One watcher per scene follows
    // your aim every frame and starts and stops the emitters.
    _jetFx(px, py, ang, blue) {
        const C = this._kindlingCfg(), T = this.TILE_SIZE, now = this.time.now;
        this._jetOn = now + (blue ? C.BLUE_TICK : C.TICK) * 1.6; this._jetBlue = blue;
        if (this._jetS?.core?.scene) return;
        const life = 520, v = C.JET_R * T / (life / 1000) / 0.95, ADD = Phaser.BlendModes.ADD;   // (fast enough, and visible long enough, to reach the full JET_R)
        const fire = WeaponSystem.fireArt(this), red = ['fw_jet', 'fw_jot'], blueA = ['fw_jetb', 'fw_jotb'];
        // the hand-drawn fire, two shapes, each burning down white -> yellow -> orange -> red -> smoke over its life
        const body = anim => this.add.particles(0, 0, fire, { anim, lifespan: { min: life * 0.85, max: life }, speed: { min: v * 0.85, max: v * 1.02 },
            scale: { start: 1.3, end: 2.6 }, alpha: { start: 1, end: 0.35, ease: 'Cubic.easeIn' }, frequency: 12, quantity: 1, emitting: false }).setDepth(4.4);
        const tongues = anim => this.add.particles(0, 0, fire, { anim, lifespan: { min: life * 0.5, max: life * 0.75 }, speed: { min: v * 0.7, max: v * 0.9 },
            scale: { start: 1, end: 1.8 }, alpha: { start: 1, end: 0.5 }, blendMode: ADD, frequency: 30, quantity: 1, emitting: false }).setDepth(4.45);
        const smoke = this.add.particles(0, 0, fire, { frame: ['jet_4', 'jot_4'], lifespan: { min: 700, max: 950 }, speed: { min: v * 0.35, max: v * 0.5 }, scale: { start: 1.6, end: 3 },
            alpha: { start: 0.35, end: 0 }, frequency: 45, quantity: 1, emitting: false, gravityY: -40 }).setDepth(4.3);
        const glow = this.add.image(0, 0, 'vfx_glow').setBlendMode(ADD).setDepth(4.46).setVisible(false);
        const S = this._jetS = { core: body(red), tong: tongues(red), coreB: body(blueA), tongB: tongues(blueA), smoke, glow, on: false, blue: false };
        // walls stop the flame like they stop its damage: a blob dies entering a tile that isn't floor (3.60 hands death zones world positions)
        const wall = (wx, wy) => !!this.world && this.world[Math.floor(wx / T)]?.[Math.floor(wy / T)] !== this.FLOOR;
        for (const em of [S.core, S.tong, S.coreB, S.tongB, S.smoke]) em.addDeathZone({ type: 'onEnter', source: { contains: wall } });
        const tick = () => {
            if (!S.core.scene || !this.player?.active) { this.events.off('update', tick); return; }
            const t = this.time.now, on = t < (this._jetOn || 0), b = !!this._jetBlue;
            const cam = this.cameras.main, ap = this._aim ? this._aim(this.input.activePointer) : this.input.activePointer;
            const tip = typeof CreatureFX !== 'undefined' ? CreatureFX.gearTip?.(this) : null, nx0 = tip?.x ?? this.player.x, ny0 = tip?.y ?? this.player.y - 6;   // out of the gun itself
            const ang = Math.atan2(ap.y + cam.scrollY - ny0, ap.x + cam.scrollX - nx0);
            this._jetAng = ang;
            const nx = nx0 + Math.cos(ang) * (tip ? 2 : 12), ny = ny0 + Math.sin(ang) * (tip ? 2 : 12), deg = Phaser.Math.RadToDeg(ang), arc = Phaser.Math.RadToDeg(C.JET_ARC) * 0.8;
            for (const em of [S.core, S.tong, S.coreB, S.tongB, S.smoke]) { em.setPosition(nx, ny); em.ops.angle.loadConfig({ angle: { min: deg - arc, max: deg + arc } }); }   // (3.60: setEmitterAngle didn't take; it sprayed all round)
            if (on !== S.on || b !== S.blue) {
                S.on = on; S.blue = b;
                for (const [em, want] of [[S.core, on && !b], [S.tong, on && !b], [S.coreB, on && b], [S.tongB, on && b], [S.smoke, on]]) want ? em.start() : em.stop();
            }
            S.glow.setVisible(on).setPosition(nx, ny).setTint(b ? 0x7ab8ff : 0xff8a2a).setScale(0.22 + 0.04 * Math.sin(t * 0.05)).setAlpha(0.45 + 0.15 * Math.sin(t * 0.07));
        };
        this.events.on('update', tick); this.events.once('shutdown', () => this.events.off('update', tick));
    }

    // Per-frame flight, collision and expiry for the pellets.
    _updateKindleBullets(time, delta) {
        const list = this._kindleBullets;
        if (!list || !list.length) return;
        const C = this._kindlingCfg();
        const dt = Math.min(delta || 16, 50) / 1000;
        const TS = this.TILE_SIZE;

        for (let i = list.length - 1; i >= 0; i--) {
            const b = list[i];
            // Keep where it WAS. At 900px/s a pellet covers ~15px per frame, which is
            // wider than its own 4px hitbox — a point test at the new position would let
            // it tunnel straight through an enemy between two frames. Collision below is
            // swept along the segment it actually travelled.
            const px0 = b.x, py0 = b.y;
            b.x += b.vx * dt; b.y += b.vy * dt;
            b.life -= dt * 1000;
            if (b.g?.active) { b.g.x = b.x; b.g.y = b.y; b.g.scaleY = 0.85 + Math.random() * 0.35; }   // the tracer flickers
            if (b.glow?.active) b.glow.setPosition(b.x - b.vx * 0.008, b.y - b.vy * 0.008);

            // Sheds embers as it flies. Throttled per bullet rather than per frame: at
            // 7.7 rounds a second with three in the air, one graphic per frame each would
            // be ~180 objects a second for a decorative effect.
            b.trail = (b.trail || 0) + dt * 1000;
            if (b.trail >= 55) {
                b.trail = 0;
                const em = this.add.graphics().setDepth(2.2);
                em.x = px0; em.y = py0;
                em.fillStyle(Math.random() < 0.4 ? 0xffd27a : 0xff6a1e, 0.55);
                em.fillCircle(0, 0, 1.6 + Math.random() * 1.2);
                this.tweens.add({
                    targets: em, alpha: 0,
                    x: px0 - b.vx * 0.06 + (Math.random() - 0.5) * 6,
                    y: py0 - b.vy * 0.06 + (Math.random() - 0.5) * 6,
                    scaleX: 0.3, scaleY: 0.3, duration: 220 + Math.random() * 160,
                    ease: 'Quad.easeOut', onComplete: () => em.destroy()
                });
            }

            let gone = b.life <= 0;
            // Walls stop pellets. Checked before enemies so you cannot shoot through one.
            if (!gone) {
                const tx = Math.floor(b.x / TS), ty = Math.floor(b.y / TS);
                // A room you have not entered stops a pellet exactly like a wall -- the
                // same isInLockedRoom test every other projectile uses. This has to run
                // BEFORE _evaporate: previously the pellet dried the tile it was stopped
                // on, so Ignition boiled water out of sealed rooms through the doorway.
                const blocked = !this.world?.[tx] || this.world[tx][ty] !== this.FLOOR
                                || this.isInLockedRoom(tx, ty);
                if (blocked) { gone = true; VisualFX.wallImpact(this, b.x, b.y, 'fire', b.vx, b.vy); }
                else this._evaporate(tx, ty, 6);         // one-shots a puddle, 11.5 a second
            }
            if (!gone) {
                for (const e of this._kindleBrandables()) {
                    if (!this._kindleAlive(e)) continue;
                    // A pellet cannot reach into a room you have not opened. damageEnemy
                    // already refuses the damage, but BRANDING does not go through it --
                    // so without this a pellet still stacked kindle on a sealed room and
                    // the mark detonated the instant you walked in.
                    if (typeof this._roomGated === 'function' && this._roomGated()
                        && e.tutorialRoomIndex !== undefined
                        && e.tutorialRoomIndex !== this.getCurrentPlayerRoom()) continue;
                    const p = this._kindlePos(e);
                    if (!p) continue;
                    // Bosses are physically huge, so they get a proportionally larger
                    // catch radius -- a 4px pellet against a 5x-scale slime should not
                    // have to thread its exact centre.
                    const big = (e === this.voltslimeBoss || e === this.voidSovereignBoss);
                    const reach = C.PELLET_R + (big ? 46 : (e.hitR ? e.hitR : 10));
                    // Swept, not point: distance from the target to the segment this
                    // pellet crossed this frame. See the note on px0/py0 above.
                    const d = (typeof Utils !== 'undefined' && Utils.distancePointToSegment)
                        ? Utils.distancePointToSegment(p.x, p.y, px0, py0, b.x, b.y)
                        : Math.hypot(p.x - b.x, p.y - b.y);
                    if (d > reach) continue;
                    // NO detonate-on-switch. It ran BEFORE _brandEnemy, so touching a
                    // second enemy popped the first mark instantly and the two-mark board
                    // could never actually fill -- and because it was gated on 8+ pellets
                    // it only did that SOMETIMES, which is what made the behaviour look
                    // random. Displacement is the manual trigger now: hold two marks, tag
                    // a third target to cash out the oldest. Same control, and it is the
                    // rule that was supposed to own this.
                    this._brandEnemy(e);
                    this._kindleSpark(b.x, b.y);
                    gone = true;
                    break;
                }
            }
            if (gone) {
                if (b.g?.active) { this.tweens.killTweensOf(b.g); b.g.destroy(); }
                b.glow?.destroy();
                list.splice(i, 1);
            }
        }
    }

    _kindleSpark(x, y) {
        VisualFX.impact(this, x, y, 'fire', 7);
        const r = this.add.circle(x, y, 3, 0, 0).setStrokeStyle(1.5, 0xffb040, 0.9).setDepth(3.4).setBlendMode(Phaser.BlendModes.ADD);
        this.tweens.add({ targets: r, scale: 3, alpha: 0, duration: 160, onComplete: () => r.destroy() });
    }

    _brandEnemy(enemy, blue = false) {
        const C = this._kindlingCfg();
        const p = this._kindlePos(enemy);
        if (!p) return;
        if (enemy.iceImmune) {
            this.showStatusText(p.x, p.y - 10, 'IMMUNE', '#88eeff');
            return;
        }
        if (!enemy._kindleHits) {
            // A NEW mark, only into a free slot: a full board stays as it is (G detonates to free it)
            if ([...(this._kindleMarked || [])].filter(o => o !== enemy && this._kindleAlive(o) && o._kindleHits > 0).length >= C.MAX_MARKS) return;
            enemy._kindleHits = 0;
            enemy._kindleUntil = 0;   // no fuse: it holds while you feed it (see _updateKindling)
        }
        const wasFull = enemy._kindleHits >= C.MAX_HITS;
        enemy._kindleHits = Math.min(C.MAX_HITS, enemy._kindleHits + 1);
        const isFull = enemy._kindleHits >= C.MAX_HITS;
        if (wasFull) {   // overkindled and still in the flame: the second ring fills a tick, up to STORE_MAX of a bar
            const cap = Math.round(C.MAX_HITS * C.STORE_MAX), was = enemy._kindleStore || 0, fp = this._kindlePos(enemy);
            enemy._kindleStore = Math.min(cap, was + 1);
            if (fp && enemy._kindleStore === cap && was < cap) this.showStatusText(fp.x, fp.y - 46, `STORED ${Math.round(C.STORE_MAX * 100)}%`, '#9fe4ff');
        }
        enemy._kindleFedAt = this.time.now;
        if (isFull && !wasFull) enemy._kindleUntil = this.time.now + C.OVER_MS;   // the overkindled window opens
        // Announced once, on the pellet that tops it off, so the window has a start you
        // can see rather than a number you have to be watching.
        if (isFull && !wasFull) {
            const fp = this._kindlePos(enemy);
            if (fp) this.showStatusText(fp.x, fp.y - 46, 'OVERKINDLED', '#9fe4ff');
        }
        // Tracked separately from this.enemies. killEnemy SPLICES a dead enemy out of that
        // array, so a marked enemy that dies simply stops being iterated and its meter is
        // never destroyed -- the bar was left hanging in the air. This set still holds it
        // afterwards, so the sweep below can clean up.
        (this._kindleMarked || (this._kindleMarked = new Set())).add(enemy);
        this._kindleTarget = enemy;
        // The pellet itself stings. Small on purpose -- 2.5 against a 30-pellet payout of
        // ~160 means the gun is worth about a third of the detonation it sets up, so it
        // stays a marker rather than becoming a DPS weapon you never bother detonating.
        // Routed through damageEnemy so ElementResist still gets a say.
        // Chip while filling, real damage once full.
        // the jet on a mark: chip that grows as it fills, then it melts once overkindled. Blue Flame ignores resistance.
        const amt = (isFull ? C.MELT : C.CHIP + C.CHIP_RAMP * enemy._kindleHits / C.MAX_HITS) * (this.damageScaling || 1) + (isFull ? C.MELT_PCT : C.TICK_PCT) * (enemy.maxHealth || enemy.maxHp || 0);   // + a share of max HP every tick (more once overkindled)
        if (blue && enemy.sprite?.active && (this.enemies || []).includes(enemy)) {
            const d = this._afterHit(enemy, 'fire', amt * this._dmgOutMult(enemy, 'fire') * this._hitRoll(enemy, 'fire'));
            enemy.health -= d; this.showDamageNumber(enemy.sprite.x, enemy.sprite.y - 10, d, '#bfe8ff'); this.updateEnemyHealthBar(enemy);
            if (enemy.health <= 0) this.killEnemy(enemy);
        } else this._kindleDamage(enemy, amt);
        this.gainUltCharge(this.ultChargePerHit * 0.5, 'fire');
        this._updateKindleIndicator(enemy);
        // NO detonate-on-cap. A full bar is a STATE, not an event: it holds until the fuse
        // runs out, and the leftover time is the reward rather than something to skip.
    }

    // Fuse check. Runs per frame from the scene update; also sweeps enemies that died or
    // were removed while marked so the banked payload does not follow a corpse around.
    _updateKindling(time, delta) {
        this._updateKindleBullets(time, delta);
        // Iterates the MARKED set, not this.enemies -- see the note in _brandEnemy.
        const marked = this._kindleMarked;
        if (!marked || !marked.size) return;
        for (const e of [...marked]) {
            if (!e || !e._kindleHits) { marked.delete(e); this._clearKindle(e); continue; }
            if (!this._kindleAlive(e)) { const h = e._kindleHits, at = e._kindleLastPos; marked.delete(e); this._clearKindle(e); this._kindlePassOn?.(h, at, e); continue; }
            e._kindleLastPos = this._kindlePos(e);
            // The meter is drawn once per HIT, but the target keeps moving between hits --
            // without this the bar detaches and hangs in the air where the last pellet
            // landed. Position only; the fill is redrawn on hit.
            if (e._kindleGfx?.active) this._drawKindleMark(e, time);   // its flame ring, alive every frame
            const C = this._kindlingCfg();
            if (e._kindleHits >= C.MAX_HITS) { if (time - (e._kindleFedAt || time) >= C.OVER_MS) this._detonateKindling(e, 'KINDLED'); continue; }   // overkindled holds while the jet's on it; left, it goes off
            // no fuse: left unfed, it cools a few pellets a second (the ring dropping back toward ember), and fizzles at nothing
            if (time - (e._kindleFedAt || time) > C.COOL_DELAY) {
                e._kindleHits = Math.max(0, e._kindleHits - C.COOL_RATE * Math.min(100, delta || 16) / 1000);
                if (e._kindleHits <= 0.5) { const fp = this._kindlePos(e); if (fp) this.showStatusText(fp.x, fp.y - 40, 'fizzled', '#8a6a4a'); marked.delete(e); this._clearKindle(e); }
            }
        }
    }

    // A marked target died with heat still banked: PASS of it jumps to the nearest enemy within PASS_R, as if shot there
    _kindlePassOn(hits, from, dead) {
        const C = this._kindlingCfg(), T = this.TILE_SIZE;
        if (!(hits > 0) || !from) return;
        let to = null, best = C.PASS_R * T;
        for (const o of this._kindleBrandables()) {
            if (o === dead || !this._kindleAlive(o) || o.iceImmune) continue;
            const p = this._kindlePos(o), d = p ? Math.hypot(p.x - from.x, p.y - from.y) : Infinity;
            if (d < best) { best = d; to = o; }
        }
        if (!to) return;
        this._brandEnemy(to);   // makes it a mark (retiring the oldest if the board's full)
        if (!to._kindleHits || !this._kindleAlive(to)) return;   // (that mark's own damage can kill it: its position went null and the crash froze the game)
        const wasFull = to._kindleHits >= C.MAX_HITS;
        to._kindleHits = Math.min(C.MAX_HITS, to._kindleHits + Math.round(hits * C.PASS) - 1);
        if (to._kindleHits >= C.MAX_HITS && !wasFull) to._kindleUntil = this.time.now + C.OVER_MS;
        this._updateKindleIndicator(to);
        const tp = this._kindlePos(to); if (!tp) return;
        const streak = this.add.image(from.x, from.y, 'vfx_glow').setTint(0xff8a2a).setBlendMode(Phaser.BlendModes.ADD).setScale(0.35).setDepth(4.5);
        this.tweens.add({ targets: streak, x: tp.x, y: tp.y, scale: 0.2, duration: 180, ease: 'Quad.easeIn', onComplete: () => streak.destroy() });
        this.showStatusText(tp.x, tp.y - 40, 'HEAT PASSED', '#ffb060');
    }
    // the detonate key: every kindled mark goes off now
    _kindleDetonateAll() {
        const L = [...(this._kindleMarked || [])].filter(e => this._kindleAlive(e) && (e._kindleHits || 0) >= 1);
        for (const e of L) this._detonateKindling(e, 'DETONATED');
        return L.length;
    }
    _detonateKindling(enemy, label) {
        if (!enemy || !enemy._kindleHits) return;
        const C = this._kindlingCfg();
        const hits = enemy._kindleHits, store = enemy._kindleStore || 0;   // the second ring: what the next kindle starts at
        const payout = this._kindlingPayout(hits);
        // ...plus a share of the target's max HP on the same curve, so it still hits hard on big HP pools (the cascade takes the flat part only)
        const boss = enemy === this.voltslimeBoss || enemy === this.voidSovereignBoss;
        const pct = C.DET_PCT * (boss ? C.DET_BOSS : 1) * (enemy.maxHealth || enemy.maxHp || 0) * Math.pow(Math.min(hits, C.MAX_HITS) / C.MAX_HITS, C.EXP);
        this._clearKindle(enemy);
        const dp = this._kindlePos(enemy);
        if (!dp) return;
        const ex = dp.x, ey = dp.y;
        this.showStatusText(ex, ey - 44, label, '#ffaa33');
        this._kindleBlast(ex, ey, Math.min(1, hits / C.MAX_HITS));

        // Regular enemies go through triggerCombustion, which owns the lava ring, the
        // immunity handling and the COMBUSTION! readout. Bosses and portals have none of
        // that shape, so they take the payload directly with their own burst drawn here.
        if (enemy.sprite?.active && (this.enemies || []).includes(enemy)) {
            this.triggerCombustion(enemy, false, payout + pct);
        } else {
            this._kindleDamage(enemy, payout + pct);
        }

        // Small cascade so a detonation reads as an explosion rather than a hit, without
        // making this a crowd weapon: neighbours take a quarter, and only the marked
        // target ever gets the full accumulation.
        // Cascade covers every brandable, so a detonation next to a boss still splashes
        // it. The old version also paid the boss and any covering portal the FULL payout
        // on top of the main target's -- a detonation on a minion standing on the Queen
        // handed her the entire bank for free.
        const R = C.CASCADE_R * this.TILE_SIZE;
        for (const other of this._kindleBrandables()) {
            if (other === enemy || !this._kindleAlive(other)) continue;
            const op = this._kindlePos(other);
            if (!op || Math.hypot(op.x - ex, op.y - ey) > R) continue;
            this._kindleDamage(other, payout * C.CASCADE);
        }
        this.cameras.main.shake(110, 0.007);
        if (store > 0 && this._kindleAlive(enemy)) {   // the stored ring: still marked, its next kindle already part full
            enemy._kindleHits = store; enemy._kindleFedAt = this.time.now;
            (this._kindleMarked || (this._kindleMarked = new Set())).add(enemy);
            this._updateKindleIndicator(enemy);
        }
    }

    // A mark going off: a column of fire (hand-drawn) erupting in the colour its heat reached, a ring of flame thrown out
    // over the floor, embers flung, smoke rising, a scorch left on the floor. Bigger the fuller it was (t, 0..1).
    _kindleBlast(x, y, t) {
        const ADD = Phaser.BlendModes.ADD, col = this._kindleHeatColor(t), s = 0.7 + 0.8 * t, blue = t >= 0.9;
        WeaponSystem.fireArt(this);
        const pil = this.add.sprite(x, y + 8, 'fx_fire_w', 'pillar_0').setOrigin(0.5, 1).setScale(1.4 * s).setTint(MenuArt.mix(col, 0xffffff, 0.45), MenuArt.mix(col, 0xffffff, 0.45), col, col).setAlpha(0.9).setDepth(4.6).play('fw_pillar');
        pil.once('animationcomplete', () => pil.destroy());
        WeaponSystem.fireRing(this, x, y + 6, 6, (24 + 20 * t) * s, 300, 5 + Math.round(5 * t), blue, 0.5);
        for (let k = 0; k < 8 + Math.round(8 * t); k++) { const a = Math.random() * Math.PI * 2, v = 60 + Math.random() * 90; WeaponSystem.ember(this, x, y - 4, Math.cos(a) * v, Math.sin(a) * v * 0.6 - 30, 400 + Math.random() * 300, blue); }
        for (let k = 0; k < 4; k++) { const sm = this.add.image(x + (Math.random() - 0.5) * 20, y - 6, 'fx_fire_w', k % 2 ? 'jet_4' : 'jot_4').setScale(1.4).setAlpha(0.5).setDepth(4.4); this.tweens.add({ targets: sm, y: sm.y - 40, scale: 3.4, alpha: 0, duration: 900 + k * 120, onComplete: () => sm.destroy() }); }
        const sc = this.add.image(x, y + 8, 'fx_fire_w', 'scorch').setScale(1.2 * s).setDepth(0.62);
        this.tweens.add({ targets: sc, alpha: 0, delay: 1200, duration: 1200, onComplete: () => sc.destroy() });
        this._vfxFlash?.(x, y, 70 * s, col, 300, 0.6);
        Sfx.play(this, 'kindle_boom');
    }

    _clearKindle(enemy) {
        if (this._kindleMarked) this._kindleMarked.delete(enemy);
        if (this._kindleTarget === enemy) this._kindleTarget = null;
        enemy._kindleHits = 0;
        enemy._kindleUntil = 0;
        enemy._kindleStore = 0;
        if (enemy.sprite?.active && !enemy._iceCube && !enemy.isFrozen) enemy.sprite.clearTint?.();   // (the heat glow off it; clearTint puts its own colour back)
        if (enemy._kindleGfx) {
            this.tweens.killTweensOf(enemy._kindleGfx);
            enemy._kindleGfx.destroy();
            enemy._kindleGfx = null;
        }
    }

    // ── KINDLE METER ─────────────────────────────────────────────────────────
    // ONE bar that fills, not a row of pips. Pips could only ever say "how many" -- at a
    // 30 hit cap that is thirty tiny rectangles nobody can count, and it hid the thing
    // that actually matters, which is how far along a steeply non-linear curve you are.
    //
    // The fill colour carries that instead: a cold ember at the start, through orange and
    // white-hot, to blue at the cap. Blue reads as hotter than red to anyone who has seen
    // a gas flame, and it only appears when you have genuinely stayed on one target -- so
    // the colour IS the payout curve, visible at a glance from across the room.
    _kindleHeatColor(t) {
        // Stops walked as a plain channel lerp. Phaser's Interpolate.ColorWithColor
        // returns {r,g,b} with no .color, which is a trap this file has hit before.
        const STOPS = [
            [0.00, 0x4a, 0x1c, 0x08],   // cold ember
            [0.40, 0xff, 0x6a, 0x1e],   // orange
            [0.72, 0xff, 0xc4, 0x4a],   // yellow-white
            // The last two stops are deliberately close in brightness. A pure white-hot
            // peak followed by a saturated blue dropped ~69 points of luminance exactly
            // when the meter is worth the most -- the bar visibly DIMMED as it filled.
            // A warmer near-peak and a paler blue keep the colour shift (which is the
            // signal) while cutting the brightness loss to about a third of that.
            [0.90, 0xff, 0xdc, 0xa8],   // near-white, held back a little
            [1.00, 0x7f, 0xd4, 0xff],   // blue hot
        ];
        const u = Math.max(0, Math.min(1, t));
        let a = STOPS[0], b = STOPS[STOPS.length - 1];
        for (let i = 0; i < STOPS.length - 1; i++) {
            if (u >= STOPS[i][0] && u <= STOPS[i + 1][0]) { a = STOPS[i]; b = STOPS[i + 1]; break; }
        }
        const span = (b[0] - a[0]) || 1;
        const k = (u - a[0]) / span;
        const ch = i => Math.round(a[i] + (b[i] - a[i]) * k);
        return (ch(1) << 16) | (ch(2) << 8) | ch(3);
    }

    // The kindle mark: a ring of coals at its feet that catches round it as the flame piles up, tongues of fire (the
    // hand-drawn ones) in the colour its heat has reached (_kindleHeatColor: ember, orange, white-hot, blue at the cap),
    // smoke and sparks off it, the fuse as a thin arc closing, and once it's overkindled a crown of blue flame over it and
    // the stored second ring filling above the first. Drawn every frame (_updateKindling).
    _updateKindleIndicator(enemy) {
        if (!enemy._kindleGfx) {
            WeaponSystem.fireArt(this);
            const c = enemy._kindleGfx = this.add.container(0, 0).setDepth(1.05), ADD = Phaser.BlendModes.ADD;
            c._ring = this.add.image(0, 0, 'fx_fire_w', 'ring').setAlpha(0.9);
            c._ring2 = this.add.image(0, -6, 'fx_fire_w', 'ring').setTint(0x6aaaff).setBlendMode(ADD).setVisible(false);
            c._fuse = this.add.graphics();
            c._crown = this.add.sprite(0, -28, 'fx_fire_w', 'crown_0').setOrigin(0.5, 1).setBlendMode(ADD).setVisible(false).play('fw_crown');
            c._licks = []; c._licks2 = [];
            c.add([c._ring, c._ring2, c._fuse, c._crown]);
            this._vfxSort?.(c);
        }
        enemy._kindleBump = this.time.now;
        this._drawKindleMark(enemy, this.time.now);
    }
    _drawKindleMark(e, now) {
        const c = e._kindleGfx, p = this._kindlePos(e); if (!c?.active || !p) return;
        const C = this._kindlingCfg(), t = Math.min(1, (e._kindleHits || 0) / C.MAX_HITS), col = this._kindleHeatColor(t), TAU = Math.PI * 2, top = -Math.PI / 2, SEG = 14;
        const bump = Math.max(0, 1 - (now - (e._kindleBump || 0)) / 140), k = 1 + 0.12 * bump, rx = 15 * k, ry = 6 * k;
        c.setPosition(p.x, p.y + 10).setDepth((e.sprite?.depth ?? 1.06) - 0.01); c._ring.setScale(k);   // (at its feet, under it)
        // the tongues round the ring, the lit part of it: one more for every fourteenth of the bar
        const licks = (list, n, oy, tint, sc) => {
            for (let i = 0; i < Math.max(n, list.length); i++) {
                let l = list[i];
                if (!l && i < n) { l = list[i] = this.add.sprite(0, 0, 'fx_fire_w', 'lick_0').setOrigin(0.5, 1).setBlendMode(Phaser.BlendModes.ADD).play({ key: 'fw_lick', startFrame: (i * 3) % 6 }); c.addAt(l, 1 + c.list.indexOf(oy ? c._ring2 : c._ring)); }
                if (!l) continue;
                const a = top + (i + 0.5) / SEG * TAU;
                l.setVisible(i < n).setPosition(Math.cos(a) * rx, Math.sin(a) * ry + oy + 1).setScale(sc * (0.9 + 0.2 * Math.sin(now * 0.02 + i * 1.7))).setTint(0xfff4d8, 0xfff4d8, tint, tint);
            }
        };
        licks(c._licks, Math.max(1, Math.round(SEG * t)), 0, col, 1 + 0.25 * t);
        if (Math.random() < 0.04 + 0.25 * t) {   // it smokes, more as it fills, and spits sparks once it's past halfway
            const sm = this.add.image(p.x + (Math.random() - 0.5) * 14, p.y - 4, 'fx_fire_w', Math.random() < 0.5 ? 'jet_4' : 'jot_4').setScale(1 + t).setAlpha(0.4).setDepth(4.3);
            this.tweens.add({ targets: sm, y: sm.y - 22 - 14 * t, x: sm.x + (Math.random() - 0.5) * 8, scale: sm.scale * 1.8, alpha: 0, duration: 800, onComplete: () => sm.destroy() });
            if (t > 0.5) { const a = -Math.PI / 2 + (Math.random() - 0.5) * 2.4, v = 40 + Math.random() * 30; WeaponSystem.ember(this, p.x, p.y - 4, Math.cos(a) * v, Math.sin(a) * v, 320, t >= 1); }
        }
        if (t > 0.25 && e.sprite?.active && e.sprite.setTint && !e._iceCube && !e.isFrozen) e.sprite.setTint(MenuArt.mix(e.sprite._cfxTint?.base ?? 0xffffff, col, Math.min(0.55, t * 0.6)));   // it glows hotter as it fills, from its own colour (from white, a Rooter or a sniper lost theirs)
        const full = (e._kindleHits || 0) >= C.MAX_HITS, idle = now - (e._kindleFedAt || now);
        // the arc: overkindled, the window running out; otherwise the time before it starts cooling (gone while it cools)
        const fuse = full ? Math.max(0, ((e._kindleUntil || now) - now) / C.OVER_MS) : Math.max(0, 1 - idle / C.COOL_DELAY);
        c._fuse.clear().lineStyle(1, 0xffe8b0, 0.7).beginPath().arc(0, 0, rx + 4, top, top + fuse * TAU, false).strokePath();
        // overkindled: the crown of blue flame over it, the ring throbbing, and the second ring stacked on the first, its
        // stored part burning white-hot over blue
        c._crown.setVisible(t >= 1).setScale(1 + 0.08 * Math.sin(now * 0.03));
        c._ring.setAlpha(t >= 1 ? 0.75 + 0.25 * Math.sin(now * 0.03) : 0.9);
        const st = (e._kindleStore || 0) / Math.round(C.MAX_HITS * C.STORE_MAX);
        c._ring2.setVisible(t >= 1).setScale(k);
        licks(c._licks2, t >= 1 ? Math.round(SEG * st) : 0, -6, 0x4a9aff, 0.9);
    }

    // R key. The spender: attack speed goes supersonic so you can actually reach MAX_HITS
    // inside one fuse, which roughly doubles the payout.
    // R key. Guarantees the burst roll for its duration rather than introducing a second
    // mechanic: the six pellets are the same six you get from the 5% passive. Because a
    // full bar detonates on its own, the extra pellets convert into reaching the cap
    // sooner -- more detonations per second, not one larger one.
    // A 16-second cooldown whose ONLY feedback was a status text telling you how many seconds
    // were left -- and only if you pressed R and were refused. You had to fail to find out.
    //
    // Three states, so the bar answers "can I press R" at a glance without a number:
    //   RECHARGING  fills left to right, dim, no pulse
    //   READY       full, bright, pulsing -- the only state that pulses, so it reads as a
    //               prompt rather than decoration
    //   ACTIVE      drains fast across IGNITE_DUR, brightest, so the 3.5s window is visible
    //               while you are spending it
    //
    // Drawn every frame rather than tweened: the fill is a function of two timestamps, so a
    // tween would be a second source of truth that could disagree with them.
    _updateKindleIgniteBar() {
        // Requires fire to be the ACTIVE element, not merely the one Kindling Brand is slotted
        // into. The first version checked equippedWeapons.fire alone, which is true the whole
        // time the weapon is owned -- so the bar sat over the player while you were playing ice
        // or lightning, advertising a cooldown for an ability you could not press. Exactly the
        // slotted-versus-wielding distinction the Field Kit's scrap gate turns on, got backwards
        // here because for the Field Kit "slotted" was the right answer and for a UI prompt it
        // is not.
        const wielding = this.currentElement === 'fire'
            && (this.equippedWeapons?.fire || 'flame_fists') === 'ignition';
        if (!wielding || !this.player) { this._destroyKindleIgniteBar(); return; }

        const C = this._kindlingCfg();
        const now = this.time.now;
        const activeUntil = this._kindleIgniteUntil || 0;
        const readyAt     = this._kindleIgniteReady || 0;

        let frac, state;
        if (now < activeUntil) {
            // Spending it: drain across the duration.
            frac = (activeUntil - now) / C.IGNITE_DUR;
            state = 'active';
        } else if (now < readyAt) {
            // Recharging: fill across whatever remains of the cooldown AFTER the active window,
            // so the bar starts empty the instant ignition ends rather than jumping.
            const fillStart = readyAt - (C.IGNITE_COOL - C.IGNITE_DUR);
            frac = Math.max(0, Math.min(1, (now - fillStart) / (C.IGNITE_COOL - C.IGNITE_DUR)));
            state = 'recharging';
        } else {
            frac = 1;
            state = 'ready';
        }
        if (state === 'ready' && this._kindleState && this._kindleState !== 'ready') Sfx.play(this, 'rready', { el: 'fire' });   // Blue Flame back
        this._kindleState = state;

        if (!this._kindleBar?.bg?.active) {   // the scene object outlives a floor change; its old graphics do not
            this._kindleBar = {
                bg:  this.add.graphics().setDepth(6),
                fill: this.add.graphics().setDepth(6.1),
                glow: this.add.graphics().setDepth(6.05)
            };
        }
        const B = this._kindleBar;
        // ABOVE the player. Below it read as a different KIND of object -- a shadow or a
        // selection marker -- because every other status bar in the game sits overhead.
        //
        // 24, not the 42 the Singularity Staff's orb bar uses. Matching that offset looked right
        // on paper and floated in practice: the orb bar carries an "R ORB READY" label above it,
        // so 42 is the height of a bar PLUS its caption. A bare bar needs to sit where the
        // caption would have been.
        // One bar for both (2026-10-20): the fuel across it, Blue Flame's charge as a pip at its right end.
        const W = 34, H = 5, fuel = Math.max(0, Math.min(1, this._fuel ?? 1)), dry = now < (this._fuelDryUntil || 0), blue = state === 'active';
        const bx = this.player.x - (W + 7) / 2, by = this.player.y - 16;
        B.bg.clear(); B.fill.clear(); B.glow.clear();
        // fuel: orange, blinking red when low, grey while it's run dry, blue while Blue Flame refills it
        const low = fuel < 0.25 && !blue, blink = low ? 0.55 + 0.45 * Math.sin(now / 70) : 1;
        const body = dry ? 0x5a4a44 : blue ? 0x7fd4ff : low ? 0xff3a2a : 0xff7a22, hot = dry ? 0x8a7a70 : blue ? 0xffffff : 0xffc070;
        B.fill.setAlpha(blink);
        UIKit.rBar(B.fill, bx + 6, by, W, fuel, { col: body, hot, dark: 0x1a0a04, time: now, h: H, ready: false, gem: false });
        // the gem: Blue Flame's charge, pulsing when R is ready, draining while it burns
        UIKit.rGem(B.bg, bx - 2, by + H / 2, frac, { col: state === 'recharging' ? 0x2a5a8a : 0x7fd4ff, hot: 0xffffff, dark: 0x1a0a04, time: now, ready: state === 'ready' });
    }

    // Ignition's fuel (FUEL_MS of flame on a full tank, REFUEL_MS to fill it out): it drains while lit and refills while out.
    // Running dry puts the flame out with a sputter and it can't relight for DRY_MS; putting it out yourself costs nothing.
    // Blue Flame burns free and refills the tank as it runs. Per frame, from GameScene.update.
    _jetFuelTick(delta) {
        const C = this._kindlingCfg(), now = this.time.now, dt = Math.min(100, delta || 16);
        const blue = (this._kindleIgniteUntil || 0) > now, burning = this._jetLit && this._jetHeld?.();
        if (blue || !burning) { this._fuel = Math.min(1, (this._fuel ?? 1) + dt / C.REFUEL_MS); return; }
        this._fuel = (this._fuel ?? 1) - dt / C.FUEL_MS;
        if (this._fuel > 0) return;
        this._fuel = 0; this._jetLit = false; this._fuelDryUntil = now + C.DRY_MS;
        const tip = typeof CreatureFX !== 'undefined' ? CreatureFX.gearTip?.(this) : null, x = tip?.x ?? this.player.x, y = tip?.y ?? this.player.y - 6;
        WeaponSystem.fireArt(this);
        for (let k = 0; k < 6; k++) {   // a puff of smoke off the nozzle
            const sm = this.add.image(x, y, 'fx_fire_w', k % 2 ? 'jet_4' : 'jot_4').setScale(0.8 + Math.random() * 0.4).setAlpha(0.7).setDepth(4.3);
            this.tweens.add({ targets: sm, x: x + (Math.random() - 0.5) * 16, y: y - 8 - Math.random() * 14, scale: 2, alpha: 0, duration: 600 + k * 60, onComplete: () => sm.destroy() });
        }
        Sfx.play(this, 'click');
        this.showStatusText(this.player.x, this.player.y - 34, 'OUT OF FUEL', '#ff8a5a');
    }

    _destroyKindleIgniteBar() {
        if (!this._kindleBar) return;
        for (const g of Object.values(this._kindleBar)) { if (g?.active) g.destroy(); }
        this._kindleBar = null;
    }

    kindlingIgnitionMode() {
        const C = this._kindlingCfg();
        const now = this.time.now;
        if (now < (this._kindleIgniteReady || 0)) {
            // Kept, but it is no longer the only feedback -- the bar under the player shows this
            // continuously, so the player does not have to fail a press to learn the timing.
            const left = Math.ceil(((this._kindleIgniteReady || 0) - now) / 1000);
            this.showStatusText(this.player.x, this.player.y - 28, `BLUE FLAME ${left}s`, '#6a8acc');
            return;
        }
        this._kindleIgniteUntil = now + C.IGNITE_DUR;
        this._kindleIgniteReady = now + C.IGNITE_COOL;
        this.cameras.main.shake(140, 0.005);
        this._kindleIgniteFx(C.IGNITE_DUR);
    }

    // Ignition mode on you: the word slams in over you in the title face, a ring of fire bursts out, and while it lasts a
    // heat haze shimmers round you, flames lick up off you and the gun's barrel glows white-hot.
    _kindleIgniteFx(ms) {
        const p = this.player; if (!p?.active) return;
        const ADD = Phaser.BlendModes.ADD, t0 = this.time.now;
        const word = this.add.text(p.x, p.y - 40, 'BLUE FLAME', { fontSize: '22px', fontFamily: UIKit.FONT.title, fontStyle: 'bold italic', color: '#eaf6ff', stroke: '#2a5ac8', strokeThickness: 5 }).setOrigin(0.5).setDepth(10).setScale(1.8).setAlpha(0);
        this._vfxSort?.(word);
        this.tweens.add({ targets: word, scale: 1, alpha: 1, duration: 160, ease: 'Back.easeOut', onComplete: () => this.tweens.add({ targets: word, y: word.y - 16, alpha: 0, delay: 500, duration: 400, onComplete: () => word.destroy() }) });
        WeaponSystem.fireRing(this, p.x, p.y + 10, 14, 62, 380, 5, true, 0.42);   // a ring of blue flame bursting out over the floor
        const haze = this.textures.exists('vfx_glow') ? this.add.image(p.x, p.y, 'vfx_glow').setTint(0x3a6aff).setBlendMode(ADD).setDepth(p.depth - 0.02).setScale(0.55).setAlpha(0) : null;
        const barrel = this.add.image(p.x, p.y, 'vfx_glow').setTint(0x8ac8ff).setBlendMode(ADD).setScale(0.12).setVisible(false);
        const F = WeaponSystem.flames(this);
        const tick = () => {
            const now = this.time.now, left = ms - (now - t0);
            if (left <= 0 || !p.active) { this.events.off('update', tick); haze?.destroy(); barrel.destroy(); return; }
            const fade = Math.min(1, (now - t0) / 150, left / 300);
            haze?.setPosition(p.x, p.y + 4).setAlpha(0.3 * fade * (0.8 + 0.2 * Math.sin(now * 0.03))).setScale(0.5 + 0.05 * Math.sin(now * 0.02));
            if (Math.random() < 0.7 * fade) F.bsmall.emitParticleAt(p.x + (Math.random() - 0.5) * 24, p.y + 12, 1);   // blue flames licking up off you
            if (Math.random() < 0.2 * fade) F.bflame.emitParticleAt(p.x + (Math.random() - 0.5) * 18, p.y + 10, 1);
            const tip = typeof CreatureFX !== 'undefined' ? CreatureFX.gearTip?.(this) : null;   // the barrel, white-hot
            barrel.setVisible(!!tip).setDepth(p.depth + 0.03).setAlpha(0.7 * fade * (0.8 + 0.2 * Math.sin(now * 0.05)));
            if (tip) barrel.setPosition(tip.x, tip.y);
            if (Math.random() < 0.12 * fade) WeaponSystem.ember(this, p.x + (Math.random() - 0.5) * 22, p.y + 8, (Math.random() - 0.5) * 20, -40 - Math.random() * 30, 520, true);
        };
        this.events.on('update', tick); this.events.once('shutdown', () => this.events.off('update', tick));
        Sfx.play(this, 'ult');
    }

}
