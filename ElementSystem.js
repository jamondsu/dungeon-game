// ═══════════════════════════════════════════════════════════════════════
// ELEMENTSYSTEM.JS — All four element ultimates and active abilities
// ═══════════════════════════════════════════════════════════════════════
// All methods receive GameScene as `this` via .call(scene, ...) from GameScene.js
// Do NOT add local state here — all state lives on the scene object.

class ElementSystem {

    activateUlt() {
        // Check for ult inhibitors nearby
        if (this.enemies) {
            for (const enemy of this.enemies) {
                if (!enemy.ultInhibitor) continue;
                const dist = Math.abs(enemy.x - this.playerX) + Math.abs(enemy.y - this.playerY);
                if (dist <= (enemy.ultInhibitRadius || 3)) {
                    this.showStatusText(
                        this.player.x, this.player.y - 20,
                        'ULT BLOCKED!', '#ff2200'
                    );
                    // Flash ult bar red
                    if (this.ultBarFill) {
                        this.cameras.main.shake(80, 0.005);
                    }
                    return;
                }
            }
        }

        // Cosmic uses its own battery charge system
        if (this.currentElement === 'cosmic') {
            if (this.cosmicBatteryCharges < 10) {
                return;
            }
            this.cosmicBatteryCharges -= 5;
            this.updateHUD();
            this.activateCosmicBlackHole();
            return;
        }

        if (this.ultCharge < this.ultChargeMax) {
            return;
        }

        this.ultCharge = 0;
        this.updateHUD();

        if (this.currentElement === 'fire') {
            this.activateFireScorch();
        } else if (this.currentElement === 'ice') {
            this.activateIceBlizzard();
        } else if (this.currentElement === 'lightning') {
            // Mark lightning ult as used (level 2 boss room gate)
            if (this.isLightningTutorial) this._lightningUltUsed = true;
            this.activateLightningStorm();
        } else if (this.currentElement === 'cosmic') {
            this.activateCosmicBlackHole();
        }
    }

    activateFireScorch() {
        this.ultDrainActive = true;
        this.ultDrainStartTime = this.time.now;
        this.ultDrainDuration = this.ignitionDuration;
        this.ignitionActive = true;
        this.ignitionEndTime = this.time.now + this.ignitionDuration;

        // Combustion burst — burning enemies explode in lava rings
        for (let enemy of [...this.enemies]) {
            if (enemy.isBurning) {
                this.ignitionExplodeEnemy(enemy);
                this.triggerCombustion(enemy, true);
            }
        }

        // Screen flash
        const flash = this.add.rectangle(this.scale.width/2, this.scale.height/2, this.scale.width, this.scale.height, 0xff3300, 0.5).setScrollFactor(0);
        this.tweens.add({ targets: flash, alpha: 0, duration: 300, onComplete: () => flash.destroy() });

        this.player.setTint(0xff6600);
        const aura = this.add.circle(this.player.x, this.player.y, 40, 0xff4400, 0.35).setDepth(0.5);
        this.tweens.add({ targets: aura, scaleX: 1.5, scaleY: 1.5, alpha: 0.15, duration: 400, yoyo: true, repeat: -1 });
        this._ignitionAura = aura;
        // Update aura position every frame to follow player
        this._ignitionAuraUpdate = this.time.addEvent({
            delay: 16, loop: true,
            callback: () => {
                if (aura && aura.active) {
                    aura.x = this.player.x;
                    aura.y = this.player.y;
                }
            }
        });

        // Fire first burst immediately, then every 600ms for the ult duration
        this._fireShotgunBurst();
        const shotgunTimer = this.time.addEvent({
            delay: 600,
            callback: () => {
                if (!this.ignitionActive) { shotgunTimer.remove(); return; }
                this._fireShotgunBurst();
            },
            loop: true
        });

        this.time.delayedCall(this.ignitionDuration, () => {
            this.ignitionActive = false;
            this.ultDrainActive = false;
            shotgunTimer.remove();
            this.player.clearTint();
            if (this._ignitionAuraUpdate) { this._ignitionAuraUpdate.remove(); this._ignitionAuraUpdate = null; }
            if (this._ignitionAura) {
                this.tweens.killTweensOf(this._ignitionAura);
                this._ignitionAura.destroy();
                this._ignitionAura = null;
            }
        });
    }

    _fireShotgunBurst() {
        const playerPixelX = this.playerX * this.TILE_SIZE + this.TILE_SIZE / 2;
        const playerPixelY = this.playerY * this.TILE_SIZE + this.TILE_SIZE / 2;
        const worldX = (this.pointerX || 0) + this.cameras.main.scrollX;
        const worldY = (this.pointerY || 0) + this.cameras.main.scrollY;
        const dx = worldX - playerPixelX, dy = worldY - playerPixelY;
        const baseAngle = Math.atan2(dy, dx);

        const muzzleFlash = this.add.circle(playerPixelX, playerPixelY, 14, 0xff6600, 0.7).setDepth(4);
        this.tweens.add({ targets: muzzleFlash, radius: 22, alpha: 0, duration: 120, onComplete: () => muzzleFlash.destroy() });

        [-0.5, -0.25, 0, 0.25, 0.5].forEach(offset => {
            const a = baseAngle + offset;
            const dirX = Math.cos(a), dirY = Math.sin(a);
            const c = this.add.container(playerPixelX, playerPixelY).setDepth(2);
            const fg = this.add.graphics().setDepth(1.5);
            c.add(fg);
            this.fireballs.push({
                sprite: c, fireGraphics: fg,
                vx: dirX * this.fireballSpeed * 1.4,
                vy: dirY * this.fireballSpeed * 1.4,
                damage: this.baseFireballDamage * this.damageScaling * 2.5,
                dirX, dirY,
                startX: playerPixelX, startY: playerPixelY,
                splitCount: 99,
                piercedEnemies: new Set(),
                createdAt: this.time.now,
                lastFlameTime: this.time.now,
                _isShotgun: true
            });
        });
    }

    activateIceBlizzard() {
        this.ultDrainActive = true;
        this.ultDrainStartTime = this.time.now;
        this.ultDrainDuration = 4000;

        this.tsunamiActive = true;
        this.tsunamiTiles = [];
        this.tsunamiFrozenEnemies = [];

        const originX = this.playerX;
        const originY = this.playerY;
        const maxR = this.tsunamiMaxRadius;
        const waveDur = this.tsunamiWaveDuration; // outward phase duration
        const pauseDur = 600;                      // how long water sits before retracting
        const retractDur = 900;                    // retract phase duration

        // Screen flash — deep blue
        const screenFlash = this.add.rectangle(this.scale.width / 2, this.scale.height / 2, this.scale.width, this.scale.height, 0x003366, 0.5).setScrollFactor(0).setDepth(20);
        this.tweens.add({ targets: screenFlash, alpha: 0, duration: 400, onComplete: () => screenFlash.destroy() });

        const tilesHit = new Set();
        const wetEnemies = new Set(); // enemies touched by water

        // ── OUTWARD WAVE ──────────────────────────────────────────────
        // t^2.5 easing: extremely fast at start, crawls to a halt at edge
        for (let r = 1; r <= maxR; r++) {
            const t = r / maxR;
            const delay = waveDur * Math.pow(t, 2.5);

            this.time.delayedCall(delay, () => {
                if (!this.tsunamiActive) return;

                for (let dx = -r; dx <= r; dx++) {
                    for (let dy = -r; dy <= r; dy++) {
                        const dist = Math.sqrt(dx * dx + dy * dy);
                        if (dist < r - 0.8 || dist > r + 0.1) continue;
                        const tx = originX + dx;
                        const ty = originY + dy;
                        const key = `${tx},${ty}`;
                        if (tilesHit.has(key)) continue;
                        if (tx < 0 || tx >= this.WORLD_WIDTH || ty < 0 || ty >= this.WORLD_HEIGHT) continue;
                        if (this.world[tx][ty] !== this.FLOOR) continue;
                        tilesHit.add(key);

                        const px2 = tx * this.TILE_SIZE + this.TILE_SIZE / 2;
                        const py2 = ty * this.TILE_SIZE + this.TILE_SIZE / 2;

                        const waterTile = this.add.rectangle(px2, py2, this.TILE_SIZE, this.TILE_SIZE, 0x0066cc, 0.55).setDepth(0.5);
                        const waterShimmer = this.add.rectangle(px2, py2, this.TILE_SIZE - 4, this.TILE_SIZE - 4, 0x44aaff, 0.3).setDepth(0.5);
                        this.tweens.add({ targets: waterShimmer, alpha: 0.6, duration: 150 + Math.random() * 100, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });

                        this.tsunamiTiles.push({ waterTile, waterShimmer, tileX: tx, tileY: ty, r });
                    }
                }

                // Mark any enemies in this ring as wet
                // In tutorial, skip enemies from unvisited rooms — they stay immovable/invulnerable
                const currentRoom = this.isTutorial ? this.getCurrentPlayerRoom() : -1;
                for (let enemy of this.enemies) {
                    if (wetEnemies.has(enemy)) continue;
                    if (this.isTutorial && enemy.tutorialRoomIndex !== currentRoom) continue;
                    const edx = enemy.x - originX;
                    const edy = enemy.y - originY;
                    const eDist = Math.sqrt(edx * edx + edy * edy);
                    if (eDist <= r + 0.5) {
                        wetEnemies.add(enemy);
                        if (enemy.sprite && enemy.sprite.active) {
                            enemy.sprite.setTint(0x4499ff);
                            this.showStatusText(enemy.sprite.x, enemy.sprite.y, 'WET', '#44aaff');
                        }
                    }
                }
                // Wave also damages portals (Queen Slimes) it passes over
                if (this.portals) {
                    for (const portal of this.portals) {
                        if (!portal.active) continue;
                        const pdx = portal.tileX - originX;
                        const pdy = portal.tileY - originY;
                        const pDist = Math.sqrt(pdx * pdx + pdy * pdy);
                        if (pDist >= r - 0.5 && pDist <= r + 0.5) {
                            this.damagePortal(portal, 15 * this.damageScaling);
                        }
                    }
                }
            });
        }

        // ── PAUSE ─────────────────────────────────────────────────────
        this.time.delayedCall(waveDur + pauseDur, () => {
            if (!this.tsunamiActive) return;

            // Darken water tiles slightly to signal retract incoming
            for (const t of this.tsunamiTiles) {
                this.tweens.killTweensOf(t.waterShimmer);
                this.tweens.add({ targets: [t.waterTile, t.waterShimmer], alpha: 0.7, duration: 200 });
            }
        });

        // ── RETRACT WAVE ──────────────────────────────────────────────
        // Rings disappear outside-in. Use fast ease (t^0.4 = starts fast)
        for (let r = maxR; r >= 1; r--) {
            const t = (maxR - r) / maxR; // 0 at edge, 1 at center
            const delay = waveDur + pauseDur + retractDur * Math.pow(t, 0.4);

            this.time.delayedCall(delay, () => {
                if (!this.tsunamiActive) return;

                // Remove water tiles at this radius
                for (let i = this.tsunamiTiles.length - 1; i >= 0; i--) {
                    const t2 = this.tsunamiTiles[i];
                    if (t2.r !== r) continue;
                    this.tweens.killTweensOf(t2.waterShimmer);
                    this.tweens.add({
                        targets: [t2.waterTile, t2.waterShimmer],
                        alpha: 0, duration: 120,
                        onComplete: () => { t2.waterTile.destroy(); t2.waterShimmer.destroy(); }
                    });
                    this.tsunamiTiles.splice(i, 1);
                }

                // Pull wet enemies at this radius one tile toward origin
                for (let enemy of wetEnemies) {
                    const edx = enemy.x - originX;
                    const edy = enemy.y - originY;
                    const eDist = Math.sqrt(edx * edx + edy * edy);
                    if (Math.abs(eDist - r) > 1.0) continue;

                    const pullDirX = edx === 0 && edy === 0 ? 0 : -Math.round(edx / Math.max(Math.abs(edx), Math.abs(edy)));
                    const pullDirY = edx === 0 && edy === 0 ? 0 : -Math.round(edy / Math.max(Math.abs(edx), Math.abs(edy)));
                    const newEx = enemy.x + pullDirX;
                    const newEy = enemy.y + pullDirY;

                    if (newEx >= 0 && newEx < this.WORLD_WIDTH && newEy >= 0 && newEy < this.WORLD_HEIGHT
                        && this.world[newEx][newEy] === this.FLOOR && !this.getEnemyAt(newEx, newEy)) {
                        enemy.x = newEx;
                        enemy.y = newEy;
                        this.tweens.add({
                            targets: enemy.sprite,
                            x: newEx * this.TILE_SIZE + this.TILE_SIZE / 2,
                            y: newEy * this.TILE_SIZE + this.TILE_SIZE / 2 + this.SLIME_Y_OFFSET,
                            duration: 140,
                            ease: 'Quad.easeIn',
                            onUpdate: () => {
                                if (enemy.healthBarBg) { enemy.healthBarBg.x = enemy.sprite.x; enemy.healthBarBg.y = enemy.sprite.y; }
                                if (enemy.healthBarFill) { enemy.healthBarFill.x = enemy.sprite.x; enemy.healthBarFill.y = enemy.sprite.y; }
                                if (enemy.burnVisual) { enemy.burnVisual.x = enemy.sprite.x; enemy.burnVisual.y = enemy.sprite.y - 18; }
                                if (enemy.brittleVisual) { enemy.brittleVisual.x = enemy.sprite.x; enemy.brittleVisual.y = enemy.sprite.y + 14; }
                                if (enemy._tsunamiMultText) { enemy._tsunamiMultText.x = enemy.sprite.x; enemy._tsunamiMultText.y = enemy.sprite.y - 28; }
                            }
                        });
                    }
                }
            });
        }

        // ── FLASH FREEZE ──────────────────────────────────────────────
        // Fires when retract fully reaches center
        this.time.delayedCall(waveDur + pauseDur + retractDur + 100, () => {
            if (!this.tsunamiActive) return;

            // Screen flash white
            const freezeFlash = this.add.rectangle(this.scale.width / 2, this.scale.height / 2, this.scale.width, this.scale.height, 0xffffff, 0.65).setScrollFactor(0).setDepth(20);
            this.tweens.add({ targets: freezeFlash, alpha: 0, duration: 350, onComplete: () => freezeFlash.destroy() });

            // Flash-freeze ice tile overlay — briefly cover the whole tsunami area with ice tiles
            const iceTileOverlays = [];
            for (let dx2 = -maxR; dx2 <= maxR; dx2++) {
                for (let dy2 = -maxR; dy2 <= maxR; dy2++) {
                    const dist = Math.sqrt(dx2*dx2 + dy2*dy2);
                    if (dist > maxR) continue;
                    const tx2 = originX + dx2, ty2 = originY + dy2;
                    if (tx2 < 0 || tx2 >= this.WORLD_WIDTH || ty2 < 0 || ty2 >= this.WORLD_HEIGHT) continue;
                    if (this.world[tx2][ty2] !== this.FLOOR) continue;
                    const px2 = tx2 * this.TILE_SIZE, py2 = ty2 * this.TILE_SIZE;
                    const iceOverlay = this.add.graphics().setDepth(1.8).setAlpha(0);
                    iceOverlay.fillStyle(0x88ddff, 0.75);
                    iceOverlay.fillRect(px2, py2, this.TILE_SIZE, this.TILE_SIZE);
                    iceOverlay.fillStyle(0xffffff, 0.35);
                    iceOverlay.fillRect(px2 + 2, py2 + 2, this.TILE_SIZE - 4, this.TILE_SIZE - 4);
                    // Crack lines
                    iceOverlay.lineStyle(1, 0xffffff, 0.5);
                    iceOverlay.beginPath(); iceOverlay.moveTo(px2 + 4, py2 + 4); iceOverlay.lineTo(px2 + this.TILE_SIZE - 6, py2 + this.TILE_SIZE - 4); iceOverlay.strokePath();
                    iceOverlay.beginPath(); iceOverlay.moveTo(px2 + this.TILE_SIZE/2, py2 + 2); iceOverlay.lineTo(px2 + 6, py2 + this.TILE_SIZE - 4); iceOverlay.strokePath();
                    iceTileOverlays.push(iceOverlay);
                }
            }
            // Fade in fast, hold briefly, fade out
            this.tweens.add({
                targets: iceTileOverlays, alpha: 1, duration: 80, ease: 'Quad.easeOut',
                onComplete: () => {
                    this.time.delayedCall(350, () => {
                        this.tweens.add({
                            targets: iceTileOverlays, alpha: 0, duration: 400, ease: 'Quad.easeIn',
                            onComplete: () => iceTileOverlays.forEach(o => o.destroy())
                        });
                    });
                }
            });

            // Freeze all wet enemies
            for (let enemy of wetEnemies) {
                if (!enemy.sprite || !enemy.sprite.active) continue;

                enemy.frozenByTsunami = true;
                this.freezeEnemy(enemy, this.tsunamiFreezeDuration);
                this.applyBrittle(enemy, 2);
                this.tsunamiFrozenEnemies.push(enemy);
                this.spawnIceSplinter(enemy.sprite.x, enemy.sprite.y);
                enemy.sprite.clearTint();

                const multTxt = this.add.text(enemy.sprite.x, enemy.sprite.y - 28, `${this.tsunamiFreezeMultiplier}x DMG`, {
                    fontSize: '12px', fontFamily: 'monospace', color: '#88eeff',
                    stroke: '#000000', strokeThickness: 3, fontStyle: 'bold'
                }).setOrigin(0.5).setDepth(10);
                enemy._tsunamiMultText = multTxt;
            }

            // 5 scatter waves erupting from player — escalating damage and density
            const waveCount = 5;
            const shardsPerWave = 18;
            for (let w = 0; w < waveCount; w++) {
                this.time.delayedCall(w * 350, () => {
                    if (!this.tsunamiActive && w > 0) return;
                    const px = this.player.x, py = this.player.y;

                    // Wave visual ring — grows and brightens each wave
                    const ringColor = w < 2 ? 0x88eeff : w < 4 ? 0xaaffff : 0xffffff;
                    const wRing = this.add.circle(px, py, 6, ringColor, 0).setDepth(5);
                    wRing.setStrokeStyle(2 + w * 0.5, ringColor, 1.0);
                    this.tweens.add({
                        targets: wRing, radius: 48 + w * 14, alpha: 0,
                        duration: 260, ease: 'Quad.easeOut',
                        onComplete: () => wRing.destroy()
                    });

                    for (let s = 0; s < shardsPerWave; s++) {
                        // Each wave rotated slightly so coverage fills gaps from previous wave
                        const baseAngle = (Math.PI * 2 / shardsPerWave) * s;
                        const angle = baseAngle + (w * (Math.PI / shardsPerWave)) + (Math.random() - 0.5) * 0.15;
                        const spd = 400 + Math.random() * 120 + w * 30;
                        const vx = Math.cos(angle) * spd;
                        const vy = Math.sin(angle) * spd;

                        // Damage ramps up each wave: 1.5x / 1.9x / 2.3x / 2.7x / 3.2x
                        const shardDmg = this.iceShardDamage * this.damageScaling * (1.5 + w * 0.4);
                        this.spawnIceShardProjectile(px, py, vx, vy, shardDmg, angle);
                    }
                });
            }

            // Clean up any remaining water tiles
            for (const t of this.tsunamiTiles) {
                this.tweens.killTweensOf(t.waterShimmer);
                t.waterTile.destroy(); t.waterShimmer.destroy();
            }
            this.tsunamiTiles = [];

            this.time.delayedCall(this.tsunamiFreezeDuration, () => {
                this.deactivateTsunami();
            });
        });
    }

    deactivateTsunami() {
        this.tsunamiActive = false;
        this.ultDrainActive = false;

        for (let enemy of this.tsunamiFrozenEnemies) {
            if (enemy._tsunamiMultText) {
                enemy._tsunamiMultText.destroy();
                enemy._tsunamiMultText = null;
            }
        }
        this.tsunamiFrozenEnemies = [];

        // Fade out any remaining water tiles (e.g. if cancelled early)
        for (const t of this.tsunamiTiles) {
            this.tweens.killTweensOf(t.waterShimmer);
            this.tweens.add({
                targets: [t.waterTile, t.waterShimmer],
                alpha: 0, duration: 400,
                onComplete: () => { t.waterTile.destroy(); t.waterShimmer.destroy(); }
            });
        }
        this.tsunamiTiles = [];

        // Clear wet tint from any enemies that weren't frozen
        for (let enemy of this.enemies) {
            if (enemy.sprite && enemy.sprite.active && !enemy.isFrozen) {
                enemy.sprite.clearTint();
            }
        }
    }

    updateTsunami(time) {
        // Keep multiplier text pinned above frozen enemies
        for (let enemy of this.tsunamiFrozenEnemies) {
            if (enemy._tsunamiMultText && enemy.sprite && enemy.sprite.active) {
                enemy._tsunamiMultText.x = enemy.sprite.x;
                enemy._tsunamiMultText.y = enemy.sprite.y - 28;
            }
        }
    }

    updateTsunamiPuddles(time) {
        for (let i = this.tsunamiPuddles.length - 1; i >= 0; i--) {
            const puddle = this.tsunamiPuddles[i];
            if (time >= puddle.expiresAt) {
                if (puddle.waterTile && puddle.waterTile.active) puddle.waterTile.destroy();
                if (puddle.waterShimmer && puddle.waterShimmer.active) puddle.waterShimmer.destroy();
                this.tsunamiPuddles.splice(i, 1);
                continue;
            }

            for (let enemy of this.enemies) {
                if (!enemy.sprite || !enemy.sprite.active || enemy.isFrozen) continue;
                if (enemy.x === puddle.tileX && enemy.y === puddle.tileY) {
                    if (!enemy.isSlowed) {
                        this.showStatusText(enemy.sprite.x, enemy.sprite.y, 'WET', '#44aaff');
                    }
                    enemy.isSlowed = true;
                    enemy.slowedUntil = time + this.tsunamiPuddleSlowDuration;
                }
            }
        }
    }

    createTsunamiPuddle(tileX, tileY) {
        const px = tileX * this.TILE_SIZE + this.TILE_SIZE / 2;
        const py = tileY * this.TILE_SIZE + this.TILE_SIZE / 2;

        // Exact same layered construction as tsunami tiles
        const waterTile = this.add.rectangle(px, py, this.TILE_SIZE, this.TILE_SIZE, 0x0066cc, 0.55).setDepth(0.5);
        const waterShimmer = this.add.rectangle(px, py, this.TILE_SIZE - 4, this.TILE_SIZE - 4, 0x44aaff, 0.3).setDepth(0.5);

        this.tweens.add({
            targets: waterShimmer,
            alpha: 0.6,
            duration: 150 + Math.random() * 100,
            yoyo: true, repeat: -1, ease: 'Sine.easeInOut'
        });

        // Fade in from nothing so it looks like the ice melted
        waterTile.setAlpha(0);
        waterShimmer.setAlpha(0);
        this.tweens.add({
            targets: [waterTile],
            alpha: 0.55,
            duration: 350,
            ease: 'Quad.easeOut'
        });
        this.tweens.add({
            targets: [waterShimmer],
            alpha: 0.3,
            duration: 350,
            ease: 'Quad.easeOut'
        });

        // Fade out at end of life
        const fadeDelay = this.tsunamiPuddleDuration - 500;
        this.time.delayedCall(fadeDelay, () => {
            if (waterTile.active) {
                this.tweens.add({ targets: [waterTile, waterShimmer], alpha: 0, duration: 500 });
            }
        });

        this.tsunamiPuddles.push({
            tileX, tileY,
            expiresAt: this.time.now + this.tsunamiPuddleDuration,
            waterTile,
            waterShimmer,
            ripple: null
        });
    }

    // ─── FIRE HELPERS ──────────────────────────────────────────────────

    activateLightningStorm() {
        const ULT_DURATION = 4500;

        this.ultDrainActive = true;
        this.ultDrainStartTime = this.time.now;
        this.ultDrainDuration = ULT_DURATION;

        this.lightningUltActive = true;
        this.lightningUltInvuln = true;
        this.lightningUltEndTime = this.time.now + ULT_DURATION;

        // Yellow screen flash
        const screenFlash = this.add.rectangle(
            this.scale.width / 2, this.scale.height / 2,
            this.scale.width, this.scale.height, 0xffff44, 0.45
        ).setScrollFactor(0).setDepth(20);
        this.tweens.add({ targets: screenFlash, alpha: 0, duration: 250, onComplete: () => screenFlash.destroy() });

        // Yellow tint on player
        this.player.setTint(0xffff44);

        const notice = this.add.text(this.scale.width / 2, 80, '⚡ FORK ⚡', {
            fontSize: '22px', fontFamily: 'monospace', color: '#ffff00',
            stroke: '#000000', strokeThickness: 4, fontStyle: 'bold'
        }).setOrigin(0.5).setScrollFactor(0).setDepth(25);
        this.tweens.add({ targets: notice, y: 55, alpha: 0, duration: 2000, onComplete: () => notice.destroy() });

        // Auto-zap all enemies within 4 tiles every 400ms
        const ZAP_RADIUS = 4, ZAP_INTERVAL = 400;
        const globalHit = [];
        const zapTimer = this.time.addEvent({
            delay: ZAP_INTERVAL, loop: true,
            callback: () => {
                if (!this.lightningUltActive) { zapTimer.remove(); return; }
                globalHit.length = 0;
                for (const enemy of [...this.enemies]) {
                    if (!enemy.sprite?.active) continue;
                    const dist = Math.abs(enemy.x - this.playerX) + Math.abs(enemy.y - this.playerY);
                    if (dist > ZAP_RADIUS) continue;
                    if (globalHit.includes(enemy)) continue;
                    this.drawLightningBolt({ sprite: this.player }, enemy);
                    this.performChainLightningShared(
                        enemy,
                        this.baseLightningDamage * this.damageScaling * 1.2,
                        globalHit,
                        this.lightningChainFalloff
                    );
                }
                // Also zap boss if in range
                if (this.voltslimeBoss?.active) {
                    const bd = Math.abs(this.voltslimeBoss.tileX - this.playerX) + Math.abs(this.voltslimeBoss.tileY - this.playerY);
                    if (bd <= ZAP_RADIUS) {
                        this.damageBossAtTile(this.voltslimeBoss.tileX, this.voltslimeBoss.tileY, this.baseLightningDamage * this.damageScaling * 1.5);
                    }
                }
                // Also zap portals (Queen Slimes) in range
                if (this.portals) {
                    for (const portal of this.portals) {
                        if (!portal.active) continue;
                        const pd = Math.abs(portal.tileX - this.playerX) + Math.abs(portal.tileY - this.playerY);
                        if (pd <= ZAP_RADIUS) {
                            this.damagePortal(portal, this.baseLightningDamage * this.damageScaling * 1.2);
                        }
                    }
                }
            }
        });

        this.time.delayedCall(ULT_DURATION, () => {
            this.lightningUltActive = false;
            this.lightningUltInvuln = false;
            this.ultDrainActive = false;
            zapTimer.remove();
            if (this.player?.active) this.player.clearTint();
        });
    }

    updateStormCloud(time) {
        if (!this.stormCloudActive || !this.stormCloud) return;

        const cloudX = this.stormCloud.thrown ? this.stormCloud.thrownX : this.player.x;
        const cloudY = this.stormCloud.thrown ? this.stormCloud.thrownY : (this.player.y - 40);

        // Only follow player if not thrown
        if (!this.stormCloud.thrown) {
            this.stormCloud.body.x = this.player.x;
            this.stormCloud.body.y = this.player.y - 40;
            this.stormCloud.darkCore.x = this.player.x;
            this.stormCloud.darkCore.y = this.player.y - 40;
            this.stormCloud.crackle.x = this.player.x;
            this.stormCloud.crackle.y = this.player.y - 40;
            this.stormCloud.outerCrackle.x = this.player.x;
            this.stormCloud.outerCrackle.y = this.player.y - 40;
            this.stormCloud.chargeText.x = this.player.x;
            this.stormCloud.chargeText.y = this.player.y - 40;

            // Update spark positions
            this.stormCloud.sparks.forEach((spark, index) => {
                const baseAngle = (Math.PI * 2 / 6) * index;
                const rotationAngle = baseAngle + (time / 2000) * Math.PI * 2;
                const distance = 40;
                spark.x = cloudX + Math.cos(rotationAngle) * distance;
                spark.y = cloudY + Math.sin(rotationAngle) * distance;
            });
        }

        // Update charge text and color
        const chargePercent = Math.floor(this.stormCloudCharge);
        this.stormCloud.chargeText.setText(`${chargePercent}%`);

        // Change color based on charge
        if (chargePercent > 70) {
            this.stormCloud.chargeText.setColor('#ffff00');
        } else if (chargePercent > 30) {
            this.stormCloud.chargeText.setColor('#ffaa00');
        } else {
            this.stormCloud.chargeText.setColor('#ff6600');
        }

        if (time - this.stormCloudLastAttack >= this.stormCloudAutoAttackInterval) {
            this.stormCloudAutoAttack();
            this.stormCloudLastAttack = time;

            this.stormCloudCharge -= this.stormCloudChargeDecayPerAttack;

            if (this.stormCloudCharge <= 0) {
                this.deactivateStormCloud();
            }
        }

        const chargePercent2 = this.stormCloudCharge / 100;
        this.stormCloud.body.setScale(0.8 + chargePercent2 * 0.4);
        this.stormCloud.darkCore.setScale(0.8 + chargePercent2 * 0.4);
        this.stormCloud.crackle.setAlpha(0.4 + chargePercent2 * 0.4);
        this.stormCloud.outerCrackle.setAlpha(0.3 + chargePercent2 * 0.5);
    }

    stormCloudAutoAttack() {
        const nearbyEnemies = [];
        const maxRange = 15;

        // Use the cloud's actual position (thrown location or player position)
        const cloudTileX = this.stormCloud.thrown
            ? Math.floor(this.stormCloud.thrownX / this.TILE_SIZE)
            : this.playerX;
        const cloudTileY = this.stormCloud.thrown
            ? Math.floor(this.stormCloud.thrownY / this.TILE_SIZE)
            : this.playerY;

        for (let enemy of this.enemies) {
            const dist = Math.abs(enemy.x - cloudTileX) + Math.abs(enemy.y - cloudTileY);
            if (dist <= maxRange) {
                nearbyEnemies.push({ enemy, dist });
            }
        }

        if (nearbyEnemies.length === 0) return;

        // Track all enemies hit this tick so chains don't double-hit
        const globalHitEnemies = [];

        for (let { enemy } of nearbyEnemies) {
            // Skip if already hit by a chain this tick
            if (globalHitEnemies.includes(enemy)) continue;

            this.drawLightningBolt(
                { sprite: this.stormCloud.body },
                enemy
            );

            this.performChainLightningShared(enemy, this.baseLightningDamage * this.damageScaling * 0.8, globalHitEnemies, this.lightningUltChainFalloff);
        }
    }

    // Like performChainLightning but shares a hit-list across the whole tick

    performChainLightningShared(sourceEnemy, damage, globalHitEnemies, falloff) {
        globalHitEnemies.push(sourceEnemy);

        this.damageEnemy(sourceEnemy, damage);
        this.damageBossAtTile(sourceEnemy.x, sourceEnemy.y, damage);

        sourceEnemy.sprite.setTint(0xffff00);
        this.time.delayedCall(100, () => {
            if (sourceEnemy.sprite && sourceEnemy.sprite.active) {
                sourceEnemy.sprite.clearTint();
            }
        });

        let nearestEnemy = null;
        let nearestDist = Infinity;

        for (let enemy of this.enemies) {
            if (globalHitEnemies.includes(enemy)) continue;

            const dist = Math.abs(enemy.x - sourceEnemy.x) + Math.abs(enemy.y - sourceEnemy.y);

            if (dist <= this.lightningChainRange && dist < nearestDist) {
                nearestEnemy = enemy;
                nearestDist = dist;
            }
        }

        if (nearestEnemy) {
            this.drawLightningBolt(sourceEnemy, nearestEnemy);
            this.performChainLightningShared(nearestEnemy, damage * falloff, globalHitEnemies, falloff);
        }
    }

    deactivateStormCloud() {

        this.stormCloudActive = false;

        if (this.stormCloud) {
            // Stop flash interval
            if (this.stormCloud.flashInterval) {
                this.stormCloud.flashInterval.remove();
            }

            // Kill all tweens
            this.tweens.killTweensOf(this.stormCloud.body);
            this.tweens.killTweensOf(this.stormCloud.darkCore);
            this.tweens.killTweensOf(this.stormCloud.crackle);
            this.tweens.killTweensOf(this.stormCloud.outerCrackle);
            this.stormCloud.sparks.forEach(spark => {
                this.tweens.killTweensOf(spark);
            });

            // Fade out all elements
            this.tweens.add({
                targets: [
                    this.stormCloud.body,
                    this.stormCloud.darkCore,
                    this.stormCloud.crackle,
                    this.stormCloud.outerCrackle,
                    this.stormCloud.chargeText,
                    ...this.stormCloud.sparks
                ],
                alpha: 0,
                duration: 300,
                onComplete: () => {
                    this.stormCloud.body.destroy();
                    this.stormCloud.darkCore.destroy();
                    this.stormCloud.crackle.destroy();
                    this.stormCloud.outerCrackle.destroy();
                    this.stormCloud.chargeText.destroy();
                    this.stormCloud.sparks.forEach(spark => spark.destroy());
                    this.stormCloud = null;
                }
            });
        }
    }

    throwLightning() {
        if (!this.stormCloudActive || !this.stormCloud) return;

        const worldX = this.pointerX + this.cameras.main.scrollX;
        const worldY = this.pointerY + this.cameras.main.scrollY;

        const tileX = Math.floor(worldX / this.TILE_SIZE);
        const tileY = Math.floor(worldY / this.TILE_SIZE);

        const targetPixelX = tileX * this.TILE_SIZE + this.TILE_SIZE / 2;
        const targetPixelY = tileY * this.TILE_SIZE + this.TILE_SIZE / 2;

        // Mark cloud as thrown
        this.stormCloud.thrown = true;
        this.stormCloud.thrownX = targetPixelX;
        this.stormCloud.thrownY = targetPixelY;

        // Animate throw
        const allElements = [
            this.stormCloud.body,
            this.stormCloud.darkCore,
            this.stormCloud.crackle,
            this.stormCloud.outerCrackle,
            this.stormCloud.chargeText,
            ...this.stormCloud.sparks
        ];

        this.tweens.add({
            targets: allElements,
            x: targetPixelX,
            y: targetPixelY,
            duration: 500,
            ease: 'Quad.easeOut'
        });
    }

    updateThunderhead(time, delta) {
        if (!this.thunderheadActive) return;

        if (time >= this.thunderheadEndTime) {
            this.deactivateThunderhead();
            return;
        }

        // Update aura and cloud sprite to follow player
        if (this._cloudSprite) {
            this._cloudSprite.x = this.player.x;
            this._cloudSprite.y = this.player.y;
        }
        if (this._thunderheadAura) {
            this._thunderheadAura.x = this.player.x;
            this._thunderheadAura.y = this.player.y;
        }
        if (this._thunderheadOuterRing) {
            this._thunderheadOuterRing.x = this.player.x;
            this._thunderheadOuterRing.y = this.player.y;
        }

        // Spawn crackling trail
        if (time - this.thunderheadLastTrail >= this.thunderheadTrailInterval) {
            this.thunderheadLastTrail = time;
            this.spawnThunderheadTrail(this.player.x, this.player.y, time);
        }

        // THUNDERHEAD: player IS the superconductor — superconduct all nodes + self every tick
        if (time - this.stormCloudLastAttack >= this.stormCloudAutoAttackInterval) {
            this.stormCloudLastAttack = time;

            // Activate all placed nodes instantly
            for (let node of this.lightningNodes) {
                if (!node.active) this.activateLightningNode(node);
                else node.expiresAt = Math.max(node.expiresAt, time + this.lightningNodeDuration);
            }

            // Shared hit list for the whole tick — prevents double-hitting
            const globalHit = [];

            // Draw arcs from player to every active node — deal damage to enemies along the path
            const arcGfx = this.add.graphics().setDepth(3);
            for (let node of this.lightningNodes) {
                if (!node.active) continue;
                this.drawNodeArc(arcGfx, this.player.x, this.player.y, node.px, node.py);

                // Damage enemies that cross this arc path
                for (let enemy of this.enemies) {
                    if (globalHit && globalHit.includes(enemy)) continue;
                    const dist = this.pointToLineDistance(
                        enemy.sprite.x, enemy.sprite.y,
                        this.player.x, this.player.y,
                        node.px, node.py
                    );
                    if (dist <= this.TILE_SIZE * 1.2) {
                        this.applySuperConduct(enemy);
                        this.drawLightningBolt({ sprite: this.player }, enemy);
                        this.performChainLightningShared(
                            enemy,
                            this.lightningNodeDamage * this.damageScaling * 1.5,
                            globalHit,
                            this.thunderheadChainFalloff
                        );
                        if (enemy.sprite && enemy.sprite.active) {
                            this.showStatusText(enemy.sprite.x, enemy.sprite.y, '⚡ ARC PATH', '#ffff44');
                        }
                    }
                }
            }
            this.tweens.add({ targets: arcGfx, alpha: 0, duration: 300, onComplete: () => arcGfx.destroy() });

            // Superconduct all enemies within each node's radius using circuit damage
            // Player counts as a node in every circuit
            for (let enemy of this.enemies) {
                if (globalHit.includes(enemy)) continue;

                // Count active nodes that cover this enemy
                const coveringNodes = this.lightningNodes.filter(n =>
                    n.active && Math.abs(enemy.x - n.tileX) + Math.abs(enemy.y - n.tileY) <= this.lightningNodeRadius
                ).length;

                // Player also counts if in range
                const playerCovers = Math.abs(enemy.x - this.playerX) + Math.abs(enemy.y - this.playerY) <= this.thunderheadTrailDamageRadius;
                const totalNodes = coveringNodes + (playerCovers ? 1 : 0);

                if (totalNodes === 0) continue;

                // Apply superconductor status and circuit damage
                this.applySuperConduct(enemy);
                const circuitMultiplier = Math.pow(2, totalNodes - 1);
                const dmg = this.lightningNodeDamage * this.damageScaling * circuitMultiplier;

                if (playerCovers) {
                    this.drawLightningBolt({ sprite: this.player }, enemy);
                } else {
                    // Zap from nearest covering node
                    const src = this.lightningNodes.find(n => n.active && Math.abs(enemy.x - n.tileX) + Math.abs(enemy.y - n.tileY) <= this.lightningNodeRadius);
                    if (src) this.drawLightningBolt({ sprite: { x: src.px, y: src.py } }, enemy);
                }

                this.performChainLightningShared(enemy, dmg, globalHit, this.thunderheadChainFalloff);
                this.gainUltCharge(this.ultChargePerChain * 0.3);

                if (totalNodes > 1 && enemy.sprite && enemy.sprite.active) {
                    this.showStatusText(enemy.sprite.x, enemy.sprite.y, `⚡ ${totalNodes}-NODE ×${circuitMultiplier}`, '#ffff44');
                }
            }
        }

        // HUD timer
        const remaining = ((this.thunderheadEndTime - time) / 1000).toFixed(1);
        if (!this._thunderheadTimerText) {
            this._thunderheadTimerText = this.add.text(this.scale.width / 2, 100, '', {
                fontSize: '18px', fontFamily: 'monospace', color: '#ffff88',
                stroke: '#000000', strokeThickness: 3
            }).setOrigin(0.5).setScrollFactor(0);
        }
        this._thunderheadTimerText.setText(`⚡ THUNDERHEAD ${remaining}s`);
    }

    spawnThunderheadTrail(x, y, time) {
        // Bright crackling node
        const node = this.add.circle(x, y, 8, 0xffff00, 0.7);
        node.setStrokeStyle(2, 0xffffff, 0.9);
        const inner = this.add.circle(x, y, 4, 0xffffff, 1);

        this.tweens.add({
            targets: [node, inner],
            radius: { from: node.radius, to: 2 },
            alpha: 0,
            duration: 600,
            ease: 'Quad.easeIn',
            onComplete: () => { node.destroy(); inner.destroy(); }
        });

        // Small arcs radiating out
        for (let i = 0; i < 3; i++) {
            const angle = Math.random() * Math.PI * 2;
            const len = 10 + Math.random() * 15;
            const g = this.add.graphics();
            g.lineStyle(1.5, 0xffff00, 0.8);
            g.beginPath();
            g.moveTo(x, y);
            g.lineTo(x + Math.cos(angle) * len, y + Math.sin(angle) * len);
            g.strokePath();
            this.tweens.add({ targets: g, alpha: 0, duration: 150, onComplete: () => g.destroy() });
        }
    }

    deactivateThunderhead() {
        this.thunderheadActive = false;
        this.ultDrainActive = false;

        if (this._thunderheadAura) { this.tweens.killTweensOf(this._thunderheadAura); this._thunderheadAura.destroy(); this._thunderheadAura = null; }
        if (this._thunderheadOuterRing) { this.tweens.killTweensOf(this._thunderheadOuterRing); this._thunderheadOuterRing.destroy(); this._thunderheadOuterRing = null; }
        if (this._thunderheadTimerText) { this._thunderheadTimerText.destroy(); this._thunderheadTimerText = null; }

        // Snap to nearest valid floor tile
        const snap = this.snapToNearestFloor(this.thunderheadGlideX, this.thunderheadGlideY);
        if (snap) {
            this.playerX = snap.tx;
            this.playerY = snap.ty;
            this.player.x = snap.px;
            this.player.y = snap.py + this.SLIME_Y_OFFSET;
        } else {
            this.player.x = this.playerX * this.TILE_SIZE + this.TILE_SIZE / 2;
            this.player.y = this.playerY * this.TILE_SIZE + this.TILE_SIZE / 2 + this.SLIME_Y_OFFSET;
        }

        // Play dissipate animation then restore player sprite
        if (this._cloudSprite) {
            this._cloudSprite.play('cloud_dissipate');
            this._cloudSprite.once('animationcomplete', () => {
                if (this._cloudSprite) {
                    this.tweens.add({
                        targets: this._cloudSprite,
                        alpha: 0,
                        duration: 200,
                        onComplete: () => {
                            if (this._cloudSprite) { this._cloudSprite.destroy(); this._cloudSprite = null; }
                        }
                    });
                }
                this.player.setVisible(true);
                this.player.setAlpha(1);
                this.player.clearTint();
            });
        } else {
            this.player.setVisible(true);
            this.player.setAlpha(1);
            this.player.clearTint();
        }
    }

    applySuperConduct(enemy) {
        if (!enemy.sprite || !enemy.sprite.active) return;
        enemy.isSuperConducted = true;
        enemy.superConductUntil = this.time.now + this.superConductDuration;

        if (enemy.superConductVisual) {
            this.tweens.killTweensOf(enemy.superConductVisual.container);
            enemy.superConductVisual.container.destroy();
            enemy.superConductVisual = null;
        }

        const ex = enemy.sprite.x, ey = enemy.sprite.y;

        // Detailed electric sigil — concentric rings + angled crackle lines + bright core dot
        const container = this.add.container(ex, ey - 18).setDepth(2.2);

        const g = this.add.graphics();

        // Outer ring
        g.lineStyle(1, 0xffff44, 0.55);
        g.strokeCircle(0, 0, 9);

        // Inner ring
        g.lineStyle(1, 0xffffff, 0.35);
        g.strokeCircle(0, 0, 5);

        // Four angled crackle lines radiating outward (like a compass rose, slightly jagged)
        const crackleAngles = [0, Math.PI / 2, Math.PI, Math.PI * 1.5];
        crackleAngles.forEach(a => {
            const midX = Math.cos(a + 0.25) * 6, midY = Math.sin(a + 0.25) * 6;
            const endX = Math.cos(a) * 11, endY = Math.sin(a) * 11;
            g.lineStyle(1.5, 0xffff88, 0.75);
            g.beginPath(); g.moveTo(Math.cos(a) * 4, Math.sin(a) * 4);
            g.lineTo(midX, midY); g.lineTo(endX, endY); g.strokePath();
        });

        // Bright core dot
        g.fillStyle(0xffffff, 0.9);
        g.fillCircle(0, 0, 2);

        container.add(g);

        // Slow rotation — subtle, not distracting
        this.tweens.add({
            targets: container,
            angle: 360,
            duration: 3000,
            repeat: -1,
            ease: 'Linear'
        });

        enemy.superConductVisual = { container, g };
        enemy.sprite.setTint(0xffffaa);

        this.showStatusText(enemy.sprite.x, enemy.sprite.y, 'CONDUCTOR', '#ffff44');
    }

    clearSuperConduct(enemy) {
        enemy.isSuperConducted = false;
        enemy.superConductUntil = 0;
        if (enemy.superConductVisual) {
            this.tweens.killTweensOf(enemy.superConductVisual.container);
            enemy.superConductVisual.container.destroy();
            enemy.superConductVisual = null;
        }
        if (enemy.sprite && enemy.sprite.active && !enemy.isFrozen && !enemy.isBurning) {
            enemy.sprite.clearTint();
        }
    }

    updateSuperConductors(time) {
        for (let enemy of this.enemies) {
            if (!enemy.isSuperConducted) continue;
            if (!enemy.sprite || !enemy.sprite.active) { this.clearSuperConduct(enemy); continue; }
            if (time >= enemy.superConductUntil) {
                this.clearSuperConduct(enemy);
                continue;
            }
            if (enemy.superConductVisual?.container?.active) {
                enemy.superConductVisual.container.setPosition(enemy.sprite.x, enemy.sprite.y - 18);
            }
        }
    }

    placeLightningNode(tileX, tileY) {
        if (tileX < 0 || tileX >= this.WORLD_WIDTH || tileY < 0 || tileY >= this.WORLD_HEIGHT) return;
        if (this.world[tileX][tileY] !== this.FLOOR) return;

        const dist = Math.abs(tileX - this.playerX) + Math.abs(tileY - this.playerY);
        if (dist > 3) { this.showStatusText(this.player.x, this.player.y - 20, 'TOO FAR', '#ffff44'); return; }

        if (this.lightningNodes.find(n => n.tileX === tileX && n.tileY === tileY)) return;
        if (this.lightningNodesCrafting.find(c => c.tileX === tileX && c.tileY === tileY)) return;

        if (this.lightningNodes.length + this.lightningNodesCrafting.length >= this.lightningNodeMax) {
            this.showStatusText(this.player.x, this.player.y - 20, 'MAX NODES', '#ffff44'); return;
        }
        if (this.orbScraps < this.orbNodeCost) {
            this.showStatusText(this.player.x, this.player.y - 20, `NEED ${this.orbNodeCost} SCRAPS`, '#ff6644'); return;
        }

        if (this.nodeChannelActive) this.cancelNodeChannel();

        this.nodeChannelActive = true;
        this.nodeChannelType = 'craft';
        this.nodeChannelTarget = { tileX, tileY };
        this.nodeChannelStartTime = this.time.now;

        const ts = this.TILE_SIZE;
        const ghost = this.add.graphics().setDepth(1.6);
        ghost.fillStyle(0x1a2a3a, 0.5);
        ghost.fillRect(tileX * ts, tileY * ts, ts, ts);
        ghost.lineStyle(1.5, 0x335566, 0.7);
        ghost.strokeRect(tileX * ts, tileY * ts, ts, ts);

        const barW = ts + 12;
        const barBg   = this.add.rectangle(0, 0, barW, 6, 0x000000, 0.85).setDepth(5);
        const barFill = this.add.rectangle(0, 0, 0, 6, 0x00ccff, 1).setOrigin(0, 0.5).setDepth(5.1);
        const barLabel = this.add.text(0, 0, 'CRAFTING', {
            fontSize: '10px', fontFamily: 'monospace', color: '#00ccff', stroke: '#000', strokeThickness: 2
        }).setOrigin(0.5, 1).setDepth(5.2);

        this.nodeChannelVisual = { ghost, barBg, barFill, barLabel };
    }

    removeLightningNodeAt(tileX, tileY) {
        const ci = this.lightningNodesCrafting.findIndex(c => c.tileX === tileX && c.tileY === tileY);
        if (ci !== -1) {
            const c = this.lightningNodesCrafting[ci];
            this.tweens.killTweensOf(c.barFill); this.tweens.killTweensOf(c.ghostDot);
            c.ghost.destroy(); c.barBg.destroy(); c.barFill.destroy(); c.ghostDot.destroy();
            this.lightningNodesCrafting.splice(ci, 1);
            return true;
        }
        const ni = this.lightningNodes.findIndex(n => n.tileX === tileX && n.tileY === tileY);
        if (ni !== -1) {
            const d = Math.abs(tileX - this.playerX) + Math.abs(tileY - this.playerY);
            if (d > 3) { this.showStatusText(this.player.x, this.player.y - 20, 'TOO FAR', '#ffff44'); return false; }

            if (this.nodeChannelActive) this.cancelNodeChannel();

            this.nodeChannelActive = true;
            this.nodeChannelType = 'remove';
            this.nodeChannelTarget = { tileX, tileY };
            this.nodeChannelStartTime = this.time.now;

            const ts = this.TILE_SIZE;
            const ghost = this.add.graphics().setDepth(5);
            ghost.lineStyle(2, 0xff4444, 0.8);
            ghost.strokeRect(tileX * ts, tileY * ts, ts, ts);

            const barW = ts + 12;
            const barBg   = this.add.rectangle(0, 0, barW, 6, 0x000000, 0.85).setDepth(5);
            const barFill = this.add.rectangle(0, 0, 0, 6, 0xff4444, 1).setOrigin(0, 0.5).setDepth(5.1);
            const barLabel = this.add.text(0, 0, 'REMOVING', {
                fontSize: '10px', fontFamily: 'monospace', color: '#ff8888', stroke: '#000', strokeThickness: 2
            }).setOrigin(0.5, 1).setDepth(5.2);

            this.nodeChannelVisual = { ghost, barBg, barFill, barLabel };
            return true;
        }
        return false;
    }

    cancelNodeChannel() {
        if (!this.nodeChannelActive) return;
        this.nodeChannelActive = false;
        this.nodeChannelType = null;
        this.nodeChannelTarget = null;
        if (this.nodeChannelVisual) {
            const v = this.nodeChannelVisual;
            [v.ghost, v.barBg, v.barFill, v.barLabel].forEach(o => { if (o && o.active) o.destroy(); });
            this.nodeChannelVisual = null;
        }
    }

    updateNodeChannel(time) {
        if (!this.nodeChannelActive || !this.nodeChannelVisual) return;

        const v = this.nodeChannelVisual;
        const elapsed = time - this.nodeChannelStartTime;
        const pct = Math.min(elapsed / this.nodeChannelDuration, 1);
        const ts = this.TILE_SIZE;
        const barW = ts + 12;
        const bx = this.player.x - barW / 2;
        const by = this.player.y - 36;

        v.barBg.x = bx + barW / 2; v.barBg.y = by + 3;
        v.barFill.x = bx; v.barFill.y = by + 3;
        v.barFill.width = barW * pct;
        v.barLabel.x = bx + barW / 2; v.barLabel.y = by;

        if (pct < 1) return;

        const { tileX, tileY } = this.nodeChannelTarget;
        const type = this.nodeChannelType;
        this.cancelNodeChannel();

        if (type === 'craft') {
            this.orbScraps -= this.orbNodeCost;
            this.updateHUD();
            this.finishPlacingNode(tileX, tileY);
        } else if (type === 'remove') {
            const ni = this.lightningNodes.findIndex(n => n.tileX === tileX && n.tileY === tileY);
            if (ni !== -1) {
                this.destroyLightningNode(this.lightningNodes[ni]);
                this.lightningNodes.splice(ni, 1);
                const refund = Math.floor(this.orbNodeCost * this.orbRefundPct);
                if (refund > 0) {
                    this.orbScraps += refund;
                    this.showStatusText(this.player.x, this.player.y - 20, `+${refund} SCRAPS`, '#aaffcc');
                    this.updateHUD();
                }
            }
        }
    }

    spawnOrbScrap(x, y) {
        const g = this.add.graphics().setDepth(3.5);
        g.fillStyle(0x00cc88, 1); g.fillCircle(0, 0, 5);
        g.fillStyle(0x00ffaa, 0.8); g.fillCircle(0, 0, 3.5);
        g.fillStyle(0xffffff, 0.7); g.fillCircle(-1.5, -1.5, 1.5);
        g.lineStyle(1.5, 0x00ffcc, 0.9); g.strokeCircle(0, 0, 5);
        g.x = x; g.y = y;

        const landX = x + (Math.random() - 0.5) * 20;
        const landY = y + 6 + Math.random() * 8;

        const orb = { g, landX, landY, attracting: false, tweensKilled: false };
        this.orbObjects.push(orb);

        // Pop up then drop to landing pos
        this.tweens.add({
            targets: g, x: landX, y: y - 18, duration: 180, ease: 'Quad.easeOut',
            onComplete: () => {
                if (!g.active) return;
                this.tweens.add({
                    targets: g, y: landY, duration: 240, ease: 'Bounce.easeOut',
                    onComplete: () => {
                        if (!g.active || orb.attracting) return;
                        // Gentle bob after landing
                        this.tweens.add({ targets: g, y: landY - 2, duration: 500, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
                    }
                });
            }
        });
    }

    updateOrbScraps() {
        const px = this.player.x, py = this.player.y;
        const attractDist = this.orbPickupRadius * this.TILE_SIZE;
        const now = this.time.now;

        for (let i = this.orbObjects.length - 1; i >= 0; i--) {
            const orb = this.orbObjects[i];
            if (orb.collected || !orb.g || !orb.g.active) {
                this.orbObjects.splice(i, 1);
                continue;
            }

            const dx = px - orb.g.x, dy = py - orb.g.y;
            const dist = Math.sqrt(dx * dx + dy * dy);

            if (dist < attractDist || orb.attracting) {
                if (!orb.attracting) {
                    orb.attracting = true;
                    this.tweens.killTweensOf(orb.g);
                }

                if (dist < 14) {
                    // Collect — mark immediately to prevent double-collect
                    orb.collected = true;
                    this.tweens.killTweensOf(orb.g);
                    orb.g.destroy();
                    this.orbObjects.splice(i, 1);
                    this.orbScraps++;
                    this.updateHUD();
                    const flash = this.add.circle(px, py, 8, 0x00ffaa, 0.5).setDepth(4);
                    this.tweens.add({ targets: flash, radius: 18, alpha: 0, duration: 180, onComplete: () => flash.destroy() });
                    continue;
                }

                // Move toward player
                const spd = 4 + (attractDist - Math.max(dist, 1)) * 0.1;
                orb.g.x += (dx / dist) * spd;
                orb.g.y += (dy / dist) * spd;
            } else {
                // Bob gently — only if not attracting
                orb.g.y = orb.landY + Math.sin(now / 500 + i) * 2;
            }
        }
    }

    updateNodeCrafting(time) {
        // Legacy no-op — channel system handles crafting now
    }

    finishPlacingNode(tileX, tileY) {
        if (tileX < 0 || tileX >= this.WORLD_WIDTH || tileY < 0 || tileY >= this.WORLD_HEIGHT) return;
        if (this.world[tileX][tileY] !== this.FLOOR) return;

        const px = tileX * this.TILE_SIZE + this.TILE_SIZE / 2;
        const py = tileY * this.TILE_SIZE + this.TILE_SIZE / 2;
        const ts = this.TILE_SIZE;

        const g = this.add.graphics().setDepth(1.6);
        g.fillStyle(0x1a2a3a, 0.88);
        g.fillRect(tileX * ts, tileY * ts, ts, ts);
        g.lineStyle(1.5, 0x335566, 0.9);
        g.strokeRect(tileX * ts, tileY * ts, ts, ts);
        g.lineStyle(0.5, 0x224455, 0.45);
        g.beginPath(); g.moveTo(tileX * ts, tileY * ts); g.lineTo(tileX * ts + ts, tileY * ts + ts); g.strokePath();
        g.beginPath(); g.moveTo(tileX * ts + ts, tileY * ts); g.lineTo(tileX * ts, tileY * ts + ts); g.strokePath();
        g.beginPath(); g.moveTo(tileX * ts + ts / 2, tileY * ts); g.lineTo(tileX * ts + ts / 2, tileY * ts + ts); g.strokePath();
        g.beginPath(); g.moveTo(tileX * ts, tileY * ts + ts / 2); g.lineTo(tileX * ts + ts, tileY * ts + ts / 2); g.strokePath();

        const pulse = this.add.circle(px, py, 4, 0x226688, 0.5).setDepth(1.8);
        this.tweens.add({ targets: pulse, alpha: 0.15, duration: 1200, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });

        // Inner ring — normal enemy radius (dormant, faint)
        const radiusRing = this.add.circle(px, py, this.lightningNodeRadius * ts, 0, 0).setDepth(1.5);
        radiusRing.setStrokeStyle(1, 0x4488aa, 0.18);

        // Outer ring — superconducted enemy radius (extended, even fainter)
        const extRadius = this.lightningNodeRadius * ts * 1.6; // ~60% larger
        const extRing = this.add.circle(px, py, extRadius, 0, 0).setDepth(1.4);
        extRing.setStrokeStyle(1.5, 0x226644, 0.25);

        // Charge timer bar — tiny bar above tile showing remaining active time
        const timerBarBg = this.add.rectangle(px, tileY * ts + ts + 3, ts + 4, 4, 0x000000, 0.75).setOrigin(0.5, 0).setDepth(3.5);
        const timerBarFill = this.add.rectangle(px - (ts + 4) / 2, tileY * ts + ts + 3, 0, 4, 0x00ccff, 0.9).setOrigin(0, 0).setDepth(3.6);
        timerBarBg.setVisible(false);
        timerBarFill.setVisible(false);

        // Placement flash
        const flash = this.add.circle(px, py, ts * 0.8, 0x00ccff, 0.4).setDepth(3);
        this.tweens.add({ targets: flash, radius: ts * 1.5, alpha: 0, duration: 250, onComplete: () => flash.destroy() });

        this.lightningNodes.push({
            tileX, tileY, px, py,
            active: false,
            stage: 0,
            lastPulseTime: 0,
            g, pulse,
            radiusRing,    // inner — normal range
            extRing,       // outer — superconducted range
            timerBarBg, timerBarFill,
            activeVisuals: null,
            lastZapTime: 0,
            expiresAt: 0,
            arcGraphics: null
        });
    }

    activateLightningNode(node) {
        // Each hit charges one stage (up to max), refreshes duration
        node.stage = Math.min(this.lightningNodeMaxStage, (node.stage || 0) + 1);
        node.active = true;
        node.expiresAt = this.time.now + this.lightningNodeDuration;
        node.lastZapTime = this.time.now;
        node.lastPulseTime = node.lastPulseTime || 0;
        const ts = this.TILE_SIZE;

        const stageCol = this.lightningNodeStageColors[node.stage];
        const baseR    = this.lightningNodeBaseRadius[node.stage] || 3;
        const extR     = this.lightningNodeExtendRadius[node.stage] || 0;

        // Kill existing active visuals
        this.tweens.killTweensOf(node.pulse);
        this.tweens.killTweensOf(node.radiusRing);
        if (node.activeVisuals?.sparkContainer) {
            this.tweens.killTweensOf(node.activeVisuals.sparkContainer);
            node.activeVisuals.sparkContainer.destroy();
        }
        if (node.activeVisuals?.batteryBars) {
            node.activeVisuals.batteryBars.forEach(b => { this.tweens.killTweensOf(b); b.destroy(); });
        }

        // Redraw tile with stage colour
        node.g.clear();
        node.g.fillStyle(0x0a1520, 0.95);
        node.g.fillRect(node.tileX * ts, node.tileY * ts, ts, ts);
        node.g.lineStyle(2, stageCol, 1);
        node.g.strokeRect(node.tileX * ts, node.tileY * ts, ts, ts);
        node.g.lineStyle(0.8, stageCol, 0.45);
        node.g.beginPath(); node.g.moveTo(node.tileX * ts, node.tileY * ts); node.g.lineTo(node.tileX * ts + ts, node.tileY * ts + ts); node.g.strokePath();
        node.g.beginPath(); node.g.moveTo(node.tileX * ts + ts, node.tileY * ts); node.g.lineTo(node.tileX * ts, node.tileY * ts + ts); node.g.strokePath();
        node.g.beginPath(); node.g.moveTo(node.tileX * ts + ts / 2, node.tileY * ts); node.g.lineTo(node.tileX * ts + ts / 2, node.tileY * ts + ts); node.g.strokePath();
        node.g.beginPath(); node.g.moveTo(node.tileX * ts, node.tileY * ts + ts / 2); node.g.lineTo(node.tileX * ts + ts, node.tileY * ts + ts / 2); node.g.strokePath();
        const cx = node.tileX * ts, cy = node.tileY * ts;
        node.g.lineStyle(3, stageCol, 0.95);
        [[cx, cy], [cx + ts, cy], [cx, cy + ts], [cx + ts, cy + ts]].forEach(([x, y]) => {
            const sx = x === cx ? 1 : -1, sy = y === cy ? 1 : -1;
            node.g.beginPath(); node.g.moveTo(x, y + sy * 5); node.g.lineTo(x, y); node.g.lineTo(x + sx * 5, y); node.g.strokePath();
        });

        // Center pulse
        node.pulse.setRadius(5);
        node.pulse.setFillStyle(stageCol, 1);
        this.tweens.add({ targets: node.pulse, scaleX: 1.6, scaleY: 1.6, alpha: 0.4, duration: 220, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });

        // Inner ring sized to stage base radius
        node.radiusRing.setRadius(baseR * ts);
        node.radiusRing.setStrokeStyle(1.5, stageCol, 0.38);
        node.radiusRing.setAlpha(1);

        // Outer ring (superconducted range) — only stage 2+, visibly distinct
        if (node.extRing) {
            if (extR > 0) {
                node.extRing.setRadius(extR * ts);
                node.extRing.setStrokeStyle(2, stageCol, 0.45);
                node.extRing.setAlpha(1);
            } else {
                node.extRing.setAlpha(0);
            }
        }

        // Battery bars — 3 small bars above tile showing stage
        const batteryBars = [];
        const barW = 5, barH = 8, gap = 3;
        const totalW = this.lightningNodeMaxStage * (barW + gap) - gap;
        const startX = node.px - totalW / 2;
        const barY = node.tileY * ts - 6;
        for (let s = 1; s <= this.lightningNodeMaxStage; s++) {
            const bx = startX + (s - 1) * (barW + gap);
            const filled = s <= node.stage;
            const col = filled ? this.lightningNodeStageColors[s] : 0x222233;
            const bar = this.add.rectangle(bx, barY, barW, barH, col, filled ? 0.9 : 0.4).setOrigin(0, 0.5).setDepth(3);
            if (filled) this.tweens.add({ targets: bar, alpha: 0.6, duration: 250 + s * 80, yoyo: true, repeat: -1 });
            batteryBars.push(bar);
        }

        // Rotating sparks — faster at higher stage
        const sparks = [];
        for (let s = 0; s < 4; s++) {
            const angle = (Math.PI * 2 / 4) * s;
            const sp = this.add.circle(0, 0, 2, stageCol, 1).setDepth(2.5);
            sp.x = Math.cos(angle) * 10; sp.y = Math.sin(angle) * 10;
            sparks.push(sp);
        }
        const sparkContainer = this.add.container(node.px, node.py, sparks).setDepth(2.5);
        this.tweens.add({ targets: sparkContainer, angle: 360, duration: node.stage >= 3 ? 600 : 1000, repeat: -1, ease: 'Linear' });

        // Stage 3: animated rotating arc field instead of static ring
        let stage3Visuals = null;
        if (node.stage >= 3) {
            const arcGfxContainer = this.add.graphics().setDepth(1.35);
            const ringR = (this.lightningNodeBaseRadius[3] || 5) * ts;

            // Rotating segmented arc ring — redrawn every tick
            let arcAngle = 0;
            const arcTimer = this.time.addEvent({
                delay: 40,
                callback: () => {
                    if (!arcGfxContainer.active) { arcTimer.remove(); return; }
                    if (node._stage3TimerCancelled) { arcTimer.remove(); arcGfxContainer.destroy(); return; }
                    arcGfxContainer.clear();
                    arcAngle += 0.04;

                    // 6 arc segments rotating around the ring
                    const segments = 6;
                    for (let s = 0; s < segments; s++) {
                        const startA = arcAngle + (Math.PI * 2 / segments) * s;
                        const endA = startA + 0.55;
                        arcGfxContainer.lineStyle(2.5, 0xfff0aa, 0.55);
                        arcGfxContainer.beginPath();
                        arcGfxContainer.arc(node.px, node.py, ringR, startA, endA, false);
                        arcGfxContainer.strokePath();
                        // Inner bright edge
                        arcGfxContainer.lineStyle(1, 0xffffff, 0.9);
                        arcGfxContainer.beginPath();
                        arcGfxContainer.arc(node.px, node.py, ringR - 2, startA, endA + 0.1, false);
                        arcGfxContainer.strokePath();
                    }

                    // Random outward crackle bolts — fire occasionally
                    if (Math.random() < 0.35) {
                        const boltAngle = Math.random() * Math.PI * 2;
                        const boltLen = 12 + Math.random() * 18;
                        const bx1 = node.px + Math.cos(boltAngle) * (ringR - 4);
                        const by1 = node.py + Math.sin(boltAngle) * (ringR - 4);
                        const midA = boltAngle + (Math.random() - 0.5) * 0.6;
                        const bxm = node.px + Math.cos(midA) * (ringR + boltLen * 0.5);
                        const bym = node.py + Math.sin(midA) * (ringR + boltLen * 0.5);
                        const bx2 = node.px + Math.cos(boltAngle) * (ringR + boltLen);
                        const by2 = node.py + Math.sin(boltAngle) * (ringR + boltLen);
                        arcGfxContainer.lineStyle(1.5, 0xffffff, 0.8);
                        arcGfxContainer.beginPath();
                        arcGfxContainer.moveTo(bx1, by1);
                        arcGfxContainer.lineTo(bxm, bym);
                        arcGfxContainer.lineTo(bx2, by2);
                        arcGfxContainer.strokePath();
                        arcGfxContainer.lineStyle(1, 0xffd966, 0.55);
                        arcGfxContainer.beginPath();
                        arcGfxContainer.moveTo(bx1, by1);
                        arcGfxContainer.lineTo(bxm, bym);
                        arcGfxContainer.lineTo(bx2, by2);
                        arcGfxContainer.strokePath();
                    }
                },
                loop: true
            });

            // Inner halo — faint fill near the node
            const innerHalo = this.add.circle(node.px, node.py, ts * 1.4, 0xfff0aa, 0.07).setDepth(1.3);

            stage3Visuals = { arcGfxContainer, arcTimer, innerHalo };
        }

        // Timer bar visible
        if (node.timerBarBg) {
            node.timerBarBg.setVisible(true);
            node.timerBarFill.setVisible(true);
            node.timerBarFill.width = ts + 4;
        }

        // Activation flash
        const flash = this.add.rectangle(node.tileX * ts, node.tileY * ts, ts, ts, stageCol, 0.55).setOrigin(0).setDepth(3);
        this.tweens.add({ targets: flash, alpha: 0, duration: 250, onComplete: () => flash.destroy() });

        node.activeVisuals = { sparkContainer, batteryBars, stage3Visuals };
    }

    destroyLightningNode(node) {
        this.tweens.killTweensOf(node.pulse);
        this.tweens.killTweensOf(node.radiusRing);
        if (node.g && node.g.active) node.g.destroy();
        if (node.pulse && node.pulse.active) node.pulse.destroy();
        if (node.radiusRing && node.radiusRing.active) node.radiusRing.destroy();
        if (node.extRing && node.extRing.active) node.extRing.destroy();
        if (node.timerBarBg && node.timerBarBg.active) node.timerBarBg.destroy();
        if (node.timerBarFill && node.timerBarFill.active) node.timerBarFill.destroy();
        if (node.arcGraphics && node.arcGraphics.active) node.arcGraphics.destroy();
        if (node.activeVisuals) {
            if (node.activeVisuals.sparkContainer) {
                this.tweens.killTweensOf(node.activeVisuals.sparkContainer);
                node.activeVisuals.sparkContainer.destroy();
            }
            if (node.activeVisuals.batteryBars) {
                node.activeVisuals.batteryBars.forEach(b => { this.tweens.killTweensOf(b); if (b.active) b.destroy(); });
            }
            if (node.activeVisuals.stage3Visuals) {
                const s3 = node.activeVisuals.stage3Visuals;
                node._stage3TimerCancelled = true;
                if (s3.arcTimer) s3.arcTimer.remove();
                if (s3.arcGfxContainer && s3.arcGfxContainer.active) s3.arcGfxContainer.destroy();
                if (s3.innerHalo && s3.innerHalo.active) s3.innerHalo.destroy();
            }
            if (node.activeVisuals.purpleGlow) {
                this.tweens.killTweensOf(node.activeVisuals.purpleGlow);
                if (node.activeVisuals.purpleGlow.active) node.activeVisuals.purpleGlow.destroy();
            }
        }
    }

    updateLightningNodes(time) {
        for (let i = this.lightningNodes.length - 1; i >= 0; i--) {
            const node = this.lightningNodes[i];

            // Deactivate (not destroy) when timer runs out
            if (node.active && time >= node.expiresAt) {
                this.deactivateLightningNode(node);
                continue;
            }

            if (!node.active) continue;

            const stageBaseR = this.lightningNodeBaseRadius ? (this.lightningNodeBaseRadius[node.stage] || 3) : 3;
            const stageExtR  = this.lightningNodeExtendRadius ? (this.lightningNodeExtendRadius[node.stage] || 0) : 0;

            // Update charge timer bar
            if (node.timerBarBg && node.timerBarBg.active) {
                const remaining = Math.max(0, node.expiresAt - time);
                const pct = remaining / this.lightningNodeDuration;
                node.timerBarFill.width = (this.TILE_SIZE + 4) * pct;
                const timerCol = pct > 0.5 ? 0x00ccff : pct > 0.25 ? 0xff8800 : 0xff2200;
                node.timerBarFill.setFillStyle(timerCol, 0.85);
            }

            // Stage 3: superconduct pulse every 3s
            if (node.stage >= 3 && time - (node.lastPulseTime || 0) >= 3000) {
                node.lastPulseTime = time;
                const maxPx = stageExtR * this.TILE_SIZE;
                const pRing = this.add.circle(node.px, node.py, 8, 0xfff0aa, 0).setDepth(2.5);
                pRing.setStrokeStyle(3, 0xffffff, 0.85);
                this.tweens.add({ targets: pRing, radius: maxPx, alpha: 0, duration: 700, ease: 'Quad.easeOut', onComplete: () => pRing.destroy() });
                for (let enemy of this.enemies) {
                    const pd = Math.abs(enemy.x - node.tileX) + Math.abs(enemy.y - node.tileY);
                    if (pd <= stageExtR) {
                        this.applySuperConduct(enemy);
                        this.drawLightningBolt({ sprite: { x: node.px, y: node.py } }, enemy);
                        // Stun instead of knockback
                        const stunDuration = 1500;
                        enemy.isStunned = true;
                        enemy.stunnedUntil = time + stunDuration;

                        // Show stun status text
                        if (enemy.sprite && enemy.sprite.active) {
                            this.showStatusText(enemy.sprite.x, enemy.sprite.y, 'STUNNED', '#ffee00');

                            // Visual feedback - flash yellow
                            enemy.sprite.setTint(0xffff00);
                            this.time.delayedCall(stunDuration, () => {
                                if (enemy.sprite && enemy.sprite.active) {
                                    enemy.sprite.clearTint();
                                    enemy.isStunned = false;
                                }
                            });
                        }
                    }
                }
            }

            if (time - node.lastZapTime < this.lightningNodeZapInterval) {
                // not yet time to zap — fall through to arc drawing
            } else {
                node.lastZapTime = time;
                const globalHit = [];

                // Find all enemies in range of this node
                for (let enemy of this.enemies) {
                    if (globalHit.includes(enemy)) continue;
                    const d = Math.abs(enemy.x - node.tileX) + Math.abs(enemy.y - node.tileY);
                    const inBase = d <= stageBaseR;
                    const inExt  = stageExtR > 0 && enemy.isSuperConducted && d <= stageExtR;
                    if (!inBase && !inExt) continue;

                    // Count how many nodes can reach this enemy (circuit completion)
                    const nodesInRange = this.lightningNodes.filter(n => {
                        if (!n.active) return false;
                        const nr = this.lightningNodeBaseRadius ? (this.lightningNodeBaseRadius[n.stage] || 3) : 3;
                        const ne = this.lightningNodeExtendRadius ? (this.lightningNodeExtendRadius[n.stage] || 0) : 0;
                        const nd = Math.abs(enemy.x - n.tileX) + Math.abs(enemy.y - n.tileY);
                        return nd <= nr || (enemy.isSuperConducted && nd <= ne);
                    });

                    const nodeCount = nodesInRange.length;

                    // Circuit damage multiplier: 1 node = 1x, 2 nodes = 3x, 3 nodes = 8x
                    let circuitMultiplier;
                    if (nodeCount === 1) {
                        circuitMultiplier = 1;
                    } else if (nodeCount === 2) {
                        circuitMultiplier = 3;
                    } else {
                        circuitMultiplier = 8;
                    }

                    const dmg = this.lightningNodeDamage * this.damageScaling * circuitMultiplier;

                    // Draw bolt from EACH node in range to the enemy
                    for (let sourceNode of nodesInRange) {
                        this.drawLightningBolt({ sprite: { x: sourceNode.px, y: sourceNode.py } }, enemy);
                    }

                    this.performChainLightningShared(enemy, dmg, globalHit, this.lightningChainFalloff);
                    this.gainUltCharge(this.ultChargePerChain * (0.5 * nodeCount));

                    if (nodeCount > 1 && enemy.sprite && enemy.sprite.active) {
                        this.showStatusText(enemy.sprite.x, enemy.sprite.y,
                            `${nodeCount}-CIRCUIT x${circuitMultiplier}`, '#ffff88');
                    }
                }
            }
            // Draw arcs between active nodes
            if (node.arcGraphics) { node.arcGraphics.destroy(); node.arcGraphics = null; }

            // Always show radius ring when active (so player can see coverage)
            // (handled by radiusRing tween in activateLightningNode — just keep it visible)

            for (let other of this.lightningNodes) {
                if (other === node || !other.active) continue;
                const dx = other.tileX - node.tileX;
                const dy = other.tileY - node.tileY;
                const nodeDist = Math.sqrt(dx * dx + dy * dy);
                if (nodeDist > this.lightningNodeChainRange) continue;

                // Check if a superconducted enemy bridges them
                let bridgeEnemy = null;
                for (let e of this.enemies) {
                    if (!e.isSuperConducted || !e.sprite || !e.sprite.active) continue;
                    const inRangeOfThis = Math.abs(e.x - node.tileX) + Math.abs(e.y - node.tileY) <= this.lightningNodeRadius;
                    const inRangeOfOther = Math.abs(e.x - other.tileX) + Math.abs(e.y - other.tileY) <= this.lightningNodeRadius;
                    if (inRangeOfThis && inRangeOfOther) { bridgeEnemy = e; break; }
                    // Also accept enemy near the line between nodes
                    const d = this.pointToLineDistance(e.sprite.x, e.sprite.y, node.px, node.py, other.px, other.py);
                    if (d <= this.TILE_SIZE * 2 && (inRangeOfThis || inRangeOfOther)) { bridgeEnemy = e; break; }
                }

                const directConnect = nodeDist <= this.lightningNodeRadius * 2;

                if (!node.arcGraphics) node.arcGraphics = this.add.graphics().setDepth(2);

                if (bridgeEnemy) {
                    // Arc routes through the enemy: node → enemy → other node
                    const ex = bridgeEnemy.sprite.x, ey = bridgeEnemy.sprite.y;
                    this.drawNodeArc(node.arcGraphics, node.px, node.py, ex, ey);
                    this.drawNodeArc(node.arcGraphics, ex, ey, other.px, other.py);
                } else if (directConnect) {
                    // Nodes overlap directly — straight arc
                    this.drawNodeArc(node.arcGraphics, node.px, node.py, other.px, other.py);
                } else {
                    // Dim dashed potential line
                    node.arcGraphics.lineStyle(1, 0x004466, 0.2);
                    const steps = 12;
                    for (let s = 0; s < steps; s += 2) {
                        const t1 = s / steps, t2 = (s + 1) / steps;
                        node.arcGraphics.beginPath();
                        node.arcGraphics.moveTo(node.px + (other.px - node.px) * t1, node.py + (other.py - node.py) * t1);
                        node.arcGraphics.lineTo(node.px + (other.px - node.px) * t2, node.py + (other.py - node.py) * t2);
                        node.arcGraphics.strokePath();
                    }
                }
            }
        }
    }

    deactivateLightningNode(node) {
        node.active = false;
        node.expiresAt = 0;
        const ts = this.TILE_SIZE;

        // Kill active tweens
        this.tweens.killTweensOf(node.pulse);
        this.tweens.killTweensOf(node.radiusRing);
        if (node.arcGraphics) { node.arcGraphics.destroy(); node.arcGraphics = null; }
        if (node.activeVisuals?.sparkContainer) {
            this.tweens.killTweensOf(node.activeVisuals.sparkContainer);
            node.activeVisuals.sparkContainer.destroy();
        }
        if (node.activeVisuals?.batteryBars) {
            node.activeVisuals.batteryBars.forEach(b => { this.tweens.killTweensOf(b); if (b.active) b.destroy(); });
        }
        if (node.activeVisuals?.stage3Visuals) {
            const s3 = node.activeVisuals.stage3Visuals;
            node._stage3TimerCancelled = true;
            if (s3.arcTimer) s3.arcTimer.remove();
            if (s3.arcGfxContainer && s3.arcGfxContainer.active) s3.arcGfxContainer.destroy();
            if (s3.innerHalo && s3.innerHalo.active) {
                this.tweens.killTweensOf(s3.innerHalo);
                s3.innerHalo.destroy();
            }
        }
        node._stage3TimerCancelled = false;
        if (node.activeVisuals?.purpleGlow) {
            this.tweens.killTweensOf(node.activeVisuals.purpleGlow);
            if (node.activeVisuals.purpleGlow.active) node.activeVisuals.purpleGlow.destroy();
        }
        node.activeVisuals = null;

        // Revert tile to dormant look
        node.g.clear();
        node.g.fillStyle(0x1a2a3a, 0.88);
        node.g.fillRect(node.tileX * ts, node.tileY * ts, ts, ts);
        node.g.lineStyle(1.5, 0x335566, 0.9);
        node.g.strokeRect(node.tileX * ts, node.tileY * ts, ts, ts);
        node.g.lineStyle(0.5, 0x224455, 0.45);
        node.g.beginPath(); node.g.moveTo(node.tileX * ts, node.tileY * ts); node.g.lineTo(node.tileX * ts + ts, node.tileY * ts + ts); node.g.strokePath();
        node.g.beginPath(); node.g.moveTo(node.tileX * ts + ts, node.tileY * ts); node.g.lineTo(node.tileX * ts, node.tileY * ts + ts); node.g.strokePath();
        node.g.beginPath(); node.g.moveTo(node.tileX * ts + ts / 2, node.tileY * ts); node.g.lineTo(node.tileX * ts + ts / 2, node.tileY * ts + ts); node.g.strokePath();
        node.g.beginPath(); node.g.moveTo(node.tileX * ts, node.tileY * ts + ts / 2); node.g.lineTo(node.tileX * ts + ts, node.tileY * ts + ts / 2); node.g.strokePath();

        // Revert pulse to dim dormant state
        node.pulse.setRadius(4);
        node.pulse.setFillStyle(0x226688, 0.5);
        this.tweens.add({ targets: node.pulse, alpha: 0.15, duration: 1200, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });

        // Dim both rings back to dormant
        this.tweens.killTweensOf(node.radiusRing);
        node.radiusRing.setStrokeStyle(1, 0x4488aa, 0.14);
        node.radiusRing.setAlpha(1);

        if (node.extRing) {
            node.extRing.setStrokeStyle(1, 0x226644, 0.07);
            node.extRing.setAlpha(1);
        }

        // Hide timer bar
        if (node.timerBarBg) { node.timerBarBg.setVisible(false); node.timerBarFill.setVisible(false); }

        node.stage = 0;

        // Small deactivation flash
        const flash = this.add.circle(node.px, node.py, 12, 0x004466, 0.5).setDepth(3);
        this.tweens.add({ targets: flash, radius: 22, alpha: 0, duration: 200, onComplete: () => flash.destroy() });
    }

    drawNodeArc(gfx, x1, y1, x2, y2) {
        const segments = 10;
        const points = [];
        for (let i = 0; i <= segments; i++) {
            const t = i / segments;
            const x = x1 + (x2 - x1) * t;
            const y = y1 + (y2 - y1) * t;
            const dx = x2 - x1, dy = y2 - y1;
            const len = Math.sqrt(dx * dx + dy * dy);
            const px2 = -dy / len, py2 = dx / len;
            const offset = i > 0 && i < segments ? (Math.random() - 0.5) * 12 : 0;
            points.push({ x: x + px2 * offset, y: y + py2 * offset });
        }
        gfx.lineStyle(6, 0x00aaff, 0.18);
        gfx.beginPath(); gfx.moveTo(points[0].x, points[0].y);
        for (let i = 1; i < points.length; i++) gfx.lineTo(points[i].x, points[i].y);
        gfx.strokePath();
        gfx.lineStyle(3, 0x88eeff, 0.5);
        gfx.beginPath(); gfx.moveTo(points[0].x, points[0].y);
        for (let i = 1; i < points.length; i++) gfx.lineTo(points[i].x, points[i].y);
        gfx.strokePath();
        gfx.lineStyle(1.5, 0xffffff, 0.9);
        gfx.beginPath(); gfx.moveTo(points[0].x, points[0].y);
        for (let i = 1; i < points.length; i++) gfx.lineTo(points[i].x, points[i].y);
        gfx.strokePath();
    }

    showNodePlacementRing() {
        this.clearNodePlacementRing();
        const g = this.add.graphics().setDepth(4);
        this._nodePlacementRing = { g };
        this._redrawPlacementRing();

        // Label
        const lbl = this.add.text(this.scale.width / 2, 55, 'Q  NODE MODE  [CLICK TO PLACE]', {
            fontSize: '12px', fontFamily: 'monospace', color: '#00ccff',
            stroke: '#000000', strokeThickness: 3
        }).setOrigin(0.5).setScrollFactor(0).setDepth(30);
        this.tweens.add({ targets: lbl, alpha: 0.6, duration: 400, yoyo: true, repeat: -1 });
        this._nodeModeLabel = lbl;
    }

    clearNodePlacementRing() {
        if (this._nodePlacementRing) {
            if (this._nodePlacementRing.g.active) this._nodePlacementRing.g.destroy();
            this._nodePlacementRing = null;
        }
    }

    clearNodeMode() {
        this.lightningNodeMode = false;
        this.clearNodePreview();
        this.clearNodePlacementRing();
        if (this._nodeModeLabel) {
            this.tweens.killTweensOf(this._nodeModeLabel);
            this._nodeModeLabel.destroy();
            this._nodeModeLabel = null;
        }
    }

    updateNodePreview(tileX, tileY) {
        const onFloor = tileX >= 0 && tileX < this.WORLD_WIDTH && tileY >= 0 && tileY < this.WORLD_HEIGHT && this.world[tileX][tileY] === this.FLOOR;
        const inRange = Math.abs(tileX - this.playerX) + Math.abs(tileY - this.playerY) <= 3;
        const valid = onFloor && inRange;

        const px = tileX * this.TILE_SIZE;
        const py = tileY * this.TILE_SIZE;
        const ts = this.TILE_SIZE;

        if (!this.lightningNodePreview) {
            const g = this.add.graphics().setDepth(4);
            const radiusRing = this.add.circle(
                px + ts / 2, py + ts / 2,
                this.lightningNodeRadius * ts, 0x0088cc, 0
            ).setDepth(3.5);
            radiusRing.setStrokeStyle(1, 0x00ccff, 0.35);
            this.lightningNodePreview = { g, radiusRing, lastTileX: tileX, lastTileY: tileY };
        }

        const p = this.lightningNodePreview;
        p.g.clear();

        // Ghost tile — full tile rectangle with crosshatch detail
        const col = valid ? 0x0088cc : 0x884400;
        const strokeCol = valid ? 0x00ccff : 0xff6600;
        const alpha = valid ? 0.25 : 0.15;

        p.g.fillStyle(col, alpha);
        p.g.fillRect(px, py, ts, ts);
        p.g.lineStyle(1, strokeCol, 0.7);
        p.g.strokeRect(px, py, ts, ts);
        // Crosshatch lines
        p.g.lineStyle(1, strokeCol, 0.2);
        p.g.beginPath(); p.g.moveTo(px, py); p.g.lineTo(px + ts, py + ts); p.g.strokePath();
        p.g.beginPath(); p.g.moveTo(px + ts, py); p.g.lineTo(px, py + ts); p.g.strokePath();
        // Center pulse dot
        p.g.fillStyle(strokeCol, valid ? 0.7 : 0.3);
        p.g.fillCircle(px + ts / 2, py + ts / 2, 3);

        // Move radius ring
        p.radiusRing.x = px + ts / 2;
        p.radiusRing.y = py + ts / 2;
        p.radiusRing.setStrokeStyle(1, strokeCol, valid ? 0.35 : 0.15);
    }

    _redrawPlacementRing() {
        if (!this._nodePlacementRing) return;
        const g = this._nodePlacementRing.g;
        if (!g.active) return;
        const radiusPx = 3 * this.TILE_SIZE + this.TILE_SIZE / 2;
        const cx = this.player.x, cy = this.player.y;
        g.clear();
        for (let i = 0; i < 24; i += 2) {
            const a1 = (Math.PI * 2 / 24) * i;
            const a2 = (Math.PI * 2 / 24) * (i + 1);
            g.lineStyle(2, 0x00ccff, 0.5);
            g.beginPath(); g.arc(cx, cy, radiusPx, a1, a2, false); g.strokePath();
        }
    }

    clearNodePreview() {
        if (this.lightningNodePreview) {
            if (this.lightningNodePreview.g.active) this.lightningNodePreview.g.destroy();
            if (this.lightningNodePreview.radiusRing.active) this.lightningNodePreview.radiusRing.destroy();
            this.lightningNodePreview = null;
        }
    }

    // ─── ARC PROJECTILE (right click) ──────────────────────────────────

    fireArcProjectile(screenX, screenY) {
        const currentTime = this.time.now;
        if (currentTime - this.lastFireballTime < this.lightningCooldown) return;
        if (this.nodeChannelActive) this.cancelNodeChannel();
        this.lastFireballTime = currentTime;

        const playerPixelX = this.playerX * this.TILE_SIZE + this.TILE_SIZE / 2;
        const playerPixelY = this.playerY * this.TILE_SIZE + this.TILE_SIZE / 2;
        const worldX = screenX + this.cameras.main.scrollX;
        const worldY = screenY + this.cameras.main.scrollY;
        const dx = worldX - playerPixelX, dy = worldY - playerPixelY;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist === 0) return;

        const speed = 100;
        const g = this.add.graphics().setDepth(3);
        g.x = playerPixelX; g.y = playerPixelY;

        this.lightningProjectiles.push({
            g, vx: (dx / dist) * speed, vy: (dy / dist) * speed,
            startX: playerPixelX,
            startY: playerPixelY,
            createdAt: currentTime,
            lastCrackleTime: currentTime,
            lastZapTime: currentTime,
            zapInterval: 300,
            zapRadius: 10,
            piercedEnemies: new Set()
        });
    }

    drawOrbProjectile(g, time) {
        g.clear();
        const pulse = 0.6 + Math.sin(time / 70) * 0.4;
        const flicker = 0.7 + Math.sin(time / 33) * 0.3;

        // Core body only — no faint outer halos
        g.fillStyle(0x33aaff, 0.8 * flicker);
        g.fillCircle(0, 0, 10);

        // Bright center
        g.fillStyle(0xffffff, 0.95 * pulse);
        g.fillCircle(0, 0, 4);

        // Short irregular crackling arcs — tight around the orb
        const numArcs = 4 + Math.floor(Math.random() * 4);
        for (let i = 0; i < numArcs; i++) {
            const baseA = Math.random() * Math.PI * 2;
            const r1 = 8 + Math.random() * 2;        // starts at edge of core
            const r2 = 12 + Math.random() * 6;        // short reach — was 15-29
            const jags = Math.random() < 0.5 ? 1 : 2;
            let prevX = Math.cos(baseA) * r1, prevY = Math.sin(baseA) * r1;

            g.lineStyle(1 + Math.random(), 0x88ddff, 0.5 + Math.random() * 0.4);
            g.beginPath();
            g.moveTo(prevX, prevY);
            for (let j = 0; j < jags; j++) {
                const t = (j + 1) / (jags + 1);
                const jagA = baseA + (Math.random() - 0.5) * 1.4;
                const jagR = r1 + (r2 - r1) * t + (Math.random() - 0.5) * 3;
                prevX = Math.cos(jagA) * jagR;
                prevY = Math.sin(jagA) * jagR;
                g.lineTo(prevX, prevY);
            }
            const endA = baseA + (Math.random() - 0.5) * 0.8;
            g.lineTo(Math.cos(endA) * r2, Math.sin(endA) * r2);
            g.strokePath();

            if (Math.random() < 0.6) {
                g.fillStyle(0xffffff, 0.7 + Math.random() * 0.3);
                g.fillCircle(Math.cos(endA) * r2, Math.sin(endA) * r2, 1 + Math.random() * 0.8);
            }
        }
    }

    updateArcProjectiles(delta) {
        const ds = delta / 1000;
        const time = this.time.now;
        for (let i = this.lightningProjectiles.length - 1; i >= 0; i--) {
            const p = this.lightningProjectiles[i];
            p.g.x += p.vx * ds;
            p.g.y += p.vy * ds;

            // Max range check (20 tiles)
            const distTraveled = Math.sqrt(
                Math.pow(p.g.x - p.startX, 2) +
                Math.pow(p.g.y - p.startY, 2)
            );
            const maxRange = 20 * this.TILE_SIZE;
            if (distTraveled > maxRange) {
                p.g.destroy();
                this.lightningProjectiles.splice(i, 1);
                continue;
            }

            const tileX = Math.floor(p.g.x / this.TILE_SIZE);
            const tileY = Math.floor(p.g.y / this.TILE_SIZE);

            // Wall/out of bounds/locked room barrier
            if (tileX < 0 || tileX >= this.WORLD_WIDTH || tileY < 0 || tileY >= this.WORLD_HEIGHT ||
                this.world[tileX][tileY] === this.WALL || this.isInLockedRoom(tileX, tileY)) {
                p.g.destroy();
                this.lightningProjectiles.splice(i, 1);
                continue;
            }

            // Crackle trail
            if (time - p.lastCrackleTime > 35) {
                p.lastCrackleTime = time;
                const tr = this.add.circle(p.g.x+(Math.random()-0.5)*5, p.g.y+(Math.random()-0.5)*5, 2+Math.random()*2, 0x44ccff, 0.5).setDepth(2.5);
                this.tweens.add({ targets: tr, alpha: 0, scale: 0.1, duration: 200, onComplete: () => tr.destroy() });
            }

            // Redraw orb every frame for live crackle feel
            this.drawOrbProjectile(p.g, time);

            // Direct hit — superconduct + chain (pierce, don't destroy)
            for (let enemy of this.enemies) {
                if (p.piercedEnemies.has(enemy)) continue;
                const ex = enemy.sprite.x, ey = enemy.sprite.y;
                if (Math.abs(ex - p.g.x) < this.TILE_SIZE * 0.9 && Math.abs(ey - p.g.y) < this.TILE_SIZE * 0.9) {
                    p.piercedEnemies.add(enemy);
                    this.applySuperConduct(enemy);
                    this.drawLightningBolt({ sprite: { x: p.g.x, y: p.g.y } }, enemy);
                    this.performChainLightning(enemy, this.baseLightningDamage * this.damageScaling, [], this.lightningChainFalloff);
                    this.gainUltCharge(this.ultChargePerChain * 0.2);
                }
            }

            // Node hit — charge it, destroy projectile
            let hitNode = false;
            for (let node of this.lightningNodes) {
                if (Math.abs(node.px - p.g.x) < this.TILE_SIZE * 1.2 && Math.abs(node.py - p.g.y) < this.TILE_SIZE * 1.2) {
                    this.activateLightningNode(node);
                    for (let other of this.lightningNodes) {
                        if (other === node || !other.active) continue;
                        const d = Math.sqrt((other.tileX-node.tileX)**2 + (other.tileY-node.tileY)**2);
                        if (d <= this.lightningNodeChainRange) {
                            const g2 = this.add.graphics().setDepth(3);
                            this.drawNodeArc(g2, node.px, node.py, other.px, other.py);
                            this.tweens.add({ targets: g2, alpha: 0, duration: 400, onComplete: () => g2.destroy() });
                        }
                    }
                    p.g.destroy();
                    this.lightningProjectiles.splice(i, 1);
                    hitNode = true;
                    break;
                }
            }
            if (hitNode) continue;

            // Periodic area zap — reduced damage, but chains from ALL enemies in range
            if (!p.lastZapTime) p.lastZapTime = time;
            if (time - p.lastZapTime >= (p.zapInterval || 500)) {
                p.lastZapTime = time;
                const enemiesInRange = [];

                // First pass: find all enemies in range
                for (let enemy of this.enemies) {
                    if (p.piercedEnemies.has(enemy)) continue; // already directly hit
                    const d = Math.abs(enemy.x - tileX) + Math.abs(enemy.y - tileY);
                    if (d <= (p.zapRadius || 10)) {
                        enemiesInRange.push(enemy);
                    }
                }

                // Second pass: hit each enemy directly from orb (no skipping!)
                const zapGlobalHit = [];
                for (let enemy of enemiesInRange) {
                    // Hit this enemy directly - always
                    this.drawLightningBolt({ sprite: { x: p.g.x, y: p.g.y } }, enemy);
                    this.damageEnemy(enemy, this.baseLightningDamage * this.damageScaling * 0.5);

                    // Flash
                    enemy.sprite.setTint(0xffff00);
                    this.time.delayedCall(100, () => {
                        if (enemy.sprite && enemy.sprite.active) {
                            enemy.sprite.clearTint();
                        }
                    });

                    // Mark as hit for chains
                    zapGlobalHit.push(enemy);
                }

                // Third pass: chain from each hit enemy
                for (let enemy of enemiesInRange) {
                    // Find nearest unchained enemy to chain to
                    let nearestEnemy = null;
                    let nearestDist = Infinity;

                    for (let other of this.enemies) {
                        if (zapGlobalHit.includes(other)) continue;
                        const dist = Math.abs(other.x - enemy.x) + Math.abs(other.y - enemy.y);
                        if (dist <= this.lightningChainRange && dist < nearestDist) {
                            nearestEnemy = other;
                            nearestDist = dist;
                        }
                    }

                    if (nearestEnemy) {
                        this.drawLightningBolt(enemy, nearestEnemy);
                        this.performChainLightningShared(
                            nearestEnemy,
                            this.baseLightningDamage * this.damageScaling * 0.5 * this.lightningChainFalloff,
                            zapGlobalHit,
                            this.lightningChainFalloff
                        );
                    }
                }

                // Zap ring visual
                if (enemiesInRange.length > 0) {
                    const ring = this.add.circle(p.g.x, p.g.y, (p.zapRadius||10) * this.TILE_SIZE, 0x44ccff, 0);
                    ring.setStrokeStyle(1, 0x44ccff, 0.3).setDepth(2.5);
                    this.tweens.add({ targets: ring, alpha: 0, scaleX: 1.2, scaleY: 1.2, duration: 180, onComplete: () => ring.destroy() });
                }
            }
        }
    }

    shootChainLightning(targetX, targetY) {
        const worldX = targetX + this.cameras.main.scrollX;
        const worldY = targetY + this.cameras.main.scrollY;

        const targetTileX = Math.floor(worldX / this.TILE_SIZE);
        const targetTileY = Math.floor(worldY / this.TILE_SIZE);

        let targetEnemy = null;
        let minDist = Infinity;

        for (let enemy of this.enemies) {
            const dist = Math.abs(enemy.x - targetTileX) + Math.abs(enemy.y - targetTileY);
            if (dist < minDist) {
                minDist = dist;
                targetEnemy = enemy;
            }
        }

        if (minDist <= 2) {
            this.drawLightningBolt({ sprite: this.player }, targetEnemy);
            const falloff = this.stormCloudActive ? this.lightningUltChainFalloff : this.lightningChainFalloff;
            const hitEnemies = [];
            this.performChainLightning(targetEnemy, this.baseLightningDamage * this.damageScaling, hitEnemies, falloff);
            // Flat charge per click regardless of chain length
            this.gainUltCharge(this.ultChargePerChain);
        }
    }

    performChainLightning(sourceEnemy, damage, hitEnemies, falloff) {
        hitEnemies.push(sourceEnemy);
        this.damageEnemy(sourceEnemy, damage);
        this.damageBossAtTile(sourceEnemy.x, sourceEnemy.y, damage);
        if (Math.random() < this.orbDropChance && sourceEnemy.sprite && sourceEnemy.sprite.active) {
            this.spawnOrbScrap(sourceEnemy.sprite.x, sourceEnemy.sprite.y);
        }

        sourceEnemy.sprite.setTint(0xffff00);
        this.time.delayedCall(100, () => {
            if (sourceEnemy.sprite && sourceEnemy.sprite.active) {
                sourceEnemy.sprite.clearTint();
            }
        });

        let nearestEnemy = null;
        let nearestDist = Infinity;

        for (let enemy of this.enemies) {
            if (hitEnemies.includes(enemy)) continue;

            const dist = Math.abs(enemy.x - sourceEnemy.x) + Math.abs(enemy.y - sourceEnemy.y);

            if (dist <= this.lightningChainRange && dist < nearestDist) {
                nearestEnemy = enemy;
                nearestDist = dist;
            }
        }

        if (nearestEnemy) {
            this.drawLightningBolt(sourceEnemy, nearestEnemy);

            const nextDamage = damage * falloff;

            this.performChainLightning(nearestEnemy, nextDamage, hitEnemies, falloff);
        } else {
        }
    }

    drawLightningBolt(fromEnemy, toEnemy) {
        const fromX = fromEnemy.sprite.x;
        const fromY = fromEnemy.sprite.y + 8;
        const toX = toEnemy.sprite.x;
        const toY = toEnemy.sprite.y + 8;

        const graphics = this.add.graphics();

        // MAIN BOLT - bright yellow core
        graphics.lineStyle(4, 0xffff00, 1);

        const segments = 8; // More segments for more jagged look
        const points = [];

        for (let i = 0; i <= segments; i++) {
            const t = i / segments;
            const x = fromX + (toX - fromX) * t;
            const y = fromY + (toY - fromY) * t;

            if (i > 0 && i < segments) {
                const dx = toX - fromX;
                const dy = toY - fromY;
                const length = Math.sqrt(dx * dx + dy * dy);

                const perpX = -dy / length;
                const perpY = dx / length;

                // More aggressive jagged offsets
                const offset = (Math.random() - 0.5) * 20;

                points.push({
                    x: x + perpX * offset,
                    y: y + perpY * offset
                });
            } else {
                points.push({ x, y });
            }
        }

        // OUTER GLOW (white/cyan)
        graphics.lineStyle(12, 0xaaffff, 0.3);
        graphics.beginPath();
        graphics.moveTo(points[0].x, points[0].y);
        for (let i = 1; i < points.length; i++) {
            graphics.lineTo(points[i].x, points[i].y);
        }
        graphics.strokePath();

        // MIDDLE LAYER (bright white)
        graphics.lineStyle(8, 0xffffff, 0.6);
        graphics.beginPath();
        graphics.moveTo(points[0].x, points[0].y);
        for (let i = 1; i < points.length; i++) {
            graphics.lineTo(points[i].x, points[i].y);
        }
        graphics.strokePath();

        // CORE BOLT (bright yellow)
        graphics.lineStyle(4, 0xffff00, 1);
        graphics.beginPath();
        graphics.moveTo(points[0].x, points[0].y);
        for (let i = 1; i < points.length; i++) {
            graphics.lineTo(points[i].x, points[i].y);
        }
        graphics.strokePath();

        // INNER BRIGHT LINE (pure white)
        graphics.lineStyle(2, 0xffffff, 1);
        graphics.beginPath();
        graphics.moveTo(points[0].x, points[0].y);
        for (let i = 1; i < points.length; i++) {
            graphics.lineTo(points[i].x, points[i].y);
        }
        graphics.strokePath();

        // SECONDARY FORKS — travel visibly fast (60ms) instead of instant
        for (let i = 1; i < points.length - 1; i++) {
            if (Math.random() < 0.5) {
                const forkLength = 15 + Math.random() * 25;
                const angle = Math.random() * Math.PI * 2;
                const forkMidX = points[i].x + Math.cos(angle) * (forkLength * 0.6);
                const forkMidY = points[i].y + Math.sin(angle) * (forkLength * 0.6);
                const forkEndX = points[i].x + Math.cos(angle + (Math.random() - 0.5) * 0.5) * forkLength;
                const forkEndY = points[i].y + Math.sin(angle + (Math.random() - 0.5) * 0.5) * forkLength;

                // Draw fork as a separate graphics that fades slightly slower than main bolt
                // giving a visible "travel" effect — appears just after main bolt, fades after
                const forkGfx = this.add.graphics().setAlpha(0);
                forkGfx.lineStyle(6, 0xaaffff, 0.3);
                forkGfx.beginPath(); forkGfx.moveTo(points[i].x, points[i].y); forkGfx.lineTo(forkMidX, forkMidY); forkGfx.lineTo(forkEndX, forkEndY); forkGfx.strokePath();
                forkGfx.lineStyle(2, 0xffff00, 0.9);
                forkGfx.beginPath(); forkGfx.moveTo(points[i].x, points[i].y); forkGfx.lineTo(forkMidX, forkMidY); forkGfx.lineTo(forkEndX, forkEndY); forkGfx.strokePath();
                forkGfx.lineStyle(1, 0xffffff, 1);
                forkGfx.beginPath(); forkGfx.moveTo(points[i].x, points[i].y); forkGfx.lineTo(forkMidX, forkMidY); forkGfx.lineTo(forkEndX, forkEndY); forkGfx.strokePath();

                // Flash in quickly then fade — fast enough to look like travel, slow enough to see
                this.tweens.add({
                    targets: forkGfx, alpha: 0.9, duration: 25,
                    onComplete: () => {
                        this.tweens.add({ targets: forkGfx, alpha: 0, duration: 140, onComplete: () => forkGfx.destroy() });
                    }
                });
            }
        }

        // IMPACT SPARKS at destination
        const numSparks = 8;
        for (let i = 0; i < numSparks; i++) {
            const angle = (Math.PI * 2 / numSparks) * i + Math.random() * 0.3;
            const length = 8 + Math.random() * 12;
            const endX = toX + Math.cos(angle) * length;
            const endY = toY + Math.sin(angle) * length;

            graphics.lineStyle(2, 0xffff00, 0.8);
            graphics.beginPath();
            graphics.moveTo(toX, toY);
            graphics.lineTo(endX, endY);
            graphics.strokePath();
        }

        // ORIGIN GLOW
        const originGlow = this.add.circle(fromX, fromY, 8, 0xffff00, 0.6);
        originGlow.setStrokeStyle(2, 0xffffff, 0.8);

        // DESTINATION IMPACT
        const impactFlash = this.add.circle(toX, toY, 12, 0xffffff, 0.9);
        const impactRing = this.add.circle(toX, toY, 12, 0xffff00, 0);
        impactRing.setStrokeStyle(3, 0xffff00, 1);

        // Animate impact
        this.tweens.add({
            targets: [impactFlash, impactRing],
            scaleX: 2,
            scaleY: 2,
            alpha: 0,
            duration: 200,
            ease: 'Quad.easeOut',
            onComplete: () => {
                impactFlash.destroy();
                impactRing.destroy();
            }
        });

        // Fade out origin glow
        this.tweens.add({
            targets: originGlow,
            alpha: 0,
            scaleX: 1.5,
            scaleY: 1.5,
            duration: 150,
            onComplete: () => originGlow.destroy()
        });

        // Main bolt fade out (faster)
        this.tweens.add({
            targets: graphics,
            alpha: 0,
            duration: 120,
            onComplete: () => {
                graphics.destroy();
            }
        });
    }

    deployStormField(targetX, targetY) {

        const worldX = targetX + this.cameras.main.scrollX;
        const worldY = targetY + this.cameras.main.scrollY;

        const tileX = Math.floor(worldX / this.TILE_SIZE);
        const tileY = Math.floor(worldY / this.TILE_SIZE);

        const centerPixelX = tileX * this.TILE_SIZE + this.TILE_SIZE / 2;
        const centerPixelY = tileY * this.TILE_SIZE + this.TILE_SIZE / 2;

        // Destroy storm cloud visuals
        if (this.stormCloud) {
            if (this.stormCloud.flashInterval) {
                this.stormCloud.flashInterval.remove();
            }
            this.tweens.killTweensOf(this.stormCloud.body);
            this.tweens.killTweensOf(this.stormCloud.darkCore);
            this.tweens.killTweensOf(this.stormCloud.crackle);
            this.tweens.killTweensOf(this.stormCloud.outerCrackle);
            this.stormCloud.sparks.forEach(spark => this.tweens.killTweensOf(spark));

            this.stormCloud.body.destroy();
            this.stormCloud.darkCore.destroy();
            this.stormCloud.crackle.destroy();
            this.stormCloud.outerCrackle.destroy();
            this.stormCloud.chargeText.destroy();
            this.stormCloud.sparks.forEach(spark => spark.destroy());
            this.stormCloud = null;
        }

        const chargePercent = this.stormCloudCharge / 100;
        const startRadius = this.stormFieldRadius * chargePercent;
        const radiusPixels = startRadius * this.TILE_SIZE;

        const fieldCircle = this.add.circle(
            centerPixelX,
            centerPixelY,
            radiusPixels,
            0xffff00,
            0.2
        );

        const fieldBorder = this.add.circle(
            centerPixelX,
            centerPixelY,
            radiusPixels
        );
        fieldBorder.setStrokeStyle(3, 0xffff00, 0.8);

        const lifespanText = this.add.text(
            centerPixelX,
            centerPixelY,
            '3.0s',
            {
                fontSize: '16px',
                fontFamily: 'monospace',
                color: '#ffffff',
                stroke: '#ffff00',
                strokeThickness: 3,
                fontStyle: 'bold'
            }
        ).setOrigin(0.5);

        this.tweens.add({
            targets: [fieldCircle, fieldBorder],
            scaleX: 1.1,
            scaleY: 1.1,
            alpha: 0.4,
            duration: 300,
            yoyo: true,
            repeat: -1,
            ease: 'Sine.easeInOut'
        });

        this.stormField = {
            circle: fieldCircle,
            border: fieldBorder,
            lifespanText: lifespanText,
            tileX: tileX,
            tileY: tileY,
            createdAt: this.time.now,
            expiresAt: this.time.now + (this.stormFieldDuration * chargePercent),
            radiusTiles: startRadius,
            lastLifeGainTime: 0
        };

        this.stormCloudActive = false;
        this.stormFieldLastTick = this.time.now;
    }

    updateStormField(time) {
        if (!this.stormField) return;

        const timeLeft = (this.stormField.expiresAt - time) / 1000;
        if (timeLeft > 0) {
            this.stormField.lifespanText.setText(`${timeLeft.toFixed(1)}s`);
        }

        if (time >= this.stormField.expiresAt) {
            this.deactivateStormField();
            return;
        }

        // Radius based on charge percentage
        const chargePercent = this.stormCloudCharge / 100;
        const scaledRadius = this.stormField.radiusTiles * chargePercent;
        const radiusPixels = scaledRadius * this.TILE_SIZE;

        this.stormField.circle.radius = radiusPixels;
        this.stormField.border.radius = radiusPixels;

        // ATTACK ENEMIES IN FIELD
        if (time - this.stormFieldLastTick >= this.stormFieldTickInterval) {
            this.stormFieldLastTick = time;

            const enemiesInField = [];

            for (let enemy of this.enemies) {
                const enemyPixelX = enemy.x * this.TILE_SIZE + this.TILE_SIZE / 2;
                const enemyPixelY = enemy.y * this.TILE_SIZE + this.TILE_SIZE / 2;
                const fieldPixelX = this.stormField.tileX * this.TILE_SIZE + this.TILE_SIZE / 2;
                const fieldPixelY = this.stormField.tileY * this.TILE_SIZE + this.TILE_SIZE / 2;

                const dist = Phaser.Math.Distance.Between(
                    enemyPixelX, enemyPixelY,
                    fieldPixelX, fieldPixelY
                );

                if (dist <= radiusPixels) {
                    enemiesInField.push(enemy);
                }
            }

            if (enemiesInField.length > 0) {
                // Pick random enemy to start chain from
                const randomEnemy = enemiesInField[Math.floor(Math.random() * enemiesInField.length)];

                const fieldPixelX = this.stormField.tileX * this.TILE_SIZE + this.TILE_SIZE / 2;
                const fieldPixelY = this.stormField.tileY * this.TILE_SIZE + this.TILE_SIZE / 2;

                // Draw lightning from field center to enemy
                this.drawLightningBolt(
                    { sprite: { x: fieldPixelX, y: fieldPixelY } },
                    randomEnemy
                );

                // Chain lightning with group bonus
                const groupBonus = 1.0 + (enemiesInField.length * 0.2);
                const fieldDamage = (this.baseLightningDamage * this.damageScaling) * chargePercent * groupBonus;

                const hitEnemies = [];
                this.performChainLightning(randomEnemy, fieldDamage, hitEnemies, this.lightningUltChainFalloff);
                const hitCount = hitEnemies.length;

                // Extend lifespan if hit enemies
                if (hitCount > 0) {
                    if (time - this.stormField.lastLifeGainTime >= this.stormFieldLifeGainCooldown) {
                        this.stormField.expiresAt += this.stormFieldLifeGainAmount;
                        this.stormField.lastLifeGainTime = time;
                    }

                    // Grow radius
                    for (let i = 0; i < hitCount; i++) {
                        if (this.stormField.radiusTiles < this.stormFieldMaxRadius) {
                            this.stormField.radiusTiles += this.stormFieldRadiusGrowthPerHit;
                            this.stormField.radiusTiles = Math.min(this.stormField.radiusTiles, this.stormFieldMaxRadius);
                        }
                    }
                }
            }

            // Decay charge
            this.stormCloudCharge -= this.stormCloudChargeDecayPerAttack;

            if (this.stormCloudCharge <= 0) {
                this.deactivateStormField();
            }
        }
    }

    deactivateStormField() {

        if (this.stormField) {
            this.tweens.add({
                targets: [this.stormField.circle, this.stormField.border, this.stormField.lifespanText],
                alpha: 0,
                duration: 300,
                onComplete: () => {
                    this.tweens.killTweensOf(this.stormField.circle);
                    this.tweens.killTweensOf(this.stormField.border);
                    this.stormField.circle.destroy();
                    this.stormField.border.destroy();
                    this.stormField.lifespanText.destroy();
                    this.stormField = null;
                }
            });
        }
    }

    addCosmicCharge(x, y) {
        if (this.cosmicBatteryCharges >= this.cosmicMaxCharges) return;

        this.cosmicBatteryCharges++;
        this.updateHUD();

        const chargePickup = this.add.container(x, y);

        const outerGlow = this.add.circle(0, 0, 20, 0x9966ff, 0.3);

        const middleRing = this.add.circle(0, 0, 15, 0xcc99ff, 0.5);

        const innerCore = this.add.circle(0, 0, 10, 0xffffff, 0.8);

        const sparkles = [];
        for (let i = 0; i < 6; i++) {
            const angle = (Math.PI * 2 / 6) * i;
            const dist = 12;
            const sparkle = this.add.circle(
                Math.cos(angle) * dist,
                Math.sin(angle) * dist,
                2,
                0xffffff,
                0.9
            );
            sparkles.push(sparkle);
        }

        const text = this.add.text(0, -25, '+1', {
            fontSize: '20px',
            fontFamily: 'monospace',
            color: '#ffffff',
            stroke: '#9966ff',
            strokeThickness: 4,
            fontStyle: 'bold'
        }).setOrigin(0.5);

        chargePickup.add([outerGlow, middleRing, innerCore, ...sparkles, text]);

        this.tweens.add({
            targets: sparkles,
            angle: 360,
            duration: 1000,
            ease: 'Linear'
        });

        this.tweens.add({
            targets: chargePickup,
            y: y - 50,
            alpha: 0,
            duration: 1500,
            ease: 'Quad.easeOut',
            onComplete: () => chargePickup.destroy()
        });

        this.tweens.add({
            targets: [outerGlow, middleRing, innerCore],
            scaleX: 1.5,
            scaleY: 1.5,
            duration: 300,
            yoyo: true,
            ease: 'Quad.easeOut'
        });
    }

    startCosmicChanneling() {
        this.cosmicChanneling = true;
        this.cosmicChannelStartTime = this.time.now;
        this.cosmicChannelLastCharge = this.time.now;

        // Slow movement during channeling
        this._preChanelMoveCooldown = this.moveCooldown;
        this.moveCooldown = 600;

        // Visual: dark void vortex around player
        const cx = this.player.x, cy = this.player.y;
        const g = this.add.graphics().setDepth(3);
        const progressRing = this.add.graphics().setDepth(3.1);
        const label = this.add.text(cx, cy - 40, 'CHANNELING', {
            fontSize: '11px', fontFamily: 'monospace', color: '#9966ff',
            stroke: '#000000', strokeThickness: 3, fontStyle: 'bold'
        }).setOrigin(0.5).setDepth(4);

        // Orbiting void particles
        const particles = [];
        for (let i = 0; i < 6; i++) {
            const angle = (Math.PI * 2 / 6) * i;
            const p = this.add.circle(
                cx + Math.cos(angle) * 28,
                cy + Math.sin(angle) * 28,
                3, 0x9966ff, 0.8
            ).setDepth(3.5);
            particles.push(p);
        }
        const orbitContainer = this.add.container(cx, cy, particles.map((p, i) => {
            const angle = (Math.PI * 2 / 6) * i;
            p.x = Math.cos(angle) * 28; p.y = Math.sin(angle) * 28;
            return p;
        })).setDepth(3.5);
        this.tweens.add({ targets: orbitContainer, angle: -360, duration: 1800, repeat: -1, ease: 'Linear' });

        this.cosmicChannelVisual = { g, progressRing, label, orbitContainer };
        this.player.setTint(0x9966ff);
    }

    stopCosmicChanneling(interrupted) {
        this.cosmicChanneling = false;
        if (this._preChanelMoveCooldown !== undefined) {
            this.moveCooldown = this._preChanelMoveCooldown;
        }
        this.player.clearTint();

        if (this.cosmicChannelVisual) {
            const { g, progressRing, label, orbitContainer } = this.cosmicChannelVisual;
            this.tweens.killTweensOf(orbitContainer);
            g.destroy(); progressRing.destroy(); label.destroy(); orbitContainer.destroy();
            this.cosmicChannelVisual = null;
        }

        if (interrupted) {
            // Show interruption text
            const ix = this.player.x - this.cameras.main.scrollX;
            const iy = this.player.y - this.cameras.main.scrollY;
            const txt = this.add.text(ix, iy - 30, 'INTERRUPTED!', {
                fontSize: '13px', fontFamily: 'monospace', color: '#ff4444',
                stroke: '#000000', strokeThickness: 3, fontStyle: 'bold'
            }).setOrigin(0.5).setScrollFactor(0).setDepth(20);
            this.tweens.add({ targets: txt, y: txt.y - 20, alpha: 0, duration: 700, onComplete: () => txt.destroy() });
        }
    }

    updateCosmicChanneling(time) {
        if (!this.cosmicChanneling) return;
        if (this.currentElement !== 'cosmic') { this.stopCosmicChanneling(false); return; }

        const v = this.cosmicChannelVisual;
        if (!v) return;

        // Keep visuals anchored to player
        v.g.clear();
        v.progressRing.clear();
        v.label.x = this.player.x;
        v.label.y = this.player.y - 42;
        v.orbitContainer.x = this.player.x;
        v.orbitContainer.y = this.player.y;

        // Void aura background
        v.g.fillStyle(0x110022, 0.35);
        v.g.fillCircle(this.player.x, this.player.y, 32);
        v.g.lineStyle(2, 0x6633aa, 0.6);
        v.g.strokeCircle(this.player.x, this.player.y, 32);

        // Progress arc toward next charge
        const timeSinceLastCharge = time - this.cosmicChannelLastCharge;
        const progress = Math.min(timeSinceLastCharge / (this.cosmicChannelSecondsPerCharge * 1000), 1);
        const startAngle = -Math.PI / 2;
        const endAngle = startAngle + Math.PI * 2 * progress;

        v.progressRing.lineStyle(3, 0x9966ff, 0.9);
        v.progressRing.beginPath();
        v.progressRing.arc(this.player.x, this.player.y, 35, startAngle, endAngle, false);
        v.progressRing.strokePath();

        // Earn a charge
        if (timeSinceLastCharge >= this.cosmicChannelSecondsPerCharge * 1000) {
            this.cosmicChannelLastCharge = time;
            if (this.cosmicBatteryCharges < this.cosmicMaxCharges) {
                this.addCosmicCharge(this.player.x, this.player.y);
            }
            if (this.cosmicBatteryCharges >= this.cosmicMaxCharges) {
                this.stopCosmicChanneling(false);
                const fullTxt = this.add.text(
                    this.scale.width / 2, 70, '⚡ FULLY CHARGED ⚡',
                    { fontSize: '16px', fontFamily: 'monospace', color: '#ddaaff', stroke: '#000', strokeThickness: 3, fontStyle: 'bold' }
                ).setOrigin(0.5).setScrollFactor(0).setDepth(30);
                this.tweens.add({ targets: fullTxt, y: 50, alpha: 0, duration: 1500, onComplete: () => fullTxt.destroy() });
                return;
            }
        }

        // Update label with charges
        v.label.setText(`CHANNELING  ${this.cosmicBatteryCharges}/${this.cosmicMaxCharges}`);
    }

    updateCosmicPassiveCharge(time) {
        // Replaced by active channeling — no-op kept for safety
    }

    updateCosmicCharge(time) {
        // ── CONTINUOUS LASER (SPACE held, any time with charges) ──────
        if (this.cosmicContinuousLaserActive) {
            if (time - this.cosmicLaserLastDrain >= this.cosmicLaserDrainInterval) {
                this.cosmicLaserLastDrain = time;
                this.cosmicBatteryCharges--;
                this.updateHUD();
                if (this.cosmicBatteryCharges <= 0) {
                    this.cosmicBatteryCharges = 0;
                    this.cosmicContinuousLaserActive = false;
                    this.cosmicUltActive = false;
                    this.ultDrainActive = false;
                    this.updateHUD();
                }
            }

            // Fire beam toward mouse every tick
            if (this.cosmicContinuousLaserActive && time - this.cosmicLaserLastTick >= this.cosmicLaserTickInterval) {
                this.cosmicLaserLastTick = time;
                const playerPixelX = this.playerX * this.TILE_SIZE + this.TILE_SIZE / 2;
                const playerPixelY = this.playerY * this.TILE_SIZE + this.TILE_SIZE / 2;
                const worldX = this.pointerX + this.cameras.main.scrollX;
                const worldY = this.pointerY + this.cameras.main.scrollY;
                const dx = worldX - playerPixelX;
                const dy = worldY - playerPixelY;
                const dist = Math.sqrt(dx * dx + dy * dy);
                if (dist > 0) {
                    this.fireCosmicBeam(playerPixelX, playerPixelY, dx / dist, dy / dist,
                        this.cosmicBaseBeamDamage * this.damageScaling * 0.1, 4, 1);
                }
            }
            return;
        } else if (!this.cosmicContinuousLaserActive && !this.cosmicCharging) {
            return;
        }

        this.cosmicChargeHoldTime = time - this.cosmicChargeStartTime;

        const chargeRateMultiplier = this.cosmicBlackHole ? 6 : 3;
        const adjustedTime = this.cosmicChargeHoldTime * chargeRateMultiplier;
        const seconds = adjustedTime / 1000;
        // Clamped 0–1 progress, maxes at full charge (3 seconds)
        const pct = Math.min(seconds / 3, 1);
        const chargeMultiplier = Math.pow(2, Math.min(seconds, 3));

        if (!this.cosmicChargeIndicator) {
            this.cosmicChargeIndicator = this.add.container(this.player.x, this.player.y);

            // Layer 1: void core
            const voidCore = this.add.circle(0, 0, 6, 0x000000, 1);

            // Layer 2: inner energy fill (graphics, redrawn each frame)
            const innerGfx = this.add.graphics();

            // Layer 3: arc graphics — jagged arcs appear as charge builds
            const arcGfx = this.add.graphics();

            // Layer 4: outer burst ring (only at full charge)
            const burstRing = this.add.circle(0, 0, 38, 0x9966ff, 0);
            burstRing.setStrokeStyle(3, 0xcc88ff, 0);

            // Layer 5: orbiting void particles — start invisible
            const orbitGfx = this.add.graphics();

            // Label
            const chargeText = this.add.text(0, -44, '', {
                fontSize: '13px', fontFamily: 'monospace',
                color: '#ffffff', stroke: '#330044', strokeThickness: 4, fontStyle: 'bold'
            }).setOrigin(0.5).setAlpha(0);

            this.cosmicChargeIndicator.add([innerGfx, arcGfx, burstRing, orbitGfx, voidCore, chargeText]);
            this.cosmicChargeIndicator.setData('voidCore', voidCore);
            this.cosmicChargeIndicator.setData('innerGfx', innerGfx);
            this.cosmicChargeIndicator.setData('arcGfx', arcGfx);
            this.cosmicChargeIndicator.setData('burstRing', burstRing);
            this.cosmicChargeIndicator.setData('orbitGfx', orbitGfx);
            this.cosmicChargeIndicator.setData('chargeText', chargeText);
        }

        this.cosmicChargeIndicator.x = this.player.x;
        this.cosmicChargeIndicator.y = this.player.y;

        const voidCore    = this.cosmicChargeIndicator.getData('voidCore');
        const innerGfx    = this.cosmicChargeIndicator.getData('innerGfx');
        const arcGfx      = this.cosmicChargeIndicator.getData('arcGfx');
        const burstRing   = this.cosmicChargeIndicator.getData('burstRing');
        const orbitGfx    = this.cosmicChargeIndicator.getData('orbitGfx');
        const chargeText  = this.cosmicChargeIndicator.getData('chargeText');

        innerGfx.clear();
        arcGfx.clear();
        orbitGfx.clear();

        // ── VOID CORE — grows and brightens with charge ──────────────
        const coreRadius = 5 + pct * 9; // 5 → 14px
        voidCore.setRadius(coreRadius);
        // Colour: black → deep purple → vivid violet
        const cr = Math.floor(pct * pct * 200);
        const cg = 0;
        const cb = Math.floor(pct * 255);
        voidCore.setFillStyle(Phaser.Display.Color.GetColor(cr, cg, cb), 1);

        // ── INNER ENERGY HALO — layered glow rings ──────────────────
        const haloAlpha = pct * 0.8;
        innerGfx.fillStyle(0x9966ff, haloAlpha * 0.15);
        innerGfx.fillCircle(0, 0, coreRadius + 10);
        innerGfx.lineStyle(2, 0xcc88ff, haloAlpha * 0.6);
        innerGfx.strokeCircle(0, 0, coreRadius + 10);
        if (pct > 0.4) {
            innerGfx.lineStyle(1.5, 0xffffff, (pct - 0.4) * 0.5);
            innerGfx.strokeCircle(0, 0, coreRadius + 18);
        }

        // ── CRACKLING ARCS — appear from 25% charge ──────────────────
        if (pct > 0.25) {
            const numArcs = Math.floor(pct * 6); // 1–6 arcs
            const arcAlpha = Math.min(1, (pct - 0.25) * 1.3);
            for (let i = 0; i < numArcs; i++) {
                const baseAngle = (Math.PI * 2 / numArcs) * i + (time / 600);
                const r1 = coreRadius + 4;
                const r2 = coreRadius + 14 + pct * 10;
                const x1 = Math.cos(baseAngle) * r1;
                const y1 = Math.sin(baseAngle) * r1;
                // Jagged mid-point
                const midAngle = baseAngle + (Math.random() - 0.5) * 0.8;
                const midR = (r1 + r2) / 2 + (Math.random() - 0.5) * 6;
                const xm = Math.cos(midAngle) * midR;
                const ym = Math.sin(midAngle) * midR;
                const x2 = Math.cos(baseAngle + (Math.random() - 0.5) * 0.4) * r2;
                const y2 = Math.sin(baseAngle + (Math.random() - 0.5) * 0.4) * r2;

                arcGfx.lineStyle(3, 0x9966ff, arcAlpha * 0.4);
                arcGfx.beginPath(); arcGfx.moveTo(x1, y1); arcGfx.lineTo(xm, ym); arcGfx.lineTo(x2, y2); arcGfx.strokePath();
                arcGfx.lineStyle(1.5, 0xffffff, arcAlpha * 0.9);
                arcGfx.beginPath(); arcGfx.moveTo(x1, y1); arcGfx.lineTo(xm, ym); arcGfx.lineTo(x2, y2); arcGfx.strokePath();
            }
        }

        // ── ORBITING PARTICLES — appear from 50% ──────────────────
        if (pct > 0.5) {
            const orbitAlpha = (pct - 0.5) * 2;
            const orbitR = 28 + pct * 8;
            const numP = 6;
            for (let i = 0; i < numP; i++) {
                const angle = (Math.PI * 2 / numP) * i - (time / 400);
                const ox = Math.cos(angle) * orbitR;
                const oy = Math.sin(angle) * orbitR;
                const pr = 1.5 + pct * 2;
                orbitGfx.fillStyle(0xffffff, orbitAlpha);
                orbitGfx.fillCircle(ox, oy, pr);
                // Trailing tail
                for (let t = 1; t <= 3; t++) {
                    const ta = angle + t * 0.15;
                    orbitGfx.fillStyle(0xcc88ff, orbitAlpha * (1 - t * 0.3));
                    orbitGfx.fillCircle(Math.cos(ta) * orbitR, Math.sin(ta) * orbitR, pr * (1 - t * 0.25));
                }
            }
        }

        // ── BURST RING at full charge ──────────────────────────────
        if (pct >= 1) {
            const pulse = 0.5 + Math.sin(time / 60) * 0.5;
            burstRing.setStrokeStyle(3, 0xffffff, 0.4 + pulse * 0.5);
            burstRing.setAlpha(0.5 + pulse * 0.5);
        } else {
            burstRing.setAlpha(0);
        }

        // ── LABEL ─────────────────────────────────────────────────
        if (pct > 0.3) {
            chargeText.setAlpha(Math.min(1, (pct - 0.3) * 2));
            chargeText.setText(`${chargeMultiplier.toFixed(1)}×`);
            const hue = pct >= 1 ? '#ffffff' : (pct > 0.7 ? '#ffaaff' : '#cc99ff');
            chargeText.setColor(hue);
            if (pct >= 1) chargeText.setAlpha(0.7 + Math.sin(time / 70) * 0.3);
        } else {
            chargeText.setAlpha(0);
        }
    }

    releaseCosmicBeam() {
        const holdTime = this.time.now - this.cosmicChargeStartTime;
        const chargeRateMultiplier = this.cosmicBlackHole ? 6 : 3;
        const adjustedTime = holdTime * chargeRateMultiplier;
        const seconds = adjustedTime / 1000;
        const chargeMultiplier = Math.pow(2, Math.min(seconds, 3));

        const worldX = this.pointerX + this.cameras.main.scrollX;
        const worldY = this.pointerY + this.cameras.main.scrollY;

        const playerPixelX = this.playerX * this.TILE_SIZE + this.TILE_SIZE / 2;
        const playerPixelY = this.playerY * this.TILE_SIZE + this.TILE_SIZE / 2;

        const dx = worldX - playerPixelX;
        const dy = worldY - playerPixelY;
        const distance = Math.sqrt(dx * dx + dy * dy);

        if (distance === 0) {
            this.cosmicCharging = false;
            if (this.cosmicChargeIndicator) {
                this.cosmicChargeIndicator.destroy();
                this.cosmicChargeIndicator = null;
            }
            return;
        }

        const dirX = dx / distance;
        const dirY = dy / distance;

        // Black hole: no damage multiplier, just faster charging
        const beamWidthMultiplier = 1;

        const damage = this.cosmicBaseBeamDamage * this.damageScaling * chargeMultiplier;
        this.fireCosmicBeam(playerPixelX, playerPixelY, dirX, dirY, damage, chargeMultiplier, beamWidthMultiplier);

        this.cosmicCharging = false;
        if (this.cosmicChargeIndicator) {
            this.cosmicChargeIndicator.destroy();
            this.cosmicChargeIndicator = null;
        }
    }

    fireCosmicBeam(startX, startY, dirX, dirY, damage, visualMultiplier, beamWidthMultiplier = 1) {
        let beamEndX = startX;
        let beamEndY = startY;
        const maxRange = 100;

        for (let i = 0; i < maxRange * this.TILE_SIZE; i += this.TILE_SIZE / 4) {
            const testX = startX + dirX * i;
            const testY = startY + dirY * i;
            const tileX = Math.floor(testX / this.TILE_SIZE);
            const tileY = Math.floor(testY / this.TILE_SIZE);

            if (tileX < 0 || tileX >= this.WORLD_WIDTH || tileY < 0 || tileY >= this.WORLD_HEIGHT) {
                break;
            }

            if (this.world[tileX][tileY] === this.WALL) {
                break;
            }

            beamEndX = testX;
            beamEndY = testY;
        }

        const graphics = this.add.graphics();

        const outerWidth = (20 + visualMultiplier * 5) * beamWidthMultiplier;
        graphics.lineStyle(outerWidth, 0x9966ff, 0.2);
        graphics.beginPath();
        graphics.moveTo(startX, startY);
        graphics.lineTo(beamEndX, beamEndY);
        graphics.strokePath();

        const middleWidth = (12 + visualMultiplier * 3) * beamWidthMultiplier;
        graphics.lineStyle(middleWidth, 0xcc99ff, 0.5);
        graphics.beginPath();
        graphics.moveTo(startX, startY);
        graphics.lineTo(beamEndX, beamEndY);
        graphics.strokePath();

        const coreWidth = (6 + visualMultiplier * 2) * beamWidthMultiplier;
        graphics.lineStyle(coreWidth, 0xffffff, 0.9);
        graphics.beginPath();
        graphics.moveTo(startX, startY);
        graphics.lineTo(beamEndX, beamEndY);
        graphics.strokePath();

        graphics.lineStyle(3 * beamWidthMultiplier, 0xffffff, 1);
        graphics.beginPath();
        graphics.moveTo(startX, startY);
        graphics.lineTo(beamEndX, beamEndY);
        graphics.strokePath();

        this.tweens.add({
            targets: graphics,
            alpha: 0,
            duration: 400,
            onComplete: () => graphics.destroy()
        });

        const hitEnemies = [];
        const beamWidthPixels = this.cosmicBeamWidth * this.TILE_SIZE * beamWidthMultiplier;

        // Check if fully charged (8x)
        const isFullyCharged = visualMultiplier >= 8;

        for (let enemy of this.enemies) {
            const enemyPixelX = enemy.x * this.TILE_SIZE + this.TILE_SIZE / 2;
            const enemyPixelY = enemy.y * this.TILE_SIZE + this.TILE_SIZE / 2;

            const distToLine = this.pointToLineDistance(
                enemyPixelX, enemyPixelY,
                startX, startY,
                beamEndX, beamEndY
            );

            if (distToLine <= beamWidthPixels) {
                hitEnemies.push(enemy);

                let finalDamage = damage;

                // CONSUME MARKS if fully charged OR continuous laser
                const isLaser = this.cosmicContinuousLaserActive;
                if ((isFullyCharged || isLaser) && enemy.cosmicMarks > 0) {
                    // Frozen enemies take 2× mark damage (ice → cosmic synergy)
                    const frozenMult = enemy.isFrozen ? 2.0 : 1.0;
                    const markBonus = enemy.cosmicMarks * this.cosmicMarkDamagePerStack * frozenMult;
                    finalDamage += markBonus;
                    if (enemy.isFrozen && enemy.sprite && enemy.sprite.active) {
                        this.showStatusText(enemy.sprite.x, enemy.sprite.y, `❄⚡ ×2`, '#aaeeff');
                    }

                    // LIFESTEAL: Heal based on marks consumed
                    const healPerMark = 5; // Heal 5 HP per mark consumed
                    const healAmount = enemy.cosmicMarks * healPerMark;

                    if (healAmount > 0 && this.health < this.maxHealth) {
                        this.health = Math.min(this.maxHealth, this.health + healAmount);
                        this.updateHUD();

                        // Visual: healing sparkle on player
                        const healSparkle = this.add.text(
                            this.player.x,
                            this.player.y - 20,
                            `+${healAmount} HP`,
                            {
                                fontSize: '16px',
                                fontFamily: 'monospace',
                                color: '#66ff66',
                                stroke: '#003300',
                                strokeThickness: 3,
                                fontStyle: 'bold'
                            }
                        ).setOrigin(0.5);

                        this.tweens.add({
                            targets: healSparkle,
                            y: this.player.y - 40,
                            alpha: 0,
                            duration: 800,
                            ease: 'Quad.easeOut',
                            onComplete: () => healSparkle.destroy()
                        });
                    }

                    // Visual feedback for mark consumption
                    const consumeText = this.add.text(
                        enemyPixelX,
                        enemyPixelY - 30,
                        `+${markBonus}`,
                        {
                            fontSize: '18px',
                            fontFamily: 'monospace',
                            color: '#ffff00',
                            stroke: '#9966ff',
                            strokeThickness: 3,
                            fontStyle: 'bold'
                        }
                    ).setOrigin(0.5);

                    this.tweens.add({
                        targets: consumeText,
                        y: enemyPixelY - 50,
                        alpha: 0,
                        duration: 800,
                        onComplete: () => consumeText.destroy()
                    });

                    // Clear marks and gain charge per mark consumed
                    const marksConsumed = enemy.cosmicMarks;
                    enemy.cosmicMarks = 0;
                    this.updateCosmicMarkVisual(enemy);
                    this.gainUltCharge(marksConsumed * this.ultChargePerCosmicMark);
                }

                const enemyHealthBefore = enemy.health;
                this.damageEnemy(enemy, finalDamage);

                // During black hole: guaranteed charge drop if enemy died
                if (this.cosmicBlackHole && enemy.health <= 0 && enemyHealthBefore > 0) {
                    this.addCosmicCharge(enemyPixelX, enemyPixelY);
                }

                const impact = this.add.container(enemyPixelX, enemyPixelY);

                const flash = this.add.circle(0, 0, 15, 0xffffff, 0.9);
                const ring = this.add.circle(0, 0, 15, 0x9966ff, 0);
                ring.setStrokeStyle(3, 0x9966ff, 0.8);

                impact.add([flash, ring]);

                this.tweens.add({
                    targets: [flash, ring],
                    scaleX: 2,
                    scaleY: 2,
                    alpha: 0,
                    duration: 300,
                    onComplete: () => impact.destroy()
                });
            }
        }
    }

    pointToLineDistance(px, py, x1, y1, x2, y2) {
        const dx = x2 - x1;
        const dy = y2 - y1;
        const lengthSquared = dx * dx + dy * dy;

        if (lengthSquared === 0) return Math.sqrt((px - x1) * (px - x1) + (py - y1) * (py - y1));

        let t = ((px - x1) * dx + (py - y1) * dy) / lengthSquared;
        t = Math.max(0, Math.min(1, t));

        const projX = x1 + t * dx;
        const projY = y1 + t * dy;

        return Math.sqrt((px - projX) * (px - projX) + (py - projY) * (py - projY));
    }

    activateCosmicBlackHole() {
        // If projectile already in flight — detonate it
        if (this.cosmicBlackHoleProjectile) {
            this.detonateCosmicBomb();
            return;
        }

        this.cosmicUltActive = true;

        const activePointer = this.input.activePointer;
        const targetX = (this.pointerX || activePointer.x) + this.cameras.main.scrollX;
        const targetY = (this.pointerY || activePointer.y) + this.cameras.main.scrollY;

        const playerPixelX = this.playerX * this.TILE_SIZE + this.TILE_SIZE / 2;
        const playerPixelY = this.playerY * this.TILE_SIZE + this.TILE_SIZE / 2;

        const dx = targetX - playerPixelX;
        const dy = targetY - playerPixelY;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist === 0) return;

        const speed = 80; // slow — gives time to aim detonation
        const vx = (dx / dist) * speed;
        const vy = (dy / dist) * speed;

        // ── VOID BOMB VISUAL ─────────────────────────────────────────
        // Layered concentric circles + rotating arms + crackling outline
        const container = this.add.container(playerPixelX, playerPixelY).setDepth(6);

        // Outer distortion ring
        const outerRing = this.add.circle(0, 0, 22, 0x000000, 0);
        outerRing.setStrokeStyle(3, 0x440088, 0.7);

        // Mid energy ring
        const midRing = this.add.circle(0, 0, 15, 0x220044, 0.85);
        midRing.setStrokeStyle(2, 0x9966ff, 0.9);

        // Dark core
        const core = this.add.circle(0, 0, 8, 0x000000, 1);

        // Bright singularity point
        const singularity = this.add.circle(0, 0, 3, 0xffffff, 0.9);

        // Spiral arms — 3 graphics lines that rotate
        const armsGfx = this.add.graphics();
        const drawArms = (g, angle) => {
            g.clear();
            for (let i = 0; i < 3; i++) {
                const a = angle + (Math.PI * 2 / 3) * i;
                g.lineStyle(2, 0x9966ff, 0.6);
                g.beginPath();
                g.moveTo(Math.cos(a) * 4, Math.sin(a) * 4);
                // Curved arm — 4 segments each offset
                for (let s = 1; s <= 4; s++) {
                    const t = s / 4;
                    const r = 4 + t * 14;
                    const sweep = a + t * 0.9;
                    g.lineTo(Math.cos(sweep) * r, Math.sin(sweep) * r);
                }
                g.strokePath();
            }
        };
        drawArms(armsGfx, 0);
        container.add([outerRing, armsGfx, midRing, core, singularity]);

        // Rotation tween for arms
        let armAngle = 0;
        const armTimer = this.time.addEvent({
            delay: 30,
            callback: () => {
                if (!container.active) { armTimer.remove(); return; }
                armAngle -= 0.07;
                drawArms(armsGfx, armAngle);
                // Pulse outer ring
                outerRing.setStrokeStyle(3, 0x440088, 0.4 + Math.sin(armAngle * 3) * 0.3);
                singularity.setAlpha(0.6 + Math.sin(armAngle * 5) * 0.4);
            },
            loop: true
        });

        // Purple void trail
        const trailTimer = this.time.addEvent({
            delay: 35,
            callback: () => {
                if (!container.active) { trailTimer.remove(); return; }
                const t1 = this.add.circle(container.x, container.y, 10, 0x220044, 0.55).setDepth(5);
                const t2 = this.add.circle(container.x, container.y, 5, 0x9966ff, 0.35).setDepth(5);
                this.tweens.add({ targets: [t1, t2], alpha: 0, scaleX: 1.8, scaleY: 1.8, duration: 350, onComplete: () => { t1.destroy(); t2.destroy(); } });
            },
            loop: true
        });

        container.setData('vx', vx);
        container.setData('vy', vy);
        container.setData('launchX', playerPixelX);
        container.setData('launchY', playerPixelY);
        container.setData('maxRange', 12 * this.TILE_SIZE); // 12 tiles max
        container.setData('armTimer', armTimer);
        container.setData('trailTimer', trailTimer);

        if (this.cosmicBlackHoleProjectile) {
            const old = this.cosmicBlackHoleProjectile;
            if (old.getData('armTimer')) old.getData('armTimer').remove();
            if (old.getData('trailTimer')) old.getData('trailTimer').remove();
            this.tweens.killTweensOf(old);
            old.destroy();
        }
        this.cosmicBlackHoleProjectile = container;

        // Range ring at launch point — shows max travel distance
        const rangeRing = this.add.circle(playerPixelX, playerPixelY, 12 * this.TILE_SIZE, 0x9966ff, 0).setDepth(4);
        rangeRing.setStrokeStyle(1, 0x9966ff, 0.3);
        this.tweens.add({ targets: rangeRing, alpha: 0, duration: 1200, onComplete: () => rangeRing.destroy() });

        // HUD hint
        const hint = this.add.text(this.scale.width / 2, 80, 'E  TO DETONATE', {
            fontSize: '14px', fontFamily: 'monospace', color: '#cc88ff',
            stroke: '#000000', strokeThickness: 3
        }).setOrigin(0.5).setScrollFactor(0).setDepth(30);
        this.tweens.add({ targets: hint, y: 60, alpha: 0, duration: 2000, onComplete: () => hint.destroy() });
    }

    detonateCosmicBomb() {
        const proj = this.cosmicBlackHoleProjectile;
        if (!proj) return;

        const deployX = proj.x;
        const deployY = proj.y;

        if (proj.getData('armTimer')) proj.getData('armTimer').remove();
        if (proj.getData('trailTimer')) proj.getData('trailTimer').remove();
        this.tweens.killTweensOf(proj);

        // Detonation flash burst before deploying
        const flash = this.add.circle(deployX, deployY, 8, 0xffffff, 1).setDepth(7);
        this.tweens.add({ targets: flash, radius: 40, alpha: 0, duration: 200, onComplete: () => flash.destroy() });
        for (let i = 0; i < 8; i++) {
            const angle = (Math.PI * 2 / 8) * i;
            const shard = this.add.circle(deployX, deployY, 3, 0xcc88ff, 1).setDepth(7);
            this.tweens.add({ targets: shard, x: deployX + Math.cos(angle) * 30, y: deployY + Math.sin(angle) * 30, alpha: 0, duration: 300, onComplete: () => shard.destroy() });
        }

        proj.destroy();
        this.cosmicBlackHoleProjectile = null;
        this.deployCosmicBlackHole(deployX, deployY);
    }

    updateCosmicBlackHoleProjectile(delta) {
        if (!this.cosmicBlackHoleProjectile) return;

        const deltaSeconds = delta / 1000;
        const proj = this.cosmicBlackHoleProjectile;

        proj.x += proj.getData('vx') * deltaSeconds;
        proj.y += proj.getData('vy') * deltaSeconds;

        const tileX = Math.floor(proj.x / this.TILE_SIZE);
        const tileY = Math.floor(proj.y / this.TILE_SIZE);

        // Auto-detonate on wall hit or max range reached
        const travelledX = proj.x - proj.getData('launchX');
        const travelledY = proj.y - proj.getData('launchY');
        const travelled = Math.sqrt(travelledX * travelledX + travelledY * travelledY);
        const maxRange = proj.getData('maxRange');

        if (tileX < 0 || tileX >= this.WORLD_WIDTH ||
            tileY < 0 || tileY >= this.WORLD_HEIGHT ||
            this.world[tileX][tileY] === this.WALL ||
            travelled >= maxRange) {
            this.detonateCosmicBomb();
            return;
        }

        // Detonate on enemy contact
        for (const enemy of this.enemies) {
            if (!enemy.sprite || !enemy.sprite.active) continue;
            const ex = enemy.sprite.x, ey = enemy.sprite.y;
            if (Math.abs(ex - proj.x) < this.TILE_SIZE * 1.1 && Math.abs(ey - proj.y) < this.TILE_SIZE * 1.1) {
                this.detonateCosmicBomb();
                return;
            }
        }
    }

    deployCosmicBlackHole(x, y) {

        // Create vortex visuals
        const vortex = this.add.container(x, y);

        // OUTER DISTORTION RING (largest, dark purple)
        const distortionRing = this.add.circle(0, 0, this.cosmicBlackHoleRadius * this.TILE_SIZE * 1.2, 0x220044, 0.2);
        distortionRing.setStrokeStyle(2, 0x6633aa, 0.4);

        // OUTER RING (purple with glow)
        const outerRing = this.add.circle(0, 0, this.cosmicBlackHoleRadius * this.TILE_SIZE, 0x330066, 0.4);
        outerRing.setStrokeStyle(5, 0x9966ff, 0.9);

        // MIDDLE RING (brighter purple)
        const middleRing = this.add.circle(0, 0, this.cosmicBlackHoleRadius * this.TILE_SIZE * 0.6, 0x660099, 0.6);
        middleRing.setStrokeStyle(4, 0xaa77ff, 1);

        // INNER RING (bright purple/pink)
        const innerRing = this.add.circle(0, 0, this.cosmicBlackHoleRadius * this.TILE_SIZE * 0.3, 0x9933cc, 0.7);
        innerRing.setStrokeStyle(3, 0xdd99ff, 1);

        // CORE (bright yellow-white singularity)
        const core = this.add.circle(0, 0, this.cosmicBlackHoleRadius * this.TILE_SIZE * 0.15, 0xffff00, 1);
        core.setStrokeStyle(2, 0xffffff, 1);

        // Add all rings to container
        vortex.add([distortionRing, outerRing, middleRing, innerRing, core]);

        // ROTATING SPIRAL ARMS
        const numArms = 4;
        const arms = [];
        for (let i = 0; i < numArms; i++) {
            const arm = this.add.graphics();
            const startAngle = (Math.PI * 2 / numArms) * i;

            arm.lineStyle(3, 0x9966ff, 0.6);
            arm.beginPath();

            // Create spiral arm
            const armLength = this.cosmicBlackHoleRadius * this.TILE_SIZE;
            for (let r = 5; r < armLength; r += 2) {
                const spiralAngle = startAngle + (r / armLength) * Math.PI;
                const sx = Math.cos(spiralAngle) * r;
                const sy = Math.sin(spiralAngle) * r;

                if (r === 5) {
                    arm.moveTo(sx, sy);
                } else {
                    arm.lineTo(sx, sy);
                }
            }
            arm.strokePath();

            arms.push(arm);
            vortex.add(arm);
        }

        // PARTICLE SWIRL (small dots orbiting inward)
        const particles = [];
        for (let i = 0; i < 20; i++) {
            const angle = Math.random() * Math.PI * 2;
            const distance = (Math.random() * 0.8 + 0.2) * this.cosmicBlackHoleRadius * this.TILE_SIZE;
            const particle = this.add.circle(
                Math.cos(angle) * distance,
                Math.sin(angle) * distance,
                2,
                0xffffff,
                0.8
            );
            particles.push(particle);
            vortex.add(particle);
        }

        // PULSING ANIMATION - rings expand and contract
        this.tweens.add({
            targets: [outerRing],
            scaleX: 1.15,
            scaleY: 1.15,
            alpha: 0.6,
            duration: 600,
            yoyo: true,
            repeat: -1,
            ease: 'Sine.easeInOut'
        });

        this.tweens.add({
            targets: [middleRing],
            scaleX: 1.2,
            scaleY: 1.2,
            alpha: 0.8,
            duration: 500,
            yoyo: true,
            repeat: -1,
            ease: 'Sine.easeInOut',
            delay: 100
        });

        this.tweens.add({
            targets: [innerRing],
            scaleX: 1.3,
            scaleY: 1.3,
            alpha: 0.9,
            duration: 400,
            yoyo: true,
            repeat: -1,
            ease: 'Sine.easeInOut',
            delay: 200
        });

        // CORE PULSING (bright singularity)
        this.tweens.add({
            targets: [core],
            scaleX: 1.5,
            scaleY: 1.5,
            alpha: 0.7,
            duration: 300,
            yoyo: true,
            repeat: -1,
            ease: 'Sine.easeInOut'
        });

        // DISTORTION RING (slow pulse)
        this.tweens.add({
            targets: [distortionRing],
            scaleX: 1.1,
            scaleY: 1.1,
            alpha: 0.3,
            duration: 800,
            yoyo: true,
            repeat: -1,
            ease: 'Sine.easeInOut'
        });

        // ROTATING SPIRAL ARMS
        this.tweens.add({
            targets: vortex,
            angle: -360, // Counter-clockwise rotation
            duration: 3000,
            repeat: -1,
            ease: 'Linear'
        });

        // PARTICLE SWIRL ANIMATION
        particles.forEach((particle, index) => {
            this.tweens.add({
                targets: particle,
                angle: 360,
                duration: 2000 + (index * 100),
                repeat: -1,
                ease: 'Linear'
            });

            // Particles fade as they spiral in
            this.tweens.add({
                targets: particle,
                scaleX: 0.5,
                scaleY: 0.5,
                alpha: 0.3,
                duration: 1500,
                yoyo: true,
                repeat: -1,
                ease: 'Sine.easeInOut',
                delay: index * 50
            });
        });

        this.cosmicBlackHole = {
            container: vortex,
            x: x,
            y: y,
            tileX: Math.floor(x / this.TILE_SIZE),
            tileY: Math.floor(y / this.TILE_SIZE),
            createdAt: this.time.now,
            expiresAt: this.time.now + this.cosmicBlackHoleDuration,
            lastMarkTime: this.time.now,
            affectedEnemies: [],
            spiralArms: arms, // Store for potential shrinking
            particles: particles
        };

        // Enable fast charging
        this.cosmicInfiniteBeamActive = true;
        this.cosmicInfiniteBeamEndTime = this.cosmicBlackHole.expiresAt;
    }

    updateCosmicBlackHole(time) {
        if (!this.cosmicBlackHole) return;

        const bh = this.cosmicBlackHole;
        const elapsed = time - bh.createdAt;
        const progress = elapsed / this.cosmicBlackHoleDuration;

        // Shrinking radius over time (4 tiles → 1 tile)
        const currentRadius = this.cosmicBlackHoleRadius * (1 - progress * 0.75);

        // Update visuals
        const radiusPixels = currentRadius * this.TILE_SIZE;
        const children = bh.container.list;
        children[0].setRadius(radiusPixels);
        children[1].setRadius(radiusPixels * 0.6);
        children[2].setRadius(radiusPixels * 0.2);

        // Prune dead enemies from affectedEnemies
        bh.affectedEnemies = bh.affectedEnemies.filter(e => e.sprite && e.sprite.active);

        // Find enemies in radius — spiral orbit that tightens toward center
        for (let enemy of this.enemies) {
            const dist = Math.abs(enemy.x - bh.tileX) + Math.abs(enemy.y - bh.tileY);

            if (dist <= currentRadius) {
                if (!bh.affectedEnemies.includes(enemy)) {
                    bh.affectedEnemies.push(enemy);
                    // Assign a unique orbit angle offset per enemy
                    if (enemy._bhOrbitAngle === undefined) {
                        const idx = bh.affectedEnemies.length;
                        enemy._bhOrbitAngle = (idx * Math.PI * 0.7);
                    }
                    if (enemy._bhOrbitRadius === undefined) {
                        // Cap entry radius to 1.5 tiles so enemy is always safely inside
                        const ex = enemy.sprite.x - bh.x;
                        const ey = enemy.sprite.y - bh.y;
                        const entryDist = Math.sqrt(ex * ex + ey * ey);
                        enemy._bhOrbitRadius = Math.min(entryDist, this.TILE_SIZE * 1.5);
                    }
                }

                // Spin angle forward each frame
                enemy._bhOrbitAngle = (enemy._bhOrbitAngle || 0) + 0.022;

                // Very gradual decay — enemies spiral in slowly over the black hole duration
                const safeMaxRadius = currentRadius * this.TILE_SIZE * 0.55;
                const minRadius = 6;
                enemy._bhOrbitRadius = Math.max(minRadius, Math.min(safeMaxRadius, (enemy._bhOrbitRadius || this.TILE_SIZE) * 0.9975));

                const targetX = bh.x + Math.cos(enemy._bhOrbitAngle) * enemy._bhOrbitRadius;
                const targetY = bh.y + Math.sin(enemy._bhOrbitAngle) * enemy._bhOrbitRadius;

                // Set directly — no lerp, no jitter, free pixel movement during black hole
                enemy.sprite.x = targetX;
                enemy.sprite.y = targetY;
                enemy.x = Math.floor(targetX / this.TILE_SIZE);
                enemy.y = Math.floor((targetY - this.SLIME_Y_OFFSET) / this.TILE_SIZE);

                this.updateEnemyHealthBar(enemy);

                // Update cosmic mark visuals
                if (enemy.cosmicMarkVisuals && enemy.cosmicMarkVisuals.length > 0) {
                    const markY = enemy.sprite.y - 25;
                    for (let i = 0; i < enemy.cosmicMarks; i++) {
                        const offsetX = (i - 1) * 12;
                        const visualIndex = i * 2;
                        if (visualIndex < enemy.cosmicMarkVisuals.length) {
                            enemy.cosmicMarkVisuals[visualIndex].x = enemy.sprite.x + offsetX;
                            enemy.cosmicMarkVisuals[visualIndex].y = markY;
                        }
                        if (visualIndex + 1 < enemy.cosmicMarkVisuals.length) {
                            enemy.cosmicMarkVisuals[visualIndex + 1].x = enemy.sprite.x + offsetX;
                            enemy.cosmicMarkVisuals[visualIndex + 1].y = markY;
                        }
                    }
                }
            }
        }

        // Apply marks every interval
        if (time - bh.lastMarkTime >= this.cosmicBlackHoleMarkInterval) {
            for (let enemy of bh.affectedEnemies) {
                if (enemy.cosmicMarks < this.cosmicMaxMarks) {
                    enemy.cosmicMarks++;
                    this.updateCosmicMarkVisual(enemy);
                    if (enemy.sprite && enemy.sprite.active) {
                        this.showStatusText(enemy.sprite.x, enemy.sprite.y, `MARKED x${enemy.cosmicMarks}`, '#cc99ff');
                    }
                }
            }
            bh.lastMarkTime = time;
        }

        // Expire
        if (time >= bh.expiresAt) {
            for (let enemy of bh.affectedEnemies) {
                if (!enemy.sprite || !enemy.sprite.active) continue;
                this.showStatusText(enemy.sprite.x, enemy.sprite.y, 'STUNNED', '#9966ff');
                // Snap to nearest valid floor tile from current glide position
                const snap = this.snapToNearestFloor(enemy.sprite.x, enemy.sprite.y - this.SLIME_Y_OFFSET);
                if (snap) {
                    enemy.x = snap.tx; enemy.y = snap.ty;
                    enemy.sprite.x = snap.px;
                    enemy.sprite.y = snap.py + this.SLIME_Y_OFFSET;
                    // Sync healthbars immediately after snap
                    if (enemy.healthBarBg) { enemy.healthBarBg.x = enemy.sprite.x; enemy.healthBarBg.y = enemy.sprite.y; }
                    if (enemy.healthBarFill) { enemy.healthBarFill.x = enemy.sprite.x; enemy.healthBarFill.y = enemy.sprite.y; }
                    if (enemy.brittleVisual) { enemy.brittleVisual.x = enemy.sprite.x; enemy.brittleVisual.y = enemy.sprite.y + 14; }
                    if (enemy.burnVisual) { enemy.burnVisual.x = enemy.sprite.x; enemy.burnVisual.y = enemy.sprite.y - 18; }
                    if (enemy._tsunamiMultText) { enemy._tsunamiMultText.x = enemy.sprite.x; enemy._tsunamiMultText.y = enemy.sprite.y - 28; }
                    if (enemy.cosmicMarkVisuals) this.updateCosmicMarkVisual(enemy);
                }
                delete enemy._bhOrbitAngle;
                delete enemy._bhOrbitRadius;
                enemy.isStunned = true;
                enemy.stunnedUntil = time + 500;
                this.time.delayedCall(500, () => {
                    if (enemy.sprite && enemy.sprite.active) enemy.isStunned = false;
                });
            }

            this.tweens.killTweensOf(bh.container);
            bh.container.destroy();
            this.cosmicBlackHole = null;
            this.cosmicContinuousLaserActive = false;
            this.cosmicUltActive = false;

            this.cosmicInfiniteBeamEndTime = time + this.cosmicBlackHoleGracePeriod;
        }
    }

    updateCosmicMarkVisual(enemy) {
        // Destroy old visuals
        if (enemy.cosmicMarkVisuals) {
            enemy.cosmicMarkVisuals.forEach(v => {
                this.tweens.killTweensOf(v);
                v.destroy();
            });
        }
        enemy.cosmicMarkVisuals = [];

        if (enemy.cosmicMarks === 0) return;

        const markY = enemy.sprite.y - 25;

        // Create black hole visual based on stack count
        for (let i = 0; i < enemy.cosmicMarks; i++) {
            const offsetX = (i - 1) * 12; // spread marks horizontally

            // Outer ring (purple)
            const outerRing = this.add.circle(enemy.sprite.x + offsetX, markY, 8, 0x9966ff, 0);
            outerRing.setStrokeStyle(2, 0x9966ff, 0.8);

            // Inner core (yellow/white)
            const innerCore = this.add.circle(enemy.sprite.x + offsetX, markY, 4, 0xffff00, 0.9);

            // Pulsing animation
            this.tweens.add({
                targets: [outerRing, innerCore],
                scaleX: 1.3,
                scaleY: 1.3,
                duration: 400,
                yoyo: true,
                repeat: -1,
                ease: 'Sine.easeInOut'
            });

            // Rotation
            this.tweens.add({
                targets: outerRing,
                angle: 360,
                duration: 2000,
                repeat: -1,
                ease: 'Linear'
            });

            enemy.cosmicMarkVisuals.push(outerRing, innerCore);
        }
    }

    cosmicDash(dirX, dirY, oldTileX, oldTileY) {
        const currentTime = this.time.now;

        const dashCooldown = this.cosmicBlackHole ? this.cosmicDashCooldownUlt : this.cosmicDashCooldown;
        if (currentTime - this.lastCosmicDashTime < dashCooldown) {
            return;
        }

        const chargeCost = this.cosmicBlackHole ? 0.5 : 1;
        if (this.cosmicBatteryCharges < chargeCost) {
            return;
        }

        // Calculate all tiles in dash path (pierce through)
        const dashPath = [];
        for (let i = 1; i <= this.cosmicDashDistance; i++) {
            const checkX = this.playerX + (dirX * i);
            const checkY = this.playerY + (dirY * i);
            dashPath.push({ x: checkX, y: checkY });
        }

        // Check if final destination is valid
        const targetX = this.playerX + (dirX * this.cosmicDashDistance);
        const targetY = this.playerY + (dirY * this.cosmicDashDistance);

        if (targetX < 0 || targetX >= this.WORLD_WIDTH ||
            targetY < 0 || targetY >= this.WORLD_HEIGHT ||
            this.world[targetX][targetY] !== this.FLOOR) {
            return;
        }

        // Consume charges
        this.cosmicBatteryCharges -= chargeCost;

        // Check all enemies in dash path
        let hitUnmarkedEnemy = false;
        const hitEnemies = [];

        for (let enemy of this.enemies) {
            // Check if enemy is in dash path
            const inPath = dashPath.some(tile => tile.x === enemy.x && tile.y === enemy.y);

            if (inPath) {
                hitEnemies.push(enemy);

                // Apply mark (max 3)
                if (enemy.cosmicMarks < this.cosmicMaxMarks) {
                    if (enemy.cosmicMarks === 0) {
                        hitUnmarkedEnemy = true;
                    }
                    enemy.cosmicMarks++;
                    this.updateCosmicMarkVisual(enemy);
                    this.showStatusText(enemy.sprite.x, enemy.sprite.y, `MARKED x${enemy.cosmicMarks}`, '#cc99ff');
                }

                // Stun enemy
                enemy.isStunned = true;
                enemy.stunnedUntil = currentTime + this.cosmicDashStunDuration;
                this.showStatusText(enemy.sprite.x, enemy.sprite.y, 'DAZED', '#9966ff');

                // Flash
                enemy.sprite.setTint(0x9966ff);
                this.time.delayedCall(this.cosmicDashStunDuration, () => {
                    if (enemy.sprite && enemy.sprite.active) {
                        enemy.sprite.clearTint();
                        enemy.isStunned = false;
                    }
                });
            }
        }

        // Refund charge if hit at least one unmarked enemy
        if (hitUnmarkedEnemy) {
            this.cosmicBatteryCharges = Math.min(this.cosmicMaxCharges, this.cosmicBatteryCharges + 1);
        }

        // Draw trail using graphics API
        const oldTrailX = oldTileX * this.TILE_SIZE + this.TILE_SIZE / 2;
        const oldTrailY = oldTileY * this.TILE_SIZE + this.TILE_SIZE / 2;
        const newTrailX = targetX * this.TILE_SIZE + this.TILE_SIZE / 2;
        const newTrailY = targetY * this.TILE_SIZE + this.TILE_SIZE / 2;

        const graphics = this.add.graphics();
        graphics.lineStyle(8, 0x9966ff, 0.6);
        graphics.beginPath();
        graphics.moveTo(oldTrailX, oldTrailY);
        graphics.lineTo(newTrailX, newTrailY);
        graphics.strokePath();

        this.tweens.add({
            targets: graphics,
            alpha: 0,
            duration: 300,
            onComplete: () => graphics.destroy()
        });

        // Teleport player
        this.playerX = targetX;
        this.playerY = targetY;
        this.player.x = targetX * this.TILE_SIZE + this.TILE_SIZE / 2;
        this.player.y = targetY * this.TILE_SIZE + this.TILE_SIZE / 2 + this.SLIME_Y_OFFSET;

        // Visuals
        const burst = this.add.circle(this.player.x, this.player.y, 5, 0xffffff, 1);
        this.tweens.add({
            targets: burst,
            radius: 25,
            alpha: 0,
            duration: 300,
            onComplete: () => burst.destroy()
        });

        this.player.setTint(0x9966ff);
        this.time.delayedCall(150, () => {
            if (this.cosmicBlackHole) {
                this.player.setTint(0x9966ff);
            } else {
                this.player.clearTint();
            }
        });

        this.lastCosmicDashTime = currentTime;
        this.updateHUD();
    }
}