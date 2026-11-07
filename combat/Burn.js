// ═══════════════════════════════════════════════════════════════════════════
// Burn.js — fire's burn on an enemy: the stacks and their decay, blue burn, super burn, the ignition mark, the
// burn on a boss, and the indicators over them.
// GameScene borrows each method through a one-line proxy, so `this` in them is the scene.
// ═══════════════════════════════════════════════════════════════════════════

class Burn {

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
            BLUE_INFECT_MS: 600, BLUE_POP_MS: 400, BLUE_BURST: 14, BLUE_PCT: 0.012,   // (25 and 2% till 2026-10-28)
            HOLD_MS: 4000,
            DECAY_MS: 1000,
            LAVA_MS: 800,   // standing in lava: one burn stack per 0.8s, no damage of its own
            COMBUST_PER_STACK: 8,
        };
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

    // A burn tick's ult charge (gainUltCharge's 'tick'): never a reaction, the same whatever the fire weapon, and a crowd's ticks
    // count as at most TICK_CROWD burning enemies' between them: a burning crowd under another status filled a gem in seconds
    _burnCharge() {
        const C = this._ultCfg(), now = this.time.now;
        if (this._burnN?.t !== now) this._burnN = { t: now, n: (this.enemies || []).filter(e => e.sprite?.active && (e.burnStacks > 0 || e.superBurn > 0)).length };
        this.gainUltCharge(this.ultChargePerBurnTick * Math.min(1, C.TICK_CROWD / Math.max(1, this._burnN.n)), 'fire', false, 'tick');
    }

    // n stacks onto an enemy. Not on ice elementals, not on anything out of the world.
    applyBurnStack(enemy, n = 1) {
        if (!enemy?.sprite?.active || enemy.health <= 0) return;
        if (enemy._immuneFx === 'fire') { if (enemy.sprite?.active && this.time.now - (enemy._fxNoAt || 0) > 900) { enemy._fxNoAt = this.time.now; this.showStatusText(enemy.sprite.x, enemy.sprite.y - 30, "CAN'T BURN", '#ffb070'); } return; }   // an Adaptive Shade in its fire form
        if (enemy.iceImmune) return;
        if (this._phasedOut(enemy)) return;
        const B = this._burnCfg(), now = this.time.now;
        if (this._superBurnHolds(enemy, now)) return;   // Super Burn has taken over: the stack only keeps it alight
        this._burnDecay(enemy, now);
        enemy.burnStacks = Math.min(B.MAX, (enemy.burnStacks || 0) + n);
        enemy.lastBurnStackTime = now;
        Sfx.play(this, 'ignite');
        enemy._burnDecayAt = now + B.HOLD_MS;
        enemy.isBurning = true;
        this._recalcMagmaFireballCount();
        this._applyBurnDoT(enemy);
    }

    // A blue burn stack: onto an empty slot if there is one, else one of the ordinary stacks turns blue
    applyBlueBurn(enemy) {
        if (!enemy?.sprite?.active || enemy.health <= 0 || enemy.iceImmune || this._phasedOut(enemy)) return;
        const B = this._burnCfg(), now = this.time.now;
        if (this._superBurnHolds(enemy, now)) return;
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
        if ((enemy.burnStacks || 0) > 0) {   // it takes over from the ordinary burn: those stacks are gone at once
            enemy.burnStacks = 0; enemy.blueBurn = 0;
            this._burnDecay(enemy, now); this._clearBurnStackIndicator?.(enemy); this._recalcMagmaFireballCount();
        }
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
                        this._burnCharge();
                        this._scorchHeal();
                        if (enemy.sprite?.active) this.showDamageNumber(enemy.sprite.x, enemy.sprite.y - 8, dmg, '#ffe08a');
                        this.updateEnemyHealthBar(enemy);
                        if (enemy.health <= 0) { this.killEnemy(enemy); if (!(enemy.sprite?.active && enemy.health > 0)) return; }   // (one brought back, a Training dummy, burns on: else its stacks hung there, ticking nothing)
                    }
                }
                enemy._sbTimer = this.time.delayedCall(B.TICK, tick);
            };
            enemy._sbTimer = this.time.delayedCall(B.TICK, tick);
        }
    }
    // An enemy can't Burn while it Super Burns: a burn stack landing on one only starts its Super Burn's hold again (true: it did)
    _superBurnHolds(enemy, now) {
        this._superBurnDecay(enemy, now);
        if (!(enemy.superBurn > 0)) return false;
        enemy._sbDecayAt = now + this._superBurnCfg().HOLD;
        return true;
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
                this._burnCharge();
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
                    this._burnCharge();
                    this._scorchHeal();   // Scorch: burn ticks heal you
                    if (enemy.sprite?.active) this.showDamageNumber(enemy.sprite.x, enemy.sprite.y - 8, dmg, enemy._purpleMarked ? '#ff44ff' : '#ff8800');
                    this.updateEnemyHealthBar(enemy);
                    if (enemy.health <= 0) { this.killEnemy(enemy); if (!(enemy.sprite?.active && enemy.health > 0)) return; }   // (one brought back, a Training dummy, burns on: else its stacks hung there, ticking nothing)
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

}
