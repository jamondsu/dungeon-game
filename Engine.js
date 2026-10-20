// ═════════════════════════════════════════════════════════════════════════════
// Engine.js — UIKit + ElementResist + Transitions, concatenated into ONE file.
//
// WHY THIS EXISTS
// These three started as separate files. That is the better structure, but it means
// three new files have to land in the project folder together, and a single missed
// copy makes index.html request a script that 404s — the global never defines, the
// first scene throws ReferenceError inside create(), and the canvas stays black with
// the real cause buried in the console. That failure already happened once.
//
// One file cannot be partially copied. index.html loads this instead of the three.
//
// ORDER MATTERS and is preserved below:
//   1. UIKit          — palette and widgets. Nothing depends on it at load time, but
//                       every scene calls into it during create().
//   2. ElementResist  — standalone table; CombatSystem.damageEnemy resolves through it.
//   3. Transitions    — reads UIKit.PALETTE when its functions RUN, not when it loads,
//                       so it only needs UIKit to exist by the first transition.
//
// EDITING: the split sources are still in the project as UIKit.js / ElementResist.js /
// Transitions.js. Edit those, then regenerate this file, or edit here and keep them in
// step. Do not load both this and the three separates — each defines the same consts
// and the second definition throws.
// Generated 2026-09-14
// ═════════════════════════════════════════════════════════════════════════════



// ╔═══════════════════════════════════════════════════════════════════════════╗
// ║  UIKit.js                                                                
// ╚═══════════════════════════════════════════════════════════════════════════╝


// ─────────────────────────────────────────────────────────────────────────────
// UIKit — shared visual language for every scene.
//
// WHY THIS EXISTS
// Before this file, each scene hand-rolled its own panels and buttons. The result
// drifted badly: TowerDefenseScene used fillRoundedRect 26 times (rounded panels,
// accent strokes, halos, hover redraws) while ShopScene, LevelSelectScene and HUD
// used flat hard-cornered add.rectangle with zero rounded rects and hover that only
// swapped a fill colour. The "nice" style already existed — it had just never been
// rolled out. Everything here is that style, extracted and pushed further.
//
// It also fixes a measured readability problem. The old palette shipped text at
// #2a2a3a (1.39:1), #223344 (1.51:1), #2a3a4a (1.68:1) and #334455 (1.96:1) against
// backgrounds like #080c14. Anything under about 2:1 is effectively not rendered.
// PALETTE below is contrast-checked; the dimmest text tone still clears 3:1.
//
// PERFORMANCE CONTRACT
// Animated accents are driven by Phaser TWEENS, never by per-frame graphics redraws.
// A tween mutates one property and the renderer handles the rest; a redraw re-runs
// path construction every frame. Scanlines are drawn ONCE into a static graphics
// object. Follow that rule when adding to this file — the game already carries a
// per-frame enemy/tile/wisp load and UI chrome must not compete with it.
//
// USAGE
// Every factory returns an object with an `objs` array of the Phaser objects it
// created, so a caller can track them for teardown:
//     const p = UIKit.panel(this, {x, y, w, h, accent: UIKit.PALETTE.accentBlue});
//     this._myObjs.push(...p.objs);
// and `destroy()` for convenience. Loaded as a plain global script (no modules), so
// index.html must include it before any scene that uses it.
// ─────────────────────────────────────────────────────────────────────────────

const UIKit = {

    // PALETTE and CSS are assigned after this literal — see the bottom of the file.
    // Numeric values feed the graphics/fill APIs; the CSS mirror feeds text styles,
    // which need '#rrggbb' strings, and is derived so the two cannot drift.
    PALETTE: null,
    CSS: null,

    // ── INTERNAL ─────────────────────────────────────────────────────────────
    _hex(n) { return '#' + (n >>> 0).toString(16).padStart(6, '0'); },

    // Linear-light luminance, used by the contrast helper and by any caller that
    // wants to pick a readable foreground for an arbitrary accent.
    _lum(n) {
        const ch = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map(v => {
            v /= 255;
            return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
        });
        return 0.2126 * ch[0] + 0.7152 * ch[1] + 0.0722 * ch[2];
    },

    // WCAG contrast ratio between two 0xRRGGBB colours. Exposed because it is the
    // check that was missing when the old palette was written.
    contrast(a, b) {
        const la = this._lum(a), lb = this._lum(b);
        return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
    },

    // Pick whichever of textHi / textDeep reads better on `bg`. Use for text drawn
    // on a saturated accent fill, where a fixed colour cannot be right for all hues.
    onColor(bg) {
        const P = this.PALETTE;
        return this.contrast(P.textHi, bg) >= this.contrast(P.textDeep, bg)
            ? P.textHi : P.textDeep;
    },

    // ── PANEL ────────────────────────────────────────────────────────────────
    // Rounded body, accent border, corner brackets, optional scanline texture and
    // a travelling highlight along the top edge. The layered fill (body + slightly
    // lighter inset) is what gives it depth without a real gradient — Phaser's
    // graphics API has no gradient fill, and faking one with many strips costs more
    // than it returns at these sizes.
    panel(scene, o) {
        const P = this.PALETTE;
        const x = o.x, y = o.y, w = o.w, h = o.h;
        const accent = o.accent ?? P.accentBlue;
        const d = o.depth ?? 50;
        const r = o.radius ?? 14;
        const objs = [];

        const g = scene.add.graphics().setDepth(d);
        if (o.fixed !== false) g.setScrollFactor(0);
        objs.push(g);

        // Drop shadow: a slightly offset darker rounded rect. Cheap, and it lifts
        // the panel off busy gameplay backgrounds.
        g.fillStyle(0x000000, 0.55);
        g.fillRoundedRect(x + 3, y + 4, w, h, r);
        // Body.
        g.fillStyle(o.bg ?? P.bgPanel, o.bgAlpha ?? 0.98);
        g.fillRoundedRect(x, y, w, h, r);
        // Inset highlight — one lighter rounded rect inset by 1px reads as a bevel.
        g.lineStyle(1, P.bgRaised, 0.9);
        g.strokeRoundedRect(x + 1.5, y + 1.5, w - 3, h - 3, r - 1);
        // Accent border.
        g.lineStyle(2, accent, 0.6);
        g.strokeRoundedRect(x, y, w, h, r);

        // Corner brackets — short accent strokes at each corner. Reads as "technical
        // panel" and costs 8 line segments.
        const bl = o.bracket ?? 18;
        g.lineStyle(2.5, accent, 0.95);
        const corner = (cx, cy, sx, sy) => {
            g.beginPath(); g.moveTo(cx + sx * bl, cy); g.lineTo(cx, cy);
            g.lineTo(cx, cy + sy * bl); g.strokePath();
        };
        corner(x + r * 0.5, y + r * 0.5, 1, 1);
        corner(x + w - r * 0.5, y + r * 0.5, -1, 1);
        corner(x + r * 0.5, y + h - r * 0.5, 1, -1);
        corner(x + w - r * 0.5, y + h - r * 0.5, -1, -1);

        if (o.scanlines !== false) {
            const s = this.scanlines(scene, {
                x: x + 2, y: y + 2, w: w - 4, h: h - 4,
                depth: d + 0.05, fixed: o.fixed !== false
            });
            objs.push(...s.objs);
        }
        if (o.sweep !== false) {
            const s = this.sweepLine(scene, {
                x: x + r, y: y + 1, w: w - r * 2, accent,
                depth: d + 0.1, duration: o.sweepDuration ?? 2600,
                fixed: o.fixed !== false
            });
            objs.push(...s.objs);
        }
        if (o.title) {
            const t = scene.add.text(x + 20, y + 22, o.title, {
                fontSize: o.titleSize ?? '20px', fontFamily: 'monospace',
                color: this._hex(accent), fontStyle: 'bold',
                stroke: '#000', strokeThickness: 3
            }).setOrigin(0, 0.5).setDepth(d + 0.2);
            if (o.fixed !== false) t.setScrollFactor(0);
            objs.push(t);
            // Title underline that stops short of the text width — a full-width rule
            // makes the header feel detached from the title.
            const u = scene.add.graphics().setDepth(d + 0.15);
            if (o.fixed !== false) u.setScrollFactor(0);
            u.lineStyle(2, accent, 0.5);
            u.lineBetween(x + 20, y + 38, x + 20 + Math.min(w - 40, t.width + 30), y + 38);
            objs.push(u);
        }

        return { gfx: g, objs, destroy() { objs.forEach(ob => ob?.active && ob.destroy()); } };
    },

    // ── BUTTON ───────────────────────────────────────────────────────────────
    // Rounded raised fill, accent left spine, hover glow + text brighten, and a
    // press animation. The hit area is a separate invisible rectangle rather than
    // making the graphics interactive: a graphics object's hit area does not follow
    // rounded geometry, so a rectangle is both more predictable and cheaper.
    button(scene, o) {
        const P = this.PALETTE;
        const x = o.x, y = o.y, w = o.w ?? 220, h = o.h ?? 42;
        const accent = o.accent ?? P.accentBlue;
        const d = o.depth ?? 52;
        const r = o.radius ?? 9;
        const objs = [];
        const fixed = o.fixed !== false;

        const g = scene.add.graphics().setDepth(d);
        if (fixed) g.setScrollFactor(0);
        objs.push(g);

        const txt = scene.add.text(x, y, o.label ?? '', {
            fontSize: o.fontSize ?? '15px', fontFamily: 'monospace', fontStyle: 'bold',
            color: this._hex(o.textColor ?? P.textHi),
            stroke: '#000', strokeThickness: 3
        }).setOrigin(0.5).setDepth(d + 0.2);
        if (fixed) txt.setScrollFactor(0);
        objs.push(txt);

        const draw = (hover, press) => {
            g.clear();
            const off = press ? 1.5 : 0;
            const bw = press ? w - 3 : w, bh = press ? h - 3 : h;
            const bx = x - bw / 2, by = y - bh / 2 + off;
            if (hover && !press) { g.fillStyle(accent, 0.22); g.fillRoundedRect(bx - 3, by - 3, bw + 6, bh + 6, r + 3); }
            g.fillStyle(0x000000, 0.5); g.fillRoundedRect(bx + 2, by + 3, bw, bh, r);
            g.fillStyle(hover ? P.bgHover : P.bgRaised, 1); g.fillRoundedRect(bx, by, bw, bh, r);
            g.lineStyle(hover ? 2 : 1.5, accent, hover ? 1 : 0.65); g.strokeRoundedRect(bx, by, bw, bh, r);
            // Accent spine on the left edge — the strongest cheap "this is a control"
            // signal, and it survives at small sizes where a border does not.
            g.fillStyle(accent, hover ? 1 : 0.8);
            g.fillRoundedRect(bx + 3, by + 5, 3, bh - 10, 1.5);
        };
        draw(false, false);

        // Hit area is a ZONE with an EXPLICIT Geom.Rectangle, not an alpha-0 Rectangle
        // shape with a bare setInteractive(). Zones exist precisely to be invisible
        // interactive regions; an alpha-0 filled Shape relies on Phaser inferring a hit
        // area from width/height, which is the part that was not reliably taking effect.
        const hit = scene.add.zone(x, y, w, h)
            .setOrigin(0.5)
            .setInteractive(new Phaser.Geom.Rectangle(0, 0, w, h), Phaser.Geom.Rectangle.Contains)
            .setDepth(d + 0.3);
        if (fixed) hit.setScrollFactor(0);
        objs.push(hit);

        let action = o.onClick;
        // fireOn: 'up' (default) fires on release, which lets a button show feedback before
        // an action that tears the scene down — right for purchases. 'down' fires on press.
        //
        // Navigation buttons use 'down' on purpose. Phaser only delivers `pointerup` to a
        // GameObject when the release happens while the pointer is still considered over
        // it; a few pixels of travel between press and release routes the event to
        // `pointerupoutside` instead, and an 'up'-only button silently does nothing. On a
        // button whose action is itself a full-screen transition, the transition IS the
        // feedback, so there is nothing to lose by firing on press — and it cannot miss.
        const fireOn = o.fireOn || 'up';
        let pressed = false;

        hit.on('pointerover', () => {
            draw(true, false);
            txt.setColor(this._hex(o.hoverColor ?? P.textHi));
            scene.tweens.add({ targets: txt, scale: 1.06, duration: 110, ease: 'Quad.easeOut' });
        });
        hit.on('pointerout', () => {
            draw(false, false);
            txt.setColor(this._hex(o.textColor ?? P.textHi));
            scene.tweens.add({ targets: txt, scale: 1, duration: 110, ease: 'Quad.easeOut' });
            // Leaving mid-press cancels, so the button cannot be left stuck pressed and a
            // press-then-drag-away does not count as a click.
            pressed = false;
        });
        hit.on('pointerdown', () => {
            draw(false, true); txt.y = y + 1.5;
            pressed = true;
            if (fireOn === 'down' && action) action();
        });
        hit.on('pointerup', () => {
            draw(true, false); txt.y = y;
            const fire = fireOn === 'up' && pressed;
            pressed = false;
            if (fire && action) action();
        });

        // ── FALLBACK ─────────────────────────────────────────────────────────
        // A scene-level listener that hit-tests this button's rectangle by hand. Phaser
        // per-object input depends on the input plugin resolving a hit area and routing
        // through topOnly; when that silently fails to resolve, the button is simply
        // dead with no error anywhere. The scene-level pointerdown always fires, so this
        // path cannot be bypassed by hit-area resolution.
        //
        // `lastFired` dedupes: if the object handler already ran for this gesture, the
        // fallback must not fire the action a second time.
        let lastFired = 0;
        hit.on('pointerdown', () => { if (fireOn === 'down') lastFired = Date.now(); });
        hit.on('pointerup',   () => { if (fireOn === 'up')   lastFired = Date.now(); });
        const sceneFallback = (pointer) => {
            if (Date.now() - lastFired < 350) return;      // object handler already won
            const px = pointer.x, py = pointer.y;
            if (Math.abs(px - x) > w / 2 || Math.abs(py - y) > h / 2) return;
            lastFired = Date.now();
            draw(false, true);
            if (action) action();
        };
        scene.input.on(fireOn === 'down' ? 'pointerdown' : 'pointerup', sceneFallback);
        objs.push({ active: true, destroy() { scene.input.off(fireOn === 'down' ? 'pointerdown' : 'pointerup', sceneFallback); this.active = false; } });

        // setOnClick lets an owning scene repoint a button the shared factory built.
        // TowerDefenseScene needs this: it reuses HUD's pause menu but its RESTART must
        // restart the TD scene, not Game. It previously did that by locating the button
        // through index arithmetic on _pauseObjs (`_pauseObjs[indexOf(text) - 1]`), which
        // silently breaks the moment the construction order changes.
        return { gfx: g, txt, hit, objs, redraw: draw,
                 setOnClick(fn) { action = fn; },
                 _debugBounds: { x, y, w, h },
                 destroy() { objs.forEach(ob => ob?.active && ob.destroy()); } };
    },

    // ── CARD SURFACE ─────────────────────────────────────────────────────────
    // The look of a carousel card, drawn in LOCAL coordinates for a Container. One
    // definition shared by the shop and the level select, because two hand-drawn card
    // styles is how the old UI drifted apart in the first place.
    //
    // The surface is built from layers rather than a single fill, because Phaser's
    // graphics API has no gradient: a lighter body, a darker lower band, and an accent
    // wash across the top third together read as a lit surface falling into shadow.
    // Overlapping rounded rects are cheap — this is six fills and three strokes, built
    // once when the card is created and never redrawn.
    cardSurface(scene, o) {
        const P = this.PALETTE;
        const w = o.w, h = o.h, accent = o.accent, focus = !!o.focus;
        const R = o.radius ?? 18;
        const g = scene.add.graphics();

        // Cast shadow, offset down and right.
        g.fillStyle(0x000000, 0.5);
        g.fillRoundedRect(-w / 2 + 4, -h / 2 + 7, w, h, R);

        // Body, then a darker lower band to imply light falling from above.
        g.fillStyle(P.bgRaised, 1);
        g.fillRoundedRect(-w / 2, -h / 2, w, h, R);
        g.fillStyle(P.bgPanel, 0.82);
        g.fillRoundedRect(-w / 2, -h / 2 + h * 0.44, w, h * 0.56,
                          { tl: 0, tr: 0, bl: R, br: R });

        // Accent wash over the top third — the card's identity colour, kept faint so the
        // title still carries the contrast.
        g.fillStyle(accent, focus ? 0.16 : 0.07);
        g.fillRoundedRect(-w / 2, -h / 2, w, h * 0.34, { tl: R, tr: R, bl: 0, br: 0 });

        // Crown bar.
        g.fillStyle(accent, focus ? 1 : 0.45);
        g.fillRoundedRect(-w / 2 + 3, -h / 2 + 3, w - 6, 5, { tl: R - 3, tr: R - 3, bl: 0, br: 0 });

        // Inner hairline: a 1px white highlight inset from the border reads as a bevel
        // and stops the card looking like a flat sticker.
        g.lineStyle(1, 0xffffff, focus ? 0.09 : 0.05);
        g.strokeRoundedRect(-w / 2 + 3, -h / 2 + 3, w - 6, h - 6, R - 3);

        // Border.
        g.lineStyle(focus ? 2.5 : 1.5, accent, focus ? 0.95 : 0.4);
        g.strokeRoundedRect(-w / 2, -h / 2, w, h, R);

        // Corner ticks, focus only — marks the selected card as "targeted" without
        // adding another colour or another word.
        if (focus) {
            const tl = 16;
            g.lineStyle(2.5, accent, 0.95);
            const tick = (sx, sy) => {
                const px = sx * (w / 2 - 9), py = sy * (h / 2 - 9);
                g.beginPath();
                g.moveTo(px - sx * tl, py); g.lineTo(px, py); g.lineTo(px, py - sy * tl);
                g.strokePath();
            };
            tick(-1, -1); tick(1, -1); tick(-1, 1); tick(1, 1);
        }
        return g;
    },

    // ── CAROUSEL ROW ─────────────────────────────────────────────────────────
    // A true coverflow strip: the focused card sits centre, neighbours flank it at
    // reduced scale and opacity, and the list WRAPS — paging past the last item brings
    // the first around, so the row reads as a ring you rotate rather than a list with
    // ends.
    //
    // Each card is a Phaser Container whose contents are drawn in LOCAL coordinates.
    // That is what makes scaling possible at all: graphics drawn at absolute screen
    // coordinates cannot be scaled about a card centre, which is why the earlier
    // "peek" attempt could only fade and never shrink convincingly.
    //
    // `makeFace(index, isCentre, w, h)` is supplied by the caller and must return a
    // Container with its content drawn around (0,0). The row handles placement, scale,
    // alpha, depth ordering, wrap arithmetic and the rotate animation.
    //
    // SLOTS is deliberately 5 (two either side). Enough that the strip continues past
    // both edges; few enough that a 4-item list does not draw the same card twice in
    // one frame, which looks like a rendering fault rather than a loop.
    carouselRow(scene, o) {
        const count = o.count;
        if (!count) return { objs: [], destroy() {} };
        const cx = o.cx, cy = o.cy;
        const cardW = o.cardW, cardH = o.cardH;
        const spacing = o.spacing ?? cardW * 0.72;
        const maxOff = Math.min(2, Math.floor((count - 1) / 2));
        const objs = [];

        // Falloff per distance from centre. Side cards are both smaller and dimmer so
        // the eye never has to decide which card is the subject.
        const SCALE = [1, 0.72, 0.5];
        const ALPHA = [1, 0.5, 0.22];

        const place = (c, off) => {
            const a = Math.abs(off);
            c.x = cx + off * spacing;
            c.y = cy;
            c.setScale(SCALE[a] ?? 0.4);
            c.setAlpha(ALPHA[a] ?? 0.15);
            c.setDepth((o.depth ?? 10) + (3 - a));
        };

        const wrap = i => ((i % count) + count) % count;

        // Focus halo behind the centre card — a soft accent bloom that makes the selected
        // card read as lit rather than merely larger. Drawn first so it sits underneath.
        if (o.accent !== undefined) {
            const halo = scene.add.graphics().setDepth((o.depth ?? 10) - 1);
            for (let i = 4; i >= 1; i--) {
                halo.fillStyle(o.accent, 0.035 * i);
                const pad = i * 9;
                halo.fillRoundedRect(cx - cardW / 2 - pad, cy - cardH / 2 - pad,
                                     cardW + pad * 2, cardH + pad * 2, 18 + pad * 0.4);
            }
            objs.push(halo);
            scene.tweens.add({ targets: halo, alpha: 0.55, duration: 2200,
                               yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
        }

        for (let off = -maxOff; off <= maxOff; off++) {
            const idx = wrap(o.index + off);
            const face = o.makeFace(idx, off === 0, cardW, cardH);
            if (!face) continue;
            objs.push(face);
            place(face, off);

            // Click targets. The hit geometry must use the SCALED size: the zone was
            // being created at the scaled size but handed an UNSCALED Geom.Rectangle, and
            // Phaser hit-tests against the geometry, not the zone's dimensions. Each side
            // card therefore claimed a region the full card's width and height — far
            // wider than anything visible — and under topOnly routing those oversized
            // regions silently swallowed clicks meant for whatever sat beneath them.
            const sc = SCALE[Math.abs(off)] ?? 0.4;
            const hw = cardW * sc, hh = cardH * sc;
            if (off === 0 ? !!o.onActivate : !!o.onPick) {
                const hit = scene.add.zone(cx + off * spacing, cy, hw, hh)
                    .setOrigin(0.5)
                    .setInteractive(new Phaser.Geom.Rectangle(0, 0, hw, hh),
                                    Phaser.Geom.Rectangle.Contains)
                    // Side cards sit BELOW the centre so an overlapping edge can never
                    // steal a click from the focused card.
                    .setDepth((o.depth ?? 10) + (off === 0 ? 4 : 2));
                const delta = off;
                hit.on('pointerdown', () => { if (off === 0) o.onActivate(); else o.onPick(delta); });
                objs.push(hit);
            }

            // Rotate-in: start one slot further out and settle. Applied per card so the
            // whole row appears to turn, rather than the centre swapping contents.
            if (o.dir) {
                const from = off + o.dir;
                const af = Math.abs(from);
                face.x = cx + from * spacing;
                face.setScale(SCALE[af] ?? 0.4);
                face.setAlpha(0);
                const tScale = SCALE[Math.abs(off)] ?? 0.4;
                const tAlpha = ALPHA[Math.abs(off)] ?? 0.15;
                scene.tweens.add({ targets: face, x: cx + off * spacing, scale: tScale,
                                   duration: o.duration ?? 260, ease: 'Cubic.easeOut' });
                scene.tweens.add({ targets: face, alpha: tAlpha,
                                   duration: (o.duration ?? 260) * 0.8, ease: 'Quad.easeOut' });
            }
        }

        return {
            objs,
            destroy() { objs.forEach(ob => { if (ob?.active) { scene.tweens.killTweensOf(ob); ob.destroy(); } }); }
        };
    },

    // peekCard was removed: UIKit.carouselRow superseded it. Faint side PANELS were
    // the wrong model — the neighbours want to be real cards at reduced scale, which is
    // what carouselRow does. Left in place it would have been dead code in a shared kit,
    // which is how the next person ends up using the wrong one.

    // ── CARD ─────────────────────────────────────────────────────────────────
    // For level / item / ult grids. Top accent stripe, rounded body, hover lift.
    // `locked` dims the whole thing but keeps text above the 3:1 floor — the old
    // locked styling used #2a2a3a on #080c14 (1.39:1), which was invisible rather
    // than merely de-emphasised.
    card(scene, o) {
        const P = this.PALETTE;
        const x = o.x, y = o.y, w = o.w, h = o.h;
        const accent = o.accent ?? P.accentBlue;
        const d = o.depth ?? 20;
        const r = o.radius ?? 10;
        const locked = !!o.locked;
        const objs = [];
        const fixed = o.fixed !== false;

        const g = scene.add.graphics().setDepth(d);
        if (fixed) g.setScrollFactor(0);
        objs.push(g);

        const draw = (hover) => {
            g.clear();
            const lift = hover && !locked ? 2 : 0;
            const by = y - lift;
            if (hover && !locked) { g.fillStyle(accent, 0.18); g.fillRoundedRect(x - 4, by - 4, w + 8, h + 8, r + 4); }
            g.fillStyle(0x000000, 0.5); g.fillRoundedRect(x + 2, by + 4, w, h, r);
            g.fillStyle(locked ? 0x0d1118 : (hover ? P.bgHover : P.bgRaised), 1);
            g.fillRoundedRect(x, by, w, h, r);
            g.lineStyle(hover && !locked ? 2 : 1.5, locked ? P.line : accent, locked ? 1 : (hover ? 1 : 0.6));
            g.strokeRoundedRect(x, by, w, h, r);
            // Top stripe, clipped to the rounded top by drawing it as its own
            // rounded rect with a squared bottom overlay.
            g.fillStyle(accent, locked ? 0.22 : 0.9);
            g.fillRoundedRect(x + 1.5, by + 1.5, w - 3, 5, { tl: r - 1, tr: r - 1, bl: 0, br: 0 });
        };
        draw(false);

        let hit = null;
        if (!locked && o.onClick) {
            hit = scene.add.rectangle(x + w / 2, y + h / 2, w, h, 0xffffff, 0)
                .setDepth(d + 0.4).setInteractive();
            if (fixed) hit.setScrollFactor(0);
            objs.push(hit);
            hit.on('pointerover', () => draw(true));
            hit.on('pointerout', () => draw(false));
            hit.on('pointerup', () => o.onClick());
        }

        return { gfx: g, hit, objs, redraw: draw,
                 destroy() { objs.forEach(ob => ob?.active && ob.destroy()); } };
    },

    // ── PILL ─────────────────────────────────────────────────────────────────
    // Currency / status chip. `align` 1 right-aligns at x, 0 left-aligns, 0.5 centres.
    pill(scene, o) {
        const P = this.PALETTE;
        const accent = o.accent ?? P.accentGold;
        const d = o.depth ?? 52;
        const fixed = o.fixed !== false;
        const objs = [];

        const txt = scene.add.text(0, o.y, o.label ?? '', {
            fontSize: o.fontSize ?? '15px', fontFamily: 'monospace', fontStyle: 'bold',
            color: this._hex(accent), stroke: '#000', strokeThickness: 2
        }).setOrigin(0, 0.5).setDepth(d + 0.2);
        if (fixed) txt.setScrollFactor(0);

        const padX = 12, h = o.h ?? 26;
        const w = txt.width + padX * 2;
        const align = o.align ?? 0;
        const x = o.x - w * align;
        txt.x = x + padX;

        const g = scene.add.graphics().setDepth(d);
        if (fixed) g.setScrollFactor(0);
        g.fillStyle(0x000000, 0.45); g.fillRoundedRect(x + 1, o.y - h / 2 + 2, w, h, h / 2);
        g.fillStyle(P.bgRaised, 1);   g.fillRoundedRect(x, o.y - h / 2, w, h, h / 2);
        g.lineStyle(1.5, accent, 0.7); g.strokeRoundedRect(x, o.y - h / 2, w, h, h / 2);
        objs.push(g, txt);

        // setText must resize the pill, so the caller gets a helper rather than the
        // raw text object — updating the label without redrawing the capsule was a
        // guaranteed source of text overflowing its own background.
        const self = this;
        return {
            gfx: g, txt, objs,
            setLabel(s) {
                txt.setText(s);
                const nw = txt.width + padX * 2;
                const nx = o.x - nw * align;
                txt.x = nx + padX;
                g.clear();
                g.fillStyle(0x000000, 0.45); g.fillRoundedRect(nx + 1, o.y - h / 2 + 2, nw, h, h / 2);
                g.fillStyle(P.bgRaised, 1);   g.fillRoundedRect(nx, o.y - h / 2, nw, h, h / 2);
                g.lineStyle(1.5, accent, 0.7); g.strokeRoundedRect(nx, o.y - h / 2, nw, h, h / 2);
            },
            destroy() { objs.forEach(ob => ob?.active && ob.destroy()); }
        };
    },

    // ── SECTION HEADER ───────────────────────────────────────────────────────
    // Left accent bar + tinted strip + label, with optional right-aligned status.
    sectionHeader(scene, o) {
        const P = this.PALETTE;
        const accent = o.accent ?? P.accentBlue;
        const d = o.depth ?? 20;
        const h = o.h ?? 24;
        const fixed = o.fixed !== false;
        const objs = [];

        const g = scene.add.graphics().setDepth(d);
        if (fixed) g.setScrollFactor(0);
        g.fillStyle(accent, 0.12); g.fillRoundedRect(o.x, o.y, o.w, h, 4);
        g.fillStyle(accent, 0.95); g.fillRoundedRect(o.x, o.y + 3, 3.5, h - 6, 1.75);
        g.lineStyle(1, accent, 0.28); g.strokeRoundedRect(o.x, o.y, o.w, h, 4);
        objs.push(g);

        const label = scene.add.text(o.x + 12, o.y + h / 2, o.label ?? '', {
            fontSize: o.fontSize ?? '11px', fontFamily: 'monospace', fontStyle: 'bold',
            color: this._hex(accent), stroke: '#000', strokeThickness: 2
        }).setOrigin(0, 0.5).setDepth(d + 0.1);
        if (fixed) label.setScrollFactor(0);
        objs.push(label);

        let right = null;
        if (o.right) {
            right = scene.add.text(o.x + o.w - 8, o.y + h / 2, o.right, {
                fontSize: '13px', fontFamily: 'monospace',
                color: this._hex(o.rightColor ?? P.textMid), stroke: '#000', strokeThickness: 1
            }).setOrigin(1, 0.5).setDepth(d + 0.1);
            if (fixed) right.setScrollFactor(0);
            objs.push(right);
        }

        return { gfx: g, label, right, objs,
                 destroy() { objs.forEach(ob => ob?.active && ob.destroy()); } };
    },

    // ── BAR ──────────────────────────────────────────────────────────────────
    // Rounded stat bar (health, charge, ult). Returns setValue(0..1) which only
    // redraws the fill layer, so calling it every frame is safe.
    bar(scene, o) {
        const P = this.PALETTE;
        const accent = o.accent ?? P.accentRed;
        const d = o.depth ?? 30;
        const x = o.x, y = o.y, w = o.w, h = o.h ?? 14;
        const r = Math.min(h / 2, 6);
        const fixed = o.fixed !== false;
        const objs = [];

        const back = scene.add.graphics().setDepth(d);
        const fill = scene.add.graphics().setDepth(d + 0.1);
        if (fixed) { back.setScrollFactor(0); fill.setScrollFactor(0); }
        objs.push(back, fill);

        back.fillStyle(0x000000, 0.75); back.fillRoundedRect(x, y, w, h, r);
        back.lineStyle(1.5, accent, 0.45); back.strokeRoundedRect(x, y, w, h, r);

        let label = null;
        if (o.label) {
            label = scene.add.text(x + w / 2, y + h / 2, o.label, {
                fontSize: o.fontSize ?? '11px', fontFamily: 'monospace', fontStyle: 'bold',
                color: this._hex(P.textHi), stroke: '#000', strokeThickness: 3
            }).setOrigin(0.5).setDepth(d + 0.2);
            if (fixed) label.setScrollFactor(0);
            objs.push(label);
        }

        const setValue = (frac, col) => {
            frac = Math.max(0, Math.min(1, frac || 0));
            fill.clear();
            if (frac <= 0) return;
            const fw = Math.max(r * 2, w * frac);
            fill.fillStyle(col ?? accent, 1);
            fill.fillRoundedRect(x + 1.5, y + 1.5, fw - 3, h - 3, Math.max(1, r - 1));
            // Top sheen: one translucent white strip across the upper third. Reads as
            // a glossy fill for the cost of a single rect.
            fill.fillStyle(0xffffff, 0.18);
            fill.fillRoundedRect(x + 2.5, y + 2.5, Math.max(1, fw - 5), Math.max(1, (h - 5) * 0.38), Math.max(1, r - 2));
        };
        setValue(o.value ?? 1);

        return { back, fill, label, objs, setValue,
                 destroy() { objs.forEach(ob => ob?.active && ob.destroy()); } };
    },

    // ── SCANLINES ────────────────────────────────────────────────────────────
    // Drawn ONCE into a static graphics object. Never animate this — a moving
    // scanline field means rebuilding every line every frame.
    scanlines(scene, o) {
        const g = scene.add.graphics().setDepth(o.depth ?? 51);
        if (o.fixed !== false) g.setScrollFactor(0);
        const step = o.step ?? 3;
        g.fillStyle(0x000000, o.alpha ?? 0.16);
        for (let yy = o.y; yy < o.y + o.h; yy += step) {
            g.fillRect(o.x, yy, o.w, 1);
        }
        return { gfx: g, objs: [g], destroy() { g?.active && g.destroy(); } };
    },

    // ── SWEEP LINE ───────────────────────────────────────────────────────────
    // A short bright segment that travels along a horizontal run, loops forever.
    // Implemented as a fixed-size graphics whose X is tweened — one tweened property
    // per panel, versus redrawing a gradient every frame.
    sweepLine(scene, o) {
        const accent = o.accent ?? this.PALETTE.accentBlue;
        const segW = Math.max(28, Math.min(90, o.w * 0.28));
        const g = scene.add.graphics().setDepth(o.depth ?? 51);
        if (o.fixed !== false) g.setScrollFactor(0);
        // Drawn at local origin; the object's x/y position it, so the tween only
        // touches a transform and never re-runs this path construction.
        g.fillStyle(accent, 0.85); g.fillRect(0, 0, segW, 2);
        g.fillStyle(accent, 0.30); g.fillRect(0, 0, segW, 4);
        g.x = o.x; g.y = o.y;

        const tw = scene.tweens.add({
            targets: g, x: o.x + o.w - segW,
            duration: o.duration ?? 2600, ease: 'Sine.easeInOut',
            yoyo: true, repeat: -1
        });
        return {
            gfx: g, tween: tw, objs: [g],
            destroy() { tw?.remove(); g?.active && g.destroy(); }
        };
    },

    // ── MOTES ────────────────────────────────────────────────────────────────
    // A few slow drifting dots for background life. Each is one small graphics with
    // one looping tween. Keep `count` low — this is atmosphere, not a particle system.
    motes(scene, o) {
        const accent = o.accent ?? this.PALETTE.accentBlue;
        const n = o.count ?? 14;
        const objs = [], tweens = [];
        for (let i = 0; i < n; i++) {
            const rad = 1 + Math.random() * 1.8;
            const g = scene.add.graphics().setDepth(o.depth ?? 1);
            if (o.fixed !== false) g.setScrollFactor(0);
            g.fillStyle(accent, 0.10 + Math.random() * 0.18);
            g.fillCircle(0, 0, rad);
            g.x = o.x + Math.random() * o.w;
            g.y = o.y + Math.random() * o.h;
            objs.push(g);
            tweens.push(scene.tweens.add({
                targets: g,
                y: g.y - (30 + Math.random() * 70),
                x: g.x + (Math.random() * 40 - 20),
                alpha: { from: g.alpha, to: 0 },
                duration: 5000 + Math.random() * 6000,
                delay: Math.random() * 4000,
                repeat: -1, ease: 'Sine.easeInOut'
            }));
        }
        return {
            objs, tweens,
            destroy() { tweens.forEach(t => t?.remove()); objs.forEach(g => g?.active && g.destroy()); }
        };
    },

    // ── BACKDROP ─────────────────────────────────────────────────────────────
    // Full-screen scene background: deep fill, faint grid, vignette, drifting motes.
    // One call replaces the hand-rolled background block in each menu scene.
    backdrop(scene, o) {
        o = o || {};
        const P = this.PALETTE;
        const W = scene.scale.width, H = scene.scale.height;
        const accent = o.accent ?? P.accentBlue;
        const d = o.depth ?? -10;
        const objs = [];

        const g = scene.add.graphics().setDepth(d).setScrollFactor(0);
        g.fillStyle(o.bg ?? P.bgDeep, 1); g.fillRect(0, 0, W, H);
        const step = o.grid ?? 32;
        g.lineStyle(1, accent, 0.055);
        for (let x = 0; x <= W; x += step) g.lineBetween(x, 0, x, H);
        for (let y = 0; y <= H; y += step) g.lineBetween(0, y, W, y);
        objs.push(g);

        // Vignette: concentric edge bands. Phaser has no radial gradient, so a few
        // nested translucent frames approximate one at negligible cost.
        const v = scene.add.graphics().setDepth(d + 0.1).setScrollFactor(0);
        for (let i = 0; i < 7; i++) {
            v.lineStyle(26, 0x000000, 0.055);
            v.strokeRect(-13 + i * 13, -13 + i * 13, W + 26 - i * 26, H + 26 - i * 26);
        }
        objs.push(v);

        const m = this.motes(scene, { x: 0, y: 0, w: W, h: H, accent, depth: d + 0.2, count: o.motes ?? 16 });
        objs.push(...m.objs);

        return { objs, motes: m, destroy() { m.destroy(); objs.forEach(ob => ob?.active && ob.destroy()); } };
    },

    // ── OVERLAY ──────────────────────────────────────────────────────────────
    // Modal dim layer. Swallows clicks so controls behind a menu are not reachable.
    overlay(scene, o) {
        o = o || {};
        const W = scene.scale.width, H = scene.scale.height;
        const r = scene.add.rectangle(W / 2, H / 2, W, H, 0x000000, o.alpha ?? 0.68)
            .setScrollFactor(0).setDepth(o.depth ?? 500).setInteractive();
        if (o.onClick) r.on('pointerdown', o.onClick);
        return { rect: r, objs: [r], destroy() { r?.active && r.destroy(); } };
    }
};

// Palette assigned after the literal so the numeric tones can be written plainly
// and the css mirror derived rather than hand-maintained (the old scenes drifted
// precisely because every colour was a literal typed at the point of use).
UIKit.PALETTE = {
    bgDeep:   0x070b12,
    bgPanel:  0x0b1220,
    bgRaised: 0x121c2e,
    bgHover:  0x1d2d45,
    line:     0x24344a,

    // Text tones, measured (UIKit.contrast) against bgPanel 0x0b1220:
    //   textHi 16.56:1   textMid 9.73:1   textLo 5.78:1
    // Worst case is textLo on bgHover at 4.29:1, still above the 3:1 floor.
    // textDeep is only for text sitting ON a saturated accent fill — see onColor().
    // textLo is the dimmest tone allowed to carry words. For comparison, the palette
    // this replaced shipped body text between 1.39:1 and 1.96:1, i.e. invisible.
    textHi:   0xe8f2ff,
    textMid:  0xa8bdd6,
    textLo:   0x7d91a8,
    textDeep: 0x05080e,

    accentBlue:   0x4aa8ff,
    accentGold:   0xffc23c,
    accentGreen:  0x3ddc84,
    accentRed:    0xff5f52,
    accentPurple: 0xb388ff,
    accentCyan:   0x45e0e0,
    accentOrange: 0xff9f45
};

// css mirror for text styles, derived so it cannot drift from the numeric values.
UIKit.CSS = Object.fromEntries(
    Object.entries(UIKit.PALETTE).map(([k, v]) => [k, '#' + (v >>> 0).toString(16).padStart(6, '0')])
);


// ╔═══════════════════════════════════════════════════════════════════════════╗
// ║  ElementResist.js                                                        
// ╚═══════════════════════════════════════════════════════════════════════════╝


// ─────────────────────────────────────────────────────────────────────────────
// ElementResist — the single source of truth for "does this element hurt this enemy".
//
// WHY THIS EXISTS
// Elemental immunity was 86 inlined boolean checks spread across CombatSystem (18),
// WeaponSystem (49), ElementSystem (5) and LevelManager (14), written in EIGHT
// different combinations:
//     iceImmune                                    x27
//     fireImmune                                   x12
//     fireImmune || elementImmune                   x6
//     iceImmune || fireImmune || elementImmune      x4
//     elementImmune                                 x4
//     + three more one-off orderings
// Every one was a hard bail-out, so immunity could only ever mean 0x. Expressing
// anything else — Cosmic's reduced-but-nonzero chip, a future lightning elemental,
// a partial resistance — meant editing all 86 and keeping them in agreement, which
// the eight variants above show does not happen.
//
// This file replaces the question "is this enemy immune?" with "what multiplier
// applies?". Immunity becomes the 0.0 row of a table rather than a control-flow
// shortcut, and a new element or resistance is a data change in one place.
//
// BACKWARDS COMPATIBILITY
// The existing enemy flags (fireImmune / iceImmune / elementImmune / lightningImmune)
// remain the source of truth for WHICH profile an enemy has — nothing needs to be
// re-tagged, and the 86 legacy sites keep working unchanged while callers migrate.
// The TABLE below reproduces today's behaviour exactly for fire, ice and lightning:
// every cell that was a hard bail-out is 0.0. The only NEW behaviour is the cosmic
// row.
//
// COSMIC
// Cosmic damages everything and excels at nothing: 0.70x against normal enemies and
// 0.50x against element-resistant ones. Note the direction of that trade — every
// other element deals 0x to a resistant target, so cosmic's 0.50x is not a penalty
// against them, it is the entire point. The 0.70x baseline is what pays for it, and
// without that baseline cut cosmic would be strictly the best pick everywhere (never
// zero, never reduced) rather than the safe one.
//
// TUNING NOTE: cosmic weapon base damage was authored BEFORE this multiplier existed
// (cosmic_fists is 8 base, the lowest in the game, plus up to +75% dash momentum).
// Applying 0.70x on top lowers its effective output to ~5.6-9.8. If cosmic ends up
// feeling limp, raise the weapons' base damage rather than COSMIC_VS_NORMAL — the
// multiplier is the design statement, the base damage is the dial.
// ─────────────────────────────────────────────────────────────────────────────

const ElementResist = {

    // Cosmic's two constants, named so they are tunable in one place.
    COSMIC_VS_NORMAL:    0.70,
    COSMIC_VS_RESISTANT: 0.50,

    // ── PROFILES ─────────────────────────────────────────────────────────────
    // Multiplier per attacking element. 0 means refused (the old immunity).
    // 'physical' covers damage with no element — fireball splash, melee, collision.
    //
    // fireElemental and iceElemental both read as near-total walls because that is
    // what the old code did: the central gate in damageEnemy bailed on BOTH flags
    // regardless of which element was attacking, so lightning was already dealing 0
    // to both. Those zeroes are preserved deliberately — this refactor is not a
    // balance change for the existing three elements.
    //
    // Each profile also records its ESCAPE HATCH: the indirect route that always
    // worked and bypasses this table entirely because it never called damageEnemy.
    TABLE: {
        none: {
            label: null,
            mult: { fire: 1, ice: 1, lightning: 1, cosmic: 0.70, physical: 1 }
        },
        fireElemental: {
            label: 'IMMUNE', color: '#ff8844',
            // Escape hatch: lava tiles and burn DoT (environmental, not direct).
            mult: { fire: 0, ice: 0, lightning: 0, cosmic: 0.50, physical: 0 }
        },
        iceElemental: {
            label: 'IMMUNE', color: '#88eeff',
            // Escape hatch: shatter via damageEnemyIce while frozen. Also chillImmune
            // stacking — 3 stacks freeze it (see CombatSystem's chill helper).
            mult: { fire: 0, ice: 0, lightning: 0, cosmic: 0.50, physical: 0 }
        },
        // Not yet used by any spawner. CombatSystem carried a bare
        // `lightningImmune (future)` comment for this and nothing else, so lightning
        // is currently the one element with no resistant enemy at all — which also
        // means cosmic's safety valve has nothing to protect against there. Tag an
        // enemy with lightningImmune and it works immediately.
        lightningElemental: {
            label: 'IMMUNE', color: '#ffff44',
            mult: { fire: 1, ice: 1, lightning: 0, cosmic: 0.50, physical: 1 }
        },
        // Generic "immune to elements" tag used by a few scripted enemies.
        elemental: {
            label: 'IMMUNE', color: '#8888ff',
            mult: { fire: 0, ice: 0, lightning: 0, cosmic: 0.50, physical: 0 }
        }
    },

    // ── PROFILE RESOLUTION ───────────────────────────────────────────────────
    // Order matters and encodes the old precedence: the legacy gate tested
    // `fireImmune || iceImmune` with fire first, and the scattered sites that also
    // tested elementImmune always listed it last. Keeping that order means an enemy
    // carrying more than one flag resolves the way it always did.
    profileOf(enemy) {
        if (!enemy) return this.TABLE.none;
        if (enemy.fireImmune)      return this.TABLE.fireElemental;
        if (enemy.iceImmune)       return this.TABLE.iceElemental;
        if (enemy.lightningImmune) return this.TABLE.lightningElemental;
        if (enemy.elementImmune)   return this.TABLE.elemental;
        return this.TABLE.none;
    },

    // True when the enemy resists ANY element — i.e. it is one of the wall profiles.
    // Cosmic's 0.50x row is what this predicate exists to select.
    isResistant(enemy) { return this.profileOf(enemy) !== this.TABLE.none; },

    // ── MULTIPLIER ───────────────────────────────────────────────────────────
    // `element` is one of fire / ice / lightning / cosmic / physical. Anything
    // unrecognised (null, undefined, 'void', a typo) is treated as physical, which
    // matches the old behaviour: untagged damage went through the same gate.
    multiplier(enemy, element) {
        const prof = this.profileOf(enemy);
        const key = Object.prototype.hasOwnProperty.call(prof.mult, element) ? element : 'physical';
        return prof.mult[key];
    },

    // ── RESOLVE ──────────────────────────────────────────────────────────────
    // The call damage code should make. Returns everything needed to either apply
    // the hit or show the refusal, so callers never re-derive any of it:
    //   { dmg, mult, refused, label, color, profile }
    // `refused` is true only at exactly 0 — a reduced hit is NOT a refusal, which is
    // the whole distinction the old boolean gate could not express.
    resolve(enemy, element, raw) {
        const prof = this.profileOf(enemy);
        const mult = this.multiplier(enemy, element);
        const dmg = (raw || 0) * mult;
        return {
            dmg,
            mult,
            refused: mult === 0,
            label: mult === 0 ? (prof.label || 'IMMUNE') : null,
            color: prof.color || '#ffffff',
            profile: prof
        };
    },

    // Human-readable matrix, for a dev panel or a sanity check in the console.
    describe() {
        const els = ['fire', 'ice', 'lightning', 'cosmic', 'physical'];
        const rows = [['profile'].concat(els).join('\t')];
        for (const [name, prof] of Object.entries(this.TABLE)) {
            rows.push([name].concat(els.map(e => prof.mult[e].toFixed(2))).join('\t'));
        }
        return rows.join('\n');
    }
};


// ╔═══════════════════════════════════════════════════════════════════════════╗
// ║  Transitions.js                                                          
// ╚═══════════════════════════════════════════════════════════════════════════╝


// ─────────────────────────────────────────────────────────────────────────────
// Transitions — themed level-entry animations and the shared loading screen.
//
// WHAT THIS IS FOR
// Entering a level used to be a 120ms white rectangle fade. That reads as a page
// change rather than an arrival, and it threw away the one moment where the game can
// tell you what you are walking into. Each level now gets an entry animation built
// from its OWN subject matter: the Fracture cracks the screen, the Void Rift tears it
// open and swallows it, Engineering Defense draws itself as a blueprint. The animation
// is the level's thesis statement.
//
// PERFORMANCE CONTRACT (inherited from UIKit)
// Tweens, not per-frame redraws. Each effect builds its geometry ONCE into a graphics
// object and then tweens transforms — x/y/scale/alpha/angle. Where an effect genuinely
// needs many independent movers (shards, sparks, stars) each gets its own small
// graphics plus one tween, which the renderer batches; the alternative, redrawing one
// big graphics every frame, re-runs path construction 60x a second.
//
// TEARDOWN CONTRACT — the important one
// These run immediately before `scene.start(...)`, so they are racing scene teardown.
// Every effect therefore:
//   1. tracks every object it creates, and
//   2. routes completion through a ONE-SHOT `finish` guard.
// Without the guard, an effect with several parallel tweens would fire its onComplete
// several times and call scene.start() repeatedly. Phaser tolerates that badly: the
// second start tears down the scene the first one is still building, and you get a
// blank scene or a half-initialised one. The guard is not defensive padding, it is
// what makes these safe to attach to a scene change.
// ─────────────────────────────────────────────────────────────────────────────

const Transitions = {

    // Per-level identity. `accent` drives the effect's colour, `kind` selects the
    // animation, `name`/`tag` feed the loader card.
    LEVELS: [
        { name: 'Tutorial',          tag: 'LEARN THE ELEMENTS', kind: 'duality',   accent: 0xffc23c },
        { name: 'The Gauntlet',      tag: 'CLAIM LIGHTNING',    kind: 'storm',     accent: 0xffff44 },
        { name: 'The Void Rift',     tag: 'CLAIM COSMIC',       kind: 'rift',      accent: 0xb388ff },
        { name: 'The Fracture',      tag: 'DIVIDED GROUND',     kind: 'fracture',  accent: 0x45e0e0 },
        { name: 'Engineering Defense', tag: 'HOLD THE BASE',    kind: 'blueprint', accent: 0x3ddc84 },
        { name: 'Storm Chamber',     tag: 'KEEP MOVING',        kind: 'storm',     accent: 0x4aa8ff },
        { name: 'Void Gate',         tag: 'CLOSE THE PORTALS',  kind: 'gate',      accent: 0xb388ff },
        { name: 'Circuit Maze',      tag: 'ROUTE THE CURRENT',  kind: 'circuit',   accent: 0xff9f45 },
        { name: 'Final Stand',       tag: 'NO MERCY',           kind: 'alert',     accent: 0xff5f52 },
        { name: 'THE END',           tag: 'THE VOID SOVEREIGN', kind: 'warp',      accent: 0xffc23c }
    ],

    TIPS: [
        'Cosmic damages everything, but excels at nothing.',
        'Fire elementals ignore direct damage — burn them with lava instead.',
        'Ice elementals only break once frozen. Shatter them.',
        'Brittle amplifies your NEXT non-ice hit. Follow up fast.',
        'Wet enemies freeze far more readily.',
        'A wisp at zero stamina locks out for 8 seconds. Rotate them.',
        'Spread your towers — one lightning fork cannot chain them all.',
        'The Diamond Wrench crushes on the return leg. Line both up.',
        'Frozen enemies take 2.5x damage.',
        'Standing in your own water trail speeds you up, and it ramps.'
    ],

    // Ambient kind per weapon element, used by the shop carousel. Lightning and cosmic
    // deliberately share the level set's effects — the shop should feel like the same
    // game as the level select, not a separate art direction.
    ELEMENT_FX: { fire: 'ember', ice: 'frost', lightning: 'storm', cosmic: 'warp' },

    infoFor(index) {
        return this.LEVELS[index] || { name: 'Level ' + (index + 1), tag: '', kind: 'duality', accent: 0x4aa8ff };
    },

    // ── PUBLIC ENTRY ─────────────────────────────────────────────────────────
    // Runs the themed intro, then the loader, then calls `onDone`. Callers pass the
    // scene.start in onDone rather than a scene key, so this file never needs to know
    // about scene routing.
    enterLevel(scene, index, onDone) {
        const info = this.infoFor(index);
        this.play(scene, info.kind, info.accent, () => {
            this.loader(scene, {
                title: info.name, tag: info.tag, accent: info.accent,
                onDone: onDone
            });
        });
    },

    // Dispatch. Unknown kinds fall back to `duality` rather than throwing, so adding a
    // level to LEVELS without writing its effect still produces something.
    play(scene, kind, accent, done) {
        const fn = this['_' + kind];
        return (typeof fn === 'function' ? fn : this._duality).call(this, scene, accent, done);
    },

    // ── SHARED HELPERS ───────────────────────────────────────────────────────
    // One-shot completion guard plus object tracking. Every effect uses this; see the
    // teardown contract at the top of the file for why the guard matters.
    _ctx(scene, done, holdMs) {
        const objs = [];
        let finished = false;
        const ctx = {
            W: scene.scale.width, H: scene.scale.height,
            track: (...o) => { objs.push(...o); return o[0]; },
            g: (depth) => { const gg = scene.add.graphics().setScrollFactor(0).setDepth(depth ?? 900); objs.push(gg); return gg; },
            // Fires at most once no matter how many tweens call it.
            finish: () => {
                if (finished) return;
                finished = true;
                objs.forEach(o => { if (o?.active) { scene.tweens.killTweensOf(o); o.destroy(); } });
                if (done) done();
            }
        };
        // Safety net: if a tween is interrupted and never completes, the effect still
        // hands control back instead of stranding the player on a frozen screen.
        scene.time.delayedCall(holdMs ?? 2200, ctx.finish);
        return ctx;
    },

    // Full-screen blackout used as the common landing point for most effects.
    _curtain(scene, ctx, delay, dur) {
        const c = scene.add.rectangle(ctx.W / 2, ctx.H / 2, ctx.W, ctx.H, 0x000000, 0)
            .setScrollFactor(0).setDepth(960);
        ctx.track(c);
        scene.tweens.add({ targets: c, alpha: 1, duration: dur ?? 260, delay: delay ?? 0, ease: 'Quad.easeIn' });
        return c;
    },

    // ── TUTORIAL — "duality" ─────────────────────────────────────────────────
    // Fire sweeps in from the left, frost from the right; they meet dead centre and
    // detonate. The level teaches exactly two elements, so the animation is two halves
    // colliding.
    _duality(scene, accent, done) {
        const ctx = this._ctx(scene, done, 1900);
        const { W, H } = ctx;

        const fire = ctx.g(902);
        fire.fillStyle(0xff5522, 0.85); fire.fillRect(0, 0, W / 2, H);
        fire.fillStyle(0xffc23c, 0.5);  fire.fillRect(W / 2 - 40, 0, 40, H);
        fire.x = -W / 2;

        const ice = ctx.g(902);
        ice.fillStyle(0x2288cc, 0.85); ice.fillRect(0, 0, W / 2, H);
        ice.fillStyle(0xaaeeff, 0.5);  ice.fillRect(0, 0, 40, H);
        ice.x = W;

        scene.tweens.add({ targets: fire, x: 0, duration: 460, ease: 'Cubic.easeIn' });
        scene.tweens.add({ targets: ice,  x: W / 2, duration: 460, ease: 'Cubic.easeIn',
            onComplete: () => {
                scene.cameras.main.shake(220, 0.016);
                const burst = ctx.g(905);
                burst.fillStyle(0xffffff, 1); burst.fillCircle(0, 0, 40);
                burst.x = W / 2; burst.y = H / 2;
                scene.tweens.add({ targets: burst, scale: 26, alpha: 0, duration: 620, ease: 'Quad.easeOut' });
                // Steam ring — the two elements cancelling.
                for (let i = 0; i < 14; i++) {
                    const a = (i / 14) * Math.PI * 2;
                    const p = ctx.g(904);
                    p.fillStyle(0xdddddd, 0.5); p.fillCircle(0, 0, 7 + Math.random() * 9);
                    p.x = W / 2; p.y = H / 2;
                    scene.tweens.add({
                        targets: p, x: W / 2 + Math.cos(a) * (160 + Math.random() * 120),
                        y: H / 2 + Math.sin(a) * (120 + Math.random() * 100),
                        alpha: 0, scale: 2.4, duration: 700, ease: 'Quad.easeOut'
                    });
                }
                this._curtain(scene, ctx, 380, 300);
                scene.time.delayedCall(760, ctx.finish);
            }
        });
    },

    // ── STORM — forked lightning + strobe ────────────────────────────────────
    // Used by the Gauntlet (whose reward is LIGHTNING) and the Storm Chamber. Bolts are
    // built as real jagged polylines, and each strike is a flash + camera shake.
    _storm(scene, accent, done) {
        const ctx = this._ctx(scene, done, 2400);
        const { W, H } = ctx;

        const dark = ctx.g(901);
        dark.fillStyle(0x06080f, 1); dark.fillRect(0, 0, W, H);
        dark.alpha = 0;
        scene.tweens.add({ targets: dark, alpha: 0.9, duration: 320 });

        // Rain streaks: diagonal lines that fall and reset via a single yoyo-less tween.
        for (let i = 0; i < 34; i++) {
            const r = ctx.g(902);
            r.lineStyle(1.5, 0x88bbdd, 0.35);
            r.lineBetween(0, 0, -10, 26);
            r.x = Math.random() * (W + 120); r.y = -40 - Math.random() * 200;
            scene.tweens.add({ targets: r, y: H + 60, x: r.x - 90,
                duration: 520 + Math.random() * 420, delay: Math.random() * 700, ease: 'Linear' });
        }

        const bolt = (x0, delay) => {
            const b = ctx.g(904);
            b.lineStyle(4, 0xffffff, 0.95);
            let x = x0, y = -10;
            b.beginPath(); b.moveTo(x, y);
            while (y < H) { y += 34 + Math.random() * 34; x += (Math.random() - 0.5) * 120; b.lineTo(x, y); }
            b.strokePath();
            // Wider soft copy underneath for glow, drawn in the same object.
            b.lineStyle(11, accent, 0.3);
            let x2 = x0, y2 = -10;
            b.beginPath(); b.moveTo(x2, y2);
            while (y2 < H) { y2 += 48; x2 += (Math.random() - 0.5) * 60; b.lineTo(x2, y2); }
            b.strokePath();
            b.alpha = 0;
            scene.tweens.add({ targets: b, alpha: 1, duration: 40, delay,
                onComplete: () => {
                    scene.cameras.main.shake(120, 0.012);
                    const fl = scene.add.rectangle(W / 2, H / 2, W, H, 0xffffff, 0.55)
                        .setScrollFactor(0).setDepth(906);
                    ctx.track(fl);
                    scene.tweens.add({ targets: fl, alpha: 0, duration: 140 });
                    scene.tweens.add({ targets: b, alpha: 0, duration: 180, delay: 60 });
                }
            });
        };
        bolt(W * 0.28, 340); bolt(W * 0.66, 620); bolt(W * 0.45, 900);

        this._curtain(scene, ctx, 1250, 320);
        scene.time.delayedCall(1620, ctx.finish);
    },

    // ── RIFT — a tear opens and swallows the screen ──────────────────────────
    // For the Void Rift, whose final chest grants COSMIC. A vertical slit widens, and
    // debris is pulled INTO it rather than blown outward — the level is about being
    // drawn somewhere, not blasted.
    _rift(scene, accent, done) {
        const ctx = this._ctx(scene, done, 2500);
        const { W, H } = ctx;
        const cx = W / 2, cy = H / 2;

        const slit = ctx.g(904);
        slit.fillStyle(0x000000, 1); slit.fillRect(-3, -H / 2, 6, H);
        slit.fillStyle(accent, 0.9);  slit.fillRect(-1, -H / 2, 2, H);
        slit.x = cx; slit.y = cy; slit.scaleY = 0.02;
        scene.tweens.add({ targets: slit, scaleY: 1, duration: 420, ease: 'Cubic.easeOut' });

        // Debris pulled inward. Each shard is its own object so they can converge from
        // different distances on different curves.
        scene.time.delayedCall(360, () => {
            for (let i = 0; i < 30; i++) {
                const a = Math.random() * Math.PI * 2;
                const dist = 220 + Math.random() * 380;
                const s = ctx.g(903);
                s.fillStyle(i % 3 === 0 ? 0xffffff : accent, 0.85);
                s.fillRect(0, 0, 3 + Math.random() * 5, 3 + Math.random() * 5);
                s.x = cx + Math.cos(a) * dist; s.y = cy + Math.sin(a) * dist;
                scene.tweens.add({
                    targets: s, x: cx, y: cy, alpha: 0.2, angle: 360,
                    scale: 0.2, duration: 560 + Math.random() * 340,
                    delay: Math.random() * 260, ease: 'Quad.easeIn'
                });
            }
        });

        // The slit then widens to eat the whole screen.
        scene.time.delayedCall(900, () => {
            const maw = ctx.g(905);
            maw.fillStyle(0x000000, 1); maw.fillRect(-W / 2, -H / 2, W, H);
            maw.x = cx; maw.y = cy; maw.scaleX = 0.01;
            scene.tweens.add({ targets: maw, scaleX: 1, duration: 480, ease: 'Cubic.easeIn' });
            const rim = ctx.g(906);
            rim.lineStyle(3, accent, 1); rim.strokeCircle(0, 0, 30);
            rim.x = cx; rim.y = cy;
            scene.tweens.add({ targets: rim, scale: 14, alpha: 0, duration: 620, ease: 'Quad.easeOut' });
            scene.cameras.main.shake(420, 0.01);
            scene.time.delayedCall(560, ctx.finish);
        });
    },

    // ── FRACTURE — the screen cracks and the pieces fall away ────────────────
    // The level is literally split rooms, so the transition splits the view. Cracks are
    // drawn from the centre, then wedge-shaped shards rotate and drop.
    _fracture(scene, accent, done) {
        const ctx = this._ctx(scene, done, 2400);
        const { W, H } = ctx;
        const cx = W / 2, cy = H / 2;

        const cracks = ctx.g(903);
        cracks.lineStyle(2.5, accent, 0.95);
        const SPOKES = 9;
        for (let i = 0; i < SPOKES; i++) {
            const a = (i / SPOKES) * Math.PI * 2 + Math.random() * 0.3;
            let x = cx, y = cy;
            cracks.beginPath(); cracks.moveTo(x, y);
            const steps = 5 + Math.floor(Math.random() * 3);
            for (let s = 0; s < steps; s++) {
                const seg = (Math.max(W, H) / steps) * (0.5 + Math.random() * 0.6);
                x += Math.cos(a + (Math.random() - 0.5) * 0.7) * seg;
                y += Math.sin(a + (Math.random() - 0.5) * 0.7) * seg;
                cracks.lineTo(x, y);
            }
            cracks.strokePath();
        }
        cracks.alpha = 0;
        scene.tweens.add({ targets: cracks, alpha: 1, duration: 180, ease: 'Quad.easeOut' });
        scene.cameras.main.shake(180, 0.014);

        // Shards: triangular wedges from the centre that tumble off-screen.
        scene.time.delayedCall(300, () => {
            for (let i = 0; i < SPOKES; i++) {
                const a0 = (i / SPOKES) * Math.PI * 2;
                const a1 = ((i + 1) / SPOKES) * Math.PI * 2;
                const R = Math.max(W, H);
                const sh = ctx.g(904);
                sh.fillStyle(0x0b1220, 0.97);
                sh.fillTriangle(0, 0, Math.cos(a0) * R, Math.sin(a0) * R, Math.cos(a1) * R, Math.sin(a1) * R);
                sh.lineStyle(1.5, accent, 0.5);
                sh.strokeTriangle?.(0, 0, Math.cos(a0) * R, Math.sin(a0) * R, Math.cos(a1) * R, Math.sin(a1) * R);
                sh.x = cx; sh.y = cy;
                const mid = (a0 + a1) / 2;
                scene.tweens.add({
                    targets: sh, x: cx + Math.cos(mid) * 300, y: cy + Math.sin(mid) * 300 + 180,
                    angle: (Math.random() - 0.5) * 90, alpha: 0.1,
                    duration: 700, delay: i * 26, ease: 'Cubic.easeIn'
                });
            }
            this._curtain(scene, ctx, 420, 320);
            scene.time.delayedCall(860, ctx.finish);
        });
    },

    // ── BLUEPRINT — Engineering Defense ─────────────────────────────────────
    // The TD level is about building, so the screen draws ITSELF: a grid snaps in,
    // then tower footprints stamp down one by one with a mechanical pulse.
    _blueprint(scene, accent, done) {
        const ctx = this._ctx(scene, done, 2600);
        const { W, H } = ctx;

        const bg = ctx.g(900);
        bg.fillStyle(0x061018, 1); bg.fillRect(0, 0, W, H);
        bg.alpha = 0;
        scene.tweens.add({ targets: bg, alpha: 0.96, duration: 240 });

        // Grid drawn as two objects (verticals, horizontals) so each can wipe in from a
        // different axis — cheaper and cleaner than animating every line.
        const vert = ctx.g(901), horz = ctx.g(901);
        vert.lineStyle(1, accent, 0.28);
        for (let x = 0; x <= W; x += 34) vert.lineBetween(x, 0, x, H);
        horz.lineStyle(1, accent, 0.28);
        for (let y = 0; y <= H; y += 34) horz.lineBetween(0, y, W, y);
        vert.scaleX = 0; horz.scaleY = 0;
        scene.tweens.add({ targets: vert, scaleX: 1, duration: 420, delay: 120, ease: 'Quad.easeOut' });
        scene.tweens.add({ targets: horz, scaleY: 1, duration: 420, delay: 260, ease: 'Quad.easeOut' });

        // Tower stamps: a square footprint plus a range circle, punched in with Back ease
        // so each one lands with weight.
        const spots = [[0.24, 0.34], [0.5, 0.24], [0.76, 0.36], [0.34, 0.66], [0.66, 0.68], [0.5, 0.5]];
        spots.forEach(([fx, fy], i) => {
            const px = W * fx, py = H * fy;
            const t = ctx.g(903);
            t.lineStyle(2.5, accent, 0.95); t.strokeRect(-13, -13, 26, 26);
            t.lineStyle(1.5, accent, 0.35); t.strokeCircle(0, 0, 46);
            t.fillStyle(accent, 0.18); t.fillRect(-13, -13, 26, 26);
            t.x = px; t.y = py; t.scale = 0; t.alpha = 0;
            scene.tweens.add({
                targets: t, scale: 1, alpha: 1, duration: 260, delay: 620 + i * 105,
                ease: 'Back.easeOut',
                onComplete: () => {
                    const ring = ctx.g(904);
                    ring.lineStyle(2, 0xffffff, 0.8); ring.strokeCircle(0, 0, 16);
                    ring.x = px; ring.y = py;
                    scene.tweens.add({ targets: ring, scale: 3.2, alpha: 0, duration: 380, ease: 'Quad.easeOut' });
                    if (i === spots.length - 1) scene.cameras.main.shake(140, 0.008);
                }
            });
        });

        // Schematic sweep line, left to right, as the "print" pass.
        const sweep = ctx.g(905);
        sweep.fillStyle(accent, 0.5); sweep.fillRect(0, 0, 3, H);
        sweep.fillStyle(0xffffff, 0.9); sweep.fillRect(0, 0, 1, H);
        sweep.x = -6;
        scene.tweens.add({ targets: sweep, x: W + 6, duration: 900, delay: 500, ease: 'Sine.easeInOut' });

        this._curtain(scene, ctx, 1480, 320);
        scene.time.delayedCall(1840, ctx.finish);
    },

    // ── GATE — concentric portal rings collapsing inward ────────────────────
    _gate(scene, accent, done) {
        const ctx = this._ctx(scene, done, 2400);
        const { W, H } = ctx;
        const cx = W / 2, cy = H / 2;

        const dark = ctx.g(900);
        dark.fillStyle(0x0a0413, 1); dark.fillRect(0, 0, W, H);
        dark.alpha = 0;
        scene.tweens.add({ targets: dark, alpha: 0.92, duration: 300 });

        for (let i = 0; i < 7; i++) {
            const r = ctx.g(902);
            r.lineStyle(3 + i * 0.5, accent, 0.9 - i * 0.07);
            r.strokeCircle(0, 0, 60);
            r.x = cx; r.y = cy;
            r.scale = 6 + i * 1.5; r.alpha = 0;
            scene.tweens.add({ targets: r, alpha: 1, duration: 160, delay: i * 70 });
            scene.tweens.add({
                targets: r, scale: 0.05, angle: 180, alpha: 0.2,
                duration: 900, delay: i * 70, ease: 'Cubic.easeIn'
            });
        }
        // Collapse pop at the centre once the innermost ring lands.
        scene.time.delayedCall(1020, () => {
            const pop = ctx.g(905);
            pop.fillStyle(0xffffff, 1); pop.fillCircle(0, 0, 24);
            pop.x = cx; pop.y = cy;
            scene.tweens.add({ targets: pop, scale: 22, alpha: 0, duration: 520, ease: 'Quad.easeOut' });
            scene.cameras.main.shake(300, 0.012);
            this._curtain(scene, ctx, 160, 300);
            scene.time.delayedCall(560, ctx.finish);
        });
    },

    // ── CIRCUIT — PCB traces draw themselves, nodes light in sequence ───────
    _circuit(scene, accent, done) {
        const ctx = this._ctx(scene, done, 2500);
        const { W, H } = ctx;

        const bg = ctx.g(900);
        bg.fillStyle(0x081006, 1); bg.fillRect(0, 0, W, H);
        bg.alpha = 0;
        scene.tweens.add({ targets: bg, alpha: 0.95, duration: 260 });

        // Orthogonal traces only — a circuit board never runs diagonals, and the
        // right-angle look is what makes this read as a PCB rather than a cobweb.
        const nodes = [];
        for (let lane = 0; lane < 7; lane++) {
            const y = H * (0.16 + lane * 0.12);
            const tr = ctx.g(902);
            tr.lineStyle(2, accent, 0.75);
            let x = -20;
            tr.beginPath(); tr.moveTo(x, y);
            let cyy = y;
            while (x < W + 20) {
                const run = 60 + Math.random() * 120;
                x += run; tr.lineTo(x, cyy);
                if (Math.random() < 0.45) {
                    const jog = (Math.random() < 0.5 ? -1 : 1) * (18 + Math.random() * 26);
                    cyy += jog; tr.lineTo(x, cyy);
                    nodes.push([x, cyy]);
                }
            }
            tr.strokePath();
            tr.scaleX = 0;
            scene.tweens.add({ targets: tr, scaleX: 1, duration: 520, delay: lane * 70, ease: 'Quad.easeOut' });
        }

        nodes.slice(0, 26).forEach(([nx, ny], i) => {
            const n = ctx.g(903);
            n.fillStyle(0xffffff, 1); n.fillCircle(0, 0, 3.5);
            n.fillStyle(accent, 0.45); n.fillCircle(0, 0, 7);
            n.x = nx; n.y = ny; n.alpha = 0;
            scene.tweens.add({ targets: n, alpha: 1, scale: 1.5, duration: 150, delay: 560 + i * 34,
                yoyo: true, ease: 'Quad.easeOut' });
        });

        // Current pulse racing across once the board is drawn.
        const pulse = ctx.g(904);
        pulse.fillStyle(0xffffff, 0.85); pulse.fillRect(0, 0, 2, H);
        pulse.fillStyle(accent, 0.35); pulse.fillRect(-8, 0, 18, H);
        pulse.x = -20;
        scene.tweens.add({ targets: pulse, x: W + 20, duration: 620, delay: 700, ease: 'Quad.easeIn' });

        this._curtain(scene, ctx, 1420, 300);
        scene.time.delayedCall(1760, ctx.finish);
    },

    // ── ALERT — Final Stand ─────────────────────────────────────────────────
    // Red-alert framing: hazard bars sweep in from both edges, the vignette pulses,
    // and the whole thing strobes. No new mechanic to explain, so this sells threat.
    _alert(scene, accent, done) {
        const ctx = this._ctx(scene, done, 2500);
        const { W, H } = ctx;

        const dark = ctx.g(900);
        dark.fillStyle(0x120406, 1); dark.fillRect(0, 0, W, H);
        dark.alpha = 0;
        scene.tweens.add({ targets: dark, alpha: 0.9, duration: 240 });

        // Hazard stripes as two banks sliding in from opposite sides.
        const bank = (fromLeft) => {
            const b = ctx.g(902);
            for (let i = 0; i < 16; i++) {
                b.fillStyle(i % 2 ? accent : 0x1a0508, 0.9);
                b.fillRect(i * 42, 0, 26, 46);
            }
            b.x = fromLeft ? -700 : W + 700;
            b.y = fromLeft ? 40 : H - 86;
            scene.tweens.add({ targets: b, x: fromLeft ? -40 : W - 640, duration: 520, ease: 'Cubic.easeOut' });
            return b;
        };
        bank(true); bank(false);

        // Pulsing vignette, three beats.
        const vig = ctx.g(903);
        for (let i = 0; i < 8; i++) {
            vig.lineStyle(30, accent, 0.05);
            vig.strokeRect(-15 + i * 15, -15 + i * 15, W + 30 - i * 30, H + 30 - i * 30);
        }
        vig.alpha = 0;
        scene.tweens.add({ targets: vig, alpha: 1, duration: 280, yoyo: true, repeat: 2, ease: 'Sine.easeInOut' });

        // Strobe beats, each its own short-lived rectangle.
        [420, 760, 1080].forEach((d, i) => {
            scene.time.delayedCall(d, () => {
                const fl = scene.add.rectangle(W / 2, H / 2, W, H, accent, 0.3)
                    .setScrollFactor(0).setDepth(905);
                ctx.track(fl);
                scene.tweens.add({ targets: fl, alpha: 0, duration: 220 });
                scene.cameras.main.shake(160, 0.01 + i * 0.003);
            });
        });

        this._curtain(scene, ctx, 1340, 320);
        scene.time.delayedCall(1700, ctx.finish);
    },

    // ── WARP — THE END ──────────────────────────────────────────────────────
    // Starfield rushing outward past the camera, accelerating into white. The final
    // level is an arrival, so this one ends bright instead of black.
    _warp(scene, accent, done) {
        const ctx = this._ctx(scene, done, 2600);
        const { W, H } = ctx;
        const cx = W / 2, cy = H / 2;

        const dark = ctx.g(900);
        dark.fillStyle(0x000008, 1); dark.fillRect(0, 0, W, H);
        dark.alpha = 0;
        scene.tweens.add({ targets: dark, alpha: 1, duration: 300 });

        for (let i = 0; i < 90; i++) {
            const a = Math.random() * Math.PI * 2;
            const s = ctx.g(902);
            const len = 2 + Math.random() * 4;
            s.fillStyle(Math.random() < 0.2 ? accent : 0xffffff, 0.9);
            s.fillRect(0, 0, len, 1.6);
            s.x = cx; s.y = cy; s.rotation = a; s.alpha = 0;
            const dist = 340 + Math.random() * 520;
            scene.tweens.add({ targets: s, alpha: 1, duration: 90, delay: Math.random() * 700 });
            scene.tweens.add({
                targets: s, x: cx + Math.cos(a) * dist, y: cy + Math.sin(a) * dist,
                scaleX: 9 + Math.random() * 12, alpha: 0,
                duration: 620 + Math.random() * 420, delay: Math.random() * 700, ease: 'Cubic.easeIn'
            });
        }

        scene.time.delayedCall(1150, () => {
            const white = scene.add.rectangle(cx, cy, W, H, 0xffffff, 0)
                .setScrollFactor(0).setDepth(960);
            ctx.track(white);
            scene.cameras.main.shake(380, 0.008);
            scene.tweens.add({ targets: white, alpha: 1, duration: 460, ease: 'Quad.easeIn',
                               onComplete: ctx.finish });
        });
    },

    // ── AMBIENT PANEL LIFE ───────────────────────────────────────────────────
    // A looping, low-intensity version of each level's entry effect, played INSIDE the
    // level-select panel so the card previews what the level feels like. Same visual
    // vocabulary as the intros, so pressing ENTER escalates what you were already
    // watching rather than cutting to something unrelated.
    //
    // Constraints that shape everything below:
    //  * These loop for as long as the page is visible, so object counts stay low and
    //    every animation is `repeat: -1` on a transform. No per-frame redraws.
    //  * Geometry is built relative to the rect and clamped inside it. Phaser graphics
    //    do not clip to a parent, so anything that wandered outside would draw over the
    //    panel border and the loadout column next to it.
    //  * Returns { objs, destroy() }. The caller MUST destroy on page change or every
    //    page you visit leaves its tweens running forever.
    ambient(scene, kind, accent, rect) {
        const objs = [];
        const g = (d) => { const o = scene.add.graphics().setDepth(d ?? 5); objs.push(o); return o; };
        const X = rect.x, Y = rect.y, W = rect.w, H = rect.h;
        const cx = X + W / 2, cy = Y + H / 2;
        const T = (cfg) => scene.tweens.add(cfg);
        const R = (a, b) => a + Math.random() * (b - a);

        switch (kind) {
            case 'storm': {
                for (let i = 0; i < 16; i++) {
                    const r = g(5);
                    r.lineStyle(1.5, accent, 0.3);
                    r.lineBetween(0, 0, -7, 20);
                    r.x = R(X + 10, X + W - 10); r.y = Y - 20;
                    T({ targets: r, y: Y + H + 10, x: r.x - 70, duration: R(900, 1700),
                        delay: R(0, 1600), repeat: -1, ease: 'Linear' });
                }
                // Sheet-lightning flicker: one full-panel wash, pulsed on a long cycle.
                const fl = g(6);
                fl.fillStyle(accent, 0.14); fl.fillRoundedRect(X, Y, W, H, 14);
                fl.alpha = 0;
                T({ targets: fl, alpha: 1, duration: 90, yoyo: true, repeat: -1,
                    repeatDelay: 2300, hold: 40, ease: 'Quad.easeOut' });
                break;
            }
            case 'rift': {
                const slit = g(6);
                slit.fillStyle(accent, 0.5); slit.fillRect(-1.5, -H * 0.3, 3, H * 0.6);
                slit.x = cx; slit.y = cy;
                T({ targets: slit, scaleY: 1.25, alpha: 0.9, duration: 1600,
                    yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
                for (let i = 0; i < 14; i++) {
                    const a = R(0, Math.PI * 2), dist = R(70, Math.min(W, H) * 0.45);
                    const s = g(5);
                    s.fillStyle(i % 3 ? accent : 0xffffff, 0.55);
                    s.fillRect(0, 0, R(2, 4), R(2, 4));
                    const sx = cx + Math.cos(a) * dist, sy = cy + Math.sin(a) * dist;
                    s.x = sx; s.y = sy;
                    T({ targets: s, x: cx, y: cy, alpha: 0, angle: 180, duration: R(1500, 2600),
                        delay: R(0, 1800), repeat: -1, ease: 'Quad.easeIn',
                        onRepeat: () => { s.x = sx; s.y = sy; s.alpha = 0.55; } });
                }
                break;
            }
            case 'fracture': {
                const cr = g(5);
                cr.lineStyle(1.5, accent, 0.5);
                for (let i = 0; i < 7; i++) {
                    const a = (i / 7) * Math.PI * 2 + R(-0.3, 0.3);
                    let x = cx, y = cy;
                    cr.beginPath(); cr.moveTo(x, y);
                    for (let sgm = 0; sgm < 4; sgm++) {
                        x += Math.cos(a + R(-0.4, 0.4)) * (Math.min(W, H) / 9);
                        y += Math.sin(a + R(-0.4, 0.4)) * (Math.min(W, H) / 9);
                        // Clamp inside the panel: graphics do not clip to their parent.
                        x = Math.max(X + 6, Math.min(X + W - 6, x));
                        y = Math.max(Y + 6, Math.min(Y + H - 6, y));
                        cr.lineTo(x, y);
                    }
                    cr.strokePath();
                }
                cr.alpha = 0.25;
                T({ targets: cr, alpha: 0.7, duration: 1400, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
                break;
            }
            case 'blueprint': {
                const grid = g(5);
                grid.lineStyle(1, accent, 0.16);
                for (let x = X + 18; x < X + W; x += 26) grid.lineBetween(x, Y + 8, x, Y + H - 8);
                for (let y = Y + 18; y < Y + H; y += 26) grid.lineBetween(X + 8, y, X + W - 8, y);
                const scan = g(6);
                scan.fillStyle(accent, 0.30); scan.fillRect(0, 0, 2, H - 16);
                scan.x = X + 8; scan.y = Y + 8;
                T({ targets: scan, x: X + W - 10, duration: 2600, repeat: -1, ease: 'Sine.easeInOut', yoyo: true });
                break;
            }
            case 'gate': {
                for (let i = 0; i < 4; i++) {
                    const r = g(5);
                    r.lineStyle(2, accent, 0.4 - i * 0.06);
                    r.strokeCircle(0, 0, 34 + i * 24);
                    r.x = cx; r.y = cy;
                    T({ targets: r, angle: i % 2 ? -360 : 360, duration: 9000 + i * 2200,
                        repeat: -1, ease: 'Linear' });
                    T({ targets: r, alpha: 0.35, duration: 1700 + i * 300, yoyo: true,
                        repeat: -1, ease: 'Sine.easeInOut' });
                }
                break;
            }
            case 'circuit': {
                const tr = g(5);
                tr.lineStyle(1.5, accent, 0.35);
                const lanes = Math.max(3, Math.floor(H / 46));
                for (let l = 0; l < lanes; l++) {
                    let x = X + 12, y = Y + 22 + l * ((H - 44) / lanes);
                    tr.beginPath(); tr.moveTo(x, y);
                    while (x < X + W - 12) {
                        x = Math.min(X + W - 12, x + R(34, 86));
                        tr.lineTo(x, y);
                        if (Math.random() < 0.45) {
                            y = Math.max(Y + 12, Math.min(Y + H - 12, y + (Math.random() < 0.5 ? -14 : 14)));
                            tr.lineTo(x, y);
                        }
                    }
                    tr.strokePath();
                }
                const pulse = g(6);
                pulse.fillStyle(0xffffff, 0.55); pulse.fillRect(0, 0, 2, H - 20);
                pulse.fillStyle(accent, 0.22); pulse.fillRect(-6, 0, 14, H - 20);
                pulse.x = X + 10; pulse.y = Y + 10;
                T({ targets: pulse, x: X + W - 12, duration: 1900, repeat: -1,
                    repeatDelay: 700, ease: 'Quad.easeIn' });
                break;
            }
            case 'alert': {
                const vig = g(5);
                for (let i = 0; i < 4; i++) {
                    vig.lineStyle(14, accent, 0.05);
                    vig.strokeRoundedRect(X + 6 + i * 7, Y + 6 + i * 7, W - 12 - i * 14, H - 12 - i * 14, 12);
                }
                vig.alpha = 0.4;
                T({ targets: vig, alpha: 1, duration: 900, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
                const stripes = g(5);
                for (let i = 0; i < 10; i++) {
                    stripes.fillStyle(accent, 0.16);
                    stripes.fillRect(i * 34, 0, 15, 16);
                }
                stripes.x = X + 10; stripes.y = Y + H - 30;
                T({ targets: stripes, x: X + 10 - 34, duration: 1500, repeat: -1, ease: 'Linear' });
                break;
            }
            case 'warp': {
                for (let i = 0; i < 22; i++) {
                    const a = R(0, Math.PI * 2);
                    const st = g(5);
                    st.fillStyle(Math.random() < 0.25 ? accent : 0xffffff, 0.7);
                    st.fillRect(0, 0, R(2, 5), 1.4);
                    st.x = cx; st.y = cy; st.rotation = a; st.alpha = 0;
                    const reach = Math.min(W, H) * 0.42;
                    T({ targets: st, x: cx + Math.cos(a) * reach, y: cy + Math.sin(a) * reach,
                        scaleX: R(3, 8), alpha: 0.8, duration: R(1700, 3000), delay: R(0, 2200),
                        repeat: -1, ease: 'Quad.easeIn',
                        onRepeat: () => { st.x = cx; st.y = cy; st.alpha = 0; st.scaleX = 1; } });
                }
                break;
            }
            // ── ELEMENT AMBIENCES ────────────────────────────────────────────
            // Added for the shop carousel: one per weapon element. Lightning and cosmic
            // reuse 'storm' and 'warp' from the level set, so only fire and ice needed
            // new cases — keeping the shop inside the same visual vocabulary as the
            // level panels rather than inventing a second one.
            case 'ember': {
                for (let i = 0; i < 18; i++) {
                    const e = g(5);
                    const rad = R(1.5, 3.5);
                    e.fillStyle(Math.random() < 0.35 ? 0xffc23c : accent, R(0.35, 0.75));
                    e.fillCircle(0, 0, rad);
                    const sx = R(X + 12, X + W - 12);
                    e.x = sx; e.y = Y + H - 10;
                    T({ targets: e, y: Y + R(20, H * 0.45), x: sx + R(-30, 30), alpha: 0,
                        duration: R(2200, 4200), delay: R(0, 2600), repeat: -1, ease: 'Sine.easeOut',
                        onRepeat: () => { e.x = sx; e.y = Y + H - 10; e.alpha = R(0.35, 0.75); } });
                }
                // Heat shimmer at the base of the panel.
                const heat = g(5);
                heat.fillStyle(accent, 0.10);
                heat.fillRoundedRect(X, Y + H * 0.62, W, H * 0.38, 12);
                heat.alpha = 0.4;
                T({ targets: heat, alpha: 0.95, duration: 1700, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
                break;
            }
            case 'frost': {
                for (let i = 0; i < 20; i++) {
                    const f = g(5);
                    f.fillStyle(0xffffff, R(0.3, 0.7));
                    f.fillCircle(0, 0, R(1, 2.4));
                    const sx = R(X + 10, X + W - 10);
                    f.x = sx; f.y = Y - 8;
                    T({ targets: f, y: Y + H + 8, x: sx + R(-26, 26),
                        duration: R(3200, 6000), delay: R(0, 3200), repeat: -1, ease: 'Linear',
                        onRepeat: () => { f.x = sx; f.y = Y - 8; } });
                }
                // Frost creeping in from the corners — four wedges pulsing on a slow cycle.
                const fr = g(5);
                fr.fillStyle(accent, 0.13);
                fr.fillTriangle(X, Y, X + W * 0.34, Y, X, Y + H * 0.34);
                fr.fillTriangle(X + W, Y, X + W - W * 0.34, Y, X + W, Y + H * 0.34);
                fr.fillTriangle(X, Y + H, X + W * 0.34, Y + H, X, Y + H - H * 0.34);
                fr.fillTriangle(X + W, Y + H, X + W - W * 0.34, Y + H, X + W, Y + H - H * 0.34);
                fr.alpha = 0.35;
                T({ targets: fr, alpha: 1, duration: 2400, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
                break;
            }

            case 'duality':
            default: {
                const warm = g(5);
                warm.fillStyle(0xff6622, 0.10); warm.fillRoundedRect(X, Y, W / 2, H, 14);
                const cool = g(5);
                cool.fillStyle(0x44aaff, 0.10); cool.fillRoundedRect(X + W / 2, Y, W / 2, H, 14);
                warm.alpha = 1; cool.alpha = 0.25;
                T({ targets: warm, alpha: 0.25, duration: 2100, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
                T({ targets: cool, alpha: 1,    duration: 2100, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
                break;
            }
        }
        return {
            objs,
            destroy() { objs.forEach(o => { if (o?.active) { scene.tweens.killTweensOf(o); o.destroy(); } }); }
        };
    },

    // ── LOADING SCREEN ───────────────────────────────────────────────────────
    // Shown after the intro, before the scene swap. There is nothing genuinely async to
    // wait on here — Phaser has already loaded every asset in BootScene — so the bar
    // reports a fixed, honest duration rather than pretending to measure progress.
    // A fake bar that stalls at 90% is worse than a short deliberate one.
    loader(scene, o) {
        o = o || {};
        const P = UIKit.PALETTE;
        const W = scene.scale.width, H = scene.scale.height;
        const accent = o.accent ?? P.accentBlue;
        const dur = o.duration ?? 900;
        const objs = [];
        let finished = false;
        const track = (...a) => { objs.push(...a); return a[0]; };
        const finish = () => {
            if (finished) return;
            finished = true;
            objs.forEach(ob => { if (ob?.active) { scene.tweens.killTweensOf(ob); ob.destroy(); } });
            if (o.onDone) o.onDone();
        };

        track(scene.add.rectangle(W / 2, H / 2, W, H, 0x05080e, 1).setScrollFactor(0).setDepth(970));

        const sc = scene.add.graphics().setScrollFactor(0).setDepth(971);
        sc.fillStyle(0x000000, 0.18);
        for (let y = 0; y < H; y += 3) sc.fillRect(0, y, W, 1);
        track(sc);

        const title = track(scene.add.text(W / 2, H / 2 - 52, o.title || 'LOADING', {
            fontSize: '38px', fontFamily: 'monospace', fontStyle: 'bold',
            color: UIKit.CSS.textHi, stroke: '#000', strokeThickness: 5
        }).setOrigin(0.5).setScrollFactor(0).setDepth(973));
        title.alpha = 0;
        scene.tweens.add({ targets: title, alpha: 1, y: H / 2 - 58, duration: 320, ease: 'Quad.easeOut' });

        if (o.tag) {
            const tag = track(scene.add.text(W / 2, H / 2 - 22, o.tag, {
                fontSize: '14px', fontFamily: 'monospace', fontStyle: 'bold',
                color: UIKit._hex(accent), stroke: '#000', strokeThickness: 2
            }).setOrigin(0.5).setScrollFactor(0).setDepth(973));
            tag.alpha = 0;
            scene.tweens.add({ targets: tag, alpha: 1, duration: 320, delay: 120 });
        }

        // Bar. The fill is a separate graphics whose scaleX is tweened 0 to 1, so the
        // progress animation is one transform rather than a redraw per frame.
        const barW = Math.min(420, W - 120), barH = 10;
        const bx = W / 2 - barW / 2, by = H / 2 + 14;
        const back = track(scene.add.graphics().setScrollFactor(0).setDepth(972));
        back.fillStyle(0x000000, 0.7); back.fillRoundedRect(bx, by, barW, barH, 5);
        back.lineStyle(1.5, accent, 0.5); back.strokeRoundedRect(bx, by, barW, barH, 5);

        const fill = track(scene.add.graphics().setScrollFactor(0).setDepth(973));
        fill.fillStyle(accent, 1); fill.fillRoundedRect(0, 0, barW - 4, barH - 4, 4);
        fill.fillStyle(0xffffff, 0.25); fill.fillRoundedRect(0, 0, barW - 4, (barH - 4) * 0.4, 3);
        fill.x = bx + 2; fill.y = by + 2; fill.scaleX = 0;
        scene.tweens.add({ targets: fill, scaleX: 1, duration: dur, ease: 'Sine.easeInOut' });

        const pct = track(scene.add.text(W / 2, by + 26, '0%', {
            fontSize: '13px', fontFamily: 'monospace', color: UIKit.CSS.textLo
        }).setOrigin(0.5).setScrollFactor(0).setDepth(973));
        // Counter tween drives the label; addCounter exists precisely so a number can be
        // interpolated without a per-frame update hook.
        const counter = scene.tweens.addCounter({
            from: 0, to: 100, duration: dur, ease: 'Sine.easeInOut',
            onUpdate: t => { if (pct.active) pct.setText(Math.round(t.getValue()) + '%'); }
        });
        if (counter) objs.push({ active: true, destroy() { counter.remove?.(); } });

        const tip = (this.TIPS && this.TIPS.length)
            ? this.TIPS[Math.floor(Math.random() * this.TIPS.length)] : '';
        if (tip) {
            const tp = track(scene.add.text(W / 2, H - 64, 'TIP  ·  ' + tip, {
                fontSize: '14px', fontFamily: 'monospace', color: UIKit.CSS.textMid,
                wordWrap: { width: Math.min(620, W - 80) }, align: 'center'
            }).setOrigin(0.5).setScrollFactor(0).setDepth(973));
            tp.alpha = 0;
            scene.tweens.add({ targets: tp, alpha: 1, duration: 400, delay: 220 });
        }

        // Spinner: three dots pulsing in sequence. One tween each, looping.
        for (let i = 0; i < 3; i++) {
            const d = track(scene.add.graphics().setScrollFactor(0).setDepth(973));
            d.fillStyle(accent, 1); d.fillCircle(0, 0, 3.5);
            d.x = W / 2 - 14 + i * 14; d.y = by + 46; d.alpha = 0.25;
            scene.tweens.add({ targets: d, alpha: 1, duration: 300, yoyo: true,
                               repeat: -1, delay: i * 150, ease: 'Sine.easeInOut' });
        }

        scene.time.delayedCall(dur + 180, finish);
        return { finish };
    }
};