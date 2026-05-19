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

        for (let enemy of this.enemies) {
            // STUN CHECK
            if (enemy.isStunned && currentTime < enemy.stunnedUntil) {
                continue;
            } else if (enemy.isStunned && currentTime >= enemy.stunnedUntil) {
                enemy.isStunned = false;
            }

            if (enemy.isFrozen) {
                if (currentTime >= enemy.frozenUntil) {
                    enemy.isFrozen = false;
                    enemy.sprite.clearTint();
                    this.tweens.killTweensOf(enemy.sprite);
                    enemy.sprite.setScale(this.SLIME_SCALE);

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
                    this.createTsunamiPuddle(enemy.x, enemy.y);
                } else {
                    if (enemy.freezeVisuals) {
                        const blockY = enemy.sprite.y + 10;
                        enemy.freezeVisuals.iceBlock.x = enemy.sprite.x;
                        enemy.freezeVisuals.iceBlock.y = blockY;
                        enemy.freezeVisuals.iceBorder.x = enemy.sprite.x;
                        enemy.freezeVisuals.iceBorder.y = blockY;
                        enemy.freezeVisuals.multiplierText.x = enemy.sprite.x;
                        enemy.freezeVisuals.multiplierText.y = blockY - 16;
                    }
                    continue;
                }
            }

            if (enemy.isSlowed && currentTime >= enemy.slowedUntil) {
                enemy.isSlowed = false;
            }
            // Wet enemies move at half speed (isWet set by _shatterWaterSplash)
            if (enemy.isWet && currentTime >= enemy.wetUntil) {
                enemy.isWet = false;
            }

            const isActuallySlowed = enemy.isSlowed || enemy.isWet;
            let moveCooldown = isActuallySlowed ? this.enemyMoveCooldown * 2 : this.enemyMoveCooldown;
            if (enemy.isElectrical) moveCooldown = Math.round(moveCooldown * 0.33); // 3× faster

            if (currentTime - enemy.lastMoveTime < moveCooldown) {
                continue;
            }

            // Ranged enemies are handled entirely by updateRangedEnemies — skip here
            if (enemy.isRanged) continue;

            const dist = Math.abs(enemy.x - this.playerX) + Math.abs(enemy.y - this.playerY);

            // Room gating for tutorial and level 2
            if (this.isTutorial || this.isLevel2) {
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
                enemy.x = nextStep.x;
                enemy.y = nextStep.y;
                enemy.lastMoveTime = currentTime;

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
                                    scaleX: this.SLIME_SCALE, scaleY: this.SLIME_SCALE,
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
            if (this.isTutorial || this.isLevel2) {
                if ((enemy.tutorialRoomIndex ?? -1) !== this.getCurrentPlayerRoom()) continue;
            }

            const dist = Math.abs(enemy.x - this.playerX) + Math.abs(enemy.y - this.playerY);
            const AGGRO_RANGE = 12, ATTACK_MAX = 10, MIN_RANGE = 4;

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

    updateEnemyProjectiles(delta) {
        if (!this.enemyProjectiles) return;
        const ds = delta / 1000;
        const time = this.time.now;

        for (let i = this.enemyProjectiles.length - 1; i >= 0; i--) {
            const p = this.enemyProjectiles[i];
            p.gfx.x += p.vx * ds;
            p.gfx.y += p.vy * ds;

            // Frost trail
            const trail = this.add.rectangle(p.gfx.x, p.gfx.y, 3, 3, 0xff4400, 0.4).setDepth(1.5);
            this.tweens.add({ targets: trail, alpha: 0, duration: 200, onComplete: () => trail.destroy() });

            // Wall collision
            const tx = Math.floor(p.gfx.x / this.TILE_SIZE);
            const ty = Math.floor(p.gfx.y / this.TILE_SIZE);
            const oob = tx < 0 || tx >= this.WORLD_WIDTH || ty < 0 || ty >= this.WORLD_HEIGHT;
            if (oob || this.world[tx][ty] === this.WALL || this.world[tx][ty] === this.NOTHING) {
                this._destroyEnemyProjectile(p);
                this.enemyProjectiles.splice(i, 1);
                continue;
            }

            // Player hit
            const ppx = this.playerX * this.TILE_SIZE + this.TILE_SIZE / 2;
            const ppy = this.playerY * this.TILE_SIZE + this.TILE_SIZE / 2;
            const dist = Math.hypot(p.gfx.x - ppx, p.gfx.y - ppy);
            if (dist < this.TILE_SIZE * 0.7) {
                if (time - this.lastPlayerDamageTime >= this.playerDamageCooldown) {
                    this.takeDamage(p.damage);
                    this.lastPlayerDamageTime = time;
                }
                this._destroyEnemyProjectile(p);
                this.enemyProjectiles.splice(i, 1);
                continue;
            }

            // Max range (16 tiles)
            const startX = p.startX ?? p.gfx.x, startY = p.startY ?? p.gfx.y;
            if (Math.hypot(p.gfx.x - startX, p.gfx.y - startY) > 16 * this.TILE_SIZE) {
                this._destroyEnemyProjectile(p);
                this.enemyProjectiles.splice(i, 1);
            }
        }
    }

    _destroyEnemyProjectile(p) {
        if (p.gfx && p.gfx.active) {
            const x = p.gfx.x, y = p.gfx.y;
            p.gfx.destroy();
            const burst = this.add.circle(x, y, 5, 0xff4400, 0.8).setDepth(3);
            this.tweens.add({ targets: burst, radius: 12, alpha: 0, duration: 180, onComplete: () => burst.destroy() });
        }
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