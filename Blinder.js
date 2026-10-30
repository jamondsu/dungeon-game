// ═══════════════════════════════════════════════════════════════════════
// BLINDER.JS — the Blinder: a slime of murky violet smoke that keeps its distance and, every few seconds, swells up and
// heaves a bank of haze at you. The haze is wide and slow, drifts through whatever stands in its room almost across it (it
// piles up and thins away at the room's edge, never leaving it) and leaves a low mist along its way for a few seconds: it
// denies ground. In either it stings and you're NEARSIGHTED: everything past about two tiles goes dark for a while, and
// for a while after it nothing blinds you again.
// Static (no proxies): GameScene.update calls Blinder.tick; Training.KINDS makes one. The haze is an ordinary enemy shot
// (enemyProjectiles, with thruWalls and its own hitR: EnemyManager.updateEnemyProjectiles), so whatever stops or slows a
// shot does the same to it. Art: assets/art/slime_m_blinder (its body) and fx_blinder (the haze, its wisps, its icon).
// ═══════════════════════════════════════════════════════════════════════

class Blinder {
    static CFG = {
        HP: 35, MOVE: 1,                       // about the Spitter's (30), at its pace
        KEEP: [5, 8], KEEP_MAX: 9,             // it holds 5 to 8 tiles off you; further than KEEP_MAX it closes in like anything
        REACH: 10,                             // it throws from up to this far (tiles)
        FIRST: [1200, 2200], CD: [5000, 6000], TELL: 550,   // ms: its first throw after it wakes, between throws, the swell before one
        HAZE: { SPEED: 2.6, R: 1.75, RANGE: 19, THIN: 3, SCALE: 3.5, AHEAD: 0.9 },   // tiles a second; it has you within R tiles of its middle (drawn 3.5 wide), passing through you; gone after RANGE (thinning over the last THIN) or where it would leave its room (AHEAD tiles in front of its middle)
        TRAIL: { EVERY: 1, MS: 3500, R: 1.15, SCALE: 2.5 },   // the low mist it leaves along its way: one every EVERY tiles, lasting MS, has you within R tiles (drawn 2.5 wide)
        DPS: { PER_S: 3.5, EVERY: 250 },       // in the haze or its mist: PER_S x enemyDamageScale a second, a sting every EVERY ms
        // what it does to your sight: R the light's reach in tiles (half dark at about 2), the rest per what caught you: BLIND ms
        // nearsighted, the dark closing over CLOSE and opening over the last OPEN, then IMMUNE ms when nothing blinds you again
        // its AMBUSH while you're nearsighted: first approach FIRST ms in, then GAP between; it prowls at MOVE (x a slime's step
        // time) RING tiles off you, glints from NEAR tiles for GLINT ms (REGLINT after a FEINT, FEINT of the time, its eyes gone
        // FEINT_MS between), lunges up to REACH tiles in LUNGE_MS to SHORT of where you were, hitting within HIT_R of where it
        // lands for DMG x enemyDamageScale and WINDED ms; then slips AWAY tiles off for BACK_MS. At most MAX lunges a blind spell.
        AMBUSH: { FIRST: 900, GAP: 900, MOVE: 0.25, RING: 3, NEAR: [2.6, 3.2], GLINT: 400, REGLINT: 300, FEINT: 0.3, FEINT_MS: 250,
                  REACH: 3.2, LUNGE_MS: 150, SHORT: 0, HIT_R: 1.6, DMG: 10, WINDED: 3000, AWAY: 4.5, BACK_MS: 600, MAX: 2 },
        SIGHT: { R: 2.7, DARK: 0.97, DEPTH: 4.9,
                 haze: { BLIND: 5000, CLOSE: 300, OPEN: 1000, IMMUNE: 3000 }, mist: { BLIND: 2000, CLOSE: 120, OPEN: 400, IMMUNE: 1500 } },
    };

    static make(S, x, y, ri) {
        const C = Blinder.CFG, e = S.createEnemy(x, y, C.HP);
        e.tutorialRoomIndex = ri; e._isBlinder = true; e._moveCdMult = C.MOVE;
        e._bl = { next: S.time.now + C.FIRST[0] + Math.random() * (C.FIRST[1] - C.FIRST[0]), wind: 0, leak: 0 };
        SlimeModels.wear(S, e.sprite, 'blinder');
        Blinder.anims(S);
        return e;
    }
    static anims(S) {
        const A = S.anims, mk = (key, names, frameRate, repeat) => { if (!A.exists(key)) A.create({ key, frames: names.map(frame => ({ key: 'fx_blinder', frame })), frameRate, repeat }); };
        mk('bl_haze', ['haze_0', 'haze_1', 'haze_2', 'haze_3'], 6, -1);
        mk('bl_wisp', ['wisp_0', 'wisp_1', 'wisp_2'], 6, 0);
        mk('bl_mist', ['mist_0', 'mist_1', 'mist_2'], 3, -1);
    }

    // Every frame: your sight, the haze in the air and on the floor, and each Blinder
    static tick(S, now) {
        Blinder.sight(S, now);
        for (const p of S.enemyProjectiles || []) if (p._haze) Blinder._drift(S, p, now);
        Blinder._trail(S, now);
        if (!S.enemies?.length || S._devFreezeEnemies) return;
        for (const e of S.enemies) if (e._isBlinder && e.sprite?.active && e.health > 0) {
            const t = S._tauntBegin?.(e);   // pulled by an ally: it keeps off it and throws at it (CombatSystem._tauntBegin)
            try { Blinder._one(S, e, now); } finally { S._tauntEnd?.(t); }
        }
    }
    static _one(S, e, now) {
        const C = Blinder.CFG, b = e._bl, s = e.sprite;
        if (S._roomGated?.() && e.tutorialRoomIndex !== S.getCurrentPlayerRoom()) { b.next = Math.max(b.next, now + C.FIRST[0]); return; }   // not your room: it waits
        if (e.isFrozen || e.isStunned || e._iceCube || (e.stunnedUntil || 0) > now) {   // dazed or frozen: the swell goes out of it, and any ambush
            if (b.wind) { b.wind = 0; e._moveCdMult = C.MOVE; s._atkTw?.stop(); }
            Blinder._ambushEnd(S, e);
            return;
        }
        const N = S._nsight;
        if (!b.wind && N && now < N.until && S.player?.active) { Blinder._ambush(S, e, now, N); return; }   // you can't see: no more throwing; it comes for you in the dark
        else if (e._amb) { Blinder._ambushEnd(S, e); b.next = Math.max(b.next, now + 1500); }   // your sight's back: off to its range, then throwing again
        if (b.wind) {   // swelling: haze leaking out of it, then the throw
            if (now - b.leak > 90) { b.leak = now; Blinder.wisp(S, s.x + (Math.random() - 0.5) * 22, s.y - 2 - Math.random() * 10, -14); }
            if (now >= b.wind) Blinder.heave(S, e, now);
            return;
        }
        const d = Math.hypot(e.x - S.playerX, e.y - S.playerY);
        Blinder._keep(S, e, now, d);
        if (now < b.next || d > C.REACH || !S.player?.active || S._deathScreenActive) return;
        b.wind = now + C.TELL; b.leak = 0;
        e._moveCdMult = 999;   // it plants itself to swell
        s._atkTw?.stop(); EnemyManager.playAtk(S, s, C.TELL, S.player.x < s.x, 'puff_');
        Sfx.play(S, 'tell', { ms: C.TELL });
    }
    // Where it wants to stand (moveEnemies walks it there): KEEP tiles off you, in its room, not far from where it is
    static _keep(S, e, now, d) {
        if (now - (e._keepAt || 0) < 450) return;
        e._keepAt = now;
        const [lo, hi] = Blinder.CFG.KEEP;
        if (d > Blinder.CFG.KEEP_MAX) { if (e._goalX != null) { e._goalX = e._goalY = null; e._committedPath = null; } return; }
        const room = S._roomGated?.() ? S.rooms?.[e.tutorialRoomIndex] : null;
        let best = null, top = -Infinity;
        for (let dx = -4; dx <= 4; dx++) for (let dy = -4; dy <= 4; dy++) {
            const x = e.x + dx, y = e.y + dy, here = !dx && !dy;
            if (S.world[x]?.[y] !== S.FLOOR || (!here && S.getEnemyAt(x, y)) || (x === S.playerX && y === S.playerY)) continue;
            if (room && (x < room.x || y < room.y || x >= room.x + room.w || y >= room.y + room.h)) continue;
            const r = Math.hypot(x - S.playerX, y - S.playerY), off = r < lo ? (lo - r) * 3 : Math.max(0, r - hi);
            const score = -off * 2 - Math.abs(r - (lo + hi) / 2) * 0.3 - Math.hypot(dx, dy) * 0.15 + (here ? 0.4 : 0);
            if (score > top) { top = score; best = [x, y]; }
        }
        if (best && (best[0] !== e._goalX || best[1] !== e._goalY)) { e._goalX = best[0]; e._goalY = best[1]; e._committedPath = null; }
    }

    // THE AMBUSH. While you're nearsighted it stops throwing and prowls round you in the dark, from any side. At the edge of
    // your light its eyes glint for GLINT ms (the only warning), then it lunges at where you were when they went out: a hit,
    // a shove and WINDED. Walking doesn't get you out of its reach; a dash in time does. Sometimes (FEINT) its eyes go out and
    // it draws back a step, then it comes again, its eyes there more briefly. Hit it while its eyes show and the lunge is off. At most MAX
    // lunges a blind spell; between them, and after, it slips off into the dark.
    static _ambush(S, e, now, N) {
        const A = Blinder.CFG.AMBUSH, s = e.sprite, a = e._amb ||= { st: 'circle', ang: Math.random() * Math.PI * 2, spin: (Math.random() < 0.5 ? -1 : 1) * 0.08, at: now + A.FIRST, goalAt: 0 };
        if (a.st === 'circle' || a.st === 'back') {
            e._moveCdMult = A.MOVE;
            if (now - a.goalAt > 300) { a.goalAt = now; Blinder._ambGoal(S, e, a); }
            if (a.st === 'back') { if (now >= a.at) Object.assign(a, { st: 'circle', ang: Math.random() * Math.PI * 2, at: now + A.GAP, feinted: false }); return; }
            const d = Math.hypot(e.x - S.playerX, e.y - S.playerY);
            if ((N.lunges || 0) < A.MAX && now >= a.at && d >= A.NEAR[0] && d <= A.NEAR[1]) Blinder._glint(S, e, a, now, a.feinted ? A.REGLINT : A.GLINT);
            return;
        }
        if (a.st === 'glint') {
            a.g?.setPosition(s.x + 0.5 * Math.abs(s.scaleX), s.y + 11.5 * Math.abs(s.scaleY));
            if (e.health < a.hp || (e._vfxHitAt || 0) > a.t0) { Blinder._back(a, now); return; }   // hit while its eyes showed: no lunge
            if (now < a.until) return;
            a.g?.destroy(); a.g = null;
            if (!a.feinted && Math.random() < A.FEINT) { Object.assign(a, { st: 'circle', at: now + A.FEINT_MS, feinted: true, goalAt: 0 }); Blinder._step(S, e, -1); return; }   // a feint: back a step, and soon at you again
            Blinder._lunge(S, e, a, now, N);
            return;
        }
        if (a.st === 'lunge' && now >= a.until) Blinder._strike(S, e, a, now);
    }
    // where it prowls to: RING tiles off you, going round you as it comes (or, slipping off, AWAY tiles off the way it is), in its room
    static _ambGoal(S, e, a) {
        const A = Blinder.CFG.AMBUSH, room = Blinder.room(S, e), back = a.st === 'back', r = back ? A.AWAY : A.RING;
        if (!back) a.ang += a.spin;
        const base = back ? Math.atan2(e.y - S.playerY, e.x - S.playerX) : a.ang;
        for (const off of [0, 0.4, -0.4, 0.8, -0.8, 1.3, -1.3, 2, -2, Math.PI]) {
            const x = Math.round(S.playerX + Math.cos(base + off) * r), y = Math.round(S.playerY + Math.sin(base + off) * r);
            if (S.world[x]?.[y] !== S.FLOOR || (x === S.playerX && y === S.playerY) || (room && Blinder._out(S, room, x, y)) || S.enemies.some(o => o !== e && o.sprite?.active && o.x === x && o.y === y)) continue;
            if (x !== e._goalX || y !== e._goalY) { e._goalX = x; e._goalY = y; e._committedPath = null; }
            return;
        }
    }
    // its eyes in the dark (fx_blinder glint_*, over the dark: all of it you see), and it stops dead
    static _glint(S, e, a, now, ms) {
        const s = e.sprite, fr = ['glint_0', 'glint_1', 'glint_2', 'glint_1', 'glint_2'];
        Object.assign(a, { st: 'glint', until: now + ms, hp: e.health, t0: now });
        e._moveCdMult = 999; e._goalX = e._goalY = null; e._committedPath = null;
        const g = a.g = S.add.sprite(s.x + 0.5 * Math.abs(s.scaleX), s.y + 11.5 * Math.abs(s.scaleY), 'fx_blinder', fr[0]).setScale(Math.abs(s.scaleY)).setDepth(Blinder.CFG.SIGHT.DEPTH + 0.06);
        S._vfxSort?.(g);
        S.tweens.addCounter({ from: 0, to: fr.length - 0.01, duration: ms, onUpdate: t => { if (g.active) g.setFrame(fr[Math.floor(t.getValue())]); }, onComplete: () => g.destroy() });
    }
    // a tile toward you (1) or away (-1), if it's open floor in its room
    static _step(S, e, dir) {
        const T = S.TILE_SIZE, room = Blinder.room(S, e), x = e.x + dir * Math.sign(S.playerX - e.x), y = e.y + dir * Math.sign(S.playerY - e.y);
        if (S.world[x]?.[y] !== S.FLOOR || (room && Blinder._out(S, room, x, y)) || S.getEnemyAt(x, y) || (x === S.playerX && y === S.playerY)) return;
        e.x = x; e.y = y;
        S.tweens.add({ targets: e.sprite, x: x * T + T / 2, y: y * T + T / 2 + (S.SLIME_Y_OFFSET || 0), duration: 200, ease: 'Sine.easeOut' });
    }
    // the lunge: up to REACH tiles in LUNGE_MS, at where you were, as far as open floor in its room lets it
    static _lunge(S, e, a, now, N) {
        const A = Blinder.CFG.AMBUSH, T = S.TILE_SIZE, s = e.sprite, room = Blinder.room(S, e);
        const ex = e.x * T + T / 2, ey = e.y * T + T / 2, tx = S.playerX * T + T / 2, ty = S.playerY * T + T / 2;
        const d = Math.hypot(tx - ex, ty - ey) || 1, ux = (tx - ex) / d, uy = (ty - ey) / d, go = Math.min(A.REACH * T, Math.max(0, d - A.SHORT * T));
        let lx = e.x, ly = e.y, f = 0;
        for (let k = 1; k <= 12; k++) {   // walls and its room's edge stop it short; you and the others don't (it ends on the last tile free of them)
            const ff = go * k / 12, x = Math.floor((ex + ux * ff) / T), y = Math.floor((ey + uy * ff) / T);
            if (S.world[x]?.[y] !== S.FLOOR || (room && Blinder._out(S, room, x, y))) break;
            f = ff;
            if ((x !== e.x || y !== e.y) && !S.getEnemyAt(x, y) && !(x === S.playerX && y === S.playerY)) { lx = x; ly = y; }
        }
        e.x = lx; e.y = ly; e.lastMoveTime = now;
        Object.assign(a, { st: 'lunge', until: now + A.LUNGE_MS, land: [ex + ux * f, ey + uy * f], dir: [ux, uy] });
        N.lunges = (N.lunges || 0) + 1;
        S.tweens.killTweensOf(s);
        S.tweens.add({ targets: s, x: a.land[0], y: a.land[1] + (S.SLIME_Y_OFFSET || 0), duration: A.LUNGE_MS, ease: 'Quad.easeIn' });
        s._atkTw?.stop(); EnemyManager.playAtk(S, s, A.LUNGE_MS + 160, ux < 0, 'atk_');
        Sfx.play(S, 'swing', { soft: true });
    }
    // it lands: within HIT_R of you (and you not mid-dash), a hit, a shove a tile on and WINDED; then off into the dark
    static _strike(S, e, a, now) {
        const A = Blinder.CFG.AMBUSH, T = S.TILE_SIZE;
        CombatSystem.tauntBoth(S, () => {   // (the ally it lunged at, and you if you're where it lands)
        const p = S.player, safe = now < (S._dashInvulnUntil || 0) || S.thunderheadActive || S.lightningUltInvuln || S._deathScreenActive;
        if (!safe && p?.active && Math.hypot(S.playerX * T + T / 2 - a.land[0], S.playerY * T + T / 2 - a.land[1]) < A.HIT_R * T) {
            S._hitBy = e; S._hitMelee = true; S.takeDamage(A.DMG * (S.enemyDamageScale || 1)); S._hitBy = null; S._hitMelee = false;
            S.applyWinded?.(A.WINDED);
            const nx = S.playerX + Math.sign(Math.round(a.dir[0] * 1.4)), ny = S.playerY + Math.sign(Math.round(a.dir[1] * 1.4));
            if ((nx !== S.playerX || ny !== S.playerY) && S.world[nx]?.[ny] === S.FLOOR && !S.getEnemyAt?.(nx, ny) && (S._iceShellUntil || 0) <= now) {   // (as the Berserker's shove: not through the ice ult's shell)
                S.playerX = nx; S.playerY = ny; p.x = nx * T + T / 2; p.y = ny * T + T / 2 + (S.SLIME_Y_OFFSET || 0);
            }
            S.cameras.main.shake(80, 0.006);
        }
        });
        S.tweens.add({ targets: e.sprite, x: e.x * T + T / 2, y: e.y * T + T / 2 + (S.SLIME_Y_OFFSET || 0), duration: 120 });   // onto its own tile
        Blinder._back(a, now);
    }
    static _back(a, now) { a.g?.destroy(); a.g = null; a.st = 'back'; a.at = now + Blinder.CFG.AMBUSH.BACK_MS; a.goalAt = 0; }
    static _ambushEnd(S, e) {
        const a = e._amb;
        if (!a) return;
        a.g?.destroy(); e._amb = null;
        e._moveCdMult = Blinder.CFG.MOVE; e._goalX = e._goalY = null; e._committedPath = null; e._keepAt = 0;
    }

    // THE HAZE: out of its front, at where you stand now
    static heave(S, e, now) {
        const C = Blinder.CFG, H = C.HAZE, T = S.TILE_SIZE, b = e._bl, s = e.sprite;
        b.wind = 0; e._moveCdMult = C.MOVE;
        b.next = now + (C.CD[0] + Math.random() * (C.CD[1] - C.CD[0])) / S._atkSpd(e, now);
        const west = S.player.x < s.x, x = s.x + (west ? -10 : 10), y = s.y + 4;
        const a = Math.atan2(S.playerY * T + T / 2 - y, S.playerX * T + T / 2 - x), v = H.SPEED * T;
        const g = S.add.sprite(x, y, 'fx_blinder', 'haze_0').setScale(H.SCALE * 0.5).setDepth(2.6).play('bl_haze');
        S._vfxSort?.(g);
        S.tweens.add({ targets: g, scale: H.SCALE, duration: 260, ease: 'Back.easeOut' });   // billowing out of it
        // hitR 0: the shot step never has it hit you (and go); it passes through you, and _drift does what it does to you
        const room = Blinder.room(S, e);   // it drifts through what stands in its room, never out of it (none: walls stop it, as any shot)
        S.enemyProjectiles.push({ src: e, gfx: g, _bfxKind: 'haze', _haze: true, _room: room, vx: Math.cos(a) * v, vy: Math.sin(a) * v, startX: x, startY: y, maxDist: H.RANGE * T,
            damage: 0, thruWalls: !!room, hitR: 0, onEnd: () => Blinder.thin(S, g) });
        s._atkTw?.stop(); EnemyManager.playAtk(S, s, 420, west, 'throw_');
        Sfx.play(S, 'gale');
    }
    // The room it was thrown in (its own, where rooms are kept apart; else the one it stands in), or null
    static room(S, e) {
        const R = S.rooms || [], has = r => r && e.x >= r.x && e.y >= r.y && e.x < r.x + r.w && e.y < r.y + r.h;
        return (S._roomGated?.() && has(R[e.tutorialRoomIndex]) ? R[e.tutorialRoomIndex] : R.find(has)) || null;
    }
    // Out of the room: past its floor (a doorway, a corridor, the wall round it: rooms are carved as floor, walls laid outside),
    // or the void. `edge`: a wall that's part of what rings the room (it touches outside: the round arena's wall inside its
    // box) counts too; a pillar or a wall standing inside it doesn't.
    static _out(S, room, x, y, edge = false) {
        const out = (x, y) => { const t = S.world[x]?.[y]; return t === undefined || t === S.NOTHING || x < room.x || y < room.y || x >= room.x + room.w || y >= room.y + room.h; };
        if (out(x, y)) return true;
        if (!edge || S.world[x][y] !== S.WALL) return false;
        for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) if (out(x + dx, y + dy)) return true;
        return false;
    }
    // in the air: it thins over its last THIN tiles, wisps trailing off it; it has you while you're in it (and in its room);
    // it lays a low mist on its room's floor every EVERY tiles; and where it would leave its room, it piles up there and thins
    // away (the shot step ends it: Blinder.thin)
    static _drift(S, p, now) {
        const g = p.gfx, H = Blinder.CFG.HAZE, K = Blinder.CFG.TRAIL, T = S.TILE_SIZE, room = p._room;
        if (!g?.active) return;
        const gone = Math.hypot(g.x - p.startX, g.y - p.startY) / T, a = Math.atan2(p.vy, p.vx);
        g.setAlpha(Math.max(0.15, Math.min(1, (H.RANGE - gone) / H.THIN)));
        if (room && p.maxDist && Blinder._out(S, room, Math.floor((g.x + Math.cos(a) * H.AHEAD * T) / T), Math.floor((g.y + Math.sin(a) * H.AHEAD * T) / T), true)) p.maxDist = 0;
        CombatSystem.tauntBoth(S, () => {   // (the ally it was thrown at, and you)
            if (Math.hypot(g.x - (S.playerX * T + T / 2), g.y - (S.playerY * T + T / 2)) < H.R * T && !(room && Blinder._out(S, room, S.playerX, S.playerY))) Blinder.touch(S, 'haze', p.src);
        }, p._ally);
        if (gone - (p._laid ?? -K.EVERY) >= K.EVERY) {
            p._laid = gone;
            const tx = Math.floor(g.x / T), ty = Math.floor(g.y / T);
            if (S.world[tx]?.[ty] === S.FLOOR && !S.isInLockedRoom?.(tx, ty) && !(room && Blinder._out(S, room, tx, ty))) {   // (none in the walls it drifts through, none out of its room)
                const img = S.add.sprite(g.x, g.y + 4, 'fx_blinder', 'mist_0').setScale(K.SCALE).setDepth(0.95).setAlpha(0).play({ key: 'bl_mist', startFrame: Math.floor(Math.random() * 3) });   // (lying on the floor, under everything standing)
                img.setFlipX(Math.random() < 0.5);
                S._vfxSort?.(img);
                (S._blTrail ||= []).push({ x: g.x, y: g.y, t0: now, img, src: p.src, k: g.alpha, room });
            }
        }
        if (now - (p._wispAt || 0) < 160) return;
        p._wispAt = now;
        Blinder.wisp(S, g.x - Math.cos(a) * 18 + (Math.random() - 0.5) * 22, g.y - Math.sin(a) * 18 + (Math.random() - 0.5) * 22, -6, g.alpha);
    }
    // its end (the range run out, a ward, you): it spreads and thins away; the shot's own sprite goes at once, so it doesn't end in a pop of light
    static thin(S, g) {
        const x = g.x, y = g.y, sc = g.scaleX, al = g.alpha, fr = g.frame.name;
        g.destroy();
        const o = S.add.image(x, y, 'fx_blinder', fr).setScale(sc).setAlpha(al).setDepth(2.6);
        S._vfxSort?.(o);
        S.tweens.add({ targets: o, scale: sc * 1.35, alpha: 0, duration: 420, ease: 'Quad.easeOut', onComplete: () => o.destroy() });
        for (let i = 0; i < 5; i++) Blinder.wisp(S, x + (Math.random() - 0.5) * 40, y + (Math.random() - 0.5) * 32, -10, al);
    }
    // the mist it left lying along its way: it settles in, hangs there, thins away; in it, it stings and blinds you, not as long
    static _trail(S, now) {
        const L = S._blTrail;
        if (!L?.length) return;
        const K = Blinder.CFG.TRAIL, T = S.TILE_SIZE, px = S.playerX * T + T / 2, py = S.playerY * T + T / 2;
        for (let i = L.length - 1; i >= 0; i--) {
            const c = L[i], age = now - c.t0;
            if (age >= K.MS || !c.img.scene) { c.img.destroy(); L.splice(i, 1); continue; }   // (gone, or a new level)
            c.img.setAlpha(c.k * Math.min(1, age / 250, (K.MS - age) / 800));
            if (age < K.MS - 500 && Math.hypot(c.x - px, c.y - py) < K.R * T && !(c.room && Blinder._out(S, c.room, S.playerX, S.playerY))) Blinder.touch(S, 'mist', c.src);   // (its last moments too thin to)
        }
    }
    static wisp(S, x, y, rise = -8, a = 1) {
        const w = S.add.sprite(x, y, 'fx_blinder', 'wisp_0').setScale(1.6).setAlpha(0.9 * a).setDepth(2.55).play('bl_wisp');
        S._vfxSort?.(w);
        S.tweens.add({ targets: w, y: y + rise, alpha: 0, duration: 500, onComplete: () => w.destroy() });
    }

    // You're in the haze (`kind` 'haze') or its mist ('mist'): it stings (DPS, one sting every EVERY ms however much of it
    // you're in) and you're NEARSIGHTED, for as long as what caught you says. A dash goes through it. Nothing blinds you again
    // till that one's IMMUNE has run out after it ends, so two can't keep you blind.
    static touch(S, kind, src) {
        const now = S.time.now, C = Blinder.CFG.SIGHT, B = C[kind], D = Blinder.CFG.DPS, p = S.player, N = S._nsight;
        if (!p?.active || S._deathScreenActive) return;
        const cue = (txt, dy) => { if (now - (S._blCueAt || 0) > 900) { S._blCueAt = now; S.showStatusText(p.x, p.y - dy, txt, '#d8c8ff'); } };   // (once in a while: you can stand in it)
        if (now < (S._dashInvulnUntil || 0) || S.thunderheadActive || S.lightningUltInvuln) { cue('THROUGH!', 26); return; }
        const w = S._tauntAlly || S;   // (an ally standing in for you: its own stings, and no blindness)
        if (now >= (w._blStingAt || 0)) {   // (takeDamage's own rules: a dash, a shield, the Rimeguard; its numbers are the game's)
            w._blStingAt = (now - (w._blStingAt || 0) < D.EVERY ? w._blStingAt : now) + D.EVERY;   // (one every EVERY however the frames fall)
            S._hitBy = src?.health > 0 ? src : null; S.takeDamage(D.PER_S * D.EVERY / 1000 * (S.enemyDamageScale || 1)); S._hitBy = null;
        }
        if (w !== S) return;
        if (N && now < N.immune) { if (now >= N.until) cue('IMMUNE', 34); return; }
        S._nsight = { t0: now, ms: B.BLIND, until: now + B.BLIND, immune: now + B.BLIND + B.IMMUNE, close: B.CLOSE, open: B.OPEN, veil: N?.veil };
        S.showStatusText(p.x, p.y - 34, 'NEARSIGHTED', '#b89aff');
        Sfx.play(S, 'hall_vanish', { muffled: true, near: 0.7 });
        S.cameras.main.shake(80, 0.003);
    }
    // The dark round you, the game's own way of drawing light (Visuals._vfxUpdateLight): a sheet of dark over the view, above
    // everything in the world but under the words and the HUD, with light (vfx_light) cut out of it round you, and only you
    // (nothing out there shows, burning or not). It closes in over its CLOSE ms, holds, and opens again over its last OPEN.
    static sight(S, now) {
        const N = S._nsight;
        if (!N || !S.player) return;
        if (N.veil && !N.veil.scene) { S._nsight = null; return; }   // (a new level: it went with the old one)
        if (now >= N.until) { N.veil?.destroy(); N.veil = null; N.r = 0; if (now >= N.immune) S._nsight = null; return; }
        const C = Blinder.CFG.SIGHT, cam = S.cameras.main, T = S.TILE_SIZE, V = S._vfxCfg?.() || {}, LR = S._lightRes || 2, PAD = V.LIGHT_PAD ?? 96;
        const w = Math.ceil((cam.width / cam.zoom + PAD * 2) / LR), h = Math.ceil((cam.height / cam.zoom + PAD * 2) / LR);
        let veil = N.veil;
        if (!veil) {
            veil = N.veil = S.add.renderTexture(0, 0, w, h).setOrigin(0, 0).setScale(LR).setDepth(C.DEPTH);
            veil.texture?.setFilter?.(Phaser.Textures.FilterMode.LINEAR);
            S._vfxSort?.(veil);
        } else if (veil.width !== w || veil.height !== h) veil.resize(w, h);
        const ox = cam.width / 2, oy = cam.height / 2, left = cam.scrollX + ox - ox / cam.zoom - PAD, top = cam.scrollY + oy - oy / cam.zoom - PAD;
        veil.setPosition(left, top);
        const t = now - N.t0, rest = N.until - now, E = Phaser.Math.Easing;
        const k = t < N.close ? E.Cubic.Out(t / N.close) : rest < N.open ? E.Sine.InOut(rest / N.open) : 1;
        const far = Math.hypot(cam.width, cam.height) / cam.zoom;
        N.r = far + (C.R * T - far) * k;
        veil.clear(); veil.fill(V.DARK_COLOR ?? 0x03040a, C.DARK);
        veil.beginDraw();
        const hole = (x, y, r) => { for (let i = 0; i < 2; i++) veil.stamp('vfx_light', null, (x - left) / LR, (y - top) / LR, { scale: r / 64 / LR, alpha: 1, skipBatch: true }); };   // (twice: a clear middle, a short soft edge)
        hole(S.player.x, S.player.y, N.r);
        veil.endDraw(true);
    }
}
