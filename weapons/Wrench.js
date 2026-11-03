// ═══════════════════════════════════════════════════════════════════════════
// Wrench.js — the Wrench ('engineering_degree'): Tower Defense only, no shop card.
// GameScene borrows each method through a one-line proxy, so `this` in them is the scene.
// ═══════════════════════════════════════════════════════════════════════════

class Wrench {

    //
    // NOT reachable from the overworld any more: Ball Lightning replaced Engineering Degree
    // and no weapon id dispatches here. These stay because TowerDefenseScene is built on them
    // -- it has a whole Wrench upgrade tab (damage, extra bounces, Long Arm, Quick Release,
    // Gold and Diamond reforges) and its overrides call straight into these as base behaviour:
    //
    //   TowerDefenseScene.engineeringDegreeAttack -> Wrench.prototype.engineeringDegreeAttack
    //   TowerDefenseScene._throwWrenchArc         -> Wrench.prototype._throwWrenchArc
    //   TowerDefenseScene._wrenchImpact           -> Wrench.prototype._wrenchImpact
    //
    // Exactly the shape the engineer towers already had: the overworld drops the ENTRY POINT,
    // and the shared implementation stays for the mode that is actually built on it.
    engineeringDegreeAttack(targetX, targetY) {
        const currentTime = this.time.now;
        if (currentTime - (this._lastWrenchTime || 0) < 1500 - (this._wrenchCDBonus || 0)) return;
        this._lastWrenchTime = currentTime;

        const TS = this.TILE_SIZE;
        const worldX = targetX + this.cameras.main.scrollX;
        const worldY = targetY + this.cameras.main.scrollY;
        const px = this.player.x, py = this.player.y;
        const dx = worldX - px, dy = worldY - py;
        const dist = Math.sqrt(dx * dx + dy * dy) || 1;

        const MAX_RANGE = (8 + (this._wrenchRangeBonus || 0)) * TS;
        const lobDist = Math.min(dist, MAX_RANGE);
        const dirX = dx / dist, dirY = dy / dist;
        const targetPX = px + dirX * lobDist;
        const targetPY = py + dirY * lobDist;

        const TOTAL_BOUNCES = 3 + (this._wrenchBounceBonus || 0);
        this._throwWrenchArc(px, py, targetPX, targetPY, TOTAL_BOUNCES, dirX, dirY, lobDist);
    }

    // One hop of the wrench's flight -- arcs from (fromX,fromY) to (toX,toY), impacts on
    // landing, then hops again along the same throw direction with a shrinking distance.
    _throwWrenchArc(fromX, fromY, toX, toY, bouncesLeft, dirX, dirY, hopDist) {
        const TS = this.TILE_SIZE;
        const WRENCH_DMG = 2 * this.damageScaling;
        const SPLASH_R = 1.5;   // tile radius AoE on landing -- covers a 3x3 tile area
        const STUN_R = 0.5;     // tile radius -- tighter than the damage splash

        const gfx = this.add.graphics().setDepth(4);
        gfx.x = fromX; gfx.y = fromY;
        this._drawWrenchGfx(gfx, 0);

        // Shadow on the ground grows as the wrench rises and falls, so the arc reads as height.
        const shadow = this.add.ellipse(fromX, fromY, 10, 5, 0x000000, 0.3).setDepth(1.6);

        const PEAK = Math.min(34, 12 + hopDist * 0.25);
        const dur = Math.max(180, Math.min(520, hopDist * 2.2));
        const start = this.time.now;
        const ev = this.time.addEvent({
            delay: 16, loop: true, callback: () => {
                const t = Math.min(1, (this.time.now - start) / dur);
                const bx = fromX + (toX - fromX) * t;
                const by = fromY + (toY - fromY) * t;
                if (gfx.active) {
                    gfx.x = bx;
                    gfx.y = by - Math.sin(t * Math.PI) * PEAK;
                    this._drawWrenchGfx(gfx, t * Math.PI * 4);
                }
                if (shadow.active) { shadow.x = bx; shadow.y = by; shadow.setScale(0.7 + t * 0.5); }
                if (t < 1) return;

                ev.remove();
                if (gfx.active) gfx.destroy();
                if (shadow.active) shadow.destroy();
                this._wrenchImpact(toX, toY, WRENCH_DMG, SPLASH_R, STUN_R);

                if (bouncesLeft > 0) {
                    const nextHopDist = hopDist * 0.6;
                    const nextX = toX + dirX * nextHopDist;
                    const nextY = toY + dirY * nextHopDist;
                    const ntx = Math.floor(nextX / TS), nty = Math.floor(nextY / TS);
                    const blocked = this.world?.[ntx]?.[nty] === this.WALL
                                 || this.world?.[ntx]?.[nty] === this.NOTHING;
                    if (!blocked && nextHopDist > TS * 0.4) {
                        this._throwWrenchArc(toX, toY, nextX, nextY, bouncesLeft - 1,
                                             dirX, dirY, nextHopDist);
                    }
                }
            }
        });
    }

    // AoE impact at the landing point -- splash damage, a tighter stun ring, portals and
    // bosses. Returns nothing; TowerDefenseScene wraps it to add its Gold/Diamond effects.
    _wrenchImpact(targetPX, targetPY, damage, splashRTiles, stunRTiles) {
        const TS = this.TILE_SIZE;
        const splashR = splashRTiles * TS;
        const stunR = (stunRTiles ?? 0) * TS;

        const impactGfx = this.add.graphics().setDepth(5);
        impactGfx.x = targetPX; impactGfx.y = targetPY;
        impactGfx.fillStyle(0xaaaaaa, 0.55); impactGfx.fillCircle(0, 0, splashR * 1.1);
        impactGfx.fillStyle(0xdddddd, 0.70); impactGfx.fillCircle(0, 0, splashR * 0.4);
        this.tweens.add({ targets: impactGfx, scaleX: 1.4, scaleY: 1.4, alpha: 0,
                          duration: 300, onComplete: () => impactGfx.destroy() });
        this.cameras.main.shake(20, 0.0015);

        for (let d = 0; d < 4; d++) {
            const da = Math.random() * Math.PI * 2;
            const dr = 10 + Math.random() * 16;
            const dg = this.add.graphics().setDepth(4);
            dg.fillStyle(0xcccccc, 1.0); dg.fillCircle(0, 0, 1.5 + Math.random() * 1.5);
            dg.x = targetPX; dg.y = targetPY;
            this.tweens.add({ targets: dg, x: targetPX + Math.cos(da) * dr,
                              y: targetPY + Math.sin(da) * dr, alpha: 0,
                              duration: 280, onComplete: () => dg.destroy() });
        }

        let hitSomething = false;

        // CONDUCTION. A lump of metal landing in a puddle carries the charge through the whole
        // connected pool. Keyed off the LANDING TILE, so a wrench thrown into empty water
        // still electrifies it.
        if (typeof this._energizePool === 'function') {
            const wtx = Math.floor(targetPX / TS), wty = Math.floor(targetPY / TS);
            if (this.isWaterAt?.(wtx, wty)) this._energizePool(wtx, wty, damage);
        }

        for (const enemy of [...this.enemies]) {
            if (!enemy.sprite?.active) continue;
            const edx = enemy.sprite.x - targetPX, edy = enemy.sprite.y - targetPY;
            const ed = Math.sqrt(edx * edx + edy * edy);
            if (ed <= splashR) {
                if (this._phasedOut(enemy)) continue;
                const _rdWrench = this.resolveElementalHit(enemy, damage, 'lightning');
                if (_rdWrench === null) continue;
                enemy.health -= _rdWrench;
                this.showDamageNumber(enemy.sprite.x, enemy.sprite.y - 10, Math.round(_rdWrench), '#cccccc');
                this.updateEnemyHealthBar(enemy);
                this.gainUltCharge(this.ultChargePerHit);
                if (enemy.health <= 0) { this.killEnemy(enemy); hitSomething = true; continue; }
                hitSomething = true;
            }
            if (stunR > 0 && ed <= stunR && enemy.sprite?.active) {
                enemy.isStunned = true;
                enemy.stunnedUntil = Math.max(enemy.stunnedUntil || 0, this.time.now + 1000);
                this._showStunIndicator(enemy);
            }
        }

        const tx = Math.floor(targetPX / TS), ty = Math.floor(targetPY / TS);
        const portalHit = this.getPortalAt(tx, ty);
        if (portalHit) { this.damagePortal(portalHit, damage); hitSomething = true; }

        for (const boss of [this.voltslimeBoss, this.voidSovereignBoss, this.fractureCore].filter(Boolean)) {
            if (!boss.active) continue;
            const bx = boss.container?.x ?? boss.tileX * TS;
            const by = boss.container?.y ?? boss.tileY * TS;
            if (Math.hypot(targetPX - bx, targetPY - by) <= splashR + TS * 1.5) {
                this.damageBossAtTile(boss.tileX, boss.tileY, damage);
                hitSomething = true;
            }
        }

        if (hitSomething && Math.random() < 0.35) this.spawnOrbScrap(targetPX, targetPY);
    }

    // Pixel-art wrench silhouette — handle plus two jaw ends. TowerDefenseScene overrides this
    // with gold/diamond variants, so this is the plain fallback.
    _drawWrenchGfx(gfx, rotation) {
        gfx.clear();
        gfx.setRotation(rotation || 0);
        gfx.fillStyle(0x999999, 1);
        gfx.fillRect(-1.5, -7, 3, 14);              // handle
        gfx.lineStyle(1, 0x555555, 0.9);
        gfx.strokeCircle(0, -9, 5);                  // upper jaw
        gfx.strokeCircle(0, 9, 4);                   // lower jaw
        gfx.fillStyle(0xcccccc, 1);
        gfx.fillRect(-1, -6, 1, 12);                 // highlight
    }

}
