// ShopScene.js - Glurp's weapon shop

class ShopScene extends Phaser.Scene {
    constructor() { super({ key: 'Shop' }); }

    preload() {
        if (!this.textures.exists('slime_green')) {
            this.load.spritesheet('slime_green', 'assets/Slime_Green_32x32.png', {
                frameWidth: 32, frameHeight: 32
            });
        }
    }

    create() {
        const W = this.scale.width, H = this.scale.height;
        this.glorps = parseInt(localStorage.getItem('glorps') || '0');
        this.uw     = JSON.parse(localStorage.getItem('unlockedWeapons') || '[]');
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

        this.add.rectangle(0, 0, W, H, 0x080c14).setOrigin(0);
        const grid = this.add.graphics();
        grid.lineStyle(1, 0x111822, 0.4);
        for (let x = 0; x < W; x += 40) grid.lineBetween(x, 0, x, H);
        for (let y = 0; y < H; y += 40) grid.lineBetween(0, y, W, y);

        // Title bar
        this.add.rectangle(0, 0, W, 56, 0x0a1520).setOrigin(0);
        this.add.text(W/2, 28, "GLURP'S SHOP", {
            fontSize: '24px', fontFamily: 'monospace', color: '#ffcc44',
            stroke: '#000', strokeThickness: 5, fontStyle: 'bold'
        }).setOrigin(0.5);
        const back = this.add.text(16, 28, '<- BACK', {
            fontSize: '13px', fontFamily: 'monospace', color: '#556677', stroke: '#000', strokeThickness: 2
        }).setOrigin(0, 0.5).setInteractive();
        back.on('pointerover', () => back.setStyle({ color: '#aabbcc' }));
        back.on('pointerout',  () => back.setStyle({ color: '#556677' }));
        back.on('pointerdown', () => this.scene.start('LevelSelect'));
        this.glorpCountText = this.add.text(W-16, 28, '✦ ' + this.glorps + ' Glorps', {
            fontSize: '15px', fontFamily: 'monospace', color: '#00ff88',
            stroke: '#000', strokeThickness: 3, fontStyle: 'bold'
        }).setOrigin(1, 0.5);

        // Tabs
        const TABS_Y = 74;
        const tabLabels = ['WEAPONS', 'UPGRADES', 'CONSUMABLES'];
        const tabW = 130, tabH = 24;
        const tabTotalW = tabLabels.length * tabW + (tabLabels.length-1) * 12;
        const tabX0 = W/2 - tabTotalW/2 + tabW/2;
        tabLabels.forEach((label, i) => {
            const tx = tabX0 + i * (tabW + 12);
            const active = i === 0;
            const bg = this.add.rectangle(tx, TABS_Y, tabW, tabH, active ? 0x1a3044 : 0x0a1520).setInteractive();
            bg.setStrokeStyle(1, active ? 0x4488aa : 0x1a2a3a);
            this.add.text(tx, TABS_Y, label, {
                fontSize: '10px', fontFamily: 'monospace', color: active ? '#aaccff' : '#334455'
            }).setOrigin(0.5);
            if (!active) {
                bg.on('pointerover', () => bg.setFillStyle(0x0d1a26));
                bg.on('pointerout',  () => bg.setFillStyle(0x0a1520));
                bg.on('pointerdown', () => this.setGlurpDialogue('"Coming soon!"'));
            }
        });
        this.add.line(W/2, 93, 0, 0, W-40, 0, 0x1a2a3a, 0.8).setOrigin(0.5);

        // NPC panel
        const NPC_MID = 140, CTOP = 94;
        this.add.rectangle(NPC_MID, CTOP, 280, H-CTOP, 0x0a1220, 0.5).setOrigin(0.5, 0);
        this.add.rectangle(NPC_MID, CTOP, 280, H-CTOP).setOrigin(0.5, 0).setStrokeStyle(1, 0x1a2a3a, 0.5);

        const GY = CTOP + 160;
        const glerp = this.add.sprite(NPC_MID, GY, 'slime_green', 0).setScale(5);
        glerp.play('green_idle');
        this.tweens.add({ targets: glerp, y: GY + 6, duration: 700, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
        this.add.text(NPC_MID, GY+88, 'Glurp', {
            fontSize: '15px', fontFamily: 'monospace', color: '#ffcc44',
            stroke: '#000', strokeThickness: 3, fontStyle: 'bold'
        }).setOrigin(0.5);
        this.add.text(NPC_MID, GY+106, 'Weapons Dealer', {
            fontSize: '10px', fontFamily: 'monospace', color: '#445566'
        }).setOrigin(0.5);
        const BUB_Y = GY - 88;
        this.add.rectangle(NPC_MID, BUB_Y, 210, 66, 0x0d1e2e, 0.95).setOrigin(0.5).setStrokeStyle(1, 0x2a4a5a, 0.8);
        this.glurpDialogue = this.add.text(NPC_MID, BUB_Y, '"Welcome!\nBrowse my wares!"', {
            fontSize: '12px', fontFamily: 'monospace', color: '#cce8ff',
            align: 'center', wordWrap: { width: 190 }
        }).setOrigin(0.5);

        // Weapon grid — scrollable container
        const GX0   = 290;
        const gridW = W - GX0 - 12;
        const cols  = 3;
        const padX  = 12, padY = 10;
        const cardW = Math.floor((gridW - padX * (cols - 1)) / cols);
        const cardH = 200;
        const secH  = 24; // section header height

        // Full catalogue — 4 elements × 3 slots
        const catalogue = [
            // FIRE
            { id:'flame_fists',  name:'Flame Fists',  element:'fire', cost:0,
              desc:'Quick 1-tile punch.\nLeaves a small lava\npatch on every hit.\nDefault weapon.',
              color:0xff4400, defaultWeapon:true },
            { id:'flame_sword',  name:'Flame Sword',  element:'fire', cost:100,
              desc:'Wide 5-tile arc sweep.\nLeaves lava on all\nhit tiles. Heavy\nmelee damage.',
              color:0xff6600 },
            { id:'magma_hammer', name:'Magma Hammer', element:'fire', cost:350,
              desc:'Sends a 2-tile wide\nripple 6 tiles ahead,\nthen explodes in a\n4×4 lava blast.',
              color:0xff2200 },

            // ICE
            { id:'ice_fists',   name:'Ice Fists',   element:'ice', cost:0,
              desc:'Throws ice shards\nat close range.\nApplies brittle and\ncan freeze. Default.',
              color:0x44aaff, defaultWeapon:true },
            { id:'icicle_staff', name:'Icicle Staff', element:'ice', cost:80,
              desc:'Blasts a 3-tile\nradius circle of ice\naround you. Applies\nchill to all hit.',
              color:0x88ccff },
            { id:'blizzard_staff', name:'Blizzard Staff', element:'ice', cost:0,
              desc:'Coming soon...',   color:0x2266cc, comingSoon:true },

            // LIGHTNING
            { id:'lightning_fists', name:'Storm Fists',    element:'lightning', cost:0,
              desc:'1-tile punch that\nchains lightning to\nnearby enemies.\nDefault weapon.',
              color:0xffff44, defaultWeapon:true },
            { id:'lightning_rod',   name:'Lightning Rod',  element:'lightning', cost:0,
              desc:'Coming soon...',   color:0xffdd00, comingSoon:true },
            { id:'thunder_axe',     name:'Thunder Axe',    element:'lightning', cost:0,
              desc:'Coming soon...',   color:0xffaa00, comingSoon:true },

            // COSMIC
            { id:'cosmic_fists',        name:'Void Fists',        element:'cosmic', cost:0,
              desc:'Fires a cosmic beam.\nRequires battery\ncharges to use.\nDefault weapon.',
              color:0xcc44ff, defaultWeapon:true },
            { id:'singularity_staff',   name:'Singularity Staff', element:'cosmic', cost:0,
              desc:'Coming soon...',   color:0xaa22ff, comingSoon:true },
            { id:'void_blade',          name:'Void Blade',        element:'cosmic', cost:0,
              desc:'Coming soon...',   color:0x8800ff, comingSoon:true },
        ];

        catalogue.forEach(w => {
            if (w.defaultWeapon || this.uw.includes(w.id)) w.unlocked = true;
        });

        const elementMeta = {
            fire:      { label: '🔥  FIRE',      color: '#ff6622' },
            ice:       { label: '❄️  ICE',        color: '#44aaff' },
            lightning: { label: '⚡  LIGHTNING',  color: '#ffff44' },
            cosmic:    { label: '🌌  COSMIC',     color: '#cc44ff' },
        };

        // Build a scrollable zone so all 4 element sections fit
        const totalContentH = 4 * (secH + cardH + padY * 2);
        const viewH = H - CTOP;

        // We'll use a mask + scroll — simple approach: render everything into
        // world space starting at CTOP and let the camera/zone handle it,
        // OR just use a camera. Simplest: offset content and clip with a mask.
        const contentContainer = this.add.container(GX0, CTOP);

        let yOff = 0;
        const elements = ['fire', 'ice', 'lightning', 'cosmic'];
        elements.forEach(el => {
            const weapons = catalogue.filter(w => w.element === el);
            const meta    = elementMeta[el];
            const elColor = Phaser.Display.Color.HexStringToColor(meta.color).color;
            const equippedId = this.equipped[el];
            const equippedWeapon = catalogue.find(w => w.id === equippedId);
            const equippedName   = equippedWeapon ? equippedWeapon.name : '—';

            // Section header
            const hdrBg = this.add.rectangle(0, yOff, gridW, secH, elColor, 0.10).setOrigin(0, 0);
            const hdrBar = this.add.rectangle(0, yOff, 3, secH, elColor, 0.9).setOrigin(0, 0);
            const hdrLabel = this.add.text(10, yOff + secH/2, meta.label, {
                fontSize: '11px', fontFamily: 'monospace', fontStyle: 'bold',
                color: meta.color, stroke: '#000', strokeThickness: 2
            }).setOrigin(0, 0.5);
            const hdrEquip = this.add.text(gridW - 4, yOff + secH/2,
                'EQUIPPED: ' + equippedName, {
                fontSize: '9px', fontFamily: 'monospace', color: '#44aa66',
                stroke: '#000', strokeThickness: 1
            }).setOrigin(1, 0.5);

            contentContainer.add([hdrBg, hdrBar, hdrLabel, hdrEquip]);
            yOff += secH + padY;

            weapons.forEach((w, col) => {
                const cx = col * (cardW + padX) + cardW / 2;
                const cy = yOff + cardH / 2;
                const objs = this.buildWeaponCard(cx, cy, cardW, cardH, w, el);
                contentContainer.add(objs);
            });

            yOff += cardH + padY * 2;
        });

        // Scroll logic
        const maxScroll = Math.max(0, yOff - viewH);
        this._scrollY = 0;

        const updateScroll = (dy) => {
            this._scrollY = Phaser.Math.Clamp(this._scrollY + dy, 0, maxScroll);
            contentContainer.y = CTOP - this._scrollY;
        };

        // Mask so cards don't bleed into NPC panel or above CTOP
        const maskGfx = this.make.graphics();
        maskGfx.fillRect(GX0, CTOP, gridW, viewH);
        const mask = maskGfx.createGeometryMask();
        contentContainer.setMask(mask);

        // Mouse wheel scroll
        this.input.on('wheel', (_p, _gos, _dx, dy) => updateScroll(dy * 0.5));

        // Scroll bar indicator if content overflows
        if (maxScroll > 0) {
            const sbX = W - 8, sbTrackH = viewH;
            this.add.rectangle(sbX, CTOP + sbTrackH/2, 4, sbTrackH, 0x1a2a3a, 0.6);
            const sbH = Math.max(30, (viewH / yOff) * sbTrackH);
            const sbThumb = this.add.rectangle(sbX, CTOP, 4, sbH, 0x446688, 0.85).setOrigin(0.5, 0);
            // Update in update()
            this._sbThumb = sbThumb;
            this._sbTrackH = sbTrackH;
            this._sbH = sbH;
            this._maxScroll = maxScroll;
        }
    }

    update() {
        if (this._sbThumb && this._maxScroll > 0) {
            const CTOP = 94;
            const t = this._scrollY / this._maxScroll;
            this._sbThumb.y = CTOP + t * (this._sbTrackH - this._sbH);
        }
    }

    buildWeaponCard(cx, cy, cW, cH, w, el) {
        const soon       = !!w.comingSoon;
        const locked     = !!w.locked && !soon;
        const owned      = !!w.unlocked;
        const isEquipped = this.equipped[el] === w.id;
        const canBuy     = !soon && !locked && !owned && this.glorps >= w.cost;
        const dim        = soon ? 0.28 : 1;

        const bgCol  = isEquipped ? 0x0a2a18 : owned ? 0x0a1a28 : (soon||locked) ? 0x090910 : 0x0d1a26;
        const borCol = isEquipped ? 0x44dd88 : owned ? 0x2255aa : (soon||locked) ? 0x1a1a28 : w.color;

        const card = this.add.rectangle(cx, cy, cW, cH, bgCol).setOrigin(0.5).setAlpha(dim);
        if (!soon && !locked) card.setInteractive();
        card.setStrokeStyle(2, borCol, soon ? 0.12 : 0.85);

        const stripe = this.add.rectangle(cx, cy - cH/2 + 3, cW - 4, 5, w.color, soon ? 0.12 : 0.7)
            .setOrigin(0.5, 0).setAlpha(dim);

        const iy = cy - cH/2 + 50;
        const ia = (soon||locked) ? 0.18 : 0.85;
        const iconBg = this.add.rectangle(cx, iy, 40, 40, this.ec(w.element))
            .setOrigin(0.5).setAlpha(ia).setStrokeStyle(1, 0xffffff, ia * 0.3);

        const iconLabel = locked
            ? this.add.text(cx, iy, '🔒', { fontSize: '16px' }).setOrigin(0.5).setAlpha(0.5)
            : soon
                ? this.add.text(cx, iy, '?', { fontSize: '20px', fontFamily: 'monospace', color: '#2a3a4a' }).setOrigin(0.5)
                : null;

        const nameText = this.add.text(cx, cy - cH/2 + 100, w.name, {
            fontSize: '11px', fontFamily: 'monospace', fontStyle: 'bold',
            color: soon ? '#222233' : locked ? '#2a3a4a' : '#ccdde8',
            stroke: '#000', strokeThickness: 2
        }).setOrigin(0.5).setAlpha(dim);

        const descText = this.add.text(cx, cy - cH/2 + 116, w.desc, {
            fontSize: '8px', fontFamily: 'monospace', align: 'center',
            color: soon ? '#1a1a28' : locked ? '#1e2e3a' : '#4a6a7a',
            wordWrap: { width: cW - 16 }, lineSpacing: 2
        }).setOrigin(0.5, 0).setAlpha(dim);

        const statusY = cy + cH/2 - 14;
        let statusObj = null;
        if (isEquipped) {
            statusObj = this.add.text(cx, statusY, '★ EQUIPPED', {
                fontSize: '10px', fontFamily: 'monospace', color: '#44dd88',
                stroke: '#000', strokeThickness: 2, fontStyle: 'bold'
            }).setOrigin(0.5);
        } else if (owned) {
            statusObj = this.add.text(cx, statusY, '▶ EQUIP', {
                fontSize: '10px', fontFamily: 'monospace', color: '#4499cc',
                stroke: '#000', strokeThickness: 2, fontStyle: 'bold'
            }).setOrigin(0.5).setInteractive();
            statusObj.on('pointerover', () => statusObj.setStyle({ color: '#88ddff' }));
            statusObj.on('pointerout',  () => statusObj.setStyle({ color: '#4499cc' }));
            statusObj.on('pointerdown', () => this.equip(w, el));
        } else if (!soon && !locked) {
            statusObj = this.add.text(cx, statusY, '✦ ' + w.cost + ' Glorps', {
                fontSize: '10px', fontFamily: 'monospace',
                color: canBuy ? '#00ff88' : '#cc3333',
                stroke: '#000', strokeThickness: 2, fontStyle: 'bold'
            }).setOrigin(0.5);
        }

        if (!locked && !soon) {
            card.on('pointerover', () => {
                card.setFillStyle(isEquipped ? 0x0d3a22 : owned ? 0x0d2233 : 0x112233);
                card.setStrokeStyle(2, borCol, 1);
                if (isEquipped) this.setGlurpDialogue('"The ' + w.name + '!\nYour current pick!"');
                else if (owned)  this.setGlurpDialogue('"The ' + w.name + '!\nClick EQUIP to\nswitch to it!"');
                else if (canBuy) this.setGlurpDialogue('"The ' + w.name + '!\nOnly ' + w.cost + ' Glorps!"');
                else             this.setGlurpDialogue('"Need ' + (w.cost - this.glorps) + '\nmore Glorps!"');
            });
            card.on('pointerout', () => {
                card.setFillStyle(bgCol);
                card.setStrokeStyle(2, borCol, 0.85);
                this.setGlurpDialogue('"Welcome!\nBrowse my wares!"');
            });
            if (!owned) card.on('pointerdown', () => this.buy(w, card, bgCol, el));
        }

        return [card, stripe, iconBg, nameText, descText, ...(iconLabel ? [iconLabel] : []), ...(statusObj ? [statusObj] : [])];
    }

    ec(el) { return { fire: 0xff4400, ice: 0x44aaff, lightning: 0xdddd00, cosmic: 0xbb44ff }[el] || 0x444444; }

    equip(w, el) {
        localStorage.setItem('equip_' + el, w.id);
        this.setGlurpDialogue('"Nice choice!\n' + w.name + '\nequipped!"');
        this.scene.restart();
    }

    buy(w, card, bg, el) {
        if (w.unlocked) { this.setGlurpDialogue('"You already own\nthe ' + w.name + '!"'); return; }
        if (this.glorps < w.cost) {
            this.setGlurpDialogue('"Not enough!\nNeed ' + (w.cost - this.glorps) + ' more!"');
            this.tweens.add({ targets: card, x: card.x + 5, duration: 50, yoyo: true, repeat: 3 });
            return;
        }
        this.glorps -= w.cost;
        localStorage.setItem('glorps', this.glorps);
        const arr = JSON.parse(localStorage.getItem('unlockedWeapons') || '[]');
        if (!arr.includes(w.id)) { arr.push(w.id); localStorage.setItem('unlockedWeapons', JSON.stringify(arr)); }
        // Auto-equip on purchase
        localStorage.setItem('equip_' + el, w.id);
        w.unlocked = true;
        this.glorpCountText.setText('✦ ' + this.glorps + ' Glorps');
        this.setGlurpDialogue('"Excellent choice!\nEnjoy your\n' + w.name + '!"');
        this.tweens.add({ targets: card, alpha: 0.4, duration: 80, yoyo: true, repeat: 2, onComplete: () => this.scene.restart() });
    }

    setGlurpDialogue(text) { if (this.glurpDialogue) this.glurpDialogue.setText(text); }
}