// ═══════════════════════════════════════════════════════════════════════
// ENEMYMANAGER.JS — Enemy creation, AI movement, pathfinding, ranged enemies, floor traps, drops
// ═══════════════════════════════════════════════════════════════════════
// All methods receive GameScene as `this` via .call(scene, ...) from GameScene.js
// Do NOT add local state here — all state lives on the scene object.

class EnemyManager {

    createEnemy(x, y) {
        const sprite = this.add.sprite(
            x * this.TILE_SIZE + this.TILE_SIZE / 2,
            y * this.TILE_SIZE + this.TILE_SIZE / 2 + this.SLIME_Y_OFFSET,
            'slime_red',
            0
        );
        sprite.setScale(this.SLIME_SCALE);
        sprite.setDepth(1);
        sprite.play('red_idle');

        const healthBarBg = this.add.rectangle(
            sprite.x,
            sprite.y,
            24,
            4,
            0x000000
        );

        const healthBarFill = this.add.rectangle(
            sprite.x,
            sprite.y,
            24,
            4,
            0xff0000
        );

        const baseHealth = arguments[2] ?? 150;
        const enemy = {
            x: x,
            y: y,
            sprite: sprite,
            health: baseHealth,
            maxHealth: baseHealth,
            healthBarBg: healthBarBg,
            healthBarFill: healthBarFill,
            isFrozen: false,
            frozenUntil: 0,
            frozenByTsunami: false,
            isSlowed: false,
            slowedUntil: 0,
            lastMoveTime: 0,
            isStunned: false,
            stunnedUntil: 0,

            // ICE: brittle stacks
            brittleStacks: 0,
            lastBrittleHitTime: 0,

            // FIRE: simple burn
            isBurning: false,
            burnUntil: 0,
            lastBurnTick: 0,
            burnVisual: null,

            // LIGHTNING: superconductor
            isSuperConducted: false,
            superConductUntil: 0,
            superConductVisual: null,

            // FIRE: combustion
            combustionTriggered: false,

            // COSMIC MARKS
            cosmicMarks: 0,
            cosmicMarkVisuals: null
        };

        this.enemies.push(enemy);
        return enemy;
    }

    updateVoidSniperBolts(delta) {
        if (!this._voidSniperBolts?.length) return;
        const ds = delta / 1000;
        for (let i = this._voidSniperBolts.length - 1; i >= 0; i--) {
            const b = this._voidSniperBolts[i];
            if (!b.gfx?.active) { this._voidSniperBolts.splice(i, 1); continue; }
            b.gfx.x += b.vx * ds; b.gfx.y += b.vy * ds;
            if (this.time.now - b.createdAt > 3000) { b.gfx.destroy(); this._voidSniperBolts.splice(i, 1); continue; }
            const tx = Math.floor(b.gfx.x / this.TILE_SIZE), ty = Math.floor(b.gfx.y / this.TILE_SIZE);
            if (!this.world[tx] || this.world[tx][ty] === this.WALL) { b.gfx.destroy(); this._voidSniperBolts.splice(i, 1); continue; }
            const dx = this.player.x - b.gfx.x, dy = this.player.y - b.gfx.y;
            if (Math.sqrt(dx*dx + dy*dy) < this.TILE_SIZE * 0.8) {
                this.takeDamage(b.damage || 20);
                b.gfx.destroy(); this._voidSniperBolts.splice(i, 1);
            }
        }
    }

    updateEnemyHealthBar(enemy) {
        if (!enemy.healthBarFill || !enemy.healthBarBg) return;

        const healthPercent = enemy.health / enemy.maxHealth;
        const maxWidth = 24;
        const currentWidth = maxWidth * healthPercent;

        enemy.healthBarFill.width = currentWidth;

        enemy.healthBarBg.x = enemy.sprite.x;
        enemy.healthBarBg.y = enemy.sprite.y;

        enemy.healthBarFill.x = enemy.sprite.x;
        enemy.healthBarFill.y = enemy.sprite.y;

        // Keep burn stack pips pinned to enemy
        if (enemy._burnStackBar?.length) {
            const stacks = enemy._burnStackBar.length;
            const GAP = 6, W = 6;
            const totalW = stacks * W + (stacks - 1) * GAP;
            for (let i = 0; i < stacks; i++) {
                const pip = enemy._burnStackBar[i];
                if (!pip?.active) continue;
                pip.x = enemy.sprite.x - totalW / 2 + i * (W + GAP) + W / 2;
                pip.y = enemy.sprite.y - 36;
            }
        }
    }

    getEnemyAt(x, y) {
        for (let enemy of this.enemies) {
            if (enemy.x === x && enemy.y === y) return enemy;
        }
        return null;
    }

    isNodeAt(x, y) {
        return this.lightningNodes.some(n => n.tileX === x && n.tileY === y);
    }

    findPathBFS(startX, startY, targetX, targetY) {
        const path = this._bfsRun(startX, startY, targetX, targetY, true);
        // Fall back to ignoring enemies if they're blocking the only route
        return path || this._bfsRun(startX, startY, targetX, targetY, false);
    }

    _bfsRun(startX, startY, targetX, targetY, avoidEnemies) {
        if (startX === targetX && startY === targetY) return null;

        const queue = [];
        const visited = new Set();
        const parent = new Map();

        const startKey = `${startX},${startY}`;
        queue.push({ x: startX, y: startY });
        visited.add(startKey);
        parent.set(startKey, null);

        while (queue.length > 0) {
            const current = queue.shift();

            if (current.x === targetX && current.y === targetY) {
                return this.reconstructPath(parent, startX, startY, targetX, targetY);
            }

            const neighbors = [
                { x: current.x, y: current.y - 1 },
                { x: current.x, y: current.y + 1 },
                { x: current.x - 1, y: current.y },
                { x: current.x + 1, y: current.y }
            ];

            for (let neighbor of neighbors) {
                const nx = neighbor.x;
                const ny = neighbor.y;
                const nKey = `${nx},${ny}`;

                if (visited.has(nKey)) continue;
                if (nx < 0 || nx >= this.WORLD_WIDTH || ny < 0 || ny >= this.WORLD_HEIGHT) continue;
                if (this.world[nx][ny] !== this.FLOOR) continue;
                if (this.isNodeAt(nx, ny)) continue;

                // On first pass treat enemies as obstacles; player tile always passable
                const isPlayerTile = nx === targetX && ny === targetY;
                if (avoidEnemies && !isPlayerTile && this.getEnemyAt(nx, ny)) continue;

                visited.add(nKey);
                parent.set(nKey, current);
                queue.push({ x: nx, y: ny });
            }
        }

        return null;
    }

    reconstructPath(parent, startX, startY, targetX, targetY) {
        const path = [];
        let current = { x: targetX, y: targetY };

        while (current) {
            path.unshift(current);
            const key = `${current.x},${current.y}`;
            current = parent.get(key);
        }

        return path;
    }

    moveEnemies() {
        const currentTime = this.time.now;

        // Apply / expire singularity slime slow on player
        if (this._singularitySlowed) {
            if (currentTime >= (this._singularitySlowUntil || 0)) {
                this._singularitySlowed = false;
                this.moveCooldown = 200; // restore normal speed
                if (this._playerSlowIndTimer) { this._playerSlowIndTimer.remove(); this._playerSlowIndTimer = null; }
            } else {
                this.moveCooldown = 380; // ~0.53× speed while slowed
                if (!this._playerSlowIndTimer) {
                    this._playerSlowIndTimer = this._startSpeedIndicator(
                        () => this.player?.active ? { x: this.player.x, y: this.player.y } : null,
                        'slow_goop', 300
                    );
                }
            }
        }

        for (let enemy of this.enemies) {
            // ── Lightning elemental: periodic arc attack ─────────────────────
            if (enemy.lightningImmune && !enemy.isFrozen && !enemy.isStunned) {
                // Keep range ring centered on enemy
                if (enemy._arcRangeRing?.active) {
                    enemy._arcRangeRing.x = enemy.sprite.x;
                    enemy._arcRangeRing.y = enemy.sprite.y;
                }
                if (currentTime - (enemy._lastArcTime || 0) >= (enemy._arcCooldown || 2500)) {
                    enemy._lastArcTime = currentTime;
                    const dx = this.playerX - enemy.x, dy = this.playerY - enemy.y;
                    const dist = Math.abs(dx) + Math.abs(dy);
                    if (dist <= 5 && this.player?.active) {
                        // Arc toward player
                        this.drawLightningBolt({ sprite: enemy.sprite }, { sprite: this.player });
                        this.takeDamage(8 * this.damageScaling);
                        enemy.sprite.setTint(0xffffaa);
                        this.time.delayedCall(120, () => { if (enemy.sprite?.active) enemy.sprite.setTint(0xffffaa); });
                        // Flash range ring on fire
                        if (enemy._arcRangeRing?.active) {
                            this.tweens.killTweensOf(enemy._arcRangeRing);
                            enemy._arcRangeRing.setAlpha(1.0);
                            this.tweens.add({
                                targets: enemy._arcRangeRing, alpha: 0.35, duration: 400, ease: 'Quad.easeOut',
                                onComplete: () => {
                                    if (enemy._arcRangeRing?.active)
                                        this.tweens.add({ targets: enemy._arcRangeRing, alpha: 0.15, duration: 900, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
                                }
                            });
                        }
                    }
                }
            }

            // ── Berserker: charge-up ! then 2×3 swing arc ───────────────────
            if (enemy.isBerserker && !enemy.isFrozen && !enemy.isStunned) {
                if (enemy._berserkerMark?.active) {
                    enemy._berserkerMark.x = enemy.sprite.x;
                    enemy._berserkerMark.y = enemy.sprite.y - 26;
                }
                const bdx = this.playerX - enemy.x, bdy = this.playerY - enemy.y;
                const bdist = Math.abs(bdx) + Math.abs(bdy);
                const bstate = enemy._berserkerState || 'idle';

                if (bstate === 'idle' || bstate === 'cooldown') {
                    if (bdist <= 3 && currentTime - (enemy._berserkerLastSwing || 0) >= (enemy._berserkerCooldown || 3200)) {
                        enemy._berserkerState = 'charging';
                        enemy._berserkerChargeStart = currentTime;
                        this.tweens.add({ targets: enemy._berserkerMark, alpha: 1, duration: 80 });
                        this.tweens.add({ targets: enemy._berserkerMark, scaleX: 1.3, scaleY: 1.3, duration: 150, yoyo: true, repeat: 4, ease: 'Sine.easeInOut' });
                        enemy.sprite.setTint(0xff0000);
                    }
                } else if (bstate === 'charging') {
                    if (currentTime - enemy._berserkerChargeStart >= (enemy._berserkerChargeDur || 600)) {
                        enemy._berserkerState = 'cooldown';
                        enemy._berserkerLastSwing = currentTime;
                        this.tweens.killTweensOf(enemy._berserkerMark);
                        this.tweens.add({ targets: enemy._berserkerMark, alpha: 0, duration: 100 });
                        enemy.sprite.setTint(0xff4444);
                        this._berserkerSwing(enemy);
                    }
                }
            }

            // ── Singularity slime: 3×3 cosmic slam ──────────────────────────
            if (enemy.isSingularitySlime && !enemy.isFrozen && !enemy.isStunned) {
                if (enemy._singMark?.active) {
                    enemy._singMark.x = enemy.sprite.x;
                    enemy._singMark.y = enemy.sprite.y - 26;
                }
                const sdx = Math.abs(this.playerX - enemy.x);
                const sdy = Math.abs(this.playerY - enemy.y);
                const inRange = sdx <= 2 && sdy <= 2; // player within 5×5 (2 tiles each side)
                const sstate = enemy._singState || 'idle';

                if (sstate === 'idle' || sstate === 'cooldown') {
                    if (inRange && currentTime - (enemy._singLastAtk || 0) >= (enemy._singCooldown || 2800)) {
                        enemy._singState = 'charging';
                        enemy._singChargeStart = currentTime;
                        // Show purple ! mark with pulse
                        this.tweens.add({ targets: enemy._singMark, alpha: 1, duration: 80 });
                        this.tweens.add({ targets: enemy._singMark, scaleX: 1.3, scaleY: 1.3, duration: 180, yoyo: true, repeat: 3, ease: 'Sine.easeInOut' });
                        enemy.sprite.setTint(0x9922cc);
                        // Show 3×3 warning tiles
                        if (!enemy._singWarningTiles) enemy._singWarningTiles = [];
                        for (let wx = -2; wx <= 2; wx++) {
                            for (let wy = -2; wy <= 2; wy++) {
                                const wpx = (enemy.x + wx) * this.TILE_SIZE;
                                const wpy = (enemy.y + wy) * this.TILE_SIZE;
                                const wg = this.add.rectangle(wpx + this.TILE_SIZE / 2, wpy + this.TILE_SIZE / 2,
                                    this.TILE_SIZE - 2, this.TILE_SIZE - 2, 0x6600cc, 0.22).setDepth(1.2);
                                this.tweens.add({ targets: wg, alpha: 0.45, duration: 200, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
                                enemy._singWarningTiles.push(wg);
                            }
                        }
                    }
                } else if (sstate === 'charging') {
                    if (currentTime - enemy._singChargeStart >= (enemy._singChargeDur || 700)) {
                        enemy._singState = 'cooldown';
                        enemy._singLastAtk = currentTime;
                        this.tweens.killTweensOf(enemy._singMark);
                        this.tweens.add({ targets: enemy._singMark, alpha: 0, duration: 120 });
                        enemy.sprite.setTint(0x440088);

                        // Destroy warning tiles
                        if (enemy._singWarningTiles) {
                            for (const wg of enemy._singWarningTiles) { this.tweens.killTweensOf(wg); wg.destroy(); }
                            enemy._singWarningTiles = [];
                        }

                        // Slam — tint the 5×5 tiles with cosmic liquid (purple + yellow hints), like water/ice tiles
                        for (let wx = -2; wx <= 2; wx++) {
                            for (let wy = -2; wy <= 2; wy++) {
                                const tx = enemy.x + wx, ty = enemy.y + wy;
                                const spx = tx * this.TILE_SIZE + this.TILE_SIZE / 2;
                                const spy = ty * this.TILE_SIZE + this.TILE_SIZE / 2;

                                // Base purple cosmic tint — covers the full tile cleanly
                                const base = this.add.rectangle(spx, spy, this.TILE_SIZE, this.TILE_SIZE, 0x6600bb, 0.55).setDepth(1.3);
                                // Yellow cosmic shimmer — faint golden streaks like cosmic energy
                                const shimmer = this.add.rectangle(spx, spy, this.TILE_SIZE, this.TILE_SIZE, 0xddaa00, 0.15).setDepth(1.4);
                                // Small highlight dot — gives it the wet tile feel
                                const dot = this.add.rectangle(spx - 3, spy - 3, 3, 3, 0xffdd88, 0.45).setDepth(1.5);

                                // Pulse once then fade out — longer linger than before
                                this.tweens.add({ targets: base,    alpha: 0, duration: 1400, delay: 400, ease: 'Quad.easeIn', onComplete: () => base.destroy() });
                                this.tweens.add({ targets: shimmer, alpha: 0, duration: 1000, delay: 600, ease: 'Sine.easeIn', onComplete: () => shimmer.destroy() });
                                this.tweens.add({ targets: dot,     alpha: 0, duration: 700,  delay: 300, ease: 'Linear',      onComplete: () => dot.destroy() });

                                // Damage + slow if player is on this tile
                                if (this.playerX === tx && this.playerY === ty) {
                                    this.takeDamage(4 * this.damageScaling);
                                    this.player?.setTint(0xcc88ff);
                                    this.time.delayedCall(300, () => { if (this.player?.active) this.player.clearTint(); });
                                    this._singularitySlowed = true;
                                    this._singularitySlowUntil = currentTime + 2000;
                                }
                            }
                        }
                        // Screen shake
                        this.cameras.main.shake(25, 0.004);
                    }
                }
            }

            // ── Void sniper: pocket dimension + shotgun burst ────────────────
            if (enemy.isVoidSniper) {
                // Room gating — force back into dimension when out of room
                if ((this.isTutorial || this.isLevel2 || this.isLevel3 || this.isLevel4)) {
                    if ((enemy.tutorialRoomIndex ?? -1) !== this.getCurrentPlayerRoom()) {
                        if (!enemy._inDimension) {
                            enemy._inDimension = true;
                            enemy._sniperInvisible = true;
                            enemy._sniperExiting = false;
                            enemy._sniperVulnerable = false;
                            if (enemy.sprite?.active) { enemy.sprite.setAlpha(0); enemy.sprite.setScale(enemy._baseScale ?? this.SLIME_SCALE); }
                            if (enemy.healthBarBg?.active)   enemy.healthBarBg.setAlpha(0);
                            if (enemy.healthBarFill?.active) enemy.healthBarFill.setAlpha(0);
                            if (enemy._voidMark?.active)     enemy._voidMark.setAlpha(0);
                        }
                        enemy._nextDimensionExit = currentTime;
                        continue;
                    }
                }

                // ── IN DIMENSION: waiting to reappear ──────────────────────
                if (enemy._inDimension) {
                    if (currentTime < (enemy._nextDimensionExit || 0)) continue;
                    if (enemy._sniperExiting) continue;
                    enemy._sniperExiting = true;

                    // Pick a flanking tile 1-3 tiles from player
                    const flanks = [];
                    for (let ddx = -3; ddx <= 3; ddx++) {
                        for (let ddy = -3; ddy <= 3; ddy++) {
                            const md = Math.abs(ddx) + Math.abs(ddy);
                            if (md < 1 || md > 3) continue;
                            const tx2 = this.playerX + ddx, ty2 = this.playerY + ddy;
                            if (tx2 < 0 || tx2 >= this.WORLD_WIDTH || ty2 < 0 || ty2 >= this.WORLD_HEIGHT) continue;
                            if (this.world[tx2][ty2] !== this.FLOOR) continue;
                            if (this.getEnemyAt && this.getEnemyAt(tx2, ty2)) continue;
                            if (this.isInLockedRoom(tx2, ty2)) continue;
                            if (!this.isInCurrentRoom(tx2, ty2)) continue; // must stay inside player's room
                            flanks.push({ x: tx2, y: ty2 });
                        }
                    }
                    // Fallback: random floor tile 2-5 tiles away
                    if (flanks.length === 0) {
                        for (let attempt = 0; attempt < 25; attempt++) {
                            const ang = Math.random() * Math.PI * 2;
                            const rd = 2 + Math.floor(Math.random() * 4);
                            const tx3 = this.playerX + Math.round(Math.cos(ang) * rd);
                            const ty3 = this.playerY + Math.round(Math.sin(ang) * rd);
                            if (tx3 >= 0 && tx3 < this.WORLD_WIDTH && ty3 >= 0 && ty3 < this.WORLD_HEIGHT
                                && this.world[tx3][ty3] === this.FLOOR
                                && !this.isInLockedRoom(tx3, ty3)
                                && this.isInCurrentRoom(tx3, ty3)) {
                                flanks.push({ x: tx3, y: ty3 }); break;
                            }
                        }
                    }
                    if (flanks.length === 0) {
                        enemy._sniperExiting = false;
                        enemy._nextDimensionExit = currentTime + 2000;
                        continue;
                    }

                    const pick = flanks[Math.floor(Math.random() * flanks.length)];
                    const wx = pick.x * this.TILE_SIZE + this.TILE_SIZE / 2;
                    const wy = pick.y * this.TILE_SIZE + this.TILE_SIZE / 2 + (this.SLIME_Y_OFFSET || -10);

                    // Teleport sprite to target tile (still hidden)
                    enemy.x = pick.x; enemy.y = pick.y;
                    enemy.sprite.x = wx; enemy.sprite.y = wy;
                    if (enemy.healthBarBg?.active)   { enemy.healthBarBg.x   = wx; enemy.healthBarBg.y   = wy - 14; }
                    if (enemy.healthBarFill?.active) { enemy.healthBarFill.x = wx - 12; enemy.healthBarFill.y = wy - 14; }
                    if (enemy._voidMark?.active)     { enemy._voidMark.x = wx; enemy._voidMark.y = wy - 22; }

                    // Open portal at new position
                    if (typeof this._spawnSniperPortal === 'function') this._spawnSniperPortal(enemy, wx, wy);

                    // 1500ms — portal opens, player has time to react before sniper pops out
                    this.time.delayedCall(1500, () => {
                        if (!enemy.sprite?.active) return;
                        enemy._inDimension = false;
                        enemy._sniperInvisible = false;
                        enemy._sniperVulnerable = true;

                        enemy.sprite.setScale(0.1);
                        this.tweens.add({ targets: enemy.sprite, scaleX: enemy._baseScale ?? this.SLIME_SCALE, scaleY: enemy._baseScale ?? this.SLIME_SCALE, alpha: 0.92, duration: 220, ease: 'Back.easeOut' });
                        if (enemy._voidMark?.active) this.tweens.add({ targets: enemy._voidMark, alpha: 0.85, duration: 220 });
                        if (enemy.healthBarBg?.active)   this.tweens.add({ targets: enemy.healthBarBg,   alpha: 0.8,  duration: 220 });
                        if (enemy.healthBarFill?.active) this.tweens.add({ targets: enemy.healthBarFill, alpha: 1.0,  duration: 220 });
                        if (enemy._burnStackBar) { for (const p of enemy._burnStackBar) p.setAlpha(1); }
                        if (typeof this._updateBurnStackIndicator === 'function') this._updateBurnStackIndicator(enemy);
                        if (typeof this._updateChillIndicator === 'function') this._updateChillIndicator(enemy);

                        if (typeof this._closeSniperPortal === 'function') this._closeSniperPortal(enemy);

                        // 350ms — fire shotgun
                        this.time.delayedCall(350, () => {
                            if (!enemy.sprite?.active || enemy._inDimension) return;
                            this._fireSniperShotgun(enemy);

                            // 2.5s vulnerable, then retreat
                            this.time.delayedCall(2500, () => {
                                if (!enemy.sprite?.active) return;
                                enemy._sniperVulnerable = false;

                                const ex2 = enemy.sprite.x, ey2 = enemy.sprite.y;
                                if (typeof this._spawnSniperPortal === 'function') this._spawnSniperPortal(enemy, ex2, ey2);

                                this.tweens.add({
                                    targets: enemy.sprite, scaleX: 0, scaleY: 0, alpha: 0,
                                    duration: 300, ease: 'Quad.easeIn',
                                    onComplete: () => {
                                        if (!enemy.sprite?.active) return;
                                        if (typeof this._closeSniperPortal === 'function') this._closeSniperPortal(enemy);
                                        enemy._inDimension = true;
                                        enemy._sniperInvisible = true;
                                        enemy._sniperExiting = false;
                                        enemy.chillStacks = 0;
                                        if (enemy._chillBar)     { for (const d2 of enemy._chillBar)     d2.setAlpha(0); }
                                        if (enemy._burnStackBar) { for (const p  of enemy._burnStackBar) p.setAlpha(0);  }
                                        if (enemy.healthBarBg?.active)   enemy.healthBarBg.setAlpha(0);
                                        if (enemy.healthBarFill?.active) enemy.healthBarFill.setAlpha(0);
                                        if (enemy._voidMark?.active)     enemy._voidMark.setAlpha(0);
                                        if (typeof this._spawnSniperPortal === 'function') this._spawnSniperPortal(enemy, enemy.sprite.x, enemy.sprite.y);
                                        enemy._nextDimensionExit = this.time.now + 5000 + Math.random() * 2000;
                                    }
                                });
                                if (enemy.healthBarBg?.active)   this.tweens.add({ targets: enemy.healthBarBg,   alpha: 0, duration: 200 });
                                if (enemy.healthBarFill?.active) this.tweens.add({ targets: enemy.healthBarFill, alpha: 0, duration: 200 });
                                if (enemy._voidMark?.active)     this.tweens.add({ targets: enemy._voidMark,     alpha: 0, duration: 200 });
                            });
                        });
                    });
                    continue;
                }

                // ── VISIBLE: pause retreat timer while frozen/stunned ───────
                if (enemy.isFrozen || enemy.isStunned) {
                    enemy._nextDimensionExit = (enemy._nextDimensionExit || currentTime) + 16;
                }
                continue;
            }
            if (enemy.isStunned && currentTime < enemy.stunnedUntil) {
                continue;
            } else if (enemy.isStunned && currentTime >= enemy.stunnedUntil) {
                enemy.isStunned = false;
            }
            // Surge knockback — suppress pathfinding until arc fully settles
            if (enemy._surgeKnockedBack) continue;

            if (enemy.isFrozen) {
                if (currentTime >= enemy.frozenUntil) {
                    enemy.isFrozen = false;
                    if (enemy._thawTimer) { enemy._thawTimer.remove(); enemy._thawTimer = null; }
                    if (enemy.sprite?.active) {
                        if (typeof enemy.sprite.clearTint === 'function') enemy.sprite.clearTint();
                        this.tweens.killTweensOf(enemy.sprite);
                        if (typeof enemy.sprite.setScale === 'function') enemy.sprite.setScale(enemy._baseScale ?? this.SLIME_SCALE);
                    }
                    if (enemy.freezeVisuals) {
                        if (enemy.freezeVisuals._extraLayers) {
                            for (const l of enemy.freezeVisuals._extraLayers) { this.tweens.killTweensOf(l); l.destroy(); }
                        }
                        if (enemy.freezeVisuals.iceBlock)  { this.tweens.killTweensOf(enemy.freezeVisuals.iceBlock);  enemy.freezeVisuals.iceBlock.setVisible(false);  enemy.freezeVisuals.iceBlock.destroy(); }
                        if (enemy.freezeVisuals.iceBorder) { this.tweens.killTweensOf(enemy.freezeVisuals.iceBorder); enemy.freezeVisuals.iceBorder.setVisible(false); enemy.freezeVisuals.iceBorder.destroy(); }
                        enemy.freezeVisuals = null;
                    }
                    this.createTsunamiPuddle(enemy.x, enemy.y);
                } else {
                    if (enemy.freezeVisuals && enemy.sprite?.active) {
                        const blockY = enemy.sprite.y + 10;
                        if (enemy.freezeVisuals.iceBlock)  { enemy.freezeVisuals.iceBlock.x  = enemy.sprite.x; enemy.freezeVisuals.iceBlock.y  = blockY; }
                        if (enemy.freezeVisuals.iceBorder) { enemy.freezeVisuals.iceBorder.x = enemy.sprite.x; enemy.freezeVisuals.iceBorder.y = blockY; }
                        if (enemy.freezeVisuals._extraLayers) {
                            for (const l of enemy.freezeVisuals._extraLayers) { l.x = enemy.sprite.x; l.y = blockY; }
                        }
                    }
                    continue;
                }
            }

            if (enemy.isSlowed && currentTime >= enemy.slowedUntil) {
                enemy.isSlowed = false;
                if (enemy._slowIndTimer) { enemy._slowIndTimer.remove(); enemy._slowIndTimer = null; }
            }
            // Wet enemies move at half speed (isWet set by _shatterWaterSplash)
            if (enemy.isWet && currentTime >= enemy.wetUntil) {
                enemy.isWet = false;
            }

            const isActuallySlowed = enemy.isSlowed || enemy.isWet;
            let moveCooldown = isActuallySlowed ? this.enemyMoveCooldown * 2 : this.enemyMoveCooldown;
            if (enemy.isElectrical) moveCooldown = Math.round(moveCooldown * 0.33); // 3× faster
            if (enemy.isSingularitySlime) moveCooldown = this.enemyMoveCooldown * 2; // goopy — 2× slower
            if (enemy._anchorSpeedMult && enemy._anchorSpeedMult > 1) moveCooldown = Math.round(moveCooldown / enemy._anchorSpeedMult);
            // Splitter: smaller tiers move faster (tier 0=normal, tier 1=1.4×, tier 2=1.9×)
            if (enemy.isSplitter) {
                const splitterSpeedMult = [1.0, 1.4, 1.9][enemy._splitterTier ?? 0];
                moveCooldown = Math.round(moveCooldown / splitterSpeedMult);
            }

            if (currentTime - enemy.lastMoveTime < moveCooldown) {
                continue;
            }

            // Ranged enemies are handled entirely by updateRangedEnemies — skip here
            if (enemy.isRanged) continue;

            // ── Level 4: Mortar — stationary, lobs rocks over walls ─────────
            if (enemy.isMortar) {
                if (enemy._mortarGfx?.active)    { enemy._mortarGfx.x = enemy.sprite.x; enemy._mortarGfx.y = enemy.sprite.y; }
                if (enemy._mortarSafeRing?.active){ enemy._mortarSafeRing.x = enemy.sprite.x; enemy._mortarSafeRing.y = enemy.sprite.y; }
                if (!enemy.isFrozen && !enemy.isStunned) {
                    if ((this.isLevel4)) {
                        if ((enemy.tutorialRoomIndex ?? -1) !== this.getCurrentPlayerRoom()) continue;
                    }
                    const mdx = this.playerX - enemy.x, mdy = this.playerY - enemy.y;
                    const mdist = Math.abs(mdx) + Math.abs(mdy);
                    if (mdist > enemy._mortarSafeRadius && currentTime - enemy._mortarLastFire >= enemy._mortarCooldown) {
                        enemy._mortarLastFire = currentTime;
                        this._fireMortarShot(enemy);
                    }
                }
                continue;
            }

            // ── Level 4: Healer Totem — stationary, heals nearby enemies ────
            if (enemy.isHealerTotem) {
                if (enemy._healerAura?.active) { enemy._healerAura.x = enemy.sprite.x; enemy._healerAura.y = enemy.sprite.y; }
                if (enemy._totemGfx?.active)   { enemy._totemGfx.x  = enemy.sprite.x; enemy._totemGfx.y  = enemy.sprite.y; }
                if (enemy._orbGlow?.active)    { enemy._orbGlow.x   = enemy.sprite.x; enemy._orbGlow.y   = enemy.sprite.y - 17; }
                if (!enemy.isFrozen && currentTime - enemy._healerLastTick >= enemy._healerTickInterval) {
                    enemy._healerLastTick = currentTime;
                    if ((this.isLevel4) && (enemy.tutorialRoomIndex ?? -1) !== this.getCurrentPlayerRoom()) { continue; }
                    for (const ally of this.enemies) {
                        if (!ally.sprite?.active || ally === enemy) continue;
                        const adx = Math.abs(ally.x - enemy.x), ady = Math.abs(ally.y - enemy.y);
                        if (adx + ady > enemy._healerRange) continue;
                        ally.health += enemy._healerHealPerTick;
                        // Max overheal cap at 3× base HP
                        if (ally.health > ally.maxHealth * 3) ally.health = ally.maxHealth * 3;
                        this.updateEnemyHealthBar(ally);
                        // Green aura flash on healed enemy + plus sign above head
                        if (!ally._lastHealPuff4 || currentTime - ally._lastHealPuff4 > 500) {
                            ally._lastHealPuff4 = currentTime;
                            // Aura ring flash around enemy
                            const auraFlash = this.add.graphics().setDepth(3.0);
                            auraFlash.lineStyle(2, 0x44ff88, 0.85);
                            auraFlash.strokeCircle(ally.sprite.x, ally.sprite.y, 12);
                            auraFlash.fillStyle(0x44ff88, 0.18);
                            auraFlash.fillCircle(ally.sprite.x, ally.sprite.y, 12);
                            this.tweens.add({ targets: auraFlash, scaleX: 1.5, scaleY: 1.5, alpha: 0, duration: 400, ease: 'Quad.easeOut', onComplete: () => auraFlash.destroy() });
                            // Small green plus sign rising above head
                            const plus = this.add.graphics().setDepth(3.5);
                            plus.fillStyle(0x44ff88, 0.95);
                            plus.fillRect(-2, -5, 4, 10);
                            plus.fillRect(-5, -2, 10, 4);
                            plus.x = ally.sprite.x; plus.y = ally.sprite.y - 14;
                            this.tweens.add({ targets: plus, y: plus.y - 10, alpha: 0, duration: 450, ease: 'Quad.easeOut', onComplete: () => plus.destroy() });
                        }
                    }
                }
                continue;
            }

            // ── Level 4: Anchor Slime — stationary, buffs enemies + slows player
            if (enemy.isAnchor) {
                if (enemy._anchorRing?.active)     { enemy._anchorRing.x = enemy.sprite.x; enemy._anchorRing.y = enemy.sprite.y; }
                if (enemy._anchorBodyGfx?.active)  { enemy._anchorBodyGfx.x = enemy.sprite.x; enemy._anchorBodyGfx.y = enemy.sprite.y; }
                if (!enemy.isFrozen && currentTime - enemy._anchorLastPulse >= enemy._anchorPulseInterval) {
                    enemy._anchorLastPulse = currentTime;
                    if ((this.isLevel4) && (enemy.tutorialRoomIndex ?? -1) !== this.getCurrentPlayerRoom()) { continue; }
                    // Speed buff nearby enemies
                    for (const ally of this.enemies) {
                        if (!ally.sprite?.active || ally === enemy || ally.isMortar || ally.isHealerTotem || ally.isAnchor) continue;
                        const adx = Math.abs(ally.x - enemy.x), ady = Math.abs(ally.y - enemy.y);
                        if (adx + ady <= enemy._anchorRange) {
                            ally._anchorBuffUntil = currentTime + enemy._anchorPulseInterval * 1.5;
                            ally._anchorSpeedMult = enemy._anchorSpeedBuff;
                            if (ally.sprite?.active && typeof ally.sprite.setTint === 'function') ally.sprite.setTint(0xaaffaa);
                            if (!ally._speedIndTimer) {
                                ally._speedIndTimer = this._startSpeedIndicator(
                                    () => ally.sprite?.active ? { x: ally.sprite.x, y: ally.sprite.y } : null,
                                    'speed_anchor', 300
                                );
                            }
                        }
                    }
                    // Pulse ring — steel blue expanding wave
                    const pulse = this.add.graphics().setDepth(1.2);
                    pulse.lineStyle(2, 0x4499cc, 0.80); pulse.strokeCircle(0, 0, enemy._anchorRange * this.TILE_SIZE);
                    pulse.x = enemy.sprite.x; pulse.y = enemy.sprite.y;
                    this.tweens.add({ targets: pulse, scaleX: 1.18, scaleY: 1.18, alpha: 0, duration: 700, ease: 'Quad.easeOut', onComplete: () => pulse.destroy() });
                    // Slow player if in range
                    const pdx = Math.abs(this.playerX - enemy.x), pdy = Math.abs(this.playerY - enemy.y);
                    if (pdx + pdy <= enemy._anchorRange) {
                        this.moveCooldown = Math.max(this.moveCooldown, Math.round(200 / enemy._anchorSlowMult));
                        this._anchorSlowUntil = currentTime + enemy._anchorPulseInterval * 1.5;
                        this.showStatusText(this.player.x, this.player.y - 24, 'SLOWED', '#4499cc');
                        if (!this._playerSlowIndTimer) {
                            this._playerSlowIndTimer = this._startSpeedIndicator(
                                () => this.player?.active ? { x: this.player.x, y: this.player.y } : null,
                                'slow_anchor', 300
                            );
                        }
                    }
                }
                continue;
            }

            // ── Level 4: Rooter — pull tendril (far) / ground thump (close) ──
            if (enemy.isRooter && !enemy.isFrozen && !enemy.isStunned) {
                if (enemy._rooterMark?.active) { enemy._rooterMark.x = enemy.sprite.x; enemy._rooterMark.y = enemy.sprite.y - 22; }
                if ((this.isLevel4) && (enemy.tutorialRoomIndex ?? -1) !== this.getCurrentPlayerRoom()) { /* dormant */ }
                else {
                    const rdx = Math.abs(this.playerX - enemy.x), rdy = Math.abs(this.playerY - enemy.y);
                    const rdist = rdx + rdy;
                    if (rdist <= (enemy._thumpRange || 3)) {
                        // CLOSE — ground thump every 2s
                        if (currentTime - (enemy._thumpLastFire || 0) >= (enemy._thumpCooldown || 2000)) {
                            enemy._thumpLastFire = currentTime;
                            this._rooterGroundThump(enemy);
                        }
                    } else if (rdist <= (enemy._tendrilRange || 12)) {
                        // FAR — pull tendril
                        if (currentTime - (enemy._tendrilLastFire || 0) >= (enemy._tendrilCooldown || 4000)) {
                            enemy._tendrilLastFire = currentTime;
                            this._fireRootTendril(enemy);
                        }
                    }
                }
            }



            const dist = Math.abs(enemy.x - this.playerX) + Math.abs(enemy.y - this.playerY);

            // Room gating for tutorial, level 2, level 3, and level 4
            if (this.isTutorial || this.isLevel2 || this.isLevel3 || this.isLevel4) {
                const enemyRoom = enemy.tutorialRoomIndex ?? -1;
                if (enemyRoom !== this.getCurrentPlayerRoom()) continue;
            }

            if (dist < 20) {
                let nextStep = null;

                // --- COMMITTED PATH LOGIC ---
                // Peek at the next step WITHOUT advancing the index yet.
                // Only advance once we know the tile is actually passable.
                // This avoids the rollback problem entirely.
                const pathStillValid =
                    enemy._committedPath &&
                    enemy._pathStepsLeft > 0 &&
                    enemy._pathIndex !== undefined &&
                    enemy._pathIndex + 1 < enemy._committedPath.length;

                if (pathStillValid) {
                    const candidate = enemy._committedPath[enemy._pathIndex + 1];
                    const isPlayerTile = candidate.x === this.playerX && candidate.y === this.playerY;
                    const wallBlocked = !isPlayerTile &&
                        (this.world[candidate.x]?.[candidate.y] !== this.FLOOR ||
                         this.isNodeAt(candidate.x, candidate.y));

                    if (wallBlocked) {
                        // Hard obstacle — replan immediately
                        enemy._committedPath = null;
                        enemy._pathIndex = undefined;
                        enemy._pathStepsLeft = 0;
                    } else if (!isPlayerTile && this.getEnemyAt(candidate.x, candidate.y)) {
                        // Tile occupied by another enemy — hold position this tick,
                        // keep path intact so we retry the same step next tick
                        enemy.lastMoveTime = currentTime;
                        continue;
                    } else {
                        // Tile is clear — commit the advance now
                        nextStep = candidate;
                        enemy._pathIndex++;
                        enemy._pathStepsLeft--;
                        if (enemy._pathStepsLeft <= 0) {
                            enemy._committedPath = null;
                            enemy._pathIndex = undefined;
                        }
                    }
                }

                if (!nextStep) {
                    // Commit only 2 steps — prevents shadow-chasing while still resisting trivial jukes
                    const path = this.findPathBFS(enemy.x, enemy.y, this.playerX, this.playerY);
                    if (path && path.length > 1) {
                        const commitSteps = Math.min(2, path.length - 1);
                        enemy._committedPath = path;
                        enemy._pathStepsLeft = commitSteps - 1; // consuming step 1 right now
                        enemy._pathIndex = 1;                   // step 1 is being taken this tick
                        nextStep = path[1];
                        if (enemy._pathStepsLeft <= 0) {
                            enemy._committedPath = null;
                            enemy._pathIndex = undefined;
                        }
                    }
                }

                // No valid step — skip this enemy for now
                if (!nextStep) continue;

                // Player collision — attack instead of moving
                if (nextStep.x === this.playerX && nextStep.y === this.playerY) {
                    if (currentTime - this.lastPlayerDamageTime >= this.playerDamageCooldown) {
                        this.enemyAttackAnimation(enemy, this.playerX, this.playerY);
                        this.takeDamage(1);
                        this.lastPlayerDamageTime = currentTime;
                    }
                    enemy.lastMoveTime = currentTime;
                    enemy._committedPath = null;
                    enemy._pathIndex = undefined;
                    continue;
                }

                // Final occupied check for the fresh-BFS case (pathStillValid already handles its own)
                if (this.getEnemyAt(nextStep.x, nextStep.y)) {
                    enemy.lastMoveTime = currentTime;
                    continue;
                }

                // Move the enemy
                const prevX = enemy.x, prevY = enemy.y;
                enemy.x = nextStep.x;
                enemy.y = nextStep.y;
                enemy.lastMoveTime = currentTime;

                // Singularity slimes drip goop on every tile they leave
                if (enemy.isSingularitySlime) {
                    const gpx = prevX * this.TILE_SIZE + this.TILE_SIZE / 2;
                    const gpy = prevY * this.TILE_SIZE + this.TILE_SIZE / 2;
                    const goop = this.add.graphics().setDepth(1.2);
                    goop.fillStyle(0x6600cc, 0.50);
                    goop.fillEllipse(gpx, gpy, this.TILE_SIZE * 0.8, this.TILE_SIZE * 0.55);
                    goop.fillStyle(0xaa44ff, 0.30);
                    goop.fillEllipse(gpx - 2, gpy - 2, this.TILE_SIZE * 0.4, this.TILE_SIZE * 0.28);
                    this.tweens.add({ targets: goop, alpha: 0, duration: 3500, delay: 1000, ease: 'Quad.easeIn', onComplete: () => goop.destroy() });
                    // Slow player if standing on this tile
                    if (this.playerX === prevX && this.playerY === prevY) {
                        this._singularitySlowed = true;
                        this._singularitySlowUntil = Math.max(this._singularitySlowUntil || 0, currentTime + 1500);
                    }
                }

                const targetX = enemy.x * this.TILE_SIZE + this.TILE_SIZE / 2;
                const targetY = enemy.y * this.TILE_SIZE + this.TILE_SIZE / 2 + this.SLIME_Y_OFFSET;

                // Don't start a move tween if the enemy is frozen or mid-shatter
                if (enemy.isFrozen || enemy._shatterTriggered) {
                    enemy.sprite.x = targetX;
                    enemy.sprite.y = targetY;
                } else {
                    // 160ms matches the sniper tween — snappy but not instant
                    const tweenDur = isActuallySlowed ? 280 : 160;
                    this.tweens.add({
                        targets: enemy.sprite,
                        x: targetX,
                        y: targetY,
                        duration: tweenDur,
                        ease: 'Linear',
                        onUpdate: () => {
                            // Sync health bars and marks
                            if (enemy.healthBarBg) {
                                enemy.healthBarBg.x = enemy.sprite.x;
                                enemy.healthBarBg.y = enemy.sprite.y;
                            }
                            if (enemy.healthBarFill) {
                                enemy.healthBarFill.x = enemy.sprite.x;
                                enemy.healthBarFill.y = enemy.sprite.y;
                            }
                            if (enemy.burnVisual) {
                                enemy.burnVisual.x = enemy.sprite.x;
                                enemy.burnVisual.y = enemy.sprite.y - 18;
                            }
                            if (enemy.brittleVisual) {
                                enemy.brittleVisual.x = enemy.sprite.x;
                                enemy.brittleVisual.y = enemy.sprite.y + 14;
                            }
                            if (enemy._tsunamiMultText) {
                                enemy._tsunamiMultText.x = enemy.sprite.x;
                                enemy._tsunamiMultText.y = enemy.sprite.y - 28;
                            }
                            if (enemy._shieldMark && enemy._shieldMark.active) {
                                enemy._shieldMark.x = enemy.sprite.x;
                                enemy._shieldMark.y = enemy.sprite.y - 22;
                            }
                            if (enemy._inhibitRing && enemy._inhibitRing.active) {
                                enemy._inhibitRing.x = enemy.sprite.x;
                                enemy._inhibitRing.y = enemy.sprite.y;
                            }
                            if (enemy._inhibitMark && enemy._inhibitMark.active) {
                                enemy._inhibitMark.x = enemy.sprite.x;
                                enemy._inhibitMark.y = enemy.sprite.y - 22;
                            }
                            if (enemy._fireMark && enemy._fireMark.active) {
                                enemy._fireMark.x = enemy.sprite.x;
                                enemy._fireMark.y = enemy.sprite.y - 22;
                            }
                            if (enemy._iceMark && enemy._iceMark.active) {
                                enemy._iceMark.x = enemy.sprite.x;
                                enemy._iceMark.y = enemy.sprite.y - 22;
                            }
                            if (enemy._rangedMark && enemy._rangedMark.active) {
                                enemy._rangedMark.x = enemy.sprite.x;
                                enemy._rangedMark.y = enemy.sprite.y - 22;
                            }
                            if (enemy.cosmicMarkVisuals && enemy.cosmicMarkVisuals.length > 0) {
                                const markY = enemy.sprite.y - 25;
                                for (let i = 0; i < enemy.cosmicMarks; i++) {
                                    const offsetX = (i - 1) * 12;
                                    const visualIndex = i * 2;
                                    if (visualIndex < enemy.cosmicMarkVisuals.length) {
                                        enemy.cosmicMarkVisuals[visualIndex].x = enemy.sprite.x + offsetX;
                                        enemy.cosmicMarkVisuals[visualIndex].y = markY;
                                        if (visualIndex + 1 < enemy.cosmicMarkVisuals.length) {
                                            enemy.cosmicMarkVisuals[visualIndex + 1].x = enemy.sprite.x + offsetX;
                                            enemy.cosmicMarkVisuals[visualIndex + 1].y = markY;
                                        }
                                    }
                                }
                            }
                        }
                    });
                }
            } // end if (dist < 20)
        } // end for enemies

        // SAFEGUARD: Teleport any enemies that ended up in walls back to nearest floor
        for (let enemy of this.enemies) {
            if (this.world[enemy.x][enemy.y] !== this.FLOOR) {

                // Find nearest floor tile
                let foundFloor = false;
                for (let radius = 1; radius <= 5 && !foundFloor; radius++) {
                    for (let dx = -radius; dx <= radius && !foundFloor; dx++) {
                        for (let dy = -radius; dy <= radius && !foundFloor; dy++) {
                            const checkX = enemy.x + dx;
                            const checkY = enemy.y + dy;

                            if (checkX >= 0 && checkX < this.WORLD_WIDTH &&
                                checkY >= 0 && checkY < this.WORLD_HEIGHT &&
                                this.world[checkX][checkY] === this.FLOOR) {

                                // Teleport enemy to this floor tile
                                enemy.x = checkX;
                                enemy.y = checkY;
                                enemy.sprite.x = checkX * this.TILE_SIZE + this.TILE_SIZE / 2;
                                enemy.sprite.y = checkY * this.TILE_SIZE + this.TILE_SIZE / 2 + this.SLIME_Y_OFFSET;

                                // Update health bars
                                this.updateEnemyHealthBar(enemy);

                                // Update mark visuals
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

                                foundFloor = true;
                            }
                        }
                    }
                }
            }
        }
    }

    enemyAttackAnimation(enemy, targetX, targetY) {
        if (!enemy.sprite || !enemy.sprite.active) return;
        if (enemy._attackAnimPlaying) return; // prevent stacking animations

        // Snapshot home position at the moment of attack — not recalculated mid-tween
        const homeX = enemy.sprite.x;
        const homeY = enemy.sprite.y;
        const dirX = targetX - enemy.x;
        const dirY = targetY - enemy.y;
        const len = Math.sqrt(dirX * dirX + dirY * dirY) || 1;
        const lungeX = homeX + (dirX / len) * this.TILE_SIZE * 0.42;
        const lungeY = homeY + (dirY / len) * this.TILE_SIZE * 0.42;

        enemy._attackAnimPlaying = true;

        // 1. Wind-up squish (compress toward direction)
        this.tweens.add({
            targets: enemy.sprite,
            scaleX: this.SLIME_SCALE * 0.75, scaleY: this.SLIME_SCALE * 1.3,
            duration: 60, ease: 'Quad.easeOut',
            onComplete: () => {
                if (!enemy.sprite?.active) { enemy._attackAnimPlaying = false; return; }
                // 2. Lunge forward
                this.tweens.add({
                    targets: enemy.sprite,
                    x: lungeX, y: lungeY,
                    scaleX: this.SLIME_SCALE * 1.2, scaleY: this.SLIME_SCALE * 0.8,
                    duration: 80, ease: 'Quad.easeOut',
                    onComplete: () => {
                        if (!enemy.sprite?.active) { enemy._attackAnimPlaying = false; return; }
                        // 3. Snap back to home with overshoot
                        this.tweens.add({
                            targets: enemy.sprite,
                            x: homeX, y: homeY,
                            scaleX: this.SLIME_SCALE * 0.9, scaleY: this.SLIME_SCALE * 1.1,
                            duration: 90, ease: 'Back.easeOut',
                            onComplete: () => {
                                if (!enemy.sprite?.active) { enemy._attackAnimPlaying = false; return; }
                                // 4. Settle to normal scale
                                this.tweens.add({
                                    targets: enemy.sprite,
                                    scaleX: enemy._baseScale ?? this.SLIME_SCALE, scaleY: enemy._baseScale ?? this.SLIME_SCALE,
                                    duration: 60, ease: 'Quad.easeOut',
                                    onComplete: () => { enemy._attackAnimPlaying = false; }
                                });
                            }
                        });
                    }
                });
            }
        });
    }

    // ─── RANGED ENEMY CREATION ────────────────────────────────────────────────
    // Moved here from TutorialManager — this is generic enemy infrastructure
    // used by both the tutorial and Level 2, so it lives in EnemyManager.

    createRangedEnemy(x, y, tutorialRoomIndex) {
        const enemy = this.createEnemy(x, y, 30);
        enemy.tutorialRoomIndex = tutorialRoomIndex;
        enemy.isRanged = true;
        enemy.rangedState = 'idle';

        // Yellow crosshair mark to distinguish from melee
        const mark = this.add.graphics().setDepth(2);
        mark.lineStyle(2, 0xffee00, 0.9);
        mark.strokeCircle(0, 0, 7);
        mark.beginPath(); mark.moveTo(-10, 0); mark.lineTo(10, 0); mark.strokePath();
        mark.beginPath(); mark.moveTo(0, -10); mark.lineTo(0, 10); mark.strokePath();
        mark.x = enemy.sprite.x; mark.y = enemy.sprite.y - 22;
        this.tweens.add({ targets: mark, scaleX: 1.2, scaleY: 1.2, duration: 500, yoyo: true, repeat: -1 });
        enemy._rangedMark = mark;

        return enemy;
    }

    createBerserker(x, y, tutorialRoomIndex) {
        const enemy = this.createEnemy(x, y, 180);
        enemy.tutorialRoomIndex = tutorialRoomIndex;
        enemy.isBerserker        = true;
        enemy._berserkerState    = 'idle';
        enemy._berserkerLastSwing  = 0;
        enemy._berserkerCooldown   = 3200;
        enemy._berserkerChargeDur  = 600;
        enemy._berserkerChargeStart = 0;
        enemy.sprite.setTint(0xff4444);

        // Red ! mark — hidden until charging
        const markGfx = this.add.graphics().setDepth(3.5).setAlpha(0);
        markGfx.fillStyle(0xff2200, 1.0);
        markGfx.fillRect(-3, -12, 6, 9);
        markGfx.fillRect(-3,  -1, 6, 6);
        markGfx.lineStyle(1, 0xff8888, 0.80);
        markGfx.strokeRect(-3, -12, 6, 9);
        markGfx.strokeRect(-3,  -1, 6, 6);
        markGfx.x = enemy.sprite.x;
        markGfx.y = enemy.sprite.y - 26;
        enemy._berserkerMark = markGfx;
        return enemy;
    }

    _berserkerSwing(enemy) {
        const ex = enemy.sprite.x, ey = enemy.sprite.y;
        const facingAngle = Math.atan2(this.player.y - ey, this.player.x - ex);
        const halfSpread  = Math.PI * (60 / 180); // ±60° = 120° arc
        const RANGE       = 2.2 * this.TILE_SIZE;
        const SWING_DMG   = 18 * this.damageScaling;
        const SWING_DUR   = 220;

        // Arc sweep visual — red
        const arcGfx = this.add.graphics().setDepth(3.5);
        arcGfx.x = ex; arcGfx.y = ey;
        const startAngle = facingAngle + halfSpread;
        const endAngle   = facingAngle - halfSpread;
        let elapsed = 0;
        const swingTimer = this.time.addEvent({
            delay: 16, repeat: Math.floor(SWING_DUR / 16),
            callback: () => {
                elapsed += 16;
                const t = Math.min(elapsed / SWING_DUR, 1);
                const curEnd = startAngle + (endAngle - startAngle) * t;
                arcGfx.clear();
                arcGfx.fillStyle(0xff2200, 0.18); arcGfx.slice(0, 0, RANGE + 8, startAngle, curEnd, true); arcGfx.fillPath();
                arcGfx.fillStyle(0xff5500, 0.55); arcGfx.slice(0, 0, RANGE,       startAngle, curEnd, true); arcGfx.fillPath();
                arcGfx.fillStyle(0xff9900, 0.75); arcGfx.slice(0, 0, RANGE * 0.4, startAngle, curEnd, true); arcGfx.fillPath();
                arcGfx.lineStyle(2, 0xffcc88, 0.50 * (1 - t));
                arcGfx.beginPath(); arcGfx.moveTo(0, 0);
                arcGfx.lineTo(Math.cos(curEnd) * RANGE, Math.sin(curEnd) * RANGE); arcGfx.strokePath();
                if (t >= 1) { this.time.delayedCall(80, () => arcGfx.destroy()); swingTimer.remove(); }
            }
        });

        // Hit check — sample tiles in arc
        const hitTiles = new Set();
        for (let r = 0.8; r <= 2.2; r += 0.5) {
            for (let a = -halfSpread; a <= halfSpread; a += Math.PI / 8) {
                const wx = ex + Math.cos(facingAngle + a) * r * this.TILE_SIZE;
                const wy = ey + Math.sin(facingAngle + a) * r * this.TILE_SIZE;
                hitTiles.add(`${Math.round(wx / this.TILE_SIZE)},${Math.round(wy / this.TILE_SIZE)}`);
            }
        }
        const playerKey = `${Math.round(this.player.x / this.TILE_SIZE)},${Math.round(this.player.y / this.TILE_SIZE)}`;
        if (hitTiles.has(playerKey)) {
            this.takeDamage(SWING_DMG);
            this.cameras.main.shake(60, 0.006);
            // Knockback 1 tile away
            const kbDX = Math.sign(this.playerX - enemy.x);
            const kbDY = Math.sign(this.playerY - enemy.y);
            const nx = this.playerX + kbDX, ny = this.playerY + kbDY;
            if (this.world[nx]?.[ny] === this.FLOOR) {
                this.playerX = nx; this.playerY = ny;
                this.player.x = nx * this.TILE_SIZE + this.TILE_SIZE / 2;
                this.player.y = ny * this.TILE_SIZE + this.TILE_SIZE / 2 + this.SLIME_Y_OFFSET;
            }
        }
        this.cameras.main.shake(35, 0.003);
    }

    // ─── RANGED ENEMY SYSTEM ──────────────────────────────────────────────────

    // Bresenham tile LOS — returns true if no WALL between two tile coords
    _hasLineOfSight(x0, y0, x1, y1) {
        let dx = Math.abs(x1 - x0), dy = Math.abs(y1 - y0);
        let x = x0, y = y0;
        const sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1;
        let err = dx - dy;
        while (true) {
            if (x === x1 && y === y1) return true;
            if (this.world[x]?.[y] === this.WALL) return false;
            const e2 = 2 * err;
            if (e2 > -dy) { err -= dy; x += sx; }
            if (e2 <  dx) { err += dx; y += sy; }
        }
    }

    // Find the furthest floor tile in [minRange, attackMax] from player with LOS, reachable from sniper
    _findSniperRepositionTile(enemy, minRange, attackMax) {
        const px = this.playerX, py = this.playerY;
        let best = null, bestDist = -1;
        for (let tx = px - attackMax; tx <= px + attackMax; tx++) {
            for (let ty = py - attackMax; ty <= py + attackMax; ty++) {
                if (tx < 0 || tx >= this.WORLD_WIDTH || ty < 0 || ty >= this.WORLD_HEIGHT) continue;
                if (this.world[tx][ty] !== this.FLOOR) continue;
                const d = Math.abs(tx - px) + Math.abs(ty - py);
                if (d < minRange || d > attackMax) continue;
                if (!this._hasLineOfSight(tx, ty, px, py)) continue;
                if (d > bestDist) {
                    const path = this.findPathBFS(enemy.x, enemy.y, tx, ty);
                    if (path && path.length > 0) { bestDist = d; best = { x: tx, y: ty }; }
                }
            }
        }
        return best;
    }

    _moveSniperStep(enemy, path, time) {
        // path[0] is the sniper's current tile — the next step is path[1]
        if (!path || path.length < 2) return;
        if (time - (enemy.lastMoveTime || 0) < (enemy.moveDelay || 1000)) return;
        const next = path[1];
        if (this.world[next.x]?.[next.y] !== this.FLOOR) return;
        if (this.getEnemyAt(next.x, next.y)) return;
        enemy.x = next.x; enemy.y = next.y;
        enemy.lastMoveTime = time;
        const wx = next.x * this.TILE_SIZE + this.TILE_SIZE / 2;
        const wy = next.y * this.TILE_SIZE + this.TILE_SIZE / 2 + this.SLIME_Y_OFFSET;
        this.tweens.add({
            targets: enemy.sprite, x: wx, y: wy, duration: 160, ease: 'Linear',
            onUpdate: () => {
                if (enemy.healthBarBg)  { enemy.healthBarBg.x  = enemy.sprite.x; enemy.healthBarBg.y  = enemy.sprite.y; }
                if (enemy.healthBarFill){ enemy.healthBarFill.x = enemy.sprite.x; enemy.healthBarFill.y = enemy.sprite.y; }
                if (enemy._rangedMark?.active) { enemy._rangedMark.x = enemy.sprite.x; enemy._rangedMark.y = enemy.sprite.y - 22; }
            }
        });
    }

    updateRangedEnemies(time) {
        for (const enemy of this.enemies) {
            if (!enemy.isRanged || !enemy.sprite || !enemy.sprite.active) continue;
            if (enemy.isFrozen || enemy.isStunned) continue;

            // Room gating
            if (this.isTutorial || this.isLevel2 || this.isLevel3 || this.isLevel4) {
                if ((enemy.tutorialRoomIndex ?? -1) !== this.getCurrentPlayerRoom()) continue;
            }

            // Track splitter mark position
            if (enemy._splitterMark?.active) { enemy._splitterMark.x = enemy.sprite.x; enemy._splitterMark.y = enemy.sprite.y - 26; }

            // Expire anchor speed buff
            if (enemy._anchorBuffUntil && enemy._anchorBuffUntil < currentTime) {
                enemy._anchorBuffUntil = 0; enemy._anchorSpeedMult = 1;
                if (enemy.sprite?.active && !enemy.isFrozen && typeof enemy.sprite.clearTint === 'function') enemy.sprite.clearTint();
                if (enemy._speedIndTimer) { enemy._speedIndTimer.remove(); enemy._speedIndTimer = null; }
            }

            const AGGRO_RANGE = 12, ATTACK_MAX = 10, MIN_RANGE = 4;
            const dist = Math.abs(enemy.x - this.playerX) + Math.abs(enemy.y - this.playerY);

            if (!enemy.rangedState) enemy.rangedState = 'idle';

            // Electrical ranged enemies are 3× faster
            const prefireDur = enemy.isElectrical ? 4000 / 3 : 4000;
            const cooldownDur = enemy.isElectrical ? 3000 / 3 : 3000;
            const shotGap = enemy.isElectrical ? 220 / 3 : 220;

            // ── MOVEMENT during idle/cooldown only ────────────────────────
            const canMove = enemy.rangedState === 'idle' || enemy.rangedState === 'cooldown';
            if (canMove && dist <= AGGRO_RANGE) {
                const hasLOS = this._hasLineOfSight(enemy.x, enemy.y, this.playerX, this.playerY);
                const needsRepo = dist < MIN_RANGE || dist > ATTACK_MAX || !hasLOS;
                if (needsRepo) {
                    if (!enemy._sniperTarget ||
                        (enemy._sniperTarget.x === enemy.x && enemy._sniperTarget.y === enemy.y)) {
                        enemy._sniperTarget = this._findSniperRepositionTile(enemy, MIN_RANGE, ATTACK_MAX);
                    }
                    if (enemy._sniperTarget) {
                        const path = this.findPathBFS(enemy.x, enemy.y, enemy._sniperTarget.x, enemy._sniperTarget.y);
                        if (path && path.length > 0) this._moveSniperStep(enemy, path, time);
                        else enemy._sniperTarget = null;
                    }
                }
            }

            // ── STATE MACHINE ─────────────────────────────────────────────
            if (enemy.rangedState === 'idle') {
                const hasLOS = this._hasLineOfSight(enemy.x, enemy.y, this.playerX, this.playerY);
                if (dist >= MIN_RANGE && dist <= ATTACK_MAX && hasLOS) {
                    enemy.rangedState = 'prefire';
                    enemy.prefireStart = time;
                    enemy.prefireEnd   = time + prefireDur;
                    this._spawnPrefireBeam(enemy);
                }

            } else if (enemy.rangedState === 'prefire') {
                const hasLOS = this._hasLineOfSight(enemy.x, enemy.y, this.playerX, this.playerY);
                if (!hasLOS) {
                    // Only break off prefire if LOS is fully lost — walking closer doesn't cancel it
                    enemy.rangedState = 'cooldown';
                    enemy.cooldownEnd = time + cooldownDur / 2;
                    enemy.lockedDir   = null;
                    this._destroyPrefireBeam(enemy);
                } else {
                    const timeLeft = enemy.prefireEnd - time;
                    if (timeLeft <= Math.min(1000, prefireDur * 0.25) && !enemy.lockedDir) {
                        const ex = enemy.sprite.x, ey = enemy.sprite.y;
                        const ppx = this.playerX * this.TILE_SIZE + this.TILE_SIZE / 2;
                        const ppy = this.playerY * this.TILE_SIZE + this.TILE_SIZE / 2;
                        const dx = ppx - ex, dy = ppy - ey;
                        const len = Math.sqrt(dx*dx + dy*dy) || 1;
                        enemy.lockedDir = { x: dx/len, y: dy/len };
                        this._drawLockedBeam(enemy);
                    } else if (enemy.lockedDir) {
                        this._drawLockedBeam(enemy);
                    } else {
                        this._updatePrefireBeam(enemy);
                    }
                    if (time >= enemy.prefireEnd) {
                        enemy.rangedState = 'firing';
                        enemy.shotsLeft   = 3;
                        enemy.nextShotAt  = time;
                        this._destroyPrefireBeam(enemy);
                    }
                }

            } else if (enemy.rangedState === 'firing') {
                // Once firing has started it always completes — player can't dodge by rushing in
                if (enemy.shotsLeft > 0 && time >= enemy.nextShotAt) {
                    this._fireEnemyProjectile(enemy);
                    enemy.shotsLeft--;
                    enemy.nextShotAt = time + shotGap;
                }
                if (enemy.shotsLeft <= 0 && time >= enemy.nextShotAt) {
                    enemy.rangedState = 'cooldown';
                    enemy.cooldownEnd = time + cooldownDur;
                }

            } else if (enemy.rangedState === 'cooldown') {
                if (time >= enemy.cooldownEnd) {
                    enemy.rangedState   = 'idle';
                    enemy.lockedDir     = null;
                    enemy._sniperTarget = null;
                }
            }
        }
    }

    _spawnPrefireBeam(enemy) {
        this._destroyPrefireBeam(enemy); // safety clear
        enemy._prefireBeam = this.add.graphics().setDepth(1.5);
        // Pulsing exclamation above head
        enemy._prefireWarning = this.add.text(
            enemy.sprite.x, enemy.sprite.y - 36, '!',
            { fontSize: '18px', fontFamily: 'monospace', color: '#ff4400',
              stroke: '#000', strokeThickness: 3, fontStyle: 'bold' }
        ).setOrigin(0.5).setDepth(5);
        this.tweens.add({ targets: enemy._prefireWarning, scaleX: 1.3, scaleY: 1.3,
            duration: 250, yoyo: true, repeat: -1 });
    }

    _drawLockedBeam(enemy) {
        if (!enemy._prefireBeam || !enemy._prefireBeam.active) return;
        const ex = enemy.sprite.x, ey = enemy.sprite.y;
        const { x: ndx, y: ndy } = enemy.lockedDir;
        const beamLen = 14 * this.TILE_SIZE;
        enemy._prefireBeam.clear();
        // Solid bright red — locked on
        enemy._prefireBeam.lineStyle(2, 0xff0000, 0.9);
        enemy._prefireBeam.beginPath();
        enemy._prefireBeam.moveTo(ex, ey);
        enemy._prefireBeam.lineTo(ex + ndx * beamLen, ey + ndy * beamLen);
        enemy._prefireBeam.strokePath();
        enemy._prefireBeam.fillStyle(0xff0000, 1);
        enemy._prefireBeam.fillCircle(ex, ey, 5);
        // Keep warning synced
        if (enemy._prefireWarning && enemy._prefireWarning.active) {
            enemy._prefireWarning.x = enemy.sprite.x;
            enemy._prefireWarning.y = enemy.sprite.y - 36;
            enemy._prefireWarning.setColor('#ff0000');
        }
    }

    _updatePrefireBeam(enemy) {
        if (!enemy._prefireBeam || !enemy._prefireBeam.active) return;

        // Keep warning above enemy
        if (enemy._prefireWarning && enemy._prefireWarning.active) {
            enemy._prefireWarning.x = enemy.sprite.x;
            enemy._prefireWarning.y = enemy.sprite.y - 36;
        }

        const ex = enemy.sprite.x, ey = enemy.sprite.y;
        const px = this.playerX * this.TILE_SIZE + this.TILE_SIZE / 2;
        const py = this.playerY * this.TILE_SIZE + this.TILE_SIZE / 2;
        const dx = px - ex, dy = py - ey;
        const len = Math.sqrt(dx * dx + dy * dy) || 1;
        const ndx = dx / len, ndy = dy / len;

        const beamLen = 14 * this.TILE_SIZE;
        enemy._prefireBeam.clear();
        // Dashed danger line
        const DASH = 10, GAP = 6;
        let drawn = 0;
        while (drawn < beamLen) {
            const segEnd = Math.min(drawn + DASH, beamLen);
            const t0 = drawn / beamLen, t1 = segEnd / beamLen;
            enemy._prefireBeam.lineStyle(2, 0xff4400, 0.55);
            enemy._prefireBeam.beginPath();
            enemy._prefireBeam.moveTo(ex + ndx * drawn, ey + ndy * drawn);
            enemy._prefireBeam.lineTo(ex + ndx * segEnd, ey + ndy * segEnd);
            enemy._prefireBeam.strokePath();
            drawn += DASH + GAP;
        }
        // Red dot at enemy origin
        enemy._prefireBeam.fillStyle(0xff4400, 0.8);
        enemy._prefireBeam.fillCircle(ex, ey, 4);
    }

    _destroyPrefireBeam(enemy) {
        if (enemy._prefireBeam && enemy._prefireBeam.active) {
            this.tweens.killTweensOf(enemy._prefireBeam);
            enemy._prefireBeam.destroy();
            enemy._prefireBeam = null;
        }
        if (enemy._prefireWarning && enemy._prefireWarning.active) {
            this.tweens.killTweensOf(enemy._prefireWarning);
            enemy._prefireWarning.destroy();
            enemy._prefireWarning = null;
        }
    }

    _fireEnemyProjectile(enemy) {
        // Level 4 upgraded sniper — 3 arrows in a spread, each ricochets 3 times
        if (enemy._upgradedSniper) {
            const SPREAD_ANGLES = [-0.20, 0, 0.20];
            for (const spreadA of SPREAD_ANGLES) {
                this._fireRicochetArrow(enemy, spreadA);
            }
            return;
        }
        const ex = enemy.sprite.x, ey = enemy.sprite.y;

        // Use locked direction if available, otherwise fall back to current player pos
        let ndx, ndy;
        if (enemy.lockedDir) {
            ndx = enemy.lockedDir.x;
            ndy = enemy.lockedDir.y;
        } else {
            const px = this.playerX * this.TILE_SIZE + this.TILE_SIZE / 2;
            const py = this.playerY * this.TILE_SIZE + this.TILE_SIZE / 2;
            const dx = px - ex, dy = py - ey;
            const len = Math.sqrt(dx * dx + dy * dy) || 1;
            ndx = dx / len; ndy = dy / len;
        }

        // Tiny random spread — max ±3° per shot so the burst feels tight but not robotic
        const spread = (Math.random() - 0.5) * (Math.PI / 60); // ±3°
        const cos = Math.cos(spread), sin = Math.sin(spread);
        const fdx = ndx * cos - ndy * sin;
        const fdy = ndx * sin + ndy * cos;

        // Small elongated bullet (not a circle — fast bullets look better as dashes)
        const angle = Math.atan2(fdy, fdx);
        const g = this.add.graphics().setDepth(2.5);
        g.fillStyle(0xff2200, 1);
        // Draw a short line in the direction of travel
        g.lineStyle(3, 0xff6600, 1);
        g.beginPath();
        g.moveTo(-Math.cos(angle) * 6, -Math.sin(angle) * 6);
        g.lineTo( Math.cos(angle) * 6,  Math.sin(angle) * 6);
        g.strokePath();
        g.fillStyle(0xffaa66, 1);
        g.fillCircle(0, 0, 2);
        g.x = ex; g.y = ey;

        const SPEED = 420;
        this.enemyProjectiles.push({
            gfx: g,
            vx: fdx * SPEED,
            vy: fdy * SPEED,
            damage: 8,
            startX: ex,
            startY: ey,
        });

        // Muzzle flash
        const flash = this.add.circle(ex, ey, 8, 0xff4400, 0.7).setDepth(3);
        this.tweens.add({ targets: flash, radius: 14, alpha: 0, duration: 140, onComplete: () => flash.destroy() });
    }

    _fireSniperShotgun(enemy) {
        // 5-pellet shotgun burst in a ~70° cone aimed at the player
        // Pellets dissolve after ~2 tiles — purely close-range threat
        const ex = enemy.sprite.x, ey = enemy.sprite.y;
        const px = this.player.x, py = this.player.y;
        const baseAngle = Math.atan2(py - ey, px - ex);
        const SPREAD = Math.PI / 2.6; // ~70° total cone
        const PELLETS = 5;
        const SPEED = 380;
        const DAMAGE = 14;
        const MAX_DIST = this.TILE_SIZE * 3.5; // dissolve after ~3.5 tiles

        // Muzzle flash
        const flash = this.add.graphics().setDepth(4);
        flash.x = ex; flash.y = ey;
        flash.fillStyle(0xee88ff, 0.85); flash.fillCircle(0, 0, 14);
        flash.lineStyle(2, 0xffffff, 0.90); flash.strokeCircle(0, 0, 18);
        this.tweens.add({ targets: flash, scaleX: 2.0, scaleY: 2.0, alpha: 0, duration: 180, ease: 'Quad.easeOut', onComplete: () => flash.destroy() });
        this.cameras.main.shake(30, 0.003);

        for (let i = 0; i < PELLETS; i++) {
            const t = (i / (PELLETS - 1)) - 0.5; // -0.5 … +0.5
            const angle = baseAngle + t * SPREAD;
            const vx = Math.cos(angle) * SPEED;
            const vy = Math.sin(angle) * SPEED;

            const g = this.add.graphics().setDepth(2.8);
            g.lineStyle(2.5, 0xdd66ff, 1);
            g.beginPath();
            g.moveTo(-Math.cos(angle) * 5, -Math.sin(angle) * 5);
            g.lineTo( Math.cos(angle) * 5,  Math.sin(angle) * 5);
            g.strokePath();
            g.fillStyle(0xffffff, 0.9); g.fillCircle(0, 0, 2);
            g.x = ex; g.y = ey;

            this.enemyProjectiles.push({ gfx: g, vx, vy, damage: DAMAGE, startX: ex, startY: ey, _isShotgunPellet: true, maxDist: MAX_DIST });
        }
    }

    _fireRicochetArrow(enemy, spreadOffset) {
        const ex = enemy.sprite.x, ey = enemy.sprite.y;
        let ndx, ndy;
        if (enemy.lockedDir) {
            ndx = enemy.lockedDir.x; ndy = enemy.lockedDir.y;
        } else {
            const px = this.playerX * this.TILE_SIZE + this.TILE_SIZE / 2;
            const py = this.playerY * this.TILE_SIZE + this.TILE_SIZE / 2;
            const dx = px - ex, dy = py - ey;
            const len = Math.sqrt(dx*dx + dy*dy) || 1;
            ndx = dx/len; ndy = dy/len;
        }
        const cos = Math.cos(spreadOffset), sin = Math.sin(spreadOffset);
        const fdx = ndx*cos - ndy*sin, fdy = ndx*sin + ndy*cos;
        const angle = Math.atan2(fdy, fdx);

        // Arrow visual — pointed yellow dart
        const g = this.add.graphics().setDepth(2.5);
        g.fillStyle(0xffdd00, 1.0);
        g.beginPath();
        g.moveTo(Math.cos(angle)*8, Math.sin(angle)*8);
        g.lineTo(Math.cos(angle+2.8)*5, Math.sin(angle+2.8)*5);
        g.lineTo(Math.cos(angle+Math.PI)*3, Math.sin(angle+Math.PI)*3);
        g.lineTo(Math.cos(angle-2.8)*5, Math.sin(angle-2.8)*5);
        g.closePath(); g.fillPath();
        g.lineStyle(1, 0xffaa00, 0.80); g.strokePath();
        g.x = ex; g.y = ey;

        this.enemyProjectiles.push({
            gfx: g, vx: fdx * 380, vy: fdy * 380,
            damage: 10 * this.damageScaling,
            isRicochetArrow: true, ricochetLeft: 3,
            startX: ex, startY: ey,
        });
    }

    updateEnemyProjectiles(delta) {
        if (!this.enemyProjectiles) return;
        const ds = delta / 1000;
        const time = this.time.now;

        for (let i = this.enemyProjectiles.length - 1; i >= 0; i--) {
            const p = this.enemyProjectiles[i];

            // Rope tendril — advance tip separately, keep gfx at 0,0
            if (p.isRopeTendril) {
                p._tipX += p.vx * ds;
                p._tipY += p.vy * ds;
            } else {
                p.gfx.x += p.vx * ds;
                p.gfx.y += p.vy * ds;
            }

            // ── Rope tendril visual — thorned organic tendril redrawn each frame ──
            if (p.isRopeTendril && p.gfx.active) {
                const tipX = p._tipX, tipY = p._tipY;
                const sx = p.startX, sy = p.startY;
                const rdx = tipX - sx, rdy = tipY - sy;
                const rlen = Math.sqrt(rdx*rdx + rdy*rdy) || 1;
                const rnx = rdx/rlen, rny = rdy/rlen;
                const rpx = -rny, rpy = rnx; // perpendicular
                const t = (this.time.now - (p._createdAt || 0)) / 1000;
                const SEGS = 16;
                const WIGGLE = 3.5;

                p.gfx.clear();

                // ── Stem — thick dark green with organic wobble ──
                const pts = [];
                for (let s = 0; s <= SEGS; s++) {
                    const tf = s / SEGS;
                    const wave = Math.sin(tf * Math.PI * 2.5 + t * 5) * WIGGLE * Math.sin(tf * Math.PI);
                    pts.push({
                        x: sx + rdx * tf + rpx * wave,
                        y: sy + rdy * tf + rpy * wave
                    });
                }
                // Outer dark stem
                p.gfx.lineStyle(5, 0x0d2210, 0.95);
                p.gfx.beginPath();
                pts.forEach((pt, s) => s === 0 ? p.gfx.moveTo(pt.x, pt.y) : p.gfx.lineTo(pt.x, pt.y));
                p.gfx.strokePath();
                // Inner green stem
                p.gfx.lineStyle(3, 0x226633, 0.90);
                p.gfx.beginPath();
                pts.forEach((pt, s) => s === 0 ? p.gfx.moveTo(pt.x, pt.y) : p.gfx.lineTo(pt.x, pt.y));
                p.gfx.strokePath();
                // Highlight streak
                p.gfx.lineStyle(1, 0x55ff88, 0.45);
                p.gfx.beginPath();
                pts.forEach((pt, s) => {
                    const ox = pt.x + rpx * 1, oy = pt.y + rpy * 1;
                    s === 0 ? p.gfx.moveTo(ox, oy) : p.gfx.lineTo(ox, oy);
                });
                p.gfx.strokePath();

                // ── Thorns — spiky triangles along the stem ──
                const THORN_EVERY = 3; // every N segments
                for (let s = THORN_EVERY; s < SEGS; s += THORN_EVERY) {
                    const pt = pts[s];
                    const pn = pts[s + 1] || pts[s];
                    const segDx = pn.x - pt.x, segDy = pn.y - pt.y;
                    const segLen = Math.sqrt(segDx*segDx + segDy*segDy) || 1;
                    const snx = segDx/segLen, sny = segDy/segLen;
                    const spx = -sny, spy = snx;
                    const side = (s / THORN_EVERY % 2 === 0) ? 1 : -1; // alternate sides
                    const thornLen = 5 + Math.sin(s + t * 3) * 2;
                    // Thorn base points
                    const b1x = pt.x + spx*side*2, b1y = pt.y + spy*side*2;
                    const b2x = pt.x + snx*3,       b2y = pt.y + sny*3;
                    const tipTx = pt.x + spx*side*thornLen - snx*1;
                    const tipTy = pt.y + spy*side*thornLen - sny*1;
                    p.gfx.fillStyle(0x338844, 0.90);
                    p.gfx.fillTriangle(b1x, b1y, b2x, b2y, tipTx, tipTy);
                    // Thorn outline
                    p.gfx.lineStyle(1, 0x55ff88, 0.50);
                    p.gfx.strokeTriangle(b1x, b1y, b2x, b2y, tipTx, tipTy);
                }

                // ── Tip — curled claw head ──
                const tipAngle = Math.atan2(rny, rnx);
                const cos = Math.cos(tipAngle), sinA = Math.sin(tipAngle);
                // Main claw point
                p.gfx.fillStyle(0x44ff88, 0.95);
                p.gfx.fillTriangle(
                    tipX + cos*11,        tipY + sinA*11,
                    tipX + rpx*5 - cos*3, tipY + rpy*5 - sinA*3,
                    tipX - rpx*5 - cos*3, tipY - rpy*5 - sinA*3
                );
                // Side hooks
                p.gfx.fillStyle(0x226633, 0.85);
                p.gfx.fillTriangle(tipX + rpx*5, tipY + rpy*5, tipX + rpx*9 + cos*2, tipY + rpy*9 + sinA*2, tipX + rpx*3 + cos*5, tipY + rpy*3 + sinA*5);
                p.gfx.fillTriangle(tipX - rpx*5, tipY - rpy*5, tipX - rpx*9 + cos*2, tipY - rpy*9 + sinA*2, tipX - rpx*3 + cos*5, tipY - rpy*3 + sinA*5);
                // Glow dot at origin
                p.gfx.fillStyle(0x44ff88, 0.50);
                p.gfx.fillCircle(sx, sy, 3.5);
            }

            // Standard trail (non-rope projectiles only)
            if (!p.isRopeTendril) {
                const trail = this.add.rectangle(p.gfx.x, p.gfx.y, 3, 3, 0xff4400, 0.4).setDepth(1.5);
                this.tweens.add({ targets: trail, alpha: 0, duration: 200, onComplete: () => trail.destroy() });
            }

            // Wall collision
            const checkX = p.isRopeTendril ? p._tipX : p.gfx.x;
            const checkY = p.isRopeTendril ? p._tipY : p.gfx.y;
            const tx = Math.floor(checkX / this.TILE_SIZE);
            const ty = Math.floor(checkY / this.TILE_SIZE);
            const oob = tx < 0 || tx >= this.WORLD_WIDTH || ty < 0 || ty >= this.WORLD_HEIGHT;
            if (oob || this.world[tx][ty] === this.WALL || this.world[tx][ty] === this.NOTHING || this.isInLockedRoom(tx, ty)) {
                if (p.isRicochetArrow && p.ricochetLeft > 0) {                    // Bounce — reflect off wall axis
                    const prevTX = Math.floor((p.gfx.x - p.vx * (delta/1000)) / this.TILE_SIZE);
                    const prevTY = Math.floor((p.gfx.y - p.vy * (delta/1000)) / this.TILE_SIZE);
                    // Determine wall axis by checking which direction caused the hit
                    const hitX = !oob && (this.world[tx][prevTY] === this.WALL || this.world[tx][prevTY] === this.NOTHING || tx < 0 || tx >= this.WORLD_WIDTH);
                    const hitY = !oob && (this.world[prevTX][ty] === this.WALL || this.world[prevTX][ty] === this.NOTHING || ty < 0 || ty >= this.WORLD_HEIGHT);
                    if (hitX || oob) p.vx = -p.vx;
                    if (hitY || oob) p.vy = -p.vy;
                    p.ricochetLeft--;
                    // Flash on bounce
                    const bf = this.add.circle(p.gfx.x, p.gfx.y, 6, 0xffdd00, 0.7).setDepth(3);
                    this.tweens.add({ targets: bf, radius: 12, alpha: 0, duration: 120, onComplete: () => bf.destroy() });
                    continue;
                }
                this._destroyEnemyProjectile(p);
                this.enemyProjectiles.splice(i, 1);
                continue;
            }

            // Player hit
            const ppx = this.playerX * this.TILE_SIZE + this.TILE_SIZE / 2;
            const ppy = this.playerY * this.TILE_SIZE + this.TILE_SIZE / 2;
            const hitX = p.isRopeTendril ? p._tipX : p.gfx.x;
            const hitY = p.isRopeTendril ? p._tipY : p.gfx.y;
            const dist = Math.hypot(hitX - ppx, hitY - ppy);
            if (dist < this.TILE_SIZE * 0.7) {
                if (p.isRootTendril) {
                    if (p.isPullTendril && p.sourceEnemy?.sprite?.active) {
                        // Pull player toward the rooter — move up to 3 tiles
                        const enemy = p.sourceEnemy;
                        const PULL_TILES = 4;
                        const dxE = enemy.x - this.playerX, dyE = enemy.y - this.playerY;
                        const distE = Math.abs(dxE) + Math.abs(dyE);
                        const steps = Math.min(PULL_TILES, distE);
                        let cx = this.playerX, cy = this.playerY;
                        for (let s = 0; s < steps; s++) {
                            const nx = cx + Math.sign(dxE), ny = cy + Math.sign(dyE);
                            // Move along dominant axis first
                            if (Math.abs(dxE) >= Math.abs(dyE)) {
                                if (this.world[nx]?.[cy] === this.FLOOR) cx = nx;
                                else if (this.world[cx]?.[ny] === this.FLOOR) cy = ny;
                                else break;
                            } else {
                                if (this.world[cx]?.[ny] === this.FLOOR) cy = ny;
                                else if (this.world[nx]?.[cy] === this.FLOOR) cx = nx;
                                else break;
                            }
                        }
                        this.playerX = cx; this.playerY = cy;
                        this.tweens.add({
                            targets: this.player,
                            x: cx * this.TILE_SIZE + this.TILE_SIZE / 2,
                            y: cy * this.TILE_SIZE + this.TILE_SIZE / 2 + this.SLIME_Y_OFFSET,
                            duration: 250, ease: 'Quad.easeOut'
                        });
                        this.showStatusText(this.player.x, this.player.y - 28, 'PULLED!', '#44ff88');
                        this.cameras.main.shake(40, 0.004);
                    } else {
                        // Legacy root
                        if (typeof this._rootPlayer === 'function') this._rootPlayer(2000, this.time.now);
                        this.showStatusText(this.player.x, this.player.y - 28, 'ROOTED!', '#44ff88');
                    }
                } else if (time - this.lastPlayerDamageTime >= this.playerDamageCooldown) {
                    this.takeDamage(p.damage);
                    this.lastPlayerDamageTime = time;
                }
                if (p.trailGfx?.active) p.trailGfx.destroy();
                this._destroyEnemyProjectile(p);
                this.enemyProjectiles.splice(i, 1);
                continue;
            }

            // Max range (default 16 tiles, overridable per projectile)
            const startX = p.startX ?? p.gfx.x, startY = p.startY ?? p.gfx.y;
            const rangeX = p.isRopeTendril ? p._tipX : p.gfx.x;
            const rangeY = p.isRopeTendril ? p._tipY : p.gfx.y;
            const maxRange = p.maxDist ?? (16 * this.TILE_SIZE);
            if (Math.hypot(rangeX - startX, rangeY - startY) > maxRange) {
                this._destroyEnemyProjectile(p);
                this.enemyProjectiles.splice(i, 1);
            }
        }
    }

    _destroyEnemyProjectile(p) {
        if (p.trailGfx?.active) p.trailGfx.destroy();
        if (p.gfx && p.gfx.active) {
            const x = p.gfx.x, y = p.gfx.y;
            p.gfx.destroy();
            const burst = this.add.circle(x, y, 5, 0xff4400, 0.8).setDepth(3);
            this.tweens.add({ targets: burst, radius: 12, alpha: 0, duration: 180, onComplete: () => burst.destroy() });
        }
    }

    // ══════════════════════════════════════════════════════════════════════
    // LEVEL 4 ENEMY CREATORS
    // ══════════════════════════════════════════════════════════════════════

    createUpgradedSniper(x, y, roomIndex) {
        // Level 4 sniper — fires 3 ricocheting arrows
        const e = this.createVoidSniper ? this.createVoidSniper(x, y, roomIndex) : this.createRangedEnemy(x, y, roomIndex);
        e._upgradedSniper = true;
        e.health = 50; e.maxHealth = 50; // slightly more hp than base sniper
        if (typeof e.sprite.setTint === 'function') e.sprite.setTint(0xcc8800);
        return e;
    }

    createMortar(x, y, roomIndex) {
        const e = this.createEnemy(x, y, 220);
        e.tutorialRoomIndex = roomIndex;
        e.isMortar = true;
        e._mortarLastFire = 0;
        e._mortarCooldown = 3200;
        e._mortarSafeRadius = 5; // tiles — blind spot
        // Visual: dark grey with orange glowing barrel ring
        e.sprite.setTint(0x445566);
        const gfx = this.add.graphics().setDepth(2);
        gfx.lineStyle(2.5, 0xff6600, 0.80); gfx.strokeCircle(0, 0, 10);
        gfx.fillStyle(0xff6600, 0.40);       gfx.fillCircle(0, 0, 10);
        gfx.fillStyle(0xffaa00, 0.90);       gfx.fillCircle(0, 0, 4);
        gfx.x = e.sprite.x; gfx.y = e.sprite.y;
        this.tweens.add({ targets: gfx, alpha: 0.55, duration: 700, yoyo: true, repeat: -1 });
        e._mortarGfx = gfx;
        // Safe-radius ring
        const safeRing = this.add.graphics().setDepth(0.8);
        safeRing.lineStyle(1.5, 0xffaa00, 0.25);
        safeRing.strokeCircle(0, 0, e._mortarSafeRadius * this.TILE_SIZE);
        safeRing.x = e.sprite.x; safeRing.y = e.sprite.y;
        e._mortarSafeRing = safeRing;
        return e;
    }

    createSplitter(x, y, roomIndex, tier = 0) {
        // tier 0=large(180HP), 1=medium(80HP), 2=small(30HP)
        const hpByTier   = [180, 80, 30];
        const tintByTier = [0xff6600, 0xff8822, 0xffaa44];
        const scaleByTier = [1.4, 1.0, 0.65];
        const e = this.createEnemy(x, y, hpByTier[tier]);
        e.tutorialRoomIndex = roomIndex;
        e.isSplitter = true;
        e._splitterTier = tier;
        e.sprite.setTint(tintByTier[tier]);
        const targetScale = this.SLIME_SCALE * scaleByTier[tier];
        e._baseScale = targetScale; // stored so scale resets always use the right value
        if (typeof e.sprite.setScale === 'function') e.sprite.setScale(targetScale);
        // Mark — orange S above
        const sm = this.add.graphics().setDepth(3);
        sm.fillStyle(tintByTier[tier], 0.95);
        sm.fillRect(-4, -9, 8, 7); sm.fillRect(-4, -1, 8, 7);
        sm.fillStyle(0xffffff, 0.35); sm.fillRect(-2, -7, 4, 3);
        sm.x = e.sprite.x; sm.y = e.sprite.y - 26;
        e._splitterMark = sm;
        return e;
    }

    createRooter(x, y, roomIndex) {
        const e = this.createEnemy(x, y, 60);
        e.tutorialRoomIndex = roomIndex;
        e.isRooter = true;
        // Far attack — pull tendril
        e._tendrilCooldown = 4000;
        e._tendrilLastFire = 0;
        e._tendrilRange = 12;   // tiles — fires when player is beyond thump range
        // Close attack — ground thump
        e._thumpCooldown = 2000;
        e._thumpLastFire = 0;
        e._thumpRange = 2;      // tiles — switches to thump when player is within this range
        // Legacy alias for old code that still references _rooterCooldown/_rooterRange
        e._rooterCooldown = e._tendrilCooldown;
        e._rooterLastFire = 0;
        e._rooterRange    = e._tendrilRange;
        e.sprite.setTint(0x226633);
        // Green tendril mark
        const gfx = this.add.graphics().setDepth(2);
        gfx.lineStyle(2, 0x44ff88, 0.90);
        gfx.beginPath();
        for (let i = 0; i < 4; i++) {
            const a = (i / 4) * Math.PI * 2;
            gfx.moveTo(0, 0); gfx.lineTo(Math.cos(a)*9, Math.sin(a)*9);
        }
        gfx.strokePath();
        gfx.fillStyle(0x44ff88, 0.80); gfx.fillCircle(0, 0, 3);
        gfx.x = e.sprite.x; gfx.y = e.sprite.y - 22;
        this.tweens.add({ targets: gfx, scaleX: 1.2, scaleY: 1.2, duration: 600, yoyo: true, repeat: -1 });
        e._rooterMark = gfx;
        return e;
    }

    createAnchorSlime(x, y, roomIndex) {
        const e = this.createEnemy(x, y, 150);
        e.tutorialRoomIndex = roomIndex;
        e.isAnchor = true;
        e._anchorPulseInterval = 3000;
        e._anchorLastPulse = 0;
        e._anchorRange = 5; // tiles
        e._anchorSpeedBuff = 1.5;
        e._anchorSlowMult  = 0.5;

        const px = e.sprite.x, py = e.sprite.y;
        const TS = this.TILE_SIZE;

        // Hide default slime sprite — replaced by custom graphic
        e.sprite.setAlpha(0);

        // ── ANCHOR BODY ───────────────────────────────────────────────────────
        const body = this.add.graphics().setDepth(2.5);
        body.x = px; body.y = py;

        // Heavy iron chain ring at top
        body.lineStyle(3, 0x445566, 1.0);
        body.strokeCircle(0, -16, 5);
        body.lineStyle(2, 0x778899, 0.70);
        body.strokeCircle(0, -16, 5);

        // Anchor shaft
        body.fillStyle(0x334455, 1.0);
        body.fillRect(-3, -11, 6, 20);
        body.lineStyle(1.5, 0x556677, 0.80);
        body.strokeRect(-3, -11, 6, 20);

        // Crossbar
        body.fillStyle(0x3a4f63, 1.0);
        body.fillRect(-10, -6, 20, 4);
        body.lineStyle(1.5, 0x6688aa, 0.70);
        body.strokeRect(-10, -6, 20, 4);
        // Crossbar end caps
        body.fillStyle(0x55aacc, 0.80);
        body.fillCircle(-10, -4, 3);
        body.fillCircle(10, -4, 3);

        // Flukes (curved arms at bottom)
        body.lineStyle(4, 0x334455, 1.0);
        body.beginPath(); body.moveTo(-3, 9); body.lineTo(-12, 14); body.strokePath();
        body.beginPath(); body.moveTo(3, 9); body.lineTo(12, 14); body.strokePath();
        body.lineStyle(2, 0x6688aa, 0.65);
        body.beginPath(); body.moveTo(-3, 9); body.lineTo(-12, 14); body.strokePath();
        body.beginPath(); body.moveTo(3, 9); body.lineTo(12, 14); body.strokePath();
        // Fluke tips
        body.fillStyle(0x55aacc, 0.90);
        body.fillCircle(-12, 14, 3.5);
        body.fillCircle(12, 14, 3.5);

        // Steel sheen highlight on shaft
        body.lineStyle(1, 0xaaccdd, 0.35);
        body.beginPath(); body.moveTo(-1, -10); body.lineTo(-1, 8); body.strokePath();

        e._anchorBodyGfx = body;

        // ── RANGE RING — two concentric dashed-look rings ────────────────────
        const ring = this.add.graphics().setDepth(0.9);
        ring.x = px; ring.y = py;
        const R = e._anchorRange * TS;
        // Outer ring — dashed by drawing arc segments
        for (let seg = 0; seg < 16; seg++) {
            const a1 = (seg / 16) * Math.PI * 2;
            const a2 = ((seg + 0.6) / 16) * Math.PI * 2;
            ring.lineStyle(1.5, 0x4488bb, 0.45);
            ring.beginPath();
            ring.arc(0, 0, R, a1, a2, false);
            ring.strokePath();
        }
        // Inner subtle ring
        ring.lineStyle(1, 0x226699, 0.25);
        ring.strokeCircle(0, 0, R * 0.6);
        this.tweens.add({ targets: ring, alpha: 0.20, duration: 2000, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
        e._anchorRing = ring;

        // Slow pulse — concentric ring that expands outward on each pulse tick
        e._anchorPulseGfx = null; // created dynamically each pulse in AI loop

        return e;
    }

    createHealerTotem(x, y, roomIndex) {
        const e = this.createEnemy(x, y, 120);
        e.tutorialRoomIndex = roomIndex;
        e.isHealerTotem = true;
        e._healerRange = 6;
        e._healerTickInterval = 500;
        e._healerLastTick = 0;
        e._healerHealPerTick = 8;

        // Hide the slime sprite entirely — totem is all custom graphics
        e.sprite.setAlpha(0);

        const px = e.sprite.x, py = e.sprite.y;
        const TS = this.TILE_SIZE;

        // ── TOTEM BODY ────────────────────────────────────────────────────────
        const totem = this.add.graphics().setDepth(2.5);

        // Base plinth — dark stone slab
        totem.fillStyle(0x2a2a3a, 1.0);
        totem.fillRect(-10, 6, 20, 10);
        totem.lineStyle(1.2, 0x5566aa, 0.70);
        totem.strokeRect(-10, 6, 20, 10);
        // Stone texture lines
        totem.lineStyle(0.8, 0x44446a, 0.50);
        totem.beginPath(); totem.moveTo(-10, 10); totem.lineTo(10, 10); totem.strokePath();
        totem.beginPath(); totem.moveTo(-5, 6); totem.lineTo(-5, 16); totem.strokePath();
        totem.beginPath(); totem.moveTo(5, 6); totem.lineTo(5, 16); totem.strokePath();

        // Pillar shaft
        totem.fillStyle(0x1e2030, 1.0);
        totem.fillRect(-5, -10, 10, 16);
        totem.lineStyle(1.2, 0x4455aa, 0.65);
        totem.strokeRect(-5, -10, 10, 16);
        // Rune lines on shaft
        totem.lineStyle(1, 0x44ff88, 0.55);
        totem.beginPath(); totem.moveTo(-3, -7); totem.lineTo(3, -7); totem.strokePath();
        totem.beginPath(); totem.moveTo(-3, -3); totem.lineTo(3, -3); totem.strokePath();
        totem.beginPath(); totem.moveTo(-3, 1); totem.lineTo(3, 1); totem.strokePath();

        // Orb housing ring
        totem.fillStyle(0x223344, 1.0);
        totem.fillCircle(0, -17, 11);
        totem.lineStyle(2, 0x44aaff, 0.80);
        totem.strokeCircle(0, -17, 11);
        totem.lineStyle(1, 0x88ddff, 0.45);
        totem.strokeCircle(0, -17, 8);

        // Outer decorative spokes (8 points)
        totem.lineStyle(1.5, 0x44ff88, 0.60);
        for (let i = 0; i < 8; i++) {
            const a = (i / 8) * Math.PI * 2;
            const r1 = 11, r2 = 15;
            totem.beginPath();
            totem.moveTo(Math.cos(a)*r1, -17 + Math.sin(a)*r1);
            totem.lineTo(Math.cos(a)*r2, -17 + Math.sin(a)*r2);
            totem.strokePath();
        }

        // Inner orb — bright green healing crystal
        totem.fillStyle(0x00ff66, 0.90);
        totem.fillCircle(0, -17, 6);
        // Orb specular highlight
        totem.fillStyle(0xffffff, 0.70);
        totem.fillCircle(-2, -20, 2);
        // Orb inner glow ring
        totem.lineStyle(1, 0x88ffcc, 0.80);
        totem.strokeCircle(0, -17, 4);

        totem.x = px; totem.y = py;
        e._totemGfx = totem;

        // ── PULSING INNER ORB GLOW (separate so it can scale independently) ──
        const orbGlow = this.add.graphics().setDepth(2.6);
        orbGlow.fillStyle(0x44ff88, 0.45);
        orbGlow.fillCircle(0, 0, 8);
        orbGlow.x = px; orbGlow.y = py - 17;
        this.tweens.add({
            targets: orbGlow, scaleX: 1.4, scaleY: 1.4, alpha: 0.15,
            duration: 700, yoyo: true, repeat: -1, ease: 'Sine.easeInOut'
        });
        e._orbGlow = orbGlow;

        // ── RISING HEAL PARTICLE STREAM ──────────────────────────────────────
        const particleTimer = this.time.addEvent({
            delay: 380, loop: true,
            callback: () => {
                if (!e.sprite?.active) { particleTimer.remove(); return; }
                const pg = this.add.graphics().setDepth(2.8);
                const s = 2 + Math.random() * 1.5; // half-size of plus arm
                pg.fillStyle(0x44ff88, 0.90);
                pg.fillRect(-s*0.4, -s, s*0.8, s*2);   // vertical arm
                pg.fillRect(-s, -s*0.4, s*2, s*0.8);   // horizontal arm
                pg.x = px + (Math.random()-0.5) * 10;
                pg.y = py - 17;
                this.tweens.add({ targets: pg, y: pg.y - 18 - Math.random()*10, alpha: 0, duration: 550 + Math.random()*250, ease: 'Quad.easeOut', onComplete: () => pg.destroy() });
            }
        });
        e._particleTimer = particleTimer;

        // ── AURA RING ─────────────────────────────────────────────────────────
        const aura = this.add.graphics().setDepth(0.8);
        aura.lineStyle(2, 0x44ff88, 0.45);
        aura.strokeCircle(0, 0, e._healerRange * TS);
        aura.fillStyle(0x44ff88, 0.05);
        aura.fillCircle(0, 0, e._healerRange * TS);
        aura.x = px; aura.y = py;
        this.tweens.add({ targets: aura, alpha: 0.20, duration: 1200, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
        e._healerAura = aura;

        // ── HP BAR ────────────────────────────────────────────────────────────
        // Re-position health bar above totem (not above hidden slime sprite)
        if (e.healthBarBg?.active)   { e.healthBarBg.y   = py - 34; }
        if (e.healthBarFill?.active) { e.healthBarFill.y = py - 34; }

        return e;
    }

    // ── Level 4: Mortar arc shot — flies over walls, lands on player tile ──
    _fireMortarShot(enemy) {
        const TS = this.TILE_SIZE;
        const ex = enemy.sprite.x, ey = enemy.sprite.y;
        // Lock to current player tile at fire time
        const targetPX = this.playerX * TS + TS / 2;
        const targetPY = this.playerY * TS + TS / 2;

        // Arc trajectory — parabolic tween
        const FLIGHT_DUR = 1000 + Math.random() * 300;
        const ROCK_SIZE  = 10;
        const SPLASH_R   = 2.0; // tile radius AoE on landing
        const DMG        = 20 * this.damageScaling;

        // Shadow grows on ground as rock descends
        const shadow = this.add.ellipse(ex, ey, 8, 5, 0x000000, 0.35).setDepth(0.5);
        this.tweens.add({ targets: shadow, x: targetPX, y: targetPY,
            scaleX: 3, scaleY: 2, alpha: 0.50, duration: FLIGHT_DUR, ease: 'Linear' });

        // Rock sprite — orange boulder
        const rock = this.add.graphics().setDepth(5);
        rock.fillStyle(0xcc6622, 1.0); rock.fillCircle(0, 0, ROCK_SIZE);
        rock.fillStyle(0xffaa55, 0.60); rock.fillCircle(-3, -3, 4);
        rock.lineStyle(1.5, 0x885522, 0.80); rock.strokeCircle(0, 0, ROCK_SIZE);
        rock.x = ex; rock.y = ey;

        // Warning ring at landing zone appears halfway through flight
        this.time.delayedCall(FLIGHT_DUR * 0.4, () => {
            const warn = this.add.graphics().setDepth(3.5);
            warn.lineStyle(2, 0xff6600, 0.80); warn.strokeCircle(targetPX, targetPY, SPLASH_R * TS);
            warn.fillStyle(0xff6600, 0.10); warn.fillCircle(targetPX, targetPY, SPLASH_R * TS);
            this.tweens.add({ targets: warn, alpha: 0.30, duration: 250, yoyo: true, repeat: 2,
                onComplete: () => warn.destroy() });
        });

        // Arc motion — horizontal linear, vertical parabolic
        const arcHeight = 120 + Math.random() * 60;
        const startY = ey;
        let elapsed = 0;
        const arcTimer = this.time.addEvent({
            delay: 16, loop: true,
            callback: () => {
                elapsed += 16;
                const t = Math.min(elapsed / FLIGHT_DUR, 1);
                rock.x = ex + (targetPX - ex) * t;
                // Parabola: y = start + (end-start)*t - 4*arcHeight*t*(1-t)
                rock.y = startY + (targetPY - startY) * t - 4 * arcHeight * t * (1 - t);
                rock.setScale(0.6 + t * 0.5); // grows as it falls
                if (t >= 1) {
                    arcTimer.remove();
                    rock.destroy(); shadow.destroy();
                    // IMPACT
                    this.cameras.main.shake(80, 0.006);
                    const impactGfx = this.add.graphics().setDepth(5);
                    impactGfx.x = targetPX; impactGfx.y = targetPY;
                    impactGfx.fillStyle(0xff6600, 0.65); impactGfx.fillCircle(0, 0, SPLASH_R * TS * 1.1);
                    impactGfx.fillStyle(0xffaa44, 0.80); impactGfx.fillCircle(0, 0, SPLASH_R * TS * 0.4);
                    this.tweens.add({ targets: impactGfx, scaleX: 1.4, scaleY: 1.4, alpha: 0, duration: 400, onComplete: () => impactGfx.destroy() });
                    // Debris particles
                    for (let d = 0; d < 6; d++) {
                        const da = Math.random() * Math.PI * 2;
                        const dr = 18 + Math.random() * 30;
                        const dg = this.add.graphics().setDepth(4);
                        dg.fillStyle(0xcc6622, 1.0); dg.fillCircle(0, 0, 3 + Math.random() * 3);
                        dg.x = targetPX; dg.y = targetPY;
                        this.tweens.add({ targets: dg, x: targetPX + Math.cos(da)*dr, y: targetPY + Math.sin(da)*dr, alpha: 0, duration: 350, onComplete: () => dg.destroy() });
                    }
                    // Damage player if in splash
                    const pdx = this.player.x - targetPX, pdy = this.player.y - targetPY;
                    if (Math.sqrt(pdx*pdx + pdy*pdy) <= SPLASH_R * TS) {
                        this.takeDamage(DMG);
                    }
                }
            }
        });
    }

    // ── Level 4: Rooter tendril — full rope drawn each frame ─────────────────
    _fireRootTendril(enemy) {
        const TS = this.TILE_SIZE;
        const ex = enemy.sprite.x, ey = enemy.sprite.y;
        const targetPX = this.playerX * TS + TS / 2;
        const targetPY = this.playerY * TS + TS / 2;
        const dx = targetPX - ex, dy = targetPY - ey;
        const len = Math.sqrt(dx*dx + dy*dy) || 1;
        const ndx = dx/len, ndy = dy/len;
        const SPEED = 130; // slower — player must react

        // Single graphics object redrawn every frame as full rope from body to tip
        const ropeGfx = this.add.graphics().setDepth(3.2);
        // Position at 0,0 — all coords drawn in world space
        ropeGfx.x = 0; ropeGfx.y = 0;

        this.enemyProjectiles.push({
            gfx: ropeGfx,
            vx: ndx * SPEED, vy: ndy * SPEED,
            damage: 0,
            isRootTendril: true,
            isPullTendril: true,
            sourceEnemy: enemy,
            startX: ex, startY: ey,
            _tipX: ex, _tipY: ey, // tip tracked separately
            _createdAt: this.time.now,
            isRopeTendril: true,
        });
    }

    _rooterGroundThump(enemy) {
        const TS = this.TILE_SIZE;
        const ex = enemy.sprite.x, ey = enemy.sprite.y;
        const THUMP_R = enemy._thumpRange || 3;
        const ROOT_DUR = 1500;

        // Visual — ground shockwave ring
        this.cameras.main.shake(50, 0.005);
        const ring = this.add.graphics().setDepth(3);
        ring.lineStyle(3, 0x44ff88, 0.90);
        ring.strokeCircle(ex, ey, THUMP_R * TS);
        ring.fillStyle(0x226633, 0.15);
        ring.fillCircle(ex, ey, THUMP_R * TS);
        this.tweens.add({ targets: ring, scaleX: 1.15, scaleY: 1.15, alpha: 0, duration: 400, ease: 'Quad.easeOut', onComplete: () => ring.destroy() });

        // Small ground crack under rooter
        const crack = this.add.graphics().setDepth(2.8);
        crack.lineStyle(2, 0x44ff88, 0.80);
        crack.beginPath(); crack.moveTo(ex - 8, ey); crack.lineTo(ex + 8, ey); crack.strokePath();
        crack.beginPath(); crack.moveTo(ex, ey - 8); crack.lineTo(ex, ey + 8); crack.strokePath();
        this.tweens.add({ targets: crack, alpha: 0, duration: 600, onComplete: () => crack.destroy() });

        // Root player if within range
        const pdx = Math.abs(this.playerX - enemy.x), pdy = Math.abs(this.playerY - enemy.y);
        if (pdx + pdy <= THUMP_R) {
            if (typeof this._rootPlayer === 'function') this._rootPlayer(ROOT_DUR, this.time.now);
            this.showStatusText(this.player.x, this.player.y - 28, 'ROOTED!', '#44ff88');
        }

        // Root nearby enemies too (friendly fire — makes combat chaotic)
        for (const ally of this.enemies) {
            if (!ally.sprite?.active || ally === enemy || ally.isFrozen) continue;
            const adx = Math.abs(ally.x - enemy.x), ady = Math.abs(ally.y - enemy.y);
            if (adx + ady <= THUMP_R && typeof this.freezeEnemy === 'function') {
                this.freezeEnemy(ally, ROOT_DUR); // reuse freeze as stun
            }
        }

        // Spawn poison ring tiles on the radius perimeter
        const poisonRadius = Math.round(THUMP_R);
        const poisonTiles = [];
        for (let dx = -poisonRadius; dx <= poisonRadius; dx++) {
            for (let dy = -poisonRadius; dy <= poisonRadius; dy++) {
                const d = Math.sqrt(dx*dx + dy*dy);
                if (d < poisonRadius - 0.7 || d > poisonRadius + 0.7) continue;
                const tx = enemy.x + dx, ty = enemy.y + dy;
                if (tx < 0 || tx >= this.WORLD_WIDTH || ty < 0 || ty >= this.WORLD_HEIGHT) continue;
                if (this.world[tx]?.[ty] !== this.FLOOR) continue;
                poisonTiles.push({ x: tx, y: ty });
            }
        }

        if (poisonTiles.length === 0) return;

        // Draw poison tile overlays — green-black murky pools
        const gfxObjs = [];
        for (const t of poisonTiles) {
            const px2 = t.x * TS, py2 = t.y * TS;
            const base = this.add.rectangle(px2 + TS/2, py2 + TS/2, TS, TS, 0x113322, 0.75).setDepth(0.65);
            const glow = this.add.graphics().setDepth(0.70);
            glow.fillStyle(0x44ff88, 0.22); glow.fillRect(px2 + 2, py2 + 2, TS - 4, TS - 4);
            glow.lineStyle(1, 0x44ff88, 0.50); glow.strokeRect(px2 + 1, py2 + 1, TS - 2, TS - 2);
            // Pulsing bubble
            const bubble = this.add.circle(px2 + TS/2 + (Math.random()-0.5)*6, py2 + TS/2 + (Math.random()-0.5)*6, 3 + Math.random()*2, 0x88ff66, 0.60).setDepth(0.72);
            this.tweens.add({ targets: bubble, y: bubble.y - 4, alpha: 0.20, duration: 500 + Math.random()*300, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
            gfxObjs.push(base, glow, bubble);
        }

        // Register as a floor trap — refreshing DoT (staying on tile resets duration)
        if (!this.floorTraps) this.floorTraps = [];
        const trap = {
            type: 'poison', tiles: poisonTiles, gfxObjs,
            damage: 4, interval: 600, lastTick: 0,
            poisonDuration: 4000,
            _createdAt: this.time.now,
        };
        this.floorTraps.push(trap);

        // Auto-remove trap after 12s
        this.time.delayedCall(12000, () => {
            const idx = this.floorTraps.indexOf(trap);
            if (idx !== -1) this.floorTraps.splice(idx, 1);
            for (const g2 of gfxObjs) { if (g2?.active) { this.tweens.killTweensOf(g2); g2.destroy(); } }
        });
    }


    _triggerSplitterDeath(enemy) {
        const tier = enemy._splitterTier ?? 0;
        if (tier >= 2) return; // small splitters don't split further

        const ex = enemy.x, ey = enemy.y;
        const TS = this.TILE_SIZE;
        const spawnCount = 2;
        const DMG = 12 * this.damageScaling;
        const SPLASH_R = 2 * TS;

        // Split explosion visual — position object, draw at local (0,0)
        const gfx = this.add.graphics().setDepth(5);
        const col = tier === 0 ? 0xff6600 : 0xff8822;
        const spx = ex * TS + TS/2, spy = ey * TS + TS/2;
        gfx.x = spx; gfx.y = spy;
        gfx.fillStyle(col, 0.55); gfx.fillCircle(0, 0, SPLASH_R * 0.9);
        gfx.fillStyle(0xffffff, 0.70); gfx.fillCircle(0, 0, SPLASH_R * 0.3);
        this.tweens.add({ targets: gfx, scaleX: 1.5, scaleY: 1.5, alpha: 0, duration: 300, onComplete: () => gfx.destroy() });
        this.cameras.main.shake(40 + tier * 20, 0.004);

        // Damage player in splash
        const ppx = this.player.x, ppy = this.player.y;
        if (Math.sqrt((ppx-spx)**2 + (ppy-spy)**2) <= SPLASH_R) {
            this.takeDamage(DMG);
        }

        // Spawn smaller splitters at offset tiles
        const offsets = [[-2, 0], [2, 0]];
        for (let i = 0; i < spawnCount; i++) {
            const nx = ex + offsets[i][0], ny = ey + offsets[i][1];
            const validX = nx >= 0 && nx < this.WORLD_WIDTH;
            const validY = ny >= 0 && ny < this.WORLD_HEIGHT;
            const spawnX = (validX && validY && this.world[nx][ny] === this.FLOOR) ? nx : ex;
            const spawnY = (validX && validY && this.world[nx][ny] === this.FLOOR) ? ny : ey;
            const child = this.createSplitter(spawnX, spawnY, enemy.tutorialRoomIndex, tier + 1);
            this.enemies.push(child);
        }
    }

    // ── Speed/slow arrow indicator ────────────────────────────────────────
    // type: 'slow_ice' | 'slow_goop' | 'slow_anchor' | 'speed_anchor' | 'speed_fire'
    // target: an object with .x/.y (sprite or player), or a GameObjects with those props
    // Returns a timer handle — store on target as _speedIndTimer, remove on expiry
    _spawnSpeedArrow(targetX, targetY, type) {
        const isUp = type.startsWith('speed');
        const col = type === 'slow_ice'    ? 0x44ccff
                  : type === 'slow_goop'   ? 0xaaaaaa
                  : type === 'slow_anchor' ? 0x888888
                  : type === 'speed_anchor'? 0xaaffaa
                  : /* speed_fire */         0xff8844;

        // Spawn at random angle around the target at a fixed orbit radius
        const angle = Math.random() * Math.PI * 2;
        const orbitR = 14 + Math.random() * 6;

        const g = this.add.graphics().setDepth(4.5);
        g.fillStyle(col, 0.90);
        if (isUp) {
            g.fillTriangle(-3, 2, 3, 2, 0, -5);  // ↑ arrowhead
            g.fillRect(-1, 2, 2, 5);              // stem down
        } else {
            g.fillTriangle(-3, -2, 3, -2, 0, 5); // ↓ arrowhead
            g.fillRect(-1, -7, 2, 5);             // stem up
        }
        g.x = targetX + Math.cos(angle) * orbitR;
        g.y = targetY + Math.sin(angle) * orbitR;

        // Drift outward from center + fade
        const driftX = Math.cos(angle) * 10;
        const driftY = Math.sin(angle) * 10;
        this.tweens.add({
            targets: g,
            x: g.x + driftX, y: g.y + driftY,
            alpha: 0, duration: 500, ease: 'Quad.easeOut',
            onComplete: () => g.destroy()
        });
    }

    // Start a repeating arrow emitter on a target — call once when state begins
    // Returns the Phaser TimerEvent to store on the target
    _startSpeedIndicator(getTargetXY, type, interval = 350) {
        return this.time.addEvent({
            delay: interval, loop: true,
            callback: () => {
                const pos = getTargetXY();
                if (!pos) return;
                this._spawnSpeedArrow(pos.x, pos.y, type);
            }
        });
    }

    spawnPoisonTrap(tx, ty) {
        // 2×2 poison cloud — purple-green tiles
        const tiles = [
            { x: tx, y: ty }, { x: tx+1, y: ty },
            { x: tx, y: ty+1 }, { x: tx+1, y: ty+1 },
        ];
        const gfxObjs = [];
        for (const t of tiles) {
            const px = t.x * this.TILE_SIZE, py = t.y * this.TILE_SIZE;
            const base = this.add.rectangle(px + this.TILE_SIZE/2, py + this.TILE_SIZE/2,
                this.TILE_SIZE, this.TILE_SIZE, 0x332244, 0.7).setDepth(0.6);
            const bubble = this.add.circle(px + this.TILE_SIZE/2, py + this.TILE_SIZE/2,
                6, 0x88ff44, 0.55).setDepth(0.7);
            this.tweens.add({ targets: bubble, y: bubble.y - 6, alpha: 0.2,
                duration: 600 + Math.random() * 400, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
            gfxObjs.push(base, bubble);
        }
        this.floorTraps.push({ type: 'poison', tiles, gfxObjs,
            damage: 3, interval: 800, lastTick: 0,
            poisonDuration: 5000 });
    }

    spawnSpikeTrap(tx, ty) {
        const px = tx * this.TILE_SIZE, py = ty * this.TILE_SIZE;
        const base = this.add.rectangle(px + this.TILE_SIZE/2, py + this.TILE_SIZE/2,
            this.TILE_SIZE, this.TILE_SIZE, 0x222222, 0.8).setDepth(0.6);
        // Draw little spike triangles
        const spikes = this.add.graphics().setDepth(0.7);
        spikes.fillStyle(0xaaaaaa, 0.9);
        for (let i = 0; i < 3; i++) {
            const sx = px + 4 + i * 7;
            spikes.fillTriangle(sx, py + this.TILE_SIZE - 2, sx + 4, py + 3, sx + 8, py + this.TILE_SIZE - 2);
        }
        // Spike pulse
        this.tweens.add({ targets: spikes, alpha: 0.5, duration: 900, yoyo: true, repeat: -1 });
        this.floorTraps.push({ type: 'spike', tiles: [{ x: tx, y: ty }],
            gfxObjs: [base, spikes], damage: 12, lastTick: 0, interval: 600 });
    }

    updateFloorTraps(time) {
        if (!this.floorTraps) return;
        for (const trap of this.floorTraps) {
            for (const t of trap.tiles) {
                if (this.playerX !== t.x || this.playerY !== t.y) continue;
                if (time - trap.lastTick < trap.interval) continue;
                trap.lastTick = time;

                if (trap.type === 'poison') {
                    // Stepping on trap applies poison — DoT ticks independently after leaving
                    if (!this.playerPoisoned) {
                        this.playerPoisoned = true;
                        this.player.setTint(0x88ff44);
                        this.showStatusText(this.player.x, this.player.y - 20, 'POISONED!', '#88ff44');
                        this._poisonTickCount = 0;
                        this._poisonMaxTicks = Math.floor(trap.poisonDuration / trap.interval);
                        const tickPoison = () => {
                            if (!this.playerPoisoned) return;
                            this.takeDamage(trap.damage);
                            // Re-apply green after red damage flash (200ms)
                            this.time.delayedCall(220, () => {
                                if (this.playerPoisoned && this.player?.active)
                                    this.player.setTint(0x88ff44);
                            });
                            this._poisonTickCount++;
                            if (this._poisonTickCount < this._poisonMaxTicks) {
                                this.time.delayedCall(trap.interval, tickPoison);
                            } else {
                                this.playerPoisoned = false;
                                if (this.player?.active) this.player.clearTint();
                            }
                        };
                        this.time.delayedCall(trap.interval, tickPoison);
                    } else {
                        // Walked back on while still poisoned — reset tick count for full duration
                        this._poisonTickCount = 0;
                    }

                } else if (trap.type === 'spike') {
                    this.takeDamage(trap.damage);
                    this.cameras.main.shake(60, 0.005);
                    this.showStatusText(
                        this.player.x - this.cameras.main.scrollX,
                        this.player.y - this.cameras.main.scrollY - 20,
                        'SPIKE!', '#cccccc');
                }
            }
        }
    }

    // ─── GROUND DROPS ────────────────────────────────────────────────────────

    tryDropFromEnemy(enemy) {
        const ex = enemy.sprite.x, ey = enemy.sprite.y;
        // 12% glorp drop
        if (Math.random() < 0.12) {
            this.spawnGroundGlorp(ex, ey, 5);
        }
        // 8% health pot drop
        if (Math.random() < 0.08) {
            this.spawnHealthPot(ex, ey);
        }
    }

    spawnGroundGlorp(wx, wy, value) {
        const tx = Math.floor(wx / this.TILE_SIZE);
        const ty = Math.floor(wy / this.TILE_SIZE);
        const cx = tx * this.TILE_SIZE + this.TILE_SIZE / 2;
        const cy = ty * this.TILE_SIZE + this.TILE_SIZE / 2;
        const container = this._buildGlorpContainer(cx, cy, value);
        this.groundDrops.push({ type: 'glorp', container, tileX: tx, tileY: ty, value, worldX: cx, worldY: cy });
    }

    spawnHealthPot(wx, wy) {
        const tx = Math.floor(wx / this.TILE_SIZE);
        const ty = Math.floor(wy / this.TILE_SIZE);
        const cx = tx * this.TILE_SIZE + this.TILE_SIZE / 2;
        const cy = ty * this.TILE_SIZE + this.TILE_SIZE / 2;

        const container = this.add.container(cx, cy - 10).setDepth(2);
        // Bottle body
        const bottle = this.add.graphics();
        bottle.fillStyle(0xdd2244, 0.85); bottle.fillRect(-5, -8, 10, 12);
        bottle.fillStyle(0xaa1133, 0.9);  bottle.fillRect(-3, -8, 6, 3);   // neck
        bottle.fillStyle(0xff88aa, 0.5);  bottle.fillRect(-3, -5, 3, 7);   // shine
        bottle.fillStyle(0x888888, 1);    bottle.fillRect(-3, -11, 6, 3);  // cork
        container.add(bottle);
        const lbl = this.add.text(0, 8, '+HP', {
            fontSize: '7px', fontFamily: 'monospace', color: '#ff88aa', stroke: '#000', strokeThickness: 2
        }).setOrigin(0.5, 0); container.add(lbl);

        // Hover bob
        this.tweens.add({ targets: container, y: cy - 16, duration: 800, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
        // Soft glow pulse on bottle
        this.tweens.add({ targets: bottle, alpha: 0.7, duration: 500, yoyo: true, repeat: -1 });

        this.groundDrops.push({ type: 'healthpot', container, tileX: tx, tileY: ty, heal: 25, worldX: cx, worldY: cy });
    }

    spawnUltPot(wx, wy) {
        const tx = Math.floor(wx / this.TILE_SIZE);
        const ty = Math.floor(wy / this.TILE_SIZE);
        const cx = tx * this.TILE_SIZE + this.TILE_SIZE / 2;
        const cy = ty * this.TILE_SIZE + this.TILE_SIZE / 2;

        const container = this.add.container(cx, cy - 10).setDepth(2);
        // Same bottle shape as health pot, gold tint
        const bottle = this.add.graphics();
        bottle.fillStyle(0xddaa00, 0.85); bottle.fillRect(-5, -8, 10, 12);
        bottle.fillStyle(0xaa7700, 0.9);  bottle.fillRect(-3, -8, 6, 3);
        bottle.fillStyle(0xffeeaa, 0.5);  bottle.fillRect(-3, -5, 3, 7);
        bottle.fillStyle(0x888888, 1);    bottle.fillRect(-3, -11, 6, 3);
        container.add(bottle);
        const lbl = this.add.text(0, 8, '+ULT', {
            fontSize: '7px', fontFamily: 'monospace', color: '#ffee44', stroke: '#000', strokeThickness: 2
        }).setOrigin(0.5, 0); container.add(lbl);

        this.tweens.add({ targets: container, y: cy - 16, duration: 800, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
        this.tweens.add({ targets: bottle, alpha: 0.7, duration: 500, yoyo: true, repeat: -1 });

        this.groundDrops.push({ type: 'ultpot', container, tileX: tx, tileY: ty, ultAmount: 15, worldX: cx, worldY: cy });
    }

    updateGroundDrops() {
        if (!this.groundDrops) return;
        const MAGNET_TILES = 3; // start flying toward player within this many tiles
        const px = this.playerX, py = this.playerY;

        for (let i = this.groundDrops.length - 1; i >= 0; i--) {
            const drop = this.groundDrops[i];
            if (drop._collecting) continue;

            const dist = Math.abs(px - drop.tileX) + Math.abs(py - drop.tileY);

            // Within magnet range — start flying toward player
            if (dist <= MAGNET_TILES && !drop._magnetised) {
                drop._magnetised = true;
                // Accelerate container toward player each frame
                this.tweens.add({
                    targets: drop.container,
                    x: this.player.x, y: this.player.y,
                    scaleX: 0.5, scaleY: 0.5,
                    duration: 120 + dist * 40,
                    ease: 'Cubic.easeIn',
                    onComplete: () => {
                        if (drop._collecting) return;
                        drop._collecting = true;
                        drop.container.destroy();
                        const idx = this.groundDrops.indexOf(drop);
                        if (idx !== -1) this.groundDrops.splice(idx, 1);
                        if (drop.type === 'glorp') this._collectGroundGlorp(drop);
                        else if (drop.type === 'healthpot') this._collectHealthPot(drop);
                        else if (drop.type === 'ultpot') this._collectUltPot(drop);
                    }
                });
            }

            // Also collect on direct step (instant)
            if (px === drop.tileX && py === drop.tileY && !drop._magnetised) {
                drop._collecting = true;
                this.groundDrops.splice(i, 1);
                this.tweens.add({
                    targets: drop.container,
                    x: this.player.x, y: this.player.y,
                    scaleX: 0.3, scaleY: 0.3, alpha: 0.5,
                    duration: 120, ease: 'Cubic.easeIn',
                    onComplete: () => {
                        drop.container.destroy();
                        if (drop.type === 'glorp') this._collectGroundGlorp(drop);
                        else if (drop.type === 'healthpot') this._collectHealthPot(drop);
                        else if (drop.type === 'ultpot') this._collectUltPot(drop);
                    }
                });
            }
        }
    }

    _collectGroundGlorp(drop) {
        if (!this.totalGlorps) this.totalGlorps = 0;
        this.totalGlorps += drop.value;
        localStorage.setItem('glorps', this.totalGlorps);
        if (this.glorpText) this.glorpText.setText(`✦ ${this.totalGlorps} Glorps`);

        const px = this.player.x - this.cameras.main.scrollX;
        const py = this.player.y - this.cameras.main.scrollY;

        // Burst particles
        for (let p = 0; p < 8; p++) {
            const angle = (p / 8) * Math.PI * 2;
            const spark = this.add.rectangle(px, py, 4, 4, 0x00ffaa, 1).setDepth(10).setScrollFactor(0);
            this.tweens.add({ targets: spark, x: spark.x + Math.cos(angle) * 22, y: spark.y + Math.sin(angle) * 22, alpha: 0, scaleX: 0.2, scaleY: 0.2, duration: 280, ease: 'Quad.easeOut', onComplete: () => spark.destroy() });
        }

        const ft = this.add.text(px, py - 20, `+${drop.value} Glorps`, {
            fontSize: '14px', fontFamily: 'monospace', fontStyle: 'bold',
            color: '#00ffaa', stroke: '#000', strokeThickness: 3
        }).setOrigin(0.5).setDepth(50).setScrollFactor(0);
        this.tweens.add({ targets: ft, y: py - 48, alpha: 0, duration: 700, ease: 'Quad.easeOut', onComplete: () => ft.destroy() });
    }

    _collectHealthPot(drop) {
        const heal = Math.min(drop.heal, this.maxHealth - this.health);
        if (heal <= 0) return;
        this.health = Math.min(this.maxHealth, this.health + drop.heal);
        this.updateHUD();

        // Green heal flash on health bar
        this.tweens.add({ targets: this.healthBarFill, fillColor: 0x44ff88,
            duration: 120, yoyo: true, repeat: 2,
            onComplete: () => { if (this.healthBarFill) this.healthBarFill.setFillStyle(0xff5566); }
        });

        // Floating +HP text
        const fx = this.player.x - this.cameras.main.scrollX;
        const fy = this.player.y - this.cameras.main.scrollY - 20;
        const ft = this.add.text(fx, fy, `+${Math.round(drop.heal)} HP`, {
            fontSize: '16px', fontFamily: 'monospace', fontStyle: 'bold',
            color: '#44ff88', stroke: '#000', strokeThickness: 3
        }).setOrigin(0.5).setDepth(50).setScrollFactor(0);
        this.tweens.add({ targets: ft, y: fy - 30, alpha: 0, duration: 800, ease: 'Quad.easeOut', onComplete: () => ft.destroy() });

        // Screen-edge green vignette flash
        const W = this.scale.width, H = this.scale.height;
        const flash = this.add.rectangle(W/2, H/2, W, H, 0x00ff44, 0.18)
            .setScrollFactor(0).setDepth(200);
        this.tweens.add({ targets: flash, alpha: 0, duration: 400, onComplete: () => flash.destroy() });
    }

    _collectUltPot(drop) {
        this.gainUltCharge(drop.ultAmount || 15);

        // Pulse the ult bar label
        if (this.ultBarLabel) {
            this.tweens.add({ targets: this.ultBarLabel, scaleX: 1.4, scaleY: 1.4, duration: 120, yoyo: true, ease: 'Quad.easeOut' });
        }

        const fx = this.player.x - this.cameras.main.scrollX;
        const fy = this.player.y - this.cameras.main.scrollY - 20;
        const ft = this.add.text(fx, fy, `+${drop.ultAmount || 15}% ULT`, {
            fontSize: '14px', fontFamily: 'monospace', fontStyle: 'bold',
            color: '#ffee44', stroke: '#000', strokeThickness: 3
        }).setOrigin(0.5).setDepth(50).setScrollFactor(0);
        this.tweens.add({ targets: ft, y: fy - 30, alpha: 0, duration: 800, ease: 'Quad.easeOut', onComplete: () => ft.destroy() });

        const W2 = this.scale.width, H2 = this.scale.height;
        const flash2 = this.add.rectangle(W2/2, H2/2, W2, H2, 0xffcc00, 0.12)
            .setScrollFactor(0).setDepth(200);
        this.tweens.add({ targets: flash2, alpha: 0, duration: 350, onComplete: () => flash2.destroy() });
    }

}