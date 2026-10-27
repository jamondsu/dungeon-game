// ═══════════════════════════════════════════════════════════════════════════
// Pulse.js — the Gauntlet's live floor: metal panels set into the floor that go live on a beat, in patterns (alternate squares
// swapping, a row sweeping down, a column rolling across). A panel glows the beat before it fires, so you can always read
// it; firing, it shocks whatever stands on it: you, and the enemies too (lure them on), but not the insulated ones (armoured,
// or made of lightning themselves). For the Gauntlet's floors; its rooms are tried out in the Training Ground (ROOMS).
// ═══════════════════════════════════════════════════════════════════════════
class Pulse {
    static CFG = { BPM: 96, LIVE_MS: 260, DMG: 6, EDMG: 45, LEAD: 2, INSULATED_MS: 2500 };   // the beat; how long a fired panel stays live; a shock to you, to an enemy (times the floor's scaling); beats of warning before the first fires; how often an insulated one says so
    // which panels fire on beat b, in the field P: alternate squares, swapping each beat; a row sweeping down it; a column rolling across
    static PATTERNS = {
        checker: (x, y, b, P) => (x - P.x0 + y - P.y0 + b) % 2 === 0,
        rows: (x, y, b, P) => (y - P.y0) === b % P.h,
        wave: (x, y, b, P) => (x - P.x0) === b % P.w,
    };
    // panels on the floor of the field P ({ x0, y0, w, h, pattern, bpm }), firing from LEAD beats on
    static start(S, P) {
        Pulse.stop(S);
        const C = Pulse.CFG, T = S.TILE_SIZE, tex = S.textures.get('pulse_panel');
        if (!tex.has('off')) ['off', 'warn', 'live'].forEach((f, i) => tex.add(f, 0, i * 12, 0, 12, 12));
        const beat = 60000 / (P.bpm || C.BPM), panels = new Map();
        for (let x = P.x0; x < P.x0 + P.w; x++) for (let y = P.y0; y < P.y0 + P.h; y++) if (S.world[x]?.[y] === S.FLOOR)
            panels.set(y * 4096 + x, { x, y, img: S.add.image(x * T + T / 2, y * T + T / 2, 'pulse_panel', 'off').setScale(T / 12).setDepth(0.55), liveUntil: 0 });
        const st = S._pulse = { P, fire: Pulse.PATTERNS[P.pattern], beat, panels, t0: S.time.now + beat * C.LEAD, b: -C.LEAD - 1, shocks: 0 };
        st.tick = () => Pulse.tick(S); S.events.on('update', st.tick);
        st.off = () => Pulse.stop(S); S.events.once('shutdown', st.off);
        return st;
    }
    // each beat: what's due fires, what's next glows; a fired panel goes dark (or glows, if it's next too) once it's spent
    static tick(S) {
        const st = S._pulse, now = S.time.now;
        if (!st || S._pauseMenuOpen) return;
        const b = Math.floor((now - st.t0) / st.beat), next = (p, k) => st.fire(p.x, p.y, k, st.P) ? 'warn' : 'off';
        if (b > st.b) {
            st.b = b;
            if (b >= 0) Pulse.fire(S, b);
            for (const p of st.panels.values()) if (now >= p.liveUntil) p.img.setFrame(next(p, b + 1));
        }
        for (const p of st.panels.values()) if (p.liveUntil && now >= p.liveUntil) { p.liveUntil = 0; p.img.setFrame(next(p, st.b + 1)); }
    }
    static fire(S, b) {
        const st = S._pulse, C = Pulse.CFG, T = S.TILE_SIZE, now = S.time.now, hit = new Set();
        for (const p of st.panels.values()) if (st.fire(p.x, p.y, b, st.P)) {
            p.img.setFrame('live'); p.liveUntil = now + C.LIVE_MS; hit.add(p.y * 4096 + p.x);
            const fl = S.add.rectangle(p.x * T + T / 2, p.y * T + T / 2, T, T, 0x9ff6ff, 0.45).setBlendMode(Phaser.BlendModes.ADD).setDepth(0.56);
            S.tweens.add({ targets: fl, alpha: 0, duration: C.LIVE_MS, onComplete: () => fl.destroy() });
        }
        if (!hit.size) return;
        Sfx.play(S, 'zap');
        if (hit.has(S.playerY * 4096 + S.playerX)) {   // you, on one
            st.shocks++; S.takeDamage(C.DMG);
            S.cameras.main.shake(120, 0.006); S.showStatusText?.(S.player.x, S.player.y - 24, 'ZAP!', '#9ff6ff');
            S.player.setTintFill(0xe8ffff); S.time.delayedCall(90, () => S.player?.active && S.player.clearTint());
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
