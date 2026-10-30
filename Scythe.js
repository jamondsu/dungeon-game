// ═══════════════════════════════════════════════════════════════════════════
// Scythe.js — the Ember Scythe (fire, tier 5)
// Click: you whirl the long scythe round you once (twice with a level of Reaper's Whirl, three times in the same time with two), at an even
// speed. Each turn cuts everything within REACH (a hit and a Burn stack, so one of each a swing, two or three). The blade sheds fire as it goes (Scythe.burn): hand-drawn flames thick
// across its span, burning white-hot where they crowd and red at the edges as they rise and die, a heat glow under them,
// embers flung off; and here and there a tongue of fire is left on the floor. Each swing sets one
// tile within reach alight: an EMBER, burning EMBER_MS; every second, everything on it or beside it has EMBER_P (more
// with Kindling) of a Super Burn stack. Every enemy a swing cuts drops an EMBER SOUL: walk near to take it (SOUL_MAX).
// R, for SOUL_COST souls: HEAT WAVE. You point the scythe and a narrow crescent of heat, WAVE_W tiles across, pulses out
// along your aim to WAVE_RANGE, then FIRE_WAVES crescents of fire after it, the ground they cross left burning for
// FIRE_MS (white-hot), and WAVE_EMBERS embers left at random along it, burning WAVE_EMBER_MS. Every crescent gives each enemy it reaches a Super Burn stack; the
// cast heals you WAVE_HEAL of your max HP.
// After either, if you're moving, a free SLIDE: SLIDE tiles toward the crosshair, and a
// shield of SHIELD of your max HP for SHIELD_MS that takes hits before your health does (a fresh one, never stacked).
// Art: assets/art/ember_scythe (spin_e/ese/se/sse/s/ssw/sw/wsw, the other eight flipped both ways; flame_0-3; soul_0-3).
// ═══════════════════════════════════════════════════════════════════════════
class Scythe {
    static CFG = { CD: 1100, SPIN_MS: 550, SPINS: 1, REACH: 4.3, REACH_UP: 0.5, DMG: 6, SCALE: 2.5, TIP: 39, BLADE: 32, HAND: 5,   // TIP, BLADE, HAND: art pixels out from you (the blade's tip, where it starts, your grip)
        EMBER_MS: 7000, EMBER_MAX: 6, EMBER_P: 0.3, EMBER_UP: 0.1,   // (EMBER_UP a level of Kindling)
        SOUL_MS: 12000, SOUL_PULL: 1.8, SOUL_MAX: 30, SOUL_COST: 5,
        WAVE_HEAL: 0.04, WIND: 160, WAVE_RANGE: 9, WAVE_UP: 2, WAVE_W: 3, CURVE: 2.2, WAVE_SPEED: 18, WAVE_DMG: 30, FIRE_DMG: 8, FIRE_WAVES: 2, FIRE_GAP: 260, FIRE_MS: 2000, WAVE_EMBERS: 3, WAVE_EMBER_MS: 12000,   // (WAVE_W tiles wide, its front bowed like a slice of a circle CURVE tiles round)
        DRY: 6, BOIL: 99,   // water: what a turn of the swing dries off a tile; the Heat Wave and an ember boil it off at once
        SLIDE: 3, SLIDE_MS: 150, SHIELD: 0.1, SHIELD_MS: 3000 };   // (SLIDE_MS a tile: 3 tiles in 0.45s, a glide a little quicker than ice's dash, 6 in 0.6s)
    // sixteenths of a turn clockwise from east: the frame, and whether it's flipped both ways
    static DIRS = [['e', false], ['ese', false], ['se', false], ['sse', false], ['s', false], ['ssw', false], ['sw', false], ['wsw', false],
        ['e', true], ['ese', true], ['se', true], ['sse', true], ['s', true], ['ssw', true], ['sw', true], ['wsw', true]];
    static held(S) { return S.currentElement === 'fire' && S.equippedWeapons?.fire === 'ember_scythe'; }
    static st(S) {
        if (!S._scy) {
            S._scy = { souls: 0, embers: [], drops: [], spinAt: -1e9 };
            S.events.once('shutdown', () => { S._scy = null; });
            const A = S.anims;
            if (!A.exists('scy_flame')) A.create({ key: 'scy_flame', frames: [0, 1, 2, 3].map(i => ({ key: 'ember_scythe', frame: 'flame_' + i })), frameRate: 9, repeat: -1 });
            if (!A.exists('scy_soul')) A.create({ key: 'scy_soul', frames: [0, 1, 2, 3].map(i => ({ key: 'ember_scythe', frame: 'soul_' + i })), frameRate: 7, repeat: -1 });
            if (!A.exists('scy_lick')) A.create({ key: 'scy_lick', frames: [0, 1, 2, 3, 2, 3, 4, 5].map(i => ({ key: 'ember_scythe', frame: 'lick_' + i })), frameRate: 9, repeat: 0 });
            if (!A.exists('scy_spark')) A.create({ key: 'scy_spark', frames: [0, 1, 2, 3].map(i => ({ key: 'ember_scythe', frame: 'spark_' + i })), frameRate: 6, repeat: 0 });
        }
        return S._scy;
    }
    // how far the swing reaches (tiles: REACH, and REACH_UP a level of Wide Sweep), and the scythe drawn to match it
    static perk(k) { return WeaponLevels.perk('ember_scythe', k) || 0; }
    static spins() { return Scythe.CFG.SPINS + Scythe.perk('whirl'); }   // (Reaper's Whirl: a second turn, then a third, no slower a swing)
    static spinMs() { return Scythe.CFG.SPIN_MS * Math.min(1, Scythe.spins() / 2); }   // (one turn as quick a turn as two; three crammed into the same time)
    static reach() { return Scythe.CFG.REACH + Scythe.CFG.REACH_UP * Scythe.perk('reach'); }
    static scale() { return Scythe.CFG.SCALE * Scythe.reach() / Scythe.CFG.REACH; }
    static frameAt(a) { return Scythe.DIRS[((Math.round(a / (Math.PI / 8)) % 16) + 16) % 16]; }
    // a band of fire round (cx, cy) between radii r0 and r1, from angle a0 to a1 (clockwise)
    static band(g, r0, r1, a0, a1, col, al, cx = 0, cy = 0) {
        g.fillStyle(col, al).beginPath();
        g.arc(cx, cy, r1, a0, a1, false); g.arc(cx, cy, r0, a1, a0, true);
        g.closePath(); g.fillPath();
    }
    // The fire, a scene's particle emitters, made the first time: flames (fire_0-9, hand-drawn), each burning down from
    // white-hot through yellow, orange and red to nothing as it rises (ADD: where they crowd they burn white, the edges
    // red); a soft heat glow under them; embers that fly and cool
    static fire(S) {
        const st = Scythe.st(S), ADD = Phaser.BlendModes.ADD;
        if (st.fx?.flame?.active) return st.fx;
        // (ten shapes, each its own size and stretch, shrinking as it burns: a stream of them never one flame stamped over and over)
        const flame = S.add.particles(0, 0, 'ember_scythe', { frame: Array.from({ length: 10 }, (_, i) => 'fire_' + i), emitting: false,
            lifespan: { min: 170, max: 380 }, speed: { min: 8, max: 45 }, angle: { min: 0, max: 360 }, gravityY: -240, rotate: { min: -32, max: 32 },
            scaleX: { onEmit: p => (p._sx = 1.3 + Math.random() * 1.7), onUpdate: (p, k, t) => (p._sx || 2) * (1 - 0.75 * t) },
            scaleY: { onEmit: p => (p._sy = (p._sx || 2) * (0.85 + Math.random() * 0.7)), onUpdate: (p, k, t) => (p._sy || 2) * (1 - 0.7 * t) },
            alpha: { start: 0.8, end: 0 }, color: [0xffe8a0, 0xffc060, 0xff8a30, 0xe8501a, 0xa02010, 0x401008], colorEase: 'quad.out', blendMode: ADD }).setDepth(3.1);   // (pale yellow at its hottest: white where they crowd blinded the fight)
        const small = S.add.particles(0, 0, 'ember_scythe', { frame: Array.from({ length: 10 }, (_, i) => 'fire_' + i), emitting: false,   // (the snath's: smaller and dimmer, thick enough to run together)
            lifespan: { min: 140, max: 300 }, speed: { min: 6, max: 30 }, angle: { min: 0, max: 360 }, gravityY: -200, rotate: { min: -32, max: 32 },
            scaleX: { onEmit: p => (p._sx = 0.9 + Math.random() * 1.1), onUpdate: (p, k, t) => (p._sx || 1.4) * (1 - 0.75 * t) },
            scaleY: { onEmit: p => (p._sy = (p._sx || 1.4) * (0.85 + Math.random() * 0.7)), onUpdate: (p, k, t) => (p._sy || 1.4) * (1 - 0.7 * t) },
            alpha: { start: 0.38, end: 0 }, color: [0xffd890, 0xffa850, 0xf06a24, 0xb83014, 0x501008], colorEase: 'quad.out', blendMode: ADD }).setDepth(3.1);
        const glow = S.add.particles(0, 0, 'vfx_glow', { emitting: false, lifespan: { min: 200, max: 360 }, speed: { min: 0, max: 20 }, gravityY: -60,   // (the heat under it all: the gaps between flames glow)
            scale: { start: 0.55, end: 0.2 }, alpha: { start: 0.2, end: 0 }, color: [0xffa040, 0xff5a1a, 0x801808], blendMode: ADD }).setDepth(3.09);
        const ember = S.add.particles(0, 0, 'ember_scythe', { frame: ['spark_0', 'spark_1'], emitting: false, lifespan: { min: 400, max: 900 },
            speed: { min: 30, max: 120 }, angle: { min: 0, max: 360 }, gravityY: -90, scale: { start: 1.6, end: 0.5 }, alpha: { start: 1, end: 0 },
            color: [0xffffff, 0xffd060, 0xff6a1a, 0x8a1c0a], blendMode: ADD }).setDepth(3.25);
        return (st.fx = { flame, small, glow, ember });
    }
    // The trail: fire shed all along the arc the scythe swept since the last frame (a0 to a1 round (x, y)): an even body of
    // small soft flames and glow across its whole span, big flames scattered through it as texture, embers off the tip
    static burn(S, a0, a1, x, y) {
        const C = Scythe.CFG, K = Scythe.scale(), F = Scythe.fire(S), n = Math.max(1, Math.ceil(Math.abs(a1 - a0) * C.TIP * K / 8));
        for (let i = 1; i <= n; i++) {
            const b = a0 + (a1 - a0) * i / n, c = Math.cos(b), s = Math.sin(b), at = r => [x + c * r * K, y + s * r * K];
            const any = (lo, hi) => at(lo + Math.random() * (hi - lo));
            for (let j = 0; j < 3; j++) F.small.emitParticleAt(...any(C.HAND + 6, C.TIP + 2), 1);   // the body: small soft flames all across its span, running together
            for (let j = 0; j < 2; j++) F.glow.emitParticleAt(...any(C.HAND + 8, C.TIP), 1);   // and the heat's glow under them
            F.flame.emitParticleAt(...any(C.HAND + 8, C.TIP + 4), 1);   // the texture: big flames scattered right through it
            if (Math.random() < 0.6) F.flame.emitParticleAt(...any(C.BLADE - 2, C.TIP + 4), 1);   // (and a few more at the blade: its edge burns hottest)
            if (Math.random() < 0.25) F.ember.emitParticleAt(...at(C.TIP), 1);
        }
    }
    // A ring of fire burning out from (x, y) to r over ms: flames thrown down round circles growing outward, the glow with them
    static ringFire(S, x, y, r0, r, ms, n) {
        const F = Scythe.fire(S), STEPS = 7;
        for (let k = 0; k <= STEPS; k++) S.time.delayedCall(ms * k / STEPS, () => {
            const R = r0 + (r - r0) * k / STEPS;
            for (let i = 0; i < n; i++) { const b = Math.random() * Math.PI * 2, R2 = R + (Math.random() - 0.5) * 14; F.flame.emitParticleAt(x + Math.cos(b) * R2, y + Math.sin(b) * R2, 1); }
            for (let i = 0; i < n / 4; i++) { const b = Math.random() * Math.PI * 2; F.glow.emitParticleAt(x + Math.cos(b) * R, y + Math.sin(b) * R, 1); }
        });
    }
    // A tongue of fire left on the floor where the blade passed at angle a round (x, y): the hand-drawn flame catching,
    // burning tall and swaying, dying back to a coal and a curl of smoke; embers flung off it, out and up; now and then
    // one settling on the floor to glow a while
    static lick(S, x, y, a, at) {
        const C = Scythe.CFG, r = at ?? (C.BLADE - 2 + Math.random() * (C.TIP - C.BLADE + 5)) * Scythe.scale(), px = x + Math.cos(a) * r, py = y + Math.sin(a) * r;
        const f = S.add.sprite(px, py + 8, 'ember_scythe', 'lick_0').setOrigin(0.5, 1).setScale(1.5 + Math.random() * 0.9).setDepth(3.05);
        f.play({ key: 'scy_lick', frameRate: 8 + Math.random() * 4 });
        S.tweens.add({ targets: f, x: px + Math.cos(a) * (2 + Math.random() * 6), y: f.y - 3 - Math.random() * 6, duration: 900, ease: 'Sine.easeOut' });
        f.once('animationcomplete', () => {
            if (Math.random() < 0.45) {
                const sm = S.add.image(f.x, f.y - 10, 'fx_smoke').setTint(0x3a2a26).setScale(0.12 + Math.random() * 0.06).setAlpha(0.45).setDepth(3.06);
                S.tweens.add({ targets: sm, y: sm.y - 18 - Math.random() * 12, x: sm.x + (Math.random() - 0.5) * 10, scale: sm.scale * 2.2, alpha: 0, duration: 700 + Math.random() * 400, ease: 'Sine.easeOut', onComplete: () => sm.destroy() });
            }
            S.tweens.add({ targets: f, alpha: 0, duration: 200, onComplete: () => f.destroy() });
        });
        if (Math.random() < 0.7) { const side = a + Math.PI / 2, v = 40 + Math.random() * 70, u = (Math.random() - 0.3) * 50; Scythe.spark(S, px, py, Math.cos(a) * v + Math.cos(side) * u, Math.sin(a) * v + Math.sin(side) * u - 30, 450 + Math.random() * 600); }
        if (Math.random() < 0.2) {   // a coal on the floor
            const c = S.add.sprite(px + (Math.random() - 0.5) * 10, py + 4 + (Math.random() - 0.5) * 8, 'ember_scythe', Math.random() < 0.5 ? 'spark_2' : 'spark_3').setScale(1.4).setDepth(0.62);
            S.tweens.add({ targets: c, alpha: 0.35, duration: 180 + Math.random() * 160, yoyo: true, repeat: 3 + Math.floor(Math.random() * 4), onComplete: () => S.tweens.add({ targets: c, alpha: 0, duration: 300, onComplete: () => c.destroy() }) });
        }
    }
    // A flare at (x, y): a flash of light r across and n embers flung out all round
    static burst(S, x, y, n, r) {
        S._vfxFlash?.(x, y, r, 0xffa040, 220, 0.9);
        for (let i = 0; i < n; i++) { const a = i / n * Math.PI * 2 + Math.random() * 0.4, v = 80 + Math.random() * 90; Scythe.spark(S, x, y, Math.cos(a) * v, Math.sin(a) * v - 20, 350 + Math.random() * 350); }
    }
    // The swing's end: a ring of fire blasting out from you to its reach (r px), flames catching all round it where it
    // stops, embers thrown on out
    static blast(S, x, y, r) {
        Scythe.ringFire(S, x, y, r * 0.3, r, 260, 26);
        S.cameras.main.shake(90, 0.004);
        for (let i = 0; i < 18; i++) S.time.delayedCall(40 + Math.random() * 220, () => { const a = Math.random() * Math.PI * 2; Scythe.lick(S, x, y, a, r * (0.7 + Math.random() * 0.4)); });
        for (let i = 0; i < 14; i++) { const a = Math.random() * Math.PI * 2, v = 90 + Math.random() * 110; Scythe.spark(S, x + Math.cos(a) * r * 0.8, y + Math.sin(a) * r * 0.8, Math.cos(a) * v, Math.sin(a) * v - 20, 400 + Math.random() * 400); }
    }
    // An ember flung from (x, y) at (vx, vy) px a second: the hand-drawn spark cooling from white-hot to a red speck over ms,
    // rising a little and wavering as it goes
    static spark(S, x, y, vx, vy, ms, depth = 3.25) {
        const p = S.add.sprite(x, y, 'ember_scythe', 'spark_0').setScale(1.3 + Math.random() * 0.8).setDepth(depth);
        p.play({ key: 'scy_spark', frameRate: 4000 / ms });
        S.tweens.add({ targets: p, x: x + vx * ms / 1000 + (Math.random() - 0.5) * 16, y: y + vy * ms / 1000 - 12, duration: ms, ease: 'Quad.easeOut', onComplete: () => p.destroy() });
        S.tweens.add({ targets: p, alpha: 0, duration: ms * 0.3, delay: ms * 0.7 });
    }

    // ── the swing ──
    static attack(S, targetX, targetY) {
        const C = Scythe.CFG, st = Scythe.st(S), now = S.time.now, ADD = Phaser.BlendModes.ADD;
        if (now - st.spinAt < C.CD) return;
        st.spinAt = now; S._gearFiredAt = now;   // (Creatures.gear: and its sound)
        const cam = S.cameras.main, aim = Math.atan2(targetY + cam.scrollY - S._shotY(), targetX + cam.scrollX - S._shotX());
        const spr = S.add.image(S._shotX(), S._shotY(), 'ember_scythe', 'spin_e').setScale(Scythe.scale()).setDepth(3.2);
        const cut = new Set();
        let lickAt = 0, turns = 0, was = null;
        S._scytheSpinUntil = now + Scythe.spinMs() + 120;   // (the scythe in your hand is the one spinning)
        Scythe.burst(S, S._shotX(), S._shotY(), 10, 70);   // it catches as it starts
        S.tweens.addCounter({ from: 0, to: Scythe.spins(), duration: Scythe.spinMs(), ease: 'Linear',
            onUpdate: tw => {
                const v = tw.getValue(), a = aim + v * Math.PI * 2, [f, fl] = Scythe.frameAt(a), x = S._shotX(), y = S._shotY(), t = S.time.now;
                spr.setPosition(x, y).setFrame('spin_' + f).setFlip(fl, fl);
                Scythe.burn(S, was ?? a, a, x, y); was = a;
                if (t - lickAt > 45) { lickAt = t; Scythe.lick(S, x, y, a); }
                // each turn's cut, halfway round it
                while (turns < Scythe.spins() && v >= turns + 0.5) { turns++; Scythe.cutAll(S, cut, turns); }
            },
            onComplete: () => {
                for (let i = 0; i <= Scythe.perk('embers'); i++) Scythe.ember(S);   // (Wildfire: more a swing)
                Scythe.blast(S, S._shotX(), S._shotY(), Scythe.reach() * S.TILE_SIZE);
                S.tweens.add({ targets: spr, alpha: 0, duration: 140, delay: 60, onComplete: () => spr.destroy() });
                Scythe.slide(S);
            } });
    }

    // One turn's cut: everything within reach, once a turn (a hit and a Burn stack); the first turn to reach an enemy shakes a soul out of it
    static cutAll(S, cut, turn) {
        const C = Scythe.CFG, T = S.TILE_SIZE, dmg = C.DMG * (S.damageScaling || 1), reach = Scythe.reach(), R = Math.ceil(reach);
        S.cameras.main.shake(50, 0.003);
        if (turn > 1) Sfx.play(S, 'w_ember_scythe', { soft: true });
        for (const e of [...(S.enemies || [])]) {
            if (!e.sprite?.active || e.health <= 0 || S._phasedOut?.(e)) continue;
            if (Math.hypot(e.x - S.playerX, e.y - S.playerY) > reach || !S.isInCurrentRoom(e.x, e.y)) continue;
            S.damageEnemy(e, dmg, 'fire');
            S.applyBurnStack?.(e);
            if (e.sprite?.active) {   // sparks sprayed off it the way the blade went through
                S._vfxFlash?.(e.sprite.x, e.sprite.y - 6, 26, 0xff8a2a, 160, 0.7);
                const way = Math.atan2(e.y - S.playerY, e.x - S.playerX) + Math.PI / 2;
                for (let i = 0; i < 3; i++) { const v = 70 + Math.random() * 90, a = way + (Math.random() - 0.5) * 0.9; Scythe.spark(S, e.sprite.x, e.sprite.y - 6, Math.cos(a) * v, Math.sin(a) * v - 20, 300 + Math.random() * 300); }
            }
            if (!cut.has(e)) { cut.add(e); for (let i = 0; i <= Scythe.perk('souls'); i++) Scythe.drop(S, e.sprite.x, e.sprite.y); }   // (Soul Harvest: two)
        }
        // a boss, once a turn whichever of its tiles it's on; a portal too
        let boss = false;
        for (let dx = -R; dx <= R && !boss; dx++) for (let dy = -R; dy <= R && !boss; dy++) {
            const x = S.playerX + dx, y = S.playerY + dy;
            if (Math.hypot(dx, dy) > reach || S.world[x]?.[y] !== S.FLOOR) continue;
            if (S.damageBossAtTile?.(x, y, dmg)) { boss = true; S.applyBurnStackBoss?.(); if (turn === 1) for (let i = 0; i <= Scythe.perk('souls'); i++) Scythe.drop(S, x * T + T / 2, y * T + T / 2); }
        }
        for (let dx = -R; dx <= R; dx++) for (let dy = -R; dy <= R; dy++) {
            if (Math.hypot(dx, dy) > reach) continue;
            const x = S.playerX + dx, y = S.playerY + dy, p = S.getPortalAt?.(x, y);
            if (p) S.damagePortal(p, dmg);
            S._evaporate?.(x, y, C.DRY);   // the swing dries the water it sweeps (to fog)
        }
    }

    // After an attack, if you're moving (a movement key held): SLIDE tiles toward the crosshair, as a dash goes (to the
    // nearest of the eight ways; on a touch screen, or the cursor on you, the way the keys point), stopping short at a
    // wall, a corner or anyone in the way; standing still, no slide
    static slide(S) {
        const C = Scythe.CFG, K = S.keys, T = S.TILE_SIZE;
        if (!K || !S.player?.active || S._deathScreenActive || S._lifting) return;
        let dx = (K.D?.isDown ? 1 : 0) - (K.A?.isDown ? 1 : 0), dy = (K.S?.isDown ? 1 : 0) - (K.W?.isDown ? 1 : 0);
        if (!dx && !dy) return;
        const ap = S._aim?.(S.input.activePointer), cam = S.cameras.main;
        const mx = ap ? ap.x + cam.scrollX - (S.playerX * T + T / 2) : 0, my = ap ? ap.y + cam.scrollY - (S.playerY * T + T / 2) : 0;
        if (!S.isMobile && Math.abs(mx) + Math.abs(my) > 4) { const a = Math.round(Math.atan2(my, mx) / (Math.PI / 4)) * (Math.PI / 4); dx = Math.round(Math.cos(a)); dy = Math.round(Math.sin(a)); }
        const open = (x, y) => S.world[x]?.[y] === S.FLOOR && !S.getEnemyAt(x, y);
        let x = S.playerX, y = S.playerY;
        for (let k = 0; k < C.SLIDE + Scythe.perk('slide'); k++) {   // (Long Slide: further)
            if (!open(x + dx, y + dy) || (dx && dy && (!open(x + dx, y) || !open(x, y + dy)))) break;
            x += dx; y += dy;
        }
        if (x === S.playerX && y === S.playerY) return;
        const fx = S.player.x, fy = S.player.y;
        const ms = Math.max(Math.abs(x - S.playerX), Math.abs(y - S.playerY)) * C.SLIDE_MS;
        S.playerX = x; S.playerY = y; S._step = null; S._glideUntil = S.time.now + ms;
        // a glide you can see, eased in and out like ice's dash, a little quicker (ElementSystem._updateGlide drives it)
        S.tweens.killTweensOf(S.player);
        S._glide = { x0: fx, y0: fy, x1: x * T + T / 2, y1: y * T + T / 2 + (S.SLIME_Y_OFFSET || 0), t0: S.time.now, dur: ms, ice: true };
        Sfx.play(S, 'dash');
        S._scyShield?.glow?.destroy();   // (a fresh shield, not a second: the old one's glow went with it, or it stayed on the floor)
        S._scyShield = { hp: C.SHIELD * (S.maxHealth || 100), max: C.SHIELD * (S.maxHealth || 100), until: S.time.now + C.SHIELD_MS };
        S.showStatusText?.(S.player.x, S.player.y - 30, `+${Math.round(S._scyShield.hp)} SHIELD`, '#ffc060');
        for (let i = 0; i < 8; i++)   // a streak of embers where you slid from
            Scythe.spark(S, fx + (x * T + T / 2 - fx) * i / 8, fy + (y * T + T / 2 + (S.SLIME_Y_OFFSET || 0) - fy) * i / 8 + 10, (Math.random() - 0.5) * 30, -20 - Math.random() * 30, 350 + Math.random() * 300, 2.9);
    }

    // A hit on you: the slide's shield takes what it can of it first (CombatSystem.takeDamage); what's left
    static absorb(S, amount) {
        const sh = S._scyShield;
        if (!sh || S.time.now >= sh.until || sh.hp <= 0 || !(amount > 0)) return amount;
        const took = Math.min(sh.hp, amount);
        sh.hp -= took;
        S._vfxFlash?.(S.player.x, S.player.y, 34, 0xffa040, 160, 0.7);
        if (sh.hp <= 0) { S.showStatusText?.(S.player.x, S.player.y - 30, 'SHIELD BROKEN', '#ff9a6a'); Sfx.play(S, 'shatter'); }
        return amount - took;
    }

    // A tile set alight: `at` (the Heat Wave's), or one within reach (not your own, not one already burning); it burns
    // `ms`; the oldest goes out past EMBER_MAX
    static ember(S, at = null, ms = Scythe.CFG.EMBER_MS) {
        const C = Scythe.CFG, st = Scythe.st(S), T = S.TILE_SIZE, reach = Scythe.reach(), R = Math.floor(reach), spots = [];
        if (at) { if (!st.embers.some(m => m.x === at.x && m.y === at.y)) spots.push([at.x, at.y]); }
        else for (let dx = -R; dx <= R; dx++) for (let dy = -R; dy <= R; dy++) {
            const x = S.playerX + dx, y = S.playerY + dy;
            if ((!dx && !dy) || Math.hypot(dx, dy) > reach || S.world[x]?.[y] !== S.FLOOR || !S.isInCurrentRoom(x, y) || st.embers.some(m => m.x === x && m.y === y)) continue;
            spots.push([x, y]);
        }
        if (!spots.length) return;
        const [x, y] = spots[Math.floor(Math.random() * spots.length)], px = x * T + T / 2, py = y * T + T / 2;
        S._evaporate?.(x, y, C.BOIL);
        const [glow, img] = Scythe.emberArt(S, px, py);
        img.setScale(0); S.tweens.add({ targets: img, scale: 2, duration: 180, ease: 'Back.easeOut' });
        st.embers.push({ x, y, img, glow, until: S.time.now + ms, tickAt: S.time.now + 1000 });
        while (st.embers.length > C.EMBER_MAX * (1 + Scythe.perk('embers'))) Scythe.out(S, st.embers.shift());
        Sfx.play(S, 'ignite');
    }
    // An ember's look on the tile at (px, py): its flame burning (scy_flame, scale 2) over a glow of heat. [glow, flame]
    static emberArt(S, px, py) {
        Scythe.st(S);   // (its animations)
        const glow = S.add.image(px, py, 'vfx_glow').setTint(0xff6a1a).setBlendMode(Phaser.BlendModes.ADD).setScale(0.32).setAlpha(0.5).setDepth(0.56);
        S.tweens.add({ targets: glow, alpha: 0.32, scale: 0.28, duration: 260, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
        const img = S.add.sprite(px, py - 2, 'ember_scythe', 'flame_0').setScale(2).setDepth(0.6).play('scy_flame');
        img.anims.setProgress(Math.random());
        return [glow, img];
    }
    static out(S, m) {
        S.tweens.killTweensOf([m.img, m.glow]);
        S.tweens.add({ targets: [m.img, m.glow], alpha: 0, duration: 300, onComplete: () => { m.img.destroy(); m.glow.destroy(); } });
    }

    // An ember soul shaken out at (x, y): it hops clear and bobs there till you come near (SOUL_PULL tiles), then flies to you
    static drop(S, x, y) {
        const st = Scythe.st(S), T = S.TILE_SIZE, a = Math.random() * Math.PI * 2, d = T * (0.3 + Math.random() * 0.6);
        const img = S.add.sprite(x, y - 6, 'ember_scythe', 'soul_0').setScale(1.6).setDepth(3.4).play('scy_soul');
        const glow = S.add.image(x, y - 6, 'vfx_glow').setTint(0xff7a2a).setBlendMode(Phaser.BlendModes.ADD).setScale(0.2).setAlpha(0.6).setDepth(3.35);
        const s = { img, glow, x: x + Math.cos(a) * d, y: y + Math.sin(a) * d - 4, born: S.time.now, flying: false };
        S.tweens.add({ targets: [img, glow], x: s.x, duration: 320, ease: 'Quad.easeOut' });
        S.tweens.add({ targets: [img, glow], y: s.y - 14, duration: 160, ease: 'Quad.easeOut', onComplete: () => S.tweens.add({ targets: [img, glow], y: s.y, duration: 160, ease: 'Quad.easeIn' }) });
        st.drops.push(s);
    }

    // Every frame: embers burn and go out, souls bob, fly to you and are taken, and the bar over you while you hold it
    static tick(S, time) {
        const st = S._scy;
        if (!st) { if (S._scyBar) Scythe.bar(S); return; }
        const C = Scythe.CFG, T = S.TILE_SIZE, P = C.EMBER_P + C.EMBER_UP * Scythe.perk('kindling');
        for (let i = st.embers.length - 1; i >= 0; i--) {
            const m = st.embers[i];
            if (time >= m.until) { st.embers.splice(i, 1); Scythe.out(S, m); continue; }
            if (time < m.tickAt) continue;
            m.tickAt += 1000;
            for (const e of S.enemies || []) if (e.sprite?.active && e.health > 0 && Math.abs(e.x - m.x) <= 1 && Math.abs(e.y - m.y) <= 1 && Math.random() < P) {
                S.applySuperBurn?.(e, 1);
                S._vfxFlash?.(e.sprite.x, e.sprite.y - 6, 24, 0xffd060, 180, 0.8);
            }
        }
        const px = S.player?.x ?? 0, py = (S.player?.y ?? 0) + 10;
        for (let i = st.drops.length - 1; i >= 0; i--) {
            const s = st.drops[i], age = time - s.born;
            if (!s.img.active) { st.drops.splice(i, 1); continue; }
            if (s.flying) continue;
            if (age > 450 && Math.hypot(px - s.img.x, py - s.img.y) < C.SOUL_PULL * T && S.player?.active) {   // (it's landed: near enough, it comes)
                s.flying = true; S.tweens.killTweensOf([s.img, s.glow]);
                S.tweens.add({ targets: [s.img, s.glow], x: px, y: py - 8, scale: 0.6, duration: 170, ease: 'Quad.easeIn', onComplete: () => {
                    s.img.destroy(); s.glow.destroy(); st.drops.splice(st.drops.indexOf(s), 1);
                    const was = st.souls; st.souls = Math.min(C.SOUL_MAX, st.souls + 1);
                    Sfx.play(S, 'pickup', { soft: true });
                    S._vfxFlash?.(S.player.x, S.player.y, 22, 0xff9a3a, 140, 0.6);
                    if (was < C.SOUL_COST && st.souls >= C.SOUL_COST && Scythe.held(S)) Sfx.play(S, 'rready', { el: 'fire' });
                } });
                continue;
            }
            if (age > C.SOUL_MS) { s.flying = true; S.tweens.killTweensOf([s.img, s.glow]); S.tweens.add({ targets: [s.img, s.glow], alpha: 0, y: s.img.y - 10, duration: 400, onComplete: () => { s.img.destroy(); s.glow.destroy(); } }); continue; }
            if (age > 330) { const b = Math.sin((time + s.born) * 0.006) * 2; s.img.y = s.y + b; s.glow.y = s.y + b; s.img.setAlpha(age > C.SOUL_MS - 2000 && Math.floor(time / 120) % 2 ? 0.4 : 1); }
        }
        // the slide's shield: a glow of heat round you, dimmer as it's worn down, flickering out as its time runs short
        const sh = S._scyShield;
        if (sh && (time >= sh.until || sh.hp <= 0 || !S.player?.active)) { S._scyShield = null; sh.glow?.destroy(); }
        else if (sh) {
            sh.glow ||= S.add.image(S.player.x, S.player.y, 'vfx_glow').setTint(0xff8a2a).setBlendMode(Phaser.BlendModes.ADD).setDepth(2.95);
            const left = sh.until - time, blink = left < 700 && Math.floor(time / 90) % 2;
            sh.glow.setPosition(S.player.x, S.player.y + 6).setScale(0.55 + 0.04 * Math.sin(time * 0.012)).setAlpha(blink ? 0.12 : 0.2 + 0.35 * sh.hp / sh.max);
        }
        Scythe.bar(S);
    }
    // the souls you carry over you (the bar fills to one Heat Wave; the count beside it), only while the scythe's out
    static bar(S) {
        const st = S._scy, B = S._scyBar;
        if (!st || !Scythe.held(S) || !S.player?.active) {
            if (B) { B.g.destroy(); B.label.destroy(); S._scyBar = null; }
            return;
        }
        const top = CreatureFX.gearTop?.(S), C = Scythe.CFG, px = S.player.x, py = Math.min(S.player.y - 18, top != null ? top - 13 : Infinity), ready = st.souls >= C.SOUL_COST;   // (clear of the scythe in your hand)
        const b = S._scyBar ||= { g: S.add.graphics().setDepth(5.6), label: S.add.text(px, py + 7, '', { fontSize: '8px', fontFamily: UIKit.FONT.title, fontStyle: 'bold', color: '#ff8844', stroke: '#1a0806', strokeThickness: 3, resolution: 2 }).setOrigin(0.5, 0).setDepth(5.7) };
        if (!b.g.active) { S._scyBar = null; return; }
        UIKit.rBar(b.g.clear(), px - 20, py - 3, 48, Math.min(1, st.souls / C.SOUL_MAX), { col: 0xff5a14, hot: 0xffc060, dark: 0x1a0806, time: S.time.now, ready, segs: C.SOUL_MAX / C.SOUL_COST });   // (a segment a Heat Wave)
        b.label.setPosition(px, py + 7).setText(`SOULS ${st.souls}/${C.SOUL_MAX}  ·  HEAT WAVE [${Settings.label(Settings.key('surge'))}]`).setColor(ready ? '#ffcc44' : '#ff8844');
    }

    // ── R: the Heat Wave ──
    static wave(S) {
        const C = Scythe.CFG, st = Scythe.st(S), T = S.TILE_SIZE, now = S.time.now, ADD = Phaser.BlendModes.ADD;
        if (st.souls < C.SOUL_COST) { Sfx.play(S, 'deny'); S.showStatusText?.(S.player.x, S.player.y - 34, `${C.SOUL_COST} EMBER SOULS FOR A HEAT WAVE (${st.souls})`, '#ff9a6a'); return; }
        if (now < (st.waveAt || 0)) return;
        st.souls -= C.SOUL_COST; st.waveAt = now + 600;
        S._gearFiredAt = now;
        const cam = S.cameras.main, ox = S.playerX, oy = S.playerY, cx = ox * T + T / 2, cy = oy * T + T / 2;
        // it goes at the nearest enemy (the cursor is the slide's), at the cursor only with no one about
        let near = null, nd = Infinity;
        for (const e of S.enemies || []) {
            if (!e.sprite?.active || e.health <= 0 || S._phasedOut?.(e)) continue;
            const d = (e.x - ox) ** 2 + (e.y - oy) ** 2; if (d < nd) { nd = d; near = e; }
        }
        const aim = near ? Math.atan2(near.y - oy, near.x - ox)
            : Math.atan2((S.pointerY ?? 0) + cam.scrollY - S._shotY(), (S.pointerX ?? 0) + cam.scrollX - S._shotX());
        const dx = Math.cos(aim), dy = Math.sin(aim), range = C.WAVE_RANGE + C.WAVE_UP * Scythe.perk('march');
        // its rows: out along your aim a tile at a time, WAVE_W tiles across; each lane stops at its first wall
        const rows = [], H = (C.WAVE_W - 1) / 2, lanes = Array.from({ length: C.WAVE_W }, (_, i) => ({ o: i - H, open: true }));
        for (let k = 1; k <= range; k++) {
            const row = [];
            for (const L of lanes) {
                if (!L.open) continue;
                const x = Math.round(ox + dx * k - dy * L.o), y = Math.round(oy + dy * k + dx * L.o);
                if (S.world[x]?.[y] !== S.FLOOR) { L.open = false; continue; }
                if (!row.some(t => t.x === x && t.y === y)) row.push({ x, y });
            }
            if (!row.length) break;
            rows.push(row);
        }
        // WAVE_EMBERS tiles along it, picked now, that the first crescent of fire to reach them leaves as embers
        const emberAt = new Set(rows.flat().map(t => t.x + ',' + t.y).sort(() => Math.random() - 0.5).slice(0, C.WAVE_EMBERS));
        // you point it: the scythe out along your aim, its blade lit, for a moment
        const [f, fl] = Scythe.frameAt(aim);
        const pose = S.add.image(S._shotX(), S._shotY(), 'ember_scythe', 'spin_' + f).setScale(Scythe.scale()).setFlip(fl, fl).setDepth(3.2);
        const lit = S.add.image(pose.x, pose.y, 'ember_scythe', 'spin_' + f).setScale(Scythe.scale()).setFlip(fl, fl).setTintFill(0xffb050).setBlendMode(ADD).setDepth(3.21).setAlpha(0.6);
        S._scytheSpinUntil = now + C.WIND + 420;
        lit.setAlpha(0.2); S.tweens.add({ targets: lit, alpha: 0.95, duration: C.WIND, ease: 'Quad.easeIn' });
        const tipX = pose.x + Math.cos(aim) * C.TIP * Scythe.scale() * 0.85, tipY = pose.y + Math.sin(aim) * C.TIP * Scythe.scale() * 0.85;
        for (let i = 0; i < 10; i++) {   // embers drawn in to the blade as it's raised
            const a = Math.random() * Math.PI * 2, d = 40 + Math.random() * 40, m = S.add.sprite(tipX + Math.cos(a) * d, tipY + Math.sin(a) * d, 'ember_scythe', 'spark_1').setScale(1.6).setDepth(3.3);
            S.tweens.add({ targets: m, x: tipX, y: tipY, scale: 0.6, duration: C.WIND * (0.6 + Math.random() * 0.4), ease: 'Quad.easeIn', onComplete: () => m.destroy() });
        }
        S.tweens.add({ targets: [pose, lit], alpha: 0, duration: 200, delay: C.WIND + 220, onComplete: () => { pose.destroy(); lit.destroy(); } });
        Sfx.play(S, 'e_riser');
        S.time.delayedCall(C.WIND, () => { Sfx.play(S, 'magma_surge', { f: 1 }); S.cameras.main.shake(200, 0.009); Scythe.burst(S, tipX, tipY, 12, 90); });
        S.showStatusText?.(S.player.x, S.player.y - 34, 'HEAT WAVE', '#ffcc44');
        if (S.health > 0) {   // and it heals you WAVE_HEAL of your max HP, never past it
            const was = S.health; S.health = Math.min(S.maxHealth, S.health + S.maxHealth * C.WAVE_HEAL);
            const h = Math.round(S.health - was); if (h > 0) { S.showStatusText?.(S.player.x, S.player.y - 48, `+${h} HP`, '#7dff9a'); S.updateHUD?.(); }
        }
        const rowMs = 1000 / C.WAVE_SPEED, reach = rows.length;
        // the crescent: a narrow arc WAVE_W tiles across bowed forward (a slice of a circle CURVE tiles round), its middle
        // on the front as it pulses out along the lane
        const R = C.CURVE * T, half = Math.asin(Math.min(1, (C.WAVE_W / 2) / C.CURVE));
        for (let w = 0; w <= C.FIRE_WAVES; w++) {
            const heat = w === 0, t0 = C.WIND + 40 + w * C.FIRE_GAP, hit = new Set();
            let lickAt = 0;
            const g = S.add.graphics().setDepth(0.63).setBlendMode(ADD);
            const bands = heat ? [[0xfff2c0, 0.85, 0.3], [0xffd060, 0.6, 0.55], [0xff8a2a, 0.35, 0.85]] : [[0xffb050, 0.6, 0.3], [0xff6a1a, 0.45, 0.55], [0xc8300c, 0.28, 0.8]];
            if (reach) S.tweens.addCounter({ from: 0.5, to: reach + 0.5, duration: reach * rowMs, delay: t0, onUpdate: tw => {
                const d = tw.getValue(), fade = 1 - Math.max(0, d - reach * 0.75) / (reach * 0.25 + 0.5), now2 = S.time.now;
                g.clear();
                [[0, 1], [0.6, 0.45], [1.2, 0.22], [1.8, 0.1]].forEach(([back, ghost]) => {   // the crescent and the ghosts it trails
                    if (d - back < 0.3) return;
                    const ccx = cx + dx * ((d - back) * T - R), ccy = cy + dy * ((d - back) * T - R);   // (the circle's middle, behind the front)
                    for (const [col, al, depth] of bands) Scythe.band(g, R - depth * T, R, aim - half, aim + half, col, al * fade * ghost * 0.45, ccx, ccy);
                });
                {   // the fire riding its front
                    const F = Scythe.fire(S), ccx = cx + dx * (d * T - R), ccy = cy + dy * (d * T - R);
                    for (let i = 0; i < (heat ? 7 : 5); i++) { const b = aim + (Math.random() * 2 - 1) * half, R2 = R - Math.random() * T * 0.6; F.flame.emitParticleAt(ccx + Math.cos(b) * R2, ccy + Math.sin(b) * R2, 1); }
                    F.glow.emitParticleAt(ccx + dx * R, ccy + dy * R, 1);
                }
                if (now2 - lickAt > 28) {   // flames catching along its front, sparks flying on ahead of it
                    lickAt = now2;
                    const ccx = cx + dx * (d * T - R), ccy = cy + dy * (d * T - R), a = aim + (Math.random() * 2 - 1) * half * 0.9;
                    Scythe.lick(S, ccx, ccy, a, R - 4);
                    if (heat) Scythe.spark(S, ccx + Math.cos(a) * R, ccy + Math.sin(a) * R, dx * (160 + Math.random() * 80) + (Math.random() - 0.5) * 60, dy * (160 + Math.random() * 80) - 20, 300 + Math.random() * 250);
                }
            }, onComplete: () => {
                g.destroy();
                if (heat) Scythe.burst(S, cx + dx * (reach + 0.5) * T, cy + dy * (reach + 0.5) * T, 14, 80);   // it breaks into embers where it ends
            } });
            else g.destroy();
            // each row of the lane as the crescent reaches it
            rows.forEach((row, k) => S.time.delayedCall(t0 + (k + 0.5) * rowMs, () => {
                if (S._deathScreenActive) return;
                for (const t of row) {
                    const px = t.x * T + T / 2, py = t.y * T + T / 2;
                    S._evaporate?.(t.x, t.y, C.BOIL);
                    if (heat) {   // white-hot air rolling over the tile
                        if (Math.random() < 0.5) Scythe.spark(S, px + (Math.random() - 0.5) * T, py, dx * T * 4, dy * T * 4 - 20, 350 + Math.random() * 200, 3.3);
                    } else {   // the fire: a burst of flame, and the ground left burning
                        S.spawnIgnitionTrail(px, py, C.FIRE_MS, { superBurn: true });   // (a short flare of lava: the embers below keep it going)
                        if (emberAt.delete(t.x + ',' + t.y)) Scythe.ember(S, t, C.WAVE_EMBER_MS);
                        const b = S.add.sprite(px, py - 4, 'ember_scythe', 'flame_0').setScale(2.6).setDepth(3.05).play('scy_flame');
                        S.tweens.add({ targets: b, alpha: 0, y: py - 12, scale: 1.6, duration: 420, delay: 120, onComplete: () => b.destroy() });
                    }
                    for (const e of [...(S.enemies || [])]) {
                        if (e.x !== t.x || e.y !== t.y || hit.has(e) || !e.sprite?.active || e.health <= 0 || S._phasedOut?.(e)) continue;
                        hit.add(e);
                        S.damageEnemy(e, (heat ? C.WAVE_DMG : C.FIRE_DMG) * (S.damageScaling || 1), 'fire');
                        if (e.sprite?.active && e.health > 0) S.applySuperBurn?.(e, 1);
                    }
                    if (!hit.has('boss') && S.damageBossAtTile?.(t.x, t.y, (heat ? C.WAVE_DMG : C.FIRE_DMG) * (S.damageScaling || 1))) { hit.add('boss'); S.applyBurnStackBoss?.(); }
                }
                if (heat && k % 2 === 0) Sfx.play(S, 'sear');
            }));
        }
        Scythe.bar(S);
        S.time.delayedCall(C.WIND + 140, () => Scythe.slide(S));   // (the wave goes from where you stood)
    }
}
