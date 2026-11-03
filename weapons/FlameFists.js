// ═══════════════════════════════════════════════════════════════════════════
// FlameFists.js — the Flame Fists (fire): a red-hot punch one tile in front of you, a lava tile where it lands.
// GameScene borrows each method through a one-line proxy, so `this` in them is the scene.
// ═══════════════════════════════════════════════════════════════════════════

class FlameFists {

    flameFistsAttack(targetX, targetY) {
        const currentTime = this.time.now;
        if (currentTime - (this.lastFlameFistsTime || 0) < 600 * WeaponLevels.cdMult('flame_fists')) return;
        this.lastFlameFistsTime = currentTime;
        this._gearFiredAt = currentTime;   // the held weapon swings now (Creatures.gear)

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

            // the fist's flare on the tile, thrown the way you punched
            WeaponSystem.firePunch(this, px, py, facingX, facingY);

            // Leave a single lava tile (spawn ignition trail directly, no 3x3 spread)
            this.spawnIgnitionTrail(px, py);
            this._evaporate(tile.x, tile.y, 6);          // one-shots a puddle

            // Hit portal if on this tile
            const portal = this.getPortalAt(tile.x, tile.y);
            if (portal) this.damagePortal(portal, damage);
            if (this.damageBossAtTile(tile.x, tile.y, damage)) {
                if (typeof this.applyBurnStackBoss === 'function') this.applyBurnStackBoss();
            }

            // Damage enemies on that tile
            for (const enemy of [...this.enemies]) {
                if (this._phasedOut?.(enemy)) continue;
                if (enemy.x !== tile.x || enemy.y !== tile.y) continue;
                // Route through damageEnemy rather than writing enemy.health directly.
                // The inline version re-implemented immunity as three hard bail-outs, so
                // ElementResist never ran for this weapon -- and it silently excluded
                // fire from every cross-element bonus damageEnemy applies: the 2.5x
                // shatter on a frozen target, purple marks, tsunami, absorber toughness.
                // damageEnemy also owns the damage number, the IMMUNE label, the health
                // bar, the ult charge and the kill, so all of that comes back for free.
                this.damageEnemy(enemy, damage, 'fire');
                // Burn is fire's escape hatch and is applied even when the direct hit was
                // refused -- burn and lava are the only way to hurt a fire elemental.
                // applyBurnStack bails on iceImmune itself, so ice elementals stay clean.
                if (typeof this.applyBurnStack === 'function') this.applyBurnStack(enemy);
            }
        }

        this.cameras.main.shake(50, 0.002);
    }

}
