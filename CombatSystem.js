// ═══════════════════════════════════════════════════════════════════════
// COMBATSYSTEM.JS — Damage gates, kill, status effects (burn, brittle, freeze, slow)
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

class CombatSystem {
    // Every hit lands within ±DAMAGE_VARIANCE of its damage. 0 turns it
    // off (the dps plan does, so its numbers stay exact).
    static DAMAGE_VARIANCE = (typeof window !== 'undefined' && window.__noVariance) ? 0 : 0.10;   // window.__noVariance: exact damage, for checking numbers
    static CRIT_MULT = 1.5;
    static CRIT_DMG_CAP = 3;   // a crit never hits harder than x3, however much crit damage is stacked
    static CRIT_CAP = 0.5;


    showCannotSwitchText(reason) {
        // Dedupe — don't spam if already showing
        if (this._cannotSwitchText && this._cannotSwitchText.active) return;

        const txt = this.add.text(
            this.scale.width / 2,
            this.scale.height / 2 - 60,
            `✕ CANNOT SWITCH\n${reason}`,
            {
                fontSize: '14px', fontFamily: 'monospace',
                color: '#ff4444', stroke: '#000000', strokeThickness: 3,
                fontStyle: 'bold', align: 'center'
            }
        ).setOrigin(0.5).setScrollFactor(0).setDepth(30);

        this._cannotSwitchText = txt;
        this.tweens.add({
            targets: txt, y: txt.y - 20, alpha: 0,
            duration: 1000, ease: 'Quad.easeOut',
            onComplete: () => { txt.destroy(); this._cannotSwitchText = null; }
        });
    }

    showStatusText(x, y, text, color = '#ffffff') {
        if (this._vfxStatusText?.(x, y, text, color)) return;   // "WET ×5", stacked, popping (Visuals.js)
        const txt = this.add.text(
            x + (Math.random() - 0.5) * 14,
            y - 22,
            text,
            {
                fontSize: '11px',
                fontFamily: UIKit.FONT.title,
                color,
                stroke: '#000000',
                strokeThickness: 3,
                fontStyle: 'bold'
            }
        ).setOrigin(0.5).setDepth(10);
        this.tweens.add({
            targets: txt,
            y: txt.y - 18,
            alpha: 0,
            duration: 900,
            ease: 'Quad.easeOut',
            onComplete: () => txt.destroy()
        });
    }

    // What resolveElementalHit just dealt, for the number that's about to show it: its element (a plain white number takes
    // the element's colour) and how much of it Hex added (shown apart, in pink, so you can see the Hex at work)
    _dmgNote(enemy, el, dmg) {
        if (dmg > 0) {
            const H = enemy && (enemy._csHexUntil || 0) > this.time.now && this._csCfg ? this._csCfg().BLADE.HEX_STACKS[Math.min(3, enemy._csHexStacks || 1) - 1] : 1;
            this._lastDmg = { t: this.time.now, el, total: dmg, hex: H > 1 ? dmg - dmg / H : 0 };
        }
        return dmg;
    }
    showDamageNumber(x, y, amount, color = '#ffffff') {
        if (!amount || amount <= 0) return;
        const L = this._lastDmg;
        if (L && L.t === this.time.now && Math.abs(L.total - amount) < 0.51) {   // the hit resolveElementalHit just worked out
            this._lastDmg = null;
            if (color === '#ffffff') color = { fire: '#ff9a4a', ice: '#8ad8ff', lightning: '#ffe14a', cosmic: '#d79cff' }[L.el] || color;
            if (L.hex >= 0.5) {   // Hex's share, beside it in pink
                this.showDamageNumber(x, y, amount - L.hex, this._critPending ? '#ffd34a' : color);   // (a crit's gold goes on this one)
                const list = this._vfxNums, now = this.time.now, base = list?.filter(n => n.t === now && n.txt.active).pop();
                if (!base) { this.showDamageNumber(x + 16, y - 6, L.hex, '#ff5fd2'); return; }
                const bx = base.txt.x + base.txt.displayWidth / 2 + 3, pk = list.find(n => n.color === '#ff5fd2' && now - n.t < 300 && Math.abs(n.x - bx) < 40 && Math.abs(n.y0 - base.y0) < 20);
                const fmt = v => v >= 9.95 ? String(Math.round(v)) : v.toFixed(1);
                if (pk) { pk.total += L.hex; pk.t = now; this.tweens.killTweensOf(pk.txt); pk.txt.setText('+' + fmt(pk.total)).setAlpha(1).setPosition(pk.x, pk.y0).setScale(1.2); this._vfxFloat?.(pk.txt); return; }
                const txt = this.add.text(bx, base.y0, '+' + fmt(L.hex), { fontSize: `${Math.max(9, Math.round(base.txt.style.fontSize ? parseInt(base.txt.style.fontSize) * 0.8 : 11))}px`, fontFamily: UIKit.FONT.title, fontStyle: 'bold',
                    color: '#ff5fd2', stroke: '#05060a', strokeThickness: 4, resolution: 2 }).setOrigin(0, 0.5).setDepth(10).setScale(1.2);   // Hex's share, right beside the hit
                list.push({ txt, x: bx, y: base.y, y0: base.y0, t: now, total: L.hex, color: '#ff5fd2' });
                this._vfxFloat?.(txt);
                return;
            }
        }
        if (this._critPending) {   // a crit (_hitRoll): gold, with a word over it now and then
            this._critPending = false;
            color = '#ffd34a';
            if (this.time.now - (this._critWordAt || -1e9) > 350) { this._critWordAt = this.time.now; this.showStatusText(x, y - 22, 'CRIT', '#ffd34a'); }
        }
        if (this._vfxDamageNumber?.(x, y, amount, color)) return;   // merged, popping numbers (Visuals.js)
        const txt = this.add.text(
            x + (Math.random() - 0.5) * 12,
            y - 14,
            `-${amount.toFixed(1)}`,
            {
                fontSize: '13px',
                fontFamily: UIKit.FONT.title,
                color,
                stroke: '#000000',
                strokeThickness: 3,
                fontStyle: 'bold'
            }
        ).setOrigin(0.5).setDepth(10);
        this.tweens.add({
            targets: txt,
            y: txt.y - 24,
            alpha: 0,
            duration: 750,
            ease: 'Quad.easeOut',
            onComplete: () => txt.destroy()
        });
    }

    // `element` is optional and defaults to the player's active element, so all 50
    // existing two-argument call sites keep working untouched. Pass it explicitly for
    // damage whose element differs from what the player currently holds (environmental
    // sources, tower shots, a weapon that deals off-element damage).
    // One definition of "this enemy is not in the world right now". This used to be
    // written inline at each call site as `isVoidSniper && _sniperInvisible`, which is
    // how damageEnemyIce, burn ticks, lava trails, splash and every explosion ended up
    // with no guard at all -- a Void Sniper could be killed inside its pocket dimension.
    // The resolution damageEnemy does, factored out so the ~25 direct-damage paths can
    // use it without each re-deriving the refusal display. Returns the damage to apply,
    // or null when the table refuses the hit entirely.
    //
    // This is what makes ElementResist authoritative. Before, only damageEnemy consulted
    // the table; every other path wrote enemy.health directly, so "fire does 0.45x to
    // this enemy" was true on some paths and not others depending on which of 86 code
    // routes delivered the blow. The legacy `if (enemy.fireImmune) return;` guards are
    // left in place on purpose -- they only bail on immunity, which the table also
    // scores as 0, so they are redundant rather than wrong, and removing 86 of them
    // would be a far larger change than making the multiplier apply.
    resolveElementalHit(enemy, raw, element, escapeHatch = false) {
        if (!enemy || this._phasedOut(enemy)) return null;
        const el = element || this.currentElement || 'physical';
        // ESCAPE HATCHES. A marked enemy is immune to direct hits by design and has one way
        // to die (see ElementResist's TABLE): fire-marked to fire's environmental damage
        // (lava, burn ticks), ice-marked to its ice cube shattering. Those paths call this
        // function, which sent them back through the table that refuses them, so the
        // Gauntlet's marked enemies took no damage from anything the player could do. Their
        // callers pass escapeHatch = true. Brittle still applies.
        if (escapeHatch && ((el === 'fire' && enemy.fireImmune) || (el === 'ice' && enemy.iceImmune))) {
            this._csOnHit?.(enemy, el);
            return this._dmgNote(enemy, el, this._cubeNote(enemy, el, this._tallyDamage(el, this._specialHit(enemy, this._afterHit(enemy, el, (raw || 0) * this._brittleMult(enemy, el) * (enemy._purpleMarked ? 1.5 : 1) * this._dmgOutMult(enemy, el) * this._hitRoll(enemy, el)), el))));   // purple; your damage (boons, stat, weapon level); the roll
        }
        const res = ElementResist.resolve(enemy, el, raw);
        if (this._mods?.pierceRes && res.mult > 0 && res.mult < 1) { const m2 = 1 - (1 - res.mult) / 2; res.dmg = res.dmg / res.mult * m2; res.mult = m2; }   // Eye of the Storm: resisted hits ignore half the resistance
        if (res.refused) {
            if (enemy.sprite?.active) {
                this.showStatusText(enemy.sprite.x, enemy.sprite.y - 10, res.label, res.color);
            }
            return null;
        }
        this._noteUltHit(enemy, el);     // which gem this hit charges, and whether it reacted
        if (res.mult > 0 && res.mult < 1 && res.profile !== ElementResist.TABLE.none && el !== 'cosmic'   // (cosmic is the same on everything: nothing resists it)
            && enemy.sprite?.active) {
            this._showResistShield(enemy, res);
        }
        // BRITTLE. Applied here because this is the single choke point all 33 elemental damage
        // sites already route through -- which is what makes "amplifies damage from EVERY
        // source" true by construction rather than by remembering to add it in 33 places.
        // After resistance, so a resisted element is amplified from its reduced figure and the
        // two multipliers compose in the order the player would expect.
        this._csOnHit?.(enemy, el);
        // PURPLE (Fractal's upgraded mark): x1.5 from every source, here for the same reason as
        // brittle. damageEnemy, which resolves on its own, applies it there. (It was x2, but only
        // damageEnemy ever applied it; on every source, x2 made the Fractal the best group weapon.)
        return this._dmgNote(enemy, el, this._cubeNote(enemy, el, this._tallyDamage(el, this._specialHit(enemy, this._afterHit(enemy, el, res.dmg * this._brittleMult(enemy, el) * (enemy._purpleMarked ? 1.5 : 1) * this._dmgOutMult(enemy, el) * this._hitRoll(enemy, el)), el))));   // your damage (boons, stat, weapon level); the roll
    }

    // Diminishing returns within one attack (shotguns, volleys): the first of a volley's
    // projectiles to hit a target does full damage, each one after it 75% of the last (25% at
    // least). A shotgun still shreds a crowd; it can't pour its whole volley into one boss's
    // big hitbox. `id`: the volley; `target`: an enemy, or _bossVolleyKey() for whichever boss.
    _volleyMult(target, id) {
        if (!id || !target) return 1;
        if (target._vlId !== id) { target._vlId = id; target._vlN = 0; }
        return Math.max(0.25, Math.pow(0.75, target._vlN++));
    }
    _bossVolleyKey() { return this._bossVK || (this._bossVK = {}); }

    // The win screen's books (HUD._showWinScreen): damage dealt by element, and the moment
    // you were last in a fight (combat time counts from it). Returns `amt`, so it can wrap a
    // return value.
    // Relic effects on a hit's final number (Relics.js): Colossus Core adds a slice of your max HP,
    // Bloodthirst heals off it (at most 6% of your max HP a second), Splinter Core spills some
    // onto the enemies beside it (not off its own spill).
    // Queens (this.portals) aren't in this.enemies, so an area attack that loops the enemies missed them, and its centre-tile
    // damageBossAtTile only caught one it landed dead on. This hits every queen whose box comes within rTiles of (tx, ty), tile
    // units (fractions fine); `skipCentre`: not one covering the centre tile, which damageBossAtTile already hit. Returns how many.
    // Lightning jumping on from `from` (anything with tile x, y and a sprite): every Queen and boss within `r` tiles takes `dmg`
    // too, each once per chain or fork (`seen`, its hit list). Chains and forks only ever looked through this.enemies.
    _zapBosses(from, dmg, r, seen) {
        if (!(dmg > 0) || !from?.sprite) return;
        const T = this.TILE_SIZE, out = [];
        for (const p of this.portals || []) if (p.active) out.push([p, p.tileX, p.tileY, () => this.damagePortal(p, dmg), p.container]);
        for (const b of [this.voltslimeBoss, this.voidSovereignBoss, this.fractureCore]) {
            if (!b?.active || !b.container) continue;
            const bx = b.tileX ?? Math.floor(b.container.x / T), by = b.tileY ?? Math.floor(b.container.y / T);
            out.push([b, bx, by, () => this.damageBossAtTile(bx, by, dmg, undefined, 'lightning'), b.container]);
        }
        for (const [o, x, y, hit, at] of out) {
            if (seen?.includes(o) || Math.hypot(x - from.x, y - from.y) > r) continue;
            seen?.push(o);
            hit();
            if (at) this.drawLightningBolt(from, { sprite: { x: at.x, y: at.y - 20 } });
        }
    }

    _hitPortalsAround(tx, ty, rTiles, dmg, skipCentre = false) {
        const T = this.TILE_SIZE; let n = 0;
        for (const p of [...(this.portals || [])]) {
            if (!p.active || !(dmg > 0)) continue;
            if (skipCentre && this._portalCoversTile?.(p, Math.floor(tx), Math.floor(ty))) continue;
            const r = (p.hitR ?? T / 2) / T, qx = p.tileX + 0.5, qy = p.tileY + 0.5 + (p.hitOffY || 0) / T;
            const dx = Math.max(0, Math.abs(tx + 0.5 - qx) - r), dy = Math.max(0, Math.abs(ty + 0.5 - qy) - r);   // to the nearest edge of her box
            if (Math.hypot(dx, dy) > rTiles) continue;
            this.damagePortal(p, dmg); n++;
        }
        return n;
    }

    _afterHit(enemy, el, dmg) {
        const M = this._mods || {}, w = this.equippedWeapons?.[el || this.currentElement];
        if (this._tick && M.burnLeech && el === 'fire' && dmg > 0 && this.health > 0) this.health = Math.min(this.maxHealth, this.health + M.burnLeech);   // Cinder Heart: every burn tick heals a little
        if (!(dmg > 0) || this._tick) return dmg;   // on-hit extras skip burn ticks (+% max HP on every tick of every burning enemy)
        const hpHit = (M.hpHit || 0) + (Enchants.n(w, 'juggernaut') + (this._ultHit ? Enchants.n(w, 'earthshaker') : 0)) / 100;   // Juggernaut; Earthshaker on ult hits
        if (hpHit) dmg += (this.maxHealth || 100) * hpHit;
        const drain = (M.drain || 0) + (Enchants.n(w, 'sanguine') + (this._lastCrit ? Enchants.n(w, 'bloodletter') : 0)) / 100;   // Sanguine, Bloodletter
        if (drain && this.health > 0) {
            const now = this.time.now;
            if (now - (this._drainAt || 0) > 1000) { this._drainAt = now; this._drained = 0; }
            const cap = (this.maxHealth || 100) * 0.06, h = Math.min(dmg * drain, cap - this._drained);
            if (h > 0) { this._drained += h; this.health = Math.min(this.maxHealth, this.health + h); }
        }
        if (M.critArc && el === 'lightning' && this._lastCrit && !this._arcBusy && enemy?.sprite?.active) {   // Static Edge: a lightning crit arcs on
            const amt = dmg * M.critArc, from = enemy, T = this.TILE_SIZE;
            this.time.delayedCall(0, () => {
                let to = null, best = 3.5;
                for (const n of this.enemies || []) { if (n === from || !n.sprite?.active || n.health <= 0 || this._phasedOut(n)) continue; const d = Math.hypot(n.x - from.x, n.y - from.y); if (d < best) { best = d; to = n; } }
                if (!to || !from.sprite?.active) return;
                const g = this.add.graphics().setDepth(4.9); g.lineStyle(2, 0xffe14a, 0.95); g.lineBetween(from.sprite.x, from.sprite.y, to.sprite.x, to.sprite.y);
                this.tweens.add({ targets: g, alpha: 0, duration: 180, onComplete: () => g.destroy() });
                this._arcBusy = true;
                try { this.damageEnemy(to, amt / ((this._dmgOutMult?.(to, 'lightning')) || 1), 'lightning'); } finally { this._arcBusy = false; }
            });
        }
        if (M.splash && !this._splashBusy && enemy?.sprite?.active) {
            const bx = enemy.x, by = enemy.y, amt = dmg * M.splash;
            this.time.delayedCall(0, () => {
                if (!this.enemies) return;
                this._splashBusy = true;
                try { for (const n of [...this.enemies]) if (n !== enemy && n.sprite?.active && n.health > 0 && !this._phasedOut(n) && Math.abs(n.x - bx) + Math.abs(n.y - by) === 1) this.damageEnemy(n, amt / ((this._dmgOutMult?.(n, el)) || 1), el); }
                finally { this._splashBusy = false; }
            });
        }
        return dmg;
    }

    _tallyDamage(el, amt) {
        const R = this._runStats;
        if (R && amt > 0) {
            const k = ['fire', 'ice', 'lightning', 'cosmic'].includes(el) ? el : 'other';
            R.dmg[k] = (R.dmg[k] || 0) + amt;
            this._lastCombatAt = this.time.now;
        }
        return amt;
    }

    // Everything that scales the damage YOU deal, in one place: Cosmic.js' boons (Momentum,
    // Ascend, Hex) and the damage stat you buy at Glurp's (Stats.js). Every damage path
    // multiplies by this exactly once: damageEnemy, resolveElementalHit and LevelManager's boss
    // and portal hits. Never fold this into damageScaling; enemy attacks read that too.
    // `el`: the hit's element, whose equipped weapon's Power level counts (WeaponLevels); the
    // element you hold when it isn't known (the boss paths pass none).
    // One hit's roll, at the two choke points (a hit goes through one or the other, never
    // both): variance, then a crit if you have the chance for one (relics and boons, capped at
    // CRIT_CAP). A crit does ×CRIT_MULT, shows gold, and adds a touch of its element.
    _hitRoll(enemy, el) {
        const V = CombatSystem.DAMAGE_VARIANCE;
        let m = V ? 1 - V + Math.random() * 2 * V : 1;
        if (this._tick) return m;   // a burn tick isn't a hit: no crit, no procs (Kindling on a tick fed its own burn)
        const w = this.equippedWeapons?.[el || this.currentElement], luck = this._luckNow();
        const ie = this._thornsHit ? Enchants.n(w, 'iron_edge') : 0;   // Iron Edge: thorns crit twice as often, and harder
        const c = Math.min(CombatSystem.CRIT_CAP, ((this._mods?.crit || 0) + Enchants.crit(w, luck) + luck * 0.003) * (ie ? 2 : 1));   // Luck: +0.3% crit a point (Fortune's Edge: more)
        this._lastCrit = false;
        // Rhythm (an enchant): every nth hit with the weapon is a crit
        const every = Enchants.rhythm(w), beat = every && !this._critBusy && ((this._rhythm ??= {})[w] = ((this._rhythm[w] || 0) + 1) % every) === 0;
        if (!this._critBusy && (this._forceCrit || beat || (c > 0 && Math.random() < c))) {   // (_forceCrit: a hit that always crits, Deadly Accuracy's shards)
            m *= Math.min(CombatSystem.CRIT_DMG_CAP, CombatSystem.CRIT_MULT + Enchants.critMult(w) + (this._mods?.critMult || 0) + ie / 100);   // crit damage has a ceiling: crit stacking multiplied without one
            this._critPending = true;   // the next damage number is this hit's: gold
            this._lastCrit = true;   // Bloodletter heals off it (_afterHit)
            const ld = Enchants.n(w, 'loaded'); if (ld) this._luckCrit = Math.min(Math.round(ld), (this._luckCrit || 0) + 1);   // Loaded
            if (this._mods?.streak) { this._streak = (this._streak || 0) + 1; m *= 1 + Math.min(0.5, this._mods.streak * this._streak); }   // Lucky Streak
            if (this._mods?.doubleCrit) {   // Double or Nothing: the crit rolls again, and again (x1.5 each, three more at most)
                let chain = 0; while (chain < 3 && Math.random() < c) { m *= 1.5; chain++; }
                if (chain && enemy?.sprite) this.showStatusText?.(enemy.sprite.x, enemy.sprite.y - 34, `CRIT x${chain + 1}!`, '#ffe060');
            }
            if (enemy?.sprite) this.time.delayedCall(0, () => this._critEffect(enemy, el));   // after this hit has landed
        } else if (!this._critBusy && (this._streak = 0, this._mods?.doubleCrit) && Math.random() < 0.02) {   // Double or Nothing's price: a stagger
            this._staggerUntil = this.time.now + 350;
            this.showStatusText?.(this.player.x, this.player.y - 30, 'STAGGERED', '#ff8a8a');
        } else if (enemy?.sprite && !this._critBusy && Math.random() < Enchants.proc(w) + (this._mods?.proc || 0)) {
            this.time.delayedCall(0, () => this._critEffect(enemy, el));   // Kindred: the element's touch, without the crit
        }
        // relics (Relics.js): Ember Heart's first hits after switching; Storm Lens on a amped enemy
        const M = this._mods, hel = el || this.currentElement;
        if (M?.reactDmg && M.reactDmg !== 1 && this._lastUltHit?.reaction === 'full' && this._lastUltHit.t === this.time.now) m *= M.reactDmg;   // Catalyst Coil: a reaction hits harder
        if (M?.burst && !this._critBusy && this.time.now - (this._burstAt || 0) >= M.burst) {   // Focus Lens: a charged hit every few seconds
            this._burstAt = this.time.now; m *= 3;
            if (enemy?.sprite) this.showStatusText?.(enemy.sprite.x, enemy.sprite.y - 30, 'BURST x3', '#ffe8a0');
        }
        const slip = this._slipLeft > 0 && !this._critBusy && Enchants.n(w, 'slipstream');   // Slipstream: the hits after a dash
        if (slip) { m *= 1 + slip / 100; this._slipLeft--; }
        const sw = M?.swapBy?.[hel];   // Ember Heart and the Tower's element boons: the first hits after switching in
        if (sw && this._swapLeft > 0 && this._swapEl === hel) { m *= 1 + sw.bonus; this._swapLeft--; }
        if (M?.stormLens && hel === 'lightning' && enemy?.isSuperConducted && enemy.sprite?.active && !this._critBusy) {
            this.time.delayedCall(0, () => { if (enemy.sprite?.active && enemy.health > 0) { this.applyBurnStack?.(enemy, 1); this.applyChill?.(enemy, 0.3); } });
        }
        // corrupted books (Enchants.js): Twinstrike hits twice, Prism adds another element's touch, Misfire (a curse) misses
        if (!this._critBusy) {
            if (Math.random() < Enchants.twin(w)) m *= 2;
            if (enemy?.sprite && Math.random() < Enchants.prism(w)) {
                const other = ['fire', 'ice', 'lightning'].filter(e => e !== (el || this.currentElement));
                this.time.delayedCall(0, () => this._critEffect(enemy, other[Math.floor(Math.random() * other.length)]));
            }
            if (Math.random() < Enchants.miss(w)) m = 0;
            if (this._mods?.cursedDie) {   // Cursed Die: a d6 a hit; Luck can turn a 1 into a reroll
                let r = 1 + Math.floor(Math.random() * 6);
                if (r === 1 && Math.random() < luck / 40) r = 1 + Math.floor(Math.random() * 6);
                if (r === 1) m = 0; else if (r === 6) m *= 4;
                if ((r === 1 || r === 6) && enemy?.sprite) this._dieFx(enemy.sprite.x + 14, enemy.sprite.y - 22, r);
            }
        }
        return m;
    }
    // ── ULT DAMAGE ──────────────────────────────────────────────────────────────
    // Runs an ult's start with this._ultHit = el, and carries the mark into every timer and tween
    // it creates (and theirs), so its hits deal ult damage however late they land. The parts that
    // run from the frame loop mark themselves (the fire ult's fireballs, the black hole's collapse).
    _asUlt(el, fn) {
        const T = this.time, TW = this.tweens, ad = T.addEvent, dc = T.delayedCall, ta = TW.add, tc = TW.addCounter, scene = this, prev = this._ultHit;
        const wrap = f => typeof f !== 'function' ? f : function (...a) { const p = scene._ultHit; scene._ultHit = el; try { return f.apply(this, a); } finally { scene._ultHit = p; } };
        T.addEvent = cfg => ad.call(T, cfg instanceof Phaser.Time.TimerEvent ? cfg : { ...cfg, callback: wrap(cfg.callback) });
        T.delayedCall = (d, cb, args, sc) => dc.call(T, d, wrap(cb), args, sc);
        TW.add = cfg => ta.call(TW, Array.isArray(cfg) ? cfg : { ...cfg, onUpdate: wrap(cfg.onUpdate), onComplete: wrap(cfg.onComplete), onRepeat: wrap(cfg.onRepeat), onYoyo: wrap(cfg.onYoyo) });
        TW.addCounter = cfg => tc.call(TW, { ...cfg, onUpdate: wrap(cfg.onUpdate), onComplete: wrap(cfg.onComplete) });
        this._ultHit = el;
        try { return fn(); }
        finally { T.addEvent = ad; T.delayedCall = dc; TW.add = ta; TW.addCounter = tc; this._ultHit = prev; }
    }

    // ── LUCK AND CHAOS (Relics.js, the Chaos shelf) ─────────────────────────────
    // Luck: a relic's base, plus (Rabbit's Foot) a point a kill while you go unhit, lost when hit.
    _luckNow() { const M = this._mods; return (M?.luckBase || 0) + (M?.luckGain ? (this._luck || 0) : 0) + (this._luckCrit || 0); }   // + Loaded's (an enchant)
    // a die face popping up where it landed (Cursed Die), so the roll is seen
    _dieFx(x, y, n) {
        const now = this.time.now;
        if (now - (this._dieFxAt || 0) < 350) return;
        this._dieFxAt = now;
        const g = this.add.graphics().setDepth(6).setPosition(x, y);
        g.fillStyle(0x1a1420, 1); g.fillRoundedRect(-8, -8, 16, 16, 3);
        g.fillStyle(n === 6 ? 0xfff6e0 : 0x8a8090, 1); g.fillRoundedRect(-7, -7, 14, 14, 3);
        const pips = n === 6 ? [[-3, -4], [-3, 0], [-3, 4], [3, -4], [3, 0], [3, 4]] : [[0, 0]];
        g.fillStyle(n === 6 ? 0xc8202a : 0x2a1a20, 1); for (const [px, py] of pips) g.fillRect(px - 1, py - 1, 3, 3);
        this.tweens.add({ targets: g, y: y - 18, angle: n === 6 ? 360 : -20, scale: { from: 1.6, to: 1 }, duration: 260, ease: 'Back.easeOut' });
        this.tweens.add({ targets: g, alpha: 0, delay: 500, duration: 250, onComplete: () => g.destroy() });
        if (n === 6) this.showStatusText?.(x, y - 34, 'x4!', '#ffe060');
    }
    // Every frame: the Wheel of Fate spins every 10s and its result runs out.
    _chaosTick(time) {
        const M = this._mods;
        if (!M?.wheel || !this.player?.active || this._deathScreenActive) return;
        if (this._wheelFx && time > this._wheelFx.until) this._wheelFx = null;
        if (time < (this._wheelAt ??= time + 4000)) return;
        this._wheelAt = time + 10000;
        const GOOD = [['dmg', 'DOUBLE DAMAGE', 10000, 0xff6a4a], ['inv', 'UNTOUCHABLE', 3000, 0xfff6c0], ['gem', 'A FULL GEM', 0, 0xd8a8ff], ['speed', 'DOUBLE SPEED', 10000, 0x8af0c8]];
        const BAD = [['weak', 'WEAKENED', 5000, 0x8a8090], ['slow', 'SLUGGISH', 5000, 0x6a7a9a]];
        const bad = Math.random() < Math.max(0.05, 0.25 - this._luckNow() * 0.01);
        const [kind, label, ms, col] = (bad ? BAD : GOOD)[Math.floor(Math.random() * (bad ? BAD : GOOD).length)];
        // the wheel itself, over you: the outcomes flick past and it lands
        const all = [...GOOD, ...BAD], t = this.add.text(this.player.x, this.player.y - 46, '', { fontSize: '12px', fontFamily: 'monospace', fontStyle: 'bold', color: '#ffffff', stroke: '#000', strokeThickness: 3 }).setOrigin(0.5).setDepth(7);
        const ring = this.add.graphics().setDepth(6.9).setPosition(this.player.x, this.player.y - 46);
        ring.lineStyle(3, 0xc87ae0, 0.9); ring.strokeCircle(0, 0, 20); for (let k = 0; k < 6; k++) { const a = k * Math.PI / 3; ring.lineBetween(0, 0, Math.cos(a) * 20, Math.sin(a) * 20); }
        this.tweens.add({ targets: ring, angle: 720, duration: 700, ease: 'Cubic.easeOut' });
        let k = 0;
        const flick = () => {
            if (!t.active) return;
            if (k < 8) { t.setText(all[(k * 5) % all.length][1]).setColor('#c8c8d8'); k++; this.time.delayedCall(60 + k * 12, flick); return; }
            t.setText(label).setColor('#' + col.toString(16).padStart(6, '0'));
            this.tweens.add({ targets: t, scale: { from: 1.6, to: 1 }, duration: 260, ease: 'Back.easeOut' });
            Sfx.play(this, bad ? 'hurt' : 'ult');
            if (kind === 'gem' && this.ultGems) { this.ultGems[this.currentElement] = this.ultChargeMax; this.ultCharge = this.ultChargeMax; this.updateHUD?.(); }
            else this._wheelFx = { kind, until: this.time.now + ms };
            this.tweens.add({ targets: [t, ring], alpha: 0, delay: 900, duration: 300, onComplete: () => { t.destroy(); ring.destroy(); } });
        };
        flick();
    }
    _wheel(kind) { return this._wheelFx?.kind === kind && this.time.now < this._wheelFx.until; }
    // what the wheel does to a step: a move-cooldown multiplier
    _chaosMove() { return this._wheel('speed') ? 0.5 : this._wheel('slow') ? 1.3 : 1; }

    _critEffect(enemy, el) {
        if (!enemy?.sprite?.active || enemy.health <= 0) return;
        this._critBusy = true;
        try {
            if (el === 'fire') this.applyBurnStack?.(enemy, 1);
            else if (el === 'ice') this.applyChill?.(enemy, 0.5);
            else if (el === 'cosmic') this._csHex?.(enemy);
            else if (el === 'lightning') {   // one more jump, to the nearest other enemy within 3 tiles
                const n = (this.enemies || []).filter(e => !this._phasedOut?.(e) && e !== enemy && e.sprite?.active && e.health > 0 && Math.abs(e.x - enemy.x) + Math.abs(e.y - enemy.y) <= 3)
                    .sort((a, b) => (Math.abs(a.x - enemy.x) + Math.abs(a.y - enemy.y)) - (Math.abs(b.x - enemy.x) + Math.abs(b.y - enemy.y)))[0];
                if (n) { this.drawLightningBolt(enemy, n); this.damageEnemy(n, 6 * (this.damageScaling || 1), 'lightning'); }
            }
        } finally { this._critBusy = false; }
    }

    _dmgOutMult(enemy, el = null) {
        return (this._csDmgMult?.(enemy) ?? 1) * (this.statDamageMult ?? 1) * PlayerStats.outMult(this, enemy)   // + Might's talents
            * WeaponLevels.dmgMult(this.equippedWeapons?.[el || this.currentElement])
            * (this._mods?.el?.[el || this.currentElement] ?? 1)   // relics and Tower boons (scene._mods)
            * Enchants.dmgMult(this.equippedWeapons?.[el || this.currentElement], enemy, this)   // the weapon's enchants
            * Relics.vsMult(this._mods, enemy, this, el || this.currentElement)
            * (this._wheel?.('dmg') ? 2 : this._wheel?.('weak') ? 0.8 : 1)
            * (this._ultHit ? (this._mods?.ultDmg ?? 1) * (1 + Enchants.n(this.equippedWeapons?.[this._ultHit], 'devastation') / 100) * (1 + (this._overflowBonus?.[this._ultHit] || 0)) : 1);   // ult damage: relics, boons, books, Overflow (_asUlt marks an ult's hits)   // the Wheel of Fate   // relics and boons that care who's hit (bosses, the burning...)
    }

    // Popped on the enemy when you hit it with something it resists. A number alone is
    // easy to miss mid-fight -- the shield is the thing that tells you, immediately and
    // without reading, that the element in your hand is the wrong one.
    _showResistShield(enemy, res) {
        const now = this.time.now;
        if (now - (enemy._lastResistPop || 0) < 320) return;   // not once per pellet
        enemy._lastResistPop = now;
        Sfx.play(this, 'clink');
        const col = res.color && res.color !== '#ffffff' ? res.color : '#b388ff';
        const tint = parseInt(col.replace('#', ''), 16);
        // a dome of hexagonal facets lighting up round the body, brightest at the middle
        const g = this.add.graphics().setDepth(6).setBlendMode(Phaser.BlendModes.ADD);
        g.x = enemy.sprite.x; g.y = enemy.sprite.y + 10;   // round the body, low in its frame
        const hex = (cx, cy, r, a) => {
            const pts = [];
            for (let k = 0; k < 6; k++) { const t = k / 6 * Math.PI * 2 + Math.PI / 6; pts.push({ x: cx + Math.cos(t) * r, y: cy + Math.sin(t) * r }); }
            g.fillStyle(tint, a * 0.35); g.fillPoints(pts, true);
            g.lineStyle(1.2, tint, a); g.strokePoints(pts, true);
        };
        const r = 5.5, dx = r * Math.sqrt(3), dy = r * 1.5;
        for (let row = -3; row <= 3; row++) for (let q = -3; q <= 3; q++) {
            const cx = q * dx + (row % 2 ? dx / 2 : 0), cy = row * dy * 0.8, d = Math.hypot(cx, cy / 0.8);
            if (d > 22) continue;
            hex(cx, cy, r - 0.8, 1 - d / 26);
        }
        g.setScale(0.8);
        this.tweens.add({ targets: g, scaleX: 1.12, scaleY: 1.12, alpha: 0, duration: 300, ease: 'Quad.easeOut', onComplete: () => g.destroy() });
        this.showStatusText(enemy.sprite.x, enemy.sprite.y - 28, '−' + Math.round((1 - res.mult) * 100) + '%', col);
    }

    _phasedOut(enemy) {
        if (!enemy) return false;
        if (enemy.isVoidSniper && (enemy._inDimension || enemy._sniperInvisible)) return true;
        if (enemy._drownSubmerged) return true;   // Drowner is under the floor mid-attack
        if (enemy._huntPhase === 'gone') return true;   // a Hunter inside its flurry
        if (enemy._isGem) return true;   // the Gem: nothing breaks it but clearing the floor
        if (enemy._shroud && Math.hypot(this.playerX - enemy.x, this.playerY - enemy.y) > enemy._shroudR) return true;   // a Wraith's shroud: untouchable until you're close
        // Displacer capture. Added here rather than at each call site because this helper is
        // already the single gate 17+ damage paths consult -- that was the lesson from the
        // Void Sniper, which was killable while phased because the guard was copied by hand
        // into some paths and not others.
        if (enemy._displacerHeld) return true;
        return false;
    }

    damageEnemy(enemy, damage, element) {
        // Set once this hit actually takes health. Callers that pay their own ult charge (or
        // count a hit for anything) read it: a refused hit used to pay out all the same.
        this._dmgLanded = false;
        // Enemies in rooms the player has not entered cannot be hurt. This used to check
        // isTutorial ALONE, so on every other gated level a projectile could reach through
        // a sealed door and kill a room before you opened it -- Ignition's pellets made
        // that obvious because they travel far and fire ten times a second, but every
        // ranged weapon could do it.
        if (typeof this._roomGated === 'function' && this._roomGated()
            && enemy.tutorialRoomIndex !== undefined) {
            if (enemy.tutorialRoomIndex !== this.getCurrentPlayerRoom()) return;
        }

        // Void snipers invincible while phased out
        if (this._phasedOut(enemy)) {
            if (enemy.sprite?.active && this.time.now - (enemy._phasedAt || 0) > 500) { enemy._phasedAt = this.time.now; this.showStatusText(enemy.sprite.x, enemy.sprite.y - 10, enemy._isGem ? 'UNBREAKABLE' : 'INVISIBLE', enemy._isGem ? '#d8e8ff' : '#9922cc'); }
            return;
        }

        // Dark Matter Fragments — direct health reduction, show number
        if (enemy.isFragment && enemy.sprite?.active) {
            enemy.health -= damage;
            this.showDamageNumber(enemy.sprite.x, enemy.sprite.y - 10, damage, '#cc44ff');
            return;
        }

        // ── ELEMENTAL RESISTANCE ─────────────────────────────────────────────
        // Previously a hard bail-out: `if (enemy.fireImmune || enemy.iceImmune) return;`
        // Immunity could therefore only ever mean 0x, which is why Cosmic's
        // reduced-but-nonzero chip was impossible to express here. ElementResist turns
        // that into a multiplier lookup, so 0x is one row of a table rather than a
        // control-flow shortcut. Fire/ice/lightning numbers are unchanged.
        //
        // Environmental and indirect sources still bypass this function entirely and
        // keep their own escape hatches (lava tiles and burn DoT for fire elementals,
        // shatter-while-frozen for ice elementals).
        const _atkElement = element || this.currentElement || 'physical';
        const _res = ElementResist.resolve(enemy, _atkElement, damage);
        if (this._mods?.pierceRes && _res.mult > 0 && _res.mult < 1) { const m2 = 1 - (1 - _res.mult) / 2; _res.dmg = _res.dmg / _res.mult * m2; _res.mult = m2; }   // Eye of the Storm: resisted hits ignore half the resistance
        if (_res.refused) {
            if (enemy.sprite && enemy.sprite.active) {
                this.showStatusText(enemy.sprite.x, enemy.sprite.y - 10, _res.label, _res.color);
            }
            // Glerp's ice tutorial explanation, on any refused attempt vs ice-immune.
            if (enemy.iceImmune && this.isIceTutorial) {
                this._triggerIceImmuneGlerpReaction();
            }
            return;
        }
        // Ice tutorial: fire barely scratching a fire-resistant slime is Glerp's cue to hand you ice.
        if (this.isIceTutorial && !this.tutorialIceUnlocked && _atkElement === 'fire' && enemy.resistTrait === 'fire') this._triggerIceImmuneGlerpReaction();
        // Kept locally: a shatter triggered further down lands its own (ice) hit and
        // overwrites _lastUltHit before this hit's charge is added.
        const _ultReact = this._noteUltHit(enemy, _atkElement);
        // A reduced hit is NOT a refusal. Cosmic lands here against a resistant enemy
        // with mult 0.50, and against a normal one with 0.70.
        // BRITTLE applies here too. damageEnemy resolves the table itself rather than going
        // through resolveElementalHit, so it is the SECOND choke point -- and it is the one the
        // non-elemental paths use (melee, splash, collision), which is exactly the "from every
        // source" part of brittle. Missing it would have made brittle an elemental-only buff.
        damage = _res.dmg * (enemy._deepFrozen && enemy.isFrozen ? 1 : this._brittleMult(enemy, _atkElement));   // (a deep freeze's bonus is tsunamiBonus, below)
        this._cubeNote(enemy, _atkElement, damage * (enemy._deepFrozen && enemy.isFrozen ? this._brittleMult(enemy, _atkElement) : 1));
        // Surface the reduction only on an actually RESISTANT target. Gating on
        // `mult < 1` instead would fire on every single cosmic hit, since cosmic's
        // 0.70x baseline against normal enemies is its resting state rather than an
        // event worth a floating label — that reads as spam and teaches nothing.
        // The same shield flash and readout as resolveElementalHit, so both paths look alike.
        if (_res.mult > 0 && _res.mult < 1 && _res.profile !== ElementResist.TABLE.none && _atkElement !== 'cosmic'   // (nothing resists cosmic)
            && enemy.sprite && enemy.sprite.active) {
            this._showResistShield(enemy, _res);
        }

        const deep = enemy._deepFrozen && enemy.isFrozen;   // the ice ult's Deep Freeze holds until the ult shatters it
        const tsunamiBonus = deep ? this._brittleMult(enemy, _atkElement) : 1;
        const frozenBonus  = enemy.isFrozen && !deep ? 2.5 : 1;
        const purpleBonus  = enemy._purpleMarked ? 1.5 : 1;   // x1.5 on every source now (was x2 here only)
        if (enemy.isFrozen && !deep) {
            // Clear freeze visuals immediately on any hit while frozen
            if (enemy.freezeVisuals) {
                if (enemy.freezeVisuals._extraLayers) {
                    for (const l of enemy.freezeVisuals._extraLayers) { this.tweens.killTweensOf(l); l.destroy(); }
                }
                if (enemy.freezeVisuals.iceBlock)  { this.tweens.killTweensOf(enemy.freezeVisuals.iceBlock);  enemy.freezeVisuals.iceBlock.destroy(); }
                if (enemy.freezeVisuals.iceBorder) { this.tweens.killTweensOf(enemy.freezeVisuals.iceBorder); enemy.freezeVisuals.iceBorder.destroy(); }
                enemy.freezeVisuals = null;
            }
            if (enemy._thawTimer) { enemy._thawTimer.remove(); enemy._thawTimer = null; }
            this._triggerShatterBurst(enemy);
            // The shatter can kill it. Carrying on landed this hit on a dead enemy and called
            // killEnemy a second time (a second drop roll, a second death).
            if (enemy.health <= 0 || !enemy.sprite?.active) return;
        }
        const toughnessMult = (enemy._absorberToughnessMult && enemy._absorberBuffUntil > this.time.now)
            ? 1 / enemy._absorberToughnessMult : 1;
        const actualDamage = this._dmgNote(enemy, _atkElement, this._specialHit(enemy, this._afterHit(enemy, _atkElement, damage * tsunamiBonus * frozenBonus * purpleBonus * toughnessMult * this._dmgOutMult(enemy, _atkElement) * this._hitRoll(enemy, _atkElement)), _atkElement));   // (_dmgNote: Hex's share for the number)
        enemy.health -= actualDamage;
        enemy._hurtAt = this.time.now;   // a Budding Slime's clock
        enemy._lastEl = _atkElement; enemy._lastResisted = _res.mult < 1 && _res.profile !== ElementResist.TABLE.none && _atkElement !== 'cosmic';   // what killed it, for the achievements (cosmic's 0.7 on anyone isn't resisting)
        this._tallyDamage(_atkElement, actualDamage);
        this._dmgLanded = !enemy._noUlt;   // (spawners and what they spawn pay no ult charge: callers that pay their own read this)
        this._csOnHit?.(enemy, _atkElement);   // Cosmic.js: Ascend marks every hit

        // Gain ult charge on hit (skip for lightning to prevent chain spam). By the hit's
        // element, like everything below: the held one only for untyped hits.
        if (_atkElement !== 'lightning' && !enemy._noUlt) {   // no farming spawners (Budding Slimes, a Queen's brood)
            this.gainUltCharge(this.ultChargePerHit, _atkElement, false, _ultReact);
        }

        // Show damage number
        if (enemy.sprite && enemy.sprite.active) {
            const color = _atkElement === 'fire' ? '#ff8800'
                : _atkElement === 'ice' ? '#88eeff'
                : _atkElement === 'lightning' ? '#ffff44'
                : '#cc99ff';
            this.showDamageNumber(enemy.sprite.x, enemy.sprite.y, actualDamage, color);
        }

        // A fire hit used to start a second, separate burn here (unless the Magma Staff happened
        // to be equipped). The burn is one system now and the sources that burn add its stacks
        // themselves (WeaponSystem.applyBurnStack), so Ignition's pellets, for one, don't.

        if (_atkElement === 'ice' && enemy.health > 0) {
            const wasAlreadySlowed = enemy.isSlowed;
            enemy.isSlowed = true;
            enemy.slowedUntil = this.time.now + this.slowDuration;
            if (!wasAlreadySlowed && enemy.sprite && enemy.sprite.active) {
                this.showStatusText(enemy.sprite.x, enemy.sprite.y, 'SLOWED', '#44ccff');
                // Start slow indicator arrows — stop when isSlowed expires
                if (enemy._slowIndTimer) { enemy._slowIndTimer.remove(); enemy._slowIndTimer = null; }
                enemy._slowIndTimer = this._startSpeedIndicator(
                    () => enemy.sprite?.active ? { x: enemy.sprite.x, y: enemy.sprite.y - 10 } : null,
                    'slow_ice', 320
                );
            }

            // A free 2-second hard STUN on 15% of ice hits, from long before the rework. Kept as
            // a cube: a random chance of brittle fits "ice sets up damage", a random stun does not.
            if (Math.random() < 0.15 && !enemy._iceCube) {
                this.makeIceCube(enemy, 2000);
            }

            this.updateSlowEffect(enemy);
        }

        if (enemy.isFrozen) {
            enemy.health -= actualDamage * 0.5;
        }

        const flashColor = _atkElement === 'ice' ? 0x9ff0ff : 0xffffff;
        if (!this._noFlash) enemy.sprite.setTintFill(flashColor);   // a real flash (setTint(0xffffff) changed nothing); steady ticks skip it
        this._vfxHit?.(enemy, actualDamage, _atkElement);
        if (!this._noFlash) this.time.delayedCall(70, () => {
            if (enemy.sprite && enemy.sprite.active) {
                if (enemy.isFrozen) {
                    enemy.sprite.setTint(0x88ccff);
                } else if ((enemy.burnStacks || 0) > 0) {
                    CreatureFX.tintOver(enemy.sprite, 0xff6600);
                } else {
                    enemy.sprite.clearTint();
                }
            }
        });

        this.updateEnemyHealthBar(enemy);

        if (enemy.health <= 0) {
            this.killEnemy(enemy);
        }
    }

    killEnemy(enemy) {
        if (enemy?._trainImmortal && enemy.sprite?.active) { enemy.health = enemy.maxHealth; this.updateEnemyHealthBar?.(enemy); return; }   // Training.js: a dummy fills back up instead
        if (enemy?._isFrost && this._frostEncase?.(enemy)) return;   // LevelManager: a frost slime's first death is a statue
        if (enemy?._isEncased && this._encEncase?.(enemy)) return;   // LevelManager: an Encased Slime's first death is its stone
        if (enemy?._isEncased) this._encCleanup?.(enemy);   // its stone, its rubble: gone with it
        if (enemy?._isGem && enemy.sprite?.active) return;   // the Gem only breaks when the floor's clear (LevelManager._gemShatter)
        if (enemy?._isLeech) this._leechDie(enemy);   // what it stole comes back
        if (enemy && !enemy._achCounted) { enemy._achCounted = true; Achievements.onKill(this, enemy); }
        if (enemy) for (const k of ['_budRing', '_armorGfx', '_huntMark', '_shadeAura', '_plateBar', '_leechRing', '_leechMark', '_diverTell', '_leechIcon', '_leechGlow', '_tideAura', '_gemBody', '_gemGlow']) { if (enemy[k]?.active) { this.tweens.killTweensOf(enemy[k]); enemy[k].destroy(); } enemy[k] = null; }   // what the newer slimes draw round themselves
        const _leech = this._mods?.leech;   // relics and Tower boons: kills heal
        const _con = Enchants.n(this.equippedWeapons?.[this.currentElement], 'contagion') / 100;   // Contagion: its burn and chill move on
        if (_con && enemy && !enemy._spread && ((enemy.burnStacks || 0) > 0 || (enemy.chillStacks || 0) > 0) && this.enemies) {
            enemy._spread = true;
            const b = Math.ceil((enemy.burnStacks || 0) * _con), c = (enemy.chillStacks || 0) * _con;
            const next = this.enemies.filter(n => !this._phasedOut?.(n) && n !== enemy && n.sprite?.active && n.health > 0 && Math.abs(n.x - enemy.x) + Math.abs(n.y - enemy.y) <= 3)
                .sort((a, z) => Math.abs(a.x - enemy.x) + Math.abs(a.y - enemy.y) - Math.abs(z.x - enemy.x) - Math.abs(z.y - enemy.y))[0];
            if (next) this.time.delayedCall(0, () => { if (!next.sprite?.active) return; if (b) this.applyBurnStack?.(next, b); if (c) this.addChillStacks?.(next, c); });
        }
        if (enemy && !enemy._chaosCounted && this._mods) {
            enemy._chaosCounted = true;
            if (this._mods.luckGain) this._luck = Math.min(20, (this._luck || 0) + 1);   // Rabbit's Foot
            if (this._mods.jackpot && this.ultGems && Math.random() < this._mods.jackpot * (1 + this._luckNow() / 10)) {   // Jackpot
                const els = Object.keys(this.ultGems), g = els[Math.floor(Math.random() * els.length)];
                this.ultGems[g] = this.ultChargeMax; this.updateHUD?.();
                if (enemy.sprite) this.showStatusText(enemy.sprite.x, enemy.sprite.y - 30, `JACKPOT: ${g.toUpperCase()} FULL!`, '#ffe060');
                Sfx.play(this, 'fanfare'); this.cameras.main.flash(180, 255, 220, 120);
            }
        }
        if (this._mods?.killGem && enemy && !enemy._gemCounted && this.ultGems) {   // Event Horizon: every nth kill, a shard of a random gem
            enemy._gemCounted = true;
            this._killTally = (this._killTally || 0) + 1;
            if (this._killTally % this._mods.killGem === 0) {
                const els = Object.keys(this.ultGems), g = els[Math.floor(Math.random() * els.length)];
                this.gainUltCharge(this.ultChargeMax * 0.2, g, true);
                if (enemy.sprite) this.showStatusText(enemy.sprite.x, enemy.sprite.y - 26, `+${g.toUpperCase()} SHARD`, '#d8b8ff');
            }
        }
        // shortcut: the enchants read the weapon you hold, not the one that landed the kill (close enough: you mostly kill with what you hold)
        const _held = this.equippedWeapons?.[this.currentElement], _vamp = Enchants.leech(_held), _boom = Enchants.volatile(_held) + (this._mods?.boom || 0);
        if ((_leech || _vamp) && enemy && !enemy._leeched) { enemy._leeched = true; this.health = Math.min(this.maxHealth, this.health + (_leech || 0) + _vamp); }
        if (_boom && enemy?.sprite && enemy.health <= 0 && !enemy._burst) {   // Volatile: the kill bursts on what's close (and can chain)
            enemy._burst = true;
            const bx = enemy.x, by = enemy.y, px = enemy.sprite.x, py = enemy.sprite.y, el = this.currentElement;
            this.time.delayedCall(60, () => {
                if (!this.enemies) return;
                this._vfxFlash?.(px, py, 40, 0xffb84a, 220, 0.8);
                for (const n of [...this.enemies]) if (n !== enemy && n.sprite?.active && n.health > 0 && !this._phasedOut(n) && Math.abs(n.x - bx) <= 1 && Math.abs(n.y - by) <= 1) this.damageEnemy(n, _boom * (this.damageScaling || 1), el);
            });
        }
        // Cistern marks hang off the enemy, and the splice below makes it unreachable
        // from this.enemies, so they have to be released here -- ahead of the early
        // return under it, or a death during the death screen still orphans them.
        if (typeof this._clearCisternGfx === 'function') this._clearCisternGfx(enemy);

        // Don't process kills after the player has already died
        if (this._deathScreenActive) {
            // Just clean up the sprite silently
            if (enemy._ultAbsorberRotTimer) { enemy._ultAbsorberRotTimer.remove(); enemy._ultAbsorberRotTimer = null; }
            if (enemy._ultAbsorberAura)  { this.tweens.killTweensOf(enemy._ultAbsorberAura);  enemy._ultAbsorberAura.destroy();  }
            if (enemy._ultAbsorberMark)  { enemy._ultAbsorberMark.destroy(); }
            if (enemy._drainBeam)        { enemy._drainBeam.clear(); enemy._drainBeam.destroy(); enemy._drainBeam = null; }
        if (enemy._absGlow)          { enemy._absGlow.destroy(); enemy._absGlow = null; }
            if (enemy._absGlow)          { enemy._absGlow.destroy(); enemy._absGlow = null; }
            if (enemy._absorberBuffAura) { this.tweens.killTweensOf(enemy._absorberBuffAura); enemy._absorberBuffAura.destroy(); enemy._absorberBuffAura = null; }
            if (enemy.sprite) enemy.sprite.destroy();
            const idx = this.enemies.indexOf(enemy);
            if (idx !== -1) this.enemies.splice(idx, 1);
            return;
        }
        this._vfxDeath?.(enemy);
        if (this._runStats) this._runStats.kills++;
        if (this.towerRun) TowerFloors.onKill?.(this, enemy);   // Tower.js: its coins fly to your counter, now and then a seed or a book
        PlayerStats.onKill(this, enemy);   // Bloodrush, Feast, Overflow
        // Tutorial: give bonus ult charge per kill so player sees the bar fill
        if (this.isTutorial) {
            this.gainUltCharge(20, null, true);   // a fifth of the held element's gem, flat
        }
        // Scrap drop. This gate is the whole Engineering Degree problem in three lines: it
        // required lightning to be the ACTIVE element, so the only way to fund the towers
        // was to play a weapon whose basic attack does 2 damage. You paid for the support
        // kit in the currency of being weak, for as long as it took.
        //
        // Now the drop only asks that Engineering Degree occupy the lightning SLOT. Kill
        // things with fire, ice, cosmic, whatever you like -- the scraps accumulate anyway
        // and persist across levels, and you switch to the wrench when you want to spend
        // them. Actually wielding it still pays noticeably better, so the weapon has a
        // reason to come out beyond being a bank.
        // One optional call, not three bare ones. The old shape guarded only _engDegSlotted
        // and then called this._scrapCfg() and this._engDegWielding() unguarded inside the
        // block -- safe on TowerDefenseScene only because the guard happened to be falsy
        // there. That is accidentally safe, not provably safe, and a static closure check
        // cannot tell the difference. Collapsing it into one guarded entry point means a
        // scene either has the scrap economy or cleanly does not.
        this._maybeDropScrap?.(enemy);
        // ── Absorber visual cleanup ──
        if (enemy._ultAbsorberRotTimer) { enemy._ultAbsorberRotTimer.remove(); enemy._ultAbsorberRotTimer = null; }
        if (enemy._ultAbsorberAura)  { this.tweens.killTweensOf(enemy._ultAbsorberAura);  enemy._ultAbsorberAura.destroy();  enemy._ultAbsorberAura  = null; }
        if (enemy._ultAbsorberMark)  { this.tweens.killTweensOf(enemy._ultAbsorberMark);  enemy._ultAbsorberMark.destroy();  enemy._ultAbsorberMark  = null; }
        if (enemy._drainBeam)        { enemy._drainBeam.clear(); enemy._drainBeam.destroy(); enemy._drainBeam = null; }
        if (enemy._absorberBuffAura) { this.tweens.killTweensOf(enemy._absorberBuffAura); enemy._absorberBuffAura.destroy(); enemy._absorberBuffAura = null; }
        if (enemy._toughnessShieldMark) { this.tweens.killTweensOf(enemy._toughnessShieldMark); enemy._toughnessShieldMark.destroy(); enemy._toughnessShieldMark = null; }
        if (enemy._shatterMarkVisual){ this.tweens.killTweensOf(enemy._shatterMarkVisual); enemy._shatterMarkVisual.destroy(); enemy._shatterMarkVisual = null; }
        if (enemy._shatterMarkTimer) { enemy._shatterMarkTimer.remove(); enemy._shatterMarkTimer = null; }
        if (enemy._shieldMark && enemy._shieldMark.active) {
            this.tweens.killTweensOf(enemy._shieldMark);
            enemy._shieldMark.destroy();
        }
        // Clean up fire immune mark
        // Ice cube state. killEnemy already disposes of freezeVisuals further down, but the cube
        // FLAGS and its self-shatter timer are separate -- left behind, the timer fires on a
        // corpse and the brittle multiplier lingers on a recycled enemy object.
        if (enemy._decayBar) { enemy._decayBar.destroy(); enemy._decayBar = null; }   // its decay piece (Visuals.js never sees it again: it's out of this.enemies)
        enemy._decayOwed = 0;
        if (enemy._iceCube || enemy._iceCubeTimer) {
            enemy._iceCube = false;
            enemy._brittle = 1;
            enemy._iceCubeUntil = 0;
            if (enemy._iceCubeTimer) { enemy._iceCubeTimer.remove(); enemy._iceCubeTimer = null; }
            enemy._iceCubeGfx = null;
            this._setSpeedIndicator?.(enemy, 'icecube', 'slow_ice', false);
        }
        if (enemy._resistMark && enemy._resistMark.active) {
            this.tweens.killTweensOf(enemy._resistMark);
            enemy._resistMark.destroy();
            enemy._resistMark = null;
        }
        if (enemy._fireMark && enemy._fireMark.active) {
            this.tweens.killTweensOf(enemy._fireMark);
            enemy._fireMark.destroy();
        }
        // Clean up inhibitor visuals if present
        if (enemy._inhibitRing && enemy._inhibitRing.active) {
            this.tweens.killTweensOf(enemy._inhibitRing);
            enemy._inhibitRing.destroy();
        }
        if (enemy._inhibitMark && enemy._inhibitMark.active) {
            this.tweens.killTweensOf(enemy._inhibitMark);
            enemy._inhibitMark.destroy();
        }
        if (enemy._iceMark && enemy._iceMark.active) {
            this.tweens.killTweensOf(enemy._iceMark);
            enemy._iceMark.destroy();
        }
        // Level 3 mark cleanup
        if (enemy._lightningMark && enemy._lightningMark.active) {
            this.tweens.killTweensOf(enemy._lightningMark);
            enemy._lightningMark.destroy();
            enemy._lightningMark = null;
        }
        if (enemy._arcRangeRing && enemy._arcRangeRing.active) {
            this.tweens.killTweensOf(enemy._arcRangeRing);
            enemy._arcRangeRing.destroy();
            enemy._arcRangeRing = null;
        }
        if (enemy._slowIndTimer)  { enemy._slowIndTimer.remove();  enemy._slowIndTimer  = null; }
        if (enemy._speedIndTimer) { enemy._speedIndTimer.remove(); enemy._speedIndTimer = null; }
        // Level 4 visual cleanup
        if (enemy._mortarGfx?.active)     { this.tweens.killTweensOf(enemy._mortarGfx);     enemy._mortarGfx.destroy();     enemy._mortarGfx = null; }
        if (enemy._mortarSafeRing?.active) { this.tweens.killTweensOf(enemy._mortarSafeRing); enemy._mortarSafeRing.destroy(); enemy._mortarSafeRing = null; }
        if (enemy._rooterMark?.active)    { this.tweens.killTweensOf(enemy._rooterMark);    enemy._rooterMark.destroy();    enemy._rooterMark = null; }
        if (enemy._anchorRing?.active)    { this.tweens.killTweensOf(enemy._anchorRing);    enemy._anchorRing.destroy();    enemy._anchorRing = null; }
        if (enemy._anchorBodyGfx?.active) { this.tweens.killTweensOf(enemy._anchorBodyGfx); enemy._anchorBodyGfx.destroy(); enemy._anchorBodyGfx = null; }
        if (enemy._healerAura?.active)    { this.tweens.killTweensOf(enemy._healerAura);    enemy._healerAura.destroy();    enemy._healerAura = null; }
        if (enemy._totemGfx?.active)      { this.tweens.killTweensOf(enemy._totemGfx);      enemy._totemGfx.destroy();      enemy._totemGfx = null; }
        if (enemy._orbGlow?.active)       { this.tweens.killTweensOf(enemy._orbGlow);       enemy._orbGlow.destroy();       enemy._orbGlow = null; }
        if (enemy._particleTimer)         { enemy._particleTimer.remove(); enemy._particleTimer = null; }
        if (enemy._splitterMark?.active)  { this.tweens.killTweensOf(enemy._splitterMark);  enemy._splitterMark.destroy();  enemy._splitterMark = null; }
        if (enemy._sniperMark?.active)    { this.tweens.killTweensOf(enemy._sniperMark);    enemy._sniperMark.destroy();    enemy._sniperMark = null; }
        if (enemy._singMark?.active)      { this.tweens.killTweensOf(enemy._singMark);      enemy._singMark.destroy();      enemy._singMark = null; }
        // Splitter — spawn children before removing from scene
        if (enemy.isSplitter && typeof this._triggerSplitterDeath === 'function') {
            this._triggerSplitterDeath(enemy);
        }
        if (enemy._voidMark && enemy._voidMark.active) {
            this.tweens.killTweensOf(enemy._voidMark);
            enemy._voidMark.destroy();
            enemy._voidMark = null;
        }
        if (enemy._sniperChargeGfx && enemy._sniperChargeGfx.active) {
            this.tweens.killTweensOf(enemy._sniperChargeGfx);
            enemy._sniperChargeGfx.destroy();
            enemy._sniperChargeGfx = null;
        }
        if (enemy._berserkerMark && enemy._berserkerMark.active) {
            this.tweens.killTweensOf(enemy._berserkerMark);
            enemy._berserkerMark.destroy();
            enemy._berserkerMark = null;
        }
        // Clean up ranged enemy visuals
        this._destroyPrefireBeam(enemy);
        // Cancel scheduled natural-melt water tile if enemy dies before it fires
        if (enemy._freezeMeltTimer) { enemy._freezeMeltTimer.remove(); enemy._freezeMeltTimer = null; }
        this._destroyChillIndicator(enemy);
        if (typeof this._clearStunIndicator === 'function') this._clearStunIndicator(enemy);
        if (enemy._rangedMark && enemy._rangedMark.active) {
            this.tweens.killTweensOf(enemy._rangedMark);
            enemy._rangedMark.destroy();
        }
        // Clean up electrical enemy aura
        if (enemy._electricalAuraTimer) { enemy._electricalAuraTimer.remove(); enemy._electricalAuraTimer = null; }
        if (enemy._electricalAura?.active) { enemy._electricalAura.destroy(); }
        // COSMIC: 50% chance to drop charge
        if (this.currentElement === 'cosmic' && Math.random() < this.cosmicDropChance) {
            this.addCosmicCharge(enemy.sprite.x, enemy.sprite.y);
        }
        // Small chance to drop glorps or health pot
        this.tryDropFromEnemy(enemy);

        if (enemy.sprite) enemy.sprite.destroy();
        if (enemy.healthBarBg) enemy.healthBarBg.destroy();
        if (enemy.healthBarFill) enemy.healthBarFill.destroy();
        this.clearBurnVisual(enemy);

        if (enemy.freezeVisuals) {
            if (enemy.freezeVisuals._extraLayers) {
                for (const l of enemy.freezeVisuals._extraLayers) { this.tweens.killTweensOf(l); l.destroy(); }
            }
            if (enemy.freezeVisuals.iceBlock) {
                this.tweens.killTweensOf(enemy.freezeVisuals.iceBlock);
                enemy.freezeVisuals.iceBlock.setVisible(false);
                enemy.freezeVisuals.iceBlock.destroy();
            }
            if (enemy.freezeVisuals.iceBorder) {
                this.tweens.killTweensOf(enemy.freezeVisuals.iceBorder);
                enemy.freezeVisuals.iceBorder.setVisible(false);
                enemy.freezeVisuals.iceBorder.destroy();
            }
            enemy.freezeVisuals = null;
        }
        if (enemy.brittleVisual) {
            this.tweens.killTweensOf(enemy.brittleVisual);
            enemy.brittleVisual.destroy();
            enemy.brittleVisual = null;
        }
        enemy.brittleStacks = 0;

        if (enemy._tsunamiMultText) { enemy._tsunamiMultText.destroy(); enemy._tsunamiMultText = null; }
        const tfi = this.tsunamiFrozenEnemies.indexOf(enemy);
        if (tfi > -1) this.tsunamiFrozenEnemies.splice(tfi, 1);
        delete enemy._bhOrbitAngle;
        delete enemy._bhOrbitRadius;
        if (enemy.isSuperConducted) this.clearSuperConduct(enemy);

        // Remove from all active projectile hit sets so they can hit the tile again
        for (const fb of this.fireballs) {
            if (fb.piercedEnemies) fb.piercedEnemies.delete(enemy);
        }
        for (const s of this.iceShards) {
            if (s.hitEnemies) s.hitEnemies.delete(enemy);
        }

        // COSMIC MARKS CLEANUP (make sure this is here!)
        if (enemy.cosmicMarkVisuals) {
            enemy.cosmicMarkVisuals.forEach(v => {
                this.tweens.killTweensOf(v);
                v.destroy();
            });
            enemy.cosmicMarkVisuals = null; // Set to null after destroying
        }

        // Burn stack cleanup
        if (enemy._burnDoTTimer) { enemy._burnDoTTimer.remove(); enemy._burnDoTTimer = null; }
        if (enemy._burnStackBar) {
            for (const pip of enemy._burnStackBar) { this.tweens.killTweensOf(pip); pip.destroy(); }
            enemy._burnStackBar = null;
        }
        enemy.burnStacks = 0;
        // Shatter / purple mark cleanup
        if (enemy._shatterMarkTimer)  { enemy._shatterMarkTimer.remove();  enemy._shatterMarkTimer  = null; }
        if (enemy._purpleMarkTimer)   { enemy._purpleMarkTimer.remove();   enemy._purpleMarkTimer   = null; }
        if (enemy._shatterMarkVisual) { this.tweens.killTweensOf(enemy._shatterMarkVisual); enemy._shatterMarkVisual.destroy(); enemy._shatterMarkVisual = null; }
        enemy._shatterMarked = false;
        enemy._purpleMarked  = false;
        // Recalculate magma staff fireball count after this enemy is removed
        if (typeof this._recalcMagmaFireballCount === 'function') {
            this._recalcMagmaFireballCount();
        } else {
            let max = 0;
            for (const e of this.enemies) { if (e !== enemy && e.sprite?.active) max = Math.max(max, e.burnStacks || 0); }
            this._magmaStaffFireballCount = max > 0 ? max : undefined;
        }

        const index = this.enemies.indexOf(enemy);
        if (index > -1) {
            this.enemies.splice(index, 1);
        }
    }

    // ── ALLIES AND TAUNT ─────────────────────────────────────────────────────
    // Allies (the Decoy Slime now; voidlets and wisps later) pull the
    // regular enemies within their `taunt` radius onto themselves; everyone else keeps
    // chasing you, and bosses ignore allies. The regular enemies' turn (EnemyManager.
    // moveEnemies) runs between _tauntBegin and _tauntEnd: for that one enemy, the nearest
    // ally pulling it stands in for you (playerX/playerY), and takeDamage lands on the ally.
    // An ally: { x, y (tiles), hp, taunt (tiles), until (ms), hurt(amount), onEnd() }.
    _addAlly(a) {
        if (!this.allies) this.allies = [];
        const ally = Object.assign({ alive: true }, a);
        this.allies.push(ally);
        return ally;
    }
    _tauntBegin(enemy) {
        const A = this.allies;
        if (!A?.length || !enemy || enemy.isBoss) return null;
        let best = null, bd = Infinity;
        for (const a of A) {
            if (!a.alive) continue;
            const d = Math.hypot(enemy.x - a.x, enemy.y - a.y);
            if (d <= a.taunt && d < bd) { bd = d; best = a; }
        }
        if (!best) return null;
        const real = { x: this.playerX, y: this.playerY };
        this._tauntReal = real;
        this._tauntAlly = best;
        this.playerX = best.x; this.playerY = best.y;
        return real;
    }
    _tauntEnd(real) {
        if (!real) return;
        this.playerX = real.x; this.playerY = real.y;
        this._tauntReal = null; this._tauntAlly = null;
    }
    // While an enemy is taunted, your real tile is still occupied.
    _tauntBlocks(x, y) { return !!this._tauntReal && x === this._tauntReal.x && y === this._tauntReal.y; }
    // Every frame: allies that ran out of time or health end.
    _updateAllies(time) {
        const A = this.allies;
        if (!A?.length) return;
        for (const a of [...A]) {
            if (a.alive && time < a.until && a.hp > 0) continue;
            a.alive = false;
            A.splice(A.indexOf(a), 1);
            a.onEnd?.(a);
        }
    }

    // The Icicle Cannon's Frost Shield (5s, raised with a full charge on R): 35% less damage,
    // and every hit you take chills back whoever dealt it, or everything within 2 tiles when
    // the hit came from range. No cooldown beyond the 28 hits that charge it.
    // The Frost Shield, seen: a dome of ice around you while it lasts. Hexagonal facets in a ring, a pale
    // shell with a bright rim catching the light, frost motes drifting off it. A hit flashes it and cracks it a
    // little; it flickers in its last second and shatters into shards when it ends.
    _frostShieldFx() {
        this._frostShieldG?.destroy();
        const g = this._frostShieldG = this.add.graphics(), T0 = this.time.now;
        this._frostShieldHits = 0;
        const tick = () => {
            const p = this.player, left = (this._frostShieldUntil || 0) - this.time.now;
            if (!p?.active || !g.active || left <= 0) {
                this.events.off('update', tick);
                if (g.active) { const x = g.x, y = g.y; g.destroy(); if (p?.active) for (let k = 0; k < 10; k++) { const a = k / 10 * Math.PI * 2, s = this.add.triangle(x, y, 0, 6, 2, 0, 4, 6, 0xd8f4ff).setDepth(p.depth + 0.1); this.tweens.add({ targets: s, x: x + Math.cos(a) * 30, y: y + Math.sin(a) * 22 + 10, angle: 200, alpha: 0, duration: 450, onComplete: () => s.destroy() }); } Sfx.play(this, 'kill'); }
                return;
            }
            const t = this.time.now, R = this.TILE_SIZE * 0.95, fade = Math.min(1, (t - T0) / 160) * (left < 1000 ? 0.45 + 0.55 * (Math.floor(t / 90) % 2) : 1), hit = Math.max(0, 1 - (t - (this._frostShieldHitAt || 0)) / 260);
            g.setPosition(p.x, p.y + this.TILE_SIZE * 0.12).setDepth(p.depth + 0.05).clear().setBlendMode(Phaser.BlendModes.ADD);
            VisualFX.forceField(g, { col: 0x3a98e8, rim: 0x9ad8ff, R, t: t - T0, fade, hit, hitA: this._frostShieldHitA ?? -Math.PI / 2 });
            for (let c = 0; c < Math.min(4, this._frostShieldHits); c++) { const a = c * 1.9 + 0.4; g.lineStyle(1.2, 0xffffff, 0.6 * fade); g.lineBetween(Math.cos(a) * R * 0.95, Math.sin(a) * R * 0.8, Math.cos(a + 0.3) * R * 0.6, Math.sin(a + 0.3) * R * 0.5); }   // cracks, one a hit
            if (Math.random() < 0.15) { const a = Math.random() * Math.PI * 2, m = this.add.rectangle(p.x + Math.cos(a) * R, p.y + Math.sin(a) * R * 0.85, 2, 2, 0xffffff).setDepth(p.depth + 0.1); this.tweens.add({ targets: m, y: m.y - 10, alpha: 0, duration: 600, onComplete: () => m.destroy() }); }   // frost motes
        };
        this.events.on('update', tick); this.events.once('shutdown', () => this.events.off('update', tick));
        tick();
    }
    _frostShieldHit(amount) {
        this._frostShieldHitAt = this.time.now; this._frostShieldHits = (this._frostShieldHits || 0) + 1;
        const src = this._hitBy?.sprite; this._frostShieldHitA = src && this.player ? Math.atan2(src.y - this.player.y, src.x - this.player.x) : -Math.PI / 2;   // where the ripple starts
        const near = this._hitBy ? [this._hitBy]
            : (this.enemies || []).filter(e => e.sprite?.active && Math.hypot(e.x - this.playerX, e.y - this.playerY) <= 2);
        for (const e of near) this.addChillStacks(e, 1);
        if (this.player?.active) this._vfxBursts?.ice?.explode(8, this.player.x, this.player.y);
        return amount * 0.65;
    }

    takeDamage(amount) {
        // A taunted enemy's hit lands on the ally it's attacking, not you (_tauntBegin).
        if (this._tauntAlly) { this._tauntAlly.hurt?.(amount); return; }
        this._lastCombatAt = this.time.now;   // being hit is fighting too (combat time, _tickRunStats)
        if ((this._hitBy?._tideUntil || 0) > this.time.now) amount *= this._hitBy._tideMult;   // standing in water by a Tidecaller
        if (this.time.now < (this._frostShieldUntil || 0)) amount = this._frostShieldHit(amount);
        if (this._cs && this.time.now < this._cs.horizonUntil) { const src = this._hitBy?.sprite; this._cs.horizonHitAt = this.time.now; this._cs.horizonHitA = src && this.player ? Math.atan2(src.y - this.player.y, src.x - this.player.x) : -Math.PI / 2; }   // the Event Horizon ripples where it's hit
        // Mid-dash: the hit passes through you (ElementSystem.playerDash).
        if (this.time.now < (this._dashInvulnUntil || 0)) return;
        if (this._wheel?.('inv')) return;   // the Wheel of Fate: untouchable
        // Untargetable during Thunderhead or Lightning Ult (Fork)
        if (this.thunderheadActive || this.lightningUltInvuln) {
            const ix = this._scrX(this.player.x);
            const iy = this._scrY(this.player.y);
            const txt = this.add.text(ix, iy - 20, 'IMMUNE', {
                fontSize: '14px', fontFamily: 'monospace',
                color: '#ffff88', stroke: '#000000', strokeThickness: 3, fontStyle: 'bold'
            }).setOrigin(0.5).setScrollFactor(0).setDepth(20);
            this.tweens.add({ targets: txt, y: txt.y - 20, alpha: 0, duration: 600, ease: 'Quad.easeOut', onComplete: () => txt.destroy() });
            return;
        }

        // damageReductionMultiplier is Cosmic.js' (rewritten every frame); armor (Stats.js) is its own.
        // Then the armor talents (Stats.js): Aegis can absorb it outright.
        if (this.time.now < (this._iceFrostUntil || 0)) amount *= this._iceFrostCfg?.().TAKEN ?? 2;
        if (this.time.now < (this._absHexUntil || 0)) amount *= 1.5;   // an Ult Absorber's Hex   // the ice ult: this cold, you're fragile
        const actualDamage = PlayerStats.hurt(this, amount * this.damageReductionMultiplier * (this.statTakenMult ?? 1) * Enchants.taken(this.equippedWeapons?.[this.currentElement]));   // Bulwark: the weapon you hold
        if (actualDamage <= 0) return;
        this._hurtTotal = (this._hurtTotal || 0) + actualDamage;   // a Tower floor without a scratch (Achievements.onFloor)
        if (this._luckCrit) { this._luckCrit = 0; if (!this._mods?.luckGain || !this._luck) this.showStatusText?.(this.player.x, this.player.y - 40, 'LUCK LOST', '#8a9a8a'); }
        if (this._mods?.luckGain && this._luck) { this._luck = 0; this.showStatusText?.(this.player.x, this.player.y - 40, 'LUCK LOST', '#8a9a8a'); }
        // Phantom Step (a relic): hit while above 90% HP, you blink a tile away (once a second at most)
        if (this._mods?.blink && this.health >= this.maxHealth * 0.9 && this.time.now - (this._blinkAt || 0) > 1000 && this.player?.active) {
            const T = this.TILE_SIZE, spots = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [-1, -1], [1, -1], [-1, 1]]
                .map(([dx, dy]) => [this.playerX + dx, this.playerY + dy]).filter(([x, y]) => this.world?.[x]?.[y] === this.FLOOR && !this.getEnemyAt(x, y));
            if (spots.length) {
                this._blinkAt = this.time.now;
                const [nx, ny] = spots[Math.floor(Math.random() * spots.length)];
                this._vfxFlash?.(this.player.x, this.player.y, 40, 0xc0f0e0, 200, 0.8);
                this.playerX = nx; this.playerY = ny;
                this.player.setPosition(nx * T + T / 2, ny * T + T / 2 + (this.SLIME_Y_OFFSET || 0));
                this._vfxFlash?.(this.player.x, this.player.y, 40, 0xc0f0e0, 200, 0.8);
            }
        }
        const _pact = Enchants.bloodpact(this.equippedWeapons?.[this.currentElement]);   // Bloodpact (a corrupted book): being hit charges the ult
        if (_pact) this.gainUltCharge(actualDamage * _pact, this.currentElement);
        const blockedDamage = amount - actualDamage;
        // Spiked Hide (Tower boon) and Thorn Mail (relic): whoever hit you in melee takes some back
        const _thorns = this._mods?.thorns;
        this._thornsHit = true;   // thorns crit like any hit (_hitRoll); Iron Edge reads this
        try {
            if (_thorns && this._hitBy?.sprite?.active && this._hitBy.health > 0) this.damageEnemy(this._hitBy, _thorns * (this.damageScaling || 1));
            if (this._mods?.thornsPct && this._hitBy?.sprite?.active && this._hitBy.health > 0) this.damageEnemy(this._hitBy, amount * this._mods.thornsPct);   // Colossus Core: a share of the hit, back
            if (this._mods?.frostThorns && this.currentElement === 'ice' && this._hitBy?.sprite?.active && this._hitBy.health > 0) {   // Rime Ward: holding ice, a melee hit on you is answered in frost
                const by = this._hitBy; this.damageEnemy(by, this._mods.frostThorns * (this.damageScaling || 1), 'ice');
                if (by.sprite?.active && by.health > 0) this.applyChill?.(by, 0.34);
            }
        } finally { this._thornsHit = false; }   // Colossus Core: a share of the hit, back

        // Cancel cosmic channeling — getting hit interrupts it
        if (this.cosmicChanneling) {
            this.stopCosmicChanneling(true); // true = interrupted
        }

        this.health -= actualDamage;
        Telemetry.hurt(this, actualDamage);
        this._csOnHurt?.(actualDamage);   // Cosmic.js: Retribution hexes everything close

        if (blockedDamage > 0) {
            this.showShieldBlock(blockedDamage);
        }

        this.player.setTintFill(0xff4a5a);   // a red flash (a red tint turned the blue slime black)
        this._vfxPlayerHurt?.(actualDamage);
        this.time.delayedCall(140, () => {
            this.player.clearTint();
        });

        PlayerStats.afterHurt(this);   // Second Wind, Undying
        this.updateHUD();

        // Unbreakable (a mythic book): a killing blow leaves you on 1 HP and blasts what's close, once every 30s
        const _ub = this.health <= 0 && Enchants.n(this.equippedWeapons?.[this.currentElement], 'unbreakable');
        if (_ub && this.time.now >= (this._unbreakAt || 0)) {
            this._unbreakAt = this.time.now + 30000; this.health = 1; this.updateHUD();
            this.cameras.main.flash(200, 220, 230, 255); this._vfxFlash?.(this.player.x, this.player.y, 90, 0xe0e8ff, 300, 0.9);
            this.showStatusText?.(this.player.x, this.player.y - 40, 'UNBREAKABLE', '#e0e8ff');
            const px = this.playerX, py = this.playerY;
            for (const n of [...(this.enemies || [])]) if (n.sprite?.active && n.health > 0 && Math.abs(n.x - px) <= 2 && Math.abs(n.y - py) <= 2) this.damageEnemy(n, _ub * (this.damageScaling || 1));
            return;
        }
        // Coin Flip (a relic): a killing blow flips a coin first (Luck weights it), once a minute
        if (this.health <= 0 && this._mods?.coinFlip && this.time.now >= (this._coinAt || 0)) {
            this._coinAt = this.time.now + 60000;
            const heads = Math.random() < 0.5 + this._luckNow() * 0.01;
            const c = this.add.text(this.player.x, this.player.y - 40, '●', { fontSize: '26px', color: '#ffd860', stroke: '#5a3a0a', strokeThickness: 4 }).setOrigin(0.5).setDepth(8);
            this.tweens.add({ targets: c, scaleX: { from: 1, to: -1 }, duration: 110, yoyo: true, repeat: 3, onComplete: () => {
                c.setText(heads ? 'HEADS' : 'TAILS').setFontSize(14).setColor(heads ? '#ffe060' : '#c86a6a');
                this.tweens.add({ targets: c, y: c.y - 20, alpha: 0, delay: 700, duration: 400, onComplete: () => c.destroy() });
            } });
            if (heads) { this.health = 1; this.updateHUD(); Sfx.play(this, 'fanfare'); return; }
        }
        if (this.health <= 0) {
            this.gameOver();
        }
    }

    // Tile-based boss damage — checks if hit tile is within boss hitbox
    // `element`: what dealt the hit, for the ult gems (see gainUltCharge). Weapon hits leave it
    // out, since they are the element you hold; ults, projectiles and lingering effects pass it.
    // A story boss in its ice cube takes brittle damage like a cubed enemy, and the cube remembers what the others dealt
    _bossBrittle(boss, damage, el) {
        if (!((boss._iceCubeUntil || 0) > this.time.now) || el === 'ice') return damage;
        boss._cubeDealt = (boss._cubeDealt || 0) + damage;
        if (boss._decayOwed > 0) boss._decayOwed = Math.max(0, boss._decayOwed - damage);   // locks the decay in
        return damage;
    }
    // A hit on whatever boss stands on that tile. Boss hits skip damageEnemy, so their sound is made here: the element's hit with a big body's thud under it.
    damageBossAtTile(tileX, tileY, damage, sourceId, element = null) {
        const hit = this._damageBossAtTile(tileX, tileY, damage, sourceId, element);
        if (hit) Sfx.play(this, 'bosshit', { el: element || this.currentElement });
        return hit;
    }
    _damageBossAtTile(tileX, tileY, damage, sourceId, element = null) {
        // ── Helper: per-source cooldown guard ────────────────────────────────
        const _cooldownOk = (boss) => {
            if (sourceId === undefined) return true;
            // a projectile (an object): it lands once on this boss, however long it takes to pass through
            if (typeof sourceId === 'object') {
                const hit = boss._hitBy ||= new WeakSet();
                if (hit.has(sourceId)) return false;
                hit.add(sourceId); return true;
            }
            if (!boss._hitCooldowns) boss._hitCooldowns = {};
            const now = this.time.now;
            if (boss._hitCooldowns[sourceId] && now - boss._hitCooldowns[sourceId] < 120) return false;
            boss._hitCooldowns[sourceId] = now;
            if (!boss._lastCooldownClean || now - boss._lastCooldownClean > 5000) {
                boss._lastCooldownClean = now;
                for (const key in boss._hitCooldowns)
                    if (now - boss._hitCooldowns[key] > 1000) delete boss._hitCooldowns[key];
            }
            return true;
        };

        // ── Voltslime ─────────────────────────────────────────────────────────
        if (this.voltslimeBoss?.active) {
            const boss = this.voltslimeBoss;
            if (Math.abs(tileX - boss.tileX) <= 1 && Math.abs(tileY - boss.tileY) <= 1) {
                if (!_cooldownOk(boss)) return false;
                damage = this._bossBrittle(boss, damage, element || this.currentElement);
                if ((element || this.currentElement) === 'cosmic') this._csHex?.(boss);   // cosmic hits Hex a boss as they do anything else
                this.damageVoltslimeBoss(damage * (boss._purpleMarked ? 1.5 : 1));   // its purple mark was never read
                { const _el = element || this.currentElement; this._tallyDamage(_el, damage); const _r = this._noteUltHit(boss, _el);
                  this.gainUltCharge(this.ultChargePerHit, _el, false, _r); }
                return true;
            }
        }

        // ── Void Sovereign ────────────────────────────────────────────────────
        if (this.voidSovereignBoss?.active) {
            const boss = this.voidSovereignBoss;
            // The horizon and invulnerability answer only hits that reach it (inside the radius
            // check below). They were tested first, so for the whole horizon every hit anywhere in
            // the level printed "REFLECTED!" over the boss.
            // Pixel-radius check using tile centre — tighter than tile-grid to match visual hitbox
            const bpx = boss.container.x;
            const bpy = boss.container.y + (this.SLIME_Y_OFFSET || 0);
            const wpx = tileX * this.TILE_SIZE + this.TILE_SIZE / 2;
            const wpy = tileY * this.TILE_SIZE + this.TILE_SIZE / 2;
            const HIT_R = this.TILE_SIZE * 2.0; // ~2 tile radius — matches visible body
            if ((wpx - bpx) * (wpx - bpx) + (wpy - bpy) * (wpy - bpy) <= HIT_R * HIT_R) {
                if (boss._eventHorizonActive) {
                    const now = this.time.now;
                    if (now - (boss._reflectSaidAt || -1e9) > 700) {
                        boss._reflectSaidAt = now;
                        this.showStatusText(boss.container.x, boss.container.y - 50, 'REFLECTED!', '#cc44ff');
                    }
                    return false;
                }
                // not while it is gone (the stomp's leap, the maw's hops)
                if (boss._isInvulnerable || !boss.container?.visible) return false;
                if (!_cooldownOk(boss)) return false;
                damage = this._bossBrittle(boss, damage, element || this.currentElement);
                if ((element || this.currentElement) === 'cosmic') this._csHex?.(boss);
                if (typeof this.damageVoidSovereignBoss === 'function') this.damageVoidSovereignBoss(damage * (boss._purpleMarked ? 1.5 : 1));
                { const _el = element || this.currentElement; this._tallyDamage(_el, damage); const _r = this._noteUltHit(boss, _el);
                  this.gainUltCharge(this.ultChargePerHit, _el, false, _r); }
                return true;
            }
        }

        // ── Fracture Core ─────────────────────────────────────────────────────
        if (this.fractureCore?.active && typeof this.damageFractureCore === 'function') {
            const fc = this.fractureCore;
            if (fc.geode) {   // the Geode: a hit on it or the ring round it lands on its shell (or its heart, exposed)
                if (Math.max(Math.abs(tileX - fc.tileX), Math.abs(tileY - fc.tileY)) > 1 || fc._isInvulnerable) return false;
                if (!_cooldownOk(fc)) return false;
                const _el = element || this.currentElement;
                this._geodeHit?.(damage, _el);
                this._tallyDamage(_el, damage); const _r = this._noteUltHit(fc, _el); this.gainUltCharge(this.ultChargePerHit, _el, false, _r);
                return true;
            }
            this._fcHitFissureTile?.(tileX, tileY);   // a blow on a crack cools it
            if (fc.state !== 'vuln') return false; // only damageable in the window the rhythm earns
            // its body is a little over a tile across: a hit on its tile or the ring round it lands
            if (Math.max(Math.abs(tileX - fc.tileX), Math.abs(tileY - fc.tileY)) > 1) return false;
            if (!_cooldownOk(fc)) return false;
            this.damageFractureCore(damage);
            { const _el = element || this.currentElement; this._tallyDamage(_el, damage); const _r = this._noteUltHit(fc, _el);
              this.gainUltCharge(this.ultChargePerHit, _el, false, _r); }
            return true;
        }

        return false;
    }

    // ── ULT CHARGE: four gems ────────────────────────────────────────────────
    // A hit charges the gem of the element that DEALT it, which the two damage choke points
    // record in _lastUltHit (so a burn tick charges fire even while you hold ice). Falls back
    // to `element`, then to the held element, for charges with no hit behind them.
    //
    // REACTIONS: a hit on an enemy carrying ANOTHER element's status (burning, chilled or
    // cubed, amped, cosmic-marked) charges REACTION_MULT times as much. That is the
    // whole "use every element" incentive: camping one charges at 1x, rotating so that most
    // hits land on someone else's status charges at ~2x, and it can't be faked by tapping
    // number keys, because the status has to be on the enemy first.
    //
    // `raw` amounts (pickups, tutorial kills) are a flat share of a gem: no weapon scaling,
    // no reaction bonus.
    gainUltCharge(amount, element = null, raw = false, reaction = null) {
        if (!this.ultGems) return;
        const C = this._ultCfg();
        const now = this.time.now;
        const hit = this._lastUltHit && this._lastUltHit.t === now ? this._lastUltHit : null;
        const el = element || (hit ? hit.el : null) || this.currentElement;
        if (!(el in this.ultGems)) return;
        const max = this.ultChargeMax;
        let amt = amount;
        if (!raw) {
            amt *= (C.WEAPON_MULT[this.equippedWeapons?.[el]] ?? 1) * C.CHARGE_SCALE;
            const reacted = reaction !== null ? (reaction === 'residue' ? 'residue' : reaction ? 'full' : null) : hit && hit.el === el ? hit.reaction : null;
            amt *= (this._mods?.ult ?? 1) * Enchants.ult(this.equippedWeapons?.[el]);   // relics and Tower boons; the weapon's enchants
            if (el === 'ice' && this._fracMode?.kind === 'fan' && this._fracMode.until > now) amt *= this._fractalCfg?.().STORM_ULT ?? 1;   // the Fractal Shard's Shard Storm
            if (reacted) {
                amt *= (reacted === 'residue' ? C.RESIDUE_MULT : C.REACTION_MULT) * (this._mods?.react ?? 1) * Enchants.react(this.equippedWeapons?.[el]);
                (this._ultReactKind ||= {})[el] = reacted;
                this._ultFlashUntil[el] = now + 140;
                (this._ultReactAt ||= {})[el] = now;   // HUD: the gem says ×3
                const fu = Enchants.n(this.equippedWeapons?.[el], 'elemental_fusion');   // Elemental Fusion: another gem fills too
                const to = fu && Object.keys(this.ultGems).filter(g => g !== el && g !== 'cosmic' && this.ultGems[g] < max);
                if (to?.length) { const g = to[Math.floor(Math.random() * to.length)]; this.ultGems[g] = Math.min(max, this.ultGems[g] + amt * fu / 100); }
            }
        }
        // Cosmic.js: every hit, any element, also charges the cosmic gem (and its layers)
        if (this._csCast) { this._csGainCharge?.(amt); if (el === 'cosmic') return; }
        if (now < (this._ultNoChargeUntil[el] || 0)) return;   // its own ult is still running
        // Overflow: charge past a full gem is kept (up to another gem's worth) as damage for that element's next ult
        const over = this.ultGems[el] + amt - max;
        if (over > 0) (this._overflow ||= {})[el] = Math.min(max, (this._overflow[el] || 0) + over);
        if (this.ultGems[el] >= max) return;
        this.ultGems[el] = Math.min(max, this.ultGems[el] + amt);
        if (this.ultGems[el] >= max) this._ultReadyAt[el] = now;   // the HUD's ready ping
        this.ultCharge = this.ultGems[this.currentElement] || 0;
    }

    // Which elements' statuses an enemy (or a boss: _isFrozen is theirs) is carrying right now.
    _ultStatusOf(enemy) {
        return {
            fire: (enemy.burnStacks || 0) > 0 || !!enemy.isBurning,
            ice: !!enemy._iceCube || !!enemy.isFrozen || !!enemy._isFrozen || (enemy.chillStacks || 0) >= 0.5,
            lightning: !!enemy.isSuperConducted,
            cosmic: (enemy._csHexUntil || 0) > this.time.now,   // Hex is cosmic's status
        };
    }

    // Both damage choke points call this for every hit that lands: it remembers which element
    // dealt the hit and whether it was a reaction, for gainUltCharge on the same frame.
    _noteUltHit(enemy, el) {
        if (!enemy || !this.ultGems || !(el in this.ultGems)) { this._lastUltHit = null; return false; }
        const s = this._ultStatusOf(enemy);
        let other = null;
        for (const k of ['fire', 'ice', 'lightning', 'cosmic']) if (k !== el && s[k]) { other = k; break; }
        // residue: no status of another element, but another element HIT it moments ago (ticks don't count either way)
        const C = this._ultCfg(), lh = enemy._lastHitEl, residue = !other && !this._tick && !!lh && lh.el !== el && this.time.now - lh.t <= C.RESIDUE_MS;
        if (!this._tick) enemy._lastHitEl = { el, t: this.time.now };
        if (!other && this._mods?.hexReact && (enemy._csHexUntil || 0) > this.time.now) other = 'cosmic';   // Void Prism: a hexed enemy reacts to anything
        this._lastUltHit = { t: this.time.now, el, reaction: other ? 'full' : residue ? 'residue' : null };
        // Absolute Zero: a reaction bursts on what's close (not off its own burst's hits, and not twice a moment on one enemy)
        const boom = (this._mods?.reactBoom || 0) + Enchants.n(this.equippedWeapons?.[el], 'chain_reaction');   // Chain Reaction (an enchant) bursts the same way
        if (other && boom && !this._reactBoomBusy && this.time.now - (enemy._reactBoomAt || 0) > 400) {
            enemy._reactBoomAt = this.time.now;
            const bx = enemy.x, by = enemy.y, sx = enemy.sprite?.x, sy = enemy.sprite?.y, dmg = boom * (this.damageScaling || 1);
            this.time.delayedCall(0, () => {
                if (!this.enemies) return;
                this._reactBoomBusy = true;
                try {
                    if (sx != null) this._vfxFlash?.(sx, sy, 46, 0xd8f0ff, 200, 0.8);
                    for (const n of [...this.enemies]) if (n.sprite?.active && n.health > 0 && !this._phasedOut(n) && Math.abs(n.x - bx) <= 1 && Math.abs(n.y - by) <= 1) this.damageEnemy(n, dmg, el);
                } finally { this._reactBoomBusy = false; }
            });
        }
        if (enemy._csAstral) this._csAstralPop?.(enemy);   // Cosmic.js: a hit pops an Astrolabe mark
        if (other) this._ultReactionSpark(enemy, el, other);
        else if (residue) this._ultReactionSpark(enemy, el, lh.el, true);
        return other ? 'full' : residue ? 'residue' : false;
    }

    switchToElement(targetElement) {
        if (this._iceShellUntil > this.time.now) return;   // encased in ice
        if (this._elStolen?.[targetElement]?.sprite?.active) { if (this.player?.active && this.time.now - (this._stolenMsgAt || 0) > 800) { this._stolenMsgAt = this.time.now; this.showStatusText(this.player.x, this.player.y - 28, `${targetElement.toUpperCase()} STOLEN: KILL THE LEECH`, '#e8d0ff'); } return; }   // a Leech has it
        if (this._csFormLock?.()) return;   // Cosmic.js: no switching while transformed
        if (this.ignitionActive && targetElement !== 'fire') { if (this.player?.active && this.time.now - (this._scorchLockMsg || 0) > 800) { this._scorchLockMsg = this.time.now; this.showStatusText(this.player.x, this.player.y - 28, 'LOCKED IN FIRE', '#ff8a3a'); } return; }   // Scorch holds you in fire
        // In tutorial rooms 0 & 1: fire fists only, no switching allowed
        if (this.isTutorial && this.tutorialWeaponLocked) {
            this.showTutorialDialogue("Master your Flame Fists first!\nElement switching unlocks later.", "Glerp");
            return;
        }
        // Fire tutorial: restrict elements until unlocked
        // Ice tutorial: fire and ice always allowed freely
        if (this.isTutorial && !this.isIceTutorial) {
            if (targetElement === 'fire') {
                // Always allow
            } else if (targetElement === 'ice' && !this.tutorialIceUnlocked) {
                this.showTutorialDialogue("Ice isn't available yet!\nClear the current room first.", "Glerp");
                return;
            } else if (targetElement !== 'ice') {
                // Lightning and cosmic locked in fire tutorial
                return;
            }
        } else if (this.isTutorial && this.isIceTutorial) {
            if (targetElement === 'ice' && !this.tutorialIceUnlocked) {
                this.showTutorialDialogue("You don't have ICE yet! Keep fighting.", "Glerp");
                return;
            }
            const inUltRoom = this.getCurrentPlayerRoom() === 3 && !this._iceUltUsed;
            if (inUltRoom && targetElement !== 'ice') {
                this.showTutorialDialogue("You need ICE for this room!\nPress 2 to switch to Ice, then E to unleash the Blizzard.", "Glerp");
                return;
            }
            if (targetElement !== 'fire' && targetElement !== 'ice') return;
        } else if (!this.isTutorial) {
            // All real levels — gate on localStorage
            const iceUnlocked = this.tutorialIceUnlocked
                || localStorage.getItem('unlocked_ice') === 'true'
                || localStorage.getItem('iceTutorialComplete') === '1';
            if (targetElement === 'ice' && !iceUnlocked) {
                this.showTutorialDialogue("Complete the Ice Tutorial first!", "Glerp");
                return;
            }
            if (targetElement === 'lightning' && localStorage.getItem('unlocked_lightning') !== 'true') {
                this.showTutorialDialogue("Lightning isn't available yet!\nFind it at the end of Level 2.", "Glerp");
                return;
            }
            if (targetElement === 'cosmic' && localStorage.getItem('unlocked_cosmic') !== 'true') {
                this.showTutorialDialogue("Cosmic isn't available yet!\nFind it at the end of Level 3.", "Glerp");
                return;
            }
        }
        const currentTime = this.time.now;

        if (this.currentElement === targetElement) return;

        // Block switching during active abilities
        // Ice ult DOMAIN is allowed to persist through element switches — only block during
        // the pre-domain tsunami wave phase (tsunamiActive && !_iceUltDomainActive)
        const blockingState =
            this.thunderheadActive ? 'THUNDERHEAD ACTIVE' :
            // The fire ult (an auto-firing buff) and the black hole (a thing in the world) no
            // longer hold you in their element: any ult can be cast from any element now, and
            // these two keep working while you play something else.
            this.cosmicCharging    ? 'CHARGING BEAM' :
            this.cosmicContinuousLaserActive ? 'LASER ACTIVE' :
            null;

        if (blockingState) {
            this.showCannotSwitchText(blockingState);
            return;
        }

        if (currentTime - this.lastElementSwitchTime < this.elementSwitchCooldown * (this._csSwitchMult?.() ?? 1)) {
            return;
        }

        this.isPointerDown = false;
        this.clearEngineerBuildMode();
        this.clearEngineerTowerPreview();
        if (this.cosmicChanneling) this.stopCosmicChanneling(false);

        // Clean up cosmic charge indicator if mid-charge somehow
        if (this.cosmicChargeIndicator) {
            this.tweens.killTweensOf(this.cosmicChargeIndicator);
            this.cosmicChargeIndicator.destroy();
            this.cosmicChargeIndicator = null;
        }
        this.cosmicCharging = false;
        this.cosmicContinuousLaserActive = false;

        // (Shots already flying keep going when you switch: each carries its own element, and a shard or fireball landing
        // after you've switched is how reactions are set up. They used to be cleared here.)

        // Switch to new element. There used to be a 25-point ult charge penalty here; with one
        // gem per element, switching is what the system rewards (reactions), not what it taxes.
        this.currentElement = targetElement;
        this.ultCharge = this.ultGems ? (this.ultGems[targetElement] || 0) : this.ultCharge;
        // relics: Ember Heart's hits after a switch, Heart of the Sun's nova of the new element
        const _sw = this._mods?.swapBy?.[targetElement];
        this._swapEl = targetElement; this._swapLeft = _sw ? _sw.hits : 0;
        if (this._mods?.switchNova && this.player?.active && this.time.now - (this._novaAt || 0) > 600) {
            this._novaAt = this.time.now;
            const dmg = this._mods.switchNova * (this.damageScaling || 1), col = { fire: 0xff7a2a, ice: 0x8ae8ff, lightning: 0xffe14a, cosmic: 0xb48cf0 }[targetElement] || 0xffffff;
            this._vfxFlash?.(this.player.x, this.player.y, 80, col, 260, 0.9);
            for (const n of [...(this.enemies || [])]) if (n.sprite?.active && n.health > 0 && Math.abs(n.x - this.playerX) <= 2 && Math.abs(n.y - this.playerY) <= 2) this.damageEnemy(n, dmg, targetElement);
        }
        this.updateHUD();

        const px = this._scrX(this.player.x);
        const py = this._scrY(this.player.y);

        if (targetElement === 'fire') {
            // Eruption: rings of fire expanding outward, embers flying up
            const screenFlash = this.add.rectangle(this.scale.width / 2, this.scale.height / 2, this.scale.width, this.scale.height, 0xff3300, 0.25).setScrollFactor(0).setDepth(20);
            this.tweens.add({ targets: screenFlash, alpha: 0, duration: 300, onComplete: () => screenFlash.destroy() });
            for (let r = 0; r < 3; r++) {
                const ring = this.add.circle(px, py, 10, 0xff6600, 0).setScrollFactor(0).setDepth(20);
                ring.setStrokeStyle(3 - r, 0xff4400, 0.9 - r * 0.2);
                this.tweens.add({ targets: ring, radius: 80 + r * 40, alpha: 0, duration: 350 + r * 80, delay: r * 60, ease: 'Quad.easeOut', onComplete: () => ring.destroy() });
            }
            for (let i = 0; i < 10; i++) {
                const angle = Math.random() * Math.PI * 2;
                const spd = 30 + Math.random() * 50;
                const ember = this.add.circle(px, py, 2 + Math.random() * 2, Math.random() < 0.5 ? 0xff6600 : 0xffaa00, 1).setScrollFactor(0).setDepth(20);
                this.tweens.add({ targets: ember, x: px + Math.cos(angle) * spd, y: py + Math.sin(angle) * spd - 20, alpha: 0, duration: 400 + Math.random() * 200, ease: 'Quad.easeOut', onComplete: () => ember.destroy() });
            }
            this.player.setTint(0xff6600);
            this.time.delayedCall(300, () => this.player.clearTint());

        } else if (targetElement === 'ice') {
            // Freeze burst: crystalline shards radiating out, screen tints blue
            const screenFlash = this.add.rectangle(this.scale.width / 2, this.scale.height / 2, this.scale.width, this.scale.height, 0x0099cc, 0.2).setScrollFactor(0).setDepth(20);
            this.tweens.add({ targets: screenFlash, alpha: 0, duration: 400, onComplete: () => screenFlash.destroy() });
            for (let i = 0; i < 12; i++) {
                const angle = (Math.PI * 2 / 12) * i;
                const len = 30 + Math.random() * 40;
                const shard = this.add.rectangle(px, py, 4, 12, 0xaaddff, 0.9).setScrollFactor(0).setDepth(20);
                shard.setRotation(angle);
                this.tweens.add({ targets: shard, x: px + Math.cos(angle) * len, y: py + Math.sin(angle) * len, alpha: 0, scaleY: 0.3, duration: 350, ease: 'Quad.easeOut', onComplete: () => shard.destroy() });
            }
            const frost = this.add.circle(px, py, 8, 0xffffff, 0.7).setScrollFactor(0).setDepth(20);
            this.tweens.add({ targets: frost, radius: 60, alpha: 0, duration: 300, ease: 'Quad.easeOut', onComplete: () => frost.destroy() });
            this.player.setTint(0x00ccff);
            this.time.delayedCall(350, () => this.player.clearTint());

        } else if (targetElement === 'lightning') {
            // Electric discharge: jagged arcs flying out, screen flash yellow
            const screenFlash = this.add.rectangle(this.scale.width / 2, this.scale.height / 2, this.scale.width, this.scale.height, 0xffff00, 0.3).setScrollFactor(0).setDepth(20);
            this.tweens.add({ targets: screenFlash, alpha: 0, duration: 150, onComplete: () => screenFlash.destroy() });
            for (let i = 0; i < 6; i++) {
                const angle = (Math.PI * 2 / 6) * i + (Math.random() - 0.5) * 0.5;
                const g = this.add.graphics().setScrollFactor(0).setDepth(20);
                g.lineStyle(2, 0xffff00, 1);
                g.beginPath(); g.moveTo(px, py);
                let cx2 = px, cy2 = py;
                for (let s = 0; s < 4; s++) {
                    cx2 += Math.cos(angle) * 15 + (Math.random() - 0.5) * 10;
                    cy2 += Math.sin(angle) * 15 + (Math.random() - 0.5) * 10;
                    g.lineTo(cx2, cy2);
                }
                g.strokePath();
                this.tweens.add({ targets: g, alpha: 0, duration: 200, onComplete: () => g.destroy() });
            }
            this.player.setTint(0xffff00);
            this.time.delayedCall(200, () => this.player.clearTint());

        } else if (targetElement === 'cosmic') {
            // Void implosion then expansion: dark circle shrinks in then explodes purple
            const screenFlash = this.add.rectangle(this.scale.width / 2, this.scale.height / 2, this.scale.width, this.scale.height, 0x220033, 0.35).setScrollFactor(0).setDepth(20);
            this.tweens.add({ targets: screenFlash, alpha: 0, duration: 500, onComplete: () => screenFlash.destroy() });
            const void1 = this.add.circle(px, py, 50, 0x110022, 0.8).setScrollFactor(0).setDepth(20);
            this.tweens.add({ targets: void1, radius: 5, duration: 200, ease: 'Quad.easeIn', onComplete: () => {
                this.tweens.add({ targets: void1, radius: 120, alpha: 0, duration: 300, ease: 'Quad.easeOut', onComplete: () => void1.destroy() });
                for (let i = 0; i < 8; i++) {
                    const angle = (Math.PI * 2 / 8) * i;
                    const orb = this.add.circle(px, py, 4, 0xcc88ff, 1).setScrollFactor(0).setDepth(20);
                    this.tweens.add({ targets: orb, x: px + Math.cos(angle) * 70, y: py + Math.sin(angle) * 70, alpha: 0, duration: 350, ease: 'Quad.easeOut', onComplete: () => orb.destroy() });
                }
            }});
            this.player.setTint(0x9966ff);
            this.time.delayedCall(400, () => this.player.clearTint());
        }

        this.lastElementSwitchTime = currentTime;
        this.updateHUD();
    }

    updateUltAbsorbers(time) {
        if (!this.enemies) return;
        const ABSORB_RADIUS  = TutorialManager.ABSORB_R;   // tiles, round: the zone it draws
        const STEAL          = 25;   // ult charge taken from your fullest gem each throw (a quarter of a gem)
        const STEAL_CD       = 7000; // ms between throws while you're in its zone
        const FIRST_MS       = 1500; // ms from walking in to its first throw
        const HEAL_RADIUS    = 4;    // tiles, round — enemies healed around absorber
        const HEAL_BURST     = 0.12; // of their max health, each throw
        // the burn its meteors leave on you: a stack is 1 damage a second
        if (this._pBurnUntil) {
            if (time >= this._pBurnUntil || this._deathScreenActive) { this._pBurnUntil = 0; this._pBurn = 0; }
            else if (time - this._pBurnAt >= 1000) { this._pBurnAt = time; this._hitBy = null; this.takeDamage(this._pBurn * (this.enemyDamageScale || 1)); }
        }

        const COLS = this._ultCfg().COLORS, T = this.TILE_SIZE, ADD = Phaser.BlendModes.ADD;
        for (const enemy of this.enemies) {
            if (!enemy.isUltAbsorber || !enemy.sprite?.active) continue;
            const dist = Math.hypot(enemy.x - this.playerX, enemy.y - this.playerY);
            const _gems = this.ultGems ? Object.values(this.ultGems).reduce((a, b) => a + b, 0) : this.ultCharge;
            const inRange = dist <= ABSORB_RADIUS && _gems > 0 && this.player?.active;
            const el = Object.keys(this.ultGems || {}).reduce((a, b) => (this.ultGems[b] > this.ultGems[a] ? b : a), this.currentElement);
            const col = COLS[el] || 0xb47cff;

            // ── the siphon: a thin stream curving from you into it, motes of your fullest gem's colour flowing along it,
            // fuller and brighter toward its next steal; its body glows that colour as it gets close ──
            const g = enemy._drainBeam ||= this.add.graphics().setDepth(4.4).setBlendMode(ADD);
            g.clear();
            const glow = enemy._absGlow ||= this.add.image(0, 0, 'vfx_glow').setBlendMode(ADD).setDepth((enemy.sprite.depth ?? 3) - 0.01).setAlpha(0);
            if (!inRange) { enemy._absWasIn = false; glow.setAlpha(Math.max(0, glow.alpha - 0.05)).setPosition(enemy.sprite.x, enemy.sprite.y); continue; }
            // out of range its clock keeps running, so stepping out and back in doesn't dodge the steal
            if (!enemy._absWasIn) { enemy._absWasIn = true; enemy._absNext = Math.max(enemy._absNext || 0, time + FIRST_MS); enemy._absFrom = time; }
            const f = Phaser.Math.Clamp(1 - (enemy._absNext - time) / Math.min(STEAL_CD, enemy._absNext - (enemy._absFrom || 0) || STEAL_CD), 0, 1);
            const ax = this.player.x, ay = this.player.y - 4, bx = enemy.sprite.x, by = enemy.sprite.y - 6;
            const L = Math.hypot(bx - ax, by - ay) || 1, nx = -(by - ay) / L, ny = (bx - ax) / L, sway = Math.sin(time * 0.003) * L * 0.18;
            const cx = (ax + bx) / 2 + nx * sway, cy = (ay + by) / 2 + ny * sway;
            const at = u => [(1 - u) * (1 - u) * ax + 2 * (1 - u) * u * cx + u * u * bx, (1 - u) * (1 - u) * ay + 2 * (1 - u) * u * cy + u * u * by];
            for (const [w, a] of [[5, 0.06 + 0.1 * f], [1.5, 0.18 + 0.4 * f]]) {
                g.lineStyle(w, col, a).beginPath(); g.moveTo(ax, ay);
                for (let k = 1; k <= 14; k++) { const [x, y] = at(k / 14); g.lineTo(x, y); }
                g.strokePath();
            }
            for (let k = 0; k < 7; k++) {
                const u = (time / (900 - 400 * f) + k / 7) % 1, [x, y] = at(u), r = (1.2 + 1.8 * f) * Math.sin(u * Math.PI) + 0.6;
                g.fillStyle(col, 0.5 + 0.5 * f).fillCircle(x, y, r); g.fillStyle(0xffffff, 0.7 * f).fillCircle(x, y, r * 0.45);
            }
            glow.setTint(col).setPosition(bx, by + 6).setScale(0.5 + 0.5 * f).setAlpha(0.15 + 0.5 * f * f);
            if (time < enemy._absNext || enemy.isStunned || enemy.isFrozen) continue;
            enemy._absNext = time + STEAL_CD; enemy._absFrom = time;

            // ── the steal: a shard of the gem torn out of you, flying down the stream into it ──
            if (this.ultGems) { this.ultGems[el] = Math.max(0, this.ultGems[el] - STEAL); this.ultCharge = this.ultGems[this.currentElement] || 0; }
            else this.ultCharge = Math.max(0, this.ultCharge - STEAL);
            this.updateHUD();
            this.showStatusText(this.player.x, this.player.y - 26, 'ULT STOLEN', UIKit._hex(col));
            this._vfxFlash?.(ax, ay, 34, col, 220, 0.7);
            Sfx.play(this, 'whoosh');
            const shard = this.add.graphics().setDepth(4.6).setBlendMode(ADD);
            shard.fillStyle(col, 1).fillPoints([{ x: 0, y: -7 }, { x: 5, y: 0 }, { x: 0, y: 7 }, { x: -5, y: 0 }], true).fillStyle(0xffffff, 0.9).fillPoints([{ x: 0, y: -4 }, { x: 2.5, y: 0 }, { x: 0, y: 4 }, { x: -2.5, y: 0 }], true);
            const o = { u: 0 };
            this.tweens.add({ targets: o, u: 1, duration: 380, ease: 'Quad.easeIn', onUpdate: () => {
                const [x, y] = at(o.u); shard.setPosition(x, y).setRotation(o.u * 9);
                const m = this.add.circle(x, y, 2.5, col).setBlendMode(ADD).setDepth(4.55); this.tweens.add({ targets: m, scale: 0.2, alpha: 0, duration: 260, onComplete: () => m.destroy() });
            }, onComplete: () => {
                shard.destroy();
                if (!enemy.sprite?.active || enemy.health <= 0) return;
                // it takes the ult in: a flash of the element, its armour half on, the ring of its heal, then it throws the ult back
                const s = enemy.sprite;
                this._vfxFlash?.(s.x, s.y, 46, col, 260, 0.8);
                if (typeof CreatureFX !== 'undefined') CreatureFX.ultArmor(this, el, 4000, s);
                VisualFX.ripple(this, s.x, s.y + 6, 8, HEAL_RADIUS * T, col, { depth: 0.9, duration: 700, alpha: 0.55 });
                for (const ally of this.enemies) {
                    if (!ally.sprite?.active || ally.health <= 0 || ally.health >= ally.maxHealth || Math.hypot(ally.x - enemy.x, ally.y - enemy.y) > HEAL_RADIUS) continue;
                    ally.health = Math.min(ally.maxHealth, ally.health + ally.maxHealth * HEAL_BURST);
                    this.updateEnemyHealthBar(ally);
                    this._vfxFlash?.(ally.sprite.x, ally.sprite.y, 22, 0x7dff9a, 300, 0.45);
                    for (let k = 0; k < 4; k++) { const m = this.add.rectangle(ally.sprite.x + (Math.random() - 0.5) * 18, ally.sprite.y + 4, 2, 2, 0x9dffb4).setBlendMode(ADD).setDepth(4.5); this.tweens.add({ targets: m, y: m.y - 18 - Math.random() * 10, alpha: 0, duration: 520, delay: k * 60, onComplete: () => m.destroy() }); }
                }
                this._absorberCast(enemy, el);
            } });
        }
    }

    // An Ult Absorber's throw: a small copy of the ult it just stole from you, drawn with that ult's own art.
    // Each one gives you a moment to step out of it or dash through.
    //   fire: three of the fire ult's meteors where you stand, each a daze and a stack of burn
    //   ice: the tsunami's water rolling out of it (no pull); caught, you're frozen in the ice ult's shell, which shatters a second later
    //   lightning: it turns to a ball of lightning, as the Fork does, and strikes your tile; caught, you're shorted out, no dash for a while
    //   cosmic: the black hole's bomb, flung at your tile; caught in its burst you're Hexed, +50% damage taken from everything
    _absorberCast(enemy, el) {
        const T = this.TILE_SIZE, S = this.enemyDamageScale || 1, ADD = Phaser.BlendModes.ADD, src = enemy.sprite;
        const px = tx => tx * T + T / 2;
        const safe = () => !this.player?.active || this._deathScreenActive || this.time.now < (this._dashInvulnUntil || 0);
        const hurt = d => { this._hitBy = null; this.takeDamage(d * S); };
        const near = (tx, ty, r) => Math.hypot(this.playerX - tx, this.playerY - ty) <= r;
        const mark = (x, y, r, col, ms) => {   // where it lands: a soft ring on the floor closing in, its glow filling
            const ring = this.add.ellipse(x, y + 2, r * 2, r * 1.1).setStrokeStyle(2, col, 0.9).setBlendMode(ADD).setDepth(0.95).setScale(1.5).setAlpha(0);
            const fill = this.add.image(x, y + 2, 'vfx_glow').setTint(col).setBlendMode(ADD).setDepth(0.94).setDisplaySize(r * 2.4, r * 1.3).setAlpha(0);
            this.tweens.add({ targets: ring, scale: 1, alpha: 1, duration: ms, ease: 'Cubic.easeOut' });
            this.tweens.add({ targets: fill, alpha: 0.55, duration: ms, ease: 'Quad.easeIn', onComplete: () => this.tweens.add({ targets: [ring, fill], alpha: 0, duration: 200, onComplete: () => { ring.destroy(); fill.destroy(); } }) });
        };
        if (el === 'fire') {
            for (let i = 0; i < 3; i++) this.time.delayedCall(i * 380, () => {
                if (!this.player?.active) return;
                let tx = this.playerX, ty = this.playerY;
                if (i) for (let k = 0; k < 8; k++) { const x = this.playerX + Math.round((Math.random() - 0.5) * 3), y = this.playerY + Math.round((Math.random() - 0.5) * 3); if (this.world?.[x]?.[y] === this.FLOOR) { tx = x; ty = y; break; } }
                mark(px(tx), px(ty), T * 1.2, 0xff6a2a, 560);
                this.time.delayedCall(80, () => this._scorchMeteor({ tx, ty }, { SIZE: 0.7, R: 1.2, hostile: (x, y, R) => {
                    if (safe() || !near(x, y, R)) return;
                    hurt(3);
                    if (this._ccGate(400)) this._staggerUntil = Math.max(this._staggerUntil || 0, this.time.now + 400);
                    if (!(this._pBurnUntil > this.time.now)) { this._pBurn = 0; this._pBurnAt = this.time.now; }
                    this._pBurn = Math.min(5, this._pBurn + 1); this._pBurnUntil = this.time.now + 3000;
                    this.showStatusText(this.player.x, this.player.y - 30, 'BURNING', '#ff8a30');
                } }));
            });
        } else if (el === 'ice') {
            // the tsunami, small: rings of its water out from the absorber to RMAX, fast then slowing, then drawn back in
            const ox = enemy.x, oy = enemy.y, RMAX = 4, OUT = 700, TELL = 450, tiles = [], seen = new Set();
            VisualFX.ripple(this, src.x, src.y + 6, RMAX * T, 6, 0x9ad8ff, { depth: 0.95, duration: TELL, alpha: 0.8 });   // the water drawn in first
            Sfx.play(this, 'shatter');
            let caught = false;
            for (let r = 1; r <= RMAX; r++) this.time.delayedCall(TELL + OUT * Math.pow(r / RMAX, 2.5), () => {
                for (let dx = -r; dx <= r; dx++) for (let dy = -r; dy <= r; dy++) {
                    const d = Math.hypot(dx, dy), tx = ox + dx, ty = oy + dy, k = tx + ',' + ty;
                    if (d < r - 0.8 || d > r + 0.1 || seen.has(k) || this.world?.[tx]?.[ty] !== this.FLOOR) continue;
                    seen.add(k);
                    const w = this._vfxWaterImg ? this._vfxWaterImg(px(tx), px(ty), false).setAlpha(0.72) : this.add.rectangle(px(tx), px(ty), T, T, 0x0066cc, 0.55).setDepth(0.5);
                    const sh = this._vfxWaterImg ? this._vfxWaterImg(px(tx), px(ty), true) : this.add.rectangle(px(tx), px(ty), T - 4, T - 4, 0x44aaff, 0.3).setDepth(0.5);
                    this.tweens.add({ targets: sh, alpha: 0.6, duration: 150 + Math.random() * 100, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
                    tiles.push({ w, sh, r });
                }
                if (caught || safe() || Math.hypot(this.playerX - ox, this.playerY - oy) > r + 0.5) return;
                caught = true;
                hurt(2);
                const held = this._ccGate(1000);
                if (held) this._staggerUntil = Math.max(this._staggerUntil || 0, this.time.now + 1000);
                this.showStatusText(this.player.x, this.player.y - 34, held ? 'FROZEN' : 'CHILLED', '#88eeff');
                // the ice ult's own shell, your shape in thick ice; it shatters a second later
                const p = this.player, shell = this.add.image(p.x, p.y, this._iceShellTex(p)).setOrigin(p.originX, p.originY).setScale(p.scaleX, p.scaleY).setDepth(p.depth + 0.02).setAlpha(0);
                shell.setDisplayOrigin(p.displayOriginX + 6, p.displayOriginY + 6);
                this.tweens.add({ targets: shell, alpha: 0.92, duration: 160 });
                Sfx.play(this, 'freeze');
                this.time.delayedCall(1000, () => {
                    const x = shell.x, y = shell.y; shell.destroy();
                    Sfx.play(this, 'shatter'); this.cameras.main.shake(90, 0.004);
                    this._vfxFlash?.(x, y, 40, 0xd8f4ff, 260, 0.6);
                    const glit = this.add.particles(x, y - 6, 'vfx_dot', { lifespan: { min: 400, max: 800 }, speedX: { min: -50, max: 50 }, speedY: { min: -80, max: -10 }, gravityY: 180, scale: { start: 0.5, end: 0 },
                        alpha: { start: 1, end: 0 }, tint: [0xffffff, 0xcff4ff, 0x8ad8ff], blendMode: 'ADD', emitting: false }).setDepth(4.7);
                    glit.explode(16); this.time.delayedCall(900, () => glit.destroy());
                    if (this.player?.active && !this._deathScreenActive) { hurt(5); this.showStatusText(this.player.x, this.player.y - 34, 'SHATTER', '#dff6ff'); }
                });
            });
            for (let r = RMAX; r >= 1; r--) this.time.delayedCall(TELL + OUT + 250 + 450 * Math.pow((RMAX - r) / RMAX, 0.4), () => {
                for (const t of tiles.filter(q => q.r === r)) { this.tweens.killTweensOf(t.sh); this.tweens.add({ targets: [t.w, t.sh], alpha: 0, duration: 120, onComplete: () => { t.w.destroy(); t.sh.destroy(); } }); }
            });
        } else if (el === 'lightning') {
            // the Fork, small: it goes white-hot, becomes a ball of lightning and strikes where you stood, the bolt left crackling behind
            const tx = this.playerX, ty = this.playerY, to = { x: px(tx), y: px(ty) }, TELL = 650;
            mark(to.x, to.y, T * 1.5, 0xffe14a, TELL);
            src.setTintFill?.(0xfff6a0); this.time.delayedCall(TELL, () => src.active && src.clearTint?.());
            Sfx.play(this, 'e_thunder');
            this.time.delayedCall(TELL, () => {
                if (!src.active) return;
                const from = { x: src.x, y: src.y - 6 }, web = this.add.graphics().setDepth(4.6).setBlendMode(ADD);
                const head = this.add.image(from.x, from.y, 'vfx_glow').setTint(0xfff6a0).setBlendMode(ADD).setDepth(4.7).setScale(0.6);
                const o = { k: 0 };
                this.tweens.add({ targets: o, k: 1, duration: 160, ease: 'Quad.easeIn', onUpdate: () => {
                    const at = { x: from.x + (to.x - from.x) * o.k, y: from.y + (to.y - from.y) * o.k };
                    head.setPosition(at.x, at.y).setScale(0.55 + Math.random() * 0.2);
                    web.clear(); this._forkBolt(web, from, at, 1.2, false);
                }, onComplete: () => {
                    head.destroy();
                    Sfx.play(this, 'zap'); this.cameras.main.shake(70, 0.003);
                    this._vfxFlash?.(to.x, to.y, T * 1.8, 0xfff27a, 200, 0.7);
                    const forks = Array.from({ length: 3 }, () => { const a = Math.random() * Math.PI * 2, d = T * (1 + Math.random() * 0.6); return { x: to.x + Math.cos(a) * d, y: to.y + Math.sin(a) * d * 0.6 }; });
                    const f = { k: 0 };
                    this.tweens.add({ targets: f, k: 1, duration: 520, onUpdate: () => { web.clear(); const th = 2.2 - f.k * 1.6; this._forkBolt(web, from, to, th, true); for (const q of forks) this._forkBolt(web, to, q, th * 0.6, false); web.setAlpha(1 - f.k); }, onComplete: () => web.destroy() });
                    if (safe() || !near(tx, ty, 1.5)) return;
                    hurt(4);
                    this._dashReadyAt = Math.max(this._dashReadyAt || 0, this.time.now + 2500);
                    this.showStatusText(this.player.x, this.player.y - 34, 'SHORTED: NO DASH', '#ffe24a');
                } });
            });
        } else {
            // the black hole's bomb, flung at your tile; its burst opens a small vortex there
            const tx = this.playerX, ty = this.playerY, x = px(tx), y = px(ty), FLY = 750;
            mark(x, y, T * 1.5, 0xb47cff, FLY);
            const { container, armTimer, trailTimer } = this._voidBombFx(src.x, src.y - 6);
            container.setScale(0.7);
            this.tweens.add({ targets: container, x, y, duration: FLY, ease: 'Sine.easeIn', onComplete: () => {
                armTimer.remove(); trailTimer.remove();
                this._voidBurstFx(x, y);
                this.tweens.add({ targets: container, scale: 1.8, angle: -200, alpha: 0, duration: 650, ease: 'Cubic.easeOut', onComplete: () => container.destroy() });   // the vortex, turning out and gone
                Sfx.play(this, 'csplace');
                if (safe() || !near(tx, ty, 1.5)) return;
                this._absHexUntil = this.time.now + 4000;
                this.showStatusText(this.player.x, this.player.y - 34, 'HEXED', '#c48aff');
            } });
        }
    }

    updateBurnEffects(time) {
        // Retired: the one burn ticks in WeaponSystem._applyBurnDoT and Creatures.js draws it. Left
        // running, this would expire every burn the frame it started (burnUntil is never set now).
        return;
        for (let enemy of [...this.enemies]) {
            // Track burn stack pips to follow the enemy
            if (enemy._burnStackBar && enemy.sprite?.active) {
                const stacks = enemy._burnStackBar.length;
                const GAP = 5, W = 4;
                const totalW = stacks * W + (stacks - 1) * GAP;
                for (let i = 0; i < stacks; i++) {
                    const pip = enemy._burnStackBar[i];
                    if (!pip?.active) continue;
                    pip.x = enemy.sprite.x - totalW / 2 + i * (W + GAP) + W / 2;
                    pip.y = enemy.sprite.y - 22;
                }
            }

            if (!enemy.isBurning) continue;

            // Expire
            if (time >= enemy.burnUntil) {
                enemy.isBurning = false;
                this.clearBurnVisual(enemy);
                if (enemy.sprite && enemy.sprite.active && !enemy.isFrozen) {
                    enemy.sprite.clearTint();
                }
                continue;
            }

            // Tick damage — iceImmune enemies can't be burned; fireImmune CAN (burn is environmental)
            if (time - enemy.lastBurnTick >= this.burnTickInterval) {
                enemy.lastBurnTick = time;
                if (enemy.iceImmune) continue;
                const tickDmg = this.burnTickDamage * this.damageScaling;
                if (this._phasedOut(enemy)) continue;   // phased out: not in the world
                this._tick = true; let _rd1042; try { _rd1042 = this.resolveElementalHit(enemy, tickDmg, 'fire', true); } finally { this._tick = false; }   // escape hatch; a tick, not a hit
                if (_rd1042 === null) continue;
                enemy.health -= _rd1042;
                this.gainUltCharge(this.ultChargePerBurnTick, 'fire');

                // Floating damage number
                if (enemy.sprite && enemy.sprite.active) {
                    this.showDamageNumber(enemy.sprite.x, enemy.sprite.y, tickDmg, '#ff8800');
                }

                // Flicker tint
                if (enemy.sprite && enemy.sprite.active) {
                    enemy.sprite.setTint(0xffffff);
                    this.time.delayedCall(80, () => {
                        if (enemy.sprite && enemy.sprite.active && enemy.isBurning) {
                            CreatureFX.tintOver(enemy.sprite, 0xff6600);
                        }
                    });
                }

                this.updateEnemyHealthBar(enemy);
                if (enemy.health <= 0) { this.killEnemy(enemy); continue; }
            }

            // Keep flame visual synced to enemy position
            if (enemy.burnVisual && enemy.sprite) {
                enemy.burnVisual.x = enemy.sprite.x;
                enemy.burnVisual.y = enemy.sprite.y - 18;
            }
        }
    }

    showBurnVisual(enemy) {
        this.clearBurnVisual(enemy);

        const x = enemy.sprite.x;
        const y = enemy.sprite.y - 18;

        // Draw a flame: layered circles tapering upward
        const g = this.add.graphics();
        g.fillStyle(0xff2200, 0.9);
        g.fillEllipse(0, 0, 10, 14);   // outer flame body
        g.fillStyle(0xff7700, 1);
        g.fillEllipse(0, -3, 7, 10);   // mid flame
        g.fillStyle(0xffdd00, 1);
        g.fillEllipse(0, -5, 4, 6);    // bright core tip
        g.x = x;
        g.y = y;

        this.tweens.add({
            targets: g,
            scaleX: 1.25, scaleY: 1.2,
            y: y - 3,
            duration: 180,
            yoyo: true, repeat: -1,
            ease: 'Sine.easeInOut'
        });

        enemy.burnVisual = g;
        enemy.burnVisualActive = true;
        CreatureFX.tintOver(enemy.sprite, 0xff6600);
    }

    clearBurnVisual(enemy) {
        if (enemy.burnVisual) {
            this.tweens.killTweensOf(enemy.burnVisual);
            enemy.burnVisual.destroy();
            enemy.burnVisual = null;
        }
        enemy.burnVisualActive = false;
    }

    // ─── LIGHTNING NODE SYSTEM ─────────────────────────────────────────

    // Brittle system removed — stubs kept so GameScene forwarders don't crash
    applyBrittle() {}
    updateBrittleVisual() {}
    // ── CHILL DECAY ──────────────────────────────────────────────────────────
    // `lastChillTime` is assigned in twelve places across four files and, until this,
    // read in none. Nothing ever expired a stack, so chill accumulated for the lifetime
    // of an enemy: three ice hits froze a target no matter how far apart they landed,
    // and one hit now plus two in the next room behaved exactly like a fast triple-tap.
    // Freeze was a function of total hits rather than sustained pressure.
    //
    // Done here rather than at the twelve application sites on purpose. Those sites do
    // not agree with each other -- some clamp with Math.min(3, ...), some are a bare
    // ++ -- so touching each one would have been twelve chances to miss one and twelve
    // copies of the same window constant. This is the per-frame hook that already
    // existed for exactly this and was an empty stub; GameScene already calls it with
    // `time` every frame.
    //
    // A stack refreshes the whole window rather than ageing out one at a time: landing
    // a second hit should buy you time to land the third, not start a separate clock.
    updateBrittleDecay(time) {
        const t = this.time.now, C = this._chillCfg();   // (the scene clock: lastChillTime is stamped on it)
        const dt = Math.min(0.25, Math.max(0, (t - (this._chillDrainAt ?? t)) / 1000)); this._chillDrainAt = t;

        const decay = (o) => {
            if (!o || !o.chillStacks) return;
            if (o.isFrozen) return;                       // already spent — nothing to age
            if (!o.lastChillTime) return;                 // stacked by a path that never stamped it
            if (t - o.lastChillTime < C.HOLD_MS) return;  // held, then drained a little at a time: the bar shrinks, it doesn't vanish
            o.chillStacks = Math.max(0, o.chillStacks - C.DRAIN * dt);
            if (o.chillStacks > 0.01) { this._updateChillIndicator?.(o); return; }
            o.chillStacks = 0;
            o.lastChillTime = 0;
            // No-op for anything without a chill bar (portals, bosses), safe to call.
            if (typeof this._destroyChillIndicator === 'function') this._destroyChillIndicator(o);
        };

        for (const e of (this.enemies || [])) decay(e);
        // a cube's decay, once it's over: what wasn't locked in grows back
        const IC = this._iceCubeCfg();
        for (const e of (this.enemies || [])) {
            if (!(e._decayOwed > 0) || e._iceCube || !(e.health > 0) || this.time.now < (e._decayHoldUntil || 0)) continue;
            const heal = Math.min(e._decayOwed, (e.maxHealth || 0) * (e.isBoss ? IC.DECAY_BOSS : IC.DECAY_PCT) * dt * 1000 / IC.DECAY_REGEN_MS);
            e.health = e.health > (e.maxHealth || 0) ? e.health + heal : Math.min(e.maxHealth || e.health + heal, e.health + heal); e._decayOwed -= heal;   // (never clamps something already above max, like a test dummy) if (e._decayOwed < 0.5) e._decayOwed = 0;
            this.updateEnemyHealthBar?.(e);
        }
        // Queen slimes carry the same two fields and the same never-decaying stacks.
        for (const p of (this.portals || [])) decay(p);
        if (this.voltslimeBoss?.active)     decay(this.voltslimeBoss);
        if (this.voidSovereignBoss?.active) decay(this.voidSovereignBoss);
    }

    // ══════════════════════════════════════════════════════════════════════
    // CHILL — one application path for every ice source
    // ══════════════════════════════════════════════════════════════════════
    // This exists because the same eleven-line block was copy-pasted into nine call sites, and
    // they drifted apart exactly as you would expect. An audit found:
    //
    //   * applyIceFistsHit never incremented chillStacks AT ALL. It updated the indicator and
    //     tested `>= 3`, so the tier-1 ice weapon -- the free one everybody starts ice with --
    //     could not cube anything by itself. The branch was unreachable.
    //   * Four paths still called freezeEnemy() instead of makeIceCube(): the iceImmune helper,
    //     two updateIceShards branches, and the frost totem. Those enemies got the OLD 10-second
    //     hard stun, which also made them eligible for shatter-on-hit -- so "cubes only shatter
    //     when their timer runs out" was true for most enemies and false for ice elementals.
    //   * Weights were inconsistent per site with no way to retune them together.
    //
    // Every ice source now goes through applyChill(). Nothing else may write chillStacks.
    _chillCfg() {
        return {
            MAX: 3,
            // ONE global knob. Chill is meant to be a commitment now: ice's payoff is brittle,
            // so handing it out in three hits made the setup free. At 0.60 a direct hit is worth
            // 0.6 of the bar -- five hits to cube instead of three.
            RATE: 0.60,
            MELEE:  1.0,    // ice fists, in punching range
            DIRECT: 1.0,    // a shard, spike or mini-shard connecting
            SPLASH: 0.5,    // aoe edge, secondary targets
            TOTEM:  0.5,    // one pulse of a chill field
            IMMUNE: 1.0,    // iceImmune enemies take no ice damage, so chill is all they get
            HOLD_MS: 5000,  // chill holds this long after the last stack lands...
            BOSS: 0.5,      // the story bosses (Voltslime, the Void Sovereign) take this share of each ice hit's chill...
            BOSS_CUBE_MS: 2500, BOSS_IMMUNE_MS: 3000,   // ...are a brittle cube this long when it fills, then shrug off chill this long
            DRAIN: 0.6,     // ...then drains this many stacks a second (a full bar in 5s), the bar shrinking as it goes
        };
    }

    // weight: a named _chillCfg() weight (RATE is applied here, once).
    // Returns true only if this application was the one that cubed.
    applyChill(enemy, weight = 1, opts = {}) {
        if (!enemy || enemy.health <= 0 || !enemy.sprite?.active) return false;
        if (enemy.fireImmune || enemy.elementImmune) return false;
        if (enemy._sniperInvisible || this._phasedOut(enemy)) return false;
        // A hard freeze (ults only) is an already-spent state, not a bar to keep filling. So is a
        // cube: chill kept filling while one was up, and re-cubing reset its timer, so steady ice
        // fire held an enemy brittle forever and its shatter never came.
        if (enemy.isFrozen || enemy._iceCube) return false;

        const C = this._chillCfg();
        this.addChillStacks(enemy, weight * C.RATE);
        enemy.lastChillTime = this.time.now;

        const F = this.time.now < (this._iceFrostUntil || 0) && this._iceFrostCfg ? this._iceFrostCfg() : null;
        const inFrost = F && Math.hypot(enemy.x - this.playerX, enemy.y - this.playerY) <= F.R;   // the ice ult's freezing ring round you
        if (enemy.chillStacks < (inFrost ? C.MAX * F.THRESHOLD : C.MAX)) {
            this._updateChillIndicator?.(enemy);
            return false;
        }
        if (inFrost) opts = { ...opts, ms: F.CUBE_MS };   // and it shatters fast
        enemy.chillStacks = 0;
        enemy.frozenAt = this.time.now;
        this._destroyChillIndicator?.(enemy);
        const made = this.makeIceCube(enemy, opts.ms);
        // Ult charge stays per-site scalable, since the cannon deliberately pays less per event.
        if (made) this.gainUltCharge?.((this.ultChargePerFreeze || 0) * (opts.chargeMult ?? 1), 'ice');
        return made;
    }

    // ── Universal helper: chill/freeze iceImmune enemies ─────────────────
    // Called by every ice weapon on iceImmune hits — 3 stacks = freeze
    _applyIceElementalChill(enemy) {
        if (!enemy.iceImmune || enemy.fireImmune || enemy.elementImmune) return;
        if (enemy.isFrozen || this._phasedOut(enemy)) return;
        if (enemy.sprite?.active) {
            enemy.sprite.setTint(0x88ccff);
            this.time.delayedCall(100, () => { if (enemy.sprite?.active && !enemy.isFrozen) enemy.sprite.clearTint(); });
        }
        // Was freezeEnemy(enemy, 2200). This helper is called by EVERY ice weapon on iceImmune
        // hits, so ice elementals were the one enemy class still on the old hard-freeze system --
        // which is also why they could still be shattered on contact while nothing else could.
        this.applyChill(enemy, this._chillCfg().IMMUNE);
    }

    // ══════════════════════════════════════════════════════════════════════
    // ICE CUBES — what chill x3 produces now
    // ══════════════════════════════════════════════════════════════════════
    //
    // Chill used to hard-FREEZE: a 10-second full stop that the next ice hit shattered. Two
    // problems with that, and the second is the serious one.
    //
    // 1. Freeze was a toll booth rather than a reward. It was a state you passed through on the
    //    way to damage and it was consumed the instant you cashed it in, so the player never
    //    wanted anything to STAY frozen. That is why "the control element" read as lame.
    // 2. A 10-second stun DELETED the encounter design. The Drowner's 2s mark, the Tidal Guard's
    //    pre-aimed trident, the Wave Rider's charge tell -- every one is a telegraph the player
    //    is meant to read and dodge, and freeze answered all of them by making the enemy stop
    //    existing. With ice equipped the telegraphs were decoration.
    //
    // An ice cube instead: heavily SLOWED, not stopped, and BRITTLE -- it takes amplified damage
    // from every source. You cannot pop it early; it shatters itself when the duration runs out.
    // So ice stops competing with your main element and starts amplifying it: cube the pack,
    // switch back to lightning, and the question becomes how much you can pour in before it goes.
    //
    // Hard freeze (isFrozen) is deliberately LEFT INTACT for ults and the tsunami, where a real
    // stop is the point. Cubes do not set isFrozen, so every existing "hit a frozen enemy ->
    // shatter" path simply never fires for them.
    _iceCubeCfg() {
        return {
            DURATION_MS: 3500,   // brief -- the burst window, not a disable
            BRITTLE:     1.6,    // while cubed (what the Queen's brittle uses; everything else goes by who hits, below)
            BRITTLE_SWAP: 1.8,   // a cube takes this from fire, lightning, cosmic, anything not ice: freeze with ice, swap, hit hard
            BRITTLE_ICE:  1.2,   // ...and only this from ice, so ice sets up rather than cashing in alone
            SHATTER_SHARE: 0.28, // the shatter adds this share of what other elements dealt the cube while it held
            // DECAY, what a cube does now (not extra damage: that's Hex's job). Cubing cuts DECAY_PCT of its max HP off at once
            // (never below 1: the next hit finishes it). Damage from other elements while it holds LOCKS that much of the cut in
            // for good; what's still owed when the cube ends grows back over DECAY_REGEN_MS. Kill it in time and it's just gone.
            DECAY_PCT: 0.2, DECAY_BOSS: 0.06, DECAY_HOLD_MS: 5000, DECAY_REGEN_MS: 3000,   // (held DECAY_HOLD_MS after the cube breaks, then grows back)
            DEEP_SWAP:   2.0,    // the ice ult's Deep Freeze: other elements on a deep-frozen enemy (ice gets BRITTLE_ICE)
            DEEP_SHARE:  0.3,    // ...and its final shatter adds this share of what they dealt while it held
            SLOW_MULT:   0.8,    // EnemyManager: moveCooldown x (1 + this) = 1.8x slower (3.2x left a cube one step before it broke)
            SHATTER_DMG: 10,     // its flat part (was 26: ice could clear a room alone); the rest is SHATTER_SHARE
            DEEP_DMG:    100,    // the ice ult's Deep Freeze shatter: this flat (bosses get only this)...
            DEEP_PCT:    0.15,   // ...plus this share of the enemy's current HP (x1.5 both at ult stage 2)
            FROST_DMG:   25,     // a cube shattering during the ult's frost (the ring, Gale Storm): this flat...
            FROST_PCT:   0.03,   // ...plus this share of current HP. Small: a held enemy is cubed and shattered about every 1.5s
            MELT_MS:     6000    // how long the puddle it leaves behind lasts
        };
    }

    // ── CHILL ACCUMULATION ───────────────────────────────────────────────────
    // Chill stacks are FRACTIONAL now (range-weighted pellets, totem pulses), and floating point
    // makes that dangerous against a `>= 3` threshold: the ice totem adds 0.30 per pulse, and ten
    // pulses come to 2.9999999999999996, so an enemy sat in the field forever never cubed. The
    // bug is invisible -- the bar looks full and nothing happens.
    //
    // Rounding at the point of ADDITION rather than loosening the 14 separate `>= 3` comparisons:
    // one place to be right, and it keeps the threshold an exact integer everywhere it is read.
    addChillStacks(enemy, amount) {
        if (!enemy || this._phasedOut(enemy)) return enemy?.chillStacks || 0;
        if (enemy._immuneFx === 'ice') { if (enemy.sprite?.active && this.time.now - (enemy._fxNoAt || 0) > 900) { enemy._fxNoAt = this.time.now; this.showStatusText(enemy.sprite.x, enemy.sprite.y - 30, "CAN'T BE CHILLED", '#bff4ff'); } return 0; }   // an Adaptive Shade in its ice form
        const next = (enemy.chillStacks || 0) + (amount || 0);
        // 4dp is far finer than any weight in use and kills the drift outright.
        enemy.chillStacks = Math.round(next * 10000) / 10000;
        return enemy.chillStacks;
    }

    // Brittle, by who cashes it in: a cube takes BRITTLE_SWAP from any element but ice, BRITTLE_ICE from ice.
    _brittleMult(enemy, el) {
        const C = this._iceCubeCfg();
        if (enemy?._deepFrozen && enemy.isFrozen) return el === 'ice' ? C.BRITTLE_ICE : C.DEEP_SWAP;   // the ice ult's Deep Freeze
        return enemy?._iceCube ? 1 : enemy?._brittle || 1;   // a cube decays now (DECAY in _iceCubeCfg), it doesn't multiply
    }
    // What other elements deal a cube while it holds feeds its shatter (SHATTER_SHARE). Returns dmg untouched.
    _cubeNote(enemy, el, dmg) {
        if ((enemy?._iceCube || (enemy?._deepFrozen && enemy.isFrozen)) && el !== 'ice' && dmg > 0) enemy._cubeDealt = (enemy._cubeDealt || 0) + dmg;
        if (enemy?._iceCube && el !== 'ice' && dmg > 0 && enemy._decayOwed > 0) enemy._decayOwed = Math.max(0, enemy._decayOwed - dmg);   // locked in
        return dmg;
    }

    makeIceCube(enemy, ms) {
        if (!enemy?.sprite?.active) return false;
        const C = this._iceCubeCfg();
        const dur = ms || C.DURATION_MS;
        const now = this.time.now;

        // Re-cubing refreshes rather than stacking, so chill spam cannot hold something
        // permanently brittle.
        const fresh = !enemy._iceCube;
        if (fresh) enemy._cubeDealt = 0;
        enemy._iceCube = true;
        enemy._iceCubeUntil = now + dur;
        enemy._brittle = C.BRITTLE;

        // Rides the EXISTING slow system rather than inventing a second one, which also means
        // the up/down arrow indicators appear for free.
        enemy.isSlowed = true;
        enemy._slowMult = Math.max(enemy._slowMult || 0, C.SLOW_MULT);
        enemy.slowedUntil = Math.max(enemy.slowedUntil || 0, enemy._iceCubeUntil);
        this._setSpeedIndicator?.(enemy, 'icecube', 'slow_ice', true, 300);

        if (fresh) {
            const chunk = Math.round((enemy.maxHealth || 0) * (enemy.isBoss ? C.DECAY_BOSS : C.DECAY_PCT));
            const cut = Math.min(chunk - (enemy._decayOwed || 0), Math.floor(enemy.health - 1));   // capped at one chunk: a re-cube tops it up, it doesn't stack another
            if (cut > 0) { enemy.health -= cut; enemy._decayOwed = (enemy._decayOwed || 0) + cut; this.updateEnemyHealthBar?.(enemy); }   // decay
            this.showStatusText?.(enemy.sprite.x, enemy.sprite.y - 16, 'BRITTLE', '#88eeff');
            this._drawIceCube(enemy);
        }
        if (enemy._iceCubeTimer) enemy._iceCubeTimer.remove();
        enemy._iceCubeTimer = this.time.delayedCall(dur, () => this.shatterIceCube(enemy));
        return true;
    }

    // Uses createFreezeVisual -- the SAME ice block a hard freeze has always drawn. The first
    // version hand-drew a flat square with a couple of lines, which looked cheap next to it for
    // no reason: the good visual already existed.
    //
    // Reusing it also fixes cleanup for free. killEnemy already tears down enemy.freezeVisuals,
    // so a cube on a dying enemy is disposed of by code that was already there -- the hand-rolled
    // graphic was invisible to that and got orphaned on the floor.
    //
    // Brittle is distinguished from a hard freeze by CRACK LINES pushed into _extraLayers, which
    // every existing teardown path already walks. The block should look like it is about to come
    // apart, because that is what brittle means.
    _drawIceCube(enemy) {
        if (!enemy.sprite?.active) return;
        this.createFreezeVisual(enemy);
        const fv = enemy.freezeVisuals;
        if (!fv?.iceBlock) return;

        const bx = fv.iceBlock.x, by = fv.iceBlock.y;
        const cracks = this.add.graphics().setDepth((fv.iceBlock.depth || 2.9) + 0.05);
        cracks.x = bx; cracks.y = by;
        cracks.lineStyle(1.1, 0xffffff, 0.75);
        for (const [x1, y1, x2, y2] of [[-9, -3, 1, 4], [4, -9, -2, 1], [-2, 2, 7, 8], [6, 0, 9, -6]]) {
            cracks.beginPath(); cracks.moveTo(x1, y1); cracks.lineTo(x2, y2); cracks.strokePath();
        }
        this.tweens.add({ targets: cracks, alpha: 0.35, duration: 380, yoyo: true, repeat: -1 });

        fv._extraLayers = fv._extraLayers || [];
        fv._extraLayers.push(cracks);
        if (fv.iceBlock._extraLayers) fv.iceBlock._extraLayers.push(cracks);
        enemy._iceCubeGfx = fv.iceBlock;   // kept only so the sweep can follow the sprite
    }

    _clearIceCubeVisual(enemy) {
        // Delegates to the shared teardown rather than destroying a private graphic, so there is
        // one place that knows how to dismantle an ice block.
        if (typeof this._clearFreezeVisuals === 'function') this._clearFreezeVisuals(enemy);
        enemy._iceCubeGfx = null;
    }

    // Self-shatter on expiry. Deals its own damage and leaves a water pool, matching what a
    // natural freeze-melt already did, so the floor's water systems behave the same.
    shatterIceCube(enemy) {
        if (!enemy || !enemy._iceCube) return 0;
        const C = this._iceCubeCfg();
        enemy._iceCube = false;
        enemy._brittle = 1;
        enemy._decayHoldUntil = this.time.now + C.DECAY_HOLD_MS;   // the decay stays a while after it breaks
        enemy._iceCubeUntil = 0;
        if (enemy._iceCubeTimer) { enemy._iceCubeTimer.remove(); enemy._iceCubeTimer = null; }
        this._clearIceCubeVisual(enemy);
        this._setSpeedIndicator?.(enemy, 'icecube', 'slow_ice', false);
        if (!enemy.sprite?.active) return 0;

        const ex = enemy.sprite.x, ey = enemy.sprite.y;
        for (let i = 0; i < 9; i++) {
            const a = (i / 9) * Math.PI * 2;
            const sh = this.add.rectangle(ex, ey, 4, 9, 0xaaffff, 1).setDepth(4).setRotation(a);
            this.tweens.add({ targets: sh, x: ex + Math.cos(a) * 26, y: ey + Math.sin(a) * 26,
                              alpha: 0, scaleX: 0.3, scaleY: 0.3, duration: 320,
                              ease: 'Quad.easeOut', onComplete: () => sh.destroy() });
        }
        VisualFX.impact(this, ex, ey - 4, 'ice', 22);
        this.showStatusText?.(ex, ey - 26, 'SHATTER!', '#aaffff');
        this.cameras.main.shake(40, 0.002);

        // Its own damage is tagged 'ice' and routed through the table like everything else.
        // Note it does NOT benefit from its own brittle -- brittle is cleared above, on purpose,
        // so the shatter is a flat payoff rather than squaring the multiplier.
        const dealt = enemy._cubeDealt || 0; enemy._cubeDealt = 0;
        const frost = this.time.now < (this._iceFrostUntil || 0);   // the ice ult's frost: a bigger flat part and a bite of its current HP
        const raw = (frost ? C.FROST_DMG : C.SHATTER_DMG) * (this.damageScaling || 1) + (frost ? C.FROST_PCT * Math.max(0, enemy.health) : 0) + C.SHATTER_SHARE * dealt;   // flat, plus a share of what the other elements put into it
        if (dealt > 40) { VisualFX.impact(this, ex, ey - 4, 'ice', 34); this.cameras.main.shake(80, 0.004); }   // a big one: it went off
        const _rdCube = this.resolveElementalHit(enemy, raw, 'ice', true);   // escape hatch
        if (_rdCube !== null) {
            enemy.health -= _rdCube;
            this.showDamageNumber?.(ex, ey - 40, Math.round(_rdCube), '#ffffff');
            this.updateEnemyHealthBar?.(enemy);
            this.gainUltCharge?.(this.ultChargePerFreeze || 0, 'ice');
            if (enemy.health <= 0) this.killEnemy(enemy);
        }
        // ── LEAVES A REAL PUDDLE ─────────────────────────────────────────────
        // _shatterWaterSplash is DECORATION ONLY. It animates expanding rings into its own
        // `activeWaterTiles` list, which nothing outside that function ever reads -- it has never
        // called addWater, so shattering has never produced water the game could see. On a
        // flooded floor that is the wrong answer twice over: the melt should be real, and real
        // water feeds conduction, Drowners, Ripplerunners and the player slow.
        this._shatterWaterSplash?.(enemy.x, enemy.y);          // the visual
        if (typeof this.addWater === 'function') {             // and the actual water
            const C2 = this._iceCubeCfg();
            let made = 0;
            for (const [dx, dy] of [[0,0],[1,0],[-1,0],[0,1],[0,-1]]) {
                if (this.addWater(enemy.x + dx, enemy.y + dy, C2.MELT_MS)) made++;
            }
            // Timed, not permanent: a melted cube is a puddle, and permanent pools are the
            // pipes' job. Without a lifetime, a room full of cubes would flood itself for good
            // and hand every Drowner in it a standing buff.
            if (made) this._lastMeltTiles = made;
        }
        return raw;
    }

    // Safety net: a cube on an enemy that dies, or whose timer is lost to a scene change, must
    // not leave a floating block of ice behind.
    updateIceCubes(time) {
        for (const e of (this.enemies || [])) {
            if (!e._iceCube) continue;
            if (!e.sprite?.active || e.health <= 0) {
                e._iceCube = false; e._brittle = 1;
                if (e._iceCubeTimer) { e._iceCubeTimer.remove(); e._iceCubeTimer = null; }
                this._clearIceCubeVisual(e);
                continue;
            }
            // The shared ice block is positioned by createFreezeVisual and does not track a
            // moving sprite, so a heavily-slowed-but-still-walking enemy would leave it behind.
            const fv = e.freezeVisuals;
            if (fv?.iceBlock?.active) {
                const dx = e.sprite.x - fv.iceBlock.x, dy = (e.sprite.y + 4) - fv.iceBlock.y;
                if (dx || dy) {
                    fv.iceBlock.x += dx; fv.iceBlock.y += dy;
                    for (const l of (fv._extraLayers || [])) { if (l.active) { l.x += dx; l.y += dy; } }
                    if (fv.iceBorder?.active) { fv.iceBorder.x += dx; fv.iceBorder.y += dy; }
                }
            }
            if (time >= e._iceCubeUntil) this.shatterIceCube(e);
        }
    }

    freezeEnemy(enemy, duration) {
        if (enemy.health > 0 && this._phasedOut(enemy)) return;   // phased out: immune to freeze
        if (enemy.health <= 0) {
            // Clear any existing freeze visuals on dead enemies
            if (enemy.freezeVisuals) {
                if (enemy.freezeVisuals._extraLayers) {
                    for (const l of enemy.freezeVisuals._extraLayers) { this.tweens.killTweensOf(l); l.destroy(); }
                }
                if (enemy.freezeVisuals.iceBlock) {
                    this.tweens.killTweensOf(enemy.freezeVisuals.iceBlock);
                    enemy.freezeVisuals.iceBlock.setVisible(false);
                    enemy.freezeVisuals.iceBlock.destroy();
                }
                if (enemy.freezeVisuals.iceBorder) {
                    this.tweens.killTweensOf(enemy.freezeVisuals.iceBorder);
                    enemy.freezeVisuals.iceBorder.setVisible(false);
                    enemy.freezeVisuals.iceBorder.destroy();
                }
                enemy.freezeVisuals = null;
            }
            return;
        }
        // Clear existing freeze visuals if already frozen
        if (enemy.isFrozen && enemy.freezeVisuals) {
            if (enemy.freezeVisuals._extraLayers) {
                for (const l of enemy.freezeVisuals._extraLayers) { this.tweens.killTweensOf(l); l.destroy(); }
            }
            if (enemy.freezeVisuals.iceBlock) {
                this.tweens.killTweensOf(enemy.freezeVisuals.iceBlock);
                enemy.freezeVisuals.iceBlock.setVisible(false);
                enemy.freezeVisuals.iceBlock.destroy();
            }
            if (enemy.freezeVisuals.iceBorder) {
                this.tweens.killTweensOf(enemy.freezeVisuals.iceBorder);
                enemy.freezeVisuals.iceBorder.setVisible(false);
                enemy.freezeVisuals.iceBorder.destroy();
            }
            enemy.freezeVisuals = null;
        }
        if (!enemy.isFrozen) Sfx.play(this, 'freeze');
        enemy.isFrozen = true;
        enemy.frozenUntil = this.time.now + duration;
        enemy.frozenAt = this.time.now;
        enemy._shatterTriggered = false;
        // Cancel any previous thaw timer
        if (enemy._thawTimer) { enemy._thawTimer.remove(); enemy._thawTimer = null; }
        // Auto-thaw: destroy freeze visuals when freeze expires
        enemy._thawTimer = this.time.delayedCall(duration, () => {
            if (!enemy.sprite?.active) return;
            enemy.isFrozen = false;
            enemy.frozenUntil = 0;
            if (typeof this._clearFreezeVisuals === 'function') this._clearFreezeVisuals(enemy);
            enemy._thawTimer = null;
        });
        this.createFreezeVisual(enemy);
        if (enemy.sprite && enemy.sprite.active) {
            this.showStatusText(enemy.sprite.x, enemy.sprite.y, 'FROZEN', '#88eeff');
        }
    }

    updateSlowEffect(enemy) {
        // Visual handled by tint; nothing extra needed
    }

    spawnIceSplinter(x, y) {
        const numShards = 6;
        for (let i = 0; i < numShards; i++) {
            const angle = (Math.PI * 2 / numShards) * i + Math.random() * 0.5;
            const dist = 15 + Math.random() * 20;
            const shard = this.add.rectangle(x, y, 4, 10, 0xaaddff, 0.9);
            shard.setRotation(angle);
            this.tweens.add({
                targets: shard,
                x: x + Math.cos(angle) * dist,
                y: y + Math.sin(angle) * dist,
                alpha: 0, scaleX: 0.5, scaleY: 0.5,
                duration: 350 + Math.random() * 150, ease: 'Quad.easeOut',
                onComplete: () => shard.destroy()
            });
        }
        // Freeze flash
        const flash = this.add.circle(x, y, 14, 0xffffff, 0.8);
        this.tweens.add({ targets: flash, radius: 22, alpha: 0, duration: 200, onComplete: () => flash.destroy() });
    }

    // ─── LIGHTNING THUNDERHEAD ─────────────────────────────────────────

    snapToNearestFloor(pixelX, pixelY) {
        const originTX = Math.floor(pixelX / this.TILE_SIZE);
        const originTY = Math.floor(pixelY / this.TILE_SIZE);

        // Already on a floor tile
        if (originTX >= 0 && originTX < this.WORLD_WIDTH &&
            originTY >= 0 && originTY < this.WORLD_HEIGHT &&
            this.world[originTX][originTY] === this.FLOOR) {
            return {
                tx: originTX, ty: originTY,
                px: originTX * this.TILE_SIZE + this.TILE_SIZE / 2,
                py: originTY * this.TILE_SIZE + this.TILE_SIZE / 2
            };
        }

        // Search outward in rings
        for (let r = 1; r <= 5; r++) {
            for (let dx = -r; dx <= r; dx++) {
                for (let dy = -r; dy <= r; dy++) {
                    if (Math.abs(dx) !== r && Math.abs(dy) !== r) continue; // only ring edge
                    const tx = originTX + dx;
                    const ty = originTY + dy;
                    if (tx >= 0 && tx < this.WORLD_WIDTH && ty >= 0 && ty < this.WORLD_HEIGHT && this.world[tx][ty] === this.FLOOR) {
                        return {
                            tx, ty,
                            px: tx * this.TILE_SIZE + this.TILE_SIZE / 2,
                            py: ty * this.TILE_SIZE + this.TILE_SIZE / 2
                        };
                    }
                }
            }
        }
        return null;
    }

    damageEnemyIce(enemy, damage) {
        // Same gate as damageEnemy, and it had the same tutorial-only bug: ice could reach
        // into a sealed room on every level except the tutorial. Two copies of one rule is
        // how they drifted apart in the first place.
        if (typeof this._roomGated === 'function' && this._roomGated()
            && enemy.tutorialRoomIndex !== undefined) {
            if (enemy.tutorialRoomIndex !== this.getCurrentPlayerRoom()) return;
        }
        // Missing entirely until now: ice was a clean way to kill a phased sniper.
        if (this._phasedOut(enemy)) {
            if (enemy.sprite?.active && this.time.now - (enemy._phasedAt || 0) > 500) { enemy._phasedAt = this.time.now; this.showStatusText(enemy.sprite.x, enemy.sprite.y - 10, enemy._isGem ? 'UNBREAKABLE' : 'INVISIBLE', enemy._isGem ? '#d8e8ff' : '#9922cc'); }
            return;
        }
        // Fire elementals are immune to all ice damage
        if (enemy.fireImmune) {
            if (enemy.sprite?.active) this.showStatusText(enemy.sprite.x, enemy.sprite.y - 10, 'IMMUNE', '#ff8844');
            return;
        }
        if (enemy.iceImmune) {
            // If already frozen (by pierce spike), shatter immediately on any ice hit (not the ult's Deep Freeze)
            if (enemy.isFrozen && !enemy._deepFrozen) {
                this._triggerShatterBurst(enemy);
                return;
            }
            // Route through the universal helper — chill stacks toward freeze
            this._applyIceElementalChill(enemy);
            if (damage > 0 && enemy.isFrozen) {
                // Shatter: 2× damage
                const shatterDmg = damage * 2;
                const _rd1329 = this.resolveElementalHit(enemy, shatterDmg, 'ice');
                if (_rd1329 === null) return;
                enemy.health -= _rd1329;
                this.gainUltCharge(this.ultChargePerHit * 2);
                this.showDamageNumber(enemy.sprite.x, enemy.sprite.y, _rd1329, '#ffffff');
                this.showStatusText(enemy.sprite.x, enemy.sprite.y - 18, 'SHATTER!', '#aaffff');
                enemy.isFrozen = false;
                enemy.frozenUntil = 0;
                if (enemy.freezeVisuals) {
                    if (enemy.freezeVisuals._extraLayers) {
                        for (const l of enemy.freezeVisuals._extraLayers) { this.tweens.killTweensOf(l); l.destroy(); }
                    }
                    if (enemy.freezeVisuals.iceBlock?._extraLayers) {
                        for (const l of enemy.freezeVisuals.iceBlock._extraLayers) { this.tweens.killTweensOf(l); l.destroy(); }
                    }
                    ['iceBlock', 'iceBorder'].forEach(k => {
                        if (enemy.freezeVisuals[k]) { this.tweens.killTweensOf(enemy.freezeVisuals[k]); enemy.freezeVisuals[k].destroy(); }
                    });
                    enemy.freezeVisuals = null;
                }
                enemy.sprite.clearTint();
                this.updateEnemyHealthBar(enemy);
                if (enemy.health <= 0) this.killEnemy(enemy);
            }
            return;
        }

        const frozenBonus = enemy.isFrozen && !enemy._deepFrozen ? 2.5 : 1;
        if (enemy.isFrozen && !enemy._deepFrozen) this._triggerShatterBurst(enemy);
        const actualDamage = damage * frozenBonus;
        const _rd1359 = this.resolveElementalHit(enemy, actualDamage, 'ice');
        if (_rd1359 === null) return;
        enemy.health -= _rd1359;
        this.gainUltCharge(this.ultChargePerHit);

        if (enemy.sprite && enemy.sprite.active) {
            this.showDamageNumber(enemy.sprite.x, enemy.sprite.y, actualDamage, '#88eeff');
        }

        if (enemy.health > 0) {
            const wasSlowed2 = enemy.isSlowed;
            enemy.isSlowed = true;
            enemy.slowedUntil = this.time.now + this.slowDuration;
            if (!wasSlowed2 && enemy.sprite?.active) {
                if (enemy._slowIndTimer) { enemy._slowIndTimer.remove(); }
                enemy._slowIndTimer = this._startSpeedIndicator(
                    () => enemy.sprite?.active ? { x: enemy.sprite.x, y: enemy.sprite.y - 10 } : null,
                    'slow_ice', 320
                );
            }
        }

        // Same legacy random stun as in damageEnemy, 10% here. A cube instead.
        if (enemy.health > 0 && Math.random() < 0.1 && !enemy._iceCube) {
            this.makeIceCube(enemy, 2000);
            this.gainUltCharge(this.ultChargePerFreeze, 'ice');
        }

        if (!enemy.isFrozen) {
            enemy.sprite.setTint(0x00ffff);
            this.time.delayedCall(100, () => {
                if (enemy.sprite && enemy.sprite.active && !enemy.isFrozen) {
                    enemy.sprite.clearTint();
                }
            });
        }

        this.updateEnemyHealthBar(enemy);

        if (enemy.health <= 0) {
            this.killEnemy(enemy);
        }
    }

    createFreezeVisual(enemy) {
        const bx = enemy.sprite.x;
        const blockY = enemy.sprite.y + 10;
        const sz = this.TILE_SIZE * 0.82;
        const depth = (enemy.sprite.depth || 1) + 0.5;

        // Layer 1 — deep ice base, slightly transparent
        const iceBlock = this.add.rectangle(bx, blockY, sz, sz, 0x336699, 0.72).setDepth(depth);

        // Layer 2 — border outline
        const iceBorder = this.add.graphics().setDepth(depth + 0.1);
        iceBorder.lineStyle(2, 0xaaddff, 0.90);
        iceBorder.strokeRect(-sz / 2, -sz / 2, sz, sz);
        iceBorder.x = bx; iceBorder.y = blockY;

        // Layer 3 — inner bright face (top-left highlight)
        const highlight = this.add.graphics().setDepth(depth + 0.2);
        highlight.fillStyle(0xddf4ff, 0.38);
        highlight.fillRect(-sz / 2 + 3, -sz / 2 + 3, sz * 0.48, sz * 0.48);
        highlight.x = bx; highlight.y = blockY;

        // Layer 4 — gloss streaks
        const gloss = this.add.graphics().setDepth(depth + 0.3);
        gloss.lineStyle(2.5, 0xffffff, 0.55);
        gloss.beginPath();
        gloss.moveTo(-sz * 0.28, -sz * 0.30);
        gloss.lineTo(sz * 0.05, -sz * 0.02);
        gloss.strokePath();
        gloss.lineStyle(1.2, 0xffffff, 0.30);
        gloss.beginPath();
        gloss.moveTo(-sz * 0.18, -sz * 0.36);
        gloss.lineTo(sz * 0.14, -sz * 0.08);
        gloss.strokePath();
        gloss.x = bx; gloss.y = blockY;

        // Layer 5 — bright corner dot
        const dot = this.add.graphics().setDepth(depth + 0.4);
        dot.fillStyle(0xffffff, 0.90);
        dot.fillCircle(-sz * 0.26, -sz * 0.26, 2.5);
        dot.x = bx; dot.y = blockY;

        // Pulse all layers together
        const allLayers = [iceBlock, iceBorder, highlight, gloss, dot];
        this.tweens.add({
            targets: allLayers,
            alpha: { from: 0.85, to: 0.55 },
            duration: 550,
            yoyo: true,
            repeat: -1,
            ease: 'Sine.easeInOut'
        });

        if (enemy.sprite?.active && typeof enemy.sprite.setTint === 'function') {
            enemy.sprite.setTint(0x88ccff);
        }

        // Store extras on iceBlock for cleanup (iceBlock/iceBorder already handled elsewhere)
        iceBlock._extraLayers = [highlight, gloss, dot];

        enemy.freezeVisuals = {
            iceBlock,
            iceBorder,
            _extraLayers: [highlight, gloss, dot]
        };
    }

    showShieldBlock(blockedAmount) {
        if (this._cfxShieldBlock?.(blockedAmount)) return;   // Creatures.js draws it
        const shield = this.add.circle(
            this.player.x,
            this.player.y - 20,
            12,
            0x00ccff,
            0.8
        );

        const shieldBorder = this.add.circle(
            this.player.x,
            this.player.y - 20,
            12
        );
        shieldBorder.setStrokeStyle(3, 0xffffff, 1);

        const blockText = this.add.text(
            this.player.x,
            this.player.y - 20,
            `-${blockedAmount.toFixed(1)}`,
            {
                fontSize: '14px',
                fontFamily: 'monospace',
                color: '#ffffff',
                stroke: '#00ccff',
                strokeThickness: 3,
                fontStyle: 'bold'
            }
        ).setOrigin(0.5);

        this.tweens.add({
            targets: [shield, shieldBorder, blockText],
            y: this.player.y - 40,
            scaleX: 1.5,
            scaleY: 1.5,
            alpha: 0,
            duration: 800,
            ease: 'Quad.easeOut',
            onComplete: () => {
                shield.destroy();
                shieldBorder.destroy();
                blockText.destroy();
            }
        });
    }

    // `radius` / `ratio` override the defaults (Magma Staff passes a smaller splash).
    fireballSplash(pixelX, pixelY, directDamage, directEnemy, radius = this.fireballSplashRadius, ratio = this.fireballSplashDamageRatio) {
        const splashDamage = directDamage * ratio;
        const splashTileX = Math.floor(pixelX / this.TILE_SIZE);
        const splashTileY = Math.floor(pixelY / this.TILE_SIZE);

        for (let enemy of [...this.enemies]) {
            if (this._phasedOut?.(enemy)) continue;
            if (enemy === directEnemy) continue;
            const dist = Math.abs(enemy.x - splashTileX) + Math.abs(enemy.y - splashTileY);
            if (dist <= radius) {
                // Fire elementals are immune to physical/fire hits — fireball splash is fire damage
                if (enemy.fireImmune) {
                    if (enemy.sprite?.active) this.showStatusText(enemy.sprite.x, enemy.sprite.y - 10, 'IMMUNE', '#ff8844');
                    continue;
                }
                // Ice elementals are immune to all physical damage — fireball splash cannot hurt them
                if (enemy.iceImmune) {
                    if (enemy.sprite?.active) this.showStatusText(enemy.sprite.x, enemy.sprite.y - 10, 'IMMUNE', '#88eeff');
                    continue;
                }
                if (this._phasedOut(enemy)) continue;   // phased out: not in the world
                const _rd1534 = this.resolveElementalHit(enemy, splashDamage, 'fire');
                if (_rd1534 === null) continue;
                enemy.health -= _rd1534;
                if (typeof this.applyBurnStack === 'function') this.applyBurnStack(enemy);   // the splash burns too
                this.updateEnemyHealthBar(enemy);
                if (enemy.health <= 0) this.killEnemy(enemy);
            }
        }

        // Splash visual ring
        const ring = this.add.circle(pixelX, pixelY, 4, 0xff6600, 0.6);
        ring.setStrokeStyle(2, 0xffaa00, 0.8);
        this.tweens.add({
            targets: ring,
            radius: this.fireballSplashRadius * this.TILE_SIZE,
            alpha: 0,
            duration: 250,
            ease: 'Quad.easeOut',
            onComplete: () => ring.destroy()
        });
    }

    // dmgOverride: when present, replaces the flat burst below. Added for the Kindling
    // Brand, whose payload is accumulated rather than fixed. Optional, so the ult path
    // that was this function's only caller is unchanged.
    triggerCombustion(enemy, isUlt, dmgOverride) {
        if (!enemy.sprite || !enemy.sprite.active) return;

        // Ice elementals are fully immune to combustion (all physical/fire damage)
        if (enemy.iceImmune) {
            this.showStatusText(enemy.sprite.x, enemy.sprite.y - 10, 'IMMUNE', '#88eeff');
            return;
        }

        enemy.combustionTriggered = true;

        // Fire elementals are immune to the burst damage itself, but the lava ring
        // created below will still deal environmental fire damage to them
        if (enemy.fireImmune) {
            this.showStatusText(enemy.sprite.x, enemy.sprite.y - 10, 'IMMUNE', '#ff8844');
            // Still create the lava explosion ring — fire-immune enemies can still be hurt by lava
            const cx = enemy.sprite.x, cy = enemy.sprite.y;
            this.ignitionExplodeEnemy(enemy);
            const ring = this.add.circle(cx, cy, 12, 0xff8800, 0);
            ring.setStrokeStyle(3, 0xffcc00, 0.9).setDepth(3);
            this.tweens.add({ targets: ring, radius: 2 * this.TILE_SIZE + 8, alpha: 0, duration: 300, ease: 'Quad.easeOut', onComplete: () => ring.destroy() });
            enemy.combustionTriggered = false;
            return;
        }

        // Burst damage: flat amount scaled by ult bonus
        // Combustion cashes the burn in: +8 per stack (WeaponSystem._burnCfg), and they're spent.
        const _stacks = Math.min(5, enemy.burnStacks || 0);
        const burstDamage = ((dmgOverride !== undefined && dmgOverride !== null)
            ? dmgOverride
            : (isUlt ? 30 : 15) * this.damageScaling)
            + (this._burnCfg?.().COMBUST_PER_STACK ?? 8) * _stacks * this.damageScaling;
        if (this._phasedOut(enemy)) return;   // phased out: not in the world
        const _rd1597 = this.resolveElementalHit(enemy, burstDamage, 'fire');
        if (_rd1597 === null) return;
        enemy.health -= _rd1597;
        enemy.isBurning = false;
        enemy.burnUntil = 0;
        enemy.burnStacks = 0;   // spent
        this._recalcMagmaFireballCount?.();
        this.clearBurnVisual(enemy);
        if (enemy.sprite && enemy.sprite.active) enemy.sprite.clearTint();

        const cx = enemy.sprite.x;
        const cy = enemy.sprite.y;

        // Central explosion core
        const core = this.add.circle(cx, cy, 6, 0xffffff, 1);
        const mid = this.add.circle(cx, cy, 12, 0xff6600, 0.85);
        const outer = this.add.circle(cx, cy, 18, 0xff2200, 0.55);
        const glow = this.add.circle(cx, cy, 30, 0xffaa00, 0.3);

        this.tweens.add({ targets: core,  radius: 24, alpha: 0, duration: 300, ease: 'Quad.easeOut', onComplete: () => core.destroy() });
        this.tweens.add({ targets: mid,   radius: 40, alpha: 0, duration: 400, ease: 'Quad.easeOut', onComplete: () => mid.destroy() });
        this.tweens.add({ targets: outer, radius: 55, alpha: 0, duration: 500, ease: 'Quad.easeOut', onComplete: () => outer.destroy() });
        this.tweens.add({ targets: glow,  radius: 70, alpha: 0, duration: 600, ease: 'Quad.easeOut', onComplete: () => glow.destroy() });

        // Ember particles
        for (let i = 0; i < 10; i++) {
            const angle = Math.random() * Math.PI * 2;
            const spd = 40 + Math.random() * 60;
            const ember = this.add.circle(cx, cy, 2 + Math.random() * 2, 0xff6600, 1);
            this.tweens.add({
                targets: ember,
                x: cx + Math.cos(angle) * spd,
                y: cy + Math.sin(angle) * spd,
                alpha: 0, duration: 400 + Math.random() * 200,
                ease: 'Quad.easeOut', onComplete: () => ember.destroy()
            });
        }

        // Damage number pop
        const txt = this.add.text(cx, cy - 20, `COMBUSTION!\n${_rd1597.toFixed(0)}`, {
            fontSize: '13px', fontFamily: 'monospace', color: '#ffaa00',
            stroke: '#000', strokeThickness: 3, fontStyle: 'bold', align: 'center'
        }).setOrigin(0.5);
        this.tweens.add({ targets: txt, y: cy - 50, alpha: 0, duration: 900, ease: 'Quad.easeOut', onComplete: () => txt.destroy() });

        this.updateEnemyHealthBar(enemy);
        if (enemy.health <= 0) this.killEnemy(enemy);
        else { enemy.combustionTriggered = false; }
    }

    // opts.superBurn: white-hot for its duration, Super Burning what stands in it instead of a burn stack (the fire ult's meteor pools)
    spawnIgnitionTrail(x, y, duration = null, opts = {}) {
        const tileX = Math.floor(x / this.TILE_SIZE);
        const tileY = Math.floor(y / this.TILE_SIZE);
        const tilePixelX = tileX * this.TILE_SIZE + this.TILE_SIZE / 2;
        const tilePixelY = tileY * this.TILE_SIZE + this.TILE_SIZE / 2;

        // If tile already exists, upgrade duration if the new one is longer (e.g. explosion over ripple)
        const existing = this.ignitionPierceTrails.find(t => t.tileX === tileX && t.tileY === tileY);
        if (existing) {
            const newDur = duration ?? this.ignitionTrailDuration;
            if (opts.superBurn) { existing.superUntil = this.time.now + newDur; existing.visuals[2]?.setTint?.(0xfff0c0); }
            const existingDur = existing.customDuration ?? this.ignitionTrailDuration;
            const timeLeft = existingDur - (this.time.now - existing.createdAt);
            if (newDur > timeLeft) {
                existing.createdAt = this.time.now;
                existing.customDuration = newDur;
            }
            return;
        }

        // Lava tile: a molten slab with flickering glows (Visuals.js); TD keeps the rectangles.
        let base, glow, core;
        if (this._vfxLavaTile) {
            [base, glow, core] = this._vfxLavaTile(tilePixelX, tilePixelY);
        } else {
            base = this.add.rectangle(tilePixelX, tilePixelY, this.TILE_SIZE, this.TILE_SIZE, 0xcc2200, 0.85).setDepth(0.5);
            glow = this.add.rectangle(tilePixelX, tilePixelY, this.TILE_SIZE - 4, this.TILE_SIZE - 4, 0xff6600, 0.6).setDepth(0.5);
            core = this.add.rectangle(tilePixelX, tilePixelY, this.TILE_SIZE - 10, this.TILE_SIZE - 10, 0xffaa00, 0.4).setDepth(0.5);
            // Shimmer animation on the inner layers
            this.tweens.add({ targets: glow, alpha: 0.9, duration: 180, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
            this.tweens.add({ targets: core, alpha: 0.7, scaleX: 0.85, scaleY: 0.85, duration: 130, yoyo: true, repeat: -1, ease: 'Sine.easeInOut', delay: 60 });
        }

        if (opts.superBurn) { glow.setTint?.(0xff8a2a); core.setTint?.(0xfff0c0); }   // white-hot
        this.ignitionPierceTrails.push({
            visuals: [base, glow, core],
            createdAt: this.time.now,
            lastDamageTick: 0,
            tileX, tileY, x: tilePixelX, y: tilePixelY,
            customDuration: duration,
            superUntil: opts.superBurn ? this.time.now + (duration ?? this.ignitionTrailDuration) : 0
        });
    }

    updateIgnitionTrails(time) {
        // the lava's sound: a sizzle held while any is near you, fuller the more there is, a bubble bursting now and then
        if (this.ignitionPierceTrails.length && time - (this._lavaSfxAt || 0) > 150) {
            this._lavaSfxAt = time;
            const n = this.ignitionPierceTrails.filter(t => Math.abs(t.tileX - this.playerX) <= 12 && Math.abs(t.tileY - this.playerY) <= 8).length;
            if (n) { Sfx.sustain(this, 'lava', 320, Math.min(1, 0.35 + n / 12)); if (Math.random() < 0.25) Sfx.play(this, 'lava_pop'); }
        }
        for (let i = this.ignitionPierceTrails.length - 1; i >= 0; i--) {
            const t = this.ignitionPierceTrails[i];
            const age = time - t.createdAt;

            const trailDur = t.customDuration ?? this.ignitionTrailDuration;
            if (age > trailDur) {
                for (const v of t.visuals) { this.tweens.killTweensOf(v); v.destroy(); }
                this.ignitionPierceTrails.splice(i, 1);
                continue;
            }

            // Fade out in the last 400ms
            if (age > trailDur - 400) {
                const fadeAlpha = 1 - (age - (trailDur - 400)) / 400;
                for (const v of t.visuals) v.setAlpha(v.alpha * fadeAlpha);
            }

            // Lava feeds the burn: anything standing in it gains a stack every LAVA_MS. It deals no
            // damage of its own any more (it ticked 0.8 every 80ms on top of the burn, 10 DPS a
            // tile, which is most of why fire was the strongest thing against a single target).
            if (time - t.lastDamageTick >= 100) {
                t.lastDamageTick = time;
                const LAVA_MS = this._burnCfg?.().LAVA_MS ?? 500;
                for (const enemy of [...this.enemies]) {
                    if (enemy.x !== t.tileX || enemy.y !== t.tileY) continue;
                    if (enemy.iceImmune) continue;
                    // not in rooms the player isn't in (tutorial AND level 2)
                    if (this._roomGated() && enemy.tutorialRoomIndex !== undefined &&
                        enemy.tutorialRoomIndex !== this.getCurrentPlayerRoom()) continue;
                    if (this._phasedOut(enemy)) continue;
                    if (time - (enemy._lastLavaBurnStack ?? -1e9) < LAVA_MS) continue;
                    enemy._lastLavaBurnStack = time;
                    if (t.superUntil > time) this.applySuperBurn?.(enemy, 1);
                    else if (typeof this.applyBurnStack === 'function') this.applyBurnStack(enemy);
                    Sfx.play(this, 'sear');
                }
                // A boss in the lava: one stack per LAVA_MS however many lava tiles it covers.
                const vb = this.voltslimeBoss;
                if (vb?.active && vb.container) {
                    const bTileX = Math.floor(vb.container.x / this.TILE_SIZE);
                    const bTileY = Math.floor(vb.container.y / this.TILE_SIZE);
                    if (Math.abs(bTileX - t.tileX) <= 1 && Math.abs(bTileY - t.tileY) <= 1
                        && time - (vb._lastLavaBurnStack ?? -1e9) >= LAVA_MS) {
                        vb._lastLavaBurnStack = time;
                        if (typeof this.applyBurnStackBoss === 'function') this.applyBurnStackBoss(1, vb);
                    }
                }
                const vs = this.voidSovereignBoss;
                if (vs?.active && Math.abs(vs.tileX - t.tileX) <= 2 && Math.abs(vs.tileY - t.tileY) <= 2
                    && time - (vs._lastLavaBurnStack ?? -1e9) >= LAVA_MS) {
                    vs._lastLavaBurnStack = time;
                    if (typeof this.applyBurnStackBoss === 'function') this.applyBurnStackBoss(1, vs);
                }
            }
        }
    }

    // ─── ICE HELPERS ──────────────────────────────────────────────────

    ignitionExplodeEnemy(enemy) {
        if (!enemy.sprite || !enemy.sprite.active) return;
        const ex = enemy.sprite.x, ey = enemy.sprite.y;
        const radius = 2; // tiles

        // Spawn lava tiles in a circle around the enemy
        for (let dx = -radius; dx <= radius; dx++) {
            for (let dy = -radius; dy <= radius; dy++) {
                if (dx * dx + dy * dy > radius * radius) continue;
                const tx = enemy.x + dx, ty = enemy.y + dy;
                if (tx < 0 || tx >= this.WORLD_WIDTH || ty < 0 || ty >= this.WORLD_HEIGHT) continue;
                if (this.world[tx][ty] !== this.FLOOR) continue;
                this.spawnIgnitionTrail(
                    tx * this.TILE_SIZE + this.TILE_SIZE / 2,
                    ty * this.TILE_SIZE + this.TILE_SIZE / 2
                );
            }
        }

        // Explosion visual
        const explode = this.add.circle(ex, ey, 8, 0xff4400, 0.9).setDepth(3);
        this.tweens.add({ targets: explode, radius: radius * this.TILE_SIZE, alpha: 0, duration: 350, ease: 'Quad.easeOut', onComplete: () => explode.destroy() });
        const ring = this.add.circle(ex, ey, 12, 0xff8800, 0);
        ring.setStrokeStyle(3, 0xffcc00, 0.9).setDepth(3);
        this.tweens.add({ targets: ring, radius: radius * this.TILE_SIZE + 8, alpha: 0, duration: 300, ease: 'Quad.easeOut', onComplete: () => ring.destroy() });
    }

}