// ═══════════════════════════════════════════════════════════════════════════
// LEVELSELECTSCENE.JS - The dungeon map
//
// A parchment map pinned to the dungeon wall: a winding ink path down through the levels,
// each a medallion in its own inked chamber, ending at the Tower. Your slime stands on the
// selected level and walks the path between them. The plaque beside the map shows the
// selected level (its living diorama, MenuArt.diorama), and the pack under it shows what you
// carry and opens the shop.
//
//   arrows / WASD   walk to the previous / next level (the path runs downward)
//   1-7             jump to a level
//   Enter / Space   go in
//   click           a level walks there; the level you're on goes in
//
// The tutorial is a sub-screen (two tutorials), reached from its node.
// ═══════════════════════════════════════════════════════════════════════════

class LevelSelectScene extends Phaser.Scene {
    constructor() { super({ key: 'LevelSelect' }); }

    create(data) {
        this.anims.resumeAll();   // the game's pause freezes every animation game-wide; never carry that into a menu
        const W = this.scale.width, H = this.scale.height;
        Music.play(this, 'menu');
        this._tutLaunching = false;   // the scene object outlives a restart
        this._entering = false;       // a level is being entered: every other press is ignored
        this.input.enabled = true; if (this.input.keyboard) this.input.keyboard.enabled = true;   // (leaving switched them off, and the scene object is reused)
        this._settingsOpen = false;
        Achievements.check(this);
        this.time.delayedCall(600, () => this._lossNudge());

        if (data?.showTutorialSelect) {
            this._buildTutorialSelectScreen(W, H);
            return;
        }

        // Show shop prompt if coming from tutorial — only if flame sword not yet bought
        const flameSwordOwned = JSON.parse(localStorage.getItem('unlockedWeapons') || '[]').includes('flame_sword');
        if (data?.showShopPrompt && !flameSwordOwned) {
            this.time.delayedCall(500, () => this.showShopPrompt(data.glorps || 100));
        }

        UIKit.backdrop(this, { motes: 14 });

        // ── THE LEVELS ────────────────────────────────────────────────────
        // `page` is the Transitions.LEVELS / MenuArt.diorama index (the old carousel page);
        // `go` starts the level. Void Gate, Circuit Maze, Final Stand and THE END all fell
        // through to WorldGen's random generator; the Tower replaces them and, until it exists, opens that same procedural level.
        const L = Transitions.LEVELS;
        const NODES = [
            { page: 0, blurb: 'Learn the elements. Fire and ice, one room at a time.', verb: 'CHOOSE TUTORIAL',
              go: () => this.openTutorialSelect() },
            { page: 1, blurb: 'Climb the storm tower: five floors, and its floors carry current. Watch the panels, dash when they glow. Beat the Voltslime on the roof to claim LIGHTNING.', go: () => this.launchLevel(2) },
            { page: 2, blurb: 'Tear through the rift. The final chest holds COSMIC.', go: () => this.launchLevel(3) },
            { page: 3, blurb: 'Split rooms, split attention. Two threats at once.', go: () => this.launchLevel(4) },
            { page: 4, name: 'Engineering Defense', blurb: 'Hold the base for 30 waves. Towers, wisps and wrenches.', verb: 'DEFEND',
              go: () => Transitions.enterLevel(this, 4, () => this.scene.start('TowerDefenseScene'), this._enterFrom) },
            { page: 5, blurb: 'Flooded waterworks. The floor slows you, unless you hold ICE.', go: () => this.launchLevel(5) },
            { page: 9, name: 'The Tower', tag: 'THE ENDLESS CLIMB', accent: UIKit.PALETTE.accentGold, tower: true, verb: 'CLIMB',
              blurb: 'Endless floors, new layouts every climb, a boss every tenth floor. How high can you get?',
              go: () => this._towerGuide(() => TowerFloors.maxStart() > 1 ? this._openTowerStart() : this._climb(1)) },
        ].map((n, i) => ({
            ...n, i,
            id: Progress.ORDER[i],
            locked: !Progress.unlocked(Progress.ORDER[i]),
            name: n.name ?? L[n.page].name,
            tag: n.tag ?? L[n.page].tag,
            accent: n.accent ?? L[n.page].accent,
        }));

        // ── LAYOUT ────────────────────────────────────────────────────────
        const PAD = 24;
        const colW = Math.max(340, Math.min(470, Math.round(W * 0.36)));
        const map = { x: PAD, y: PAD, w: W - colW - PAD * 3, h: H - PAD * 2 - 18 };
        const col = { x: map.x + map.w + PAD, w: colW };
        const PACK_H = 176;
        const plaque = { x: col.x, y: PAD, w: col.w, h: H - PAD * 3 - PACK_H - 18 };
        const pack = { x: col.x, y: plaque.y + plaque.h + PAD, w: col.w, h: PACK_H };

        // The road: one smooth S down the sheet (two bends: right, then left), the levels spaced evenly along it. It was
        // a zig-zag of separate bows between alternating spots, which read as jagged.
        const ROAD = [[0.17, 0.18], [0.44, 0.15], [0.64, 0.23], [0.68, 0.38], [0.48, 0.50], [0.27, 0.60], [0.24, 0.75], [0.40, 0.86], [0.64, 0.89]];
        const road = new Phaser.Curves.Spline(ROAD.map(([u, v]) => new Phaser.Math.Vector2(map.x + map.w * u, map.y + map.h * v)));
        const roadLen = road.getLength(), at = NODES.map((n, i) => i / (NODES.length - 1));
        NODES.forEach((n, i) => { const p = road.getPointAt(at[i]); n.x = p.x; n.y = p.y; });
        // the legs between consecutive levels, sampled along the same road (the ink, and the slime walking it)
        const legs = [];
        for (let i = 0; i + 1 < NODES.length; i++) {
            const n = Math.max(12, Math.round(roadLen * (at[i + 1] - at[i]) / 6)), pts = [];
            for (let k = 0; k <= n; k++) pts.push(road.getPointAt(at[i] + (at[i + 1] - at[i]) * k / n));
            legs.push(pts);
        }

        this._drawMap(map, NODES, legs);
        this._drawIsle(map, NODES[3]);
        this._drawTraining(map);

        // ── SELECTION ─────────────────────────────────────────────────────
        let sel = Math.max(0, Math.min(NODES.length - 1, parseInt(localStorage.getItem('_lastWorld') || '0') || 0));
        const medals = NODES.map(n => this._drawMedal(n));

        // The lock-on ring (map_kit rg_<level>): lifts off the level you leave and snaps onto the one you reach,
        // closing in, then breathes while it sits there.
        const ring = this.add.image(0, 0, 'map_kit', 'rg_tut').setDepth(6).setAlpha(0);
        let ringBreath = null;
        const lockOn = (n) => {
            ringBreath?.stop(); this.tweens.killTweensOf(ring);
            ring.setFrame('rg_' + this._medalKey(n)).setPosition(n.x, n.y).setScale(3.6).setAlpha(0);
            this.tweens.add({ targets: ring, scale: 2, alpha: 1, duration: 300, ease: 'Back.easeOut',
                onComplete: () => { ringBreath = this.tweens.add({ targets: ring, scale: 2.14, alpha: 0.7, duration: 800, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' }); } });
        };
        const liftRing = () => {
            ringBreath?.stop(); this.tweens.killTweensOf(ring);
            this.tweens.add({ targets: ring, scale: 1, alpha: 0, duration: 140, ease: 'Quad.easeIn' });
        };

        // You: the slime, standing on the selected level.
        const SLIME_DY = -52;      // stands on top of the medallion
        const BASE = 2.3;
        const slime = this.add.sprite(NODES[sel].x, NODES[sel].y + SLIME_DY, 'slime_blue', 0).setScale(BASE).setDepth(9);
        if (typeof CreatureFX !== 'undefined') { CreatureFX.face(this, slime, { mood: 'friend', look: 'pointer' }); CreatureFX.boopable(this, slime, 'hero'); }
        const shadow = this.add.image(slime.x, NODES[sel].y - 24, 'map_kit', 'shadow').setScale(2).setAlpha(0.35 / 0.4).setDepth(8);
        const idle = () => this.tweens.add({ targets: slime, scaleY: BASE * 0.91, scaleX: BASE * 1.07, duration: 520, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
        let idleTw = idle();
        // a little kicked-up dust where it lands
        const puff = (x, y) => {
            for (let i = 0; i < 5; i++) {
                const d = this.add.image(x + (Math.random() - 0.5) * 8, y, 'mn_px2').setTint(0x8a6a40).setScale(1.6).setAlpha(0.8).setDepth(8.5);
                const a = Math.PI + (i / 4) * Math.PI;
                this.tweens.add({ targets: d, x: d.x + Math.cos(a) * (8 + Math.random() * 8), y: y + Math.sin(a) * 4 - 3, alpha: 0, scale: 0.4,
                                  duration: 320 + Math.random() * 120, ease: 'Quad.easeOut', onComplete: () => d.destroy() });
            }
        };

        let walking = false, queued = null, plaqueObjs = [];
        // The plaque: the old one slides out the way you came from, the new one slides in after.
        const renderPlaque = (dir = 0) => {
            const old = plaqueObjs;
            old.forEach(o => {
                if (!o?.active) return;
                this.tweens.killTweensOf(o);
                if (o.disableInteractive) o.disableInteractive();
                if (dir && o.x !== undefined && o.setAlpha) this.tweens.add({ targets: o, x: o.x - 28 * dir, alpha: 0, duration: 150, ease: 'Quad.easeIn', onComplete: () => o.destroy() });
                else o.destroy();
            });
            plaqueObjs = this._drawPlaque(plaque, NODES[sel], () => enter());
            let i = 0;
            plaqueObjs.forEach(o => {
                if (!o?.setAlpha || o.x === undefined || o.type === 'Zone') return;
                const tx = o.x, ta = o.alpha;
                o.x = tx + 28 * (dir || 1); o.setAlpha(0);
                this.tweens.add({ targets: o, x: tx, alpha: ta, duration: 260, delay: (dir ? 90 : 0) + Math.min(140, (i++) * 8), ease: 'Cubic.easeOut' });
            });
        };

        // Walk the slime along the path to node `to`: hops sized to the distance, a squash on
        // every landing, its shadow shrinking as it rises, a glowing trail on the ink behind it.
        // A press while it's walking is kept and walked next, rather than dropped.
        const select = (to) => {
            to = Math.max(0, Math.min(NODES.length - 1, to));
            if (this._entering || this._settingsOpen) return;
            if (walking) { queued = to; return; }
            if (to === sel) return;
            const from = sel, dir = Math.sign(to - from);
            sel = to;
            localStorage.setItem('_lastWorld', String(sel));
            renderPlaque(dir);
            medals.forEach((m, k) => m.setFocus(k === sel));
            liftRing();
            Sfx.play(this, 'hover');
            const pts = [];
            if (to > from) for (let k = from; k < to; k++) pts.push(...legs[k]);
            else for (let k = from - 1; k >= to; k--) pts.push(...legs[k].slice().reverse());
            const cum = [0];
            for (let i = 1; i < pts.length; i++) cum.push(cum[i - 1] + Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y));
            const total = cum[cum.length - 1] || 1, hops = Math.max(1, Math.round(total / 52));
            const at = (dist) => {   // the point `dist` along the path
                let i = 1; while (i < cum.length - 1 && cum[i] < dist) i++;
                const f = (dist - cum[i - 1]) / Math.max(0.001, cum[i] - cum[i - 1]);
                return { x: pts[i - 1].x + (pts[i].x - pts[i - 1].x) * f, y: pts[i - 1].y + (pts[i].y - pts[i - 1].y) * f, dx: pts[i].x - pts[i - 1].x };
            };
            walking = true;
            idleTw?.stop();
            const trail = this.add.graphics().setDepth(2.5).setBlendMode(Phaser.BlendModes.ADD);
            let last = at(0), lastHop = 0;
            const c = { t: 0 };
            this.tweens.add({
                targets: c, t: 1, duration: Phaser.Math.Clamp(total / 0.55, 380, 1300), ease: 'Sine.easeInOut',
                onUpdate: () => {
                    const p = at(c.t * total), ph = c.t * hops, frac = ph - Math.floor(ph), air = Math.sin(Math.PI * frac);
                    if (Math.floor(ph) !== lastHop && Math.floor(ph) < hops) { lastHop = Math.floor(ph); puff(p.x, p.y - 24); }
                    const squash = frac < 0.14 ? 1 - frac / 0.14 : 0;
                    slime.setScale(BASE * (1 + 0.16 * squash - 0.06 * air), BASE * (1 - 0.16 * squash + 0.1 * air));
                    slime.setPosition(p.x, p.y + SLIME_DY - air * 13);
                    if (Math.abs(p.dx) > 0.3) slime.setFlipX(p.dx < 0);
                    shadow.setPosition(p.x, p.y - 24).setScale(2 * (1 - air * 0.4)).setAlpha((0.35 - air * 0.15) / 0.4);
                    trail.lineStyle(4, NODES[sel].accent, 0.55); trail.lineBetween(last.x, last.y, p.x, p.y);
                    trail.lineStyle(1.5, 0xffffff, 0.6); trail.lineBetween(last.x, last.y, p.x, p.y);
                    last = p;
                },
                onComplete: () => {
                    const n = NODES[sel];
                    this.tweens.add({ targets: trail, alpha: 0, duration: 600, onComplete: () => trail.destroy() });
                    puff(n.x, n.y - 24);
                    slime.setPosition(n.x, n.y + SLIME_DY).setScale(BASE * 1.2, BASE * 0.8);
                    shadow.setPosition(n.x, n.y - 24).setScale(2).setAlpha(0.35 / 0.4);
                    this.tweens.add({ targets: slime, scaleX: BASE, scaleY: BASE, duration: 220, ease: 'Back.easeOut', onComplete: () => { idleTw = idle(); } });
                    medals[sel].pop();
                    lockOn(n);
                    walking = false;
                    if (queued !== null) { const q = queued; queued = null; select(q); }
                },
            });
        };
        const enter = () => {
            if (walking || this._entering || this._settingsOpen) return;
            if (NODES[sel].locked) { this._refuseSealed(NODES[sel]); return; }
            // Once a level is on its way in, clicks and keys do nothing: spamming used to start
            // a fresh iris and card on every press. (The tutorial only opens its picker.)
            if (NODES[sel].page !== 0 && !NODES[sel].tower) this._entering = true;   // (the Tower opens a panel first: _climb locks it once you climb)
            // the iris closes on the slime standing on this medallion (screen coords)
            const cam = this.cameras.main;
            this._enterFrom = { x: NODES[sel].x - cam.scrollX, y: NODES[sel].y + SLIME_DY + 18 - cam.scrollY };
            Sfx.play(this, 'click'); NODES[sel].go();
        };

        medals.forEach((m, k) => m.onClick(() => (k === sel ? enter() : select(k))));
        lockOn(NODES[sel]); renderPlaque();
        medals.forEach((m, k) => m.setFocus(k === sel));

        for (const k of ['LEFT', 'UP', 'A', 'W']) this.input.keyboard.on('keydown-' + k, () => select(sel - 1));
        for (const k of ['RIGHT', 'DOWN', 'D', 'S']) this.input.keyboard.on('keydown-' + k, () => select(sel + 1));
        this.input.keyboard.on('keydown-ENTER', enter);
        this.input.keyboard.on('keydown-SPACE', enter);
        this.input.keyboard.on('keydown', (e) => {
            if (this._settingsOpen) return;
            const n = parseInt(e.key);
            if (n >= 1 && n <= NODES.length) select(n - 1);
        });

        this._drawPack(pack);


        this.add.text(map.x + map.w / 2, H - 10,
            'Arrows walk  •  Enter goes in  •  1-7 jump  •  I the Isle' + (Progress.devMode() ? '  •  DEV MODE: every level open' : ''), {
            fontSize: '12px', fontFamily: 'monospace', color: UIKit.CSS.textLo
        }).setOrigin(0.5, 1);

        this.cameras.main.fadeIn(220, 0, 0, 0);
    }

    // ── THE SHEET ─────────────────────────────────────────────────────────────
    // ── THE MAP'S VIGNETTES ───────────────────────────────────────────────────
    // A painted scene beside each level (assets/art map_vig_<kind>: 56x48, 4 frames, typed by hand), drawn 2x; its
    // animation is made here. And the small details for the empty parchment (map_decor_<kind>, 24x24).
    static vignette(scene, kind) {
        const key = 'map_vig_' + kind;
        if (!scene.textures.exists(key)) return null;
        if (!scene.anims.exists(key)) scene.anims.create({ key, frames: [0, 1, 2, 3].map(f => ({ key, frame: String(f) })), frameRate: 5, repeat: -1 });
        return key;
    }
    static mapDecor(scene, kind) {
        const key = 'map_decor_' + kind;
        return scene.textures.exists(key) ? key : null;
    }

    // The Enchanter's Isle (EnchantScene), off the route: an inked island out to sea, a dotted
    // sea lane to it from `from`, and its label. Click it (or press I) to sail there.
    // The Training Ground: a sandy ring with two straw dummies, off the path in the map's corner (Training.js). T or a click.
    _drawTraining(m) {
        const x = m.x + m.w * 0.88, y = m.y + m.h * 0.12;
        this.add.image(x, y, 'map_kit', 'training').setOrigin(19.5 / 40, 15.5 / 27).setScale(2).setDepth(2);   // its fence and dummies (map_kit)
        const glow = this.add.image(x, y, 'mn_glow').setTint(0xf6d58a).setBlendMode(Phaser.BlendModes.ADD).setDisplaySize(130, 80).setAlpha(0.2).setDepth(1.9);
        this.tweens.add({ targets: glow, alpha: 0.4, duration: 1500, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
        const name = this.add.text(x, y + 34, 'Training Ground', { fontSize: '15px', fontFamily: UIKit.FONT.title, fontStyle: 'bold', color: '#3b2716' }).setOrigin(0.5).setDepth(4);
        const tag = this.add.text(x, y + 51, 'TEST ANYTHING  ·  T', { fontSize: '10px', fontFamily: 'monospace', fontStyle: 'bold', color: '#7a5a34' }).setOrigin(0.5).setDepth(4);
        const bw = Math.max(name.width, tag.width) + 14;
        this._scrap(x - bw / 2, y + 22, bw, 38);
        const go = () => {
            if (this._entering || this._settingsOpen) return;
            this._entering = true; Sfx.play(this, 'click'); this.input.enabled = false;   // nothing else answers on the way out
            this.cameras.main.fadeOut(350, 5, 3, 12);
            this.time.delayedCall(370, () => this.scene.start('Game', { levelIndex: 98, training: true }));
        };
        const hit = this.add.zone(x, y + 10, 120, 100).setInteractive({ useHandCursor: true }).setDepth(7);
        hit.on('pointerover', () => glow.setAlpha(0.6)); hit.on('pointerout', () => glow.setAlpha(0.25));
        hit.on('pointerdown', go);
        this.input.keyboard.on('keydown-T', go);
    }
    _drawIsle(m, from) {
        MenuArt.basics(this);   // the glow
        const x = m.x + m.w * 0.885, y = m.y + m.h * 0.37;
        // the sea lane: dashes of sea ink along it, each turned the way the lane runs (map_kit sl*)
        const c = new Phaser.Curves.QuadraticBezier(new Phaser.Math.Vector2(from.x + 30, from.y - 10), new Phaser.Math.Vector2(x - 10, from.y + 10), new Phaser.Math.Vector2(x - 18, y + 26));
        const pts = c.getSpacedPoints(26);
        for (let k = 0; k + 1 < pts.length; k += 2) {
            const a = pts[k], b = pts[k + 1], deg = (Math.atan2(a.y - b.y, b.x - a.x) * 180 / Math.PI + 360) % 180;
            this._inkStamp?.(`sl${Math.round(deg / 22.5) % 8}_${(k >> 1) % 3 === 2 ? 1 : 0}`, (a.x + b.x) / 2 - 4, (a.y + b.y) / 2 - 4, 0.6);
        }
        // the island: its inked shore, hatched, the altar's crystals on top, and the water round it in rings of short strokes
        this.add.image(x, y, 'map_kit', 'isle').setOrigin(31.5 / 62, 22.5 / 40).setScale(2).setDepth(2);
        // its label, and a glow so it reads as a place you can go
        const glow = this.add.image(x, y - 6, 'mn_glow').setTint(0xb48cf0).setBlendMode(Phaser.BlendModes.ADD).setDisplaySize(130, 90).setAlpha(0.25).setDepth(1.9);
        this.tweens.add({ targets: glow, alpha: 0.5, duration: 1400, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
        const name = this.add.text(x, y + 40, "Enchanter's Isle", { fontSize: '15px', fontFamily: UIKit.FONT.title, fontStyle: 'bold', color: '#4a2a7a' }).setOrigin(0.5).setDepth(4);
        const tag = this.add.text(x, y + 57, 'ENCHANTING  ·  I', { fontSize: '10px', fontFamily: 'monospace', fontStyle: 'bold', color: '#7a5a34' }).setOrigin(0.5).setDepth(4);
        const bw = Math.max(name.width, tag.width) + 14;
        this._scrap(x - bw / 2, y + 28, bw, 38);
        const go = () => {
            if (this._entering || this._settingsOpen) return;
            this._entering = true; Sfx.play(this, 'click'); this.input.enabled = false;   // nothing else answers on the way out
            this.cameras.main.fadeOut(350, 5, 3, 12);
            this.time.delayedCall(370, () => this.scene.start('Enchant'));
        };
        const hit = this.add.zone(x, y + 10, 110, 100).setInteractive({ useHandCursor: true }).setDepth(7);
        hit.on('pointerover', () => glow.setAlpha(0.7)); hit.on('pointerout', () => glow.setAlpha(0.3));
        hit.on('pointerdown', go);
        this.input.keyboard.on('keydown-I', go);
    }

    // Aged parchment nailed to the wall: stains, fold lines, a scorched rim; an inked chamber
    // round every level, the dashed path between them, the title and a compass rose.
    _drawMap(m, nodes, legs) {
        const R = MenuArt.rng(1337);
        // the parchment (MenuArt.parchment): torn, scorched, stained, creased; its shadow under it
        const pa = MenuArt.parchment(this, `mn_parchment_${m.w}x${m.h}`, m.w, m.h);
        this.add.image(m.x + 7, m.y + 9, pa.key).setOrigin(0).setScale(pa.scale).setDepth(1).setTintFill(0x000000).setAlpha(0.55);
        this.add.image(m.x, m.y, pa.key).setOrigin(0).setScale(pa.scale).setDepth(1);
        // nails, each with a little tear where the paper pulled against it (map_kit, as is everything inked on the sheet)
        for (const [x, y, t, ox, oy] of [[m.x + 22, m.y + 22, 'tl', 1, 1], [m.x + m.w - 24, m.y + 26, 'tr', 0, 1], [m.x + 26, m.y + m.h - 24, 'bl', 1, 0], [m.x + m.w - pa.corner - 30, m.y + m.h - 22, 'br', 0, 0]]) {
            this.add.image(x, y, 'map_kit', 'tear_' + t).setOrigin(ox, oy).setScale(2).setDepth(1.5);
            this.add.image(x, y, 'map_kit', 'nail').setOrigin(2.5 / 6).setScale(2).setDepth(1.5);
        }
        // The ink on the sheet, at the paper's own pixels: a stamp of a typed piece at (x, y) on the sheet, in screen pixels
        if (this.textures.exists('mn_ink')) this.textures.remove('mn_ink');
        const inkT = this.textures.addDynamicTexture('mn_ink', Math.ceil(m.w / 2), Math.ceil(m.h / 2));
        const stamp = this._inkStamp = (n, x, y, alpha = 1) => inkT.stamp('map_kit', n, Math.round((x - m.x) / 2), Math.round((y - m.y) / 2), { originX: 0, originY: 0, alpha });
        // An inked chamber round every level: a ruled room, washed and hatched (the Tower's with battlements)
        nodes.forEach(n => n.tower ? stamp('room_t', n.x - 50, n.y - 50) : stamp('room', n.x - 41, n.y - 32));
        // The path: a hand-inked trail along each leg, a stroke for each way the road turns, with a pair of footprints every
        // so often pointing the way. The way to a sealed level is only pencilled in: faint and dotted.
        legs.forEach((pts, li) => {
            const faint = nodes[li + 1].locked, cum = [0];
            for (let k = 1; k < pts.length; k++) cum.push(cum[k - 1] + Math.hypot(pts[k].x - pts[k - 1].x, pts[k].y - pts[k - 1].y));
            const L = cum[cum.length - 1], at = d => {   // the point d along the leg
                let k = 1; while (k < cum.length - 1 && cum[k] < d) k++;
                const f = Math.max(0, Math.min(1, (d - cum[k - 1]) / Math.max(0.001, cum[k] - cum[k - 1])));
                return { x: pts[k - 1].x + (pts[k].x - pts[k - 1].x) * f, y: pts[k - 1].y + (pts[k].y - pts[k - 1].y) * f };
            };
            for (let d = 0, k = 0; d <= L; d += 14, k++) {   // a 9-pixel stroke every 7 of the sheet's pixels, by its heading
                if (faint && k % 2) continue;
                const p = at(d), a0 = at(d - 4), a1 = at(d + 4), deg = (Math.atan2(a0.y - a1.y, a1.x - a0.x) * 180 / Math.PI + 360) % 180;
                stamp(`rd${Math.round(deg / 22.5) % 8}_${(k * 7 + li) % 3 === 0 ? 1 : 0}`, p.x - 8, p.y - 8, faint ? 0.35 : 1);
            }
            if (faint) return;
            for (let d = 18; d + 12 < L; d += 36) {   // footprints, beside the line
                const a0 = at(d), a1 = at(d + 2), len = Math.hypot(a1.x - a0.x, a1.y - a0.y) || 1, nx = -(a1.y - a0.y) / len, ny = (a1.x - a0.x) / len;
                for (const [side, f] of [[1, 0], [-1, 6]]) { const q = at(d + f); stamp('foot', q.x + nx * 6 * side - 2, q.y + ny * 6 * side - 2); }
            }
        });
        // the compass rose (its N is set in the title's ink below)
        const cx = m.x + m.w - 70, cy = m.y + 74, rr = 34;
        stamp('compass', cx - 34, cy - 34);
        this.add.image(m.x, m.y, 'mn_ink').setOrigin(0).setScale(2).setDepth(2);
        // a painted vignette beside each level, on the side its label isn't (faded while it's sealed)
        const ART = ['camp', 'storm', 'rift', 'chasm', 'fort', 'sunken', 'castle'];
        const taken = [];   // what's on the sheet already, so the small details keep clear of it
        nodes.forEach((n, i) => {
            const k = LevelSelectScene.vignette(this, ART[i]);
            const right = n.x < m.x + m.w / 2, want = n.x + (right ? -1 : 1) * ((n.tower ? 48 : 39) + 62);
            let ax = Phaser.Math.Clamp(want, m.x + 62, m.x + m.w - 62), ay = n.y - 6;
            if (Math.abs(ax - want) > 8) { ax = n.x + (right ? 1 : -1) * 228; ay = n.y - 18; }   // no room on that side (the sheet's edge): past its label instead
            if (k) { const im = this.add.sprite(ax, ay, k, '0').setScale(2).setDepth(2.5).play(k); if (n.locked) im.setAlpha(0.55).setTint(0xb8a890); }
            taken.push([ax, ay, 56], [n.x, n.y, 60], [n.x + (right ? 110 : -110), n.y, 80]);
        });
        // small details for the empty parchment: trees, hills, ruins, a campfire, a skull
        const DEC = ['pines', 'hills', 'pines', 'ruin', 'hills', 'pines', 'fire', 'skull', 'ruin', 'pines', 'hills', 'pines'];
        for (const [x, y] of [[44, 62], [104, 62], [164, 62], [64, 118], [64, 176], [128, 176]]) taken.push([m.x + x, m.y + m.h - y, 34]);   // (kept clear: the corner's doodles, below)
        const pathPts = legs.flat();
        let placed = 0;
        for (let tries = 0; tries < 400 && placed < DEC.length; tries++) {
            const x = m.x + 40 + R() * (m.w - 80), y = m.y + 110 + R() * (m.h - 150);
            if (taken.some(([tx, ty, r]) => Math.hypot(tx - x, ty - y) < r + 26)) continue;
            if (pathPts.some(p => Math.hypot(p.x - x, p.y - y) < 30)) continue;
            if (x > m.x + m.w - 180 && y < m.y + 340) continue;   // the compass and the isle
            const k = LevelSelectScene.mapDecor(this, DEC[placed]);
            if (k) this.add.image(x, y, k).setScale(2).setDepth(2.4).setAlpha(0.85);
            taken.push([x, y, 30]); placed++;
        }

        // Labels: the level's name in ink, on the open side of its chamber, on a scrap of
        // clean paper so the path runs underneath rather than through the letters.
        const plates = [];   // labels already down, so the next one can step clear of them (the Cistern's sat on the Tower's)
        nodes.forEach(n => {
            const right = n.x < m.x + m.w * 0.5;
            const lx = n.x + (right ? 1 : -1) * ((n.tower ? 48 : 39) + 12);
            let ly = n.y;
            const name = this.add.text(lx, ly - 8, n.name, {
                fontSize: n.tower ? '20px' : '17px', fontFamily: UIKit.FONT.title, fontStyle: 'bold', color: n.locked ? '#9a8262' : '#3b2716',
            }).setOrigin(right ? 0 : 1, 0.5).setDepth(4);
            const tag = this.add.text(lx, ly + 11, n.locked ? 'sealed' : n.tag.toLowerCase(), {
                fontSize: '12px', fontFamily: UIKit.FONT.title, fontStyle: 'italic', color: '#7a5a34',
            }).setOrigin(right ? 0 : 1, 0.5).setDepth(4);
            if (!n.locked && Progress.cleared?.(n.id)) {   // cleared: a red-ink tick by its chamber
                const tx = n.x + (right ? -1 : 1) * ((n.tower ? 48 : 39) - 6), ty = n.y - (n.tower ? 40 : 30);
                this.add.image(tx + 1, ty - 1, 'map_kit', 'tick').setScale(2).setDepth(6);
            }
            const bw = Math.max(name.width, tag.width) + 12, bx = right ? lx - 6 : lx - bw + 6;
            const hit = () => plates.find(([px2, top, pw2]) => bx < px2 + pw2 && bx + bw > px2 && ly - 21 < top + 40 && ly + 19 > top);
            for (let k = 0, o; k < 4 && (o = hit()); k++) ly = ly - 21 >= o[1] ? o[1] + 44 + 21 : o[1] - 44 + 21;   // step past it: below it if it was lower, above if higher
            if (ly !== n.y) { name.setY(ly - 8); tag.setY(ly + 11); }
            plates.push([bx, ly - 21, bw]);
            this._scrap(bx, ly - 21, bw, 40);
        });

        // A little inked ? by the Tower (its guide again), and a scrawled one in the corner for the whole game's
        // and in the corner, scrawled in the margin hand (map_kit sc_*): a ?, a book, a page, a podium, a little slime
        const scrawl = (x, y, frame, oy, label, angle, zw, zh, onClick) => {
            const g = this.add.image(x, y, 'map_kit', 'sc_' + frame).setOrigin(0.5, oy).setScale(2).setDepth(6);
            const t = label ? this.add.text(x, y + (frame === 'qbig' ? 21 : 14), label, { fontSize: '12px', fontFamily: UIKit.FONT.title, fontStyle: 'italic', color: '#5a3a1a' }).setOrigin(0.5, 0).setDepth(6).setAngle(angle) : null;
            const z = this.add.zone(x, y + (frame === 'qbig' || frame === 'qsmall' ? 0 : 4), zw, zh).setInteractive({ useHandCursor: true }).setDepth(7);
            z.on('pointerover', () => { g.setScale(2.24); t?.setScale(1.08); });
            z.on('pointerout', () => { g.setScale(2); t?.setScale(1); });
            z.on('pointerdown', () => { if (!this._settingsOpen) onClick(); });
        };
        const tw = nodes.find(n => n.tower);   // a little inked ? by the Tower (its guide again), a big one for the whole game's
        if (tw && !tw.locked) scrawl(tw.x + 52, tw.y - 50, 'qsmall', 0.55, null, 0, 24, 29, () => this._towerGuide(() => {}, true));
        scrawl(m.x + 44, m.y + m.h - 62, 'qbig', 0.55, 'guide', -6, 40, 47, () => this._gameGuide());
        scrawl(m.x + 104, m.y + m.h - 64, 'book', 0.6, 'enemies', 4, 50, 46, () => this._openIndex());   // every enemy
        scrawl(m.x + 164, m.y + m.h - 64, 'page', 0.55, 'all guides', -3, 60, 46, () => window.open('guide/', '_blank', 'noopener'));   // the guides on the web, in a new tab
        scrawl(m.x + 64, m.y + m.h - 176, 'podium', 0.6, 'leaderboards', 3, 64, 46, () => Cloud.open('board'));
        scrawl(m.x + 60, m.y + m.h - 118, 'acct', 0.55, 'account', -5, 64, 46, () => Cloud.open('account'));   // your account, saved online
        Bounties.mapBoard(this, m.x + 128, m.y + m.h - 176);   // the bounty board (Bounties.js)

        // Title cartouche and compass rose.
        const title = this.add.text(m.x + 34, m.y + 30, 'THE DUNGEON', {
            fontSize: '30px', fontFamily: UIKit.FONT.title, fontStyle: 'bold', color: '#3b2716',
        }).setDepth(3.1);
        const sub = this.add.text(m.x + 36, m.y + 66, 'World I  ·  as far as anyone has mapped it', {
            fontSize: '12px', fontFamily: UIKit.FONT.title, fontStyle: 'italic', color: '#6a4a26',
        }).setDepth(3.1);
        {   // on a scrap of clean paper, as the levels' names are: the Gauntlet's storm cloud passes behind it, not through the words
            this._scrap(m.x + 26, m.y + 26, Math.max(title.width, sub.width + 2) + 16, 60);
        }
        this.add.text(cx, cy - rr - 10, 'N', { fontSize: '13px', fontFamily: UIKit.FONT.title, fontStyle: 'bold', color: '#3b2716' }).setOrigin(0.5).setDepth(3);
    }

    // A scrap of clean paper glued on the map under a label (map_kit 'plate', nine-sliced, at the sheet's 2x)
    _scrap(x, y, w, h, depth = 3) {
        return this.add.nineslice(x, y, 'map_kit', 'plate', Math.ceil(w / 2), Math.ceil(h / 2), 3, 3, 3, 3).setOrigin(0).setScale(2).setDepth(depth);
    }

    // A level's medallion: an iron ring round an enamelled disc with its number (the Tower's,
    // bigger, an infinity sign). Returns setFocus(on) and onClick(fn).
    // its medal and lock-on ring in map_kit: md_<level> / rg_<level>, md_lock(t) sealed
    static MEDAL_KEY = ['tut', 'storm', 'rift', 'frac', 'def', 'cist'];
    _medalKey(n) { return n.tower ? 'tower' : LevelSelectScene.MEDAL_KEY[n.page] || 'tut'; }
    _drawMedal(n) {
        const r = n.tower ? 30 : 24;
        const c = this.add.container(n.x, n.y).setDepth(5);
        const half = n.tower ? 16.5 : 13.5, size = half * 2 + 1;   // the disc's middle (its frame has a pixel of shadow beyond it)
        const g = this.add.image(0, 0, 'map_kit', n.locked ? (n.tower ? 'md_lockt' : 'md_lock') : 'md_' + this._medalKey(n)).setOrigin(half / size).setScale(2);
        if (n.locked) {   // its padlock is in its frame, where the number would be
            c.add(g);
            const hit0 = this.add.circle(n.x, n.y, r + 8, 0xffffff, 0).setDepth(7).setInteractive({ useHandCursor: true });
            hit0.on('pointerover', () => this.tweens.add({ targets: c, scale: c._focus ? 1.18 : 1.1, duration: 110 }));
            hit0.on('pointerout', () => this.tweens.add({ targets: c, scale: c._focus ? 1.12 : 1, duration: 110 }));
            return {
                setFocus: (on) => { c._focus = on; this.tweens.add({ targets: c, scale: on ? 1.12 : 1, duration: 160, ease: 'Back.easeOut' }); },
                pop: () => { this.tweens.killTweensOf(c); c.setScale(1.3); this.tweens.add({ targets: c, scale: 1.12, duration: 260, ease: 'Back.easeOut' }); },
                onClick: (fn) => hit0.on('pointerdown', fn),
            };
        }
        // lining digits: the title face's old-style numerals sat low (3 4 5 9) or high (6 8) in the ring
        const t = this.add.text(0, 0, n.tower ? '∞' : String(n.i + 1), {
            fontSize: n.tower ? '40px' : '22px', fontFamily: '"Trebuchet MS", Verdana, Arial, sans-serif', fontStyle: 'bold',
            color: UIKit.CSS.textHi, stroke: '#000', strokeThickness: 4,
        }).setOrigin(0.5);
        c.add([g, t]);
        const hit = this.add.circle(n.x, n.y, r + 8, 0xffffff, 0).setDepth(7).setInteractive({ useHandCursor: true });
        hit.on('pointerover', () => this.tweens.add({ targets: c, scale: c._focus ? 1.18 : 1.1, duration: 110 }));
        hit.on('pointerout', () => this.tweens.add({ targets: c, scale: c._focus ? 1.12 : 1, duration: 110 }));
        return {
            setFocus: (on) => { c._focus = on; this.tweens.add({ targets: c, scale: on ? 1.12 : 1, duration: 160, ease: 'Back.easeOut' }); },
            // arriving: a bounce, and a ring of ink-light thrown off it
            pop: () => {
                this.tweens.killTweensOf(c); c.setScale(1.35);
                this.tweens.add({ targets: c, scale: 1.12, duration: 300, ease: 'Back.easeOut' });
                const w = this.add.circle(n.x, n.y, r + 4).setStrokeStyle(3, n.accent, 0.9).setDepth(6);
                this.tweens.add({ targets: w, scale: 2.2, alpha: 0, duration: 420, ease: 'Quad.easeOut', onComplete: () => w.destroy() });
            },
            onClick: (fn) => hit.on('pointerdown', fn),
        };
    }

    // The plaque: the selected level, large. Its diorama in a frame, name, tag, blurb, and the
    // way in. Returns its objects so the scene can replace it when the selection moves.
    _drawPlaque(p, n, onGo) {
        const objs = [];
        const keep = o => { objs.push(o); return o; };
        const pane = UIKit.panel(this, { x: p.x, y: p.y, w: p.w, h: p.h, accent: n.accent, depth: 10, fixed: false });
        objs.push(...pane.objs);
        const artH = Math.min(150, Math.round(p.h * 0.36)), artW = p.w - 36, ax = p.x + 18, ay = p.y + 18;
        const fr = keep(this.add.graphics().setDepth(11));
        fr.fillStyle(0x05070c, 1); fr.fillRect(ax, ay, artW, artH);
        if (typeof MenuArt !== 'undefined' && MenuArt.diorama) {
            const art = keep(this.add.container(0, 0).setDepth(11));
            art.add(MenuArt.diorama(this, n.page, ax + artW / 2, ay + artH / 2, artW, artH, { live: true }).objs);
            const mask = this.make.graphics({}, false); mask.fillRect(ax, ay, artW, artH);
            art.setMask(mask.createGeometryMask());
            keep(mask);
        }
        const rim = keep(this.add.graphics().setDepth(12));
        rim.lineStyle(3, UIKit.PALETTE.iron, 1); rim.strokeRect(ax, ay, artW, artH);
        rim.lineStyle(1, n.accent, 0.6); rim.strokeRect(ax + 3, ay + 3, artW - 6, artH - 6);

        let ty = ay + artH + 22;
        keep(this.add.text(p.x + 22, ty, n.tower ? 'BEYOND THE STORY' : `LEVEL ${n.i + 1}`, {
            fontSize: '12px', fontFamily: 'monospace', fontStyle: 'bold', color: UIKit._hex(n.accent),
        }).setDepth(12));
        ty += 18;
        keep(this.add.text(p.x + 22, ty, n.name, {
            fontSize: '30px', fontFamily: UIKit.FONT.title, fontStyle: 'bold', color: UIKit.CSS.textHi,
            stroke: '#000', strokeThickness: 4,
        }).setDepth(12));
        ty += 42;
        keep(this.add.text(p.x + 22, ty, n.tag, {
            fontSize: '13px', fontFamily: 'monospace', fontStyle: 'bold', color: UIKit._hex(n.accent),
        }).setDepth(12));
        ty += 26;
        const rl = keep(this.add.graphics().setDepth(12));
        rl.lineStyle(1, n.accent, 0.4); rl.lineBetween(p.x + 22, ty, p.x + p.w - 22, ty);
        ty += 12;
        keep(this.add.text(p.x + 22, ty, n.blurb, {
            fontSize: '14px', fontFamily: 'monospace', color: UIKit.CSS.textMid,
            wordWrap: { width: p.w - 44 }, lineSpacing: 6,
        }).setDepth(12));

        if (n.locked) {
            // Sealed: the art behind smoked glass, a chain across it, and what opens it.
            const smoke = keep(this.add.graphics().setDepth(12));
            smoke.fillStyle(0x0d0a08, 0.72); smoke.fillRect(ax, ay, artW, artH);
            smoke.lineStyle(5, UIKit.PALETTE.ironHi, 1);
            for (let k = 0; k < 7; k++) smoke.strokeEllipse(ax + 30 + k * (artW - 60) / 6, ay + artH / 2 + (k % 2 ? 3 : -3), 26, 14);
            keep(this.add.text(ax + artW / 2, ay + artH / 2, 'SEALED', {
                fontSize: '26px', fontFamily: UIKit.FONT.title, fontStyle: 'bold', color: '#d2bf98', stroke: '#000', strokeThickness: 6,
            }).setOrigin(0.5).setDepth(12));
            keep(this.add.text(p.x + 22, p.y + p.h - 88, `Clear ${Progress.NAMES[Progress.needs(n.id)]} to open this level.`, {
                fontSize: '13px', fontFamily: 'monospace', fontStyle: 'bold', color: UIKit.CSS.accentGold, wordWrap: { width: p.w - 44 },
            }).setDepth(12));
        }
        const b = UIKit.button(this, {
            x: p.x + p.w / 2, y: p.y + p.h - 38, w: p.w - 44, h: 46,
            label: n.locked ? 'SEALED' : (n.verb || 'ENTER') + '  ▸', accent: n.locked ? UIKit.PALETTE.line : n.accent, fontSize: '19px',
            depth: 13, fixed: false, fireOn: 'down', onClick: onGo,
        });
        objs.push(...b.objs);
        return objs;
    }

    // Trying a sealed level: the plaque's chain rattles and you're told what opens it.
    _refuseSealed(n) {
        Sfx.play(this, 'hurt');
        this.cameras.main.shake(120, 0.004);
        const need = Progress.needs(n.id);
        const t = this.add.text(this.scale.width / 2, this.scale.height / 2, `SEALED: clear ${Progress.NAMES[need]} first`, {
            fontSize: '20px', fontFamily: UIKit.FONT.title, fontStyle: 'bold', color: UIKit.CSS.accentGold,
            stroke: '#000', strokeThickness: 6, backgroundColor: '#1b1612', padding: { x: 14, y: 8 },
        }).setOrigin(0.5).setDepth(200);
        this.tweens.add({ targets: t, alpha: 0, y: t.y - 30, delay: 1100, duration: 400, onComplete: () => t.destroy() });
    }

    // The pack: one row per element (its weapon; click it to open the shop on it), the glorp
    // purse and the way to Glurp's shop.
    // ── SETTINGS ─────────────────────────────────────────────────────────────
    // An overlay over the map: sound and screen shake on the left, every keybind on the
    // right (click one, then press the key you want; Esc cancels; a key already in use swaps
    // over). Saved as you go (Sound.js, Settings.js); levels pick it up when they load.
    // ── THE TOWER'S START ────────────────────────────────────────────────────
    // Once you've climbed past floor SKIP_BACK + 1, a climb can start higher up for a fee,
    // with a catch-up boon for every one the skipped floors would have given (Tower.js).
    _climb(floor) {
        if (this._entering) return;
        this._entering = true;
        Transitions.enterLevel(this, this._introIndexFor(6), () => this.scene.start('Game', { levelIndex: 6, tower: TowerFloors.newRun(floor) }), this._enterFrom);
    }
    // the shop's hover words, for the guide (ShopScene: *keyword* text and its tooltip)
    _richText(...a) { return ShopScene.prototype._richText.call(this, ...a); }
    _tipZone(...a) { return ShopScene.prototype._tipZone.call(this, ...a); }
    _showTip(...a) {
        this._tipDepth = 260;   // over the guide
        ShopScene.prototype._showTip.call(this, ...a);
        const T = this._tip;
        if (T) { [T.g, T.head, T.text].forEach(o => o.setScrollFactor(0)); T.text.setColor('#e8dcc0'); }   // light text: the frame is dark here
    }
    _moveTip(...a) { return ShopScene.prototype._moveTip.call(this, ...a); }
    _hideTip(...a) { return ShopScene.prototype._hideTip.call(this, ...a); }

    // ── THE ENEMY INDEX ─────────────────────────────────────────────────────
    // Every enemy in the game: a grid of them as they look in a fight (body, hat, eyes, breathing), a page at a time,
    // and the chosen one big with its card (LevelManager._enemyCodex). From the scrawled book on the map.
    _openIndex() {
        if (this._settingsOpen) return;
        this._settingsOpen = true;
        Sfx.play(this, 'click');
        CreatureFX.sheets(this);
        const codex = LevelManager.prototype._enemyCodex.call(this), ALL = Object.keys(codex);
        let keys = ALL, tag = null;   // the filter chips narrow `keys` to one category (LevelManager.ENEMY_TAGS)
        const TYPES = CreatureFX.prototype._cfxCfg.call({}).TYPES;
        const W = this.scale.width, H = this.scale.height, D = 200, P = UIKit.PALETTE, objs = [];
        let page = 0, pick = 0, view = [];
        const keep = o => { objs.push(o); o.setScrollFactor?.(0); return o; };
        const kit = k => { objs.push(...k.objs); return k; };
        const COLS = 5, ROWS = 4, PER = COLS * ROWS;
        let pages = Math.ceil(keys.length / PER);
        kit(UIKit.overlay(this, { alpha: 0.85, depth: D }));
        const pw = Math.min(1000, W - 40), ph = Math.min(640, H - 30), px = W / 2 - pw / 2, py = H / 2 - ph / 2;
        kit(UIKit.panel(this, { x: px, y: py, w: pw, h: ph, accent: P.accentRed, depth: D + 1, title: 'THE ENEMIES', titleSize: '20px' }));
        const countTxt = keep(this.add.text(px + pw - 24, py + 26, `${keys.length} kinds`, { fontSize: '12px', fontFamily: 'monospace', color: UIKit.CSS.textLo }).setOrigin(1, 0.5).setDepth(D + 3));
        // the categories: ALL, then one chip each; a chip shows its colour, and what it means on hover
        const TG = LevelManager.ENEMY_TAGS, tagsOf = k => TG[k] || TG[k.split('_')[0]] || [];
        const chips = [], hint = keep(this.add.text(px + pw / 2, py + 76, '', { fontSize: '11px', fontFamily: 'monospace', color: UIKit.CSS.textLo }).setOrigin(0.5).setDepth(D + 3));
        const paintChips = () => chips.forEach(([b, t, col]) => b.setColor(t === tag ? '#1a120c' : UIKit._hex(col)).setBackgroundColor(t === tag ? UIKit._hex(col) : '#1c1714'));
        const setTag = t => {
            tag = tag === t ? null : t;
            keys = tag ? ALL.filter(k => tagsOf(k).includes(tag)) : ALL;
            pages = Math.max(1, Math.ceil(keys.length / PER)); page = 0; pick = 0;
            countTxt.setText(tag ? `${keys.length} of ${ALL.length}` : `${ALL.length} kinds`);
            Sfx.play(this, 'click'); paintChips(); draw();
        };
        {
            const list = [[null, 'ALL', 0xf3e3b8], ...Object.entries(TG.DEFS).map(([t, d]) => [t, d.name, d.col])];
            let cx = px + 22;
            for (const [t, name, col] of list) {
                const b = keep(this.add.text(cx, py + 56, name, { fontSize: '11px', fontFamily: UIKit.FONT.title, fontStyle: 'bold', padding: { x: 7, y: 3 } }).setOrigin(0, 0.5).setDepth(D + 3).setInteractive({ useHandCursor: true }));
                b.on('pointerdown', () => t === null ? (tag && setTag(tag)) : setTag(t));
                b.on('pointerover', () => hint.setText(t ? `${name.toLowerCase()}: ${TG.DEFS[t].what}` : 'every enemy'));
                b.on('pointerout', () => hint.setText(''));
                chips.push([b, t, col]);
                cx += b.width + 6;
            }
            paintChips();
        }
        // a slime as it looks in a fight, standing at (x, feetY): body, face and hat (Creatures.js keeps them on the body),
        // breathing, now and then a little hop; with what else it carries (the Encased Slime's pebbles)
        const model = (key, x, feetY, sc) => {
            const out = [];
            const L = LevelManager.look(this, key);
            if (!this.textures.exists(L.tex)) return out;
            const spr = this.add.sprite(x, feetY, L.tex, 0).setOrigin(0.5, 1).setScale(sc).setDepth(D + 4).setScrollFactor(0);
            if (L.tint) spr.setTint(L.tint);
            if (this.anims.exists(L.anim)) spr.play(L.anim);
            const T = TYPES[key] || {};
            const face = CreatureFX.face(this, spr, { mood: CreatureFX.moodOf(key), hat: T.hat || null, eye: T.eye, look: () => null });
            out.push(spr);
            // the ones that change as they live, shown changing: the Gem's colours turning, the bud growing seed to flower,
            // the Hunter's ears filling with blood
            const cycle = { bud: ['bud0', 'bud1', 'bud2', 'bud3', 'bud'], hunter: ['hunter0', 'hunter1', 'hunter2', 'hunter3', 'hunter4'] }[key];
            const hue = key === 'gem' ? spr.preFX?.addColorMatrix?.() : null;
            if (cycle || hue) {
                let i = 0;
                const ev = this.time.addEvent({ delay: hue ? 40 : 700, loop: true, callback: () => {
                    if (!spr.active) return ev.remove();
                    if (hue) hue.hue((this.time.now * 0.09) % 360);
                    else if (face) CreatureFX.dress(face, cycle[i = (i + 1) % cycle.length]);
                } });
                spr.once('destroy', () => ev.remove());
            }
            this.tweens.add({ targets: spr, scaleX: sc * 1.05, scaleY: sc * 0.94, duration: 650 + Math.random() * 200, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });   // breathing
            const hop = () => { if (!spr.active) return; this.tweens.add({ targets: spr, y: feetY - 5 * sc, duration: 160, yoyo: true, ease: 'Quad.easeOut', onComplete: () => this.time.delayedCall(1400 + Math.random() * 1600, hop) }); };
            this.time.delayedCall(400 + Math.random() * 1200, hop);
            const u = sc / 1.2;   // the game draws at 1.2
            if (key === 'encased') {   // three pebbles held up round it (its shell is in its body: LevelManager.encBodyKey)
                const peb = [0, 1, 2].map(() => this.add.image(x, feetY, LevelManager.encRubbleKey(this)).setScale(0.55 * u).setDepth(D + 4.03).setScrollFactor(0));
                const t = { a: 0 };
                this.tweens.add({ targets: t, a: Math.PI * 2, duration: 3200, repeat: -1, onUpdate: () => peb.forEach((pb, k) => pb.active && pb.setPosition(x + Math.cos(t.a + k * 2.1) * 20 * u, feetY - 14 * u + Math.sin(t.a + k * 2.1) * 7 * u)) });
                out.push(...peb);
            }
            return out;
        };
        const close = () => { this.input.keyboard.off('keydown', onKey); objs.concat(view).forEach(o => { if (o?.active) { this.tweens.killTweensOf(o); o.destroy(); } }); this.time.delayedCall(0, () => { this._settingsOpen = false; }); };
        const gx = px + 22, gy = py + 90, cw = 100, ch = 100, GAP = 8, rx = gx + COLS * (cw + GAP) + 6, rw = px + pw - 22 - rx, rh = ROWS * (ch + GAP) - GAP;
        const draw = () => {
            view.forEach(o => { if (o?.active) { this.tweens.killTweensOf(o); o.destroy(); } }); view = [];
            const v = o => { view.push(o); o.setScrollFactor?.(0); return o; };
            keys.slice(page * PER, page * PER + PER).forEach((k, i) => {
                const idx = page * PER + i, on = idx === pick, x = gx + (i % COLS) * (cw + GAP), y = gy + Math.floor(i / COLS) * (ch + GAP), e = codex[k];
                const card = v(this.add.graphics().setDepth(D + 2));
                card.fillStyle(on ? 0x2e231a : 0x1c1714, 1).fillRoundedRect(x, y, cw, ch, 6);
                card.fillStyle(e.tint, on ? 0.18 : 0.07).fillRoundedRect(x + 3, y + 3, cw - 6, ch - 34, 4);   // a wash of its colour behind it
                card.fillStyle(0x000000, 0.35).fillEllipse(x + cw / 2, y + 62, 46, 9);                       // its shadow
                card.lineStyle(on ? 2 : 1, on ? 0xf3e3b8 : e.tint, on ? 1 : 0.4).strokeRoundedRect(x, y, cw, ch, 6);
                model(k, x + cw / 2, y + 63, 2.1).forEach(v);
                v(this.add.text(x + cw / 2, y + ch - 30, e.name, { fontSize: '11px', fontFamily: UIKit.FONT.title, fontStyle: 'bold', color: on ? '#f3e3b8' : '#cdbf9f', align: 'center', wordWrap: { width: cw - 8 }, lineSpacing: -2 }).setOrigin(0.5, 0).setDepth(D + 3));
                const z = v(this.add.zone(x + cw / 2, y + ch / 2, cw, ch).setInteractive({ useHandCursor: true }).setDepth(D + 5));
                z.on('pointerdown', () => { if (pick === idx) return; pick = idx; Sfx.play(this, 'hover'); draw(); });
            });
            // the chosen one on a little stage, with its card: what it does, on a loop (assets/enemy_clips/<key>.mp4, filmed in the
            // Training Ground), or, till that's loaded (or where there's none), itself, big
            const k = keys[pick], e = codex[k], clip = 'clip_' + k, has = this.cache.video.exists(clip);
            const st = v(this.add.graphics().setDepth(D + 2));
            st.fillStyle(0x100c0a, 1).fillRoundedRect(rx, gy, rw, rh, 8);
            st.fillStyle(e.tint, 0.1).fillRoundedRect(rx + 4, gy + 4, rw - 8, 236, 6);
            if (!has) {
                for (let fx = rx + 10; fx + 22 <= rx + rw - 10; fx += 24) { st.fillStyle(0x2a2420, 1).fillRect(fx, gy + 208, 22, 10); st.fillStyle(0x3a322c, 1).fillRect(fx, gy + 208, 22, 2); }   // flagstones
                st.fillStyle(0x000000, 0.45).fillEllipse(rx + rw / 2, gy + 210, 120, 18);
            }
            st.lineStyle(2, e.tint, 0.75).strokeRoundedRect(rx, gy, rw, rh, 8);
            if (has) {
                const vid = v(this.add.video(rx + rw / 2, gy + 120, clip).setDepth(D + 3));
                vid.setScale(Math.min((rw - 16) / 432, 228 / 256)); vid.play(true);   // (the clips are 432x256)
            } else {
                model(k, rx + rw / 2, gy + 210, 5).forEach(v);
                if (!(this._clipTried ||= new Set()).has(k)) {   // (one try each: a missing clip leaves it the model)
                    this._clipTried.add(k);
                    this.load.video(clip, `assets/enemy_clips/${k}.mp4`, true);
                    this.load.once('complete', () => { if (this._settingsOpen && keys[pick] === k) draw(); });
                    this.load.start();
                }
            }
            v(this.add.text(rx + rw / 2, gy + 250, e.name, { fontSize: '24px', fontFamily: UIKit.FONT.title, fontStyle: 'bold', color: '#f3e3b8' }).setOrigin(0.5, 0).setDepth(D + 3));
            v(this.add.text(rx + rw / 2, gy + 282, ` ${e.role.toUpperCase()} `, { fontSize: '11px', fontFamily: 'monospace', fontStyle: 'bold', color: '#0e0b09', backgroundColor: UIKit._hex(e.tint), padding: { x: 6, y: 2 } }).setOrigin(0.5, 0).setDepth(D + 3));
            const dt = v(this.add.text(rx + 20, gy + 314, e.desc, { fontSize: '13px', fontFamily: 'monospace', color: UIKit.CSS.textMid, lineSpacing: 6, wordWrap: { width: rw - 40 } }).setDepth(D + 3));
            for (let fs = 12; dt.height > rh - 326 && fs >= 9; fs--) dt.setFontSize(fs).setLineSpacing(fs > 10 ? 4 : 2);   // a long one shrinks to stay inside its card
            v(this.add.text(px + pw / 2, py + ph - 74, `page ${page + 1} of ${pages}   ·   ${pick + 1} / ${keys.length}   ·   arrows to browse`, { fontSize: '11px', fontFamily: 'monospace', color: UIKit.CSS.textLo }).setOrigin(0.5).setDepth(D + 3));
        };
        const go = d => { page = (page + d + pages) % pages; pick = Math.min(keys.length - 1, page * PER); Sfx.play(this, 'hover'); draw(); };
        kit(UIKit.button(this, { x: px + pw / 2 - 220, y: py + ph - 36, w: 170, h: 40, label: '◂  PAGE', accent: P.line, depth: D + 4, fontSize: '14px', fireOn: 'down', onClick: () => go(-1) }));
        kit(UIKit.button(this, { x: px + pw / 2, y: py + ph - 36, w: 170, h: 40, label: 'DONE', accent: P.accentGreen, depth: D + 4, fontSize: '14px', fireOn: 'down', onClick: close }));
        kit(UIKit.button(this, { x: px + pw / 2 + 220, y: py + ph - 36, w: 170, h: 40, label: 'PAGE  ▸', accent: P.line, depth: D + 4, fontSize: '14px', fireOn: 'down', onClick: () => go(1) }));
        const onKey = (ev) => {
            if (ev.key === 'Escape') return close();
            const d = { ArrowRight: 1, ArrowLeft: -1, ArrowDown: COLS, ArrowUp: -COLS }[ev.key];
            if (d) { pick = Math.max(0, Math.min(keys.length - 1, pick + d)); page = Math.floor(pick / PER); Sfx.play(this, 'hover'); draw(); }
        };
        this.input.keyboard.on('keydown', onKey);
        draw();
    }

    // ── STUCK? ───────────────────────────────────────────────────────────────
    // Two deaths in a row on a story level (Progress.lost): back in the lobby, a word about the Tower,
    // where glorps, dust and books come quicker, and the way there.
    _lossNudge() {
        let id = null;
        try { id = localStorage.getItem('loss_nudge'); } catch (e) {}
        if (!id || this._settingsOpen || !Progress.unlocked('tower')) return;
        try { localStorage.removeItem('loss_nudge'); } catch (e) {}
        this._settingsOpen = true;
        Sfx.play(this, 'click');
        const W = this.scale.width, H = this.scale.height, D = 200, P = UIKit.PALETTE, objs = [];
        const kit = k => { objs.push(...k.objs); return k; };
        const close = (then) => { objs.forEach(o => o?.destroy?.()); this.time.delayedCall(0, () => { this._settingsOpen = false; then?.(); }); };
        kit(UIKit.overlay(this, { alpha: 0.7, depth: D }));
        const pw = 520, ph = 250, px = W / 2 - pw / 2, py = H / 2 - ph / 2;
        kit(UIKit.panel(this, { x: px, y: py, w: pw, h: ph, accent: P.accentGold, depth: D + 1, title: 'STRUGGLING?', titleSize: '20px' }));
        objs.push(this.add.text(W / 2, py + 64, `${Progress.NAMES[id] || 'This level'} keeps beating you. Head to the Tower: every floor pays glorps and dust, books drop as you climb, and they all stay with you when you fall. Upgrade your weapons in the shop, then come back stronger.`,
            { fontSize: '14px', fontFamily: 'monospace', color: UIKit.CSS.textMid, align: 'center', lineSpacing: 5, wordWrap: { width: pw - 60 } }).setOrigin(0.5, 0).setDepth(D + 3).setScrollFactor(0));
        kit(UIKit.button(this, { x: W / 2 - 115, y: py + ph - 44, w: 200, h: 42, label: 'TO THE TOWER  ▸', accent: P.accentGold, depth: D + 4, fontSize: '15px', fireOn: 'down',
            onClick: () => close(() => this._towerGuide(() => TowerFloors.maxStart() > 1 ? this._openTowerStart() : this._climb(1))) }));
        kit(UIKit.button(this, { x: W / 2 + 115, y: py + ph - 44, w: 200, h: 42, label: 'NOT NOW', accent: P.line, depth: D + 4, fontSize: '15px', fireOn: 'down', onClick: () => close() }));
    }

    // ── THE TOWER'S GUIDE ────────────────────────────────────────────────────
    // Five pages, each a picture from the Tower (assets/tower_guide) and a few lines. Shown the
    // first time you go in (tower_guide_seen), and from 'how it works' on the start panel.
    static TOWER_GUIDE = [
        ['CLIMB', 'Every floor is an arena. Enemies come in three waves (on a boss floor, just the boss), and a ring on the floor shows where each one lands. Clear every wave to finish the floor.'],
        ['GO UP', 'Kills pay glorps as you go, and a cleared floor pays the rest, with some dust, and heals you a little. Step into the rift to climb. Every floor up is tougher than the last. Scraps from kills buy a boon at the shrine.'],
        ['PICK A BOON', 'Every third floor, and after every boss, pick one of three boons. They stack, and they last for this climb only.'],
        ['BOSSES', 'Every tenth floor is a boss. Beat it for a big payout, a relic you don\'t have yet, sealed books and a garden seed.'],
        ['FALLING', 'When you fall, the climb ends. You keep every glorp, book, seed and bit of dust you found; the boons and scraps are gone. Once your best is floor 5 or higher, you can start up to 3 floors below it, for a fee.'],
    ];
    _towerGuide(then, force = false) {
        this._guide({ id: 'tguide', dir: 'tower_guide', title: 'HOW THE TOWER WORKS', pages: LevelSelectScene.TOWER_GUIDE, seenKey: 'tower_guide_seen', then, force, end: 'TO THE TOWER  ▸' });
    }
    // THE GUIDE: the whole game on ten pages, each a picture from it (assets/guide) and a few lines.
    // From the scrawled ? at the map's corner.
    static GAME_GUIDE = [
        ['THE FOUR ELEMENTS', 'Each element has a gem that fills as you land hits with it (cosmic\'s fills from your other elements\' hits). Fire is single-target damage and leaves *Burn*. Ice builds *Chill* until the enemy becomes an *ice cube*. Lightning chains and forks between enemies and leaves them *Amped*. Cosmic weapons are mostly buffs you cast and then switch away from; its mark is *Hex*.'],
        ['DASHES', 'Every dash makes you untouchable for its first moment. Fire (top left): 4 tiles, hitting what you pass through, and the tiles behind you crack and erupt into *lava tiles* a moment later. Ice (top right): 6 tiles, three wide, adding *Chill* to everything in the strip, with a longer recovery. Lightning (bottom left): an instant 3-tile blink that sends a *daze* out in rings from where you land. Cosmic (bottom right): two hops toward your cursor, through enemies, leaving *cosmic fluid* behind.', 4],
        ['REACTIONS AND RESIDUE', 'A *reaction* is a hit on an enemy that carries another element\'s status: burning, chilled or cubed, amped, or hexed. It charges that element\'s gem three times as much as a normal hit. *Residue* is a hit on an enemy another element struck in the last 1.5 seconds but left no status on; it charges 1.75 times as much.'],
        ['RESISTANCE', 'A ring under an enemy in an element\'s colour means it *resists* that element, and those hits do 40%. A ring split into two colours resists two elements, and one split into three resists all three. Cosmic is never resisted. Grounding Spike turns the ring grey for 6 seconds, and while it\'s grey the enemy resists nothing.'],
        ['WHAT YOU DO TO THEM', '*Burn* stacks up to 5 and ticks every half second for flat damage plus a share of max HP; it holds for 4 seconds, then loses a stack each second. *Chill* fills a bar over about five ice hits. A full bar makes an *ice cube* for 3.5 seconds: it moves at about half speed, it\'s *Brittle* (20% of its max HP cut off, 6% on bosses), and then it shatters by itself. The cut health grows back afterwards, except what other elements dealt while it was a cube. *Amped* lasts 5 seconds and lets lightning chain and fork further from it. *Hex* stacks up to 3: +10%, +25% and +45% damage taken. *Dazed* and Stunned enemies can\'t move or attack.'],
        ['WHAT THEY DO TO YOU', 'The icons over your head, left to right, with their time running down under each: *Dripping* turns every tile you walk on into water for 8 seconds. *Bleed* hurts you for every tile you move while it lasts. *Poison* deals damage over time and cuts any healing by 60%; a new dose replaces the old one instead of stacking. *Rooted* holds you in place for a moment. *Chevrons* over you or an enemy show it moving faster (pointing up) or slower (pointing down) than usual.'],
        ['THE GROUND', 'Left to right. *Water* slows you slightly unless you hold cosmic, or ice, which makes you faster in it. *Fog* is water your fire dried; it holds for 15 seconds and nothing can turn it back to water until then. *Lava tiles* come from fire and give a *Burn* stack to an enemy standing on one every 0.8 seconds. *Poison pools* come from Rooters and Budding Slimes and inflict *Poison* while you stand in them. *Cosmic fluid* gives *Hex* to enemies standing in it every 2 seconds, and how long it lasts depends on what left it.'],
        ['WATER', '*Water* powers up the enemies that live in it. A Wave Rider in water winds up its charge faster, Ripplerunners speed up, a Tidal Guard\'s hit pins you if it\'s standing in water, and a *Drowner* that strikes while you\'re in water lands instantly. A *Tidecaller* makes every enemy near it attack faster: a little on dry floor, far faster standing in water. Other enemies are slowed by it. Storm Fists do 1.5 times damage to wet enemies, lightning runs through connected pools, and fire dries it into *fog*.'],
        ['THE CAST', 'Each enemy wears something that shows what it does, like horns on the Berserker or the puckered mouth on the Spitter. The first time you walk into a room with one, a card explains it (not for the Tower\'s waves). The book of enemies on the map lists all of them with their models and descriptions.'],
        ['ENEMY TYPES', 'The book of enemies sorts them into types, and one enemy can be several. Aggressors come at you directly. Controllers take space from range with shots, lanes and lit tiles. Buffers make nearby enemies stronger. Water enemies make water, live in it or use it. Multipliers turn into more enemies. Tough enemies have armour, a second life or a lot of health. Tricksters hide, steal or ambush.'],
        ['READING ATTACKS', 'A ring on the floor marks where something will land. Lit squares mark an area about to go off, with gaps that stay safe. A lit lane marks a line something is about to shoot down. A glass dome is a safe zone from the Gem, if you hold its element. A red zone around an enemy blocks ults inside it, and a violet one blocks them too and steals from your fullest gem every few seconds and throws a weak copy of that ult back at you.'],
        ['BOSSES', 'A boss has a health bar across the top of the screen, and each boss in reach gets its own bar. Each attack has a tell first: bolt volleys, stomps that ring outward, ripples, waves of minions. In the Tower every tenth floor is a boss, and the arena changes shape when it falls to half health.'],
        ['ULTS AND SIGNATURES', 'Each element\'s ult goes off when its gem is full, on its own key. There\'s a short shared cooldown after any ult but Ascend. Several weapons also have a signature ability on R that charges from hits: the Icicle Cannon\'s *Frost Shield*, the Magma Staff\'s *Magma Surge*, Ignition\'s *Blue Flame* (on a cooldown instead), and the Fractal Shard\'s gamble. The next four pages cover the ults.'],
        ['SCORCH  ·  FIRE', '8 seconds. Meteors rain across the room, each one dazing what it hits and adding a *Super Burn* stack. After the first volley your attack becomes Meteor Strike, which drops 4 or 5 heavy meteors on the spot you click. A fire aura around you burns one enemy a second, your dash goes further, your burn ticks heal you, you move about twice as fast, and you can\'t switch away from fire until it ends.'],
        ['BLIZZARD  ·  ICE', '20 seconds, and you can switch elements during it. It opens with a wave of Deep Freeze, then a freezing ring follows you: inside it a third of the *Chill* bar makes an *ice cube*, and cubes shatter after 1.2 seconds. Every 5 seconds an ice tornado forms and hunts enemies down. You take 1.5 times damage while it lasts, and you\'re frozen solid for 3 seconds at the end.'],
        ['FORK  ·  LIGHTNING', 'Time stops while you become a bolt that passes through every enemy in the room and back to you. Then the whole path ignites, doing more the more enemies it touched. For 12 seconds afterwards, part of any damage to an enemy forks to the enemies around it, you move twice as fast, and every step dazes and zaps nearby enemies.'],
        ['ASCEND  ·  COSMIC', '10 seconds, and you can switch elements during it: 25% more max HP, faster movement and your cosmic boon at full strength. Waves of *cosmic fluid* spread from you at the start and the end, you leave a trail of it, and every 3 seconds a wave rolls toward your crosshair. It ends with a *supernova* that grows with every *Hex* stack in range. At stage 2, holding the key past halfway gives you *Constellation* instead.'],
        ['GADGETS', 'You carry two gadgets, thrown with Q and F, each on its own cooldown. Smite Charge: lightning stuns everything near where it lands for 2 seconds. EMP Pulse: a heavy slow around you that wears off over 6 seconds. Displacer: picks up to 6 enemies and puts them where you click. Grounding Spike: removes resistance for 6 seconds. Mend Totem: heals you while you stand near it. Bulwark: a 3-tile wall for 4 seconds. Decoy Slime: nearby enemies chase it instead of you for 3 seconds. They\'re bought and slotted in the GADGETS tab of the shop.', 2],
        ['ULT UPGRADES', 'Each ult has stages that add to it, bought in the shop\'s ULTS tab with fragments and glorps. Fragments come from the first clear of each story level and from beating its boss, with one more fragment for each later boss kill. The tab opens once the tutorial is done and you\'ve cleared the first floor of the Tower.'],
        ['RELICS', 'Relics are kept for good and work in every level but Eng. Defense. Most trade a strength for a weakness, and they\'re sorted onto shelves by build in three tiers: Novice, Adept and Legend. Glurp sells a few each day, and every Tower boss drops one you don\'t have. You can wear one relic once you\'ve finished the tutorial and cleared the Tower\'s first floor, and more slots open at Tower floors 5, 15, 30 and 50.'],
        ['ENCHANTING', 'Sealed books drop in the Tower. At the Enchanter\'s Isle, unsealing a book costs 40 dust and gives a random enchant, rarity, level and quality. An Epic or better is guaranteed within 25 unseals and a Legendary or better within 80. BIND puts a book into one of a weapon\'s slots for glorps; better weapons have more slots, and tearing one back out costs twice that and leaves you a sealed book and some dust.', 2],
        ['REFORGE, COMBINE, RESEAL', 'REFORGE rerolls a book\'s quality for dust. Quality runs from 0 to 100 and scales its effect from 70% to 130%. COMBINE takes two or more copies of the same book at the same level and tries to raise its level; more quality going in gives better odds, and a miss loses the worst copy. RESEAL turns a book back into a sealed one for another unseal, or salvages it for dust.', 3],
        ['THE DUST GARDEN', 'Seeds drop in the Tower and are never used up: planting one puts a copy to work and harvesting gives it back. Some crops only grow by day or by night. A ripe crop gives dust and banks its blessing for your next Tower climb; different blessings stack, the same one doesn\'t, and the garden\'s tier caps how many you can bank. The garden shop sells the rake (more plots), the watering can (faster growth) and fertilizer (double the next harvest). The river and lake can be fished for dust and rare seeds.'],
    ];
    _gameGuide() {
        this._guide({ id: 'gguide', dir: 'guide', title: 'THE GUIDE', pages: LevelSelectScene.GAME_GUIDE, then: () => {}, force: true, end: 'GOT IT' });
    }
    // A guide: pages of [title, text], each with its picture (assets/<dir>/<n>.jpg, loaded the first time it's wanted).
    // Shown once (seenKey) unless forced; `then` runs when it closes.
    _guide({ id, dir, title, pages, seenKey = null, then, force = false, end = 'DONE' }) {
        let seen = false;
        try { seen = !!seenKey && localStorage.getItem(seenKey) === '1'; } catch (e) {}
        if (seen && !force) return then();
        if (this._settingsOpen) return;
        // a page has one picture (<n>.jpg), or `pages[i][2]` of them side by side (<n>a.jpg, <n>b.jpg, ...)
        const files = i => pages[i][2] ? [...'abcd'.slice(0, pages[i][2])].map(c => [`${id}_${i + 1}${c}`, `assets/${dir}/${i + 1}${c}.jpg`]) : [[`${id}_${i + 1}`, `assets/${dir}/${i + 1}.jpg`]];
        const all = pages.flatMap((_, i) => files(i));
        const need = all.filter(([k]) => !this.textures.exists(k));
        if (need.length) {
            need.forEach(([k, f]) => this.load.image(k, f));
            this.load.once('complete', () => this._guide({ id, dir, title, pages, seenKey, then, force: true, end }));
            this.load.start();
            return;
        }
        this._settingsOpen = true;
        Sfx.play(this, 'click');
        const W = this.scale.width, H = this.scale.height, D = 200, P = UIKit.PALETTE, objs = [];
        const keep = o => { objs.push(o); o.setScrollFactor?.(0); return o; };
        const kit = k => { objs.push(...k.objs); return k; };
        kit(UIKit.overlay(this, { alpha: 0.82, depth: D }));
        const pw = Math.min(780, W - 40), ph = Math.min(680, H - 30), px = W / 2 - pw / 2, py = H / 2 - ph / 2;
        kit(UIKit.panel(this, { x: px, y: py, w: pw, h: ph, accent: P.accentGold, depth: D + 1, title, titleSize: '20px' }));
        const iw = pw - 80, ih = Math.min(Math.round(iw * 9 / 16), ph - 300), iy = py + 56;
        keep(this.add.rectangle(W / 2, iy + ih / 2, iw + 6, ih + 6, 0x05060a).setStrokeStyle(2, P.accentGold, 0.6).setDepth(D + 2));
        const head = keep(this.add.text(W / 2, iy + ih + 14, '', { fontSize: '20px', fontFamily: UIKit.FONT.title, fontStyle: 'bold', color: '#f3e3b8' }).setOrigin(0.5, 0).setDepth(D + 3));
        let pageObjs = [];   // the page's pictures and its text (hover words in it)
        const dots = pages.map((_, i) => keep(this.add.circle(W / 2 + (i - (pages.length - 1) / 2) * 16, py + ph - 72, 4, P.accentGold).setDepth(D + 3)));
        let at = 0, nav = [];
        const close = () => { this.input.keyboard.off('keydown', onKey); this._hideTip(); objs.concat(nav, pageObjs).forEach(o => o?.destroy?.()); try { if (seenKey) localStorage.setItem(seenKey, '1'); } catch (e) {} this.time.delayedCall(0, () => { this._settingsOpen = false; then(); }); };
        const show = (i) => {
            at = Math.max(0, Math.min(pages.length - 1, i));
            pageObjs.forEach(o => o?.destroy?.()); pageObjs = []; this._hideTip();
            const pk = o => { pageObjs.push(o); o.setScrollFactor?.(0); return o; };
            const fs = files(at), n = fs.length, cols = n > 2 ? 2 : n, rows = Math.ceil(n / cols), cw = (iw - (cols - 1) * 6) / cols, chh = (ih - (rows - 1) * 6) / rows;
            fs.forEach(([k], j) => {
                const cx = W / 2 - iw / 2 + (j % cols) * (cw + 6) + cw / 2, cy = iy + Math.floor(j / cols) * (chh + 6) + chh / 2;
                const im = pk(this.add.image(cx, cy, k).setDepth(D + 3));
                im.setScale(Math.min(cw / im.width, chh / im.height));
            });
            head.setText(pages[at][0]);
            const room = py + ph - 86 - (iy + ih + 46);   // down to the page dots
            for (const [fs, ls] of [[13, 4], [12, 3], [11, 2]]) {   // smaller type for a long page, so it never runs into the dots
                const mark = pageObjs.length;
                const h = this._richText(pk, W / 2 - iw / 2 + 6, iy + ih + 46, pages[at][1], { fontSize: fs + 'px', fontFamily: 'monospace', color: UIKit.CSS.textMid, lineSpacing: ls, wordWrap: { width: iw - 12 }, kwColor: '#e8b4ff' }, D + 3);
                if (h <= room || fs === 11) break;
                pageObjs.splice(mark).forEach(o => o?.destroy?.());
            }
            dots.forEach((d, j) => d.setAlpha(j === at ? 1 : 0.25));
            nav.forEach(o => o?.destroy?.());
            const last = at === pages.length - 1;
            nav = [...(at > 0 ? UIKit.button(this, { x: W / 2 - 120, y: py + ph - 36, w: 200, h: 40, label: '◂  BACK', accent: P.line, depth: D + 4, fontSize: '14px', fireOn: 'down', onClick: () => show(at - 1) }).objs : []),
                   ...UIKit.button(this, { x: at > 0 ? W / 2 + 120 : W / 2, y: py + ph - 36, w: 200, h: 40, label: last ? end : 'NEXT  ▸', accent: last ? P.accentGold : P.accentGreen, depth: D + 4, fontSize: '14px', fireOn: 'down', onClick: () => last ? close() : show(at + 1) }).objs];
            Sfx.play(this, 'hover');
        };
        const onKey = (ev) => { if (ev.key === 'ArrowRight' || ev.key === 'Enter') at === pages.length - 1 ? close() : show(at + 1); else if (ev.key === 'ArrowLeft') show(at - 1); else if (ev.key === 'Escape') close(); };
        this.input.keyboard.on('keydown', onKey);
        show(0);
    }
    _openTowerStart() {
        if (this._settingsOpen) return;
        this._settingsOpen = true;
        Sfx.play(this, 'click');
        const W = this.scale.width, H = this.scale.height, D = 200, P = UIKit.PALETTE, objs = [];
        const keep = o => { objs.push(o); o.setScrollFactor?.(0); return o; };
        const kit = k => { objs.push(...k.objs); return k; };
        const close = () => { this.input.keyboard.off('keydown-ESC', close); objs.forEach(o => { if (o?.active) { this.tweens.killTweensOf(o); o.destroy(); } }); this.time.delayedCall(0, () => { this._settingsOpen = false; }); };
        this.input.keyboard.on('keydown-ESC', close);
        kit(UIKit.overlay(this, { alpha: 0.78, depth: D }));
        const pw = 460, ph = 330, px = W / 2 - pw / 2, py = H / 2 - ph / 2;
        kit(UIKit.panel(this, { x: px, y: py, w: pw, h: ph, accent: P.accentGold, depth: D + 1, title: 'THE TOWER', titleSize: '20px' }));
        const txt = (x, y, s, o = {}) => keep(this.add.text(x, y, s, Object.assign({ fontSize: '13px', fontFamily: 'monospace', color: UIKit.CSS.textMid }, o)).setDepth(D + 3));
        txt(px + pw - 20, py + 22, '✕', { fontSize: '18px', color: UIKit.CSS.textHi }).setOrigin(0.5).setInteractive({ useHandCursor: true }).on('pointerdown', close);
        txt(px + 20, py + ph - 22, 'how it works', { fontSize: '11px', color: UIKit.CSS.textLo }).setOrigin(0, 0.5).setInteractive({ useHandCursor: true }).on('pointerdown', () => { close(); this.time.delayedCall(0, () => this._towerGuide(() => this._openTowerStart(), true)); });
        const best = TowerFloors.best(), max = TowerFloors.maxStart(), purse = parseInt(localStorage.getItem('glorps') || '0', 10) || 0;
        txt(W / 2, py + 62, `Your best: floor ${best}`, { fontSize: '14px', color: UIKit.CSS.textHi }).setOrigin(0.5);
        txt(W / 2, py + 96, 'START ON FLOOR', { fontSize: '12px', fontStyle: 'bold' }).setOrigin(0.5);
        let floor = max;
        const big = txt(W / 2, py + 136, '', { fontSize: '40px', fontFamily: UIKit.FONT.title, fontStyle: 'bold', color: '#f3e3b8' }).setOrigin(0.5);
        const info = txt(W / 2, py + 180, '', { fontSize: '12px', align: 'center' }).setOrigin(0.5, 0);
        let go = null;
        const draw = () => {
            const fee = TowerFloors.fee(floor), owed = TowerFloors.owed(floor), ok = purse >= fee;
            big.setText(String(floor));
            info.setText(floor > 1 ? `fee ✦ ${fee}   ·   ${owed} catch-up boon${owed === 1 ? '' : 's'}\nyou have ✦ ${purse}` : 'from the bottom, free');
            info.setColor(ok ? UIKit.CSS.textMid : '#e07a6a');
            go?.forEach(o => o?.active && o.destroy());
            const b = UIKit.button(this, { x: W / 2, y: py + ph - 44, w: 240, h: 44, label: ok ? (floor > 1 ? `CLIMB  ·  ✦ ${fee}` : 'CLIMB') : 'NOT ENOUGH GLORPS', accent: ok ? P.accentGold : P.line, depth: D + 4, fontSize: '16px', fireOn: 'down',
                onClick: () => {
                    if (!ok) { Sfx.play(this, 'deny'); return; }
                    if (fee) try { localStorage.setItem('glorps', String(purse - fee)); } catch (e) {}
                    close(); this._climb(floor);
                } });
            go = b.objs; objs.push(...b.objs);
        };
        for (const [dx, label, d] of [[-150, '−5', -5], [-90, '−', -1], [90, '+', 1], [150, '+5', 5]]) {
            const b = txt(W / 2 + dx, py + 136, label, { fontSize: '20px', fontStyle: 'bold', color: UIKit.CSS.textHi, backgroundColor: '#1a2236', padding: { x: 8, y: 2 } }).setOrigin(0.5).setInteractive({ useHandCursor: true });
            b.on('pointerdown', () => { floor = Math.max(1, Math.min(max, floor + d)); Sfx.play(this, 'hover'); draw(); });
        }
        draw();
    }

    _openSettings() {
        if (this._settingsOpen) return;
        this._settingsOpen = true;
        Sfx.play(this, 'click');
        const W = this.scale.width, H = this.scale.height, D = 200, P = UIKit.PALETTE, objs = [];
        const keep = o => { objs.push(o); o.setScrollFactor?.(0); return o; };   // pinned: the map may be scrolled
        const kit = k => { objs.push(...k.objs); return k; };
        kit(UIKit.overlay(this, { alpha: 0.78, depth: D }));
        const pw = Math.min(980, W - 60), ph = Math.min(600, H - 60), px = W / 2 - pw / 2, py = H / 2 - ph / 2;
        kit(UIKit.panel(this, { x: px, y: py, w: pw, h: ph, accent: P.accentBlue, depth: D + 1, title: 'SETTINGS', titleSize: '20px' }));
        const txt = (x, y, s, o = {}) => keep(this.add.text(x, y, s, Object.assign({ fontSize: '13px', fontFamily: 'monospace', color: UIKit.CSS.textMid }, o)).setDepth(D + 3));
        const head = (x, y, s) => txt(x, y, s, { fontSize: '15px', fontFamily: UIKit.FONT.title, fontStyle: 'bold', color: UIKit.CSS.textHi });
        const close = () => {
            if (this._rebind) { this.input.keyboard.off('keydown', this._rebind); this._rebind = null; }
            this.input.keyboard.off('keydown-ESC', onEsc);
            objs.forEach(o => { if (o?.active) { this.tweens.killTweensOf(o); o.destroy(); } });
            this.time.delayedCall(0, () => { this._settingsOpen = false; });
        };
        const onEsc = () => { if (!this._rebind) close(); };
        this.input.keyboard.on('keydown-ESC', onEsc);

        // ── left: sound and gameplay
        const lx = px + 34, lw = Math.round(pw * 0.38);
        let y = py + 70;
        head(lx, y, 'SOUND'); y += 34;
        const slider = (label, get, set) => {
            const ry = y;
            txt(lx, ry, label, { fontStyle: 'bold' }).setOrigin(0, 0.5);
            const bx = lx + 90, bw = lw - 150;
            const pips = Array.from({ length: 10 }, (_, k) => keep(this.add.nineslice(bx + k * (bw / 10), ry - 7, 'map_kit', 'pip_off', Math.round((bw / 10 - 3) / 2), 7, 1, 1, 2, 2).setOrigin(0).setScale(2).setDepth(D + 3)));   // (map_kit pips)
            const pct = txt(bx + bw + 40, ry, '', { color: UIKit.CSS.textHi }).setOrigin(0, 0.5);
            const draw = () => {
                const v = get();
                pips.forEach((pp, k) => pp.setFrame(k < Math.round(v * 10) ? 'pip_on' : 'pip_off'));
                pct.setText(Math.round(v * 100) + '%');
            };
            draw();
            const zone = keep(this.add.zone(bx + bw / 2, ry, bw, 22).setInteractive({ useHandCursor: true }).setDepth(D + 4));
            zone.on('pointerdown', (p) => { set(Math.max(0, Math.min(1, Math.round((p.x - bx) / bw * 10) / 10))); draw(); });
            for (const [dx, g, d] of [[-16, '−', -0.1], [bw + 14, '+', 0.1]]) {
                const b = txt(bx + dx, ry, g, { fontSize: '18px', fontStyle: 'bold', color: UIKit.CSS.textHi }).setOrigin(0.5).setInteractive({ useHandCursor: true });
                b.on('pointerdown', () => { set(Math.round(Math.max(0, Math.min(1, get() + d)) * 10) / 10); draw(); });
            }
            y += 38;
        };
        slider('MUSIC', () => Music.volume(), v => Music.setVolume(v));
        slider('SOUND', () => Sfx.volume(), v => { Sfx.setVolume(v); Sfx.play(this, 'pickup'); });
        const choice = (label, opts, get, set) => {
            txt(lx, y, label, { fontStyle: 'bold' }).setOrigin(0, 0.5);
            const cy = y, bw = (lw - 90) / opts.length;
            const btns = opts.map(([name, v], k) => {
                const b = txt(lx + 90 + bw * (k + 0.5), cy, name, { fontSize: '12px', fontStyle: 'bold', backgroundColor: '#141a2a', padding: { x: 8, y: 4 } })
                    .setOrigin(0.5).setInteractive({ useHandCursor: true });
                b.on('pointerdown', () => { set(v); Sfx.play(this, 'click'); paint(); });
                return [b, v];
            });
            const paint = () => btns.forEach(([b, v]) => b.setColor(get() === v ? '#f6d58a' : UIKit.CSS.textLo).setBackgroundColor(get() === v ? '#2a2414' : '#141a2a'));
            paint();
            y += 38;
        };
        choice('MUTE', [['ON', true], ['OFF', false]], () => Sfx.muted(), v => Sfx.setMuted(v));
        y += 16;
        head(lx, y, 'GAME'); y += 34;
        choice('SHAKE', Settings.SHAKE, () => Settings.shake(), v => { Settings.setShake(v); if (v) this.cameras.main.shake(160, 0.006 * v); });
        choice('GRAPHICS', Settings.QUALITY, () => Settings.quality(), v => Settings.setQuality(v));
        choice('GLOW', Settings.GLOW, () => Settings.glow(), v => Settings.setGlow(v));
        choice('FPS', Settings.FPS, () => Settings.fps(), v => Settings.setFps(v));
        {   // fullscreen: the browser lets a page go fullscreen only from a press (pointerup), so its own two buttons
            txt(lx, y, 'FULLSCREEN', { fontStyle: 'bold' }).setOrigin(0, 0.5);
            const cy = y, bw = (lw - 90) / 2, btns = [['ON', true], ['OFF', false]].map(([name, v], k) => {
                const b = txt(lx + 90 + bw * (k + 0.5), cy, name, { fontSize: '12px', fontStyle: 'bold', backgroundColor: '#141a2a', padding: { x: 8, y: 4 } }).setOrigin(0.5).setInteractive({ useHandCursor: true });
                b.on('pointerup', () => { if (v !== this.scale.isFullscreen) { if (v) this.scale.startFullscreen(); else this.scale.stopFullscreen(); } Sfx.play(this, 'click'); });
                return [b, v];
            });
            const paint = () => btns.forEach(([b, v]) => b.active && b.setColor(this.scale.isFullscreen === v ? '#f6d58a' : UIKit.CSS.textLo).setBackgroundColor(this.scale.isFullscreen === v ? '#2a2414' : '#141a2a'));
            paint();
            for (const ev of ['enterfullscreen', 'leavefullscreen']) { this.scale.on(ev, paint); this.events.once('shutdown', () => this.scale.off(ev, paint)); }
            y += 38;
        }
        txt(lx, y + 4, 'Keybinds take effect when a level loads.', { fontSize: '11px', color: UIKit.CSS.textLo });
        // your runs, recorded (Telemetry.js)
        y += 44;
        head(lx, y, 'PLAY DATA'); y += 30;
        const nRuns = Telemetry.all().length;
        const pdTxt = txt(lx, y, `${nRuns} run${nRuns === 1 ? '' : 's'} recorded`, { fontSize: '12px' }).setOrigin(0, 0.5);
        for (const [i, label, fn] of [[0, 'EXPORT', () => Telemetry.exportFile()], [1, 'CLEAR', () => { Telemetry.clear(); pdTxt.setText('0 runs recorded'); }]]) {
            const b = txt(lx + 170 + i * 90, y, label, { fontSize: '12px', fontStyle: 'bold', backgroundColor: '#1a2236', padding: { x: 8, y: 4 }, color: UIKit.CSS.textHi })
                .setOrigin(0.5).setInteractive({ useHandCursor: true });
            b.on('pointerdown', () => { Sfx.play(this, 'click'); fn(); });
        }
        y += 40;
        if (Progress.devMode()) {   // only in dev mode (localStorage devMode): a player can't hand themselves the game
            const dv = txt(lx, y, 'DEV TOOLS  ›', { fontSize: '13px', fontStyle: 'bold', backgroundColor: '#2a1a2a', padding: { x: 10, y: 5 }, color: '#f0a8ff' }).setOrigin(0, 0.5).setInteractive({ useHandCursor: true });
            dv.on('pointerdown', () => { Sfx.play(this, 'click'); this._openDevTools(); });
        }

        // ── right: keybinds, two columns
        const rx = px + lw + 60, rw = pw - lw - 94, cw = rw / 2 - 10;
        head(rx, py + 70, 'KEYBINDS');
        const rows = [];
        const paintRows = () => rows.forEach(r => r.btn.setText(Settings.label(Settings.key(r.id))).setColor(UIKit.CSS.textHi).setBackgroundColor('#1a2236'));
        const per = Math.ceil(Settings.ACTIONS.length / 2), rh = Math.min(34, (ph - 112 - 84) / per);   // half each side (a 21st, Mute, had wrapped onto the first row of the second), spaced to fit above the buttons
        Settings.ACTIONS.forEach((a, i) => {
            const col = i < per ? 0 : 1, row = i % per, x = rx + col * (cw + 20), ry = py + 112 + row * rh;
            txt(x, ry, a.label, { fontSize: '12px' }).setOrigin(0, 0.5);
            const btn = txt(x + cw - 4, ry, '', { fontSize: '13px', fontStyle: 'bold', backgroundColor: '#1a2236', padding: { x: 10, y: 4 } })
                .setOrigin(1, 0.5).setInteractive({ useHandCursor: true });
            btn.on('pointerdown', () => {
                if (this._rebind) { this.input.keyboard.off('keydown', this._rebind); this._rebind = null; paintRows(); }
                btn.setText('press a key').setColor('#f6d58a').setBackgroundColor('#2a2414');
                Sfx.play(this, 'click');
                this._rebind = (ev) => {
                    this.input.keyboard.off('keydown', this._rebind); this._rebind = null;
                    const name = Settings.nameOf(ev);
                    if (name && name !== 'ESC' && !Settings.RESERVED.includes(name)) {
                        const swapped = Settings.set(a.id, name);
                        Sfx.play(this, swapped ? 'switch' : 'pickup');
                    }
                    paintRows();
                };
                this.time.delayedCall(0, () => this.input.keyboard.on('keydown', this._rebind));
            });
            rows.push({ id: a.id, btn });
        });
        paintRows();

        kit(UIKit.button(this, { x: rx + rw / 2 - 90, y: py + ph - 44, w: 170, h: 40, label: 'RESET KEYS', accent: P.accentOrange, depth: D + 4, fontSize: '14px', fireOn: 'down',
                                 onClick: () => { Settings.reset(); paintRows(); Sfx.play(this, 'switch'); } }));
        kit(UIKit.button(this, { x: rx + rw / 2 + 90, y: py + ph - 44, w: 170, h: 40, label: 'DONE', accent: P.accentGreen, depth: D + 4, fontSize: '14px', fireOn: 'down',
                                 onClick: close }));
    }

    // DEV TOOLS (Settings.js DevSave): give yourself things, or wipe one part of the save.
    // A wipe asks twice. Closing restarts the lobby so everything reads the new save.
    _openDevTools() {
        const W = this.scale.width, H = this.scale.height, D = 400, P = UIKit.PALETTE, objs = [];
        const keep = o => { objs.push(o); return o; };
        const kit = k => { objs.push(...k.objs); return k; };
        kit(UIKit.overlay(this, { alpha: 0.85, depth: D }));
        const pw = 760, ph = Math.min(790, H - 20), px = W / 2 - pw / 2, py = H / 2 - ph / 2;
        kit(UIKit.panel(this, { x: px, y: py, w: pw, h: ph, accent: P.accentPurple, depth: D + 1, title: 'DEV TOOLS', titleSize: '20px' }));
        const txt = (x, y, s, o = {}) => keep(this.add.text(x, y, s, Object.assign({ fontSize: '13px', fontFamily: 'monospace', color: UIKit.CSS.textMid }, o)).setDepth(D + 3));
        const status = txt(px + pw / 2, py + ph - 86, '', { fontSize: '13px', color: '#f6d58a' }).setOrigin(0.5);
        const purse = txt(px + pw / 2, py + 50, '', { fontSize: '12px', color: UIKit.CSS.textLo }).setOrigin(0.5);
        const n = k => parseInt(localStorage.getItem(k) || '0', 10) || 0;
        const show = () => purse.setText(`glorps ${n('glorps')}  ·  sealed books ${n('books')}  ·  dust ${n('dust')}  ·  fragments ${n('ultFragments')}  ·  Tower best ${n('tower_best')}  ·  dev mode ${DevSave.devMode() ? 'ON' : 'off'}`);
        show();
        const done = s => { status.setText(s); show(); Sfx.play(this, 'pickup'); };
        const btn = (x, y, w, label, accent, fn) => {
            const b = kit(UIKit.button(this, { x, y, w, h: 30, label, accent, depth: D + 4, fontSize: '11px', fireOn: 'down', onClick: () => fn(b) }));
            return b;
        };
        // give
        txt(px + 30, py + 78, 'GIVE', { fontSize: '14px', fontStyle: 'bold', color: UIKit.CSS.textHi });
        const GIVE = [
            ['+1,000 GLORPS', () => DevSave.glorps(1000)], ['+10,000 GLORPS', () => DevSave.glorps(10000)], ['+10 BOOKS', () => DevSave.books(10)], ['+1,000 DUST', () => DevSave.dust(1000)],
            ['+5 FRAGMENTS', () => DevSave.fragments(5)], ['ALL WEAPONS', () => DevSave.unlockWeapons()], ['ALL POWER +5', () => DevSave.power(5)], ['ALL POWER −5', () => DevSave.power(-5)],
            ['TOWER BEST +10', () => DevSave.towerBest(10)], ['TOWER BEST −10', () => DevSave.towerBest(-10)], ['ALL RELICS', () => DevSave.relics()], ['UNLOCK LEVELS', () => DevSave.unlockLevels()],
            ['GARDEN: EVERYTHING', () => DevSave.garden()], ['RIPEN ALL CROPS', () => DevSave.ripen()],
            ['GARDEN: WORMS', () => DevSave.worms()], ['GARDEN: DAY/NIGHT', () => DevSave.flipDay()], ['GARDEN +1 HOUR', () => DevSave.skip(1)], ['GARDEN +6 HOURS', () => DevSave.skip(6)], ['GARDEN +1 DAY', () => DevSave.skip(24)],
            [DevSave.devMode() ? 'DEV MODE: ON' : 'DEV MODE: OFF', b => { DevSave.setDevMode(!DevSave.devMode()); b.txt.setText(DevSave.devMode() ? 'DEV MODE: ON' : 'DEV MODE: OFF'); }],
        ];
        GIVE.forEach(([label, fn], i) => btn(px + 30 + 88 + (i % 4) * 176, py + 116 + Math.floor(i / 4) * 40, 166, label, P.accentGreen, b => { fn(b); done(`Done: ${b.txt.text.toLowerCase()}.`); }));
        // load a legal build for a story level (DevBuilds.js): pick the level and how much Tower was farmed, then LOAD
        // (again for the next sample)
        const by = py + 124 + Math.ceil(GIVE.length / 4) * 40, LV = ['gauntlet', 'voidrift', 'fracture', 'engdefense', 'cistern'], TI = ['story', 'some', 'farmed'];
        const pick = this._devBuild ||= { lv: 'cistern', ti: 'some', n: 0 };
        const again = () => { objs.forEach(o => o?.destroy?.()); this._openDevTools(); };
        txt(px + 30, by, 'LOAD A LEGAL BUILD  (a story level, how much Tower was farmed first)', { fontSize: '14px', fontStyle: 'bold', color: UIKit.CSS.textHi });
        LV.forEach((id, i) => btn(px + 118 + i * 131, by + 38, 124, Progress.NAMES[id].replace('The ', '').toUpperCase(), pick.lv === id ? P.accentGold : P.line, () => { pick.lv = id; pick.n = 0; again(); }));
        TI.forEach((t, i) => btn(px + 118 + i * 131, by + 76, 124, t.toUpperCase(), pick.ti === t ? P.accentGold : P.line, () => { pick.ti = t; pick.n = 0; again(); }));
        btn(px + 118 + 3.5 * 131, by + 76, 255, 'LOAD A BUILD', P.accentGreen, function load() {
            if (typeof DevBuilds === 'undefined') {   // a local dev file, fetched the first time it's wanted (it isn't part of the game)
                const tag = document.createElement('script'); tag.src = 'DevBuilds.js';
                tag.onload = () => load(); tag.onerror = () => done('No builds here.');
                return document.head.appendChild(tag);
            }
            const b = DevSave.loadBuild(pick.lv, pick.ti, pick.n++);
            if (!b) return done('No builds for that level.');
            const name = id => ShopScene.CATALOGUE.find(w => w.id === id)?.name || id;
            done(`Loaded #${pick.n} for ${Progress.NAMES[pick.lv]} (${pick.ti}): ${Object.values(b.held).map(name).join(', ')}${b.relics.length ? ' + ' + b.relics.length + ' relics' : ''}`);
        });
        // reset, one part at a time (asks twice)
        const ry = by + 116;
        txt(px + 30, ry, 'RESET  (click twice)', { fontSize: '14px', fontStyle: 'bold', color: UIKit.CSS.textHi });
        const parts = Object.entries(DevSave.PARTS);
        let armed = null;
        const ask = (key, label, fn) => b => {
            if (armed !== key) { armed = key; status.setText(`Click "${label}" again to wipe it.`); Sfx.play(this, 'deny'); return; }
            armed = null; const k = fn(); done(`Wiped ${label.toLowerCase()} (${k} saved value${k === 1 ? '' : 's'}).`);
        };
        parts.forEach(([key, P2], i) => btn(px + 30 + 88 + (i % 4) * 176, ry + 38 + Math.floor(i / 4) * 40, 166, P2.name.toUpperCase(), P.accentOrange, ask(key, P2.name, () => DevSave.reset(key))));
        btn(px + 30 + 88 + (parts.length % 4) * 176, ry + 38 + Math.floor(parts.length / 4) * 40, 166, 'EVERYTHING', P.accentRed, ask('*', 'Everything', () => DevSave.resetAll()));
        txt(px + pw / 2, py + ph - 112, 'Settings, keybinds and recorded runs are never touched.', { fontSize: '11px', color: UIKit.CSS.textLo }).setOrigin(0.5);
        kit(UIKit.button(this, { x: px + pw / 2, y: py + ph - 40, w: 200, h: 40, label: 'DONE', accent: P.accentGreen, depth: D + 4, fontSize: '14px', fireOn: 'down',
            onClick: () => { objs.forEach(o => o?.destroy?.()); this.scene.restart(); } }));
    }

    // ── ACHIEVEMENTS ─────────────────────────────────────────────────────────
    // Every feat in two columns: its tier's star (lit once earned), what to do, how far along,
    // and what it pays. An earned one shows the line it greeted you with instead.
    _openAchievements() {
        if (this._settingsOpen) return;
        this._settingsOpen = true;
        Sfx.play(this, 'click');
        const W = this.scale.width, H = this.scale.height, D = 200, P = UIKit.PALETTE, objs = [];
        const keep = o => { objs.push(o); o.setScrollFactor?.(0); return o; };
        const kit = k => { objs.push(...k.objs); return k; };
        const close = () => { objs.forEach(o => o?.destroy?.()); this._settingsOpen = false; this.input.keyboard.off('keydown-ESC', close); };
        kit(UIKit.overlay(this, { alpha: 0.78, depth: D }));
        const L = Achievements.LIST, st = Achievements.stats(), done = Achievements.done();
        const pw = Math.min(1040, W - 40), ph = Math.min(660, H - 40), px = W / 2 - pw / 2, py = H / 2 - ph / 2;
        kit(UIKit.panel(this, { x: px, y: py, w: pw, h: ph, accent: P.accentPurple, depth: D + 1, title: `ACHIEVEMENTS  ·  ${done.size} / ${L.length}`, titleSize: '20px' }));
        const txt = (x, y, s, o = {}) => keep(this.add.text(x, y, s, Object.assign({ fontSize: '12px', fontFamily: 'monospace', color: UIKit.CSS.textMid }, o)).setDepth(D + 3));
        const rows = Math.ceil(L.length / 2), top = py + 58, rh = Math.min(58, Math.floor((ph - 120) / rows)), cw = (pw - 60) / 2;
        L.forEach((a, i) => {
            const x = px + 20 + Math.floor(i / rows) * (cw + 20), y = top + (i % rows) * rh, got = done.has(a.id), col = Achievements.TIER_COL[a.tier];
            const n = Math.min(a.goal, st[a.stat] || 0);
            keep(this.add.rectangle(x, y, cw, rh - 6, got ? 0x1a1426 : P.bgRaised, 1).setOrigin(0).setDepth(D + 2).setStrokeStyle(1, col, got ? 0.8 : 0.2));
            keep(this.add.image(x + 20, y + (rh - 6) / 2, 'map_kit', 'star_' + a.tier).setScale(2).setDepth(D + 3).setAlpha(got ? 1 : 0.25));
            txt(x + 40, y + 5, a.name, { fontSize: '14px', fontFamily: UIKit.FONT.title, fontStyle: 'bold', color: got ? UIKit._hex(col) : UIKit.CSS.textHi });
            txt(x + 40, y + 24, got ? `"${a.desc}"` : a.how, { fontStyle: got ? 'italic' : 'normal', color: got ? '#e8dcc0' : UIKit.CSS.textMid });
            txt(x + cw - 10, y + 7, Achievements.rewardText(a).split('   ').join('  '), { fontSize: '10px', color: got ? UIKit.CSS.textLo : '#9be08a' }).setOrigin(1, 0);
            if (!got && a.goal > 1) {   // how far along
                const bw = 120, bx = x + cw - 10 - bw, by = y + rh - 18;
                keep(this.add.rectangle(bx, by, bw, 5, 0x000000, 0.6).setOrigin(0).setDepth(D + 3));
                keep(this.add.rectangle(bx, by, bw * n / a.goal, 5, col, 0.9).setOrigin(0).setDepth(D + 3));
                txt(bx - 6, by - 4, `${n.toLocaleString('en-US')} / ${a.goal.toLocaleString('en-US')}`, { fontSize: '10px', color: UIKit.CSS.textLo }).setOrigin(1, 0);
            }
        });
        kit(UIKit.button(this, { x: px + pw / 2, y: py + ph - 34, w: 200, h: 40, label: 'DONE', accent: P.accentGreen, depth: D + 4, fontSize: '14px', fireOn: 'down', onClick: close }));
        this.input.keyboard.on('keydown-ESC', close);
    }

    _drawPack(p) {
        const WEAPON_LABELS = {
            flame_fists: 'Flame Fists', flame_sword: 'Flame Sword', magma_staff: 'Magma Staff', ignition: 'Ignition', ember_scythe: 'Ember Scythe',
            ice_fists: 'Ice Fists', icicle_cannon: 'Icicle Cannon', fractal_shard: 'Fractal Shard', rimeguard: 'Rimeguard', boreal_trident: 'Boreal Trident',
            lightning_fists: 'Storm Fists', orb_emitter: 'Orb Emitter', ball_lightning: 'Ball Lightning', conductor: 'Circuit Breaker', thunder_glaive: 'Thunder Glaive',
            cosmic_fists: 'Void Fists', barrier_staff: 'Barrier Staff', astrolabe: 'Astrolabe',
            singularity_staff: 'Singularity', void_blade: 'Void Blade', pendulum: 'Pendulum',
        };
        const els = [
            { key: 'fire', label: 'FIRE', color: UIKit.PALETTE.accentOrange, def: 'flame_fists' },
            { key: 'ice', label: 'ICE', color: UIKit.PALETTE.accentBlue, def: 'ice_fists' },
            { key: 'lightning', label: 'LIGHTNING', color: UIKit.PALETTE.accentGold, def: 'lightning_fists',
              locked: localStorage.getItem('unlocked_lightning') !== 'true' },
            { key: 'cosmic', label: 'COSMIC', color: UIKit.PALETTE.accentPurple, def: 'cosmic_fists',
              locked: localStorage.getItem('unlocked_cosmic') !== 'true' },
        ];
        const D = 20;
        UIKit.panel(this, { x: p.x, y: p.y, w: p.w, h: p.h, accent: UIKit.PALETTE.accentGold, depth: D, fixed: false,
                            title: 'YOUR PACK', titleSize: '16px' });
        // the four weapons: a 2 x 2 of cards, each with the weapon's icon (MenuArt.iconSheet)
        const top = p.y + 46, gap = 8, rw = Math.round(p.w * 0.27), gridW = p.w - 28 - rw - 12;
        const cw = (gridW - gap) / 2, ch = Math.floor((p.y + p.h - 16 - top - gap) / 2);
        els.forEach((el, i) => {
            const id = localStorage.getItem('equip_' + el.key) || el.def;
            const x = p.x + 14 + (i % 2) * (cw + gap), y = top + Math.floor(i / 2) * (ch + gap);
            const bg = this.add.rectangle(x, y, cw, ch, UIKit.PALETTE.bgRaised, el.locked ? 0.45 : 1)
                .setOrigin(0).setDepth(D + 1).setStrokeStyle(1, el.color, el.locked ? 0.15 : 0.45);
            this.add.rectangle(x, y, 3, ch, el.color, el.locked ? 0.3 : 1).setOrigin(0).setDepth(D + 2);
            const ik = !el.locked && MenuArt.iconSheet(this, id);
            if (ik) ShopScene.enchAura(this, this.add.sprite(x + 26, y + ch / 2, ik, '0').setScale(1.5).setDepth(D + 2).play(ik), id);   // enchanted: it glows here too
            else UIKit.chains(this, x + cw / 2, y + ch / 2, cw - 10, ch - 8, { depth: D + 3, link: 6, lock: 14 });   // sealed: chained shut
            if (el.locked) {   // just its name, on a little plate over the chains
                this.add.text(x + 10, y + 7, el.label, { fontSize: '10px', fontFamily: 'monospace', fontStyle: 'bold', color: UIKit._hex(el.color), backgroundColor: '#14100c', padding: { x: 4, y: 2 } }).setDepth(D + 4).setAlpha(0.85);
                return;
            }
            this.add.text(x + 50, y + ch / 2 - 8, el.label, {
                fontSize: '10px', fontFamily: 'monospace', fontStyle: 'bold', color: UIKit._hex(el.color),
            }).setOrigin(0, 0.5).setDepth(D + 2);
            this.add.text(x + 50, y + ch / 2 + 8, WEAPON_LABELS[id] || id, {
                fontSize: '13px', fontFamily: UIKit.FONT.title, fontStyle: 'bold', color: el.locked ? UIKit.CSS.textLo : UIKit.CSS.textHi,
            }).setOrigin(0, 0.5).setDepth(D + 2);
            if (el.locked) return;
            bg.setInteractive({ useHandCursor: true });
            bg.on('pointerover', () => bg.setFillStyle(UIKit.PALETTE.bgHover));
            bg.on('pointerout', () => bg.setFillStyle(UIKit.PALETTE.bgRaised));
            bg.on('pointerdown', () => this.scene.start('Shop', { jumpTo: { element: el.key, weaponId: id } }));
        });
        // the right column: the purse on the title row, then settings and the shop, one size, lined up with the cards
        const rx = p.x + p.w - 14 - rw, rcx = rx + rw / 2;
        UIKit.pill(this, { x: rcx, y: p.y + 24, align: 0.5, icon: 'glorp', label: (parseInt(localStorage.getItem('glorps') || '0', 10) || 0).toLocaleString('en-US'),
                           accent: UIKit.PALETTE.accentGold, depth: D + 2, fontSize: '15px', fixed: false });
        const nDone = Achievements.done().size;
        UIKit.button(this, { x: rx - 12 - 50, y: p.y + 24, w: 100, h: 30, label: `★ ${nDone}/${Achievements.LIST.length}`, accent: UIKit.PALETTE.accentPurple,
                             fontSize: '13px', depth: D + 3, fixed: false, fireOn: 'down', onClick: () => this._openAchievements() });
        // the two gadgets you carry (Q, F), animated in their sockets; a click goes to the shop's gadget tab
        const fk = Object.create(FieldKit.prototype), lo = fk.gadgetLoadout(), keys = [Settings.label(Settings.key('gadget1')), Settings.label(Settings.key('gadget2'))];
        lo.forEach((id, i) => {
            const gx = rx - 12 - 100 - 26 - (1 - i) * 40, gy = p.y + 24;
            this.add.image(gx, gy, 'map_kit', 'sock').setScale(2).setDepth(D + 2);   // its socket (map_kit), ringed in the gadget's colour
            const def = id && fk._gadgetDefs()[id];
            if (def) { this.add.image(gx, gy, 'map_kit', 'sock_ring').setScale(2).setTint(def.color).setDepth(D + 2); const k = ShopScene.gadgetIcon(this, id); if (k) { const sp = this.add.sprite(gx, gy, k, '0').setScale(1.1).setDepth(D + 3); if (this.anims.exists(k)) sp.play(k); } }
            this.add.text(gx + 12, gy + 9, keys[i], { fontSize: '9px', fontFamily: 'monospace', fontStyle: 'bold', color: '#d2bf98', stroke: '#000', strokeThickness: 2 }).setOrigin(0.5).setDepth(D + 4);
            this.add.zone(gx, gy, 32, 32).setInteractive({ useHandCursor: true }).setDepth(D + 5).on('pointerdown', () => this.scene.start('Shop', { tab: 3 }));
        });
        UIKit.button(this, { x: rcx, y: top + ch / 2, w: rw, h: ch, label: 'SETTINGS', accent: UIKit.PALETTE.accentBlue,
                             fontSize: '14px', depth: D + 3, fixed: false, fireOn: 'down', onClick: () => this._openSettings() });
        UIKit.button(this, { x: rcx, y: top + ch + gap + ch / 2, w: rw, h: ch, label: 'SHOP', accent: UIKit.PALETTE.accentGreen,
                             fontSize: '16px', depth: D + 3, fixed: false, fireOn: 'down', onClick: () => this.scene.start('Shop') });
    }

    // ── Navigate to the full-screen tutorial picker ──────────────────────────
    openTutorialSelect() {
        this._tutLaunching = false;   // the scene object outlives a restart
        this.cameras.main.fadeOut(180, 0, 0, 0);
        this.time.delayedCall(180, () => {
            this.scene.restart({ showTutorialSelect: true });
        });
    }

    // ── The tutorial picker ───────────────────────────────────────────────────
    // Two doors in the wall: Fire, then Ice (Ice opens once Fire is done). Each is an iron-
    // framed slab with its weapon on a lit plinth (MenuArt.weaponShowcase), what it teaches,
    // and its way in. Everything on a card is drawn ABOVE the card: the old screen put the
    // card at depth 3 over text at depth 0, and both cards rendered empty.
    _buildTutorialSelectScreen(W, H) {
        UIKit.backdrop(this, { motes: 14 });
        const back = () => { this.cameras.main.fadeOut(180, 0, 0, 0); this.time.delayedCall(180, () => this.scene.restart({})); };
        UIKit.button(this, { x: 90, y: 40, w: 132, h: 40, label: '◂  MAP', accent: UIKit.PALETTE.accentGold,
                             fontSize: '15px', depth: 20, fixed: false, fireOn: 'down', onClick: back });
        this.input.keyboard.on('keydown-ESC', back);

        this.add.text(W / 2, 46, 'THE TRAINING HALLS', {
            fontSize: '34px', fontFamily: UIKit.FONT.title, fontStyle: 'bold', color: UIKit.CSS.textHi,
            stroke: '#000', strokeThickness: 6,
        }).setOrigin(0.5).setDepth(20);
        this.add.text(W / 2, 84, 'Glerp will show you the ropes. Fire first, then ice.', {
            fontSize: '14px', fontFamily: 'monospace', color: UIKit.CSS.textMid,
        }).setOrigin(0.5).setDepth(20);

        const fireDone = !!localStorage.getItem('fireTutorialComplete');
        const subs = [
            { stage: 0, el: 'fire', weapon: 'flame_fists', label: 'Fire', accent: UIKit.PALETTE.accentOrange,
              desc: 'Throw your first punches, stack burns, and learn to move through a fight.',
              tags: ['Attacking', 'Burn', 'Movement'] },
            { stage: 1, el: 'ice', weapon: 'ice_fists', label: 'Ice', accent: UIKit.PALETTE.accentBlue,
              desc: 'Freeze your foes, shatter them, and handle enemies that shrug off fire.',
              tags: ['Chill', 'Cubes', 'Switching'], locked: !fireDone },
        ];
        const cw = Math.min(360, (W - 140) / 2), ch = Math.min(470, H - 150), gap = 56;
        const x0 = W / 2 - cw - gap / 2, cy = 112 + (H - 112 - ch) / 2;
        subs.forEach((s, i) => {
            const x = x0 + i * (cw + gap), D = 10;
            const acc = s.locked ? UIKit.PALETTE.line : s.accent;
            UIKit.panel(this, { x, y: cy, w: cw, h: ch, accent: acc, depth: D, fixed: false });
            this.add.text(x + 24, cy + 22, `TUTORIAL ${s.stage + 1}`, {
                fontSize: '12px', fontFamily: 'monospace', fontStyle: 'bold', color: UIKit._hex(acc),
            }).setDepth(D + 2);
            // The weapon on its plinth, or a padlock while it's sealed.
            const sy = cy + ch * 0.3;
            if (s.locked) {
                const lk = this.add.graphics().setDepth(D + 2);
                lk.lineStyle(7, UIKit.PALETTE.ironHi, 1); lk.beginPath(); lk.arc(x + cw / 2, sy - 8, 18, Math.PI, 0); lk.strokePath();
                lk.fillStyle(UIKit.PALETTE.iron, 1); lk.fillRoundedRect(x + cw / 2 - 28, sy - 8, 56, 44, 6);
                lk.lineStyle(2, UIKit.PALETTE.ironHi, 1); lk.strokeRoundedRect(x + cw / 2 - 28, sy - 8, 56, 44, 6);
                lk.fillStyle(0x000000, 1); lk.fillCircle(x + cw / 2, sy + 10, 5); lk.fillRect(x + cw / 2 - 2, sy + 10, 4, 12);
            } else {
                const c = this.add.container(0, 0).setDepth(D + 2);
                c.add(MenuArt.weaponShowcase(this, s.weapon, s.el, x + cw / 2, sy, cw - 60, ch * 0.34, { accent: s.accent }).objs);
            }
            this.add.text(x + cw / 2, cy + ch * 0.55, s.label, {
                fontSize: '32px', fontFamily: UIKit.FONT.title, fontStyle: 'bold',
                color: s.locked ? UIKit.CSS.textLo : UIKit.CSS.textHi, stroke: '#000', strokeThickness: 5,
            }).setOrigin(0.5).setDepth(D + 2);
            this.add.text(x + cw / 2, cy + ch * 0.55 + 34, s.locked ? 'Finish the Fire tutorial to open this hall.' : s.desc, {
                fontSize: '14px', fontFamily: 'monospace', color: s.locked ? UIKit.CSS.textLo : UIKit.CSS.textMid,
                align: 'center', wordWrap: { width: cw - 56 }, lineSpacing: 5,
            }).setOrigin(0.5, 0).setDepth(D + 2);
            if (!s.locked) {
                // What it teaches, as small brass tags.
                const ty = cy + ch - 92;
                const widths = s.tags.map(t => t.length * 7.5 + 18);
                let tx = x + cw / 2 - (widths.reduce((a, b) => a + b, 0) + (s.tags.length - 1) * 8) / 2;
                s.tags.forEach((t, k) => {
                    this.add.rectangle(tx + widths[k] / 2, ty, widths[k], 22, UIKit.PALETTE.bgRaised).setStrokeStyle(1, s.accent, 0.5).setDepth(D + 2);
                    this.add.text(tx + widths[k] / 2, ty, t, { fontSize: '12px', fontFamily: 'monospace', color: UIKit._hex(s.accent) }).setOrigin(0.5).setDepth(D + 3);
                    tx += widths[k] + 8;
                });
            }
            UIKit.button(this, { x: x + cw / 2, y: cy + ch - 40, w: cw - 48, h: 46,
                                 label: s.locked ? 'SEALED' : 'BEGIN  ▸', accent: acc, fontSize: '18px', depth: D + 3,
                                 fixed: false, fireOn: 'down', onClick: s.locked ? () => Sfx.play(this, 'hurt') : () => this.launchTutorialStage(s.stage) });
        });

        this.cameras.main.fadeIn(220, 0, 0, 0);
    }

    launchTutorialStage(stageIndex) {
        if (this._tutLaunching) return;
        this._tutLaunching = true; this.input.enabled = false;   // nothing else answers on the way out
        this.cameras.main.fadeOut(180, 0, 0, 0);
        this.time.delayedCall(180, () => {
            this.scene.start('Game', { levelIndex: 0, tutorialStage: stageIndex });
        });
    }

    // `index` is the GameScene levelIndex. The map's page is a different number (page 1
    // launches levelIndex 2), so the themed intro is chosen by page via _introIndexFor
    // rather than by levelIndex — otherwise The Gauntlet would play The Void Rift's animation.
    launchLevel(index) {
        Transitions.enterLevel(this, this._introIndexFor(index),
            () => this.scene.start('Game', { levelIndex: index }), this._enterFrom);
    }

    // Map a GameScene levelIndex back to its page, which is what Transitions keys its LEVELS
    // table on. Pages 1-3 map to levelIndex 2-4; everything else is already aligned.
    _introIndexFor(levelIndex) {
        const map = { 2: 1, 3: 2, 4: 3 };
        const page = map[levelIndex] !== undefined ? map[levelIndex] : levelIndex;
        return Math.max(0, Math.min(Transitions.LEVELS.length - 1, page));
    }

    // After the tutorial: Glerp points you at the shop and your first weapon.
    showShopPrompt(glorps) {
        const W = this.scale.width, H = this.scale.height, D = 101;
        UIKit.overlay(this, { alpha: 0.74, depth: 100 });
        UIKit.panel(this, { x: W / 2 - 260, y: H / 2 - 150, w: 520, h: 300, accent: UIKit.PALETTE.accentGold,
                            depth: D, fixed: false, title: 'GLERP', titleSize: '18px' });
        this.add.text(W / 2, H / 2 - 30,
            `Welcome back, adventurer!\nYou collected ${glorps} glorps in the tutorial.\n\nHead to the SHOP and buy your first weapon:\nthe Flame Sword costs 100 glorps!`, {
            fontSize: '17px', fontFamily: 'monospace', color: UIKit.CSS.textHi,
            stroke: '#000', strokeThickness: 2, align: 'center', wordWrap: { width: 470 }, lineSpacing: 4,
        }).setOrigin(0.5).setDepth(D + 1);
        UIKit.button(this, { x: W / 2, y: H / 2 + 100, w: 220, h: 46, label: 'GO TO SHOP', accent: UIKit.PALETTE.accentGold,
                             fontSize: '18px', depth: D + 2, fixed: false, fireOn: 'down', onClick: () => this.scene.start('Shop') });
    }
}
