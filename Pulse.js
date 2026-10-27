// ═══════════════════════════════════════════════════════════════════════════
// Pulse.js — the Gauntlet's conductive floor: metal panels set into the floor that zap on a cycle, a trap like any dungeon's.
// Each room has its own: a little of it (a strip, a few corners), a lot (islands of safe floor), or all of it (two halves taking
// turns). A panel glows before it fires, so you can always read it; firing, it zaps whatever stands on it: you (a small hit and a
// moment's daze), and the enemies too, but not the insulated ones (armoured, or made of lightning themselves). For the Gauntlet's
// floors; its rooms are tried out in the Training Ground (ROOMS).
// ═══════════════════════════════════════════════════════════════════════════
class Pulse {
    static CFG = { PERIOD: 2400, WARN: 800, LIVE_MS: 300, LEAD: 1200, DMG: 4, DAZE_MS: 600, EDMG: 20, INSULATED_MS: 2500 };   // ms between zaps (a room can set its own), how long a panel glows first, stays live, the wait before the first; a zap to you (and the daze), to an enemy (times the floor's scaling); how often an insulated one says so
    // which panels fire on zap c, in the field P: all of them; alternate squares, swapping each zap; a row sweeping down it; a column rolling across
    static PATTERNS = {
        all: () => true,
        checker: (x, y, c, P) => (x - P.x0 + y - P.y0 + c) % 2 === 0,
        rows: (x, y, c, P) => (y - P.y0) === c % P.h,
        wave: (x, y, c, P) => (x - P.x0) === c % P.w,
    };
    // panels on the floor of the field P ({ x0, y0, w, h, pattern, period, tiles: (x, y) => conducts? (all of it if not given) })
    static start(S, P) {
        Pulse.stop(S);
        const C = Pulse.CFG, T = S.TILE_SIZE, tex = S.textures.get('pulse_panel');
        if (!tex.has('off')) ['off', 'warn', 'live'].forEach((f, i) => tex.add(f, 0, i * 12, 0, 12, 12));
        const panels = new Map();
        for (let x = P.x0; x < P.x0 + P.w; x++) for (let y = P.y0; y < P.y0 + P.h; y++) if (S.world[x]?.[y] === S.FLOOR && (!P.tiles || P.tiles(x, y)))
            panels.set(y * 4096 + x, { x, y, img: S.add.image(x * T + T / 2, y * T + T / 2, 'pulse_panel', 'off').setScale(T / 12).setDepth(0.55), liveUntil: 0 });
        const period = P.period || C.PERIOD;
        const st = S._pulse = { P, fire: Pulse.PATTERNS[P.pattern || 'all'], period, panels, t0: S.time.now + C.LEAD - period, c: 0, shocks: 0 };
        st.tick = () => Pulse.tick(S); S.events.on('update', st.tick);
        st.off = () => Pulse.stop(S); S.events.once('shutdown', st.off);
        return st;
    }
    // each zap: what's due fires; WARN before the next, what's next glows; a fired panel goes dark once it's spent
    static tick(S) {
        const st = S._pulse, now = S.time.now;
        if (!st || S._pauseMenuOpen) return;
        const t = now - st.t0, c = Math.floor(t / st.period), warn = t - c * st.period >= st.period - Pulse.CFG.WARN;
        if (c > st.c) { st.c = c; Pulse.fire(S, c); }
        for (const p of st.panels.values()) {
            if (p.liveUntil && now < p.liveUntil) continue;
            p.liveUntil = 0;
            const f = warn && st.fire(p.x, p.y, c + 1, st.P) ? 'warn' : 'off';
            if (p.img.frame.name !== f) p.img.setFrame(f);
        }
    }
    static fire(S, c) {
        const st = S._pulse, C = Pulse.CFG, T = S.TILE_SIZE, now = S.time.now, hit = new Set();
        for (const p of st.panels.values()) if (st.fire(p.x, p.y, c, st.P)) {
            p.img.setFrame('live'); p.liveUntil = now + C.LIVE_MS; hit.add(p.y * 4096 + p.x);
            const fl = S.add.rectangle(p.x * T + T / 2, p.y * T + T / 2, T, T, 0x9ff6ff, 0.45).setBlendMode(Phaser.BlendModes.ADD).setDepth(0.56);
            S.tweens.add({ targets: fl, alpha: 0, duration: C.LIVE_MS, onComplete: () => fl.destroy() });
        }
        if (!hit.size) return;
        Sfx.play(S, 'zap');
        if (hit.has(S.playerY * 4096 + S.playerX)) {   // you, on one: a small hit and, unless you've just been dazed, a moment's daze
            st.shocks++; S.takeDamage(C.DMG * (S.enemyDamageScale || 1));
            S.cameras.main.shake(120, 0.006); S.showStatusText?.(S.player.x, S.player.y - 24, 'ZAP!', '#9ff6ff');
            S.player.setTintFill(0xe8ffff); S.time.delayedCall(90, () => S.player?.active && S.player.clearTint());
            if (S._ccGate?.(C.DAZE_MS)) { S._staggerUntil = Math.max(S._staggerUntil || 0, now + C.DAZE_MS); S.showStatusText?.(S.player.x, S.player.y - 40, 'DAZED', '#fff3a8'); }
            st.onShock?.(st.shocks);
        }
        for (const e of S.enemies || []) {   // and them, all but the insulated
            if (!e?.sprite?.active || e.health <= 0 || !hit.has(e.y * 4096 + e.x)) continue;
            if (e._isArmored || e.isElectrical) {
                if (now - (e._insulatedAt || -1e9) > C.INSULATED_MS) { e._insulatedAt = now; S.showStatusText?.(e.sprite.x, e.sprite.y - 20, 'INSULATED', '#cdbf9f'); }
                continue;
            }
            S.damageEnemy(e, C.EDMG * (S.enemyHealthScale || 1), 'lightning');
        }
    }
    static stop(S) {
        const st = S._pulse;
        if (!st) return;
        S.events.off('update', st.tick); S.events.off('shutdown', st.off);
        for (const p of st.panels.values()) p.img.destroy();
        S._pulse = null;
    }
}
