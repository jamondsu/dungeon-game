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
            'fire': 'FIRE',
            'ice': 'ICE',
            'lightning': 'LIGHTNING',
            'cosmic': 'COSMIC'
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
    // Four sockets, a gem in each (ui_ultgem: a ruby with a flame, an aquamarine with a snowflake, a topaz with a bolt, an
    // amethyst with a star): dark, and lit from the bottom up as it charges; full, it glints, glows and gives off sparkles,
    // with a burst the moment it fills. A white ring running down while the gem is sealed (its ult still working, see
    // NO_CHARGE_MS), a dark sweep over all four during the shared lockout, and the key under each (the held element's also says E).
    _buildUltGems() {
        const C = this._ultCfg(), gt = this.textures.get('ui_ultgem');
        if (!gt.has('fire_dark')) ['fire', 'ice', 'lightning', 'cosmic'].forEach((el, c) => ['dark', 'lit', 'shine'].forEach((f, r) => gt.add(`${el}_${f}`, 0, c * 16, r * 14, 16, 14)));
        const W = this.scale.width, H = this.scale.height;
        const SPACING = 58, R = 15;
        const x0 = W / 2 - SPACING * 1.5, y = H - 36;
        this._ultGemGfx = this.add.graphics().setScrollFactor(0).setDepth(31);
        this._ultGemFx = this.add.graphics().setScrollFactor(0).setDepth(31.45); this._vfxSort?.(this._ultGemFx);   // (what's drawn over the held gem when it's full: HUD drawUltGems)
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
            const gem = (f, d) => { const o = this.add.image(x, y, 'ui_ultgem', `${el}_${f}`).setScrollFactor(0).setDepth(d).setScale(2); this._vfxSort?.(o); return o; };
            const glow = this.add.image(x, y, 'vfx_glow').setScrollFactor(0).setDepth(31.1).setBlendMode(Phaser.BlendModes.ADD).setTint(C.COLORS[el]).setVisible(false);
            this._vfxSort?.(glow);
            return { el, x, y, r: R, key, react, glow, dark: gem('dark', 31.2), lit: gem('lit', 31.3) };
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

    // The level is yours. The rewards first: a card for each (glorps, fragments, every achievement
    // earned in the level) popping in turn, its number counting up, then its glorps and fragments
    // flying up into the purse in the corner, which ticks up as each one lands. Under them, which
    // elements did the work (damage dealt) and which you fought in (combat time), with the weapon
    // each was, and the element that carried the run. A click or Enter goes back to the map.
    _showWinScreen() {
        Sfx.hush(this);   // the fight's sounds end here
        const R = this._runStats || { dmg: {}, elTime: {}, t0: this.time.now, kills: 0 };
        const W = this.scale.width, H = this.scale.height, D = 600, P = UIKit.PALETTE, objs = [];
        const keep = o => { objs.push(o); o.setScrollFactor?.(0); return o; };
        const COL = { ...this._ultCfg().COLORS, other: 0xc8c0b0 }, NAME = { fire: 'FIRE', ice: 'ICE', lightning: 'LIGHTNING', cosmic: 'COSMIC', other: 'OTHER' };
        const fmt = ms => { const s = Math.round(ms / 1000); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; };
        const num = n => Math.round(n).toLocaleString('en-US');
        this._runClock?.setVisible(false);
        keep(this.add.rectangle(W / 2, H / 2, W, H, 0x05040a, 1).setDepth(D));
        // embers in the colours of what you fought with
        const used = ['fire', 'ice', 'lightning', 'cosmic'].filter(k => (R.dmg[k] || 0) > 0);
        if (this.textures.exists('mn_px2')) keep(this.add.particles(0, 0, 'mn_px2', {
            x: { min: 0, max: W }, y: H + 6, lifespan: 5000, speedY: { min: -60, max: -25 }, speedX: { min: -8, max: 8 },
            scale: { start: 1.5, end: 0 }, alpha: { start: 0.7, end: 0 }, tint: used.length ? used.map(k => COL[k]) : [P.accentGold],
            blendMode: 'ADD', frequency: 50 }).setDepth(D + 1));
        const T = (x, y, s, o = {}) => keep(this.add.text(x, y, s, Object.assign({ fontSize: '14px', fontFamily: 'monospace', color: UIKit.CSS.textMid }, o)).setDepth(D + 4));
        const title = T(W / 2, 46, 'L E V E L   C L E A R E D', { fontSize: '38px', fontFamily: UIKit.FONT.title, fontStyle: 'bold', color: '#ffe08a', stroke: '#000', strokeThickness: 6, padding: { x: 24, y: 24 } }).setOrigin(0.5).setAlpha(0).setScale(1.3);
        title.setShadow(0, 0, '#f0b84a', 16, true, true);
        this.tweens.add({ targets: title, alpha: 1, scale: 1, duration: 420, ease: 'Back.easeOut', onStart: () => Sfx.play(this, 'fanfare') });
        const NAMES = { 0: 'Tutorial', 1: 'Tutorial', 2: 'The Gauntlet', 3: 'The Void Rift', 4: 'The Fracture', 5: 'The Cistern' };
        T(W / 2, 84, `${(NAMES[this.currentLevelIndex] || 'The Dungeon').toUpperCase()}   ·   ${fmt((R.tEnd || this.time.now) - R.t0)}   ·   ${R.kills || 0} SLAIN`, { fontSize: '13px', fontStyle: 'bold', color: UIKit.CSS.textMid }).setOrigin(0.5);

        // ── what you take home ──
        const lvl = Progress.BY_LEVEL_INDEX[this.currentLevelIndex], achs = this._achThisLevel || [];
        const earned = Math.max(0, (this.totalGlorps || 0) - (R.glorps0 ?? (this.totalGlorps || 0)));
        const firstGl = this._firstClear ? (Progress.FIRST_CLEAR_GLORPS[lvl] || 0) : 0;
        const achGl = achs.reduce((a, x) => a + (x.reward?.glorps || 0), 0);
        const frags = this._fragsThisLevel || 0;
        // the purse, top right: what you had, rising to what you have as the pieces land
        const purse = {}, PY = 22;
        [['glorp', Math.max(0, (this.totalGlorps || 0) - earned), P.accentGold], ['fragment', Math.max(0, Progress.fragments() - frags), 0x6cb4f0]].forEach(([k, start, col], i) => {
            const y = PY + i * 34, ic = UIKit.currencyIcon(this, k);
            const t = T(W - 24, y, num(start), { fontSize: '18px', fontFamily: UIKit.FONT.title, fontStyle: 'bold', color: UIKit._hex(col), stroke: '#000', strokeThickness: 4 }).setOrigin(1, 0.5);
            const icon = ic ? keep(this.add.image(0, y, ic[0], ic[1]).setScale(ic[2]).setDepth(D + 4)) : null;
            const place = () => icon?.setX(t.x - t.width - 16);
            place();
            purse[k] = { v: start, t, icon, place, x: W - 40, y };
        });
        const addPurse = (k, n) => {
            const p = purse[k]; p.v += n; p.t.setText(num(p.v)); p.place();
            this.tweens.killTweensOf(p.t); p.t.setScale(1.25); this.tweens.add({ targets: p.t, scale: 1, duration: 160, ease: 'Quad.easeOut' });
            if (p.icon) { this.tweens.killTweensOf(p.icon); const s = UIKit.currencyIcon(this, k)[2]; p.icon.setScale(s * 1.4); this.tweens.add({ targets: p.icon, scale: s, duration: 160 }); }
        };
        // the cards: glorps, fragments, then each achievement (dust and books written on its card)
        const cards = [];
        if (earned > 0) cards.push({ k: 'glorp', label: 'GLORPS', v: earned, col: P.accentGold,
            notes: [earned - firstGl - achGl > 0 && `drops  +${num(earned - firstGl - achGl)}`, firstGl && `first clear  +${num(firstGl)}`, achGl && `achievements  +${num(achGl)}`].filter(Boolean), ribbon: firstGl ? 'FIRST CLEAR' : null });
        if (frags > 0) cards.push({ k: 'fragment', label: 'FRAGMENTS', v: frags, col: 0x6cb4f0, notes: ['spent on ult stages'] });
        for (const a of achs.slice(0, 3)) cards.push({ k: 'ach', label: 'ACHIEVEMENT', name: a.name, col: Achievements.TIER_COL[a.tier] || P.accentGold, notes: [Achievements.rewardText(a)] });
        if (achs.length > 3) cards[cards.length - 1].notes.push(`and ${achs.length - 3} more`);
        if (!cards.length) cards.push({ k: 'none', label: 'NO REWARDS', col: 0x6e6758, notes: ['this one was for the glory'] });
        const cw = 196, ch = 176, cg = 18, GAP = 760, cx0 = W / 2 - (cards.length * cw + (cards.length - 1) * cg) / 2, cy = 112;
        cards.forEach((c, i) => {
            const x = cx0 + i * (cw + cg), at = 450 + i * GAP, mid = x + cw / 2;
            const box = keep(this.add.container(mid, cy + ch / 2).setDepth(D + 3).setScale(0.5).setAlpha(0));
            const g = this.add.graphics();
            g.fillStyle(0x000000, 0.45).fillRoundedRect(-cw / 2 + 2, -ch / 2 + 3, cw, ch, 10);
            g.fillStyle(0x0d0a14, 0.96).fillRoundedRect(-cw / 2, -ch / 2, cw, ch, 10);
            g.fillStyle(c.col, 0.12).fillRoundedRect(-cw / 2, -ch / 2, cw, 30, { tl: 10, tr: 10, bl: 0, br: 0 });
            g.lineStyle(2, c.col, 0.9).strokeRoundedRect(-cw / 2, -ch / 2, cw, ch, 10);
            const glow = this.add.image(0, -14, 'vfx_glow').setTint(c.col).setBlendMode(Phaser.BlendModes.ADD).setAlpha(0.35).setScale(1.3);
            const lab = this.add.text(0, -ch / 2 + 15, c.label, { fontSize: '11px', fontFamily: 'monospace', fontStyle: 'bold', color: UIKit._hex(c.col) }).setOrigin(0.5);
            const parts = [g, glow, lab];
            const ic = c.k === 'glorp' || c.k === 'fragment' ? UIKit.currencyIcon(this, c.k) : null;
            let icon = null, val = null;
            if (ic) icon = this.add.image(0, -18, ic[0], ic[1]).setScale(ic[2] * 1.6);
            else icon = this.add.text(0, -18, c.k === 'ach' ? '★' : '-', { fontSize: '30px', color: UIKit._hex(c.col) }).setOrigin(0.5);
            parts.push(icon);
            if (c.v != null) { val = this.add.text(0, 18, '+0', { fontSize: '26px', fontFamily: UIKit.FONT.title, fontStyle: 'bold', color: '#f8f0dc', stroke: '#000', strokeThickness: 4 }).setOrigin(0.5); parts.push(val); }
            else if (c.name) parts.push(this.add.text(0, 16, c.name.toUpperCase(), { fontSize: '14px', fontFamily: UIKit.FONT.title, fontStyle: 'bold', color: '#f8f0dc', align: 'center', wordWrap: { width: cw - 20 } }).setOrigin(0.5));
            (c.notes || []).forEach((n, j) => parts.push(this.add.text(0, 42 + j * 14, n, { fontSize: '10px', fontFamily: 'monospace', color: c.k === 'ach' ? '#9be08a' : '#a89c84', align: 'center', wordWrap: { width: cw - 16 } }).setOrigin(0.5, 0)));
            box.add(parts);
            if (c.ribbon) {   // a ribbon across the corner
                const rb = this.add.text(cw / 2 - 8, -ch / 2 - 6, c.ribbon, { fontSize: '10px', fontFamily: 'monospace', fontStyle: 'bold', color: '#1a120c', backgroundColor: '#ffd34a', padding: { x: 6, y: 3 } }).setOrigin(1, 0.5).setAngle(4);
                box.add(rb);
            }
            this.tweens.add({ targets: box, scale: 1, alpha: 1, duration: 340, delay: at, ease: 'Back.easeOut', onStart: () => Sfx.play(this, 'pop') });
            this.tweens.add({ targets: icon, y: icon.y - 6, duration: 520, delay: at + 340, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
            this.tweens.add({ targets: glow, alpha: 0.6, scale: 1.6, duration: 900, delay: at, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
            if (c.k === 'ach') { this.time.delayedCall(at, () => { if (box.active) VisualFX.ripple?.(this, mid, cy + ch / 2, 20, cw * 0.7, c.col, { depth: D + 2, duration: 600, alpha: 0.6 }); }); return; }
            if (!val) return;
            // the count, then the flight: pieces from the card to the purse, each adding its share on landing
            const cnt = { n: 0 }, cdur = Math.min(1000, 350 + c.v * 1.5);
            this.tweens.add({ targets: cnt, n: c.v, duration: cdur, delay: at + 260, ease: 'Cubic.easeOut',
                onUpdate: () => { const s = '+' + num(cnt.n); if (val.text !== s) { val.setText(s); if (this.time.now - (this._winTickAt || 0) > 45) { this._winTickAt = this.time.now; Sfx.play(this, 'e_tick'); } } },
                onComplete: () => { val.setText('+' + num(c.v)); val.setScale(1.3); this.tweens.add({ targets: val, scale: 1, duration: 200, ease: 'Back.easeOut' }); } });
            const pieces = Math.max(1, Math.min(16, Math.ceil(c.v / (c.k === 'glorp' ? 25 : 1)))), share = c.v / pieces, p = purse[c.k];
            let given = 0, landed = 0;
            for (let q = 0; q < pieces; q++) this.time.delayedCall(at + 260 + cdur + 120 + q * 45, () => {
                if (!p.t.active) return;
                const sp = keep(this.add.image(mid + (Math.random() - 0.5) * 50, cy + ch / 2 - 18 + (Math.random() - 0.5) * 30, ic[0], ic[1]).setScale(ic[2] * 1.2).setDepth(D + 6));
                const o = { t: 0 }, x0 = sp.x, y0 = sp.y, bend = (Math.random() - 0.3) * 220;
                this.tweens.add({ targets: o, t: 1, duration: 520 + Math.random() * 160, ease: 'Cubic.easeIn',
                    onUpdate: () => { const u = o.t; sp.setPosition(x0 + (p.x - x0) * u + Math.sin(u * Math.PI) * bend * 0.4, y0 + (p.y - y0) * u - Math.sin(u * Math.PI) * 60); sp.setScale(ic[2] * (1.2 - 0.5 * u)); },
                    onComplete: () => {
                        sp.destroy();
                        const n = ++landed === pieces ? c.v - given : Math.round(share * landed) - given;   // by landing order: they don't arrive in the order they left
                        given += n; addPurse(c.k, n);
                        Sfx.play(this, c.k === 'glorp' ? 'coin' : 'pickup');
                        const fl = keep(this.add.image(p.x, p.y, 'vfx_glow').setTint(c.col).setBlendMode(Phaser.BlendModes.ADD).setDepth(D + 5).setScale(0.6).setAlpha(0.8));
                        this.tweens.add({ targets: fl, scale: 1.4, alpha: 0, duration: 260, onComplete: () => fl.destroy() });
                    } });
            });
        });
        const rewardsDone = 450 + cards.length * GAP + 900;
        const nRows = Math.max(1, ...[R.dmg, R.elTime].map(d => Math.min(5, Object.values(d).filter(v => v > 0).length))), chH = 62 + nRows * 34;

        // ── the two charts: rows sorted biggest first, a bar each (and the weapon that was), filling in turn ──
        const chart = (x, title, data, valueOf, delay0) => {
            const w = 470, h = chH, y = cy + ch + 26;
            objs.push(...UIKit.panel(this, { x, y, w, h, accent: P.accentBlue, depth: D + 2, title, titleSize: '14px' }).objs);
            const total = Object.values(data).reduce((a, b) => a + b, 0);
            const rows = Object.entries(data).filter(([, v]) => v > 0).sort((a, b) => b[1] - a[1]);
            if (!rows.length) { T(x + w / 2, y + h / 2, 'nothing recorded', { color: UIKit.CSS.textLo }).setOrigin(0.5); return; }
            const top = rows[0][1], g = keep(this.add.graphics().setDepth(D + 3));
            rows.slice(0, 5).forEach(([k, v], i) => {
                const ry = y + 56 + i * 34, bx = x + 150, bw = w - 270;
                const key = k !== 'other' && MenuArt.iconSheet(this, this.equippedWeapons?.[k]);
                const dot = key ? keep(this.add.image(x + 26, ry, key, '0').setScale(1.2).setDepth(D + 4)) : keep(this.add.circle(x + 26, ry, 6, COL[k]).setDepth(D + 4));
                T(x + 46, ry, NAME[k], { fontSize: '12px', fontStyle: 'bold', color: UIKit._hex(COL[k]) }).setOrigin(0, 0.5);
                g.fillStyle(0x141826, 1).fillRect(bx, ry - 7, bw, 14);
                const bar = keep(this.add.rectangle(bx, ry, bw * v / top, 14, COL[k], 1).setOrigin(0, 0.5).setDepth(D + 4).setScale(0, 1));
                this.tweens.add({ targets: bar, scaleX: 1, duration: 520, delay: delay0 + i * 140, ease: 'Cubic.easeOut', onStart: () => Sfx.play(this, 'hover') });
                T(x + w - 20, ry, `${valueOf(v)}  ${Math.round(v / total * 100)}%`, { fontSize: '12px', fontStyle: 'bold', color: UIKit.CSS.textHi }).setOrigin(1, 0.5);
                const s = dot.scale; dot.setScale(0); this.tweens.add({ targets: dot, scale: s, duration: 200, delay: delay0 + i * 140 });
            });
        };
        const dmg = Object.fromEntries(Object.entries(R.dmg).map(([k, v]) => [k, Math.round(v)]));
        chart(W / 2 - 490, 'DAMAGE BY ELEMENT', dmg, v => v.toLocaleString(), rewardsDone - 400);
        chart(W / 2 + 20, 'TIME IN COMBAT', R.elTime, fmt, rewardsDone);

        // the element that carried it, and the weapon it was
        const best = Object.entries(R.dmg).filter(([k]) => k !== 'other').sort((a, b) => b[1] - a[1])[0];
        if (best && best[1] > 0) {
            const wn = (typeof ShopScene !== 'undefined' && ShopScene.CATALOGUE.find(x => x.id === this.equippedWeapons?.[best[0]])?.name) || '';
            const b = T(W / 2, cy + ch + 26 + chH + 34, `${NAME[best[0]]} CARRIED THIS RUN${wn ? '  ·  ' + wn.toUpperCase() : ''}`, { fontSize: '20px', fontFamily: UIKit.FONT.title, fontStyle: 'bold', color: UIKit._hex(COL[best[0]]), stroke: '#000', strokeThickness: 5, padding: { x: 20, y: 20 } })
                .setOrigin(0.5).setAlpha(0).setScale(0.6);
            b.setShadow(0, 0, UIKit._hex(COL[best[0]]), 14, true, true);
            this.tweens.add({ targets: b, alpha: 1, scale: 1, duration: 360, delay: rewardsDone + 700, ease: 'Back.easeOut', onStart: () => Sfx.play(this, 'fanfare') });
        }
        const cont = T(W / 2, H - 24, 'click or press Enter to continue', { fontSize: '13px', color: UIKit.CSS.textLo }).setOrigin(0.5).setAlpha(0);
        this.tweens.add({ targets: cont, alpha: 1, duration: 400, delay: rewardsDone + 900, onComplete: () => this.tweens.add({ targets: cont, alpha: 0.35, duration: 700, yoyo: true, repeat: -1 }) });

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
            if (want === 'boss' && Date.now() - (this._introRoarAt || 0) > 6000) Sfx.play(this, 'roar', { big: true });   // (not again straight after its intro's)
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
        g.clear(); this._ultGemFx?.clear();
        for (const u of this._ultGemUI) {
            const col = this._elStolen?.[u.el] ? 0x5a5a64 : C.COLORS[u.el];   // a Leech has it: grey, and the Leech sits on it (LevelManager._leechHud)
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
            // cosmic from ult stage 2: a ring a layer round it, each its own colour and further out (its own charge, the second, the
            // third: amethyst, gold, white), so how many are charged reads at a glance; a full one bright and breathing
            if (u.el === 'cosmic' && this._cs && (this._csStage?.() || 1) >= 2) {
                const L = this._csMaxLayers?.() || 2, layers = [fill, Math.min(1, this._cs.layer2 || 0), Math.min(1, this._cs.layer3 || 0)], RC = [col, 0xffd060, 0xe8f6ff];
                for (let k = 0; k < L; k++) {
                    const rr = r + 10 + k * 5, f = layers[k], done = f >= 1, br = done ? 0.75 + 0.25 * Math.sin(now / 240 + k) : 0.85;
                    g.lineStyle(3, RC[k], 0.16); g.strokeCircle(x, y, rr);   // its track
                    if (f > 0) { g.lineStyle(done ? 3.5 : 3, RC[k], br); g.beginPath(); g.arc(x, y, rr, TOP, TOP + f * TAU, false); g.strokePath(); }
                }
            }
            const cosmicRings = u.el === 'cosmic' && this._cs && (this._csStage?.() || 1) >= 2;
            // Overflow: charge banked past full, a gold arc round the gem (a whole one: +50% on the next ult)
            const ovf = full && !cosmicRings ? Math.min(1, (this._overflow?.[u.el] || 0) / this.ultChargeMax) : 0;   // (cosmic's rings are there instead)
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
                u.react.setAlpha(show ? Math.min(1, (700 - reactT) / 250) : 0).setY(y - r - (u.el === "cosmic" ? 30 : 14) - (show ? 6 * Math.min(1, reactT / 200) : 0))
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
            // the gem: dark, lit a row at a time from the bottom as it charges (white for a moment as charge flies in); filling, it pops
            // and bursts. Full, it beats (all of them in step) and glows with it; the one you hold beats harder, shivers, flashes at the
            // top of each beat and sends a ring out, with a touch of its own (fire's embers, ice's frost, lightning crackling, cosmic's
            // stars going round it). Stolen: dark and grey. Locked out: dimmed
            const stolen = !!this._elStolen?.[u.el], gy = by + (y - by) * u.k, hot = full && held && !stolen;
            if (hot && u.el === 'lightning' && now >= (u.zapNext || 0)) { u.zapUntil = now + 220; u.zapNext = now + 450 + Math.random() * 700; }
            const zap = hot && u.el === 'lightning' && now < (u.zapUntil || 0);
            const BEAT = 760, beat = full && !stolen ? 0.5 + 0.5 * Math.sin(now * TAU / BEAT) : 0, amp = hot ? 0.8 + 1.4 * beat + (zap ? 1.2 : 0) : 0;
            const jx = (Math.random() - 0.5) * 2 * amp, jy = (Math.random() - 0.5) * 1.4 * amp;   // (the shiver: hardest at the top of a beat)
            const sc = 2 * u.k * (1 + 0.3 * Math.max(0, 1 - pingT / 240)) * (1 + (hot ? 0.16 : 0.05) * beat), rows = stolen ? 0 : Math.round(14 * fill), dim = lockFrac > 0 ? 0x6a6a78 : 0xffffff;
            const shine = (hot && beat > 0.9) || (full && !hot && (now + u.x * 7) % 1700 < 150) || now < (this._ultFlashUntil?.[u.el] || 0) || (zap && Math.random() < 0.5);   // (the top of each beat; a glint now and then; as charge flies in; flickering as lightning crackles)
            u.dark.setPosition(x + jx, gy + jy).setScale(sc).setTint(stolen ? 0x8a8a94 : dim);
            u.lit.setFrame(`${u.el}_${shine ? 'shine' : 'lit'}`).setPosition(x + jx, gy + jy).setScale(sc).setVisible(rows > 0).setCrop(0, 14 - rows, 16, rows).setTint(dim);
            const glowA = hot ? 0.3 + 0.5 * beat + (zap ? 0.2 : 0) + (u.el === 'fire' ? 0.15 * Math.random() : 0) : full && !stolen ? 0.12 + 0.12 * beat : 0;
            u.glow.setVisible(glowA > 0).setPosition(x, gy).setScale((0.4 + (hot ? 0.18 : 0.06) * beat) * u.k).setAlpha(Math.min(1, glowA));
            const mote = (x0, y0, size, c, dx, dy, ms) => {   // a pixel of it, off it and fading
                const o = this.add.rectangle(x0, y0, size, size, c).setScrollFactor(0).setDepth(31.4);
                this._vfxSort?.(o);
                this.tweens.add({ targets: o, x: x0 + dx, y: y0 + dy, alpha: { value: 0, ease: 'Cubic.easeIn' }, scale: { value: 0.4, ease: 'Cubic.easeIn' }, duration: ms, ease: 'Quad.easeOut', onComplete: () => o.destroy() });   // (bright most of the way, then gone)
            };
            if (pingT < 200 && u.burstFor !== this._ultReadyAt[u.el]) {   // filling: a burst of sparkles flung out round it
                u.burstFor = this._ultReadyAt[u.el];
                for (let i = 0; i < 12; i++) { const a = i / 12 * TAU, d = 18 + Math.random() * 8; mote(x, gy, 2, Math.random() < 0.5 ? 0xffffff : col, Math.cos(a) * d, Math.sin(a) * d, 420); }
            }
            if (hot && now >= (u.fxAt || 0)) {
                if (u.el === 'fire') {   // flames licking up off it, embers
                    u.fxAt = now + 30;
                    mote(x + (Math.random() - 0.5) * 20 * u.k, gy - 8 * u.k + Math.random() * 6, 2 + (Math.random() < 0.4), [0xffe08a, 0xffb040, 0xff6a20][Math.floor(Math.random() * 3)], (Math.random() - 0.5) * 8, -22 - Math.random() * 16, 420 + Math.random() * 260);
                } else if (u.el === 'ice') {   // frost drifting off it
                    u.fxAt = now + 70;
                    const a = Math.random() * TAU, rr = 22 * u.k;
                    mote(x + Math.cos(a) * rr, gy + Math.sin(a) * rr, 2, Math.random() < 0.5 ? 0xffffff : 0xbfeaff, Math.cos(a) * 12, Math.sin(a) * 8 + 6, 1000);
                } else if (zap) {   // sparks off it as it crackles
                    u.fxAt = now + 40;
                    const a = Math.random() * TAU;
                    mote(x + Math.cos(a) * 18 * u.k, gy + Math.sin(a) * 18 * u.k, 2, Math.random() < 0.5 ? 0xffffff : 0xfff2a0, Math.cos(a) * 16, Math.sin(a) * 16, 280);
                } else if (u.el === 'cosmic') {   // now and then a star drifting off
                    u.fxAt = now + 300;
                    mote(x + (Math.random() - 0.5) * 20 * u.k, gy + (Math.random() - 0.5) * 14 * u.k, 2, Math.random() < 0.5 ? 0xffd060 : 0xffffff, (Math.random() - 0.5) * 10, -10, 800);
                }
            }
            if (hot) {   // drawn round it every frame: a ring out from the rim each beat, lightning's arcs, cosmic's stars going round (behind it, then in front)
                const f = this._ultGemFx, t = ((now / BEAT - 0.25) % 1 + 1) % 1;   // (0 at the top of a beat)
                f.lineStyle(2, u.el === 'ice' ? 0xdff4ff : col, 0.85 * (1 - t)); f.strokeCircle(x, gy, (r + 6 + 16 * t) * u.k);
                if (zap) for (let n = 0; n < 2; n++) {
                    let a = Math.random() * TAU, px = x + Math.cos(a) * 7 * u.k, py = gy + Math.sin(a) * 6 * u.k;
                    f.lineStyle(1.5, Math.random() < 0.5 ? 0xffffff : 0xfff2a0, 0.95); f.beginPath(); f.moveTo(px, py);
                    for (let sgm = 0; sgm < 3; sgm++) { a += (Math.random() - 0.5) * 1.2; px += Math.cos(a) * 6; py += Math.sin(a) * 6; f.lineTo(px, py); }
                    f.strokePath();
                }
                if (u.el === 'cosmic') for (let n = 0; n < 3; n++) {
                    const a = now / 650 + n * TAU / 3, front = Math.sin(a) > 0, gfx = front ? f : g;   // (g is already scaled round the socket)
                    const sx = x + Math.cos(a) * 20 * (front ? u.k : 1), sy = (front ? gy : y) + Math.sin(a) * 8 * (front ? u.k : 1);
                    const tw = 0.6 + 0.4 * Math.sin(now / 120 + n * 2), c2 = n === 1 ? 0xffffff : 0xffd060;
                    gfx.fillStyle(c2, (front ? 1 : 0.45) * tw); gfx.fillRect(sx - 1, sy - 3, 2, 6); gfx.fillRect(sx - 3, sy - 1, 6, 2);   // a little four-point star
                }
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
        if (chargeFrac >= 1 && this._icicleSaid === false) Sfx.play(this, 'rready', { el: 'ice' });   // the Frost Shield charged
        this._icicleSaid = chargeFrac >= 1;

        // Create bar objects once
        if (!this._icicleBarBg?.active) {   // (dead after a floor change: the scene object outlives it)
            this._icicleBarBg       = this.add.graphics().setDepth(5.9);   // both meters: the charge, and the shield's time above it
            this._icicleBarLabel    = this.add.text(px, py + 6, 'FROST SHIELD', {
                fontSize: '8px', fontFamily: UIKit.FONT.title, fontStyle: 'bold', color: '#9fe8ff', stroke: '#05101a', strokeThickness: 3, resolution: 2
            }).setOrigin(0.5, 0).setDepth(6);
            this._icicleHealLabel   = this.add.text(px, py - 7 - 5, 'SHIELD UP', {
                fontSize: '8px', fontFamily: UIKit.FONT.title, fontStyle: 'bold', color: '#d8f6ff', stroke: '#05101a', strokeThickness: 3, resolution: 2
            }).setOrigin(0.5, 1).setDepth(6);
        }

        this._icicleBarLabel.x = px; this._icicleBarLabel.y = py + 6;
        this._icicleHealLabel.x = px; this._icicleHealLabel.y = py - 7 - 5;
        const g = this._icicleBarBg.clear(), now = this.time.now;
        UIKit.rBar(g, px - BAR_W / 2 + 4, py - BAR_H / 2, BAR_W - 4, chargeFrac, { col: 0x5ac8ff, hot: 0xd8f6ff, dark: 0x001122, time: now, h: BAR_H, segs: 4 });
        this._icicleBarLabel.setColor(chargeFrac >= 1 ? '#d8f6ff' : '#9fe8ff');
        this._icicleHealLabel.setVisible(healModeActive);
        if (healModeActive) {   // the shield's time left
            UIKit.rBar(g, px - BAR_W / 2 + 4, py - 7 - BAR_H / 2, BAR_W - 4, (this._frostShieldUntil - now) / 5000, { col: 0xbff4ff, hot: 0xffffff, dark: 0x001122, time: now, h: BAR_H, ready: false, gem: false });
            this._icicleHealLabel.setAlpha(0.7 + 0.3 * Math.sin(now / 200));
        }

        // Flash + "HEAL READY" popup when charge first fills
        if (chargeFrac >= 1 && !this._iciclePipsWereFull) {
            this._iciclePipsWereFull = true;
            if (this._icicleReadyText) this._icicleReadyText.destroy();
            const rtx = this.player.x, rty = this.player.y - 46;
            this._icicleReadyText = this.add.text(rtx, rty, `SHIELD READY · ${Settings.label(Settings.key('surge'))}`, {
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
        // a speech box (depth 1000) would sit over the menu: hidden till it closes
        this._pauseHid = (this._dialogueObjects || []).filter(o => o?.active && o.visible);
        this._pauseHid.forEach(o => o.setVisible(false));

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
        (this._pauseHid || []).forEach(o => o?.active && o.setVisible(true));
        this._pauseHid = null;
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
            (this._frozenTweens || []).forEach(t => { if (t?.paused && !t.isDestroyed?.() && !t.isPendingRemove?.()) t.resume(); });   // (one stopped meanwhile, a hop restarted, is gone: resuming it threw and stopped the game)
            this._frozenTweens = null;
            this.anims.resumeAll();
        }
    }

    // ─── DEATH SCREEN ─────────────────────────────────────────────────────────

    gameOver() {
        if (this._deathScreenActive) return;
        Telemetry.death(this); Telemetry.end(this, 'death');
        if (!this.towerRun && !this.trainingRun) Progress.lost(Progress.BY_LEVEL_INDEX[this.currentLevelIndex]);   // two in a row: the lobby suggests the Tower
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

        Sfx.hush(this);   // the fight's sounds end here
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
            { label: 'TRY AGAIN', accent: UIKit.PALETTE.accentRed, x: W / 2 - 125, action: () => { this.scene.start('Game', this.trainingRun ? { levelIndex: 98, training: true } : this.towerRun ? { levelIndex: 6, tower: TowerFloors.newRun() } : { levelIndex: this.currentLevelIndex, tutorialStage: this.tutorialStage, ...(this._floorPlan?.() && this.storyFloor > 1 ? { floor: this.storyFloor, carry: this._sceneData.carry, continueRun: true } : {}) }); } },
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
                Sfx.play(this, 'kill', { screen: true });
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
                Sfx.play(this, 'hit', { screen: true, el: 'lightning' });
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
                Sfx.play(this, 'kill', { screen: true });
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
                Sfx.play(this, 'kill', { screen: true });
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
                Sfx.play(this, 'kill', { screen: true });
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

    // ── BOSS BARS ────────────────────────────────────────────────────────────
    // A bar across the top for each boss you are fighting (two Queens, a Queen and a boss), stacked
    // one under the next: its name over it, a pale chunk that trails the fill down when it is hurt,
    // a line under it for what it is doing. `key` tells one from another; Bosses.js lists them every
    // frame and _bossBarsKeep(keys) lets the rest fade; _bossBarHide takes them all down.
    _bossBar(frac, name, col, sub = '', key = 'boss', slot = 0, ice = null) {
        const all = this._bossBarUIs ||= {};
        let B = all[key];
        if (!B?.g?.active) {
            const T = (size, style) => this.add.text(0, 0, '', { fontSize: size, fontFamily: UIKit.FONT.title, fontStyle: style, color: '#f3e3b8', stroke: '#07060a', strokeThickness: 4 })
                .setScrollFactor(0).setDepth(41).setAlpha(0);
            B = all[key] = { g: this.add.graphics().setScrollFactor(0).setDepth(40).setAlpha(0), title: T('18px', 'bold').setOrigin(0.5, 1),
                sub: T('13px', 'italic').setOrigin(0.5, 0).setColor('#cdbf9f'), trail: frac, hitAt: 0, a: 0, y: null };
            this.tweens.add({ targets: B, a: 1, duration: 500 });
        }
        frac = Math.max(0, Math.min(1, frac));
        const now = this.time.now;
        if (frac < (B.last ?? frac)) B.hitAt = now;
        B.last = frac;
        if (now - B.hitAt > 450) B.trail = Math.max(frac, B.trail - 0.0125);   // the trail catches up after a beat
        const W = this.scale.width, BW = Math.round(Math.min(620, W * 0.46)), BH = 18, x = Math.round(W / 2 - BW / 2);
        const want = 88 + slot * (sub ? 56 : 46);
        B.y = B.y == null ? want : B.y + (want - B.y) * 0.2;   // slides to its place when one above it goes
        const y = Math.round(B.y);
        const g = B.g; g.clear().setAlpha(B.a);
        g.fillStyle(0x000000, 0.45); g.fillRoundedRect(x - 6, y - 5, BW + 12, BH + 10, 5);
        g.fillStyle(0x1a1410, 1); g.fillRect(x, y, BW, BH);
        g.fillStyle(0xfff0d0, 0.8); g.fillRect(x, y, BW * B.trail, BH);
        g.fillStyle(col, 1); g.fillRect(x, y, BW * frac, BH);
        if (ice?.decay > 0) { g.fillStyle(0x9ae8ff, 0.85); g.fillRect(x + BW * frac, y, Math.min(BW * (1 - frac), BW * ice.decay), BH); }   // the health its cube's decay took, growing back
        g.fillStyle(0xffffff, 0.22); g.fillRect(x, y, BW * frac, 3);                    // a lit top edge
        g.fillStyle(0x000000, 0.25); g.fillRect(x, y + BH - 3, BW * frac, 3);
        g.fillStyle(0x07060a, 0.7); for (const f of [0.25, 0.5, 0.75]) g.fillRect(x + BW * f - 1, y, 2, BH);   // quarter notches
        g.lineStyle(2, 0x8a7a5e, 1); g.strokeRect(x - 1, y - 1, BW + 2, BH + 2);
        const th = BH / 2 + 2, tw = Math.round(th * 0.9);   // the end points, as tall as the bar and its rim
        g.fillStyle(0xc9b48a, 1); for (const ex of [x - 4, x + BW + 4]) { g.fillTriangle(ex, y + BH / 2 - th, ex + (ex < W / 2 ? -tw : tw), y + BH / 2, ex, y + BH / 2 + th); }
        const chilled = ice?.chill > 0.005;
        if (chilled) {   // its chill, a frost strip under the bar (white while it's cubed)
            g.fillStyle(0x001222, 0.8); g.fillRect(x - 1, y + BH + 3, BW + 2, 6);
            g.fillStyle(0x11334d, 1); g.fillRect(x, y + BH + 4, BW, 4);
            g.fillStyle(ice.cubed ? 0xeafaff : 0x8ae8ff, 1); g.fillRect(x, y + BH + 4, BW * ice.chill, 4);
        }
        B.title.setText(name).setPosition(W / 2, y - 6).setAlpha(B.a);
        B.sub.setText(sub).setPosition(W / 2, y + BH + (chilled ? 12 : 6)).setAlpha(B.a * 0.9);
    }
    // Every bar not in `keys` fades out
    _bossBarsKeep(keys) {
        for (const k of Object.keys(this._bossBarUIs || {})) if (!keys.includes(k)) this._bossBarHide(k);
    }
    _bossBarHide(key) {
        const all = this._bossBarUIs || {};
        for (const k of key ? [key] : Object.keys(all)) {
            const B = all[k];
            delete all[k];
            if (!B) continue;
            const objs = [B.g, B.title, B.sub].filter(o => o?.active);
            this.tweens.add({ targets: objs, alpha: 0, duration: 600, delay: 300, onComplete: () => objs.forEach(o => o.destroy()) });
        }
    }

    // ── BOSS INTRO ───────────────────────────────────────────────────────────
    // The first time you're in a boss's room (Bosses._bfxBossBar): the fight holds (the pause's freeze, bodies still
    // breathing), black bars slide in and the camera swoops in close on it. A sleeping Voltslime wakes first (_voltWake).
    // It roars, its name slams in along the bottom, its bar fills slowly from nothing, then the camera swings, still close,
    // to you, goggle-eyed with fright, and pulls back out. A click, Enter or Esc skips it. Queens: only the first of a run.
    // Returns whether it began.
    _bossIntro(key, name, col, bx, by) {
        const base = key.replace(/\d+$/, ''), seen = this._bossIntroSeen ||= {};
        if (seen[base] || this._bossIntroState) return false;
        seen[base] = true;
        const TITLES = { volt: 'the storm that walks', sovereign: 'ruler of the dark between stars', core: 'the stone that remembers fire', queen: 'mother of the brood', tide: 'queen of the sea kingdom' };
        const cam = this.cameras.main, W = this.scale.width, H = this.scale.height, css = '#' + col.toString(16).padStart(6, '0');
        this._bossIntroOn = true; this._pauseMenuOpen = true; this._freezeClock(true); this.anims.resumeAll();
        for (const f of this._fog || []) if (f.lifted && f.c?.active) { f.c.destroy(); if (f.tkey && this.textures.exists(f.tkey)) this.textures.remove(f.tkey); }   // (a room's fog still rolling away: gone at once, not held half-lifted over you by the freeze)
        const hid = (this._dialogueObjects || []).filter(o => o?.active && o.visible); hid.forEach(o => o.setVisible(false));   // a speech box would sit over it
        const objs = [], tw = [], LB = 76;
        const add = o => { objs.push(o); return o.setScrollFactor(0); };
        const top = add(this.add.rectangle(0, -LB, W, LB, 0x000000, 1).setOrigin(0).setDepth(60));
        const btm = add(this.add.rectangle(0, H, W, LB, 0x000000, 1).setOrigin(0).setDepth(60));
        tw.push(this.tweens.add({ targets: top, y: 0, duration: 320, ease: 'Quad.easeOut' }), this.tweens.add({ targets: btm, y: H - LB, duration: 320, ease: 'Quad.easeOut' }));
        const z0 = cam.zoom;
        cam.stopFollow(); cam.pan(bx, by, 900, 'Sine.easeInOut', true); cam.zoomTo(z0 * 1.6, 900, 'Cubic.easeInOut', true);
        Sfx.play(this, 'cine_open'); if (typeof Music !== 'undefined') Music.play(this, null);   // the level's music drops away; the fight's comes in after
        const at = (ms, fn) => tw.push(this.tweens.addCounter({ from: 0, to: 1, duration: ms, onComplete: fn }));
        const S = this._bossIntroState = { objs, tw, z0, key, name, col, hid, wake: null };
        S.lit = () => this._vfxUpdateLight?.(this.time.now);   // the room's lights keep up with the camera while the rest stands still (or a close-up sits in the dark)
        this.events.on('postupdate', S.lit);
        let t = 950;
        const vb = this.voltslimeBoss;
        if (base === 'volt' && vb?._asleep) t = this._voltWake(vb, t, at, S);
        at(t, () => {   // its roar
            Sfx.play(this, 'roar', { big: true }); this._introRoarAt = Date.now();
            cam.shake(380, 0.008); this._vfxFlash?.(bx, by, 140, col, 320, 0.85);
        });
        t += 250;
        at(t, () => {   // its name, slammed in big along the bottom (clear of it), the world tipping with the blow
            const y0 = H - LB - 74;
            const box = add(this.add.container(W / 2, y0).setDepth(61).setScale(3).setAngle(-14).setAlpha(0));
            const tag = this.add.text(0, -50, 'B  O  S  S', { fontSize: '13px', fontFamily: 'monospace', fontStyle: 'bold', color: css, stroke: '#000', strokeThickness: 3 }).setOrigin(0.5);
            const nm = this.add.text(0, -8, name, { fontSize: '58px', fontFamily: UIKit.FONT.title, fontStyle: 'bold', color: '#f3e3b8', stroke: '#07060a', strokeThickness: 11, padding: { x: 20, y: 20 } }).setOrigin(0.5);
            nm.setShadow(0, 0, css, 18, true, true);
            const ep = this.add.text(0, 40, TITLES[base] || '', { fontSize: '18px', fontFamily: UIKit.FONT.title, fontStyle: 'italic', color: css, stroke: '#05060a', strokeThickness: 5 }).setOrigin(0.5);
            box.add([tag, nm, ep]);
            S.card = box;
            tw.push(this.tweens.add({ targets: box, scale: 1, angle: -4, alpha: 1, duration: 210, ease: 'Back.easeOut', onComplete: () => { Sfx.play(this, 'stinger'); cam.shake(200, 0.008); } }));
            tw.push(this.tweens.add({ targets: cam, rotation: -0.06, duration: 210, ease: 'Back.easeOut' }));   // (back level as it ends)
        });
        t += 500;
        const FILL = 2600;
        at(t, () => {   // its bar fills, slowly, a beat at every quarter
            Sfx.play(this, 'bossbar', { ms: FILL });
            let q = 0;
            tw.push(this.tweens.addCounter({ from: 0, to: 1, duration: FILL, ease: 'Sine.easeInOut',
                onUpdate: c => {
                    const v = c.getValue();
                    this._bossBar(v, name, col, '', key, 0.6);   // (a little low: its name clear of the black bar; it slides up after)
                    if (v >= (q + 1) / 4 && q < 3) { q++; Sfx.play(this, 'click'); cam.shake(70, 0.002); }
                },
                onComplete: () => {
                    Sfx.play(this, 'stinger', { big: true });
                    const B = this._bossBarUIs?.[key], BW = Math.round(Math.min(620, W * 0.46));
                    if (B) { const fl = add(this.add.rectangle(W / 2, B.y + 9, BW + 14, 30, 0xffffff, 0.9).setDepth(42)); tw.push(this.tweens.add({ targets: fl, alpha: 0, scaleY: 1.6, duration: 360 })); }
                } }));
        });
        t += FILL + 450;
        at(t, () => {   // and you, still close up, scared stiff
            if (S.card?.active) tw.push(this.tweens.add({ targets: S.card, alpha: 0, y: S.card.y + 30, duration: 300 }));
            if (!this.player) return;
            Sfx.play(this, 'whoosh');
            cam.pan(this.player.x, this.player.y, 650, 'Sine.easeInOut', true);
            at(650, () => {   // (relative: this one's set from inside a step)
                Sfx.play(this, 'gulp'); Sfx.play(this, 'dundun');
                this._scaredFace(this.player, 1300, true);
            });
        });
        t += 650 + 1300;
        at(t, () => this._bossIntroEnd());
        S.skip = () => this._bossIntroEnd();
        this.input.once('pointerdown', S.skip); this.input.keyboard?.once('keydown-ENTER', S.skip);
        return true;
    }
    // Its end (or a skip): a sleeping boss is awake whatever happened, the bars and words go, the camera pulls back out to
    // you, and the fight runs once it's there
    _bossIntroEnd() {
        const S = this._bossIntroState;
        if (!S || S.ending) return;
        S.ending = true;
        S.tw.forEach(t => { if (t?.isPlaying?.()) t.stop(); });   // (finished ones are gone already: stopping them throws)
        S.wake?.(true);
        this.events.off('postupdate', S.lit);
        this.input.off('pointerdown', S.skip); this.input.keyboard?.off('keydown-ENTER', S.skip);
        this._bossBar(1, S.name, S.col, '', S.key, 0.6);   // full: the fight's own reading takes it from here
        const cam = this.cameras.main, H = this.scale.height, [top, btm, ...rest] = S.objs;
        this.tweens.add({ targets: rest, alpha: 0, duration: 250 });
        this.tweens.add({ targets: top, y: -top.height, duration: 400, ease: 'Quad.easeIn' });
        this.tweens.add({ targets: btm, y: H, duration: 400, ease: 'Quad.easeIn' });
        if (this.player) cam.pan(this.player.x, this.player.y, 550, 'Sine.easeInOut', true);
        cam.zoomTo(S.z0, 600, 'Cubic.easeInOut', true);
        this.tweens.add({ targets: cam, rotation: 0, duration: 500, ease: 'Sine.easeInOut' });
        this.tweens.addCounter({ from: 0, to: 1, duration: 620, onComplete: () => {
            cam.setRotation(0);
            S.objs.forEach(o => o?.active && o.destroy());
            S.hid.forEach(o => o?.active && o.setVisible(true));
            if (this.player) cam.startFollow(this.player, true, 0.1, 0.1);
            this._bossIntroState = null; this._bossIntroOn = false; this._pauseMenuOpen = false; this._freezeClock(false);
            this._introRoarAt = Date.now();   // (the fight's music comes in now: no second roar with it)
        } });
    }
    // The Voltslime asleep (grey, its crown on the floor beside it, its speedy brood dozing round it) gets woken, rudely, by
    // three rocks: the first, "?!?", "?&", then "zzz", back to sleep; the second, crosser and a little red, "!#!?!", "!?$@", "zzz";
    // the third, a confused "?!", then fury (!#@% in bubbles, the mark, red and steaming), and it stomps awake: its brood jumps up
    // goggle-eyed, lightning strikes it from every side, it lights up and its crown hops back on. Scheduled from `t` on the
    // intro's clock; returns when it's done. S.wake(true) finishes it at once.
    _voltWake(b, t, at, S) {
        const cam = this.cameras.main, c = b.container, s = b.body, u = s?._cfx, p = this.player, A = HUD.introArt(this);
        const head = () => ({ x: c.x, y: c.y - 52 });
        const keep = o => { S.objs.push(o); return o; };
        const zzz = [], Z = () => zzz.push(this._bfxZzz?.(c.x + 16, c.y - 70, 22));
        for (let k = 0; k < 3; k++) at(t - 900 + k * 320, Z);
        at(t - 700, () => Sfx.play(this, 'snore'));
        // a rock: the camera to you, pick it up, lob it, the camera chasing it over, BONK (bigger each time). Returns the bonk's time
        const rock = (c0, n) => {
            let r = null;
            at(c0, () => { if (p) cam.pan(p.x, p.y, 450, 'Sine.easeInOut', true); });
            at(c0 + 500, () => {
                if (!p) return;
                this._vfxHop?.(p, Math.abs(p.scaleY || 1.2), 200);
                Sfx.play(this, 'pluck');
                r = keep(this.add.image(p.x + 12, p.y + 10, A.rock).setDepth((p.depth ?? 1) + 0.02).setScale(1.6));
                S.tw.push(this.tweens.add({ targets: r, x: p.x + 2, y: p.y - 26, duration: 260, ease: 'Quad.easeOut', delay: 80 }));
            });
            at(c0 + 700, () => {   // up to no good: sly eyes, a giggle in notes, a bounce or two (cheekier each rock)
                if (!p) return;
                const u0 = p._cfx, mood = u0?.mood;
                if (u0) u0.mood = 'sly';
                bubble(['♪', '♪~♪', '♪~♪~♪'][n - 1], 30, '#7a3aa8', 26, -26, 430, () => ({ x: p.x, y: p.y - 12 }), true);
                Sfx.play(this, 'giggle', { n });
                for (let k = 0; k < n + 1; k++) S.tw.push(this.tweens.addCounter({ from: 0, to: 1, duration: 10 + k * 130, onComplete: () => this._vfxHop?.(p, Math.abs(p.scaleY || 1.2), 110) }));
                S.tw.push(this.tweens.addCounter({ from: 0, to: 1, duration: 480, onComplete: () => { if (u0) u0.mood = mood; } }));
            });
            at(c0 + 1250, () => {
                if (!r?.active) return;
                Sfx.play(this, 'swing'); Sfx.play(this, 'whistle', { ms: 550 });
                this._vfxHop?.(p, Math.abs(p.scaleY || 1.2), 150);
                const x0 = r.x, y0 = r.y, h = head(), peak = Math.min(y0, h.y) - 80;
                S.tw.push(this.tweens.addCounter({ from: 0, to: 1, duration: 550, onUpdate: tw => {
                    const v = tw.getValue(), q = 1 - v;
                    r.setPosition(q * q * x0 + 2 * q * v * (x0 + h.x) / 2 + v * v * h.x, q * q * y0 + 2 * q * v * peak + v * v * h.y).setAngle(v * 720);
                } }));
                cam.pan(h.x, h.y + 30, 550, 'Sine.easeInOut', true);
            });
            at(c0 + 1800, () => {
                const h = head(), big = 0.6 + n * 0.3;
                Sfx.play(this, 'bonk', { n }); if (n >= 3) Sfx.play(this, 'block');
                cam.shake(100 + n * 60, 0.003 + n * 0.002);
                this._vfxHop?.(s, Math.abs(s?.scaleY || 4.5), 200);
                if (u) u.expr = 'wince';
                if (r?.active) S.tw.push(this.tweens.add({ targets: r, x: r.x - 40 - n * 6, y: r.y + 70, angle: r.angle - 300, duration: 520, ease: 'Quad.easeIn', onComplete: () => r.setAlpha(0.7) }));
                const bonk = keep(this.add.text(h.x - 30, h.y - 14, n < 3 ? 'bonk' : 'BONK!!', { fontSize: Math.round(18 + n * 6) + 'px', fontFamily: UIKit.FONT.title, fontStyle: 'bold', color: '#ffe14a', stroke: '#1a1008', strokeThickness: 5, resolution: 2 })
                    .setOrigin(0.5).setDepth(7).setScale(0.3).setAngle(-12));
                S.tw.push(this.tweens.add({ targets: bonk, scale: big + 0.25, duration: 140, ease: 'Back.easeOut', yoyo: true, hold: 120 }),
                    this.tweens.add({ targets: bonk, y: bonk.y - 22, alpha: 0, duration: 450, delay: 600 }));
                for (let k = 0; k < 3 + n * 2; k++) {   // stars round its head
                    const a = k / (3 + n * 2) * Math.PI * 2, st = keep(this.add.image(h.x, h.y, A.star).setDepth(7).setScale(1.2));
                    S.tw.push(this.tweens.add({ targets: st, x: h.x + Math.cos(a) * 30, y: h.y + Math.sin(a) * 16, angle: 180, alpha: 0, duration: 600, ease: 'Quad.easeOut' }));
                }
            });
            return c0 + 1800;
        };
        const bubble = (txt, size, col, dx, dy, ms, over = head, quiet = false) => {   // on the screen layer (the world's glow washed a white bubble out), over its head (or `over`'s)
            const h = over(), z = cam.zoom, wv = cam.worldView;
            const box = keep(this.add.container((h.x + dx - wv.x) * z, (h.y + dy - wv.y) * z).setScrollFactor(0).setDepth(61).setScale(0));
            const tx = this.add.text(0, 0, txt, { fontSize: size + 'px', fontFamily: UIKit.FONT.title, fontStyle: 'bold', color: col, stroke: '#ffffff', strokeThickness: 3 }).setOrigin(0.5);
            const w = tx.width + 36, hh = tx.height + 20, g = this.add.graphics();
            g.fillStyle(0xfffdf6, 1).fillRoundedRect(-w / 2, -hh / 2, w, hh, 16).fillTriangle(-w / 4, hh / 2 - 3, -w / 4 + 26, hh / 2 - 3, -w / 4 - 12, hh / 2 + 26);
            g.lineStyle(4, 0x1a1420, 1).strokeRoundedRect(-w / 2, -hh / 2, w, hh, 16);
            g.lineBetween(-w / 4, hh / 2, -w / 4 - 12, hh / 2 + 26).lineBetween(-w / 4 + 26, hh / 2, -w / 4 - 12, hh / 2 + 26);
            box.add([g, tx]);
            S.tw.push(this.tweens.add({ targets: box, scale: 1, duration: 200, ease: 'Back.easeOut' }),
                this.tweens.add({ targets: box, angle: { from: -4, to: 4 }, duration: 70, yoyo: true, repeat: Math.floor(ms / 140) }),
                this.tweens.add({ targets: box, alpha: 0, scale: 0.8, duration: 160, delay: ms }));
            if (!quiet) for (let k = 0; k < 4; k++) S.tw.push(this.tweens.addCounter({ from: 0, to: 1, duration: 60 + k * 90, onComplete: () => Sfx.play(this, 'blip', { v: 'glerp' }) }));   // muttering
        };
        const doze = () => { if (u) u.expr = 'blink'; Z(); Sfx.play(this, 'snore'); };
        // one: what?, a grumble, then (its own bubble) back to sleep
        const b1 = rock(t + 250, 1);
        at(b1 + 300, () => bubble('?!?', 34, '#1a1420', 36, -36, 450));
        at(b1 + 850, () => bubble('?&', 34, '#1a1420', 40, -38, 450));
        at(b1 + 1400, () => { doze(); bubble('zzz', 32, '#5a78b0', 34, -34, 500); });
        // two: crosser, already a little red, a grumble, then back to sleep again
        const b2 = rock(b1 + 2000, 2);
        at(b2 + 300, () => { bubble('!#!?!', 40, '#1a1420', 40, -40, 450); LevelManager.redden(s, 0.4); S.tw.push(this.tweens.add({ targets: c, x: c.x + 2, duration: 40, yoyo: true, repeat: 5 })); });
        at(b2 + 850, () => bubble('!?$@', 40, '#1a1420', 44, -42, 450));
        at(b2 + 1400, () => { doze(); bubble('zzz', 32, '#5a78b0', 34, -34, 500); });
        // three: what?! and then fury
        const b3 = rock(b2 + 2000, 3);
        at(b3 + 350, () => { if (u) u.expr = null; bubble('?!', 40, '#1a1420', 40, -40, 520); });
        at(b3 + 1000, () => {
            bubble('#@%&!', 48, '#d8202a', 50, -46, 700); Sfx.play(this, 'rage');
            const h = head(), mark = keep(this.add.image(h.x + 34, h.y + 2, A.anger).setDepth(6).setScale(3));
            S.mark = mark;
            S.tw.push(this.tweens.add({ targets: mark, scale: 3.8, duration: 150, yoyo: true, repeat: 4 }));
        });
        at(b3 + 1800, () => {   // furious: red, steaming, the mark swelling
            bubble('!!#@%*!!', 56, '#d8202a', 54, -50, 700);
            LevelManager.redden(s);
            if (S.mark?.active) S.tw.push(this.tweens.add({ targets: S.mark, scale: 5.2, duration: 120, yoyo: true, repeat: 4 }));
            S.tw.push(this.tweens.add({ targets: c, x: c.x + 4, duration: 35, yoyo: true, repeat: 12 }));
            for (let k = 0; k < 6; k++) S.tw.push(this.tweens.addCounter({ from: 0, to: 1, duration: 40 + k * 110, onComplete: () => {
                const h = head(), puff = keep(this.add.image(h.x + (k % 2 ? 26 : -26), h.y + 6, 'vfx_glow').setTint(0xf4f4ff).setScale(0.08).setAlpha(0.9).setDepth(6));
                S.tw.push(this.tweens.add({ targets: puff, y: puff.y - 30, scale: 0.22, alpha: 0, duration: 600 }));
            } }));
            Sfx.play(this, 'tell', { ms: 500 }); Sfx.play(this, 'steam'); Sfx.play(this, 'rage');
        });
        let woke = false;
        const wake = (instant) => {   // awake for real: lit up, crowned, its brood up and scared
            if (woke) return;
            woke = true;
            b._asleep = false;
            LevelManager.grey(s, false);
            if (s?.active) { s.clearTint(); if (!instant) { s.setTintFill(0xffffff); this.tweens.addCounter({ from: 0, to: 1, duration: 120, onComplete: () => s.active && s.clearTint() }); } }
            if (u) u.expr = null;
            if (b._bfx?.glow?.active) b._bfx.glow.setAlpha(0.6);
            const cr = b._floorCrown; b._floorCrown = null;
            const crownOn = () => { if (cr?.active) cr.destroy(); if (u) CreatureFX.dress(u, 'volt'); };
            if (instant || !cr?.active) crownOn();
            else { const h = head(); this.tweens.add({ targets: cr, x: h.x, y: h.y + 6, angle: 0, scale: cr.scale * 1.2, duration: 420, ease: 'Back.easeIn', onComplete: crownOn }); }
            for (const e of b._sleepers || []) {
                if (!e.sprite?.active) continue;
                e._asleep = false; e._moveCdMult = e._sleepHold; if (e.sprite._cfx) e.sprite._cfx.expr = null;
                LevelManager.grey(e.sprite, false); e.sprite.clearTint().setTint(0x44ffff);
                if (!instant) {
                    const y0 = e.sprite.y;
                    this.tweens.add({ targets: e.sprite, y: y0 - 16, duration: 170, yoyo: true, ease: 'Quad.easeOut', delay: Math.random() * 120 });
                    this._scaredFace(e.sprite, 1500);
                }
            }
            b._sleepers = null;
            for (const z of [...zzz, ...(this._zzzAll || [])]) if (z?.active) z.destroy();   // (the ones drifting when time stopped hung in the air)
        };
        S.wake = wake;
        at(b3 + 2700, () => {   // it smashes the ground
            this._vfxHop?.(s, Math.abs(s?.scaleY || 4.5), 300);
            Sfx.play(this, 'slam'); Sfx.play(this, 'boom', { big: true }); cam.shake(420, 0.012);
            BossFX.blast?.(this, c.x, c.y + 10, 90, 'volt');
            if (S.mark?.active) S.tw.push(this.tweens.add({ targets: S.mark, alpha: 0, duration: 300 }));
        });
        for (let k = 0; k < 10; k++) at(b3 + 3000 + k * 55, () => {   // lightning from every side
            const a = k / 10 * Math.PI * 2 + 0.3, h = head();
            this.drawLightningBolt({ sprite: { x: h.x + Math.cos(a) * 190, y: h.y + 10 + Math.sin(a) * 150 } }, { sprite: { x: h.x, y: h.y + 14 } });
        });
        at(b3 + 3000, () => { wake(false); Sfx.play(this, 'e_thunder'); Sfx.play(this, 'surge'); });
        return b3 + 3750;
    }
    // Goggle-eyed fright on a slime for `ms`: its own eyes hidden behind two wide white ones, pupils shivering, a bead of
    // sweat (`shake`: it trembles too). Timed on tweens, so it plays while the game stands still.
    _scaredFace(s, ms, shake = false) {
        if (!s?.active) return;
        const k = Math.abs(s.scaleY || 1.2), H = s.displayHeight || 32 * k, Wd = s.displayWidth || 32 * k;
        const img = this.add.image(s.x, s.y, HUD.introArt(this).scared).setOrigin(8.5 / 16, 9.5 / 16).setScale(k * 7 / 6).setDepth((s.depth ?? 1) + 0.01);
        if (s._cfx) s._cfx.hidden = true;
        const x0 = s.x;
        if (shake) this.tweens.add({ targets: s, x: x0 + 1.5, duration: 45, yoyo: true, repeat: Math.floor(ms / 90), onComplete: () => s.active && s.setX(x0) });
        this.tweens.addCounter({ from: 0, to: 1, duration: ms,
            onUpdate: () => { if (s.active) img.setPosition(s.x + (16.5 / 32 - (s.originX ?? 0.5)) * Wd + (Math.random() < 0.5 ? 0.6 : 0), s.y + (26 / 32 - (s.originY ?? 0.5)) * H); },   // on its face as it jumps, pupils shivering
            onComplete: () => { img.destroy(); if (s._cfx) s._cfx.hidden = false; } });
    }
    // The intro's bits of art: wide frightened eyes (and a sweat drop), an anger mark, a rock to throw and a star to see
    static introArt(scene) {
        const scared = ShopScene.icon(scene, 'fx_scared_eyes', 16, { W: '#ffffff', p: '#1a1420', s: '#8fd8ff' }, m => {
            m.disc(5.5, 9.5, 3.2, 'W'); m.disc(11.5, 9.5, 3.2, 'W');
            m.set(5, 9, 'p'); m.set(11, 9, 'p');
            m.set(14, 1, 's'); m.set(14, 2, 's'); m.rect(13, 3, 3, 2, 's');
        });
        const anger = ShopScene.icon(scene, 'fx_anger', 9, { r: '#ff3a3a', R: '#ff9a9a' }, m => {
            for (const [x, y] of [[1, 2], [2, 1], [2, 3], [3, 2], [5, 2], [6, 1], [6, 3], [7, 2], [1, 6], [2, 5], [2, 7], [3, 6], [5, 6], [6, 5], [6, 7], [7, 6]]) m.set(x, y, 'r');
            m.set(2, 2, 'R'); m.set(6, 6, 'R');
        });
        const rock = ShopScene.icon(scene, 'fx_rock', 9, { g: '#8a8478', G: '#b8b2a4', d: '#5a5448' }, m => {
            m.disc(4.5, 4.8, 3.4, 'g'); m.set(3, 3, 'G'); m.set(4, 3, 'G'); m.set(3, 4, 'G'); m.set(6, 6, 'd'); m.set(5, 7, 'd');
        });
        const star = ShopScene.icon(scene, 'fx_bonk_star', 7, { y: '#ffe14a', W: '#ffffff' }, m => {
            m.set(3, 1, 'y'); m.rect(2, 2, 3, 3, 'y'); m.set(1, 3, 'y'); m.set(5, 3, 'y'); m.set(3, 5, 'y'); m.set(3, 3, 'W');
        });
        return { scared, anger, rock, star };
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