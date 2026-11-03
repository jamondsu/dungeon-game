// ═══════════════════════════════════════════════════════════════════════════
// Freeze.js — ice on an enemy: the chill and its indicator, frozen and its look, the shatter (its burst and the
// splash of a shattered wet one); and the stun mark, drawn the same way.
// GameScene borrows each method through a one-line proxy, so `this` in them is the scene.
// ═══════════════════════════════════════════════════════════════════════════

class Freeze {

    _updateChillIndicator(enemy) {
        // Liveness gate. Indicators hang off the enemy, and killEnemy splices it out of
        // this.enemies -- so anything that recreates a bar after death leaks it forever,
        // with nothing left holding a reference to clean it up. Rather than trusting a
        // dozen call sites to return at the right moment, refuse to build one for a
        // corpse and tear down anything already there.
        if (!enemy || enemy.health <= 0 || !enemy.sprite?.active) {
            this._destroyChillIndicator(enemy);
            return;
        }
        // ── A BAR, not three dots ────────────────────────────────────────────
        // Three dots read as "3 hits and it freezes", which was true when every source added
        // exactly 1. It is not true now: weights run from 1.0 for a point-blank punch down to
        // ~0.09 for a pellet at maximum range, so a dot lighting up meant wildly different things
        // depending on where you were standing. A continuous bar is honest about a continuous
        // quantity -- and the thing the player needs to see is RATE OF FILL, which a bar shows
        // and three discrete pips actively hide.
        if (!enemy._chillBar) {
            enemy._chillBar = this.add.graphics().setDepth(3);
        }
        const g = enemy._chillBar;

        if (enemy._sniperInvisible) { g.setAlpha(0); return; }
        g.setAlpha(1);

        const MAX = (this._chillCfg?.().MAX) || 3;
        const frac = Math.max(0, Math.min(1, (enemy.chillStacks || 0) / MAX));
        const W = 22, H = 4;

        g.clear();
        g.x = enemy.sprite.x - W / 2;
        g.y = enemy.sprite.y - 30;

        // Track, with a dark outline so it stays legible over a pale slime.
        g.fillStyle(0x001222, 0.72);
        g.fillRect(-1, -1, W + 2, H + 2);
        g.fillStyle(0x11334d, 0.9);
        g.fillRect(0, 0, W, H);

        if (frac > 0) {
            // Colour carries urgency: pale blue early, near-white as it approaches the cube, so
            // the bar tells you "almost" without you having to measure its length.
            const hot  = frac > 0.82;
            const fill = hot ? 0xeafaff : (frac > 0.5 ? 0x77ccff : 0x4499dd);
            g.fillStyle(fill, 1);
            g.fillRect(0, 0, Math.max(1, W * frac), H);
            // Highlight along the top edge -- reads as ice rather than a health bar.
            g.fillStyle(0xffffff, hot ? 0.75 : 0.35);
            g.fillRect(0, 0, Math.max(1, W * frac), 1);
            if (hot) {
                const p = 0.45 + 0.55 * Math.abs(Math.sin(this.time.now / 90));
                g.lineStyle(1, 0xffffff, p);
                g.strokeRect(-1.5, -1.5, W + 3, H + 3);
            }
        }
        // Faint segment ticks: the threshold is still MAX "marks" underneath, and keeping them
        // visible means the old mental model still works for anyone who had learned it.
        g.fillStyle(0x001222, 0.55);
        for (let i = 1; i < MAX; i++) g.fillRect(Math.round((W / MAX) * i), 0, 1, H);
    }

    _destroyChillIndicator(enemy) {
        if (!enemy) return;
        if (enemy._chillBar) {
            // One Graphics object now, not an array of three dots.
            this.tweens.killTweensOf(enemy._chillBar);
            enemy._chillBar.destroy();
            enemy._chillBar = null;
        }
    }

    // Stun indicator — spinning stars above a stunned enemy's head. Stun is
    // binary (not stacking like chill), so this is created once when stun starts and
    // removed when it ends; a stunned enemy can still be carried or shoved, so it
    // follows with the other marks (EnemyManager._syncEnemyMarks).
    _showStunIndicator(enemy) {
        if (!enemy.sprite?.active || enemy._stunIndicator) return; // already showing
        const container = this.add.container(enemy.sprite.x, enemy.sprite.y - 32).setDepth(6);
        const stars = [];
        for (let i = 0; i < 3; i++) {
            const star = this.add.graphics();
            star.fillStyle(0xffee44, 1);
            // Simple 4-point star/sparkle shape
            star.fillTriangle(0, -4, 1.3, -1.3, 4, 0);
            star.fillTriangle(4, 0, 1.3, 1.3, 0, 4);
            star.fillTriangle(0, 4, -1.3, 1.3, -4, 0);
            star.fillTriangle(-4, 0, -1.3, -1.3, 0, -4);
            star.lineStyle(0.8, 0xffffff, 0.8);
            star.strokeCircle(0, 0, 1);
            container.add(star);
            stars.push(star);
        }
        enemy._stunIndicator = container;
        enemy._stunIndicatorStars = stars;

        // Orbit the 3 stars in a slow circle above the head
        const radius = 9;
        let angle = 0;
        const orbitTimer = this.time.addEvent({
            delay: 30, loop: true,
            callback: () => {
                if (!container.active) { orbitTimer.remove(); return; }
                angle += 0.12;
                for (let i = 0; i < stars.length; i++) {
                    const a = angle + (i / stars.length) * Math.PI * 2;
                    stars[i].x = Math.cos(a) * radius;
                    stars[i].y = Math.sin(a) * radius * 0.55; // flattened ellipse orbit
                }
            }
        });
        enemy._stunOrbitTimer = orbitTimer;
    }

    _clearStunIndicator(enemy) {
        if (enemy._stunOrbitTimer) { enemy._stunOrbitTimer.remove(); enemy._stunOrbitTimer = null; }
        if (enemy._stunIndicator) {
            this.tweens.killTweensOf(enemy._stunIndicator);
            enemy._stunIndicator.destroy(); // destroys child stars too
            enemy._stunIndicator = null;
            enemy._stunIndicatorStars = null;
        }
    }

    _clearFreezeVisuals(enemy) {
        if (enemy._thawTimer) { enemy._thawTimer.remove(); enemy._thawTimer = null; }
        if (enemy.freezeVisuals) {
            if (enemy.freezeVisuals._extraLayers) {
                for (const l of enemy.freezeVisuals._extraLayers) { this.tweens.killTweensOf(l); l.destroy(); }
            }
            if (enemy.freezeVisuals.iceBlock)  { this.tweens.killTweensOf(enemy.freezeVisuals.iceBlock);  enemy.freezeVisuals.iceBlock.destroy(); }
            if (enemy.freezeVisuals.iceBorder) { this.tweens.killTweensOf(enemy.freezeVisuals.iceBorder); enemy.freezeVisuals.iceBorder.destroy(); }
            enemy.freezeVisuals = null;
        }
        if (enemy.sprite?.active && typeof enemy.sprite.clearTint === 'function') enemy.sprite.clearTint();
    }

    _triggerShatterBurst(enemy, shatterMult = 1.0) {
        if (enemy._deepFrozen && enemy.isFrozen) return;   // the ice ult's Deep Freeze holds until its own shatter (which clears this first)
        // Don't shatter if the enemy was frozen in the last 200ms (same-frame pierce spike freeze)
        if (enemy._justFrozenAt && this.time.now - enemy._justFrozenAt < 200) return;
        if (!enemy._shatterTriggered) {
            enemy._shatterTriggered = true;
            Sfx.play(this, 'shatter');

            // Kill all tweens, then force correct position+scale on next frame
            // (onComplete of killed tweens may still fire this frame)
            this.tweens.killTweensOf(enemy.sprite);
            const snapX = enemy.x * this.TILE_SIZE + this.TILE_SIZE / 2;
            const snapY = enemy.y * this.TILE_SIZE + this.TILE_SIZE / 2 + this.SLIME_Y_OFFSET;
            // Use delayedCall(0) so it runs after any onComplete callbacks fire this frame
            this.time.delayedCall(0, () => {
                if (!enemy.sprite || !enemy.sprite.active) return;
                this.tweens.killTweensOf(enemy.sprite);
                enemy.sprite.x = snapX;
                enemy.sprite.y = snapY;
                enemy.sprite.setScale(this.SLIME_SCALE);
            });
            enemy.sprite.x = snapX;
            enemy.sprite.y = snapY;
            enemy.sprite.setScale(this.SLIME_SCALE);

            const ex = snapX, ey = snapY;

            // Shard burst
            for (let i = 0; i < (enemy._quietShatter ? 0 : 10); i++) {
                const angle = (i / 10) * Math.PI * 2;
                const shard = this.add.rectangle(ex, ey, 5, 10, 0xaaffff, 1).setDepth(4);
                shard.setRotation(angle);
                this.tweens.add({
                    targets: shard,
                    x: ex + Math.cos(angle) * 30, y: ey + Math.sin(angle) * 30,
                    alpha: 0, scaleX: 0.3, scaleY: 0.3,
                    duration: 350, ease: 'Quad.easeOut',
                    onComplete: () => shard.destroy()
                });
            }
            if (!enemy._quietShatter) { const burst = this.add.circle(ex, ey, 8, 0xffffff, 0.9).setDepth(4);
            this.tweens.add({ targets: burst, radius: 28, alpha: 0, duration: 300, onComplete: () => burst.destroy() }); }
            this.cameras.main.shake(20, 0.001);
            this.showStatusText(ex, ey - 28, 'SHATTER!', '#aaffff');
            this.gainUltCharge(this.ultChargePerFreeze * 2, 'ice');

            // Cancel natural-melt timer
            if (enemy._freezeMeltTimer) { enemy._freezeMeltTimer.remove(); enemy._freezeMeltTimer = null; }

            // Unfreeze BEFORE dealing damage — damageEnemy applies 2.5x frozenBonus
            // while isFrozen is true, which would inflate shatter to 250 damage
            enemy.isFrozen = false;
            enemy.frozenUntil = 0;
            enemy.frozenAt = 0;
            this._clearFreezeVisuals(enemy);

            // Shatter burst damage — shatterMult is per-weapon (fractal=1.0/default, cannon=~0.133)
            // Resolved once, the way every other ice hit is: the table, brittle and purple (all in
            // resolveElementalHit). It applied purple here AND went through damageEnemy, which
            // applied it again (x4), ran every on-hit effect a second time (a slow, the 15% cube
            // roll, a second ult charge) and printed a second, unresolved number; the ice-immune
            // branch paid a second charge on top of the shatter's own (above).
            // (No early return for a refused or phased-out target any more: that skipped the reset
            // of _shatterTriggered at the end, and the enemy could never shatter again.)
            const shatterDmg = 7.5 * shatterMult * this.damageScaling;
            const _rd1729 = this._phasedOut(enemy) ? null : this.resolveElementalHit(enemy, shatterDmg, 'ice');
            if (_rd1729 !== null) {
                enemy.health -= _rd1729;
                this.showDamageNumber(ex, ey - 44, Math.round(_rd1729), '#ffffff');
                this.updateEnemyHealthBar(enemy);
                if (enemy.health <= 0) { this._destroyChillIndicator(enemy); this.killEnemy(enemy); }
            }
            this.damageBossAtTile(enemy.x, enemy.y, shatterDmg, undefined, 'ice');
            this._shatterWaterSplash(enemy.x, enemy.y);

            // Destroy chill stack indicator
            this._destroyChillIndicator(enemy);

            // Reset flag after short delay
            this.time.delayedCall(100, () => { enemy._shatterTriggered = false; });
        }
    }

    _shatterWaterSplash(originTileX, originTileY) {
        // Rings appear outward (r=0..3), linger together, then disappear outward (r=0 last).
        // Each ring stays visible until its outward-fade turn comes.
        const RADIUS       = 3;
        const RING_INTERVAL = 100;  // ms between each ring appearing
        const HOLD_TIME    = 400;   // ms all rings stay fully visible after last ring appears
        const FADE_DUR     = 180;   // ms to fade each ring out
        const WET_DURATION = 4500;

        if (!this.activeWaterTiles) this.activeWaterTiles = [];

        // Collect tile visuals per ring so we can fade them in reverse order
        const ringObjs = [];

        for (let r = 0; r <= RADIUS; r++) {
            const appearDelay = r * RING_INTERVAL;
            // Disappear: outermost ring fades first, then inward
            const disappearDelay = appearDelay + HOLD_TIME + (RADIUS - r) * RING_INTERVAL;

            const tiles = [];
            if (r === 0) {
                tiles.push({ tx: originTileX, ty: originTileY });
            } else {
                for (let dx = -r; dx <= r; dx++) {
                    for (let dy = -r; dy <= r; dy++) {
                        const dist = Math.sqrt(dx * dx + dy * dy);
                        if (dist < r - 0.6 || dist > r + 0.6) continue;
                        tiles.push({ tx: originTileX + dx, ty: originTileY + dy });
                    }
                }
            }

            this.time.delayedCall(appearDelay, () => {
                if (this._deathScreenActive) return;
                for (const { tx, ty } of tiles) {
                    if (!this.world[tx] || this.world[tx][ty] !== this.FLOOR) continue;
                    const wx = tx * this.TILE_SIZE + this.TILE_SIZE / 2;
                    const wy = ty * this.TILE_SIZE + this.TILE_SIZE / 2;

                    const tile    = (this._vfxWaterImg ? this._vfxWaterImg(wx, wy, false)
                        : this.add.rectangle(wx, wy, this.TILE_SIZE,     this.TILE_SIZE,     0x0055aa, 0.65).setDepth(0.5)).setAlpha(0);
                    const shimmer = (this._vfxWaterImg ? this._vfxWaterImg(wx, wy, true)
                        : this.add.rectangle(wx, wy, this.TILE_SIZE - 4, this.TILE_SIZE - 4, 0x3388cc, 0.4 ).setDepth(0.5)).setAlpha(0);

                    // Continuous shimmer like tsunami puddles
                    this.tweens.add({ targets: shimmer, alpha: 0.6, duration: 150 + Math.random() * 100, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });

                    // Fade in
                    this.tweens.add({ targets: tile,    alpha: 0.65, duration: 350, ease: 'Quad.easeOut' });
                    this.tweens.add({ targets: shimmer, alpha: 0.4,  duration: 350, ease: 'Quad.easeOut' });

                    // Fade out at its scheduled disappear time
                    const fadeIn = disappearDelay - appearDelay;
                    this.time.delayedCall(fadeIn, () => {
                        this.tweens.add({ targets: [tile, shimmer], alpha: 0, duration: FADE_DUR,
                            onComplete: () => { tile.destroy(); shimmer.destroy(); } });
                    });

                    // Register wet zone
                    const expiresAt = this.time.now + disappearDelay + FADE_DUR;
                    const tileEntry = { tileX: tx, tileY: ty, expiresAt };
                    this.activeWaterTiles.push(tileEntry);
                    this.time.delayedCall(disappearDelay + FADE_DUR, () => {
                        const idx = this.activeWaterTiles.indexOf(tileEntry);
                        if (idx !== -1) this.activeWaterTiles.splice(idx, 1);
                    });

                    // Wet enemies on this tile now
                    // Dries at wetUntil, whichever splash set it last: a refresh used to move the
                    // deadline while the first splash's timer dried it anyway.
                    const dry = (enemy) => {
                        if (this.time.now + 20 < (enemy.wetUntil || 0)) return;
                        enemy.isWet = false;
                        if (enemy.sprite?.active && !enemy.isFrozen && typeof enemy.sprite.clearTint === 'function') enemy.sprite.clearTint();
                    };
                    for (const enemy of this.enemies) {
                        if (this._phasedOut?.(enemy)) continue;
                        if (enemy.x !== tx || enemy.y !== ty) continue;
                        if (enemy.isWet) {
                            enemy.wetUntil = this.time.now + WET_DURATION;
                            this.time.delayedCall(WET_DURATION, () => dry(enemy));
                            continue;
                        }
                        enemy.isWet = true;
                        enemy.wetUntil = this.time.now + WET_DURATION;
                        if (enemy.sprite?.active && typeof enemy.sprite.setTint === 'function') {
                            enemy.sprite.setTint(0x4499ff);
                            this.showStatusText(enemy.sprite.x, enemy.sprite.y, 'WET', '#44aaff');
                        }
                        this.time.delayedCall(WET_DURATION, () => dry(enemy));
                    }
                }
            });
        }
    }
}
