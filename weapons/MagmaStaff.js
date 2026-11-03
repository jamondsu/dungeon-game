// ═══════════════════════════════════════════════════════════════════════════
// MagmaStaff.js — the Magma Staff (fire): its shots, its heat, and Magma Surge (the ripple).
// Its fireballs fly in WeaponSystem.updateFireballs, with everything else's.
// GameScene borrows each method through a one-line proxy, so `this` in them is the scene.
// ═══════════════════════════════════════════════════════════════════════════

class MagmaStaff {

    static MAGMA_VARIANTS = 4;
    static SURGE_MIN_HEAT = 18;   // Magma Surge needs at least this much heat (the staff's tier 2)

    magmaStaffAttack(targetX, targetY) {
        const currentTime = this.time.now;

        // Tier now comes from the staff's own heat, not from whatever enemy on the map
        // happens to be burning hardest. See _magmaCfg / _addMagmaHeat above.
        const C = this._magmaCfg();
        const tier = this._magmaTier();
        const fireballCount = C.FIREBALLS[tier - 1] + WeaponLevels.perk('magma_staff', 'volley');
        const cooldown = C.COOLDOWN[tier - 1];
        if (currentTime - (this.lastMagmaStaffTime || 0) < cooldown) return;
        this.lastMagmaStaffTime = currentTime;
        this._gearFiredAt = currentTime;   // the held weapon swings now (Creatures.gear)

        const worldX   = targetX + this.cameras.main.scrollX;
        const worldY   = targetY + this.cameras.main.scrollY;
        const playerPx = this._shotX();   // where the slime is drawn (mid-dash it's still on its way)
        const playerPy = this._shotY();
        const dx = worldX - playerPx, dy = worldY - playerPy;
        const dist = Math.sqrt(dx * dx + dy * dy) || 1;
        const baseAngle = Math.atan2(dy, dx);

        // 9.0, up from 4.5. The old value was explicitly lowered "to balance the max-tier
        // 3-per-shot shotgun" -- i.e. the five weak tiers were nerfed to pay for the one
        // strong one, which is why tier 1 sat at 15% of the FREE weapon's dps. The pellets
        // no longer multiply (see below), so the low end no longer has to fund the top.
        const baseDmg = C.BASE_DMG * this.damageScaling;

        // the burst of fire it goes off with, a little out from you toward your aim
        WeaponSystem.fireMuzzle(this, playerPx + Math.cos(baseAngle) * 10, playerPy + Math.sin(baseAngle) * 10);

        // Fire fireballs sequentially with slight random spread.
        // At max tier (6 shots), each shot becomes a tight 3-pellet shotgun burst
        // instead of a single fireball — 6 shots × 3 pellets = 18 total fireballs.
        const SPEED = 210;
        const SHOT_INTERVAL = 90;
        const leavesTrail = tier >= C.TRAIL_TIER;
        // One projectile per shot, always. See the note on BASE_DMG above for why the fan
        // was removed and why the dps curve is unaffected by removing it.
        const PELLETS_PER_SHOT = 1;
        const PELLET_SPREAD = 0;
        const pelletDmg = baseDmg;

        const castId = Math.random().toString(36).slice(2);
        for (let i = 0; i < fireballCount; i++) {
            this.time.delayedCall(i * SHOT_INTERVAL, () => {
                if (this._deathScreenActive) return;
                const spread = 0.12 - (fireballCount - 1) * 0.01;
                const shotAngle = baseAngle + (Math.random() - 0.5) * spread * 2 * Enchants.spread('magma_staff');   // True Aim narrows it

                for (let p = 0; p < PELLETS_PER_SHOT; p++) {
                    // Pellets fan evenly around shotAngle; single-pellet shots are unchanged
                    const pelletOffset = PELLETS_PER_SHOT === 1 ? 0
                        : (p / (PELLETS_PER_SHOT - 1) - 0.5) * PELLET_SPREAD * 2;
                    const angle = shotAngle + pelletOffset;
                    const vx = Math.cos(angle) * SPEED;
                    const vy = Math.sin(angle) * SPEED;

                    const container = this.add.container(playerPx, playerPy).setDepth(2);   // (its rock goes in it as it flies)

                    this.fireballs.push({
                        sprite:        container,
                        fireGraphics:  null,
                        vx, vy,
                        damage:        pelletDmg,
                        dirX:          Math.cos(angle),
                        dirY:          Math.sin(angle),
                        startX:        playerPx, startY: playerPy,
                        splitCount:    0,
                        piercedEnemies: new Set(),
                        createdAt:     this.time.now,
                        lastFlameTime: this.time.now,
                        isStaffBall:   true,
                        volleyId:      castId,   // one cast's fireballs fall off on one target (_volleyMult)
                        // Whether this shot was fired at or above FOCUS_TIER. Captured at
                        // fire time so a shot in flight keeps the tier it was launched at
                        // rather than reading whatever heat happens to be current on hit.
                        _focus:        tier >= C.FOCUS_TIER,
                        leavesTrail,
                        _burnApplied:  new Set(),
                    });
                }
            });
        }

        this.cameras.main.shake(30 + fireballCount * 5, 0.002);
    }

    // The staff's ramp used to be read off the ENEMIES: _recalcMagmaFireballCount
    // scanned every enemy on the map for the highest burn stack and used that as the
    // tier. Three things fell out of that, all bad. You could build stacks on a trash
    // mob and then open on a fresh boss at full power, so the ramp was cosmetic. The
    // instant the burning enemy died the tier dropped to 1, meaning the weapon was at
    // its weakest immediately after a kill. And in a crowd where your own lava kept
    // something burning, it sat at max tier permanently without being earned.
    //
    // Heat belongs to the WEAPON instead. It builds when your fireballs land and bleeds
    // off when they stop, so the reward for committing to a target is yours and does not
    // evaporate because the target died. Burn still feeds it -- a burning target heats
    // the staff faster -- but burn is the accelerant now, not the fuel gauge.
    // Returned from a method, not held as class fields: every method in this file is
    // invoked as WeaponSystem.prototype.x.call(scene), so `this` is the SCENE. A class
    // field would be defined on a WeaponSystem instance that is never constructed.
    _magmaCfg() {
        return {
            HEAT_MAX:   100,
            TIER_AT:    [0, 18, 36, 54, 72, 90],   // heat floor for tiers 1..6
            FIREBALLS:  [2, 2, 3, 3, 4, 5],
            // SHRINKS as you ramp. It used to GROW (1200 + 120 per tier), which partly
            // cancelled the damage gain and is why the middle of the curve felt flat.
            COOLDOWN:   [1200, 1140, 1080, 1020, 980, 940],
            // No pellet fan. It was introduced to kill the damage cliff, and it did --
            // but a 3-pellet 18-degree spread also let one cast hit several enemies, so
            // the staff turned into a crowd-clearer at exactly the tier it is meant to be
            // at its most focused. Because the pellets SPLIT the payload rather than
            // multiplying it, deleting them costs nothing on the curve: single-target dps
            // at every tier is identical, only the incidental multi-target reach is gone.
            BASE_DMG:   12.0,    // per fireball (9 until volleys fell off on one target, 2026-10-18)
            // What replaces the fan as the high-tier reward, and it points the other way:
            // bonus damage against a target that is ALREADY burning. Crowds do not benefit
            // -- a fresh enemy gives +0% -- but the one thing you have been working on
            // takes up to +30%. The reward for ramping now lands on commitment.
            FOCUS_TIER: 4,       // tier at which the bonus switches on
            FOCUS_PER_STACK: 0.06,
            TRAIL_TIER: 5,
            DECAY:      25 * (WeaponLevels.perk('magma_staff', 'burn') ? 0.6 : 1),   // heat per second once idle (Slow Burn: 40% slower)
            GRACE:      1200,    // ms after the last hit before decay starts
        };
    }

    _magmaTier() {
        const h = this._magmaHeat || 0;
        const T = this._magmaCfg().TIER_AT;
        for (let i = 5; i >= 0; i--) if (h >= T[i]) return i + 1;
        return 1;
    }

    // Called by the staff's fireballs when they connect. Burn stacks on the victim
    // accelerate the climb, which is what keeps the weapon reading as fire rather than
    // as a generic charge meter.
    _addMagmaHeat(enemy) {
        const C = this._magmaCfg();
        const stacks = Math.min(enemy?.burnStacks || 0, 5);
        this._magmaHeat = Math.min(C.HEAT_MAX, (this._magmaHeat || 0) + 8 + 1.5 * stacks);
        this._magmaLastHit = this.time.now;
    }

    // Per-frame bleed. Grace period first so the gap between casts does not cost you
    // tier -- only actually stopping does.
    _updateMagmaHeat(time) {
        // _magmaHeatPrev advances EVERY frame, not only while decaying. Stamping it
        // inside the decay branch means the first frame after the grace period measures
        // dt from whenever decay last ran -- potentially seconds -- and dumps the entire
        // bar in one step instead of bleeding it.
        const prev = this._magmaHeatPrev ?? time;
        this._magmaHeatPrev = time;
        if (!this._magmaHeat) return;
        const C = this._magmaCfg();
        if (time - (this._magmaLastHit || 0) < C.GRACE) return;
        const dt = Math.min(0.25, (time - prev) / 1000);
        this._magmaHeat = Math.max(0, this._magmaHeat - C.DECAY * dt);
    }

    _recalcMagmaFireballCount() {
        let max = 0;
        for (const e of this.enemies) {
            if (e.sprite?.active) max = Math.max(max, e.burnStacks || 0);
        }
        // Also check bosses
        if (this.voltslimeBoss?.active) max = Math.max(max, this.voltslimeBoss.burnStacks || 0);
        if (this.voidSovereignBoss?.active) max = Math.max(max, this.voidSovereignBoss.burnStacks || 0);
        this._magmaStaffFireballCount = max > 0 ? max : undefined;
    }

    // Magma Surge (R): dumps the staff's stored heat. Everything round you is thrown back and
    // set burning, and a wave of lava rolls outward. More heat, a bigger surge: radius 2-5,
    // knockback 1-3 tiles, 1-3 burn stacks, lava that lasts longer. The heat goes to 0, so the
    // staff drops back to its first tier: spending it is the trade.
    magmaStaffRipple() {
        if (this._magmaRippleReady !== true) return;
        const f = Math.min(1, (this._magmaHeat || 0) / this._magmaCfg().HEAT_MAX);
        this._magmaHeat = 0;
        this._magmaRippleReady = false;
        Sfx.play(this, 'magma_surge', { f });
        this._magmaSurgeCdUntil = this.time.now + 1000;
        this._updateMagmaRippleBar();

        const playerPx = this.playerX * this.TILE_SIZE + this.TILE_SIZE / 2;
        const playerPy = this.playerY * this.TILE_SIZE + this.TILE_SIZE / 2;
        const RADIUS    = 2 + Math.round(3 * f);  // tiles
        const KNOCKBACK = 1 + Math.round(2 * f);  // tiles
        const STACKS    = 1 + Math.round(2 * f);
        const RING_INTERVAL = 80;  // ms between each ring wave
        const RING_LIFE     = Math.round(700 + 1500 * f); // ms each lava ring tile stays

        // ── Wave ring — one ring at a time, each briefly lit then gone ──
        for (let r = 1; r <= RADIUS; r++) {
            this.time.delayedCall(r * RING_INTERVAL, () => {
                if (this._deathScreenActive) return;
                // Spawn this ring's lava tiles
                const ringTiles = [];
                for (let dx = -r; dx <= r; dx++) {
                    for (let dy = -r; dy <= r; dy++) {
                        const dist = Math.sqrt(dx * dx + dy * dy);
                        if (dist < r - 0.6 || dist > r + 0.6) continue;
                        const tx = this.playerX + dx;
                        const ty = this.playerY + dy;
                        if (tx < 0 || tx >= this.WORLD_WIDTH || ty < 0 || ty >= this.WORLD_HEIGHT) continue;
                        if (this.world[tx][ty] !== this.FLOOR) continue;
                        ringTiles.push(this.spawnIgnitionTrail(
                            tx * this.TILE_SIZE + this.TILE_SIZE / 2,
                            ty * this.TILE_SIZE + this.TILE_SIZE / 2,
                            RING_LIFE
                        ));
                    }
                }
            });
        }

        // the surge: a burst of fire off you, a ring of flame racing out over the lava as it rises, embers thrown on out
        const T = this.TILE_SIZE;
        WeaponSystem.fireMuzzle(this, playerPx, playerPy - 4, 2.2);
        WeaponSystem.fireRing(this, playerPx, playerPy, T * 0.6, (RADIUS + 0.3) * T, RADIUS * RING_INTERVAL, 5 + RADIUS * 3, false, 0.85);
        for (let i = 0; i < 8 + RADIUS * 3; i++) { const a = Math.random() * Math.PI * 2, v = 90 + Math.random() * 120; WeaponSystem.ember(this, playerPx + Math.cos(a) * 10, playerPy + Math.sin(a) * 8, Math.cos(a) * v, Math.sin(a) * v - 20, 400 + Math.random() * 400); }
        this.cameras.main.shake(120, 0.009);

        // Fling nearby enemies
        for (const enemy of [...this.enemies]) {
            if (this._phasedOut?.(enemy)) continue;
            if (!enemy.sprite?.active) continue;
            const eDist = Math.abs(enemy.x - this.playerX) + Math.abs(enemy.y - this.playerY);
            if (eDist > RADIUS) continue;
            if (enemy.iceImmune || enemy.elementImmune) continue;

            const kbDirX = enemy.x - this.playerX || (Math.random() > 0.5 ? 1 : -1);
            const kbDirY = enemy.y - this.playerY;
            const kbLen  = Math.sqrt(kbDirX * kbDirX + kbDirY * kbDirY) || 1;
            const normX = kbDirX / kbLen, normY = kbDirY / kbLen;

            let landX = enemy.x, landY = enemy.y;
            for (let step = 1; step <= KNOCKBACK; step++) {
                const tx = Math.round(enemy.x + normX * step);
                const ty = Math.round(enemy.y + normY * step);
                if (tx < 0 || tx >= this.WORLD_WIDTH || ty < 0 || ty >= this.WORLD_HEIGHT) break;
                if (this.world[tx][ty] !== this.FLOOR) break;
                if (this.getEnemyAt(tx, ty)) break;
                landX = tx; landY = ty;
            }

            const targetPx = landX * this.TILE_SIZE + this.TILE_SIZE / 2;
            const targetPy = landY * this.TILE_SIZE + this.TILE_SIZE / 2 + this.SLIME_Y_OFFSET;
            const peakY    = Math.min(enemy.sprite.y, targetPy) - 22;

            // Update tile immediately so other enemies don't pathfind to the same tile
            enemy.x = landX; enemy.y = landY;
            // Long stun — covers full arc duration + brief settle time
            enemy.isStunned = true;
            enemy.stunnedUntil = Math.max(enemy.stunnedUntil || 0, this.time.now + 800);
            // Flag to suppress pathfinding target recalculation during arc
            enemy._surgeKnockedBack = true;
            this.time.delayedCall(850, () => { if (enemy.sprite?.active) enemy._surgeKnockedBack = false; });

            // Fling arc: squish up then arc to landing
            this.tweens.killTweensOf(enemy.sprite);
            this.tweens.add({
                targets: enemy.sprite,
                y: peakY,
                scaleX: this.SLIME_SCALE * 0.75, scaleY: this.SLIME_SCALE * 1.35,
                duration: 110, ease: 'Quad.easeOut',
                onComplete: () => {
                    if (!enemy.sprite?.active) return;
                    this.tweens.add({
                        targets: enemy.sprite, x: targetPx, y: targetPy,
                        scaleX: this.SLIME_SCALE * 1.25, scaleY: this.SLIME_SCALE * 0.7,
                        duration: 180, ease: 'Quad.easeIn',
                        onComplete: () => {
                            if (!enemy.sprite?.active) return;
                            this.tweens.add({
                                targets: enemy.sprite,
                                scaleX: this.SLIME_SCALE, scaleY: this.SLIME_SCALE,
                                duration: 100, ease: 'Back.easeOut'
                            });
                            this.updateEnemyHealthBar(enemy);
                        }
                    });
                }
            });

            this.applyBurnStack(enemy, STACKS);   // the Surge: 1-3 stacks, by the heat spent
        }

        this.showStatusText(playerPx, playerPy - 30, 'MAGMA SURGE!', '#ff8800');
    }

    _updateMagmaOrbs(time) {
        const isStaff = this.currentElement === 'fire' &&
            (this.equippedWeapons?.fire || 'flame_fists') === 'magma_staff';
        // Orbiting orbs are the tier readout, so they follow heat like everything else.
        const count = isStaff ? this._magmaTier() : 0;

        // Rebuild orbs if count changed
        if (this._magmaOrbCount !== count) {
            this._magmaOrbCount = count;
            // Destroy existing
            if (this._magmaOrbGraphics) {
                for (const g of this._magmaOrbGraphics) { this.tweens.killTweensOf(g); g.destroy(); }
            }
            this._magmaOrbGraphics = [];
            if (count > 0) {
                for (let i = 0; i < count; i++) {
                    // a pebble of lava rock (the hand-drawn one, its core pulsing), bigger and hotter with the heat
                    WeaponSystem.fireArt(this);
                    const g = this.add.container(0, 0).setDepth(5);
                    const glow = this.add.image(0, 0, 'vfx_glow').setTint(count <= 2 ? 0xff7a1a : count <= 4 ? 0xff4a10 : 0xff2200).setBlendMode(Phaser.BlendModes.ADD).setScale(0.12 + count * 0.02).setAlpha(0.8);
                    const rock = this.add.sprite(0, 0, 'fx_fire_w', 'pebble_0').setScale(1 + count * 0.1).play({ key: 'fw_pebble', startFrame: i % 4 });
                    g.add([glow, rock]);
                    this._magmaOrbGraphics.push(g);
                }
            }
        }

        if (!this._magmaOrbGraphics?.length) return;

        const px = this.player.x, py = this.player.y;
        const ORBIT_R   = 18 + this._magmaOrbCount * 2; // orbit radius grows with count
        const SPEED     = 0.0025 + this._magmaOrbCount * 0.0004; // spins faster at higher stacks
        const baseAngle = time * SPEED;

        for (let i = 0; i < this._magmaOrbGraphics.length; i++) {
            const g = this._magmaOrbGraphics[i];
            if (!g?.active) continue;
            const angle = baseAngle + (i / this._magmaOrbCount) * Math.PI * 2;
            g.x = px + Math.cos(angle) * ORBIT_R;
            g.y = py + Math.sin(angle) * ORBIT_R;
            // Pulse alpha with a slight phase offset per orb
            g.alpha = 0.7 + Math.sin(time * 0.006 + i * 1.2) * 0.3;
        }
    }

    _updateMagmaRippleBar() {
        const isStaff = this.currentElement === 'fire' &&
            (this.equippedWeapons?.fire || 'flame_fists') === 'magma_staff';
        if (!isStaff) {
            if (this._magmaRippleBarBg)    { this._magmaRippleBarBg.destroy();    this._magmaRippleBarBg    = null; }
            if (this._magmaRippleBarFill)  { this._magmaRippleBarFill.destroy();  this._magmaRippleBarFill  = null; }
            if (this._magmaRippleLabel)    { this._magmaRippleLabel.destroy();    this._magmaRippleLabel    = null; }
            return;
        }
        const px = this.player.x, py = this.player.y - 18;
        const BAR_W = 40, BAR_H = 4;
        const pct   = Math.min((this._magmaHeat || 0) / this._magmaCfg().HEAT_MAX, 1);   // the heat the Surge would dump
        const ready = this._magmaRippleReady === true;
        if (ready && this._surgeSaid === false) Sfx.play(this, 'rready', { el: 'fire' });   // Surge has come ready
        this._surgeSaid = ready;

        if (!this._magmaRippleBarBg?.active) {   // (dead after a floor change)
            this._magmaRippleBarBg   = this.add.graphics().setDepth(5.6);
            this._magmaRippleLabel   = this.add.text(px, py + 7, `SURGE [${Settings.label(Settings.key('surge'))}]`, {
                fontSize: '8px', fontFamily: UIKit.FONT.title, fontStyle: 'bold', color: '#ff8844',
                stroke: '#1a0806', strokeThickness: 3, resolution: 2
            }).setOrigin(0.5, 0).setDepth(5.7);
        }
        UIKit.rBar(this._magmaRippleBarBg.clear(), px - BAR_W / 2 + 4, py - 3, BAR_W, pct, { col: 0xff5a14, hot: 0xffc060, dark: 0x1a0806, time: this.time.now, ready });
        this._magmaRippleLabel.x   = px; this._magmaRippleLabel.y   = py + 7;
        this._magmaRippleLabel.setColor(ready ? '#ffcc44' : '#ff8844');
    }

}
