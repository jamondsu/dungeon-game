// ═══════════════════════════════════════════════════════════════════════════
// Mortar.js — the Mortar: made, and its lobbed shot.
// GameScene borrows each method, so `this` in them is the scene.
// ═══════════════════════════════════════════════════════════════════════════

class Mortar {

    createMortar(x, y, roomIndex) {
        const e = this.createEnemy(x, y, 220);
        e.tutorialRoomIndex = roomIndex;
        e.isMortar = true;
        e._mortarLastFire = 0;
        e._mortarCooldown = 3200;
        e._mortarSafeRadius = 5;  // tiles — blind spot underneath it
        e._mortarMaxRange   = 13; // tiles — outer limit, so it cannot shell the map
        SlimeModels.wear(this, e.sprite, 'mortar');   // its own body: a little volcano
        const gfx = this.add.graphics().setDepth(2);
        gfx.lineStyle(2.5, 0xff6600, 0.80); gfx.strokeCircle(0, 0, 10);
        gfx.fillStyle(0xff6600, 0.40);       gfx.fillCircle(0, 0, 10);
        gfx.fillStyle(0xffaa00, 0.90);       gfx.fillCircle(0, 0, 4);
        gfx.x = e.sprite.x; gfx.y = e.sprite.y;
        this.tweens.add({ targets: gfx, alpha: 0.55, duration: 700, yoyo: true, repeat: -1 });
        e._mortarGfx = gfx;
        // Safe-radius ring
        // Safe radius: a faint warm glow, no line
        e._mortarSafeRing = VisualFX.aura(this, e.sprite.x, e.sprite.y, e._mortarSafeRadius * this.TILE_SIZE, 0xff9a30, { alpha: 0.6 });
        return e;
    }

    // ── Level 4: Mortar arc shot — flies over walls, lands on player tile ──
    _fireMortarShot(enemy) {
        const TS = this.TILE_SIZE;
        Sfx.play(this, 'lob');
        const ex = enemy.sprite.x, ey = enemy.sprite.y;
        // Target: TD can override to pick the nearest tower/base; else lock to player tile.
        const ov = this._mortarTargetOverride ? this._mortarTargetOverride(enemy) : null;
        const targetPX = ov ? ov.px : this.playerX * TS + TS / 2;
        const targetPY = ov ? ov.py : this.playerY * TS + TS / 2;

        // Arc trajectory — parabolic tween
        const FLIGHT_DUR = 1000 + Math.random() * 300;
        const SPLASH_R   = 2.0; // tile radius AoE on landing
        const DMG        = this._mortarShellDamage ?? (20 * (this.enemyDamageScale || 1));

        EnemyManager.playAtk(this, enemy.sprite, 450, targetPX < ex, 'fire_');   // its crater swells and bursts (its own frames)
        // its shadow grows on the floor as the rock comes down; the rock, a lump of lava stone tumbling by its frames (EnemyFX)
        const shadow = EnemyFX.shadow(this, ex, ey);
        const shadowTw = this.tweens.add({ targets: shadow, x: targetPX, y: targetPY,
            scaleX: 3, scaleY: 2, duration: FLIGHT_DUR, ease: 'Linear' });
        const rock = EnemyFX.shell(this, ex, ey - 6);
        // Bosses.js: the very tiles it will hit filling in on the floor from the moment it leaves (the old ring came at 40% of the flight)
        const _mk = this._bfxOn ? BossFX.mark(this, BossFX.tilesInRadius(this, targetPX, targetPY, SPLASH_R * TS, false), 0xff7a1a, FLIGHT_DUR) : null;

        // Warning ring at landing zone appears halfway through flight
        this.time.delayedCall(FLIGHT_DUR * 0.4, () => {
            if (_mk) return;
            const warn = this.add.graphics().setDepth(3.5);
            warn.lineStyle(2, 0xff6600, 0.80); warn.strokeCircle(targetPX, targetPY, SPLASH_R * TS);
            warn.fillStyle(0xff6600, 0.10); warn.fillCircle(targetPX, targetPY, SPLASH_R * TS);
            this.tweens.add({ targets: warn, alpha: 0.30, duration: 250, yoyo: true, repeat: 2,
                onComplete: () => warn.destroy() });
        });

        // Arc motion — horizontal linear, vertical parabolic
        const arcHeight = 120 + Math.random() * 60;
        const startY = ey;
        let elapsed = 0;
        const arcTimer = this.time.addEvent({
            delay: 16, loop: true,
            callback: CombatSystem.tauntKeep(this, () => {   // (lobbed at an ally: it's that ally it lands on)
                const slow = Trident.slow(this, rock.x, rock.y);   // (the Boreal Trident's aura)
                elapsed += 16 * slow; shadowTw.timeScale = slow;
                const t = Math.min(elapsed / FLIGHT_DUR, 1);
                rock.x = ex + (targetPX - ex) * t;
                // Parabola: y = start + (end-start)*t - 4*arcHeight*t*(1-t)
                rock.y = startY + (targetPY - startY) * t - 4 * arcHeight * t * (1 - t);
                rock.setScale(1.2 + t * 0.6); // grows as it falls
                EnemyFX.tumble(rock, elapsed);
                if (t >= 1) {
                    arcTimer.remove();
                    rock.destroy(); shadow.destroy();
                    if (_mk) { _mk.done(); BossFX.blast(this, targetPX, targetPY, SPLASH_R * TS, 'shell'); }
                    // IMPACT
                    this.cameras.main.shake(80, 0.006);
                    Sfx.play(this, 'slam', { small: true });
                    if (!_mk) this._vfxFlash?.(targetPX, targetPY, SPLASH_R * TS * 1.6, 0xff7a1a, 320, 1);
                    EnemyFX.debris(this, targetPX, targetPY, SPLASH_R * TS);   // rocks and embers flung out, a scorch on the floor
                    // Damage if the locked-on impact point is still within splash range of
                    // wherever the target actually is now. In TD, targetPX/Y is permanently
                    // the base position (immune to dodging by design — you're defending a
                    // fixed structure, not a mobile player), so this always lands correctly.
                    // In the main game, the player may have moved since the rock launched —
                    // check their CURRENT position against the locked impact point, same as
                    // the original intent, just reading the right coordinate pair.
                    CombatSystem.tauntBoth(this, () => {   // (and you, if you're in it too)
                    const curPX = this.playerX * TS + TS / 2;
                    const curPY = this.playerY * TS + TS / 2;
                    const pdx = curPX - targetPX, pdy = curPY - targetPY;
                    if (Math.sqrt(pdx*pdx + pdy*pdy) <= SPLASH_R * TS) {
                        this._hitBy = enemy; this.takeDamage(DMG); this._hitBy = null;
                    }
                    });
                    // Damage any engineer tower caught in the splash
                    if (this.engineerTowers?.length) {
                        for (const tower of this.engineerTowers) {
                            if (!tower.active) continue;
                            const tdx = tower.px - targetPX, tdy = tower.py - targetPY;
                            if (Math.sqrt(tdx*tdx + tdy*tdy) <= SPLASH_R * TS) {
                                this.damageEngineerTower(tower, DMG);
                            }
                        }
                    }
                }
            })
        });
    }

}
