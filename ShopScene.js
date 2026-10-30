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
        if (data?.tab != null) this.time.delayedCall(0, () => this.switchShopTab?.(data.tab));   // opened on a tab (the lobby's gadget sockets)
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
        this._plank(sx, 10, sw, 48, 0x5a3a20, 10);
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
            const pOn = this._plank(-tabW / 2, 0, tabW, 30, 0x6a4626, 0), pOff = this._plank(-tabW / 2, 0, tabW, 30, 0x3e2a18, 0);
            const t = this.add.text(0, 15, label, { fontSize: '13px', fontFamily: UIKit.FONT.title, fontStyle: 'bold', color: UIKit.CSS.textMid }).setOrigin(0.5);
            c.add([pOff, pOn, g, t]);
            const o = { x, c, g, t, pOn, pOff, on: null };
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
            o.pOn.setVisible(on); o.pOff.setVisible(!on);
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
        ShopScene.wall(this, S.x0, S.beam, S.x1 - S.x0, CT - S.beam, 0.95);   // under the shelf, posts and brackets (depth 1)
        // the shelf: a plank on two iron brackets
        // the main shelf, its own container so a tab can take it down (the relic case brings its own)
        const shelf = this._mainShelf = this.add.container(0, 0).setDepth(1);
        shelf.add([this._plank(S.x0 + 24, SHELF_Y, S.x1 - S.x0 - 48, 14, 0x6a4626, 0), ...[S.x0 + 60, S.x1 - 60].map(bx => this._bracket(bx, SHELF_Y + 14, 0))]);
        // posts either side
        for (const px of [S.x0 - 14, S.x1 - 4]) this._plank(px, S.top, 18, CT - S.top, 0x4a3018, 1, true);
        // two lanterns on the posts, flickering
        for (const lx of [S.x0 + 14, S.x1 - 26]) {
            const ly = S.beam + 70, lk = 'shop_lantern';
            if (!this.anims.exists(lk)) this.anims.create({ key: lk, frames: this.anims.generateFrameNames(lk, { start: 0, end: 3 }), frameRate: 6, repeat: -1 });
            const glow = this.add.image(lx + 8, ly + 18, 'mn_glow').setTint(0xffb050).setBlendMode(Phaser.BlendModes.ADD).setDisplaySize(170, 170).setAlpha(0.35).setDepth(1.5);
            this.tweens.add({ targets: glow, alpha: 0.22, duration: 140, yoyo: true, repeat: -1, repeatDelay: 300, ease: 'Stepped' });
            this.add.sprite(lx + 8, ly + 18, lk, '0').setScale(2.5).setDepth(2).play(lk);
            stall.lineStyle(2, 0x3a3a48, 1); stall.lineBetween(lx + 8, S.beam, lx + 8, ly);
        }
        // cobwebs in the top corners of the case
        for (const [cx, dir] of [[S.x0 + 4, 1], [S.x1 - 8, -1]]) this.add.image(cx, S.beam + 2, 'shop_stall', 'cobweb').setOrigin(dir > 0 ? 0 : 1, 0).setFlipX(dir < 0).setScale(2).setDepth(1);
        // the counter, in front of everything, across the whole floor
        const counter = this.add.graphics().setDepth(6);
        counter.fillStyle(0x000000, 0.5); counter.fillRect(0, CT - 4, W, 8);
        this._plank(-4, CT, W + 8, 18, 0x7a5230, 6);
        for (let y = CT + 18, k = 0; y < H; y += 26, k++) this._plank(-4, y, W + 8, 26, k % 2 ? 0x4e321c : 0x563820, 6);
        for (let x = 40; x < W; x += 180) this.add.image(x, CT + 18, 'shop_stall', 'strap').setOrigin(0).setScale(2).setDepth(6);
        this._hint = this.add.text(S.cx, H - 18, '', {
            fontSize: '12px', fontFamily: 'monospace', color: '#c8a878',
        }).setOrigin(0.5, 1).setDepth(7).setAlpha(0.8);

        // Glurp, behind the counter on the left, and what he's saying above him.
        const gx = Math.max(110, S.x0 / 2);
        const glurp = this.add.sprite(gx, CT + 8, 'slime_green', 0).setOrigin(0.5, 1).setScale(6).setDepth(5);
        glurp.play('green_idle');
        if (typeof CreatureFX !== 'undefined') { CreatureFX.face(this, glurp, { mood: 'friend', look: 'pointer' }); CreatureFX.boopable(this, glurp, 'glurp'); }
        this.tweens.add({ targets: glurp, scaleY: 5.6, scaleX: 6.3, duration: 900, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
        this.add.text(gx, CT + 40, 'GLURP · weapons dealer', {
            fontSize: '11px', fontFamily: 'monospace', fontStyle: 'bold', color: '#e8c890',
        }).setOrigin(0.5, 0).setDepth(7);
        const bw = Math.min(230, S.x0 - 24, 2 * (S.x0 - 20 - gx)), by = CT - 220;   // (clear of the stall's post and the stats boards)
        const bubS = this.add.nineslice(gx - bw / 2 + 3, by + 4, 'shop_stall', 'bubble', bw / 2, 46, 5, 5, 5, 5).setOrigin(0).setScale(2).setDepth(8).setTint(0).setAlpha(0.4);
        const bubB = this.add.nineslice(gx - bw / 2, by, 'shop_stall', 'bubble', bw / 2, 46, 5, 5, 5, 5).setOrigin(0).setScale(2).setDepth(8);
        const bubT = this.add.image(gx, by, 'shop_stall', 'bubtail').setOrigin(0.5, 0).setScale(2).setDepth(8);
        this.glurpDialogue = this.add.text(gx, by + 46, '', {
            fontSize: '14px', fontFamily: 'monospace', fontStyle: 'bold', color: '#3b2716', align: 'center',
            wordWrap: { width: bw - 20 }, lineSpacing: 2,
        }).setOrigin(0.5).setDepth(9);
        // the bubble, `h` tall: it grows down (its tail with it) to hold a long line
        this._bubble = (h) => {
            bubS.setSize(bw / 2, h / 2); bubB.setSize(bw / 2, h / 2); bubT.setY(by + h);
            this.glurpDialogue.setY(by + h / 2);
        };
        this._bubble(92);

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
            const sealed = !ShopScene.elementOpen(el);   // lightning and cosmic stay shut until their level gives them
            const owned = w.unlocked && !sealed, equipped = this.equipped[el] === w.id && !sealed, canBuy = !owned && !sealed && this.glorps >= w.cost;

            // Shelf: every weapon of the element standing on the plank; locked ones in shadow
            // with a price tag; the selected one marked from below.
            const span = S.x1 - S.x0 - 120;
            list.forEach((it, k) => {
                const x = S.x0 + 60 + span * (list.length === 1 ? 0.5 : k / (list.length - 1));
                const key = MenuArt.iconSheet(this, it.id);
                const on = k === this._shopWi;
                if (key) {
                    const ic = track(weaponObjs, this.add.sprite(x, SHELF_Y + 2, key, '0').setOrigin(0.5, 1).setScale((on ? 2.6 : 2.2) * this._layout.UI).setDepth(3));
                    if (!it.unlocked || sealed) ic.setTint(0x3a3028);
                    if (on) ic.play(key);
                    if (it.unlocked) this._enchAura(ic, it.id).forEach(o => track(weaponObjs, o));   // enchanted: it glows on the shelf
                }
                if (sealed) track(weaponObjs, UIKit.chains(this, x, SHELF_Y - 26, 58, 52, { depth: 3.5, link: 6, lock: 13 }));   // chained till the story opens it
                else if (!it.unlocked) {
                    const pt = track(weaponObjs, this.add.text(x, SHELF_Y + 20, '✦' + it.cost, {
                        fontSize: '11px', fontFamily: 'monospace', fontStyle: 'bold', color: '#3b2716', backgroundColor: '#e8d6ae', padding: { x: 4, y: 1 },
                    }).setOrigin(0.5, 0).setDepth(3).setAngle(-4));
                    pt.setAlpha(on ? 1 : 0.75);
                } else if (this.equipped[el] === it.id) {
                    track(weaponObjs, this.add.text(x, SHELF_Y + 20, '★', { fontSize: '14px', color: '#7fd06a' }).setOrigin(0.5, 0).setDepth(3));
                }
                if (on) {
                    track(weaponObjs, this._pointer(x, SHELF_Y - 70, acc));
                }
                const hit = track(weaponObjs, this.add.zone(x, SHELF_Y - 26, 64, 64).setInteractive({ useHandCursor: true }).setDepth(12));
                hit.on('pointerdown', () => { if (k !== this._shopWi) goTo(k); });
            });

            // The weapon on the turntable, under the spotlight (_turntable).
            const ttObjs = this._turntable(acc, MenuArt.iconSheet(this, w.id), { anim: true, dim: !owned, fromDir, scale: 5.5 });
            ttObjs.forEach(o => weaponObjs.push(o));
            if (sealed) weaponObjs.push(UIKit.chains(this, this._layout.TT.x, this._layout.TT.y - 90, 210, 170, { depth: 8, link: 11, lock: 26 }));   // chained to the turntable
            const ttIcon = ttObjs.find(o => o.type === 'Sprite' && o.texture?.key === MenuArt.iconSheet(this, w.id));
            if (owned && ttIcon) this._enchAura(ttIcon, w.id).forEach(o => weaponObjs.push(o));   // and on the turntable

            // The price tag, hanging from the awning on a string.
            this._ownTag(weaponObjs, redraw => this._drawTag(TAG, w, el, acc, { owned, equipped, canBuy, sealed, list, idx: this._shopWi, glyph: EL[el].glyph, elName: EL[el].name },
                          () => activate(), redraw));

            this.setGlurpDialogue(sealed ? `"${ShopScene.SEALED[el].glurp}"` : equipped ? `"The ${w.name}! Your current pick. Good taste."`
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
            if (!w) return;
            if (!ShopScene.elementOpen(el)) { Sfx.play(this, 'deny'); this.setGlurpDialogue(`"${ShopScene.SEALED[el].glurp}"`); return; }
            if (this.equipped[el] === w.id) return;
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
        // TAB turns the tag's page (an owned weapon's upgrades or what it does; a long description's next page)
        this.input.keyboard.on('keydown-TAB', (e) => { e?.preventDefault?.(); this._tagTurn?.(); });

        // Purchases update the stall in place. They used to restart the scene, and the
        // restart's fade-in read as the whole screen blinking on every buy and equip.
        this._refreshStall = () => renderWeapon(0);
        const HINTS = ['← →  weapons     ↑ ↓  element     Enter  buy / equip     Tab  tag page', 'hover anything for the details',
                       '↑ ↓  element     ← →  stage     Enter  upgrade', '← →  gadgets     Q / F  pick a slot     Enter  unlock / slot',
                       '← →  relics     ↑ ↓  tiers     Q E  up / down the list     Enter  buy / wear'];

        // ── TAB SWITCHING ─────────────────────────────────────────────────
        this.switchShopTab = (i) => {
            this._hideTip?.();
            this._tagTurn = null;   // (the new tab's tag sets its own)
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

    // ── THE STALL'S ART (shop_stall / shop_wall, drawn 2x like the map) ──────────
    // The back wall: the boards tiled, darker toward the top under the awning, and toward the sides. Returns its objects.
    static wall(scene, x, y, w, h, depth) {
        const t = scene.add.tileSprite(x, y, Math.ceil(w / 2), Math.ceil(h / 2), 'shop_wall').setOrigin(0).setScale(2).setDepth(depth);
        const g = scene.add.graphics().setDepth(depth), sw = Math.round(w * 0.1);
        g.fillGradientStyle(0x120a06, 0x120a06, 0x120a06, 0x120a06, 0.35, 0.35, 0, 0); g.fillRect(x, y, w, h * 0.5);
        g.fillGradientStyle(0x050302, 0x050302, 0x050302, 0x050302, 0.45, 0, 0.45, 0); g.fillRect(x, y, sw, h);
        g.fillGradientStyle(0x050302, 0x050302, 0x050302, 0x050302, 0, 0.45, 0, 0.45); g.fillRect(x + w - sw, y, sw, h);
        return [t, g];
    }
    // The awning's and banners' cloth for an accent (shop_stall has one per accent; anything else is brass).
    static cloth(acc) {
        return { [UIKit.PALETTE.accentOrange]: 'orange', [UIKit.PALETTE.accentBlue]: 'blue', [UIKit.PALETTE.accentGold]: 'gold', [UIKit.PALETTE.accentPurple]: 'violet' }[acc] || 'brass';
    }
    // A dark plaque w x h at (x, y), its rim in `rim` (a 9-slice and its rim, tinted). Returns its objects.
    static plaque(scene, x, y, w, h, rim, depth, alpha = 1) {
        const n = k => scene.add.nineslice(x, y, 'shop_stall', k, Math.round(w / 2), Math.round(h / 2), 4, 4, 4, 4).setOrigin(0).setScale(2).setDepth(depth);
        return [n('plaque').setAlpha(alpha), n('plaque_rim').setTint(rim)];
    }
    // The marker bobbing over the chosen thing on a shelf, in its colour, its point at y + 10.
    _pointer(x, y, col) {
        const p = this.add.image(x, y, 'shop_stall', 'pointer').setOrigin(0.5, 0).setScale(2).setDepth(3).setTint(col);
        this.tweens.add({ targets: p, y: y + 4, duration: 500, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
        return p;
    }
    // An iron shelf bracket under a plank at (x, y).
    _bracket(x, y, depth) { return this.add.image(x, y, 'shop_stall', 'bracket').setOrigin(0.5, 0).setScale(2).setDepth(depth); }
    // A wooden plank w x h at (x, y) in its wood `col`: nailed ends and grain stretched between them (a 3-slice of a
    // shop_stall plank of that thickness). Upright ones are the same plank turned, lit edge to the left.
    _plank(x, y, w, h, col, depth, vertical = false) {
        const t = vertical ? w : h, len = vertical ? h : w;
        const p = this.add.nineslice(0, 0, 'shop_stall', `pk${t / 2}_${col.toString(16).padStart(6, '0')}`, Math.round(len / 2), t / 2, 6, 6).setOrigin(0).setScale(2).setDepth(depth);
        return vertical ? p.setAngle(-90).setPosition(x, y + h) : p.setPosition(x, y);
    }

    // The price tag: parchment on a string, with the weapon's name, element and tier, what it does, how hard it hits (its
    // measured damage, as bars), and the stamp that buys or equips it. An owned weapon's tag has two pages, on tabs under
    // its name: what it does, and its upgrades (it opens on those; TAB turns). Words that don't fit hang the tag longer,
    // step down to 11px, then turn in pages; so do upgrade rows. `redraw` draws the tag again. Returns its objects.
    _drawTag(T, w, el, acc, st, onStamp, redraw) {
        const objs = [], keep = o => { objs.push(o); return o; };
        const D = 8, INK = '#3b2716', W0 = T.w - 40;
        const page = st.owned ? (this._tagPage ??= 'up') : 'about';
        const desc = w.desc.replace(/\n/g, ' ');
        const descStyle = fs => ({ fontSize: fs + 'px', fontFamily: 'monospace', color: '#4a3420', wordWrap: { width: W0 }, lineSpacing: fs > 12 ? 4 : 3 });
        const hOf = (s, style) => this._textH(s, style);
        // what it's good at (RATINGS), or why a cosmic weapon isn't rated
        const rt = ShopScene.RATINGS[w.id];
        const util = el === 'cosmic' ? 'Pure utility: a buff you cast, then switch back to fight. No damage of its own to rate.' : 'Not rated yet.';
        const utilStyle = { fontSize: '12px', fontFamily: 'monospace', fontStyle: 'italic', color: '#6a4a26', wordWrap: { width: W0 } };
        const rtH = rt ? 57 + (ShopScene.DPS[w.id] ? 14 : 0) : hOf(util, utilStyle) + 6;
        const ledgerH = st.owned ? 22 : (3 + (st.sealed ? 1 : 0)) * 22;
        // the upgrades (Stats.js WeaponLevels): Power, no cap (none on cosmic weapons); each perk, capped; its enchants. What
        // you've bought (o) and how much of it you're using (u): any of it can be turned down, even off, and back up.
        // A row's value: what's on, then what the next one bought adds (short: the next alone); turned down, how much of it.
        const rows = [];
        if (page === 'up') {
            const val = (u, o, say, more) => {
                if (u < o) { const now = `using ${u} of ${o}: ${u ? say(u) : 'off'}`; return { full: now, short: now }; }
                return { full: o && more ? `${say(o)}  →  ${say(o + 1)}` : more ? '→ ' + say(1) : say(o), short: more ? '→ ' + say(o + 1) : say(o) };
            };
            if (!WeaponLevels.NO_POWER.includes(w.id)) {
                const o = WeaponLevels.ownedLevel(w.id), u = WeaponLevels.level(w.id);
                rows.push({ label: `POWER  LV ${o}`, ...val(u, o, n => `+${Math.round(n * WeaponLevels.PER * 100)}% damage`, true), cost: WeaponLevels.dmgCost(w.id), key: null, u, o });
            }
            for (const [key, name, cap, , , say] of WeaponLevels.PERKS[w.id] || []) {
                const o = WeaponLevels.ownedPerk(w.id, key), u = WeaponLevels.perk(w.id, key), lock = WeaponLevels.needs(w.id, key);
                rows.push({ label: `${name.toUpperCase()}  ${o}/${cap}`, ...(lock ? { full: lock, short: lock } : val(u, o, say, o < cap)), cost: WeaponLevels.perkCost(w.id, key), key, u, o, lock });
            }
            const en = Enchants.on(w.id), es = Enchants.slots(w.id), et = en.length ? en.map(b => `${Enchants.def(b.id).name} ${Enchants.roman(b.lvl)}`).join(', ') : `none yet  ·  ${Enchants.books()} sealed book${Enchants.books() === 1 ? '' : 's'}`;
            rows.push({ label: `ENCHANTS  ${en.length}/${es}`, full: et, short: et, cost: 0, key: '__ench', o: 0 });   // enchanting is at the Isle
        }
        // a row: its label and button on a line; under them the level in use (− n +) and the value
        const valStyle = (r) => ({ fontSize: '11px', fontFamily: 'monospace', color: '#4a3420', wordWrap: { width: W0 - (r.o ? 76 : 0) } });
        const rowH = (r, short) => 38 + Math.max(20, hOf(short ? r.short : r.full, valStyle(r)));
        const rowsH = short => rows.reduce((s, r) => s + rowH(r, short), 0);
        const head = 98 + (st.owned ? 28 : 0);   // (the header down to the words: element, name, rule, and the page tabs)
        const need = page === 'up' ? head + rowsH(false) + 84 : head + hOf(desc, descStyle(13)) + 16 + rtH + 20 + ledgerH + 84;
        if (need > T.h) T = { ...T, h: Math.min(this.scale.height - 36 - T.y, T.h + 80) };   // a full tag hangs longer
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
        y += this._tagName(keep, L, y, w.name, W0, D + 1);
        g.lineStyle(1, 0x6a4a26, 0.6); g.lineBetween(L, y, R, y);
        y += 10;
        this._tagTurn = null;
        // the page tabs: the open one inked dark and underlined in the element's colour
        if (st.owned) {
            const flip = () => { this._tagPage = page === 'up' ? 'about' : 'up'; Sfx.play(this, 'e_flip'); redraw(); };
            const tw = (R - L - 8) / 2;
            [['about', 'WHAT IT DOES'], ['up', 'UPGRADES']].forEach(([k, label], i) => {
                const on = page === k, x = L + i * (tw + 8);
                g.fillStyle(0x6a4a26, on ? 0.16 : 0.06); g.fillRect(x, y - 2, tw, 22);
                if (on) { g.fillStyle(MenuArt.mix(acc, 0x3b2716, 0.2), 1); g.fillRect(x, y + 18, tw, 2); }
                keep(this.add.text(x + tw / 2, y + 9, label, { fontSize: '11px', fontFamily: 'monospace', fontStyle: 'bold', color: on ? INK : '#9a7a54' }).setOrigin(0.5).setDepth(D + 1));
                if (!on) keep(this.add.zone(x + tw / 2, y + 9, tw, 22).setInteractive({ useHandCursor: true }).setDepth(D + 3)).on('pointerdown', flip);
            });
            y += 28;
            this._tagTurn = flip;
        }

        const row = (k, v, col = INK) => { y += this._tagRow(keep, L, R, y, k, v, col, D + 1); };
        if (page === 'about') {
            // the words get what the ratings, the ledger and the stamp leave; a size smaller, then pages
            const room = T.y + T.h - 84 - ledgerH - 20 - rtH - 16 - y;
            let fs = 13;
            while (fs > 11 && hOf(desc, descStyle(fs)) > room) fs--;
            const words = this._pagedText(keep, L, y, room, desc, descStyle(fs), D + 1, w.id, redraw);
            if (!st.owned && words.turn) this._tagTurn = words.turn;
            y += words.h + 16;

            // What it's good at, rated out of 10 on three axes (ShopScene.RATINGS): one target,
            // crowds, and utility (control, setup, sustain). Cosmic weapons are buffs: no bars.
            if (rt) {
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
            } else {
                keep(this.add.text(L, y, util, utilStyle).setDepth(D + 1));
                y += rtH;
            }

            // Price and standing, as a ledger.
            y += 10;
            g.lineStyle(1, 0x6a4a26, 0.4); g.lineBetween(L, y, R, y);
            y += 10;
            if (!st.owned) {
                row('PRICE', w.defaultWeapon ? 'Free (starter)' : `✦ ${w.cost}`);
                row('YOURS', 'Not yet', '#8a2a1a');
                row('YOUR PURSE', `✦ ${this.glorps}`, st.canBuy ? '#3a7a2a' : '#8a2a1a');
                if (st.sealed) row('SEALED', ShopScene.SEALED[el].short, '#8a2a1a');
            } else row('YOURS', st.equipped ? 'Equipped' : 'Owned', '#3a7a2a');
        } else {
            // The upgrades, down to the stamp. Too many for the room: each value shortened, then a page of them at a time.
            const floor = T.y + T.h - 84;
            const short = y + rowsH(false) > floor, room = floor - y - (y + rowsH(short) > floor ? 24 : 0);
            const pages = [[]];
            let used = 0;
            for (const r of rows) {
                const h = rowH(r, short);
                if (used + h > room && pages[pages.length - 1].length) { pages.push([]); used = 0; }
                pages[pages.length - 1].push(r); used += h;
            }
            const pg = this._pager(keep, w.id + ':up', pages.length, R, floor - 10, D + 1, redraw), list = pages[pg.i];
            // a short list spreads out a little rather than huddling at the top
            const spare = pages.length > 1 ? 0 : Math.max(0, Math.min(24, (room - list.reduce((s, r) => s + rowH(r, short), 0)) / list.length));
            const use = (r, n) => { if (r.key) WeaponLevels.usePerk(w.id, r.key, n); else WeaponLevels.useLevel(w.id, n); Sfx.play(this, 'click'); redraw(); };
            list.forEach((r, k) => {
                const top = y + spare / 2, ly = top + 14, sy = top + 32, ench = r.key === '__ench';
                keep(this.add.text(L, ly, r.label, { fontSize: '12px', fontFamily: 'monospace', fontStyle: 'bold', color: '#6a4a26' }).setOrigin(0, 0.5).setDepth(D + 1));
                const can = r.cost !== null && this.glorps >= r.cost;
                UIKit.button(this, { x: R - 44, y: ly, w: 88, h: 26, depth: D + 2, fontSize: '12px', fireOn: 'down',
                    label: ench ? 'THE ISLE' : r.lock ? 'LOCKED' : r.cost === null ? 'MAXED' : `✦ ${r.cost}`, accent: ench ? UIKit.PALETTE.accentPurple : r.cost === null ? UIKit.PALETTE.line : can ? UIKit.PALETTE.accentGold : UIKit.PALETTE.line,
                    onClick: () => ench ? this.scene.start('Enchant', { weapon: w.id }) : this._buyWeaponUp(w.id, r.key) }).objs.forEach(keep);
                // the level in use: − and + either side of it (red while it's turned down)
                if (r.o) {
                    const sg = keep(this.add.graphics().setDepth(D + 1));
                    for (const [d, bx] of [[-1, L], [1, L + 48]]) {
                        const n = r.u + d, ok = n >= 0 && n <= r.o;
                        sg.fillStyle(0x6a4a26, ok ? 0.18 : 0.05); sg.fillRect(bx, sy, 22, 20);
                        sg.lineStyle(1, 0x6a4a26, ok ? 0.9 : 0.3); sg.strokeRect(bx, sy, 22, 20);
                        keep(this.add.text(bx + 11, sy + 10, d < 0 ? '−' : '+', { fontSize: '15px', fontFamily: 'monospace', fontStyle: 'bold', color: ok ? INK : '#b8a27e' }).setOrigin(0.5).setDepth(D + 1));
                        if (ok) keep(this.add.zone(bx + 11, sy + 10, 26, 24).setInteractive({ useHandCursor: true }).setDepth(D + 3)).on('pointerdown', () => use(r, n));
                    }
                    keep(this.add.text(L + 35, sy + 10, String(r.u), { fontSize: '13px', fontFamily: 'monospace', fontStyle: 'bold', color: r.u < r.o ? '#8a2a1a' : INK }).setOrigin(0.5).setDepth(D + 1));
                    this._tipZone(keep, L + 35, sy + 10, 24, 22, D, () => ({ title: `In use: ${r.u} of ${r.o}`, body: 'What the weapon uses of what you\'ve bought. − turns it down, even off; + turns it back up. Buying another uses all of it again.' }));
                }
                const vt = keep(this.add.text(L + (r.o ? 76 : 0), sy, short ? r.short : r.full, valStyle(r)).setDepth(D + 1));
                if (vt.height < 20) vt.setY(sy + (20 - vt.height) / 2);   // (one line: level with the − n +)
                y += rowH(r, short) + spare;
                if (k < list.length - 1) { g.lineStyle(1, 0x6a4a26, 0.15); g.lineBetween(L, y - 3, R, y - 3); }
            });
        }

        // The stamp, always at the foot: EQUIPPED is inked onto the tag; otherwise a wax-red button to press.
        const sy = T.y + T.h - 46;
        if (st.equipped) {
            const s = keep(this.add.text(T.x + T.w / 2, sy, 'EQUIPPED', {
                fontSize: '24px', fontFamily: UIKit.FONT.title, fontStyle: 'bold', color: '#3a7a2a',
                stroke: '#3a7a2a', strokeThickness: 1, padding: { x: 10, y: 4 },
            }).setOrigin(0.5).setDepth(D + 1).setAngle(-6));
            const box = keep(this.add.graphics({ x: T.x + T.w / 2, y: sy }).setDepth(D + 1));   // drawn round its own centre so it tilts with the ink
            box.lineStyle(3, 0x3a7a2a, 0.9); box.strokeRect(-s.width / 2, -s.height / 2, s.width, s.height);
            box.setAngle(-6);
        } else {
            const label = st.sealed ? 'SEALED' : st.owned ? 'EQUIP' : st.canBuy ? `BUY  ✦ ${w.cost}` : `✦ ${w.cost}  ·  NEED ${w.cost - this.glorps}`;
            UIKit.button(this, { x: T.x + T.w / 2, y: sy, w: T.w - 40, h: 48, label,
                                 accent: st.owned ? UIKit.PALETTE.accentGreen : st.canBuy ? UIKit.PALETTE.accentRed : UIKit.PALETTE.line,
                                 fontSize: '18px', depth: D + 2, fireOn: 'down', onClick: onStamp }).objs.forEach(keep);
        }
        return objs;
    }

    // A tag that can draw itself again alone (turning a page, a level turned down) without the rest of the stall dropping
    // in anew: draw(redraw) returns its objects, which also go into `objs` (what its tab clears).
    _ownTag(objs, draw) {
        let mine = [];
        const redraw = () => {
            if (mine[0] && (!mine[0].active || !mine[0].visible)) return;   // its tab moved on before this came round
            this._hideTip();
            mine.forEach(o => { if (o?.active) this.tweens.killTweensOf(o); o?.destroy?.(); });
            mine = draw(() => this.time.delayedCall(0, redraw));   // (never inside the click that asked)
            objs.push(...mine);
        };
        redraw();
    }

    // A ledger line on a tag: the label left, the value right; a value too long to sit beside it goes under it. Returns the
    // room it took (`dry`: only measures).
    _tagRow(keep, L, R, y, k, v, col, D, dry = false) {
        const a = this.add.text(L, y, k, { fontSize: '12px', fontFamily: 'monospace', fontStyle: 'bold', color: '#6a4a26' }).setDepth(D);
        const b = this.add.text(R, y, v, { fontSize: '14px', fontFamily: UIKit.FONT.title, fontStyle: 'bold', color: col, align: 'right' }).setOrigin(1, 0).setDepth(D);
        let h = 22;
        if (b.width > R - L - a.width - 12) { b.setY(y + 16).setWordWrapWidth(R - L); h = 20 + b.height; }
        if (dry) { a.destroy(); b.destroy(); } else { keep(a); keep(b); }
        return h;
    }
    // How tall a paragraph lays out (its *keywords* read plain).
    _textH(s, style) { const t = this.add.text(0, 0, s.replace(/\*([^*]+)\*/g, '$1'), style), h = t.height; t.destroy(); return h; }

    // A tag's name, as big as fits on one line (26px down to 18px; wrapped past that). Returns the room it took.
    _tagName(keep, x, y, name, w, D) {
        const t = keep(this.add.text(x, y, name, { fontSize: '26px', fontFamily: UIKit.FONT.title, fontStyle: 'bold', color: '#3b2716' }).setDepth(D));
        for (let fs = 25; t.width > w && fs >= 18; fs--) t.setFontSize(fs);
        if (t.width > w) t.setWordWrapWidth(w);
        return Math.max(40, t.height + 8);
    }

    // Which of n pages is showing, kept under `key` while it's on show, with ◂ page i of n ▸ (right edge R, centred on y)
    // to turn it. Returns { i, n, turn(d) }, turn null with only one page.
    _pager(keep, key, n, R, y, D, redraw) {
        const P = this._pg?.key === key ? this._pg : (this._pg = { key, i: 0 });
        P.i = Math.min(P.i, n - 1);
        if (n < 2) return { i: P.i, n, turn: null };
        const turn = (d = 1) => { P.i = (P.i + d + n) % n; Sfx.play(this, 'e_flip'); redraw(); };
        const st = { fontSize: '11px', fontFamily: 'monospace', fontStyle: 'bold', color: '#6a4a26' }, ar = { ...st, fontSize: '15px' };
        const nx = keep(this.add.text(R, y, '▸', ar).setOrigin(1, 0.5).setDepth(D));
        const t = keep(this.add.text(nx.x - nx.width - 6, y, `page ${P.i + 1} of ${n}`, st).setOrigin(1, 0.5).setDepth(D));
        const pv = keep(this.add.text(t.x - t.width - 6, y, '◂', ar).setOrigin(1, 0.5).setDepth(D));
        for (const [o, d] of [[pv, -1], [nx, 1]]) keep(this.add.zone(o.x - o.width / 2, y, 28, 24).setInteractive({ useHandCursor: true }).setDepth(D + 3)).on('pointerdown', () => turn(d));
        return { i: P.i, n, turn };
    }

    // Words in a room `room` tall: drawn whole if they fit, else a page at a time (split between sentences, or mid-sentence
    // rather than leave a page half empty) with the pager at the room's foot. Returns { h, turn }: h is the whole
    // room when paged, so what's under it doesn't move as the pages turn.
    _pagedText(keep, x, y, room, str, style, D, key, redraw) {
        const probe = this.add.text(0, 0, '', style), hOf = s => probe.setText(s.replace(/\*([^*]+)\*/g, '$1')).height;
        const pages = [];
        if (hOf(str) > room) {
            const fit = room - 24;
            let cur = '';
            const add = tok => { const next = cur ? cur + ' ' + tok : tok; if (cur && hOf(next) > fit) { pages.push(cur); cur = tok; } else cur = next; };
            for (const sen of str.replace(/([.!?])\s+(?=[A-Z(*"])/g, '$1\u0000').split('\u0000')) {
                if (hOf(cur ? cur + ' ' + sen : sen) <= fit) { cur = cur ? cur + ' ' + sen : sen; continue; }
                if (cur && hOf(cur) > fit * 0.6) { pages.push(cur); cur = ''; if (hOf(sen) <= fit) { cur = sen; continue; } }
                (sen.match(/\*[^*]+\*\S*|\S+/g) || []).forEach(add);   // (a page with room to spare takes what fits of a long sentence)
            }
            pages.push(cur);
        }
        probe.destroy();
        if (pages.length < 2) return { h: this._richText(keep, x, y, str, style, D), turn: null };
        const P = this._pager(keep, key, pages.length, x + style.wordWrap.width, y + room - 10, D, redraw);
        this._richText(keep, x, y, pages[P.i], style, D);
        return { h: room, turn: P.turn };
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
        ShopScene.wall(this, x0 - 6, top - 6, x1 - x0 + 12, bot - top + 12, D).forEach(keep);
        const back = keep(this.add.graphics().setDepth(D + 0.5));
        back.fillStyle(0x000000, 0.35); back.fillRect(x0 - 6, top - 6, x1 - x0 + 12, 4);
        keep(this._plank(x0 - 6, top - 2, x1 - x0 + 12, 24, 0x5a3a20, D + 0.5));
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
            // a parchment sheet pinned to the boards (like the weapons' tags), in the stat's colour at the head
            keep(this.add.graphics().setDepth(D + 1)).fillStyle(0x000000, 0.45).fillRect(x + 5, cy0 + 7, cw, ch);
            ShopScene.parchment(this, x, cy0, cw, ch, D + 1).forEach(keep);
            keep(this.add.nineslice(x, cy0, 'shop_stall', 'cardband', Math.round(cw / 2), 4, 1, 1).setOrigin(0).setScale(2).setDepth(D + 1).setTint(MenuArt.mix(acc, 0xe2cfa4, 0.55)));
            for (const nx of [x + 14, x + cw - 14]) keep(this.add.image(nx, cy0 + 4, 'shop_stall', 'nail').setScale(2).setDepth(D + 1));
            const g = keep(this.add.graphics().setDepth(D + 1));

            // name and purpose
            keep(this.add.text(cx, cy0 + 22, id.toUpperCase(), { fontSize: '10px', fontFamily: 'monospace', fontStyle: 'bold', color: accHex }).setOrigin(0.5).setDepth(D + 2));
            keep(this.add.text(cx, cy0 + 44, d.name, { fontSize: '28px', fontFamily: UIKit.FONT.title, fontStyle: 'bold', color: '#3b2716' }).setOrigin(0.5).setDepth(D + 2));
            const blurbB = keep(this.add.text(cx, cy0 + 66, d.blurb, { fontSize: '12px', fontFamily: 'monospace', color: '#5a3e22', align: 'center', wordWrap: { width: cw - 28 } }).setOrigin(0.5, 0).setDepth(D + 2)).getBounds().bottom;
            // a short card (a small window): the emblem a size smaller with the big number beside it, not over it
            const compact = !roomy && (blurbB + 4 > Y(0.17) - 50 || u < 280), sk = compact ? 0.8 : 1;

            // the emblem in its light, a ring turning round it
            const ey = compact ? blurbB + 48 : Y(roomy ? 0.13 : 0.17), ecx = compact ? x + 64 : cx;
            keep(this.add.image(ecx, ey, 'shop_stall', 'medal').setScale(2 * sk).setDepth(D + 1.5));   // a carved wooden medallion for the emblem to sit on
            const em = keep(this.add.image(ecx, ey, 'shop_stall', 'emb_' + id).setScale(2 * sk).setDepth(D + 2));
            if (!this.anims.exists('shop_ring')) this.anims.create({ key: 'shop_ring', frames: this.anims.generateFrameNames('shop_stall', { prefix: 'ring', start: 0, end: 7 }), frameRate: 16 / 3, repeat: -1 });
            keep(this.add.sprite(ecx, ey, 'shop_stall', 'ring0').setScale(2 * sk).setDepth(D + 2).setTint(MenuArt.mix(acc, 0xffffff, 0.2)).setAlpha(0.9)).play('shop_ring');   // a ring of dashes turning round it

            // the big number, what it means, and the next level
            const [big, what] = BIG[id](lvl);
            const nx = compact ? (ecx + 46 + x + cw - 14) / 2 : cx, nw = compact ? x + cw - 14 - (ecx + 46) : cw - 40;
            const bigT = keep(this.add.text(nx, compact ? ey - 14 : Y(roomy ? 0.32 : 0.41), big, { fontSize: '36px', fontFamily: UIKit.FONT.title, fontStyle: 'bold', color: accHex }).setOrigin(0.5).setDepth(D + 2));
            keep(this.add.text(nx, bigT.y + 25, what, { fontSize: '12px', fontFamily: 'monospace', color: '#5a3e22' }).setOrigin(0.5).setDepth(D + 2));
            keep(this.add.text(nx, bigT.y + 43, cost !== null ? `next  ▸  ${BIG[id](lvl + 1)[0]}` : 'maxed', { fontSize: '12px', fontFamily: 'monospace', fontStyle: 'bold', color: '#8a6a44' }).setOrigin(0.5).setDepth(D + 2));
            this._tipZone(keep, nx, bigT.y + 18, nw, 64, D, () => ({ title: `${d.name}: ${big} ${what}`, body: DETAIL[id](lvl), accent: acc }));

            const divY = compact ? ey + 48 : bigT.y + 62;
            g.lineStyle(1, 0x6a4a26, 0.4); g.lineBetween(x + 24, divY, x + cw - 24, divY);

            // level: 25 pips in five tiers, a diamond at each tier's end
            const L0 = x + 24, R0 = x + cw - 24, py = divY + 28, gw = (R0 - L0 - 4 * 6) / 5, pw = gw / 5;
            keep(this.add.text(L0, py - 22, `LEVEL ${lvl} / ${d.cap}`, { fontSize: '11px', fontFamily: 'monospace', fontStyle: 'bold', color: '#5a3e22' }).setDepth(D + 2));   // (over the tier diamonds)
            keep(this.add.text(R0, py - 22, `TIER ${ROMAN[Math.min(4, Math.floor(lvl / 5))]}`, { fontSize: '11px', fontFamily: UIKit.FONT.title, fontStyle: 'bold', color: '#8a6a44' }).setOrigin(1, 0).setDepth(D + 2));
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
        const lines = t.getWrappedText(plain), lh = probe.setText('A\nA').height - probe.setText('A').height;   // (one line's advance, measured)
        const blank = lines.map(l => [...l]);   // the paragraph as wrapped, a keyword's letters left out of it (drawn once, in its colour, not over itself)
        let li = 0, col = 0;
        for (const w of words) {
            for (; li < lines.length; li++, col = 0) { const i = lines[li].indexOf(w, col); if (i >= 0) { col = i; break; } }
            if (li >= lines.length) break;   // split across a line: left plain
            const k = ShopScene.keyword(w), kx = x + wOf(lines[li].slice(0, col)), ky = y + li * lh, ww = wOf(w);
            if (k) for (let c = col; c < col + w.length; c++) blank[li][c] = ' ';
            col += w.length;
            if (!k) continue;
            const kc = style.kwColor || '#6a2a8a';   // (a dark panel passes a light one)
            keep(this.add.text(kx, ky, w, { ...style, color: kc, wordWrap: null }).setDepth(D + 0.1));
            const u = keep(this.add.graphics().setDepth(D + 0.1));
            u.lineStyle(1, Phaser.Display.Color.HexStringToColor(kc).color, 0.6);
            for (let ux = kx; ux < kx + ww - 1; ux += 4) u.lineBetween(ux, ky + lh - 4, Math.min(ux + 2, kx + ww), ky + lh - 4);
            this._tipZone(keep, kx + ww / 2, ky + lh / 2, ww, lh, D, () => ({ title: k[0], body: k[1], accent: 0x9a5ad0 }));
        }
        probe.destroy();
        const h = t.height;
        t.setWordWrapWidth(null).setText(blank.map(l => l.join('')).join('\n'));   // (the same lines, as they wrapped)
        return h;
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
        const D = this._tipDepth || 60, tw = 270;   // (over whatever panel it's in: the lobby's guide sits at 200)
        const head = this.add.text(0, 0, title, { fontSize: '13px', fontFamily: UIKit.FONT.title, fontStyle: 'bold',
            color: accent != null ? UIKit._hex(accent) : '#f3e3b8', wordWrap: { width: tw - 28 } }).setDepth(D + 1);
        const text = this.add.text(0, 0, String(body).replace(/\*/g, ''), { fontSize: '11px', fontFamily: 'monospace', color: '#cdbf9f',   // a body's *keywords* read plain here; light: it's on the iron frame, not paper
            wordWrap: { width: tw - 28 }, lineSpacing: 3 }).setDepth(D + 1);
        const th = head.height + text.height + 30;
        const n = UIKit.nine(this, 'panel', 'panel_a', tw, th, accent ?? UIKit.PALETTE.line), g = this.add.image(0, 0, n.key).setOrigin(0).setDepth(D);
        this._tip = { g, head, text, tw, th, pl: n.pl, pt: n.pt };
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
        T.g.setPosition(x - T.pl, y - T.pt); T.head.setPosition(x + 14, y + 12); T.text.setPosition(x + 14, y + 18 + T.head.height);
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
        const cost = key ? WeaponLevels.perkCost(id, key) : WeaponLevels.dmgCost(id), lock = key && WeaponLevels.needs(id, key);
        if (lock) { Sfx.play(this, 'hurt'); this.setGlurpDialogue(`"Not yet: ${lock}."`); return; }
        if (cost === null) { this.setGlurpDialogue('"That one\'s as good as it gets!"'); return; }
        if (this.glorps < cost) { Sfx.play(this, 'hurt'); this.setGlurpDialogue(`"${cost - this.glorps} more glorps, friend."`); return; }
        this.glorps -= cost;
        localStorage.setItem('glorps', this.glorps);
        if (!key) WeaponLevels.setLevel(id, WeaponLevels.ownedLevel(id) + 1);
        else WeaponLevels.setPerk(id, key, WeaponLevels.ownedPerk(id, key) + 1);
        this._refreshCurrency();
        Sfx.play(this, 'coin');
        const d = key && WeaponLevels._def(id, key), p = key ? WeaponLevels.perk(id, key) : 0;
        this.setGlurpDialogue(!key ? `"Sharper! Power ${WeaponLevels.level(id)}."` : `"${d[1]} ${p}! ${d[5](p)}."`);
        this.time.delayedCall(0, () => this._renderWeapon?.(0));
    }

    // ── ENCHANTING ART (the Isle, EnchantScene, borrows these) ───────────────
    // A book in 3/4 view (24px), from ench_books: its cover in its rarity's material, the page edges and spine, corner caps
    // and a clasp, its enchant's own emblem on the front (8 frames), or a cut gem (4); a glint sweeps the cover. r -1: a
    // sealed one, chained shut; r 5: corrupted. Returns a texture key with an animation of the same key.
    static bookIcon(scene, r, build = null, id = null) {
        const T = scene.textures, A = T.exists('ench_books') ? T.get('ench_books') : null;
        let key = 'ench_book3_' + r + '_' + (id || 'none');
        if (A && !A.has(key)) key = 'ench_book3_' + r + '_none';
        if (!T.exists(key) && A?.has(key)) T.addSpriteSheetFromAtlas(key, { atlas: 'ench_books', frame: key, frameWidth: 24, frameHeight: 24 });
        const n = T.exists(key) ? T.get(key).frameTotal - 1 : 0;
        if (n > 1 && !scene.anims.exists(key)) scene.anims.create({ key, frames: scene.anims.generateFrameNumbers(key, { start: 0, end: n - 1 }), frameRate: 6, repeat: -1 });
        return key;
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
        Sfx.play(this, 'coin');
        const t = PlayerStats.TALENTS[id].find(t => t.at === lvl + 1);
        this.setGlurpDialogue(t ? `"${d.name} ${lvl + 1}! You've earned ${t.name}!"` : `"${d.name} ${lvl + 1}! ${PlayerStats.describe(id, lvl + 1)}."`);
        if (t) Sfx.play(this, 'ult');
        this.time.delayedCall(0, () => { if (this._shopTab === 1) this._showStatsTab({ id, lvl: lvl + 1 }); });
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
        Sfx.play(this, 'coin');
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
        Sfx.play(this, 'coin');
        this.setGlurpDialogue('"Stage ' + stageNum + ' unlocked! Nice!"');
        this.time.delayedCall(0, () => this._showUltTab({ bought: ultKey }));
    }

    // Both purses, from the live values.
    _refreshCurrency() {
        if (this._glorpPill)    this._glorpPill.setLabel(this.glorps.toLocaleString('en-US') + ' Glorps');
        if (this._fragmentPill) this._fragmentPill.setLabel(this.fragments.toLocaleString('en-US') + ' Fragments');
    }

    // Glurp says it: typed out in his voice. Laid out whole first and the letters still to come blanked to spaces (the face is
    // monospace), so the centred lines don't shift as they fill.
    setGlurpDialogue(text) {
        const T = this.glurpDialogue;
        if (!T) return;
        this._glurpTyper?.remove();
        // a long one a size or two smaller, and the bubble grown to hold it
        const lay = fs => T.setFontSize(fs).setText(T.getWrappedText(text).join('\n')).height;
        if (lay(14) > 72 && lay(12) > 130) lay(11);
        const full = T.text;
        this._bubble?.(Math.max(92, T.height + 20));
        T.setText(full.replace(/[^\n]/g, ' '));
        let n = 0;
        this._glurpTyper = this.time.addEvent({ delay: 16, loop: true, callback: () => {
            n = Math.min(full.length, n + 2);
            T.setText(full.slice(0, n) + full.slice(n).replace(/[^\n]/g, ' '));
            if ((n >> 1) % 5 === 0 && /[a-z0-9]/i.test(full[n - 1] || '')) Sfx.play(this, 'blip', { v: 'glurp' });
            if (n >= full.length) this._glurpTyper.remove();
        } });
    }

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
        // the brass platter on its plinth, and its felt in the item's colour
        keep(this.add.image(TT.x - 100, TT.y - 14, 'shop_stall', 'turntable').setOrigin(0).setScale(2).setDepth(7));
        keep(this.add.image(TT.x - 80, TT.y - 13, 'shop_stall', 'tt_felt').setOrigin(0).setScale(2).setDepth(7).setTint(acc));
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
        // its stripes, 34 px each at half size, as many as fill it, accent and cream in turn; a tassel where two scallops meet
        const n2 = Math.max(2, Math.round(aw / 68)), ax = Math.round(S.x0 - 20 + (aw - n2 * 68) / 2), cloth = ShopScene.cloth(acc);
        for (let k = 0; k < n2; k++) keep(this.add.image(ax + k * 68, S.top, 'shop_stall', 'awn_' + (k % 2 ? 'cream' : cloth)).setOrigin(0).setScale(2).setDepth(9));
        for (let k = 1; k < n2; k++) keep(this.add.image(ax + k * 68, S.top + ah, 'shop_stall', 'tassel').setOrigin(0.5, 0).setScale(2).setDepth(9));
        keep(this._plank(S.x0 - 26, S.top - 10, S.x1 - S.x0 + 52, 14, 0x4a3018, 9.1));
        const span = S.x1 - S.x0 - 80, n = banners.length;
        banners.forEach((bn, i) => {
            const x = S.x0 + 40 + span * (i + 0.5) / n, top = S.beam + 22, bh = bn.on ? 74 : 58, bw = bn.label ? 62 : 54, col = bn.col ?? acc;
            const b = keep(this.add.graphics().setDepth(9));
            b.lineStyle(2, 0x2a2a34, 1); b.lineBetween(x - bw / 2 + 6, S.beam + 8, x - bw / 2 + 6, top); b.lineBetween(x + bw / 2 - 6, S.beam + 8, x + bw / 2 - 6, top);
            b.fillStyle(0x000000, 0.35); b.fillRect(x - bw / 2 + 3, top + 3, bw, bh - 6);
            keep(this._plank(x - bw / 2 - 5, top - 5, bw + 10, 8, 0x4a3018, 9));
            keep(this.add.image(x - bw / 2, top, 'shop_stall', `ban${bw / 2}_${ShopScene.cloth(col)}_${bn.on ? 1 : 0}`).setOrigin(0).setScale(2).setDepth(9));
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
        const cx = T.x + T.w / 2;
        keep(this.add.image(cx, T.y - 18, 'shop_stall', 'tagpin').setOrigin(0.5, 0).setScale(2).setDepth(D));
        keep(this.add.graphics().setDepth(D)).fillStyle(0x000000, 0.45).fillRect(T.x + 5, T.y + 7, T.w, T.h);
        ShopScene.parchment(this, T.x, T.y, T.w, T.h, D).forEach(keep);
        keep(this.add.image(cx, T.y + 15, 'shop_stall', 'grommet').setScale(2).setDepth(D));
        return keep(this.add.graphics().setDepth(D));
    }
    // Parchment w x h at (x, y): the typed sheet (a 9-slice) and its two old stains. Returns its objects.
    static parchment(scene, x, y, w, h, depth) {
        return [scene.add.nineslice(x, y, 'shop_stall', 'tag', Math.round(w / 2), Math.round(h / 2), 5, 5, 5, 5).setOrigin(0).setScale(2).setDepth(depth),
                scene.add.image(x + w * 0.8, y + h * 0.7, 'shop_stall', 'stain_l').setScale(2).setDepth(depth),
                scene.add.image(x + w * 0.2, y + h * 0.3, 'shop_stall', 'stain_s').setScale(2).setDepth(depth)];
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

    // A gadget's icon: 24px, four frames, each one doing what the gadget does, typed pixel by pixel: the gadget's rows,
    // then each frame's patches laid over them at (x, y) ('.' keeps what's under). 'g' is a glow pixel: it gets no
    // outline, so sparks and rings float free of the shape.
    static gadgetIcon(scene, id) {
        const ART = {
            // a brass storm canister: a lightning rod on its iron cap, a bolt crackling behind the glass, sparks off the rod
            smite: [{ A: '#fff0a8', B: '#e8b432', b: '#b07a1e', d: '#5e3e14', I: '#c8d2e0', i: '#6e7a94', j: '#323850', G: '#121c36', H: '#2c4a78', Y: '#ffd23a', W: '#fffbd0', g: '#fff6b0' }, [
                '........................',
                '...........IA...........',
                '..........iIIj..........',
                '...........ij...........',
                '..........jIij..........',
                '........jiIIIiij........',
                '.......jIIIIiiiij.......',
                '.......BAAABBBBbb.......',
                '......BAABBBBBBbbd......',
                '......dbbbbbbbbddd......',
                '......BAjjjjjjjjbd......',
                '......BAjGHGGGGjbd......',
                '......BAjHGGGGGjbd......',
                '......BAjGGGGGGjbd......',
                '......BAjGGGGGGjbd......',
                '......BAjGGGGGGjbd......',
                '......BAjjjjjjjjbd......',
                '......dbbbbbbbbddd......',
                '......BAABBBBBBbbd......',
                '......BAABBBBBBbbd......',
                '......dbbbbbbbbddd......',
                '.......jiiiiiiiijj......',
                '........jjjjjjjjj.......',
                '........................',
            ], [
                [[9, 11, ['...WY.', '..WY..', '.WWWY.', '...WY.', '..W...']], [9, 0, ['g....g']]],
                [[9, 11, ['..YW..', '...WY.', '..WWW.', '.YW...', '..W...']], [8, 2, ['g......g']]],
                [[9, 11, ['..YWY.', '.YWY..', 'YWWWWY', '..YWY.', '.YW...']], [7, 0, ['g......g']], [4, 12, ['g']], [19, 14, ['g']]],
                [[9, 11, ['...Y..', '..Y...', '.YYY..', '...Y..']], [14, 1, ['g']]],
            ]],
            // a copper coil wound on an iron core, a cyan orb on top, the pulse rolling out from it
            emp: [{ O: '#f0fdff', C: '#66ddff', c: '#2a90c0', n: '#16486e', K: '#f4a86a', Q: '#c8703a', q: '#7a3a1e', I: '#c8d2e0', i: '#6e7a94', j: '#323850', g: '#9fe8ff' }, [
                '........................',
                '..........ccCc..........',
                '.........cOOCCc.........',
                '........cCOCCCcn........',
                '........cCCCCccn........',
                '........cCCCccnn........',
                '.........nccccn.........',
                '..........nnnn..........',
                '..........jIij..........',
                '.......KKQQQQQQqq.......',
                '........Iiiiiijj........',
                '.......KKQQQQQQqq.......',
                '........Iiiiiijj........',
                '.......KKQQQQQQqq.......',
                '........Iiiiiijj........',
                '.......KKQQQQQQqq.......',
                '.........jIIiij.........',
                '.......jIIIIiiijj.......',
                '......jIIIiiiiiijj......',
                '.....jiiiiiiiiiiijj.....',
                '.....jjjjjjjjjjjjjj.....',
                '........................',
                '........................',
                '........................',
            ], [
                [[5, 1, ['.g', 'g.', 'g.', 'g.', 'g.', '.g']], [17, 1, ['g.', '.g', '.g', '.g', '.g', 'g.']]],
                [[3, 0, ['.g', 'g.', 'g.', 'g.', 'g.', 'g.', 'g.', '.g']], [19, 0, ['g.', '.g', '.g', '.g', '.g', '.g', '.g', 'g.']]],
                [[1, 0, ['.g', 'g.', '..', 'g.', 'g.', '..', 'g.', '.g']], [21, 0, ['g.', '.g', '..', '.g', '.g', '..', '.g', 'g.']], [10, 2, ['O']]],
                [[0, 2, ['g', '.', '.', 'g']], [23, 3, ['g', '.', '.', 'g']], [6, 21, ['g..........g']]],
            ]],
            // a hand-held pocket: a brass ring on a wooden grip, the void inside it turning
            displacer: [{ A: '#fff0a8', B: '#e8b432', b: '#b07a1e', d: '#5e3e14', v: '#12062a', p: '#3c1a78', P: '#9a5cf0', L: '#e8d4ff', H: '#c08a52', h: '#7a4e26', e: '#43280f', g: '#c99bff' }, [
                '.........BBBBBb.........',
                '.......BBAAAABBbb.......',
                '......BAApppppppbd......',
                '.....BAppvvvvvvppbd.....',
                '.....BApvvvvvvvvpbd.....',
                '....BApvvvvvvvvvvpbd....',
                '....BApvvvvvvvvvvpbd....',
                '....BApvvvvvvvvvvpbd....',
                '....BApvvvvvvvvvvpbd....',
                '....bApvvvvvvvvvvpbd....',
                '....bBpvvvvvvvvvvpdd....',
                '.....bBpvvvvvvvvpdd.....',
                '.....bbppvvvvvvppdd.....',
                '......bbbpppppppdd......',
                '.......ddbbbbbbdd.......',
                '.........dddddd.........',
                '..........BAbd..........',
                '..........bBbd..........',
                '..........Hhhe..........',
                '..........Hhhe..........',
                '..........dbbd..........',
                '..........Hhhe..........',
                '.........BAbbd..........',
                '..........dddd..........',
            ], [
                [[7, 3, ['..........', '.....PPP..', '...PP...P.', '..P.......', '..P.LLL...', '...LLL.P..', '.......P..', '.P...PP...', '..PPP.....']]],
                [[7, 3, ['..........', '...P......', '..P...PP..', '.P..LL..P.', '.P.L..L.P.', '.P.L..L.P.', '..PLL..P..', '...PP..P..', '......P...']]],
                [[7, 3, ['..........', '..P.......', '..P....P..', '..P..LL.P.', '...PLL.P..', '...P.LLP..', '..P..P..P.', '.P....P...', '...PPP....']]],
                [[7, 3, ['..........', '....PP....', '..PP..L.P.', '.P...L..P.', '.P.LL.L.P.', '.P.L.LL..P', '.P..L...P.', '..P....PP.', '...P......']]],
            ]],
            // an iron stake driven into split ground, copper bands lighting in turn, a teal crystal at its head
            grounding: [{ T: '#d8fff4', t: '#5af0c0', u: '#1a8a70', I: '#d0d8e8', i: '#8890a8', j: '#4a5068', J: '#262a3c', K: '#f4b07a', Q: '#c8703a', q: '#7a3a1e', E: '#8a6a48', e: '#5a3e26', f: '#2e1e12', g: '#9fffe0' }, [
                '...........T............',
                '..........TTt...........',
                '.........TTtuu..........',
                '.........Ttttu..........',
                '..........tuu...........',
                '..........jIJ...........',
                '.........jIIiJ..........',
                '..........Iij...........',
                '.........KKQQq..........',
                '.........qQQqq..........',
                '..........Iij...........',
                '..........Iij...........',
                '.........KKQQq..........',
                '.........qQQqq..........',
                '..........Iij...........',
                '..........Iij...........',
                '.........KKQQq..........',
                '.........qQQqq..........',
                '..........Iij...........',
                '....EEEEEEiijEEEEEEE....',
                '..EEEeeEfEEijEEfEeeEEE..',
                '..eeeffeeefffffeeffeee..',
                '...ffff..ff...ff.ffff...',
                '........................',
            ], [
                [[9, 8, ['.tTTt', '.utt']], [6, 21, ['g']], [16, 21, ['g']]],
                [[9, 12, ['.tTTt', '.utt']], [5, 22, ['g']], [17, 22, ['g']], [11, 0, ['T']]],
                [[9, 16, ['.tTTt', '.utt']], [3, 20, ['g']], [19, 20, ['g']]],
                [[8, 0, ['g...g', '.....', 'g....g']], [2, 21, ['g']], [20, 21, ['g']]],
            ]],
            // a carved totem: a leaf crown, a face, a heart set in it that beats, motes rising
            mend: [{ L: '#d8ffb0', l: '#7ad05a', m: '#3a8a3a', T: '#e0aa6a', t: '#a8703a', s: '#6e4420', r: '#3a2210', H: '#ffc0c8', h: '#ff5a6a', n: '#a01a3a', e: '#1c1220', g: '#c8ffb0' }, [
                '...........L............',
                '.......l..lLl..l........',
                '......lLl.LLl.Ll........',
                '.......LllLLllLm........',
                '......mLLlLLlllmm.......',
                '........mlllllm.........',
                '.......rTTTttssr........',
                '.......TTttttssr........',
                '.......Trrrttrrr........',
                '.......TeeTtteer........',
                '.......Tttttttsr........',
                '.......Tttrrrssr........',
                '.......TTtttttsr........',
                '.......rrrrrrrrr........',
                '.......TrHHhhnsr........',
                '.......rHHhhhhnr........',
                '.......rHhhhhhnr........',
                '.......Trhhhhnrr........',
                '.......Ttrhhnrsr........',
                '.......TTtrnrssr........',
                '.......TTttttssr........',
                '......TTTttttsssr.......',
                '......rrrrrrrrrrr.......',
                '........................',
            ], [
                [[3, 14, ['g']], [19, 18, ['g']], [18, 7, ['g']]],
                [[3, 11, ['g']], [19, 15, ['g']], [18, 5, ['g']], [8, 14, ['HHHhh', 'HHhhhh', 'Hhhhhhn', '.hhhhn']]],
                [[4, 8, ['g']], [19, 12, ['g']], [18, 3, ['g']]],
                [[4, 5, ['g']], [20, 9, ['g']], [3, 17, ['g']]],
            ]],
            // a block of the dungeon's own stone: battlements, an iron band, a rune on its face pulsing
            bulwark: [{ S: '#ece0c4', s: '#c4b494', o: '#968670', p: '#867862', O: '#64564a', K: '#3a3028', I: '#a8b4c8', i: '#56627a', R: '#ffd060', r: '#a86a20', M: '#86c060', g: '#ffe8a0' }, [
                '........................',
                '........................',
                '...SSSs..SSSs..SSSs.....',
                '...SssO..SssO..SssO.....',
                '...sooO..sooO..sooO.....',
                '...SSSSSSSSSSSSSSSSSs...',
                '...SsssssKsssssssKssO...',
                '...soooopKsoooooopKoO...',
                '...KKKKKKKKKKKKKKKKKK...',
                '...IIIIIiiiiiiiiiiiii...',
                '...sssKsssrrrrssKsssO...',
                '...soOKsoorrrrrsKsoOO...',
                '...KKKKKKKrRRrKKKKKKK...',
                '...ssssssrRrrRrssssKO...',
                '...sMooopKrRRrKsoooOO...',
                '...soooopKrrrrrsooOOO...',
                '...KKKKKKKKKKKKKKKKKK...',
                '...IIIIIiiiiiiiiiiiii...',
                '...sssKssssssssKssssO...',
                '...sooKsoooooooKsooMO...',
                '...OOOKOOOOOOOOKOOOOO...',
                '...KKKKKKKKKKKKKKKKKK...',
                '........................',
                '........................',
            ], [
                [],
                [[11, 12, ['RR'],], [10, 13, ['R..R']], [11, 14, ['RR']]],
                [[11, 12, ['RR']], [10, 13, ['R..R']], [11, 14, ['RR']], [8, 10, ['g......g']], [9, 15, ['g....g']]],
                [[11, 12, ['RR']], [10, 13, ['R..R']], [11, 14, ['RR']]],
            ]],
            // a pink copy of you on a stake, a target on its belly, wobbling to catch the eye; a heart floating up
            decoy: [{ P: '#ffd0e8', p: '#ff8ac4', q: '#d84a92', Q: '#8a1e5a', W: '#ffffff', e: '#2a0e22', R: '#ff3a5a', H: '#c08a52', h: '#7a4e26', g: '#ffd0e8' }, [
                '........................',
                '........................',
                '........................',
                '........................',
                '........................',
                '........................',
                '........................',
                '........................',
                '........................',
                '........................',
                '........................',
                '........................',
                '........................',
                '........................',
                '........................',
                '........................',
                '...........Hh...........',
                '...........Hh...........',
                '...........Hh...........',
                '...........Hh...........',
                '.........hHHhh..........',
                '........hhhhhhh.........',
                '........................',
                '........................',
            ], [0, 1, 0, -1].map((w, f) => [[4 + w, 5, [
                '.......PPPP.......',
                '.....PPPppppq.....',
                '....PPpppppppq....',
                '...PPpWWppWWppq...',
                '...PppWeppWeppq...',
                '..PPppWeppWepppq..',
                '..Pppppppppppppq..',
                '..pppppRRRpppqqq..',
                '..ppppRWWWRppqqq..',
                '..qpppRWRWRpqqqq..',
                '...qqpRWWWRqqqq...',
                '....qqqRRRqqqQ....',
            ]], [[19, 3], [3, 2], [20, 1], [2, 4]][f].concat([['g']])]),
            ],
        };
        const a = ART[id];
        if (!a) return scene.textures.exists('shop_g2_' + id) ? ShopScene.icon(scene, 'shop_g2_' + id, 24, {}, null, 4) : null;   // only a file (assets/art), no painter: its texture and its idle
        const [pal, rows, frames] = a;
        return ShopScene.icon(scene, 'shop_g2_' + id, 24, pal, (m, f) => {
            const put = (r, ox = 0, oy = 0) => r.forEach((s, y) => [...s].forEach((c, x) => c !== '.' && m.set(ox + x, oy + y, c)));
            put(rows);
            for (const [x, y, r] of frames[f]) put(r, x, y);
        }, 4);
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
                keep(this._pointer(x, L.SHELF_Y - 66, d.color));
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
        y += this._tagName(keep, Lx, y, def.name, T.w - 40, D + 1);
        g.lineStyle(1, 0x6a4a26, 0.6); g.lineBetween(Lx, y, R, y); y += 10;
        const words = this._pagedText(keep, Lx, y, T.y + T.h - 84 - 3 * 22 - 28 - y, ShopScene.GADGET_INFO[id] || def.blurb, { fontSize: '13px', fontFamily: 'monospace', color: '#4a3420', wordWrap: { width: T.w - 40 }, lineSpacing: 4 },
            D + 1, 'gadget:' + id, () => this.time.delayedCall(0, () => this._showGadgetTab()));
        this._tagTurn = words.turn;
        y += words.h + 18; g.lineStyle(1, 0x6a4a26, 0.4); g.lineBetween(Lx, y, R, y); y += 10;
        const row = (k2, v, col = INK) => { y += this._tagRow(keep, Lx, R, y, k2, v, col, D + 1); };
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
            Sfx.play(this, 'coin');
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
        // what the case shows: one shelf, today's stock, or yours (the index on the wall picks; the first visit opens on today's)
        if (this._relicView === undefined) { this._relicView = 'today'; this._relicSel = list.findIndex(x => x.id === stock[stock.length - 1]); }
        if (this._relicView === 'yours' && !Relics.owned().length) this._relicView = 'today';
        this._relicSel = Phaser.Math.Clamp(this._relicSel ?? 0, 0, list.length - 1);
        let view = this._relicView || list[this._relicSel].sh;
        if (!this._relicFirst(view)) view = this._relicView = list[this._relicSel].sh;
        const inView = id => [1, 2, 3].some(t => this._relicRow(view, t).some(x => x.id === id));
        if (!inView(list[this._relicSel].id)) this._relicSel = list.findIndex(x => x.id === this._relicFirst(view).id);
        const r = list[this._relicSel], owned = Relics.has(r.id), inStock = stock.includes(r.id), on = worn.includes(r.id);
        const shelf = Relics.shelf(r.sh), VIEW = this._relicViewInfo(view), acc = VIEW.col;
        this._awning(UIKit.PALETTE.brass, [0, 1, 2, 3, 4].map(i => ({ label: ['I', 'II', 'III', 'IV', 'V'][i], on: !!worn[i] && worn[i] === r.id,
            icon: worn[i] ? Relics.icon(this, worn[i]) : null, glyph: i < slots ? 'empty' : (i ? 'F' + Relics.SLOT_AT[i] : 'TOWER') }))).forEach(o => objs.push(o));
        // the bookcase: the stall's plank is the top layer (Legend), two more under it, spread down to just above the counter
        const gapY = (L.CT - 38 - L.SHELF_Y) / 2;
        const LAYER = [L.SHELF_Y, L.SHELF_Y + gapY, L.SHELF_Y + gapY * 2], g = keep(this.add.graphics().setDepth(2.6));
        // the case takes the left of the stall; the display stand (a turntable, as for weapons and ults) the right
        const { BX1, x0: IX0, x1: IX1 } = this._relicCase(), standX = Math.round((BX1 + 30 + S.x1 - 4) / 2);   // the stand, centred in the nook between the upright and the stall's post
        // an upright between the case and the stand: a cabinet with a display nook beside it
        keep(this._plank(BX1 + 6, S.beam + 40, 16, L.CT - S.beam - 40, 0x4a3018, 2.6, true));
        g.fillStyle(0x000000, 0.3); g.fillRect(BX1 + 22, S.beam + 40, 8, L.CT - S.beam - 40);
        for (const y of LAYER) {
            keep(this._plank(S.x0 + 24, y, BX1 - S.x0 - 18, 14, 0x6a4626, 2.6));
            for (const bx of [S.x0 + 60, BX1 - 36]) keep(this._bracket(bx, y + 14, 2.6));
        }
        // the chosen shelf's colour, washed over the back of the case
        const wash = keep(this.add.graphics().setDepth(2.4).setBlendMode(Phaser.BlendModes.ADD));
        wash.fillStyle(acc, 0.06); wash.fillRect(S.x0 + 10, S.beam + 70, BX1 - S.x0, LAYER[2] - S.beam - 40);
        [3, 2, 1].forEach((t, row) => {
            const y = LAYER[row], T = Relics.TIERS[t], items = this._relicRow(view, t);
            // the tier's label on the plank's face, so the relics have the whole shelf
            keep(this.add.text(S.x0 + 34, y + 7, `${['', 'I', 'II', 'III'][t]}  ${T.name}`, { fontSize: '10px', fontFamily: 'monospace', fontStyle: 'bold', color: UIKit._hex(T.col),
                backgroundColor: '#1b1612', padding: { x: 4, y: 1 } }).setOrigin(0, 0.5).setDepth(3));
            const step = items.length > 1 ? Math.min(80, (IX1 - IX0) / (items.length - 1)) : 0;   // (a few sit together mid-shelf)
            items.forEach((it, k) => {
                const x = (IX0 + IX1) / 2 + (k - (items.length - 1) / 2) * step;
                const got = Relics.has(it.id), sel = it.id === r.id, ik = Relics.icon(this, it.id), forSale = stock.includes(it.id);
                if (sel) {
                    const glow = keep(this.add.graphics().setDepth(2.7).setBlendMode(Phaser.BlendModes.ADD));
                    for (const [rr, a] of [[40, 0.06], [28, 0.08], [18, 0.1]]) { glow.fillStyle(it.col, a); glow.fillCircle(x, y - 22, rr); }
                    keep(this._pointer(x, y - 66, acc));
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
        // the shelf's plaque, nailed to the counter's front under the case, and the way to the others
        const pcx = (S.x0 + BX1) / 2, pw = Math.min(320, BX1 - S.x0 - 10), ptop = L.CT + 24, pages = this._relicPages(view);
        const sub = keep(this.add.text(pcx, ptop + 27, VIEW.sub + (pages > 1 ? `  ·  page ${(this._relicPage || 0) + 1} of ${pages}` : ''), { fontSize: '10px', fontFamily: 'monospace', color: UIKit.CSS.textMid,
            align: 'center', wordWrap: { width: pw - 16 } }).setOrigin(0.5, 0).setDepth(7));
        const ph = 34 + sub.height;
        ShopScene.plaque(this, pcx - pw / 2, ptop, pw, ph, acc, 6.5, 0.95).forEach(keep);
        keep(this.add.text(pcx, ptop + 15, VIEW.name, { fontSize: '17px', fontFamily: UIKit.FONT.title, fontStyle: 'bold', color: UIKit._hex(acc) }).setOrigin(0.5).setDepth(7));
        for (const [d, s] of [[-1, '‹'], [1, '›']]) keep(this.add.text(pcx + d * (pw / 2 + 20), ptop + ph / 2, s, { fontSize: '30px', fontFamily: UIKit.FONT.title, color: UIKit.CSS.textHi }).setOrigin(0.5).setDepth(7))
            .setInteractive({ useHandCursor: true }).on('pointerdown', () => pages > 1 ? this._relicTurnPage(d) : this._relicNav(0, 0, d));
        this._relicIndex(keep, view, stock);
        // the display stand: the chosen relic turning in the spotlight
        this._turntable(acc, Relics.icon(this, r.id), { anim: true, dim: !owned, fromDir, scale: 5, x: standX }).forEach(o => objs.push(o));
        // the tag: the buttons at its foot, the ledger over them, the words in what's left (a size smaller, then in pages)
        const T = L.TAG, INK = '#3b2716', Lx = T.x + 20, R = T.x + T.w - 20, W0 = T.w - 40, tier = Relics.TIERS[r.t], sealedUp = !ShopScene.upgradesOpen();
        const by = T.y + T.h - 46, bw = T.w - 40, A = this._siphonA && Relics.def(this._siphonA);
        const canSiphon = !A && owned && !r.corrupt && Relics.owned().filter(id => !Relics.def(id)?.corrupt).length >= 2;
        let label, accent = acc;
        if (owned) label = on ? 'TAKE OFF' : !slots ? 'ENTER THE TOWER' : worn.length >= slots ? 'SLOTS FULL' : 'WEAR IT';
        else if (inStock) label = this.glorps >= r.price ? `BUY  ✦ ${r.price}` : `✦ ${r.price}  ·  NEED ${r.price - this.glorps}`;
        else label = 'FOUND IN THE TOWER';
        if ((owned && !on && worn.length >= slots) || (!owned && (!inStock || this.glorps < r.price))) accent = UIKit.PALETTE.line;
        if (A) {   // siphoning: the main button fuses, the small one backs out
            const ok = this._siphonA !== r.id && owned && !r.corrupt;
            label = ok ? `SIPHON INTO ONE` : 'PICK A SECOND RELIC'; accent = ok ? 0x7aff5a : UIKit.PALETTE.line;
        }
        if (sealedUp) { label = 'SEALED'; accent = UIKit.PALETTE.line; }
        const ledger = [['YOURS', owned ? (on ? `Worn (${['I', 'II', 'III', 'IV', 'V'][worn.indexOf(r.id)]})` : 'Owned') : 'Not yet', owned ? '#3a7a2a' : '#8a2a1a']];
        if (!owned) ledger.push([inStock ? 'IN STOCK TODAY' : 'WHERE', inStock ? `✦ ${r.price}` : r.t === 3 && TowerFloors.best() < Relics.LEGEND_AT ? `Tower floor ${Relics.LEGEND_AT}+` : 'Tower bosses', INK]);
        ledger.push(['SLOTS', `${worn.length} / ${slots} worn`, INK]);
        const nextSlot = slots < 5 ? `next slot: ${Relics.slotNeeds(slots)}` : null;
        this._ownTag(objs, redraw => {
            const mine = [], keep = o => { mine.push(o); return o; };
            const tg = this._tagSheet(T, keep, D);
            UIKit.button(this, { x: T.x + T.w / 2, y: by, w: bw, h: 46, depth: D + 2, fontSize: '17px', fireOn: 'down', label, accent, onClick: () => this._relicActivate() }).objs.forEach(keep);
            // the foot, built up from the big button: the small one, then a line about what's going on
            let foot = by - 23;
            if (A) UIKit.button(this, { x: T.x + T.w / 2, y: foot - 17, w: bw, h: 26, depth: D + 2, fontSize: '12px', fireOn: 'down', label: 'CANCEL', accent: UIKit.PALETTE.line, onClick: () => { this._siphonA = null; this._showRelicTab(); } }).objs.forEach(keep);
            else if (canSiphon) UIKit.button(this, { x: T.x + T.w / 2, y: foot - 17, w: bw, h: 26, depth: D + 2, fontSize: '12px', fireOn: 'down', label: 'SIPHON TWO INTO ONE', accent: 0x3a8a2a,
                onClick: () => { this._siphonA = r.id; Sfx.play(this, 'click'); this.setGlurpDialogue(`"Siphon the ${r.name}? Both go for good, and what comes out keeps half of each, plus a curse. Pick the other one."`); this._showRelicTab(); } }).objs.forEach(keep);
            if (A || canSiphon) foot -= 30;
            const cap = A ? [`siphoning the ${A.name}`, '#2a6a1a'] : sealedUp ? [`SEALED  ·  ${ShopScene.UPGRADES_SEALED.short}`, '#8a2a1a'] : canSiphon ? ['two of yours fuse into one, corrupted', '#2a6a1a'] : null;
            if (cap) foot -= 4 + keep(this.add.text(T.x + T.w / 2, foot - 4, cap[0], { fontSize: '11px', fontFamily: 'monospace', fontStyle: 'bold', color: cap[1], align: 'center', wordWrap: { width: W0 } }).setOrigin(0.5, 1).setDepth(D + 1)).height;
            let y = T.y + 30;
            keep(this.add.text(Lx, y, `${shelf.name}  ·  ${tier.name}`, { fontSize: '11px', fontFamily: 'monospace', fontStyle: 'bold', color: UIKit._hex(MenuArt.mix(acc, 0x3b2716, 0.45)) }).setDepth(D + 1));
            keep(this.add.text(R, y, `${Relics.owned().length} / ${list.length}`, { fontSize: '11px', fontFamily: 'monospace', color: '#7a5a34' }).setOrigin(1, 0).setDepth(D + 1));
            y += 18;
            y += this._tagName(keep, Lx, y, r.name, W0, D + 1);
            tg.lineStyle(1, 0x6a4a26, 0.6); tg.lineBetween(Lx, y, R, y); y += 10;
            const ledgerH = ledger.reduce((h, [k, v, c]) => h + this._tagRow(null, Lx, R, 0, k, v, c, 0, true), 0) + (nextSlot ? 16 : 0);
            const room = foot - 8 - ledgerH - 28 - y, text = Relics.text(r);
            const style = fs => ({ fontSize: fs + 'px', fontFamily: 'monospace', color: '#4a3420', wordWrap: { width: W0 }, lineSpacing: fs > 12 ? 5 : 3 });
            let fs = 14;
            while (fs > 11 && this._textH(text, style(fs)) > room) fs--;
            const words = this._pagedText(keep, Lx, y, room, text, style(fs), D + 1, 'relic:' + r.id, redraw);
            this._tagTurn = words.turn;
            y += words.h + 18;
            tg.lineStyle(1, 0x6a4a26, 0.4); tg.lineBetween(Lx, y, R, y); y += 10;
            for (const [k, v, c] of ledger) y += this._tagRow(keep, Lx, R, y, k, v, c, D + 1);
            if (nextSlot) keep(this.add.text(Lx, y + 2, nextSlot, { fontSize: '10px', fontFamily: 'monospace', color: '#7a5a34' }).setDepth(D + 1));
            return mine;
        });
        if (sealedUp) objs.push(UIKit.chains(this, standX, L.TT.y - 90, 210, 170, { depth: 8, link: 11, lock: 26 }));   // sealed: the case chained shut, on the relic's own stand
        this._relicTabObjs = objs;
    }
    // A view of the case: 'today' (today's stock), 'yours' (every relic you own, in pages of RELIC_PER a layer), or a shelf's id.
    // Its relics on one tier's layer:
    _relicRow(view, t) {
        if (view === 'today') return Relics.stock().map(id => Relics.def(id)).filter(x => x && x.t === t);
        if (view === 'yours') { const all = Relics.owned().map(id => Relics.def(id)).filter(x => x && x.t === t), p = this._relicPage || 0, n = this._relicPer(); return all.slice(p * n, (p + 1) * n); }
        return Relics.onShelf(view, t);
    }
    _relicPages(view) { return view === 'yours' ? Math.max(1, ...[1, 2, 3].map(t => Math.ceil(Relics.owned().map(id => Relics.def(id)).filter(x => x && x.t === t).length / this._relicPer()))) : 1; }
    // The case's shape: the case left of BX1, its relics standing from x0 to x1; the stand's nook to the right (narrower in a
    // small window). And how many relics a layer has room for side by side (no more than RELIC_PER; yours turn pages past that).
    _relicCase() { const S = this._layout.S, BX1 = S.x1 - Math.min(250, Math.max(214, Math.round((S.x1 - S.x0) * 0.4))); return { BX1, x0: S.x0 + 50, x1: BX1 - 30 }; }
    _relicPer() { const c = this._relicCase(); return Math.min(ShopScene.RELIC_PER, 1 + Math.floor((c.x1 - c.x0) / 40)); }
    _relicFirst(view) { for (const t of [3, 2, 1]) { const it = this._relicRow(view, t); if (it.length) return it[0]; } return null; }
    // the views in the index's order: today's, yours (once you own one), then every shelf with something on it
    _relicViews() { return ['today', ...(Relics.owned().length ? ['yours'] : []), ...Relics.SHELVES.filter(sh => [1, 2, 3].some(t => Relics.onShelf(sh.id, t).length)).map(sh => sh.id)]; }
    _relicViewInfo(view) {
        if (view === 'today') return { name: "TODAY'S STOCK", sub: 'new ones every day  ·  the rest from Tower bosses', col: 0xf0b84a };
        if (view === 'yours') { const n = Relics.owned().length, w = Relics.worn().length; return { name: 'YOUR RELICS', sub: `${n} owned  ·  ${w} worn`, col: 0x7fd06a }; }
        const sh = Relics.shelf(view), have = Relics.all().filter(x => x.sh === view && Relics.has(x.id)).length, of = Relics.all().filter(x => x.sh === view).length;
        return { name: sh.name, sub: `${sh.build}  ·  ${have} of ${of} owned`, col: sh.col };
    }
    _relicTurnPage(d) {
        const n = this._relicPages('yours');
        this._relicPage = ((this._relicPage || 0) + d + n) % n;
        const f = this._relicFirst('yours');
        if (f) this._relicGo(Relics.all().findIndex(x => x.id === f.id), d);
    }
    _relicPick(view) {
        this._relicView = view; this._relicPage = 0;
        const f = this._relicFirst(view);
        if (f) this._relicGo(Relics.all().findIndex(x => x.id === f.id), 1);
    }
    // The index on the wall left of the case: every view by name, how many of it you own, a ✦ where something's in stock today;
    // click one to open it
    _relicIndex(keep, view, stock) {
        const L = this._layout, S = L.S, x0 = 16, x1 = S.x0 - 22, top = 66, bottom = L.CT - 232;
        const views = this._relicViews(), rowH = Math.min(20, Math.floor((bottom - top - 30) / views.length));
        if (x1 - x0 < 150 || rowH < 13) return;
        const g = keep(this.add.graphics().setDepth(3));
        const h = 26 + rowH * views.length + 8;
        ShopScene.plaque(this, x0, top, x1 - x0, h, 0x6a4a26, 3, 0.88).forEach(keep);
        keep(this.add.text(x0 + 10, top + 7, 'THE RELIC CASE', { fontSize: '10px', fontFamily: 'monospace', fontStyle: 'bold', color: UIKit.CSS.textLo }).setDepth(4));
        keep(this.add.text(x1 - 10, top + 7, `${Relics.owned().length} / ${Relics.all().length}`, { fontSize: '10px', fontFamily: 'monospace', color: UIKit.CSS.textLo }).setOrigin(1, 0).setDepth(4));
        const fs = rowH >= 18 ? '12px' : '11px';
        views.forEach((v, i) => {
            const y = top + 26 + i * rowH, I = this._relicViewInfo(v), on = v === view;
            let count;
            if (v === 'today') count = `${stock.filter(id => !Relics.has(id)).length} for sale`;
            else if (v === 'yours') count = `${Relics.worn().length} worn`;
            else count = `${Relics.all().filter(x => x.sh === v && Relics.has(x.id)).length}/${Relics.all().filter(x => x.sh === v).length}`;
            if (on) { g.fillStyle(I.col, 0.22); g.fillRect(x0 + 4, y - 1, x1 - x0 - 8, rowH); g.fillStyle(I.col, 1); g.fillRect(x0 + 4, y - 1, 3, rowH); }
            if (i === 2 || (i === 1 && views[1] !== 'yours')) { g.lineStyle(1, 0x6a4a26, 0.6); g.lineBetween(x0 + 8, y - 2, x1 - 8, y - 2); }
            const name = v === 'today' ? "✦ TODAY'S STOCK" : v === 'yours' ? '★ YOURS' : I.name;
            const sale = v !== 'today' && v !== 'yours' && stock.some(id => Relics.def(id)?.sh === v && !Relics.has(id));
            keep(this.add.text(x0 + 12, y + rowH / 2 - 1, name, { fontSize: fs, fontFamily: UIKit.FONT.title, fontStyle: 'bold', color: on ? '#fff4d6' : UIKit._hex(I.col) }).setOrigin(0, 0.5).setDepth(4));
            keep(this.add.text(x1 - 12, y + rowH / 2 - 1, (sale ? '✦ ' : '') + count, { fontSize: '10px', fontFamily: 'monospace', color: sale ? '#f0b84a' : UIKit.CSS.textMid }).setOrigin(1, 0.5).setDepth(4));
            keep(this.add.zone((x0 + x1) / 2, y + rowH / 2 - 1, x1 - x0 - 8, rowH).setInteractive({ useHandCursor: true }).setDepth(12))
                .on('pointerdown', () => { if (!on) { Sfx.play(this, 'click'); this._relicPick(v); } });
        });
    }
    // ← → along a layer (off a shelf's end onto the next shelf; round and round today's and yours, through yours's pages),
    // ↑ ↓ between the tiers, Q / E the next view in the index.
    _relicNav(dx, dy = 0, dView = 0) {
        const list = Relics.all(), r = list[this._relicSel ?? 0], V = this._relicViews(), shelfView = v => v !== 'today' && v !== 'yours';
        let view = this._relicView || r.sh, t = r.t, items = this._relicRow(view, t), k = Math.max(0, items.findIndex(x => x.id === r.id));
        let vi = Math.max(0, V.indexOf(view));
        const firstIn = v => { for (const tt of [t, 3, 2, 1]) { const it = this._relicRow(v, tt); if (it.length) return [tt, it]; } return null; };
        const step = (d, shelvesOnly) => { for (let n = 0; n < V.length; n++) { vi = (vi + d + V.length) % V.length; if (shelvesOnly && !shelfView(V[vi])) continue; this._relicPage = 0; const f = firstIn(V[vi]); if (f) { view = V[vi]; [t, items] = f; return true; } } return false; };
        if (dView) { if (!step(dView, false)) return; items = this._relicRow(view, t); k = Math.min(k, items.length - 1); }
        else if (dy) {
            const nt = Phaser.Math.Clamp(t - dy, 1, 3);   // up is a better tier
            if (nt === t) return;
            const was = items.length, next = this._relicRow(view, nt);
            if (!next.length) return;
            t = nt; items = next;
            k = Math.round(was > 1 ? k / (was - 1) * (items.length - 1) : 0);
        } else {
            k += dx;
            if (k < 0 || k >= items.length) {
                if (shelfView(view)) { step(dx, true); items = this._relicRow(view, t); k = dx > 0 ? 0 : items.length - 1; }
                else if (view === 'yours' && this._relicPages('yours') > 1) return this._relicTurnPage(dx);
                else k = (k + items.length) % items.length;
            }
        }
        this._relicView = view;
        this._relicGo(list.findIndex(x => x.id === items[k].id), dx || dy || dView);
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
        if (!ShopScene.upgradesOpen()) { Sfx.play(this, 'deny'); this.setGlurpDialogue(`"${ShopScene.UPGRADES_SEALED.glurp}"`); return; }
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
            Sfx.play(this, 'coin');
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
        this._relicSel = Relics.all().findIndex(x => x.id === id); this._relicView = 'yours'; this._relicPage = 0;
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
        const a = acc[U.key], cur = stageOf(U.key), sealed = !ShopScene.elementOpen(U.key) || !ShopScene.upgradesOpen();
        const sealWhy = !ShopScene.upgradesOpen() ? ShopScene.UPGRADES_SEALED : ShopScene.SEALED[U.key];

        // the elements, as banners: each shows the stage you have
        this._awning(a, ELS.map((u, r) => ({ label: { fire: 'FIRE', ice: 'ICE', lightning: 'BOLT', cosmic: 'VOID' }[u.key], on: r === sel.r,
            icon: ShopScene.relicIcon(this, u.key, stageOf(u.key)),
            onClick: () => { if (r === sel.r) return; this._ultSel = { r, k: sel.k }; Sfx.play(this, 'hover'); this.time.delayedCall(0, () => this._showUltTab()); } })))
            .forEach(o => objs.push(o));

        // the shelf: stages I, II, III
        const SY = L.SHELF_Y;
        keep(this._plank(S.x0 + 26, SY, S.x1 - S.x0 - 52, 10, 0x6a4626, 2.5));
        const span = S.x1 - S.x0 - 220;
        U.stages.forEach((st, k) => {
            const n = k + 1, x = S.x0 + 110 + span * (k / 2), on = k === sel.k;
            const owned = cur >= n, isCur = cur === n, next = n === cur + 1, soon = !!st.soon;
            const rk = ShopScene.relicIcon(this, U.key, n);
            const ic = keep(this.add.sprite(x, SY + 2, rk, '0').setOrigin(0.5, 1).setScale((on ? 2.3 : 1.9) * this._layout.UI).setDepth(3));
            if (!owned || sealed) ic.setTint(soon || sealed ? 0x2a2420 : 0x6a5a48); else if (on || isCur) ic.play(rk);
            if (isCur) { const gl = keep(this.add.image(x, SY - 22, 'mn_glow').setTint(a).setBlendMode(Phaser.BlendModes.ADD).setDisplaySize(70, 70).setAlpha(0.45).setDepth(2.9)); this.tweens.add({ targets: gl, alpha: 0.75, duration: 900, yoyo: true, repeat: -1 }); }
            if (sealed) keep(UIKit.chains(this, x, SY - 26, 58, 52, { depth: 3.5, link: 6, lock: 13 }));
            const label = sealed ? 'SEALED' : isCur ? '★' : owned ? '✓' : soon ? 'SOON' : next ? `◈${st.fragCost} ✦${st.glorpCost}` : `◈${st.fragCost}`;
            keep(this.add.text(x, SY + 20, label, { fontSize: '11px', fontFamily: 'monospace', fontStyle: 'bold',
                color: isCur || owned ? '#1b1612' : '#3b2716', backgroundColor: isCur ? '#7fd06a' : owned ? '#d2bf98' : '#e8d6ae', padding: { x: 4, y: 1 } })
                .setOrigin(0.5, 0).setDepth(3).setAngle(owned ? 0 : -4).setAlpha(soon ? 0.6 : on ? 1 : 0.8));
            if (on) {
                keep(this._pointer(x, SY - 70, a));
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
        if (sealed) objs.push(UIKit.chains(this, L.TT.x, L.TT.y - 90, 210, 170, { depth: 8, link: 11, lock: 26 }));
        if (st0.soon) tt.forEach(o => o.type === 'Sprite' && o.setTint(0x2a2420));
        if (bought === U.key) {
            const sp = keep(this.add.particles(L.TT.x, L.TT.y - 82, 'mn_px2', { speed: { min: 60, max: 200 }, lifespan: 800, scale: { start: 2.4, end: 0 },
                tint: [a, 0xffffff, UIKit.PALETTE.accentGold], blendMode: 'ADD', emitting: false }).setDepth(9));
            sp.explode(40);
        }

        // the tag: the chosen stage. The ledger and the button at its foot, the words in what's left: a long one hangs the tag
        // longer, steps down a size or two, then turns in pages.
        const st = U.stages[sel.k], n = sel.k + 1;
        const owned = cur >= n, next = n === cur + 1, soon = !!st.soon;
        const can = next && !soon && !sealed && this.glorps >= st.glorpCost && this.fragments >= st.fragCost;
        const INK = '#3b2716', W0 = L.TAG.w - 40;
        const ledger = [];
        if (n > 1) ledger.push(['COSTS', `◈ ${st.fragCost}  ·  ✦ ${st.glorpCost}`, INK]);
        ledger.push(['YOURS', cur === n ? 'Active' : owned ? 'Owned' : soon ? 'Not built yet' : 'Not yet', owned ? '#3a7a2a' : '#8a2a1a']);
        if (!owned && !soon) ledger.push(['YOUR PURSE', `◈ ${this.fragments}  ·  ✦ ${this.glorps}`, can ? '#3a7a2a' : '#8a2a1a']);
        if (sealed) ledger.push(['SEALED', sealWhy.short, '#8a2a1a']);
        const style = fs => ({ fontSize: fs + 'px', fontFamily: 'monospace', color: soon ? '#7a5a34' : '#4a3420', wordWrap: { width: W0 }, lineSpacing: fs > 12 ? 4 : 3 });
        const ledgerH = ledger.reduce((h, [k, v, c]) => h + this._tagRow(null, 0, W0, 0, k, v, c, 0, true), 0);
        let T = L.TAG;
        if (98 + this._textH(st.desc, style(13)) + 28 + ledgerH + 84 > T.h) T = { ...T, h: Math.min(this.scale.height - 36 - T.y, T.h + 80) };
        const label = sealed ? 'SEALED' : owned ? (cur === n ? 'ACTIVE' : 'OWNED') : soon ? 'COMING SOON' : !next ? `STAGE ${cur + 1} FIRST` : can ? 'UPGRADE  ▸' : 'NOT ENOUGH';
        this._ownTag(objs, redraw => {
            const mine = [], keep = o => { mine.push(o); return o; };
            const g = this._tagSheet(T, keep, D), Lx = T.x + 20, R = T.x + T.w - 20;
            let y = T.y + 30;
            keep(this.add.text(Lx, y, `${U.label}  ·  STAGE ${['I', 'II', 'III'][sel.k]}`, { fontSize: '11px', fontFamily: 'monospace', fontStyle: 'bold', color: UIKit._hex(MenuArt.mix(acc[U.key], 0x3b2716, 0.45)) }).setDepth(D + 1));
            y += 18;
            y += this._tagName(keep, Lx, y, U.name, W0, D + 1);
            g.lineStyle(1, 0x6a4a26, 0.6); g.lineBetween(Lx, y, R, y); y += 10;
            const room = T.y + T.h - 84 - ledgerH - 28 - y;
            let fs = 13;
            while (fs > 11 && this._textH(st.desc, style(fs)) > room) fs--;
            const words = this._pagedText(keep, Lx, y, room, st.desc, style(fs), D + 1, `ult:${U.key}:${n}`, redraw);
            this._tagTurn = words.turn;
            y += words.h + 18; g.lineStyle(1, 0x6a4a26, 0.4); g.lineBetween(Lx, y, R, y); y += 10;
            for (const [k, v, c] of ledger) y += this._tagRow(keep, Lx, R, y, k, v, c, D + 1);
            UIKit.button(this, { x: T.x + T.w / 2, y: T.y + T.h - 46, w: T.w - 40, h: 46, depth: D + 2, fontSize: '18px', fireOn: 'down', label,
                accent: can ? acc[U.key] : UIKit.PALETTE.line, onClick: () => this._ultActivate() }).objs.forEach(keep);
            return mine;
        });
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
        if (!ShopScene.upgradesOpen()) { Sfx.play(this, 'deny'); this.setGlurpDialogue(`"${ShopScene.UPGRADES_SEALED.glurp}"`); return; }
        if (!ShopScene.elementOpen(U.key)) { Sfx.play(this, 'deny'); this.setGlurpDialogue(`"${ShopScene.SEALED[U.key].glurp}"`); return; }
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
// Every weapon, by element, in shelf order. Priced by tier (ShopScene.TIER): 150 / 400 / 700 for
// tiers 2 / 3 / 4 (till 2026-10-20 each had its own: a tier-3 cannon cost less than a tier-2 orb). Cosmic
// weapons are buffs (Cosmic.js): switch to cosmic, cast, switch back.
ShopScene.CATALOGUE = [
    { id: 'flame_fists', name: 'Flame Fists', element: 'fire', cost: 0, defaultWeapon: true,
      desc: 'Quick 1-tile punch. Leaves a small *lava* patch on every hit. Default weapon.' },
    { id: 'flame_sword', name: 'Flame Sword', element: 'fire', cost: 150,
      desc: 'A narrow, hard swing: the 3 tiles in front and the one beyond. *Lava* on every tile hit; each hit applies a *Burn* stack. Every swing also flings 3 weak embers ahead that apply a *Burn* stack to what they hit.' },
    { id: 'magma_staff', name: 'Magma Staff', element: 'fire', cost: 400,
      desc: 'Heats up as you land hits: more fireballs, faster, and they splash. Press R: *Magma Surge*.' },
    { id: 'ignition', name: 'Ignition', element: 'fire', cost: 700,
      desc: 'Flamethrower. Click to light it or put it out; the cursor aims it. It runs on fuel (9s lit, refills while it\'s out; run it dry and it sputters out for a moment). A long, wide fan of fire that *kindles* the first two enemies it finds and stays on them: weak chip (plus 0.1% of their max HP a tick) while it fills, then they melt. Everything in the flame can catch a *Burn* stack. Press G (Detonate) to set every kindled mark off. Press R: *Blue Flame*.' },
    { id: 'ember_scythe', name: 'Ember Scythe', element: 'fire', cost: 1000,
      desc: 'Click: whirl the long scythe round you once (twice, then three times, with Reaper\'s Whirl), cutting everything within 4 tiles (a *Burn* stack each turn). Each swing sets an *ember* alight nearby, and each enemy it cuts drops an *ember soul*. Press R with 5 souls: *Heat Wave*. After either, if you\'re moving, you slide 3 tiles toward the crosshair for free and get a small shield.' },
    { id: 'ice_fists', name: 'Ice Fists', element: 'ice', cost: 0, defaultWeapon: true,
      desc: '1-tile ice punch. Every hit applies *Chill*; a full bar freezes the enemy into a cube and applies *Brittle*. Default weapon.' },
    { id: 'icicle_cannon', name: 'Icicle Cannon', element: 'ice', cost: 150,
      desc: 'An ice shotgun: a cone of icicles that splash and apply *Chill*. Up close every icicle lands; far off, fewer. 28 hits charge a *Frost Shield* (R).' },
    { id: 'fractal_shard', name: 'Fractal Shard', element: 'ice', cost: 400,
      desc: 'Click: a heavy crystal flies where you aim. Every spike that hits an enemy splits in two, smaller branches forking on at an angle, and those split again on their hits, three times over: one shot grows a tree of ice through a pack, and no enemy is hit twice by the same tree. Alone, a target takes the crystal\'s heavy hit. Every spike chills; one that hits an ice cube splits even at its smallest. A shot whose tree forks twice (or hits an ice cube) charges R. Press R at five: *Fractal Bloom*.' },
    { id: 'rimeguard', name: 'Rimeguard', element: 'ice', cost: 700,
      desc: 'A tower shield of glacier ice and a short maul. Click: a heavy slam down a wide cone, 3 tiles (more *Chill*), and what it hits is *taunted*; the more armor you have, the harder it hits. Hold right-click (or tap G to toggle it) to raise the shield toward your aim: it blocks 70% of a hit from in front, but the maul is a short, slow jab behind it. On any element, every hit an enemy lands on you is a charge of *rime*; at 8 it goes off on its own: *Shatterback*, bigger the more max HP you have. Holding it, R lets it go early.' },
    { id: 'boreal_trident', name: 'Boreal Trident', element: 'ice', cost: 1000,
      desc: 'A trident of glacier ice. Every hit of its combo has an aftershock a moment later. Click: a *thrust*, a quick poke down a line 8 tiles long and 3 wide that leaves *rime marks*, driving a jet of seawater down it that freezes and explodes into a spine of ice, the tip last; a *swipe*, a wide fan 3.5 tiles out that marks everything in it and knocks shots out of the air, throwing a sheet of seawater that flash-freezes and explodes outward, leaving rime; then a *leap*: up into the air, steered with the movement keys over enemies, hazards and walls (a click brings you down early; the longer you stay up, the harder you come down), slamming a 7x7 footprint round you (*frostbite*), and a moment later the rime erupts out of the floor and shatters every mark for much more. Hold, then let go: *hurl* it straight (5 tiles, up to 8 the longer it\'s drawn), once every 7s: it impales what it hits and its rip current drags in what\'s near its line, pinning them to a wall (a long daze, sealed in rime) or dropping them at its range. A throw that caught something brings *frost rush*: the combo nearly twice as fast for 4s. Every enemy the combo hits is frost; R with 48: *frostkin*, and a frost shell round you worth 20% of your max HP that takes hits before your health till it breaks (a call tops it back up). A full combo whose thrust, swipe and slam each hit something raises a *frost shield* for 3s, as the Icicle Cannon\'s does; not again while it\'s up, nor for 3s after (the combo pips dim till it\'s back). Held, its *boreal aura* slows enemy shots near you to about a third of their speed.' },
    { id: 'lightning_fists', name: 'Storm Fists', element: 'lightning', cost: 0, defaultWeapon: true,
      desc: '1-tile punch that chains lightning to nearby enemies. Default weapon.' },
    { id: 'orb_emitter', name: 'Orb Emitter', element: 'lightning', cost: 150,
      desc: 'Fires a bouncing electric orb that chains to every nearby enemy. Its forks apply *Amped* to what they hit.' },
    { id: 'ball_lightning', name: 'Ball Lightning', element: 'lightning', cost: 400,
      desc: 'Slow orb. Forks chain enemy to enemy, and further through water. Embeds on contact, applying *Amped* to its host, then bursts into seekers.' },
    { id: 'conductor', name: 'Circuit Breaker', element: 'lightning', cost: 700,
      desc: 'Throws wires that clamp onto enemies (up to 3) and daze them. R turns on the *current*: down the wire nearest your aim, again each time it\'s ready, until you press R again or no wire is left. At a wire, tap G to change it between *live wire*, *insulator* and *capacitor*, or hold G to cut it: a live wire cracks its enemy, an insulator dazes what\'s near, a capacitor dumps its charge (G elsewhere picks your next clamp). Lines shock what they touch, and wired enemies close together chain into a *circuit*: double for two, more for each one you add. Wires stay on when you switch element.' },
    { id: 'thunder_glaive', name: 'Thunder Glaive', element: 'lightning', cost: 1000,
      desc: 'Click: *pivot strike*, a dash through the enemy nearest the cursor and on past it (the closer you start, the further you go), untouchable, striking and Amping all on the line; each enemy struck is a *volt*. Each dash leaves a live *rope*. Click a new pivot within a second of landing and the streak goes on; when it ends the ropes go off in a *boom* that gives volts back, sets off an *overload* and leaves a *cage*. R plants a *tesla coil* (1 volt, up to 3). Ropes, cage and coils are one network: twice a second its current runs into every Amped enemy touching it and jumps on from Amped enemy to Amped enemy, harder the more of them there are. Volts are its fuel: keep dashing or it goes quiet. Insulated enemies (armoured, or made of lightning) can\'t be Amped and don\'t conduct.' },
    { id: 'cosmic_fists', name: 'Void Fists', element: 'cosmic', cost: 0, defaultWeapon: true,
      desc: 'Punch and dash to build *Momentum* (max 3).' },
    { id: 'barrier_staff', name: 'Barrier Staff', element: 'cosmic', cost: 150,
      desc: '4 *wards* orbit you for 10s. Each one eats a projectile, applies *Hex* to whoever fired it (5s) and knocks nearby enemies 2 tiles back. Cooldown 9s.' },
    { id: 'astrolabe', name: 'Astrolabe', element: 'cosmic', cost: 200,
      desc: 'Starfall (in a fight): stars crash around the room, applying *Dazed* to enemies in a small area. Collect them; each applies a *Mark* to 2 foes. Hitting a *Mark* pops it for ult charge.' },
    { id: 'singularity_staff', name: 'Singularity', element: 'cosmic', cost: 250,
      desc: 'Fires a seed of a black hole from the staff that speeds up toward your cursor, applying *Hex* (1s) to what it passes, and opens a well there. The well pulls enemies in and grows; the longer they stay, the more *Hex* stacks build (one every 2s, fading 1s after they leave). When it collapses it applies *Dazed* to everything inside. While it\'s out and 5s after: Event Horizon, -30% damage taken.' },
    { id: 'void_blade', name: 'Void Blade', element: 'cosmic', cost: 300,
      desc: 'Hold to charge, release to slash: up to 18 tiles long, 3 wide, applying *Stunned* for up to 3.5s. Leaves *cosmic fluid* that applies *Hex* for longer than anything else (up to 14s). The longer the charge, the more of all of it.' },
    { id: 'pendulum', name: 'Pendulum', element: 'cosmic', cost: 400,
      desc: 'A support tool with no attack: a brass pendulum, an astral glass for its bob. Click: fling it onto the cursor (6 tiles at most); it grows into a great pendulum and lands as a *Time Lock*: a 7x7 with its corners cut where, for 4s, time stops for everything but you. Enemies in it can\'t act or be moved and take nothing; every hit on them is stored, and it all lands at once when time starts again. Press R: *Rewind*, back to where you were 3s ago, with the HP you\'ve lost since. One cooldown for both: 12s after the Time Lock, 30s after Rewind.' },
];

// Lightning and cosmic are sealed in the shop (weapons and ult stages) until the story gives them (devMode opens all).
// Relics and ult stages open once the tutorial's done and Tower floor 1 is cleared (devMode opens them)
ShopScene.upgradesOpen = () => localStorage.getItem('devMode') === 'true' || (localStorage.getItem('cleared_tutorial') === '1' && (parseInt(localStorage.getItem('tower_best') || '0', 10) || 0) >= 1);
ShopScene.RELIC_PER = 6;   // relics a layer of the case shows at once when it shows yours (more: pages)
ShopScene.UPGRADES_SEALED = { short: 'the tutorial, then Tower floor 1', glurp: "Relics and ult stages? Finish the tutorial and clear the Tower's first floor, then we'll talk." };
ShopScene.elementOpen = el => (el !== 'lightning' && el !== 'cosmic') || localStorage.getItem('unlocked_' + el) === 'true' || localStorage.getItem('devMode') === 'true';
ShopScene.SEALED = {
    lightning: { short: 'clear the Gauntlet', glurp: "Lightning's still sealed, friend. Clear the Gauntlet and it's yours to shop." },
    cosmic:    { short: 'clear the Void Rift', glurp: "Cosmic? Not till you've cleared the Void Rift. I don't sell what you can't hold." },
};

// Tiers, from Weapons not listed there show none.
ShopScene.TIER = {
    flame_fists: 1, flame_sword: 2, magma_staff: 3, ignition: 4, ember_scythe: 5,
    ice_fists: 1, icicle_cannon: 2, fractal_shard: 3, rimeguard: 4, boreal_trident: 5,
    lightning_fists: 1, orb_emitter: 2, ball_lightning: 3, conductor: 4, thunder_glaive: 5,
    cosmic_fists: 1, singularity_staff: 3, pendulum: 4,
};

// What each weapon is good at, out of 10: [one target, crowd, utility]. The element's job
// first: fire hits one thing hard and crowds poorly (the Magma Staff is
// fire's tier-3 exception, and measures as the best crowd weapon there is); lightning is
// weak on one target and strong on crowds, sometimes with real utility (the Orb Emitter's
// amping); ice is the utility element (chill, cubes, marks, the cannon's heal).
// Cosmic weapons are buffs and aren't rated. Judgement, not measurement: keep it in step with
// ShopScene.DPS below when a weapon changes.
ShopScene.RATINGS = {
    flame_fists: [6, 2, 1], flame_sword: [6, 3, 1], magma_staff: [8, 4, 2], ignition: [10, 2, 1], ember_scythe: [9, 8, 5],
    ice_fists: [4, 2, 7], icicle_cannon: [5, 5, 7], fractal_shard: [6, 6, 9], rimeguard: [5, 7, 9], boreal_trident: [6, 7, 10],
    lightning_fists: [2, 6, 3], orb_emitter: [1, 7, 7], ball_lightning: [2, 9, 5], conductor: [2, 10, 6], thunder_glaive: [4, 8, 8],
};

// Measured damage per second [one target, group of 5], against dummies. Re-measure and update
// these after any weapon change. Cosmic weapons are movement-based and unmeasured.
ShopScene.DPS = {   // re-measured 2026-10-29 by the game clock, the median of 3 runs (the scythe of 7) (Ignition as the flamethrower: lit, fuel managed, detonated at the stored ring)
    flame_fists: [48.5, 47.1], flame_sword: [50.4, 157], magma_staff: [70.6, 166.5], ignition: [62.9, 124.6], ember_scythe: [32, 125.4],   // (the scythe: swings only, one turn, no Heat Wave; Reaper's Whirl 29.3 / 168.4, both levels 45.7 / 182.9. With the Heat Wave, walking for its souls, 46.5 / 362, 12 at once 962; fully upgraded 67.3 / 487 / 1125)
    ice_fists: [31.7, 36.1], icicle_cannon: [35.6, 105.4], fractal_shard: [54.3, 163.5], rimeguard: [35.3, 204.7],   // (the Rimeguard: slams only, no Shatterback. The Fractal Shard 2026-10-29 branching, by the game clock: 12 at once 277-290)
    lightning_fists: [27.4, 77.1], orb_emitter: [25.9, 136.1], ball_lightning: [22.3, 194], conductor: [26.9, 177.6],   // conductor: clamps thrown as it sweeps the pack, R's current kept on (12 at once 247)
    thunder_glaive: [36.7, 361.5],   // (the glaive, 2026-10-29 network, chain capped: clicks at the pack, links, booms, the ropes' and cage's current; no coils; standing dummies never cross a fence; 12 at once 567. R as well (coils while fewer than 3 stand): 42.9 / 408 / 1239, fully upgraded 42.6 / 444 / 1437. By the game clock)
    boreal_trident: [39.3, 206.8],   // (the trident, 2026-10-29 at x0.6: clicks only, its combo with its aftershocks at its base pace, aimed where they are; no throws, no Frost Rush, no Frostkin; 12 at once 419, a lone boss 26.3. Throw into them, then the rushed combo into the heap, again: about 22% more on one)
};
// What the *keywords* in the shop's descriptions mean (ShopScene._richText's popouts).
ShopScene.KEYWORDS = {
    // (the guide's words: LevelSelectScene's guide pages use them too)
    circuit: ['Circuit', 'With the Circuit Breaker: wired enemies that arc to each other chain into a ring through you, out along your first wire, through each enemy in turn and home along the last (the wires to the ones in between go thin: the current runs through the arcs). A ring of two does double, and each enemy past that adds half again (three x2.5, four x3). Its live and insulated clamps are *Amped* while it stays closed.'],
    'live wire': ['Live Wire', 'The Circuit Breaker\'s plain clamp (yellow): current runs through the enemy and hurts it every 0.3s. Amped while its circuit is closed.'],
    insulator: ['Insulator (G)', 'A Circuit Breaker clamp (blue): its enemy takes only 30% of the current, and the whole web (lines, clamps, bursts and currents) does 35% less for each insulator on it, but every daze the web gives lasts 60% longer, and its enemy stays Amped longest. Control for damage.'],
    current: ['Current (R)', 'Press R: a big blob of current runs down the wire nearest your aim, on through the arcs, and back to you along the last wire. Every enemy it passes is dazed, takes a small hit, and is Amped for a few seconds (capacitors aside).'],
    capacitor: ['Capacitor (G)', 'A Circuit Breaker clamp (orange): the enemy takes no current; it stores it instead, and every 3s bursts, forking the stored charge out to every enemy within 2.5 tiles and sharing it between them (a little extra for each one it reaches). Cut its wire (hold G at it) to burst it at once. A capacitor is never Amped: it is all damage, no reactions.'],
    reaction: ['Reaction', 'A hit on an enemy carrying another element\'s status (burning, chilled or cubed, amped, hexed). It charges your ult three times as much as a plain hit.'],
    residue: ['Residue', 'A hit on an enemy another element hit in the last 1.5s, with no status of it left: ult charge x1.75.'],
    resist: ['Resistance', 'A ring under an enemy in an element\'s colour: that element\'s hits land at 40%. A ring split in two or three resists two or three elements. Nothing resists cosmic.'],
    cube: ['Ice cube', 'A full chill bar freezes an enemy into a cube: it moves at about half speed, and it shatters by itself after a few seconds. While it holds it is *Brittle*.'],
    poison: ['Poison', 'Damage over time on you, and any healing you get is cut by 60% while it lasts. Only one dose at a time: a new one restarts the clock, it never stacks.'],
    bleed: ['Bleed', 'On you: every tile you move while it lasts hurts (a dash, every tile it covers). Stand still or pick your steps. From a Hunter\'s slashes and a bursting water bubble.'],
    dripping: ['Dripping', 'On you, for 8s (4s from a Torpedo Diver\'s shot): every tile you step off becomes water (never the one you stand on), and it stays until fire dries it. Dangerous with water enemies about.'],
    root: ['Rooted', 'On you: stuck where you stand for a moment. You can still attack.'],
    water: ['Water', 'Supercharges the water enemies standing in it: Wave Riders charge sooner, Ripplerunners race, a Tidal Guard\'s hit pins you, a Tidecaller makes everything in it attack far faster (a little faster on dry floor). Fire dries it to *fog*.'],
    fog: ['Fog', 'Water your fire dried. It takes no new water until it clears.'],
    drowner: ['Drowner', 'Sinks to attack. If you\'re standing in water when it commits, it lands instantly: there\'s no dodge. Fight it on dry ground.'],
    cheerleader: ['Cheerleader Slime', 'Rushes to her friends, then performs on a pop-up stage for six seconds, taking half damage: everything near her is *encouraged*.'],
    encouraged: ['Encouraged', 'Cheered on by a Cheerleader Slime: for six seconds it moves faster and hits three times as hard (the pink pulse and hearts), unless she dies first. The extra damage shows in pink beside the hit.'],
    discouraged: ['Discouraged', 'Near a Cheerleader Slime when she died: for five seconds it moves at 60% speed but takes only 60% damage (the grey pall and broken hearts).'],
    tidecaller: ['Tidecaller', 'Doesn\'t fight: every enemy near it attacks faster, a little on dry floor and far faster standing in water.'],
    'poison pool': ['Poison pool', 'Left by Rooters and Budding Slimes. Standing in it doses you with *poison*.'],
    'lava tile': ['Lava tile', 'A molten tile your fire leaves behind. Enemies standing on it take a *Burn* stack every 0.8s.'],
    chevron: ['Chevrons', 'Little arrows over anything moving faster (up) or slower (down) than usual, you included.'],
    hex: ['Hex', 'Cosmic\'s mark on an enemy, its stacks orbiting it (up to 3). Takes more damage from everything: +10% at one stack, +25% at two, +45% at three, and slowed. Fire, ice or lightning hitting a hexed enemy is a reaction (ult charge x3). Ascend\'s supernova hits harder for each stack. How long it lasts depends on where it came from: the Void Blade\'s lasts longest.'],
    voidlet: ['Voidlets', 'Little void allies that draw enemy attention. Warriors chase and punch. Voidbeams lock on, then fire a wide beam that pierces and ricochets off walls. They stay with you until they fall.'],
    daze: ['Dazed', 'Stunned for a moment: no moving, no attacking. Deals no damage by itself.'],
    stun: ['Stunned', 'Can\'t move or attack until it wears off.'],
    chill: ['Chill', 'Chill builds with every ice hit; a full bar freezes the enemy into an ice cube, applying *Brittle*. Chill alone doesn\'t slow it: the cube does.'],
    'deep freeze': ['Deep Freeze', 'The ice ult\'s freeze: held still until the ult shatters it. Fire, lightning and cosmic do x2 to it, ice x1.2; the shatter adds back part of what the other elements dealt.'],
    constellation: ['Constellation', 'Hold V past halfway: you drop into a rift, then place an anchor and click where to strike: 4 stars (a pair and its mirror) crash together there, hitting everything in the way. Two *voidlets* come through with you and fight at your side.'],
    'constellation+': ['Constellation+', 'Hold V to the end: untouchable until the slam, healing all the while, and the slam applies *Dazed*. Each throw is 8 stars crashing in through walls, applying *Hex* to what they hit, and 5 *voidlets* come through: 3 warriors and 2 voidbeams.'],
    brittle: ['Brittle', 'While an enemy is an ice cube, 20% of its max HP is cut off (6% on a boss). When the cube ends that health slowly grows back; damage from fire, lightning and cosmic while it holds locks part of it in for good.'],
    'super burn': ['Super Burn', 'Burn\'s bigger form: 3 stacks at most, ticking five times a second for a little flat damage plus a share of max HP (3 stacks: 30 a second plus 2.5% of max HP; bosses take a quarter of the share). It lasts far longer than Burn (8s, then a stack every 2.5s). It takes over from Burn: landing, it puts out any Burn stacks, and while it lasts the enemy can\'t Burn (Burn landing on it only keeps it going). From the fire ult and the Ember Scythe. It melts things rather than thudding them.'],
    burn: ['Burn', 'Fire damage over time, up to 5 stacks: a little flat damage plus a share of the enemy\'s max HP every half second (5 stacks: 20 a second plus 1% of max HP; bosses take a quarter of the share). Stacks from different hits add up, and fire weapons feed it.'],
    lava: ['Lava', 'A molten patch on the floor. It deals no damage itself: it applies a *Burn* stack to anything standing in it every 0.8s.'],
    kindle: ['Kindle', 'Ignition\'s mark, on the first two enemies its flame finds. The two stay marked till you detonate them (or they cool out): a third in the flame isn\'t marked. It fills while the flame is on them (about 4.5s) and holds while you keep it there; left alone it cools and fizzles. Full, it is overkindled: the flame does real damage to it (plus 0.2% of its max HP a tick), it catches *Burn* half the time, and a second ring fills, up to 40% of a bar. 3s after the flame leaves it goes off by itself. Press G (Detonate) to set every mark off at any time: the fuller, the far bigger the blast (a full bar also takes 6% of its max HP). It stays marked and starts again from whatever the second ring stored.'],
    'blue flame': ['Blue Flame (R)', 'Ignition\'s ability: when it\'s ready (16s after the last), press R and for 5s the flame burns blue-hot. It ticks half again as fast (kindle fills in 3s), ignores resistance, and now and then lays a *Blue Burn* stack.'],
    'blue burn': ['Blue Burn', 'A burn stack from Blue Flame. It does not tick: when the burn\'s hold runs out it spreads, turning the ordinary stacks blue one by one, then each blue stack bursts for 14 + 1.2% of max HP through resistance (bosses take a quarter of the share). Shorter than Burn, far more damage in all.'],
    ignition: ['Ignition (R)', 'Ignition\'s ability, now *Blue Flame*: press R for 5s of blue-hot flame that ticks faster and ignores resistance.'],
    ember: ['Ember', 'A tile the Ember Scythe sets alight, burning for 7s. Every second, each enemy on it or beside it has a 30% chance of a *Super Burn* stack (Kindling raises it).'],
    'ember soul': ['Ember Soul', 'Shaken out of every enemy an Ember Scythe swing cuts. Walk near one and it flies to you (you carry up to 30); 5 make a *Heat Wave*.'],
    'heat wave': ['Heat Wave (R)', 'Five ember souls: the scythe points at the nearest enemy (the cursor only with no one about) and a narrow crescent of heat, 3 tiles across, pulses 9 tiles out, two crescents of fire behind it. Each crescent gives everything it reaches a *Super Burn* stack; the ground they cross flares white-hot for 2s, and three *embers* are left burning along it for 12s, keeping it going. Casting it heals you 4% of your max HP.'],
    'magma surge': ['Magma Surge (R)', 'Dump the staff\'s stored heat: everything round you is thrown back and gets *Burn*, and a wave of *lava* rolls outward. More heat, a bigger surge. Spending it drops the staff back to its first tier.'],
    rime: ['Rime', 'The Rimeguard\'s charge, while it\'s your ice weapon, whatever element you\'re on: every hit an enemy lands on you is one (a big one, 15% of your max HP or more, two; one more on the raised shield; a quarter of a second apart at most), frost growing on you as it fills. Burns and bleeds don\'t count. At 8 it goes off: *Shatterback*. Go 5s without a hit and a charge melts every 1.5s.'],
    taunted: ['Taunted', 'Struck by the Rimeguard\'s free swing (not the jab behind its shield): for 3s it comes for you, forgetting decoys and allies, 40% faster, and attacks 40% faster. Bosses shrug it off.'],
    shatterback: ['Shatterback', 'The Rimeguard\'s burst: on its own when *rime* reaches 8, on any element, or early with R while you hold it (3 or more). Ice spikes burst out of the floor round you (2.5 tiles, 3.5 at full): everything in it takes 15 plus 40% of your max HP (by how full it was) and half a bar of *Chill*, so something already chilled freezes into a cube, ready for whatever you\'re holding.'],
    'fractal bloom': ['Fractal Bloom (R)', 'The Fractal Shard\'s R, once five of its shots have broken all the way down (or hit an ice cube): a seed crystal flies to where you aim and blooms, a snowflake of crystal bursting out of the floor (six arms, each forking twice), cracking and chilling what it grows under, its outermost tips freezing it into a cube. A moment later the whole flake shatters for a second hit.'],
    'pivot strike': ['Pivot Strike', 'The Thunder Glaive\'s click: the enemy nearest the cursor within 5 tiles is your pivot (an arc reaches for it from the blade). You dash through it and on past it: 4 tiles past it from close up, down to 1.5 from far off, stopping short of walls and bosses. Untouchable as you go. Everything on the line takes a hit and is *Amped*, unless it\'s insulated. Click another pivot within a second of landing to go on: each link hits 20% harder, never off the same enemy twice running, up to 10 links. With no one else in reach, a boss: you dash at it, stop short and strike it.'],
    volt: ['Volts', 'The Thunder Glaive\'s fuel (24 in the tank): one for every enemy a *pivot strike* hits, and two back a link when a streak\'s *boom* goes off. A *tesla coil* costs 1. The network burns them: a volt a second while its current is reaching anyone, and a volt a second for each coil with an enemy within 3 tiles; with three coils at work a full tank lasts about 7s without a dash. At 0 the coils go dark and the network stops (with the fences that run to a coil) until you dash for more. The bar over you shows the tank, the part about to drain off it, and blinks amber when it runs low.'],
    rope: ['Rope', 'The crackling line of current each *pivot strike* leaves along the way you dashed. It\'s part of the Thunder Glaive\'s network as soon as it\'s laid, and stays live 6s after its streak\'s *boom* (16 at most): twice a second, while you have *volts*, every Amped enemy within a tile of one takes the current, and it jumps on from there to Amped enemies up to 2.5 tiles apart (12 at most). Each takes 9, 10% more for every other enemy in the chain, at most half again. Insulated enemies don\'t conduct. A boss in reach takes 40% of a hop and passes nothing on.'],
    boom: ['Boom', 'The end of a Thunder Glaive streak (its second runs out, no one is left to pivot off, or 10 links): a fuse races down the *ropes* in the order you laid them and they all go off at once, 4 to everything within a tile of one and 5 more for every link (9 for one link, 54 for ten; half again if it\'s Amped), and a half-second daze; insulated enemies take nothing, and a rope over water runs through the pool. It powers the network: two *volts* back a link, and from two links an *overload*. Then it leaves a *cage*. With coils up, a streak of two links or more brings a bolt from the sky down on each *tesla coil*, a light hit round it.'],
    overload: ['Overload', 'What a Thunder Glaive *boom* of two links or more sets off: 0.6s a link past the first (5.4s at 10 links). The network\'s current runs twice as often and twice as hard, for no more *volts* a second.'],
    cage: ['Cage', 'What a Thunder Glaive streak\'s *boom* leaves, for 6s: a post where each enemy you pivoted off stood, live fences post to post (closed round from three posts), and a fence from each post to the nearest *tesla coil* within 8 tiles (while you have *volts*). It\'s part of the network: every Amped enemy inside it takes the current. An enemy that crosses a fence, or steps onto or off one, is shocked: a small hit, *Amped* and dazed for a moment (once a second a fence). Insulated enemies shrug it off. A new streak\'s cage takes the old one\'s place.'],
    'tesla coil': ['Tesla Coil (R)', 'One volt: the Thunder Glaive plants a tesla coil at your feet for 15s, up to 3 at once (another takes the oldest\'s place). While you have *volts*, every second each coil zaps the five enemies nearest it within 3 tiles (a small hit, *Amped*; a boss in reach 40% of one), and it passes the network\'s current to every Amped enemy within 3 tiles; a coil with an enemy that near burns a volt a second. Coils within 8 tiles of each other are joined by live fences, shocking as a *cage*\'s do, and the cage\'s posts fence into the nearest one. Out of volts they go dark (no zaps, no current, no fences) until you dash for more. When a streak of two links or more goes off, a bolt from the sky slams onto each coil, a light hit 2.5 tiles round it (wider the longer the streak).'],
    thrust: ['Thrust', 'The Boreal Trident\'s first click: a quick poke down a line 8 tiles long and 3 wide, straight down your aim (short of a wall): a light hit, a little chill and two *rime marks* on everything on it. A moment later, as frost cracks run down the line, a spine of ice erupts out of the floor along it, a piece at a time over half a second with spurs off its sides and a great spike at the tip: the heavy hit, landing on each enemy as the spine reaches it. While the *hurl* is ready a press waits: let go and it pokes, hold on and the trident is drawn back for the throw; while the hurl comes back round a press pokes at once.'],
    hurl: ['Hurl', 'Hold the click with the Boreal Trident, then let go: it\'s thrown straight down your aim, skimming low, 5 tiles, up to 8 drawn a second (its line shows while you hold it), once every 7s (Swift Recall: 0.6s less a level; the thin bar under the frost bar fills, a ping when it\'s ready). What it hits is impaled on its tines, and the rip current behind it drags in everything within two and a half tiles of its line, never through a wall (a light hit); rime crystallises over the floor it passes and melts in a moment (only its look). At the first wall (or boss) it pins them all: a harder hit and a long daze, each sealed in rime; at its range it drops them where the sea crashes in, a light hit and a short daze, and the wake behind it flash-freezes back down its path. Then it flies back to your hand; till it\'s back you can\'t stab. A throw that caught something brings *frost rush*. With *riptide*, click again while it flies to ride its wake.'],
    riptide: ['Riptide', 'The Boreal Trident\'s last upgrade, sold once Long Hurl is maxed: click again while the *hurl* flies and you ride its wake, surfing along behind it on the rip current, and you\'re set down on free floor a tile short of where it stops (it waits there, stuck, till you arrive); its *frost rush* starts as you land (a boss stopping it sets you down beside it). You can be hit all the way, there are no dashes, ults, gadgets or swaps till you\'re down, and the throw\'s 7s only starts when you land. You stop at the edge of the room you set off in, and never ride through a sealed door.'],
    frostbite: ['Frostbite', 'The Boreal Trident\'s status: 3s a hit (6s at most), shown as a violet snowflake by the frost bar. While it lasts the enemy\'s *chill* grows on its own, nearly half a stack a second, until it freezes into a cube. Only two things give it: the leap\'s slam and the Squall *frostkin*\'s gust (the rime the trident leaves on the floor is only its look).'],
    frostkin: ['Frostkin (R)', 'The Boreal Trident\'s R, for 48 frost (96 banked at most), and with it a frost shell round you worth 20% of your max HP, taking hits before your health with no time limit till it breaks (a call while it\'s up tops it back up, never above): every enemy a hit of the combo strikes is frost (the thrust and the swipe 1, the slam 2; 5 enemies a hit at most); throws and cubes give none. Three ice wisps, one of each kind (melee, hail, Squall), fighting beside you till they\'re killed (9 at most: past that the oldest shatter away). Their HP is a share of your max HP (a quarter for the melee one, less for the others), they get half your defence and half your damage bonus; each shows its HP. The melee one pulls the enemies within 3 tiles of it onto itself and nips them from a tile of its own, chilling what\'s within 2 tiles. The hail one keeps 3 to 5 tiles off with a clear line and every 1.6s calls a hail of ice spears onto the 3x3 tiles round its target, a light hit and a little chill on each, the middle one last and hardest. The Squall keeps 3 to 6 tiles off and every 4.5s breathes in and blows a gust 4 tiles wide and nearly 10 long through everything: a small hit and *frostbite* on all of it, no push. Frostkin Pack adds a hail one, then a Squall.'],
    'boreal aura': ['Boreal Aura', 'While you hold the Boreal Trident, a haze of frost hangs round you (the ice ult\'s, fainter), 3.5 tiles out: enemy shots in it fly at about a third of their speed, frosting over as they go. Bullets, globs, slugs, shells and boss shots alike.'],
    'rime mark': ['Rime Marks', 'The Boreal Trident\'s marks, crystals over an enemy (3 at most, for 4s after the last): the thrust leaves 2 on what it hits, the swipe 1 on everything in its arc. The leap\'s slam shatters them when its rime erupts: 40% more of the eruption\'s damage a mark, a second more *frostbite* a mark, and a frost toward *frostkin* a mark. The more shattered at once, the bigger the burst.'],
    'frost rush': ['Frost Rush', 'The moment a Boreal Trident *hurl* lands having caught something: for 4s (and 3s after it\'s back in your hand, if that\'s later) its combo runs nearly twice as fast: the thrust, the swipe and the leap, and the window to keep it going with them. A chime, the words and a flash start it; you glow frost-bright the whole time and a white sliver over the combo pips drains; it fizzles off when it ends. Clump them with the throw, then dump the combo into the heap.'],
    'frost shield': ['Frost Shield (R)', '5s of 35% less damage taken, and it applies *Chill* to whoever hits you.'],
    amp: ['Amped', 'Lightning\'s mark on an enemy: a hit from fire, ice or cosmic on it is a reaction, the Orb Emitter\'s orb bounces only between Amped enemies, and some books and relics hit Amped enemies harder.'],
    momentum: ['Momentum', 'Stacks from punching and dashing: +7% damage and +8% speed each. Fades if you stop.'],
    ward: ['Wards', 'Orbiting shields. Each one eats one projectile, then shoves nearby enemies back.'],
    mark: ['Mark', 'An astral mark, a gold ring left by the Astrolabe\'s stars. Hitting the enemy pops it for ult charge.'],
    supernova: ['Supernova', 'A blast at the end of Ascend: more damage for every Hex stack on each enemy in reach.'],
    'cosmic fluid': ['Cosmic fluid', 'Cosmic\'s ground: left by the Void Blade, the cosmic dash and Ascend. Enemies standing in it gain *Hex* every 2s. How long it lasts depends on where it came from (a fully charged Void Blade\'s lasts longest).'],
    'rift drop': ['Rift drop', 'You pick a spot within 14 tiles and slam down onto it: a *big crunch*. Enemies under you take a hit and are slowed.'],
    'time lock': ['Time Lock', 'The Pendulum\'s field, 4s: a 7x7 with its corners cut, spread from where it lands over open floor (never round a wall). Time stops in it for everything but you: enemies can\'t move, act, cast or be moved, and their ailments don\'t run down (what they tick is stored with the rest). They take nothing: every hit you land on them is stored (its tally over them) and all of it lands at once when time starts again, kills and all. Shots, yours and theirs, stop at its edge and fly on after. A boss isn\'t frozen solid: its time runs 80% slower, but its damage is stored the same.'],
    rewind: ['Rewind (R)', 'The Pendulum\'s R, on the cooldown it shares with its Time Lock (30s after a Rewind, 12s after a Time Lock): you\'re pulled back along your own path to where you were 3s ago. The HP you\'ve lost since comes back (a heal since stays) and every ailment you picked up since goes. Ults, gadgets and stamina you spent stay spent. It never takes you back through a door, a lift or a fall: only as far as you\'ve been in this room.'],
    'big crunch': ['Big Crunch', 'The transformations\' slam: every enemy with *Hex* on it within 6 tiles (8 in the full form) is pulled in, and each of its Hex stacks is cashed in as damage (12 plus 6% of its max HP a stack; bosses less), the stacks gone.'],
    'twin collapse': ['Twin Collapse', 'Click to place the anchor (right-click moves it). Every click after throws: the anchored star and its twin rush together and implode where you clicked, pulling enemies in and applying *Hex* to what they pass. The farther from the anchor, the harder and wider. In the full form each landing cashes in the *Hex* on what it lands on, as the *big crunch* does (nothing to cash, it Hexes it for the next).'],
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
        { desc: 'Every meteor of the rain (not Meteor Strike\'s) also sets a Supernova fuse on what it hits: 2s, then it explodes and the blast spreads the fuse to its neighbours.', fragCost: 5, glorpCost: 20 },
        { desc: 'Not designed yet.', fragCost: 15, glorpCost: 80, soon: true },
    ] },
    { key: 'ice', label: 'ICE ULT', name: 'Blizzard', stages: [
        { desc: '20s of deadly cold, and you can switch weapons and elements through it. A wide freezing ring follows you: inside it a third of the chill bar cubes an enemy, and cubes shatter in 1.2s for 25 + 3% of its current HP. Gale Storm: every 5s an ice tornado gathers round you and is sent off toward your crosshair, then slowly hunts down enemies (the bigger it is, the further it sees and the harder it turns), chilling what it passes and growing with every enemy it catches (the next one forms at its biggest). But you take x1.5 damage the whole time, and the cold slows you at first, wearing off over 5s. Press X again to end it early. First, a wave applies *Deep Freeze* (it shatters itself 3s in) to everything it reaches (up to 18 tiles): fire, lightning and cosmic do x2 to it, ice x1.2. It shatters by itself for 100 + 15% of the current HP of each enemy (bosses take the 100), adding back part of what the other elements dealt. At the end you are frozen solid for 3s: safe, but unable to move or act.' },
        { desc: 'The Deep Freeze shatter hits half again as hard: 150 + 22.5% of current HP.', fragCost: 5, glorpCost: 20 },
        { desc: 'Not designed yet.', fragCost: 15, glorpCost: 80, soon: true },
    ] },
    { key: 'lightning', label: 'LIGHTNING ULT', name: 'Fork', stages: [
        { desc: 'You become lightning and time stops. The bolt streaks to the nearest enemy, then at random through every other one in the room, counting a combo over each, and back to you. A snap, and the whole web ignites: 18 + 1.2% of max HP to each enemy it passed through and 8 to anything on its path, all multiplied by the size of the crowd (+16% an enemy, up to x4.5). For 12s after, 40% of any damage to any enemy forks to everything within 2.5 tiles of it (at most 30 a hit), and you move twice as fast: every step thumps the floor round you (a 5x5 square, corners off), dazing what is on it, and zaps everything within 5 tiles for 5 + 0.5% of max HP, each zap forking to 2 more.' },
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
    mend: 'A totem planted where it lands for 6s: stand within 2.5 tiles and heal 2% of your max HP each second, 10% in all.',
    bulwark: 'Three tiles of wall across the line you threw it on, for 4s. Enemies have to go round; it stops shots. Never lands on anyone.',
    decoy: 'A pink copy of you: enemies within 5 tiles (not bosses) go for it instead of you for 6s. 40 HP, so heavy hitters break it early. It pops for a little damage when it goes.',
    bell: 'Rung where you stand: every ailment on you is gone at once (Burn, poison, bleed, dripping, Hex, Winded, nearsighted, a root, Glu, a slow, a daze). For 1s after, anything new is shaken off as it lands and no hold can take you. It deals nothing.',
};
