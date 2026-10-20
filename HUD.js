// ═══════════════════════════════════════════════════════════════════════
// HUD.JS — HUD creation/update, pause menu, death screen
// ═══════════════════════════════════════════════════════════════════════
// All methods receive GameScene as `this` via .call(scene, ...) from GameScene.js
// Do NOT add local state here — all state lives on the scene object.

class HUD {

    createHUD() {
        this.hudBg = this.add.rectangle(0, 0, this.scale.width, 40, UIKit.PALETTE.bgPanel, 0.82);
        this._hudRule = this.add.graphics().setScrollFactor(0);
        this._hudRule.lineStyle(1.5, UIKit.PALETTE.accentBlue, 0.35);
        this._hudRule.lineBetween(0, 40, this.scale.width, 40);
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
            fontSize: '17px',
            color: '#ffffff',
            fontFamily: 'monospace',
            fontStyle: 'bold'
        });
        this.healthText.setOrigin(0, 0.5);
        this.healthText.setScrollFactor(0);

        this.elementText = this.add.text(120, 10, '', {
            fontSize: '23px',
            color: '#ffffff',
            fontFamily: 'monospace',
            backgroundColor: '#000000',
            padding: { x: 8, y: 4 }
        });
        this.elementText.setScrollFactor(0);

        this.posText = this.add.text(10, this.scale.height - 28, '', {
            fontSize: '14px',
            color: UIKit.CSS.textLo,
            fontFamily: 'monospace'
        });
        this.posText.setOrigin(0, 1);
        this.posText.setScrollFactor(0);

        // Level label + ESC hint
        this.levelLabel = this.add.text(10, this.scale.height - 14,
            this.trainingRun ? 'TRAINING GROUND  |  H: PANEL  |  ESC: MENU' : this.towerRun ? `THE TOWER  ·  FLOOR ${this.towerRun.floor}  |  ESC: MENU` : `${({ 0: 'TUTORIAL', 1: 'TUTORIAL', 2: 'THE GAUNTLET', 3: 'THE VOID RIFT', 4: 'THE FRACTURE', 5: 'THE CISTERN' })[this.currentLevelIndex] || 'THE DUNGEON'}  |  ESC: MENU`, {
            fontSize: '13px', fontFamily: 'monospace', color: UIKit.CSS.textLo,
            stroke: '#000000', strokeThickness: 2
        }).setScrollFactor(0).setDepth(30);

        // Key counter for level 3 — hidden by default
        this.keyCounterText = this.add.text(this.scale.width / 2, 10, '🗝 0 / 3', {
            fontSize: '16px', fontFamily: 'monospace', color: '#cc88ff',
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
            fontSize: '13px', fontFamily: 'monospace', color: '#cc99ff',
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
            fontSize: '14px', fontFamily: 'monospace', color: '#aaaaaa',
            stroke: '#000000', strokeThickness: 2
        }).setOrigin(0.5, 1).setScrollFactor(0).setDepth(30);
        // The single bar is retired: four ult gems take its place. Its objects stay, hidden,
        // because other code still touches them.
        for (const o of [this.ultBarBg, this.ultBarBorder, this.ultBarFill, this.ultBarLabel]) o.setVisible(false);
        this._buildUltGems();

        // Tower counter — shown when on lightning
        this.nodeCountText = this.add.text(this.scale.width / 2, this.ultBarY - 20, '', {
            fontSize: '14px', fontFamily: 'monospace', color: '#44ccff',
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
            fontSize: '14px', fontFamily: 'monospace', color: '#aaffcc',
            stroke: '#000000', strokeThickness: 2, fontStyle: 'bold'
        }).setOrigin(0, 0.5).setScrollFactor(0).setDepth(32).setVisible(false);
        // Label
        this.orbBarLabel = this.add.text(orbX, orbY - orbH / 2 - 2, 'SCRAPS', {
            fontSize: '13px', fontFamily: 'monospace', color: '#448866',
            stroke: '#000000', strokeThickness: 2
        }).setOrigin(0, 1).setScrollFactor(0).setDepth(32).setVisible(false);
        this._orbBarX = orbX; this._orbBarY = orbY; this._orbBarW = orbW; this._orbBarH = orbH;

        // Glorp counter — top right
        // The saved balance IS the balance: assign it and leave it saved (every pickup rewrites
        // it in full). This used to ADD it to this.totalGlorps and then delete the key. The scene
        // object outlives scene.start, so totalGlorps still held the previous level's balance and
        // re-entering a level doubled it; and with the key deleted, closing the game before the
        // first pickup of a level lost every glorp.
        this.totalGlorps = parseInt(localStorage.getItem('glorps') || '0');
        this.glorpText = this.add.text(this.scale.width - 10, 10, `✦ ${this.totalGlorps} Glorps`, {
            fontSize: '17px', fontFamily: 'monospace', color: '#00ff88',
            stroke: '#000000', strokeThickness: 3, fontStyle: 'bold'
        }).setOrigin(1, 0).setScrollFactor(0).setDepth(30);

        this._vfxBuildHud?.();   // Visuals.js: the status card, glorp pill, red edge
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

        // The gems show every ult's charge now.
        ready = !!(this.ultGems && this.ultGems[this.currentElement] >= this.ultChargeMax);
        this.elementText.setText(elementText);

        // Tower counter — only visible on lightning
        if (this.nodeCountText) {
            if (this.currentElement === 'lightning') {
                const placed = (this.engineerTowers || []).length;
                const crafting = (this.engineerTowersCrafting || []).length;
                const total = placed + crafting;
                let towerStr = `TOWERS  ${total}`;
                if (crafting > 0) towerStr += `  [${crafting} building]`;
                this.nodeCountText.setText(towerStr).setVisible(total > 0);   // (a 'TOWERS 0' floating over the gems said nothing)
            } else {
                this.nodeCountText.setVisible(false);
            }
        }

        // Orb scrap bar — lightning only
        if (this.orbBarBg) {
            // Show the bank whenever Engineering Degree is SLOTTED, not only while lightning
            // is out. Scraps now accrue from kills with any weapon, so hiding the bar
            // off-element would hide the one number the player needs in order to know when
            // it is worth switching -- they would be saving up blind.
            // The Field Kit is a passive usable in every element, so the scrap bar is always
            // on -- gating it on lightning would hide the readout in exactly the elements
            // you are meant to be earning scraps with.
            const onLightning = !!this.towerRun;   // the scrap bar: Tower runs only (scraps don't drop in story)
            this.orbBarBg.setVisible(onLightning);
            this.orbBarBorder.setVisible(onLightning);
            this.orbCountText.setVisible(onLightning);
            if (this.orbBarLabel) this.orbBarLabel.setVisible(onLightning);
            this.orbBarGfx.clear();
            if (onLightning) {
                // Was `/ 10`, a hardcoded copy of the old Tesla Coil price. Coils cost 24
                // now, so the bar filled at 10 scraps and then sat pinned while the bank
                // kept climbing to 60 -- it stopped reporting anything past the first
                // sixth. Scale to the actual cap.
                const bankCap = (typeof this._scrapCfg === 'function' ? this._scrapCfg().BANK_CAP : 10) || 10;
                const pct = Math.min(this.orbScraps / bankCap, 1);
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
                this.orbCountText.setText(`${this.orbScraps}`).setColor('#aaffcc');
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

        // Ult gems (one per element) replace the single bar. GameScene.update also draws them
        // every frame, for the pulse, the lockout sweep and the pings.
        this._drawUltGems();
        this._vfxDrawHud?.();
    }

    // ── ULT GEMS ────────────────────────────────────────────────────────────
    // Four sockets where the bar was: a charge arc that fills clockwise, a core and an icon
    // that brighten with it, a slow pulse when full, a white ring running down while the gem is
    // sealed (its ult still working, see NO_CHARGE_MS), a dark sweep over all four during the
    // shared lockout, and the key under each (the held element's also says E).
    _buildUltGems() {
        const C = this._ultCfg();
        const W = this.scale.width, H = this.scale.height;
        const SPACING = 58, R = 15;
        const x0 = W / 2 - SPACING * 1.5, y = H - 36;
        this._ultGemGfx = this.add.graphics().setScrollFactor(0).setDepth(31);
        this._ultGemUI = ['fire', 'ice', 'lightning', 'cosmic'].map((el, i) => {
            const x = x0 + i * SPACING;
            const key = this.add.text(x, y + R + 12, C.KEYS[el], {
                fontSize: '11px', fontFamily: 'monospace', color: '#8a93a6',
                stroke: '#000000', strokeThickness: 2
            }).setOrigin(0.5).setScrollFactor(0).setDepth(32);
            // a reaction's "×3", popping over the gem it charged (HUD drawUltGems)
            const react = this.add.text(x, y - R - 14, `×${C.REACTION_MULT}`, {
                fontSize: '13px', fontFamily: UIKit.FONT.title, fontStyle: 'bold', color: '#ffffff', stroke: '#000000', strokeThickness: 3
            }).setOrigin(0.5).setScrollFactor(0).setDepth(32).setAlpha(0);
            return { el, x, y, r: R, key, react };
        });
        this._ultLockText = this.add.text(W / 2, y - R - 14, '', {
            fontSize: '11px', fontFamily: 'monospace', color: '#cfd6e4',
            stroke: '#000000', strokeThickness: 2
        }).setOrigin(0.5).setScrollFactor(0).setDepth(32);
    }

    // ── STATUS ICONS OVER ENEMIES ────────────────────────────────────────────
    // Last thing each frame: an enemy's status icons stacked in rows over its health bar, so
    // they never sit on top of each other (burn pips spread wide). A row only rises when
    // there's one under it. Each system still makes and moves its own; this only sets the y.
    _stackStatusIcons() {
        const cs = this._cs;
        for (const e of this.enemies || []) {
            const s = e.sprite;
            if (!s?.active) continue;
            let y = s.y + (e._hpBarYOff || 0) - 8;   // just above the health bar
            const row = (h, place) => { place(y - h / 2); y -= h + 3; };
            const pips = e._burnStackBar?.filter(p => p?.active);
            if (pips?.length) row(7, cy => pips.forEach(p => { p.y = cy; }));
            if (e._chillBar?.active && e._chillBar.alpha > 0 && (e.chillStacks || 0) > 0) row(5, cy => { e._chillBar.y = cy - 2; });
            const hex = cs?.hexFx?.get(e);
            if (hex?.active) row(14, cy => hex.setY(cy));
            const ast = cs?.astral?.get(e);
            if (ast?.active) row(16, cy => ast.setY(cy));
            if (e._stunIndicator?.active) row(10, cy => e._stunIndicator.setY(cy));
        }
    }

    // ── RUN CLOCK AND BOOKS ──────────────────────────────────────────────────
    // Every frame in a level: the elapsed time at the top of the screen, and combat time per
    // element (time holding it while in a fight, meaning you dealt or took damage in the
    // last COMBAT_MS) for the win screen.
    _tickRunStats(time, delta) {
        const R = this._runStats;
        if (!R || this._deathScreenActive) { this._runClock?.setVisible(false); return; }
        Telemetry.room(this, this.getCurrentPlayerRoom?.() ?? -1, delta);
        if (!R.tEnd && this.time.now - (this._lastCombatAt ?? -1e9) < 3000) {
            const el = this.currentElement || 'fire';
            R.elTime[el] = (R.elTime[el] || 0) + (delta || 0);
        }
        if (!this._runClock?.active) {
            this._runClock = this.add.text(this.scale.width / 2, 16, '', {
                fontSize: '15px', fontFamily: UIKit.FONT.title, fontStyle: 'bold', color: '#e8d6ae', stroke: '#05060a', strokeThickness: 4,
            }).setOrigin(0.5, 0).setScrollFactor(0).setDepth(40);
        }
        const s = Math.floor(((R.tEnd || this.time.now) - R.t0) / 1000);
        this._runClock.setVisible(!this._pauseMenuOpen).setText(`⧗ ${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`);
    }

    // The level is yours: the clock, the kills, the haul, then which elements did the work
    // (damage dealt) and which you fought in (combat time), as bars filling one after another,
    // and the element that carried the run. A click or Enter goes back to the map.
    _showWinScreen() {
        const R = this._runStats || { dmg: {}, elTime: {}, t0: this.time.now, kills: 0 };
        const W = this.scale.width, H = this.scale.height, D = 600, P = UIKit.PALETTE, objs = [];
        const keep = o => { objs.push(o); o.setScrollFactor?.(0); return o; };
        const COL = { ...this._ultCfg().COLORS, other: 0xc8c0b0 }, NAME = { fire: 'FIRE', ice: 'ICE', lightning: 'LIGHTNING', cosmic: 'COSMIC', other: 'OTHER' };
        const fmt = ms => { const s = Math.round(ms / 1000); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; };
        this._runClock?.setVisible(false);
        keep(this.add.rectangle(W / 2, H / 2, W, H, 0x05040a, 1).setDepth(D));
        // embers in the colours of what you fought with
        const used = ['fire', 'ice', 'lightning', 'cosmic'].filter(k => (R.dmg[k] || 0) > 0);
        if (this.textures.exists('mn_px2')) keep(this.add.particles(0, 0, 'mn_px2', {
            x: { min: 0, max: W }, y: H + 6, lifespan: 5000, speedY: { min: -60, max: -25 }, speedX: { min: -8, max: 8 },
            scale: { start: 1.5, end: 0 }, alpha: { start: 0.7, end: 0 }, tint: used.length ? used.map(k => COL[k]) : [P.accentGold],
            blendMode: 'ADD', frequency: 50 }).setDepth(D + 1));
        const T = (x, y, s, o = {}) => keep(this.add.text(x, y, s, Object.assign({ fontSize: '14px', fontFamily: 'monospace', color: UIKit.CSS.textMid }, o)).setDepth(D + 4));
        const title = T(W / 2, 54, 'L E V E L   C L E A R E D', { fontSize: '40px', fontFamily: UIKit.FONT.title, fontStyle: 'bold', color: '#ffe08a', stroke: '#000', strokeThickness: 6, padding: { x: 24, y: 24 } }).setOrigin(0.5).setAlpha(0).setScale(1.3);
        title.setShadow(0, 0, '#f0b84a', 16, true, true);
        this.tweens.add({ targets: title, alpha: 1, scale: 1, duration: 420, ease: 'Back.easeOut' });
        const NAMES = { 0: 'Tutorial', 1: 'Tutorial', 2: 'The Gauntlet', 3: 'The Void Rift', 4: 'The Fracture', 5: 'The Cistern' };
        T(W / 2, 96, (NAMES[this.currentLevelIndex] || 'The Dungeon').toUpperCase(), { fontSize: '14px', fontStyle: 'bold', color: UIKit.CSS.textMid }).setOrigin(0.5);

        // the four tiles
        const earned = Math.max(0, (this.totalGlorps || 0) - (R.glorps0 ?? (this.totalGlorps || 0)));
        const tiles = [['TIME', fmt((R.tEnd || this.time.now) - R.t0)], ['SLAIN', String(R.kills || 0)], ['GLORPS', `+${earned}`], ['FRAGMENTS', `+${this._fragsThisLevel || 0}`]];
        const tw = 200, tg = 18, tx0 = W / 2 - (tiles.length * tw + (tiles.length - 1) * tg) / 2;
        tiles.forEach(([k, v], i) => {
            const x = tx0 + i * (tw + tg);
            objs.push(...UIKit.panel(this, { x, y: 128, w: tw, h: 78, accent: P.accentGold, depth: D + 2 }).objs);
            T(x + tw / 2, 146, k, { fontSize: '11px', fontStyle: 'bold', color: UIKit.CSS.textLo }).setOrigin(0.5, 0);
            const val = T(x + tw / 2, 166, v, { fontSize: '26px', fontFamily: UIKit.FONT.title, fontStyle: 'bold', color: UIKit.CSS.textHi }).setOrigin(0.5, 0).setAlpha(0);
            this.tweens.add({ targets: val, alpha: 1, y: 162, duration: 260, delay: 300 + i * 90 });
        });

        // the two charts: rows sorted biggest first, a bar each, filling in turn
        const chart = (x, title, data, valueOf, delay0) => {
            const w = 470, h = 250, y = 232;
            objs.push(...UIKit.panel(this, { x, y, w, h, accent: P.accentBlue, depth: D + 2, title, titleSize: '15px' }).objs);
            const total = Object.values(data).reduce((a, b) => a + b, 0);
            const rows = Object.entries(data).filter(([, v]) => v > 0).sort((a, b) => b[1] - a[1]);
            if (!rows.length) { T(x + w / 2, y + h / 2, 'nothing recorded', { color: UIKit.CSS.textLo }).setOrigin(0.5); return; }
            const top = rows[0][1], g = keep(this.add.graphics().setDepth(D + 3));
            rows.forEach(([k, v], i) => {
                const ry = y + 62 + i * 38, bx = x + 128, bw = w - 250;
                const dot = keep(this.add.circle(x + 26, ry, 6, COL[k]).setDepth(D + 4));
                T(x + 40, ry, NAME[k], { fontSize: '12px', fontStyle: 'bold', color: UIKit._hex(COL[k]) }).setOrigin(0, 0.5);
                g.fillStyle(0x141826, 1).fillRect(bx, ry - 7, bw, 14);
                const bar = keep(this.add.rectangle(bx, ry, bw * v / top, 14, COL[k], 1).setOrigin(0, 0.5).setDepth(D + 4).setScale(0, 1));
                this.tweens.add({ targets: bar, scaleX: 1, duration: 520, delay: delay0 + i * 140, ease: 'Cubic.easeOut', onStart: () => Sfx.play(this, 'hover') });
                T(x + w - 20, ry, `${valueOf(v)}  ${Math.round(v / total * 100)}%`, { fontSize: '12px', fontStyle: 'bold', color: UIKit.CSS.textHi }).setOrigin(1, 0.5);
                dot.setScale(0); this.tweens.add({ targets: dot, scale: 1, duration: 200, delay: delay0 + i * 140 });
            });
        };
        const dmg = Object.fromEntries(Object.entries(R.dmg).map(([k, v]) => [k, Math.round(v)]));
        chart(W / 2 - 490, 'DAMAGE BY ELEMENT', dmg, v => v.toLocaleString(), 700);
        chart(W / 2 + 20, 'TIME IN COMBAT', R.elTime, fmt, 1100);

        // the element that carried it
        const best = Object.entries(R.dmg).filter(([k]) => k !== 'other').sort((a, b) => b[1] - a[1])[0];
        if (best && best[1] > 0) {
            const b = T(W / 2, 520, `${NAME[best[0]]} CARRIED THIS RUN`, { fontSize: '22px', fontFamily: UIKit.FONT.title, fontStyle: 'bold', color: UIKit._hex(COL[best[0]]), stroke: '#000', strokeThickness: 5, padding: { x: 20, y: 20 } })
                .setOrigin(0.5).setAlpha(0).setScale(0.6);
            b.setShadow(0, 0, UIKit._hex(COL[best[0]]), 14, true, true);
            this.tweens.add({ targets: b, alpha: 1, scale: 1, duration: 360, delay: 1800, ease: 'Back.easeOut', onStart: () => Sfx.play(this, 'fanfare') });
        }
        const cont = T(W / 2, H - 40, 'click or press Enter to continue', { fontSize: '13px', color: UIKit.CSS.textLo }).setOrigin(0.5).setAlpha(0);
        this.tweens.add({ targets: cont, alpha: 1, duration: 400, delay: 2100, onComplete: () => this.tweens.add({ targets: cont, alpha: 0.35, duration: 700, yoyo: true, repeat: -1 }) });

        let done = false;
        const go = () => {
            if (done) return;
            done = true;
            this.input.off('pointerdown', go); this.input.keyboard?.off('keydown-ENTER', go);
            this.cameras.main.fadeOut(400, 0, 0, 0);
            this.time.delayedCall(400, () => this.scene.start('LevelSelect'));
        };
        this.time.delayedCall(1200, () => { this.input.on('pointerdown', go); if (this.input.keyboard) { this.input.keyboard.enabled = true; this.input.keyboard.on('keydown-ENTER', go); } });
    }

    // ── MUSIC (Sound.js) ─────────────────────────────────────────────────────
    // Each level has its track; close to a living boss it becomes the boss track, with a roar
    // as it kicks in. Checked twice a second.
    _updateMusic(time) {
        if (this._deathScreenActive || time < (this._musicCheckAt || 0)) return;
        this._musicCheckAt = time + (this._cs?.tf ? 150 : 500);
        const T = this.TILE_SIZE, near = (x, y, r = 14) => Math.hypot(x - this.playerX, y - this.playerY) <= r;
        const vb = this.voltslimeBoss, vs = this.voidSovereignBoss, fc = this.fractureCore;
        const boss = (vb?.active && vb.container && near(vb.container.x / T, vb.container.y / T))
            || (vs?.active && vs.container && near(vs.container.x / T, vs.container.y / T))
            || (fc?.active && near(fc.tileX, fc.tileY));
        const LEVEL = { 0: 'tutorial', 1: 'tutorial', 2: 'gauntlet', 3: 'voidrift', 4: 'fracture', 5: 'cistern', 6: 'tower' };
        const tf = this._cs?.tf;   // Cosmic.js: transformed, the music becomes the form's own
        const want = tf ? (tf.full ? 'ascendant' : 'rift') : boss ? 'boss' : (LEVEL[this.currentLevelIndex] || 'gauntlet');
        Telemetry.boss(this, !!boss);
        if (want !== Music._cur) {
            if (want === 'boss') Sfx.play(this, 'roar');
            Music.play(this, want);
        }
    }

    _drawUltGems() {
        const g = this._ultGemGfx;
        if (!g || !g.active || !this.ultGems || !this._ultGemUI) return;
        const C = this._ultCfg(), now = this.time.now, max = this.ultChargeMax;
        const TAU = Math.PI * 2, TOP = -Math.PI / 2;
        const lockLeft = Math.max(0, (this._ultLockUntil || 0) - now);
        const lockFrac = Math.min(1, lockLeft / C.LOCKOUT_MS);
        // Each element's icon, drawn rather than typed: emoji glyphs come out in a different
        // style (or not at all) on every platform.
        const icon = (el, x, y, color, alpha, full) => {
            const P = pts => pts.map(([px, py]) => ({ x: x + px, y: y + py }));
            if (el === 'fire') {
                g.fillStyle(color, alpha);
                g.fillPoints(P([[0, -8], [3, -3], [5.5, 1], [5, 4.5], [2.5, 7], [0, 7.5], [-2.5, 7],
                                [-5, 4.5], [-5.5, 1], [-3.5, -1], [-2.2, -4.5]]), true);
                g.fillStyle(full ? C.COLORS.fire : 0x000000, full ? 0.95 : 0.3 * alpha);   // the inner flame
                g.fillPoints(P([[0, -0.5], [2, 2.5], [2.2, 5], [0, 6.2], [-2.2, 5], [-2, 2.5]]), true);
            } else if (el === 'ice') {
                g.lineStyle(1.8, color, alpha);
                for (let k = 0; k < 3; k++) {
                    const a = Math.PI / 2 + k * Math.PI / 3, c = Math.cos(a), s = Math.sin(a);
                    g.lineBetween(x - c * 7.5, y - s * 7.5, x + c * 7.5, y + s * 7.5);
                    for (const d of [-1, 1]) {                       // a pair of twigs on each half-arm
                        const bx = x + d * c * 4.4, by = y + d * s * 4.4, out = a + (d < 0 ? Math.PI : 0);
                        for (const t of [-0.8, 0.8]) g.lineBetween(bx, by, bx + Math.cos(out + t) * 2.6, by + Math.sin(out + t) * 2.6);
                    }
                }
            } else if (el === 'lightning') {
                g.fillStyle(color, alpha);
                g.fillPoints(P([[2, -8], [-4, 1.5], [-0.5, 1.5], [-2.5, 8], [4.5, -1.5], [1, -1.5], [3.5, -8]]), true);
            } else {
                g.fillStyle(color, alpha);                               // a four-point star and a speck
                g.fillPoints(P([[0, -8], [1.8, -1.8], [8, 0], [1.8, 1.8], [0, 8], [-1.8, 1.8], [-8, 0], [-1.8, -1.8]]), true);
                g.fillCircle(x + 5, y - 5, 1.3);
            }
        };
        g.clear();
        for (const u of this._ultGemUI) {
            const col = C.COLORS[u.el];
            const fill = Math.min(1, (this.ultGems[u.el] || 0) / max);
            const full = fill >= 1;
            const held = this.currentElement === u.el;
            const denyT = now - (this._ultDenyAt[u.el] ?? -1e9);
            const x = u.x + (denyT < 260 ? Math.sin(denyT * 0.12) * 3 * (1 - denyT / 260) : 0);
            const y = u.y, r = u.r;
            // the element you hold is drawn bigger (eased), grown up from its bottom edge so it clears its key label
            u.k = (u.k ?? 1) + ((held ? 1.32 : 1) - (u.k ?? 1)) * 0.25;
            const by = y + r + 6;
            g.save(); g.translateCanvas(x, by); g.scaleCanvas(u.k, u.k); g.translateCanvas(-x, -by);
            // socket: the held element's rim lights up in its colour (white is the seal ring's)
            g.fillStyle(0x070a12, 0.88); g.fillCircle(x, y, r + 6);
            g.lineStyle(held ? 2 : 1.5, col, held ? 0.95 : 0.35); g.strokeCircle(x, y, r + 6);
            // charge: a faint track, then the arc
            g.lineStyle(4, col, 0.14); g.strokeCircle(x, y, r + 1);
            if (fill > 0) {
                const flash = now < (this._ultFlashUntil[u.el] || 0);
                g.lineStyle(4, flash ? 0xffffff : col, full ? 1 : 0.9);
                g.beginPath(); g.arc(x, y, r + 1, TOP, TOP + fill * TAU, false); g.strokePath();
            }
            // cosmic at ult stage 2: the second layer, an outer gold arc and a pip per full layer
            if (u.el === 'cosmic' && this._cs && (this._csStage?.() || 1) >= 2) {
                const l2 = Math.min(1, this._cs.layer2 || 0), l3 = Math.min(1, this._cs.layer3 || 0), L = this._csMaxLayers?.() || 2;
                if (l2 > 0) { g.lineStyle(2, 0xffd060, l2 >= 1 ? 1 : 0.7); g.beginPath(); g.arc(x, y, r + 9, TOP, TOP + l2 * TAU, false); g.strokePath(); }
                if (l3 > 0) { g.lineStyle(2, 0xffffff, l3 >= 1 ? 1 : 0.7); g.beginPath(); g.arc(x, y, r + 12, TOP, TOP + l3 * TAU, false); g.strokePath(); }
                const n = this._csLayers?.() ?? 0;
                for (let i = 0; i < L; i++) {
                    const px = x - 5 * (L - 1) + i * 10, py = y - r - 12;
                    g.fillStyle(i < n ? 0xffd060 : 0x2b2540, 1);
                    g.fillTriangle(px, py - 3, px + 3, py, px, py + 3); g.fillTriangle(px, py - 3, px - 3, py, px, py + 3);
                }
            }
            // core, then the icon: in the element's colour while charging, white once full
            g.fillStyle(col, full ? 0.92 : 0.08 + 0.42 * fill); g.fillCircle(x, y, r - 4);
            if (full) {
                const p = 0.5 + 0.5 * Math.sin(now / 190 + u.x);
                g.lineStyle(2, col, 0.25 + 0.4 * p); g.strokeCircle(x, y, r + 9 + 3 * p);
            }
            icon(u.el, x, y, full ? 0xffffff : col, full ? 1 : 0.45 + 0.45 * fill, full);
            if (full) { g.fillStyle(0xffffff, 0.55); g.fillCircle(x - 7, y - 7, 1.6); }   // glint
            // Overflow: charge banked past full, a gold arc round the gem (a whole one: +50% on the next ult)
            const ovf = full ? Math.min(1, (this._overflow?.[u.el] || 0) / this.ultChargeMax) : 0;
            if (ovf > 0.02) { g.lineStyle(3, 0xffd060, 0.95); g.beginPath(); g.arc(x, y, r + 13, TOP, TOP + ovf * TAU, false); g.strokePath(); }
            // sealed (its ult is still working): a white ring counting down to when it charges
            const sealLeft = (this._ultNoChargeUntil[u.el] || 0) - now;
            if (sealLeft > 0) {
                const left = Math.min(1, sealLeft / C.NO_CHARGE_MS[u.el]);
                g.lineStyle(2, 0xffffff, 0.85);
                g.beginPath(); g.arc(x, y, r + 6, TOP, TOP + left * TAU, false); g.strokePath();
            }
            // shared lockout: a dark sweep over every socket
            if (lockFrac > 0) {
                g.fillStyle(0x000000, 0.55);
                g.slice(x, y, r + 6, TOP, TOP + lockFrac * TAU, false); g.fillPath();
            }
            // reaction: a bright ring pulses out and "×3" pops above the gem
            const reactT = now - (this._ultReactAt?.[u.el] ?? -1e9);
            if (reactT < 450) {
                const k = reactT / 450;
                g.lineStyle(3 * (1 - k) + 1, 0xffffff, 0.9 * (1 - k)); g.strokeCircle(x, y, r + 6 + 10 * k);
            }
            if (u.react) {
                const show = reactT < 700;
                if (show) u.react.setText(this._ultReactKind?.[u.el] === 'residue' ? `×${this._ultCfg().RESIDUE_MULT}` : `×${this._ultCfg().REACTION_MULT}`);
                u.react.setAlpha(show ? Math.min(1, (700 - reactT) / 250) : 0).setY(y - r - (u.el === "cosmic" ? 24 : 14) - (show ? 6 * Math.min(1, reactT / 200) : 0))
                    .setScale(show && reactT < 120 ? 1 + 0.4 * (1 - reactT / 120) : 1).setColor('#' + col.toString(16).padStart(6, '0'));
            }
            // ready ping: one ring out when the gem fills (and a chime, once per fill)
            const pingT = now - (this._ultReadyAt[u.el] ?? -1e9);
            if (!this._sfxReadySeen) this._sfxReadySeen = {};
            if (this._ultReadyAt[u.el] !== this._sfxReadySeen[u.el]) {
                if (this._sfxReadySeen[u.el] !== undefined && pingT < 300) Sfx.play(this, 'ready');
                this._sfxReadySeen[u.el] = this._ultReadyAt[u.el];
            }
            if (pingT < 520) {
                const k = pingT / 520;
                g.lineStyle(3 * (1 - k) + 0.5, col, 1 - k); g.strokeCircle(x, y, r + 7 + 22 * k);
            }
            // cast: a white burst off the socket
            const castT = now - (this._ultCastAt[u.el] ?? -1e9);
            if (castT < 420) {
                const k = castT / 420;
                g.lineStyle(4 * (1 - k) + 0.5, 0xffffff, 1 - k); g.strokeCircle(x, y, r + 5 + 26 * k);
            }
            g.restore();
            u.key.setX(x).setText(held ? 'E·' + C.KEYS[u.el] : C.KEYS[u.el]).setColor(full ? '#ffffff' : '#8a93a6');
        }
        this._ultLockText.setText(lockLeft > 0 ? (lockLeft / 1000).toFixed(1) + 's' : '');
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

        const healModeActive = this.time.now < (this._frostShieldUntil || 0);   // the Frost Shield is up
        const chargeFrac     = Math.min((this._icicleHitCounter || 0) / HITS_TO_CHARGE, 1);

        // Create bar objects once
        if (!this._icicleBarBg?.active) {   // (dead after a floor change: the scene object outlives it)
            this._icicleBarBg       = this.add.rectangle(px, py,   BAR_W + 4, BAR_H + 4, 0x001122, 0.80).setDepth(5.8);
            this._icicleBarFill     = this.add.rectangle(px - BAR_W/2, py, 0, BAR_H, 0x5ac8ff, 1).setOrigin(0, 0.5).setDepth(5.9);
            this._icicleHealBg      = this.add.rectangle(px, py - 7, BAR_W + 4, BAR_H + 4, 0x001122, 0.80).setDepth(5.8);
            this._icicleHealFill    = this.add.rectangle(px - BAR_W/2, py - 7, BAR_W, BAR_H, 0x9fe8ff, 1).setOrigin(0, 0.5).setDepth(5.9);
            this._icicleBarLabel    = this.add.text(px, py + 6, 'FROST SHIELD', {
                fontSize: '8px', fontFamily: UIKit.FONT.title, fontStyle: 'bold', color: '#9fe8ff', stroke: '#05101a', strokeThickness: 3, resolution: 2
            }).setOrigin(0.5, 0).setDepth(6);
            this._icicleHealLabel   = this.add.text(px, py - 7 - 5, 'SHIELD UP', {
                fontSize: '8px', fontFamily: UIKit.FONT.title, fontStyle: 'bold', color: '#d8f6ff', stroke: '#05101a', strokeThickness: 3, resolution: 2
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
        this._icicleBarFill.setFillStyle(chargeFrac >= 1 ? 0xffdd44 : 0x5ac8ff);
        this._icicleBarLabel.setColor(chargeFrac >= 1 ? '#ffdd44' : '#33bb77');

        // Heal armed indicator — solid bar pulsing green when armed, hidden otherwise
        this._icicleHealBg.setVisible(healModeActive);
        this._icicleHealFill.setVisible(healModeActive);
        this._icicleHealLabel.setVisible(healModeActive);
        if (healModeActive) {
            this._icicleHealFill.width = BAR_W * (this._frostShieldUntil - this.time.now) / 5000;   // its time left
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
            this._icicleReadyText = this.add.text(rtx, rty, `❄ SHIELD READY · ${Settings.label(Settings.key('surge'))}`, {
                fontSize: '13px', fontFamily: 'monospace', color: '#00ff88',
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
        this._freezeClock(true);
        this.input.keyboard.enabled = true; // keep ESC working

        const P = UIKit.PALETTE;
        const W = this.scale.width, H = this.scale.height;
        this._pauseObjs = [];
        const track = kit => { this._pauseObjs.push(...kit.objs); return kit; };

        // Modal dim. Interactive so clicks cannot reach gameplay controls behind it.
        track(UIKit.overlay(this, { alpha: 0.72, depth: 500 }));

        const panelW = 340, panelH = 420;
        const pxx = W / 2 - panelW / 2, pyy = H / 2 - panelH / 2;
        track(UIKit.panel(this, {
            x: pxx, y: pyy, w: panelW, h: panelH,
            accent: P.accentBlue, depth: 501, sweepDuration: 3000
        }));

        const title = this.add.text(W / 2, pyy + 40, 'PAUSED', {
            fontSize: '29px', fontFamily: 'monospace', fontStyle: 'bold',
            color: UIKit.CSS.textHi, stroke: '#000', strokeThickness: 5
        }).setOrigin(0.5).setScrollFactor(0).setDepth(503);
        this._pauseObjs.push(title);

        // Letter-spaced subtitle under the title — cheap way to make a plain menu feel
        // designed rather than defaulted.
        const sub = this.add.text(W / 2, pyy + 64, 'G A M E   H A L T E D', {
            fontSize: '13px', fontFamily: 'monospace',
            color: UIKit.CSS.textLo, stroke: '#000', strokeThickness: 2
        }).setOrigin(0.5).setScrollFactor(0).setDepth(503);
        this._pauseObjs.push(sub);

        const div = this.add.graphics().setScrollFactor(0).setDepth(503);
        div.lineStyle(1.5, P.accentBlue, 0.35);
        div.lineBetween(pxx + 36, pyy + 84, pxx + panelW - 36, pyy + 84);
        // Centre diamond on the divider.
        div.fillStyle(P.accentBlue, 0.8);
        div.fillPoints([{ x: W / 2, y: pyy + 79 }, { x: W / 2 + 5, y: pyy + 84 },
                        { x: W / 2, y: pyy + 89 }, { x: W / 2 - 5, y: pyy + 84 }], true);
        this._pauseObjs.push(div);

        // Named handles, so a scene reusing this menu can repoint a button without
        // index arithmetic over _pauseObjs. TowerDefenseScene uses _pauseBtns.restart.
        this._pauseBtns = {};
        const btnDefs = [
            { key: 'resume',   label: 'RESUME',    accent: P.accentBlue,
              action: () => this.closePauseMenu() },
            // RESTART re-enters a level, which is a heavy transition, so it gets the
            // loader. MAIN MENU below does not — returning to a menu is instant and a
            // loading screen there would be pure padding.
            { key: 'restart',  label: 'RESTART',   accent: P.accentOrange,
              action: () => {
                  this.closePauseMenu();
                  // a Tower run restarts from floor 1 (Tower.js)
                  const go = () => this.scene.start('Game', this.trainingRun ? { levelIndex: 98, training: true } : this.towerRun ? { levelIndex: 6, tower: TowerFloors.newRun() } : { levelIndex: this.currentLevelIndex, tutorialStage: this.tutorialStage });
                  if (typeof Transitions !== 'undefined') {
                      Transitions.loader(this, { title: 'RESTARTING', accent: P.accentOrange, duration: 700, onDone: go });
                  } else { go(); }
              } },
            { key: 'mainMenu', label: 'MAIN MENU', accent: P.accentRed,
              action: () => { this.closePauseMenu(); this.scene.start('LevelSelect'); } }   // unpause first: the pause freezes the game-wide animations
        ];
        btnDefs.forEach((def, i) => {
            const b = UIKit.button(this, {
                x: W / 2, y: pyy + 126 + i * 58, w: 248, h: 44,
                label: def.label, accent: def.accent, depth: 502,
                onClick: def.action
            });
            this._pauseBtns[def.key] = b;
            this._pauseObjs.push(...b.objs);
            // Stagger the entrance so the buttons cascade in rather than appearing flat.
            b.objs.forEach(ob => { ob.alpha = 0; });
            this.tweens.add({ targets: b.objs, alpha: 1, duration: 180, delay: 60 + i * 70, ease: 'Quad.easeOut' });
        });

        // Volume: music and sound, ten steps each (Sound.js), clicked down or up
        [['MUSIC', () => Music.volume(), v => Music.setVolume(v)], ['SOUND', () => Sfx.volume(), v => { Sfx.setVolume(v); Sfx.play(this, 'pickup'); }]].forEach(([label, get, set], i) => {
            const ry = pyy + 318 + i * 34, x0 = pxx + 44;
            const t = this.add.text(x0, ry, label, { fontSize: '13px', fontFamily: 'monospace', fontStyle: 'bold', color: UIKit.CSS.textMid })
                .setOrigin(0, 0.5).setScrollFactor(0).setDepth(503);
            const bar = this.add.graphics().setScrollFactor(0).setDepth(503);
            const bx = x0 + 96, bw = 130;
            const draw = () => {
                const v = get(); bar.clear();
                for (let k = 0; k < 10; k++) {
                    bar.fillStyle(k < Math.round(v * 10) ? P.accentBlue : 0x1a2236, 1);
                    bar.fillRect(bx + k * (bw / 10), ry - 6, bw / 10 - 3, 12);
                }
            };
            draw();
            const btn = (sx, glyph, d) => {
                const b = this.add.text(sx, ry, glyph, { fontSize: '18px', fontFamily: 'monospace', fontStyle: 'bold', color: UIKit.CSS.textHi })
                    .setOrigin(0.5).setScrollFactor(0).setDepth(504).setInteractive({ useHandCursor: true });
                b.on('pointerdown', () => { set(Math.round(Math.max(0, Math.min(1, get() + d)) * 10) / 10); draw(); });
                return b;
            };
            this._pauseObjs.push(t, bar, btn(bx - 16, '−', -0.1), btn(bx + bw + 14, '+', 0.1));
        });

        const hint = this.add.text(W / 2, pyy + panelH - 26, 'ESC to resume', {
            fontSize: '13px', fontFamily: 'monospace',
            color: UIKit.CSS.textLo, stroke: '#000', strokeThickness: 2
        }).setOrigin(0.5).setScrollFactor(0).setDepth(503);
        this._pauseObjs.push(hint);
    }


    closePauseMenu() {
        if (!this._pauseMenuOpen) return;
        this._pauseMenuOpen = false;
        this._freezeClock(false);
        if (this._pauseObjs) {
            this._pauseObjs.forEach(o => { if (o && o.active) { this.tweens.killTweensOf(o); o.destroy(); } });
            this._pauseObjs = null;
        }
        // UIKit's sweep/mote tweens target objects in _pauseObjs, so killTweensOf above
        // already stops them; this just drops the button handles so a stale setOnClick
        // cannot fire against destroyed graphics.
        this._pauseBtns = null;
    }

    // Paused, the game's time stands still. update() already returns early, but time.now is
    // the game loop's clock and kept running, so every cooldown, buff and timer stamped with
    // it ran out behind the menu. The scene clock is fed the loop's time minus however long
    // it has been paused (so time.now picks up where it stopped), its timers are held, and
    // the tweens and animations already running are frozen; the menu's own tweens start
    // after, so they still play.
    _freezeClock(on) {
        const clock = this.time;
        // time.now becomes: the loop's time minus every pause so far, held still while paused.
        // (A property, because Phaser registered clock.update at boot; wrapping it does nothing.)
        if (!clock._pauseWrapped) {
            clock._pauseWrapped = true;
            clock._pauseShift = 0; clock._rawNow = clock.now; clock._heldNow = null;
            Object.defineProperty(clock, 'now', {
                configurable: true,
                get() { return this._heldNow ?? (this._rawNow - this._pauseShift); },
                set(v) { this._rawNow = v; },
            });
        }
        if (on) {
            clock._heldNow = clock.now; clock._pausedRaw = clock._rawNow;
            clock.paused = true;
            // only the tweens already running: pauseAll() freezes the whole manager, menu included
            this._frozenTweens = this.tweens.getTweens().filter(t => t.isPlaying());
            this._frozenTweens.forEach(t => t.pause());
            this.anims.pauseAll();
        } else if (clock._heldNow != null) {
            clock._pauseShift += clock._rawNow - clock._pausedRaw;
            clock._heldNow = null;
            clock.paused = false;
            (this._frozenTweens || []).forEach(t => t.resume?.());
            this._frozenTweens = null;
            this.anims.resumeAll();
        }
    }

    // ─── DEATH SCREEN ─────────────────────────────────────────────────────────

    gameOver() {
        if (this._deathScreenActive) return;
        Telemetry.death(this); Telemetry.end(this, 'death');
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

        Sfx.play(this, 'death');
        Music.play(this, null);
        this.showDeathScreen();
    }

    // What the death screen's summary panel shows: { rows: [[label, value, highlight]], badge }.
    // Story levels: the level, time, kills and glorps earned this run (GameScene._runStats).
    // A Tower run sets this.towerRun = { floor, best, newBest } and gets floor reached and best
    // floor at the top instead of the level, with NEW BEST when it beat the old one.
    _deathSummary() {
        const st = this._runStats || {};
        const secs = Math.max(0, Math.floor((this.time.now - (st.t0 ?? this.time.now)) / 1000));
        const time = `${Math.floor(secs / 60)}:${String(secs % 60).padStart(2, '0')}`;
        const earned = Math.max(0, (this.totalGlorps || 0) - (st.glorps0 ?? (this.totalGlorps || 0)));
        const rows = [];
        const tr = this.towerRun;
        if (tr) {
            rows.push(['Floor reached', String(tr.floor), true]);
            rows.push(['Best floor', String(tr.best), !!tr.newBest]);
            // the whole climb, not just this floor (Tower.js carries these up)
            if (tr.t0) { const s = Math.max(0, Math.floor((Date.now() - tr.t0) / 1000)); rows.push(['Climb time', `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`, false]); }
            const boons = Object.values(tr.picks || {}).reduce((a, b) => a + b, 0);
            if (boons) rows.push(['Boons taken', String(boons), false]);
            if (tr.relics) rows.push(['Relics found', `+${tr.relics}`, true]);
            if (tr.books) rows.push(['Books found', `+${tr.books}`, true]);
        } else {
            const NAMES = { 0: 'Tutorial', 1: 'Tutorial', 2: 'The Gauntlet', 3: 'The Void Rift', 4: 'The Fracture', 5: 'The Cistern' };
            const i = this.currentLevelIndex ?? 0;
            rows.push(['Level', this.isTutorial || this.isIceTutorial ? 'Tutorial' : (NAMES[i] ?? `Depth ${i}`), false]);
        }
        if (!tr?.t0) rows.push(['Time survived', time, false]);
        rows.push(['Slimes slain', String((st.kills ?? 0) + (tr?.kills || 0)), false]);
        rows.push(['Glorps earned', `+${earned}`, earned > 0]);
        if (this._fragsThisLevel) rows.push(['Fragments earned', `+${this._fragsThisLevel}`, true]);
        return { rows, badge: tr?.newBest ? 'NEW BEST' : null };
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

        // A fresh camera renders EVERYTHING by default, and the main camera's fadeOut does
        // not apply to it -- so uiCam was drawing the live world at scroll (0,0), which is
        // why the death screen showed the level's top-left corner instead of black on every
        // level. Snapshot everything that already exists and hide all of it from uiCam;
        // only the death UI created below stays visible to it.
        uiCam.ignore(this.children.list.slice());
        if (this._uiCam) this._uiCam.setVisible(false);   // Visuals.js' HUD camera

        // Belt and braces: an opaque backdrop on uiCam's own layer, so it is black even if
        // something gets added to the scene after this point.
        const deathBackdrop = this.add.rectangle(W / 2, H / 2, W, H, 0x000000, 1)
            .setScrollFactor(0).setDepth(900);
        this.cameras.main.ignore(deathBackdrop);

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

        // First your slime dies, the way your element kills it (_deathFx); the words and the
        // summary come in once it has. T0 is how long that takes.
        const T0 = this._deathFx(this.currentElement || 'fire', W / 2, H * 0.44, ui);

        const fadeIn = (obj, delay, dur = 400) => {
            obj.setAlpha(0);
            this.time.delayedCall(T0 + delay, () =>
                this.tweens.add({ targets: obj, alpha: 1, duration: dur, ease: 'Quad.easeOut' })
            );
        };

        // "YOU DIED"
        const topY = H * 0.2;
        const died = ui(this.add.text(W / 2, topY, 'YOU DIED', {
            fontSize: '64px', fontFamily: UIKit.FONT.title, fontStyle: 'bold',
            color: '#cc1100', stroke: '#000000', strokeThickness: 10
        }).setOrigin(0.5).setDepth(950).setAlpha(0).setScale(1.15));
        this.time.delayedCall(T0 + 80, () => {
            this.tweens.add({ targets: died, alpha: 1, scaleX: 1, scaleY: 1, duration: 280, ease: 'Back.easeOut' });
        });

        // Subtitle
        fadeIn(ui(this.add.text(W / 2, topY + 62, subtitle, {
            fontSize: '19px', fontFamily: 'monospace', color: UIKit.CSS.accentOrange,
            stroke: '#000', strokeThickness: 3, align: 'center'
        }).setOrigin(0.5).setDepth(950)), 380);

        // Run summary: an iron-framed panel, one row per line of _deathSummary(). Its rows
        // count up from zero where they're numbers, so the screen reads as a tally.
        const sum = this._deathSummary();
        const ROW_H = 30, pw = Math.min(440, W - 40), ph = 56 + sum.rows.length * ROW_H;
        const px = W / 2 - pw / 2, py = topY + 104;
        const pane = UIKit.panel(this, { x: px, y: py, w: pw, h: ph, accent: UIKit.PALETTE.accentRed, depth: 951, title: 'THE RUN', titleSize: '17px' });
        pane.objs.forEach(o => { ui(o); fadeIn(o, 520, 320); });
        sum.rows.forEach(([label, value, hi], r) => {
            const ry = py + 58 + r * ROW_H;
            const l = ui(this.add.text(px + 24, ry, label, {
                fontSize: '15px', fontFamily: 'monospace', color: UIKit.CSS.textMid
            }).setOrigin(0, 0.5).setDepth(952));
            const v = ui(this.add.text(px + pw - 24, ry, value, {
                fontSize: '17px', fontFamily: 'monospace', fontStyle: 'bold',
                color: hi ? UIKit.CSS.accentGold : UIKit.CSS.textHi, stroke: '#000', strokeThickness: 3
            }).setOrigin(1, 0.5).setDepth(952));
            fadeIn(l, 600 + r * 90, 260); fadeIn(v, 600 + r * 90, 260);
            const m = /^(\+?)(\d+)$/.exec(value);
            if (m && +m[2] > 0) {
                const c = { n: 0 };
                this.tweens.add({ targets: c, n: +m[2], delay: T0 + 600 + r * 90, duration: 520, ease: 'Quad.easeOut',
                                  onUpdate: () => v.setText(m[1] + Math.round(c.n)) });
            }
        });
        if (sum.badge) {
            const b = ui(this.add.text(px + pw - 18, py + 14, sum.badge, {
                fontSize: '13px', fontFamily: UIKit.FONT.title, fontStyle: 'bold', color: UIKit.CSS.textDeep,
                backgroundColor: UIKit.CSS.accentGold, padding: { x: 8, y: 3 }
            }).setOrigin(1, 0.5).setDepth(953).setAngle(4));
            fadeIn(b, 600 + sum.rows.length * 90, 260);
        }

        // Buttons, under the panel
        const btnY = Math.min(H - 40, py + ph + 52);
        [
            { label: 'TRY AGAIN', accent: UIKit.PALETTE.accentRed, x: W / 2 - 125, action: () => { this.scene.start('Game', this.trainingRun ? { levelIndex: 98, training: true } : this.towerRun ? { levelIndex: 6, tower: TowerFloors.newRun() } : { levelIndex: this.currentLevelIndex, tutorialStage: this.tutorialStage }); } },
            { label: 'MAIN MENU', accent: UIKit.PALETTE.accentGold, x: W / 2 + 125, action: () => this.scene.start('LevelSelect') },
        ].forEach((def, i) => {
            const b = UIKit.button(this, { x: def.x, y: btnY, w: 210, h: 44, label: def.label, accent: def.accent,
                                           depth: 952, fontSize: '18px', fireOn: 'down', onClick: def.action });
            b.objs.forEach(o => { if (o.setAlpha) { ui(o); fadeIn(o, 900 + i * 80, 300); } });
        });
    }

    // ── HOW YOU DIED ──────────────────────────────────────────────────────────
    // Your slime, centre screen on the black, dies the way the element you were holding
    // would kill it, and that element's weather stays on behind the summary:
    //   fire       it burns and slumps into a pile of ash and smoke; embers keep rising
    //   ice        it frosts over inside a cube that shatters into falling shards; snow
    //   lightning  three strikes, it flickers and chars into a smoking scorch; far-off flashes
    //   cosmic     a vortex opens and it spirals in, the vortex pops; stars drift inward
    // ui(obj) hides an object from the faded world camera. Returns ms until the words come in.
    _deathFx(el, cx, cy, ui) {
        const W = this.scale.width, H = this.scale.height, D = 945, END = 1500;
        if (!this.textures.exists('dfx_px')) {
            const t = this.make.graphics({}, false); t.fillStyle(0xffffff, 1); t.fillRect(0, 0, 4, 4); t.generateTexture('dfx_px', 4, 4); t.destroy();
        }
        const parts = (x, y, cfg, d = D + 1) => ui(this.add.particles(x, y, 'dfx_px', cfg).setDepth(d));
        const at = (ms, fn) => this.time.delayedCall(ms, fn);
        const flash = (col, a, ms) => {
            const f = ui(this.add.rectangle(W / 2, H / 2, W, H, col, a).setDepth(D + 3).setBlendMode(Phaser.BlendModes.ADD));
            this.tweens.add({ targets: f, alpha: 0, duration: ms, onComplete: () => f.destroy() });
        };
        // Origin at its body: the slime fills only the bottom of its 32px frame.
        const slime = ui(this.add.sprite(cx, cy, 'slime_blue', 0).setOrigin(0.5, 0.8).setScale(5).setDepth(D));
        // What's left of you clears away as the summary panel arrives over it.
        const remains = [slime];
        const keep = o => { remains.push(o); return o; };
        at(END + 500, () => remains.forEach(o => o?.active && this.tweens.add({ targets: o, alpha: 0, duration: 400, onComplete: () => o.destroy() })));

        if (el === 'ice') {
            slime.setTint(0xcfefff);
            const cube = ui(this.add.graphics().setDepth(D + 1).setAlpha(0));
            cube.fillStyle(0x9fdcff, 0.28); cube.fillRect(cx - 64, cy - 58, 128, 90);
            cube.lineStyle(3, 0xe8f8ff, 0.9); cube.strokeRect(cx - 64, cy - 58, 128, 90);
            cube.lineStyle(2, 0xffffff, 0.6); cube.lineBetween(cx - 52, cy - 48, cx - 22, cy - 48); cube.lineBetween(cx - 52, cy - 48, cx - 52, cy - 26);
            this.tweens.add({ targets: cube, alpha: 1, duration: 450, ease: 'Quad.easeOut' });
            at(300, () => slime.setTint(0x7fc8f0));
            at(1000, () => {
                Sfx.play(this, 'kill');
                flash(0xd8f2ff, 0.5, 300);
                slime.destroy(); cube.destroy();
                for (let k = 0; k < 18; k++) {
                    const sh = keep(ui(this.add.graphics().setDepth(D + 1)));
                    const s = 6 + Math.random() * 12;
                    sh.fillStyle(k % 3 ? 0xbfe8ff : 0xffffff, 0.95);
                    sh.fillTriangle(-s / 2, 0, s / 2, -s * 0.3, 0, s);
                    sh.setPosition(cx, cy);
                    const a = Math.random() * Math.PI * 2, d = 60 + Math.random() * 120;
                    this.tweens.add({ targets: sh, x: cx + Math.cos(a) * d, duration: 900, ease: 'Quad.easeOut' });
                    this.tweens.add({ targets: sh, y: cy + Math.sin(a) * d * 0.5 + 90, angle: (Math.random() - 0.5) * 540, duration: 900, ease: 'Quad.easeIn' });
                }
            });
            parts(0, -10, { x: { min: 0, max: W }, speedY: { min: 18, max: 46 }, speedX: { min: -14, max: 14 }, lifespan: 16000,
                            scale: { min: 0.5, max: 1.3 }, alpha: { start: 0.75, end: 0.2 }, tint: [0xd8f2ff, 0xffffff], frequency: 80 }, D - 2);
        } else if (el === 'lightning') {
            const bolt = (x0) => {
                const g = ui(this.add.graphics().setDepth(D + 2).setBlendMode(Phaser.BlendModes.ADD));
                const pts = [[x0, 0]];
                let x = x0, y = 0;
                while (y < cy - 10) { y = Math.min(cy - 10, y + 24 + Math.random() * 30); x += (cx - x) * 0.3 + (Math.random() - 0.5) * 50; pts.push([x, y]); }
                pts[pts.length - 1][0] = cx;
                for (const [w, col, a] of [[10, 0xffe14a, 0.35], [4, 0xfff6b0, 1]]) {
                    g.lineStyle(w, col, a); g.beginPath(); g.moveTo(pts[0][0], pts[0][1]);
                    pts.forEach(p => g.lineTo(p[0], p[1])); g.strokePath();
                }
                this.tweens.add({ targets: g, alpha: 0, duration: 220, onComplete: () => g.destroy() });
                flash(0xfff6b0, 0.35, 200);
                Sfx.play(this, 'hit', { el: 'lightning' });
                const sp = parts(cx, cy, { speed: { min: 120, max: 320 }, lifespan: 380, scale: { start: 1.6, end: 0 },
                                           tint: [0xfff6b0, 0xffe14a], blendMode: 'ADD', emitting: false });
                sp.explode(24);
                at(500, () => sp.destroy());
            };
            [0, 280, 620].forEach((ms, k) => at(ms, () => bolt(cx + (k - 1) * 140 + (Math.random() - 0.5) * 60)));
            let n = 0;
            const flick = this.time.addEvent({ delay: 60, repeat: 14, callback: () => { if (slime.active) slime.setTint(++n % 2 ? 0xffffff : 0x303040); } });
            at(950, () => {
                flick.remove();
                Sfx.play(this, 'kill');
                slime.setTint(0x1c1a1a);
                this.tweens.add({ targets: slime, scaleY: 1.5, scaleX: 6, y: cy + 12, duration: 260, ease: 'Quad.easeIn' });
                keep(ui(this.add.ellipse(cx, cy + 30, 170, 28, 0x0c0806, 1).setStrokeStyle(2, 0x3a2a10, 0.8).setDepth(D - 1)));
                keep(parts(cx, cy + 20, { speedY: { min: -50, max: -20 }, speedX: { min: -10, max: 10 }, lifespan: 1800,
                                          scale: { start: 2.5, end: 5 }, alpha: { start: 0.25, end: 0 }, tint: 0x555555, frequency: 90 }));
            });
            const far = this.time.addEvent({ delay: 2200, loop: true, callback: () => { if (Math.random() < 0.6) flash(0xb8c8ff, 0.06 + Math.random() * 0.06, 260); } });
            this.events.once('shutdown', () => far.remove());
        } else if (el === 'cosmic') {
            const vortex = ui(this.add.graphics().setDepth(D - 1).setPosition(cx, cy).setScale(0));
            for (let arm = 0; arm < 4; arm++) {
                for (let k = 0; k < 28; k++) {
                    const t = k / 28, a = arm * Math.PI / 2 + t * Math.PI * 2.2, r = 10 + t * 110;
                    vortex.fillStyle(k % 3 ? 0x9a5cf0 : 0xf4e6ff, 0.9 - t * 0.6);
                    vortex.fillCircle(Math.cos(a) * r, Math.sin(a) * r * 0.6, 4 - t * 2.5);
                }
            }
            vortex.fillStyle(0x05020a, 1); vortex.fillEllipse(0, 0, 44, 28);
            this.tweens.add({ targets: vortex, scale: 1, duration: 450, ease: 'Back.easeOut' });
            this.tweens.add({ targets: vortex, angle: 720, duration: 2000 });
            this.tweens.add({ targets: slime, angle: 900, scale: 0, delay: 250, duration: 950, ease: 'Cubic.easeIn' });
            at(1250, () => {
                Sfx.play(this, 'kill');
                this.tweens.add({ targets: vortex, scale: 0, duration: 180, ease: 'Back.easeIn', onComplete: () => vortex.destroy() });
                flash(0xc99cff, 0.45, 320);
            });
            parts(0, 0, { x: { min: 0, max: W }, y: { min: 0, max: H }, moveToX: cx, moveToY: cy, lifespan: { min: 5000, max: 9000 },
                          scale: { start: 0.9, end: 0.2 }, alpha: { start: 0.8, end: 0 }, tint: [0xf4e6ff, 0xc99cff, 0x9a5cf0],
                          blendMode: 'ADD', frequency: 140 }, D - 2);
        } else {   // fire
            slime.setTint(0xffb070);
            const fl = parts(cx, cy, { speedY: { min: -170, max: -70 }, speedX: { min: -30, max: 30 }, lifespan: 650,
                                            scale: { start: 2.6, end: 0 }, tint: [0xffd060, 0xff7a30, 0xff3a10], blendMode: 'ADD',
                                            frequency: 10, emitZone: { type: 'random', source: new Phaser.Geom.Rectangle(-50, -20, 100, 40) } });
            at(350, () => slime.setTint(0xa0401a));
            at(700, () => slime.setTint(0x3a2218));
            this.tweens.add({ targets: slime, scaleY: 1.7, scaleX: 6, y: cy + 12, delay: 300, duration: 900, ease: 'Quad.easeIn' });
            at(1200, () => {
                fl.stop();
                Sfx.play(this, 'kill');
                this.tweens.add({ targets: slime, alpha: 0, duration: 300, onComplete: () => slime.destroy() });
                const ash = keep(ui(this.add.graphics().setDepth(D - 1)));
                ash.fillStyle(0x2a2624, 1); ash.fillEllipse(cx, cy + 30, 120, 24);
                ash.fillStyle(0x4a4440, 1); ash.fillEllipse(cx - 14, cy + 24, 54, 13); ash.fillEllipse(cx + 22, cy + 27, 38, 10);
                keep(parts(cx, cy + 22, { speedY: { min: -60, max: -25 }, speedX: { min: -12, max: 12 }, lifespan: 2000,
                                          scale: { start: 2, end: 5 }, alpha: { start: 0.25, end: 0 }, tint: 0x6a6460, frequency: 80 }));
            });
            parts(0, H + 10, { x: { min: 0, max: W }, speedY: { min: -70, max: -25 }, speedX: { min: -12, max: 12 }, lifespan: 9000,
                               scale: { start: 1.3, end: 0 }, alpha: { start: 0.9, end: 0 }, tint: [0xff9a3c, 0xffd060, 0xff6428],
                               blendMode: 'ADD', frequency: 70 }, D - 2);
        }
        return END;
    }

    // ── BOSS BAR ─────────────────────────────────────────────────────────────
    // One bar across the top for the boss you are fighting: its name over it, a pale chunk that
    // trails the fill down when it is hurt, a line under it for what it is doing. The boss's
    // update calls it every frame; _bossBarHide when it is gone.
    _bossBar(frac, name, col, sub = '') {
        let B = this._bossBarUI;
        if (!B?.g?.active) {
            const T = (size, style) => this.add.text(0, 0, '', { fontSize: size, fontFamily: UIKit.FONT.title, fontStyle: style, color: '#f3e3b8', stroke: '#07060a', strokeThickness: 4 })
                .setScrollFactor(0).setDepth(41).setAlpha(0);
            B = this._bossBarUI = { g: this.add.graphics().setScrollFactor(0).setDepth(40).setAlpha(0), title: T('18px', 'bold').setOrigin(0.5, 1),
                sub: T('13px', 'italic').setOrigin(0.5, 0).setColor('#cdbf9f'), trail: frac, hitAt: 0, a: 0 };
            this.tweens.add({ targets: B, a: 1, duration: 500 });
        }
        frac = Math.max(0, Math.min(1, frac));
        const now = this.time.now;
        if (frac < (B.last ?? frac)) B.hitAt = now;
        B.last = frac;
        if (now - B.hitAt > 450) B.trail = Math.max(frac, B.trail - 0.0125);   // the trail catches up after a beat
        const W = this.scale.width, BW = Math.round(Math.min(620, W * 0.46)), BH = 12, x = Math.round(W / 2 - BW / 2), y = 88;
        const g = B.g; g.clear().setAlpha(B.a);
        g.fillStyle(0x000000, 0.45); g.fillRoundedRect(x - 6, y - 5, BW + 12, BH + 10, 5);
        g.fillStyle(0x1a1410, 1); g.fillRect(x, y, BW, BH);
        g.fillStyle(0xfff0d0, 0.8); g.fillRect(x, y, BW * B.trail, BH);
        g.fillStyle(col, 1); g.fillRect(x, y, BW * frac, BH);
        g.fillStyle(0xffffff, 0.22); g.fillRect(x, y, BW * frac, 3);                    // a lit top edge
        g.fillStyle(0x000000, 0.25); g.fillRect(x, y + BH - 3, BW * frac, 3);
        g.fillStyle(0x07060a, 0.7); for (const f of [0.25, 0.5, 0.75]) g.fillRect(x + BW * f - 1, y, 2, BH);   // quarter notches
        g.lineStyle(2, 0x8a7a5e, 1); g.strokeRect(x - 1, y - 1, BW + 2, BH + 2);
        g.fillStyle(0xc9b48a, 1); for (const ex of [x - 4, x + BW + 4]) { g.fillTriangle(ex, y + BH / 2 - 6, ex + (ex < W / 2 ? -7 : 7), y + BH / 2, ex, y + BH / 2 + 6); }
        B.title.setText(name).setPosition(W / 2, y - 6).setAlpha(B.a);
        B.sub.setText(sub).setPosition(W / 2, y + BH + 6).setAlpha(B.a * 0.9);
    }
    _bossBarHide() {
        const B = this._bossBarUI;
        if (!B) return;
        this._bossBarUI = null;
        const all = [B.g, B.title, B.sub].filter(o => o?.active);
        this.tweens.add({ targets: all, alpha: 0, duration: 600, delay: 300, onComplete: () => all.forEach(o => o.destroy()) });
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
            fontSize: '23px',
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