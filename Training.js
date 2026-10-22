// ═══════════════════════════════════════════════════════════════════════
// TRAINING.JS — the Training Ground: a round arena off the world map where you spawn whatever you like,
// set how strong it is, and watch your damage. Static (no proxies): GameScene calls Training.* when
// started with { training: true } (WorldGen.generateWorld, LevelManager.applyFloorScaling/spawnEnemies,
// GameScene.create/update, HUD's label and restart).
// ═══════════════════════════════════════════════════════════════════════

class Training {
    static R = 11;   // the arena's radius in tiles
    // What the panel can spawn: [label, make(scene, x, y)]. Room 0 is the arena.
    static KINDS = [
        ['Slime',        (S, x, y) => S.createEnemy(x, y)],
        ['Ranged',       (S, x, y) => S.createRangedEnemy(x, y, 0)],
        ['Berserker',    (S, x, y) => S.createBerserker(x, y, 0)],
        ['Splitter',     (S, x, y) => S.createSplitter(x, y, 0)],
        ['Mortar',       (S, x, y) => S.createMortar(x, y, 0)],
        ['Rooter',       (S, x, y) => S.createRooter(x, y, 0)],
        ['Healer slime', (S, x, y) => S.createHealerTotem(x, y, 0)],
        ['Anchor',       (S, x, y) => S.createAnchorSlime(x, y, 0)],
        ['Sniper',       (S, x, y) => S.createUpgradedSniper(x, y, 0)],
        ['Void sniper',  (S, x, y) => S.createVoidSniper(x, y, 0)],
        ['Lightning el.',(S, x, y) => S.createLightningElemental(x, y, 0)],
        ['Singularity',  (S, x, y) => S.createSingularitySlime(x, y, 0)],
        ['Encased',      (S, x, y) => S.createEncasedSlime(x, y, 0)],
        ['Frost slime',  (S, x, y) => S.createFrostSlime(x, y, 0)],
        ['Budding slime',(S, x, y) => S.createBuddingSlime(x, y, 0)],
        ['Hunter slime', (S, x, y) => S.createHunterSlime(x, y, 0)],
        ['Armored slime',(S, x, y) => S.createArmoredSlime(x, y, 0)],
        ['Wraith',       (S, x, y) => S.createWraith(x, y, 0)],
        ['Adaptive shade',(S, x, y) => S.createAdaptiveShade(x, y, 0)],
        ['Torpedo diver',(S, x, y) => S.createTorpedoDiver(x, y, 0)],
        ['Leech',        (S, x, y) => S.createLeech(x, y, 0)],
        ['Slime CEO',    (S, x, y) => S.createSlimeCeo(x, y, 0)],
        ['The Gem',      (S, x, y) => S.createGem(x, y, 0)],
        ['Drowner',      (S, x, y) => S.createDrowner(x, y, 0)],
        ['Ripplerunner', (S, x, y) => S.createRipplerunner(x, y, 0)],
        ['Tidecaller',   (S, x, y) => S.createTidecaller(x, y, 0)],
        ['Cheerleader',  (S, x, y) => S.createCheerleader(x, y, 0)],
        ['Wave rider',   (S, x, y) => S.createWaveRider(x, y, 0)],
        ['Tidal guard',  (S, x, y) => S.createTidalGuard(x, y, 0)],
        ['Conduit',      (S, x, y) => S.createConduit(x, y, 0)],
    ];
    static BOSSES = [
        ['Voltslime',      (S, x, y) => S.spawnVoltslimeBoss(x, y)],
        ['Void Sovereign', (S, x, y) => S.spawnVoidSovereignBoss(x, y)],
        ['Queen',          (S, x, y) => S.spawnPortal(x, y, 0, 'train_q' + (S.portals?.length || 0))],
    ];

    // WorldGen: one round room in the middle of the world
    static world(S) {
        const W = S.WORLD_WIDTH, H = S.WORLD_HEIGHT, R = Training.R, cx = W >> 1, cy = H >> 1, world = [];
        for (let x = 0; x < W; x++) { world[x] = []; for (let y = 0; y < H; y++) world[x][y] = S.NOTHING; }
        for (let x = cx - R; x <= cx + R; x++) for (let y = cy - R; y <= cy + R; y++) if (Math.hypot(x - cx, y - cy) <= R + 0.3) world[x][y] = S.FLOOR;
        S.addWalls(world);
        S.rooms = [{ x: cx - R, y: cy - R, w: R * 2 + 1, h: R * 2 + 1, isArena: true }];
        S._trainArena = { cx, cy };
        return world;
    }

    // Enemy strength as a Tower floor (TowerFloors.CFG's curve), so what you test here is what you'll meet
    static scale(S) {
        const C = TowerFloors.CFG, f = Training.floor();
        S.enemyHealthScale = C.BASE_HP * Math.pow(C.HP_STEP, f - 1);
        S.enemyDamageScale = C.BASE_DMG * Math.pow(C.DMG_STEP, f - 1);
        return { floor: f, hp: S.enemyHealthScale, dmg: S.enemyDamageScale };
    }
    static floor() { try { return Math.max(1, parseInt(localStorage.getItem('train_floor') || '1', 10) || 1); } catch (e) { return 1; } }

    // GameScene.create, at the end: you in the middle, god mode on, the panel up
    static begin(S) {
        const A = S._trainArena, TS = S.TILE_SIZE;
        if (!A) return;
        S.playerX = A.cx; S.playerY = A.cy + 4;
        S.player.setPosition(S.playerX * TS + TS / 2, S.playerY * TS + TS / 2 + S.SLIME_Y_OFFSET);
        S._devGodMode = true;
        S._train = { count: 1, dummy: true, hp: new Map(), log: [], total: 0, peak: 0, t0: S.time.now, pipes: 0 };
        S.pipes = [];   // (the scene object outlives a level: the Cistern's would come along)
        Training.panel(S);
    }

    // spawn n of a kind round the arena, away from you
    static spawn(S, make, n, boss = false) {
        const A = S._trainArena, R = Training.R;
        for (let i = 0; i < n; i++) {
            let x = 0, y = 0;
            for (let k = 0; k < 40; k++) {
                const a = Math.random() * Math.PI * 2, d = 4 + Math.random() * (R - 5);
                x = Math.round(A.cx + Math.cos(a) * d); y = Math.round(A.cy + Math.sin(a) * d);
                if (S.world[x]?.[y] === S.FLOOR && Math.hypot(x - S.playerX, y - S.playerY) >= 3 && !S.getEnemyAt?.(x, y)) break;
            }
            const before = new Set(S.enemies || []);
            try { make(S, x, y); } catch (e) { console.error('Training spawn:', e); S.showStatusText?.(S.player.x, S.player.y - 40, 'COULD NOT SPAWN THAT HERE', '#ff8866'); return; }
            for (const e of S.enemies || []) if (!before.has(e)) { e.tutorialRoomIndex = 0; if (S._train.dummy && !boss) e._trainImmortal = true; if (!S.enemies.includes(e)) S.enemies.push(e); }
            if (boss) break;   // one boss at a time
        }
    }

    // A pool of water (2-3 tiles across) somewhere round the arena, away from you
    static pool(S) {
        const A = S._trainArena, R = Training.R, a = Math.random() * Math.PI * 2, d = 3 + Math.random() * (R - 5), r = 2 + Math.random();
        const cx = Math.round(A.cx + Math.cos(a) * d), cy = Math.round(A.cy + Math.sin(a) * d);
        for (let ox = -3; ox <= 3; ox++) for (let oy = -3; oy <= 3; oy++) if (Math.hypot(ox, oy) <= r) S.addWater(cx + ox, cy + oy, 0);
    }
    // A leaking pipe in the arena wall, pointing in: steel mains (a stream across the arena) and copper valves (a pool at
    // the wall) by turns. LevelManager's pipes refill what fire dries; initPipes rebuilds them all from S.pipes.
    static pipe(S) {
        const A = S._trainArena;
        for (let k = 0; k < 40; k++) {
            const a = Math.random() * Math.PI * 2, c = Math.cos(a), s = Math.sin(a);
            let mx = A.cx, my = A.cy, r = 0;
            while (S.world[mx]?.[my] === S.FLOOR && r < Training.R + 3) { r++; mx = Math.round(A.cx + c * r); my = Math.round(A.cy + s * r); }
            const [dx, dy] = Math.abs(c) > Math.abs(s) ? [-Math.sign(c), 0] : [0, -Math.sign(s)];
            if (S.world[mx]?.[my] !== S.WALL || S.world[mx + dx]?.[my + dy] !== S.FLOOR) continue;
            S.pipes = [...(S.pipes || []), { mx, my, dx, dy, kind: S._train.pipes++ % 2 ? 'pool' : 'line', len: 2.5 }];
            Training._pipesOff(S);
            S.initPipes();
            return;
        }
    }
    static _pipesOff(S) {
        S._pipeGfx?.destroy();
        for (const d of S._pipeDrips || []) { S.tweens.killTweensOf(d); d.destroy(); }
        S._pipes = []; S._pipeDrips = [];
    }
    // every pipe and drop of water gone
    static dry(S) {
        S.pipes = []; Training._pipesOff(S);
        S.waterTiles?.clear(); S.steamTiles?.clear(); S._waterDirty = true;
    }

    static clear(S) {
        for (const e of [...(S.enemies || [])]) { e._trainImmortal = false; S.killEnemy(e); }
        try { if (S.voltslimeBoss?.active) S.damageVoltslimeBoss(1e9); if (S.voidSovereignBoss?.active) { S.voidSovereignBoss._isInvulnerable = false; S.damageVoidSovereignBoss(1e9); } } catch (e) {}
        for (const p of S.portals || []) if (p.active) { p.hp = 0; try { S.damagePortal?.(p, 1e9); } catch (e) {} }
    }

    // GameScene.update: the DPS meter (every enemy's lost HP, read as a diff), the Sovereign's update (it lives in the
    // Void Rift's otherwise), and dummies filling back up after a few quiet seconds
    static update(S, time) {
        const T = S._train;
        if (!T) return;
        if (S.voidSovereignBoss?.active) S._updateVoidSovereign?.(time);
        let dealt = 0;
        const read = (o, hp) => { const last = T.hp.has(o) ? T.hp.get(o) : hp; T.hp.set(o, hp); if (hp < last) { dealt += last - hp; o._trainHitAt = time; } };
        for (const e of S.enemies || []) if (e.sprite?.active) {
            read(e, e.health);
            if (e._trainImmortal && time - (e._trainHitAt || time) > 4000 && e.health < e.maxHealth) { e.health = e.maxHealth; T.hp.set(e, e.health); S.updateEnemyHealthBar?.(e); }
        }
        for (const b of [S.voltslimeBoss, S.voidSovereignBoss, ...(S.portals || [])]) if (b?.active) read(b, b.hp);
        if (dealt > 0) { T.log.push([time, dealt]); T.total += dealt; }
        while (T.log.length && time - T.log[0][0] > 5000) T.log.shift();
        const win = Math.min(5000, Math.max(1000, time - (T.log[0]?.[0] ?? time))), dps = T.log.reduce((n, [, d]) => n + d, 0) / (win / 1000);
        T.peak = Math.max(T.peak, dps);
        if (T.readout?.active && time - (T.readAt || 0) > 200) {
            T.readAt = time;
            const live = (S.enemies || []).filter(e => e.sprite?.active).length + [S.voltslimeBoss, S.voidSovereignBoss].filter(b => b?.active).length;
            T.readout.setText(`DPS (5s)   ${dps.toFixed(1)}\nPEAK       ${T.peak.toFixed(1)}\nTOTAL      ${Math.round(T.total)}\nENEMIES    ${live}`);
        }
    }

    // Is the pointer over the panel? GameScene's pointerdown asks, so a click on it doesn't fire. Asked at the click, from where
    // the panel is: a hover flag set by its buttons stuck on when you slid off a button out of the panel, and then no click ever fired.
    static overPanel(S, p) { const bg = S._trainPanel?.[0]; return !!(bg?.visible && bg.getBounds().contains(p.x, p.y)); }

    // The panel, on the HUD camera at the left.
    static panel(S) {
        const PW = 236, x0 = 12, y0 = 84, objs = [], D = 40;   // (left, under the HP card: the dev panel has the right)
        const pin = o => { o.setScrollFactor(0).setDepth(D); objs.push(o); return o; };
        const bg = pin(S.add.rectangle(x0, y0, PW, 10, 0x0a0d16, 0.9).setOrigin(0).setStrokeStyle(1, 0x3a4766, 1).setInteractive());
        let y = y0 + 10;
        const text = (x, t, size = 11, col = '#9fb0d0') => pin(S.add.text(x, y, t, { fontFamily: 'monospace', fontSize: size + 'px', fontStyle: 'bold', color: col }));
        const head = t => { text(x0 + 10, t, 10, '#f6d58a'); y += 16; };
        const button = (x, w, label, fn, on = null) => {
            const b = pin(S.add.text(x, y, label, { fontFamily: 'monospace', fontSize: '11px', fontStyle: 'bold', color: '#cfd8ee', backgroundColor: '#18203a', padding: { x: 5, y: 3 }, fixedWidth: w }).setInteractive({ useHandCursor: true }));
            const paint = () => b.setColor(on?.() ? '#0a0d16' : '#cfd8ee').setBackgroundColor(on?.() ? '#f6d58a' : '#18203a');
            b.on('pointerover', () => { if (!on?.()) b.setBackgroundColor('#26304f'); });
            b.on('pointerout', () => paint());
            b.on('pointerdown', () => { fn(); Sfx.play(S, 'click'); repaint(); });
            b._paint = paint; paint();
            return b;
        };
        const all = [];
        const repaint = () => all.forEach(b => b._paint());
        text(x0 + 10, 'TRAINING GROUND', 13, '#ffffff'); y += 22;
        head('SPAWN');
        const cw = (PW - 26) / 2;
        Training.KINDS.forEach(([label, make], i) => {
            if (i % 2 === 0 && i) y += 21;
            all.push(button(x0 + 10 + (i % 2) * (cw + 6), cw, label, () => Training.spawn(S, make, S._train.count)));
        });
        y += 26; head('BOSSES (one at a time)');
        Training.BOSSES.forEach(([label, make], i) => all.push(button(x0 + 10 + i * 74, 70, label.split(' ').pop(), () => Training.spawn(S, make, 1, true))));
        y += 26; head('HOW MANY');
        [1, 3, 5, 10].forEach((n, i) => all.push(button(x0 + 10 + i * 54, 48, '×' + n, () => { S._train.count = n; }, () => S._train.count === n)));
        y += 26; head('STRENGTH (Tower floor)');
        const fl = text(x0 + 90, `floor ${Training.floor()}`, 11, '#ffffff');
        const setF = d => { const f = Math.max(1, Math.min(200, Training.floor() + d)); try { localStorage.setItem('train_floor', String(f)); } catch (e) {} Training.scale(S); fl.setText(`floor ${f}`); };
        all.push(button(x0 + 10, 34, '−10', () => setF(-10)), button(x0 + 48, 34, '−1', () => setF(-1)), button(x0 + 160, 30, '+1', () => setF(1)), button(x0 + 194, 34, '+10', () => setF(10)));
        y += 26; head('OPTIONS');
        all.push(button(x0 + 10, cw, 'Dummies', () => { S._train.dummy = !S._train.dummy; for (const e of S.enemies || []) e._trainImmortal = S._train.dummy; }, () => S._train.dummy));
        all.push(button(x0 + 16 + cw, cw, 'Frozen', () => { S._devFreezeEnemies = !S._devFreezeEnemies; }, () => !!S._devFreezeEnemies));
        y += 21;
        all.push(button(x0 + 10, cw, 'God mode', () => { S._devGodMode = !S._devGodMode; }, () => !!S._devGodMode));
        all.push(button(x0 + 16 + cw, cw, 'Fill ults', () => { for (const k in S.ultGems) S.ultGems[k] = S.ultChargeMax; S._ultLockUntil = 0; S.updateHUD?.(); }));
        y += 21;
        all.push(button(x0 + 10, cw, 'Clear all', () => Training.clear(S)));
        all.push(button(x0 + 16 + cw, cw, 'Reset meter', () => { const T = S._train; T.log = []; T.total = 0; T.peak = 0; }));
        y += 26; head('TERRAIN');
        const tw = (PW - 32) / 3;
        all.push(button(x0 + 10, tw, 'Water', () => Training.pool(S)), button(x0 + 16 + tw, tw, 'Pipe', () => Training.pipe(S)), button(x0 + 22 + tw * 2, tw, 'Dry', () => Training.dry(S)));
        y += 28; head('YOUR DAMAGE');
        S._train.readout = text(x0 + 10, '', 11, '#7dff9a'); y += 62;
        all.push(button(x0 + 10, PW - 20, 'LEAVE', () => { S.cameras.main.fadeOut(300, 0, 0, 0); S.time.delayedCall(320, () => S.scene.start('LevelSelect')); }));
        y += 28;
        bg.setSize(PW, y - y0); bg.input.hitArea.setSize(PW, y - y0);
        for (const o of objs) S._vfxSort?.(o);
        S._trainPanel = objs;
        // H hides it (to see the fight)
        S.input.keyboard.on('keydown-H', () => { const v = !objs[0].visible; objs.forEach(o => o.setVisible(v)); });
    }
}
