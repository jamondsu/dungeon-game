// ═══════════════════════════════════════════════════════════════════════════
// EnemyFX.js — what the Spitter, the Berserker, the Mortar, the Rooter, the Healer and the snipers throw and leave, from
// their typed art (assets/art/fx_en_a.png): shots drawn east and north-east, a quarter turn on for south and south-east,
// the other four ways those flipped, never turned. Static, for any scene (tower defense too). Presentation only: the
// attack code still decides where things are and what they hit.
// ═══════════════════════════════════════════════════════════════════════════
class EnemyFX {
    static ok(S) { return !!S?.textures?.exists('fx_en_a'); }
    // the nearest of the eight ways to heading a: its frame's suffix, and whether it's flipped both ways
    static way(a) { return [['e', 0], ['se', 0], ['s', 0], ['ne', 1], ['e', 1], ['se', 1], ['s', 1], ['ne', 0]][((Math.round(a / (Math.PI / 4)) % 8) + 8) % 8]; }
    // point `img` (a `base`_<way> shot) along heading a
    static aim(img, base, a) { const [w, f] = EnemyFX.way(a); return img.setFrame(base + '_' + w).setFlip(!!f, !!f); }
    // a shot (spit, vpel, apel) at (x, y) heading a
    static shot(S, base, x, y, a, depth = 2.6) {
        const img = S.add.image(x, y, 'fx_en_a', base + '_e').setDepth(depth).setScale(1.2);
        img._efxBase = base;
        S._vfxSort?.(img);
        return EnemyFX.aim(img, base, a);
    }

    // ── the Berserker's gore: streaks of its sweep laid along the arc from a0 to a1, out to R, as it swings (ms), fading
    static cleave(S, x, y, a0, a1, R, ms) {
        if (!EnemyFX.ok(S)) return;
        const n = 8, dir = a1 > a0 ? 1 : -1;
        for (let i = 0; i <= n; i++) S.time.delayedCall(ms * i / n, () => {
            const a = a0 + (a1 - a0) * i / n, along = a + dir * Math.PI / 2;
            for (const r of [0.5, 0.75, 0.97]) {
                const c = EnemyFX.shot(S, 'cut', x + Math.cos(a) * R * r, y + Math.sin(a) * R * r, along, 3.5).setScale(r > 0.9 ? 2 : 1.5)
                    .setBlendMode(Phaser.BlendModes.ADD);
                S.tweens.add({ targets: c, alpha: 0, duration: 240, delay: 30, onComplete: () => c.destroy() });
            }
        });
        const m = (a0 + a1) / 2;
        S._vfxFlash?.(x + Math.cos(m) * R * 0.6, y + Math.sin(m) * R * 0.6, R * 1.1, 0xff5a2a, ms + 120, 0.45);
    }

    // ── the Mortar's lava rock in the air (tumbling by its frames: tumble(img, ms in flight)), its shadow on the floor
    static shell(S, x, y) { const img = S.add.image(x, y, 'fx_en_a', 'shell_0').setDepth(5).setScale(1.2); S._vfxSort?.(img); return img; }
    static tumble(img, t) { if (img?.active) img.setFrame('shell_' + (Math.floor(t / 90) & 3)); }
    static shadow(S, x, y) { const img = S.add.image(x, y, 'fx_en_a', 'shadow').setDepth(0.5); S._vfxSort?.(img); return img; }
    // where it lands: rocks and embers flung out (R its reach), a scorch left on the floor a while
    static debris(S, x, y, R) {
        if (!EnemyFX.ok(S)) return;
        for (let i = 0; i < 9; i++) {
            const a = Math.random() * Math.PI * 2, d = R * (0.25 + Math.random() * 0.55);
            const p = S.add.image(x, y, 'fx_en_a', 'peb_' + (i % 4)).setDepth(4).setScale(1.2);
            S._vfxSort?.(p);
            S.tweens.add({ targets: p, x: x + Math.cos(a) * d, y: y + Math.sin(a) * d * 0.6, duration: 360, ease: 'Quad.easeOut' });
            S.tweens.add({ targets: p, alpha: 0, delay: 260 + Math.random() * 200, duration: 220, onComplete: () => p.destroy() });
        }
        const sc = S.add.image(Math.round(x), Math.round(y), 'fx_en_a', 'scorch').setDepth(0.22).setScale(2).setFlipX(Math.random() < 0.5);
        S._vfxSort?.(sc);
        S.tweens.add({ targets: sc, alpha: 0, delay: 1400, duration: 1400, onComplete: () => sc.destroy() });
    }

    // ── the Rooter's vine (the projectile p: from p.startX/Y to its tip p._tipX/Y): typed lengths of thorned vine laid along
    // it, swaying, its clawed pod at the tip, torn ground where it comes up; `retract` 0-1 draws it whipping back down.
    // Its pieces go with p.gfx (which sits at the tip, for whatever reads where it is).
    static vine(S, p, retract = 0) {
        const g = p.gfx;
        if (!g?.active || !EnemyFX.ok(S)) return false;
        const tipX = p._tipX, tipY = p._tipY, sx = p.startX, sy = p.startY + 8;
        g.setPosition(tipX, tipY); g.clear?.();
        const ex = tipX + (sx - tipX) * retract, ey = tipY + (sy - tipY) * retract;
        const dx = ex - sx, dy = ey - sy, len = Math.hypot(dx, dy) || 1, a = Math.atan2(dy, dx), nx = -dy / len, ny = dx / len;
        const n = Math.max(1, Math.round(len / 7)), t = (S.time.now - (p._createdAt || 0)) / 1000;
        const segs = p._efx || (p._efx = []);
        if (!p._efxHook) { p._efxHook = true; g.once('destroy', () => { for (const o of segs) o.destroy(); segs.length = 0; }); }
        while (segs.length < n + 2) { const o = S.add.image(0, 0, 'fx_en_a', 'vine_e').setDepth(1.05).setScale(1.2); S._vfxSort?.(o); segs.push(o); }
        segs[0].setFrame('hole').setFlip(false, false).setPosition(Math.round(sx), Math.round(sy + 2)).setDepth(1.04).setVisible(true);
        for (let i = 2; i < segs.length; i++) {
            const o = segs[i], k = i - 2;
            if (k >= n) { o.setVisible(false); continue; }
            const f = (k + 0.5) / n, w = Math.round(Math.sin(f * Math.PI * 2.5 - t * 6) * 3 * Math.sin(f * Math.PI));
            EnemyFX.aim(o, 'vine', a).setPosition(Math.round(sx + dx * f + nx * w), Math.round(sy + dy * f + ny * w)).setVisible(true);
        }
        EnemyFX.aim(segs[1], 'pod', a).setPosition(Math.round(ex), Math.round(ey)).setDepth(1.06).setVisible(retract < 0.95);
        return true;
    }
    // its stamp: roots burst up out of the floor in the tiles it reaches (tile coords), grow by their frames and sink
    static sprouts(S, tiles) {
        if (!EnemyFX.ok(S)) return false;
        const T = S.TILE_SIZE;
        for (const [tx, ty] of tiles) {
            if (Math.random() < 0.4) continue;
            const s = S.add.image(Math.round(tx * T + T / 2 + (Math.random() - 0.5) * 8), ty * T + T / 2 + 6, 'fx_en_a', 'sprout_0').setOrigin(0.5, 1).setDepth(1.06).setScale(1.2).setFlipX(Math.random() < 0.5);
            S._vfxSort?.(s);
            S.tweens.addCounter({ from: 0, to: 2.99, duration: 140, onUpdate: tw => s.active && s.setFrame('sprout_' + Math.floor(tw.getValue())) });
            S.tweens.add({ targets: s, alpha: 0, delay: 360, duration: 300, onComplete: () => s.destroy() });
        }
        return true;
    }
    // roots round your base while you're held (on); false when it isn't drawing them
    static wrap(S, on, p) {
        let w = S._efxWrap;
        if (!on || !p?.active || !EnemyFX.ok(S)) { if (w?.active) w.setVisible(false); return false; }
        if (!w?.active) { w = S._efxWrap = S.add.image(0, 0, 'fx_en_a', 'wrap_0').setOrigin(0.5, 1).setScale(1.2); S._vfxSort?.(w); }
        w.setFrame('wrap_' + (Math.floor(S.time.now / 160) & 1)).setPosition(Math.round(p.x), Math.round(p.y - (S.SLIME_Y_OFFSET || 0) + 12))
         .setDepth((p.depth ?? 1) + 0.004).setVisible(true);
        return true;
    }

    // ── a Healer's cross rising (big: over one it mends)
    static cross(S, x, y, big = false) {
        if (!EnemyFX.ok(S)) return;
        const c = S.add.image(Math.round(x), Math.round(y), 'fx_en_a', big ? 'cross_0' : 'cross_1').setDepth(3.5).setScale(1.2);
        S._vfxSort?.(c);
        S.tweens.add({ targets: c, y: y - (big ? 14 : 18), alpha: 0, duration: big ? 520 : 620, ease: 'Quad.easeOut', onComplete: () => c.destroy() });
        if (big) { const tw = S.add.image(Math.round(x + 8), Math.round(y - 4), 'fx_en_a', 'cross_2').setDepth(3.5).setScale(1.2); S._vfxSort?.(tw); S.tweens.add({ targets: tw, alpha: 0, delay: 120, duration: 300, onComplete: () => tw.destroy() }); }
    }

}
