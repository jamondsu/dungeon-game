// ═══════════════════════════════════════════════════════════════════════════
// Spitter.js — the Spitter ('isRanged' in the code; its 'sniper' names are older than the Sniper): it keeps its
// distance, a beam locks on for a beat, then it spits.
// GameScene borrows each method, so `this` in them is the scene.
// ═══════════════════════════════════════════════════════════════════════════

class Spitter {

    // ─── RANGED ENEMY CREATION ────────────────────────────────────────────────
    // Moved here from TutorialManager — this is generic enemy infrastructure
    // used by both the tutorial and Level 2, so it lives in EnemyManager.

    createRangedEnemy(x, y, tutorialRoomIndex) {
        const enemy = this.createEnemy(x, y, 30);
        enemy.tutorialRoomIndex = tutorialRoomIndex;
        // Body colour, not just the crosshair above it. A small icon is unreadable in a
        // crowded room -- you are tracking a dozen sprites, not studying one. Every type
        // should be identifiable from its BODY at a glance, with the mark as confirmation.
        SlimeModels.wear(this, enemy.sprite, 'ranged');   // the Spitter's own body
        enemy.isRanged = true;
        enemy.rangedState = 'idle';

        // Yellow crosshair mark to distinguish from melee
        const mark = this.add.graphics().setDepth(2);
        mark.lineStyle(2, 0xffee00, 0.9);
        mark.strokeCircle(0, 0, 7);
        mark.beginPath(); mark.moveTo(-10, 0); mark.lineTo(10, 0); mark.strokePath();
        mark.beginPath(); mark.moveTo(0, -10); mark.lineTo(0, 10); mark.strokePath();
        mark.x = enemy.sprite.x; mark.y = enemy.sprite.y - 16;
        this.tweens.add({ targets: mark, scaleX: 1.2, scaleY: 1.2, duration: 500, yoyo: true, repeat: -1 });
        enemy._rangedMark = mark;

        return enemy;
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
        // The same slows every other enemy walks under (moveEnemies): they skipped all of them,
        // so a cubed or soaked sniper repositioned at full pace.
        const slow = Math.max(enemy.isSlowed ? (enemy._slowMult ?? 1.0) : 0, enemy.isWet ? 1.0 : 0);
        let delay = (enemy.moveDelay || 1000) * (1 + slow);
        if ((enemy._csHexUntil || 0) > time) delay /= 0.6;   // Cosmic.js: Hexed
        if ((enemy._cheerUntil || 0) > time) delay /= enemy._cheerSpd;   // encouraged by a Cheerleader
        if ((enemy._discUntil || 0) > time) delay /= enemy._discSpd;   // discouraged: she's dead
        if (time - (enemy.lastMoveTime || 0) < delay) return;
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
                const _byo = enemy._hpBarYOff || 0;
                if (enemy.healthBarBg)  { enemy.healthBarBg.x  = enemy.sprite.x; enemy.healthBarBg.y  = enemy.sprite.y + _byo; }
                if (enemy.healthBarFill){ enemy.healthBarFill.x = enemy.sprite.x; enemy.healthBarFill.y = enemy.sprite.y + _byo; }
                if (enemy._rangedMark?.active) { enemy._rangedMark.x = enemy.sprite.x; enemy._rangedMark.y = enemy.sprite.y - 22; }
            }
        });
    }

    updateRangedEnemies(time) {
        for (const enemy of this.enemies) {
            if (!enemy.isRanged || !enemy.sprite || !enemy.sprite.active) continue;
            if (enemy.isFrozen || enemy.isStunned) continue;

            // Room gating
            if (this._roomGated()) {
                if ((enemy.tutorialRoomIndex ?? -1) !== this.getCurrentPlayerRoom()) continue;
            }
            // pulled by an ally: it keeps off it, aims at it and spits at it (CombatSystem._tauntBegin, as in moveEnemies)
            const _taunt = this._tauntBegin?.(enemy);
            try {

            // Track splitter mark position
            if (enemy._splitterMark?.active) { enemy._splitterMark.x = enemy.sprite.x; enemy._splitterMark.y = enemy.sprite.y - 20; }
            if (enemy._sniperMark?.active)   { enemy._sniperMark.x   = enemy.sprite.x; enemy._sniperMark.y   = enemy.sprite.y - 20; }

            if (enemy._anchorBuffUntil && enemy._anchorBuffUntil < time) this._anchorBuffEnd(enemy);

            // TD sniper enemies (_tdType set only by TowerDefenseScene) can spawn or drift
            // much farther from the base than dungeon rooms ever allowed, so they get an
            // uncapped aggro range — otherwise they fail this gate entirely and never even
            // attempt to path toward the base. Dungeon-mode enemies never have _tdType set,
            // so this is a no-op outside the TD scene.
            const AGGRO_RANGE = enemy._tdType === 'sniper' ? Infinity : (this._enemyActivationRange ?? 12), ATTACK_MAX = 10, MIN_RANGE = 4;
            const dist = Math.abs(enemy.x - this.playerX) + Math.abs(enemy.y - this.playerY);

            if (!enemy.rangedState) enemy.rangedState = 'idle';

            // Electrical ranged enemies are 3× faster
            const prefireDur = (enemy.isElectrical ? 4000 / 3 : 4000) / this._atkSpd(enemy, time);
            const cooldownDur = (enemy.isElectrical ? 3000 / 3 : 3000) / this._atkSpd(enemy, time);
            const shotGap = enemy.isElectrical ? 220 / 3 : 220;

            // ── MOVEMENT during idle/cooldown only ────────────────────────
            const canMove = !enemy._planted && (enemy.rangedState === 'idle' || enemy.rangedState === 'cooldown');
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
                        const ex = enemy.sprite.x, ey = enemy.sprite.y + 12 * Math.abs(enemy.sprite.scaleY || 1);   // from its mouth: the body fills the bottom of its frame
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
            } finally { this._tauntEnd?.(_taunt); }
        }
    }

    _spawnPrefireBeam(enemy) {
        this._destroyPrefireBeam(enemy); // safety clear
        Sfx.play(this, 'laser_charge');
        EnemyManager.playAtk(this, enemy.sprite, Math.max(300, (enemy.prefireEnd || 0) - (enemy.prefireStart || 0)), (this.player?.x ?? enemy.sprite.x) < enemy.sprite.x, 'aim_');   // its cheeks filling
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
        const ex = enemy.sprite.x, ey = enemy.sprite.y + 12 * Math.abs(enemy.sprite.scaleY || 1);   // from its mouth: the body fills the bottom of its frame
        const { x: ndx, y: ndy } = enemy.lockedDir;
        const beamLen = 14 * this.TILE_SIZE;
        if (this._bfxOn) {   // Bosses.js: the line its shots fly, stopping where a wall stops them
            BossFX.sight(this, enemy._prefireBeam, ex, ey, ndx, ndy, beamLen, true, enemy);
            if (enemy._prefireWarning?.active) {
                enemy._prefireWarning.x = ex; enemy._prefireWarning.y = enemy.sprite.y - 36;
                enemy._prefireWarning.setColor('#ff0000');
            }
            return;
        }
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

        const ex = enemy.sprite.x, ey = enemy.sprite.y + 12 * Math.abs(enemy.sprite.scaleY || 1);   // from its mouth: the body fills the bottom of its frame
        const px = this.playerX * this.TILE_SIZE + this.TILE_SIZE / 2;
        const py = this.playerY * this.TILE_SIZE + this.TILE_SIZE / 2;
        const dx = px - ex, dy = py - ey;
        const len = Math.sqrt(dx * dx + dy * dy) || 1;
        const ndx = dx / len, ndy = dy / len;

        const beamLen = 14 * this.TILE_SIZE;
        if (this._bfxOn) { BossFX.sight(this, enemy._prefireBeam, ex, ey, ndx, ndy, beamLen, false, enemy); return; }
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
        enemy.sprite?._atkTw?.stop();   // (its wind-up ends with it)
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
        const ex = enemy.sprite.x, ey = enemy.sprite.y + 12 * Math.abs(enemy.sprite.scaleY || 1);   // from its mouth: the body fills the bottom of its frame

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

        // a glob of acid (EnemyFX: typed, pointing the nearest of eight ways); its wake, light and splash are the green ones (Bosses.js 'vine')
        const angle = Math.atan2(fdy, fdx);
        const g = EnemyFX.shot(this, 'spit', ex, ey, angle, 2.5);
        EnemyManager.playAtk(this, enemy.sprite, 180, fdx < 0, 'spit_');

        const SPEED = 420;
        this.enemyProjectiles.push({ src: enemy,
            gfx: g, _bfxKind: 'vine',
            vx: fdx * SPEED,
            vy: fdy * SPEED,
            damage: 8,
            startX: ex,
            startY: ey,
        });

        BossFX.muzzle(this, 'vine', ex, ey, angle);   // a flash of its green at its mouth
    }

}
