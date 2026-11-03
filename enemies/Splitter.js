// ═══════════════════════════════════════════════════════════════════════════
// Splitter.js — the Splitter: made, and what it splits into when it dies.
// GameScene borrows each method, so `this` in them is the scene.
// ═══════════════════════════════════════════════════════════════════════════

class Splitter {

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
        SlimeModels.wear(this, e.sprite, 'splitter');   // its own body (its tiers are its sizes)
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


    _triggerSplitterDeath(enemy) {
        const tier = enemy._splitterTier ?? 0;
        if (tier >= 2) return; // small splitters don't split further
        Sfx.play(this, 'split');

        const ex = enemy.x, ey = enemy.y;
        const TS = this.TILE_SIZE;
        const spawnCount = 2;
        const DMG = 12 * (this.enemyDamageScale || 1);   // (was the player's damageScaling: it hit harder as your weapons grew)
        const SPLASH_R = 2 * TS;

        // it tears in two (its own death frames): a burst of its light as wide as the splash, and its goo
        const spx = ex * TS + TS/2, spy = ey * TS + TS/2;
        BossFX.blast(this, spx, spy, SPLASH_R, 'bolt');
        this._vfxBursts?.goo && (this._vfxBursts.goo.setParticleTint?.(0xf0822a), this._vfxBursts.goo.explode(10, spx, spy));
        this.cameras.main.shake(40 + tier * 20, 0.004);

        // Damage player in splash
        const ppx = this.player.x, ppy = this.player.y;
        if (Math.sqrt((ppx-spx)**2 + (ppy-spy)**2) <= SPLASH_R) {
            this.takeDamage(DMG, enemy);
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

}
