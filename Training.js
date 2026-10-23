// ═══════════════════════════════════════════════════════════════════════
// TRAINING.JS — the Training Ground: a round arena off the world map where you spawn whatever you like,
// set how strong it is, and watch your damage. Static (no proxies): GameScene calls Training.* when
// started with { training: true } (WorldGen.generateWorld, LevelManager.applyFloorScaling/spawnEnemies,
// GameScene.create/update, HUD's label and restart).
// ═══════════════════════════════════════════════════════════════════════

class Training {
    static R = 11;   // the arena's radius in tiles
    // What the panel can spawn: [label, make(scene, x, y)]. Room 0 is the arena.
    static KINDS = [   // a name, how to make one, and its look (LevelManager.look: the panel's portrait)
        ['Slime',        (S, x, y) => S.createEnemy(x, y), 'slime'],
        ['Ranged',       (S, x, y) => S.createRangedEnemy(x, y, 0), 'ranged'],
        ['Berserker',    (S, x, y) => S.createBerserker(x, y, 0), 'berserker'],
        ['Splitter',     (S, x, y) => S.createSplitter(x, y, 0), 'splitter'],
        ['Mortar',       (S, x, y) => S.createMortar(x, y, 0), 'mortar'],
        ['Rooter',       (S, x, y) => S.createRooter(x, y, 0), 'rooter'],
        ['Healer slime', (S, x, y) => S.createHealerTotem(x, y, 0), 'healer'],
        ['Anchor',       (S, x, y) => S.createAnchorSlime(x, y, 0), 'anchor'],
        ['Sniper',       (S, x, y) => S.createUpgradedSniper(x, y, 0), 'voidsniper'],
        ['Void sniper',  (S, x, y) => S.createVoidSniper(x, y, 0), 'voidsniper'],
        ['Lightning el.',(S, x, y) => S.createLightningElemental(x, y, 0), 'lightningelem'],
        ['Singularity',  (S, x, y) => S.createSingularitySlime(x, y, 0), 'singularity'],
        ['Encased',      (S, x, y) => S.createEncasedSlime(x, y, 0), 'encased'],
        ['Frost slime',  (S, x, y) => S.createFrostSlime(x, y, 0), 'frost'],
        ['Budding slime',(S, x, y) => S.createBuddingSlime(x, y, 0), 'bud'],
        ['Hunter slime', (S, x, y) => S.createHunterSlime(x, y, 0), 'hunter'],
        ['Armored slime',(S, x, y) => S.createArmoredSlime(x, y, 0), 'armored'],
        ['Wraith',       (S, x, y) => S.createWraith(x, y, 0), 'wraith'],
        ['Adaptive shade',(S, x, y) => S.createAdaptiveShade(x, y, 0), 'shade'],
        ['Torpedo diver',(S, x, y) => S.createTorpedoDiver(x, y, 0), 'diver'],
        ['Leech',        (S, x, y) => S.createLeech(x, y, 0), 'leech'],
        ['Slime CEO',    (S, x, y) => S.createSlimeCeo(x, y, 0), 'ceo'],
        ['The Gem',      (S, x, y) => S.createGem(x, y, 0), 'gem'],
        ['Drowner',      (S, x, y) => S.createDrowner(x, y, 0), 'drowner'],
        ['Ripplerunner', (S, x, y) => S.createRipplerunner(x, y, 0), 'ripplerunner'],
        ['Tidecaller',   (S, x, y) => S.createTidecaller(x, y, 0), 'tidecaller'],
        ['Cheerleader',  (S, x, y) => S.createCheerleader(x, y, 0), 'cheer'],
        ['Wave rider',   (S, x, y) => S.createWaveRider(x, y, 0), 'waverider'],
        ['Tidal guard',  (S, x, y) => S.createTidalGuard(x, y, 0), 'tidalguard'],
        ['Conduit',      (S, x, y) => S.createConduit(x, y, 0), 'conduit'],
        ['Smasher',      (S, x, y) => TideMother.makeSmasher(S, x, y, 0), 'smasher'],
    ];
    static BOSSES = [
        ['Voltslime',      (S, x, y) => S.spawnVoltslimeBoss(x, y), 'volt'],   // (and its body: BossFX.body)
        ['Void Sovereign', (S, x, y) => S.spawnVoidSovereignBoss(x, y), 'void'],
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
            for (const e of S.enemies || []) if (!before.has(e)) {
                e.tutorialRoomIndex = 0; if (S._train.dummy && !boss) e._trainImmortal = true; if (!S.enemies.includes(e)) S.enemies.push(e);
                if (boss || !e.sprite?.active) continue;   // the panel's modifiers (OPTIONS): a resistance, an ult-blocking zone
                const res = ['fire', 'ice', 'lightning'].filter(k => S._train.res?.[k]);
                if (res.length) S._tagResist(e, res.length === 1 ? res[0] : res);
                if (S._train.ult) S._ultBlockerFx(e, S._train.ult === 'absorb');
            }
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
            if (S.world[mx]?.[my] !== S.WALL || S.world[mx + dx]?.[my + dy] !== S.FLOOR || S.pipes?.some(p => p.mx === mx && p.my === my)) continue;   // (two in one tile drew over each other)
            S.pipes = [...(S.pipes || []), { mx, my, dx, dy, kind: S._train.pipes++ % 2 ? 'pool' : 'line', len: 2.5 }];
            Training._pipesOff(S);
            S.initPipes();
            return;
        }
    }
    static _pipesOff(S) {
        for (const o of S._pipeImgs || []) o.destroy();
        S._pipeFlow?.destroy();
        S._pipes = [];
    }
    // A spot a few tiles beside you, and a 3x3 patch of some ground round it to walk into (and hear): `put(tx, ty)` lays one tile
    static spot(S) {
        for (const [dx, dy] of [[3, 0], [-3, 0], [0, 3], [0, -3]]) if (S.world[S.playerX + dx]?.[S.playerY + dy] === S.FLOOR) return [S.playerX + dx, S.playerY + dy];
        return null;
    }
    static patch(S, put) {
        const c = Training.spot(S);
        if (c) for (let ox = -1; ox <= 1; ox++) for (let oy = -1; oy <= 1; oy++) if (S.world[c[0] + ox]?.[c[1] + oy] === S.FLOOR) put(c[0] + ox, c[1] + oy);
    }
    static lava(S, superBurn) {
        const T = S.TILE_SIZE;
        Training.patch(S, (x, y) => S.spawnIgnitionTrail(x * T + T / 2, y * T + T / 2, 20000, superBurn ? { superBurn: true } : {}));
    }
    static fog(S) { Training.patch(S, (x, y) => { S.addWater(x, y, 0); S.evaporateWater(x, y, 1e9); }); }   // water dried by fire
    static poison(S) { const c = Training.spot(S); if (c) S._poisonRing(c[0], c[1], 1); }   // a ring of pools round that spot
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
        S._fractureEnemies?.(time);   // the Encased slime's attacks and rebirth, the rooter's and splitter's marks (the Fracture's own loop)
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
            T.readout.setText(`DPS ${dps.toFixed(1).padEnd(8)} PEAK ${T.peak.toFixed(1)}\nTOTAL ${String(Math.round(T.total)).padEnd(6)} ENEMIES ${live}`);
        }
    }

    // Is the pointer over the panel? GameScene's pointerdown asks, so a click on it doesn't fire. Asked at the click, from where
    // the panel is: a hover flag set by its buttons stuck on when you slid off a button out of the panel, and then no click ever fired.
    static overPanel(S, p) { const bg = S._trainPanel?.[0]; return !!(bg?.visible && bg.getBounds().contains(p.x, p.y)); }

    // The panel, on the HUD camera at the left, in its frames (ui_tr: a 9-slice panel, the buttons' three states): a title,
    // tabs, the tab's page (ENEMIES: how many, how strong, what they carry, a card each with its portrait; BOSSES; ARENA:
    // options and terrain; TRIAL), and under every page your damage and LEAVE. Short enough for a 720-high window.
    static TABS = [['enemies', 'ENEMIES'], ['bosses', 'BOSSES'], ['arena', 'ARENA'], ['trial', 'TRIAL']];
    static showPanel(S, on) { if (S._train) S._train.panelOn = on; S._trainPanelShow?.(); }
    // the box of what's drawn in a frame (its opaque pixels), measured once
    static drawn(S, key, frame) {
        const C = (S._trainDrawn ||= {}), id = key + ':' + frame;
        if (C[id]) return C[id];
        const f = S.textures.get(key).get(frame), cv = document.createElement('canvas'), x = cv.getContext('2d');
        cv.width = f.cutWidth; cv.height = f.cutHeight;
        x.drawImage(f.source.image, f.cutX, f.cutY, f.cutWidth, f.cutHeight, 0, 0, f.cutWidth, f.cutHeight);
        let x0 = cv.width, y0 = cv.height, x1 = -1, y1 = -1;
        try {
            const d = x.getImageData(0, 0, cv.width, cv.height).data;
            for (let j = 0; j < cv.height; j++) for (let i = 0; i < cv.width; i++) if (d[(j * cv.width + i) * 4 + 3] > 40) { x0 = Math.min(x0, i); y0 = Math.min(y0, j); x1 = Math.max(x1, i); y1 = Math.max(y1, j); }
        } catch (e) {}
        return (C[id] = x1 < 0 ? { x: 0, y: 0, w: f.width, h: f.height } : { x: x0, y: y0, w: x1 - x0 + 1, h: y1 - y0 + 1 });
    }
    static panel(S) {
        const PW = 300, P = 10, IW = PW - 2 * P, x0 = 12, y0 = 84, D = 40, objs = [], page = new Map(), all = [];
        let cur = null, y = y0 + P;
        const pin = (o, d) => { o.setScrollFactor(0).setDepth(D + d); objs.push(o); if (cur) page.set(o, cur); return o; };
        const text = (x, yy, t, size = 11, col = '#9fb0d0', o = {}) => pin(S.add.text(x, yy, t, { fontFamily: 'monospace', fontSize: size + 'px', fontStyle: 'bold', color: col, ...o }), 0.2);
        const btn = (x, yy, w, h, label, fn, on = null, o = {}) => {
            const b = pin(S.add.nineslice(x, yy, 'ui_tr', 'btn', w, h, 4, 4, 4, 4).setOrigin(0), 0.1).setInteractive({ useHandCursor: true });
            const t = label == null ? null : pin(S.add.text(o.left != null ? x + o.left : x + w / 2, yy + h / 2, label, { fontFamily: 'monospace', fontSize: (o.size || 11) + 'px', fontStyle: 'bold', color: '#d8e0f4' }).setOrigin(o.left != null ? 0 : 0.5, 0.5), 0.2);
            let hover = false;
            const paint = () => { const lit = !!on?.(); b.setFrame(lit ? 'btn_on' : hover ? 'btn_hover' : 'btn'); b.updateUVs(); t?.setColor(lit ? '#14101c' : '#d8e0f4'); };   // (a 9-slice keeps its old frame's UVs till told)
            b.on('pointerover', () => { hover = true; paint(); }); b.on('pointerout', () => { hover = false; paint(); });
            b.on('pointerdown', () => { fn(); Sfx.play(S, 'click'); all.forEach(r => r.paint()); });
            const r = { b, t, paint }; all.push(r); paint(); return r;
        };
        // an enemy's portrait: its body as the game draws it (LevelManager.look; a boss's, BossFX.body), its colours, its face
        // and hat (CreatureFX), fitted by what's drawn of its frame (a slime fills little of its frame: scaled whole, a speck)
        const portrait = (key, x, yy, size, boss = false) => {
            const L = boss ? { tex: BossFX.body(S, key), anim: null, tint: null } : LevelManager.look(S, key);
            if (!L.tex || !S.textures.exists(L.tex)) return;
            const tex = S.textures.get(L.tex), fr = tex.has(0) ? 0 : tex.getFrameNames()[0], f = tex.get(fr), b = Training.drawn(S, L.tex, fr);
            const k = size / Math.max(b.w, b.h, 1);
            const spr = pin(S.add.sprite(x + (f.width / 2 - (b.x + b.w / 2)) * k, yy + (f.height / 2 - (b.y + b.h / 2)) * k, L.tex, fr).setScale(k), 0.25);
            if (L.tint) spr.setTint(L.tint);
            if (L.anim && S.anims.exists(L.anim)) spr.play(L.anim);
            const T = S._cfxCfg?.().TYPES?.[key] || {};
            if (typeof CreatureFX !== 'undefined') CreatureFX.face(S, spr, { mood: boss ? 'angry' : CreatureFX.moodOf(key), hat: T.hat || null, eye: T.eye, look: () => null });
        };
        const T = S._train;
        T.tab ||= 'enemies'; T.res ||= {};
        text(x0 + P, y, 'TRAINING GROUND', 13, '#ffffff'); text(x0 + PW - P, y + 2, 'H hides', 9, '#59627f').setOrigin(1, 0); y += 20;
        const tw = (IW - 9) / 4;
        Training.TABS.forEach(([id, label], i) => btn(x0 + P + i * (tw + 3), y, tw, 20, label, () => { T.tab = id; show(); }, () => T.tab === id, { size: 10 }));
        y += 28;
        const top = y, ends = {};
        let foot = top;
        const row = (label) => { text(x0 + P, y + 4, label, 9, '#f6d58a'); };
        // ENEMIES
        cur = 'enemies'; y = top;
        row('HOW MANY');
        [1, 3, 5, 10].forEach((n, i) => btn(x0 + P + 66 + i * 54, y, 50, 20, '×' + n, () => { T.count = n; }, () => T.count === n));
        y += 24; row('FLOOR');
        const fl = text(x0 + P + 66 + 2 * 39 + 21, y + 4, `${Training.floor()}`, 11, '#ffffff').setOrigin(0.5, 0);
        const setF = d => { const f = Math.max(1, Math.min(200, Training.floor() + d)); try { localStorage.setItem('train_floor', String(f)); } catch (e) {} Training.scale(S); fl.setText(`${f}`); };
        [['−10', -10], ['−1', -1]].forEach(([l, d], i) => btn(x0 + P + 66 + i * 39, y, 36, 20, l, () => setF(d)));
        [['+1', 1], ['+10', 10]].forEach(([l, d], i) => btn(x0 + P + 66 + 2 * 39 + 46 + i * 39, y, 36, 20, l, () => setF(d)));
        y += 24; row('RESIST');   // any of the three, together for a double or a triple
        [['Fire', 'fire'], ['Ice', 'ice'], ['Bolt', 'lightning']].forEach(([l, k], i) => btn(x0 + P + 66 + i * 72, y, 68, 20, l, () => { T.res[k] = !T.res[k]; }, () => !!T.res[k]));
        y += 24; row('ULT');
        [['Block', 'block'], ['Absorb', 'absorb']].forEach(([l, k], i) => btn(x0 + P + 66 + i * 108, y, 104, 20, l, () => { T.ult = T.ult === k ? null : k; }, () => T.ult === k));
        y += 28;
        const cw = (IW - 4) / 2;
        Training.KINDS.forEach(([label, make, key], i) => {
            const x = x0 + P + (i % 2) * (cw + 4), yy = y + Math.floor(i / 2) * 24;
            btn(x, yy, cw, 22, label, () => Training.spawn(S, make, T.count), null, { left: 26, size: 10 });
            portrait(key, x + 13, yy + 11, 17);
        });
        y += Math.ceil(Training.KINDS.length / 2) * 24;
        foot = Math.max(foot, ends.enemies = y);
        // BOSSES
        cur = 'bosses'; y = top;
        text(x0 + P, y, 'one at a time', 9, '#59627f'); y += 16;
        Training.BOSSES.forEach(([label, make, key]) => {
            btn(x0 + P, y, IW, 34, label, () => Training.spawn(S, make, 1, true), null, { left: 46, size: 12 });
            if (key) portrait(key, x0 + P + 22, y + 17, 26, true);
            y += 38;
        });
        foot = Math.max(foot, ends.bosses = y);
        // ARENA
        cur = 'arena'; y = top;
        const hw = (IW - 4) / 2;
        row('OPTIONS'); y += 16;
        [[['Dummies', () => { T.dummy = !T.dummy; for (const e of S.enemies || []) e._trainImmortal = T.dummy; }, () => T.dummy], ['Frozen', () => { S._devFreezeEnemies = !S._devFreezeEnemies; }, () => !!S._devFreezeEnemies]],
         [['God mode', () => { S._devGodMode = !S._devGodMode; }, () => !!S._devGodMode], ['Fill ults', () => { for (const k in S.ultGems) S.ultGems[k] = S.ultChargeMax; S._ultLockUntil = 0; S.updateHUD?.(); }]],
         [['Clear all', () => Training.clear(S)], ['Reset meter', () => { T.log = []; T.total = 0; T.peak = 0; }]]].forEach(pair => {
            pair.forEach(([l, fn, on], i) => btn(x0 + P + i * (hw + 4), y, hw, 22, l, fn, on || null));
            y += 25;
        });
        y += 6; row('TERRAIN'); y += 16;
        const t3 = (IW - 8) / 3, t4 = (IW - 12) / 4;
        [['Water', () => Training.pool(S)], ['Pipe', () => Training.pipe(S)], ['Dry', () => Training.dry(S)]].forEach(([l, fn], i) => btn(x0 + P + i * (t3 + 4), y, t3, 22, l, fn));
        y += 25;   // beside you, to walk into and hear
        [['Lava', () => Training.lava(S, false)], ['Hot', () => Training.lava(S, true)], ['Fog', () => Training.fog(S)], ['Poison', () => Training.poison(S)]].forEach(([l, fn], i) => btn(x0 + P + i * (t4 + 4), y, t4, 22, l, fn));
        y += 25;
        foot = Math.max(foot, ends.arena = y);
        // TRIAL
        cur = 'trial'; y = top;
        text(x0 + P, y, 'FRACTURE RHYTHM RUN', 12, '#ffffff'); y += 18;
        text(x0 + P, y, 'Step onto each slab as it forms on its beat.\nShift dashes the gaps, Space jumps quakes.\nKill the core and reach the end alive.', 10, '#9fb0d0', { lineSpacing: 3 }); y += 50;
        row('DIFFICULTY'); y += 16;
        [['EASY', 'easy'], ['NORMAL', 'normal'], ['HARD', 'hard'], ['IMPOSSIBLE', 'impossible']].forEach(([l, d], i) => btn(x0 + P + i * ((IW - 12) / 4 + 4), y, (IW - 12) / 4, 22, l, () => RhythmTrial.set({ diff: d }), () => RhythmTrial.settings().diff === d));
        y += 28; row('SPEED');
        const sp = text(x0 + P + IW / 2, y + 4, `×${RhythmTrial.settings().speed.toFixed(1)}`, 11, '#ffffff').setOrigin(0.5, 0);
        const setS = d => { const v = Math.max(0.5, Math.min(1.5, Math.round((RhythmTrial.settings().speed + d) * 10) / 10)); RhythmTrial.set({ speed: v }); sp.setText(`×${v.toFixed(1)}`); };
        btn(x0 + P + 66, y, 40, 20, '−', () => setS(-0.1)); btn(x0 + P + IW - 40, y, 40, 20, '+', () => setS(0.1));
        y += 26;
        btn(x0 + P, y, IW, 22, 'Unlimited lives', () => RhythmTrial.set({ inf: RhythmTrial.settings().inf ? 0 : 1 }), () => RhythmTrial.settings().inf);
        y += 28; row('SONG'); y += 16;   // (a file of your own in assets/music/local/: RhythmTrial.SONGS)
        const songs = [['Off', ''], ...Object.entries(RhythmTrial.SONGS).map(([id, o]) => [o.title, id])], sw = (IW - 4 * (songs.length - 1)) / songs.length;
        songs.forEach(([l, id], i) => btn(x0 + P + i * (sw + 4), y, sw, 22, l, () => RhythmTrial.set({ song: id }), () => RhythmTrial.settings().song === id, { size: 10 }));
        y += 26; row('OFFSET');   // the song's beat nudged, by ear: later (+) or earlier (−)
        const of = text(x0 + P + IW / 2 + 20, y + 4, `${RhythmTrial.settings().offset} ms`, 11, '#ffffff').setOrigin(0.5, 0);
        const setO = d => { const v = Math.max(-500, Math.min(500, RhythmTrial.settings().offset + d)); RhythmTrial.set({ off: v }); of.setText(`${v} ms`); };
        btn(x0 + P + 66, y, 40, 20, '−10', () => setO(-10)); btn(x0 + P + IW - 40, y, 40, 20, '+10', () => setO(10));
        y += 30;
        btn(x0 + P, y, IW, 30, 'START', () => RhythmTrial.start(S), null, { size: 13 });
        y += 34;
        foot = Math.max(foot, ends.trial = y);
        // under every page: your damage, and the way out
        cur = null; y = foot + 6;
        const footFrom = objs.length;
        text(x0 + P, y, 'YOUR DAMAGE', 9, '#f6d58a'); y += 14;
        T.readout = text(x0 + P, y, '', 11, '#7dff9a', { lineSpacing: 2 }); y += 32;
        btn(x0 + P, y, IW, 22, 'LEAVE', () => { S.cameras.main.fadeOut(300, 0, 0, 0); S.time.delayedCall(320, () => S.scene.start('LevelSelect')); });
        y += 22 + P;
        const footer = objs.slice(footFrom), fullH = y - y0;
        footer.forEach(o => { o._y0 = o.y; });
        const bg = S.add.nineslice(x0, y0, 'ui_tr', 'panel', PW, fullH, 6, 6, 6, 6).setOrigin(0).setScrollFactor(0).setDepth(D).setInteractive();
        objs.unshift(bg);
        for (const o of objs) S._vfxSort?.(o);
        S._trainPanel = objs;
        const show = () => {   // the tab's page; the readout and LEAVE right under it, the frame fitted round them
            const on = T.panelOn !== false, dy = (ends[T.tab] ?? foot) - foot;
            for (const o of objs) o.setVisible(on && (!page.has(o) || page.get(o) === T.tab));
            for (const o of footer) o.y = o._y0 + dy;
            bg.setSize(PW, fullH + dy); bg.input?.hitArea?.setSize(PW, fullH + dy);
        };
        S._trainPanelShow = show;
        show();
        S.input.keyboard.on('keydown-H', () => Training.showPanel(S, T.panelOn === false));   // to see the fight
    }
}
