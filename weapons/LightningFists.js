// ═══════════════════════════════════════════════════════════════════════════
// LightningFists.js — the Lightning Fists (lightning).
// GameScene borrows each method through a one-line proxy, so `this` in them is the scene.
// ═══════════════════════════════════════════════════════════════════════════

class LightningFists {

    lightningFistsAttack(targetX, targetY) {
        const currentTime = this.time.now;
        if (currentTime - (this.lastLightningFistsTime || 0) < 500 * WeaponLevels.cdMult('lightning_fists')) return;
        this.lastLightningFistsTime = currentTime;
        this._gearFiredAt = currentTime;   // the held weapon swings now (Creatures.gear)

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

        // the punch lands: a strike flaring off the knuckles, crackles thrown out the way it went, sparks
        WeaponSystem.zapFlare(this, hitPx - facingX * 4, hitPy - facingY * 4, 'y', 1.7);
        WeaponSystem.zapGlow(this, hitPx, hitPy, 0.32, 0xffd23a, 0.5, 160);
        for (const s of [-1, 1]) WeaponSystem.bolt(this, hitPx, hitPy, hitPx + (facingX * 14 - facingY * s * 9), hitPy + (facingY * 14 + facingX * s * 9), 'y', { life: 150, thin: true, br: 0, glow: false });
        WeaponSystem.zapSparks(this, 'y').emitParticleAt(hitPx, hitPy, 6);

        // WET BONUS. Standing in water makes an enemy take more from lightning -- but it
        // does NOT grant extra chain targets. Those are two different levers and the chain
        // cap is about to be rebalanced for lightning's crowd identity; if water also fed
        // that number, tuning one would silently move the other.
        //
        // This const used to be declared 20 lines BELOW here, inside the chain-lightning
        // block, while the direct-hit line already read it -- a temporal dead zone. It
        // never surfaced because `_wet ? WET_BONUS : 1` short-circuits: on dry ground the
        // identifier is never evaluated. So Lightning Fists threw
        // "Cannot access 'WET_BONUS' before initialization" on exactly one input --
        // punching an enemy that is standing in water -- which is the normal case for
        // every room of The Cistern and nowhere else in the game.
        const WET_BONUS = 1.5;

        // Direct hit — routes through damageEnemy for immunity/room-gating/ult-charge
        const dmg = 14 * this.damageScaling;
        let hitEnemy = null;
        for (const enemy of [...this.enemies]) {
            if (this._phasedOut?.(enemy)) continue;
            if (enemy.x !== tile.x || enemy.y !== tile.y) continue;
            // A wet target conducts: more damage, same number of chain targets.
            const _wet = (typeof this.isWaterAt === 'function' && this.isWaterAt(enemy.x, enemy.y));
            this.damageEnemy(enemy, dmg * (_wet ? WET_BONUS : 1));
            // lightning bypasses damageEnemy charge skip; only for a hit that landed (it paid for refusals)
            if (this._dmgLanded) this.gainUltCharge(this.ultChargePerLightningHit);
            hitEnemy = enemy;
            // CONDUCTION. Punching a target that is standing in water pushes the current
            // through the whole connected pool, hitting everything sharing it regardless of
            // distance. This is the lever that makes lightning the crowd element on a wet
            // floor -- the chain hops below are capped and short-range, conduction is not.
            if (_wet && typeof this._energizePool === 'function') {
                this._energizePool(enemy.x, enemy.y, dmg);
            }
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

        // LIGHTNING'S CROWD IDENTITY. A flat 2 hops meant a duel and a nine-enemy room
        // played identically, which is the opposite of what lightning is supposed to be.
        // Scaling the cap off how many enemies are actually in reach makes it deliberately
        // worse than the other three elements against a single target and better than all
        // of them once a room fills up.
        //   crowd 0-1 -> 1 hop      4-5 -> 3 hops
        //   crowd 2-3 -> 2 hops     8+  -> 5 hops
        const crowd = this.enemies.filter(e => !this._phasedOut?.(e) && e.sprite?.active && e !== hitEnemy &&
            Math.abs(e.x - tile.x) + Math.abs(e.y - tile.y) <= CHAIN_RANGE + 2).length;
        const MAX_CHAINS = Math.min(5, 1 + Math.floor(crowd / 2));
        const chainDmg = dmg * CHAIN_FALLOFF;

        // Collect candidates sorted by distance from hit tile
        const candidates = this.enemies
            .filter(e => !this._phasedOut?.(e) && e !== hitEnemy && e.sprite?.active)
            .map(e => ({
                enemy: e,
                dist: Math.abs(e.x - tile.x) + Math.abs(e.y - tile.y)
            }))
            .filter(c => c.dist <= CHAIN_RANGE)
            .sort((a, b) => a.dist - b.dist)
            .slice(0, MAX_CHAINS);

        for (const { enemy: chainEnemy } of candidates) {
            Sfx.play(this, 'zap');   // the chain: a bolt jumping on to it, flaring where it lands
            WeaponSystem.bolt(this, hitPx, hitPy, chainEnemy.sprite.x, chainEnemy.sprite.y + 4, 'y', { life: 200, br: 1 });
            WeaponSystem.zapFlare(this, chainEnemy.sprite.x, chainEnemy.sprite.y + 4, 'y', 1.2);
            WeaponSystem.zapSparks(this, 'y').emitParticleAt(chainEnemy.sprite.x, chainEnemy.sprite.y + 4, 3);
            const _cWet = (typeof this.isWaterAt === 'function' && this.isWaterAt(chainEnemy.x, chainEnemy.y));
            this.damageEnemy(chainEnemy, chainDmg * (_cWet ? WET_BONUS : 1));
            if (this._dmgLanded) this.gainUltCharge(this.ultChargePerLightningHit * 0.5); // chain hits give half charge
        }

        this.cameras.main.shake(30, 0.001);
    }

}
