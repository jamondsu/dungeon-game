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
        if (typeof CreatureFX !== 'undefined') CreatureFX.keepTint(sprite);   // Creatures.js: a tint that survives hits

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

        // Floor scaling lands here, at the one place every enemy is born, so every


        // derived creator (berserker, mortar, the Cistern roster) inherits it.


        const baseHealth = Math.round((arguments[2] ?? 150) * (this.enemyHealthScale || 1));
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

            // LIGHTNING: amped
            isSuperConducted: false,
            superConductUntil: 0,
            superConductVisual: null,

            // FIRE: combustion
            combustionTriggered: false,

            // COSMIC MARKS
            cosmicMarks: 0,
            cosmicMarkVisuals: null
        };

        enemy._spawned = !!this._levelLive && !this._towerSpawning;   // summoned mid-fight (a queen's brood, a split, a bud): no glorps or potions off it
        this.enemies.push(enemy);
        this._vfxSpawn?.(enemy);   // Visuals.js (not for the ones a level starts with)
        if (typeof CreatureFX !== 'undefined') CreatureFX.face(this, sprite, { mood: 'angry' });   // Creatures.js: eyes
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
        enemy.healthBarFill.width = maxWidth * Phaser.Math.Clamp(healthPercent || 0, 0, 1);   // (overheal is drawn over it: Visuals' bars)

        const _byo = enemy._hpBarYOff || 0;
        enemy.healthBarBg.x = enemy.sprite.x;
        enemy.healthBarBg.y = enemy.sprite.y + _byo;

        enemy.healthBarFill.x = enemy.sprite.x;
        enemy.healthBarFill.y = enemy.sprite.y + _byo;

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

    // Name is legacy from the removed lightning-node system — now checks engineer
    // towers instead, but kept as isNodeAt() since multiple callers depend on it.
    isNodeAt(x, y) {
        return (this.engineerTowers || []).some(t => t.tileX === x && t.tileY === y && t.active);
    }

    findPathBFS(startX, startY, targetX, targetY) {
        const path = this._bfsRun(startX, startY, targetX, targetY, true);
        // Fall back to ignoring enemies if they're blocking the only route
        return path || this._bfsRun(startX, startY, targetX, targetY, false);
    }

    // A breadth-first path from start to target over floor tiles (start and target included), or null. Flat typed
    // arrays reused between calls (a stamp marks this call's visits, so nothing is cleared), and the enemies' tiles
    // gathered once: with a room full of enemies the old per-tile enemy scan made every step of every enemy crawl.
    _bfsRun(startX, startY, targetX, targetY, avoidEnemies) {
        if (startX === targetX && startY === targetY) return null;
        const W = this.WORLD_WIDTH, H = this.WORLD_HEIGHT, N = W * H;
        let B = this._bfsBuf;
        if (!B || B.n !== N) B = this._bfsBuf = { n: N, seen: new Uint32Array(N), parent: new Int32Array(N), queue: new Int32Array(N), stamp: 0 };
        if (++B.stamp >= 0xffffffff) { B.seen.fill(0); B.stamp = 1; }
        const seen = B.seen, parent = B.parent, queue = B.queue, stamp = B.stamp, world = this.world, FLOOR = this.FLOOR;
        const blocked = new Set();
        for (const t of this.engineerTowers || []) if (t.active) blocked.add(t.tileX * H + t.tileY);
        if (avoidEnemies) for (const e of this.enemies) blocked.add(e.x * H + e.y);
        const start = startX * H + startY, target = targetX * H + targetY;
        let head = 0, tail = 0;
        queue[tail++] = start; seen[start] = stamp; parent[start] = -1;
        while (head < tail) {
            const cur = queue[head++], cx = (cur / H) | 0, cy = cur - cx * H;
            if (cur === target) {
                const path = [];
                for (let k = cur; k !== -1; k = parent[k]) path.push({ x: (k / H) | 0, y: k % H });
                return path.reverse();
            }
            // Explore neighbours in an order biased toward the target, so equal-length paths staircase diagonally
            // toward it instead of hugging one axis then turning: the axis with more distance left first, then the
            // other toward-target step, then the two away-from-target steps.
            const dxT = targetX - cx, dyT = targetY - cy, sx = Math.sign(dxT || 1), sy = Math.sign(dyT || 1);
            const ax = Math.abs(dxT), ay = Math.abs(dyT);
            const first = ay > ax ? 1 : 0;   // (a stable sort by -k: x then y when they tie)
            for (let n = 0; n < 4; n++) {
                const which = n < 2 ? (n === 0 ? first : 1 - first) : n;   // 0: toward on x, 1: toward on y, 2: away on x, 3: away on y
                const nx = which === 0 ? cx + sx : which === 1 ? cx : which === 2 ? cx - sx : cx;
                const ny = which === 0 ? cy : which === 1 ? cy + sy : which === 2 ? cy : cy - sy;
                if (nx < 0 || nx >= W || ny < 0 || ny >= H) continue;
                const k = nx * H + ny;
                if (seen[k] === stamp || world[nx][ny] !== FLOOR) continue;
                if (blocked.has(k) && k !== target && (avoidEnemies || this.isNodeAt(nx, ny))) continue;   // (your tile is always open)
                seen[k] = stamp; parent[k] = cur; queue[tail++] = k;
            }
        }
        return null;
    }

    reconstructPath(parent, startX, startY, targetX, targetY) {   // (the old string-keyed BFS's; kept for its proxy)
        const path = [];
        let current = { x: targetX, y: targetY };
        while (current) { path.unshift(current); current = parent.get(`${current.x},${current.y}`); }
        return path;
    }

    _anchorBuffEnd(enemy) {
        enemy._anchorBuffUntil = 0; enemy._anchorSpeedMult = 1;
        if (enemy.sprite?.active && !enemy.isFrozen && typeof enemy.sprite.clearTint === 'function') enemy.sprite.clearTint();
        if (enemy._speedIndTimer) { enemy._speedIndTimer.remove(); enemy._speedIndTimer = null; }
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

        // an Anchor's slow on you wears off a pulse and a half after its last one caught you (it only ever did in the Fracture)
        if (this._anchorSlowUntil && currentTime > this._anchorSlowUntil) {
            this._anchorSlowUntil = 0;
            if (this.moveCooldown > 200 && !this._singularitySlowed) this.moveCooldown = 200;
            if (this._playerSlowIndTimer && !this._singularitySlowed) { this._playerSlowIndTimer.remove(); this._playerSlowIndTimer = null; }
        }

        for (let enemy of this.enemies) {
            // Taunt (CombatSystem._tauntBegin): when an ally is pulling this enemy, the ally is its
            // "player" for this turn (where it heads, what it attacks) and the hits it lands go to
            // the ally. Undone in the finally below, whichever of the turn's many `continue`s it
            // leaves by. The body keeps its old indentation.
            const _taunt = this._tauntBegin?.(enemy);
            try {
            // ── Lightning elemental: periodic arc attack ─────────────────────
            if (enemy._arcs && !enemy.isFrozen && !enemy.isStunned) {
                // Keep range ring centered on enemy
                if (enemy._arcRangeRing?.active) {
                    enemy._arcRangeRing.x = enemy.sprite.x;
                    enemy._arcRangeRing.y = enemy.sprite.y;
                }
                if (currentTime - (enemy._lastArcTime || 0) >= (enemy._arcCooldown || 2500) / this._atkSpd(enemy, currentTime)) {
                    enemy._lastArcTime = currentTime;
                    const dist = Math.hypot(this.playerX - enemy.x, this.playerY - enemy.y);   // round, as its ring shows
                    // not through a wall, and not out of a room you haven't come into (it zapped you in the doorway of the Void Rift's boss room)
                    const sameRoom = !this._roomGated() || enemy.tutorialRoomIndex === undefined || enemy.tutorialRoomIndex === this.getCurrentPlayerRoom();
                    if (dist <= 5 && this.player?.active && sameRoom && this._clearShot(enemy.x, enemy.y, this.playerX, this.playerY)) {
                        // Arc toward player
                        this.drawLightningBolt({ sprite: enemy.sprite }, { sprite: this.player });
                        this._hitBy = enemy; this.takeDamage(8 * (this.enemyDamageScale || 1)); this._hitBy = null;
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
                    if (bdist <= 3 && currentTime - (enemy._berserkerLastSwing || 0) >= (enemy._berserkerCooldown || 3200) / this._atkSpd(enemy, currentTime)) {
                        enemy._berserkerState = 'charging';
                        enemy._berserkerChargeStart = currentTime;
                        Sfx.play(this, 'tell', { ms: enemy._berserkerChargeDur || 600 });
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
                    if (inRange && currentTime - (enemy._singLastAtk || 0) >= (enemy._singCooldown || 2800) / this._atkSpd(enemy, currentTime)) {
                        enemy._singState = 'charging';
                        enemy._singChargeStart = currentTime;
                        Sfx.play(this, 'tell', { ms: enemy._singChargeDur || 700 });
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
                        Sfx.play(this, 'slam', { small: true });
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
                                    this._hitBy = enemy; this.takeDamage(4 * (this.enemyDamageScale || 1)); this._hitBy = null;
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
                if (this._roomGated()) {
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
                    // Watchdog. The exit below is a chain of tweens and delayed calls; if any
                    // link is interrupted (sprite deactivated, tween killed, scene restarted)
                    // _sniperExiting stays true and this sniper sits invisible forever -- and
                    // since phased snipers are now damage-immune, permanently invulnerable too.
                    if (enemy._sniperExiting && currentTime - (enemy._sniperExitStarted || 0) > 5000) {
                        enemy._sniperExiting = false;
                        enemy._nextDimensionExit = currentTime + 500;
                    }
                    if (currentTime < (enemy._nextDimensionExit || 0)) continue;
                    if (enemy._sniperExiting) continue;
                    enemy._sniperExiting = true;
                    enemy._sniperExitStarted = currentTime;

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
                    this.updateEnemyHealthBar(enemy);   // its bar where every bar sits (it was placed by hand, off by a few pixels and left there)
                    if (enemy._voidMark?.active)     { enemy._voidMark.x = wx; enemy._voidMark.y = wy - 22; }

                    // Open portal at new position
                    if (typeof this._spawnSniperPortal === 'function') this._spawnSniperPortal(enemy, wx, wy);

                    // 1500ms — portal opens, player has time to react before sniper pops out
                    this.time.delayedCall(1500, () => {
                        if (!enemy.sprite?.active) return;
                        enemy._inDimension = false;
                        enemy._sniperInvisible = false;
                        enemy._sniperVulnerable = true;
                        enemy._sniperExiting = false;   // the exit finished; it was only cleared
                                                        // on re-entry before, leaving the flag
                                                        // set for the whole visible window

                        enemy.sprite.setScale(0.1);
                        this.tweens.add({ targets: enemy.sprite, scaleX: enemy._baseScale ?? this.SLIME_SCALE, scaleY: enemy._baseScale ?? this.SLIME_SCALE, alpha: 0.92, duration: 220, ease: 'Back.easeOut' });
                        if (enemy._voidMark?.active) this.tweens.add({ targets: enemy._voidMark, alpha: 0.85, duration: 220 });
                        if (enemy.healthBarBg?.active)   this.tweens.add({ targets: enemy.healthBarBg,   alpha: 0.8,  duration: 220 });
                        if (enemy.healthBarFill?.active) this.tweens.add({ targets: enemy.healthBarFill, alpha: 1.0,  duration: 220 });
                        this.updateEnemyHealthBar(enemy);
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
                                        if (enemy._chillBar?.active) enemy._chillBar.setAlpha(0);
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
                if (typeof this._clearStunIndicator === 'function') this._clearStunIndicator(enemy);
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
                // A cube's 2.2 stayed behind, so every later plain slow (1.0) was a 3.2x slow.
                enemy._slowMult = undefined;
                if (enemy._slowIndTimer) { enemy._slowIndTimer.remove(); enemy._slowIndTimer = null; }
            }
            // Wet enemies move at half speed (isWet set by _shatterWaterSplash)
            if (enemy.isWet && currentTime >= enemy.wetUntil) {
                enemy.isWet = false;
            }

            const isActuallySlowed = enemy.isSlowed || enemy.isWet;
            // _slowMult represents slow strength (0.20 = 20% slower, 0.70 = 70% slower).
            // Default to 1.0 (full 2× stop) for legacy callers that never set _slowMult.
            // The stronger of the two: a nearly spent slow (an EMP decaying toward 0) used to
            // replace being wet instead of adding to the choice.
            const slowStrength = Math.max(enemy.isSlowed ? (enemy._slowMult??1.0) : 0, enemy.isWet ? 1.0 : 0);
            let moveCooldown = isActuallySlowed ? Math.round(this.enemyMoveCooldown * (1+slowStrength)) : this.enemyMoveCooldown;
            // Generic per-enemy speed multiplier (<1 = faster). Every special case below
            // hard-codes its own constant against its own flag; this is the same idea
            // without needing a new flag and a new line each time. Used by the queen's brood.
            if (enemy._moveCdMult) moveCooldown = Math.round(moveCooldown * enemy._moveCdMult);
            if (enemy._anchorBuffUntil && enemy._anchorBuffUntil < currentTime) this._anchorBuffEnd(enemy);   // an Anchor's push wears off (walkers included)
            // Standing in water slows anything that is not native to it. This is what makes
            // water a TOOL rather than only a hazard -- the ice ult's puddles, and the
            // flooded level's terrain, both bog down an ordinary enemy. Creatures that
            // belong in the water (_waterNative) wade through it unaffected.
            if (!enemy._waterNative && typeof this.isWaterAt === 'function'
                && this.isWaterAt(enemy.x, enemy.y)) {
                moveCooldown = Math.round(moveCooldown * 1.25);
            }
            if (enemy.isElectrical) moveCooldown = Math.round(moveCooldown * 0.33); // 3× faster
            if (enemy._bomberSpeedMult) moveCooldown = Math.round(moveCooldown * enemy._bomberSpeedMult); // sapper rush
            if (enemy.isSingularitySlime) moveCooldown = Math.round(moveCooldown * 2); // goopy — 2× slower (and slows still count)
            if (enemy._anchorSpeedMult && enemy._anchorSpeedMult > 1) moveCooldown = Math.round(moveCooldown / enemy._anchorSpeedMult);
            if ((enemy._cheerUntil || 0) > currentTime) moveCooldown = Math.round(moveCooldown / enemy._cheerSpd);   // encouraged by a Cheerleader
            if ((enemy._discUntil || 0) > currentTime) moveCooldown = Math.round(moveCooldown / enemy._discSpd);   // discouraged: she's dead
            // Cloaked enemies (Wraith stealth) crawl — they trade speed for invincibility.
            // Applied after other multipliers so it stacks cleanly. _cloakSlowMult is set by
            // the cloak system (default ~2.2× slower); cleared the instant they're revealed.
            if (enemy._cloaked) moveCooldown = Math.round(moveCooldown * (enemy._cloakSlowMult || 2.2));
            // Splitter: smaller tiers move faster (tier 0=normal, tier 1=1.4×, tier 2=1.9×)
            if (enemy.isSplitter) {
                const splitterSpeedMult = [1.0, 1.4, 1.9][enemy._splitterTier ?? 0];
                moveCooldown = Math.round(moveCooldown / splitterSpeedMult);
            }

            // Hexed (Cosmic.js, Void Blade's Retribution): 40% slower
            if ((enemy._csHexUntil || 0) > currentTime) moveCooldown = Math.round(moveCooldown / 0.6);

            // a healer slime's heal, on its own clock (a second), not its slow steps' (it only came on a step: every 1.3-1.8s)
            if (enemy.isHealerTotem) {
                if (!enemy.isFrozen && currentTime - enemy._healerLastTick >= enemy._healerTickInterval) {
                    enemy._healerLastTick = currentTime;
                    if ((this._roomGated()) && (enemy.tutorialRoomIndex ?? -1) !== this.getCurrentPlayerRoom()) { continue; }
                    for (const ally of this.enemies) {
                        if (!ally.sprite?.active || ally === enemy) continue;
                        const adx = Math.abs(ally.x - enemy.x), ady = Math.abs(ally.y - enemy.y);
                        if (adx + ady > enemy._healerRange) continue;
                        // past full: up to three times its health (its bar: yellow over the red, green over the yellow; Visuals)
                        ally.health = Math.min(ally.maxHealth * 3, ally.health + ally.maxHealth * enemy._healerHealFrac);
                        this.updateEnemyHealthBar(ally);
                        // Green aura flash on healed enemy + plus sign above head
                        if (!ally._lastHealPuff4 || currentTime - ally._lastHealPuff4 > 500) {
                            ally._lastHealPuff4 = currentTime;
                            // Aura ring flash around enemy
                            const auraFlash = this.add.graphics().setDepth(3.0);
                            auraFlash.x = ally.sprite.x; auraFlash.y = ally.sprite.y;
                            auraFlash.lineStyle(2, 0x44ff88, 0.85);
                            auraFlash.strokeCircle(0, 0, 12);
                            auraFlash.fillStyle(0x44ff88, 0.18);
                            auraFlash.fillCircle(0, 0, 12);
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
            }

            if (currentTime - enemy.lastMoveTime < moveCooldown) {
                continue;
            }

            // Ranged enemies are handled entirely by updateRangedEnemies — skip here
            if (enemy.isRanged) continue;

            // ── Level 4: Mortar — stationary, lobs rocks over walls ─────────
            if (enemy.isMortar) {
                if (enemy._mortarGfx?.active)    { enemy._mortarGfx.x = enemy.sprite.x; enemy._mortarGfx.y = enemy.sprite.y; }
                if (enemy._mortarSafeRing?.active){ enemy._mortarSafeRing.x = enemy.sprite.x; enemy._mortarSafeRing.y = enemy.sprite.y; VisualFX.clipAura(this, enemy._mortarSafeRing); }
                if (!enemy.isFrozen && !enemy.isStunned) {
                    // Was hardcoded to isLevel4, so on any other room-gated level a mortar
                    // shelled you from across the map the moment the level loaded.
                    if (this._roomGated()) {
                        if ((enemy.tutorialRoomIndex ?? -1) !== this.getCurrentPlayerRoom()) continue;
                    }
                    const mdx = this.playerX - enemy.x, mdy = this.playerY - enemy.y;
                    const mdist = Math.abs(mdx) + Math.abs(mdy), mround = Math.hypot(mdx, mdy);   // its reach in steps; its safe zone round, like its glow
                    // A mortar lobs over the walls of ITS room; it is not artillery. Without
                    // an upper bound the only thing limiting range was the room gate above.
                    const mmax = enemy._mortarMaxRange ?? 13;
                    if (mround > enemy._mortarSafeRadius && mdist <= mmax
                        && currentTime - enemy._mortarLastFire >= enemy._mortarCooldown / this._atkSpd(enemy, currentTime)) {
                        enemy._mortarLastFire = currentTime;
                        this._fireMortarShot(enemy);
                    }
                }
                continue;
            }

            // ── Level 4: Healer Totem — stationary, heals nearby enemies ────
            if (enemy.isHealerTotem) {
                if (enemy._healerAura?.active) { enemy._healerAura.x = enemy.sprite.x; enemy._healerAura.y = enemy.sprite.y; VisualFX.clipAura(this, enemy._healerAura); }
                if (enemy._totemGfx?.active)   { enemy._totemGfx.x  = enemy.sprite.x; enemy._totemGfx.y  = enemy.sprite.y; }
                if (enemy._orbGlow?.active)    { enemy._orbGlow.x   = enemy.sprite.x; enemy._orbGlow.y   = enemy.sprite.y - 17; }
                if (!enemy._mobile) continue;   // a fixed totem stays put; the healer slime walks on
            }

            // ── Level 4: Anchor Slime — stationary, buffs enemies + slows player
            if (enemy.isAnchor) {
                if (enemy._anchorRing?.active)     { enemy._anchorRing.x = enemy.sprite.x; enemy._anchorRing.y = enemy.sprite.y; VisualFX.clipAura(this, enemy._anchorRing); }
                if (enemy._anchorBodyGfx?.active)  { enemy._anchorBodyGfx.x = enemy.sprite.x; enemy._anchorBodyGfx.y = enemy.sprite.y; }
                if (!enemy.isFrozen && currentTime - enemy._anchorLastPulse >= enemy._anchorPulseInterval) {
                    enemy._anchorLastPulse = currentTime;
                    if ((this._roomGated()) && (enemy.tutorialRoomIndex ?? -1) !== this.getCurrentPlayerRoom()) { continue; }
                    Sfx.play(this, 'pulse');
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
                    VisualFX.ripple(this, enemy.sprite.x, enemy.sprite.y, 12, enemy._anchorRange * this.TILE_SIZE * 1.1, 0x4499cc, { duration: 900 });
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
                if (!enemy._mobile) continue;   // a fixed anchor stays put; the anchor slime walks on
            }

            // ── Level 4: Rooter — pull tendril (far) / ground thump (close) ──
            if (enemy.isRooter && !enemy.isFrozen && !enemy.isStunned) {
                if (enemy._rooterMark?.active) { enemy._rooterMark.x = enemy.sprite.x; enemy._rooterMark.y = enemy.sprite.y - 16; }
                if ((this._roomGated()) && (enemy.tutorialRoomIndex ?? -1) !== this.getCurrentPlayerRoom()) { /* dormant */ }
                else {
                    const rdx = Math.abs(this.playerX - enemy.x), rdy = Math.abs(this.playerY - enemy.y);
                    const rdist = rdx + rdy;
                    if (rdist <= (enemy._thumpRange || 3)) {
                        // CLOSE — ground thump every 2s
                        if (currentTime - (enemy._thumpLastFire || 0) >= (enemy._thumpCooldown || 2000) / this._atkSpd(enemy, currentTime)) {
                            enemy._thumpLastFire = currentTime;
                            this._rooterGroundThump(enemy);
                        }
                    } else if (rdist <= (enemy._tendrilRange || 12)) {
                        // FAR — pull tendril
                        if (currentTime - (enemy._tendrilLastFire || 0) >= (enemy._tendrilCooldown || 4000) / this._atkSpd(enemy, currentTime)) {
                            enemy._tendrilLastFire = currentTime;
                            this._fireRootTendril(enemy);
                        }
                    }
                }
            }


            // _enemyTargetX/Y and _enemyActivationRange can be overridden by other scenes
            // (e.g. TowerDefenseScene sets these to the base tile and a large range)
            const _etx = enemy._goalX ?? this._enemyTargetX ?? this.playerX;   // (_goalX: a tile of its own to go to, not you: a Cheerleader)
            const _ety = enemy._goalY ?? this._enemyTargetY ?? this.playerY;
            const dist = Math.abs(enemy.x - _etx) + Math.abs(enemy.y - _ety);

            // Room gating for tutorial, level 2, level 3, and level 4
            if (this._roomGated()) {
                const enemyRoom = enemy.tutorialRoomIndex ?? -1;
                if (enemyRoom !== this.getCurrentPlayerRoom()) continue;
            }

            if (dist < (this._enemyActivationRange ?? 20)) {
                let nextStep = null;

                // --- COMMITTED PATH LOGIC ---
                // Peek at the next step WITHOUT advancing the index yet.
                // Only advance once we know the tile is actually passable.
                // This avoids the rollback problem entirely.
                const pathStillValid =
                    enemy._committedPath &&
                    enemy._pathStepsLeft > 0 &&
                    enemy._pathIndex !== undefined &&
                    enemy._pathIndex + 1 < enemy._committedPath.length &&
                    // The committed path was built for a specific target; if the target has
                    // changed (e.g. lane bow → base after merging), the old path can walk into
                    // a side pocket. Discard it and replan to the current target.
                    enemy._committedTX === _etx && enemy._committedTY === _ety;

                if (pathStillValid) {
                    const candidate = enemy._committedPath[enemy._pathIndex + 1];
                    const isPlayerTile = candidate.x === _etx && candidate.y === _ety;
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
                    const path = this.findPathBFS(enemy.x, enemy.y, _etx, _ety);
                    if (path && path.length > 1) {
                        const commitSteps = Math.min(2, path.length - 1);
                        enemy._committedPath = path;
                        enemy._committedTX = _etx; enemy._committedTY = _ety;
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
                if (enemy._goalX == null && nextStep.x === _etx && nextStep.y === _ety) {
                    this.enemyAttackAnimation(enemy, _etx, _ety);   // every one swings (two side by side used to: one swung, the other froze in your hit cooldown)
                    if (currentTime - this.lastPlayerDamageTime >= this.playerDamageCooldown) {
                        this._hitBy = enemy; this._hitMelee = true;   // who it was (the Frost Shield chills them back), and up close (thorns answer it)
                        this.takeDamage(enemy._meleeDmg || 1);   // most slimes hit for 1; a Frostborn far harder
                        if (enemy._isHunter) this._hunterReset(enemy);
                        this._hitBy = null; this._hitMelee = false;
                        this.lastPlayerDamageTime = currentTime;
                    }
                    enemy.lastMoveTime = currentTime - moveCooldown * (1 - 1 / this._atkSpd(enemy, currentTime));   // its next hit comes sooner when it attacks faster
                    enemy._committedPath = null;
                    enemy._pathIndex = undefined;
                    continue;
                }

                // Final occupied check for the fresh-BFS case (pathStillValid already handles its own)
                if (this.getEnemyAt(nextStep.x, nextStep.y) || this._tauntBlocks?.(nextStep.x, nextStep.y)   // a taunted enemy still can't walk onto you
                    || (enemy._goalX != null && nextStep.x === this.playerX && nextStep.y === this.playerY)) {   // nor one going somewhere of its own
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
                    // a soft hop: about a third of its step, easing in and out, its squash riding it (160ms at a constant speed snapped
                    // tile to tile); never longer than the step, so a fast one doesn't overlap its own next move
                    const tweenDur = Math.min(moveCooldown * 0.9, isActuallySlowed ? 480 : 320);
                    if (!enemy._attackAnimPlaying) this._vfxHop?.(enemy.sprite, enemy._baseScale ?? this.SLIME_SCALE, tweenDur);
                    this.tweens.add({
                        targets: enemy.sprite,
                        x: targetX,
                        y: targetY,
                        duration: tweenDur,
                        ease: 'Sine.easeInOut',
                        onUpdate: () => {
                            // Sync health bars and marks
                            if (enemy.healthBarBg) {
                                enemy.healthBarBg.x = enemy.sprite.x;
                                enemy.healthBarBg.y = enemy.sprite.y + (enemy._hpBarYOff || 0);
                            }
                            if (enemy.healthBarFill) {
                                enemy.healthBarFill.x = enemy.sprite.x;
                                enemy.healthBarFill.y = enemy.sprite.y + (enemy._hpBarYOff || 0);
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
                                enemy._fireMark.y = enemy.sprite.y - 16;
                            }
                            if (enemy._iceMark && enemy._iceMark.active) {
                                enemy._iceMark.x = enemy.sprite.x;
                                enemy._iceMark.y = enemy.sprite.y - 16;
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
            } finally { this._tauntEnd?.(_taunt); }
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
        Sfx.play(this, 'swing', { soft: true });

        // Snapshot home position at the moment of attack — not recalculated mid-tween
        const homeX = enemy.sprite.x;
        const homeY = enemy.sprite.y;
        const dirX = targetX - enemy.x;
        const dirY = targetY - enemy.y;
        const len = Math.sqrt(dirX * dirX + dirY * dirY) || 1;
        const lungeX = homeX + (dirX / len) * this.TILE_SIZE * 0.42;
        const lungeY = homeY + (dirY / len) * this.TILE_SIZE * 0.42;

        enemy._attackAnimPlaying = true;
        const B = enemy._baseScale ?? this.SLIME_SCALE;   // its own size (a big Splitter's, not a slime's)

        // 1. Wind-up squish (compress toward direction)
        this.tweens.add({
            targets: enemy.sprite,
            scaleX: B * 0.75, scaleY: B * 1.3,
            duration: 60, ease: 'Quad.easeOut',
            onComplete: () => {
                if (!enemy.sprite?.active) { enemy._attackAnimPlaying = false; return; }
                // 2. Lunge forward
                this.tweens.add({
                    targets: enemy.sprite,
                    x: lungeX, y: lungeY,
                    scaleX: B * 1.2, scaleY: B * 0.8,
                    duration: 80, ease: 'Quad.easeOut',
                    onComplete: () => {
                        if (!enemy.sprite?.active) { enemy._attackAnimPlaying = false; return; }
                        // 3. Snap back to home with overshoot
                        this.tweens.add({
                            targets: enemy.sprite,
                            x: homeX, y: homeY,
                            scaleX: B * 0.9, scaleY: B * 1.1,
                            duration: 90, ease: 'Back.easeOut',
                            onComplete: () => {
                                if (!enemy.sprite?.active) { enemy._attackAnimPlaying = false; return; }
                                // 4. Settle to normal scale
                                this.tweens.add({
                                    targets: enemy.sprite,
                                    scaleX: B, scaleY: B,
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
        // Body colour, not just the crosshair above it. A small icon is unreadable in a
        // crowded room -- you are tracking a dozen sprites, not studying one. Every type
        // should be identifiable from its BODY at a glance, with the mark as confirmation.
        // Pale yellow to match its own crosshair.
        if (typeof enemy.sprite.setTint === 'function') enemy.sprite.setTint(0xffee88);
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
        Sfx.play(this, 'swing');
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
                // a slash, not a pie: a crescent band swept behind the blade, hot at its leading edge and cooling
                // behind it, thicker in the middle of the swing, a bright edge on the blade itself
                arcGfx.clear();
                const R0 = RANGE * 0.5, ring = (r, a0, a1, n) => Array.from({ length: n + 1 }, (_, k) => { const a = a0 + (a1 - a0) * k / n; return { x: Math.cos(a) * r, y: Math.sin(a) * r }; });
                const band = (from, rIn, rOut, col, alpha) => {   // a smooth crescent over the newest (1 - from) of the sweep
                    const a0 = startAngle + (curEnd - startAngle) * from;
                    arcGfx.fillStyle(col, alpha); arcGfx.fillPoints([...ring(rOut, a0, curEnd, 14), ...ring(rIn, curEnd, a0, 14)], true);
                };
                band(0, R0, RANGE + 4, 0xff2a10, 0.28);
                band(0.4, R0 + RANGE * 0.08, RANGE + 2, 0xff7a20, 0.5);
                band(0.78, R0 + RANGE * 0.16, RANGE, 0xffd890, 0.8);
                arcGfx.lineStyle(2, 0xff3a10, 0.5); arcGfx.strokePoints(ring(RANGE + 4, startAngle, curEnd, 12), false);
                arcGfx.lineStyle(3, 0xfff4d0, 0.95);
                arcGfx.lineBetween(Math.cos(curEnd) * R0 * 0.8, Math.sin(curEnd) * R0 * 0.8, Math.cos(curEnd) * (RANGE + 6), Math.sin(curEnd) * (RANGE + 6));
                if (t >= 1) { swingTimer.remove(); this.tweens.add({ targets: arcGfx, alpha: 0, duration: 180, ease: 'Quad.easeIn', onComplete: () => arcGfx.destroy() }); }
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
            this._hitBy = enemy; this._hitMelee = true; this.takeDamage(SWING_DMG); this._hitBy = null; this._hitMelee = false;
            this.cameras.main.shake(60, 0.006);
            // Knockback 1 tile away
            const kbDX = Math.sign(this.playerX - enemy.x);
            const kbDY = Math.sign(this.playerY - enemy.y);
            const nx = this.playerX + kbDX, ny = this.playerY + kbDY;
            if (this.world[nx]?.[ny] === this.FLOOR && (this._iceShellUntil || 0) <= this.time.now) {   // (not through the ice ult's shell)
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
        }
    }

    _spawnPrefireBeam(enemy) {
        this._destroyPrefireBeam(enemy); // safety clear
        Sfx.play(this, 'laser_charge');
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
        this.enemyProjectiles.push({ src: enemy,
            gfx: this._bfxSwap ? this._bfxSwap(g, 'bolt', angle) : g,   // Bosses.js
            vx: fdx * SPEED,
            vy: fdy * SPEED,
            damage: 8,
            startX: ex,
            startY: ey,
        });

        // Muzzle flash
        if (this._bfxOn) BossFX.muzzle(this, 'bolt', ex, ey, angle);   // Bosses.js
        else {
            const flash = this.add.circle(ex, ey, 8, 0xff4400, 0.7).setDepth(3);
            this.tweens.add({ targets: flash, radius: 14, alpha: 0, duration: 140, onComplete: () => flash.destroy() });
        }
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
        if (this._bfxOn) { flash.setVisible(false); BossFX.muzzle(this, 'shard', ex, ey, baseAngle, true); }   // Bosses.js
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

            this.enemyProjectiles.push({ src: enemy, gfx: this._bfxSwap ? this._bfxSwap(g, 'shard', angle) : g, vx, vy, damage: DAMAGE, startX: ex, startY: ey, _isShotgunPellet: true, maxDist: MAX_DIST });
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

        this.enemyProjectiles.push({ src: enemy,
            gfx: this._bfxSwap ? this._bfxSwap(g, 'dart', angle) : g, vx: fdx * 380, vy: fdy * 380,   // Bosses.js
            damage: 10 * this.damageScaling,
            isRicochetArrow: true, ricochetLeft: 3,
            startX: ex, startY: ey,
        });
    }

    updateEnemyProjectiles(delta) {
        if (!this.enemyProjectiles) return;
        // Sound.js: a pew when the count grows (every enemy shot lands in this list)
        if (this.enemyProjectiles.length > (this._sfxShotN || 0)) Sfx.play(this, 'eshoot');
        this._sfxShotN = this.enemyProjectiles.length;
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
            if (p.isRopeTendril && p.gfx.active && this._bfxOn) {
                // Bosses.js: a vine with thorns and a clawed pod. Its graphics sits at the tip, so
                // whatever reads its position (its pop, its wake, its light) finds the tip, not 0,0.
                this._bfxDrawVine?.(p);
            } else if (p.isRopeTendril && p.gfx.active) {
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
            if (!p.isRopeTendril && !this._bfxOn) {
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
                    if (this._bfxOn) {   // Bosses.js: it points its new way; a spark in its colour
                        p.gfx.rotation = Math.atan2(p.vy, p.vx);
                        BossFX.pop(this, BossFX.kindOf(p), p.gfx.x, p.gfx.y, 2);
                        continue;
                    }
                    // Flash on bounce
                    const bf = this.add.circle(p.gfx.x, p.gfx.y, 6, 0xffdd00, 0.7).setDepth(3);
                    this.tweens.add({ targets: bf, radius: 12, alpha: 0, duration: 120, onComplete: () => bf.destroy() });
                    continue;
                }
                this._destroyEnemyProjectile(p);
                this.enemyProjectiles.splice(i, 1);
                continue;
            }

            // Engineer tower hit — checked before player hit, so a projectile that
            // would otherwise hit the player can be intercepted by a tower standing
            // in its path. Melee enemies never target towers; this is the only way
            // towers take damage.
            if (this.engineerTowers?.length) {
                const checkTowerX = p.isRopeTendril ? p._tipX : p.gfx.x;
                const checkTowerY = p.isRopeTendril ? p._tipY : p.gfx.y;
                let towerHit = null;
                for (const tower of this.engineerTowers) {
                    if (!tower.active) continue;
                    if (Math.hypot(checkTowerX - tower.px, checkTowerY - tower.py) < this.TILE_SIZE * 0.6) {
                        towerHit = tower; break;
                    }
                }
                if (towerHit) {
                    this.damageEngineerTower(towerHit, p.damage || 5);
                    if (p.trailGfx?.active) p.trailGfx.destroy();
                    this._destroyEnemyProjectile(p);
                    this.enemyProjectiles.splice(i, 1);
                    continue;
                }
            }

            // Cosmic.js: a Barrier ward eats it before it reaches you
            if (this._csWardCatch?.(p.isRopeTendril ? p._tipX : p.gfx.x, p.isRopeTendril ? p._tipY : p.gfx.y, p)) {
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
                    if (p.isPullTendril && p.sourceEnemy?.sprite?.active && (this._iceShellUntil || 0) <= this.time.now && this._ccGate?.(250) !== false) {   // (encased in the ice ult's shell, nothing moves you)
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
                    } else if (!p.isPullTendril) {
                        // Legacy root (it says RESISTED itself if you're in your escape window)
                        const was = this._playerRooted;
                        if (typeof this._rootPlayer === 'function') this._rootPlayer(500, this.time.now);
                        if (this._playerRooted && !was) this.showStatusText(this.player.x, this.player.y - 28, 'ROOTED!', '#44ff88');
                    }
                } else if (time - this.lastPlayerDamageTime >= this.playerDamageCooldown) {
                    this._hitBy = p.src || p.sourceEnemy || null;   // who fired it (a Tidecaller's boost, the Frost Shield's chill back)
                    this.takeDamage(p.damage);
                    this._hitBy = null;
                    this.lastPlayerDamageTime = time;
                    p.onHit?.();   // what else it does to you (a Budding Slime's glob poisons)
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
        // Bosses.js: a vine whips back into the ground; a shot ends in a pop of its own colour
        if (p.isRopeTendril && this._bfxVineSnap?.(p)) return;
        if (this._bfxOn && p.gfx?.active) {
            const x = p.gfx.x, y = p.gfx.y;
            p.gfx.destroy();
            BossFX.pop(this, BossFX.kindOf(p), x, y);
            return;
        }
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
        e.health = e.maxHealth = Math.round(50 * (this.enemyHealthScale || 1)); // a bit more than a base sniper
        if (typeof e.sprite.setTint === 'function') e.sprite.setTint(0xcc8800);
        // The only type with a tint and NO mark. A long crosshair with a gap in the
        // middle, so it reads as a scope rather than as the ranged enemy's full crosshair.
        const sm = this.add.graphics().setDepth(3);
        sm.lineStyle(1.5, 0xffcc44, 0.95);
        sm.beginPath(); sm.moveTo(-11, 0); sm.lineTo(-4, 0); sm.strokePath();
        sm.beginPath(); sm.moveTo(4, 0);   sm.lineTo(11, 0); sm.strokePath();
        sm.beginPath(); sm.moveTo(0, -11); sm.lineTo(0, -4); sm.strokePath();
        sm.beginPath(); sm.moveTo(0, 4);   sm.lineTo(0, 11); sm.strokePath();
        sm.lineStyle(1.5, 0xffcc44, 0.7); sm.strokeCircle(0, 0, 7);
        sm.x = e.sprite.x; sm.y = e.sprite.y - 26;
        e._sniperMark = sm;
        return e;
    }

    createMortar(x, y, roomIndex) {
        const e = this.createEnemy(x, y, 220);
        e.tutorialRoomIndex = roomIndex;
        e.isMortar = true;
        e._mortarLastFire = 0;
        e._mortarCooldown = 3200;
        e._mortarSafeRadius = 5;  // tiles — blind spot underneath it
        e._mortarMaxRange   = 13; // tiles — outer limit, so it cannot shell the map
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
        // Safe radius: a faint warm glow, no line
        e._mortarSafeRing = VisualFX.aura(this, e.sprite.x, e.sprite.y, e._mortarSafeRadius * this.TILE_SIZE, 0xff9a30, { alpha: 0.6 });
        return e;
    }

    createSplitter(x, y, roomIndex, tier = 0) {
        // tier 0=large(180HP), 1=medium(110HP), 2=small(60HP) — children stay a real threat
        const hpByTier   = [180, 110, 60];
        const tintByTier = [0xff6600, 0xff8822, 0xffaa44];
        // Wide size gap so the "big boy" is unmistakable vs its medium and small splits.
        const scaleByTier = [2.4, 1.4, 0.8];
        const e = this.createEnemy(x, y, hpByTier[tier]);
        e.tutorialRoomIndex = roomIndex;
        e.isSplitter = true;
        e._splitterTier = tier;
        e.sprite.setTint(tintByTier[tier]);
        const targetScale = this.SLIME_SCALE * scaleByTier[tier];
        e._baseScale = targetScale; // stored so scale resets always use the right value
        if (typeof e.sprite.setScale === 'function') e.sprite.setScale(targetScale);
        // Scaled-up sprites (esp. the 2.4× tier-0) were visually sinking ~1 tile below their
        // logical tile, because scaling a center-origin sprite grows it equally downward while
        // the tile position is fixed. Nudge the origin Y down proportionally to the EXTRA scale
        // so the enlarged body seats back on its tile. (Origin persists through the per-frame
        // sprite.y = tileY + offset updates; a one-time position nudge would be overwritten.)
        if (typeof e.sprite.setOrigin === 'function') LevelManager.seat(e, scaleByTier[tier]);   // feet on its tile, at any size
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
        const e = this.createEnemy(x, y, 70);
        e.tutorialRoomIndex = roomIndex;
        e.isRooter = true;
        // Far attack — pull tendril
        e._tendrilCooldown = 4000;
        e._tendrilLastFire = 0;
        e._tendrilRange = 14;   // tiles — longer reach so it threatens towers from further back
        e._tetherDps = 3;       // HP/sec chipped from a tethered tower — chips it down, doesn't kill
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

    // A slow, heavy slime (it was a fixed anchor): every pulse speeds up the enemies in its range
    // and slows you. Its own body and an anchor over it (Creatures.js).
    createAnchorSlime(x, y, roomIndex) {
        const e = this.createEnemy(x, y, 260);
        e.tutorialRoomIndex = roomIndex;
        e.isAnchor = true; e._mobile = true;
        e._moveCdMult = 2.0;   // slower than a slime
        e._anchorPulseInterval = 3000;
        e._anchorLastPulse = 0;
        e._anchorRange = 5; // tiles
        e._anchorSpeedBuff = 1.5;
        e._anchorSlowMult  = 0.5;
        const k = LevelManager.bodyKey(this, 'anchor');   // slate
        if (k) { e.sprite.setTexture(k, 0); e.sprite.play(k + '_idle'); }
        e._anchorRing = VisualFX.aura(this, e.sprite.x, e.sprite.y, e._anchorRange * this.TILE_SIZE, 0x3f86c0, { alpha: 0.8 });
        return e;
    }

    // A slow, tough slime (it was a fixed totem) that heals everything within its range.
    createHealerTotem(x, y, roomIndex) {
        const e = this.createEnemy(x, y, 220);
        e.tutorialRoomIndex = roomIndex;
        e.isHealerTotem = true; e._mobile = true;
        e._moveCdMult = 1.8;
        e._healerRange = 6;
        e._healerTickInterval = 1000;
        e._healerLastTick = 0;
        e._healerHealFrac = 0.2;   // of each ally's own max health, a tick (a second)
        const k = LevelManager.bodyKey(this, 'healer');   // mint
        if (k) { e.sprite.setTexture(k, 0); e.sprite.play(k + '_idle'); }
        e._healerAura = VisualFX.aura(this, e.sprite.x, e.sprite.y, e._healerRange * this.TILE_SIZE, 0x44ff88, { alpha: 0.9 });
        const particleTimer = this.time.addEvent({   // little green crosses rising off it
            delay: 420, loop: true,
            callback: () => {
                if (!e.sprite?.active) { particleTimer.remove(); return; }
                const pg = this.add.graphics().setDepth(2.8), sz = 2 + Math.random() * 1.5;
                pg.fillStyle(0x44ff88, 0.9).fillRect(-sz * 0.4, -sz, sz * 0.8, sz * 2).fillRect(-sz, -sz * 0.4, sz * 2, sz * 0.8);
                pg.x = e.sprite.x + (Math.random() - 0.5) * 14; pg.y = e.sprite.y - 6;
                this.tweens.add({ targets: pg, y: pg.y - 16 - Math.random() * 8, alpha: 0, duration: 550, ease: 'Quad.easeOut', onComplete: () => pg.destroy() });
            }
        });
        e._particleTimer = particleTimer;
        return e;
    }

    // ── Level 4: Mortar arc shot — flies over walls, lands on player tile ──
    _fireMortarShot(enemy) {
        const TS = this.TILE_SIZE;
        Sfx.play(this, 'lob');
        const ex = enemy.sprite.x, ey = enemy.sprite.y;
        // Target: TD can override to pick the nearest tower/base; else lock to player tile.
        const ov = this._mortarTargetOverride ? this._mortarTargetOverride(enemy) : null;
        const targetPX = ov ? ov.px : this.playerX * TS + TS / 2;
        const targetPY = ov ? ov.py : this.playerY * TS + TS / 2;

        // Arc trajectory — parabolic tween
        const FLIGHT_DUR = 1000 + Math.random() * 300;
        const ROCK_SIZE  = 10;
        const SPLASH_R   = 2.0; // tile radius AoE on landing
        const DMG        = this._mortarShellDamage ?? (20 * (this.enemyDamageScale || 1));

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
        // Bosses.js: a spinning shell for the drawn rock, and the very tiles it will hit filling in
        // on the floor from the moment it leaves (the old ring came at 40% of the flight)
        const _shell = this._bfxOn ? BossFX.shot(this, 'shell', ex, ey, 0, 5) : null;
        if (_shell) rock.setVisible(false);
        const _mk = this._bfxOn ? BossFX.mark(this, BossFX.tilesInRadius(this, targetPX, targetPY, SPLASH_R * TS, false), 0xff7a1a, FLIGHT_DUR) : null;

        // Warning ring at landing zone appears halfway through flight
        this.time.delayedCall(FLIGHT_DUR * 0.4, () => {
            if (_mk) return;
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
                if (_shell?.active) { _shell.setPosition(rock.x, rock.y).setScale(1.2 + t * 0.9); _shell.rotation += 0.18; }
                if (t >= 1) {
                    arcTimer.remove();
                    rock.destroy(); shadow.destroy();
                    _shell?.destroy();
                    if (_mk) { _mk.done(); BossFX.blast(this, targetPX, targetPY, SPLASH_R * TS, 'shell'); }
                    // IMPACT
                    this.cameras.main.shake(80, 0.006);
                    Sfx.play(this, 'slam', { small: true });
                    const impactGfx = this.add.graphics().setDepth(5);
                    impactGfx.x = targetPX; impactGfx.y = targetPY;
                    if (_mk) impactGfx.setVisible(false);
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
                    // Damage if the locked-on impact point is still within splash range of
                    // wherever the target actually is now. In TD, targetPX/Y is permanently
                    // the base position (immune to dodging by design — you're defending a
                    // fixed structure, not a mobile player), so this always lands correctly.
                    // In the main game, the player may have moved since the rock launched —
                    // check their CURRENT position against the locked impact point, same as
                    // the original intent, just reading the right coordinate pair.
                    const curPX = this.playerX * TS + TS / 2;
                    const curPY = this.playerY * TS + TS / 2;
                    const pdx = curPX - targetPX, pdy = curPY - targetPY;
                    if (Math.sqrt(pdx*pdx + pdy*pdy) <= SPLASH_R * TS) {
                        this._hitBy = enemy; this.takeDamage(DMG); this._hitBy = null;
                    }
                    // Damage any engineer tower caught in the splash
                    if (this.engineerTowers?.length) {
                        for (const tower of this.engineerTowers) {
                            if (!tower.active) continue;
                            const tdx = tower.px - targetPX, tdy = tower.py - targetPY;
                            if (Math.sqrt(tdx*tdx + tdy*tdy) <= SPLASH_R * TS) {
                                this.damageEngineerTower(tower, DMG);
                            }
                        }
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
        Sfx.play(this, 'slam', { small: true });
        const ex = enemy.sprite.x, ey = enemy.sprite.y;
        const THUMP_R = enemy._thumpRange || 3;
        const ROOT_DUR = 500;

        // Visual — ground shockwave ring
        this.cameras.main.shake(50, 0.005);
        this._bfxThump?.(enemy, THUMP_R);   // Bosses.js: the very tiles it roots, flashing
        // Drawn round itself and placed: drawn at its world position and then scaled, it slid
        // toward the map's corner as it grew.
        const ring = this.add.graphics().setDepth(3).setPosition(ex, ey).setVisible(!this._bfxOn);
        ring.lineStyle(3, 0x44ff88, 0.90);
        ring.strokeCircle(0, 0, THUMP_R * TS);
        ring.fillStyle(0x226633, 0.15);
        ring.fillCircle(0, 0, THUMP_R * TS);
        this.tweens.add({ targets: ring, scaleX: 1.15, scaleY: 1.15, alpha: 0, duration: 400, ease: 'Quad.easeOut', onComplete: () => ring.destroy() });

        // Small ground crack under rooter
        const crack = this.add.graphics().setDepth(2.8).setVisible(!this._bfxOn);
        crack.lineStyle(2, 0x44ff88, 0.80);
        crack.beginPath(); crack.moveTo(ex - 8, ey); crack.lineTo(ex + 8, ey); crack.strokePath();
        crack.beginPath(); crack.moveTo(ex, ey - 8); crack.lineTo(ex, ey + 8); crack.strokePath();
        this.tweens.add({ targets: crack, alpha: 0, duration: 600, onComplete: () => crack.destroy() });

        // Root player if within range
        const pdx = Math.abs(this.playerX - enemy.x), pdy = Math.abs(this.playerY - enemy.y);
        if (pdx + pdy <= THUMP_R) {
            this._bfxRootNext = 'vine';   // Bosses.js: thorned roots, not void tendrils
            if (typeof this._rootPlayer === 'function') this._rootPlayer(ROOT_DUR, this.time.now);
            this.showStatusText(this.player.x, this.player.y - 28, 'ROOTED!', '#44ff88');
        }

        // Root nearby enemies too (friendly fire — makes combat chaotic)
        for (const ally of this.enemies) {
            if (!ally.sprite?.active || ally === enemy || ally.isFrozen) continue;
            const adx = Math.abs(ally.x - enemy.x), ady = Math.abs(ally.y - enemy.y);
            if (adx + ady <= THUMP_R) {
                // Held where they stand. This was freezeEnemy: every thump put the rooter's allies
                // in ice cubes, in reach of a shatter, with ice nowhere in the fight.
                ally.isStunned = true;
                ally.stunnedUntil = Math.max(ally.stunnedUntil || 0, this.time.now + ROOT_DUR);
            }
        }

        this._poisonRing(enemy.x, enemy.y, Math.round(THUMP_R));
    }


    _triggerSplitterDeath(enemy) {
        const tier = enemy._splitterTier ?? 0;
        if (tier >= 2) return; // small splitters don't split further
        Sfx.play(this, 'split');

        const ex = enemy.x, ey = enemy.y;
        const TS = this.TILE_SIZE;
        const spawnCount = 2;
        const DMG = 12 * (this.enemyDamageScale || 1);   // (was the player's damageScaling: it hit harder as your weapons grew)
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
        // Damage any engineer tower caught in the splash
        if (this.engineerTowers?.length) {
            for (const tower of this.engineerTowers) {
                if (!tower.active) continue;
                if (Math.sqrt((tower.px-spx)**2 + (tower.py-spy)**2) <= SPLASH_R) {
                    this.damageEngineerTower(tower, DMG);
                }
            }
        }

        // Spawn smaller splitters at offset tiles
        const offsets = [[-2, 0], [2, 0]];
        for (let i = 0; i < spawnCount; i++) {
            const nx = ex + offsets[i][0], ny = ey + offsets[i][1];
            const validX = nx >= 0 && nx < this.WORLD_WIDTH;
            const validY = ny >= 0 && ny < this.WORLD_HEIGHT;
            const spawnX = (validX && validY && this.world[nx][ny] === this.FLOOR) ? nx : ex;
            const spawnY = (validX && validY && this.world[nx][ny] === this.FLOOR) ? ny : ey;
            // createSplitter -> createEnemy has already put it in this.enemies: a second push
            // made every loop over the enemies (lava, splash, chains) hit it twice.
            this.createSplitter(spawnX, spawnY, enemy.tutorialRoomIndex, tier + 1);
        }
    }

    // ── Speed/slow arrow indicator ────────────────────────────────────────
    // type: 'slow_ice' | 'slow_goop' | 'slow_anchor' | 'speed_anchor' | 'speed_fire'
    // target: an object with .x/.y (sprite or player), or a GameObjects with those props
    // Returns a timer handle — store on target as _speedIndTimer, remove on expiry
    _spawnSpeedArrow(targetX, targetY, type) {
        if (this._cfxSpeedArrow?.(targetX, targetY, type)) return;   // Creatures.js draws it
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
    // Start/stop wrapper around _startSpeedIndicator. Every caller before this managed its
    // own timer handle by hand, which is why several speed changes had no arrows at all and
    // why the ones that did could only be applied on a one-shot event -- a per-frame check
    // like "is this Ripplerunner standing in water" would have spawned an arrow every single
    // frame. This only acts on TRANSITIONS, so a condition that is re-evaluated constantly is
    // safe to drive it with.
    //
    // `key` names the timer slot on the target, so one entity can carry several independent
    // indicators (a slowed enemy that is also anchor-buffed) without them overwriting.
    _setSpeedIndicator(target, key, type, on, interval = 350, durationMs = 0) {
        if (!target) return;
        const slot = '_spdInd_' + key;
        if (on) {
            if (target[slot]) return;                    // already running: do not restack
            // durationMs turns a PERSISTENT condition into a burst. A Ripplerunner's speed is
            // a permanent property of the tile it stands on, so arrows that ran the whole time
            // would be constant noise on every one of them; a short pulse on each wet/dry
            // TRANSITION carries the same information at the only moment it is news.
            target[slot] = this._startSpeedIndicator(
                () => (target.sprite?.active ? { x: target.sprite.x, y: target.sprite.y - 10 }
                     : (target === this ? { x: this.player.x, y: this.player.y - 10 } : null)),
                type, interval
            );
            if (durationMs > 0) {
                this.time.delayedCall(durationMs, () => {
                    if (target[slot]) { target[slot].remove(); target[slot] = null; }
                });
            }
        } else if (target[slot]) {
            target[slot].remove();
            target[slot] = null;
        }
    }

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

    // A ring of poison tiles R round (cx, cy), the Rooter's thump's and a Budding Slime's bud's: a trap
    // that doses you (_poisonPlayer) while you stand in it, gone after 12s.
    _poisonRing(cx, cy, r) {
        const poisonRadius = r, TS = this.TILE_SIZE;
        const poisonTiles = [];
        for (let dx = -poisonRadius; dx <= poisonRadius; dx++) {
            for (let dy = -poisonRadius; dy <= poisonRadius; dy++) {
                const d = Math.sqrt(dx*dx + dy*dy);
                if (d < poisonRadius - 0.7 || d > poisonRadius + 0.7) continue;
                const tx = cx + dx, ty = cy + dy;
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
            // A pool of murky sludge from Visuals.js where it's loaded (TD keeps the drawn tile)
            const base = this._vfxSludgeTile ? this._vfxSludgeTile(px2 + TS/2, py2 + TS/2)
                : this.add.rectangle(px2 + TS/2, py2 + TS/2, TS, TS, 0x113322, 0.75).setDepth(0.65);
            const glow = this.add.graphics().setDepth(0.70);
            if (!this._vfxSludgeTile) {
                glow.fillStyle(0x44ff88, 0.22); glow.fillRect(px2 + 2, py2 + 2, TS - 4, TS - 4);
                glow.lineStyle(1, 0x44ff88, 0.50); glow.strokeRect(px2 + 1, py2 + 1, TS - 2, TS - 2);
            }
            // Pulsing bubble
            const bubble = this.add.circle(px2 + TS/2 + (Math.random()-0.5)*6, py2 + TS/2 + (Math.random()-0.5)*6,
                this._vfxSludgeTile ? 1.5 + Math.random() : 3 + Math.random()*2, 0x88ff66, this._vfxSludgeTile ? 0.45 : 0.60).setDepth(0.72);
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

    // POISONED, from anything (a Rooter's ring, a trap, a Budding Slime's glob): DMG every EVERY ms
    // for MS. One poison at a time: a fresh dose replaces the one running, it never stacks.
    // POISON: its ticks, and healing cut by POISON_CUT while it lasts (each frame claws back that share of whatever health
    // came back since the last, rather than touching every heal)
    _poisonPlayer(dmg, every, ms) {
        if (!(this._poisonUntil > this.time.now)) {
            this.showStatusText(this.player.x, this.player.y - 30, 'POISONED', '#9ae04a');
            Sfx.play(this, 'status', { kind: 'poison' });
            this._poisonTickAt = this.time.now;
            this._poisonHp = this.health;
        }
        this._poisonUntil = this.time.now + ms; this._poisonDmg = dmg; this._poisonEvery = every;
    }
    _updatePoison(time) {
        if (!this._poisonUntil) return;
        const p = this.player;
        if (time >= this._poisonUntil || !p?.active || this._deathScreenActive) { this._poisonUntil = 0; this.playerPoisoned = false; return; }
        this.playerPoisoned = true;   // its bubbles (Creatures.js)
        const CUT = 0.6;   // POISON_CUT
        if (this._poisonHp != null && this.health > this._poisonHp) this.health = this._poisonHp + (this.health - this._poisonHp) * (1 - CUT);
        if (time - this._poisonTickAt >= this._poisonEvery) { this._poisonTickAt = time; this.takeDamage(this._poisonDmg); }
        this._poisonHp = this.health;
    }

    updateFloorTraps(time) {
        if (!this.floorTraps) return;
        for (const trap of this.floorTraps) {
            for (const t of trap.tiles) {
                if (this.playerX !== t.x || this.playerY !== t.y) continue;
                if (time - trap.lastTick < trap.interval) continue;
                trap.lastTick = time;

                if (trap.type === 'poison') {
                    this._poisonPlayer(trap.damage, trap.interval, trap.poisonDuration);   // stepping on it (again) doses you afresh
                } else if (trap.type === 'spike') {
                    this.takeDamage(trap.damage);
                    this.cameras.main.shake(60, 0.005);
                    this.showStatusText(
                        this.player.x,
                        this.player.y - 20,      // showStatusText is world space; it used to get screen coords
                        'SPIKE!', '#cccccc');
                }
            }
        }
    }

    // ─── GROUND DROPS ────────────────────────────────────────────────────────

    tryDropFromEnemy(enemy) {
        if (enemy._spawned) return;
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
            fontSize: '8px', fontFamily: UIKit.FONT.title, fontStyle: 'bold', color: '#ff9ab8', stroke: '#1a0608', strokeThickness: 3, resolution: 2
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
            fontSize: '8px', fontFamily: UIKit.FONT.title, fontStyle: 'bold', color: '#ffee66', stroke: '#1a1406', strokeThickness: 3, resolution: 2
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
        Sfx.play(this, 'pickup');
        if (this.glorpText) this.glorpText.setText(`✦ ${this.totalGlorps} Glorps`);

        const px = this._scrX(this.player.x);
        const py = this._scrY(this.player.y);

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
        const amt = drop.heal * PlayerStats.healMult(this);   // Hearty (Stats.js)
        const heal = Math.min(amt, this.maxHealth - this.health);
        if (heal <= 0) return;
        Sfx.play(this, 'heal');
        this.health = Math.min(this.maxHealth, this.health + amt);
        this.updateHUD();

        // Green heal flash on health bar
        this.tweens.add({ targets: this.healthBarFill, fillColor: 0x44ff88,
            duration: 120, yoyo: true, repeat: 2,
            onComplete: () => { if (this.healthBarFill) this.healthBarFill.setFillStyle(0xff5566); }
        });

        // Floating +HP text
        const fx = this._scrX(this.player.x);
        const fy = this._scrY(this.player.y) - 20;
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
        this.gainUltCharge(drop.ultAmount || 15, this.currentElement, true);

        // Pulse the ult bar label
        if (this.ultBarLabel) {
            this.tweens.add({ targets: this.ultBarLabel, scaleX: 1.4, scaleY: 1.4, duration: 120, yoyo: true, ease: 'Quad.easeOut' });
        }

        const fx = this._scrX(this.player.x);
        const fy = this._scrY(this.player.y) - 20;
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