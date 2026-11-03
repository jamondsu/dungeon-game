// ═══════════════════════════════════════════════════════════════════════
// SNIPER.JS — the Sniper: a hooded slime with a brass scope over one eye. It keeps six to ten tiles off you with a line
// to you and fires one heavy slug at a time: its scope glints first (TELL), then the shot. The slug glances off walls up
// to twice, so with no straight line to you it banks one round the cover. After every shot it BLINKS to another tile of
// its own room, six to nine tiles off you (with a line to you if it can, never beside another enemy), and stands there
// re-aiming for a moment and a half: that's when to reach it. Hit while it's aiming, it may blink away without firing,
// but not twice within ESCAPE.
// Static (no proxies): GameScene.update calls Sniper.tick; EnemyManager.createUpgradedSniper makes one (the Fracture, the
// Tower, the Training Ground). The slug is an ordinary enemy shot (EnemyManager._fireRicochetArrow; its bounce in
// updateEnemyProjectiles), so whatever stops, slows or dodges a shot does the same to it.
// Art: slime_m_sniper (its body), fx_sniper (the slug, its spark off a wall, the scope's glint, the blink's puff).
// ═══════════════════════════════════════════════════════════════════════

class Sniper {
    static CFG = {
        HP: 50, MOVE: 1,                       // a little tougher than the Spitter (30), at a slime's pace
        KEEP: [6, 10],                         // tiles off you it walks to hold, with a line to you
        REACH: 12,                             // it fires from up to this far (tiles)
        FIRST: [900, 1600],                    // ms to its first shot once you're in its room
        GAP: 3500,                             // ms at least from one shot to the next
        AIM: 1500,                             // ms it stands re-aiming where it lands (no shot, no blink, no step)
        TELL: 500, LOCK: 120,                  // ms: the glint before a shot; its aim stops following you for the last LOCK of it
        RECOIL: 160,                           // ms from the shot to the blink
        SLUG: { DMG: 20, SPEED: 330, BOUNCES: 2 },          // x enemyDamageScale; px a second; walls it glances off
        BLINK: { NEAR: [6, 9], MS: 250, ESCAPE: 3000 },     // tiles off you it lands; the blink; ms between blinks out of an aim
        BANK: { RAYS: 180, REACH: 24, HIT: 0.6 },           // its bank shots: headings tried, how far one may fly, how near you it must pass (tiles)
    };

    static make(S, x, y, ri) {
        const C = Sniper.CFG, e = S.createEnemy(x, y, C.HP);
        e.tutorialRoomIndex = ri; e._upgradedSniper = true; e._moveCdMult = C.MOVE;
        e._sn = { st: 'walk', next: S.time.now + C.FIRST[0] + Math.random() * (C.FIRST[1] - C.FIRST[0]), shotAt: -1e9, escAt: -1e9 };
        SlimeModels.wear(S, e.sprite, 'sniper');
        Sniper.anims(S);
        return e;
    }
    static anims(S) {
        if (!S.textures.exists('fx_sniper')) return;
        const A = S.anims, mk = (key, names, frameRate) => { if (!A.exists(key)) A.create({ key, frames: names.map(frame => ({ key: 'fx_sniper', frame })), frameRate }); };
        mk('sn_puff', ['puff_0', 'puff_1', 'puff_2', 'puff_3'], 16);
        mk('sn_spark', ['spark_0', 'spark_1', 'spark_2'], 20);
    }

    static tick(S, now) {
        if (!S.enemies?.length || S._devFreezeEnemies) return;
        for (const e of S.enemies) if (e._sn && e.sprite?.active && e.health > 0) {
            const t = S._tauntBegin?.(e);   // pulled by an ally: it keeps off it and shoots at it (CombatSystem._tauntBegin)
            try { Sniper._one(S, e, now); } finally { S._tauntEnd?.(t); }
        }
    }
    static _one(S, e, now) {
        const C = Sniper.CFG, b = e._sn;
        if (S._roomGated?.() && e.tutorialRoomIndex !== S.getCurrentPlayerRoom()) { b.next = Math.max(b.next, now + C.FIRST[0]); return; }   // not your room: it waits
        if (e.isFrozen || e.isStunned || e._iceCube || (e.stunnedUntil || 0) > now) {   // dazed or frozen: the aim goes out of it
            if (b.st === 'tell') Sniper._calm(e);
            b.next = Math.max(b.next, now + 400);
            return;
        }
        if (b.st === 'aim') { if (now < b.until) return; b.st = 'walk'; e._moveCdMult = C.MOVE; }
        if (b.st === 'recoil') { if (now >= b.until) Sniper.blink(S, e, now); return; }
        if (b.st === 'tell') {
            const s = e.sprite;
            b.g?.setPosition(...Sniper.scope(s, b.west));
            if ((e.health < b.hp || (e._vfxHitAt || 0) > b.t0) && now - b.escAt >= C.BLINK.ESCAPE) {   // hit mid-aim: off before it fires
                b.escAt = now; Sniper._calm(e); Sniper.blink(S, e, now);
                return;
            }
            if (!b.locked && now >= b.until - C.LOCK) { b.locked = true; b.a = Sniper.aim(S, e) ?? b.a; }   // where you are now (or, gone behind cover, where you were)
            if (now >= b.until) Sniper.fire(S, e, now);
            return;
        }
        const d = Math.hypot(e.x - S.playerX, e.y - S.playerY);
        Sniper._keep(S, e, now, d);
        if (now < b.next || d > C.REACH || !S.player?.active || S._deathScreenActive) return;
        const a = Sniper.aim(S, e);
        if (a == null) { b.next = now + 300; return; }   // no way to reach you, straight or banked: it looks again in a moment
        Sniper._tell(S, e, now, a);
    }
    // Where it wants to stand (moveEnemies walks it there): KEEP tiles off you, a line to you, in its room, not far from where it is
    static _keep(S, e, now, d) {
        if (now - (e._keepAt || 0) < 450) return;
        e._keepAt = now;
        const [lo, hi] = Sniper.CFG.KEEP, room = Blinder.room(S, e), PX = S.playerX, PY = S.playerY;
        let best = [e.x, e.y], top = -Infinity;
        for (let dx = -4; dx <= 4; dx++) for (let dy = -4; dy <= 4; dy++) {
            const x = e.x + dx, y = e.y + dy, here = !dx && !dy;
            if (S.world[x]?.[y] !== S.FLOOR || (!here && S.getEnemyAt(x, y)) || (x === PX && y === PY) || (room && Blinder._out(S, room, x, y))) continue;
            const r = Math.hypot(x - PX, y - PY), off = r < lo ? (lo - r) * 3 : Math.max(0, r - hi);
            const score = -off * 2 + (S._hasLineOfSight(x, y, PX, PY) ? 3 : 0) - Math.hypot(dx, dy) * 0.15 + (here ? 0.4 : 0);
            if (score > top) { top = score; best = [x, y]; }
        }
        if (best[0] !== e._goalX || best[1] !== e._goalY) { e._goalX = best[0]; e._goalY = best[1]; e._committedPath = null; }   // (a goal of its own: it never walks into you)
    }

    // THE SHOT. It plants itself, its scope glints (fx_sniper glint_*) for TELL, then one slug
    static _tell(S, e, now, a) {
        const C = Sniper.CFG, b = e._sn, s = e.sprite, west = S.player.x < s.x;
        Object.assign(b, { st: 'tell', until: now + C.TELL, t0: now, hp: e.health, a, locked: false, west });
        e._moveCdMult = 999; e._goalX = e._goalY = null; e._committedPath = null;
        s._atkTw?.stop(); EnemyManager.playAtk(S, s, C.TELL, west, 'atk_');
        Sfx.play(S, 'tell', { ms: C.TELL });
        if (!S.textures.exists('fx_sniper')) return;
        const fr = ['glint_0', 'glint_1', 'glint_2', 'glint_1', 'glint_2', 'glint_2'], g = b.g = S.add.sprite(...Sniper.scope(s, west), 'fx_sniper', fr[0]).setScale(Math.abs(s.scaleY)).setDepth(3.4);
        S._vfxSort?.(g);
        S.tweens.addCounter({ from: 0, to: fr.length - 0.01, duration: C.TELL, onUpdate: t => { if (g.active) g.setFrame(fr[Math.floor(t.getValue())]); }, onComplete: () => g.destroy() });
    }
    static fire(S, e, now) {
        const C = Sniper.CFG, b = e._sn, s = e.sprite;
        b.g?.destroy(); b.g = null;
        S._fireRicochetArrow(e, b.a);
        Object.assign(b, { st: 'recoil', until: now + C.RECOIL, shotAt: now });
        s._atkTw?.stop(); EnemyManager.playAtk(S, s, C.RECOIL + 120, Math.cos(b.a) < 0, 'fire_');
    }
    static _calm(e) {
        const b = e._sn;
        b.g?.destroy(); b.g = null; b.st = 'walk';
        e.sprite?._atkTw?.stop(); e._moveCdMult = Sniper.CFG.MOVE; e._keepAt = 0;
    }
    // Its scope in the world (frame pixel 20.5, 27.5 of its body, facing east) and where its slug leaves from (its middle)
    static scope(s, west) { const k = Math.abs(s.scaleY); return [s.x + (west ? -4.5 : 4.5) * k, s.y + 11.5 * k]; }
    static muzzle(s) { return [s.x, s.y + 10 * Math.abs(s.scaleY)]; }

    // A heading for its slug that reaches you: straight at you if nothing's in the way, else the shortest bank (off up to
    // SLUG.BOUNCES walls) of BANK.RAYS tried; null if none does
    static aim(S, e) {
        const C = Sniper.CFG, T = S.TILE_SIZE, [x, y] = Sniper.muzzle(e.sprite), px = S.playerX * T + T / 2, py = S.playerY * T + T / 2;
        const direct = Math.atan2(py - y, px - x);
        if (Sniper.trace(S, x, y, direct, 0, px, py) != null) return direct;
        let best = null, len = Infinity;
        for (let i = 0; i < C.BANK.RAYS; i++) {
            const a = i / C.BANK.RAYS * Math.PI * 2, L = Sniper.trace(S, x, y, a, C.SLUG.BOUNCES, px, py);
            if (L != null && L < len) { len = L; best = a; }
        }
        return best;
    }
    // A slug's flight from (x, y) heading a, glancing off walls as updateEnemyProjectiles has it (up to `bounces`), for
    // BANK.REACH tiles: how far it had flown when it passed within BANK.HIT of (px, py), or null if it never did
    static trace(S, x, y, a, bounces, px, py) {
        const C = Sniper.CFG, T = S.TILE_SIZE, st = T / 4, R = C.BANK.HIT * T;
        let vx = Math.cos(a) * st, vy = Math.sin(a) * st;
        for (let L = 0; L < C.BANK.REACH * T; L += st) {
            x += vx; y += vy;
            const tx = Math.floor(x / T), ty = Math.floor(y / T);
            if (Sniper.solid(S, tx, ty)) {
                if (bounces-- <= 0) return null;
                x -= vx; y -= vy;
                const hx = Sniper.solid(S, tx, Math.floor(y / T)), hy = Sniper.solid(S, Math.floor(x / T), ty);
                if (hx || !hy) vx = -vx;
                if (hy || !hx) vy = -vy;
                continue;
            }
            if (Math.hypot(x - px, y - py) < R) return L;
        }
        return null;
    }
    // what stops a shot (updateEnemyProjectiles): off the world, wall, the void, a sealed room
    static solid(S, tx, ty) { const t = S.world[tx]?.[ty]; return t === undefined || t === S.WALL || t === S.NOTHING || !!S.isInLockedRoom?.(tx, ty); }

    // THE BLINK, after every shot: an afterimage and a puff where it stood, a puff where it lands (a tile of its own room
    // NEAR tiles off you, from spot), fading in there; then it stands re-aiming for AIM
    static blink(S, e, now) {
        const C = Sniper.CFG, b = e._sn, s = e.sprite, T = S.TILE_SIZE, to = Sniper.spot(S, e), k = Math.abs(s.scaleY);
        Object.assign(b, { st: 'aim', until: now + C.BLINK.MS + C.AIM });
        b.next = Math.max(b.shotAt + C.GAP, b.until);
        e._moveCdMult = 999; e._goalX = e._goalY = null; e._committedPath = null; e.lastMoveTime = now;
        if (!to) return;   // nowhere to go: it aims again where it is
        const ghost = S.add.image(s.x, s.y, s.texture.key, s.frame.name).setOrigin(s.originX, s.originY).setScale(s.scaleX, s.scaleY)
            .setFlipX(s.flipX).setDepth(s.depth).setTint(0xb48cff).setAlpha(0.75);
        S._vfxSort?.(ghost);
        S.tweens.add({ targets: ghost, alpha: 0, y: ghost.y - 6, duration: C.BLINK.MS * 1.6, ease: 'Quad.easeOut', onComplete: () => ghost.destroy() });
        Sniper.puff(S, s.x, s.y + 8 * k);
        S.tweens.killTweensOf(s);
        e.x = to[0]; e.y = to[1];
        s.setPosition(to[0] * T + T / 2, to[1] * T + T / 2 + (S.SLIME_Y_OFFSET || 0)).setAlpha(0);
        S.tweens.add({ targets: s, alpha: 1, duration: C.BLINK.MS, delay: 60 });
        Sniper.puff(S, s.x, s.y + 8 * k);
        Sfx.play(S, 'whoosh');
    }
    // Where it blinks to: open floor it could walk to inside its room (never past a doorway or into a sealed room), NEAR
    // tiles off you if it can, best with a line to you, never next to another enemy, and a few tiles from where it stands
    static spot(S, e) {
        const [lo, hi] = Sniper.CFG.BLINK.NEAR, room = Blinder.room(S, e), PX = S.playerX, PY = S.playerY;
        const others = S.enemies.filter(o => o !== e && o.sprite?.active && o.health > 0);
        const seen = new Set([e.x + ',' + e.y]), q = [[e.x, e.y, 0]];
        let best = null, top = -Infinity;
        for (let i = 0; i < q.length; i++) {
            const [x, y, n] = q[i], r = Math.hypot(x - PX, y - PY);
            if (n > 0 && r >= 3 && !others.some(o => Math.abs(o.x - x) <= 1 && Math.abs(o.y - y) <= 1)) {
                const inside = r >= lo && r <= hi;
                const score = (inside ? 6 : -Math.abs(r - (lo + hi) / 2)) + (inside && S._hasLineOfSight(x, y, PX, PY) ? 3 : 0)
                    + (Math.hypot(x - e.x, y - e.y) >= 3 ? 1 : 0) + Math.random() * 1.5;
                if (score > top) { top = score; best = [x, y]; }
            }
            if (n >= 40) continue;
            for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
                const nx = x + dx, ny = y + dy, key = nx + ',' + ny;
                if (seen.has(key) || S.world[nx]?.[ny] !== S.FLOOR || S.isInLockedRoom?.(nx, ny) || (room && Blinder._out(S, room, nx, ny))) continue;
                seen.add(key); q.push([nx, ny, n + 1]);
            }
        }
        return best;
    }

    // fx_sniper's puff (its blink) and spark (its slug off a wall)
    static puff(S, x, y) {
        if (!S.anims.exists('sn_puff')) return;
        const p = S.add.sprite(x, y, 'fx_sniper', 'puff_0').setScale(1.2).setDepth(3.3).play('sn_puff');
        S._vfxSort?.(p); p.once('animationcomplete', () => p.destroy());
    }
    static spark(S, x, y) {
        Sfx.play(S, 'clink');
        if (!S.anims.exists('sn_spark')) return;
        const p = S.add.sprite(x, y, 'fx_sniper', 'spark_0').setScale(1.2).setDepth(3.3).play('sn_spark');
        S._vfxSort?.(p); p.once('animationcomplete', () => p.destroy());
    }
}
