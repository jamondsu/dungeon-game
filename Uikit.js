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

    // ── IRON FRAME ───────────────────────────────────────────────────────────
    // The dungeon look every surface shares: a dark slab in an iron band, an accent
    // hairline inside the band, and a brass rivet in each corner. Drawn into an existing
    // graphics `g` at (x, y), so panels (screen space) and cards (container-local) use
    // the same strokes. `focus` brightens the hairline and the rivets.
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

    // CHAINED: something sealed. Two iron chains crossed over a box (x, y, w, h: its middle and size), links drawn
    // in pixels, and a padlock where they cross. Returns the graphics (pinned with o.fixed, at o.depth).
    chains(scene, x, y, w, h, o = {}) {
        const g = scene.add.graphics().setDepth(o.depth ?? 10).setPosition(x, y);
        if (o.fixed) g.setScrollFactor(0);
        const L = o.link ?? 7, hw = w / 2, hh = h / 2;
        const run = (x0, y0, x1, y1) => {   // a chain of oval links, alternating flat and edge-on
            const len = Math.hypot(x1 - x0, y1 - y0), n = Math.max(2, Math.floor(len / (L * 0.8))), a = Math.atan2(y1 - y0, x1 - x0);
            for (let i = 0; i <= n; i++) {
                const px = x0 + (x1 - x0) * i / n, py = y0 + (y1 - y0) * i / n, flat = i % 2 === 0;
                const lw = flat ? L : L * 0.9, lh = flat ? L * 0.62 : L * 0.28;
                const c = Math.cos(a), s = Math.sin(a), pts = [];
                for (let k = 0; k < 10; k++) { const t = k / 10 * Math.PI * 2, ex = Math.cos(t) * lw / 2, ey = Math.sin(t) * lh / 2; pts.push({ x: px + ex * c - ey * s, y: py + ex * s + ey * c }); }
                g.lineStyle(3.2, 0x0e0c0a, 0.95).strokePoints(pts, true);
                g.lineStyle(2, flat ? 0x8a8e96 : 0x6a6e76, 1).strokePoints(pts, true);
                if (flat) { g.lineStyle(1, 0xc8ccd4, 0.8); g.beginPath(); g.moveTo(pts[6].x, pts[6].y); g.lineTo(pts[7].x, pts[7].y); g.lineTo(pts[8].x, pts[8].y); g.strokePath(); }   // a glint
            }
        };
        run(-hw, -hh, hw, hh); run(-hw, hh, hw, -hh);
        const s = o.lock ?? Math.min(18, Math.max(10, Math.min(w, h) * 0.35));   // the padlock: a shackle and a body with a keyhole
        g.lineStyle(3.5, 0x0e0c0a, 1).strokeEllipse(0, -s * 0.35, s * 0.62, s * 0.8);
        g.lineStyle(2.2, 0x9a7a3a, 1).strokeEllipse(0, -s * 0.35, s * 0.62, s * 0.8);
        g.fillStyle(0x0e0c0a, 1).fillRoundedRect(-s / 2 - 1.5, -s * 0.15 - 1.5, s + 3, s * 0.75 + 3, 2.5);
        g.fillStyle(0xc89a3a, 1).fillRoundedRect(-s / 2, -s * 0.15, s, s * 0.75, 2);
        g.fillStyle(0xf0d070, 1).fillRect(-s / 2 + 1.5, -s * 0.15 + 1.5, s - 3, 1.5);
        g.fillStyle(0x2a1a08, 1).fillCircle(0, s * 0.12, s * 0.1).fillRect(-s * 0.04, s * 0.12, s * 0.08, s * 0.22);
        return g;
    },

    ironFrame(g, x, y, w, h, o = {}) {
        const P = this.PALETTE;
        const r = o.radius ?? 4, accent = o.accent ?? P.accentGold, focus = !!o.focus;
        if (o.shadow !== false) { g.fillStyle(0x000000, 0.55); g.fillRoundedRect(x + 3, y + 5, w, h, r); }
        if (o.body !== false) {
            g.fillStyle(o.bg ?? P.bgPanel, o.bgAlpha ?? 0.98);
            g.fillRoundedRect(x, y, w, h, r);
            // Faint stone courses across the slab: horizontal joints every 22px, so a big
            // panel reads as masonry rather than a flat fill.
            if (o.courses !== false && h > 60) {
                g.lineStyle(1, 0x000000, 0.18);
                for (let yy = y + 22; yy < y + h - 8; yy += 22) g.lineBetween(x + 6, yy, x + w - 6, yy);
                g.lineStyle(1, 0xffffff, 0.025);
                for (let yy = y + 23; yy < y + h - 8; yy += 22) g.lineBetween(x + 6, yy, x + w - 6, yy);
            }
        }
        // The iron band: a dark outer stroke, a lighter inner one for its bevel.
        g.lineStyle(4, P.iron, 1); g.strokeRoundedRect(x, y, w, h, r);
        g.lineStyle(1, P.ironHi, 0.9); g.strokeRoundedRect(x + 1.5, y + 1.5, w - 3, h - 3, Math.max(0, r - 1));
        g.lineStyle(1, 0x000000, 0.8); g.strokeRoundedRect(x - 2, y - 2, w + 4, h + 4, r + 2);
        // The accent hairline just inside the band: the panel's identity colour.
        g.lineStyle(focus ? 2 : 1, accent, focus ? 0.95 : 0.55);
        g.strokeRoundedRect(x + 5, y + 5, w - 10, h - 10, Math.max(0, r - 2));
        // Rivets.
        if (o.rivets !== false) {
            const ri = o.rivetInset ?? 9;
            for (const [cx, cy] of [[x + ri, y + ri], [x + w - ri, y + ri], [x + ri, y + h - ri], [x + w - ri, y + h - ri]]) {
                g.fillStyle(0x000000, 0.6); g.fillCircle(cx + 0.5, cy + 1, 3.2);
                g.fillStyle(focus ? accent : P.brass, 1); g.fillCircle(cx, cy, 2.8);
                g.fillStyle(0xffffff, 0.45); g.fillCircle(cx - 0.9, cy - 0.9, 1);
            }
        }
    },

    // ── PANEL ────────────────────────────────────────────────────────────────
    // An iron-framed stone slab (ironFrame), with an optional title. Scanlines and the
    // travelling highlight are still available (`scanlines: true`, `sweep: true`) but
    // off by default: they belong to the old terminal look, not to a dungeon.
    panel(scene, o) {
        const P = this.PALETTE;
        const x = o.x, y = o.y, w = o.w, h = o.h;
        const accent = o.accent ?? P.accentBlue;
        const d = o.depth ?? 50;
        const r = o.radius ?? 4;
        const objs = [];

        const g = scene.add.graphics().setDepth(d);
        if (o.fixed !== false) g.setScrollFactor(0);
        objs.push(g);

        this.ironFrame(g, x, y, w, h, { radius: r, accent, bg: o.bg, bgAlpha: o.bgAlpha });

        if (o.scanlines === true) {
            const s = this.scanlines(scene, {
                x: x + 2, y: y + 2, w: w - 4, h: h - 4,
                depth: d + 0.05, fixed: o.fixed !== false
            });
            objs.push(...s.objs);
        }
        if (o.sweep === true) {
            const s = this.sweepLine(scene, {
                x: x + r, y: y + 1, w: w - r * 2, accent,
                depth: d + 0.1, duration: o.sweepDuration ?? 2600,
                fixed: o.fixed !== false
            });
            objs.push(...s.objs);
        }
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
        const r = o.radius ?? 4;
        const objs = [];
        const fixed = o.fixed !== false;

        const g = scene.add.graphics().setDepth(d);
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
            g.clear();
            const off = press ? 1.5 : 0;
            const bw = press ? w - 3 : w, bh = press ? h - 3 : h;
            const bx = x - bw / 2, by = y - bh / 2 + off;
            if (o.shape === 'rune') {   // a carved rune stone: a slab with chamfered corners, its label cut into it, the accent glowing in the groove
                const c = Math.min(10, bh * 0.3), oct = (x0, y0, w0, h0, k) => [{ x: x0 + k, y: y0 }, { x: x0 + w0 - k, y: y0 }, { x: x0 + w0, y: y0 + k }, { x: x0 + w0, y: y0 + h0 - k }, { x: x0 + w0 - k, y: y0 + h0 }, { x: x0 + k, y: y0 + h0 }, { x: x0, y: y0 + h0 - k }, { x: x0, y: y0 + k }];
                if (hover && !press) { g.fillStyle(accent, 0.25); g.fillPoints(oct(bx - 4, by - 4, bw + 8, bh + 8, c + 3), true); }
                g.fillStyle(0x000000, 0.5); g.fillPoints(oct(bx + 2, by + 4, bw, bh, c), true);
                g.fillStyle(0x3a3448, 1); g.fillPoints(oct(bx, by, bw, bh, c), true);
                g.fillStyle(hover ? 0x5e566e : 0x524a62, 1); g.fillPoints(oct(bx + 2, by + 2, bw - 4, bh - 5, c - 1), true);
                g.fillStyle(0xffffff, 0.12); g.fillRect(bx + c, by + 3, bw - 2 * c, 2);
                for (let i = 0; i < bw / 14; i++) { const sx = bx + 8 + ((i * 37) % (bw - 16)), sy = by + 6 + ((i * 17) % (bh - 12)); g.fillStyle(0x000000, 0.15); g.fillRect(sx, sy, 3, 1); }   // its grain
                g.lineStyle(hover ? 2.5 : 1.5, accent, hover ? 1 : 0.7); g.strokePoints(oct(bx + 5, by + 5, bw - 10, bh - 11, Math.max(2, c - 4)), true);   // the glowing groove
                for (const sx of [bx + 14, bx + bw - 14]) { g.fillStyle(accent, hover ? 1 : 0.75); g.fillRect(sx - 1, by + bh / 2 - 6, 2, 12); g.fillRect(sx - 4, by + bh / 2 - 2, 8, 2); }   // a rune at each end
                return;
            }
            if (hover && !press) { g.fillStyle(accent, 0.22); g.fillRoundedRect(bx - 3, by - 3, bw + 6, bh + 6, r + 3); }
            g.fillStyle(0x000000, 0.5); g.fillRoundedRect(bx + 2, by + 3, bw, bh, r);
            // A wooden plank: the board, a lit top edge, a shadowed bottom one, a grain line.
            g.fillStyle(hover ? P.bgHover : P.bgRaised, 1); g.fillRoundedRect(bx, by, bw, bh, r);
            g.fillStyle(0xffffff, hover ? 0.1 : 0.06); g.fillRect(bx + 3, by + 2, bw - 6, 2);
            g.fillStyle(0x000000, 0.3); g.fillRect(bx + 3, by + bh - 4, bw - 6, 2);
            g.lineStyle(1, 0x000000, 0.16); g.lineBetween(bx + 10, by + bh * 0.55, bx + bw - 10, by + bh * 0.55);
            // The iron band round it, the accent glowing through on hover.
            g.lineStyle(3, P.iron, 1); g.strokeRoundedRect(bx, by, bw, bh, r);
            g.lineStyle(hover ? 2 : 1, accent, hover ? 1 : 0.6); g.strokeRoundedRect(bx + 3, by + 3, bw - 6, bh - 6, Math.max(0, r - 2));
            // Accent spine on the left edge — the strongest cheap "this is a control"
            // signal, and it survives at small sizes where a border does not.
            g.fillStyle(accent, hover ? 1 : 0.8);
            g.fillRoundedRect(bx + 6, by + 7, 3, bh - 14, 1.5);
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
        const R = o.radius ?? 6;
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

        // Crown: an iron strap across the top with the accent inlaid in it.
        g.fillStyle(P.iron, 1);
        g.fillRect(-w / 2 + 2, -h / 2 + 6, w - 4, 7);
        g.fillStyle(accent, focus ? 0.95 : 0.4);
        g.fillRect(-w / 2 + 2, -h / 2 + 8, w - 4, 3);

        // The iron band and rivets (ironFrame), on top of the layered body above. The
        // focused card's rivets and hairline take the accent: it reads as "chosen"
        // without another colour or another word.
        this.ironFrame(g, -w / 2, -h / 2, w, h, { radius: R, accent, focus, shadow: false, body: false, rivetInset: 11 });
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

    // ── CHEVRON ──────────────────────────────────────────────────────────────
    // A clickable arrow whose geometry is derived from the DIRECTION NAME, so it cannot
    // be drawn pointing the wrong way. The hand-rolled version this replaces built its
    // triangle as `cxp + sign*9` for the flat edge and `cxp - sign*7` for the apex --
    // which puts the point on the INSIDE. The left button rendered as a right-arrow and
    // the right button as a left-arrow, so clicking the one that looked like "next" went
    // back. Here the apex is always `+ out` along the axis, and `out` is +1 for
    // right/down and -1 for left/up; there is no sign to get backwards.
    chevron(scene, o) {
        const dir = o.dir;                                  // 'left' | 'right' | 'up' | 'down'
        const horiz = dir === 'left' || dir === 'right';
        const out = (dir === 'right' || dir === 'down') ? 1 : -1;
        const accent = o.accent ?? this.PALETTE.accentBlue;
        const d = o.depth ?? 7;
        const L = o.size ?? 9;                              // half-length along the axis
        const Wd = o.width ?? 7;                            // half-spread across it
        const x = o.x, y = o.y;

        const g = scene.add.graphics().setDepth(d);
        g.fillStyle(accent, 0.75);
        // Flat edge sits at -out, apex at +out. Swap the axes for a vertical arrow.
        if (horiz) g.fillTriangle(x - out * L, y - Wd, x - out * L, y + Wd, x + out * L, y);
        else       g.fillTriangle(x - Wd, y - out * L, x + Wd, y - out * L, x, y + out * L);

        const hitSize = o.hit ?? 40;
        const hit = scene.add.rectangle(x, y, hitSize, hitSize, 0xffffff, 0)
            .setDepth(d + 1).setInteractive({ useHandCursor: true });
        hit.on('pointerover', () => g.setAlpha(0.45));
        hit.on('pointerout',  () => g.setAlpha(1));
        hit.on('pointerup',   () => { if (o.onClick) o.onClick(); });
        return { objs: [g, hit], g, hit };
    },

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
        const scaleAt = a => SCALE[a] ?? 0.4;

        // Card CENTRE offset per step out from the focus.
        //
        // Uniform `off * spacing` looks wrong because the cards are NOT uniform. Going
        // from the focus card to its neighbour has to clear 1.00/2 + 0.72/2 = 0.86 of a
        // cardW before any gap is left over; the next step only has to clear
        // 0.72/2 + 0.50/2 = 0.61. One spacing value cannot satisfy both. At the old
        // 0.78*cardW the focus card OVERLAPPED its neighbours by 0.08*cardW while the
        // outer pair sat 0.17*cardW apart -- the middle looked cramped and the edges
        // looked right, which is the wrong way round.
        //
        // With `gap` given (a fraction of cardW) offsets accumulate instead, so the
        // EDGE-TO-EDGE distance between consecutive cards is identical everywhere.
        const gapPx = o.gap !== undefined ? o.gap * cardW : null;
        const OFFSETS = [0];
        for (let a = 1; a <= 2; a++) {
            OFFSETS[a] = gapPx === null
                ? a * spacing
                : OFFSETS[a - 1] + cardW * (scaleAt(a - 1) / 2 + scaleAt(a) / 2) + gapPx;
        }
        const xFor = off => cx + Math.sign(off) * (OFFSETS[Math.abs(off)] ?? Math.abs(off) * spacing);

        // How much the focused card grows under the cursor. The hit zone is built at
        // this size too -- if the zone were card-sized, moving onto the grown edge would
        // land outside it, fire pointerout, shrink the card back under the cursor, fire
        // pointerover again, and flicker.
        const HOVER_SCALE = 1.05;

        const place = (c, off) => {
            const a = Math.abs(off);
            c.x = xFor(off);
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
            this.softGlow(halo, cx - cardW / 2, cy - cardH / 2, cardW, cardH, o.accent,
                          { rings: 15, spread: 42, peak: 0.075, radius: 16 });
            objs.push(halo);
            // Breathes between 0.45 and 1 rather than up to a hard 0.55 ceiling, so the
            // resting state is the dim end and the card looks lit rather than flashing.
            halo.setAlpha(0.45);
            scene.tweens.add({ targets: halo, alpha: 1, duration: 2600,
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
            const sc = scaleAt(Math.abs(off));
            // The focus zone is built at the HOVERED size so the card cannot grow out
            // from under its own hit area (see HOVER_SCALE above).
            const zoneSc = off === 0 ? sc * HOVER_SCALE : sc;
            const hw = cardW * zoneSc, hh = cardH * zoneSc;
            if (off === 0 ? !!o.onActivate : !!o.onPick) {
                const hit = scene.add.zone(xFor(off), cy, hw, hh)
                    .setOrigin(0.5)
                    .setInteractive({
                        hitArea: new Phaser.Geom.Rectangle(0, 0, hw, hh),
                        hitAreaCallback: Phaser.Geom.Rectangle.Contains,
                        useHandCursor: true
                    })
                    // Side cards sit BELOW the centre so an overlapping edge can never
                    // steal a click from the focused card.
                    .setDepth((o.depth ?? 10) + (off === 0 ? 4 : 2));
                const delta = off;
                hit.on('pointerdown', () => { if (off === 0) o.onActivate(); else o.onPick(delta); });

                // ── FOCUS CARD IS THE BUTTON ─────────────────────────────
                // There is no separate ENTER button any more, so the card itself has to
                // carry the affordance: a hand cursor, an accent bloom, and a small
                // scale-up. The bloom is its own object rather than the shared halo
                // because the halo runs a looping alpha tween -- driving alpha from two
                // places would make hover fight the breathing animation.
                if (off === 0) {
                    const glow = scene.add.graphics().setDepth((o.depth ?? 10) + 2.6);
                    const gAcc = o.accent ?? 0xffffff;
                    const gw = cardW * HOVER_SCALE, gh = cardH * HOVER_SCALE;
                    const gx = cx - gw / 2, gy = cy - gh / 2;
                    this.softGlow(glow, gx, gy, gw, gh, gAcc,
                                  { rings: 18, spread: 54, peak: 0.12, radius: 14 });
                    // Edge in three passes instead of one hard 2px line at alpha 0.9. A
                    // single bright stroke is what read as a sticker outline; a wide faint
                    // pass under a thin bright one gives the edge some falloff of its own.
                    glow.lineStyle(6, gAcc, 0.10); glow.strokeRoundedRect(gx, gy, gw, gh, 14);
                    glow.lineStyle(3, gAcc, 0.22); glow.strokeRoundedRect(gx, gy, gw, gh, 14);
                    glow.lineStyle(1.25, gAcc, 0.62); glow.strokeRoundedRect(gx, gy, gw, gh, 14);
                    glow.setAlpha(0);
                    objs.push(glow);

                    // HOVER MUST NOT TOUCH THE ENTRY ANIMATION.
                    //
                    // This used to open with killTweensOf(face) — which killed whatever
                    // was animating that card, and during a page change that is the ENTRY
                    // tween: x/y from one slot over, scale, and alpha from 0. Hovering a
                    // card and then pressing an arrow leaves the cursor sitting exactly
                    // where the new focus card appears, so `pointerover` fired on the
                    // fresh hit zone the moment it was created and killed the entry
                    // mid-flight. Alpha stopped at 0 is the blank card; x/y stopped at the
                    // start offset is the off-position one. Both symptoms, one line.
                    //
                    // So: keep handles to only the tweens hover itself owns and cancel
                    // only those, and let the entry own the card until it lands. A hover
                    // that arrives mid-entry is remembered in `want` and applied on
                    // landing, so the card still lights up without the two fighting.
                    const hv = { entry: false, want: false, scaleT: null, glowT: null };
                    face._hv = hv;   // the entry block below flips hv.entry

                    // Cancelling a tween by a stored handle needs more than a null check.
                    // Once a tween COMPLETES, Phaser retires it and nulls its internals,
                    // but the handle you kept is still an object -- so `if (t) t.remove()`
                    // passes the guard and then throws "Cannot read properties of null"
                    // from inside Phaser's own remove(). Every hover after the first one
                    // hit this, because the previous hover tween had finished.
                    //
                    // Two defences, because a tween can leave in two different ways: the
                    // onComplete below drops the handle when it ends normally, and this
                    // checks it is still running for the case where something else killed
                    // it (a scene-wide killTweensOf, a destroyed target) without notice.
                    const stopT = (t) => {
                        if (!t) return null;
                        try {
                            if (typeof t.isPlaying !== 'function' || t.isPlaying()) t.remove();
                        } catch (e) { /* already retired by the manager */ }
                        return null;
                    };

                    const applyHover = (on) => {
                        if (!face.active) return;
                        hv.scaleT = stopT(hv.scaleT);
                        hv.glowT  = stopT(hv.glowT);
                        // Asymmetric on purpose: the card answers quickly on the way in
                        // and lets go slowly, which feels responsive without flickering
                        // when the cursor grazes an edge. Sine easing has no overshoot,
                        // so the glow never punches past its target and snaps back.
                        hv.scaleT = scene.tweens.add({ targets: face, scale: on ? HOVER_SCALE : 1,
                                           duration: on ? 180 : 260, ease: 'Sine.easeOut',
                                           onComplete: () => { hv.scaleT = null; } });
                        hv.glowT = scene.tweens.add({ targets: glow, alpha: on ? 1 : 0,
                                           duration: on ? 220 : 300, ease: 'Sine.easeOut',
                                           onComplete: () => { hv.glowT = null; } });
                    };
                    const setHover = (on) => {
                        hv.want = on;
                        if (hv.entry) return;          // entry owns the card until it lands
                        applyHover(on);
                    };
                    hv.onLanded = () => { hv.entry = false; if (hv.want) applyHover(true); };

                    hit.on('pointerover', () => setHover(true));
                    hit.on('pointerout',  () => setHover(false));
                    // Pressing dips the card slightly so the click reads as a press
                    // rather than only as a scene change. Skipped mid-entry for the same
                    // reason, and it cancels the hover tween rather than every tween.
                    hit.on('pointerdown', () => {
                        if (!face.active || hv.entry) return;
                        hv.scaleT = stopT(hv.scaleT);
                        hv.scaleT = scene.tweens.add({ targets: face, scale: HOVER_SCALE * 0.97,
                                           duration: 80, yoyo: true, ease: 'Quad.easeOut',
                                           onComplete: () => { hv.scaleT = null; } });
                    });
                }
                objs.push(hit);
            }

            // ── ENTRY ANIMATION ──────────────────────────────────────────
            // Two modes, because the row is paged on two different axes and the motion
            // should follow the axis of the key that caused it. Paging weapons with
            // left/right rotates the ring sideways; switching ELEMENT with up/down used
            // to reuse that same sideways rotate, so a vertical input produced horizontal
            // motion and the screen appeared to scroll the wrong way.
            //
            // `enterY` takes precedence: the whole row drops in from above or below
            // without any x shift, staggered slightly from the centre outward so it reads
            // as one object landing rather than three cards arriving at once.
            if (o.enterY) {
                const a = Math.abs(off);
                face.x = xFor(off);
                face.y = cy + o.enterY;
                face.setScale(scaleAt(a));
                face.setAlpha(0);
                const dur = o.duration ?? 260;
                // Claim the card for the duration of the flight; hover defers to this and
                // is replayed on landing. Only the focus card has _hv.
                if (face._hv) face._hv.entry = true;
                scene.tweens.add({ targets: face, y: cy, duration: dur + a * 40,
                                   delay: a * 35, ease: 'Back.easeOut',
                                   onComplete: () => { if (face._hv) face._hv.onLanded(); } });
                scene.tweens.add({ targets: face, alpha: ALPHA[a] ?? 0.15,
                                   duration: dur * 0.8, delay: a * 35, ease: 'Quad.easeOut' });
            } else if (o.dir) {
                const from = off + o.dir;
                const af = Math.abs(from);
                face.x = xFor(from);
                face.setScale(scaleAt(af));
                face.setAlpha(0);
                const tScale = scaleAt(Math.abs(off));
                const tAlpha = ALPHA[Math.abs(off)] ?? 0.15;
                if (face._hv) face._hv.entry = true;
                scene.tweens.add({ targets: face, x: xFor(off), scale: tScale,
                                   duration: o.duration ?? 260, ease: 'Cubic.easeOut',
                                   onComplete: () => { if (face._hv) face._hv.onLanded(); } });
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

        // o.icon: 'glorp' or 'fragment', a pixel sprite before the label (the HUD's glorp card look)
        const ic = o.icon ? this.currencyIcon(scene, o.icon) : null;
        const icon = ic ? scene.add.image(0, o.y, ic[0], ic[1]).setScale(ic[2]).setDepth(d + 0.2) : null;
        if (icon && fixed) icon.setScrollFactor(0);
        const padX = 12, h = o.h ?? 30, iw = icon ? icon.displayWidth + 8 : 0;
        const align = o.align ?? 0;
        const g = scene.add.graphics().setDepth(d);
        if (fixed) g.setScrollFactor(0);
        const draw = () => {
            const w = txt.width + iw + padX * 2, x = o.x - w * align;
            icon?.setX(x + padX + icon.displayWidth / 2); txt.x = x + padX + iw;
            g.clear();
            g.fillStyle(0x000000, 0.45); g.fillRoundedRect(x + 1, o.y - h / 2 + 2, w, h, 8);
            g.fillStyle(0x090b14, 0.92); g.fillRoundedRect(x, o.y - h / 2, w, h, 8);
            g.lineStyle(1, accent, 0.6); g.strokeRoundedRect(x + 0.5, o.y - h / 2 + 0.5, w - 1, h - 1, 8);
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
        if (kind !== 'fragment' || typeof MenuArt === 'undefined') return null;
        return [MenuArt.tex(scene, 'ui_fragment', 9, 11, P => {
            for (let y = 0; y < 11; y++) for (let x = 0; x < 9; x++) {
                const dx = Math.abs(x - 4), dy = Math.abs(y - 5);
                if (dx / 4.5 + dy / 5.5 > 1) continue;
                const edge = dx / 4.5 + dy / 5.5 > 0.72;
                P.put(x, y, edge ? 0x2a5ad8 : x < 4 && y < 5 ? 0xd8f0ff : x < 4 || y < 5 ? 0x8ac8ff : 0x4a8aff);
            }
        }), undefined, 2];
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
        this.brickWall(g, 0, 0, W, H);
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
    // Staggered courses of dark brick, each a slightly different shade, with a lit top
    // edge and a shadowed bottom one. Drawn once into a static graphics; seeded, so a
    // scene looks the same every time it opens.
    brickWall(g, x, y, w, h, o = {}) {
        const P = this.PALETTE;
        const BW = o.brickW ?? 56, BH = o.brickH ?? 24;
        let s = o.seed ?? 7;
        const rnd = () => { s = (s * 16807) % 2147483647; return s / 2147483647; };
        g.fillStyle(P.mortar, 1); g.fillRect(x, y, w, h);
        for (let row = 0, yy = y; yy < y + h; row++, yy += BH) {
            for (let xx = x - (row % 2 ? BW / 2 : 0); xx < x + w; xx += BW) {
                const shade = P.bricks[Math.floor(rnd() * P.bricks.length)];
                g.fillStyle(shade, 1); g.fillRect(xx + 1, yy + 1, BW - 2, BH - 2);
                g.fillStyle(0xffffff, 0.035); g.fillRect(xx + 1, yy + 1, BW - 2, 2);
                g.fillStyle(0x000000, 0.25); g.fillRect(xx + 1, yy + BH - 3, BW - 2, 2);
                if (rnd() < 0.18) { g.fillStyle(0x000000, 0.22); g.fillRect(xx + 6 + rnd() * (BW - 16), yy + 5 + rnd() * (BH - 12), 3, 2); }
            }
        }
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