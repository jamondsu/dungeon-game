// ═══════════════════════════════════════════════════════════════════════
// ELEMENTSYSTEM.JS — All four element ultimates and active abilities
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

class ElementSystem {

    // encased by the ice ult's end: no moving, attacking, dashing, switching, ults or gadgets till you've thawed
    _encased() { return (this._iceShellUntil || 0) > this.time.now || !!this._forkStop; }   // (and while Fork has time stopped)
    activateUlt(element = null) {
        if (this._encased()) return;
        // Check for ult inhibitors and absorbers nearby — both block activation
        if (this.enemies) {
            for (const enemy of this.enemies) {
                const isInhibitor = enemy.ultInhibitor;
                const isAbsorber  = enemy.isUltAbsorber;
                if (!isInhibitor && !isAbsorber) continue;
                const dist = Math.hypot(enemy.x - this.playerX, enemy.y - this.playerY);   // round, as its zone is drawn (it was a diamond)
                const radius = enemy.ultInhibitRadius || (isAbsorber ? 4 : 3);
                if (dist <= radius + 0.25) {
                    this.showStatusText(
                        this.player.x, this.player.y - 20,
                        isAbsorber ? 'ULT ABSORBED!' : 'ULT BLOCKED!',
                        isAbsorber ? '#cc44ff' : '#ff2200'
                    );
                    this.cameras.main.shake(80, 0.005);
                    return;
                }
            }
        }

        // ── FOUR GEMS ────────────────────────────────────────────────────────
        // Each element charges its own gem, and a full gem can be cast from ANY element: E casts
        // the one you hold, Z/X/C/V cast fire/ice/lightning/cosmic directly (castUlt). One
        // shared lockout keeps them from all going off at once. None of the four ults switch
        // you into their element: they all run on their own (their damage is typed, see the
        // call sites), so casting the fire ult while holding lightning is the point.
        // (The black hole used to run on its own battery; it's a gem like the rest now.)
        const el = element || this.currentElement;
        if (!this.ultGems || !(el in this.ultGems)) return false;
        const C = this._ultCfg();
        // Ascend (Cosmic.js) ignores the shared lockout and doesn't start it: it opens combos.
        const _ascend = el === 'cosmic' && !!this._csAscend;
        if (!_ascend && this.time.now < (this._ultLockUntil || 0)) { this._ultDeny(el, 'lock'); return false; }
        if (this._mods?.ultLong && Object.values(this.ultGems).some(v => v < this.ultChargeMax)) {   // Grand Overture: all four, then one
            this.showStatusText?.(this.player.x, this.player.y - 30, 'ALL FOUR GEMS FIRST', '#f0c8ff'); this._ultDeny(el, 'empty'); return false;
        }
        if (this.ultGems[el] < this.ultChargeMax) { this._ultDeny(el, 'empty'); return false; }

        this.ultGems[el] = 0;
        // Overflow: what charged past full turns into this ult's damage (+50% at a whole extra gem)
        const _ov = this._overflow?.[el] || 0, _ob = 0.5 * Math.min(1, _ov / this.ultChargeMax);
        (this._overflowBonus ||= {})[el] = _ob; if (this._overflow) this._overflow[el] = 0;
        if (_ob >= 0.05 && this.player) this.showStatusText?.(this.player.x, this.player.y - 44, `OVERFLOW +${Math.round(_ob * 100)}%`, '#ffd060');
        Telemetry.ult(this, el);
        if (this._mods?.ultHeal && this.health > 0 && this.player) {   // Mending Chord (a relic): every ult cast heals, never past max
            const before = this.health; this.health = Math.min(this.maxHealth, this.health + this.maxHealth * this._mods.ultHeal);
            const h = Math.round(this.health - before); if (h > 0) { this.showStatusText?.(this.player.x, this.player.y - 56, `+${h} HP`, '#7dff9a'); this._vfxFlash?.(this.player.x, this.player.y, 70, 0x7dff9a, 260, 0.6); }
        }
        this.ultCharge = this.ultGems[this.currentElement] || 0;
        if (!_ascend) this._ultLockUntil = this.time.now + C.LOCKOUT_MS;
        this._ultNoChargeUntil[el] = this.time.now + C.NO_CHARGE_MS[el];
        if (_ascend) this._ultCastAt[el] = this.time.now;   // Ascend draws its own banner
        else this._ultCastFx(el);
        this.updateHUD();

        const cast = () => {
            if (el === 'fire') {
                this.activateFireScorch();
            } else if (el === 'ice') {
                this.activateIceBlizzard();
            } else if (el === 'lightning') {
                // Mark lightning ult as used (level 2 boss room gate)
                if (this.isLightningTutorial) this._lightningUltUsed = true;
                this._forkBegin();   // Fork (activateLightningStorm is the old glide, unused)
            } else if (el === 'cosmic') {
                if (_ascend) this._csAscend?.();   // Cosmic.js
                else this.activateCosmicBlackHole();
            }
        };
        if (this._asUlt) this._asUlt(el, cast); else cast();   // its hits are ult damage (CombatSystem._asUlt)
        if (typeof CreatureFX !== 'undefined') CreatureFX.ultArmor(this, el, { fire: this.ignitionDuration * (this._mods?.ultLong || 1), ice: this._iceFrostCfg().MS * (this._mods?.ultLong || 1) + this._iceFrostCfg().ZOOM_MS,   // the ice king suit, the whole frost
                     lightning: this._forkCfg().AFTER_MS }[el]);   // its armour while it runs
        return true;
    }

    // Z/X/C/V. A second press does what E does inside that ult: the black hole bomb in flight
    // detonates, and the ice ult ends early (into its shell).
    // X (or E holding ice) again while the frost runs ends it early: straight into the ice shell, as at its end
    _iceFrostEarly() {
        const now = this.time.now;
        if (!(now < (this._iceFrostUntil || 0)) || this._iceShellUntil || now - (this._iceFrostAt || 0) < 1000) return false;   // (not in the first second: no double-tap accidents)
        this._iceFrostUntil = now; if (this._ultNoChargeUntil) this._ultNoChargeUntil.ice = now + this._iceFrostCfg().SHELL_MS;   // the gem's seal ends with it
        return true;
    }
    castUlt(el) {
        if (this._encased()) return;
        if (el === 'cosmic' && this.cosmicBlackHoleProjectile) { this.detonateCosmicBomb(); return; }
        if (el === 'ice' && this._iceFrostEarly()) return;
        if (this.activateUlt(el)) this._tutorialUltGate(el);
    }

    // The two tutorial rooms that won't open until you use an ult. E calls this on every press
    // (as it always has); Z/X/C/V only when the cast went off.
    _tutorialUltGate(el) {
        // Tutorial room 1 (fire tutorial only): track ult usage, then unlock element switching
        if (this.isTutorial && !this.isIceTutorial && this.getCurrentPlayerRoom() === 1) {
            this._ultUsedInRoom2 = true;
            this.tutorialWeaponLocked = false;
            const room1Enemies = this.enemies.filter(e => e.tutorialRoomIndex === 1);
            if (room1Enemies.length === 0 && this._roomHadEnemies?.[1]) {
                this.onTutorialRoomClear(1);
            }
        }
        // Ice tutorial room 3: track ice ult usage
        if (this.isIceTutorial && el === 'ice' && this.getCurrentPlayerRoom() === 3) {
            this._iceUltUsed = true;
            const room3Enemies = this.enemies.filter(e => e.tutorialRoomIndex === 3);
            if (room3Enemies.length === 0 && this._roomHadEnemies?.[3]) {
                this.onTutorialRoomClear(3);
            }
        }
    }

    // Every ult number in one place.
    _ultCfg() {
        if (this._ultCfgCache) return this._ultCfgCache;
        return (this._ultCfgCache = {
            KEYS:   { fire: Settings.label(Settings.key('ultFire')), ice: Settings.label(Settings.key('ultIce')),
                      lightning: Settings.label(Settings.key('ultLightning')), cosmic: Settings.label(Settings.key('ultCosmic')) },
            COLORS: { fire: 0xff6a2a, ice: 0x72dcff, lightning: 0xffe14a, cosmic: 0xb47cff },
            // A short shared cooldown after any cast, so four full gems are a sequence rather
            // than one button-mash nuke.
            LOCKOUT_MS: 5000,
            // A hit on an enemy carrying another element's status charges this much more.
            REACTION_MULT: 3,
            // Residue: a hit on an enemy that another element HIT (not statused) in the last RESIDUE_MS charges
            // this much: a weaker reaction, so quick swaps pay a little even before a status takes hold.
            RESIDUE_MULT: 1.75, RESIDUE_MS: 1500,
            // While its own ult (or what it leaves behind) is still working, a gem doesn't
            // charge, so no ult can refill itself. Fire's runs 3.5s past the ult for the lava
            // its pellets leave (it paid back ~18% of the gem on a pack). Ice: wave + 4s freeze +
            // shatter (~5.7s), plus the 3.5s an ice cube the shatter chills can last before it
            // shatters too. Lightning: the 4s storm. Cosmic: the bomb's flight (1.7s at most) +
            // the 4s hole + its collapse.
            // The HUD shows it as a white ring running down on that gem.
            NO_CHARGE_MS: { fire: 8500, ice: this._iceFrostCfg().ZOOM_MS + this._iceFrostCfg().MS + this._iceFrostCfg().SHELL_MS, lightning: 4500, cosmic: 6000 },   // cosmic: Ascend's 6s; ice: the whole Blizzard, its shell too (an early exit cuts it, _iceFrostEarly)
            // Per-weapon charge scaling. Raw rates (charge per second into its own gem, the mean
            // of one target and a pack of five, measured against dummies) run
            // from 7.4 (Flame Fists) to 80 (Fractal Shard): splitter shards each charge, so the
            // fastest weapons would refill a bar in under two seconds. Scaled so every weapon
            // fills its gem in about 45s of camping; rotating elements roughly halves that
            // (reactions). Re-measured 2026-10-17: lava stopped dealing damage (and charging) in
            // the burn rework, which took fire's raw rates down to a third.
            WEAPON_MULT: {
                flame_fists:       0.3011,   // raw 7.38/s (was 23.08)
                flame_sword:       0.2308,   // raw 9.63/s (was 33.11)
                magma_staff:       0.1016,   // raw 21.87/s (was 51.4)
                ignition:          0.0827,   // raw 26.9/s as the flamethrower (2026-10-20; it filled in 98s at 0.038)
                ice_fists:         0.2788,   // raw 7.97/s
                icicle_cannon:     0.1475,   // raw 15.07/s
                fractal_shard:     0.0278,   // raw 79.9/s
                lightning_fists:   0.1599,   // raw 13.9/s
                orb_emitter:       0.131,    // raw 16.96/s (was 5.9: its forks amp now)
                ball_lightning:    0.074,    // raw 30.03/s
                conductor:         0.09,     // (first guess, unmeasured)
                // The cosmic gem fills with time (Cosmic.js), never from hits, so these are moot.
                cosmic_fists:      0,
                barrier_staff:     0,
                astrolabe:         0,
                singularity_staff: 0,
                void_blade:        0,
            },
            // The one knob for all of the above: 1.5 fills every gem in ~30s of camping, 0.75 in
            // ~60s. Rotating stays about twice as fast either way.
            CHARGE_SCALE: 1,
            // A cosmic kill-drop (50% per kill while holding cosmic): a twentieth of the gem.
            // The battery's tenth was for a 5-charge ult; with hits also charging the gem, a
            // tenth would make cosmic the fastest element on any floor with lots of kills.
            COSMIC_DROP: 0,   // Cosmic.js: the cosmic gem fills with time only
        });
    }

    _ultDeny(el, why) {
        this._ultDenyAt[el] = this.time.now;     // the HUD shakes that gem
        Sfx.play(this, 'deny');
        if (why === 'lock' && this.player) {
            const s = Math.ceil(((this._ultLockUntil || 0) - this.time.now) / 1000);
            this.showStatusText(this.player.x, this.player.y - 22, `ULT READY IN ${s}s`, '#c8d0de');
        }
    }

    // The cast flourish: two rings off the player in the gem's colour (the ults bring their
    // own big effects; this just says which gem went).
    _ultCastFx(el) {
        const col = this._ultCfg().COLORS[el];
        this._ultCastAt[el] = this.time.now;     // the HUD bursts that gem
        this._vfxUltBanner?.(el);                // its name, big, in its colour (Visuals.js)
        if (!this.player) return;
        for (let i = 0; i < 2; i++) {
            const ring = this.add.circle(this.player.x, this.player.y, 8, col, 0).setDepth(6);
            ring.setStrokeStyle(3 - i, col, 0.9);
            this.tweens.add({ targets: ring, radius: 64 + i * 34, alpha: 0, duration: 420 + i * 160,
                              delay: i * 70, ease: 'Cubic.easeOut', onComplete: () => ring.destroy() });
        }
    }

    // A reaction: a ring in the hitting element's colour with four motes of the status it
    // landed on. Rate-limited per enemy and per frame, so a crowd doesn't turn into confetti.
    _ultReactionSpark(enemy, el, other, residue = false) {
        const now = this.time.now;
        const at = enemy?.sprite?.active ? enemy.sprite : enemy?.container?.active ? enemy.container : null;  // bosses: container
        if (!at || now - (enemy._lastReactFx || -1e9) < 350) return;
        if (now - (this._reactFxWindow || -1e9) > 100) { this._reactFxWindow = now; this._reactFxCount = 0; }
        if (++this._reactFxCount > 6) return;
        enemy._lastReactFx = now;
        const C = this._ultCfg();
        const g = this.add.graphics().setDepth(5);
        g.x = at.x; g.y = at.y - 6;                          // drawn at local (0,0), placed by x/y
        g.lineStyle(residue ? 1.5 : 2, C.COLORS[el], residue ? 0.6 : 0.95); g.strokeCircle(0, 0, residue ? 5 : 7);
        g.fillStyle(C.COLORS[other], 0.95);
        for (let i = 0; i < (residue ? 2 : 4); i++) {
            const a = i * Math.PI / (residue ? 1 : 2) + Math.PI / 4;
            g.fillCircle(Math.cos(a) * 10, Math.sin(a) * 10, 1.9);
        }
        this.tweens.add({ targets: g, scaleX: 1.8, scaleY: 1.8, alpha: 0, angle: 45, duration: 280,
                          ease: 'Quad.easeOut', onComplete: () => g.destroy() });
        // and say so, now and then: the ring alone was easy to miss (the ult charges ×REACTION_MULT)
        if (now - (this._reactLabelAt || -1e9) > 900) {
            this._reactLabelAt = now;
            this.showStatusText?.(at.x, at.y - 28, residue ? `RESIDUE ×${C.RESIDUE_MULT}` : `REACTION ×${C.REACTION_MULT}`, '#' + C.COLORS[el].toString(16).padStart(6, '0'));
        }
    }

    // ── SCORCH (the fire ult) ────────────────────────────────────────────────
    // The camera punches in on you and you laugh; then meteors of molten rock come down out of the sky all over the room:
    // an opening volley, then one every 1-3s while it lasts. Each is its own size: the bigger, the wider it hits and the
    // more lava it leaves. A meteor crashes in on a streak of fire (its shadow on the floor growing as it comes), punches
    // a crater, and sits half-buried in it cooling from white-hot to dark for EMBED_MS, smoking. What it lands on takes a
    // hit and is Dazed.
    // While it runs: Super Burn comes only from your dash rushing straight through enemies (a stack each), the dash
    // goes farther and recovers faster, every burn tick heals you a little (capped), and you can't switch away from fire. Stage 2: every meteor also sets the blue supernova fuse on what it hits.
    _scorchCfg() {
        return {
            OPEN_N: 7, OPEN_MIN: 4, OPEN_MS: 1100, EVERY: [1500, 3000], FALL_MS: 520, EMBED_MS: 3000,
            SIZE: [0.75, 1.6], R: [1.3, 1.2], DMG: 16, DAZE_MS: 1000,   // impact radius R0 + R1 * size tiles; DMG * size; each one it hits is dazed and takes a Super Burn stack
            HEAL_TICK: 0.0025, HEAL_CAP: 0.03, HEAL_TOTAL: 0.2, OVERHEAL: 0.2,   // of your max HP: a burn tick, at most a second, at most over the whole ult; and how far past full it can take you
            DASH_TILES: 6, ZOOM: 1.45,   // the fire dash while it runs: farther (its quicker recovery is gone: too strong)
            POOL_MS: 1500, POOL_BIG: 1.25,   // each meteor leaves a pool of white-hot lava for POOL_MS that Super Burns what stands in it: 3x3, or a 5x5 squircle from one POOL_BIG or bigger
            AURA_R: 6, AURA_EVERY: 1000,   // the fiery aura round you: every AURA_EVERY one enemy in AURA_R tiles takes a Super Burn stack, picked by its HP (more HP, likelier)
            STRIKE_N: [2, 3],   // the periodic strikes after the opening volley, this many at a time
            // Meteor Strike (the attack once the opening volley's down): click an area and N meteors fall into it at random, AREA
            // tiles round the cursor, GAP ms apart, a strike every CD ms. Each hits everything in R tiles for DMG (FALL lost at the
            // rim), dazes it DAZE_MS, and Super Burns one thing: the enemy with the most HP it hit.
            BARRAGE: { N: [4, 5], CD: 900, GAP: 110, AREA: 3.2, SIZE: 1.1, R: 1.8, DMG: 38, FALL: 0.6, DAZE_MS: 400 },   // (flat damage, no share of HP)
        };
    }
    // Scorch's aura: a haze of heat round you (drifting fire puffs, embers rising) and, every AURA_EVERY, a Super Burn stack
    // on one enemy inside it, weighted by current HP: the big ones catch first
    _scorchAura() {
        const C = this._scorchCfg(), T = this.TILE_SIZE, ADD = Phaser.BlendModes.ADD;
        const puffs = Array.from({ length: 16 }, (_, i) => ({ img: this.add.image(0, 0, 'vfx_glow').setTint([0xff6a1a, 0xff9a3a, 0xc8401a][i % 3]).setBlendMode(ADD).setDepth(0.9),
            a: Math.random() * Math.PI * 2, d: 0.35 + 0.65 * Math.sqrt(Math.random()), spin: (Math.random() - 0.5) * 0.0012, s: 0.7 + Math.random() * 0.6, ph: Math.random() * 6 }));
        const embers = this.add.particles(0, 0, 'vfx_dot', { lifespan: { min: 700, max: 1300 }, speedY: { min: -60, max: -25 }, speedX: { min: -12, max: 12 }, scale: { start: 0.35, end: 0 },
            alpha: { start: 0.9, end: 0 }, tint: [0xffd27a, 0xff8a2a, 0xff5a1a], blendMode: 'ADD', frequency: 40,
            emitZone: { type: 'random', source: new Phaser.Geom.Ellipse(0, 0, C.AURA_R * T * 2, C.AURA_R * T * 0.9) } }).setDepth(4.4);
        const t0 = this.time.now; let next = t0 + C.AURA_EVERY;
        const tick = () => {
            const now = this.time.now;
            if (!this.ignitionActive || !this.player?.active) { this.events.off('update', tick); embers.stop(); this.tweens.add({ targets: puffs.map(p => p.img), alpha: 0, duration: 400, onComplete: () => puffs.forEach(p => p.img.destroy()) }); this.time.delayedCall(1400, () => embers.destroy()); return; }
            const px = this.player.x, py = this.player.y, grow = Math.min(1, (now - t0) / 500), R = C.AURA_R * T * grow;
            for (const p of puffs) {
                p.a += p.spin * 16;
                p.img.setPosition(px + Math.cos(p.a) * R * p.d, py + Math.sin(p.a) * R * p.d * 0.55).setScale(p.s * (1.6 + 0.3 * Math.sin(now * 0.002 + p.ph))).setAlpha(0.13 + 0.05 * Math.sin(now * 0.003 + p.ph));
            }
            embers.setPosition(px, py);
            if (now < next) return;
            next = now + C.AURA_EVERY;
            const L = (this.enemies || []).filter(e => !this._phasedOut?.(e) && e.sprite?.active && e.health > 0 && Math.hypot(e.x - this.playerX, e.y - this.playerY) <= C.AURA_R);
            const sum = L.reduce((n, e) => n + e.health, 0);
            if (!L.length || !(sum > 0)) return;
            let r = Math.random() * sum, pick = L[L.length - 1];
            for (const e of L) { r -= e.health; if (r <= 0) { pick = e; break; } }
            this.applySuperBurn(pick, 1);
            this._vfxFlash?.(pick.sprite.x, pick.sprite.y - 6, 30, 0xff8a2a, 220, 0.7);
        };
        this.events.on('update', tick); this.events.once('shutdown', () => this.events.off('update', tick));   // (a restart keeps scene listeners: this one would run on into the next level)
    }
    activateFireScorch() {
        const C = this._scorchCfg();
        this.ultDrainActive = true;
        this.ultDrainStartTime = this.time.now;
        const DUR = this.ignitionDuration * (this._mods?.ultLong || 1);   // Grand Overture runs it longer
        this.ultDrainDuration = DUR;
        this.ignitionActive = true;
        this._scorchAura();   // the fiery aura round you
        this.ignitionEndTime = this.time.now + DUR;
        this._scorchHealt = 0;   // healing so far this cast (HEAL_TOTAL)
        if (this.currentElement !== 'fire') this.switchToElement?.('fire');
        // the camera punches in, you laugh, and it pulls back as the sky opens
        const cam = this.cameras.main, z0 = cam.zoom;
        this.tweens.add({ targets: cam, zoom: z0 * C.ZOOM, duration: 320, ease: 'Cubic.easeOut', onComplete: () => this.tweens.add({ targets: cam, zoom: z0, duration: 520, delay: 520, ease: 'Sine.easeInOut' }) });
        Sfx.play(this, 'laugh');
        const flash = this.add.rectangle(this.scale.width / 2, this.scale.height / 2, this.scale.width, this.scale.height, 0xff3300, 0.35).setScrollFactor(0).setDepth(20);
        this.tweens.add({ targets: flash, alpha: 0, duration: 500, onComplete: () => flash.destroy() });
        this.player.setTint(0xff6600);
        // the opening volley, then one now and then
        const ri = this.getCurrentPlayerRoom?.() ?? -1, RM = ri >= 0 ? this.rooms?.[ri] : null;
        const N = RM ? Math.max(C.OPEN_MIN, Math.min(C.OPEN_N, Math.round(RM.w * RM.h / 50))) : C.OPEN_N;   // about a meteor per 50 tiles of room, OPEN_MIN to OPEN_N
        this.time.delayedCall(700, () => { for (let i = 0; i < N; i++) this.time.delayedCall(i * C.OPEN_MS / N, () => this.ignitionActive && this._scorchMeteor()); });
        const next = () => { if (!this.ignitionActive) return; const n = C.STRIKE_N[0] + Math.floor(Math.random() * (C.STRIKE_N[1] - C.STRIKE_N[0] + 1)); for (let i = 0; i < n; i++) this.time.delayedCall(i * 160, () => this.ignitionActive && this._scorchMeteor()); this.time.delayedCall(C.EVERY[0] + Math.random() * (C.EVERY[1] - C.EVERY[0]), next); };
        this._barrageOn = false; this._barrageAt = 0;
        this.time.delayedCall(700 + C.OPEN_MS, () => { if (!this.ignitionActive) return; this._barrageOn = true; this.showStatusText?.(this.player.x, this.player.y - 34, 'METEOR STRIKE', '#ffb04a'); Sfx.play(this, 'e_riser', { r: 2 }); });   // the opening volley's down: your attack becomes the barrage
        this.time.delayedCall(700 + C.OPEN_MS + C.EVERY[0], next);
        this.time.delayedCall(DUR, () => {
            this.ignitionActive = false; this._barrageOn = false;
            this.ultDrainActive = false;
            this.player.clearTint();
        });
    }
    // A meteor onto a random open floor tile in the room (or near you outside one).
    _scorchMeteor(at = null, B = null) {   // at: { tx, ty } where it lands (else somewhere in the room); B: a Meteor Strike meteor
        const C = this._scorchCfg(), T = this.TILE_SIZE, ri = this.getCurrentPlayerRoom?.() ?? -1, R = ri >= 0 ? this.rooms?.[ri] : null;
        let tx = at?.tx, ty = at?.ty;
        for (let n = 0; n < 30 && !at; n++) {
            tx = R ? R.x + 1 + Math.floor(Math.random() * (R.w - 2)) : this.playerX - 10 + Math.floor(Math.random() * 21);
            ty = R ? R.y + 1 + Math.floor(Math.random() * (R.h - 2)) : this.playerY - 8 + Math.floor(Math.random() * 17);
            if (this.world?.[tx]?.[ty] === this.FLOOR && !this.isInLockedRoom?.(tx, ty)) break;
            tx = null;
        }
        if (tx == null) return;
        const size = B ? B.SIZE * (0.9 + Math.random() * 0.2) : C.SIZE[0] + Math.random() * (C.SIZE[1] - C.SIZE[0]), x = tx * T + T / 2, y = ty * T + T / 2, ADD = Phaser.BlendModes.ADD;
        // falling: its shadow grows on the floor; the rock comes down on a slant, spinning, trailing fire
        const shadow = this.add.ellipse(x, y + 4, T * 2 * size, T * size, 0x000000, 0.45).setDepth(0.6).setScale(0.2);
        this.tweens.add({ targets: shadow, scale: 1, duration: C.FALL_MS, ease: 'Quad.easeIn' });
        const key = ElementSystem.meteorKey(this, Math.floor(Math.random() * 3));
        const rock = this.add.image(x + 140, y - 300, key).setScale(1.8 * size).setDepth(6);
        Sfx.play(this, 'meteor_fall', { ms: C.FALL_MS, small: !!B });
        const glow = this.add.image(rock.x, rock.y, 'vfx_glow').setTint(0xff6a1a).setBlendMode(ADD).setDepth(5.9).setScale(0.6 * size);
        const f = { t: 0 };
        this.tweens.add({ targets: f, t: 1, duration: C.FALL_MS, ease: 'Quad.easeIn', onUpdate: () => {
            const px = x + 140 * (1 - f.t), py = y - 300 * (1 - f.t);
            rock.setPosition(px, py).setRotation(f.t * 6); glow.setPosition(px, py);
            for (let k = 0; k < 2; k++) { const e = this.add.rectangle(px + Math.random() * 6, py - Math.random() * 6, 3 * size, 3 * size, k ? 0xffb040 : 0xff5a1a).setDepth(5.8).setBlendMode(ADD); this.tweens.add({ targets: e, x: e.x + 14, y: e.y - 24, alpha: 0, scale: 0.3, duration: 320, onComplete: () => e.destroy() }); }
        }, onComplete: () => { shadow.destroy(); this._scorchImpact(x, y, tx, ty, size, rock, glow, B); } });
    }
    // A meteor of molten rock, 32 x 32 (v: three of them): a ball of black basalt crust split into plates by cracks of lava,
    // orange at their edges and white-hot down the middle; lit molten from the upper left, a glowing rim all round
    static meteorKey(scene, v = 0) {
        return MenuArt.tex(scene, 'fx_meteor_' + v, 32, 32, P => {
            const R = MenuArt.rng(91 + v * 37), n = MenuArt.noise(17 + v), M = MenuArt.mix, cx = 16, cy = 16;
            const seeds = Array.from({ length: 8 }, () => [cx + (R() - 0.5) * 22, cy + (R() - 0.5) * 22]);
            for (let y = 0; y < 32; y++) for (let x = 0; x < 32; x++) {
                const dx = x + 0.5 - cx, dy = y + 0.5 - cy, d = Math.hypot(dx, dy), edge = 11 + n(x * 0.35, y * 0.35) * 2.5 - 1;
                if (d > edge + 1.6) continue;
                if (d > edge) { P.put(x, y, 0xc8401a, 0.35 * (1 - (d - edge) / 1.6)); continue; }   // a faint molten halo
                const ds = seeds.map(([sx, sy]) => Math.hypot(x + 0.5 - sx, y + 0.5 - sy)).sort((a, b) => a - b), crack = ds[1] - ds[0];
                const lit = Math.max(0, (-dx - dy) / (edge * 1.4)), shade = Math.max(0, (dx + dy) / (edge * 1.4));
                let c;
                if (crack < 0.55) c = 0xffb040; else if (crack < 1.2) c = 0xff6a1a; else if (crack < 1.7) c = 0xa8320e;   // the lava in the cracks, thin (bright ones hid what it hit)
                else { c = M(0x3a1a12, 0x1a0806, shade); if (n(x * 0.8, y * 0.8) > 0.66) c = 0x4a2418; c = M(c, 0xc85a2a, lit * 0.3); }   // the crust, lit warm from above
                if (d > edge - 1.2) c = M(c, 0xc8501a, 0.4);   // its rim, warm
                P.put(x, y, c);
            }
        });
    }
    // ── METEOR BARRAGE ── the fire ult's attack once its opening volley is down: N huge meteors fired at the crosshair
    _meteorBarrage(sx, sy) {
        const B = this._scorchCfg().BARRAGE, now = this.time.now;
        if (now < (this._barrageAt || 0)) return;
        this._barrageAt = now + B.CD;
        const T = this.TILE_SIZE, cam = this.cameras.main, wx = sx + cam.scrollX, wy = sy + cam.scrollY;   // (screen to world, like the old shotgun burst)
        const cx = Math.floor(wx / T), cy = Math.floor(wy / T), n = B.N[0] + Math.floor(Math.random() * (B.N[1] - B.N[0] + 1));
        this._gearFiredAt = now;
        const go = () => { for (let i = 0; i < n; i++) this.time.delayedCall(i * B.GAP, () => {
            if (!this.ignitionActive || !this.player?.active) return;
            let tx = cx, ty = cy;
            for (let k = 0; k < 12; k++) {   // somewhere in the area, on the floor
                const a = Math.random() * Math.PI * 2, d = Math.sqrt(Math.random()) * B.AREA, x = Math.round(cx + Math.cos(a) * d), y = Math.round(cy + Math.sin(a) * d);
                if (this.world?.[x]?.[y] === this.FLOOR) { tx = x; ty = y; break; }
            }
            this._scorchMeteor({ tx, ty }, B);
        }); };
        this._asUlt ? this._asUlt('fire', go) : go();   // ult damage
    }
    // one barrage meteor: fired straight from the slime toward (tx, ty), spinning, trailing fire; it bursts on the first
    // enemy or wall in its way, else where you aimed
    _barrageMeteor(tx, ty, B) {
        const T = this.TILE_SIZE, ADD = Phaser.BlendModes.ADD, size = B.SIZE * (0.9 + Math.random() * 0.2), px0 = this.playerX, py0 = this.playerY;
        const n = Math.max(1, Math.ceil(Math.hypot(tx - px0, ty - py0) * 2));
        let ex = tx, ey = ty;
        for (let k = 1; k <= n; k++) {   // its line, half a tile at a time
            const cx = Math.round(px0 + (tx - px0) * k / n), cy = Math.round(py0 + (ty - py0) * k / n);
            if (this.world?.[cx]?.[cy] !== this.FLOOR) break;
            ex = cx; ey = cy;
            if (this.getEnemyAt?.(cx, cy)) break;
        }
        const x0 = this.player.x, y0 = this.player.y - 6, x = ex * T + T / 2, y = ey * T + T / 2;
        const key = ElementSystem.meteorKey(this, Math.floor(Math.random() * 3));
        const rock = this.add.image(x0, y0, key).setScale(1.5 * size).setDepth(6);
        const glow = this.add.image(x0, y0, 'vfx_glow').setTint(0xff6a1a).setBlendMode(ADD).setDepth(5.9).setScale(0.5 * size).setAlpha(0.45);
        const dur = Math.max(90, Math.hypot(x - x0, y - y0) / T * 1000 / B.SPEED), f = { t: 0 }, ang = Math.atan2(y - y0, x - x0);
        const tail = this.add.image(x0, y0, 'vfx_glow').setTint(0xff4a10).setBlendMode(ADD).setDepth(5.85).setOrigin(0.15, 0.5).setRotation(ang + Math.PI).setScale(1.6 * size, 0.42 * size).setAlpha(0.45);   // a comet's tail of fire
        const tail2 = this.add.image(x0, y0, 'vfx_glow').setTint(0xffd060).setBlendMode(ADD).setDepth(5.86).setOrigin(0.15, 0.5).setRotation(ang + Math.PI).setScale(0.9 * size, 0.22 * size).setAlpha(0.5);
        this.tweens.add({ targets: f, t: 1, duration: dur, ease: 'Linear', onUpdate: () => {
            const px = x0 + (x - x0) * f.t, py = y0 + (y - y0) * f.t;
            rock.setPosition(px, py).setRotation(f.t * 10); glow.setPosition(px, py); tail.setPosition(px, py).setScale((1.6 + Math.random() * 0.4) * size, 0.42 * size); tail2.setPosition(px, py);
            if (Math.random() < 0.5) { const d = this.add.circle(px, py, 2 * size, 0xff8a2a).setDepth(5.7).setBlendMode(ADD); this.tweens.add({ targets: d, y: d.y + 10 + Math.random() * 8, alpha: 0, scale: 0.3, duration: 320, onComplete: () => d.destroy() }); }   // lava dripping off it
            const e = this.add.rectangle(px + (Math.random() - 0.5) * 6, py + (Math.random() - 0.5) * 6, 3 * size, 3 * size, Math.random() < 0.5 ? 0xffb040 : 0xff5a1a).setDepth(5.8).setBlendMode(ADD);
            this.tweens.add({ targets: e, alpha: 0, scale: 0.2, duration: 240, onComplete: () => e.destroy() });
        }, onComplete: () => { tail.destroy(); tail2.destroy(); this._scorchImpact(x, y, ex, ey, size, rock, glow, B); } });
    }
    _scorchImpact(x, y, tx, ty, size, rock, glow, B = null) {   // B: a barrage meteor (its own reach, damage and daze; Super Burn on what it lands on)
        const C = this._scorchCfg(), T = this.TILE_SIZE, ADD = Phaser.BlendModes.ADD, R = B ? B.R : C.R[0] + C.R[1] * size, now = this.time.now;
        Sfx.play(this, 'meteor_hit', { small: !!B }); this.cameras.main.shake(B ? 60 : 110 + 90 * size, B ? 0.002 : 0.004 + 0.004 * size);
        for (let ox = -Math.ceil(R); ox <= Math.ceil(R); ox++) for (let oy = -Math.ceil(R); oy <= Math.ceil(R); oy++) if (Math.hypot(ox, oy) <= R) this._evaporate?.(tx + ox, ty + oy, 6);   // it boils the water off to fog
        this._vfxFlash?.(x, y, R * T * (B ? 0.9 : 1.3), 0xff7a2a, B ? 220 : 340, B ? 0.35 : 0.55);   // a barrage's flash kept low: five of them blinded the fight
        VisualFX.impact(this, x, y, 'fire', B ? 10 + 6 * size : 16 + 14 * size);
        const wave = this.add.ellipse(x, y + 4, T, T * 0.5).setStrokeStyle(3, 0xffb040, 1).setBlendMode(ADD).setDepth(3.5);
        this.tweens.add({ targets: wave, scale: R * 2.2, alpha: 0, duration: 420, ease: 'Quad.easeOut', onComplete: () => wave.destroy() });
        for (let i = 0; i < 14; i++) { const a = Math.random() * Math.PI * 2, d = R * T * (0.5 + Math.random() * 0.7), c = i % 3 ? 0x5a4a44 : 0xff8a2a, ch = this.add.rectangle(x, y, 3 + Math.random() * 3, 3, c).setDepth(5.5); this.tweens.add({ targets: ch, x: x + Math.cos(a) * d, y: y + Math.sin(a) * d * 0.6 - 10, angle: 300, alpha: 0, duration: 520, ease: 'Quad.easeOut', onComplete: () => ch.destroy() }); }
        // the crater: scorched ground, cracks glowing out of it, a raised rim
        const cr = this.add.graphics().setDepth(0.62).setPosition(x, y + 4), CR = T * (0.7 + 0.45 * size);
        cr.fillStyle(0x140a06, 0.75); cr.fillEllipse(0, 0, CR * 2.4, CR * 1.3);
        cr.lineStyle(3, 0x3a2a22, 0.9); cr.strokeEllipse(0, 0, CR * 2.4, CR * 1.3);
        const crk = this.add.graphics().setDepth(0.63).setPosition(x, y + 4).setBlendMode(ADD);
        for (let k = 0; k < 7; k++) { let a = Math.random() * Math.PI * 2, px = Math.cos(a) * CR * 0.6, py = Math.sin(a) * CR * 0.35; crk.lineStyle(2, 0xff6a1a, 0.9); crk.beginPath(); crk.moveTo(px, py); for (let j = 0; j < 3; j++) { a += (Math.random() - 0.5) * 0.7; px += Math.cos(a) * CR * 0.4; py += Math.sin(a) * CR * 0.22; crk.lineTo(px, py); } crk.strokePath(); }
        // the rock, half-buried, cooling from white-hot to dark; smoke off it
        rock.setPosition(x, y - 2).setRotation(0.4).setDepth(1.02).setCrop(0, 0, rock.frame.width, rock.frame.height * 0.72);
        glow.setPosition(x, y).setTint(0xff9a4a).setScale((B ? 0.5 : 0.9) * size).setAlpha(B ? 0.4 : 0.9);
        const cool = { k: 0 };
        this.tweens.add({ targets: cool, k: 1, duration: C.EMBED_MS, onUpdate: () => {
            const c = Phaser.Display.Color.Interpolate.ColorWithColor(Phaser.Display.Color.ValueToColor(0xffffff), Phaser.Display.Color.ValueToColor(0x6a5048), 100, Math.round(cool.k * 100));
            rock.setTint(Phaser.Display.Color.GetColor(c.r, c.g, c.b)); glow.setAlpha(0.9 * (1 - cool.k)); crk.setAlpha(1 - cool.k * 0.8);
            if (Math.random() < 0.15) { const sm = this.add.circle(x + (Math.random() - 0.5) * T, y - 6, 3 + 2 * size, 0x2a2420, 0.4).setDepth(5.4); this.tweens.add({ targets: sm, y: sm.y - 30, x: sm.x + 6, scale: 2.4, alpha: 0, duration: 1000, onComplete: () => sm.destroy() }); }
        }, onComplete: () => this.tweens.add({ targets: [rock, glow, cr, crk], alpha: 0, duration: 400, onComplete: () => [rock, glow, cr, crk].forEach(o => o.destroy()) }) });
        // the hit: damage, Dazed for 2s, a Super Burn stack (stage 2: the supernova fuse too)
        if (B?.hostile) { B.hostile(tx, ty, R); return; }   // an Ult Absorber's stolen meteor: it lands on you, not them
        const PR = size >= C.POOL_BIG ? 2 : 1;   // its pool
        for (let ox = -PR; ox <= PR; ox++) for (let oy = -PR; oy <= PR; oy++) {
            if (PR === 2 && Math.abs(ox) === 2 && Math.abs(oy) === 2) continue;   // (the squircle: corners off)
            if (this.world?.[tx + ox]?.[ty + oy] !== this.FLOOR) continue;
            this.spawnIgnitionTrail((tx + ox) * T + T / 2, (ty + oy) * T + T / 2, C.POOL_MS, { superBurn: true });
        }
        const stage2 = parseInt(localStorage.getItem('ultStage_fire') || '1') >= 2;
        if (B) {   // a Meteor Strike meteor: everything in reach hit and dazed a moment; the enemy with the most HP it hit Super Burned
            const hit = [...this.enemies].filter(e => !this._phasedOut?.(e) && e.sprite?.active && e.health > 0 && Math.hypot(e.x - tx, e.y - ty) <= R);
            const direct = hit.reduce((a, e) => !a || e.health > a.health ? e : a, null);
            for (const e of [...this.enemies]) {
                const dd = Math.hypot(e.x - tx, e.y - ty); if (!e.sprite?.active || e.health <= 0 || dd > R || this._phasedOut?.(e)) continue;
                this.damageEnemy(e, B.DMG * size * (1 - B.FALL * dd / R) * (this.damageScaling || 1), 'fire');   // full at the middle, a quarter at the rim
                if (!e.sprite?.active || e.health <= 0) continue;
                e.isStunned = true; e.stunnedUntil = Math.max(e.stunnedUntil || 0, now + B.DAZE_MS);
            }
            if (direct?.sprite?.active && direct.health > 0) { this.applySuperBurn(direct, 1); this.showStatusText?.(direct.sprite.x, direct.sprite.y - 20, 'SUPER BURN', '#ff8a3a'); }
            this.damageBossAtTile?.(tx, ty, B.DMG * size * (this.damageScaling || 1), undefined, 'fire');
            this._hitPortalsAround?.(tx, ty, R, B.DMG * size * (this.damageScaling || 1), true);   // queens in reach (not just one it lands on)
            return;
        }
        for (const e of [...this.enemies]) {
            if (this._phasedOut?.(e)) continue;
            if (!e.sprite?.active || e.health <= 0 || Math.hypot(e.x - tx, e.y - ty) > R) continue;
            this.damageEnemy(e, C.DMG * size * (this.damageScaling || 1), 'fire');
            if (!e.sprite?.active || e.health <= 0) continue;
            e.isStunned = true; e.stunnedUntil = Math.max(e.stunnedUntil || 0, now + C.DAZE_MS);
            this.applySuperBurn(e, 1);   // every one it hits: a Super Burn stack
            if (stage2) this._applyIgnitionMark?.(e);
        }
        if (this.damageBossAtTile?.(tx, ty, C.DMG * size * (this.damageScaling || 1), undefined, 'fire')) this.applyBurnStackBoss?.();
        this._hitPortalsAround?.(tx, ty, R, C.DMG * size * (this.damageScaling || 1), true);   // queens in reach (not just one it lands on)
    }

    _fireShotgunBurst() {
        const playerPixelX = this.playerX * this.TILE_SIZE + this.TILE_SIZE / 2;
        const playerPixelY = this.playerY * this.TILE_SIZE + this.TILE_SIZE / 2;
        const worldX = (this.pointerX || 0) + this.cameras.main.scrollX;
        const worldY = (this.pointerY || 0) + this.cameras.main.scrollY;
        const dx = worldX - playerPixelX, dy = worldY - playerPixelY;
        const baseAngle = Math.atan2(dy, dx);
        const stage = parseInt(localStorage.getItem('ultStage_fire') || '1');

        const muzzleFlash = this.add.circle(playerPixelX, playerPixelY, 14, 0xff6600, 0.7).setDepth(4);
        this.tweens.add({ targets: muzzleFlash, radius: 22, alpha: 0, duration: 120, onComplete: () => muzzleFlash.destroy() });

        // Stage 2: center fireball is a supernova, flanking ones are normal
        const angles = [-0.5, -0.25, 0, 0.25, 0.5];
        angles.forEach((offset, idx) => {
            const isSupernova = stage >= 2 && idx === 2; // center fireball
            const a = baseAngle + offset;
            const dirX = Math.cos(a), dirY = Math.sin(a);
            const c = this.add.container(playerPixelX, playerPixelY).setDepth(2);
            const fg = this.add.graphics().setDepth(1.5);
            c.add(fg);

            if (isSupernova) {
                // Blue supernova visual — larger, glowing blue core
                fg.fillStyle(0x0044ff, 0.85);
                fg.fillCircle(0, 0, 9);
                fg.fillStyle(0x4488ff, 0.70);
                fg.fillCircle(0, 0, 6);
                fg.fillStyle(0xaaccff, 0.90);
                fg.fillCircle(0, 0, 3);
                fg.lineStyle(2, 0x88bbff, 0.60);
                fg.strokeCircle(0, 0, 11);
            }

            this.fireballs.push({
                sprite: c, fireGraphics: fg,
                vx: dirX * this.fireballSpeed * 1.4,
                vy: dirY * this.fireballSpeed * 1.4,
                damage: isSupernova
                    ? this.baseFireballDamage * this.damageScaling * 4.5
                    : this.baseFireballDamage * this.damageScaling * 2.5,
                dirX, dirY,
                startX: playerPixelX, startY: playerPixelY,
                splitCount: 99,
                piercedEnemies: new Set(),
                createdAt: this.time.now,
                lastFlameTime: this.time.now,
                _isShotgun: true, _ult: this._ultHit,   // the fire ult's: ult damage when it lands
                _isSupernova: isSupernova,
            });
        });
    }

    // The ice ult's frost, its whole 10s: a freezing ring round you (R tiles) in which one chill stack in three cubes
    // (THRESHOLD of the bar) and a cube shatters in CUBE_MS; you move slowly (_ultMoveMult) and take TAKEN x damage
    _iceFrostCfg() { return { MS: 20000, SLOW_MS: 5000, R: 7, SPREAD_MS: 900, SHELL_MS: 3000,   // the haze spreading out, then the ice shell at the end (invulnerable, retracting)
         THRESHOLD: 1 / 3, CUBE_MS: 1200, TAKEN: 1.5, ZOOM: 1.4, ZOOM_MS: 600,
        // Gale Storm, its passive attack: every EVERY a tornado forms round you (FORM ms at R0 tiles, longer the bigger it is),
        // then is thrown at the crosshair at SPEED (SLOW of it with enemies inside) for LIFE; every TICK it chips DMG and
        // chills what's in it, and grows GROW for each tick it holds an enemy, to RMAX; the next one forms at the biggest yet
        GALE: { EVERY: 5000, FORM: 1000, R0: 1.5, RMAX: 4, GROW: 0.2, SPEED: 1.6, SLOW: 0.35, LIFE: 7000, TICK: 500, DMG: 1,
            SEEK: 4, SEEK_PER_R: 2, TURN: 1.6 } }; }   // homing: it hunts within SEEK + SEEK_PER_R x its radius tiles, turning TURN rad/s x radius/R0
    _iceFrostBegin() {
        const F = this._iceFrostCfg(), T = this.TILE_SIZE, now = this.time.now;
        this._iceFrostUntil = now + F.MS * (this._mods?.ultLong || 1); this._iceFrostAt = now;
        // the aura: a haze of frost, not a ring. Drifting puffs of icy mist round you; at the start they spread out from you
        // (dense, then thinning as they reach the edge); at the end they're drawn back in, thickening, while you're iced over
        const ADD = Phaser.BlendModes.ADD, start = now, puffs = Array.from({ length: 22 }, (_, i) => ({
            img: this.add.image(0, 0, 'vfx_glow').setTint(i % 3 ? 0xb8dcf0 : 0xe8f6ff).setDepth(0.9),   // (normal blend: mist, added glows stacked to a white-out)
            a: Math.random() * Math.PI * 2, d: Math.sqrt(Math.random()), spin: (Math.random() - 0.5) * 0.0008, s: 0.7 + Math.random() * 0.6 }));
        const snow = this.add.particles(0, 0, 'vfx_dot', { lifespan: 1600, speed: { min: 4, max: 16 }, scale: { start: 0.3, end: 0 }, alpha: { start: 0.7, end: 0 }, tint: [0xffffff, 0xbff0ff], frequency: 50,
            emitZone: { type: 'random', source: new Phaser.Geom.Circle(0, 0, F.R * T) } }).setDepth(5);
        const tick = () => {
            const t = this.time.now, left = this._iceFrostUntil - t;
            if (!this.player?.active) { this.events.off('update', tick); puffs.forEach(p => p.img.destroy()); snow.destroy(); return; }
            if (left <= 0 && !this._iceShellUntil) this._iceShellBegin();
            const shell = this._iceShellUntil ? Math.max(0, (this._iceShellUntil - t) / F.SHELL_MS) : 1;   // 1 → 0 as the shell holds
            if (this._iceShellUntil && t >= this._iceShellUntil) { this.events.off('update', tick); puffs.forEach(p => p.img.destroy()); snow.destroy(); this._iceShellEnd(); return; }
            const grow = Math.min(1, (t - start) / F.SPREAD_MS), k = this._iceShellUntil ? shell : 1 - Math.pow(1 - grow, 3);   // its reach, as a share of R
            const r = Math.max(0.05, k) * F.R * T, dense = Math.min(2.6, 1 / Math.max(0.38, k));   // thicker the smaller it is
            const x = this.player.x, y = this.player.y;
            for (const p of puffs) {
                p.a += p.spin * 16;
                const px = x + Math.cos(p.a) * p.d * r, py = y + Math.sin(p.a) * p.d * r * 0.8, sz = (r / T) * 0.55 * p.s + 0.6;
                p.img.setPosition(px, py).setScale(sz * (0.9 + 0.1 * Math.sin(t * 0.002 + p.a))).setAlpha(Math.min(0.5, 0.07 * dense * (1.1 - p.d * 0.4)));
            }
            snow.setPosition(x, y); const z = snow.emitZones?.[0]?.source || snow.emitZone?.source; if (z) z.radius = r;
            if (!this._iceShellUntil && this.player.tintTopLeft !== 0x9ad8ff) this.player.setTint(0x9ad8ff);   // you, gone blue with cold
        };
        this.events.on('update', tick); this.events.once('shutdown', () => this.events.off('update', tick));   // (a restart keeps scene listeners: this one would run on into the next level)
        this.showStatusText(this.player.x, this.player.y - 40, 'FROZEN SOLID: x1.5 DAMAGE TAKEN', '#9ad8ff');
        // the cold at the screen's edge, like the low-health red but frost blue; it breathes, and thaws away while you're encased
        if (this.textures.exists('vfx_edge')) {
            this._coldEdge?.destroy();
            const W = this.scale.width, H = this.scale.height, ce = this._coldEdge = this.add.image(W / 2, H / 2, 'vfx_edge').setDisplaySize(W, H).setTint(0x7ad0ff).setAlpha(0).setScrollFactor(0).setDepth(27.5);
            const edge = () => {
                if (!ce.active) { this.events.off('update', edge); return; }
                const t = this.time.now, thaw = this._iceShellUntil ? Math.max(0, (this._iceShellUntil - t) / F.SHELL_MS) : 1;
                ce.setAlpha(Math.min(1, (t - now) / 600) * thaw * (0.5 + 0.08 * Math.sin(t * 0.004)));
                if (fx) {   // the frozen screen cracks in at three jerks, creeps on slowly, and thaws while you're encased
                    const e = t - now, jerk = e < 140 ? 0.4 * Phaser.Math.Easing.Back.Out(e / 140) : e < 200 ? 0.4 : e < 340 ? 0.4 + 0.3 * Phaser.Math.Easing.Back.Out((e - 200) / 140) : e < 400 ? 0.7 : e < 540 ? 0.7 + 0.3 * Phaser.Math.Easing.Back.Out((e - 400) / 140) : 1;
                    fx.crack = jerk + 0.45 * Math.max(0, 1 - (t - (this._iceCrackKickAt || -1e9)) / 700); fx.grow = jerk * (0.75 + 0.25 * Math.min(1, e / 8000)) * (0.6 + 0.4 * thaw); fx.alpha = thaw;
                }
            };
            // Sub-Zero's frost: the screen itself freezes over and cracks (VisualFX.iceScreenPipeline, the world camera only)
            const cam = this.cameras.main; let fx = null;
            if (VisualFX.iceScreenPipeline(this.game) && cam.setPostPipeline) { cam.setPostPipeline('VfxIceScreen'); fx = cam.getPostPipeline('VfxIceScreen'); if (Array.isArray(fx)) fx = fx[0];
                const L = cam.postPipelines; if (fx && L?.indexOf(fx) > 0) L.unshift(L.splice(L.indexOf(fx), 1)[0]); }   // before the bloom: it leaves the viewport quarter size, so a pass after it draws into a corner
            ce.once('destroy', () => { try { cam.removePostPipeline?.('VfxIceScreen'); } catch (_) {} });
            [0, 200, 400].forEach((d, i) => this.time.delayedCall(d, () => { Sfx.play(this, i ? 'freeze' : 'shatter'); this.cameras.main.shake(70, 0.002 + i * 0.001); }));
            this.events.on('update', edge); this.events.once('shutdown', () => this.events.off('update', edge));   // (a restart keeps scene listeners: this one would run on into the next level)
        }
        this._galeBest = F.GALE.R0; this._galeNext = now + F.ZOOM_MS + 400;
        const gale = () => { if (this.time.now >= this._iceFrostUntil || !this.player?.active) { this.events.off('update', gale); return; } if (this.time.now >= this._galeNext && this._iceFrostUntil - this.time.now > F.GALE.FORM * (this._galeBest / F.GALE.R0)) { this._galeNext = this.time.now + F.GALE.EVERY; this._galeSpawn(); } };   // (none that would still be gathering on you when the shell closes)
        this.events.on('update', gale); this.events.once('shutdown', () => this.events.off('update', gale));   // (a restart keeps scene listeners: this one would run on into the next level)
    }
    // The Gale Storm's tornado, side on: an animated sheet of 8 frames, 48 x 72. A funnel narrow at the ground and wide at
    // the top, swaying, its wind wound round it in bands that climb as they turn (lit on the left, shadowed at the edges,
    // see-through at its rim), a cloud of snow at its crown and spray kicked up at its foot.
    // Cracks across a frozen block: jagged lines out from the middle, white with a dark shadow (baked once)
    static blockCrackKey(scene) {
        const key = 'fx_blockcrack', N = 32;
        if (scene.textures.exists(key)) return key;
        const t = scene.textures.createCanvas(key, N, N), c = t.getContext(), R = MenuArt.rng(331);
        for (let k = 0; k < 6; k++) {
            let a = k / 6 * Math.PI * 2 + R() * 0.5, x = N / 2, y = N / 2;
            const pts = [[x, y]];
            for (let i = 0; i < 5; i++) { a += (R() - 0.5) * 0.9; x = Math.max(0, Math.min(N, x + Math.cos(a) * 3.4)); y = Math.max(0, Math.min(N, y + Math.sin(a) * 3.4)); pts.push([x, y]); }
            for (const [off, col, w] of [[1, 'rgba(10,42,88,0.9)', 2], [0, '#ffffff', 1]]) { c.beginPath(); c.moveTo(pts[0][0] + off, pts[0][1] + off); for (const [px, py] of pts) c.lineTo(px + off, py + off); c.strokeStyle = col; c.lineWidth = w; c.stroke(); }
        }
        t.refresh(); return key;
    }
    static tornadoKey(scene) {
        const key = 'fx_tornado3', W = 64, H = 52, N = 8;   // squat and thick: about as wide as tall
        if (scene.textures.exists(key)) return key;
        const t = scene.textures.createCanvas(key, W * N, H), ctx = t.getContext(), img = ctx.createImageData(W * N, H), d = img.data;
        const put = (f, x, y, c, a) => { x = Math.round(x); y = Math.round(y); if (x < 0 || y < 0 || x >= W || y >= H) return; const i = (y * W * N + f * W + x) * 4, A = d[i + 3] / 255, na = a + A * (1 - a);
            d[i] = ((c >> 16 & 255) * a + d[i] * A * (1 - a)) / na; d[i + 1] = ((c >> 8 & 255) * a + d[i + 1] * A * (1 - a)) / na; d[i + 2] = ((c & 255) * a + d[i + 2] * A * (1 - a)) / na; d[i + 3] = na * 255; };
        const R = MenuArt.rng(77), nz = MenuArt.noise(41);
        for (let f = 0; f < N; f++) {
            const ph = f / N * Math.PI * 2;
            for (let y = 3; y < H - 3; y++) {
                const v = (y - 3) / (H - 6), w = 8 + 20 * Math.pow(1 - v, 1.1) + (nz(y * 0.4, f * 1.3) - 0.5) * 6;   // thick, its edge ragged and twitching
                const cx = W / 2 + Math.sin(v * 4 - ph) * 4 + Math.sin(v * 11 + ph * 2) * 1.6;   // a wobble on a wobble: unsteady
                for (let x = Math.floor(cx - w); x <= cx + w; x++) {
                    const u = (x + 0.5 - cx) / w; if (Math.abs(u) > 1) continue;
                    const ang = Math.asin(u), band = (ang * 1.8 + v * 7 - ph * 2 + 20 + nz(x * 0.3, y * 0.3 + f) * 0.6) % 2;
                    const lit = 0.55 + 0.45 * Math.cos(ang + 0.5), edge = Math.abs(u);
                    let c = band < 0.25 ? 0xf2fcff : band < 0.75 ? 0xbfeaff : band < 1.3 ? 0x6cc8f4 : 0x2e8cd0;   // frost colours: white, ice-blue, glacier, deep
                    c = MenuArt.mix(c, 0x1a4a78, (1 - lit) * 0.5);
                    if (edge < 0.35) c = MenuArt.mix(c, 0xe8faff, (0.35 - edge) * 1.2);   // its dense core, brighter
                    put(f, x, y, edge > 0.9 ? MenuArt.mix(c, 0x1a3a60, 0.35) : c, edge > 0.92 ? 0.75 : 1);   // solid, a darker rim so it reads round
                }
            }
            for (let k = 0; k < 7; k++) {   // ice shards whirling round it, catching the light
                const a = ph * 1.5 + k * 0.9, yy = 8 + (k * 6.3) % (H - 16), ww = 10 + 20 * (1 - yy / H), sx = W / 2 + Math.cos(a) * (ww + 3), front = Math.sin(a) > 0;
                for (const [dx, dy, c] of [[0, -2, 0xffffff], [0, -1, 0xd8f4ff], [-1, 0, 0x9ad8ff], [0, 0, 0xffffff], [1, 0, 0x9ad8ff], [0, 1, 0x6ab8e0], [0, 2, 0x6ab8e0]]) put(f, sx + dx, yy + dy, c, front ? 1 : 0.5);
            }
            for (let k = 0; k < 10; k++) {   // its crown, a churning lip of frost cloud
                const a = k / 10 * Math.PI * 2 + ph * 0.6, px = W / 2 + Math.cos(a) * 24, py = 6 + Math.sin(a) * 3, pr = 4 + (k % 3);
                for (let yy = -pr; yy <= pr; yy++) for (let xx = -pr; xx <= pr; xx++) { if (xx * xx + yy * yy > pr * pr) continue; put(f, px + xx, py + yy, yy < -pr * 0.3 ? 0xffffff : yy > pr * 0.4 ? 0x9ac0dc : 0xe2f0fa, 0.85); }
            }
            for (let k = 0; k < 14; k++) { const a = R() * Math.PI * 2, r = 4 + R() * 12; put(f, W / 2 + Math.cos(a - ph * 2) * r, H - 4 + Math.sin(a - ph * 2) * r * 0.3, 0xe8f6ff, 0.8); }   // snow kicked up at its foot
            for (let k = 0; k < 18; k++) put(f, W / 2 + (R() - 0.5) * 60, 4 + R() * (H - 8), 0xffffff, 0.7);   // flurries
        }
        ctx.putImageData(img, 0, 0); t.refresh();
        for (let f = 0; f < N; f++) t.add(f, 0, f * W, 0, W, H);
        if (!scene.anims.exists(key)) scene.anims.create({ key, frames: Array.from({ length: N }, (_, f) => ({ key, frame: f })), frameRate: 18, repeat: -1 });
        return key;
    }
    // The ult's end: encased in ice for SHELL_MS, untouchable and held still, a crust of ice over your own shape; then it
    // melts off (drips, a crack, a puff of mist) and you're yourself again
    _iceShellBegin() {
        const F = this._iceFrostCfg(), now = this.time.now, p = this.player;
        this._iceShellUntil = now + F.SHELL_MS;
        this._ultArmor?.end?.();   // (the suit comes off under the ice, early or not)
        this._staggerUntil = Math.max(this._staggerUntil || 0, this._iceShellUntil);   // held still
        this._dashInvulnUntil = Math.max(this._dashInvulnUntil || 0, this._iceShellUntil);   // untouchable
        this._applyGlu(F.SHELL_MS, null);   // and no dashing out of it (it says ENCASED itself)
        // the crust: a block of ice in your own shape, thick, the cube's ice (deep blue, a bright upper face, gloss, facets, cracks)
        const key = this._iceShellTex(p), img = this.add.image(p.x, p.y, key).setOrigin(p.originX, p.originY).setScale(p.scaleX, p.scaleY).setDepth(p.depth + 0.02).setAlpha(0);
        img.setDisplayOrigin(p.displayOriginX + 6, p.displayOriginY + 6);   // (its 6px border round the frame)
        this.tweens.add({ targets: img, alpha: 0.92, duration: 220 });
        const glint = this.add.image(p.x, p.y, 'vfx_glow').setTint(0xd8f4ff).setBlendMode(Phaser.BlendModes.ADD).setScale(0.35).setAlpha(0.35).setDepth(p.depth + 0.03);
        this.tweens.add({ targets: glint, alpha: 0.12, duration: 700, yoyo: true, repeat: -1 });
        this._iceShell = { rim: img, body: glint, cracks: this.add.graphics(), follow: () => { img.setPosition(p.x, p.y); glint.setPosition(p.x - 6, p.y - p.displayHeight * 0.25); } };
        this._iceShell.follow();
        const follow = this._iceShell.follow;   // every frame, after the step glide: a step still under way carried the slime out of its shell
        this.events.on('postupdate', follow); this.events.once('shutdown', () => this.events.off('postupdate', follow));
        this.showStatusText(p.x, p.y - 40, 'ENCASED', '#d8f4ff'); Sfx.play(this, 'shatter'); this.cameras.main.shake(120, 0.004);
    }
    // The shell's texture for the player's current frame: its silhouette grown 5px all round, filled with cube ice
    _iceShellTex(p) {
        const fr = p.frame, key = 'fx_iceshell_' + p.texture.key + '_' + fr.name;
        if (this.textures.exists(key)) return key;
        const W = fr.cutWidth, H = fr.cutHeight, B = 6, CW = W + B * 2, CH = H + B * 2;
        const src = document.createElement('canvas'); src.width = W; src.height = H;
        const sctx = src.getContext('2d'); sctx.drawImage(fr.source.image, fr.cutX, fr.cutY, W, H, 0, 0, W, H);
        const sd = sctx.getImageData(0, 0, W, H).data, inside = (x, y) => x >= 0 && y >= 0 && x < W && y < H && sd[(y * W + x) * 4 + 3] > 40;
        const dist = new Float32Array(CW * CH).fill(99);   // distance from each pixel to the slime (pixels), for its thickness
        for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (inside(x, y)) for (let dy = -B; dy <= B; dy++) for (let dx = -B; dx <= B; dx++) { const i = (y + B + dy) * CW + (x + B + dx), dd = Math.hypot(dx, dy); if (dd < dist[i]) dist[i] = dd; }
        let top = CH, bot = 0, lft = CW, rgt = 0; for (let y = 0; y < CH; y++) for (let x = 0; x < CW; x++) if (dist[y * CW + x] <= 5) { top = Math.min(top, y); bot = Math.max(bot, y); lft = Math.min(lft, x); rgt = Math.max(rgt, x); }
        const t = this.textures.createCanvas(key, CW, CH), ctx = t.getContext(), img = ctx.createImageData(CW, CH), d = img.data, nz = MenuArt.noise(5);
        for (let y = 0; y < CH; y++) for (let x = 0; x < CW; x++) {
            const dd = dist[y * CW + x], R = 4.6 + nz(x * 0.4, y * 0.4) * 1.2;   // a rough, chipped outline
            if (dd > R) continue;
            const u = (x - lft) / Math.max(1, rgt - lft), v = (y - top) / Math.max(1, bot - top), edge = R - dd;
            let c = 0x336699, a = 0.62;                                        // the cube's deep ice
            if (u + v < 0.75) { c = 0x5a9ad0; a = 0.62; }                     // lighter toward the upper left
            if (u < 0.5 && v < 0.45) { c = 0xa8d8f4; a = 0.58; }              // its bright face
            if (edge < 1.1) { c = 0xaaddff; a = 0.95; }                       // its border
            else if (edge < 2) { c = 0x2a5a8a; a = 0.75; }                    // the thick wall seen edge-on
            const g = (x - y) - (lft - top) - (rgt - lft) * 0.25;              // gloss streaks across it
            if (edge >= 1.1 && Math.abs(g) < 1.2 && v < 0.7) { c = 0xffffff; a = 0.7; }
            if (edge >= 1.1 && Math.abs(g - 7) < 0.6 && v < 0.6) { c = 0xffffff; a = 0.4; }
            if (edge >= 2 && ((x * 7 + y * 3) % 23 === 0 || Math.abs((x + y * 2) % 19 - 9) < 0.5 && v > 0.4)) { c = 0xd8f4ff; a = 0.55; }   // facet lines, frost
            const i = (y * CW + x) * 4; d[i] = c >> 16 & 255; d[i + 1] = c >> 8 & 255; d[i + 2] = c & 255; d[i + 3] = a * 255;
        }
        ctx.putImageData(img, 0, 0); t.refresh();
        return key;
    }
    _iceShellEnd() {
        const S = this._iceShell; this._iceShellUntil = 0; this._iceShell = null;
        this._coldEdge?.destroy(); this._coldEdge = null;   // warmed up
        if (!S) return;
        this.events.off('postupdate', S.follow);
        const p = this.player;
        for (let k = 0; k < 10; k++) { const d = this.add.circle(p.x + (Math.random() - 0.5) * 24, p.y - Math.random() * 16, 2, 0x9ad8ff).setDepth(p.depth + 0.05); this.tweens.add({ targets: d, y: d.y + 18 + Math.random() * 10, alpha: 0, duration: 500, onComplete: () => d.destroy() }); }   // meltwater
        this.tweens.add({ targets: [S.rim, S.body, S.cracks], alpha: 0, scaleX: '*=1.15', duration: 380, onComplete: () => { S.rim.destroy(); S.body.destroy(); S.cracks.destroy(); } });
        this._vfxFlash?.(p.x, p.y, 70, 0xd8f4ff, 300, 0.5);
        p.clearTint(); Sfx.play(this, 'e_dip');
    }
    // ── GALE STORM ── one tornado: it gathers round you, is flung at the crosshair, chills and grows as it goes
    _galeSpawn() {
        const G = this._iceFrostCfg().GALE, T = this.TILE_SIZE, ADD = Phaser.BlendModes.ADD;
        const t = { r: this._galeBest, x: this.player.x, y: this.player.y, born: this.time.now, form: G.FORM * (this._galeBest / G.R0), vx: 0, vy: 0, tickAt: 0, flung: false };
        t.g = this.add.graphics().setDepth(0.9).setBlendMode(ADD);   // snow whipped round its foot, flattened to the floor's perspective
        t.sh = this.add.image(t.x, t.y, 'vfx_glow').setTint(0x06121f).setAlpha(0.5).setDepth(0.88);   // its shadow: what stands it on the floor
        const tk = ElementSystem.tornadoKey(this); t.spr = this.add.sprite(t.x, t.y, tk, 0).setOrigin(0.5, 0.94).setTint(0xc8daea).play(tk);   // (a touch under white: the glow pass bloomed full white into glare)
        t.snow = this.add.particles(0, 0, 'vfx_dot', { lifespan: 700, speedX: { min: -25, max: 25 }, speedY: { min: -70, max: -30 }, gravityY: -60, scale: { start: 0.4, end: 0 }, alpha: { start: 0.9, end: 0 }, tint: [0xffffff, 0xbff0ff, 0x8ad8ff], frequency: 18,
            emitZone: { type: 'random', source: new Phaser.Geom.Ellipse(0, 0, t.r * T * 2, t.r * T * 0.6) } }).setDepth(4.5);   // lifted off the floor round its foot
        Sfx.play(this, 'gale');
        const tick = () => {
            const now = this.time.now, alive = now - t.born < t.form + G.LIFE && this.player?.active;
            if (!alive) { this.events.off('update', tick); this.tweens.add({ targets: [t.g, t.snow, t.spr, t.sh], alpha: 0, duration: 300, onComplete: () => { t.g.destroy(); t.snow.destroy(); t.spr.destroy(); t.sh.destroy(); } }); return; }
            const dt = Math.min(50, this.game.loop.delta) / 1000;
            if (!t.flung) {   // gathering round you
                t.x = this.player.x; t.y = this.player.y;
                if (now - t.born >= t.form) {
                    t.flung = true;
                    const cam = this.cameras.main, ap = this._aim ? this._aim(this.input.activePointer) : this.input.activePointer;
                    const dx = ap.x + cam.scrollX - t.x, dy = ap.y + cam.scrollY - t.y, L = Math.hypot(dx, dy) || 1;
                    t.vx = dx / L * G.SPEED * T; t.vy = dy / L * G.SPEED * T; Sfx.play(this, 'gale');
                }
            } else {
                const inside = (this.enemies || []).some(e => e.sprite?.active && e.health > 0 && !this._phasedOut?.(e) && Math.hypot(e.sprite.x - t.x, e.sprite.y - t.y) <= t.r * T);
                // it hunts: steers toward the nearest enemy in range; the bigger it is, the further it sees and the harder it turns
                let prey = null, best = (G.SEEK + G.SEEK_PER_R * t.r) * T;
                for (const e of this.enemies || []) { if (!e.sprite?.active || e.health <= 0 || this._phasedOut?.(e)) continue; const d = Math.hypot(e.sprite.x - t.x, e.sprite.y - t.y); if (d < best) { best = d; prey = e; } }
                if (prey && best > 4) {
                    const cur = Math.atan2(t.vy, t.vx), want = Math.atan2(prey.sprite.y - t.y, prey.sprite.x - t.x), turn = G.TURN * (t.r / G.R0) * dt;
                    const a = cur + Phaser.Math.Clamp(Phaser.Math.Angle.Wrap(want - cur), -turn, turn), sp = G.SPEED * T;
                    t.vx = Math.cos(a) * sp; t.vy = Math.sin(a) * sp;
                }
                const k = inside ? G.SLOW : 1, nx = t.x + t.vx * dt * k, ny = t.y + t.vy * dt * k, open = (x, y) => this.world?.[Math.floor(x / T)]?.[Math.floor(y / T)] === this.FLOOR;
                if (open(nx, ny)) { t.x = nx; t.y = ny; } else if (open(nx, t.y)) t.x = nx; else if (open(t.x, ny)) t.y = ny;   // slides along a wall
                if (now >= t.tickAt) {
                    t.tickAt = now + G.TICK; let held = false;
                    for (const e of [...(this.enemies || [])]) {
                        if (!e.sprite?.active || e.health <= 0 || Math.hypot(e.sprite.x - t.x, e.sprite.y - t.y) > t.r * T) continue;
                        held = true;
                        this.damageEnemy(e, G.DMG * (this.damageScaling || 1), 'ice');
                        if (e.health > 0) this.applyChill?.(e, 1);
                    }
                    if (this._hitPortalsAround?.(t.x / T - 0.5, t.y / T - 0.5, t.r, G.DMG * (this.damageScaling || 1))) held = true;   // queens in the funnel
                    if (held && t.r < G.RMAX) { t.r = Math.min(G.RMAX, t.r + G.GROW); this._galeBest = Math.max(this._galeBest, t.r); }
                }
            }
            // the look: the funnel standing on its spot, as wide as its reach; under it a faint swirl of frost on the ground
            const r = t.r * T * (t.flung ? 1 : Math.min(1, (now - t.born) / t.form)), sp = now * 0.006;
            const jx = (Math.random() - 0.5) * r * 0.06;   // unsteady
            const vr = Math.min(r, 2.2 * T + (r - 2.2 * T) * 0.25);   // the funnel's drawn size: it stops growing much past 2.2 tiles (the reach keeps growing, shown by the swirl at its foot) or it hides the fight
            t.spr.setPosition(t.x + jx, t.y + vr * 0.3).setAlpha(r > 2.2 * T ? 0.8 : 1).setScale(Math.max(0.05, vr * 2.1 / 64)).setAngle(Math.sin(now * 0.011) * 4).setDepth(t.y + r * 0.3 + 1);
            const fx = t.x + jx, fy = t.y + vr * 0.3;   // its foot
            t.sh.setPosition(fx, fy).setDisplaySize(vr * 2.6, vr * 0.8);
            t.g.clear();   // three arcs of snow racing round the foot, an ellipse a third as tall as wide (the floor seen at a slant)
            for (let k = 0; k < 3; k++) { const a0 = sp * 2.2 + k * 2.1, rr = r * (0.55 + k * 0.22); t.g.lineStyle(Math.max(1, r * 0.06), 0xd8f4ff, 0.35 - k * 0.08).beginPath();
                for (let j = 0; j <= 10; j++) { const a = a0 + j * 0.14, px = fx + Math.cos(a) * rr, py = fy + Math.sin(a) * rr * 0.32; j ? t.g.lineTo(px, py) : t.g.moveTo(px, py); } t.g.strokePath(); }
            t.snow.setPosition(fx, fy); const z = t.snow.emitZones?.[0]?.source || t.snow.emitZone?.source; if (z) { z.width = r * 2; z.height = r * 0.6; }
        };
        this.events.on('update', tick); this.events.once('shutdown', () => this.events.off('update', tick));   // (a restart keeps scene listeners: this one would run on into the next level)
    }
    activateIceBlizzard() {
        // the camera punches in on you first, the air goes white-blue, then the wave
        const F = this._iceFrostCfg(), cam = this.cameras.main, z0 = cam.zoom;
        if (!this._iceZoomed) {
            this._iceZoomed = true;
            this.tweens.add({ targets: cam, zoom: z0 * F.ZOOM, duration: 300, ease: 'Cubic.easeOut', onComplete: () => this.tweens.add({ targets: cam, zoom: z0, duration: 420, delay: 200, ease: 'Sine.easeInOut' }) });
            const fl = this.add.rectangle(this.scale.width / 2, this.scale.height / 2, this.scale.width, this.scale.height, 0xbff0ff, 0.3).setScrollFactor(0).setDepth(20);
            this.tweens.add({ targets: fl, alpha: 0, duration: 500, onComplete: () => fl.destroy() });
            Sfx.play(this, 'blizzard'); this.cameras.main.shake(160, 0.004);
            this.tsunamiActive = true;   // (held through the zoom: no second cast)
            this._iceFrostBegin();
            this.time.delayedCall(F.ZOOM_MS, () => { this.activateIceBlizzard(); });
            return;
        }
        this._iceZoomed = false;
        this.ultDrainActive = true;
        this.ultDrainStartTime = this.time.now;
        this.ultDrainDuration = 4000;

        this.tsunamiActive = true;
        this.tsunamiTiles = [];
        this.tsunamiFrozenEnemies = [];

        const originX = this.playerX;
        const originY = this.playerY;
        const maxR = this.tsunamiMaxRadius;
        const waveDur = this.tsunamiWaveDuration; // outward phase duration
        const pauseDur = 200;                      // how long water sits before retracting
        const retractDur = 500;                    // retract phase duration

        // Screen flash — deep blue
        const screenFlash = this.add.rectangle(this.scale.width / 2, this.scale.height / 2, this.scale.width, this.scale.height, 0x003366, 0.5).setScrollFactor(0).setDepth(20);
        this.tweens.add({ targets: screenFlash, alpha: 0, duration: 400, onComplete: () => screenFlash.destroy() });

        const tilesHit = new Set();
        const wetEnemies = new Set(); // enemies touched by water

        // ── OUTWARD WAVE ──────────────────────────────────────────────
        // t^2.5 easing: extremely fast at start, crawls to a halt at edge
        for (let r = 1; r <= maxR; r++) {
            const t = r / maxR;
            const delay = waveDur * Math.pow(t, 2.5);

            this.time.delayedCall(delay, () => {
                if (!this.tsunamiActive) return;

                for (let dx = -r; dx <= r; dx++) {
                    for (let dy = -r; dy <= r; dy++) {
                        const dist = Math.sqrt(dx * dx + dy * dy);
                        if (dist < r - 0.8 || dist > r + 0.1) continue;
                        const tx = originX + dx;
                        const ty = originY + dy;
                        const key = `${tx},${ty}`;
                        if (tilesHit.has(key)) continue;
                        if (tx < 0 || tx >= this.WORLD_WIDTH || ty < 0 || ty >= this.WORLD_HEIGHT) continue;
                        if (this.world[tx][ty] !== this.FLOOR) continue;
                        tilesHit.add(key);

                        const px2 = tx * this.TILE_SIZE + this.TILE_SIZE / 2;
                        const py2 = ty * this.TILE_SIZE + this.TILE_SIZE / 2;

                        const waterTile = this._vfxWaterImg ? this._vfxWaterImg(px2, py2, false).setAlpha(0.72)
                            : this.add.rectangle(px2, py2, this.TILE_SIZE, this.TILE_SIZE, 0x0066cc, 0.55).setDepth(0.5);
                        const waterShimmer = this._vfxWaterImg ? this._vfxWaterImg(px2, py2, true)
                            : this.add.rectangle(px2, py2, this.TILE_SIZE - 4, this.TILE_SIZE - 4, 0x44aaff, 0.3).setDepth(0.5);
                        this.tweens.add({ targets: waterShimmer, alpha: 0.6, duration: 150 + Math.random() * 100, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });

                        this.tsunamiTiles.push({ waterTile, waterShimmer, tileX: tx, tileY: ty, r });
                    }
                }

                // Mark any enemies in this ring as wet
                // In tutorial, skip enemies from unvisited rooms — they stay immovable/invulnerable
                // the room you're in, on every room-gated level (it was only worked out in the tutorial, so
                // everywhere else every enemy failed the check and the Blizzard froze nothing)
                const currentRoom = this._roomGated() ? this.getCurrentPlayerRoom() : -1;
                for (let enemy of this.enemies) {
                    if (this._phasedOut?.(enemy)) continue;
                    if (wetEnemies.has(enemy)) continue;
                    if (this._roomGated() && enemy.tutorialRoomIndex !== currentRoom) continue;
                    const edx = enemy.x - originX;
                    const edy = enemy.y - originY;
                    const eDist = Math.sqrt(edx * edx + edy * edy);
                    if (eDist <= r + 0.5) {
                        wetEnemies.add(enemy);
                        if (enemy.sprite && enemy.sprite.active) {
                            if (typeof enemy.sprite?.setTint === 'function') enemy.sprite.setTint(0x4499ff);
                            this.showStatusText(enemy.sprite.x, enemy.sprite.y, 'WET', '#44aaff');
                        }
                    }
                }
                // Wave also damages portals (Queen Slimes) it passes over
                if (this.portals) {
                    for (const portal of this.portals) {
                        if (!portal.active) continue;
                        const pdx = portal.tileX - originX;
                        const pdy = portal.tileY - originY;
                        const pDist = Math.sqrt(pdx * pdx + pdy * pdy);
                        if (pDist >= r - 0.5 && pDist <= r + 0.5) {
                            this.damagePortal(portal, 15 * this.damageScaling);
                        }
                    }
                }
            });
        }

        // ── PAUSE ─────────────────────────────────────────────────────
        this.time.delayedCall(waveDur + pauseDur, () => {
            if (!this.tsunamiActive) return;

            // Darken water tiles slightly to signal retract incoming
            for (const t of this.tsunamiTiles) {
                this.tweens.killTweensOf(t.waterShimmer);
                this.tweens.add({ targets: [t.waterTile, t.waterShimmer], alpha: 0.7, duration: 200 });
            }
        });

        // ── RETRACT WAVE ──────────────────────────────────────────────
        // Rings disappear outside-in. Use fast ease (t^0.4 = starts fast)
        for (let r = maxR; r >= 1; r--) {
            const t = (maxR - r) / maxR; // 0 at edge, 1 at center
            const delay = waveDur + pauseDur + retractDur * Math.pow(t, 0.4);

            this.time.delayedCall(delay, () => {
                if (!this.tsunamiActive) return;

                // Remove water tiles at this radius
                for (let i = this.tsunamiTiles.length - 1; i >= 0; i--) {
                    const t2 = this.tsunamiTiles[i];
                    if (t2.r !== r) continue;
                    this.tweens.killTweensOf(t2.waterShimmer);
                    this.tweens.add({
                        targets: [t2.waterTile, t2.waterShimmer],
                        alpha: 0, duration: 120,
                        onComplete: () => { t2.waterTile.destroy(); t2.waterShimmer.destroy(); }
                    });
                    this.tsunamiTiles.splice(i, 1);
                }

                // Pull wet enemies at this radius one tile toward origin
                for (let enemy of wetEnemies) {
                    const edx = enemy.x - originX;
                    const edy = enemy.y - originY;
                    const eDist = Math.sqrt(edx * edx + edy * edy);
                    if (Math.abs(eDist - r) > 1.0) continue;

                    const pullDirX = edx === 0 && edy === 0 ? 0 : -Math.round(edx / Math.max(Math.abs(edx), Math.abs(edy)));
                    const pullDirY = edx === 0 && edy === 0 ? 0 : -Math.round(edy / Math.max(Math.abs(edx), Math.abs(edy)));
                    const newEx = enemy.x + pullDirX;
                    const newEy = enemy.y + pullDirY;

                    if (newEx >= 0 && newEx < this.WORLD_WIDTH && newEy >= 0 && newEy < this.WORLD_HEIGHT
                        && this.world[newEx][newEy] === this.FLOOR && !this.getEnemyAt(newEx, newEy)) {
                        enemy.x = newEx;
                        enemy.y = newEy;
                        this.tweens.add({
                            targets: enemy.sprite,
                            x: newEx * this.TILE_SIZE + this.TILE_SIZE / 2,
                            y: newEy * this.TILE_SIZE + this.TILE_SIZE / 2 + this.SLIME_Y_OFFSET,
                            duration: 140,
                            ease: 'Quad.easeIn',
                            onUpdate: () => {
                                if (enemy.healthBarBg) { enemy.healthBarBg.x = enemy.sprite.x; enemy.healthBarBg.y = enemy.sprite.y + (enemy._hpBarYOff || 0); }
                                if (enemy.healthBarFill) { enemy.healthBarFill.x = enemy.sprite.x; enemy.healthBarFill.y = enemy.sprite.y + (enemy._hpBarYOff || 0); }
                                if (enemy.burnVisual) { enemy.burnVisual.x = enemy.sprite.x; enemy.burnVisual.y = enemy.sprite.y - 18; }
                                if (enemy.brittleVisual) { enemy.brittleVisual.x = enemy.sprite.x; enemy.brittleVisual.y = enemy.sprite.y + 14; }
                                if (enemy._tsunamiMultText) { enemy._tsunamiMultText.x = enemy.sprite.x; enemy._tsunamiMultText.y = enemy.sprite.y - 28; }
                            }
                        });
                    }
                }
            });
        }

        // ── FLASH FREEZE ──────────────────────────────────────────────
        // Fires when retract fully reaches center
        this.time.delayedCall(waveDur + pauseDur + retractDur + 100, () => {
            if (!this.tsunamiActive) return;

            // Screen flash white
            const freezeFlash = this.add.rectangle(this.scale.width / 2, this.scale.height / 2, this.scale.width, this.scale.height, 0xffffff, 0.65).setScrollFactor(0).setDepth(20);
            this.tweens.add({ targets: freezeFlash, alpha: 0, duration: 350, onComplete: () => freezeFlash.destroy() });

            // Flash-freeze ice tile overlay — briefly cover the whole tsunami area with ice tiles
            const iceTileOverlays = [];
            for (let dx2 = -maxR; dx2 <= maxR; dx2++) {
                for (let dy2 = -maxR; dy2 <= maxR; dy2++) {
                    const dist = Math.sqrt(dx2*dx2 + dy2*dy2);
                    if (dist > maxR) continue;
                    const tx2 = originX + dx2, ty2 = originY + dy2;
                    if (tx2 < 0 || tx2 >= this.WORLD_WIDTH || ty2 < 0 || ty2 >= this.WORLD_HEIGHT) continue;
                    if (this.world[tx2][ty2] !== this.FLOOR) continue;
                    const px2 = tx2 * this.TILE_SIZE, py2 = ty2 * this.TILE_SIZE;
                    const T2 = this.TILE_SIZE;
                    // Frosted ice from Visuals.js where it's loaded (TD keeps the drawn grid)
                    const iceOverlay = this._vfxIceTile ? this._vfxIceTile(px2 + T2 / 2, py2 + T2 / 2)
                        : this.add.graphics().setDepth(1.8).setAlpha(0);
                    if (!this._vfxIceTile) {
                        // Brief flash — faint tint + edge lines only
                        iceOverlay.fillStyle(0x88ddff, 0.20);
                        iceOverlay.fillRect(px2, py2, T2, T2);
                        iceOverlay.lineStyle(1.2, 0xaaddff, 0.65);
                        iceOverlay.strokeRect(px2 + 0.5, py2 + 0.5, T2 - 1, T2 - 1);
                        iceOverlay.lineStyle(0.8, 0xffffff, 0.45);
                        iceOverlay.beginPath(); iceOverlay.moveTo(px2 + 4, py2 + 4); iceOverlay.lineTo(px2 + T2 - 6, py2 + T2 - 4); iceOverlay.strokePath();
                        iceOverlay.beginPath(); iceOverlay.moveTo(px2 + T2/2, py2 + 2); iceOverlay.lineTo(px2 + 6, py2 + T2 - 4); iceOverlay.strokePath();
                    }
                    iceTileOverlays.push(iceOverlay);
                }
            }
            // Fade in fast, hold briefly, fade out — tween each tile individually to avoid crash
            iceTileOverlays.forEach(o => {
                this.tweens.add({ targets: o, alpha: 1, duration: 80, ease: 'Quad.easeOut' });
            });
            this.time.delayedCall(430, () => {
                iceTileOverlays.forEach(o => {
                    this.tweens.add({
                        targets: o, alpha: 0, duration: 400, ease: 'Quad.easeIn',
                        onComplete: () => o.destroy()
                    });
                });
            });

            // Freeze all wet enemies
            for (let enemy of wetEnemies) {
                if (!enemy.sprite || !enemy.sprite.active) continue;

                enemy.frozenByTsunami = true;
                this.freezeEnemy(enemy, this.tsunamiFreezeDuration * (this._mods?.ultLong || 1));
                enemy._deepFrozen = true; enemy._cubeDealt = 0;   // Deep Freeze: held till the ult shatters it (CombatSystem._brittleMult)
                this._deepFreezeFx(enemy);
                this.tsunamiFrozenEnemies.push(enemy);
                this.spawnIceSplinter(enemy.sprite.x, enemy.sprite.y);
                enemy.sprite.clearTint();

                const multTxt = this.add.text(enemy.sprite.x, enemy.sprite.y - 28, `${this.tsunamiFreezeMultiplier}x DMG`, {
                    fontSize: '12px', fontFamily: 'monospace', color: '#88eeff',
                    stroke: '#000000', strokeThickness: 3, fontStyle: 'bold'
                }).setOrigin(0.5).setDepth(10);
                enemy._tsunamiMultText = multTxt;
                multTxt.setVisible(!this._vfxFreezeBanner);   // one line under the ult banner says it (Visuals.js)
            }
            this._vfxFreezeBanner?.(this.tsunamiFreezeMultiplier);

            // Single scatter burst erupting from player on flash freeze. For show only now: real
            // shards shattered the pack the instant it froze (any ice hit on a frozen enemy
            // shatters it), so up close the 4s hold and the shatter below never happened.
            const shardsPerWave = 18;
            const px = this.player.x, py = this.player.y;
            const wRing = this.add.circle(px, py, 6, 0xffffff, 0).setDepth(5);
            wRing.setStrokeStyle(2.5, 0xffffff, 1.0);
            this.tweens.add({ targets: wRing, radius: 62, alpha: 0, duration: 280, ease: 'Quad.easeOut', onComplete: () => wRing.destroy() });
            for (let s = 0; s < shardsPerWave; s++) {
                const angle = (Math.PI * 2 / shardsPerWave) * s + (Math.random() - 0.5) * 0.15;
                const dist = 90 + Math.random() * 70;
                const shard = this.add.triangle(px, py, 0, -3, 10, 0, 0, 3, 0xdff6ff, 0.95).setDepth(5).setRotation(angle);
                this.tweens.add({ targets: shard, x: px + Math.cos(angle) * dist, y: py + Math.sin(angle) * dist, alpha: 0,
                                  duration: 260 + Math.random() * 90, ease: 'Cubic.easeOut', onComplete: () => shard.destroy() });
            }

            // Clean up any remaining water tiles
            for (const t of this.tsunamiTiles) {
                this.tweens.killTweensOf(t.waterShimmer);
                t.waterTile.destroy(); t.waterShimmer.destroy();
            }
            this.tsunamiTiles = [];

            // ── SHATTER ───────────────────────────────────────────────────
            // This used to start a 30s snowstorm that followed you around. Now everything the
            // wave reached stays frozen for tsunamiFreezeDuration (your hits on it do
            // tsunamiFreezeMultiplier, see damageEnemy), then it all shatters at once: on your
            // second press (X, or E holding ice), or by itself just before the freeze would melt.
            const DC0 = this._iceCubeCfg(), STAGE2 = parseInt(localStorage.getItem('ultStage_ice') || '1') >= 2 ? 1.5 : 1;
            const SHATTER_MULT = DC0.DEEP_DMG * STAGE2 / 7.5;  // × the 7.5 burst: DEEP_DMG flat
            const reach = (tx, ty) => Math.hypot(tx - originX, ty - originY) <= maxR + 0.5;
            const bosses = () => [this.voltslimeBoss, this.voidSovereignBoss, this.fractureCore]
                .filter(b => b?.active && reach(b.tileX, b.tileY));
            // The wave only wets enemies; a boss it reached is frozen outright.
            if (bosses().some(b => b !== this.fractureCore) && typeof this.freezeBossFromIceWeapon === 'function') {
                this.freezeBossFromIceWeapon(true);
            }

            let _shattered = false;
            const _shatterAll = () => {
                if (_shattered || !this.tsunamiActive) return;
                _shattered = true;
                Sfx.play(this, 'shatter');
                this._iceUltDomainActive = false; this._iceUltDetonate = null;
                const T = this.TILE_SIZE, cx = this.player.x, cy = this.player.y;
                this._deepShatterFx(this.tsunamiFrozenEnemies, cx, cy, maxR);
                this._vfxFlash?.(cx, cy, maxR * T * 0.7, 0xbff0ff, 520, 1);   // Visuals.js
                this.showStatusText(cx, cy - 34, 'SHATTER!', '#bff0ff');
                const DC = this._iceCubeCfg();
                for (const enemy of [...this.tsunamiFrozenEnemies]) {
                    if (!enemy.sprite?.active || enemy.health <= 0) continue;
                    const dealt = enemy._cubeDealt || 0, pct = DC.DEEP_PCT * STAGE2 * Math.max(0, enemy.health);   // (its HP before the burst)
                    enemy._deepFrozen = false; enemy._cubeDealt = 0;
                    enemy._justFrozenAt = 0;            // its same-frame guard is for pierce spikes
                    enemy._quietShatter = true; this._triggerShatterBurst(enemy, SHATTER_MULT); enemy._quietShatter = false;   // (its own look is _deepShatterFx's)
                    if (pct > 0 && enemy.sprite?.active && enemy.health > 0) {   // a bite of its current HP
                        const bite = this.resolveElementalHit(enemy, pct, 'ice', true);
                        if (bite) { enemy.health -= bite; this.showDamageNumber(enemy.sprite.x, enemy.sprite.y - 34, Math.round(bite), '#bff0ff'); this.updateEnemyHealthBar(enemy); if (enemy.health <= 0) this.killEnemy(enemy); }
                    }
                    // and back comes a share of what the other elements put into it while it held
                    if (dealt > 0 && enemy.sprite?.active && enemy.health > 0) {
                        const extra = this.resolveElementalHit(enemy, dealt * DC.DEEP_SHARE, 'ice', true);
                        if (extra) { enemy.health -= extra; this.showDamageNumber(enemy.sprite.x, enemy.sprite.y - 24, Math.round(extra), '#d8f4ff'); this.updateEnemyHealthBar(enemy); if (enemy.health <= 0) this.killEnemy(enemy); }
                    }
                }
                for (const b of bosses()) {
                    // No x2 for frozen here: the bosses' own damage already shatters a frozen body
                    // (x2.5 Voltslime, x2 Sovereign), so this was x5.
                    this.damageBossAtTile(b.tileX, b.tileY, 7.5 * SHATTER_MULT * this.damageScaling, undefined, 'ice');   // (DEEP_DMG, no share of HP)
                }
                this.time.delayedCall(200, () => this.deactivateTsunami());
            };
            this._iceUltDetonate = null;             // (no second press: it shatters by itself, 3s in)
            this._iceUltDomainActive = true;         // past the wave: switching is allowed again
            const _at = Math.max(0, this.tsunamiFreezeDuration * (this._mods?.ultLong || 1) - 120);
            this.time.delayedCall(Math.max(0, _at - 450), () => { if (!_shattered && this.tsunamiActive) this._deepCreak(this.tsunamiFrozenEnemies); });   // the ice groans and splits first
            this.time.delayedCall(_at, _shatterAll);
        });
    }

    // The Deep Freeze's look, so it never reads as an ordinary cube: the block darkened to deep-sea blue, a crown of
    // frost crystals grown on top, and a ring of frost runes turning slowly under it. Added to the freeze visual's own
    // layers, so every path that clears a freeze clears these too.
    // Just before the Deep Freeze breaks: every block shudders and cracks spread across it, a groan of ice
    _deepCreak(list) {
        Sfx.play(this, 'freeze');
        for (const e of list || []) {
            const b = e.freezeVisuals?.iceBlock, s = e.sprite; if (!s?.active || !b?.active) continue;
            const key = ElementSystem.blockCrackKey(this), g = this.add.image(b.x, b.y, key).setDepth(4.35).setDisplaySize(b.displayWidth || 28, b.displayHeight || 28).setAlpha(0).setFlipX(Math.random() < 0.5);
            // (not in freezeVisuals._extraLayers: CreatureFX draws the block itself and mutes those)
            const t0 = this.time.now, x0 = b.x, sx0 = s.x;
            const step = () => {
                if (!g.active || !s.active || !e.isFrozen || e.health <= 0) { this.events.off('update', step); g.destroy(); if (s.active) s.x = sx0; return; }
                const k = Math.min(1, (this.time.now - t0) / 380), j = (Math.random() - 0.5) * 2.5 * k;
                g.setAlpha(k < 0.3 ? 0.5 : k < 0.65 ? 0.8 : 1).setX(x0 + j); s.x = sx0 + j;   // splitting in two jerks, shuddering harder as it goes
            };
            this.events.on('update', step); this.events.once('shutdown', () => this.events.off('update', step));   // (a restart keeps scene listeners: this one would run on into the next level)
        }
    }
    // The Deep Freeze breaking: a white-out, the camera punching in, every block blowing apart in a burst of frost (a flash
    // of its shape, a cloud of mist, a ring along the floor, glitter falling) and the frozen screen's cracks jumping out
    _deepShatterFx(list, cx, cy, maxR) {
        const T = this.TILE_SIZE, W = this.scale.width, H = this.scale.height, cam = this.cameras.main, z0 = cam.zoom;
        const wo = this.add.rectangle(W / 2, H / 2, W, H, 0xe8faff, 0.55).setScrollFactor(0).setDepth(20);
        this.tweens.add({ targets: wo, alpha: 0, duration: 380, ease: 'Quad.easeIn', onComplete: () => wo.destroy() });
        this.tweens.add({ targets: cam, zoom: z0 * 1.07, duration: 70, yoyo: true, hold: 60, ease: 'Quad.easeOut', onComplete: () => cam.setZoom(z0) });
        cam.shake(260, 0.011);
        this._iceCrackKickAt = this.time.now;   // read by the frozen screen (_iceFrostBegin)
        this._vfxFlash?.(cx, cy, T * 5, 0xbff0ff, 420, 0.6);
        for (const e of list || []) {
            const s = e.sprite; if (!s?.active) continue;
            const x = s.x, y = s.y, b = e.freezeVisuals?.iceBlock, bw = b?.displayWidth || 28, bh = b?.displayHeight || 28;
            const shape = this.add.rectangle(x, y, bw, bh, 0xd8f4ff, 0.8).setDepth(4.6).setBlendMode(Phaser.BlendModes.ADD);
            this.tweens.add({ targets: shape, scaleX: 1.7, scaleY: 1.7, alpha: 0, duration: 240, ease: 'Quad.easeOut', onComplete: () => shape.destroy() });
            for (let k = 0; k < 5; k++) {   // the frost cloud (blue-grey: white stacks into a bloomed blob)
                const a = k / 5 * Math.PI * 2 + Math.random(), m = this.add.image(x, y, 'vfx_glow').setTint(k % 2 ? 0x9cc8e4 : 0xb8dcf0).setDepth(4.5).setAlpha(0.4).setScale(0.2);
                this.tweens.add({ targets: m, x: x + Math.cos(a) * 26, y: y + Math.sin(a) * 14 - 6, scale: 0.5 + Math.random() * 0.2, alpha: 0, duration: 700 + Math.random() * 300, ease: 'Cubic.easeOut', onComplete: () => m.destroy() });
            }
            const ring = this.add.graphics().setDepth(0.96).setPosition(x, y + 10);   // along the floor, so flattened
            this.tweens.addCounter({ from: 0, to: 1, duration: 420, ease: 'Cubic.easeOut', onUpdate: tw => { const v = tw.getValue(); ring.clear().lineStyle(3 * (1 - v) + 1, 0xbff0ff, 1 - v).strokeEllipse(0, 0, 20 + v * 90, (20 + v * 90) * 0.36); }, onComplete: () => ring.destroy() });
            const glit = this.add.particles(x, y - 6, 'vfx_dot', { lifespan: { min: 500, max: 900 }, speedX: { min: -40, max: 40 }, speedY: { min: -70, max: -10 }, gravityY: 160, scale: { start: 0.4, end: 0 },
                alpha: { start: 1, end: 0 }, tint: [0xffffff, 0xcff4ff, 0x8ad8ff], blendMode: 'ADD', emitting: false }).setDepth(4.7);
            glit.explode(18); this.time.delayedCall(1000, () => glit.destroy());
        }
    }
    _deepFreezeFx(e) {
        const fv = e.freezeVisuals, s = e.sprite; if (!s?.active) return;
        const layers = fv ? (fv._extraLayers ||= []) : [];
        fv?.iceBlock?.setTint?.(0x4a8ad8);
        const x = s.x, y = s.y, d = (fv?.iceBlock?.depth ?? s.depth ?? 2.9) + 0.06;
        const crown = this.add.graphics().setDepth(d).setPosition(x, y - 12);
        for (const [dx, h] of [[-7, 6], [-3, 9], [0, 13], [3, 9], [7, 6]]) { crown.fillStyle(0x3a78c8, 1); crown.fillTriangle(dx - 2, 0, dx, -h, dx + 2, 0); crown.fillStyle(0xd8f4ff, 1); crown.fillTriangle(dx - 2, 0, dx, -h, dx, 0); }
        const runes = this.add.graphics().setDepth(0.95).setPosition(x, y + 10).setBlendMode(Phaser.BlendModes.ADD);
        runes.lineStyle(1.5, 0x8ad8ff, 0.8); runes.strokeEllipse(0, 0, 34, 12);
        for (let k = 0; k < 8; k++) { const a = k / 8 * Math.PI * 2, rx = Math.cos(a) * 17, ry = Math.sin(a) * 6; runes.lineBetween(rx - 2, ry, rx + 2, ry); runes.lineBetween(rx, ry - 1.5, rx, ry + 1.5); }
        crown.setScale(0.2); this.tweens.add({ targets: crown, scale: 1, duration: 260, ease: 'Back.easeOut' });
        this.tweens.add({ targets: runes, angle: 360, duration: 6000, repeat: -1 });
        this.tweens.add({ targets: runes, alpha: 0.45, duration: 700, yoyo: true, repeat: -1 });
        layers.push(crown, runes);
        if (!fv) this.time.delayedCall(this.tsunamiFreezeDuration || 4000, () => { crown.destroy(); runes.destroy(); });
    }

    deactivateTsunami() {
        this.tsunamiActive = false;
        this.ultDrainActive = false;

        // Clean up ice domain if still active
        if (this._domainSnowTimer)  { this._domainSnowTimer.remove();  this._domainSnowTimer  = null; }
        if (this._domainChillTimer) { this._domainChillTimer.remove(); this._domainChillTimer = null; }
        if (this._domainGustTimer)  { this._domainGustTimer.remove();  this._domainGustTimer  = null; }
        if (this._domainWindTimer)  { this._domainWindTimer.remove();  this._domainWindTimer  = null; }
        if (this._domainGraphics)   { for (const g of this._domainGraphics) { this.tweens.killTweensOf(g); g.destroy(); } this._domainGraphics = null; }
        if (this._domainTiles)      { this._domainTiles.forEach(t => { this.tweens.killTweensOf(t); t.destroy(); }); this._domainTiles = null; }
        if (this._domainRing)       { this.tweens.killTweensOf(this._domainRing); this._domainRing.destroy(); this._domainRing = null; }

        for (let enemy of this.tsunamiFrozenEnemies) {
            enemy._deepFrozen = false;
            if (enemy._tsunamiMultText) {
                enemy._tsunamiMultText.destroy();
                enemy._tsunamiMultText = null;
            }
        }
        this.tsunamiFrozenEnemies = [];

        // Fade out any remaining water tiles (e.g. if cancelled early)
        for (const t of this.tsunamiTiles) {
            this.tweens.killTweensOf(t.waterShimmer);
            this.tweens.add({
                targets: [t.waterTile, t.waterShimmer],
                alpha: 0, duration: 400,
                onComplete: () => { t.waterTile.destroy(); t.waterShimmer.destroy(); }
            });
        }
        this.tsunamiTiles = [];

        // Clear wet tint from any enemies that weren't frozen
        for (let enemy of this.enemies) {
            if (enemy.sprite && enemy.sprite.active && !enemy.isFrozen) {
                enemy.sprite.clearTint();
            }
        }
    }

    updateTsunami(time) {
        // Keep multiplier text pinned above frozen enemies
        for (let enemy of this.tsunamiFrozenEnemies) {
            if (enemy._tsunamiMultText && enemy.sprite && enemy.sprite.active) {
                enemy._tsunamiMultText.x = enemy.sprite.x;
                enemy._tsunamiMultText.y = enemy.sprite.y - 28;
            }
        }
    }

    updateTsunamiPuddles(time) {
        for (let i = this.tsunamiPuddles.length - 1; i >= 0; i--) {
            const puddle = this.tsunamiPuddles[i];
            if (time >= puddle.expiresAt) {
                if (puddle.waterTile && puddle.waterTile.active) puddle.waterTile.destroy();
                if (puddle.waterShimmer && puddle.waterShimmer.active) puddle.waterShimmer.destroy();
                this.tsunamiPuddles.splice(i, 1);
                continue;
            }

            for (let enemy of this.enemies) {
                if (this._phasedOut?.(enemy)) continue;
                if (!enemy.sprite || !enemy.sprite.active || enemy.isFrozen) continue;
                if (enemy.x === puddle.tileX && enemy.y === puddle.tileY) {
                    if (!enemy.isSlowed) {
                        this.showStatusText(enemy.sprite.x, enemy.sprite.y, 'WET', '#44aaff');
                    }
                    enemy.isSlowed = true;
                    enemy.slowedUntil = time + this.tsunamiPuddleSlowDuration;
                    // Arrows for the whole time it is slowed. This is re-evaluated every frame
                    // while the enemy stands in the puddle, which is exactly what
                    // _setSpeedIndicator's transition guard is for.
                    this._setSpeedIndicator?.(enemy, 'puddle', 'slow_ice', true, 340);
                }
            }
        }
    }

    createTsunamiPuddle(tileX, tileY) {
        const px = tileX * this.TILE_SIZE + this.TILE_SIZE / 2;
        const py = tileY * this.TILE_SIZE + this.TILE_SIZE / 2;

        // Exact same layered construction as tsunami tiles
        const waterTile = this._vfxWaterImg ? this._vfxWaterImg(px, py, false)
            : this.add.rectangle(px, py, this.TILE_SIZE, this.TILE_SIZE, 0x0066cc, 0.55).setDepth(0.5);
        const waterShimmer = this._vfxWaterImg ? this._vfxWaterImg(px, py, true)
            : this.add.rectangle(px, py, this.TILE_SIZE - 4, this.TILE_SIZE - 4, 0x44aaff, 0.3).setDepth(0.5);

        this.tweens.add({
            targets: waterShimmer,
            alpha: 0.6,
            duration: 150 + Math.random() * 100,
            yoyo: true, repeat: -1, ease: 'Sine.easeInOut'
        });

        // Fade in from nothing so it looks like the ice melted
        waterTile.setAlpha(0);
        waterShimmer.setAlpha(0);
        this.tweens.add({
            targets: [waterTile],
            alpha: 0.55,
            duration: 350,
            ease: 'Quad.easeOut'
        });
        this.tweens.add({
            targets: [waterShimmer],
            alpha: 0.3,
            duration: 350,
            ease: 'Quad.easeOut'
        });

        // Fade out at end of life
        const fadeDelay = this.tsunamiPuddleDuration - 500;
        this.time.delayedCall(fadeDelay, () => {
            if (waterTile.active) {
                this.tweens.add({ targets: [waterTile, waterShimmer], alpha: 0, duration: 500 });
            }
        });

        this.tsunamiPuddles.push({
            tileX, tileY,
            expiresAt: this.time.now + this.tsunamiPuddleDuration,
            waterTile,
            waterShimmer,
            ripple: null
        });
    }

    // ─── FIRE HELPERS ──────────────────────────────────────────────────

    // ── FORK (the lightning ult) ── a snap of your fingers stops time and you become lightning: the bolt streaks to the nearest enemy, then to
    // random ones in the room until it has passed through them all (a combo count over each), leaving its path behind it,
    // and back to you. A snap, and the whole web ignites: the comboed take HIT (more the higher their count), anything on
    // a path takes PATH. For AFTER_MS, damage to anything it touched splashes SHARE of itself (at most CAP) to those near it.
    _forkCfg() {
        const s2 = parseInt(localStorage.getItem('ultStage_lightning') || '1') >= 2;
        // Weak on a few, ruinous on a crowd: every hit is multiplied by CROWD per enemy past the first (up to CROWD_MAX)
        // (ESC: each hop that much quicker than the last, up to ESC_MAX, never under HOP_FLOOR ms)
        return { HIT: 18, HIT_PCT: 0.012, COMBO_STEP: 0.04, CROWD: 0.16, CROWD_MAX: 4.5, PATH: 8, PATH_R: 0.7, BOSS_PCT: 0.25, MAX_HOPS: 30, REACH: 12,
                 SPEED: 650, HOP_MIN: 120, HOP_MAX: 340, ESC: 0.12, ESC_MAX: 3.5, HOP_FLOOR: 45, STOP_MS: 450, TRANSFORM_MS: 420, SNAP_MS: 320, BOOM_MS: 160, ZOOM: 1.55,
                 AFTER_MS: (s2 ? 16000 : 12000) * (this._mods?.ultLong || 1), SPLASH_R: s2 ? 3 : 2.5, SHARE: 0.4, CAP: 30,
                 THUMP_MS: 350, THUMP_R: 2, THUMP_DAZE: 350, SPEED_MULT: 0.5,   // each step's thump: a squircle THUMP_R tiles round you (5x5, its corners off); you move at SPEED_MULT of the move delay
                 ZAP_R: 5, ZAP: 5, ZAP_PCT: 0.005, ZAP_FORKS: 2, ZAP_FORK_R: 3, ZAP_FORK_SHARE: 0.5 };   // ...and zaps everything within ZAP_R, each zap forking to ZAP_FORKS more
    }
    _forkTargets() {
        const T = this.TILE_SIZE, C = this._forkCfg(), ri = this.getCurrentPlayerRoom?.() ?? -1, R = ri >= 0 ? this.rooms?.[ri] : null;
        return (this.enemies || []).filter(e => e.sprite?.active && e.health > 0 && !this._phasedOut?.(e) && (R
            ? e.x >= R.x && e.x < R.x + R.w && e.y >= R.y && e.y < R.y + R.h
            : Math.hypot(e.x - this.playerX, e.y - this.playerY) <= C.REACH));
    }
    // where a bolt should land on an enemy: the middle of its body, not its feet or its head
    _forkAim(e) { const s = e.sprite, c = s.getCenter ? s.getCenter() : { x: s.x, y: s.y }; return { x: c.x, y: c.y, top: c.y - (s.displayHeight || 20) * 0.5 }; }
    // a lightning line from a to b: jagged, with a side branch or two, drawn as a glow, a body and a white-hot core
    _forkBolt(g, a, b, thick = 1, branches = true) {
        const L = Math.hypot(b.x - a.x, b.y - a.y), n = Math.max(3, Math.round(L / 12)), nx = -(b.y - a.y) / (L || 1), ny = (b.x - a.x) / (L || 1), pts = [a];
        for (let i = 1; i < n; i++) { const k = i / n, o = (Math.random() - 0.5) * Math.min(14, L * 0.12); pts.push({ x: a.x + (b.x - a.x) * k + nx * o, y: a.y + (b.y - a.y) * k + ny * o }); }
        pts.push(b);
        const strokes = [[9 * thick, 0xffb820, 0.22], [4.5 * thick, 0xffe14a, 0.75], [2 * thick, 0xffffff, 1]];
        for (const [w, col, al] of strokes) { g.lineStyle(w, col, al).beginPath(); g.moveTo(pts[0].x, pts[0].y); for (const q of pts) g.lineTo(q.x, q.y); g.strokePath(); }
        if (branches) for (let k = 1; k < pts.length - 1; k++) {
            if (Math.random() > 0.3) continue;
            const q = pts[k], ang = Math.atan2(b.y - a.y, b.x - a.x) + (Math.random() < 0.5 ? -1 : 1) * (0.5 + Math.random() * 0.6), len = 10 + Math.random() * 16;
            const m = { x: q.x + Math.cos(ang) * len * 0.5 + (Math.random() - 0.5) * 5, y: q.y + Math.sin(ang) * len * 0.5 }, e = { x: q.x + Math.cos(ang) * len, y: q.y + Math.sin(ang) * len };
            for (const [w, col, al] of [[3 * thick, 0xffe14a, 0.5], [1.2 * thick, 0xffffff, 0.9]]) { g.lineStyle(w, col, al).beginPath(); g.moveTo(q.x, q.y); g.lineTo(m.x, m.y); g.lineTo(e.x, e.y); g.strokePath(); }
        }
    }
    // The snap of the fingers: the world drops to deep blue for a blink, then a white flash, a shockwave off you, lightning
    // cracking out round you and the camera jolted. (New tweens still run in stopped time: only the ones already playing pause.)
    // (Not a camera postFX colour flip: alongside the bloom pipeline it rendered the screen black.)
    _forkSnapFx(x, y) {
        const cam = this.cameras.main, W = this.scale.width, H = this.scale.height, ADD = Phaser.BlendModes.ADD;
        Sfx.play(this, 'snap');
        const blue = this.add.rectangle(W / 2, H / 2, W, H, 0x3a4cff, 1).setScrollFactor(0).setDepth(19.4).setBlendMode(Phaser.BlendModes.MULTIPLY);
        this.tweens.addCounter({ duration: 90, onComplete: () => {
            blue.destroy();
            const fl = this.add.rectangle(W / 2, H / 2, W, H, 0xfff6d8, 0.7).setScrollFactor(0).setDepth(19.5);
            this.tweens.add({ targets: fl, alpha: 0, duration: 300, ease: 'Quad.easeOut', onComplete: () => fl.destroy() });
        } });
        for (const [r, w, col, ms] of [[40, 3, 0xfff2a0, 560], [26, 2, 0xffffff, 380]]) {   // the shockwave: two rings racing out
            const ring = this.add.graphics({ x, y }).setDepth(4.8).setBlendMode(ADD).lineStyle(w, col, 1).strokeCircle(0, 0, r);
            this.tweens.add({ targets: ring, scale: 300 / r, alpha: 0, duration: ms, ease: 'Cubic.easeOut', onComplete: () => ring.destroy() });
        }
        const cr = this.add.graphics().setDepth(4.75).setBlendMode(ADD);
        for (let k = 0; k < 9; k++) { const a = k / 9 * Math.PI * 2 + Math.random() * 0.5, L = 46 + Math.random() * 50; this._forkBolt(cr, { x, y }, { x: x + Math.cos(a) * L, y: y + Math.sin(a) * L }, 0.8, true); }
        this.tweens.add({ targets: cr, alpha: 0, duration: 420, ease: 'Quad.easeIn', onComplete: () => cr.destroy() });
        this._vfxFlash?.(x, y, 80, 0xffffff, 240, 1);
        cam.shake(160, 0.008);
    }
    _forkBegin() {
        if (this._forkStop) return;
        const C = this._forkCfg(), p = this.player, list = this._forkTargets();
        if (!list.length || !p?.active) { this.showStatusText?.(p.x, p.y - 30, 'NOTHING TO STRIKE', '#ffe14a'); return; }
        // the order: the nearest first, then at random through the rest
        const first = list.reduce((a, b) => Math.hypot(a.sprite.x - p.x, a.sprite.y - p.y) <= Math.hypot(b.sprite.x - p.x, b.sprite.y - p.y) ? a : b);
        const rest = list.filter(e => e !== first).sort(() => Math.random() - 0.5), order = [first, ...rest].slice(0, C.MAX_HOPS);
        this._forkStop = true; this._freezeClock?.(true);   // time stops: the scene clock, its tweens and every animation
        const W = this.scale.width, H = this.scale.height, ADD = Phaser.BlendModes.ADD, home = { x: p.x, y: p.y - 6 };
        const cam = this.cameras.main, z0 = cam.zoom, f0 = cam._follow, lx = cam.lerp.x, ly = cam.lerp.y;
        const dim = this.add.rectangle(W / 2, H / 2, W, H, 0x0a0a24, 0).setScrollFactor(0).setDepth(19);
        const web = this.add.graphics().setDepth(4.6), head = this.add.image(p.x, p.y, 'vfx_glow').setTint(0xfff6a0).setBlendMode(ADD).setScale(0).setDepth(4.7);
        const segs = [], combos = [];
        const drawWeb = (thick) => { web.clear(); for (const s of segs) this._forkBolt(web, s.a, s.b, thick, true); };   // re-jagged every frame: it crackles
        let stage = 'stop', t0 = this.game.loop.time, at = { ...home }, i = 0, from = at, hopMs = 0;
        this._forkSnapFx(home.x, home.y);   // the snap comes first: it's what stops everything
        cam.startFollow(head, false, 0.12, 0.12);   // the camera rides the bolt
        const done = () => { this.events.off('update', step); web.destroy(); head.destroy(); dim.destroy(); };
        const restoreCam = () => { if (f0) cam.startFollow(f0, false, lx, ly); };
        const step = () => {
            const now = this.game.loop.time, e = now - t0;   // (real time: the scene clock is stopped)
            if (!this.player?.active) { done(); combos.forEach(c => c.destroy()); restoreCam(); cam.setZoom(z0); this._forkStop = false; this._freezeClock?.(false); return; }
            if (stage === 'stop') {   // a held beat of stillness after the snap, the world draining dark
                dim.setAlpha(0.4 * Math.min(1, e / 120));
                if (e >= C.STOP_MS) { stage = 'transform'; t0 = now; Sfx.play(this, 'e_thunder'); p.setTintFill?.(0xfff6a0); }
            } else if (stage === 'transform') {   // the camera closes in, the slime goes white-hot and becomes a ball of lightning
                const k = Math.min(1, e / C.TRANSFORM_MS);
                cam.setZoom(z0 * (1 + (C.ZOOM - 1) * Phaser.Math.Easing.Cubic.Out(k)));
                head.setPosition(home.x, home.y).setScale(0.7 * k); p.setAlpha(1 - k);
                if (k >= 1) { stage = 'hop'; t0 = now; from = at; hopMs = 0; }
            } else if (stage === 'hop' || stage === 'return') {
                const tgt = stage === 'hop' ? order[i] : null, live = tgt?.sprite?.active, to = tgt ? (live ? this._forkAim(tgt) : from) : home;
                const esc = Math.min(C.ESC_MAX, 1 + C.ESC * i);   // it escalates: every enemy through, the next hop's quicker
                if (!hopMs) hopMs = Math.max(C.HOP_FLOOR, Phaser.Math.Clamp(Math.hypot(to.x - from.x, to.y - from.y) / (C.SPEED * esc) * 1000, C.HOP_MIN / esc, C.HOP_MAX / esc));
                const k = Phaser.Math.Easing.Quadratic.In(Math.min(1, e / hopMs)); at = { x: from.x + (to.x - from.x) * k, y: from.y + (to.y - from.y) * k };
                head.setPosition(at.x, at.y).setScale(0.6 + Math.random() * 0.2);
                drawWeb(1); this._forkBolt(web, from, at, 1.2, false);
                if (e >= hopMs) {
                    segs.push({ a: { x: from.x, y: from.y }, b: { x: to.x, y: to.y } });
                    if (tgt) {   // through it: its combo count goes up, just over its head
                        const n = i + 1;
                        if (live) {
                            const big = Math.min(1, (n - 1) / 19), col = Phaser.Display.Color.Interpolate.ColorWithColor(Phaser.Display.Color.ValueToColor(0xfff27a), Phaser.Display.Color.ValueToColor(0xffffff), 100, Math.round(big * 100));
                            const tx = this.add.text(to.x, to.y - 10, 'x' + n, { fontFamily: UIKit.FONT.title, fontSize: Math.round(12 + 18 * big) + 'px', fontStyle: 'bold',   // bigger and whiter the higher the combo
                                color: Phaser.Display.Color.RGBToString(col.r, col.g, col.b), stroke: n >= 10 ? '#5a2a00' : '#2a1a00', strokeThickness: 4 + Math.round(2 * big), resolution: 2 }).setOrigin(0.5, 1).setDepth(6 + n * 0.001).setScale(1.5 + big);
                            this.tweens.add({ targets: tx, scale: 1, duration: 140 + 80 * big, ease: 'Back.easeOut' }); combos.push(tx); tgt._forkCombo = n;
                            Sfx.play(this, 'zap'); this._vfxFlash?.(to.x, to.y, 46, 0xfff27a, 180, 0.7); this.cameras.main.shake(60, 0.002);
                        }
                        i++; if (i >= order.length) stage = 'return';
                    } else { stage = 'snap'; head.setScale(0); p.setAlpha(1).clearTint?.(); }
                    from = to; t0 = now; hopMs = 0;
                }
            } else if (stage === 'snap') {   // back where you began; the camera pulls back out; a snap of the fingers
                drawWeb(1);
                cam.setZoom(z0 * (1 + (C.ZOOM - 1) * (1 - Math.min(1, e / C.SNAP_MS))));
                if (e >= C.SNAP_MS && !this._forkSnapped) { this._forkSnapped = true; this._forkSnapFx(home.x, home.y); restoreCam(); }
                if (e >= C.SNAP_MS + C.BOOM_MS) { this._forkSnapped = false; cam.setZoom(z0); stage = 'boom'; t0 = now; this._forkStop = false; this._freezeClock?.(false); this._forkIgnite(order, segs, combos); }
            } else if (stage === 'boom') {   // the web goes off: white-hot and thick, then fading
                const k = e / 700; dim.setAlpha(Math.max(0, 0.4 - k));
                drawWeb(2.4 - k * 1.6); web.setAlpha(Math.max(0, 1 - k));
                if (k >= 1) done();
            }
        };
        this.events.on('update', step); this.events.once('shutdown', () => this.events.off('update', step));   // (a restart keeps scene listeners: this one would run on into the next level)
    }
    // A step in the aftermath: the floor thumps in a 5x5 squircle round you (dazing what's on it), and every enemy within ZAP_R
    // takes a zap that forks on to ZAP_FORKS more near it
    _forkThump(A) {
        const C = this._forkCfg(), T = this.TILE_SIZE, now = this.time.now, px = this.playerX, py = this.playerY, R = C.THUMP_R;
        const inSquircle = (dx, dy) => Math.abs(dx) <= R && Math.abs(dy) <= R && !(Math.abs(dx) === R && Math.abs(dy) === R);   // the squircle: a square, corners off
        const g = this.add.graphics().setDepth(0.27).setBlendMode(Phaser.BlendModes.ADD);
        for (let dx = -R; dx <= R; dx++) for (let dy = -R; dy <= R; dy++) {
            if (!inSquircle(dx, dy) || this.world?.[px + dx]?.[py + dy] !== this.FLOOR) continue;
            const k = 1 - (Math.abs(dx) + Math.abs(dy)) / (R + 2);
            g.fillStyle(0xffe14a, 0.15 + 0.3 * k).fillRect((px + dx) * T + 1, (py + dy) * T + 1, T - 2, T - 2);
        }
        this.tweens.add({ targets: g, alpha: 0, duration: 260, onComplete: () => g.destroy() });
        this.cameras.main.shake(50, 0.0015); Sfx.play(this, 'zap');
        const ri = this.getCurrentPlayerRoom?.() ?? -1, gated = this._roomGated?.() && ri >= 0;   // only your room: its zaps went through walls into rooms still under fog
        const live = (this.enemies || []).filter(e => !this._phasedOut?.(e) && e.sprite?.active && e.health > 0 && (!gated || e.tutorialRoomIndex === undefined || e.tutorialRoomIndex === ri));
        for (const e of live) if (inSquircle(e.x - px, e.y - py)) { e.isStunned = true; e.stunnedUntil = Math.max(e.stunnedUntil || 0, now + C.THUMP_DAZE); }
        const me = { x: this.player.x, y: this.player.y - 6 };
        const zap = (e, mult, from) => {
            const raw = (C.ZAP * this.damageScaling + C.ZAP_PCT * (e.isBoss ? C.BOSS_PCT : 1) * (e.maxHealth || 0)) * mult;
            const d = this.resolveElementalHit(e, raw, 'lightning', true); if (d === null || !(d > 0)) return;
            e.health -= d; A.forks.push({ a: from, b: this._forkAim(e), until: now + 140 });
            this.showDamageNumber(e.sprite.x, e.sprite.y - 20, d, '#fff27a'); this.updateEnemyHealthBar(e); if (e.health <= 0) this.killEnemy(e);
        };
        this._asUlt('lightning', () => {
            for (const e of live.filter(e => Math.hypot(e.x - px, e.y - py) <= C.ZAP_R)) {
                if (!e.sprite?.active || e.health <= 0) continue;
                const at = this._forkAim(e); zap(e, 1, me);
                const near = live.filter(o => o !== e && o.sprite?.active && o.health > 0 && Math.hypot(o.x - e.x, o.y - e.y) <= C.ZAP_FORK_R)
                    .sort((a, b) => Math.hypot(a.x - e.x, a.y - e.y) - Math.hypot(b.x - e.x, b.y - e.y)).slice(0, C.ZAP_FORKS);
                for (const o of near) zap(o, C.ZAP_FORK_SHARE, at);
            }
            this._hitPortalsAround?.(px, py, C.ZAP_R, C.ZAP * this.damageScaling);   // queens in reach of the thump's zap
        });
    }
    _forkIgnite(order, segs, combos) {
        const C = this._forkCfg(), T = this.TILE_SIZE, W = this.scale.width, H = this.scale.height;
        const fl = this.add.rectangle(W / 2, H / 2, W, H, 0xfff6c0, 0.5).setScrollFactor(0).setDepth(20);
        this.tweens.add({ targets: fl, alpha: 0, duration: 320, onComplete: () => fl.destroy() });
        this.cameras.main.shake(320, 0.012); Sfx.play(this, 'e_thunder'); Sfx.play(this, 'blburst');
        combos.forEach(c => this.tweens.add({ targets: c, y: c.y - 18, alpha: 0, duration: 600, onComplete: () => c.destroy() }));
        const near = (e) => { const c = this._forkAim(e); return segs.some(s => { const ax = s.a.x, ay = s.a.y, bx = s.b.x, by = s.b.y, L2 = (bx - ax) ** 2 + (by - ay) ** 2 || 1;
            const k = Phaser.Math.Clamp(((c.x - ax) * (bx - ax) + (c.y - ay) * (by - ay)) / L2, 0, 1);
            return Math.hypot(c.x - (ax + (bx - ax) * k), c.y - (ay + (by - ay) * k)) <= C.PATH_R * T; }); };
        const hurt = (e, raw, col) => { const d = this.resolveElementalHit(e, raw, 'lightning', true); if (d === null || !(d > 0)) return;
            e.health -= d; this.showDamageNumber(e.sprite.x, e.sprite.y - 30, Math.round(d), col); this.updateEnemyHealthBar(e); if (e.health <= 0) this.killEnemy(e); };
        const crowd = Math.min(C.CROWD_MAX, 1 + C.CROWD * (order.length - 1));   // the bigger the crowd, the harder every bolt lands
        if (order.length >= 6) this.showStatusText(this.player.x, this.player.y - 50, `CROWD x${crowd.toFixed(1)}`, '#fff27a');
        this._asUlt('lightning', () => {
            for (const e of [...(this.enemies || [])]) {
                if (!e.sprite?.active || e.health <= 0) continue;
                const n = e._forkCombo || 0, onPath = near(e); e._forkCombo = 0;
                if (!n && !onPath) continue;
                const pct = (e.isBoss ? C.BOSS_PCT : 1) * C.HIT_PCT * (e.maxHealth || 0);
                if (n) hurt(e, (C.HIT * this.damageScaling + pct) * crowd * (1 + C.COMBO_STEP * (n - 1)), '#fff27a');
                if (onPath && e.sprite?.active && e.health > 0) hurt(e, C.PATH * this.damageScaling * crowd, '#ffe14a');
            }
            // queens aren't in the bolt's hops: every one in the room takes a hop's worth (they took nothing)
            const room = this.getCurrentPlayerRoom?.() ?? -1, rr = room >= 0 ? this.rooms?.[room] : null;
            for (const p of [...(this.portals || [])]) if (p.active && (rr ? p.tileX >= rr.x && p.tileX < rr.x + rr.w && p.tileY >= rr.y && p.tileY < rr.y + rr.h : Math.hypot(p.tileX - this.playerX, p.tileY - this.playerY) <= 12))
                this.damagePortal(p, C.HIT * this.damageScaling * crowd);
        });
        // the aftermath, AFTER_MS: damage to ANY enemy forks to the ones near it (SHARE, at most CAP), and every step you take thumps the floor
        const A = this._forkAfter = { until: this.time.now + C.AFTER_MS, hp: new Map(), forks: [], px: this.playerX, py: this.playerY, thumpAt: 0 };
        for (const e of this.enemies || []) if (e.sprite?.active) A.hp.set(e, e.health);
        const g = this.add.graphics().setDepth(4.55);
        const tick = () => {
            const now = this.time.now;
            if (this._forkAfter !== A || now >= A.until || !this.player?.active) { this.events.off('update', tick); g.destroy(); if (this._forkAfter === A) this._forkAfter = null; return; }
            g.clear();
            if ((this.playerX !== A.px || this.playerY !== A.py) && now >= A.thumpAt) {   // a step: the floor thumps, dazing round you
                A.thumpAt = now + C.THUMP_MS; this._forkThump(A);
            }
            A.px = this.playerX; A.py = this.playerY;
            const ri = this.getCurrentPlayerRoom?.() ?? -1, gated = this._roomGated?.() && ri >= 0;
            const here = o => !gated || o.tutorialRoomIndex === undefined || o.tutorialRoomIndex === ri;   // forks stay in your room
            for (const e of this.enemies || []) {
                if (!e.sprite?.active || e.health <= 0) { A.hp.delete(e); continue; }
                const last = A.hp.has(e) ? A.hp.get(e) : e.health; A.hp.set(e, e.health);
                const lost = last - e.health;
                if (!(lost > 0)) continue;
                const amt = Math.min(lost * C.SHARE, C.CAP * this.damageScaling), from = this._forkAim(e);
                for (const o of [...(this.enemies || [])]) {
                    if (o === e || !o.sprite?.active || o.health <= 0 || !here(o) || Math.hypot(o.x - e.x, o.y - e.y) > C.SPLASH_R) continue;
                    const d = this.resolveElementalHit(o, amt, 'lightning', true); if (d === null || !(d > 0)) continue;
                    o.health -= d; A.hp.set(o, o.health);   // (a splash doesn't splash again)
                    A.forks.push({ a: from, b: this._forkAim(o), until: now + 160 });
                    this.showDamageNumber(o.sprite.x, o.sprite.y - 20, Math.round(d), '#fff27a'); this.updateEnemyHealthBar(o); if (o.health <= 0) this.killEnemy(o);
                }
            }
            A.forks = A.forks.filter(f => f.until > now);
            for (const f of A.forks) this._forkBolt(g, f.a, f.b, 0.6, true);   // the jump, a fork of lightning
        };
        this.events.on('update', tick); this.events.once('shutdown', () => this.events.off('update', tick));   // (a restart keeps scene listeners: this one would run on into the next level)
    }
    activateLightningStorm() {
        if (this.lightningUltActive) return; // already running — ignore re-trigger

        const ULT_DURATION  = 4000 * (this._mods?.ultLong || 1);    // was 5.5s; Grand Overture runs it longer
        const ZAP_RADIUS    = 4;
        const ZAP_INTERVAL  = 50;
        const ZAP_DMG_MULT  = 1.5;
        const stage         = parseInt(localStorage.getItem('ultStage_lightning') || '1');

        // Stage 2: faster glide + afterimage sentries
        const SENTRY_CD       = 500;   // ms between sentry spawns (while moving)
        const SENTRY_POST_ULT = 0;     // sentries end with the storm (they used to linger 7s)
        const SENTRY_RADIUS   = 3;     // tile radius for sentry zap

        this.ultDrainActive      = true;
        this.ultDrainStartTime   = this.time.now;
        this.ultDrainDuration    = ULT_DURATION;
        this.lightningUltActive  = true;
        this.lightningUltInvuln  = true;
        this.lightningUltEndTime = this.time.now + ULT_DURATION;

        // Activate thunderhead glide movement
        this.thunderheadActive     = true;
        this.thunderheadEndTime    = this.time.now + ULT_DURATION;
        this.thunderheadGlideSpeed = stage >= 2 ? 200 : 160; // px/s
        this.thunderheadGlideX   = this.player.x;
        this.thunderheadGlideY   = this.player.y - this.SLIME_Y_OFFSET;

        // Screen flash
        const screenFlash = this.add.rectangle(this.scale.width/2, this.scale.height/2, this.scale.width, this.scale.height, 0xffff44, 0.45).setScrollFactor(0).setDepth(20);
        this.tweens.add({ targets: screenFlash, alpha: 0, duration: 250, onComplete: () => screenFlash.destroy() });

        this.player.setTint(0xffff44);

        const label = stage >= 2 ? 'FORK II' : 'FORK';
        const notice = this.add.text(this.scale.width/2, 80, label, {
            fontSize: '22px', fontFamily: 'monospace', color: '#ffff00',
            stroke: '#000000', strokeThickness: 4, fontStyle: 'bold'
        }).setOrigin(0.5).setScrollFactor(0).setDepth(25).setVisible(!this._vfxUltBanner);   // the cast banner names it now
        this.tweens.add({ targets: notice, y: 55, alpha: 0, duration: 2000, onComplete: () => notice.destroy() });

        // ── Helper: zap enemies in radius from a pixel position ──────
        const _zapFromPos = (px, py, tileX, tileY, dmgMult = 1.0) => {
            const globalHit = [];
            for (const enemy of [...this.enemies]) {
                if (this._phasedOut?.(enemy)) continue;
                if (!enemy.sprite?.active) continue;
                const dist = Math.abs(enemy.x - tileX) + Math.abs(enemy.y - tileY);
                if (dist > ZAP_RADIUS) continue;
                if (globalHit.includes(enemy)) continue;
                this.drawLightningBolt({ sprite: { x: px, y: py } }, enemy);
                this.performChainLightningShared(enemy, this.baseLightningDamage * this.damageScaling * ZAP_DMG_MULT * dmgMult, globalHit, this.lightningChainFalloff);
            }
            if (this.voltslimeBoss?.active) {
                const bd = Math.abs(this.voltslimeBoss.tileX - tileX) + Math.abs(this.voltslimeBoss.tileY - tileY);
                if (bd <= ZAP_RADIUS) this.damageBossAtTile(this.voltslimeBoss.tileX, this.voltslimeBoss.tileY, this.baseLightningDamage * this.damageScaling * 1.5 * dmgMult, undefined, 'lightning');
            }
            if (this.voidSovereignBoss?.active) {
                const bd = Math.abs(Math.floor(this.voidSovereignBoss.container.x / this.TILE_SIZE) - tileX) + Math.abs(Math.floor(this.voidSovereignBoss.container.y / this.TILE_SIZE) - tileY);
                if (bd <= ZAP_RADIUS) this.damageBossAtTile(this.voidSovereignBoss.tileX, this.voidSovereignBoss.tileY, this.baseLightningDamage * this.damageScaling * 1.5 * dmgMult, undefined, 'lightning');
            }
            if (this.fractureCore?.active) {
                const bd = Math.abs(this.fractureCore.tileX - tileX) + Math.abs(this.fractureCore.tileY - tileY);
                if (bd <= ZAP_RADIUS) this.damageBossAtTile(this.fractureCore.tileX, this.fractureCore.tileY, this.baseLightningDamage * this.damageScaling * 1.5 * dmgMult, undefined, 'lightning');
            }
            if (this.portals) {
                for (const portal of this.portals) {
                    if (!portal.active) continue;
                    const pd = Math.abs(portal.tileX - tileX) + Math.abs(portal.tileY - tileY);
                    if (pd <= ZAP_RADIUS) this.damagePortal(portal, this.baseLightningDamage * this.damageScaling * ZAP_DMG_MULT * dmgMult);
                }
            }
        };

        // ── Player zap timer ─────────────────────────────────────────
        const zapTimer = this.time.addEvent({
            delay: ZAP_INTERVAL, loop: true,
            callback: () => {
                if (!this.lightningUltActive) { zapTimer.remove(); return; }
                _zapFromPos(this.player.x, this.player.y, this.playerX, this.playerY);
            }
        });

        // ── Stage 2: afterimage sentries ─────────────────────────────
        const sentries = [];
        this._lightningUltSentries = sentries;
        let lastSentryTime   = 0;
        let lastPlayerX      = this.player.x;
        let lastPlayerY      = this.player.y;

        const sentryTimer = stage >= 2 ? this.time.addEvent({
            delay: 60, loop: true,
            callback: () => {
                const now = this.time.now;

                // Stop entirely once the ult is over AND every sentry has expired —
                // sentries themselves keep ticking/zapping after the ult ends, they
                // just stop spawning new ones (no player gliding to spawn them from)
                if (!this.lightningUltActive && sentries.length === 0) {
                    sentryTimer?.remove();
                    return;
                }

                if (this.lightningUltActive) {
                    const moved = Math.abs(this.player.x - lastPlayerX) > 2 || Math.abs(this.player.y - lastPlayerY) > 2;
                    lastPlayerX = this.player.x; lastPlayerY = this.player.y;

                    // Spawn sentry if cooldown up AND player is moving
                    if (moved && now - lastSentryTime >= SENTRY_CD) {
                        lastSentryTime = now;
                        const remainingUltTime = Math.max(0, this.lightningUltEndTime - now);
                        const thisSentryDur = remainingUltTime + SENTRY_POST_ULT;
                        this._spawnLightningSentry(this.player.x, this.player.y, this.playerX, this.playerY, thisSentryDur, ZAP_RADIUS, SENTRY_RADIUS, _zapFromPos);
                    }
                }

                // Tick all sentries — zap nearby enemies (continues after ult ends,
                // until each sentry hits its own expiresAt)
                for (let i = sentries.length - 1; i >= 0; i--) {
                    const sentry = sentries[i];
                    if (now >= sentry.expiresAt) {
                        sentry.destroy();
                        sentries.splice(i, 1);
                        continue;
                    }
                    if (now - sentry.lastZap >= ZAP_INTERVAL) {
                        sentry.lastZap = now;
                        _zapFromPos(sentry.px, sentry.py, sentry.tileX, sentry.tileY, 1.2);
                    }
                }
            }
        }) : null;

        // ── Cleanup ───────────────────────────────────────────────────
        this.time.delayedCall(ULT_DURATION, () => {
            this.lightningUltActive  = false;
            this.lightningUltInvuln  = false;
            this.ultDrainActive      = false;
            this.thunderheadActive   = false;
            zapTimer.remove();
            // sentryTimer is NOT removed here — it keeps running so existing
            // sentries continue zapping and naturally expire 7s after this point,
            // acting as temporary turrets left behind once the ult itself ends.
            this._lightningUltSentries = null; // no new sentries will spawn now
            if (this.player?.active) this.player.clearTint();
            // Snap player to nearest valid tile after glide ends
            const snap = this.snapToNearestFloor(this.thunderheadGlideX, this.thunderheadGlideY);
            if (snap) {
                this.playerX = snap.tx; this.playerY = snap.ty;
                this.player.x = snap.px; this.player.y = snap.py + this.SLIME_Y_OFFSET;
            }
        });
    }

    _spawnLightningSentry(px, py, tileX, tileY, duration, zapRadius, sentryRadius, _zapFn) {
        // Afterimage — slime_blue sprite at same position, tinted bright yellow, semi-transparent
        const ghost = this.add.sprite(px, py, 'slime_blue', 0)
            .setScale(this.player.scaleX || 2)
            .setTint(0xffff44)
            .setAlpha(0.45)
            .setDepth(this.player.depth - 0.1 || 1.9);

        // Subtle pulse to read as "active sentry"
        this.tweens.add({
            targets: ghost, alpha: 0.25, duration: 400,
            yoyo: true, repeat: -1, ease: 'Sine.easeInOut'
        });

        // Small zap arc radiating out every zap tick — visual feedback
        const sentry = {
            px, py, tileX, tileY,
            expiresAt: this.time.now + duration,
            lastZap: this.time.now,
            destroy: () => {
                this.tweens.killTweensOf(ghost);
                this.tweens.add({
                    targets: ghost, alpha: 0, duration: 200,
                    onComplete: () => { if (ghost.active) ghost.destroy(); }
                });
            }
        };

        if (this._lightningUltSentries) this._lightningUltSentries.push(sentry);
        return sentry;
    }

    updateStormCloud(time) {
        if (!this.stormCloudActive || !this.stormCloud) return;

        const cloudX = this.stormCloud.thrown ? this.stormCloud.thrownX : this.player.x;
        const cloudY = this.stormCloud.thrown ? this.stormCloud.thrownY : (this.player.y - 40);

        // Only follow player if not thrown
        if (!this.stormCloud.thrown) {
            this.stormCloud.body.x = this.player.x;
            this.stormCloud.body.y = this.player.y - 40;
            this.stormCloud.darkCore.x = this.player.x;
            this.stormCloud.darkCore.y = this.player.y - 40;
            this.stormCloud.crackle.x = this.player.x;
            this.stormCloud.crackle.y = this.player.y - 40;
            this.stormCloud.outerCrackle.x = this.player.x;
            this.stormCloud.outerCrackle.y = this.player.y - 40;
            this.stormCloud.chargeText.x = this.player.x;
            this.stormCloud.chargeText.y = this.player.y - 40;

            // Update spark positions
            this.stormCloud.sparks.forEach((spark, index) => {
                const baseAngle = (Math.PI * 2 / 6) * index;
                const rotationAngle = baseAngle + (time / 2000) * Math.PI * 2;
                const distance = 40;
                spark.x = cloudX + Math.cos(rotationAngle) * distance;
                spark.y = cloudY + Math.sin(rotationAngle) * distance;
            });
        }

        // Update charge text and color
        const chargePercent = Math.floor(this.stormCloudCharge);
        this.stormCloud.chargeText.setText(`${chargePercent}%`);

        // Change color based on charge
        if (chargePercent > 70) {
            this.stormCloud.chargeText.setColor('#ffff00');
        } else if (chargePercent > 30) {
            this.stormCloud.chargeText.setColor('#ffaa00');
        } else {
            this.stormCloud.chargeText.setColor('#ff6600');
        }

        if (time - this.stormCloudLastAttack >= this.stormCloudAutoAttackInterval) {
            this.stormCloudAutoAttack();
            this.stormCloudLastAttack = time;

            this.stormCloudCharge -= this.stormCloudChargeDecayPerAttack;

            if (this.stormCloudCharge <= 0) {
                this.deactivateStormCloud();
            }
        }

        const chargePercent2 = this.stormCloudCharge / 100;
        this.stormCloud.body.setScale(0.8 + chargePercent2 * 0.4);
        this.stormCloud.darkCore.setScale(0.8 + chargePercent2 * 0.4);
        this.stormCloud.crackle.setAlpha(0.4 + chargePercent2 * 0.4);
        this.stormCloud.outerCrackle.setAlpha(0.3 + chargePercent2 * 0.5);
    }

    stormCloudAutoAttack() {
        const nearbyEnemies = [];
        const maxRange = 15;

        // Use the cloud's actual position (thrown location or player position)
        const cloudTileX = this.stormCloud.thrown
            ? Math.floor(this.stormCloud.thrownX / this.TILE_SIZE)
            : this.playerX;
        const cloudTileY = this.stormCloud.thrown
            ? Math.floor(this.stormCloud.thrownY / this.TILE_SIZE)
            : this.playerY;

        for (let enemy of this.enemies) {
            if (this._phasedOut?.(enemy)) continue;
            const dist = Math.abs(enemy.x - cloudTileX) + Math.abs(enemy.y - cloudTileY);
            if (dist <= maxRange) {
                nearbyEnemies.push({ enemy, dist });
            }
        }

        if (nearbyEnemies.length === 0) return;

        // Track all enemies hit this tick so chains don't double-hit
        const globalHitEnemies = [];

        for (let { enemy } of nearbyEnemies) {
            // Skip if already hit by a chain this tick
            if (globalHitEnemies.includes(enemy)) continue;

            this.drawLightningBolt(
                { sprite: this.stormCloud.body },
                enemy
            );

            this.performChainLightningShared(enemy, this.baseLightningDamage * this.damageScaling * 0.8, globalHitEnemies, this.lightningUltChainFalloff);
        }
    }

    // Like performChainLightning but shares a hit-list across the whole tick

    performChainLightningShared(sourceEnemy, damage, globalHitEnemies, falloff) {
        globalHitEnemies.push(sourceEnemy);

        this.damageEnemy(sourceEnemy, damage, 'lightning');
        this.damageBossAtTile(sourceEnemy.x, sourceEnemy.y, damage, undefined, 'lightning');
        this._zapBosses(sourceEnemy, damage * falloff, this.lightningChainRange, globalHitEnemies);

        if (typeof sourceEnemy.sprite?.setTint === 'function') sourceEnemy.sprite.setTint(0xffff00);
        this.time.delayedCall(100, () => {
            if (sourceEnemy.sprite && sourceEnemy.sprite.active) {
                sourceEnemy.sprite.clearTint();
            }
        });

        let nearestEnemy = null;
        let nearestDist = Infinity;

        for (let enemy of this.enemies) {
            if (this._phasedOut?.(enemy)) continue;
            if (globalHitEnemies.includes(enemy)) continue;

            const dist = Math.abs(enemy.x - sourceEnemy.x) + Math.abs(enemy.y - sourceEnemy.y);

            if (dist <= this.lightningChainRange && dist < nearestDist) {
                nearestEnemy = enemy;
                nearestDist = dist;
            }
        }

        if (nearestEnemy) {
            this.drawLightningBolt(sourceEnemy, nearestEnemy);
            this.performChainLightningShared(nearestEnemy, damage * falloff, globalHitEnemies, falloff);
        }
    }

    deactivateStormCloud() {

        this.stormCloudActive = false;

        if (this.stormCloud) {
            // Stop flash interval
            if (this.stormCloud.flashInterval) {
                this.stormCloud.flashInterval.remove();
            }

            // Kill all tweens
            this.tweens.killTweensOf(this.stormCloud.body);
            this.tweens.killTweensOf(this.stormCloud.darkCore);
            this.tweens.killTweensOf(this.stormCloud.crackle);
            this.tweens.killTweensOf(this.stormCloud.outerCrackle);
            this.stormCloud.sparks.forEach(spark => {
                this.tweens.killTweensOf(spark);
            });

            // Fade out all elements
            this.tweens.add({
                targets: [
                    this.stormCloud.body,
                    this.stormCloud.darkCore,
                    this.stormCloud.crackle,
                    this.stormCloud.outerCrackle,
                    this.stormCloud.chargeText,
                    ...this.stormCloud.sparks
                ],
                alpha: 0,
                duration: 300,
                onComplete: () => {
                    this.stormCloud.body.destroy();
                    this.stormCloud.darkCore.destroy();
                    this.stormCloud.crackle.destroy();
                    this.stormCloud.outerCrackle.destroy();
                    this.stormCloud.chargeText.destroy();
                    this.stormCloud.sparks.forEach(spark => spark.destroy());
                    this.stormCloud = null;
                }
            });
        }
    }

    throwLightning() {
        if (!this.stormCloudActive || !this.stormCloud) return;

        const worldX = this.pointerX + this.cameras.main.scrollX;
        const worldY = this.pointerY + this.cameras.main.scrollY;

        const tileX = Math.floor(worldX / this.TILE_SIZE);
        const tileY = Math.floor(worldY / this.TILE_SIZE);

        const targetPixelX = tileX * this.TILE_SIZE + this.TILE_SIZE / 2;
        const targetPixelY = tileY * this.TILE_SIZE + this.TILE_SIZE / 2;

        // Mark cloud as thrown
        this.stormCloud.thrown = true;
        this.stormCloud.thrownX = targetPixelX;
        this.stormCloud.thrownY = targetPixelY;

        // Animate throw
        const allElements = [
            this.stormCloud.body,
            this.stormCloud.darkCore,
            this.stormCloud.crackle,
            this.stormCloud.outerCrackle,
            this.stormCloud.chargeText,
            ...this.stormCloud.sparks
        ];

        this.tweens.add({
            targets: allElements,
            x: targetPixelX,
            y: targetPixelY,
            duration: 500,
            ease: 'Quad.easeOut'
        });
    }

    updateThunderhead(time, delta) {
        if (!this.thunderheadActive) return;

        if (time >= this.thunderheadEndTime) {
            this.deactivateThunderhead();
            return;
        }

        // Update aura and cloud sprite to follow player
        if (this._cloudSprite?.active) {
            this._cloudSprite.x = this.player.x;
            this._cloudSprite.y = this.player.y;
        }
        if (this._thunderheadAura?.active) {
            this._thunderheadAura.x = this.player.x;
            this._thunderheadAura.y = this.player.y;
        }
        if (this._thunderheadOuterRing?.active) {
            this._thunderheadOuterRing.x = this.player.x;
            this._thunderheadOuterRing.y = this.player.y;
        }

        // Spawn crackling trail
        if (time - this.thunderheadLastTrail >= this.thunderheadTrailInterval) {
            this.thunderheadLastTrail = time;
            this.spawnThunderheadTrail(this.player.x, this.player.y, time);
        }

        // HUD timer
        const remaining = ((this.thunderheadEndTime - time) / 1000).toFixed(1);
        if (!this._thunderheadTimerText?.active) {
            // .active also catches a stale reference to an already-destroyed
            // Text object (e.g. surviving a scene restart), not just a missing one
            this._thunderheadTimerText = this.add.text(this.scale.width / 2, 100, '', {
                fontSize: '18px', fontFamily: 'monospace', color: '#ffff88',
                stroke: '#000000', strokeThickness: 3
            }).setOrigin(0.5).setScrollFactor(0);
        }
        this._thunderheadTimerText.setText(`THUNDERHEAD ${remaining}s`);
    }

    spawnThunderheadTrail(x, y, time) {
        // Bright crackling node
        const node = this.add.circle(x, y, 8, 0xffff00, 0.7);
        node.setStrokeStyle(2, 0xffffff, 0.9);
        const inner = this.add.circle(x, y, 4, 0xffffff, 1);

        this.tweens.add({
            targets: [node, inner],
            radius: { from: node.radius, to: 2 },
            alpha: 0,
            duration: 600,
            ease: 'Quad.easeIn',
            onComplete: () => { node.destroy(); inner.destroy(); }
        });

        // Small arcs radiating out
        for (let i = 0; i < 3; i++) {
            const angle = Math.random() * Math.PI * 2;
            const len = 10 + Math.random() * 15;
            const g = this.add.graphics();
            g.lineStyle(1.5, 0xffff00, 0.8);
            g.beginPath();
            g.moveTo(x, y);
            g.lineTo(x + Math.cos(angle) * len, y + Math.sin(angle) * len);
            g.strokePath();
            this.tweens.add({ targets: g, alpha: 0, duration: 150, onComplete: () => g.destroy() });
        }
    }

    deactivateThunderhead() {
        this.thunderheadActive = false;
        this.ultDrainActive = false;

        if (this._thunderheadAura) { this.tweens.killTweensOf(this._thunderheadAura); this._thunderheadAura.destroy(); this._thunderheadAura = null; }
        if (this._thunderheadOuterRing) { this.tweens.killTweensOf(this._thunderheadOuterRing); this._thunderheadOuterRing.destroy(); this._thunderheadOuterRing = null; }
        if (this._thunderheadTimerText) { this._thunderheadTimerText.destroy(); this._thunderheadTimerText = null; }

        // Snap to nearest valid floor tile
        const snap = this.snapToNearestFloor(this.thunderheadGlideX, this.thunderheadGlideY);
        if (snap) {
            this.playerX = snap.tx;
            this.playerY = snap.ty;
            this.player.x = snap.px;
            this.player.y = snap.py + this.SLIME_Y_OFFSET;
        } else {
            this.player.x = this.playerX * this.TILE_SIZE + this.TILE_SIZE / 2;
            this.player.y = this.playerY * this.TILE_SIZE + this.TILE_SIZE / 2 + this.SLIME_Y_OFFSET;
        }

        // Play dissipate animation then restore player sprite
        if (this._cloudSprite) {
            this._cloudSprite.play('cloud_dissipate');
            this._cloudSprite.once('animationcomplete', () => {
                if (this._cloudSprite) {
                    this.tweens.add({
                        targets: this._cloudSprite,
                        alpha: 0,
                        duration: 200,
                        onComplete: () => {
                            if (this._cloudSprite) { this._cloudSprite.destroy(); this._cloudSprite = null; }
                        }
                    });
                }
                this.player.setVisible(true);
                this.player.setAlpha(1);
                this.player.clearTint();
            });
        } else {
            this.player.setVisible(true);
            this.player.setAlpha(1);
            this.player.clearTint();
        }
    }

    applySuperConduct(enemy) {
        if (!enemy.sprite || !enemy.sprite.active) return;
        if (enemy._immuneFx === 'lightning' || this._phasedOut(enemy)) return;   // an Adaptive Shade in its lightning form
        enemy.isSuperConducted = true;
        enemy.superConductUntil = this.time.now + this.superConductDuration;

        if (enemy.superConductVisual) {
            if (enemy.superConductVisual.container?.active) {
                this.tweens.killTweensOf(enemy.superConductVisual.container);
                enemy.superConductVisual.container.destroy();
            }
            enemy.superConductVisual = null;
        }

        const ex = enemy.sprite.x, ey = enemy.sprite.y;

        // Detailed electric sigil — concentric rings + angled crackle lines + bright core dot
        const container = this.add.container(ex, ey - 18).setDepth(2.2);

        const g = this.add.graphics();

        // Outer ring
        g.lineStyle(1, 0xffff44, 0.55);
        g.strokeCircle(0, 0, 9);

        // Inner ring
        g.lineStyle(1, 0xffffff, 0.35);
        g.strokeCircle(0, 0, 5);

        // Four angled crackle lines radiating outward (like a compass rose, slightly jagged)
        const crackleAngles = [0, Math.PI / 2, Math.PI, Math.PI * 1.5];
        crackleAngles.forEach(a => {
            const midX = Math.cos(a + 0.25) * 6, midY = Math.sin(a + 0.25) * 6;
            const endX = Math.cos(a) * 11, endY = Math.sin(a) * 11;
            g.lineStyle(1.5, 0xffff88, 0.75);
            g.beginPath(); g.moveTo(Math.cos(a) * 4, Math.sin(a) * 4);
            g.lineTo(midX, midY); g.lineTo(endX, endY); g.strokePath();
        });

        // Bright core dot
        g.fillStyle(0xffffff, 0.9);
        g.fillCircle(0, 0, 2);

        container.add(g);

        // Slow rotation — subtle, not distracting
        this.tweens.add({
            targets: container,
            angle: 360,
            duration: 3000,
            repeat: -1,
            ease: 'Linear'
        });

        enemy.superConductVisual = { container, g };
        if (typeof enemy.sprite?.setTint === 'function') enemy.sprite.setTint(0xffffaa);

        this.showStatusText(enemy.sprite.x, enemy.sprite.y, 'AMPED', '#ffff44');
    }

    clearSuperConduct(enemy) {
        enemy.isSuperConducted = false;
        enemy.superConductUntil = 0;
        if (enemy.superConductVisual) {
            if (enemy.superConductVisual.container?.active) {
                this.tweens.killTweensOf(enemy.superConductVisual.container);
                enemy.superConductVisual.container.destroy();
            }
            enemy.superConductVisual = null;
        }
        if (enemy.sprite && enemy.sprite.active && !enemy.isFrozen && !enemy.isBurning) {
            enemy.sprite.clearTint();
        }
    }

    updateSuperConductors(time) {
        for (let enemy of this.enemies) {
            if (!enemy.isSuperConducted) continue;
            if (!enemy.sprite || !enemy.sprite.active) { this.clearSuperConduct(enemy); continue; }
            if (time >= enemy.superConductUntil) {
                this.clearSuperConduct(enemy);
                continue;
            }
            if (enemy.superConductVisual?.container?.active) {
                enemy.superConductVisual.container.setPosition(enemy.sprite.x, enemy.sprite.y - 18);
            }
        }
    }

    cancelNodeChannel() {
        if (!this.nodeChannelActive) return;
        this.nodeChannelActive = false;
        this.nodeChannelType = null;
        this.nodeChannelTarget = null;
        if (this.nodeChannelVisual) {
            const v = this.nodeChannelVisual;
            [v.ghost, v.barBg, v.barFill, v.barLabel].forEach(o => { if (o && o.active) o.destroy(); });
            this.nodeChannelVisual = null;
        }
    }

    updateNodeChannel(time) {
        if (!this.nodeChannelActive || !this.nodeChannelVisual) return;

        const v = this.nodeChannelVisual;
        const duration = this._towerChannelDuration || 4000;
        const elapsed = time - this.nodeChannelStartTime;
        const pct = Math.min(elapsed / duration, 1);
        const ts = this.TILE_SIZE;
        const barW = ts + 12;
        const bx = this.player.x - barW / 2;
        const by = this.player.y - 36;

        v.barBg.x = bx + barW / 2; v.barBg.y = by + 3;
        v.barFill.x = bx; v.barFill.y = by + 3;
        v.barFill.width = barW * pct;
        v.barLabel.x = bx + barW / 2; v.barLabel.y = by;

        if (pct < 1) return;

        const { tileX, tileY, towerType } = this.nodeChannelTarget;
        const type = this.nodeChannelType;
        this.cancelNodeChannel();

        if (type === 'tower_craft') {
            const def = this._engineerTowerDefs()[towerType];
            if (def) {
                // Recompute cost at completion time (same formula as placeEngineerTower)
                const typeCount = [...this.engineerTowers, ...this.engineerTowersCrafting].filter(t => t.towerType === towerType).length;
                const currentCost = def.cost * (Math.floor(typeCount / 3) + 1);
                this.orbScraps -= currentCost;
                this.saveScrapBank();
                this.updateHUD();
                this.finishPlacingEngineerTower(tileX, tileY, towerType);
            }
        } else if (type === 'tower_remove') {
            const ti = this.engineerTowers.findIndex(t => t.tileX === tileX && t.tileY === tileY);
            if (ti !== -1) {
                const tower = this.engineerTowers[ti];
                const def = this._engineerTowerDefs()[tower.towerType];
                // Refund based on current tier — what this tower actually cost
                const typeCountBeforeRemoval = this.engineerTowers.filter(t => t.towerType === tower.towerType).length;
                const paidCost = def ? def.cost * (Math.floor((typeCountBeforeRemoval - 1) / 3) + 1) : 0;
                this.destroyEngineerTower(tower);
                this.engineerTowers.splice(ti, 1);
                const refund = Math.floor(paidCost * this.orbRefundPct);
                if (refund > 0) {
                    this.orbScraps += refund;
                    this.saveScrapBank();
                    this.showStatusText(this.player.x, this.player.y - 20, `+${refund} SCRAPS`, '#aaffcc');
                    this.updateHUD();
                }
            }
        }
    }

    spawnOrbScrap(x, y) {
        const g = this.add.graphics().setDepth(3.5);
        g.fillStyle(0x00cc88, 1); g.fillCircle(0, 0, 5);
        g.fillStyle(0x00ffaa, 0.8); g.fillCircle(0, 0, 3.5);
        g.fillStyle(0xffffff, 0.7); g.fillCircle(-1.5, -1.5, 1.5);
        g.lineStyle(1.5, 0x00ffcc, 0.9); g.strokeCircle(0, 0, 5);
        g.x = x; g.y = y;

        const landX = x + (Math.random() - 0.5) * 20;
        const landY = y + 6 + Math.random() * 8;

        const orb = { g, landX, landY, attracting: false, tweensKilled: false };
        // Lazily initialised, like activeWaterTiles elsewhere. This used to rely on
        // GameScene.create() having run first, which was safe only while the drop was gated on
        // a specific weapon being equipped. Ungating it meant EVERY kill in EVERY scene reaches
        // here -- TowerDefenseScene included -- and a kill before create() finished, or in a
        // scene that never sets up the array, threw on this line.
        if (!this.orbObjects) this.orbObjects = [];
        this.orbObjects.push(orb);

        // Pop up then drop to landing pos
        this.tweens.add({
            targets: g, x: landX, y: y - 18, duration: 180, ease: 'Quad.easeOut',
            onComplete: () => {
                if (!g.active) return;
                this.tweens.add({
                    targets: g, y: landY, duration: 240, ease: 'Bounce.easeOut',
                    onComplete: () => {
                        if (!g.active || orb.attracting) return;
                        // Gentle bob after landing
                        this.tweens.add({ targets: g, y: landY - 2, duration: 500, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
                    }
                });
            }
        });
    }

    updateOrbScraps() {
        const px = this.player.x, py = this.player.y;
        const attractDist = this.orbPickupRadius * this.TILE_SIZE;
        const now = this.time.now;

        for (let i = this.orbObjects.length - 1; i >= 0; i--) {
            const orb = this.orbObjects[i];
            if (orb.collected || !orb.g || !orb.g.active) {
                this.orbObjects.splice(i, 1);
                continue;
            }

            const dx = px - orb.g.x, dy = py - orb.g.y;
            const dist = Math.sqrt(dx * dx + dy * dy);

            if (dist < attractDist || orb.attracting) {
                if (!orb.attracting) {
                    orb.attracting = true;
                    this.tweens.killTweensOf(orb.g);
                }

                if (dist < 14) {
                    // Collect — mark immediately to prevent double-collect
                    orb.collected = true;
                    this.tweens.killTweensOf(orb.g);
                    orb.g.destroy();
                    this.orbObjects.splice(i, 1);
                    this.orbScraps++;
                    this.saveScrapBank();   // clamps to BANK_CAP and survives the level change
                    this.updateHUD();
                    const flash = this.add.circle(px, py, 8, 0x00ffaa, 0.5).setDepth(4);
                    this.tweens.add({ targets: flash, radius: 18, alpha: 0, duration: 180, onComplete: () => flash.destroy() });
                    continue;
                }

                // Move toward player
                const spd = 4 + (attractDist - Math.max(dist, 1)) * 0.1;
                orb.g.x += (dx / dist) * spd;
                orb.g.y += (dy / dist) * spd;
            } else if (!orb.magnetized) {
                // Bob gently — only if not being pulled by the player or a Magnetizer
                orb.g.y = orb.landY + Math.sin(now / 500 + i) * 2;
            }
        }
    }

    // ═══════════════════════════════════════════════════════════════════════
    // ENGINEERING DEGREE — TOWER PLACEMENT (validated placement -> channel
    // with ghost+bar -> completion deducts scraps and spawns the real entity).
    // ═══════════════════════════════════════════════════════════════════════

    placeEngineerTower(tileX, tileY, towerType) {
        if (tileX < 0 || tileX >= this.WORLD_WIDTH || tileY < 0 || tileY >= this.WORLD_HEIGHT) return;
        if (this.world[tileX][tileY] !== this.FLOOR) return;

        const TOWER_DEFS = this._engineerTowerDefs();
        const def = TOWER_DEFS[towerType];
        if (!def) return;

        const dist = Math.abs(tileX - this.playerX) + Math.abs(tileY - this.playerY);
        if (dist > (def.placeDist ?? 3)) { this.showStatusText(this.player.x, this.player.y - 20, 'TOO FAR', '#ffff44'); return; }

        if (!this.engineerTowers) this.engineerTowers = [];
        if (!this.engineerTowersCrafting) this.engineerTowersCrafting = [];

        if (this.engineerTowers.find(t => t.tileX === tileX && t.tileY === tileY)) return;
        if (this.engineerTowersCrafting.find(c => c.tileX === tileX && c.tileY === tileY)) return;

        // Magnetizer is capped at 1 total — a second one is rejected
        if (towerType === 'magnetizer') {
            const magCount = [...this.engineerTowers, ...this.engineerTowersCrafting].filter(t => t.towerType === 'magnetizer').length;
            if (magCount >= 1) {
                this.showStatusText(this.player.x, this.player.y - 20, 'MAX 1 MAGNETIZER', '#ffff44'); return;
            }
        }

        // Dynamic pricing — cost scales every 3 placed of this type (live count only)
        const typeCount = [...this.engineerTowers, ...this.engineerTowersCrafting].filter(t => t.towerType === towerType).length;
        const currentCost = def.cost * (Math.floor(typeCount / 3) + 1);

        if (this.orbScraps < currentCost) {
            this.showStatusText(this.player.x, this.player.y - 20, `NEED ${currentCost} SCRAPS`, '#ff6644'); return;
        }

        if (this.nodeChannelActive) this.cancelNodeChannel();

        this.nodeChannelActive = true;
        this.nodeChannelType = 'tower_craft';
        this.nodeChannelTarget = { tileX, tileY, towerType };
        this.nodeChannelStartTime = this.time.now;

        const ts = this.TILE_SIZE;
        const ghost = this.add.graphics().setDepth(1.6);
        ghost.fillStyle(def.color, 0.35);
        ghost.fillRect(tileX * ts, tileY * ts, ts, ts);
        ghost.lineStyle(1.5, def.color, 0.8);
        ghost.strokeRect(tileX * ts, tileY * ts, ts, ts);

        const barW = ts + 12;
        const barBg   = this.add.rectangle(0, 0, barW, 6, 0x000000, 0.85).setDepth(5);
        const barFill = this.add.rectangle(0, 0, 0, 6, def.color, 1).setOrigin(0, 0.5).setDepth(5.1);
        const barLabel = this.add.text(0, 0, `BUILDING ${def.name.toUpperCase()}`, {
            fontSize: '10px', fontFamily: 'monospace', color: '#ffffff', stroke: '#000', strokeThickness: 2
        }).setOrigin(0.5, 1).setDepth(5.2);

        this.nodeChannelVisual = { ghost, barBg, barFill, barLabel };
        this._towerChannelDuration = def.craftDuration ?? 4000;
    }

    removeEngineerTowerAt(tileX, tileY) {
        const ci = (this.engineerTowersCrafting || []).findIndex(c => c.tileX === tileX && c.tileY === tileY);
        if (ci !== -1) {
            const c = this.engineerTowersCrafting[ci];
            this.tweens.killTweensOf(c.barFill); if (c.ghostDot) this.tweens.killTweensOf(c.ghostDot);
            [c.ghost, c.barBg, c.barFill, c.barLabel, c.ghostDot].forEach(o => { if (o?.active) o.destroy(); });
            this.engineerTowersCrafting.splice(ci, 1);
            return true;
        }
        const ti = (this.engineerTowers || []).findIndex(t => t.tileX === tileX && t.tileY === tileY);
        if (ti !== -1) {
            const targetTower = this.engineerTowers[ti];
            const removeDef = this._engineerTowerDefs()[targetTower.towerType];
            const d = Math.abs(tileX - this.playerX) + Math.abs(tileY - this.playerY);
            if (d > (removeDef?.placeDist ?? 3)) { this.showStatusText(this.player.x, this.player.y - 20, 'TOO FAR', '#ffff44'); return false; }

            if (this.nodeChannelActive) this.cancelNodeChannel();

            this.nodeChannelActive = true;
            this.nodeChannelType = 'tower_remove';
            this.nodeChannelTarget = { tileX, tileY };
            this.nodeChannelStartTime = this.time.now;

            const ts = this.TILE_SIZE;
            const ghost = this.add.graphics().setDepth(5);
            ghost.lineStyle(2, 0xff4444, 0.8);
            ghost.strokeRect(tileX * ts, tileY * ts, ts, ts);

            const barW = ts + 12;
            const barBg   = this.add.rectangle(0, 0, barW, 6, 0x000000, 0.85).setDepth(5);
            const barFill = this.add.rectangle(0, 0, 0, 6, 0xff4444, 1).setOrigin(0, 0.5).setDepth(5.1);
            const barLabel = this.add.text(0, 0, 'DISMANTLING', {
                fontSize: '10px', fontFamily: 'monospace', color: '#ff8888', stroke: '#000', strokeThickness: 2
            }).setOrigin(0.5, 1).setDepth(5.2);

            this.nodeChannelVisual = { ghost, barBg, barFill, barLabel };
            this._towerChannelDuration = 2000; // dismantling is faster than building
            return true;
        }
        return false;
    }

    // ── ENGINEERING DEGREE: THE SCRAP BANK ───────────────────────────────────
    // The weapon used to be a game inside the game. Scraps only dropped while Engineering
    // Degree was ACTIVELY OUT (CombatSystem gated on `currentElement === 'lightning' &&
    // equipped === 'engineering_degree'`), and the wrench on its own does 2 damage. So
    // funding the towers required playing the weapon, and playing the weapon without
    // towers was the weakest option in the game -- a chicken-and-egg that made the whole
    // kit an all-or-nothing commitment for a whole run.
    //
    // Split earning from spending. Scraps accrue from ANY kill with ANY weapon as long as
    // Engineering Degree occupies the lightning slot, and the bank is RUN-SCOPED: it
    // carries across rooms so you bank through the early ones and cash out in the hard
    // ones at the end, and it dies with the run. Deliberately NOT localStorage -- a bank
    // that survives death turns into a grind you top up by replaying an easy floor, which
    // is a different game to the one this is meant to serve. Wielding the wrench still
    // pays better, so it stays a choice rather than just a wallet you never open.
    _scrapCfg() {
        return {
            // Tuned against the real level-6 roster (67 enemies over 15 rooms) for a bank
            // that spans ONE LEVEL. The first pass used 0.18/0.30 with a 24-cost coil,
            // which was sized for banking across floors: run-scoped, that pays out 12
            // scraps a level against a 24 cost, so the player could never afford a single
            // coil and the whole kit was unusable. Rates and prices have to be set against
            // the bank's actual lifetime, not against the drop feeling reasonable per kill.
            //
            // At these numbers: first coil lands around room 7 of 15, and a level funds
            // roughly 2 of them -- support that arrives for the hard back half, which is
            // the point.
            // One rate, any kill, any weapon, any element. Was two rates gated on which
            // lightning weapon was equipped; both the gate and the split died with the
            // passive rework. 0.55 is the number the economy was measured against
            // (67 enemies x 0.55 = ~37 scraps a level against 8-14 per gadget).
            DROP_RATE:     0.55,
            BANK_CAP:      40      // ~3 gadgets: enough to matter, not the whole menu
        };
    }

    // The whole scrap-drop decision, so CombatSystem.killEnemy needs exactly one optional
    // call into this system rather than three separate reaches.
    _maybeDropScrap(enemy) {
        if (!enemy?.sprite?.active) return false;
        // NO WEAPON GATE. This used to require Engineering Degree in the lightning slot,
        // which was correct when the scrap economy belonged to that weapon -- and became
        // wrong the moment the Field Kit turned into a passive. The whole point of making it
        // a passive was that it costs no weapon slot, yet earning still demanded one: with
        // Fists or Orb Emitter equipped the gadget economy was simply dead.
        //
        // DROP_WIELDING is gone with it. A passive has nothing to wield, so a bonus rate for
        // "having it out" could not mean anything.
        // Tower runs only: scraps pay for picks there, and buy nothing in story mode now that
        // gadgets run on cooldowns.
        if (!this.towerRun) return false;
        const C = this._scrapCfg();
        if (Math.random() >= C.DROP_RATE) return false;
        this.spawnOrbScrap(enemy.sprite.x, enemy.sprite.y);
        return true;
    }

    // ── RUN-SCOPED BANK ──────────────────────────────────────────────────────
    // Held in Phaser's registry, which lives on the game rather than on a scene, so it
    // survives a scene transition but not the process. That is the correct lifetime for a
    // run: no save file to grind against, and nothing to clear on quit.
    _scrapStore() {
        // Fallback for contexts with no registry (a scene booted without one, and
        // TowerDefenseScene, which runs its own separate `scraps` economy).
        if (this.registry) return this.registry;
        if (!this._scrapFallback) {
            const bag = {};
            this._scrapFallback = { get: k => bag[k], set: (k, v) => { bag[k] = v; } };
        }
        return this._scrapFallback;
    }

    beginScrapRun() {
        this._scrapStore().set('orbScraps', 0);
        this.orbScraps = 0;
        return 0;
    }

    loadScrapBank() {
        const C = this._scrapCfg();
        const raw = this._scrapStore().get('orbScraps');
        const n = typeof raw === 'number' ? raw : parseInt(raw ?? '0');
        this.orbScraps = Math.max(0, Math.min(C.BANK_CAP, isNaN(n) ? 0 : n));
        return this.orbScraps;
    }

    saveScrapBank() {
        const C = this._scrapCfg();
        this.orbScraps = Math.max(0, Math.min(C.BANK_CAP, this.orbScraps || 0));
        this._scrapStore().set('orbScraps', this.orbScraps);
        return this.orbScraps;
    }

    // Single source of truth for tower stats — cost, combat numbers, HP, visuals
    _engineerTowerDefs() {
        if (!this._cachedEngineerDefs) {
            this._cachedEngineerDefs = {
            // Dearer AND stronger than the old 10/10/60: most of a level's income buys one,
            // and it earns the wait. Not priced higher than this -- a single level is all
            // the time there is to save up.
            tesla_coil: {
                name: 'Tesla Coil', cost: 16, hp: 95, range: 10, baseDamage: 18, chainFalloff: 2,
                fireInterval: 750, chainTargets: 5, color: 0x44aaff,
                boltSpeed: 700, // px/s — chain bolt travel speed
                craftDuration: 2000, placeDist: 5,
            },
            sniper_tower: {
                name: 'Sniper Tower', cost: 6, hp: 25, range: 22, damage: 20,
                fireInterval: 2000, chainTargets: 1, color: 0xff6644,
                pierce: 2, bulletSpeed: 600, prefireDur: 900,
                craftDuration: 1000, placeDist: 10, // can be built much further from the player
            },
            machine_gun: {
                name: 'Machine Gun', cost: 5, hp: 20, range: 8, damage: 0.5,
                fireInterval: 100, chainTargets: 1, color: 0xffcc44,
                bulletSpeed: 400, burstCount: 3,
                craftDuration: 500, placeDist: 3,
            },
            magnetizer: {
                name: 'Magnetizer', cost: 22, hp: 180, range: 0, damage: 0,
                fireInterval: 0, chainTargets: 0, color: 0x44ffaa,
                isMagnetizer: true, pullRadius: 15, // tiles — pulls scraps toward itself
                craftDuration: 250, placeDist: 3,
            },
        };
        }
        return this._cachedEngineerDefs;
    }

    finishPlacingEngineerTower(tileX, tileY, towerType) {
        if (tileX < 0 || tileX >= this.WORLD_WIDTH || tileY < 0 || tileY >= this.WORLD_HEIGHT) return;
        if (this.world[tileX][tileY] !== this.FLOOR) return;

        const def = this._engineerTowerDefs()[towerType];
        if (!def) return;

        const px = tileX * this.TILE_SIZE + this.TILE_SIZE / 2;
        const py = tileY * this.TILE_SIZE + this.TILE_SIZE / 2;
        const ts = this.TILE_SIZE;

        // Base plate — shared across all 3 types
        const base = this.add.graphics().setDepth(1.6);
        base.fillStyle(0x222222, 0.92);
        base.fillRect(tileX * ts + 3, tileY * ts + 3, ts - 6, ts - 6);
        base.lineStyle(1.5, def.color, 0.85);
        base.strokeRect(tileX * ts + 3, tileY * ts + 3, ts - 6, ts - 6);

        // Body graphics, distinct per type, drawn on top of base in local (0,0) space
        const body = this.add.graphics().setDepth(1.7);
        body.x = px; body.y = py;
        this._drawEngineerTowerBody(body, towerType, def.color);

        // Range ring — faint, shows detection/pull radius depending on tower type
        const ringRadiusTiles = def.isMagnetizer ? def.pullRadius : def.range;
        const rangeRing = this.add.circle(px, py, ringRadiusTiles * ts, 0, 0).setDepth(1.5);
        rangeRing.setStrokeStyle(1, def.color, 0.18);

        // HP bar — only visible once damaged
        const hpBarBg   = this.add.rectangle(px, tileY * ts - 4, ts, 4, 0x000000, 0.75).setDepth(3.5).setVisible(false);
        const hpBarFill = this.add.rectangle(px - ts / 2, tileY * ts - 4, ts, 4, def.color, 0.95).setOrigin(0, 0.5).setDepth(3.6).setVisible(false);

        // Placement flash
        const flash = this.add.circle(px, py, ts * 0.8, def.color, 0.4).setDepth(3);
        this.tweens.add({ targets: flash, radius: ts * 1.5, alpha: 0, duration: 250, onComplete: () => flash.destroy() });

        if (!this.engineerTowers) this.engineerTowers = [];
        this.engineerTowers.push({
            tileX, tileY, px, py, towerType,
            hp: def.hp, maxHp: def.hp,
            base, body, rangeRing, hpBarBg, hpBarFill,
            lastFireTime: 0,
            active: true,
        });
    }

    // Distinct silhouette per tower type, drawn in the body graphics' local space
    _drawEngineerTowerBody(g, towerType, color) {
        g.clear();
        if (towerType === 'tesla_coil') {
            // Tall coil with orbiting ring — AoE chain caster
            g.fillStyle(color, 0.95);
            g.fillRect(-3, -14, 6, 20);
            g.fillStyle(0xffffff, 0.85);
            g.fillCircle(0, -14, 4);
            g.lineStyle(1.5, color, 0.6);
            g.strokeCircle(0, -10, 8);
        } else if (towerType === 'sniper_tower') {
            // Long thin barrel — long range single target
            g.fillStyle(color, 0.95);
            g.fillRect(-2, -4, 4, 10);
            g.fillRect(-1.5, -16, 3, 14);
            g.fillStyle(0xffffff, 0.85);
            g.fillCircle(0, -16, 2.5);
        } else if (towerType === 'machine_gun') {
            // Real turret silhouette: circular swivel base, body, twin barrels
            // Base ring (swivel mount)
            g.fillStyle(0x222222, 0.9);
            g.fillCircle(0, -2, 11);
            g.lineStyle(1.5, color, 0.5);
            g.strokeCircle(0, -2, 11);
            // Turret body
            g.fillStyle(color, 0.95);
            g.fillCircle(0, -6, 7);
            g.fillStyle(0xffffff, 0.35);
            g.fillCircle(-2, -8, 3); // highlight
            g.lineStyle(1.2, 0x000000, 0.4);
            g.strokeCircle(0, -6, 7);
            // Twin barrels, forward-facing
            g.fillStyle(0x444444, 1);
            g.fillRect(-5, -18, 3, 13);
            g.fillRect(2, -18, 3, 13);
            g.fillStyle(0x666666, 0.9);
            g.fillRect(-5, -18, 1.2, 13);
            g.fillRect(2, -18, 1.2, 13);
            // Barrel tips
            g.fillStyle(0x111111, 1);
            g.fillRect(-5, -18, 3, 2.5);
            g.fillRect(2, -18, 3, 2.5);
        } else if (towerType === 'magnetizer') {
            // Horseshoe magnet — passive scrap puller, no barrel/weapon shape
            g.lineStyle(5, color, 0.95);
            g.beginPath();
            g.arc(0, -6, 9, Math.PI * 0.15, Math.PI * 0.85, false);
            g.strokePath();
            // Magnet poles (red/blue tips)
            g.fillStyle(0xff4444, 0.95);
            g.fillRect(-11, -8, 4, 7);
            g.fillStyle(0x4488ff, 0.95);
            g.fillRect(7, -8, 4, 7);
            // Faint pulsing core
            g.fillStyle(0xffffff, 0.6);
            g.fillCircle(0, -6, 3);
        }
    }

    destroyEngineerTower(tower) {
        this.tweens.killTweensOf(tower.rangeRing);
        if (tower.base?.active) tower.base.destroy();
        if (tower.body?.active) tower.body.destroy();
        if (tower.rangeRing?.active) tower.rangeRing.destroy();
        if (tower.hpBarBg?.active) tower.hpBarBg.destroy();
        if (tower.hpBarFill?.active) tower.hpBarFill.destroy();
        this._clearSniperTowerWarning(tower); // safe no-op for non-sniper towers

        // Destruction burst
        const g = this.add.graphics().setDepth(4).setPosition(tower.px, tower.py);
        g.fillStyle(0x222222, 0.9); g.fillCircle(0, 0, 10);
        g.lineStyle(2, 0xff6644, 0.85); g.strokeCircle(0, 0, 14);
        this.tweens.add({ targets: g, scaleX: 2.2, scaleY: 2.2, alpha: 0, duration: 280, onComplete: () => g.destroy() });
        this.cameras.main.shake(15, 0.002);
    }

    // Tower damage — called from enemy projectile/AoE collision checks. Towers
    // are never targeted by melee enemy AI (no pathing changes needed), but
    // anything that already flies through the room (ranged shots, boss attacks,
    // elemental arcs) can clip a tower standing in its path.
    damageEngineerTower(tower, amount) {
        if (!tower?.active) return;
        tower.hp -= amount;
        this.showDamageNumber(tower.px, tower.py - 14, Math.round(amount), '#ff8866');
        // Graphics objects don't support tint — use a brief red overlay flash instead
        const flash = this.add.circle(tower.px, tower.py, this.TILE_SIZE * 0.4, 0xff2222, 0.6).setDepth(2.0);
        this.tweens.add({ targets: flash, alpha: 0, duration: 150, onComplete: () => flash.destroy() });
        if (tower.hp <= 0) {
            tower.active = false;
            this.destroyEngineerTower(tower);
            const idx = this.engineerTowers.indexOf(tower);
            if (idx !== -1) this.engineerTowers.splice(idx, 1);
        }
    }

    // Shared helper for boss/enemy AoE attacks — damages any tower within a tile
    // radius (Manhattan distance, matching how most boss attacks measure player
    // distance) of a center tile. Used so each boss attack only needs one line
    // added rather than reimplementing tower-search each time.
    _damageTowersInTileRadius(centerTileX, centerTileY, radiusTiles, damage) {
        if (!this.engineerTowers?.length) return;
        for (const tower of this.engineerTowers) {
            if (!tower.active) continue;
            const d = Math.abs(tower.tileX - centerTileX) + Math.abs(tower.tileY - centerTileY);
            if (d <= radiusTiles) this.damageEngineerTower(tower, damage);
        }
    }

    // Same as above but measured in raw pixels from a world-space point —
    // for attacks that check distance in pixels rather than tiles.
    _damageTowersInPixelRadius(centerPx, centerPy, radiusPx, damage) {
        if (!this.engineerTowers?.length) return;
        for (const tower of this.engineerTowers) {
            if (!tower.active) continue;
            const d = Math.hypot(tower.px - centerPx, tower.py - centerPy);
            if (d <= radiusPx) this.damageEngineerTower(tower, damage);
        }
    }


    // Per-frame tower combat — target acquisition (with amped extended
    // range, same pattern as lightning nodes) and firing per type.
    updateEngineerTowers(time) {
        if (!this.engineerTowers?.length) return;
        const TS = this.TILE_SIZE;
        const TOWER_DEFS = this._engineerTowerDefs();

        for (let i = this.engineerTowers.length - 1; i >= 0; i--) {
            const tower = this.engineerTowers[i];
            if (!tower.active) continue;
            const def = TOWER_DEFS[tower.towerType];
            if (!def) continue;

            // HP bar visibility/update — only shown once damaged
            const damaged = tower.hp < tower.maxHp;
            if (damaged !== tower._hpBarShown) {
                tower._hpBarShown = damaged;
                tower.hpBarBg.setVisible(damaged);
                tower.hpBarFill.setVisible(damaged);
            }
            if (damaged) {
                tower.hpBarFill.width = TS * Math.max(0, tower.hp / tower.maxHp);
            }

            // Magnetizer doesn't attack — it passively pulls scraps toward itself
            if (def.isMagnetizer) {
                this._magnetizerPull(tower, def);
                continue;
            }

            if (tower.towerType === 'sniper_tower') {
                this._updateSniperTower(tower, def, time);
                continue;
            }

            if (time - (tower.lastFireTime || 0) < def.fireInterval) continue;

            // Acquire targets in range — base range for all enemies, extended
            // range additionally for amped enemies (same rule as nodes).
            // Room-gated: only targets enemies in the same room as the tower —
            // prevents sniper towers from shooting through walls into other rooms.
            const towerRoom = this._roomGated()
                ? this.getCurrentPlayerRoom() : -1;
            const extRange = def.range * 1.6;
            const inRange = this.enemies.filter(e => {
                if (this._phasedOut?.(e)) return false;
                if (!e.sprite?.active) return false;
                if (e._cloaked) return false; // cloaked = untargetable by towers
                if (towerRoom !== -1 && (e.tutorialRoomIndex ?? -1) !== towerRoom) return false;
                const d = Math.hypot(e.x - tower.tileX, e.y - tower.tileY); // Euclidean — matches the circular ring
                return d <= def.range || (e.isSuperConducted && d <= extRange);
            });
            if (inRange.length === 0) continue;

            tower.lastFireTime = time;

            if (tower.towerType === 'tesla_coil') {
                this._fireTeslaCoil(tower, def, inRange);
            } else if (tower.towerType === 'machine_gun') {
                // Closest enemy in range
                let closest = inRange[0], closestD = Infinity;
                for (const e of inRange) {
                    const d = Math.abs(e.x - tower.tileX) + Math.abs(e.y - tower.tileY);
                    if (d < closestD) { closestD = d; closest = e; }
                }
                this._fireMachineGunBullet(tower, def, closest);
                this._flashEngineerTower(tower, def.color);
            }
        }
    }

    // Tesla Coil — fires up to chainTargets simultaneous traveling bolts (one per
    // initial target), each with real flight time. On landing, each bolt can
    // independently chain to ONE further enemy (not already hit by ANY bolt this
    // volley — shared hit-set), also with travel time, then stops.
    // Fires chainTargets independent bolts simultaneously, one per enemy in range.
    // Each bolt chains on its OWN — different bolts CAN and will hit the same
    // enemy (that's intentional: 3 enemies all mutually in range means all 3
    // bolts eventually chain through all 3, stacking damage on each).
    _fireTeslaCoil(tower, def, inRange) {
        const targets = inRange.slice(0, def.chainTargets);
        for (const enemy of targets) {
            const visited = new Set(); // per-bolt — only blocks THIS bolt's own chain from looping
            this._spawnTeslaBolt(tower, def, tower.px, tower.py, enemy, visited, def.baseDamage);
        }
        this._flashEngineerTower(tower, def.color);
    }

    // One traveling bolt segment for a single chain. `visited` is this bolt's
    // own chain history (not shared with other bolts). `damage` is this hop's
    // damage — decays by chainFalloff each hop; the chain naturally ends when
    // it would drop to 0 or below, or when no unvisited enemy remains in range.
    _spawnTeslaBolt(tower, def, fromX, fromY, targetEnemy, visited, damage) {
        if (!targetEnemy?.sprite?.active || visited.has(targetEnemy) || damage <= 0) return;
        visited.add(targetEnemy); // reserve so this bolt can't loop back to it later

        const gfx = this.add.graphics().setDepth(3.3);
        const dist = Math.hypot(targetEnemy.sprite.x - fromX, targetEnemy.sprite.y - fromY) || 1;
        const flightDur = (dist / def.boltSpeed) * 1000;
        const startTime = this.time.now;
        const startX = fromX, startY = fromY;

        if (!this.teslaBolts) this.teslaBolts = [];
        const bolt = {
            gfx, startX, startY, targetEnemy, visited, damage, def, tower,
            startTime, flightDur, _done: false,
            initialDamage: damage, // used for per-hop falloff calculation
        };
        this.teslaBolts.push(bolt);
        return bolt;
    }

    // Brief tower body flash on firing
    _flashEngineerTower(tower, color) {
        if (!tower.body?.active) return;
        tower.body.setAlpha(0.5);
        this.tweens.add({ targets: tower.body, alpha: 1, duration: 120 });
    }

    // Magnetizer — pulls any scrap pickup within pullRadius toward the tower's
    // own position, so the player doesn't have to chase down every drop. Actual
    // collection still happens via the normal player-proximity pickup in
    // updateOrbScraps once the player walks up to where scraps have clustered.
    _magnetizerPull(tower, def) {
        if (!this.orbObjects?.length) return;
        const pullDist = def.pullRadius * this.TILE_SIZE;

        for (const orb of this.orbObjects) {
            if (orb.collected || !orb.g?.active || orb.attracting) continue; // player-attraction takes priority
            const dx = tower.px - orb.g.x, dy = tower.py - orb.g.y;
            const dist = Math.sqrt(dx * dx + dy * dy);
            if (dist > pullDist || dist < 4) {
                orb.magnetized = false; // out of range — let it resume its idle bob
                continue;
            }

            orb.magnetized = true; // tells updateOrbScraps not to fight this with its bob
            this.tweens.killTweensOf(orb.g); // stop any landing/idle-bob tween still driving x/y
            const spd = 2.5 + (pullDist - dist) * 0.05;
            orb.g.x += (dx / dist) * spd;
            orb.g.y += (dy / dist) * spd;
        }
    }

    // Per-frame update for Tesla Coil's traveling chain bolts.
    updateTeslaBolts(delta) {
        if (!this.teslaBolts?.length) return;
        for (let i = this.teslaBolts.length - 1; i >= 0; i--) {
            const b = this.teslaBolts[i];
            if (b._done || !b.targetEnemy?.sprite?.active) {
                if (b.gfx?.active) b.gfx.destroy();
                this.teslaBolts.splice(i, 1);
                continue;
            }

            const t = Math.min(1, (this.time.now - b.startTime) / Math.max(1, b.flightDur));
            const tx = b.targetEnemy.sprite.x, ty = b.targetEnemy.sprite.y;
            const curX = b.startX + (tx - b.startX) * t;
            const curY = b.startY + (ty - b.startY) * t;

            // Jagged bolt redraw each frame, from origin to current travel point
            b.gfx.clear();
            b.gfx.lineStyle(2.5, b.def.color, 0.9);
            const segs = 6;
            b.gfx.beginPath();
            for (let s = 0; s <= segs; s++) {
                const st = s / segs;
                const sx = b.startX + (curX - b.startX) * st;
                const sy = b.startY + (curY - b.startY) * st;
                const off = (s > 0 && s < segs) ? (Math.random() - 0.5) * 8 : 0;
                if (s === 0) b.gfx.moveTo(sx, sy); else b.gfx.lineTo(sx + off, sy + off);
            }
            b.gfx.strokePath();

            if (t >= 1) {
                b._done = true;
                b.gfx.destroy();
                // CONDUCTION. A tower bolt terminating on a wet enemy energises its pool, so
                // parking turrets to cover a flooded lane is a real placement decision
                // rather than just a firing arc.
                if (typeof this._energizePool === 'function'
                    && this.isWaterAt?.(b.targetEnemy.x, b.targetEnemy.y)) {
                    this._energizePool(b.targetEnemy.x, b.targetEnemy.y, b.damage);
                }
                const _rd2351 = this.resolveElementalHit(b.targetEnemy, b.damage, 'lightning');
                if (_rd2351 === null) continue;
                b.targetEnemy.health -= _rd2351;
                this.showDamageNumber(tx, ty - 10, _rd2351, '#44aaff');
                this.updateEnemyHealthBar(b.targetEnemy);
                this.gainUltCharge(0.1); // tiny — towers are a secondary charge source, wrench is primary
                if (b.targetEnemy.health <= 0) this.killEnemy(b.targetEnemy);

                // Chain — nearest enemy NOT yet visited by this specific bolt,
                // within chainRadius (if set for Arc Mastery) or full tower range
                // Chain falloff: flat reduction of 20% of the bolt's initial damage per hop
                const falloffAmt = b.initialDamage ? b.initialDamage * 0.20 : (b.def.chainFalloff ?? 2);
                const nextDamage = b.damage - falloffAmt;
                if (nextDamage >= 1) {
                    let chainTarget = null, chainD = Infinity;
                    const chainRoom = this._roomGated()
                        ? this.getCurrentPlayerRoom() : -1;
                    const maxChainDist = b.def.chainRadius ?? b.def.range;
                    for (const e of this.enemies) {
                        if (this._phasedOut?.(e)) continue;
                        if (!e.sprite?.active || b.visited.has(e)) continue;
                        if (chainRoom !== -1 && (e.tutorialRoomIndex ?? -1) !== chainRoom) continue;
                        const d = Math.abs(e.x - b.targetEnemy.x) + Math.abs(e.y - b.targetEnemy.y);
                        if (d <= maxChainDist && d < chainD) { chainD = d; chainTarget = e; }
                    }
                    if (chainTarget) {
                        const chainBolt = this._spawnTeslaBolt(b.tower, b.def, tx, ty, chainTarget, b.visited, nextDamage);
                        if (chainBolt) chainBolt.initialDamage = b.initialDamage ?? b.damage;
                    }
                }
                this.teslaBolts.splice(i, 1);
            }
        }
    }

    // Machine Gun — fires a real traveling bullet instead of an instant hitscan.
    _fireMachineGunBullet(tower, def, enemy) {
        if (!this.engineerBullets) this.engineerBullets = [];
        const dx = enemy.sprite.x - tower.px, dy = enemy.sprite.y - tower.py;
        const dist = Math.sqrt(dx * dx + dy * dy) || 1;
        const baseAngle = Math.atan2(dy, dx);

        const burstCount = def.burstCount || 1;
        const SPREAD = 0.10; // ~5.7° half-angle — tight spray, not a shotgun

        for (let i = 0; i < burstCount; i++) {
            const offset = burstCount === 1 ? 0 : (i / (burstCount - 1) - 0.5) * SPREAD * 2;
            const angle = baseAngle + offset;
            const vx = Math.cos(angle) * def.bulletSpeed, vy = Math.sin(angle) * def.bulletSpeed;

            const gfx = this.add.graphics().setDepth(3.2);
            gfx.x = tower.px; gfx.y = tower.py;
            gfx.fillStyle(def.color, 0.95); gfx.fillCircle(0, 0, 2.5);
            gfx.fillStyle(0xffffff, 0.8); gfx.fillCircle(0, 0, 1);
            this.engineerBullets.push({
                gfx, vx, vy,
                damage: def.damage, towerType: 'machine_gun', pierce: 0, hitSet: new Set(),
                _createdAt: this.time.now, color: def.color,
            });
        }
    }

    // Per-frame update for Machine Gun (and Sniper Tower, which pushes into the
    // same array) traveling bullets — straight-line, with optional piercing.
    updateEngineerBullets(delta) {
        if (!this.engineerBullets?.length) return;
        const ds = delta / 1000;
        const TS = this.TILE_SIZE;

        for (let i = this.engineerBullets.length - 1; i >= 0; i--) {
            const b = this.engineerBullets[i];
            if (b._done || !b.gfx?.active) {
                if (b.gfx?.active) b.gfx.destroy();
                this.engineerBullets.splice(i, 1);
                continue;
            }

            b.gfx.x += b.vx * ds;
            b.gfx.y += b.vy * ds;

            const tx = Math.floor(b.gfx.x / TS), ty = Math.floor(b.gfx.y / TS);
            const oob = tx < 0 || tx >= this.WORLD_WIDTH || ty < 0 || ty >= this.WORLD_HEIGHT;
            if (oob) { b._done = true; continue; }
            const tile = this.world[tx]?.[ty];
            // Sniper bullets pass through internal WALL tiles — only stopped by NOTHING
            // (the void between rooms) which acts as the true room boundary.
            // Machine Gun bullets stop at any non-floor tile as normal.
            if (b.towerType === 'sniper_tower') {
                if (tile === this.NOTHING) { b._done = true; continue; }
            } else {
                if (tile === this.WALL || tile === this.NOTHING) { b._done = true; continue; }
            }
            if (this.time.now - b._createdAt > 3000) { b._done = true; continue; }

            for (const enemy of [...this.enemies]) {
                if (this._phasedOut?.(enemy)) continue;
                if (!enemy.sprite?.active || b.hitSet.has(enemy)) continue;
                const edx = b.gfx.x - enemy.sprite.x, edy = b.gfx.y - enemy.sprite.y;
                if (Math.sqrt(edx * edx + edy * edy) < TS * 0.55) {
                    // Store active bullet so damageEnemy can access _sourceTower for upgrades
                    this._currentSniperBullet = b;
                    this.damageEnemy(enemy, b.damage);
                    this._currentSniperBullet = null;
                    this.showDamageNumber(enemy.sprite.x, enemy.sprite.y - 10, b.damage, b.towerType === 'sniper_tower' ? '#ff6644' : '#ffcc44');
                    this.updateEnemyHealthBar(enemy);
                    this.gainUltCharge(b.towerType === 'sniper_tower' ? 0.5 : 0.05); // tiny — towers are secondary
                    if (enemy.health <= 0) this.killEnemy(enemy);
                    b.hitSet.add(enemy);
                    if (b.pierce > 0) {
                        b.pierce--;
                    } else {
                        b._done = true;
                    }
                    break;
                }
            }
        }
    }

    // ─── SNIPER TOWER — lock-on telegraph then fires a piercing bullet ───────
    // Mirrors the void sniper enemy's red "!" + locked-beam telegraph language.
    _updateSniperTower(tower, def, time) {
        if (!tower._sniperState) tower._sniperState = 'idle';

        if (tower._sniperState === 'idle') {
            if (time - (tower.lastFireTime || 0) < def.fireInterval) return;
            // Find the FURTHEST enemy in range — room-gated so it can't target
            // through walls into adjacent rooms
            const extRange = def.range * 1.6;
            const towerRoom = this._roomGated()
                ? this.getCurrentPlayerRoom() : -1;
            let furthest = null, furthestD = -1;
            for (const e of this.enemies) {
                if (this._phasedOut?.(e)) continue;
                if (!e.sprite?.active) continue;
                if (towerRoom !== -1 && (e.tutorialRoomIndex ?? -1) !== towerRoom) continue;
                const d = Math.abs(e.x - tower.tileX) + Math.abs(e.y - tower.tileY);
                const inRange = d <= def.range || (e.isSuperConducted && d <= extRange);
                if (inRange && d > furthestD) { furthestD = d; furthest = e; }
            }
            if (!furthest) return;

            tower._sniperState = 'locking';
            tower._sniperTarget = furthest;
            tower._sniperLockEnd = time + def.prefireDur;
            this._spawnSniperTowerWarning(tower);

        } else if (tower._sniperState === 'locking') {
            if (!tower._sniperTarget?.sprite?.active) {
                this._clearSniperTowerWarning(tower);
                tower._sniperState = 'idle';
                return;
            }
            this._drawSniperTowerBeam(tower);
            if (time >= tower._sniperLockEnd) {
                this._clearSniperTowerWarning(tower);
                this._fireSniperTowerBullet(tower, def, tower._sniperTarget);
                tower.lastFireTime = time;
                tower._sniperState = 'idle';
                tower._sniperTarget = null;
            }
        }
    }

    _spawnSniperTowerWarning(tower) {
        tower._sniperWarning = this.add.text(tower.px, tower.py - 30, '!', {
            fontSize: '16px', fontFamily: 'monospace', color: '#ff4400',
            stroke: '#000', strokeThickness: 3, fontStyle: 'bold'
        }).setOrigin(0.5).setDepth(5);
        this.tweens.add({ targets: tower._sniperWarning, scaleX: 1.3, scaleY: 1.3, duration: 250, yoyo: true, repeat: -1 });
        tower._sniperBeam = this.add.graphics().setDepth(3.1);
    }

    _drawSniperTowerBeam(tower) {
        if (!tower._sniperBeam?.active || !tower._sniperTarget?.sprite?.active) return;
        tower._sniperBeam.clear();
        tower._sniperBeam.lineStyle(2, 0xff0000, 0.85);
        tower._sniperBeam.beginPath();
        tower._sniperBeam.moveTo(tower.px, tower.py);
        tower._sniperBeam.lineTo(tower._sniperTarget.sprite.x, tower._sniperTarget.sprite.y);
        tower._sniperBeam.strokePath();
    }

    _clearSniperTowerWarning(tower) {
        if (tower._sniperWarning) { this.tweens.killTweensOf(tower._sniperWarning); tower._sniperWarning.destroy(); tower._sniperWarning = null; }
        if (tower._sniperBeam) { tower._sniperBeam.destroy(); tower._sniperBeam = null; }
    }

    _fireSniperTowerBullet(tower, def, enemy) {
        if (!enemy?.sprite?.active) return;
        if (!this.engineerBullets) this.engineerBullets = [];
        const dx = enemy.sprite.x - tower.px, dy = enemy.sprite.y - tower.py;
        const dist = Math.sqrt(dx * dx + dy * dy) || 1;
        const gfx = this.add.graphics().setDepth(3.4);
        gfx.x = tower.px; gfx.y = tower.py;
        gfx.fillStyle(def.color, 1); gfx.fillCircle(0, 0, 3.5);
        gfx.lineStyle(1.2, 0xffffff, 0.85); gfx.strokeCircle(0, 0, 3.5);
        this.engineerBullets.push({
            gfx, vx: (dx / dist) * def.bulletSpeed, vy: (dy / dist) * def.bulletSpeed,
            damage: def.damage, towerType: 'sniper_tower', pierce: def.pierce, hitSet: new Set(),
            _createdAt: this.time.now, color: def.color,
            _sourceTower: tower, // TD: lets damageEnemy find the sniper that fired
        });
        this._flashEngineerTower(tower, def.color);
        this.cameras.main.shake(15, 0.0012);
    }


    // ─── ENGINEERING DEGREE BUILD MODE UI ──────────────────────────────────

    showEngineerBuildUI() {
        this.clearEngineerBuildRing();
        const g = this.add.graphics().setDepth(4);
        this._engineerBuildRing = { g };
        this._redrawEngineerBuildRing();
        this.updateEngineerBuildUI();
    }

    // Separate from the label so scroll-cycling can refresh just the text
    updateEngineerBuildUI() {
        const def = this._engineerTowerDefs()[this.engineerSelectedTowerType];
        if (this._engineerModeLabel) {
            this.tweens.killTweensOf(this._engineerModeLabel);
            this._engineerModeLabel.destroy();
        }
        const typeCount = [...(this.engineerTowers || []), ...(this.engineerTowersCrafting || [])].filter(t => t.towerType === this.engineerSelectedTowerType).length;
        const currentCost = def.cost * (Math.floor(typeCount / 3) + 1);
        const lbl = this.add.text(this.scale.width / 2, 55,
            `Q  BUILD MODE  [${def.name.toUpperCase()} — ${currentCost} SCRAPS]  [TAB TO CHANGE]`, {
            fontSize: '12px', fontFamily: 'monospace', color: '#ffaa00',
            stroke: '#000000', strokeThickness: 3
        }).setOrigin(0.5).setScrollFactor(0).setDepth(30);
        this.tweens.add({ targets: lbl, alpha: 0.6, duration: 400, yoyo: true, repeat: -1 });
        this._engineerModeLabel = lbl;
    }

    clearEngineerBuildRing() {
        if (this._engineerBuildRing) {
            if (this._engineerBuildRing.g.active) this._engineerBuildRing.g.destroy();
            this._engineerBuildRing = null;
        }
    }

    clearEngineerBuildMode() {
        this.engineerBuildMode = false;
        this.clearEngineerTowerPreview();
        this.clearEngineerBuildRing();
        if (this._engineerModeLabel) {
            this.tweens.killTweensOf(this._engineerModeLabel);
            this._engineerModeLabel.destroy();
            this._engineerModeLabel = null;
        }
    }

    _redrawEngineerBuildRing() {
        if (!this._engineerBuildRing) return;
        const g = this._engineerBuildRing.g;
        if (!g.active) return;
        const def = this._engineerTowerDefs()[this.engineerSelectedTowerType];
        const placeDist = def?.placeDist ?? 3;
        const radiusPx = placeDist * this.TILE_SIZE + this.TILE_SIZE / 2;
        const cx = this.player.x, cy = this.player.y;
        g.clear();
        for (let i = 0; i < 24; i += 2) {
            const a1 = (Math.PI * 2 / 24) * i;
            const a2 = (Math.PI * 2 / 24) * (i + 1);
            g.lineStyle(2, 0xffaa00, 0.5);
            g.beginPath(); g.arc(cx, cy, radiusPx, a1, a2, false); g.strokePath();
        }
    }

    updateEngineerTowerPreview(tileX, tileY) {
        const def = this._engineerTowerDefs()[this.engineerSelectedTowerType];
        const onFloor = tileX >= 0 && tileX < this.WORLD_WIDTH && tileY >= 0 && tileY < this.WORLD_HEIGHT && this.world[tileX][tileY] === this.FLOOR;
        const inRange = Math.abs(tileX - this.playerX) + Math.abs(tileY - this.playerY) <= (def?.placeDist ?? 3);
        const valid = onFloor && inRange;

        const px = tileX * this.TILE_SIZE;
        const py = tileY * this.TILE_SIZE;
        const ts = this.TILE_SIZE;

        if (!this.engineerTowerPreview || this.engineerTowerPreview._towerType !== this.engineerSelectedTowerType) {
            this.clearEngineerTowerPreview();
            const g = this.add.graphics().setDepth(4);
            const radiusRing = this.add.circle(
                px + ts / 2, py + ts / 2,
                def.range * ts, 0xffaa00, 0
            ).setDepth(3.5);
            radiusRing.setStrokeStyle(1, 0xffaa00, 0.35);
            this.engineerTowerPreview = { g, radiusRing, _towerType: this.engineerSelectedTowerType };
        }

        const p = this.engineerTowerPreview;
        p.g.clear();

        const col = valid ? def.color : 0x884400;
        const strokeCol = valid ? def.color : 0xff6600;
        const alpha = valid ? 0.25 : 0.15;

        p.g.fillStyle(col, alpha);
        p.g.fillRect(px, py, ts, ts);
        p.g.lineStyle(1, strokeCol, 0.7);
        p.g.strokeRect(px, py, ts, ts);
        p.g.lineStyle(1, strokeCol, 0.2);
        p.g.beginPath(); p.g.moveTo(px, py); p.g.lineTo(px + ts, py + ts); p.g.strokePath();
        p.g.beginPath(); p.g.moveTo(px + ts, py); p.g.lineTo(px, py + ts); p.g.strokePath();
        p.g.fillStyle(strokeCol, valid ? 0.7 : 0.3);
        p.g.fillCircle(px + ts / 2, py + ts / 2, 3);

        p.radiusRing.x = px + ts / 2;
        p.radiusRing.y = py + ts / 2;
        p.radiusRing.setStrokeStyle(1, strokeCol, valid ? 0.35 : 0.15);
    }

    clearEngineerTowerPreview() {
        if (this.engineerTowerPreview) {
            if (this.engineerTowerPreview.g.active) this.engineerTowerPreview.g.destroy();
            if (this.engineerTowerPreview.radiusRing.active) this.engineerTowerPreview.radiusRing.destroy();
            this.engineerTowerPreview = null;
        }
    }

    // ─── ARC PROJECTILE (right click) ──────────────────────────────────

    shootChainLightning(targetX, targetY) {
        const worldX = targetX + this.cameras.main.scrollX;
        const worldY = targetY + this.cameras.main.scrollY;

        const targetTileX = Math.floor(worldX / this.TILE_SIZE);
        const targetTileY = Math.floor(worldY / this.TILE_SIZE);

        let targetEnemy = null;
        let minDist = Infinity;

        for (let enemy of this.enemies) {
            if (this._phasedOut?.(enemy)) continue;
            const dist = Math.abs(enemy.x - targetTileX) + Math.abs(enemy.y - targetTileY);
            if (dist < minDist) {
                minDist = dist;
                targetEnemy = enemy;
            }
        }

        if (minDist <= 2) {
            this.drawLightningBolt({ sprite: this.player }, targetEnemy);
            const falloff = this.stormCloudActive ? this.lightningUltChainFalloff : this.lightningChainFalloff;
            const hitEnemies = [];
            this.performChainLightning(targetEnemy, this.baseLightningDamage * this.damageScaling, hitEnemies, falloff);
            // Flat charge per click regardless of chain length
            this.gainUltCharge(this.ultChargePerChain, 'lightning');
        }
    }

    performChainLightning(sourceEnemy, damage, hitEnemies, falloff) {
        hitEnemies.push(sourceEnemy);
        this.damageEnemy(sourceEnemy, damage, 'lightning');
        this.damageBossAtTile(sourceEnemy.x, sourceEnemy.y, damage, undefined, 'lightning');
        this._zapBosses(sourceEnemy, damage * falloff, this.lightningChainRange, hitEnemies);   // Queens and bosses in reach are on the chain too
        if (Math.random() < this.orbDropChance && sourceEnemy.sprite && sourceEnemy.sprite.active) {
            this.spawnOrbScrap(sourceEnemy.sprite.x, sourceEnemy.sprite.y);
        }

        if (typeof sourceEnemy.sprite?.setTint === 'function') sourceEnemy.sprite.setTint(0xffff00);
        this.time.delayedCall(100, () => {
            if (sourceEnemy.sprite && sourceEnemy.sprite.active) {
                sourceEnemy.sprite.clearTint();
            }
        });

        let nearestEnemy = null;
        let nearestDist = Infinity;

        for (let enemy of this.enemies) {
            if (this._phasedOut?.(enemy)) continue;
            if (hitEnemies.includes(enemy)) continue;

            const dist = Math.abs(enemy.x - sourceEnemy.x) + Math.abs(enemy.y - sourceEnemy.y);

            if (dist <= this.lightningChainRange && dist < nearestDist) {
                nearestEnemy = enemy;
                nearestDist = dist;
            }
        }

        if (nearestEnemy) {
            this.drawLightningBolt(sourceEnemy, nearestEnemy);

            const nextDamage = damage * falloff;

            this.performChainLightning(nearestEnemy, nextDamage, hitEnemies, falloff);
        } else {
        }
    }

    drawLightningBolt(fromEnemy, toEnemy) {
        Sfx.play(this, 'zap');   // every fork crackles (Sound.js spaces them out)
        const fromX = fromEnemy.sprite.x;
        const fromY = fromEnemy.sprite.y + 8;
        const toX = toEnemy.sprite.x;
        const toY = toEnemy.sprite.y + 8;

        const graphics = this.add.graphics();

        // MAIN BOLT - bright yellow core
        graphics.lineStyle(4, 0xffff00, 1);

        const segments = 8; // More segments for more jagged look
        const points = [];

        for (let i = 0; i <= segments; i++) {
            const t = i / segments;
            const x = fromX + (toX - fromX) * t;
            const y = fromY + (toY - fromY) * t;

            if (i > 0 && i < segments) {
                const dx = toX - fromX;
                const dy = toY - fromY;
                const length = Math.sqrt(dx * dx + dy * dy);

                const perpX = -dy / length;
                const perpY = dx / length;

                // More aggressive jagged offsets
                const offset = (Math.random() - 0.5) * 20;

                points.push({
                    x: x + perpX * offset,
                    y: y + perpY * offset
                });
            } else {
                points.push({ x, y });
            }
        }

        // OUTER GLOW (white/cyan)
        graphics.lineStyle(12, 0xaaffff, 0.3);
        graphics.beginPath();
        graphics.moveTo(points[0].x, points[0].y);
        for (let i = 1; i < points.length; i++) {
            graphics.lineTo(points[i].x, points[i].y);
        }
        graphics.strokePath();

        // MIDDLE LAYER (bright white)
        graphics.lineStyle(8, 0xffffff, 0.6);
        graphics.beginPath();
        graphics.moveTo(points[0].x, points[0].y);
        for (let i = 1; i < points.length; i++) {
            graphics.lineTo(points[i].x, points[i].y);
        }
        graphics.strokePath();

        // CORE BOLT (bright yellow)
        graphics.lineStyle(4, 0xffff00, 1);
        graphics.beginPath();
        graphics.moveTo(points[0].x, points[0].y);
        for (let i = 1; i < points.length; i++) {
            graphics.lineTo(points[i].x, points[i].y);
        }
        graphics.strokePath();

        // INNER BRIGHT LINE (pure white)
        graphics.lineStyle(2, 0xffffff, 1);
        graphics.beginPath();
        graphics.moveTo(points[0].x, points[0].y);
        for (let i = 1; i < points.length; i++) {
            graphics.lineTo(points[i].x, points[i].y);
        }
        graphics.strokePath();

        // SECONDARY FORKS — travel visibly fast (60ms) instead of instant
        for (let i = 1; i < points.length - 1; i++) {
            if (Math.random() < 0.5) {
                const forkLength = 15 + Math.random() * 25;
                const angle = Math.random() * Math.PI * 2;
                const forkMidX = points[i].x + Math.cos(angle) * (forkLength * 0.6);
                const forkMidY = points[i].y + Math.sin(angle) * (forkLength * 0.6);
                const forkEndX = points[i].x + Math.cos(angle + (Math.random() - 0.5) * 0.5) * forkLength;
                const forkEndY = points[i].y + Math.sin(angle + (Math.random() - 0.5) * 0.5) * forkLength;

                // Draw fork as a separate graphics that fades slightly slower than main bolt
                // giving a visible "travel" effect — appears just after main bolt, fades after
                const forkGfx = this.add.graphics().setAlpha(0);
                forkGfx.lineStyle(6, 0xaaffff, 0.3);
                forkGfx.beginPath(); forkGfx.moveTo(points[i].x, points[i].y); forkGfx.lineTo(forkMidX, forkMidY); forkGfx.lineTo(forkEndX, forkEndY); forkGfx.strokePath();
                forkGfx.lineStyle(2, 0xffff00, 0.9);
                forkGfx.beginPath(); forkGfx.moveTo(points[i].x, points[i].y); forkGfx.lineTo(forkMidX, forkMidY); forkGfx.lineTo(forkEndX, forkEndY); forkGfx.strokePath();
                forkGfx.lineStyle(1, 0xffffff, 1);
                forkGfx.beginPath(); forkGfx.moveTo(points[i].x, points[i].y); forkGfx.lineTo(forkMidX, forkMidY); forkGfx.lineTo(forkEndX, forkEndY); forkGfx.strokePath();

                // Flash in quickly then fade — fast enough to look like travel, slow enough to see
                this.tweens.add({
                    targets: forkGfx, alpha: 0.9, duration: 25,
                    onComplete: () => {
                        this.tweens.add({ targets: forkGfx, alpha: 0, duration: 140, onComplete: () => forkGfx.destroy() });
                    }
                });
            }
        }

        // IMPACT SPARKS at destination
        const numSparks = 8;
        for (let i = 0; i < numSparks; i++) {
            const angle = (Math.PI * 2 / numSparks) * i + Math.random() * 0.3;
            const length = 8 + Math.random() * 12;
            const endX = toX + Math.cos(angle) * length;
            const endY = toY + Math.sin(angle) * length;

            graphics.lineStyle(2, 0xffff00, 0.8);
            graphics.beginPath();
            graphics.moveTo(toX, toY);
            graphics.lineTo(endX, endY);
            graphics.strokePath();
        }

        // ORIGIN GLOW
        const originGlow = this.add.circle(fromX, fromY, 8, 0xffff00, 0.6);
        originGlow.setStrokeStyle(2, 0xffffff, 0.8);

        // DESTINATION IMPACT
        const impactFlash = this.add.circle(toX, toY, 12, 0xffffff, 0.9);
        const impactRing = this.add.circle(toX, toY, 12, 0xffff00, 0);
        impactRing.setStrokeStyle(3, 0xffff00, 1);

        // Animate impact
        this.tweens.add({
            targets: [impactFlash, impactRing],
            scaleX: 2,
            scaleY: 2,
            alpha: 0,
            duration: 200,
            ease: 'Quad.easeOut',
            onComplete: () => {
                impactFlash.destroy();
                impactRing.destroy();
            }
        });

        // Fade out origin glow
        this.tweens.add({
            targets: originGlow,
            alpha: 0,
            scaleX: 1.5,
            scaleY: 1.5,
            duration: 150,
            onComplete: () => originGlow.destroy()
        });

        // Main bolt fade out (faster)
        this.tweens.add({
            targets: graphics,
            alpha: 0,
            duration: 120,
            onComplete: () => {
                graphics.destroy();
            }
        });
    }

    deployStormField(targetX, targetY) {

        const worldX = targetX + this.cameras.main.scrollX;
        const worldY = targetY + this.cameras.main.scrollY;

        const tileX = Math.floor(worldX / this.TILE_SIZE);
        const tileY = Math.floor(worldY / this.TILE_SIZE);

        const centerPixelX = tileX * this.TILE_SIZE + this.TILE_SIZE / 2;
        const centerPixelY = tileY * this.TILE_SIZE + this.TILE_SIZE / 2;

        // Destroy storm cloud visuals
        if (this.stormCloud) {
            if (this.stormCloud.flashInterval) {
                this.stormCloud.flashInterval.remove();
            }
            this.tweens.killTweensOf(this.stormCloud.body);
            this.tweens.killTweensOf(this.stormCloud.darkCore);
            this.tweens.killTweensOf(this.stormCloud.crackle);
            this.tweens.killTweensOf(this.stormCloud.outerCrackle);
            this.stormCloud.sparks.forEach(spark => this.tweens.killTweensOf(spark));

            this.stormCloud.body.destroy();
            this.stormCloud.darkCore.destroy();
            this.stormCloud.crackle.destroy();
            this.stormCloud.outerCrackle.destroy();
            this.stormCloud.chargeText.destroy();
            this.stormCloud.sparks.forEach(spark => spark.destroy());
            this.stormCloud = null;
        }

        const chargePercent = this.stormCloudCharge / 100;
        const startRadius = this.stormFieldRadius * chargePercent;
        const radiusPixels = startRadius * this.TILE_SIZE;

        const fieldCircle = this.add.circle(
            centerPixelX,
            centerPixelY,
            radiusPixels,
            0xffff00,
            0.2
        );

        const fieldBorder = this.add.circle(
            centerPixelX,
            centerPixelY,
            radiusPixels
        );
        fieldBorder.setStrokeStyle(3, 0xffff00, 0.8);

        const lifespanText = this.add.text(
            centerPixelX,
            centerPixelY,
            '3.0s',
            {
                fontSize: '16px',
                fontFamily: 'monospace',
                color: '#ffffff',
                stroke: '#ffff00',
                strokeThickness: 3,
                fontStyle: 'bold'
            }
        ).setOrigin(0.5);

        this.tweens.add({
            targets: [fieldCircle, fieldBorder],
            scaleX: 1.1,
            scaleY: 1.1,
            alpha: 0.4,
            duration: 300,
            yoyo: true,
            repeat: -1,
            ease: 'Sine.easeInOut'
        });

        this.stormField = {
            circle: fieldCircle,
            border: fieldBorder,
            lifespanText: lifespanText,
            tileX: tileX,
            tileY: tileY,
            createdAt: this.time.now,
            expiresAt: this.time.now + (this.stormFieldDuration * chargePercent),
            radiusTiles: startRadius,
            lastLifeGainTime: 0
        };

        this.stormCloudActive = false;
        this.stormFieldLastTick = this.time.now;
    }

    updateStormField(time) {
        if (!this.stormField) return;

        const timeLeft = (this.stormField.expiresAt - time) / 1000;
        if (timeLeft > 0) {
            this.stormField.lifespanText.setText(`${timeLeft.toFixed(1)}s`);
        }

        if (time >= this.stormField.expiresAt) {
            this.deactivateStormField();
            return;
        }

        // Radius based on charge percentage
        const chargePercent = this.stormCloudCharge / 100;
        const scaledRadius = this.stormField.radiusTiles * chargePercent;
        const radiusPixels = scaledRadius * this.TILE_SIZE;

        this.stormField.circle.radius = radiusPixels;
        this.stormField.border.radius = radiusPixels;

        // ATTACK ENEMIES IN FIELD
        if (time - this.stormFieldLastTick >= this.stormFieldTickInterval) {
            this.stormFieldLastTick = time;

            const enemiesInField = [];

            for (let enemy of this.enemies) {
                if (this._phasedOut?.(enemy)) continue;
                const enemyPixelX = enemy.x * this.TILE_SIZE + this.TILE_SIZE / 2;
                const enemyPixelY = enemy.y * this.TILE_SIZE + this.TILE_SIZE / 2;
                const fieldPixelX = this.stormField.tileX * this.TILE_SIZE + this.TILE_SIZE / 2;
                const fieldPixelY = this.stormField.tileY * this.TILE_SIZE + this.TILE_SIZE / 2;

                const dist = Phaser.Math.Distance.Between(
                    enemyPixelX, enemyPixelY,
                    fieldPixelX, fieldPixelY
                );

                if (dist <= radiusPixels) {
                    enemiesInField.push(enemy);
                }
            }

            if (enemiesInField.length > 0) {
                // Pick random enemy to start chain from
                const randomEnemy = enemiesInField[Math.floor(Math.random() * enemiesInField.length)];

                const fieldPixelX = this.stormField.tileX * this.TILE_SIZE + this.TILE_SIZE / 2;
                const fieldPixelY = this.stormField.tileY * this.TILE_SIZE + this.TILE_SIZE / 2;

                // Draw lightning from field center to enemy
                this.drawLightningBolt(
                    { sprite: { x: fieldPixelX, y: fieldPixelY } },
                    randomEnemy
                );

                // Chain lightning with group bonus
                const groupBonus = 1.0 + (enemiesInField.length * 0.2);
                const fieldDamage = (this.baseLightningDamage * this.damageScaling) * chargePercent * groupBonus;

                const hitEnemies = [];
                this.performChainLightning(randomEnemy, fieldDamage, hitEnemies, this.lightningUltChainFalloff);
                const hitCount = hitEnemies.length;

                // Extend lifespan if hit enemies
                if (hitCount > 0) {
                    if (time - this.stormField.lastLifeGainTime >= this.stormFieldLifeGainCooldown) {
                        this.stormField.expiresAt += this.stormFieldLifeGainAmount;
                        this.stormField.lastLifeGainTime = time;
                    }

                    // Grow radius
                    for (let i = 0; i < hitCount; i++) {
                        if (this.stormField.radiusTiles < this.stormFieldMaxRadius) {
                            this.stormField.radiusTiles += this.stormFieldRadiusGrowthPerHit;
                            this.stormField.radiusTiles = Math.min(this.stormField.radiusTiles, this.stormFieldMaxRadius);
                        }
                    }
                }
            }

            // Decay charge
            this.stormCloudCharge -= this.stormCloudChargeDecayPerAttack;

            if (this.stormCloudCharge <= 0) {
                this.deactivateStormField();
            }
        }
    }

    deactivateStormField() {

        if (this.stormField) {
            this.tweens.add({
                targets: [this.stormField.circle, this.stormField.border, this.stormField.lifespanText],
                alpha: 0,
                duration: 300,
                onComplete: () => {
                    this.tweens.killTweensOf(this.stormField.circle);
                    this.tweens.killTweensOf(this.stormField.border);
                    this.stormField.circle.destroy();
                    this.stormField.border.destroy();
                    this.stormField.lifespanText.destroy();
                    this.stormField = null;
                }
            });
        }
    }

    addCosmicCharge(x, y) {
        // Cosmic kill-drops feed the cosmic gem now (the battery was the black hole's old
        // private bar, and nothing else spent it).
        if (!this.ultGems || this.ultGems.cosmic >= this.ultChargeMax) return;
        this.gainUltCharge(this._ultCfg().COSMIC_DROP, 'cosmic', true);

        const chargePickup = this.add.container(x, y);

        const outerGlow = this.add.circle(0, 0, 20, 0x9966ff, 0.3);

        const middleRing = this.add.circle(0, 0, 15, 0xcc99ff, 0.5);

        const innerCore = this.add.circle(0, 0, 10, 0xffffff, 0.8);

        const sparkles = [];
        for (let i = 0; i < 6; i++) {
            const angle = (Math.PI * 2 / 6) * i;
            const dist = 12;
            const sparkle = this.add.circle(
                Math.cos(angle) * dist,
                Math.sin(angle) * dist,
                2,
                0xffffff,
                0.9
            );
            sparkles.push(sparkle);
        }

        const text = this.add.text(0, -25, '+1', {
            fontSize: '20px',
            fontFamily: 'monospace',
            color: '#ffffff',
            stroke: '#9966ff',
            strokeThickness: 4,
            fontStyle: 'bold'
        }).setOrigin(0.5);

        chargePickup.add([outerGlow, middleRing, innerCore, ...sparkles, text]);

        this.tweens.add({
            targets: sparkles,
            angle: 360,
            duration: 1000,
            ease: 'Linear'
        });

        this.tweens.add({
            targets: chargePickup,
            y: y - 50,
            alpha: 0,
            duration: 1500,
            ease: 'Quad.easeOut',
            onComplete: () => chargePickup.destroy()
        });

        this.tweens.add({
            targets: [outerGlow, middleRing, innerCore],
            scaleX: 1.5,
            scaleY: 1.5,
            duration: 300,
            yoyo: true,
            ease: 'Quad.easeOut'
        });
    }

    startCosmicChanneling() {
        this.cosmicChanneling = true;
        this.cosmicChannelStartTime = this.time.now;
        this.cosmicChannelLastCharge = this.time.now;

        // Slow movement during channeling
        this._preChanelMoveCooldown = this.moveCooldown;
        this.moveCooldown = 600;

        // Visual: dark void vortex around player
        const cx = this.player.x, cy = this.player.y;
        const g = this.add.graphics().setDepth(3);
        const progressRing = this.add.graphics().setDepth(3.1);
        const label = this.add.text(cx, cy - 40, 'CHANNELING', {
            fontSize: '11px', fontFamily: 'monospace', color: '#9966ff',
            stroke: '#000000', strokeThickness: 3, fontStyle: 'bold'
        }).setOrigin(0.5).setDepth(4);

        // Orbiting void particles
        const particles = [];
        for (let i = 0; i < 6; i++) {
            const angle = (Math.PI * 2 / 6) * i;
            const p = this.add.circle(
                cx + Math.cos(angle) * 28,
                cy + Math.sin(angle) * 28,
                3, 0x9966ff, 0.8
            ).setDepth(3.5);
            particles.push(p);
        }
        const orbitContainer = this.add.container(cx, cy, particles.map((p, i) => {
            const angle = (Math.PI * 2 / 6) * i;
            p.x = Math.cos(angle) * 28; p.y = Math.sin(angle) * 28;
            return p;
        })).setDepth(3.5);
        this.tweens.add({ targets: orbitContainer, angle: -360, duration: 1800, repeat: -1, ease: 'Linear' });

        this.cosmicChannelVisual = { g, progressRing, label, orbitContainer };
        this.player.setTint(0x9966ff);
    }

    stopCosmicChanneling(interrupted) {
        this.cosmicChanneling = false;
        if (this._preChanelMoveCooldown !== undefined) {
            this.moveCooldown = this._preChanelMoveCooldown;
        }
        this.player.clearTint();

        if (this.cosmicChannelVisual) {
            const { g, progressRing, label, orbitContainer } = this.cosmicChannelVisual;
            this.tweens.killTweensOf(orbitContainer);
            g.destroy(); progressRing.destroy(); label.destroy(); orbitContainer.destroy();
            this.cosmicChannelVisual = null;
        }

        if (interrupted) {
            // Show interruption text
            const ix = this._scrX(this.player.x);
            const iy = this._scrY(this.player.y);
            const txt = this.add.text(ix, iy - 30, 'INTERRUPTED!', {
                fontSize: '13px', fontFamily: 'monospace', color: '#ff4444',
                stroke: '#000000', strokeThickness: 3, fontStyle: 'bold'
            }).setOrigin(0.5).setScrollFactor(0).setDepth(20);
            this.tweens.add({ targets: txt, y: txt.y - 20, alpha: 0, duration: 700, onComplete: () => txt.destroy() });
        }
    }

    updateCosmicChanneling(time) {
        if (!this.cosmicChanneling) return;
        if (this.currentElement !== 'cosmic') { this.stopCosmicChanneling(false); return; }

        const v = this.cosmicChannelVisual;
        if (!v) return;

        // Keep visuals anchored to player
        v.g.clear();
        v.progressRing.clear();
        v.label.x = this.player.x;
        v.label.y = this.player.y - 42;
        v.orbitContainer.x = this.player.x;
        v.orbitContainer.y = this.player.y;

        // Void aura background
        v.g.fillStyle(0x110022, 0.35);
        v.g.fillCircle(this.player.x, this.player.y, 32);
        v.g.lineStyle(2, 0x6633aa, 0.6);
        v.g.strokeCircle(this.player.x, this.player.y, 32);

        // Progress arc toward next charge
        const timeSinceLastCharge = time - this.cosmicChannelLastCharge;
        const progress = Math.min(timeSinceLastCharge / (this.cosmicChannelSecondsPerCharge * 1000), 1);
        const startAngle = -Math.PI / 2;
        const endAngle = startAngle + Math.PI * 2 * progress;

        v.progressRing.lineStyle(3, 0x9966ff, 0.9);
        v.progressRing.beginPath();
        v.progressRing.arc(this.player.x, this.player.y, 35, startAngle, endAngle, false);
        v.progressRing.strokePath();

        // Earn a charge
        if (timeSinceLastCharge >= this.cosmicChannelSecondsPerCharge * 1000) {
            this.cosmicChannelLastCharge = time;
            if (this.cosmicBatteryCharges < this.cosmicMaxCharges) {
                this.addCosmicCharge(this.player.x, this.player.y);
            }
            if (this.cosmicBatteryCharges >= this.cosmicMaxCharges) {
                this.stopCosmicChanneling(false);
                const fullTxt = this.add.text(
                    this.scale.width / 2, 70, 'FULLY CHARGED',
                    { fontSize: '16px', fontFamily: 'monospace', color: '#ddaaff', stroke: '#000', strokeThickness: 3, fontStyle: 'bold' }
                ).setOrigin(0.5).setScrollFactor(0).setDepth(30);
                this.tweens.add({ targets: fullTxt, y: 50, alpha: 0, duration: 1500, onComplete: () => fullTxt.destroy() });
                return;
            }
        }

        // Update label with charges
        v.label.setText(`CHANNELING  ${this.cosmicBatteryCharges}/${this.cosmicMaxCharges}`);
    }

    updateCosmicPassiveCharge(time) {
        // Replaced by active channeling — no-op kept for safety
    }

    updateCosmicCharge(time) {
        // ── CONTINUOUS LASER (SPACE held, any time with charges) ──────
        if (this.cosmicContinuousLaserActive) {
            if (time - this.cosmicLaserLastDrain >= this.cosmicLaserDrainInterval) {
                this.cosmicLaserLastDrain = time;
                this.cosmicBatteryCharges--;
                this.updateHUD();
                if (this.cosmicBatteryCharges <= 0) {
                    this.cosmicBatteryCharges = 0;
                    this.cosmicContinuousLaserActive = false;
                    this.cosmicUltActive = false;
                    this.ultDrainActive = false;
                    this.updateHUD();
                }
            }

            // Fire beam toward mouse every tick
            if (this.cosmicContinuousLaserActive && time - this.cosmicLaserLastTick >= this.cosmicLaserTickInterval) {
                this.cosmicLaserLastTick = time;
                const playerPixelX = this.playerX * this.TILE_SIZE + this.TILE_SIZE / 2;
                const playerPixelY = this.playerY * this.TILE_SIZE + this.TILE_SIZE / 2;
                const worldX = this.pointerX + this.cameras.main.scrollX;
                const worldY = this.pointerY + this.cameras.main.scrollY;
                const dx = worldX - playerPixelX;
                const dy = worldY - playerPixelY;
                const dist = Math.sqrt(dx * dx + dy * dy);
                if (dist > 0) {
                    this.fireCosmicBeam(playerPixelX, playerPixelY, dx / dist, dy / dist,
                        this.cosmicBaseBeamDamage * this.damageScaling * 0.1, 4, 1);
                }
            }
            return;
        } else if (!this.cosmicContinuousLaserActive && !this.cosmicCharging) {
            return;
        }

        this.cosmicChargeHoldTime = time - this.cosmicChargeStartTime;

        const chargeRateMultiplier = this.cosmicBlackHole ? 6 : 3;
        const adjustedTime = this.cosmicChargeHoldTime * chargeRateMultiplier;
        const seconds = adjustedTime / 1000;
        // Clamped 0–1 progress, maxes at full charge (3 seconds)
        const pct = Math.min(seconds / 3, 1);
        const chargeMultiplier = Math.pow(2, Math.min(seconds, 3));

        if (!this.cosmicChargeIndicator) {
            this.cosmicChargeIndicator = this.add.container(this.player.x, this.player.y);

            // Layer 1: void core
            const voidCore = this.add.circle(0, 0, 6, 0x000000, 1);

            // Layer 2: inner energy fill (graphics, redrawn each frame)
            const innerGfx = this.add.graphics();

            // Layer 3: arc graphics — jagged arcs appear as charge builds
            const arcGfx = this.add.graphics();

            // Layer 4: outer burst ring (only at full charge)
            const burstRing = this.add.circle(0, 0, 38, 0x9966ff, 0);
            burstRing.setStrokeStyle(3, 0xcc88ff, 0);

            // Layer 5: orbiting void particles — start invisible
            const orbitGfx = this.add.graphics();

            // Label
            const chargeText = this.add.text(0, -44, '', {
                fontSize: '13px', fontFamily: 'monospace',
                color: '#ffffff', stroke: '#330044', strokeThickness: 4, fontStyle: 'bold'
            }).setOrigin(0.5).setAlpha(0);

            this.cosmicChargeIndicator.add([innerGfx, arcGfx, burstRing, orbitGfx, voidCore, chargeText]);
            this.cosmicChargeIndicator.setData('voidCore', voidCore);
            this.cosmicChargeIndicator.setData('innerGfx', innerGfx);
            this.cosmicChargeIndicator.setData('arcGfx', arcGfx);
            this.cosmicChargeIndicator.setData('burstRing', burstRing);
            this.cosmicChargeIndicator.setData('orbitGfx', orbitGfx);
            this.cosmicChargeIndicator.setData('chargeText', chargeText);
        }

        this.cosmicChargeIndicator.x = this.player.x;
        this.cosmicChargeIndicator.y = this.player.y;

        const voidCore    = this.cosmicChargeIndicator.getData('voidCore');
        const innerGfx    = this.cosmicChargeIndicator.getData('innerGfx');
        const arcGfx      = this.cosmicChargeIndicator.getData('arcGfx');
        const burstRing   = this.cosmicChargeIndicator.getData('burstRing');
        const orbitGfx    = this.cosmicChargeIndicator.getData('orbitGfx');
        const chargeText  = this.cosmicChargeIndicator.getData('chargeText');

        innerGfx.clear();
        arcGfx.clear();
        orbitGfx.clear();

        // ── VOID CORE — grows and brightens with charge ──────────────
        const coreRadius = 5 + pct * 9; // 5 → 14px
        voidCore.setRadius(coreRadius);
        // Colour: black → deep purple → vivid violet
        const cr = Math.floor(pct * pct * 200);
        const cg = 0;
        const cb = Math.floor(pct * 255);
        voidCore.setFillStyle(Phaser.Display.Color.GetColor(cr, cg, cb), 1);

        // ── INNER ENERGY HALO — layered glow rings ──────────────────
        const haloAlpha = pct * 0.8;
        innerGfx.fillStyle(0x9966ff, haloAlpha * 0.15);
        innerGfx.fillCircle(0, 0, coreRadius + 10);
        innerGfx.lineStyle(2, 0xcc88ff, haloAlpha * 0.6);
        innerGfx.strokeCircle(0, 0, coreRadius + 10);
        if (pct > 0.4) {
            innerGfx.lineStyle(1.5, 0xffffff, (pct - 0.4) * 0.5);
            innerGfx.strokeCircle(0, 0, coreRadius + 18);
        }

        // ── CRACKLING ARCS — appear from 25% charge ──────────────────
        if (pct > 0.25) {
            const numArcs = Math.floor(pct * 6); // 1–6 arcs
            const arcAlpha = Math.min(1, (pct - 0.25) * 1.3);
            for (let i = 0; i < numArcs; i++) {
                const baseAngle = (Math.PI * 2 / numArcs) * i + (time / 600);
                const r1 = coreRadius + 4;
                const r2 = coreRadius + 14 + pct * 10;
                const x1 = Math.cos(baseAngle) * r1;
                const y1 = Math.sin(baseAngle) * r1;
                // Jagged mid-point
                const midAngle = baseAngle + (Math.random() - 0.5) * 0.8;
                const midR = (r1 + r2) / 2 + (Math.random() - 0.5) * 6;
                const xm = Math.cos(midAngle) * midR;
                const ym = Math.sin(midAngle) * midR;
                const x2 = Math.cos(baseAngle + (Math.random() - 0.5) * 0.4) * r2;
                const y2 = Math.sin(baseAngle + (Math.random() - 0.5) * 0.4) * r2;

                arcGfx.lineStyle(3, 0x9966ff, arcAlpha * 0.4);
                arcGfx.beginPath(); arcGfx.moveTo(x1, y1); arcGfx.lineTo(xm, ym); arcGfx.lineTo(x2, y2); arcGfx.strokePath();
                arcGfx.lineStyle(1.5, 0xffffff, arcAlpha * 0.9);
                arcGfx.beginPath(); arcGfx.moveTo(x1, y1); arcGfx.lineTo(xm, ym); arcGfx.lineTo(x2, y2); arcGfx.strokePath();
            }
        }

        // ── ORBITING PARTICLES — appear from 50% ──────────────────
        if (pct > 0.5) {
            const orbitAlpha = (pct - 0.5) * 2;
            const orbitR = 28 + pct * 8;
            const numP = 6;
            for (let i = 0; i < numP; i++) {
                const angle = (Math.PI * 2 / numP) * i - (time / 400);
                const ox = Math.cos(angle) * orbitR;
                const oy = Math.sin(angle) * orbitR;
                const pr = 1.5 + pct * 2;
                orbitGfx.fillStyle(0xffffff, orbitAlpha);
                orbitGfx.fillCircle(ox, oy, pr);
                // Trailing tail
                for (let t = 1; t <= 3; t++) {
                    const ta = angle + t * 0.15;
                    orbitGfx.fillStyle(0xcc88ff, orbitAlpha * (1 - t * 0.3));
                    orbitGfx.fillCircle(Math.cos(ta) * orbitR, Math.sin(ta) * orbitR, pr * (1 - t * 0.25));
                }
            }
        }

        // ── BURST RING at full charge ──────────────────────────────
        if (pct >= 1) {
            const pulse = 0.5 + Math.sin(time / 60) * 0.5;
            burstRing.setStrokeStyle(3, 0xffffff, 0.4 + pulse * 0.5);
            burstRing.setAlpha(0.5 + pulse * 0.5);
        } else {
            burstRing.setAlpha(0);
        }

        // ── LABEL ─────────────────────────────────────────────────
        if (pct > 0.3) {
            chargeText.setAlpha(Math.min(1, (pct - 0.3) * 2));
            chargeText.setText(`${chargeMultiplier.toFixed(1)}×`);
            const hue = pct >= 1 ? '#ffffff' : (pct > 0.7 ? '#ffaaff' : '#cc99ff');
            chargeText.setColor(hue);
            if (pct >= 1) chargeText.setAlpha(0.7 + Math.sin(time / 70) * 0.3);
        } else {
            chargeText.setAlpha(0);
        }
    }

    releaseCosmicBeam() {
        const holdTime = this.time.now - this.cosmicChargeStartTime;
        const chargeRateMultiplier = this.cosmicBlackHole ? 6 : 3;
        const adjustedTime = holdTime * chargeRateMultiplier;
        const seconds = adjustedTime / 1000;
        const chargeMultiplier = Math.pow(2, Math.min(seconds, 3));

        const worldX = this.pointerX + this.cameras.main.scrollX;
        const worldY = this.pointerY + this.cameras.main.scrollY;

        const playerPixelX = this.playerX * this.TILE_SIZE + this.TILE_SIZE / 2;
        const playerPixelY = this.playerY * this.TILE_SIZE + this.TILE_SIZE / 2;

        const dx = worldX - playerPixelX;
        const dy = worldY - playerPixelY;
        const distance = Math.sqrt(dx * dx + dy * dy);

        if (distance === 0) {
            this.cosmicCharging = false;
            if (this.cosmicChargeIndicator) {
                this.cosmicChargeIndicator.destroy();
                this.cosmicChargeIndicator = null;
            }
            return;
        }

        const dirX = dx / distance;
        const dirY = dy / distance;

        // Black hole: no damage multiplier, just faster charging
        const beamWidthMultiplier = 1;

        const damage = this.cosmicBaseBeamDamage * this.damageScaling * chargeMultiplier;
        this.fireCosmicBeam(playerPixelX, playerPixelY, dirX, dirY, damage, chargeMultiplier, beamWidthMultiplier);

        this.cosmicCharging = false;
        if (this.cosmicChargeIndicator) {
            this.cosmicChargeIndicator.destroy();
            this.cosmicChargeIndicator = null;
        }
    }

    fireCosmicBeam(startX, startY, dirX, dirY, damage, visualMultiplier, beamWidthMultiplier = 1) {
        let beamEndX = startX;
        let beamEndY = startY;
        const maxRange = 100;

        for (let i = 0; i < maxRange * this.TILE_SIZE; i += this.TILE_SIZE / 4) {
            const testX = startX + dirX * i;
            const testY = startY + dirY * i;
            const tileX = Math.floor(testX / this.TILE_SIZE);
            const tileY = Math.floor(testY / this.TILE_SIZE);

            if (tileX < 0 || tileX >= this.WORLD_WIDTH || tileY < 0 || tileY >= this.WORLD_HEIGHT) {
                break;
            }

            if (this.world[tileX][tileY] === this.WALL) {
                break;
            }

            beamEndX = testX;
            beamEndY = testY;
        }

        const graphics = this.add.graphics();

        const outerWidth = (20 + visualMultiplier * 5) * beamWidthMultiplier;
        graphics.lineStyle(outerWidth, 0x9966ff, 0.2);
        graphics.beginPath();
        graphics.moveTo(startX, startY);
        graphics.lineTo(beamEndX, beamEndY);
        graphics.strokePath();

        const middleWidth = (12 + visualMultiplier * 3) * beamWidthMultiplier;
        graphics.lineStyle(middleWidth, 0xcc99ff, 0.5);
        graphics.beginPath();
        graphics.moveTo(startX, startY);
        graphics.lineTo(beamEndX, beamEndY);
        graphics.strokePath();

        const coreWidth = (6 + visualMultiplier * 2) * beamWidthMultiplier;
        graphics.lineStyle(coreWidth, 0xffffff, 0.9);
        graphics.beginPath();
        graphics.moveTo(startX, startY);
        graphics.lineTo(beamEndX, beamEndY);
        graphics.strokePath();

        graphics.lineStyle(3 * beamWidthMultiplier, 0xffffff, 1);
        graphics.beginPath();
        graphics.moveTo(startX, startY);
        graphics.lineTo(beamEndX, beamEndY);
        graphics.strokePath();

        this.tweens.add({
            targets: graphics,
            alpha: 0,
            duration: 400,
            onComplete: () => graphics.destroy()
        });

        const hitEnemies = [];
        const beamWidthPixels = this.cosmicBeamWidth * this.TILE_SIZE * beamWidthMultiplier;

        // Check if fully charged (8x)
        const isFullyCharged = visualMultiplier >= 8;

        for (let enemy of [...this.enemies]) {
            if (this._phasedOut?.(enemy)) continue;
            const enemyPixelX = enemy.x * this.TILE_SIZE + this.TILE_SIZE / 2;
            const enemyPixelY = enemy.y * this.TILE_SIZE + this.TILE_SIZE / 2;

            const distToLine = this.pointToLineDistance(
                enemyPixelX, enemyPixelY,
                startX, startY,
                beamEndX, beamEndY
            );

            if (distToLine <= beamWidthPixels) {
                hitEnemies.push(enemy);

                let finalDamage = damage;

                // CONSUME MARKS if fully charged OR continuous laser
                const isLaser = this.cosmicContinuousLaserActive;
                if ((isFullyCharged || isLaser) && enemy.cosmicMarks > 0) {
                    // Frozen enemies take 2× mark damage (ice → cosmic synergy)
                    const frozenMult = enemy.isFrozen ? 2.0 : 1.0;
                    const markBonus = enemy.cosmicMarks * this.cosmicMarkDamagePerStack * frozenMult;
                    finalDamage += markBonus;
                    if (enemy.isFrozen && enemy.sprite && enemy.sprite.active) {
                        this.showStatusText(enemy.sprite.x, enemy.sprite.y, `×2`, '#aaeeff');
                    }

                    // LIFESTEAL: Heal based on marks consumed
                    const healPerMark = 5; // Heal 5 HP per mark consumed
                    const healAmount = enemy.cosmicMarks * healPerMark;

                    if (healAmount > 0 && this.health < this.maxHealth) {
                        this.health = Math.min(this.maxHealth, this.health + healAmount);
                        this.updateHUD();

                        // Visual: healing sparkle on player
                        const healSparkle = this.add.text(
                            this.player.x,
                            this.player.y - 20,
                            `+${healAmount} HP`,
                            {
                                fontSize: '16px',
                                fontFamily: 'monospace',
                                color: '#66ff66',
                                stroke: '#003300',
                                strokeThickness: 3,
                                fontStyle: 'bold'
                            }
                        ).setOrigin(0.5);

                        this.tweens.add({
                            targets: healSparkle,
                            y: this.player.y - 40,
                            alpha: 0,
                            duration: 800,
                            ease: 'Quad.easeOut',
                            onComplete: () => healSparkle.destroy()
                        });
                    }

                    // Visual feedback for mark consumption
                    const consumeText = this.add.text(
                        enemyPixelX,
                        enemyPixelY - 30,
                        `+${markBonus}`,
                        {
                            fontSize: '18px',
                            fontFamily: 'monospace',
                            color: '#ffff00',
                            stroke: '#9966ff',
                            strokeThickness: 3,
                            fontStyle: 'bold'
                        }
                    ).setOrigin(0.5);

                    this.tweens.add({
                        targets: consumeText,
                        y: enemyPixelY - 50,
                        alpha: 0,
                        duration: 800,
                        onComplete: () => consumeText.destroy()
                    });

                    // Clear marks and gain charge per mark consumed
                    const marksConsumed = enemy.cosmicMarks;
                    enemy.cosmicMarks = 0;
                    this.updateCosmicMarkVisual(enemy);
                    this.gainUltCharge(marksConsumed * this.ultChargePerCosmicMark, 'cosmic');
                }

                const enemyHealthBefore = enemy.health;
                this.damageEnemy(enemy, finalDamage);

                // During black hole: guaranteed charge drop if enemy died
                if (this.cosmicBlackHole && enemy.health <= 0 && enemyHealthBefore > 0) {
                    this.addCosmicCharge(enemyPixelX, enemyPixelY);
                }

                const impact = this.add.container(enemyPixelX, enemyPixelY);

                const flash = this.add.circle(0, 0, 15, 0xffffff, 0.9);
                const ring = this.add.circle(0, 0, 15, 0x9966ff, 0);
                ring.setStrokeStyle(3, 0x9966ff, 0.8);

                impact.add([flash, ring]);

                this.tweens.add({
                    targets: [flash, ring],
                    scaleX: 2,
                    scaleY: 2,
                    alpha: 0,
                    duration: 300,
                    onComplete: () => impact.destroy()
                });
            }
        }
    }

    pointToLineDistance(px, py, x1, y1, x2, y2) {
        const dx = x2 - x1;
        const dy = y2 - y1;
        const lengthSquared = dx * dx + dy * dy;

        if (lengthSquared === 0) return Math.sqrt((px - x1) * (px - x1) + (py - y1) * (py - y1));

        let t = ((px - x1) * dx + (py - y1) * dy) / lengthSquared;
        t = Math.max(0, Math.min(1, t));

        const projX = x1 + t * dx;
        const projY = y1 + t * dy;

        return Math.sqrt((px - projX) * (px - projX) + (py - projY) * (py - projY));
    }

    activateCosmicBlackHole() {
        // If projectile already in flight — detonate it
        if (this.cosmicBlackHoleProjectile) {
            this.detonateCosmicBomb();
            return;
        }

        this.cosmicUltActive = true;

        const activePointer = this.input.activePointer;
        const targetX = (this.pointerX || this._aim(activePointer).x) + this.cameras.main.scrollX;
        const targetY = (this.pointerY || this._aim(activePointer).y) + this.cameras.main.scrollY;

        const playerPixelX = this.playerX * this.TILE_SIZE + this.TILE_SIZE / 2;
        const playerPixelY = this.playerY * this.TILE_SIZE + this.TILE_SIZE / 2;

        const dx = targetX - playerPixelX;
        const dy = targetY - playerPixelY;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist === 0) return;

        const speed = 170; // was 80: the hole should open while the fight is still where you aimed
        const vx = (dx / dist) * speed;
        const vy = (dy / dist) * speed;

        const { container, armTimer, trailTimer } = this._voidBombFx(playerPixelX, playerPixelY);

        container.setData('vx', vx);
        container.setData('vy', vy);
        container.setData('launchX', playerPixelX);
        container.setData('launchY', playerPixelY);
        container.setData('maxRange', 12 * this.TILE_SIZE); // 12 tiles max
        container.setData('armTimer', armTimer);
        container.setData('trailTimer', trailTimer);

        if (this.cosmicBlackHoleProjectile) {
            const old = this.cosmicBlackHoleProjectile;
            if (old.getData('armTimer')) old.getData('armTimer').remove();
            if (old.getData('trailTimer')) old.getData('trailTimer').remove();
            this.tweens.killTweensOf(old);
            old.destroy();
        }
        this.cosmicBlackHoleProjectile = container;

        // Range ring at launch point — shows max travel distance
        const rangeRing = this.add.circle(playerPixelX, playerPixelY, 12 * this.TILE_SIZE, 0x9966ff, 0).setDepth(4);
        rangeRing.setStrokeStyle(1, 0x9966ff, 0.3);
        this.tweens.add({ targets: rangeRing, alpha: 0, duration: 1200, onComplete: () => rangeRing.destroy() });

        // HUD hint
        // E only detonates while you hold cosmic; from any other element it's the cosmic gem's key
        const detKey = this.currentElement === 'cosmic' ? 'E' : (this._ultCfg?.().KEYS?.cosmic || 'E');
        const hint = this.add.text(this.scale.width / 2, 80, `${detKey}  TO DETONATE`, {
            fontSize: '14px', fontFamily: 'monospace', color: '#cc88ff',
            stroke: '#000000', strokeThickness: 3
        }).setOrigin(0.5).setScrollFactor(0).setDepth(30);
        this.tweens.add({ targets: hint, y: 60, alpha: 0, duration: 2000, onComplete: () => hint.destroy() });
    }

    // The black hole's bomb: rings round a dark core, arms turning, a void trail behind it (the ult's, and an Ult Absorber's stolen one)
    _voidBombFx(x, y) {
        // ── VOID BOMB VISUAL ─────────────────────────────────────────
        // Layered concentric circles + rotating arms + crackling outline
        const container = this.add.container(x, y).setDepth(6);

        // Outer distortion ring
        const outerRing = this.add.circle(0, 0, 22, 0x000000, 0);
        outerRing.setStrokeStyle(3, 0x440088, 0.7);

        // Mid energy ring
        const midRing = this.add.circle(0, 0, 15, 0x220044, 0.85);
        midRing.setStrokeStyle(2, 0x9966ff, 0.9);

        // Dark core
        const core = this.add.circle(0, 0, 8, 0x000000, 1);

        // Bright singularity point
        const singularity = this.add.circle(0, 0, 3, 0xffffff, 0.9);

        // Spiral arms — 3 graphics lines that rotate
        const armsGfx = this.add.graphics();
        const drawArms = (g, angle) => {
            g.clear();
            for (let i = 0; i < 3; i++) {
                const a = angle + (Math.PI * 2 / 3) * i;
                g.lineStyle(2, 0x9966ff, 0.6);
                g.beginPath();
                g.moveTo(Math.cos(a) * 4, Math.sin(a) * 4);
                // Curved arm — 4 segments each offset
                for (let s = 1; s <= 4; s++) {
                    const t = s / 4;
                    const r = 4 + t * 14;
                    const sweep = a + t * 0.9;
                    g.lineTo(Math.cos(sweep) * r, Math.sin(sweep) * r);
                }
                g.strokePath();
            }
        };
        drawArms(armsGfx, 0);
        container.add([outerRing, armsGfx, midRing, core, singularity]);

        // Rotation tween for arms
        let armAngle = 0;
        const armTimer = this.time.addEvent({
            delay: 30,
            callback: () => {
                if (!container.active) { armTimer.remove(); return; }
                armAngle -= 0.07;
                drawArms(armsGfx, armAngle);
                // Pulse outer ring
                outerRing.setStrokeStyle(3, 0x440088, 0.4 + Math.sin(armAngle * 3) * 0.3);
                singularity.setAlpha(0.6 + Math.sin(armAngle * 5) * 0.4);
            },
            loop: true
        });

        // Purple void trail
        const trailTimer = this.time.addEvent({
            delay: 35,
            callback: () => {
                if (!container.active) { trailTimer.remove(); return; }
                const t1 = this.add.circle(container.x, container.y, 10, 0x220044, 0.55).setDepth(5);
                const t2 = this.add.circle(container.x, container.y, 5, 0x9966ff, 0.35).setDepth(5);
                this.tweens.add({ targets: [t1, t2], alpha: 0, scaleX: 1.8, scaleY: 1.8, duration: 350, onComplete: () => { t1.destroy(); t2.destroy(); } });
            },
            loop: true
        });

        return { container, armTimer, trailTimer };
    }
    // ...and its burst as it goes off
    _voidBurstFx(x, y) {
        // Detonation flash burst before deploying
        const flash = this.add.circle(x, y, 8, 0xffffff, 1).setDepth(7);
        this.tweens.add({ targets: flash, radius: 40, alpha: 0, duration: 200, onComplete: () => flash.destroy() });
        for (let i = 0; i < 8; i++) {
            const angle = (Math.PI * 2 / 8) * i;
            const shard = this.add.circle(x, y, 3, 0xcc88ff, 1).setDepth(7);
            this.tweens.add({ targets: shard, x: x + Math.cos(angle) * 30, y: y + Math.sin(angle) * 30, alpha: 0, duration: 300, onComplete: () => shard.destroy() });
        }

    }

    detonateCosmicBomb() {
        const proj = this.cosmicBlackHoleProjectile;
        if (!proj) return;

        const deployX = proj.x;
        const deployY = proj.y;

        if (proj.getData('armTimer')) proj.getData('armTimer').remove();
        if (proj.getData('trailTimer')) proj.getData('trailTimer').remove();
        this.tweens.killTweensOf(proj);

        this._voidBurstFx(deployX, deployY);

        proj.destroy();
        this.cosmicBlackHoleProjectile = null;
        this.deployCosmicBlackHole(deployX, deployY);
    }

    updateCosmicBlackHoleProjectile(delta) {
        if (!this.cosmicBlackHoleProjectile) return;

        const deltaSeconds = delta / 1000;
        const proj = this.cosmicBlackHoleProjectile;

        proj.x += proj.getData('vx') * deltaSeconds;
        proj.y += proj.getData('vy') * deltaSeconds;

        const tileX = Math.floor(proj.x / this.TILE_SIZE);
        const tileY = Math.floor(proj.y / this.TILE_SIZE);

        // Auto-detonate on wall hit or max range reached
        const travelledX = proj.x - proj.getData('launchX');
        const travelledY = proj.y - proj.getData('launchY');
        const travelled = Math.sqrt(travelledX * travelledX + travelledY * travelledY);
        const maxRange = proj.getData('maxRange');

        if (tileX < 0 || tileX >= this.WORLD_WIDTH ||
            tileY < 0 || tileY >= this.WORLD_HEIGHT ||
            this.world[tileX][tileY] === this.WALL ||
            travelled >= maxRange) {
            this.detonateCosmicBomb();
            return;
        }

        // Detonate on enemy contact
        for (const enemy of this.enemies) {
            if (this._phasedOut?.(enemy)) continue;
            if (!enemy.sprite || !enemy.sprite.active) continue;
            const ex = enemy.sprite.x, ey = enemy.sprite.y;
            if (Math.abs(ex - proj.x) < this.TILE_SIZE * 1.1 && Math.abs(ey - proj.y) < this.TILE_SIZE * 1.1) {
                this.detonateCosmicBomb();
                return;
            }
        }
    }

    deployCosmicBlackHole(x, y) {

        // Create vortex visuals
        const vortex = this.add.container(x, y);

        // OUTER DISTORTION RING (largest, dark purple)
        const distortionRing = this.add.circle(0, 0, this.cosmicBlackHoleRadius * this.TILE_SIZE * 1.2, 0x220044, 0.2);
        distortionRing.setStrokeStyle(2, 0x6633aa, 0.4);

        // OUTER RING (purple with glow)
        const outerRing = this.add.circle(0, 0, this.cosmicBlackHoleRadius * this.TILE_SIZE, 0x330066, 0.4);
        outerRing.setStrokeStyle(5, 0x9966ff, 0.9);

        // MIDDLE RING (brighter purple)
        const middleRing = this.add.circle(0, 0, this.cosmicBlackHoleRadius * this.TILE_SIZE * 0.6, 0x660099, 0.6);
        middleRing.setStrokeStyle(4, 0xaa77ff, 1);

        // INNER RING (bright purple/pink)
        const innerRing = this.add.circle(0, 0, this.cosmicBlackHoleRadius * this.TILE_SIZE * 0.3, 0x9933cc, 0.7);
        innerRing.setStrokeStyle(3, 0xdd99ff, 1);

        // CORE (bright yellow-white singularity)
        const core = this.add.circle(0, 0, this.cosmicBlackHoleRadius * this.TILE_SIZE * 0.15, 0xffff00, 1);
        core.setStrokeStyle(2, 0xffffff, 1);

        // Add all rings to container
        vortex.add([distortionRing, outerRing, middleRing, innerRing, core]);

        // ROTATING SPIRAL ARMS
        const numArms = 4;
        const arms = [];
        for (let i = 0; i < numArms; i++) {
            const arm = this.add.graphics();
            const startAngle = (Math.PI * 2 / numArms) * i;

            arm.lineStyle(3, 0x9966ff, 0.6);
            arm.beginPath();

            // Create spiral arm
            const armLength = this.cosmicBlackHoleRadius * this.TILE_SIZE;
            for (let r = 5; r < armLength; r += 2) {
                const spiralAngle = startAngle + (r / armLength) * Math.PI;
                const sx = Math.cos(spiralAngle) * r;
                const sy = Math.sin(spiralAngle) * r;

                if (r === 5) {
                    arm.moveTo(sx, sy);
                } else {
                    arm.lineTo(sx, sy);
                }
            }
            arm.strokePath();

            arms.push(arm);
            vortex.add(arm);
        }

        // PARTICLE SWIRL (small dots orbiting inward)
        const particles = [];
        for (let i = 0; i < 20; i++) {
            const angle = Math.random() * Math.PI * 2;
            const distance = (Math.random() * 0.8 + 0.2) * this.cosmicBlackHoleRadius * this.TILE_SIZE;
            const particle = this.add.circle(
                Math.cos(angle) * distance,
                Math.sin(angle) * distance,
                2,
                0xffffff,
                0.8
            );
            particles.push(particle);
            vortex.add(particle);
        }

        // PULSING ANIMATION - rings expand and contract
        this.tweens.add({
            targets: [outerRing],
            scaleX: 1.15,
            scaleY: 1.15,
            alpha: 0.6,
            duration: 600,
            yoyo: true,
            repeat: -1,
            ease: 'Sine.easeInOut'
        });

        this.tweens.add({
            targets: [middleRing],
            scaleX: 1.2,
            scaleY: 1.2,
            alpha: 0.8,
            duration: 500,
            yoyo: true,
            repeat: -1,
            ease: 'Sine.easeInOut',
            delay: 100
        });

        this.tweens.add({
            targets: [innerRing],
            scaleX: 1.3,
            scaleY: 1.3,
            alpha: 0.9,
            duration: 400,
            yoyo: true,
            repeat: -1,
            ease: 'Sine.easeInOut',
            delay: 200
        });

        // CORE PULSING (bright singularity)
        this.tweens.add({
            targets: [core],
            scaleX: 1.5,
            scaleY: 1.5,
            alpha: 0.7,
            duration: 300,
            yoyo: true,
            repeat: -1,
            ease: 'Sine.easeInOut'
        });

        // DISTORTION RING (slow pulse)
        this.tweens.add({
            targets: [distortionRing],
            scaleX: 1.1,
            scaleY: 1.1,
            alpha: 0.3,
            duration: 800,
            yoyo: true,
            repeat: -1,
            ease: 'Sine.easeInOut'
        });

        // ROTATING SPIRAL ARMS
        this.tweens.add({
            targets: vortex,
            angle: -360, // Counter-clockwise rotation
            duration: 3000,
            repeat: -1,
            ease: 'Linear'
        });

        // PARTICLE SWIRL ANIMATION
        particles.forEach((particle, index) => {
            this.tweens.add({
                targets: particle,
                angle: 360,
                duration: 2000 + (index * 100),
                repeat: -1,
                ease: 'Linear'
            });

            // Particles fade as they spiral in
            this.tweens.add({
                targets: particle,
                scaleX: 0.5,
                scaleY: 0.5,
                alpha: 0.3,
                duration: 1500,
                yoyo: true,
                repeat: -1,
                ease: 'Sine.easeInOut',
                delay: index * 50
            });
        });

        this.cosmicBlackHole = {
            container: vortex,
            x: x,
            y: y,
            tileX: Math.floor(x / this.TILE_SIZE),
            tileY: Math.floor(y / this.TILE_SIZE),
            createdAt: this.time.now,
            expiresAt: this.time.now + this.cosmicBlackHoleDuration,
            lastMarkTime: this.time.now,
            affectedEnemies: [],
            spiralArms: arms, // Store for potential shrinking
            particles: particles
        };

        // Enable fast charging
        this.cosmicInfiniteBeamActive = true;
        this.cosmicInfiniteBeamEndTime = this.cosmicBlackHole.expiresAt;
    }

    updateCosmicBlackHole(time) {
        if (!this.cosmicBlackHole) return;

        const bh = this.cosmicBlackHole;
        const elapsed = time - bh.createdAt;
        const progress = elapsed / this.cosmicBlackHoleDuration;

        // Shrinking radius over time (4 tiles → 1 tile)
        const currentRadius = this.cosmicBlackHoleRadius * (1 - progress * 0.75);

        // Update visuals
        const radiusPixels = currentRadius * this.TILE_SIZE;
        const children = bh.container.list;
        children[0].setRadius(radiusPixels);
        children[1].setRadius(radiusPixels * 0.6);
        children[2].setRadius(radiusPixels * 0.2);

        // Prune dead enemies from affectedEnemies
        bh.affectedEnemies = bh.affectedEnemies.filter(e => e.sprite && e.sprite.active);

        // Find enemies in radius — spiral orbit that tightens toward center
        for (let enemy of this.enemies) {
            if (this._phasedOut?.(enemy)) continue;
            const dist = Math.abs(enemy.x - bh.tileX) + Math.abs(enemy.y - bh.tileY);

            if (dist <= currentRadius) {
                if (!bh.affectedEnemies.includes(enemy)) {
                    bh.affectedEnemies.push(enemy);
                    // Assign a unique orbit angle offset per enemy
                    if (enemy._bhOrbitAngle === undefined) {
                        const idx = bh.affectedEnemies.length;
                        enemy._bhOrbitAngle = (idx * Math.PI * 0.7);
                    }
                    if (enemy._bhOrbitRadius === undefined) {
                        // Cap entry radius to 1.5 tiles so enemy is always safely inside
                        const ex = enemy.sprite.x - bh.x;
                        const ey = enemy.sprite.y - bh.y;
                        const entryDist = Math.sqrt(ex * ex + ey * ey);
                        enemy._bhOrbitRadius = Math.min(entryDist, this.TILE_SIZE * 1.5);
                    }
                }

                // Spin angle forward each frame
                enemy._bhOrbitAngle = (enemy._bhOrbitAngle || 0) + 0.022;

                // Very gradual decay — enemies spiral in slowly over the black hole duration
                const safeMaxRadius = currentRadius * this.TILE_SIZE * 0.55;
                const minRadius = 6;
                enemy._bhOrbitRadius = Math.max(minRadius, Math.min(safeMaxRadius, (enemy._bhOrbitRadius || this.TILE_SIZE) * 0.9975));

                const targetX = bh.x + Math.cos(enemy._bhOrbitAngle) * enemy._bhOrbitRadius;
                const targetY = bh.y + Math.sin(enemy._bhOrbitAngle) * enemy._bhOrbitRadius;

                // Set directly — no lerp, no jitter, free pixel movement during black hole
                enemy.sprite.x = targetX;
                enemy.sprite.y = targetY;
                enemy.x = Math.floor(targetX / this.TILE_SIZE);
                enemy.y = Math.floor((targetY - this.SLIME_Y_OFFSET) / this.TILE_SIZE);

                this.updateEnemyHealthBar(enemy);

                // Update cosmic mark visuals
                if (enemy.cosmicMarkVisuals && enemy.cosmicMarkVisuals.length > 0) {
                    const markY = enemy.sprite.y - 25;
                    for (let i = 0; i < enemy.cosmicMarks; i++) {
                        const offsetX = (i - 1) * 12;
                        const visualIndex = i * 2;
                        if (visualIndex < enemy.cosmicMarkVisuals.length) {
                            enemy.cosmicMarkVisuals[visualIndex].x = enemy.sprite.x + offsetX;
                            enemy.cosmicMarkVisuals[visualIndex].y = markY;
                        }
                        if (visualIndex + 1 < enemy.cosmicMarkVisuals.length) {
                            enemy.cosmicMarkVisuals[visualIndex + 1].x = enemy.sprite.x + offsetX;
                            enemy.cosmicMarkVisuals[visualIndex + 1].y = markY;
                        }
                    }
                }
            }
        }

        // Apply marks every interval
        if (time - bh.lastMarkTime >= this.cosmicBlackHoleMarkInterval) {
            for (let enemy of bh.affectedEnemies) {
                if (enemy.cosmicMarks < this.cosmicMaxMarks) {
                    enemy.cosmicMarks++;
                    this.updateCosmicMarkVisual(enemy);
                    if (enemy.sprite && enemy.sprite.active) {
                        this.showStatusText(enemy.sprite.x, enemy.sprite.y, `MARKED x${enemy.cosmicMarks}`, '#cc99ff');
                    }
                }
            }
            bh.lastMarkTime = time;
        }

        // Expire
        if (time >= bh.expiresAt) {
            if (this._asUlt) this._asUlt('cosmic', () => this._cosmicCollapse(bh)); else this._cosmicCollapse(bh);   // the payoff: the marks it gave out cash in as damage (ult damage)
            for (let enemy of bh.affectedEnemies) {
                if (!enemy.sprite || !enemy.sprite.active) continue;
                this.showStatusText(enemy.sprite.x, enemy.sprite.y, 'STUNNED', '#9966ff');
                // Snap to nearest valid floor tile from current glide position
                const snap = this.snapToNearestFloor(enemy.sprite.x, enemy.sprite.y - this.SLIME_Y_OFFSET);
                if (snap) {
                    enemy.x = snap.tx; enemy.y = snap.ty;
                    enemy.sprite.x = snap.px;
                    enemy.sprite.y = snap.py + this.SLIME_Y_OFFSET;
                    // Sync healthbars immediately after snap
                    if (enemy.healthBarBg) { enemy.healthBarBg.x = enemy.sprite.x; enemy.healthBarBg.y = enemy.sprite.y + (enemy._hpBarYOff || 0); }
                    if (enemy.healthBarFill) { enemy.healthBarFill.x = enemy.sprite.x; enemy.healthBarFill.y = enemy.sprite.y + (enemy._hpBarYOff || 0); }
                    if (enemy.brittleVisual) { enemy.brittleVisual.x = enemy.sprite.x; enemy.brittleVisual.y = enemy.sprite.y + 14; }
                    if (enemy.burnVisual) { enemy.burnVisual.x = enemy.sprite.x; enemy.burnVisual.y = enemy.sprite.y - 18; }
                    if (enemy._tsunamiMultText) { enemy._tsunamiMultText.x = enemy.sprite.x; enemy._tsunamiMultText.y = enemy.sprite.y - 28; }
                    if (enemy.cosmicMarkVisuals) this.updateCosmicMarkVisual(enemy);
                }
                delete enemy._bhOrbitAngle;
                delete enemy._bhOrbitRadius;
                enemy.isStunned = true;
                enemy.stunnedUntil = Math.max(enemy.stunnedUntil || 0, time + 1000);
                // moveEnemies ends a stun at stunnedUntil; a forced clear here cut longer ones short
            }

            this.tweens.killTweensOf(bh.container);
            bh.container.destroy();
            this.cosmicBlackHole = null;
            this.cosmicContinuousLaserActive = false;
            this.cosmicUltActive = false;

            this.cosmicInfiniteBeamEndTime = time + this.cosmicBlackHoleGracePeriod;
        }
    }

    // The black hole closes with a bang: an implosion, then a blast that hits everything it
    // held for a base amount plus a bonus per mark it picked up in orbit. The marks are spent.
    _cosmicCollapse(bh) {
        const T = this.TILE_SIZE, ds = this.damageScaling || 1;
        const BASE = 10, PER_MARK = 8;
        const core = this.add.circle(bh.x, bh.y, this.cosmicBlackHoleRadius * T * 0.5, 0xb47cff, 0.35).setDepth(6);
        this.tweens.add({ targets: core, radius: 6, alpha: 0.9, duration: 140, ease: 'Quad.easeIn', onComplete: () => {
            core.destroy();
            const flash = this.add.circle(bh.x, bh.y, 10, 0xffffff, 0.95).setDepth(7);
            const ring = this.add.circle(bh.x, bh.y, 10, 0xb47cff, 0).setDepth(7);
            ring.setStrokeStyle(4, 0xd9b8ff, 1);
            this.tweens.add({ targets: flash, radius: T * 2.2, alpha: 0, duration: 260, ease: 'Quad.easeOut', onComplete: () => flash.destroy() });
            this.tweens.add({ targets: ring, radius: this.cosmicBlackHoleRadius * T, alpha: 0, duration: 420, ease: 'Cubic.easeOut', onComplete: () => ring.destroy() });
        } });
        this.cameras.main.shake(120, 0.006);
        this._vfxFlash?.(bh.x, bh.y, this.cosmicBlackHoleRadius * T * 1.4, 0xd9b8ff, 560, 1);   // Visuals.js
        for (const enemy of [...bh.affectedEnemies]) {
            if (!enemy.sprite?.active || enemy.health <= 0) continue;
            const marks = enemy.cosmicMarks || 0;
            enemy.cosmicMarks = 0;
            this.updateCosmicMarkVisual(enemy);
            this.damageEnemy(enemy, (BASE + PER_MARK * marks) * ds, 'cosmic');
        }
    }

    updateCosmicMarkVisual(enemy) {
        // Destroy old visuals
        if (enemy.cosmicMarkVisuals) {
            enemy.cosmicMarkVisuals.forEach(v => {
                this.tweens.killTweensOf(v);
                v.destroy();
            });
        }
        enemy.cosmicMarkVisuals = [];

        if (enemy.cosmicMarks === 0) return;

        const markY = enemy.sprite.y - 25;

        // Create black hole visual based on stack count
        for (let i = 0; i < enemy.cosmicMarks; i++) {
            const offsetX = (i - 1) * 12; // spread marks horizontally

            // Outer ring (purple)
            const outerRing = this.add.circle(enemy.sprite.x + offsetX, markY, 8, 0x9966ff, 0);
            outerRing.setStrokeStyle(2, 0x9966ff, 0.8);

            // Inner core (yellow/white)
            const innerCore = this.add.circle(enemy.sprite.x + offsetX, markY, 4, 0xffff00, 0.9);

            // Pulsing animation
            this.tweens.add({
                targets: [outerRing, innerCore],
                scaleX: 1.3,
                scaleY: 1.3,
                duration: 400,
                yoyo: true,
                repeat: -1,
                ease: 'Sine.easeInOut'
            });

            // Rotation
            this.tweens.add({
                targets: outerRing,
                angle: 360,
                duration: 2000,
                repeat: -1,
                ease: 'Linear'
            });

            enemy.cosmicMarkVisuals.push(outerRing, innerCore);
        }
    }

    // One hop of cosmic's dash: to the open tile nearest the cursor within reach (cosmicDashDistance + a half, so
    // diagonals count), along a line clear of walls and seals (it passes through enemies, never lands on one).
    // It leaves cosmic fluid on the tiles it crossed, afterimages along the way, and a moment untouchable.
    cosmicDashAim() {
        const T = this.TILE_SIZE, R = (this.cosmicDashDistance || 3) + 0.5, cam = this.cameras.main, ap = this._aim(this.input.activePointer);
        const cx = (ap.x + cam.scrollX) / T - 0.5, cy = (ap.y + cam.scrollY) / T - 0.5, px = this.playerX, py = this.playerY, r = Math.ceil(R);
        const line = (dx, dy) => { const n = Math.max(1, Math.ceil(Math.hypot(dx, dy) * 3)), out = []; for (let k = 1; k <= n; k++) { const x = Math.round(px + dx * k / n), y = Math.round(py + dy * k / n); if (!out.length || out[out.length - 1].x !== x || out[out.length - 1].y !== y) out.push({ x, y }); } return out; };
        let best = null, bd = Infinity;
        for (let dx = -r; dx <= r; dx++) for (let dy = -r; dy <= r; dy++) {
            if ((!dx && !dy) || Math.hypot(dx, dy) > R) continue;
            const x = px + dx, y = py + dy;
            if (!this._dashCanEnter(x, y) || this.getEnemyAt?.(x, y)) continue;
            const path = line(dx, dy); if (!path.every(t => this._dashCanEnter(t.x, t.y))) continue;
            const d = Math.hypot(x - cx, y - cy) - Math.hypot(dx, dy) * 0.01;   // nearest the cursor; a tie goes the farther
            if (d < bd) { bd = d; best = { x, y, path }; }
        }
        if (!best) return false;
        const now = this.time.now, x0 = this.player.x, y0 = this.player.y;
        if (this._cs) {
            const F = (this._cs.fluid ||= []);
            [{ x: px, y: py }, ...best.path].forEach((t, k) => F.push({ x: t.x, y: t.y, t0: now + k * 30, t1: now + k * 30 + 1800, img: null, hexMs: 3000, dash: true }));
        }
        this.tweens.killTweensOf(this.player); this._glide = null;
        this.playerX = best.x; this.playerY = best.y;
        const x1 = best.x * T + T / 2, y1 = best.y * T + T / 2 + this.SLIME_Y_OFFSET;
        for (let k = 0; k < 4; k++) { const f = k / 4, g = this.add.sprite(x0 + (x1 - x0) * f, y0 + (y1 - y0) * f, this.player.texture.key, this.player.frame.name).setScale(this.player.scaleX, this.player.scaleY).setFlipX(this.player.flipX).setDepth(this.player.depth - 0.01).setTintFill(k % 2 ? 0xb47cff : 0xff7ae8).setAlpha(0.55 - k * 0.1).setBlendMode(Phaser.BlendModes.ADD); this.tweens.add({ targets: g, alpha: 0, scaleX: g.scaleX * 0.6, duration: 300, delay: k * 20, onComplete: () => g.destroy() }); }
        this.player.setPosition(x1, y1);
        this._vfxHop?.(this.player);
        this.player.setTint(0xcc44ff); this.time.delayedCall(120, () => { if (this.player?.active) this.player.clearTint(); });
        this._dashInvulnUntil = now + (this.DASH_IFRAMES || 200);
        this._csBurst?.(x1, y1 - this.SLIME_Y_OFFSET, 12, 0xd8a8ff, 220);
        this.cameras.main.shake(25, 0.002);
        this.updateHUD();
        return true;
    }
    cosmicDash(dirX, dirY, oldTileX, oldTileY) {
        const currentTime = this.time.now;

        const dashCooldown = this.cosmicDashCooldown;
        if (currentTime - (this.lastCosmicDashTime || 0) < dashCooldown) return;

        // Calculate dash path — stop at first wall
        let finalX = this.playerX, finalY = this.playerY;
        const dashPath = [];
        for (let i = 1; i <= this.cosmicDashDistance; i++) {
            const checkX = this.playerX + (dirX * i);
            const checkY = this.playerY + (dirY * i);
            if (checkX < 0 || checkX >= this.WORLD_WIDTH || checkY < 0 || checkY >= this.WORLD_HEIGHT) break;
            if (this.world[checkX][checkY] !== this.FLOOR) break;
            if (this.isInLockedRoom && this.isInLockedRoom(checkX, checkY)) break;
            dashPath.push({ x: checkX, y: checkY });
            finalX = checkX; finalY = checkY;
        }
        if (dashPath.length === 0) return;

        // a cosmic dash leaves cosmic fluid on the tiles it crossed (Cosmic.js _csUpdateFluid Hexes
        // what stands in it). It dries before the fluid's next Hex tick: one stack a dash, as fire's lava gives one burn.
        if (this._cs) {
            const F = (this._cs.fluid ||= []), FLUID_MS = 1800, CASCADE = 30;
            [{ x: oldTileX, y: oldTileY }, ...dashPath].forEach((t, k) =>
                F.push({ x: t.x, y: t.y, t0: currentTime + k * CASCADE, t1: currentTime + k * CASCADE + FLUID_MS, img: null, hexMs: 3000, dash: true }));
        } else for (const enemy of [...this.enemies]) {
            if (this._phasedOut?.(enemy)) continue;
            if (enemy.sprite?.active && dashPath.some(t => t.x === enemy.x && t.y === enemy.y)) this._csHex?.(enemy, 3000);
        }

        // Teleport player. A step's tween still running would pull the slime back toward its old tile for a few
        // frames (the dash staggered), so it goes first, and nothing else glides it.
        this.tweens.killTweensOf(this.player); this._glide = null;
        this._vfxHop?.(this.player);
        this.playerX = finalX;
        this.playerY = finalY;
        this.player.x = finalX * this.TILE_SIZE + this.TILE_SIZE / 2;
        this.player.y = finalY * this.TILE_SIZE + this.TILE_SIZE / 2 + this.SLIME_Y_OFFSET;
        this.player.setTint(0xcc44ff);
        this.time.delayedCall(120, () => { if (this.player?.active) this.player.clearTint(); });

        this.lastCosmicDashTime = currentTime;
        this.cameras.main.shake(25, 0.002);
        this.updateHUD();
    }

    // ── DASH ──────────────────────────────────────────────────────────────────
    // Space, any element: DASH_TILES tiles in the direction you're moving (or last moved),
    // untouchable for DASH_IFRAMES ms, then DASH_COOLDOWN ms before the next. It passes
    // through enemies but never lands on one, and stops at anything a step couldn't enter.
    // Holding cosmic, Space is cosmic's own dash instead (GameScene routes it), which damages
    // and dazes what it passes and feeds Void Fists' momentum.
    // Trailblazer (a relic): a dash leaves your element along the tiles it crossed. Fire: lava.
    // Ice: chill on what's there. Lightning: a spark through each one in reach. Cosmic: the
    // Void Blade's fluid, which Hexes.
    _relicDashTrail(fx, fy, tx, ty) {
        if (!this._mods?.dashTrail) return;
        const T = this.TILE_SIZE, el = this.currentElement, n = Math.max(Math.abs(tx - fx), Math.abs(ty - fy));
        const tiles = [];
        for (let k = 0; k <= n; k++) tiles.push([Math.round(fx + (tx - fx) * k / Math.max(1, n)), Math.round(fy + (ty - fy) * k / Math.max(1, n))]);
        const near = (x, y) => (this.enemies || []).filter(e => !this._phasedOut?.(e) && e.sprite?.active && e.health > 0 && Math.abs(e.x - x) <= 1 && Math.abs(e.y - y) <= 1);
        for (const [x, y] of tiles) {
            if (this.world?.[x]?.[y] !== this.FLOOR) continue;
            const px = x * T + T / 2, py = y * T + T / 2;
            if (el === 'fire') this.spawnIgnitionTrail?.(px, py, 3000);
            else if (el === 'ice') { for (const e of near(x, y)) this.applyChill?.(e, 0.5); this._vfxFlash?.(px, py, 22, 0x9ae8ff, 300, 0.6); }
            else if (el === 'lightning') { for (const e of near(x, y)) this.damageEnemy(e, 5 * (this.damageScaling || 1), 'lightning'); this._vfxFlash?.(px, py, 18, 0xffe14a, 200, 0.8); }
            else if (el === 'cosmic' && this._cs) {
                const now = this.time.now, C = this._csCfg().BLADE;
                (this._cs.fluid ||= []).push({ x, y, t0: now, t1: now + 3000, img: null, hexMs: C.HEX_MS });
            }
        }
    }
    // what each element's dash looks like
    _dashFx(el, x0, y0, x1, y1, col) {
        const T = this.TILE_SIZE, D = 3.4, L = Math.hypot(x1 - x0, y1 - y0) || 1, nx = (x1 - x0) / L, ny = (y1 - y0) / L, p = this.player, ADD = Phaser.BlendModes.ADD;
        const along = (u, off = 0) => [x0 + (x1 - x0) * u - ny * off, y0 + (y1 - y0) * u + nx * off];
        const mote = (x, y, c, size, ms, vx = 0, vy = 0, add = true, d = D + 0.1) => {
            const m = this.add.rectangle(x, y, size, size, c).setDepth(d); if (add) m.setBlendMode(ADD);
            this.tweens.add({ targets: m, x: x + vx, y: y + vy, alpha: 0, scale: 0.2, duration: ms, ease: 'Quad.easeOut', onComplete: () => m.destroy() });
        };
        const ghost = (u, tint, a, ms, sc = 1) => {   // an afterimage of the slime, in the element's light
            const [x, y] = along(u); const g = this.add.sprite(x, y + this.SLIME_Y_OFFSET, p.texture.key, p.frame.name).setScale(p.scaleX * sc, p.scaleY * sc).setFlipX(p.flipX).setDepth(p.depth - 0.01).setTintFill(tint).setAlpha(a).setBlendMode(ADD);
            this.tweens.add({ targets: g, alpha: 0, scaleX: p.scaleX * sc * 1.15, duration: ms, onComplete: () => g.destroy() });
        };
        if (el === 'fire') {
            // a comet of flame: the slime trails a tapering fire tail (white core, gold, orange, a red fringe), ghosts burning
            // off behind it, embers spraying back and up, heat-shimmer smoke rising, a ring of flame where it lands
            const g = this.add.graphics().setDepth(D).setBlendMode(ADD);
            const f = { t: 0 };
            this.tweens.add({ targets: f, t: 1, duration: 420, onUpdate: () => {
                g.clear();
                for (const [w, c, a] of [[18, 0xc82a0a, 0.35], [12, 0xff6a1a, 0.6], [7, 0xffb040, 0.85], [3, 0xfff0c0, 1]]) {
                    for (let k = 0; k < 10; k++) { const u0 = k / 10, u1 = (k + 1) / 10, fade = (1 - f.t) * (0.4 + 0.6 * u1); g.lineStyle(w * (0.35 + 0.65 * u1) * (1 - f.t * 0.6), c, a * fade); const [ax, ay] = along(u0, Math.sin(u0 * 9 + f.t * 20) * 2), [bx, by] = along(u1, Math.sin(u1 * 9 + f.t * 20) * 2); g.lineBetween(ax, ay, bx, by); }
                }
            }, onComplete: () => g.destroy() });
            for (const u of [0.2, 0.45, 0.7]) ghost(u, 0xff8a2a, 0.55, 300);
            for (let k = 0; k < 26; k++) { const [x, y] = along(Math.random(), (Math.random() - 0.5) * 10); mote(x, y, [0xfff0a0, 0xffb040, 0xff5a1a][k % 3], 2 + (k % 3), 450 + Math.random() * 400, -nx * 20 + (Math.random() - 0.5) * 24, -30 - Math.random() * 40); }
            for (let k = 0; k < 6; k++) { const [x, y] = along(Math.random()); const sm = this.add.circle(x, y, 4, 0x3a2a24, 0.4).setDepth(D - 0.1); this.tweens.add({ targets: sm, y: y - 26, scale: 2.4, alpha: 0, duration: 900 + k * 80, onComplete: () => sm.destroy() }); }
            const ring = this.add.circle(x1, y1, 6).setStrokeStyle(3, 0xffb040, 1).setDepth(D).setBlendMode(ADD);
            this.tweens.add({ targets: ring, scale: 4, alpha: 0, duration: 380, ease: 'Quad.easeOut', onComplete: () => ring.destroy() });
            this._vfxFlash?.(x1, y1, 60, 0xff7a2a, 220, 0.75);
        } else if (el === 'ice') {
            // a frost glide: the tiles it crosses freeze over, frost dust and snowflakes trail it, rime creeps out where it stops
            // every tile it crosses freezes over in turn: a slab of ice the size of the tile, bevelled, cracked, with a glint,
            // that sets as the slime passes and thaws a second later
            const n0 = Math.max(1, Math.round(L / T));
            for (let k = 0; k <= n0; k++) {
                const [cx, cy] = along(k / n0);
                for (const w of [0, -1, 1]) {   // the path and a tile either side of it
                const tx = Math.floor(cx / T) + Math.round(-ny * w), ty = Math.floor((cy + 4) / T) + Math.round(nx * w);
                if (this.world?.[tx]?.[ty] !== this.FLOOR) continue;
                const g = this.add.graphics().setDepth(0.25).setPosition(tx * T + T / 2, ty * T + T / 2).setScale(0.5).setAlpha(0);
                VisualFX.iceTile?.(g, T, tx * 31 + ty * 17);
                this.tweens.add({ targets: g, scale: 1, alpha: 1, duration: 120, delay: k * 600 / (n0 + 1) + Math.abs(w) * 40, ease: 'Back.easeOut' });
                this.tweens.add({ targets: g, alpha: 0, scaleY: 0.92, delay: 1300 + k * 60, duration: 800, ease: 'Quad.easeIn', onComplete: () => g.destroy() });
                }
            }
            for (const u of [0.25, 0.5, 0.75]) ghost(u, 0xbfe8ff, 0.45, 420);
            for (let k = 0; k < 14; k++) { const [x, y] = along(Math.random(), (Math.random() - 0.5) * 14); mote(x, y, k % 3 ? 0xd8f4ff : 0xffffff, 1.5 + (k % 2), 600 + Math.random() * 400, (Math.random() - 0.5) * 14, -10 - Math.random() * 10, false); }   // frost dust
            for (let k = 0; k < 8; k++) { const [x, y] = along(Math.random()); const fl = this.add.star(x, y, 6, 1, 3, 0xffffff).setDepth(D + 0.2); this.tweens.add({ targets: fl, angle: 180, y: y - 12, alpha: 0, duration: 700 + k * 50, onComplete: () => fl.destroy() }); }
            for (let k = 0; k < 8; k++) { const a = k / 8 * Math.PI * 2, r = this.add.rectangle(x1, y1 + 4, 7, 1.5, 0xffffff).setAngle(a * 180 / Math.PI).setDepth(0.26); this.tweens.add({ targets: r, x: x1 + Math.cos(a) * 20, y: y1 + 4 + Math.sin(a) * 11, alpha: 0, duration: 700, onComplete: () => r.destroy() }); }
        } else if (el === 'lightning') {
            // a blink: the slime bursts into light and a forked bolt tears from where it was to where it is, branching, with a
            // second fainter stroke a beat later; arcs crackle at both ends, the floor scorches along the line, the screen jolts
            const bolt = (w, c, a, jit, d = D) => {
                const g = this.add.graphics().setDepth(d).setBlendMode(ADD), pts = [[x0, y0]];
                for (let k = 1; k < 9; k++) { const j = (Math.random() - 0.5) * jit; pts.push(along(k / 9, j)); }
                pts.push([x1, y1]);
                for (const [ww, cc, aa] of [[w * 3, c, a * 0.3], [w, 0xfff6a0, a], [Math.max(1, w * 0.35), 0xffffff, a]]) { g.lineStyle(ww, cc, aa); g.beginPath(); g.moveTo(...pts[0]); for (const q of pts.slice(1)) g.lineTo(...q); g.strokePath(); }
                for (let b = 0; b < 3; b++) { const from = pts[2 + b * 2], a2 = Math.atan2(ny, nx) + (Math.random() < 0.5 ? -1 : 1) * (0.6 + Math.random() * 0.6); let [bx, by] = from; g.lineStyle(1.5, 0xfff6a0, a * 0.8); g.beginPath(); g.moveTo(bx, by); for (let s3 = 0; s3 < 3; s3++) { bx += Math.cos(a2) * 6 + (Math.random() - 0.5) * 5; by += Math.sin(a2) * 6 + (Math.random() - 0.5) * 5; g.lineTo(bx, by); } g.strokePath(); }
                this.tweens.add({ targets: g, alpha: 0, duration: 280, onComplete: () => g.destroy() });
            };
            bolt(4, 0xffe14a, 1, 18);
            this.time.delayedCall(70, () => bolt(2, 0xffe14a, 0.6, 26));
            const sc = this.add.graphics().setDepth(0.22); sc.lineStyle(4, 0x1a1408, 0.4); sc.lineBetween(x0, y0 + 6, x1, y1 + 6);
            this.tweens.add({ targets: sc, alpha: 0, duration: 1400, onComplete: () => sc.destroy() });
            ghost(0, 0xfff6a0, 0.9, 200, 1.1); ghost(1, 0xffffff, 0.8, 260, 1.25);
            for (const [x, y] of [[x0, y0], [x1, y1]]) {
                this._vfxFlash?.(x, y, 50, 0xfff6a0, 180, 0.85);
                const arcs = this.add.graphics().setDepth(D).setBlendMode(ADD);
                for (let k = 0; k < 5; k++) { const a = Math.random() * Math.PI * 2; let ax = x, ay = y; arcs.lineStyle(1.2, 0xfff6a0, 0.9); arcs.beginPath(); arcs.moveTo(ax, ay); for (let s3 = 0; s3 < 3; s3++) { ax += Math.cos(a) * 5 + (Math.random() - 0.5) * 6; ay += Math.sin(a) * 5 + (Math.random() - 0.5) * 6; arcs.lineTo(ax, ay); } arcs.strokePath(); }
                this.tweens.add({ targets: arcs, alpha: 0, duration: 220, onComplete: () => arcs.destroy() });
            }
            for (let k = 0; k < 14; k++) { const a = Math.random() * Math.PI * 2; mote(x1, y1, 0xfff6a0, 2, 300, Math.cos(a) * 34, Math.sin(a) * 34); }
            this.cameras.main.shake(50, 0.003);
        } else this._vfxFlash?.(x1, y1, 60, col, 180, 0.6);
    }
    // A dash's glide, each frame: eased from where the slime was to where it lands.
    _updateGlide(now) {
        const G = this._glide, p = this.player;
        if (!G || !p?.active) return;
        const u = Math.min(1, Math.max(0, (now - G.t0) / G.dur)), e = G.ice ? (1 - Math.cos(u * Math.PI)) / 2 : 1 - (1 - u) * (1 - u);   // ice eases in and out: a slide you can see, not a jump
        p.setPosition(G.x0 + (G.x1 - G.x0) * e, G.y0 + (G.y1 - G.y0) * e);
        if (u >= 1) this._glide = null;
    }
    // Lightning's landing: a daze goes out in a wave, its own tile first, then the ring of 3x3 round it, then the
    // ring of 5x5 (WAVE_MS apart). Each ring crackles as it's reached (a charged glaze, its edge bright as the
    // wave front, sparks along it) and holds as long as what it caught stays dazed.
    _dashDazeFx(tx, ty, ms, R = 2, quiet = false) {
        const T = this.TILE_SIZE, WAVE_MS = 110, t0 = this.time.now, ADD = Phaser.BlendModes.ADD;
        const g = this.add.graphics().setDepth(0.26).setBlendMode(ADD);
        for (let r = 0; r <= R; r++) this.time.delayedCall(r * WAVE_MS, () => {
            const now = this.time.now;
            for (const e of this.enemies || []) {
                if (this._phasedOut?.(e)) continue;
                if (!e.sprite?.active || e.health <= 0 || Math.max(Math.abs(e.x - tx), Math.abs(e.y - ty)) !== r) continue;
                e.isStunned = true; e.stunnedUntil = Math.max(e.stunnedUntil || 0, now + ms);
                if (!quiet) this.showStatusText(e.sprite.x, e.sprite.y - 10, 'DAZED', '#fff6a0');
            }
            if (!quiet) Sfx.play(this, 'zap');
        });
        const f = { t: 0 }, total = R * WAVE_MS + ms;
        const draw = () => {
            g.clear();
            const el = this.time.now - t0;
            for (let i = -R; i <= R; i++) for (let j = -R; j <= R; j++) {
                const r = Math.max(Math.abs(i), Math.abs(j)), at = r * WAVE_MS, age = el - at;
                if (age < 0 || this.world?.[tx + i]?.[ty + j] !== this.FLOOR) continue;
                const k = Math.max(0, 1 - age / ms), front = Math.max(0, 1 - age / 140);
                const x = (tx + i) * T, y = (ty + j) * T;
                g.fillStyle(0xffe14a, (0.12 + 0.3 * front) * k); g.fillRect(x + 1, y + 1, T - 2, T - 2);
                g.lineStyle(1, 0xfff6a0, (0.35 + 0.6 * front) * k); g.strokeRect(x + 1.5, y + 1.5, T - 3, T - 3);
            }
            for (let r = 0; r <= R; r++) {                     // sparks running round each ring once it's reached
                const age = el - r * WAVE_MS; if (age < 0) continue;
                const k = Math.max(0, 1 - age / ms), half = (r + 0.5) * T, cx = tx * T + T / 2, cy = ty * T + T / 2;
                for (let n = 0; n < 2; n++) {
                    const side = Math.floor(Math.random() * 4), u = (Math.random() * 2 - 1) * half;
                    let px = side < 2 ? cx + u : cx + (side === 2 ? -half : half), py = side < 2 ? cy + (side === 0 ? -half : half) : cy + u;
                    g.lineStyle(1.4, 0xfff6c0, 0.9 * k); g.beginPath(); g.moveTo(px, py);
                    for (let m = 0; m < 3; m++) { px += (Math.random() - 0.5) * 8; py += (Math.random() - 0.5) * 8; g.lineTo(px, py); }
                    g.strokePath();
                }
            }
        };
        this.tweens.add({ targets: f, t: 1, duration: total, onStart: draw, onUpdate: draw, onComplete: () => g.destroy() });
    }
    playerDash(dirX, dirY) {
        const now = this.time.now;
        if (now < (this._dashReadyAt || 0) || (!dirX && !dirY)) return false;
        if (this.thunderheadActive || this._playerRooted || this._deathScreenActive) return false;
        // each element dashes its own way (cosmic has its own dash, cosmicDash):
        //   fire       a flame streak: 4 tiles; it hits and staggers what it passes through, the tiles it crossed crack and
    //              0.6s later erupt in order (a burst of damage round each) into lava (0.7s: one burn stack)
        //   ice        a glide: 6 tiles, three wide, and a bit longer to recover; a chill stack on what it passes through (a full bar cubes), what it passes through takes a chill stack
        //   lightning  a blink: 3 tiles, instant, quicker to recover, a daze goes out in a wave where it lands (1, 3x3, 5x5)
        const el = this.currentElement, K = { fire: { n: this.ignitionActive ? this._scorchCfg().DASH_TILES : 4, cd: 0.65 }, ice: { n: 6, cd: 1.15 }, lightning: { n: 3, cd: 0.75 } }[el] || { n: this.DASH_TILES, cd: 1 };
        const fromX = this.playerX, fromY = this.playerY, path = [];
        let landX = fromX, landY = fromY;
        for (let i = 1; i <= K.n; i++) {
            const x = fromX + dirX * i, y = fromY + dirY * i;
            if (!this._dashCanEnter(x, y)) break;
            path.push([x, y]);
            if (!this.getEnemyAt(x, y)) { landX = x; landY = y; }
        }
        if (landX === fromX && landY === fromY) return false;
        // ice freezes a strip three tiles wide along its path; lightning's landing sends a daze out in a wave instead (_dashDazeFx)
        const wide = el === 'ice' ? [0, 1, -1] : [0];
        const passed = el === 'lightning' ? [] : (this.enemies || []).filter(e => !this._phasedOut?.(e) && e.sprite?.active && e.health > 0
            && path.some(([x, y]) => wide.some(w => e.x === x - dirY * w && e.y === y + dirX * w)));
        if (el === 'lightning') this._dashDazeFx(landX, landY, this.cosmicDashStunDuration);
        for (const e of passed) {
            if (el === 'ice') {   // one stack; if that fills its bar it's cubed there and then (applyChill). Once per enemy per 3s, so a pack can't be farmed
                if (now - (e._dashChillAt ?? -1e9) < 3000) continue;
                e._dashChillAt = now; this.applyChill(e, this._chillCfg().MAX / 6 / this._chillCfg().RATE);   // a sixth of the bar
            }
            else if (el === 'fire') {   // the rush: a hit and a stagger as you burn through
                this.damageEnemy(e, this.FIRE_DASH.RUSH * (this.damageScaling || 1), 'fire');
                if (this.ignitionActive && e.health > 0) this.applySuperBurn(e, 1);   // Scorch: Super Burn comes only from dashing straight through
                if (e.health > 0) { e.isStunned = true; e.stunnedUntil = Math.max(e.stunnedUntil || 0, now + this.FIRE_DASH.STAGGER); }
            }
            else if (el === 'lightning') {
                e.isStunned = true; e.stunnedUntil = Math.max(e.stunnedUntil || 0, now + this.cosmicDashStunDuration);
                if (e.sprite?.active) this.showStatusText(e.sprite.x, e.sprite.y - 10, 'DAZED', '#fff6a0');
            }
        }
        // fire unzips the floor: every tile it crossed splits with a crack, the fissures widen and glow for OPEN_MS
        // (smoking, spitting embers, the floor tilting up beside them), then burst in order along its path, each a burst
        // of damage round it and lava for 0.7s (it dries before lava's second stack, LAVA_MS 800: one burn a dash)
        if (el === 'fire') {
            const tiles = [[fromX, fromY], ...path].filter(([x, y]) => x !== landX || y !== landY), T = this.TILE_SIZE, OPEN_MS = this.FIRE_DASH.OPEN_MS, STEP = 90, burnt = new Set();
            tiles.forEach(([x, y], k) => {
                const px = x * T + T / 2, py = y * T + T / 2, c = this.add.graphics().setDepth(0.24).setPosition(px, py), born = this.time.now, seed = x * 31 + y * 17;
                const f = { g: 0 }, redraw = () => { if (!c.active) return; c.clear(); VisualFX.crackTile(c, T, seed, dirX, dirY, 0.25 + 0.75 * f.g, f.g, this.time.now - born); };
                redraw();
                this.tweens.add({ targets: f, g: 1, duration: OPEN_MS + k * STEP, ease: 'Cubic.easeIn', onUpdate: () => {
                    redraw();
                    if (Math.random() < 0.05 + 0.25 * f.g) { const e = this.add.rectangle(px + (Math.random() - 0.5) * T * 0.6, py, 2, 2, Math.random() < 0.5 ? 0xffe08a : 0xff6a1a).setDepth(3.5).setBlendMode(Phaser.BlendModes.ADD); this.tweens.add({ targets: e, y: py - 8 - Math.random() * 12, x: e.x + (Math.random() - 0.5) * 6, alpha: 0, duration: 420, onComplete: () => e.destroy() }); }   // embers
                    if (Math.random() < 0.06 * f.g) { const sm = this.add.circle(px + (Math.random() - 0.5) * T * 0.5, py, 3, 0x2a1e18, 0.35).setDepth(3.4); this.tweens.add({ targets: sm, y: py - 22, scale: 2.4, alpha: 0, duration: 900, onComplete: () => sm.destroy() }); }   // smoke
                } });
                this.time.delayedCall(OPEN_MS + k * STEP, () => {
                    if (!c.active) return;
                    this.tweens.add({ targets: c, scaleX: 1.6, scaleY: 1.6, alpha: 0, duration: 180, ease: 'Quad.easeOut', onComplete: () => c.destroy() });
                    this.spawnIgnitionTrail?.(px, py, 700);
                    for (let ox = -1; ox <= 1; ox++) for (let oy = -1; oy <= 1; oy++) this._evaporate?.(x + ox, y + oy, 6);   // it boils the water round it off to fog
                    Sfx.play(this, 'flameburst');
                    // the burst: anything on it or beside it, once a dash
                    for (const e of [...(this.enemies || [])]) {
                        if (!e.sprite?.active || e.health <= 0 || burnt.has(e) || Math.max(Math.abs(e.x - x), Math.abs(e.y - y)) > 1) continue;
                        burnt.add(e); this.damageEnemy(e, this.FIRE_DASH.ERUPT * (this.damageScaling || 1), 'fire');
                    }
                    for (const q of [...(this.portals || [])]) {   // queens beside it: once a dash, like the enemies
                        if (!q.active || burnt.has(q) || Math.max(Math.abs(q.tileX - x), Math.abs(q.tileY - y)) > 1.5) continue;
                        burnt.add(q); this.damagePortal(q, this.FIRE_DASH.ERUPT * (this.damageScaling || 1));
                    }
                    this._vfxFlash?.(px, py, 60, 0xff7a2a, 260, 0.9);
                    this.cameras.main.shake(45, 0.0025);
                    const ring = this.add.circle(px, py, 5, 0, 0).setStrokeStyle(2, 0xffb040, 1).setDepth(3.4).setBlendMode(Phaser.BlendModes.ADD);
                    this.tweens.add({ targets: ring, scale: 3.4, alpha: 0, duration: 320, ease: 'Quad.easeOut', onComplete: () => ring.destroy() });
                    for (let m = 0; m < 10; m++) {   // a geyser of lava and embers
                        const a = -Math.PI / 2 + (Math.random() - 0.5) * 1.3, sp = 14 + Math.random() * 26, e = this.add.rectangle(px, py, m % 3 ? 2 : 3, m % 3 ? 2 : 3, m % 2 ? 0xffe08a : 0xff5a1a).setDepth(3.5).setBlendMode(Phaser.BlendModes.ADD);
                        this.tweens.add({ targets: e, x: px + Math.cos(a) * sp * 0.6, y: py + Math.sin(a) * sp, duration: 260, ease: 'Quad.easeOut', onComplete: () => this.tweens.add({ targets: e, y: e.y + 14, alpha: 0, duration: 260, ease: 'Quad.easeIn', onComplete: () => e.destroy() }) });
                    }
                    for (let m = 0; m < 3; m++) {   // chunks of the floor thrown off
                        const a = Math.random() * Math.PI * 2, ch = this.add.rectangle(px, py, 3, 3, 0x5a504a).setDepth(3.45);
                        this.tweens.add({ targets: ch, x: px + Math.cos(a) * 16, y: py + Math.sin(a) * 10 - 6, angle: 220, alpha: 0, duration: 420, ease: 'Quad.easeOut', onComplete: () => ch.destroy() });
                    }
                });
            });
        }

        this._dashReadyAt = now + this.DASH_COOLDOWN * K.cd;
        this._dashInvulnUntil = now + this.DASH_IFRAMES;
        this._slipLeft = 3;   // Slipstream (an enchant): the next 3 hits
        this.lastMoveTime = now;
        this.playerX = landX; this.playerY = landY;
        const tiles = Math.abs(landX - fromX) + Math.abs(landY - fromY);
        this._singTilesTraversed = (this._singTilesTraversed || 0) + tiles;
        this._relicDashTrail?.(fromX, fromY, landX, landY);   // Trailblazer (a relic)
        if (this._mods?.momentum) { const L = (this._moveLog ||= []); for (let k = 0; k < tiles; k++) L.push(now); }   // Racing Heart: a dash counts

        // Afterimages along the path, in your element's colour, then the slime itself.
        const T = this.TILE_SIZE, col = this._vfxCfg?.().EL?.[this.currentElement] ?? 0xffffff;
        const p = this.player, x0 = p.x, y0 = p.y;
        const x1 = landX * T + T / 2, y1 = landY * T + T / 2 + this.SLIME_Y_OFFSET;
        this.tweens.killTweensOf(p);
        if (el === 'lightning') { p.setPosition(x1, y1); }   // a blink: there, no travel
        else { for (let k = 0; k < 3; k++) { const f = k / 3, g = this.add.sprite(x0 + (x1 - x0) * f, y0 + (y1 - y0) * f, p.texture.key, p.frame.name).setScale(p.scaleX, p.scaleY).setFlipX(p.flipX).setDepth(p.depth - 0.01).setTint(col).setAlpha(0.5 - k * 0.1).setBlendMode(Phaser.BlendModes.ADD); this.tweens.add({ targets: g, alpha: 0, duration: 260, delay: k * 25, onComplete: () => g.destroy() }); }
            // ice glides (the slowest), fire rushes; lightning and cosmic are instant. Driven by _updateGlide every frame
            // rather than a tween: a tween starts a frame late (the slime stalled as the dash began) and a step's tween
            // could fight it. No step until it lands.
            const glide = el === 'ice' ? 600 : 150;
            this._glideUntil = now + glide;
            this._glide = { x0, y0, x1, y1, t0: now, dur: glide, ice: el === 'ice' };
            this._updateGlide(now + 16); }
        this._vfxHop?.(p);
        this._dashFx(el, x0, y0 - this.SLIME_Y_OFFSET, x1, y1 - this.SLIME_Y_OFFSET, col);
        Sfx.play(this, 'dash', { el });
        PlayerStats.onDash(this);   // Rolling Guard

        this.updateHUD();
        this._checkRoomNameDisplay();
        if (this.isLevel4) this._onPlayerStepCrumble(landX, landY);
        this._onPlayerStepWater(landX, landY, now);
        return true;
    }

    // Could a step put you on (x, y)? The same rules as walking: floor, no node, not a
    // sealed room or door, not a Fracture crack while the core lives.
    _dashCanEnter(x, y) {
        if (x < 0 || y < 0 || x >= this.WORLD_WIDTH || y >= this.WORLD_HEIGHT) return false;
        if (this.world[x][y] !== this.FLOOR || this.isNodeAt(x, y)) return false;
        if (this.isInLockedRoom && this.isInLockedRoom(x, y)) return false;
        if (this._roomGated() && this.lockedDoorTiles?.some(t => t.x === x && t.y === y)) return false;
        if (this.isLevel4 && this._debrisTiles?.length && this.fractureCore?.active
            && this._isInCrack(x * this.TILE_SIZE + this.TILE_SIZE / 2, y * this.TILE_SIZE + this.TILE_SIZE / 2)) return false;
        return true;
    }
}
