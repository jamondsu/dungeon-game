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

    // ── THE ART (assets/art/fx_gadgets, typed by hand) ───────────────────────
    // Each gadget's four colours, white-hot to dark: its sparks burn down through them as they fly.
    static TONES = {
        smite: [0xfffbe0, 0xffe14a, 0xe8a020, 0x8a5a10], emp: [0xf0fdff, 0x9fe8ff, 0x3ab8f0, 0x1a5a8a],
        displacer: [0xf4e6ff, 0xc99cff, 0x8a4ae8, 0x3a1a7a], grounding: [0xeafff8, 0x9fffe0, 0x3ad8a8, 0x1a6a5a],
        mend: [0xf0ffe0, 0xb8f08a, 0x5ab84a, 0x2a6a3a], bulwark: [0xfff4dc, 0xe8d4a8, 0xa8987a, 0x5a4e40],
        decoy: [0xfff0f8, 0xffb8dc, 0xff6ab0, 0x9a2a6a],
    };
    // The animations, and a scene's shared emitters made the first time: casing chips, dust, heal crosses, rubble, confetti
    static fx(S) {
        if (S._fkFx?.dust?.active) return S._fkFx;
        const K = 'fx_gadgets', A = S.anims, n = (b, k) => Array.from({ length: k }, (_, i) => b + i);
        const anim = (key, frames, frameRate, repeat = 0) => { if (!A.exists(key)) A.create({ key, frames: frames.map(frame => ({ key: K, frame })), frameRate, repeat }); };
        for (const id of Object.keys(FieldKit.TONES)) { anim('fk_hit_' + id, n(`hit_${id}_`, 4), 20); if (id !== 'emp') anim('fk_tumble_' + id, n(id + '_t', 8), 20, -1); }
        anim('fk_static', n('static_', 4), 18); anim('fk_portal', n('portal_', 4), 10, -1); anim('fk_blink', n('blink_', 5), 24);
        anim('fk_mark', n('mark_', 2), 4, -1); anim('fk_spike', n('spike_', 4), 7, -1); anim('fk_heart', n('heart_', 4), 6, -1); anim('fk_pop', n('pop_', 4), 16);
        anim('fk_totem', ['totem_0', 'totem_1', 'totem_0', 'totem_2', 'totem_3', 'totem_2'], 6, -1);
        const mk = (frames, cfg, depth) => S.add.particles(0, 0, K, { frame: frames, emitting: false, ...cfg }).setDepth(depth);
        const fade = { start: 1, end: 0, ease: 'Quad.easeIn' };
        return (S._fkFx = {
            chip: mk(n('chip_', 4), { lifespan: { min: 380, max: 620 }, gravityY: 380, scale: 1.5, alpha: fade }, 4.8),
            dust: mk(n('dust_', 4), { lifespan: { min: 500, max: 900 }, gravityY: -30, scale: { start: 1.3, end: 2.2 }, alpha: { start: 0.55, end: 0 }, tint: 0xc8b8a0 }, 4.4),
            heal: mk(n('heal_', 3), { lifespan: { min: 700, max: 1000 }, speedY: { min: -34, max: -18 }, speedX: { min: -6, max: 6 }, scale: 1.5, alpha: fade }, 3.4),
            rock: mk(n('rock_', 4), { lifespan: { min: 420, max: 700 }, gravityY: 520, scale: 1.5, alpha: { start: 1, end: 0, ease: 'Quint.easeIn' } }, 2.4),
            conf: mk(n('conf_', 4), { lifespan: { min: 600, max: 1000 }, gravityY: 260, scale: 1.5, alpha: fade, tint: [0xff9ad0, 0xffe08a, 0x9ad8ff, 0xb8f08a] }, 4.9),
            spark: {},
        });
    }
    // A gadget's sparks: the hand-drawn motes burning down through its colours, made the first time it's used (big: the
    // larger ones, bigger still, for a wave that has to read across the room)
    static sparks(S, id, big = false) {
        const F = FieldKit.fx(S), k = big ? id + '+' : id;
        if (F.spark[k]?.active) return F.spark[k];
        return (F.spark[k] = S.add.particles(0, 0, 'fx_gadgets', { frame: big ? ['p_1', 'p_2', 'p_5', 'p_8', 'p_9'] : Array.from({ length: 10 }, (_, i) => 'p_' + i),
            emitting: false, lifespan: { min: 260, max: 560 }, scale: big ? { start: 2, end: 1.5 } : { start: 1.5, end: 1 }, alpha: { start: big ? 0.85 : 1, end: 0 },
            color: big ? FieldKit.TONES[id].slice(1) : FieldKit.TONES[id], colorEase: 'quad.out', blendMode: Phaser.BlendModes.ADD, maxParticles: 600 }).setDepth(4.9));
    }
    // n particles from E at (x, y), flung all round at v0..v1 px a second (and up by `up`)
    static puff(E, x, y, n, v0 = 20, v1 = 80, up = 0) {
        for (let i = 0; i < n; i++) {
            const p = E.emitParticleAt(x + (Math.random() - 0.5) * 6, y + (Math.random() - 0.5) * 4, 1);
            if (!p) continue;
            const a = Math.random() * Math.PI * 2, v = v0 + Math.random() * (v1 - v0);
            p.velocityX = Math.cos(a) * v; p.velocityY = Math.sin(a) * v - up;
        }
    }
    // n particles from E flung out from (x, y) to reach radius r as they die, ms on: where a gadget reaches
    static ring(E, x, y, r, ms, n) {
        for (let i = 0; i < n; i++) {
            const a = (i + Math.random() * 0.6) / n * Math.PI * 2, p = E.emitParticleAt(x + Math.cos(a) * 4, y + Math.sin(a) * 4, 1);
            if (!p) continue;
            const v = (r - 4) / (ms / 1000) * (0.9 + Math.random() * 0.2);
            p.velocityX = Math.cos(a) * v; p.velocityY = Math.sin(a) * v; p.life = p.lifeCurrent = ms;
        }
    }
    // A sprite (origin at its foot) coming up out of the floor over ms, or going back down into it: only what's above
    // the floor line shows, so it's never squashed
    static rise(S, s, ms, down = false, onDone = null, delay = 0) {
        const y = s.y, h = s.frame.height, k = { t: down ? 1 : 0 };
        const set = () => { if (!s.active) return; s.setCrop(0, 0, s.frame.width, Math.max(0.01, h * Math.min(1, k.t))); s.y = y + h * (1 - k.t) * s.scaleY; };
        set();
        S.tweens.add({ targets: k, t: down ? 0 : 1, delay, duration: ms, ease: down ? 'Quad.easeIn' : 'Back.easeOut', onUpdate: set,
                       onComplete: () => { if (!down && s.active) { s.setCrop(); s.y = y; } onDone?.(); } });
    }
    // The Displacer's pocket: a rift opening in the floor at (x, y), its sparks drawn spiralling in; ms 0 keeps it open
    // until close()
    static portal(S, x, y, ms = 0) {
        const s = S.add.sprite(x, y + 4, 'fx_gadgets', 'portal_0').setDepth(0.95).setScale(0.4);
        FieldKit.fx(S); s.play('fk_portal');
        S.tweens.add({ targets: s, scale: 1.8, duration: 220, ease: 'Back.easeOut' });
        const E = FieldKit.sparks(S, 'displacer');
        const ev = S.time.addEvent({ delay: 50, loop: true, callback: () => {
            const a = Math.random() * Math.PI * 2, r = 22 + Math.random() * 16, p = E.emitParticleAt(x + Math.cos(a) * r, y + 4 + Math.sin(a) * r * 0.45, 1);
            if (p) { p.velocityX = (-Math.cos(a) * r - Math.sin(a) * 18) / 0.38; p.velocityY = (-Math.sin(a) * r + Math.cos(a) * 18) * 0.45 / 0.38; p.life = p.lifeCurrent = 380; }
        } });
        const close = () => { ev.remove(); if (!s.active) return; S.tweens.killTweensOf(s); S.tweens.add({ targets: s, scale: 0, duration: 200, ease: 'Back.easeIn', onComplete: () => s.destroy() }); };
        if (ms) S.time.delayedCall(ms, close);
        return { s, close };
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
            // A copy of you that the enemies near it go for instead (CombatSystem's taunt), 6s. 40 HP,
            // so heavy hitters break it early; when it goes it pops, shoving a little damage into what's crowding it.
            decoy: {
                id: 'decoy', glorps: 220, name: 'Decoy Slime', cooldown: 28000, order: 6,
                radius: 1.5, taunt: 5, hp: 40, durationMs: 6000, popDamage: 8,
                color: 0xff9ad0, glyph: '@',
                blurb: 'Enemies chase it, not you, for 6s'
            },
            // Rung where you stand: every ailment on you gone at once, then immuneMs in which anything new is shaken off as
            // it lands (and no hold takes you at all). It deals nothing and moves nothing: the answer to the Blinder, Winded,
            // the Diver's drip and slow, a root, without being any build's reason to exist.
            bell: {
                id: 'bell', glorps: 200, name: 'Cleansing Bell', cooldown: 26000, order: 7,
                selfCentred: true, radius: 2.5, immuneMs: 1000,
                color: 0x9ff0d8, glyph: '♪',
                blurb: 'Clears every ailment on you, then 1s immune'
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
        if (this.actionLocked?.('gadget')) return this._actionDenied('gadget');   // locked (HUD.lockActions): the sockets' ban signs flash
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
        FieldKit.fx(this);
        const g = this.add.sprite(fromX, fromY, 'fx_gadgets', def.id + '_t0').setDepth(5).setScale(1.5).play('fk_tumble_' + def.id);   // the gadget itself, tumbling (by its frames)
        const trail = FieldKit.sparks(this, def.id);

        // Ground shadow so the height of the arc is legible
        const sh = this.add.image(fromX, fromY, 'vfx_shadow').setDepth(1.6).setAlpha(0.5).setScale(0.22, 0.09);

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
                    if (Math.random() < 0.6) FieldKit.puff(trail, g.x, g.y, 1, 4, 18);   // a trail of its sparks
                }
                if (sh.active) { const k = 1 - 0.45 * Math.sin(t * Math.PI); sh.x = bx; sh.y = by + 6; sh.setScale(0.22 * k, 0.09 * k); }
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
        if (id === 'bell')      return this._gadgetBell(tx, ty, def);
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

    // Each strike is the lightning weapons' own pixel bolt (WeaponSystem.bolt: laid from hand-drawn pieces), dropping from
    // overhead with a fork or two off it, a flare where it lands and sparks thrown off the floor. Its life is longer than
    // reboltMs, so consecutive strikes OVERLAP: that's what makes it read as one sustained strike, not a stutter.
    _smiteBolt(enemy, def) {
        if (!enemy.sprite?.active) return;
        const TS = this.TILE_SIZE;
        const toX = enemy.sprite.x, toY = enemy.sprite.y + 4;
        const fromX = toX + (Math.random() - 0.5) * TS * 2;
        const fromY = toY - TS * (def.skyTiles || 9);
        WeaponSystem.bolt(this, fromX, fromY, toX, toY, 'y', { life: (def.holdMs || 70) + (def.fadeMs || 150), d: 5.5, br: 1 + (Math.random() < 0.5 ? 1 : 0) });
        WeaponSystem.zapFlare(this, toX, enemy.sprite.y + 6, 'y', 1.1, 0.97);   // it lands: a flare on the floor under it
        WeaponSystem.zapSparks(this, 'y').emitParticleAt(toX, enemy.sprite.y + 6, 2);
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
            if (e.sprite?.active && Math.random() < 0.22 * (1 - t)) {   // still jammed: cyan static crawling over it, less as the slow wears off
                const s = e.sprite, c = this.add.sprite(s.x + (Math.random() - 0.5) * 14, s.y - 2 + (Math.random() - 0.5) * 8, 'fx_gadgets', 'static_0')
                    .setDepth((s.depth ?? 1) + 0.06).setBlendMode(Phaser.BlendModes.ADD).setFlip(Math.random() < 0.5, Math.random() < 0.5).play('fk_static');
                c.once('animationcomplete', () => c.destroy());
            }
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

    // Three waves of its sparks rolling out to the edge of its reach, static flickering on the front as it goes, a burst
    // where you stand
    _empShockwave(def) {
        const TS = this.TILE_SIZE, R = def.radius * TS, E = FieldKit.sparks(this, 'emp', true);
        const px = this.playerX * TS + TS / 2, py = this.playerY * TS + TS / 2;
        const hit = this.add.sprite(px, py, 'fx_gadgets', 'hit_emp_0').setDepth(4.7).setScale(2).setAlpha(0.7).play('fk_hit_emp');
        hit.once('animationcomplete', () => hit.destroy());
        for (let w = 0; w < 3; w++) this.time.delayedCall(w * 90, () => FieldKit.ring(E, px, py, R * (1 - w * 0.12), 420, 90 - w * 20));
        for (let k = 1; k <= 6; k++) this.time.delayedCall(k * 60, () => {   // static on the wavefront
            for (let i = 0; i < 5; i++) {
                const a = Math.random() * Math.PI * 2, r = R * (1 - (1 - k / 6) ** 2);
                const c = this.add.sprite(px + Math.cos(a) * r, py + Math.sin(a) * r, 'fx_gadgets', 'static_0').setDepth(4.6).setScale(1.5)
                    .setBlendMode(Phaser.BlendModes.ADD).setFlip(Math.random() < 0.5, false).play('fk_static');
                c.once('animationcomplete', () => c.destroy());
            }
        });
        this._vfxFlash?.(px, py, R * 0.6, def.color, 380, 0.5);
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
        const caught = this._fkEnemiesIn(tx, ty, def.radius).slice(0, def.maxTargets), TS = this.TILE_SIZE;
        const portal = FieldKit.portal(this, tx * TS + TS / 2, ty * TS + TS / 2, caught.length ? 0 : 500);   // the pocket they go into
        if (!caught.length) return 0;

        // A second throw while a group is already held would orphan the first one in limbo
        // with nothing left alive to release it.
        if (this._fkHeld) this._releaseDisplaced(this._fkHeld, true);

        const held = { def, cx: tx, cy: ty, at: this.time.now, portal,
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
        held.portal?.close();
        if (!abort) FieldKit.portal(this, tx * TS + TS / 2, ty * TS + TS / 2, 420);   // and the one they come out of
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

    // An enemy folding out of the world (or back in): drawn in to a line of light that winks out, motes off it
    _fkVanishPuff(enemy, def) {
        if (!enemy.sprite) return;
        const s = enemy.sprite, b = this.add.sprite(s.x, s.y - 2, 'fx_gadgets', 'blink_0').setDepth(4.2).setScale(1.5).setAlpha(0.85).play('fk_blink');
        b.once('animationcomplete', () => b.destroy());
        FieldKit.puff(FieldKit.sparks(this, 'displacer'), s.x, s.y, 5, 20, 60);
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
        const marks = this._fkHeldMarks || (this._fkHeldMarks = []);
        held.members.forEach((m, i) => {
            const spot = this._fkNearestFloor(tx + m.dx, ty + m.dy, m.enemy);
            const mk = marks[i] || (marks[i] = this.add.sprite(0, 0, 'fx_gadgets', 'mark_0').setDepth(0.96).setScale(1.5).play('fk_mark'));
            mk.setVisible(!!spot).setAlpha(out ? 0.45 : 1);
            if (spot) mk.setPosition(spot.x * TS + TS / 2, spot.y * TS + TS / 2 + 2);
        });
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
        this._fkHeldMarks?.forEach(m => m.active && m.destroy());
        this._fkHeldGfx = null; this._fkHeldText = null; this._fkHeldMarks = null;
    }

    // ── WHAT CAN BE ON YOU ───────────────────────────────────────────────────
    // Every ailment an enemy or the floor puts on you, each [kind, on(now), clear(now)], where it lives on the scene. The
    // Cleansing Bell clears them all; the Pendulum's Rewind (Cosmic.js) the ones you picked up since the moment it goes back to.
    // A slow is cleared by setting its time to one already past, so its own expiry puts your step back (EnemyManager.moveEnemies,
    // _updateCrumbleTiles). The ice ult's shell holds you itself: that's never cleared.
    _playerAilments() {
        return this._fkAilList ||= [
            ['burn',   n => this._pBurnUntil > n,    () => { this._pBurnUntil = 0; this._pBurn = 0; }],
            ['poison', n => this._poisonUntil > n,   () => { this._poisonUntil = 0; this.playerPoisoned = false; }],
            ['bleed',  n => this._bleedUntil > n,    () => { this._bleedUntil = 0; }],
            ['drip',   n => this._drippingUntil > n, () => { this._drippingUntil = 0; }],
            ['hex',    n => this._absHexUntil > n,   () => { this._absHexUntil = 0; }],
            ['winded', n => this._windedUntil > n,   () => { this._windedUntil = 0; }],
            ['blind',  n => this._nsight?.until > n, n => { this._nsight.until = n; }],   // (its veil lifts next frame, Blinder.sight; its own immunity after it stays)
            ['root',   n => !!this._playerRooted,    () => { this._playerRooted = false; this._playerRootUntil = 0; this.player?.clearTint(); }],
            ['glue',   n => this._gluUntil > n,      () => { this._gluUntil = 0; }],
            ['slow',   n => (this._singularitySlowed && this._singularitySlowUntil > n) || this._anchorSlowUntil > n || this._crumbleSlowUntil > n || this._dvSlowUntil > n || this._waterSlowUntil > n,
                       n => { for (const k of ['_singularitySlowUntil', '_anchorSlowUntil', '_crumbleSlowUntil']) if (this[k] > n) this[k] = 1; this._dvSlowUntil = 0; this._waterSlowUntil = 0; }],
            ['daze',   n => this._staggerUntil > n && !(this._iceShellUntil > n), n => { this._staggerUntil = n; }],
        ];
    }
    // Every ailment on you gone; how many there were
    _fkCleanse(now) {
        let n = 0;
        for (const [, on, clear] of this._playerAilments()) if (on(now)) { clear(now); n++; }
        return n;
    }

    // ── CLEANSING BELL ───────────────────────────────────────────────────────
    // Rung over your head (its icon's frames: the clapper striking one side, then the other), a ring of clean air goes out
    // from you (soft haze with no outline, white to mint, running together as it spreads, the Grounding Spike's mint sparks
    // at its edge), and what was on you is shaken off in dark specks. For immuneMs a pale shimmer stays on you: anything new
    // is shaken off as it lands (updateFieldKit), no hold takes you (_ccGate says RESISTED), the Blinder can't blind you.
    _gadgetBell(tx, ty, def) {
        const now = this.time.now, p = this.player, TS = this.TILE_SIZE;
        if (!p?.active) return 0;
        const n = this._fkCleanse(now);
        this._bellUntil = now + def.immuneMs;
        this._ccImmuneUntil = Math.max(this._ccImmuneUntil || 0, this._bellUntil);
        this._nsight = this._nsight ? Object.assign(this._nsight, { immune: Math.max(this._nsight.immune || 0, this._bellUntil) }) : { t0: now, ms: 1, until: now, immune: this._bellUntil };
        const key = ShopScene.gadgetIcon(this, 'bell');
        const bell = this.add.sprite(p.x, p.y - 34, key, '0').setDepth(5.2).setScale(0);
        bell.play({ key, frameRate: 14, repeat: 2 });
        this.tweens.add({ targets: bell, scale: 1.5, duration: 160, ease: 'Back.easeOut' });
        this.tweens.add({ targets: bell, alpha: 0, y: '-=8', delay: 620, duration: 220, onUpdate: () => bell.setX(p.x), onComplete: () => bell.destroy() });
        const air = FieldKit.cleanAir(this), x = p.x, y = p.y + 4;
        CosmicSystem.ring(air, x, y, def.radius * TS, 520, 30, 22);   // (born a little way out: all at its middle they'd burn white)
        CosmicSystem.ring(air, x, y, def.radius * TS * 0.6, 380, 10, 14);
        FieldKit.ring(FieldKit.sparks(this, 'grounding', true), x, y, def.radius * TS * 1.1, 460, 16);
        FieldKit.puff(air, x, y - 8, 2 + Math.min(n, 6), 10, 40, 30);   // (more the more it took off you)
        this._vfxFlash?.(x, y - 30, 40, def.color, 220, 0.35);
        this.showStatusText?.(x, y - 52, n ? 'CLEANSED' : 'CLEAR', '#c8fff0');
        const sh = this.add.sprite(p.x, p.y, p.texture.key, p.frame.name).setOrigin(p.originX, p.originY).setScale(p.scaleX * 1.1, p.scaleY * 1.1).setFlipX(p.flipX)
            .setTintFill(0xd8fff0).setBlendMode(Phaser.BlendModes.ADD).setDepth((p.depth ?? 1) + 0.02).setAlpha(0.55);
        this.tweens.add({ targets: sh, alpha: 0, duration: def.immuneMs, onUpdate: () => sh.setPosition(p.x, p.y).setFrame(p.frame.name), onComplete: () => sh.destroy() });
        this.cameras.main.shake(40, 0.002);
        Sfx.play(this, 'bell');
        return n;
    }
    // Clean air: fx_fractal's soft haze (no outline), white going to mint and out, added, so where it crowds it runs together
    static cleanAir(S) {
        if (S._fkAir?.active) return S._fkAir;
        return (S._fkAir = S.add.particles(0, 0, 'fx_fractal', { frame: ['haze_0', 'haze_1', 'haze_2', 'haze_3', 'haze_4', 'haze_5'], emitting: false, blendMode: Phaser.BlendModes.ADD,
            lifespan: 520, scale: { start: 1.6, end: 2.8 }, alpha: { start: 0.7, end: 0, ease: 'Quad.easeIn' }, color: [0xe0fff6, 0xb8f8e4, 0x7ae0c4, 0x2a8a78], colorEase: 'quad.out' }).setDepth(4.85));
    }

    // ── PER-FRAME ────────────────────────────────────────────────────────────
    updateFieldKit(time) {
        if (this._bellUntil > this.time.now) this._fkCleanse(this.time.now);   // the bell still ringing: whatever lands is shaken off
        this._decayEmpSlows(time);
        this._fkUpdateMend(time);
        this._fkDrawSockets();
        TideMother.callHud(this);   // Riyal's socket, beside the gadgets'
        if (this._fkHeld) {
            if (time >= this._fkHeld.until) this._timeoutDisplaced(this._fkHeld);
            else this._fkUpdateHeldPrompt(time);
        }
    }

    // ── GROUNDING SPIKE ──────────────────────────────────────────────────────
    // Suppresses partial RESISTANCE, not immunity. A fire elemental does not become
    // burnable because you threw a spike at it; what lifts is the resistTrait multiplier,
    // which is the thing that compounds with floor HP scaling into a 4.2x slog by floor 5.
    // The stake hammers in from above, the floor splits round it and copper studs come up at the edge of its reach; while
    // it holds them, a crackle runs from its head to every enemy it's grounding. Then it sinks back into the floor.
    _gadgetGrounding(tx, ty, def) {
        const TS = this.TILE_SIZE, sx = tx * TS + TS / 2, sy = ty * TS + TS / 2 + 6, R = def.radius * TS, F = FieldKit.fx(this);
        const spike = this.add.sprite(sx, sy - 70, 'fx_gadgets', 'spike_0').setOrigin(0.5, 1).setScale(1.5).setDepth(2.3).play('fk_spike');
        const crack = this.add.image(sx, sy - 3, 'fx_gadgets', 'crack').setScale(1.5).setDepth(0.92).setVisible(false);
        const studs = [];
        for (let i = 0; i < 14; i++) {
            const a = i / 14 * Math.PI * 2, st = this.add.sprite(sx + Math.cos(a) * R, sy - 4 + Math.sin(a) * R, 'fx_gadgets', 'stud_0').setOrigin(0.5, 1).setScale(1.5).setDepth(0.93);
            FieldKit.rise(this, st, 160, false, null, 130 + i * 18);
            studs.push(st);
        }
        this.tweens.add({ targets: spike, y: sy, duration: 130, ease: 'Quad.easeIn', onComplete: () => {
            if (!crack.active) return;
            crack.setVisible(true);
            FieldKit.puff(F.dust, sx, sy - 2, 6, 10, 40, 10);
            FieldKit.puff(FieldKit.sparks(this, 'grounding'), sx, sy - 6, 12, 40, 120, 30);
            this.cameras.main.shake(90, 0.004);
        } });
        const grounded = [];
        const arcs = this.time.addEvent({ delay: 140, loop: true, callback: () => {   // a crackle from the head to each enemy it holds
            for (const e of grounded) {
                if (!e.sprite?.active || !e._resistSuppressed || !spike.active) continue;
                WeaponSystem.bolt(this, spike.x, spike.y - 36, e.sprite.x, e.sprite.y - 4, 'c', { life: 120, thin: true, br: 0, d: 4.6 });
            }
            const st = studs[Math.floor(Math.random() * studs.length)];   // a stud catching the current
            if (st?.active) { st.setFrame('stud_1'); this.time.delayedCall(180, () => st.active && st.setFrame('stud_0')); }
        } });
        this.time.delayedCall(def.suppressMs, () => {
            arcs.remove();
            for (const o of [crack, ...studs]) if (o.active) this.tweens.add({ targets: o, alpha: 0, duration: 300, onComplete: () => o.destroy() });
            if (spike.active) { spike.stop(); FieldKit.rise(this, spike, 260, true, () => spike.destroy()); }
        });
        const targets = this._fkEnemiesIn(tx, ty, def.radius);
        let n = 0;
        for (const e of targets) {
            if (!ElementResist.traitsOf(e).length && !e._resistSuppressed) continue;   // nothing to strip
            e._resistSuppressed = true;
            grounded.push(e);
            n++;
            this._buildResistAura?.(e);   // its ring goes grey while it's grounded
            this.showStatusText?.(e.sprite.x, e.sprite.y - 16, 'GROUNDED', '#66ffcc');
            if (e._resistSuppressTimer) e._resistSuppressTimer.remove();
            e._resistSuppressTimer = this.time.delayedCall(def.suppressMs, () => {
                e._resistSuppressed = false;
                e._resistSuppressTimer = null;
                if (e.sprite?.active) this._buildResistAura?.(e);   // its colours back
            });
        }
        return n;
    }

    // ── MEND TOTEM ───────────────────────────────────────────────────────────
    // A carved totem comes up out of the floor where it lands, leaves and flowers spring up round the edge of its reach and
    // a soft green light fills it. While you stand inside, it heals a share of your max HP every second; then it sinks back.
    _gadgetMend(tx, ty, def) {
        const TS = this.TILE_SIZE, x = tx * TS + TS / 2, y = ty * TS + TS / 2, R = def.radius * TS, F = FieldKit.fx(this);
        const glow = this.add.image(x, y, 'vfx_glow').setTint(def.color).setBlendMode(Phaser.BlendModes.ADD).setDepth(0.9).setAlpha(0.3).setScale(R / 52);
        this.tweens.add({ targets: glow, alpha: 0.16, duration: 1100, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
        const g = this.add.sprite(x, y + 10, 'fx_gadgets', 'totem_0').setOrigin(0.5, 1).setScale(1.5).setDepth(2.2);
        FieldKit.rise(this, g, 280, false, () => g.active && g.play('fk_totem'));
        const ring = [];
        for (let i = 0; i < 16; i++) {   // the edge of its reach, in leaves
            const a = (i + Math.random() * 0.5) / 16 * Math.PI * 2;
            const sp = this.add.sprite(x + Math.cos(a) * R, y + 4 + Math.sin(a) * R, 'fx_gadgets', 'sprout_' + (i % 3)).setOrigin(0.5, 1).setScale(1.5).setDepth(0.97).setFlipX(Math.random() < 0.5);
            FieldKit.rise(this, sp, 200, false, null, 120 + i * 20);
            ring.push(sp);
        }
        const motes = this.time.addEvent({ delay: 260, loop: true, callback: () => {   // little crosses rising inside its ring
            const a = Math.random() * Math.PI * 2, r = Math.random() * R * 0.85;
            F.heal.emitParticleAt(x + Math.cos(a) * r, y + Math.sin(a) * r, 1);
        } });
        this._vfxFlash?.(x, y, 70, def.color, 400, 0.35);
        if (!this._fkMends) this._fkMends = [];
        this._fkMends.push({ x: tx, y: ty, until: this.time.now + def.durationMs, def, g, ring, glow, motes, lastTick: this.time.now });
    }
    _fkUpdateMend(time) {
        if (!this._fkMends?.length) return;
        for (const m of [...this._fkMends]) {
            if (time >= m.until) {   // it sinks back into the floor, the leaves with it
                m.motes.remove(); this.tweens.killTweensOf(m.glow);
                this.tweens.add({ targets: m.glow, alpha: 0, duration: 300, onComplete: () => m.glow.destroy() });
                if (m.g.active) { m.g.stop(); FieldKit.rise(this, m.g, 300, true, () => m.g.destroy()); }
                m.ring.forEach((sp, i) => sp.active && FieldKit.rise(this, sp, 180, true, () => sp.destroy(), i * 12));
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
            if (m.g?.active && this.player?.active) {   // a thread of green motes running from its heart to you
                const E = FieldKit.sparks(this, 'mend'), x0 = m.g.x, y0 = m.g.y - 16, x1 = this.player.x, y1 = this.player.y - 6;
                for (let i = 0; i < 9; i++) this.time.delayedCall(i * 22, () => {
                    const p = E.emitParticleAt(x0 + (Math.random() - 0.5) * 4, y0 + (Math.random() - 0.5) * 4, 1);
                    if (p) { p.velocityX = (x1 - x0) / 0.3; p.velocityY = (y1 - y0) / 0.3; p.life = p.lifeCurrent = 300; }
                });
                this.time.delayedCall(300, () => FieldKit.puff(FieldKit.fx(this).heal, x1, y1, 3, 10, 30, 20));
            }
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
        const F = FieldKit.fx(this);
        const blocks = tiles.map(t => {   // a block of stone comes up out of the floor on each tile, dust kicked up round its foot
            this.world[t.x][t.y] = this.WALL;
            const x = t.x * TS + TS / 2, y = t.y * TS + TS;
            const sh = this.add.image(x + 2, y - 1, 'vfx_shadow').setDepth(2.15).setAlpha(0.5).setScale(0.42, 0.12);
            const g = this.add.sprite(x, y, 'fx_gadgets', 'wall_0').setOrigin(0.5, 1).setDepth(2.2);
            FieldKit.rise(this, g, 180);
            FieldKit.puff(F.dust, x, y - 4, 3, 10, 40, 8);
            return { ...t, g, sh };
        });
        this.cameras.main.shake(60, 0.004);
        this.time.delayedCall(def.durationMs - 700, () => blocks.forEach(b => b.g.active && b.g.setFrame('wall_1')));   // cracks: it's about to go
        this.time.delayedCall(def.durationMs, () => {
            for (const b of blocks) {
                if (this.world?.[b.x]?.[b.y] === this.WALL) this.world[b.x][b.y] = this.FLOOR;
                if (b.g.active) FieldKit.rise(this, b.g, 220, true, () => { b.g.destroy(); b.sh.destroy(); });
                const x = b.x * TS + TS / 2, y = b.y * TS + TS;   // it crumbles: rubble and dust
                FieldKit.puff(F.rock, x, y - 20, 5, 30, 80, 60);
                FieldKit.puff(F.dust, x, y - 8, 4, 10, 40, 10);
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
        const dk = LevelManager.slimeRecolor(this, 'slime_decoy', [[60, 14, 40], [150, 50, 100], [230, 110, 170], [255, 170, 210], [255, 230, 242]]);   // you, in pink
        const s = this.add.sprite(px, py + (this.SLIME_Y_OFFSET || 0), dk || this.player.texture.key, 0)
            .setScale(this.player.scaleX, this.player.scaleY).setAlpha(0.95).setDepth(this.player.depth - 0.02);
        if (dk && this.anims.exists(dk + '_idle')) s.play(dk + '_idle');
        if (typeof CreatureFX !== 'undefined') CreatureFX.face(this, s, { mood: 'friend', look: 'pointer' });
        const E = FieldKit.sparks(this, 'decoy', true);
        const ring = this.add.image(px, py, 'vfx_glow').setTint(def.color).setBlendMode(Phaser.BlendModes.ADD).setDepth(0.9).setAlpha(0.28).setScale(0.9);   // a soft pink light on it
        const bar = this.add.graphics().setDepth(5);
        const drawBar = (hp) => { bar.clear(); bar.fillStyle(0x000000, 0.6).fillRect(px - 12, py - 26, 24, 4); bar.fillStyle(def.color, 1).fillRect(px - 12, py - 26, 24 * Math.max(0, hp) / def.hp, 4); };
        drawBar(def.hp);
        const heart = this.add.sprite(px, py - 36, 'fx_gadgets', 'heart_0').setScale(1.5).setDepth(5).play('fk_heart');   // beating over it
        const pulses = this.time.addEvent({ delay: 700, loop: true, callback: () => { if (s.active) FieldKit.ring(E, px, py + 4, def.taunt * TS, 650, 40); else pulses.remove(); } });   // calling them over: its pink rolling out to the edge of its pull
        s.setScale(0.2); this.tweens.add({ targets: s, scaleX: this.player.scaleX, scaleY: this.player.scaleY, duration: 220, ease: 'Back.easeOut' });
        const ally = this._addAlly({
            x: spot.x, y: spot.y, hp: def.hp, taunt: def.taunt, until: this.time.now + def.durationMs,
            hurt: (amt) => {
                ally.hp -= amt; drawBar(ally.hp);
                s.setTintFill(0xffffff); this.time.delayedCall(80, () => s.active && s.clearTint());
            },
            onEnd: () => {
                // the pop: a burst of pink, and a shove of damage into whatever crowded it
                Sfx.play(this, 'pop');
                this._fkBurst(spot.x, spot.y, def);
                for (const e of this._fkEnemiesIn(spot.x, spot.y, def.radius)) this.damageEnemy(e, def.popDamage * (this.damageScaling || 1), 'physical');
                this.tweens.killTweensOf(ring);
                pulses.remove();
                [s, ring, bar, heart].forEach(o => o?.active && (this.tweens.killTweensOf(o), o.destroy()));
            },
        });
    }

    // ── SOCKETS ──────────────────────────────────────────────────────────────
    // The two slots on screen, left of the element gems: the gadget's glyph, its key, and
    // a dark sweep counting the cooldown down, with the seconds left.
    _fkDrawSockets() {
        if (!this.player || this._deathScreenActive) { this._fkSock?.g.setVisible(false); [...(this._fkSock?.ic || []), ...(this._fkSock?.art || [])].forEach(o => o?.setVisible(false)); return; }
        if (!this._fkSock || !this._fkSock.g.active) {
            const g = this.add.graphics().setScrollFactor(0).setDepth(40);
            const txt = [0, 1].map(() => this.add.text(0, 0, '', { fontSize: '16px', fontFamily: 'monospace', fontStyle: 'bold', color: '#ffffff', stroke: '#000', strokeThickness: 3 })
                .setOrigin(0.5).setScrollFactor(0).setDepth(41));
            const key = [0, 1].map(i => this.add.text(0, 0, Settings.label(Settings.key(i ? 'gadget2' : 'gadget1')), { fontSize: '11px', fontFamily: 'monospace', fontStyle: 'bold', color: '#d2bf98', stroke: '#000', strokeThickness: 2 })
                .setOrigin(0.5).setScrollFactor(0).setDepth(41));
            // each socket in its pieces (ui_kit, drawn at 2x): the iron ring and well, the glow in the well and the rim (both
            // tinted the gadget's colour); the cooldown's sweep is drawn between them each frame
            const art = [0, 1].flatMap(() => [['sock_gad', 39.9], ['sock_gad_glow', 39.95], ['sock_gad_rim', 40.05]].map(([f, d]) => this.add.image(0, 0, 'ui_kit', f).setOrigin(0.5, 11.5 / 24).setScale(2).setScrollFactor(0).setDepth(d)));
            this._fkSock = { g, txt, key, art, ic: [null, null], icId: [null, null] };
        }
        const S = this._fkSock, W = this.scale.width, H = this.scale.height, R = 21;
        const slots = this._gadgetSlots || this.beginGadgetRun();
        S.g.clear().setVisible(true);
        slots.forEach((id, i) => {
            const cx = W / 2 - 236 + i * 54, cy = H - 34, def = id ? this._gadgetDefs()[id] : null, [ring, glow, rim] = S.art.slice(i * 3, i * 3 + 3);
            ring.setPosition(cx, cy).setVisible(true).setTint(def ? 0xffffff : 0xbcb4a8);   // (an empty one a shade duller)
            S.key[i].setPosition(cx, cy + R + 7);
            if (!def) { S.txt[i].setText('').setVisible(false); S.ic[i]?.setVisible(false); glow.setVisible(false); rim.setVisible(false); return; }
            const left = this.gadgetCooldownLeft(id), frac = left / def.cooldown;
            glow.setPosition(cx, cy).setVisible(true).setTint(def.color).setAlpha(left > 0 ? 0.12 : 0.3);
            if (S.icId[i] !== id || !S.ic[i]?.active) {   // the gadget itself, animated, in its socket (it was a letter)
                S.ic[i]?.destroy();
                const k = ShopScene.gadgetIcon(this, id);
                S.ic[i] = k ? this.add.sprite(cx, cy, k, '0').setScrollFactor(0).setDepth(40.5).setScale(1.45) : null;
                if (S.ic[i] && this.anims.exists(k)) S.ic[i].play(k);
                S.icId[i] = id;
            }
            S.ic[i]?.setVisible(true).setPosition(cx, cy).setAlpha(left > 0 ? 0.35 : 1);
            if (left > 0) {   // the sweep: what's still recharging, dark, clockwise from the top
                S.g.fillStyle(0x000000, 0.6);
                S.g.slice(cx, cy, R - 1, -Math.PI / 2, -Math.PI / 2 + frac * Math.PI * 2, false);
                S.g.fillPath();
            }
            rim.setPosition(cx, cy).setVisible(true).setTint(left > 0 ? 0x5e574e : def.color);
            S.txt[i].setVisible(left > 0).setPosition(cx, cy).setText(left > 0 ? String(Math.ceil(left / 1000)) : '')
                .setColor('#f3e3b8').setStroke('#000', 3);
        });
    }

    // ── IMPACT VISUAL ────────────────────────────────────────────────────────
    // A gadget going off: its own burst drawn in its colours, a ring of its sparks flung out to the edge of its reach,
    // bits of the casing thrown and falling, a scorch on the floor that fades, a little light and shake.
    // Each kind adds its own: Smite crackles over the floor, Mend blooms, the Bulwark throws dust, the Decoy pops in confetti.
    _fkBurst(tx, ty, def) {
        const TS = this.TILE_SIZE, F = FieldKit.fx(this), E = FieldKit.sparks(this, def.id);
        const px = tx * TS + TS / 2, py = ty * TS + TS / 2, R = def.radius * TS, col = def.color;
        const scorch = this.add.image(px, py + 5, 'fx_gadgets', 'scorch').setDepth(0.9).setScale(1.5).setAlpha(0.7).setFlipX(Math.random() < 0.5);   // the mark it leaves
        this.tweens.add({ targets: scorch, alpha: 0, delay: 900, duration: 1600, onComplete: () => scorch.destroy() });
        const glow = this.add.image(px, py, 'vfx_glow').setTint(col).setBlendMode(Phaser.BlendModes.ADD).setDepth(4.5).setAlpha(0.25).setScale(R / 64);
        this.tweens.add({ targets: glow, alpha: 0, duration: 420, ease: 'Quad.easeOut', onComplete: () => glow.destroy() });
        const hit = this.add.sprite(px, py, 'fx_gadgets', `hit_${def.id}_0`).setDepth(4.7).setScale(2).setAlpha(0.85).setFlip(Math.random() < 0.5, false).play('fk_hit_' + def.id);
        hit.once('animationcomplete', () => hit.destroy());
        FieldKit.ring(E, px, py, R, 360, Math.round(8 + R / 6));   // how far it reaches
        FieldKit.puff(E, px, py, 6, 30, 110);
        F.chip.setParticleTint(col);
        FieldKit.puff(F.chip, px, py - 2, 8, 40, 110, 70);   // bits of the casing, thrown up and falling
        const extra = {
            smite: () => { for (let i = 0; i < 4; i++) { const a = (i + Math.random() * 0.5) / 4 * Math.PI * 2; WeaponSystem.bolt(this, px, py, px + Math.cos(a) * R * 0.8, py + Math.sin(a) * R * 0.6, 'y', { life: 220, thin: true, br: 0, d: 4.9 }); } },
            mend: () => FieldKit.puff(F.heal, px, py - 4, 8, 10, 40, 30),
            bulwark: () => FieldKit.puff(F.dust, px, py + 2, 8, 20, 60, 10),
            decoy: () => {
                const pop = this.add.sprite(px, py + 2, 'fx_gadgets', 'pop_0').setDepth(4.75).setScale(1.5).play('fk_pop');
                pop.once('animationcomplete', () => pop.destroy());
                FieldKit.puff(F.conf, px, py - 4, 16, 50, 130, 90);
            },
        }[def.id];
        extra?.();
        this._vfxFlash?.(px, py, R * 0.8, col, 260, 0.45);
        this.cameras.main.shake(60, 0.003);
        Sfx.play(this, 'boom');
    }

}
