// ═══════════════════════════════════════════════════════════════════════════
// OrbEmitter.js — the Orb Emitter (lightning): a bouncing electric orb that marks what it hits and forks lightning off it.
// GameScene borrows each method through a one-line proxy, so `this` in them is the scene.
// ═══════════════════════════════════════════════════════════════════════════

class OrbEmitter {

    orbEmitterAttack(targetX, targetY) {
        const currentTime = this.time.now;
        if (currentTime - (this._lastOrbTime || 0) < 700) return;
        this._lastOrbTime = currentTime;
        this._gearFiredAt = currentTime;   // the held weapon swings now (Creatures.gear)

        const worldX = targetX + this.cameras.main.scrollX;
        const worldY = targetY + this.cameras.main.scrollY;
        const px = this.player.x, py = this.player.y;
        const dx = worldX - px, dy = worldY - py;
        const len = Math.sqrt(dx*dx + dy*dy) || 1;

        const ORB_SPEED = 300; // px/s
        const ORB_DMG   = 10 * this.damageScaling;
        const FORK_RANGE = 3 + 0.5 * WeaponLevels.perk('orb_emitter', 'forks'); // tiles
        const MAX_BOUNCES = 10;

        // The orb: the hand-drawn tesla globe (fx_storm orb_0-3, its cage turning) in a glow; its arcs are laid each frame
        const gfx = this.add.container(px, py).setDepth(4);
        if (!this.anims.exists('storm_orb')) this.anims.create({ key: 'storm_orb', frames: [0, 1, 2, 3].map(i => ({ key: 'fx_storm', frame: 'orb_' + i })), frameRate: 14, repeat: -1 });
        const glow = this.add.image(0, 0, 'vfx_glow').setTint(0xffd84a).setBlendMode(Phaser.BlendModes.ADD).setScale(0.3).setAlpha(0.55);
        const body = this.add.sprite(0, 0, 'fx_storm', 'orb_0').setScale(1.5).play('storm_orb');
        gfx.add([glow, body]);
        gfx._glow = glow; gfx._body = body;
        // muzzle: a strike flaring at the slime, sparks
        WeaponSystem.zapFlare(this, px + dx / len * 10, py + dy / len * 10, 'y', 1.2, 4.1);
        WeaponSystem.zapSparks(this, 'y').emitParticleAt(px + dx / len * 10, py + dy / len * 10, 3);

        if (!this.lightningOrbs) this.lightningOrbs = [];
        this.lightningOrbs.push({
            gfx,
            vx: (dx/len) * ORB_SPEED,
            vy: (dy/len) * ORB_SPEED,
            damage: ORB_DMG,
            bouncesLeft: MAX_BOUNCES,
            forkRange: FORK_RANGE,
            hitEnemies: new Set(), // enemies already hit this flight
            _createdAt: currentTime,
        });
        this.cameras.main.shake(15, 0.001);
    }

    // The tesla orb in flight: arcs reaching for what's close (blue, thin, re-laid every frame so they writhe) and
    // crackling off its cage
    _drawOrbEmitterGfx(gfx) {
        const TS = this.TILE_SIZE, now = this.time.now, x = gfx.x, y = gfx.y;
        gfx._glow.setScale(0.28 + 0.04 * Math.sin(now * 0.04) + Math.random() * 0.03);
        let n = 0;
        for (const e of this.enemies || []) {
            if (this._phasedOut?.(e)) continue;
            if (n >= 3 || !e.sprite?.active) continue;
            const ex = e.sprite.x - x, ey = e.sprite.y - y;
            if (ex * ex + ey * ey > (TS * 2.6) ** 2 || Math.random() < 0.35) continue;
            WeaponSystem.bolt(this, x, y, e.sprite.x, e.sprite.y, 'c', { thin: true, br: 0, a: 0.85, d: 3.95, glow: false });
            n++;
        }
        for (let i = 0; i < 2; i++) {
            if (Math.random() < 0.4) continue;
            const a = Math.random() * Math.PI * 2, r1 = 15 + Math.random() * 8;
            WeaponSystem.bolt(this, x + Math.cos(a) * 10, y + Math.sin(a) * 10, x + Math.cos(a + 0.6) * r1, y + Math.sin(a + 0.6) * r1, 'y', { thin: true, br: 0, d: 4.05, glow: false });
        }
    }

    // A Queen or a boss struck: its damage, the charge, the forks out to what's round it, then on to the next
    // bounce, as with any enemy (it used to take the hit and the orb just went out)
    _orbHitBig(orb, big, tx, ty, hit) {
        const T = this.TILE_SIZE, px = tx * T + T / 2, py = ty * T + T / 2, from = { x: tx, y: ty, sprite: { x: px, y: py } };
        const hitDamage = orb.damage * (orb._struck ? 1 : 1.8);
        orb._struck = true; orb.damage *= 0.75;
        orb.hitEnemies.add(big);
        hit(hitDamage);
        this.gainUltCharge(this.ultChargePerLightningHit, 'lightning');
        Sfx.play(this, 'orbhit');
        const FORK_DMG = hitDamage * 0.38;
        for (const e of this.enemies.filter(e => !this._phasedOut?.(e) && e.sprite?.active && e.health > 0 && Math.hypot(e.x - tx, e.y - ty) <= orb.forkRange)) {
            OrbEmitter.orbFork(this, px, py, e);
            this.damageEnemy(e, FORK_DMG, 'lightning');
            if (this._dmgLanded && e.health > 0) this._superconduct(e);
        }
        this._zapBosses(from, FORK_DMG, orb.forkRange, [...orb.hitEnemies]);
        if (orb.bouncesLeft > 0) {
            const t = this._orbBounceTarget(orb, tx, ty);
            if (t) { orb.bounceTarget = t; orb.bouncesLeft--; return; }
        }
        orb._done = true;
    }
    _orbHitEnemy(orb, enemy) {
        const TS = this.TILE_SIZE;
        const ex = enemy.sprite.x, ey = enemy.sprite.y;

        // Damage with falloff per bounce (25% less each hit)
        const FALLOFF = 0.75;
        // the first enemy an orb strikes takes ×FIRST_HIT: alone, a target used to take one weak
        // hit and nothing else (14.5 dps); the forks after it are unchanged
        const FIRST_HIT = 1.8;
        const hitDamage = orb.damage * (orb._struck ? 1 : FIRST_HIT);
        orb._struck = true;
        orb.damage = orb.damage * FALLOFF; // reduce for next bounce

        this._superconduct(enemy);
        // the impact: a strike flaring white-hot in a snap of light, sparks
        Sfx.play(this, 'orbhit');
        const snap = this.add.image(ex, ey, 'vfx_glow').setTint(0xfff3a0).setBlendMode(Phaser.BlendModes.ADD).setDepth(4.2).setScale(0.18);
        this.tweens.add({ targets: snap, scale: 0.3, alpha: 0, duration: 180, onComplete: () => snap.destroy() });
        WeaponSystem.zapFlare(this, ex, ey, 'y', 1.8);
        WeaponSystem.zapSparks(this, 'y').emitParticleAt(ex, ey, 8);

        // Damage. Typed: an orb still flying after you switch element used to hit (and burn, and
        // charge) as the new one. And paid only for a hit that landed.
        this.damageEnemy(enemy, hitDamage, 'lightning');
        if (this._dmgLanded) this.gainUltCharge(this.ultChargePerLightningHit, 'lightning');

        // Fork lightning to ALL nearby enemies regardless of amped (35% of impact damage)
        // CONDUCTION. An orb that pops on a soaked target dumps its charge into the whole
        // connected pool. The fork below is capped at FORK_R tiles; conduction is not, so
        // on wet ground the orb's reach is the shape of the water rather than a radius.
        if (typeof this._energizePool === 'function' && this.isWaterAt?.(enemy.x, enemy.y)) {
            this._energizePool(enemy.x, enemy.y, hitDamage);
        }
        const FORK_R = orb.forkRange;
        const FORK_DMG = hitDamage * 0.38;   // 0.35, then 0.5; 0.38 2026-10-19: a tier 2 out-valued the tier 3s and 4s in a crowd
        const forkCandidates = this.enemies.filter(e =>!this._phasedOut?.(e) && 
            e !== enemy && e.sprite?.active &&
            Math.abs(e.x - enemy.x) + Math.abs(e.y - enemy.y) <= FORK_R
        );
        this._zapBosses(enemy, FORK_DMG, FORK_R, []);   // and Queens and bosses in reach
        for (const forkTarget of forkCandidates) {
            OrbEmitter.orbFork(this, ex, ey, forkTarget);
            this.damageEnemy(forkTarget, FORK_DMG, 'lightning');
            // Forks amp what they hit, so the orb can bounce on into the crowd (the bounce
            // goes only to amped enemies, and only a direct hit used to make one).
            if (this._dmgLanded && forkTarget.health > 0) this._superconduct(forkTarget);
        }
        // Fork to boss too
        this.damageBossAtTile(enemy.x, enemy.y, FORK_DMG, undefined, 'lightning');

        // Bounce — ONLY to amped enemies within range
        if (orb.bouncesLeft > 0) {
            orb.hitEnemies.add(enemy);
            const bounceTarget = this._orbBounceTarget(orb, enemy.x, enemy.y);
            orb.bounceTarget = bounceTarget;   // it steers onto it, and picks again if it dies first (updateLightningOrbs)

            if (bounceTarget) {
                const bb = this.enemies.includes(bounceTarget) ? bounceTarget.sprite : bounceTarget.container;
                const tdx = bb.x - ex;
                const tdy = bb.y - ey;
                const tlen = Math.sqrt(tdx*tdx + tdy*tdy) || 1;
                orb.vx = (tdx/tlen) * 320;
                orb.vy = (tdy/tlen) * 320;
                orb.bouncesLeft--;
                // the way it bounces: a thin bolt flicking out ahead of it
                WeaponSystem.bolt(this, ex, ey, bb.x, bb.y, 'y', { life: 140, thin: true, br: 0, a: 0.8, d: 3.5 });
                return; // keep orb alive, heading to bounce target
            }
        }
        // No valid amped bounce target — destroy
        orb._done = true;
    }

    // An orb's fork on to enemy e from (x, y): a bolt and a flare where it lands
    static orbFork(S, x, y, e) {
        Sfx.play(S, 'zap');
        WeaponSystem.bolt(S, x, y, e.sprite.x, e.sprite.y + 4, 'y', { life: 190, br: 1 });
        WeaponSystem.zapFlare(S, e.sprite.x, e.sprite.y + 4, 'y', 1.1);
    }
    // The next amped enemy for a bounce, nearest first: not one already hit, not one that won't live till it
    // arrives (a sliver of health that's burning, or already at nothing)
    _orbBounceTarget(orb, x, y) {
        const doomed = e => e.health <= 0 || (e.health <= orb.damage * 0.25 && ((e.burnStacks || 0) > 0 || e.isBurning));
        const near = (list, at) => list.map(e => ({ e, d: Math.hypot(at(e)[0] - x, at(e)[1] - y) })).filter(c => c.d <= 6).sort((a, b) => a.d - b.d)[0]?.e || null;
        const T = this.TILE_SIZE;
        return near(this.enemies.filter(e => !this._phasedOut?.(e) && e.sprite?.active && !orb.hitEnemies.has(e) && e.isSuperConducted && !doomed(e)), e => [e.x, e.y])
            || near([...(this.portals || []), this.voltslimeBoss, this.voidSovereignBoss, this.fractureCore].filter(b => b?.active && b.container?.active && !orb.hitEnemies.has(b)),   // a Queen or a boss, when no enemy will do
                    b => [b.tileX ?? b.container.x / T, b.tileY ?? b.container.y / T]);
    }
    updateLightningOrbs(delta) {
        if (!this.lightningOrbs?.length) return;
        const ds = delta / 1000;
        const TS = this.TILE_SIZE;

        for (let i = this.lightningOrbs.length - 1; i >= 0; i--) {
            const orb = this.lightningOrbs[i];
            if (orb._done || !orb.gfx?.active) {
                if (orb.gfx?.active) {
                    // Death burst — snapshot position before destroying, draw at local (0,0)
                    const bx = orb.gfx.x, by = orb.gfx.y;
                    orb.gfx.destroy();
                    // the orb pops: a flash of light, the strike flaring, bolts thrown out every way, sparks
                    const glow = this.add.image(bx, by, 'vfx_glow').setTint(0xffe066).setBlendMode(Phaser.BlendModes.ADD).setDepth(5).setScale(0.3);
                    this.tweens.add({ targets: glow, scale: 0.7, alpha: 0, duration: 260, onComplete: () => glow.destroy() });
                    WeaponSystem.zapFlare(this, bx, by, 'y', 2.2, 5);
                    for (let k = 0; k < 6; k++) {
                        const a = k / 6 * Math.PI * 2 + Math.random() * 0.5, r = 20 + Math.random() * 14;
                        WeaponSystem.bolt(this, bx, by, bx + Math.cos(a) * r, by + Math.sin(a) * r, k & 1 ? 'c' : 'y', { life: 220, thin: k > 2, br: 0, d: 5, glow: k < 2 });
                    }
                    WeaponSystem.zapSparks(this, 'y').emitParticleAt(bx, by, 10);
                    Sfx.play(this, 'zap');
                }
                this.lightningOrbs.splice(i, 1);
                continue;
            }

            // On a bounce: home in on its target; it died on the way, so pick another, or pop if there's none
            if (orb.bounceTarget) {
                let t = orb.bounceTarget;
                const big = o => !this.enemies.includes(o), alive = o => big(o) ? o.active && o.container?.active : o.sprite?.active && o.health > 0;   // (a Queen has a sprite too, inside her container)
                if (!alive(t)) {
                    t = orb.bounceTarget = this._orbBounceTarget(orb, orb.gfx.x / TS - 0.5, orb.gfx.y / TS - 0.5);
                    if (!t) { orb._done = true; continue; }
                }
                const body = big(t) ? t.container : t.sprite;
                const tdx = body.x - orb.gfx.x, tdy = body.y - orb.gfx.y, tl = Math.hypot(tdx, tdy) || 1, sp = Math.hypot(orb.vx, orb.vy) || 320;
                orb.vx = tdx / tl * sp; orb.vy = tdy / tl * sp;
            }
            // Move
            orb.gfx.x += orb.vx * ds;
            orb.gfx.y += orb.vy * ds;

            // Crack shrink — pierces, no effect on projectile flight (Level 4)
            this._checkProjectileCrackShrink(orb.gfx.x, orb.gfx.y);

            // Animate orb (redraw arc lines)
            this._drawOrbEmitterGfx(orb.gfx);

            // (its trail and glow come from Visuals.js, which follows every lightning orb)

            // Wall collision — destroy
            const tx = Math.floor(orb.gfx.x / TS), ty = Math.floor(orb.gfx.y / TS);
            const orbOob = tx < 0 || tx >= this.WORLD_WIDTH || ty < 0 || ty >= this.WORLD_HEIGHT;
            if (orbOob || this.world[tx]?.[ty] === this.WALL || this.world[tx]?.[ty] === this.NOTHING || this.isInLockedRoom(tx, ty)) {
                VisualFX.wallImpact(this, orb.gfx.x, orb.gfx.y, 'lightning', orb.vx, orb.vy);
                orb._done = true;
                continue;
            }

            // Max lifetime 4s
            if (this.time.now - orb._createdAt > 4000) { orb._done = true; continue; }

            // Enemy collision
            for (const enemy of this.enemies) {
                if (this._phasedOut?.(enemy)) continue;
                if (!enemy.sprite?.active || orb.hitEnemies.has(enemy)) continue;
                const edx = orb.gfx.x - enemy.sprite.x, edy = orb.gfx.y - enemy.sprite.y;
                if (Math.sqrt(edx*edx + edy*edy) < TS * 0.75) {
                    this._orbHitEnemy(orb, enemy);
                    break;
                }
            }

            if (orb._done) continue;
            // Portal collision (queen slime): struck like any enemy (forks, bounces on)
            const portalHit = this.getPortalAt(tx, ty) || (this.portals || []).find(q => q.active && q.container?.active && !orb.hitEnemies.has(q) && Math.hypot(orb.gfx.x - q.container.x, orb.gfx.y - q.container.y) < TS * 1.2);   // her tile, or her body (a bounce homes on the body)
            if (portalHit && !orb.hitEnemies.has(portalHit)) {
                this._orbHitBig(orb, portalHit, portalHit.tileX, portalHit.tileY, d => this.damagePortal(portalHit, d));
                continue;
            }

            // Boss collision: the same
            for (const boss of [this.voltslimeBoss, this.voidSovereignBoss, this.fractureCore].filter(Boolean)) {
                if (!boss.active || orb.hitEnemies.has(boss)) continue;
                const bx = boss.container?.x ?? boss.tileX * TS;
                const by = boss.container?.y ?? boss.tileY * TS;
                if (Math.hypot(orb.gfx.x - bx, orb.gfx.y - by) < TS * 2) {
                    const btx = boss.tileX ?? Math.floor(bx / TS), bty = boss.tileY ?? Math.floor(by / TS);
                    this._orbHitBig(orb, boss, btx, bty, d => this.damageBossAtTile(btx, bty, d, undefined, 'lightning'));
                    break;
                }
            }
        }
    }

}
