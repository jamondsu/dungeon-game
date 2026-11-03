// ═══════════════════════════════════════════════════════════════════════════
// IceFists.js — the Ice Fists (ice).
// GameScene borrows each method through a one-line proxy, so `this` in them is the scene.
// ═══════════════════════════════════════════════════════════════════════════

class IceFists {

    iceFistsAttack(targetX, targetY) {
        const currentTime = this.time.now;
        if (currentTime - (this.lastIceFistsTime || 0) < 500 * WeaponLevels.cdMult('ice_fists')) return;
        this.lastIceFistsTime = currentTime;
        this._gearFiredAt = currentTime;   // the held weapon swings now (Creatures.gear)

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

        // the fist's frost on the tile, sprayed the way you punched
        WeaponSystem.iceSlam(this, px, py, facingX, facingY);

        for (const enemy of [...this.enemies]) {
            if (this._phasedOut?.(enemy)) continue;
            if (enemy.x !== tile.x || enemy.y !== tile.y) continue;
            this.applyIceFistsHit(enemy);
        }

        // Hit portal if on this tile
        const portalHit = this.getPortalAt(tile.x, tile.y);
        if (portalHit) this.damagePortal(portalHit, 5 * this.damageScaling);
        this.damageBossAtTile(tile.x, tile.y, 12 * this.damageScaling);

        this.cameras.main.shake(30, 0.001);
    }

    applyIceFistsHit(enemy) {
        // Ice fists only — do not call from other weapons
        if (enemy._sniperInvisible || this._phasedOut(enemy)) return; // invisible snipers immune to chill/freeze
        if (enemy.fireImmune) {
            if (enemy.sprite?.active) this.showStatusText(enemy.sprite.x, enemy.sprite.y - 10, 'IMMUNE', '#ff8844');
            return;
        }
        const time = this.time.now;
        // Check frozen BEFORE iceImmune — frozen ice elementals can be shattered
        if (enemy.isFrozen) { this._clearFreezeVisuals(enemy); this._triggerShatterBurst(enemy); return; }
        Sfx.play(this, 'hit', { el: 'ice' });   // (these hits skip damageEnemy, where the others make theirs)

        // Ice elementals (iceImmune) take NO chip damage — only chill stacks toward freeze/shatter
        if (!enemy.iceImmune) {
            const chipDmg = 14 * this.damageScaling;   // 12 left the free ice weapon the weakest in the game (36 dps)
            const _rd1461 = this.resolveElementalHit(enemy, chipDmg, 'ice');
            if (_rd1461 === null) return;
            enemy.health -= _rd1461;
            this.showDamageNumber(enemy.sprite.x, enemy.sprite.y - 10, _rd1461, '#88eeff');
            this.updateEnemyHealthBar(enemy);
            this.gainUltCharge(this.ultChargePerHit);
            if (enemy.health <= 0) { this._destroyChillIndicator(enemy); this.killEnemy(enemy); return; }
        }

        // This used to call _updateChillIndicator and then test `>= 3` -- with NOTHING in between
        // incrementing the bar. Ice Fists could not cube anything on its own; the branch below was
        // dead code for as long as it existed.
        this.applyChill(enemy, this._chillCfg().MELEE);
    }

}
