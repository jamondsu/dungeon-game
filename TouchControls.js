// ═══════════════════════════════════════════════════════════════════════════
// TouchControls.js — playing on a phone or a tablet, held sideways.
//
// The left thumb moves you: a stick that appears where it lands (on the left of the screen).
// The right thumb aims and attacks: held, the attack keeps coming the way the stick points, as a
// held mouse button does; held without pushing, it goes for the nearest enemy (a quick tap, one
// attack at it). Round it, the buttons press the keys you'd press (Settings.js), so whatever is
// bound to a key does just what it does on a keyboard: DASH, the weapon's ability, the ult (held,
// cosmic's charge), the next element, the two gadgets, PAUSE.
//
// Only on a touch screen. localStorage touchControls = 'on' shows it anywhere, 'off' never.
// ═══════════════════════════════════════════════════════════════════════════
class TouchControls {
    static u(S) { return Math.min(1.3, Math.max(1, S.scale.height / 480)); }   // a little bigger on a big screen

    static on(scene) {
        let f = null; try { f = localStorage.getItem('touchControls'); } catch (e) {}
        const d = scene.sys.game.device;
        return f === 'on' || (f !== 'off' && d.input.touch && !d.os.desktop);
    }

    // A key pressed (or let go, or held: repeat) the way the keyboard sends it, so its Key and every handler on it see it as ever
    static key(name, down, repeat = false) {
        const kc = Phaser.Input.Keyboard.KeyCodes[name];
        if (!kc) return;
        const C = { SPACE: 'Space', SHIFT: 'ShiftLeft', ESC: 'Escape', TAB: 'Tab', ENTER: 'Enter', UP: 'ArrowUp', DOWN: 'ArrowDown', LEFT: 'ArrowLeft', RIGHT: 'ArrowRight', ONE: 'Digit1', TWO: 'Digit2', THREE: 'Digit3', FOUR: 'Digit4' };
        const e = new KeyboardEvent(down ? 'keydown' : 'keyup', { cancelable: true, repeat, code: C[name] || (name.length === 1 ? 'Key' + name : name) });
        Object.defineProperty(e, 'keyCode', { get: () => kc });
        window.dispatchEvent(e);
    }

    // o.move: the four keys the stick holds (up, left, down, right); o.repeat: held, they repeat as a held key does. o.zig():
    // where you stand, for a game that steps one way at a time: pushed on a diagonal, it steps one way then the other (null: the
    // nearer of the two). o.aim: the right stick's home ({ x, y }), for a game that aims; o.direct(): a tap is for the world now.
    // o.hidden(): nothing new taken while it's true (a menu is up). o.slot(k): where the k-th small button goes. o.buttons: see draw().
    constructor(S, o) {
        this.S = S; this.o = o;
        this.u = TouchControls.u(S);
        this.R = 46 * this.u;   // a stick's reach
        this.btns = (o.buttons || []).map(b => ({ ...b, r: b.r * this.u }));
        this.mv = null; this.am = null; this.down = new Set(); this.zigH = false;
        this.dir = { x: 1, y: 0 }; this.dist = 3; this.target = null;
        // where the right stick points, standing in for the mouse: what the game reads as the cursor
        this.vp = { id: -1, pid: null, x: 0, y: 0, worldX: 0, worldY: 0, button: 0, isDown: false, wasTouch: true,
                    leftButtonDown() { return this.isDown; }, rightButtonDown: () => false, middleButtonDown: () => false };
        const I = S.input;
        if (I.manager.pointersTotal < 5) I.addPointer(5 - I.manager.pointersTotal);   // a thumb on each stick and one on a button
        if (o.aim) Object.defineProperty(I, 'activePointer', { get: () => this.vp, configurable: true });
        this.g = S.add.graphics().setScrollFactor(0).setDepth(45);
        I.on('pointerdown', this._down, this);
        I.on('pointermove', this._move, this);
        I.on('pointerup', this._up, this);
        I.on('pointerupoutside', this._up, this);
        S.events.on('update', this._tick, this);
        S.events.once('shutdown', this.destroy, this);
    }

    destroy() {
        const S = this.S, I = S.input;
        I.off('pointerdown', this._down, this); I.off('pointermove', this._move, this);
        I.off('pointerup', this._up, this); I.off('pointerupoutside', this._up, this);
        S.events.off('update', this._tick, this);
        if (this.o.aim) delete I.activePointer;
        for (const k of this.down) TouchControls.key(k, false);
        for (const b of this.btns) if (b.held) TouchControls.key(b.held, false);
        this.down.clear();
    }

    // The game's own pointer handlers ask this first: the stand-in cursor for the aiming thumb, the finger itself where a tap is
    // meant for the world (a Displacer's drop, the Fracture core's notes), and nothing for a thumb on a stick or a button.
    aimPointer(p) { return p.id === this.direct ? p : p.id === this.vp.pid ? this.vp : null; }

    _btnAt(p) {
        for (const b of this.btns) if (b.vis && Math.hypot(p.x - b.x, p.y - b.y) <= b.r + 8 * this.u) return b;
        return null;
    }

    _down(p, over) {
        const S = this.S, o = this.o;
        let role = null;
        const ui = (over || []).some(g => g.scrollFactorX === 0 && g.visible !== false);   // a menu, a panel: theirs
        if (!o.hidden?.() && !ui) {
            const b = this._btnAt(p);
            if (b) {
                role = 'btn';
                b.pid = p.id; b.t0 = Date.now();
                b.held = b.key?.() || null;
                if (b.held) TouchControls.key(b.held, true);
            } else if (p.x < S.scale.width * 0.4 && !this.mv) {
                role = 'move';
                this.mv = { id: p.id, ox: p.x, oy: p.y, dx: 0, dy: 0, mag: 0 };
            } else if (o.aim && o.direct?.()) {
                role = 'direct';
            } else if (o.aim && !this.am) {
                role = 'aim';
                this.am = { id: p.id, ox: p.x, oy: p.y, dx: 0, dy: 0, mag: 0 };
                this.target = this._nearest();
                this._aimTick();
            }
        }
        // (a pointer's id comes round again for the next touch: only the touch that took a role keeps it)
        if (role === 'aim') { this.vp.pid = p.id; this.vp.isDown = true; } else if (this.vp.pid === p.id) this.vp.pid = null;
        this.direct = role === 'direct' ? p.id : this.direct === p.id ? null : this.direct;
    }

    _move(p) {
        for (const s of [this.mv, this.am]) {
            if (!s || s.id !== p.id) continue;
            const dx = p.x - s.ox, dy = p.y - s.oy, d = Math.hypot(dx, dy) || 1;
            s.mag = Math.min(1, d / this.R);
            if (d > 10 * this.u) { s.dx = dx / d; s.dy = dy / d; } else s.mag = 0;
        }
        if (this.am?.id === p.id) this._aimTick();
    }

    _up(p) {
        if (this.mv?.id === p.id) this.mv = null;
        if (this.am?.id === p.id) {
            this.am = null; this.vp.isDown = false;
            if (p.upElement !== this.S.sys.game.canvas) this.S.isPointerDown = false;   // let go off the screen: the game's own pointerup never came
        }
        for (const b of this.btns) {
            if (b.pid !== p.id) continue;
            b.pid = null;
            const k = b.held; b.held = null;
            if (k) setTimeout(() => TouchControls.key(k, false), Math.max(0, 60 - (Date.now() - b.t0)));   // held a frame or two at least: a key read each frame sees it
        }
    }

    // the nearest enemy on screen
    _nearest() {
        const S = this.S, W = S.scale.width, H = S.scale.height, px = S._shotX?.(), py = S._shotY?.();
        let best = null, bd = Infinity;
        for (const e of S.enemies || []) {
            const sp = e.sprite;
            if (!sp?.active || !sp.visible || sp.alpha < 0.2 || e.health <= 0) continue;
            const sx = S._scrX(sp.x), sy = S._scrY(sp.y);
            if (sx < 0 || sy < 0 || sx > W || sy > H) continue;
            const d = Math.hypot(sp.x - px, sp.y - py);
            if (d < bd) { bd = d; best = e; }
        }
        return best;
    }

    // Where the cursor stands in for, every frame (the camera follows you): the way the right stick points, or the enemy it's
    // after, or (let go) the way you're walking. Kept as the mouse would leave it: pointerX/Y and the world point under it.
    _aimTick() {
        const S = this.S, A = this.am, v = this.vp, T = S.TILE_SIZE, cam = S.cameras.main;
        if (!S.player?.active || !cam) return;
        const px = S._scrX(S._shotX()), py = S._scrY(S._shotY()), z = T * cam.zoom;
        if (A && A.mag > 0) { this.dir = { x: A.dx, y: A.dy }; this.dist = 1.5 + A.mag * 5.5; this.target = null; }
        else if (A) { if (!this.target?.sprite?.active || this.target.health <= 0) this.target = this._nearest(); }
        else if (this.mv?.mag > 0) { this.dir = { x: this.mv.dx, y: this.mv.dy }; this.dist = 3; this.target = null; }
        const t = this.target?.sprite?.active && this.target.health > 0 ? this.target.sprite : null;
        if (t) {
            const tx = S._scrX(t.x), ty = S._scrY(t.y), d = Math.hypot(tx - px, ty - py) || 1;
            this.dir = { x: (tx - px) / d, y: (ty - py) / d }; this.dist = d / z;
        }
        v.x = px + this.dir.x * this.dist * z; v.y = py + this.dir.y * this.dist * z;
        const a = S._aim(v);
        v.worldX = a.x + cam.scrollX; v.worldY = a.y + cam.scrollY;
        S.pointerX = a.x; S.pointerY = a.y;
    }

    // The keys the left stick holds right now
    _moveTick() {
        const M = this.mv, o = this.o, want = new Set();
        if (M && M.mag > 0) {
            const [up, left, down, right] = o.move, D = 0.38;   // (sin 22.5°: eight ways)
            const v = M.dy < -D ? up : M.dy > D ? down : null, h = M.dx < -D ? left : M.dx > D ? right : null;
            if (v && h && o.zig) {
                const at = o.zig(), now = Date.now();
                if (at === null) want.add(Math.abs(M.dy) > Math.abs(M.dx) ? v : h);
                else {
                    if (at !== this.zigAt || now - this.zigT > 240) { this.zigAt = at; this.zigT = now; this.zigH = !this.zigH; }   // stepped (or stuck): the other way now
                    want.add(this.zigH ? h : v);
                }
            } else { if (v) want.add(v); if (h) want.add(h); }
        }
        const now = Date.now();
        for (const k of this.down) if (!want.has(k)) { this.down.delete(k); TouchControls.key(k, false); }
        for (const k of want) if (!this.down.has(k)) { this.down.add(k); TouchControls.key(k, true); this.repAt = now + 350; }
        if (o.repeat && this.down.size && now >= this.repAt) { this.repAt = now + 130; for (const k of this.down) TouchControls.key(k, true, true); }
    }

    _tick() {
        this._moveTick();
        if (this.o.aim) this._aimTick();
        this.draw();
    }

    // Each button: at x, y (or slot: the next of o.slot(k)), r; key() the key it presses (a name Phaser knows); show() whether it's
    // there; icon() [texture, frame, scale] or label() its words; fill() a ring round it filling (an ult's charge), cool() a dark
    // sweep over it (a gadget recharging).
    draw() {
        const S = this.S, g = this.g, P = UIKit.PALETTE, hid = !!this.o.hidden?.(), u = this.u, TAU = Math.PI * 2, TOP = -Math.PI / 2;
        g.clear();
        const stick = (s, home, accent) => {
            const x = s ? s.ox : home.x, y = s ? s.oy : home.y, R = this.R;
            g.fillStyle(0x000000, s ? 0.3 : 0.18); g.fillCircle(x, y, R);
            g.lineStyle(3, P.iron, s ? 0.9 : 0.45); g.strokeCircle(x, y, R);
            g.lineStyle(1.5, accent, s ? 0.7 : 0.3); g.strokeCircle(x, y, R - 4);
            const kx = x + (s ? s.dx * s.mag * R : 0), ky = y + (s ? s.dy * s.mag * R : 0), r = 21 * u;
            g.fillStyle(0x000000, 0.4); g.fillCircle(kx + 1, ky + 3, r);
            g.fillStyle(s ? P.bgHover : P.bgRaised, s ? 0.95 : 0.55); g.fillCircle(kx, ky, r);
            g.fillStyle(0xffffff, s ? 0.1 : 0.05); g.fillRect(kx - r * 0.5, ky - r + 4, r, 2);
            g.lineStyle(2.5, P.iron, s ? 1 : 0.6); g.strokeCircle(kx, ky, r);
            g.lineStyle(1, accent, s ? 0.9 : 0.4); g.strokeCircle(kx, ky, r - 3);
        };
        if (!hid || this.mv) stick(this.mv, { x: 110 * u, y: S.scale.height - 100 * u }, P.accentGreen);
        if (this.o.aim && (!hid || this.am)) stick(this.am, this.o.aim, S._ultCfg?.().COLORS?.[S.currentElement] ?? P.accentRed);
        let k = 0;
        for (const b of this.btns) {
            b.vis = !hid && (b.show ? !!b.show() : true);
            if (b.slot && b.vis) Object.assign(b, this.o.slot(k++));   // the small ones close up, whichever are there
            const ic = b.vis && b.icon?.(), icon = ic && ic[0] ? ic : null, label = b.vis && !icon ? b.label?.() ?? '' : '';
            const ik = icon ? icon.join('/') : '';
            if (ik !== b.ik) {   // a different icon now (the element changed, a gadget came off cooldown...)
                b.ik = ik; b.img?.destroy(); b.img = null;
                if (icon && S.textures.exists(icon[0])) {
                    b.img = S.add.sprite(b.x, b.y, icon[0], icon[1] ?? '0').setScrollFactor(0).setDepth(45.5).setScale(icon[2] * u);
                    if (icon[1] === undefined && S.anims.exists(icon[0])) b.img.play(icon[0]);
                }
            }
            if (!b.txt) b.txt = S.add.text(b.x, b.y, '', { fontSize: Math.round(b.r * 0.5) + 'px', fontFamily: UIKit.FONT.title, fontStyle: 'bold', color: UIKit.CSS.textHi, stroke: '#000', strokeThickness: 3 }).setOrigin(0.5).setScrollFactor(0).setDepth(46);
            b.txt.setVisible(b.vis).setText(label);
            b.img?.setVisible(b.vis);
            if (!b.vis) continue;
            const on = b.pid != null, y = b.y + (on ? 1.5 : 0), r = b.r, accent = b.accent?.() ?? P.accentBlue;
            g.fillStyle(0x000000, 0.45); g.fillCircle(b.x + 1, y + 3, r);
            g.fillStyle(on ? P.bgHover : P.bgRaised, 0.8); g.fillCircle(b.x, y, r);
            g.fillStyle(0xffffff, on ? 0.1 : 0.06); g.fillRect(b.x - r * 0.45, y - r + 4, r * 0.9, 2);
            g.lineStyle(3, P.iron, 1); g.strokeCircle(b.x, y, r);
            g.lineStyle(on ? 2 : 1, accent, on ? 1 : 0.6); g.strokeCircle(b.x, y, r - 4);
            const f = b.fill?.();
            if (f != null) {
                const full = f >= 1;
                g.lineStyle(3, accent, 0.22); g.strokeCircle(b.x, y, r + 4);
                if (f > 0) { g.lineStyle(full ? 4 : 3, accent, full ? 0.75 + 0.25 * Math.sin(S.time.now / 180) : 0.9); g.beginPath(); g.arc(b.x, y, r + 4, TOP, TOP + Math.min(1, f) * TAU, false); g.strokePath(); }
            }
            const c = b.cool?.() || 0;
            if (c > 0) { g.fillStyle(0x000000, 0.55); g.slice(b.x, y, r - 2, TOP, TOP + c * TAU, false); g.fillPath(); }
            b.img?.setPosition(b.x, y).setAlpha(c > 0 ? 0.45 : 1);
            b.txt.setPosition(b.x, y);
        }
    }

    // ── THE DUNGEON'S ────────────────────────────────────────────────────────
    // GameScene.createTouchControls: the right stick a thumb's rest from the corner, the four big buttons on an arc round it
    // (DASH, the weapon's ability, the ult, the next element), the small ones further out (the gadgets, the weapon's second
    // key, Riyal's Call), PAUSE and the Training Ground's panel in the top corner.
    static game(S) {
        const W = S.scale.width, H = S.scale.height, u = TouchControls.u(S);
        const home = { x: W - 100 * u, y: H - 96 * u };
        const at = (deg, R) => ({ x: home.x + Math.cos(deg * Math.PI / 180) * R * u, y: home.y + Math.sin(deg * Math.PI / 180) * R * u });
        const tex = {};   // (an icon's texture key, looked up once)
        const K = id => () => Settings.key(id), el = () => S.currentElement, col = () => S._ultCfg?.().COLORS?.[el()];
        const has = e => { try { return e === 'fire' || (e === 'ice' ? !!S.tutorialIceUnlocked || localStorage.getItem('unlocked_ice') === 'true' || localStorage.getItem('iceTutorialComplete') === '1' : localStorage.getItem('unlocked_' + e) === 'true'); } catch (x) { return false; } };   // (what switchToElement lets you hold)
        const els = () => ['fire', 'ice', 'lightning', 'cosmic'].filter(has);
        const next = () => { const a = els(); return a[(a.indexOf(el()) + 1) % a.length]; };
        const fill = () => Math.min(1, (S.ultGems?.[el()] || 0) / (S.ultChargeMax || 100));
        const slot = i => (S._gadgetSlots || [])[i];
        const gadget = i => ({
            slot: true, r: 22, show: () => !!slot(i), key: K(i ? 'gadget2' : 'gadget1'),
            icon: () => [tex['g_' + slot(i)] ??= ShopScene.gadgetIcon(S, slot(i)), undefined, 1.2],
            cool: () => { const d = S._gadgetDefs?.()[slot(i)]; return d ? S.gadgetCooldownLeft(slot(i)) / d.cooldown : 0; },
            accent: () => S._gadgetDefs?.()[slot(i)]?.color,
        });
        return new TouchControls(S, {
            move: ['up', 'left', 'down', 'right'].map(id => Settings.key(id)),
            zig: () => S._rtrial ? null : S.playerX + ',' + S.playerY,   // (the rhythm run: a step a push)
            aim: home, slot: k => at(190 + k * 24, 176),
            direct: () => !!(S.displacerPending?.() || S._isClickOnActiveWeakPoint?.()),
            hidden: () => !!(S._pauseMenuOpen || S._deathScreenActive),
            buttons: [
                // (the rhythm run: Space jumps there, Shift dashes)
                { ...at(180, 120), r: 31, label: () => 'DASH', key: () => Settings.key(S._rtrial ? 'cosmicDash' : 'dash') },
                { ...at(210, 120), r: 31, key: () => Settings.key(S._rtrial ? 'dash' : 'surge'), label: () => S._rtrial ? 'JUMP' : Settings.label(Settings.key('surge')),
                  icon: () => !S._rtrial && [MenuArt.iconSheet(S, S.equippedWeapons?.[el()]), undefined, 1.5], accent: col },
                { ...at(240, 120), r: 31, key: K('ult'), icon: () => ['ui_ultgem', `${el()}_${fill() >= 1 ? 'lit' : 'dark'}`, 2.4], fill, accent: col },
                { ...at(270, 120), r: 31, key: () => Settings.key(next()), show: () => els().length > 1,
                  icon: () => [tex['e_' + next()] ??= ShopScene.elementIcon(S, next()), undefined, 2.2], accent: () => S._ultCfg?.().COLORS?.[next()] },
                gadget(0), gadget(1),
                { slot: true, r: 22, label: () => Settings.label(Settings.key('detonate')), key: K('detonate'),
                  show: () => !!(S._condWielding?.() || (el() === 'fire' && S.equippedWeapons?.fire === 'ignition') || (el() === 'ice' && S.equippedWeapons?.ice === 'rimeguard')) },   // (the Rimeguard: held, the shield's up)
                { slot: true, r: 22, label: () => 'CALL', key: K('call'), show: () => TideMother.hasCall() && !S.isTutorial, accent: () => 0x5ed4c8 },
                { x: W - 34 * u, y: 74 * u, r: 20, label: () => 'II', key: () => 'ESC' },
                { x: W - 84 * u, y: 74 * u, r: 20, label: () => 'H', key: () => 'H', show: () => !!S.trainingRun },   // the Training Ground's panel
            ],
        });
    }

    // ── THE GARDEN'S (and the Underwell's, the Sky's) ─────────────────────────
    // The stick walks you (any way), E does whatever E does where you stand: sow, water, pick, fish, sit, the moonwell...
    // (everything else there has its own button already)
    static garden(S) {
        const W = S.scale.width, H = S.scale.height, u = TouchControls.u(S);
        return new TouchControls(S, {
            move: ['W', 'A', 'S', 'D'],
            hidden: () => !!(S._panelObjs || S._pack || S._leaving),
            buttons: [{ x: W - 92 * u, y: H - 100 * u, r: 36, label: () => 'E', key: () => 'E' }],
        });
    }

    // ── THE HALL OF REFLECTIONS' (MirrorTrial.js) ────────────────────────────
    // The stick steps you (up and down) and turns you (left and right), held, again and again. The shard in the middle (held:
    // raised), round it DASH, WIPE (held), MAP (held), MARK, the decoy and the sentry; the guide and the way out in the corner,
    // and AGAIN / ON when the run's over or the ending plays.
    static hall(S) {
        const W = S.scale.width, H = S.scale.height, u = TouchControls.u(S);
        const home = { x: W - 100 * u, y: H - 96 * u };
        const at = (deg, R) => ({ x: home.x + Math.cos(deg * Math.PI / 180) * R * u, y: home.y + Math.sin(deg * Math.PI / 180) * R * u });
        const kit = f => () => ['mt_kit', f, 3];
        const play = () => !S.ending && !S.caught && !S.escaped;
        return new TouchControls(S, {
            move: ['W', 'A', 'S', 'D'], zig: () => null, repeat: true,
            hidden: () => !!(S.reading || S.leaving),
            slot: k => at(195 + k * 30, 178),
            buttons: [
                { ...home, r: 36, label: () => 'SHARD', key: () => 'SPACE', show: play },
                { ...at(180, 104), r: 28, label: () => 'DASH', key: () => 'SHIFT', show: play },
                { ...at(225, 104), r: 28, label: () => 'WIPE', key: () => 'F', show: play },
                { ...at(270, 104), r: 28, label: () => 'MAP', key: () => 'TAB', show: play },
                { slot: true, r: 22, label: () => 'C', key: () => 'C', show: play },   // a mark on the pane
                { slot: true, r: 22, icon: kit('decoy'), key: () => 'Q', show: play },
                { slot: true, r: 22, icon: kit('sentry'), key: () => 'E', show: play },
                { ...home, r: 36, label: () => S.ending ? 'ON' : 'AGAIN', key: () => S.caught ? 'R' : 'ENTER', show: () => !play() },
                { x: W - 34 * u, y: 74 * u, r: 20, label: () => 'EXIT', key: () => 'ESC' },
                { x: W - 84 * u, y: 74 * u, r: 20, label: () => '?', key: () => 'H', show: play },
            ],
        });
    }
}
