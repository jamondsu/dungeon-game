// ═══════════════════════════════════════════════════════════════════════
// WeaponSystem.js — what the weapons share: firing the one you hold, the ice shards and fireballs in flight,
// and the fire, ice and lightning art they draw with. Each weapon has its own file beside this one.
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
            case 'ember_scythe':    Scythe.attack(this, targetX, targetY); break;
            case 'ice_fists':       this.iceFistsAttack(targetX, targetY); break;
            case 'icicle_cannon':   this.icicleStaffAttack(targetX, targetY); break;
            case 'fractal_shard':   Fractal.attack(this, targetX, targetY); break;
            case 'rimeguard':       Rimeguard.attack(this, targetX, targetY); break;
            case 'boreal_trident':  Trident.attack(this, targetX, targetY); break;
            case 'lightning_fists': this.lightningFistsAttack(targetX, targetY); break;
            case 'orb_emitter':     this.orbEmitterAttack(targetX, targetY); break;
            case 'ball_lightning': this.ballLightningAttack(targetX, targetY); break;
            case 'conductor':      this.conductorAttack(targetX, targetY); break;
            case 'thunder_glaive': Glaive.attack(this, targetX, targetY); break;
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

    // A real FORK, not a bent line: the trunk runs to the target and dead-end branches split off it and fizzle out
    // (real lightning is recognised by its branching, not its waviness). Laid from the hand-drawn pieces
    // (WeaponSystem.bolt); g only says how deep it sits. depth 2: a full bolt and two forks, 1: a thin one and a fork.
    // life 0: this frame only (what's redrawn every frame).
    _strokeFork(g, fromX, fromY, toX, toY, colour, alpha, depth = 2, life = 170) {
        const pal = colour === 0xffffff ? 'w' : colour === 0xff9a3a ? 'o' : (colour & 0xff) > 0xc0 ? 'c' : 'y';
        return WeaponSystem.bolt(this, fromX, fromY, toX, toY, pal, { life, a: alpha, d: g?.depth ?? 4.2, thin: depth < 2, br: depth });
    }

    // ── LIGHTNING'S PIXELS (assets/art/fx_storm, typed by hand) ──────────────
    // A pool of images for the pieces lightning is laid from, each shown for its life in ms (0: this frame only, for
    // what's redrawn every frame), holding a moment, then flickering out; lag holds it back (a strike racing out
    // along its bolt). One pool per depth, so nothing is re-sorted. Its clock is the loop's, so what's drawn while the scene
    // clock is stopped (Fork's stopped time, a boss's entrance) still plays out; it sweeps before anything draws in a frame.
    static zap(S, frame, x, y, life = 0, a = 1, d = 4.2, s = 1.5, flip = false, add = true, lag = 0, key = 'fx_storm') {
        let P = S._zapPool;
        if (!P) {
            P = S._zapPool = { free: {}, live: [] };
            const tick = () => {
                const now = S.game.loop.time, odd = S.game.loop.frame & 1, L = P.live;
                for (let i = L.length - 1; i >= 0; i--) {
                    const q = L[i], age = now - q._t0;
                    if (age >= q._life || !q.active) { if (q.active) { q.setVisible(false); (P.free[q.depth] ||= []).push(q); } L[i] = L[L.length - 1]; L.pop(); continue; }
                    if (age < 0) continue;
                    const k = age / q._life;
                    q.setVisible(true).setAlpha(q._a * (k < 0.45 ? 1 : (1 - k) / 0.55 * (odd ? 0.55 : 1)));
                }
            };
            S.events.on('preupdate', tick);
            S.events.once('shutdown', () => { S.events.off('preupdate', tick); S._zapPool = null; });
        }
        const q = P.free[d]?.pop() || S.add.image(0, 0, key, frame).setDepth(d);
        if (q.texture.key !== key) q.setTexture(key, frame); else if (q.frame.name !== frame) q.setFrame(frame);
        q.setPosition(x, y).setScale(s).setFlip(flip, flip).setBlendMode(add ? 1 : 0).setAlpha(a).setVisible(lag <= 0).setTint(0xffffff);
        q._t0 = S.game.loop.time + lag; q._life = life; q._a = a;
        P.live.push(q);
        return q;
    }
    // The art's own dice (a bolt's shape, a wire's crackle), so drawing lightning doesn't use up the game's (Math.random)
    static vr() { let t = (WeaponSystem._vrS = (WeaponSystem._vrS + 0x6D2B79F5) | 0); t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }
    static _vrS = 1;
    // A soft light (vfx_glow) for life, as zap
    static zapGlow(S, x, y, s, col, a, life = 0, d = 4.15, lag = 0) { return WeaponSystem.zap(S, null, x, y, life, a, d, s, false, true, lag, 'vfx_glow').setTint(col); }
    static ZAP_N = { b: [4, 3], s: [2, 2], t: [3, 2], u: [1, 1] };   // how many of each piece are drawn: [east, north-east]
    static ZAP_DIR = [[1, 0], [1, 1], [0, 1], [-1, 1], [-1, 0], [-1, -1], [0, -1], [1, -1]];
    static ZAP_COL = { y: 0xffd23a, c: 0x5ac8ff, o: 0xff9030, w: 0xb8dcff };
    // A bolt from (x0, y0) to (x1, y1), laid piece by piece, each piece one of the eight ways (never turned): it heads
    // for its mark veering off it and back, short pieces landing it, and br forks of twig fizzling off it.
    // pal: y gold, c blue, o orange, w white. thin: all twig. One that lives (life > 0) strikes out from its start.
    // key: the pieces' atlas (fx_fork: the lightning ult's heavier ones, gold and white only).
    static bolt(S, x0, y0, x1, y1, pal = 'y', { life = 0, a = 1, d = 4.2, thin = false, br = 1, lag = 0, glow = true, key = 'fx_storm' } = {}) {
        const K = 1.5, N = WeaponSystem.ZAP_N, D = WeaponSystem.ZAP_DIR, O = ['e', 'se', 's', 'ne'], col = WeaponSystem.ZAP_COL[pal];
        const step = life > 0 ? 7 : 0, joints = [];
        let x = Math.round(x0 / K) * K, y = Math.round(y0 / K) * K, side = WeaponSystem.vr() < 0.5 ? 1 : -1;
        const lay = (k, full, twig, at, alpha) => {   // one piece from (x, y) the k-th way; returns its far end
            const kind = twig ? (full ? 't' : 'u') : (full ? 'b' : 's'), o = O[k % 4], span = (full ? (k & 1 ? 9 : 11) : 5) * K;
            const nx = x + D[k][0] * span, ny = y + D[k][1] * span, v = Math.floor(WeaponSystem.vr() * N[kind][k & 1]);
            WeaponSystem.zap(S, `${kind}_${o}${v}_${pal}`, (x + nx) / 2, (y + ny) / 2, life, alpha, d, K, WeaponSystem.vr() < 0.5, true, at, key);
            return [nx, ny];
        };
        for (let n = 0, max = 6 + Math.hypot(x1 - x0, y1 - y0) / 6; n < max; n++) {
            const dx = x1 - x, dy = y1 - y, dd = Math.hypot(dx, dy);
            if (dd < 4 * K) break;
            let k = ((Math.round(Math.atan2(dy, dx) / (Math.PI / 4)) % 8) + 8) % 8;
            if (dd > 18 * K && WeaponSystem.vr() < 0.5) { k = (k + side + 8) % 8; side = -side; }   // off its line and back: the zigzag
            const at = lag + n * step;
            if (glow && !(n & 1)) WeaponSystem.zapGlow(S, x, y, thin ? 0.12 : 0.2, col, 0.16 * a, life, d - 0.05, at);
            [x, y] = lay(k, dd > (k & 1 ? 12 : 10) * K, thin, at, a);
            joints.push([x, y, k, at]);
        }
        for (let b = 0; b < br && joints.length > 1; b++) {   // the forks: off a joint, a turn of 45 or 90 degrees from the trunk, fizzling out
            const j = joints[Math.floor(WeaponSystem.vr() * (joints.length - 1))];
            const sx = x, sy = y; [x, y] = j;
            let k = (j[2] + (WeaponSystem.vr() < 0.5 ? 1 : -1) * (WeaponSystem.vr() < 0.6 ? 1 : 2) + 8) % 8;
            for (let m = 0, len = 1 + Math.floor(WeaponSystem.vr() * 3); m < len; m++) {
                [x, y] = lay(k, m < len - 1 || WeaponSystem.vr() < 0.5, true, j[3] + (m + 1) * step, a * (0.75 - m * 0.15));
                if (WeaponSystem.vr() < 0.4) k = (k + (WeaponSystem.vr() < 0.5 ? 1 : 7)) % 8;
            }
            x = sx; y = sy;
        }
        return { x, y };
    }
    // A strike's flare at (x, y): the hand-drawn burst, s times its size, mirrored at random so no two look alike
    static zapFlare(S, x, y, pal = 'y', s = 1.5, d = 4.4) {
        const key = 'zap_' + pal;
        if (!S.anims.exists(key)) S.anims.create({ key, frames: [0, 1, 2, 3].map(i => ({ key: 'fx_storm', frame: `zap${i}_${pal}` })), frameRate: 26 });
        const f = S.add.sprite(x, y, 'fx_storm', `zap0_${pal}`).setScale(s).setBlendMode(Phaser.BlendModes.ADD).setDepth(d).setFlip(WeaponSystem.vr() < 0.5, WeaponSystem.vr() < 0.5).play(key);
        f.once('animationcomplete', () => f.destroy());
        return f;
    }
    // Sparks (the hand-drawn ones) thrown off a strike, white-hot cooling through the bolt's colour, falling: the
    // scene's emitter for that colour, made the first time
    static zapSparks(S, pal = 'y') {
        const F = S._zapSpk ||= {};
        if (F[pal]?.active) return F[pal];
        const C = { y: [0xffffff, 0xfff6b0, 0xffd23a, 0xa86a10], c: [0xffffff, 0xd4f6ff, 0x5ac8ff, 0x1a5090], o: [0xffffff, 0xffe0a8, 0xff9030, 0x8a3010], w: [0xffffff, 0xeef8ff, 0xb8dcff, 0x5a7ab0] }[pal];
        return (F[pal] = S.add.particles(0, 0, 'fx_storm', { frame: [0, 1, 2, 3, 4, 5, 6, 7].map(i => 'spk_' + i), emitting: false, lifespan: { min: 140, max: 420 },
            speed: { min: 40, max: 170 }, angle: { min: 0, max: 360 }, gravityY: 320, scale: { start: 1.6, end: 1.1 }, alpha: { start: 1, end: 0 },
            color: C, colorEase: 'quad.out', blendMode: 'ADD', maxParticles: 500 }).setDepth(4.3));
    }

    // ══════════════════════════════════════════════════════════════════════
    // ORB EMITTER — bouncing electric orb, marks + forks lightning on hit
    // ══════════════════════════════════════════════════════════════════════
    // Where a shot leaves from: the slime as it's drawn, not its tile (a dash moves the tile at once and the body
    // catches up, so shots fired mid-dash came out of the far end)
    _shotX() { return this.player?.active ? this.player.x : this.playerX * this.TILE_SIZE + this.TILE_SIZE / 2; }
    _shotY() { return this.player?.active ? this.player.y - (this.SLIME_Y_OFFSET || 0) : this.playerY * this.TILE_SIZE + this.TILE_SIZE / 2; }

    // Amp an enemy (lightning carries further from it): the Orb Emitter's hits, and
    // Ball Lightning while it's embedded in one. Refreshes the mark if it's already on.
    _superconduct(enemy, ms = this.superConductDuration || 5000) {
        if (!enemy?.sprite?.active || this._phasedOut(enemy)) return;
        if (enemy._immuneFx === 'lightning') { if (enemy.sprite?.active && this.time.now - (enemy._fxNoAt || 0) > 900) { enemy._fxNoAt = this.time.now; this.showStatusText(enemy.sprite.x, enemy.sprite.y - 30, "CAN'T AMP", '#fff080'); } return; }   // an Adaptive Shade in its lightning form
        if (!(enemy.isSuperConducted && enemy.superConductUntil > this.time.now)) this._statusPop(enemy, 'AMPED', '#ffff44');
        enemy.isSuperConducted = true;
        enemy.superConductUntil = Math.max(enemy.superConductUntil || 0, this.time.now + ms);
        if (enemy.superConductVisual?.container?.active) return;
        const mark = this.add.image(enemy.sprite.x, enemy.sprite.y - 18, 'fx_storm', 'amp').setDepth(3).setScale(1.3);
        this.tweens.add({ targets: mark, alpha: 0.45, duration: 600, yoyo: true, repeat: -1 });
        enemy.superConductVisual = { container: mark, g: mark };
    }

    // A status an enemy just got, popped over it: once a second each at most (a held current or a crowd of forks would bury the fight)
    _statusPop(e, text, col) {
        const now = this.time.now, k = '_pop' + text;
        if (!e?.sprite?.active || now - (e[k] || 0) < 1000) return;
        e[k] = now; this.showStatusText(e.sprite.x, e.sprite.y - 10, text, col);
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

    // ── THE FIRE WEAPONS' ART ────────────────────────────────────────────────
    // Typed by hand (assets/art/fx_fire_w: the flames, the fist's flare, the sword's ember, the staff's rock, the
    // flamethrower's fire, the kindle mark and its pillar, lava); its animations, made once.
    static fireArt(S) {
        const A = S.anims, n = (p, k) => Array.from({ length: k }, (_, i) => p + i);
        const mk = (key, names, rate, repeat = 0) => { if (!A.exists(key)) A.create({ key, frames: names.map(f => ({ key: 'fx_fire_w', frame: f })), frameRate: rate, repeat }); };
        mk('fw_punch_e', n('punch_e_', 4), 20); mk('fw_punch_s', n('punch_s_', 4), 20);
        mk('fw_rock', n('rock_', 4), 12, -1); mk('fw_pebble', n('pebble_', 4), 6, -1); mk('fw_muz', n('muz_', 4), 22);
        mk('fw_drip', n('drip_', 3), 8); mk('fw_bub', n('bub_', 4), 9);
        mk('fw_jet', n('jet_', 5), 10); mk('fw_jot', n('jot_', 5), 10); mk('fw_jetb', n('jetb_', 5), 10); mk('fw_jotb', n('jotb_', 5), 10);
        mk('fw_lick', ['lick_0', 'lick_1', 'lick_2', 'lick_3', 'lick_2', 'lick_1'], 10, -1); mk('fw_crown', n('crown_', 3), 8, -1);
        mk('fw_pillar', n('pillar_', 5), 13); mk('fw_spark', n('sp_', 4), 8); mk('fw_sparkb', n('spb_', 4), 8);
        return 'fx_fire_w';
    }
    // Fire, the scene's particle emitters (made the first time): the hand-drawn flames (ten shapes, each its own size and
    // stretch) burning down from pale yellow through orange and red to nothing as they rise, light added so they burn
    // hottest where they crowd; low ones that stay where they caught; a heat glow under them. The b* ones are Blue Flame's.
    static flames(S) {
        if (S._fwFx?.flame?.active) return S._fwFx;
        WeaponSystem.fireArt(S);
        const ADD = Phaser.BlendModes.ADD, FL = Array.from({ length: 10 }, (_, i) => 'fl_' + i), FB = FL.map(f => 'flb' + f.slice(2));
        const FIRE = { color: [0xffd890, 0xffb050, 0xff7a28, 0xd84418, 0x901c0c, 0x380e06], colorEase: 'quad.out' };
        const BLUE = { color: [0xbfe8ff, 0x8ac8ff, 0x5a9aff, 0x3a6ae8, 0x2238b0, 0x0c1440], colorEase: 'quad.out' };
        const size = (lo, hi) => ({ scaleX: { onEmit: p => (p._sx = lo + Math.random() * (hi - lo)), onUpdate: (p, k, t) => (p._sx || lo) * (1 - 0.7 * t) },
            scaleY: { onEmit: p => (p._sy = (p._sx || lo) * (0.85 + Math.random() * 0.6)), onUpdate: (p, k, t) => (p._sy || lo) * (1 - 0.6 * t) } });
        const em = (frame, o) => S.add.particles(0, 0, 'fx_fire_w', { frame, emitting: false, angle: { min: 0, max: 360 }, rotate: { min: -25, max: 25 }, blendMode: ADD, ...o }).setDepth(3.1);
        const flame = (fr, c) => em(fr, { lifespan: { min: 220, max: 420 }, speed: { min: 10, max: 50 }, gravityY: -220, ...size(1.1, 2), alpha: { start: 0.7, end: 0 }, ...c });
        const small = (fr, c) => em(fr, { lifespan: { min: 160, max: 320 }, speed: { min: 6, max: 30 }, gravityY: -180, ...size(0.8, 1.4), alpha: { start: 0.38, end: 0 }, ...c });
        const lick = (fr, c) => em(fr, { lifespan: { min: 150, max: 280 }, speed: { min: 0, max: 12 }, gravityY: -70, ...size(1, 1.8), alpha: { start: 0.65, end: 0 }, ...c });   // (a flame that stays where it caught: a swing's edge, a ring on the floor)
        const glow = c => S.add.particles(0, 0, 'vfx_glow', { emitting: false, lifespan: { min: 200, max: 360 }, speed: { min: 0, max: 18 }, gravityY: -50,
            scale: { start: 0.42, end: 0.18 }, alpha: { start: 0.12, end: 0 }, color: c, blendMode: ADD }).setDepth(3.09);
        return (S._fwFx = { flame: flame(FL, FIRE), small: small(FL, FIRE), lick: lick(FL, FIRE), glow: glow([0xffa040, 0xff5a1a, 0x801808]),
            bflame: flame(FB, BLUE), bsmall: small(FB, BLUE), blick: lick(FB, BLUE), bglow: glow([0x8ac8ff, 0x3a6aff, 0x101850]) });
    }
    // An ember flung from (x, y) at (vx, vy) px a second: the hand-drawn spark cooling to a red speck over ms (blue: Blue Flame's)
    static ember(S, x, y, vx, vy, ms, blue = false) {
        WeaponSystem.fireArt(S);
        const p = S.add.sprite(x, y, 'fx_fire_w', blue ? 'spb_0' : 'sp_0').setScale(1.2 + Math.random() * 0.7).setDepth(3.25).setBlendMode(Phaser.BlendModes.ADD);
        p.play({ key: blue ? 'fw_sparkb' : 'fw_spark', frameRate: 4000 / ms });
        S.tweens.add({ targets: p, x: x + vx * ms / 1000 + (Math.random() - 0.5) * 12, y: y + vy * ms / 1000 - 10, duration: ms, ease: 'Quad.easeOut', onComplete: () => p.destroy() });
        S.tweens.add({ targets: p, alpha: 0, duration: ms * 0.3, delay: ms * 0.7 });
    }
    // A ring of fire racing out from (x, y), r0 to r1 over ms: flames thrown down round circles (squashed to `flat` on the
    // floor) growing outward, the glow with them
    static fireRing(S, x, y, r0, r1, ms, n, blue = false, flat = 1) {
        const F = WeaponSystem.flames(S), fl = blue ? F.blick : F.lick, gl = blue ? F.bglow : F.glow, STEPS = 6;
        for (let k = 0; k <= STEPS; k++) S.time.delayedCall(ms * k / STEPS, () => {
            const R = r0 + (r1 - r0) * k / STEPS;
            for (let i = 0; i < n; i++) { const b = Math.random() * Math.PI * 2, R2 = R + (Math.random() - 0.5) * 10; fl.emitParticleAt(x + Math.cos(b) * R2, y + Math.sin(b) * R2 * flat, 1); }
            for (let i = 0; i < n / 6; i++) { const b = Math.random() * Math.PI * 2; gl.emitParticleAt(x + Math.cos(b) * R, y + Math.sin(b) * R * flat, 1); }
        });
    }
    // The art drawn the way it flies, to the nearest eighth of a turn (east, south-east, south and north-east typed as
    // `pre`e, `pre`se, `pre`s, `pre`ne; the other four those flipped both ways): never the art turned
    static aim8(spr, a, pre) {
        const k = ((Math.round(a / (Math.PI / 4)) % 8) + 8) % 8, [f, fl] = [['e', 0], ['se', 0], ['s', 0], ['ne', 1], ['e', 1], ['se', 1], ['s', 1], ['ne', 0]][k];
        return spr.setFrame(pre + f).setFlip(!!fl, !!fl);
    }
    // A fist landing on the tile at (x, y), punched (fx, fy) (one of the four ways): its flare thrown that way (typed east
    // and south, west and north those flipped both ways), flames catching on the tile, embers flung on, a flash of light
    static firePunch(S, x, y, fx, fy) {
        const F = WeaponSystem.flames(S), T = S.TILE_SIZE, sd = fy !== 0, back = fx < 0 || fy < 0;
        const p = S.add.sprite(x - fx * T * 0.1, y - fy * T * 0.1, 'fx_fire_w', sd ? 'punch_s_0' : 'punch_e_0').setScale(1.6).setFlip(back, back).setDepth(3.15);
        p.play(sd ? 'fw_punch_s' : 'fw_punch_e'); p.once('animationcomplete', () => p.destroy());
        for (let i = 0; i < 4; i++) F.small.emitParticleAt(x + fx * 6 + (Math.random() - 0.5) * T * 0.7, y + fy * 6 + (Math.random() - 0.5) * T * 0.6, 1);
        F.glow.emitParticleAt(x, y, 1);
        for (let i = 0; i < 4; i++) { const a = Math.atan2(fy, fx) + (Math.random() - 0.5) * 1.4, v = 60 + Math.random() * 80; WeaponSystem.ember(S, x, y, Math.cos(a) * v, Math.sin(a) * v - 20, 300 + Math.random() * 300); }
        S._vfxFlash?.(x, y, 30, 0xff8a2a, 140, 0.45);
    }
    // The fire a blade sheds sweeping from angle a0 to a1 round (x, y), between radii r0 and r1: small soft flames across
    // its outer span, big ones along the edge, embers flung off the tip
    static fireSweep(S, x, y, a0, a1, r0, r1) {
        const F = WeaponSystem.flames(S), n = Math.max(1, Math.ceil(Math.abs(a1 - a0) * r1 / 7)), turn = Math.sign(a1 - a0) || 1;
        for (let i = 1; i <= n; i++) {
            const b = a0 + (a1 - a0) * i / n, c = Math.cos(b), s = Math.sin(b), any = (lo, hi) => { const r = lo + Math.random() * (hi - lo); return [x + c * r, y + s * r]; };
            if (Math.random() < 0.6) F.small.emitParticleAt(...any(r0 + (r1 - r0) * 0.3, r1 - 4), 1);
            F.lick.emitParticleAt(...any(r0 + (r1 - r0) * 0.72, r1 + 2), 1);
            if (Math.random() < 0.3) { const v = 50 + Math.random() * 70, o = b + turn * Math.PI / 2; WeaponSystem.ember(S, x + c * r1, y + s * r1, Math.cos(o) * v + c * 30, Math.sin(o) * v + s * 30 - 20, 300 + Math.random() * 250); }
        }
    }
    // A burst of fire at (x, y) (the staff's muzzle; a Surge bigger): the hand-drawn flare, flames thrown out round it, light
    static fireMuzzle(S, x, y, k = 1) {
        const F = WeaponSystem.flames(S);
        const b = S.add.sprite(x, y, 'fx_fire_w', 'muz_0').setScale(1.6 * k).setDepth(4.6).play('fw_muz');
        b.once('animationcomplete', () => b.destroy());
        for (let i = 0; i < 3 * k; i++) F.flame.emitParticleAt(x + (Math.random() - 0.5) * 10 * k, y + (Math.random() - 0.5) * 10 * k, 1);
        F.glow.emitParticleAt(x, y, 1);
        S._vfxFlash?.(x, y, 30 * k, 0xff8a2a, 160, 0.5);
    }

    // ── THE ICE WEAPONS' ART ─────────────────────────────────────────────────
    // Typed by hand (assets/art/fx_ice_w: the fist's frost, the icicles, the cannon's puff, chips, flakes, the Frost
    // Shield's dome and its cracks); its animations, made once. The glints and mist are the Fractal Shard's (frost).
    static iceArt(S) {
        const A = S.anims, n = (p, k) => Array.from({ length: k }, (_, i) => p + i);
        const mk = (key, names, rate, repeat = 0) => { if (!A.exists(key)) A.create({ key, frames: names.map(f => ({ key: 'fx_ice_w', frame: f })), frameRate: rate, repeat }); };
        mk('iw_slam_e', n('slam_e_', 4), 18); mk('iw_slam_s', n('slam_s_', 4), 18); mk('iw_muz', n('imuz_', 4), 24);
        mk('iw_chip', n('chip_', 4), 14, -1); mk('iw_flake', n('flake_', 3), 6);
        return 'fx_ice_w';
    }
    // A fist landing on the tile at (x, y), punched (fx, fy): its frost sprayed that way (typed east and south, west and
    // north those flipped both ways), glints and a breath of mist off it
    static iceSlam(S, x, y, fx, fy) {
        WeaponSystem.iceArt(S);
        const T = S.TILE_SIZE, sd = fy !== 0, back = fx < 0 || fy < 0;
        const p = S.add.sprite(x - fx * T * 0.15, y - fy * T * 0.15, 'fx_ice_w', sd ? 'slam_s_0' : 'slam_e_0').setScale(1.5).setFlip(back, back).setDepth(3.15);
        p.play(sd ? 'iw_slam_s' : 'iw_slam_e'); p.once('animationcomplete', () => p.destroy());
        const F = Fractal.frost(S);
        for (let i = 0; i < 3; i++) F.glint.emitParticleAt(x + fx * 6 + (Math.random() - 0.5) * T * 0.8, y + fy * 6 + (Math.random() - 0.5) * T * 0.7, 1);
        for (let i = 0; i < 3; i++) F.mist.emitParticleAt(x + (Math.random() - 0.5) * 10, y + (Math.random() - 0.5) * 8, 1);
        S._vfxFlash?.(x, y, 30, 0x9fe4ff, 140, 0.6);
    }
    // Ice breaking at (x, y), as big as n: one cloud of frost bursting off it (to about r px), a big chip of ice tumbling
    // out for every four of n (the only outlined pieces: a heap of small ones read as a pile of beans), a glint or two
    static iceChips(S, x, y, n, r = 16) {
        Fractal.frostPuff(S, x, y, Math.ceil(n * 0.8), 0.6 + r / 40, r * 0.5);
        for (let i = 0; i < Math.max(1, Math.round(n / 4)); i++) Fractal.fracChip(S, x, y, r * (0.7 + Math.random() * 0.6), 1.5 + Math.random() * 0.3);
        Fractal.frost(S).glint.emitParticleAt(x + (Math.random() - 0.5) * 12, y + (Math.random() - 0.5) * 10, Math.min(2, Math.ceil(n / 5)));
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
            if (s.isCannonShard && !s.isHealShard) Fractal.frostTrail(this, oldX, oldY, s.sprite.x, s.sprite.y, 3, 0.8);   // the icicle's tail of frost, unbroken

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
                    // a glint now and then off the icicle (its tail is laid every frame, above) and a breath of mist
                    const FR = Fractal.frost(this);
                    if (Math.random() < 0.35) FR.glint.emitParticleAt(s.sprite.x + (Math.random() - 0.5) * 4, s.sprite.y + (Math.random() - 0.5) * 4, 1);
                    if (Math.random() < 0.5) FR.mist.emitParticleAt(s.sprite.x, s.sprite.y, 1);
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
                if (hitWallX || hitWallY) { if (!s.isSplitter) s.sprite.setRotation(Math.atan2(s.vy, s.vx) + Math.PI / 2); continue; }
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

            // Rotate shard to match velocity direction (the Fractal Shard's are drawn their way, or tumble: never turned)
            if (s.isPierceSpike) Fractal.fracAim(s.sprite, Math.atan2(s.vy, s.vx));
            else if (!s.isBlock && !s.isSplitter && !s.isCannonShard) s.sprite.setRotation(Math.atan2(s.vy, s.vx) + Math.PI / 2);   // (an icicle is drawn the way it flies: turned too, it flew side-on)

            // Keep shatter mark visuals pinned to their enemies each frame
            for (const enemy of this.enemies) {
                if (enemy._shatterMarkVisual && enemy.sprite?.active) {
                    enemy._shatterMarkVisual.x = enemy.sprite.x;
                    enemy._shatterMarkVisual.y = enemy.sprite.y - 20;
                }
            }

            // ── Frost behind the needle (and now and then off a fan shard): glints and a pale mist ──
            if (s.isPierceSpike && time - (s._lastAfterimageTime || 0) > 16) {
                s._lastAfterimageTime = time;
                const F = Fractal.frost(this);
                F.glint.emitParticleAt(s.sprite.x + (Math.random() - 0.5) * 6, s.sprite.y + (Math.random() - 0.5) * 6, 1);
                F.mist.emitParticleAt(s.sprite.x, s.sprite.y, 1);
            } else if (s.isSplitter && Math.random() < 0.08) Fractal.frost(this).glint.emitParticleAt(s.sprite.x, s.sprite.y, 1);

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
                            const _rd5235 = this.resolveElementalHit(enemy, s.damage * (s.hitEnemies.size > 1 ? 0.35 : 1) * this._volleyMult(enemy, s.volleyId), 'ice');
                            if (_rd5235 === null) continue;
                            enemy.health -= _rd5235;
                            this.showDamageNumber(ex, ey - 10, Math.round(_rd5235), '#aaeeff');
                            this.updateEnemyHealthBar(enemy);
                            if (enemy.health <= 0) { this.killEnemy(enemy); continue; }

                            Fractal.fractalBurst(this, ex, ey, !!s._crit);
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
                        // Small AoE ice explosion on each fragment hit: a little burst of ice (the hand-drawn flare)
                        const AOE_RADIUS = 28;
                        Fractal.fracMuzzle(this, ex, ey, false);
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

    // An icicle landing (or glancing off): a puff of frost off it, a glint (a volley's run together into one cloud)
    spawnBounceImpact(x, y) {
        Fractal.frostPuff(this, x, y, 3, 0.7);
        Fractal.frost(this).glint.emitParticleAt(x, y, 1);
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

            // Magma Staff: a lump of lava rock tumbling (the hand-drawn frames, never the art turned), magma glowing in
            // its cracks, in a heat haze, fire streaming off behind it and drops of magma falling from it
            if (fireball.isStaffBall && !fireball._isSupernova && !fireball._isShotgun && fireball.sprite?.active) {
                const F = WeaponSystem.flames(this);
                if (!fireball._rock) {
                    const haze = this.add.image(0, 0, 'vfx_glow').setTint(0xff6a1a).setBlendMode(Phaser.BlendModes.ADD).setScale(0.42).setAlpha(0.45);
                    const rock = this.add.sprite(0, 0, 'fx_fire_w', 'rock_0').setScale(1.6).play({ key: 'fw_rock', startFrame: Math.floor(Math.random() * 4), frameRate: 10 + Math.random() * 6 });
                    fireball.sprite.add([haze, rock]);
                    fireball._rock = rock; fireball._haze = haze; fireball._hazeS = haze.scale;
                }
                const bx = fireball.sprite.x - fireball.dirX * 8, by = fireball.sprite.y - fireball.dirY * 8;
                if (Math.random() < 0.5) F.small.emitParticleAt(bx + (Math.random() - 0.5) * 6, by + (Math.random() - 0.5) * 6, 1);
                if (Math.random() < 0.12) F.flame.emitParticleAt(bx + (Math.random() - 0.5) * 6, by + (Math.random() - 0.5) * 6, 1);
                if (Math.random() < 0.12) {   // a drop of magma sagging off it and cooling
                    const drop = this.add.sprite(bx + (Math.random() - 0.5) * 8, by + (Math.random() - 0.5) * 6, 'fx_fire_w', 'drip_0').setScale(1.5).setDepth(fireball.sprite.depth - 0.01).play('fw_drip');
                    this.tweens.add({ targets: drop, y: drop.y + 8, alpha: 0, duration: 380, ease: 'Quad.easeIn', onComplete: () => drop.destroy() });
                }
                fireball._haze.setScale(fireball._hazeS * (0.95 + 0.12 * Math.sin(this.time.now * 0.03)));
            }
            // The fire ult's shots: the same molten rock as its meteors; its stage-2 supernova a great one burning blue.
            else if (((fireball.isStaffBall && !fireball._isSupernova) || fireball._isShotgun) && fireball.sprite?.active) {
                if (!fireball._rock) {
                    const v = (this._magmaRockN = ((this._magmaRockN || 0) + 1) % MagmaStaff.MAGMA_VARIANTS);
                    const nova = fireball._isSupernova, big = fireball._isShotgun;   // the same molten rock as the fire ult's meteors, tumbling
                    ElementSystem.ultArt(this);
                    const haze = this.add.image(0, 0, 'vfx_glow').setTint(nova ? 0x4a8aff : 0xff6a1a).setBlendMode(Phaser.BlendModes.ADD).setScale(nova ? 0.7 : big ? 0.52 : 0.42).setAlpha(0.45);
                    const rock = this.add.sprite(0, 0, 'fx_ult_fi', 'met_0').setScale(nova ? 2.3 : big ? 1.75 : 1.4).play({ key: 'uf_met', startFrame: v % 3 });
                    if (nova) rock.setTint(0xaaccff);
                    fireball._hazeS = haze.scale;
                    fireball.fireGraphics?.clear();
                    fireball.sprite.add([haze, rock]);
                    fireball._rock = rock; fireball._haze = haze;
                }
                // magma dripping off it: a droplet that sags and cools behind the rock
                if (Math.random() < 0.18) {
                    const dx = fireball.sprite.x - fireball.dirX * 8 + (Math.random() - 0.5) * 8, dy = fireball.sprite.y - fireball.dirY * 8 + (Math.random() - 0.5) * 8;
                    const drop = this.add.circle(dx, dy, 1.6 + Math.random(), 0xff7a22, 0.95).setDepth(fireball.sprite.depth - 0.01);
                    this.tweens.add({ targets: drop, y: dy + 7, scaleX: 0.6, scaleY: 1.5, alpha: 0, duration: 380, ease: 'Quad.easeIn', onUpdate: (tw) => drop.setFillStyle(tw.progress > 0.5 ? 0x8a2a0c : 0xff7a22, 0.95), onComplete: () => drop.destroy() });
                }
                fireball._haze.setScale(fireball._hazeS * (0.95 + 0.12 * Math.sin(this.time.now * 0.03)));
                if (Math.random() < 0.5) this._vfxTrail?.fire?.emitParticleAt(fireball.sprite.x - fireball.dirX * 6, fireball.sprite.y - fireball.dirY * 6, 1);
            }
            // The Flame Sword's ember: its fire streaming off behind it
            else if (fireball._swordBolt) {
                const F = WeaponSystem.flames(this), bx = fireball.sprite.x - fireball.dirX * 5, by = fireball.sprite.y - fireball.dirY * 5;
                if (Math.random() < 0.45) F.small.emitParticleAt(bx + (Math.random() - 0.5) * 4, by + (Math.random() - 0.5) * 4, 1);
                if (Math.random() < 0.08) WeaponSystem.ember(this, bx, by, -fireball.dirX * 30 + (Math.random() - 0.5) * 40, -fireball.dirY * 30 - 20, 300);
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
                if (fireball.isStaffBall) Sfx.play(this, 'lava_splat');
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
            if (!hitEnemy && !fireball._noBoss && this.damageBossAtTile(tileX, tileY, fireball.damage * this._volleyMult(this._bossVolleyKey(), fireball.volleyId), undefined, 'fire')) {
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
                if (fireball.isStaffBall) Sfx.play(this, 'lava_splat');
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