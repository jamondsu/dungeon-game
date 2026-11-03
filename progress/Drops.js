// ═══════════════════════════════════════════════════════════════════════════
// Drops.js — what a dead enemy leaves on the floor (glorps, health pots, ult pots) and picking them up.
// GameScene borrows each method, so `this` in them is the scene.
// ═══════════════════════════════════════════════════════════════════════════

class Drops {

    // ─── GROUND DROPS ────────────────────────────────────────────────────────

    tryDropFromEnemy(enemy) {
        if (enemy._spawned) return;
        const ex = enemy.sprite.x, ey = enemy.sprite.y;
        // 12% glorp drop
        if (Math.random() < 0.12) {
            this.spawnGroundGlorp(ex, ey, 5);
        }
        // 8% health pot drop
        if (Math.random() < 0.08) {
            this.spawnHealthPot(ex, ey);
        }
    }

    spawnGroundGlorp(wx, wy, value) {
        const tx = Math.floor(wx / this.TILE_SIZE);
        const ty = Math.floor(wy / this.TILE_SIZE);
        const cx = tx * this.TILE_SIZE + this.TILE_SIZE / 2;
        const cy = ty * this.TILE_SIZE + this.TILE_SIZE / 2;
        const container = this._buildGlorpContainer(cx, cy, value);
        this.groundDrops.push({ type: 'glorp', container, tileX: tx, tileY: ty, value, worldX: cx, worldY: cy });
    }

    spawnHealthPot(wx, wy) {
        const tx = Math.floor(wx / this.TILE_SIZE);
        const ty = Math.floor(wy / this.TILE_SIZE);
        const cx = tx * this.TILE_SIZE + this.TILE_SIZE / 2;
        const cy = ty * this.TILE_SIZE + this.TILE_SIZE / 2;

        // what you see is CreatureFX's potion (cfx_bits), its glow and shadow; the container carries the bob and the pickup
        const container = this.add.container(cx, cy - 10).setDepth(2);
        this.tweens.add({ targets: container, y: cy - 16, duration: 800, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });

        this.groundDrops.push({ type: 'healthpot', container, tileX: tx, tileY: ty, heal: 25, worldX: cx, worldY: cy });
    }

    spawnUltPot(wx, wy) {
        const tx = Math.floor(wx / this.TILE_SIZE);
        const ty = Math.floor(wy / this.TILE_SIZE);
        const cx = tx * this.TILE_SIZE + this.TILE_SIZE / 2;
        const cy = ty * this.TILE_SIZE + this.TILE_SIZE / 2;

        // what you see is CreatureFX's potion (cfx_bits), its glow and shadow; the container carries the bob and the pickup
        const container = this.add.container(cx, cy - 10).setDepth(2);
        this.tweens.add({ targets: container, y: cy - 16, duration: 800, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });

        this.groundDrops.push({ type: 'ultpot', container, tileX: tx, tileY: ty, ultAmount: 15, worldX: cx, worldY: cy });
    }

    updateGroundDrops() {
        if (!this.groundDrops) return;
        const MAGNET_TILES = 3; // start flying toward player within this many tiles
        const px = this.playerX, py = this.playerY;

        for (let i = this.groundDrops.length - 1; i >= 0; i--) {
            const drop = this.groundDrops[i];
            if (drop._collecting) continue;

            const dist = Math.abs(px - drop.tileX) + Math.abs(py - drop.tileY);

            // Within magnet range — start flying toward player
            if (dist <= MAGNET_TILES && !drop._magnetised) {
                drop._magnetised = true;
                // Accelerate container toward player each frame
                this.tweens.add({
                    targets: drop.container,
                    x: this.player.x, y: this.player.y,
                    scaleX: 0.5, scaleY: 0.5,
                    duration: 120 + dist * 40,
                    ease: 'Cubic.easeIn',
                    onComplete: () => {
                        if (drop._collecting) return;
                        drop._collecting = true;
                        drop.container.destroy();
                        const idx = this.groundDrops.indexOf(drop);
                        if (idx !== -1) this.groundDrops.splice(idx, 1);
                        if (drop.type === 'glorp') this._collectGroundGlorp(drop);
                        else if (drop.type === 'healthpot') this._collectHealthPot(drop);
                        else if (drop.type === 'ultpot') this._collectUltPot(drop);
                    }
                });
            }

            // Also collect on direct step (instant)
            if (px === drop.tileX && py === drop.tileY && !drop._magnetised) {
                drop._collecting = true;
                this.groundDrops.splice(i, 1);
                this.tweens.add({
                    targets: drop.container,
                    x: this.player.x, y: this.player.y,
                    scaleX: 0.3, scaleY: 0.3, alpha: 0.5,
                    duration: 120, ease: 'Cubic.easeIn',
                    onComplete: () => {
                        drop.container.destroy();
                        if (drop.type === 'glorp') this._collectGroundGlorp(drop);
                        else if (drop.type === 'healthpot') this._collectHealthPot(drop);
                        else if (drop.type === 'ultpot') this._collectUltPot(drop);
                    }
                });
            }
        }
    }

    _collectGroundGlorp(drop) {
        if (!this.totalGlorps) this.totalGlorps = 0;
        this.totalGlorps += drop.value;
        localStorage.setItem('glorps', this.totalGlorps);
        Sfx.play(this, 'pickup');
        if (this.glorpText) this.glorpText.setText(`✦ ${this.totalGlorps} Glorps`);

        const px = this._scrX(this.player.x);
        const py = this._scrY(this.player.y);

        // Burst particles
        for (let p = 0; p < 8; p++) {
            const angle = (p / 8) * Math.PI * 2;
            const spark = this.add.rectangle(px, py, 4, 4, 0x00ffaa, 1).setDepth(10).setScrollFactor(0);
            this.tweens.add({ targets: spark, x: spark.x + Math.cos(angle) * 22, y: spark.y + Math.sin(angle) * 22, alpha: 0, scaleX: 0.2, scaleY: 0.2, duration: 280, ease: 'Quad.easeOut', onComplete: () => spark.destroy() });
        }

        const ft = this.add.text(px, py - 20, `+${drop.value} Glorps`, {
            fontSize: '14px', fontFamily: 'monospace', fontStyle: 'bold',
            color: '#00ffaa', stroke: '#000', strokeThickness: 3
        }).setOrigin(0.5).setDepth(50).setScrollFactor(0);
        this.tweens.add({ targets: ft, y: py - 48, alpha: 0, duration: 700, ease: 'Quad.easeOut', onComplete: () => ft.destroy() });
    }

    _collectHealthPot(drop) {
        const amt = drop.heal * PlayerStats.healMult(this);   // Hearty (Stats.js)
        const heal = Math.min(amt, this.maxHealth - this.health);
        if (heal <= 0) return;
        Sfx.play(this, 'heal');
        this.health = Math.min(this.maxHealth, this.health + amt);
        this.updateHUD();

        // Green heal flash on health bar
        this.tweens.add({ targets: this.healthBarFill, fillColor: 0x44ff88,
            duration: 120, yoyo: true, repeat: 2,
            onComplete: () => { if (this.healthBarFill) this.healthBarFill.setFillStyle(0xff5566); }
        });

        // Floating +HP text
        const fx = this._scrX(this.player.x);
        const fy = this._scrY(this.player.y) - 20;
        const ft = this.add.text(fx, fy, `+${Math.round(drop.heal)} HP`, {
            fontSize: '16px', fontFamily: 'monospace', fontStyle: 'bold',
            color: '#44ff88', stroke: '#000', strokeThickness: 3
        }).setOrigin(0.5).setDepth(50).setScrollFactor(0);
        this.tweens.add({ targets: ft, y: fy - 30, alpha: 0, duration: 800, ease: 'Quad.easeOut', onComplete: () => ft.destroy() });

        // Screen-edge green vignette flash
        const W = this.scale.width, H = this.scale.height;
        const flash = this.add.rectangle(W/2, H/2, W, H, 0x00ff44, 0.18)
            .setScrollFactor(0).setDepth(200);
        this.tweens.add({ targets: flash, alpha: 0, duration: 400, onComplete: () => flash.destroy() });
    }

    _collectUltPot(drop) {
        this.gainUltCharge(drop.ultAmount || 15, this.currentElement, true);

        // Pulse the ult bar label
        if (this.ultBarLabel) {
            this.tweens.add({ targets: this.ultBarLabel, scaleX: 1.4, scaleY: 1.4, duration: 120, yoyo: true, ease: 'Quad.easeOut' });
        }

        const fx = this._scrX(this.player.x);
        const fy = this._scrY(this.player.y) - 20;
        const ft = this.add.text(fx, fy, `+${drop.ultAmount || 15}% ULT`, {
            fontSize: '14px', fontFamily: 'monospace', fontStyle: 'bold',
            color: '#ffee44', stroke: '#000', strokeThickness: 3
        }).setOrigin(0.5).setDepth(50).setScrollFactor(0);
        this.tweens.add({ targets: ft, y: fy - 30, alpha: 0, duration: 800, ease: 'Quad.easeOut', onComplete: () => ft.destroy() });

        const W2 = this.scale.width, H2 = this.scale.height;
        const flash2 = this.add.rectangle(W2/2, H2/2, W2, H2, 0xffcc00, 0.12)
            .setScrollFactor(0).setDepth(200);
        this.tweens.add({ targets: flash2, alpha: 0, duration: 350, onComplete: () => flash2.destroy() });
    }

}
