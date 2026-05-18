// ═══════════════════════════════════════════════════════════════════════
// WEAPONSYSTEM.JS — All player weapons and projectiles (fire, ice shards, fireballs)
// ═══════════════════════════════════════════════════════════════════════
// All methods receive GameScene as `this` via .call(scene, ...) from GameScene.js
// Do NOT add local state here — all state lives on the scene object.

class WeaponSystem {

    shootAttack(targetX, targetY) {
        if (this.currentElement === 'lightning') return;
        if (this.nodeChannelActive) this.cancelNodeChannel();

        const currentTime = this.time.now;

        const worldX = targetX + this.cameras.main.scrollX;
        const worldY = targetY + this.cameras.main.scrollY;
        const playerPixelX = this.playerX * this.TILE_SIZE + this.TILE_SIZE / 2;
        const playerPixelY = this.playerY * this.TILE_SIZE + this.TILE_SIZE / 2;

        const dx = worldX - playerPixelX;
        const dy = worldY - playerPixelY;
        const distanceInTiles = Math.sqrt(dx * dx + dy * dy) / this.TILE_SIZE;

        const maxRange = this.currentElement === 'fire' ? this.fireballMaxRange : 30;
        if (distanceInTiles > maxRange) return;

        let baseCooldown;
        if (this.currentElement === 'fire') {
            baseCooldown = this.fireballCooldown;
        } else if (this.currentElement === 'ice') {
            baseCooldown = this.iceballCooldown;
        }

        const effectiveCooldown = baseCooldown / this.attackSpeedMultiplier;
        if (currentTime - this.lastFireballTime < effectiveCooldown) return;

        if (this.currentElement === 'fire') {
            this.shootFireball(targetX, targetY);
        } else if (this.currentElement === 'ice') {
            this.shootIceShard(targetX, targetY);
        }

        this.lastFireballTime = currentTime;
    }

    fireEquippedWeapon(targetX, targetY) {
        const weapon = this.equippedWeapons?.[this.currentElement] || 'flame_fists';
        switch (weapon) {
            case 'flame_sword':     this.flameSwordAttack(targetX, targetY); break;
            case 'magma_hammer':    this.magmaHammerAttack(targetX, targetY); break;
            case 'ice_fists':       this.iceFistsAttack(targetX, targetY); break;
            case 'icicle_staff':    this.icicleStaffAttack(targetX, targetY); break;
            case 'lightning_fists': this.lightningFistsAttack(targetX, targetY); break;
            case 'flame_fists': default: this.flameFistsAttack(targetX, targetY); break;
        }
    }

    flameFistsAttack(targetX, targetY) {
        const currentTime = this.time.now;
        if (currentTime - (this.lastFlameFistsTime || 0) < 600) return;
        this.lastFlameFistsTime = currentTime;

        const worldX = targetX + this.cameras.main.scrollX;
        const worldY = targetY + this.cameras.main.scrollY;
        const playerPx = this.playerX * this.TILE_SIZE + this.TILE_SIZE / 2;
        const playerPy = this.playerY * this.TILE_SIZE + this.TILE_SIZE / 2;

        const dx = worldX - playerPx;
        const dy = worldY - playerPy;

        // Determine facing direction from mouse
        let facingX = 0, facingY = 0;
        if (Math.abs(dx) > Math.abs(dy)) {
            facingX = dx > 0 ? 1 : -1;
        } else {
            facingY = dy > 0 ? 1 : -1;
        }

        // 1x3 swipe: only the single row/column directly in front (range = 1 tile)
        const swipeTiles = [];
        if (facingX !== 0) {
            swipeTiles.push({ x: this.playerX + facingX, y: this.playerY });
        } else {
            swipeTiles.push({ x: this.playerX, y: this.playerY + facingY });
        }

        const damage = 15 * this.damageScaling;

        for (let tile of swipeTiles) {
            if (tile.x < 0 || tile.x >= this.WORLD_WIDTH || tile.y < 0 || tile.y >= this.WORLD_HEIGHT) continue;
            if (this.world[tile.x][tile.y] !== this.FLOOR) continue;
            if (!this.isInCurrentRoom(tile.x, tile.y)) continue;

            const px = tile.x * this.TILE_SIZE + this.TILE_SIZE / 2;
            const py = tile.y * this.TILE_SIZE + this.TILE_SIZE / 2;

            // Small swipe visual on the tile itself
            const swipeGfx = this.add.graphics().setDepth(3);
            swipeGfx.x = px;
            swipeGfx.y = py;
            swipeGfx.fillStyle(0xff4400, 0.7);
            swipeGfx.fillCircle(0, 0, this.TILE_SIZE * 0.4);
            this.tweens.add({ targets: swipeGfx, alpha: 0, scaleX: 1.3, scaleY: 1.3, duration: 180, onComplete: () => swipeGfx.destroy() });

            // Leave a single lava tile (spawn ignition trail directly, no 3x3 spread)
            this.spawnIgnitionTrail(px, py);

            // Hit portal if on this tile
            const portal = this.getPortalAt(tile.x, tile.y);
            if (portal) this.damagePortal(portal, damage);
            this.damageBossAtTile(tile.x, tile.y, damage);

            // Damage enemies on that tile
            for (let enemy of [...this.enemies]) {
                if (enemy.x === tile.x && enemy.y === tile.y) {
                    if (enemy.iceImmune) {
                        this.showStatusText(enemy.sprite.x, enemy.sprite.y - 10, 'ICE IMMUNE', '#88eeff');
                        this._triggerIceImmuneGlerpReaction();
                        continue;
                    }
                    if (enemy.fireImmune) {
                        this.showStatusText(enemy.sprite.x, enemy.sprite.y - 10, 'IMMUNE', '#ff8844');
                        continue;
                    }
                    if (enemy.elementImmune) {
                        this.showStatusText(enemy.sprite.x, enemy.sprite.y - 10, 'IMMUNE', '#8888ff');
                        continue;
                    }
                    enemy.health -= damage;
                    this.showDamageNumber(enemy.sprite.x, enemy.sprite.y - 10, damage, '#ff6600');
                    this.updateEnemyHealthBar(enemy);
                    if (enemy.health <= 0) this.killEnemy(enemy);
                }
            }
        }

        this.cameras.main.shake(50, 0.002);
    }

    iceFistsAttack(targetX, targetY) {
        const currentTime = this.time.now;
        if (currentTime - (this.lastIceFistsTime || 0) < 500) return;
        this.lastIceFistsTime = currentTime;

        const worldX = targetX + this.cameras.main.scrollX;
        const worldY = targetY + this.cameras.main.scrollY;
        const playerPx = this.playerX * this.TILE_SIZE + this.TILE_SIZE / 2;
        const playerPy = this.playerY * this.TILE_SIZE + this.TILE_SIZE / 2;
        const dx = worldX - playerPx, dy = worldY - playerPy;

        let facingX = 0, facingY = 0;
        if (Math.abs(dx) > Math.abs(dy)) { facingX = dx > 0 ? 1 : -1; }
        else { facingY = dy > 0 ? 1 : -1; }

        const tile = { x: this.playerX + facingX, y: this.playerY + facingY };
        if (tile.x < 0 || tile.x >= this.WORLD_WIDTH || tile.y < 0 || tile.y >= this.WORLD_HEIGHT) return;
        if (this.world[tile.x][tile.y] !== this.FLOOR) return;
        if (!this.isInCurrentRoom(tile.x, tile.y)) return;

        const px = tile.x * this.TILE_SIZE + this.TILE_SIZE / 2;
        const py = tile.y * this.TILE_SIZE + this.TILE_SIZE / 2;

        // Ice tile visual — full tile blue flash, fades out (no persistent tile)
        const iceFlash = this.add.graphics().setDepth(1.5);
        iceFlash.fillStyle(0x44aaff, 0.7);
        iceFlash.fillRect(
            tile.x * this.TILE_SIZE, tile.y * this.TILE_SIZE,
            this.TILE_SIZE, this.TILE_SIZE
        );
        iceFlash.fillStyle(0xccffff, 0.45);
        iceFlash.fillRect(
            tile.x * this.TILE_SIZE + 3, tile.y * this.TILE_SIZE + 3,
            this.TILE_SIZE - 6, this.TILE_SIZE - 6
        );
        this.tweens.add({ targets: iceFlash, alpha: 0, duration: 300, onComplete: () => iceFlash.destroy() });

        for (const enemy of [...this.enemies]) {
            if (enemy.x !== tile.x || enemy.y !== tile.y) continue;
            this.applyIceFistsHit(enemy);
        }

        // Hit portal if on this tile
        const portalHit = this.getPortalAt(tile.x, tile.y);
        if (portalHit) this.damagePortal(portalHit, 5 * this.damageScaling);
        this.damageBossAtTile(tile.x, tile.y, 12 * this.damageScaling);

        this.cameras.main.shake(30, 0.001);
    }

    lightningFistsAttack(targetX, targetY) {
        const currentTime = this.time.now;
        if (currentTime - (this.lastLightningFistsTime || 0) < 500) return;
        this.lastLightningFistsTime = currentTime;

        const worldX = targetX + this.cameras.main.scrollX;
        const worldY = targetY + this.cameras.main.scrollY;
        const playerPx = this.playerX * this.TILE_SIZE + this.TILE_SIZE / 2;
        const playerPy = this.playerY * this.TILE_SIZE + this.TILE_SIZE / 2;
        const dx = worldX - playerPx, dy = worldY - playerPy;

        let facingX = 0, facingY = 0;
        if (Math.abs(dx) > Math.abs(dy)) facingX = dx > 0 ? 1 : -1;
        else facingY = dy > 0 ? 1 : -1;

        // ── Direct fist hit (1 tile) ──────────────────────────────────────
        const tile = { x: this.playerX + facingX, y: this.playerY + facingY };
        const tileValid = tile.x >= 0 && tile.x < this.WORLD_WIDTH &&
                          tile.y >= 0 && tile.y < this.WORLD_HEIGHT &&
                          this.world[tile.x][tile.y] === this.FLOOR &&
                          this.isInCurrentRoom(tile.x, tile.y);

        if (tileValid) {
            const px = tile.x * this.TILE_SIZE + this.TILE_SIZE / 2;
            const py = tile.y * this.TILE_SIZE + this.TILE_SIZE / 2;

            // Yellow flash
            const flash = this.add.graphics().setDepth(1.5);
            flash.fillStyle(0xffff00, 0.55);
            flash.fillRect(tile.x * this.TILE_SIZE, tile.y * this.TILE_SIZE, this.TILE_SIZE, this.TILE_SIZE);
            this.tweens.add({ targets: flash, alpha: 0, duration: 200, onComplete: () => flash.destroy() });

            // Spark burst
            for (let i = 0; i < 4; i++) {
                const a = (Math.PI * 2 / 4) * i;
                const spark = this.add.graphics().setDepth(2);
                spark.lineStyle(1.5, 0xffff88, 0.9);
                spark.beginPath();
                spark.moveTo(px, py);
                spark.lineTo(px + Math.cos(a) * (6 + Math.random() * 4), py + Math.sin(a) * (6 + Math.random() * 4));
                spark.strokePath();
                this.tweens.add({ targets: spark, alpha: 0, duration: 150, onComplete: () => spark.destroy() });
            }

            const dmg = 14 * this.damageScaling;
            for (const enemy of [...this.enemies]) {
                if (enemy.x !== tile.x || enemy.y !== tile.y) continue;
                if (enemy.lightningImmune || enemy.elementImmune) {
                    this.showStatusText(enemy.sprite.x, enemy.sprite.y - 10, 'IMMUNE', '#ffff44');
                    continue;
                }
                enemy.health -= dmg;
                this.showDamageNumber(enemy.sprite.x, enemy.sprite.y - 10, dmg, '#ffff44');
                this.updateEnemyHealthBar(enemy);
                this.applySuperConduct(enemy);
                this.gainUltCharge(this.ultChargePerHit);
                if (enemy.health <= 0) this.killEnemy(enemy);
                else { enemy.sprite.setTint(0xffff44); this.time.delayedCall(100, () => { if (enemy.sprite?.active) enemy.sprite.clearTint(); }); }
            }
            const portal = this.getPortalAt(tile.x, tile.y);
            if (portal) this.damagePortal(portal, dmg);
            this.damageBossAtTile(tile.x, tile.y, dmg);
        }

        // ── Passive arc: zap superconducted enemies in 2×3 zone ──────────
        const arcHit = new Set();
        for (let depth = 1; depth <= 3; depth++) {
            for (let side = -1; side <= 1; side++) {
                let zx, zy;
                if (facingX !== 0) { zx = this.playerX + facingX * depth; zy = this.playerY + side; }
                else               { zx = this.playerX + side; zy = this.playerY + facingY * depth; }
                if (zx === tile.x && zy === tile.y) continue;
                if (zx < 0 || zx >= this.WORLD_WIDTH || zy < 0 || zy >= this.WORLD_HEIGHT) continue;
                if (this.world[zx][zy] !== this.FLOOR) continue;
                if (!this.isInCurrentRoom(zx, zy)) continue;

                for (const enemy of [...this.enemies]) {
                    if (enemy.x !== zx || enemy.y !== zy) continue;
                    if (!enemy.isSuperConducted) continue;
                    if (arcHit.has(enemy)) continue;
                    if (enemy.lightningImmune || enemy.elementImmune) continue;
                    arcHit.add(enemy);
                    this.drawLightningBolt({ sprite: this.player }, enemy);
                    const arcDmg = 10 * this.damageScaling;
                    enemy.health -= arcDmg;
                    this.showDamageNumber(enemy.sprite.x, enemy.sprite.y - 14, arcDmg, '#ffffaa');
                    this.updateEnemyHealthBar(enemy);
                    this.gainUltCharge(this.ultChargePerHit * 0.5);
                    if (enemy.health <= 0) this.killEnemy(enemy);
                    else { enemy.sprite.setTint(0xffff88); this.time.delayedCall(80, () => { if (enemy.sprite?.active) enemy.sprite.clearTint(); }); }
                }
                this.damageBossAtTile(zx, zy, 10 * this.damageScaling);
            }
        }

        this.cameras.main.shake(30, 0.001);
    }

    applyIceFistsHit(enemy) {
        const time = this.time.now;

        // Already frozen: next hit triggers shatter burst on top of multiplied damage
        if (enemy.isFrozen) {
            this._triggerShatterBurst(enemy);
            return;
        }

        // Apply chill stack
        if (!enemy.chillStacks) enemy.chillStacks = 0;
        enemy.chillStacks++;
        enemy.lastChillTime = time;

        // Small chip damage per hit — ice fists work on ice elementals (ice on ice)
        const chipDmg = 12 * this.damageScaling;
        enemy.health -= chipDmg;
        this.showDamageNumber(enemy.sprite.x, enemy.sprite.y - 10, chipDmg, '#88eeff');
        this.updateEnemyHealthBar(enemy);
        if (enemy.health <= 0) { this._destroyChillIndicator(enemy); this.killEnemy(enemy); return; }

        // Tint flash
        enemy.sprite.setTint(0x88ccff);
        this.time.delayedCall(100, () => { if (enemy.sprite?.active) enemy.sprite.clearTint(); });

        // Update persistent chill indicator
        this._updateChillIndicator(enemy);

        // 3rd hit → freeze for 10s
        if (enemy.chillStacks >= 3) {
            enemy.chillStacks = 0;
            enemy.frozenAt = time;
            this._destroyChillIndicator(enemy);
            this.freezeEnemy(enemy, 10000);
            this.gainUltCharge(this.ultChargePerFreeze);
            // Schedule water tile on natural melt
            enemy._freezeMeltTimer = this.time.delayedCall(10000, () => {
                if (enemy.sprite?.active) this._shatterWaterSplash(enemy.x, enemy.y);
            });
        }
    }

    _updateChillIndicator(enemy) {
        // Create or update a row of ice dots above the enemy showing chill stacks
        if (!enemy._chillBar) {
            enemy._chillBar = [];
            for (let i = 0; i < 3; i++) {
                const dot = this.add.graphics().setDepth(3);
                enemy._chillBar.push(dot);
            }
        }
        const stacks = enemy.chillStacks || 0;
        for (let i = 0; i < 3; i++) {
            const dot = enemy._chillBar[i];
            dot.clear();
            const filled = i < stacks;
            dot.fillStyle(filled ? 0x44aaff : 0x112233, filled ? 1 : 0.5);
            dot.fillCircle(0, 0, 4);
            if (filled) {
                dot.lineStyle(1, 0xaaddff, 0.8);
                dot.strokeCircle(0, 0, 4);
            }
            // Position: 3 dots spaced across enemy head
            dot.x = enemy.sprite.x + (i - 1) * 10;
            dot.y = enemy.sprite.y - 30;
        }
    }

    _destroyChillIndicator(enemy) {
        if (enemy._chillBar) {
            for (const dot of enemy._chillBar) {
                this.tweens.killTweensOf(dot);
                dot.destroy();
            }
            enemy._chillBar = null;
        }
    }

    _triggerShatterBurst(enemy) {
        if (!enemy._shatterTriggered) {
            enemy._shatterTriggered = true;

            // Kill all tweens, then force correct position+scale on next frame
            // (onComplete of killed tweens may still fire this frame)
            this.tweens.killTweensOf(enemy.sprite);
            const snapX = enemy.x * this.TILE_SIZE + this.TILE_SIZE / 2;
            const snapY = enemy.y * this.TILE_SIZE + this.TILE_SIZE / 2 + this.SLIME_Y_OFFSET;
            // Use delayedCall(0) so it runs after any onComplete callbacks fire this frame
            this.time.delayedCall(0, () => {
                if (!enemy.sprite || !enemy.sprite.active) return;
                this.tweens.killTweensOf(enemy.sprite);
                enemy.sprite.x = snapX;
                enemy.sprite.y = snapY;
                enemy.sprite.setScale(this.SLIME_SCALE);
            });
            enemy.sprite.x = snapX;
            enemy.sprite.y = snapY;
            enemy.sprite.setScale(this.SLIME_SCALE);

            const ex = snapX, ey = snapY;

            // Shard burst
            for (let i = 0; i < 10; i++) {
                const angle = (i / 10) * Math.PI * 2;
                const shard = this.add.rectangle(ex, ey, 5, 10, 0xaaffff, 1).setDepth(4);
                shard.setRotation(angle);
                this.tweens.add({
                    targets: shard,
                    x: ex + Math.cos(angle) * 30, y: ey + Math.sin(angle) * 30,
                    alpha: 0, scaleX: 0.3, scaleY: 0.3,
                    duration: 350, ease: 'Quad.easeOut',
                    onComplete: () => shard.destroy()
                });
            }
            const burst = this.add.circle(ex, ey, 8, 0xffffff, 0.9).setDepth(4);
            this.tweens.add({ targets: burst, radius: 28, alpha: 0, duration: 300, onComplete: () => burst.destroy() });
            this.cameras.main.shake(80, 0.006);
            this.showStatusText(ex, ey - 28, 'SHATTER!', '#aaffff');
            this.gainUltCharge(this.ultChargePerFreeze * 2);

            // Cancel natural-melt timer
            if (enemy._freezeMeltTimer) { enemy._freezeMeltTimer.remove(); enemy._freezeMeltTimer = null; }

            // Big burst damage on shatter
            const shatterDmg = 100 * this.damageScaling;
            this.damageEnemy(enemy, shatterDmg, 'ice');
            this.showDamageNumber(ex, ey - 44, shatterDmg, '#ffffff');

            // Water splash outward — wets enemies in radius 3
            this._shatterWaterSplash(enemy.x, enemy.y);

            // Unfreeze
            enemy.isFrozen = false;
            enemy.frozenUntil = 0;
            enemy.frozenAt = 0;
            if (enemy.sprite?.active) enemy.sprite.clearTint();
            if (enemy.freezeVisuals) {
                ['iceBlock', 'iceBorder', 'multiplierText'].forEach(k => {
                    if (enemy.freezeVisuals[k]) {
                        this.tweens.killTweensOf(enemy.freezeVisuals[k]);
                        enemy.freezeVisuals[k].destroy();
                    }
                });
                enemy.freezeVisuals = null;
            }

            // Destroy chill stack indicator
            this._destroyChillIndicator(enemy);

            // Reset flag after short delay
            this.time.delayedCall(100, () => { enemy._shatterTriggered = false; });
        }
    }

    _shatterWaterSplash(originTileX, originTileY) {
        // Rings appear outward (r=0..3), linger together, then disappear outward (r=0 last).
        // Each ring stays visible until its outward-fade turn comes.
        const RADIUS       = 3;
        const RING_INTERVAL = 100;  // ms between each ring appearing
        const HOLD_TIME    = 400;   // ms all rings stay fully visible after last ring appears
        const FADE_DUR     = 180;   // ms to fade each ring out
        const WET_DURATION = 4500;

        if (!this.activeWaterTiles) this.activeWaterTiles = [];

        // Collect tile visuals per ring so we can fade them in reverse order
        const ringObjs = [];

        for (let r = 0; r <= RADIUS; r++) {
            const appearDelay = r * RING_INTERVAL;
            // Disappear: outermost ring fades first, then inward
            const disappearDelay = appearDelay + HOLD_TIME + (RADIUS - r) * RING_INTERVAL;

            const tiles = [];
            if (r === 0) {
                tiles.push({ tx: originTileX, ty: originTileY });
            } else {
                for (let dx = -r; dx <= r; dx++) {
                    for (let dy = -r; dy <= r; dy++) {
                        const dist = Math.sqrt(dx * dx + dy * dy);
                        if (dist < r - 0.6 || dist > r + 0.6) continue;
                        tiles.push({ tx: originTileX + dx, ty: originTileY + dy });
                    }
                }
            }

            this.time.delayedCall(appearDelay, () => {
                if (this._deathScreenActive) return;
                for (const { tx, ty } of tiles) {
                    if (!this.world[tx] || this.world[tx][ty] !== this.FLOOR) continue;
                    const wx = tx * this.TILE_SIZE + this.TILE_SIZE / 2;
                    const wy = ty * this.TILE_SIZE + this.TILE_SIZE / 2;

                    const tile    = this.add.rectangle(wx, wy, this.TILE_SIZE, this.TILE_SIZE, 0x55aaff, 0).setDepth(0.8);
                    const shimmer = this.add.circle(wx, wy, this.TILE_SIZE * 0.32, 0xaaddff, 0).setDepth(0.9);

                    // Flash in
                    this.tweens.add({ targets: tile,    alpha: 0.55, duration: 80, ease: 'Quad.easeOut' });
                    this.tweens.add({ targets: shimmer, alpha: 0.45, duration: 80, ease: 'Quad.easeOut' });

                    // Fade out at its scheduled disappear time
                    const fadeIn = disappearDelay - appearDelay;
                    this.time.delayedCall(fadeIn, () => {
                        this.tweens.add({ targets: [tile, shimmer], alpha: 0, duration: FADE_DUR,
                            onComplete: () => { tile.destroy(); shimmer.destroy(); } });
                    });

                    // Register wet zone
                    const expiresAt = this.time.now + disappearDelay + FADE_DUR;
                    const tileEntry = { tileX: tx, tileY: ty, expiresAt };
                    this.activeWaterTiles.push(tileEntry);
                    this.time.delayedCall(disappearDelay + FADE_DUR, () => {
                        const idx = this.activeWaterTiles.indexOf(tileEntry);
                        if (idx !== -1) this.activeWaterTiles.splice(idx, 1);
                    });

                    // Wet enemies on this tile now
                    for (const enemy of this.enemies) {
                        if (enemy.x !== tx || enemy.y !== ty) continue;
                        if (enemy.isWet) { enemy.wetUntil = this.time.now + WET_DURATION; continue; }
                        enemy.isWet = true;
                        enemy.wetUntil = this.time.now + WET_DURATION;
                        if (enemy.sprite?.active) {
                            enemy.sprite.setTint(0x4499ff);
                            this.showStatusText(enemy.sprite.x, enemy.sprite.y, 'WET', '#44aaff');
                            this.time.delayedCall(WET_DURATION, () => {
                                enemy.isWet = false;
                                if (enemy.sprite?.active && !enemy.isFrozen) enemy.sprite.clearTint();
                            });
                        }
                    }
                }
            });
        }
    }

    icicleStaffAttack(targetX, targetY) {
        const currentTime = this.time.now;
        if (currentTime - (this.lastIcicleStaffTime || 0) < 900) return;
        this.lastIcicleStaffTime = currentTime;

        const playerPx = this.playerX * this.TILE_SIZE + this.TILE_SIZE / 2;
        const playerPy = this.playerY * this.TILE_SIZE + this.TILE_SIZE / 2;
        const RADIUS = 3; // tiles
        const radiusPx = RADIUS * this.TILE_SIZE;
        const damage = 32 * this.damageScaling;

        // ── Visual: expanding icy ring ────────────────────────────────
        const gfx = this.add.graphics().setDepth(4);
        gfx.x = playerPx; gfx.y = playerPy;

        // Animate: ring expands from 0 to radiusPx, then fades
        let elapsed = 0;
        const ANIM_DUR = 280;
        this.time.addEvent({
            delay: 16,
            repeat: Math.floor(ANIM_DUR / 16),
            callback: () => {
                elapsed += 16;
                const t = Math.min(elapsed / ANIM_DUR, 1);
                const ease = 1 - Math.pow(1 - t, 2); // quad ease out
                const curR = radiusPx * ease;
                gfx.clear();
                // Outer glow ring
                gfx.lineStyle(6, 0x88ddff, 0.25 * (1 - t));
                gfx.strokeCircle(0, 0, curR + 6);
                // Main ice ring
                gfx.lineStyle(3, 0xaaeeff, 0.85 * (1 - t * 0.4));
                gfx.strokeCircle(0, 0, curR);
                // Inner fill (faint)
                gfx.fillStyle(0x44aaff, 0.08 * (1 - t));
                gfx.fillCircle(0, 0, curR);
                // Icicle spikes around the ring — 12 evenly spaced
                gfx.fillStyle(0xccffff, 0.7 * (1 - t));
                for (let i = 0; i < 12; i++) {
                    const a = (i / 12) * Math.PI * 2;
                    const sx = Math.cos(a) * curR;
                    const sy = Math.sin(a) * curR;
                    const ix = Math.cos(a) * (curR + 8 * ease);
                    const iy = Math.sin(a) * (curR + 8 * ease);
                    const lx = Math.cos(a + 0.15) * (curR - 4);
                    const ly = Math.sin(a + 0.15) * (curR - 4);
                    const rx = Math.cos(a - 0.15) * (curR - 4);
                    const ry = Math.sin(a - 0.15) * (curR - 4);
                    gfx.fillTriangle(ix, iy, lx, ly, rx, ry);
                }
                if (t >= 1) {
                    this.tweens.add({ targets: gfx, alpha: 0, duration: 120, onComplete: () => gfx.destroy() });
                }
            }
        });

        // Screen-space frost flash
        const flash = this.add.circle(playerPx, playerPy, 8, 0xaaddff, 0.6).setDepth(3);
        this.tweens.add({ targets: flash, scaleX: radiusPx / 4, scaleY: radiusPx / 4, alpha: 0, duration: ANIM_DUR, ease: 'Quad.easeOut', onComplete: () => flash.destroy() });

        this.cameras.main.shake(55, 0.004);

        // ── Hit detection: true circle using pixel distance ───────────
        const hitEnemies = new Set();
        for (const enemy of [...this.enemies]) {
            if (hitEnemies.has(enemy)) continue;
            const ex = enemy.x * this.TILE_SIZE + this.TILE_SIZE / 2;
            const ey = enemy.y * this.TILE_SIZE + this.TILE_SIZE / 2;
            const dist = Math.sqrt((ex - playerPx) ** 2 + (ey - playerPy) ** 2);
            if (dist > radiusPx || dist < this.TILE_SIZE * 0.5) continue; // skip player tile
            if (!this.isInCurrentRoom(enemy.x, enemy.y)) continue;
            hitEnemies.add(enemy);

            if (enemy.fireImmune) { this.showStatusText(enemy.sprite.x, enemy.sprite.y - 10, 'IMMUNE', '#ff8844'); continue; }
            if (enemy.elementImmune) { this.showStatusText(enemy.sprite.x, enemy.sprite.y - 10, 'IMMUNE', '#8888ff'); continue; }
            if (this.isTutorial && enemy.tutorialRoomIndex !== undefined &&
                enemy.tutorialRoomIndex !== this.getCurrentPlayerRoom()) continue;

            // Apply ice fists-style hit (chill stacks, freeze on 3rd, shatter if frozen)
            this.applyIceFistsHit(enemy);

            // Hit portal
            const p = this.getPortalAt(enemy.x, enemy.y);
            if (p) this.damagePortal(p, damage);
        }

        // Also damage portals + boss in range
        if (this.voltslimeBoss?.active) {
            const bx2 = this.voltslimeBoss.container.x, by2 = this.voltslimeBoss.container.y;
            if (Math.sqrt((bx2 - playerPx) ** 2 + (by2 - playerPy) ** 2) <= radiusPx)
                this.damageBossAtTile(this.voltslimeBoss.tileX, this.voltslimeBoss.tileY, damage);
        }
        if (this.portals) {
            for (const portal of this.portals) {
                if (!portal.active) continue;
                const px2 = portal.tileX * this.TILE_SIZE + this.TILE_SIZE / 2;
                const py2 = portal.tileY * this.TILE_SIZE + this.TILE_SIZE / 2;
                const dist = Math.sqrt((px2 - playerPx) ** 2 + (py2 - playerPy) ** 2);
                if (dist <= radiusPx) this.damagePortal(portal, damage);
            }
        }
    }

    flameSwordAttack(targetX, targetY) {
        const currentTime = this.time.now;
        if (currentTime - (this.lastFlameSwordTime || 0) < 420) return;
        this.lastFlameSwordTime = currentTime;

        const worldX = targetX + this.cameras.main.scrollX;
        const worldY = targetY + this.cameras.main.scrollY;
        const playerPx = this.playerX * this.TILE_SIZE + this.TILE_SIZE / 2;
        const playerPy = this.playerY * this.TILE_SIZE + this.TILE_SIZE / 2;

        const dx = worldX - playerPx, dy = worldY - playerPy;
        const facingAngle = Math.atan2(dy, dx);
        const halfSpread = Math.PI * (55 / 180); // ±55° = 110° total arc

        // ── Sample the arc at 5 angles, collecting the tile nearest each ray ──
        // Angles: left-edge, left-mid, centre, right-mid, right-edge
        const sampleAngles = [
            facingAngle - halfSpread,
            facingAngle - halfSpread * 0.5,
            facingAngle,
            facingAngle + halfSpread * 0.5,
            facingAngle + halfSpread,
        ];

        // For each sample angle cast at range 1.5 tiles (hits the ring of tiles
        // 1–2 away) and round to nearest tile. Dedupe by tile key.
        const tileMap = new Map();
        for (const angle of sampleAngles) {
            for (const r of [1.0, 1.85]) {
                const wx = playerPx + Math.cos(angle) * r * this.TILE_SIZE;
                const wy = playerPy + Math.sin(angle) * r * this.TILE_SIZE;
                const tx = Math.round((wx - this.TILE_SIZE / 2) / this.TILE_SIZE);
                const ty = Math.round((wy - this.TILE_SIZE / 2) / this.TILE_SIZE);
                const key = `${tx},${ty}`;
                // Skip player tile and already-added tiles
                if (tx === this.playerX && ty === this.playerY) continue;
                if (!tileMap.has(key)) tileMap.set(key, { x: tx, y: ty });
                // Stop once we have 5 unique tiles
                if (tileMap.size >= 5) break;
            }
            if (tileMap.size >= 5) break;
        }
        const swipeTiles = [...tileMap.values()];

        const damage = 28 * this.damageScaling;

        // ── Arc sweep visual ───────────────────────────────────────────────
        const arcRadius = 2.6 * this.TILE_SIZE;
        const arcGfx = this.add.graphics().setDepth(3);
        arcGfx.x = playerPx; arcGfx.y = playerPy;

        const SWING_DURATION = 200;
        const startAngle = facingAngle + halfSpread;
        const endAngle   = facingAngle - halfSpread;
        let elapsed = 0;
        this.time.addEvent({
            delay: 16,
            repeat: Math.floor(SWING_DURATION / 16),
            callback: () => {
                elapsed += 16;
                const t = Math.min(elapsed / SWING_DURATION, 1);
                const curEnd = startAngle + (endAngle - startAngle) * t;
                arcGfx.clear();
                arcGfx.fillStyle(0xff6600, 0.16); arcGfx.slice(0, 0, arcRadius + 8, startAngle, curEnd, true); arcGfx.fillPath();
                arcGfx.fillStyle(0xff8800, 0.50); arcGfx.slice(0, 0, arcRadius,     startAngle, curEnd, true); arcGfx.fillPath();
                arcGfx.fillStyle(0xffdd66, 0.72); arcGfx.slice(0, 0, arcRadius*0.4, startAngle, curEnd, true); arcGfx.fillPath();
                arcGfx.lineStyle(2, 0xffffff, 0.45 * (1 - t));
                arcGfx.beginPath(); arcGfx.moveTo(0, 0);
                arcGfx.lineTo(Math.cos(curEnd) * arcRadius, Math.sin(curEnd) * arcRadius);
                arcGfx.strokePath();
                if (t >= 1) this.tweens.add({ targets: arcGfx, alpha: 0, duration: 80, onComplete: () => arcGfx.destroy() });
            }
        });

        // ── Hit tiles ─────────────────────────────────────────────────────
        const hitEnemies = new Set();
        for (const tile of swipeTiles) {
            const { x: tx, y: ty } = tile;
            if (tx < 0 || tx >= this.WORLD_WIDTH || ty < 0 || ty >= this.WORLD_HEIGHT) continue;
            if (this.world[tx][ty] !== this.FLOOR) continue;
            if (!this.isInCurrentRoom(tx, ty)) continue;

            const tpx = tx * this.TILE_SIZE + this.TILE_SIZE / 2;
            const tpy = ty * this.TILE_SIZE + this.TILE_SIZE / 2;
            this.time.delayedCall(SWING_DURATION * 0.5, () => this.spawnIgnitionTrail(tpx, tpy));

            // Hit portal if on this tile
            const p = this.getPortalAt(tx, ty);
            if (p) this.damagePortal(p, damage);
            this.damageBossAtTile(tx, ty, damage);

            for (const enemy of [...this.enemies]) {
                if (enemy.x !== tx || enemy.y !== ty || hitEnemies.has(enemy)) continue;
                hitEnemies.add(enemy);
                if (enemy.iceImmune) {
                    this.showStatusText(enemy.sprite.x, enemy.sprite.y - 10, 'ICE IMMUNE', '#88eeff');
                    this._triggerIceImmuneGlerpReaction();
                    continue;
                }
                if (enemy.fireImmune) { this.showStatusText(enemy.sprite.x, enemy.sprite.y - 10, 'IMMUNE', '#ff8844'); continue; }
                if (enemy.elementImmune) { this.showStatusText(enemy.sprite.x, enemy.sprite.y - 10, 'IMMUNE', '#8888ff'); continue; }
                enemy.health -= damage;
                this.showDamageNumber(enemy.sprite.x, enemy.sprite.y - 10, damage, '#ff8800');
                this.updateEnemyHealthBar(enemy);
                if (enemy.health <= 0) this.killEnemy(enemy);
            }
        }

        this.cameras.main.shake(60, 0.005);
    }

    magmaHammerAttack(targetX, targetY) {
        const currentTime = this.time.now;
        if (currentTime - (this.lastMagmaHammerTime || 0) < 2200) return;
        this.lastMagmaHammerTime = currentTime;
        this.isPointerDown = false;

        const worldX = targetX + this.cameras.main.scrollX;
        const worldY = targetY + this.cameras.main.scrollY;
        const playerPx = this.playerX * this.TILE_SIZE + this.TILE_SIZE / 2;
        const playerPy = this.playerY * this.TILE_SIZE + this.TILE_SIZE / 2;

        // Real mouse angle — same approach as flame sword
        const dx = worldX - playerPx, dy = worldY - playerPy;
        const facingAngle = Math.atan2(dy, dx);

        const RIPPLE_TILES  = 6;
        const STEP_DELAY    = 80;
        const LAVA_RIPPLE   = 1200;  // ripple rolling tiles
        const LAVA_EXPLODE  = 4000;  // explosion circle tiles (buffed)
        const LAVA_LONG     = 9000;

        // Perpendicular axis
        const perpAngle = facingAngle + Math.PI / 2;
        const cosFace = Math.cos(facingAngle), sinFace = Math.sin(facingAngle);
        const cosPerp = Math.cos(perpAngle),   sinPerp = Math.sin(perpAngle);

        // Which side is the mouse on? Project mouse offset onto perp axis
        const perpDot = dx * cosPerp + dy * sinPerp;
        const sideSign = perpDot >= 0 ? 1 : -1;

        // 2-tile ripple: centre + 1 tile leaning toward mouse side
        const rippleOffsets = [0, sideSign];

        const getTile = (fwd, side) => ({
            x: Math.round(this.playerX + cosFace * fwd + cosPerp * side),
            y: Math.round(this.playerY + sinFace * fwd + sinPerp * side)
        });

        const preview = this.add.graphics().setDepth(1.5);
        for (let step = 1; step <= RIPPLE_TILES; step++) {
            for (const w of rippleOffsets) {
                const t = getTile(step, w);
                if (t.x < 0 || t.x >= this.WORLD_WIDTH || t.y < 0 || t.y >= this.WORLD_HEIGHT) continue;
                if (this.world[t.x]?.[t.y] !== this.FLOOR) continue;
                preview.fillStyle(0xff6600, Math.max(0.20 - step * 0.025, 0.04));
                preview.fillRect(t.x * this.TILE_SIZE + 1, t.y * this.TILE_SIZE + 1, this.TILE_SIZE - 2, this.TILE_SIZE - 2);
            }
        }
        this.tweens.add({ targets: preview, alpha: 0, duration: 1000, onComplete: () => preview.destroy() });

        // ── Windup visual (local origin = player tile centre) ─────────────
        const windup = this.add.graphics().setDepth(4);
        windup.x = playerPx; windup.y = playerPy;
        windup.fillStyle(0xff4400, 0.45);
        windup.fillRect(-this.TILE_SIZE / 2, -this.TILE_SIZE / 2, this.TILE_SIZE, this.TILE_SIZE);
        windup.lineStyle(3, 0xff8800, 0.9);
        windup.strokeCircle(0, 0, 14);
        this.tweens.add({ targets: windup, scaleX: 1.6, scaleY: 1.6, alpha: 0, duration: 900, ease: 'Quad.easeOut', onComplete: () => windup.destroy() });

        // ── Immediate feedback shake on click ─────────────────────────────
        this.cameras.main.shake(80, 0.006);

        // ── 1s delay then fire the ripple ────────────────────────────────
        this.time.delayedCall(1000, () => {
            if (this._deathScreenActive) return;

            const rippleDmg    = 18 * this.damageScaling;
            const explosionDmg = 55 * this.damageScaling;

            this.cameras.main.shake(50, 0.004); // smaller secondary shake when ripple launches

            // Shockwave ring — local origin, no world-coordinate bug
            const shockwave = this.add.graphics().setDepth(3);
            shockwave.x = playerPx; shockwave.y = playerPy;
            shockwave.lineStyle(3, 0xff6600, 0.8);
            shockwave.strokeCircle(0, 0, 10);
            this.tweens.add({ targets: shockwave, scaleX: 3.5, scaleY: 3.5, alpha: 0, duration: 400, ease: 'Quad.easeOut', onComplete: () => shockwave.destroy() });

            const hitByRipple = new Set();
            let rippleExploded = false;

            for (let step = 1; step <= RIPPLE_TILES; step++) {
                this.time.delayedCall(step * STEP_DELAY, () => {
                    if (this._deathScreenActive || rippleExploded) return;

                    // Check centre tile — if wall, explode here and stop
                    const centre = getTile(step, 0);
                    const centreBlocked =
                        centre.x < 0 || centre.x >= this.WORLD_WIDTH ||
                        centre.y < 0 || centre.y >= this.WORLD_HEIGHT ||
                        !this.world[centre.x] || this.world[centre.x][centre.y] !== this.FLOOR;

                    if (centreBlocked) {
                        rippleExploded = true;
                        // Explode at previous step
                        const prev = getTile(Math.max(1, step - 1), 0);
                        this._magmaExplosion(prev.x, prev.y, explosionDmg, LAVA_EXPLODE, LAVA_LONG);
                        return;
                    }

                    for (const w of rippleOffsets) {
                        const tile = getTile(step, w);
                        const tx = tile.x, ty = tile.y;
                        if (tx < 0 || tx >= this.WORLD_WIDTH || ty < 0 || ty >= this.WORLD_HEIGHT) continue;
                        if (!this.world[tx] || this.world[tx][ty] !== this.FLOOR) continue;
                        const tpx = tx * this.TILE_SIZE + this.TILE_SIZE / 2;
                        const tpy = ty * this.TILE_SIZE + this.TILE_SIZE / 2;

                        // Ripple glow flash
                        const rg = this.add.graphics().setDepth(2.5);
                        rg.fillStyle(0xff6600, 0.7);
                        rg.fillRect(tx * this.TILE_SIZE + 1, ty * this.TILE_SIZE + 1, this.TILE_SIZE - 2, this.TILE_SIZE - 2);
                        rg.fillStyle(0xffdd44, 0.55);
                        rg.fillRect(tx * this.TILE_SIZE + 4, ty * this.TILE_SIZE + 4, this.TILE_SIZE - 8, this.TILE_SIZE - 8);
                        this.tweens.add({ targets: rg, alpha: 0, duration: 220, onComplete: () => rg.destroy() });

                        this.spawnIgnitionTrail(tpx, tpy, LAVA_RIPPLE);

                        for (const enemy of [...this.enemies]) {
                            if (enemy.x !== tx || enemy.y !== ty || hitByRipple.has(enemy)) continue;
                            hitByRipple.add(enemy);
                            if (enemy.iceImmune || enemy.fireImmune || enemy.elementImmune) {
                                this.showStatusText(enemy.sprite.x, enemy.sprite.y - 10, 'IMMUNE', '#ff8844');
                                if (enemy.iceImmune && this.isIceTutorial) this._triggerIceImmuneGlerpReaction();
                                continue;
                            }
                            if (this.isTutorial && enemy.tutorialRoomIndex !== undefined &&
                                enemy.tutorialRoomIndex !== this.getCurrentPlayerRoom()) continue;
                            enemy.health -= rippleDmg;
                            this.showDamageNumber(enemy.sprite.x, enemy.sprite.y - 10, rippleDmg, '#ff6600');
                            this.updateEnemyHealthBar(enemy);
                            if (enemy.health <= 0) { this.killEnemy(enemy); continue; }

                            // Knockback: push 1 tile away from player if within 3 tiles
                            const mdist = Math.abs(enemy.x - this.playerX) + Math.abs(enemy.y - this.playerY);
                            if (mdist <= 3) {
                                const kdx = enemy.x - this.playerX;
                                const kdy = enemy.y - this.playerY;
                                // Push in dominant direction away from player
                                let kx = 0, ky = 0;
                                if (Math.abs(kdx) >= Math.abs(kdy)) kx = kdx > 0 ? 1 : (kdx < 0 ? -1 : 0);
                                else ky = kdy > 0 ? 1 : (kdy < 0 ? -1 : 0);
                                const nx = enemy.x + kx, ny = enemy.y + ky;
                                if (nx >= 0 && nx < this.WORLD_WIDTH && ny >= 0 && ny < this.WORLD_HEIGHT
                                    && this.world[nx][ny] === this.FLOOR && !this.getEnemyAt(nx, ny)) {
                                    enemy.x = nx; enemy.y = ny;
                                    this.tweens.killTweensOf(enemy.sprite);
                                    this.tweens.add({
                                        targets: enemy.sprite,
                                        x: nx * this.TILE_SIZE + this.TILE_SIZE / 2,
                                        y: ny * this.TILE_SIZE + this.TILE_SIZE / 2 + this.SLIME_Y_OFFSET,
                                        scaleX: this.SLIME_SCALE, scaleY: this.SLIME_SCALE,
                                        duration: 100, ease: 'Power2'
                                    });
                                }
                            }
                        }
                    }

                    if (step === RIPPLE_TILES && !rippleExploded) {
                        rippleExploded = true;
                        this.time.delayedCall(80, () => {
                            if (!this._deathScreenActive) {
                                const end = getTile(RIPPLE_TILES, 0);
                                this._magmaExplosion(end.x, end.y, explosionDmg, LAVA_EXPLODE, LAVA_LONG);
                            }
                        });
                    }
                });
            }
        });
    }

    _magmaExplosion(centerTileX, centerTileY, damage, lavaShort = 2000, lavaLong = 9000) {
        const cpx = centerTileX * this.TILE_SIZE + this.TILE_SIZE / 2;
        const cpy = centerTileY * this.TILE_SIZE + this.TILE_SIZE / 2;

        // Outer ring
        const ring = this.add.circle(cpx, cpy, 8, 0xff4400, 0).setDepth(5);
        ring.setStrokeStyle(4, 0xff8800, 1);
        this.tweens.add({ targets: ring, radius: this.TILE_SIZE * 3.5, alpha: 0, duration: 380, ease: 'Quad.easeOut', onComplete: () => ring.destroy() });

        // Core flash
        const core = this.add.circle(cpx, cpy, this.TILE_SIZE * 2, 0xffffff, 0.85).setDepth(5);
        this.tweens.add({ targets: core, radius: this.TILE_SIZE * 4.5, alpha: 0, duration: 280, ease: 'Quad.easeOut', onComplete: () => core.destroy() });

        // Debris
        for (let i = 0; i < 16; i++) {
            const angle = (i / 16) * Math.PI * 2 + Math.random() * 0.3;
            const spd = 1.5 + Math.random() * 2.5;
            const debris = this.add.rectangle(cpx, cpy, 6, 6, i % 2 === 0 ? 0xff4400 : 0xffcc44, 1).setDepth(4);
            this.tweens.add({ targets: debris, x: cpx + Math.cos(angle) * spd * this.TILE_SIZE, y: cpy + Math.sin(angle) * spd * this.TILE_SIZE, alpha: 0, scaleX: 0.2, scaleY: 0.2, duration: 400 + Math.random() * 200, ease: 'Quad.easeOut', onComplete: () => debris.destroy() });
        }

        this.cameras.main.shake(200, 0.012);

        // Circular explosion — radius 2.5 tiles, tiles animate outward from centre
        const EXP_RADIUS = 2.5;
        const EXP_SCAN   = Math.ceil(EXP_RADIUS);
        const hitEnemies = new Set();

        for (let ox = -EXP_SCAN; ox <= EXP_SCAN; ox++) {
            for (let oy = -EXP_SCAN; oy <= EXP_SCAN; oy++) {
                const dist = Math.sqrt(ox * ox + oy * oy);
                if (dist > EXP_RADIUS) continue;
                const tx = centerTileX + ox, ty = centerTileY + oy;
                if (tx < 0 || tx >= this.WORLD_WIDTH || ty < 0 || ty >= this.WORLD_HEIGHT) continue;
                if (!this.world[tx] || this.world[tx][ty] !== this.FLOOR) continue;

                // Delay proportional to distance so wave expands outward
                const waveDelay = (dist / EXP_RADIUS) * 180;

                this.time.delayedCall(waveDelay, () => {
                    if (this._deathScreenActive) return;
                    const tpx = tx * this.TILE_SIZE + this.TILE_SIZE / 2;
                    const tpy = ty * this.TILE_SIZE + this.TILE_SIZE / 2;
                    this.spawnIgnitionTrail(tpx, tpy, lavaShort);

                    const ef = this.add.graphics().setDepth(2.5);
                    ef.fillStyle(0xff4400, 0.75);
                    ef.fillRect(tx * this.TILE_SIZE, ty * this.TILE_SIZE, this.TILE_SIZE, this.TILE_SIZE);
                    ef.fillStyle(0xffdd44, 0.4);
                    ef.fillRect(tx * this.TILE_SIZE + 3, ty * this.TILE_SIZE + 3, this.TILE_SIZE - 6, this.TILE_SIZE - 6);
                    this.tweens.add({ targets: ef, alpha: 0, duration: 300, onComplete: () => ef.destroy() });

                    // Damage queen spawner on this tile
                    const portalOnTile = this.getPortalAt(tx, ty);
                    if (portalOnTile) this.damagePortal(portalOnTile, damage);
                    this.damageBossAtTile(tx, ty, damage);

                    for (const enemy of [...this.enemies]) {
                        if (enemy.x !== tx || enemy.y !== ty || hitEnemies.has(enemy)) continue;
                        hitEnemies.add(enemy);
                        if (enemy.iceImmune || enemy.fireImmune || enemy.elementImmune) {
                            this.showStatusText(enemy.sprite.x, enemy.sprite.y - 10, 'IMMUNE', '#ff8844');
                            if (enemy.iceImmune && this.isIceTutorial) this._triggerIceImmuneGlerpReaction();
                            continue;
                        }
                        if (this.isTutorial && enemy.tutorialRoomIndex !== undefined &&
                            enemy.tutorialRoomIndex !== this.getCurrentPlayerRoom()) continue;
                        enemy.health -= damage;
                        this.showDamageNumber(enemy.sprite.x, enemy.sprite.y - 10, damage, '#ffffff');
                        this.updateEnemyHealthBar(enemy);
                        if (enemy.health <= 0) this.killEnemy(enemy);
                    }
                });
            }
        }

        // ── Lava rock scatter: 2-4 rocks land on random tiles within 10×10 ─
        const rockCount = 2 + Math.floor(Math.random() * 3);
        const rockDmg = 20 * this.damageScaling;
        for (let r = 0; r < rockCount; r++) {
            let landTileX, landTileY, attempts = 0;
            do {
                landTileX = centerTileX + Math.floor(Math.random() * 11) - 5;
                landTileY = centerTileY + Math.floor(Math.random() * 11) - 5;
                attempts++;
                const distFromCentre = Math.abs(landTileX - centerTileX) + Math.abs(landTileY - centerTileY);
            } while (
                attempts < 30 &&
                (landTileX < 0 || landTileX >= this.WORLD_WIDTH ||
                 landTileY < 0 || landTileY >= this.WORLD_HEIGHT ||
                 this.world[landTileX]?.[landTileY] !== this.FLOOR ||
                 // exclude within 3 Manhattan tiles of explosion — must land outside the pool
                 Math.abs(landTileX - centerTileX) + Math.abs(landTileY - centerTileY) <= 3)
            );
            if (attempts >= 30) continue;

            const landPx = landTileX * this.TILE_SIZE + this.TILE_SIZE / 2;
            const landPy = landTileY * this.TILE_SIZE + this.TILE_SIZE / 2;

            // Stagger each rock's flight slightly
            const flightDelay = r * 120 + Math.random() * 80;
            const flightDur   = 380 + Math.random() * 160;

            // Shadow on ground showing where it will land
            const shadow = this.add.ellipse(landPx, landPy + 6, 18, 8, 0x000000, 0.45).setDepth(0.4);
            this.tweens.add({ targets: shadow, scaleX: 0.3, scaleY: 0.3, alpha: 0, duration: flightDelay + flightDur, onComplete: () => shadow.destroy() });

            // The rock itself — starts above explosion centre, arcs down to land tile
            this.time.delayedCall(flightDelay, () => {
                if (this._deathScreenActive) return;

                const rock = this.add.graphics().setDepth(6);
                rock.fillStyle(0xcc3300, 1);
                rock.fillCircle(0, 0, 7);
                rock.fillStyle(0xff6600, 0.7);
                rock.fillCircle(-2, -2, 4);
                rock.fillStyle(0xffaa44, 0.5);
                rock.fillCircle(-3, -3, 2);
                rock.x = cpx + (Math.random() - 0.5) * 10;
                rock.y = cpy - 8;

                // Arc: tween x to land, y goes up then down via two chained tweens
                const peakY = Math.min(rock.y, landPy) - 40 - Math.random() * 30;

                this.tweens.add({
                    targets: rock,
                    x: landPx, y: peakY,
                    duration: flightDur * 0.45,
                    ease: 'Quad.easeOut',
                    onComplete: () => {
                        this.tweens.add({
                            targets: rock,
                            y: landPy,
                            duration: flightDur * 0.55,
                            ease: 'Quad.easeIn',
                            onComplete: () => {
                                rock.destroy();
                                // Impact flash
                                const impact = this.add.circle(landPx, landPy, 6, 0xff4400, 0.85).setDepth(5);
                                this.tweens.add({ targets: impact, radius: 18, alpha: 0, duration: 220, onComplete: () => impact.destroy() });
                                // Small shake
                                this.cameras.main.shake(60, 0.004);
                                // Lava tile — long duration for rock craters
                                this.spawnIgnitionTrail(landPx, landPy, lavaLong);
                                // Damage queen spawner on landing tile
                                const rockPortal = this.getPortalAt(landTileX, landTileY);
                                if (rockPortal) this.damagePortal(rockPortal, rockDmg);
                                this.damageBossAtTile(landTileX, landTileY, rockDmg);
                                // Damage enemies on landing tile
                                for (const enemy of [...this.enemies]) {
                                    if (enemy.x !== landTileX || enemy.y !== landTileY) continue;
                                    if (enemy.iceImmune || enemy.fireImmune || enemy.elementImmune) continue;
                                    if (this.isTutorial && enemy.tutorialRoomIndex !== undefined &&
                                        enemy.tutorialRoomIndex !== this.getCurrentPlayerRoom()) continue;
                                    enemy.health -= rockDmg;
                                    this.showDamageNumber(enemy.sprite.x, enemy.sprite.y - 10, rockDmg, '#ff8800');
                                    this.updateEnemyHealthBar(enemy);
                                    if (enemy.health <= 0) this.killEnemy(enemy);
                                }
                            }
                        });
                    }
                });

                // Rotation as it flies
                this.tweens.add({ targets: rock, angle: 360 * (Math.random() > 0.5 ? 1 : -1), duration: flightDur, ease: 'Linear' });
            });
        }
    }

    shootFireball(targetX, targetY) {
        const worldX = targetX + this.cameras.main.scrollX;
        const worldY = targetY + this.cameras.main.scrollY;

        const playerPixelX = this.playerX * this.TILE_SIZE + this.TILE_SIZE / 2;
        const playerPixelY = this.playerY * this.TILE_SIZE + this.TILE_SIZE / 2;

        const dx = worldX - playerPixelX;
        const dy = worldY - playerPixelY;
        const distance = Math.sqrt(dx * dx + dy * dy);

        if (distance === 0) return;

        const dirX = dx / distance;
        const dirY = dy / distance;

        // Create container for fireball
        const container = this.add.container(playerPixelX, playerPixelY);

        // Graphics for the entire fireball (core + streaming particles)
        const fireGraphics = this.add.graphics();
        fireGraphics.setDepth(1.5);
        container.add(fireGraphics);
        container.setDepth(2);

        const fireball = container;

        this.fireballs.push({
            sprite: fireball,
            fireGraphics,
            vx: dirX * this.fireballSpeed,
            vy: dirY * this.fireballSpeed,
            damage: this.baseFireballDamage * this.damageScaling,
            piercedEnemies: new Set(),
            dirX, dirY,
            startX: playerPixelX,
            startY: playerPixelY,
            splitCount: 0,
            createdAt: this.time.now,
            lastFlameTime: this.time.now
        });
    }

    shootIceShard(targetX, targetY) {
        const worldX = targetX + this.cameras.main.scrollX;
        const worldY = targetY + this.cameras.main.scrollY;
        const playerPixelX = this.playerX * this.TILE_SIZE + this.TILE_SIZE / 2;
        const playerPixelY = this.playerY * this.TILE_SIZE + this.TILE_SIZE / 2;

        const dx = worldX - playerPixelX;
        const dy = worldY - playerPixelY;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist === 0) return;

        const vx = (dx / dist) * this.iceShardSpeed;
        const vy = (dy / dist) * this.iceShardSpeed;
        const angle = Math.atan2(vy, vx);

        const isBlock = Math.random() < this.iceBlockChance;

        let sprite;
        if (isBlock) {
            // Ice block - crystalline chunky shape using graphics
            const g = this.add.graphics().setDepth(1);
            g.x = playerPixelX;
            g.y = playerPixelY;

            // Draw crystalline ice block
            g.clear();
            g.fillStyle(0x88eeff, 0.9);
            g.beginPath();
            g.moveTo(-10, -10);
            g.lineTo(0, -12);
            g.lineTo(10, -10);
            g.lineTo(12, 0);
            g.lineTo(10, 10);
            g.lineTo(0, 12);
            g.lineTo(-10, 10);
            g.lineTo(-12, 0);
            g.closePath();
            g.fillPath();

            g.lineStyle(2, 0xffffff, 1);
            g.strokePath();

            // Inner crystalline details
            g.lineStyle(1, 0xddffff, 0.6);
            g.beginPath();
            g.moveTo(-4, -4);
            g.lineTo(4, 4);
            g.strokePath();
            g.beginPath();
            g.moveTo(4, -4);
            g.lineTo(-4, 4);
            g.strokePath();

            // Pulsing glow animation
            const glow = this.add.circle(playerPixelX, playerPixelY, 16, 0x00ccff, 0.4);
            glow.setDepth(0.9);
            this.tweens.add({ targets: glow, scaleX: 1.5, scaleY: 1.5, alpha: 0.1, duration: 250, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
            g._glow = glow;

            sprite = g;
        } else {
            // Small ice shard - crystalline pointed shape
            const g = this.add.graphics().setDepth(1);
            g.x = playerPixelX;
            g.y = playerPixelY;
            g.rotation = angle + Math.PI / 2;

            g.clear();
            g.fillStyle(0xccffff, 0.95);
            g.beginPath();
            g.moveTo(0, -8);
            g.lineTo(3, -2);
            g.lineTo(3, 4);
            g.lineTo(0, 8);
            g.lineTo(-3, 4);
            g.lineTo(-3, -2);
            g.closePath();
            g.fillPath();

            g.lineStyle(1, 0xffffff, 0.9);
            g.strokePath();

            // Frost shimmer
            g.lineStyle(0.5, 0xeeffff, 0.5);
            g.beginPath();
            g.moveTo(0, -4);
            g.lineTo(1.5, 0);
            g.lineTo(0, 4);
            g.strokePath();

            sprite = g;
        }

        // Frost trail: tiny particles left behind
        this.iceShards.push({
            sprite,
            vx, vy,
            prevX: sprite.x,
            prevY: sprite.y,
            startX: sprite.x,
            startY: sprite.y,
            isBlock,
            bounces: 0,
            damage: isBlock ? this.iceBlockDamage * this.damageScaling : this.iceShardDamage * this.damageScaling,
            lastTrailTime: 0,
            hitEnemies: new Set()
        });
    }

    spawnIceShardProjectile(x, y, vx, vy, damage, angle) {
        // Create a slim shard graphic for the scatter wave
        const g = this.add.graphics().setDepth(3);
        g.x = x; g.y = y;
        g.setRotation(angle);

        // Slim elongated crystal — brighter and longer than normal shards
        g.fillStyle(0xaaeeff, 0.9);
        g.beginPath();
        g.moveTo(0, -10); g.lineTo(3, -3); g.lineTo(3, 5);
        g.lineTo(0, 10);  g.lineTo(-3, 5); g.lineTo(-3, -3);
        g.closePath(); g.fillPath();
        g.lineStyle(1.5, 0xffffff, 1); g.strokePath();
        // Ice gleam
        g.lineStyle(1, 0xeeffff, 0.7);
        g.beginPath(); g.moveTo(0, -6); g.lineTo(1.5, 0); g.lineTo(0, 6); g.strokePath();

        this.iceShards.push({
            sprite: g,
            vx, vy,
            prevX: x, prevY: y,
            isBlock: false,
            bounces: 0,
            damage,
            lastTrailTime: 0,
            hitEnemies: new Set(),
            isTsunamiScatter: true   // flag — no freeze chance override
        });
    }

    updateIceShards(delta) {
        const ds = delta / 1000;
        const time = this.time.now;

        for (let i = this.iceShards.length - 1; i >= 0; i--) {
            const s = this.iceShards[i];

            // Max range check (12 tiles)
            if (s.startX && s.startY) {
                const distTraveled = Math.sqrt(
                    Math.pow(s.sprite.x - s.startX, 2) +
                    Math.pow(s.sprite.y - s.startY, 2)
                );
                const maxRange = 12 * this.TILE_SIZE;
                if (distTraveled > maxRange) {
                    this.destroyIceShard(s);
                    this.iceShards.splice(i, 1);
                    continue;
                }
            }

            // Store previous position before moving
            const oldX = s.sprite.x;
            const oldY = s.sprite.y;

            // Move
            s.sprite.x += s.vx * ds;
            s.sprite.y += s.vy * ds;
            if (s.sprite._glow) { s.sprite._glow.x = s.sprite.x; s.sprite._glow.y = s.sprite.y; }

            // Frost trail
            if (time - s.lastTrailTime > 60) {
                s.lastTrailTime = time;
                const t = this.add.rectangle(s.sprite.x, s.sprite.y, 4, 4, 0xaaddff, 0.5);
                t.setDepth(0.5);
                this.tweens.add({ targets: t, alpha: 0, scaleX: 0.3, scaleY: 0.3, duration: 300, onComplete: () => t.destroy() });
            }

            const tileX = Math.floor(s.sprite.x / this.TILE_SIZE);
            const tileY = Math.floor(s.sprite.y / this.TILE_SIZE);

            // Check X and Y axes independently by probing one step ahead on each axis
            const nextTileX = Math.floor((s.sprite.x + s.vx * ds) / this.TILE_SIZE);
            const nextTileY = Math.floor((s.sprite.y + s.vy * ds) / this.TILE_SIZE);

            const outX = nextTileX < 0 || nextTileX >= this.WORLD_WIDTH;
            const outY = nextTileY < 0 || nextTileY >= this.WORLD_HEIGHT;

            // Destroy shard if entering locked room
            if (this.isInLockedRoom(tileX, tileY)) {
                this.destroyIceShard(s); this.iceShards.splice(i, 1); continue;
            }

            const hitWallX = outX || (!outY && this.world[nextTileX][tileY] === this.WALL);
            const hitWallY = outY || (!outX && this.world[tileX][nextTileY] === this.WALL);

            if (hitWallX && !hitWallY) {
                if (s.isTsunamiScatter) { this.destroyIceShard(s); this.iceShards.splice(i, 1); continue; }
                s.vx = -s.vx; s.bounces++; this.spawnBounceImpact(s.sprite.x, s.sprite.y);
            } else if (hitWallY && !hitWallX) {
                if (s.isTsunamiScatter) { this.destroyIceShard(s); this.iceShards.splice(i, 1); continue; }
                s.vy = -s.vy; s.bounces++; this.spawnBounceImpact(s.sprite.x, s.sprite.y);
            } else if (hitWallX && hitWallY) {
                if (s.isTsunamiScatter) { this.destroyIceShard(s); this.iceShards.splice(i, 1); continue; }
                s.vx = -s.vx; s.vy = -s.vy; s.bounces += 2; this.spawnBounceImpact(s.sprite.x, s.sprite.y);
            }

            if (s.bounces > this.iceShardMaxBounces) {
                this.destroyIceShard(s);
                this.iceShards.splice(i, 1);
                continue;
            }

            // Rotate shard to match velocity direction
            if (!s.isBlock) {
                s.sprite.setRotation(Math.atan2(s.vy, s.vx) + Math.PI / 2);
            }

            // Enemy hit
            let destroyed = false;
            for (let enemy of this.enemies) {
                if (s.hitEnemies.has(enemy)) continue;
                const ex = enemy.sprite.x, ey = enemy.sprite.y;

                // Check distance from shard's path to enemy
                const distToPath = this.distancePointToSegment(ex, ey, oldX, oldY, s.sprite.x, s.sprite.y);
                const hitRadius = s.isBlock ? 16 : 16;

                if (distToPath < hitRadius) {
                    this.damageEnemyIce(enemy, s.damage);

                    if (s.isBlock) {
                        // Always freeze on block hit
                        this.freezeEnemy(enemy, this.iceBlockFreezeDuration);
                        this.applyBrittle(enemy, 2);
                        this.spawnIceSplinter(ex, ey);
                        this.spawnIceSplinter(ex, ey);
                        this.destroyIceShard(s);
                        this.iceShards.splice(i, 1);
                        destroyed = true;
                        break;
                    } else if (s.isTsunamiScatter) {
                        // Tsunami scatter — pierce through enemies!
                        this.freezeEnemy(enemy, 2000);
                        this.applyBrittle(enemy, 2);
                        this.spawnIceSplinter(ex, ey);
                        s.hitEnemies.add(enemy);

                        // Pierce up to 5 enemies before destroying
                        if (s.hitEnemies.size >= 5) {
                            this.destroyIceShard(s);
                            this.iceShards.splice(i, 1);
                            destroyed = true;
                            break;
                        }
                    } else {
                        // Small shard
                        if (Math.random() < this.iceShardFreezeChance && !enemy.isFrozen) {
                            this.freezeEnemy(enemy, 1500);
                        }
                        s.hitEnemies.add(enemy);
                        if (this.ultDrainActive) {
                            // Pierce: can hit up to 3 enemies
                            if (s.hitEnemies.size >= 3) {
                                this.destroyIceShard(s);
                                this.iceShards.splice(i, 1);
                                destroyed = true;
                                break;
                            }
                        } else {
                            // Normal: consumed on hit
                            this.spawnBounceImpact(s.sprite.x, s.sprite.y);
                            this.destroyIceShard(s);
                            this.iceShards.splice(i, 1);
                            destroyed = true;
                            break;
                        }
                    }
                }
            }
            if (destroyed) continue;
        }
    }

    distancePointToSegment(px, py, x1, y1, x2, y2) {
        // Distance from point (px, py) to line segment from (x1, y1) to (x2, y2)
        const dx = x2 - x1, dy = y2 - y1;
        const len2 = dx * dx + dy * dy;
        if (len2 === 0) return Math.hypot(px - x1, py - y1);
        let t = Math.max(0, Math.min(1, ((px - x1) * dx + (py - y1) * dy) / len2));
        const closestX = x1 + t * dx, closestY = y1 + t * dy;
        return Math.hypot(px - closestX, py - closestY);
    }

    spawnBounceImpact(x, y) {
        const ring = this.add.circle(x, y, 4, 0xaaddff, 0.7);
        ring.setStrokeStyle(1, 0xffffff, 0.9);
        this.tweens.add({ targets: ring, radius: 10, alpha: 0, duration: 180, ease: 'Quad.easeOut', onComplete: () => ring.destroy() });
        // A couple of tiny shards flying off
        for (let i = 0; i < 3; i++) {
            const angle = Math.random() * Math.PI * 2;
            const sp = this.add.rectangle(x, y, 3, 6, 0xccffff, 0.9);
            sp.setDepth(1);
            this.tweens.add({
                targets: sp,
                x: x + Math.cos(angle) * 12, y: y + Math.sin(angle) * 12,
                alpha: 0, duration: 200, ease: 'Quad.easeOut', onComplete: () => sp.destroy()
            });
        }
    }

    destroyIceShard(s) {
        if (s.sprite._glow) { this.tweens.killTweensOf(s.sprite._glow); s.sprite._glow.destroy(); }
        this.tweens.killTweensOf(s.sprite);
        s.sprite.destroy();
    }

    updateFireballs(delta) {
        const deltaSeconds = delta / 1000;

        for (let i = this.fireballs.length - 1; i >= 0; i--) {
            const fireball = this.fireballs[i];

            fireball.sprite.x += fireball.vx * deltaSeconds;
            fireball.sprite.y += fireball.vy * deltaSeconds;

            // Max range check (15 tiles)
            const distTraveled = Math.sqrt(
                Math.pow(fireball.sprite.x - fireball.startX, 2) +
                Math.pow(fireball.sprite.y - fireball.startY, 2)
            );
            const maxRange = 15 * this.TILE_SIZE;
            if (distTraveled > maxRange) {
                fireball.sprite.destroy();
                if (fireball.fireGraphics) fireball.fireGraphics.destroy();
                this.fireballs.splice(i, 1);
                continue;
            }

            // Draw fireball visual
            if (this.time.now - fireball.lastFlameTime > 25) {
                fireball.lastFlameTime = this.time.now;
                const g = fireball.fireGraphics;
                g.clear();
                const angle = Math.atan2(fireball.dirY, fireball.dirX);
                g.setRotation(angle);

                g.fillStyle(0xff8800, 0.10); g.fillCircle(4, 0, 18);
                g.fillStyle(0xffcc44, 0.18); g.fillCircle(5, 0, 14);
                g.fillStyle(0xff5500, 0.55); g.fillCircle(5, 0, 12);
                g.fillStyle(0xcc3300, 0.75); g.fillCircle(4, 0, 9);
                g.fillStyle(0x881100, 0.92); g.fillCircle(3, 0, 6);
                g.fillStyle(0x330000, 1);    g.fillCircle(2, 0, 3.5);
                g.fillStyle(0xffeeaa, 0.95); g.fillCircle(9, 0, 2.8);
                g.fillStyle(0xffffff, 0.85); g.fillCircle(10, 0, 1.5);

                const numP = 20;
                for (let j = 0; j < numP; j++) {
                    const side = j % 2 === 0 ? 1 : -1;
                    const prog = (j >> 1) / (numP / 2);
                    const sweepAngle = prog * Math.PI * 0.9;
                    const orbitR = 9 + prog * 10;
                    const xOffset = Math.cos(sweepAngle) * 9 - prog * 20;
                    const yOffset = side * Math.sin(sweepAngle) * orbitR;
                    const jx = xOffset + (Math.random()-0.5)*2.5;
                    const jy = yOffset + (Math.random()-0.5)*1.5;
                    let pCol, pAlpha, pSize;
                    if (prog < 0.2)       { pCol = 0xffeebb; pAlpha = 0.85; pSize = 2.2; }
                    else if (prog < 0.45) { pCol = 0xff9933; pAlpha = 0.65; pSize = 1.8; }
                    else if (prog < 0.7)  { pCol = 0xff5500; pAlpha = 0.40; pSize = 1.4; }
                    else                  { pCol = 0xcc2200; pAlpha = 0.18; pSize = 0.9; }
                    g.fillStyle(pCol, pAlpha); g.fillCircle(jx, jy, pSize);
                }
                for (let j = 0; j < 12; j++) {
                    const t = j / 12;
                    const tx = -8 - t * 22 + (Math.random()-0.5)*4;
                    const ty = (Math.random()-0.5) * (3 + t * 9);
                    const tCol = t < 0.35 ? 0xff8833 : t < 0.7 ? 0xff4400 : 0xaa1100;
                    g.fillStyle(tCol, (1-t)*0.6); g.fillCircle(tx, ty, 1.1+(1-t)*1.6);
                }
            }

            const tileX = Math.floor(fireball.sprite.x / this.TILE_SIZE);
            const tileY = Math.floor(fireball.sprite.y / this.TILE_SIZE);

            // Wall hit or locked room barrier — destroy fireball
            if (tileX < 0 || tileX >= this.WORLD_WIDTH ||
                tileY < 0 || tileY >= this.WORLD_HEIGHT ||
                this.world[tileX][tileY] === this.WALL ||
                this.isInLockedRoom(tileX, tileY)) {
                this.spawnFireballLavaPool(tileX, tileY);
                fireball.sprite.destroy();
                if (fireball.fireGraphics) fireball.fireGraphics.destroy();
                this.fireballs.splice(i, 1);
                continue;
            }

            // Ult shotgun — pierce enemies, spawn lava on each hit
            if (this.ignitionActive && fireball._isShotgun) {
                for (let enemy of this.enemies) {
                    if (fireball.piercedEnemies && fireball.piercedEnemies.has(enemy)) continue;
                    const ex = enemy.sprite.x, ey = enemy.sprite.y;
                    if (Math.abs(ex - fireball.sprite.x) < 10 && Math.abs(ey - fireball.sprite.y) < 10) {
                        this.damageEnemy(enemy, fireball.damage);
                        this.ignitionExplodeEnemy(enemy);
                        this.spawnFireballLavaPool(tileX, tileY);
                        if (fireball.piercedEnemies) fireball.piercedEnemies.add(enemy);
                    }
                }
                continue; // pierce — never destroy on enemy hit
            }

            // Normal hit — no lava pool
            let hitEnemy = false;
            for (let enemy of this.enemies) {
                const spriteTileX = Math.floor(enemy.sprite.x / this.TILE_SIZE);
                const spriteTileY = Math.floor(enemy.sprite.y / this.TILE_SIZE);
                const onTile = (enemy.x === tileX && enemy.y === tileY)
                            || (spriteTileX === tileX && spriteTileY === tileY);
                if (!onTile) continue;
                if (fireball.piercedEnemies && fireball.piercedEnemies.has(enemy)) continue;
                if (fireball.sprite.y >= tileY * this.TILE_SIZE + this.TILE_SIZE * 0.25) {
                    this.damageEnemy(enemy, fireball.damage);
                    this.fireballSplash(fireball.sprite.x, fireball.sprite.y, fireball.damage, enemy);
                    // No lava pool on normal hit
                    hitEnemy = true;
                    if (fireball.piercedEnemies) fireball.piercedEnemies.add(enemy);
                    break;
                }
            }

            if (hitEnemy) {
                fireball.sprite.destroy();
                if (fireball.fireGraphics) fireball.fireGraphics.destroy();
                this.fireballs.splice(i, 1);
            }
        }
    }

    spawnFireballLavaPool(centerTileX, centerTileY) {
        for (let dx = -1; dx <= 1; dx++) {
            for (let dy = -1; dy <= 1; dy++) {
                const tx = centerTileX + dx, ty = centerTileY + dy;
                if (tx < 0 || tx >= this.WORLD_WIDTH || ty < 0 || ty >= this.WORLD_HEIGHT) continue;
                if (this.world[tx][ty] !== this.FLOOR) continue;
                this.spawnIgnitionTrail(tx * this.TILE_SIZE + this.TILE_SIZE / 2, ty * this.TILE_SIZE + this.TILE_SIZE / 2);
            }
        }
    }

}