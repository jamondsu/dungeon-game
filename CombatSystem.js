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

        // Blocks all DIRECT damage
        // Environmental/indirect sources bypass this function entirely:
        //   fireImmune: hurt by lava tiles and burn DoT (not direct fire spells)
        //   iceImmune:  hurt only by shatter (damageEnemyIce when frozen)
        //   lightningImmune (future): hurt only by conductor node zaps
        if (enemy.fireImmune || enemy.iceImmune) {
            if (enemy.sprite && enemy.sprite.active) {
                this.showStatusText(enemy.sprite.x, enemy.sprite.y - 10, 'IMMUNE', '#88aaff');
            }
            // Trigger Glerp's ice tutorial explanation on any non-ice damage attempt vs ice-immune
            if (enemy.iceImmune && this.isIceTutorial) {
                this._triggerIceImmuneGlerpReaction();
            }
            return;
        }

        // Apply brittle damage bonus: fixed 1.5x if any brittle stacks
        const brittleBonus = enemy.brittleStacks > 0 ? 1.5 : 1;
        const tsunamiBonus = this.tsunamiFrozenEnemies.includes(enemy) ? this.tsunamiFreezeMultiplier : 1;
        // Frozen enemies take 2.5× damage from any hit — triggers shatter burst visuals
        const frozenBonus = enemy.isFrozen ? 2.5 : 1;
        if (enemy.isFrozen) this._triggerShatterBurst(enemy);
        const actualDamage = damage * brittleBonus * tsunamiBonus * frozenBonus;
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
            const wasAlreadyBurning = enemy.isBurning;
            enemy.isBurning = true;
            enemy.burnUntil = this.time.now + this.burnDuration;
            if (!enemy.burnVisualActive) this.showBurnVisual(enemy);
            if (!wasAlreadyBurning && enemy.sprite && enemy.sprite.active) {
                this.showStatusText(enemy.sprite.x, enemy.sprite.y, 'BURNING', '#ff8800');
            }
        }

        if (this.currentElement === 'ice' && enemy.health > 0) {
            this.applyBrittle(enemy, 1);
            const wasAlreadySlowed = enemy.isSlowed;
            enemy.isSlowed = true;
            enemy.slowedUntil = this.time.now + this.slowDuration;
            if (!wasAlreadySlowed && enemy.sprite && enemy.sprite.active) {
                this.showStatusText(enemy.sprite.x, enemy.sprite.y, 'SLOWED', '#44ccff');
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
                } else if (enemy.isBurning) {
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
            if (enemy.sprite) enemy.sprite.destroy();
            const idx = this.enemies.indexOf(enemy);
            if (idx !== -1) this.enemies.splice(idx, 1);
            return;
        }
        // Tutorial: give bonus ult charge per kill so player sees the bar fill
        if (this.isTutorial) {
            this.gainUltCharge(20);
        }
        // Clean up shield mark if present
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
        // Clean up ranged enemy visuals
        this._destroyPrefireBeam(enemy);
        // Cancel scheduled natural-melt water tile if enemy dies before it fires
        if (enemy._freezeMeltTimer) { enemy._freezeMeltTimer.remove(); enemy._freezeMeltTimer = null; }
        this._destroyChillIndicator(enemy);
        if (enemy._rangedMark && enemy._rangedMark.active) {
            this.tweens.killTweensOf(enemy._rangedMark);
            enemy._rangedMark.destroy();
        }
        // COSMIC: 50% chance to drop charge
        if (this.currentElement === 'cosmic' && Math.random() < this.cosmicDropChance) {
            this.addCosmicCharge(enemy.sprite.x, enemy.sprite.y);
        }
        // 10% chance to drop an orb scrap
        if (this.currentElement === 'lightning' && Math.random() < this.orbDropChance && enemy.sprite) {
            this.spawnOrbScrap(enemy.sprite.x, enemy.sprite.y);
        }
        // Small chance to drop glorps or health pot
        this.tryDropFromEnemy(enemy);

        if (enemy.sprite) enemy.sprite.destroy();
        if (enemy.healthBarBg) enemy.healthBarBg.destroy();
        if (enemy.healthBarFill) enemy.healthBarFill.destroy();
        this.clearBurnVisual(enemy);

        if (enemy.freezeVisuals) {
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
            if (enemy.freezeVisuals.multiplierText) {
                this.tweens.killTweensOf(enemy.freezeVisuals.multiplierText);
                enemy.freezeVisuals.multiplierText.setVisible(false);
                enemy.freezeVisuals.multiplierText.destroy();
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
    damageBossAtTile(tileX, tileY, damage) {
        if (!this.voltslimeBoss?.active) return false;
        const boss = this.voltslimeBoss;
        if (Math.abs(tileX - boss.tileX) <= 1 && Math.abs(tileY - boss.tileY) <= 1) {
            this.damageVoltslimeBoss(damage);
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
        const blockingState =
            this.thunderheadActive ? 'THUNDERHEAD ACTIVE' :
            this.tsunamiActive     ? 'TSUNAMI ACTIVE' :
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
        for (let p of this.lightningProjectiles) { if (p.g.active) p.g.destroy(); }
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

    updateBurnEffects(time) {
        for (let enemy of this.enemies) {
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

    applyBrittle(enemy, stacks) {
        if (!enemy.sprite || !enemy.sprite.active || enemy.health <= 0) return;
        enemy.brittleStacks = Math.min(this.brittleMaxStacks, (enemy.brittleStacks || 0) + stacks);
        enemy.lastBrittleHitTime = this.time.now;
        this.updateBrittleVisual(enemy);
        this.showStatusText(enemy.sprite.x, enemy.sprite.y, `BRITTLE x${enemy.brittleStacks}`, '#aaddff');
    }

    updateBrittleVisual(enemy) {
        if (enemy.brittleVisual) { enemy.brittleVisual.destroy(); enemy.brittleVisual = null; }
        if (!enemy.brittleStacks || enemy.brittleStacks === 0) return;
        // Don't create a visual for a dead/removed enemy — it will orphan on screen
        if (!enemy.sprite || !enemy.sprite.active) return;

        const pct = enemy.brittleStacks / this.brittleMaxStacks;
        const alpha = 0.3 + pct * 0.5;
        const bv = this.add.text(enemy.sprite.x, enemy.sprite.y + 14, '* '.repeat(enemy.brittleStacks).trim(), {
            fontSize: '8px', color: '#88ddff', stroke: '#000', strokeThickness: 2
        }).setOrigin(0.5).setAlpha(alpha).setDepth(5);
        enemy.brittleVisual = bv;
    }

    updateBrittleDecay(time) {
        for (let enemy of this.enemies) {
            if (!enemy.brittleStacks || enemy.brittleStacks === 0) continue;
            if (!enemy.sprite || !enemy.sprite.active) {
                if (enemy.brittleVisual) {
                    this.tweens.killTweensOf(enemy.brittleVisual);
                    enemy.brittleVisual.destroy();
                    enemy.brittleVisual = null;
                }
                enemy.brittleStacks = 0;
                continue;
            }
            if (time - enemy.lastBrittleHitTime > this.brittleDecayTime) {
                enemy.brittleStacks = 0;
                this.updateBrittleVisual(enemy);
            }
            // Keep visual in sync with enemy position
            if (enemy.brittleVisual) {
                enemy.brittleVisual.x = enemy.sprite.x;
                enemy.brittleVisual.y = enemy.sprite.y + 14;
            }
        }
    }

    freezeEnemy(enemy, duration) {
        if (enemy.health <= 0) {
            // Clear any existing freeze visuals on dead enemies
            if (enemy.freezeVisuals) {
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
                if (enemy.freezeVisuals.multiplierText) {
                    this.tweens.killTweensOf(enemy.freezeVisuals.multiplierText);
                    enemy.freezeVisuals.multiplierText.setVisible(false);
                    enemy.freezeVisuals.multiplierText.destroy();
                }
                enemy.freezeVisuals = null;
            }
            return;
        }
        // Clear existing freeze visuals if already frozen
        if (enemy.isFrozen && enemy.freezeVisuals) {
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
            if (enemy.freezeVisuals.multiplierText) {
                this.tweens.killTweensOf(enemy.freezeVisuals.multiplierText);
                enemy.freezeVisuals.multiplierText.setVisible(false);
                enemy.freezeVisuals.multiplierText.destroy();
            }
            enemy.freezeVisuals = null;
        }
        enemy.isFrozen = true;
        enemy.frozenUntil = this.time.now + duration;
        enemy.frozenAt = this.time.now; // used by ice fists shatter window
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
        // In tutorial: enemies in other rooms are untouchable
        if (this.isTutorial && enemy.tutorialRoomIndex !== undefined) {
            if (enemy.tutorialRoomIndex !== this.getCurrentPlayerRoom()) return;
        }
        if (enemy.iceImmune) {
            this.applyBrittle(enemy, 1);
            enemy.isSlowed = true;
            enemy.slowedUntil = this.time.now + this.slowDuration;
            if (enemy.isFrozen) {
                // Shatter: 2× damage, consume freeze
                const shatterDmg = damage * 2 * (1 + (enemy.brittleStacks || 0) * this.brittlePerStack);
                enemy.health -= shatterDmg;
                this.gainUltCharge(this.ultChargePerHit * 2);
                this.showDamageNumber(enemy.sprite.x, enemy.sprite.y, shatterDmg, '#ffffff');
                this.showStatusText(enemy.sprite.x, enemy.sprite.y - 18, 'SHATTER!', '#aaffff');
                // End freeze early on shatter
                enemy.isFrozen = false;
                enemy.frozenUntil = 0;
                if (enemy.freezeVisuals) {
                    ['iceBlock', 'iceBorder', 'multiplierText'].forEach(k => {
                        if (enemy.freezeVisuals[k]) { this.tweens.killTweensOf(enemy.freezeVisuals[k]); enemy.freezeVisuals[k].destroy(); }
                    });
                    enemy.freezeVisuals = null;
                }
                enemy.sprite.clearTint();
            } else {
                // No direct damage — show a partial crack visual
                this.showStatusText(enemy.sprite.x, enemy.sprite.y - 10, 'CRACK', '#88eeff');
                if (Math.random() < 0.18 && !enemy.isFrozen) {
                    this.freezeEnemy(enemy, 2200);
                    this.gainUltCharge(this.ultChargePerFreeze);
                }
                // Tint flash
                enemy.sprite.setTint(0x00ffff);
                this.time.delayedCall(100, () => {
                    if (enemy.sprite && enemy.sprite.active && !enemy.isFrozen) enemy.sprite.clearTint();
                });
            }
            this.updateEnemyHealthBar(enemy);
            if (enemy.health <= 0) this.killEnemy(enemy);
            return;
        }

        const brittleBonus = enemy.brittleStacks ? (1 + enemy.brittleStacks * this.brittlePerStack) : 1;
        // Frozen enemies take 2.5× — triggers shatter burst visuals
        const frozenBonus = enemy.isFrozen ? 2.5 : 1;
        if (enemy.isFrozen) this._triggerShatterBurst(enemy);
        const actualDamage = damage * frozenBonus * brittleBonus;
        enemy.health -= actualDamage;
        this.gainUltCharge(this.ultChargePerHit);

        if (enemy.sprite && enemy.sprite.active) {
            this.showDamageNumber(enemy.sprite.x, enemy.sprite.y, actualDamage, '#88eeff');
        }

        if (enemy.health > 0) {
            this.applyBrittle(enemy, 1);
            enemy.isSlowed = true;
            enemy.slowedUntil = this.time.now + this.slowDuration;
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

    createFreezeVisual(enemy) {
        const blockY = enemy.sprite.y + 10;

        const iceBlock = this.add.rectangle(
            enemy.sprite.x,
            blockY,
            this.TILE_SIZE * 0.8,
            this.TILE_SIZE * 0.8,
            0x88ccff,
            0.6
        );

        const iceBorder = this.add.rectangle(
            enemy.sprite.x,
            blockY,
            this.TILE_SIZE * 0.8,
            this.TILE_SIZE * 0.8
        );
        iceBorder.setStrokeStyle(2, 0xffffff, 0.8);

        const multiplierText = this.add.text(
            enemy.sprite.x,
            blockY - 16,
            '1.5x',
            {
                fontSize: '16px',
                fontFamily: 'monospace',
                color: '#ffffff',
                stroke: '#00ccff',
                strokeThickness: 2
            }
        ).setOrigin(0.5);

        this.tweens.add({
            targets: multiplierText,
            scaleX: 1.3,
            scaleY: 1.3,
            duration: 300,
            yoyo: true,
            repeat: -1,
            ease: 'Sine.easeInOut'
        });

        this.tweens.add({
            targets: [iceBlock, iceBorder],
            alpha: 0.8,
            duration: 500,
            yoyo: true,
            repeat: -1,
            ease: 'Sine.easeInOut'
        });

        enemy.sprite.setTint(0x88ccff);

        enemy.freezeVisuals = {
            iceBlock: iceBlock,
            iceBorder: iceBorder,
            multiplierText: multiplierText
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
                enemy.health -= splashDamage;
                enemy.isBurning = true;
                enemy.burnUntil = this.time.now + this.burnDuration;
                if (!enemy.burnVisualActive) this.showBurnVisual(enemy);
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
        enemy.combustionTriggered = true;

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
                        // Don't damage enemies in rooms the player isn't in
                        if (this.isTutorial && enemy.tutorialRoomIndex !== undefined &&
                            enemy.tutorialRoomIndex !== this.getCurrentPlayerRoom()) continue;
                        const dmg = 0.8 * this.damageScaling;
                        enemy.health -= dmg;
                        this.showDamageNumber(enemy.sprite.x, enemy.sprite.y - 8, dmg, '#ff6600');
                        this.updateEnemyHealthBar(enemy);
                        if (enemy.health <= 0) this.killEnemy(enemy);
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