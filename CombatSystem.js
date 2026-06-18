// ═══════════════════════════════════════════════════════════════════════
// COMBATSYSTEM.JS — Damage gates, kill, status effects (burn, brittle, freeze, slow)
// ═══════════════════════════════════════════════════════════════════════
// All methods receive GameScene as `this` via .call(scene, ...) from GameScene.js
// Do NOT add local state here — all state lives on the scene object.

class CombatSystem {

    showCannotSwitchText(reason) {
        // Dedupe — don't spam if already showing
        if (this._cannotSwitchText && this._cannotSwitchText.active) return;

        const txt = this.add.text(
            this.scale.width / 2,
            this.scale.height / 2 - 60,
            `✕ CANNOT SWITCH\n${reason}`,
            {
                fontSize: '14px', fontFamily: 'monospace',
                color: '#ff4444', stroke: '#000000', strokeThickness: 3,
                fontStyle: 'bold', align: 'center'
            }
        ).setOrigin(0.5).setScrollFactor(0).setDepth(30);

        this._cannotSwitchText = txt;
        this.tweens.add({
            targets: txt, y: txt.y - 20, alpha: 0,
            duration: 1000, ease: 'Quad.easeOut',
            onComplete: () => { txt.destroy(); this._cannotSwitchText = null; }
        });
    }

    showStatusText(x, y, text, color = '#ffffff') {
        const txt = this.add.text(
            x + (Math.random() - 0.5) * 14,
            y - 22,
            text,
            {
                fontSize: '11px',
                fontFamily: 'monospace',
                color,
                stroke: '#000000',
                strokeThickness: 3,
                fontStyle: 'bold'
            }
        ).setOrigin(0.5).setDepth(10);
        this.tweens.add({
            targets: txt,
            y: txt.y - 18,
            alpha: 0,
            duration: 900,
            ease: 'Quad.easeOut',
            onComplete: () => txt.destroy()
        });
    }

    showDamageNumber(x, y, amount, color = '#ffffff') {
        if (!amount || amount <= 0) return;
        const txt = this.add.text(
            x + (Math.random() - 0.5) * 12,
            y - 14,
            `-${amount.toFixed(1)}`,
            {
                fontSize: '13px',
                fontFamily: 'monospace',
                color,
                stroke: '#000000',
                strokeThickness: 3,
                fontStyle: 'bold'
            }
        ).setOrigin(0.5).setDepth(10);
        this.tweens.add({
            targets: txt,
            y: txt.y - 24,
            alpha: 0,
            duration: 750,
            ease: 'Quad.easeOut',
            onComplete: () => txt.destroy()
        });
    }

    damageEnemy(enemy, damage) {
        // In tutorial: enemies in rooms the player hasn't entered yet can't be hurt
        if (this.isTutorial && enemy.tutorialRoomIndex !== undefined) {
            if (enemy.tutorialRoomIndex !== this.getCurrentPlayerRoom()) return;
        }

        // Void snipers invincible while invisible
        if (enemy.isVoidSniper && enemy._sniperInvisible) {
            if (enemy.sprite?.active) this.showStatusText(enemy.sprite.x, enemy.sprite.y - 10, 'INVISIBLE', '#9922cc');
            return;
        }

        // Dark Matter Fragments — direct health reduction, show number
        if (enemy.isFragment && enemy.sprite?.active) {
            enemy.health -= damage;
            this.showDamageNumber(enemy.sprite.x, enemy.sprite.y - 10, damage, '#cc44ff');
            return;
        }

        // Void snipers are invincible while invisible
        if (enemy.isVoidSniper && enemy._sniperInvisible) {
            if (enemy.sprite?.active) this.showStatusText(enemy.sprite.x, enemy.sprite.y - 10, 'INVISIBLE', '#9922cc');
            return;
        }

        // Blocks all DIRECT damage
        // Environmental/indirect sources bypass this function entirely:
        //   fireImmune: hurt by lava tiles and burn DoT (not direct fire spells)
        //   iceImmune:  hurt only by shatter (damageEnemyIce when frozen)
        //   lightningImmune (future): hurt only by conductor node zaps
        if (enemy.fireImmune || enemy.iceImmune) {
            if (enemy.sprite && enemy.sprite.active) {
                // Color-code the immunity message to the enemy type
                const immuneColor = enemy.iceImmune ? '#88eeff' : '#ff8844';
                this.showStatusText(enemy.sprite.x, enemy.sprite.y - 10, 'IMMUNE', immuneColor);
            }
            // Trigger Glerp's ice tutorial explanation on any non-ice damage attempt vs ice-immune
            if (enemy.iceImmune && this.isIceTutorial) {
                this._triggerIceImmuneGlerpReaction();
            }
            return;
        }

        const tsunamiBonus = this.tsunamiFrozenEnemies.includes(enemy) ? this.tsunamiFreezeMultiplier : 1;
        const frozenBonus  = enemy.isFrozen ? 2.5 : 1;
        const purpleBonus  = enemy._purpleMarked ? 2.0 : 1;
        if (enemy.isFrozen) {
            // Clear freeze visuals immediately on any hit while frozen
            if (enemy.freezeVisuals) {
                if (enemy.freezeVisuals._extraLayers) {
                    for (const l of enemy.freezeVisuals._extraLayers) { this.tweens.killTweensOf(l); l.destroy(); }
                }
                if (enemy.freezeVisuals.iceBlock)  { this.tweens.killTweensOf(enemy.freezeVisuals.iceBlock);  enemy.freezeVisuals.iceBlock.destroy(); }
                if (enemy.freezeVisuals.iceBorder) { this.tweens.killTweensOf(enemy.freezeVisuals.iceBorder); enemy.freezeVisuals.iceBorder.destroy(); }
                enemy.freezeVisuals = null;
            }
            if (enemy._thawTimer) { enemy._thawTimer.remove(); enemy._thawTimer = null; }
            this._triggerShatterBurst(enemy);
        }
        const toughnessMult = (enemy._absorberToughnessMult && enemy._absorberBuffUntil > this.time.now)
            ? 1 / enemy._absorberToughnessMult : 1;
        const actualDamage = damage * tsunamiBonus * frozenBonus * purpleBonus * toughnessMult;
        enemy.health -= actualDamage;

        // Gain ult charge on hit (skip for lightning to prevent chain spam)
        if (this.currentElement !== 'lightning') {
            this.gainUltCharge(this.ultChargePerHit);
        }

        // Show damage number
        if (enemy.sprite && enemy.sprite.active) {
            const color = this.currentElement === 'fire' ? '#ff8800'
                : this.currentElement === 'ice' ? '#88eeff'
                : this.currentElement === 'lightning' ? '#ffff44'
                : '#cc99ff';
            this.showDamageNumber(enemy.sprite.x, enemy.sprite.y, actualDamage, color);
        }

        if (this.currentElement === 'fire') {
            // Magma staff uses the new burn stack system — skip the old isBurning visual
            const usingStaff = (this.equippedWeapons?.fire || 'flame_fists') === 'magma_staff';
            if (!usingStaff) {
                const wasAlreadyBurning = enemy.isBurning;
                enemy.isBurning = true;
                enemy.burnUntil = this.time.now + this.burnDuration;
                if (!enemy.burnVisualActive) this.showBurnVisual(enemy);
                if (!wasAlreadyBurning && enemy.sprite && enemy.sprite.active) {
                    this.showStatusText(enemy.sprite.x, enemy.sprite.y, 'BURNING', '#ff8800');
                }
            }
        }

        if (this.currentElement === 'ice' && enemy.health > 0) {
            const wasAlreadySlowed = enemy.isSlowed;
            enemy.isSlowed = true;
            enemy.slowedUntil = this.time.now + this.slowDuration;
            if (!wasAlreadySlowed && enemy.sprite && enemy.sprite.active) {
                this.showStatusText(enemy.sprite.x, enemy.sprite.y, 'SLOWED', '#44ccff');
                // Start slow indicator arrows — stop when isSlowed expires
                if (enemy._slowIndTimer) { enemy._slowIndTimer.remove(); enemy._slowIndTimer = null; }
                enemy._slowIndTimer = this._startSpeedIndicator(
                    () => enemy.sprite?.active ? { x: enemy.sprite.x, y: enemy.sprite.y - 10 } : null,
                    'slow_ice', 320
                );
            }

            if (Math.random() < 0.15 && !enemy.isFrozen) {
                this.freezeEnemy(enemy, 2000);
            }

            this.updateSlowEffect(enemy);
        }

        if (enemy.isFrozen) {
            enemy.health -= actualDamage * 0.5;
        }

        const flashColor = this.currentElement === 'ice' ? 0x00ffff : 0xffffff;
        enemy.sprite.setTint(flashColor);
        this.time.delayedCall(100, () => {
            if (enemy.sprite && enemy.sprite.active) {
                if (enemy.isFrozen) {
                    enemy.sprite.setTint(0x88ccff);
                } else if (enemy.isBurning && (this.equippedWeapons?.fire || 'flame_fists') !== 'magma_staff') {
                    enemy.sprite.setTint(0xff6600);
                } else {
                    enemy.sprite.clearTint();
                }
            }
        });

        this.updateEnemyHealthBar(enemy);

        if (enemy.health <= 0) {
            this.killEnemy(enemy);
        }
    }

    killEnemy(enemy) {
        // Don't process kills after the player has already died
        if (this._deathScreenActive) {
            // Just clean up the sprite silently
            if (enemy._ultAbsorberRotTimer) { enemy._ultAbsorberRotTimer.remove(); enemy._ultAbsorberRotTimer = null; }
            if (enemy._ultAbsorberAura)  { this.tweens.killTweensOf(enemy._ultAbsorberAura);  enemy._ultAbsorberAura.destroy();  }
            if (enemy._ultAbsorberMark)  { enemy._ultAbsorberMark.destroy(); }
            if (enemy._drainBeam)        { enemy._drainBeam.clear(); enemy._drainBeam.destroy(); enemy._drainBeam = null; }
            if (enemy._absorberBuffAura) { this.tweens.killTweensOf(enemy._absorberBuffAura); enemy._absorberBuffAura.destroy(); enemy._absorberBuffAura = null; }
            if (enemy.sprite) enemy.sprite.destroy();
            const idx = this.enemies.indexOf(enemy);
            if (idx !== -1) this.enemies.splice(idx, 1);
            return;
        }
        // Tutorial: give bonus ult charge per kill so player sees the bar fill
        if (this.isTutorial) {
            this.gainUltCharge(20);
        }
        // ── Absorber visual cleanup ──
        if (enemy._ultAbsorberRotTimer) { enemy._ultAbsorberRotTimer.remove(); enemy._ultAbsorberRotTimer = null; }
        if (enemy._ultAbsorberAura)  { this.tweens.killTweensOf(enemy._ultAbsorberAura);  enemy._ultAbsorberAura.destroy();  enemy._ultAbsorberAura  = null; }
        if (enemy._ultAbsorberMark)  { this.tweens.killTweensOf(enemy._ultAbsorberMark);  enemy._ultAbsorberMark.destroy();  enemy._ultAbsorberMark  = null; }
        if (enemy._drainBeam)        { enemy._drainBeam.clear(); enemy._drainBeam.destroy(); enemy._drainBeam = null; }
        if (enemy._absorberBuffAura) { this.tweens.killTweensOf(enemy._absorberBuffAura); enemy._absorberBuffAura.destroy(); enemy._absorberBuffAura = null; }
        if (enemy._toughnessShieldMark) { this.tweens.killTweensOf(enemy._toughnessShieldMark); enemy._toughnessShieldMark.destroy(); enemy._toughnessShieldMark = null; }
        if (enemy._shatterMarkVisual){ this.tweens.killTweensOf(enemy._shatterMarkVisual); enemy._shatterMarkVisual.destroy(); enemy._shatterMarkVisual = null; }
        if (enemy._shatterMarkTimer) { enemy._shatterMarkTimer.remove(); enemy._shatterMarkTimer = null; }
        if (enemy._shieldMark && enemy._shieldMark.active) {
            this.tweens.killTweensOf(enemy._shieldMark);
            enemy._shieldMark.destroy();
        }
        // Clean up fire immune mark
        if (enemy._fireMark && enemy._fireMark.active) {
            this.tweens.killTweensOf(enemy._fireMark);
            enemy._fireMark.destroy();
        }
        // Clean up inhibitor visuals if present
        if (enemy._inhibitRing && enemy._inhibitRing.active) {
            this.tweens.killTweensOf(enemy._inhibitRing);
            enemy._inhibitRing.destroy();
        }
        if (enemy._inhibitMark && enemy._inhibitMark.active) {
            this.tweens.killTweensOf(enemy._inhibitMark);
            enemy._inhibitMark.destroy();
        }
        if (enemy._iceMark && enemy._iceMark.active) {
            this.tweens.killTweensOf(enemy._iceMark);
            enemy._iceMark.destroy();
        }
        // Level 3 mark cleanup
        if (enemy._lightningMark && enemy._lightningMark.active) {
            this.tweens.killTweensOf(enemy._lightningMark);
            enemy._lightningMark.destroy();
            enemy._lightningMark = null;
        }
        if (enemy._arcRangeRing && enemy._arcRangeRing.active) {
            this.tweens.killTweensOf(enemy._arcRangeRing);
            enemy._arcRangeRing.destroy();
            enemy._arcRangeRing = null;
        }
        if (enemy._slowIndTimer)  { enemy._slowIndTimer.remove();  enemy._slowIndTimer  = null; }
        if (enemy._speedIndTimer) { enemy._speedIndTimer.remove(); enemy._speedIndTimer = null; }
        // Level 4 visual cleanup
        if (enemy._mortarGfx?.active)     { this.tweens.killTweensOf(enemy._mortarGfx);     enemy._mortarGfx.destroy();     enemy._mortarGfx = null; }
        if (enemy._mortarSafeRing?.active) { this.tweens.killTweensOf(enemy._mortarSafeRing); enemy._mortarSafeRing.destroy(); enemy._mortarSafeRing = null; }
        if (enemy._rooterMark?.active)    { this.tweens.killTweensOf(enemy._rooterMark);    enemy._rooterMark.destroy();    enemy._rooterMark = null; }
        if (enemy._anchorRing?.active)    { this.tweens.killTweensOf(enemy._anchorRing);    enemy._anchorRing.destroy();    enemy._anchorRing = null; }
        if (enemy._anchorBodyGfx?.active) { this.tweens.killTweensOf(enemy._anchorBodyGfx); enemy._anchorBodyGfx.destroy(); enemy._anchorBodyGfx = null; }
        if (enemy._healerAura?.active)    { this.tweens.killTweensOf(enemy._healerAura);    enemy._healerAura.destroy();    enemy._healerAura = null; }
        if (enemy._totemGfx?.active)      { this.tweens.killTweensOf(enemy._totemGfx);      enemy._totemGfx.destroy();      enemy._totemGfx = null; }
        if (enemy._orbGlow?.active)       { this.tweens.killTweensOf(enemy._orbGlow);       enemy._orbGlow.destroy();       enemy._orbGlow = null; }
        if (enemy._particleTimer)         { enemy._particleTimer.remove(); enemy._particleTimer = null; }
        if (enemy._splitterMark?.active)  { this.tweens.killTweensOf(enemy._splitterMark);  enemy._splitterMark.destroy();  enemy._splitterMark = null; }
        // Splitter — spawn children before removing from scene
        if (enemy.isSplitter && typeof this._triggerSplitterDeath === 'function') {
            this._triggerSplitterDeath(enemy);
        }
        if (enemy._voidMark && enemy._voidMark.active) {
            this.tweens.killTweensOf(enemy._voidMark);
            enemy._voidMark.destroy();
            enemy._voidMark = null;
        }
        if (enemy._sniperChargeGfx && enemy._sniperChargeGfx.active) {
            this.tweens.killTweensOf(enemy._sniperChargeGfx);
            enemy._sniperChargeGfx.destroy();
            enemy._sniperChargeGfx = null;
        }
        if (enemy._berserkerMark && enemy._berserkerMark.active) {
            this.tweens.killTweensOf(enemy._berserkerMark);
            enemy._berserkerMark.destroy();
            enemy._berserkerMark = null;
        }
        // Clean up ranged enemy visuals
        this._destroyPrefireBeam(enemy);
        // Cancel scheduled natural-melt water tile if enemy dies before it fires
        if (enemy._freezeMeltTimer) { enemy._freezeMeltTimer.remove(); enemy._freezeMeltTimer = null; }
        this._destroyChillIndicator(enemy);
        if (enemy._rangedMark && enemy._rangedMark.active) {
            this.tweens.killTweensOf(enemy._rangedMark);
            enemy._rangedMark.destroy();
        }
        // Clean up electrical enemy aura
        if (enemy._electricalAuraTimer) { enemy._electricalAuraTimer.remove(); enemy._electricalAuraTimer = null; }
        if (enemy._electricalAura?.active) { enemy._electricalAura.destroy(); }
        // COSMIC: 50% chance to drop charge
        if (this.currentElement === 'cosmic' && Math.random() < this.cosmicDropChance) {
            this.addCosmicCharge(enemy.sprite.x, enemy.sprite.y);
        }
        // 10% chance to drop an orb scrap — only for node-based lightning weapons, not fists
        const lightningWeapon = this.equippedWeapons?.lightning || 'lightning_fists';
        if (this.currentElement === 'lightning' && lightningWeapon !== 'lightning_fists' &&
            Math.random() < this.orbDropChance && enemy.sprite) {
            this.spawnOrbScrap(enemy.sprite.x, enemy.sprite.y);
        }
        // Small chance to drop glorps or health pot
        this.tryDropFromEnemy(enemy);

        if (enemy.sprite) enemy.sprite.destroy();
        if (enemy.healthBarBg) enemy.healthBarBg.destroy();
        if (enemy.healthBarFill) enemy.healthBarFill.destroy();
        this.clearBurnVisual(enemy);

        if (enemy.freezeVisuals) {
            if (enemy.freezeVisuals._extraLayers) {
                for (const l of enemy.freezeVisuals._extraLayers) { this.tweens.killTweensOf(l); l.destroy(); }
            }
            if (enemy.freezeVisuals.iceBlock) {
                this.tweens.killTweensOf(enemy.freezeVisuals.iceBlock);
                enemy.freezeVisuals.iceBlock.setVisible(false);
                enemy.freezeVisuals.iceBlock.destroy();
            }
            if (enemy.freezeVisuals.iceBorder) {
                this.tweens.killTweensOf(enemy.freezeVisuals.iceBorder);
                enemy.freezeVisuals.iceBorder.setVisible(false);
                enemy.freezeVisuals.iceBorder.destroy();
            }
            enemy.freezeVisuals = null;
        }
        if (enemy.brittleVisual) {
            this.tweens.killTweensOf(enemy.brittleVisual);
            enemy.brittleVisual.destroy();
            enemy.brittleVisual = null;
        }
        enemy.brittleStacks = 0;

        if (enemy._tsunamiMultText) { enemy._tsunamiMultText.destroy(); enemy._tsunamiMultText = null; }
        const tfi = this.tsunamiFrozenEnemies.indexOf(enemy);
        if (tfi > -1) this.tsunamiFrozenEnemies.splice(tfi, 1);
        delete enemy._bhOrbitAngle;
        delete enemy._bhOrbitRadius;
        if (enemy.isSuperConducted) this.clearSuperConduct(enemy);

        // Remove from all active projectile hit sets so they can hit the tile again
        for (const fb of this.fireballs) {
            if (fb.piercedEnemies) fb.piercedEnemies.delete(enemy);
        }
        for (const s of this.iceShards) {
            if (s.hitEnemies) s.hitEnemies.delete(enemy);
        }

        // COSMIC MARKS CLEANUP (make sure this is here!)
        if (enemy.cosmicMarkVisuals) {
            enemy.cosmicMarkVisuals.forEach(v => {
                this.tweens.killTweensOf(v);
                v.destroy();
            });
            enemy.cosmicMarkVisuals = null; // Set to null after destroying
        }

        // Burn stack cleanup
        if (enemy._burnDoTTimer) { enemy._burnDoTTimer.remove(); enemy._burnDoTTimer = null; }
        if (enemy._burnStackBar) {
            for (const pip of enemy._burnStackBar) { this.tweens.killTweensOf(pip); pip.destroy(); }
            enemy._burnStackBar = null;
        }
        enemy.burnStacks = 0;
        // Shatter / purple mark cleanup
        if (enemy._shatterMarkTimer)  { enemy._shatterMarkTimer.remove();  enemy._shatterMarkTimer  = null; }
        if (enemy._purpleMarkTimer)   { enemy._purpleMarkTimer.remove();   enemy._purpleMarkTimer   = null; }
        if (enemy._shatterMarkVisual) { this.tweens.killTweensOf(enemy._shatterMarkVisual); enemy._shatterMarkVisual.destroy(); enemy._shatterMarkVisual = null; }
        enemy._shatterMarked = false;
        enemy._purpleMarked  = false;
        // Recalculate magma staff fireball count after this enemy is removed
        if (typeof this._recalcMagmaFireballCount === 'function') {
            this._recalcMagmaFireballCount();
        } else {
            let max = 0;
            for (const e of this.enemies) { if (e !== enemy && e.sprite?.active) max = Math.max(max, e.burnStacks || 0); }
            this._magmaStaffFireballCount = max > 0 ? max : undefined;
        }

        const index = this.enemies.indexOf(enemy);
        if (index > -1) {
            this.enemies.splice(index, 1);
        }
    }

    takeDamage(amount) {
        // Untargetable during Thunderhead or Lightning Ult (Fork)
        if (this.thunderheadActive || this.lightningUltInvuln) {
            const ix = this.player.x - this.cameras.main.scrollX;
            const iy = this.player.y - this.cameras.main.scrollY;
            const txt = this.add.text(ix, iy - 20, 'IMMUNE', {
                fontSize: '14px', fontFamily: 'monospace',
                color: '#ffff88', stroke: '#000000', strokeThickness: 3, fontStyle: 'bold'
            }).setOrigin(0.5).setScrollFactor(0).setDepth(20);
            this.tweens.add({ targets: txt, y: txt.y - 20, alpha: 0, duration: 600, ease: 'Quad.easeOut', onComplete: () => txt.destroy() });
            return;
        }

        const actualDamage = amount * this.damageReductionMultiplier;
        const blockedDamage = amount - actualDamage;

        // Cancel cosmic channeling — getting hit interrupts it
        if (this.cosmicChanneling) {
            this.stopCosmicChanneling(true); // true = interrupted
        }

        this.health -= actualDamage;

        if (blockedDamage > 0) {
            this.showShieldBlock(blockedDamage);
        }

        this.player.setTint(0xff0000);
        this.time.delayedCall(200, () => {
            this.player.clearTint();
        });

        this.updateHUD();

        if (this.health <= 0) {
            this.gameOver();
        }
    }

    // Tile-based boss damage — checks if hit tile is within boss hitbox
    damageBossAtTile(tileX, tileY, damage, sourceId) {
        // ── Helper: per-source cooldown guard ────────────────────────────────
        const _cooldownOk = (boss) => {
            if (sourceId === undefined) return true;
            if (!boss._hitCooldowns) boss._hitCooldowns = {};
            const now = this.time.now;
            if (boss._hitCooldowns[sourceId] && now - boss._hitCooldowns[sourceId] < 120) return false;
            boss._hitCooldowns[sourceId] = now;
            if (!boss._lastCooldownClean || now - boss._lastCooldownClean > 5000) {
                boss._lastCooldownClean = now;
                for (const key in boss._hitCooldowns)
                    if (now - boss._hitCooldowns[key] > 1000) delete boss._hitCooldowns[key];
            }
            return true;
        };

        // ── Voltslime ─────────────────────────────────────────────────────────
        if (this.voltslimeBoss?.active) {
            const boss = this.voltslimeBoss;
            if (Math.abs(tileX - boss.tileX) <= 1 && Math.abs(tileY - boss.tileY) <= 1) {
                if (!_cooldownOk(boss)) return false;
                this.damageVoltslimeBoss(damage);
                if (this.currentElement !== 'lightning') this.gainUltCharge(this.ultChargePerHit);
                return true;
            }
        }

        // ── Void Sovereign ────────────────────────────────────────────────────
        if (this.voidSovereignBoss?.active) {
            const boss = this.voidSovereignBoss;
            if (boss._eventHorizonActive) {
                this.showStatusText(boss.container.x, boss.container.y - 50, 'REFLECTED!', '#cc44ff');
                return false;
            }
            if (boss._isInvulnerable) return false;
            // Pixel-radius check using tile centre — tighter than tile-grid to match visual hitbox
            const bpx = boss.container.x;
            const bpy = boss.container.y + (this.SLIME_Y_OFFSET || 0);
            const wpx = tileX * this.TILE_SIZE + this.TILE_SIZE / 2;
            const wpy = tileY * this.TILE_SIZE + this.TILE_SIZE / 2;
            const HIT_R = this.TILE_SIZE * 2.0; // ~2 tile radius — matches visible body
            if ((wpx - bpx) * (wpx - bpx) + (wpy - bpy) * (wpy - bpy) <= HIT_R * HIT_R) {
                if (!_cooldownOk(boss)) return false;
                if (typeof this.damageVoidSovereignBoss === 'function') this.damageVoidSovereignBoss(damage);
                if (this.currentElement !== 'lightning') this.gainUltCharge(this.ultChargePerHit);
                return true;
            }
        }

        // ── Fracture Core ─────────────────────────────────────────────────────
        if (this.fractureCore?.active && typeof this.damageFractureCore === 'function') {
            const fc = this.fractureCore;
            if (!fc._surfaced) return false; // only damageable while surfaced
            if (!_cooldownOk(fc)) return false;
            const wpx = tileX * this.TILE_SIZE + this.TILE_SIZE / 2;
            const wpy = tileY * this.TILE_SIZE + this.TILE_SIZE / 2;
            const radius = this.TILE_SIZE * 0.6;
            // Check if this hit lands on any incomplete weak point
            const wp = (this._fractureWeakPoints || []).find(w =>
                !w.complete && Math.hypot(w.x - wpx, w.y - wpy) < radius + 13);
            if (!wp) return false;
            this.damageFractureCore(damage, wpx, wpy);
            if (this.currentElement !== 'cosmic') this.gainUltCharge(this.ultChargePerHit);
            return true;
        }

        return false;
    }

    gainUltCharge(amount) {
        if (this.ultCharge >= this.ultChargeMax || this.ultDrainActive) return;
        const wasReady = this.ultCharge >= this.ultChargeMax;
        this.ultCharge = Math.min(this.ultChargeMax, this.ultCharge + amount);
        const nowReady = this.ultCharge >= this.ultChargeMax;
        // Flash the bar label when it first hits full
        if (!wasReady && nowReady && this.ultBarLabel) {
            this.tweens.add({ targets: this.ultBarLabel, scaleX: 1.4, scaleY: 1.4, duration: 120, yoyo: true, ease: 'Quad.easeOut' });
        }
        this.updateHUD();
    }

    switchToElement(targetElement) {
        // In tutorial rooms 0 & 1: fire fists only, no switching allowed
        if (this.isTutorial && this.tutorialWeaponLocked) {
            this.showTutorialDialogue("Master your Flame Fists first!\nElement switching unlocks later.", "Glerp");
            return;
        }
        // Fire tutorial: restrict elements until unlocked
        // Ice tutorial: fire and ice always allowed freely
        if (this.isTutorial && !this.isIceTutorial) {
            if (targetElement === 'fire') {
                // Always allow
            } else if (targetElement === 'ice' && !this.tutorialIceUnlocked) {
                this.showTutorialDialogue("Ice isn't available yet!\nClear the current room first.", "Glerp");
                return;
            } else if (targetElement !== 'ice') {
                // Lightning and cosmic locked in fire tutorial
                return;
            }
        } else if (this.isTutorial && this.isIceTutorial) {
            if (targetElement === 'ice' && !this.tutorialIceUnlocked) {
                this.showTutorialDialogue("You don't have ICE yet! Keep fighting.", "Glerp");
                return;
            }
            const inUltRoom = this.getCurrentPlayerRoom() === 3 && !this._iceUltUsed;
            if (inUltRoom && targetElement !== 'ice') {
                this.showTutorialDialogue("You need ICE for this room!\nPress 2 to switch to Ice, then E to unleash the Blizzard.", "Glerp");
                return;
            }
            if (targetElement !== 'fire' && targetElement !== 'ice') return;
        } else if (!this.isTutorial) {
            // All real levels — gate on localStorage
            const iceUnlocked = this.tutorialIceUnlocked
                || localStorage.getItem('unlocked_ice') === 'true'
                || localStorage.getItem('iceTutorialComplete') === '1';
            if (targetElement === 'ice' && !iceUnlocked) {
                this.showTutorialDialogue("Complete the Ice Tutorial first!", "Glerp");
                return;
            }
            if (targetElement === 'lightning' && localStorage.getItem('unlocked_lightning') !== 'true') {
                this.showTutorialDialogue("Lightning isn't available yet!\nFind it at the end of Level 2.", "Glerp");
                return;
            }
            if (targetElement === 'cosmic' && localStorage.getItem('unlocked_cosmic') !== 'true') {
                this.showTutorialDialogue("Cosmic isn't available yet!\nFind it at the end of Level 3.", "Glerp");
                return;
            }
        }
        const currentTime = this.time.now;

        if (this.currentElement === targetElement) return;

        // Block switching during active abilities
        // Ice ult DOMAIN is allowed to persist through element switches — only block during
        // the pre-domain tsunami wave phase (tsunamiActive && !_iceUltDomainActive)
        const blockingState =
            this.thunderheadActive ? 'THUNDERHEAD ACTIVE' :
            (this.tsunamiActive && !this._iceUltDomainActive) ? 'TSUNAMI ACTIVE' :
            this.ignitionActive    ? 'IGNITION ACTIVE' :
            this.cosmicUltActive   ? 'BLACK HOLE ACTIVE' :
            this.cosmicCharging    ? 'CHARGING BEAM' :
            this.cosmicContinuousLaserActive ? 'LASER ACTIVE' :
            null;

        if (blockingState) {
            this.showCannotSwitchText(blockingState);
            return;
        }

        if (currentTime - this.lastElementSwitchTime < this.elementSwitchCooldown) {
            return;
        }

        this.isPointerDown = false;
        this.clearNodeMode();
        this.clearNodePreview();
        if (this.cosmicChanneling) this.stopCosmicChanneling(false);

        // Clean up cosmic charge indicator if mid-charge somehow
        if (this.cosmicChargeIndicator) {
            this.tweens.killTweensOf(this.cosmicChargeIndicator);
            this.cosmicChargeIndicator.destroy();
            this.cosmicChargeIndicator = null;
        }
        this.cosmicCharging = false;
        this.cosmicContinuousLaserActive = false;

        // Clear projectiles
        for (let fireball of this.fireballs) {
            if (fireball.sprite) fireball.sprite.destroy();
        }
        this.fireballs = [];

        // Clear ice shards
        for (let s of this.iceShards) this.destroyIceShard(s);
        this.iceShards = [];

        // Clear lightning arc projectiles and crafting nodes
        for (let p of (this.lightningProjectiles || [])) { if (p.g?.active) p.g.destroy(); }
        this.lightningProjectiles = [];
        for (let c of this.lightningNodesCrafting) {
            this.tweens.killTweensOf(c.barFill);
            this.tweens.killTweensOf(c.ghostDot);
            c.ghost.destroy(); c.barBg.destroy(); c.barFill.destroy(); c.ghostDot.destroy();
        }
        this.lightningNodesCrafting = [];

        // Switch to new element — apply charge penalty
        this.currentElement = targetElement;
        this.ultCharge = Math.max(0, this.ultCharge - this.ultChargeSwitchPenalty);
        this.updateHUD();

        const px = this.player.x - this.cameras.main.scrollX;
        const py = this.player.y - this.cameras.main.scrollY;

        if (targetElement === 'fire') {
            // Eruption: rings of fire expanding outward, embers flying up
            const screenFlash = this.add.rectangle(this.scale.width / 2, this.scale.height / 2, this.scale.width, this.scale.height, 0xff3300, 0.25).setScrollFactor(0).setDepth(20);
            this.tweens.add({ targets: screenFlash, alpha: 0, duration: 300, onComplete: () => screenFlash.destroy() });
            for (let r = 0; r < 3; r++) {
                const ring = this.add.circle(px, py, 10, 0xff6600, 0).setScrollFactor(0).setDepth(20);
                ring.setStrokeStyle(3 - r, 0xff4400, 0.9 - r * 0.2);
                this.tweens.add({ targets: ring, radius: 80 + r * 40, alpha: 0, duration: 350 + r * 80, delay: r * 60, ease: 'Quad.easeOut', onComplete: () => ring.destroy() });
            }
            for (let i = 0; i < 10; i++) {
                const angle = Math.random() * Math.PI * 2;
                const spd = 30 + Math.random() * 50;
                const ember = this.add.circle(px, py, 2 + Math.random() * 2, Math.random() < 0.5 ? 0xff6600 : 0xffaa00, 1).setScrollFactor(0).setDepth(20);
                this.tweens.add({ targets: ember, x: px + Math.cos(angle) * spd, y: py + Math.sin(angle) * spd - 20, alpha: 0, duration: 400 + Math.random() * 200, ease: 'Quad.easeOut', onComplete: () => ember.destroy() });
            }
            this.player.setTint(0xff6600);
            this.time.delayedCall(300, () => this.player.clearTint());

        } else if (targetElement === 'ice') {
            // Freeze burst: crystalline shards radiating out, screen tints blue
            const screenFlash = this.add.rectangle(this.scale.width / 2, this.scale.height / 2, this.scale.width, this.scale.height, 0x0099cc, 0.2).setScrollFactor(0).setDepth(20);
            this.tweens.add({ targets: screenFlash, alpha: 0, duration: 400, onComplete: () => screenFlash.destroy() });
            for (let i = 0; i < 12; i++) {
                const angle = (Math.PI * 2 / 12) * i;
                const len = 30 + Math.random() * 40;
                const shard = this.add.rectangle(px, py, 4, 12, 0xaaddff, 0.9).setScrollFactor(0).setDepth(20);
                shard.setRotation(angle);
                this.tweens.add({ targets: shard, x: px + Math.cos(angle) * len, y: py + Math.sin(angle) * len, alpha: 0, scaleY: 0.3, duration: 350, ease: 'Quad.easeOut', onComplete: () => shard.destroy() });
            }
            const frost = this.add.circle(px, py, 8, 0xffffff, 0.7).setScrollFactor(0).setDepth(20);
            this.tweens.add({ targets: frost, radius: 60, alpha: 0, duration: 300, ease: 'Quad.easeOut', onComplete: () => frost.destroy() });
            this.player.setTint(0x00ccff);
            this.time.delayedCall(350, () => this.player.clearTint());

        } else if (targetElement === 'lightning') {
            // Electric discharge: jagged arcs flying out, screen flash yellow
            const screenFlash = this.add.rectangle(this.scale.width / 2, this.scale.height / 2, this.scale.width, this.scale.height, 0xffff00, 0.3).setScrollFactor(0).setDepth(20);
            this.tweens.add({ targets: screenFlash, alpha: 0, duration: 150, onComplete: () => screenFlash.destroy() });
            for (let i = 0; i < 6; i++) {
                const angle = (Math.PI * 2 / 6) * i + (Math.random() - 0.5) * 0.5;
                const g = this.add.graphics().setScrollFactor(0).setDepth(20);
                g.lineStyle(2, 0xffff00, 1);
                g.beginPath(); g.moveTo(px, py);
                let cx2 = px, cy2 = py;
                for (let s = 0; s < 4; s++) {
                    cx2 += Math.cos(angle) * 15 + (Math.random() - 0.5) * 10;
                    cy2 += Math.sin(angle) * 15 + (Math.random() - 0.5) * 10;
                    g.lineTo(cx2, cy2);
                }
                g.strokePath();
                this.tweens.add({ targets: g, alpha: 0, duration: 200, onComplete: () => g.destroy() });
            }
            this.player.setTint(0xffff00);
            this.time.delayedCall(200, () => this.player.clearTint());

        } else if (targetElement === 'cosmic') {
            // Void implosion then expansion: dark circle shrinks in then explodes purple
            const screenFlash = this.add.rectangle(this.scale.width / 2, this.scale.height / 2, this.scale.width, this.scale.height, 0x220033, 0.35).setScrollFactor(0).setDepth(20);
            this.tweens.add({ targets: screenFlash, alpha: 0, duration: 500, onComplete: () => screenFlash.destroy() });
            const void1 = this.add.circle(px, py, 50, 0x110022, 0.8).setScrollFactor(0).setDepth(20);
            this.tweens.add({ targets: void1, radius: 5, duration: 200, ease: 'Quad.easeIn', onComplete: () => {
                this.tweens.add({ targets: void1, radius: 120, alpha: 0, duration: 300, ease: 'Quad.easeOut', onComplete: () => void1.destroy() });
                for (let i = 0; i < 8; i++) {
                    const angle = (Math.PI * 2 / 8) * i;
                    const orb = this.add.circle(px, py, 4, 0xcc88ff, 1).setScrollFactor(0).setDepth(20);
                    this.tweens.add({ targets: orb, x: px + Math.cos(angle) * 70, y: py + Math.sin(angle) * 70, alpha: 0, duration: 350, ease: 'Quad.easeOut', onComplete: () => orb.destroy() });
                }
            }});
            this.player.setTint(0x9966ff);
            this.time.delayedCall(400, () => this.player.clearTint());
        }

        this.lastElementSwitchTime = currentTime;
        this.updateHUD();
    }

    updateUltAbsorbers(time) {
        if (!this.enemies) return;
        const ABSORB_RADIUS  = 4;    // tiles
        const DRAIN_PER_SEC  = 18;   // ult charge drained per second while in range
        const HEAL_RADIUS    = 3;    // tiles — enemies healed around absorber
        const BUFF_DURATION  = 3000; // ms neighbours stay tankier after being healed
        const TOUGHNESS_MULT = 1.6;  // damage reduction factor while buffed

        for (const enemy of this.enemies) {
            if (!enemy.isUltAbsorber || !enemy.sprite?.active) continue;

            // Move aura and mark with enemy
            if (enemy._ultAbsorberAura) {
                enemy._ultAbsorberAura.x = enemy.sprite.x;
                enemy._ultAbsorberAura.y = enemy.sprite.y;
            }
            if (enemy._ultAbsorberMark) {
                enemy._ultAbsorberMark.x = enemy.sprite.x;
                enemy._ultAbsorberMark.y = enemy.sprite.y - 16;
            }

            const playerPx = this.playerX * this.TILE_SIZE + this.TILE_SIZE / 2;
            const playerPy = this.playerY * this.TILE_SIZE + this.TILE_SIZE / 2;
            const dist = Math.abs(enemy.x - this.playerX) + Math.abs(enemy.y - this.playerY);
            const inRange = dist <= ABSORB_RADIUS && this.ultCharge > 0;

            // ── Red drain beam from enemy to player ─────────────────────
            if (inRange) {
                if (!enemy._drainBeam) {
                    enemy._drainBeam = this.add.graphics().setDepth(4);
                }
                const beam = enemy._drainBeam;
                beam.clear();
                const ex = enemy.sprite.x, ey = enemy.sprite.y;
                // Animated beam — bright core + soft glow, flickering alpha
                const flicker = 0.75 + Math.sin(time * 0.012) * 0.25;
                beam.lineStyle(3, 0xff2200, flicker);
                beam.beginPath(); beam.moveTo(ex, ey); beam.lineTo(playerPx, playerPy); beam.strokePath();
                beam.lineStyle(7, 0xff4400, flicker * 0.28);
                beam.beginPath(); beam.moveTo(ex, ey); beam.lineTo(playerPx, playerPy); beam.strokePath();
                // Arrowhead at player end pointing toward player
                const ang = Math.atan2(playerPy - ey, playerPx - ex);
                beam.fillStyle(0xff2200, flicker);
                beam.beginPath();
                beam.moveTo(playerPx, playerPy);
                beam.lineTo(playerPx - Math.cos(ang - 0.45) * 8, playerPy - Math.sin(ang - 0.45) * 8);
                beam.lineTo(playerPx - Math.cos(ang + 0.45) * 8, playerPy - Math.sin(ang + 0.45) * 8);
                beam.closePath(); beam.fillPath();
                // Small pulse sparks along beam every 500ms
                if (!enemy._lastBeamSpark || time - enemy._lastBeamSpark > 180) {
                    enemy._lastBeamSpark = time;
                    const t = Math.random();
                    const sx = ex + (playerPx - ex) * t, sy = ey + (playerPy - ey) * t;
                    const spark = this.add.graphics().setDepth(4.5);
                    spark.fillStyle(0xff6600, 0.90); spark.fillCircle(sx, sy, 2.5);
                    this.tweens.add({ targets: spark, scaleX: 2.5, scaleY: 2.5, alpha: 0, duration: 220, onComplete: () => spark.destroy() });
                }
            } else {
                // Out of range — hide beam
                if (enemy._drainBeam) { enemy._drainBeam.clear(); }
            }

            if (!inRange) continue;

            // ── Drain ult charge ─────────────────────────────────────────
            if (!enemy._lastAbsorbTime) enemy._lastAbsorbTime = time;
            const elapsed = (time - enemy._lastAbsorbTime) / 1000;
            enemy._lastAbsorbTime = time;
            const drain = Math.min(this.ultCharge, DRAIN_PER_SEC * elapsed);
            if (drain <= 0) continue;

            this.ultCharge = Math.max(0, this.ultCharge - drain);
            this.updateHUD();

            // Status text every ~0.4s to avoid spam
            if (!enemy._lastDrainText || time - enemy._lastDrainText > 400) {
                enemy._lastDrainText = time;
                this.showStatusText(this.player.x, this.player.y - 22, `ULT ABSORBED`, '#ff4400');
            }

            // ── Healing pool — ripple on floor centered on absorber ───────
            if (!enemy._lastHealPool || time - enemy._lastHealPool > 600) {
                enemy._lastHealPool = time;
                const ex = enemy.sprite.x, ey = enemy.sprite.y;
                const poolR = HEAL_RADIUS * this.TILE_SIZE;
                // Soft glow base
                const pool = this.add.graphics().setDepth(0.8);
                pool.fillStyle(0xcc44ff, 0.10);
                pool.fillCircle(ex, ey, poolR);
                pool.lineStyle(2, 0xdd66ff, 0.35);
                pool.strokeCircle(ex, ey, poolR);
                this.tweens.add({ targets: pool, alpha: 0, duration: 600, ease: 'Quad.easeIn', onComplete: () => pool.destroy() });
                // Expanding ripple ring
                const ripple = this.add.graphics().setDepth(0.9);
                ripple.lineStyle(2.5, 0xee88ff, 0.70);
                ripple.strokeCircle(ex, ey, poolR * 0.3);
                this.tweens.add({
                    targets: ripple,
                    scaleX: 1 / 0.3, scaleY: 1 / 0.3,
                    alpha: 0, duration: 600, ease: 'Quad.easeOut',
                    onComplete: () => ripple.destroy()
                });
                // Small rising heal particles from pool floor
                for (let pi = 0; pi < 4; pi++) {
                    const pa = Math.random() * Math.PI * 2;
                    const pr = Math.random() * poolR * 0.75;
                    const pg = this.add.graphics().setDepth(1.0).setAlpha(0);
                    pg.x = ex + Math.cos(pa) * pr; pg.y = ey + Math.sin(pa) * pr;
                    pg.fillStyle(0xee88ff, 0.85); pg.fillCircle(0, 0, 2 + Math.random() * 2);
                    this.tweens.add({ targets: pg, alpha: 0.9, duration: 120, delay: pi * 80 });
                    this.tweens.add({ targets: pg, y: pg.y - 14, alpha: 0, duration: 500, delay: pi * 80 + 120, ease: 'Quad.easeOut', onComplete: () => pg.destroy() });
                }
            }

            // ── Heal + buff nearby enemies proportional to amount drained ─
            // heal% of max health = drain * HEAL_PER_DRAIN_SCALE
            const HEAL_PCT = drain * 0.30; // drain 18/s → ~5.4% maxHp/s to neighbours
            for (const ally of this.enemies) {
                if (!ally.sprite?.active || ally.health <= 0) continue;
                const adx = Math.abs(ally.x - enemy.x), ady = Math.abs(ally.y - enemy.y);
                if (adx + ady > HEAL_RADIUS) continue;

                // Heal
                const healAmt = ally.maxHealth * (HEAL_PCT / 100);
                if (healAmt > 0 && ally.health < ally.maxHealth) {
                    ally.health = Math.min(ally.maxHealth, ally.health + healAmt);
                    this.updateEnemyHealthBar(ally);
                    // Small purple heal puff — not spammy
                    if (!ally._lastHealPuff || time - ally._lastHealPuff > 300) {
                        ally._lastHealPuff = time;
                        const hg = this.add.graphics().setDepth(3.5);
                        hg.x = ally.sprite.x; hg.y = ally.sprite.y;
                        hg.fillStyle(0xcc44ff, 0.70); hg.fillCircle(0, 0, 5);
                        this.tweens.add({ targets: hg, y: hg.y - 12, alpha: 0, duration: 380, onComplete: () => hg.destroy() });
                    }
                }

                // Toughness buff — reduce incoming damage while active
                if (!ally._absorberBuffUntil || ally._absorberBuffUntil < time) {
                    ally._absorberBuffUntil = time + BUFF_DURATION;
                    ally._absorberToughnessMult = TOUGHNESS_MULT;
                    // Purple tint to show buffed state
                    if (ally.sprite?.active && !ally.isFrozen) ally.sprite.setTint(0xcc88ff);
                    // Toughness shield mark — small shield icon above enemy head
                    if (!ally._toughnessShieldMark) {
                        const sm = this.add.graphics().setDepth(3.2);
                        sm.x = ally.sprite.x; sm.y = ally.sprite.y - 28;
                        // Shield silhouette
                        sm.fillStyle(0xcc44ff, 0.95);
                        sm.fillTriangle(-5, -6, 5, -6, 5, 2);
                        sm.fillTriangle(-5, -6, -5, 2, 5, 2);
                        sm.fillTriangle(-5, 2, 0, 7, 5, 2);
                        // Bright inner highlight
                        sm.fillStyle(0xffffff, 0.40);
                        sm.fillTriangle(-2, -4, 2, -4, 0, 1);
                        sm.lineStyle(1.2, 0xff99ff, 0.90);
                        sm.strokeTriangle(-5, -6, 5, -6, 5, 2);
                        sm.strokeTriangle(-5, -6, -5, 2, 5, 2);
                        sm.strokeTriangle(-5, 2, 0, 7, 5, 2);
                        ally._toughnessShieldMark = sm;
                        this.tweens.add({ targets: sm, alpha: 0.55, duration: 500, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
                    }
                    // Visual: small crown aura
                    if (!ally._absorberBuffAura) {
                        const ba = this.add.graphics().setDepth(1.2);
                        ba.lineStyle(1.5, 0xcc44ff, 0.55); ba.strokeCircle(0, 0, 14);
                        ba.x = ally.sprite.x; ba.y = ally.sprite.y;
                        ally._absorberBuffAura = ba;
                        this.tweens.add({ targets: ba, scaleX: 1.15, scaleY: 1.15, alpha: 0.3, duration: 500, yoyo: true, repeat: -1 });
                    }
                } else {
                    // Refresh timer
                    ally._absorberBuffUntil = time + BUFF_DURATION;
                }
            }
        }

        // ── Expire toughness buffs ───────────────────────────────────────
        for (const ally of this.enemies) {
            if (!ally._absorberBuffUntil || ally._absorberBuffUntil >= time) {
                // Keep aura and shield mark in sync with enemy position
                if (ally._absorberBuffAura)    { ally._absorberBuffAura.x    = ally.sprite.x; ally._absorberBuffAura.y    = ally.sprite.y; }
                if (ally._toughnessShieldMark) { ally._toughnessShieldMark.x = ally.sprite.x; ally._toughnessShieldMark.y = ally.sprite.y - 28; }
                continue;
            }
            // Buff expired — destroy mark and aura
            ally._absorberBuffUntil = 0;
            ally._absorberToughnessMult = 1;
            if (ally._absorberBuffAura) { this.tweens.killTweensOf(ally._absorberBuffAura); ally._absorberBuffAura.destroy(); ally._absorberBuffAura = null; }
            if (ally._toughnessShieldMark) { this.tweens.killTweensOf(ally._toughnessShieldMark); ally._toughnessShieldMark.destroy(); ally._toughnessShieldMark = null; }
            if (ally.sprite?.active && !ally.isFrozen && !ally.isBurning) ally.sprite.clearTint();
        }
    }

    updateBurnEffects(time) {
        for (let enemy of this.enemies) {
            // Track burn stack pips to follow the enemy
            if (enemy._burnStackBar && enemy.sprite?.active) {
                const stacks = enemy._burnStackBar.length;
                const GAP = 5, W = 4;
                const totalW = stacks * W + (stacks - 1) * GAP;
                for (let i = 0; i < stacks; i++) {
                    const pip = enemy._burnStackBar[i];
                    if (!pip?.active) continue;
                    pip.x = enemy.sprite.x - totalW / 2 + i * (W + GAP) + W / 2;
                    pip.y = enemy.sprite.y - 22;
                }
            }

            if (!enemy.isBurning) continue;

            // Expire
            if (time >= enemy.burnUntil) {
                enemy.isBurning = false;
                this.clearBurnVisual(enemy);
                if (enemy.sprite && enemy.sprite.active && !enemy.isFrozen) {
                    enemy.sprite.clearTint();
                }
                continue;
            }

            // Tick damage — iceImmune enemies can't be burned; fireImmune CAN (burn is environmental)
            if (time - enemy.lastBurnTick >= this.burnTickInterval) {
                enemy.lastBurnTick = time;
                if (enemy.iceImmune) continue;
                const tickDmg = this.burnTickDamage * this.damageScaling;
                enemy.health -= tickDmg;
                this.gainUltCharge(this.ultChargePerBurnTick);

                // Floating damage number
                if (enemy.sprite && enemy.sprite.active) {
                    this.showDamageNumber(enemy.sprite.x, enemy.sprite.y, tickDmg, '#ff8800');
                }

                // Flicker tint
                if (enemy.sprite && enemy.sprite.active) {
                    enemy.sprite.setTint(0xffffff);
                    this.time.delayedCall(80, () => {
                        if (enemy.sprite && enemy.sprite.active && enemy.isBurning) {
                            enemy.sprite.setTint(0xff6600);
                        }
                    });
                }

                this.updateEnemyHealthBar(enemy);
                if (enemy.health <= 0) { this.killEnemy(enemy); continue; }
            }

            // Keep flame visual synced to enemy position
            if (enemy.burnVisual && enemy.sprite) {
                enemy.burnVisual.x = enemy.sprite.x;
                enemy.burnVisual.y = enemy.sprite.y - 18;
            }
        }
    }

    showBurnVisual(enemy) {
        this.clearBurnVisual(enemy);

        const x = enemy.sprite.x;
        const y = enemy.sprite.y - 18;

        // Draw a flame: layered circles tapering upward
        const g = this.add.graphics();
        g.fillStyle(0xff2200, 0.9);
        g.fillEllipse(0, 0, 10, 14);   // outer flame body
        g.fillStyle(0xff7700, 1);
        g.fillEllipse(0, -3, 7, 10);   // mid flame
        g.fillStyle(0xffdd00, 1);
        g.fillEllipse(0, -5, 4, 6);    // bright core tip
        g.x = x;
        g.y = y;

        this.tweens.add({
            targets: g,
            scaleX: 1.25, scaleY: 1.2,
            y: y - 3,
            duration: 180,
            yoyo: true, repeat: -1,
            ease: 'Sine.easeInOut'
        });

        enemy.burnVisual = g;
        enemy.burnVisualActive = true;
        enemy.sprite.setTint(0xff6600);
    }

    clearBurnVisual(enemy) {
        if (enemy.burnVisual) {
            this.tweens.killTweensOf(enemy.burnVisual);
            enemy.burnVisual.destroy();
            enemy.burnVisual = null;
        }
        enemy.burnVisualActive = false;
    }

    // ─── LIGHTNING NODE SYSTEM ─────────────────────────────────────────

    // Brittle system removed — stubs kept so GameScene forwarders don't crash
    applyBrittle() {}
    updateBrittleVisual() {}
    updateBrittleDecay() {}

    // ── Universal helper: chill/freeze iceImmune enemies ─────────────────
    // Called by every ice weapon on iceImmune hits — 3 stacks = freeze
    _applyIceElementalChill(enemy) {
        if (!enemy.iceImmune || enemy.fireImmune || enemy.elementImmune) return;
        if (enemy.isFrozen) return;
        const time = this.time.now;
        if (!enemy.chillStacks) enemy.chillStacks = 0;
        enemy.chillStacks = Math.min(3, enemy.chillStacks + 1);
        enemy.lastChillTime = time;
        if (typeof this._updateChillIndicator === 'function') this._updateChillIndicator(enemy);
        if (enemy.sprite?.active) {
            enemy.sprite.setTint(0x88ccff);
            this.time.delayedCall(100, () => { if (enemy.sprite?.active && !enemy.isFrozen) enemy.sprite.clearTint(); });
        }
        if (enemy.chillStacks >= 3) {
            enemy.chillStacks = 0;
            if (typeof this._destroyChillIndicator === 'function') this._destroyChillIndicator(enemy);
            this.freezeEnemy(enemy, 2200);
            this.gainUltCharge(this.ultChargePerFreeze);
        }
    }

    freezeEnemy(enemy, duration) {
        if (enemy.isVoidSniper && enemy._sniperInvisible) return; // invisible — immune to freeze
        if (enemy.health <= 0) {
            // Clear any existing freeze visuals on dead enemies
            if (enemy.freezeVisuals) {
                if (enemy.freezeVisuals._extraLayers) {
                    for (const l of enemy.freezeVisuals._extraLayers) { this.tweens.killTweensOf(l); l.destroy(); }
                }
                if (enemy.freezeVisuals.iceBlock) {
                    this.tweens.killTweensOf(enemy.freezeVisuals.iceBlock);
                    enemy.freezeVisuals.iceBlock.setVisible(false);
                    enemy.freezeVisuals.iceBlock.destroy();
                }
                if (enemy.freezeVisuals.iceBorder) {
                    this.tweens.killTweensOf(enemy.freezeVisuals.iceBorder);
                    enemy.freezeVisuals.iceBorder.setVisible(false);
                    enemy.freezeVisuals.iceBorder.destroy();
                }
                enemy.freezeVisuals = null;
            }
            return;
        }
        // Clear existing freeze visuals if already frozen
        if (enemy.isFrozen && enemy.freezeVisuals) {
            if (enemy.freezeVisuals._extraLayers) {
                for (const l of enemy.freezeVisuals._extraLayers) { this.tweens.killTweensOf(l); l.destroy(); }
            }
            if (enemy.freezeVisuals.iceBlock) {
                this.tweens.killTweensOf(enemy.freezeVisuals.iceBlock);
                enemy.freezeVisuals.iceBlock.setVisible(false);
                enemy.freezeVisuals.iceBlock.destroy();
            }
            if (enemy.freezeVisuals.iceBorder) {
                this.tweens.killTweensOf(enemy.freezeVisuals.iceBorder);
                enemy.freezeVisuals.iceBorder.setVisible(false);
                enemy.freezeVisuals.iceBorder.destroy();
            }
            enemy.freezeVisuals = null;
        }
        enemy.isFrozen = true;
        enemy.frozenUntil = this.time.now + duration;
        enemy.frozenAt = this.time.now;
        enemy._shatterTriggered = false;
        // Cancel any previous thaw timer
        if (enemy._thawTimer) { enemy._thawTimer.remove(); enemy._thawTimer = null; }
        // Auto-thaw: destroy freeze visuals when freeze expires
        enemy._thawTimer = this.time.delayedCall(duration, () => {
            if (!enemy.sprite?.active) return;
            enemy.isFrozen = false;
            enemy.frozenUntil = 0;
            if (enemy.sprite?.active) enemy.sprite.clearTint();
            if (enemy.freezeVisuals) {
                if (enemy.freezeVisuals._extraLayers) {
                    for (const l of enemy.freezeVisuals._extraLayers) { this.tweens.killTweensOf(l); l.destroy(); }
                }
                if (enemy.freezeVisuals.iceBlock)  { this.tweens.killTweensOf(enemy.freezeVisuals.iceBlock);  enemy.freezeVisuals.iceBlock.destroy(); }
                if (enemy.freezeVisuals.iceBorder) { this.tweens.killTweensOf(enemy.freezeVisuals.iceBorder); enemy.freezeVisuals.iceBorder.destroy(); }
                enemy.freezeVisuals = null;
            }
            enemy._thawTimer = null;
        });
        this.createFreezeVisual(enemy);
        if (enemy.sprite && enemy.sprite.active) {
            this.showStatusText(enemy.sprite.x, enemy.sprite.y, 'FROZEN', '#88eeff');
        }
    }

    updateSlowEffect(enemy) {
        // Visual handled by tint; nothing extra needed
    }

    spawnIceSplinter(x, y) {
        const numShards = 6;
        for (let i = 0; i < numShards; i++) {
            const angle = (Math.PI * 2 / numShards) * i + Math.random() * 0.5;
            const dist = 15 + Math.random() * 20;
            const shard = this.add.rectangle(x, y, 4, 10, 0xaaddff, 0.9);
            shard.setRotation(angle);
            this.tweens.add({
                targets: shard,
                x: x + Math.cos(angle) * dist,
                y: y + Math.sin(angle) * dist,
                alpha: 0, scaleX: 0.5, scaleY: 0.5,
                duration: 350 + Math.random() * 150, ease: 'Quad.easeOut',
                onComplete: () => shard.destroy()
            });
        }
        // Freeze flash
        const flash = this.add.circle(x, y, 14, 0xffffff, 0.8);
        this.tweens.add({ targets: flash, radius: 22, alpha: 0, duration: 200, onComplete: () => flash.destroy() });
    }

    // ─── LIGHTNING THUNDERHEAD ─────────────────────────────────────────

    snapToNearestFloor(pixelX, pixelY) {
        const originTX = Math.floor(pixelX / this.TILE_SIZE);
        const originTY = Math.floor(pixelY / this.TILE_SIZE);

        // Already on a floor tile
        if (originTX >= 0 && originTX < this.WORLD_WIDTH &&
            originTY >= 0 && originTY < this.WORLD_HEIGHT &&
            this.world[originTX][originTY] === this.FLOOR) {
            return {
                tx: originTX, ty: originTY,
                px: originTX * this.TILE_SIZE + this.TILE_SIZE / 2,
                py: originTY * this.TILE_SIZE + this.TILE_SIZE / 2
            };
        }

        // Search outward in rings
        for (let r = 1; r <= 5; r++) {
            for (let dx = -r; dx <= r; dx++) {
                for (let dy = -r; dy <= r; dy++) {
                    if (Math.abs(dx) !== r && Math.abs(dy) !== r) continue; // only ring edge
                    const tx = originTX + dx;
                    const ty = originTY + dy;
                    if (tx >= 0 && tx < this.WORLD_WIDTH && ty >= 0 && ty < this.WORLD_HEIGHT && this.world[tx][ty] === this.FLOOR) {
                        return {
                            tx, ty,
                            px: tx * this.TILE_SIZE + this.TILE_SIZE / 2,
                            py: ty * this.TILE_SIZE + this.TILE_SIZE / 2
                        };
                    }
                }
            }
        }
        return null;
    }

    damageEnemyIce(enemy, damage) {
        if (this.isTutorial && enemy.tutorialRoomIndex !== undefined) {
            if (enemy.tutorialRoomIndex !== this.getCurrentPlayerRoom()) return;
        }
        // Fire elementals are immune to all ice damage
        if (enemy.fireImmune) {
            if (enemy.sprite?.active) this.showStatusText(enemy.sprite.x, enemy.sprite.y - 10, 'IMMUNE', '#ff8844');
            return;
        }
        if (enemy.iceImmune) {
            // If already frozen (by pierce spike), shatter immediately on any ice hit
            if (enemy.isFrozen) {
                this._triggerShatterBurst(enemy);
                return;
            }
            // Route through the universal helper — chill stacks toward freeze
            this._applyIceElementalChill(enemy);
            if (damage > 0 && enemy.isFrozen) {
                // Shatter: 2× damage
                const shatterDmg = damage * 2;
                enemy.health -= shatterDmg;
                this.gainUltCharge(this.ultChargePerHit * 2);
                this.showDamageNumber(enemy.sprite.x, enemy.sprite.y, shatterDmg, '#ffffff');
                this.showStatusText(enemy.sprite.x, enemy.sprite.y - 18, 'SHATTER!', '#aaffff');
                enemy.isFrozen = false;
                enemy.frozenUntil = 0;
                if (enemy.freezeVisuals) {
                    if (enemy.freezeVisuals._extraLayers) {
                        for (const l of enemy.freezeVisuals._extraLayers) { this.tweens.killTweensOf(l); l.destroy(); }
                    }
                    if (enemy.freezeVisuals.iceBlock?._extraLayers) {
                        for (const l of enemy.freezeVisuals.iceBlock._extraLayers) { this.tweens.killTweensOf(l); l.destroy(); }
                    }
                    ['iceBlock', 'iceBorder'].forEach(k => {
                        if (enemy.freezeVisuals[k]) { this.tweens.killTweensOf(enemy.freezeVisuals[k]); enemy.freezeVisuals[k].destroy(); }
                    });
                    enemy.freezeVisuals = null;
                }
                enemy.sprite.clearTint();
                this.updateEnemyHealthBar(enemy);
                if (enemy.health <= 0) this.killEnemy(enemy);
            }
            return;
        }

        const frozenBonus = enemy.isFrozen ? 2.5 : 1;
        if (enemy.isFrozen) this._triggerShatterBurst(enemy);
        const actualDamage = damage * frozenBonus;
        enemy.health -= actualDamage;
        this.gainUltCharge(this.ultChargePerHit);

        if (enemy.sprite && enemy.sprite.active) {
            this.showDamageNumber(enemy.sprite.x, enemy.sprite.y, actualDamage, '#88eeff');
        }

        if (enemy.health > 0) {
            const wasSlowed2 = enemy.isSlowed;
            enemy.isSlowed = true;
            enemy.slowedUntil = this.time.now + this.slowDuration;
            if (!wasSlowed2 && enemy.sprite?.active) {
                if (enemy._slowIndTimer) { enemy._slowIndTimer.remove(); }
                enemy._slowIndTimer = this._startSpeedIndicator(
                    () => enemy.sprite?.active ? { x: enemy.sprite.x, y: enemy.sprite.y - 10 } : null,
                    'slow_ice', 320
                );
            }
        }

        if (enemy.health > 0 && Math.random() < 0.1 && !enemy.isFrozen) {
            this.freezeEnemy(enemy, 2000);
            this.gainUltCharge(this.ultChargePerFreeze);
        }

        if (!enemy.isFrozen) {
            enemy.sprite.setTint(0x00ffff);
            this.time.delayedCall(100, () => {
                if (enemy.sprite && enemy.sprite.active && !enemy.isFrozen) {
                    enemy.sprite.clearTint();
                }
            });
        }

        this.updateEnemyHealthBar(enemy);

        if (enemy.health <= 0) {
            this.killEnemy(enemy);
        }
    }

    // ─── SHARED ICE WEAPON CHILL/FREEZE/SHATTER LOGIC ────────────────────
    // Called by every ice weapon hit. Handles fire-immune guard, shatter on
    // frozen enemies, chill stack accumulation, chip damage, and freeze at
    // 3 stacks. Each weapon passes its own damage value — no fists coupling.
    applyChillStack(enemy, damage) {
        // Tutorial room gating
        if (this.isTutorial && enemy.tutorialRoomIndex !== undefined) {
            if (enemy.tutorialRoomIndex !== this.getCurrentPlayerRoom()) return;
        }

        // Invisible void snipers are immune to chill/freeze
        if (enemy.isVoidSniper && enemy._sniperInvisible) return;

        // Fire-immune enemies are immune to ALL ice weapons
        if (enemy.fireImmune) {
            if (enemy.sprite?.active) this.showStatusText(enemy.sprite.x, enemy.sprite.y - 10, 'IMMUNE', '#ff8844');
            return;
        }

        // Already frozen → shatter (check before iceImmune so frozen ice elementals shatter)
        if (enemy.isFrozen) {
            this._triggerShatterBurst(enemy);
            return;
        }

        // Chip damage (weapon passes its own value; ice-immune enemies take none
        // until shatter, so skip raw damage for them)
        if (!enemy.iceImmune) {
            enemy.health -= damage;
            this.showDamageNumber(enemy.sprite.x, enemy.sprite.y - 10, damage, '#88eeff');
            this.updateEnemyHealthBar(enemy);
            this.gainUltCharge(this.ultChargePerHit);
            if (enemy.health <= 0) {
                this._destroyChillIndicator(enemy);
                this.killEnemy(enemy);
                return;
            }
        }

        // Tint flash
        if (enemy.sprite?.active) {
            enemy.sprite.setTint(0x88ccff);
            this.time.delayedCall(100, () => { if (enemy.sprite?.active) enemy.sprite.clearTint(); });
        }

        // Accumulate chill stack
        if (!enemy.chillStacks) enemy.chillStacks = 0;
        enemy.chillStacks++;
        enemy.lastChillTime = this.time.now;
        this._updateChillIndicator(enemy);

        // 3 stacks → freeze for 10s
        if (enemy.chillStacks >= 3) {
            enemy.chillStacks = 0;
            enemy.frozenAt = this.time.now;
            this._destroyChillIndicator(enemy);
            this.freezeEnemy(enemy, 10000);
            this.gainUltCharge(this.ultChargePerFreeze);
            // Schedule water tile on natural melt
            enemy._freezeMeltTimer = this.time.delayedCall(10000, () => {
                if (enemy.sprite?.active) this._shatterWaterSplash(enemy.x, enemy.y);
            });
        }
    }

    createFreezeVisual(enemy) {
        const bx = enemy.sprite.x;
        const blockY = enemy.sprite.y + 10;
        const sz = this.TILE_SIZE * 0.82;
        const depth = (enemy.sprite.depth || 1) + 0.5;

        // Layer 1 — deep ice base, slightly transparent
        const iceBlock = this.add.rectangle(bx, blockY, sz, sz, 0x336699, 0.72).setDepth(depth);

        // Layer 2 — border outline
        const iceBorder = this.add.graphics().setDepth(depth + 0.1);
        iceBorder.lineStyle(2, 0xaaddff, 0.90);
        iceBorder.strokeRect(-sz / 2, -sz / 2, sz, sz);
        iceBorder.x = bx; iceBorder.y = blockY;

        // Layer 3 — inner bright face (top-left highlight)
        const highlight = this.add.graphics().setDepth(depth + 0.2);
        highlight.fillStyle(0xddf4ff, 0.38);
        highlight.fillRect(-sz / 2 + 3, -sz / 2 + 3, sz * 0.48, sz * 0.48);
        highlight.x = bx; highlight.y = blockY;

        // Layer 4 — gloss streaks
        const gloss = this.add.graphics().setDepth(depth + 0.3);
        gloss.lineStyle(2.5, 0xffffff, 0.55);
        gloss.beginPath();
        gloss.moveTo(-sz * 0.28, -sz * 0.30);
        gloss.lineTo(sz * 0.05, -sz * 0.02);
        gloss.strokePath();
        gloss.lineStyle(1.2, 0xffffff, 0.30);
        gloss.beginPath();
        gloss.moveTo(-sz * 0.18, -sz * 0.36);
        gloss.lineTo(sz * 0.14, -sz * 0.08);
        gloss.strokePath();
        gloss.x = bx; gloss.y = blockY;

        // Layer 5 — bright corner dot
        const dot = this.add.graphics().setDepth(depth + 0.4);
        dot.fillStyle(0xffffff, 0.90);
        dot.fillCircle(-sz * 0.26, -sz * 0.26, 2.5);
        dot.x = bx; dot.y = blockY;

        // Pulse all layers together
        const allLayers = [iceBlock, iceBorder, highlight, gloss, dot];
        this.tweens.add({
            targets: allLayers,
            alpha: { from: 0.85, to: 0.55 },
            duration: 550,
            yoyo: true,
            repeat: -1,
            ease: 'Sine.easeInOut'
        });

        if (enemy.sprite?.active && typeof enemy.sprite.setTint === 'function') {
            enemy.sprite.setTint(0x88ccff);
        }

        // Store extras on iceBlock for cleanup (iceBlock/iceBorder already handled elsewhere)
        iceBlock._extraLayers = [highlight, gloss, dot];

        enemy.freezeVisuals = {
            iceBlock,
            iceBorder,
            _extraLayers: [highlight, gloss, dot]
        };
    }

    showShieldBlock(blockedAmount) {
        const shield = this.add.circle(
            this.player.x,
            this.player.y - 20,
            12,
            0x00ccff,
            0.8
        );

        const shieldBorder = this.add.circle(
            this.player.x,
            this.player.y - 20,
            12
        );
        shieldBorder.setStrokeStyle(3, 0xffffff, 1);

        const blockText = this.add.text(
            this.player.x,
            this.player.y - 20,
            `-${blockedAmount.toFixed(1)}`,
            {
                fontSize: '14px',
                fontFamily: 'monospace',
                color: '#ffffff',
                stroke: '#00ccff',
                strokeThickness: 3,
                fontStyle: 'bold'
            }
        ).setOrigin(0.5);

        this.tweens.add({
            targets: [shield, shieldBorder, blockText],
            y: this.player.y - 40,
            scaleX: 1.5,
            scaleY: 1.5,
            alpha: 0,
            duration: 800,
            ease: 'Quad.easeOut',
            onComplete: () => {
                shield.destroy();
                shieldBorder.destroy();
                blockText.destroy();
            }
        });
    }

    fireballSplash(pixelX, pixelY, directDamage, directEnemy) {
        const splashDamage = directDamage * this.fireballSplashDamageRatio;
        const splashTileX = Math.floor(pixelX / this.TILE_SIZE);
        const splashTileY = Math.floor(pixelY / this.TILE_SIZE);

        for (let enemy of this.enemies) {
            if (enemy === directEnemy) continue;
            const dist = Math.abs(enemy.x - splashTileX) + Math.abs(enemy.y - splashTileY);
            if (dist <= this.fireballSplashRadius) {
                // Fire elementals are immune to physical/fire hits — fireball splash is fire damage
                if (enemy.fireImmune) {
                    if (enemy.sprite?.active) this.showStatusText(enemy.sprite.x, enemy.sprite.y - 10, 'IMMUNE', '#ff8844');
                    continue;
                }
                // Ice elementals are immune to all physical damage — fireball splash cannot hurt them
                if (enemy.iceImmune) {
                    if (enemy.sprite?.active) this.showStatusText(enemy.sprite.x, enemy.sprite.y - 10, 'IMMUNE', '#88eeff');
                    continue;
                }
                enemy.health -= splashDamage;
                // Use new burn stack system if magma staff, skip old isBurning entirely
                if ((this.equippedWeapons?.fire || 'flame_fists') === 'magma_staff') {
                    if (typeof this.applyBurnStack === 'function') this.applyBurnStack(enemy);
                } else {
                    // Non-staff fire weapons: old burn visual only
                    enemy.isBurning = true;
                    enemy.burnUntil = this.time.now + this.burnDuration;
                    if (!enemy.burnVisualActive) this.showBurnVisual(enemy);
                }
                this.updateEnemyHealthBar(enemy);
                if (enemy.health <= 0) this.killEnemy(enemy);
            }
        }

        // Splash visual ring
        const ring = this.add.circle(pixelX, pixelY, 4, 0xff6600, 0.6);
        ring.setStrokeStyle(2, 0xffaa00, 0.8);
        this.tweens.add({
            targets: ring,
            radius: this.fireballSplashRadius * this.TILE_SIZE,
            alpha: 0,
            duration: 250,
            ease: 'Quad.easeOut',
            onComplete: () => ring.destroy()
        });
    }

    triggerCombustion(enemy, isUlt) {
        if (!enemy.sprite || !enemy.sprite.active) return;

        // Ice elementals are fully immune to combustion (all physical/fire damage)
        if (enemy.iceImmune) {
            this.showStatusText(enemy.sprite.x, enemy.sprite.y - 10, 'IMMUNE', '#88eeff');
            return;
        }

        enemy.combustionTriggered = true;

        // Fire elementals are immune to the burst damage itself, but the lava ring
        // created below will still deal environmental fire damage to them
        if (enemy.fireImmune) {
            this.showStatusText(enemy.sprite.x, enemy.sprite.y - 10, 'IMMUNE', '#ff8844');
            // Still create the lava explosion ring — fire-immune enemies can still be hurt by lava
            const cx = enemy.sprite.x, cy = enemy.sprite.y;
            this.ignitionExplodeEnemy(enemy);
            const ring = this.add.circle(cx, cy, 12, 0xff8800, 0);
            ring.setStrokeStyle(3, 0xffcc00, 0.9).setDepth(3);
            this.tweens.add({ targets: ring, radius: 2 * this.TILE_SIZE + 8, alpha: 0, duration: 300, ease: 'Quad.easeOut', onComplete: () => ring.destroy() });
            enemy.combustionTriggered = false;
            return;
        }

        // Burst damage: flat amount scaled by ult bonus
        const burstDamage = (isUlt ? 30 : 15) * this.damageScaling;
        enemy.health -= burstDamage;
        enemy.isBurning = false;
        enemy.burnUntil = 0;
        this.clearBurnVisual(enemy);
        if (enemy.sprite && enemy.sprite.active) enemy.sprite.clearTint();

        const cx = enemy.sprite.x;
        const cy = enemy.sprite.y;

        // Central explosion core
        const core = this.add.circle(cx, cy, 6, 0xffffff, 1);
        const mid = this.add.circle(cx, cy, 12, 0xff6600, 0.85);
        const outer = this.add.circle(cx, cy, 18, 0xff2200, 0.55);
        const glow = this.add.circle(cx, cy, 30, 0xffaa00, 0.3);

        this.tweens.add({ targets: core,  radius: 24, alpha: 0, duration: 300, ease: 'Quad.easeOut', onComplete: () => core.destroy() });
        this.tweens.add({ targets: mid,   radius: 40, alpha: 0, duration: 400, ease: 'Quad.easeOut', onComplete: () => mid.destroy() });
        this.tweens.add({ targets: outer, radius: 55, alpha: 0, duration: 500, ease: 'Quad.easeOut', onComplete: () => outer.destroy() });
        this.tweens.add({ targets: glow,  radius: 70, alpha: 0, duration: 600, ease: 'Quad.easeOut', onComplete: () => glow.destroy() });

        // Ember particles
        for (let i = 0; i < 10; i++) {
            const angle = Math.random() * Math.PI * 2;
            const spd = 40 + Math.random() * 60;
            const ember = this.add.circle(cx, cy, 2 + Math.random() * 2, 0xff6600, 1);
            this.tweens.add({
                targets: ember,
                x: cx + Math.cos(angle) * spd,
                y: cy + Math.sin(angle) * spd,
                alpha: 0, duration: 400 + Math.random() * 200,
                ease: 'Quad.easeOut', onComplete: () => ember.destroy()
            });
        }

        // Damage number pop
        const txt = this.add.text(cx, cy - 20, `COMBUSTION!\n${burstDamage.toFixed(0)}`, {
            fontSize: '13px', fontFamily: 'monospace', color: '#ffaa00',
            stroke: '#000', strokeThickness: 3, fontStyle: 'bold', align: 'center'
        }).setOrigin(0.5);
        this.tweens.add({ targets: txt, y: cy - 50, alpha: 0, duration: 900, ease: 'Quad.easeOut', onComplete: () => txt.destroy() });

        this.updateEnemyHealthBar(enemy);
        if (enemy.health <= 0) this.killEnemy(enemy);
        else { enemy.combustionTriggered = false; }
    }

    spawnIgnitionTrail(x, y, duration = null) {
        const tileX = Math.floor(x / this.TILE_SIZE);
        const tileY = Math.floor(y / this.TILE_SIZE);
        const tilePixelX = tileX * this.TILE_SIZE + this.TILE_SIZE / 2;
        const tilePixelY = tileY * this.TILE_SIZE + this.TILE_SIZE / 2;

        // If tile already exists, upgrade duration if the new one is longer (e.g. explosion over ripple)
        const existing = this.ignitionPierceTrails.find(t => t.tileX === tileX && t.tileY === tileY);
        if (existing) {
            const newDur = duration ?? this.ignitionTrailDuration;
            const existingDur = existing.customDuration ?? this.ignitionTrailDuration;
            const timeLeft = existingDur - (this.time.now - existing.createdAt);
            if (newDur > timeLeft) {
                existing.createdAt = this.time.now;
                existing.customDuration = newDur;
            }
            return;
        }

        // Lava tile: base orange rectangle covering the tile, with a shimmering inner glow
        const base = this.add.rectangle(tilePixelX, tilePixelY, this.TILE_SIZE, this.TILE_SIZE, 0xcc2200, 0.85).setDepth(0.5);
        const glow = this.add.rectangle(tilePixelX, tilePixelY, this.TILE_SIZE - 4, this.TILE_SIZE - 4, 0xff6600, 0.6).setDepth(0.5);
        const core = this.add.rectangle(tilePixelX, tilePixelY, this.TILE_SIZE - 10, this.TILE_SIZE - 10, 0xffaa00, 0.4).setDepth(0.5);

        // Shimmer animation on the inner layers
        this.tweens.add({ targets: glow, alpha: 0.9, duration: 180, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
        this.tweens.add({ targets: core, alpha: 0.7, scaleX: 0.85, scaleY: 0.85, duration: 130, yoyo: true, repeat: -1, ease: 'Sine.easeInOut', delay: 60 });

        this.ignitionPierceTrails.push({
            visuals: [base, glow, core],
            createdAt: this.time.now,
            lastDamageTick: 0,
            tileX, tileY, x: tilePixelX, y: tilePixelY,
            customDuration: duration
        });
    }

    updateIgnitionTrails(time) {
        for (let i = this.ignitionPierceTrails.length - 1; i >= 0; i--) {
            const t = this.ignitionPierceTrails[i];
            const age = time - t.createdAt;

            const trailDur = t.customDuration ?? this.ignitionTrailDuration;
            if (age > trailDur) {
                for (const v of t.visuals) { this.tweens.killTweensOf(v); v.destroy(); }
                this.ignitionPierceTrails.splice(i, 1);
                continue;
            }

            // Fade out in the last 400ms
            if (age > trailDur - 400) {
                const fadeAlpha = 1 - (age - (trailDur - 400)) / 400;
                for (const v of t.visuals) v.setAlpha(v.alpha * fadeAlpha);
            }

            // Fast continuous lava damage — every 80ms
            if (time - t.lastDamageTick >= 80) {
                t.lastDamageTick = time;
                for (let enemy of this.enemies) {
                    if (enemy.x === t.tileX && enemy.y === t.tileY) {
                        // Ice immune enemies take no lava damage; fire immune CAN be hurt by lava
                        if (enemy.iceImmune) continue;
                        // Don't damage enemies in rooms the player isn't in (tutorial AND level 2)
                        if ((this.isTutorial || this.isLevel2 || this.isLevel3) && enemy.tutorialRoomIndex !== undefined &&
                            enemy.tutorialRoomIndex !== this.getCurrentPlayerRoom()) continue;
                        const dmg = 0.8 * this.damageScaling * (enemy._purpleMarked ? 2.0 : 1);
                        enemy.health -= dmg;
                        this.gainUltCharge(this.ultChargePerBurnTick);
                        this.showDamageNumber(enemy.sprite.x, enemy.sprite.y - 8, dmg, '#ff6600');
                        this.updateEnemyHealthBar(enemy);
                        if (enemy.health <= 0) { this.killEnemy(enemy); continue; }
                        // Lava applies 1 burn stack every 2 seconds
                        if (!enemy._lastLavaBurnStack || time - enemy._lastLavaBurnStack >= 2000) {
                            enemy._lastLavaBurnStack = time;
                            if (typeof this.applyBurnStack === 'function') this.applyBurnStack(enemy);
                        }
                    }
                }
                // Lava also damages boss — cap to one tile per 80ms window using a shared cooldown
                const _lavaTime = time;
                if (!this._lavaBossLastTick || _lavaTime - this._lavaBossLastTick >= 80) {
                    if (this.damageBossAtTile(t.tileX, t.tileY, 0.8 * this.damageScaling)) {
                        this._lavaBossLastTick = _lavaTime; // lock out all other lava tiles this tick
                    }
                }
                // Lava applies burn stack to boss every 2 seconds — one application regardless of tile count
                if (this.voltslimeBoss?.active) {
                    const boss = this.voltslimeBoss;
                    const bTileX = Math.floor(boss.container.x / this.TILE_SIZE);
                    const bTileY = Math.floor(boss.container.y / this.TILE_SIZE);
                    if (Math.abs(bTileX - t.tileX) <= 1 && Math.abs(bTileY - t.tileY) <= 1) {
                        if (!boss._lastLavaBurnStack || time - boss._lastLavaBurnStack >= 2000) {
                            boss._lastLavaBurnStack = time;
                            if (typeof this.applyBurnStackBoss === 'function') this.applyBurnStackBoss();
                        }
                    }
                }
                if (this.voidSovereignBoss?.active) {
                    const vs = this.voidSovereignBoss;
                    if (!vs._lastLavaBurnStack || time - vs._lastLavaBurnStack >= 2000) {
                        if (Math.abs(vs.tileX - t.tileX) <= 2 && Math.abs(vs.tileY - t.tileY) <= 2) {
                            vs._lastLavaBurnStack = time;
                            if (typeof this.applyBurnStackBoss === 'function') this.applyBurnStackBoss();
                        }
                    }
                }
            }
        }
    }

    // ─── ICE HELPERS ──────────────────────────────────────────────────

    ignitionExplodeEnemy(enemy) {
        if (!enemy.sprite || !enemy.sprite.active) return;
        const ex = enemy.sprite.x, ey = enemy.sprite.y;
        const radius = 2; // tiles

        // Spawn lava tiles in a circle around the enemy
        for (let dx = -radius; dx <= radius; dx++) {
            for (let dy = -radius; dy <= radius; dy++) {
                if (dx * dx + dy * dy > radius * radius) continue;
                const tx = enemy.x + dx, ty = enemy.y + dy;
                if (tx < 0 || tx >= this.WORLD_WIDTH || ty < 0 || ty >= this.WORLD_HEIGHT) continue;
                if (this.world[tx][ty] !== this.FLOOR) continue;
                this.spawnIgnitionTrail(
                    tx * this.TILE_SIZE + this.TILE_SIZE / 2,
                    ty * this.TILE_SIZE + this.TILE_SIZE / 2
                );
            }
        }

        // Explosion visual
        const explode = this.add.circle(ex, ey, 8, 0xff4400, 0.9).setDepth(3);
        this.tweens.add({ targets: explode, radius: radius * this.TILE_SIZE, alpha: 0, duration: 350, ease: 'Quad.easeOut', onComplete: () => explode.destroy() });
        const ring = this.add.circle(ex, ey, 12, 0xff8800, 0);
        ring.setStrokeStyle(3, 0xffcc00, 0.9).setDepth(3);
        this.tweens.add({ targets: ring, radius: radius * this.TILE_SIZE + 8, alpha: 0, duration: 300, ease: 'Quad.easeOut', onComplete: () => ring.destroy() });
    }

}