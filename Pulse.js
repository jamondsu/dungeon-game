// ═══════════════════════════════════════════════════════════════════════════
// Pulse.js — the Gauntlet's conductive floor, the tower's theme: metal panels set into the floor that zap on a cycle, a trap like
// any dungeon's. Each room has its own: a little of it (a strip, a few corners), a lot (islands of safe floor), or all of it (two
// halves taking turns), the floors further up having more (GAUNTLET). A room's floor runs while you're in it (a moment after you
// come in) and powers down for good once its enemies are all dead; on the lower floors the ring of tiles round a room's edge is
// safe, higher up the floor runs right to the walls (no fighting from the edge). A panel glows before it fires, so you can always read it; firing,
// it zaps you if you're on it: a small hit and a moment's daze (not mid-dash: a dash carries you through). A trap for you alone:
// the enemies walk it unharmed. The top floor (2-4, the Dynamo) is all floor and its rooms run PROGRAMS, a pattern after a
// pattern: a dancefloor, cascades (a band sweeping the room quicker than you can walk: dash through it), waves that change. Tried
// out in the Training Ground (ROOMS). In a breaker room (Breakers.js) a stretch of it is
// wired to a breaker: live while its colour is on, dead (and dark) while it's off.
// ═══════════════════════════════════════════════════════════════════════════
class Pulse {
    static CFG = { PERIOD: 2400, WARN: 800, LIVE_MS: 300, LEAD: 1200, BREATHE: 1300, DMG: 4, DAZE_MS: 600 };   // ms between zaps (a room can set its own), how long a panel glows first, stays live, the wait before the first; a quiet spell before a program's next pattern; a zap to you (times the floor's scaling) and the daze
    // which panels fire on zap c, in the field P (lx, ly its own tiles): all of them; alternate squares, swapping each zap; a row
    // sweeping down it; a column rolling across; a cascade (a band two wide sweeping across it, east, west, south or north: one a
    // zap, quick); squares growing out from its middle; diagonals sliding; its quarters two at a time; a scatter (the disco)
    static PATTERNS = {
        all: () => true,
        checker: (x, y, c, P) => (x - P.x0 + y - P.y0 + c) % 2 === 0,
        rows: (x, y, c, P) => (y - P.y0) === c % P.h,
        wave: (x, y, c, P) => (x - P.x0) === c % P.w,
        cascadeE: (x, y, c, P) => { const l = x - P.x0; return l === c || l === c - 1; },
        cascadeW: (x, y, c, P) => { const l = P.w - 1 - (x - P.x0); return l === c || l === c - 1; },
        cascadeS: (x, y, c, P) => { const l = y - P.y0; return l === c || l === c - 1; },
        cascadeN: (x, y, c, P) => { const l = P.h - 1 - (y - P.y0); return l === c || l === c - 1; },
        rings: (x, y, c, P) => { const R = Math.max(P.w, P.h) >> 1; return Math.max(Math.abs(x - P.x0 - (P.w >> 1)), Math.abs(y - P.y0 - (P.h >> 1))) === c % (R + 1); },
        diag: (x, y, c, P) => (x - P.x0 + y - P.y0 + c) % 4 === 0,
        quads: (x, y, c, P) => ((x - P.x0 < P.w / 2) !== (y - P.y0 < P.h / 2)) === (c % 2 === 0),
        disco: (x, y, c, P) => (((x - P.x0) * 7349 ^ (y - P.y0) * 1931 ^ c * 4421) >>> 0) % 5 < 2,
    };
    // a step of a room's program: its pattern, ms between its zaps, how many zaps (a cascade: across the whole room), and how long its
    // first zap glows before (a cascade's warning: which side it comes from)
    static step(pattern, period, count = Infinity, lead = 0) { return { pattern, period, count, lead }; }
    static cascade(dir, P) { return Pulse.step('cascade' + dir, 140, (dir === 'E' || dir === 'W' ? P.w : P.h) + 1, 900); }
    // how much of a room conducts, in its own tiles (lx, ly of w, h; the edge ring too only where `edge`): its program
    static DENSITY = {
        little: { program: () => [Pulse.step('all', 2600)], tiles: (lx, ly, w, h) => { const mx = w >> 1, my = h >> 1, cx = Math.min(lx - 1, w - 2 - lx), cy = Math.min(ly - 1, h - 2 - ly);
                      return (w >= h ? lx === mx - 1 || lx === mx : ly === my - 1 || ly === my) || (cx >= 1 && cx <= 2 && cy >= 1 && cy <= 2); } },   // a strip across its middle, and its corners
        lot:    { program: () => [Pulse.step('all', 2400)], tiles: (lx, ly) => !((lx - 2) % 5 < 2 && (ly - 2) % 5 < 2) },   // all but 2x2 islands every 5 tiles
        all:    { program: () => [Pulse.step('checker', 1800)], tiles: () => true, edge: true },   // half at a time
        // 2-4, the Dynamo: all of it, running programs
        dance:  { program: P => [Pulse.step('rings', 650, 8), Pulse.step('diag', 520, 8), Pulse.step('quads', 900, 6), Pulse.step('disco', 650, 8), Pulse.step('checker', 700, 6)], tiles: () => true, edge: true },
        cascade:{ program: P => [Pulse.step('checker', 1500, 3), Pulse.cascade('E', P), Pulse.step('checker', 1300, 3), Pulse.cascade('W', P), Pulse.step('wave', 260, P.w), Pulse.cascade('E', P), Pulse.cascade('W', P)], tiles: () => true, edge: true },
        dynamo: { program: P => [Pulse.step('rows', 420, P.h), Pulse.step('wave', 340, P.w), Pulse.step('checker', 1100, 4), Pulse.cascade('S', P), Pulse.step('diag', 500, 8), Pulse.cascade('N', P), Pulse.step('quads', 850, 4)], tiles: () => true, edge: true },
    };
    // the Gauntlet's rooms: more of it the higher you climb (the landings, the start, the side rooms, the Circuit and the roof are clear)
    static GAUNTLET = { g_pillars: 'little', g_brawl: 'little', g_choke: 'lot', g_lanes: 'lot', g_ambush: 'all', g_coil: 'all', g_dance: 'dance', g_cascade: 'cascade', g_dynamo: 'dynamo' };
    // a Gauntlet floor begins: each of its rooms gets its floor
    static gauntlet(S) {
        Pulse.stop(S);
        (S.rooms || []).forEach((r, i) => {
            const D = Pulse.DENSITY[Pulse.GAUNTLET[r.tpl]];
            if (!D) return;
            const P = { x0: r.x, y0: r.y, w: r.w, h: r.h, room: i, tiles: (x, y) => { const lx = x - r.x, ly = y - r.y; return (D.edge || (lx > 0 && ly > 0 && lx < r.w - 1 && ly < r.h - 1)) && D.tiles(lx, ly, r.w, r.h); } };
            P.program = D.program(P);
            Pulse.add(S, P);
        });
    }
    // one floor, alone (the Training rooms, a breaker room)
    static start(S, P) { Pulse.stop(S); return Pulse.add(S, P); }
    // panels on the floor of the field P ({ x0, y0, w, h, pattern and period (or a program: Pulse.step()s, round and round), room
    // (it runs only while you're in it), tiles: (x, y) => conducts? (all of it if not given), circuit: (x, y) => the breaker colour
    // it's wired to, if any }). S._pulse: the last one
    static add(S, P) {
        const C = Pulse.CFG, tex = S.textures.get('pulse_panel');
        if (!tex.has('off')) ['off', 'warn', 'live'].forEach((f, i) => tex.add(f, 0, i * 12, 0, 12, 12));
        const program = P.program || [Pulse.step(P.pattern || 'all', P.period || C.PERIOD)];
        const st = { P, program, panels: new Map(), shocks: 0, idle: true };
        for (let x = P.x0; x < P.x0 + P.w; x++) for (let y = P.y0; y < P.y0 + P.h; y++) if (S.world[x]?.[y] === S.FLOOR && (!P.tiles || P.tiles(x, y))) Pulse.tile(S, st, x, y, true);
        Pulse.restart(S, st);
        if (!S._pulseFields) {
            S._pulseFields = [];
            S._pulseTick = () => { for (const f of S._pulseFields || []) Pulse.tick(S, f); };
            S.events.on('update', S._pulseTick);
            S._pulseOff = () => Pulse.stop(S); S.events.once('shutdown', S._pulseOff);
        }
        S._pulseFields.push(st);
        return (S._pulse = st);
    }
    // one panel laid in (on) or taken up from a running field st, there and then (the Training Ground's painted floor)
    static tile(S, st, x, y, on) {
        const k = y * 4096 + x, T = S.TILE_SIZE;
        if (!on) { st.panels.get(k)?.img.destroy(); st.panels.delete(k); return; }
        if (!st.panels.has(k)) st.panels.set(k, { x, y, circuit: st.P.circuit?.(x, y) || null, img: S.add.image(x * T + T / 2, y * T + T / 2, 'pulse_panel', 'off').setScale(T / 12).setDepth(0.55), liveUntil: 0 });
    }
    // back to the program's start: its first zap after LEAD (and the step's own lead)
    static restart(S, st) { st.k = 0; st.c = 0; st.next = S.time.now + Pulse.CFG.LEAD + st.program[0].lead; }
    // each zap: what's due fires and the next is set (the program moves on when a step's done); before the next, what's next glows
    // (WARN, less for a quick step; a step's first zap from its lead on). A fired panel goes dark once it's spent. Out of its room:
    // dark, and it starts over when you come in
    static tick(S, st) {
        const now = S.time.now;
        if (S._pauseMenuOpen || st.cleared) return;
        if (st.P.room != null && S.tutorialRoomCleared?.[st.P.room]) {   // its room won (every wave): the power goes, for good
            st.cleared = true; for (const p of st.panels.values()) { p.liveUntil = 0; p.img.setFrame('off').setTint(0x5a5a66); } return;
        }
        if (st.P.room != null && S.getCurrentPlayerRoom?.() !== st.P.room) {
            if (!st.idle) { st.idle = true; for (const p of st.panels.values()) { p.liveUntil = 0; p.img.setFrame('off'); } }
            Pulse.restart(S, st);
            return;
        }
        st.idle = false;
        let s = st.program[st.k];
        if (now >= st.next) {
            Pulse.fire(S, st, Pulse.PATTERNS[s.pattern], st.c);
            if (++st.c >= s.count) { st.k = (st.k + 1) % st.program.length; st.c = 0; s = st.program[st.k]; st.next = now + s.period + s.lead + (st.program.length > 1 ? Pulse.CFG.BREATHE : 0); }   // (a breath before the next pattern)
            else st.next = now + s.period;
        }
        const pat = Pulse.PATTERNS[s.pattern], W = Math.min(Pulse.CFG.WARN, s.period * 0.7) + (st.c === 0 ? s.lead : 0), warn = now >= st.next - W;
        for (const p of st.panels.values()) {
            if (p.liveUntil && now < p.liveUntil) continue;
            p.liveUntil = 0;
            const on = Breakers.powered(S, p.circuit), f = on && warn && pat(p.x, p.y, st.c, st.P) ? 'warn' : 'off';
            if (p.img.frame.name !== f) p.img.setFrame(f);
            if (p.dead !== !on) { p.dead = !on; if (on) p.img.clearTint(); else p.img.setTint(0x5a5a66); }   // (unpowered: dark)
        }
    }
    static fire(S, st, pat, c) {
        const C = Pulse.CFG, T = S.TILE_SIZE, now = S.time.now, hit = new Set(), live = Math.min(C.LIVE_MS, (st.program[st.k].period || C.LIVE_MS) * 0.9);
        for (const p of st.panels.values()) if (Breakers.powered(S, p.circuit) && pat(p.x, p.y, c, st.P)) {
            p.img.setFrame('live'); p.liveUntil = now + live; hit.add(p.y * 4096 + p.x);
            const fl = S.add.rectangle(p.x * T + T / 2, p.y * T + T / 2, T, T, 0x9ff6ff, 0.45).setBlendMode(Phaser.BlendModes.ADD).setDepth(0.56);
            S.tweens.add({ targets: fl, alpha: 0, duration: live, onComplete: () => fl.destroy() });
        }
        if (!hit.size) return;
        if (now - (st.sfxAt || -1e9) > 200) { st.sfxAt = now; Sfx.play(S, 'zap'); }   // (a cascade's quick zaps: not a buzz)
        if (hit.has(S.playerY * 4096 + S.playerX) && now >= (S._dashInvulnUntil || 0)) {   // (mid-dash it passes through you)   // you, on one: a small hit and, unless you've just been dazed, a moment's daze
            st.shocks++; S.takeDamage(C.DMG * (S.enemyDamageScale || 1), 'live floor');
            S.cameras.main.shake(120, 0.006); S.showStatusText?.(S.player.x, S.player.y - 24, 'ZAP!', '#9ff6ff');
            S.player.setTintFill(0xe8ffff); S.time.delayedCall(90, () => S.player?.active && S.player.clearTint());
            if (S._ccGate?.(C.DAZE_MS)) { S._staggerUntil = Math.max(S._staggerUntil || 0, now + C.DAZE_MS); S.showStatusText?.(S.player.x, S.player.y - 40, 'DAZED', '#fff3a8'); }
            st.onShock?.(st.shocks);
        }
    }
    // ── THE OVERLOAD (2-3): the Voltslime blows the coils ──
    // Step into the winding run (g_run) and, a moment later, its floor goes live behind you: from the way you came in it spreads
    // along the hall at SPEED tiles a second, each tile glowing first (AHEAD tiles ahead of it). Caught in it: a hard hit and
    // you're thrown THROW tiles on ahead of it, not killed; mid-dash it passes through you. It runs to the hall's far end and
    // burns out (past the far door, the Coil Hall's steel door shuts on it). Enemies walk it unharmed, as the panels.
    static OVERLOAD = { SPEED: 2.4, DELAY: 2200, AHEAD: 2.5, DMG: 14, THROW: 4, HIT_GAP: 900 };
    static overload(S, ri) {
        const O = Pulse.OVERLOAD, r = S.rooms[ri], T = S.TILE_SIZE, ADD = Phaser.BlendModes.ADD, tex = S.textures.get('pulse_panel');
        if (S._overload) return;
        if (!tex.has('off')) ['off', 'warn', 'live'].forEach((f, i) => tex.add(f, 0, i * 12, 0, 12, 12));
        // each tile's way along the hall from where you came in
        const key = (x, y) => y * 4096 + x, dist = new Map([[key(S.playerX, S.playerY), 0]]), q = [[S.playerX, S.playerY]];
        const inside = (x, y) => x >= r.x && x < r.x + r.w && y >= r.y && y < r.y + r.h && S.world[x]?.[y] === S.FLOOR;
        while (q.length) {
            const [x, y] = q.shift(), d = dist.get(key(x, y));
            for (const [nx, ny] of [[x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]]) if (inside(nx, ny) && !dist.has(key(nx, ny))) { dist.set(key(nx, ny), d + 1); q.push([nx, ny]); }
        }
        const panels = [...dist].map(([k, d]) => { const x = k % 4096, y = Math.floor(k / 4096); return { x, y, d, f: 'off', img: S.add.image(x * T + T / 2, y * T + T / 2, 'pulse_panel', 'off').setScale(T / 12).setDepth(0.55) }; });
        const max = Math.max(...dist.values()), cam = S.cameras.main;
        S.tutorialRoomCleared[ri] = true;   // (nothing to win in it: the way on is through it)
        // the alarm: red light pulsing over everything, the Voltslime's voice, and it goes
        const red = S.add.rectangle(r.x * T - T * 20, r.y * T - T * 20, (r.w + 40) * T, (r.h + 40) * T, 0xff2a1a).setOrigin(0).setDepth(0.58).setBlendMode(ADD).setAlpha(0);   // (over the floor's panels, under everyone)
        S.tweens.add({ targets: red, alpha: 0.12, duration: 380, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
        Sfx.play(S, 'surge'); Sfx.play(S, 'laugh'); cam.shake(300, 0.006);
        S._showRhythmSessionBanner?.('OVERLOAD', '#ff6a4a', '"Enough." The coils are blowing: RUN!');
        S.time.delayedCall(O.DELAY - 500, () => S._overload === st && Sfx.play(S, 'e_riser'));
        const st = S._overload = { ri, dist, panels, max, red, t0: S.time.now + O.DELAY, hitAt: -1e9, sfxAt: 0, sparkAt: 0, done: false };
        st.tick = () => Pulse.overloadTick(S, st); S.events.on('update', st.tick);
        st.off = () => { S.events.off('update', st.tick); S.events.off('shutdown', st.off); S._overload = null; }; S.events.once('shutdown', st.off);
        return st;
    }
    static overloadTick(S, st) {
        if (st.done || S._pauseMenuOpen) return;
        const O = Pulse.OVERLOAD, T = S.TILE_SIZE, now = S.time.now, front = (now - st.t0) / 1000 * O.SPEED;
        if (front > st.max + 1) {   // burnt out: the floor goes dead, the alarm stops
            st.done = true;
            for (const p of st.panels) p.img.setFrame('off').setTint(0x5a5a66);
            S.tweens.killTweensOf(st.red); S.tweens.add({ targets: st.red, alpha: 0, duration: 600, onComplete: () => st.red.destroy() });
            Sfx.play(S, 'thud'); S.cameras.main.shake(160, 0.004);
            return;
        }
        for (const p of st.panels) {
            const f = p.d <= front ? 'live' : p.d <= front + O.AHEAD ? 'warn' : 'off';
            if (f !== p.f) { p.f = f; p.img.setFrame(f); }
        }
        if (front < 0) return;
        // the front: sparks and flashes along it, its crackle
        if (now >= st.sparkAt) {
            st.sparkAt = now + 70;
            const edge = st.panels.filter(p => p.d <= front && p.d > front - 1.5);
            for (let i = 0; i < 2 && edge.length; i++) {
                const p = edge[Math.floor(Math.random() * edge.length)], px = p.x * T + T / 2, py = p.y * T + T / 2;
                const fl = S.add.rectangle(px, py, T, T, 0x9ff6ff, 0.5).setBlendMode(Phaser.BlendModes.ADD).setDepth(0.56);
                S.tweens.add({ targets: fl, alpha: 0, duration: 220, onComplete: () => fl.destroy() });
                const d = S.add.image(px + (Math.random() - 0.5) * T, py + (Math.random() - 0.5) * T, 'vfx_dot').setBlendMode(Phaser.BlendModes.ADD).setTint(Math.random() < 0.5 ? 0x9ff6ff : 0xffffff).setScale(0.5).setDepth(0.57);
                S.tweens.add({ targets: d, y: d.y - 10 - Math.random() * 14, alpha: 0, scale: 0.1, duration: 260, onComplete: () => d.destroy() });
            }
        }
        if (now - st.sfxAt > 260 && S.getCurrentPlayerRoom?.() === st.ri) { st.sfxAt = now; Sfx.play(S, 'zap'); }
        // you, caught in it: a hard hit, and thrown on ahead of it
        const here = st.dist.get(S.playerY * 4096 + S.playerX);
        if (here == null || here > front || now < (S._dashInvulnUntil || 0) || now - st.hitAt < O.HIT_GAP || S._deathScreenActive) return;
        st.hitAt = now;
        S.takeDamage(O.DMG * (S.enemyDamageScale || 1), 'overload');
        S.cameras.main.shake(200, 0.01); S.showStatusText?.(S.player.x, S.player.y - 24, 'OVERLOAD!', '#9ff6ff');
        S.player.setTintFill(0xe8ffff); S.time.delayedCall(110, () => S.player?.active && S.player.clearTint());
        const want = Math.min(st.max, front + O.THROW);
        let to = null;
        for (const p of st.panels) if (p.d >= want && p.d <= want + 2 && !S.getEnemyAt?.(p.x, p.y)) { const k = Math.hypot(p.x - S.playerX, p.y - S.playerY); if (!to || k < to.k) to = { p, k }; }
        if (!to || !S.player?.active) return;
        S.playerX = to.p.x; S.playerY = to.p.y; S._step = null; S._glideUntil = now + 260;
        S.tweens.add({ targets: S.player, x: to.p.x * T + T / 2, y: to.p.y * T + T / 2 + (S.SLIME_Y_OFFSET || 0), duration: 240, ease: 'Quad.easeOut' });
    }
    static stop(S) {
        if (!S._pulseFields) return;
        S.events.off('update', S._pulseTick); S.events.off('shutdown', S._pulseOff);
        for (const st of S._pulseFields) for (const p of st.panels.values()) p.img.destroy();
        S._pulseFields = null; S._pulse = null;
    }
}
