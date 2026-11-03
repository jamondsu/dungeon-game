// ═══════════════════════════════════════════════════════════════════════════
// Conductor.js — the Conductor, the Circuit Breaker (lightning): a staff that throws wires. How it plays is written
// out over _conductorCfg.
// GameScene borrows each method through a one-line proxy, so `this` in them is the scene.
// ═══════════════════════════════════════════════════════════════════════════

class Conductor {

    // The Circuit Breaker: a staff that throws wires. A click shoots one at the enemy nearest the cursor (inside
    // CURSOR_R of it and RANGE of you) and clamps on; you're the other end. Up to WIRES at once (a new one drops the
    // oldest), one throw every CD; a clamp that bites dazes its enemy for LAND_DAZE. R sends a CURRENT down the wire
    // nearest your aim: a blob that runs out to the enemy, on
    // through the arcs, and home along the last wire, dazing (PULSE_DAZE) and hitting (PULSE_DMG) each enemy it passes.
    // That's your hand in it once the web is up (R, at the wire nearest your aim). Each clamp is one of three, cycled with the secondary key:
    //   LIVE       current runs through it: it takes WIRE_DMG a TICK
    //   INSULATOR  it takes only INS_TAKE of that, and the whole web (every clamp, line, burst and current) does
    //              INS_NERF as much per insulator, but every daze lasts INS_DAZE longer: control for damage
    //   (Amped: live and insulated clamps while their circuit is closed, and wherever a current runs; never a capacitor)
    //   CAPACITOR  it takes nothing; the current it would have taken is stored, and every CAP_MS it bursts: CAP_BASE
    //              plus CAP_X times what it stored, forked out and shared between everything within CAP_R (+CAP_SPREAD
    //              of the total for each enemy past the first), so it spreads damage where a live wire focuses it
    // Any other enemy touching a wire or an arc takes CROSS_DMG a tick. Wired enemies inside ARC_R of each other arc
    // together, chained into a RING through you (oldest clamp first, each on to the nearest free one it arcs to): a
    // circuit in series, out along the ring's first wire, through every enemy in turn, home along its last; the wires
    // in between are taps that carry nothing. A ring runs CIRCUIT times hotter with two in it, RING_STEP more for each
    // one past that. So a lone live wire is weak; the damage is in building the ring. A line snaps past SNAP tiles or behind a wall or gate; when a
    // wired enemy dies the clamp jumps to the nearest unwired enemy in JUMP_R.
    _conductorCfg() {
        const reach = WeaponLevels.perk('conductor', 'reach'), more = WeaponLevels.perk('conductor', 'wires');
        return { CD: 650, PULSE_CD: 420, PULSE_SPEED: 620, PULSE_DMG: 6, PULSE_DAZE: 450, LAND_DAZE: 400, INS_NERF: 0.65, INS_DAZE: 0.6, INS_SC: 2500, PULSE_SC: 3500, RANGE: 8 + reach, CURSOR_R: 2.5, SNAP: 18 + reach, FLY_MS: 150, SLING: 330, WIRES: 3 + more, ARC_R: 6, JUMP_R: 3, CROSS_R: 0.65,
            TICK: 300, LATCH_DMG: 3, WIRE_DMG: 4, CROSS_DMG: 5, INS_TAKE: 0.3,
            CIRCUIT: 2, RING_STEP: 0.5, CAP_MS: 3000, CAP_R: 2.5, CAP_BASE: 3, CAP_X: 1, CAP_SPREAD: 0.3,
            HOVER_R: 1.3, RETYPE_CD: 350, CUT_HOLD: 400, SNIP_LIVE: 4, SNIP_LIVE_S: 3, SNIP_R: 2, SNIP_DAZE: 900,
            COL: 0xffe14a, HOT: 0xfff8c0, MODES: ['live', 'ins', 'cap'], MCOL: { live: 0xffe14a, ins: 0x7fd0ff, cap: 0xff9a3a } };
    }
    // Queens and bosses aren't in the enemy list: each gets a stand-in the wires can hold (the same one every frame,
    // so a wire knows its own), whose hits go through damagePortal / damageBossAtTile
    _condBigs() {
        const T = this.TILE_SIZE, map = this._condBigMap ||= new Map(), out = [];
        const mk = (o, at, hit) => {
            let q = map.get(o);
            if (!q) { q = { _big: o, get x() { return this.sprite.x / T; }, get y() { return this.sprite.y / T; }, get health() { return this._big.active && this.sprite?.active ? 1 : 0; } }; map.set(o, q); }
            q.sprite = at; q.hit = hit; out.push(q);
        };
        for (const p of this.portals || []) if (p.active && p.container) mk(p, p.container, d => this.damagePortal(p, d));
        for (const bo of [this.voltslimeBoss, this.voidSovereignBoss, this.fractureCore]) {
            if (!bo?.active || !bo.container) continue;
            mk(bo, bo.container, d => { const bx = bo.tileX ?? Math.floor(bo.container.x / T), by = bo.tileY ?? Math.floor(bo.container.y / T); this.damageBossAtTile(bx, by, d, undefined, 'lightning'); });
        }
        return out;
    }
    _condTargets() { return [...this.enemies.filter(e => !this._phasedOut(e)), ...this._condBigs()]; }
    _condHit(e, d) { if (e._big) { e.hit(d); this._dmgLanded = true; } else this.damageEnemy(e, d, 'lightning'); }
    _condSC(e, ms) { if (!e._big) this._superconduct(e, ms); }
    // the web's damage and its dazes, with the insulators on it counted
    _condWebMul(on) { const C = this._conductorCfg(), n = on.filter(w => w.mode === 'ins').length; return { dmg: Math.pow(C.INS_NERF, n), daze: 1 + C.INS_DAZE * n }; }
    _condDaze(e, ms) {
        if (e._big || !e.sprite?.active || e.health <= 0) return;
        if (!(e.isStunned && e.stunnedUntil > this.time.now)) this._statusPop(e, 'DAZED', '#fff6a0');
        e.isStunned = true; e.stunnedUntil = Math.max(e.stunnedUntil || 0, this.time.now + ms);
    }
    _condTip() { const t = this._condWielding() && typeof CreatureFX !== 'undefined' && CreatureFX.gearTip?.(this); return t || { x: this._shotX(), y: this._shotY() }; }   // the staff's head (you, while you hold something else)
    _condWielding() { return this.currentElement === 'lightning' && this.equippedWeapons?.lightning === 'conductor' && this.player?.active; }
    conductorAttack(targetX, targetY) {
        const C = this._conductorCfg(), now = this.time.now, T = this.TILE_SIZE;
        const wx = targetX + this.cameras.main.scrollX, wy = targetY + this.cameras.main.scrollY, { x: px, y: py } = this._condTip();
        const wires = this._condWires ||= [];
        const aim = Math.atan2(wy - py, wx - px);
        const near = this._condTargets().filter(e => e.sprite?.active && e.health > 0 && Math.hypot(e.sprite.x - wx, e.sprite.y - wy) < C.CURSOR_R * T && Math.hypot(e.sprite.x - px, e.sprite.y - py) < C.RANGE * T && this._condClear(this.player.x, this.player.y, e.sprite.x, e.sprite.y))   // (from you, not the staff head, which can poke into a wall)
            .sort((a, b) => Math.hypot(a.sprite.x - wx, a.sprite.y - wy) - Math.hypot(b.sprite.x - wx, b.sprite.y - wy));
        const e = near.find(q => !wires.some(w => w.e === q));   // an unwired enemy under the cursor gets a wire (R sends the currents)
        if (now - (this._condLast || 0) < C.CD) return;
        this._condLast = now;
        this._gearFiredAt = now;
        Sfx.play(this, 'zap');
        if (!e) {   // nothing there: the line flies out, drops slack on the floor, and reels back in
            const L = Math.min(C.RANGE * T * 0.7, Math.max(T * 2, Math.hypot(wx - px, wy - py)));
            (this._condMisses ||= []).push({ t0: now, a: aim, L, side: Math.random() < 0.5 ? 1 : -1, path: [{ x: 0, y: 0 }], mode: this._condMode || 'live', seed: Math.random() * 10 });   // (its path kept relative to the staff, so it travels with you)
            return;
        }
        if (wires.length >= C.WIRES) this._condSnap(wires.shift());
        wires.push({ e, t0: now, seed: Math.random() * 10, fx: null, mode: this._condMode || 'live', store: 0, ...this._condThrow(px, py, e) });
        const a = Math.atan2(e.sprite.y - py, e.sprite.x - px), fl = this.add.image(px, py, 'vfx_glow').setTint(C.HOT).setBlendMode(Phaser.BlendModes.ADD).setDepth(4.3).setScale(0.15);   // the staff kicks: a flare, a spray of sparks down the line
        this.tweens.add({ targets: fl, scale: 0.55, alpha: 0, duration: 180, ease: 'Quad.easeOut', onComplete: () => fl.destroy() });
        for (let k = 0; k < 8; k++) this._condSpark(px + Math.cos(a) * 8, py + Math.sin(a) * 8, 1);
        WeaponSystem.zapFlare(this, px, py, 'y', 1.1, 4.3);
    }
    // a fresh throw from (x, y) at enemy e: where the clamp is, which way it swings, the path it lays
    _condThrow(x, y, e) {
        return { bx: x, by: y, hx: x, hy: y, lx: x, ly: y, path: [{ x, y, t: this.time.now }], side: Math.random() < 0.5 ? 1 : -1, d0: Math.max(1, Math.hypot(e.sprite.x - x, e.sprite.y - 4 - y)), relax: null };
    }
    // n points spaced evenly along a polyline
    _condResample(src, n) {
        const d = [0]; for (let i = 1; i < src.length; i++) d.push(d[i - 1] + Math.hypot(src[i].x - src[i - 1].x, src[i].y - src[i - 1].y));
        const L = d[d.length - 1] || 1, out = []; let j = 1;
        for (let k = 0; k < n; k++) {
            const t = L * k / (n - 1); while (j < src.length - 1 && d[j] < t) j++;
            const a = src[j - 1], b = src[j], f = (t - d[j - 1]) / ((d[j] - d[j - 1]) || 1);
            out.push({ x: a.x + (b.x - a.x) * f, y: a.y + (b.y - a.y) * f });
        }
        return out;
    }
    // A capacitor letting go of what it stored: one charge, forked out and split between everything within CAP_R of it
    _condCapBurst(w) {
        const C = this._conductorCfg(), e = w.e, x = e.sprite.x, y = e.sprite.y - 4;
        w.charge = 0;
        const hit = this._condTargets().filter(o => o.sprite?.active && o.health > 0 && Math.hypot(o.x - e.x, o.y - e.y) <= C.CAP_R && (o === e || this._condClear(e.sprite.x, e.sprite.y, o.sprite.x, o.sprite.y)));
        const share = (C.CAP_BASE + C.CAP_X * w.store) * (1 + C.CAP_SPREAD * (hit.length - 1)) / Math.max(1, hit.length) * this.damageScaling;
        this._condBurstFx(x, y, hit, e, w.store);
        w.store = 0;
        for (const o of hit) this._condHit(o, share);
    }
    // The wire your cursor is on (its enemy within HOVER_R tiles, or the cable itself), or null: a tap of G re-types it, holding G cuts it
    _condHover() {
        if (!this._condWielding()) return null;
        const C = this._conductorCfg(), T = this.TILE_SIZE, cam = this.cameras.main, p = this.input.activePointer, ap = this._aim?.(p) || p;
        const mx = ap.x + cam.scrollX, my = ap.y + cam.scrollY;
        let best = null, bd = 1;
        for (const w of this._condWires || []) {
            if (!w.on || !w.e.sprite?.active || w.e.health <= 0) continue;
            let d = Math.hypot(w.e.sprite.x - mx, w.e.sprite.y - 4 - my) / (C.HOVER_R * T);
            const pts = w.pts || [];
            for (let i = 1; i < pts.length; i++) {
                const a = pts[i - 1], b = pts[i], dx = b.x - a.x, dy = b.y - a.y, t = Phaser.Math.Clamp(((mx - a.x) * dx + (my - a.y) * dy) / (dx * dx + dy * dy || 1), 0, 1);
                d = Math.min(d, Math.hypot(a.x + dx * t - mx, a.y + dy * t - my) / (0.4 * T));
            }
            if (d < bd) { bd = d; best = w; }
        }
        return best;
    }
    // the hovered wire lit white, a ring on its clamp, and what you can do with it; G held at it fills the ring, and full, cuts it
    _condHoverDraw(gl, on, time) {
        const H = this._condHold, C = this._conductorCfg();
        if (H && !H.cut) {
            if (!H.w.on || !H.w.e.sprite?.active) this._condHold = null;
            else {
                const k = Math.min(1, (time - H.t0) / C.CUT_HOLD), x = H.w.e.sprite.x, y = H.w.e.sprite.y - 4;
                gl.lineStyle(3, 0xff6a4a, 0.95); gl.beginPath(); gl.arc(x, y, 16, -Math.PI / 2, -Math.PI / 2 + k * Math.PI * 2, false); gl.strokePath();
                if (k >= 1) { H.cut = true; this._condCut(H.w); }
            }
        }
        const w = this._condHover(), hint = this._condHint;
        if (!w) { hint?.setVisible(false); return; }
        if (w.pts) Conductor.cable(this, w.pts, 'w', 1.6, 0.55 + 0.2 * Math.sin(time / 90), 1.5, false);   // lit white
        const x = w.e.sprite.x, y = w.e.sprite.y - 4;
        gl.lineStyle(1.5, 0xffffff, 0.9); gl.strokeCircle(x, y, 13 + Math.sin(time / 120));
        const h = hint?.active ? hint : (this._condHint = this.add.text(0, 0, '', { fontSize: '9px', fontFamily: 'monospace', fontStyle: 'bold', color: '#fff8d8', stroke: '#05060a', strokeThickness: 3, resolution: 2 }).setOrigin(0.5, 0).setDepth(6));
        const key = Settings.label(Settings.key('detonate'));
        h.setText(`${key} change  ·  hold ${key} cut`).setPosition(x, y + 14).setVisible(true);
    }
    // G at a wire: it turns to the next kind (live, insulator, capacitor); a capacitor's store is lost when it stops being one
    _condRetype(w) {
        const C = this._conductorCfg(), now = this.time.now;
        if (now - (this._condRetypeAt || 0) < C.RETYPE_CD) return;
        this._condRetypeAt = now;
        const next = C.MODES[(C.MODES.indexOf(w.mode) + 1) % C.MODES.length];
        if (w.mode === 'cap') { w.store = 0; w.charge = 0; }
        w.mode = next;
        const x = w.e.sprite.x, y = w.e.sprite.y - 4, col = C.MCOL[next];
        WeaponSystem.zapFlare(this, x, y, Conductor.condPal(col), 1.6);
        WeaponSystem.zapSparks(this, Conductor.condPal(col)).emitParticleAt(x, y, 8);
        this.showStatusText(x, y - 26, { live: 'LIVE WIRE', ins: 'INSULATOR', cap: 'CAPACITOR' }[next], UIKit._hex(col));
        Sfx.play(this, 'clink');
    }
    // Cut wire w (G held at it), with a parting shot for its kind: a live wire cracks its enemy (harder the longer it
    // held), an insulator dazes everything near its enemy, a capacitor dumps what it's stored at once
    _condCut(w) {
        if (!w?.on) return;
        const C = this._conductorCfg(), e = w.e, x = e.sprite.x, y = e.sprite.y - 4, on = (this._condWires || []).filter(q => q.on), web = this._condWebMul(on);
        if (w.mode === 'live') {
            const secs = Math.min(4, (this.time.now - (w.bite || this.time.now)) / 1000);
            this._condHit(e, (C.SNIP_LIVE + C.SNIP_LIVE_S * secs) * (w.closed ? w.hot : 1) * web.dmg * this.damageScaling);
            if (w.pts) Conductor.cable(this, w.pts, 'w', 2.5, 1, 4.3, false, 200);   // it cracks white all down the line
            this._vfxFlash?.(e.sprite.x, e.sprite.y, 60, C.COL, 220, 0.9);
            Sfx.play(this, 'zap'); Sfx.play(this, 'swing');
        } else if (w.mode === 'ins') {
            for (const o of this._condTargets()) if (o.sprite?.active && o.health > 0 && Math.hypot(o.x - e.x, o.y - e.y) <= C.SNIP_R) this._condDaze(o, C.SNIP_DAZE * web.daze);
            WeaponSystem.zapFlare(this, x, y, 'c', 2.6);
            WeaponSystem.zapSparks(this, 'c').emitParticleAt(x, y, 16);
            Sfx.play(this, 'block');
        } else this._condCapBurst(w);
        w.on = false;
        this._condSnap(w);
        this._condWires.splice(this._condWires.indexOf(w), 1);
        this.cameras.main.shake(60, 0.002);
    }
    // A current round w's ring: out along the leg nearer w, through every enemy in the ring in turn, home along the other
    // leg, each line once (a lone wire: out to its enemy and back down it)
    _condPulse(w) {
        const route = [], ring = w.ring?.every(q => q.on) ? w.ring : null;
        if (ring) {
            const seq = ring.indexOf(w) <= (ring.length - 1) / 2 ? ring : [...ring].reverse();
            route.push({ w: seq[0] });
            for (let i = 1; i < seq.length; i++) route.push({ a: seq[i - 1].e, b: seq[i].e });
            route.push({ w: seq[seq.length - 1], back: true });
        } else route.push({ w }, { w, back: true });
        (this._condPulses ||= []).push({ route, i: 0, d: 0, hit: new Set(), trail: [] });
        const { x, y } = this._condTip();
        this._condSpark(x, y, 10);
        WeaponSystem.zapFlare(this, x, y, 'y', 1.3, 4.3);
        Sfx.play(this, 'zap');
    }
    // sparks (the hand-drawn ones, gold)
    _condSpark(x, y, n) { WeaponSystem.zapSparks(this, 'y').emitParticleAt(x, y, n); }
    // a line let go: it whips down and fades
    _condSnap(w) {
        if (!w?.e?.sprite) return;
        const C = this._conductorCfg(), g = this.add.graphics().setDepth(1.5), x = w.e.sprite.x, y = w.e.sprite.y;
        this._strokeFork(g, x, y - 4, x + (Math.random() - 0.5) * 30, y + 14, C.HOT, 0.9, 1, 240);
        this.tweens.add({ targets: g, alpha: 0, duration: 240, onComplete: () => g.destroy() });
        this._condSpark(x, y - 4, 6);
    }
    // a gold cable (Conductor.cable) with the current riding it in the clamp's colour, brighter with k; `fade` thins
    // it all out (a tap in a ring)
    _condCable(g, gl, pts, time, seed, k = 1, col, fade = 1) {
        Conductor.cable(this, pts, Conductor.condPal(col), k, fade);
    }
    static condPal(col) { return col === 0x7fd0ff ? 'c' : col === 0xff9a3a ? 'o' : col === 0xffffff ? 'w' : 'y'; }
    // A wire along pts, laid from the hand-drawn pieces snapped to the art's pixels: its dark rim stamped all the way
    // along, the two twisted gold strands over it, and the current (pal) crackling in it, a pixel every few, more and
    // brighter with k. rim false: the current alone. For life ms (0: this frame).
    static cable(S, pts, pal, k = 1, fade = 1, d = 1.5, rim = true, life = 0) {
        const K = 1.5, at = [];
        for (let i = 1; i < pts.length; i++) {
            const a = pts[i - 1], b = pts[i], n = Math.max(1, Math.ceil(Math.hypot(b.x - a.x, b.y - a.y) / (K * 2)));
            for (let j = 0; j < n; j++) at.push(Math.round((a.x + (b.x - a.x) * j / n) / K) * K, Math.round((a.y + (b.y - a.y) * j / n) / K) * K);
        }
        if (rim) {
            for (let i = 0; i < at.length; i += 2) WeaponSystem.zap(S, 'cab_o', at[i], at[i + 1], life, fade, d, K, false, false);
            for (let i = 0; i < at.length; i += 2) WeaponSystem.zap(S, (i >> 2) & 1 ? 'cab_1' : 'cab_0', at[i], at[i + 1], life, fade, d + 0.001, K, false, false);   // (two on, two off: the twist)
        }
        if (k > 0) for (let i = 2; i < at.length - 2; i += 2) {
            if (WeaponSystem.vr() > 0.22 + 0.3 * k) continue;
            const j = () => (WeaponSystem.vr() < 0.6 ? 0 : WeaponSystem.vr() < 0.5 ? K : -K);
            WeaponSystem.zap(S, WeaponSystem.vr() < 0.25 * k ? 'pw_' + pal : 'px_' + pal, at[i] + K / 2 + j(), at[i + 1] + K / 2 + j(), life, Math.min(1, 0.55 + 0.3 * k) * fade, d + 0.002, K);
        }
    }
    // The clamp (hand-drawn, fx_storm clamp_*) pointing the k-th of eight ways (east first, clockwise): four typed,
    // the other four those flipped both ways, never turned
    static clamp(S, x, y, k, d = 1.52, a = 1) {
        const [f, fl] = [['e', 0], ['se', 0], ['s', 0], ['sw', 0], ['e', 1], ['se', 1], ['s', 1], ['sw', 1]][((k % 8) + 8) % 8];
        return WeaponSystem.zap(S, 'clamp_' + f, Math.round(x / 1.5) * 1.5, Math.round(y / 1.5) * 1.5, 0, a, d, 1.5, !!fl, false);
    }
    static dir8(dx, dy) { return ((Math.round(Math.atan2(dy, dx) / (Math.PI / 4)) % 8) + 8) % 8; }
    // The clamps' badges (hand-drawn, fx_storm; over the enemy's health bar and on the meter): a bolt for a live wire,
    // a stack of ceramic discs for an insulator, a capacitor whose fill shows its charge k (empty to full)
    static condBadge(mode, k = 0) { return mode === 'cap' ? 'ic_cap_' + Math.min(4, Math.floor(k * 5)) : 'ic_' + mode; }
    // a live clamp: current crawling over its enemy, a warm glow on it
    _condLiveDraw(gl, glow, x, y, time) {
        const col = this._conductorCfg().MCOL.live;
        glow(x, y + 2, 0.3, col, 0.28 + 0.08 * Math.sin(time / 45));
        for (let q = 0; q < 2; q++) {   // little arcs jumping over its skin
            const a = time / 90 + q * Math.PI + Math.random() * 0.6, b = a + 0.9 + Math.random() * 0.8;
            WeaponSystem.bolt(this, x + Math.cos(a) * 11, y + 2 + Math.sin(a) * 7, x + Math.cos(b) * 11, y + 2 + Math.sin(b) * 7, 'y', { thin: q > 0, br: 0, d: 3.9, glow: false });
        }
    }
    // a capacitor clamp: a ring round its enemy filling with its charge, current drawn in to it, brighter as it fills
    _condCapDraw(gl, glow, w, x, y, time) {
        const C = this._conductorCfg(), k = w.charge || 0, col = C.MCOL.cap;
        glow(x, y + 2, 0.2 + 0.25 * k, col, 0.2 + 0.4 * k * (k > 0.8 ? 0.7 + 0.3 * Math.sin(time / 30) : 1));
        for (let q = 0; q < 2; q++) {   // charge streaming in from round it (its badge shows how full)
            const a = Math.random() * Math.PI * 2, r = 22 - ((time / 6 + q * 9) % 12);
            WeaponSystem.bolt(this, x + Math.cos(a) * r, y + 2 + Math.sin(a) * r * 0.7, x + Math.cos(a) * (r - 9), y + 2 + Math.sin(a) * (r - 9) * 0.7, 'o', { thin: true, br: 0, a: 0.5 + 0.5 * k, d: 3.9, glow: false });
        }
        if (k > 0.75 && WeaponSystem.vr() < k) { const a = WeaponSystem.vr() * Math.PI * 2; WeaponSystem.bolt(this, x + Math.cos(a) * 12, y + 2 + Math.sin(a) * 8, x - Math.cos(a) * 12, y + 2 - Math.sin(a) * 8, 'o', { br: 0, d: 3.9, glow: false }); }   // near full it crackles right across
    }
    // an insulator clamp: a cool rubbery shell of light round its enemy, a sheen sliding over it
    _condInsDraw(gl, glow, x, y, time) {
        const col = this._conductorCfg().MCOL.ins;
        glow(x, y + 2, 0.32, col, 0.3);
        WeaponSystem.zap(this, 'shell_' + (Math.floor(time / 110) & 3), Math.round(x / 1.5) * 1.5, Math.round((y + 2) / 1.5) * 1.5, 0, 0.7 + 0.15 * Math.sin(time / 120), 3.9);   // (hand-drawn, its sheen going round)
    }
    // A capacitor letting go: a white-hot core, two rings, bolts flung out every way and on to what it hits, sparks,
    // a shake as big as the charge was
    _condBurstFx(x, y, hit, e, store) {
        const C = this._conductorCfg(), T = this.TILE_SIZE, col = C.MCOL.cap, ADD = Phaser.BlendModes.ADD;
        for (let k = 0; k < 8; k++) { const a = k / 8 * Math.PI * 2 + Math.random() * 0.4, r = C.CAP_R * T * (0.55 + Math.random() * 0.35); WeaponSystem.bolt(this, x, y, x + Math.cos(a) * r, y + Math.sin(a) * r * 0.75, 'o', { life: 260, thin: k & 1, br: 1, d: 4.6, glow: !(k & 1) }); }
        for (const o of hit) if (o !== e) { WeaponSystem.bolt(this, x, y, o.sprite.x, o.sprite.y - 4, 'o', { life: 280, br: 2, d: 4.6 }); WeaponSystem.zapFlare(this, o.sprite.x, o.sprite.y - 4, 'o', 1.3, 4.7); }
        const core = this.add.image(x, y, 'vfx_glow').setTint(col).setBlendMode(ADD).setDepth(4.7).setScale(0.2).setAlpha(0.7);
        this.tweens.add({ targets: core, scale: 0.6, alpha: 0, duration: 260, ease: 'Quad.easeOut', onComplete: () => core.destroy() });
        WeaponSystem.zapFlare(this, x, y, 'o', 2.6, 4.75);
        this._vfxFlash?.(x, y, 90, col, 300, 0.55);
        WeaponSystem.zapSparks(this, 'o').emitParticleAt(x, y, 24);
        const big = Math.min(1, store / 30);
        this.cameras.main.shake(90 + 60 * big + 15 * Math.min(4, hit.length), 0.003 + 0.004 * big);
        Sfx.play(this, 'blburst'); Sfx.play(this, 'zap');
    }
    // a wire can't pass walls or a sealed room's laser gate
    _condClear(ax, ay, bx, by) {
        const T = this.TILE_SIZE, n = Math.ceil(Math.hypot(bx - ax, by - ay) / (T / 3));
        const gates = this._condGateSet?.src === this.lockedDoorTiles && this._condGateSet.n === (this.lockedDoorTiles?.length || 0) ? this._condGateSet.set
            : (this._condGateSet = { src: this.lockedDoorTiles, n: this.lockedDoorTiles?.length || 0, set: new Set((this.lockedDoorTiles || []).map(t => t.x + ',' + t.y)) }).set;
        for (let i = 1; i < n; i++) {
            const tx = Math.floor((ax + (bx - ax) * i / n) / T), ty = Math.floor((ay + (by - ay) * i / n) / T);
            if (this.world[tx]?.[ty] !== this.FLOOR || gates.has(tx + ',' + ty) || this.isInLockedRoom?.(tx, ty)) return false;
        }
        return true;
    }
    // the slack curve of a wire from (ax, ay) to (bx, by): it sags more the less taut it is, and sways
    _condCurve(ax, ay, bx, by, seed, time, C) {
        const len = Math.hypot(bx - ax, by - ay), sag = Phaser.Math.Clamp((C.SNAP * this.TILE_SIZE - len) * 0.09, 3, 26) * (1 + 0.12 * Math.sin(time / 280 + seed));
        const cx = (ax + bx) / 2, cy = (ay + by) / 2 + sag * 2, pts = [];
        for (let i = 0; i <= 16; i++) { const t = i / 16, u = 1 - t; pts.push({ x: u * u * ax + 2 * u * t * cx + t * t * bx, y: u * u * ay + 2 * u * t * cy + t * t * by }); }
        return pts;
    }
    // Every frame: wires flying and clamped, the arcs, the ticks, the meter
    _conductorTick(time, delta) {
        const C = this._conductorCfg(), T = this.TILE_SIZE, ADD = Phaser.BlendModes.ADD;
        const g = this._condG?.active ? this._condG : (this._condG = this.add.graphics().setDepth(1.5));
        const gl = this._condGL?.active ? this._condGL : (this._condGL = this.add.graphics().setDepth(1.49).setBlendMode(ADD));
        g.clear(); gl.clear(); this._condLights = [];
        const pool = this._condPool = (this._condPool || []).filter(i => i.active); let used = 0;
        const glow = (x, y, s, col, a) => { const i = pool[used] || (pool[used] = this.add.image(0, 0, 'vfx_glow').setBlendMode(ADD).setDepth(1.55)); used++; i.setPosition(x, y).setScale(s).setTint(col).setAlpha(a).setVisible(true); };
        const wires = this._condWires ||= [];
        const wield = this._condWielding();
        if (this.equippedWeapons?.lightning !== 'conductor' || !this.player?.active) { for (const w of wires.splice(0)) this._condSnap(w); }   // the wires stay on you through an element switch, so you can set the web and fight with something else; only unequipping it lets go
        // upkeep: snapped, dead (the clamp jumps), arriving
        for (const w of [...wires]) {
            const e = w.e;
            if (!e.sprite?.active || e.health <= 0) {
                const x = e._condPx ?? e.sprite?.x, y = e._condPy ?? e.sprite?.y;
                const next = this._condTargets().filter(o => o.sprite?.active && o.health > 0 && !wires.some(q => q.e === o) && Math.hypot(o.sprite.x - x, o.sprite.y - y) < C.JUMP_R * T)
                    .sort((a, b) => Math.hypot(a.sprite.x - x, a.sprite.y - y) - Math.hypot(b.sprite.x - x, b.sprite.y - y))[0];
                if (next) { Object.assign(w, { e: next, t0: time, on: false, bite: 0 }, this._condThrow(x, y, next)); this._condSpark(x, y, 12); }   // the clamp slings on to the next one
                else { wires.splice(wires.indexOf(w), 1); if (x != null) this._condSpark(x, y, 8); }
                continue;
            }
            e._condPx = e.sprite.x; e._condPy = e.sprite.y;
            if (this._phasedOut(e) || Math.hypot(e.sprite.x - this.player.x, e.sprite.y - this.player.y) > C.SNAP * T || (w.on && time - (w.losAt || 0) > 120 && (w.losAt = time) && !this._condClear(this.player.x, this.player.y, e.sprite.x, e.sprite.y))) { wires.splice(wires.indexOf(w), 1); this._condSnap(w); continue; }   // too far, or a wall or gate between
            if (!w.on) {   // in flight: the clamp homes on its enemy, swinging out to one side and back, laying the cable where it goes
                const tx = e.sprite.x, ty = e.sprite.y - 4, step = C.SLING * Math.min(50, delta || 16) / 1000, d = Math.hypot(tx - w.bx, ty - w.by);
                if (d > step + 4) {
                    w.bx += (tx - w.bx) / d * step; w.by += (ty - w.by) / d * step;
                    const u = Phaser.Math.Clamp(1 - Math.hypot(tx - w.bx, ty - w.by) / w.d0, 0, 1), L = Math.hypot(tx - w.lx, ty - w.ly) || 1, o = w.side * Math.sin(u * Math.PI) * Math.min(36, w.d0 * 0.2);
                    w.hx = w.bx - (ty - w.ly) / L * o; w.hy = w.by + (tx - w.lx) / L * o;
                    w.path.push({ x: w.hx, y: w.hy, t: time });
                } else { w.hx = tx; w.hy = ty; }
            }
            if (!w.on && w.hx === e.sprite.x && w.hy === e.sprite.y - 4) {   // it bites
                w.on = true; w.bite = time; w.relax = null;
                this.cameras.main.shake(50, 0.0015);
                WeaponSystem.zapFlare(this, e.sprite.x, e.sprite.y - 4, 'y', 1.5);
                this._condHit(e, C.LATCH_DMG * this.damageScaling);
                this._condDaze(e, C.LAND_DAZE * this._condWebMul(wires.filter(q => q.on)).daze);
                if (this._dmgLanded) this.gainUltCharge(this.ultChargePerLightningHit * 0.6, 'lightning');
                this._condSpark(e.sprite.x, e.sprite.y - 4, 14);
                this._vfxFlash?.(e.sprite.x, e.sprite.y, 40, C.COL, 220, 0.8);
            }
        }
        const on = wires.filter(w => w.on && w.e.sprite?.active && w.e.health > 0);
        // the rings: oldest clamp first, each on to the nearest free one it arcs to; two or more make a circuit through you
        const pairs = this._condPairs = [], rings = this._condRings = [], free = [...on].sort((a, b) => a.t0 - b.t0);
        const arcs = (a, b) => { const p = a.e.sprite, q = b.e.sprite; return Math.hypot(p.x - q.x, p.y - q.y) <= C.ARC_R * T && this._condClear(p.x, p.y, q.x, q.y); };
        for (const w of on) { w.was = w.closed; w.closed = false; w.ring = null; w.tap = false; w.hot = 1; }
        while (free.length) {
            const chain = [free.shift()];
            for (;;) {
                const last = chain[chain.length - 1].e.sprite;
                let best = null, bd = Infinity;
                for (const q of free) { const d = Math.hypot(q.e.sprite.x - last.x, q.e.sprite.y - last.y); if (d < bd && arcs(chain[chain.length - 1], q)) { bd = d; best = q; } }
                if (!best) break;
                chain.push(best); free.splice(free.indexOf(best), 1);
            }
            if (chain.length < 2) continue;
            const hot = C.CIRCUIT + C.RING_STEP * (chain.length - 2);
            rings.push(chain);
            chain.forEach((w, i) => { w.closed = true; w.ring = chain; w.hot = hot; w.tap = i > 0 && i < chain.length - 1; if (i) pairs.push([chain[i - 1], w]); });
        }
        // Amped is earned through the circuit: a live or insulated clamp holds it while its loop is closed (an insulator
        // keeps it for INS_SC after), a capacitor never does, so reactions for your other elements come from building the loop
        for (const w of on) if (w.closed && w.mode !== 'cap' && w.e.health > 0) this._condSC(w.e, w.mode === 'ins' ? C.INS_SC : 700);
        if (on.some(w => w.closed && !w.was)) {   // a loop just closed
            for (const w of on) if (w.closed && !w.was) { this._condSpark(w.e.sprite.x, w.e.sprite.y - 4, 12); WeaponSystem.zapFlare(this, w.e.sprite.x, w.e.sprite.y - 4, 'w', 1.5); }
            if (!on.some(w => w.was)) this.showStatusText(this.player.x, this.player.y - 30, 'CIRCUIT', '#fff08a');
        }
        const big = Math.max(0, ...rings.map(r => r.length));   // a ring grown: say how big
        if (big > 2 && big > (this._condRingMax || 0)) this.showStatusText(this.player.x, this.player.y - 30, `CIRCUIT x${big}`, '#fff08a');
        this._condRingMax = big;
        // the lines that hurt what they cross: each wire, and arcs between wired enemies close enough
        const { x: sx, y: sy } = this._condTip(), segs = [];
        for (const w of wires) {
            const e = w.e; if (!e.sprite?.active) continue;
            const ex = e.sprite.x, ey = e.sprite.y - 4, hx = w.on ? ex : w.hx, hy = w.on ? ey : w.hy;
            const plucked = time - (w.pluck || -1e9) < 160, surge = w.bite ? (time - w.bite) / 220 : 2;
            let pts;
            if (!w.on) {   // in flight: the cable runs from the staff along the path the clamp flew, shivering behind it
                pts = this._condResample([{ x: sx, y: sy }, ...w.path, { x: hx, y: hy }], 17);
                const droop = Math.min(20, (time - w.t0) * 0.05);   // slack: the cable sags into a belly as it pays out
                pts.forEach((p, i) => { if (!i || i === 16) return; const t = i / 16, wv = 2.5 * Math.sin(t * 12 - time / 30) * Math.sin(t * Math.PI); p.x += wv; p.y += wv * 0.5 + droop * Math.sin(t * Math.PI); });
                w.relax = pts.map(p => ({ ...p }));
            } else {
                pts = this._condCurve(sx, sy, hx, hy, w.seed, time, C);
                if (w.relax && surge < 1) { const t = 1 - (1 - surge) ** 3; pts = pts.map((p, i) => ({ x: w.relax[i].x + (p.x - w.relax[i].x) * t, y: w.relax[i].y + (p.y - w.relax[i].y) * t })); }   // it snaps taut
            }
            this._condCable(g, gl, pts, time, w.seed, !w.on ? 0.5 : plucked ? 1.8 : w.tap ? 0.25 : w.closed ? 1.5 : 1, C.MCOL[w.mode], w.tap ? 0.32 : 1);   // a tap: still connected, faded see-through (the ring's current runs through the arcs, not along it)
            w.pts = pts;   // (a current rides it: _condPulse)
            if (w.closed && !w.tap) Conductor.cable(this, pts, 'w', 1.2, 0.55 + 0.25 * Math.sin(time / 70), 1.5, false);   // a ring's legs run white-hot
            if (w.on) {
                if (!w.tap) for (let q = 0; q < 2; q++) {   // current flowing out along it
                    const t = ((time / 520) + q / 2 + w.seed) % 1, p = pts[Math.floor(t * (pts.length - 1))];
                    glow(p.x, p.y, 0.16, C.COL, 0.9); glow(p.x, p.y, 0.06, 0xffffff, 1);
                }
                // the clamp, biting the way the wire comes in, in a glow of current
                Conductor.clamp(this, ex, ey, Conductor.dir8(ex - pts[13].x, ey - pts[13].y));
                glow(ex, ey, 0.28 + 0.05 * Math.sin(time / 60), C.COL, 0.55);
                if (Math.random() < 0.12) this._condSpark(ex, ey, 1);
                this._condLights.push({ x: ex, y: ey, r: 34, color: C.COL, a: 0.6, g: 0.25 }, { x: pts[8].x, y: pts[8].y, r: 26, color: C.COL, a: 0.35, g: 0.15 });
                if (!w.tap) { pts.hot = w.closed ? w.hot : 1; segs.push(pts); }
                const bm = e._big ? ey : e.sprite.y + (0.72 - (e.sprite.originY ?? 0.5)) * (e.sprite.displayHeight || 38) - 2;   // its body's middle: a slime sits low in its frame
                if (w.mode === 'cap') this._condCapDraw(gl, glow, w, ex, bm, time);
                else if (w.mode === 'ins') this._condInsDraw(gl, glow, ex, bm, time);
                else this._condLiveDraw(gl, glow, ex, bm, time);
                if (surge < 1) {   // the bite: a white surge rushing down the line to the clamp
                    const p = pts[Math.floor(Math.min(1, surge * 1.6) * (pts.length - 1))];
                    Conductor.cable(this, pts, 'w', 3, 0.8 * (1 - surge), 1.5, false);
                    glow(p.x, p.y, 0.35, C.HOT, 1); glow(p.x, p.y, 0.12, 0xffffff, 1);
                }
            } else {   // the clamp in flight: a glowing copper barb, crackling, shedding sparks
                const a = time / 45;   // the clamp tumbling through the air
                Conductor.clamp(this, hx, hy, Math.floor(time / 45));
                glow(hx, hy, 0.3, C.COL, 0.8); glow(hx, hy, 0.1, 0xffffff, 1);
                this._strokeFork(gl, hx, hy, hx + Math.cos(a) * 14 + (Math.random() - 0.5) * 10, hy + Math.sin(a) * 14 + (Math.random() - 0.5) * 10, C.HOT, 0.9, 1, 0);
                this._condSpark(hx, hy, 1);
            }
        }
        if (on.length) glow(sx, sy, 0.2, C.COL, 0.7);
        const icons = this._condIcons ||= new Map();   // each clamp's icon, a badge at the left end of its enemy's health bar (above it, the current's damage numbers buried it)
        for (const w of on) {
            if (w.e._big) continue;
            let ic = icons.get(w);
            if (!ic?.active) icons.set(w, ic = this.add.image(0, 0, 'fx_storm', 'ic_live').setDepth(4.5));
            ic.setPosition(w.e.sprite.x - 20, w.e.sprite.y + (w.e._hpBarYOff || 0)).setVisible(w.e.sprite.visible).setFrame(Conductor.condBadge(w.mode, w.charge || 0));
        }
        for (const [w, ic] of icons) if (!on.includes(w) || w.e._big) { ic.destroy(); icons.delete(w); }
        for (const m of [...(this._condMisses || [])]) {   // a missed throw: out, slack on the floor, reeled back
            const age = time - m.t0, fly = m.L / C.SLING * 1000, lie = 220, reel = 300;
            if (age > fly + lie + reel) { this._condMisses.splice(this._condMisses.indexOf(m), 1); continue; }
            if (age <= fly) {
                const u = age / fly, o = m.side * Math.sin(u * Math.PI) * Math.min(30, m.L * 0.2);
                const bx = Math.cos(m.a) * m.L * u, by = Math.sin(m.a) * m.L * u;
                m.path.push({ x: bx - Math.sin(m.a) * o, y: by + Math.cos(m.a) * o });
            }
            let path = m.path.map(p => ({ x: p.x + sx, y: p.y + sy }));
            if (age > fly + lie) { const k = (age - fly - lie) / reel; path = path.slice(0, Math.max(1, Math.round(path.length * (1 - k)))); }   // reeling in
            const head = path[path.length - 1];
            if (path.length < 2) continue;
            const pts = this._condResample([{ x: sx, y: sy }, ...path.slice(1)], 17), droop = Math.min(26, age * 0.05);
            pts.forEach((p, i) => { p.y += droop * Math.sin(i / 16 * Math.PI) * (age > fly ? 1 : 0.6); });
            this._condCable(g, gl, pts, time, m.seed, 0.35, C.MCOL[m.mode]);
            const hx = pts[16].x, hy = pts[16].y;
            Conductor.clamp(this, hx, hy, age > fly ? Conductor.dir8(hx - pts[13].x, hy - pts[13].y) : Math.floor(time / 45));   // the clamp, tumbling, then lying where it fell
            if (age > fly && age < fly + 40) this._condSpark(hx, hy, 4);   // it hits the floor
        }
        for (const P of [...(this._condPulses || [])]) {   // currents: a big blob running the circuit
            const seg = P.route[P.i];
            const pts = !seg ? null : seg.w ? (seg.w.on && seg.w.e.sprite?.active ? (seg.back ? [...seg.w.pts].reverse() : seg.w.pts) : null)
                : (seg.a.sprite?.active && seg.b.sprite?.active ? [{ x: seg.a.sprite.x, y: seg.a.sprite.y - 4 }, { x: seg.b.sprite.x, y: seg.b.sprite.y - 4 }] : null);
            if (!pts) { this._condPulses.splice(this._condPulses.indexOf(P), 1); continue; }
            let L = 0; for (let i = 1; i < pts.length; i++) L += Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y);
            P.d += C.PULSE_SPEED * Math.min(50, delta || 16) / 1000;
            let d = Math.min(P.d, L), x = pts[0].x, y = pts[0].y;
            for (let i = 1; i < pts.length; i++) { const sl = Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y); if (d <= sl) { const f = d / (sl || 1); x = pts[i - 1].x + (pts[i].x - pts[i - 1].x) * f; y = pts[i - 1].y + (pts[i].y - pts[i - 1].y) * f; break; } d -= sl; x = pts[i].x; y = pts[i].y; }
            P.trail.unshift({ x, y }); if (P.trail.length > 6) P.trail.pop();
            P.trail.forEach((q, k) => glow(q.x, q.y, 0.26 - k * 0.035, C.COL, 0.5 - k * 0.07));
            glow(x, y, 0.36, C.HOT, 0.6);
            WeaponSystem.zap(this, `zap${(this.game.loop.frame >> 1) & 1}_y`, x, y, 0, 1, 4.3, 1.2, WeaponSystem.vr() < 0.5);   // the current itself: a strike racing down the wire, crackling
            for (let k = 0; k < 2; k++) { const fa = Math.random() * Math.PI * 2; this._strokeFork(gl, x, y, x + Math.cos(fa) * 12, y + Math.sin(fa) * 12, 0xffffff, 0.9, 1, 0); }
            if (Math.random() < 0.5) this._condSpark(x, y, 1);
            if (P.d >= L) {   // reached the end of this stretch: if it's an enemy, it's hit
                const hit = seg.w ? (seg.back ? null : seg.w.e) : seg.b;
                if (hit && hit.health > 0 && !P.hit.has(hit)) {
                    P.hit.add(hit);
                    const web = this._condWebMul(on);
                    this._condHit(hit, C.PULSE_DMG * web.dmg * this.damageScaling);
                    this._condDaze(hit, C.PULSE_DAZE * web.daze);
                    if ((this._condWires || []).find(q => q.e === hit)?.mode !== 'cap') this._condSC(hit, C.PULSE_SC);   // a current renews the mark on what it runs through (capacitors aside)
                    WeaponSystem.zapFlare(this, hit.sprite.x, hit.sprite.y - 4, 'y', 1.8);
                    this._vfxFlash?.(hit.sprite.x, hit.sprite.y, 60, C.COL, 240, 0.9);
                    this._condSpark(hit.sprite.x, hit.sprite.y - 4, 10);
                }
                P.i++; P.d = 0;
                if (P.i >= P.route.length) this._condPulses.splice(this._condPulses.indexOf(P), 1);
            }
        }
        for (const [wa, wb] of pairs) {   // the arcs: raw lightning between the clamps, closing the loop
            const a = wa.e.sprite, b = wb.e.sprite, pts = this._arcPath(a.x, a.y - 4, b.x, b.y - 4, 9, 0.14);
            for (let i = 1; i < pts.length - 1; i += 2) glow(pts[i].x, pts[i].y, 0.3, C.COL, 0.35);   // its light along the floor
            this._strokeFork(gl, a.x, a.y - 4, b.x, b.y - 4, 0xffffff, 0.95, 2, 0);
            pts.hot = wb.hot; segs.push(pts);
        }
        // who's touching a line (not a wired one)
        const wired = new Set(on.map(w => w.e)), touch = new Map();
        const targets = this._condTargets();
        for (const pts of segs) for (const e of targets) {
            if (wired.has(e) || !e.sprite?.active || e.health <= 0) continue;
            for (let i = 1; i < pts.length; i++) {
                const p = pts[i - 1], q = pts[i], dx = q.x - p.x, dy = q.y - p.y, t = Phaser.Math.Clamp(((e.sprite.x - p.x) * dx + (e.sprite.y - 4 - p.y) * dy) / (dx * dx + dy * dy || 1), 0, 1);
                if (Math.hypot(p.x + dx * t - e.sprite.x, p.y + dy * t - e.sprite.y + 4) < C.CROSS_R * T) { touch.set(e, (touch.get(e) || 0) + pts.hot); break; }   // a closed loop's lines count for more
            }
        }
        for (const e of touch.keys()) {   // shocked: it crackles where the line runs through it
            for (let k = 0; k < 2; k++) { const fa = Math.random() * Math.PI * 2; this._strokeFork(gl, e.sprite.x, e.sprite.y - 4, e.sprite.x + Math.cos(fa) * 13, e.sprite.y - 4 + Math.sin(fa) * 13, 0xffffff, 0.9, 1, 0); }
            glow(e.sprite.x, e.sprite.y - 4, 0.22, C.COL, 0.6);
        }
        for (let i = used; i < pool.length; i++) pool[i].setVisible(false);
        this._condTouch = touch;
        for (const w of on) if (w.mode === 'cap') {   // capacitors charge, then burst with what they stored
            w.charge = (w.charge || 0) + (delta || 16) / C.CAP_MS;
            if (w.charge >= 1) this._condCapBurst(w);
        }
        this._condHoverDraw(gl, on, time);
        // the bite
        if (on.length && time - (this._condTickAt || 0) >= C.TICK) {
            this._condTickAt = time;
            const web = this._condWebMul(on).dmg * this.damageScaling;   // insulators damp the whole web
            let landed = 0;
            this._noFlash = true;   // it ticks constantly: a white flash each time would wash the pack out
            try {
                for (const w of on) {
                    if (w.e.health <= 0) continue;
                    const cur = C.WIRE_DMG * (w.closed ? w.hot : 1);
                    if (w.mode === 'cap') { w.store += cur * this._condWebMul(on).dmg; continue; }   // banked, not taken
                    this._condHit(w.e, cur * web * (w.mode === 'ins' ? C.INS_TAKE : 1));
                    if (this._dmgLanded) landed++;
                }
                for (const [e, n] of touch) if (e.health > 0) { this._condHit(e, C.CROSS_DMG * Math.min(2 * C.CIRCUIT, n) * web); if (this._dmgLanded) { landed++; this._condSpark(e.sprite.x, e.sprite.y - 4, 3); } }
            } finally { this._noFlash = false; }
            if (landed) {
                this.gainUltCharge(this.ultChargePerLightningHit * 0.1 * Math.min(6, landed), 'lightning');
            }
        }
        // R toggled on: the currents keep coming, one each time it's ready; off by itself once no live wire is left (or the weapon's put away)
        if (this._condAuto) {
            const live = (this._condWires || []).some(w => w.on && w.e.sprite?.active && w.e.health > 0);
            if (!wield || !live) { this._condAuto = false; if (wield && this.player?.active) this.showStatusText(this.player.x, this.player.y - 28, 'CURRENT OFF', '#c8b060'); }
            else if (!this._pauseMenuOpen) this._conductorOverload(true);
        }
        // the meter over you
        if (!wield) { this._condBar?.destroy(); this._condBar = null; this._condModeIcon?.destroy(); this._condModeIcon = null; return; }
        const bar = (this._condBar?.active ? this._condBar : (this._condBar = this.add.graphics().setDepth(6))).clear();
        UIKit.rBar(bar, this.player.x - 18, this.player.y - 17, 40, Math.min(1, (time - (this._condPulseAt || 0)) / C.PULSE_CD), { col: C.COL, hot: C.HOT, dark: 0x14100a, time });   // R: the current, filling back
        if (this._condAuto) bar.lineStyle(1, C.HOT, 0.6 + 0.4 * Math.sin(time * 0.012)).strokeRect(this.player.x - 20, this.player.y - 19, 44, 8);   // lit while it's on
        const ix = this.player.x + 31, iy = this.player.y - 14, mode = this._condMode || 'live', mc = C.MCOL[mode];   // what the next clamp is
        bar.fillStyle(0x14100a, 0.85).fillRect(ix - 8, iy - 7, 16, 14);
        bar.lineStyle(1, mc, 1).strokeRect(ix - 8, iy - 7, 16, 14);
        const mi = this._condModeIcon?.active ? this._condModeIcon : (this._condModeIcon = this.add.image(0, 0, 'fx_storm', 'ic_live').setDepth(6.1));   // its icon (the capacitor's shown full)
        mi.setFrame(Conductor.condBadge(mode, 1)).setPosition(ix, iy);
    }
    // R: on (a current at once, then one each time it's ready: _conductorTick) or off. It won't go on with no wire out.
    _conductorToggle() {
        if (this._condAuto) { this._condAuto = false; Sfx.play(this, 'click'); return; }
        if (!(this._condWires || []).some(w => w.on && w.e.sprite?.active && w.e.health > 0)) { this._conductorOverload(); return; }   // (says NO WIRES OUT)
        this._condAuto = true; Sfx.play(this, 'click');
        this._conductorOverload(true);
    }
    // R: a current down the wire nearest your cursor's direction (ready every PULSE_CD)
    _conductorOverload(quiet = false) {
        const C = this._conductorCfg(), now = this.time.now, cam = this.cameras.main, p = this.input.activePointer, ap = this._aim?.(p) || p;
        const { x: px, y: py } = this._condTip(), aim = Math.atan2(ap.y + cam.scrollY - py, ap.x + cam.scrollX - px);
        const best = (this._condWires || []).filter(w => w.on && w.e.sprite?.active && w.e.health > 0)
            .map(w => [w, Math.abs(Phaser.Math.Angle.Wrap(Math.atan2(w.e.sprite.y - py, w.e.sprite.x - px) - aim))]).sort((a, b) => a[1] - b[1])[0];
        if (!best) { if (!quiet) { this.showStatusText(this.player.x, this.player.y - 28, 'NO WIRES OUT', '#c8b060'); Sfx.play(this, 'deny'); } return; }
        if (now - (this._condPulseAt || 0) < C.PULSE_CD) return;
        this._condPulseAt = now; this._gearFiredAt = now;
        this._condPulse(best[0]);
    }

}
