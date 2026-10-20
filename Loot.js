// ═══════════════════════════════════════════════════════════════════════════
// Loot.js — chests, and what comes out of them.
//
// Static only (no mixin, nothing to proxy): any scene calls these with itself.
//   LootFX.chest(scene, x, y, kind)    a chest painted in the house style (Menus.js' pixel
//                                      buffer): oak and iron, the void's black glass, the gold
//                                      reward chest, and the mimic (an oak chest, a shade too
//                                      red in its light). Lid and body are separate images so
//                                      the lid can open. A soft light under it, a glint that
//                                      runs over it now and then.
//   LootFX.open(scene, chest)          the lid kicks up and flips back, light pours out of it,
//                                      coins and glorps spill out in arcs and bounce, then the
//                                      chest fades away.
//   LootFX.reward(scene, wx, wy, text, colour)
//                                      a reward rising off the chest ("+30" with a glorp).
// Every chest site in TutorialManager and LevelManager builds through chest() and opens
// through open(); their objects keep the old names (container, lid, body, glow, shadow).
// ═══════════════════════════════════════════════════════════════════════════
class LootFX {

    // Colours per kind: wood (dark to light), bands (shadow, metal, shine), the lock plate,
    // the light under it and the light inside it.
    static KINDS() {
        if (LootFX._kinds) return LootFX._kinds;
        const oak = { wood: [0x3a2010, 0x5e3618, 0x7e4c22, 0xa26a34], band: [0x23252f, 0x4a5064, 0x9aa2b8],
                      lock: [0x7a4c0c, 0xe8b432, 0xfff0a0], key: 0x1a1008, glow: 0xffb040, inside: 0xffd870 };
        return (LootFX._kinds = {
            wood: oak,
            mimic: Object.assign({}, oak, { glow: 0xff5a2a }),
            void: { wood: [0x0e0818, 0x1c1030, 0x2c1a4c, 0x43286e], band: [0x2a1650, 0x8a5cd0, 0xe0c8ff],
                    lock: [0x7a1a6a, 0xff7ae8, 0xffd8f6], key: 0x12041a, glow: 0xc06cff, inside: 0xe6b0ff },
            gold: { wood: [0x3a0e12, 0x62161e, 0x8a2430, 0xb03a44], band: [0x7a4c0c, 0xe8b432, 0xfff0a0],
                    lock: [0x2a5a9a, 0x6ab8ff, 0xd8f0ff], key: 0x0a1830, glow: 0xffd860, inside: 0xfff2b0 },
        });
    }

    // The four textures of a kind (22x22 each, all on one baseline so they stack): the body, the
    // lid, the body open (dark inside, coins glinting) and the lid open (its underside, tipped back).
    static textures(scene, kind) {
        const K = LootFX.KINDS()[kind] || LootFX.KINDS().wood, base = 'lt_' + kind;
        if (scene.textures.exists(base + '_body')) return base;
        if (typeof MenuArt === 'undefined') return null;
        const S = 22, OUT = 0x0c0810;
        const bands = (P, y0, y1) => {
            for (const x of [3, 17]) {
                P.rect(x, y0, 2, y1 - y0, K.band[1]);
                P.rect(x, y0, 1, y1 - y0, K.band[2]);
                for (let y = y0 + 1; y < y1; y += 3) P.put(x + 1, y, K.band[0]);   // rivets
            }
        };
        const body = (P, open) => {
            for (let y = 11; y < 20; y++) {
                const row = (y - 11) % 3;
                P.rect(1, y, 20, 1, row === 0 ? K.wood[2] : row === 2 ? K.wood[0] : K.wood[1]);
            }
            for (let x = 2; x < 20; x += 5) P.put(x, 13, K.wood[3]);              // grain
            bands(P, 11, 20);
            P.rect(1, 19, 20, 1, K.band[0]); P.rect(1, 20, 20, 1, OUT);            // the iron foot
            if (open) {                                                           // the inside, lit
                P.rect(2, 10, 18, 2, K.wood[0]);
                for (const [x, c] of [[4, 2], [6, 1], [9, 2], [12, 1], [14, 2], [16, 1]]) P.put(x, 10, K.lock[c]);
                P.put(10, 11, K.lock[2]); P.put(7, 11, K.lock[1]); P.put(13, 11, K.lock[1]);
                P.rect(1, 9, 20, 1, K.band[1]);
            }
            // the lock plate, hanging over the seam
            P.rect(9, 10, 4, 5, K.lock[1]); P.rect(9, 10, 4, 1, K.lock[2]); P.rect(9, 14, 4, 1, K.lock[0]);
            if (!open) { P.put(10, 12, K.key); P.put(11, 12, K.key); P.put(10, 13, K.key); }
            P.outline(OUT);
        };
        const lid = P => {
            P.rect(4, 3, 14, 1, K.wood[3]);
            P.rect(2, 4, 18, 1, K.wood[3]);
            for (let y = 5; y < 11; y++) P.rect(1, y, 20, 1, y < 7 ? K.wood[2] : y < 9 ? K.wood[1] : K.wood[0]);
            P.rect(5, 4, 3, 1, 0xffffff, 0.35);                                   // a shine on the curve
            bands(P, 3, 11);
            P.rect(1, 10, 20, 1, K.band[1]); P.rect(1, 10, 20, 1, K.band[2], 0.35);
            P.outline(OUT);
        };
        const lidOpen = P => {                                                  // tipped back: its underside
            P.rect(2, 1, 18, 1, K.band[1]);
            for (let y = 2; y < 8; y++) P.rect(2, y, 18, 1, y < 4 ? K.wood[1] : K.wood[0]);
            bands(P, 1, 8);
            P.rect(2, 8, 18, 1, K.band[0]);
            P.outline(OUT);
        };
        for (const [part, paint] of [['body', P => body(P, false)], ['lid', lid], ['bodyopen', P => body(P, true)], ['lidopen', lidOpen]]) {
            const P = new MenuArt.Px(S, S);
            paint(P);
            P.toTexture(scene, base + '_' + part, false);
        }
        // what spills out: a coin and a glorp
        if (!scene.textures.exists('lt_coin')) {
            const P = new MenuArt.Px(5, 5);
            P.disc(2.5, 2.5, 2.5, 0xe8b432); P.put(1, 1, 0xfff0a0); P.put(2, 1, 0xfff0a0); P.put(3, 3, 0x8a5a10); P.put(2, 3, 0xb8862a);
            P.toTexture(scene, 'lt_coin', false);
        }
        if (!scene.textures.exists('lt_gem')) {
            const P = new MenuArt.Px(5, 6);
            P.poly([[2.5, 0], [5, 2], [2.5, 6], [0, 2]], 0x2fe08a); P.put(1, 2, 0xb6ffc8); P.put(2, 1, 0xffffff); P.put(3, 4, 0x169a5e);
            P.toTexture(scene, 'lt_gem', false);
        }
        return base;
    }

    // A chest standing at (x, y) (a tile's centre). `hover`: it floats (the reward chest).
    // Returns { container, body, lid, glow, shadow, kind }.
    static chest(scene, x, y, kind = 'wood', { hover = false, depth = 2 } = {}) {
        if (typeof MenuArt !== 'undefined') MenuArt.basics(scene);
        const base = LootFX.textures(scene, kind);
        const K = LootFX.KINDS()[kind] || LootFX.KINDS().wood;
        const container = scene.add.container(x, y).setDepth(depth);
        const shadow = scene.add.image(0, 9, scene.textures.exists('vfx_shadow') ? 'vfx_shadow' : '__WHITE').setScale(0.36, 0.11).setAlpha(0.6);
        const glow = scene.add.image(0, 0, scene.textures.exists('vfx_glow') ? 'vfx_glow' : '__WHITE')
            .setTint(K.glow).setBlendMode(Phaser.BlendModes.ADD).setScale(0.42).setAlpha(0.32);
        const body = scene.add.image(0, 10, base ? base + '_body' : '__WHITE').setOrigin(0.5, 1);
        const lid = scene.add.image(0, 10, base ? base + '_lid' : '__WHITE').setOrigin(0.5, 1);
        container.add([shadow, glow, body, lid]);
        scene.tweens.add({ targets: glow, alpha: 0.55, scale: 0.48, duration: 1100, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
        if (hover) {
            scene.tweens.add({ targets: [body, lid], y: 4, duration: 1200, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
            scene.tweens.add({ targets: shadow, scaleX: 0.28, alpha: 0.4, duration: 1200, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
        }
        // now and then a glint runs over the lid
        const glint = scene.time.addEvent({ delay: 1700 + Math.random() * 1200, loop: true, callback: () => {
            if (!container.active || container._ltOpen || !scene.textures.exists('mn_spark')) return;
            const s = scene.add.image(-8 + Math.random() * 16, lid.y - 9 - Math.random() * 6, 'mn_spark')
                .setBlendMode(Phaser.BlendModes.ADD).setTint(K.inside).setScale(0).setAlpha(0.95);
            container.add(s);
            scene.tweens.add({ targets: s, scale: 1, duration: 140, yoyo: true, ease: 'Quad.easeOut', onComplete: () => s.destroy() });
        } });
        container.once('destroy', () => glint.remove());
        container._ltKind = kind; container._ltGlow = K.glow;
        return { container, body, lid, glow, shadow, kind };
    }

    // Opens a chest made by chest(): the lid kicks up and flips back, light pours up out of it,
    // coins and glorps spill in arcs and bounce, sparkles; the chest fades after `keep` ms.
    static open(scene, chest, { spill = 12, keep = 1500 } = {}) {
        const c = chest?.container;
        if (!c?.active || c._ltOpen) return;
        c._ltOpen = true;
        Sfx.play(scene, 'chest');
        const kind = chest.kind || c._ltKind || 'wood', K = LootFX.KINDS()[kind] || LootFX.KINDS().wood;
        const base = LootFX.textures(scene, kind);
        scene.tweens.killTweensOf(c);
        for (const o of c.list) scene.tweens.killTweensOf(o);
        const { lid, body, glow } = chest;
        const ADD = Phaser.BlendModes.ADD;
        const x = c.x, y = c.y + (body?.y ?? 10) - 10;              // where the chest stands now
        if (lid?.active) {
            const by = body?.y ?? 10;
            lid.y = by;
            // a kick, then it swings up and back on its hinge (canvas row 9, the body's top edge)
            scene.tweens.add({ targets: lid, y: by - 4, duration: 80, ease: 'Quad.easeOut', onComplete: () => {
                if (!lid.active) return;
                if (base) lid.setTexture(base + '_lidopen');
                lid.setOrigin(0.5, 9 / 22).setY(by - 13).setScale(1, 0.15);
                scene.tweens.add({ targets: lid, scaleY: 1, duration: 220, ease: 'Back.easeOut' });
            } });
        }
        if (body?.active && base) body.setTexture(base + '_bodyopen');
        if (glow?.active) scene.tweens.add({ targets: glow, scale: 0.9, alpha: 0.9, duration: 160, yoyo: true, hold: 300 });
        scene._vfxFlash?.(x, y - 4, 90, K.inside, 700, 0.9);
        const depth = (c.depth || 2) + 0.4;
        const put = o => { o.setDepth(depth); scene._vfxSort?.(o); return o; };
        // light pouring up: a beam and a fan of rays
        if (scene.textures.exists('mn_shaft')) {
            const beam = put(scene.add.image(x, y - 2, 'mn_shaft').setOrigin(0.5, 1).setBlendMode(ADD).setTint(K.inside)
                .setDisplaySize(20, 4).setAlpha(0.9));
            scene.tweens.add({ targets: beam, displayHeight: 70, duration: 260, ease: 'Quad.easeOut' });
            scene.tweens.add({ targets: beam, alpha: 0, displayWidth: 8, delay: 420, duration: 600, onComplete: () => beam.destroy() });
            for (let i = 0; i < 5; i++) {
                const ray = put(scene.add.image(x, y - 2, 'mn_shaft').setOrigin(0.5, 1).setBlendMode(ADD).setTint(K.inside)
                    .setDisplaySize(6, 4).setAlpha(0.6).setRotation(-0.75 + i * 0.375));
                scene.tweens.add({ targets: ray, displayHeight: 40 + (i % 2) * 14, duration: 240, delay: 40 + i * 25, ease: 'Quad.easeOut' });
                scene.tweens.add({ targets: ray, alpha: 0, delay: 360, duration: 500, onComplete: () => ray.destroy() });
            }
        }
        // the spill: each piece flies out in an arc, lands, bounces once, glints and goes
        for (let i = 0; i < spill; i++) {
            const gem = i % 3 === 0;
            const key = gem ? 'lt_gem' : 'lt_coin';
            if (!scene.textures.exists(key)) break;
            const o = put(scene.add.image(x, y - 6, key));
            const a = -Math.PI / 2 + (Math.random() - 0.5) * 2.4, d = 14 + Math.random() * 22;
            const tx = x + Math.cos(a) * d * 1.3, ty = y + 4 + Math.random() * 10, h = 18 + Math.random() * 16;
            const st = { t: 0 };
            scene.tweens.add({ targets: st, t: 1, duration: 420 + Math.random() * 160, delay: i * 18, ease: 'Linear',
                onUpdate: () => { o.x = x + (tx - x) * st.t; o.y = (y - 6) + (ty - (y - 6)) * st.t - h * 4 * st.t * (1 - st.t); o.rotation = st.t * 6 * (gem ? 0.3 : 1); },
                onComplete: () => {
                    scene.tweens.add({ targets: o, y: ty - 4, duration: 110, yoyo: true, ease: 'Quad.easeOut', onComplete: () => {
                        scene.tweens.add({ targets: o, alpha: 0, scale: 0.4, delay: 300 + Math.random() * 400, duration: 300, onComplete: () => o.destroy() });
                    } });
                } });
        }
        if (scene.textures.exists('mn_spark')) {
            for (let i = 0; i < 6; i++) {
                const s = put(scene.add.image(x + (Math.random() - 0.5) * 34, y - 6 - Math.random() * 26, 'mn_spark')
                    .setBlendMode(ADD).setTint(i % 2 ? 0xffffff : K.inside).setScale(0));
                scene.tweens.add({ targets: s, scale: 1.2, duration: 150, delay: 120 + i * 70, yoyo: true, onComplete: () => s.destroy() });
            }
        }
        scene.time.delayedCall(keep, () => {
            if (!c.active) return;
            scene.tweens.add({ targets: c, alpha: 0, duration: 450, onComplete: () => c.destroy() });
        });
    }

    // A reward rising off the chest, in world space: "+30" beside a glorp.
    static reward(scene, wx, wy, text, colour = '#5dffb8') {
        const t = scene.add.text(wx + 5, wy, text, {
            fontSize: '13px', fontFamily: 'monospace', fontStyle: 'bold', color: colour, stroke: '#05060a', strokeThickness: 4,
        }).setOrigin(0, 0.5).setDepth(6).setResolution(2);
        const parts = [t];
        if (scene.textures.exists('cfx_bits') && scene.textures.get('cfx_bits').has('glorp')) parts.push(scene.add.image(wx - 3, wy, 'cfx_bits', 'glorp').setDepth(6));
        else if (scene.textures.exists('lt_gem')) parts.push(scene.add.image(wx - 3, wy, 'lt_gem').setScale(1.6).setDepth(6));
        for (const o of parts) { scene._vfxSort?.(o); o.setScale(o.scale * 0.6); }
        scene.tweens.add({ targets: parts, scale: '*=1.66', duration: 160, ease: 'Back.easeOut' });
        scene.tweens.add({ targets: parts, y: '-=26', duration: 1100, ease: 'Quad.easeOut' });
        scene.tweens.add({ targets: parts, alpha: 0, delay: 750, duration: 400, onComplete: () => parts.forEach(o => o.destroy()) });
        return parts;
    }
}
