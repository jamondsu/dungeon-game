// ═══════════════════════════════════════════════════════════════════════════
// HealerTotem.js — the Healer totem: made.
// GameScene borrows each method, so `this` in them is the scene.
// ═══════════════════════════════════════════════════════════════════════════

class HealerTotem {

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
                EnemyFX.cross(this, e.sprite.x + (Math.random() - 0.5) * 14, e.sprite.y - 6);
            }
        });
        e._particleTimer = particleTimer;
        return e;
    }

}
