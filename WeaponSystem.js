// ═══════════════════════════════════════════════════════════════════════
// WEAPONSYSTEM.JS — All player weapons and projectiles (fire, ice shards, fireballs)
// ═══════════════════════════════════════════════════════════════════════
// All methods receive GameScene as `this` via .call(scene, ...) from GameScene.js
// Do NOT add local state here — all state lives on the scene object.

// NOTE ON ENEMY ITERATION
// Loops that can kill iterate `[...this.enemies]`, never `this.enemies` directly.
// damageEnemy -> killEnemy SPLICES this.enemies, and a live for...of over a spliced
// array skips the element after each removal — so an AoE that kills its first target
// silently spares every second enemy in range. Measured: 3 of 6 killed instead of 6.
// The spread makes a snapshot; dead entries are filtered by the `sprite?.active`
// guards each body already has. `(this.enemies||[])` is a nullish guard, NOT a copy.

class WeaponSystem {

    shootAttack(targetX, targetY) {
        if (this.currentElement === 'lightning') return;
        if (this.nodeChannelActive) this.cancelNodeChannel();

        const currentTime = this.time.now;

        const worldX = targetX + this.cameras.main.scrollX;
        const worldY = targetY + this.cameras.main.scrollY;
        const playerPixelX = this.playerX * this.TILE_SIZE + this.TILE_SIZE / 2;
        const playerPixelY = this.playerY * this.TILE_SIZE + this.TILE_SIZE / 2;

        const dx = worldX - playerPixelX;
        const dy = worldY - playerPixelY;
        const distanceInTiles = Math.sqrt(dx * dx + dy * dy) / this.TILE_SIZE;

        const maxRange = this.currentElement === 'fire' ? this.fireballMaxRange : 30;
        if (distanceInTiles > maxRange) return;

        let baseCooldown;
        if (this.currentElement === 'fire') {
            baseCooldown = this.fireballCooldown;
        } else if (this.currentElement === 'ice') {
            baseCooldown = this.iceballCooldown;
        }

        const effectiveCooldown = baseCooldown / this.attackSpeedMultiplier;
        if (currentTime - this.lastFireballTime < effectiveCooldown) return;

        if (this.currentElement === 'fire') {
            this.shootFireball(targetX, targetY);
        } else if (this.currentElement === 'ice') {
            this.shootIceShard(targetX, targetY);
        }

        this.lastFireballTime = currentTime;
    }

    // The Magma Staff's shot: a 14px lump of lava rock, its crust dark, cracks running through
    // it that glow orange to yellow and shift as it tumbles (4 frames). Drawn with the shop's
    // pixel helper, so it gets the same outline as every other icon.
    // Magma Staff's rocks: VARIANTS lumpy asteroids (each its own seeded outline, craters and
    // seams), magma glowing in the seams and bulging out where they reach the edge.
    static magmaRockKey(scene, v = 0) {
        const key = 'wpn_magma_rock_' + v;
        if (typeof ShopScene === 'undefined' || !ShopScene.icon) return key;
        return ShopScene.icon(scene, key, 18, { k: '#1a0703', c: '#6a2a14', d: '#40180a', h: '#8a4424', o: '#ff6a1a', y: '#ffd24a', w: '#fff3c0', g: '#ff8a2a', r: '#c8320e' }, (m, f) => {
            let seed = 7919 * (v + 1);
            const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
            const ph = [rnd() * 6.28, rnd() * 6.28, rnd() * 6.28], am = [0.4 + rnd() * 0.6, 0.2 + rnd() * 0.4, 0.1 + rnd() * 0.25];
            const R = th => 6.2 + am[0] * Math.sin(2 * th + ph[0]) + am[1] * Math.sin(3 * th + ph[1]) + am[2] * Math.sin(5 * th + ph[2]);
            const out = [], inner = [];
            for (let i = 0; i < 16; i++) { const th = i / 16 * Math.PI * 2, r = R(th); out.push([9 + Math.cos(th) * r, 9 + Math.sin(th) * r]); inner.push([8.4 + Math.cos(th) * r * 0.72, 8.4 + Math.sin(th) * r * 0.72]); }
            m.poly(out, 'd'); m.poly(inner, 'c');
            for (let i = 0; i < 2; i++) { const a = rnd() * 6.28, d = rnd() * 3; m.disc(9 + Math.cos(a) * d, 9 + Math.sin(a) * d, 1.2, 'd'); m.set(9 + Math.cos(a) * d - 1, 9 + Math.sin(a) * d - 1, 'h'); }
            // seams: a wandering crack from near the core out past the crust, glow flowing outward
            const seams = 2 + (v % 2);
            for (let sI = 0; sI < seams; sI++) {
                let a = rnd() * 6.28, x = 9 + Math.cos(a), y = 9 + Math.sin(a);
                const len = R(a) + 0.5, steps = Math.ceil(len);
                for (let k = 0; k < steps; k++) {
                    a += (rnd() - 0.5) * 0.9;
                    const nx = x + Math.cos(a), ny = y + Math.sin(a);
                    m.line(x + 0.6, y + 0.6, nx + 0.6, ny + 0.6, 'r');   // the seam's glowing lip
                    m.line(x, y, nx, ny, (k + f) % 4 === 0 ? 'y' : 'o');
                    x = nx; y = ny;
                }
                // the ooze: a blob of magma swelling out of the seam's end, then sagging back
                const sw = [0.8, 1.3, 1.7, 1.2][f];
                m.disc(x + 0.5, y + 0.5, sw, 'o'); m.set(x, y, 'y');
            }
            m.disc(9, 9, 2.2, 'o'); m.disc(9, 9, 1.4, 'y'); m.set(9, 9, 'w');
            for (let i = 0; i < 6; i++) { const th = 3.4 + i * 0.22, r = R(th) - 0.8; m.set(9 + Math.cos(th) * r, 9 + Math.sin(th) * r, 'h'); }   // a lit edge on the crust
        }, 4);
    }
    static MAGMA_VARIANTS = 4;
    static SURGE_MIN_HEAT = 18;   // Magma Surge needs at least this much heat (the staff's tier 2)

    // Orb Emitter's orb: a caged plasma globe (24px, 8 frames). Dark glass, a hot core whose
    // tendrils writhe out to touch the glass, and a brass cage turning round it in 3D.
    static orbEmitterKey(scene) {
        const key = 'wpn_tesla_orb';
        if (typeof ShopScene === 'undefined' || !ShopScene.icon) return key;
        return ShopScene.icon(scene, key, 24, { k: '#120e1c', n: '#161d3a', m: '#26386e', c: '#5ad8ff', C: '#c8f8ff', y: '#ffe04a', Y: '#fff6b0', w: '#ffffff', b: '#5a4020', B: '#e8b44a', h: '#fff0b0', g: '#fffbe0' }, (m, f) => {
            const O = 12, R = 8.4, tilt = 0.45, spin = f / 8 * Math.PI / 2;   // the cage turns a quarter (its symmetry) per loop
            // a point on the sphere (latitude t, longitude p) seen from a little above: [x, y, front]
            const at = (t, p, r) => {
                const x = r * Math.cos(t) * Math.sin(p), y = r * Math.sin(t), z = r * Math.cos(t) * Math.cos(p);
                return [O + x, O + y * Math.cos(tilt) - z * Math.sin(tilt), y * Math.sin(tilt) + z * Math.cos(tilt) > 0];
            };
            const cage = front => {
                for (let k = 0; k < 120; k++) {
                    const s = k / 120 * Math.PI * 2;
                    for (const [x, y, fr] of [at(0, s, R + 0.9), at(s, spin, R + 0.9), at(s, spin + Math.PI / 2, R + 0.9)])
                        if (fr === front) m.set(x, y, front ? (x < O - 2 && y < O ? 'h' : 'B') : 'b');
                }
            };
            m.disc(O, O, R, 'n'); m.disc(O - 1.6, O - 1.8, R - 2.6, 'm');   // the glass, lit from the top left
            for (let i = 0; i < 4; i++) {                                     // tendrils, touching the glass where they end
                const a = i * Math.PI / 2 + f * 0.4 + 0.5 * Math.sin(f * 1.3 + i * 2);
                let x = O + Math.cos(a) * 2, y = O + Math.sin(a) * 2;
                for (let st = 0; st < 4; st++) {
                    const r = 2 + (R - 2.8) * (st + 1) / 4, b = a + 0.45 * Math.sin(f * 2.1 + i * 3 + st * 1.9);
                    const nx = O + Math.cos(b) * r, ny = O + Math.sin(b) * r;
                    m.line(x, y, nx, ny, st < 2 ? 'C' : 'c'); x = nx; y = ny;
                }
                m.disc(x + 0.5, y + 0.5, 1.1, 'C'); m.set(x, y, 'w');
            }
            const pr = [2.6, 2.9, 3.2, 2.9][f % 4];                           // the core breathes
            m.disc(O, O, pr, 'y'); m.disc(O, O, pr - 1, 'Y'); m.rect(O - 1, O - 1, 2, 2, 'w');
            cage(true);
            for (const t of [-Math.PI / 2, Math.PI / 2]) { const [x, y] = at(t, 0, R + 1.4); m.rect(x - 1, y - 1, 3, 2, 'B'); m.set(x, y - 1, 'h'); }   // the pole caps
            m.set(O - 4, O - 5, 'w'); m.set(O - 5, O - 4, 'w'); m.set(O - 3, O - 5, 'C');   // a glint on the glass
            if (f % 3 === 0) { const a = f * 0.8; m.set(O + Math.cos(a) * 11, O + Math.sin(a) * 11, 'g'); }
        }, 8);
    }
    // Ball Lightning: a roiling plasma ball (32px, 8 frames). A rim that won't hold still, bright
    // cells rolling over it, a white-hot core, and bolts leaping off the edge.
    static ballLightningKey(scene) {
        const key = 'wpn_ball_lightning';
        if (typeof ShopScene === 'undefined' || !ShopScene.icon) return key;
        return ShopScene.icon(scene, key, 32, { k: '#0a0a24', v: '#3b2c9a', b: '#3d7bff', c: '#5ae6ff', C: '#c8fbff', w: '#ffffff', y: '#fff08a', g: '#e8fbff' }, (m, f) => {
            const O = 16, ph = f / 8 * Math.PI * 2;
            const R = th => 10 + 0.9 * Math.sin(3 * th + ph) + 0.6 * Math.sin(5 * th - 2 * ph) + 0.4 * Math.sin(7 * th + 3 * ph);
            const shell = (k, c) => { const pts = []; for (let i = 0; i < 32; i++) { const th = i / 32 * Math.PI * 2; pts.push([O + Math.cos(th) * R(th) * k, O + Math.sin(th) * R(th) * k]); } m.poly(pts, c); };
            shell(1, 'v'); shell(0.84, 'b'); shell(0.64, 'c');
            for (let i = 0; i < 12; i++) { const th = 3.5 + i * 0.13, r = R(th) * 0.84 - 0.6; m.set(O + Math.cos(th) * r, O + Math.sin(th) * r, 'c'); }   // lit from the top left
            for (let i = 0; i < 5; i++) {                                     // convection: bright cells rolling over the surface
                const a = i * 1.2566 + ph * (i % 2 ? 1 : -0.7), d = 4.5 + 1.5 * Math.sin(ph * 2 + i);
                m.disc(O + Math.cos(a) * d, O + Math.sin(a) * d, 1.6, 'C');
            }
            for (let i = 0; i < 3; i++) {                                     // and dark veins between them
                let a = i * 2.09 + ph * 0.5, x = O + Math.cos(a) * 3, y = O + Math.sin(a) * 3;
                for (let st = 0; st < 3; st++) { a += Math.sin(ph * 3 + i + st) * 0.8; const nx = x + Math.cos(a) * 2.2, ny = y + Math.sin(a) * 2.2; m.line(x, y, nx, ny, 'b'); x = nx; y = ny; }
            }
            const cr = 2.6 + 0.6 * Math.sin(ph * 2);
            m.disc(O, O, cr + 1.3, 'y'); m.disc(O, O, cr, 'w');
            for (let i = 0; i < 3; i++) {                                     // bolts off the rim ('g': no outline, so they stay thin)
                const a = ((f * 5 + i * 11) % 16) / 16 * Math.PI * 2;
                let r = R(a) - 1, x = O + Math.cos(a) * r, y = O + Math.sin(a) * r;
                for (let st = 0; st < 3; st++) { const b = a + ((f * 7 + i * 3 + st * 5) % 5 - 2) * 0.22; r += 1.8; const nx = O + Math.cos(b) * r, ny = O + Math.sin(b) * r; m.line(x, y, nx, ny, 'g'); x = nx; y = ny; }
            }
        }, 8);
    }
    // The superconduct mark the orb leaves: a little bolt in a ring.
    static superconductKey(scene) {
        const key = 'wpn_superconduct';
        if (typeof ShopScene === 'undefined' || !ShopScene.icon) return key;
        return ShopScene.icon(scene, key, 11, { y: '#ffe04a', w: '#fff8c0', c: '#aef4ff' }, (m) => {
            m.ring(5.5, 5.5, 5.4, 1, 'c');
            m.poly([[6, 1.5], [3, 6], [5.2, 6], [4.4, 9.5], [8, 4.6], [5.8, 4.6], [6.8, 1.5]], 'y');
            m.set(5, 4, 'w'); m.set(5, 6, 'w');
        });
    }

    fireEquippedWeapon(targetX, targetY) {
        if (this.fractureCore?.state === 'rhythm') return;   // LevelManager: the Fracture Core's rhythm has the mouse
        if (this._iceShellUntil > this.time.now) return;   // encased in ice (the ice ult's end)
        if (this._barrageOn && this.ignitionActive && this.currentElement === 'fire') return this._meteorBarrage?.(targetX, targetY);   // the fire ult's Meteor Barrage
        const weapon = this.equippedWeapons?.[this.currentElement] || 'flame_fists';
        // Sound.js: each weapon's own sound, when it actually went off (every weapon stamps
        // _gearFiredAt as it fires; the cosmic casts stamp _cs.castAt)
        const _fired0 = this._gearFiredAt, _cast0 = this._cs?.castAt;
        try { switch (weapon) {
            case 'flame_sword':     this.flameSwordAttack(targetX, targetY); break;
            case 'magma_staff':     this.magmaStaffAttack(targetX, targetY); break;
            case 'ignition':        this.kindlingBrandAttack(targetX, targetY); break;
            case 'ice_fists':       this.iceFistsAttack(targetX, targetY); break;
            case 'icicle_cannon':   this.icicleStaffAttack(targetX, targetY); break;
            case 'fractal_shard':   this.fractalShardAttack(targetX, targetY); break;
            case 'lightning_fists': this.lightningFistsAttack(targetX, targetY); break;
            case 'orb_emitter':     this.orbEmitterAttack(targetX, targetY); break;
            case 'ball_lightning': this.ballLightningAttack(targetX, targetY); break;
            case 'conductor':      this.conductorAttack(targetX, targetY); break;
            // Unreachable in the overworld -- no shop card, no equip path. Kept because
            // TowerDefenseScene sets this id and routes its Wrench upgrade tree through it.
            case 'engineering_degree': this.engineeringDegreeAttack(targetX, targetY); break;
            // Cosmic.js casts all five (each one a boon); the old two stay for a scene without it.
            case 'cosmic_fists': case 'barrier_staff': case 'astrolabe': case 'singularity_staff': case 'void_blade':
                if (this._csCast) { this._csCast?.(weapon, targetX, targetY); break; }
                if (weapon === 'singularity_staff') this.singularityStaffFire(targetX, targetY);
                else this.cosmicFistsAttack(targetX, targetY);
                break;
            case 'flame_fists': default: this.flameFistsAttack(targetX, targetY); break;
        } } finally {
            if (this._gearFiredAt !== _fired0 || this._cs?.castAt !== _cast0) Sfx.play(this, 'w_' + weapon);
        }
    }

    flameFistsAttack(targetX, targetY) {
        const currentTime = this.time.now;
        if (currentTime - (this.lastFlameFistsTime || 0) < 600 * WeaponLevels.cdMult('flame_fists')) return;
        this.lastFlameFistsTime = currentTime;
        this._gearFiredAt = currentTime;   // the held weapon swings now (Creatures.gear)

        const worldX = targetX + this.cameras.main.scrollX;
        const worldY = targetY + this.cameras.main.scrollY;
        const playerPx = this.playerX * this.TILE_SIZE + this.TILE_SIZE / 2;
        const playerPy = this.playerY * this.TILE_SIZE + this.TILE_SIZE / 2;

        const dx = worldX - playerPx;
        const dy = worldY - playerPy;

        // Determine facing direction from mouse
        let facingX = 0, facingY = 0;
        if (Math.abs(dx) > Math.abs(dy)) {
            facingX = dx > 0 ? 1 : -1;
        } else {
            facingY = dy > 0 ? 1 : -1;
        }

        // 1x3 swipe: only the single row/column directly in front (range = 1 tile)
        const swipeTiles = [];
        if (facingX !== 0) {
            swipeTiles.push({ x: this.playerX + facingX, y: this.playerY });
        } else {
            swipeTiles.push({ x: this.playerX, y: this.playerY + facingY });
        }

        const damage = 15 * this.damageScaling;

        for (let tile of swipeTiles) {
            if (tile.x < 0 || tile.x >= this.WORLD_WIDTH || tile.y < 0 || tile.y >= this.WORLD_HEIGHT) continue;
            if (this.world[tile.x][tile.y] !== this.FLOOR) continue;
            if (!this.isInCurrentRoom(tile.x, tile.y)) continue;

            const px = tile.x * this.TILE_SIZE + this.TILE_SIZE / 2;
            const py = tile.y * this.TILE_SIZE + this.TILE_SIZE / 2;

            // Small swipe visual on the tile itself
            const swipeGfx = this.add.graphics().setDepth(3);
            swipeGfx.x = px;
            swipeGfx.y = py;
            swipeGfx.fillStyle(0xff4400, 0.7);
            swipeGfx.fillCircle(0, 0, this.TILE_SIZE * 0.4);
            this.tweens.add({ targets: swipeGfx, alpha: 0, scaleX: 1.3, scaleY: 1.3, duration: 180, onComplete: () => swipeGfx.destroy() });

            // Leave a single lava tile (spawn ignition trail directly, no 3x3 spread)
            this.spawnIgnitionTrail(px, py);
            this._evaporate(tile.x, tile.y, 6);          // one-shots a puddle

            // Hit portal if on this tile
            const portal = this.getPortalAt(tile.x, tile.y);
            if (portal) this.damagePortal(portal, damage);
            if (this.damageBossAtTile(tile.x, tile.y, damage)) {
                if (typeof this.applyBurnStackBoss === 'function') this.applyBurnStackBoss();
            }

            // Damage enemies on that tile
            for (const enemy of [...this.enemies]) {
                if (this._phasedOut?.(enemy)) continue;
                if (enemy.x !== tile.x || enemy.y !== tile.y) continue;
                // Route through damageEnemy rather than writing enemy.health directly.
                // The inline version re-implemented immunity as three hard bail-outs, so
                // ElementResist never ran for this weapon -- and it silently excluded
                // fire from every cross-element bonus damageEnemy applies: the 2.5x
                // shatter on a frozen target, purple marks, tsunami, absorber toughness.
                // damageEnemy also owns the damage number, the IMMUNE label, the health
                // bar, the ult charge and the kill, so all of that comes back for free.
                this.damageEnemy(enemy, damage, 'fire');
                // Burn is fire's escape hatch and is applied even when the direct hit was
                // refused -- burn and lava are the only way to hurt a fire elemental.
                // applyBurnStack bails on iceImmune itself, so ice elementals stay clean.
                if (typeof this.applyBurnStack === 'function') this.applyBurnStack(enemy);
            }
        }

        this.cameras.main.shake(50, 0.002);
    }

    iceFistsAttack(targetX, targetY) {
        const currentTime = this.time.now;
        if (currentTime - (this.lastIceFistsTime || 0) < 500 * WeaponLevels.cdMult('ice_fists')) return;
        this.lastIceFistsTime = currentTime;
        this._gearFiredAt = currentTime;   // the held weapon swings now (Creatures.gear)

        const worldX = targetX + this.cameras.main.scrollX;
        const worldY = targetY + this.cameras.main.scrollY;
        const playerPx = this.playerX * this.TILE_SIZE + this.TILE_SIZE / 2;
        const playerPy = this.playerY * this.TILE_SIZE + this.TILE_SIZE / 2;
        const dx = worldX - playerPx, dy = worldY - playerPy;

        let facingX = 0, facingY = 0;
        if (Math.abs(dx) > Math.abs(dy)) { facingX = dx > 0 ? 1 : -1; }
        else { facingY = dy > 0 ? 1 : -1; }

        const tile = { x: this.playerX + facingX, y: this.playerY + facingY };
        if (tile.x < 0 || tile.x >= this.WORLD_WIDTH || tile.y < 0 || tile.y >= this.WORLD_HEIGHT) return;
        if (this.world[tile.x][tile.y] !== this.FLOOR) return;
        if (!this.isInCurrentRoom(tile.x, tile.y)) return;

        const px = tile.x * this.TILE_SIZE + this.TILE_SIZE / 2;
        const py = tile.y * this.TILE_SIZE + this.TILE_SIZE / 2;

        // Ice tile visual — full tile blue flash, fades out (no persistent tile)
        const iceFlash = this.add.graphics().setDepth(1.5);
        iceFlash.fillStyle(0x44aaff, 0.7);
        iceFlash.fillRect(
            tile.x * this.TILE_SIZE, tile.y * this.TILE_SIZE,
            this.TILE_SIZE, this.TILE_SIZE
        );
        iceFlash.fillStyle(0xccffff, 0.45);
        iceFlash.fillRect(
            tile.x * this.TILE_SIZE + 3, tile.y * this.TILE_SIZE + 3,
            this.TILE_SIZE - 6, this.TILE_SIZE - 6
        );
        this.tweens.add({ targets: iceFlash, alpha: 0, duration: 300, onComplete: () => iceFlash.destroy() });

        for (const enemy of [...this.enemies]) {
            if (this._phasedOut?.(enemy)) continue;
            if (enemy.x !== tile.x || enemy.y !== tile.y) continue;
            this.applyIceFistsHit(enemy);
        }

        // Hit portal if on this tile
        const portalHit = this.getPortalAt(tile.x, tile.y);
        if (portalHit) this.damagePortal(portalHit, 5 * this.damageScaling);
        this.damageBossAtTile(tile.x, tile.y, 12 * this.damageScaling);

        this.cameras.main.shake(30, 0.001);
    }

    lightningFistsAttack(targetX, targetY) {
        const currentTime = this.time.now;
        if (currentTime - (this.lastLightningFistsTime || 0) < 500 * WeaponLevels.cdMult('lightning_fists')) return;
        this.lastLightningFistsTime = currentTime;
        this._gearFiredAt = currentTime;   // the held weapon swings now (Creatures.gear)

        const worldX = targetX + this.cameras.main.scrollX;
        const worldY = targetY + this.cameras.main.scrollY;
        const playerPx = this.playerX * this.TILE_SIZE + this.TILE_SIZE / 2;
        const playerPy = this.playerY * this.TILE_SIZE + this.TILE_SIZE / 2;
        const dx = worldX - playerPx, dy = worldY - playerPy;

        let facingX = 0, facingY = 0;
        if (Math.abs(dx) > Math.abs(dy)) facingX = dx > 0 ? 1 : -1;
        else facingY = dy > 0 ? 1 : -1;

        // ── Direct fist hit — 1 tile in front ────────────────────────────
        const tile = { x: this.playerX + facingX, y: this.playerY + facingY };
        const tileValid = tile.x >= 0 && tile.x < this.WORLD_WIDTH &&
                          tile.y >= 0 && tile.y < this.WORLD_HEIGHT &&
                          this.world[tile.x][tile.y] === this.FLOOR &&
                          this.isInCurrentRoom(tile.x, tile.y);

        if (!tileValid) return;

        const hitPx = tile.x * this.TILE_SIZE + this.TILE_SIZE / 2;
        const hitPy = tile.y * this.TILE_SIZE + this.TILE_SIZE / 2;

        // Yellow tile flash
        const flash = this.add.graphics().setDepth(1.5);
        flash.fillStyle(0xffff00, 0.55);
        flash.fillRect(tile.x * this.TILE_SIZE, tile.y * this.TILE_SIZE, this.TILE_SIZE, this.TILE_SIZE);
        this.tweens.add({ targets: flash, alpha: 0, duration: 200, onComplete: () => flash.destroy() });

        // Spark burst
        for (let i = 0; i < 4; i++) {
            const a = (Math.PI * 2 / 4) * i;
            const spark = this.add.graphics().setDepth(2);
            spark.lineStyle(1.5, 0xffff88, 0.9);
            spark.beginPath();
            spark.moveTo(hitPx, hitPy);
            spark.lineTo(hitPx + Math.cos(a) * (6 + Math.random() * 4), hitPy + Math.sin(a) * (6 + Math.random() * 4));
            spark.strokePath();
            this.tweens.add({ targets: spark, alpha: 0, duration: 150, onComplete: () => spark.destroy() });
        }

        // WET BONUS. Standing in water makes an enemy take more from lightning -- but it
        // does NOT grant extra chain targets. Those are two different levers and the chain
        // cap is about to be rebalanced for lightning's crowd identity; if water also fed
        // that number, tuning one would silently move the other.
        //
        // This const used to be declared 20 lines BELOW here, inside the chain-lightning
        // block, while the direct-hit line already read it -- a temporal dead zone. It
        // never surfaced because `_wet ? WET_BONUS : 1` short-circuits: on dry ground the
        // identifier is never evaluated. So Lightning Fists threw
        // "Cannot access 'WET_BONUS' before initialization" on exactly one input --
        // punching an enemy that is standing in water -- which is the normal case for
        // every room of The Cistern and nowhere else in the game.
        const WET_BONUS = 1.5;

        // Direct hit — routes through damageEnemy for immunity/room-gating/ult-charge
        const dmg = 14 * this.damageScaling;
        let hitEnemy = null;
        for (const enemy of [...this.enemies]) {
            if (this._phasedOut?.(enemy)) continue;
            if (enemy.x !== tile.x || enemy.y !== tile.y) continue;
            // A wet target conducts: more damage, same number of chain targets.
            const _wet = (typeof this.isWaterAt === 'function' && this.isWaterAt(enemy.x, enemy.y));
            this.damageEnemy(enemy, dmg * (_wet ? WET_BONUS : 1));
            // lightning bypasses damageEnemy charge skip; only for a hit that landed (it paid for refusals)
            if (this._dmgLanded) this.gainUltCharge(this.ultChargePerLightningHit);
            hitEnemy = enemy;
            // CONDUCTION. Punching a target that is standing in water pushes the current
            // through the whole connected pool, hitting everything sharing it regardless of
            // distance. This is the lever that makes lightning the crowd element on a wet
            // floor -- the chain hops below are capped and short-range, conduction is not.
            if (_wet && typeof this._energizePool === 'function') {
                this._energizePool(enemy.x, enemy.y, dmg);
            }
            break;
        }
        const portal = this.getPortalAt(tile.x, tile.y);
        if (portal) this.damagePortal(portal, dmg);
        this.damageBossAtTile(tile.x, tile.y, dmg);

        // ── Chain lightning — only fires if fist connected with an enemy ─
        // Finds up to 2 nearest enemies within 3 tiles of the hit tile (excluding
        // the struck enemy), bolts originate from the hit tile, damage falls off
        // 40% per hop.
        if (!hitEnemy) { this.cameras.main.shake(30, 0.001); return; }

        const CHAIN_RANGE = 3;   // tiles
        const CHAIN_FALLOFF = 0.6;

        // LIGHTNING'S CROWD IDENTITY. A flat 2 hops meant a duel and a nine-enemy room
        // played identically, which is the opposite of what lightning is supposed to be.
        // Scaling the cap off how many enemies are actually in reach makes it deliberately
        // worse than the other three elements against a single target and better than all
        // of them once a room fills up.
        //   crowd 0-1 -> 1 hop      4-5 -> 3 hops
        //   crowd 2-3 -> 2 hops     8+  -> 5 hops
        const crowd = this.enemies.filter(e => !this._phasedOut?.(e) && e.sprite?.active && e !== hitEnemy &&
            Math.abs(e.x - tile.x) + Math.abs(e.y - tile.y) <= CHAIN_RANGE + 2).length;
        const MAX_CHAINS = Math.min(5, 1 + Math.floor(crowd / 2));
        const chainDmg = dmg * CHAIN_FALLOFF;

        // Collect candidates sorted by distance from hit tile
        const candidates = this.enemies
            .filter(e => !this._phasedOut?.(e) && e !== hitEnemy && e.sprite?.active)
            .map(e => ({
                enemy: e,
                dist: Math.abs(e.x - tile.x) + Math.abs(e.y - tile.y)
            }))
            .filter(c => c.dist <= CHAIN_RANGE)
            .sort((a, b) => a.dist - b.dist)
            .slice(0, MAX_CHAINS);

        for (const { enemy: chainEnemy } of candidates) {
            this.drawLightningBolt({ sprite: { x: hitPx, y: hitPy } }, chainEnemy);
            const _cWet = (typeof this.isWaterAt === 'function' && this.isWaterAt(chainEnemy.x, chainEnemy.y));
            this.damageEnemy(chainEnemy, chainDmg * (_cWet ? WET_BONUS : 1));
            if (this._dmgLanded) this.gainUltCharge(this.ultChargePerLightningHit * 0.5); // chain hits give half charge
        }

        this.cameras.main.shake(30, 0.001);
    }

    // ══════════════════════════════════════════════════════════════════════
    // ORB EMITTER — bouncing electric orb, marks + forks lightning on hit
    // ══════════════════════════════════════════════════════════════════════
    cosmicFistsAttack(targetX, targetY) {
        const currentTime = this.time.now;
        if (currentTime - (this.lastCosmicFistsTime || 0) < 450) return;
        this.lastCosmicFistsTime = currentTime;

        const TS = this.TILE_SIZE;
        const worldX = targetX + this.cameras.main.scrollX;
        const worldY = targetY + this.cameras.main.scrollY;
        const playerPx = this.playerX * TS + TS / 2;
        const playerPy = this.playerY * TS + TS / 2;
        const dx = worldX - playerPx, dy = worldY - playerPy;

        let facingX = 0, facingY = 0;
        if (Math.abs(dx) > Math.abs(dy)) facingX = dx > 0 ? 1 : -1;
        else facingY = dy > 0 ? 1 : -1;

        const tile = { x: this.playerX + facingX, y: this.playerY + facingY };
        if (tile.x < 0 || tile.x >= this.WORLD_WIDTH || tile.y < 0 || tile.y >= this.WORLD_HEIGHT) return;
        if (this.world[tile.x][tile.y] !== this.FLOOR) return;
        if (!this.isInCurrentRoom(tile.x, tile.y)) return;

        // ── Momentum bonus — tiles dashed in the last 1.5s ──────────────
        const MOMENTUM_WINDOW = 3000; // ms
        const tilesTraversed = this._cosmicDashTilesLog
            ? this._cosmicDashTilesLog.filter(t => currentTime - t.time < MOMENTUM_WINDOW).length
            : 0;
        const momentumMult = 1.0 + tilesTraversed * 0.25; // +25% per dash tile, up to +75% at 3 tiles
        const BASE_DMG = 8 * this.damageScaling;
        const damage = BASE_DMG * momentumMult;
        const isEmpowered = tilesTraversed > 0;

        const hitPx = tile.x * TS + TS / 2;
        const hitPy = tile.y * TS + TS / 2;

        // ── Visuals ──────────────────────────────────────────────────────
        // Tile flash — deep purple with yellow-white core if empowered
        const flash = this.add.graphics().setDepth(1.5);
        flash.fillStyle(isEmpowered ? 0xffee88 : 0x9933cc, isEmpowered ? 0.60 : 0.55);
        flash.fillRect(tile.x * TS, tile.y * TS, TS, TS);
        if (isEmpowered) {
            flash.fillStyle(0xffffff, 0.30);
            flash.fillRect(tile.x * TS + 4, tile.y * TS + 4, TS - 8, TS - 8);
        }
        this.tweens.add({ targets: flash, alpha: 0, duration: 200, onComplete: () => flash.destroy() });

        // Impact burst — purple/gold swipe arc
        const burst = this.add.graphics().setDepth(3.2);
        burst.x = hitPx; burst.y = hitPy;
        const burstCol = isEmpowered ? 0xffe066 : 0xcc44ff;
        burst.fillStyle(burstCol, 0.75);
        burst.fillCircle(0, 0, TS * 0.38);
        burst.lineStyle(2, 0xffffff, 0.60);
        burst.strokeCircle(0, 0, TS * 0.38);
        this.tweens.add({ targets: burst, scaleX: 1.6, scaleY: 1.6, alpha: 0, duration: 220, ease: 'Quad.easeOut', onComplete: () => burst.destroy() });

        // Star sparks radiating outward — 6 lines
        for (let i = 0; i < 6; i++) {
            const a = (i / 6) * Math.PI * 2;
            const sp = this.add.graphics().setDepth(3.5);
            const sparkCol = i % 2 === 0 ? 0xcc44ff : 0xffe066;
            sp.lineStyle(isEmpowered ? 2.5 : 1.5, sparkCol, 0.90);
            sp.beginPath();
            const r1 = TS * 0.15, r2 = TS * (isEmpowered ? 0.55 : 0.40);
            sp.moveTo(Math.cos(a) * r1, Math.sin(a) * r1);
            sp.lineTo(Math.cos(a) * r2, Math.sin(a) * r2);
            sp.strokePath();
            sp.x = hitPx; sp.y = hitPy;
            this.tweens.add({ targets: sp, alpha: 0, duration: isEmpowered ? 280 : 180, onComplete: () => sp.destroy() });
        }

        // Momentum indicator text
        if (isEmpowered) {
            const pct = Math.round((momentumMult - 1) * 100);
            this.showStatusText(hitPx, hitPy - 18, `+${pct}% MOMENTUM`, '#ffe066');
        }

        // ── Damage ───────────────────────────────────────────────────────
        let hit = false;
        for (const enemy of [...this.enemies]) {
            if (this._phasedOut?.(enemy)) continue;
            if (enemy.x !== tile.x || enemy.y !== tile.y) continue;
            if (!enemy.sprite?.active) continue;
            this.damageEnemy(enemy, damage);
            this.gainUltCharge(this.ultChargePerHit * momentumMult);
            hit = true;
        }
        const portal = this.getPortalAt(tile.x, tile.y);
        if (portal) this.damagePortal(portal, damage);
        this.damageBossAtTile(tile.x, tile.y, damage);

        this.cameras.main.shake(hit ? 55 : 30, isEmpowered ? 0.004 : 0.002);
    }

    // ═══════════════════════════════════════════════════════════════════
    // SINGULARITY STAFF
    // ═══════════════════════════════════════════════════════════════════

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

    // ══════════════════════════════════════════════════════════════════════
    // BALL LIGHTNING — lightning's signature weapon
    // ══════════════════════════════════════════════════════════════════════
    //
    // Replaces Engineering Degree, which became a hollow slot once the Field Kit took over
    // the towers and the scrap economy. What was left was a lobbed wrench doing 2 damage per
    // impact on a 1500ms cooldown -- about 8 damage a cycle if all four impacts landed on one
    // target, against enemies with 55-140 HP.
    //
    // The identity is "stronger the more enemies there are, much weaker against one", and this
    // gets that out of GEOMETRY rather than bookkeeping. Two places it falls out for free:
    //
    //   1. The orb is slow and PIERCES, discharging an area pulse on a timer. Its damage is
    //      therefore proportional to how many bodies happen to be standing in its path -- a
    //      lone enemy eats one or two pulses, a packed corridor eats every one of them.
    //   2. It bursts into seekers that are consumed on contact. Against one enemy most of the
    //      burst is wasted on empty floor; against ten, all of it connects.
    //
    // Deliberately inverted against Orb Emitter so the two never read as the same weapon:
    // Orb Emitter is fast, BOUNCES off walls and stops on enemies (navigate geometry); Ball
    // Lightning is slow, PIERCES enemies and bursts on walls (plow through bodies).
    // Canonical jagged lightning path. Amplitude is a FRACTION of length, so a 1-tile fork
    // and a 9-tile skyfall are equally jagged -- a fixed pixel jitter reads as forked up close
    // and as a straight line at range, which is exactly how the Smite strike looked wrong.
    // Tapered to zero at both ends so the arc starts and lands exactly on its endpoints.
    _arcPath(fromX, fromY, toX, toY, segs = 7, ampFrac = 0.16) {
        const len = Math.hypot(toX - fromX, toY - fromY) || 1;
        const amp = len * ampFrac;
        const px = -(toY - fromY) / len, py = (toX - fromX) / len;
        const pts = [];
        for (let i = 0; i <= segs; i++) {
            const t = i / segs;
            const off = (Math.random() - 0.5) * 2 * amp * Math.sin(t * Math.PI);
            pts.push({ x: fromX + (toX - fromX) * t + px * off,
                       y: fromY + (toY - fromY) * t + py * off });
        }
        return pts;
    }

    // A real FORK, not a bent line. The trunk runs to the target and dead-end BRANCHES split
    // off it and fizzle out into empty space, recursing one level so branches have branches.
    //
    // This is the difference that matters visually: a single jagged polyline reads as a bent
    // WIRE no matter how hard you jitter it, because real lightning is recognised by its
    // branching, not by its waviness. The branches deliberately hit nothing -- they are what
    // the discharge looks like, not what it does.
    _strokeFork(g, fromX, fromY, toX, toY, colour, alpha, depth = 2) {
        const scale = depth / 2;
        const pts = this._arcPath(fromX, fromY, toX, toY, 7, 0.22);
        this._strokeArc(g, pts, 6.0 * scale, 0xaaffff, alpha * 0.22);   // glow
        this._strokeArc(g, pts, 2.6 * scale, colour,   alpha * 0.85);   // body
        this._strokeArc(g, pts, 1.1 * scale, 0xffffff, alpha);          // core
        if (depth <= 0) return pts;

        const dx = toX - fromX, dy = toY - fromY;
        const len = Math.hypot(dx, dy) || 1;
        const base = Math.atan2(dy, dx);
        const branches = 1 + Math.floor(Math.random() * 2);
        for (let b = 0; b < branches; b++) {
            const at = 1 + Math.floor(Math.random() * (pts.length - 2));
            const root = pts[at];
            const side = Math.random() < 0.5 ? -1 : 1;
            const ang = base + side * (0.5 + Math.random() * 0.75);
            const blen = len * (0.22 + Math.random() * 0.30);
            this._strokeFork(g, root.x, root.y,
                             root.x + Math.cos(ang) * blen, root.y + Math.sin(ang) * blen,
                             colour, alpha * 0.55, depth - 1);
        }
        return pts;
    }

    _strokeArc(g, pts, width, colour, alpha) {
        g.lineStyle(width, colour, alpha);
        g.beginPath(); g.moveTo(pts[0].x, pts[0].y);
        for (let i = 1; i < pts.length; i++) g.lineTo(pts[i].x, pts[i].y);
        g.strokePath();
    }

    _blCfg() {
        return {
            COOLDOWN:   1600,
            SPEED:      90,     // px/s -- a third of Orb Emitter's 300; it is a moving wall
            PULSE_MS:   250,    // how often it forks to everything in range
            // Fork reach, not a blast radius.
            PULSE_R:    3.5 + 0.5 * WeaponLevels.perk('ball_lightning', 'field'),
            // 2 per tier-0 arc, NOT 5. The cascade multiplies far harder than it looks: at 5
            // damage with a 0.55 falloff, eight clustered enemies took 910 total -- 114 each,
            // which one-shots most of the roster. Measured down to 374 / 47 each.
            PULSE_DMG:  3.6,    // tier-0 arc damage; tiers below fall off from this (all four of its damages -10% on 2026-10-20: it was top dps on one target and on packs)

            // ── CASCADING FORKS ──────────────────────────────────────────────
            // Each enemy the orb forks to then forks onward to LINK_N nearby enemies, and those
            // fork again, TIERS deep. Three enemies in range therefore all receive the main
            // fork plus tier-1 and tier-2 arcs from each other, which is where the crowd
            // multiplication lives: total arcs grow far faster than enemy count.
            FORK_TIERS:   2,    // tiers BEYOND the direct fork
            FORK_LINK_N:  2,    // how many onward targets each node picks
            FORK_LINK_R:  3.0,  // tiles between linked enemies
            FORK_FALLOFF: 0.35, // damage multiplier per tier
            FORK_CAP:     48,   // hard ceiling on arcs per discharge, for sanity
            // WATER EXTENDS THE CASCADE. An arc terminating on an enemy standing in water
            // relays to EVERY enemy sharing that pool, ignoring FORK_LINK_R entirely -- the
            // puddle becomes one node in the fork tree. Deliberately reach, not damage: it
            // changes the cascade's SHAPE, so a flooded lane is worth waiting for without
            // inflating any number. It is also the reason to hold the throw, which the weapon
            // did not previously have -- optimal play was firing on cooldown forever.
            WATER_POOL_CAP: 40, // tiles of pool to consider
            WATER_RELAY_N:  6,  // most enemies one pool may relay to at once

            // CHARGE is spent per ARC DRAWN, not per enemy. With cascading that makes a crowd
            // self-balancing: a dense pack produces dozens of arcs and burns the orb out fast,
            // while a lone enemy produces one and the orb drifts on.
            CHARGE:     150 * (1 + 0.2 * WeaponLevels.perk('ball_lightning', 'life')),   // its lifespan (Long Charge)
            COST_IDLE:  4,      // a discharge that reaches nothing
            COST_ARC:   3.2,    // per arc drawn -- a dense pack burns the orb out fast

            // ── EMBEDDING ────────────────────────────────────────────────────
            // A direct hit does NOT burst. The orb buries itself in the enemy's core, arcs
            // between nearby enemies on a timer, then detonates inside the host. The host is
            // deliberately NOT where the payoff lands -- it takes a decent hit on contact and
            // only a fraction of the detonation, so the weapon converts one body into a
            // delivery mechanism for damaging everything around it.
            DIRECT_R:      0.5,   // tiles -- contact radius for embedding
            EMBED_MS:      2600,  // how long it sits before detonating
            EMBED_TICK_MS: 380,   // arc cadence while embedded
            EMBED_HIT:     14.4,  // on contact, to the host
            EMBED_TICK_DMG: 1.8,  // per tick, to enemies around the host
            // Host DPS SCALES WITH THE CASCADE. Lodged in a lone enemy the embed barely burns;
            // lodged in a pack it cooks. Before this, the embed was a complete single-target
            // kit (16 contact + 23 DPS + detonation) that fired whether or not there was a
            // crowd, which is what flattened per-enemy damage to 63 / 74 / 70 and erased
            // "weak against one target" from the element.
            EMBED_HOST_DPS: 8.1,  // per second AT FULL SPREAD, to the host
            EMBED_DPS_FLOOR: 0.22, // fraction of it with nothing else in range
            EMBED_DPS_FULL_AT: 4,  // arc targets needed for the full rate
            DETONATE_DMG:  10.8,  // detonation, to nearby enemies
            DETONATE_HOST_FRAC: 0.30,  // the host only takes this much of it
            DETONATE_R:    4.0,   // tiles

            // ── SEEKER SPRAY ─────────────────────────────────────────────────
            SEEKERS_MAX: 70 + 20 * WeaponLevels.perk('ball_lightning', 'swarm'),    // at full charge -- a genuine swarm (Swarm: more)
            SEEKERS_MIN: 20,    // floor, so a spent orb still sprays
            // A detonation (the orb was carried into a host) bursts at least this full. Its flight
            // through a pack burns most of the charge, so sized by what was left it always came
            // out at the 20-seeker floor and the swarm never showed.
            EMBED_BURST: 0.8,
            SEEK_SPEED: 480,    // eased off 620 so the spray is readable
            SEEK_R:     4.2,    // draw radius -- these are little balls, not pixels
            SEEK_DMG:   5.4,
            SEEK_ZAP_R: 1.6,    // tiles -- each impact forks to enemies this close
            SEEK_ZAP_DMG: 2.6,
            SEEK_ZAP_N: 2,      // how many nearby enemies one impact forks to
            SEEK_LIFE:  700,
            // Homing radius, tiles. It was read below and never defined, so `bd < TS * undefined`
            // was always false and no seeker has ever homed. 0 keeps exactly that, on purpose:
            // turned on at 2 tiles it cost ~14% of the pack damage (measured, 204 -> 176 DPS),
            // because the homing picks the nearest enemy even when it is already full
            // (SEEK_MAX_PER) and steers seekers into bodies that can no longer absorb them.
            SEEK_HOME_R: 0,
            SEEK_MAX_PER: 2,    // seekers one enemy can absorb
            // Movement is SUBSTEPPED: at speed a frame can advance further than the hit radius
            // and a seeker would step clean through a body without registering.
            SEEK_SUBSTEPS: 3,
            COLOR:      0xffee66
        };
    }

    // ═══ THE CONDUCTOR ═══════════════════════════════════════════════════════
    // The Circuit Breaker: a staff that throws wires. A click shoots one at the enemy nearest the cursor (inside
    // CURSOR_R of it and RANGE of you) and clamps on; you're the other end. Up to WIRES at once (a new one drops the
    // oldest), one throw every CD; a clamp that bites dazes its enemy for LAND_DAZE. R sends a CURRENT down the wire
    // nearest your aim: a blob that runs out to the enemy, on
    // through the arcs, and home along the last wire, dazing (PULSE_DAZE) and hitting (PULSE_DMG) each enemy it passes.
    // That's your hand in it once the web is up (R, at the wire nearest your aim). Each clamp is one of three, cycled with the secondary key:
    //   LIVE       current runs through it: it takes WIRE_DMG a TICK
    //   INSULATOR  it takes only INS_TAKE of that, and the whole web (every clamp, line, burst and current) does
    //              INS_NERF as much per insulator, but every daze lasts INS_DAZE longer: control for damage
    //   (Superconducted: live and insulated clamps while their circuit is closed, and wherever a current runs; never a capacitor)
    //   CAPACITOR  it takes nothing; the current it would have taken is stored, and every CAP_MS it bursts: CAP_BASE
    //              plus CAP_X times what it stored, forked out and shared between everything within CAP_R (+CAP_SPREAD
    //              of the total for each enemy past the first), so it spreads damage where a live wire focuses it
    // Any other enemy touching a wire or an arc takes CROSS_DMG a tick. Wired enemies inside ARC_R of each other arc
    // together and close a CIRCUIT through you: its wires and arc run CIRCUIT times hotter. So a lone live wire is
    // weak; the damage is in building the circuit. A line snaps past SNAP tiles or behind a wall or gate; when a
    // wired enemy dies the clamp jumps to the nearest unwired enemy in JUMP_R.
    _conductorCfg() {
        const reach = WeaponLevels.perk('conductor', 'reach'), more = WeaponLevels.perk('conductor', 'wires');
        return { CD: 650, PULSE_CD: 420, PULSE_SPEED: 620, PULSE_DMG: 6, PULSE_DAZE: 450, LAND_DAZE: 400, INS_NERF: 0.65, INS_DAZE: 0.6, INS_SC: 2500, PULSE_SC: 3500, RANGE: 8 + reach, CURSOR_R: 2.5, SNAP: 18 + reach, FLY_MS: 150, SLING: 330, WIRES: 3 + more, ARC_R: 6, JUMP_R: 3, CROSS_R: 0.65,
            TICK: 300, LATCH_DMG: 3, WIRE_DMG: 4, CROSS_DMG: 5, INS_TAKE: 0.3,
            CIRCUIT: 2, CAP_MS: 3000, CAP_R: 2.5, CAP_BASE: 3, CAP_X: 0.6, CAP_SPREAD: 0.3,
            COL: 0xffe14a, HOT: 0xfff8c0, MODES: ['live', 'ins', 'cap'], MCOL: { live: 0xffe14a, ins: 0x7fd0ff, cap: 0xff9a3a } };
    }
    // Queens and bosses aren't in the enemy list: each gets a stand-in the wires can hold (the same one every frame,
    // so a wire knows its own), whose hits go through damagePortal / damageBossAtTile
    _condBigs() {
        const T = this.TILE_SIZE, map = this._condBigMap ||= new Map(), out = [];
        const mk = (o, at, hit) => {
            let q = map.get(o);
            if (!q) { q = { _big: o, get x() { return this.sprite.x / T; }, get y() { return this.sprite.y / T; }, get health() { return this._big.active && this.sprite?.active ? 1 : 0; } }; map.set(o, q); }
            q.sprite = at; q.hit = hit; out.push(q);
        };
        for (const p of this.portals || []) if (p.active && p.container) mk(p, p.container, d => this.damagePortal(p, d));
        for (const bo of [this.voltslimeBoss, this.voidSovereignBoss, this.fractureCore]) {
            if (!bo?.active || !bo.container) continue;
            mk(bo, bo.container, d => { const bx = bo.tileX ?? Math.floor(bo.container.x / T), by = bo.tileY ?? Math.floor(bo.container.y / T); this.damageBossAtTile(bx, by, d, undefined, 'lightning'); });
        }
        return out;
    }
    _condTargets() { return [...this.enemies.filter(e => !this._phasedOut(e)), ...this._condBigs()]; }
    _condHit(e, d) { if (e._big) { e.hit(d); this._dmgLanded = true; } else this.damageEnemy(e, d, 'lightning'); }
    _condSC(e, ms) { if (!e._big) this._superconduct(e, ms); }
    // the web's damage and its dazes, with the insulators on it counted
    _condWebMul(on) { const C = this._conductorCfg(), n = on.filter(w => w.mode === 'ins').length; return { dmg: Math.pow(C.INS_NERF, n), daze: 1 + C.INS_DAZE * n }; }
    _condDaze(e, ms) {
        if (e._big || !e.sprite?.active || e.health <= 0) return;
        e.isStunned = true; e.stunnedUntil = Math.max(e.stunnedUntil || 0, this.time.now + ms);
    }
    _condTip() { const t = this._condWielding() && typeof CreatureFX !== 'undefined' && CreatureFX.gearTip?.(this); return t || { x: this._shotX(), y: this._shotY() }; }   // the staff's head (you, while you hold something else)
    _condWielding() { return this.currentElement === 'lightning' && this.equippedWeapons?.lightning === 'conductor' && this.player?.active; }
    conductorAttack(targetX, targetY) {
        const C = this._conductorCfg(), now = this.time.now, T = this.TILE_SIZE;
        const wx = targetX + this.cameras.main.scrollX, wy = targetY + this.cameras.main.scrollY, { x: px, y: py } = this._condTip();
        const wires = this._condWires ||= [];
        const aim = Math.atan2(wy - py, wx - px);
        const near = this._condTargets().filter(e => e.sprite?.active && e.health > 0 && Math.hypot(e.sprite.x - wx, e.sprite.y - wy) < C.CURSOR_R * T && Math.hypot(e.sprite.x - px, e.sprite.y - py) < C.RANGE * T && this._condClear(this.player.x, this.player.y, e.sprite.x, e.sprite.y))   // (from you, not the staff head, which can poke into a wall)
            .sort((a, b) => Math.hypot(a.sprite.x - wx, a.sprite.y - wy) - Math.hypot(b.sprite.x - wx, b.sprite.y - wy));
        const e = near.find(q => !wires.some(w => w.e === q));   // an unwired enemy under the cursor gets a wire (R sends the currents)
        if (now - (this._condLast || 0) < C.CD) return;
        this._condLast = now;
        this._gearFiredAt = now;
        Sfx.play(this, 'zap');
        if (!e) {   // nothing there: the line flies out, drops slack on the floor, and reels back in
            const L = Math.min(C.RANGE * T * 0.7, Math.max(T * 2, Math.hypot(wx - px, wy - py)));
            (this._condMisses ||= []).push({ t0: now, a: aim, L, side: Math.random() < 0.5 ? 1 : -1, path: [{ x: 0, y: 0 }], mode: this._condMode || 'live', seed: Math.random() * 10 });   // (its path kept relative to the staff, so it travels with you)
            return;
        }
        if (wires.length >= C.WIRES) this._condSnap(wires.shift());
        wires.push({ e, t0: now, seed: Math.random() * 10, fx: null, mode: this._condMode || 'live', store: 0, ...this._condThrow(px, py, e) });
        const a = Math.atan2(e.sprite.y - py, e.sprite.x - px), fl = this.add.image(px, py, 'vfx_glow').setTint(C.HOT).setBlendMode(Phaser.BlendModes.ADD).setDepth(4.3).setScale(0.15);   // the staff kicks: a flare, a spray of sparks down the line
        this.tweens.add({ targets: fl, scale: 0.55, alpha: 0, duration: 180, ease: 'Quad.easeOut', onComplete: () => fl.destroy() });
        for (let k = 0; k < 8; k++) this._condSpark(px + Math.cos(a) * 8, py + Math.sin(a) * 8, 1);
        VisualFX.ripple(this, px, py, 3, 16, C.COL, { duration: 160, alpha: 0.9 });
    }
    // a fresh throw from (x, y) at enemy e: where the clamp is, which way it swings, the path it lays
    _condThrow(x, y, e) {
        return { bx: x, by: y, hx: x, hy: y, lx: x, ly: y, path: [{ x, y, t: this.time.now }], side: Math.random() < 0.5 ? 1 : -1, d0: Math.max(1, Math.hypot(e.sprite.x - x, e.sprite.y - 4 - y)), relax: null };
    }
    // n points spaced evenly along a polyline
    _condResample(src, n) {
        const d = [0]; for (let i = 1; i < src.length; i++) d.push(d[i - 1] + Math.hypot(src[i].x - src[i - 1].x, src[i].y - src[i - 1].y));
        const L = d[d.length - 1] || 1, out = []; let j = 1;
        for (let k = 0; k < n; k++) {
            const t = L * k / (n - 1); while (j < src.length - 1 && d[j] < t) j++;
            const a = src[j - 1], b = src[j], f = (t - d[j - 1]) / ((d[j] - d[j - 1]) || 1);
            out.push({ x: a.x + (b.x - a.x) * f, y: a.y + (b.y - a.y) * f });
        }
        return out;
    }
    // A current down wire w: out to its enemy, on through the arcs to each wired enemy not yet reached (nearest-first
    // chain), then home along the last one's wire, completing the circuit (back down w if it reached no one else)
    _condPulse(w) {
        const pairs = this._condPairs || [], route = [{ w }], seen = new Set([w]);
        let cur = w;
        for (;;) {
            const next = pairs.map(([a, b]) => a === cur ? b : b === cur ? a : null).find(q => q && !seen.has(q) && q.on);
            if (!next) break;
            route.push({ a: cur.e, b: next.e }); seen.add(next); cur = next;
        }
        route.push({ w: cur, back: true });
        (this._condPulses ||= []).push({ route, i: 0, d: 0, hit: new Set(), trail: [] });
        const { x, y } = this._condTip();
        this._condSpark(x, y, 10);
        VisualFX.ripple(this, x, y, 4, 22, this._conductorCfg().HOT, { duration: 200 });
        Sfx.play(this, 'zap');
    }
    // sparks from the Conductor's own emitter
    _condSpark(x, y, n) {
        if (!this._condSparks?.active) this._condSparks = this.add.particles(0, 0, 'vfx_dot', {
            emitting: false, lifespan: { min: 260, max: 560 }, speed: { min: 50, max: 170 }, gravityY: 320,
            scale: { start: 0.75, end: 0 }, alpha: { start: 1, end: 0.2 }, tint: [0xffe14a, 0xfff8c0, 0xffffff], blendMode: 'ADD', maxParticles: 260,
        }).setDepth(4.2);
        this._condSparks.emitParticleAt(x, y, n);
    }
    // a line let go: it whips down and fades
    _condSnap(w) {
        if (!w?.e?.sprite) return;
        const C = this._conductorCfg(), g = this.add.graphics().setDepth(1.5), x = w.e.sprite.x, y = w.e.sprite.y;
        g.setBlendMode(Phaser.BlendModes.ADD); this._strokeFork(g, x, y - 4, x + (Math.random() - 0.5) * 30, y + 14, C.HOT, 0.9, 1);
        this.tweens.add({ targets: g, alpha: 0, duration: 240, onComplete: () => g.destroy() });
        this._condSpark(x, y - 4, 6);
    }
    // a gold cable: a dark edge, two gold strands twisted round each other catching the light, and the current
    // riding it in the clamp's colour (a glow, a flickering thread, brighter with k). g draws the copper, gl (additive)
    // the current; pass the same graphics for both when there's only one.
    _condCable(g, gl, pts, time, seed, k = 1, col) {
        const C = this._conductorCfg(), c = col ?? C.COL, n = pts.length;
        const off = (s, amp, f, ph) => pts.map((p, i) => {
            if (!i || i === n - 1) return p;
            const q = pts[i + 1], dx = q.x - p.x, dy = q.y - p.y, L = Math.hypot(dx, dy) || 1, o = s * amp * Math.sin(i * f + ph);
            return { x: p.x - dy / L * o, y: p.y + dx / L * o };
        });
        g.lineStyle(5, 0x2e2004, 1); g.strokePoints(pts, false);
        g.lineStyle(3.4, 0xb08a1c, 1); g.strokePoints(pts, false);
        g.lineStyle(1.3, 0x7a5a0e, 1); g.strokePoints(off(1, 1.1, 2.2, seed), false);   // the twist: a dark strand and a bright one
        g.lineStyle(1.3, 0xffd84a, 1); g.strokePoints(off(-1, 1.1, 2.2, seed), false);
        for (let i = 1; i < n - 1; i += 2) { const p = pts[i], q = pts[i + 1]; g.lineStyle(1, 0xfff4c0, 0.85); g.lineBetween(p.x, p.y - 1.2, (p.x + q.x) / 2, (p.y + q.y) / 2 - 1.2); }   // light along its top
        gl.lineStyle(9, c, 0.12 * k); gl.strokePoints(pts, false);
        const thread = pts.map((p, i) => !i || i === n - 1 ? p : { x: p.x + (Math.random() - 0.5) * 4, y: p.y + (Math.random() - 0.5) * 4 });
        gl.lineStyle(1.2, c, Math.min(1, 0.75 * k)); gl.strokePoints(thread, false);
    }
    // a capacitor clamp: two plates over its enemy, and a ring round it filling with its charge
    _condCapDraw(gl, glow, w, x, y, time) {
        const C = this._conductorCfg(), k = w.charge || 0, py = y - 20, col = C.MCOL.cap;
        gl.lineStyle(2, col, 1);
        gl.lineBetween(x - 3, py - 5, x - 3, py + 5); gl.lineBetween(x + 3, py - 5, x + 3, py + 5);
        gl.lineBetween(x - 8, py, x - 3, py); gl.lineBetween(x + 3, py, x + 8, py);
        if (k > 0) {
            const pts = []; for (let i = 0; i <= 24; i++) { const a = -Math.PI / 2 + i / 24 * Math.PI * 2 * k; pts.push({ x: x + Math.cos(a) * 11, y: y + Math.sin(a) * 11 }); }
            gl.lineStyle(4, col, 0.4); gl.strokePoints(pts, false); gl.lineStyle(1.5, 0xffffff, 0.95); gl.strokePoints(pts, false);
            if (k > 0.8) glow(x, y, 0.2 + 0.3 * (k - 0.8) * 5, col, 0.7);
        }
    }
    // an insulator clamp: a stack of ceramic discs over its enemy, a cool shell of light round it
    _condInsDraw(gl, glow, x, y, time) {
        const col = this._conductorCfg().MCOL.ins, py = y - 22;
        for (let k = 0; k < 3; k++) { gl.lineStyle(2, col, 1); gl.strokeEllipse(x, py + k * 4, 12 - k * 2, 4); }
        gl.lineStyle(1.5, col, 0.35 + 0.15 * Math.sin(time / 120)); gl.strokeEllipse(x, y + 4, 30, 14);
        glow(x, y, 0.3, col, 0.35);
    }
    // a wire can't pass walls or a sealed room's laser gate
    _condClear(ax, ay, bx, by) {
        const T = this.TILE_SIZE, n = Math.ceil(Math.hypot(bx - ax, by - ay) / (T / 3));
        const gates = this._condGateSet?.src === this.lockedDoorTiles && this._condGateSet.n === (this.lockedDoorTiles?.length || 0) ? this._condGateSet.set
            : (this._condGateSet = { src: this.lockedDoorTiles, n: this.lockedDoorTiles?.length || 0, set: new Set((this.lockedDoorTiles || []).map(t => t.x + ',' + t.y)) }).set;
        for (let i = 1; i < n; i++) {
            const tx = Math.floor((ax + (bx - ax) * i / n) / T), ty = Math.floor((ay + (by - ay) * i / n) / T);
            if (this.world[tx]?.[ty] !== this.FLOOR || gates.has(tx + ',' + ty) || this.isInLockedRoom?.(tx, ty)) return false;
        }
        return true;
    }
    // the slack curve of a wire from (ax, ay) to (bx, by): it sags more the less taut it is, and sways
    _condCurve(ax, ay, bx, by, seed, time, C) {
        const len = Math.hypot(bx - ax, by - ay), sag = Phaser.Math.Clamp((C.SNAP * this.TILE_SIZE - len) * 0.09, 3, 26) * (1 + 0.12 * Math.sin(time / 280 + seed));
        const cx = (ax + bx) / 2, cy = (ay + by) / 2 + sag * 2, pts = [];
        for (let i = 0; i <= 16; i++) { const t = i / 16, u = 1 - t; pts.push({ x: u * u * ax + 2 * u * t * cx + t * t * bx, y: u * u * ay + 2 * u * t * cy + t * t * by }); }
        return pts;
    }
    // Every frame: wires flying and clamped, the arcs, the ticks, the meter
    _conductorTick(time, delta) {
        const C = this._conductorCfg(), T = this.TILE_SIZE, ADD = Phaser.BlendModes.ADD;
        const g = this._condG?.active ? this._condG : (this._condG = this.add.graphics().setDepth(1.5));
        const gl = this._condGL?.active ? this._condGL : (this._condGL = this.add.graphics().setDepth(1.49).setBlendMode(ADD));
        g.clear(); gl.clear(); this._condLights = [];
        const pool = this._condPool = (this._condPool || []).filter(i => i.active); let used = 0;
        const glow = (x, y, s, col, a) => { const i = pool[used] || (pool[used] = this.add.image(0, 0, 'vfx_glow').setBlendMode(ADD).setDepth(1.55)); used++; i.setPosition(x, y).setScale(s).setTint(col).setAlpha(a).setVisible(true); };
        const wires = this._condWires ||= [];
        const wield = this._condWielding();
        if (this.equippedWeapons?.lightning !== 'conductor' || !this.player?.active) { for (const w of wires.splice(0)) this._condSnap(w); }   // the wires stay on you through an element switch, so you can set the web and fight with something else; only unequipping it lets go
        // upkeep: snapped, dead (the clamp jumps), arriving
        for (const w of [...wires]) {
            const e = w.e;
            if (!e.sprite?.active || e.health <= 0) {
                const x = e._condPx ?? e.sprite?.x, y = e._condPy ?? e.sprite?.y;
                const next = this._condTargets().filter(o => o.sprite?.active && o.health > 0 && !wires.some(q => q.e === o) && Math.hypot(o.sprite.x - x, o.sprite.y - y) < C.JUMP_R * T)
                    .sort((a, b) => Math.hypot(a.sprite.x - x, a.sprite.y - y) - Math.hypot(b.sprite.x - x, b.sprite.y - y))[0];
                if (next) { Object.assign(w, { e: next, t0: time, on: false, bite: 0 }, this._condThrow(x, y, next)); this._condSpark(x, y, 12); }   // the clamp slings on to the next one
                else { wires.splice(wires.indexOf(w), 1); if (x != null) this._condSpark(x, y, 8); }
                continue;
            }
            e._condPx = e.sprite.x; e._condPy = e.sprite.y;
            if (this._phasedOut(e) || Math.hypot(e.sprite.x - this.player.x, e.sprite.y - this.player.y) > C.SNAP * T || (w.on && time - (w.losAt || 0) > 120 && (w.losAt = time) && !this._condClear(this.player.x, this.player.y, e.sprite.x, e.sprite.y))) { wires.splice(wires.indexOf(w), 1); this._condSnap(w); continue; }   // too far, or a wall or gate between
            if (!w.on) {   // in flight: the clamp homes on its enemy, swinging out to one side and back, laying the cable where it goes
                const tx = e.sprite.x, ty = e.sprite.y - 4, step = C.SLING * Math.min(50, delta || 16) / 1000, d = Math.hypot(tx - w.bx, ty - w.by);
                if (d > step + 4) {
                    w.bx += (tx - w.bx) / d * step; w.by += (ty - w.by) / d * step;
                    const u = Phaser.Math.Clamp(1 - Math.hypot(tx - w.bx, ty - w.by) / w.d0, 0, 1), L = Math.hypot(tx - w.lx, ty - w.ly) || 1, o = w.side * Math.sin(u * Math.PI) * Math.min(36, w.d0 * 0.2);
                    w.hx = w.bx - (ty - w.ly) / L * o; w.hy = w.by + (tx - w.lx) / L * o;
                    w.path.push({ x: w.hx, y: w.hy, t: time });
                } else { w.hx = tx; w.hy = ty; }
            }
            if (!w.on && w.hx === e.sprite.x && w.hy === e.sprite.y - 4) {   // it bites
                w.on = true; w.bite = time; w.relax = null;
                this.cameras.main.shake(50, 0.0015);
                VisualFX.ripple(this, e.sprite.x, e.sprite.y - 4, 4, 26, C.HOT, { duration: 220 });
                this._condHit(e, C.LATCH_DMG * this.damageScaling);
                this._condDaze(e, C.LAND_DAZE * this._condWebMul(wires.filter(q => q.on)).daze);
                if (this._dmgLanded) this.gainUltCharge(this.ultChargePerLightningHit * 0.6, 'lightning');
                this._condSpark(e.sprite.x, e.sprite.y - 4, 14);
                this._vfxFlash?.(e.sprite.x, e.sprite.y, 40, C.COL, 220, 0.8);
            }
        }
        const on = wires.filter(w => w.on && w.e.sprite?.active && w.e.health > 0);
        const pairs = this._condPairs = [];   // wired enemies close enough arc together, and each arc closes a circuit through you
        for (const w of on) { w.was = w.closed; w.closed = false; }
        for (let i = 0; i < on.length; i++) for (let j = i + 1; j < on.length; j++) {
            const a = on[i].e.sprite, b = on[j].e.sprite;
            if (Math.hypot(a.x - b.x, a.y - b.y) > C.ARC_R * T || !this._condClear(a.x, a.y, b.x, b.y)) continue;
            pairs.push([on[i], on[j]]); on[i].closed = on[j].closed = true;
        }
        // Superconducted is earned through the circuit: a live or insulated clamp holds it while its loop is closed (an insulator
        // keeps it for INS_SC after), a capacitor never does, so reactions for your other elements come from building the loop
        for (const w of on) if (w.closed && w.mode !== 'cap' && w.e.health > 0) this._condSC(w.e, w.mode === 'ins' ? C.INS_SC : 700);
        if (on.some(w => w.closed && !w.was)) {   // a loop just closed
            for (const w of on) if (w.closed && !w.was) { this._condSpark(w.e.sprite.x, w.e.sprite.y - 4, 12); VisualFX.ripple(this, w.e.sprite.x, w.e.sprite.y - 4, 4, 22, 0xffffff, { duration: 220 }); }
            if (!on.some(w => w.was)) this.showStatusText(this.player.x, this.player.y - 30, 'CIRCUIT', '#fff08a');
        }
        // the lines that hurt what they cross: each wire, and arcs between wired enemies close enough
        const { x: sx, y: sy } = this._condTip(), segs = [];
        for (const w of wires) {
            const e = w.e; if (!e.sprite?.active) continue;
            const ex = e.sprite.x, ey = e.sprite.y - 4, hx = w.on ? ex : w.hx, hy = w.on ? ey : w.hy;
            const plucked = time - (w.pluck || -1e9) < 160, surge = w.bite ? (time - w.bite) / 220 : 2;
            let pts;
            if (!w.on) {   // in flight: the cable runs from the staff along the path the clamp flew, shivering behind it
                pts = this._condResample([{ x: sx, y: sy }, ...w.path, { x: hx, y: hy }], 17);
                const droop = Math.min(20, (time - w.t0) * 0.05);   // slack: the cable sags into a belly as it pays out
                pts.forEach((p, i) => { if (!i || i === 16) return; const t = i / 16, wv = 2.5 * Math.sin(t * 12 - time / 30) * Math.sin(t * Math.PI); p.x += wv; p.y += wv * 0.5 + droop * Math.sin(t * Math.PI); });
                w.relax = pts.map(p => ({ ...p }));
            } else {
                pts = this._condCurve(sx, sy, hx, hy, w.seed, time, C);
                if (w.relax && surge < 1) { const t = 1 - (1 - surge) ** 3; pts = pts.map((p, i) => ({ x: w.relax[i].x + (p.x - w.relax[i].x) * t, y: w.relax[i].y + (p.y - w.relax[i].y) * t })); }   // it snaps taut
            }
            this._condCable(g, gl, pts, time, w.seed, !w.on ? 0.5 : plucked ? 1.8 : w.closed ? 1.5 : 1, C.MCOL[w.mode]);
            w.pts = pts;   // (a current rides it: _condPulse)
            if (w.closed) { gl.lineStyle(2, 0xffffff, 0.55 + 0.25 * Math.sin(time / 70)); gl.strokePoints(pts, false); }   // a closed loop runs white-hot
            if (w.on) {
                for (let q = 0; q < 2; q++) {   // current flowing out along it
                    const t = ((time / 520) + q / 2 + w.seed) % 1, p = pts[Math.floor(t * (pts.length - 1))];
                    glow(p.x, p.y, 0.16, C.COL, 0.9); glow(p.x, p.y, 0.06, 0xffffff, 1);
                }
                // the clamp: a ring of current biting into it
                gl.lineStyle(2, C.HOT, 1); gl.strokeCircle(ex, ey, 5 + Math.sin(time / 50) * 0.8);
                glow(ex, ey, 0.28 + 0.05 * Math.sin(time / 60), C.COL, 0.55);
                if (Math.random() < 0.12) this._condSpark(ex, ey, 1);
                this._condLights.push({ x: ex, y: ey, r: 34, color: C.COL, a: 0.6, g: 0.25 }, { x: pts[8].x, y: pts[8].y, r: 26, color: C.COL, a: 0.35, g: 0.15 });
                pts.hot = w.closed ? C.CIRCUIT : 1; segs.push(pts);
                if (w.mode === 'cap') this._condCapDraw(gl, glow, w, ex, ey, time);
                else if (w.mode === 'ins') this._condInsDraw(gl, glow, ex, ey, time);
                if (surge < 1) {   // the bite: a white surge rushing down the line to the clamp
                    const p = pts[Math.floor(Math.min(1, surge * 1.6) * (pts.length - 1))];
                    gl.lineStyle(5, 0xffffff, 0.8 * (1 - surge)); gl.strokePoints(pts, false);
                    glow(p.x, p.y, 0.35, C.HOT, 1); glow(p.x, p.y, 0.12, 0xffffff, 1);
                }
            } else {   // the clamp in flight: a glowing copper barb, crackling, shedding sparks
                const a = time / 45;   // the clamp tumbling through the air
                for (const s of [-1, 1]) { const ba = a + Math.PI + s * 0.6; gl.lineStyle(2.5, C.HOT, 1).lineBetween(hx, hy, hx + Math.cos(ba) * 7, hy + Math.sin(ba) * 7); }
                g.fillStyle(0xffffff, 1).fillCircle(hx, hy, 2.5);
                glow(hx, hy, 0.3, C.COL, 0.8); glow(hx, hy, 0.1, 0xffffff, 1);
                this._strokeFork(gl, hx, hy, hx + Math.cos(a) * 14 + (Math.random() - 0.5) * 10, hy + Math.sin(a) * 14 + (Math.random() - 0.5) * 10, C.HOT, 0.9, 1);
                this._condSpark(hx, hy, 1);
            }
        }
        if (on.length) glow(sx, sy, 0.2, C.COL, 0.7);
        for (const m of [...(this._condMisses || [])]) {   // a missed throw: out, slack on the floor, reeled back
            const age = time - m.t0, fly = m.L / C.SLING * 1000, lie = 220, reel = 300;
            if (age > fly + lie + reel) { this._condMisses.splice(this._condMisses.indexOf(m), 1); continue; }
            if (age <= fly) {
                const u = age / fly, o = m.side * Math.sin(u * Math.PI) * Math.min(30, m.L * 0.2);
                const bx = Math.cos(m.a) * m.L * u, by = Math.sin(m.a) * m.L * u;
                m.path.push({ x: bx - Math.sin(m.a) * o, y: by + Math.cos(m.a) * o });
            }
            let path = m.path.map(p => ({ x: p.x + sx, y: p.y + sy }));
            if (age > fly + lie) { const k = (age - fly - lie) / reel; path = path.slice(0, Math.max(1, Math.round(path.length * (1 - k)))); }   // reeling in
            const head = path[path.length - 1];
            if (path.length < 2) continue;
            const pts = this._condResample([{ x: sx, y: sy }, ...path.slice(1)], 17), droop = Math.min(26, age * 0.05);
            pts.forEach((p, i) => { p.y += droop * Math.sin(i / 16 * Math.PI) * (age > fly ? 1 : 0.6); });
            this._condCable(g, gl, pts, time, m.seed, 0.35, C.MCOL[m.mode]);
            const hx = pts[16].x, hy = pts[16].y;
            for (const s of [-1, 1]) { const ba = time / 45 + s * 0.6; g.lineStyle(2, 0xffd84a, 1).lineBetween(hx, hy, hx + Math.cos(ba) * 6, hy + Math.sin(ba) * 6); }   // the clamp, tumbling
            if (age > fly && age < fly + 40) this._condSpark(hx, hy, 4);   // it hits the floor
        }
        for (const P of [...(this._condPulses || [])]) {   // currents: a big blob running the circuit
            const seg = P.route[P.i];
            const pts = !seg ? null : seg.w ? (seg.w.on && seg.w.e.sprite?.active ? (seg.back ? [...seg.w.pts].reverse() : seg.w.pts) : null)
                : (seg.a.sprite?.active && seg.b.sprite?.active ? [{ x: seg.a.sprite.x, y: seg.a.sprite.y - 4 }, { x: seg.b.sprite.x, y: seg.b.sprite.y - 4 }] : null);
            if (!pts) { this._condPulses.splice(this._condPulses.indexOf(P), 1); continue; }
            let L = 0; for (let i = 1; i < pts.length; i++) L += Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y);
            P.d += C.PULSE_SPEED * Math.min(50, delta || 16) / 1000;
            let d = Math.min(P.d, L), x = pts[0].x, y = pts[0].y;
            for (let i = 1; i < pts.length; i++) { const sl = Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y); if (d <= sl) { const f = d / (sl || 1); x = pts[i - 1].x + (pts[i].x - pts[i - 1].x) * f; y = pts[i - 1].y + (pts[i].y - pts[i - 1].y) * f; break; } d -= sl; x = pts[i].x; y = pts[i].y; }
            P.trail.unshift({ x, y }); if (P.trail.length > 6) P.trail.pop();
            P.trail.forEach((q, k) => glow(q.x, q.y, 0.34 - k * 0.045, C.COL, 0.6 - k * 0.08));
            glow(x, y, 0.5, C.HOT, 0.8); glow(x, y, 0.16, 0xffffff, 1);
            for (let k = 0; k < 2; k++) { const fa = Math.random() * Math.PI * 2; this._strokeFork(gl, x, y, x + Math.cos(fa) * 12, y + Math.sin(fa) * 12, 0xffffff, 0.9, 1); }
            if (Math.random() < 0.5) this._condSpark(x, y, 1);
            if (P.d >= L) {   // reached the end of this stretch: if it's an enemy, it's hit
                const hit = seg.w ? (seg.back ? null : seg.w.e) : seg.b;
                if (hit && hit.health > 0 && !P.hit.has(hit)) {
                    P.hit.add(hit);
                    const web = this._condWebMul(on);
                    this._condHit(hit, C.PULSE_DMG * web.dmg * this.damageScaling);
                    this._condDaze(hit, C.PULSE_DAZE * web.daze);
                    if ((this._condWires || []).find(q => q.e === hit)?.mode !== 'cap') this._condSC(hit, C.PULSE_SC);   // a current renews the mark on what it runs through (capacitors aside)
                    VisualFX.ripple(this, hit.sprite.x, hit.sprite.y - 4, 6, 30, C.HOT, { duration: 260 });
                    this._vfxFlash?.(hit.sprite.x, hit.sprite.y, 60, C.COL, 240, 0.9);
                    this._condSpark(hit.sprite.x, hit.sprite.y - 4, 10);
                }
                P.i++; P.d = 0;
                if (P.i >= P.route.length) this._condPulses.splice(this._condPulses.indexOf(P), 1);
            }
        }
        for (const [wa, wb] of pairs) {   // the arcs: raw lightning between the clamps, closing the loop
            const a = wa.e.sprite, b = wb.e.sprite, pts = this._arcPath(a.x, a.y - 4, b.x, b.y - 4, 9, 0.14);
            gl.lineStyle(10, C.COL, 0.2); gl.strokePoints(pts, false);
            this._strokeFork(gl, a.x, a.y - 4, b.x, b.y - 4, 0xffffff, 0.95, 2);
            pts.hot = C.CIRCUIT; segs.push(pts);
        }
        // who's touching a line (not a wired one)
        const wired = new Set(on.map(w => w.e)), touch = new Map();
        const targets = this._condTargets();
        for (const pts of segs) for (const e of targets) {
            if (wired.has(e) || !e.sprite?.active || e.health <= 0) continue;
            for (let i = 1; i < pts.length; i++) {
                const p = pts[i - 1], q = pts[i], dx = q.x - p.x, dy = q.y - p.y, t = Phaser.Math.Clamp(((e.sprite.x - p.x) * dx + (e.sprite.y - 4 - p.y) * dy) / (dx * dx + dy * dy || 1), 0, 1);
                if (Math.hypot(p.x + dx * t - e.sprite.x, p.y + dy * t - e.sprite.y + 4) < C.CROSS_R * T) { touch.set(e, (touch.get(e) || 0) + pts.hot); break; }   // a closed loop's lines count for more
            }
        }
        for (const e of touch.keys()) {   // shocked: it crackles where the line runs through it
            for (let k = 0; k < 2; k++) { const fa = Math.random() * Math.PI * 2; this._strokeFork(gl, e.sprite.x, e.sprite.y - 4, e.sprite.x + Math.cos(fa) * 13, e.sprite.y - 4 + Math.sin(fa) * 13, 0xffffff, 0.9, 1); }
            glow(e.sprite.x, e.sprite.y - 4, 0.22, C.COL, 0.6);
        }
        for (let i = used; i < pool.length; i++) pool[i].setVisible(false);
        this._condTouch = touch;
        for (const w of on) if (w.mode === 'cap') {   // capacitors charge, then burst with what they stored
            w.charge = (w.charge || 0) + (delta || 16) / C.CAP_MS;
            if (w.charge < 1) continue;
            w.charge = 0;
            const e = w.e, x = e.sprite.x, y = e.sprite.y - 4;
            const hit = this._condTargets().filter(o => o.sprite?.active && o.health > 0 && Math.hypot(o.x - e.x, o.y - e.y) <= C.CAP_R && (o === e || this._condClear(e.sprite.x, e.sprite.y, o.sprite.x, o.sprite.y)));
            const share = (C.CAP_BASE + C.CAP_X * w.store) * (1 + C.CAP_SPREAD * (hit.length - 1)) / Math.max(1, hit.length) * this.damageScaling;   // one charge, split between them
            w.store = 0;
            for (const o of hit) {
                if (o !== e) { this._strokeFork(gl, x, y, o.sprite.x, o.sprite.y - 4, 0xffffff, 1, 2); this._strokeFork(gl, x, y, o.sprite.x, o.sprite.y - 4, C.MCOL.cap, 0.9, 1); }
                this._condHit(o, share);
            }
            VisualFX.ripple(this, x, y, 8, C.CAP_R * T, C.MCOL.cap, { duration: 320 });
            this._vfxFlash?.(x, y, 90, C.MCOL.cap, 300, 1);
            this._condSpark(x, y, 18);
            this.cameras.main.shake(70, 0.003);
            Sfx.play(this, 'zap');
        }
        // the bite
        if (on.length && time - (this._condTickAt || 0) >= C.TICK) {
            this._condTickAt = time;
            const web = this._condWebMul(on).dmg * this.damageScaling;   // insulators damp the whole web
            let landed = 0;
            this._noFlash = true;   // it ticks constantly: a white flash each time would wash the pack out
            try {
                for (const w of on) {
                    if (w.e.health <= 0) continue;
                    const cur = C.WIRE_DMG * (w.closed ? C.CIRCUIT : 1);
                    if (w.mode === 'cap') { w.store += cur * this._condWebMul(on).dmg; continue; }   // banked, not taken
                    this._condHit(w.e, cur * web * (w.mode === 'ins' ? C.INS_TAKE : 1));
                    if (this._dmgLanded) landed++;
                }
                for (const [e, n] of touch) if (e.health > 0) { this._condHit(e, C.CROSS_DMG * Math.min(2 * C.CIRCUIT, n) * web); if (this._dmgLanded) { landed++; this._condSpark(e.sprite.x, e.sprite.y - 4, 3); } }
            } finally { this._noFlash = false; }
            if (landed) {
                this.gainUltCharge(this.ultChargePerLightningHit * 0.1 * Math.min(6, landed), 'lightning');
            }
        }
        // held R keeps the currents coming, one each time it's ready (the key press itself fires the first: GameScene)
        if (wield && !this._pauseMenuOpen) {
            const rk = this._condRKey ||= this.input.keyboard.addKey(Settings.key('surge'), false);   // (cleared each level start: GameScene)
            if (rk?.isDown && time - (rk.timeDown || 0) > 250) this._conductorOverload(true);
        }
        // the meter over you
        if (!wield) { this._condBar?.destroy(); this._condBar = null; return; }
        const bar = (this._condBar?.active ? this._condBar : (this._condBar = this.add.graphics().setDepth(6))).clear();
        UIKit.rBar(bar, this.player.x - 18, this.player.y - 17, 40, Math.min(1, (time - (this._condPulseAt || 0)) / C.PULSE_CD), { col: C.COL, hot: C.HOT, dark: 0x14100a, time });   // R: the current, filling back
        const ix = this.player.x + 31, iy = this.player.y - 14, mode = this._condMode || 'live', mc = C.MCOL[mode];   // what the next clamp is
        bar.fillStyle(0x14100a, 0.85).fillRect(ix - 7, iy - 6, 14, 12);
        bar.lineStyle(1, mc, 1).strokeRect(ix - 7, iy - 6, 14, 12);
        bar.lineStyle(1.5, mc, 1);
        if (mode === 'live') bar.strokePoints([{ x: ix + 2, y: iy - 5 }, { x: ix - 2, y: iy }, { x: ix + 2, y: iy }, { x: ix - 2, y: iy + 5 }], false);   // a bolt
        else if (mode === 'ins') for (let k = 0; k < 3; k++) bar.strokeEllipse(ix, iy - 3 + k * 3, 9 - k * 2, 2.5);   // a stack of insulator discs
        else { bar.lineBetween(ix - 2, iy - 4, ix - 2, iy + 4); bar.lineBetween(ix + 2, iy - 4, ix + 2, iy + 4); bar.lineBetween(ix - 6, iy, ix - 2, iy); bar.lineBetween(ix + 2, iy, ix + 6, iy); }   // capacitor plates
    }
    // R: a current down the wire nearest your cursor's direction (ready every PULSE_CD)
    _conductorOverload(quiet = false) {
        const C = this._conductorCfg(), now = this.time.now, cam = this.cameras.main, p = this.input.activePointer, ap = this._aim?.(p) || p;
        const { x: px, y: py } = this._condTip(), aim = Math.atan2(ap.y + cam.scrollY - py, ap.x + cam.scrollX - px);
        const best = (this._condWires || []).filter(w => w.on && w.e.sprite?.active && w.e.health > 0)
            .map(w => [w, Math.abs(Phaser.Math.Angle.Wrap(Math.atan2(w.e.sprite.y - py, w.e.sprite.x - px) - aim))]).sort((a, b) => a[1] - b[1])[0];
        if (!best) { if (!quiet) { this.showStatusText(this.player.x, this.player.y - 28, 'NO WIRES OUT', '#c8b060'); Sfx.play(this, 'deny'); } return; }
        if (now - (this._condPulseAt || 0) < C.PULSE_CD) return;
        this._condPulseAt = now; this._gearFiredAt = now;
        this._condPulse(best[0]);
    }

    ballLightningAttack(targetX, targetY) {
        const C = this._blCfg();
        const now = this.time.now;
        if (now - (this._lastBallTime || 0) < C.COOLDOWN) return;
        this._lastBallTime = now;
        this._gearFiredAt = now;   // the held weapon swings now (Creatures.gear)

        const TS = this.TILE_SIZE;
        const px = this._shotX(), py = this._shotY();   // from the slime as drawn
        const wx = targetX + this.cameras.main.scrollX;
        const wy = targetY + this.cameras.main.scrollY;
        const dx = wx - px, dy = wy - py;
        const len = Math.hypot(dx, dy) || 1;

        const gfx = this.add.graphics().setDepth(4);
        gfx.x = px; gfx.y = py;

        if (!this.ballLightnings) this.ballLightnings = [];
        const orb = {
            gfx, vx: (dx / len) * C.SPEED, vy: (dy / len) * C.SPEED,
            charge: C.CHARGE, maxCharge: C.CHARGE,
            lastPulse: now, born: now, hitThisPulse: new Set(), _done: false
        };
        this.ballLightnings.push(orb);
        this._drawBallGfx(orb, C);
        this.cameras.main.shake(20, 0.001);
    }

    // Charge drives the whole look: it dims, shrinks and loses its corona as it drains, so
    // "how much is left" is legible without a bar anywhere on screen.
    //
    // Redrawn EVERY FRAME, not just on discharge. The first version only redrew when it fired,
    // so between shots it was a frozen picture of a few strokes -- which is why it read as
    // cheap. A plasma ball has to be in constant motion to look like one.
    _drawBallGfx(orb, C) {
        const g = orb.gfx;
        if (!g?.active) return;
        const f = Math.max(0, orb.charge / orb.maxCharge);
        const t = (this.time.now - orb.born) / 1000;
        // The ball is pixel art (ballLightningKey) in a soft glow; it shrinks and dims as it drains.
        if (!orb.spr) {
            const key = WeaponSystem.ballLightningKey(this);
            orb.spr = this.add.sprite(g.x, g.y, key, '0').setDepth(3.95);
            if (this.anims.exists(key)) { orb.spr.play(key); orb.spr.anims.timeScale = 2.5; }
            orb.glow = this.add.image(g.x, g.y, 'vfx_glow').setTint(0x5ac8ff).setBlendMode(Phaser.BlendModes.ADD).setDepth(3.9);
            g.once('destroy', () => { orb.spr.destroy(); orb.glow.destroy(); });
        }
        const sc = (0.7 + 0.5 * f) * (1 + Math.sin(t * 9) * 0.04);
        orb.spr.setPosition(g.x, g.y).setScale(sc).setAlpha(0.6 + 0.4 * f);
        orb.glow.setPosition(g.x, g.y).setScale((0.4 + 0.3 * f) * (1 + Math.sin(t * 7) * 0.08)).setAlpha(0.3 + 0.3 * f);
        g.clear();

        // ── LIVE ARCS: jagged, re-randomised every frame so the edge writhes; how many is the
        // charge readout.
        const r = 11 * sc;
        const arcs = Math.round(2 + f * 4);
        for (let k = 0; k < arcs; k++) {
            const a = Math.random() * Math.PI * 2;
            const out = r * (1.3 + Math.random() * 1.1);
            const pts = this._arcPath(Math.cos(a) * r * 0.9, Math.sin(a) * r * 0.9,
                                      Math.cos(a + 0.3) * out, Math.sin(a + 0.3) * out, 3, 0.35);
            this._strokeArc(g, pts, 2, 0x5ae6ff, 0.25 + f * 0.25);
            this._strokeArc(g, pts, 1, 0xffffff, 0.6 + f * 0.3);
        }
        // ── SPARKS riding the corona, so the silhouette is never a clean circle
        const sparks = Math.round(2 + f * 3);
        g.fillStyle(0xe8fbff, 0.7 + f * 0.3);
        for (let k = 0; k < sparks; k++) {
            const a = t * 3.5 + (k / sparks) * Math.PI * 2;
            const rr = r * (1.45 + Math.sin(t * 6 + k) * 0.25);
            g.fillRect(Math.round(Math.cos(a) * rr), Math.round(Math.sin(a) * rr), 2, 2);
        }
    }

    updateBallLightnings(time, delta) {
        if (!this.ballLightnings?.length) return;
        const C = this._blCfg();
        const TS = this.TILE_SIZE;
        const dt = (delta || 16) / 1000;

        for (let i = this.ballLightnings.length - 1; i >= 0; i--) {
            const orb = this.ballLightnings[i];
            if (orb._done) {
                if (orb.gfx?.active) orb.gfx.destroy();
                this.ballLightnings.splice(i, 1);
                continue;
            }
            if (orb._embedded) { this._updateEmbeddedBall(orb, time, C); continue; }
            orb.gfx.x += orb.vx * dt;
            orb.gfx.y += orb.vy * dt;
            this._drawBallGfx(orb, C);      // every frame: the surface has to writhe

            const tx = Math.floor(orb.gfx.x / TS), ty = Math.floor(orb.gfx.y / TS);
            // Bursts on a WALL rather than bouncing -- the inversion against Orb Emitter, and
            // it makes aiming at the wall behind a pack a deliberate detonation.
            const oob = tx < 0 || tx >= this.WORLD_WIDTH || ty < 0 || ty >= this.WORLD_HEIGHT;
            if (oob || this.world[tx]?.[ty] === this.WALL || this.world[tx]?.[ty] === this.NOTHING
                || this.isInLockedRoom(tx, ty)) {
                this._burstBallLightning(orb, C);
                continue;
            }

            // DIRECT CONTACT EMBEDS. Not a burst -- the orb buries itself in the enemy's core
            // and becomes a bomb carried by that enemy. The earlier version detonated on
            // contact, which ended the orb 3.6 tiles in and skipped the whole grinding phase;
            // embedding keeps the orb alive AND gives the contact a purpose.
            let host = null;
            for (const e of this.enemies) {
                if (!e.sprite?.active || this._phasedOut(e)) continue;
                if (Math.hypot(e.sprite.x - orb.gfx.x, e.sprite.y - orb.gfx.y) <= TS * C.DIRECT_R) {
                    host = e; break;
                }
            }
            if (host) { this._embedBall(orb, host, C); continue; }
            // A boss or a queen is not in this.enemies: the orb flew straight through them and
            // never touched one. Meeting one, it stops there and grinds (every discharge arcs into
            // it, see _ballDischarge) until its charge runs out, or bursts if the boss leaves it.
            {
                const near = [this.voltslimeBoss, this.voidSovereignBoss].find(b => b?.active && b.container?.visible
                        && Math.hypot(b.container.x - orb.gfx.x, b.container.y - 14 - orb.gfx.y) <= TS * 1.6)
                    || (this.portals || []).find(q => q.active && this._portalCoversTile?.(q, tx, ty));
                if (near && !orb._onBoss) { orb._onBoss = near; orb.vx = 0; orb.vy = 0; }
                else if (!near && orb._onBoss) { this._burstBallLightning(orb, C); continue; }
            }

            // NO DIRECT-HIT DETONATION. It was in the original design and it did work, but
            // measured against five enemies in a row it ended the orb 3.6 tiles in after three
            // discharges -- the slow grinding forker, which is the whole middle of the weapon,
            // never happened. It only bursts now on a WALL or on running out of charge, so the
            // orb always gets to travel and fork, and the burst lands where the charge ran out
            // (which in a crowd is inside the crowd).
            if (time - orb.lastPulse >= C.PULSE_MS) {
                orb.lastPulse = time;
                const arcs = this._ballDischarge(orb, C);
                orb.charge -= C.COST_IDLE + arcs * C.COST_ARC;
                if (orb.charge <= 0) { this._burstBallLightning(orb, C); continue; }
            }
        }
    }

    // ── CASCADING FORK ───────────────────────────────────────────────────────
    // Draws and damages a tree of arcs: origin -> each seed enemy (tier 0), then each of those
    // -> up to FORK_LINK_N nearby enemies (tier 1), and those onward again (tier 2).
    //
    // An enemy can be struck by several arcs, once per INCOMING fork, which is the point -- with
    // three enemies clustered, every one of them takes the direct arc plus arcs relayed from
    // both others. Arc count therefore grows much faster than enemy count, and since charge is
    // spent per arc, a dense pack burns the orb out quickly all on its own.
    //
    // Returns the number of arcs drawn, which is the charge cost basis.
    _cascadeForks(g, originX, originY, seeds, C, baseDmg, colour) {
        const TS = this.TILE_SIZE;
        const linkR = C.FORK_LINK_R * TS;
        let arcs = 0;

        // Each entry: { from: {x,y}, to: enemy, tier }. Breadth-first so tiers resolve in order.
        let frontier = seeds.map(e => ({ fx: originX, fy: originY, to: e, tier: 0 }));
        // Tracks how many times an enemy has RELAYED, not how often it was hit -- a relay hub
        // that fans out on every tier would double back and loop.
        const relayed = new Set(), zapSeen = [];

        while (frontier.length && arcs < C.FORK_CAP) {
            const next = [];
            for (const link of frontier) {
                if (arcs >= C.FORK_CAP) break;
                const e = link.to;
                if (!e.sprite?.active) continue;
                const tx = e.sprite.x, ty = e.sprite.y + 4;
                const alpha = 1 - link.tier * 0.28;
                // An arc relayed THROUGH water is drawn cyan, so you can see the pool doing the
                // work rather than just noticing more damage numbers than usual.
                const arcCol = link.viaWater ? 0x66ddff : colour;
                this._strokeFork(g, link.fx, link.fy, tx, ty, arcCol, alpha, link.tier === 0 ? 2 : 1);
                g.fillStyle(0xffffff, 0.8 - link.tier * 0.2);
                g.fillCircle(tx, ty, 3 - link.tier * 0.6);
                arcs++;

                const dmg = baseDmg * Math.pow(C.FORK_FALLOFF, link.tier) * this.damageScaling;
                const _rdFork = this.resolveElementalHit(e, dmg, 'lightning');
                if (_rdFork !== null) {
                    e.health -= _rdFork;
                    this.showDamageNumber(e.sprite.x, e.sprite.y - 10 - link.tier * 6,
                                          Math.round(_rdFork), link.tier ? '#ffffaa' : '#ffee66');
                    this.updateEnemyHealthBar(e);
                    this.gainUltCharge(this.ultChargePerLightningHit * 0.2);
                    if (e.health <= 0) { this.killEnemy(e); continue; }
                }
                this._zapBosses(e, dmg, C.FORK_LINK_R, zapSeen);   // and Queens and bosses in reach, once a cascade

                if (link.tier >= C.FORK_TIERS || relayed.has(e)) continue;
                relayed.add(e);

                // ── WATER RELAY ──────────────────────────────────────────────
                // Standing in water, this enemy relays along the whole POOL rather than to its
                // nearest neighbours. Distance stops mattering: what matters is who shares the
                // puddle, so a pipe-fed lane becomes a conductor the cascade runs down.
                const wet = typeof this.isWaterAt === 'function' && this.isWaterAt(e.x, e.y);
                if (wet && typeof this.enemiesSharingPool === 'function') {
                    const shared = this.enemiesSharingPool(e.x, e.y, C.WATER_POOL_CAP)
                        .filter(o => o !== e && !relayed.has(o) && !this._phasedOut(o));
                    if (shared.length) {
                        for (const o of shared.slice(0, C.WATER_RELAY_N)) {
                            next.push({ fx: tx, fy: ty, to: o, tier: link.tier + 1, viaWater: true });
                        }
                        continue;   // the pool replaces the proximity relay, it does not stack
                    }
                }

                const onward = [];
                for (const o of this.enemies) {
                    if (o === e || !o.sprite?.active || this._phasedOut(o)) continue;
                    const d = Math.hypot(o.sprite.x - tx, o.sprite.y - ty);
                    if (d > linkR) continue;
                    onward.push({ o, d });
                }
                onward.sort((a, b) => a.d - b.d);
                for (const { o } of onward.slice(0, C.FORK_LINK_N)) {
                    next.push({ fx: tx, fy: ty, to: o, tier: link.tier + 1 });
                }
            }
            frontier = next;
        }
        return arcs;
    }

    // One discharge. Returns the number of arcs drawn, which is what the charge cost is computed
    // from -- so a discharge into a crowd is worth far more AND costs far more.
    _ballDischarge(orb, C) {
        const TS = this.TILE_SIZE;
        const R = C.PULSE_R * TS;
        const ox = orb.gfx.x, oy = orb.gfx.y;

        const seeds = [];
        for (const e of [...this.enemies]) {
            if (!e.sprite?.active) continue;
            if (Math.hypot(e.sprite.x - ox, e.sprite.y - oy) > R) continue;
            if (this._phasedOut(e)) continue;
            seeds.push(e);
        }

        const g = this.add.graphics().setDepth(3.8);
        let arcs = 0;
        if (seeds.length) arcs = this._cascadeForks(g, ox, oy, seeds, C, C.PULSE_DMG, C.COLOR);
        // Bosses and queens are not in this.enemies: they take the direct arc too.
        for (const b of [this.voltslimeBoss, this.voidSovereignBoss]) {
            if (!b?.active || !b.container?.visible) continue;
            const bx = b.container.x, by = b.container.y - 14;
            if (Math.hypot(bx - ox, by - oy) > R + TS) continue;
            this._strokeFork(g, ox, oy, bx, by, C.COLOR, 0.9, 2);
            this.damageBossAtTile(b.tileX, b.tileY, C.PULSE_DMG * this.damageScaling, 'ball_arc', 'lightning');
            arcs++;
        }
        for (const q of this.portals || []) {
            if (!q.active) continue;
            const qx = q.tileX * TS + TS / 2, qy = q.tileY * TS + TS / 2 + (q.hitOffY || 0);
            if (Math.hypot(qx - ox, qy - oy) > R + TS) continue;
            this._strokeFork(g, ox, oy, qx, qy, C.COLOR, 0.9, 2);
            this.damagePortal(q, C.PULSE_DMG * this.damageScaling);
            arcs++;
        }

        // A couple of forks into EMPTY space as well, so the orb reads as constantly
        // discharging rather than only ever pointing at enemies.
        for (let k = 0; k < 2; k++) {
            const a = Math.random() * Math.PI * 2;
            const d = R * (0.3 + Math.random() * 0.4);
            this._strokeFork(g, ox, oy, ox + Math.cos(a) * d, oy + Math.sin(a) * d,
                             C.COLOR, 0.40, 1);
        }
        // Short life: a fork is a strike, not a beam. It re-strikes on the next cadence.
        this.time.delayedCall(60, () => {
            if (!g.active) return;
            this.tweens.add({ targets: g, alpha: 0, duration: 120,
                              onComplete: () => g.destroy() });
        });
        return arcs;
    }

    // ── EMBEDDING ────────────────────────────────────────────────────────────
    // The orb stops, rides the host's sprite, and arcs between nearby enemies on a timer. When
    // the timer expires it detonates INSIDE the host -- and the host takes only
    // DETONATE_HOST_FRAC of it. The brunt goes to everything around it.
    //
    // That split is the whole idea: the enemy you hit becomes a delivery mechanism rather than
    // the victim. It also means the correct target is a body on the EDGE of a pack, not the one
    // you most want dead, which is a genuinely different aiming instinct from every other
    // weapon in the game.
    _embedBall(orb, host, C) {
        if (orb._done || orb._embedded) return;
        orb._embedded = true;
        orb.host = host;
        host._ballHost = orb;

        // Contact damage is decent -- the host is not getting away with being a carrier.
        const _rdEmbed = this.resolveElementalHit(host, C.EMBED_HIT * this.damageScaling, 'lightning');
        if (_rdEmbed !== null) {
            host.health -= _rdEmbed;
            this.showDamageNumber(host.sprite.x, host.sprite.y - 12, Math.round(_rdEmbed), '#ffffff');
            this.updateEnemyHealthBar(host);
            this.gainUltCharge(this.ultChargePerLightningHit);
        }
        this.showStatusText?.(host.sprite.x, host.sprite.y - 24, 'EMBEDDED', '#ffee66');

        const flash = this.add.circle(host.sprite.x, host.sprite.y, 6, 0xffffff, 0.9).setDepth(5);
        this.tweens.add({ targets: flash, radius: 22, alpha: 0, duration: 200,
                          onComplete: () => flash.destroy() });
        this.cameras.main.shake(70, 0.002);

        orb.embedEnd = this.time.now + C.EMBED_MS;
        orb.lastEmbedTick = this.time.now;
        // Host DPS is tracked separately from the arc cadence and accumulated as a FRACTION of
        // a frame, so the total over the embed is exactly EMBED_HOST_DPS * EMBED_MS regardless
        // of frame rate. Tying it to the arc ticks instead would make the damage depend on how
        // the two timers happened to line up.
        orb.hostDpsAt = this.time.now;
        // If the host dies early the orb detonates where it stood -- the payload is not lost
        // just because the carrier did not survive its own delivery.
        orb._hostWasAt = { x: host.sprite.x, y: host.sprite.y };
    }

    // Per-frame while embedded. Split out of updateBallLightnings because an embedded orb shares
    // almost nothing with a travelling one: it does not move, does not spend charge on distance,
    // and ends on a timer rather than on geometry.
    _updateEmbeddedBall(orb, time, C) {
        const host = orb.host;
        if (host?.sprite?.active && !this._phasedOut(host)) {
            orb.gfx.x = host.sprite.x;
            orb.gfx.y = host.sprite.y;
            orb._hostWasAt = { x: host.sprite.x, y: host.sprite.y };
        } else {
            // Host died mid-carry: detonate at its last position immediately.
            this._detonateEmbedded(orb, C);
            return;
        }
        this._drawBallGfx(orb, C);
        this._superconduct(host, 1000);   // embedded, it superconducts its host for as long as it's lodged there (and a second after)

        // ── PERSISTENT DPS ON THE HOST ───────────────────────────────────────
        // It is burning a hole in whatever it is lodged in for the whole duration, so carrying
        // the bomb costs the host continuously rather than only at the two bookend moments.
        const dtSec = Math.max(0, (time - (orb.hostDpsAt || time)) / 1000);
        orb.hostDpsAt = time;
        if (dtSec > 0) {
            // Rate scales with how many enemies the last arc tick actually reached. A carrier
            // standing alone is barely warm; one inside a pack is being cooked by its own
            // neighbours' conductivity.
            const spread = orb.lastArcTargets || 0;
            const frac = C.EMBED_DPS_FLOOR +
                (1 - C.EMBED_DPS_FLOOR) * Math.min(1, spread / C.EMBED_DPS_FULL_AT);
            const tick = C.EMBED_HOST_DPS * frac * dtSec * this.damageScaling;
            const _rdHostDps = this.resolveElementalHit(host, tick, 'lightning');
            if (_rdHostDps !== null) {
                host.health -= _rdHostDps;
                // Accumulate into a visible number rather than spamming a 0.15 every frame.
                orb._dpsShown = (orb._dpsShown || 0) + _rdHostDps;
                if (orb._dpsShown >= 3) {
                    this.showDamageNumber(host.sprite.x, host.sprite.y - 6,
                                          Math.round(orb._dpsShown), '#ffcc44');
                    orb._dpsShown = 0;
                }
                this.updateEnemyHealthBar(host);
                if (host.health <= 0) {
                    this.killEnemy(host);
                    this._detonateEmbedded(orb, C);
                    return;
                }
            }
        }

        if (time - orb.lastEmbedTick >= C.EMBED_TICK_MS) {
            orb.lastEmbedTick = time;
            const TS = this.TILE_SIZE;
            const R = C.PULSE_R * TS;
            // Arcs go to OTHERS, not the host: the host is the emitter now.
            const seeds = [];
            for (const e of [...this.enemies]) {
                if (e === host || !e.sprite?.active || this._phasedOut(e)) continue;
                if (Math.hypot(e.sprite.x - orb.gfx.x, e.sprite.y - orb.gfx.y) > R) continue;
                seeds.push(e);
            }
            const g = this.add.graphics().setDepth(3.8);
            // Remembered for the host-DPS scaling above: arcs DRAWN, not seeds found, so a pool
            // relay counts toward it too.
            orb.lastArcTargets = seeds.length
                ? this._cascadeForks(g, orb.gfx.x, orb.gfx.y, seeds, C, C.EMBED_TICK_DMG, C.COLOR)
                : 0;
            for (let k = 0; k < 2; k++) {
                const a = Math.random() * Math.PI * 2;
                this._strokeFork(g, orb.gfx.x, orb.gfx.y,
                                 orb.gfx.x + Math.cos(a) * R * 0.3,
                                 orb.gfx.y + Math.sin(a) * R * 0.3, C.COLOR, 0.35, 1);
            }
            this.time.delayedCall(60, () => {
                if (!g.active) return;
                this.tweens.add({ targets: g, alpha: 0, duration: 120,
                                  onComplete: () => g.destroy() });
            });
        }

        if (time >= orb.embedEnd) this._detonateEmbedded(orb, C);
    }

    _detonateEmbedded(orb, C) {
        if (orb._done) return;
        orb._done = true;
        const host = orb.host;
        if (host) host._ballHost = null;
        const at = (host?.sprite?.active)
            ? { x: host.sprite.x, y: host.sprite.y }
            : (orb._hostWasAt || { x: orb.gfx.x, y: orb.gfx.y });
        const TS = this.TILE_SIZE;
        const R = C.DETONATE_R * TS;

        VisualFX.impact(this, at.x, at.y, 'lightning', R * 0.45);
        this._vfxFlash?.(at.x, at.y, R * 0.7, 0xffe14a, 260, 0.6);
        this.cameras.main.shake(160, 0.005);

        const seeds = [];
        for (const e of [...this.enemies]) {
            if (e === host || !e.sprite?.active || this._phasedOut(e)) continue;
            if (Math.hypot(e.sprite.x - at.x, e.sprite.y - at.y) > R) continue;
            seeds.push(e);
        }
        const g = this.add.graphics().setDepth(4);
        if (seeds.length) this._cascadeForks(g, at.x, at.y, seeds, C, C.DETONATE_DMG, 0xffffff);
        this.time.delayedCall(90, () => {
            if (!g.active) return;
            this.tweens.add({ targets: g, alpha: 0, duration: 200,
                              onComplete: () => g.destroy() });
        });

        // The host takes only a fraction. It carried the bomb; it is not the target.
        if (host?.sprite?.active) {
            const raw = C.DETONATE_DMG * C.DETONATE_HOST_FRAC * this.damageScaling;
            const _rdHost = this.resolveElementalHit(host, raw, 'lightning');
            if (_rdHost !== null) {
                host.health -= _rdHost;
                this.showDamageNumber(host.sprite.x, host.sprite.y - 10, Math.round(_rdHost), '#ffffff');
                this.updateEnemyHealthBar(host);
                if (host.health <= 0) this.killEnemy(host);
            }
        }

        // And it still sprays -- the detonation is the burst, at whatever charge is left.
        this._burstBallLightning(orb, C, at);
    }

    // Seeker count scales with charge REMAINING, which is what makes the charge budget a
    // decision rather than just a timer.
    _burstBallLightning(orb, C, originAt) {
        if (orb._done && !originAt) return;
        orb._done = true;
        const f = Math.max(originAt ? C.EMBED_BURST : 0, Math.min(1, orb.charge / orb.maxCharge));
        const count = Math.max(C.SEEKERS_MIN, Math.round(C.SEEKERS_MAX * f));
        const ox = originAt ? originAt.x : orb.gfx.x, oy = originAt ? originAt.y : orb.gfx.y;
        Sfx.play(this, 'blburst');

        VisualFX.impact(this, ox, oy, 'lightning', 28);
        this.cameras.main.shake(90, 0.003);

        // Clear the per-burst saturation counters, or an enemy hit by an earlier burst would
        // be immune to every later one. (Bosses and queens keep the same counter now.)
        for (const e of (this.enemies || [])) e._seekHits = 0;
        for (const b of [this.voltslimeBoss, this.voidSovereignBoss, ...(this.portals || [])]) if (b) b._seekHits = 0;

        if (!this.ballSeekers) this.ballSeekers = [];
        for (let i = 0; i < count; i++) {
            // Angles are RANDOM, not an even fan. `(i / count) * 2PI` spaced them perfectly,
            // which at seventy seekers read as a mechanical starburst -- a rosette, not an
            // explosion. Jittering the slot by most of its own width breaks the ring up while
            // still covering every direction, and randomising SPEED too means the leading edge
            // is ragged instead of a single expanding circle.
            const slot = (i / count) * Math.PI * 2;
            const a = slot + (Math.random() - 0.5) * (Math.PI * 2 / count) * 2.8;
            const spd = C.SEEK_SPEED * (0.62 + Math.random() * 0.76);
            const sg = this.add.graphics().setDepth(4);
            sg.x = ox; sg.y = oy;   // body and trail are drawn per frame in updateBallSeekers
            this.ballSeekers.push({
                gfx: sg, vx: Math.cos(a) * spd, vy: Math.sin(a) * spd,
                // Stagger the birth times slightly so they do not all leave on the same frame.
                born: this.time.now + Math.random() * 90, _done: false,
                // Per-seeker phase, so the crackle on each one is out of step with the others.
                phase: Math.random() * 100
            });
        }
    }

    updateBallSeekers(time, delta) {
        if (!this.ballSeekers?.length) return;
        const C = this._blCfg();
        const TS = this.TILE_SIZE;
        const dt = (delta || 16) / 1000;

        for (let i = this.ballSeekers.length - 1; i >= 0; i--) {
            const s = this.ballSeekers[i];
            if (s._done || time - s.born > C.SEEK_LIFE) {
                if (s.gfx?.active) s.gfx.destroy();
                this.ballSeekers.splice(i, 1);
                continue;
            }
            // Mild homing: enough to feel like it seeks, not enough to be unmissable.
            let best = null, bd = Infinity;
            if (C.SEEK_HOME_R > 0) for (const e of this.enemies) {   // off (0): skip the scan, it's per seeker per frame
                if (!e.sprite?.active || this._phasedOut(e)) continue;
                const d = Math.hypot(e.sprite.x - s.gfx.x, e.sprite.y - s.gfx.y);
                if (d < bd) { bd = d; best = e; }
            }
            // Homing radius is DELIBERATELY SHORT. At 6 tiles every seeker in the burst
            // converged on the same lone enemy and the whole payload landed on one target --
            // measured as 44 damage to a single enemy against 85 to eight, which inverts the
            // element's identity instead of expressing it. A seeker should correct its aim,
            // not seek across the room.
            if (best && bd < TS * C.SEEK_HOME_R) {
                const ax = (best.sprite.x - s.gfx.x) / bd, ay = (best.sprite.y - s.gfx.y) / bd;
                s.vx += ax * 900 * dt; s.vy += ay * 900 * dt;
                const sp = Math.hypot(s.vx, s.vy) || 1;
                s.vx = s.vx / sp * C.SEEK_SPEED; s.vy = s.vy / sp * C.SEEK_SPEED;
            }
            // Advance in substeps, testing collisions after each, so a fast seeker cannot
            // tunnel through a body between frames.
            const steps = C.SEEK_SUBSTEPS;
            const sdt = dt / steps;
            for (let k = 0; k < steps && !s._done; k++) {
                s.gfx.x += s.vx * sdt; s.gfx.y += s.vy * sdt;

                const tx = Math.floor(s.gfx.x / TS), ty = Math.floor(s.gfx.y / TS);
                if (this.world[tx]?.[ty] === this.WALL || this.world[tx]?.[ty] === this.NOTHING) {
                    s._done = true; break;
                }
                // Bosses and queens are not in this.enemies; a seeker meeting one strikes it (as
                // many per burst as an enemy may absorb).
                {
                    const boss = [this.voltslimeBoss, this.voidSovereignBoss].find(b => b?.active && b.container?.visible
                        && Math.hypot(b.container.x - s.gfx.x, b.container.y - 14 - s.gfx.y) <= TS * 1.2);
                    const queen = boss ? null : (this.portals || []).find(q => q.active && this._portalCoversTile?.(q, tx, ty));
                    const hit = boss || queen;
                    if (hit && (hit._seekHits || 0) < C.SEEK_MAX_PER) {
                        hit._seekHits = (hit._seekHits || 0) + 1;
                        if (boss) this.damageBossAtTile(boss.tileX, boss.tileY, C.SEEK_DMG * this.damageScaling, undefined, 'lightning');
                        else this.damagePortal(queen, C.SEEK_DMG * this.damageScaling);
                        s._done = true; break;
                    }
                }
                for (const e of this.enemies) {   // no copy: the loop breaks right after a hit (a kill may splice)
                    if (!e.sprite?.active || this._phasedOut(e)) continue;
                    if (Math.abs(e.sprite.x - s.gfx.x) > TS * 0.6 || Math.abs(e.sprite.y - s.gfx.y) > TS * 0.6) continue;
                    if (Math.hypot(e.sprite.x - s.gfx.x, e.sprite.y - s.gfx.y) > TS * 0.6) continue;
                    // One enemy can only absorb SEEK_MAX_PER seekers. Without a cap the burst is
                    // just single-target damage whenever anything is closest, which is the same
                    // failure as the wide homing radius: the split stops being about the crowd.
                    e._seekHits = (e._seekHits || 0) + 1;
                    if (e._seekHits > C.SEEK_MAX_PER) { e._seekHits = C.SEEK_MAX_PER; continue; }
                    this._seekerHit(s, e, C);
                    break;
                }
            }
            if (s._done) continue;
            // Redrawn every frame as a small CRACKLING ball, not a dot with a line behind it.
            // Each one is a miniature of the parent orb -- glow, body, hot core, and two short
            // arcs writhing off the surface that re-randomise per frame. A plain circle at this
            // size reads as a bullet; the arcs are what say "electricity".
            const g = s.gfx;
            const r = C.SEEK_R;
            g.clear();
            const back = Math.hypot(s.vx, s.vy) || 1;
            const bx = -(s.vx / back) * 13, by = -(s.vy / back) * 13;
            g.lineStyle(r * 1.3, 0xffee66, 0.18); g.lineBetween(0, 0, bx, by);
            g.lineStyle(1.4, 0xffffcc, 0.55);     g.lineBetween(0, 0, bx * 0.55, by * 0.55);

            g.fillStyle(0xaaffff, 0.16); g.fillCircle(0, 0, r * 1.7);
            g.fillStyle(0xffee66, 0.62); g.fillCircle(0, 0, r);
            g.fillStyle(0xfff6b0, 0.85); g.fillCircle(0, 0, r * 0.62);
            g.fillStyle(0xffffff, 1.00); g.fillCircle(0, 0, r * 0.30);
            // ONE arc, and only on some frames. At seventy seekers, two arc paths each per
            // frame is 140 path builds plus 280 strokes every 16ms -- the crackle is not worth
            // that. Drawing it ~60% of frames costs a third as much AND flickers, which reads
            // as more electrical than a steady pair of arcs did.
            if (Math.random() < 0.6) {
                const a = (s.phase || 0) + Math.random() * Math.PI * 2;
                const pts = this._arcPath(Math.cos(a) * r * 0.5, Math.sin(a) * r * 0.5,
                                          Math.cos(a) * r * 2.1, Math.sin(a) * r * 2.1, 3, 0.4);
                this._strokeArc(g, pts, 1.6, 0x99eeff, 0.35);
                this._strokeArc(g, pts, 0.8, 0xffffff, 0.8);
            }
        }
    }

    // Consumed on contact. The impact FORKS to nearby enemies rather than applying an invisible
    // radius of damage -- with thirty of these landing across a pack, the arcs between them are
    // most of what the burst looks like.
    _seekerHit(seeker, enemy, C) {
        seeker._done = true;
        Sfx.play(this, 'zap', { soft: true });
        const TS = this.TILE_SIZE;
        const hx = seeker.gfx.x, hy = seeker.gfx.y;

        const g = this.add.graphics().setDepth(3.6);
        g.fillStyle(0xffffff, 0.9); g.fillCircle(hx, hy, 3.5);
        g.fillStyle(0xffee66, 0.35); g.fillCircle(hx, hy, 7);

        // Direct target first, at full seeker damage. Named _rd* because the resistance check scans
        // for `.health -=` whose value did not come out of resolveElementalHit -- a local called
        // `direct` reads better and trips that guard, so the convention wins.
        const _rdSeekDirect = this.resolveElementalHit(enemy, C.SEEK_DMG * this.damageScaling, 'lightning');
        if (_rdSeekDirect !== null) {
            enemy.health -= _rdSeekDirect;
            this.showDamageNumber(enemy.sprite.x, enemy.sprite.y - 10, Math.round(_rdSeekDirect), '#ffffaa');
            this.updateEnemyHealthBar(enemy);
            this.gainUltCharge(this.ultChargePerLightningHit * 0.1);
            if (enemy.health <= 0) this.killEnemy(enemy);
        }

        // Then fork onward to the nearest few others.
        const R = C.SEEK_ZAP_R * TS;
        const near = [];
        for (const e of this.enemies) {
            if (e === enemy || !e.sprite?.active || this._phasedOut(e)) continue;
            const d = Math.hypot(e.sprite.x - hx, e.sprite.y - hy);
            if (d <= R) near.push({ e, d });
        }
        near.sort((a, b) => a.d - b.d);
        for (const { e } of near.slice(0, C.SEEK_ZAP_N)) {
            this._strokeFork(g, hx, hy, e.sprite.x, e.sprite.y + 4, 0xffffcc, 0.75, 1);
            const _rdZap = this.resolveElementalHit(e, C.SEEK_ZAP_DMG * this.damageScaling, 'lightning');
            if (_rdZap === null) continue;
            e.health -= _rdZap;
            this.showDamageNumber(e.sprite.x, e.sprite.y - 10, Math.round(_rdZap), '#ffffcc');
            this.updateEnemyHealthBar(e);
            if (e.health <= 0) this.killEnemy(e);
        }

        this.tweens.add({ targets: g, alpha: 0, duration: 200,
                          onComplete: () => g.destroy() });
    }

    // ══════════════════════════════════════════════════════════════════════
    // WRENCH — TowerDefenseScene only
    // ══════════════════════════════════════════════════════════════════════
    //
    // NOT reachable from the overworld any more: Ball Lightning replaced Engineering Degree
    // and no weapon id dispatches here. These stay because TowerDefenseScene is built on them
    // -- it has a whole Wrench upgrade tab (damage, extra bounces, Long Arm, Quick Release,
    // Gold and Diamond reforges) and its overrides call straight into these as base behaviour:
    //
    //   TowerDefenseScene.engineeringDegreeAttack -> WeaponSystem.prototype.engineeringDegreeAttack
    //   TowerDefenseScene._throwWrenchArc         -> WeaponSystem.prototype._throwWrenchArc
    //   TowerDefenseScene._wrenchImpact           -> WeaponSystem.prototype._wrenchImpact
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

    // ══════════════════════════════════════════════════════════════════════
    // ORB EMITTER — bouncing electric orb, marks + forks lightning on hit
    // ══════════════════════════════════════════════════════════════════════
    // Where a shot leaves from: the slime as it's drawn, not its tile (a dash moves the tile at once and the body
    // catches up, so shots fired mid-dash came out of the far end)
    _shotX() { return this.player?.active ? this.player.x : this.playerX * this.TILE_SIZE + this.TILE_SIZE / 2; }
    _shotY() { return this.player?.active ? this.player.y - (this.SLIME_Y_OFFSET || 0) : this.playerY * this.TILE_SIZE + this.TILE_SIZE / 2; }
    orbEmitterAttack(targetX, targetY) {
        const currentTime = this.time.now;
        if (currentTime - (this._lastOrbTime || 0) < 700) return;
        this._lastOrbTime = currentTime;
        this._gearFiredAt = currentTime;   // the held weapon swings now (Creatures.gear)

        const worldX = targetX + this.cameras.main.scrollX;
        const worldY = targetY + this.cameras.main.scrollY;
        const px = this.player.x, py = this.player.y;
        const dx = worldX - px, dy = worldY - py;
        const len = Math.sqrt(dx*dx + dy*dy) || 1;

        const ORB_SPEED = 300; // px/s
        const ORB_DMG   = 10 * this.damageScaling;
        const FORK_RANGE = 3 + 0.5 * WeaponLevels.perk('orb_emitter', 'forks'); // tiles
        const MAX_BOUNCES = 10;

        // The orb: a tesla sphere (orbEmitterKey) in a glow, with live arcs drawn each frame
        const gfx = this.add.container(px, py).setDepth(4);
        const okey = WeaponSystem.orbEmitterKey(this);
        const glow = this.add.image(0, 0, 'vfx_glow').setTint(0xffd84a).setBlendMode(Phaser.BlendModes.ADD).setScale(0.3).setAlpha(0.55);
        const body = this.add.sprite(0, 0, okey, '0');
        if (this.anims.exists(okey)) { body.play(okey); body.anims.timeScale = 2.5; }
        const arcs = this.add.graphics().setBlendMode(Phaser.BlendModes.ADD);
        gfx.add([glow, arcs, body]);
        gfx._glow = glow; gfx._arcs = arcs; gfx._body = body;
        // muzzle: a snap of light at the slime
        const flash = this.add.image(px + dx / len * 10, py + dy / len * 10, 'vfx_glow').setTint(0xfff6b0).setBlendMode(Phaser.BlendModes.ADD).setDepth(4).setScale(0.15);
        this.tweens.add({ targets: flash, scale: 0.4, alpha: 0, duration: 160, onComplete: () => flash.destroy() });

        if (!this.lightningOrbs) this.lightningOrbs = [];
        this.lightningOrbs.push({
            gfx,
            vx: (dx/len) * ORB_SPEED,
            vy: (dy/len) * ORB_SPEED,
            damage: ORB_DMG,
            bouncesLeft: MAX_BOUNCES,
            forkRange: FORK_RANGE,
            hitEnemies: new Set(), // enemies already hit this flight
            _createdAt: currentTime,
        });
        this.cameras.main.shake(15, 0.001);
    }

    _drawOrbEmitterGfx(gfx) {
        if (gfx._arcs) {   // the tesla orb: arcs reaching for what's close, and crawling over the shell
            const g = gfx._arcs, TS = this.TILE_SIZE, now = this.time.now;
            g.clear();
            gfx._glow.setScale(0.28 + 0.04 * Math.sin(now * 0.04) + Math.random() * 0.03);
            let n = 0;
            for (const e of this.enemies || []) {
                if (this._phasedOut?.(e)) continue;
                if (n >= 3 || !e.sprite?.active) continue;
                const ex = e.sprite.x - gfx.x, ey = e.sprite.y - gfx.y;
                if (ex * ex + ey * ey > (TS * 2.6) ** 2 || Math.random() < 0.35) continue;
                const pts = this._arcPath(0, 0, ex, ey, 5, 0.3);
                this._strokeArc(g, pts, 4, 0x88ddff, 0.25);
                this._strokeArc(g, pts, 1.4, 0xffffff, 0.85);
                n++;
            }
            for (let i = 0; i < 2; i++) {
                if (Math.random() < 0.4) continue;
                const a = Math.random() * Math.PI * 2, r0 = 10, r1 = 15 + Math.random() * 8;
                const pts = this._arcPath(Math.cos(a) * r0, Math.sin(a) * r0, Math.cos(a + 0.6) * r1, Math.sin(a + 0.6) * r1, 3, 0.4);
                this._strokeArc(g, pts, 2.5, 0xffe066, 0.3);
                this._strokeArc(g, pts, 1, 0xfffbe0, 0.9);
            }
            return;
        }
        gfx.clear();
        // Outer glow
        gfx.fillStyle(0xffff00, 0.20);
        gfx.fillCircle(0, 0, 14);
        // Mid ring
        gfx.fillStyle(0xffdd00, 0.50);
        gfx.fillCircle(0, 0, 9);
        // Core
        gfx.fillStyle(0xffffff, 0.95);
        gfx.fillCircle(0, 0, 5);
        // Electric arc lines
        gfx.lineStyle(1.5, 0xffff88, 0.80);
        for (let i = 0; i < 5; i++) {
            const a = (i / 5) * Math.PI * 2;
            const r = 7 + Math.random() * 4;
            gfx.beginPath();
            gfx.moveTo(Math.cos(a)*4, Math.sin(a)*4);
            gfx.lineTo(Math.cos(a)*r, Math.sin(a)*r);
            gfx.strokePath();
        }
        // Orbit ring
        gfx.lineStyle(1.5, 0xffdd00, 0.55);
        gfx.strokeCircle(0, 0, 11);
    }

    // Superconduct an enemy (lightning carries further from it): the Orb Emitter's hits, and
    // Ball Lightning while it's embedded in one. Refreshes the mark if it's already on.
    _superconduct(enemy, ms = this.superConductDuration || 5000) {
        if (!enemy?.sprite?.active || this._phasedOut(enemy)) return;
        if (enemy._immuneFx === 'lightning') { if (enemy.sprite?.active && this.time.now - (enemy._fxNoAt || 0) > 900) { enemy._fxNoAt = this.time.now; this.showStatusText(enemy.sprite.x, enemy.sprite.y - 30, "CAN'T CONDUCT", '#fff080'); } return; }   // an Adaptive Shade in its lightning form
        enemy.isSuperConducted = true;
        enemy.superConductUntil = Math.max(enemy.superConductUntil || 0, this.time.now + ms);
        if (enemy.superConductVisual?.container?.active) return;
        const mark = this.add.image(enemy.sprite.x, enemy.sprite.y - 18, WeaponSystem.superconductKey(this)).setDepth(3).setScale(1.3);
        this.tweens.add({ targets: mark, alpha: 0.45, duration: 600, yoyo: true, repeat: -1 });
        enemy.superConductVisual = { container: mark, g: mark };
    }

    // A Queen or a boss struck: its damage, the charge, the forks out to what's round it, then on to the next
    // bounce, as with any enemy (it used to take the hit and the orb just went out)
    _orbHitBig(orb, big, tx, ty, hit) {
        const T = this.TILE_SIZE, px = tx * T + T / 2, py = ty * T + T / 2, from = { x: tx, y: ty, sprite: { x: px, y: py } };
        const hitDamage = orb.damage * (orb._struck ? 1 : 1.8);
        orb._struck = true; orb.damage *= 0.75;
        orb.hitEnemies.add(big);
        hit(hitDamage);
        this.gainUltCharge(this.ultChargePerLightningHit, 'lightning');
        Sfx.play(this, 'orbhit');
        const FORK_DMG = hitDamage * 0.38;
        for (const e of this.enemies.filter(e => !this._phasedOut?.(e) && e.sprite?.active && e.health > 0 && Math.hypot(e.x - tx, e.y - ty) <= orb.forkRange)) {
            this.drawLightningBolt(from, e);
            this.damageEnemy(e, FORK_DMG, 'lightning');
            if (this._dmgLanded && e.health > 0) this._superconduct(e);
        }
        this._zapBosses(from, FORK_DMG, orb.forkRange, [...orb.hitEnemies]);
        if (orb.bouncesLeft > 0) {
            const t = this._orbBounceTarget(orb, tx, ty);
            if (t) { orb.bounceTarget = t; orb.bouncesLeft--; return; }
        }
        orb._done = true;
    }
    _orbHitEnemy(orb, enemy) {
        const TS = this.TILE_SIZE;
        const ex = enemy.sprite.x, ey = enemy.sprite.y;

        // Damage with falloff per bounce (25% less each hit)
        const FALLOFF = 0.75;
        // the first enemy an orb strikes takes ×FIRST_HIT: alone, a target used to take one weak
        // hit and nothing else (14.5 dps); the forks after it are unchanged
        const FIRST_HIT = 1.8;
        const hitDamage = orb.damage * (orb._struck ? 1 : FIRST_HIT);
        orb._struck = true;
        orb.damage = orb.damage * FALLOFF; // reduce for next bounce

        this._superconduct(enemy);
        // the impact: a white-hot snap and a ring of sparks
        Sfx.play(this, 'orbhit');
        const snap = this.add.image(ex, ey, 'vfx_glow').setTint(0xfff3a0).setBlendMode(Phaser.BlendModes.ADD).setDepth(4.2).setScale(0.2);
        this.tweens.add({ targets: snap, scale: 0.38, alpha: 0, duration: 180, onComplete: () => snap.destroy() });
        this._vfxTrail?.lightning?.emitParticleAt(ex, ey, 8);

        // Damage. Typed: an orb still flying after you switch element used to hit (and burn, and
        // charge) as the new one. And paid only for a hit that landed.
        this.damageEnemy(enemy, hitDamage, 'lightning');
        if (this._dmgLanded) this.gainUltCharge(this.ultChargePerLightningHit, 'lightning');

        // Fork lightning to ALL nearby enemies regardless of superconductor (35% of impact damage)
        // CONDUCTION. An orb that pops on a soaked target dumps its charge into the whole
        // connected pool. The fork below is capped at FORK_R tiles; conduction is not, so
        // on wet ground the orb's reach is the shape of the water rather than a radius.
        if (typeof this._energizePool === 'function' && this.isWaterAt?.(enemy.x, enemy.y)) {
            this._energizePool(enemy.x, enemy.y, hitDamage);
        }
        const FORK_R = orb.forkRange;
        const FORK_DMG = hitDamage * 0.38;   // 0.35, then 0.5; 0.38 2026-10-19: a tier 2 out-valued the tier 3s and 4s in a crowd
        const forkCandidates = this.enemies.filter(e =>!this._phasedOut?.(e) && 
            e !== enemy && e.sprite?.active &&
            Math.abs(e.x - enemy.x) + Math.abs(e.y - enemy.y) <= FORK_R
        );
        this._zapBosses(enemy, FORK_DMG, FORK_R, []);   // and Queens and bosses in reach
        for (const forkTarget of forkCandidates) {
            this.drawLightningBolt({ sprite: { x: ex, y: ey } }, forkTarget);
            this.damageEnemy(forkTarget, FORK_DMG, 'lightning');
            // Forks superconduct what they hit, so the orb can bounce on into the crowd (the bounce
            // goes only to superconducted enemies, and only a direct hit used to make one).
            if (this._dmgLanded && forkTarget.health > 0 && forkTarget._immuneFx !== 'lightning') {
                forkTarget.isSuperConducted = true;
                forkTarget.superConductUntil = Math.max(forkTarget.superConductUntil || 0, this.time.now + (this.superConductDuration || 5000));
            }
        }
        // Fork to boss too
        this.damageBossAtTile(enemy.x, enemy.y, FORK_DMG, undefined, 'lightning');

        // Bounce — ONLY to superconducted enemies within range
        if (orb.bouncesLeft > 0) {
            orb.hitEnemies.add(enemy);
            const bounceTarget = this._orbBounceTarget(orb, enemy.x, enemy.y);
            orb.bounceTarget = bounceTarget;   // it steers onto it, and picks again if it dies first (updateLightningOrbs)

            if (bounceTarget) {
                const bb = this.enemies.includes(bounceTarget) ? bounceTarget.sprite : bounceTarget.container;
                const tdx = bb.x - ex;
                const tdy = bb.y - ey;
                const tlen = Math.sqrt(tdx*tdx + tdy*tdy) || 1;
                orb.vx = (tdx/tlen) * 320;
                orb.vy = (tdy/tlen) * 320;
                orb.bouncesLeft--;
                // Bounce arc flash
                const arc = this.add.graphics().setDepth(3.5);
                arc.lineStyle(2, 0xffff00, 0.70);
                arc.beginPath(); arc.moveTo(ex, ey); arc.lineTo(bb.x, bb.y); arc.strokePath();
                this.tweens.add({ targets: arc, alpha: 0, duration: 120, onComplete: () => arc.destroy() });
                return; // keep orb alive, heading to bounce target
            }
        }
        // No valid superconducted bounce target — destroy
        orb._done = true;
    }

    // The next superconducted enemy for a bounce, nearest first: not one already hit, not one that won't live till it
    // arrives (a sliver of health that's burning, or already at nothing)
    _orbBounceTarget(orb, x, y) {
        const doomed = e => e.health <= 0 || (e.health <= orb.damage * 0.25 && ((e.burnStacks || 0) > 0 || e.isBurning));
        const near = (list, at) => list.map(e => ({ e, d: Math.hypot(at(e)[0] - x, at(e)[1] - y) })).filter(c => c.d <= 6).sort((a, b) => a.d - b.d)[0]?.e || null;
        const T = this.TILE_SIZE;
        return near(this.enemies.filter(e => !this._phasedOut?.(e) && e.sprite?.active && !orb.hitEnemies.has(e) && e.isSuperConducted && !doomed(e)), e => [e.x, e.y])
            || near([...(this.portals || []), this.voltslimeBoss, this.voidSovereignBoss, this.fractureCore].filter(b => b?.active && b.container?.active && !orb.hitEnemies.has(b)),   // a Queen or a boss, when no enemy will do
                    b => [b.tileX ?? b.container.x / T, b.tileY ?? b.container.y / T]);
    }
    updateLightningOrbs(delta) {
        if (!this.lightningOrbs?.length) return;
        const ds = delta / 1000;
        const TS = this.TILE_SIZE;

        for (let i = this.lightningOrbs.length - 1; i >= 0; i--) {
            const orb = this.lightningOrbs[i];
            if (orb._done || !orb.gfx?.active) {
                if (orb.gfx?.active) {
                    // Death burst — snapshot position before destroying, draw at local (0,0)
                    const bx = orb.gfx.x, by = orb.gfx.y;
                    orb.gfx.destroy();
                    // the orb pops: a flash, a ring, and arcs thrown out in every direction
                    const glow = this.add.image(bx, by, 'vfx_glow').setTint(0xffe066).setBlendMode(Phaser.BlendModes.ADD).setDepth(5).setScale(0.3);
                    this.tweens.add({ targets: glow, scale: 0.9, alpha: 0, duration: 260, onComplete: () => glow.destroy() });
                    if (typeof VisualFX !== 'undefined') VisualFX.ripple(this, bx, by, 6, 30, 0xffe066, { depth: 5, duration: 300 });
                    const burst = this.add.graphics().setDepth(5).setBlendMode(Phaser.BlendModes.ADD);
                    burst.x = bx; burst.y = by;
                    for (let k = 0; k < 6; k++) {
                        const a = k / 6 * Math.PI * 2 + Math.random() * 0.5, r = 18 + Math.random() * 14;
                        const pts = this._arcPath(0, 0, Math.cos(a) * r, Math.sin(a) * r, 4, 0.35);
                        this._strokeArc(burst, pts, 3, 0x88ddff, 0.35); this._strokeArc(burst, pts, 1.2, 0xffffff, 0.95);
                    }
                    this.tweens.add({ targets: burst, alpha: 0, duration: 220, onComplete: () => burst.destroy() });
                    Sfx.play(this, 'zap');
                }
                this.lightningOrbs.splice(i, 1);
                continue;
            }

            // On a bounce: home in on its target; it died on the way, so pick another, or pop if there's none
            if (orb.bounceTarget) {
                let t = orb.bounceTarget;
                const big = o => !this.enemies.includes(o), alive = o => big(o) ? o.active && o.container?.active : o.sprite?.active && o.health > 0;   // (a Queen has a sprite too, inside her container)
                if (!alive(t)) {
                    t = orb.bounceTarget = this._orbBounceTarget(orb, orb.gfx.x / TS - 0.5, orb.gfx.y / TS - 0.5);
                    if (!t) { orb._done = true; continue; }
                }
                const body = big(t) ? t.container : t.sprite;
                const tdx = body.x - orb.gfx.x, tdy = body.y - orb.gfx.y, tl = Math.hypot(tdx, tdy) || 1, sp = Math.hypot(orb.vx, orb.vy) || 320;
                orb.vx = tdx / tl * sp; orb.vy = tdy / tl * sp;
            }
            // Move
            orb.gfx.x += orb.vx * ds;
            orb.gfx.y += orb.vy * ds;

            // Crack shrink — pierces, no effect on projectile flight (Level 4)
            this._checkProjectileCrackShrink(orb.gfx.x, orb.gfx.y);

            // Animate orb (redraw arc lines)
            this._drawOrbEmitterGfx(orb.gfx);

            // (its trail and glow come from Visuals.js, which follows every lightning orb)

            // Wall collision — destroy
            const tx = Math.floor(orb.gfx.x / TS), ty = Math.floor(orb.gfx.y / TS);
            const orbOob = tx < 0 || tx >= this.WORLD_WIDTH || ty < 0 || ty >= this.WORLD_HEIGHT;
            if (orbOob || this.world[tx]?.[ty] === this.WALL || this.world[tx]?.[ty] === this.NOTHING || this.isInLockedRoom(tx, ty)) {
                VisualFX.wallImpact(this, orb.gfx.x, orb.gfx.y, 'lightning', orb.vx, orb.vy);
                orb._done = true;
                continue;
            }

            // Max lifetime 4s
            if (this.time.now - orb._createdAt > 4000) { orb._done = true; continue; }

            // Enemy collision
            for (const enemy of this.enemies) {
                if (this._phasedOut?.(enemy)) continue;
                if (!enemy.sprite?.active || orb.hitEnemies.has(enemy)) continue;
                const edx = orb.gfx.x - enemy.sprite.x, edy = orb.gfx.y - enemy.sprite.y;
                if (Math.sqrt(edx*edx + edy*edy) < TS * 0.75) {
                    this._orbHitEnemy(orb, enemy);
                    break;
                }
            }

            if (orb._done) continue;
            // Portal collision (queen slime): struck like any enemy (forks, bounces on)
            const portalHit = this.getPortalAt(tx, ty) || (this.portals || []).find(q => q.active && q.container?.active && !orb.hitEnemies.has(q) && Math.hypot(orb.gfx.x - q.container.x, orb.gfx.y - q.container.y) < TS * 1.2);   // her tile, or her body (a bounce homes on the body)
            if (portalHit && !orb.hitEnemies.has(portalHit)) {
                this._orbHitBig(orb, portalHit, portalHit.tileX, portalHit.tileY, d => this.damagePortal(portalHit, d));
                continue;
            }

            // Boss collision: the same
            for (const boss of [this.voltslimeBoss, this.voidSovereignBoss, this.fractureCore].filter(Boolean)) {
                if (!boss.active || orb.hitEnemies.has(boss)) continue;
                const bx = boss.container?.x ?? boss.tileX * TS;
                const by = boss.container?.y ?? boss.tileY * TS;
                if (Math.hypot(orb.gfx.x - bx, orb.gfx.y - by) < TS * 2) {
                    const btx = boss.tileX ?? Math.floor(bx / TS), bty = boss.tileY ?? Math.floor(by / TS);
                    this._orbHitBig(orb, boss, btx, bty, d => this.damageBossAtTile(btx, bty, d, undefined, 'lightning'));
                    break;
                }
            }
        }
    }

    applyIceFistsHit(enemy) {
        // Ice fists only — do not call from other weapons
        if (enemy._sniperInvisible || this._phasedOut(enemy)) return; // invisible snipers immune to chill/freeze
        if (enemy.fireImmune) {
            if (enemy.sprite?.active) this.showStatusText(enemy.sprite.x, enemy.sprite.y - 10, 'IMMUNE', '#ff8844');
            return;
        }
        const time = this.time.now;
        // Check frozen BEFORE iceImmune — frozen ice elementals can be shattered
        if (enemy.isFrozen) { this._clearFreezeVisuals(enemy); this._triggerShatterBurst(enemy); return; }

        // Ice elementals (iceImmune) take NO chip damage — only chill stacks toward freeze/shatter
        if (!enemy.iceImmune) {
            const chipDmg = 14 * this.damageScaling;   // 12 left the free ice weapon the weakest in the game (36 dps)
            const _rd1461 = this.resolveElementalHit(enemy, chipDmg, 'ice');
            if (_rd1461 === null) return;
            enemy.health -= _rd1461;
            this.showDamageNumber(enemy.sprite.x, enemy.sprite.y - 10, _rd1461, '#88eeff');
            this.updateEnemyHealthBar(enemy);
            this.gainUltCharge(this.ultChargePerHit);
            if (enemy.health <= 0) { this._destroyChillIndicator(enemy); this.killEnemy(enemy); return; }
        }

        // This used to call _updateChillIndicator and then test `>= 3` -- with NOTHING in between
        // incrementing the bar. Ice Fists could not cube anything on its own; the branch below was
        // dead code for as long as it existed.
        this.applyChill(enemy, this._chillCfg().MELEE);
    }

    applyIcicleCannonHit(enemy, damage, shatterMult = 0.5, chillWeight = 1) {
        // Icicle cannon — completely independent of ice fists
        if (enemy._sniperInvisible || this._phasedOut(enemy)) return; // invisible snipers immune to chill/freeze/slow
        if (enemy.fireImmune) {
            if (enemy.sprite?.active) this.showStatusText(enemy.sprite.x, enemy.sprite.y - 10, 'IMMUNE', '#ff8844');
            return;
        }
        if (enemy.isFrozen) { this._clearFreezeVisuals(enemy); this._triggerShatterBurst(enemy, shatterMult); return; } // cannon: scaled shatter

        if (!enemy.iceImmune) {
            const _rd1492 = this.resolveElementalHit(enemy, damage, 'ice');
            if (_rd1492 === null) return;
            enemy.health -= _rd1492;
            this.showDamageNumber(enemy.sprite.x, enemy.sprite.y - 10, _rd1492, '#88eeff');
            this.updateEnemyHealthBar(enemy);
            this.gainUltCharge(this.ultChargePerHit * 0.65); // icicle fires rapidly — reduced per-hit charge
            if (enemy.health <= 0) { this._destroyChillIndicator(enemy); this.killEnemy(enemy); return; }
        }

        // Fractional and range-weighted: a point-blank pellet is worth many ranged ones toward the
        // bar. chillWeight is the cannon's own distance curve; RATE scales it inside applyChill.
        // 0.65 charge because the cannon fires rapidly and would otherwise print ult.
        this.applyChill(enemy, chillWeight, { chargeMult: 0.65 });
    }

    applyFractalShardHit(enemy, damage) {
        // Fractal shard hit — independent of all other ice weapons
        // No brittle, own chill/freeze/shatter, own ult charge
        if (enemy._sniperInvisible || this._phasedOut(enemy)) return; // invisible snipers immune to chill/freeze
        if (enemy.fireImmune) {
            if (enemy.sprite?.active) this.showStatusText(enemy.sprite.x, enemy.sprite.y - 10, 'IMMUNE', '#ff8844');
            return;
        }
        // Check frozen BEFORE iceImmune — frozen ice elementals can be shattered
        if (enemy.isFrozen) {
            this._triggerShatterBurst(enemy, 1.6); // Fractal Shard — buffed shatter damage
            return;
        }
        // Ice elementals: skip chip damage, only chill toward shatter
        if (!enemy.iceImmune) {
            const _rd1532 = this.resolveElementalHit(enemy, damage, 'ice');
            if (_rd1532 === null) return;
            enemy.health -= _rd1532;
            this.showDamageNumber(enemy.sprite.x, enemy.sprite.y - 10, _rd1532, '#88eeff');
            this.updateEnemyHealthBar(enemy);
            this.gainUltCharge(this.ultChargePerHit);
            if (enemy.health <= 0) { this._destroyChillIndicator(enemy); this.killEnemy(enemy); return; }
        }
        this.applyChill(enemy, this._chillCfg().DIRECT);
    }

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
    // binary (not stacking like chill) and a stunned enemy doesn't move, so this
    // only needs to be created once when stun starts and removed when it ends —
    // no per-frame position tracking needed.
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

    fractalShardAttack(targetX, targetY) {
        const currentTime = this.time.now, FC = this._fractalCfg(), cd = WeaponLevels.cdMult('fractal_shard');
        const mode = (this._fracMode?.until || 0) > currentTime ? this._fracMode.kind : null;   // R's gamble: every shot one attack, quicker
        if (currentTime - (this.lastFractalShardTime || 0) < (mode === 'spike' ? FC.SPIKE_CD : 600) * cd) return;
        this.lastFractalShardTime = currentTime;
        if (mode) this._fractalPhase = mode === 'spike' ? 0 : 1;
        this._gearFiredAt = currentTime;   // the held weapon swings now (Creatures.gear)

        if (this._fractalPhase === undefined) this._fractalPhase = 0;

        const playerPx = this._shotX();   // where the slime is drawn (mid-dash it's still on its way)
        const playerPy = this._shotY();
        const worldX = targetX + this.cameras.main.scrollX;
        const worldY = targetY + this.cameras.main.scrollY;
        const angle = Math.atan2(worldY - playerPy, worldX - playerPx);
        if (mode === 'spike') { this._fractalDeadly(worldX, worldY); this._fractalPhase = 0; return; }

        if (this._fractalPhase === 0) {
            // ── PHASE 1: PIERCING FREEZE SPIKE ───────────────────────────
            this._fractalPhase = 1;

            // ── ANIME IMPACT FRAME ──────────────────────────────────────
            // Layer 1: hard white screen flash (tiny duration, sells the impact)
            const flash = this.add.rectangle(0, 0, this.scale.width * 2, this.scale.height * 2, 0xffffff, 0.18)
                .setScrollFactor(0).setDepth(10).setOrigin(0.5);
            this.tweens.add({ targets: flash, alpha: 0, duration: 60, onComplete: () => flash.destroy() });

            // Layer 2: spiky rotating star at muzzle — 8 long sharp points alternating long/short
            const star = this.add.graphics().setDepth(9);
            star.x = playerPx; star.y = playerPy;
            const SPIKES = 8, LONG = 28, SHORT = 11;
            star.fillStyle(0xffffff, 1.0);
            star.beginPath();
            for (let i = 0; i < SPIKES * 2; i++) {
                const sa = (i / (SPIKES * 2)) * Math.PI * 2 - Math.PI / 2;
                const r = i % 2 === 0 ? LONG : SHORT;
                if (i === 0) star.moveTo(Math.cos(sa)*r, Math.sin(sa)*r);
                else star.lineTo(Math.cos(sa)*r, Math.sin(sa)*r);
            }
            star.closePath(); star.fillPath();
            // Inner star tinted ice-blue
            star.fillStyle(0xaaeeff, 0.80);
            star.beginPath();
            for (let i = 0; i < SPIKES * 2; i++) {
                const sa = (i / (SPIKES * 2)) * Math.PI * 2 - Math.PI / 2;
                const r = i % 2 === 0 ? LONG * 0.55 : SHORT * 0.55;
                if (i === 0) star.moveTo(Math.cos(sa)*r, Math.sin(sa)*r);
                else star.lineTo(Math.cos(sa)*r, Math.sin(sa)*r);
            }
            star.closePath(); star.fillPath();
            // Bright core
            star.fillStyle(0xffffff, 1.0); star.fillCircle(0, 0, 6);
            // Rotate and expand outward, fading fast
            this.tweens.add({
                targets: star,
                angle: 45, scaleX: 2.2, scaleY: 2.2, alpha: 0,
                duration: 160, ease: 'Quad.easeOut',
                onComplete: () => star.destroy()
            });

            // Layer 3: shockwave ring expanding outward
            const ring = this.add.graphics().setDepth(8);
            ring.x = playerPx; ring.y = playerPy;
            ring.lineStyle(3.5, 0xffffff, 0.90); ring.strokeCircle(0, 0, 8);
            ring.lineStyle(1.5, 0x88ddff, 0.70); ring.strokeCircle(0, 0, 14);
            this.tweens.add({ targets: ring, scaleX: 4.5, scaleY: 4.5, alpha: 0, duration: 200, ease: 'Quad.easeOut', onComplete: () => ring.destroy() });

            // Layer 4: speed lines — 6 long streaks blasting backward away from fire direction
            const lines = this.add.graphics().setDepth(8);
            lines.x = playerPx; lines.y = playerPy;
            for (let i = 0; i < 6; i++) {
                const sa = angle + Math.PI + (i - 2.5) * 0.22; // fan backward
                const len = 20 + Math.random() * 22;
                lines.lineStyle(1.5 - i * 0.1, i % 2 === 0 ? 0xffffff : 0x88ddff, 0.85 - i * 0.05);
                lines.beginPath(); lines.moveTo(Math.cos(sa)*6, Math.sin(sa)*6); lines.lineTo(Math.cos(sa)*len, Math.sin(sa)*len); lines.strokePath();
            }
            this.tweens.add({ targets: lines, scaleX: 1.6, scaleY: 1.6, alpha: 0, duration: 130, onComplete: () => lines.destroy() });

            // Fire 3 pierce spikes in a tight shotgun spread instead of a single needle.
            // Shared volleyId lets boss-hit logic ensure only ONE freeze-or-shatter event
            // happens per volley, even though all 3 needles can land base damage on the
            // same target like a shotgun.
            // One shard, and up to two more with Splinter, spread a little either side. Only the
            // centre one plants the totem, so a volley leaves one pillar.
            // Three PARALLEL spikes (2026-10-20): the middle one on your aim, one half a tile either side, all flying straight.
            // The longest, fastest sniper shot in the game; they cube what they hit. (The gold and purple marks are gone:
            // marking an enemy for more damage is Hex's job, and it plants no totem any more.) Splinter: they hit harder.
            // Deadly Accuracy (R): five of them, closer set, harder, every shot.
            const volleyId = Math.random().toString(36).slice(2), off = this.TILE_SIZE * (mode ? 0.4 : 0.5), nx = -Math.sin(angle) * off, ny = Math.cos(angle) * off;
            this._fractalSpikeDmg = 8 * (1 + 0.2 * WeaponLevels.perk('fractal_shard', 'shards')) * (mode ? FC.SPIKE_MULT : 1);
            for (const k of (mode ? [-2, -1, 0, 1, 2] : [-1, 0, 1])) this._spawnPierceSpike(playerPx + nx * k, playerPy + ny * k, angle, volleyId, false);
            if (mode) this._fractalPhase = 0;

        } else {
            // ── PHASE 2: UNSTABLE SPLITTER ────────────────────────────────
            this._fractalPhase = mode ? 1 : 0;
            // Phase 2 has a longer effective cooldown — override timer (Shard Storm: FAN_CD between fans)
            this.lastFractalShardTime = mode ? currentTime - 600 * cd + FC.FAN_CD * cd : currentTime + 1400 * cd; // total ~2s before next shot (Rapid Facets: both strikes)

            // Muzzle flash — unstable crackling burst (Shard Storm: a small spark, at four fans a second the full one whited out the screen)
            if (mode) this._vfxFlash?.(playerPx, playerPy, 22, 0x9fe8ff, 90, 0.5);
            const muzzle = this.add.graphics().setDepth(4).setVisible(!mode);
            muzzle.x = playerPx; muzzle.y = playerPy;
            muzzle.fillStyle(0xffffff, 0.85); muzzle.fillCircle(0, 0, 8);
            muzzle.fillStyle(0xaaeeff, 0.40); muzzle.fillCircle(0, 0, 18);
            for (let i = 0; i < 8; i++) {
                const sa = angle + (i / 8) * Math.PI * 2;
                muzzle.lineStyle(2.0, i % 2 === 0 ? 0xffffff : 0x44bbff, 0.88);
                muzzle.beginPath(); muzzle.moveTo(Math.cos(sa)*5, Math.sin(sa)*5); muzzle.lineTo(Math.cos(sa)*22, Math.sin(sa)*22); muzzle.strokePath();
                if (i % 2 === 0) {
                    const cx = Math.cos(sa)*14, cy = Math.sin(sa)*14;
                    muzzle.lineStyle(1.0, 0xbbefff, 0.65);
                    muzzle.beginPath(); muzzle.moveTo(cx - Math.sin(sa)*5, cy + Math.cos(sa)*5); muzzle.lineTo(cx + Math.sin(sa)*5, cy - Math.cos(sa)*5); muzzle.strokePath();
                }
            }
            muzzle.lineStyle(1.5, 0x88ddff, 0.55); muzzle.strokeCircle(0, 0, 20);
            this.tweens.add({ targets: muzzle, scaleX: 3.0, scaleY: 3.0, alpha: 0, duration: 300, ease: 'Quad.easeOut', onComplete: () => muzzle.destroy() });

            // ── A 60-DEGREE FORWARD FAN, not a 360 nova ──────────────────────
            // The old version fired 8 seeds in a full ring for a second, boosted, aim-free pass.
            // boosted pass. Two problems with that under the current ice identity. A nova has no
            // aim, so the weapon had no direction to be good or bad at -- and now that ice's job
            // is APPLYING brittle rather than dealing damage, an omnidirectional applicator makes
            // position irrelevant, which is the one thing ice is supposed to care about. The
            // recall also meant every cast covered the same ground twice, so there was nothing to
            // decide after firing.
            //
            // A fan you point sweeps a direction and commits to it. Combined with phase 1's
            // totem, the pair reads as: plant the chill field, then sweep the lane you want.
            // 60 degrees, not 90. And the count drops with it: narrowing the cone ALONE is not a
            // nerf, because shards pierce and each enemy can be hit once per shard -- squeezing 7
            // shards into a tighter arc means more of them overlap a single target, so the weapon
            // loses area and GAINS single-target burst. Holding angular density fixed at 15 deg
            // apart (7 over 90 -> 5 over 60) cuts coverage without handing back focused damage.
            const FAN_COUNT = (mode ? FC.FAN_N : 5) + 2 * WeaponLevels.perk('fractal_shard', 'fan');   // Burst Fan: more (Shard Storm: a wide one)
            this._fractalVolley = Math.random().toString(36).slice(2);   // the burst's shards fall off on one target
            const FAN_HALF  = mode ? FC.FAN_HALF : Math.PI / 6;      // 30 deg either side = a 60 deg fan
            for (let i = 0; i < FAN_COUNT; i++) {
                const t = FAN_COUNT === 1 ? 0.5 : i / (FAN_COUNT - 1);
                this._spawnSplitterShard(playerPx, playerPy, angle - FAN_HALF + t * (FAN_HALF * 2), 0);
            }
        }
    }

    // The Fractal Shard's pixel art (ShopScene.icon, outlined like the weapon icons), all pointing up: the spike's crystal
    // needle, the fan's jagged shard in five shades (it darkens each time it splits), and the mark's floating crystal.
    static fractalArt(scene) {
        if (WeaponSystem._fracArt && scene.textures.exists('fx_frac_spike')) return WeaponSystem._fracArt;
        const I = ShopScene.icon;
        const spike = I(scene, 'fx_frac_spike', 16, { I: '#5fb8e0', i: '#bff4ff', d: '#2a6a9a' }, m => {
            m.poly([[8, 0], [10, 5], [10, 13], [8.6, 16], [7.4, 16], [6, 13], [6, 5]], 'I');
            m.rect(7, 3, 1, 10, 'i'); m.line(9, 6, 9, 13, 'd');
            m.poly([[8, 0], [9.2, 3], [6.8, 3]], 'W'); m.set(7, 6, 'W'); m.set(7, 10, 'W');
        });
        const SH = [['#88ddff', '#ddf8ff', '#ffffff'], ['#44bbdd', '#aaeeff', '#ddf8ff'], ['#2299bb', '#77ccee', '#bbefff'], ['#116688', '#44aacc', '#88ddee'], ['#0a3344', '#226688', '#55aabb']];
        const shard = SH.map(([B, L, R], k) => I(scene, 'fx_frac_shard_' + k, 12, { B, L, R }, m => {
            m.poly([[6, 0], [9.5, 4], [8.5, 8], [6.5, 11.5], [4.5, 9], [2.5, 4.5]], 'B');
            m.line(5, 2, 4, 8, 'L'); m.line(6, 3, 6, 9, 'L');
            m.set(6, 1, 'R'); m.set(6, 2, 'R'); if (k < 3) m.set(5, 5, 'R');
        }));
        const mark = I(scene, 'fx_frac_mark', 10, { i: '#9fe8ff', I: '#5fb8e0' }, m => {
            m.poly([[5, 0], [9, 5], [5, 10], [1, 5]], 'i'); m.poly([[5, 0], [9, 5], [5, 10]], 'I'); m.set(4, 3, 'W'); m.set(3, 5, 'W');
        });
        const lance = I(scene, 'fx_frac_lance', 22, { k: '#06121c', D: '#1e5a86', I: '#4aa8dc', i: '#9fe4ff', W: '#ffffff', g: '#dff8ff' }, m => {   // Deadly Accuracy's: a long faceted lance, its edge lit
            m.poly([[11, 0], [14, 6], [13.5, 17], [11, 22], [8.5, 17], [8, 6]], 'D');
            m.poly([[11, 0], [14, 6], [13.5, 17], [11, 22]], 'I');
            m.poly([[11, 1], [12.5, 6], [11, 18]], 'i');
            m.line(11, 2, 11, 19, 'W'); m.set(12, 4, 'W'); m.set(12, 9, 'g'); m.set(10, 13, 'g');
            m.poly([[11, 22], [9, 19], [13, 19]], 'D');
        });
        return (WeaponSystem._fracArt = { spike, shard, mark, lance });
    }
    // A spike hit: crystal chips spraying off the target, spinning as they fall
    static fractalBurst(scene, x, y, crit) {
        const A = WeaponSystem.fractalArt(scene);
        for (let i = 0; i < (crit ? 7 : 4); i++) {
            const a = Math.random() * Math.PI * 2, d = 10 + Math.random() * 16;
            const c = scene.add.image(x, y, A.shard[Math.floor(Math.random() * 3)]).setScale(0.55).setRotation(a).setDepth(4.6);
            scene.tweens.add({ targets: c, x: x + Math.cos(a) * d, y: y + Math.sin(a) * d * 0.7 + 6, rotation: a + 4, alpha: 0, scale: 0.3, duration: 320 + Math.random() * 120, ease: 'Quad.easeOut', onComplete: () => c.destroy() });
        }
        if (crit) scene._vfxFlash?.(x, y, 40, 0xffffff, 140, 0.8);
    }

    // ── FRACTAL SHARD'S R (2026-10-20): the combo, and a gamble ──────────────
    // A spike MARKS what it hits (a charge mark, no damage: that's Hex's job). A fan shard on a marked enemy uses the mark
    // up for a charge (one a fan); CHARGES of them fill R. R flips a coin for MODE_MS: DEADLY ACCURACY (every shot a five-spike volley,
    // SPIKE_CD apart, xSPIKE_MULT) or SHARD STORM (every shot a FAN_N-shard fan, FAN_HALF either side, FAN_CD apart).
    // DEADLY ACCURACY: five shards orbit you; a click lines them up a tile apart facing the cursor, and they converge on that point
    // and fly on past it, every hit a crit (_fractalDeadly). The gamble is a slot machine (_fractalGamble): a reel that slows, then lands.
    // SHARD STORM is the ult charger: it heals STORM_HEAL of max HP when it lands (no overheal), ice ult charge xSTORM_ULT while it
    // runs, and chip fans (xSTORM_DMG damage) every FAN_CD.
    _fractalCfg() { return { MARK_MS: 6000, CHARGES: 5, MODE_MS: 6000, SPIKE_CD: 420, SPIKE_MULT: 1.5, FAN_CD: 350, FAN_N: 7, FAN_HALF: Math.PI / 4, FORM_MS: 190, ORBIT_R: 34,
        STORM_HEAL: 0.1, STORM_ULT: 2, STORM_DMG: 0.5 }; }   // (STORM_ULT 2.5 with splitting shards filled ~45% of a gem a storm)
    _fractalMark(e) {
        if (!e?.sprite?.active || this._phasedOut(e)) return;
        e._fracMarkUntil = this.time.now + this._fractalCfg().MARK_MS;
        if (!e._fracMarkG?.active) { e._fracMarkG = this.add.image(e.sprite.x, e.sprite.y - 26, WeaponSystem.fractalArt(this).mark).setDepth(4.4); this._vfxSort?.(e._fracMarkG); }
        (this._fracMarked ||= new Set()).add(e);
    }
    // An ice shard landing on a boss counts toward its weapon's signature as one on an enemy does (boss hits never did):
    // an icicle toward the Frost Shield, a Fractal spike marks the boss, a fan shard on that mark charges R
    _shardBossSig(s) {
        if (s.isCannonShard && !(this._frostShieldUntil > this.time.now)) { this._icicleHitCounter = Math.min(28, (this._icicleHitCounter || 0) + 1); this._updateIcicleChargeBar(); }
        const b = [this.voltslimeBoss, this.voidSovereignBoss, this.fractureCore].find(o => o?.active && o.container);
        if (!b) return;
        const m = b._fracPseudo ||= {};
        m.sprite = { x: b.container.x, y: b.container.y - 40, active: true };
        if (s.isPierceSpike) this._fractalMark(m); else if (s.isSplitter) this._fractalConsume(m);
    }
    _fractalConsume(e) {
        if (!((e?._fracMarkUntil || 0) > this.time.now)) return;
        if ((this._fracMode?.until || 0) > this.time.now) return;   // (no charging while R runs)
        if (this._fracChargedBy === this._fractalVolley) return;   // one charge a fan, so a pack fills it no faster than one enemy (the other marks wait)
        this._fracChargedBy = this._fractalVolley;
        const FC = this._fractalCfg();
        e._fracMarkUntil = 0; e._fracMarkG?.destroy(); e._fracMarkG = null; this._fracMarked?.delete(e);
        this._fracCharge = Math.min(FC.CHARGES, (this._fracCharge || 0) + 1);
        const p = e.sprite; if (p?.active) { this._vfxFlash?.(p.x, p.y, 36, 0x9fe8ff, 160, 0.7); this.showStatusText(p.x, p.y - 30, this._fracCharge >= FC.CHARGES ? 'R READY' : `+1  ${this._fracCharge}/${FC.CHARGES}`, '#bff4ff'); }
    }
    _fractalGamble() {
        const FC = this._fractalCfg(), p = this.player;
        if (this._fracSpin) return;
        if ((this._fracCharge || 0) < FC.CHARGES) { this.showStatusText(p.x, p.y - 28, `NOT CHARGED  ${this._fracCharge || 0}/${FC.CHARGES}`, '#8ab8d0'); return; }
        this._fracCharge = 0; this._fracSpin = true;
        const kind = Math.random() < 0.5 ? 'spike' : 'fan', W = this.scale.width, cx = W / 2, cy = Math.round(this.scale.height * 0.24), D = 40;
        const NAME = { spike: 'DEADLY ACCURACY', fan: 'SHARD STORM' }, COL = { spike: '#ffffff', fan: '#9fe8ff' };
        // the machine: an iron-dark frame, an ice rim, a reel window, the name rolling in it
        const box = this.add.graphics().setScrollFactor(0).setDepth(D);
        const drawBox = (glow) => { box.clear(); box.fillStyle(0x06101a, 0.92); box.fillRoundedRect(cx - 190, cy - 34, 380, 68, 10);
            box.lineStyle(3, glow, 1); box.strokeRoundedRect(cx - 190, cy - 34, 380, 68, 10); box.lineStyle(1, 0xdff8ff, 0.35); box.strokeRoundedRect(cx - 176, cy - 24, 352, 48, 6); };
        drawBox(0x5fb8e0);
        const label = this.add.text(cx, cy, '', { fontFamily: UIKit.FONT.title, fontSize: '30px', fontStyle: 'bold', color: '#ffffff', stroke: '#06101a', strokeThickness: 6 }).setOrigin(0.5).setScrollFactor(0).setDepth(D + 1);
        const objs = [box, label]; objs.forEach(o => this._vfxSort?.(o));
        const gaps = [45, 50, 55, 62, 70, 80, 92, 106, 124, 146, 172, 205, 245, 300];   // the reel slowing
        const other = kind === 'spike' ? 'fan' : 'spike';   // the reel flips gaps.length + 1 times before it stops: start where that lands on `kind`
        let face = (gaps.length + 1) % 2 === 1 ? other : kind, i = 0;
        const tick = () => {
            face = face === 'spike' ? 'fan' : 'spike';
            label.setText(NAME[face]).setColor(COL[face]).setY(cy - 10).setAlpha(0.6);
            this.tweens.add({ targets: label, y: cy, alpha: 1, duration: Math.min(90, gaps[Math.min(i, gaps.length - 1)] * 0.7) });
            Sfx.play(this, 'click');
            if (i < gaps.length) { this.time.delayedCall(gaps[i++], tick); return; }
            // it lands: boom
            this._fracSpin = false;
            this._fracMode = { kind, until: this.time.now + FC.MODE_MS };
            if (kind === 'spike') this._fractalDeadlyOpen();
            if (kind === 'fan' && this.health > 0) {   // Shard Storm lands with a heal (never past max)
                const before = this.health; this.health = Math.min(this.maxHealth, this.health + this.maxHealth * FC.STORM_HEAL);
                const h = Math.round(this.health - before); if (h > 0 && this.player?.active) this.showStatusText(this.player.x, this.player.y - 30, `+${h} HP`, '#7dff9a');
                this.updateHUD?.();
            }
            drawBox(kind === 'spike' ? 0xffffff : 0x9fe8ff);
            label.setScale(1.7); this.tweens.add({ targets: label, scale: 1, duration: 260, ease: 'Back.easeOut' });
            const flash = this.add.rectangle(W / 2, this.scale.height / 2, W, this.scale.height, kind === 'spike' ? 0xffffff : 0x9fe8ff, 0.35).setScrollFactor(0).setDepth(D - 1);
            this._vfxSort?.(flash); this.tweens.add({ targets: flash, alpha: 0, duration: 320, onComplete: () => flash.destroy() });
            this.cameras.main.shake(260, 0.012);
            const pp = this.player; if (pp?.active) { this._vfxBursts?.ice?.explode(40, pp.x, pp.y); this._vfxFlash?.(pp.x, pp.y, 160, kind === 'spike' ? 0xffffff : 0x9fe8ff, 400, 0.9); }
            Sfx.play(this, 'shatter'); Sfx.play(this, 'freeze');
            this.time.delayedCall(900, () => { for (const o of objs) this.tweens.add({ targets: o, alpha: 0, duration: 260, onComplete: () => o.destroy() }); });
        };
        tick();
    }
    // Deadly Accuracy's shot: the orbiting shards form a line a tile apart, facing the point you clicked, then each flies through
    // that point and on to the end of its range. Every one crits (s._crit).
    // Deadly Accuracy opening: a crystal sigil blooms out under you, six lances rise out of it in a ring of light and
    // take their places round you
    _fractalDeadlyOpen() {
        const p = this.player; if (!p?.active) return;
        const ADD = Phaser.BlendModes.ADD, cx = p.x, cy = p.y + 4;
        const g = this.add.graphics().setDepth(1.05).setBlendMode(ADD).setPosition(cx, cy), t = { k: 0 };
        this.tweens.add({ targets: t, k: 1, duration: 520, ease: 'Cubic.easeOut', onUpdate: () => {
            const k = t.k, R = 70 * k; g.clear();
            for (let ring = 0; ring < 3; ring++) {   // three hexagons, each turned and a size down
                const r = R * (1 - ring * 0.28), rot = ring * Math.PI / 6 + k * 0.6, pts = [];
                for (let i = 0; i <= 6; i++) { const a = rot + i * Math.PI / 3; pts.push({ x: Math.cos(a) * r, y: Math.sin(a) * r * 0.5 }); }
                g.lineStyle(2 - ring * 0.5, ring ? 0x9fe8ff : 0xffffff, (1 - k) * 0.9 + 0.1).strokePoints(pts, false);
            }
            for (let i = 0; i < 12; i++) { const a = i * Math.PI / 6 + k; g.lineStyle(1, 0xdff8ff, 0.6 * (1 - k)).lineBetween(Math.cos(a) * R * 0.25, Math.sin(a) * R * 0.12, Math.cos(a) * R, Math.sin(a) * R * 0.5); }
        }, onComplete: () => this.tweens.add({ targets: g, alpha: 0, duration: 260, onComplete: () => g.destroy() }) });
        const flash = this.add.image(cx, cy - 6, 'vfx_glow').setTint(0xdff8ff).setBlendMode(ADD).setDepth(4.7).setScale(0.3);
        this.tweens.add({ targets: flash, scale: 1.6, alpha: 0, duration: 420, onComplete: () => flash.destroy() });
        for (let i = 0; i < 18; i++) {   // splinters thrown out
            const a = Math.random() * Math.PI * 2, d = 30 + Math.random() * 50;
            const sh = this.add.image(cx, cy - 6, WeaponSystem.fractalArt(this).shard[i % 5]).setDepth(4.6).setScale(0.7).setRotation(a);
            this.tweens.add({ targets: sh, x: cx + Math.cos(a) * d, y: cy - 6 + Math.sin(a) * d * 0.6, rotation: a + 4, alpha: 0, scale: 0.2, duration: 500 + Math.random() * 200, ease: 'Quad.easeOut', onComplete: () => sh.destroy() });
        }
        this.cameras.main.shake(90, 0.003);
    }
    _fractalDeadly(tx, ty) {
        const FC = this._fractalCfg(), T = this.TILE_SIZE, p = this.player, ADD = Phaser.BlendModes.ADD;
        const ang = Math.atan2(ty - p.y, tx - p.x), px = -Math.sin(ang), py = Math.cos(ang), orbs = this._fracOrbs || [];
        this._fracOrbBusy = this.time.now + FC.FORM_MS + 300;
        this._fracHalo?.clear();
        const spots = [-2, -1, 0, 1, 2].map(k => ({ x: p.x + px * k * T * 0.55, y: p.y - 4 + py * k * T * 0.55 }));
        // they snap into a line facing the click, each drawing a thin aim line to the point; a crosshair closes on it
        const aim = this.add.graphics().setDepth(4.5).setBlendMode(ADD), mark = this.add.graphics().setDepth(4.7).setPosition(tx, ty);
        const t = { k: 0 };
        this.tweens.addCounter({ from: 0, to: 1, duration: FC.FORM_MS, onUpdate: tw => {
            const k = tw.getValue();
            aim.clear(); mark.clear();
            orbs.forEach(o => { if (o?.active) { aim.lineStyle(1, 0xffffff, 0.15 + 0.5 * k).lineBetween(o.x, o.y, tx, ty); } });
            const r = 22 - 14 * k;
            mark.lineStyle(2, 0xffffff, 0.5 + 0.5 * k).strokeCircle(0, 0, r);
            for (const q of [0, 1, 2, 3]) { const qa = q * Math.PI / 2 + k * 0.8; mark.lineBetween(Math.cos(qa) * (r + 2), Math.sin(qa) * (r + 2), Math.cos(qa) * (r + 7), Math.sin(qa) * (r + 7)); }
        } });
        spots.forEach((s, k) => { const o = orbs[k]; if (o?.active) this.tweens.add({ targets: o, x: s.x, y: s.y, rotation: ang + Math.PI / 2, scale: 1.1, alpha: 1, duration: FC.FORM_MS * 0.8, ease: 'Back.easeOut' }); });
        this.time.delayedCall(FC.FORM_MS, () => {
            aim.destroy();
            this.tweens.add({ targets: mark, scale: 1.6, alpha: 0, duration: 260, onComplete: () => mark.destroy() });
            const volleyId = Math.random().toString(36).slice(2);
            this._fractalSpikeDmg = 8 * (1 + 0.2 * WeaponLevels.perk('fractal_shard', 'shards')) * FC.SPIKE_MULT;
            for (const s of spots) {
                const a2 = Math.atan2(ty - s.y, tx - s.x);
                this._spawnPierceSpike(s.x, s.y, a2, volleyId, false);
                const sh = this.iceShards[this.iceShards.length - 1]; if (sh) sh._crit = true;
                const streak = this.add.graphics().setDepth(4.6).setBlendMode(ADD);   // a white-hot streak down its line
                const ex = s.x + Math.cos(a2) * T * 9, ey = s.y + Math.sin(a2) * T * 9;
                streak.lineStyle(5, 0x4aa8dc, 0.35).lineBetween(s.x, s.y, ex, ey);
                streak.lineStyle(2.5, 0x9fe8ff, 0.7).lineBetween(s.x, s.y, ex, ey);
                streak.lineStyle(1, 0xffffff, 1).lineBetween(s.x, s.y, ex, ey);
                for (let d = 18; d < T * 9; d += 22) {   // crystal flecks hanging in its wake, shimmering out one after another
                    const fx = s.x + Math.cos(a2) * d, fy = s.y + Math.sin(a2) * d;
                    const fl = this.add.image(fx + (Math.random() - 0.5) * 6, fy + (Math.random() - 0.5) * 6, WeaponSystem.fractalArt(this).shard[Math.floor(Math.random() * 3)]).setScale(0.45).setRotation(Math.random() * 6).setDepth(4.55).setAlpha(0.9);
                    this.tweens.add({ targets: fl, alpha: 0, scale: 0.15, y: fl.y - 6, delay: d * 0.6, duration: 380, onComplete: () => fl.destroy() });
                }
                this.tweens.add({ targets: streak, alpha: 0, duration: 200, ease: 'Quad.easeIn', onComplete: () => streak.destroy() });
                const flash = this.add.image(s.x, s.y, 'vfx_glow').setTint(0xdff8ff).setBlendMode(ADD).setDepth(4.7).setScale(0.25);
                this.tweens.add({ targets: flash, scale: 0.35, alpha: 0, duration: 160, onComplete: () => flash.destroy() });
            }
            for (const o of orbs) if (o?.active) o.setAlpha(0).setScale(0.9);
            this.cameras.main.shake(70, 0.003);
            Sfx.play(this, 'w_fractal_shard');
        });
    }
    // Every frame: the marks over their enemies (gone when they lapse or die) and, while it's out, the charge over you
    _updateFractalBar() {
        const now = this.time.now, FC = this._fractalCfg();
        for (const e of [...(this._fracMarked || [])]) {
            const g = e._fracMarkG;
            if (!e.sprite?.active || !((e._fracMarkUntil || 0) > now) || !g?.active) { g?.destroy(); e._fracMarkG = null; this._fracMarked.delete(e); continue; }
            const s = e.sprite, k = (e._fracMarkUntil - now) / FC.MARK_MS;   // a little crystal bobbing and turning, fading as it lapses
            g.setPosition(s.x, s.y - 26 + Math.sin(now * 0.008) * 1.5).setScale(Math.abs(Math.cos(now * 0.004)) * 0.6 + 0.4, 1).setAlpha(0.5 + 0.5 * Math.min(1, k * 3));
        }
        const out = this.currentElement === 'ice' && this.equippedWeapons?.ice === 'fractal_shard' && this.player?.active;
        // Deadly Accuracy's five shards, circling you while it lasts (they form up and fire in _fractalDeadly)
        const deadly = out && this._fracMode?.kind === 'spike' && this._fracMode.until > now;
        if (deadly) {
            const art = WeaponSystem.fractalArt(this);
            if (!this._fracOrbs?.[0]?.active) this._fracOrbs = Array.from({ length: 5 }, () => this.add.image(this.player.x, this.player.y, art.lance).setDepth(4.6).setScale(0.9));
            const halo = this._fracHalo ||= this.add.graphics().setDepth(1.05).setBlendMode(Phaser.BlendModes.ADD);   // under you
            const scope = this._fracScope ||= this.add.graphics().setDepth(5.5).setBlendMode(Phaser.BlendModes.ADD);   // on the cursor
            halo.clear(); scope.clear();
            const cx = this.player.x, cy = this.player.y + 6, pulse = 0.5 + 0.5 * Math.sin(now / 200);
            for (let ring = 0; ring < 2; ring++) {   // a slowly turning crystal sigil on the floor
                const r = (ring ? 24 : 36), rot = (ring ? -1 : 1) * now * 0.0008 + ring * Math.PI / 6, pts = [];
                for (let i = 0; i <= 6; i++) { const a = rot + i * Math.PI / 3; pts.push({ x: cx + Math.cos(a) * r, y: cy + Math.sin(a) * r * 0.45 }); }
                halo.lineStyle(ring ? 1 : 1.5, ring ? 0x9fe8ff : 0xdff8ff, (ring ? 0.35 : 0.5) + 0.2 * pulse).strokePoints(pts, false);
                if (!ring) for (const q of pts.slice(0, 6)) halo.fillStyle(0xffffff, 0.5 + 0.4 * pulse).fillRect(q.x - 1, q.y - 1, 2, 2);
            }
            if (now >= (this._fracOrbBusy || 0)) {   // the lances circle you, points out, each with a fading trail
                this._fracOrbs.forEach((o, i) => {
                    const a = now * 0.0028 + i * Math.PI * 2 / 5, x = cx + Math.cos(a) * FC.ORBIT_R, y = cy - 14 + Math.sin(a) * FC.ORBIT_R * 0.5;
                    o.setPosition(x, y + Math.sin(now / 160 + i) * 2).setRotation(a + Math.PI / 2).setAlpha(Math.min(1, o.alpha + 0.08));
                    if (Math.random() < 0.3) {
                        const ghost = this.add.image(o.x, o.y, art.lance).setRotation(o.rotation).setScale(0.9).setDepth(4.55).setTint(0x7fd8ff).setAlpha(0.35).setBlendMode(Phaser.BlendModes.ADD);
                        this.tweens.add({ targets: ghost, alpha: 0, duration: 260, onComplete: () => ghost.destroy() });
                    }
                });
            }
            const cam = this.cameras.main, ap = this._aim?.(this.input.activePointer), mx = ap ? ap.x + cam.scrollX : cx, my = ap ? ap.y + cam.scrollY : cy;
            const r0 = 14, spin = now * 0.002;   // a scope on your cursor: a ring, four ticks closing and opening, a dot
            scope.lineStyle(1.5, 0xffffff, 0.75).strokeCircle(mx, my, r0);
            scope.lineStyle(1, 0x9fe8ff, 0.5).strokeCircle(mx, my, r0 + 5);
            for (let q = 0; q < 4; q++) { const a = spin + q * Math.PI / 2, i0 = r0 - 6 - 2 * pulse; scope.lineStyle(2, 0xffffff, 0.9).lineBetween(mx + Math.cos(a) * i0, my + Math.sin(a) * i0, mx + Math.cos(a) * (r0 + 9), my + Math.sin(a) * (r0 + 9)); }
            scope.fillStyle(0xffffff, 1).fillRect(mx - 1, my - 1, 2, 2);
        } else if (this._fracOrbs) { for (const o of this._fracOrbs) o?.destroy(); this._fracOrbs = null; this._fracHalo?.destroy(); this._fracHalo = null; this._fracScope?.destroy(); this._fracScope = null; }
        if (!out) { if (this._fracBar?.active) this._fracBar.destroy(); this._fracBar = null; return; }
        if (!this._fracBar?.active) this._fracBar = this.add.graphics().setDepth(6);
        const g = this._fracBar.clear(), x0 = this.player.x - 21, y0 = this.player.y - (this._fracOrbs ? 34 : 16), mode = (this._fracMode?.until || 0) > now ? this._fracMode : null;
        if (mode) return UIKit.rBar(g, x0, y0, 42, (mode.until - now) / FC.MODE_MS, { col: mode.kind === 'spike' ? 0xffffff : 0x7fe0ff, hot: 0xffffff, dark: 0x08141c, time: now, ready: false, gem: false });   // R running: the time left
        UIKit.rBar(g, x0 + 3, y0, 39, (this._fracCharge || 0) / FC.CHARGES, { col: 0x9fe8ff, hot: 0xffffff, dark: 0x08141c, time: now, segs: FC.CHARGES });   // a notch a combo
    }

    // ── PHASE 1: Piercing freeze spike ────────────────────────────────────
    _clearShatterMark(enemy) {
        if (enemy._shatterMarkTimer)  { enemy._shatterMarkTimer.remove();  enemy._shatterMarkTimer  = null; }
        if (enemy._purpleMarkTimer)   { enemy._purpleMarkTimer.remove();   enemy._purpleMarkTimer   = null; }
        if (enemy._shatterMarkVisual) {
            this.tweens.killTweensOf(enemy._shatterMarkVisual);
            enemy._shatterMarkVisual.destroy();
            enemy._shatterMarkVisual = null;
        }
        enemy._shatterMarked = false;
        enemy._purpleMarked  = false;
    }

    _applyGoldMark(enemy, ex, ey) {
        if (this._phasedOut(enemy)) return;
        const MARK_DURATION = 6000;
        this._clearShatterMark(enemy);
        enemy._shatterMarked = true;
        enemy._purpleMarked  = false;
        enemy._shatterMarkTimer = this.time.delayedCall(MARK_DURATION, () => this._clearShatterMark(enemy));

        const mv = this.add.graphics().setDepth(4.5);
        mv.x = ex; mv.y = ey - 20;
        mv.fillStyle(0xffcc00, 0.95);
        mv.beginPath(); mv.moveTo(0, -8); mv.lineTo(6, 0); mv.lineTo(0, 8); mv.lineTo(-6, 0); mv.closePath(); mv.fillPath();
        mv.fillStyle(0xffff88, 0.85);
        mv.beginPath(); mv.moveTo(0, -5); mv.lineTo(3, 0); mv.lineTo(0, 5); mv.lineTo(-3, 0); mv.closePath(); mv.fillPath();
        mv.lineStyle(1.0, 0xaa7700, 0.80);
        mv.beginPath(); mv.moveTo(-2, -4); mv.lineTo(1, 0); mv.lineTo(-1, 4); mv.strokePath();
        mv.lineStyle(1.2, 0xffee44, 0.90);
        mv.beginPath(); mv.moveTo(0,-8); mv.lineTo(6,0); mv.lineTo(0,8); mv.lineTo(-6,0); mv.closePath(); mv.strokePath();
        enemy._shatterMarkVisual = mv;
        this.tweens.add({ targets: mv, scaleX: 1.25, scaleY: 1.25, alpha: 0.65, duration: 400, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    }

    _applyPurpleMark(enemy, ex, ey) {
        // Upgrade from gold — 1.5× damage from ALL sources (resolveElementalHit, damageEnemy, bosses), longer duration
        if (this._phasedOut(enemy)) return;
        const MARK_DURATION = 7000;
        this._clearShatterMark(enemy);
        enemy._shatterMarked = true;
        enemy._purpleMarked  = true;
        enemy._purpleMarkTimer = this.time.delayedCall(MARK_DURATION, () => this._clearShatterMark(enemy));

        // Upgrade flash
        const flash = this.add.graphics().setDepth(5);
        flash.x = ex; flash.y = ey;
        flash.fillStyle(0xcc44ff, 0.7); flash.fillCircle(0, 0, 22);
        flash.fillStyle(0xffffff, 0.9); flash.fillCircle(0, 0, 8);
        this.tweens.add({ targets: flash, scaleX: 2.5, scaleY: 2.5, alpha: 0, duration: 280, onComplete: () => flash.destroy() });
        this.showStatusText(ex, ey - 32, 'AMPLIFIED!', '#cc44ff');
        this.cameras.main.shake(40, 0.004);

        const mv = this.add.graphics().setDepth(4.5);
        mv.x = ex; mv.y = ey - 20;
        // Outer purple diamond — larger than gold
        mv.fillStyle(0xaa22ff, 0.95);
        mv.beginPath(); mv.moveTo(0, -11); mv.lineTo(8, 0); mv.lineTo(0, 11); mv.lineTo(-8, 0); mv.closePath(); mv.fillPath();
        // Inner violet highlight
        mv.fillStyle(0xdd88ff, 0.85);
        mv.beginPath(); mv.moveTo(0, -7); mv.lineTo(5, 0); mv.lineTo(0, 7); mv.lineTo(-5, 0); mv.closePath(); mv.fillPath();
        // Bright core
        mv.fillStyle(0xffffff, 0.95); mv.fillCircle(0, 0, 2.5);
        // Electric outline
        mv.lineStyle(1.5, 0xff88ff, 0.90);
        mv.beginPath(); mv.moveTo(0,-11); mv.lineTo(8,0); mv.lineTo(0,11); mv.lineTo(-8,0); mv.closePath(); mv.strokePath();
        // Small arcs radiating off the diamond
        for (let i = 0; i < 4; i++) {
            const a = (i / 4) * Math.PI * 2;
            mv.lineStyle(0.8, 0xcc44ff, 0.60);
            mv.beginPath(); mv.moveTo(Math.cos(a)*8, Math.sin(a)*8); mv.lineTo(Math.cos(a)*13, Math.sin(a)*13); mv.strokePath();
        }
        enemy._shatterMarkVisual = mv;
        this.tweens.add({ targets: mv, scaleX: 1.3, scaleY: 1.3, alpha: 0.55, duration: 280, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    }

    _applyGoldMarkBoss() {
        const boss = this.voltslimeBoss;
        if (!boss?.active) return;
        const DURATION = 6000;
        if (boss._shatterMarkTimer) { boss._shatterMarkTimer.remove(); boss._shatterMarkTimer = null; }
        if (boss._shatterMarkVisual) { this.tweens.killTweensOf(boss._shatterMarkVisual); boss._shatterMarkVisual.destroy(); boss._shatterMarkVisual = null; }
        boss._shatterMarked = true; boss._purpleMarked = false;
        boss._shatterMarkTimer = this.time.delayedCall(DURATION, () => {
            boss._shatterMarked = false;
            if (boss._shatterMarkVisual) { this.tweens.killTweensOf(boss._shatterMarkVisual); boss._shatterMarkVisual.destroy(); boss._shatterMarkVisual = null; }
        });
        const mv = this.add.graphics().setDepth(9);
        mv.x = boss.container.x;
        mv.y = boss.container.y - 100;
        mv.beginPath(); mv.moveTo(0,-14); mv.lineTo(10,0); mv.lineTo(0,14); mv.lineTo(-10,0); mv.closePath(); mv.fillPath();
        mv.fillStyle(0xffff88, 0.85);
        mv.beginPath(); mv.moveTo(0,-9); mv.lineTo(6,0); mv.lineTo(0,9); mv.lineTo(-6,0); mv.closePath(); mv.fillPath();
        mv.lineStyle(1.8, 0xffee44, 0.90);
        mv.beginPath(); mv.moveTo(0,-14); mv.lineTo(10,0); mv.lineTo(0,14); mv.lineTo(-10,0); mv.closePath(); mv.strokePath();
        boss._shatterMarkVisual = mv;
        this.tweens.add({ targets: mv, scaleX: 1.25, scaleY: 1.25, alpha: 0.65, duration: 400, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    }

    _applyPurpleMarkBoss() {
        const boss = this.voltslimeBoss;
        if (!boss?.active) return;
        const DURATION = 7000;
        if (boss._shatterMarkTimer) { boss._shatterMarkTimer.remove(); boss._shatterMarkTimer = null; }
        if (boss._shatterMarkVisual) { this.tweens.killTweensOf(boss._shatterMarkVisual); boss._shatterMarkVisual.destroy(); boss._shatterMarkVisual = null; }
        boss._shatterMarked = true; boss._purpleMarked = true;
        boss._shatterMarkTimer = this.time.delayedCall(DURATION, () => {
            boss._shatterMarked = false; boss._purpleMarked = false;
            if (boss._shatterMarkVisual) { this.tweens.killTweensOf(boss._shatterMarkVisual); boss._shatterMarkVisual.destroy(); boss._shatterMarkVisual = null; }
        });
        const flash = this.add.graphics().setDepth(9);
        flash.x = boss.container.x; flash.y = boss.container.y - 65;
        flash.fillStyle(0xcc44ff, 0.7); flash.fillCircle(0, 0, 30);
        this.tweens.add({ targets: flash, scaleX: 2.5, scaleY: 2.5, alpha: 0, duration: 280, onComplete: () => flash.destroy() });
        this.showStatusText(boss.container.x, boss.container.y - 120, 'AMPLIFIED!', '#cc44ff');
        const mv = this.add.graphics().setDepth(9);
        mv.x = boss.container.x;
        mv.y = boss.container.y - 100;
        mv.fillStyle(0xaa22ff, 0.95);
        mv.beginPath(); mv.moveTo(0,-18); mv.lineTo(13,0); mv.lineTo(0,18); mv.lineTo(-13,0); mv.closePath(); mv.fillPath();
        mv.fillStyle(0xdd88ff, 0.85);
        mv.beginPath(); mv.moveTo(0,-11); mv.lineTo(8,0); mv.lineTo(0,11); mv.lineTo(-8,0); mv.closePath(); mv.fillPath();
        mv.fillStyle(0xffffff, 0.95); mv.fillCircle(0, 0, 3.5);
        mv.lineStyle(2, 0xff88ff, 0.90);
        mv.beginPath(); mv.moveTo(0,-18); mv.lineTo(13,0); mv.lineTo(0,18); mv.lineTo(-13,0); mv.closePath(); mv.strokePath();
        boss._shatterMarkVisual = mv;
        this.tweens.add({ targets: mv, scaleX: 1.3, scaleY: 1.3, alpha: 0.55, duration: 280, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    }

    _spawnPierceSpike(x, y, angle, volleyId = null, plantsTotem = false) {
        const SPEED  = 900;  // the fastest shot in the game (580 till 2026-10-20)
        const DAMAGE = (this._fractalSpikeDmg || 12) * this.damageScaling;
        const vx = Math.cos(angle) * SPEED;
        const vy = Math.sin(angle) * SPEED;

        // pixel art (WeaponSystem.fractalArt): a crystal needle, pointing up; rotated to its flight each frame
        const g = this.add.image(x, y, WeaponSystem.fractalArt(this).spike).setDepth(3.5).setScale(1.3);
        g._glow = null;

        const shardObj = {
            sprite: g, vx, vy,
            startX: x, startY: y,
            damage: DAMAGE,
            createdAt: this.time.now,
            lastTrailTime: 0,
            _lastAfterimageTime: 0,
            isCannonShard: true,
            isPierceSpike: true,
            _plantsTotem: plantsTotem,
            // NO isPiercing FLAG, deliberately. I added one here and it was wrong: both fractal
            // phases ALREADY pierce, through a different mechanism entirely. Their collision
            // branches keep a `hitEnemies` Set, skip anything already in it, and simply never
            // destroy the shard -- pierce by omission. The isPiercing/maxPierces pair belongs to
            // other shard types (nova, heal) and adding it here stacked a second, conflicting
            // pierce system on top of the working one.
            //
            // Lesson for next time: a flag being unset does not mean the behaviour is absent.
            // Read the collision branch, not the constructor.
            volleyId,
            hitEnemies: new Set(),
            piercedEnemies: new Set(),
        };
        this.iceShards.push(shardObj);
    }

    // ── FROST TOTEM — spawns on first pierce spike hit ─────────────────────
    _spawnFrostTotem(px, py) {
        const TOTEM_DUR      = 5000;   // 5s
        const CHILL_RADIUS   = 2;      // tiles
        const CHILL_INTERVAL = 500;    // ms between stack applications

        // Destroy any existing totem
        if (this._activeFrostTotem) {
            this._activeFrostTotem.destroy();
            this._activeFrostTotem = null;
        }

        // ── Crystal pillar visual — compact, fits one tile ───────────────────
        const g = this.add.graphics().setDepth(2.5);
        g.x = px; g.y = py;

        // Ground shadow
        g.fillStyle(0x44aaff, 0.15); g.fillEllipse(0, 2, 14, 6);

        // Main crystal body — small pillar
        g.fillStyle(0x99eeff, 0.88);
        g.beginPath(); g.moveTo(0, -14); g.lineTo(5, -7); g.lineTo(5, 3); g.lineTo(0, 5); g.lineTo(-5, 3); g.lineTo(-5, -7); g.closePath(); g.fillPath();

        // Inner bright face
        g.fillStyle(0xddf8ff, 0.65);
        g.beginPath(); g.moveTo(0, -14); g.lineTo(3, -7); g.lineTo(3, 3); g.lineTo(0, 5); g.closePath(); g.fillPath();

        // Outline
        g.lineStyle(0.8, 0xffffff, 0.55);
        g.beginPath(); g.moveTo(0, -14); g.lineTo(5, -7); g.lineTo(5, 3); g.lineTo(0, 5); g.lineTo(-5, 3); g.lineTo(-5, -7); g.closePath(); g.strokePath();

        // Top tip
        g.fillStyle(0xffffff, 0.95);
        g.beginPath(); g.moveTo(0, -18); g.lineTo(3, -12); g.lineTo(-3, -12); g.closePath(); g.fillPath();

        // Ambient glow
        g.fillStyle(0x44aaff, 0.20); g.fillCircle(0, -5, 8);

        // Radius ring
        const radiusPx = CHILL_RADIUS * this.TILE_SIZE;
        g.lineStyle(0.8, 0x44aaff, 0.18); g.strokeCircle(0, 0, radiusPx);

        // Fade in
        g.setAlpha(0);
        this.tweens.add({ targets: g, alpha: 1, duration: 180, ease: 'Quad.easeOut' });

        // Pulse glow tween
        this.tweens.add({ targets: g, alpha: 0.75, duration: 600, yoyo: true, repeat: -1, ease: 'Sine.easeInOut', delay: 200 });

        // Particle emit every tick — small ice crystals drifting up
        const particleTimer = this.time.addEvent({
            delay: 280, loop: true,
            callback: () => {
                if (!g.active) { particleTimer.remove(); return; }
                const pg = this.add.graphics().setDepth(3);
                pg.x = px + (Math.random()-0.5)*16;
                pg.y = py - 8 + (Math.random()-0.5)*8;
                pg.fillStyle(Math.random() > 0.5 ? 0xaaeeff : 0xffffff, 0.80);
                pg.fillCircle(0, 0, 1.5 + Math.random()*1.5);
                this.tweens.add({ targets: pg, y: pg.y - 14, alpha: 0, duration: 500 + Math.random()*300, onComplete: () => pg.destroy() });
            }
        });

        // ── Chill tick — every 500ms, apply 1 chill stack to enemies in radius ──
        const chillTimer = this.time.addEvent({
            delay: CHILL_INTERVAL, loop: true,
            callback: () => {
                if (!g.active) { chillTimer.remove(); return; }
                const tpx = Math.floor(px / this.TILE_SIZE);
                const tpy = Math.floor(py / this.TILE_SIZE);
                for (const enemy of this.enemies) {
                    if (this._phasedOut?.(enemy)) continue;
                    if (!enemy.sprite?.active || enemy.health <= 0) continue;
                    if (enemy.fireImmune || enemy.elementImmune) continue;
                    if (enemy.isFrozen) continue; // already frozen — don't re-stack chill
                    const dx = enemy.x - tpx, dy = enemy.y - tpy;
                    if (Math.sqrt(dx*dx + dy*dy) > CHILL_RADIUS) continue;
                    // Ignores iceImmune -- that's the whole point of the totem.
                    // Was freezeEnemy(4000): a leftover 4-second hard stun on a weapon path.
                    this.applyChill(enemy, this._chillCfg().TOTEM);
                    // Small chill puff visual
                    const cf = this.add.graphics().setDepth(3.5);
                    cf.x = enemy.sprite.x; cf.y = enemy.sprite.y - 10;
                    cf.fillStyle(0xaaeeff, 0.70); cf.fillCircle(0, 0, 2.5);
                    this.tweens.add({ targets: cf, y: cf.y - 8, alpha: 0, duration: 350, onComplete: () => cf.destroy() });
                }
                // Boss chill tick
                if (this.voltslimeBoss?.active) {
                    const boss = this.voltslimeBoss;
                    const bdx = boss.tileX - tpx, bdy = boss.tileY - tpy;
                    if (Math.sqrt(bdx*bdx + bdy*bdy) <= CHILL_RADIUS) {
                        if (typeof this.freezeBossFromIceWeapon === 'function')
                            this.freezeBossFromIceWeapon(false);
                    }
                }
            }
        });

        // Destroy after duration
        this.time.delayedCall(TOTEM_DUR, () => {
            particleTimer.remove();
            chillTimer.remove();
            if (g.active) {
                this.tweens.killTweensOf(g);
                this.tweens.add({ targets: g, alpha: 0, scaleX: 0.5, scaleY: 0.5, duration: 300, ease: 'Quad.easeIn', onComplete: () => g.destroy() });
            }
            if (this._activeFrostTotem === totemObj) this._activeFrostTotem = null;
        });

        const totemObj = { destroy: () => { particleTimer.remove(); chillTimer.remove(); this.tweens.killTweensOf(g); if (g.active) g.destroy(); } };
        this._activeFrostTotem = totemObj;
    }

    // ── PHASE 2: Unstable splitter ─────────────────────────────────────────
    // Each shard splits into 2 after SPLIT_INTERVAL ms. Capped at gen 4
    // (1 → 2 → 4 → 8 → 16, max 31 total projectiles per shot).
    _spawnSplitterShard(x, y, angle, gen) {
        // ── WHY THIS IS SO MUCH SMALLER THAN IT WAS ──────────────────────────
        // Every shard split into TWO, four times over. One seed therefore became
        // 1+2+4+8+16 = 31 shards, and every split also detonated an AoE at its own position.
        // Five seeds in the fan meant 155 piercing shards and 75 explosions per cast.
        //
        // That was survivable while phase 2 was a 360 ring, because the shards sprayed away from
        // each other and any single enemy only met a few. Narrowing it to a 60 degree fan pointed
        // the entire cascade down one lane -- so nerfing the ARC was a large buff to the damage
        // anything in front of you actually took. That is why it melted.
        //
        // Two generations instead of four: 7 shards per seed, 35 per cast, 15 explosions. Ice's
        // payoff is meant to be the shatter, so the fan's job is covering ground with CHILL.
        const MAX_GEN      = 2;
        const SPLIT_INTERVAL = 250; // ms between splits
        const SPEEDS     = [160, 130, 105, 85, 70];
        // x0.5 (was 5 / 3 / 2 / 1 / 1). x0.65 measured with purple at 1.5x on
        // these shards only; purple reaches every source now and the fan chills (cubes: brittle),
        // and at x0.65 it was still the best group weapon in the game (290 against the staff's 262).
        // ×0.72 again (2026-10-18): at 217 on packs it still out-crowded Ball Lightning
        const DAMAGES    = [3.75, 2.35, 1.55, 0.8, 0.8];   // ×1.7 (2026-10-18): the burst is the medium AoE now, the spike only sets up
        const SIZES      = [8,    6,   5,   4,  3];

        const speed  = SPEEDS[gen];
        const storm = this._fracMode?.kind === 'fan' && this._fracMode.until > this.time.now;   // Shard Storm's fans chip
        const damage = DAMAGES[gen] * this.damageScaling * (storm ? (this._fractalCfg?.().STORM_DMG ?? 1) : 1);
        const size   = SIZES[gen];
        const vx = Math.cos(angle) * speed;
        const vy = Math.sin(angle) * speed;

        // Visual: jagged unstable crystal — darker and more fractured each gen
        // Colour shifts from bright white-blue (gen0) to deep teal (gen3)
        const colours = [
            { body: 0x88ddff, mid: 0xddf8ff, rim: 0xffffff },
            { body: 0x44bbdd, mid: 0xaaeeff, rim: 0xddf8ff },
            { body: 0x2299bb, mid: 0x77ccee, rim: 0xbbefff },
            { body: 0x116688, mid: 0x44aacc, rim: 0x88ddee },
            { body: 0x0a3344, mid: 0x226688, rim: 0x55aabb },
        ];
        const col = colours[Math.min(gen, colours.length - 1)];

        // pixel art (WeaponSystem.fractalArt): a jagged crystal, darker and smaller each split
        const g = this.add.image(x, y, WeaponSystem.fractalArt(this).shard[Math.min(gen, 4)]).setDepth(3 + gen * 0.05).setScale(size * 2 / 12);
        g._glow = null;

        const shardObj = {
            sprite: g, vx, vy,
            startX: x, startY: y,
            damage,
            createdAt: this.time.now,
            lastTrailTime: 0,
            isCannonShard: true,
            isSplitter: true,
            volleyId: this._fractalVolley,   // the burst it came from (_volleyMult)
            splitterGen: gen,
            splitterCanSplit: gen < MAX_GEN && !storm,   // (Shard Storm's don't split: four fans a second of splitting shards was hundreds of them)
            splitterAngle: angle,
            hitEnemies: new Set(),
            piercedEnemies: new Set(),
            isRecalling: false,
        };

        // Schedule the split
        if (gen < MAX_GEN) {
            shardObj._splitTimer = this.time.delayedCall(SPLIT_INTERVAL, () => {
                if (!shardObj.sprite?.active) return;
                this._triggerSplitterSplit(shardObj);
            });
        }

        // ── RECALL, measured in DISTANCE rather than on a timer ──────────────
        // The old version flipped after a flat 1200ms. At the final generation's speed that is
        // roughly 125px -- barely past arm's reach, so fragments turned around while still on top
        // of you and the return pass re-hit the same enemies as the outbound one.
        //
        // Distance is also the honest unit: it does not silently change meaning when a
        // generation's speed is retuned, which a hardcoded duration does.
        if (gen === MAX_GEN) {
            shardObj._isFinalGen    = true;
            shardObj._recallAfterPx = 260;
            shardObj._travelledPx   = 0;
            shardObj._recallDmgMult = 2.2;   // boosted return damage
        }

        this.iceShards.push(shardObj);
    }

    _triggerSplitterSplit(s) {
        if (!s.splitterCanSplit || !s.sprite?.active) return;
        const x = s.sprite.x, y = s.sprite.y;
        const nextGen = s.splitterGen + 1;
        const baseAngle = s.splitterAngle;

        // Split into 2 at ±25° spread — feels like unstable fragmentation
        const SPREAD = Math.PI / 7.2; // 25°
        this._spawnSplitterShard(x, y, baseAngle - SPREAD, nextGen);
        this._spawnSplitterShard(x, y, baseAngle + SPREAD, nextGen);

        // ── AoE ice explosion at every split point ──
        const AOE_R = 22 + (4 - s.splitterGen) * 5; // gen0 splits are bigger
        const splitDmg = s.damage * 0.3;   // every split detonates; 0.5 compounded far too hard
        // Visual
        // a crisp ring and a frost star rather than filled discs: a fan's cascade lands dozens of these together, and
        // stacked fills (with the bloom on top) blew the whole area out to white. Past a handful at once, rings only.
        const burst = this.add.graphics().setDepth(5), now = this.time.now;
        this._splitFx = (this._splitFx || []).filter(t => now - t < 120); this._splitFx.push(now);
        const busy = this._splitFx.length > 5;
        burst.x = x; burst.y = y;
        if (!busy) {
            burst.fillStyle(0xaaeeff, 0.12); burst.fillCircle(0, 0, AOE_R * 0.9);
            burst.fillStyle(0xffffff, 0.8); burst.fillCircle(0, 0, 2 + s.splitterGen);
            for (let i = 0; i < 6; i++) {
                const sa = baseAngle + (i / 6) * Math.PI * 2;
                burst.lineStyle(1.2, i % 2 === 0 ? 0xe8faff : 0x88ddff, 0.7);
                burst.beginPath(); burst.moveTo(Math.cos(sa)*3, Math.sin(sa)*3); burst.lineTo(Math.cos(sa)*(AOE_R*0.8), Math.sin(sa)*(AOE_R*0.8)); burst.strokePath();
            }
        }
        burst.lineStyle(busy ? 1 : 1.5, 0xddf8ff, busy ? 0.45 : 0.8); burst.strokeCircle(0, 0, AOE_R * 0.9);
        this.tweens.add({ targets: burst, scaleX: 1.5, scaleY: 1.5, alpha: 0, duration: 200, ease: 'Quad.easeOut', onComplete: () => burst.destroy() });

        // Damage enemies in AoE radius at split point
        for (const enemy of [...this.enemies]) {
            if (!enemy.sprite?.active) continue;
            const edx = enemy.sprite.x - x, edy = enemy.sprite.y - y;
            if (edx*edx + edy*edy > AOE_R*AOE_R) continue;
            if (enemy.iceImmune || enemy.fireImmune || enemy.elementImmune) continue;
            if (enemy.isFrozen) {
                this._triggerShatterBurst(enemy, 1.6); // Fractal Shard — buffed shatter damage
            } else {
                if (this._phasedOut(enemy)) continue;   // phased out: not in the world
                // Tagged 'physical' until now, so the splitter -- an ICE weapon's AoE --
                // sailed straight past ice resistance at full damage while the same
                // weapon's spikes and shatter were cut to 0.40x.
                const _rd2406 = this.resolveElementalHit(enemy, splitDmg, 'ice');
                if (_rd2406 === null) continue;
                enemy.health -= _rd2406;
                this.showDamageNumber(enemy.sprite.x, enemy.sprite.y - 10, Math.round(_rd2406), '#aaeeff');
                this.updateEnemyHealthBar(enemy);
                this.gainUltCharge(this.ultChargePerHit);
                if (enemy.health <= 0) this.killEnemy(enemy);
            }
        }

        // Remove the parent shard cleanly
        const idx = this.iceShards.indexOf(s);
        if (idx !== -1) this.iceShards.splice(idx, 1);
        this.destroyIceShard(s);
    }

    icicleStaffAttack(targetX, targetY) {
        const currentTime = this.time.now;

        // A plain ice shotgun (reworked 2026-10-18; it had a range gimmick nobody used):
        // PELLETS icicles in a fixed cone every COOLDOWN, the same damage wherever you aim,
        // reaching RANGE tiles. Each one chills a little and splashes the tiles beside what it
        // hits. Up close the whole cone lands on one target; into a crowd it spreads. Perks:
        // Spread Shot (more icicles), Tight Choke (a narrower cone that reaches further).
        const C = { COOLDOWN: 760, DMG: 10.5, SPREAD: 0.30, RANGE: 6, SPEED: 620, CHILL: 0.8, SHATTER: 1.4 };   // CHILL 0.8: a point-blank volley gets ~2.4 of the 3-stack bar (was 0.35, ~1, and the target died first)
        const choke = WeaponLevels.perk('icicle_cannon', 'choke');
        // Spread Shot: +1, +2 icicles; at its max it's a double barrel instead, two volleys a shot (the second 140ms on)
        const spreadLv = WeaponLevels.perk('icicle_cannon', 'pellets'), doubleBarrel = spreadLv >= 3;
        const PELLETS         = 5 + Math.min(2, spreadLv);
        const playerPx = this._shotX();   // where the slime is drawn (mid-dash it's still on its way)
        const playerPy = this._shotY();
        const worldX   = targetX + this.cameras.main.scrollX;
        const worldY   = targetY + this.cameras.main.scrollY;
        const cursorDx = worldX - playerPx;
        const cursorDy = worldY - playerPy;
        if (!this._icicleSecond) {
            if (currentTime - (this.lastIcicleStaffTime || 0) < C.COOLDOWN) return;
            this.lastIcicleStaffTime = currentTime;
            if (doubleBarrel) this.time.delayedCall(140, () => {
                if (this.currentElement !== 'ice' || this._deathScreenActive) return;
                this._icicleSecond = true;
                try { this.icicleStaffAttack(targetX, targetY); } finally { this._icicleSecond = false; }
            });
        }
        this._gearFiredAt = currentTime;   // the held weapon swings now (Creatures.gear)
        const inZone = true;                                   // (the visuals below still read it)
        const spreadHalf = C.SPREAD * (1 - 0.2 * choke) * Enchants.spread('icicle_cannon');   // True Aim narrows the cone
        const pelletSpeed = C.SPEED;
        const range = (C.RANGE + 1.5 * choke) * this.TILE_SIZE;
        const shardDmg = C.DMG * this.damageScaling;
        const shatterMultCannon = C.SHATTER;
        const chillWeight = C.CHILL;
        const SPLASH_RADIUS = 30; // px: the 4 tiles beside the target
        const SPLASH_DMG    = shardDmg * 0.35;
        const baseAngle = Math.atan2(cursorDy, cursorDx);
        const volleyId = Math.random().toString(36).slice(2);   // one shot's icicles fall off on one target (_volleyMult)

        // ── Fire PELLETS pellets ───────────────────────────────────────────────
        for (let s = 0; s < PELLETS; s++) {
            const spreadFrac = PELLETS > 1 ? (s / (PELLETS - 1) - 0.5) * 2 : 0;
            const angle = baseAngle + spreadFrac * spreadHalf;
            const vx = Math.cos(angle) * pelletSpeed;
            const vy = Math.sin(angle) * pelletSpeed;

            // Pellet visual — bright ice diamond
            const container = this.add.container(playerPx, playerPy).setDepth(3);
            const g = this.add.graphics();
            container.add(g);
            container.setAngle(Math.random() * 360);
            const scale = 0.8 + Math.random() * 0.3;
            const R = (inZone ? 6 : 5) * scale; // slightly bigger inside zone
            const v = Math.random();
            const shadow = v < 0.33 ? 0x1155aa : v < 0.66 ? 0x0d4488 : 0x1a5599;
            const body   = v < 0.33 ? 0x2277cc : v < 0.66 ? 0x1a88dd : 0x3366bb;
            const lit    = v < 0.33 ? 0x55aaee : v < 0.66 ? 0x44bbff : 0x6699dd;
            const spec   = v < 0.33 ? 0xaaddff : v < 0.66 ? 0x88eeff : 0xbbccff;
            // Inside zone: brighter tint
            const brightMult = inZone ? 1.15 : 1.0;
            g.fillStyle(shadow, 0.90);
            g.beginPath(); g.moveTo(0,-R*2.0); g.lineTo(R,0); g.lineTo(0,R*2.0); g.closePath(); g.fillPath();
            g.fillStyle(body, 1.0);
            g.beginPath(); g.moveTo(0,-R*2.0); g.lineTo(R,0); g.lineTo(0,R*2.0); g.lineTo(-R,0); g.closePath(); g.fillPath();
            g.fillStyle(lit, 0.70);
            g.beginPath(); g.moveTo(0,-R*2.0); g.lineTo(-R,0); g.lineTo(0,R*2.0); g.closePath(); g.fillPath();
            if (inZone) { g.fillStyle(0xffffff, 0.55); g.fillCircle(-R*0.2, -R*0.6, R*0.28); } // extra highlight inside zone
            g.fillStyle(0xffffff, 0.85); g.fillCircle(-R*0.25, -R*0.5, R*0.18);
            g.lineStyle(1.0, spec, 0.85);
            g.beginPath(); g.moveTo(0,-R*2.0); g.lineTo(R,0); g.lineTo(0,R*2.0); g.lineTo(-R,0); g.closePath(); g.strokePath();

            const capturedInZone   = inZone;
            const capturedDmg      = shardDmg;
            const capturedShatterM = shatterMultCannon;
            const capturedPiercing = !inZone;

            this.iceShards.push({
                sprite: container, vx, vy,
                damage: capturedDmg,
                _chillWeight: chillWeight,
                startX: playerPx, startY: playerPy, _range: range, volleyId,
                createdAt: this.time.now,
                isCannonShard: true,
                isPiercing: capturedPiercing,
                _shatterMult: capturedShatterM,
                bounces: 0,
                maxBounces: capturedPiercing ? 2 : 0,
                pierceCount: 0,
                maxPierces: capturedPiercing ? 2 : 0,
                isHealShot: false,
                isHoming: false,
                rotSpeed: (Math.random() > 0.5 ? 1 : -1) * (1.5 + Math.random() * 2.0),
                hitEnemies: new Set(),
                piercedEnemies: new Set(),
                _onHit: (enemy) => {
                    // chillWeight, not s._chillWeight: `s` is this loop's INDEX, so the weighting
                    // read undefined and every pellet chilled (and charged the nova) at full weight
                    this.applyIcicleCannonHit(enemy, capturedDmg * this._volleyMult(enemy, volleyId), capturedShatterM, chillWeight);

                    // ── Accuracy zone splash ─────────────────────────────────
                    if (capturedInZone && enemy.sprite?.active) {
                        const sx = enemy.sprite.x, sy = enemy.sprite.y;
                        // Splash visual
                        VisualFX.impact(this, sx, sy - 4, 'ice', SPLASH_RADIUS * 0.8);   // a bigger crack of shards

                        // Splash damage + 1 chill stack to nearby enemies
                        for (const nearEnemy of [...this.enemies]) {
                            if (this._phasedOut?.(nearEnemy)) continue;
                            // the pellet's own target is at distance 0: it took a second +50% and chill
                            if (nearEnemy === enemy || !nearEnemy.sprite?.active) continue;
                            const sdx = nearEnemy.sprite.x - sx, sdy = nearEnemy.sprite.y - sy;
                            if (sdx*sdx + sdy*sdy > SPLASH_RADIUS*SPLASH_RADIUS) continue;
                            if (nearEnemy.fireImmune || nearEnemy.elementImmune) continue;
                            if (nearEnemy.isFrozen) {
                                this._triggerShatterBurst(nearEnemy, capturedShatterM);
                            } else if (!nearEnemy.iceImmune) {
                                const _rd2587 = this.resolveElementalHit(nearEnemy, SPLASH_DMG, 'ice');
                                if (_rd2587 === null) continue;
                                nearEnemy.health -= _rd2587;
                                this.showDamageNumber(nearEnemy.sprite.x, nearEnemy.sprite.y - 8, Math.round(_rd2587), '#aaeeff');
                                this.updateEnemyHealthBar(nearEnemy);
                                if (nearEnemy.health <= 0) { this.killEnemy(nearEnemy); continue; }
                            }
                            // Splash chill is weighted the same way. Left flat, a ranged spam
                            // would still chill whole GROUPS for free, which is the same exploit
                            // one step removed. Applies to iceImmune enemies as before -- they
                            // cannot be damaged but can still be frozen and shattered.
                            // Was freezeEnemy(10000) -- the cannon's DIRECT hits cubed while its
                            // own splash handed out a ten-second hard stun. Same weapon, two
                            // different mechanics, depending on which enemy you clipped.
                            this.applyChill(nearEnemy, chillWeight * 0.5, { chargeMult: 0.65 });
                        }
                    }

                    // Impact fragments
                    if (enemy.sprite?.active) {
                        const ix = enemy.sprite.x, iy = enemy.sprite.y;
                        const ic = capturedInZone ? 0x55ccff : 0x88ddff;
                        for (let f = 0; f < (capturedInZone ? 4 : 3); f++) {
                            const fa = Math.random() * Math.PI * 2;
                            const fd = 6 + Math.random() * (capturedInZone ? 12 : 8);
                            const fg = this.add.graphics().setDepth(4);
                            fg.x = ix; fg.y = iy;
                            fg.fillStyle(f % 2 === 0 ? ic : 0xffffff, 0.85);
                            fg.fillRect(-1, -2, 2, 4);
                            fg.setRotation(fa);
                            this.tweens.add({ targets: fg, x: ix + Math.cos(fa)*fd, y: iy + Math.sin(fa)*fd, alpha: 0, scaleX: 0.3, scaleY: 0.3, duration: 180, ease: 'Cubic.easeOut', onComplete: () => fg.destroy() });
                        }
                    }

                    // each icicle that lands is one of the 28 that charge the Frost Shield
                    if (!(this._frostShieldUntil > this.time.now)) this._icicleHitCounter = Math.min(28, (this._icicleHitCounter || 0) + 1);   // (not while the shield is up)
                    this._updateIcicleChargeBar();
                }
            });
        }

        // ── Muzzle flash ──────────────────────────────────────────────────────
        const puffG = this.add.graphics().setDepth(4);
        puffG.x = playerPx; puffG.y = playerPy;
        const chipCol  = inZone ? 0x55ccff : 0x88ccff;
        const chipCol2 = inZone ? 0xbbf0ff : 0xddf4ff;
        for (let bi = 0; bi < (inZone ? 7 : 5); bi++) {
            const ba = baseAngle + (Math.random() - 0.5) * spreadHalf * 3.0;
            const bl = (inZone ? 6 : 4) + Math.random() * 8;
            puffG.fillStyle(bi % 2 === 0 ? chipCol : chipCol2, 0.90);
            const bx2 = Math.cos(ba) * (2 + Math.random() * 4);
            const by2 = Math.sin(ba) * (2 + Math.random() * 4);
            puffG.fillRect(bx2 - 1, by2 - 1, 2, 2);
            puffG.lineStyle(1.0, bi % 2 === 0 ? chipCol : chipCol2, 0.80);
            puffG.beginPath();
            puffG.moveTo(Math.cos(ba)*2, Math.sin(ba)*2);
            puffG.lineTo(Math.cos(ba)*bl, Math.sin(ba)*bl);
            puffG.strokePath();
        }
        puffG.fillStyle(0xffffff, 0.90); puffG.fillCircle(0, 0, inZone ? 4 : 3);
        this.tweens.add({ targets: puffG, scaleX: 1.8, scaleY: 1.8, alpha: 0, duration: 100, onComplete: () => puffG.destroy() });

        this.cameras.main.shake(inZone ? 25 : 12, 0.001);
    }

    // ── Heal shard — fired when heal mode is active ───────────────────────────
    // ── Charged Nova Burst — fires a full ring of icicle shards in every ──
    // ── direction around the player. Damages + heals on every hit, exactly ──
    // ── like the old heal shard's payload, but instant and all-around. ──
    _fireIcicleNovaBurst(ox, oy) {
        const NOVA_COUNT  = 16;           // shards in the ring
        const NOVA_SPEED  = 260;
        const NOVA_DMG    = 4.5 * this.damageScaling;
        const HEAL_ON_HIT = 5;
        const SPLASH_R    = 40; // super shot impact radius — larger reach per enemy hit

        this.showStatusText(ox, oy - 34, '❄ NOVA BURST', '#00ff88');
        this.cameras.main.shake(70, 0.006);

        // Big expanding ring shockwave visual at the origin — scaled up to match the larger radius
        const ringG = this.add.graphics().setDepth(5);
        ringG.x = ox; ringG.y = oy;
        ringG.lineStyle(4, 0x00ffaa, 0.85); ringG.strokeCircle(0, 0, 12);
        ringG.lineStyle(2, 0xffffff, 0.70); ringG.strokeCircle(0, 0, 18);
        this.tweens.add({ targets: ringG, scaleX: 8, scaleY: 8, alpha: 0, duration: 450, ease: 'Quad.easeOut', onComplete: () => ringG.destroy() });

        for (let i = 0; i < NOVA_COUNT; i++) {
            const angle = (i / NOVA_COUNT) * Math.PI * 2;
            const vx = Math.cos(angle) * NOVA_SPEED;
            const vy = Math.sin(angle) * NOVA_SPEED;

            // Shard visual — green-tinted icicle, oriented along travel direction
            const container = this.add.container(ox, oy).setDepth(3.4);
            const g = this.add.graphics();
            container.add(g);
            container.setAngle(angle * (180 / Math.PI));
            const R = 5.5 + Math.random() * 1.5;
            g.fillStyle(0x007744, 0.90);
            g.beginPath(); g.moveTo(0,-R*2.0); g.lineTo(R,0); g.lineTo(0,R*2.0); g.closePath(); g.fillPath();
            g.fillStyle(0x00cc66, 1.0);
            g.beginPath(); g.moveTo(0,-R*2.0); g.lineTo(R,0); g.lineTo(0,R*2.0); g.lineTo(-R,0); g.closePath(); g.fillPath();
            g.fillStyle(0x55ffbb, 0.75);
            g.beginPath(); g.moveTo(0,-R*2.0); g.lineTo(-R,0); g.lineTo(0,R*2.0); g.closePath(); g.fillPath();
            g.fillStyle(0xffffff, 0.85); g.fillCircle(-R*0.25, -R*0.5, R*0.20);
            g.lineStyle(1.0, 0x88ffcc, 0.85);
            g.beginPath(); g.moveTo(0,-R*2.0); g.lineTo(R,0); g.lineTo(0,R*2.0); g.lineTo(-R,0); g.closePath(); g.strokePath();

            const novaObj = {
                sprite: container, vx, vy,
                damage: NOVA_DMG,
                startX: ox, startY: oy,
                createdAt: this.time.now,
                isCannonShard: true,
                isNovaShard: true,
                isPiercing: true,
                bounces: 0, maxBounces: 1,
                pierceCount: 0, maxPierces: 2,
                isHoming: false,
                rotSpeed: (Math.random() > 0.5 ? 1 : -1) * (2.0 + Math.random() * 2.0),
                hitEnemies: new Set(),
                piercedEnemies: new Set(),
                _onHit: (enemy) => {
                    if (!enemy.sprite?.active) return;
                    if (enemy.isFrozen) {
                        this._triggerShatterBurst(enemy, 1 / 7.5);
                    } else if (!enemy.iceImmune) {
                        if (this._phasedOut(enemy)) return;   // phased out: not in the world
                        const _rd2719 = this.resolveElementalHit(enemy, NOVA_DMG, 'ice');
                        if (_rd2719 === null) return;
                        enemy.health -= _rd2719;
                        this.showDamageNumber(enemy.sprite.x, enemy.sprite.y - 10, Math.round(_rd2719), '#44ffaa');
                        this.updateEnemyHealthBar(enemy);
                        if (enemy.health <= 0) { this.killEnemy(enemy); return; }
                        // The melt timer here was dead weight: it fired at 10s and tested
                        // isFrozen, which a cube never sets. shatterIceCube owns the water now.
                        this.applyChill(enemy, this._chillCfg().SPLASH);
                    }
                    // Heal on every enemy hit — keeps the sustain identity of the old heal shard
                    this.health = Math.min((this.maxHealth || 100) + 25, this.health + HEAL_ON_HIT);
                    if (typeof HUD !== 'undefined') HUD.prototype.updateHUD.call(this);
                    const hbG = this.add.graphics().setDepth(5);
                    hbG.x = enemy.sprite.x; hbG.y = enemy.sprite.y;
                    hbG.fillStyle(0x00ff88, 0.70); hbG.fillCircle(0, 0, 10);
                    hbG.fillStyle(0xffffff, 0.85); hbG.fillCircle(0, 0, 4);
                    this.tweens.add({ targets: hbG, scaleX: 2.2, scaleY: 2.2, alpha: 0, duration: 250, onComplete: () => hbG.destroy() });

                    // Splash on impact — larger radius (super shot)
                    const burstG = this.add.graphics().setDepth(4.5);
                    burstG.x = enemy.sprite.x; burstG.y = enemy.sprite.y;
                    burstG.fillStyle(0x00ffaa, 0.30); burstG.fillCircle(0, 0, SPLASH_R);
                    this.tweens.add({ targets: burstG, scaleX: 1.6, scaleY: 1.6, alpha: 0, duration: 220, onComplete: () => burstG.destroy() });

                    // Splash damage to nearby enemies within SPLASH_R
                    for (const other of [...this.enemies]) {
                        if (this._phasedOut?.(other)) continue;
                        if (other === enemy || !other.sprite?.active) continue;
                        const edx = other.sprite.x - enemy.sprite.x, edy = other.sprite.y - enemy.sprite.y;
                        if (edx*edx + edy*edy > SPLASH_R*SPLASH_R) continue;
                        if (other.iceImmune || other.fireImmune || other.elementImmune) continue;
                        const splashDmg = NOVA_DMG * 0.5;
                        const _rd2776 = this.resolveElementalHit(other, splashDmg, 'ice');
                        if (_rd2776 === null) continue;
                        other.health -= _rd2776;
                        this.showDamageNumber(other.sprite.x, other.sprite.y - 10, Math.round(_rd2776), '#44ffaa');
                        this.updateEnemyHealthBar(other);
                        if (other.health <= 0) this.killEnemy(other);
                    }
                },
            };
            this.iceShards.push(novaObj);
        }
    }

    _fireIcicleHealShard(ox, oy, worldX, worldY) {
        const baseAngle = Math.atan2(worldY - oy, worldX - ox);
        const HEAL_SHARD_SPEED = 220;
        const HEAL_SHARD_DMG   = 2.5 * this.damageScaling;
        const HEAL_ON_HIT      = 5;
        const SPLASH_R         = 32;
        const MINI_COUNT       = 6;

        this.showStatusText(ox, oy - 30, '✦ HEAL SHARD', '#00ff88');
        this.cameras.main.shake(40, 0.002);

        // Visual — large glowing green crystal
        const container = this.add.container(ox, oy).setDepth(3.5);
        const g = this.add.graphics();
        container.add(g);
        const R = 9;
        g.fillStyle(0x007744, 0.90);
        g.beginPath(); g.moveTo(0,-R*2.2); g.lineTo(R*1.1,0); g.lineTo(0,R*2.2); g.closePath(); g.fillPath();
        g.fillStyle(0x00cc66, 1.0);
        g.beginPath(); g.moveTo(0,-R*2.2); g.lineTo(R*1.1,0); g.lineTo(0,R*2.2); g.lineTo(-R*1.1,0); g.closePath(); g.fillPath();
        g.fillStyle(0x44ffaa, 0.75);
        g.beginPath(); g.moveTo(0,-R*2.2); g.lineTo(-R*1.1,0); g.lineTo(0,R*2.2); g.closePath(); g.fillPath();
        g.fillStyle(0xffffff, 0.90); g.fillCircle(-R*0.25, -R*0.6, R*0.28);
        g.lineStyle(1.5, 0xaaffcc, 0.90);
        g.beginPath(); g.moveTo(0,-R*2.2); g.lineTo(R*1.1,0); g.lineTo(0,R*2.2); g.lineTo(-R*1.1,0); g.closePath(); g.strokePath();
        // Glow ring
        const glowG = this.add.graphics();
        container.add(glowG);
        glowG.lineStyle(3, 0x00ff88, 0.45); glowG.strokeCircle(0, 0, R * 1.8);

        const vx = Math.cos(baseAngle) * HEAL_SHARD_SPEED;
        const vy = Math.sin(baseAngle) * HEAL_SHARD_SPEED;

        const onImpact = (ix, iy) => {
            if (!container.active) return;
            container.destroy();

            // Big AoE burst visual
            const burstG = this.add.graphics().setDepth(5);
            burstG.x = ix; burstG.y = iy;
            burstG.fillStyle(0x00ffaa, 0.35); burstG.fillCircle(0, 0, SPLASH_R * 1.4);
            burstG.fillStyle(0xffffff, 0.80); burstG.fillCircle(0, 0, SPLASH_R * 0.38);
            burstG.lineStyle(2, 0x44ffaa, 0.80); burstG.strokeCircle(0, 0, SPLASH_R * 1.0);
            for (let ri = 0; ri < 8; ri++) {
                const ra = (ri / 8) * Math.PI * 2;
                burstG.lineStyle(1.5, 0x00ff88, 0.65);
                burstG.beginPath(); burstG.moveTo(Math.cos(ra)*6, Math.sin(ra)*6); burstG.lineTo(Math.cos(ra)*SPLASH_R*1.1, Math.sin(ra)*SPLASH_R*1.1); burstG.strokePath();
            }
            this.tweens.add({ targets: burstG, scaleX: 2.0, scaleY: 2.0, alpha: 0, duration: 350, ease: 'Quad.easeOut', onComplete: () => burstG.destroy() });

            // AoE damage + heal on every enemy in radius
            for (const enemy of [...this.enemies]) {
                if (!enemy.sprite?.active) continue;
                if (enemy.fireImmune || enemy.elementImmune) continue;
                const edx = enemy.sprite.x - ix, edy = enemy.sprite.y - iy;
                if (edx*edx + edy*edy > SPLASH_R*SPLASH_R) continue;
                if (enemy.isFrozen) {
                    this._triggerShatterBurst(enemy, 1 / 7.5);
                } else if (!enemy.iceImmune) {
                    if (this._phasedOut(enemy)) continue;   // phased out: not in the world
                    const _rd2831 = this.resolveElementalHit(enemy, HEAL_SHARD_DMG, 'ice');
                    if (_rd2831 === null) continue;
                    enemy.health -= _rd2831;
                    this.showDamageNumber(enemy.sprite.x, enemy.sprite.y - 10, Math.round(_rd2831), '#44ffaa');
                    this.updateEnemyHealthBar(enemy);
                    if (enemy.health <= 0) { this.killEnemy(enemy); continue; }
                    // 1 chill stack from splash
                    this.applyChill(enemy, this._chillCfg().SPLASH);
                }
                // Heal per enemy hit
                this.health = Math.min((this.maxHealth || 100) + 25, this.health + HEAL_ON_HIT);
                if (typeof HUD !== 'undefined') HUD.prototype.updateHUD.call(this);
                const hbG = this.add.graphics().setDepth(5);
                hbG.x = enemy.sprite.x; hbG.y = enemy.sprite.y;
                hbG.fillStyle(0x00ff88, 0.70); hbG.fillCircle(0, 0, 10);
                hbG.fillStyle(0xffffff, 0.85); hbG.fillCircle(0, 0, 4);
                this.tweens.add({ targets: hbG, scaleX: 2.2, scaleY: 2.2, alpha: 0, duration: 250, onComplete: () => hbG.destroy() });
            }

            // ── Spawn 6 mini shards in fixed outward directions ───────────────
            const MINI_SPEED  = 190;
            const MINI_DMG    = 0.6 * this.damageScaling;
            const MINI_HEAL   = 1;
            for (let m = 0; m < MINI_COUNT; m++) {
                // Fixed evenly-spaced angles — no randomness so they always spread outward cleanly
                const outAngle = (m / MINI_COUNT) * Math.PI * 2;
                const mvx = Math.cos(outAngle) * MINI_SPEED;
                const mvy = Math.sin(outAngle) * MINI_SPEED;

                // Mini shard visual — small green crystal
                const mc = this.add.container(ix, iy).setDepth(3.2);
                const mg = this.add.graphics();
                mc.add(mg);
                mc.setAngle(outAngle * (180 / Math.PI)); // orient along travel direction
                const mR = 3.0 + Math.random() * 1.2;
                mg.fillStyle(0x007744, 0.90);
                mg.beginPath(); mg.moveTo(0,-mR*2); mg.lineTo(mR,0); mg.lineTo(0,mR*2); mg.closePath(); mg.fillPath();
                mg.fillStyle(0x00cc66, 1.0);
                mg.beginPath(); mg.moveTo(0,-mR*2); mg.lineTo(mR,0); mg.lineTo(0,mR*2); mg.lineTo(-mR,0); mg.closePath(); mg.fillPath();
                mg.fillStyle(0x55ffbb, 0.75);
                mg.beginPath(); mg.moveTo(0,-mR*2); mg.lineTo(-mR,0); mg.lineTo(0,mR*2); mg.closePath(); mg.fillPath();
                mg.fillStyle(0xffffff, 0.85); mg.fillCircle(-mR*0.25, -mR*0.55, mR*0.22);
                mg.lineStyle(0.8, 0x88ffcc, 0.85);
                mg.beginPath(); mg.moveTo(0,-mR*2); mg.lineTo(mR,0); mg.lineTo(0,mR*2); mg.lineTo(-mR,0); mg.closePath(); mg.strokePath();

                const miniShardObj = {
                    sprite: mc, vx: mvx, vy: mvy,
                    damage: MINI_DMG,
                    startX: ix, startY: iy,
                    createdAt: this.time.now,
                    isCannonShard: true,
                    isMiniHealShard: true,  // fixed direction, no homing, consumed on first hit
                    isHoming: false,
                    _healAmount: MINI_HEAL,
                    rotSpeed: (Math.random() > 0.5 ? 1 : -1) * (3.0 + Math.random() * 2.0),
                    hitEnemies: new Set(),
                    piercedEnemies: new Set(),
                    bounces: 0,
                    maxBounces: 0,
                    isPiercing: false,
                };
                this.iceShards.push(miniShardObj);
            }
        };

        // Store onImpact so updateIceShards can call it on wall hit
        const shardObj = {
            sprite: container, vx, vy,
            damage: HEAL_SHARD_DMG,
            startX: ox, startY: oy,
            createdAt: this.time.now,
            isHealShard: true,
            isCannonShard: true,
            isHoming: true,
            rotSpeed: (Math.random() > 0.5 ? 1 : -1) * (1.2 + Math.random() * 0.8),
            hitEnemies: new Set(),
            piercedEnemies: new Set(),
            _onImpact: onImpact,
            _onHit: (enemy) => {
                if (!container.active) return;
                onImpact(enemy.sprite.x, enemy.sprite.y);
            }
        };
        this.iceShards.push(shardObj);
    }

    // ── Accuracy circle — drawn each frame while icicle cannon is equipped ────
    // The Icicle Cannon had an aiming circle; the shotgun rework dropped it. Clears a leftover.
    _updateIcicleAccuracyCircle() {
        if (this._icicleAccuracyCircle) { this._icicleAccuracyCircle.destroy(); this._icicleAccuracyCircle = null; }
    }

    _updateIcicleChargeBar() {
        if (typeof HUD !== 'undefined' && typeof HUD.prototype.updateIcicleChargeBar === 'function') {
            HUD.prototype.updateIcicleChargeBar.call(this);
        }
    }


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
        const MAX_TILES = 4 + WeaponLevels.perk('flame_sword', 'arc');   // the 3-tile arc in front + the tile beyond its middle (ring order, below)
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
        for (const r of [1.0, 1.85]) {
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

        // ── Arc sweep visual ───────────────────────────────────────────────
        // A crescent of flame that chases the blade's edge: a white-hot leading edge, banded
        // yellow, orange and ember red behind it, thinning toward its tail, embers off the tip.
        const T = this.TILE_SIZE, rOut = 2.3 * T, rIn0 = 0.62 * T;
        const arcGfx = this.add.graphics().setDepth(3).setPosition(playerPx, playerPy);
        const SWING_DURATION = 170;
        const startAngle = facingAngle + halfSpread, endAngle = facingAngle - halfSpread, sweep = endAngle - startAngle;
        const BANDS = [[0xfffbe8, 1], [0xffe680, 0.95], [0xffb838, 0.9], [0xff8a1e, 0.82], [0xf2661a, 0.7], [0xd84a14, 0.58], [0xb0320e, 0.45], [0x84200a, 0.32], [0x5a1406, 0.2]];
        const band = (a0, a1, rIn, col, al) => {
            arcGfx.fillStyle(col, al).beginPath();
            arcGfx.arc(0, 0, rOut, a0, a1, a1 < a0); arcGfx.arc(0, 0, rIn, a1, a0, a0 < a1);
            arcGfx.closePath(); arcGfx.fillPath();
        };
        const draw = (t) => {
            const lead = startAngle + sweep * t, step = Math.abs(sweep) / 10 * Math.sign(sweep);
            arcGfx.clear();
            for (let i = BANDS.length - 1; i >= 0; i--) {
                const a0 = lead - step * (i + 1), a1 = lead - step * i;
                if ((a1 - startAngle) * Math.sign(sweep) <= 0) continue;   // not yet swept
                const from = (a0 - startAngle) * Math.sign(sweep) < 0 ? startAngle : a0;
                band(from, a1, rIn0 + (rOut - rIn0) * (i / BANDS.length) * 0.75, BANDS[i][0], BANDS[i][1]);
            }
        };
        this.tweens.addCounter({ from: 0, to: 1, duration: SWING_DURATION, ease: 'Cubic.easeOut',
            onUpdate: tw => {
                const t = tw.getValue(); draw(t);
                const a = startAngle + sweep * t, r = rOut * (0.75 + Math.random() * 0.25);   // embers flung off the edge
                const m = this.add.image(playerPx + Math.cos(a) * r, playerPy + Math.sin(a) * r, 'vfx_dot').setTint(Math.random() < 0.5 ? 0xffd060 : 0xff7a20).setDepth(3.1).setBlendMode(Phaser.BlendModes.ADD);
                const out = a - Math.sign(sweep) * Math.PI / 2;
                this.tweens.add({ targets: m, x: m.x + Math.cos(a) * 14 + Math.cos(out) * 10, y: m.y + Math.sin(a) * 14 + Math.sin(out) * 10 - 6, alpha: 0, scale: 0.4, duration: 300 + Math.random() * 200, onComplete: () => m.destroy() });
            },
            onComplete: () => this.tweens.add({ targets: arcGfx, alpha: 0, duration: 110, onComplete: () => arcGfx.destroy() }) });

        // ── Hit tiles ─────────────────────────────────────────────────────
        const hitEnemies = new Set();
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
            if (this.damageBossAtTile(tx, ty, damage)) {
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
            const container = this.add.container(sx, sy).setDepth(2).setScale(0.5), fireGraphics = this.add.graphics();
            container.add(fireGraphics);
            this.fireballs.push({ sprite: container, fireGraphics, vx: Math.cos(a) * B.SPEED, vy: Math.sin(a) * B.SPEED, dirX: Math.cos(a), dirY: Math.sin(a),
                damage: B.DMG * this.damageScaling, startX: sx, startY: sy, splitCount: 0, piercedEnemies: new Set(hitEnemies), createdAt: currentTime, lastFlameTime: 0,
                _swordBolt: true, _range: B.RANGE });
        }

        this.cameras.main.shake(60, 0.005);
    }

    magmaStaffAttack(targetX, targetY) {
        const currentTime = this.time.now;

        // Tier now comes from the staff's own heat, not from whatever enemy on the map
        // happens to be burning hardest. See _magmaCfg / _addMagmaHeat above.
        const C = this._magmaCfg();
        const tier = this._magmaTier();
        const fireballCount = C.FIREBALLS[tier - 1] + WeaponLevels.perk('magma_staff', 'volley');
        const cooldown = C.COOLDOWN[tier - 1];
        if (currentTime - (this.lastMagmaStaffTime || 0) < cooldown) return;
        this.lastMagmaStaffTime = currentTime;
        this._gearFiredAt = currentTime;   // the held weapon swings now (Creatures.gear)

        const worldX   = targetX + this.cameras.main.scrollX;
        const worldY   = targetY + this.cameras.main.scrollY;
        const playerPx = this._shotX();   // where the slime is drawn (mid-dash it's still on its way)
        const playerPy = this._shotY();
        const dx = worldX - playerPx, dy = worldY - playerPy;
        const dist = Math.sqrt(dx * dx + dy * dy) || 1;
        const baseAngle = Math.atan2(dy, dx);

        // 9.0, up from 4.5. The old value was explicitly lowered "to balance the max-tier
        // 3-per-shot shotgun" -- i.e. the five weak tiers were nerfed to pay for the one
        // strong one, which is why tier 1 sat at 15% of the FREE weapon's dps. The pellets
        // no longer multiply (see below), so the low end no longer has to fund the top.
        const baseDmg = C.BASE_DMG * this.damageScaling;

        // Muzzle flash
        // at the player in the world (it used to be pinned at screen coords and drawn off its own
        // origin, so the grow tween flung it to the bottom right of the screen)
        const muzzle = this.add.graphics().setDepth(4).setPosition(playerPx, playerPy);
        muzzle.fillStyle(0xff8800, 0.8); muzzle.fillCircle(0, 0, 10);
        muzzle.fillStyle(0xffff44, 0.6); muzzle.fillCircle(0, 0, 5);
        this.tweens.add({ targets: muzzle, scaleX: 2.2, scaleY: 2.2, alpha: 0, duration: 180, onComplete: () => muzzle.destroy() });

        // Fire fireballs sequentially with slight random spread.
        // At max tier (6 shots), each shot becomes a tight 3-pellet shotgun burst
        // instead of a single fireball — 6 shots × 3 pellets = 18 total fireballs.
        const SPEED = 210;
        const SHOT_INTERVAL = 90;
        const leavesTrail = tier >= C.TRAIL_TIER;
        // One projectile per shot, always. See the note on BASE_DMG above for why the fan
        // was removed and why the dps curve is unaffected by removing it.
        const PELLETS_PER_SHOT = 1;
        const PELLET_SPREAD = 0;
        const pelletDmg = baseDmg;

        const castId = Math.random().toString(36).slice(2);
        for (let i = 0; i < fireballCount; i++) {
            this.time.delayedCall(i * SHOT_INTERVAL, () => {
                if (this._deathScreenActive) return;
                const spread = 0.12 - (fireballCount - 1) * 0.01;
                const shotAngle = baseAngle + (Math.random() - 0.5) * spread * 2 * Enchants.spread('magma_staff');   // True Aim narrows it

                for (let p = 0; p < PELLETS_PER_SHOT; p++) {
                    // Pellets fan evenly around shotAngle; single-pellet shots are unchanged
                    const pelletOffset = PELLETS_PER_SHOT === 1 ? 0
                        : (p / (PELLETS_PER_SHOT - 1) - 0.5) * PELLET_SPREAD * 2;
                    const angle = shotAngle + pelletOffset;
                    const vx = Math.cos(angle) * SPEED;
                    const vy = Math.sin(angle) * SPEED;

                    const container = this.add.container(playerPx, playerPy);
                    const fireGraphics = this.add.graphics().setDepth(1.5);
                    container.add(fireGraphics);
                    container.setDepth(2);

                    this.fireballs.push({
                        sprite:        container,
                        fireGraphics:  fireGraphics,
                        vx, vy,
                        damage:        pelletDmg,
                        dirX:          Math.cos(angle),
                        dirY:          Math.sin(angle),
                        startX:        playerPx, startY: playerPy,
                        splitCount:    0,
                        piercedEnemies: new Set(),
                        createdAt:     this.time.now,
                        lastFlameTime: this.time.now,
                        isStaffBall:   true,
                        volleyId:      castId,   // one cast's fireballs fall off on one target (_volleyMult)
                        // Whether this shot was fired at or above FOCUS_TIER. Captured at
                        // fire time so a shot in flight keeps the tier it was launched at
                        // rather than reading whatever heat happens to be current on hit.
                        _focus:        tier >= C.FOCUS_TIER,
                        leavesTrail,
                        _burnApplied:  new Set(),
                    });
                }
            });
        }

        this.cameras.main.shake(30 + fireballCount * 5, 0.002);
    }

    // ── FIRE vs WATER ────────────────────────────────────────────────────────
    // Evaporation power per hit, against a tile with 6 HP. These are deliberately NOT
    // uniform: what the player feels is tiles-cleared-per-second, which is power x tiles
    // covered per shot x cadence, and those three differ enormously between the four fire
    // weapons. Costed per-hit alone, the free Flame Fists would clear faster than the
    // 500-glorp machine gun.
    //
    //   Flame Fists  6 -> one-shot, but a single tile per 600ms   =  1.7 tiles/sec
    //   Flame Sword  3 -> two swings, but SIX tiles at a time     =  4.0 tiles/sec
    //   Magma ball   6 -> one-shot, five fireballs a cast         =  5.3 tiles/sec
    //   Ignition     6 -> one-shot, 11.5 pellets a second         = 11.5 tiles/sec
    //
    // Ignition ends up clearly first, which is right: hosing a floor is what a machine
    // gun should be good at, and it is the only fire weapon with no area coverage at all
    // to fall back on.
    _evaporate(tx, ty, power) {
        if (typeof this.evaporateWater === 'function') this.evaporateWater(tx, ty, power);
    }

    // ═══ IGNITION ════════════════════════════════════════════════════════
    // A weapon that deals no damage on contact. Every hit STORES its payload on the
    // target as kindling and starts a fuse; when the fuse runs out the whole accumulation
    // detonates at once, scaled by how many times you managed to hit that one enemy.
    //
    // Built on triggerCombustion, which until now had exactly ONE live call site in the
    // entire codebase -- inside the fire ult. The burst, the lava ring, the fire-elemental
    // and ice-elemental handling and the COMBUSTION! readout were all already written and
    // unreachable from any weapon. This gives that system a reason to exist.
    //
    // WHY THERE IS NO DETONATE KEY: hitting a DIFFERENT enemy cashes out the current mark
    // immediately. Walking your aim off the target is the early detonate. That enforces
    // the single-target discipline through the normal act of aiming instead of through a
    // keybind, and it means spreading your fire is self-punishing -- you keep collecting
    // small payouts instead of one large one.
    _kindlingCfg() {
        return {
            COOLDOWN:   130,    // machine-gun cadence, ~7.7 pellets/sec
            // 0.1. A full 60-pellet cycle chips 6 damage against a ~333 detonation — under
            // 2% of the weapon's output. The point is not just that the gun is weak: at
            // 0.4 a full cycle chipped 24, which is enough to kill a 32 HP queen minion
            // outright and throw away the entire bank you had built on it. At 0.1 nothing
            // dies to the pellets, so the detonation always gets to happen.
            PELLET_DMG: 0.1,
            // What a pellet does once the bar is ALREADY FULL. The bar filling no longer
            // detonates -- it opens a window that lasts until the fuse expires, and in
            // that window the gun itself finally bites. This exists because capping early
            // used to just skip the rest of the fuse, so the reward for filling fast was
            // a shorter fight rather than a better one; now filling fast buys you a LONGER
            // window, and how long you have is decided by how well you shot.
            //
            // 5, not the 3 that first looked right: the window costs ~2.8s of waiting for
            // the same detonation, so anything under 5 is a straight dps loss versus just
            // capping and moving on. At 5 the cycle comes out level with the old one and
            // the gradient does the interesting work.
            FULL_DMG:   3,      // a pellet into a full (overkindled) mark (5 before pellets could apply Burn)
            BURN_CHANCE: 0.12,  // a pellet's chance to apply a Burn stack: Ignition feeds fire's burn, and the detonation cashes it in
            BURST:      12,     // pellets in a burst
            BURST_GAP:  25,     // ms between pellets inside a burst -- very fast
            BURST_CHANCE: 0.10 + 0.05 * WeaponLevels.perk('ignition', 'burst'), // every shot rolls for a free burst
            // 10 tiles, not 5. Five was inherited from when this was a short-range brand
            // and never revisited: it left the T4 machine gun reaching barely further than
            // the Flame Sword's 2.6-tile arc while the T3 Magma Staff throws fireballs 15
            // tiles. Ten keeps a real difference from the staff -- the staff is slow
            // artillery with the longer reach, this is a fast stream with less of it --
            // without the gun being outranged by melee.
            // Effectively unlimited: walls stop pellets, so this is only a backstop so a
            // round that escapes the map cannot live forever. No room is 40 tiles across.
            RANGE:      40,     // tiles
            SPEED:      720,    // px/sec
            PELLET_R:   4,      // collision radius, px -- deliberately small
            // Half-angle of the cone, in radians. 0.07 is ~4deg — at the far end of
            // range that is about two thirds of a tile of drift, enough that a long shot
            // can genuinely miss; up close it is a few pixels and you will not notice it.
            // At the old 0.045 the widest possible deviation was still inside the 14px
            // collision reach at any normal distance, so the spread could never actually
            // cause a miss: it was jitter you could not see doing nothing you could feel.
            SPREAD:     0.07,
            // EXP alone sets how much focus is worth: a pellet at the cap is worth
            // (MAX_HITS/10)^(EXP-1) times one at ten hits, so 1.8 over a 60 cap makes late
            // pellets ~4.2x early ones. STORE only scales the whole curve, so the two
            // dials stay independent -- EXP for the shape, STORE for the ceiling.
            // 0.48. STORE has moved every time the burst has, and always for the same
            // reason: the payout is collected when the bar CAPS, so anything that changes
            // how fast pellets land changes dps without touching a damage number. A 10%
            // chance of 8 pellets works out to ~11.5 pellets/sec against 7.7 baseline, so
            // the cap arrives in ~2.6s instead of ~3.8s. The ceiling is what is being held
            // steady across these changes, not this constant.
            STORE:      3.0,    // (0.42 over the old 60-pellet bar: rescaled so a full 20-tick bar pays what 60 pellets did)
            STORE_OLD:  0.42,   // (0.45 before RAMP_DMG moved ~6% of a full mark's payout into the pellets)
            RAMP_DMG:   0.9,    // past RAMP_FROM of the bar a pellet chips up to this much more, rising to the cap: the gun isn't dead while it builds
            RAMP_FROM:  0.3,   // payload banked per pellet, before the exponent (0.21: level with the T3 staff)
            EXP:        1.8,    // see _kindlingPayout -- the whole design lives here
            // 60, doubled. The bar is the commitment: at ~11.5 pellets/sec that is over
            // five seconds of unbroken fire on ONE target to fill, and the payout only
            // reaches its interesting range in the back half of that. Thirty filled too
            // quickly for the exponent to ever really bite.
            MAX_HITS:   20,   // jet ticks to fill (20 x TICK = 4.5s; Blue Flame 3s)   // filling the bar detonates it early, see _brandEnemy 
            // 8s, up from 5. The fuse has to outlast the bar or the cap is unreachable:
            // 60 pellets at the baseline 7.7/sec is 7.8 seconds, so a 5s window would have
            // made the top of the curve literally impossible without burst luck.
            FUSE:       8000,   // (no longer a fuse: kept as the scale the ring's cooling arc is drawn against)
            COOL_DELAY: 2500,   // a mark left unfed this long starts to cool
            COOL_RATE:  3.5,    // ...losing this many ticks of heat a second; cooled to nothing it fizzles
            OVER_MS:    3000,   // overkindled holds while the jet is on it; this long after the jet leaves, it goes off by itself
            CASCADE:    0.25,   // fraction dealt to enemies within CASCADE_R on detonation
            // Under a tile. The detonation is a single-target payoff, so its splash is a
            // courtesy to whatever is pressed right up against the target, not an AoE.
            CASCADE_R:  0.8,    // tiles
            // How many marks can burn at once. Marking a third target detonates the
            // OLDEST rather than refusing the mark, so the limit never blocks you -- it
            // just decides for you which bank cashes out. Two is enough to let you work a
            // pair, and few enough that you cannot quietly seed a whole room and collect
            // later, which would turn a single-target weapon into an area one.
            MAX_MARKS:  2,
            JET_EVAP:   2,      // the flame dries water: this much of a tile's 6 HP a tick (3 ticks, ~0.7s, a tile)
            FUEL_MS:    9000,   // a full tank: this long lit (a fill plus the second ring fits with room to spare)
            REFUEL_MS:  4000,   // empty to full while it's out
            DRY_MS:     1500,   // run dry and it can't relight for this long
            DET_PCT:    0.06,   // a full bar's detonation also takes 6% of the target's max HP (x the overheat: up to 24%); less on a full bar
            DET_BOSS:   0.25,   // story bosses take a quarter of that share
            IGNITE_DUR: 5000 + 1000 * WeaponLevels.perk('ignition', 'burst'),   // Blue Flame (R): this long (Long Flame: +1s a level)
            // ── THE FLAMETHROWER (2026-10-20: it was a machine gun) ── a fan of fire JET_R tiles long, JET_ARC radians either side
            // of your aim, stopped by walls. A tick every TICK (Blue Flame: BLUE_TICK): the MARK_N closest enemies in the flame are
            // its marks (existing marks first) and fill a tick of kindling, taking CHIP (+CHIP_RAMP as they fill; MELT once
            // overkindled); every enemy in it rolls JET_BURN for a burn stack, the overkindled excepted. Blue Flame ignores resistance.
            // (TICK_PCT: every tick on a mark also takes this share of its max HP)
            STORE_MAX: 0.4,   // overkindled and still fed, a second ring fills, up to this share of a bar: the mark starts there again once detonated
            MELT_PCT: 0.002, OVER_BURN: 0.5,   // an overkindled tick: MELT + this share of max HP (instead of TICK_PCT), and this burn chance (instead of JET_BURN)
            JET_R: 7.2 + 0.8 * WeaponLevels.perk('ignition', 'reach'), JET_ARC: 0.62 * (1 + 0.15 * WeaponLevels.perk('ignition', 'spray')), TICK_PCT: 0.001, TICK: 225, BLUE_TICK: 150, MARK_N: 2, CHIP: 1.6, CHIP_RAMP: 2.4, MELT: 20,
            JET_BURN: 0.12 + 0.04 * WeaponLevels.perk('ignition', 'mix'), BLUE_BURN: 0.05,   // perks: Long Nozzle, Wide Spray, Hot Mix
            PASS:       0.8,    // a mark whose target dies hands this share of its heat to the nearest enemy...
            PASS_R:     5,      // ...within this many tiles (in waves the target often died first and the bank was lost)
            IGNITE_COOL: 16000,
        };
    }

    // Total payout for h hits. Superlinear but bounded: the multiplier climbs with hit
    // count so a long uninterrupted focus is worth disproportionately more than the same
    // hits split across two enemies, while MAX_HITS stops an attack-speed buff from
    // turning it into an arbitrarily large number.
    // STORE * h^1.6, capped at MAX_HITS. The exponent is the entire weapon.
    //
    // At 1.6 the payout is superlinear in hit count, so the value of a pellet depends on
    // how many of its neighbours landed on the SAME enemy: around 2 damage per pellet at
    // five hits, around 7 at thirty. Early kindling is deliberately close to worthless --
    // stopping at five hits pays less than the pellets themselves did -- and the weapon
    // only becomes a weapon once you have stayed on one target long enough to earn the
    // curve's steep end.
    //
    // It is also what makes spreading fire legal but bad. Thirty pellets in one enemy pay
    // roughly 1.5x what fifteen-and-fifteen pay and over 2x what three lots of ten pay,
    // so you CAN work a crowd, you just always earn less for the same trigger time.
    _kindlingPayout(hits) {
        const C = this._kindlingCfg();
        const h = Math.min(hits, C.MAX_HITS);
        if (h <= 0) return 0;
        return C.STORE * Math.pow(h, C.EXP) * (this.damageScaling || 1);
    }

    // ── BRANDABLE TARGETS ────────────────────────────────────────────────────
    // Bosses are not in this.enemies and do not share its shape: they carry container/hp
    // where an enemy carries sprite/health, which is why pellets flew straight through
    // them. Portals (Queen Slimes) are a third shape again. These three helpers are the
    // only places that difference is allowed to exist; everything else in the kindle
    // system treats a target as a target.
    _kindleBrandables() {
        const out = (this.enemies || []).slice();
        if (this.voltslimeBoss?.active)     out.push(this.voltslimeBoss);
        if (this.voidSovereignBoss?.active) out.push(this.voidSovereignBoss);
        for (const p of (this.portals || [])) if (p.active) out.push(p);
        return out;
    }

    _kindlePos(o) {
        if (o?.sprite?.active) return { x: o.sprite.x, y: o.sprite.y };
        if (o?.container)      return { x: o.container.x, y: o.container.y };
        if (o?.tileX !== undefined) {
            const TS = this.TILE_SIZE;
            return { x: o.tileX * TS + TS / 2, y: o.tileY * TS + TS / 2 + (o.hitOffY || 0) };
        }
        return null;
    }

    _kindleAlive(o) {
        if (!o) return false;
        if (o === this.voltslimeBoss || o === this.voidSovereignBoss)
            return !!o.active && o.hp > 0;
        if ((this.portals || []).includes(o)) return !!o.active && o.hp > 0;
        return !!o.sprite?.active && o.health > 0 && (this.enemies || []).includes(o);
    }

    // Routes a payout to whichever damage entry point the target actually uses.
    _kindleDamage(o, amount) {
        if (o === this.voltslimeBoss)     { this.damageVoltslimeBoss(amount); return; }
        if (o === this.voidSovereignBoss) { this.damageVoidSovereignBoss(amount); return; }
        if ((this.portals || []).includes(o)) { this.damagePortal(o, amount); return; }
        this.damageEnemy(o, amount, 'fire');
    }

    // The flamethrower: a tick of fire into the fan in front of you (see the JET_ keys in _kindlingCfg)
    kindlingBrandAttack(targetX, targetY) {
        const C = this._kindlingCfg(), now = this.time.now, blue = (this._kindleIgniteUntil || 0) > now;
        if (now - (this._lastKindleTime || 0) < (blue ? C.BLUE_TICK : C.TICK)) return;
        this._lastKindleTime = now;
        this._gearFiredAt = now;   // the held weapon swings now (Creatures.gear)
        const T = this.TILE_SIZE, cam = this.cameras.main, tip = typeof CreatureFX !== 'undefined' ? CreatureFX.gearTip?.(this) : null;   // from the gun's muzzle
        const px = tip?.x ?? this.player.x, py = tip?.y ?? this.player.y - 6;
        const ang = Math.atan2(targetY + cam.scrollY - py, targetX + cam.scrollX - px), R = C.JET_R * T;
        this._jetFx(px, py, ang, blue);
        const clear = (x1, y1) => { const n = Math.ceil(Math.hypot(x1 - px, y1 - py) / (T / 2)); for (let k = 1; k < n; k++) { const x = px + (x1 - px) * k / n, y = py + (y1 - py) * k / n; if (this.world?.[Math.floor(x / T)]?.[Math.floor(y / T)] !== this.FLOOR) return false; } return true; };
        const inFan = [];
        for (const o of this._kindleBrandables()) {
            if (!this._kindleAlive(o)) continue;
            const p = this._kindlePos(o); if (!p) continue;
            const d = Math.hypot(p.x - px, p.y - py), big = o === this.voltslimeBoss || o === this.voidSovereignBoss ? T * 1.5 : 0;
            if (d > R + big || Math.abs(Phaser.Math.Angle.Wrap(Math.atan2(p.y - py, p.x - px) - ang)) > C.JET_ARC + (d < T ? 0.6 : 0) || !clear(p.x, p.y)) continue;
            inFan.push({ o, d });
        }
        inFan.sort((a, b) => a.d - b.d);
        // the marks are fixed: MARK_N at most, kept until detonated (G) or cooled out; a third enemy in the flame isn't marked
        const held = [...(this._kindleMarked || [])].filter(o => this._kindleAlive(o) && o._kindleHits > 0);
        const marks = inFan.filter(f => held.includes(f.o)).map(f => f.o);
        let free = C.MARK_N - held.length;
        for (const f of inFan) if (free > 0 && !marks.includes(f.o)) { marks.push(f.o); free--; }
        for (const o of marks) this._brandEnemy(o, blue);
        for (const f of inFan) {   // the whole fan can catch, overkindled marks far more often
            const e = f.o;
            if (!(this.enemies || []).includes(e) || !(e.health > 0)) continue;
            const r = Math.random();
            if (blue && r < C.BLUE_BURN) this.applyBlueBurn?.(e);   // Blue Flame: now and then a blue burn stack
            else if (r < ((e._kindleHits || 0) >= C.MAX_HITS ? C.OVER_BURN : C.JET_BURN)) this.applyBurnStack?.(e, 1);
        }
        const fc = this.fractureCore;   // the Geode in the flame: a hit of fire on the plate facing you (it heats)
        if (fc?.active && fc.geode && !fc._isInvulnerable && fc.container) {
            const d = Math.hypot(fc.container.x - px, fc.container.y - py);
            if (d <= R + T && Math.abs(Phaser.Math.Angle.Wrap(Math.atan2(fc.container.y - py, fc.container.x - px) - ang)) <= C.JET_ARC + 0.3 && now - (fc._jetAt || 0) >= 450) { fc._jetAt = now; this._geodeHit?.((C.CHIP + C.MELT) * (this.damageScaling || 1), 'fire'); }
        }
        if (this.waterTiles?.size) {   // the flame boils the water it covers off to steam: JET_EVAP of a tile's 6 a tick (Blue Flame all of it)
            const r = Math.ceil(C.JET_R), ptx = Math.floor(px / T), pty = Math.floor(py / T);
            for (let x = ptx - r; x <= ptx + r; x++) for (let y = pty - r; y <= pty + r; y++) {
                if (!this.isWaterAt?.(x, y)) continue;
                const cx = x * T + T / 2, cy = y * T + T / 2, d = Math.hypot(cx - px, cy - py);
                if (d > R || (d > T && Math.abs(Phaser.Math.Angle.Wrap(Math.atan2(cy - py, cx - px) - ang)) > C.JET_ARC) || !clear(cx, cy)) continue;
                this._evaporate(x, y, blue ? 6 : C.JET_EVAP);
            }
        }
    }
    // The jet's pixel fire: 5 frames of 10px blobs, each a ragged pixel shape with hard colour bands, burning down from a white
    // core to embers and smoke (blue: Blue Flame's). Played over a particle's life (the anim of the same key).
    static jetPixKey(scene, blue) {
        const key = blue ? 'fx_jetpx_b' : 'fx_jetpx', N = 5, S = 10;
        if (scene.textures.exists(key)) return key;
        const t = scene.textures.createCanvas(key, S * N, S), c = t.getContext(), R = MenuArt.rng(blue ? 717 : 313);
        const PAL = blue ? [['#ffffff', '#d8f0ff', '#8ac8ff'], ['#d8f0ff', '#8ac8ff', '#4a8aff'], ['#8ac8ff', '#4a8aff', '#2a4ad8'], ['#4a8aff', '#2a4ad8', '#141e5a'], ['#3a4058', '#2a2e40', '#1a1c28']]
                          : [['#fffbe0', '#ffe08a', '#ffb040'], ['#ffe08a', '#ffb040', '#ff7a20'], ['#ffb040', '#ff6a1a', '#c8381a'], ['#ff6a1a', '#c8381a', '#5a1a0c'], ['#4a3a32', '#2e2420', '#1a1412']];
        const RAD = [3.2, 4.2, 4.6, 4.2, 4.4];
        for (let f = 0; f < N; f++) {
            const [core, mid, rim] = PAL[f], r0 = RAD[f];
            for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
                const d = Math.hypot(x + 0.5 - S / 2, y + 0.5 - S / 2) + (R() - 0.5) * 1.3;   // ragged edge
                if (d > r0 || (f >= 3 && R() < 0.12 * (f - 2))) continue;   // late frames break up into embers
                c.fillStyle = d < r0 * 0.4 ? core : d < r0 * 0.75 ? mid : rim; c.fillRect(f * S + x, y, 1, 1);
            }
        }
        t.refresh();
        for (let f = 0; f < N; f++) t.add(f, 0, f * S, 0, S, S);
        if (!scene.anims.exists(key)) scene.anims.create({ key, frames: Array.from({ length: N }, (_, f) => ({ key, frame: f })), frameRate: 10, repeat: 0 });
        return key;
    }
    // The jet's look: a CONTINUOUS stream of fire while you hold (the damage ticks underneath, but the flame doesn't pulse
    // with them): a soft body going white-hot to yellow, orange, red and dark at the tip; teardrop tongues licking along it;
    // dark smoke rolling off the end; a glow at the nozzle. Blue Flame swaps to the blue set. One watcher per scene follows
    // your aim every frame and starts and stops the emitters.
    _jetFx(px, py, ang, blue) {
        const C = this._kindlingCfg(), T = this.TILE_SIZE, now = this.time.now;
        this._jetOn = now + (blue ? C.BLUE_TICK : C.TICK) * 1.6; this._jetBlue = blue;
        if (this._jetS?.core?.scene) return;
        const life = 520, v = C.JET_R * T / (life / 1000) / 0.95, ADD = Phaser.BlendModes.ADD;   // (fast enough, and visible long enough, to reach the full JET_R)
        const fire = WeaponSystem.jetPixKey(this, false), blueK = WeaponSystem.jetPixKey(this, true);
        // pixel-art fire: chunky hand-placed blobs that burn down white -> yellow -> orange -> red -> smoke over their life
        const body = key => this.add.particles(0, 0, key, { anim: key, lifespan: { min: life * 0.85, max: life }, speed: { min: v * 0.85, max: v * 1.02 },
            scale: { start: 1.3, end: 2.6 }, alpha: { start: 1, end: 0.35, ease: 'Cubic.easeIn' }, frequency: 12, quantity: 1, emitting: false }).setDepth(4.4);
        const tongues = key => this.add.particles(0, 0, key, { anim: key, lifespan: { min: life * 0.5, max: life * 0.75 }, speed: { min: v * 0.7, max: v * 0.9 },
            scale: { start: 1, end: 1.8 }, alpha: { start: 1, end: 0.5 }, blendMode: ADD, frequency: 30, quantity: 1, emitting: false }).setDepth(4.45);
        const smoke = this.add.particles(0, 0, fire, { frame: 4, lifespan: { min: 700, max: 950 }, speed: { min: v * 0.35, max: v * 0.5 }, scale: { start: 1.6, end: 3 },
            alpha: { start: 0.35, end: 0 }, frequency: 45, quantity: 1, emitting: false, gravityY: -40 }).setDepth(4.3);
        const glow = this.add.image(0, 0, 'vfx_glow').setBlendMode(ADD).setDepth(4.46).setVisible(false);
        const S = this._jetS = { core: body(fire), tong: tongues(fire), coreB: body(blueK), tongB: tongues(blueK), smoke, glow, on: false, blue: false };
        // walls stop the flame like they stop its damage: a blob dies entering a tile that isn't floor (3.60 hands death zones world positions)
        const wall = (wx, wy) => !!this.world && this.world[Math.floor(wx / T)]?.[Math.floor(wy / T)] !== this.FLOOR;
        for (const em of [S.core, S.tong, S.coreB, S.tongB, S.smoke]) em.addDeathZone({ type: 'onEnter', source: { contains: wall } });
        const tick = () => {
            if (!S.core.scene || !this.player?.active) { this.events.off('update', tick); return; }
            const t = this.time.now, on = t < (this._jetOn || 0), b = !!this._jetBlue;
            const cam = this.cameras.main, ap = this._aim ? this._aim(this.input.activePointer) : this.input.activePointer;
            const tip = typeof CreatureFX !== 'undefined' ? CreatureFX.gearTip?.(this) : null, nx0 = tip?.x ?? this.player.x, ny0 = tip?.y ?? this.player.y - 6;   // out of the gun itself
            const ang = Math.atan2(ap.y + cam.scrollY - ny0, ap.x + cam.scrollX - nx0);
            this._jetAng = ang;
            const nx = nx0 + Math.cos(ang) * (tip ? 2 : 12), ny = ny0 + Math.sin(ang) * (tip ? 2 : 12), deg = Phaser.Math.RadToDeg(ang), arc = Phaser.Math.RadToDeg(C.JET_ARC) * 0.8;
            for (const em of [S.core, S.tong, S.coreB, S.tongB, S.smoke]) { em.setPosition(nx, ny); em.ops.angle.loadConfig({ angle: { min: deg - arc, max: deg + arc } }); }   // (3.60: setEmitterAngle didn't take; it sprayed all round)
            if (on !== S.on || b !== S.blue) {
                S.on = on; S.blue = b;
                for (const [em, want] of [[S.core, on && !b], [S.tong, on && !b], [S.coreB, on && b], [S.tongB, on && b], [S.smoke, on]]) want ? em.start() : em.stop();
            }
            S.glow.setVisible(on).setPosition(nx, ny).setTint(b ? 0x7ab8ff : 0xff8a2a).setScale(0.22 + 0.04 * Math.sin(t * 0.05)).setAlpha(0.45 + 0.15 * Math.sin(t * 0.07));
        };
        this.events.on('update', tick); this.events.once('shutdown', () => this.events.off('update', tick));
    }

    // One round. Hitscan with a tracer rather than a travelling projectile: at this fire
    // rate a real bullet would be in flight for less than a frame at close range, and it
    // would need its own update loop and collision pass for no visible difference.
    // One pellet. A REAL projectile now, not a hitscan with a tracer drawn after the
    // fact: it travels, it can miss, and its 4px hitbox means a machine gun at this
    // cadence still rewards aim. Hitscan made the weapon feel like a beam, which is the
    // opposite of what a stream of individual rounds should feel like.
    _fireKindleRound(targetX, targetY) {
        const C = this._kindlingCfg();
        const worldX = targetX + this.cameras.main.scrollX;
        const worldY = targetY + this.cameras.main.scrollY;
        const px = this._shotX();   // where the slime is drawn (mid-dash it's still on its way)
        const py = this._shotY();

        // Triangular, not uniform: averaging two randoms clusters shots near the centre
        // line with the occasional wider one, which is what a real burst looks like.
        // A flat distribution scatters evenly across the cone and reads as the gun being
        // broken rather than as recoil.
        const jitter = ((Math.random() + Math.random()) / 2 - 0.5) * C.SPREAD * 2 * Enchants.spread('ignition');   // True Aim narrows it
        const ang = Math.atan2(worldY - py, worldX - px) + jitter;
        const g = this.add.graphics().setDepth(2.4);
        g.x = px; g.y = py; g.rotation = ang;
        // Drawn once in LOCAL space and rotated, so the bolt always points along travel.
        // Built back-to-front as a flame rather than a cartridge: a long translucent wind
        // streak tapering behind, then the ember body, then a white-hot head. The taper is
        // what sells the speed -- a uniform bar just looks like a stick.
        for (let t = 0; t < 5; t++) {
            const k = t / 4;                       // 0 at the head end of the tail
            const len = 5 + t * 5;                 // each band reaches further back
            const h   = 3.2 * (1 - k * 0.72);      // and is thinner
            g.fillStyle(t < 2 ? 0xff7a1e : 0xc23a08, 0.30 * (1 - k) + 0.05);
            g.fillRoundedRect(-len, -h / 2, len - (t ? 5 + (t - 1) * 5 : 0) + 5, h, h / 2);
        }
        g.fillStyle(0xff4d0a, 0.85); g.fillRoundedRect(-7, -2.6, 12, 5.2, 2.6);   // outer flame
        g.fillStyle(0xff9c2b, 0.98); g.fillRoundedRect(-4, -1.9, 9.5, 3.8, 1.9);  // body
        g.fillStyle(0xffe6a0, 1);    g.fillRoundedRect(1, -1.25, 5.5, 2.5, 1.25); // hot core
        g.fillStyle(0xfff6e0, 1);    g.fillCircle(5.8, 0, 1.5);                   // head

        if (!this._kindleBullets) this._kindleBullets = [];
        const glow = this.textures.exists('vfx_glow') ? this.add.image(px, py, 'vfx_glow').setTint(0xff7a1e).setBlendMode(Phaser.BlendModes.ADD).setDepth(2.35).setScale(0.22, 0.12).setRotation(ang) : null;   // its heat haze
        g.setBlendMode(Phaser.BlendModes.ADD);
        this._kindleBullets.push({
            g, glow, x: px, y: py,
            vx: Math.cos(ang) * C.SPEED, vy: Math.sin(ang) * C.SPEED,
            life: (C.RANGE * this.TILE_SIZE) / C.SPEED * 1000,
        });
        this._kindleMuzzle(px, py, ang);
    }

    // Per-frame flight, collision and expiry for the pellets.
    _updateKindleBullets(time, delta) {
        const list = this._kindleBullets;
        if (!list || !list.length) return;
        const C = this._kindlingCfg();
        const dt = Math.min(delta || 16, 50) / 1000;
        const TS = this.TILE_SIZE;

        for (let i = list.length - 1; i >= 0; i--) {
            const b = list[i];
            // Keep where it WAS. At 900px/s a pellet covers ~15px per frame, which is
            // wider than its own 4px hitbox — a point test at the new position would let
            // it tunnel straight through an enemy between two frames. Collision below is
            // swept along the segment it actually travelled.
            const px0 = b.x, py0 = b.y;
            b.x += b.vx * dt; b.y += b.vy * dt;
            b.life -= dt * 1000;
            if (b.g?.active) { b.g.x = b.x; b.g.y = b.y; b.g.scaleY = 0.85 + Math.random() * 0.35; }   // the tracer flickers
            if (b.glow?.active) b.glow.setPosition(b.x - b.vx * 0.008, b.y - b.vy * 0.008);

            // Sheds embers as it flies. Throttled per bullet rather than per frame: at
            // 7.7 rounds a second with three in the air, one graphic per frame each would
            // be ~180 objects a second for a decorative effect.
            b.trail = (b.trail || 0) + dt * 1000;
            if (b.trail >= 55) {
                b.trail = 0;
                const em = this.add.graphics().setDepth(2.2);
                em.x = px0; em.y = py0;
                em.fillStyle(Math.random() < 0.4 ? 0xffd27a : 0xff6a1e, 0.55);
                em.fillCircle(0, 0, 1.6 + Math.random() * 1.2);
                this.tweens.add({
                    targets: em, alpha: 0,
                    x: px0 - b.vx * 0.06 + (Math.random() - 0.5) * 6,
                    y: py0 - b.vy * 0.06 + (Math.random() - 0.5) * 6,
                    scaleX: 0.3, scaleY: 0.3, duration: 220 + Math.random() * 160,
                    ease: 'Quad.easeOut', onComplete: () => em.destroy()
                });
            }

            let gone = b.life <= 0;
            // Walls stop pellets. Checked before enemies so you cannot shoot through one.
            if (!gone) {
                const tx = Math.floor(b.x / TS), ty = Math.floor(b.y / TS);
                // A room you have not entered stops a pellet exactly like a wall -- the
                // same isInLockedRoom test every other projectile uses. This has to run
                // BEFORE _evaporate: previously the pellet dried the tile it was stopped
                // on, so Ignition boiled water out of sealed rooms through the doorway.
                const blocked = !this.world?.[tx] || this.world[tx][ty] !== this.FLOOR
                                || this.isInLockedRoom(tx, ty);
                if (blocked) { gone = true; VisualFX.wallImpact(this, b.x, b.y, 'fire', b.vx, b.vy); }
                else this._evaporate(tx, ty, 6);         // one-shots a puddle, 11.5 a second
            }
            if (!gone) {
                for (const e of this._kindleBrandables()) {
                    if (!this._kindleAlive(e)) continue;
                    // A pellet cannot reach into a room you have not opened. damageEnemy
                    // already refuses the damage, but BRANDING does not go through it --
                    // so without this a pellet still stacked kindle on a sealed room and
                    // the mark detonated the instant you walked in.
                    if (typeof this._roomGated === 'function' && this._roomGated()
                        && e.tutorialRoomIndex !== undefined
                        && e.tutorialRoomIndex !== this.getCurrentPlayerRoom()) continue;
                    const p = this._kindlePos(e);
                    if (!p) continue;
                    // Bosses are physically huge, so they get a proportionally larger
                    // catch radius -- a 4px pellet against a 5x-scale slime should not
                    // have to thread its exact centre.
                    const big = (e === this.voltslimeBoss || e === this.voidSovereignBoss);
                    const reach = C.PELLET_R + (big ? 46 : (e.hitR ? e.hitR : 10));
                    // Swept, not point: distance from the target to the segment this
                    // pellet crossed this frame. See the note on px0/py0 above.
                    const d = (typeof Utils !== 'undefined' && Utils.distancePointToSegment)
                        ? Utils.distancePointToSegment(p.x, p.y, px0, py0, b.x, b.y)
                        : Math.hypot(p.x - b.x, p.y - b.y);
                    if (d > reach) continue;
                    // NO detonate-on-switch. It ran BEFORE _brandEnemy, so touching a
                    // second enemy popped the first mark instantly and the two-mark board
                    // could never actually fill -- and because it was gated on 8+ pellets
                    // it only did that SOMETIMES, which is what made the behaviour look
                    // random. Displacement is the manual trigger now: hold two marks, tag
                    // a third target to cash out the oldest. Same control, and it is the
                    // rule that was supposed to own this.
                    this._brandEnemy(e);
                    this._kindleSpark(b.x, b.y);
                    gone = true;
                    break;
                }
            }
            if (gone) {
                if (b.g?.active) { this.tweens.killTweensOf(b.g); b.g.destroy(); }
                b.glow?.destroy();
                list.splice(i, 1);
            }
        }
    }

    // The shot leaving the barrel (the gun's own tip where it's drawn): a four-point flash, a puff of smoke, and now and
    // then a spent casing spun out the side.
    _kindleMuzzle(px, py, ang) {
        const tip = typeof CreatureFX !== 'undefined' ? CreatureFX.gearTip?.(this) : null, x = tip?.x ?? px + Math.cos(ang) * 10, y = tip?.y ?? py + Math.sin(ang) * 10, ADD = Phaser.BlendModes.ADD;
        const m = this.add.graphics().setDepth(2.5).setBlendMode(ADD).setPosition(x, y).setRotation(ang);
        m.fillStyle(0xff8a2a, 0.9); m.fillTriangle(0, -3, 0, 3, 14, 0); m.fillTriangle(-3, 0, 3, 0, 0, -7); m.fillTriangle(-3, 0, 3, 0, 0, 7);
        m.fillStyle(0xfff0c0, 1); m.fillTriangle(0, -1.5, 0, 1.5, 9, 0); m.fillCircle(0, 0, 2.4);
        this.tweens.add({ targets: m, alpha: 0, scaleX: 1.4, scaleY: 0.6, duration: 70, onComplete: () => m.destroy() });
        if (Math.random() < 0.4) { const sm = this.add.circle(x, y, 2.5, 0x3a302a, 0.35).setDepth(2.45); this.tweens.add({ targets: sm, x: x + Math.cos(ang) * 6, y: y - 8, scale: 2.2, alpha: 0, duration: 420, onComplete: () => sm.destroy() }); }
        if (Math.random() < 0.3) {   // a casing, kicked out to the side and bouncing
            const side = ang + Math.PI / 2 * (Math.cos(ang) >= 0 ? -1 : 1), c = this.add.rectangle(px, py, 3, 1.5, 0xd8a84a).setDepth(2.4);
            this.tweens.add({ targets: c, x: px + Math.cos(side) * 12, y: py + Math.sin(side) * 6 - 6, angle: 540, duration: 260, ease: 'Quad.easeOut', onComplete: () => this.tweens.add({ targets: c, y: c.y + 10, alpha: 0, duration: 260, ease: 'Bounce.easeOut', onComplete: () => c.destroy() }) });
        }
    }

    _kindleSpark(x, y) {
        VisualFX.impact(this, x, y, 'fire', 7);
        const r = this.add.circle(x, y, 3, 0, 0).setStrokeStyle(1.5, 0xffb040, 0.9).setDepth(3.4).setBlendMode(Phaser.BlendModes.ADD);
        this.tweens.add({ targets: r, scale: 3, alpha: 0, duration: 160, onComplete: () => r.destroy() });
    }

    _brandEnemy(enemy, blue = false) {
        const C = this._kindlingCfg();
        const p = this._kindlePos(enemy);
        if (!p) return;
        if (enemy.iceImmune) {
            this.showStatusText(p.x, p.y - 10, 'IMMUNE', '#88eeff');
            return;
        }
        if (!enemy._kindleHits) {
            // A NEW mark, only into a free slot: a full board stays as it is (G detonates to free it)
            if ([...(this._kindleMarked || [])].filter(o => o !== enemy && this._kindleAlive(o) && o._kindleHits > 0).length >= C.MAX_MARKS) return;
            enemy._kindleHits = 0;
            enemy._kindleUntil = 0;   // no fuse: it holds while you feed it (see _updateKindling)
        }
        const wasFull = enemy._kindleHits >= C.MAX_HITS;
        enemy._kindleHits = Math.min(C.MAX_HITS, enemy._kindleHits + 1);
        const isFull = enemy._kindleHits >= C.MAX_HITS;
        if (wasFull) {   // overkindled and still in the flame: the second ring fills a tick, up to STORE_MAX of a bar
            const cap = Math.round(C.MAX_HITS * C.STORE_MAX), was = enemy._kindleStore || 0, fp = this._kindlePos(enemy);
            enemy._kindleStore = Math.min(cap, was + 1);
            if (fp && enemy._kindleStore === cap && was < cap) this.showStatusText(fp.x, fp.y - 46, `STORED ${Math.round(C.STORE_MAX * 100)}%`, '#9fe4ff');
        }
        enemy._kindleFedAt = this.time.now;
        if (isFull && !wasFull) enemy._kindleUntil = this.time.now + C.OVER_MS;   // the overkindled window opens
        // Announced once, on the pellet that tops it off, so the window has a start you
        // can see rather than a number you have to be watching.
        if (isFull && !wasFull) {
            const fp = this._kindlePos(enemy);
            if (fp) this.showStatusText(fp.x, fp.y - 46, 'OVERKINDLED', '#9fe4ff');
        }
        // Tracked separately from this.enemies. killEnemy SPLICES a dead enemy out of that
        // array, so a marked enemy that dies simply stops being iterated and its meter is
        // never destroyed -- the bar was left hanging in the air. This set still holds it
        // afterwards, so the sweep below can clean up.
        (this._kindleMarked || (this._kindleMarked = new Set())).add(enemy);
        this._kindleTarget = enemy;
        // The pellet itself stings. Small on purpose -- 2.5 against a 30-pellet payout of
        // ~160 means the gun is worth about a third of the detonation it sets up, so it
        // stays a marker rather than becoming a DPS weapon you never bother detonating.
        // Routed through damageEnemy so ElementResist still gets a say.
        // Chip while filling, real damage once full.
        // the jet on a mark: chip that grows as it fills, then it melts once overkindled. Blue Flame ignores resistance.
        const amt = (isFull ? C.MELT : C.CHIP + C.CHIP_RAMP * enemy._kindleHits / C.MAX_HITS) * (this.damageScaling || 1) + (isFull ? C.MELT_PCT : C.TICK_PCT) * (enemy.maxHealth || enemy.maxHp || 0);   // + a share of max HP every tick (more once overkindled)
        if (blue && enemy.sprite?.active && (this.enemies || []).includes(enemy)) {
            const d = this._afterHit(enemy, 'fire', amt * this._dmgOutMult(enemy, 'fire') * this._hitRoll(enemy, 'fire'));
            enemy.health -= d; this.showDamageNumber(enemy.sprite.x, enemy.sprite.y - 10, d, '#bfe8ff'); this.updateEnemyHealthBar(enemy);
            if (enemy.health <= 0) this.killEnemy(enemy);
        } else this._kindleDamage(enemy, amt);
        this.gainUltCharge(this.ultChargePerHit * 0.5, 'fire');
        this._updateKindleIndicator(enemy);
        // NO detonate-on-cap. A full bar is a STATE, not an event: it holds until the fuse
        // runs out, and the leftover time is the reward rather than something to skip.
    }

    // Fuse check. Runs per frame from the scene update; also sweeps enemies that died or
    // were removed while marked so the banked payload does not follow a corpse around.
    _updateKindling(time, delta) {
        this._updateKindleBullets(time, delta);
        // Iterates the MARKED set, not this.enemies -- see the note in _brandEnemy.
        const marked = this._kindleMarked;
        if (!marked || !marked.size) return;
        for (const e of [...marked]) {
            if (!e || !e._kindleHits) { marked.delete(e); this._clearKindle(e); continue; }
            if (!this._kindleAlive(e)) { const h = e._kindleHits, at = e._kindleLastPos; marked.delete(e); this._clearKindle(e); this._kindlePassOn?.(h, at, e); continue; }
            e._kindleLastPos = this._kindlePos(e);
            // The meter is drawn once per HIT, but the target keeps moving between hits --
            // without this the bar detaches and hangs in the air where the last pellet
            // landed. Position only; the fill is redrawn on hit.
            if (e._kindleGfx?.active) this._drawKindleMark(e, time);   // its flame ring, alive every frame
            const C = this._kindlingCfg();
            if (e._kindleHits >= C.MAX_HITS) { if (time - (e._kindleFedAt || time) >= C.OVER_MS) this._detonateKindling(e, 'KINDLED'); continue; }   // overkindled holds while the jet's on it; left, it goes off
            // no fuse: left unfed, it cools a few pellets a second (the ring dropping back toward ember), and fizzles at nothing
            if (time - (e._kindleFedAt || time) > C.COOL_DELAY) {
                e._kindleHits = Math.max(0, e._kindleHits - C.COOL_RATE * Math.min(100, delta || 16) / 1000);
                if (e._kindleHits <= 0.5) { const fp = this._kindlePos(e); if (fp) this.showStatusText(fp.x, fp.y - 40, 'fizzled', '#8a6a4a'); marked.delete(e); this._clearKindle(e); }
            }
        }
    }

    // A marked target died with heat still banked: PASS of it jumps to the nearest enemy within PASS_R, as if shot there
    _kindlePassOn(hits, from, dead) {
        const C = this._kindlingCfg(), T = this.TILE_SIZE;
        if (!(hits > 0) || !from) return;
        let to = null, best = C.PASS_R * T;
        for (const o of this._kindleBrandables()) {
            if (o === dead || !this._kindleAlive(o) || o.iceImmune) continue;
            const p = this._kindlePos(o), d = p ? Math.hypot(p.x - from.x, p.y - from.y) : Infinity;
            if (d < best) { best = d; to = o; }
        }
        if (!to) return;
        this._brandEnemy(to);   // makes it a mark (retiring the oldest if the board's full)
        if (!to._kindleHits || !this._kindleAlive(to)) return;   // (that mark's own damage can kill it: its position went null and the crash froze the game)
        const wasFull = to._kindleHits >= C.MAX_HITS;
        to._kindleHits = Math.min(C.MAX_HITS, to._kindleHits + Math.round(hits * C.PASS) - 1);
        if (to._kindleHits >= C.MAX_HITS && !wasFull) to._kindleUntil = this.time.now + C.OVER_MS;
        this._updateKindleIndicator(to);
        const tp = this._kindlePos(to); if (!tp) return;
        const streak = this.add.image(from.x, from.y, 'vfx_glow').setTint(0xff8a2a).setBlendMode(Phaser.BlendModes.ADD).setScale(0.35).setDepth(4.5);
        this.tweens.add({ targets: streak, x: tp.x, y: tp.y, scale: 0.2, duration: 180, ease: 'Quad.easeIn', onComplete: () => streak.destroy() });
        this.showStatusText(tp.x, tp.y - 40, 'HEAT PASSED', '#ffb060');
    }

    // Pellets in flight are per-RUN state, like the heat on the staff. A restart that left
    // them in the array would carry graphics belonging to a destroyed scene.
    _clearKindleBullets() {
        for (const b of (this._kindleBullets || [])) {
            if (b.g?.active) { this.tweens.killTweensOf(b.g); b.g.destroy(); }
            b.glow?.destroy();
        }
        this._kindleBullets = [];
    }

    // how much an overkindled bank has heated past full (1 = just full)
    _kindleOverMult(e) { return 1; }   // (the overheat is gone, the second ring replaced it: kept for its proxies)
    // the detonate key: every kindled mark goes off now
    _kindleDetonateAll() {
        const L = [...(this._kindleMarked || [])].filter(e => this._kindleAlive(e) && (e._kindleHits || 0) >= 1);
        for (const e of L) this._detonateKindling(e, 'DETONATED');
        return L.length;
    }
    _detonateKindling(enemy, label) {
        if (!enemy || !enemy._kindleHits) return;
        const C = this._kindlingCfg();
        const hits = enemy._kindleHits, store = enemy._kindleStore || 0;   // the second ring: what the next kindle starts at
        const payout = this._kindlingPayout(hits);
        // ...plus a share of the target's max HP on the same curve, so it still hits hard on big HP pools (the cascade takes the flat part only)
        const boss = enemy === this.voltslimeBoss || enemy === this.voidSovereignBoss;
        const pct = C.DET_PCT * (boss ? C.DET_BOSS : 1) * (enemy.maxHealth || enemy.maxHp || 0) * Math.pow(Math.min(hits, C.MAX_HITS) / C.MAX_HITS, C.EXP);
        this._clearKindle(enemy);
        const dp = this._kindlePos(enemy);
        if (!dp) return;
        const ex = dp.x, ey = dp.y;
        this.showStatusText(ex, ey - 44, label, '#ffaa33');
        this._kindleBlast(ex, ey, Math.min(1, hits / C.MAX_HITS));

        // Regular enemies go through triggerCombustion, which owns the lava ring, the
        // immunity handling and the COMBUSTION! readout. Bosses and portals have none of
        // that shape, so they take the payload directly with their own burst drawn here.
        if (enemy.sprite?.active && (this.enemies || []).includes(enemy)) {
            this.triggerCombustion(enemy, false, payout + pct);
        } else {
            this._kindleDamage(enemy, payout + pct);
        }

        // Small cascade so a detonation reads as an explosion rather than a hit, without
        // making this a crowd weapon: neighbours take a quarter, and only the marked
        // target ever gets the full accumulation.
        // Cascade covers every brandable, so a detonation next to a boss still splashes
        // it. The old version also paid the boss and any covering portal the FULL payout
        // on top of the main target's -- a detonation on a minion standing on the Queen
        // handed her the entire bank for free.
        const R = C.CASCADE_R * this.TILE_SIZE;
        for (const other of this._kindleBrandables()) {
            if (other === enemy || !this._kindleAlive(other)) continue;
            const op = this._kindlePos(other);
            if (!op || Math.hypot(op.x - ex, op.y - ey) > R) continue;
            this._kindleDamage(other, payout * C.CASCADE);
        }
        this.cameras.main.shake(110, 0.007);
        if (store > 0 && this._kindleAlive(enemy)) {   // the stored ring: still marked, its next kindle already part full
            enemy._kindleHits = store; enemy._kindleFedAt = this.time.now;
            (this._kindleMarked || (this._kindleMarked = new Set())).add(enemy);
            this._updateKindleIndicator(enemy);
        }
    }

    // A click on a kindled enemy (within CLICK_R px of it, generous on purpose) sets its mark off there and then, for
    // whatever it has banked. Only marks past CLICK_MIN hits answer, so a click to start shooting at something you've only
    // just tagged doesn't throw its mark away. True if one went off (the click is spent).
    _kindleClickDetonate(wx, wy) {
        const C = this._kindlingCfg(), CLICK_R = 26, CLICK_MIN = 3;   // (ticks of heat: a tap on something only just caught doesn't throw it away)
        let best = null, bd = Infinity;
        for (const e of this._kindleMarked || []) {
            if (!this._kindleAlive(e) || (e._kindleHits || 0) < CLICK_MIN) continue;
            const p = this._kindlePos(e); if (!p) continue;
            const big = e === this.voltslimeBoss || e === this.voidSovereignBoss, d = Math.hypot(p.x - wx, p.y - wy);
            if (d <= CLICK_R + (big ? 30 : 0) && d < bd) { bd = d; best = e; }
        }
        if (!best) return false;
        this._detonateKindling(best, 'DETONATED');
        return true;
    }

    // A mark going off: a pillar of fire in the colour its heat reached, a shockwave, petals of flame thrown out, smoke
    // rising, a scorch left on the floor. Bigger the fuller it was (t, 0..1).
    _kindleBlast(x, y, t) {
        const ADD = Phaser.BlendModes.ADD, col = this._kindleHeatColor(t), s = 0.7 + 0.8 * t;
        const pil = this.add.rectangle(x, y + 6, 16 * s, 70 * s, col, 0.85).setOrigin(0.5, 1).setDepth(4.6).setBlendMode(ADD);
        this.tweens.add({ targets: pil, scaleX: 2.2, scaleY: 1.3, alpha: 0, duration: 380, ease: 'Quad.easeOut', onComplete: () => pil.destroy() });
        const core = this.add.rectangle(x, y + 6, 6 * s, 56 * s, 0xfff4d8, 1).setOrigin(0.5, 1).setDepth(4.61).setBlendMode(ADD);
        this.tweens.add({ targets: core, scaleX: 0.2, alpha: 0, duration: 260, onComplete: () => core.destroy() });
        const wave = this.add.ellipse(x, y + 8, 20, 9).setStrokeStyle(3, col, 1).setDepth(3.5).setBlendMode(ADD);
        this.tweens.add({ targets: wave, scale: 4 + 3 * t, alpha: 0, duration: 420, ease: 'Quad.easeOut', onComplete: () => wave.destroy() });
        for (let k = 0; k < 10 + Math.round(8 * t); k++) {   // petals of flame
            const a = Math.random() * Math.PI * 2, d = (24 + Math.random() * 24) * s, pt = this.add.ellipse(x, y, 6, 3, k % 3 ? col : 0xffb040).setRotation(a).setDepth(4.5).setBlendMode(ADD);
            this.tweens.add({ targets: pt, x: x + Math.cos(a) * d, y: y + Math.sin(a) * d * 0.6 - 8, scaleX: 0.3, alpha: 0, duration: 380 + Math.random() * 200, ease: 'Quad.easeOut', onComplete: () => pt.destroy() });
        }
        for (let k = 0; k < 4; k++) { const sm = this.add.circle(x + (Math.random() - 0.5) * 20, y - 6, 4, 0x2a2420, 0.4).setDepth(4.4); this.tweens.add({ targets: sm, y: sm.y - 40, scale: 3, alpha: 0, duration: 900 + k * 120, onComplete: () => sm.destroy() }); }
        const sc = this.add.ellipse(x, y + 8, 34 * s, 14 * s, 0x140a06, 0.5).setDepth(0.62);
        this.tweens.add({ targets: sc, alpha: 0, delay: 1200, duration: 1200, onComplete: () => sc.destroy() });
        this._vfxFlash?.(x, y, 90 * s, col, 320, 0.9);
        Sfx.play(this, 'erupt');
    }

    _clearKindle(enemy) {
        if (this._kindleMarked) this._kindleMarked.delete(enemy);
        if (this._kindleTarget === enemy) this._kindleTarget = null;
        enemy._kindleHits = 0;
        enemy._kindleUntil = 0;
        enemy._kindleStore = 0;
        if (enemy.sprite?.active && !enemy._iceCube && !enemy.isFrozen) enemy.sprite.clearTint?.();   // (the heat glow off it; clearTint puts its own colour back)
        if (enemy._kindleGfx) {
            this.tweens.killTweensOf(enemy._kindleGfx);
            enemy._kindleGfx.destroy();
            enemy._kindleGfx = null;
        }
    }

    // ── KINDLE METER ─────────────────────────────────────────────────────────
    // ONE bar that fills, not a row of pips. Pips could only ever say "how many" -- at a
    // 30 hit cap that is thirty tiny rectangles nobody can count, and it hid the thing
    // that actually matters, which is how far along a steeply non-linear curve you are.
    //
    // The fill colour carries that instead: a cold ember at the start, through orange and
    // white-hot, to blue at the cap. Blue reads as hotter than red to anyone who has seen
    // a gas flame, and it only appears when you have genuinely stayed on one target -- so
    // the colour IS the payout curve, visible at a glance from across the room.
    _kindleHeatColor(t) {
        // Stops walked as a plain channel lerp. Phaser's Interpolate.ColorWithColor
        // returns {r,g,b} with no .color, which is a trap this file has hit before.
        const STOPS = [
            [0.00, 0x4a, 0x1c, 0x08],   // cold ember
            [0.40, 0xff, 0x6a, 0x1e],   // orange
            [0.72, 0xff, 0xc4, 0x4a],   // yellow-white
            // The last two stops are deliberately close in brightness. A pure white-hot
            // peak followed by a saturated blue dropped ~69 points of luminance exactly
            // when the meter is worth the most -- the bar visibly DIMMED as it filled.
            // A warmer near-peak and a paler blue keep the colour shift (which is the
            // signal) while cutting the brightness loss to about a third of that.
            [0.90, 0xff, 0xdc, 0xa8],   // near-white, held back a little
            [1.00, 0x7f, 0xd4, 0xff],   // blue hot
        ];
        const u = Math.max(0, Math.min(1, t));
        let a = STOPS[0], b = STOPS[STOPS.length - 1];
        for (let i = 0; i < STOPS.length - 1; i++) {
            if (u >= STOPS[i][0] && u <= STOPS[i + 1][0]) { a = STOPS[i]; b = STOPS[i + 1]; break; }
        }
        const span = (b[0] - a[0]) || 1;
        const k = (u - a[0]) / span;
        const ch = i => Math.round(a[i] + (b[i] - a[i]) * k);
        return (ch(1) << 16) | (ch(2) << 8) | ch(3);
    }

    // The kindle mark: a ring of fire at its feet that fills round it as the pellets pile up, its colour the heat
    // (_kindleHeatColor: ember, orange, white-hot, blue at the cap), flame tongues rising off the lit part, the fuse as a
    // thin arc closing, and once it's overkindled a crown of blue flame over it. Drawn every frame (_updateKindling).
    _updateKindleIndicator(enemy) {
        if (!enemy._kindleGfx) { enemy._kindleGfx = this.add.graphics().setDepth(1.05).setBlendMode(Phaser.BlendModes.ADD); this._vfxSort?.(enemy._kindleGfx); }
        enemy._kindleBump = this.time.now;
        this._drawKindleMark(enemy, this.time.now);
    }
    _drawKindleMark(e, now) {
        const g = e._kindleGfx, p = this._kindlePos(e); if (!g?.active || !p) return;
        const C = this._kindlingCfg(), t = Math.min(1, (e._kindleHits || 0) / C.MAX_HITS), col = this._kindleHeatColor(t), TAU = Math.PI * 2;
        const bump = Math.max(0, 1 - (now - (e._kindleBump || 0)) / 140), rx = 15 + 2 * bump, ry = 6 + 0.8 * bump, top = -Math.PI / 2;
        g.clear().setPosition(p.x, p.y + 10);
        g.lineStyle(2, 0x2a1408, 0.6); g.strokeEllipse(0, 0, rx * 2, ry * 2);   // the unlit ring
        const seg = 28, lit = Math.round(seg * Math.max(0.04, t));
        for (let k = 0; k < lit; k++) {   // the lit part, and a flame tongue off every other segment
            const a0 = top + k / seg * TAU, a1 = top + (k + 1) / seg * TAU;
            g.lineStyle(3, col, 0.95); g.lineBetween(Math.cos(a0) * rx, Math.sin(a0) * ry, Math.cos(a1) * rx, Math.sin(a1) * ry);
            if (k % 2 === 0) {
                const a = (a0 + a1) / 2, x = Math.cos(a) * rx, y = Math.sin(a) * ry, h = (3 + 5 * t) * (0.6 + 0.4 * Math.sin(now * 0.025 + k * 1.7));
                g.fillStyle(col, 0.85); g.fillTriangle(x - 1.6, y, x + 1.6, y, x + Math.sin(now * 0.02 + k) * 1.2, y - h);
                g.fillStyle(0xfff4d8, 0.7); g.fillTriangle(x - 0.6, y, x + 0.6, y, x, y - h * 0.5);
            }
        }
        if (Math.random() < 0.04 + 0.25 * t) {   // it smokes, more as it fills, and spits sparks once it's past halfway
            const sm = this.add.circle(p.x + (Math.random() - 0.5) * 14, p.y - 4, 2.5 + 2 * t, t > 0.5 ? 0x4a2a1a : 0x2a2420, 0.35).setDepth(4.3);
            this.tweens.add({ targets: sm, y: sm.y - 22 - 14 * t, x: sm.x + (Math.random() - 0.5) * 8, scale: 2.2, alpha: 0, duration: 800, onComplete: () => sm.destroy() });
            if (t > 0.5) { const sp = this.add.rectangle(p.x, p.y - 4, 2, 2, col).setBlendMode(Phaser.BlendModes.ADD).setDepth(4.31); const a = Math.random() * Math.PI * 2; this.tweens.add({ targets: sp, x: p.x + Math.cos(a) * 14, y: p.y - 10 + Math.sin(a) * 8, alpha: 0, duration: 300, onComplete: () => sp.destroy() }); }
        }
        if (t > 0.25 && e.sprite?.active && e.sprite.setTint && !e._iceCube && !e.isFrozen) e.sprite.setTint(MenuArt.mix(e.sprite._cfxTint?.base ?? 0xffffff, col, Math.min(0.55, t * 0.6)));   // it glows hotter as it fills, from its own colour (from white, a Rooter or a sniper lost theirs)
        const full = (e._kindleHits || 0) >= C.MAX_HITS, idle = now - (e._kindleFedAt || now);
        // the arc: overkindled, the window running out; otherwise the time before it starts cooling (gone while it cools)
        const fuse = full ? Math.max(0, ((e._kindleUntil || now) - now) / C.OVER_MS) : Math.max(0, 1 - idle / C.COOL_DELAY);
        g.lineStyle(1, 0xffe8b0, 0.7); g.beginPath(); g.arc(0, 0, rx + 4, top, top + fuse * TAU, false); g.strokePath();
        if (t >= 1) {   // overkindled: a crown of blue flame over it, and the ring throbbing
            const cy2 = -26, f2 = 0.5 + 0.5 * Math.sin(now * 0.03);
            for (let k = 0; k < 5; k++) { const x = (k - 2) * 4, h = 6 + (k === 2 ? 4 : 0) + 2 * Math.sin(now * 0.03 + k); g.fillStyle(0x7fd4ff, 0.9); g.fillTriangle(x - 2, cy2, x + 2, cy2, x, cy2 - h); g.fillStyle(0xffffff, 0.8); g.fillTriangle(x - 0.8, cy2, x + 0.8, cy2, x, cy2 - h * 0.55); }
            g.lineStyle(2, 0xdff2ff, 0.4 + 0.5 * f2); g.strokeEllipse(0, 0, rx * 2 + 6, ry * 2 + 3);
        }
        const st = (e._kindleStore || 0) / Math.round(C.MAX_HITS * C.STORE_MAX);
        if (t >= 1) {   // the second ring, stacked on top of the first: its empty track, then the stored part, white-hot over a blue glow
            const oy = -6, n2 = Math.round(seg * st);
            g.lineStyle(2, 0x2a3a58, 0.7); g.strokeEllipse(0, oy, rx * 2, ry * 2);
            for (let k = 0; k < n2; k++) {
                const a0 = top + k / seg * TAU, a1 = top + (k + 1) / seg * TAU, x0 = Math.cos(a0) * rx, y0 = Math.sin(a0) * ry + oy, x1 = Math.cos(a1) * rx, y1 = Math.sin(a1) * ry + oy;
                g.lineStyle(5, 0x4a9aff, 0.45); g.lineBetween(x0, y0, x1, y1);
                g.lineStyle(2, 0xffffff, 0.95); g.lineBetween(x0, y0, x1, y1);
            }
        }
    }

    // R key. The spender: attack speed goes supersonic so you can actually reach MAX_HITS
    // inside one fuse, which roughly doubles the payout.
    // R key. Guarantees the burst roll for its duration rather than introducing a second
    // mechanic: the six pellets are the same six you get from the 5% passive. Because a
    // full bar detonates on its own, the extra pellets convert into reaching the cap
    // sooner -- more detonations per second, not one larger one.
    // ══════════════════════════════════════════════════════════════════════
    // IGNITION BAR
    // ══════════════════════════════════════════════════════════════════════
    // A 16-second cooldown whose ONLY feedback was a status text telling you how many seconds
    // were left -- and only if you pressed R and were refused. You had to fail to find out.
    //
    // Three states, so the bar answers "can I press R" at a glance without a number:
    //   RECHARGING  fills left to right, dim, no pulse
    //   READY       full, bright, pulsing -- the only state that pulses, so it reads as a
    //               prompt rather than decoration
    //   ACTIVE      drains fast across IGNITE_DUR, brightest, so the 3.5s window is visible
    //               while you are spending it
    //
    // Drawn every frame rather than tweened: the fill is a function of two timestamps, so a
    // tween would be a second source of truth that could disagree with them.
    _updateKindleIgniteBar() {
        // Requires fire to be the ACTIVE element, not merely the one Kindling Brand is slotted
        // into. The first version checked equippedWeapons.fire alone, which is true the whole
        // time the weapon is owned -- so the bar sat over the player while you were playing ice
        // or lightning, advertising a cooldown for an ability you could not press. Exactly the
        // slotted-versus-wielding distinction the Field Kit's scrap gate turns on, got backwards
        // here because for the Field Kit "slotted" was the right answer and for a UI prompt it
        // is not.
        const wielding = this.currentElement === 'fire'
            && (this.equippedWeapons?.fire || 'flame_fists') === 'ignition';
        if (!wielding || !this.player) { this._destroyKindleIgniteBar(); return; }

        const C = this._kindlingCfg();
        const now = this.time.now;
        const activeUntil = this._kindleIgniteUntil || 0;
        const readyAt     = this._kindleIgniteReady || 0;

        let frac, state;
        if (now < activeUntil) {
            // Spending it: drain across the duration.
            frac = (activeUntil - now) / C.IGNITE_DUR;
            state = 'active';
        } else if (now < readyAt) {
            // Recharging: fill across whatever remains of the cooldown AFTER the active window,
            // so the bar starts empty the instant ignition ends rather than jumping.
            const fillStart = readyAt - (C.IGNITE_COOL - C.IGNITE_DUR);
            frac = Math.max(0, Math.min(1, (now - fillStart) / (C.IGNITE_COOL - C.IGNITE_DUR)));
            state = 'recharging';
        } else {
            frac = 1;
            state = 'ready';
        }

        if (!this._kindleBar?.bg?.active) {   // the scene object outlives a floor change; its old graphics do not
            this._kindleBar = {
                bg:  this.add.graphics().setDepth(6),
                fill: this.add.graphics().setDepth(6.1),
                glow: this.add.graphics().setDepth(6.05)
            };
        }
        const B = this._kindleBar;
        // ABOVE the player. Below it read as a different KIND of object -- a shadow or a
        // selection marker -- because every other status bar in the game sits overhead.
        //
        // 24, not the 42 the Singularity Staff's orb bar uses. Matching that offset looked right
        // on paper and floated in practice: the orb bar carries an "R ORB READY" label above it,
        // so 42 is the height of a bar PLUS its caption. A bare bar needs to sit where the
        // caption would have been.
        // One bar for both (2026-10-20): the fuel across it, Blue Flame's charge as a pip at its right end.
        const W = 34, H = 5, fuel = Math.max(0, Math.min(1, this._fuel ?? 1)), dry = now < (this._fuelDryUntil || 0), blue = state === 'active';
        const bx = this.player.x - (W + 7) / 2, by = this.player.y - 16;
        B.bg.clear(); B.fill.clear(); B.glow.clear();
        // fuel: orange, blinking red when low, grey while it's run dry, blue while Blue Flame refills it
        const low = fuel < 0.25 && !blue, blink = low ? 0.55 + 0.45 * Math.sin(now / 70) : 1;
        const body = dry ? 0x5a4a44 : blue ? 0x7fd4ff : low ? 0xff3a2a : 0xff7a22, hot = dry ? 0x8a7a70 : blue ? 0xffffff : 0xffc070;
        B.fill.setAlpha(blink);
        UIKit.rBar(B.fill, bx + 6, by, W, fuel, { col: body, hot, dark: 0x1a0a04, time: now, h: H, ready: false, gem: false });
        // the gem: Blue Flame's charge, pulsing when R is ready, draining while it burns
        UIKit.rGem(B.bg, bx - 2, by + H / 2, frac, { col: state === 'recharging' ? 0x2a5a8a : 0x7fd4ff, hot: 0xffffff, dark: 0x1a0a04, time: now, ready: state === 'ready' });
    }

    // Ignition's fuel (FUEL_MS of flame on a full tank, REFUEL_MS to fill it out): it drains while lit and refills while out.
    // Running dry puts the flame out with a sputter and it can't relight for DRY_MS; putting it out yourself costs nothing.
    // Blue Flame burns free and refills the tank as it runs. Per frame, from GameScene.update.
    _jetFuelTick(delta) {
        const C = this._kindlingCfg(), now = this.time.now, dt = Math.min(100, delta || 16);
        const blue = (this._kindleIgniteUntil || 0) > now, burning = this._jetLit && this._jetHeld?.();
        if (blue || !burning) { this._fuel = Math.min(1, (this._fuel ?? 1) + dt / C.REFUEL_MS); return; }
        this._fuel = (this._fuel ?? 1) - dt / C.FUEL_MS;
        if (this._fuel > 0) return;
        this._fuel = 0; this._jetLit = false; this._fuelDryUntil = now + C.DRY_MS;
        const tip = typeof CreatureFX !== 'undefined' ? CreatureFX.gearTip?.(this) : null, x = tip?.x ?? this.player.x, y = tip?.y ?? this.player.y - 6;
        for (let k = 0; k < 6; k++) {   // a puff of smoke off the nozzle
            const sm = this.add.circle(x, y, 2 + Math.random() * 2, 0x4a4440, 0.7).setDepth(4.3);
            this.tweens.add({ targets: sm, x: x + (Math.random() - 0.5) * 16, y: y - 8 - Math.random() * 14, scale: 2.4, alpha: 0, duration: 600 + k * 60, onComplete: () => sm.destroy() });
        }
        Sfx.play(this, 'click');
        this.showStatusText(this.player.x, this.player.y - 34, 'OUT OF FUEL', '#ff8a5a');
    }

    _destroyKindleIgniteBar() {
        if (!this._kindleBar) return;
        for (const g of Object.values(this._kindleBar)) { if (g?.active) g.destroy(); }
        this._kindleBar = null;
    }

    kindlingIgnitionMode() {
        const C = this._kindlingCfg();
        const now = this.time.now;
        if (now < (this._kindleIgniteReady || 0)) {
            // Kept, but it is no longer the only feedback -- the bar under the player shows this
            // continuously, so the player does not have to fail a press to learn the timing.
            const left = Math.ceil(((this._kindleIgniteReady || 0) - now) / 1000);
            this.showStatusText(this.player.x, this.player.y - 28, `BLUE FLAME ${left}s`, '#6a8acc');
            return;
        }
        this._kindleIgniteUntil = now + C.IGNITE_DUR;
        this._kindleIgniteReady = now + C.IGNITE_COOL;
        this.cameras.main.shake(140, 0.005);
        this._kindleIgniteFx(C.IGNITE_DUR);
    }

    // Ignition mode on you: the word slams in over you in the title face, a ring of fire bursts out, and while it lasts a
    // heat haze shimmers round you, flames lick up off you and the gun's barrel glows white-hot.
    _kindleIgniteFx(ms) {
        const p = this.player; if (!p?.active) return;
        const ADD = Phaser.BlendModes.ADD, t0 = this.time.now;
        const word = this.add.text(p.x, p.y - 40, 'BLUE FLAME', { fontSize: '22px', fontFamily: UIKit.FONT.title, fontStyle: 'bold italic', color: '#eaf6ff', stroke: '#2a5ac8', strokeThickness: 5 }).setOrigin(0.5).setDepth(10).setScale(1.8).setAlpha(0);
        this._vfxSort?.(word);
        this.tweens.add({ targets: word, scale: 1, alpha: 1, duration: 160, ease: 'Back.easeOut', onComplete: () => this.tweens.add({ targets: word, y: word.y - 16, alpha: 0, delay: 500, duration: 400, onComplete: () => word.destroy() }) });
        const ring = this.add.ellipse(p.x, p.y + 10, 24, 10).setStrokeStyle(3, 0x8ac8ff, 1).setBlendMode(ADD).setDepth(1.04);
        this.tweens.add({ targets: ring, scale: 5, alpha: 0, duration: 420, ease: 'Quad.easeOut', onComplete: () => ring.destroy() });
        const haze = this.textures.exists('vfx_glow') ? this.add.image(p.x, p.y, 'vfx_glow').setTint(0x3a6aff).setBlendMode(ADD).setDepth(p.depth - 0.02).setScale(0.55).setAlpha(0) : null;
        const g = this.add.graphics().setBlendMode(ADD);
        const tick = () => {
            const now = this.time.now, left = ms - (now - t0);
            if (left <= 0 || !p.active) { this.events.off('update', tick); haze?.destroy(); g.destroy(); return; }
            const fade = Math.min(1, (now - t0) / 150, left / 300);
            haze?.setPosition(p.x, p.y + 4).setAlpha(0.3 * fade * (0.8 + 0.2 * Math.sin(now * 0.03))).setScale(0.5 + 0.05 * Math.sin(now * 0.02));
            g.clear().setDepth(p.depth + 0.01).setAlpha(fade);
            for (let k = 0; k < 6; k++) { const x = p.x - 12 + k * 4.8, h = 6 + 5 * (0.5 + 0.5 * Math.sin(now * 0.03 + k * 2.1)), y = p.y + 12; g.fillStyle(0x4a8aff, 0.8); g.fillTriangle(x - 2, y, x + 2, y, x + Math.sin(now * 0.02 + k), y - h); g.fillStyle(0xffd27a, 0.8); g.fillTriangle(x - 1, y, x + 1, y, x, y - h * 0.55); }
            const tip = typeof CreatureFX !== 'undefined' ? CreatureFX.gearTip?.(this) : null;
            if (tip) { g.fillStyle(0x6ab0ff, 0.6); g.fillCircle(tip.x, tip.y, 5); g.fillStyle(0xeaf6ff, 0.9); g.fillCircle(tip.x, tip.y, 2.2); }   // the barrel, white-hot
            if (Math.random() < 0.4) { const e = this.add.rectangle(p.x + (Math.random() - 0.5) * 22, p.y + 8, 2, 2, Math.random() < 0.5 ? 0xbfe8ff : 0x4a8aff).setBlendMode(ADD).setDepth(p.depth + 0.02); this.tweens.add({ targets: e, y: e.y - 24 - Math.random() * 14, alpha: 0, duration: 520, onComplete: () => e.destroy() }); }
        };
        this.events.on('update', tick); this.events.once('shutdown', () => this.events.off('update', tick));
        Sfx.play(this, 'ult');
    }

    // ═══ MAGMA STAFF HEAT ════════════════════════════════════════════════
    // The staff's ramp used to be read off the ENEMIES: _recalcMagmaFireballCount
    // scanned every enemy on the map for the highest burn stack and used that as the
    // tier. Three things fell out of that, all bad. You could build stacks on a trash
    // mob and then open on a fresh boss at full power, so the ramp was cosmetic. The
    // instant the burning enemy died the tier dropped to 1, meaning the weapon was at
    // its weakest immediately after a kill. And in a crowd where your own lava kept
    // something burning, it sat at max tier permanently without being earned.
    //
    // Heat belongs to the WEAPON instead. It builds when your fireballs land and bleeds
    // off when they stop, so the reward for committing to a target is yours and does not
    // evaporate because the target died. Burn still feeds it -- a burning target heats
    // the staff faster -- but burn is the accelerant now, not the fuel gauge.
    // Returned from a method, not held as class fields: every method in this file is
    // invoked as WeaponSystem.prototype.x.call(scene), so `this` is the SCENE. A class
    // field would be defined on a WeaponSystem instance that is never constructed.
    _magmaCfg() {
        return {
            HEAT_MAX:   100,
            TIER_AT:    [0, 18, 36, 54, 72, 90],   // heat floor for tiers 1..6
            FIREBALLS:  [2, 2, 3, 3, 4, 5],
            // SHRINKS as you ramp. It used to GROW (1200 + 120 per tier), which partly
            // cancelled the damage gain and is why the middle of the curve felt flat.
            COOLDOWN:   [1200, 1140, 1080, 1020, 980, 940],
            // No pellet fan. It was introduced to kill the damage cliff, and it did --
            // but a 3-pellet 18-degree spread also let one cast hit several enemies, so
            // the staff turned into a crowd-clearer at exactly the tier it is meant to be
            // at its most focused. Because the pellets SPLIT the payload rather than
            // multiplying it, deleting them costs nothing on the curve: single-target dps
            // at every tier is identical, only the incidental multi-target reach is gone.
            BASE_DMG:   12.0,    // per fireball (9 until volleys fell off on one target, 2026-10-18)
            // What replaces the fan as the high-tier reward, and it points the other way:
            // bonus damage against a target that is ALREADY burning. Crowds do not benefit
            // -- a fresh enemy gives +0% -- but the one thing you have been working on
            // takes up to +30%. The reward for ramping now lands on commitment.
            FOCUS_TIER: 4,       // tier at which the bonus switches on
            FOCUS_PER_STACK: 0.06,
            TRAIL_TIER: 5,
            DECAY:      25 * (WeaponLevels.perk('magma_staff', 'burn') ? 0.6 : 1),   // heat per second once idle (Slow Burn: 40% slower)
            GRACE:      1200,    // ms after the last hit before decay starts
        };
    }

    _magmaTier() {
        const h = this._magmaHeat || 0;
        const T = this._magmaCfg().TIER_AT;
        for (let i = 5; i >= 0; i--) if (h >= T[i]) return i + 1;
        return 1;
    }

    // Called by the staff's fireballs when they connect. Burn stacks on the victim
    // accelerate the climb, which is what keeps the weapon reading as fire rather than
    // as a generic charge meter.
    _addMagmaHeat(enemy) {
        const C = this._magmaCfg();
        const stacks = Math.min(enemy?.burnStacks || 0, 5);
        this._magmaHeat = Math.min(C.HEAT_MAX, (this._magmaHeat || 0) + 8 + 1.5 * stacks);
        this._magmaLastHit = this.time.now;
    }

    // Per-frame bleed. Grace period first so the gap between casts does not cost you
    // tier -- only actually stopping does.
    _updateMagmaHeat(time) {
        // _magmaHeatPrev advances EVERY frame, not only while decaying. Stamping it
        // inside the decay branch means the first frame after the grace period measures
        // dt from whenever decay last ran -- potentially seconds -- and dumps the entire
        // bar in one step instead of bleeding it.
        const prev = this._magmaHeatPrev ?? time;
        this._magmaHeatPrev = time;
        if (!this._magmaHeat) return;
        const C = this._magmaCfg();
        if (time - (this._magmaLastHit || 0) < C.GRACE) return;
        const dt = Math.min(0.25, (time - prev) / 1000);
        this._magmaHeat = Math.max(0, this._magmaHeat - C.DECAY * dt);
    }

    // ── BURN: one stacking burn for every fire source ───────────────────────
    // There used to be four running at once on the same target, each with its own rules: the
    // old isBurning burn (any fire hit, unless the Magma Staff was the equipped weapon), these
    // stacks, lava's own 0.8-every-80ms tick, and a boss copy. Now there is one:
    //   stacks 1-5, a tick every 0.5s: 1 / 2.25 / 4 / 6.5 / 10 (2 / 4.5 / 8 / 13 / 20 DPS), plus PCT_TICK of max HP a tick
    //   any new stack refreshes a 4s hold, then one stack falls off per second
    //   fists, sword and magma balls +1 a hit; lava +1 every 0.8s it stands in it (lava deals
    //   no damage of its own); Magma Surge +2; fire ult pellets +1. Ignition's pellets don't burn.
    //   Combustion (the fire ult, Ignition's pop) cashes it in: +8 per stack, the stacks spent
    _burnCfg() {
        return {
            MAX: 5,
            TICK_MS: 500,
            PER_TICK: [0, 1, 2.25, 4, 6.5, 10],
            PCT_TICK: [0, 0.001, 0.002, 0.003, 0.004, 0.005],   // ...plus this share of its MAX HP a tick (5 stacks: 1%/s), so burn keeps up as the Tower's HP grows
            BOSS_PCT: 0.25,   // bosses take this much of the percent part
            // BLUE BURN (Ignition's Blue Flame): blue stacks sit among the ordinary ones but don't tick. Once the hold ends, a burn
            // with any blue in it doesn't lose stacks: every BLUE_INFECT_MS one more turns blue; all blue, one pops every
            // BLUE_POP_MS for BLUE_BURST + BLUE_PCT of max HP (bosses BOSS_PCT of that), through resistance.
            BLUE_INFECT_MS: 600, BLUE_POP_MS: 400, BLUE_BURST: 25, BLUE_PCT: 0.02,
            HOLD_MS: 4000,
            DECAY_MS: 1000,
            LAVA_MS: 800,   // standing in lava: one burn stack per 0.8s, no damage of its own
            COMBUST_PER_STACK: 8,
        };
    }

    // Damage and interval for a stack count (kept for anything that still asks).
    _burnTierStats(stacks) {
        const B = this._burnCfg();
        const s = Math.min(B.MAX, Math.max(1, stacks | 0));
        return { dmg: B.PER_TICK[s] * this.damageScaling, interval: B.TICK_MS };
    }

    // Brings a burning thing's stacks up to date: once its hold is over, one falls off every
    // DECAY_MS. Keeps the old isBurning flag true to the stacks for whatever still reads it.
    _burnDecay(o, now) {
        if (!o) return;
        if ((o.burnStacks || 0) > 0) {
            const B = this._burnCfg();
            if (o._burnDecayAt === undefined) o._burnDecayAt = now + B.HOLD_MS;
            while (o.burnStacks > 0 && now >= o._burnDecayAt) {
                if (o.blueBurn > 0 && o.burnStacks > o.blueBurn) { o.blueBurn++; o._burnDecayAt += B.BLUE_INFECT_MS; o._blueChanged = true; }   // the blue spreads
                else if (o.blueBurn > 0) { o.blueBurn--; o.burnStacks--; o._burnDecayAt += B.BLUE_POP_MS; this._blueBurnPop?.(o); }   // all blue: they go off, one by one
                else { o.burnStacks--; o._burnDecayAt += B.DECAY_MS; }
            }
            o.blueBurn = Math.min(o.blueBurn || 0, o.burnStacks || 0);
        }
        if (!((o.burnStacks || 0) > 0)) o.burnStacks = 0;
        const was = o.isBurning;
        o.isBurning = o.burnStacks > 0;
        if (was && !o.isBurning && o.sprite?.active) {   // the last stack gone: the flames and the orange go with it (the expiry in the burn loop never saw this, so they stayed)
            this.clearBurnVisual(o);
            if (!o.isFrozen) o.sprite.clearTint();
        }
    }

    // n stacks onto an enemy. Not on ice elementals, not on anything out of the world.
    applyBurnStack(enemy, n = 1) {
        if (!enemy?.sprite?.active || enemy.health <= 0) return;
        if (enemy._immuneFx === 'fire') { if (enemy.sprite?.active && this.time.now - (enemy._fxNoAt || 0) > 900) { enemy._fxNoAt = this.time.now; this.showStatusText(enemy.sprite.x, enemy.sprite.y - 30, "CAN'T BURN", '#ffb070'); } return; }   // an Adaptive Shade in its fire form
        if (enemy.iceImmune) return;
        if (this._phasedOut(enemy)) return;
        const B = this._burnCfg(), now = this.time.now;
        this._burnDecay(enemy, now);
        enemy.burnStacks = Math.min(B.MAX, (enemy.burnStacks || 0) + n);
        enemy.lastBurnStackTime = now;
        Sfx.play(this, 'ignite');
        // Super Burn (the fire ult's) is kept alight by ordinary burn, never added to by it: its hold starts again
        if (enemy.superBurn > 0) { this._superBurnDecay(enemy, now); if (enemy.superBurn > 0) enemy._sbDecayAt = now + this._superBurnCfg().HOLD; }
        enemy._burnDecayAt = now + B.HOLD_MS;
        enemy.isBurning = true;
        this._recalcMagmaFireballCount();
        this._applyBurnDoT(enemy);
    }

    // A blue burn stack: onto an empty slot if there is one, else one of the ordinary stacks turns blue
    applyBlueBurn(enemy) {
        if (!enemy?.sprite?.active || enemy.health <= 0 || enemy.iceImmune || this._phasedOut(enemy)) return;
        const B = this._burnCfg(), now = this.time.now;
        this._burnDecay(enemy, now);
        if ((enemy.burnStacks || 0) < B.MAX) enemy.burnStacks = (enemy.burnStacks || 0) + 1;
        enemy.blueBurn = Math.min(enemy.burnStacks, (enemy.blueBurn || 0) + 1);
        enemy.lastBurnStackTime = now; enemy._burnDecayAt = now + B.HOLD_MS; enemy.isBurning = true;
        Sfx.play(this, 'sburn');
        this._applyBurnDoT(enemy);
    }
    // One blue stack going off: a burst through resistance (a tick, not a hit)
    _blueBurnPop(e) {
        if (!e?.sprite?.active || !(e.health > 0)) return;
        const B = this._burnCfg(), raw = B.BLUE_BURST * (this.damageScaling || 1) + B.BLUE_PCT * (e.maxHealth || 0) * (e.isBoss ? B.BOSS_PCT : 1);
        this._tick = true; let d; try { d = raw * this._dmgOutMult(e, 'fire'); } finally { this._tick = false; }
        e.health -= d;
        this.showDamageNumber(e.sprite.x, e.sprite.y - 14, d, '#8ac8ff');
        this._vfxFlash?.(e.sprite.x, e.sprite.y - 6, 34, 0x6ab0ff, 220, 0.8);
        Sfx.play(this, 'sburn');
        this.updateEnemyHealthBar(e);
        if (e.health <= 0) this.killEnemy(e);
    }

    // ── SUPER BURN (Scorch, the fire ult) ─────────────────────────────────────
    // Burn's bigger form: 3 stacks at most, so it fills fast, ticking every SB_TICK for SB_PER_TICK[stacks] (it melts
    // things rather than thudding them: many light ticks, good against armour that counts hits). It holds SB_HOLD after
    // the last stack, then one falls off every SB_DECAY. Each tick, like every burn tick in Scorch, heals you a little.
    _superBurnCfg() { return { MAX: 3, TICK: 200, PER_TICK: [0, 2, 4, 6], PCT_TICK: [0, 0.0015, 0.003, 0.005], HOLD: 8000, DECAY: 2500 }; }   // it lasts: 8s after the last stack, then one every 2.5s (burn: 4s, then 1s)   // PCT_TICK: of max HP a tick (3 stacks 2.5%/s; bosses burn's BOSS_PCT of it)
    applySuperBurn(enemy, n = 1) {
        if (!enemy?.sprite?.active || enemy.health <= 0 || enemy.iceImmune || this._phasedOut(enemy)) return;
        const B = this._superBurnCfg(), now = this.time.now;
        this._superBurnDecay(enemy, now);
        enemy.superBurn = Math.min(B.MAX, (enemy.superBurn || 0) + n);
        Sfx.play(this, 'sburn');
        enemy._sbDecayAt = now + B.HOLD;
        if (!enemy._sbTimer) {
            const tick = () => {
                enemy._sbTimer = null;
                if (!enemy.sprite?.active || enemy.health <= 0) return;
                this._superBurnDecay(enemy, this.time.now);
                if (!(enemy.superBurn > 0)) return;
                if (!this._phasedOut(enemy)) {
                    this._tick = true; let dmg; try { dmg = this.resolveElementalHit(enemy, B.PER_TICK[enemy.superBurn] * this.damageScaling + B.PCT_TICK[enemy.superBurn] * (enemy.maxHealth || 0) * (enemy.isBoss ? this._burnCfg().BOSS_PCT : 1), 'fire', true); } finally { this._tick = false; }   // a tick, not a hit
                    if (dmg !== null && dmg > 0) {
                        enemy.health -= dmg;
                        this.gainUltCharge(this.ultChargePerBurnTick, 'fire');
                        this._scorchHeal();
                        if (enemy.sprite?.active) this.showDamageNumber(enemy.sprite.x, enemy.sprite.y - 8, dmg, '#ffe08a');
                        this.updateEnemyHealthBar(enemy);
                        if (enemy.health <= 0) { this.killEnemy(enemy); return; }
                    }
                }
                enemy._sbTimer = this.time.delayedCall(B.TICK, tick);
            };
            enemy._sbTimer = this.time.delayedCall(B.TICK, tick);
        }
    }
    _superBurnDecay(o, now) {
        if (!((o.superBurn || 0) > 0)) { o.superBurn = 0; return; }
        const B = this._superBurnCfg();
        while (o.superBurn > 0 && now >= (o._sbDecayAt ?? now)) { o.superBurn--; o._sbDecayAt = (o._sbDecayAt ?? now) + B.DECAY; }
    }
    // Scorch's healing: a share of your max HP per burn tick while it runs, capped per second.
    _scorchHeal() {
        if (!this.ignitionActive || !(this.health > 0)) return;
        const C = this._scorchCfg?.(); if (!C) return;
        const now = this.time.now, W = (this._scorchHealWin ||= { t: now, amt: 0 });
        if (now - W.t >= 1000) { W.t = now; W.amt = 0; }
        const heal = Math.min(this.maxHealth * C.HEAL_TICK, this.maxHealth * C.HEAL_CAP - W.amt, this.maxHealth * C.HEAL_TOTAL - (this._scorchHealt || 0), this.maxHealth * (1 + C.OVERHEAL) - this.health);   // it can overheal, up to OVERHEAL past max
        if (heal <= 0) return;
        this.health += heal; W.amt += heal; this._scorchHealt = (this._scorchHealt || 0) + heal;
        if (now - (this._scorchHealHud || 0) > 120) { this._scorchHealHud = now; this.updateHUD?.(); }
    }

    // ── Supernova ignition mark — explodes after 2s, cascades to nearby enemies ──
    _applyIgnitionMark(enemy) {
        if (!enemy.sprite?.active || enemy.health <= 0 || this._phasedOut(enemy)) return;
        if (enemy._ignitionMarkActive) return; // already marked
        enemy._ignitionMarkActive = true;

        const EXPLOSION_DMG    = 15 * this.damageScaling;
        const EXPLOSION_RADIUS = this.TILE_SIZE * 2.5; // px
        const FUSE_TIME        = 2000;
        const MAX_EXPLOSIONS   = 2; // per enemy per cast

        // The mark: a blue-white molten core lodged in it, hotter as the fuse burns down. Cracks of that light spread
        // over its body, a fuse ring closes in round it, and sparks spit off faster toward the end.
        const markG = this.add.graphics().setDepth(5).setBlendMode(Phaser.BlendModes.ADD), born = this.time.now;
        const cracks = Array.from({ length: 5 }, (_, k) => { const a = k / 5 * Math.PI * 2 + Math.random(); return [a, 5 + Math.random() * 5]; });
        const drawMark = () => {
            if (!markG.active) return;
            const k = Math.min(1, (this.time.now - born) / FUSE_TIME), heat = k * k, flick = 0.75 + 0.25 * Math.sin(this.time.now * (0.02 + 0.05 * k));
            markG.clear(); markG.x = enemy.sprite.x; markG.y = enemy.sprite.y - 4;
            for (const [a, L] of cracks) {   // the cracks, spreading as it heats
                const l = L * (0.3 + 0.9 * k); markG.lineStyle(1.4, k > 0.7 ? 0xffffff : 0x8ac8ff, (0.4 + 0.6 * heat) * flick);
                markG.lineBetween(0, 0, Math.cos(a) * l * 0.6 + Math.sin(a * 3) * 2, Math.sin(a) * l * 0.6); markG.lineBetween(Math.cos(a) * l * 0.6 + Math.sin(a * 3) * 2, Math.sin(a) * l * 0.6, Math.cos(a) * l, Math.sin(a) * l);
            }
            markG.fillStyle(0x2a6aff, 0.5 * flick); markG.fillCircle(0, 0, 6 + 3 * heat);
            markG.fillStyle(0xbfe0ff, 0.9); markG.fillCircle(0, 0, 3 + 1.5 * heat);
            markG.fillStyle(0xffffff, 1); markG.fillCircle(0, 0, 1.5 + heat);
            const rr = 18 - 10 * k;   // the fuse ring, closing
            markG.lineStyle(2, 0x6aa8ff, 0.5 + 0.5 * k); markG.beginPath(); markG.arc(0, 0, rr, -Math.PI / 2, -Math.PI / 2 + (1 - k) * Math.PI * 2); markG.strokePath();
            if (Math.random() < 0.1 + 0.5 * k) { const a2 = Math.random() * Math.PI * 2, sp = this.add.rectangle(markG.x, markG.y, 2, 2, Math.random() < 0.5 ? 0xffffff : 0x8ac8ff).setDepth(5.1).setBlendMode(Phaser.BlendModes.ADD); this.tweens.add({ targets: sp, x: sp.x + Math.cos(a2) * 14, y: sp.y + Math.sin(a2) * 14 - 6, alpha: 0, duration: 280, onComplete: () => sp.destroy() }); }
        };
        const markTimer = this.time.addEvent({ delay: 30, loop: true, callback: () => {
            if (!enemy.sprite?.active) { markTimer.remove(); markG.destroy(); return; }
            drawMark();
        }});
        const cdText = { active: false, destroy() {} };   // (the old countdown number is gone: the ring is the fuse)

        // Fuse — explode after FUSE_TIME
        this.time.delayedCall(FUSE_TIME, () => {
            markTimer.remove();
            if (markG.active) markG.destroy();
            if (cdText.active) cdText.destroy();
            enemy._ignitionMarkActive = false;
            if (!enemy.sprite?.active) return;

            const ex = enemy.sprite.x, ey = enemy.sprite.y;

            // It goes off: a column of blue-white fire, a shockwave, molten chunks thrown out
            const ADD = Phaser.BlendModes.ADD;
            const col = this.add.rectangle(ex, ey - 26, 14, 64, 0xbfe0ff, 0.9).setDepth(6).setBlendMode(ADD).setOrigin(0.5, 0.9);
            this.tweens.add({ targets: col, scaleX: 2.2, scaleY: 1.4, alpha: 0, duration: 340, ease: 'Quad.easeOut', onComplete: () => col.destroy() });
            const wave = this.add.circle(ex, ey, 8, 0, 0).setStrokeStyle(3, 0x6aa8ff, 1).setDepth(6).setBlendMode(ADD);
            this.tweens.add({ targets: wave, radius: EXPLOSION_RADIUS, alpha: 0, duration: 380, ease: 'Quad.easeOut', onComplete: () => wave.destroy() });
            VisualFX.impact(this, ex, ey, 'fire', 30);
            this._vfxFlash?.(ex, ey, 90, 0x6aa8ff, 320, 0.9);
            for (let i = 0; i < 10; i++) {
                const sa = Math.random() * Math.PI * 2, d = 20 + Math.random() * 26, c = [0xffffff, 0xbfe0ff, 0x4a88ff, 0xff8a2a][i % 4];
                const ch = this.add.rectangle(ex, ey, 3, 3, c).setDepth(6).setBlendMode(ADD);
                this.tweens.add({ targets: ch, x: ex + Math.cos(sa) * d, y: ey + Math.sin(sa) * d - 10, alpha: 0, angle: 200, duration: 420, ease: 'Quad.easeOut', onComplete: () => ch.destroy() });
            }
            Sfx.play(this, 'erupt');
            this.cameras.main.shake(30, 0.003);

            // Damage + apply burn stack to detonating enemy
            if (enemy.sprite?.active && enemy.health > 0) {
                this.damageEnemy(enemy, EXPLOSION_DMG, 'fire');
                if (typeof this.applyBurnStack === 'function') this.applyBurnStack(enemy);
            }
            // Boss direct hit
            if (this.damageBossAtTile(Math.floor(ex / this.TILE_SIZE), Math.floor(ey / this.TILE_SIZE), EXPLOSION_DMG, undefined, 'fire')) {
                if (typeof this.applyBurnStackBoss === 'function') this.applyBurnStackBoss();
            }

            // AoE — damage nearby enemies and cascade ignition marks
            for (const nearby of [...this.enemies]) {
                if (this._phasedOut?.(nearby)) continue;
                if (nearby === enemy) continue;
                if (!nearby.sprite?.active || nearby.health <= 0) continue;
                const ndx = nearby.sprite.x - ex, ndy = nearby.sprite.y - ey;
                if (Math.sqrt(ndx*ndx + ndy*ndy) > EXPLOSION_RADIUS) continue;
                this.damageEnemy(nearby, EXPLOSION_DMG * 0.7, 'fire');
                if (typeof this.applyBurnStack === 'function') this.applyBurnStack(nearby);
                // Cascade — mark nearby enemies (respects max explosions per enemy)
                if (!(nearby._ignitionMarkActive)) {
                    nearby._ignitionExplosionCount = (nearby._ignitionExplosionCount || 0) + 1;
                    if (nearby._ignitionExplosionCount <= MAX_EXPLOSIONS) {
                        this._applyIgnitionMark(nearby);
                        const em = this.add.image(ex, ey, 'vfx_dot').setTint(0xbfe0ff).setBlendMode(Phaser.BlendModes.ADD).setDepth(6).setScale(1.4), f = { t: 0 }, tx = nearby.sprite.x, ty = nearby.sprite.y - 4;
                        this.tweens.add({ targets: f, t: 1, duration: 260, ease: 'Quad.easeIn', onUpdate: () => em.setPosition(ex + (tx - ex) * f.t, ey + (ty - ey) * f.t - Math.sin(f.t * Math.PI) * 22), onComplete: () => em.destroy() });   // the cascade, seen: an ember arcing to it
                    }
                }
            }
            // Boss AoE hit
            if (this.damageBossAtTile(Math.floor(ex / this.TILE_SIZE), Math.floor(ey / this.TILE_SIZE), EXPLOSION_DMG * 0.7, undefined, 'fire')) {
                if (typeof this.applyBurnStackBoss === 'function') this.applyBurnStackBoss();
            }
        });
    }

    // n stacks onto the bosses: the one given, or whichever are up (a level has one at most).
    applyBurnStackBoss(n = 1, only = null) {
        const B = this._burnCfg(), now = this.time.now;
        const vb = this.voltslimeBoss, vs = this.voidSovereignBoss;
        const add = (boss) => {
            this._burnDecay(boss, now);
            boss.burnStacks = Math.min(B.MAX, (boss.burnStacks || 0) + n); Sfx.play(this, 'ignite');
            boss.lastBurnStackTime = now;
            boss._burnDecayAt = now + B.HOLD_MS;
            boss.isBurning = true;
            this._recalcMagmaFireballCount();
            this._updateBossBurnIndicator(boss);
        };
        if ((!only || only === vb) && vb?.active && vb.hp > 0) { add(vb); this._applyBurnDoTBoss(); }
        if ((!only || only === vs) && vs?.active && vs.hp > 0 && !vs._isInvulnerable) { add(vs); this._applyBurnDoTVoidSovereign(); }
    }

    _applyBurnDoTVoidSovereign() {
        this._burnBossTicker(this.voidSovereignBoss, d => this.damageVoidSovereignBoss?.(d));
    }

    _recalcMagmaFireballCount() {
        let max = 0;
        for (const e of this.enemies) {
            if (e.sprite?.active) max = Math.max(max, e.burnStacks || 0);
        }
        // Also check bosses
        if (this.voltslimeBoss?.active) max = Math.max(max, this.voltslimeBoss.burnStacks || 0);
        if (this.voidSovereignBoss?.active) max = Math.max(max, this.voidSovereignBoss.burnStacks || 0);
        this._magmaStaffFireballCount = max > 0 ? max : undefined;
    }

    _applyBurnDoTBoss() {
        this._burnBossTicker(this.voltslimeBoss, d => this.damageVoltslimeBoss(d));
    }

    // The boss version of _applyBurnDoT: the same ticks, the same hold and decay.
    _burnBossTicker(boss, hurt) {
        if (!boss?.active || !((boss.burnStacks || 0) > 0) || boss._burnDoTTimer) return;
        const B = this._burnCfg();
        const tick = () => {
            boss._burnDoTTimer = null;
            if (!boss?.active || boss.hp <= 0) return;
            const before = boss.burnStacks;
            this._burnDecay(boss, this.time.now);
            if (boss.burnStacks !== before) { this._recalcMagmaFireballCount(); this._updateBossBurnIndicator(boss); }
            if (!(boss.burnStacks > 0)) return;
            if (!boss._isInvulnerable) {
                this._tick = true; try { hurt(B.PER_TICK[boss.burnStacks] * this.damageScaling + B.PCT_TICK[boss.burnStacks] * B.BOSS_PCT * (boss.maxHp || boss.maxHealth || 0)); } finally { this._tick = false; }   // a tick, not a hit; a boss takes BOSS_PCT of the percent part
                this.gainUltCharge(this.ultChargePerBurnTick, 'fire');
            }
            boss._burnDoTTimer = this.time.delayedCall(B.TICK_MS, tick);
        };
        boss._burnDoTTimer = this.time.delayedCall(B.TICK_MS, tick);
    }

    // Burn stack pip indicator — works for any boss object with .container/.burnStacks/.active
    _updateBossBurnIndicator(boss) {
        if (!boss?.active) return;
        // Clean old pips
        if (boss._burnStackBar) {
            for (const pip of boss._burnStackBar) { this.tweens.killTweensOf(pip); pip.destroy(); }
            boss._burnStackBar = null;
        }
        const stacks = boss.burnStacks || 0;
        if (stacks <= 0) return;
        // the same flame pips the enemies wear (CreatureFX), bigger, over the boss's bar
        boss._burnStackBar = [];
        const GAP = 8, W = 8;
        const totalW = stacks * W + (stacks - 1) * GAP;
        const bx = boss.container.x, by = boss.container.y - 130; // above HP bar
        for (let i = 0; i < stacks; i++) {
            const pip = this.textures.exists('cfx_bits') ? this.add.image(0, 0, 'cfx_bits', 'flame').setScale(1.6).setDepth(6) : this.add.circle(0, 0, 4, 0xff6a1a).setDepth(6);
            pip.x = bx - totalW/2 + i*(W+GAP) + W/2;
            pip.y = by;
            boss._burnStackBar.push(pip);
        }
    }

    // The burn's clock: one ticker per burning enemy, every TICK_MS, until its stacks run out.
    _applyBurnDoT(enemy) {
        if (!((enemy.burnStacks || 0) > 0) || enemy._burnDoTTimer) return;   // already ticking
        const B = this._burnCfg();
        const tick = () => {
            enemy._burnDoTTimer = null;
            if (!enemy.sprite?.active || enemy.health <= 0) return;
            this._burnDecay(enemy, this.time.now);
            if (!(enemy.burnStacks > 0)) { this._clearBurnStackIndicator(enemy); this._recalcMagmaFireballCount(); return; }
            // Out of the world right now (a phased sniper, a submerged drowner, one held by the
            // Displacer): no damage, but the clock runs.
            if (!this._phasedOut(enemy)) {
                const reg = Math.max(0, enemy.burnStacks - (enemy.blueBurn || 0));   // (blue stacks don't tick: they burst)
                const raw = B.PER_TICK[reg] * this.damageScaling + B.PCT_TICK[reg] * (enemy.maxHealth || 0) * (enemy.isBoss ? B.BOSS_PCT : 1);   // flat + a share of max HP; purple: resolveElementalHit
                // the escape hatch: burn is one of the ways to hurt a fire elemental
                this._tick = true; let dmg; try { dmg = this.resolveElementalHit(enemy, raw, 'fire', true); } finally { this._tick = false; }   // a tick, not a hit
                if (dmg !== null && dmg > 0) {
                    enemy.health -= dmg;
                    this.gainUltCharge(this.ultChargePerBurnTick, 'fire');
                    this._scorchHeal();   // Scorch: burn ticks heal you
                    if (enemy.sprite?.active) this.showDamageNumber(enemy.sprite.x, enemy.sprite.y - 8, dmg, enemy._purpleMarked ? '#ff44ff' : '#ff8800');
                    this.updateEnemyHealthBar(enemy);
                    if (enemy.health <= 0) { this.killEnemy(enemy); return; }
                }
            }
            enemy._burnDoTTimer = this.time.delayedCall(B.TICK_MS, tick);
        };
        enemy._burnDoTTimer = this.time.delayedCall(B.TICK_MS, tick);
    }

    _updateBurnStackIndicator(enemy) {
        if (!enemy.sprite?.active) return;
        if (enemy.isVoidSniper && enemy._sniperInvisible) return; // hide while cloaked
        this._clearBurnStackIndicator(enemy);
        const stacks = enemy.burnStacks || 0;
        if (stacks <= 0) return;
        // Color gradient: orange → deep red → bright red at max
        const colors = [0xff9900, 0xff6600, 0xff3300, 0xff1100, 0xff0000];
        enemy._burnStackBar = [];
        const GAP = 6, W = 6, H = 8;
        const totalW = stacks * W + (stacks - 1) * GAP;
        for (let i = 0; i < stacks; i++) {
            const pip = this.add.graphics().setDepth(4);
            const col = colors[i] || 0xff0000;
            // Outer glow
            pip.fillStyle(col, 0.4);
            pip.fillRect(-(W + 2) / 2, -(H + 2) / 2, W + 2, H + 2);
            // Main pip
            pip.fillStyle(col, 1.0);
            pip.fillRect(-W / 2, -H / 2, W, H);
            // Bright highlight top
            pip.fillStyle(0xffff88, 0.7);
            pip.fillRect(-W / 2 + 1, -H / 2 + 1, W - 2, 2);
            pip.x = enemy.sprite.x - totalW / 2 + i * (W + GAP) + W / 2;
            pip.y = enemy.sprite.y - 36;
            enemy._burnStackBar.push(pip);
        }
    }

    _clearBurnStackIndicator(enemy) {
        if (enemy._burnStackBar) {
            for (const pip of enemy._burnStackBar) { this.tweens.killTweensOf(pip); pip.destroy(); }
            enemy._burnStackBar = null;
        }
    }

    // Magma Surge (R): dumps the staff's stored heat. Everything round you is thrown back and
    // set burning, and a wave of lava rolls outward. More heat, a bigger surge: radius 2-5,
    // knockback 1-3 tiles, 1-3 burn stacks, lava that lasts longer. The heat goes to 0, so the
    // staff drops back to its first tier: spending it is the trade.
    magmaStaffRipple() {
        if (this._magmaRippleReady !== true) return;
        const f = Math.min(1, (this._magmaHeat || 0) / this._magmaCfg().HEAT_MAX);
        this._magmaHeat = 0;
        this._magmaRippleReady = false;
        this._magmaSurgeCdUntil = this.time.now + 1000;
        this._updateMagmaRippleBar();

        const playerPx = this.playerX * this.TILE_SIZE + this.TILE_SIZE / 2;
        const playerPy = this.playerY * this.TILE_SIZE + this.TILE_SIZE / 2;
        const RADIUS    = 2 + Math.round(3 * f);  // tiles
        const KNOCKBACK = 1 + Math.round(2 * f);  // tiles
        const STACKS    = 1 + Math.round(2 * f);
        const RING_INTERVAL = 80;  // ms between each ring wave
        const RING_LIFE     = Math.round(700 + 1500 * f); // ms each lava ring tile stays

        // ── Wave ring — one ring at a time, each briefly lit then gone ──
        for (let r = 1; r <= RADIUS; r++) {
            this.time.delayedCall(r * RING_INTERVAL, () => {
                if (this._deathScreenActive) return;
                // Spawn this ring's lava tiles
                const ringTiles = [];
                for (let dx = -r; dx <= r; dx++) {
                    for (let dy = -r; dy <= r; dy++) {
                        const dist = Math.sqrt(dx * dx + dy * dy);
                        if (dist < r - 0.6 || dist > r + 0.6) continue;
                        const tx = this.playerX + dx;
                        const ty = this.playerY + dy;
                        if (tx < 0 || tx >= this.WORLD_WIDTH || ty < 0 || ty >= this.WORLD_HEIGHT) continue;
                        if (this.world[tx][ty] !== this.FLOOR) continue;
                        ringTiles.push(this.spawnIgnitionTrail(
                            tx * this.TILE_SIZE + this.TILE_SIZE / 2,
                            ty * this.TILE_SIZE + this.TILE_SIZE / 2,
                            RING_LIFE
                        ));
                    }
                }
            });
        }

        // Shockwave visual
        const wave = this.add.graphics().setDepth(4).setPosition(playerPx, playerPy);
        wave.lineStyle(4, 0xff6600, 0.9); wave.strokeCircle(0, 0, 12);
        this.tweens.add({ targets: wave, scaleX: RADIUS * 2.4, scaleY: RADIUS * 2.4, alpha: 0, duration: 380, ease: 'Quad.easeOut', onComplete: () => wave.destroy() });
        const core = this.add.circle(playerPx, playerPy, 16, 0xffaa00, 0.7).setDepth(4);
        this.tweens.add({ targets: core, radius: 40, alpha: 0, duration: 200, onComplete: () => core.destroy() });
        this.cameras.main.shake(120, 0.009);

        // Fling nearby enemies
        for (const enemy of [...this.enemies]) {
            if (this._phasedOut?.(enemy)) continue;
            if (!enemy.sprite?.active) continue;
            const eDist = Math.abs(enemy.x - this.playerX) + Math.abs(enemy.y - this.playerY);
            if (eDist > RADIUS) continue;
            if (enemy.iceImmune || enemy.elementImmune) continue;

            const kbDirX = enemy.x - this.playerX || (Math.random() > 0.5 ? 1 : -1);
            const kbDirY = enemy.y - this.playerY;
            const kbLen  = Math.sqrt(kbDirX * kbDirX + kbDirY * kbDirY) || 1;
            const normX = kbDirX / kbLen, normY = kbDirY / kbLen;

            let landX = enemy.x, landY = enemy.y;
            for (let step = 1; step <= KNOCKBACK; step++) {
                const tx = Math.round(enemy.x + normX * step);
                const ty = Math.round(enemy.y + normY * step);
                if (tx < 0 || tx >= this.WORLD_WIDTH || ty < 0 || ty >= this.WORLD_HEIGHT) break;
                if (this.world[tx][ty] !== this.FLOOR) break;
                if (this.getEnemyAt(tx, ty)) break;
                landX = tx; landY = ty;
            }

            const targetPx = landX * this.TILE_SIZE + this.TILE_SIZE / 2;
            const targetPy = landY * this.TILE_SIZE + this.TILE_SIZE / 2 + this.SLIME_Y_OFFSET;
            const peakY    = Math.min(enemy.sprite.y, targetPy) - 22;

            // Update tile immediately so other enemies don't pathfind to the same tile
            enemy.x = landX; enemy.y = landY;
            // Long stun — covers full arc duration + brief settle time
            enemy.isStunned = true;
            enemy.stunnedUntil = Math.max(enemy.stunnedUntil || 0, this.time.now + 800);
            // Flag to suppress pathfinding target recalculation during arc
            enemy._surgeKnockedBack = true;
            this.time.delayedCall(850, () => { if (enemy.sprite?.active) enemy._surgeKnockedBack = false; });

            // Fling arc: squish up then arc to landing
            this.tweens.killTweensOf(enemy.sprite);
            this.tweens.add({
                targets: enemy.sprite,
                y: peakY,
                scaleX: this.SLIME_SCALE * 0.75, scaleY: this.SLIME_SCALE * 1.35,
                duration: 110, ease: 'Quad.easeOut',
                onComplete: () => {
                    if (!enemy.sprite?.active) return;
                    this.tweens.add({
                        targets: enemy.sprite, x: targetPx, y: targetPy,
                        scaleX: this.SLIME_SCALE * 1.25, scaleY: this.SLIME_SCALE * 0.7,
                        duration: 180, ease: 'Quad.easeIn',
                        onComplete: () => {
                            if (!enemy.sprite?.active) return;
                            this.tweens.add({
                                targets: enemy.sprite,
                                scaleX: this.SLIME_SCALE, scaleY: this.SLIME_SCALE,
                                duration: 100, ease: 'Back.easeOut'
                            });
                            this.updateEnemyHealthBar(enemy);
                        }
                    });
                }
            });

            this.applyBurnStack(enemy, STACKS);   // the Surge: 1-3 stacks, by the heat spent
        }

        this.showStatusText(playerPx, playerPy - 30, 'MAGMA SURGE!', '#ff8800');
    }

    _updateMagmaOrbs(time) {
        const isStaff = this.currentElement === 'fire' &&
            (this.equippedWeapons?.fire || 'flame_fists') === 'magma_staff';
        // Orbiting orbs are the tier readout, so they follow heat like everything else.
        const count = isStaff ? this._magmaTier() : 0;

        // Rebuild orbs if count changed
        if (this._magmaOrbCount !== count) {
            this._magmaOrbCount = count;
            // Destroy existing
            if (this._magmaOrbGraphics) {
                for (const g of this._magmaOrbGraphics) { this.tweens.killTweensOf(g); g.destroy(); }
            }
            this._magmaOrbGraphics = [];
            if (count > 0) {
                for (let i = 0; i < count; i++) {
                    // a little lava rock (magmaRockKey), bigger and hotter with the heat
                    const key = WeaponSystem.magmaRockKey(this, i % WeaponSystem.MAGMA_VARIANTS);
                    const g = this.add.container(0, 0).setDepth(5);
                    const glow = this.add.image(0, 0, 'vfx_glow').setTint(count <= 2 ? 0xff7a1a : count <= 4 ? 0xff4a10 : 0xff2200).setBlendMode(Phaser.BlendModes.ADD).setScale(0.12 + count * 0.02).setAlpha(0.8);
                    const rock = this.add.sprite(0, 0, key, String(i % 4)).setScale(0.55 + count * 0.07);
                    if (this.anims.exists(key)) rock.play({ key, startFrame: i % 4 });
                    g.add([glow, rock]); g._rock = rock;
                    this._magmaOrbGraphics.push(g);
                }
            }
        }

        if (!this._magmaOrbGraphics?.length) return;

        const px = this.player.x, py = this.player.y;
        const ORBIT_R   = 18 + this._magmaOrbCount * 2; // orbit radius grows with count
        const SPEED     = 0.0025 + this._magmaOrbCount * 0.0004; // spins faster at higher stacks
        const baseAngle = time * SPEED;

        for (let i = 0; i < this._magmaOrbGraphics.length; i++) {
            const g = this._magmaOrbGraphics[i];
            if (!g?.active) continue;
            const angle = baseAngle + (i / this._magmaOrbCount) * Math.PI * 2;
            g.x = px + Math.cos(angle) * ORBIT_R;
            g.y = py + Math.sin(angle) * ORBIT_R;
            if (g._rock) g._rock.rotation = angle * 1.7 + i;
            // Pulse alpha with a slight phase offset per orb
            g.alpha = 0.7 + Math.sin(time * 0.006 + i * 1.2) * 0.3;
        }
    }

    _updateMagmaRippleBar() {
        const isStaff = this.currentElement === 'fire' &&
            (this.equippedWeapons?.fire || 'flame_fists') === 'magma_staff';
        if (!isStaff) {
            if (this._magmaRippleBarBg)    { this._magmaRippleBarBg.destroy();    this._magmaRippleBarBg    = null; }
            if (this._magmaRippleBarFill)  { this._magmaRippleBarFill.destroy();  this._magmaRippleBarFill  = null; }
            if (this._magmaRippleLabel)    { this._magmaRippleLabel.destroy();    this._magmaRippleLabel    = null; }
            return;
        }
        const px = this.player.x, py = this.player.y - 18;
        const BAR_W = 40, BAR_H = 4;
        const pct   = Math.min((this._magmaHeat || 0) / this._magmaCfg().HEAT_MAX, 1);   // the heat the Surge would dump
        const ready = this._magmaRippleReady === true;

        if (!this._magmaRippleBarBg?.active) {   // (dead after a floor change)
            this._magmaRippleBarBg   = this.add.graphics().setDepth(5.6);
            this._magmaRippleLabel   = this.add.text(px, py + 7, `SURGE [${Settings.label(Settings.key('surge'))}]`, {
                fontSize: '8px', fontFamily: UIKit.FONT.title, fontStyle: 'bold', color: '#ff8844',
                stroke: '#1a0806', strokeThickness: 3, resolution: 2
            }).setOrigin(0.5, 0).setDepth(5.7);
        }
        UIKit.rBar(this._magmaRippleBarBg.clear(), px - BAR_W / 2 + 4, py - 3, BAR_W, pct, { col: 0xff5a14, hot: 0xffc060, dark: 0x1a0806, time: this.time.now, ready });
        this._magmaRippleLabel.x   = px; this._magmaRippleLabel.y   = py + 7;
        this._magmaRippleLabel.setColor(ready ? '#ffcc44' : '#ff8844');
    }

    _magmaExplosion(centerTileX, centerTileY, damage, lavaShort = 2000, lavaLong = 9000) {
        const cpx = centerTileX * this.TILE_SIZE + this.TILE_SIZE / 2;
        const cpy = centerTileY * this.TILE_SIZE + this.TILE_SIZE / 2;

        // Outer ring
        const ring = this.add.circle(cpx, cpy, 8, 0xff4400, 0).setDepth(5);
        ring.setStrokeStyle(4, 0xff8800, 1);
        this.tweens.add({ targets: ring, radius: this.TILE_SIZE * 3.5, alpha: 0, duration: 380, ease: 'Quad.easeOut', onComplete: () => ring.destroy() });

        // Core flash
        VisualFX.impact(this, cpx, cpy, 'fire', this.TILE_SIZE * 1.8);
        this._vfxFlash?.(cpx, cpy, this.TILE_SIZE * 4, 0xff8a2a, 320, 0.8);

        // Debris
        for (let i = 0; i < 16; i++) {
            const angle = (i / 16) * Math.PI * 2 + Math.random() * 0.3;
            const spd = 1.5 + Math.random() * 2.5;
            const debris = this.add.rectangle(cpx, cpy, 6, 6, i % 2 === 0 ? 0xff4400 : 0xffcc44, 1).setDepth(4);
            this.tweens.add({ targets: debris, x: cpx + Math.cos(angle) * spd * this.TILE_SIZE, y: cpy + Math.sin(angle) * spd * this.TILE_SIZE, alpha: 0, scaleX: 0.2, scaleY: 0.2, duration: 400 + Math.random() * 200, ease: 'Quad.easeOut', onComplete: () => debris.destroy() });
        }

        this.cameras.main.shake(200, 0.012);

        // Circular explosion — radius 2.5 tiles, tiles animate outward from centre
        const EXP_RADIUS = 2.5;
        const EXP_SCAN   = Math.ceil(EXP_RADIUS);
        const hitEnemies = new Set();

        for (let ox = -EXP_SCAN; ox <= EXP_SCAN; ox++) {
            for (let oy = -EXP_SCAN; oy <= EXP_SCAN; oy++) {
                const dist = Math.sqrt(ox * ox + oy * oy);
                if (dist > EXP_RADIUS) continue;
                const tx = centerTileX + ox, ty = centerTileY + oy;
                if (tx < 0 || tx >= this.WORLD_WIDTH || ty < 0 || ty >= this.WORLD_HEIGHT) continue;
                if (!this.world[tx] || this.world[tx][ty] !== this.FLOOR) continue;

                // Delay proportional to distance so wave expands outward
                const waveDelay = (dist / EXP_RADIUS) * 180;

                this.time.delayedCall(waveDelay, () => {
                    if (this._deathScreenActive) return;
                    const tpx = tx * this.TILE_SIZE + this.TILE_SIZE / 2;
                    const tpy = ty * this.TILE_SIZE + this.TILE_SIZE / 2;
                    this.spawnIgnitionTrail(tpx, tpy, lavaShort);

                    const ef = this.add.graphics().setDepth(2.5);
                    ef.fillStyle(0xff4400, 0.75);
                    ef.fillRect(tx * this.TILE_SIZE, ty * this.TILE_SIZE, this.TILE_SIZE, this.TILE_SIZE);
                    ef.fillStyle(0xffdd44, 0.4);
                    ef.fillRect(tx * this.TILE_SIZE + 3, ty * this.TILE_SIZE + 3, this.TILE_SIZE - 6, this.TILE_SIZE - 6);
                    this.tweens.add({ targets: ef, alpha: 0, duration: 300, onComplete: () => ef.destroy() });

                    // Damage queen spawner on this tile
                    const portalOnTile = this.getPortalAt(tx, ty);
                    if (portalOnTile) this.damagePortal(portalOnTile, damage);
                    this.damageBossAtTile(tx, ty, damage);

                    for (const enemy of [...this.enemies]) {
                        if (enemy.x !== tx || enemy.y !== ty || hitEnemies.has(enemy)) continue;
                        hitEnemies.add(enemy);
                        if (enemy.iceImmune || enemy.fireImmune || enemy.elementImmune) {
                            const imCol = enemy.iceImmune ? '#88eeff' : '#ff8844';
                            this.showStatusText(enemy.sprite.x, enemy.sprite.y - 10, 'IMMUNE', imCol);
                            if (enemy.iceImmune && this.isIceTutorial) this._triggerIceImmuneGlerpReaction();
                            continue;
                        }
                        if (this._roomGated() && enemy.tutorialRoomIndex !== undefined &&
                            enemy.tutorialRoomIndex !== this.getCurrentPlayerRoom()) continue;
                        if (this._phasedOut(enemy)) continue;   // phased out: not in the world
                        const _rd4467 = this.resolveElementalHit(enemy, damage, 'fire');
                        if (_rd4467 === null) continue;
                        enemy.health -= _rd4467;
                        this.showDamageNumber(enemy.sprite.x, enemy.sprite.y - 10, _rd4467, '#ffffff');
                        this.updateEnemyHealthBar(enemy);
                        if (enemy.health <= 0) this.killEnemy(enemy);
                    }
                });
            }
        }

        // ── Lava rock scatter: 2-4 rocks land on random tiles within 10×10 ─
        const rockCount = 2 + Math.floor(Math.random() * 3);
        const rockDmg = 20 * this.damageScaling;
        for (let r = 0; r < rockCount; r++) {
            let landTileX, landTileY, attempts = 0;
            do {
                landTileX = centerTileX + Math.floor(Math.random() * 11) - 5;
                landTileY = centerTileY + Math.floor(Math.random() * 11) - 5;
                attempts++;
                const distFromCentre = Math.abs(landTileX - centerTileX) + Math.abs(landTileY - centerTileY);
            } while (
                attempts < 30 &&
                (landTileX < 0 || landTileX >= this.WORLD_WIDTH ||
                 landTileY < 0 || landTileY >= this.WORLD_HEIGHT ||
                 this.world[landTileX]?.[landTileY] !== this.FLOOR ||
                 // exclude within 3 Manhattan tiles of explosion — must land outside the pool
                 Math.abs(landTileX - centerTileX) + Math.abs(landTileY - centerTileY) <= 3)
            );
            if (attempts >= 30) continue;

            const landPx = landTileX * this.TILE_SIZE + this.TILE_SIZE / 2;
            const landPy = landTileY * this.TILE_SIZE + this.TILE_SIZE / 2;

            // Stagger each rock's flight slightly
            const flightDelay = r * 120 + Math.random() * 80;
            const flightDur   = 380 + Math.random() * 160;

            // Shadow on ground showing where it will land
            const shadow = this.add.ellipse(landPx, landPy + 6, 18, 8, 0x000000, 0.45).setDepth(0.4);
            this.tweens.add({ targets: shadow, scaleX: 0.3, scaleY: 0.3, alpha: 0, duration: flightDelay + flightDur, onComplete: () => shadow.destroy() });

            // The rock itself — starts above explosion centre, arcs down to land tile
            this.time.delayedCall(flightDelay, () => {
                if (this._deathScreenActive) return;

                const rock = this.add.graphics().setDepth(6);
                rock.fillStyle(0xcc3300, 1);
                rock.fillCircle(0, 0, 7);
                rock.fillStyle(0xff6600, 0.7);
                rock.fillCircle(-2, -2, 4);
                rock.fillStyle(0xffaa44, 0.5);
                rock.fillCircle(-3, -3, 2);
                rock.x = cpx + (Math.random() - 0.5) * 10;
                rock.y = cpy - 8;

                // Arc: tween x to land, y goes up then down via two chained tweens
                const peakY = Math.min(rock.y, landPy) - 40 - Math.random() * 30;

                this.tweens.add({
                    targets: rock,
                    x: landPx, y: peakY,
                    duration: flightDur * 0.45,
                    ease: 'Quad.easeOut',
                    onComplete: () => {
                        this.tweens.add({
                            targets: rock,
                            y: landPy,
                            duration: flightDur * 0.55,
                            ease: 'Quad.easeIn',
                            onComplete: () => {
                                rock.destroy();
                                // Impact flash
                                const impact = this.add.circle(landPx, landPy, 6, 0xff4400, 0.85).setDepth(5);
                                this.tweens.add({ targets: impact, radius: 18, alpha: 0, duration: 220, onComplete: () => impact.destroy() });
                                // Small shake
                                this.cameras.main.shake(60, 0.004);
                                // Lava tile — long duration for rock craters
                                this.spawnIgnitionTrail(landPx, landPy, lavaLong);
                                // Damage queen spawner on landing tile
                                const rockPortal = this.getPortalAt(landTileX, landTileY);
                                if (rockPortal) this.damagePortal(rockPortal, rockDmg);
                                this.damageBossAtTile(landTileX, landTileY, rockDmg);
                                // Damage enemies on landing tile
                                for (const enemy of [...this.enemies]) {
                                    if (enemy.x !== landTileX || enemy.y !== landTileY) continue;
                                    if (enemy.iceImmune || enemy.fireImmune || enemy.elementImmune) continue;
                                    if (this._roomGated() && enemy.tutorialRoomIndex !== undefined &&
                                        enemy.tutorialRoomIndex !== this.getCurrentPlayerRoom()) continue;
                                    if (this._phasedOut(enemy)) continue;   // phased out: not in the world
                                    const _rd4555 = this.resolveElementalHit(enemy, rockDmg, 'fire');
                                    if (_rd4555 === null) continue;
                                    enemy.health -= _rd4555;
                                    this.showDamageNumber(enemy.sprite.x, enemy.sprite.y - 10, _rd4555, '#ff8800');
                                    this.updateEnemyHealthBar(enemy);
                                    if (enemy.health <= 0) this.killEnemy(enemy);
                                }
                            }
                        });
                    }
                });

                // Rotation as it flies
                this.tweens.add({ targets: rock, angle: 360 * (Math.random() > 0.5 ? 1 : -1), duration: flightDur, ease: 'Linear' });
            });
        }
    }

    shootFireball(targetX, targetY) {
        const worldX = targetX + this.cameras.main.scrollX;
        const worldY = targetY + this.cameras.main.scrollY;

        const playerPixelX = this._shotX();   // where the slime is drawn (mid-dash it's still on its way)
        const playerPixelY = this._shotY();

        const dx = worldX - playerPixelX;
        const dy = worldY - playerPixelY;
        const distance = Math.sqrt(dx * dx + dy * dy);

        if (distance === 0) return;

        const dirX = dx / distance;
        const dirY = dy / distance;

        // Create container for fireball
        const container = this.add.container(playerPixelX, playerPixelY);

        // Graphics for the entire fireball (core + streaming particles)
        const fireGraphics = this.add.graphics();
        fireGraphics.setDepth(1.5);
        container.add(fireGraphics);
        container.setDepth(2);

        const fireball = container;

        this.fireballs.push({
            sprite: fireball,
            fireGraphics,
            vx: dirX * this.fireballSpeed,
            vy: dirY * this.fireballSpeed,
            damage: this.baseFireballDamage * this.damageScaling,
            piercedEnemies: new Set(),
            dirX, dirY,
            startX: playerPixelX,
            startY: playerPixelY,
            splitCount: 0,
            createdAt: this.time.now,
            lastFlameTime: this.time.now
        });
    }

    shootIceShard(targetX, targetY) {
        const worldX = targetX + this.cameras.main.scrollX;
        const worldY = targetY + this.cameras.main.scrollY;
        const playerPixelX = this._shotX();   // where the slime is drawn (mid-dash it's still on its way)
        const playerPixelY = this._shotY();

        const dx = worldX - playerPixelX;
        const dy = worldY - playerPixelY;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist === 0) return;

        const vx = (dx / dist) * this.iceShardSpeed;
        const vy = (dy / dist) * this.iceShardSpeed;
        const angle = Math.atan2(vy, vx);

        const isBlock = Math.random() < this.iceBlockChance;

        let sprite;
        if (isBlock) {
            // Ice block — chunky diamond, solid pixel-art style
            const g = this.add.graphics().setDepth(1);
            g.x = playerPixelX;
            g.y = playerPixelY;

            // Shadow body
            g.fillStyle(0x1155aa, 0.95);
            g.beginPath();
            g.moveTo(0, -13); g.lineTo(11, 0); g.lineTo(0, 13); g.lineTo(-11, 0);
            g.closePath(); g.fillPath();

            // Lit face (top-left)
            g.fillStyle(0x44aadd, 0.80);
            g.beginPath();
            g.moveTo(0, -13); g.lineTo(-11, 0); g.lineTo(0, 0);
            g.closePath(); g.fillPath();

            // Inner cross-hatch detail
            g.lineStyle(1, 0xaaddff, 0.50);
            g.beginPath(); g.moveTo(-6, 0); g.lineTo(6, 0); g.strokePath();
            g.beginPath(); g.moveTo(0, -6); g.lineTo(0, 6); g.strokePath();

            // Bright white outline
            g.lineStyle(2, 0xddf0ff, 0.95);
            g.beginPath();
            g.moveTo(0, -13); g.lineTo(11, 0); g.lineTo(0, 13); g.lineTo(-11, 0);
            g.closePath(); g.strokePath();

            // White corner sparks
            g.fillStyle(0xffffff, 1.0);
            g.fillRect(-1.5, -14, 3, 3);
            g.fillRect(-1.5, 11, 3, 3);

            g._glow = null;
            sprite = g;
        } else {
            // Small regular ice shard — slim pointed needle
            const g = this.add.graphics().setDepth(1);
            g.x = playerPixelX;
            g.y = playerPixelY;
            g.rotation = angle + Math.PI / 2;

            // Body
            g.fillStyle(0x2277cc, 1.0);
            g.beginPath();
            g.moveTo(0, -9); g.lineTo(3, -1); g.lineTo(2, 5); g.lineTo(-2, 5); g.lineTo(-3, -1);
            g.closePath(); g.fillPath();

            // Lit face
            g.fillStyle(0x55aaee, 0.65);
            g.beginPath();
            g.moveTo(0, -9); g.lineTo(-3, -1); g.lineTo(-2, 5); g.lineTo(0, 4);
            g.closePath(); g.fillPath();

            // White tip
            g.fillStyle(0xffffff, 1.0);
            g.beginPath();
            g.moveTo(0, -9); g.lineTo(1.5, -5); g.lineTo(-1.5, -5);
            g.closePath(); g.fillPath();

            // Outline
            g.lineStyle(1, 0x88ccff, 0.80);
            g.beginPath();
            g.moveTo(0, -9); g.lineTo(3, -1); g.lineTo(2, 5); g.lineTo(-2, 5); g.lineTo(-3, -1);
            g.closePath(); g.strokePath();

            sprite = g;
        }

        // Frost trail: tiny particles left behind
        this.iceShards.push({
            sprite,
            vx, vy,
            prevX: sprite.x,
            prevY: sprite.y,
            startX: sprite.x,
            startY: sprite.y,
            isBlock,
            bounces: 0,
            damage: isBlock ? this.iceBlockDamage * this.damageScaling : this.iceShardDamage * this.damageScaling,
            lastTrailTime: 0,
            hitEnemies: new Set()
        });
    }

    spawnIceShardProjectile(x, y, vx, vy, damage, angle) {
        // Create a slim shard graphic for the scatter wave
        const g = this.add.graphics().setDepth(3);
        g.x = x; g.y = y;
        g.setRotation(angle);

        // Slim elongated crystal — brighter and longer than normal shards
        g.fillStyle(0xaaeeff, 0.9);
        g.beginPath();
        g.moveTo(0, -10); g.lineTo(3, -3); g.lineTo(3, 5);
        g.lineTo(0, 10);  g.lineTo(-3, 5); g.lineTo(-3, -3);
        g.closePath(); g.fillPath();
        g.lineStyle(1.5, 0xffffff, 1); g.strokePath();
        // Ice gleam
        g.lineStyle(1, 0xeeffff, 0.7);
        g.beginPath(); g.moveTo(0, -6); g.lineTo(1.5, 0); g.lineTo(0, 6); g.strokePath();

        this.iceShards.push({
            sprite: g,
            vx, vy,
            prevX: x, prevY: y,
            isBlock: false,
            bounces: 0,
            damage,
            lastTrailTime: 0,
            hitEnemies: new Set(),
            isTsunamiScatter: true   // flag — no freeze chance override
        });
    }

    updateIceShards(delta, sub = false) {
        // A shard moves at most half a tile a step: a long frame (a dip to 15 FPS) runs as several, or the Fractal Shard's spike
        // (900 px/s) jumped two tiles a frame and flew through the enemy it was aimed at.
        if (!sub && this.iceShards.length) {
            let v = 0; for (const q of this.iceShards) v = Math.max(v, Math.hypot(q.vx || 0, q.vy || 0));
            const steps = Math.min(6, Math.ceil(v * delta / 1000 / (this.TILE_SIZE * 0.5)) || 1);
            if (steps > 1) { for (let k = 0; k < steps; k++) this.updateIceShards(delta / steps, true); return; }
        }
        const ds = delta / 1000;
        const time = this.time.now;

        for (let i = this.iceShards.length - 1; i >= 0; i--) {
            const s = this.iceShards[i];

            // Max range check — cannon shards, heal shards, and heal splinters
            // travel until they hit a wall; only the original bouncing shards and
            // tsunami scatter keep a distance cap.
            if (s.startX && s.startY &&
                (!s.isCannonShard || s._range) && !s.isHealShard && !s.isHealSplinter) {
                const distTraveled = Math.sqrt(
                    Math.pow(s.sprite.x - s.startX, 2) +
                    Math.pow(s.sprite.y - s.startY, 2)
                );
                const maxRange = s._range || (s.isPierceSpike ? 20 * this.TILE_SIZE : 12 * this.TILE_SIZE);   // the spike: the longest reach (14 till 2026-10-20)
                if (distTraveled > maxRange) {
                    // The centre spike plants its totem where it runs out, so the pillar lands at
                    // the far end of the lane you swept rather than at your feet.
                    // Attack 1 always leaves a totem, even on a clean miss: _spawnFrostTotem
                    // normally fires on the spike's FIRST enemy hit, so a spike that connected
                    // with nothing would otherwise leave nothing behind.
                    if (s._plantsTotem && !s.hitEnemies?.size) {
                        this._spawnFrostTotem(s.sprite.x, s.sprite.y);
                    }
                    this.destroyIceShard(s);
                    this.iceShards.splice(i, 1);
                    continue;
                }
            }

            // Store previous position before moving
            const oldX = s.sprite.x;
            const oldY = s.sprite.y;

            // Homing — heal shards in heal mode steer toward nearest enemy
            if (s.isHoming && this.enemies?.length) {
                let nearestDist = Infinity, nearestEnemy = null;
                for (const e of this.enemies) {
                    if (this._phasedOut?.(e)) continue;
                    if (!e.sprite?.active) continue;
                    const dx = e.sprite.x - s.sprite.x;
                    const dy = e.sprite.y - s.sprite.y;
                    const d = dx * dx + dy * dy;
                    if (d < nearestDist) { nearestDist = d; nearestEnemy = e; }
                }
                if (nearestEnemy) {
                    const dx = nearestEnemy.sprite.x - s.sprite.x;
                    const dy = nearestEnemy.sprite.y - s.sprite.y;
                    const dist = Math.sqrt(nearestDist) || 1;
                    const TURN = 900; // steering force px/s²
                    s.vx += (dx / dist) * TURN * ds;
                    s.vy += (dy / dist) * TURN * ds;
                    // Clamp to original speed
                    const spd = Math.sqrt(s.vx * s.vx + s.vy * s.vy);
                    const MAX_SPD = 260;
                    if (spd > MAX_SPD) { s.vx = (s.vx / spd) * MAX_SPD; s.vy = (s.vy / spd) * MAX_SPD; }
                }
            }

            // Move
            s.sprite.x += s.vx * ds;
            s.sprite.y += s.vy * ds;

            // Crack shrink — pierces, no effect on projectile flight (Level 4)
            this._checkProjectileCrackShrink(s.sprite.x, s.sprite.y);
            // Spinning pellets — rotate container (graphics drawn once at creation)
            if (s.rotSpeed) s.sprite.rotation += s.rotSpeed * ds;
            if (s.sprite._glow)     { s.sprite._glow.x = s.sprite.x; s.sprite._glow.y = s.sprite.y; }
            if (s.sprite._innerOrb) { s.sprite._innerOrb.x = s.sprite.x; s.sprite._innerOrb.y = s.sprite.y; }

            // Frost trail
            if (time - s.lastTrailTime > 60) {
                s.lastTrailTime = time;
                if (s.isHealShard) {
                    // ── Rich crystalline heal-icicle trail ──
                    const ta = Math.atan2(s.vy, s.vx);
                    const tg = this.add.graphics().setDepth(1.2);
                    tg.x = s.sprite.x;
                    tg.y = s.sprite.y;
                    tg.rotation = ta + Math.PI / 2;
                    const ts = 0.35 + Math.random() * 0.3;
                    const tLen = 10 * ts, tWid = 3.5 * ts;
                    tg.fillStyle(0x00ee77, 0.70);
                    tg.beginPath();
                    tg.moveTo(0,     -tLen);
                    tg.lineTo( tWid,  0);
                    tg.lineTo( tWid * 0.6,  tLen * 0.5);
                    tg.lineTo(-tWid * 0.6,  tLen * 0.5);
                    tg.lineTo(-tWid,  0);
                    tg.closePath();
                    tg.fillPath();
                    tg.lineStyle(0.8, 0x88ffcc, 0.6);
                    tg.strokePath();
                    this.tweens.add({
                        targets: tg, alpha: 0, scaleX: 0.4, scaleY: 0.4,
                        duration: 380 + Math.random() * 120, ease: 'Quad.easeIn',
                        onComplete: () => tg.destroy()
                    });
                    // Tiny sparkle dot
                    const sx = s.sprite.x + (Math.random() - 0.5) * 8;
                    const sy = s.sprite.y + (Math.random() - 0.5) * 8;
                    const sp = this.add.graphics().setDepth(1.5);
                    sp.x = sx; sp.y = sy;
                    sp.fillStyle(Math.random() > 0.5 ? 0xccffdd : 0x00ff99, 0.9);
                    const ss = 1.2 + Math.random() * 1.8;
                    sp.fillRect(-ss, -ss, ss * 2, ss * 2);
                    this.tweens.add({
                        targets: sp, alpha: 0, scaleX: 0, scaleY: 0,
                        duration: 260 + Math.random() * 100, ease: 'Cubic.easeOut',
                        onComplete: () => sp.destroy()
                    });
                } else if (s.isCannonShard) {
                    // Ice chip trail — tiny shard fragment spinning behind the pellet
                    const trailCol = s.isHealShot ? 0x44dd99 : (Math.random() > 0.5 ? 0x55aaee : 0x88ccff);
                    const tg = this.add.graphics().setDepth(1.5);
                    tg.x = s.sprite.x + (Math.random() - 0.5) * 3;
                    tg.y = s.sprite.y + (Math.random() - 0.5) * 3;
                    const ts = 1.0 + Math.random() * 1.2;
                    tg.fillStyle(trailCol, 0.75);
                    tg.beginPath(); tg.moveTo(0,-ts*2); tg.lineTo(ts,0); tg.lineTo(0,ts*2); tg.lineTo(-ts,0); tg.closePath(); tg.fillPath();
                    tg.fillStyle(0xffffff, 0.50); tg.fillCircle(-ts*0.3, -ts*0.5, ts*0.35);
                    tg.setRotation(Math.random() * Math.PI * 2);
                    this.tweens.add({ targets: tg, alpha: 0, scaleX: 0.2, scaleY: 0.2, rotation: tg.rotation + (Math.random() > 0.5 ? 2 : -2), duration: 200 + Math.random() * 80, ease: 'Cubic.easeOut', onComplete: () => tg.destroy() });
                } else {
                    const t = this.add.rectangle(s.sprite.x, s.sprite.y, 4, 4, 0xaaddff, 0.5);
                    t.setDepth(0.5);
                    this.tweens.add({ targets: t, alpha: 0, scaleX: 0.3, scaleY: 0.3, duration: 300, onComplete: () => t.destroy() });
                }
            }

            const tileX = Math.floor(s.sprite.x / this.TILE_SIZE);
            const tileY = Math.floor(s.sprite.y / this.TILE_SIZE);

            // ── Boss pixel-radius hit check (all shard types) ────────────────
            // damageBossAtTile uses a coarse tile-distance check and misses most
            // shard hits since shards move at pixel level. Check pixel distance
            // against the boss's actual hitbox radius so shards are consumed on hit.
            if (this.voltslimeBoss?.active) {
                const boss = this.voltslimeBoss;
                const bpx = boss.container.x;
                const bpy = boss.container.y;
                const BOSS_HIT_RADIUS = 40;
                const bdx = s.sprite.x - bpx;
                const bdy = s.sprite.y - bpy;
                s._hitBossThisFrame = false;

                if (bdx * bdx + bdy * bdy < BOSS_HIT_RADIUS * BOSS_HIT_RADIUS) {
                    // Each shard gets a unique ID — boss tracks which shards have already hit
                    if (!s._id) s._id = Math.random().toString(36).slice(2);
                    if (!boss._hitShards) boss._hitShards = new Set();
                    if (!boss._frozenByShards) boss._frozenByShards = new Set();

                    if (!boss._hitShards.has(s._id)) {
                        boss._hitShards.add(s._id);
                        s._hitBossThisFrame = true;

                        const wasAlreadyFrozen = boss._isFrozen;

                        // Pierce spike and block shards instant-freeze; splitters only shatter
                        if (!s.isSplitter) {
                            if (typeof this.freezeBossFromIceWeapon === 'function') {
                                this.freezeBossFromIceWeapon(!!s.isBlock || !!s.isPierceSpike);
                            }
                        }

                        const justFroze = !wasAlreadyFrozen && boss._isFrozen;
                        if (justFroze) {
                            // Remember this shard froze the boss — it can't shatter it
                            boss._frozenByShards.add(s._id);
                            // Don't deal damage the frame we froze
                        } else if (!boss._frozenByShards.has(s._id)) {
                            // Splitters: shatter if frozen, else normal damage
                            if (s.isSplitter && !boss._isFrozen) {
                                // Normal splitter damage — no freeze
                                this.damageVoltslimeBoss(s.damage * this._volleyMult(this._bossVolleyKey(), s.volleyId));
                            } else {
                                this.damageVoltslimeBoss(s.damage * this._volleyMult(this._bossVolleyKey(), s.volleyId));
                            }
                        }

                        this.spawnBounceImpact(s.sprite.x, s.sprite.y);

                        // Only non-piercing shards are consumed
                        if (!s.isPierceSpike && !s.isHealShard && !s.isSplitter) {
                            this.destroyIceShard(s);
                            this.iceShards.splice(i, 1);
                            continue;
                        }
                    }
                }
            }

            // ── Void Sovereign pixel-radius hit check (mirrors voltslime above) ──
            if (this.voidSovereignBoss?.active && !this.voidSovereignBoss._isInvulnerable) {
                const vboss = this.voidSovereignBoss;
                const vpx = vboss.container.x;
                const vpy = vboss.container.y;
                const VBOSS_HIT_RADIUS = 48;
                const vdx = s.sprite.x - vpx;
                const vdy = s.sprite.y - vpy;

                if (vdx * vdx + vdy * vdy < VBOSS_HIT_RADIUS * VBOSS_HIT_RADIUS) {
                    if (!s._id) s._id = Math.random().toString(36).slice(2);
                    if (!vboss._hitShards) vboss._hitShards = new Set();
                    if (!vboss._frozenByShards) vboss._frozenByShards = new Set();
                    if (!vboss._handledVolleys) vboss._handledVolleys = new Set();
                    if (!vboss._hitShards.has(s._id)) {
                        vboss._hitShards.add(s._id);
                        s._hitBossThisFrame = true;

                        const wasAlreadyFrozen = vboss._isFrozen;
                        // Only the first shard from a given volley (e.g. one of the 3 Fractal
                        // Shard pierce needles) may trigger a freeze-or-shatter event against
                        // this boss. Other shards from the SAME volley that also land just deal
                        // plain damage instead of each re-triggering freeze/shatter.
                        const volleyAlreadyHandled = s.volleyId && vboss._handledVolleys.has(s.volleyId);

                        // Cannon shards chill/freeze VS; pierce/block instant-freeze; splitters only shatter
                        if (!s.isSplitter && !volleyAlreadyHandled) {
                            if (typeof this.freezeBossFromIceWeapon === 'function') {
                                this.freezeBossFromIceWeapon(!!s.isBlock || !!s.isPierceSpike);
                            }
                        }

                        const justFroze = !wasAlreadyFrozen && vboss._isFrozen && !volleyAlreadyHandled;

                        if (justFroze) {
                            // Froze VS this frame — don't deal damage
                            vboss._frozenByShards.add(s._id);
                            if (s.volleyId) vboss._handledVolleys.add(s.volleyId);
                        } else if (!vboss._frozenByShards.has(s._id)) {
                            // Already frozen → shatter bonus (once per volley); or normal damage
                            if (wasAlreadyFrozen && !volleyAlreadyHandled) {
                                // Shatter — deal full damage with shatter mult
                                const shatterMult = s.isCannonShard ? (s._shatterMult || 0.5) : 1.0;
                                this.damageVoidSovereignBoss(s.damage * this._volleyMult(this._bossVolleyKey(), s.volleyId) * (1 + shatterMult * 5));
                                if (typeof this._clearFreezeVisuals === 'function') this._clearFreezeVisuals(vboss._bossProxy || vboss);
                                vboss._isFrozen = false; // thaw — _thawVoidSovereign doesn't exist, so clear directly
                                this.showStatusText(vpx, vpy - 60, 'SHATTER!', '#aaffff');
                                if (s.volleyId) vboss._handledVolleys.add(s.volleyId);
                            } else {
                                this.damageVoidSovereignBoss(s.damage * this._volleyMult(this._bossVolleyKey(), s.volleyId));
                            }
                        }

                        if (!s.isPierceSpike && !s.isSplitter) {
                            this.destroyIceShard(s);
                            this.iceShards.splice(i, 1);
                            continue;
                        }
                    }
                }
            }

            // ── Distance-based recall ────────────────────────────────────────────
            // Accumulated from actual per-frame movement rather than from elapsed time, so it
            // stays correct if a shard is slowed, steered, or has its generation speed retuned.
            if (s._recallAfterPx && !s.isRecalling) {
                s._travelledPx = (s._travelledPx || 0) + Math.hypot(s.vx * ds, s.vy * ds);
                if (s._travelledPx >= s._recallAfterPx) {
                    if (s._splitTimer) { s._splitTimer.remove(); s._splitTimer = null; }
                    s.isRecalling   = true;
                    s.hitEnemies    = new Set();           // the return pass may re-hit
                    s._recallDamage = s.damage * (s._recallDmgMult || 2.2);
                }
            }

            const nextTileX = Math.floor((s.sprite.x + s.vx * ds) / this.TILE_SIZE);
            const nextTileY = Math.floor((s.sprite.y + s.vy * ds) / this.TILE_SIZE);

            const outX = nextTileX < 0 || nextTileX >= this.WORLD_WIDTH;
            const outY = nextTileY < 0 || nextTileY >= this.WORLD_HEIGHT;

            // Destroy shard if entering locked room
            if (this.isInLockedRoom(tileX, tileY)) {
                this.destroyIceShard(s); this.iceShards.splice(i, 1); continue;
            }

            const hitWallX = outX || (!outY && this.world[nextTileX][tileY] === this.WALL);
            const hitWallY = outY || (!outX && this.world[tileX][nextTileY] === this.WALL);
            // a fan shard homing back to you ghosts through walls (faded inside them): bouncing off the wall between you, it was stuck there
            // forever, and every stuck one cost a frame. 2.5s homing at most, whatever happens.
            if (s.isSplitter && s.isRecalling) {
                if (time - (s._recallAt ??= time) > 2500) { this.destroyIceShard(s); this.iceShards.splice(i, 1); continue; }
                s.sprite.setAlpha(this.world[tileX]?.[tileY] === this.FLOOR ? 1 : 0.4);
                if (hitWallX || hitWallY) { s.sprite.setRotation(Math.atan2(s.vy, s.vx) + Math.PI / 2); continue; }
            }
            if ((hitWallX || hitWallY) && !s.isHealShard) VisualFX.wallImpact(this, s.sprite.x, s.sprite.y, 'ice', s.vx, s.vy);

            if (hitWallX && !hitWallY) {
                if (s.isHealShard && s._onImpact) { s._onImpact(s.sprite.x, s.sprite.y); this.destroyIceShard(s); this.iceShards.splice(i, 1); continue; }
                if (s.isTsunamiScatter || s.isPierceSpike) {
                    this.destroyIceShard(s); this.iceShards.splice(i, 1); continue; }
                // A wall short-circuits the distance requirement: nowhere further to go.
                if (s.isSplitter && s._isFinalGen && !s.isRecalling) {
                    // Wall hit triggers immediate recall instead of destruction
                    if (s._splitTimer) { s._splitTimer.remove(); s._splitTimer = null; }
                    if (s._recallTimer) { s._recallTimer.remove(); }
                    s.isRecalling = true; s.hitEnemies = new Set(); s._recallDamage = s.damage * 2.2;
                    s.vx = -s.vx; continue;
                }
                if (s.isCannonShard && !(s.isSplitter && s.isRecalling)) {
                    if (s.isMiniHealShard) { this.destroyIceShard(s); this.iceShards.splice(i, 1); continue; }
                    if (s.isPiercing && s.bounces < s.maxBounces) { s.vx = -s.vx; s.bounces++; s.pierceCount = 0; s.piercedEnemies = new Set(); this.spawnBounceImpact(s.sprite.x, s.sprite.y); continue; }
                    this.destroyIceShard(s); this.iceShards.splice(i, 1); continue;
                }
            } else if (hitWallY && !hitWallX) {
                if (s.isHealShard && s._onImpact) { s._onImpact(s.sprite.x, s.sprite.y); this.destroyIceShard(s); this.iceShards.splice(i, 1); continue; }
                if (s.isTsunamiScatter || s.isPierceSpike) {
                    this.destroyIceShard(s); this.iceShards.splice(i, 1); continue; }
                // A wall short-circuits the distance requirement: nowhere further to go.
                if (s.isSplitter && s._isFinalGen && !s.isRecalling) {
                    if (s._splitTimer) { s._splitTimer.remove(); s._splitTimer = null; }
                    if (s._recallTimer) { s._recallTimer.remove(); }
                    s.isRecalling = true; s.hitEnemies = new Set(); s._recallDamage = s.damage * 2.2;
                    s.vy = -s.vy; continue;
                }
                if (s.isCannonShard && !(s.isSplitter && s.isRecalling)) {
                    if (s.isMiniHealShard) { this.destroyIceShard(s); this.iceShards.splice(i, 1); continue; }
                    if (s.isPiercing && s.bounces < s.maxBounces) { s.vy = -s.vy; s.bounces++; s.pierceCount = 0; s.piercedEnemies = new Set(); this.spawnBounceImpact(s.sprite.x, s.sprite.y); continue; }
                    this.destroyIceShard(s); this.iceShards.splice(i, 1); continue;
                }
                if (s.isSplitter && s.isRecalling) { s.vy = -s.vy; continue; }
                s.vy = -s.vy; s.bounces++; this.spawnBounceImpact(s.sprite.x, s.sprite.y);
            } else if (hitWallX && hitWallY) {
                if (s.isHealShard && s._onImpact) { s._onImpact(s.sprite.x, s.sprite.y); this.destroyIceShard(s); this.iceShards.splice(i, 1); continue; }
                if (s.isTsunamiScatter || s.isPierceSpike) {
                    this.destroyIceShard(s); this.iceShards.splice(i, 1); continue; }
                // A wall short-circuits the distance requirement: nowhere further to go.
                if (s.isSplitter && s._isFinalGen && !s.isRecalling) {
                    if (s._splitTimer) { s._splitTimer.remove(); s._splitTimer = null; }
                    if (s._recallTimer) { s._recallTimer.remove(); }
                    s.isRecalling = true; s.hitEnemies = new Set(); s._recallDamage = s.damage * 2.2;
                    s.vx = -s.vx; s.vy = -s.vy; continue;
                }
                if (s.isCannonShard && !(s.isSplitter && s.isRecalling)) {
                    if (s.isMiniHealShard) { this.destroyIceShard(s); this.iceShards.splice(i, 1); continue; }
                    if (s.isPiercing && s.bounces < s.maxBounces) { s.vx = -s.vx; s.vy = -s.vy; s.bounces += 2; s.pierceCount = 0; s.piercedEnemies = new Set(); this.spawnBounceImpact(s.sprite.x, s.sprite.y); continue; }
                    this.destroyIceShard(s); this.iceShards.splice(i, 1); continue;
                }
                if (s.isSplitter && s.isRecalling) { s.vx = -s.vx; s.vy = -s.vy; continue; }
                s.vx = -s.vx; s.vy = -s.vy; s.bounces += 2; this.spawnBounceImpact(s.sprite.x, s.sprite.y);
            }

            if (s.bounces > this.iceShardMaxBounces) {
                this.destroyIceShard(s);
                this.iceShards.splice(i, 1);
                continue;
            }

            // Rotate shard to match velocity direction
            if (!s.isBlock) {
                s.sprite.setRotation(Math.atan2(s.vy, s.vx) + Math.PI / 2);
            }

            // Keep shatter mark visuals pinned to their enemies each frame
            for (const enemy of this.enemies) {
                if (enemy._shatterMarkVisual && enemy.sprite?.active) {
                    enemy._shatterMarkVisual.x = enemy.sprite.x;
                    enemy._shatterMarkVisual.y = enemy.sprite.y - 20;
                }
            }

            // ── Pierce spike afterimages — ghost copies fading behind ──
            if (s.isPierceSpike && time - (s._lastAfterimageTime || 0) > 30) {   // a pixel ghost of the needle, fading behind it
                s._lastAfterimageTime = time;
                const af = this.add.image(s.sprite.x, s.sprite.y, s.sprite.texture.key).setRotation(s.sprite.rotation).setScale(s.sprite.scaleX * 0.9)
                    .setTint(s._crit ? 0xffffff : 0x7fd0ff).setAlpha(0.5).setDepth(3.0).setBlendMode(Phaser.BlendModes.ADD);
                this.tweens.add({ targets: af, alpha: 0, scaleX: af.scaleX * 0.6, scaleY: af.scaleY * 0.6, duration: 110, ease: 'Quad.easeOut', onComplete: () => af.destroy() });
            }

            // ── Homing splinter: after burst delay, curve toward nearest enemy ──
            if (s.isHealSplinter && time - s._spawnTime > s._homingDelay) {
                const HOMING_STRENGTH = 0.14;
                const SPLINTER_SPEED  = 110;

                // Find/validate target — frozen enemies get priority
                if (!s._homingTarget || !s._homingTarget.sprite?.active || s._homingTarget.health <= 0) {
                    let nearest = null, nearestDist2 = Infinity;
                    let nearestFrozen = null, nearestFrozenDist2 = Infinity;
                    for (const enemy of this.enemies) {
                        if (this._phasedOut?.(enemy)) continue;
                        if (!enemy.sprite?.active || enemy.health <= 0) continue;
                        const edx = enemy.sprite.x - s.sprite.x, edy = enemy.sprite.y - s.sprite.y;
                        const d2  = edx * edx + edy * edy;
                        if (enemy.isFrozen) {
                            if (d2 < nearestFrozenDist2) { nearestFrozenDist2 = d2; nearestFrozen = enemy; }
                        } else {
                            if (d2 < nearestDist2) { nearestDist2 = d2; nearest = enemy; }
                        }
                    }
                    // Prefer frozen target; fall back to nearest unfrozen
                    s._homingTarget = nearestFrozen || nearest;
                }

                if (s._homingTarget) {
                    const tx  = s._homingTarget.sprite.x, ty = s._homingTarget.sprite.y;
                    const tdx = tx - s.sprite.x,          tdy = ty - s.sprite.y;
                    const tlen = Math.sqrt(tdx * tdx + tdy * tdy) || 1;
                    // Steer velocity toward target
                    s.vx += (tdx / tlen) * SPLINTER_SPEED * HOMING_STRENGTH;
                    s.vy += (tdy / tlen) * SPLINTER_SPEED * HOMING_STRENGTH;
                    // Clamp to max speed so homing doesn't accelerate forever
                    const speed = Math.sqrt(s.vx * s.vx + s.vy * s.vy);
                    if (speed > SPLINTER_SPEED * 1.25) {
                        s.vx = (s.vx / speed) * SPLINTER_SPEED * 1.25;
                        s.vy = (s.vy / speed) * SPLINTER_SPEED * 1.25;
                    }
                }
            }

            // ── Final-gen splitter recall: snap back toward player, destroy on arrival ──
            if (s.isSplitter && s._isFinalGen && s.isRecalling) {
                const RECALL_SPEED   = 220;
                const RECALL_ACCEL   = 0.28;
                const playerPx = this.playerX * this.TILE_SIZE + this.TILE_SIZE / 2;
                const playerPy = this.playerY * this.TILE_SIZE + this.TILE_SIZE / 2;
                const tdx = playerPx - s.sprite.x, tdy = playerPy - s.sprite.y;
                const tlen = Math.sqrt(tdx * tdx + tdy * tdy) || 1;
                s.vx += (tdx / tlen) * RECALL_SPEED * RECALL_ACCEL;
                s.vy += (tdy / tlen) * RECALL_SPEED * RECALL_ACCEL;
                const spd = Math.sqrt(s.vx * s.vx + s.vy * s.vy);
                if (spd > RECALL_SPEED) { s.vx = (s.vx / spd) * RECALL_SPEED; s.vy = (s.vy / spd) * RECALL_SPEED; }
                // Destroy when close enough to player
                if (tlen < 18) {
                    this.destroyIceShard(s); this.iceShards.splice(i, 1); continue;
                }
            }

            // Heal orb: continuous DPS + one-time lifesteal per enemy, every 80ms
            if (s.isHealShard && s.lastDamageTick !== undefined) {
                if (time - s.lastDamageTick >= 80) {
                    s.lastDamageTick = time;
                    const orbX = s.sprite.x, orbY = s.sprite.y;
                    for (const enemy of [...this.enemies]) {
                        if (!enemy.sprite?.active) continue;
                        if (enemy.fireImmune) continue;
                        const dx = enemy.sprite.x - orbX, dy = enemy.sprite.y - orbY;
                        if (dx * dx + dy * dy > (32 * 32)) continue;
                        if (!enemy.iceImmune) {
                            if (this._phasedOut(enemy)) continue;   // phased out: not in the world
                            const _rd5178 = this.resolveElementalHit(enemy, s.damage, 'ice');
                            if (_rd5178 === null) continue;
                            enemy.health -= _rd5178;
                            this.showDamageNumber(enemy.sprite.x, enemy.sprite.y - 8, _rd5178, '#00ff88');
                            this.updateEnemyHealthBar(enemy);
                            if (enemy.health <= 0) { this.killEnemy(enemy); continue; }
                        }
                        if (!s.healedEnemies.has(enemy)) {
                            s.healedEnemies.add(enemy);
                            const cap = this.maxHealth + s._healMaxOverheal;
                            if (this.health < cap) {
                                const healed = Math.min(5, cap - this.health);
                                this.health += healed;
                                this.updateHUD();
                                const hx = this.playerX * this.TILE_SIZE + this.TILE_SIZE / 2;
                                const hy = this.playerY * this.TILE_SIZE + this.TILE_SIZE / 2;
                                this.showDamageNumber(hx, hy - 20, healed, '#00ff88');
                            }
                        }
                    }
                    this.tweens.add({ targets: s.sprite, scaleX: 1.25, scaleY: 1.25, duration: 55, yoyo: true, ease: 'Quad.easeOut' });
                }
            }

            // Enemy hit
            let destroyed = false;
            for (let enemy of [...this.enemies]) {
                if (this._phasedOut?.(enemy)) continue;
                if (s.hitEnemies?.has(enemy)) continue;
                if (s.piercedEnemies?.has(enemy)) continue;
                const ex = enemy.sprite.x, ey = enemy.sprite.y;

                // Check distance from shard's path to enemy
                const distToPath = this.distancePointToSegment(ex, ey, oldX, oldY, s.sprite.x, s.sprite.y);
                const hitRadius = s.isBlock ? 16 : s.isHealShard ? 28 : 16;

                if (distToPath < hitRadius) {
                    if (s.isBlock) {
                        // Always freeze on block hit
                        this.damageEnemyIce(enemy, s.damage);
                        // Instant, bar-skipping -- that is the ice block's whole point. But a cube
                        // now, not a stun: this path predates the brittle rework entirely.
                        this.makeIceCube(enemy, this.iceBlockFreezeDuration);
                        this.spawnIceSplinter(ex, ey);
                        this.spawnIceSplinter(ex, ey);
                        this.destroyIceShard(s);
                        this.iceShards.splice(i, 1);
                        destroyed = true;
                        break;
                    } else if (s.isPierceSpike) {
                        // ── PIERCE SPIKE ─────────────────────────────────
                        if (s.hitEnemies.has(enemy)) continue;
                        s.hitEnemies.add(enemy);

                        // ── Spawn frost totem on FIRST hit ───────────────
                        // Only the volley's centre spike (_plantsTotem): all three planted one.
                        if (s.hitEnemies.size === 1 && s._plantsTotem) {
                            this._spawnFrostTotem(ex, ey);
                        }

                        if (!enemy.iceImmune && !enemy.fireImmune && !enemy.elementImmune) {
                            // Damage
                            if (this._phasedOut(enemy)) continue;   // phased out: not in the world
                            // full damage to the first enemy it pierces, 35% to the rest: the
                            // shard is the single-target half of the weapon, the burst the crowd half
                            this._forceCrit = !!s._crit;   // Deadly Accuracy: every shard crits
                            const _rd5235 = this.resolveElementalHit(enemy, s.damage * (s.hitEnemies.size > 1 ? 0.35 : 1) * this._volleyMult(enemy, s.volleyId), 'ice');
                            this._forceCrit = false;
                            if (_rd5235 === null) continue;
                            enemy.health -= _rd5235;
                            this.showDamageNumber(ex, ey - 10, Math.round(_rd5235), '#aaeeff');
                            this.updateEnemyHealthBar(enemy);
                            if (enemy.health <= 0) { this.killEnemy(enemy); continue; }

                            WeaponSystem.fractalBurst(this, ex, ey, !!s._crit);
                            this._fractalMark?.(enemy);   // R's charge: a fan shard on this mark
                            // Freeze if not already frozen
                            if (!enemy._iceCube) {
                                this._destroyChillIndicator(enemy);
                                this.makeIceCube(enemy, 4500);
                                enemy._justFrozenAt = this.time.now;
                                this.gainUltCharge(this.ultChargePerFreeze, 'ice');
                                const ff = this.add.graphics().setDepth(4);
                                ff.x = ex; ff.y = ey;
                                ff.fillStyle(0xaaeeff, 0.45); ff.fillCircle(0, 0, 12);
                                ff.fillStyle(0xffffff, 0.70); ff.fillCircle(0, 0, 5);
                                this.tweens.add({ targets: ff, scaleX: 2.0, scaleY: 2.0, alpha: 0, duration: 200, onComplete: () => ff.destroy() });
                            }
                        } else if (enemy.iceImmune) {
                            // Pierce spike bypasses ice immunity — instantly freezes ice elementals
                            if (!enemy._iceCube) {
                                this._destroyChillIndicator(enemy);
                                this.makeIceCube(enemy, 4500);
                                enemy._justFrozenAt = this.time.now;
                                this.gainUltCharge(this.ultChargePerFreeze, 'ice');
                                this.showStatusText(ex, ey - 10, 'PIERCED!', '#ffffff');
                                const ff = this.add.graphics().setDepth(4);
                                ff.x = ex; ff.y = ey;
                                ff.fillStyle(0xffffff, 0.9); ff.fillCircle(0, 0, 18);
                                ff.fillStyle(0xaaeeff, 0.6); ff.fillCircle(0, 0, 10);
                                this.tweens.add({ targets: ff, scaleX: 2.5, scaleY: 2.5, alpha: 0, duration: 220, onComplete: () => ff.destroy() });
                            }
                        }
                        // Keep mark visual following enemy each frame
                        if (enemy._shatterMarkVisual && enemy.sprite?.active) {
                            enemy._shatterMarkVisual.x = enemy.sprite.x;
                            enemy._shatterMarkVisual.y = enemy.sprite.y - 20;
                        }
                        // Does NOT destroy — continues piercing
                        // Pierce spike instant-freezes queen portals on tile
                        const piercePortal = this.getPortalAt(tileX, tileY);
                        if (piercePortal) {
                            this.damagePortal(piercePortal, s.damage, { freeze: true, src: s });
                        }
                        // Apply instant freeze to boss if hit
                        if (typeof this.freezeBossFromIceWeapon === 'function') {
                            const btx = Math.floor(s.sprite.x / this.TILE_SIZE);
                            const bty = Math.floor(s.sprite.y / this.TILE_SIZE);
                            if (this.voltslimeBoss?.active &&
                                Math.abs(btx - this.voltslimeBoss.tileX) <= 1 &&
                                Math.abs(bty - this.voltslimeBoss.tileY) <= 1) {
                                this.freezeBossFromIceWeapon(true);
                            }
                        }
                    } else if (s.isSplitter) {
                        // Splitter fragment — damages, shatters frozen, small AoE, pierces
                        if (s.hitEnemies.has(enemy)) continue;
                        s.hitEnemies.add(enemy);
                        this._fractalConsume?.(enemy);   // a spike's mark: R charges
                        const hitDmg = (s.isRecalling ? (s._recallDamage || s.damage * 2.2) : s.damage) * this._volleyMult(enemy, s.volleyId);
                        // Shatter mark multiplier — 4× purple, 3× gold
                        // Marks: purple is x1.5 on everything now (in the resolve), so the splitter adds
                        // nothing of its own to it; gold pays x1.25. They were 4x / 3x on top of brittle.
                        const markMult = enemy._purpleMarked ? 1.0 : enemy._shatterMarked ? 1.25 : 1.0;
                        const finalHitDmg = hitDmg * markMult;
                        // Check frozen BEFORE immunity — frozen iceImmune enemies shatter
                        if (enemy.isFrozen) {
                            this._triggerShatterBurst(enemy, 1.6);   // fractal's shatter, as its spikes'
                        } else if (!enemy.iceImmune && !enemy.fireImmune && !enemy.elementImmune) {
                            if (this._phasedOut(enemy)) continue;   // phased out: not in the world
                            const _rd5317 = this.resolveElementalHit(enemy, finalHitDmg, 'ice');
                            if (_rd5317 === null) continue;
                            enemy.health -= _rd5317;
                            const dmgCol = enemy._purpleMarked ? '#cc44ff' : enemy._shatterMarked ? '#ffdd44' : s.isRecalling ? '#ffffff' : '#66ccff';
                            this.showDamageNumber(ex, ey - 10, Math.round(_rd5317), dmgCol);
                            this.updateEnemyHealthBar(enemy);
                            this.gainUltCharge(this.ultChargePerHit);
                            if (enemy.health <= 0) {
                                if (enemy._shatterMarkVisual) { this.tweens.killTweensOf(enemy._shatterMarkVisual); enemy._shatterMarkVisual.destroy(); enemy._shatterMarkVisual = null; }
                                if (enemy._shatterMarkTimer) { enemy._shatterMarkTimer.remove(); enemy._shatterMarkTimer = null; }
                                this.killEnemy(enemy);
                            }
                        }
                        // Small AoE ice explosion on each fragment hit — also scales with mark (not drawn in Shard Storm: dozens a second whited out the screen)
                        const AOE_RADIUS = 28;
                        const aoeG = this.add.graphics().setDepth(4.5).setVisible(!((this._fracMode?.until || 0) > this.time.now));
                        aoeG.x = ex; aoeG.y = ey;
                        // Marked hits flash gold/yellow instead of blue
                        const aoeCol = enemy._purpleMarked ? 0xaa22ff : enemy._shatterMarked ? 0xffdd44 : s.isRecalling ? 0xffffff : 0xaaeeff;
                        const aoeMid = enemy._purpleMarked ? 0xdd88ff : enemy._shatterMarked ? 0xffff88 : s.isRecalling ? 0xffffff : 0xddf8ff;
                        // rings and a star, not filled discs (a volley's hits overlap, and stacked fills read as one flat blob)
                        const marked = enemy._purpleMarked || enemy._shatterMarked, R2 = AOE_RADIUS * (marked ? 1.2 : 1);
                        aoeG.fillStyle(aoeCol, marked ? 0.14 : 0.1); aoeG.fillCircle(0, 0, R2 * 0.7);
                        aoeG.fillStyle(0xffffff, 0.8); aoeG.fillCircle(0, 0, 2.5);
                        aoeG.lineStyle(marked ? 2 : 1.4, aoeMid, 0.85); aoeG.strokeCircle(0, 0, R2 * 0.8);
                        if (marked) { aoeG.lineStyle(1, aoeCol, 0.6); aoeG.strokeCircle(0, 0, R2 * 0.55); }
                        for (let ai = 0; ai < 5; ai++) {
                            const aa = (ai / 5) * Math.PI * 2 + ex * 0.01;
                            aoeG.lineStyle(1, ai % 2 ? aoeMid : 0xffffff, 0.7);
                            aoeG.beginPath(); aoeG.moveTo(Math.cos(aa)*4, Math.sin(aa)*4); aoeG.lineTo(Math.cos(aa)*R2*0.75, Math.sin(aa)*R2*0.75); aoeG.strokePath();
                        }
                        this.tweens.add({ targets: aoeG, scaleX: 1.5, scaleY: 1.5, alpha: 0, duration: 200, ease: 'Quad.easeOut', onComplete: () => aoeG.destroy() });
                        // Damage nearby enemies in AoE radius
                        for (const nearEnemy of [...this.enemies]) {
                            if (this._phasedOut?.(nearEnemy)) continue;
                            if (nearEnemy === enemy || s.hitEnemies.has(nearEnemy)) continue;
                            if (!nearEnemy.sprite?.active) continue;
                            const aex = nearEnemy.sprite.x, aey = nearEnemy.sprite.y;
                            const adx = aex - ex, ady = aey - ey;
                            if (adx*adx + ady*ady > AOE_RADIUS*AOE_RADIUS) continue;
                            s.hitEnemies.add(nearEnemy);
                            // Check frozen BEFORE immunity — frozen iceImmune enemies shatter
                            if (nearEnemy.isFrozen) {
                                this._triggerShatterBurst(nearEnemy);
                            } else if (!nearEnemy.iceImmune && !nearEnemy.fireImmune && !nearEnemy.elementImmune) {
                                const aoeDmg = finalHitDmg * 0.35;   // was 0.6
                                const _rd5357 = this.resolveElementalHit(nearEnemy, aoeDmg, 'ice');
                                if (_rd5357 === null) continue;
                                nearEnemy.health -= _rd5357;
                                this.showDamageNumber(aex, aey - 10, Math.round(_rd5357), s.isRecalling ? '#ffffff' : '#88ddff');
                                this.updateEnemyHealthBar(nearEnemy);
                                if (nearEnemy.health <= 0) this.killEnemy(nearEnemy);
                            }
                        }
                        // Splitter fragments pierce — they don't stop on hit
                        // Accumulate boss freeze stacks on each splitter hit
                        if (typeof this.freezeBossFromIceWeapon === 'function') {
                            const btx = Math.floor(s.sprite.x / this.TILE_SIZE);
                            const bty = Math.floor(s.sprite.y / this.TILE_SIZE);
                            if (this.voltslimeBoss?.active &&
                                Math.abs(btx - this.voltslimeBoss.tileX) <= 1 &&
                                Math.abs(bty - this.voltslimeBoss.tileY) <= 1) {
                                this.freezeBossFromIceWeapon(false);
                            }
                        }
                    } else if (s.isCannonShard) {
                        if (s.piercedEnemies.has(enemy)) continue;
                        s.piercedEnemies.add(enemy);
                        if (s.isHealShard) {
                            // New heal shard — projectile style, triggers on first hit
                            if (s._onHit) s._onHit(enemy);
                            this.destroyIceShard(s);
                            this.iceShards.splice(i, 1);
                            destroyed = true;
                            break;
                        } else if (s.isHealSplinter) {
                            // Homing splinter — chill/shatter ice elementals, damage + heal on hit
                            if (enemy.fireImmune || enemy.elementImmune) {
                                // fire elementals immune to all ice
                            } else if (enemy.isFrozen) {
                                // SHATTER — works on all enemies including iceImmune
                                this._triggerShatterBurst(enemy);
                                const shatterHealBonus = (s._healAmount || 20) / 3;
                                this.health = Math.min((this.maxHealth || 100) + (s._healMaxOverheal || 25), this.health + shatterHealBonus);
                                if (typeof HUD !== 'undefined') HUD.prototype.updateHUD.call(this);
                                const shb = this.add.graphics().setDepth(5);
                                shb.x = ex; shb.y = ey;
                                shb.fillStyle(0x00ffaa, 0.65); shb.fillCircle(0, 0, 16);
                                shb.fillStyle(0xffffff, 0.90); shb.fillCircle(0, 0, 6);
                                for (let ri = 0; ri < 6; ri++) {
                                    const ra = (ri / 6) * Math.PI * 2;
                                    shb.lineStyle(1.5, 0x88ffcc, 0.80);
                                    shb.beginPath(); shb.moveTo(Math.cos(ra)*6, Math.sin(ra)*6); shb.lineTo(Math.cos(ra)*18, Math.sin(ra)*18); shb.strokePath();
                                }
                                this.tweens.add({ targets: shb, scaleX: 2.8, scaleY: 2.8, alpha: 0, duration: 320, ease: 'Quad.easeOut', onComplete: () => shb.destroy() });
                            } else if (enemy.iceImmune) {
                                // Ice elementals: no chip damage, chill is all they take.
                                // Was freezeEnemy(1500) -- a hard stun, which also left them
                                // eligible for shatter-on-hit while every other enemy was not.
                                this.applyChill(enemy, this._chillCfg().IMMUNE);
                                // Heal 1hp per hit even on iceImmune
                                this.health = Math.min((this.maxHealth || 100) + (s._healMaxOverheal || 25), this.health + 1);
                                if (typeof HUD !== 'undefined') HUD.prototype.updateHUD.call(this);
                            } else {
                                // Normal enemy — damage + chill + heal
                                if (this._phasedOut(enemy)) continue;   // phased out: not in the world
                                const _rd5422 = this.resolveElementalHit(enemy, s.damage, 'ice');
                                if (_rd5422 === null) continue;
                                enemy.health -= _rd5422;
                                this.showDamageNumber(enemy.sprite.x, enemy.sprite.y - 8, Math.round(_rd5422), '#44ffaa');
                                this.updateEnemyHealthBar(enemy);
                                const _died = enemy.health <= 0;
                                if (_died) this.killEnemy(enemy);
                                // Chill only applies to something still alive -- stacking it
                                // on a corpse rebuilt the indicator after killEnemy removed
                                // it. Cannot early-out here: the heal below still owes the
                                // player its hitpoint whether or not the enemy died.
                                if (!_died) this.applyChill(enemy, this._chillCfg().DIRECT);
                                // Heal 1hp per hit
                                this.health = Math.min((this.maxHealth || 100) + (s._healMaxOverheal || 25), this.health + 1);
                                if (typeof HUD !== 'undefined') HUD.prototype.updateHUD.call(this);
                                const hb = this.add.graphics().setDepth(5);
                                hb.x = ex; hb.y = ey;
                                hb.fillStyle(0x00ff88, 0.70); hb.fillCircle(0, 0, 8);
                                hb.fillStyle(0xffffff, 0.85); hb.fillCircle(0, 0, 3);
                                this.tweens.add({ targets: hb, scaleX: 2.2, scaleY: 2.2, alpha: 0, duration: 220, onComplete: () => hb.destroy() });
                            }
                            // Apply freeze stack to boss on splinter hit
                            if (typeof this.freezeBossFromIceWeapon === 'function') {
                                const btx = Math.floor(ex / this.TILE_SIZE);
                                const bty = Math.floor(ey / this.TILE_SIZE);
                                if (this.voltslimeBoss?.active &&
                                    Math.abs(btx - this.voltslimeBoss.tileX) <= 1 &&
                                    Math.abs(bty - this.voltslimeBoss.tileY) <= 1) {
                                    this.freezeBossFromIceWeapon(false);
                                }
                            }
                            this.destroyIceShard(s);
                            this.iceShards.splice(i, 1);
                            destroyed = true;
                            break;
                        } else if (s.isMiniHealShard) {
                            // Fixed-direction mini shard — consumed on first hit
                            if (enemy.fireImmune || enemy.elementImmune) {
                                // skip
                            } else if (enemy.isFrozen) {
                                this._triggerShatterBurst(enemy, 1 / 7.5);
                            } else if (!enemy.iceImmune) {
                                if (this._phasedOut(enemy)) continue;   // phased out: not in the world
                                const _rd5474 = this.resolveElementalHit(enemy, s.damage, 'ice');
                                if (_rd5474 === null) continue;
                                enemy.health -= _rd5474;
                                this.showDamageNumber(ex, ey - 8, Math.round(_rd5474), '#44ffaa');
                                this.updateEnemyHealthBar(enemy);
                                // Every other ice hit site returns or continues here. This
                                // one fell through, so it killed the enemy and THEN stacked
                                // chill on the corpse -- which rebuilt the chill dots after
                                // killEnemy had destroyed them, on something already spliced
                                // out of this.enemies, so nothing could ever clean them up.
                                if (enemy.health <= 0) { this.killEnemy(enemy); break; }
                                this.applyChill(enemy, this._chillCfg().SPLASH);
                            }
                            // Heal per mini shard hit
                            this.health = Math.min((this.maxHealth || 100) + 25, this.health + (s._healAmount || 1));
                            if (typeof HUD !== 'undefined') HUD.prototype.updateHUD.call(this);
                            // Small heal pip visual
                            const hpG = this.add.graphics().setDepth(5);
                            hpG.x = ex; hpG.y = ey;
                            hpG.fillStyle(0x00ff88, 0.65); hpG.fillCircle(0, 0, 6);
                            hpG.fillStyle(0xffffff, 0.85); hpG.fillCircle(0, 0, 2);
                            this.tweens.add({ targets: hpG, scaleX: 2.0, scaleY: 2.0, alpha: 0, duration: 200, onComplete: () => hpG.destroy() });
                            // Destroy on first hit
                            if (this.damageBossAtTile(Math.floor(ex / this.TILE_SIZE), Math.floor(ey / this.TILE_SIZE), s.damage * this._volleyMult(this._bossVolleyKey(), s.volleyId), undefined, 'ice')) this._shardBossSig(s);
                            const _hsTX = Math.floor(ex / this.TILE_SIZE), _hsTY = Math.floor(ey / this.TILE_SIZE);
                            const _hsP = this.getPortalAt(_hsTX, _hsTY);
                            if (_hsP) this.damagePortal(_hsP, s.damage, { chill: true, src: s });
                            this.destroyIceShard(s); this.iceShards.splice(i, 1); destroyed = true; break;
                        } else {
                            // Normal cannon shard — _onHit handles immunity + damage + chill + shatter
                            if (s._onHit) s._onHit(enemy);
                            this.spawnBounceImpact(ex, ey);
                            const _csTX = Math.floor(s.sprite.x / this.TILE_SIZE);
                            const _csTY = Math.floor(s.sprite.y / this.TILE_SIZE);
                            if (this.damageBossAtTile(_csTX, _csTY, s.damage * this._volleyMult(this._bossVolleyKey(), s.volleyId), s, 'ice')) this._shardBossSig(s);
                            const _csP = this.getPortalAt(_csTX, _csTY);
                            if (_csP) this.damagePortal(_csP, s.damage, { chill: true, src: s });
                            if (s.isPiercing) {
                                s.pierceCount++;
                                if (s.pierceCount >= s.maxPierces) {
                                    this.destroyIceShard(s); this.iceShards.splice(i, 1); destroyed = true; break;
                                }
                                // else continue piercing through
                            } else {
                                this.destroyIceShard(s); this.iceShards.splice(i, 1); destroyed = true; break;
                            }
                        }
                    } else if (s.isTsunamiScatter) {
                        // Tsunami scatter — pierce through enemies, shatter frozen ones
                        s.hitEnemies.add(enemy);
                        if (enemy.isFrozen) {
                            this._triggerShatterBurst(enemy);
                        } else {
                            this.damageEnemyIce(enemy, s.damage);
                            this.makeIceCube(enemy, 2800);
                            this.spawnIceSplinter(ex, ey);
                        }

                        // Pierce up to 5 enemies before destroying
                        if (s.hitEnemies.size >= 5) {
                            this.destroyIceShard(s);
                            this.iceShards.splice(i, 1);
                            destroyed = true;
                            break;
                        }
                    } else {
                        // Small shard
                        if (Math.random() < this.iceShardFreezeChance && !enemy._iceCube) {
                            this.makeIceCube(enemy, 1500);
                        }
                        s.hitEnemies.add(enemy);
                        if (this.ultDrainActive) {
                            // Pierce: can hit up to 3 enemies
                            if (s.hitEnemies.size >= 3) {
                                this.destroyIceShard(s);
                                this.iceShards.splice(i, 1);
                                destroyed = true;
                                break;
                            }
                        } else {
                            // Normal: consumed on hit
                            this.spawnBounceImpact(s.sprite.x, s.sprite.y);
                            this.destroyIceShard(s);
                            this.iceShards.splice(i, 1);
                            destroyed = true;
                            break;
                        }
                    }
                }
            }
            // Tile-based boss fallback — only fires if pixel check didn't already handle it
            if (!destroyed && !s._hitBossThisFrame &&
                (s.isCannonShard || s.isPierceSpike || s.isSplitter || s.isHealSplinter)) {
                if (this.damageBossAtTile(tileX, tileY, s.damage * this._volleyMult(this._bossVolleyKey(), s.volleyId), s, 'ice')) this._shardBossSig(s);
                // Also hit queen portal on current tile — chill for ice shards
                const fbPortal = this.getPortalAt(tileX, tileY);
                if (fbPortal) {
                    const isIceShard = s.isCannonShard || s.isPierceSpike || s.isSplitter || s.isHealSplinter;
                    this.damagePortal(fbPortal, s.damage, isIceShard ? { chill: true, src: s } : { src: s });
                }
            }

            if (destroyed) continue;
        }
    }

    distancePointToSegment(px, py, x1, y1, x2, y2) {
        // Distance from point (px, py) to line segment from (x1, y1) to (x2, y2)
        const dx = x2 - x1, dy = y2 - y1;
        const len2 = dx * dx + dy * dy;
        if (len2 === 0) return Math.hypot(px - x1, py - y1);
        let t = Math.max(0, Math.min(1, ((px - x1) * dx + (py - y1) * dy) / len2));
        const closestX = x1 + t * dx, closestY = y1 + t * dy;
        return Math.hypot(px - closestX, py - closestY);
    }

    spawnBounceImpact(x, y) {
        const ring = this.add.circle(x, y, 4, 0xaaddff, 0.7);
        ring.setStrokeStyle(1, 0xffffff, 0.9);
        this.tweens.add({ targets: ring, radius: 10, alpha: 0, duration: 180, ease: 'Quad.easeOut', onComplete: () => ring.destroy() });
        // A couple of tiny shards flying off
        for (let i = 0; i < 3; i++) {
            const angle = Math.random() * Math.PI * 2;
            const sp = this.add.rectangle(x, y, 3, 6, 0xccffff, 0.9);
            sp.setDepth(1);
            this.tweens.add({
                targets: sp,
                x: x + Math.cos(angle) * 12, y: y + Math.sin(angle) * 12,
                alpha: 0, duration: 200, ease: 'Quad.easeOut', onComplete: () => sp.destroy()
            });
        }
    }

    destroyIceShard(s) {
        if (s.sprite._glow)           { this.tweens.killTweensOf(s.sprite._glow);     s.sprite._glow.destroy(); }
        if (s.sprite._innerOrb)       { this.tweens.killTweensOf(s.sprite._innerOrb); s.sprite._innerOrb.destroy(); }
        if (s.sprite._glowPulseTimer) { s.sprite._glowPulseTimer.remove(); s.sprite._glowPulseTimer = null; }
        if (s._splitTimer)            { s._splitTimer.remove();  s._splitTimer  = null; }
        if (s._recallTimer)           { s._recallTimer.remove(); s._recallTimer = null; }
        this.tweens.killTweensOf(s.sprite);
        s.sprite.destroy();
    }

    // Generic helper — call after moving any player projectile to check crack collision (Level 4 Fracture Core).
    updateFireballs(delta) {
        const deltaSeconds = delta / 1000;

        for (let i = this.fireballs.length - 1; i >= 0; i--) {
            const fireball = this.fireballs[i];
            this._ultHit = fireball._ult || null;   // the fire ult's fireballs deal ult damage (GameScene clears it after)

            fireball.sprite.x += fireball.vx * deltaSeconds;
            fireball.sprite.y += fireball.vy * deltaSeconds;

            // Crack shrink — pierces, no effect on projectile flight (Level 4)
            this._checkProjectileCrackShrink(fireball.sprite.x, fireball.sprite.y);

            // Max range check (15 tiles)
            const distTraveled = Math.sqrt(
                Math.pow(fireball.sprite.x - fireball.startX, 2) +
                Math.pow(fireball.sprite.y - fireball.startY, 2)
            );
            const maxRange = (fireball._range || 15) * this.TILE_SIZE;
            if (distTraveled > maxRange) {
                fireball.sprite.destroy();
                if (fireball.fireGraphics) fireball.fireGraphics.destroy();
                this.fireballs.splice(i, 1);
                continue;
            }

            // Magma Staff: a spinning lump of lava rock, its cracks glowing, in a heat haze. The fire ult's
            // shots are the same meteors, a size up; its stage-2 supernova a great one burning blue.
            if (((fireball.isStaffBall && !fireball._isSupernova) || fireball._isShotgun) && fireball.sprite?.active) {
                if (!fireball._rock) {
                    const v = (this._magmaRockN = ((this._magmaRockN || 0) + 1) % WeaponSystem.MAGMA_VARIANTS);
                    const key = ElementSystem.meteorKey(this, v % 3), nova = fireball._isSupernova, big = fireball._isShotgun;   // the same molten rock as the fire ult's meteors
                    fireball._spin = (0.006 + Math.random() * 0.01) * (Math.random() < 0.5 ? -1 : 1);
                    const haze = this.add.image(0, 0, 'vfx_glow').setTint(nova ? 0x4a8aff : 0xff6a1a).setBlendMode(Phaser.BlendModes.ADD).setScale(nova ? 0.7 : big ? 0.52 : 0.42).setAlpha(0.45);
                    const rock = this.add.image(0, 0, key).setScale((nova ? 2.3 : big ? 1.75 : 1.4) * 18 / 32);
                    if (nova) rock.setTint(0xaaccff);
                    fireball._hazeS = haze.scale;
                    fireball.fireGraphics?.clear();
                    fireball.sprite.add([haze, rock]);
                    fireball._rock = rock; fireball._haze = haze;
                }
                fireball._rock.rotation += delta * fireball._spin;
                // magma dripping off it: a droplet that sags and cools behind the rock
                if (Math.random() < 0.18) {
                    const dx = fireball.sprite.x - fireball.dirX * 8 + (Math.random() - 0.5) * 8, dy = fireball.sprite.y - fireball.dirY * 8 + (Math.random() - 0.5) * 8;
                    const drop = this.add.circle(dx, dy, 1.6 + Math.random(), 0xff7a22, 0.95).setDepth(fireball.sprite.depth - 0.01);
                    this.tweens.add({ targets: drop, y: dy + 7, scaleX: 0.6, scaleY: 1.5, alpha: 0, duration: 380, ease: 'Quad.easeIn', onUpdate: (tw) => drop.setFillStyle(tw.progress > 0.5 ? 0x8a2a0c : 0xff7a22, 0.95), onComplete: () => drop.destroy() });
                }
                fireball._haze.setScale(fireball._hazeS * (0.95 + 0.12 * Math.sin(this.time.now * 0.03)));
                if (Math.random() < 0.5) this._vfxTrail?.fire?.emitParticleAt(fireball.sprite.x - fireball.dirX * 6, fireball.sprite.y - fireball.dirY * 6, 1);
            }
            // Draw fireball visual
            else if (this.time.now - fireball.lastFlameTime > 25) {
                fireball.lastFlameTime = this.time.now;
                const g = fireball.fireGraphics;
                g.clear();
                const angle = Math.atan2(fireball.dirY, fireball.dirX);
                g.setRotation(angle);

                if (fireball._isSupernova) {
                    // ── Blue supernova fireball ──────────────────────────
                    g.fillStyle(0x0033cc, 0.10); g.fillCircle(4, 0, 22);
                    g.fillStyle(0x0055ff, 0.18); g.fillCircle(5, 0, 16);
                    g.fillStyle(0x1166ff, 0.55); g.fillCircle(5, 0, 13);
                    g.fillStyle(0x0044dd, 0.75); g.fillCircle(4, 0, 10);
                    g.fillStyle(0x001188, 0.92); g.fillCircle(3, 0, 7);
                    g.fillStyle(0x000033, 1);    g.fillCircle(2, 0, 4);
                    g.fillStyle(0x88bbff, 0.95); g.fillCircle(9, 0, 3.2);
                    g.fillStyle(0xffffff, 0.90); g.fillCircle(10, 0, 1.8);

                    // Blue particle trail
                    const numP = 22;
                    for (let j = 0; j < numP; j++) {
                        const side = j % 2 === 0 ? 1 : -1;
                        const prog = (j >> 1) / (numP / 2);
                        const sweepAngle = prog * Math.PI * 0.9;
                        const orbitR = 10 + prog * 11;
                        const xOffset = Math.cos(sweepAngle) * 9 - prog * 22;
                        const yOffset = side * Math.sin(sweepAngle) * orbitR;
                        const jx = xOffset + (Math.random()-0.5)*2.5;
                        const jy = yOffset + (Math.random()-0.5)*1.5;
                        let pCol, pAlpha, pSize;
                        if (prog < 0.2)       { pCol = 0xaaccff; pAlpha = 0.90; pSize = 2.4; }
                        else if (prog < 0.45) { pCol = 0x4488ff; pAlpha = 0.65; pSize = 1.9; }
                        else if (prog < 0.7)  { pCol = 0x1144cc; pAlpha = 0.40; pSize = 1.5; }
                        else                  { pCol = 0x002288; pAlpha = 0.18; pSize = 1.0; }
                        g.fillStyle(pCol, pAlpha); g.fillCircle(jx, jy, pSize);
                    }
                    // Blue smoke tail
                    for (let j = 0; j < 12; j++) {
                        const t = j / 12;
                        const tx = -8 - t * 24 + (Math.random()-0.5)*4;
                        const ty = (Math.random()-0.5) * (3 + t * 9);
                        const tCol = t < 0.35 ? 0x3366ff : t < 0.7 ? 0x1133cc : 0x001166;
                        g.fillStyle(tCol, (1-t)*0.6); g.fillCircle(tx, ty, 1.1+(1-t)*1.6);
                    }
                } else {
                g.fillStyle(0xffcc44, 0.18); g.fillCircle(5, 0, 14);
                g.fillStyle(0xff5500, 0.55); g.fillCircle(5, 0, 12);
                g.fillStyle(0xcc3300, 0.75); g.fillCircle(4, 0, 9);
                g.fillStyle(0x881100, 0.92); g.fillCircle(3, 0, 6);
                g.fillStyle(0x330000, 1);    g.fillCircle(2, 0, 3.5);
                g.fillStyle(0xffeeaa, 0.95); g.fillCircle(9, 0, 2.8);
                g.fillStyle(0xffffff, 0.85); g.fillCircle(10, 0, 1.5);

                const numP = 20;
                for (let j = 0; j < numP; j++) {
                    const side = j % 2 === 0 ? 1 : -1;
                    const prog = (j >> 1) / (numP / 2);
                    const sweepAngle = prog * Math.PI * 0.9;
                    const orbitR = 9 + prog * 10;
                    const xOffset = Math.cos(sweepAngle) * 9 - prog * 20;
                    const yOffset = side * Math.sin(sweepAngle) * orbitR;
                    const jx = xOffset + (Math.random()-0.5)*2.5;
                    const jy = yOffset + (Math.random()-0.5)*1.5;
                    let pCol, pAlpha, pSize;
                    if (prog < 0.2)       { pCol = 0xffeebb; pAlpha = 0.85; pSize = 2.2; }
                    else if (prog < 0.45) { pCol = 0xff9933; pAlpha = 0.65; pSize = 1.8; }
                    else if (prog < 0.7)  { pCol = 0xff5500; pAlpha = 0.40; pSize = 1.4; }
                    else                  { pCol = 0xcc2200; pAlpha = 0.18; pSize = 0.9; }
                    g.fillStyle(pCol, pAlpha); g.fillCircle(jx, jy, pSize);
                }
                for (let j = 0; j < 12; j++) {
                    const t = j / 12;
                    const tx = -8 - t * 22 + (Math.random()-0.5)*4;
                    const ty = (Math.random()-0.5) * (3 + t * 9);
                    const tCol = t < 0.35 ? 0xff8833 : t < 0.7 ? 0xff4400 : 0xaa1100;
                    g.fillStyle(tCol, (1-t)*0.6); g.fillCircle(tx, ty, 1.1+(1-t)*1.6);
                }
                } // end normal fireball
            } // end drawing if

            const tileX = Math.floor(fireball.sprite.x / this.TILE_SIZE);
            const tileY = Math.floor(fireball.sprite.y / this.TILE_SIZE);

            // Wall hit or locked room barrier — destroy fireball
            if (tileX < 0 || tileX >= this.WORLD_WIDTH ||
                tileY < 0 || tileY >= this.WORLD_HEIGHT ||
                this.world[tileX][tileY] === this.WALL ||
                this.isInLockedRoom(tileX, tileY)) {
                VisualFX.wallImpact(this, fireball.sprite.x, fireball.sprite.y, 'fire', fireball.vx, fireball.vy);
                // Only max-stack staff balls (leavesTrail) leave a lava pool on wall impact
                if (fireball.isStaffBall && fireball.leavesTrail) this.spawnFireballLavaPool(tileX, tileY);
                fireball.sprite.destroy();
                if (fireball.fireGraphics) fireball.fireGraphics.destroy();
                this.fireballs.splice(i, 1);
                continue;
            }

            // Ult shotgun — pierce enemies, spawn lava on each hit
            if (this.ignitionActive && fireball._isShotgun) {
                for (let enemy of [...this.enemies]) {
                    if (this._phasedOut?.(enemy)) continue;
                    if (fireball.piercedEnemies && fireball.piercedEnemies.has(enemy)) continue;
                    const ex = enemy.sprite.x, ey = enemy.sprite.y;
                    if (Math.abs(ex - fireball.sprite.x) < 10 && Math.abs(ey - fireball.sprite.y) < 10) {
                        this.damageEnemy(enemy, fireball.damage, 'fire');
                        if (typeof this.applyBurnStack === 'function') this.applyBurnStack(enemy);   // a pellet is a stack
                        if (fireball._isSupernova) {
                            // Apply ignition mark — explodes after 2s, cascades
                            this._applyIgnitionMark(enemy);
                        } else {
                            this.ignitionExplodeEnemy(enemy);
                            this.spawnFireballLavaPool(tileX, tileY);
                        }
                        if (fireball.piercedEnemies) fireball.piercedEnemies.add(enemy);
                    }
                }
                // Damage boss if fireball passes through its tile
                if (this.damageBossAtTile(tileX, tileY, fireball.damage, fireball, 'fire')) {
                    if (typeof this.applyBurnStackBoss === 'function') this.applyBurnStackBoss();   // a pellet is a stack
                }
                // Also damage portals (Queen Slimes) in proximity
                if (this.portals) {
                    for (const portal of this.portals) {
                        if (!portal.active) continue;
                        const ppx = portal.tileX * this.TILE_SIZE + this.TILE_SIZE / 2;
                        const ppy = portal.tileY * this.TILE_SIZE + this.TILE_SIZE / 2;
                        if (Math.abs(ppx - fireball.sprite.x) < this.TILE_SIZE * 2 &&
                            Math.abs(ppy - fireball.sprite.y) < this.TILE_SIZE * 2) {
                            this.damagePortal(portal, fireball.damage, { src: fireball });
                        }
                    }
                }
                continue; // pierce — never destroy on enemy hit
            }

            // Normal hit — no lava pool
            let hitEnemy = false;
            for (let enemy of [...this.enemies]) {
                if (this._phasedOut?.(enemy)) continue;
                const spriteTileX = Math.floor(enemy.sprite.x / this.TILE_SIZE);
                const spriteTileY = Math.floor(enemy.sprite.y / this.TILE_SIZE);
                const onTile = (enemy.x === tileX && enemy.y === tileY)
                            || (spriteTileX === tileX && spriteTileY === tileY);
                if (!onTile) continue;
                if (fireball.piercedEnemies && fireball.piercedEnemies.has(enemy)) continue;
                if (fireball.sprite.y >= tileY * this.TILE_SIZE + this.TILE_SIZE * 0.25) {
                    // Staff balls apply burn to ALL non-iceImmune enemies including fire elementals
                    // (fire elementals are immune to direct damage but accumulate burn stacks)
                    // Read the burn ALREADY on the target, before this hit adds to it, so
                    // a fresh enemy is worth +0% and only a target you have been working
                    // on pays the focus bonus.
                    const _preStacks = Math.min(enemy.burnStacks || 0, 5);
                    if (fireball.isStaffBall && typeof this.applyBurnStack === 'function') {
                        if (!fireball._burnApplied?.has(enemy)) {
                            fireball._burnApplied?.add(enemy);
                            // Heat BEFORE the stack lands, for the same reason.
                            if (typeof this._addMagmaHeat === 'function') this._addMagmaHeat(enemy);
                            this.applyBurnStack(enemy);
                        }
                    }
                    let _dmg = fireball.damage * this._volleyMult(enemy, fireball.volleyId);
                    if (fireball._focus && typeof this._magmaCfg === 'function') {
                        _dmg *= 1 + this._magmaCfg().FOCUS_PER_STACK * _preStacks;
                    }
                    if (!enemy.iceImmune) {
                        // Typed: the fire ult's pellets still in flight when it ends land here, and
                        // untyped they hit as whatever you hold (ice: chilling, and charging ice).
                        this.damageEnemy(enemy, _dmg, 'fire');
                        // Magma Staff: only the 4 tiles beside it, at 30% (fire is single-target; at 2 tiles
                        // and 40% it out-crowded Ball Lightning, 262 dps to 218)
                        if (fireball.isStaffBall) this.fireballSplash(fireball.sprite.x, fireball.sprite.y, _dmg, enemy, 1, 0.3);
                        else if (fireball._swordBolt) this.applyBurnStack?.(enemy);   // the Flame Sword's bolts: a stack, no splash
                        else this.fireballSplash(fireball.sprite.x, fireball.sprite.y, _dmg, enemy);
                    }
                    hitEnemy = true;
                    if (fireball.piercedEnemies) fireball.piercedEnemies.add(enemy);
                    break;
                }
            }
            // Also check boss — fireballs deal full damage on contact
            if (!hitEnemy && this.damageBossAtTile(tileX, tileY, fireball.damage * this._volleyMult(this._bossVolleyKey(), fireball.volleyId), undefined, 'fire')) {
                hitEnemy = true;
                // Staff balls apply burn stack to boss on hit
                if (fireball.isStaffBall && typeof this.applyBurnStackBoss === 'function') {
                    // Bosses are the target this weapon exists for; they must feed it too.
                    if (typeof this._addMagmaHeat === 'function') {
                        this._addMagmaHeat(this.voidSovereignBoss?.active ? this.voidSovereignBoss
                                         : this.voltslimeBoss?.active ? this.voltslimeBoss : null);
                    }
                    this.applyBurnStackBoss();
                }
            }

            // Staff fireballs boil off whatever they fly over, trail or not.
            if (fireball.isStaffBall) this._evaporate(tileX, tileY, 6);
            else if (fireball._swordBolt) this._evaporate(tileX, tileY, 3);   // the Flame Sword's embers: half a tile each
            // Max-stack staff balls leave a lava tile as they fly
            if (fireball.isStaffBall && fireball.leavesTrail) {
                this.spawnIgnitionTrail(
                    tileX * this.TILE_SIZE + this.TILE_SIZE / 2,
                    tileY * this.TILE_SIZE + this.TILE_SIZE / 2,
                    1400
                );
            }

            if (hitEnemy) {
                // Only max-stack staff balls (leavesTrail = 6 fireballs) create 3×3 lava on impact
                if (fireball.isStaffBall && fireball.leavesTrail) this.spawnFireballLavaPool(tileX, tileY);
                fireball.sprite.destroy();
                if (fireball.fireGraphics) fireball.fireGraphics.destroy();
                this.fireballs.splice(i, 1);
            }
        }
    }

    spawnFireballLavaPool(centerTileX, centerTileY) {
        for (let dx = -1; dx <= 1; dx++) {
            for (let dy = -1; dy <= 1; dy++) {
                const tx = centerTileX + dx, ty = centerTileY + dy;
                if (tx < 0 || tx >= this.WORLD_WIDTH || ty < 0 || ty >= this.WORLD_HEIGHT) continue;
                if (this.world[tx][ty] !== this.FLOOR) continue;
                this.spawnIgnitionTrail(tx * this.TILE_SIZE + this.TILE_SIZE / 2, ty * this.TILE_SIZE + this.TILE_SIZE / 2);
            }
        }
    }

}