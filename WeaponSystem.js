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
        // Level 4 — attacking near a crack pulse breaks it
        if (this.isLevel4 && this._crackPulses?.length) {
            const worldX = targetX + this.cameras.main.scrollX;
            const worldY = targetY + this.cameras.main.scrollY;
            this._tryBreakCrackPulse(worldX, worldY, this.TILE_SIZE * 1.2);
        }

        const weapon = this.equippedWeapons?.[this.currentElement] || 'flame_fists';
        switch (weapon) {
            case 'flame_sword':     this.flameSwordAttack(targetX, targetY); break;
            case 'magma_staff':     this.magmaStaffAttack(targetX, targetY); break;
            case 'ice_fists':       this.iceFistsAttack(targetX, targetY); break;
            case 'icicle_cannon':   this.icicleStaffAttack(targetX, targetY); break;
            case 'fractal_shard':   this.fractalShardAttack(targetX, targetY); break;
            case 'lightning_fists': this.lightningFistsAttack(targetX, targetY); break;
            case 'orb_emitter':     this.orbEmitterAttack(targetX, targetY); break;
            case 'cosmic_fists':    this.cosmicFistsAttack(targetX, targetY); break;
            case 'singularity_staff': this.singularityStaffFire(targetX, targetY); break;
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
            if (this.damageBossAtTile(tile.x, tile.y, damage)) {
                if (typeof this.applyBurnStackBoss === 'function') this.applyBurnStackBoss();
            }

            // Damage enemies on that tile
            for (let enemy of [...this.enemies]) {
                if (enemy.x === tile.x && enemy.y === tile.y) {
                    if (enemy.iceImmune) {
                        // Ice elementals are immune to all physical/fire damage
                        // Flame fists still leave a lava tile (handled below) but the hit itself does nothing
                        this.showStatusText(enemy.sprite.x, enemy.sprite.y - 10, 'IMMUNE', '#88eeff');
                        this._triggerIceImmuneGlerpReaction();
                        continue;
                    }
                    if (enemy.fireImmune) {
                        // Fire elementals immune to direct hits but DO accumulate burn stacks
                        if (typeof this.applyBurnStack === 'function') this.applyBurnStack(enemy);
                        continue;
                    }
                    if (enemy.elementImmune) {
                        this.showStatusText(enemy.sprite.x, enemy.sprite.y - 10, 'IMMUNE', '#8888ff');
                        continue;
                    }
                    enemy.health -= damage;
                    this.showDamageNumber(enemy.sprite.x, enemy.sprite.y - 10, damage, '#ff6600');
                    this.updateEnemyHealthBar(enemy);
                    this.gainUltCharge(this.ultChargePerHit);
                    if (typeof this.applyBurnStack === 'function') this.applyBurnStack(enemy);
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

        // ── Direct fist hit — 1 tile in front ────────────────────────────
        const tile = { x: this.playerX + facingX, y: this.playerY + facingY };
        const tileValid = tile.x >= 0 && tile.x < this.WORLD_WIDTH &&
                          tile.y >= 0 && tile.y < this.WORLD_HEIGHT &&
                          this.world[tile.x][tile.y] === this.FLOOR &&
                          this.isInCurrentRoom(tile.x, tile.y);

        if (!tileValid) return;

        const hitPx = tile.x * this.TILE_SIZE + this.TILE_SIZE / 2;
        const hitPy = tile.y * this.TILE_SIZE + this.TILE_SIZE / 2;

        // Yellow tile flash
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
            spark.moveTo(hitPx, hitPy);
            spark.lineTo(hitPx + Math.cos(a) * (6 + Math.random() * 4), hitPy + Math.sin(a) * (6 + Math.random() * 4));
            spark.strokePath();
            this.tweens.add({ targets: spark, alpha: 0, duration: 150, onComplete: () => spark.destroy() });
        }

        // Direct hit — routes through damageEnemy for immunity/room-gating/ult-charge
        const dmg = 14 * this.damageScaling;
        let hitEnemy = null;
        for (const enemy of [...this.enemies]) {
            if (enemy.x !== tile.x || enemy.y !== tile.y) continue;
            this.damageEnemy(enemy, dmg);
            this.gainUltCharge(this.ultChargePerLightningHit); // lightning bypasses damageEnemy charge skip
            hitEnemy = enemy;
            break;
        }
        const portal = this.getPortalAt(tile.x, tile.y);
        if (portal) this.damagePortal(portal, dmg);
        this.damageBossAtTile(tile.x, tile.y, dmg);

        // ── Chain lightning — only fires if fist connected with an enemy ─
        // Finds up to 2 nearest enemies within 3 tiles of the hit tile (excluding
        // the struck enemy), bolts originate from the hit tile, damage falls off
        // 40% per hop.
        if (!hitEnemy) { this.cameras.main.shake(30, 0.001); return; }

        const CHAIN_RANGE = 3;   // tiles
        const CHAIN_FALLOFF = 0.6;
        const MAX_CHAINS = 2;
        const chainDmg = dmg * CHAIN_FALLOFF;

        // Collect candidates sorted by distance from hit tile
        const candidates = this.enemies
            .filter(e => e !== hitEnemy && e.sprite?.active)
            .map(e => ({
                enemy: e,
                dist: Math.abs(e.x - tile.x) + Math.abs(e.y - tile.y)
            }))
            .filter(c => c.dist <= CHAIN_RANGE)
            .sort((a, b) => a.dist - b.dist)
            .slice(0, MAX_CHAINS);

        for (const { enemy: chainEnemy } of candidates) {
            this.drawLightningBolt({ sprite: { x: hitPx, y: hitPy } }, chainEnemy);
            this.damageEnemy(chainEnemy, chainDmg);
            this.gainUltCharge(this.ultChargePerLightningHit * 0.5); // chain hits give half charge
        }

        this.cameras.main.shake(30, 0.001);
    }

    // ══════════════════════════════════════════════════════════════════════
    // ORB EMITTER — bouncing electric orb, marks + forks lightning on hit
    // ══════════════════════════════════════════════════════════════════════
    cosmicFistsAttack(targetX, targetY) {
        const currentTime = this.time.now;
        if (currentTime - (this.lastCosmicFistsTime || 0) < 450) return;
        this.lastCosmicFistsTime = currentTime;

        const TS = this.TILE_SIZE;
        const worldX = targetX + this.cameras.main.scrollX;
        const worldY = targetY + this.cameras.main.scrollY;
        const playerPx = this.playerX * TS + TS / 2;
        const playerPy = this.playerY * TS + TS / 2;
        const dx = worldX - playerPx, dy = worldY - playerPy;

        let facingX = 0, facingY = 0;
        if (Math.abs(dx) > Math.abs(dy)) facingX = dx > 0 ? 1 : -1;
        else facingY = dy > 0 ? 1 : -1;

        const tile = { x: this.playerX + facingX, y: this.playerY + facingY };
        if (tile.x < 0 || tile.x >= this.WORLD_WIDTH || tile.y < 0 || tile.y >= this.WORLD_HEIGHT) return;
        if (this.world[tile.x][tile.y] !== this.FLOOR) return;
        if (!this.isInCurrentRoom(tile.x, tile.y)) return;

        // ── Momentum bonus — tiles dashed in the last 1.5s ──────────────
        const MOMENTUM_WINDOW = 3000; // ms
        const tilesTraversed = this._cosmicDashTilesLog
            ? this._cosmicDashTilesLog.filter(t => currentTime - t.time < MOMENTUM_WINDOW).length
            : 0;
        const momentumMult = 1.0 + tilesTraversed * 0.25; // +25% per dash tile, up to +75% at 3 tiles
        const BASE_DMG = 8 * this.damageScaling;
        const damage = BASE_DMG * momentumMult;
        const isEmpowered = tilesTraversed > 0;

        const hitPx = tile.x * TS + TS / 2;
        const hitPy = tile.y * TS + TS / 2;

        // ── Visuals ──────────────────────────────────────────────────────
        // Tile flash — deep purple with yellow-white core if empowered
        const flash = this.add.graphics().setDepth(1.5);
        flash.fillStyle(isEmpowered ? 0xffee88 : 0x9933cc, isEmpowered ? 0.60 : 0.55);
        flash.fillRect(tile.x * TS, tile.y * TS, TS, TS);
        if (isEmpowered) {
            flash.fillStyle(0xffffff, 0.30);
            flash.fillRect(tile.x * TS + 4, tile.y * TS + 4, TS - 8, TS - 8);
        }
        this.tweens.add({ targets: flash, alpha: 0, duration: 200, onComplete: () => flash.destroy() });

        // Impact burst — purple/gold swipe arc
        const burst = this.add.graphics().setDepth(3.2);
        burst.x = hitPx; burst.y = hitPy;
        const burstCol = isEmpowered ? 0xffe066 : 0xcc44ff;
        burst.fillStyle(burstCol, 0.75);
        burst.fillCircle(0, 0, TS * 0.38);
        burst.lineStyle(2, 0xffffff, 0.60);
        burst.strokeCircle(0, 0, TS * 0.38);
        this.tweens.add({ targets: burst, scaleX: 1.6, scaleY: 1.6, alpha: 0, duration: 220, ease: 'Quad.easeOut', onComplete: () => burst.destroy() });

        // Star sparks radiating outward — 6 lines
        for (let i = 0; i < 6; i++) {
            const a = (i / 6) * Math.PI * 2;
            const sp = this.add.graphics().setDepth(3.5);
            const sparkCol = i % 2 === 0 ? 0xcc44ff : 0xffe066;
            sp.lineStyle(isEmpowered ? 2.5 : 1.5, sparkCol, 0.90);
            sp.beginPath();
            const r1 = TS * 0.15, r2 = TS * (isEmpowered ? 0.55 : 0.40);
            sp.moveTo(Math.cos(a) * r1, Math.sin(a) * r1);
            sp.lineTo(Math.cos(a) * r2, Math.sin(a) * r2);
            sp.strokePath();
            sp.x = hitPx; sp.y = hitPy;
            this.tweens.add({ targets: sp, alpha: 0, duration: isEmpowered ? 280 : 180, onComplete: () => sp.destroy() });
        }

        // Momentum indicator text
        if (isEmpowered) {
            const pct = Math.round((momentumMult - 1) * 100);
            this.showStatusText(hitPx, hitPy - 18, `+${pct}% MOMENTUM`, '#ffe066');
        }

        // ── Damage ───────────────────────────────────────────────────────
        let hit = false;
        for (const enemy of [...this.enemies]) {
            if (enemy.x !== tile.x || enemy.y !== tile.y) continue;
            if (!enemy.sprite?.active) continue;
            this.damageEnemy(enemy, damage);
            this.gainUltCharge(this.ultChargePerHit * momentumMult);
            hit = true;
        }
        const portal = this.getPortalAt(tile.x, tile.y);
        if (portal) this.damagePortal(portal, damage);
        this.damageBossAtTile(tile.x, tile.y, damage);

        this.cameras.main.shake(hit ? 55 : 30, isEmpowered ? 0.004 : 0.002);
    }

    // ═══════════════════════════════════════════════════════════════════
    // SINGULARITY STAFF
    // ═══════════════════════════════════════════════════════════════════

    singularityStaffFire(targetX, targetY) {
        const now = this.time.now;
        // Block fire during collapse mode
        if (this._collapseMode || this._collapseBarActive) return;
        if (now - (this._lastSingFire || 0) < 2500) return;
        this._lastSingFire = now;

        // Direction toward mouse
        const worldX = targetX + this.cameras.main.scrollX;
        const worldY = targetY + this.cameras.main.scrollY;
        const px = this.playerX * this.TILE_SIZE + this.TILE_SIZE / 2;
        const py = this.playerY * this.TILE_SIZE + this.TILE_SIZE / 2;
        const dx = worldX - px, dy = worldY - py;
        const len = Math.sqrt(dx * dx + dy * dy) || 1;

        // Snapshot tiles traversed at fire time for speed scaling
        const tilesAtFire = this._singTilesTraversed || 0;

        if (!this._singularities) this._singularities = [];
        const gfx = this.add.graphics().setDepth(3.5);
        gfx.x = px; gfx.y = py;

        this._singularities.push({
            gfx,
            vx: (dx / len) * 90,  // base speed px/s — slow, ominous
            vy: (dy / len) * 90,
            startX: px, startY: py,
            tilesAtFire,           // tiles traversed when fired — used for speed scaling
            _tilesWhenFired: this._singTilesTraversed || 0,
            createdAt: now,
            pullRadius: 4 * this.TILE_SIZE,
            dotTimer: 0,
            phase: 0,              // for visual animation
        });

        // Count shots for collapse unlock
        this._singShots = (this._singShots || 0) + 1;

        // Muzzle flash
        const mf = this.add.graphics().setDepth(4);
        mf.x = px; mf.y = py;
        mf.fillStyle(0x9900ff, 0.80); mf.fillCircle(0, 0, 16);
        mf.lineStyle(2, 0xcc44ff, 0.70); mf.strokeCircle(0, 0, 20);
        this.tweens.add({ targets: mf, scaleX: 2, scaleY: 2, alpha: 0, duration: 200, onComplete: () => mf.destroy() });
    }

    updateSingularityStaff(delta) {
        if (!this._singularities?.length) return;
        const ds = delta / 1000;
        const TS = this.TILE_SIZE;
        const now = this.time.now;

        for (let i = this._singularities.length - 1; i >= 0; i--) {
            const s = this._singularities[i];
            if (!s.gfx?.active) { this._singularities.splice(i, 1); continue; }

            // Speed scales with tiles traversed since fire — gentle +6% per tile
            const tilesDelta = Math.max(0, (this._singTilesTraversed || 0) - s._tilesWhenFired);
            const speedMult = 1 + tilesDelta * 0.06;
            s.gfx.x += s.vx * speedMult * ds;
            s.gfx.y += s.vy * speedMult * ds;

            // Crack shrink — pierces, no effect on projectile flight (Level 4)
            this._checkProjectileCrackShrink(s.gfx.x, s.gfx.y);

            // Wall / locked room check
            const tx = Math.floor(s.gfx.x / TS), ty = Math.floor(s.gfx.y / TS);
            const oob = tx < 0 || tx >= this.WORLD_WIDTH || ty < 0 || ty >= this.WORLD_HEIGHT;
            const hitWall = oob || this.world[tx]?.[ty] === this.WALL || this.world[tx]?.[ty] === this.NOTHING || this.isInLockedRoom(tx, ty);
            const tooOld = now - s.createdAt > 6000;

            if (hitWall || tooOld) {
                this._singularityExplode(s, speedMult, tilesDelta);
                s.gfx.destroy();
                this._singularities.splice(i, 1);
                continue;
            }

            // ── Strong pull — drags enemies along with the projectile ──────────
            s.dotTimer += delta;
            for (const enemy of this.enemies) {
                if (!enemy.sprite?.active) continue;
                const ex = enemy.sprite.x, ey = enemy.sprite.y;
                const dist = Math.hypot(ex - s.gfx.x, ey - s.gfx.y);
                if (dist > s.pullRadius) continue;

                // Pull velocity: strong constant drag toward singularity center
                // Scales up toward center (strongest when close)
                const pullForce = 280 * (1 - dist / s.pullRadius) + 80; // 80-360 px/s
                const pdx = s.gfx.x - ex, pdy = s.gfx.y - ey;
                const plen = Math.hypot(pdx, pdy) || 1;
                enemy.sprite.x += (pdx / plen) * pullForce * ds;
                enemy.sprite.y += (pdy / plen) * pullForce * ds;

                // Clamp to floor tiles
                const newTX = Math.floor(enemy.sprite.x / TS);
                const newTY = Math.floor(enemy.sprite.y / TS);
                if (this.world[newTX]?.[newTY] === this.FLOOR) {
                    enemy.x = newTX;
                    enemy.y = newTY;
                } else {
                    // Revert to tile center if pulled into a wall
                    enemy.sprite.x = enemy.x * TS + TS / 2;
                    enemy.sprite.y = enemy.y * TS + TS / 2 + (this.SLIME_Y_OFFSET || 0);
                }

                // DOT every 200ms
                if (s.dotTimer >= 200) this.damageEnemy(enemy, 4 * this.damageScaling);
            }
            if (s.dotTimer >= 200) s.dotTimer = 0;

            // ── Inward streaming particles ────────────────────────────────────
            s.phase += delta * 0.005;
            if (now - (s._lastParticle || 0) > 60) {
                s._lastParticle = now;
                const count = 2 + Math.floor(tilesDelta * 0.3);
                for (let p = 0; p < count; p++) {
                    const a = Math.random() * Math.PI * 2;
                    const r = s.pullRadius * (0.3 + Math.random() * 0.7);
                    const pg = this.add.graphics().setDepth(3.3);
                    const col = Math.random() < 0.5 ? 0xcc44ff : 0x9900cc;
                    pg.fillStyle(col, 0.65 + Math.random() * 0.25);
                    pg.fillCircle(0, 0, 1.5 + Math.random() * 2);
                    pg.x = s.gfx.x + Math.cos(a) * r;
                    pg.y = s.gfx.y + Math.sin(a) * r;
                    this.tweens.add({
                        targets: pg, x: s.gfx.x, y: s.gfx.y,
                        alpha: 0, duration: 350 + Math.random() * 200,
                        ease: 'Quad.easeIn', onComplete: () => pg.destroy()
                    });
                }
            }

            // ── Black hole visual — matches ult aesthetic ─────────────────────
            s.gfx.clear();
            const R = TS * 0.48; // base radius

            // Outer distortion haze (dark purple, slow pulse)
            const distPulse = 0.15 + 0.08 * Math.sin(s.phase * 0.7);
            s.gfx.fillStyle(0x220044, distPulse);
            s.gfx.fillCircle(0, 0, R * 2.4);

            // Outer ring (purple glow, pulsing scale)
            const outerScale = 1.0 + 0.12 * Math.sin(s.phase * 1.1);
            s.gfx.lineStyle(4, 0x9966ff, 0.85);
            s.gfx.strokeCircle(0, 0, R * outerScale);
            s.gfx.fillStyle(0x330066, 0.35);
            s.gfx.fillCircle(0, 0, R * outerScale);

            // Middle ring (brighter, faster pulse)
            const midScale = 1.0 + 0.18 * Math.sin(s.phase * 1.4 + 0.3);
            s.gfx.lineStyle(3, 0xaa77ff, 0.95);
            s.gfx.strokeCircle(0, 0, R * 0.62 * midScale);
            s.gfx.fillStyle(0x660099, 0.50);
            s.gfx.fillCircle(0, 0, R * 0.62 * midScale);

            // Inner ring (pink/bright, fastest pulse)
            const innerScale = 1.0 + 0.25 * Math.sin(s.phase * 1.8 + 0.6);
            s.gfx.lineStyle(2.5, 0xdd99ff, 1.0);
            s.gfx.strokeCircle(0, 0, R * 0.34 * innerScale);
            s.gfx.fillStyle(0x9933cc, 0.65);
            s.gfx.fillCircle(0, 0, R * 0.34 * innerScale);

            // 4 rotating spiral arms (counter-clockwise like ult)
            const armAngle = -s.phase * 1.2; // counter-clockwise
            for (let arm = 0; arm < 4; arm++) {
                const startA = armAngle + (Math.PI * 2 / 4) * arm;
                s.gfx.lineStyle(2, 0x9966ff, 0.55);
                s.gfx.beginPath();
                const armLen = R * 0.92;
                for (let r = 4; r < armLen; r += 2) {
                    const spiral = startA + (r / armLen) * Math.PI;
                    const sx = Math.cos(spiral) * r;
                    const sy = Math.sin(spiral) * r;
                    if (r === 4) s.gfx.moveTo(sx, sy);
                    else s.gfx.lineTo(sx, sy);
                }
                s.gfx.strokePath();
            }

            // Orbiting particle dots (8 dots at varying radii, counter-rotating)
            for (let d = 0; d < 8; d++) {
                const da = armAngle + (d / 8) * Math.PI * 2;
                const dr = R * (0.25 + (d % 3) * 0.18);
                const alpha = 0.55 + 0.35 * Math.sin(s.phase * 2 + d);
                s.gfx.fillStyle(0xffffff, alpha);
                s.gfx.fillCircle(Math.cos(da) * dr, Math.sin(da) * dr, 1.8);
            }

            // Absolute void core — total black
            s.gfx.fillStyle(0x000000, 1.0);
            s.gfx.fillCircle(0, 0, R * 0.20);

            // Bright singularity core (yellow-white, fast pulse like ult)
            const corePulse = 1.0 + 0.45 * Math.abs(Math.sin(s.phase * 2.2));
            s.gfx.fillStyle(0xffff00, 0.90);
            s.gfx.fillCircle(0, 0, R * 0.10 * corePulse);
            s.gfx.lineStyle(1.5, 0xffffff, 0.90);
            s.gfx.strokeCircle(0, 0, R * 0.10 * corePulse);

            // Speed glow — outer ring brightens as projectile accelerates
            if (speedMult > 1.08) {
                const intensity = Math.min(0.75, (speedMult - 1) * 1.5);
                s.gfx.lineStyle(2.5, 0xcc88ff, intensity);
                s.gfx.strokeCircle(0, 0, R * (1.05 + (speedMult - 1) * 0.10));
            }
        }
    }

    _singularityExplode(s, speedMult, tilesDelta) {
        const BASE_DMG  = 28;
        const dmg = BASE_DMG * speedMult * this.damageScaling;
        const R   = this.TILE_SIZE * (1.5 + tilesDelta * 0.25); // bigger explosion with more tiles
        const ex  = s.gfx.x, ey = s.gfx.y;

        // Explosion visual
        const exp = this.add.graphics().setDepth(5);
        exp.x = ex; exp.y = ey;
        exp.fillStyle(0x000000, 0.85); exp.fillCircle(0, 0, R * 1.1);
        exp.fillStyle(0x9900ff, 0.65); exp.fillCircle(0, 0, R);
        exp.fillStyle(0xcc44ff, 0.55); exp.fillCircle(0, 0, R * 0.55);
        exp.fillStyle(0xffffff, 0.80); exp.fillCircle(0, 0, R * 0.22);
        exp.lineStyle(3, 0xee88ff, 0.90); exp.strokeCircle(0, 0, R);
        this.tweens.add({ targets: exp, scaleX: 1.8, scaleY: 1.8, alpha: 0, duration: 450, ease: 'Quad.easeOut', onComplete: () => exp.destroy() });
        this.cameras.main.shake(40 + Math.floor(tilesDelta * 8), 0.004 + tilesDelta * 0.001);

        // Damage enemies in radius
        for (const enemy of this.enemies) {
            if (!enemy.sprite?.active) continue;
            if (Math.hypot(enemy.sprite.x - ex, enemy.sprite.y - ey) <= R) {
                this.damageEnemy(enemy, dmg);
            }
        }
        this.damageBossAtTile(Math.floor(ex / this.TILE_SIZE), Math.floor(ey / this.TILE_SIZE), dmg);

        // Speed text if boosted
        if (tilesDelta > 0) {
            this.showStatusText(ex, ey - 20, `${Math.round(dmg)} IMPACT`, '#ee88ff');
        }
    }

    // ── COLLAPSE MODE ──────────────────────────────────────────────────

    singularityCollapseActivate() {
        const SHOTS_NEEDED = 3;
        if ((this._singShots || 0) < SHOTS_NEEDED) {
            this.showStatusText(this.player.x, this.player.y - 28, `FIRE ${SHOTS_NEEDED - (this._singShots||0)} MORE`, '#cc44ff');
            return;
        }
        if (this._collapseBarActive || this._collapseMode) return;

        this._collapseBarActive = true;
        this._collapseBarStart  = this.time.now;
        this._collapseBarDur    = 4000; // 4s to accumulate orbs
        this._collapseOrbs      = [];
        this._collapseOrbsReady = false;
        this._collapseDecaying  = false;
        this._singTilesAtCollapse = this._singTilesTraversed || 0;
        this._singShots = 0; // reset shot counter

        this.showStatusText(this.player.x, this.player.y - 36, '◉ COLLAPSE', '#cc44ff');
        this.cameras.main.shake(30, 0.002);
    }

    updateCollapseMode(delta) {
        if (!this._collapseBarActive && !this._collapseDecaying) {
            this._updateLaunchingOrbs(delta);
            return;
        }
        const now = this.time.now;
        const TS  = this.TILE_SIZE;
        const px  = this.player.x, py = this.player.y;
        const MAX_ORBS_UNUSED = 0; // no cap — collect as many as you can

        // ── BAR FILL PHASE ─────────────────────────────────────────────
        if (this._collapseBarActive && !this._collapseDecaying) {
            const elapsed = now - this._collapseBarStart;
            const pct = Math.min(elapsed / this._collapseBarDur, 1);

            // Grant orb for each new tile walked since collapse started
            const newTiles = (this._singTilesTraversed || 0) - (this._singTilesAtCollapse || 0);
            while ((this._collapseOrbs?.length || 0) < newTiles) {
                this._spawnCollapseOrb();
            }

            // Update orb bar visuals
            this._updateCollapseBar(pct);

            // Update orbiting orbs
            this._orbitCollapseOrbs(delta, px, py);
            this._collapseOrbDamage();
            this._collapseOrbBlockProjectiles();

            // Bar full → switch to decay + launch phase
            if (pct >= 1) {
                this._collapseBarActive = false;
                this._collapseDecaying  = true;
                this._collapseDecayStart = now;
                this._collapseDecayDur   = 3000; // 3s to launch before orbs dissipate
            }
            return;
        }

        // ── DECAY / LAUNCH PHASE ──────────────────────────────────────
        if (this._collapseDecaying) {
            const decayPct = 1 - Math.min((now - this._collapseDecayStart) / this._collapseDecayDur, 1);
            this._updateCollapseBar(decayPct);
            this._orbitCollapseOrbs(delta, px, py);
            this._collapseOrbDamage();
            this._collapseOrbBlockProjectiles();

            // Draw target cursor on mouse
            this._drawCollapseCursor();

            if (decayPct <= 0) {
                // Time out — dissipate orbs
                this._dissipateCollapseOrbs();
                this._endCollapseMode();
            }
        }
    }

    _spawnCollapseOrb() {
        const orb = this.add.graphics().setDepth(4.2);
        const R = 8;
        // Outer dark void shell
        orb.fillStyle(0x000000, 1.0);       orb.fillCircle(0, 0, R);
        // Purple inner glow offset for depth
        orb.fillStyle(0x7700cc, 0.80);      orb.fillCircle(1, 1, R * 0.72);
        // Brighter core
        orb.fillStyle(0xaa33ff, 0.65);      orb.fillCircle(1, 1, R * 0.45);
        // Purple rim light on opposite dark edge
        orb.fillStyle(0xcc44ff, 0.30);      orb.fillCircle(-2, 2, R * 0.55);
        // Main specular highlight — bright white dot upper-left
        orb.fillStyle(0xffffff, 0.90);      orb.fillCircle(-3, -3, R * 0.22);
        // Secondary softer highlight
        orb.fillStyle(0xeeccff, 0.45);      orb.fillCircle(-2, -2, R * 0.38);
        // Thin outline
        orb.lineStyle(1.5, 0xcc44ff, 0.70); orb.strokeCircle(0, 0, R);

        orb.x = this.player.x; orb.y = this.player.y;
        this._collapseOrbs.push({ gfx: orb });
    }

    _orbitCollapseOrbs(delta, px, py) {
        if (!this._collapseOrbs?.length) return;
        // Single shared angle — all orbs orbit at exactly the same speed
        if (this._collapseOrbAngle === undefined) this._collapseOrbAngle = 0;
        this._collapseOrbAngle += 2.5 * delta * 0.001;

        const count = this._collapseOrbs.length;
        const ORBIT_R = 30 + count * 2.8;
        for (let i = 0; i < count; i++) {
            const orb = this._collapseOrbs[i];
            if (!orb.gfx?.active) continue;
            // Evenly spaced — each orb gets a fixed slice of the circle
            const a = this._collapseOrbAngle + (i / count) * Math.PI * 2;
            orb.gfx.x = px + Math.cos(a) * ORBIT_R;
            orb.gfx.y = py + Math.sin(a) * ORBIT_R;
        }
    }

    _collapseOrbDamage() {
        if (!this._collapseOrbs?.length) return;
        const now = this.time.now;
        if (now - (this._collapseOrbLastDmg || 0) < 120) return;
        this._collapseOrbLastDmg = now;
        for (const orb of this._collapseOrbs) {
            if (!orb.gfx?.active) continue;
            for (const enemy of this.enemies) {
                if (!enemy.sprite?.active) continue;
                if (Math.hypot(enemy.sprite.x - orb.gfx.x, enemy.sprite.y - orb.gfx.y) < 14) {
                    this.damageEnemy(enemy, 5 * this.damageScaling);
                }
            }
        }
    }

    _collapseOrbBlockProjectiles() {
        if (!this._collapseOrbs?.length || !this.enemyProjectiles?.length) return;
        for (let i = this.enemyProjectiles.length - 1; i >= 0; i--) {
            const p = this.enemyProjectiles[i];
            if (!p.gfx?.active) continue;
            for (const orb of this._collapseOrbs) {
                if (!orb.gfx?.active) continue;
                if (Math.hypot(p.gfx.x - orb.gfx.x, p.gfx.y - orb.gfx.y) < 14) {
                    // Block — pop the projectile
                    const pop = this.add.graphics().setDepth(4);
                    pop.x = p.gfx.x; pop.y = p.gfx.y;
                    pop.fillStyle(0xcc44ff, 0.75); pop.fillCircle(0, 0, 8);
                    this.tweens.add({ targets: pop, scaleX: 2, scaleY: 2, alpha: 0, duration: 150, onComplete: () => pop.destroy() });
                    if (p.gfx.active) p.gfx.destroy();
                    this.enemyProjectiles.splice(i, 1);
                    break;
                }
            }
        }
    }

    _drawCollapseCursor() {
        if (!this._collapseDecaying) return;
        if (!this._collapseCursorGfx) {
            this._collapseCursorGfx = this.add.graphics().setDepth(6).setScrollFactor(0);
        }
        const g = this._collapseCursorGfx;
        g.clear();
        const mx = this.pointerX, my = this.pointerY;
        const R = 16;
        // Crosshair
        g.lineStyle(2, 0xcc44ff, 0.90);
        g.strokeCircle(mx, my, R);
        g.beginPath(); g.moveTo(mx - R - 6, my); g.lineTo(mx + R + 6, my); g.strokePath();
        g.beginPath(); g.moveTo(mx, my - R - 6); g.lineTo(mx, my + R + 6); g.strokePath();
        // Pulsing fill
        g.fillStyle(0x9900ff, 0.18 + 0.12 * Math.sin(this.time.now * 0.008));
        g.fillCircle(mx, my, R);
    }

    singularityCollapseRelease(targetX, targetY) {
        if (!this._collapseDecaying || !this._collapseOrbs?.length) return;

        const worldX = targetX + this.cameras.main.scrollX;
        const worldY = targetY + this.cameras.main.scrollY;
        const orbCount = this._collapseOrbs.length;
        const DMG = 18 * this.damageScaling;

        if (!this._launchingOrbs) this._launchingOrbs = [];

        for (const orb of this._collapseOrbs) {
            if (!orb.gfx?.active) continue;
            this._launchingOrbs.push({
                gfx:        orb.gfx,
                vx:         0,
                vy:         0,
                targetX:    worldX,
                targetY:    worldY,
                damage:     DMG,
                hitEnemies: new Set(),
                homeAccel:  1200,
            });
        }

        this.cameras.main.shake(60, 0.005);
        if (orbCount > 0) this.showStatusText(this.player.x, this.player.y - 32, `${orbCount} ORBS LAUNCHED`, '#cc44ff');
        this._collapseOrbs = [];
        this._endCollapseMode();
    }

    _updateLaunchingOrbs(delta) {
        if (!this._launchingOrbs?.length) return;
        const ds = delta / 1000;
        const TS = this.TILE_SIZE;

        for (let i = this._launchingOrbs.length - 1; i >= 0; i--) {
            const o = this._launchingOrbs[i];
            if (!o.gfx?.active) { this._launchingOrbs.splice(i, 1); continue; }

            // Steer toward target
            const dx = o.targetX - o.gfx.x;
            const dy = o.targetY - o.gfx.y;
            const dist = Math.hypot(dx, dy);
            if (dist > 4) {
                const dlen = dist;
                o.vx += (dx / dlen) * o.homeAccel * ds;
                o.vy += (dy / dlen) * o.homeAccel * ds;
                // Cap speed at 600 px/s
                const spd = Math.hypot(o.vx, o.vy);
                if (spd > 600) { o.vx = (o.vx / spd) * 600; o.vy = (o.vy / spd) * 600; }
            }

            o.gfx.x += o.vx * ds;
            o.gfx.y += o.vy * ds;

            // Pierce damage — hit any enemy in range that hasn't been hit yet
            for (const enemy of this.enemies) {
                if (!enemy.sprite?.active) continue;
                if (o.hitEnemies.has(enemy)) continue;
                if (Math.hypot(enemy.sprite.x - o.gfx.x, enemy.sprite.y - o.gfx.y) < TS * 0.6) {
                    this.damageEnemy(enemy, o.damage);
                    o.hitEnemies.add(enemy);
                    // Hit flash
                    const hf = this.add.graphics().setDepth(5);
                    hf.x = enemy.sprite.x; hf.y = enemy.sprite.y;
                    hf.fillStyle(0xcc44ff, 0.65); hf.fillCircle(0, 0, 10);
                    this.tweens.add({ targets: hf, scaleX: 1.8, scaleY: 1.8, alpha: 0, duration: 160, onComplete: () => hf.destroy() });
                }
            }

            // Hit wall or reached target
            const tx = Math.floor(o.gfx.x / TS), ty = Math.floor(o.gfx.y / TS);
            const oob = tx < 0 || tx >= this.WORLD_WIDTH || ty < 0 || ty >= this.WORLD_HEIGHT;
            const hitWall = oob || this.world[tx]?.[ty] === this.WALL || this.world[tx]?.[ty] === this.NOTHING;
            const atTarget = dist < TS * 0.5;

            if (hitWall || atTarget) {
                // Impact burst
                const imp = this.add.graphics().setDepth(5);
                imp.x = o.gfx.x; imp.y = o.gfx.y;
                imp.fillStyle(0x000000, 0.80); imp.fillCircle(0, 0, 14);
                imp.fillStyle(0x9900ff, 0.65); imp.fillCircle(0, 0, 10);
                imp.fillStyle(0xffffff, 0.85); imp.fillCircle(0, 0, 4);
                imp.lineStyle(2, 0xcc44ff, 0.90); imp.strokeCircle(0, 0, 14);
                this.tweens.add({ targets: imp, scaleX: 2.2, scaleY: 2.2, alpha: 0, duration: 250, ease: 'Quad.easeOut', onComplete: () => imp.destroy() });
                this.damageBossAtTile(tx, ty, o.damage);
                o.gfx.destroy();
                this._launchingOrbs.splice(i, 1);
            }
        }
    }

    _dissipateCollapseOrbs() {
        for (const orb of (this._collapseOrbs || [])) {
            if (!orb.gfx?.active) continue;
            this.tweens.add({ targets: orb.gfx, scaleX: 0, scaleY: 0, alpha: 0, duration: 200, onComplete: () => orb.gfx.destroy() });
        }
    }

    _endCollapseMode() {
        this._collapseBarActive = false;
        this._collapseDecaying  = false;
        this._collapseOrbs      = [];
        this._collapseOrbAngle  = 0;
        if (this._collapseCursorGfx?.active) { this._collapseCursorGfx.destroy(); this._collapseCursorGfx = null; }
        if (this._collapseBarGfx?.active)    { this._collapseBarGfx.destroy();    this._collapseBarGfx    = null; }
        if (this._collapseBarFill?.active)   { this._collapseBarFill.destroy();   this._collapseBarFill   = null; }
    }

    _updateCollapseBar(pct) {
        const W = 60, H = 7;
        const bx = this.player.x - this.cameras.main.scrollX - W / 2;
        const by = this.player.y - this.cameras.main.scrollY - 38;

        if (!this._collapseBarGfx?.active) {
            this._collapseBarGfx  = this.add.graphics().setDepth(6).setScrollFactor(0);
            this._collapseBarFill = this.add.graphics().setDepth(6).setScrollFactor(0);
        }
        this._collapseBarGfx.clear();
        this._collapseBarGfx.fillStyle(0x110022, 0.85); this._collapseBarGfx.fillRect(bx, by, W, H);
        this._collapseBarGfx.lineStyle(1.5, 0xcc44ff, 0.70); this._collapseBarGfx.strokeRect(bx, by, W, H);

        this._collapseBarFill.clear();
        const col = this._collapseDecaying ? 0xff44ff : 0xcc44ff;
        this._collapseBarFill.fillStyle(col, 0.90); this._collapseBarFill.fillRect(bx + 1, by + 1, (W - 2) * pct, H - 2);
    }

    orbEmitterAttack(targetX, targetY) {
        const currentTime = this.time.now;
        if (currentTime - (this._lastOrbTime || 0) < 700) return;
        this._lastOrbTime = currentTime;

        const worldX = targetX + this.cameras.main.scrollX;
        const worldY = targetY + this.cameras.main.scrollY;
        const px = this.player.x, py = this.player.y;
        const dx = worldX - px, dy = worldY - py;
        const len = Math.sqrt(dx*dx + dy*dy) || 1;

        const ORB_SPEED = 300; // px/s
        const ORB_DMG   = 10 * this.damageScaling;
        const FORK_RANGE = 3; // tiles
        const MAX_BOUNCES = 10;

        // Orb visual — electric sphere with inner glow and orbiting ring
        const gfx = this.add.graphics().setDepth(4);
        gfx.x = px; gfx.y = py;
        this._drawOrbEmitterGfx(gfx);

        if (!this.lightningOrbs) this.lightningOrbs = [];
        this.lightningOrbs.push({
            gfx,
            vx: (dx/len) * ORB_SPEED,
            vy: (dy/len) * ORB_SPEED,
            damage: ORB_DMG,
            bouncesLeft: MAX_BOUNCES,
            forkRange: FORK_RANGE,
            hitEnemies: new Set(), // enemies already hit this flight
            _createdAt: currentTime,
        });
        this.cameras.main.shake(15, 0.001);
    }

    _drawOrbEmitterGfx(gfx) {
        gfx.clear();
        // Outer glow
        gfx.fillStyle(0xffff00, 0.20);
        gfx.fillCircle(0, 0, 14);
        // Mid ring
        gfx.fillStyle(0xffdd00, 0.50);
        gfx.fillCircle(0, 0, 9);
        // Core
        gfx.fillStyle(0xffffff, 0.95);
        gfx.fillCircle(0, 0, 5);
        // Electric arc lines
        gfx.lineStyle(1.5, 0xffff88, 0.80);
        for (let i = 0; i < 5; i++) {
            const a = (i / 5) * Math.PI * 2;
            const r = 7 + Math.random() * 4;
            gfx.beginPath();
            gfx.moveTo(Math.cos(a)*4, Math.sin(a)*4);
            gfx.lineTo(Math.cos(a)*r, Math.sin(a)*r);
            gfx.strokePath();
        }
        // Orbit ring
        gfx.lineStyle(1.5, 0xffdd00, 0.55);
        gfx.strokeCircle(0, 0, 11);
    }

    _orbHitEnemy(orb, enemy) {
        const TS = this.TILE_SIZE;
        const ex = enemy.sprite.x, ey = enemy.sprite.y;

        // Damage with falloff per bounce (25% less each hit)
        const FALLOFF = 0.75;
        const hitDamage = orb.damage;
        orb.damage = orb.damage * FALLOFF; // reduce for next bounce

        // Mark enemy as superconducted
        enemy.isSuperConducted = true;
        enemy.superConductUntil = this.time.now + 5000;
        if (enemy.superConductVisual) {
            if (enemy.superConductVisual.container?.active) {
                this.tweens.killTweensOf(enemy.superConductVisual.container);
                enemy.superConductVisual.container.destroy();
            }
            enemy.superConductVisual = null;
        }
        const markGfx = this.add.graphics().setDepth(3);
        markGfx.lineStyle(2, 0xffff00, 0.90);
        markGfx.beginPath();
        markGfx.moveTo(-5, -8); markGfx.lineTo(0, -3); markGfx.lineTo(-3, 0); markGfx.lineTo(2, 6);
        markGfx.strokePath();
        markGfx.x = ex; markGfx.y = ey - 20;
        this.tweens.add({ targets: markGfx, alpha: 0.40, duration: 600, yoyo: true, repeat: -1 });
        enemy.superConductVisual = { container: markGfx, g: markGfx };

        // Damage
        this.damageEnemy(enemy, hitDamage);
        this.gainUltCharge(this.ultChargePerLightningHit);

        // Fork lightning to ALL nearby enemies regardless of superconductor (35% of impact damage)
        const FORK_R = orb.forkRange;
        const FORK_DMG = hitDamage * 0.35;
        const forkCandidates = this.enemies.filter(e =>
            e !== enemy && e.sprite?.active &&
            Math.abs(e.x - enemy.x) + Math.abs(e.y - enemy.y) <= FORK_R
        );
        for (const forkTarget of forkCandidates) {
            this.drawLightningBolt({ sprite: { x: ex, y: ey } }, forkTarget);
            this.damageEnemy(forkTarget, FORK_DMG);
        }
        // Fork to boss too
        this.damageBossAtTile(enemy.x, enemy.y, FORK_DMG);

        // Bounce — ONLY to superconducted enemies within range
        if (orb.bouncesLeft > 0) {
            orb.hitEnemies.add(enemy);
            const bounceTarget = this.enemies
                .filter(e => e.sprite?.active && !orb.hitEnemies.has(e) && e.isSuperConducted)
                .map(e => ({ e, d: Math.abs(e.x - enemy.x) + Math.abs(e.y - enemy.y) }))
                .filter(c => c.d <= 6)
                .sort((a, b) => a.d - b.d)[0]?.e;

            if (bounceTarget) {
                const tdx = bounceTarget.sprite.x - ex;
                const tdy = bounceTarget.sprite.y - ey;
                const tlen = Math.sqrt(tdx*tdx + tdy*tdy) || 1;
                orb.vx = (tdx/tlen) * 320;
                orb.vy = (tdy/tlen) * 320;
                orb.bouncesLeft--;
                // Bounce arc flash
                const arc = this.add.graphics().setDepth(3.5);
                arc.lineStyle(2, 0xffff00, 0.70);
                arc.beginPath(); arc.moveTo(ex, ey); arc.lineTo(bounceTarget.sprite.x, bounceTarget.sprite.y); arc.strokePath();
                this.tweens.add({ targets: arc, alpha: 0, duration: 120, onComplete: () => arc.destroy() });
                return; // keep orb alive, heading to bounce target
            }
        }
        // No valid superconducted bounce target — destroy
        orb._done = true;
    }

    updateLightningOrbs(delta) {
        if (!this.lightningOrbs?.length) return;
        const ds = delta / 1000;
        const TS = this.TILE_SIZE;

        for (let i = this.lightningOrbs.length - 1; i >= 0; i--) {
            const orb = this.lightningOrbs[i];
            if (orb._done || !orb.gfx?.active) {
                if (orb.gfx?.active) {
                    // Death burst — snapshot position before destroying, draw at local (0,0)
                    const bx = orb.gfx.x, by = orb.gfx.y;
                    orb.gfx.destroy();
                    const burst = this.add.graphics().setDepth(5);
                    burst.x = bx; burst.y = by;
                    burst.fillStyle(0xffff00, 0.70); burst.fillCircle(0, 0, 18);
                    burst.lineStyle(2, 0xffffff, 0.90); burst.strokeCircle(0, 0, 18);
                    this.tweens.add({ targets: burst, scaleX: 2, scaleY: 2, alpha: 0, duration: 300, onComplete: () => burst.destroy() });
                }
                this.lightningOrbs.splice(i, 1);
                continue;
            }

            // Move
            orb.gfx.x += orb.vx * ds;
            orb.gfx.y += orb.vy * ds;

            // Crack shrink — pierces, no effect on projectile flight (Level 4)
            this._checkProjectileCrackShrink(orb.gfx.x, orb.gfx.y);

            // Animate orb (redraw arc lines)
            this._drawOrbEmitterGfx(orb.gfx);

            // Trail spark — position the object, draw at local (0,0), fade only (no scale tween)
            if (Math.random() < 0.4) {
                const spark = this.add.graphics().setDepth(3.5);
                spark.x = orb.gfx.x; spark.y = orb.gfx.y;
                spark.fillStyle(0xffdd00, 0.70); spark.fillCircle(0, 0, 3);
                this.tweens.add({ targets: spark, alpha: 0, duration: 120, onComplete: () => spark.destroy() });
            }

            // Wall collision — destroy
            const tx = Math.floor(orb.gfx.x / TS), ty = Math.floor(orb.gfx.y / TS);
            const orbOob = tx < 0 || tx >= this.WORLD_WIDTH || ty < 0 || ty >= this.WORLD_HEIGHT;
            if (orbOob || this.world[tx]?.[ty] === this.WALL || this.world[tx]?.[ty] === this.NOTHING || this.isInLockedRoom(tx, ty)) {
                orb._done = true;
                continue;
            }

            // Max lifetime 4s
            if (this.time.now - orb._createdAt > 4000) { orb._done = true; continue; }

            // Enemy collision
            for (const enemy of this.enemies) {
                if (!enemy.sprite?.active || orb.hitEnemies.has(enemy)) continue;
                const edx = orb.gfx.x - enemy.sprite.x, edy = orb.gfx.y - enemy.sprite.y;
                if (Math.sqrt(edx*edx + edy*edy) < TS * 0.75) {
                    this._orbHitEnemy(orb, enemy);
                    break;
                }
            }

            // Portal collision (queen slime)
            const portalHit = this.getPortalAt(tx, ty);
            if (portalHit) {
                this.damagePortal(portalHit, orb.damage);
                orb._done = true;
                continue;
            }

            // Boss collision
            for (const boss of [this.voltslimeBoss, this.voidSovereignBoss, this.fractureCore].filter(Boolean)) {
                if (!boss.active) continue;
                const bx = boss.container?.x ?? boss.tileX * TS;
                const by = boss.container?.y ?? boss.tileY * TS;
                if (Math.hypot(orb.gfx.x - bx, orb.gfx.y - by) < TS * 2) {
                    this.damageBossAtTile(boss.tileX, boss.tileY, orb.damage);
                    orb._done = true;
                    break;
                }
            }
        }
    }

    applyIceFistsHit(enemy) {
        // Ice fists only — do not call from other weapons
        if (enemy._sniperInvisible) return; // invisible snipers immune to chill/freeze
        if (enemy.fireImmune) {
            if (enemy.sprite?.active) this.showStatusText(enemy.sprite.x, enemy.sprite.y - 10, 'IMMUNE', '#ff8844');
            return;
        }
        const time = this.time.now;
        // Check frozen BEFORE iceImmune — frozen ice elementals can be shattered
        if (enemy.isFrozen) { this._clearFreezeVisuals(enemy); this._triggerShatterBurst(enemy); return; }

        // Ice elementals (iceImmune) take NO chip damage — only chill stacks toward freeze/shatter
        if (!enemy.iceImmune) {
            const chipDmg = 12 * this.damageScaling;
            enemy.health -= chipDmg;
            this.showDamageNumber(enemy.sprite.x, enemy.sprite.y - 10, chipDmg, '#88eeff');
            this.updateEnemyHealthBar(enemy);
            this.gainUltCharge(this.ultChargePerHit);
            if (enemy.health <= 0) { this._destroyChillIndicator(enemy); this.killEnemy(enemy); return; }
        }

        this._updateChillIndicator(enemy);

        if (enemy.chillStacks >= 3) {
            enemy.chillStacks = 0;
            enemy.frozenAt = time;
            this._destroyChillIndicator(enemy);
            this.freezeEnemy(enemy, 10000);
            this.gainUltCharge(this.ultChargePerFreeze);
            enemy._freezeMeltTimer = this.time.delayedCall(10000, () => {
                if (enemy.sprite?.active) this._shatterWaterSplash(enemy.x, enemy.y);
            });
        }
    }

    applyIcicleCannonHit(enemy, damage, shatterMult = 0.5) {
        // Icicle cannon — completely independent of ice fists
        if (enemy._sniperInvisible) return; // invisible snipers immune to chill/freeze/slow
        if (enemy.fireImmune) {
            if (enemy.sprite?.active) this.showStatusText(enemy.sprite.x, enemy.sprite.y - 10, 'IMMUNE', '#ff8844');
            return;
        }
        if (enemy.isFrozen) { this._clearFreezeVisuals(enemy); this._triggerShatterBurst(enemy, shatterMult); return; } // cannon: scaled shatter

        if (!enemy.iceImmune) {
            enemy.health -= damage;
            this.showDamageNumber(enemy.sprite.x, enemy.sprite.y - 10, damage, '#88eeff');
            this.updateEnemyHealthBar(enemy);
            this.gainUltCharge(this.ultChargePerHit * 0.65); // icicle fires rapidly — reduced per-hit charge
            if (enemy.health <= 0) { this._destroyChillIndicator(enemy); this.killEnemy(enemy); return; }
        }

        const time = this.time.now;
        if (!enemy.chillStacks) enemy.chillStacks = 0;
        enemy.chillStacks++;
        enemy.lastChillTime = time;
        this._updateChillIndicator(enemy);

        if (enemy.chillStacks >= 3) {
            enemy.chillStacks = 0;
            enemy.frozenAt = time;
            this._destroyChillIndicator(enemy);
            this.freezeEnemy(enemy, 10000);
            this.gainUltCharge(this.ultChargePerFreeze * 0.65); // proportionally reduced freeze charge too
            enemy._freezeMeltTimer = this.time.delayedCall(10000, () => {
                if (enemy.sprite?.active) this._shatterWaterSplash(enemy.x, enemy.y);
            });
        }
    }

    applyFractalShardHit(enemy, damage) {
        // Fractal shard hit — independent of all other ice weapons
        // No brittle, own chill/freeze/shatter, own ult charge
        if (enemy._sniperInvisible) return; // invisible snipers immune to chill/freeze
        if (enemy.fireImmune) {
            if (enemy.sprite?.active) this.showStatusText(enemy.sprite.x, enemy.sprite.y - 10, 'IMMUNE', '#ff8844');
            return;
        }
        // Check frozen BEFORE iceImmune — frozen ice elementals can be shattered
        if (enemy.isFrozen) {
            this._triggerShatterBurst(enemy);
            return;
        }
        // Ice elementals: skip chip damage, only chill toward shatter
        if (!enemy.iceImmune) {
            enemy.health -= damage;
            this.showDamageNumber(enemy.sprite.x, enemy.sprite.y - 10, damage, '#88eeff');
            this.updateEnemyHealthBar(enemy);
            this.gainUltCharge(this.ultChargePerHit);
            if (enemy.health <= 0) { this._destroyChillIndicator(enemy); this.killEnemy(enemy); return; }
        }
        const time = this.time.now;
        if (!enemy.chillStacks) enemy.chillStacks = 0;
        enemy.chillStacks++;
        enemy.lastChillTime = time;
        this._updateChillIndicator(enemy);
        if (enemy.chillStacks >= 3) {
            enemy.chillStacks = 0;
            enemy.frozenAt = time;
            this._destroyChillIndicator(enemy);
            this.freezeEnemy(enemy, 10000);
            this.gainUltCharge(this.ultChargePerFreeze);
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
        // Hide entirely while sniper is invisible
        if (enemy._sniperInvisible) {
            for (const dot of enemy._chillBar) dot.setAlpha(0);
            return;
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

    _clearFreezeVisuals(enemy) {
        if (enemy._thawTimer) { enemy._thawTimer.remove(); enemy._thawTimer = null; }
        if (enemy.freezeVisuals) {
            if (enemy.freezeVisuals._extraLayers) {
                for (const l of enemy.freezeVisuals._extraLayers) { this.tweens.killTweensOf(l); l.destroy(); }
            }
            if (enemy.freezeVisuals.iceBlock)  { this.tweens.killTweensOf(enemy.freezeVisuals.iceBlock);  enemy.freezeVisuals.iceBlock.destroy(); }
            if (enemy.freezeVisuals.iceBorder) { this.tweens.killTweensOf(enemy.freezeVisuals.iceBorder); enemy.freezeVisuals.iceBorder.destroy(); }
            enemy.freezeVisuals = null;
        }
        if (enemy.sprite?.active && typeof enemy.sprite.clearTint === 'function') enemy.sprite.clearTint();
    }

    _triggerShatterBurst(enemy, shatterMult = 1.0) {
        // Don't shatter if the enemy was frozen in the last 200ms (same-frame pierce spike freeze)
        if (enemy._justFrozenAt && this.time.now - enemy._justFrozenAt < 200) return;
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
            this.cameras.main.shake(20, 0.001);
            this.showStatusText(ex, ey - 28, 'SHATTER!', '#aaffff');
            this.gainUltCharge(this.ultChargePerFreeze * 2);

            // Cancel natural-melt timer
            if (enemy._freezeMeltTimer) { enemy._freezeMeltTimer.remove(); enemy._freezeMeltTimer = null; }

            // Unfreeze BEFORE dealing damage — damageEnemy applies 2.5x frozenBonus
            // while isFrozen is true, which would inflate shatter to 250 damage
            enemy.isFrozen = false;
            enemy.frozenUntil = 0;
            enemy.frozenAt = 0;
            this._clearFreezeVisuals(enemy);

            // Shatter burst damage — shatterMult is per-weapon (fractal=1.0/default, cannon=~0.133)
            const shatterDmg = 7.5 * shatterMult * this.damageScaling * (enemy._purpleMarked ? 2.0 : 1);
            if (enemy.iceImmune) {
                enemy.health -= shatterDmg;
                this.gainUltCharge(this.ultChargePerHit * 2);
                this.showDamageNumber(ex, ey - 44, shatterDmg, '#ffffff');
                this.updateEnemyHealthBar(enemy);
                if (enemy.health <= 0) this.killEnemy(enemy);
            } else {
                this.damageEnemy(enemy, shatterDmg);
                this.showDamageNumber(ex, ey - 44, shatterDmg, '#ffffff');
            }
            this.damageBossAtTile(enemy.x, enemy.y, shatterDmg);
            this._shatterWaterSplash(enemy.x, enemy.y);

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

                    const tile    = this.add.rectangle(wx, wy, this.TILE_SIZE,     this.TILE_SIZE,     0x0055aa, 0.65).setDepth(0.5).setAlpha(0);
                    const shimmer = this.add.rectangle(wx, wy, this.TILE_SIZE - 4, this.TILE_SIZE - 4, 0x3388cc, 0.4 ).setDepth(0.5).setAlpha(0);

                    // Continuous shimmer like tsunami puddles
                    this.tweens.add({ targets: shimmer, alpha: 0.6, duration: 150 + Math.random() * 100, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });

                    // Fade in
                    this.tweens.add({ targets: tile,    alpha: 0.65, duration: 350, ease: 'Quad.easeOut' });
                    this.tweens.add({ targets: shimmer, alpha: 0.4,  duration: 350, ease: 'Quad.easeOut' });

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
                        if (enemy.sprite?.active && typeof enemy.sprite.setTint === 'function') {
                            enemy.sprite.setTint(0x4499ff);
                            this.showStatusText(enemy.sprite.x, enemy.sprite.y, 'WET', '#44aaff');
                            this.time.delayedCall(WET_DURATION, () => {
                                enemy.isWet = false;
                                if (enemy.sprite?.active && !enemy.isFrozen && typeof enemy.sprite.clearTint === 'function') enemy.sprite.clearTint();
                            });
                        }
                    }
                }
            });
        }
    }

    fractalShardAttack(targetX, targetY) {
        const currentTime = this.time.now;
        if (currentTime - (this.lastFractalShardTime || 0) < 600) return;
        this.lastFractalShardTime = currentTime;

        if (this._fractalPhase === undefined) this._fractalPhase = 0;

        const playerPx = this.playerX * this.TILE_SIZE + this.TILE_SIZE / 2;
        const playerPy = this.playerY * this.TILE_SIZE + this.TILE_SIZE / 2;
        const worldX = targetX + this.cameras.main.scrollX;
        const worldY = targetY + this.cameras.main.scrollY;
        const angle = Math.atan2(worldY - playerPy, worldX - playerPx);

        if (this._fractalPhase === 0) {
            // ── PHASE 1: PIERCING FREEZE SPIKE ───────────────────────────
            this._fractalPhase = 1;

            // ── ANIME IMPACT FRAME ──────────────────────────────────────
            // Layer 1: hard white screen flash (tiny duration, sells the impact)
            const flash = this.add.rectangle(0, 0, this.scale.width * 2, this.scale.height * 2, 0xffffff, 0.18)
                .setScrollFactor(0).setDepth(10).setOrigin(0.5);
            this.tweens.add({ targets: flash, alpha: 0, duration: 60, onComplete: () => flash.destroy() });

            // Layer 2: spiky rotating star at muzzle — 8 long sharp points alternating long/short
            const star = this.add.graphics().setDepth(9);
            star.x = playerPx; star.y = playerPy;
            const SPIKES = 8, LONG = 28, SHORT = 11;
            star.fillStyle(0xffffff, 1.0);
            star.beginPath();
            for (let i = 0; i < SPIKES * 2; i++) {
                const sa = (i / (SPIKES * 2)) * Math.PI * 2 - Math.PI / 2;
                const r = i % 2 === 0 ? LONG : SHORT;
                if (i === 0) star.moveTo(Math.cos(sa)*r, Math.sin(sa)*r);
                else star.lineTo(Math.cos(sa)*r, Math.sin(sa)*r);
            }
            star.closePath(); star.fillPath();
            // Inner star tinted ice-blue
            star.fillStyle(0xaaeeff, 0.80);
            star.beginPath();
            for (let i = 0; i < SPIKES * 2; i++) {
                const sa = (i / (SPIKES * 2)) * Math.PI * 2 - Math.PI / 2;
                const r = i % 2 === 0 ? LONG * 0.55 : SHORT * 0.55;
                if (i === 0) star.moveTo(Math.cos(sa)*r, Math.sin(sa)*r);
                else star.lineTo(Math.cos(sa)*r, Math.sin(sa)*r);
            }
            star.closePath(); star.fillPath();
            // Bright core
            star.fillStyle(0xffffff, 1.0); star.fillCircle(0, 0, 6);
            // Rotate and expand outward, fading fast
            this.tweens.add({
                targets: star,
                angle: 45, scaleX: 2.2, scaleY: 2.2, alpha: 0,
                duration: 160, ease: 'Quad.easeOut',
                onComplete: () => star.destroy()
            });

            // Layer 3: shockwave ring expanding outward
            const ring = this.add.graphics().setDepth(8);
            ring.x = playerPx; ring.y = playerPy;
            ring.lineStyle(3.5, 0xffffff, 0.90); ring.strokeCircle(0, 0, 8);
            ring.lineStyle(1.5, 0x88ddff, 0.70); ring.strokeCircle(0, 0, 14);
            this.tweens.add({ targets: ring, scaleX: 4.5, scaleY: 4.5, alpha: 0, duration: 200, ease: 'Quad.easeOut', onComplete: () => ring.destroy() });

            // Layer 4: speed lines — 6 long streaks blasting backward away from fire direction
            const lines = this.add.graphics().setDepth(8);
            lines.x = playerPx; lines.y = playerPy;
            for (let i = 0; i < 6; i++) {
                const sa = angle + Math.PI + (i - 2.5) * 0.22; // fan backward
                const len = 20 + Math.random() * 22;
                lines.lineStyle(1.5 - i * 0.1, i % 2 === 0 ? 0xffffff : 0x88ddff, 0.85 - i * 0.05);
                lines.beginPath(); lines.moveTo(Math.cos(sa)*6, Math.sin(sa)*6); lines.lineTo(Math.cos(sa)*len, Math.sin(sa)*len); lines.strokePath();
            }
            this.tweens.add({ targets: lines, scaleX: 1.6, scaleY: 1.6, alpha: 0, duration: 130, onComplete: () => lines.destroy() });

            this._spawnPierceSpike(playerPx, playerPy, angle);

        } else {
            // ── PHASE 2: UNSTABLE SPLITTER ────────────────────────────────
            this._fractalPhase = 0;
            // Phase 2 has a longer effective cooldown — override timer
            this.lastFractalShardTime = currentTime + 1400; // total ~2s before next shot

            // Muzzle flash — unstable crackling burst
            const muzzle = this.add.graphics().setDepth(4);
            muzzle.x = playerPx; muzzle.y = playerPy;
            muzzle.fillStyle(0xffffff, 0.85); muzzle.fillCircle(0, 0, 8);
            muzzle.fillStyle(0xaaeeff, 0.40); muzzle.fillCircle(0, 0, 18);
            for (let i = 0; i < 8; i++) {
                const sa = angle + (i / 8) * Math.PI * 2;
                muzzle.lineStyle(2.0, i % 2 === 0 ? 0xffffff : 0x44bbff, 0.88);
                muzzle.beginPath(); muzzle.moveTo(Math.cos(sa)*5, Math.sin(sa)*5); muzzle.lineTo(Math.cos(sa)*22, Math.sin(sa)*22); muzzle.strokePath();
                if (i % 2 === 0) {
                    const cx = Math.cos(sa)*14, cy = Math.sin(sa)*14;
                    muzzle.lineStyle(1.0, 0xbbefff, 0.65);
                    muzzle.beginPath(); muzzle.moveTo(cx - Math.sin(sa)*5, cy + Math.cos(sa)*5); muzzle.lineTo(cx + Math.sin(sa)*5, cy - Math.cos(sa)*5); muzzle.strokePath();
                }
            }
            muzzle.lineStyle(1.5, 0x88ddff, 0.55); muzzle.strokeCircle(0, 0, 20);
            this.tweens.add({ targets: muzzle, scaleX: 3.0, scaleY: 3.0, alpha: 0, duration: 300, ease: 'Quad.easeOut', onComplete: () => muzzle.destroy() });

            this._spawnSplitterShard(playerPx, playerPy, angle, 0);
        }
    }

    // ── PHASE 1: Piercing freeze spike ────────────────────────────────────
    _clearShatterMark(enemy) {
        if (enemy._shatterMarkTimer)  { enemy._shatterMarkTimer.remove();  enemy._shatterMarkTimer  = null; }
        if (enemy._purpleMarkTimer)   { enemy._purpleMarkTimer.remove();   enemy._purpleMarkTimer   = null; }
        if (enemy._shatterMarkVisual) {
            this.tweens.killTweensOf(enemy._shatterMarkVisual);
            enemy._shatterMarkVisual.destroy();
            enemy._shatterMarkVisual = null;
        }
        enemy._shatterMarked = false;
        enemy._purpleMarked  = false;
    }

    _applyGoldMark(enemy, ex, ey) {
        const MARK_DURATION = 6000;
        this._clearShatterMark(enemy);
        enemy._shatterMarked = true;
        enemy._purpleMarked  = false;
        enemy._shatterMarkTimer = this.time.delayedCall(MARK_DURATION, () => this._clearShatterMark(enemy));

        const mv = this.add.graphics().setDepth(4.5);
        mv.x = ex; mv.y = ey - 20;
        mv.fillStyle(0xffcc00, 0.95);
        mv.beginPath(); mv.moveTo(0, -8); mv.lineTo(6, 0); mv.lineTo(0, 8); mv.lineTo(-6, 0); mv.closePath(); mv.fillPath();
        mv.fillStyle(0xffff88, 0.85);
        mv.beginPath(); mv.moveTo(0, -5); mv.lineTo(3, 0); mv.lineTo(0, 5); mv.lineTo(-3, 0); mv.closePath(); mv.fillPath();
        mv.lineStyle(1.0, 0xaa7700, 0.80);
        mv.beginPath(); mv.moveTo(-2, -4); mv.lineTo(1, 0); mv.lineTo(-1, 4); mv.strokePath();
        mv.lineStyle(1.2, 0xffee44, 0.90);
        mv.beginPath(); mv.moveTo(0,-8); mv.lineTo(6,0); mv.lineTo(0,8); mv.lineTo(-6,0); mv.closePath(); mv.strokePath();
        enemy._shatterMarkVisual = mv;
        this.tweens.add({ targets: mv, scaleX: 1.25, scaleY: 1.25, alpha: 0.65, duration: 400, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    }

    _applyPurpleMark(enemy, ex, ey) {
        // Upgrade from gold — 2× damage from ALL sources, longer duration
        const MARK_DURATION = 7000;
        this._clearShatterMark(enemy);
        enemy._shatterMarked = true;
        enemy._purpleMarked  = true;
        enemy._purpleMarkTimer = this.time.delayedCall(MARK_DURATION, () => this._clearShatterMark(enemy));

        // Upgrade flash
        const flash = this.add.graphics().setDepth(5);
        flash.x = ex; flash.y = ey;
        flash.fillStyle(0xcc44ff, 0.7); flash.fillCircle(0, 0, 22);
        flash.fillStyle(0xffffff, 0.9); flash.fillCircle(0, 0, 8);
        this.tweens.add({ targets: flash, scaleX: 2.5, scaleY: 2.5, alpha: 0, duration: 280, onComplete: () => flash.destroy() });
        this.showStatusText(ex, ey - 32, 'AMPLIFIED!', '#cc44ff');
        this.cameras.main.shake(40, 0.004);

        const mv = this.add.graphics().setDepth(4.5);
        mv.x = ex; mv.y = ey - 20;
        // Outer purple diamond — larger than gold
        mv.fillStyle(0xaa22ff, 0.95);
        mv.beginPath(); mv.moveTo(0, -11); mv.lineTo(8, 0); mv.lineTo(0, 11); mv.lineTo(-8, 0); mv.closePath(); mv.fillPath();
        // Inner violet highlight
        mv.fillStyle(0xdd88ff, 0.85);
        mv.beginPath(); mv.moveTo(0, -7); mv.lineTo(5, 0); mv.lineTo(0, 7); mv.lineTo(-5, 0); mv.closePath(); mv.fillPath();
        // Bright core
        mv.fillStyle(0xffffff, 0.95); mv.fillCircle(0, 0, 2.5);
        // Electric outline
        mv.lineStyle(1.5, 0xff88ff, 0.90);
        mv.beginPath(); mv.moveTo(0,-11); mv.lineTo(8,0); mv.lineTo(0,11); mv.lineTo(-8,0); mv.closePath(); mv.strokePath();
        // Small arcs radiating off the diamond
        for (let i = 0; i < 4; i++) {
            const a = (i / 4) * Math.PI * 2;
            mv.lineStyle(0.8, 0xcc44ff, 0.60);
            mv.beginPath(); mv.moveTo(Math.cos(a)*8, Math.sin(a)*8); mv.lineTo(Math.cos(a)*13, Math.sin(a)*13); mv.strokePath();
        }
        enemy._shatterMarkVisual = mv;
        this.tweens.add({ targets: mv, scaleX: 1.3, scaleY: 1.3, alpha: 0.55, duration: 280, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    }

    _applyGoldMarkBoss() {
        const boss = this.voltslimeBoss;
        if (!boss?.active) return;
        const DURATION = 6000;
        if (boss._shatterMarkTimer) { boss._shatterMarkTimer.remove(); boss._shatterMarkTimer = null; }
        if (boss._shatterMarkVisual) { this.tweens.killTweensOf(boss._shatterMarkVisual); boss._shatterMarkVisual.destroy(); boss._shatterMarkVisual = null; }
        boss._shatterMarked = true; boss._purpleMarked = false;
        boss._shatterMarkTimer = this.time.delayedCall(DURATION, () => {
            boss._shatterMarked = false;
            if (boss._shatterMarkVisual) { this.tweens.killTweensOf(boss._shatterMarkVisual); boss._shatterMarkVisual.destroy(); boss._shatterMarkVisual = null; }
        });
        const mv = this.add.graphics().setDepth(9);
        mv.x = boss.container.x;
        mv.y = boss.container.y - 100;
        mv.beginPath(); mv.moveTo(0,-14); mv.lineTo(10,0); mv.lineTo(0,14); mv.lineTo(-10,0); mv.closePath(); mv.fillPath();
        mv.fillStyle(0xffff88, 0.85);
        mv.beginPath(); mv.moveTo(0,-9); mv.lineTo(6,0); mv.lineTo(0,9); mv.lineTo(-6,0); mv.closePath(); mv.fillPath();
        mv.lineStyle(1.8, 0xffee44, 0.90);
        mv.beginPath(); mv.moveTo(0,-14); mv.lineTo(10,0); mv.lineTo(0,14); mv.lineTo(-10,0); mv.closePath(); mv.strokePath();
        boss._shatterMarkVisual = mv;
        this.tweens.add({ targets: mv, scaleX: 1.25, scaleY: 1.25, alpha: 0.65, duration: 400, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    }

    _applyPurpleMarkBoss() {
        const boss = this.voltslimeBoss;
        if (!boss?.active) return;
        const DURATION = 7000;
        if (boss._shatterMarkTimer) { boss._shatterMarkTimer.remove(); boss._shatterMarkTimer = null; }
        if (boss._shatterMarkVisual) { this.tweens.killTweensOf(boss._shatterMarkVisual); boss._shatterMarkVisual.destroy(); boss._shatterMarkVisual = null; }
        boss._shatterMarked = true; boss._purpleMarked = true;
        boss._shatterMarkTimer = this.time.delayedCall(DURATION, () => {
            boss._shatterMarked = false; boss._purpleMarked = false;
            if (boss._shatterMarkVisual) { this.tweens.killTweensOf(boss._shatterMarkVisual); boss._shatterMarkVisual.destroy(); boss._shatterMarkVisual = null; }
        });
        const flash = this.add.graphics().setDepth(9);
        flash.x = boss.container.x; flash.y = boss.container.y - 65;
        flash.fillStyle(0xcc44ff, 0.7); flash.fillCircle(0, 0, 30);
        this.tweens.add({ targets: flash, scaleX: 2.5, scaleY: 2.5, alpha: 0, duration: 280, onComplete: () => flash.destroy() });
        this.showStatusText(boss.container.x, boss.container.y - 120, 'AMPLIFIED!', '#cc44ff');
        const mv = this.add.graphics().setDepth(9);
        mv.x = boss.container.x;
        mv.y = boss.container.y - 100;
        mv.fillStyle(0xaa22ff, 0.95);
        mv.beginPath(); mv.moveTo(0,-18); mv.lineTo(13,0); mv.lineTo(0,18); mv.lineTo(-13,0); mv.closePath(); mv.fillPath();
        mv.fillStyle(0xdd88ff, 0.85);
        mv.beginPath(); mv.moveTo(0,-11); mv.lineTo(8,0); mv.lineTo(0,11); mv.lineTo(-8,0); mv.closePath(); mv.fillPath();
        mv.fillStyle(0xffffff, 0.95); mv.fillCircle(0, 0, 3.5);
        mv.lineStyle(2, 0xff88ff, 0.90);
        mv.beginPath(); mv.moveTo(0,-18); mv.lineTo(13,0); mv.lineTo(0,18); mv.lineTo(-13,0); mv.closePath(); mv.strokePath();
        boss._shatterMarkVisual = mv;
        this.tweens.add({ targets: mv, scaleX: 1.3, scaleY: 1.3, alpha: 0.55, duration: 280, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    }

    _spawnPierceSpike(x, y, angle) {
        const SPEED  = 580;  // very fast — feels like a bullet
        const DAMAGE = 12 * this.damageScaling;
        const vx = Math.cos(angle) * SPEED;
        const vy = Math.sin(angle) * SPEED;

        // Main bullet — elongated bright needle, pointed forward
        const g = this.add.graphics().setDepth(3.5);
        g.x = x; g.y = y;

        // Pierce spike — crisp arrow-head needle, pixel-art style
        const LEN = 20, WID = 4;

        // Deep blue body
        g.fillStyle(0x1166bb, 1.0);
        g.beginPath(); g.moveTo(0, -LEN); g.lineTo(WID, -LEN*0.2); g.lineTo(WID*0.6, LEN*0.5); g.lineTo(-WID*0.6, LEN*0.5); g.lineTo(-WID, -LEN*0.2); g.closePath(); g.fillPath();

        // Lit left face
        g.fillStyle(0x44aaee, 0.75);
        g.beginPath(); g.moveTo(0, -LEN); g.lineTo(-WID, -LEN*0.2); g.lineTo(-WID*0.6, LEN*0.5); g.lineTo(0, LEN*0.35); g.closePath(); g.fillPath();

        // Bright edge line
        g.lineStyle(1.5, 0x99ddff, 0.90);
        g.beginPath(); g.moveTo(-WID*0.8, -LEN*0.15); g.lineTo(-WID*0.4, LEN*0.4); g.strokePath();

        // Pure white tip
        g.fillStyle(0xffffff, 1.0);
        g.beginPath(); g.moveTo(0, -LEN); g.lineTo(2.5, -LEN*0.6); g.lineTo(-2.5, -LEN*0.6); g.closePath(); g.fillPath();

        // Bright outline
        g.lineStyle(1.2, 0xaaddff, 0.85);
        g.beginPath(); g.moveTo(0, -LEN); g.lineTo(WID, -LEN*0.2); g.lineTo(WID*0.6, LEN*0.5); g.lineTo(-WID*0.6, LEN*0.5); g.lineTo(-WID, -LEN*0.2); g.closePath(); g.strokePath();

        g._glow = null;

        const shardObj = {
            sprite: g, vx, vy,
            startX: x, startY: y,
            damage: DAMAGE,
            createdAt: this.time.now,
            lastTrailTime: 0,
            _lastAfterimageTime: 0,
            isCannonShard: true,
            isPierceSpike: true,
            hitEnemies: new Set(),
            piercedEnemies: new Set(),
        };
        this.iceShards.push(shardObj);
    }

    // ── FROST TOTEM — spawns on first pierce spike hit ─────────────────────
    _spawnFrostTotem(px, py) {
        const TOTEM_DUR      = 5000;   // 5s
        const CHILL_RADIUS   = 2;      // tiles
        const CHILL_INTERVAL = 500;    // ms between stack applications

        // Destroy any existing totem
        if (this._activeFrostTotem) {
            this._activeFrostTotem.destroy();
            this._activeFrostTotem = null;
        }

        // ── Crystal pillar visual — compact, fits one tile ───────────────────
        const g = this.add.graphics().setDepth(2.5);
        g.x = px; g.y = py;

        // Ground shadow
        g.fillStyle(0x44aaff, 0.15); g.fillEllipse(0, 2, 14, 6);

        // Main crystal body — small pillar
        g.fillStyle(0x99eeff, 0.88);
        g.beginPath(); g.moveTo(0, -14); g.lineTo(5, -7); g.lineTo(5, 3); g.lineTo(0, 5); g.lineTo(-5, 3); g.lineTo(-5, -7); g.closePath(); g.fillPath();

        // Inner bright face
        g.fillStyle(0xddf8ff, 0.65);
        g.beginPath(); g.moveTo(0, -14); g.lineTo(3, -7); g.lineTo(3, 3); g.lineTo(0, 5); g.closePath(); g.fillPath();

        // Outline
        g.lineStyle(0.8, 0xffffff, 0.55);
        g.beginPath(); g.moveTo(0, -14); g.lineTo(5, -7); g.lineTo(5, 3); g.lineTo(0, 5); g.lineTo(-5, 3); g.lineTo(-5, -7); g.closePath(); g.strokePath();

        // Top tip
        g.fillStyle(0xffffff, 0.95);
        g.beginPath(); g.moveTo(0, -18); g.lineTo(3, -12); g.lineTo(-3, -12); g.closePath(); g.fillPath();

        // Ambient glow
        g.fillStyle(0x44aaff, 0.20); g.fillCircle(0, -5, 8);

        // Radius ring
        const radiusPx = CHILL_RADIUS * this.TILE_SIZE;
        g.lineStyle(0.8, 0x44aaff, 0.18); g.strokeCircle(0, 0, radiusPx);

        // Fade in
        g.setAlpha(0);
        this.tweens.add({ targets: g, alpha: 1, duration: 180, ease: 'Quad.easeOut' });

        // Pulse glow tween
        this.tweens.add({ targets: g, alpha: 0.75, duration: 600, yoyo: true, repeat: -1, ease: 'Sine.easeInOut', delay: 200 });

        // Particle emit every tick — small ice crystals drifting up
        const particleTimer = this.time.addEvent({
            delay: 280, loop: true,
            callback: () => {
                if (!g.active) { particleTimer.remove(); return; }
                const pg = this.add.graphics().setDepth(3);
                pg.x = px + (Math.random()-0.5)*16;
                pg.y = py - 8 + (Math.random()-0.5)*8;
                pg.fillStyle(Math.random() > 0.5 ? 0xaaeeff : 0xffffff, 0.80);
                pg.fillCircle(0, 0, 1.5 + Math.random()*1.5);
                this.tweens.add({ targets: pg, y: pg.y - 14, alpha: 0, duration: 500 + Math.random()*300, onComplete: () => pg.destroy() });
            }
        });

        // ── Chill tick — every 500ms, apply 1 chill stack to enemies in radius ──
        const chillTimer = this.time.addEvent({
            delay: CHILL_INTERVAL, loop: true,
            callback: () => {
                if (!g.active) { chillTimer.remove(); return; }
                const tpx = Math.floor(px / this.TILE_SIZE);
                const tpy = Math.floor(py / this.TILE_SIZE);
                for (const enemy of this.enemies) {
                    if (!enemy.sprite?.active || enemy.health <= 0) continue;
                    if (enemy.fireImmune || enemy.elementImmune) continue;
                    if (enemy.isFrozen) continue; // already frozen — don't re-stack chill
                    const dx = enemy.x - tpx, dy = enemy.y - tpy;
                    if (Math.sqrt(dx*dx + dy*dy) > CHILL_RADIUS) continue;
                    // Apply chill stack — ignores iceImmune (that's the whole point)
                    if (!enemy.chillStacks) enemy.chillStacks = 0;
                    enemy.chillStacks++;
                    enemy.lastChillTime = this.time.now;
                    this._updateChillIndicator(enemy);
                    if (enemy.chillStacks >= 3) {
                        enemy.chillStacks = 0;
                        this._destroyChillIndicator(enemy);
                        this.freezeEnemy(enemy, 4000);
                        this.gainUltCharge(this.ultChargePerFreeze);
                        this.showStatusText(enemy.sprite.x, enemy.sprite.y - 12, 'FROZEN', '#88ddff');
                    }
                    // Small chill puff visual
                    const cf = this.add.graphics().setDepth(3.5);
                    cf.x = enemy.sprite.x; cf.y = enemy.sprite.y - 10;
                    cf.fillStyle(0xaaeeff, 0.70); cf.fillCircle(0, 0, 2.5);
                    this.tweens.add({ targets: cf, y: cf.y - 8, alpha: 0, duration: 350, onComplete: () => cf.destroy() });
                }
                // Boss chill tick
                if (this.voltslimeBoss?.active) {
                    const boss = this.voltslimeBoss;
                    const bdx = boss.tileX - tpx, bdy = boss.tileY - tpy;
                    if (Math.sqrt(bdx*bdx + bdy*bdy) <= CHILL_RADIUS) {
                        if (typeof this.freezeBossFromIceWeapon === 'function')
                            this.freezeBossFromIceWeapon(false);
                    }
                }
            }
        });

        // Destroy after duration
        this.time.delayedCall(TOTEM_DUR, () => {
            particleTimer.remove();
            chillTimer.remove();
            if (g.active) {
                this.tweens.killTweensOf(g);
                this.tweens.add({ targets: g, alpha: 0, scaleX: 0.5, scaleY: 0.5, duration: 300, ease: 'Quad.easeIn', onComplete: () => g.destroy() });
            }
            if (this._activeFrostTotem === totemObj) this._activeFrostTotem = null;
        });

        const totemObj = { destroy: () => { particleTimer.remove(); chillTimer.remove(); this.tweens.killTweensOf(g); if (g.active) g.destroy(); } };
        this._activeFrostTotem = totemObj;
    }

    // ── PHASE 2: Unstable splitter ─────────────────────────────────────────
    // Each shard splits into 2 after SPLIT_INTERVAL ms. Capped at gen 4
    // (1 → 2 → 4 → 8 → 16, max 31 total projectiles per shot).
    _spawnSplitterShard(x, y, angle, gen) {
        const MAX_GEN      = 4;
        const SPLIT_INTERVAL = 250; // ms between splits
        const SPEEDS     = [160, 130, 105, 85, 70];
        const DAMAGES    = [14,   9,   5,   3,  2];
        const SIZES      = [8,    6,   5,   4,  3];

        const speed  = SPEEDS[gen];
        const damage = DAMAGES[gen] * this.damageScaling;
        const size   = SIZES[gen];
        const vx = Math.cos(angle) * speed;
        const vy = Math.sin(angle) * speed;

        // Visual: jagged unstable crystal — darker and more fractured each gen
        // Colour shifts from bright white-blue (gen0) to deep teal (gen3)
        const colours = [
            { body: 0x88ddff, mid: 0xddf8ff, rim: 0xffffff },
            { body: 0x44bbdd, mid: 0xaaeeff, rim: 0xddf8ff },
            { body: 0x2299bb, mid: 0x77ccee, rim: 0xbbefff },
            { body: 0x116688, mid: 0x44aacc, rim: 0x88ddee },
            { body: 0x0a3344, mid: 0x226688, rim: 0x55aabb },
        ];
        const col = colours[Math.min(gen, colours.length - 1)];

        const g = this.add.graphics().setDepth(3 + gen * 0.05);
        g.x = x; g.y = y;

        const S = size;
        // Body — asymmetric jagged crystal (not symmetric icicle, looks "unstable")
        const jag = 0.15 + gen * 0.08; // more jagged each generation
        g.fillStyle(col.body, 0.88);
        g.beginPath();
        g.moveTo(0, -S);
        g.lineTo(S*(0.55+jag), -S*0.2);
        g.lineTo(S*(0.8-jag),   S*0.3);
        g.lineTo(S*0.2,         S*(0.7+jag));
        g.lineTo(-S*0.2,        S*(0.7+jag));
        g.lineTo(-S*(0.8-jag),  S*0.3);
        g.lineTo(-S*(0.55+jag), -S*0.2);
        g.closePath();
        g.fillPath();

        // Lit face
        g.fillStyle(col.mid, 0.45);
        g.beginPath();
        g.moveTo(0, -S);
        g.lineTo(-S*(0.55+jag), -S*0.2);
        g.lineTo(-S*(0.3),        S*0.5);
        g.lineTo(0, S*0.6);
        g.closePath();
        g.fillPath();

        // Central highlight
        g.fillStyle(col.rim, 0.55);
        g.beginPath(); g.moveTo(0, -S*0.9); g.lineTo(S*0.18, -S*0.1); g.lineTo(S*0.10, S*0.4); g.lineTo(-S*0.10, S*0.4); g.lineTo(-S*0.18, -S*0.1); g.closePath(); g.fillPath();

        // Crack lines (more cracks = higher gen)
        g.lineStyle(0.7, col.rim, 0.35);
        g.beginPath(); g.moveTo(-S*0.35, -S*0.15); g.lineTo(S*0.25, S*0.35); g.strokePath();
        if (gen >= 1) { g.beginPath(); g.moveTo(S*0.30, -S*0.10); g.lineTo(-S*0.15, S*0.40); g.strokePath(); }
        if (gen >= 2) { g.lineStyle(0.5, col.rim, 0.25); g.beginPath(); g.moveTo(-S*0.20, S*0.15); g.lineTo(S*0.35, S*0.50); g.strokePath(); }

        // Tip flash
        g.fillStyle(col.rim, 0.95);
        g.beginPath(); g.moveTo(0, -S); g.lineTo(S*0.18, -S*0.55); g.lineTo(-S*0.18, -S*0.55); g.closePath(); g.fillPath();

        // Outline
        g.lineStyle(0.9, col.mid, 0.65);
        g.beginPath();
        g.moveTo(0, -S);
        g.lineTo(S*(0.55+jag), -S*0.2); g.lineTo(S*(0.8-jag), S*0.3);
        g.lineTo(S*0.2, S*(0.7+jag)); g.lineTo(-S*0.2, S*(0.7+jag));
        g.lineTo(-S*(0.8-jag), S*0.3); g.lineTo(-S*(0.55+jag), -S*0.2);
        g.closePath(); g.strokePath();

        g._glow = null;

        const shardObj = {
            sprite: g, vx, vy,
            startX: x, startY: y,
            damage,
            createdAt: this.time.now,
            lastTrailTime: 0,
            isCannonShard: true,
            isSplitter: true,
            splitterGen: gen,
            splitterCanSplit: gen < MAX_GEN,
            splitterAngle: angle,
            hitEnemies: new Set(),
            piercedEnemies: new Set(),
            isRecalling: false,
        };

        // Schedule the split
        if (gen < MAX_GEN) {
            shardObj._splitTimer = this.time.delayedCall(SPLIT_INTERVAL, () => {
                if (!shardObj.sprite?.active) return;
                this._triggerSplitterSplit(shardObj);
            });
        }

        // Gen 4 fragments: after a brief travel window, snap back to player
        if (gen === MAX_GEN) {
            shardObj._recallTimer = this.time.delayedCall(1200, () => {
                if (!shardObj.sprite?.active) return;
                shardObj.isRecalling = true;
                shardObj.hitEnemies = new Set(); // reset so return path can re-hit
                shardObj._recallDamage = damage * 2.2; // boosted return damage
            });
        }

        this.iceShards.push(shardObj);
    }

    _triggerSplitterSplit(s) {
        if (!s.splitterCanSplit || !s.sprite?.active) return;
        const x = s.sprite.x, y = s.sprite.y;
        const nextGen = s.splitterGen + 1;
        const baseAngle = s.splitterAngle;

        // Split into 2 at ±25° spread — feels like unstable fragmentation
        const SPREAD = Math.PI / 7.2; // 25°
        this._spawnSplitterShard(x, y, baseAngle - SPREAD, nextGen);
        this._spawnSplitterShard(x, y, baseAngle + SPREAD, nextGen);

        // ── AoE ice explosion at every split point ──
        const AOE_R = 22 + (4 - s.splitterGen) * 5; // gen0 splits are bigger
        const splitDmg = s.damage * 0.5;
        // Visual
        const burst = this.add.graphics().setDepth(5);
        burst.x = x; burst.y = y;
        burst.fillStyle(0xaaeeff, 0.28); burst.fillCircle(0, 0, AOE_R * 1.4);
        burst.fillStyle(0xddf8ff, 0.45); burst.fillCircle(0, 0, AOE_R * 0.7);
        burst.fillStyle(0xffffff, 0.85); burst.fillCircle(0, 0, 4 + s.splitterGen * 1.5);
        burst.lineStyle(1.5, 0xffffff, 0.75); burst.strokeCircle(0, 0, AOE_R * 0.9);
        for (let i = 0; i < 6; i++) {
            const sa = baseAngle + (i / 6) * Math.PI * 2;
            burst.lineStyle(1.2, i % 2 === 0 ? 0xffffff : 0x88ddff, 0.75);
            burst.beginPath(); burst.moveTo(Math.cos(sa)*4, Math.sin(sa)*4); burst.lineTo(Math.cos(sa)*(AOE_R*1.1), Math.sin(sa)*(AOE_R*1.1)); burst.strokePath();
        }
        this.tweens.add({ targets: burst, scaleX: 1.9, scaleY: 1.9, alpha: 0, duration: 190, ease: 'Quad.easeOut', onComplete: () => burst.destroy() });

        // Damage enemies in AoE radius at split point
        for (const enemy of this.enemies) {
            if (!enemy.sprite?.active) continue;
            const edx = enemy.sprite.x - x, edy = enemy.sprite.y - y;
            if (edx*edx + edy*edy > AOE_R*AOE_R) continue;
            if (enemy.iceImmune || enemy.fireImmune || enemy.elementImmune) continue;
            if (enemy.isFrozen) {
                this._triggerShatterBurst(enemy);
            } else {
                enemy.health -= splitDmg;
                this.showDamageNumber(enemy.sprite.x, enemy.sprite.y - 10, Math.round(splitDmg), '#aaeeff');
                this.updateEnemyHealthBar(enemy);
                this.gainUltCharge(this.ultChargePerHit);
                if (enemy.health <= 0) this.killEnemy(enemy);
            }
        }

        // Remove the parent shard cleanly
        const idx = this.iceShards.indexOf(s);
        if (idx !== -1) this.iceShards.splice(idx, 1);
        this.destroyIceShard(s);
    }

    icicleStaffAttack(targetX, targetY) {
        const currentTime = this.time.now;

        // ── Accuracy zone constants ──────────────────────────────────────────
        const ACCURACY_RADIUS_TILES = 2;
        const ACCURACY_RADIUS_PX    = ACCURACY_RADIUS_TILES * this.TILE_SIZE;

        // ── Per-shot config ──────────────────────────────────────────────────
        const PELLETS         = 4;
        const HITS_TO_CHARGE  = 28;

        // Cooldown: inside accuracy zone = slow (1200ms), outside = fast (380ms)
        const playerPx = this.playerX * this.TILE_SIZE + this.TILE_SIZE / 2;
        const playerPy = this.playerY * this.TILE_SIZE + this.TILE_SIZE / 2;
        const worldX   = targetX + this.cameras.main.scrollX;
        const worldY   = targetY + this.cameras.main.scrollY;
        const cursorDx = worldX - playerPx;
        const cursorDy = worldY - playerPy;
        const cursorDist = Math.sqrt(cursorDx * cursorDx + cursorDy * cursorDy);

        // 0 = cursor at player, 1 = cursor at edge of accuracy zone, >1 = outside
        const proximityT = Math.min(cursorDist / ACCURACY_RADIUS_PX, 1.0); // clamped 0–1
        const inZone     = cursorDist <= ACCURACY_RADIUS_PX;

        const CD_MIN = 220;   // fastest (at max range)
        const CD_MAX = 1000;  // slowest (inside zone / point blank)
        // Spectrum: cursor at player = CD_MAX, grows faster with distance, caps at CD_MIN
        const MAX_DIST_PX = ACCURACY_RADIUS_PX * 5; // distance at which cap is reached
        const distFrac    = Math.min(cursorDist / MAX_DIST_PX, 1.0);
        const effectiveCD = Math.round(CD_MAX - (CD_MAX - CD_MIN) * distFrac);

        if (currentTime - (this.lastIcicleStaffTime || 0) < effectiveCD) return;
        this.lastIcicleStaffTime = currentTime;

        // ── Heal shard mode — fired instead of normal burst ──────────────────
        if (this._icicleHealModeActive && (this._icicleHitCounter || 0) >= HITS_TO_CHARGE) {
            this._fireIcicleHealShard(playerPx, playerPy, worldX, worldY);
            this._icicleHealModeActive = false;
            this._icicleHitCounter = 0;
            this._updateIcicleChargeBar();
            return;
        }

        // ── Spread: tight inside zone, fans out with distance ────────────────
        // proximityT = 0 (cursor on player) → max spread (panic spray)
        // proximityT = 1 (edge of zone) → min spread inside zone
        // outside zone: spread grows further with distance
        const SPREAD_MIN = 0.04;  // ~2.3° half-angle, tight cluster
        const SPREAD_MAX = 0.75;  // ~43° half-angle, wide fan
        let spreadHalf;
        if (inZone) {
            // Inside: spread is very tight, constant regardless of exact distance
            spreadHalf = SPREAD_MIN;
        } else {
            // Outside: spreads from SPREAD_MIN → SPREAD_MAX over 0–4× ACCURACY_RADIUS beyond zone edge
            const outsideFrac = Math.min((cursorDist - ACCURACY_RADIUS_PX) / (ACCURACY_RADIUS_PX * 4), 1.0);
            spreadHalf = SPREAD_MIN + (SPREAD_MAX - SPREAD_MIN) * outsideFrac;
        }

        // ── Pellet speed: fast inside zone, slower outside ───────────────────
        const SPEED_FAST = 700;
        const SPEED_SLOW = 130;
        const pelletSpeed = inZone
            ? SPEED_FAST
            : SPEED_SLOW + Math.max(0, SPEED_SLOW - (cursorDist - ACCURACY_RADIUS_PX) * 0.5);

        // ── Damage ────────────────────────────────────────────────────────────
        // Inside zone: high per-pellet damage rewarding close range play
        // point blank (dist=0) → 9.0×, zone edge → 4.0×, outside zone → 0.8×
        const DMG_POINTBLANK = 9.0 * this.damageScaling;
        const DMG_ZONE_EDGE  = 4.0 * this.damageScaling;
        const DMG_OUTSIDE    = 0.8 * this.damageScaling;
        let shardDmg;
        if (inZone) {
            shardDmg = DMG_POINTBLANK + (DMG_ZONE_EDGE - DMG_POINTBLANK) * (cursorDist / ACCURACY_RADIUS_PX);
        } else {
            shardDmg = DMG_OUTSIDE;
        }

        // Shatter mult: point blank = 2.5×, zone edge = 1.2×, outside = 0.5×
        const shatterMultCannon = inZone
            ? 1.2 + 1.3 * (1.0 - cursorDist / ACCURACY_RADIUS_PX)
            : 0.5;

        // ── Splash (inside zone only) ─────────────────────────────────────────
        const SPLASH_RADIUS = 18; // px
        const SPLASH_DMG    = shardDmg * 0.5;

        const baseAngle = Math.atan2(cursorDy, cursorDx);

        // ── Fire PELLETS pellets ───────────────────────────────────────────────
        for (let s = 0; s < PELLETS; s++) {
            const spreadFrac = PELLETS > 1 ? (s / (PELLETS - 1) - 0.5) * 2 : 0;
            const angle = baseAngle + spreadFrac * spreadHalf;
            const vx = Math.cos(angle) * pelletSpeed;
            const vy = Math.sin(angle) * pelletSpeed;

            // Pellet visual — bright ice diamond
            const container = this.add.container(playerPx, playerPy).setDepth(3);
            const g = this.add.graphics();
            container.add(g);
            container.setAngle(Math.random() * 360);
            const scale = 0.8 + Math.random() * 0.3;
            const R = (inZone ? 6 : 5) * scale; // slightly bigger inside zone
            const v = Math.random();
            const shadow = v < 0.33 ? 0x1155aa : v < 0.66 ? 0x0d4488 : 0x1a5599;
            const body   = v < 0.33 ? 0x2277cc : v < 0.66 ? 0x1a88dd : 0x3366bb;
            const lit    = v < 0.33 ? 0x55aaee : v < 0.66 ? 0x44bbff : 0x6699dd;
            const spec   = v < 0.33 ? 0xaaddff : v < 0.66 ? 0x88eeff : 0xbbccff;
            // Inside zone: brighter tint
            const brightMult = inZone ? 1.15 : 1.0;
            g.fillStyle(shadow, 0.90);
            g.beginPath(); g.moveTo(0,-R*2.0); g.lineTo(R,0); g.lineTo(0,R*2.0); g.closePath(); g.fillPath();
            g.fillStyle(body, 1.0);
            g.beginPath(); g.moveTo(0,-R*2.0); g.lineTo(R,0); g.lineTo(0,R*2.0); g.lineTo(-R,0); g.closePath(); g.fillPath();
            g.fillStyle(lit, 0.70);
            g.beginPath(); g.moveTo(0,-R*2.0); g.lineTo(-R,0); g.lineTo(0,R*2.0); g.closePath(); g.fillPath();
            if (inZone) { g.fillStyle(0xffffff, 0.55); g.fillCircle(-R*0.2, -R*0.6, R*0.28); } // extra highlight inside zone
            g.fillStyle(0xffffff, 0.85); g.fillCircle(-R*0.25, -R*0.5, R*0.18);
            g.lineStyle(1.0, spec, 0.85);
            g.beginPath(); g.moveTo(0,-R*2.0); g.lineTo(R,0); g.lineTo(0,R*2.0); g.lineTo(-R,0); g.closePath(); g.strokePath();

            const capturedInZone   = inZone;
            const capturedDmg      = shardDmg;
            const capturedShatterM = shatterMultCannon;
            const capturedPiercing = !inZone;

            this.iceShards.push({
                sprite: container, vx, vy,
                damage: capturedDmg,
                startX: playerPx, startY: playerPy,
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
                rotSpeed: (Math.random() > 0.5 ? 1 : -1) * (1.5 + Math.random() * 2.0),
                hitEnemies: new Set(),
                piercedEnemies: new Set(),
                _onHit: (enemy) => {
                    this.applyIcicleCannonHit(enemy, capturedDmg, capturedShatterM);

                    // ── Accuracy zone splash ─────────────────────────────────
                    if (capturedInZone && enemy.sprite?.active) {
                        const sx = enemy.sprite.x, sy = enemy.sprite.y;
                        // Splash visual
                        const splashG = this.add.graphics().setDepth(4);
                        splashG.x = sx; splashG.y = sy;
                        splashG.fillStyle(0xaaeeff, 0.35); splashG.fillCircle(0, 0, SPLASH_RADIUS * 1.3);
                        splashG.fillStyle(0xffffff, 0.70); splashG.fillCircle(0, 0, SPLASH_RADIUS * 0.45);
                        splashG.lineStyle(1.2, 0xddf8ff, 0.75); splashG.strokeCircle(0, 0, SPLASH_RADIUS * 0.9);
                        this.tweens.add({ targets: splashG, scaleX: 1.7, scaleY: 1.7, alpha: 0, duration: 180, ease: 'Quad.easeOut', onComplete: () => splashG.destroy() });

                        // Splash damage + 1 chill stack to nearby enemies
                        for (const nearEnemy of this.enemies) {
                            if (!nearEnemy.sprite?.active) continue;
                            const sdx = nearEnemy.sprite.x - sx, sdy = nearEnemy.sprite.y - sy;
                            if (sdx*sdx + sdy*sdy > SPLASH_RADIUS*SPLASH_RADIUS) continue;
                            if (nearEnemy.fireImmune || nearEnemy.elementImmune) continue;
                            if (nearEnemy.isFrozen) {
                                this._triggerShatterBurst(nearEnemy, capturedShatterM);
                            } else if (!nearEnemy.iceImmune) {
                                nearEnemy.health -= SPLASH_DMG;
                                this.showDamageNumber(nearEnemy.sprite.x, nearEnemy.sprite.y - 8, Math.round(SPLASH_DMG), '#aaeeff');
                                this.updateEnemyHealthBar(nearEnemy);
                                if (nearEnemy.health <= 0) { this.killEnemy(nearEnemy); continue; }
                            }
                            // Apply 1 chill stack to all splash targets (including iceImmune)
                            if (!nearEnemy.chillStacks) nearEnemy.chillStacks = 0;
                            nearEnemy.chillStacks++;
                            nearEnemy.lastChillTime = this.time.now;
                            this._updateChillIndicator(nearEnemy);
                            if (nearEnemy.chillStacks >= 3) {
                                nearEnemy.chillStacks = 0;
                                nearEnemy.frozenAt = this.time.now;
                                this._destroyChillIndicator(nearEnemy);
                                this.freezeEnemy(nearEnemy, 10000);
                                this.gainUltCharge(this.ultChargePerFreeze);
                                nearEnemy._freezeMeltTimer = this.time.delayedCall(10000, () => {
                                    if (nearEnemy.sprite?.active) this._shatterWaterSplash(nearEnemy.x, nearEnemy.y);
                                });
                            }
                        }
                    }

                    // Impact fragments
                    if (enemy.sprite?.active) {
                        const ix = enemy.sprite.x, iy = enemy.sprite.y;
                        const ic = capturedInZone ? 0x55ccff : 0x88ddff;
                        for (let f = 0; f < (capturedInZone ? 4 : 3); f++) {
                            const fa = Math.random() * Math.PI * 2;
                            const fd = 6 + Math.random() * (capturedInZone ? 12 : 8);
                            const fg = this.add.graphics().setDepth(4);
                            fg.x = ix; fg.y = iy;
                            fg.fillStyle(f % 2 === 0 ? ic : 0xffffff, 0.85);
                            fg.fillRect(-1, -2, 2, 4);
                            fg.setRotation(fa);
                            this.tweens.add({ targets: fg, x: ix + Math.cos(fa)*fd, y: iy + Math.sin(fa)*fd, alpha: 0, scaleX: 0.3, scaleY: 0.3, duration: 180, ease: 'Cubic.easeOut', onComplete: () => fg.destroy() });
                        }
                    }

                    // Count every pellet hit toward heal charge
                    this._icicleHitCounter = Math.min(HITS_TO_CHARGE, (this._icicleHitCounter || 0) + 1);
                    this._updateIcicleChargeBar();
                }
            });
        }

        // ── Muzzle flash ──────────────────────────────────────────────────────
        const puffG = this.add.graphics().setDepth(4);
        puffG.x = playerPx; puffG.y = playerPy;
        const chipCol  = inZone ? 0x55ccff : 0x88ccff;
        const chipCol2 = inZone ? 0xbbf0ff : 0xddf4ff;
        for (let bi = 0; bi < (inZone ? 7 : 5); bi++) {
            const ba = baseAngle + (Math.random() - 0.5) * spreadHalf * 3.0;
            const bl = (inZone ? 6 : 4) + Math.random() * 8;
            puffG.fillStyle(bi % 2 === 0 ? chipCol : chipCol2, 0.90);
            const bx2 = Math.cos(ba) * (2 + Math.random() * 4);
            const by2 = Math.sin(ba) * (2 + Math.random() * 4);
            puffG.fillRect(bx2 - 1, by2 - 1, 2, 2);
            puffG.lineStyle(1.0, bi % 2 === 0 ? chipCol : chipCol2, 0.80);
            puffG.beginPath();
            puffG.moveTo(Math.cos(ba)*2, Math.sin(ba)*2);
            puffG.lineTo(Math.cos(ba)*bl, Math.sin(ba)*bl);
            puffG.strokePath();
        }
        puffG.fillStyle(0xffffff, 0.90); puffG.fillCircle(0, 0, inZone ? 4 : 3);
        this.tweens.add({ targets: puffG, scaleX: 1.8, scaleY: 1.8, alpha: 0, duration: 100, onComplete: () => puffG.destroy() });

        this.cameras.main.shake(inZone ? 25 : 12, 0.001);
    }

    // ── Heal shard — fired when heal mode is active ───────────────────────────
    _fireIcicleHealShard(ox, oy, worldX, worldY) {
        const baseAngle = Math.atan2(worldY - oy, worldX - ox);
        const HEAL_SHARD_SPEED = 220;
        const HEAL_SHARD_DMG   = 2.5 * this.damageScaling;
        const HEAL_ON_HIT      = 5;
        const SPLASH_R         = 32;
        const MINI_COUNT       = 6;

        this.showStatusText(ox, oy - 30, '✦ HEAL SHARD', '#00ff88');
        this.cameras.main.shake(40, 0.002);

        // Visual — large glowing green crystal
        const container = this.add.container(ox, oy).setDepth(3.5);
        const g = this.add.graphics();
        container.add(g);
        const R = 9;
        g.fillStyle(0x007744, 0.90);
        g.beginPath(); g.moveTo(0,-R*2.2); g.lineTo(R*1.1,0); g.lineTo(0,R*2.2); g.closePath(); g.fillPath();
        g.fillStyle(0x00cc66, 1.0);
        g.beginPath(); g.moveTo(0,-R*2.2); g.lineTo(R*1.1,0); g.lineTo(0,R*2.2); g.lineTo(-R*1.1,0); g.closePath(); g.fillPath();
        g.fillStyle(0x44ffaa, 0.75);
        g.beginPath(); g.moveTo(0,-R*2.2); g.lineTo(-R*1.1,0); g.lineTo(0,R*2.2); g.closePath(); g.fillPath();
        g.fillStyle(0xffffff, 0.90); g.fillCircle(-R*0.25, -R*0.6, R*0.28);
        g.lineStyle(1.5, 0xaaffcc, 0.90);
        g.beginPath(); g.moveTo(0,-R*2.2); g.lineTo(R*1.1,0); g.lineTo(0,R*2.2); g.lineTo(-R*1.1,0); g.closePath(); g.strokePath();
        // Glow ring
        const glowG = this.add.graphics();
        container.add(glowG);
        glowG.lineStyle(3, 0x00ff88, 0.45); glowG.strokeCircle(0, 0, R * 1.8);

        const vx = Math.cos(baseAngle) * HEAL_SHARD_SPEED;
        const vy = Math.sin(baseAngle) * HEAL_SHARD_SPEED;

        const onImpact = (ix, iy) => {
            if (!container.active) return;
            container.destroy();

            // Big AoE burst visual
            const burstG = this.add.graphics().setDepth(5);
            burstG.x = ix; burstG.y = iy;
            burstG.fillStyle(0x00ffaa, 0.35); burstG.fillCircle(0, 0, SPLASH_R * 1.4);
            burstG.fillStyle(0xffffff, 0.80); burstG.fillCircle(0, 0, SPLASH_R * 0.38);
            burstG.lineStyle(2, 0x44ffaa, 0.80); burstG.strokeCircle(0, 0, SPLASH_R * 1.0);
            for (let ri = 0; ri < 8; ri++) {
                const ra = (ri / 8) * Math.PI * 2;
                burstG.lineStyle(1.5, 0x00ff88, 0.65);
                burstG.beginPath(); burstG.moveTo(Math.cos(ra)*6, Math.sin(ra)*6); burstG.lineTo(Math.cos(ra)*SPLASH_R*1.1, Math.sin(ra)*SPLASH_R*1.1); burstG.strokePath();
            }
            this.tweens.add({ targets: burstG, scaleX: 2.0, scaleY: 2.0, alpha: 0, duration: 350, ease: 'Quad.easeOut', onComplete: () => burstG.destroy() });

            // AoE damage + heal on every enemy in radius
            for (const enemy of this.enemies) {
                if (!enemy.sprite?.active) continue;
                if (enemy.fireImmune || enemy.elementImmune) continue;
                const edx = enemy.sprite.x - ix, edy = enemy.sprite.y - iy;
                if (edx*edx + edy*edy > SPLASH_R*SPLASH_R) continue;
                if (enemy.isFrozen) {
                    this._triggerShatterBurst(enemy, 1 / 7.5);
                } else if (!enemy.iceImmune) {
                    enemy.health -= HEAL_SHARD_DMG;
                    this.showDamageNumber(enemy.sprite.x, enemy.sprite.y - 10, Math.round(HEAL_SHARD_DMG), '#44ffaa');
                    this.updateEnemyHealthBar(enemy);
                    if (enemy.health <= 0) { this.killEnemy(enemy); continue; }
                    // 1 chill stack from splash
                    if (!enemy.chillStacks) enemy.chillStacks = 0;
                    enemy.chillStacks++;
                    enemy.lastChillTime = this.time.now;
                    this._updateChillIndicator(enemy);
                    if (enemy.chillStacks >= 3) {
                        enemy.chillStacks = 0;
                        enemy.frozenAt = this.time.now;
                        this._destroyChillIndicator(enemy);
                        this.freezeEnemy(enemy, 10000);
                        this.gainUltCharge(this.ultChargePerFreeze);
                        enemy._freezeMeltTimer = this.time.delayedCall(10000, () => {
                            if (enemy.sprite?.active) this._shatterWaterSplash(enemy.x, enemy.y);
                        });
                    }
                }
                // Heal per enemy hit
                this.health = Math.min((this.maxHealth || 100) + 25, this.health + HEAL_ON_HIT);
                if (typeof HUD !== 'undefined') HUD.prototype.updateHUD.call(this);
                const hbG = this.add.graphics().setDepth(5);
                hbG.x = enemy.sprite.x; hbG.y = enemy.sprite.y;
                hbG.fillStyle(0x00ff88, 0.70); hbG.fillCircle(0, 0, 10);
                hbG.fillStyle(0xffffff, 0.85); hbG.fillCircle(0, 0, 4);
                this.tweens.add({ targets: hbG, scaleX: 2.2, scaleY: 2.2, alpha: 0, duration: 250, onComplete: () => hbG.destroy() });
            }

            // ── Spawn 6 mini shards in fixed outward directions ───────────────
            const MINI_SPEED  = 190;
            const MINI_DMG    = 0.6 * this.damageScaling;
            const MINI_HEAL   = 1;
            for (let m = 0; m < MINI_COUNT; m++) {
                // Fixed evenly-spaced angles — no randomness so they always spread outward cleanly
                const outAngle = (m / MINI_COUNT) * Math.PI * 2;
                const mvx = Math.cos(outAngle) * MINI_SPEED;
                const mvy = Math.sin(outAngle) * MINI_SPEED;

                // Mini shard visual — small green crystal
                const mc = this.add.container(ix, iy).setDepth(3.2);
                const mg = this.add.graphics();
                mc.add(mg);
                mc.setAngle(outAngle * (180 / Math.PI)); // orient along travel direction
                const mR = 3.0 + Math.random() * 1.2;
                mg.fillStyle(0x007744, 0.90);
                mg.beginPath(); mg.moveTo(0,-mR*2); mg.lineTo(mR,0); mg.lineTo(0,mR*2); mg.closePath(); mg.fillPath();
                mg.fillStyle(0x00cc66, 1.0);
                mg.beginPath(); mg.moveTo(0,-mR*2); mg.lineTo(mR,0); mg.lineTo(0,mR*2); mg.lineTo(-mR,0); mg.closePath(); mg.fillPath();
                mg.fillStyle(0x55ffbb, 0.75);
                mg.beginPath(); mg.moveTo(0,-mR*2); mg.lineTo(-mR,0); mg.lineTo(0,mR*2); mg.closePath(); mg.fillPath();
                mg.fillStyle(0xffffff, 0.85); mg.fillCircle(-mR*0.25, -mR*0.55, mR*0.22);
                mg.lineStyle(0.8, 0x88ffcc, 0.85);
                mg.beginPath(); mg.moveTo(0,-mR*2); mg.lineTo(mR,0); mg.lineTo(0,mR*2); mg.lineTo(-mR,0); mg.closePath(); mg.strokePath();

                const miniShardObj = {
                    sprite: mc, vx: mvx, vy: mvy,
                    damage: MINI_DMG,
                    startX: ix, startY: iy,
                    createdAt: this.time.now,
                    isCannonShard: true,
                    isMiniHealShard: true,  // fixed direction, no homing, consumed on first hit
                    isHoming: false,
                    _healAmount: MINI_HEAL,
                    rotSpeed: (Math.random() > 0.5 ? 1 : -1) * (3.0 + Math.random() * 2.0),
                    hitEnemies: new Set(),
                    piercedEnemies: new Set(),
                    bounces: 0,
                    maxBounces: 0,
                    isPiercing: false,
                };
                this.iceShards.push(miniShardObj);
            }
        };

        // Store onImpact so updateIceShards can call it on wall hit
        const shardObj = {
            sprite: container, vx, vy,
            damage: HEAL_SHARD_DMG,
            startX: ox, startY: oy,
            createdAt: this.time.now,
            isHealShard: true,
            isCannonShard: true,
            isHoming: true,
            rotSpeed: (Math.random() > 0.5 ? 1 : -1) * (1.2 + Math.random() * 0.8),
            hitEnemies: new Set(),
            piercedEnemies: new Set(),
            _onImpact: onImpact,
            _onHit: (enemy) => {
                if (!container.active) return;
                onImpact(enemy.sprite.x, enemy.sprite.y);
            }
        };
        this.iceShards.push(shardObj);
    }

    // ── Accuracy circle — drawn each frame while icicle cannon is equipped ────
    _updateIcicleAccuracyCircle(targetX, targetY) {
        const isCannon = this.currentElement === 'ice' &&
            (this.equippedWeapons?.ice || 'ice_fists') === 'icicle_cannon';

        if (!isCannon) {
            if (this._icicleAccuracyCircle) { this._icicleAccuracyCircle.destroy(); this._icicleAccuracyCircle = null; }
            return;
        }

        const ACCURACY_RADIUS_PX = 2 * this.TILE_SIZE;
        const playerPx = this.playerX * this.TILE_SIZE + this.TILE_SIZE / 2;
        const playerPy = this.playerY * this.TILE_SIZE + this.TILE_SIZE / 2;
        const worldX   = targetX + this.cameras.main.scrollX;
        const worldY   = targetY + this.cameras.main.scrollY;
        const cursorDx = worldX - playerPx;
        const cursorDy = worldY - playerPy;
        const cursorDist = Math.sqrt(cursorDx * cursorDx + cursorDy * cursorDy);
        const inZone = cursorDist <= ACCURACY_RADIUS_PX;

        if (!this._icicleAccuracyCircle) {
            this._icicleAccuracyCircle = this.add.graphics().setDepth(1.5);
        }
        const circ = this._icicleAccuracyCircle;
        circ.clear();
        circ.x = playerPx;
        circ.y = playerPy;

        // Pulse alpha based on time
        const pulse = 0.55 + 0.25 * Math.sin(this.time.now / 280);

        if (inZone) {
            // Inside: bright cyan glow — player is in accurate mode
            circ.lineStyle(1.5, 0x44eeff, pulse * 0.9);
            circ.strokeCircle(0, 0, ACCURACY_RADIUS_PX);
            circ.lineStyle(0.6, 0xaaf8ff, pulse * 0.5);
            circ.strokeCircle(0, 0, ACCURACY_RADIUS_PX - 3);
            // Small inner dot indicator
            circ.fillStyle(0x44eeff, pulse * 0.6);
            circ.fillCircle(0, 0, 3);
        } else {
            // Outside: dim dashed-style (drawn as short arcs)
            circ.lineStyle(1.0, 0x336688, 0.35);
            circ.strokeCircle(0, 0, ACCURACY_RADIUS_PX);
        }
    }

    _updateIcicleChargeBar() {
        if (typeof HUD !== 'undefined' && typeof HUD.prototype.updateIcicleChargeBar === 'function') {
            HUD.prototype.updateIcicleChargeBar.call(this);
        }
    }


    flameSwordAttack(targetX, targetY) {
        const currentTime = this.time.now;
        if (currentTime - (this.lastFlameSwordTime || 0) < 750) return;
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

        const damage = 12 * this.damageScaling;

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
            if (this.damageBossAtTile(tx, ty, damage)) {
                if (typeof this.applyBurnStackBoss === 'function') this.applyBurnStackBoss();
            }

            for (const enemy of [...this.enemies]) {
                if (enemy.x !== tx || enemy.y !== ty || hitEnemies.has(enemy)) continue;
                hitEnemies.add(enemy);
                if (enemy.iceImmune) {
                    // Ice elementals are immune to all fire/physical damage
                    this.showStatusText(enemy.sprite.x, enemy.sprite.y - 10, 'IMMUNE', '#88eeff');
                    this._triggerIceImmuneGlerpReaction();
                    continue;
                }
                if (enemy.fireImmune) {
                    // Fire elementals immune to direct damage but accumulate burn stacks
                    if (typeof this.applyBurnStack === 'function') this.applyBurnStack(enemy);
                    continue;
                }
                if (enemy.elementImmune) { this.showStatusText(enemy.sprite.x, enemy.sprite.y - 10, 'IMMUNE', '#8888ff'); continue; }
                enemy.health -= damage;
                this.showDamageNumber(enemy.sprite.x, enemy.sprite.y - 10, damage, '#ff8800');
                this.updateEnemyHealthBar(enemy);
                if (enemy.health <= 0) this.killEnemy(enemy);
            }
        }

        this.cameras.main.shake(60, 0.005);
    }

    magmaStaffAttack(targetX, targetY) {
        const currentTime = this.time.now;

        // Cooldown scales with fireball count: base 1200ms + 120ms per extra fireball
        const fireballCount = Math.min((this._magmaStaffFireballCount || 0) + 1, 6);
        const cooldown = 1200 + (fireballCount - 1) * 120;
        if (currentTime - (this.lastMagmaStaffTime || 0) < cooldown) return;
        this.lastMagmaStaffTime = currentTime;

        const worldX   = targetX + this.cameras.main.scrollX;
        const worldY   = targetY + this.cameras.main.scrollY;
        const playerPx = this.playerX * this.TILE_SIZE + this.TILE_SIZE / 2;
        const playerPy = this.playerY * this.TILE_SIZE + this.TILE_SIZE / 2;
        const dx = worldX - playerPx, dy = worldY - playerPy;
        const dist = Math.sqrt(dx * dx + dy * dy) || 1;
        const baseAngle = Math.atan2(dy, dx);

        // Damage scales with fireball count: 1 ball = 1.0x, 6 balls = 2.8x
        const damageMultiplier = 1.0 + (fireballCount - 1) * 0.36;
        const baseDmg = 6 * this.damageScaling * damageMultiplier;

        // Muzzle flash
        const muzzle = this.add.graphics().setDepth(4).setScrollFactor(0);
        const mx = playerPx - this.cameras.main.scrollX;
        const my = playerPy - this.cameras.main.scrollY;
        muzzle.fillStyle(0xff8800, 0.8); muzzle.fillCircle(mx, my, 10);
        muzzle.fillStyle(0xffff44, 0.6); muzzle.fillCircle(mx, my, 5);
        this.tweens.add({ targets: muzzle, scaleX: 2.2, scaleY: 2.2, alpha: 0, duration: 180, onComplete: () => muzzle.destroy() });

        // Fire fireballs sequentially with slight random spread
        const SPEED = 210;
        const SHOT_INTERVAL = 90;
        const leavesTrail = (fireballCount >= 6);

        for (let i = 0; i < fireballCount; i++) {
            this.time.delayedCall(i * SHOT_INTERVAL, () => {
                if (this._deathScreenActive) return;
                const spread = 0.12 - (fireballCount - 1) * 0.01;
                const angle = baseAngle + (Math.random() - 0.5) * spread * 2;
                const vx = Math.cos(angle) * SPEED;
                const vy = Math.sin(angle) * SPEED;

                const container = this.add.container(playerPx, playerPy);
                const fireGraphics = this.add.graphics().setDepth(1.5);
                container.add(fireGraphics);
                container.setDepth(2);

                this.fireballs.push({
                    sprite:        container,
                    fireGraphics:  fireGraphics,
                    vx, vy,
                    damage:        baseDmg,
                    dirX:          Math.cos(angle),
                    dirY:          Math.sin(angle),
                    startX:        playerPx, startY: playerPy,
                    splitCount:    0,
                    piercedEnemies: new Set(),
                    createdAt:     this.time.now,
                    lastFlameTime: this.time.now,
                    isStaffBall:   true,
                    leavesTrail,
                    _burnApplied:  new Set(),
                });
            });
        }

        this.cameras.main.shake(30 + fireballCount * 5, 0.002);
    }

    // Apply one burn stack to an enemy — called by fire hits and lava tiles
    applyBurnStack(enemy) {
        if (!enemy.sprite?.active || enemy.health <= 0) return;
        if (enemy.iceImmune) return;
        if (enemy.isVoidSniper && enemy._sniperInvisible) return; // invisible — immune to burn
        if (!enemy.burnStacks) enemy.burnStacks = 0;
        enemy.burnStacks = Math.min(5, enemy.burnStacks + 1);
        enemy.lastBurnStackTime = this.time.now;

        // Update global fireball count — max stacks on any alive enemy OR boss
        this._recalcMagmaFireballCount();

        this._updateBurnStackIndicator(enemy);
        this._applyBurnDoT(enemy);
    }

    // ── Supernova ignition mark — explodes after 2s, cascades to nearby enemies ──
    _applyIgnitionMark(enemy) {
        if (!enemy.sprite?.active || enemy.health <= 0) return;
        if (enemy._ignitionMarkActive) return; // already marked
        enemy._ignitionMarkActive = true;

        const EXPLOSION_DMG    = 15 * this.damageScaling;
        const EXPLOSION_RADIUS = this.TILE_SIZE * 2.5; // px
        const FUSE_TIME        = 2000;
        const MAX_EXPLOSIONS   = 2; // per enemy per cast

        // Visual — blue pulsing mark above enemy
        const markG = this.add.graphics().setDepth(5);
        const drawMark = () => {
            if (!markG.active) return;
            markG.clear();
            const pulse = 0.7 + 0.3 * Math.sin(this.time.now / 120);
            markG.x = enemy.sprite.x; markG.y = enemy.sprite.y - 18;
            markG.fillStyle(0x0066ff, pulse * 0.90);
            markG.fillCircle(0, 0, 7);
            markG.fillStyle(0xaaccff, 0.95);
            markG.fillCircle(0, 0, 3.5);
            markG.lineStyle(2, 0x4488ff, pulse * 0.80);
            markG.strokeCircle(0, 0, 10);
        };
        const markTimer = this.time.addEvent({ delay: 30, loop: true, callback: () => {
            if (!enemy.sprite?.active) { markTimer.remove(); markG.destroy(); return; }
            drawMark();
        }});

        // Countdown text
        let countdown = Math.ceil(FUSE_TIME / 1000);
        const cdText = this.add.text(enemy.sprite.x, enemy.sprite.y - 30, countdown + '', {
            fontSize: '11px', fontFamily: 'monospace', color: '#4488ff',
            stroke: '#000', strokeThickness: 3, fontStyle: 'bold'
        }).setOrigin(0.5).setDepth(6);
        const cdTimer = this.time.addEvent({ delay: 1000, repeat: countdown - 1, callback: () => {
            countdown--;
            if (cdText.active) cdText.setText(countdown > 0 ? countdown + '' : '!');
        }});

        // Fuse — explode after FUSE_TIME
        this.time.delayedCall(FUSE_TIME, () => {
            markTimer.remove();
            if (markG.active) markG.destroy();
            if (cdText.active) cdText.destroy();
            enemy._ignitionMarkActive = false;
            if (!enemy.sprite?.active) return;

            const ex = enemy.sprite.x, ey = enemy.sprite.y;

            // Explosion visual
            const expFlash = this.add.circle(ex, ey, 12, 0xffffff, 0.95).setDepth(6);
            const expRing  = this.add.circle(ex, ey, 12, 0x0044ff, 0).setDepth(6);
            expRing.setStrokeStyle(3, 0x4488ff, 1.0);
            const expCore  = this.add.circle(ex, ey, 20, 0x0022cc, 0.55).setDepth(5.5);
            this.tweens.add({ targets: [expFlash, expRing, expCore], scaleX: 3.5, scaleY: 3.5, alpha: 0, duration: 380, ease: 'Quad.easeOut', onComplete: () => { expFlash.destroy(); expRing.destroy(); expCore.destroy(); } });
            // Shard burst
            for (let i = 0; i < 8; i++) {
                const sa = (i / 8) * Math.PI * 2;
                const sg = this.add.graphics().setDepth(6);
                sg.x = ex; sg.y = ey;
                sg.fillStyle(i % 2 === 0 ? 0x4488ff : 0xffffff, 0.90);
                sg.fillRect(-2, -4, 4, 8); sg.setRotation(sa);
                this.tweens.add({ targets: sg, x: ex + Math.cos(sa)*28, y: ey + Math.sin(sa)*28, alpha: 0, scaleX: 0.3, scaleY: 0.3, duration: 300, ease: 'Quad.easeOut', onComplete: () => sg.destroy() });
            }
            this.cameras.main.shake(30, 0.003);

            // Damage + apply burn stack to detonating enemy
            if (enemy.sprite?.active && enemy.health > 0) {
                this.damageEnemy(enemy, EXPLOSION_DMG);
                if (typeof this.applyBurnStack === 'function') this.applyBurnStack(enemy);
            }
            // Boss direct hit
            this.damageBossAtTile(Math.floor(ex / this.TILE_SIZE), Math.floor(ey / this.TILE_SIZE), EXPLOSION_DMG);
            if (typeof this.applyBurnStackBoss === 'function') this.applyBurnStackBoss();

            // AoE — damage nearby enemies and cascade ignition marks
            for (const nearby of this.enemies) {
                if (nearby === enemy) continue;
                if (!nearby.sprite?.active || nearby.health <= 0) continue;
                const ndx = nearby.sprite.x - ex, ndy = nearby.sprite.y - ey;
                if (Math.sqrt(ndx*ndx + ndy*ndy) > EXPLOSION_RADIUS) continue;
                this.damageEnemy(nearby, EXPLOSION_DMG * 0.7);
                if (typeof this.applyBurnStack === 'function') this.applyBurnStack(nearby);
                // Cascade — mark nearby enemies (respects max explosions per enemy)
                if (!(nearby._ignitionMarkActive)) {
                    nearby._ignitionExplosionCount = (nearby._ignitionExplosionCount || 0) + 1;
                    if (nearby._ignitionExplosionCount <= MAX_EXPLOSIONS) {
                        this._applyIgnitionMark(nearby);
                    }
                }
            }
            // Boss AoE hit
            if (this.damageBossAtTile(Math.floor(ex / this.TILE_SIZE), Math.floor(ey / this.TILE_SIZE), EXPLOSION_DMG * 0.7)) {
                if (typeof this.applyBurnStackBoss === 'function') this.applyBurnStackBoss();
            }
        });
    }

    // Apply one burn stack directly to Voltslime boss
    applyBurnStackBoss() {
        // Apply to voltslime
        const boss = this.voltslimeBoss;
        if (boss?.active && boss.hp > 0) {
            if (!boss.burnStacks) boss.burnStacks = 0;
            boss.burnStacks = Math.min(5, boss.burnStacks + 1);
            boss.lastBurnStackTime = this.time.now;
            this._recalcMagmaFireballCount();
            this._applyBurnDoTBoss();
            this._updateBossBurnIndicator();
        }
        // Apply to void sovereign
        const vs = this.voidSovereignBoss;
        if (vs?.active && vs.hp > 0 && !vs._isInvulnerable) {
            if (!vs.burnStacks) vs.burnStacks = 0;
            vs.burnStacks = Math.min(5, vs.burnStacks + 1);
            vs.lastBurnStackTime = this.time.now;
            this._recalcMagmaFireballCount();
            this._applyBurnDoTVoidSovereign();
        }
    }

    _applyBurnDoTVoidSovereign() {
        const vs = this.voidSovereignBoss;
        if (!vs?.active) return;
        const s = vs.burnStacks || 0;
        if (s <= 0) return;
        const dmgPerTick = s <= 2 ? 0.6 * this.damageScaling
                         : s <= 4 ? 1.4 * this.damageScaling
                                  : 2.8 * this.damageScaling;
        const interval = s <= 2 ? 2000 : s <= 4 ? 1200 : 700;
        if (vs._burnDoTTimer) { vs._burnDoTTimer.remove(); vs._burnDoTTimer = null; }
        const tick = () => {
            if (!vs?.active || vs.hp <= 0 || !vs.burnStacks) return;
            const timeSinceLast = this.time.now - (vs.lastBurnStackTime || 0);
            if (timeSinceLast > interval * 1.5) {
                vs.burnStacks = Math.max(0, vs.burnStacks - 1);
                this._recalcMagmaFireballCount();
                if (vs.burnStacks > 0) this._applyBurnDoTVoidSovereign();
                return;
            }
            if (typeof this.damageVoidSovereignBoss === 'function') this.damageVoidSovereignBoss(dmgPerTick);
            this.gainUltCharge(this.ultChargePerBurnTick);
            vs._burnDoTTimer = this.time.delayedCall(interval, tick);
        };
        vs._burnDoTTimer = this.time.delayedCall(interval, tick);
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

    _applyBurnDoTBoss() {
        const boss = this.voltslimeBoss;
        if (!boss?.active) return;
        const s = boss.burnStacks || 0;
        if (s <= 0) return;
        const dmgPerTick = s <= 2 ? 0.6 * this.damageScaling
                         : s <= 4 ? 1.4 * this.damageScaling
                                  : 2.8 * this.damageScaling;
        const interval   = s <= 2 ? 2000 : s <= 4 ? 1200 : 700;
        if (boss._burnDoTTimer) { boss._burnDoTTimer.remove(); boss._burnDoTTimer = null; }
        const tick = () => {
            if (!boss?.active || boss.hp <= 0 || !boss.burnStacks) return;
            const timeSinceLast = this.time.now - (boss.lastBurnStackTime || 0);
            if (timeSinceLast > interval * 1.5) {
                boss.burnStacks = Math.max(0, boss.burnStacks - 1);
                this._recalcMagmaFireballCount();
                this._updateBossBurnIndicator();
                if (boss.burnStacks > 0) { this._applyBurnDoTBoss(); }
                return;
            }
            this.damageVoltslimeBoss(dmgPerTick);
            this.gainUltCharge(this.ultChargePerBurnTick);
            boss._burnDoTTimer = this.time.delayedCall(interval, tick);
        };
        boss._burnDoTTimer = this.time.delayedCall(interval, tick);
    }

    _updateBossBurnIndicator() {
        const boss = this.voltslimeBoss;
        if (!boss?.active) return;
        // Clean old pips
        if (boss._burnStackBar) {
            for (const pip of boss._burnStackBar) { this.tweens.killTweensOf(pip); pip.destroy(); }
            boss._burnStackBar = null;
        }
        const stacks = boss.burnStacks || 0;
        if (stacks <= 0) return;
        const colors = [0xff9900, 0xff6600, 0xff3300, 0xff1100, 0xff0000];
        boss._burnStackBar = [];
        const GAP = 8, W = 8, H = 10;
        const totalW = stacks * W + (stacks - 1) * GAP;
        const bx = boss.container.x, by = boss.container.y - 130; // above HP bar
        for (let i = 0; i < stacks; i++) {
            const pip = this.add.graphics().setDepth(6);
            const col = colors[i] || 0xff0000;
            pip.fillStyle(col, 0.4); pip.fillRect(-(W+2)/2, -(H+2)/2, W+2, H+2);
            pip.fillStyle(col, 1.0); pip.fillRect(-W/2, -H/2, W, H);
            pip.fillStyle(0xffff88, 0.7); pip.fillRect(-W/2+1, -H/2+1, W-2, 2);
            pip.x = bx - totalW/2 + i*(W+GAP) + W/2;
            pip.y = by;
            boss._burnStackBar.push(pip);
        }
    }

    _applyBurnDoT(enemy) {
        const s = enemy.burnStacks || 0;
        if (s <= 0) return;
        // 3 tiers based on stacks
        const dmgPerTick = s <= 2 ? 0.6 * this.damageScaling
                         : s <= 4 ? 1.4 * this.damageScaling
                                  : 2.8 * this.damageScaling;
        const interval   = s <= 2 ? 2000 : s <= 4 ? 1200 : 700;

        if (enemy._burnDoTTimer) { enemy._burnDoTTimer.remove(); enemy._burnDoTTimer = null; }

        const tickBurn = () => {
            if (!enemy.sprite?.active || enemy.health <= 0 || !(enemy.burnStacks > 0)) return;
            // Invisible snipers are immune — pause DoT, hide indicator, reschedule
            if (enemy.isVoidSniper && enemy._sniperInvisible) {
                this._clearBurnStackIndicator(enemy);
                enemy._burnDoTTimer = this.time.delayedCall(interval, tickBurn);
                return;
            }
            // Decay: reduce stack if no new hit in 1.5x the interval
            const timeSinceLast = this.time.now - (enemy.lastBurnStackTime || 0);
            if (timeSinceLast > interval * 1.5) {
                enemy.burnStacks = Math.max(0, enemy.burnStacks - 1);
                this._updateBurnStackIndicator(enemy);
                if (enemy.burnStacks === 0) {
                    this._clearBurnStackIndicator(enemy);
                    this._recalcMagmaFireballCount();
                    return;
                }
                this._applyBurnDoT(enemy);
                return;
            }
            // Tick damage — burn DoT now damages ALL enemies including fire elementals
            // (lava + burn is the only way to hurt fire elementals — that's the design)
            const burnPurpleBonus = enemy._purpleMarked ? 2.0 : 1;
            const finalBurnDmg = dmgPerTick * burnPurpleBonus;
            enemy.health -= finalBurnDmg;
            this.gainUltCharge(this.ultChargePerBurnTick);
            if (enemy.sprite?.active) {
                this.showDamageNumber(enemy.sprite.x, enemy.sprite.y - 8, finalBurnDmg, enemy._purpleMarked ? '#ff44ff' : '#ff8800');
                if (!enemy.fireImmune && typeof enemy.sprite.setTint === 'function') {
                    // Skip tint on fire elementals — they're already their own colour
                    enemy.sprite.setTint(0xff4400);
                    this.time.delayedCall(80, () => {
                        if (enemy.sprite?.active && typeof enemy.sprite.setTint === 'function') {
                            if (enemy.burnStacks > 0) enemy.sprite.setTint(0xff6600);
                            else enemy.sprite.clearTint();
                        }
                    });
                }
            }
            this.updateEnemyHealthBar(enemy);
            if (enemy.health <= 0) { this.killEnemy(enemy); return; }
            enemy._burnDoTTimer = this.time.delayedCall(interval, tickBurn);
        };
        enemy._burnDoTTimer = this.time.delayedCall(interval, tickBurn);
    }

    _updateBurnStackIndicator(enemy) {
        if (!enemy.sprite?.active) return;
        if (enemy.isVoidSniper && enemy._sniperInvisible) return; // hide while cloaked
        this._clearBurnStackIndicator(enemy);
        const stacks = enemy.burnStacks || 0;
        if (stacks <= 0) return;
        // Color gradient: orange → deep red → bright red at max
        const colors = [0xff9900, 0xff6600, 0xff3300, 0xff1100, 0xff0000];
        enemy._burnStackBar = [];
        const GAP = 6, W = 6, H = 8;
        const totalW = stacks * W + (stacks - 1) * GAP;
        for (let i = 0; i < stacks; i++) {
            const pip = this.add.graphics().setDepth(4);
            const col = colors[i] || 0xff0000;
            // Outer glow
            pip.fillStyle(col, 0.4);
            pip.fillRect(-(W + 2) / 2, -(H + 2) / 2, W + 2, H + 2);
            // Main pip
            pip.fillStyle(col, 1.0);
            pip.fillRect(-W / 2, -H / 2, W, H);
            // Bright highlight top
            pip.fillStyle(0xffff88, 0.7);
            pip.fillRect(-W / 2 + 1, -H / 2 + 1, W - 2, 2);
            pip.x = enemy.sprite.x - totalW / 2 + i * (W + GAP) + W / 2;
            pip.y = enemy.sprite.y - 36;
            enemy._burnStackBar.push(pip);
        }
    }

    _clearBurnStackIndicator(enemy) {
        if (enemy._burnStackBar) {
            for (const pip of enemy._burnStackBar) { this.tweens.killTweensOf(pip); pip.destroy(); }
            enemy._burnStackBar = null;
        }
    }

    // Magma Staff ripple — panic button on R key, charges over 12 seconds
    magmaStaffRipple() {
        if (this._magmaRippleReady !== true) return;
        this._magmaRippleReady = false;
        this._magmaRippleCharge = 0;
        this._updateMagmaRippleBar();

        const playerPx = this.playerX * this.TILE_SIZE + this.TILE_SIZE / 2;
        const playerPy = this.playerY * this.TILE_SIZE + this.TILE_SIZE / 2;
        const RADIUS    = 4;  // tiles
        const KNOCKBACK = 2;  // tiles
        const RING_INTERVAL = 80;  // ms between each ring wave
        const RING_LIFE     = 700; // ms each lava ring tile stays visible

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

        // Shockwave visual
        const wave = this.add.graphics().setDepth(4);
        wave.lineStyle(4, 0xff6600, 0.9); wave.strokeCircle(playerPx, playerPy, 12);
        this.tweens.add({ targets: wave, scaleX: RADIUS * 2.4, scaleY: RADIUS * 2.4, alpha: 0, duration: 380, ease: 'Quad.easeOut', onComplete: () => wave.destroy() });
        const core = this.add.circle(playerPx, playerPy, 16, 0xffaa00, 0.7).setDepth(4);
        this.tweens.add({ targets: core, radius: 40, alpha: 0, duration: 200, onComplete: () => core.destroy() });
        this.cameras.main.shake(120, 0.009);

        // Fling nearby enemies
        for (const enemy of [...this.enemies]) {
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
            enemy.stunnedUntil = this.time.now + 800;
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

            this.applyBurnStack(enemy);
        }

        this.showStatusText(playerPx, playerPy - 30, 'MAGMA SURGE!', '#ff8800');
    }

    _updateMagmaOrbs(time) {
        const isStaff = this.currentElement === 'fire' &&
            (this.equippedWeapons?.fire || 'flame_fists') === 'magma_staff';
        const count = isStaff ? Math.min((this._magmaStaffFireballCount || 0) + 1, 6) : 0;

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
                    const g = this.add.graphics().setDepth(5);
                    // Size and colour scale with count — small dim ember at 1, large bright orb at 6
                    const r    = 3 + (count - 1) * 0.8;          // 3px → 7px
                    const col  = count <= 2 ? 0xff9900
                               : count <= 4 ? 0xff5500
                                            : 0xff2200;
                    const glow = count <= 2 ? 0xff6600
                               : count <= 4 ? 0xff3300
                                            : 0xff0000;
                    g.fillStyle(glow, 0.35); g.fillCircle(0, 0, r + 3);
                    g.fillStyle(col,  1.00); g.fillCircle(0, 0, r);
                    g.fillStyle(0xffee88, 0.80); g.fillCircle(-r * 0.3, -r * 0.3, r * 0.4);
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
        const pct   = Math.min((this._magmaRippleCharge || 0) / (this._magmaRippleMaxCharge || 12000), 1);
        const ready = this._magmaRippleReady === true;

        if (!this._magmaRippleBarBg) {
            this._magmaRippleBarBg   = this.add.rectangle(px, py, BAR_W + 4, BAR_H + 4, 0x000000, 0.7).setDepth(5.5);
            this._magmaRippleBarFill = this.add.rectangle(px - BAR_W / 2, py, 0, BAR_H, 0xff4400, 1).setOrigin(0, 0.5).setDepth(5.6);
            this._magmaRippleLabel   = this.add.text(px, py + 7, 'SURGE [R]', {
                fontSize: '7px', fontFamily: 'monospace', color: '#ff8844',
                stroke: '#000', strokeThickness: 2
            }).setOrigin(0.5, 0).setDepth(5.7);
        }
        this._magmaRippleBarBg.x   = px; this._magmaRippleBarBg.y   = py;
        this._magmaRippleBarFill.x = px - BAR_W / 2; this._magmaRippleBarFill.y = py;
        this._magmaRippleLabel.x   = px; this._magmaRippleLabel.y   = py + 7;
        this._magmaRippleBarFill.width = BAR_W * pct;
        this._magmaRippleBarFill.setFillStyle(ready ? 0xff8800 : 0xff4400);
        this._magmaRippleLabel.setColor(ready ? '#ffcc44' : '#ff8844');
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
                            const imCol = enemy.iceImmune ? '#88eeff' : '#ff8844';
                            this.showStatusText(enemy.sprite.x, enemy.sprite.y - 10, 'IMMUNE', imCol);
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
            // Ice block — chunky diamond, solid pixel-art style
            const g = this.add.graphics().setDepth(1);
            g.x = playerPixelX;
            g.y = playerPixelY;

            // Shadow body
            g.fillStyle(0x1155aa, 0.95);
            g.beginPath();
            g.moveTo(0, -13); g.lineTo(11, 0); g.lineTo(0, 13); g.lineTo(-11, 0);
            g.closePath(); g.fillPath();

            // Lit face (top-left)
            g.fillStyle(0x44aadd, 0.80);
            g.beginPath();
            g.moveTo(0, -13); g.lineTo(-11, 0); g.lineTo(0, 0);
            g.closePath(); g.fillPath();

            // Inner cross-hatch detail
            g.lineStyle(1, 0xaaddff, 0.50);
            g.beginPath(); g.moveTo(-6, 0); g.lineTo(6, 0); g.strokePath();
            g.beginPath(); g.moveTo(0, -6); g.lineTo(0, 6); g.strokePath();

            // Bright white outline
            g.lineStyle(2, 0xddf0ff, 0.95);
            g.beginPath();
            g.moveTo(0, -13); g.lineTo(11, 0); g.lineTo(0, 13); g.lineTo(-11, 0);
            g.closePath(); g.strokePath();

            // White corner sparks
            g.fillStyle(0xffffff, 1.0);
            g.fillRect(-1.5, -14, 3, 3);
            g.fillRect(-1.5, 11, 3, 3);

            g._glow = null;
            sprite = g;
        } else {
            // Small regular ice shard — slim pointed needle
            const g = this.add.graphics().setDepth(1);
            g.x = playerPixelX;
            g.y = playerPixelY;
            g.rotation = angle + Math.PI / 2;

            // Body
            g.fillStyle(0x2277cc, 1.0);
            g.beginPath();
            g.moveTo(0, -9); g.lineTo(3, -1); g.lineTo(2, 5); g.lineTo(-2, 5); g.lineTo(-3, -1);
            g.closePath(); g.fillPath();

            // Lit face
            g.fillStyle(0x55aaee, 0.65);
            g.beginPath();
            g.moveTo(0, -9); g.lineTo(-3, -1); g.lineTo(-2, 5); g.lineTo(0, 4);
            g.closePath(); g.fillPath();

            // White tip
            g.fillStyle(0xffffff, 1.0);
            g.beginPath();
            g.moveTo(0, -9); g.lineTo(1.5, -5); g.lineTo(-1.5, -5);
            g.closePath(); g.fillPath();

            // Outline
            g.lineStyle(1, 0x88ccff, 0.80);
            g.beginPath();
            g.moveTo(0, -9); g.lineTo(3, -1); g.lineTo(2, 5); g.lineTo(-2, 5); g.lineTo(-3, -1);
            g.closePath(); g.strokePath();

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

            // Max range check — cannon shards, heal shards, and heal splinters
            // travel until they hit a wall; only the original bouncing shards and
            // tsunami scatter keep a distance cap.
            if (s.startX && s.startY &&
                !s.isCannonShard && !s.isHealShard && !s.isHealSplinter) {
                const distTraveled = Math.sqrt(
                    Math.pow(s.sprite.x - s.startX, 2) +
                    Math.pow(s.sprite.y - s.startY, 2)
                );
                const maxRange = s.isPierceSpike ? 14 * this.TILE_SIZE : 12 * this.TILE_SIZE;
                if (distTraveled > maxRange) {
                    this.destroyIceShard(s);
                    this.iceShards.splice(i, 1);
                    continue;
                }
            }

            // Store previous position before moving
            const oldX = s.sprite.x;
            const oldY = s.sprite.y;

            // Homing — heal shards in heal mode steer toward nearest enemy
            if (s.isHoming && this.enemies?.length) {
                let nearestDist = Infinity, nearestEnemy = null;
                for (const e of this.enemies) {
                    if (!e.sprite?.active) continue;
                    const dx = e.sprite.x - s.sprite.x;
                    const dy = e.sprite.y - s.sprite.y;
                    const d = dx * dx + dy * dy;
                    if (d < nearestDist) { nearestDist = d; nearestEnemy = e; }
                }
                if (nearestEnemy) {
                    const dx = nearestEnemy.sprite.x - s.sprite.x;
                    const dy = nearestEnemy.sprite.y - s.sprite.y;
                    const dist = Math.sqrt(nearestDist) || 1;
                    const TURN = 900; // steering force px/s²
                    s.vx += (dx / dist) * TURN * ds;
                    s.vy += (dy / dist) * TURN * ds;
                    // Clamp to original speed
                    const spd = Math.sqrt(s.vx * s.vx + s.vy * s.vy);
                    const MAX_SPD = 260;
                    if (spd > MAX_SPD) { s.vx = (s.vx / spd) * MAX_SPD; s.vy = (s.vy / spd) * MAX_SPD; }
                }
            }

            // Move
            s.sprite.x += s.vx * ds;
            s.sprite.y += s.vy * ds;

            // Crack shrink — pierces, no effect on projectile flight (Level 4)
            this._checkProjectileCrackShrink(s.sprite.x, s.sprite.y);
            // Spinning pellets — rotate container (graphics drawn once at creation)
            if (s.rotSpeed) s.sprite.rotation += s.rotSpeed * ds;
            if (s.sprite._glow)     { s.sprite._glow.x = s.sprite.x; s.sprite._glow.y = s.sprite.y; }
            if (s.sprite._innerOrb) { s.sprite._innerOrb.x = s.sprite.x; s.sprite._innerOrb.y = s.sprite.y; }

            // Frost trail
            if (time - s.lastTrailTime > 60) {
                s.lastTrailTime = time;
                if (s.isHealShard) {
                    // ── Rich crystalline heal-icicle trail ──
                    const ta = Math.atan2(s.vy, s.vx);
                    const tg = this.add.graphics().setDepth(1.2);
                    tg.x = s.sprite.x;
                    tg.y = s.sprite.y;
                    tg.rotation = ta + Math.PI / 2;
                    const ts = 0.35 + Math.random() * 0.3;
                    const tLen = 10 * ts, tWid = 3.5 * ts;
                    tg.fillStyle(0x00ee77, 0.70);
                    tg.beginPath();
                    tg.moveTo(0,     -tLen);
                    tg.lineTo( tWid,  0);
                    tg.lineTo( tWid * 0.6,  tLen * 0.5);
                    tg.lineTo(-tWid * 0.6,  tLen * 0.5);
                    tg.lineTo(-tWid,  0);
                    tg.closePath();
                    tg.fillPath();
                    tg.lineStyle(0.8, 0x88ffcc, 0.6);
                    tg.strokePath();
                    this.tweens.add({
                        targets: tg, alpha: 0, scaleX: 0.4, scaleY: 0.4,
                        duration: 380 + Math.random() * 120, ease: 'Quad.easeIn',
                        onComplete: () => tg.destroy()
                    });
                    // Tiny sparkle dot
                    const sx = s.sprite.x + (Math.random() - 0.5) * 8;
                    const sy = s.sprite.y + (Math.random() - 0.5) * 8;
                    const sp = this.add.graphics().setDepth(1.5);
                    sp.x = sx; sp.y = sy;
                    sp.fillStyle(Math.random() > 0.5 ? 0xccffdd : 0x00ff99, 0.9);
                    const ss = 1.2 + Math.random() * 1.8;
                    sp.fillRect(-ss, -ss, ss * 2, ss * 2);
                    this.tweens.add({
                        targets: sp, alpha: 0, scaleX: 0, scaleY: 0,
                        duration: 260 + Math.random() * 100, ease: 'Cubic.easeOut',
                        onComplete: () => sp.destroy()
                    });
                } else if (s.isCannonShard) {
                    // Ice chip trail — tiny shard fragment spinning behind the pellet
                    const trailCol = s.isHealShot ? 0x44dd99 : (Math.random() > 0.5 ? 0x55aaee : 0x88ccff);
                    const tg = this.add.graphics().setDepth(1.5);
                    tg.x = s.sprite.x + (Math.random() - 0.5) * 3;
                    tg.y = s.sprite.y + (Math.random() - 0.5) * 3;
                    const ts = 1.0 + Math.random() * 1.2;
                    tg.fillStyle(trailCol, 0.75);
                    tg.beginPath(); tg.moveTo(0,-ts*2); tg.lineTo(ts,0); tg.lineTo(0,ts*2); tg.lineTo(-ts,0); tg.closePath(); tg.fillPath();
                    tg.fillStyle(0xffffff, 0.50); tg.fillCircle(-ts*0.3, -ts*0.5, ts*0.35);
                    tg.setRotation(Math.random() * Math.PI * 2);
                    this.tweens.add({ targets: tg, alpha: 0, scaleX: 0.2, scaleY: 0.2, rotation: tg.rotation + (Math.random() > 0.5 ? 2 : -2), duration: 200 + Math.random() * 80, ease: 'Cubic.easeOut', onComplete: () => tg.destroy() });
                } else {
                    const t = this.add.rectangle(s.sprite.x, s.sprite.y, 4, 4, 0xaaddff, 0.5);
                    t.setDepth(0.5);
                    this.tweens.add({ targets: t, alpha: 0, scaleX: 0.3, scaleY: 0.3, duration: 300, onComplete: () => t.destroy() });
                }
            }

            const tileX = Math.floor(s.sprite.x / this.TILE_SIZE);
            const tileY = Math.floor(s.sprite.y / this.TILE_SIZE);

            // ── Boss pixel-radius hit check (all shard types) ────────────────
            // damageBossAtTile uses a coarse tile-distance check and misses most
            // shard hits since shards move at pixel level. Check pixel distance
            // against the boss's actual hitbox radius so shards are consumed on hit.
            if (this.voltslimeBoss?.active) {
                const boss = this.voltslimeBoss;
                const bpx = boss.container.x;
                const bpy = boss.container.y;
                const BOSS_HIT_RADIUS = 40;
                const bdx = s.sprite.x - bpx;
                const bdy = s.sprite.y - bpy;
                s._hitBossThisFrame = false;

                if (bdx * bdx + bdy * bdy < BOSS_HIT_RADIUS * BOSS_HIT_RADIUS) {
                    // Each shard gets a unique ID — boss tracks which shards have already hit
                    if (!s._id) s._id = Math.random().toString(36).slice(2);
                    if (!boss._hitShards) boss._hitShards = new Set();
                    if (!boss._frozenByShards) boss._frozenByShards = new Set();

                    if (!boss._hitShards.has(s._id)) {
                        boss._hitShards.add(s._id);
                        s._hitBossThisFrame = true;

                        const wasAlreadyFrozen = boss._isFrozen;

                        // Pierce spike and block shards instant-freeze; splitters only shatter
                        if (!s.isSplitter) {
                            if (typeof this.freezeBossFromIceWeapon === 'function') {
                                this.freezeBossFromIceWeapon(!!s.isBlock || !!s.isPierceSpike);
                            }
                            // Apply gold/purple mark on boss — handled below after justFroze
                        }

                        const justFroze = !wasAlreadyFrozen && boss._isFrozen;
                        // Mark logic: gold on first spike, purple on second spike that hits
                        // an ALREADY-frozen gold-marked boss (wasAlreadyFrozen prevents instant
                        // purple from a second spike landing in the same volley that froze it)
                        if (s.isPierceSpike) {
                            if (boss._shatterMarked && !boss._purpleMarked && wasAlreadyFrozen) {
                                this._applyPurpleMarkBoss();
                            } else if (!boss._shatterMarked && !boss._purpleMarked) {
                                this._applyGoldMarkBoss();
                            }
                        }
                        if (justFroze) {
                            // Remember this shard froze the boss — it can't shatter it
                            boss._frozenByShards.add(s._id);
                            // Don't deal damage the frame we froze
                        } else if (!boss._frozenByShards.has(s._id)) {
                            // Splitters: shatter if frozen, else normal damage
                            if (s.isSplitter && !boss._isFrozen) {
                                // Normal splitter damage — no freeze
                                this.damageVoltslimeBoss(s.damage);
                            } else {
                                this.damageVoltslimeBoss(s.damage);
                            }
                        }

                        this.spawnBounceImpact(s.sprite.x, s.sprite.y);

                        // Only non-piercing shards are consumed
                        if (!s.isPierceSpike && !s.isHealShard && !s.isSplitter) {
                            this.destroyIceShard(s);
                            this.iceShards.splice(i, 1);
                            continue;
                        }
                    }
                }
            }

            // ── Void Sovereign pixel-radius hit check (mirrors voltslime above) ──
            if (this.voidSovereignBoss?.active && !this.voidSovereignBoss._isInvulnerable) {
                const vboss = this.voidSovereignBoss;
                const vpx = vboss.container.x;
                const vpy = vboss.container.y;
                const VBOSS_HIT_RADIUS = 48;
                const vdx = s.sprite.x - vpx;
                const vdy = s.sprite.y - vpy;

                if (vdx * vdx + vdy * vdy < VBOSS_HIT_RADIUS * VBOSS_HIT_RADIUS) {
                    if (!s._id) s._id = Math.random().toString(36).slice(2);
                    if (!vboss._hitShards) vboss._hitShards = new Set();
                    if (!vboss._frozenByShards) vboss._frozenByShards = new Set();
                    if (!vboss._hitShards.has(s._id)) {
                        vboss._hitShards.add(s._id);
                        s._hitBossThisFrame = true;

                        const wasAlreadyFrozen = vboss._isFrozen;

                        // Cannon shards chill/freeze VS; pierce/block instant-freeze; splitters only shatter
                        if (!s.isSplitter) {
                            if (typeof this.freezeBossFromIceWeapon === 'function') {
                                this.freezeBossFromIceWeapon(!!s.isBlock || !!s.isPierceSpike);
                            }
                        }

                        const justFroze = !wasAlreadyFrozen && vboss._isFrozen;

                        if (justFroze) {
                            // Froze VS this frame — don't deal damage
                            vboss._frozenByShards.add(s._id);
                        } else if (!vboss._frozenByShards.has(s._id)) {
                            // Already frozen → shatter bonus; or normal damage
                            if (wasAlreadyFrozen) {
                                // Shatter — deal full damage with shatter mult
                                const shatterMult = s.isCannonShard ? (s._shatterMult || 0.5) : 1.0;
                                this.damageVoidSovereignBoss(s.damage * (1 + shatterMult * 5));
                                if (typeof this._clearFreezeVisuals === 'function') this._clearFreezeVisuals(vboss._bossProxy || vboss);
                                if (typeof this._thawVoidSovereign === 'function') this._thawVoidSovereign();
                                this.showStatusText(vpx, vpy - 60, 'SHATTER!', '#aaffff');
                            } else {
                                this.damageVoidSovereignBoss(s.damage);
                            }
                        }

                        if (!s.isPierceSpike && !s.isSplitter) {
                            this.destroyIceShard(s);
                            this.iceShards.splice(i, 1);
                            continue;
                        }
                    }
                }
            }

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
                if (s.isHealShard && s._onImpact) { s._onImpact(s.sprite.x, s.sprite.y); this.destroyIceShard(s); this.iceShards.splice(i, 1); continue; }
                if (s.isTsunamiScatter || s.isPierceSpike) { this.destroyIceShard(s); this.iceShards.splice(i, 1); continue; }
                if (s.isSplitter && s.splitterGen === 4 && !s.isRecalling) {
                    // Wall hit triggers immediate recall instead of destruction
                    if (s._splitTimer) { s._splitTimer.remove(); s._splitTimer = null; }
                    if (s._recallTimer) { s._recallTimer.remove(); }
                    s.isRecalling = true; s.hitEnemies = new Set(); s._recallDamage = s.damage * 2.2;
                    s.vx = -s.vx; continue;
                }
                if (s.isCannonShard && !(s.isSplitter && s.isRecalling)) {
                    if (s.isMiniHealShard) { this.destroyIceShard(s); this.iceShards.splice(i, 1); continue; }
                    if (s.isPiercing && s.bounces < s.maxBounces) { s.vx = -s.vx; s.bounces++; s.pierceCount = 0; s.piercedEnemies = new Set(); this.spawnBounceImpact(s.sprite.x, s.sprite.y); continue; }
                    this.destroyIceShard(s); this.iceShards.splice(i, 1); continue;
                }
            } else if (hitWallY && !hitWallX) {
                if (s.isHealShard && s._onImpact) { s._onImpact(s.sprite.x, s.sprite.y); this.destroyIceShard(s); this.iceShards.splice(i, 1); continue; }
                if (s.isTsunamiScatter || s.isPierceSpike) { this.destroyIceShard(s); this.iceShards.splice(i, 1); continue; }
                if (s.isSplitter && s.splitterGen === 4 && !s.isRecalling) {
                    if (s._splitTimer) { s._splitTimer.remove(); s._splitTimer = null; }
                    if (s._recallTimer) { s._recallTimer.remove(); }
                    s.isRecalling = true; s.hitEnemies = new Set(); s._recallDamage = s.damage * 2.2;
                    s.vy = -s.vy; continue;
                }
                if (s.isCannonShard && !(s.isSplitter && s.isRecalling)) {
                    if (s.isMiniHealShard) { this.destroyIceShard(s); this.iceShards.splice(i, 1); continue; }
                    if (s.isPiercing && s.bounces < s.maxBounces) { s.vy = -s.vy; s.bounces++; s.pierceCount = 0; s.piercedEnemies = new Set(); this.spawnBounceImpact(s.sprite.x, s.sprite.y); continue; }
                    this.destroyIceShard(s); this.iceShards.splice(i, 1); continue;
                }
                if (s.isSplitter && s.isRecalling) { s.vy = -s.vy; continue; }
                s.vy = -s.vy; s.bounces++; this.spawnBounceImpact(s.sprite.x, s.sprite.y);
            } else if (hitWallX && hitWallY) {
                if (s.isHealShard && s._onImpact) { s._onImpact(s.sprite.x, s.sprite.y); this.destroyIceShard(s); this.iceShards.splice(i, 1); continue; }
                if (s.isTsunamiScatter || s.isPierceSpike) { this.destroyIceShard(s); this.iceShards.splice(i, 1); continue; }
                if (s.isSplitter && s.splitterGen === 4 && !s.isRecalling) {
                    if (s._splitTimer) { s._splitTimer.remove(); s._splitTimer = null; }
                    if (s._recallTimer) { s._recallTimer.remove(); }
                    s.isRecalling = true; s.hitEnemies = new Set(); s._recallDamage = s.damage * 2.2;
                    s.vx = -s.vx; s.vy = -s.vy; continue;
                }
                if (s.isCannonShard && !(s.isSplitter && s.isRecalling)) {
                    if (s.isMiniHealShard) { this.destroyIceShard(s); this.iceShards.splice(i, 1); continue; }
                    if (s.isPiercing && s.bounces < s.maxBounces) { s.vx = -s.vx; s.vy = -s.vy; s.bounces += 2; s.pierceCount = 0; s.piercedEnemies = new Set(); this.spawnBounceImpact(s.sprite.x, s.sprite.y); continue; }
                    this.destroyIceShard(s); this.iceShards.splice(i, 1); continue;
                }
                if (s.isSplitter && s.isRecalling) { s.vx = -s.vx; s.vy = -s.vy; continue; }
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

            // Keep shatter mark visuals pinned to their enemies each frame
            for (const enemy of this.enemies) {
                if (enemy._shatterMarkVisual && enemy.sprite?.active) {
                    enemy._shatterMarkVisual.x = enemy.sprite.x;
                    enemy._shatterMarkVisual.y = enemy.sprite.y - 20;
                }
            }

            // ── Pierce spike afterimages — ghost copies fading behind ──
            if (s.isPierceSpike && time - (s._lastAfterimageTime || 0) > 18) {
                s._lastAfterimageTime = time;
                const af = this.add.graphics().setDepth(3.0);
                af.x = s.sprite.x; af.y = s.sprite.y;
                af.rotation = s.sprite.rotation;
                // Same shape as main bullet but tinted and smaller
                const AL = 18, AW = 3.5;
                const idx2 = Math._afterimageCount = ((Math._afterimageCount || 0) + 1) % 3;
                const afCol = idx2 === 0 ? 0xaaeeff : idx2 === 1 ? 0x66bbdd : 0x3388aa;
                af.fillStyle(afCol, 0.55);
                af.beginPath(); af.moveTo(0, -AL*1.1); af.lineTo(AW, -AL*0.1); af.lineTo(AW*0.7, AL*0.5); af.lineTo(-AW*0.7, AL*0.5); af.lineTo(-AW, -AL*0.1); af.closePath(); af.fillPath();
                af.fillStyle(0xffffff, 0.40);
                af.beginPath(); af.moveTo(0, -AL*1.1); af.lineTo(1.5, -AL*0.7); af.lineTo(-1.5, -AL*0.7); af.closePath(); af.fillPath();
                this.tweens.add({
                    targets: af, alpha: 0, scaleX: 0.5, scaleY: 0.5,
                    duration: 90, ease: 'Quad.easeOut',
                    onComplete: () => af.destroy()
                });
            }

            // ── Homing splinter: after burst delay, curve toward nearest enemy ──
            if (s.isHealSplinter && time - s._spawnTime > s._homingDelay) {
                const HOMING_STRENGTH = 0.14;
                const SPLINTER_SPEED  = 110;

                // Find/validate target — frozen enemies get priority
                if (!s._homingTarget || !s._homingTarget.sprite?.active || s._homingTarget.health <= 0) {
                    let nearest = null, nearestDist2 = Infinity;
                    let nearestFrozen = null, nearestFrozenDist2 = Infinity;
                    for (const enemy of this.enemies) {
                        if (!enemy.sprite?.active || enemy.health <= 0) continue;
                        const edx = enemy.sprite.x - s.sprite.x, edy = enemy.sprite.y - s.sprite.y;
                        const d2  = edx * edx + edy * edy;
                        if (enemy.isFrozen) {
                            if (d2 < nearestFrozenDist2) { nearestFrozenDist2 = d2; nearestFrozen = enemy; }
                        } else {
                            if (d2 < nearestDist2) { nearestDist2 = d2; nearest = enemy; }
                        }
                    }
                    // Prefer frozen target; fall back to nearest unfrozen
                    s._homingTarget = nearestFrozen || nearest;
                }

                if (s._homingTarget) {
                    const tx  = s._homingTarget.sprite.x, ty = s._homingTarget.sprite.y;
                    const tdx = tx - s.sprite.x,          tdy = ty - s.sprite.y;
                    const tlen = Math.sqrt(tdx * tdx + tdy * tdy) || 1;
                    // Steer velocity toward target
                    s.vx += (tdx / tlen) * SPLINTER_SPEED * HOMING_STRENGTH;
                    s.vy += (tdy / tlen) * SPLINTER_SPEED * HOMING_STRENGTH;
                    // Clamp to max speed so homing doesn't accelerate forever
                    const speed = Math.sqrt(s.vx * s.vx + s.vy * s.vy);
                    if (speed > SPLINTER_SPEED * 1.25) {
                        s.vx = (s.vx / speed) * SPLINTER_SPEED * 1.25;
                        s.vy = (s.vy / speed) * SPLINTER_SPEED * 1.25;
                    }
                }
            }

            // ── Gen 4 splitter recall: snap back toward player, destroy on arrival ──
            if (s.isSplitter && s.splitterGen === 4 && s.isRecalling) {
                const RECALL_SPEED   = 220;
                const RECALL_ACCEL   = 0.28;
                const playerPx = this.playerX * this.TILE_SIZE + this.TILE_SIZE / 2;
                const playerPy = this.playerY * this.TILE_SIZE + this.TILE_SIZE / 2;
                const tdx = playerPx - s.sprite.x, tdy = playerPy - s.sprite.y;
                const tlen = Math.sqrt(tdx * tdx + tdy * tdy) || 1;
                s.vx += (tdx / tlen) * RECALL_SPEED * RECALL_ACCEL;
                s.vy += (tdy / tlen) * RECALL_SPEED * RECALL_ACCEL;
                const spd = Math.sqrt(s.vx * s.vx + s.vy * s.vy);
                if (spd > RECALL_SPEED) { s.vx = (s.vx / spd) * RECALL_SPEED; s.vy = (s.vy / spd) * RECALL_SPEED; }
                // Destroy when close enough to player
                if (tlen < 18) {
                    this.destroyIceShard(s); this.iceShards.splice(i, 1); continue;
                }
            }

            // Heal orb: continuous DPS + one-time lifesteal per enemy, every 80ms
            if (s.isHealShard && s.lastDamageTick !== undefined) {
                if (time - s.lastDamageTick >= 80) {
                    s.lastDamageTick = time;
                    const orbX = s.sprite.x, orbY = s.sprite.y;
                    for (const enemy of this.enemies) {
                        if (!enemy.sprite?.active) continue;
                        if (enemy.fireImmune) continue;
                        const dx = enemy.sprite.x - orbX, dy = enemy.sprite.y - orbY;
                        if (dx * dx + dy * dy > (32 * 32)) continue;
                        if (!enemy.iceImmune) {
                            enemy.health -= s.damage;
                            this.showDamageNumber(enemy.sprite.x, enemy.sprite.y - 8, s.damage, '#00ff88');
                            this.updateEnemyHealthBar(enemy);
                            if (enemy.health <= 0) { this.killEnemy(enemy); continue; }
                        }
                        if (!s.healedEnemies.has(enemy)) {
                            s.healedEnemies.add(enemy);
                            const cap = this.maxHealth + s._healMaxOverheal;
                            if (this.health < cap) {
                                const healed = Math.min(5, cap - this.health);
                                this.health += healed;
                                this.updateHUD();
                                const hx = this.playerX * this.TILE_SIZE + this.TILE_SIZE / 2;
                                const hy = this.playerY * this.TILE_SIZE + this.TILE_SIZE / 2;
                                this.showDamageNumber(hx, hy - 20, healed, '#00ff88');
                            }
                        }
                    }
                    this.tweens.add({ targets: s.sprite, scaleX: 1.25, scaleY: 1.25, duration: 55, yoyo: true, ease: 'Quad.easeOut' });
                }
            }

            // Enemy hit
            let destroyed = false;
            for (let enemy of this.enemies) {
                if (s.hitEnemies?.has(enemy)) continue;
                if (s.piercedEnemies?.has(enemy)) continue;
                const ex = enemy.sprite.x, ey = enemy.sprite.y;

                // Check distance from shard's path to enemy
                const distToPath = this.distancePointToSegment(ex, ey, oldX, oldY, s.sprite.x, s.sprite.y);
                const hitRadius = s.isBlock ? 16 : s.isHealShard ? 28 : 16;

                if (distToPath < hitRadius) {
                    if (s.isBlock) {
                        // Always freeze on block hit
                        this.damageEnemyIce(enemy, s.damage);
                        this.freezeEnemy(enemy, this.iceBlockFreezeDuration);
                        this.spawnIceSplinter(ex, ey);
                        this.spawnIceSplinter(ex, ey);
                        this.destroyIceShard(s);
                        this.iceShards.splice(i, 1);
                        destroyed = true;
                        break;
                    } else if (s.isPierceSpike) {
                        // ── PIERCE SPIKE ─────────────────────────────────
                        if (s.hitEnemies.has(enemy)) continue;
                        s.hitEnemies.add(enemy);

                        // ── Spawn frost totem on FIRST hit ───────────────
                        if (s.hitEnemies.size === 1) {
                            this._spawnFrostTotem(ex, ey);
                        }

                        if (!enemy.iceImmune && !enemy.fireImmune && !enemy.elementImmune) {
                            // Damage
                            enemy.health -= s.damage;
                            this.showDamageNumber(ex, ey - 10, Math.round(s.damage), '#aaeeff');
                            this.updateEnemyHealthBar(enemy);
                            if (enemy.health <= 0) { this.killEnemy(enemy); continue; }

                            // ── Mark upgrade logic ───────────────────────
                            if (enemy._shatterMarked && !enemy._purpleMarked) {
                                // Upgrade gold → purple
                                this._applyPurpleMark(enemy, ex, ey);
                            } else if (!enemy._purpleMarked) {
                                // Fresh gold mark
                                this._applyGoldMark(enemy, ex, ey);
                            }
                            // Already purple — do nothing extra

                            // Freeze if not already frozen
                            if (!enemy.isFrozen) {
                                this._destroyChillIndicator(enemy);
                                this.freezeEnemy(enemy, 4500);
                                enemy._justFrozenAt = this.time.now; // prevent same-frame shatter
                                this.gainUltCharge(this.ultChargePerFreeze);
                                const ff = this.add.graphics().setDepth(4);
                                ff.x = ex; ff.y = ey;
                                ff.fillStyle(0xaaeeff, 0.45); ff.fillCircle(0, 0, 12);
                                ff.fillStyle(0xffffff, 0.70); ff.fillCircle(0, 0, 5);
                                this.tweens.add({ targets: ff, scaleX: 2.0, scaleY: 2.0, alpha: 0, duration: 200, onComplete: () => ff.destroy() });
                            }
                        } else if (enemy.iceImmune) {
                            // Pierce spike bypasses ice immunity — instantly freezes ice elementals
                            if (!enemy.isFrozen) {
                                this._destroyChillIndicator(enemy);
                                this.freezeEnemy(enemy, 4500);
                                enemy._justFrozenAt = this.time.now;
                                this.gainUltCharge(this.ultChargePerFreeze);
                                this.showStatusText(ex, ey - 10, 'PIERCED!', '#ffffff');
                                const ff = this.add.graphics().setDepth(4);
                                ff.x = ex; ff.y = ey;
                                ff.fillStyle(0xffffff, 0.9); ff.fillCircle(0, 0, 18);
                                ff.fillStyle(0xaaeeff, 0.6); ff.fillCircle(0, 0, 10);
                                this.tweens.add({ targets: ff, scaleX: 2.5, scaleY: 2.5, alpha: 0, duration: 220, onComplete: () => ff.destroy() });
                            }
                            // Mark upgrade for ice elementals too
                            if (enemy._shatterMarked && !enemy._purpleMarked) {
                                this._applyPurpleMark(enemy, ex, ey);
                            } else if (!enemy._purpleMarked) {
                                this._applyGoldMark(enemy, ex, ey);
                            }
                        }
                        // Keep mark visual following enemy each frame
                        if (enemy._shatterMarkVisual && enemy.sprite?.active) {
                            enemy._shatterMarkVisual.x = enemy.sprite.x;
                            enemy._shatterMarkVisual.y = enemy.sprite.y - 20;
                        }
                        // Does NOT destroy — continues piercing
                        // Pierce spike instant-freezes queen portals on tile
                        const piercePortal = this.getPortalAt(tileX, tileY);
                        if (piercePortal) {
                            this.damagePortal(piercePortal, s.damage, { freeze: true });
                        }
                        // Apply instant freeze to boss if hit
                        if (typeof this.freezeBossFromIceWeapon === 'function') {
                            const btx = Math.floor(s.sprite.x / this.TILE_SIZE);
                            const bty = Math.floor(s.sprite.y / this.TILE_SIZE);
                            if (this.voltslimeBoss?.active &&
                                Math.abs(btx - this.voltslimeBoss.tileX) <= 1 &&
                                Math.abs(bty - this.voltslimeBoss.tileY) <= 1) {
                                this.freezeBossFromIceWeapon(true);
                            }
                        }
                    } else if (s.isSplitter) {
                        // Splitter fragment — damages, shatters frozen, small AoE, pierces
                        if (s.hitEnemies.has(enemy)) continue;
                        s.hitEnemies.add(enemy);
                        const hitDmg = s.isRecalling ? (s._recallDamage || s.damage * 2.2) : s.damage;
                        // Shatter mark multiplier — 4× purple, 3× gold
                        const markMult = enemy._purpleMarked ? 4.0 : enemy._shatterMarked ? 3.0 : 1.0;
                        const finalHitDmg = hitDmg * markMult;
                        // Check frozen BEFORE immunity — frozen iceImmune enemies shatter
                        if (enemy.isFrozen) {
                            this._triggerShatterBurst(enemy);
                        } else if (!enemy.iceImmune && !enemy.fireImmune && !enemy.elementImmune) {
                            enemy.health -= finalHitDmg;
                            const dmgCol = enemy._purpleMarked ? '#cc44ff' : enemy._shatterMarked ? '#ffdd44' : s.isRecalling ? '#ffffff' : '#66ccff';
                            this.showDamageNumber(ex, ey - 10, Math.round(finalHitDmg), dmgCol);
                            this.updateEnemyHealthBar(enemy);
                            this.gainUltCharge(this.ultChargePerHit);
                            if (enemy.health <= 0) {
                                if (enemy._shatterMarkVisual) { this.tweens.killTweensOf(enemy._shatterMarkVisual); enemy._shatterMarkVisual.destroy(); enemy._shatterMarkVisual = null; }
                                if (enemy._shatterMarkTimer) { enemy._shatterMarkTimer.remove(); enemy._shatterMarkTimer = null; }
                                this.killEnemy(enemy);
                            }
                        }
                        // Small AoE ice explosion on each fragment hit — also scales with mark
                        const AOE_RADIUS = 28;
                        const aoeG = this.add.graphics().setDepth(4.5);
                        aoeG.x = ex; aoeG.y = ey;
                        // Marked hits flash gold/yellow instead of blue
                        const aoeCol = enemy._purpleMarked ? 0xaa22ff : enemy._shatterMarked ? 0xffdd44 : s.isRecalling ? 0xffffff : 0xaaeeff;
                        const aoeMid = enemy._purpleMarked ? 0xdd88ff : enemy._shatterMarked ? 0xffff88 : s.isRecalling ? 0xffffff : 0xddf8ff;
                        aoeG.fillStyle(aoeCol, (enemy._purpleMarked || enemy._shatterMarked) ? 0.40 : s.isRecalling ? 0.22 : 0.30); aoeG.fillCircle(0, 0, AOE_RADIUS * ((enemy._purpleMarked || enemy._shatterMarked) ? 1.4 : 1.0));
                        aoeG.fillStyle(0xffffff, 0.65); aoeG.fillCircle(0, 0, AOE_RADIUS * 0.35);
                        aoeG.lineStyle(1.2, aoeMid, 0.70); aoeG.strokeCircle(0, 0, AOE_RADIUS * 0.80);
                        for (let ai = 0; ai < 5; ai++) {
                            const aa = (ai / 5) * Math.PI * 2;
                            aoeG.lineStyle(0.9, 0xffffff, 0.55);
                            aoeG.beginPath(); aoeG.moveTo(Math.cos(aa)*5, Math.sin(aa)*5); aoeG.lineTo(Math.cos(aa)*AOE_RADIUS*0.75, Math.sin(aa)*AOE_RADIUS*0.75); aoeG.strokePath();
                        }
                        this.tweens.add({ targets: aoeG, scaleX: 1.8, scaleY: 1.8, alpha: 0, duration: 180, ease: 'Quad.easeOut', onComplete: () => aoeG.destroy() });
                        // Damage nearby enemies in AoE radius
                        for (const nearEnemy of this.enemies) {
                            if (nearEnemy === enemy || s.hitEnemies.has(nearEnemy)) continue;
                            if (!nearEnemy.sprite?.active) continue;
                            const aex = nearEnemy.sprite.x, aey = nearEnemy.sprite.y;
                            const adx = aex - ex, ady = aey - ey;
                            if (adx*adx + ady*ady > AOE_RADIUS*AOE_RADIUS) continue;
                            s.hitEnemies.add(nearEnemy);
                            // Check frozen BEFORE immunity — frozen iceImmune enemies shatter
                            if (nearEnemy.isFrozen) {
                                this._triggerShatterBurst(nearEnemy);
                            } else if (!nearEnemy.iceImmune && !nearEnemy.fireImmune && !nearEnemy.elementImmune) {
                                const aoeDmg = finalHitDmg * 0.6;
                                nearEnemy.health -= aoeDmg;
                                this.showDamageNumber(aex, aey - 10, Math.round(aoeDmg), s.isRecalling ? '#ffffff' : '#88ddff');
                                this.updateEnemyHealthBar(nearEnemy);
                                if (nearEnemy.health <= 0) this.killEnemy(nearEnemy);
                            }
                        }
                        // Splitter fragments pierce — they don't stop on hit
                        // Accumulate boss freeze stacks on each splitter hit
                        if (typeof this.freezeBossFromIceWeapon === 'function') {
                            const btx = Math.floor(s.sprite.x / this.TILE_SIZE);
                            const bty = Math.floor(s.sprite.y / this.TILE_SIZE);
                            if (this.voltslimeBoss?.active &&
                                Math.abs(btx - this.voltslimeBoss.tileX) <= 1 &&
                                Math.abs(bty - this.voltslimeBoss.tileY) <= 1) {
                                this.freezeBossFromIceWeapon(false);
                            }
                        }
                    } else if (s.isCannonShard) {
                        if (s.piercedEnemies.has(enemy)) continue;
                        s.piercedEnemies.add(enemy);
                        if (s.isHealShard) {
                            // New heal shard — projectile style, triggers on first hit
                            if (s._onHit) s._onHit(enemy);
                            this.destroyIceShard(s);
                            this.iceShards.splice(i, 1);
                            destroyed = true;
                            break;
                        } else if (s.isHealSplinter) {
                            // Homing splinter — chill/shatter ice elementals, damage + heal on hit
                            if (enemy.fireImmune || enemy.elementImmune) {
                                // fire elementals immune to all ice
                            } else if (enemy.isFrozen) {
                                // SHATTER — works on all enemies including iceImmune
                                this._triggerShatterBurst(enemy);
                                const shatterHealBonus = (s._healAmount || 20) / 3;
                                this.health = Math.min((this.maxHealth || 100) + (s._healMaxOverheal || 25), this.health + shatterHealBonus);
                                if (typeof HUD !== 'undefined') HUD.prototype.updateHUD.call(this);
                                const shb = this.add.graphics().setDepth(5);
                                shb.x = ex; shb.y = ey;
                                shb.fillStyle(0x00ffaa, 0.65); shb.fillCircle(0, 0, 16);
                                shb.fillStyle(0xffffff, 0.90); shb.fillCircle(0, 0, 6);
                                for (let ri = 0; ri < 6; ri++) {
                                    const ra = (ri / 6) * Math.PI * 2;
                                    shb.lineStyle(1.5, 0x88ffcc, 0.80);
                                    shb.beginPath(); shb.moveTo(Math.cos(ra)*6, Math.sin(ra)*6); shb.lineTo(Math.cos(ra)*18, Math.sin(ra)*18); shb.strokePath();
                                }
                                this.tweens.add({ targets: shb, scaleX: 2.8, scaleY: 2.8, alpha: 0, duration: 320, ease: 'Quad.easeOut', onComplete: () => shb.destroy() });
                            } else if (enemy.iceImmune) {
                                // Ice elementals: apply chill stack toward freeze (no chip damage)
                                if (!enemy.chillStacks) enemy.chillStacks = 0;
                                enemy.chillStacks = Math.min(3, enemy.chillStacks + 1);
                                enemy.lastChillTime = time;
                                this._updateChillIndicator(enemy);
                                if (enemy.chillStacks >= 3) {
                                    enemy.chillStacks = 0;
                                    this._destroyChillIndicator(enemy);
                                    this.freezeEnemy(enemy, 1500);
                                    this.gainUltCharge(this.ultChargePerFreeze);
                                }
                                // Heal 1hp per hit even on iceImmune
                                this.health = Math.min((this.maxHealth || 100) + (s._healMaxOverheal || 25), this.health + 1);
                                if (typeof HUD !== 'undefined') HUD.prototype.updateHUD.call(this);
                            } else {
                                // Normal enemy — damage + chill + heal
                                enemy.health -= s.damage;
                                this.showDamageNumber(enemy.sprite.x, enemy.sprite.y - 8, Math.round(s.damage), '#44ffaa');
                                this.updateEnemyHealthBar(enemy);
                                if (enemy.health <= 0) this.killEnemy(enemy);
                                if (!enemy.chillStacks) enemy.chillStacks = 0;
                                enemy.chillStacks = Math.min(3, enemy.chillStacks + 1);
                                enemy.lastChillTime = time;
                                this._updateChillIndicator(enemy);
                                if (enemy.chillStacks >= 3) {
                                    enemy.chillStacks = 0;
                                    this._destroyChillIndicator(enemy);
                                    this.freezeEnemy(enemy, 1500);
                                    this.gainUltCharge(this.ultChargePerFreeze);
                                }
                                // Heal 1hp per hit
                                this.health = Math.min((this.maxHealth || 100) + (s._healMaxOverheal || 25), this.health + 1);
                                if (typeof HUD !== 'undefined') HUD.prototype.updateHUD.call(this);
                                const hb = this.add.graphics().setDepth(5);
                                hb.x = ex; hb.y = ey;
                                hb.fillStyle(0x00ff88, 0.70); hb.fillCircle(0, 0, 8);
                                hb.fillStyle(0xffffff, 0.85); hb.fillCircle(0, 0, 3);
                                this.tweens.add({ targets: hb, scaleX: 2.2, scaleY: 2.2, alpha: 0, duration: 220, onComplete: () => hb.destroy() });
                            }
                            // Apply freeze stack to boss on splinter hit
                            if (typeof this.freezeBossFromIceWeapon === 'function') {
                                const btx = Math.floor(ex / this.TILE_SIZE);
                                const bty = Math.floor(ey / this.TILE_SIZE);
                                if (this.voltslimeBoss?.active &&
                                    Math.abs(btx - this.voltslimeBoss.tileX) <= 1 &&
                                    Math.abs(bty - this.voltslimeBoss.tileY) <= 1) {
                                    this.freezeBossFromIceWeapon(false);
                                }
                            }
                            this.destroyIceShard(s);
                            this.iceShards.splice(i, 1);
                            destroyed = true;
                            break;
                        } else if (s.isMiniHealShard) {
                            // Fixed-direction mini shard — consumed on first hit
                            if (enemy.fireImmune || enemy.elementImmune) {
                                // skip
                            } else if (enemy.isFrozen) {
                                this._triggerShatterBurst(enemy, 1 / 7.5);
                            } else if (!enemy.iceImmune) {
                                enemy.health -= s.damage;
                                this.showDamageNumber(ex, ey - 8, Math.round(s.damage), '#44ffaa');
                                this.updateEnemyHealthBar(enemy);
                                if (enemy.health <= 0) { this.killEnemy(enemy); }
                                // 1 chill stack
                                if (!enemy.chillStacks) enemy.chillStacks = 0;
                                enemy.chillStacks++;
                                enemy.lastChillTime = this.time.now;
                                this._updateChillIndicator(enemy);
                                if (enemy.chillStacks >= 3) {
                                    enemy.chillStacks = 0; enemy.frozenAt = this.time.now;
                                    this._destroyChillIndicator(enemy);
                                    this.freezeEnemy(enemy, 10000);
                                    this.gainUltCharge(this.ultChargePerFreeze);
                                }
                            }
                            // Heal per mini shard hit
                            this.health = Math.min((this.maxHealth || 100) + 25, this.health + (s._healAmount || 1));
                            if (typeof HUD !== 'undefined') HUD.prototype.updateHUD.call(this);
                            // Small heal pip visual
                            const hpG = this.add.graphics().setDepth(5);
                            hpG.x = ex; hpG.y = ey;
                            hpG.fillStyle(0x00ff88, 0.65); hpG.fillCircle(0, 0, 6);
                            hpG.fillStyle(0xffffff, 0.85); hpG.fillCircle(0, 0, 2);
                            this.tweens.add({ targets: hpG, scaleX: 2.0, scaleY: 2.0, alpha: 0, duration: 200, onComplete: () => hpG.destroy() });
                            // Destroy on first hit
                            this.damageBossAtTile(Math.floor(ex / this.TILE_SIZE), Math.floor(ey / this.TILE_SIZE), s.damage);
                            const _hsTX = Math.floor(ex / this.TILE_SIZE), _hsTY = Math.floor(ey / this.TILE_SIZE);
                            const _hsP = this.getPortalAt(_hsTX, _hsTY);
                            if (_hsP) this.damagePortal(_hsP, s.damage, { chill: true });
                            this.destroyIceShard(s); this.iceShards.splice(i, 1); destroyed = true; break;
                        } else {
                            // Normal cannon shard — _onHit handles immunity + damage + chill + shatter
                            if (s._onHit) s._onHit(enemy);
                            this.spawnBounceImpact(ex, ey);
                            const _csTX = Math.floor(s.sprite.x / this.TILE_SIZE);
                            const _csTY = Math.floor(s.sprite.y / this.TILE_SIZE);
                            this.damageBossAtTile(_csTX, _csTY, s.damage);
                            const _csP = this.getPortalAt(_csTX, _csTY);
                            if (_csP) this.damagePortal(_csP, s.damage, { chill: true });
                            if (s.isPiercing) {
                                s.pierceCount++;
                                if (s.pierceCount >= s.maxPierces) {
                                    this.destroyIceShard(s); this.iceShards.splice(i, 1); destroyed = true; break;
                                }
                                // else continue piercing through
                            } else {
                                this.destroyIceShard(s); this.iceShards.splice(i, 1); destroyed = true; break;
                            }
                        }
                    } else if (s.isTsunamiScatter) {
                        // Tsunami scatter — pierce through enemies, shatter frozen ones
                        s.hitEnemies.add(enemy);
                        if (enemy.isFrozen) {
                            this._triggerShatterBurst(enemy);
                        } else {
                            this.damageEnemyIce(enemy, s.damage);
                            this.freezeEnemy(enemy, 2800);
                            this.spawnIceSplinter(ex, ey);
                        }

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
            // Tile-based boss fallback — only fires if pixel check didn't already handle it
            if (!destroyed && !s._hitBossThisFrame &&
                (s.isCannonShard || s.isPierceSpike || s.isSplitter || s.isHealSplinter)) {
                this.damageBossAtTile(tileX, tileY, s.damage, s.createdAt);
                // Also hit queen portal on current tile — chill for ice shards
                const fbPortal = this.getPortalAt(tileX, tileY);
                if (fbPortal) {
                    const isIceShard = s.isCannonShard || s.isPierceSpike || s.isSplitter || s.isHealSplinter;
                    this.damagePortal(fbPortal, s.damage, isIceShard ? { chill: true } : {});
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
        if (s.sprite._glow)           { this.tweens.killTweensOf(s.sprite._glow);     s.sprite._glow.destroy(); }
        if (s.sprite._innerOrb)       { this.tweens.killTweensOf(s.sprite._innerOrb); s.sprite._innerOrb.destroy(); }
        if (s.sprite._glowPulseTimer) { s.sprite._glowPulseTimer.remove(); s.sprite._glowPulseTimer = null; }
        if (s._splitTimer)            { s._splitTimer.remove();  s._splitTimer  = null; }
        if (s._recallTimer)           { s._recallTimer.remove(); s._recallTimer = null; }
        this.tweens.killTweensOf(s.sprite);
        s.sprite.destroy();
    }

    // Generic helper — call after moving any player projectile to check crack collision (Level 4 Fracture Core).
    // Projectiles PIERCE cracks — shrinking every crack they currently touch (each on its own cooldown).
    // Does not destroy or stop the projectile.
    _checkProjectileCrackShrink(wx, wy) {
        if (!this.isLevel4 || !this.fractureCore?.active || !this._cracks?.length) return false;
        const TS = this.TILE_SIZE;
        const time = this.time.now;
        let hitAny = false;
        for (const crack of this._cracks) {
            const halfW = crack.width * TS / 2;
            const pts = crack.points;
            for (let i = 0; i < pts.length - 1; i++) {
                const x1 = pts[i].x * TS, y1 = pts[i].y * TS;
                const x2 = pts[i+1].x * TS, y2 = pts[i+1].y * TS;
                const d = Utils.distancePointToSegment(wx, wy, x1, y1, x2, y2);
                if (d < halfW) {
                    if (this._shrinkCrack(crack, time)) hitAny = true;
                    break; // one hit per crack per check, regardless of segment count
                }
            }
        }
        return hitAny;
    }

    updateFireballs(delta) {
        const deltaSeconds = delta / 1000;

        for (let i = this.fireballs.length - 1; i >= 0; i--) {
            const fireball = this.fireballs[i];

            fireball.sprite.x += fireball.vx * deltaSeconds;
            fireball.sprite.y += fireball.vy * deltaSeconds;

            // Crack shrink — pierces, no effect on projectile flight (Level 4)
            this._checkProjectileCrackShrink(fireball.sprite.x, fireball.sprite.y);

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

                if (fireball._isSupernova) {
                    // ── Blue supernova fireball ──────────────────────────
                    g.fillStyle(0x0033cc, 0.10); g.fillCircle(4, 0, 22);
                    g.fillStyle(0x0055ff, 0.18); g.fillCircle(5, 0, 16);
                    g.fillStyle(0x1166ff, 0.55); g.fillCircle(5, 0, 13);
                    g.fillStyle(0x0044dd, 0.75); g.fillCircle(4, 0, 10);
                    g.fillStyle(0x001188, 0.92); g.fillCircle(3, 0, 7);
                    g.fillStyle(0x000033, 1);    g.fillCircle(2, 0, 4);
                    g.fillStyle(0x88bbff, 0.95); g.fillCircle(9, 0, 3.2);
                    g.fillStyle(0xffffff, 0.90); g.fillCircle(10, 0, 1.8);

                    // Blue particle trail
                    const numP = 22;
                    for (let j = 0; j < numP; j++) {
                        const side = j % 2 === 0 ? 1 : -1;
                        const prog = (j >> 1) / (numP / 2);
                        const sweepAngle = prog * Math.PI * 0.9;
                        const orbitR = 10 + prog * 11;
                        const xOffset = Math.cos(sweepAngle) * 9 - prog * 22;
                        const yOffset = side * Math.sin(sweepAngle) * orbitR;
                        const jx = xOffset + (Math.random()-0.5)*2.5;
                        const jy = yOffset + (Math.random()-0.5)*1.5;
                        let pCol, pAlpha, pSize;
                        if (prog < 0.2)       { pCol = 0xaaccff; pAlpha = 0.90; pSize = 2.4; }
                        else if (prog < 0.45) { pCol = 0x4488ff; pAlpha = 0.65; pSize = 1.9; }
                        else if (prog < 0.7)  { pCol = 0x1144cc; pAlpha = 0.40; pSize = 1.5; }
                        else                  { pCol = 0x002288; pAlpha = 0.18; pSize = 1.0; }
                        g.fillStyle(pCol, pAlpha); g.fillCircle(jx, jy, pSize);
                    }
                    // Blue smoke tail
                    for (let j = 0; j < 12; j++) {
                        const t = j / 12;
                        const tx = -8 - t * 24 + (Math.random()-0.5)*4;
                        const ty = (Math.random()-0.5) * (3 + t * 9);
                        const tCol = t < 0.35 ? 0x3366ff : t < 0.7 ? 0x1133cc : 0x001166;
                        g.fillStyle(tCol, (1-t)*0.6); g.fillCircle(tx, ty, 1.1+(1-t)*1.6);
                    }
                } else {
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
                } // end normal fireball
            } // end drawing if

            const tileX = Math.floor(fireball.sprite.x / this.TILE_SIZE);
            const tileY = Math.floor(fireball.sprite.y / this.TILE_SIZE);

            // Wall hit or locked room barrier — destroy fireball
            if (tileX < 0 || tileX >= this.WORLD_WIDTH ||
                tileY < 0 || tileY >= this.WORLD_HEIGHT ||
                this.world[tileX][tileY] === this.WALL ||
                this.isInLockedRoom(tileX, tileY)) {
                // Only max-stack staff balls (leavesTrail) leave a lava pool on wall impact
                if (fireball.isStaffBall && fireball.leavesTrail) this.spawnFireballLavaPool(tileX, tileY);
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
                        if (fireball._isSupernova) {
                            // Apply ignition mark — explodes after 2s, cascades
                            this._applyIgnitionMark(enemy);
                        } else {
                            this.ignitionExplodeEnemy(enemy);
                            this.spawnFireballLavaPool(tileX, tileY);
                        }
                        if (fireball.piercedEnemies) fireball.piercedEnemies.add(enemy);
                    }
                }
                // Damage boss if fireball passes through its tile
                if (this.damageBossAtTile(tileX, tileY, fireball.damage, fireball.createdAt)) {
                    if (fireball.isStaffBall && typeof this.applyBurnStackBoss === 'function') this.applyBurnStackBoss();
                }
                // Also damage portals (Queen Slimes) in proximity
                if (this.portals) {
                    for (const portal of this.portals) {
                        if (!portal.active) continue;
                        const ppx = portal.tileX * this.TILE_SIZE + this.TILE_SIZE / 2;
                        const ppy = portal.tileY * this.TILE_SIZE + this.TILE_SIZE / 2;
                        if (Math.abs(ppx - fireball.sprite.x) < this.TILE_SIZE * 2 &&
                            Math.abs(ppy - fireball.sprite.y) < this.TILE_SIZE * 2) {
                            this.damagePortal(portal, fireball.damage);
                        }
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
                    // Staff balls apply burn to ALL non-iceImmune enemies including fire elementals
                    // (fire elementals are immune to direct damage but accumulate burn stacks)
                    if (fireball.isStaffBall && typeof this.applyBurnStack === 'function') {
                        if (!fireball._burnApplied?.has(enemy)) {
                            fireball._burnApplied?.add(enemy);
                            this.applyBurnStack(enemy);
                        }
                    }
                    if (!enemy.iceImmune) {
                        this.damageEnemy(enemy, fireball.damage);
                        this.fireballSplash(fireball.sprite.x, fireball.sprite.y, fireball.damage, enemy);
                    }
                    hitEnemy = true;
                    if (fireball.piercedEnemies) fireball.piercedEnemies.add(enemy);
                    break;
                }
            }
            // Also check boss — fireballs deal full damage on contact
            if (!hitEnemy && this.damageBossAtTile(tileX, tileY, fireball.damage)) {
                hitEnemy = true;
                // Staff balls apply burn stack to boss on hit
                if (fireball.isStaffBall && typeof this.applyBurnStackBoss === 'function') {
                    this.applyBurnStackBoss();
                }
            }

            // Max-stack staff balls leave a lava tile as they fly
            if (fireball.isStaffBall && fireball.leavesTrail) {
                this.spawnIgnitionTrail(
                    tileX * this.TILE_SIZE + this.TILE_SIZE / 2,
                    tileY * this.TILE_SIZE + this.TILE_SIZE / 2,
                    1400
                );
            }

            if (hitEnemy) {
                // Only max-stack staff balls (leavesTrail = 6 fireballs) create 3×3 lava on impact
                if (fireball.isStaffBall && fireball.leavesTrail) this.spawnFireballLavaPool(tileX, tileY);
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