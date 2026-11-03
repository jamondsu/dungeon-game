// ═══════════════════════════════════════════════════════════════════════════
// CosmicFists.js — the first Cosmic Fists (cosmic). Cosmic.js casts all five cosmic weapons now; this stays for a
// scene without it.
// GameScene borrows each method through a one-line proxy, so `this` in them is the scene.
// ═══════════════════════════════════════════════════════════════════════════

class CosmicFists {

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
            if (this._phasedOut?.(enemy)) continue;
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

}
