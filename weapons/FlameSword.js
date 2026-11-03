// ═══════════════════════════════════════════════════════════════════════════
// FlameSword.js — the Flame Sword (fire).
// GameScene borrows each method through a one-line proxy, so `this` in them is the scene.
// ═══════════════════════════════════════════════════════════════════════════

class FlameSword {

    flameSwordAttack(targetX, targetY) {
        const currentTime = this.time.now;
        if (currentTime - (this.lastFlameSwordTime || 0) < 750) return;
        this.lastFlameSwordTime = currentTime;
        this._gearFiredAt = currentTime;   // the held weapon swings now (Creatures.gear)

        const worldX = targetX + this.cameras.main.scrollX;
        const worldY = targetY + this.cameras.main.scrollY;
        const playerPx = this._shotX();   // where the slime is drawn (mid-dash it's still on its way)
        const playerPy = this._shotY();

        const dx = worldX - playerPx, dy = worldY - playerPy;
        const facingAngle = Math.atan2(dy, dx);
        const halfSpread = Math.PI * (55 / 180); // ±55° = 110° total arc

        // ── Sample the arc at 5 angles, collecting the tile nearest each ray ──
        // Angles: left-edge, left-mid, centre, right-mid, right-edge
        const sampleAngles = [
            facingAngle - halfSpread,
            facingAngle - halfSpread * 0.5,
            facingAngle,
            facingAngle + halfSpread * 0.5,
            facingAngle + halfSpread,
        ];

        // For each sample angle cast at range 1.5 tiles (hits the ring of tiles
        // 1–2 away) and round to nearest tile. Dedupe by tile key.
        // Gather EVERY candidate first, then choose which 5 to keep. The previous
        // version broke out the moment it had 5 tiles while iterating angle-outer, so
        // it filled up from the FIRST sample angle and never reached the last two: the
        // right half of the 110-degree swing was drawn but hit nothing, at every facing.
        // Collecting first and ranking by angular distance from where you aimed keeps
        // the arc symmetric and puts the tiles you actually hit nearest the centre.
        // Build the tile set in MIRRORED UNITS, working outward from where you aimed.
        // A unit is one ring-step of one angle pair (-x and +x together) or the centre
        // ray alone, so a unit is symmetric by construction. Units are committed whole
        // or not at all, which is what actually guarantees the swing is even: ranking
        // individual tiles and slicing to a budget still cuts a pair in half whenever
        // the budget lands mid-pair, leaving one wing longer than the other.
        // 3, was 6. Fire is the single-target element: a 6-tile sweep at 12 made the T2 sword
        // hit one target softer than the free Flame Fists (37 vs 46 DPS, measured) while
        // out-damaging every T2 on a crowd. Three tiles at 20 puts it back on fire's side:
        // 47 to one target, 95 to a pack of five.
        const ARC = WeaponLevels.perk('flame_sword', 'arc'), MAX_TILES = 4 + 2 * ARC;   // the 3-tile arc in front + the tile beyond its middle (ring order, below); Wide Arc: a pair more a level, from a ring further out
        const tileAt = (angle, r) => {
            const wx = playerPx + Math.cos(angle) * r * this.TILE_SIZE;
            const wy = playerPy + Math.sin(angle) * r * this.TILE_SIZE;
            const tx = Math.round((wx - this.TILE_SIZE / 2) / this.TILE_SIZE);
            const ty = Math.round((wy - this.TILE_SIZE / 2) / this.TILE_SIZE);
            if (tx === this.playerX && ty === this.playerY) return null;
            return { x: tx, y: ty };
        };
        const chosen = new Map();
        // Centre first, then each symmetric pair of offsets, inner ring before outer.
        // The ring next to you first, every angle, then the next ring out. Angle-first took the
        // centre tile at both radii, so no flanking pair fit under MAX_TILES after it: the arc
        // came out 2 tiles straight ahead, or 3 with one side only.
        for (const r of ARC ? [1.0, 1.85, 2.7] : [1.0, 1.85]) {
            for (const spread of [0, halfSpread * 0.5, halfSpread]) {
                const unit = (spread === 0)
                    ? [tileAt(facingAngle, r)]
                    : [tileAt(facingAngle - spread, r), tileAt(facingAngle + spread, r)];
                const fresh = unit.filter(t => t && !chosen.has(`${t.x},${t.y}`));
                // Whole unit or nothing -- a partial commit is the asymmetry itself.
                if (chosen.size + fresh.length > MAX_TILES) continue;
                for (const t of fresh) chosen.set(`${t.x},${t.y}`, t);
            }
        }
        const swipeTiles = [...chosen.values()];

        const damage = 20 * this.damageScaling;   // was 12, see MAX_TILES

        // ── The swing: fire shed all along the arc the blade sweeps (fireSweep), thick across its span and hottest at
        // the edge, embers flung off the tip ──
        const T = this.TILE_SIZE, rOut = (ARC ? 2.9 : 2.3) * T, rIn0 = 0.62 * T;
        const SWING_DURATION = 170;
        const startAngle = facingAngle + halfSpread, endAngle = facingAngle - halfSpread, sweep = endAngle - startAngle;
        let swept = startAngle;
        this.tweens.addCounter({ from: 0, to: 1, duration: SWING_DURATION, ease: 'Cubic.easeOut',
            onUpdate: tw => { const a = startAngle + sweep * tw.getValue(); WeaponSystem.fireSweep(this, playerPx, playerPy, swept, a, rIn0, rOut); swept = a; } });

        // ── Hit tiles ─────────────────────────────────────────────────────
        const hitEnemies = new Set(), swing = {};   // (swing: the boss takes one hit a swing, however many of its tiles the arc covers)
        let bossHit = false;
        for (const tile of swipeTiles) {
            const { x: tx, y: ty } = tile;
            if (tx < 0 || tx >= this.WORLD_WIDTH || ty < 0 || ty >= this.WORLD_HEIGHT) continue;
            if (this.world[tx][ty] !== this.FLOOR) continue;
            if (!this.isInCurrentRoom(tx, ty)) continue;

            const tpx = tx * this.TILE_SIZE + this.TILE_SIZE / 2;
            const tpy = ty * this.TILE_SIZE + this.TILE_SIZE / 2;
            this.time.delayedCall(SWING_DURATION * 0.5, () => this.spawnIgnitionTrail(tpx, tpy));
            this._evaporate(tx, ty, 6);                  // a swing dries what it hits

            // Hit portal if on this tile
            const p = this.getPortalAt(tx, ty);
            if (p) this.damagePortal(p, damage);
            if (this.damageBossAtTile(tx, ty, damage, swing)) {
                bossHit = true;
                if (typeof this.applyBurnStackBoss === 'function') this.applyBurnStackBoss();
            }

            for (const enemy of [...this.enemies]) {
                if (this._phasedOut?.(enemy)) continue;
                if (enemy.x !== tx || enemy.y !== ty || hitEnemies.has(enemy)) continue;
                hitEnemies.add(enemy);
                // Same routing fix as Flame Fists: the inline version bypassed
                // ElementResist and every cross-element bonus. It also had two bugs of
                // its own that this collapses away -- applyBurnStack was only reached on
                // the fireImmune branch, so a NORMAL enemy never took a burn stack from
                // this weapon at all (which also meant the sword could not feed the
                // Magma Staff's stack ramp), and the successful-hit path never called
                // gainUltCharge, so the sword built ult slower than the free fists.
                this.damageEnemy(enemy, damage, 'fire');
                if (typeof this.applyBurnStack === 'function') this.applyBurnStack(enemy);
            }
        }

        // ── Three embers flung on ahead: a weak reach for what the blade can't touch ──
        // They start past the swing and skip what it hit, so up close they add nothing.
        const B = { N: 3, SPREAD: 0.26, SPEED: 300, RANGE: 7, DMG: 6 };
        for (let i = 0; i < B.N; i++) {
            const a = facingAngle + (i - (B.N - 1) / 2) * B.SPREAD, sx = playerPx + Math.cos(a) * T * 0.9, sy = playerPy + Math.sin(a) * T * 0.9;
            const container = this.add.container(sx, sy).setDepth(2);   // the hand-drawn ember, drawn the way it flies
            container.add(WeaponSystem.aim8(this.add.image(0, 0, WeaponSystem.fireArt(this), 'bolt_e').setScale(1.4), a, 'bolt_'));
            this.fireballs.push({ sprite: container, fireGraphics: null, vx: Math.cos(a) * B.SPEED, vy: Math.sin(a) * B.SPEED, dirX: Math.cos(a), dirY: Math.sin(a),
                damage: B.DMG * this.damageScaling, startX: sx, startY: sy, splitCount: 0, piercedEnemies: new Set(hitEnemies), createdAt: currentTime, lastFlameTime: 0,
                _swordBolt: true, _range: B.RANGE, _noBoss: bossHit });   // (nor the boss the blade just hit)
        }

        this.cameras.main.shake(60, 0.005);
    }

}
