// ═══════════════════════════════════════════════════════════════════════════
// IcicleCannon.js — the Icicle Cannon (ice): its charge and its accuracy circle. Its shards fly in
// WeaponSystem.updateIceShards.
// GameScene borrows each method through a one-line proxy, so `this` in them is the scene.
// ═══════════════════════════════════════════════════════════════════════════

class IcicleCannon {

    applyIcicleCannonHit(enemy, damage, shatterMult = 0.5, chillWeight = 1) {
        // Icicle cannon — completely independent of ice fists
        if (enemy._sniperInvisible || this._phasedOut(enemy)) return; // invisible snipers immune to chill/freeze/slow
        if (enemy.fireImmune) {
            if (enemy.sprite?.active) this.showStatusText(enemy.sprite.x, enemy.sprite.y - 10, 'IMMUNE', '#ff8844');
            return;
        }
        if (enemy.isFrozen) { this._clearFreezeVisuals(enemy); this._triggerShatterBurst(enemy, shatterMult); return; } // cannon: scaled shatter
        Sfx.play(this, 'hit', { el: 'ice' });

        if (!enemy.iceImmune) {
            const _rd1492 = this.resolveElementalHit(enemy, damage, 'ice');
            if (_rd1492 === null) return;
            enemy.health -= _rd1492;
            this.showDamageNumber(enemy.sprite.x, enemy.sprite.y - 10, _rd1492, '#88eeff');
            this.updateEnemyHealthBar(enemy);
            this.gainUltCharge(this.ultChargePerHit * 0.65); // icicle fires rapidly — reduced per-hit charge
            if (enemy.health <= 0) { this._destroyChillIndicator(enemy); this.killEnemy(enemy); return; }
        }

        // Fractional and range-weighted: a point-blank pellet is worth many ranged ones toward the
        // bar. chillWeight is the cannon's own distance curve; RATE scales it inside applyChill.
        // 0.65 charge because the cannon fires rapidly and would otherwise print ult.
        this.applyChill(enemy, chillWeight, { chargeMult: 0.65 });
    }

    icicleStaffAttack(targetX, targetY) {
        const currentTime = this.time.now;

        // A plain ice shotgun (reworked 2026-10-18; it had a range gimmick nobody used):
        // PELLETS icicles in a fixed cone every COOLDOWN, the same damage wherever you aim,
        // reaching RANGE tiles. Each one chills a little and splashes the tiles beside what it
        // hits. Up close the whole cone lands on one target; into a crowd it spreads. Perks:
        // Spread Shot (more icicles), Tight Choke (a narrower cone that reaches further).
        const C = { COOLDOWN: 760, DMG: 10.5, SPREAD: 0.30, RANGE: 6, SPEED: 620, CHILL: 0.8, SHATTER: 1.4 };   // CHILL 0.8: a point-blank volley gets ~2.4 of the 3-stack bar (was 0.35, ~1, and the target died first)
        const choke = WeaponLevels.perk('icicle_cannon', 'choke');
        // Spread Shot: +1, +2 icicles; at its max it's a double barrel instead, two volleys a shot (the second 140ms on)
        const spreadLv = WeaponLevels.perk('icicle_cannon', 'pellets'), doubleBarrel = spreadLv >= 3;
        const PELLETS         = 5 + Math.min(2, spreadLv);
        const playerPx = this._shotX();   // where the slime is drawn (mid-dash it's still on its way)
        const playerPy = this._shotY();
        const worldX   = targetX + this.cameras.main.scrollX;
        const worldY   = targetY + this.cameras.main.scrollY;
        const cursorDx = worldX - playerPx;
        const cursorDy = worldY - playerPy;
        if (!this._icicleSecond) {
            if (currentTime - (this.lastIcicleStaffTime || 0) < C.COOLDOWN) return;
            this.lastIcicleStaffTime = currentTime;
            if (doubleBarrel) this.time.delayedCall(140, () => {
                if (this.currentElement !== 'ice' || this._deathScreenActive) return;
                this._icicleSecond = true;
                try { this.icicleStaffAttack(targetX, targetY); } finally { this._icicleSecond = false; }
            });
        }
        this._gearFiredAt = currentTime;   // the held weapon swings now (Creatures.gear)
        const inZone = true;                                   // (the visuals below still read it)
        const spreadHalf = C.SPREAD * (1 - 0.2 * choke) * Enchants.spread('icicle_cannon');   // True Aim narrows the cone
        const pelletSpeed = C.SPEED;
        const range = (C.RANGE + 1.5 * choke) * this.TILE_SIZE;
        const shardDmg = C.DMG * this.damageScaling;
        const shatterMultCannon = C.SHATTER;
        const chillWeight = C.CHILL;
        const SPLASH_RADIUS = 30; // px: the 4 tiles beside the target
        const SPLASH_DMG    = shardDmg * 0.35;
        const baseAngle = Math.atan2(cursorDy, cursorDx);
        const volleyId = Math.random().toString(36).slice(2);   // one shot's icicles fall off on one target (_volleyMult)
        const cracked = new Set();   // (one crack of ice off each target a shot: every icicle's own heaped up into a pile of chips)

        // ── Fire PELLETS pellets ───────────────────────────────────────────────
        for (let s = 0; s < PELLETS; s++) {
            const spreadFrac = PELLETS > 1 ? (s / (PELLETS - 1) - 0.5) * 2 : 0;
            const angle = baseAngle + spreadFrac * spreadHalf;
            const vx = Math.cos(angle) * pelletSpeed;
            const vy = Math.sin(angle) * pelletSpeed;

            // the icicle (fat or slim, hand-drawn), drawn the way it flies
            const container = this.add.container(playerPx, playerPy).setDepth(3);
            const lag = (Math.random() - 0.5) * 10;   // (drawn a little ahead or behind where it hits, so a volley isn't one rigid line)
            container.add(WeaponSystem.aim8(this.add.image(Math.cos(angle) * lag, Math.sin(angle) * lag, WeaponSystem.iceArt(this), 'ice_e').setScale(1.1 + Math.random() * 0.3), angle, Math.random() < 0.5 ? 'ice_' : 'isl_'));

            const capturedInZone   = inZone;
            const capturedDmg      = shardDmg;
            const capturedShatterM = shatterMultCannon;
            const capturedPiercing = !inZone;

            this.iceShards.push({
                sprite: container, vx, vy,
                damage: capturedDmg,
                _chillWeight: chillWeight,
                startX: playerPx, startY: playerPy, _range: range, volleyId,
                createdAt: this.time.now,
                isCannonShard: true,
                isPiercing: capturedPiercing,
                _shatterMult: capturedShatterM,
                bounces: 0,
                maxBounces: capturedPiercing ? 2 : 0,
                pierceCount: 0,
                maxPierces: capturedPiercing ? 2 : 0,
                isHealShot: false,
                isHoming: false,
                hitEnemies: new Set(),
                piercedEnemies: new Set(),
                _onHit: (enemy) => {
                    // chillWeight, not s._chillWeight: `s` is this loop's INDEX, so the weighting
                    // read undefined and every pellet chilled (and charged the nova) at full weight
                    this.applyIcicleCannonHit(enemy, capturedDmg * this._volleyMult(enemy, volleyId), capturedShatterM, chillWeight);

                    // ── Accuracy zone splash ─────────────────────────────────
                    if (capturedInZone && enemy.sprite?.active) {
                        const sx = enemy.sprite.x, sy = enemy.sprite.y;
                        if (!cracked.has(enemy)) { cracked.add(enemy); WeaponSystem.iceChips(this, sx, sy - 4, 5, SPLASH_RADIUS * 0.8); }   // a crack of ice off it

                        // Splash damage + 1 chill stack to nearby enemies
                        for (const nearEnemy of [...this.enemies]) {
                            if (this._phasedOut?.(nearEnemy)) continue;
                            // the pellet's own target is at distance 0: it took a second +50% and chill
                            if (nearEnemy === enemy || !nearEnemy.sprite?.active) continue;
                            const sdx = nearEnemy.sprite.x - sx, sdy = nearEnemy.sprite.y - sy;
                            if (sdx*sdx + sdy*sdy > SPLASH_RADIUS*SPLASH_RADIUS) continue;
                            if (nearEnemy.fireImmune || nearEnemy.elementImmune) continue;
                            if (nearEnemy.isFrozen) {
                                this._triggerShatterBurst(nearEnemy, capturedShatterM);
                            } else if (!nearEnemy.iceImmune) {
                                const _rd2587 = this.resolveElementalHit(nearEnemy, SPLASH_DMG, 'ice');
                                if (_rd2587 === null) continue;
                                nearEnemy.health -= _rd2587;
                                this.showDamageNumber(nearEnemy.sprite.x, nearEnemy.sprite.y - 8, Math.round(_rd2587), '#aaeeff');
                                this.updateEnemyHealthBar(nearEnemy);
                                if (nearEnemy.health <= 0) { this.killEnemy(nearEnemy); continue; }
                            }
                            // Splash chill is weighted the same way. Left flat, a ranged spam
                            // would still chill whole GROUPS for free, which is the same exploit
                            // one step removed. Applies to iceImmune enemies as before -- they
                            // cannot be damaged but can still be frozen and shattered.
                            // Was freezeEnemy(10000) -- the cannon's DIRECT hits cubed while its
                            // own splash handed out a ten-second hard stun. Same weapon, two
                            // different mechanics, depending on which enemy you clipped.
                            this.applyChill(nearEnemy, chillWeight * 0.5, { chargeMult: 0.65 });
                        }
                    }

                    // each icicle that lands is one of the 28 that charge the Frost Shield
                    if (!(this._frostShieldUntil > this.time.now)) { this._icicleHitCounter = Math.min(28, (this._icicleHitCounter || 0) + 1); if (enemy.sprite?.active) CombatSystem.essence(this, enemy.sprite.x, enemy.sprite.y - 6, 'fx_fractal', 'shard_1', 0x9fe8ff, 0.8); }   // (not while the shield is up)
                    this._updateIcicleChargeBar();
                }
            });
        }

        // ── the cannon's puff of frost at the muzzle, a cloud of frost and a glint thrown out with the icicles ──
        const mx = playerPx + Math.cos(baseAngle) * 10, my = playerPy + Math.sin(baseAngle) * 10;
        const puff = this.add.sprite(mx, my, 'fx_ice_w', 'imuz_0').setScale(1.5).setAlpha(0.9).setDepth(4).play('iw_muz');
        puff.once('animationcomplete', () => puff.destroy());
        Fractal.frostPuff(this, mx + Math.cos(baseAngle) * 6, my + Math.sin(baseAngle) * 6, 4, 0.8);
        Fractal.frost(this).glint.emitParticleAt(mx + Math.cos(baseAngle) * 8, my + Math.sin(baseAngle) * 8, 1);

        this.cameras.main.shake(inZone ? 25 : 12, 0.001);
    }

    // ── Accuracy circle — drawn each frame while icicle cannon is equipped ────
    // The Icicle Cannon had an aiming circle; the shotgun rework dropped it. Clears a leftover.
    _updateIcicleAccuracyCircle() {
        if (this._icicleAccuracyCircle) { this._icicleAccuracyCircle.destroy(); this._icicleAccuracyCircle = null; }
    }

    _updateIcicleChargeBar() {
        if (typeof HUD !== 'undefined' && typeof HUD.prototype.updateIcicleChargeBar === 'function') {
            HUD.prototype.updateIcicleChargeBar.call(this);
        }
    }

}
