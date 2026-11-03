// ═══════════════════════════════════════════════════════════════════════════
// Anchor.js — the Anchor slime: made, and the end of its buff.
// GameScene borrows each method, so `this` in them is the scene.
// ═══════════════════════════════════════════════════════════════════════════

class Anchor {

    _anchorBuffEnd(enemy) {
        enemy._anchorBuffUntil = 0; enemy._anchorSpeedMult = 1;
        if (enemy.sprite?.active && !enemy.isFrozen && typeof enemy.sprite.clearTint === 'function') enemy.sprite.clearTint();
        if (enemy._speedIndTimer) { enemy._speedIndTimer.remove(); enemy._speedIndTimer = null; }
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

}
