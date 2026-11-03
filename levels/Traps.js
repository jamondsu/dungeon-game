// ═══════════════════════════════════════════════════════════════════════════
// Traps.js — the floor's traps: poison (its ring, and the poison it leaves on you) and spikes.
// GameScene borrows each method, so `this` in them is the scene.
// ═══════════════════════════════════════════════════════════════════════════

class Traps {

    spawnPoisonTrap(tx, ty) {
        // 2×2 poison cloud — purple-green tiles
        const tiles = [
            { x: tx, y: ty }, { x: tx+1, y: ty },
            { x: tx, y: ty+1 }, { x: tx+1, y: ty+1 },
        ];
        const gfxObjs = [];
        for (const t of tiles) {
            const px = t.x * this.TILE_SIZE, py = t.y * this.TILE_SIZE;
            const base = this.add.rectangle(px + this.TILE_SIZE/2, py + this.TILE_SIZE/2,
                this.TILE_SIZE, this.TILE_SIZE, 0x332244, 0.7).setDepth(0.6);
            const bubble = this.add.circle(px + this.TILE_SIZE/2, py + this.TILE_SIZE/2,
                6, 0x88ff44, 0.55).setDepth(0.7);
            this.tweens.add({ targets: bubble, y: bubble.y - 6, alpha: 0.2,
                duration: 600 + Math.random() * 400, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
            gfxObjs.push(base, bubble);
        }
        this.floorTraps.push({ type: 'poison', tiles, gfxObjs,
            damage: 3, interval: 800, lastTick: 0,
            poisonDuration: 5000 });
    }

    spawnSpikeTrap(tx, ty) {
        const px = tx * this.TILE_SIZE, py = ty * this.TILE_SIZE;
        const base = this.add.rectangle(px + this.TILE_SIZE/2, py + this.TILE_SIZE/2,
            this.TILE_SIZE, this.TILE_SIZE, 0x222222, 0.8).setDepth(0.6);
        // Draw little spike triangles
        const spikes = this.add.graphics().setDepth(0.7);
        spikes.fillStyle(0xaaaaaa, 0.9);
        for (let i = 0; i < 3; i++) {
            const sx = px + 4 + i * 7;
            spikes.fillTriangle(sx, py + this.TILE_SIZE - 2, sx + 4, py + 3, sx + 8, py + this.TILE_SIZE - 2);
        }
        // Spike pulse
        this.tweens.add({ targets: spikes, alpha: 0.5, duration: 900, yoyo: true, repeat: -1 });
        this.floorTraps.push({ type: 'spike', tiles: [{ x: tx, y: ty }],
            gfxObjs: [base, spikes], damage: 12, lastTick: 0, interval: 600 });
    }

    // A ring of poison tiles R round (cx, cy), the Rooter's thump's and a Budding Slime's bud's: a trap
    // that doses you (_poisonPlayer) while you stand in it, gone after ms (0: it stays; r 0: the one tile).
    _poisonRing(cx, cy, r, ms = 12000) {
        const poisonRadius = r, TS = this.TILE_SIZE;
        const poisonTiles = [];
        for (let dx = -poisonRadius; dx <= poisonRadius; dx++) {
            for (let dy = -poisonRadius; dy <= poisonRadius; dy++) {
                const d = Math.sqrt(dx*dx + dy*dy);
                if (d < poisonRadius - 0.7 || d > poisonRadius + 0.7) continue;
                const tx = cx + dx, ty = cy + dy;
                if (tx < 0 || tx >= this.WORLD_WIDTH || ty < 0 || ty >= this.WORLD_HEIGHT) continue;
                if (this.world[tx]?.[ty] !== this.FLOOR) continue;
                poisonTiles.push({ x: tx, y: ty });
            }
        }

        if (poisonTiles.length === 0) return;

        // Draw poison tile overlays — green-black murky pools
        const gfxObjs = [];
        for (const t of poisonTiles) {
            const px2 = t.x * TS, py2 = t.y * TS;
            // A pool of murky sludge from Visuals.js where it's loaded (TD keeps the drawn tile)
            const base = this._vfxSludgeTile ? this._vfxSludgeTile(px2 + TS/2, py2 + TS/2)
                : this.add.rectangle(px2 + TS/2, py2 + TS/2, TS, TS, 0x113322, 0.75).setDepth(0.65);
            const glow = this.add.graphics().setDepth(0.70);
            if (!this._vfxSludgeTile) {
                glow.fillStyle(0x44ff88, 0.22); glow.fillRect(px2 + 2, py2 + 2, TS - 4, TS - 4);
                glow.lineStyle(1, 0x44ff88, 0.50); glow.strokeRect(px2 + 1, py2 + 1, TS - 2, TS - 2);
            }
            // a bubble rising and popping (cfx_bits)
            const bubble = this.add.image(Math.round(px2 + TS/2 + (Math.random()-0.5)*6), Math.round(py2 + TS/2 + (Math.random()-0.5)*6), 'cfx_bits', 'bubble')
                .setAlpha(this._vfxSludgeTile ? 0.6 : 0.8).setDepth(0.72);
            this.tweens.add({ targets: bubble, y: bubble.y - 4, alpha: 0.20, duration: 500 + Math.random()*300, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
            gfxObjs.push(base, glow, bubble);
        }

        // Register as a floor trap — refreshing DoT (staying on tile resets duration)
        if (!this.floorTraps) this.floorTraps = [];
        const trap = {
            type: 'poison', tiles: poisonTiles, gfxObjs,
            damage: 4, interval: 600, lastTick: 0,
            poisonDuration: 4000,
            _createdAt: this.time.now,
        };
        this.floorTraps.push(trap);

        // Auto-remove trap after ms
        if (ms) this.time.delayedCall(ms, () => {
            const idx = this.floorTraps.indexOf(trap);
            if (idx !== -1) this.floorTraps.splice(idx, 1);
            for (const g2 of gfxObjs) { if (g2?.active) { this.tweens.killTweensOf(g2); g2.destroy(); } }
        });
    }

    // POISONED, from anything (a Rooter's ring, a trap, a Budding Slime's glob): DMG every EVERY ms
    // for MS. One poison at a time: a fresh dose replaces the one running, it never stacks.
    // POISON: its ticks, and healing cut by POISON_CUT while it lasts (each frame claws back that share of whatever health
    // came back since the last, rather than touching every heal)
    _poisonPlayer(dmg, every, ms) {
        if (this._tauntAlly) return;   // (an ally standing in for you isn't poisoned: CombatSystem.tauntTo)
        if (!(this._poisonUntil > this.time.now)) {
            this.showStatusText(this.player.x, this.player.y - 30, 'POISONED', '#9ae04a');
            Sfx.play(this, 'status', { kind: 'poison' });
            this._poisonTickAt = this.time.now;
            this._poisonHp = this.health;
        }
        this._poisonUntil = this.time.now + ms; this._poisonDmg = dmg; this._poisonEvery = every;
    }
    _updatePoison(time) {
        if (!this._poisonUntil) return;
        const p = this.player;
        if (time >= this._poisonUntil || !p?.active || this._deathScreenActive) { this._poisonUntil = 0; this.playerPoisoned = false; return; }
        this.playerPoisoned = true;   // its bubbles (Creatures.js)
        const CUT = 0.6;   // POISON_CUT
        if (this._poisonHp != null && this.health > this._poisonHp) this.health = this._poisonHp + (this.health - this._poisonHp) * (1 - CUT);
        if (time - this._poisonTickAt >= this._poisonEvery) { this._poisonTickAt = time; this.takeDamage(this._poisonDmg, 'poison'); }
        this._poisonHp = this.health;
    }

    updateFloorTraps(time) {
        if (!this.floorTraps) return;
        for (const trap of this.floorTraps) {
            for (const t of trap.tiles) {
                if (this.playerX !== t.x || this.playerY !== t.y) continue;
                if (time - trap.lastTick < trap.interval) continue;
                trap.lastTick = time;

                if (trap.type === 'poison') {
                    this._poisonPlayer(trap.damage, trap.interval, trap.poisonDuration);   // stepping on it (again) doses you afresh
                } else if (trap.type === 'spike') {
                    this.takeDamage(trap.damage, 'spike trap');
                    this.cameras.main.shake(60, 0.005);
                    this.showStatusText(
                        this.player.x,
                        this.player.y - 20,      // showStatusText is world space; it used to get screen coords
                        'SPIKE!', '#cccccc');
                }
            }
        }
    }

}
