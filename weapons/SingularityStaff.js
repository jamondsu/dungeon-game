// ═══════════════════════════════════════════════════════════════════════════
// SingularityStaff.js — the first Singularity Staff (cosmic): the singularity and its collapse. Cosmic.js casts all
// five cosmic weapons now; this stays for a scene without it.
// GameScene borrows each method through a one-line proxy, so `this` in them is the scene.
// ═══════════════════════════════════════════════════════════════════════════

class SingularityStaff {

    singularityStaffFire(targetX, targetY) {
        const now = this.time.now;
        // Block fire during collapse mode
        if (this._collapseMode || this._collapseBarActive) return;
        if (now - (this._lastSingFire || 0) < 2500) return;
        this._lastSingFire = now;

        // Direction toward mouse
        const worldX = targetX + this.cameras.main.scrollX;
        const worldY = targetY + this.cameras.main.scrollY;
        const px = this._shotX();   // where the slime is drawn (mid-dash it's still on its way)
        const py = this._shotY();
        const dx = worldX - px, dy = worldY - py;
        const len = Math.sqrt(dx * dx + dy * dy) || 1;

        // Snapshot tiles traversed at fire time for speed scaling
        const tilesAtFire = this._singTilesTraversed || 0;

        if (!this._singularities) this._singularities = [];
        const gfx = this.add.graphics().setDepth(3.5);
        gfx.x = px; gfx.y = py;

        this._singularities.push({
            gfx,
            vx: (dx / len) * 90,  // base speed px/s — slow, ominous
            vy: (dy / len) * 90,
            startX: px, startY: py,
            tilesAtFire,           // tiles traversed when fired — used for speed scaling
            _tilesWhenFired: this._singTilesTraversed || 0,
            createdAt: now,
            pullRadius: 4 * this.TILE_SIZE,
            dotTimer: 0,
            phase: 0,              // for visual animation
        });

        // Count shots for collapse unlock
        // (removed — orb is now gated by the passive charge bar, not a shot counter)

        // Reset orb charge bar after firing — bar restarts from 0
        this._singOrbCharge = 0;
        this._singOrbTilesAtLastCheck = this._singTilesTraversed || 0;
        this._updateSingOrbBar();

        // Muzzle flash
        const mf = this.add.graphics().setDepth(4);
        mf.x = px; mf.y = py;
        mf.fillStyle(0x9900ff, 0.80); mf.fillCircle(0, 0, 16);
        mf.lineStyle(2, 0xcc44ff, 0.70); mf.strokeCircle(0, 0, 20);
        this.tweens.add({ targets: mf, scaleX: 2, scaleY: 2, alpha: 0, duration: 200, onComplete: () => mf.destroy() });
    }

    updateSingularityStaff(delta) {
        if (!this._singularities?.length) return;
        const ds = delta / 1000;
        const TS = this.TILE_SIZE;
        const now = this.time.now;

        for (let i = this._singularities.length - 1; i >= 0; i--) {
            const s = this._singularities[i];
            if (!s.gfx?.active) { this._singularities.splice(i, 1); continue; }

            // Speed scales with tiles traversed since fire — gentle +6% per tile
            const tilesDelta = Math.max(0, (this._singTilesTraversed || 0) - s._tilesWhenFired);
            const speedMult = 1 + tilesDelta * 0.06;
            s.gfx.x += s.vx * speedMult * ds;
            s.gfx.y += s.vy * speedMult * ds;

            // Crack shrink — pierces, no effect on projectile flight (Level 4)
            this._checkProjectileCrackShrink(s.gfx.x, s.gfx.y);

            // Wall / locked room check
            const tx = Math.floor(s.gfx.x / TS), ty = Math.floor(s.gfx.y / TS);
            const oob = tx < 0 || tx >= this.WORLD_WIDTH || ty < 0 || ty >= this.WORLD_HEIGHT;
            const hitWall = oob || this.world[tx]?.[ty] === this.WALL || this.world[tx]?.[ty] === this.NOTHING || this.isInLockedRoom(tx, ty);
            const tooOld = now - s.createdAt > 6000;

            if (hitWall || tooOld) {
                this._singularityExplode(s, speedMult, tilesDelta);
                s.gfx.destroy();
                this._singularities.splice(i, 1);
                continue;
            }

            // ── Strong pull — drags enemies along with the projectile ──────────
            s.dotTimer += delta;
            for (const enemy of [...this.enemies]) {
                if (this._phasedOut?.(enemy)) continue;
                if (!enemy.sprite?.active) continue;
                const ex = enemy.sprite.x, ey = enemy.sprite.y;
                const dist = Math.hypot(ex - s.gfx.x, ey - s.gfx.y);
                if (dist > s.pullRadius) continue;

                // Pull velocity: strong constant drag toward singularity center
                // Scales up toward center (strongest when close)
                const pullForce = 280 * (1 - dist / s.pullRadius) + 80; // 80-360 px/s
                const pdx = s.gfx.x - ex, pdy = s.gfx.y - ey;
                const plen = Math.hypot(pdx, pdy) || 1;
                enemy.sprite.x += (pdx / plen) * pullForce * ds;
                enemy.sprite.y += (pdy / plen) * pullForce * ds;

                // Clamp to floor tiles
                const newTX = Math.floor(enemy.sprite.x / TS);
                const newTY = Math.floor(enemy.sprite.y / TS);
                if (this.world[newTX]?.[newTY] === this.FLOOR) {
                    enemy.x = newTX;
                    enemy.y = newTY;
                } else {
                    // Revert to tile center if pulled into a wall
                    enemy.sprite.x = enemy.x * TS + TS / 2;
                    enemy.sprite.y = enemy.y * TS + TS / 2 + (this.SLIME_Y_OFFSET || 0);
                }

                // DOT every 200ms. Element passed EXPLICITLY: this fires from a
                // per-frame update long after the cast, so this.currentElement may have
                // changed — the black hole's damage is cosmic regardless of what the
                // player is holding now.
                if (s.dotTimer >= 200) this.damageEnemy(enemy, 4 * this.damageScaling, 'cosmic');
            }
            if (s.dotTimer >= 200) s.dotTimer = 0;

            // ── Inward streaming particles ────────────────────────────────────
            s.phase += delta * 0.005;
            if (now - (s._lastParticle || 0) > 60) {
                s._lastParticle = now;
                const count = 2 + Math.floor(tilesDelta * 0.3);
                for (let p = 0; p < count; p++) {
                    const a = Math.random() * Math.PI * 2;
                    const r = s.pullRadius * (0.3 + Math.random() * 0.7);
                    const pg = this.add.graphics().setDepth(3.3);
                    const col = Math.random() < 0.5 ? 0xcc44ff : 0x9900cc;
                    pg.fillStyle(col, 0.65 + Math.random() * 0.25);
                    pg.fillCircle(0, 0, 1.5 + Math.random() * 2);
                    pg.x = s.gfx.x + Math.cos(a) * r;
                    pg.y = s.gfx.y + Math.sin(a) * r;
                    this.tweens.add({
                        targets: pg, x: s.gfx.x, y: s.gfx.y,
                        alpha: 0, duration: 350 + Math.random() * 200,
                        ease: 'Quad.easeIn', onComplete: () => pg.destroy()
                    });
                }
            }

            // ── Black hole visual — matches ult aesthetic ─────────────────────
            s.gfx.clear();
            const R = TS * 0.48; // base radius

            // Outer distortion haze (dark purple, slow pulse)
            const distPulse = 0.15 + 0.08 * Math.sin(s.phase * 0.7);
            s.gfx.fillStyle(0x220044, distPulse);
            s.gfx.fillCircle(0, 0, R * 2.4);

            // Outer ring (purple glow, pulsing scale)
            const outerScale = 1.0 + 0.12 * Math.sin(s.phase * 1.1);
            s.gfx.lineStyle(4, 0x9966ff, 0.85);
            s.gfx.strokeCircle(0, 0, R * outerScale);
            s.gfx.fillStyle(0x330066, 0.35);
            s.gfx.fillCircle(0, 0, R * outerScale);

            // Middle ring (brighter, faster pulse)
            const midScale = 1.0 + 0.18 * Math.sin(s.phase * 1.4 + 0.3);
            s.gfx.lineStyle(3, 0xaa77ff, 0.95);
            s.gfx.strokeCircle(0, 0, R * 0.62 * midScale);
            s.gfx.fillStyle(0x660099, 0.50);
            s.gfx.fillCircle(0, 0, R * 0.62 * midScale);

            // Inner ring (pink/bright, fastest pulse)
            const innerScale = 1.0 + 0.25 * Math.sin(s.phase * 1.8 + 0.6);
            s.gfx.lineStyle(2.5, 0xdd99ff, 1.0);
            s.gfx.strokeCircle(0, 0, R * 0.34 * innerScale);
            s.gfx.fillStyle(0x9933cc, 0.65);
            s.gfx.fillCircle(0, 0, R * 0.34 * innerScale);

            // 4 rotating spiral arms (counter-clockwise like ult)
            const armAngle = -s.phase * 1.2; // counter-clockwise
            for (let arm = 0; arm < 4; arm++) {
                const startA = armAngle + (Math.PI * 2 / 4) * arm;
                s.gfx.lineStyle(2, 0x9966ff, 0.55);
                s.gfx.beginPath();
                const armLen = R * 0.92;
                for (let r = 4; r < armLen; r += 2) {
                    const spiral = startA + (r / armLen) * Math.PI;
                    const sx = Math.cos(spiral) * r;
                    const sy = Math.sin(spiral) * r;
                    if (r === 4) s.gfx.moveTo(sx, sy);
                    else s.gfx.lineTo(sx, sy);
                }
                s.gfx.strokePath();
            }

            // Orbiting particle dots (8 dots at varying radii, counter-rotating)
            for (let d = 0; d < 8; d++) {
                const da = armAngle + (d / 8) * Math.PI * 2;
                const dr = R * (0.25 + (d % 3) * 0.18);
                const alpha = 0.55 + 0.35 * Math.sin(s.phase * 2 + d);
                s.gfx.fillStyle(0xffffff, alpha);
                s.gfx.fillCircle(Math.cos(da) * dr, Math.sin(da) * dr, 1.8);
            }

            // Absolute void core — total black
            s.gfx.fillStyle(0x000000, 1.0);
            s.gfx.fillCircle(0, 0, R * 0.20);

            // Bright singularity core (yellow-white, fast pulse like ult)
            const corePulse = 1.0 + 0.45 * Math.abs(Math.sin(s.phase * 2.2));
            s.gfx.fillStyle(0xffff00, 0.90);
            s.gfx.fillCircle(0, 0, R * 0.10 * corePulse);
            s.gfx.lineStyle(1.5, 0xffffff, 0.90);
            s.gfx.strokeCircle(0, 0, R * 0.10 * corePulse);

            // Speed glow — outer ring brightens as projectile accelerates
            if (speedMult > 1.08) {
                const intensity = Math.min(0.75, (speedMult - 1) * 1.5);
                s.gfx.lineStyle(2.5, 0xcc88ff, intensity);
                s.gfx.strokeCircle(0, 0, R * (1.05 + (speedMult - 1) * 0.10));
            }
        }
    }

    _singularityExplode(s, speedMult, tilesDelta) {
        const BASE_DMG  = 28;
        const dmg = BASE_DMG * speedMult * this.damageScaling;
        const R   = this.TILE_SIZE * (1.5 + tilesDelta * 0.25); // bigger explosion with more tiles
        const ex  = s.gfx.x, ey = s.gfx.y;

        // Explosion visual
        const exp = this.add.graphics().setDepth(5);
        exp.x = ex; exp.y = ey;
        exp.fillStyle(0x000000, 0.85); exp.fillCircle(0, 0, R * 1.1);
        exp.fillStyle(0x9900ff, 0.65); exp.fillCircle(0, 0, R);
        exp.fillStyle(0xcc44ff, 0.55); exp.fillCircle(0, 0, R * 0.55);
        exp.fillStyle(0xffffff, 0.80); exp.fillCircle(0, 0, R * 0.22);
        exp.lineStyle(3, 0xee88ff, 0.90); exp.strokeCircle(0, 0, R);
        this.tweens.add({ targets: exp, scaleX: 1.8, scaleY: 1.8, alpha: 0, duration: 450, ease: 'Quad.easeOut', onComplete: () => exp.destroy() });
        this.cameras.main.shake(40 + Math.floor(tilesDelta * 8), 0.004 + tilesDelta * 0.001);

        // Damage enemies in radius
        for (const enemy of [...this.enemies]) {
            if (this._phasedOut?.(enemy)) continue;
            if (!enemy.sprite?.active) continue;
            if (Math.hypot(enemy.sprite.x - ex, enemy.sprite.y - ey) <= R) {
                this.damageEnemy(enemy, dmg);
            }
        }
        this.damageBossAtTile(Math.floor(ex / this.TILE_SIZE), Math.floor(ey / this.TILE_SIZE), dmg);

        // Speed text if boosted
        if (tilesDelta > 0) {
            this.showStatusText(ex, ey - 20, `${Math.round(dmg)} IMPACT`, '#ee88ff');
        }
    }

    // ── COLLAPSE MODE ──────────────────────────────────────────────────

    singularityCollapseActivate() {
        if (this._collapseBarActive || this._collapseMode) return;

        this._collapseBarActive = true;
        this._collapseBarStart  = this.time.now;
        this._collapseBarDur    = 4000; // 4s to accumulate orbs
        this._collapseOrbs      = [];
        this._collapseOrbsReady = false;
        this._collapseDecaying  = false;
        this._singTilesAtCollapse = this._singTilesTraversed || 0;

        this.showStatusText(this.player.x, this.player.y - 36, '◉ COLLAPSE', '#cc44ff');
        this.cameras.main.shake(30, 0.002);
    }

    updateCollapseMode(delta) {
        if (!this._collapseBarActive && !this._collapseDecaying) {
            this._updateLaunchingOrbs(delta);
            return;
        }
        const now = this.time.now;
        const TS  = this.TILE_SIZE;
        const px  = this.player.x, py = this.player.y;
        const MAX_ORBS_UNUSED = 0; // no cap — collect as many as you can

        // ── BAR FILL PHASE ─────────────────────────────────────────────
        if (this._collapseBarActive && !this._collapseDecaying) {
            const elapsed = now - this._collapseBarStart;
            const pct = Math.min(elapsed / this._collapseBarDur, 1);

            // Grant orb for each new tile walked since collapse started
            const newTiles = (this._singTilesTraversed || 0) - (this._singTilesAtCollapse || 0);
            while ((this._collapseOrbs?.length || 0) < newTiles) {
                this._spawnCollapseOrb();
            }

            // Update orb bar visuals
            this._updateCollapseBar(pct);

            // Update orbiting orbs
            this._orbitCollapseOrbs(delta, px, py);
            this._collapseOrbDamage();
            this._collapseOrbBlockProjectiles();

            // Bar full → switch to decay + launch phase
            if (pct >= 1) {
                this._collapseBarActive = false;
                this._collapseDecaying  = true;
                this._collapseDecayStart = now;
                this._collapseDecayDur   = 3000; // 3s to launch before orbs dissipate
            }
            return;
        }

        // ── DECAY / LAUNCH PHASE ──────────────────────────────────────
        if (this._collapseDecaying) {
            const decayPct = 1 - Math.min((now - this._collapseDecayStart) / this._collapseDecayDur, 1);
            this._updateCollapseBar(decayPct);
            this._orbitCollapseOrbs(delta, px, py);
            this._collapseOrbDamage();
            this._collapseOrbBlockProjectiles();

            // Draw target cursor on mouse
            this._drawCollapseCursor();

            if (decayPct <= 0) {
                // Time out — dissipate orbs
                this._dissipateCollapseOrbs();
                this._endCollapseMode();
            }
        }
    }

    _spawnCollapseOrb() {
        const orb = this.add.graphics().setDepth(4.2);
        const R = 8;
        // Outer dark void shell
        orb.fillStyle(0x000000, 1.0);       orb.fillCircle(0, 0, R);
        // Purple inner glow offset for depth
        orb.fillStyle(0x7700cc, 0.80);      orb.fillCircle(1, 1, R * 0.72);
        // Brighter core
        orb.fillStyle(0xaa33ff, 0.65);      orb.fillCircle(1, 1, R * 0.45);
        // Purple rim light on opposite dark edge
        orb.fillStyle(0xcc44ff, 0.30);      orb.fillCircle(-2, 2, R * 0.55);
        // Main specular highlight — bright white dot upper-left
        orb.fillStyle(0xffffff, 0.90);      orb.fillCircle(-3, -3, R * 0.22);
        // Secondary softer highlight
        orb.fillStyle(0xeeccff, 0.45);      orb.fillCircle(-2, -2, R * 0.38);
        // Thin outline
        orb.lineStyle(1.5, 0xcc44ff, 0.70); orb.strokeCircle(0, 0, R);

        orb.x = this.player.x; orb.y = this.player.y;
        this._collapseOrbs.push({ gfx: orb });
    }

    _orbitCollapseOrbs(delta, px, py) {
        if (!this._collapseOrbs?.length) return;
        // Single shared angle — all orbs orbit at exactly the same speed
        if (this._collapseOrbAngle === undefined) this._collapseOrbAngle = 0;
        this._collapseOrbAngle += 2.5 * delta * 0.001;

        const count = this._collapseOrbs.length;
        const ORBIT_R = 30 + count * 2.8;
        for (let i = 0; i < count; i++) {
            const orb = this._collapseOrbs[i];
            if (!orb.gfx?.active) continue;
            // Evenly spaced — each orb gets a fixed slice of the circle
            const a = this._collapseOrbAngle + (i / count) * Math.PI * 2;
            orb.gfx.x = px + Math.cos(a) * ORBIT_R;
            orb.gfx.y = py + Math.sin(a) * ORBIT_R;
        }
    }

    _collapseOrbDamage() {
        if (!this._collapseOrbs?.length) return;
        const now = this.time.now;
        if (now - (this._collapseOrbLastDmg || 0) < 120) return;
        this._collapseOrbLastDmg = now;
        for (const orb of this._collapseOrbs) {
            if (!orb.gfx?.active) continue;
            for (const enemy of [...this.enemies]) {
                if (this._phasedOut?.(enemy)) continue;
                if (!enemy.sprite?.active) continue;
                if (Math.hypot(enemy.sprite.x - orb.gfx.x, enemy.sprite.y - orb.gfx.y) < 14) {
                    this.damageEnemy(enemy, 5 * this.damageScaling);
                }
            }
        }
    }

    _collapseOrbBlockProjectiles() {
        if (!this._collapseOrbs?.length || !this.enemyProjectiles?.length) return;
        for (let i = this.enemyProjectiles.length - 1; i >= 0; i--) {
            const p = this.enemyProjectiles[i];
            if (!p.gfx?.active) continue;
            for (const orb of this._collapseOrbs) {
                if (!orb.gfx?.active) continue;
                if (Math.hypot(p.gfx.x - orb.gfx.x, p.gfx.y - orb.gfx.y) < 14) {
                    // Block — pop the projectile
                    const pop = this.add.graphics().setDepth(4);
                    pop.x = p.gfx.x; pop.y = p.gfx.y;
                    pop.fillStyle(0xcc44ff, 0.75); pop.fillCircle(0, 0, 8);
                    this.tweens.add({ targets: pop, scaleX: 2, scaleY: 2, alpha: 0, duration: 150, onComplete: () => pop.destroy() });
                    if (p.gfx.active) p.gfx.destroy();
                    this.enemyProjectiles.splice(i, 1);
                    break;
                }
            }
        }
    }

    _drawCollapseCursor() {
        if (!this._collapseDecaying) return;
        if (!this._collapseCursorGfx?.active) {
            this._collapseCursorGfx = this.add.graphics().setDepth(6);   // in the world (it used to be pinned, at zoom 1)
        }
        const g = this._collapseCursorGfx;
        g.clear();
        const mx = this.pointerX + this.cameras.main.scrollX, my = this.pointerY + this.cameras.main.scrollY;
        const R = 16;
        // Crosshair
        g.lineStyle(2, 0xcc44ff, 0.90);
        g.strokeCircle(mx, my, R);
        g.beginPath(); g.moveTo(mx - R - 6, my); g.lineTo(mx + R + 6, my); g.strokePath();
        g.beginPath(); g.moveTo(mx, my - R - 6); g.lineTo(mx, my + R + 6); g.strokePath();
        // Pulsing fill
        g.fillStyle(0x9900ff, 0.18 + 0.12 * Math.sin(this.time.now * 0.008));
        g.fillCircle(mx, my, R);
    }

    // ── Singularity Orb passive charge bar ───────────────────────────────────
    // Charges to 1.0 over 40s passively; each tile walked credits 0.5s toward the
    // charge. Bar shows above the player while singularity_staff is equipped on
    // cosmic element. When full, pulses to signal "press R". Resets after firing.
    updateSingOrbCharge(delta) {
        if (this._csCast) { this._destroySingOrbBar(); return; }   // Cosmic.js: the old orb is retired
        if (this.currentElement !== 'cosmic') return;
        if ((this.equippedWeapons?.cosmic || 'cosmic_fists') !== 'singularity_staff') {
            this._destroySingOrbBar(); return;
        }
        const FULL_TIME = 40000; // ms to reach full charge from rest
        const TILE_CREDIT = 0.5 / 40; // each tile moved adds 0.5s → 0.5/40 = 0.0125 of full bar

        if (this._singOrbCharge === undefined) {
            this._singOrbCharge = 0;
            this._singOrbTilesAtLastCheck = this._singTilesTraversed || 0;
        }

        // Tile-movement credit
        const newTiles = Math.max(0, (this._singTilesTraversed || 0) - (this._singOrbTilesAtLastCheck || 0));
        if (newTiles > 0) {
            this._singOrbTilesAtLastCheck = this._singTilesTraversed || 0;
            this._singOrbCharge = Math.min(1, (this._singOrbCharge || 0) + newTiles * TILE_CREDIT);
        }

        // Passive time charge
        if ((this._singOrbCharge || 0) < 1) {
            this._singOrbCharge = Math.min(1, (this._singOrbCharge || 0) + delta / FULL_TIME);
        }

        this._updateSingOrbBar();
    }

    _updateSingOrbBar() {
        if (!this.player?.active) return;
        const pct = Math.min(1, this._singOrbCharge || 0);
        const BAR_W = 36, BAR_H = 5;
        const bx = this.player.x - BAR_W / 2;
        const by = this.player.y - 42;

        if (!this._singOrbBarGfx?.active) {
            this._singOrbBarGfx = this.add.graphics().setDepth(6.5).setScrollFactor(1);
        }

        const g = this._singOrbBarGfx;
        g.clear();
        g.x = 0; g.y = 0;

        const isFull = pct >= 1;
        UIKit.rBar(g, bx + 4, by, BAR_W, pct, { col: 0xb04aff, hot: 0xe8c0ff, dark: 0x110022, time: this.time.now });

        // "READY" label when full
        if (isFull) {
            if (!this._singOrbReadyText?.active) {
                this._singOrbReadyText = this.add.text(this.player.x, by - 8, 'R  ORB READY', {
                    fontSize: '9px', fontFamily: UIKit.FONT.title, fontStyle: 'bold', color: '#e0a8ff', resolution: 2,
                    stroke: '#000', strokeThickness: 2
                }).setOrigin(0.5, 1).setDepth(6.6).setScrollFactor(1);
            }
            this._singOrbReadyText.x = this.player.x;
            this._singOrbReadyText.y = by - 1;
            const ta = 0.6 + 0.4 * Math.sin(this.time.now * 0.008);
            this._singOrbReadyText.setAlpha(ta);
        } else {
            if (this._singOrbReadyText?.active) {
                this._singOrbReadyText.destroy(); this._singOrbReadyText = null;
            }
        }
    }

    _destroySingOrbBar() {
        if (this._singOrbBarGfx?.active) { this._singOrbBarGfx.destroy(); this._singOrbBarGfx = null; }
        if (this._singOrbReadyText?.active) { this._singOrbReadyText.destroy(); this._singOrbReadyText = null; }
    }

    singularityCollapseRelease(targetX, targetY) {
        if (!this._collapseDecaying || !this._collapseOrbs?.length) return;

        const worldX = targetX + this.cameras.main.scrollX;
        const worldY = targetY + this.cameras.main.scrollY;
        const orbCount = this._collapseOrbs.length;
        const DMG = 18 * this.damageScaling;

        if (!this._launchingOrbs) this._launchingOrbs = [];

        for (const orb of this._collapseOrbs) {
            if (!orb.gfx?.active) continue;
            this._launchingOrbs.push({
                gfx:        orb.gfx,
                vx:         0,
                vy:         0,
                targetX:    worldX,
                targetY:    worldY,
                damage:     DMG,
                hitEnemies: new Set(),
                homeAccel:  1200,
            });
        }

        this.cameras.main.shake(60, 0.005);
        if (orbCount > 0) this.showStatusText(this.player.x, this.player.y - 32, `${orbCount} ORBS LAUNCHED`, '#cc44ff');
        this._collapseOrbs = [];
        this._endCollapseMode();
    }

    _updateLaunchingOrbs(delta) {
        if (!this._launchingOrbs?.length) return;
        const ds = delta / 1000;
        const TS = this.TILE_SIZE;

        for (let i = this._launchingOrbs.length - 1; i >= 0; i--) {
            const o = this._launchingOrbs[i];
            if (!o.gfx?.active) { this._launchingOrbs.splice(i, 1); continue; }

            // Steer toward target
            const dx = o.targetX - o.gfx.x;
            const dy = o.targetY - o.gfx.y;
            const dist = Math.hypot(dx, dy);
            if (dist > 4) {
                const dlen = dist;
                o.vx += (dx / dlen) * o.homeAccel * ds;
                o.vy += (dy / dlen) * o.homeAccel * ds;
                // Cap speed at 600 px/s
                const spd = Math.hypot(o.vx, o.vy);
                if (spd > 600) { o.vx = (o.vx / spd) * 600; o.vy = (o.vy / spd) * 600; }
            }

            o.gfx.x += o.vx * ds;
            o.gfx.y += o.vy * ds;

            // Pierce damage — hit any enemy in range that hasn't been hit yet
            for (const enemy of [...this.enemies]) {
                if (this._phasedOut?.(enemy)) continue;
                if (!enemy.sprite?.active) continue;
                if (o.hitEnemies.has(enemy)) continue;
                if (Math.hypot(enemy.sprite.x - o.gfx.x, enemy.sprite.y - o.gfx.y) < TS * 0.6) {
                    this.damageEnemy(enemy, o.damage);
                    o.hitEnemies.add(enemy);
                    // Hit flash
                    const hf = this.add.graphics().setDepth(5);
                    hf.x = enemy.sprite.x; hf.y = enemy.sprite.y;
                    hf.fillStyle(0xcc44ff, 0.65); hf.fillCircle(0, 0, 10);
                    this.tweens.add({ targets: hf, scaleX: 1.8, scaleY: 1.8, alpha: 0, duration: 160, onComplete: () => hf.destroy() });
                }
            }

            // Hit wall or reached target
            const tx = Math.floor(o.gfx.x / TS), ty = Math.floor(o.gfx.y / TS);
            const oob = tx < 0 || tx >= this.WORLD_WIDTH || ty < 0 || ty >= this.WORLD_HEIGHT;
            const hitWall = oob || this.world[tx]?.[ty] === this.WALL || this.world[tx]?.[ty] === this.NOTHING;
            const atTarget = dist < TS * 0.5;

            if (hitWall || atTarget) {
                // Impact burst
                const imp = this.add.graphics().setDepth(5);
                imp.x = o.gfx.x; imp.y = o.gfx.y;
                imp.fillStyle(0x000000, 0.80); imp.fillCircle(0, 0, 14);
                imp.fillStyle(0x9900ff, 0.65); imp.fillCircle(0, 0, 10);
                imp.fillStyle(0xffffff, 0.85); imp.fillCircle(0, 0, 4);
                imp.lineStyle(2, 0xcc44ff, 0.90); imp.strokeCircle(0, 0, 14);
                this.tweens.add({ targets: imp, scaleX: 2.2, scaleY: 2.2, alpha: 0, duration: 250, ease: 'Quad.easeOut', onComplete: () => imp.destroy() });
                this.damageBossAtTile(tx, ty, o.damage);
                o.gfx.destroy();
                this._launchingOrbs.splice(i, 1);
            }
        }
    }

    _dissipateCollapseOrbs() {
        for (const orb of (this._collapseOrbs || [])) {
            if (!orb.gfx?.active) continue;
            this.tweens.add({ targets: orb.gfx, scaleX: 0, scaleY: 0, alpha: 0, duration: 200, onComplete: () => orb.gfx.destroy() });
        }
    }

    _endCollapseMode() {
        this._collapseBarActive = false;
        this._collapseDecaying  = false;
        this._collapseOrbs      = [];
        this._collapseOrbAngle  = 0;
        if (this._collapseCursorGfx?.active) { this._collapseCursorGfx.destroy(); this._collapseCursorGfx = null; }
        if (this._collapseBarGfx?.active)    { this._collapseBarGfx.destroy();    this._collapseBarGfx    = null; }
    }

    _updateCollapseBar(pct) {
        // Circle arc on the floor around the player slime.
        // Charge phase (pct 0→1): arc fills clockwise from top.
        // Decay phase (pct 1→0): full ring drains counterclockwise from top.
        if (!this._collapseBarGfx?.active) {
            this._collapseBarGfx = this.add.graphics().setDepth(1.2).setScrollFactor(1);
        }
        const g = this._collapseBarGfx;
        g.clear();

        const cx = this.player.x, cy = this.player.y + 6; // slightly below center, on floor
        const R = 14, THICK = 3;
        const START = -Math.PI / 2; // 12 o'clock

        // Ghost ring — always drawn at full alpha to show the total circumference
        g.lineStyle(THICK, 0x440066, 0.35);
        g.beginPath(); g.arc(cx, cy, R, 0, Math.PI * 2, false); g.strokePath();

        if (pct <= 0) return;

        // Filled arc — color shifts from purple (charging) to bright pink (decay)
        const isDying = this._collapseDecaying;
        const arcColor = isDying ? 0xff66ff : 0xcc44ff;
        const arcAlpha = isDying ? (0.8 + 0.2 * Math.sin(this.time.now * 0.015)) : 0.95;
        g.lineStyle(THICK + 1, arcColor, arcAlpha);
        g.beginPath();
        g.arc(cx, cy, R, START, START + Math.PI * 2 * pct, false);
        g.strokePath();

        // Small bright leading dot at the arc tip
        const tipAngle = START + Math.PI * 2 * pct;
        const tipX = cx + Math.cos(tipAngle) * R;
        const tipY = cy + Math.sin(tipAngle) * R;
        g.fillStyle(0xffffff, arcAlpha * 0.9);
        g.fillCircle(tipX, tipY, THICK - 0.5);
    }

}
