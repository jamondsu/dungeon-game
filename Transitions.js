// ═══════════════════════════════════════════════════════════════════════
// Extracted from index.html. This file is now the ONLY copy: index.html
// loads it with a <script src> tag. Editing the file used to do nothing,
// because a duplicate lived inline and that duplicate was what ran.
// ═══════════════════════════════════════════════════════════════════════

// ─────────────────────────────────────────────────────────────────────────────
// Transitions — entering a level, the title card, and the atmospheres behind levels.
//
// Entering a level: an iris closes onto the level you chose on the map, then its title
// card (its painting in an iron frame, its name drawn on, an ink line filling while the
// level builds). The same card, without the painting, is the restart loader.
//
// TEARDOWN CONTRACT
// These run immediately before `scene.start(...)`, so they race scene teardown. Every one
// tracks what it creates and finishes through a ONE-SHOT guard: several parallel tweens
// must not call scene.start() more than once (the second start tears down the scene the
// first is still building). A timed backstop finishes them even if a tween never lands.
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
        { name: 'The Cistern',       tag: 'THE FLOOR IS WATER', kind: 'flood',     accent: 0x3fb6e8 },
        { name: 'Void Gate',         tag: 'CLOSE THE PORTALS',  kind: 'gate',      accent: 0xb388ff },
        { name: 'Circuit Maze',      tag: 'ROUTE THE CURRENT',  kind: 'circuit',   accent: 0xff9f45 },
        { name: 'Final Stand',       tag: 'NO MERCY',           kind: 'alert',     accent: 0xff5f52 },
        { name: 'THE END',           tag: 'THE VOID SOVEREIGN', kind: 'warp',      accent: 0xffc23c }
    ],

    TIPS: [
        'Tip: Slimes cannot read. Do not leave them notes.',
        'Tip: Dying is bad. Try not doing that.',
        'Tip: Fire resistant slimes are just regular slimes with a superiority complex. Hit them with ice. Or lightning.',
        'Tip: The Barrier Staff knocks enemies back every time it eats a shot.',
        'Tip: Glurp does not do refunds. Glurp has never done refunds. Glurp does not know what a refund is.',
        'Tip: Hold V with two cosmic layers to transform. Tap it and you just feel very confident for 6 seconds.',
        'Tip: Frozen slimes temporarily lose health. Finish them fast, before they recover.',
        'Tip: Shift is a dash. Mashing it does not make you dash harder, but it feels like it does.',
        'Tip: Q and F throw your gadgets. The Decoy Slime is not your friend. It is a distraction with feelings :(.',
        'Tip: Ult gems fill from hitting things. Hitting walls does not count. Trust me, I checked.',
        'Tip: Your stats train in tiers of 5. No skipping leg day.',
        'Tip: The Cistern is wet. This is not a tip, just a warning.',
        'Tip: Lightning is great at crowds and terrible at bosses. Like a golden retriever.',
        'Tip: Astral marks pop for ult charge. Pop them. It is very satisfying.',
        'Tip: A hit that bounces off a resistant slime makes a little clink. That clink is judging you. Do better, switch elements.',
        'Tip: Cosmic weapons are buffs. Switch in, cast, switch back. Like a costume change but deadlier.',
        'Tip: First clears pay fragments. Second clears pay vibes.',
        'Tip: Health pots heal you. Eating them off the floor is fine. The five second rule doesnt exist here.',
        'Tip: The Void Sovereign has a crown. You dont. Fix that king/queen.',
        'Tip: Mend Totem heals you if you stand near it. Standing near it is the hard part.',
        'Tip: Slimes respawn when you restart. They do not remember you. You remember them.',
        'Tip: M mutes everything. ESC pauses. Neither makes the slimes go away, theres another shortcut for that shhh.',
        'Tip: Talents unlock every 5 stat levels. Opening Strike makes the first hit spicy.',
        'Tip: Twin Collapse from the Cosmic Ult hits harder the farther apart you throw it. Go big.',
        'Tip: If a room seals behind you, that is called commitment.'
    ],

    // Ambient kind per weapon element, used by the shop carousel. Lightning and cosmic
    // deliberately share the level set's effects — the shop should feel like the same
    // game as the level select, not a separate art direction.
    ELEMENT_FX: { fire: 'ember', ice: 'frost', lightning: 'storm', cosmic: 'warp' },

    // Several level kinds render the SAME atmosphere — rift, gate and warp are all the
    // space scene. Callers key their "has the backdrop changed?" check on this group
    // rather than the raw kind, so moving between two void levels does not tear down and
    // rebuild an identical starfield.
    atmoGroup(kind) {
        if (kind === 'rift' || kind === 'gate' || kind === 'warp') return 'space';
        return kind;
    },

    infoFor(index) {
        return this.LEVELS[index] || { name: 'Level ' + (index + 1), tag: '', kind: 'duality', accent: 0x4aa8ff };
    },

    // ── ENTERING A LEVEL ─────────────────────────────────────────────────────
    // `from`: the screen point the iris closes onto (the level's medallion); the middle if
    // left out. Then the title card, then `onDone` (the caller's scene.start).
    enterLevel(scene, index, onDone, from = null) {
        const info = this.infoFor(index);
        if (typeof Music !== 'undefined') Music.play(scene, null);   // the map's music fades; the level brings its own
        this._iris(scene, from, info.accent, () =>
            this._card(scene, { title: info.name, tag: info.tag, accent: info.accent, art: index, onDone }));
    },

    // A dark iris closing on a point, ringed in the level's colour.
    _iris(scene, from, accent, then) {
        Sfx.play(scene, 'whoosh');
        const W = scene.scale.width, H = scene.scale.height;
        const cx = from?.x ?? W / 2, cy = from?.y ?? H / 2;
        const objs = [];
        let finished = false;
        const finish = () => {
            if (finished) return;
            finished = true;
            objs.forEach(o => { if (o?.active) { scene.tweens.killTweensOf(o); o.destroy(); } });
            then();
        };
        const veil = scene.add.rectangle(W / 2, H / 2, W, H, 0x05040a, 1).setScrollFactor(0).setDepth(990);
        const hole = scene.make.graphics({}, false);
        const mask = hole.createGeometryMask();
        mask.setInvertAlpha?.(true);
        veil.setMask(mask);
        const ring = scene.add.graphics().setScrollFactor(0).setDepth(991);
        objs.push(veil, hole, ring);
        const st = { r: Math.hypot(Math.max(cx, W - cx), Math.max(cy, H - cy)) + 20 };
        Sfx.play(scene, 'dash');
        // closes down to a spotlight on the slime, holds there a moment, then snaps shut
        const HOLD_R = 46, draw = () => {
            hole.clear().fillStyle(0xffffff, 1).fillCircle(cx, cy, Math.max(0.1, st.r));
            ring.clear().lineStyle(3, accent, 0.95).strokeCircle(cx, cy, st.r)
                .lineStyle(1, 0xffffff, 0.5).strokeCircle(cx, cy, st.r + 6);
        };
        draw();   // now, not on the tween's first update: an empty hole leaves the veil covering everything for a frame (a black blink)
        scene.tweens.add({ targets: st, r: HOLD_R, duration: 700, ease: 'Cubic.easeInOut', onUpdate: draw,
            onComplete: () => {
                scene.tweens.add({ targets: st, r: HOLD_R - 4, duration: 260, yoyo: true, ease: 'Sine.easeInOut', onUpdate: draw });
                scene.time.delayedCall(620, () => scene.tweens.add({ targets: st, r: 0, duration: 220, ease: 'Cubic.easeIn', onUpdate: draw,
                    onComplete: () => scene.time.delayedCall(80, finish) }));
            } });
        scene.time.delayedCall(2200, finish);
    },

    // The title card: a dim wall in torchlight, embers of the level's colour rising, the
    // level's painting in an iron frame (`art`: its index; left out for a plain loader), its
    // name drawn on, a gold rule, its tag, an ink line filling, a tip. `onDone` once.
    //
    // The ink line stops short of the end (FILL_CAP): scene.start() then builds the level
    // synchronously and the browser can't paint meanwhile, so the frozen last frame shows a
    // line still going rather than one that looks finished and hung.
    _card(scene, o) {
        o = o || {};
        const P = UIKit.PALETTE, W = scene.scale.width, H = scene.scale.height, D = 970;
        const accent = o.accent ?? P.accentGold, dur = o.duration ?? 2400, FILL_CAP = 0.92;   // long enough to read the tip
        const objs = [], track = (...a) => { objs.push(...a); return a[0]; };
        let finished = false;
        const finish = () => {
            if (finished) return;
            finished = true;
            if (o.onDone) o.onDone();
            // cleared a moment later, not now: onDone's scene.start only swaps scenes next frame, and a card gone this frame
            // showed the map for one frame (the "blink" entering a level). A scene that does change takes them with it.
            scene.time.delayedCall(60, () => objs.forEach(ob => { if (ob?.active) { scene.tweens.killTweensOf(ob); ob.destroy(); } }));
        };
        if (typeof MenuArt !== 'undefined') MenuArt.basics(scene);
        const pin = ob => track(ob.setScrollFactor(0));

        const wall = pin(scene.add.graphics().setDepth(D));
        wall.fillStyle(P.bgDeep, 1).fillRect(0, 0, W, H);
        UIKit.brickWall(wall, 0, 0, W, H);
        wall.fillStyle(0x000000, 0.62).fillRect(0, 0, W, H);
        UIKit.softGlow(wall, -60, -60, 120, 120, P.torch, { spread: 300, peak: 0.035, radius: 60 });
        UIKit.softGlow(wall, W - 60, -60, 120, 120, P.torch, { spread: 300, peak: 0.035, radius: 60 });
        if (scene.textures.exists('mn_px2')) pin(scene.add.particles(0, 0, 'mn_px2', {
            x: { min: 0, max: W }, y: H + 6, lifespan: 4000, speedY: { min: -70, max: -30 }, speedX: { min: -10, max: 10 },
            scale: { start: 1.4, end: 0 }, alpha: { start: 0.8, end: 0 }, tint: [accent, MenuArt.mix(accent, 0xffffff, 0.5)],
            blendMode: 'ADD', frequency: 60,
        }).setDepth(D + 1));

        // the painting, in its frame, settling into place
        const hasArt = o.art !== undefined && typeof MenuArt !== 'undefined' && MenuArt.diorama;
        let ty = H * 0.5;
        if (hasArt) {
            const aw = Math.min(560, W - 80), ah = Math.round(aw * 0.3), ax = W / 2 - aw / 2, ay = H * 0.4 - ah / 2 - 30;
            const frame = pin(scene.add.graphics().setDepth(D + 2));
            frame.fillStyle(0x05070c, 1).fillRect(ax, ay, aw, ah);
            const art = pin(scene.add.container(0, 0).setDepth(D + 2));
            art.add(MenuArt.diorama(scene, o.art, W / 2, ay + ah / 2, aw, ah, { live: true }).objs);
            const m = scene.make.graphics({}, false); m.fillRect(ax, ay, aw, ah); track(m);
            art.setMask(m.createGeometryMask());
            const rim = pin(scene.add.graphics().setDepth(D + 3));
            UIKit.ironFrame(rim, ax - 4, ay - 4, aw + 8, ah + 8, { accent, body: false, shadow: false, courses: false });
            for (const ob of [frame, art, rim]) { ob.setAlpha(0); scene.tweens.add({ targets: ob, alpha: 1, duration: 320, ease: 'Quad.easeOut' }); }
            ty = ay + ah + 70;
        }

        // the name, drawn on left to right from the middle
        const title = pin(scene.add.text(W / 2, ty, o.title || 'Loading', {
            fontSize: '46px', fontFamily: UIKit.FONT.title, fontStyle: 'bold', color: UIKit.CSS.textHi, stroke: '#000', strokeThickness: 6,
        }).setOrigin(0.5).setDepth(D + 4));
        const wipe = scene.make.graphics({}, false); track(wipe);
        title.setMask(wipe.createGeometryMask());
        const ws = { w: 0 };
        scene.tweens.add({ targets: ws, w: title.width + 40, duration: 420, delay: 120, ease: 'Cubic.easeOut',
            onUpdate: () => wipe.clear().fillStyle(0xffffff, 1).fillRect(W / 2 - ws.w / 2, ty - 40, ws.w, 80) });
        const rule = pin(scene.add.graphics().setDepth(D + 4).setPosition(W / 2, ty + 36));
        rule.fillStyle(P.accentGold, 0.9).fillRect(-140, 0, 280, 2);
        rule.fillStyle(P.accentGold, 1).fillPoints([{ x: 0, y: -4 }, { x: 5, y: 1 }, { x: 0, y: 6 }, { x: -5, y: 1 }], true);
        rule.setScale(0, 1);
        scene.tweens.add({ targets: rule, scaleX: 1, duration: 380, delay: 300, ease: 'Cubic.easeOut' });
        if (o.tag) {
            const tag = pin(scene.add.text(W / 2, ty + 58, o.tag, { fontSize: '17px', fontFamily: UIKit.FONT.title, fontStyle: 'italic', color: UIKit._hex(accent) })
                .setOrigin(0.5).setDepth(D + 4).setAlpha(0));
            scene.tweens.add({ targets: tag, alpha: 1, duration: 300, delay: 420 });
        }

        // the ink line, filling while the level builds
        const lw = Math.min(360, W - 120), ly = ty + 92;
        const line = pin(scene.add.graphics().setDepth(D + 4));
        line.fillStyle(0x000000, 0.6).fillRect(W / 2 - lw / 2, ly, lw, 3);
        const ink = pin(scene.add.rectangle(W / 2 - lw / 2, ly, lw, 3, accent, 1).setOrigin(0, 0).setDepth(D + 5).setScale(0, 1));
        scene.tweens.add({ targets: ink, scaleX: FILL_CAP, duration: dur, ease: 'Sine.easeInOut' });

        const tips = this.TIPS || [];
        if (tips.length) {
            const tp = pin(scene.add.text(W / 2, H - 56, tips[Math.floor(Math.random() * tips.length)], {
                fontSize: '15px', fontFamily: UIKit.FONT.title, fontStyle: 'italic', color: UIKit.CSS.textMid,
                wordWrap: { width: Math.min(640, W - 80) }, align: 'center',
            }).setOrigin(0.5).setDepth(D + 4).setAlpha(0));
            scene.tweens.add({ targets: tp, alpha: 1, duration: 400, delay: 300 });
        }

        scene.time.delayedCall(dur + 200, finish);
        return { finish };
    },

    // ── FULL-SCREEN ATMOSPHERE ───────────────────────────────────────────────
    // The level select's background IS the level you are looking at: rain falling behind
    // everything with lightning striking for the Gauntlet, open space with drifting
    // planets for the void levels. The earlier version confined this to the inside of a
    // card, where a "storm" was a few pixels of drizzle in a 400px box and read as noise.
    //
    // Drawn at NEGATIVE depth so it sits behind the whole UI, and sized to the screen
    // rather than to a rect. Returns { objs, destroy() }; the caller MUST destroy on
    // change or each atmosphere you visit keeps its tweens running forever.
    //
    // Still tween-only: every mover is one small graphics with one looping tween. The
    // counts below are the budget — raising them is the easiest way to make this scene
    // stutter, since these run continuously rather than for the length of a transition.
    atmosphere(scene, kind, accent) {
        const objs = [];
        const W = scene.scale.width, H = scene.scale.height;
        const g = (d) => { const o = scene.add.graphics().setScrollFactor(0).setDepth(d ?? -5); objs.push(o); return o; };
        const T = (c) => scene.tweens.add(c);
        const R = (a, b) => a + Math.random() * (b - a);
        const P = UIKit.PALETTE;

        // Base wash — every atmosphere sits on a tinted field so the whole screen reads
        // as the place, not just the moving parts.
        const wash = (col, alpha) => { const b = g(-9); b.fillStyle(col, alpha); b.fillRect(0, 0, W, H); return b; };

        switch (kind) {

            // ── STORM — the Gauntlet and the Storm Chamber ────────────────
            case 'flood': {
                // DEEP water. Not a lit pool -- somewhere with a great deal of ocean above it.
                // The read comes from depth cues rather than brightness: a gradient that only
                // gets darker as it goes down, pressure closing in at the edges, marine snow
                // falling through it, and slow shapes passing somewhere overhead. It should be
                // dark enough to feel like a place you should not be, and alive enough that the
                // dark is obviously water and not an unlit room.
                wash(0x02111b, 0.95);

                // Light dying with depth. Seven bands, each fainter than the last, so the top of
                // the screen is merely dark and the bottom is genuinely black.
                for (let i = 0; i < 7; i++) {
                    const band = g(-9);
                    band.fillStyle(0x0a3346, Math.max(0, 0.115 - i * 0.017));
                    band.fillRect(0, (H / 7) * i, W, H / 7 + 2);
                }

                // THE PULSE. Two full-screen fields breathing together read as the SCREEN flashing
                // blue, not as water moving, because every pixel changes at the same instant. So
                // the global swell is tiny and very slow, and the actual variation comes from a few
                // large soft masses drifting independently -- no moment where it all moves at once.
                const swell = wash(0x0a4359, 0.02);
                T({ targets: swell, alpha: 0.10, duration: 13000, yoyo: true, repeat: -1,
                    ease: 'Sine.easeInOut' });

                for (let i = 0; i < 4; i++) {
                    const mass = g(-9);
                    const mw = R(260, 520), mh = R(150, 320);
                    mass.fillStyle(i % 2 ? 0x0c465e : 0x03121f, R(0.10, 0.20));
                    mass.fillEllipse(0, 0, mw, mh);
                    mass.x = R(-120, W + 120); mass.y = R(0, H);
                    T({ targets: mass, x: mass.x + R(-300, 300), y: mass.y + R(-120, 120),
                        alpha: R(0.25, 1), duration: R(14000, 26000),
                        yoyo: true, repeat: -1, ease: 'Sine.easeInOut', delay: R(0, 6000) });
                }

                // Pressure. Darkness closing from every edge, itself breathing, so the lit part of
                // the screen is a small pocket in something much larger.
                const vig = g(-8);
                for (let i = 0; i < 18; i++) {
                    vig.lineStyle(30 - i, 0x000208, 0.05);
                    vig.strokeRect(-i * 7, -i * 7, W + i * 14, H + i * 14);
                }
                T({ targets: vig, alpha: 0.72, duration: 9200, yoyo: true, repeat: -1,
                    ease: 'Sine.easeInOut' });

                // Three shafts, not six, and barely there. At this depth light arrives as a hint
                // of a direction, not as beams.
                for (let i = 0; i < 3; i++) {
                    const sh = g(-8);
                    const w0 = R(70, 150), w1 = R(200, 340), lean = R(-70, 70);
                    sh.fillStyle(0x2f6f90, R(0.016, 0.032));
                    sh.fillPoints([{ x: 0, y: 0 }, { x: w0, y: 0 },
                                   { x: w0 + lean + w1 * 0.2, y: H * 0.75 }, { x: lean - w1 * 0.2, y: H * 0.75 }], true);
                    sh.x = R(-80, W); sh.y = 0;
                    T({ targets: sh, alpha: R(0.3, 0.8), x: sh.x + R(-30, 30),
                        duration: R(9000, 15000), yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
                }

                // MARINE SNOW. The deep-sea signature: motes drifting steadily DOWN, not milling
                // about. Reset to the top on repeat so it never reverses.
                for (let i = 0; i < 70; i++) {
                    const m = g(-6);
                    m.fillStyle(0x9fc4d8, R(0.06, 0.20));
                    m.fillCircle(0, 0, R(0.6, 1.7));
                    const sx = R(0, W);
                    m.x = sx; m.y = R(-H, H);
                    const fall = R(11000, 22000);
                    T({ targets: m, y: H + 20, x: sx + R(-30, 30), duration: fall,
                        delay: R(0, 6000), repeat: -1, ease: 'Linear',
                        onRepeat: () => { m.x = R(0, W); m.y = -20; } });
                }

                // A few bubbles, dim and slow -- something down here is still venting.
                for (let i = 0; i < 12; i++) {
                    const b = g(-6);
                    const rad = R(1.2, 3.2);
                    b.fillStyle(0x7fb4cc, R(0.12, 0.30));
                    b.fillCircle(0, 0, rad);
                    const sx = R(0, W);
                    b.x = sx; b.y = H + R(0, H * 0.5);
                    T({ targets: b, y: -20, x: sx + R(-50, 50), duration: R(9000, 16000),
                        delay: R(0, 6000), repeat: -1, ease: 'Sine.easeOut',
                        onRepeat: () => { b.x = R(0, W); b.y = H + 20; } });
                }

                // SOMETHING OUT THERE. Large, very dark, very slow shapes crossing far overhead.
                // Never identifiable -- they only ever darken the water as they pass.
                for (let i = 0; i < 3; i++) {
                    const sd = g(-8);
                    const sw = R(220, 420), sh2 = R(50, 110);
                    sd.fillStyle(0x000206, R(0.16, 0.30));
                    sd.fillEllipse(0, 0, sw, sh2);
                    sd.y = R(H * 0.1, H * 0.7);
                    sd.x = -sw;
                    T({ targets: sd, x: W + sw, duration: R(26000, 44000),
                        delay: R(0, 18000), repeat: -1, ease: 'Linear',
                        onRepeat: () => { sd.y = R(H * 0.1, H * 0.7); } });
                }

                // ── THINGS THAT LIVE DOWN HERE ──────────────────────────────────────────
                // Silhouettes, not portraits: a dark body, a jaw of teeth and a lure light read as
                // menacing at this scale, where detail would just turn to mush. Body and lure go in
                // a container so one transform moves both -- tweening them separately looks fine for
                // a second and then they drift apart.
                const creature = (len, alpha, depthY, speed, hasLure) => {
                    const L = len, Hh = len * 0.42;
                    const body = scene.add.graphics();
                    const pts = [
                        { x:  L * 0.50, y: 0 },                 // snout
                        { x:  L * 0.26, y: -Hh * 0.20 },
                        { x:  L * 0.02, y: -Hh * 0.52 },        // hump
                        { x: -L * 0.26, y: -Hh * 0.38 },
                        { x: -L * 0.42, y: -Hh * 0.14 },
                        { x: -L * 0.52, y: -Hh * 0.52 },        // tail top
                        { x: -L * 0.44, y:  0 },
                        { x: -L * 0.52, y:  Hh * 0.52 },        // tail bottom
                        { x: -L * 0.42, y:  Hh * 0.14 },
                        { x: -L * 0.08, y:  Hh * 0.46 },        // belly
                        { x:  L * 0.28, y:  Hh * 0.26 },        // lower jaw
                    ];
                    body.fillStyle(0x01080e, alpha);
                    body.fillPoints(pts, true);
                    body.lineStyle(1, 0x2f6f90, alpha * 0.45);  // faint rim so it is not a hole
                    body.strokePoints(pts, true);

                    // teeth along both jaws, pointing into the mouth, shrinking toward the hinge
                    body.fillStyle(0xc9dbe4, alpha * 0.85);
                    for (let t = 0; t < 7; t++) {
                        const f = t / 6;
                        const ux = L * 0.50 - f * L * 0.24, uy = -Hh * 0.02 - f * Hh * 0.16;
                        const lx = L * 0.50 - f * L * 0.22, ly =  Hh * 0.04 + f * Hh * 0.20;
                        const sz = Hh * 0.13 * (1 - f * 0.4);
                        body.fillTriangle(ux, uy, ux - sz * 0.6, uy + sz, ux + sz * 0.6, uy + sz * 0.9);
                        body.fillTriangle(lx, ly, lx - sz * 0.6, ly - sz, lx + sz * 0.6, ly - sz * 0.9);
                    }
                    body.fillStyle(0x9fe8ff, alpha * 0.75);
                    body.fillCircle(L * 0.26, -Hh * 0.20, Hh * 0.075);   // eye

                    const parts = [body];
                    if (hasLure) {
                        body.lineStyle(1.4, 0x01080e, alpha);            // the stalk
                        body.beginPath();
                        body.moveTo(L * 0.02, -Hh * 0.50);
                        body.lineTo(L * 0.30, -Hh * 0.95);
                        body.lineTo(L * 0.60, -Hh * 0.62);
                        body.strokePath();
                        const lure = scene.add.graphics();
                        lure.fillStyle(0x8fe4ff, 0.70); lure.fillCircle(0, 0, Hh * 0.14);
                        lure.fillStyle(0xe6f9ff, 0.95); lure.fillCircle(0, 0, Hh * 0.06);
                        lure.x = L * 0.60; lure.y = -Hh * 0.62;          // local to the container
                        T({ targets: lure, alpha: 0.3, duration: R(900, 1700),
                            yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
                        parts.push(lure);
                    }

                    const dir = Math.random() < 0.5 ? 1 : -1;
                    const startX = dir > 0 ? -L : W + L;
                    const endX   = dir > 0 ? W + L : -L;
                    const cont = scene.add.container(startX, depthY, parts)
                        .setScrollFactor(0).setDepth(-8);
                    cont.scaleX = dir;                                   // face the way it swims
                    objs.push(cont);

                    T({ targets: cont, x: endX, duration: speed, repeat: -1, ease: 'Linear',
                        delay: R(0, 16000),
                        onRepeat: () => { cont.y = R(H * 0.12, H * 0.88); } });
                    T({ targets: cont, y: '+=' + R(14, 30), angle: R(-4, 4),
                        duration: R(2600, 4200), yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
                };

                // one large and close, two smaller and further out
                creature(R(150, 210), R(0.55, 0.72), R(H * 0.2, H * 0.8), R(30000, 46000), true);
                creature(R(70, 110),  R(0.30, 0.45), R(H * 0.1, H * 0.9), R(38000, 58000), true);
                creature(R(50, 80),   R(0.22, 0.34), R(H * 0.1, H * 0.9), R(44000, 66000), false);

                break;
            }
            case 'storm': {
                wash(0x060a14, 0.92);
                // Cloud bank: overlapping soft ellipses drifting slowly across the top.
                for (let i = 0; i < 7; i++) {
                    const c = g(-8);
                    c.fillStyle(0x121a2c, R(0.5, 0.85));
                    const cw = R(220, 460), ch = R(70, 130);
                    c.fillEllipse(0, 0, cw, ch);
                    c.x = R(-100, W + 100); c.y = R(20, H * 0.28);
                    T({ targets: c, x: c.x + R(60, 160), duration: R(14000, 26000),
                        yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
                }
                // Rain across the FULL screen. 90 streaks, each one graphics + one tween.
                for (let i = 0; i < 90; i++) {
                    const r = g(-7);
                    r.lineStyle(R(1, 2), 0x9fc4e8, R(0.18, 0.5));
                    const len = R(14, 30);
                    r.lineBetween(0, 0, -len * 0.32, len);
                    const sx = R(-60, W + 60);
                    r.x = sx; r.y = R(-H, 0);
                    const fall = R(620, 1250);
                    T({ targets: r, y: H + 40, x: sx - fall * 0.32, duration: fall,
                        delay: R(0, 1400), repeat: -1, ease: 'Linear',
                        onRepeat: () => { r.x = R(-60, W + 60); r.y = -40; } });
                }
                // Ground haze so the rain appears to land somewhere.
                const haze = g(-6);
                haze.fillStyle(0x9fc4e8, 0.05); haze.fillRect(0, H - 90, W, 90);
                T({ targets: haze, alpha: 0.55, duration: 2600, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });

                // Lightning: a forked bolt plus a full-screen flash, on a long irregular
                // cycle. Each strike rebuilds its own path so no two look alike.
                const flash = scene.add.rectangle(W / 2, H / 2, W, H, 0xdCE8ff, 0)
                    .setScrollFactor(0).setDepth(-4);
                objs.push(flash);
                const bolt = g(-4);
                const strike = () => {
                    if (!bolt.active) return;
                    bolt.clear();
                    let x = R(W * 0.15, W * 0.85), y = -10;
                    bolt.lineStyle(R(2.5, 4.5), 0xffffff, 0.95);
                    bolt.beginPath(); bolt.moveTo(x, y);
                    while (y < H * R(0.55, 0.95)) { y += R(30, 70); x += R(-70, 70); bolt.lineTo(x, y); }
                    bolt.strokePath();
                    bolt.alpha = 1;
                    T({ targets: bolt, alpha: 0, duration: R(160, 300), delay: 60 });
                    flash.alpha = R(0.18, 0.38);
                    T({ targets: flash, alpha: 0, duration: R(180, 340) });
                    scene.time.delayedCall(R(2600, 7000), strike);
                };
                scene.time.delayedCall(R(900, 2200), strike);
                break;
            }

            // ── SPACE — the void levels (rift, gate, warp) ────────────────
            // Being in space: starfield, a couple of planets, a nebula band. Shared by
            // all three void levels, tinted by each one's accent.
            case 'rift': case 'gate': case 'warp': case 'space': {
                wash(0x04030c, 0.95);
                // Nebula: a few huge soft ellipses, very low alpha, slowly breathing.
                for (let i = 0; i < 4; i++) {
                    const n = g(-8);
                    n.fillStyle(i % 2 ? accent : 0x3a1f66, 0.10);
                    n.fillEllipse(0, 0, R(W * 0.5, W * 0.95), R(H * 0.3, H * 0.6));
                    n.x = R(0, W); n.y = R(0, H);
                    T({ targets: n, alpha: R(0.35, 1), duration: R(5000, 9000),
                        yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
                    T({ targets: n, x: n.x + R(-70, 70), duration: R(16000, 30000),
                        yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
                }
                // Starfield: 130 points, most static-twinkling, a few drifting.
                for (let i = 0; i < 130; i++) {
                    const st = g(-7);
                    const br = R(0.35, 1);
                    st.fillStyle(Math.random() < 0.12 ? accent : 0xffffff, br);
                    st.fillCircle(0, 0, R(0.6, 1.8));
                    st.x = R(0, W); st.y = R(0, H);
                    T({ targets: st, alpha: R(0.15, 0.5), duration: R(1200, 3600),
                        yoyo: true, repeat: -1, delay: R(0, 3000), ease: 'Sine.easeInOut' });
                }
                // Planets: a large one low-left and a small one high-right, each with a
                // lit crescent so they read as spheres rather than discs.
                const planet = (px, py, rad, body, lit, ring) => {
                    const pl = g(-6);
                    pl.fillStyle(body, 1); pl.fillCircle(0, 0, rad);
                    pl.fillStyle(lit, 0.30); pl.fillCircle(-rad * 0.22, -rad * 0.24, rad * 0.82);
                    pl.fillStyle(0x000000, 0.34); pl.fillCircle(rad * 0.34, rad * 0.30, rad * 0.9);
                    pl.lineStyle(1.5, lit, 0.35); pl.strokeCircle(0, 0, rad);
                    if (ring) {
                        pl.lineStyle(R(3, 5), lit, 0.35);
                        pl.strokeEllipse(0, 0, rad * 2.9, rad * 0.75);
                        pl.lineStyle(1.5, lit, 0.22);
                        pl.strokeEllipse(0, 0, rad * 3.4, rad * 0.95);
                    }
                    pl.x = px; pl.y = py;
                    T({ targets: pl, y: py + R(10, 24), duration: R(7000, 12000),
                        yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
                    T({ targets: pl, angle: 360, duration: R(90000, 150000), repeat: -1, ease: 'Linear' });
                    return pl;
                };
                planet(W * 0.13, H * 0.78, Math.min(W, H) * 0.13, 0x2b2350, accent, true);
                planet(W * 0.86, H * 0.18, Math.min(W, H) * 0.06, 0x3a2a4e, 0xd9c2ff, false);
                // A distant sun glint.
                const sun = g(-7);
                sun.fillStyle(0xffffff, 0.9); sun.fillCircle(0, 0, 3);
                sun.fillStyle(accent, 0.14); sun.fillCircle(0, 0, 26);
                sun.x = W * 0.68; sun.y = H * 0.12;
                T({ targets: sun, alpha: 0.5, duration: 3000, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
                // Occasional shooting star.
                const shoot = () => {
                    const sh = g(-6);
                    sh.fillStyle(0xffffff, 0.9); sh.fillRect(0, 0, 44, 1.6);
                    const sy = R(0, H * 0.5);
                    sh.x = -60; sh.y = sy; sh.rotation = 0.35; sh.alpha = 0;
                    T({ targets: sh, alpha: 1, duration: 120 });
                    T({ targets: sh, x: W + 80, y: sy + W * 0.35, alpha: 0,
                        duration: R(700, 1200), ease: 'Sine.easeIn',
                        onComplete: () => { if (sh.active) sh.destroy(); } });
                    scene.time.delayedCall(R(3500, 9000), shoot);
                };
                scene.time.delayedCall(R(1200, 4000), shoot);
                break;
            }

            // ── FORGE — the fire tutorial ────────────────────────────────
            case 'duality': {
                wash(0x140a06, 0.9);
                for (let i = 0; i < 40; i++) {
                    const e = g(-7);
                    e.fillStyle(Math.random() < 0.4 ? 0xffc23c : 0xff6622, R(0.3, 0.8));
                    e.fillCircle(0, 0, R(1.4, 3.4));
                    const sx = R(0, W);
                    e.x = sx; e.y = H + 10;
                    T({ targets: e, y: R(H * 0.15, H * 0.6), x: sx + R(-60, 60), alpha: 0,
                        duration: R(3200, 6500), delay: R(0, 4000), repeat: -1, ease: 'Sine.easeOut',
                        onRepeat: () => { e.x = R(0, W); e.y = H + 10; e.alpha = R(0.3, 0.8); } });
                }
                const glow = g(-8);
                glow.fillStyle(0xff5522, 0.13); glow.fillEllipse(W / 2, H + 60, W * 1.3, H * 0.6);
                T({ targets: glow, alpha: 0.7, duration: 2400, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
                const frost = g(-8);
                frost.fillStyle(0x44aaff, 0.10); frost.fillEllipse(W * 0.5, -40, W * 1.1, H * 0.5);
                T({ targets: frost, alpha: 0.6, duration: 3100, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
                break;
            }

            // ── FRACTURE ─────────────────────────────────────────────────
            case 'fracture': {
                wash(0x061014, 0.92);
                const cr = g(-7);
                cr.lineStyle(2, accent, 0.30);
                for (let i = 0; i < 12; i++) {
                    let x = R(0, W), y = R(0, H);
                    cr.beginPath(); cr.moveTo(x, y);
                    for (let sgm = 0; sgm < 5; sgm++) {
                        x += R(-160, 160); y += R(-120, 120);
                        cr.lineTo(Math.max(0, Math.min(W, x)), Math.max(0, Math.min(H, y)));
                    }
                    cr.strokePath();
                }
                T({ targets: cr, alpha: 0.45, duration: 2400, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
                for (let i = 0; i < 26; i++) {
                    const sh = g(-6);
                    sh.fillStyle(accent, R(0.2, 0.5));
                    sh.fillTriangle(0, 0, R(4, 11), R(2, 7), R(-3, 4), R(6, 13));
                    sh.x = R(0, W); sh.y = R(0, H);
                    T({ targets: sh, y: sh.y + R(-40, 40), angle: R(-180, 180),
                        duration: R(6000, 12000), yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
                }
                break;
            }

            // ── BLUEPRINT — Engineering Defense ──────────────────────────
            case 'blueprint': {
                wash(0x03100a, 0.93);
                const grid = g(-8);
                grid.lineStyle(1, accent, 0.10);
                for (let x = 0; x <= W; x += 40) grid.lineBetween(x, 0, x, H);
                for (let y = 0; y <= H; y += 40) grid.lineBetween(0, y, W, y);
                const grid2 = g(-8);
                grid2.lineStyle(1.5, accent, 0.16);
                for (let x = 0; x <= W; x += 200) grid2.lineBetween(x, 0, x, H);
                for (let y = 0; y <= H; y += 200) grid2.lineBetween(0, y, W, y);
                for (let i = 0; i < 9; i++) {
                    const t2 = g(-7);
                    const rad = R(26, 54);
                    t2.lineStyle(1.5, accent, 0.28); t2.strokeRect(-11, -11, 22, 22);
                    t2.lineStyle(1, accent, 0.16); t2.strokeCircle(0, 0, rad);
                    t2.x = R(W * 0.08, W * 0.92); t2.y = R(H * 0.12, H * 0.88);
                    T({ targets: t2, alpha: R(0.35, 1), duration: R(2600, 5200),
                        yoyo: true, repeat: -1, delay: R(0, 2600), ease: 'Sine.easeInOut' });
                }
                const scan = g(-6);
                scan.fillStyle(accent, 0.20); scan.fillRect(0, 0, 2, H);
                scan.x = 0;
                T({ targets: scan, x: W, duration: 5200, repeat: -1, ease: 'Sine.easeInOut', yoyo: true });
                break;
            }

            // ── CIRCUIT ──────────────────────────────────────────────────
            case 'circuit': {
                wash(0x0d0803, 0.93);
                const tr = g(-8);
                tr.lineStyle(1.5, accent, 0.22);
                const lanes = Math.max(6, Math.floor(H / 62));
                const nodes = [];
                for (let l = 0; l < lanes; l++) {
                    let x = -20, y = (H / lanes) * (l + 0.5);
                    tr.beginPath(); tr.moveTo(x, y);
                    while (x < W + 20) {
                        x += R(60, 170); tr.lineTo(x, y);
                        if (Math.random() < 0.45) {
                            y = Math.max(16, Math.min(H - 16, y + (Math.random() < 0.5 ? -26 : 26)));
                            tr.lineTo(x, y); nodes.push([x, y]);
                        }
                    }
                    tr.strokePath();
                }
                nodes.slice(0, 40).forEach(([nx, ny], i) => {
                    const n = g(-7);
                    n.fillStyle(0xffffff, 0.9); n.fillCircle(0, 0, 2.6);
                    n.fillStyle(accent, 0.35); n.fillCircle(0, 0, 6);
                    n.x = nx; n.y = ny; n.alpha = 0.3;
                    T({ targets: n, alpha: 1, duration: R(700, 1600), yoyo: true,
                        repeat: -1, delay: R(0, 2400), ease: 'Sine.easeInOut' });
                });
                const pulse = g(-6);
                pulse.fillStyle(0xffffff, 0.35); pulse.fillRect(0, 0, 3, H);
                pulse.fillStyle(accent, 0.18); pulse.fillRect(-10, 0, 23, H);
                pulse.x = -20;
                T({ targets: pulse, x: W + 20, duration: 2600, repeat: -1, repeatDelay: 900, ease: 'Quad.easeIn' });
                break;
            }

            // ── ALERT — Final Stand ──────────────────────────────────────
            case 'alert': {
                wash(0x120406, 0.92);
                const vig = g(-7);
                for (let i = 0; i < 6; i++) {
                    vig.lineStyle(40, accent, 0.035);
                    vig.strokeRect(-20 + i * 20, -20 + i * 20, W + 40 - i * 40, H + 40 - i * 40);
                }
                T({ targets: vig, alpha: 0.35, duration: 1100, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
                for (let i = 0; i < 3; i++) {
                    const beam = g(-8);
                    beam.fillStyle(accent, 0.07);
                    beam.fillTriangle(0, 0, -W * 0.28, H, W * 0.28, H);
                    beam.x = W * (0.2 + i * 0.3); beam.y = -20;
                    T({ targets: beam, angle: R(-14, 14), duration: R(4000, 7000),
                        yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
                }
                const ember = () => {
                    const e = g(-6);
                    e.fillStyle(accent, 0.8); e.fillCircle(0, 0, R(1.5, 3));
                    e.x = R(0, W); e.y = H + 8;
                    T({ targets: e, y: R(H * 0.2, H * 0.7), alpha: 0, duration: R(2600, 4800),
                        ease: 'Sine.easeOut', onComplete: () => { if (e.active) e.destroy(); } });
                    scene.time.delayedCall(R(180, 520), ember);
                };
                scene.time.delayedCall(400, ember);
                break;
            }

            default: {
                wash(P.bgDeep, 0.9);
                break;
            }
        }

        return {
            objs,
            destroy() { objs.forEach(o => { if (o?.active) { scene.tweens.killTweensOf(o); o.destroy(); } }); }
        };
    },

    // ── LOADING SCREEN ───────────────────────────────────────────────────────
    // A restart and the like: the title card without a painting. { title, tag, accent,
    // duration, onDone }.
    loader(scene, o) {
        return this._card(scene, o);
    }
};