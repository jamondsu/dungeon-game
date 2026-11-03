// ═══════════════════════════════════════════════════════════════════════════
// Rooter.js — the Rooter: made, its root tendril, and its ground thump.
// GameScene borrows each method, so `this` in them is the scene.
// ═══════════════════════════════════════════════════════════════════════════

class Rooter {

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
        e._thumpAllyDmg = 8;    // a thump on an ally it's drawn to: a hit, as an ally can't be rooted
        // Legacy alias for old code that still references _rooterCooldown/_rooterRange
        e._rooterCooldown = e._tendrilCooldown;
        e._rooterLastFire = 0;
        e._rooterRange    = e._tendrilRange;
        SlimeModels.wear(this, e.sprite, 'rooter');   // its own body: a gnarled root
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
        EnemyManager.playAtk(this, enemy.sprite, 400, dx < 0, 'cast_');   // it digs in and sends it

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
        EnemyManager.playAtk(this, enemy.sprite, 450, false, 'thump_');   // it rears and stamps

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

        // Root player if within range (you, whoever it stamped at: an ally can't be held)
        CombatSystem.tauntAs(this, null, () => {
        const pdx = Math.abs(this.playerX - enemy.x), pdy = Math.abs(this.playerY - enemy.y);
        if (pdx + pdy <= THUMP_R) {
            this._bfxRootNext = 'vine';   // Bosses.js: thorned roots, not void tendrils
            if (typeof this._rootPlayer === 'function') this._rootPlayer(ROOT_DUR, this.time.now);
            this.showStatusText(this.player.x, this.player.y - 28, 'ROOTED!', '#44ff88');
        }
        });

        // An ally it stamped at can't be rooted (nothing holds one): the stomp hits it instead
        const tA = this._tauntAlly;
        if (tA?.alive && Math.abs(tA.x - enemy.x) + Math.abs(tA.y - enemy.y) <= THUMP_R) {
            this._hitBy = enemy; this.takeDamage((enemy._thumpAllyDmg || 8) * (this.enemyDamageScale || 1)); this._hitBy = null;
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

}
