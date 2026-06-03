// ═══════════════════════════════════════════════════════════════════════
// HUD.JS — HUD creation/update, pause menu, death screen
// ═══════════════════════════════════════════════════════════════════════
// All methods receive GameScene as `this` via .call(scene, ...) from GameScene.js
// Do NOT add local state here — all state lives on the scene object.

class HUD {

    createHUD() {
        this.hudBg = this.add.rectangle(0, 0, this.scale.width, 40, 0x000000, 0.7);
        this.hudBg.setOrigin(0, 0);
        this.hudBg.setScrollFactor(0);

        this.healthBarBg = this.add.rectangle(10, 20, 100, 16, 0x000000);
        this.healthBarBg.setOrigin(0, 0.5);
        this.healthBarBg.setScrollFactor(0);

        this.healthBarBorder = this.add.rectangle(10, 20, 100, 16);
        this.healthBarBorder.setStrokeStyle(2, 0xffffff, 0.8);
        this.healthBarBorder.setOrigin(0, 0.5);
        this.healthBarBorder.setScrollFactor(0);

        this.healthBarFill = this.add.rectangle(10, 20, 100, 16, 0xff5566);
        this.healthBarFill.setOrigin(0, 0.5);
        this.healthBarFill.setScrollFactor(0);

        this.healthText = this.add.text(15, 20, '', {
            fontSize: '14px',
            color: '#ffffff',
            fontFamily: 'monospace',
            fontStyle: 'bold'
        });
        this.healthText.setOrigin(0, 0.5);
        this.healthText.setScrollFactor(0);

        this.elementText = this.add.text(120, 10, '', {
            fontSize: '20px',
            color: '#ffffff',
            fontFamily: 'monospace',
            backgroundColor: '#000000',
            padding: { x: 8, y: 4 }
        });
        this.elementText.setScrollFactor(0);

        this.posText = this.add.text(10, this.scale.height - 28, '', {
            fontSize: '11px',
            color: '#334455',
            fontFamily: 'monospace'
        });
        this.posText.setOrigin(0, 1);
        this.posText.setScrollFactor(0);

        // Level label + ESC hint
        this.levelLabel = this.add.text(10, this.scale.height - 14,
            `WORLD 1 — LEVEL ${(this.currentLevelIndex ?? 0) + 1}  |  ESC: MENU`, {
            fontSize: '10px', fontFamily: 'monospace', color: '#334455',
            stroke: '#000000', strokeThickness: 2
        }).setScrollFactor(0).setDepth(30);

        // Key counter for level 3 — hidden by default
        this.keyCounterText = this.add.text(this.scale.width / 2, 10, '🗝 0 / 3', {
            fontSize: '13px', fontFamily: 'monospace', color: '#cc88ff',
            stroke: '#000000', strokeThickness: 3, fontStyle: 'bold'
        }).setOrigin(0.5, 0).setScrollFactor(0).setDepth(30).setVisible(false);

        // Cosmic battery bar (purple) — shown above ult bar when on cosmic
        const cBarW = 280;
        const cBarH = 14;
        const cBarX = this.scale.width / 2 - cBarW / 2;
        const cBarY = this.scale.height - 58;

        this.cosmicBatteryBg = this.add.rectangle(cBarX, cBarY, cBarW, cBarH, 0x000000, 0.8).setOrigin(0, 0).setScrollFactor(0).setDepth(30);
        this.cosmicBatteryBorder = this.add.rectangle(cBarX, cBarY, cBarW, cBarH).setOrigin(0, 0).setScrollFactor(0).setDepth(30);
        this.cosmicBatteryBorder.setStrokeStyle(2, 0x9966ff, 0.8);
        this.cosmicBatteryFill = this.add.rectangle(cBarX, cBarY, 0, cBarH, 0x9966ff, 1).setOrigin(0, 0).setScrollFactor(0).setDepth(30);
        this.cosmicBatteryLabel = this.add.text(this.scale.width / 2, cBarY - 3, 'CHARGE', {
            fontSize: '10px', fontFamily: 'monospace', color: '#cc99ff',
            stroke: '#000000', strokeThickness: 2
        }).setOrigin(0.5, 1).setScrollFactor(0).setDepth(30);

        // Hide cosmic bar by default
        this.cosmicBatteryBg.setVisible(false);
        this.cosmicBatteryBorder.setVisible(false);
        this.cosmicBatteryFill.setVisible(false);
        this.cosmicBatteryLabel.setVisible(false);

        // Legacy text display — hidden, replaced by bar
        this.cosmicBatteryDisplay = { setVisible: () => {}, setText: () => {} };

        // ULT CHARGE BAR — bottom center
        this.ultBarW = 280;
        this.ultBarH = 20;
        this.ultBarX = this.scale.width / 2 - this.ultBarW / 2;
        this.ultBarY = this.scale.height - 36;

        this.ultBarBg = this.add.rectangle(this.ultBarX, this.ultBarY, this.ultBarW, this.ultBarH, 0x000000, 0.8).setOrigin(0, 0).setScrollFactor(0).setDepth(30);
        this.ultBarBorder = this.add.rectangle(this.ultBarX, this.ultBarY, this.ultBarW, this.ultBarH).setOrigin(0, 0).setScrollFactor(0).setDepth(30);
        this.ultBarBorder.setStrokeStyle(2, 0xffffff, 0.6);
        this.ultBarFill = this.make.graphics({ x: 0, y: 0, add: true });
        this.ultBarFill.setScrollFactor(0).setDepth(30);
        this.ultBarLabel = this.add.text(this.scale.width / 2, this.ultBarY - 4, 'ULT', {
            fontSize: '11px', fontFamily: 'monospace', color: '#aaaaaa',
            stroke: '#000000', strokeThickness: 2
        }).setOrigin(0.5, 1).setScrollFactor(0).setDepth(30);

        // Node counter — shown when on lightning
        this.nodeCountText = this.add.text(this.scale.width / 2, this.ultBarY - 20, '', {
            fontSize: '11px', fontFamily: 'monospace', color: '#44ccff',
            stroke: '#000000', strokeThickness: 2
        }).setOrigin(0.5, 1).setScrollFactor(0).setDepth(30).setVisible(false);

        // Orb scrap bar — below health bar, visible on lightning
        const orbW = 160, orbH = 12;
        const orbX = 10, orbY = 42;
        this.orbBarBg   = this.add.rectangle(orbX, orbY, orbW, orbH, 0x000000, 0.85).setOrigin(0, 0.5).setScrollFactor(0).setDepth(30).setVisible(false);
        this.orbBarGfx  = this.add.graphics().setScrollFactor(0).setDepth(31);
        this.orbBarBorder = this.add.rectangle(orbX, orbY, orbW, orbH).setOrigin(0, 0.5).setScrollFactor(0).setDepth(32).setVisible(false);
        this.orbBarBorder.setStrokeStyle(1.5, 0x00ffaa, 0.6);
        this.orbCountText = this.add.text(orbX + orbW + 8, orbY, '', {
            fontSize: '11px', fontFamily: 'monospace', color: '#aaffcc',
            stroke: '#000000', strokeThickness: 2, fontStyle: 'bold'
        }).setOrigin(0, 0.5).setScrollFactor(0).setDepth(32).setVisible(false);
        // Label
        this.orbBarLabel = this.add.text(orbX, orbY - orbH / 2 - 2, 'SCRAPS', {
            fontSize: '9px', fontFamily: 'monospace', color: '#448866',
            stroke: '#000000', strokeThickness: 2
        }).setOrigin(0, 1).setScrollFactor(0).setDepth(32).setVisible(false);
        this._orbBarX = orbX; this._orbBarY = orbY; this._orbBarW = orbW; this._orbBarH = orbH;

        // Glorp counter — top right
        const savedGlorps = parseInt(localStorage.getItem('glorps') || '0');
        if (!this.totalGlorps) this.totalGlorps = 0;
        this.totalGlorps += savedGlorps;
        // Clear from localStorage since we've loaded it
        localStorage.removeItem('glorps');
        this.glorpText = this.add.text(this.scale.width - 10, 10, `✦ ${this.totalGlorps} Glorps`, {
            fontSize: '14px', fontFamily: 'monospace', color: '#00ff88',
            stroke: '#000000', strokeThickness: 3, fontStyle: 'bold'
        }).setOrigin(1, 0).setScrollFactor(0).setDepth(30);

        this.updateHUD();
    }

    updateHUD() {
        const healthPercent = Math.min(this.health / this.maxHealth, 1);
        this.healthBarFill.width = 100 * healthPercent;
        this.healthText.setText(`${this.health.toFixed(1)}/${this.maxHealth}`);

        // Overheal — health above max gets a teal tint on the bar
        if (this.health > this.maxHealth) {
            this.healthBarFill.setFillStyle(0x00ddaa);
        } else {
            this.healthBarFill.setFillStyle(0xff5566);
        }

        // Icicle heal bar — update every frame
        this.updateIciclePips();

        const elementSymbols = {
            'fire': '🔥 FIRE',
            'ice': '❄️ ICE',
            'lightning': '⚡ LIGHTNING',
            'cosmic': '🌌 COSMIC'
        };

        let ready;
        let elementText = elementSymbols[this.currentElement] || '';

        if (this.currentElement === 'cosmic') {
            ready = this.cosmicBatteryCharges >= 10;
            elementText += ready ? ' | ULT: READY' : ` | ULT: ${this.cosmicBatteryCharges}/10⚡`;
        } else {
            ready = this.ultCharge >= this.ultChargeMax;
            elementText += ready ? ' | ULT: READY' : ` | ULT: ${Math.floor(this.ultCharge)}%`;
        }
        this.elementText.setText(elementText);

        // Node counter — only visible on lightning
        if (this.nodeCountText) {
            if (this.currentElement === 'lightning') {
                const placed = this.lightningNodes.length;
                const crafting = this.lightningNodesCrafting ? this.lightningNodesCrafting.length : 0;
                const active = this.lightningNodes.filter(n => n.active).length;
                const total = placed + crafting;
                let nodeStr = `NODES  ${total}/${this.lightningNodeMax}`;
                if (active > 0) nodeStr += `  (${active} active)`;
                if (crafting > 0) nodeStr += `  [${crafting} building]`;
                this.nodeCountText.setText(nodeStr).setVisible(true);
            } else {
                this.nodeCountText.setVisible(false);
            }
        }

        // Orb scrap bar — lightning only
        if (this.orbBarBg) {
            const onLightning = this.currentElement === 'lightning';
            this.orbBarBg.setVisible(onLightning);
            this.orbBarBorder.setVisible(onLightning);
            this.orbCountText.setVisible(onLightning);
            if (this.orbBarLabel) this.orbBarLabel.setVisible(onLightning);
            this.orbBarGfx.clear();
            if (onLightning) {
                const pct = Math.min(this.orbScraps / 10, 1);
                if (pct > 0) {
                    // Inline gradient — green to bright cyan
                    const bx = this._orbBarX, by = this._orbBarY - this._orbBarH / 2;
                    const bw = this._orbBarW, bh = this._orbBarH;
                    const fillW = Math.floor(bw * pct);
                    for (let px2 = 0; px2 < fillW; px2++) {
                        const t = fillW > 1 ? px2 / (fillW - 1) : 0;
                        const r = Math.round(0x00 + (0x00 - 0x00) * t);
                        const g2 = Math.round(0xaa + (0xff - 0xaa) * t);
                        const b2 = Math.round(0x55 + (0xaa - 0x55) * t);
                        this.orbBarGfx.fillStyle((r << 16) | (g2 << 8) | b2, 1);
                        this.orbBarGfx.fillRect(bx + px2, by, 1, bh);
                    }
                }
                const costClr = this.orbScraps >= this.orbNodeCost ? '#aaffcc' : '#ff8866';
                this.orbCountText.setText(`${this.orbScraps}  (${this.orbNodeCost}/node)`).setStyle({ color: costClr });
            }
        }

        if (this.playerX !== undefined) {
            this.posText.setText(`Pos: (${this.playerX}, ${this.playerY}) | Enemies: ${this.enemies.length}`);
        }

        // Show battery only when using cosmic
        if (this.currentElement === 'cosmic') {
            this.cosmicBatteryDisplay.setVisible(true);
            this.cosmicBatteryDisplay.setText(`⚡ ${this.cosmicBatteryCharges}/${this.cosmicMaxCharges}`);
        } else {
            this.cosmicBatteryDisplay.setVisible(false);
        }

        // Update ult bar — same for all elements including cosmic
        if (this.ultBarFill) {
            const barW = this.ultBarW;

            // Always hide cosmic battery bar — it's no longer used
            this.cosmicBatteryBg.setVisible(false);
            this.cosmicBatteryBorder.setVisible(false);
            this.cosmicBatteryFill.setVisible(false);
            this.cosmicBatteryLabel.setVisible(false);

            // Always show ult bar
            this.ultBarBg.setVisible(true);
            this.ultBarBorder.setVisible(true);
            this.ultBarFill.setVisible(true);
            this.ultBarLabel.setVisible(true);

                if (this.ultDrainActive) {
                    const elapsed = this.time.now - this.ultDrainStartTime;
                    const pct = Math.max(0, 1 - elapsed / this.ultDrainDuration);
                    const width = barW * pct;

                    this.ultBarFill.clear();
                    this.ultBarFill.fillGradientStyle(0xff2222, 0xff2222, 0xff2222, 0xff2222, 1);
                    this.ultBarFill.fillRect(this.ultBarX, this.ultBarY, width, this.ultBarH);

                    this.ultBarLabel.setText('ULT ACTIVE');
                    this.ultBarLabel.setColor('#ff8888');
                } else {
                    const pct = Math.min(this.ultCharge / this.ultChargeMax, 1);
                    const width = barW * pct;

                    // Interpolate between green and red based on charge percentage
                    const red = Math.floor(0xff * pct);
                    const green = Math.floor(0xff * (1 - pct));
                    const color = (red << 16) | (green << 8);

                    this.ultBarFill.clear();
                    this.ultBarFill.fillGradientStyle(color, color, color, color, 1);
                    this.ultBarFill.fillRect(this.ultBarX, this.ultBarY, width, this.ultBarH);

                    if (ready) {
                        this.ultBarLabel.setText('ULT READY');
                        this.ultBarLabel.setColor('#ffffff');
                    } else {
                        this.ultBarLabel.setText('ULT');
                        this.ultBarLabel.setColor('#aaaaaa');
                    }
                }
        }
    }

    updateIciclePips() {
        // Alias — keep any old calls working
        this.updateIcicleChargeBar();
    }

    updateIcicleChargeBar() {
        const isCannon = this.currentElement === 'ice' &&
            (this.equippedWeapons?.ice || 'ice_fists') === 'icicle_cannon';

        if (!isCannon) {
            this._destroyIcicleBarObjects();
            return;
        }

        const HITS_TO_CHARGE = 28;
        const BAR_W = 44, BAR_H = 5;
        const px = this.player?.x || 0;
        const py = (this.player?.y || 0) - 28;

        const healModeActive = !!this._icicleHealModeActive;
        const chargeFrac     = Math.min((this._icicleHitCounter || 0) / HITS_TO_CHARGE, 1);

        // Create bar objects once
        if (!this._icicleBarBg) {
            this._icicleBarBg       = this.add.rectangle(px, py,   BAR_W + 4, BAR_H + 4, 0x001122, 0.80).setDepth(5.8);
            this._icicleBarFill     = this.add.rectangle(px - BAR_W/2, py, 0, BAR_H, 0x00aa55, 1).setOrigin(0, 0.5).setDepth(5.9);
            this._icicleHealBg      = this.add.rectangle(px, py - 7, BAR_W + 4, BAR_H + 4, 0x001122, 0.80).setDepth(5.8);
            this._icicleHealFill    = this.add.rectangle(px - BAR_W/2, py - 7, BAR_W, BAR_H, 0x00ff88, 1).setOrigin(0, 0.5).setDepth(5.9);
            this._icicleBarLabel    = this.add.text(px, py + 6, 'HEAL CHARGE', {
                fontSize: '6px', fontFamily: 'monospace', color: '#33bb77', stroke: '#000', strokeThickness: 2
            }).setOrigin(0.5, 0).setDepth(6);
            this._icicleHealLabel   = this.add.text(px, py - 7 - 5, '✦ HEAL ARMED [R]', {
                fontSize: '6px', fontFamily: 'monospace', color: '#00ff88', stroke: '#000', strokeThickness: 2
            }).setOrigin(0.5, 1).setDepth(6);
        }

        // Update positions
        this._icicleBarBg.x    = px; this._icicleBarBg.y    = py;
        this._icicleBarFill.x  = px - BAR_W/2; this._icicleBarFill.y = py;
        this._icicleHealBg.x   = px; this._icicleHealBg.y   = py - 7;
        this._icicleHealFill.x = px - BAR_W/2; this._icicleHealFill.y = py - 7;
        this._icicleBarLabel.x = px; this._icicleBarLabel.y = py + 6;
        this._icicleHealLabel.x = px; this._icicleHealLabel.y = py - 7 - 5;

        // Charge bar — green fill, glows gold when full
        const chargeW = BAR_W * chargeFrac;
        this._icicleBarFill.width = chargeW;
        this._icicleBarFill.setFillStyle(chargeFrac >= 1 ? 0xffdd44 : 0x00aa55);
        this._icicleBarLabel.setColor(chargeFrac >= 1 ? '#ffdd44' : '#33bb77');

        // Heal armed indicator — solid bar pulsing green when armed, hidden otherwise
        this._icicleHealBg.setVisible(healModeActive);
        this._icicleHealFill.setVisible(healModeActive);
        this._icicleHealLabel.setVisible(healModeActive);
        if (healModeActive) {
            // Pulse alpha on label
            const pulse = 0.7 + 0.3 * Math.sin(this.time.now / 200);
            this._icicleHealLabel.setAlpha(pulse);
        }

        // Flash + "HEAL READY" popup when charge first fills
        if (chargeFrac >= 1 && !this._iciclePipsWereFull) {
            this._iciclePipsWereFull = true;
            this.tweens.killTweensOf(this._icicleBarFill);
            this.tweens.add({ targets: this._icicleBarFill, scaleY: 2, duration: 100, yoyo: true, ease: 'Quad.easeOut' });
            if (this._icicleReadyText) this._icicleReadyText.destroy();
            const rtx = this.player.x, rty = this.player.y - 46;
            this._icicleReadyText = this.add.text(rtx, rty, '✦ HEAL READY — PRESS R', {
                fontSize: '9px', fontFamily: 'monospace', color: '#00ff88',
                stroke: '#000000', strokeThickness: 3, fontStyle: 'bold'
            }).setOrigin(0.5).setDepth(10);
            this.tweens.add({
                targets: this._icicleReadyText, y: rty - 12, alpha: 0, duration: 1400, ease: 'Quad.easeOut',
                onComplete: () => { if (this._icicleReadyText) { this._icicleReadyText.destroy(); this._icicleReadyText = null; } }
            });
        } else if (chargeFrac < 1) {
            this._iciclePipsWereFull = false;
        }
    }

    _destroyIcicleBarObjects() {
        const keys = ['_icicleBarBg','_icicleBarFill','_icicleHealBg','_icicleHealFill','_icicleBarLabel','_icicleHealLabel','_icicleReadyText'];
        for (const k of keys) {
            if (this[k]) { this.tweens?.killTweensOf(this[k]); this[k].destroy(); this[k] = null; }
        }
        // Also clean up old pip objects if present
        if (this._iciclePips) { for (const p of this._iciclePips) p.destroy(); this._iciclePips = null; }
        if (this._iciclePipBg)    { this._iciclePipBg.destroy();    this._iciclePipBg    = null; }
        if (this._iciclePipLabel) { this._iciclePipLabel.destroy(); this._iciclePipLabel = null; }
        this._iciclePipsWereFull = false;
    }

        openPauseMenu() {
        if (this._pauseMenuOpen) return;
        this._pauseMenuOpen = true;
        this.input.keyboard.enabled = true; // keep ESC working

        const W = this.scale.width, H = this.scale.height;
        this._pauseObjs = [];

        // Dim overlay
        const overlay = this.add.rectangle(W / 2, H / 2, W, H, 0x000000, 0.65)
            .setScrollFactor(0).setDepth(500);
        this._pauseObjs.push(overlay);

        // Panel
        const panelW = 300, panelH = 290;
        const panel = this.add.rectangle(W / 2, H / 2, panelW, panelH, 0x0a1520, 0.97)
            .setScrollFactor(0).setDepth(501);
        panel.setStrokeStyle(2, 0x2244aa, 1);
        this._pauseObjs.push(panel);

        // Title
        const title = this.add.text(W / 2, H / 2 - 110, 'PAUSED', {
            fontSize: '22px', fontFamily: 'monospace', color: '#aaccff',
            stroke: '#000', strokeThickness: 4, fontStyle: 'bold'
        }).setOrigin(0.5).setScrollFactor(0).setDepth(502);
        this._pauseObjs.push(title);

        // Divider
        const div = this.add.graphics().setScrollFactor(0).setDepth(502);
        div.lineStyle(1, 0x1a2a3a, 1);
        div.lineBetween(W / 2 - 120, H / 2 - 82, W / 2 + 120, H / 2 - 82);
        this._pauseObjs.push(div);

        // Buttons — evenly spaced in the middle third of the panel
        const btnDefs = [
            { label: 'RESUME',    color: '#aaccff', hover: '#ffffff', action: () => this.closePauseMenu() },
            { label: 'RESTART',   color: '#ffaa44', hover: '#ffcc88', action: () => { this.closePauseMenu(); this.scene.start('Game', { levelIndex: this.currentLevelIndex, tutorialStage: this.tutorialStage }); } },
            { label: 'MAIN MENU', color: '#ff6644', hover: '#ff9977', action: () => this.scene.start('LevelSelect') },
        ];
        btnDefs.forEach((def, i) => {
            const by = H / 2 - 48 + i * 54;
            const btnBg = this.add.rectangle(W / 2, by, 220, 40, 0x0d1a26)
                .setScrollFactor(0).setDepth(502).setInteractive();
            btnBg.setStrokeStyle(1, 0x1a2a3a, 1);
            const btnTxt = this.add.text(W / 2, by, def.label, {
                fontSize: '14px', fontFamily: 'monospace', fontStyle: 'bold',
                color: def.color, stroke: '#000', strokeThickness: 3
            }).setOrigin(0.5).setScrollFactor(0).setDepth(503);
            btnBg.on('pointerover', () => { btnBg.setFillStyle(0x112233); btnTxt.setStyle({ color: def.hover }); });
            btnBg.on('pointerout',  () => { btnBg.setFillStyle(0x0d1a26); btnTxt.setStyle({ color: def.color }); });
            btnBg.on('pointerdown', def.action);
            this._pauseObjs.push(btnBg, btnTxt);
        });

        // ESC hint — comfortably inside the bottom of the panel
        const hint = this.add.text(W / 2, H / 2 + 122, 'ESC to resume', {
            fontSize: '10px', fontFamily: 'monospace', color: '#334455'
        }).setOrigin(0.5).setScrollFactor(0).setDepth(502);
        this._pauseObjs.push(hint);
    }

    closePauseMenu() {
        if (!this._pauseMenuOpen) return;
        this._pauseMenuOpen = false;
        if (this._pauseObjs) {
            this._pauseObjs.forEach(o => { if (o && o.active) { this.tweens.killTweensOf(o); o.destroy(); } });
            this._pauseObjs = null;
        }
    }

    // ─── DEATH SCREEN ─────────────────────────────────────────────────────────

    gameOver() {
        if (this._deathScreenActive) return;
        this._deathScreenActive = true;
        this.closePauseMenu();
        this.input.keyboard.enabled = false;
        this.isPointerDown = false;

        // Hide HUD
        const hudItems = [
            this.healthBarBg, this.healthBarBorder, this.healthBarFill, this.healthText,
            this.ultBarBg, this.ultBarBorder, this.ultBarFill, this.ultBarLabel,
            this.glorpText, this.posText, this.nodeCountText
        ];
        for (const h of hudItems) { if (h) h.setVisible(false); }

        // Destroy all enemy marks
        for (const enemy of this.enemies) {
            for (const key of ['_fireMark', '_iceMark', '_shieldMark', '_inhibitRing', '_inhibitMark', '_rangedMark', '_chillBar']) {
                if (key === '_chillBar') { this._destroyChillIndicator(enemy); continue; }
                if (enemy[key] && enemy[key].active) { this.tweens.killTweensOf(enemy[key]); enemy[key].destroy(); enemy[key] = null; }
            }
            this._destroyPrefireBeam(enemy);
        }

        this.showDeathScreen();
    }

    showDeathScreen() {
        const W = this.scale.width, H = this.scale.height;

        // Freeze enemies
        for (let enemy of this.enemies) {
            if (enemy.sprite && typeof enemy.sprite.stop === 'function') enemy.sprite.stop();
        }

        // Use the camera fade — this actually blacks out the rendered world
        this.cameras.main.fadeOut(600, 0, 0, 0);
        this.cameras.main.once('camerafadeoutcomplete', () => {
            this._showDeathContent(W, H);
        });
    }

    _showDeathContent(W, H) {
        // Add a fresh overlay camera that sits above the faded world camera.
        // The main camera was faded to black; this one never fades, so
        // everything added here renders crisp over the darkness.
        const uiCam = this.cameras.add(0, 0, W, H);
        uiCam.setScroll(0, 0);

        // ui(obj) — tell the main camera to ignore this object so only uiCam shows it
        const ui = (obj) => { this.cameras.main.ignore(obj); return obj; };

        const isTut = this.isTutorial || this.isIceTutorial;
        const tutLines = [
            '...in the tutorial?',
            "It's literally the tutorial. You are pretty special.",
            'The tutorial has a death screen\nbecause of you specifically.',
            'Glerp is disappointed.',
            'The slimes are laughing at you.',
        ];
        const normalLines = [
            'Better luck next time.',
            'The dungeon wins again.',
            'Touch grass and try again.',
        ];
        const subtitle = isTut
            ? tutLines[Math.floor(Math.random() * tutLines.length)]
            : normalLines[Math.floor(Math.random() * normalLines.length)];

        const fadeIn = (obj, delay, dur = 400) => {
            obj.setAlpha(0);
            this.time.delayedCall(delay, () =>
                this.tweens.add({ targets: obj, alpha: 1, duration: dur, ease: 'Quad.easeOut' })
            );
        };

        // "YOU DIED"
        const died = ui(this.add.text(W / 2, H * 0.28, 'YOU DIED', {
            fontSize: '64px', fontFamily: 'monospace', fontStyle: 'bold',
            color: '#cc1100', stroke: '#000000', strokeThickness: 10
        }).setOrigin(0.5).setDepth(950).setAlpha(0).setScale(1.15));
        this.time.delayedCall(80, () => {
            this.tweens.add({ targets: died, alpha: 1, scaleX: 1, scaleY: 1, duration: 280, ease: 'Back.easeOut' });
        });

        // Subtitle
        fadeIn(ui(this.add.text(W / 2, H * 0.28 + 68, subtitle, {
            fontSize: '16px', fontFamily: 'monospace', color: '#884433',
            stroke: '#000', strokeThickness: 3, align: 'center'
        }).setOrigin(0.5).setDepth(950)), 380);

        // Divider
        const divGfx = ui(this.add.graphics().setDepth(950).setAlpha(0));
        divGfx.lineStyle(1, 0x441111, 1);
        divGfx.lineBetween(W / 2 - 160, H * 0.28 + 98, W / 2 + 160, H * 0.28 + 98);
        fadeIn(divGfx, 480, 300);

        // Red slimes crawl in from edges
        for (let i = 0; i < 18; i++) {
            const edge = Math.floor(Math.random() * 4);
            let sx, sy;
            if      (edge === 0) { sx = Math.random() * W; sy = -40; }
            else if (edge === 1) { sx = W + 40; sy = Math.random() * H; }
            else if (edge === 2) { sx = Math.random() * W; sy = H + 40; }
            else                 { sx = -40; sy = Math.random() * H; }
            const tx = W * 0.15 + Math.random() * W * 0.7;
            const ty = H * 0.52 + Math.random() * H * 0.32;

            this.time.delayedCall(300 + i * 60 + Math.random() * 100, () => {
                const s = ui(this.add.sprite(sx, sy, 'slime_red', 0)
                    .setScale(1.6 + Math.random() * 1.2).setAlpha(0).setDepth(940 + i));
                s.play('red_idle');
                this.tweens.add({
                    targets: s, x: tx, y: ty, alpha: 1,
                    duration: 420 + Math.random() * 200, ease: 'Power2.easeOut',
                    onComplete: () => this.tweens.add({
                        targets: s, scaleX: s.scaleX * 1.35, scaleY: s.scaleY * 0.7,
                        duration: 65, yoyo: true
                    })
                });
            });
        }

        // Buttons
        const btnY = H * 0.82;
        [
            { label: 'TRY AGAIN', color: '#ff4422', hov: '#ff7755', x: W / 2 - 130, action: () => { this.scene.start('Game', { levelIndex: this.currentLevelIndex, tutorialStage: this.tutorialStage }); } },
            { label: 'MAIN MENU', color: '#aaccff', hov: '#ffffff', x: W / 2 + 130, action: () => this.scene.start('LevelSelect') },
        ].forEach((def, i) => {
            const bg = ui(this.add.rectangle(def.x, btnY, 210, 44, 0x0d0000, 0.92)
                .setDepth(952).setInteractive());
            bg.setStrokeStyle(2, Phaser.Display.Color.HexStringToColor(def.color).color, 0.7);
            const txt = ui(this.add.text(def.x, btnY, def.label, {
                fontSize: '15px', fontFamily: 'monospace', fontStyle: 'bold',
                color: def.color, stroke: '#000', strokeThickness: 3
            }).setOrigin(0.5).setDepth(953));
            bg.on('pointerover', () => { bg.setFillStyle(0x220000); txt.setStyle({ color: def.hov }); });
            bg.on('pointerout',  () => { bg.setFillStyle(0x0d0000); txt.setStyle({ color: def.color }); });
            bg.on('pointerdown', () => { def.action(); });
            fadeIn(bg,  820 + i * 80, 300);
            fadeIn(txt, 820 + i * 80, 300);
        });
    }

    showRoomName(name) {
        // Kill any in-progress room name tween
        if (this._roomNameText) {
            this.tweens.killTweensOf(this._roomNameText);
            this._roomNameText.destroy();
            this._roomNameText = null;
        }
        if (this._roomNameRule) {
            this.tweens.killTweensOf(this._roomNameRule);
            this._roomNameRule.destroy();
            this._roomNameRule = null;
        }

        const cx = this.scale.width / 2;
        const ty = Math.floor(this.scale.height * 0.18);

        // Thin horizontal rule above the name
        const rule = this.add.graphics().setScrollFactor(0).setDepth(50).setAlpha(0);
        const ruleW = 260;
        rule.lineStyle(1, 0xaaaaaa, 0.55);
        rule.beginPath(); rule.moveTo(cx - ruleW / 2, ty - 10); rule.lineTo(cx + ruleW / 2, ty - 10); rule.strokePath();
        rule.lineStyle(1, 0xaaaaaa, 0.55);
        rule.beginPath(); rule.moveTo(cx - ruleW / 2, ty + 26); rule.lineTo(cx + ruleW / 2, ty + 26); rule.strokePath();
        this._roomNameRule = rule;

        const txt = this.add.text(cx, ty, name.toUpperCase(), {
            fontSize: '20px',
            fontFamily: 'monospace',
            fontStyle: 'bold',
            color: '#dddddd',
            stroke: '#000000',
            strokeThickness: 4,
            alpha: 0
        }).setOrigin(0.5, 0).setScrollFactor(0).setDepth(50).setAlpha(0);
        this._roomNameText = txt;

        // Fade in, hold, fade out
        this.tweens.add({
            targets: [txt, rule],
            alpha: 1,
            duration: 500,
            ease: 'Quad.easeOut',
            onComplete: () => {
                this.tweens.add({
                    targets: [txt, rule],
                    alpha: 0,
                    duration: 700,
                    delay: 1600,
                    ease: 'Quad.easeIn',
                    onComplete: () => {
                        txt.destroy();
                        rule.destroy();
                        this._roomNameText = null;
                        this._roomNameRule = null;
                    }
                });
            }
        });
    }
}