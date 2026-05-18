// ═══════════════════════════════════════════════════════════
// FUTURE_USE.js - Methods saved for later implementation
// These can be pasted back into GameScene when needed
// ═══════════════════════════════════════════════════════════


// --- askPlayerName ---
    askPlayerName() {
        // Go straight to name input - no intermediate dialogue to avoid click conflicts
        this.showNameInput();
    }


// --- progressToNextFloor ---
    progressToNextFloor() {
        this.damageLevel++;
        this.damageScaling = 1.0 + (this.damageLevel - 1) * 0.2;
    }


// --- spawnFireball ---
    spawnFireball(x, y, dirX, dirY, damage, splitCount) {
        const container = this.add.container(x, y);
        const fireGraphics = this.add.graphics().setDepth(1.5);
        container.add(fireGraphics);
        container.setDepth(2);
        this.fireballs.push({
            sprite: container,
            fireGraphics,
            vx: dirX * this.fireballSpeed,
            vy: dirY * this.fireballSpeed,
            damage, dirX, dirY,
            startX: x, startY: y,
            splitCount: splitCount || 0,
            piercedEnemies: new Set(),
            createdAt: this.time.now,
            lastFlameTime: this.time.now
        });
    }