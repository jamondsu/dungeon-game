// ═══════════════════════════════════════════════════════════════════════════
// LEVELSELECTSCENE.JS - Level selection menu
// ═══════════════════════════════════════════════════════════════════════════

class LevelSelectScene extends Phaser.Scene {
    constructor() { super({ key: 'LevelSelect' }); }

    create(data) {
        const W = this.scale.width, H = this.scale.height;

        // Route to tutorial sub-screen if flagged
        if (data?.showTutorialSelect) {
            this._buildTutorialSelectScreen(W, H);
            return;
        }

        // Show shop prompt if coming from tutorial — only if flame sword not yet bought
        const flameSwordOwned = JSON.parse(localStorage.getItem('unlockedWeapons') || '[]').includes('flame_sword');
        if (data?.showShopPrompt && !flameSwordOwned) {
            this.time.delayedCall(500, () => this.showShopPrompt(data.glorps || 100));
        }

        // Background
        this.add.rectangle(0, 0, W, H, 0x050a10, 1).setOrigin(0);

        // Title
        this.add.text(W / 2, 48, 'WORLD 1  —  SELECT LEVEL', {
            fontSize: '22px', fontFamily: 'monospace', color: '#aaccff',
            stroke: '#000000', strokeThickness: 4, fontStyle: 'bold'
        }).setOrigin(0.5);

        this.add.text(W / 2, 82, 'work in progress', {
            fontSize: '11px', fontFamily: 'monospace', color: '#445566'
        }).setOrigin(0.5);

        // Level grid — 10 levels, 5 per row
        const levels = 10;
        const cols = 5;
        const btnW = 120, btnH = 80, padX = 24, padY = 24;
        const totalW = cols * btnW + (cols - 1) * padX;
        const startX = (W - totalW) / 2;
        const startY = 150;

        const levelNames = [
            'Tutorial',      'The Gauntlet',  'The Void Rift',
            'The Fracture',  'Frozen Vault',  'Storm Chamber',
            'Void Gate',     'Circuit Maze',  'Final Stand',
            'THE END'
        ];

        for (let i = 0; i < levels; i++) {
            const col = i % cols, row = Math.floor(i / cols);
            const bx = startX + col * (btnW + padX);
            const by = startY + row * (btnH + padY);

            const unlocked = true;

            const bg = this.add.rectangle(bx, by, btnW, btnH, unlocked ? 0x0a1f2e : 0x0d0d0d, 1).setOrigin(0).setInteractive();
            bg.setStrokeStyle(1.5, unlocked ? 0x2244aa : 0x222222, 1);

            this.add.text(bx + 10, by + 8, `${i + 1}`, {
                fontSize: '28px', fontFamily: 'monospace',
                color: unlocked ? '#3366cc' : '#333333', fontStyle: 'bold'
            });

            this.add.text(bx + btnW / 2, by + btnH - 18, levelNames[i] || `Level ${i + 1}`, {
                fontSize: '9px', fontFamily: 'monospace',
                color: unlocked ? '#6688aa' : '#333333'
            }).setOrigin(0.5, 1);

            this.add.text(bx + btnW - 6, by + 6, 'DEV', {
                fontSize: '8px', fontFamily: 'monospace', color: '#ffaa00'
            }).setOrigin(1, 0);

            if (unlocked) {
                bg.on('pointerover', () => { bg.setFillStyle(0x112233); bg.setStrokeStyle(2, 0x4488ff, 1); });
                bg.on('pointerout',  () => { bg.setFillStyle(0x0a1f2e); bg.setStrokeStyle(1.5, 0x2244aa, 1); });
                bg.on('pointerdown', () => {
                    if (i === 0) {
                        this.openTutorialSelect();
                    } else if (i === 1) {
                        this.launchLevel(2); // levelIndex 2 = The Gauntlet
                    } else if (i === 2) {
                        this.launchLevel(3); // levelIndex 3 = The Void Rift
                    } else if (i === 3) {
                        this.launchLevel(4); // levelIndex 4 = The Fracture
                    } else {
                        this.launchLevel(i);
                    }
                });
            }
        }

        // ── WEAPON LOADOUT PANEL (left sidebar) ──────────────────────────
        const unlockedWeapons = JSON.parse(localStorage.getItem('unlockedWeapons') || '[]');
        const panelX = 24;
        const panelY = 150;
        const panelW = startX - 48;
        const panelH = 2 * (btnH + padY) + btnH; // same height as level grid

        // Panel background
        this.add.rectangle(panelX, panelY, panelW, panelH, 0x080f18, 0.9).setOrigin(0);
        this.add.rectangle(panelX, panelY, panelW, panelH).setOrigin(0).setStrokeStyle(1, 0x1a2a3a, 0.8);

        this.add.text(panelX + panelW / 2, panelY + 14, 'LOADOUT', {
            fontSize: '11px', fontFamily: 'monospace', color: '#445566',
            stroke: '#000', strokeThickness: 2, fontStyle: 'bold'
        }).setOrigin(0.5);

        // Divider under header
        this.add.line(panelX + panelW / 2, panelY + 26, 0, 0, panelW - 20, 0, 0x1a2a3a, 0.8).setOrigin(0.5);

        // Read equipped weapon per element — ShopScene writes to 'equip_<element>'
        const WEAPON_LABELS = {
            'flame_fists':      'Flame Fists',
            'flame_sword':      'Flame Sword',
            'magma_staff':      'Magma Staff',
            'ice_fists':        'Ice Fists',
            'icicle_cannon':    'Icicle Cannon',
            'fractal_shard':    'Fractal Shard',
            'lightning_fists':  'Storm Fists',
        };
        const getWeaponName = (element, defaultKey) => {
            const equipped = localStorage.getItem('equip_' + element) || defaultKey;
            return WEAPON_LABELS[equipped] || equipped;
        };
        const isEquippedDefault = (element, defaultKey) => {
            const equipped = localStorage.getItem('equip_' + element);
            return !equipped || equipped === defaultKey;
        };

        const lightningUnlocked = localStorage.getItem('unlocked_lightning') === 'true';
        const cosmicUnlocked    = localStorage.getItem('unlocked_cosmic')    === 'true';

        const elements = [
            { key: 'fire',      label: 'FIRE',      color: '#ff6622', lockColor: 0x3a1a0a,
              weaponName: getWeaponName('fire', 'flame_fists'),
              isDefault: isEquippedDefault('fire', 'flame_fists') },
            { key: 'ice',       label: 'ICE',       color: '#44aaff', lockColor: 0x0a1a2a,
              weaponName: getWeaponName('ice', 'ice_fists'),
              isDefault: isEquippedDefault('ice', 'ice_fists') },
            { key: 'lightning', label: 'LIGHTNING', color: '#ffff44', lockColor: 0x1a1a0a,
              locked: !lightningUnlocked,
              weaponName: getWeaponName('lightning', 'lightning_fists'),
              isDefault: isEquippedDefault('lightning', 'lightning_fists') },
            { key: 'cosmic',    label: 'COSMIC',    color: '#cc44ff', lockColor: 0x1a0a2a,
              locked: !cosmicUnlocked,
              weaponName: getWeaponName('cosmic', 'cosmic_fists'),
              isDefault: isEquippedDefault('cosmic', 'cosmic_fists') },
        ];

        const slotH = Math.floor((panelH - 36) / 4) - 4;
        elements.forEach((el, i) => {
            const sy = panelY + 34 + i * (slotH + 4);
            const locked = el.locked;

            // Slot bg
            const slotBg = this.add.rectangle(panelX + 6, sy, panelW - 12, slotH,
                locked ? 0x0a0a0f : 0x0d1520).setOrigin(0);
            slotBg.setStrokeStyle(1, locked ? 0x1a1a22 : Phaser.Display.Color.HexStringToColor(el.color).color, locked ? 0.3 : 0.5);

            // Element label
            this.add.text(panelX + 14, sy + 8, el.label, {
                fontSize: '10px', fontFamily: 'monospace', fontStyle: 'bold',
                color: locked ? '#2a2a3a' : el.color,
                stroke: '#000', strokeThickness: 2
            });

            if (locked) {
                // Lock icon + "Coming Soon"
                this.add.text(panelX + panelW / 2, sy + slotH / 2 + 4, '🔒', {
                    fontSize: '14px'
                }).setOrigin(0.5).setAlpha(0.4);
                this.add.text(panelX + panelW / 2, sy + slotH / 2 + 22, 'LOCKED', {
                    fontSize: '9px', fontFamily: 'monospace', color: '#2a2a3a'
                }).setOrigin(0.5);
            } else {
                // Equipped weapon name
                const weaponName = el.weaponName;
                const isDefault = el.isDefault;

                this.add.text(panelX + 14, sy + 22, weaponName, {
                    fontSize: '11px', fontFamily: 'monospace', fontStyle: 'bold',
                    color: isDefault ? '#667788' : '#cce8ff',
                    stroke: '#000', strokeThickness: 2
                });

                this.add.text(panelX + 14, sy + 36, isDefault ? 'default' : 'equipped', {
                    fontSize: '9px', fontFamily: 'monospace',
                    color: isDefault ? '#334455' : '#44aa66'
                });

                // "Change" button if more weapons unlocked
                if (!isDefault) {
                    const changeBtn = this.add.text(panelX + panelW - 10, sy + slotH - 10, 'CHANGE', {
                        fontSize: '8px', fontFamily: 'monospace', color: '#334455',
                        stroke: '#000', strokeThickness: 1
                    }).setOrigin(1, 1).setInteractive();
                    changeBtn.on('pointerover', () => changeBtn.setStyle({ color: '#6688aa' }));
                    changeBtn.on('pointerout',  () => changeBtn.setStyle({ color: '#334455' }));
                    changeBtn.on('pointerdown', () => this.scene.start('Shop'));
                }
            }
        });


        // Bottom bar — shop button right, glorps above it, hint at very bottom
        const savedGlorps = parseInt(localStorage.getItem('glorps') || '0');

        // Shop button — bottom right
        const shopBtn = this.add.rectangle(W - 120, H - 38, 180, 32, 0x1a3020).setInteractive();
        shopBtn.setStrokeStyle(2, 0x22aa44, 0.8);
        const shopText = this.add.text(W - 120, H - 38, '🛒  SHOP', {
            fontSize: '14px', fontFamily: 'monospace', color: '#44dd66',
            stroke: '#000', strokeThickness: 2, fontStyle: 'bold'
        }).setOrigin(0.5);
        shopBtn.on('pointerover', () => { shopBtn.setFillStyle(0x1a4020); shopText.setStyle({ color: '#88ffaa' }); });
        shopBtn.on('pointerout', () => { shopBtn.setFillStyle(0x1a3020); shopText.setStyle({ color: '#44dd66' }); });
        shopBtn.on('pointerdown', () => this.scene.start('Shop'));

        // Glorps — above shop button
        this.add.text(W - 120, H - 68, `✦ ${savedGlorps} Glorps`, {
            fontSize: '13px', fontFamily: 'monospace', color: '#00ff88',
            stroke: '#000000', strokeThickness: 3, fontStyle: 'bold'
        }).setOrigin(0.5);

        // Dev hint — very bottom center, tiny
        this.add.text(W / 2, H - 8, 'Click any level to start  •  DEV MODE: all levels unlocked', {
            fontSize: '9px', fontFamily: 'monospace', color: '#223344'
        }).setOrigin(0.5, 1);

        // Keyboard shortcut: press 1-9,0 to jump straight to a level
        this.input.keyboard.on('keydown', (e) => {
            const n = parseInt(e.key);
            if (!isNaN(n)) {
                const slot = n === 0 ? 9 : n - 1;
                if (slot === 0) { this.openTutorialSelect(); return; }
                if (slot === 1) { this.launchLevel(2); return; } // The Gauntlet
                if (slot < levels) this.launchLevel(slot);
            }
        });
    }

    // ── Navigate to the full-screen tutorial picker ──────────────────────────
    openTutorialSelect() {
        this.cameras.main.fadeOut(180, 0, 0, 0);
        this.time.delayedCall(180, () => {
            this.scene.restart({ showTutorialSelect: true });
        });
    }

    // ── Full-screen tutorial sub-level selector ───────────────────────────────
    _buildTutorialSelectScreen(W, H) {
        // Background
        this.add.rectangle(0, 0, W, H, 0x050a10).setOrigin(0);

        // Subtle grid
        const grid = this.add.graphics();
        grid.lineStyle(1, 0x0a1520, 0.5);
        for (let x = 0; x < W; x += 48) grid.lineBetween(x, 0, x, H);
        for (let y = 0; y < H; y += 48) grid.lineBetween(0, y, W, y);

        // ── Header bar ──
        this.add.rectangle(0, 0, W, 64, 0x080e18).setOrigin(0);
        this.add.line(W / 2, 64, 0, 0, W, 0, 0x1a2a3a, 1).setOrigin(0.5);

        // Back button
        const back = this.add.text(20, 32, '← BACK', {
            fontSize: '13px', fontFamily: 'monospace', color: '#445566',
            stroke: '#000', strokeThickness: 2
        }).setOrigin(0, 0.5).setInteractive();
        back.on('pointerover', () => back.setStyle({ color: '#aabbcc' }));
        back.on('pointerout',  () => back.setStyle({ color: '#445566' }));
        back.on('pointerdown', () => {
            this.cameras.main.fadeOut(180, 0, 0, 0);
            this.time.delayedCall(180, () => this.scene.restart({}));
        });

        // Title
        this.add.text(W / 2, 32, 'TUTORIAL', {
            fontSize: '22px', fontFamily: 'monospace', color: '#aaccff',
            stroke: '#000000', strokeThickness: 4, fontStyle: 'bold'
        }).setOrigin(0.5);

        // Subtitle
        this.add.text(W / 2, 80, 'Choose a tutorial to play', {
            fontSize: '12px', fontFamily: 'monospace', color: '#334455'
        }).setOrigin(0.5);

        // ── Two big cards ──────────────────────────────────────────────────
        const subLevels = [
            {
                stage: 0,
                id: '1-2-1',
                element: 'FIRE',
                label: 'Fire Tutorial',
                desc: 'Master the fireball\nand learn the basics\nof dungeon combat.',
                tags: ['Fireball', 'Burn', 'Movement'],
                color: 0xff4400,
                glowColor: '#ff6622',
                dimColor: '#331100',
                bgColor: 0x180800,
                iconChar: '🔥',
            },
            {
                stage: 1,
                id: '1-2-2',
                element: 'ICE',
                label: 'Ice Tutorial',
                desc: 'Freeze your foes\nand learn to handle\nfire-immune enemies.',
                tags: ['Hailstorm', 'Freeze', 'Ice Tiles'],
                color: 0x44aaff,
                glowColor: '#66ccff',
                dimColor: '#001133',
                bgColor: 0x040e1a,
                iconChar: '❄️',
            },
        ];

        // Card sizing — two big squares side by side, vertically centered
        const cardW = Math.min(340, (W - 120) / 2);
        const cardH = Math.min(420, H - 180);
        const gap   = 48;
        const totalCardsW = cardW * 2 + gap;
        const startX = (W - totalCardsW) / 2;
        const cardY  = 100 + (H - 100 - cardH) / 2;   // vertically centered below header

        const fireDone = !!localStorage.getItem('fireTutorialComplete');

        subLevels.forEach((sub, i) => {
            const cx = startX + i * (cardW + gap);
            const isLocked = (sub.stage === 1 && !fireDone);
            const dimAlpha = isLocked ? 0.35 : 1;

            // Card bg
            const card = this.add.rectangle(cx, cardY, cardW, cardH, sub.bgColor)
                .setOrigin(0).setAlpha(dimAlpha);
            if (!isLocked) card.setInteractive();
            card.setStrokeStyle(2, sub.color, isLocked ? 0.18 : 0.55);

            // Top colour bar
            this.add.rectangle(cx, cardY, cardW, 6, sub.color, isLocked ? 0.2 : 1).setOrigin(0);

            // Element badge — top-left
            this.add.text(cx + 14, cardY + 18, sub.element, {
                fontSize: '11px', fontFamily: 'monospace', fontStyle: 'bold',
                color: isLocked ? '#2a3a4a' : sub.glowColor, stroke: '#000', strokeThickness: 2
            });

            // Stage id — top-right
            this.add.text(cx + cardW - 12, cardY + 18, sub.id, {
                fontSize: '10px', fontFamily: 'monospace', color: '#2a3a4a',
                stroke: '#000', strokeThickness: 1
            }).setOrigin(1, 0);

            // Big icon — centred, ~⅓ down
            const iconY = cardY + cardH * 0.28;
            this.add.text(cx + cardW / 2, iconY, isLocked ? '🔒' : sub.iconChar, {
                fontSize: '64px'
            }).setOrigin(0.5);

            // Glow ring behind icon
            const gfx = this.add.graphics();
            gfx.fillStyle(sub.color, isLocked ? 0.02 : 0.07);
            gfx.fillCircle(cx + cardW / 2, iconY + 4, 56);
            gfx.lineStyle(1, sub.color, isLocked ? 0.06 : 0.18);
            gfx.strokeCircle(cx + cardW / 2, iconY + 4, 56);

            // Title
            this.add.text(cx + cardW / 2, cardY + cardH * 0.54, sub.label, {
                fontSize: '18px', fontFamily: 'monospace', fontStyle: 'bold',
                color: isLocked ? '#2a3a4a' : '#cce8ff', stroke: '#000', strokeThickness: 3
            }).setOrigin(0.5);

            // Description
            this.add.text(cx + cardW / 2, cardY + cardH * 0.63,
                isLocked ? 'Complete the Fire Tutorial\nto unlock this.' : sub.desc, {
                fontSize: '11px', fontFamily: 'monospace',
                color: isLocked ? '#1a2a3a' : '#445566',
                align: 'center', wordWrap: { width: cardW - 32 }, lineSpacing: 4
            }).setOrigin(0.5, 0);

            // Tag chips near bottom (hidden when locked)
            if (!isLocked) {
                const tagY = cardY + cardH - 48;
                const tagTotalW = sub.tags.reduce((acc, t) => acc + t.length * 7 + 14, 0) + (sub.tags.length - 1) * 6;
                let tagX = cx + (cardW - tagTotalW) / 2;
                sub.tags.forEach(tag => {
                    const tw = tag.length * 7 + 14;
                    this.add.rectangle(tagX + tw / 2, tagY, tw, 18, sub.color, 0.12)
                        .setStrokeStyle(1, sub.color, 0.3);
                    this.add.text(tagX + tw / 2, tagY, tag, {
                        fontSize: '8px', fontFamily: 'monospace', color: sub.glowColor
                    }).setOrigin(0.5);
                    tagX += tw + 6;
                });
            }

            // "PLAY" / "LOCKED" button at very bottom
            const playBtnY = cardY + cardH - 18;
            const playBg = this.add.rectangle(cx + cardW / 2, playBtnY, cardW - 24, 28,
                isLocked ? 0x111111 : sub.color, isLocked ? 0.3 : 0.15)
                .setStrokeStyle(1, isLocked ? 0x222222 : sub.color, isLocked ? 0.2 : 0.5);
            const playText = this.add.text(cx + cardW / 2, playBtnY,
                isLocked ? '🔒  LOCKED' : 'PLAY  ▶', {
                fontSize: '12px', fontFamily: 'monospace', fontStyle: 'bold',
                color: isLocked ? '#2a3a4a' : sub.glowColor, stroke: '#000', strokeThickness: 2
            }).setOrigin(0.5);

            if (!isLocked) {
                card.on('pointerover', () => {
                    card.setFillStyle(Phaser.Display.Color.ValueToColor(sub.color).clone().darken(80).color);
                    card.setStrokeStyle(2.5, sub.color, 1);
                    playBg.setFillStyle(sub.color, 0.28);
                    playText.setStyle({ color: '#ffffff' });
                });
                card.on('pointerout', () => {
                    card.setFillStyle(sub.bgColor);
                    card.setStrokeStyle(2, sub.color, 0.55);
                    playBg.setFillStyle(sub.color, 0.15);
                    playText.setStyle({ color: sub.glowColor });
                });
                card.on('pointerdown', () => this.launchTutorialStage(sub.stage));
            }
        });

        // Fade in
        this.cameras.main.fadeIn(220, 0, 0, 0);
    }

    launchTutorialStage(stageIndex) {
        const W = this.scale.width, H = this.scale.height;
        this.cameras.main.fadeOut(180, 0, 0, 0);
        this.time.delayedCall(180, () => {
            this.scene.start('Game', { levelIndex: 0, tutorialStage: stageIndex });
        });
    }

    launchLevel(index) {
        // Flash transition
        const W = this.scale.width, H = this.scale.height;
        const flash = this.add.rectangle(W / 2, H / 2, W, H, 0xffffff, 0).setOrigin(0.5);
        this.tweens.add({
            targets: flash, alpha: 1, duration: 120,
            onComplete: () => {
                this.scene.start('Game', { levelIndex: index });
            }
        });
    }

    showShopPrompt(glorps) {
        const W = this.scale.width, H = this.scale.height;

        // Dim overlay
        const overlay = this.add.rectangle(W / 2, H / 2, W, H, 0x000000, 0.7).setDepth(100);

        // Orange slime portrait box
        const box = this.add.rectangle(W / 2, H / 2, 500, 280, 0x1a1a2e, 1).setDepth(101);
        box.setStrokeStyle(3, 0xffaa00, 1);

        // Speaker name
        this.add.text(W / 2 - 220, H / 2 - 115, 'Glerp', {
            fontSize: '16px', fontFamily: 'monospace',
            color: '#ffff00', stroke: '#000', strokeThickness: 3, fontStyle: 'bold'
        }).setDepth(102);

        // Message
        this.add.text(W / 2, H / 2 - 40,
            `Welcome back, adventurer!\nYou collected ${glorps} Glerps in the tutorial.\n\nHead to the SHOP and buy your first weapon:\nthe Flame Sword costs 100 Glerps!`,
            {
                fontSize: '15px', fontFamily: 'monospace', color: '#ffffff',
                stroke: '#000', strokeThickness: 2, align: 'center',
                wordWrap: { width: 460 }
            }
        ).setOrigin(0.5).setDepth(102);

        // Shop button
        const shopBtn = this.add.rectangle(W / 2, H / 2 + 95, 180, 40, 0xffaa00, 1)
            .setDepth(102).setInteractive();
        this.add.text(W / 2, H / 2 + 95, 'GO TO SHOP', {
            fontSize: '15px', fontFamily: 'monospace', color: '#000', fontStyle: 'bold'
        }).setOrigin(0.5).setDepth(103);

        shopBtn.on('pointerover', () => shopBtn.setFillStyle(0xffcc44));
        shopBtn.on('pointerout', () => shopBtn.setFillStyle(0xffaa00));
        shopBtn.on('pointerdown', () => {
            this.scene.start('Shop');
        });
    }}