// ═══════════════════════════════════════════════════════════════════════
// Extracted from index.html. This file is now the ONLY copy: index.html
// loads it with a <script src> tag. Editing the file used to do nothing,
// because a duplicate lived inline and that duplicate was what ran.
// ═══════════════════════════════════════════════════════════════════════

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

    // BAKE: a Graphics that never changes, drawn once into a texture (on the CPU, through the canvas renderer) and
    // shown as an Image. A Graphics is re-tessellated and re-uploaded every frame it's on screen; an Image is one quad.
    // (x0, y0, w, h): the part of the Graphics' own space to keep. Returns the Image (the Graphics is destroyed), or
    // the Graphics untouched where it can't be baked.
    bake(scene, g, x0, y0, w, h, key) {
        w = Math.ceil(w); h = Math.ceil(h);
        if (!g?.generateTexture || w < 1 || h < 1 || w > 4096 || h > 4096) return g;
        key ||= 'baked_' + (UIKit._bakeN = (UIKit._bakeN || 0) + 1);
        if (!scene.textures.exists(key)) {
            const sf = [g.scrollFactorX, g.scrollFactorY], pos = [g.x, g.y];
            g.setScrollFactor(0).setPosition(-x0, -y0);   // the texture's camera scrolls with the Graphics' position, unless it ignores scroll
            g.generateTexture(key, w, h);
            g.setScrollFactor(...sf).setPosition(...pos);
        }
        const img = scene.add.image(g.x + x0, g.y + y0, key).setOrigin(0).setDepth(g.depth).setAlpha(g.alpha).setScrollFactor(g.scrollFactorX, g.scrollFactorY);
        g.destroy();
        return img;
    },

    // R METER: the bar over the player for a weapon's R, drawn into graphics `g` (the caller clears it) with its
    // top-left at (x, y). A frame with pointed ends, the fill lit along its top with a sheen running through it,
    // notches with o.segs, and a gem at its left for the key. Ready (full, or o.ready): the frame pulses, a halo
    // wakes round it and two sparks run its edge. o: col, hot, dark, h, time, segs, ready, gem (false: none).
    rBar(g, x, y, w, frac, o = {}) {
        const h = o.h || 6, t = o.time || 0, col = o.col ?? 0xffffff, hot = o.hot ?? 0xffffff, dark = o.dark ?? 0x0a0a0a;
        const k = Math.max(0, Math.min(1, frac)), ready = o.ready ?? k >= 1, pulse = ready ? 0.6 + 0.4 * Math.sin(t / 130) : 0;
        const hex = (x0, y0, ww, hh) => { const c = Math.min(hh / 2, ww / 2); return [{ x: x0, y: y0 + hh / 2 }, { x: x0 + c, y: y0 }, { x: x0 + ww - c, y: y0 }, { x: x0 + ww, y: y0 + hh / 2 }, { x: x0 + ww - c, y: y0 + hh }, { x: x0 + c, y: y0 + hh }]; };
        if (ready) { g.fillStyle(col, 0.1 + 0.18 * pulse); g.fillPoints(hex(x - 5, y - 4, w + 10, h + 8), true); }
        g.fillStyle(dark, 0.85); g.fillPoints(hex(x - 2, y - 2, w + 4, h + 4), true);
        const fw = w * k;
        if (fw > 0.5) {
            g.fillStyle(col, 1); g.fillPoints(hex(x, y, fw, h), true);
            const c = Math.min(h / 2, fw / 2);
            g.fillStyle(hot, 0.85); g.fillRect(x + c, y, fw - 2 * c, Math.max(1, h / 4));
            g.fillStyle(0x000000, 0.25); g.fillRect(x + c, y + h - Math.max(1, h / 4), fw - 2 * c, Math.max(1, h / 4));
            const sx = x - 8 + ((t / 5) % (w + 24));   // the sheen running through the fill
            if (sx > x && sx + 5 < x + fw) { g.fillStyle(0xffffff, ready ? 0.7 : 0.4); g.fillPoints([{ x: sx + 3, y }, { x: sx + 6, y }, { x: sx + 3, y: y + h }, { x: sx, y: y + h }], true); }
        }
        for (let i = 1; i < (o.segs || 0); i++) { g.fillStyle(dark, 0.9); g.fillRect(x + w * i / o.segs - 0.5, y, 1, h); }
        g.lineStyle(1, ready ? hot : col, ready ? 0.6 + 0.4 * pulse : 0.5); g.strokePoints(hex(x - 2, y - 2, w + 4, h + 4), true);
        if (ready) for (let j = 0; j < 2; j++) {   // sparks running round the edge
            const u = (t / 900 + j / 2) % 1, px = u < 0.5 ? x - 1 + (w + 2) * u * 2 : x + w + 1 - (w + 2) * (u - 0.5) * 2, py = u < 0.5 ? y - 2 : y + h + 2;
            g.fillStyle(col, 0.5); g.fillCircle(px, py, 2.6); g.fillStyle(0xffffff, 1); g.fillCircle(px, py, 1.2);
        }
        if (o.gem !== false) this.rGem(g, x - 9, y + h / 2, ready ? 1 : k, { col, hot, dark, time: t, ready });
    },
    // the key gem: a diamond filling from the bottom, lit and pulsing when ready
    rGem(g, x, y, frac, o = {}) {
        const s = o.s || 5, t = o.time || 0, col = o.col ?? 0xffffff, ready = o.ready ?? frac >= 1, pulse = ready ? 0.6 + 0.4 * Math.sin(t / 130) : 0;
        const d = (r) => [{ x, y: y - r }, { x: x + r, y }, { x, y: y + r }, { x: x - r, y }];
        if (ready) { g.fillStyle(col, 0.2 + 0.25 * pulse); g.fillPoints(d(s + 4), true); }
        g.fillStyle(o.dark ?? 0x0a0a0a, 0.9); g.fillPoints(d(s + 1), true);
        const f = Math.max(0, Math.min(1, frac));
        if (f > 0) {   // filled from the bottom: the diamond cut at the fill's height
            const top = y + s - 2 * s * f, wAt = yy => s - Math.abs(yy - y);
            const pts = top <= y ? [{ x: x - wAt(top), y: top }, { x: x + wAt(top), y: top }, { x: x + s, y }, { x, y: y + s }, { x: x - s, y }] : [{ x: x - wAt(top), y: top }, { x: x + wAt(top), y: top }, { x, y: y + s }];
            g.fillStyle(ready ? (o.hot ?? 0xffffff) : col, ready ? 0.8 + 0.2 * pulse : 0.85); g.fillPoints(pts, true);
        }
        g.lineStyle(1, ready ? 0xffffff : col, ready ? 0.9 : 0.6); g.strokePoints(d(s + 1), true);
    },

    // CHAINED: something sealed. Two iron chains crossed over a box (x, y, w, h: its middle and size), typed links laid
    // along each one, flat and edge-on by turns (ui_kit lk_*: small or, with o.link over 8, big; at 45 degrees or about
    // 22, whichever the box's diagonal is nearer), and a padlock where they cross. Returns a container (pinned with
    // o.fixed, at o.depth).
    chains(scene, x, y, w, h, o = {}) {
        const c = scene.add.container(Math.round(x), Math.round(y)).setDepth(o.depth ?? 10);
        if (o.fixed) c.setScrollFactor(0);
        const L = o.link ?? 7, hw = w / 2, hh = h / 2, steep = Math.atan2(h, w) > Math.PI * 3 / 16, big = L > 8 && steep;
        const link = flat => (big ? 'lk_b45' : steep ? 'lk_s45' : 'lk_s22') + (flat ? '' : 'e');
        const run = (x0, y0, x1, y1, flip) => {
            const n = Math.max(2, Math.floor(Math.hypot(x1 - x0, y1 - y0) / (L * 0.8)));
            for (let i = 0; i <= n; i++) c.add(scene.add.image(Math.round(x0 + (x1 - x0) * i / n), Math.round(y0 + (y1 - y0) * i / n), 'ui_kit', link(i % 2 === 0)).setFlipX(flip));
        };
        run(-hw, -hh, hw, hh, false); run(-hw, hh, hw, -hh, true);
        const s = o.lock ?? Math.min(18, Math.max(10, Math.min(w, h) * 0.35));   // the padlock, its body just below the crossing
        c.add(scene.add.image(0, 0, 'ui_kit', 'padlock').setOrigin(0.5, 8 / 15).setScale(s >= 20 ? 2 : 1));
        return c;
    },

    // ── NINE-SLICE ───────────────────────────────────────────────────────────
    // A ui_kit frame (typed by hand: assets/art/ui_kit) made to fit a w x h box: its corners as typed, its edges and
    // middle repeated from the template's middle (repeated, not stretched, so its pixels stay its pixels), then its
    // accent layer (white in the file) in `color`. `extra(put)` lays more frames on before the accent: put(frame, bx, by,
    // len) repeats one along a row from box (bx, by); `marks` ([frame, bx, by]) are stamped into the accent layer.
    // Made once per size and colour. Returns { key, pl, pt }: the texture reaches pl/pt pixels left of and above the box
    // (a shadow, a halo, end spikes).
    nine(scene, base, acc, w, h, color, extra, marks) {
        w = Math.max(1, Math.round(w)); h = Math.max(1, Math.round(h));
        const T = scene.textures, kit = T.get('ui_kit'), [pl, pt, pr, pb, L, Tc, R, B] = kit.get(base || acc).customData.nine;
        const key = `ui9_${base}_${acc}_${w}x${h}_${color ?? ''}` + (extra ? '_x' : '') + (marks ? '_m' : '');
        if (T.exists(key)) return { key, pl, pt };
        const TW = w + pl + pr, TH = h + pt + pb, ct = T.createCanvas(key, TW, TH), ctx = ct.getContext();
        const paint = (c, name) => {
            const f = kit.get(name), img = f.source.image, FW = f.cutWidth, FH = f.cutHeight;
            const sx = [0, L, FW - R, FW], sy = [0, Tc, FH - B, FH], dx = [0, L, TW - R, TW], dy = [0, Tc, TH - B, TH];
            for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) {
                const sw = sx[i + 1] - sx[i], sh = sy[j + 1] - sy[j], dw = dx[i + 1] - dx[i], dh = dy[j + 1] - dy[j];
                if (sw <= 0 || sh <= 0 || dw <= 0 || dh <= 0) continue;
                for (let yy = 0; yy < dh; yy += sh) for (let xx = 0; xx < dw; xx += sw) {
                    const ww = Math.min(sw, dw - xx), hh = Math.min(sh, dh - yy);
                    c.drawImage(img, f.cutX + sx[i], f.cutY + sy[j], ww, hh, dx[i] + xx, dy[j] + yy, ww, hh);
                }
            }
        };
        if (base) paint(ctx, base);
        extra?.((name, bx, by, len) => {
            const f = kit.get(name);
            for (let xx = 0; xx < len; xx += f.cutWidth) { const ww = Math.min(f.cutWidth, len - xx); ctx.drawImage(f.source.image, f.cutX, f.cutY, ww, f.cutHeight, pl + bx + xx, pt + by, ww, f.cutHeight); }
        });
        if (acc) {
            const tmp = document.createElement('canvas'), t = tmp.getContext('2d');
            tmp.width = TW; tmp.height = TH;
            paint(t, acc);
            for (const [name, bx, by] of marks || []) { const f = kit.get(name); t.drawImage(f.source.image, f.cutX, f.cutY, f.cutWidth, f.cutHeight, pl + Math.round(bx), pt + Math.round(by), f.cutWidth, f.cutHeight); }
            t.globalCompositeOperation = 'source-in'; t.fillStyle = this._hex(color ?? 0xffffff); t.fillRect(0, 0, TW, TH);
            ctx.drawImage(tmp, 0, 0);
        }
        ct.refresh();
        return { key, pl, pt };
    },
    // An Image of nine(): its box's top left at (x, y)
    nineImage(scene, base, acc, x, y, w, h, color, extra) {
        const n = this.nine(scene, base, acc, w, h, color, extra);
        return scene.add.image(Math.round(x) - n.pl, Math.round(y) - n.pt, n.key).setOrigin(0);
    },

    // ── PANEL ────────────────────────────────────────────────────────────────
    // An iron-framed stone slab (ui_kit 'panel': the band, its bevel, four brass rivets, its shadow), its accent
    // hairline inside the band, a mortar joint across it every 22 pixels when it's tall, and an optional title.
    panel(scene, o) {
        const P = this.PALETTE;
        const x = Math.round(o.x), y = Math.round(o.y), w = Math.round(o.w), h = Math.round(o.h);
        const accent = o.accent ?? P.accentBlue;
        const d = o.depth ?? 50;
        const objs = [];

        const g = this.nineImage(scene, 'panel', 'panel_a', x, y, w, h, accent, put => {
            if (h > 60) for (let yy = 22; yy < h - 8; yy += 22) { const riv = yy >= h - 13; put('panel_joint', riv ? 13 : 6, yy, w - (riv ? 26 : 12)); }   // (clear of the bottom rivets)
        }).setDepth(d);
        if (o.fixed !== false) g.setScrollFactor(0);
        objs.push(g);

        if (o.title) {
            const t = scene.add.text(x + 20, y + 22, o.title, {
                fontSize: o.titleSize ?? '20px', fontFamily: this.FONT.title,
                color: this._hex(accent), fontStyle: 'bold',
                stroke: '#000', strokeThickness: 3
            }).setOrigin(0, 0.5).setDepth(d + 0.2);
            if (o.fixed !== false) t.setScrollFactor(0);
            objs.push(t);
            // Title underline that stops short of the text width — a full-width rule
            // makes the header feel detached from the title.
            const u = this.nineImage(scene, null, 'rule', x + 20, y + 37, Math.min(w - 40, t.width + 30), 2, accent).setDepth(d + 0.15);
            if (o.fixed !== false) u.setScrollFactor(0);
            objs.push(u);
        }

        return { gfx: g, objs, destroy() { objs.forEach(ob => ob?.active && ob.destroy()); } };
    },

    // ── BUTTON ───────────────────────────────────────────────────────────────
    // A plank in an iron band (ui_kit 'btn'), accent left spine, hover glow + text brighten, and a
    // pushed-in look. The hit area is a separate invisible rectangle rather than
    // making the graphics interactive: a graphics object's hit area does not follow
    // rounded geometry, so a rectangle is both more predictable and cheaper.
    button(scene, o) {
        const P = this.PALETTE;
        const x = o.x, y = o.y, w = o.w ?? 220, h = o.h ?? 42;
        const accent = o.accent ?? P.accentBlue;
        const d = o.depth ?? 52;
        const objs = [];
        const fixed = o.fixed !== false;

        const rune = o.shape === 'rune';
        const g = scene.add.image(0, 0, '__DEFAULT').setOrigin(0).setDepth(d);
        if (fixed) g.setScrollFactor(0);
        objs.push(g);

        const txt = scene.add.text(x, y, o.label ?? '', {
            fontSize: o.fontSize ?? '15px', fontFamily: this.FONT.title, fontStyle: 'bold',
            color: this._hex(o.textColor ?? P.textHi),
            stroke: '#000', strokeThickness: 3
        }).setOrigin(0.5).setDepth(d + 0.2);
        if (fixed) txt.setScrollFactor(0);
        objs.push(txt);

        const draw = (hover, press) => {
            if (!rune) {   // a wooden plank in an iron band (ui_kit 'btn': normal, hover, pushed in), its accent hairline and spine
                const st = press ? '_down' : hover ? '_hover' : '';
                const n = this.nine(scene, 'btn' + st, 'btn_a' + st, w, h, accent);
                g.setTexture(n.key).setPosition(Math.round(x - w / 2) - n.pl, Math.round(y - h / 2) - n.pt);
                return;
            }
            // a carved rune stone (ui_kit 'rune': a slab with its corners cut, its shadow), the groove round it glowing
            // in the accent and a rune at each end; pushed, it sinks a pixel
            const st = hover && !press ? '_hover' : '';
            const n = this.nine(scene, 'rune' + st, 'rune_a' + st, w, h, accent, null, [['rune_mark', 10, h / 2 - 6], ['rune_mark', w - 18, h / 2 - 6]]);
            g.setTexture(n.key).setPosition(Math.round(x - w / 2) - n.pl, Math.round(y - h / 2) - n.pt + (press ? 1 : 0));
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
            Sfx.play(scene, 'hover');
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
            Sfx.play(scene, 'click');
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
            if (!hit.active || !hit.scene) return;          // a button that's gone (its screen closed, the scene restarted) fires nothing
            if (Date.now() - lastFired < 350) return;      // object handler already won
            const px = pointer.x, py = pointer.y;
            if (Math.abs(px - x) > w / 2 || Math.abs(py - y) > h / 2) return;
            // something drawn over this button catches the click, not us (a room built over a menu
            // let the menu's MAP button fire through it)
            const dep = o2 => (o2.parentContainer?.depth ?? 0) + (o2.depth ?? 0), under = scene.input.hitTestPointer?.(pointer) || [];
            if (under.some(o2 => o2 !== hit && o2.visible !== false && dep(o2) > dep(hit))) return;
            lastFired = Date.now();
            draw(false, true);
            if (action) action();
        };
        scene.input.on(fireOn === 'down' ? 'pointerdown' : 'pointerup', sceneFallback);
        // the scene's input listeners outlive a restart: the tutorial picker's buttons kept firing on the map
        // afterwards (a click where its card had been started the tutorial)
        scene.events.once('shutdown', () => scene.input.off(fireOn === 'down' ? 'pointerdown' : 'pointerup', sceneFallback));
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

    // ── SOFT BLOOM ───────────────────────────────────────────────────────────
    // Draws a glow as many faint rounded rects at growing insets.
    //
    // What made the old version look cheap was the step count and the falloff, not the
    // colour: five rings 8px apart with alpha rising LINEARLY (0.055 x k) leaves visible
    // concentric edges, and because alpha compounds where rings overlap the innermost
    // band landed near 0.8 -- a stack of plates rather than light. Fourteen rings with a
    // cubic falloff puts most of the density in the first few pixels and trails to
    // nothing at the rim, which is roughly how light actually falls off, and at
    // spread/rings ~= 3px the bands sit closer together than they are wide, so the seams
    // disappear. Quadratic, not cubic: cubic drove the outer third of the rings below the
    // visibility threshold, which threw away the soft tail and left the bloom both tight
    // and too faint to read.
    //
    // `peak` is per-ring, NOT the final alpha. Rings composite over each other, so the
    // visible centre is ~1-(1-peak)^n; keep peak low and let the stack do the work.
    softGlow(g, x, y, w, h, color, o = {}) {
        const rings  = o.rings  ?? 14;
        const spread = o.spread ?? 46;
        const peak   = o.peak   ?? 0.11;
        const radius = o.radius ?? 14;
        for (let i = rings; i >= 1; i--) {
            const t = i / rings;                 // 1 = outermost ring
            const pad = spread * t;
            const a = peak * Math.pow(1 - t, 2); // tight core, long soft tail
            if (a <= 0.0012) continue;
            g.fillStyle(color, a);
            g.fillRoundedRect(x - pad, y - pad, w + pad * 2, h + pad * 2, radius + pad * 0.5);
        }
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

        // o.icon: 'glorp' or 'fragment', a pixel sprite before the label (the HUD's glorp card look)
        const ic = o.icon ? this.currencyIcon(scene, o.icon) : null;
        const icon = ic ? scene.add.image(0, o.y, ic[0], ic[1]).setScale(ic[2]).setDepth(d + 0.2) : null;
        if (icon && fixed) icon.setScrollFactor(0);
        const padX = 12, h = o.h ?? 30, iw = icon ? icon.displayWidth + 8 : 0;
        const align = o.align ?? 0;
        const g = scene.add.image(0, 0, '__DEFAULT').setOrigin(0).setDepth(d);   // the capsule (ui_kit 'pill'), its rim in the accent
        if (fixed) g.setScrollFactor(0);
        const draw = () => {
            const w = Math.round(txt.width + iw + padX * 2), x = Math.round(o.x - w * align);
            icon?.setX(x + padX + icon.displayWidth / 2); txt.x = x + padX + iw;
            const n = this.nine(scene, 'pill', 'pill_a', w, h, accent);
            g.setTexture(n.key).setPosition(x - n.pl, Math.round(o.y - h / 2) - n.pt);
        };
        draw();
        objs.push(g, txt); if (icon) objs.push(icon);

        // setText must resize the pill, so the caller gets a helper rather than the
        // raw text object — updating the label without redrawing the capsule was a
        // guaranteed source of text overflowing its own background.
        const self = this;
        return {
            gfx: g, txt, objs,
            setLabel(s) { txt.setText(s); draw(); },
            destroy() { objs.forEach(ob => ob?.active && ob.destroy()); }
        };
    },

    // A currency's pixel sprite: [texture, frame, scale]. The glorp is the pickup (CreatureFX's sheet); a fragment, a blue crystal.
    currencyIcon(scene, kind) {
        if (kind === 'glorp' && typeof CreatureFX !== 'undefined' && CreatureFX.sheets(scene)) return ['cfx_bits', 'glorp', 2.4];
        return kind === 'fragment' && scene.textures.exists('ui_fragment') ? ['ui_fragment', undefined, 2] : null;
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

        const g = scene.add.image(0, 0, this.bricks(scene, W, H)).setOrigin(0).setDepth(d).setScrollFactor(0);
        objs.push(g);

        // Vignette: concentric edge bands. Phaser has no radial gradient, so a few
        // nested translucent frames approximate one at negligible cost.
        const v = scene.add.graphics().setDepth(d + 0.1).setScrollFactor(0);
        for (let i = 0; i < 7; i++) {
            v.lineStyle(26, 0x000000, 0.055);
            v.strokeRect(-13 + i * 13, -13 + i * 13, W + 26 - i * 26, H + 26 - i * 26);
        }
        objs.push(v);

        // Torchlight pooling from both upper corners, warmer than the stone.
        const glow = scene.add.graphics().setDepth(d + 0.05).setScrollFactor(0);
        this.softGlow(glow, -60, -60, 120, 120, P.torch, { spread: 260, peak: 0.03, radius: 60 });
        this.softGlow(glow, W - 60, -60, 120, 120, P.torch, { spread: 260, peak: 0.03, radius: 60 });
        objs.push(glow);

        const m = this.motes(scene, { x: 0, y: 0, w: W, h: H, accent: o.moteColor ?? P.torch, depth: d + 0.2, count: o.motes ?? 16 });
        objs.push(...m.objs);

        return { objs, motes: m, destroy() { m.destroy(); objs.forEach(ob => ob?.active && ob.destroy()); } };
    },

    // ── BRICK WALL ───────────────────────────────────────────────────────────
    // A wall of typed bricks (ui_kit brick_<shade>_<cut>: five shades, plain or chipped) w x h, in staggered courses of
    // 56 x 24, which shade and cut each brick is picked by a seeded roll, so a scene looks the same every time it opens.
    // Returns its texture key.
    bricks(scene, w, h, seed = 7) {
        w = Math.ceil(w); h = Math.ceil(h);
        const key = `ui_bricks_${w}x${h}_${seed}`, T = scene.textures, BW = 56, BH = 24;
        if (T.exists(key)) return key;
        const ct = T.createCanvas(key, w, h), ctx = ct.getContext(), kit = T.get('ui_kit');
        let s = seed;
        const rnd = () => { s = (s * 16807) % 2147483647; return s / 2147483647; };
        ctx.fillStyle = this._hex(this.PALETTE.mortar); ctx.fillRect(0, 0, w, h);
        for (let row = 0, yy = 0; yy < h; row++, yy += BH) {
            for (let xx = row % 2 ? -BW / 2 : 0; xx < w; xx += BW) {
                const shade = Math.floor(rnd() * 5);
                let cut = 0;
                if (rnd() < 0.18) { cut = rnd() < 0.5 ? 1 : 2; rnd(); }   // (two rolls for a chip: each brick keeps its shade)
                const f = kit.get(`brick_${shade}_${cut}`);
                ctx.drawImage(f.source.image, f.cutX, f.cutY, BW, BH, xx, yy, BW, BH);
            }
        }
        ct.refresh();
        return key;
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
    // The dungeon: soot-dark stone and old wood, iron bands, brass, parchment text.
    bgDeep:   0x0d0a08,
    bgPanel:  0x1b1612,
    bgRaised: 0x2a221b,
    bgHover:  0x3a2f24,
    line:     0x4a3c2e,

    // Text tones, measured (UIKit.contrast) against bgPanel 0x1b1612:
    //   textHi 14.75:1   textMid 9.95:1   textLo 6.04:1
    // Worst case is textLo on bgHover at 4.39:1, still above the 3:1 floor.
    // textDeep is only for text sitting ON a saturated accent fill — see onColor().
    // textLo is the dimmest tone allowed to carry words. For comparison, the palette
    // this replaced shipped body text between 1.39:1 and 1.96:1, i.e. invisible.
    textHi:   0xf4e8cc,
    textMid:  0xd2bf98,
    textLo:   0xa89370,
    textDeep: 0x120c06,

    // Accents keep their identities (fire is orange, ice is blue...) but sit a little
    // warmer and less neon, like enamel and gems rather than LEDs.
    accentBlue:   0x6cb4f0,
    accentGold:   0xf0b84a,
    accentGreen:  0x7fd06a,
    accentRed:    0xf0604c,
    accentPurple: 0xb48cf0,
    accentCyan:   0x5ed4c8,
    accentOrange: 0xf0913c,

    // Materials for frames and backdrops.
    iron:    0x2e2a26,
    ironHi:  0x5e574e,
    brass:   0xc89a4a,
    torch:   0xff9a3c,
    mortar:  0x0a0807,
    bricks:  [0x211b16, 0x1e1914, 0x241d17, 0x1c1713, 0x221c16]
};

// Fonts: a serif for titles and buttons (carved-sign feel), monospace for the rest.
UIKit.FONT = { title: 'Georgia, "Palatino Linotype", "Book Antiqua", serif', body: 'monospace' };

// css mirror for text styles, derived so it cannot drift from the numeric values.
UIKit.CSS = Object.fromEntries(
    Object.entries(UIKit.PALETTE).filter(([, v]) => typeof v === 'number')
        .map(([k, v]) => [k, '#' + (v >>> 0).toString(16).padStart(6, '0')])
);


// ── ElementResist.js ────────────────────────────────────────────────────

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