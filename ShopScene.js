// ═══════════════════════════════════════════════════════════════════════════
// ShopScene.js - Glurp's stall
//
// A market stall built into the dungeon wall. A striped awning in the element's colour, its
// four element banners hanging from the beam; a shelf of that element's weapons behind; on
// the counter, the selected weapon turning slowly on a turntable under a spotlight; Glurp
// behind the counter on the left, talking; on the right a parchment price tag with what the
// weapon is, how hard it hits, and the stamp that buys or equips it.
//
//   ← →  weapons on the shelf        ↑ ↓  elements        Enter / Space  buy or equip
//
// Three tabs: WEAPONS (the stall), UPGRADES (ult stages) and GADGETS (permanent unlocks).
// ═══════════════════════════════════════════════════════════════════════════

class ShopScene extends Phaser.Scene {
    constructor() { super({ key: 'Shop' }); }

    preload() {
        if (!this.textures.exists('slime_green')) {
            this.load.spritesheet('slime_green', 'assets/Slime_Green_32x32.png', {
                frameWidth: 32, frameHeight: 32
            });
        }
    }

    create(data) {
        this.anims.resumeAll();   // the game's pause freezes every animation game-wide; never carry that into a menu
        const W = this.scale.width, H = this.scale.height;
        Music.play(this, 'shop');
        this._siphonA = null;   // the scene object outlives a visit
        this.glorps = parseInt(localStorage.getItem('glorps') || '0');
        this.fragments = parseInt(localStorage.getItem('ultFragments') || '0');
        this.uw = JSON.parse(localStorage.getItem('unlockedWeapons') || '[]');
        this.equipped = {
            fire:      localStorage.getItem('equip_fire')      || 'flame_fists',
            ice:       localStorage.getItem('equip_ice')       || 'ice_fists',
            lightning: localStorage.getItem('equip_lightning') || 'lightning_fists',
            cosmic:    localStorage.getItem('equip_cosmic')    || 'cosmic_fists',
        };
        if (!this.anims.exists('green_idle')) {
            this.anims.create({
                key: 'green_idle',
                frames: [{ key: 'slime_green', frame: 0 }, { key: 'slime_green', frame: 18 }],
                frameRate: 2, repeat: -1
            });
        }
        MenuArt.basics(this);

        const catalogue = ShopScene.CATALOGUE.map(w => ({ ...w, unlocked: !!w.defaultWeapon || this.uw.includes(w.id) }));
        const ELEMENTS = ['fire', 'ice', 'lightning', 'cosmic'];
        const EL = {
            fire:      { name: 'FIRE',      accent: UIKit.PALETTE.accentOrange, glyph: '🔥' },
            ice:       { name: 'ICE',       accent: UIKit.PALETTE.accentBlue,   glyph: '❄' },
            lightning: { name: 'LIGHTNING', accent: UIKit.PALETTE.accentGold,   glyph: '⚡' },
            cosmic:    { name: 'COSMIC',    accent: UIKit.PALETTE.accentPurple, glyph: '✦' },
        };
        const weaponsOf = el => catalogue.filter(w => w.element === el);

        // Where you were: restored across visits and across the restart buy()/equip() do.
        // Arriving from a loadout slot (data.jumpTo) opens on that weapon instead.
        this._shopEl = Math.max(0, ELEMENTS.indexOf(localStorage.getItem('_shopEl')));
        this._shopWi = Math.max(0, parseInt(localStorage.getItem('_shopWi') || '0', 10) || 0);
        if (data?.jumpTo) {
            const ei = ELEMENTS.indexOf(data.jumpTo.element);
            if (ei >= 0) {
                this._shopEl = ei;
                this._shopWi = Math.max(0, weaponsOf(data.jumpTo.element).findIndex(w => w.id === data.jumpTo.weaponId));
                localStorage.setItem('_shopEl', data.jumpTo.element);
                localStorage.setItem('_shopWi', String(this._shopWi));
            }
        }

        UIKit.backdrop(this, { motes: 16 });

        // ── LAYOUT ────────────────────────────────────────────────────────
        const TAG_W = Math.min(330, Math.round(W * 0.26));
        const S = {                                  // the stall
            x0: Math.max(250, Math.round(W * 0.22)), x1: W - TAG_W - 40,
            top: 112, beam: 166,
        };
        S.cx = (S.x0 + S.x1) / 2;
        const CT = H - 128;                          // the counter's top edge
        const SHELF_Y = Math.round(S.beam + (CT - S.beam) * 0.36);
        const TT = { x: S.cx, y: CT + 6 };           // the turntable, on the counter
        const TAG = { x: W - TAG_W - 20, y: S.top + 8, w: TAG_W, h: CT - S.top - 2 };
        const UI = Math.max(1, Math.min(1.5, W / 1280, H / 720));   // a big window gets bigger wares (they stayed 1280x720-sized and lost in the stall)
        this._layout = { S, CT, TAG, TT, SHELF_Y, UI };

        // ── HEADER ────────────────────────────────────────────────────────
        // A signboard on chains, the way out, and the purse.
        const sign = this.add.graphics().setDepth(10);
        const sw = 340, sx = W / 2 - sw / 2;
        sign.lineStyle(2, UIKit.PALETTE.ironHi, 1);
        sign.lineBetween(sx + 30, 0, sx + 30, 12); sign.lineBetween(sx + sw - 30, 0, sx + sw - 30, 12);
        this._plank(sign, sx, 10, sw, 48, 0x5a3a20);
        this.add.text(W / 2, 34, "GLURP'S WARES", {
            fontSize: '28px', fontFamily: UIKit.FONT.title, fontStyle: 'bold', color: '#f6d58a',
            stroke: '#2a1608', strokeThickness: 6,
        }).setOrigin(0.5).setDepth(11);
        UIKit.button(this, { x: 76, y: 34, w: 120, h: 38, label: '◂  MAP', accent: UIKit.PALETTE.accentGold,
                             fontSize: '15px', depth: 11, fireOn: 'down', onClick: () => this.scene.start('LevelSelect') });
        this.input.keyboard.on('keydown-ESC', () => this.scene.start('LevelSelect'));
        this._glorpPill = UIKit.pill(this, { x: W - 18, y: 26, align: 1, icon: 'glorp', label: this.glorps.toLocaleString('en-US') + ' Glorps',
                                              accent: UIKit.PALETTE.accentGold, depth: 11, fontSize: '16px' });
        this._fragmentPill = UIKit.pill(this, { x: W - 18, y: 62, align: 1, icon: 'fragment', label: this.fragments.toLocaleString('en-US') + ' Fragments',
                                                accent: UIKit.PALETTE.accentBlue, depth: 11, fontSize: '14px' });

        // ── TABS ──────────────────────────────────────────────────────────
        // Three small planks under the signboard; the open one hangs lower and lit.
        const TABS = ['WEAPONS', 'STATS', 'ULTS', 'GADGETS', 'RELICS'];
        const tabW = 118, tabY = 84;
        this._tabObjs = TABS.map((label, i) => {
            const x = W / 2 + (i - (TABS.length - 1) / 2) * (tabW + 10);
            // each sign hangs from its top edge, so it can drop and swing as one piece
            const c = this.add.container(x, tabY - 15).setDepth(10);
            const g = this.add.graphics();
            const t = this.add.text(0, 15, label, { fontSize: '13px', fontFamily: UIKit.FONT.title, fontStyle: 'bold', color: UIKit.CSS.textMid }).setOrigin(0.5);
            c.add([g, t]);
            const o = { x, c, g, t, on: null };
            const hit = this.add.zone(x, tabY, tabW, 30).setInteractive({ useHandCursor: true }).setDepth(12);
            hit.on('pointerdown', () => { Sfx.play(this, 'click'); this.switchShopTab(i); });
            hit.on('pointerover', () => {
                Sfx.play(this, 'hover');
                if (o.on) return;
                this.tweens.killTweensOf(c);
                this.tweens.add({ targets: c, y: tabY - 17, angle: 0, duration: 140, ease: 'Quad.easeOut' });
                t.setColor('#e8d6ae');
            });
            hit.on('pointerout', () => {
                if (o.on) return;
                this.tweens.killTweensOf(c);
                this.tweens.add({ targets: c, y: tabY - 15, duration: 180, ease: 'Quad.easeOut' });
                t.setColor(UIKit.CSS.textMid);
            });
            return o;
        });
        // The open tab hangs a few px lower, lit, and swings to rest when it's picked; the
        // others ease back up. Only a tab that changed state moves.
        const styleTabs = () => this._tabObjs.forEach((o, i) => {
            const on = i === this._shopTab;
            o.g.clear();
            this._plank(o.g, -tabW / 2, 0, tabW, 30, on ? 0x6a4626 : 0x3e2a18);
            if (on) { o.g.fillStyle(UIKit.PALETTE.accentGold, 1); o.g.fillRect(-tabW / 2 + 8, 29, tabW - 16, 2); }
            o.t.setColor(on ? '#f6d58a' : UIKit.CSS.textMid);
            if (o.on === on) return;
            const first = o.on === null;
            o.on = on;
            this.tweens.killTweensOf(o.c);
            if (first) { o.c.setY(tabY - 15 + (on ? 4 : 0)); return; }
            if (on) {
                o.c.setAngle(0);
                this.tweens.add({ targets: o.c, y: tabY - 11, duration: 260, ease: 'Back.easeOut' });
                this.tweens.addCounter({ from: 1, to: 0, duration: 700, ease: 'Linear',
                    onUpdate: tw => { const k = tw.getValue(); o.c.setAngle(Math.sin((1 - k) * Math.PI * 3) * 3 * k); } });
            } else {
                this.tweens.add({ targets: o.c, y: tabY - 15, angle: 0, duration: 200, ease: 'Quad.easeOut' });
            }
        });

        // ── THE STALL ─────────────────────────────────────────────────────
        // Back wall (dark boards), posts, the shelf, the counter. Static.
        const stall = this.add.graphics().setDepth(1);
        stall.fillStyle(0x000000, 0.45); stall.fillRect(S.x0 + 6, S.beam, S.x1 - S.x0, CT - S.beam + 10);
        this.add.image(S.x0, S.beam, ShopScene.stallWall(this, S.x1 - S.x0, CT - S.beam)).setOrigin(0).setScale(2).setDepth(0.95);   // under the shelf, posts and brackets (the graphics at depth 1)
        // the shelf: a plank on two iron brackets
        // the main shelf, its own graphics so a tab can take it down (the relic case brings its own)
        const shelf = this._mainShelf = this.add.graphics().setDepth(1);
        this._plank(shelf, S.x0 + 24, SHELF_Y, S.x1 - S.x0 - 48, 14, 0x6a4626);
        for (const bx of [S.x0 + 60, S.x1 - 60]) this._bracket(shelf, bx, SHELF_Y + 14);
        // posts either side
        for (const px of [S.x0 - 14, S.x1 - 4]) this._plank(stall, px, S.top, 18, CT - S.top, 0x4a3018, true);
        // two lanterns on the posts, flickering
        for (const lx of [S.x0 + 14, S.x1 - 26]) {
            const ly = S.beam + 70, lk = ShopScene.icon(this, 'shop_lantern', 16, { i: '#3a3a48', I: '#6a6a7a', y: '#ffd060', Y: '#fff2b0', o: '#ff9a30' }, (m, f) => {
                m.rect(7, 0, 2, 2, 'i'); m.rect(5, 2, 6, 2, 'I'); m.rect(4, 4, 8, 9, 'i'); m.rect(5, 5, 6, 7, f % 2 ? 'o' : 'y'); m.rect(6, 6, 4, 5, f % 3 ? 'y' : 'Y'); m.rect(7, 7, 2, 3, 'Y');
                m.rect(4, 13, 8, 2, 'I'); m.line(4, 4, 4, 12, 'I');
            }, 4);
            const glow = this.add.image(lx + 8, ly + 18, 'mn_glow').setTint(0xffb050).setBlendMode(Phaser.BlendModes.ADD).setDisplaySize(170, 170).setAlpha(0.35).setDepth(1.5);
            this.tweens.add({ targets: glow, alpha: 0.22, duration: 140, yoyo: true, repeat: -1, repeatDelay: 300, ease: 'Stepped' });
            this.add.sprite(lx + 8, ly + 18, lk, '0').setScale(2.5).setDepth(2).play(lk);
            stall.lineStyle(2, 0x3a3a48, 1); stall.lineBetween(lx + 8, S.beam, lx + 8, ly);
        }
        // cobwebs in the top corners of the case
        for (const [cx, dir] of [[S.x0 + 4, 1], [S.x1 - 8, -1]]) {
            stall.lineStyle(1, 0xc8c0b0, 0.35);
            for (let k = 0; k < 4; k++) { const a = (k / 3) * Math.PI / 2; stall.lineBetween(cx, S.beam + 2, cx + dir * Math.cos(a) * 46, S.beam + 2 + Math.sin(a) * 46); }
            for (const r of [14, 26, 38]) { stall.beginPath(); for (let k = 0; k <= 6; k++) { const a = k / 6 * Math.PI / 2; const px = cx + dir * Math.cos(a) * r, py = S.beam + 2 + Math.sin(a) * r; k ? stall.lineTo(px, py) : stall.moveTo(px, py); } stall.strokePath(); }
        }
        // the counter, in front of everything, across the whole floor
        const counter = this.add.graphics().setDepth(6);
        counter.fillStyle(0x000000, 0.5); counter.fillRect(0, CT - 4, W, 8);
        this._plank(counter, -4, CT, W + 8, 18, 0x7a5230);
        for (let y = CT + 18, k = 0; y < H; y += 26, k++) this._plank(counter, -4, y, W + 8, 26, k % 2 ? 0x4e321c : 0x563820);
        for (let x = 40; x < W; x += 180) { counter.fillStyle(UIKit.PALETTE.iron, 1); counter.fillRect(x, CT + 18, 6, H - CT - 18); }
        this._hint = this.add.text(S.cx, H - 18, '', {
            fontSize: '12px', fontFamily: 'monospace', color: '#c8a878',
        }).setOrigin(0.5, 1).setDepth(7).setAlpha(0.8);

        // Glurp, behind the counter on the left, and what he's saying above him.
        const gx = Math.max(110, S.x0 / 2);
        const glurp = this.add.sprite(gx, CT + 8, 'slime_green', 0).setOrigin(0.5, 1).setScale(6).setDepth(5);
        glurp.play('green_idle');
        if (typeof CreatureFX !== 'undefined') CreatureFX.face(this, glurp, { mood: 'friend', look: 'pointer' });
        this.tweens.add({ targets: glurp, scaleY: 5.6, scaleX: 6.3, duration: 900, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
        this.add.text(gx, CT + 40, 'GLURP · weapons dealer', {
            fontSize: '11px', fontFamily: 'monospace', fontStyle: 'bold', color: '#e8c890',
        }).setOrigin(0.5, 0).setDepth(7);
        const bw = Math.min(230, S.x0 - 24), by = CT - 220;
        const bub = this.add.graphics().setDepth(8);
        bub.fillStyle(0x000000, 0.4); bub.fillRoundedRect(gx - bw / 2 + 3, by + 4, bw, 92, 10);
        bub.fillStyle(0xe8d6ae, 1); bub.fillRoundedRect(gx - bw / 2, by, bw, 92, 10);
        bub.fillTriangle(gx - 10, by + 91, gx + 10, by + 91, gx, by + 110);
        bub.lineStyle(2, 0x6a4a26, 1); bub.strokeRoundedRect(gx - bw / 2, by, bw, 92, 10);
        this.glurpDialogue = this.add.text(gx, by + 46, '', {
            fontSize: '14px', fontFamily: 'monospace', fontStyle: 'bold', color: '#3b2716', align: 'center',
            wordWrap: { width: bw - 20 }, lineSpacing: 2,
        }).setOrigin(0.5).setDepth(9);

        // ── WEAPONS TAB ───────────────────────────────────────────────────
        // Everything the stall shows for the selected element and weapon, rebuilt when either
        // changes. weaponObjs: what the WEAPONS tab hides when another tab opens.
        let weaponObjs = [], awningObjs = [];
        const track = (arr, o) => { arr.push(o); return o; };

        // The awning in the element's colour, and the four banners hanging from its beam.
        const renderAwning = () => {
            awningObjs.forEach(o => o?.active && (this.tweens.killTweensOf(o), o.destroy()));
            awningObjs = [];
            const el = ELEMENTS[this._shopEl], acc = EL[el].accent;
            // the awning in the element's colour, a banner per element (the chosen one hangs longer)
            awningObjs = this._awning(acc, ELEMENTS.map((e, i) => ({ on: i === this._shopEl, icon: ShopScene.elementIcon(this, e), iconScale: i === this._shopEl ? 2.2 : 1.7, col: EL[e].accent, onClick: () => setElement(i) })));
        };

        // The shelf, the turntable and the price tag for the current weapon.
        const renderWeapon = this._renderWeapon = (fromDir = 0) => {
            weaponObjs.forEach(o => o?.active && (this.tweens.killTweensOf(o), o.destroy()));
            weaponObjs = [];
            const el = ELEMENTS[this._shopEl], acc = EL[el].accent, list = weaponsOf(el);
            this._shopWi = ((this._shopWi % list.length) + list.length) % list.length;
            const w = list[this._shopWi];
            const owned = w.unlocked, equipped = this.equipped[el] === w.id, canBuy = !owned && this.glorps >= w.cost;

            // Shelf: every weapon of the element standing on the plank; locked ones in shadow
            // with a price tag; the selected one marked from below.
            const span = S.x1 - S.x0 - 120;
            list.forEach((it, k) => {
                const x = S.x0 + 60 + span * (list.length === 1 ? 0.5 : k / (list.length - 1));
                const key = MenuArt.iconSheet(this, it.id);
                const on = k === this._shopWi;
                if (key) {
                    const ic = track(weaponObjs, this.add.sprite(x, SHELF_Y + 2, key, '0').setOrigin(0.5, 1).setScale((on ? 2.6 : 2.2) * this._layout.UI).setDepth(3));
                    if (!it.unlocked) ic.setTint(0x3a3028);
                    if (on) ic.play(key);
                    if (it.unlocked) this._enchAura(ic, it.id).forEach(o => track(weaponObjs, o));   // enchanted: it glows on the shelf
                }
                if (!it.unlocked) {
                    const pt = track(weaponObjs, this.add.text(x, SHELF_Y + 20, '✦' + it.cost, {
                        fontSize: '11px', fontFamily: 'monospace', fontStyle: 'bold', color: '#3b2716', backgroundColor: '#e8d6ae', padding: { x: 4, y: 1 },
                    }).setOrigin(0.5, 0).setDepth(3).setAngle(-4));
                    pt.setAlpha(on ? 1 : 0.75);
                } else if (this.equipped[el] === it.id) {
                    track(weaponObjs, this.add.text(x, SHELF_Y + 20, '★', { fontSize: '14px', color: '#7fd06a' }).setOrigin(0.5, 0).setDepth(3));
                }
                if (on) {
                    const mk = track(weaponObjs, this.add.graphics().setDepth(3));
                    mk.fillStyle(acc, 1); mk.fillTriangle(x - 7, SHELF_Y - 70, x + 7, SHELF_Y - 70, x, SHELF_Y - 60);
                    this.tweens.add({ targets: mk, y: 4, duration: 500, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
                }
                const hit = track(weaponObjs, this.add.zone(x, SHELF_Y - 26, 64, 64).setInteractive({ useHandCursor: true }).setDepth(12));
                hit.on('pointerdown', () => { if (k !== this._shopWi) goTo(k); });
            });

            // The weapon on the turntable, under the spotlight (_turntable).
            const ttObjs = this._turntable(acc, MenuArt.iconSheet(this, w.id), { anim: true, dim: !owned, fromDir, scale: 5.5 });
            ttObjs.forEach(o => weaponObjs.push(o));
            const ttIcon = ttObjs.find(o => o.type === 'Sprite' && o.texture?.key === MenuArt.iconSheet(this, w.id));
            if (owned && ttIcon) this._enchAura(ttIcon, w.id).forEach(o => weaponObjs.push(o));   // and on the turntable

            // The price tag, hanging from the awning on a string.
            this._drawTag(TAG, w, el, acc, { owned, equipped, canBuy, list, idx: this._shopWi, glyph: EL[el].glyph, elName: EL[el].name },
                          () => activate()).forEach(o => weaponObjs.push(o));

            this.setGlurpDialogue(equipped ? `"The ${w.name}! Your current pick. Good taste."`
                : owned ? `"You own the ${w.name}. Want it back on?"`
                : canBuy ? `"The ${w.name}! Only ${w.cost} glorps. Bargain!"`
                : `"The ${w.name}... ${w.cost - this.glorps} glorps short, friend."`);
            const vis = (this._shopTab ?? 0) === 0;
            weaponObjs.forEach(o => o.setVisible?.(vis));
        };

        // ── NAVIGATION ────────────────────────────────────────────────────
        const onWeapons = () => (this._shopTab ?? 0) === 0;
        const goTo = (k, dir) => {
            const list = weaponsOf(ELEMENTS[this._shopEl]);
            const next = ((k % list.length) + list.length) % list.length;
            if (next === this._shopWi && dir === undefined) return;
            const d = dir ?? Math.sign(next - this._shopWi);
            this._shopWi = next;
            localStorage.setItem('_shopWi', String(next));
            Sfx.play(this, 'hover');
            renderWeapon(d);
        };
        const goW = (d) => { if (onWeapons()) goTo(this._shopWi + d, d); };
        const setElement = (i) => {
            if (!onWeapons() || i === this._shopEl) return;
            this._shopEl = (i + ELEMENTS.length) % ELEMENTS.length;
            this._shopWi = 0;
            localStorage.setItem('_shopEl', ELEMENTS[this._shopEl]);
            localStorage.setItem('_shopWi', '0');
            Sfx.play(this, 'switch');
            renderAwning(); renderWeapon(0);
        };
        const stepEl = (d) => setElement((this._shopEl + d + ELEMENTS.length) % ELEMENTS.length);
        // Buy, equip, or say why not: one path for the stamp, Enter and Space.
        const activate = () => {
            const el = ELEMENTS[this._shopEl], w = weaponsOf(el)[this._shopWi];
            if (!w || this.equipped[el] === w.id) return;
            if (w.unlocked) { Sfx.play(this, 'click'); this.equip(w, el); return; }
            if (this.glorps >= w.cost) { this.buy(w, null, 0, el); return; }
            Sfx.play(this, 'hurt');
            this.setGlurpDialogue(`"Not enough! You need ${w.cost - this.glorps} more."`);
        };

        const onTab = (t, fn) => (...a) => { if ((this._shopTab ?? 0) === t) fn(...a); };
        for (const [k, d] of [['LEFT', -1], ['A', -1], ['RIGHT', 1], ['D', 1]]) this.input.keyboard.on('keydown-' + k, () => goW(d));
        for (const [k, d] of [['UP', -1], ['W', -1], ['DOWN', 1], ['S', 1]]) this.input.keyboard.on('keydown-' + k, onTab(0, () => stepEl(d)));
        for (const k of ['ENTER', 'SPACE']) this.input.keyboard.on('keydown-' + k, onTab(0, activate));
        // the ult shelves: ← → along a shelf, ↑ ↓ between them, Enter upgrades
        for (const [k, d] of [['LEFT', -1], ['A', -1], ['RIGHT', 1], ['D', 1]]) this.input.keyboard.on('keydown-' + k, onTab(2, () => this._ultNav(d, 0)));
        for (const [k, d] of [['UP', -1], ['W', -1], ['DOWN', 1], ['S', 1]]) this.input.keyboard.on('keydown-' + k, onTab(2, () => this._ultNav(0, d)));
        for (const k of ['ENTER', 'SPACE']) this.input.keyboard.on('keydown-' + k, onTab(2, () => this._ultActivate()));
        // the gadget shelf: ← → along it, Q / F pick the slot, Enter unlocks or slots it
        for (const [k, d] of [['LEFT', -1], ['A', -1], ['RIGHT', 1], ['D', 1]]) this.input.keyboard.on('keydown-' + k, onTab(3, () => this._gadgetNav(d)));
        this.input.keyboard.on('keydown-Q', onTab(3, () => this._gadgetPickSlot(0)));
        this.input.keyboard.on('keydown-F', onTab(3, () => this._gadgetPickSlot(1)));
        for (const k of ['ENTER', 'SPACE']) this.input.keyboard.on('keydown-' + k, onTab(3, () => this._gadgetActivate()));
        // the relic case: ← → along a layer, ↑ ↓ between tiers, Q / E between shelves, Enter buys or wears it
        for (const [k, d] of [['LEFT', -1], ['A', -1], ['RIGHT', 1], ['D', 1]]) this.input.keyboard.on('keydown-' + k, onTab(4, () => this._relicNav(d)));
        for (const [k, d] of [['UP', -1], ['W', -1], ['DOWN', 1], ['S', 1]]) this.input.keyboard.on('keydown-' + k, onTab(4, () => this._relicNav(0, d)));
        for (const [k, d] of [['Q', -1], ['E', 1]]) this.input.keyboard.on('keydown-' + k, onTab(4, () => this._relicNav(0, 0, d)));
        for (const k of ['ENTER', 'SPACE']) this.input.keyboard.on('keydown-' + k, onTab(4, () => this._relicActivate()));

        // Purchases update the stall in place. They used to restart the scene, and the
        // restart's fade-in read as the whole screen blinking on every buy and equip.
        this._refreshStall = () => renderWeapon(0);
        const HINTS = ['← →  weapons     ↑ ↓  element     Enter  buy / equip', 'hover anything for the details',
                       '↑ ↓  element     ← →  stage     Enter  upgrade', '← →  gadgets     Q / F  pick a slot     Enter  unlock / slot',
                       '← →  relics     ↑ ↓  tiers     Q E  shelves     Enter  buy / wear'];

        // ── TAB SWITCHING ─────────────────────────────────────────────────
        this.switchShopTab = (i) => {
            this._hideTip?.();
            this._shopTab = i;
            styleTabs();
            this._mainShelf?.setVisible(i !== 4);   // the relic case has its own shelves
            weaponObjs.forEach(o => o.setVisible?.(i === 0));
            awningObjs.forEach(o => o.setVisible?.(i === 0));
            this._hint.setText(HINTS[i]);
            if (i === 1) {
                this._showStatsTab();
                this.setGlurpDialogue('"Training! Hit harder, last longer, shrug it off."');
            } else this._hideStatsTab();
            if (i === 2) {
                this._showUltTab();
                this.setGlurpDialogue('"Ult stages! Fragments and glorps, and your ults grow teeth."');
            } else this._hideUltTab();
            if (i === 3) {
                this._showGadgetTab();
                this.setGlurpDialogue('"Pick two to carry. Q throws one, F the other, then they recharge."');
            } else this._hideGadgetTab();
            if (i === 4) {
                this._showRelicTab();
                this.setGlurpDialogue('"Relics! Every one gives and takes. A few in stock each day, the rest are up the Tower."');
            } else this._hideRelicTab();
            if (i === 0) renderWeapon(0);
        };

        this._shopTab = 0;
        this._hint.setText(HINTS[0]);
        renderAwning();
        renderWeapon(0);
        styleTabs();
        this.cameras.main.fadeIn(200, 0, 0, 0);
    }

    // A wooden plank into graphics g: the board, its grain, a lit top edge, a dark bottom.
    // An element's icon: 16px pixel art, 4 frames (a flame licking up, a frost crystal glinting,
    // a bolt crackling, a star turning), for the banners and the tag in place of emoji.
    static elementIcon(scene, el) {
        const P = {
            fire:      { a: '#c8381a', b: '#ff8a2a', y: '#ffd860', w: '#fff6d0' },
            ice:       { a: '#3a8ad8', b: '#9ae0ff', y: '#d8f6ff', w: '#ffffff' },
            lightning: { a: '#c88a10', b: '#ffd34a', y: '#fff6b0', w: '#ffffff' },
            cosmic:    { a: '#6a3ab8', b: '#b48cf0', y: '#e8d8ff', w: '#ffffff' },
        }[el];
        if (!P) return null;
        return ShopScene.icon(scene, 'el_icon_' + el, 16, { ...P, g: P.y }, (m, f) => {
            if (el === 'fire') {
                const s = [0, 1, 0, -1][f];
                m.poly([[8 + s, 1], [12, 6], [13, 10], [11, 14], [5, 14], [3, 10], [4, 6], [6, 8]], 'a');
                m.poly([[8 - s, 4], [11, 9], [10, 13], [6, 13], [5, 10]], 'b');
                m.poly([[8, 8], [9.5, 11], [8, 13], [6.5, 11]], 'y'); m.set(8, 11, 'w');
                if (f % 2) m.set(12 - s, 3, 'g');
            } else if (el === 'ice') {
                for (let k = 0; k < 3; k++) { const a = k * Math.PI / 3; m.line(8 - Math.cos(a) * 6.5, 8 - Math.sin(a) * 6.5, 8 + Math.cos(a) * 6.5, 8 + Math.sin(a) * 6.5, 'a'); }
                for (let k = 0; k < 6; k++) { const a = k * Math.PI / 3, x = 8 + Math.cos(a) * 4, y = 8 + Math.sin(a) * 4; m.set(x + Math.cos(a + 1.2) * 1.5, y + Math.sin(a + 1.2) * 1.5, 'b'); m.set(x + Math.cos(a - 1.2) * 1.5, y + Math.sin(a - 1.2) * 1.5, 'b'); m.set(8 + Math.cos(a) * 6.5, 8 + Math.sin(a) * 6.5, 'y'); }
                m.disc(8, 8, 1.6, 'b'); m.set(8, 8, 'w');
                const gl = [[3, 3], [13, 4], [12, 13], [4, 12]][f]; m.set(gl[0], gl[1], 'g');
            } else if (el === 'lightning') {
                m.poly([[10, 1], [4, 9], [8, 9], [6, 15], [12, 6], [8, 6], [10, 1]], 'b');
                m.line(9, 2, 5, 8, 'y'); m.set(7, 13, 'w');
                if (f % 2 === 0) { m.set(2, 4, 'g'); m.set(13, 11, 'g'); } else { m.set(13, 2, 'g'); m.set(3, 12, 'g'); }
            } else {
                m.poly([[8, 1], [9.5, 6.5], [15, 8], [9.5, 9.5], [8, 15], [6.5, 9.5], [1, 8], [6.5, 6.5]], 'b');
                m.poly([[8, 4], [9, 7], [12, 8], [9, 9], [8, 12], [7, 9], [4, 8], [7, 7]], 'y'); m.set(8, 8, 'w');
                const a = f * Math.PI / 2; m.set(8 + Math.cos(a) * 6, 8 + Math.sin(a) * 6, 'a'); m.set(8 - Math.cos(a) * 6, 8 - Math.sin(a) * 6, 'g');
            }
        }, 4);
    }

    // An enchanted weapon's look: a glowing outline of the weapon itself in its best book's
    // colour (a copy of the sprite, tinted, a touch larger, behind it), pulsing harder the more
    // enchants it holds, with sparks circling it from two up; corrupted, a dark flickering one.
    // `follow`: the sprite. Returns the objects (for the caller to track), or [] if it has none.
    // Static, so every screen that shows a weapon wears it the same way (the map's pack, the
    // Isle, the tutorial cards; the slime in a fight has its own, CreatureFX._gearAura). A sprite
    // in a container: put the halo in before it, and the rest after (same local coordinates).
    static enchAura(scene, follow, weaponId) {
        const on = typeof Enchants !== 'undefined' ? Enchants.on(weaponId) : [];
        if (!on.length || !follow?.texture) return [];
        const corrupt = Enchants.corrupted(weaponId), n = on.length;
        const top = Math.max(...on.map(b => Enchants.def(b.id).r)), col = corrupt ? 0x7aff5a : top ? Enchants.RARITY[top].col : 0xb48aff;   // Common's grey read as a plain border: enchant violet
        const grow = 1 + Math.max(0.14, 7 / Math.max(1, follow.displayWidth));   // at least a few pixels of rim, so a small icon's aura still shows
        const back = scene.textures.exists('mn_glow') ? scene.add.image(follow.x, follow.y, 'mn_glow').setTint(corrupt ? 0x7aff5a : col).setBlendMode(Phaser.BlendModes.ADD)
            .setDisplaySize(follow.displayWidth * 1.7, follow.displayHeight * 1.7).setOrigin(0.5, follow.originY > 0.6 ? 0.8 : 0.5).setAlpha(0.35).setDepth(follow.depth - 0.02) : null;
        const halo = scene.add.sprite(follow.x, follow.y, follow.texture.key, follow.frame.name).setOrigin(follow.originX, follow.originY)
            .setScale(follow.scaleX * grow, follow.scaleY * grow).setTintFill(corrupt ? 0x10001a : col).setDepth(follow.depth - 0.01).setAlpha(0.5);
        if (!corrupt) halo.setBlendMode(Phaser.BlendModes.ADD);
        if (follow.anims?.isPlaying) halo.play(follow.texture.key);
        const objs = back ? [back, halo] : [halo];
        if (back) scene.tweens.add({ targets: back, alpha: 0.15, duration: 1100, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
        scene.tweens.add({ targets: halo, alpha: corrupt ? 0.85 : 0.25 + 0.15 * n, duration: Math.max(380, 900 - n * 160), yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
        const o = (n >= 2 || corrupt) ? scene.add.graphics().setDepth(follow.depth + 0.01).setBlendMode(Phaser.BlendModes.ADD) : null, t0 = scene.time.now;
        if (o) objs.push(o);
        const ev = scene.time.addEvent({ delay: 30, loop: true, callback: () => {
            if (!halo.active || !follow.active) { ev.remove(); return; }
            halo.setPosition(follow.x, follow.y).setScale(follow.scaleX * grow, follow.scaleY * grow); back?.setPosition(follow.x, follow.y);   // it follows the sprite's bob and spin
            if (!o?.active) return;
            o.clear();
            const t = (scene.time.now - t0) * 0.003, r = follow.displayHeight * 0.45, cy = follow.y - (follow.originY > 0.6 ? follow.displayHeight / 2 : 0);
            for (let k = 0; k < n + 1; k++) { const a = t + k / (n + 1) * Math.PI * 2; o.fillStyle(corrupt && k % 2 ? 0xff3aa0 : col, 0.9); o.fillRect(follow.x + Math.cos(a) * r - 2, cy + Math.sin(a) * r * 0.5 - 2, 4, 4); }
        } });
        return objs;
    }
    _enchAura(follow, weaponId) { return ShopScene.enchAura(this, follow, weaponId); }

    // ── THE STALL'S ART (painted once, at half size, drawn 2x like the map) ──────
    // The back wall: upright boards, each its own shade, with grain, knots, nail heads and dark
    // gaps between; darker toward the top under the awning, and toward the sides.
    static stallWall(scene, w, h) {
        const W = Math.ceil(w / 2), H = Math.ceil(h / 2);
        return MenuArt.tex(scene, `shop_wall2_${W}x${H}`, W, H, P => {
            const R = MenuArt.rng(5), BW = 10;
            const boards = [];
            for (let b = 0; b * BW < W; b++) boards.push({ base: MenuArt.mix(0x2c1d12, 0x3a2717, R()), grain: [2 + Math.floor(R() * 3), 6 + Math.floor(R() * 2)], knot: R() < 0.35 ? [b * BW + 3 + Math.floor(R() * 4), Math.floor(R() * H)] : null });
            for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
                const b = Math.floor(x / BW), bx = x - b * BW, B = boards[b];
                let c = MenuArt.mix(B.base, 0x120a06, 0.35 * (1 - y / H) * (1 - y / H));    // shade from the awning, smooth
                if (B.grain.includes(bx) && (y + b * 7) % 23 > 3) c = MenuArt.mix(c, 0x120a06, 0.22);   // a couple of long grain lines a board
                if (B.knot && Math.hypot((x - B.knot[0]) * 1.4, (y - B.knot[1]) * 0.6) < 1.5) c = MenuArt.mix(c, 0x120a06, 0.5);
                if (bx === 0) c = 0x0c0705; else if (bx === 1) c = MenuArt.mix(c, 0x000000, 0.25); else if (bx === BW - 1) c = MenuArt.mix(c, 0xffffff, 0.06);
                if ((y === 5 || y === H - 6) && (bx === 3 || bx === 7)) c = 0x5a5a68;   // nail heads
                const side = Math.max(0, 1 - Math.min(x, W - x) / (W * 0.1));
                if (side > 0) c = MenuArt.mix(c, 0x050302, side * 0.45);
                P.put(x, y, c);
            }
        });
    }
    // The awning: striped canvas in folds (each stripe lit on one side, shadowed on the other),
    // a scalloped hem with a stitched band, and a gold tassel where the scallops meet.
    static awningTex(scene, w, h, acc) {
        const W = Math.ceil(w / 2), H = Math.ceil(h / 2), N = 10, sw = W / N, r = sw / 2;
        return MenuArt.tex(scene, `shop_awning_${W}x${H}_${acc.toString(16)}`, W, H + Math.ceil(r) + 7, P => {
            const colA = MenuArt.mix(acc, 0x1b1612, 0.25), colB = 0xe8d6ae, n = MenuArt.noise(23);
            for (let y = 0; y < H + r; y++) for (let x = 0; x < W; x++) {
                const k = Math.floor(x / sw), fx = (x - k * sw) / sw, cx = k * sw + r;
                if (y >= H && Math.hypot(x + 0.5 - cx, y - H) > r) continue;   // the scallop
                let c = k % 2 ? colB : colA;
                const fold = Math.cos(fx * Math.PI);           // lit on the left of each stripe, dark on the right
                c = MenuArt.mix(c, fold > 0 ? 0xffffff : 0x000000, Math.abs(fold) * (fold > 0 ? 0.12 : 0.3));
                if (MenuArt.noise(24)(x * 0.4, y * 1.2) > 0.78) c = MenuArt.mix(c, 0x000000, 0.12);   // weave
                if (y < 3) c = MenuArt.mix(c, 0x000000, 0.35 - y * 0.1);
                const dEdge = y >= H ? r - Math.hypot(x + 0.5 - cx, y - H) : H + r;
                if (y >= H - 4 || dEdge < 3.2) {                 // the hem band, stitched
                    const band = y >= H ? dEdge < 3.2 : y >= H - 4;
                    if (band) { c = MenuArt.mix(c, 0x000000, 0.18); if ((x + y) % 3 === 0 && (dEdge > 1.2 && dEdge < 2.2 || y === H - 2)) c = 0xf0dca0; }
                }
                if (dEdge < 1) c = MenuArt.mix(c, 0x000000, 0.45);
                P.put(x, y, c);
            }
            for (let k = 1; k < N; k++) {                        // tassels between the scallops
                const tx = Math.round(k * sw), ty = Math.round(H + 1);
                P.put(tx, ty, 0x8a6a20); P.put(tx - 1, ty + 1, 0xf0c050); P.put(tx, ty + 1, 0xffe08a); P.put(tx + 1, ty + 1, 0xf0c050);
                for (let j = 2; j < 6; j++) { P.put(tx - 1, ty + j, j % 2 ? 0xd8a838 : 0xb08020); P.put(tx, ty + j, 0xf0c050); P.put(tx + 1, ty + j, j % 2 ? 0xb08020 : 0xd8a838); }
            }
        });
    }
    // A hanging banner: cloth in folds, a swallowtail, gold trim when it's the chosen one, fringe.
    static bannerTex(scene, w, h, col, on) {
        const W = Math.ceil(w / 2), H = Math.ceil(h / 2);
        return MenuArt.tex(scene, `shop_banner_${W}x${H}_${col.toString(16)}_${on ? 1 : 0}`, W, H + 3, P => {
            const base = on ? MenuArt.mix(col, 0x1b1612, 0.2) : MenuArt.mix(col, 0x1b1612, 0.6);
            for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
                const notch = H - 7 + Math.abs(x - W / 2) / (W / 2) * 7;
                if (y > notch) continue;
                const fold = Math.sin(x / W * Math.PI * 3);
                let c = MenuArt.mix(base, fold > 0 ? 0xffffff : 0x000000, Math.abs(fold) * (fold > 0 ? 0.1 : 0.25));
                if (x === 0 || x === W - 1 || y > notch - 1) c = MenuArt.mix(base, 0x000000, 0.5);
                if (on && (x === 2 || x === W - 3 || (y > notch - 3 && y <= notch - 2)) && y > 2) c = 0xf0c050;   // gold trim
                P.put(x, y, c);
            }
            for (let x = 1; x < W - 1; x += 2) {                 // fringe along the tails
                const y = Math.round(H - 7 + Math.abs(x - W / 2) / (W / 2) * 7);
                P.put(x, y + 1, on ? 0xf0c050 : 0x8a7050); P.put(x, y + 2, on ? 0xb08020 : 0x5a4a38);
            }
        });
    }

    // A wooden plank, in 2px pixels: its colour, grain streaks running along it, a knot or two,
    // a lit edge and a shadowed one, nail heads at the ends.
    // An iron shelf bracket: a scrolled arm under the shelf.
    _bracket(g, x, y) {
        g.fillStyle(0x2a2a34, 1); g.fillRect(x - 2, y, 4, 22); g.fillRect(x - 10, y, 20, 3);
        g.lineStyle(3, 0x2a2a34, 1); g.beginPath(); g.arc(x + 6, y + 10, 6, Math.PI, Math.PI * 1.5); g.strokePath(); g.beginPath(); g.arc(x - 6, y + 10, 6, Math.PI * 1.5, 0); g.strokePath();
        g.fillStyle(0x6a6a7a, 1); g.fillRect(x - 1, y + 2, 2, 2); g.fillRect(x - 1, y + 16, 2, 2);
    }
    _plank(g, x, y, w, h, col, vertical = false) {
        // a few long grain lines (not noise), a lit edge, a shadowed one, nails at the ends
        const R = MenuArt.rng(Math.round(x * 7 + y * 13 + w * 3 + h)), L = vertical ? h : w, T = vertical ? w : h;
        const rect = (a, b, la, tb, c, al = 1) => { g.fillStyle(c, al); if (vertical) g.fillRect(x + b, y + a, tb, la); else g.fillRect(x + a, y + b, la, tb); };
        rect(0, 0, L, T, col);
        rect(0, 2, L, Math.max(2, Math.floor(T / 2 / 2) * 2 - 2), MenuArt.mix(col, 0xffffff, 0.05));   // the upper half a touch lighter
        if (T >= 10) for (let i = 0, n = Math.max(1, Math.round(L / 140)); i < n; i++) {
            const a = Math.floor(R() * L * 0.6 / 2) * 2, b = 4 + Math.floor(R() * (T - 8) / 2) * 2;
            rect(a, b, Math.floor(L * (0.25 + R() * 0.3) / 2) * 2, 2, MenuArt.mix(col, 0x000000, 0.18));
        }
        rect(0, 0, L, 2, MenuArt.mix(col, 0xffffff, 0.18));                 // lit edge
        rect(0, T - 2, L, 2, MenuArt.mix(col, 0x000000, 0.45));              // shadowed edge
        if (T >= 10 && L > 30) for (const a of [4, L - 8]) { rect(a, Math.floor(T / 2 / 2) * 2 - 1, 4, 4, 0x3a3a46); rect(a, Math.floor(T / 2 / 2) * 2 - 1, 2, 2, 0x8a8a9c); }
    }

    // The price tag: parchment on a string, with the weapon's name, element and tier, what it
    // does, how hard it hits (its measured damage, as bars), and the
    // stamp that buys or equips it. Returns its objects.
    _drawTag(T, w, el, acc, st, onStamp) {
        const objs = [], keep = o => { objs.push(o); return o; };
        const D = 8, INK = '#3b2716';
        const g = this._tagSheet(T, keep, D);

        const L = T.x + 20, R = T.x + T.w - 20;
        let y = T.y + 30;
        const eik = ShopScene.elementIcon(this, el);
        if (eik) keep(this.add.sprite(L + 6, y + 7, eik, '0').setScale(1).setDepth(D + 1)).play(eik);
        keep(this.add.text(L + (eik ? 16 : 0), y, `${st.elName}${ShopScene.TIER[w.id] ? '  ·  TIER ' + ShopScene.TIER[w.id] : ''}`, {
            fontSize: '11px', fontFamily: 'monospace', fontStyle: 'bold', color: UIKit._hex(MenuArt.mix(acc, 0x3b2716, 0.45)),
        }).setDepth(D + 1));
        keep(this.add.text(R, y, `${st.idx + 1} / ${st.list.length}`, { fontSize: '11px', fontFamily: 'monospace', color: '#7a5a34' })
            .setOrigin(1, 0).setDepth(D + 1));
        y += 18;
        keep(this.add.text(L, y, w.name, {
            fontSize: '26px', fontFamily: UIKit.FONT.title, fontStyle: 'bold', color: INK, wordWrap: { width: T.w - 40 },
        }).setDepth(D + 1));
        y += 40;
        g.lineStyle(1, 0x6a4a26, 0.6); g.lineBetween(L, y, R, y);
        y += 10;
        y += this._richText(keep, L, y, w.desc.replace(/\n/g, ' '), {
            fontSize: '13px', fontFamily: 'monospace', color: '#4a3420', wordWrap: { width: T.w - 40 }, lineSpacing: 4,
        }, D + 1) + 16;

        // What it's good at, rated out of 10 on three axes (ShopScene.RATINGS): one target,
        // crowds, and utility (control, setup, sustain). Cosmic weapons are buffs: no bars.
        const rt = ShopScene.RATINGS[w.id];
        // an owned weapon with several perks needs the room for its upgrades instead
        const roomy = !(st.owned && (WeaponLevels.PERKS[w.id] || []).length >= 2);
        if (!roomy) { /* the ratings are on the tag before you buy it */ }
        else if (rt) {
            [['ONE TARGET', rt[0]], ['CROWD', rt[1]], ['UTILITY', rt[2]]].forEach(([label, v]) => {
                keep(this.add.text(L, y, label, { fontSize: '11px', fontFamily: 'monospace', fontStyle: 'bold', color: '#6a4a26' }).setDepth(D + 1));
                const bx = L + 92, pw = (R - bx) / 10;
                for (let i = 0; i < 10; i++) {
                    g.fillStyle(i < v ? MenuArt.mix(acc, 0x3b2716, 0.2) : 0x3b2716, i < v ? 1 : 0.15);
                    g.fillRect(bx + i * pw, y + 2, pw - 2, 10);
                }
                y += 19;
            });
            const m = ShopScene.DPS[w.id];
            if (m) {
                keep(this.add.text(R, y - 1, `measured: ${Math.round(m[0])} / ${Math.round(m[1])} damage per second`, {
                    fontSize: '10px', fontFamily: 'monospace', color: '#7a5a34' }).setOrigin(1, 0).setDepth(D + 1));
                y += 14;
            }
        } else if (roomy) {
            keep(this.add.text(L, y, el === 'cosmic' ? 'Pure utility: a buff you cast, then switch back to fight. No damage of its own to rate.' : 'Not rated yet.', {
                fontSize: '12px', fontFamily: 'monospace', fontStyle: 'italic', color: '#6a4a26', wordWrap: { width: R - L },
            }).setDepth(D + 1));
            y += 34;
        }

        // Price and standing, as a ledger.
        y += 10;
        g.lineStyle(1, 0x6a4a26, 0.4); g.lineBetween(L, y, R, y);
        y += 10;
        const row = (k, v, col = INK) => {
            keep(this.add.text(L, y, k, { fontSize: '12px', fontFamily: 'monospace', fontStyle: 'bold', color: '#6a4a26' }).setDepth(D + 1));
            keep(this.add.text(R, y, v, { fontSize: '14px', fontFamily: UIKit.FONT.title, fontStyle: 'bold', color: col }).setOrigin(1, 0).setDepth(D + 1));
            y += 22;
        };
        let stampRoom = roomy;
        if (!st.owned) {
            row('PRICE', w.defaultWeapon ? 'Free (starter)' : `✦ ${w.cost}`);
            row('YOURS', 'Not yet', '#8a2a1a');
            row('YOUR PURSE', `✦ ${this.glorps}`, st.canBuy ? '#3a7a2a' : '#8a2a1a');
        } else {
            // Upgrades (Stats.js WeaponLevels): Power, no cap (none on cosmic weapons); each perk, capped.
            row('YOURS', st.equipped ? 'Equipped' : 'Owned', '#3a7a2a');
            const rows = [];
            if (!WeaponLevels.NO_POWER.includes(w.id)) {
                const lv = WeaponLevels.level(w.id);
                rows.push([`POWER  LV ${lv}`, `+${Math.round(lv * WeaponLevels.PER * 100)}% damage → +${Math.round((lv + 1) * WeaponLevels.PER * 100)}%`, WeaponLevels.dmgCost(w.id), null]);
            }
            for (const [key, name, cap, , , desc] of WeaponLevels.PERKS[w.id] || []) {
                const p = WeaponLevels.perk(w.id, key);
                rows.push([`${name.toUpperCase()}  ${p}/${cap}`, p >= cap ? desc(p) : (p ? desc(p) + '  →  ' : '→ ') + desc(p + 1), WeaponLevels.perkCost(w.id, key), key]);
            }
            // its enchants (Enchants.js): what's written in, and the way to the writing desk
            const en = Enchants.on(w.id), es = Enchants.slots(w.id);
            rows.push([`ENCHANTS  ${en.length}/${es}`, en.length ? en.map(b => `${Enchants.def(b.id).name} ${Enchants.roman(b.lvl)}`).join(', ') : `none yet  ·  ${Enchants.books()} sealed book${Enchants.books() === 1 ? '' : 's'}`, 0, '__ench']);
            // spread over the room down to the stamp, so a short list doesn't huddle at the top
            stampRoom = roomy || (T.y + T.h - 84 - y) / rows.length >= 48;   // a tall tag fits the stamp under its upgrades too
            const floor = (st.equipped && !stampRoom ? T.y + T.h - 24 : T.y + T.h - 84);
            const rowH = Math.max(38, Math.min(64, (floor - y) / Math.max(1, rows.length)));
            for (const [label, value, cost, key] of rows) {
                const cy = y + rowH / 2;
                keep(this.add.text(L, cy - 2, label, { fontSize: '12px', fontFamily: 'monospace', fontStyle: 'bold', color: '#6a4a26' }).setOrigin(0, 1).setDepth(D + 1));
                keep(this.add.text(L, cy + 1, value, { fontSize: '11px', fontFamily: 'monospace', color: '#4a3420', wordWrap: { width: R - L - 100 } }).setDepth(D + 1));
                const can = cost !== null && this.glorps >= cost, ench = key === '__ench';
                objs.push(...UIKit.button(this, { x: R - 44, y: cy, w: 88, h: 30, depth: D + 2, fontSize: '12px', fireOn: 'down',
                    label: ench ? 'THE ISLE' : cost === null ? 'MAXED' : `✦ ${cost}`, accent: ench ? UIKit.PALETTE.accentPurple : cost === null ? UIKit.PALETTE.line : can ? UIKit.PALETTE.accentGold : UIKit.PALETTE.line,
                    onClick: () => ench ? this.scene.start('Enchant', { weapon: w.id }) : this._buyWeaponUp(w.id, key) }).objs);   // enchanting is at the Isle
                y += rowH;
                if (rows.length > 1 && label !== rows[rows.length - 1][0]) { g.lineStyle(1, 0x6a4a26, 0.15); g.lineBetween(L, y, R, y); }
            }
        }

        // The stamp: EQUIPPED is inked onto the tag; otherwise a wax-red button to press.
        const sy = T.y + T.h - 46;
        if (st.equipped && !stampRoom) { /* YOURS already says Equipped; the space went to upgrades */ }
        else if (st.equipped) {
            const s = keep(this.add.text(T.x + T.w / 2, sy, 'EQUIPPED', {
                fontSize: '24px', fontFamily: UIKit.FONT.title, fontStyle: 'bold', color: '#3a7a2a',
                stroke: '#3a7a2a', strokeThickness: 1, padding: { x: 10, y: 4 },
            }).setOrigin(0.5).setDepth(D + 1).setAngle(-6));
            const box = keep(this.add.graphics({ x: T.x + T.w / 2, y: sy }).setDepth(D + 1));   // drawn round its own centre so it tilts with the ink
            box.lineStyle(3, 0x3a7a2a, 0.9); box.strokeRect(-s.width / 2, -s.height / 2, s.width, s.height);
            box.setAngle(-6);
        } else {
            const label = st.owned ? 'EQUIP' : st.canBuy ? `BUY  ✦ ${w.cost}` : `✦ ${w.cost}  ·  NEED ${w.cost - this.glorps}`;
            const b = UIKit.button(this, { x: T.x + T.w / 2, y: sy, w: T.w - 40, h: 48, label,
                                           accent: st.owned ? UIKit.PALETTE.accentGreen : st.canBuy ? UIKit.PALETTE.accentRed : UIKit.PALETTE.line,
                                           fontSize: '18px', depth: D + 2, fireOn: 'down', onClick: onStamp });
            objs.push(...b.objs);
        }
        return objs;
    }

    // ── STATS TAB ────────────────────────────────────────────────────────────
    // The training hall (Stats.js). Three cards with room to breathe: the stat's name and what
    // it's for; its emblem; one big number (what it does for you now) with the next level under
    // it; the level as 25 pips in five tiers; the five talents as gems with the next one named;
    // and the way to train. The detail lives in popouts that follow the cursor: hover the
    // number, the pips, a gem or the button. Tiers: no stat starts its next five until the
    // other two have finished these. `bought` ({ id, lvl }) plays the purchase on its card.
    // Loose objects (UIKit buttons are not container-safe), rebuilt on the next tick after a
    // buy, never inside the click.
    _showStatsTab(bought = null) {
        this._hideStatsTab();
        const L = this._layout, W = this.scale.width, D = 20;
        const objs = [], keep = o => { objs.push(o); return o; };
        const x0 = L.S.x0 - 10, x1 = W - 24, top = L.S.top + 6, bot = L.CT - 10;
        // the same boards as the stall, with a plank across the top for the tier line
        keep(this.add.image(x0 - 6, top - 6, ShopScene.stallWall(this, x1 - x0 + 12, bot - top + 12)).setOrigin(0).setScale(2).setDepth(D));
        const back = keep(this.add.graphics().setDepth(D + 0.5));
        back.fillStyle(0x000000, 0.35); back.fillRect(x0 - 6, top - 6, x1 - x0 + 12, 4);
        this._plank(back, x0 - 6, top - 2, x1 - x0 + 12, 24, 0x5a3a20);
        const ACC = { damage: UIKit.PALETTE.accentRed, health: UIKit.PALETTE.accentGreen, armor: UIKit.PALETTE.accentBlue };
        const BIG = { damage: l => [l ? `+${Math.round((PlayerStats.damageMult(l) - 1) * 100)}%` : '+0%', 'damage dealt'],
                      health: l => [`${PlayerStats.maxHealth(l)}`, 'max health'],
                      armor:  l => [l ? `−${Math.round((1 - PlayerStats.takenMult(l)) * 100)}%` : '0%', 'damage taken'] };
        const DETAIL = {
            damage: l => `Every hit you deal is ×${PlayerStats.damageMult(l).toFixed(3)}.\nEach level adds 5%, compounding: level 10 is ×1.63, level 25 ×3.39.`,
            health: l => `${PlayerStats.maxHealth(l)} max HP (base 100, +10 a level).\nAt level 25: 350.`,
            armor:  l => `${PlayerStats.armor(l)} armor: hits land at ${Math.round(PlayerStats.takenMult(l) * 100)}% (100 ÷ (100 + armor)).\nEvery point is worth the same; at level 25 hits do 29%.`,
        };
        const ROMAN = ['I', 'II', 'III', 'IV', 'V'];
        const tip = this._statTip ??= { objs: [] };

        // One quiet line across the top: the tier you're on and what finishes it.
        const tier = PlayerStats.tier();
        keep(this.add.text(x0 + 2, top + 10, tier >= 5 ? 'EVERY TIER MASTERED'
            : `TIER ${ROMAN[tier]}  ·  bring all three to level ${(tier + 1) * 5} to open the next`, {
            fontSize: '13px', fontFamily: UIKit.FONT.title, fontStyle: 'bold', color: '#f6d58a', stroke: '#1b1612', strokeThickness: 3,
        }).setOrigin(0, 0.5).setDepth(D + 1));
        // and what the three come to together, on the same line
        const ehp = Math.round(PlayerStats.maxHealth() / PlayerStats.takenMult());
        keep(this.add.text(x1, top + 10, `${ehp} effective HP  ·  damage ×${PlayerStats.damageMult().toFixed(2)}  ·  ${PlayerStats.owned().size}/15 talents`, {
            fontSize: '11px', fontFamily: 'monospace', color: '#e8c890', stroke: '#1b1612', strokeThickness: 3 }).setOrigin(1, 0.5).setDepth(D + 1));

        const gap = 22, cw = Math.floor((x1 - x0 - gap * 2) / 3), cy0 = top + 28, ch = bot - cy0 - 2;
        PlayerStats.ORDER.forEach((id, k) => {
            const d = PlayerStats.DEFS[id], acc = ACC[id], lvl = PlayerStats.level(id), cost = PlayerStats.cost(id, lvl);
            const gate = PlayerStats.tierGate(id, lvl), list = PlayerStats.TALENTS[id], nextT = list.find(t => lvl < t.at);
            const x = x0 + k * (cw + gap), cx = x + cw / 2, accHex = UIKit._hex(MenuArt.mix(acc, 0x3b2716, 0.35));   // the stat's colour, inked dark enough for paper
            // Vertical rhythm, as fractions of the room between the heading and the button, so a
            // taller card spreads out instead of leaving a hole above the button. With enough
            // room the talents get a row each (name and level), not just their gems.
            const head = 92, by = cy0 + ch - 28, u = by - 30 - (cy0 + head), Y = f => cy0 + head + u * f;
            const roomy = u >= 360;
            const g = keep(this.add.graphics().setDepth(D + 1));
            // a parchment sheet pinned to the boards (like the weapons' tags), in the stat's colour at the edges
            g.fillStyle(0x000000, 0.45); g.fillRect(x + 5, cy0 + 7, cw, ch);
            g.fillStyle(0xe2cfa4, 1); g.fillRect(x, cy0, cw, ch);
            g.fillStyle(0xd0b98a, 0.5); g.fillCircle(x + cw * 0.78, cy0 + ch * 0.66, 70); g.fillCircle(x + cw * 0.22, cy0 + ch * 0.3, 46);
            g.fillStyle(MenuArt.mix(acc, 0xe2cfa4, 0.55), 1); g.fillRect(x, cy0, cw, 8);
            g.lineStyle(2, 0x6a4a26, 1); g.strokeRect(x, cy0, cw, ch);
            g.lineStyle(1, 0x6a4a26, 0.45); g.strokeRect(x + 6, cy0 + 12, cw - 12, ch - 18);
            for (const nx of [x + 14, x + cw - 14]) { g.fillStyle(0x2a2a34, 1); g.fillCircle(nx, cy0 + 4, 4); g.fillStyle(0x8a8a9c, 1); g.fillCircle(nx - 1, cy0 + 3, 1.5); }

            // name and purpose
            keep(this.add.text(cx, cy0 + 22, id.toUpperCase(), { fontSize: '10px', fontFamily: 'monospace', fontStyle: 'bold', color: accHex }).setOrigin(0.5).setDepth(D + 2));
            keep(this.add.text(cx, cy0 + 44, d.name, { fontSize: '28px', fontFamily: UIKit.FONT.title, fontStyle: 'bold', color: '#3b2716' }).setOrigin(0.5).setDepth(D + 2));
            keep(this.add.text(cx, cy0 + 66, d.blurb, { fontSize: '12px', fontFamily: 'monospace', color: '#5a3e22', align: 'center', wordWrap: { width: cw - 28 } }).setOrigin(0.5, 0).setDepth(D + 2));

            // the emblem in its light, a ring turning round it
            const ey = Y(roomy ? 0.13 : 0.17);
            const med = keep(this.add.graphics().setDepth(D + 1.5));   // a carved wooden medallion for the emblem to sit on
            med.fillStyle(0x000000, 0.3); med.fillCircle(cx + 2, ey + 3, 44);
            med.fillStyle(0x5a3a20, 1); med.fillCircle(cx, ey, 44); med.fillStyle(0x7a5230, 1); med.fillCircle(cx, ey, 38);
            med.lineStyle(2, 0x3a2414, 1); med.strokeCircle(cx, ey, 44); med.lineStyle(1, 0xa87a48, 0.6); med.strokeCircle(cx, ey - 1, 37);
            const em = keep(this.add.graphics().setDepth(D + 2).setPosition(cx, ey).setScale(0.75));
            this._statEmblem(em, id, 0, 0, acc);
            const ring = keep(this.add.graphics().setDepth(D + 2).setPosition(cx, ey));
            ring.lineStyle(2, MenuArt.mix(acc, 0xffffff, 0.2), 0.9);
            for (let t = 0; t < 8; t++) { const a0 = t / 8 * Math.PI * 2; ring.beginPath(); ring.arc(0, 0, 50, a0, a0 + 0.35); ring.strokePath(); }
            this.tweens.add({ targets: ring, angle: 360, duration: 12000, repeat: -1 });

            // the big number, what it means, and the next level
            const [big, what] = BIG[id](lvl);
            const bigT = keep(this.add.text(cx, Y(roomy ? 0.32 : 0.41), big, { fontSize: '36px', fontFamily: UIKit.FONT.title, fontStyle: 'bold', color: accHex }).setOrigin(0.5).setDepth(D + 2));
            keep(this.add.text(cx, bigT.y + 25, what, { fontSize: '12px', fontFamily: 'monospace', color: '#5a3e22' }).setOrigin(0.5).setDepth(D + 2));
            keep(this.add.text(cx, bigT.y + 43, cost !== null ? `next  ▸  ${BIG[id](lvl + 1)[0]}` : 'maxed', { fontSize: '12px', fontFamily: 'monospace', fontStyle: 'bold', color: '#8a6a44' }).setOrigin(0.5).setDepth(D + 2));
            this._tipZone(keep, cx, bigT.y + 18, cw - 40, 64, D, () => ({ title: `${d.name}: ${big} ${what}`, body: DETAIL[id](lvl), accent: acc }));

            const divY = bigT.y + 62;
            g.lineStyle(1, 0x6a4a26, 0.4); g.lineBetween(x + 24, divY, x + cw - 24, divY);

            // level: 25 pips in five tiers, a diamond at each tier's end
            const L0 = x + 24, R0 = x + cw - 24, py = divY + 28, gw = (R0 - L0 - 4 * 6) / 5, pw = gw / 5;
            keep(this.add.text(L0, py - 16, `LEVEL ${lvl} / ${d.cap}`, { fontSize: '11px', fontFamily: 'monospace', fontStyle: 'bold', color: '#5a3e22' }).setDepth(D + 2));
            keep(this.add.text(R0, py - 16, `TIER ${ROMAN[Math.min(4, Math.floor(lvl / 5))]}`, { fontSize: '11px', fontFamily: UIKit.FONT.title, fontStyle: 'bold', color: '#8a6a44' }).setOrigin(1, 0).setDepth(D + 2));
            for (let i = 0; i < d.cap; i++) {
                const grp = Math.floor(i / 5), px = L0 + grp * (gw + 6) + (i % 5) * pw;
                g.fillStyle(i < lvl ? acc : 0xc9b083, 1); g.fillRect(px, py, pw - 2, 9);
            }
            for (let grp = 0; grp < 5; grp++) {
                const mx = L0 + grp * (gw + 6) + gw - 1, got = lvl >= (grp + 1) * 5;
                g.fillStyle(got ? 0xc8961e : 0xa88c60, 1);
                g.fillPoints([{ x: mx, y: py - 7 }, { x: mx + 4, y: py - 3 }, { x: mx, y: py + 1 }, { x: mx - 4, y: py - 3 }], true);
            }
            this._tipZone(keep, cx, py - 4, R0 - L0, 34, D, () => ({ title: `Level ${lvl} of ${d.cap}`,
                body: (gate ? `Locked at ${gate} until the other two reach ${gate}.\n` : '')
                    + 'Levels come in tiers of five. A stat can\'t start its next tier until the other two have finished this one; each tier ends in a talent (the gold diamonds).',
                accent: acc }));

            // the talents: with room, a row each (its gem, name and level; hover for what it
            // does); otherwise five gems with the next one named under them.
            const gem = (gx, gy, r, got, nxt) => {
                const pts = (rr) => [{ x: gx, y: gy - rr }, { x: gx + rr * 0.92, y: gy }, { x: gx, y: gy + rr }, { x: gx - rr * 0.92, y: gy }];
                g.fillStyle(0x000000, 0.4); g.fillPoints(pts(r + 1).map(p => ({ x: p.x + 1, y: p.y + 2 })), true);
                g.fillStyle(got ? acc : nxt ? 0xd8c39a : 0xc9b083, 1); g.fillPoints(pts(r), true);
                if (got) { g.fillStyle(0xffffff, 0.35); g.fillPoints(pts(r * 0.4).map(p => ({ x: p.x - r * 0.25, y: p.y - r * 0.25 })), true); }
                g.lineStyle(1, got ? 0xffffff : nxt ? acc : 0x8a6a44, got ? 0.5 : 0.9); g.strokePoints(pts(r), true);
            };
            if (roomy) {
                const ty0 = py + 34, rowH = Math.min(46, (by - 52 - ty0 - 22) / 4.5);
                keep(this.add.text(L0, ty0 - 4, 'TALENTS', { fontSize: '11px', fontFamily: 'monospace', fontStyle: 'bold', color: '#5a3e22' }).setDepth(D + 2));
                list.forEach((t, i) => {
                    const ry = ty0 + 22 + i * rowH, got = lvl >= t.at, nxt = t === nextT;
                    gem(L0 + 8, ry, 7, got, nxt);
                    keep(this.add.text(L0 + 24, ry, `${ROMAN[i]}.  ${t.name}`, { fontSize: '13px', fontFamily: UIKit.FONT.title, fontStyle: 'bold',
                        color: got ? accHex : nxt ? '#3b2716' : '#8a6a44' }).setOrigin(0, 0.5).setDepth(D + 2));
                    keep(this.add.text(R0, ry, got ? '✓' : `level ${t.at}`, { fontSize: '11px', fontFamily: 'monospace', color: got ? accHex : '#8a6a44' })
                        .setOrigin(1, 0.5).setDepth(D + 2));
                    this._tipZone(keep, cx, ry, R0 - L0, rowH, D, () => ({ title: `${ROMAN[i]}. ${t.name}`, body: `${t.desc}\n${got ? 'Yours.' : `Unlocks at level ${t.at}.`}`, accent: got ? acc : null }));
                });
            } else {
                const gy = py + 34, gs = 36;
                list.forEach((t, i) => {
                    const gx = cx + (i - 2) * gs, got = lvl >= t.at;
                    gem(gx, gy, 12, got, t === nextT);
                    keep(this.add.text(gx, gy + 21, ROMAN[i], { fontSize: '10px', fontFamily: UIKit.FONT.title, fontStyle: 'bold', color: got ? accHex : '#8a6a44' }).setOrigin(0.5).setDepth(D + 2));
                    this._tipZone(keep, gx, gy, 32, 32, D, () => ({ title: `${ROMAN[i]}. ${t.name}`, body: `${t.desc}\n${got ? 'Yours.' : `Unlocks at level ${t.at}.`}`, accent: got ? acc : null }));
                });
                keep(this.add.text(cx, gy + 37, nextT ? `next talent  ·  ${nextT.name} at ${nextT.at}` : 'every talent earned', {
                    fontSize: '11px', fontFamily: 'monospace', color: nextT ? '#5a3e22' : accHex }).setOrigin(0.5).setDepth(D + 2));
            }

            const afford = cost !== null && this.glorps >= cost;
            const label = cost === null ? 'MASTERED' : gate ? `others to ${gate} first` : afford ? `TRAIN  ✦ ${cost}` : `✦ ${cost}`;
            const b = UIKit.button(this, { x: cx, y: by, w: cw - 56, h: 36, depth: D + 3, fontSize: '16px', fireOn: 'down',
                label, accent: cost === null ? UIKit.PALETTE.accentGold : gate || !afford ? UIKit.PALETTE.line : acc,
                onClick: () => this._buyStat(id) });
            objs.push(...b.objs);
            // the button's own hit area carries its popout, so nothing sits over it to steal the click
            const btnTip = () => cost === null ? { title: 'Mastered', body: 'Nothing left to train here.', accent: acc }
                : { title: `Level ${lvl + 1} for ✦ ${cost}`, body: `${PlayerStats.describe(id, lvl)}  ▸  ${PlayerStats.describe(id, lvl + 1)}`
                    + (list.find(t => t.at === lvl + 1) ? `\nUnlocks ${list.find(t => t.at === lvl + 1).name}.` : '')
                    + (gate ? `\nLocked: the other two need level ${gate}.` : !afford ? `\nYou have ✦ ${this.glorps}.` : ''), accent: acc };
            b.hit.on('pointerover', (p) => this._showTip(p.x, p.y, btnTip()));
            b.hit.on('pointermove', (p) => this._moveTip(p.x, p.y));
            b.hit.on('pointerout', () => this._hideTip());
            b.hit.on('pointerdown', () => this._hideTip());

            // The purchase, played here: a flash, the number jumping, the emblem lifting; on a
            // fifth level, the talent it unlocked.
            if (bought?.id === id) {
                const fl = keep(this.add.rectangle(cx, cy0 + ch / 2, cw, ch, acc, 0.18).setDepth(D + 4).setBlendMode(Phaser.BlendModes.ADD));
                this.tweens.add({ targets: fl, alpha: 0, duration: 450 });
                bigT.setScale(1.35); this.tweens.add({ targets: bigT, scale: 1, duration: 320, ease: 'Back.easeOut' });
                this.tweens.add({ targets: em, y: ey - 12, duration: 150, yoyo: true, ease: 'Quad.easeOut' });
                const t = list.find(t => t.at === lvl);
                if (t) {
                    const ban = keep(this.add.container(cx, ey).setDepth(D + 5));
                    const bg = this.add.graphics();
                    bg.fillStyle(0x0d0a08, 0.95); bg.fillRect(-cw / 2 + 14, -36, cw - 28, 72);
                    bg.lineStyle(2, UIKit.PALETTE.accentGold, 1); bg.strokeRect(-cw / 2 + 14, -36, cw - 28, 72);
                    ban.add([bg,
                        this.add.text(0, -16, 'TALENT UNLOCKED', { fontSize: '11px', fontFamily: 'monospace', fontStyle: 'bold', color: UIKit.CSS.accentGold }).setOrigin(0.5),
                        this.add.text(0, 8, t.name, { fontSize: '23px', fontFamily: UIKit.FONT.title, fontStyle: 'bold', color: '#3b2716' }).setOrigin(0.5)]);
                    ban.setScale(0.6).setAlpha(0);
                    this.tweens.add({ targets: ban, scale: 1, alpha: 1, duration: 260, ease: 'Back.easeOut' });
                    this.tweens.add({ targets: ban, alpha: 0, delay: 1900, duration: 400 });
                    const sp = keep(this.add.particles(cx, ey, 'mn_px2', { speed: { min: 80, max: 220 }, lifespan: 700,
                        scale: { start: 2, end: 0 }, tint: [UIKit.PALETTE.accentGold, 0xffffff, acc], blendMode: 'ADD', emitting: false }).setDepth(D + 5));
                    sp.explode(30);
                }
            }
        });
        objs.push({ active: true, destroy: () => this._hideTip() });
        this._statsObjs = objs;
    }

    // A hover area that shows a popout at the cursor, following it, gone when you leave.
    // `fn` builds { title, body, accent } when the popout opens.
    // Text with *keywords*: drawn plain, then each keyword inked again on top in its own colour
    // (monospace, so it lands exactly) with a hover popout from ShopScene.KEYWORDS. Returns the height.
    _richText(keep, x, y, str, style, D) {
        const words = [];
        const plain = str.replace(/\*([^*]+)\*/g, (m, w) => { words.push(w); return w; });
        const t = keep(this.add.text(x, y, plain, style).setDepth(D));
        if (!words.length) return t.height;
        const probe = this.add.text(0, 0, '', { ...style, wordWrap: null }), wOf = str => probe.setText(str).width;
        const lines = t.getWrappedText(plain), lh = (t.height + (style.lineSpacing || 0)) / lines.length;
        let li = 0, col = 0;
        for (const w of words) {
            for (; li < lines.length; li++, col = 0) { const i = lines[li].indexOf(w, col); if (i >= 0) { col = i; break; } }
            if (li >= lines.length) break;   // split across a line: left plain
            const k = ShopScene.keyword(w), kx = x + wOf(lines[li].slice(0, col)), ky = y + li * lh, ww = wOf(w);
            col += w.length;
            if (!k) continue;
            keep(this.add.text(kx, ky, w, { ...style, color: '#6a2a8a', wordWrap: null }).setDepth(D + 0.1));
            const u = keep(this.add.graphics().setDepth(D + 0.1));
            u.lineStyle(1, 0x6a2a8a, 0.6);
            for (let ux = kx; ux < kx + ww - 1; ux += 4) u.lineBetween(ux, ky + lh - 4, Math.min(ux + 2, kx + ww), ky + lh - 4);
            this._tipZone(keep, kx + ww / 2, ky + lh / 2, ww, lh, D, () => ({ title: k[0], body: k[1], accent: 0x9a5ad0 }));
        }
        probe.destroy();
        return t.height;
    }

    _tipZone(keep, x, y, w, h, depth, fn) {
        const z = keep(this.add.zone(x, y, w, h).setInteractive().setDepth(depth + 3));
        z.on('pointerover', (p) => this._showTip(p.x, p.y, fn()));
        z.on('pointermove', (p) => this._moveTip(p.x, p.y));
        z.on('pointerout', () => this._hideTip());
        z.once('destroy', () => this._hideTip());   // redrawn under the pointer (a tab or banner switch): no pointerout comes
        return z;
    }
    _showTip(px, py, { title, body, accent }) {
        this._hideTip();
        const D = 60, tw = 270;
        const head = this.add.text(0, 0, title, { fontSize: '13px', fontFamily: UIKit.FONT.title, fontStyle: 'bold',
            color: accent != null ? UIKit._hex(accent) : '#3b2716', wordWrap: { width: tw - 28 } }).setDepth(D + 1);
        const text = this.add.text(0, 0, String(body).replace(/\*/g, ''), { fontSize: '11px', fontFamily: 'monospace', color: '#5a3e22',   // a body's *keywords* read plain here
            wordWrap: { width: tw - 28 }, lineSpacing: 3 }).setDepth(D + 1);
        const th = head.height + text.height + 30;
        const g = this.add.graphics().setDepth(D);
        UIKit.ironFrame(g, 0, 0, tw, th, { accent: accent ?? UIKit.PALETTE.line, courses: false, rivets: false });
        this._tip = { g, head, text, tw, th };
        this._moveTip(px, py);
        for (const o of [g, head, text]) { o.setAlpha(0); this.tweens.add({ targets: o, alpha: 1, duration: 100 }); }
    }
    _moveTip(px, py) {
        const T = this._tip;
        if (!T) return;
        const W = this.scale.width, H = this.scale.height;
        let x = px + 16, y = py + 18;
        if (x + T.tw > W - 8) x = px - T.tw - 12;
        if (y + T.th > H - 8) y = py - T.th - 12;
        T.g.setPosition(x, y); T.head.setPosition(x + 14, y + 12); T.text.setPosition(x + 14, y + 18 + T.head.height);
    }
    _hideTip() {
        const T = this._tip;
        if (!T) return;
        this._tip = null;
        for (const o of [T.g, T.head, T.text]) { this.tweens.killTweensOf(o); o.destroy(); }
    }

    _hideStatsTab() {
        for (const o of (this._statsObjs || [])) { if (o?.active) this.tweens.killTweensOf(o); o?.destroy?.(); }
        this._statsObjs = null;
    }

    // A weapon upgrade (WeaponLevels): `key` null for Power, else that perk. Re-draws the tag.
    _buyWeaponUp(id, key) {
        const cost = key ? WeaponLevels.perkCost(id, key) : WeaponLevels.dmgCost(id);
        if (cost === null) { this.setGlurpDialogue('"That one\'s as good as it gets!"'); return; }
        if (this.glorps < cost) { Sfx.play(this, 'hurt'); this.setGlurpDialogue(`"${cost - this.glorps} more glorps, friend."`); return; }
        this.glorps -= cost;
        localStorage.setItem('glorps', this.glorps);
        if (!key) WeaponLevels.setLevel(id, WeaponLevels.level(id) + 1);
        else WeaponLevels.setPerk(id, key, WeaponLevels.perk(id, key) + 1);
        this._refreshCurrency();
        Sfx.play(this, 'pickup');
        const d = key && WeaponLevels._def(id, key), p = key ? WeaponLevels.perk(id, key) : 0;
        this.setGlurpDialogue(!key ? `"Sharper! Power ${WeaponLevels.level(id)}."` : `"${d[1]} ${p}! ${d[5](p)}."`);
        this.time.delayedCall(0, () => this._renderWeapon?.(0));
    }

    // ── ENCHANTING ART (the Isle, EnchantScene, borrows these) ───────────────
    // Ink for the books' own emblems (letters the covers don't use).
    static BOOK_INK = { F: '#ff4a2a', O: '#ffa03a', Y: '#ffe85a', I: '#7ad8ff', V: '#c890ff', N: '#7ae07a', W: '#ffffff', K: '#140c18', B: '#c8102a', T: '#a8b0c0' };
    // Every enchant's own emblem on its cover, animated over 8 frames, drawn around (12, 11.5).
    static BOOK_EMB = {
        // a blade, a glint running up its edge
        honed: (m, f) => { m.line(8, 16, 15, 7, 'T'); m.line(9, 16, 16, 7, 'W'); m.line(7, 14, 10, 17, 'O'); m.line(7, 17, 6, 18, 'K'); m.set(16, 6, 'W'); const k = f % 8; if (k < 6) m.set(9 + k, 15 - k * 1.3, 'g'); },
        // a four-point star that flares and shrinks
        keen: (m, f) => { const s = [3, 4, 5, 4, 3, 2, 3, 4][f]; m.line(12, 11.5 - s, 12, 11.5 + s, 'Y'); m.line(12 - s, 11.5, 12 + s, 11.5, 'Y'); m.disc(12, 11.5, 1.6, 'W'); if (f % 4 === 0) { m.set(9, 9, 'g'); m.set(15, 14, 'g'); } },
        // rings rippling out of a note
        resonant: (m, f) => { m.ring(12, 11.5, 1 + (f % 4) * 1.4, 1, f % 4 === 3 ? 'e' : 'V'); m.ring(12, 11.5, 1 + ((f + 2) % 4) * 1.4, 1, 'V'); m.disc(12, 11.5, 1.2, 'W'); },
        // a kite shield, a shine sliding across it
        bulwark: (m, f) => { m.poly([[8, 6], [16, 6], [16, 12], [12, 17], [8, 12]], 'T'); m.poly([[9, 7], [15, 7], [15, 12], [12, 15.5], [9, 12]], 'I'); m.line(12, 7, 12, 15, 'W'); const x = 8 + (f % 8); if (x < 16) m.line(x, 7, x - 1, 10, 'g'); },
        // a crown with a sword through it, its jewel blinking
        bossbane: (m, f) => { m.poly([[7, 14], [7, 9], [9.5, 11], [12, 7], [14.5, 11], [17, 9], [17, 14]], 'Y'); m.rect(7, 13, 10, 2, 'O'); m.set(12, 10, f % 4 < 2 ? 'F' : 'W'); m.line(17, 5, 8, 17, 'T'); m.line(16, 6, 14, 8, 'W'); },
        // a skull, an axe swinging down over it
        executing: (m, f) => { m.disc(12, 12, 3.6, 'W'); m.rect(10, 14, 5, 3, 'W'); m.set(10, 12, 'K'); m.set(11, 12, 'K'); m.set(13, 12, 'K'); m.set(14, 12, 'K'); m.set(12, 15, 'K'); const a = [0, 1, 2, 3, 3, 2, 1, 0][f]; m.line(16, 4 + a, 16, 10 + a, 'O'); m.poly([[16, 4 + a], [19, 3 + a], [19, 8 + a]], 'T'); },
        // an eye, its pupil looking around
        deadeye: (m, f) => { m.poly([[6, 11.5], [9, 8], [15, 8], [18, 11.5], [15, 15], [9, 15]], 'W'); const px = 12 + [0, 1, 2, 1, 0, -1, -2, -1][f]; m.disc(px, 11.5, 2.4, 'F'); m.disc(px, 11.5, 1, 'K'); m.set(px - 1, 10, 'W'); if (f === 4) m.rect(6, 11, 13, 2, 'a'); },
        // a crosshair, its ring tightening on the centre
        true_aim: (m, f) => { const r = [5, 4.5, 4, 3.5, 3, 3.5, 4, 4.5][f]; m.ring(12, 11.5, r, 1, 'F'); m.line(12, 5, 12, 8, 'W'); m.line(12, 15, 12, 18, 'W'); m.line(6, 11.5, 9, 11.5, 'W'); m.line(15, 11.5, 18, 11.5, 'W'); m.set(12, 11.5, f % 2 ? 'Y' : 'F'); },
        // crossed twigs with a small flame licking up
        kindling: (m, f) => { m.line(8, 17, 16, 14, 'O'); m.line(8, 14, 16, 17, 'd'); const h = [5, 6, 7, 6, 5, 6, 8, 6][f]; m.poly([[10, 14], [14, 14], [13, 14 - h * 0.6], [12, 14 - h], [11, 14 - h * 0.5]], 'F'); m.poly([[11, 14], [13, 14], [12, 15 - h * 0.6]], 'Y'); },
        // a snowflake, one arm lit at a time
        frostbite: (m, f) => { const A = [[0, 1], [1, 0], [0.7, 0.7], [0.7, -0.7]]; A.forEach(([dx, dy], k) => { const c = k === f % 4 ? 'W' : 'I'; m.line(12 - dx * 5, 11.5 - dy * 5, 12 + dx * 5, 11.5 + dy * 5, c); }); m.disc(12, 11.5, 1.2, 'W'); },
        // two posts, a spark jumping between them
        static: (m, f) => { m.rect(7, 8, 2, 9, 'T'); m.rect(15, 8, 2, 9, 'T'); m.set(7, 7, 'Y'); m.set(16, 7, 'Y'); const R = MenuArt.rng(5 + f); let y = 9; for (let x = 9; x <= 15; x++) { y = Math.max(7, Math.min(15, y + Math.round(R() * 4 - 2))); m.set(x, y, f % 2 ? 'Y' : 'W'); } },
        // a big flame, flickering
        searing: (m, f) => { const w = [0, 1, 0, -1, 0, 1, -1, 0][f]; m.poly([[8, 17], [16, 17], [17, 13], [14 + w, 9], [13, 4 + (f % 3)], [11, 9], [9 + w, 7], [7, 13]], 'F'); m.poly([[10, 17], [14, 17], [15, 14], [12 + w, 9], [9, 14]], 'O'); m.poly([[11, 17], [13, 17], [13, 15], [12, 12], [11, 15]], 'Y'); },
        // an ice crystal, a crack spreading through it
        shatterpoint: (m, f) => { m.poly([[12, 5], [16, 11], [12, 18], [8, 11]], 'I'); m.poly([[12, 6], [14, 11], [12, 16], [10, 11]], 'W'); const n = f % 8; const C = [[12, 8], [11, 10], [13, 11], [12, 13], [10, 14], [14, 9], [11, 6]]; for (let k = 0; k < Math.min(n, C.length); k++) m.set(C[k][0], C[k][1], 'K'); },
        // a water drop, a bolt striking through it
        conductor: (m, f) => { m.poly([[12, 5], [16, 12], [15, 15], [12, 17], [9, 15], [8, 12]], 'I'); m.disc(10.5, 13, 1, 'W'); if (f % 4 < 2) m.poly([[13, 6], [10, 12], [12.5, 12], [11, 17], [15, 10], [12.5, 10]], 'Y'); },
        // a burst that charges up and goes off
        overcharge: (m, f) => { const r = [2, 3, 4, 5, 6, 3, 2, 2][f]; for (let k = 0; k < 8; k++) { const t = k * Math.PI / 4; m.line(12, 11.5, 12 + Math.cos(t) * r, 11.5 + Math.sin(t) * r, k % 2 ? 'O' : 'Y'); } m.disc(12, 11.5, f === 4 ? 2.6 : 1.4, 'W'); },
        // a flask, bubbles rising
        catalyst: (m, f) => { m.rect(11, 5, 3, 4, 'T'); m.poly([[10, 9], [15, 9], [17, 17], [8, 17]], 'W'); m.poly([[9.5, 12], [15.5, 12], [16.5, 16.5], [8.5, 16.5]], 'N'); for (let k = 0; k < 2; k++) { const y = 16 - ((f + k * 4) % 8) * 1.3; if (y > 6) m.set(11 + k * 2, y, 'W'); } },
        // a fang, a drop of blood running down it
        vampiric: (m, f) => { m.poly([[8, 5], [16, 5], [15, 10], [12, 16], [9, 10]], 'W'); m.rect(8, 5, 8, 2, 'B'); const y = 7 + (f % 8) * 1.4; if (y < 19) m.set(12, y, 'B'); },
        // a metronome, ticking side to side
        rhythm: (m, f) => { m.poly([[8.5, 17.5], [15.5, 17.5], [13.8, 5.5], [10.2, 5.5]], 'K'); m.poly([[9.5, 17], [14.5, 17], [13.3, 6.5], [10.7, 6.5]], 'd'); m.rect(9, 16, 6, 2, 'K'); const a = [-3, -2, 0, 2, 3, 2, 0, -2][f]; m.line(12, 15, 12 + a, 7, 'W'); m.set(12 + a * 0.7, 10, 'F'); },
        // a bomb, its fuse burning down
        volatile: (m, f) => { m.disc(11, 13, 4.6, 'K'); m.disc(11, 13, 4, 'T'); m.disc(9.5, 11.5, 1.2, 'W'); m.rect(13, 7, 2, 3, 'O'); const s = f % 8; m.line(15, 7, 17, 5, 'd'); m.set(17 - (s > 4 ? 1 : 0), 5 + (s > 4 ? 1 : 0), s % 2 ? 'Y' : 'F'); if (s % 2) m.set(18, 4, 'g'); },
        // a cracked world, its cracks glowing and pieces breaking away
        worldbreaker: (m, f) => { m.disc(12, 11.5, 5.6, 'K'); m.disc(12, 11.5, 5, 'T'); m.disc(10.5, 10, 1.6, 'W'); const c = f % 2 ? 'Y' : 'O'; m.line(8, 9, 12, 12, c); m.line(12, 12, 16, 10, c); m.line(12, 12, 11, 17, c); const d = f % 4; m.set(17 + d * 0.5, 7 - d * 0.5, 'O'); m.set(6 - d * 0.4, 15 + d * 0.3, 'F'); },
        // a flame in a ring, cycling through the elements
        everflame: (m, f) => { m.ring(12, 11.5, 6, 1, 'Y'); const c = ['F', 'I', 'Y', 'V'][Math.floor(f / 2)]; m.poly([[9, 15], [15, 15], [15, 11], [12, 6], [9, 11]], c); m.poly([[11, 15], [13, 15], [13, 12], [12, 10], [11, 12]], 'W'); },
        // a titan's helm, its eyes burning on and off
        titan_pact: (m, f) => { m.poly([[7, 16], [7, 9], [9, 6], [15, 6], [17, 9], [17, 16]], 'T'); m.rect(11, 6, 2, 11, 'W'); const c = f % 4 < 3 ? 'Y' : 'K'; m.rect(8, 10, 3, 2, c); m.rect(13, 10, 3, 2, c); m.rect(7, 15, 10, 2, 'O'); },
        // two blades crossing, flashing in turn
        twinstrike: (m, f) => { m.line(7, 6, 17, 17, f % 2 ? 'W' : 'N'); m.line(17, 6, 7, 17, f % 2 ? 'N' : 'W'); m.line(6, 15, 9, 18, 'O'); m.line(18, 15, 15, 18, 'O'); },
        // a heart pierced by a dagger, beating
        bloodpact: (m, f) => { const b = f % 4 === 0 ? 0.6 : 0; m.disc(10, 10, 2.6 + b, 'B'); m.disc(14, 10, 2.6 + b, 'B'); m.poly([[7.2, 11], [16.8, 11], [12, 17 + b]], 'B'); m.line(17, 5, 9, 15, 'T'); m.line(17, 5, 16, 6, 'W'); },
        // a prism splitting light, the colours sliding
        prism: (m, f) => { m.poly([[12, 6], [16, 15], [8, 15]], 'W'); m.line(4, 11, 10, 11, 'W'); const C = ['F', 'O', 'Y', 'N', 'I', 'V']; for (let k = 0; k < 4; k++) m.line(14, 11 + k * 0.7, 20, 9 + k * 2, C[(k + f) % C.length]); },
        // a gem cracking open, a blast pouring out of it
        devastation: (m, f) => { m.poly([[12, 5], [16, 10], [12, 17], [8, 10]], 'V'); m.poly([[12, 7], [14, 10], [12, 14], [10, 10]], 'W'); const r = [0, 2, 4, 6, 4, 2, 0, 0][f]; if (r) for (let k = 0; k < 6; k++) { const a = k * Math.PI / 3; m.set(12 + Math.cos(a) * (4 + r * 0.6), 11 + Math.sin(a) * (4 + r * 0.6), k % 2 ? 'Y' : 'W'); } },
        // a fist slamming the ground, a shockwave rolling out
        earthshaker: (m, f) => { const d = [0, -1, -2, -1, 1, 1, 0, 0][f]; m.rect(9, 7 + d, 6, 6, 'T'); m.rect(9, 7 + d, 6, 2, 'W'); m.rect(7, 16, 10, 2, 'O'); if (f >= 4 && f <= 6) { const w = (f - 3) * 2; m.line(12 - 4 - w, 15, 12 - 4, 15, 'V'); m.line(12 + 4, 15, 12 + 4 + w, 15, 'V'); } },
        // a ram's head of iron, charging forward
        juggernaut: (m, f) => { const d = [0, 0, 1, 1, 0, 0, 0, 0][f]; m.poly([[8 + d, 7], [16 + d, 7], [17 + d, 13], [12 + d, 17], [7 + d, 13]], 'T'); m.ring(7 + d, 9, 2.4, 1, 'W'); m.ring(17 + d, 9, 2.4, 1, 'W'); m.set(10 + d, 11, 'F'); m.set(14 + d, 11, 'F'); m.rect(11 + d, 14, 3, 1, 'K'); },
        // a winged boot, the wind streaking past
        slipstream: (m, f) => { m.rect(10, 6, 4, 8, 'I'); m.rect(10, 13, 7, 4, 'I'); m.rect(10, 16, 7, 1, 'K'); m.poly([[9, 7], [5, 5], [6, 9]], 'W'); for (let k = 0; k < 3; k++) { const x = 18 - ((f * 2 + k * 3) % 12); m.line(x, 8 + k * 3, x + 2, 8 + k * 3, 'W'); } },
        // three orbs, a burst passing between them
        chain_reaction: (m, f) => { const P = [[8, 15], [12, 7], [16, 15]], C = ['F', 'I', 'Y']; P.forEach(([x, y], k) => m.disc(x, y, 2, C[k])); const k = Math.floor(f / 2) % 3, [ax, ay] = P[k], [bx, by] = P[(k + 1) % 3]; m.line(ax, ay, bx, by, 'W'); if (f % 2) m.disc(bx, by, 2.8, 'W'); },
        // a chalice, blood rising in it
        sanguine: (m, f) => { m.poly([[7, 6], [17, 6], [15, 11], [9, 11]], 'W'); m.rect(11, 11, 2, 4, 'T'); m.rect(9, 15, 6, 2, 'T'); const h = [1, 2, 3, 3, 2, 1, 1, 1][f]; m.poly([[8, 7], [16, 7], [16 - h * 0.3, 7 + h], [8 + h * 0.3, 7 + h]], 'B'); if (f === 2) m.set(12, 5, 'B'); },
        // a crown of lightning
        arc_lord: (m, f) => { m.poly([[7, 15], [7, 9], [9.5, 12], [12, 6], [14.5, 12], [17, 9], [17, 15]], 'I'); m.rect(7, 14, 10, 2, 'T'); if (f % 2) { m.line(12, 6, 10, 3, 'W'); m.line(7, 9, 5, 6, 'W'); m.line(17, 9, 19, 6, 'W'); } m.set(12, 12, 'W'); },
        // a die loaded with a gold pip that keeps landing
        loaded: (m, f) => { const t = [0, 0, -1, -2, -1, 0, 0, 0][f]; m.rect(8, 8 + t, 9, 9, 'W'); m.rect(8, 8 + t, 9, 2, 'T'); for (const [x, y] of [[10, 11], [14, 15]]) m.set(x, y + t, 'K'); m.disc(12.5, 13 + t, 1.4, 'Y'); if (f === 5) m.set(18, 7, 'g'); },
        // a spiked shield with a gold crit spark
        iron_edge: (m, f) => { m.poly([[8, 6], [16, 6], [16, 12], [12, 17], [8, 12]], 'T'); m.set(7, 9, 'W'); m.set(17, 9, 'W'); m.set(12, 18, 'W'); m.set(12, 5, 'W'); m.poly([[10, 11], [12, 9], [14, 11], [12, 13]], f % 4 < 2 ? 'Y' : 'O'); },
        // a spinning wheel charging a gem
        kinetic_core: (m, f) => { m.ring(12, 11.5, 5.5, 1.2, 'I'); const a = f / 8 * Math.PI * 2; for (let k = 0; k < 3; k++) m.line(12, 11.5, 12 + Math.cos(a + k * 2.09) * 4.5, 11.5 + Math.sin(a + k * 2.09) * 4.5, 'W'); m.poly([[12, 9], [14, 11.5], [12, 14], [10, 11.5]], 'V'); },
        // a dagger dripping, a gold glint on the blade
        bloodletter: (m, f) => { m.line(9, 16, 15, 6, 'T'); m.line(10, 16, 16, 6, 'W'); m.line(8, 14, 11, 17, 'O'); const y = 9 + (f % 8); if (y < 19) m.set(16, y, 'B'); if (f % 4 === 0) m.set(13, 9, 'Y'); },
        // a clover over a gold diamond
        fortunes_edge: (m, f) => { for (const [x, y] of [[10, 9], [14, 9], [10, 13], [14, 13]]) m.disc(x, y, 2.1, 'N'); m.line(12, 13, 14, 18, 'N'); m.poly([[12, 9], [14, 11], [12, 13], [10, 11]], f % 4 < 2 ? 'Y' : 'W'); },
        // a cracked shield with a sword driven up through it
        last_stand: (m, f) => { m.poly([[7, 7], [17, 7], [17, 12], [12, 17], [7, 12]], 'T'); m.line(9, 8, 11, 13, 'K'); m.line(15, 9, 13, 14, 'K'); m.line(12, 4, 12, 15, f % 2 ? 'W' : 'F'); m.rect(10, 13, 5, 1, 'O'); },
        // a skull leaking burn and chill to the side
        contagion: (m, f) => { m.disc(10, 11, 3.4, 'W'); m.rect(8, 13, 5, 2, 'W'); m.set(9, 11, 'K'); m.set(11, 11, 'K'); const k = f % 4; m.disc(14 + k, 9, 1.2, 'F'); m.disc(14 + ((k + 2) % 4), 14, 1.2, 'I'); },
        // a heart of stone that cracks and holds
        unbreakable: (m, f) => { m.disc(10, 10, 2.8, 'T'); m.disc(14, 10, 2.8, 'T'); m.poly([[7, 11], [17, 11], [12, 17]], 'T'); if (f >= 4) { m.line(12, 8, 11, 12, 'K'); m.line(11, 12, 13, 15, 'K'); } if (f === 4) m.disc(12, 11.5, 6, 'W'); m.set(10, 9, 'W'); },
        // two element orbs spiralling into one
        elemental_fusion: (m, f) => { const a = f / 8 * Math.PI * 2, r = 4.5 - (f % 8) * 0.3; m.disc(12 + Math.cos(a) * r, 11.5 + Math.sin(a) * r, 2, 'F'); m.disc(12 - Math.cos(a) * r, 11.5 - Math.sin(a) * r, 2, 'I'); m.disc(12, 11.5, f === 7 ? 2.6 : 1.2, f === 7 ? 'W' : 'V'); },
        // a set of scales tipping
        reckoning: (m, f) => { const t = [-2, -1, 0, 1, 2, 1, 0, -1][f]; m.rect(11, 6, 2, 11, 'T'); m.rect(9, 16, 6, 2, 'T'); m.line(7, 8 + t, 17, 8 - t, 'W'); m.disc(7, 12 + t, 1.8, 'B'); m.disc(17, 12 - t, 1.8, 'N'); },
    };
    static bookIcon(scene, r, build = null, id = null) {
        // A book in 3/4 view (24px, 4 frames): its cover in its rarity's material, the page edges
        // and spine, corner caps and a clasp, and its build's emblem on the front. A glint
        // sweeps the cover; from Epic up the emblem glows and pulses. r -1: a sealed one, chained shut.
        const COV = [
            { a: '#7a5234', b: '#a07048', d: '#4a301c', m: '#7a7a88', M: '#b8b8c8', e: '#d8c8a0', E: '#fff0c8' },   // common: worn leather, iron
            { a: '#2a5ab0', b: '#4a8ae0', d: '#1a3470', m: '#a8b8d0', M: '#eef4ff', e: '#c8e4ff', E: '#ffffff' },   // rare: blue cloth, silver
            { a: '#6a2ab0', b: '#9a5ae0', d: '#3a1468', m: '#d8a838', M: '#ffe088', e: '#e8c8ff', E: '#ffffff' },   // epic: purple velvet, gold
            { a: '#a8601a', b: '#e09a3a', d: '#5a300a', m: '#ffd860', M: '#fff6c0', e: '#fff0a0', E: '#ffffff' },   // legendary: amber, gold filigree
            { a: '#a01a2a', b: '#e04a4a', d: '#500a14', m: '#ffd860', M: '#fff6c0', e: '#ffb0b0', E: '#ffffff' },   // mythic: crimson, gold, runes
        ];
        const EMB = {   // the build's emblem, drawn around (12, 12)
            CRIT:    m => { m.poly([[7, 12], [12, 9], [17, 12], [12, 15]], 'e'); m.disc(12, 12, 1.6, 'd'); m.set(12, 11, 'E'); },
            HUNTER:  m => { m.disc(12, 11, 3.2, 'e'); m.rect(10, 13, 5, 2, 'e'); m.set(11, 11, 'd'); m.set(13, 11, 'd'); m.set(12, 14, 'd'); },
            BURN:    m => { m.poly([[12, 5], [15, 10], [15.5, 14], [13.5, 17], [10.5, 17], [8.5, 14], [9, 10], [11, 11]], 'e'); m.poly([[12, 10], [14, 14], [12.5, 16.5], [11, 16.5], [10, 14]], 'E'); },
            FROST:   m => { for (const [dx, dy] of [[0, 1], [1, 0], [1, 1], [1, -1]]) m.line(12 - dx * 4, 12 - dy * 4, 12 + dx * 4, 12 + dy * 4, dx && dy ? 'e' : 'E'); },
            STORM:   m => { m.poly([[13, 7], [9, 13], [12, 13], [10, 17], [15, 11], [12, 11]], 'e'); m.line(12, 8, 10, 12, 'E'); },
            AIM:     m => { m.ring(12, 12, 4, 1, 'e'); m.line(12, 7, 12, 17, 'e'); m.line(7, 12, 17, 12, 'e'); m.set(12, 12, 'E'); },
            ULT:     m => { m.poly([[12, 7], [16, 11], [12, 17], [8, 11]], 'e'); m.poly([[12, 8], [14, 11], [12, 14], [10, 11]], 'E'); },
            SUSTAIN: m => { m.disc(10.5, 11, 2.2, 'e'); m.disc(13.5, 11, 2.2, 'e'); m.poly([[8.4, 11.6], [15.6, 11.6], [12, 16]], 'e'); m.set(10, 10, 'E'); },
            CROWD:   m => { for (let k = 0; k < 8; k++) { const t = k * Math.PI / 4; m.line(12, 12, 12 + Math.cos(t) * (k % 2 ? 3 : 5), 12 + Math.sin(t) * (k % 2 ? 3 : 5), 'e'); } m.disc(12, 12, 1.4, 'E'); },
        };
        const key = 'ench_book3_' + r + '_' + (id || build || 'none'), own = id && ShopScene.BOOK_EMB[id], F = own ? 8 : 4;
        const emb = (m, f) => own ? own(m, f) : (EMB[build] || EMB.CRIT)(m);   // the book's own animated emblem, else its build's
        if (r === 5) return ShopScene.icon(scene, key, 24, { ...ShopScene.BOOK_INK, a: '#1a0a24', b: '#3a1a4a', d: '#0a0410', p: '#2a1a3a', P: '#140a1c', e: '#7aff5a', E: '#c8ffb8', m: '#ff3aa0', g: '#c8ffb8' }, (m, f) => {
            // corrupted: a black book with its emblem burning green, the art itself tearing apart
            m.rect(5, 3, 15, 18, 'a'); m.rect(5, 3, 3, 18, 'd'); m.rect(19, 4, 2, 16, 'p'); m.rect(7, 20, 13, 1, 'P');
            emb(m, f);
            const R = MenuArt.rng(91 + f * 7);
            for (let k = 0; k < 4; k++) { const y = 3 + Math.floor(R() * 18), dx = R() < 0.5 ? -1 : 1, row = []; for (let x = 0; x < 24; x++) row.push(m.get(x, y)); for (let x = 0; x < 24; x++) if (row[x] && row[x] !== '.') m.set(x + dx * (1 + (k % 2)), y, row[x]); }
            for (let k = 0; k < 7; k++) m.set(Math.floor(R() * 24), Math.floor(R() * 24), R() < 0.5 ? 'g' : 'm');
        }, F);
        const sealed = r < 0, C = COV[Math.max(0, r)];
        return ShopScene.icon(scene, key, 24, { ...ShopScene.BOOK_INK, ...C, p: '#f0e6cc', P: '#c8b890', s: '#6a6a78', S: '#a8a8b8', g: '#fffbe0', L: '#8a8aa0' }, (m, f) => {
            // the block of pages behind the cover, then the cover with its spine
            m.rect(7, 5, 14, 16, 'p'); for (let y = 6; y < 21; y += 2) m.line(19, y, 20, y, 'P'); m.rect(7, 20, 14, 1, 'P');
            m.rect(4, 3, 15, 17, 'a'); m.rect(4, 3, 3, 17, 'd'); m.line(6, 4, 6, 19, 'b'); m.rect(7, 3, 12, 1, 'b');
            for (const yy of [6, 16]) m.line(4, yy, 6, yy, 'm');   // bands on the spine
            if (Math.max(0, r) >= 1 || sealed) { for (const [x, y] of [[17, 3], [17, 18]]) { m.rect(x, y, 2, 2, 'm'); m.set(x + 1, y, 'M'); } }   // corner caps
            if (r >= 3) { for (let x = 8; x < 18; x += 2) { m.set(x, 4, 'm'); m.set(x, 18, 'm'); } for (let y = 5; y < 18; y += 2) m.set(17, y, 'm'); }   // filigree
            if (r === 4) { const t = f / F * Math.PI * 2; for (let k = 0; k < 4; k++) m.set(12 + Math.cos(t + k * 1.57) * 6, 11 + Math.sin(t + k * 1.57) * 6, 'g'); }   // mythic runes circling
            if (!sealed) emb(m, f);
            if (r >= 1 && !sealed) { m.rect(18, 10, 3, 3, 'm'); m.set(19, 11, r >= 2 ? 'E' : 'M'); }   // the clasp (a gem in it from Epic)
            if (r >= 2 && !sealed && !own && f % 2 === 0) { m.set(12, 8, 'g'); m.set(12, 16, 'g'); }   // the emblem's glow, pulsing
            // the glint sweeping the cover
            const gx = 6 + f * 4; for (let k = 0; k < 3; k++) { const x = gx + k, y = 4 + k * 2; if (m.get(x, y) && m.get(x, y) !== '.') m.set(x, y, 'g'); }
            if (sealed) {   // chained shut, a padlock on the front
                m.line(3, 7, 21, 15, 'S'); m.line(3, 15, 21, 7, 'S'); for (let k = 0; k < 6; k++) { m.set(5 + k * 3, 8 + k * 1.3, 's'); m.set(5 + k * 3, 14 - k * 1.3, 's'); }
                m.rect(10, 10, 5, 4, 'L'); m.ring(12.5, 10, 2, 1, 'S'); m.set(12, 12, 's'); m.set(11, 11, 'S');
            }
        }, F);
    }

    _buyStat(id) {
        const lvl = PlayerStats.level(id), cost = PlayerStats.cost(id, lvl), d = PlayerStats.DEFS[id];
        if (cost === null) { this.setGlurpDialogue(`"${d.name}'s mastered. Nothing left to teach you there."`); return; }
        const gate = PlayerStats.tierGate(id, lvl);
        if (gate) { Sfx.play(this, 'hurt'); this.setGlurpDialogue(`"Not so fast! Get the other two to ${gate} before you push ${d.name} further."`); return; }
        if (this.glorps < cost) { Sfx.play(this, 'hurt'); this.setGlurpDialogue(`"${cost - this.glorps} more glorps and we'll train ${d.name}."`); return; }
        this.glorps -= cost;
        localStorage.setItem('glorps', this.glorps);
        PlayerStats.setLevel(id, lvl + 1);
        this._refreshCurrency();
        Sfx.play(this, 'pickup');
        const t = PlayerStats.TALENTS[id].find(t => t.at === lvl + 1);
        this.setGlurpDialogue(t ? `"${d.name} ${lvl + 1}! You've earned ${t.name}!"` : `"${d.name} ${lvl + 1}! ${PlayerStats.describe(id, lvl + 1)}."`);
        if (t) Sfx.play(this, 'ult');
        this.time.delayedCall(0, () => { if (this._shopTab === 1) this._showStatsTab({ id, lvl: lvl + 1 }); });
    }

    // A stat's emblem, drawn in graphics: a sword (damage), a heart (health), a shield (armor).
    _statEmblem(g, id, cx, cy, acc) {
        const glow = MenuArt.mix(acc, 0x1b1612, 0.7), r = 40;
        g.fillStyle(glow, 1); g.fillCircle(cx, cy, r);
        g.lineStyle(2, acc, 0.6); g.strokeCircle(cx, cy, r);
        if (id === 'damage') {
            g.fillStyle(0xd8dce8, 1); g.fillTriangle(cx - 5, cy + 10, cx + 5, cy + 10, cx, cy - 30);
            g.fillStyle(0xffffff, 0.7); g.fillTriangle(cx - 1, cy + 8, cx + 1, cy + 8, cx, cy - 26);
            g.fillStyle(UIKit.PALETTE.brass, 1); g.fillRect(cx - 14, cy + 10, 28, 5);
            g.fillStyle(0x6a4a26, 1); g.fillRect(cx - 3, cy + 15, 6, 13);
            g.fillStyle(UIKit.PALETTE.brass, 1); g.fillCircle(cx, cy + 30, 4);
        } else if (id === 'health') {
            g.fillStyle(acc, 1); g.fillCircle(cx - 9, cy - 6, 12); g.fillCircle(cx + 9, cy - 6, 12);
            g.fillTriangle(cx - 20, cy - 1, cx + 20, cy - 1, cx, cy + 24);
            g.fillStyle(0xffffff, 0.45); g.fillCircle(cx - 12, cy - 10, 4);
        } else {
            const pts = [{ x: cx - 22, y: cy - 22 }, { x: cx + 22, y: cy - 22 }, { x: cx + 22, y: cy }, { x: cx, y: cy + 26 }, { x: cx - 22, y: cy }];
            g.fillStyle(UIKit.PALETTE.ironHi, 1); g.fillPoints(pts, true);
            g.fillStyle(acc, 1); g.fillRect(cx - 3, cy - 18, 6, 36); g.fillRect(cx - 18, cy - 8, 36, 6);
            g.lineStyle(2, 0x1b1612, 1); g.strokePoints(pts, true);
        }
    }

    // Equip, buy and upgrade all redraw in place on the next tick: never inside the click
    // that caused them, which would destroy the button Phaser is still dispatching to.
    equip(w, el) {
        localStorage.setItem('equip_' + el, w.id);
        this.equipped[el] = w.id;
        this.time.delayedCall(0, () => {
            this._refreshStall?.();
            this.setGlurpDialogue('"Nice choice! ' + w.name + ' equipped!"');
        });
    }

    buy(w, card, bg, el) {
        if (w.unlocked) { this.setGlurpDialogue('"You already own the ' + w.name + '!"'); return; }
        if (this.glorps < w.cost) {
            this.setGlurpDialogue('"Not enough! Need ' + (w.cost - this.glorps) + ' more!"');
            return;
        }
        this.glorps -= w.cost;
        localStorage.setItem('glorps', this.glorps);
        const arr = JSON.parse(localStorage.getItem('unlockedWeapons') || '[]');
        if (!arr.includes(w.id)) { arr.push(w.id); localStorage.setItem('unlockedWeapons', JSON.stringify(arr)); }
        localStorage.setItem('equip_' + el, w.id);   // auto-equip on purchase
        this.equipped[el] = w.id;
        w.unlocked = true;
        this._refreshCurrency();
        this.setGlurpDialogue('"Sold! Enjoy your ' + w.name + '!"');
        // Coins burst off the turntable, then the stall rebuilds with the weapon owned.
        Sfx.play(this, 'pickup');
        const L = this._layout;
        if (L && this.textures.exists('mn_px2')) {
            const p = this.add.particles(L.S.cx, L.CT - 60, 'mn_px2', {
                speed: { min: 120, max: 320 }, angle: { min: 200, max: 340 }, gravityY: 600, lifespan: 900,
                scale: { start: 3, end: 1 }, tint: [0xf0b84a, 0xffe08a, 0xc89a4a], emitting: false,
            }).setDepth(30);
            p.explode(40);
        }
        this.time.delayedCall(0, () => {
            this._refreshStall?.();
            this.setGlurpDialogue('"Sold! Enjoy your ' + w.name + '!"');
        });
    }

    buyUltUpgrade(ultKey, stageNum, fragCost, glorpCost) {
        if (this.glorps < glorpCost) { this.setGlurpDialogue('"Not enough glorps!"'); return; }
        if (this.fragments < fragCost) { this.setGlurpDialogue('"Not enough fragments!"'); return; }
        this.glorps -= glorpCost;
        this.fragments -= fragCost;
        localStorage.setItem('glorps', this.glorps);
        localStorage.setItem('ultFragments', this.fragments);
        localStorage.setItem('ultStage_' + ultKey, stageNum);
        this._refreshCurrency();
        Sfx.play(this, 'pickup');
        this.setGlurpDialogue('"Stage ' + stageNum + ' unlocked! Nice!"');
        this.time.delayedCall(0, () => this._showUltTab({ bought: ultKey }));
    }

    // Both purses, from the live values.
    _refreshCurrency() {
        if (this._glorpPill)    this._glorpPill.setLabel(this.glorps.toLocaleString('en-US') + ' Glorps');
        if (this._fragmentPill) this._fragmentPill.setLabel(this.fragments.toLocaleString('en-US') + ' Fragments');
    }

    setGlurpDialogue(text) { if (this.glurpDialogue) this.glurpDialogue.setText(text); }

    // ── SHARED STALL PIECES ──────────────────────────────────────────────────
    // The display on the counter: a spotlight from the beam, dust in it, a brass turntable,
    // and the item above it turning (scaleX swinging through zero reads as a spin) and bobbing.
    // Click it to stop it face-on, again to set it going; a new item always arrives turning,
    // dropped in from the side you paged toward. `anim`: the icon is an animated sheet.
    _turntable(acc, key, { anim = false, dim = false, fromDir = 0, scale = 5.5, x = null } = {}) {
        // x: off-centre (the relic case's stand)
        const S = this._layout.S, TT = x == null ? this._layout.TT : { ...this._layout.TT, x }, objs = [], keep = o => { objs.push(o); return o; };
        scale *= Math.min(1.3, this._layout.UI || 1);
        const sp = keep(this.add.graphics().setDepth(4).setBlendMode(Phaser.BlendModes.ADD));
        for (const [wTop, wBot, a] of [[30, 150, 0.05], [22, 110, 0.06], [12, 70, 0.07]]) {
            sp.fillStyle(MenuArt.mix(acc, 0xffffff, 0.5), a);
            sp.fillPoints([{ x: TT.x - wTop, y: S.beam }, { x: TT.x + wTop, y: S.beam }, { x: TT.x + wBot, y: TT.y }, { x: TT.x - wBot, y: TT.y }], true);
        }
        keep(this.add.particles(0, 0, 'mn_px2', {
            x: { min: TT.x - 60, max: TT.x + 60 }, y: { min: S.beam + 40, max: TT.y - 20 }, lifespan: 2400,
            speedY: { min: -8, max: 8 }, speedX: { min: -6, max: 6 }, scale: { start: 1.2, end: 0 }, alpha: { start: 0.6, end: 0 },
            tint: MenuArt.mix(acc, 0xffffff, 0.6), blendMode: 'ADD', frequency: 140,
        }).setDepth(4));
        const tt = keep(this.add.graphics().setDepth(7));
        tt.fillStyle(0x000000, 0.5); tt.fillEllipse(TT.x + 3, TT.y + 6, 200, 36);
        tt.fillStyle(0x6a4a20, 1); tt.fillEllipse(TT.x, TT.y + 4, 196, 34);
        tt.fillStyle(UIKit.PALETTE.brass, 1); tt.fillEllipse(TT.x, TT.y, 190, 30);
        tt.fillStyle(MenuArt.mix(acc, 0x1b1612, 0.5), 1); tt.fillEllipse(TT.x, TT.y - 1, 160, 22);
        tt.lineStyle(2, acc, 0.9); tt.strokeEllipse(TT.x, TT.y - 1, 160, 22);
        const glow = keep(this.add.image(TT.x, TT.y - 90, 'mn_glow').setTint(acc).setBlendMode(Phaser.BlendModes.ADD).setDisplaySize(260, 220).setAlpha(0.55).setDepth(7));
        this.tweens.add({ targets: glow, alpha: 0.8, duration: 1600, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
        if (!key) return objs;
        const SC = scale, iy = TT.y - 82;
        const icon = keep(this.add.sprite(TT.x, iy, key, anim ? '0' : undefined).setScale(SC).setDepth(8));
        if (anim) icon.play(key);
        if (dim) icon.setTint(0xb0a090);
        const spin = this.tweens.add({ targets: icon, scaleX: -SC, duration: 1600, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
        icon.setInteractive({ useHandCursor: true });
        icon.on('pointerdown', () => {
            if (spin.isPlaying()) { spin.pause(); this.tweens.add({ targets: icon, scaleX: SC, duration: 220, ease: 'Back.easeOut' }); }
            else { spin.restart(); spin.resume(); }   // from face-on, where it stopped
            Sfx.play(this, 'hover');
        });
        // drops in, then floats. The float starts once it has landed: run together, the two
        // tweens fought over y and the item snapped down and back up.
        icon.setAlpha(0).setY(iy - 24).setX(TT.x + fromDir * 60);
        this.tweens.add({ targets: icon, alpha: 1, y: iy, x: TT.x, duration: 320, ease: 'Cubic.easeOut',
            onComplete: () => icon.active && this.tweens.add({ targets: icon, y: iy - 8, duration: 1300, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' }) });
        return objs;
    }

    // The striped awning over the stall in colour `acc`, with `banners` hanging from its beam:
    // [{ label, icon (texture key) | glyph, on, onClick }]. Returns its objects.
    _awning(acc, banners = []) {
        const { S } = this._layout, objs = [], keep = o => { objs.push(o); return o; };
        const aw = S.x1 - S.x0 + 40, ah = S.beam - S.top;
        keep(this.add.image(S.x0 - 20, S.top, ShopScene.awningTex(this, aw, ah, acc)).setOrigin(0).setScale(2).setDepth(9));
        const g = keep(this.add.graphics().setDepth(9.1));
        this._plank(g, S.x0 - 26, S.top - 10, S.x1 - S.x0 + 52, 14, 0x4a3018);
        const span = S.x1 - S.x0 - 80, n = banners.length;
        banners.forEach((bn, i) => {
            const x = S.x0 + 40 + span * (i + 0.5) / n, top = S.beam + 22, bh = bn.on ? 74 : 58, bw = bn.label ? 62 : 54, col = bn.col ?? acc;
            const b = keep(this.add.graphics().setDepth(9));
            b.lineStyle(2, 0x2a2a34, 1); b.lineBetween(x - bw / 2 + 6, S.beam + 8, x - bw / 2 + 6, top); b.lineBetween(x + bw / 2 - 6, S.beam + 8, x + bw / 2 - 6, top);
            b.fillStyle(0x000000, 0.35); b.fillRect(x - bw / 2 + 3, top + 3, bw, bh - 6);
            keep(this.add.image(x - bw / 2, top, ShopScene.bannerTex(this, bw, bh, col, bn.on)).setOrigin(0).setScale(2).setDepth(9));
            this._plank(b, x - bw / 2 - 5, top - 5, bw + 10, 8, 0x4a3018);
            if (bn.label) keep(this.add.text(x, top + 15, bn.label, { fontSize: '13px', fontFamily: UIKit.FONT.title, fontStyle: 'bold', color: bn.on ? '#f6d58a' : '#d2bf98', stroke: '#1b1612', strokeThickness: 3 }).setOrigin(0.5).setDepth(9.2));
            const iy = bn.label ? top + (bh - 14) / 2 + 10 : top + (bh - 14) / 2;
            if (bn.icon) keep(this.add.sprite(x, iy, bn.icon, '0').setScale(bn.iconScale || 1.15).setDepth(9.2).setAlpha(bn.on ? 1 : 0.75)).play(bn.icon);
            else keep(this.add.text(x, iy, bn.glyph || '—', { fontSize: bn.label ? '15px' : bn.on ? '24px' : '18px', fontFamily: bn.label ? 'monospace' : undefined, color: bn.label ? '#d2bf98' : '#ffffff', stroke: '#1b1612', strokeThickness: 3 }).setOrigin(0.5).setDepth(9.2).setAlpha(bn.on || bn.label ? 1 : 0.65));
            if (bn.on && !bn.label) this.tweens.add({ targets: objs[objs.length - 1], y: iy - 2, duration: 900, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
            if (bn.onClick) keep(this.add.zone(x, top + bh / 2, bw + 8, bh).setInteractive({ useHandCursor: true }).setDepth(12)).on('pointerdown', bn.onClick);
        });
        return objs;
    }

    // The parchment tag hanging from the awning on a string, as a graphics to draw on.
    _tagSheet(T, keep, D) {
        const g = keep(this.add.graphics().setDepth(D));
        g.lineStyle(2, 0x8a6a40, 1); g.lineBetween(T.x + T.w / 2, T.y - 14, T.x + T.w / 2, T.y + 10);
        g.fillStyle(UIKit.PALETTE.iron, 1); g.fillCircle(T.x + T.w / 2, T.y - 14, 4);
        g.fillStyle(0x000000, 0.45); g.fillRect(T.x + 5, T.y + 7, T.w, T.h);
        g.fillStyle(0xe2cfa4, 1); g.fillRect(T.x, T.y, T.w, T.h);
        g.fillStyle(0xd0b98a, 0.5); g.fillCircle(T.x + T.w * 0.8, T.y + T.h * 0.7, 60); g.fillCircle(T.x + T.w * 0.2, T.y + T.h * 0.3, 40);
        g.lineStyle(2, 0x6a4a26, 1); g.strokeRect(T.x, T.y, T.w, T.h);
        g.lineStyle(1, 0x6a4a26, 0.5); g.strokeRect(T.x + 6, T.y + 6, T.w - 12, T.h - 12);
        g.fillStyle(0x6a4a26, 1); g.fillCircle(T.x + T.w / 2, T.y + 14, 6); g.fillStyle(0x1b1612, 1); g.fillCircle(T.x + T.w / 2, T.y + 14, 3);
        return g;
    }

    // A small pixel icon, painted once into a texture: `draw(m, f)` fills an N×N grid of
    // palette letters for frame f (m.set / rect / disc / ring / line / poly); every empty pixel
    // touching a filled one becomes the house outline, so the shapes read as sprites rather
    // than vector art. With `frames` > 1 it's a strip (frames '0'..) and an animation of the
    // same key (6 fps), like the weapon icons.
    static icon(scene, key, N, pal, draw, frames = 1) {
        if (!scene.textures.exists(key)) {
            const t = scene.textures.createCanvas(key, N * frames, N), ctx = t.getContext();
            const P = { k: '#1c1728', W: '#ffffff', ...pal };
            for (let f = 0; f < frames; f++) {
                const grid = Array.from({ length: N }, () => new Array(N).fill('.'));
                const m = {
                    set(x, y, c) { x = Math.round(x); y = Math.round(y); if (x >= 0 && y >= 0 && x < N && y < N) grid[y][x] = c; },
                    rect(x, y, w, h, c) { for (let j = y; j < y + h; j++) for (let i = x; i < x + w; i++) m.set(i, j, c); },
                    disc(cx, cy, r, c) { for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) if ((x + 0.5 - cx) ** 2 + (y + 0.5 - cy) ** 2 <= r * r) m.set(x, y, c); },
                    ring(cx, cy, r, w, c) { for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) { const d = Math.hypot(x + 0.5 - cx, y + 0.5 - cy); if (d <= r && d >= r - w) m.set(x, y, c); } },
                    line(x0, y0, x1, y1, c) { const n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0), 1); for (let k = 0; k <= n; k++) m.set(x0 + (x1 - x0) * k / n, y0 + (y1 - y0) * k / n, c); },
                    poly(pts, c) {
                        for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
                            let inside = false;
                            for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
                                const [xi, yi] = pts[i], [xj, yj] = pts[j];
                                if ((yi > y + 0.5) !== (yj > y + 0.5) && x + 0.5 < (xj - xi) * (y + 0.5 - yi) / (yj - yi) + xi) inside = !inside;
                            }
                            if (inside) m.set(x, y, c);
                        }
                    },
                    get: (x, y) => grid[y]?.[x],
                };
                draw(m, f);
                const out = grid.map(r => r.slice());
                for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
                    if (grid[y][x] !== '.') continue;
                    if ([[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => grid[y + dy]?.[x + dx] && grid[y + dy][x + dx] !== '.' && grid[y + dy][x + dx] !== 'g'))
                        out[y][x] = 'k';
                }
                for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
                    const c = out[y][x];
                    if (c === '.') continue;
                    ctx.fillStyle = P[c] || '#ff00ff'; ctx.fillRect(f * N + x, y, 1, 1);
                }
                t.add(String(f), 0, f * N, 0, N, N);
            }
            t.refresh();
        }
        if (frames > 1 && !scene.anims.exists(key)) {
            scene.anims.create({ key, frames: Array.from({ length: frames }, (_, f) => ({ key, frame: String(f) })), frameRate: 6, repeat: -1 });
        }
        return key;
    }

    // A gadget's icon: 24px, four frames, each one doing what the gadget does. ('g' is a glow
    // pixel: it gets no outline, so sparks and rings float free of the shape.)
    static gadgetIcon(scene, id) {
        const ART = {
            // a brass canister, its bolt crackling behind a glass window, sparks round the cap
            smite: [{ B: '#d8a848', b: '#8a6420', I: '#5e574e', i: '#9aa1bc', G: '#2a3a5a', W: '#fffbd0', Y: '#ffe14a', g: '#fff6b0' }, (m, f) => {
                m.rect(7, 9, 10, 12, 'B'); m.rect(14, 9, 3, 12, 'b'); m.rect(7, 12, 10, 1, 'b'); m.rect(7, 18, 10, 1, 'b');
                m.rect(9, 5, 6, 4, 'I'); m.rect(10, 5, 2, 1, 'i'); m.rect(11, 3, 2, 2, 'I');
                m.disc(12, 15.5, 3.4, 'G');
                const bolts = [[[13, 13], [11, 15], [13, 16], [11, 18]], [[11, 13], [13, 15], [11, 16], [13, 18]]][f % 2];
                for (let k = 0; k + 1 < bolts.length; k++) m.line(bolts[k][0], bolts[k][1], bolts[k + 1][0], bolts[k + 1][1], 'W');
                const sp = [[[6, 4], [18, 6], [4, 9]], [[17, 3], [5, 6], [19, 9]], [[7, 2], [19, 4], [5, 8]], [[16, 2], [4, 4], [18, 8]]][f];
                for (const [x, y] of sp) { m.set(x, y, 'g'); m.set(x + 1, y, 'Y'); }
            }],
            // a copper coil wound round a stem, a glowing orb on top, a pulse rolling outward
            emp: [{ C: '#c87a3a', c: '#7a4a20', I: '#5e574e', B: '#66ddff', b: '#2a7a9a', W: '#e8fbff', g: '#9fe8ff' }, (m, f) => {
                m.ring(12, 12, 6 + f * 1.6, 1, 'g');
                m.rect(9, 19, 6, 3, 'I'); m.rect(11, 9, 2, 10, 'I');
                for (let y = 11; y < 19; y += 2) { m.rect(8, y, 8, 1, 'C'); m.set(15, y, 'c'); m.rect(9, y + 1, 6, 1, 'c'); }
                m.disc(12, 7, 3.5, 'b'); m.disc(12, 7, 2.6, 'B'); m.set(11, 6, 'W');
            }],
            // a hand-held portal: a brass rim, the inside a spiral turning
            displacer: [{ Y: '#d8a848', y: '#8a6420', P: '#aa66ff', p: '#3a1d5c', L: '#e0c8ff', g: '#c99bff' }, (m, f) => {
                m.disc(12, 11, 8.5, 'Y'); m.disc(12, 11, 7, 'p');
                for (let k = 0; k < 18; k++) {
                    const t = k / 18, a = t * Math.PI * 3 + f * Math.PI / 2, r = 1 + t * 5.5;
                    m.set(12 + Math.cos(a) * r, 11 + Math.sin(a) * r, k % 3 ? 'P' : 'L');
                }
                m.rect(10, 19, 4, 4, 'y'); m.rect(11, 19, 2, 4, 'Y');
                m.set(12 + Math.cos(f * 1.6) * 10, 11 + Math.sin(f * 1.6) * 10, 'g');
            }],
            // an iron stake, rune bands lighting in turn, sparks running into cracked ground
            grounding: [{ S: '#9aa1bc', s: '#5e574e', G: '#66ffcc', d: '#2a5a4a', E: '#6a4a26', e: '#3b2716', g: '#9fffe0' }, (m, f) => {
                m.rect(4, 19, 16, 3, 'E'); m.rect(4, 21, 16, 1, 'e');
                m.line(8, 20, 6, 22, 'e'); m.line(16, 20, 18, 22, 'e');
                m.rect(11, 2, 3, 17, 'S'); m.rect(13, 2, 1, 17, 's'); m.poly([[11, 18], [14, 18], [12.5, 21]], 'S');
                m.rect(9, 2, 7, 2, 's');
                for (let k = 0; k < 4; k++) m.rect(10, 6 + k * 3, 5, 1, k === f ? 'G' : 'd');
                m.set(7 + f, 21, 'g'); m.set(17 - f, 21, 'g');
            }],
            // a carved totem with a face, a leaf crown, a heart gem that beats, motes rising
            mend: [{ T: '#9a6a3a', t: '#5a3a20', L: '#7fd06a', l: '#3a7a2a', H: '#ff6a7a', h: '#a02a3a', g: '#c8ffb0' }, (m, f) => {
                m.rect(8, 7, 8, 15, 'T'); m.rect(14, 7, 2, 15, 't');
                m.rect(9, 9, 2, 2, 't'); m.rect(13, 9, 2, 2, 't'); m.rect(10, 12, 4, 1, 't');
                m.poly([[7, 7], [12, 1], [17, 7]], 'L'); m.line(12, 2, 12, 6, 'l');
                const r = f % 2 ? 2.6 : 2.1;
                m.disc(10.8, 16, r * 0.8, 'H'); m.disc(13.2, 16, r * 0.8, 'H'); m.poly([[8.5, 16.4], [15.5, 16.4], [12, 20]], 'H'); m.set(14, 17, 'h');
                m.set(5, 14 - f * 3, 'g'); m.set(19, 18 - f * 3, 'g'); m.set(18, 8 - f, 'g');
            }],
            // a pink puppet of you on a stick, a target painted on it, wobbling to draw the eye
            decoy: [{ P: '#ff9ad0', p: '#c05a90', W: '#ffffff', R: '#ff4a6a', T: '#8a5a30', t: '#5a3a20', g: '#ffd0e8' }, (m, f) => {
                const wob = [0, 1, 0, -1][f];
                m.rect(11, 15, 2, 8, 'T'); m.rect(12, 15, 1, 8, 't'); m.rect(8, 21, 8, 2, 't');
                m.disc(12 + wob, 10, 6.5, 'P'); m.rect(5 + wob, 10, 14, 5, 'P'); m.rect(5 + wob, 14, 14, 1, 'p');
                m.ring(12 + wob, 10, 4.5, 1, 'R'); m.disc(12 + wob, 10, 1.6, 'R');
                m.set(9 + wob, 7, 'W'); m.set(15 + wob, 7, 'W');
                m.set(3, 6 - f % 2, 'g'); m.set(20, 5 + f % 2, 'g');
            }],
            // an iron-banded stone block, battlements on top, a rune on its face pulsing
            bulwark: [{ S: '#8a7a5e', s: '#5a4a36', L: '#b0a080', I: '#5e574e', R: '#ffd060', r: '#8a6420' }, (m, f) => {
                m.rect(3, 7, 18, 15, 'S'); m.rect(3, 7, 18, 1, 'L');
                for (const x of [3, 8, 13, 18]) m.rect(x, 4, 3, 3, 'S');
                for (const y of [11, 16]) m.rect(3, y, 18, 1, 's');
                for (const [x, y] of [[8, 8], [15, 8], [5, 12], [11, 12], [18, 12], [8, 17], [15, 17]]) m.rect(x, y, 1, 3, 's');
                m.rect(3, 9, 18, 1, 'I'); m.rect(3, 19, 18, 1, 'I');
                const c = f === 1 || f === 2 ? 'R' : 'r';
                m.line(10, 12, 14, 12, c); m.line(12, 11, 12, 16, c); m.line(10, 16, 14, 16, c);
            }],
        };
        const a = ART[id];
        return a ? ShopScene.icon(scene, 'shop_g2_' + id, 24, a[0], a[1], 4) : null;
    }

    // An ult stage's relic: a different object per element, growing grander each stage.
    //   fire       I Ember Shard      II in a gold brazier, flames licking   III Phoenix Heart, flame wings
    //   ice        I Frost Shard      II Snowflake Lattice                   III Glacier Crown, flakes orbiting
    //   lightning  I Storm Shard      II on a Tesla coil, arcing             III Thunder Orb, ringed in bolts
    //   cosmic     I Star Shard       II in a ringed orbit                   III Event Crown, a black hole
    static relicIcon(scene, el, stage) {
        const PAL = {
            fire:      { E: '#ff8a3c', L: '#ffd08a', D: '#a03a10', F: '#ffe14a', f: '#ff5a1a', Y: '#f0b84a', y: '#8a6420', g: '#ffd08a' },
            ice:       { E: '#6cc8f0', L: '#e0f6ff', D: '#2a5a8a', F: '#ffffff', f: '#9fdcff', Y: '#c8d8f0', y: '#6a7a9a', g: '#d8f2ff' },
            lightning: { E: '#f0d040', L: '#fff6b0', D: '#8a6a10', F: '#ffffff', f: '#9fd8ff', Y: '#c87a3a', y: '#7a4a20', g: '#fff6b0' },
            cosmic:    { E: '#b48cf0', L: '#f0e0ff', D: '#4a2a8a', F: '#ffd060', f: '#ff8ce0', Y: '#d8a848', y: '#8a6420', g: '#e2c8ff', K: '#05020a' },
        }[el];
        const shard = (m, cx, cy, h, w) => {           // a faceted crystal, light on the left
            if (stage === 1) { cy -= 1; h += 2; w += 1; m.rect(8, 19, 8, 2, 'y'); m.rect(7, 21, 10, 2, 'y'); m.rect(8, 21, 8, 1, 'Y'); }   // bare: bigger, on a stone
            m.poly([[cx, cy - h], [cx + w, cy], [cx, cy + h], [cx - w, cy]], 'E');
            m.poly([[cx, cy - h], [cx, cy + h], [cx - w, cy]], 'L');
            m.poly([[cx, cy], [cx + w, cy], [cx, cy + h]], 'D');
        };
        const D = {
            fire: (m, f) => {
                if (stage >= 3) for (const s of [-1, 1]) {      // the wings: feathers of flame
                    for (let k = 0; k < 4; k++) m.line(12 + s * 4, 12, 12 + s * (8 + k), 5 + k * 2 + (f % 2), k % 2 ? 'f' : 'F');
                }
                if (stage >= 2) { m.poly([[5, 16], [19, 16], [16, 21], [8, 21]], 'Y'); m.rect(8, 20, 8, 1, 'y'); m.rect(10, 21, 4, 2, 'y'); }
                shard(m, 12, 11, 6, 3.5);
                const fl = [[[12, 3], [11, 1]], [[12, 3], [13, 1]], [[12, 3], [12, 0]], [[12, 3], [11, 2]]][f];
                m.line(fl[0][0], fl[0][1], fl[1][0], fl[1][1], 'F');
                if (stage >= 2) { m.set(7 + f % 2, 14, 'f'); m.set(16 - f % 2, 14, 'f'); m.set(9, 13 - f % 2, 'F'); m.set(15, 13 - (f + 1) % 2, 'F'); }
                if (stage >= 3) m.poly([[10, 2], [12, -1], [14, 2]], 'F');
            },
            ice: (m, f) => {
                if (stage >= 2) for (let k = 0; k < 6; k++) {   // the lattice: six arms with barbs
                    const a = k / 6 * Math.PI * 2, x1 = 12 + Math.cos(a) * 10, y1 = 12 + Math.sin(a) * 10;
                    m.line(12, 12, x1, y1, 'Y');
                    const bx = 12 + Math.cos(a) * 7, by = 12 + Math.sin(a) * 7;
                    m.line(bx, by, bx + Math.cos(a + 1) * 2, by + Math.sin(a + 1) * 2, 'Y'); m.line(bx, by, bx + Math.cos(a - 1) * 2, by + Math.sin(a - 1) * 2, 'Y');
                }
                shard(m, 12, 12, 6, 3.5);
                if (stage >= 3) {
                    m.rect(7, 2, 11, 2, 'f'); for (const x of [7, 10, 12, 14, 17]) m.rect(x, 0, 1, 2, 'F');
                    for (let k = 0; k < 3; k++) { const a = f * Math.PI / 6 + k * Math.PI * 2 / 3; m.set(12 + Math.cos(a) * 10.5, 13 + Math.sin(a) * 9, 'g'); }
                }
                m.set(10 + f % 2, 9, 'F');
            },
            lightning: (m, f) => {
                if (stage >= 2) {                                 // the coil underneath
                    m.rect(9, 18, 6, 4, 'y'); for (let y = 14; y < 19; y += 2) { m.rect(8, y, 8, 1, 'Y'); m.rect(9, y + 1, 6, 1, 'y'); }
                }
                if (stage >= 3) m.ring(12, 10, 10, 1, 'g');
                if (stage === 1) { m.rect(8, 18, 8, 2, 'y'); m.rect(7, 20, 10, 2, 'y'); }
                m.poly([[13, 2], [16, 8], [13, 9], [15, 16], [9, 8], [12, 8], [10, 2]], 'E');
                m.poly([[10, 2], [13, 2], [12, 8], [9, 8]], 'L'); m.poly([[13, 9], [15, 16], [12, 9]], 'D');
                const arcs = [[[5, 6], [3, 10]], [[19, 6], [21, 10]], [[4, 12], [6, 15]], [[20, 12], [18, 15]]];
                if (stage >= 2) { const [p0, p1] = arcs[f]; m.line(p0[0], p0[1], p1[0], p1[1], 'F'); }
                if (stage >= 3) for (let k = 0; k < 4; k++) { const a = f * 0.4 + k * Math.PI / 2; m.line(12 + Math.cos(a) * 8, 10 + Math.sin(a) * 8, 12 + Math.cos(a + 0.3) * 11, 10 + Math.sin(a + 0.3) * 11, 'F'); }
            },
            cosmic: (m, f) => {
                if (stage >= 3) {                                 // the event crown: a black core in its disk
                    for (let k = 0; k < 28; k++) { const a = k / 28 * Math.PI * 2 + f * 0.3; m.set(12 + Math.cos(a) * 10, 12 + Math.sin(a) * 4, k % 2 ? 'E' : 'L'); }
                    m.disc(12, 12, 4.5, 'L'); m.disc(12, 12, 3.5, 'K');
                    m.rect(8, 3, 9, 2, 'F'); for (const x of [8, 12, 16]) m.rect(x, 1, 1, 2, 'F');
                    for (let k = 0; k < 28; k++) { const a = k / 28 * Math.PI * 2 + f * 0.3; if (Math.sin(a) > 0) m.set(12 + Math.cos(a) * 10, 12 + Math.sin(a) * 4, k % 2 ? 'E' : 'L'); }
                    return;
                }
                if (stage >= 2) m.ring(12, 12, 10, 1, 'Y');
                shard(m, 12, 12, 6, 3.5);
                if (stage >= 2) { const a = f * Math.PI / 2; m.disc(12 + Math.cos(a) * 9.5, 12 + Math.sin(a) * 9.5, 1.4, 'f'); }
                const tw = [[5, 5], [18, 6], [6, 18], [18, 17]][f]; m.set(tw[0], tw[1], 'g'); m.set(tw[0] + 1, tw[1], 'F');
            },
        };
        return ShopScene.icon(scene, `shop_u3_${el}_${stage}`, 24, PAL, D[el], 4);
    }

    // ── GADGET STALL ─────────────────────────────────────────────────────────
    // The shelf holds every gadget (locked ones in shadow, with a price tag); the one you
    // pick turns on the counter; the two banners are your kit (Q and F; click one to choose
    // which you're filling); the tag says what it does and does the unlocking and slotting.
    // The stats live in FieldKit and are read through these proxies, never copied here.
    _fkCfg(...a)           { return FieldKit.prototype._fkCfg.call(this, ...a); }
    _gadgetDefs(...a)      { return FieldKit.prototype._gadgetDefs.call(this, ...a); }
    _gadgetOrder(...a)     { return FieldKit.prototype._gadgetOrder.call(this, ...a); }
    _unlockStoreKey(...a)  { return FieldKit.prototype._unlockStoreKey.call(this, ...a); }
    unlockedGadgets(...a)  { return FieldKit.prototype.unlockedGadgets.call(this, ...a); }
    gadgetUnlocked(...a)   { return FieldKit.prototype.gadgetUnlocked.call(this, ...a); }
    unlockGadget(...a)     { return FieldKit.prototype.unlockGadget.call(this, ...a); }
    gadgetLoadout(...a)    { return FieldKit.prototype.gadgetLoadout.call(this, ...a); }
    setGadgetSlot(...a)    { return FieldKit.prototype.setGadgetSlot.call(this, ...a); }

    _showGadgetTab(fromDir = 0) {
        this._hideGadgetTab();
        const L = this._layout, D = 8, objs = [], keep = o => { objs.push(o); return o; };
        const defs = this._gadgetDefs(), order = this._gadgetOrder(), lo = this.gadgetLoadout();
        if (this._gadgetSlot === undefined) this._gadgetSlot = lo[0] && !lo[1] ? 1 : 0;
        this._gadgetSel = Phaser.Math.Clamp(this._gadgetSel ?? 0, 0, order.length - 1);
        const id = order[this._gadgetSel], def = defs[id], owned = this.gadgetUnlocked(id), slot = lo.indexOf(id);
        const acc = UIKit.PALETTE.brass;

        // the kit, as the two banners
        this._awning(acc, [0, 1].map(i => ({ label: i ? 'F' : 'Q', on: this._gadgetSlot === i,
            icon: lo[i] ? ShopScene.gadgetIcon(this, lo[i]) : null, glyph: 'empty',
            onClick: () => this._gadgetPickSlot(i) }))).forEach(o => objs.push(o));

        // the shelf
        const span = L.S.x1 - L.S.x0 - 120;
        order.forEach((gid, k) => {
            const x = L.S.x0 + 60 + span * (k / (order.length - 1)), d = defs[gid], got = this.gadgetUnlocked(gid), on = k === this._gadgetSel;
            const gk = ShopScene.gadgetIcon(this, gid);
            const ic = keep(this.add.sprite(x, L.SHELF_Y + 2, gk, '0').setOrigin(0.5, 1).setScale((on ? 2.2 : 1.8) * this._layout.UI).setDepth(3));
            if (!got) ic.setTint(0x3a3028); else if (on) ic.play(gk);
            const sl = lo.indexOf(gid);
            if (!got) keep(this.add.text(x, L.SHELF_Y + 20, '✦' + d.glorps, { fontSize: '11px', fontFamily: 'monospace', fontStyle: 'bold', color: '#3b2716',
                backgroundColor: '#e8d6ae', padding: { x: 4, y: 1 } }).setOrigin(0.5, 0).setDepth(3).setAngle(-4));
            else if (sl >= 0) keep(this.add.text(x, L.SHELF_Y + 20, sl ? 'F' : 'Q', { fontSize: '12px', fontFamily: UIKit.FONT.title, fontStyle: 'bold', color: '#1b1612',
                backgroundColor: '#f0b84a', padding: { x: 5, y: 1 } }).setOrigin(0.5, 0).setDepth(3));
            if (on) {
                const mk = keep(this.add.graphics().setDepth(3));
                mk.fillStyle(d.color, 1); mk.fillTriangle(x - 7, L.SHELF_Y - 66, x + 7, L.SHELF_Y - 66, x, L.SHELF_Y - 56);
                this.tweens.add({ targets: mk, y: 4, duration: 500, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
            }
            keep(this.add.zone(x, L.SHELF_Y - 24, 60, 60).setInteractive({ useHandCursor: true }).setDepth(12)).on('pointerdown', () => { if (k !== this._gadgetSel) this._gadgetNav(k - this._gadgetSel); });
        });

        // the gadget on the counter
        this._turntable(def.color, ShopScene.gadgetIcon(this, id), { anim: true, dim: !owned, fromDir, scale: 5 }).forEach(o => objs.push(o));

        // the tag
        const T = L.TAG, g = this._tagSheet(T, keep, D), INK = '#3b2716', Lx = T.x + 20, R = T.x + T.w - 20;
        let y = T.y + 30;
        keep(this.add.text(Lx, y, `GADGET  ·  ⟳ ${Math.round(def.cooldown / 1000)}s cooldown`, { fontSize: '11px', fontFamily: 'monospace', fontStyle: 'bold', color: UIKit._hex(MenuArt.mix(def.color, 0x3b2716, 0.45)) }).setDepth(D + 1));
        keep(this.add.text(R, y, `${this._gadgetSel + 1} / ${order.length}`, { fontSize: '11px', fontFamily: 'monospace', color: '#7a5a34' }).setOrigin(1, 0).setDepth(D + 1));
        y += 18;
        keep(this.add.text(Lx, y, def.name, { fontSize: '26px', fontFamily: UIKit.FONT.title, fontStyle: 'bold', color: INK, wordWrap: { width: T.w - 40 } }).setDepth(D + 1));
        y += 40; g.lineStyle(1, 0x6a4a26, 0.6); g.lineBetween(Lx, y, R, y); y += 10;
        y += this._richText(keep, Lx, y, ShopScene.GADGET_INFO[id] || def.blurb, { fontSize: '13px', fontFamily: 'monospace', color: '#4a3420', wordWrap: { width: T.w - 40 }, lineSpacing: 4 }, D + 1) + 18; g.lineStyle(1, 0x6a4a26, 0.4); g.lineBetween(Lx, y, R, y); y += 10;
        const row = (k2, v, col = INK) => {
            keep(this.add.text(Lx, y, k2, { fontSize: '12px', fontFamily: 'monospace', fontStyle: 'bold', color: '#6a4a26' }).setDepth(D + 1));
            keep(this.add.text(R, y, v, { fontSize: '14px', fontFamily: UIKit.FONT.title, fontStyle: 'bold', color: col }).setOrigin(1, 0).setDepth(D + 1));
            y += 22;
        };
        row('PRICE', def.startsUnlocked ? 'Free' : `✦ ${def.glorps}`);
        row('YOURS', !owned ? 'Not yet' : slot >= 0 ? `In ${slot ? 'F' : 'Q'}` : 'Owned', owned ? '#3a7a2a' : '#8a2a1a');
        row('FILLING', `slot ${this._gadgetSlot ? 'F' : 'Q'}`);
        const by = T.y + T.h - 46, bw = T.w - 40;
        if (!owned) {
            const can = this.glorps >= def.glorps;
            objs.push(...UIKit.button(this, { x: T.x + T.w / 2, y: by, w: bw, h: 46, depth: D + 2, fontSize: '18px', fireOn: 'down',
                label: can ? `UNLOCK  ✦ ${def.glorps}` : `✦ ${def.glorps}  ·  NEED ${def.glorps - this.glorps}`, accent: can ? UIKit.PALETTE.accentGold : UIKit.PALETTE.line,
                onClick: () => this._gadgetActivate() }).objs);
        } else {
            [0, 1].forEach(i => {
                const inIt = lo[i] === id;
                objs.push(...UIKit.button(this, { x: T.x + 20 + bw / 4 + i * bw / 2, y: by, w: bw / 2 - 6, h: 46, depth: D + 2, fontSize: '15px', fireOn: 'down',
                    label: inIt ? `TAKE OUT` : `PUT IN ${i ? 'F' : 'Q'}`, accent: inIt ? UIKit.PALETTE.line : def.color,
                    onClick: () => { this._gadgetSlot = i; this._gadgetActivate(); } }).objs);
            });
        }
        this._gadgetTabObjs = objs;
    }

    _gadgetNav(d) {
        const n = this._gadgetOrder().length;
        this._gadgetSel = (((this._gadgetSel ?? 0) + d) % n + n) % n;
        Sfx.play(this, 'hover');
        const def = this._gadgetDefs()[this._gadgetOrder()[this._gadgetSel]];
        this.setGlurpDialogue(this.gadgetUnlocked(def.id) ? `"The ${def.name}. ${Math.round(def.cooldown / 1000)} seconds between throws."` : `"The ${def.name}! ✦${def.glorps} and it's yours for good."`);
        this.time.delayedCall(0, () => this._showGadgetTab(Math.sign(d)));
    }
    _gadgetPickSlot(i) {
        this._gadgetSlot = i;
        Sfx.play(this, 'hover');
        this.time.delayedCall(0, () => this._showGadgetTab());
    }
    // Enter, or the tag's button: unlock the gadget on show, or put it in (or take it out of)
    // the slot being filled. One path for both, so they can't drift apart.
    _gadgetActivate() {
        const id = this._gadgetOrder()[this._gadgetSel ?? 0], def = this._gadgetDefs()[id];
        if (!this.gadgetUnlocked(id)) {
            if (this.glorps < def.glorps) { Sfx.play(this, 'hurt'); this.setGlurpDialogue(`"Need ✦ ${def.glorps - this.glorps} more for the ${def.name}!"`); return; }
            this.glorps -= def.glorps;
            localStorage.setItem('glorps', this.glorps);
            this.unlockGadget(id);
            this._refreshCurrency();
            Sfx.play(this, 'pickup');
            this.setGlurpDialogue(`"${def.name}, yours to keep! Put it in a slot to bring it along."`);
        } else {
            const slot = this._gadgetSlot || 0, lo = this.gadgetLoadout();
            if (lo[slot] === id) { this.setGadgetSlot(slot, null); this.setGlurpDialogue(`"Leaving the ${def.name} at home? Fair enough."`); }
            else { this.setGadgetSlot(slot, id); this.setGlurpDialogue(`"${def.name} on ${slot ? 'F' : 'Q'}. ${Math.round(def.cooldown / 1000)} seconds between throws."`); }
            Sfx.play(this, 'click');
        }
        this.time.delayedCall(0, () => this._showGadgetTab());
    }

    _hideGadgetTab() {
        this.input?.setDefaultCursor?.('default');
        for (const o of (this._gadgetTabObjs || [])) { if (o?.active) this.tweens.killTweensOf(o); o?.destroy?.(); }
        this._gadgetTabObjs = null;
    }

    // ── RELICS (Relics.js) ───────────────────────────────────────────────────
    // The worn slots as banners, every relic on the shelf (yours lit, today's stock priced,
    // the rest in shadow: found on Tower boss floors), the chosen one on the turntable, and
    // the tag: what it trades, where it comes from, and buy or wear.
    _showRelicTab(fromDir = 0) {
        this._hideRelicTab();
        const L = this._layout, S = L.S, D = 8, objs = [], keep = o => { objs.push(o); return o; };
        const list = Relics.all(), worn = Relics.worn(), slots = Relics.slots(), stock = Relics.stock();
        this._relicSel = Phaser.Math.Clamp(this._relicSel ?? 0, 0, list.length - 1);
        const r = list[this._relicSel], owned = Relics.has(r.id), inStock = stock.includes(r.id), on = worn.includes(r.id);
        const shelf = Relics.shelf(r.sh), si = Relics.SHELVES.indexOf(shelf), acc = shelf.col;
        this._awning(UIKit.PALETTE.brass, [0, 1, 2, 3, 4].map(i => ({ label: ['I', 'II', 'III', 'IV', 'V'][i], on: !!worn[i] && worn[i] === r.id,
            icon: worn[i] ? Relics.icon(this, worn[i]) : null, glyph: i < slots ? 'empty' : (i ? 'F' + Relics.SLOT_AT[i] : 'TOWER') }))).forEach(o => objs.push(o));
        // the bookcase: the stall's plank is the top layer (Legend), two more under it
        // the three layers spread down the stall, so the plaque sits just above the counter whatever the height
        const plaqueY = L.CT - 38, gapY = Math.max(90, (plaqueY - 52 - L.SHELF_Y) / 2);
        const LAYER = [L.SHELF_Y, L.SHELF_Y + gapY, L.SHELF_Y + gapY * 2], g = keep(this.add.graphics().setDepth(2.6));
        // the case takes the left of the stall; the display stand (a turntable, as for weapons and ults) the right
        const BX1 = S.x1 - 250, standX = Math.round((BX1 + 30 + S.x1 - 4) / 2);   // the stand, centred in the nook between the upright and the stall's post
        // an upright between the case and the stand: a cabinet with a display nook beside it
        this._plank(g, BX1 + 6, S.beam + 40, 16, L.CT - S.beam - 40, 0x4a3018, true);
        g.fillStyle(0x000000, 0.3); g.fillRect(BX1 + 22, S.beam + 40, 8, L.CT - S.beam - 40);
        for (const y of LAYER) {
            this._plank(g, S.x0 + 24, y, BX1 - S.x0 - 18, 14, 0x6a4626);
            for (const bx of [S.x0 + 60, BX1 - 36]) this._bracket(g, bx, y + 14);
        }
        // the chosen shelf's colour, washed over the back of the case
        const wash = keep(this.add.graphics().setDepth(2.4).setBlendMode(Phaser.BlendModes.ADD));
        wash.fillStyle(acc, 0.06); wash.fillRect(S.x0 + 10, S.beam + 70, BX1 - S.x0, LAYER[2] - S.beam - 40);
        [3, 2, 1].forEach((t, row) => {
            const y = LAYER[row], T = Relics.TIERS[t], items = Relics.onShelf(shelf.id, t);
            keep(this.add.text(S.x0 + 34, y - 14, `${['', 'I', 'II', 'III'][t]}  ${T.name}`, { fontSize: '10px', fontFamily: 'monospace', fontStyle: 'bold', color: UIKit._hex(T.col),
                backgroundColor: '#1b1612', padding: { x: 4, y: 2 } }).setOrigin(0, 1).setDepth(3));
            const x0 = S.x0 + 165, x1 = BX1 - 40;
            items.forEach((it, k) => {
                const x = items.length === 1 ? (x0 + x1) / 2 : x0 + (x1 - x0) * k / (items.length - 1);
                const got = Relics.has(it.id), sel = it.id === r.id, ik = Relics.icon(this, it.id), forSale = stock.includes(it.id);
                if (sel) {
                    const glow = keep(this.add.graphics().setDepth(2.7).setBlendMode(Phaser.BlendModes.ADD));
                    for (const [rr, a] of [[40, 0.06], [28, 0.08], [18, 0.1]]) { glow.fillStyle(it.col, a); glow.fillCircle(x, y - 22, rr); }
                    const mk = keep(this.add.graphics().setDepth(3));
                    mk.fillStyle(acc, 1); mk.fillTriangle(x - 7, y - 66, x + 7, y - 66, x, y - 56);
                    this.tweens.add({ targets: mk, y: 4, duration: 500, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
                }
                const ic = keep(this.add.sprite(x, y + 2, ik, '0').setOrigin(0.5, 1).setScale((sel ? 2.8 : 2.2) * this._layout.UI).setDepth(3));
                if (!got && !forSale) ic.setTint(0x7a6e66).setAlpha(0.75); else ic.play(ik);   // not yours, not for sale: a faded shape, still readable   // today's stock shows in colour, the rest as silhouettes
                if (sel && fromDir) this.tweens.add({ targets: ic, scale: { from: 2.2, to: 2.8 }, duration: 160, ease: 'Back.easeOut' });
                if (!got && forSale) keep(this.add.text(x, y + 20, '✦' + it.price, { fontSize: '10px', fontFamily: 'monospace', fontStyle: 'bold', color: '#3b2716',
                    backgroundColor: '#e8d6ae', padding: { x: 3, y: 1 } }).setOrigin(0.5, 0).setDepth(3).setAngle(-4));
                else if (worn.includes(it.id)) keep(this.add.text(x, y + 20, ['I', 'II', 'III', 'IV', 'V'][worn.indexOf(it.id)], { fontSize: '11px', fontFamily: UIKit.FONT.title, fontStyle: 'bold', color: '#1b1612',
                    backgroundColor: '#f0b84a', padding: { x: 4, y: 1 } }).setOrigin(0.5, 0).setDepth(3));
                else if (got) keep(this.add.text(x, y + 20, '★', { fontSize: '12px', color: '#7fd06a' }).setOrigin(0.5, 0).setDepth(3));
                keep(this.add.zone(x, y - 22, 64, 60).setInteractive({ useHandCursor: true }).setDepth(12)).on('pointerdown', () => { if (!sel) this._relicGo(list.findIndex(x => x.id === it.id)); });
            });
        });
        // the shelf's plaque, and the way to the others
        const pcx = (S.x0 + BX1) / 2, py = Math.max(LAYER[2] + 50, plaqueY), have = list.filter(x => x.sh === shelf.id && Relics.has(x.id)).length;
        const pl = keep(this.add.graphics().setDepth(3));
        pl.fillStyle(0x1b1612, 0.95); pl.fillRoundedRect(pcx - 150, py - 18, 300, 38, 6); pl.lineStyle(2, acc, 0.9); pl.strokeRoundedRect(pcx - 150, py - 18, 300, 38, 6);
        keep(this.add.text(pcx, py - 9, shelf.name, { fontSize: '17px', fontFamily: UIKit.FONT.title, fontStyle: 'bold', color: UIKit._hex(acc) }).setOrigin(0.5).setDepth(4));
        keep(this.add.text(pcx, py + 10, `${shelf.build}  ·  shelf ${si + 1} of ${Relics.SHELVES.length}  ·  ${have} owned`, { fontSize: '10px', fontFamily: 'monospace', color: UIKit.CSS.textMid }).setOrigin(0.5).setDepth(4));
        for (const [dx, d, s] of [[-172, -1, '‹'], [172, 1, '›']]) keep(this.add.text(pcx + dx, py, s, { fontSize: '30px', fontFamily: UIKit.FONT.title, color: UIKit.CSS.textHi }).setOrigin(0.5).setDepth(4))
            .setInteractive({ useHandCursor: true }).on('pointerdown', () => this._relicNav(0, 0, d));
        // the display stand: the chosen relic turning in the spotlight
        this._turntable(acc, Relics.icon(this, r.id), { anim: true, dim: !owned, fromDir, scale: 5, x: standX }).forEach(o => objs.push(o));
        // the tag
        const T = L.TAG, tg = this._tagSheet(T, keep, D), INK = '#3b2716', Lx = T.x + 20, R = T.x + T.w - 20, tier = Relics.TIERS[r.t];
        let y = T.y + 30;
        keep(this.add.text(Lx, y, `${shelf.name}  ·  ${tier.name}`, { fontSize: '11px', fontFamily: 'monospace', fontStyle: 'bold', color: UIKit._hex(MenuArt.mix(acc, 0x3b2716, 0.45)) }).setDepth(D + 1));
        keep(this.add.text(R, y, `${Relics.owned().length} / ${list.length}`, { fontSize: '11px', fontFamily: 'monospace', color: '#7a5a34' }).setOrigin(1, 0).setDepth(D + 1));
        y += 18;
        keep(this.add.text(Lx, y, r.name, { fontSize: '26px', fontFamily: UIKit.FONT.title, fontStyle: 'bold', color: INK, wordWrap: { width: T.w - 40 } }).setDepth(D + 1));
        y += 40; tg.lineStyle(1, 0x6a4a26, 0.6); tg.lineBetween(Lx, y, R, y); y += 10;
        y += this._richText(keep, Lx, y, Relics.text(r), { fontSize: '14px', fontFamily: 'monospace', color: '#4a3420', wordWrap: { width: T.w - 40 }, lineSpacing: 5 }, D + 1) + 18;
        tg.lineStyle(1, 0x6a4a26, 0.4); tg.lineBetween(Lx, y, R, y); y += 10;
        const row = (k2, v, col = INK) => {
            keep(this.add.text(Lx, y, k2, { fontSize: '12px', fontFamily: 'monospace', fontStyle: 'bold', color: '#6a4a26' }).setDepth(D + 1));
            keep(this.add.text(R, y, v, { fontSize: '14px', fontFamily: UIKit.FONT.title, fontStyle: 'bold', color: col }).setOrigin(1, 0).setDepth(D + 1));
            y += 22;
        };
        row('YOURS', owned ? (on ? `Worn (${['I', 'II', 'III', 'IV', 'V'][worn.indexOf(r.id)]})` : 'Owned') : 'Not yet', owned ? '#3a7a2a' : '#8a2a1a');
        if (!owned) row(inStock ? 'IN STOCK TODAY' : 'WHERE', inStock ? `✦ ${r.price}` : r.t === 3 && TowerFloors.best() < Relics.LEGEND_AT ? `Tower floor ${Relics.LEGEND_AT}+` : 'Tower bosses');
        row('SLOTS', `${worn.length} / ${slots} worn`);
        if (slots < 5) keep(this.add.text(Lx, y + 2, `next slot: ${Relics.slotNeeds(slots)}`, { fontSize: '10px', fontFamily: 'monospace', color: '#7a5a34' }).setDepth(D + 1));
        const by = T.y + T.h - 46, bw = T.w - 40;
        let label, accent = acc;
        if (owned) label = on ? 'TAKE OFF' : !slots ? 'ENTER THE TOWER' : worn.length >= slots ? 'SLOTS FULL' : 'WEAR IT';
        else if (inStock) label = this.glorps >= r.price ? `BUY  ✦ ${r.price}` : `✦ ${r.price}  ·  NEED ${r.price - this.glorps}`;
        else label = 'FOUND IN THE TOWER';
        if ((owned && !on && worn.length >= slots) || (!owned && (!inStock || this.glorps < r.price))) accent = UIKit.PALETTE.line;
        if (this._siphonA) {   // siphoning: the main button fuses, the small one backs out
            const A = Relics.def(this._siphonA), ok = this._siphonA !== r.id && owned && !r.corrupt;
            label = ok ? `SIPHON INTO ONE` : 'PICK A SECOND RELIC'; accent = ok ? 0x7aff5a : UIKit.PALETTE.line;
            keep(this.add.text(T.x + T.w / 2, by - 58, `siphoning the ${A.name}`, { fontSize: '11px', fontFamily: 'monospace', fontStyle: 'bold', color: '#2a6a1a' }).setOrigin(0.5).setDepth(D + 1));
            objs.push(...UIKit.button(this, { x: T.x + T.w / 2, y: by - 34, w: bw, h: 26, depth: D + 2, fontSize: '12px', fireOn: 'down', label: 'CANCEL', accent: UIKit.PALETTE.line, onClick: () => { this._siphonA = null; this._showRelicTab(); } }).objs);
        } else if (owned && !r.corrupt && Relics.owned().filter(id => !Relics.def(id)?.corrupt).length >= 2)
            objs.push(...UIKit.button(this, { x: T.x + T.w / 2, y: by - 34, w: bw, h: 26, depth: D + 2, fontSize: '12px', fireOn: 'down', label: 'SIPHON (fuse two into a corrupted one)', accent: 0x3a8a2a,
                onClick: () => { this._siphonA = r.id; Sfx.play(this, 'click'); this.setGlurpDialogue(`"Siphon the ${r.name}? Both go for good, and what comes out keeps half of each, plus a curse. Pick the other one."`); this._showRelicTab(); } }).objs);
        objs.push(...UIKit.button(this, { x: T.x + T.w / 2, y: by, w: bw, h: 46, depth: D + 2, fontSize: '17px', fireOn: 'down', label, accent, onClick: () => this._relicActivate() }).objs);
        this._relicTabObjs = objs;
    }
    // ← → along a layer (off its end onto the next shelf), ↑ ↓ between the tiers, Q / E a whole shelf.
    _relicNav(dx, dy = 0, dShelf = 0) {
        const list = Relics.all(), r = list[this._relicSel ?? 0], SH = Relics.SHELVES, n = SH.length;
        let si = SH.findIndex(s => s.id === r.sh), t = r.t, items = Relics.onShelf(r.sh, t), k = items.findIndex(x => x.id === r.id);
        const wrap = i => ((i % n) + n) % n;
        // the next shelf that has something on this tier (the corrupted one is empty until you siphon)
        const step = d => { do { si = wrap(si + d); items = Relics.onShelf(SH[si].id, t); } while (!items.length); };
        if (dShelf) { step(dShelf); k = Math.min(k, items.length - 1); }
        else if (dy) {
            const nt = Phaser.Math.Clamp(t - dy, 1, 3);   // up is a better tier
            if (nt === t) return;
            const was = items.length, next = Relics.onShelf(SH[si].id, nt);
            if (!next.length) return;
            t = nt; items = next;
            k = Math.round(was > 1 ? k / (was - 1) * (items.length - 1) : 0);
        } else {
            k += dx;
            if (k < 0 || k >= items.length) { step(dx); k = dx > 0 ? 0 : items.length - 1; }
        }
        this._relicGo(list.findIndex(x => x.id === items[k].id), dx || dy || dShelf);
    }
    _relicGo(i, dir = 1) {
        this._relicSel = i;
        Sfx.play(this, 'hover');
        const r = Relics.all()[i];
        if (this._siphonA) { this.setGlurpDialogue(this._siphonA === r.id ? `"That's the first one. Pick another of yours."` : Relics.has(r.id) && !r.corrupt ? `"The ${Relics.def(this._siphonA).name} and the ${r.name}? Press SIPHON."` : `"It has to be one of yours, and not corrupted."`); this.time.delayedCall(0, () => this._showRelicTab(Math.sign(dir) || 1)); return; }
        this.setGlurpDialogue(Relics.has(r.id) ? `"The ${r.name}. ${Relics.text(r)}"` : Relics.stock().includes(r.id) ? `"${r.name}! Only today, ✦${r.price}."`
            : r.t === 3 && TowerFloors.best() < Relics.LEGEND_AT ? `"A Legend. I'll only stock those once you've been up the Tower a way."` : `"Haven't got one of those today. The Tower's bosses might."`);
        this.time.delayedCall(0, () => this._showRelicTab(Math.sign(dir) || 1));
    }
    // Enter, or the tag's button: buy it if it's in stock, else wear it or take it off.
    _relicActivate() {
        const r = Relics.all()[this._relicSel ?? 0];
        if (this._siphonA) return this._siphonPick(r);
        if (!Relics.has(r.id)) {
            if (!Relics.stock().includes(r.id)) { Sfx.play(this, 'deny'); this.setGlurpDialogue(`"Not for sale. Beat a boss in the Tower and you might find one."`); return; }
            if (this.glorps < r.price) { Sfx.play(this, 'hurt'); this.setGlurpDialogue(`"Need ✦ ${r.price - this.glorps} more for the ${r.name}!"`); return; }
            this.glorps -= r.price;
            localStorage.setItem('glorps', this.glorps);
            Relics.give(r.id);
            if (Relics.worn().length < Relics.slots()) Relics.toggle(r.id);
            this._refreshCurrency();
            Sfx.play(this, 'pickup');
            this.setGlurpDialogue(`"The ${r.name}, yours for good. ${Relics.worn().includes(r.id) ? 'Already on you.' : 'Make room to wear it.'}"`);
        } else {
            const before = Relics.worn().includes(r.id), now = Relics.toggle(r.id);
            if (!before && !now) { Sfx.play(this, 'deny'); this.setGlurpDialogue(`"No room! Take one off first."`); return; }
            Sfx.play(this, 'click');
            this.setGlurpDialogue(now ? `"${r.name} on. ${Relics.text(r)}"` : `"${r.name} off."`);
        }
        this.time.delayedCall(0, () => this._showRelicTab());
    }
    // the second pick while siphoning: fuse them, then a green glitch over the stand as the new one shows
    _siphonPick(r) {
        const a = this._siphonA;
        if (a === r.id || !Relics.has(r.id) || r.corrupt) { Sfx.play(this, 'deny'); return; }
        const id = Relics.siphon(a, r.id);
        this._siphonA = null;
        if (!id) { Sfx.play(this, 'deny'); return; }
        this._relicSel = Relics.all().findIndex(x => x.id === id);
        this._showRelicTab(1);
        const nr = Relics.def(id), cam = this.cameras.main;
        Sfx.play(this, 'fanfare'); cam.shake(260, 0.006); cam.flash(220, 120, 255, 90);
        const W = this.scale.width, H = this.scale.height;
        for (let k = 0; k < 14; k++) {   // glitch bars tearing across the screen
            const bar = this.add.rectangle(Math.random() * W, Math.random() * H, 80 + Math.random() * 300, 3 + Math.random() * 8, k % 3 ? 0x7aff5a : 0x000000, 0.7).setDepth(40);
            this.tweens.add({ targets: bar, x: bar.x + (Math.random() - 0.5) * 200, alpha: 0, delay: k * 25, duration: 260, onComplete: () => bar.destroy() });
        }
        this.setGlurpDialogue(`"Ugh, it hums. The ${nr.name}: ${Relics.text(nr)}"`);
    }
    _hideRelicTab() {
        for (const o of (this._relicTabObjs || [])) { if (o?.active) this.tweens.killTweensOf(o); o?.destroy?.(); }
        this._relicTabObjs = null;
    }

    // ── ULT STALL ────────────────────────────────────────────────────────────
    // Four shelves, one per element: a plaque with the ult's name and stage, then its three
    // stage relics (owned ones lit, the current one starred, the next one priced, the ones
    // not built yet veiled). The relic you pick glows on its shelf; the tag says what that
    // stage does, what it costs, and buys it. `bought`: an element whose shelf just upgraded.
    // Laid out like the weapons: the four elements as banners on the awning, the chosen
    // element's three stages on the shelf, and the chosen stage on the turntable.
    _showUltTab({ bought = null, fromDir = 0 } = {}) {
        this._hideUltTab();
        const L = this._layout, S = L.S, D = 8, objs = [], keep = o => { objs.push(o); return o; };
        const ELS = ShopScene.ULTS;
        this._ultSel ??= { r: 0, k: 1 };
        const sel = this._ultSel, U = ELS[sel.r], acc = { fire: UIKit.PALETTE.accentOrange, ice: UIKit.PALETTE.accentBlue, lightning: UIKit.PALETTE.accentGold, cosmic: UIKit.PALETTE.accentPurple };
        const stageOf = key => parseInt(localStorage.getItem('ultStage_' + key) || '1');
        const a = acc[U.key], cur = stageOf(U.key);

        // the elements, as banners: each shows the stage you have
        this._awning(a, ELS.map((u, r) => ({ label: { fire: 'FIRE', ice: 'ICE', lightning: 'BOLT', cosmic: 'VOID' }[u.key], on: r === sel.r,
            icon: ShopScene.relicIcon(this, u.key, stageOf(u.key)),
            onClick: () => { if (r === sel.r) return; this._ultSel = { r, k: sel.k }; Sfx.play(this, 'hover'); this.time.delayedCall(0, () => this._showUltTab()); } })))
            .forEach(o => objs.push(o));

        // the shelf: stages I, II, III
        const SY = L.SHELF_Y, sh = keep(this.add.graphics().setDepth(2.5));
        this._plank(sh, S.x0 + 26, SY, S.x1 - S.x0 - 52, 10, 0x6a4626);
        const span = S.x1 - S.x0 - 220;
        U.stages.forEach((st, k) => {
            const n = k + 1, x = S.x0 + 110 + span * (k / 2), on = k === sel.k;
            const owned = cur >= n, isCur = cur === n, next = n === cur + 1, soon = !!st.soon;
            const rk = ShopScene.relicIcon(this, U.key, n);
            const ic = keep(this.add.sprite(x, SY + 2, rk, '0').setOrigin(0.5, 1).setScale((on ? 2.3 : 1.9) * this._layout.UI).setDepth(3));
            if (!owned) ic.setTint(soon ? 0x2a2420 : 0x6a5a48); else if (on || isCur) ic.play(rk);
            if (isCur) { const gl = keep(this.add.image(x, SY - 22, 'mn_glow').setTint(a).setBlendMode(Phaser.BlendModes.ADD).setDisplaySize(70, 70).setAlpha(0.45).setDepth(2.9)); this.tweens.add({ targets: gl, alpha: 0.75, duration: 900, yoyo: true, repeat: -1 }); }
            const label = isCur ? '★' : owned ? '✓' : soon ? 'SOON' : next ? `◈${st.fragCost} ✦${st.glorpCost}` : `◈${st.fragCost}`;
            keep(this.add.text(x, SY + 20, label, { fontSize: '11px', fontFamily: 'monospace', fontStyle: 'bold',
                color: isCur || owned ? '#1b1612' : '#3b2716', backgroundColor: isCur ? '#7fd06a' : owned ? '#d2bf98' : '#e8d6ae', padding: { x: 4, y: 1 } })
                .setOrigin(0.5, 0).setDepth(3).setAngle(owned ? 0 : -4).setAlpha(soon ? 0.6 : on ? 1 : 0.8));
            if (on) {
                const mk = keep(this.add.graphics().setDepth(3));
                mk.fillStyle(a, 1); mk.fillTriangle(x - 7, SY - 70, x + 7, SY - 70, x, SY - 60);
                this.tweens.add({ targets: mk, y: 4, duration: 500, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
            }
            keep(this.add.zone(x, SY - 26, 64, 64).setInteractive({ useHandCursor: true }).setDepth(12)).on('pointerdown', () => {
                if (on) return;
                this._ultSel = { r: sel.r, k }; Sfx.play(this, 'hover'); this.time.delayedCall(0, () => this._showUltTab({ fromDir: Math.sign(k - sel.k) }));
            });
        });

        // the chosen stage on the turntable: dark until you own it, a shadow if not built yet
        const n0 = sel.k + 1, st0 = U.stages[sel.k];
        const tt = this._turntable(a, ShopScene.relicIcon(this, U.key, n0), { anim: true, dim: cur < n0, fromDir, scale: 5 });
        tt.forEach(o => objs.push(o));
        if (st0.soon) tt.forEach(o => o.type === 'Sprite' && o.setTint(0x2a2420));
        if (bought === U.key) {
            const sp = keep(this.add.particles(L.TT.x, L.TT.y - 82, 'mn_px2', { speed: { min: 60, max: 200 }, lifespan: 800, scale: { start: 2.4, end: 0 },
                tint: [a, 0xffffff, UIKit.PALETTE.accentGold], blendMode: 'ADD', emitting: false }).setDepth(9));
            sp.explode(40);
        }

        // the tag: the chosen stage
        const st = U.stages[sel.k], n = sel.k + 1;
        const owned = cur >= n, next = n === cur + 1, soon = !!st.soon;
        const can = next && !soon && this.glorps >= st.glorpCost && this.fragments >= st.fragCost;
        const T = L.TAG, g = this._tagSheet(T, keep, D), INK = '#3b2716', Lx = T.x + 20, R = T.x + T.w - 20;
        let y = T.y + 30;
        keep(this.add.text(Lx, y, `${U.label}  ·  STAGE ${['I', 'II', 'III'][sel.k]}`, { fontSize: '11px', fontFamily: 'monospace', fontStyle: 'bold', color: UIKit._hex(MenuArt.mix(acc[U.key], 0x3b2716, 0.45)) }).setDepth(D + 1));
        y += 18;
        keep(this.add.text(Lx, y, U.name, { fontSize: '26px', fontFamily: UIKit.FONT.title, fontStyle: 'bold', color: INK }).setDepth(D + 1));
        y += 40; g.lineStyle(1, 0x6a4a26, 0.6); g.lineBetween(Lx, y, R, y); y += 10;
        y += this._richText(keep, Lx, y, st.desc, { fontSize: '13px', fontFamily: 'monospace', color: soon ? '#7a5a34' : '#4a3420', wordWrap: { width: T.w - 40 }, lineSpacing: 4 }, D + 1) + 18; g.lineStyle(1, 0x6a4a26, 0.4); g.lineBetween(Lx, y, R, y); y += 10;
        const row = (k2, v, col = INK) => {
            keep(this.add.text(Lx, y, k2, { fontSize: '12px', fontFamily: 'monospace', fontStyle: 'bold', color: '#6a4a26' }).setDepth(D + 1));
            keep(this.add.text(R, y, v, { fontSize: '14px', fontFamily: UIKit.FONT.title, fontStyle: 'bold', color: col }).setOrigin(1, 0).setDepth(D + 1));
            y += 22;
        };
        if (n > 1) row('COSTS', `◈ ${st.fragCost}  ·  ✦ ${st.glorpCost}`);
        row('YOURS', cur === n ? 'Active' : owned ? 'Owned' : soon ? 'Not built yet' : 'Not yet', owned ? '#3a7a2a' : '#8a2a1a');
        if (!owned && !soon) row('YOUR PURSE', `◈ ${this.fragments}  ·  ✦ ${this.glorps}`, can ? '#3a7a2a' : '#8a2a1a');
        const label = owned ? (cur === n ? 'ACTIVE' : 'OWNED') : soon ? 'COMING SOON' : !next ? `STAGE ${cur + 1} FIRST` : can ? 'UPGRADE  ▸' : 'NOT ENOUGH';
        objs.push(...UIKit.button(this, { x: T.x + T.w / 2, y: T.y + T.h - 46, w: T.w - 40, h: 46, depth: D + 2, fontSize: '18px', fireOn: 'down', label,
            accent: can ? acc[U.key] : UIKit.PALETTE.line, onClick: () => this._ultActivate() }).objs);
        this._ultTabObjs = objs;
    }
    _ultNav(dk, dr) {
        const s0 = this._ultSel ??= { r: 0, k: 1 };
        this._ultSel = { r: (s0.r + dr + 4) % 4, k: (s0.k + dk + 3) % 3 };
        Sfx.play(this, 'hover');
        this.time.delayedCall(0, () => this._showUltTab({ fromDir: dk }));
    }
    _ultActivate() {
        const sel = this._ultSel ?? { r: 0, k: 1 }, U = ShopScene.ULTS[sel.r], st = U.stages[sel.k], n = sel.k + 1;
        const cur = parseInt(localStorage.getItem('ultStage_' + U.key) || '1');
        if (st.soon) { this.setGlurpDialogue('"That one\'s still on my workbench!"'); return; }
        if (cur >= n) { this.setGlurpDialogue('"Already yours!"'); return; }
        if (n !== cur + 1) { this.setGlurpDialogue(`"Stage ${cur + 1} first, then we'll talk."`); return; }
        this.buyUltUpgrade(U.key, n, st.fragCost, st.glorpCost);
    }
    _hideUltTab() {
        for (const o of (this._ultTabObjs || [])) { if (o?.active) this.tweens.killTweensOf(o); o?.destroy?.(); }
        this._ultTabObjs = null;
    }
}

// ── THE STOCK ────────────────────────────────────────────────────────────────
// Every weapon, by element, in shelf order. Prices: fire 0/100/350/500, lightning 0/200/300,
// ice 0/210/340 (ice was 0/80/150 until its freeze loop was fixed; see git history). Cosmic
// weapons are buffs (Cosmic.js): switch to cosmic, cast, switch back.
ShopScene.CATALOGUE = [
    { id: 'flame_fists', name: 'Flame Fists', element: 'fire', cost: 0, defaultWeapon: true,
      desc: 'Quick 1-tile punch. Leaves a small *lava* patch on every hit. Default weapon.' },
    { id: 'flame_sword', name: 'Flame Sword', element: 'fire', cost: 100,
      desc: 'A narrow, hard swing: the 3 tiles in front and the one beyond. *Lava* on every tile hit; each hit applies a *Burn* stack.' },
    { id: 'magma_staff', name: 'Magma Staff', element: 'fire', cost: 350,
      desc: 'Heats up as you land hits: more fireballs, faster, and they splash. Press R: *Magma Surge*.' },
    { id: 'ignition', name: 'Ignition', element: 'fire', cost: 500,
      desc: 'Flamethrower. Click to light it or put it out; the cursor aims it. It runs on fuel (9s lit, refills while it\'s out; run it dry and it sputters out for a moment). A long, wide fan of fire that *kindles* the first two enemies it finds and stays on them: weak chip (plus 0.1% of their max HP a tick) while it fills, then they melt. Everything in the flame can catch a *Burn* stack. Press G (Detonate) to set every kindled mark off. Press R: *Blue Flame*.' },
    { id: 'ice_fists', name: 'Ice Fists', element: 'ice', cost: 0, defaultWeapon: true,
      desc: '1-tile ice punch. Every hit applies *Chill*; a full bar freezes the enemy into a cube and applies *Brittle*. Default weapon.' },
    { id: 'icicle_cannon', name: 'Icicle Cannon', element: 'ice', cost: 210,
      desc: 'An ice shotgun: a cone of icicles that splash and apply *Chill*. Up close every icicle lands; far off, fewer. 28 hits charge a *Frost Shield* (R).' },
    { id: 'fractal_shard', name: 'Fractal Shard', element: 'ice', cost: 340,
      desc: 'Alternates. First: piercing spikes that freeze what they hit into a cube (applying *Brittle*), apply a *gold* mark and plant a frost *totem*. Spike a gold mark again and it turns *purple*. Second: a fan of shards that split and apply *Chill*.' },
    { id: 'lightning_fists', name: 'Storm Fists', element: 'lightning', cost: 0, defaultWeapon: true,
      desc: '1-tile punch that chains lightning to nearby enemies. Default weapon.' },
    { id: 'orb_emitter', name: 'Orb Emitter', element: 'lightning', cost: 200,
      desc: 'Fires a bouncing electric orb that chains to every nearby enemy. Its forks apply *Superconducted* to what they hit.' },
    { id: 'ball_lightning', name: 'Ball Lightning', element: 'lightning', cost: 300,
      desc: 'Slow orb. Forks chain enemy to enemy, and further through water. Embeds on contact, applying *Superconducted* to its host, then bursts into seekers.' },
    { id: 'cosmic_fists', name: 'Void Fists', element: 'cosmic', cost: 0, defaultWeapon: true,
      desc: 'Punch and dash to build *Momentum* (max 3).' },
    { id: 'barrier_staff', name: 'Barrier Staff', element: 'cosmic', cost: 150,
      desc: '4 *wards* orbit you for 10s. Each one eats a projectile, applies *Hex* to whoever fired it (5s) and knocks nearby enemies 2 tiles back. Cooldown 9s.' },
    { id: 'astrolabe', name: 'Astrolabe', element: 'cosmic', cost: 200,
      desc: 'Starfall (in a fight): stars crash around the room, applying *Dazed* to enemies in a small area. Collect them; each applies a *Mark* to 2 foes. Hitting a *Mark* pops it for ult charge.' },
    { id: 'singularity_staff', name: 'Singularity', element: 'cosmic', cost: 250,
      desc: 'Fires a seed of a black hole from the staff that speeds up toward your cursor, applying *Hex* (1s) to what it passes, and opens a well there. The well pulls enemies in and grows; the longer they stay, the more *Hex* stacks build (one every 2s, fading 1s after they leave). When it collapses it applies *Dazed* to everything inside. Passive: Event Horizon, -30% damage taken.' },
    { id: 'void_blade', name: 'Void Blade', element: 'cosmic', cost: 300,
      desc: 'Hold to charge, release to slash: up to 18 tiles long, 3 wide, applying *Stunned* for up to 3.5s. Leaves *cosmic fluid* that applies *Hex* for longer than anything else (up to 14s). The longer the charge, the more of all of it.' },
];

// Tiers, from Weapons not listed there show none.
ShopScene.TIER = {
    flame_fists: 1, flame_sword: 2, magma_staff: 3, ignition: 4,
    ice_fists: 1, icicle_cannon: 3, fractal_shard: 4,
    lightning_fists: 1, orb_emitter: 2, ball_lightning: 3,
    cosmic_fists: 1, singularity_staff: 3,
};

// What each weapon is good at, out of 10: [one target, crowd, utility]. The element's job
// first: fire hits one thing hard and crowds poorly (the Magma Staff is
// fire's tier-3 exception, and measures as the best crowd weapon there is); lightning is
// weak on one target and strong on crowds, sometimes with real utility (the Orb Emitter's
// superconduction); ice is the utility element (chill, cubes, marks, the cannon's heal).
// Cosmic weapons are buffs and aren't rated. Judgement, not measurement: keep it in step with
// ShopScene.DPS below when a weapon changes.
ShopScene.RATINGS = {
    flame_fists: [6, 2, 1], flame_sword: [6, 3, 1], magma_staff: [8, 4, 2], ignition: [10, 2, 1],
    ice_fists: [4, 2, 7], icicle_cannon: [5, 5, 7], fractal_shard: [6, 6, 9],
    lightning_fists: [2, 6, 3], orb_emitter: [1, 7, 7], ball_lightning: [2, 9, 5],
};

// Measured damage per second [one target, group of 5], against dummies. Re-measure and update
// these after any weapon change. Cosmic weapons are movement-based and unmeasured.
ShopScene.DPS = {   // re-measured 2026-10-19 after brittle became the swap payoff (ice's solo numbers fell on purpose)
    // fire re-measured 2026-10-20 with dummies at a real max HP (burn's share of max HP read 1e7 before)
    flame_fists: [48.8, 47.9], flame_sword: [50.6, 101.9], magma_staff: [71.4, 146.5], ignition: [150, 113],
    ice_fists: [33.1, 34.1], icicle_cannon: [38, 95.5], fractal_shard: [33.3, 111],
    lightning_fists: [27.6, 78.4], orb_emitter: [25.6, 145.6], ball_lightning: [22.5, 185.4],
};
// What the *keywords* in the shop's descriptions mean (ShopScene._richText's popouts).
ShopScene.KEYWORDS = {
    hex: ['Hex', 'Cosmic\'s mark on an enemy, its stacks orbiting it (up to 3). Takes more damage from everything: +7% at one stack, +15% at two, +25% at three, and slowed. Fire, ice or lightning hitting a hexed enemy is a reaction (ult charge x3). Ascend\'s supernova hits harder for each stack. How long it lasts depends on where it came from: the Void Blade\'s lasts longest.'],
    voidlet: ['Voidlets', 'Little void allies that draw enemy attention. Warriors chase and punch. Voidbeams lock on, then fire a wide beam that pierces and ricochets off walls. They stay with you until they fall.'],
    daze: ['Dazed', 'Stunned for a moment: no moving, no attacking. Deals no damage by itself.'],
    stun: ['Stunned', 'Can\'t move or attack until it wears off.'],
    chill: ['Chill', 'Slowed. Chill builds with every ice hit; a full bar freezes the enemy into an ice cube, applying *Brittle*.'],
    'deep freeze': ['Deep Freeze', 'The ice ult\'s freeze: held still until the ult shatters it. Fire, lightning and cosmic do x2 to it, ice x1.2; the shatter adds back part of what the other elements dealt.'],
    constellation: ['Constellation', 'Hold V past halfway: you drop into a rift, then place an anchor and click where to strike: 4 stars (a pair and its mirror) crash together there, hitting everything in the way. Two *voidlets* come through with you and fight at your side.'],
    'constellation+': ['Constellation+', 'Hold V to the end: untouchable until the slam, healing all the while, and the slam applies *Dazed*. Each throw is 8 stars crashing in through walls, applying *Hex* to what they hit, and 5 *voidlets* come through: 3 warriors and 2 voidbeams.'],
    gold: ['Gold mark', 'Left by Fractal Shard\'s spikes, for 6s. A spike hits a gold-marked enemy 25% harder, and turns the mark *purple*.'],
    purple: ['Purple mark', 'An upgraded gold mark: the enemy takes x1.5 damage from everything for 7s.'],
    totem: ['Frost totem', 'Planted by every Fractal Shard spike volley: applies *Chill* to everything within 2 tiles every 0.5s, for 5s.'],
    brittle: ['Brittle', 'An ice cube: 20% of its max HP is cut off (6% on a boss), never below 1. Damage from fire, lightning and cosmic while it holds locks that much in for good; whatever is left grows back over 3s once it ends. When it breaks it adds back part of what they dealt.'],
    'super burn': ['Super Burn', 'Burn\'s bigger form, from the fire ult: 3 stacks at most, ticking five times a second for a little flat damage plus a share of max HP (3 stacks: 30 a second plus 2.5% of max HP; bosses take a quarter of the share). It lasts far longer than Burn (8s, then a stack every 2.5s), and any Burn landing on it keeps it going, though only the fire ult adds stacks. It melts things rather than thudding them.'],
    burn: ['Burn', 'Fire damage over time, up to 5 stacks: a little flat damage plus a share of the enemy\'s max HP every half second (5 stacks: 20 a second plus 1% of max HP; bosses take a quarter of the share). Stacks from different hits add up, and fire weapons feed it.'],
    lava: ['Lava', 'A molten patch on the floor. It deals no damage itself: it applies a *Burn* stack to anything standing in it every 0.8s.'],
    kindle: ['Kindle', 'Ignition\'s mark, on the first two enemies its flame finds. The two stay marked till you detonate them (or they cool out): a third in the flame isn\'t marked. It fills while the flame is on them (about 4.5s) and holds while you keep it there; left alone it cools and fizzles. Full, it is overkindled: the flame does real damage to it (plus 0.2% of its max HP a tick), it catches *Burn* half the time, and a second ring fills, up to 40% of a bar. 3s after the flame leaves it goes off by itself. Press G (Detonate) to set every mark off at any time: the fuller, the far bigger the blast (a full bar also takes 6% of its max HP). It stays marked and starts again from whatever the second ring stored.'],
    'blue flame': ['Blue Flame (R)', 'Ignition\'s ability: when its bar is full, press R and for 5s the flame burns blue-hot. It ticks half again as fast (kindle fills in 3s), ignores resistance, and now and then lays a *Blue Burn* stack.'],
    'blue burn': ['Blue Burn', 'A burn stack from Blue Flame. It does not tick: when the burn\'s hold runs out it spreads, turning the ordinary stacks blue one by one, then each blue stack bursts for 25 + 2% of max HP through resistance (bosses take a quarter of the share). Shorter than Burn, far more damage in all.'],
    ignition: ['Ignition (R)', 'Ignition\'s ability, now *Blue Flame*: press R for 5s of blue-hot flame that ticks faster and ignores resistance.'],
    'magma surge': ['Magma Surge (R)', 'Dump the staff\'s stored heat: everything round you is thrown back and gets *Burn*, and a wave of *lava* rolls outward. More heat, a bigger surge. Spending it drops the staff back to its first tier.'],
    'frost shield': ['Frost Shield (R)', '5s of 35% less damage taken, and it applies *Chill* to whoever hits you.'],
    superconduct: ['Superconducted', 'Lightning carries further from this enemy: forks and chains reach past it.'],
    momentum: ['Momentum', 'Stacks from punching and dashing: +7% damage and +8% speed each. Fades if you stop.'],
    ward: ['Wards', 'Orbiting shields. Each one eats one projectile, then shoves nearby enemies back.'],
    mark: ['Mark', 'An astral mark, a gold ring left by the Astrolabe\'s stars. Hitting the enemy pops it for ult charge.'],
    supernova: ['Supernova', 'A blast at the end of Ascend: more damage for every Hex stack on each enemy in reach.'],
    'cosmic fluid': ['Cosmic fluid', 'Void Blade\'s trail. It applies *Hex* to enemies standing in it every 2s. Lasts longer the longer you charged.'],
    'rift drop': ['Rift drop', 'You pick a spot within 14 tiles and slam down onto it. Enemies under you take a hit and are slowed.'],
    'twin collapse': ['Twin Collapse', 'Click to place the anchor (right-click moves it). Every click after throws: the anchored star and its twin rush together and implode where you clicked, pulling enemies in and applying *Hex* to what they pass. The farther from the anchor, the harder and wider.'],
};
// The KEYWORDS entry for a word as written ('Hexes', 'dazing', 'voidlets'), or null.
ShopScene.keyword = w => {
    const k = w.toLowerCase(), K = ShopScene.KEYWORDS;
    for (const c of [k, k.replace(/(es|s|ed|d|ing)$/, ''), k.replace(/(ing|ed)$/, 'e'), k.replace(/s$/, '')]) if (K[c]) return K[c];
    return null;
};

// Ult stages: what each stage does, and what it costs (fragments, glorps). Stage 1 comes with
// the element. `soon`: designed but not built, so it can't be bought yet.
ShopScene.ULTS = [
    { key: 'fire', label: 'FIRE ULT', name: 'Scorch', stages: [
        { desc: '8s: you laugh, and meteors of molten rock rain down across the room: a volley, then 2-3 at a time every 1.5-3s. Each crashes in and applies *Dazed* (1s) and a *Super Burn* stack to everything it hits. Once the volley is down your attack becomes *Meteor Strike*: click an area and 4-5 heavy meteors crash into it, spread wide, each hitting what is round it (hardest at the middle) and applying *Dazed* a moment; each one gives a *Super Burn* stack only to the enemy with the most HP it hit. A fiery aura surrounds you (6 tiles): every second one enemy inside it takes a *Super Burn* stack, the ones with the most HP likeliest. While it lasts your dash goes farther, and dashing straight through an enemy applies a *Super Burn* stack; burn ticks heal you (up to 20% of your health a cast), you move about twice as fast, and you are locked in fire.' },
        { desc: 'Every meteor also sets a Supernova fuse on what it hits: 2s, then it explodes and the blast spreads the fuse to its neighbours.', fragCost: 5, glorpCost: 20 },
        { desc: 'Not designed yet.', fragCost: 15, glorpCost: 80, soon: true },
    ] },
    { key: 'ice', label: 'ICE ULT', name: 'Blizzard', stages: [
        { desc: '20s of deadly cold, and you can switch weapons and elements through it. A wide freezing ring follows you: inside it one chill stack cubes an enemy, and cubes shatter in 1.2s for 25 + 3% of its current HP. Gale Storm: every 5s an ice tornado gathers round you and is sent off toward your crosshair, then slowly hunts down enemies (the bigger it is, the further it sees and the harder it turns), chilling what it passes and growing with every enemy it catches (the next one forms at its biggest). But you take x1.5 damage the whole time, and the cold slows you at first, wearing off over 5s. Press X again to end it early. First, a wave applies *Deep Freeze* (it shatters itself 3s in) to everything it reaches (up to 18 tiles) for 4s: fire, lightning and cosmic do x2 to it, ice x1.2. It shatters by itself for 100 + 15% of the current HP of each enemy (bosses take the 100), adding back part of what the other elements dealt. At the end you are frozen solid for 3s: safe, but unable to move or act.' },
        { desc: 'The Deep Freeze shatter hits half again as hard: 150 + 22% of current HP.', fragCost: 5, glorpCost: 20 },
        { desc: 'Not designed yet.', fragCost: 15, glorpCost: 80, soon: true },
    ] },
    { key: 'lightning', label: 'LIGHTNING ULT', name: 'Fork', stages: [
        { desc: 'You become lightning and time stops. The bolt streaks to the nearest enemy, then at random through every other one in the room, counting a combo over each, and back to you. A snap, and the whole web ignites: 18 + 1.2% of max HP to each enemy it passed through and 8 to anything on its path, all multiplied by the size of the crowd (+16% an enemy, up to x4.5). For 12s after, 40% of any damage to any enemy forks to everything within 2.5 tiles of it (at most 30 a hit), and you move twice as fast: every step thumps the floor in a wide plus, dazing what is on it, and zaps everything within 5 tiles for 5 + 0.5% of max HP, each zap forking to 2 more.' },
        { desc: 'The aftermath lasts 16s and forks 3 tiles.', fragCost: 5, glorpCost: 20 },
        { desc: 'Not designed yet.', fragCost: 15, glorpCost: 80, soon: true },
    ] },
    { key: 'cosmic', label: 'COSMIC ULT', name: 'Ascend', stages: [
        { desc: '10s, and you can switch elements freely: +25% max HP, faster on your feet, your cosmic boon at full strength. A wave of cosmic fluid cascades out from you as it starts and again as it ends; you leave a trail of it; every 3s a 7-tile-wide wave of it rolls toward your crosshair. Fluid lasts 2s and applies *Hex* that lasts 6s. Then a *supernova* pays per *Hex* stack in reach.' },
        { desc: 'Charged by every hit. Tap V: Ascend, now with 20% less damage taken. Hold V past halfway to gain a new attack: *Constellation*.', fragCost: 5, glorpCost: 20 },
        { desc: 'Hold V all the way to the end: your Constellation becomes *Constellation+*.', fragCost: 15, glorpCost: 80 },
    ] },
];

// What each gadget does, at the length the shop's tag has room for (FieldKit has the numbers).
ShopScene.GADGET_INFO = {
    smite: 'A charge lobbed over walls: lightning strikes everything within 2.5 tiles for 14 and stuns them 2s. Typed physical, so no resistance blunts it.',
    emp: 'The panic button, from where you stand: everything within 8 tiles is slowed hard, easing off over 6s.',
    displacer: 'Catches up to 6 enemies within 4 tiles; click within 2s to set them down anywhere within 10 tiles, or they get flung away.',
    grounding: 'Strips the resistances off everything within 3 tiles for 6s, so the wrong element works again. Answers elites.',
    mend: 'A totem planted where it lands: stand within 2.5 tiles and heal 2% of your max HP a second, for 6s.',
    bulwark: 'Three tiles of wall across the line you threw it on, for 4s. Enemies have to go round; it stops shots. Never lands on anyone.',
    decoy: 'A pink copy of you: enemies within 5 tiles go for it instead of you for 3s. 40 HP, so heavy hitters break it early. It pops for a little damage when it goes.',
};
