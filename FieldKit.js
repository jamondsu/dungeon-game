// ═════════════════════════════════════════════════════════════════════════════
// FIELD KIT — gadgets: two equipped, each on its own cooldown
// ═════════════════════════════════════════════════════════════════════════════
//
// You unlock gadgets with glorps at Glurp's and choose two to carry (the loadout, saved in
// localStorage as gadgetLoadout). In a level, Q throws the first and F the second; each then
// recharges on its own cooldown. No stock, no scraps: scraps exist only in Tower runs now,
// where they pay for picks. Cooldowns reset each level.
//
// Every gadget is element-agnostic on purpose: the point is that it works while you play
// any element. Cooldown is the balance lever: the bigger the effect, the longer the wait.
// Gadgets supplement a build; none should be a reason to take it.
//
// Mixin class, invoked as FieldKit.prototype.method.call(scene, ...). `this` is the SCENE,
// so every method reached via `this.` needs a proxy on GameScene (and the shop's few on
// ShopScene).

class FieldKit {

    _fkCfg() {
        return {
            THROW_RANGE: 7,      // tiles from the player -- lobs, so it clears walls
            ARC_MS:      420,    // flight time of the lob
            SLOTS:       2,      // gadgets you carry into a level
            LOADOUT_KEY: 'gadgetLoadout',
        };
    }

    // ── THE GADGETS ──────────────────────────────────────────────────────────
    // Every one of these is element-agnostic on purpose: the Field Kit's whole reason to
    // exist is that it works while you are playing fire, ice or cosmic. A gadget that only
    // paid off on lightning would rebuild the commitment trap in miniature.
    _gadgetDefs() {
        if (!this._cachedGadgetDefs) this._cachedGadgetDefs = {
            smite: {
                id: 'smite', glorps: 0, startsUnlocked: true, name: 'Smite Charge', cooldown: 16000, order: 0,
                radius: 2.5, damage: 14, stunMs: 2000,
                skyTiles: 9,                // how far overhead the bolt originates
                reboltMs: 130,              // it re-strikes this often for the whole stun
                holdMs: 70, fadeMs: 150,    // 220ms life > 130ms cadence, so strikes OVERLAP
                color: 0xffee44, glyph: '!',
                blurb: 'AoE damage, 2s stun'
            },
            // EMP replaces the Flood Charge. A water bomb was the one gadget whose effect
            // could HELP the enemy -- Drowners and Ripplerunners both gain on water -- so on
            // the very floor it was designed for it cut both ways. The EMP has no such
            // downside, and it is the only gadget centred on the PLAYER rather than thrown,
            // which gives the set the panic button it was missing.
            emp: {
                id: 'emp', glorps: 120, name: 'EMP Pulse', cooldown: 30000, order: 1,
                selfCentred: true,          // no lob: it fires from where you stand
                radius: 8,                  // large -- this is an "everything off me" button
                // Slow STRENGTH, not a multiplier. EnemyManager computes
                // moveCooldown = base * (1 + _slowMult), so 2.5 means 3.5x slower.
                peak: 2.5,
                decayMs: 6000,              // ramps 2.5 -> 0 across six seconds
                color: 0x66ddff, glyph: '*',
                blurb: 'Heavy slow, decays 6s'
            },
            displacer: {
                id: 'displacer', glorps: 180, name: 'Displacer', cooldown: 24000, order: 2,
                radius: 4, maxTargets: 6,
                // Two-stage now: the throw CAPTURES, then you have selectMs to click a
                // destination. Running out of time throws them further away rather than
                // doing nothing, so a missed window is a worse outcome, not a wasted charge.
                selectMs: 2000,
                placeRange: 10,             // tiles from the player you may choose
                overshoot: 6,               // extra tiles the timeout flings them
                color: 0xaa66ff, glyph: '@',
                blurb: 'Capture, then place'
            },
            grounding: {
                id: 'grounding', glorps: 240, name: 'Grounding Spike', cooldown: 20000, order: 3,
                radius: 3, suppressMs: 6000,
                color: 0x66ffcc, glyph: '+',
                blurb: 'Strips resistance 6s'
            },
            // The only healing you carry. Small on purpose (12% of max over 6s) and slow to come
            // back, so it smooths a fight rather than making you hard to kill; you also have to
            // stand in it, which is its own cost.
            mend: {
                id: 'mend', glorps: 150, name: 'Mend Totem', cooldown: 35000, order: 4,
                radius: 2.5, healPct: 0.02, durationMs: 6000,
                color: 0x7fd06a, glyph: '♥',
                blurb: 'Heals 2% max HP/s nearby, 6s'
            },
            // Terrain, briefly. Three tiles of wall across the line you threw it on: enemies
            // path round it (their BFS reads the world) and it stops shots. Never placed on
            // anyone, so it can't wall you or an enemy in.
            bulwark: {
                id: 'bulwark', glorps: 200, name: 'Bulwark', cooldown: 26000, order: 5,
                radius: 1.5, length: 3, durationMs: 4000,
                color: 0xc8a878, glyph: '#',
                blurb: 'A 3-tile wall for 4s'
            },
            // A copy of you that the enemies near it go for instead (CombatSystem's taunt). 40 HP,
            // so a crowd of slimes can't get through it in its 3s but heavy hitters break it
            // early; when it goes it pops, shoving a little damage into what's crowding it.
            decoy: {
                id: 'decoy', glorps: 220, name: 'Decoy Slime', cooldown: 28000, order: 6,
                radius: 1.5, taunt: 5, hp: 40, durationMs: 3000, popDamage: 8,
                color: 0xff9ad0, glyph: '@',
                blurb: 'Enemies chase it, not you, for 3s'
            }
        };
        return this._cachedGadgetDefs;
    }

    _gadgetOrder() {
        return Object.values(this._gadgetDefs()).sort((a, b) => a.order - b.order).map(d => d.id);
    }

    // ── THE LOADOUT ──────────────────────────────────────────────────────────
    // Two slots, saved across sessions. Only unlocked gadgets count; an empty or invalid slot
    // is null. A fresh player carries Smite Charge in the first slot.
    gadgetLoadout() {
        const C = this._fkCfg();
        let raw = null;
        try { raw = JSON.parse(localStorage.getItem(C.LOADOUT_KEY) || 'null'); } catch (e) {}
        if (!Array.isArray(raw)) raw = ['smite'];
        const out = [];
        for (let i = 0; i < C.SLOTS; i++) {
            const id = raw[i];
            out.push(id && this.gadgetUnlocked(id) && !out.includes(id) ? id : null);
        }
        return out;
    }

    // Put `id` in `slot` (null empties it). Already in the other slot: the two swap.
    setGadgetSlot(slot, id) {
        const C = this._fkCfg(), lo = this.gadgetLoadout();
        if (id && !this.gadgetUnlocked(id)) return false;
        const other = lo.indexOf(id);
        if (id && other >= 0 && other !== slot) lo[other] = lo[slot];
        lo[slot] = id || null;
        localStorage.setItem(C.LOADOUT_KEY, JSON.stringify(lo));
        return true;
    }

    // A level starts: every gadget ready. The scene object outlives scene.start, so anything
    // drawn by the last level (the sockets, planted totems) is gone and must be let go of here
    // -- updating a destroyed Text throws inside Phaser and stops the game loop.
    beginGadgetRun() {
        this._gadgetReadyAt = {};
        this._fkSock = null;
        this._fkMends = [];
        this._gadgetSlots = this.gadgetLoadout();
        return this._gadgetSlots;
    }

    gadgetCooldownLeft(id) { return Math.max(0, (this._gadgetReadyAt?.[id] || 0) - this.time.now); }

    // ── UNLOCKS: THE OTHER CURRENCY ──────────────────────────────────────────
    // Two currencies, two questions, deliberately not competing:
    //
    //   GLORPS, in the shop, across runs -> "what CAN I do?"   (permanent unlocks)
    //   SCRAPS, in-run                   -> "what am I carrying right now?" (charges)
    //
    // The alternative was letting glorps buy the gadgets themselves, and that collapses the
    // design: with nothing left for scraps to pay for, the earn gate, the bank and the cap
    // all lose their job, and stocking a loadout before you enter is a commitment made
    // blind -- you would buy Flood Charges and then meet a room full of resistant enemies
    // where you wanted Grounding Spikes. Buying in-run means buying the answer to a problem
    // you can actually see.
    //
    // Unlocks are permanent, so they DO belong in localStorage -- unlike stock and scraps,
    // which are run-scoped. Mirrors the `unlockedWeapons` array the shop already uses
    // rather than inventing a second shape.
    _unlockStoreKey() { return 'unlockedGadgets'; }

    unlockedGadgets() {
        try {
            const raw = JSON.parse(localStorage.getItem(this._unlockStoreKey()) || '[]');
            return Array.isArray(raw) ? raw : [];
        } catch { return []; }   // corrupt JSON must not brick the kit
    }

    gadgetUnlocked(id) {
        const def = this._gadgetDefs()[id];
        if (!def) return false;
        // One gadget starts unlocked so the Field Kit is never a dead passive: a player who
        // has bought nothing still has something to spend scraps on, and the in-run menu
        // has one row to teach rather than four to choose between.
        if (def.startsUnlocked) return true;
        return this.unlockedGadgets().includes(id);
    }

    unlockGadget(id) {
        if (!this._gadgetDefs()[id]) return false;
        const arr = this.unlockedGadgets();
        if (!arr.includes(id)) {
            arr.push(id);
            localStorage.setItem(this._unlockStoreKey(), JSON.stringify(arr));
        }
        return true;
    }

    // The in-run menu lists only what you own, so an unlock visibly widens the menu.
    _availableGadgets() { return this._gadgetOrder().filter(id => this.gadgetUnlocked(id)); }

    // ── THROWING ─────────────────────────────────────────────────────────────
    // Q is slot 0, F slot 1. targetX/targetY are SCREEN coords (as the weapon attack handlers
    // receive them). The cooldown starts when it leaves your hand.
    useGadget(slot, targetX, targetY) {
        if (this._iceShellUntil > this.time.now) return;   // encased in ice
        const id = (this._gadgetSlots || this.beginGadgetRun())[slot];
        const def = id ? this._gadgetDefs()[id] : null;
        if (!def) {
            this.showStatusText?.(this.player.x, this.player.y - 20, 'NO GADGET IN ' + Settings.label(Settings.key(slot ? 'gadget2' : 'gadget1')), '#c8a878');
            return false;
        }
        const left = this.gadgetCooldownLeft(id);
        if (left > 0) {
            this.showStatusText?.(this.player.x, this.player.y - 20, def.name.toUpperCase() + ' ' + Math.ceil(left / 1000) + 's', '#ff8866');
            return false;
        }
        // Refused before the cooldown starts: a second Displacer while one is held would
        // catch nothing (held enemies are phased out) and waste the wait.
        if (id === 'displacer' && this._fkHeld) {
            this.showStatusText?.(this.player.x, this.player.y - 20, 'ALREADY HELD', '#ff8866');
            return false;
        }

        const TS = this.TILE_SIZE, C = this._fkCfg();
        const worldX = targetX + this.cameras.main.scrollX;
        const worldY = targetY + this.cameras.main.scrollY;
        const px = this.playerX * TS + TS / 2, py = this.playerY * TS + TS / 2;
        const dx = worldX - px, dy = worldY - py;
        const dist = Math.hypot(dx, dy) || 1;
        const reach = Math.min(dist, C.THROW_RANGE * TS);
        const landX = px + (dx / dist) * reach;
        const landY = py + (dy / dist) * reach;
        const tx = Math.floor(landX / TS), ty = Math.floor(landY / TS);

        this._gadgetReadyAt[id] = this.time.now + def.cooldown * (this._mods?.gadgetCd || 1);   // Tinker's Gloves
        Sfx.play(this, 'gadget');

        // A self-centred gadget has no flight time. Routing the EMP through the lob would
        // put a ~420ms delay on a panic button, which is exactly when 420ms matters.
        if (def.selfCentred) {
            this._resolveGadget(id, this.playerX, this.playerY);
            return true;
        }
        const aim = { x: dx / dist, y: dy / dist };   // Bulwark lies across this line
        this._fkThrowArc(px, py, landX, landY, def, () => this._resolveGadget(id, tx, ty, aim));
        return true;
    }

    // A lob, matching the wrench's old arc: it rises and falls, so it reads as thrown OVER
    // things rather than fired through them. That is what lets a gadget clear a wall.
    _fkThrowArc(fromX, fromY, toX, toY, def, onLand) {
        const C = this._fkCfg();
        const g = this.add.graphics().setDepth(5);
        g.fillStyle(def.color, 1.0); g.fillCircle(0, 0, 4);
        g.lineStyle(1.2, 0xffffff, 0.85); g.strokeCircle(0, 0, 4);
        g.x = fromX; g.y = fromY;

        // Ground shadow so the height of the arc is legible
        const sh = this.add.circle(fromX, fromY, 3, 0x000000, 0.35).setDepth(1.6);

        const PEAK = 26;
        const start = this.time.now;
        const ev = this.time.addEvent({
            delay: 16, loop: true, callback: () => {
                const t = Math.min(1, (this.time.now - start) / C.ARC_MS);
                const bx = fromX + (toX - fromX) * t;
                const by = fromY + (toY - fromY) * t;
                if (g.active) {
                    g.x = bx;
                    g.y = by - Math.sin(t * Math.PI) * PEAK;   // parabola
                }
                if (sh.active) { sh.x = bx; sh.y = by; sh.setScale(0.6 + t * 0.6); }
                if (t >= 1) {
                    ev.remove();
                    if (g.active) g.destroy();
                    if (sh.active) sh.destroy();
                    onLand();
                }
            }
        });
    }

    _resolveGadget(id, tx, ty, aim) {
        const def = this._gadgetDefs()[id];
        if (!def) return;
        if (!def.selfCentred) this._fkBurst(tx, ty, def);
        if (id === 'smite')     return this._gadgetSmite(tx, ty, def);
        if (id === 'emp')       return this._gadgetEmp(tx, ty, def);
        if (id === 'displacer') return this._gadgetDisplacer(tx, ty, def);
        if (id === 'grounding') return this._gadgetGrounding(tx, ty, def);
        if (id === 'mend')      return this._gadgetMend(tx, ty, def);
        if (id === 'bulwark')   return this._gadgetBulwark(tx, ty, def, aim || { x: 1, y: 0 });
        if (id === 'decoy')     return this._gadgetDecoy(tx, ty, def);
    }

    // Enemies inside a gadget's radius, honouring room gating so a lob cannot reach into a
    // sealed room -- the same rule every weapon follows.
    _fkEnemiesIn(tx, ty, radiusTiles) {
        const out = [];
        const gated = typeof this._roomGated === 'function' && this._roomGated();
        const room = gated && typeof this.getCurrentPlayerRoom === 'function'
            ? this.getCurrentPlayerRoom() : undefined;
        for (const e of [...(this.enemies || [])]) {
            if (!e.sprite?.active) continue;
            if (typeof this._phasedOut === 'function' && this._phasedOut(e)) continue;
            if (gated && e.tutorialRoomIndex !== undefined && e.tutorialRoomIndex !== room) continue;
            if (Math.hypot(e.x - tx, e.y - ty) > radiusTiles) continue;
            out.push(e);
        }
        return out;
    }

    // ── SMITE CHARGE ─────────────────────────────────────────────────────────
    // Tagged 'physical' rather than 'lightning' on purpose. A gadget is your answer to a
    // bad matchup, so it must not be blunted by the very resistance you threw it to beat --
    // if Smite were lightning-tagged, a lightning-resistant pack would shrug off the thing
    // you bought specifically to deal with it.
    _gadgetSmite(tx, ty, def) {
        const targets = this._fkEnemiesIn(tx, ty, def.radius);
        for (const e of targets) {
            // Each enemy is struck individually from above rather than sharing one blast
            // circle: a per-target bolt makes the count legible at a glance, which a single
            // AoE ring never does once four enemies are standing in it.
            this._smiteStrike(e, def);
            const dmg = def.damage * (this.damageScaling || 1);
            const _rdSmite = this.resolveElementalHit(e, dmg, 'physical');
            if (_rdSmite === null) continue;
            e.health -= _rdSmite;
            this.showDamageNumber?.(e.sprite.x, e.sprite.y - 10, Math.round(_rdSmite), '#ffee44');
            this.updateEnemyHealthBar?.(e);
            e.isStunned = true;
            e.stunnedUntil = Math.max(e.stunnedUntil || 0, this.time.now + def.stunMs);
            this._showStunIndicator?.(e);
            if (e.health <= 0) this.killEnemy(e);
        }
        return targets.length;
    }

    // Reuses ElementSystem.drawLightningBolt, which already draws the forked jagged bolt the
    // lightning weapons use -- it takes two objects shaped { sprite: { x, y } }, so an
    // anchor a few tiles overhead is all it needs to become a strike from the sky rather
    // than a chain between two enemies.
    // A SUSTAINED strike, not a single flash: the bolt keeps forking down onto the enemy for
    // as long as the stun runs, so the visual and the disable have the same length. A one-frame
    // bolt followed by two seconds of a silently frozen enemy reads as two unrelated events.
    _smiteStrike(enemy, def) {
        if (!enemy.sprite?.active) return;
        const until = this.time.now + def.stunMs;
        this._smiteBolt(enemy, def);                    // first strike lands immediately
        const ev = this.time.addEvent({
            delay: def.reboltMs || 130, loop: true,
            callback: () => {
                // Stop the moment the enemy dies or the stun ends -- a bolt still hammering a
                // corpse was the same class of bug as the chill marks left on dead enemies.
                if (!enemy.sprite?.active || enemy.health <= 0 || this.time.now >= until) {
                    ev.remove();
                    if (enemy._smiteEv === ev) enemy._smiteEv = null;
                    return;
                }
                this._smiteBolt(enemy, def);
            }
        });
        if (enemy._smiteEv) enemy._smiteEv.remove();     // a second Smite restarts, not stacks
        enemy._smiteEv = ev;
    }

    // A dedicated renderer, NOT ElementSystem.drawLightningBolt.
    //
    // Reusing the chain-bolt renderer was the shortcut that made this look unchanged. Its
    // jitter is a fixed +/-20px, which reads as properly jagged across the ~48px between two
    // chained enemies and as a straight thin line across the ~144px of a nine-tile drop. It
    // also has no branches at all, so "forks down on the enemy" was never on screen. Amplitude
    // here is a FRACTION of the bolt's length, so a strike from any height is equally jagged,
    // and the branches are drawn explicitly.
    // Delegates to WeaponSystem._arcPath, which is the canonical jagged-path generator now
    // that Ball Lightning's forks need the same thing. Two copies of a lightning-path function
    // is exactly the duplication that lets one of them silently drift.
    _smiteBoltPath(fromX, fromY, toX, toY, segs = 11) {
        return this._arcPath(fromX, fromY, toX, toY, segs, 0.085);
    }

    _smiteBolt(enemy, def) {
        if (!enemy.sprite?.active) return;
        const TS = this.TILE_SIZE;
        const toX = enemy.sprite.x, toY = enemy.sprite.y + 4;
        const fromX = toX + (Math.random() - 0.5) * TS * 2;
        const fromY = toY - TS * (def.skyTiles || 9);

        const g = this.add.graphics().setDepth(5.5);
        const main = this._smiteBoltPath(fromX, fromY, toX, toY);
        const stroke = (pts, w, col, a) => {
            g.lineStyle(w, col, a);
            g.beginPath(); g.moveTo(pts[0].x, pts[0].y);
            for (let i = 1; i < pts.length; i++) g.lineTo(pts[i].x, pts[i].y);
            g.strokePath();
        };
        stroke(main, 11, 0xaaffff, 0.22);   // outer glow
        stroke(main, 5,  0xffffaa, 0.75);   // mid
        stroke(main, 2,  0xffffff, 1.0);    // white core

        // BRANCHES. Split off partway down and die out short of the ground, which is what
        // makes a strike read as forked rather than as a drawn line.
        const forks = 2 + Math.floor(Math.random() * 2);
        for (let f = 0; f < forks; f++) {
            const at = 2 + Math.floor(Math.random() * (main.length - 4));
            const root = main[at];
            const side = Math.random() < 0.5 ? -1 : 1;
            const tipX = root.x + side * TS * (1 + Math.random() * 2);
            const tipY = root.y + TS * (0.8 + Math.random() * 1.6);
            const br = this._smiteBoltPath(root.x, root.y, tipX, tipY, 4);
            stroke(br, 4, 0xaaffff, 0.20);
            stroke(br, 1.5, 0xffffcc, 0.85);
        }

        // Held, then faded. Total life is longer than reboltMs so consecutive strikes OVERLAP
        // -- that overlap is what makes it read as one sustained strike instead of a stutter.
        this.time.delayedCall(def.holdMs || 70, () => {
            if (!g.active) return;
            this.tweens.add({ targets: g, alpha: 0, duration: def.fadeMs || 150,
                              onComplete: () => g.destroy() });
        });

        // Ground flash under the strike, so the bolt visibly LANDS instead of stopping in
        // mid-air at the sprite's origin. Its own graphics object -- `g` above is the bolt and
        // outlives this by design.
        const floor = this.add.graphics().setDepth(2.2);
        floor.x = toX; floor.y = enemy.sprite.y + 6;
        floor.fillStyle(0xffffaa, 0.55); floor.fillEllipse(0, 0, TS * 1.8, TS * 0.8);
        floor.fillStyle(0xffffff, 0.8);  floor.fillEllipse(0, 0, TS * 0.8, TS * 0.34);
        this.tweens.add({ targets: floor, alpha: 0, scaleX: 1.7, scaleY: 1.7,
                          duration: 240, ease: 'Quad.easeOut', onComplete: () => floor.destroy() });
    }

    // ── EMP PULSE ────────────────────────────────────────────────────────────
    // Instant, centred on the player, and the slow DECAYS rather than expiring. A flat slow
    // that snaps off at t+6s reads as a bug the moment it ends; a ramp back to normal speed
    // tells the player how much time they have left without any UI at all.
    //
    // Rides the existing slow system instead of inventing one: EnemyManager already computes
    // moveCooldown = base * (1 + _slowMult) off isSlowed/_slowMult, so the EMP only has to
    // own the DECAY CURVE and let the mover do the rest.
    _gadgetEmp(tx, ty, def) {
        const now = this.time.now;
        const hit = this._fkEnemiesIn(tx, ty, def.radius);
        for (const e of hit) {
            e.isSlowed = true;
            e._slowMult = def.peak;
            e.slowedUntil = now + def.decayMs;
            // Own bookkeeping so the decay is recomputable from scratch each frame -- storing
            // only a current value would drift, and would fight any other slow source.
            e._empStart = now;
            e._empEnd = now + def.decayMs;
            e._empPeak = def.peak;
            // Remember what WE wrote. Without this the decay could not tell its own previous
            // value from a stronger slow landing from elsewhere, and the Math.max guard below
            // pinned the strength at peak forever -- measured 2.5 -> 2.5 -> 2.5 -> 2.5 -> 0,
            // a flat slow that snapped off, which is the exact feel the ramp exists to avoid.
            e._empWrote = def.peak;
            this.showStatusText?.(e.sprite.x, e.sprite.y - 16, 'EMP', '#66ddff');
            // Arrows for the whole window. The interval is re-set as the slow decays (see
            // _decayEmpSlows), so the arrows visibly thin out as the enemy speeds back up --
            // the decay becomes readable without any UI.
            this._setSpeedIndicator?.(e, 'emp', 'slow_ice', true, 220);
        }
        this._empShockwave(def);
        return hit.length;
    }

    // Called every frame from updateFieldKit. Linear ramp from peak back to zero.
    _decayEmpSlows(time) {
        for (const e of (this.enemies || [])) {
            if (!e._empEnd) continue;
            if (time >= e._empEnd) {
                e._empEnd = 0; e._empStart = 0;
                // Only lift the slow if the EMP is what put it there. Clearing unconditionally
                // would cancel a chill or a tsunami puddle that landed during the window.
                if (e.slowedUntil && time >= e.slowedUntil) { e.isSlowed = false; e._slowMult = undefined; }
                delete e._empWrote;
                this._setSpeedIndicator?.(e, 'emp', 'slow_ice', false);
                e._empArrowStep = 0;
                continue;
            }
            const t = (time - e._empStart) / (e._empEnd - e._empStart);
            const mult = e._empPeak * (1 - t);
            // If the current strength is ABOVE our last write, another source raised it, so
            // leave it alone -- but keep ramping our own contribution down underneath. If it
            // matches our last write, the value is ours and we are free to lower it.
            if ((e._slowMult ?? 0) > (e._empWrote ?? -1)) {
                e._slowMult = Math.max(e._slowMult, mult);
            } else {
                e._slowMult = mult;
                e.isSlowed = mult > 0;
            }
            e._empWrote = mult;

            // Re-time the arrows in coarse steps as the slow fades. Restarting the timer every
            // frame would reset it before it ever fired; stepping only when the bucket changes
            // keeps it cheap and still shows the ramp.
            const step = Math.min(3, Math.floor((1 - t) * 4));   // 3 = strongest, 0 = nearly gone
            if (e._empArrowStep !== step) {
                e._empArrowStep = step;
                this._setSpeedIndicator?.(e, 'emp', 'slow_ice', false);
                if (step > 0) {
                    this._setSpeedIndicator?.(e, 'emp', 'slow_ice', true, 220 + (3 - step) * 240);
                }
            }
        }
    }

    _empShockwave(def) {
        const TS = this.TILE_SIZE;
        const px = this.playerX * TS + TS / 2, py = this.playerY * TS + TS / 2;
        for (let ring = 0; ring < 3; ring++) {
            const g = this.add.graphics().setDepth(2.4);
            g.x = px; g.y = py;
            g.lineStyle(2.5 - ring * 0.6, def.color, 0.85 - ring * 0.2);
            g.strokeCircle(0, 0, TS * 1.2);
            this.tweens.add({
                targets: g, delay: ring * 90,
                scaleX: def.radius / 1.2, scaleY: def.radius / 1.2, alpha: 0,
                duration: 420, ease: 'Quad.easeOut', onComplete: () => g.destroy()
            });
        }
        this.cameras.main.shake(140, 0.004);
    }

    // ── DISPLACER ────────────────────────────────────────────────────────────
    // Two stages. The throw CAPTURES everything in its radius -- the enemies leave the world
    // entirely -- and then you have selectMs to click where the whole group reappears.
    //
    // Running out of time does not waste the charge; it flings them FURTHER than you could
    // have chosen. That is the interesting shape: hesitating is not punished with nothing
    // happening, it is punished with a worse outcome you no longer control, so the two-second
    // window is a decision under pressure rather than a reflex test.
    //
    // Formation is preserved as offsets from the capture centre, so a line of Drowners lands
    // as a line. Collapsing them onto one tile would make this a stacking exploit -- every
    // AoE in the game would then hit the whole group for free.
    _gadgetDisplacer(tx, ty, def) {
        const caught = this._fkEnemiesIn(tx, ty, def.radius).slice(0, def.maxTargets);
        if (!caught.length) return 0;

        // A second throw while a group is already held would orphan the first one in limbo
        // with nothing left alive to release it.
        if (this._fkHeld) this._releaseDisplaced(this._fkHeld, true);

        const held = { def, cx: tx, cy: ty, at: this.time.now,
                       until: this.time.now + def.selectMs, members: [] };
        for (const e of caught) {
            held.members.push({ enemy: e, dx: e.x - tx, dy: e.y - ty });
            e._displacerHeld = true;
            // Held enemies must not act. _phasedOut covers DAMAGE immunity, but the mover and
            // the attack timers read isStunned, so both have to be set -- otherwise a captured
            // enemy keeps shooting from inside the pocket.
            e._preHeldStun = e.stunnedUntil || 0;
            e.isStunned = true;
            e.stunnedUntil = this.time.now + def.selectMs + 4000;
            if (e.sprite?.active) e.sprite.setVisible(false);
            if (e._resistMark?.active) e._resistMark.setVisible(false);
            this._fkVanishPuff(e, def);
        }
        this._fkHeld = held;
        this._fkDrawHeldPrompt();
        return caught.length;
    }

    // True while a click should place the held group instead of firing your weapon.
    displacerPending() { return !!this._fkHeld; }

    // Called from the scene's pointerdown when displacerPending(). Screen coords in.
    placeDisplaced(targetX, targetY) {
        const held = this._fkHeld;
        if (!held) return false;
        const TS = this.TILE_SIZE;
        const wx = targetX + this.cameras.main.scrollX;
        const wy = targetY + this.cameras.main.scrollY;
        let tx = Math.floor(wx / TS), ty = Math.floor(wy / TS);

        // Clamp the CENTRE into placeRange of the player, so one click at the screen edge
        // cannot fling a pack across the whole level.
        const dx = tx - this.playerX, dy = ty - this.playerY;
        const d = Math.hypot(dx, dy);
        if (d > held.def.placeRange) {
            tx = Math.round(this.playerX + (dx / d) * held.def.placeRange);
            ty = Math.round(this.playerY + (dy / d) * held.def.placeRange);
        }
        this._releaseDisplaced(held, false, tx, ty);
        return true;
    }

    // Timeout: beyond placeRange, in the direction they were captured from, so the outcome is
    // legible rather than random -- they go the way they were already coming.
    _timeoutDisplaced(held) {
        const def = held.def;
        const dx = held.cx - this.playerX, dy = held.cy - this.playerY;
        const d = Math.hypot(dx, dy) || 1;
        const reach = def.placeRange + def.overshoot;
        const tx = Math.round(this.playerX + (dx / d) * reach);
        const ty = Math.round(this.playerY + (dy / d) * reach);
        this.showStatusText?.(this.player.x, this.player.y - 20, 'FLUNG', '#cc99ff');
        this._releaseDisplaced(held, false, tx, ty);
    }

    // abort = put them back untouched. Otherwise land the formation on (tx, ty).
    _releaseDisplaced(held, abort, tx, ty) {
        const TS = this.TILE_SIZE;
        for (const m of held.members) {
            const e = m.enemy;
            e._displacerHeld = false;
            e.stunnedUntil = e._preHeldStun || 0;
            e.isStunned = e.stunnedUntil > this.time.now;   // it restored the deadline but dropped the stun
            delete e._preHeldStun;
            if (!abort) {
                const spot = this._fkNearestFloor(tx + m.dx, ty + m.dy, e);
                if (spot) { e.x = spot.x; e.y = spot.y; }
            }
            if (e.sprite?.active) {
                e.sprite.setVisible(true);
                e.sprite.x = e.x * TS + TS / 2;
                e.sprite.y = e.y * TS + TS / 2 + (this.SLIME_Y_OFFSET || 0);
                // Snap in rather than slide: they teleported, they did not walk.
                e.sprite.setScale((this.SLIME_SCALE || 1) * 1.5);
                this.tweens.add({ targets: e.sprite, scaleX: this.SLIME_SCALE || 1,
                                  scaleY: this.SLIME_SCALE || 1, duration: 160,
                                  ease: 'Back.easeOut' });
            }
            if (e._resistMark?.active) e._resistMark.setVisible(true);
            this._fkVanishPuff(e, held.def);
            e.lastMoveTime = this.time.now;   // no free step the instant they land
        }
        this._fkClearHeldPrompt();
        this._fkHeld = null;
    }

    // Spiral out to the first free floor tile. Without this a group placed against a wall
    // ends up inside it, or stacked on top of one another.
    _fkNearestFloor(wx, wy, forEnemy) {
        const occupied = (x, y) => (this.enemies || []).some(o =>
            o !== forEnemy && !o._displacerHeld && o.sprite?.active && o.x === x && o.y === y);
        const free = (x, y) => this.world?.[x]?.[y] === this.FLOOR && !occupied(x, y);
        if (free(wx, wy)) return { x: wx, y: wy };
        for (let r = 1; r <= 4; r++) {
            for (let dx = -r; dx <= r; dx++) {
                for (let dy = -r; dy <= r; dy++) {
                    if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
                    if (free(wx + dx, wy + dy)) return { x: wx + dx, y: wy + dy };
                }
            }
        }
        return null;   // nowhere free: they stay where they were captured
    }

    _fkVanishPuff(enemy, def) {
        if (!enemy.sprite) return;
        const g = this.add.graphics().setDepth(4.2);
        g.x = enemy.sprite.x; g.y = enemy.sprite.y;
        g.fillStyle(def.color, 0.55); g.fillCircle(0, 0, 9);
        g.lineStyle(1.5, 0xffffff, 0.8); g.strokeCircle(0, 0, 9);
        this.tweens.add({ targets: g, scaleX: 0.1, scaleY: 1.8, alpha: 0,
                          duration: 220, ease: 'Quad.easeIn', onComplete: () => g.destroy() });
    }

    // A ghost of the formation plus a draining arc on the cursor. Without a visible clock the
    // timeout reads as the gadget randomly misfiring.
    _fkDrawHeldPrompt() {
        this._fkClearHeldPrompt();
        this._fkHeldGfx = this.add.graphics().setDepth(6);
        this._fkHeldText = this.add.text(this.scale.width / 2, 54, 'CLICK TO PLACE',
                { fontSize: '13px', fontFamily: 'monospace', color: '#cc99ff' })
            .setOrigin(0.5).setScrollFactor(0).setDepth(6);
    }

    _fkUpdateHeldPrompt(time) {
        const held = this._fkHeld, g = this._fkHeldGfx;
        if (!held || !g?.active) return;
        const TS = this.TILE_SIZE;
        const wx = (this.pointerX || 0) + this.cameras.main.scrollX;
        const wy = (this.pointerY || 0) + this.cameras.main.scrollY;
        let tx = Math.floor(wx / TS), ty = Math.floor(wy / TS);
        const dx = tx - this.playerX, dy = ty - this.playerY;
        const d = Math.hypot(dx, dy);
        const out = d > held.def.placeRange;
        if (out) {
            tx = Math.round(this.playerX + (dx / d) * held.def.placeRange);
            ty = Math.round(this.playerY + (dy / d) * held.def.placeRange);
        }
        g.clear();
        // Ghost the WHOLE formation, not just the centre: where the group lands is the thing
        // being chosen, and one marker hides that it is six enemies wide.
        for (const m of held.members) {
            const spot = this._fkNearestFloor(tx + m.dx, ty + m.dy, m.enemy);
            if (!spot) continue;
            g.fillStyle(held.def.color, out ? 0.18 : 0.32);
            g.fillRect(spot.x * TS + 2, spot.y * TS + 2, TS - 4, TS - 4);
        }
        const left = Math.max(0, held.until - time) / held.def.selectMs;
        g.lineStyle(2.5, out ? 0xff8866 : held.def.color, 0.9);
        g.beginPath();
        g.arc(tx * TS + TS / 2, ty * TS + TS / 2, TS * 0.9,
              -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * left);
        g.strokePath();
    }

    _fkClearHeldPrompt() {
        if (this._fkHeldGfx?.active) this._fkHeldGfx.destroy();
        if (this._fkHeldText?.active) this._fkHeldText.destroy();
        this._fkHeldGfx = null; this._fkHeldText = null;
    }

    // ── PER-FRAME ────────────────────────────────────────────────────────────
    updateFieldKit(time) {
        this._decayEmpSlows(time);
        this._fkUpdateMend(time);
        this._fkDrawSockets();
        if (this._fkHeld) {
            if (time >= this._fkHeld.until) this._timeoutDisplaced(this._fkHeld);
            else this._fkUpdateHeldPrompt(time);
        }
    }

    // ── GROUNDING SPIKE ──────────────────────────────────────────────────────
    // Suppresses partial RESISTANCE, not immunity. A fire elemental does not become
    // burnable because you threw a spike at it; what lifts is the resistTrait multiplier,
    // which is the thing that compounds with floor HP scaling into a 4.2x slog by floor 5.
    _gadgetGrounding(tx, ty, def) {
        const targets = this._fkEnemiesIn(tx, ty, def.radius);
        let n = 0;
        for (const e of targets) {
            if (!ElementResist.traitsOf(e).length) continue;   // nothing to strip
            e._resistSuppressed = true;
            n++;
            // Hide the aura while suppressed so the bubble always tells the truth about
            // whether the enemy is currently resisting anything.
            if (e._resistMark?.active) e._resistMark.setVisible(false);
            this.showStatusText?.(e.sprite.x, e.sprite.y - 16, 'GROUNDED', '#66ffcc');
            if (e._resistSuppressTimer) e._resistSuppressTimer.remove();
            e._resistSuppressTimer = this.time.delayedCall(def.suppressMs, () => {
                e._resistSuppressed = false;
                e._resistSuppressTimer = null;
                if (e.sprite?.active && e._resistMark?.active) e._resistMark.setVisible(true);
            });
        }
        return n;
    }

    // ── MEND TOTEM ───────────────────────────────────────────────────────────
    // A green totem planted where it lands. While you stand within its radius it heals a
    // share of your max HP every second; then it sinks back into the floor.
    _gadgetMend(tx, ty, def) {
        const TS = this.TILE_SIZE, x = tx * TS + TS / 2, y = ty * TS + TS / 2;
        const g = this.add.graphics().setDepth(0.95);
        const ring = VisualFX.aura(this, x, y, def.radius * TS, def.color, { alpha: 0.9 });
        g.fillStyle(0x000000, 0.35); g.fillEllipse(x, y + 8, 18, 6);
        g.fillStyle(0x6a4a26, 1); g.fillRect(x - 4, y - 14, 8, 22);
        g.fillStyle(def.color, 1); g.fillCircle(x, y - 18, 7);
        g.fillStyle(0xffffff, 0.6); g.fillCircle(x - 2, y - 20, 2);
        this._vfxFlash?.(x, y, 70, def.color, 400, 0.6);
        if (!this._fkMends) this._fkMends = [];
        this._fkMends.push({ x: tx, y: ty, until: this.time.now + def.durationMs, def, g, ring, lastTick: this.time.now });
    }
    _fkUpdateMend(time) {
        if (!this._fkMends?.length) return;
        for (const m of [...this._fkMends]) {
            if (time >= m.until) {
                this.tweens.killTweensOf(m.ring);
                this.tweens.add({ targets: [m.g, m.ring], alpha: 0, duration: 300, onComplete: () => { m.g.destroy(); m.ring.destroy(); } });
                this._fkMends.splice(this._fkMends.indexOf(m), 1);
                continue;
            }
            if (time - m.lastTick < 1000) continue;
            m.lastTick = time;
            if (Math.hypot(this.playerX - m.x, this.playerY - m.y) > m.def.radius || this.health <= 0) continue;
            const max = this.maxHealth || 100, amt = Math.min(max - this.health, max * m.def.healPct);
            if (amt <= 0) continue;
            this.health += amt;
            this.showDamageNumber?.(this.player.x, this.player.y - 18, Math.round(amt), '#7fd06a');
            this.updateHUD?.();
        }
    }

    // ── BULWARK ──────────────────────────────────────────────────────────────
    // Three tiles of wall across the line it was thrown on, for a few seconds. They are real
    // wall in this.world while they stand (enemy BFS and projectile checks both read it), so
    // only empty floor is ever converted: never a tile with you, an enemy or a node on it.
    _gadgetBulwark(tx, ty, def, aim) {
        const TS = this.TILE_SIZE;
        // across the throw: perpendicular to its dominant axis
        const across = Math.abs(aim.x) >= Math.abs(aim.y) ? { x: 0, y: 1 } : { x: 1, y: 0 };
        const half = Math.floor(def.length / 2), tiles = [];
        for (let k = -half; k <= half; k++) {
            const x = tx + across.x * k, y = ty + across.y * k;
            if (this.world?.[x]?.[y] !== this.FLOOR) continue;
            if (x === this.playerX && y === this.playerY) continue;
            if (this.getEnemyAt?.(x, y) || this.isNodeAt?.(x, y)) continue;
            tiles.push({ x, y });
        }
        if (!tiles.length) { this.showStatusText?.(tx * TS, ty * TS, 'NO ROOM', '#c8a878'); return; }
        const blocks = tiles.map(t => {
            this.world[t.x][t.y] = this.WALL;
            const g = this.add.graphics().setDepth(2.2).setPosition(t.x * TS, t.y * TS + TS);
            g.fillStyle(0x000000, 0.4); g.fillRect(2, -4, TS, 6);
            g.fillStyle(0x6a5a44, 1); g.fillRect(0, -TS * 1.4, TS, TS * 1.4);
            g.fillStyle(0x8a7a5e, 1); g.fillRect(0, -TS * 1.4, TS, 5);
            g.lineStyle(1, 0x2a2016, 0.8); g.strokeRect(0, -TS * 1.4, TS, TS * 1.4);
            g.lineBetween(0, -TS * 0.7, TS, -TS * 0.7); g.lineBetween(TS / 2, -TS * 1.4, TS / 2, -TS * 0.7);
            g.setScale(1, 0);
            this.tweens.add({ targets: g, scaleY: 1, duration: 180, ease: 'Back.easeOut' });
            return { ...t, g };
        });
        this.cameras.main.shake(60, 0.004);
        this.time.delayedCall(def.durationMs, () => {
            for (const b of blocks) {
                if (this.world?.[b.x]?.[b.y] === this.WALL) this.world[b.x][b.y] = this.FLOOR;
                this.tweens.add({ targets: b.g, scaleY: 0, alpha: 0, duration: 220, onComplete: () => b.g.destroy() });
            }
        });
    }

    // ── DECOY SLIME ──────────────────────────────────────────────────────────
    // A pink copy of you (flat pink: a tint would just multiply into your own colour) on the tile it lands on (the nearest open floor if that's taken). The
    // regular enemies within `taunt` tiles go for it instead of you while it lasts; its hits
    // land on it (CombatSystem._tauntBegin). A ring shows its pull, a bar its health. When its
    // time or health runs out it pops, hitting everything within `radius` tiles.
    _gadgetDecoy(tx, ty, def) {
        const TS = this.TILE_SIZE, free = (x, y) => this.world?.[x]?.[y] === this.FLOOR && !this.getEnemyAt?.(x, y) && !(x === this.playerX && y === this.playerY);
        let spot = free(tx, ty) ? { x: tx, y: ty } : null;
        for (let r = 1; !spot && r <= 3; r++) for (let dx = -r; dx <= r && !spot; dx++) for (let dy = -r; dy <= r && !spot; dy++) if (free(tx + dx, ty + dy)) spot = { x: tx + dx, y: ty + dy };
        if (!spot) { this.showStatusText?.(tx * TS, ty * TS, 'NO ROOM', '#ff9ad0'); return; }
        const px = spot.x * TS + TS / 2, py = spot.y * TS + TS / 2;
        const s = this.add.sprite(px, py + (this.SLIME_Y_OFFSET || 0), this.player.texture.key, 0)
            .setScale(this.player.scaleX, this.player.scaleY).setTintFill(0xff9ad0).setAlpha(0.9).setDepth(this.player.depth - 0.02);
        if (this.anims.exists('idle')) s.play('idle');
        if (typeof CreatureFX !== 'undefined') CreatureFX.face(this, s, { mood: 'friend', look: 'pointer' });
        const ring = VisualFX.aura(this, px, py, def.taunt * TS, def.color, { alpha: 0.7 });
        const bar = this.add.graphics().setDepth(5);
        const drawBar = (hp) => { bar.clear(); bar.fillStyle(0x000000, 0.6).fillRect(px - 12, py - 26, 24, 4); bar.fillStyle(def.color, 1).fillRect(px - 12, py - 26, 24 * Math.max(0, hp) / def.hp, 4); };
        drawBar(def.hp);
        s.setScale(0.2); this.tweens.add({ targets: s, scaleX: this.player.scaleX, scaleY: this.player.scaleY, duration: 220, ease: 'Back.easeOut' });
        const ally = this._addAlly({
            x: spot.x, y: spot.y, hp: def.hp, taunt: def.taunt, until: this.time.now + def.durationMs,
            hurt: (amt) => {
                ally.hp -= amt; drawBar(ally.hp);
                s.setTintFill(0xffffff); this.time.delayedCall(80, () => s.active && s.setTintFill(0xff9ad0));
            },
            onEnd: () => {
                // the pop: a burst of pink, and a shove of damage into whatever crowded it
                Sfx.play(this, 'pop');
                this._fkBurst(spot.x, spot.y, def);
                for (const e of this._fkEnemiesIn(spot.x, spot.y, def.radius)) this.damageEnemy(e, def.popDamage * (this.damageScaling || 1), 'physical');
                this.tweens.killTweensOf(ring);
                [s, ring, bar].forEach(o => o?.active && o.destroy());
            },
        });
    }

    // ── SOCKETS ──────────────────────────────────────────────────────────────
    // The two slots on screen, left of the element gems: the gadget's glyph, its key, and
    // a dark sweep counting the cooldown down, with the seconds left.
    _fkDrawSockets() {
        if (!this.player || this._deathScreenActive) { this._fkSock?.g.setVisible(false); return; }
        if (!this._fkSock || !this._fkSock.g.active) {
            const g = this.add.graphics().setScrollFactor(0).setDepth(40);
            const txt = [0, 1].map(() => this.add.text(0, 0, '', { fontSize: '16px', fontFamily: 'monospace', fontStyle: 'bold', color: '#ffffff', stroke: '#000', strokeThickness: 3 })
                .setOrigin(0.5).setScrollFactor(0).setDepth(41));
            const key = [0, 1].map(i => this.add.text(0, 0, Settings.label(Settings.key(i ? 'gadget2' : 'gadget1')), { fontSize: '11px', fontFamily: 'monospace', fontStyle: 'bold', color: '#d2bf98', stroke: '#000', strokeThickness: 2 })
                .setOrigin(0.5).setScrollFactor(0).setDepth(41));
            this._fkSock = { g, txt, key };
        }
        const S = this._fkSock, W = this.scale.width, H = this.scale.height, R = 21;
        const slots = this._gadgetSlots || this.beginGadgetRun();
        S.g.clear().setVisible(true);
        slots.forEach((id, i) => {
            const cx = W / 2 - 236 + i * 54, cy = H - 34, def = id ? this._gadgetDefs()[id] : null;
            S.g.fillStyle(0x000000, 0.5); S.g.fillCircle(cx + 1, cy + 2, R + 3);
            S.g.fillStyle(0x2e2a26, 1); S.g.fillCircle(cx, cy, R + 2);
            S.g.fillStyle(def ? 0x1b1612 : 0x14110e, 1); S.g.fillCircle(cx, cy, R - 1);
            S.key[i].setPosition(cx, cy + R + 7);
            if (!def) { S.txt[i].setText('').setVisible(false); return; }
            const left = this.gadgetCooldownLeft(id), frac = left / def.cooldown;
            S.g.fillStyle(def.color, left > 0 ? 0.25 : 0.9); S.g.fillCircle(cx, cy, R - 4);
            if (left > 0) {   // the sweep: what's still recharging, dark, clockwise from the top
                S.g.fillStyle(0x000000, 0.6);
                S.g.slice(cx, cy, R - 1, -Math.PI / 2, -Math.PI / 2 + frac * Math.PI * 2, false);
                S.g.fillPath();
            }
            S.g.lineStyle(2, left > 0 ? 0x5e574e : def.color, 1); S.g.strokeCircle(cx, cy, R);
            S.txt[i].setVisible(true).setPosition(cx, cy)
                .setText(left > 0 ? String(Math.ceil(left / 1000)) : def.glyph)
                .setColor(left > 0 ? '#d2bf98' : '#1b1612').setStroke(left > 0 ? '#000' : '#ffffff', left > 0 ? 3 : 0);
        });
    }

    // ── IMPACT VISUAL ────────────────────────────────────────────────────────
    _fkBurst(tx, ty, def) {
        const TS = this.TILE_SIZE;
        const px = tx * TS + TS / 2, py = ty * TS + TS / 2;
        const R = def.radius * TS;
        const glow = VisualFX.aura(this, px, py, R, def.color, { depth: 4.5, breathe: false });
        this.tweens.add({ targets: glow, alpha: 0, duration: 380, ease: 'Quad.easeOut', onComplete: () => glow.destroy() });
        VisualFX.ripple(this, px, py, R * 0.3, R * 1.15, def.color, { depth: 4.5, duration: 340 });
        this._vfxFlash?.(px, py, 26, 0xffffff, 200, 0.7);
        this.cameras.main.shake(25, 0.0015);
        Sfx.play(this, 'boom');
    }
}
