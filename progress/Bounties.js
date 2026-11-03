// ═══════════════════════════════════════════════════════════════════════════
// Bounties.js — small goals for one run, three up at a time.
//
// Achievements count forever and pay once; a bounty is the other way round: small, specific, done in one run (a level,
// floors and all, or one Tower climb), then replaced. Each watches a counter (`stat`) and is done when one run takes it to
// `goal`: Achievements' bump, on counters that start again from nothing every run. One that's done stays up, ticked, until
// you're back on the map, where a new one goes up in its place. A reroll swaps one: a free one comes back with every run,
// and one more is banked (up to REROLL_MAX) for every level you clear, or every TOWER_EVERY floors of a climb. Nothing is
// offered that you can't do yet (`requires`, and a weapon's needs the weapon); a weapon's goes to the one you own and hold
// least (Telemetry's wpnMs). The pay is a tier's glorps (a hard one, a sealed book too), scaled to what your own runs earn
// a minute (Telemetry), and fixed when the bounty goes up. Saved as 'bounties', so it goes online with the rest of the save
// (Cloud.js). The Training Ground never counts: Telemetry, which feeds this, keeps no record there.
//
// Fed by Telemetry (begin, room every frame, hurt, ult, end), Achievements.onKill (each kill) and CombatSystem._noteUltHit
// (each reaction). Shown on the map (the doodle in its corner opens the wood board, its three plain notices: openBoard; one
// done since you were last there is stamped COMPLETE, crumpled and tossed over the board before its new one goes up), under
// the run clock as a small scroll when one is close, beside the pause menu (pausePanel), as a scroll that unrolls when one's
// done (in Achievements.toast's queue) and as a plain card on the win screen (doneThisRun). Its art: ui_bounty_paper.
// ═══════════════════════════════════════════════════════════════════════════

const Bounties = {
    KEY: 'bounties', UP: 3, REROLL_MAX: 3, TOWER_EVERY: 5,
    // a tier's glorps for a player whose runs earn RATE glorps a minute (about 300 a 12-minute run); a hard one adds a book
    TIER: { 1: 50, 2: 80, 3: 120 }, RATE: 25, SCALE: [0.5, 3],
    TIER_NAME: [null, 'EASY', 'MEDIUM', 'HARD'],
    KIND: { react: { name: 'REACTION', icon: 'k_react' }, skill: { name: 'SKILL', icon: 'k_skill' }, weapon: { name: 'WEAPON', icon: 'note' }, place: { name: 'PLACE', icon: 'k_place' } },

    // `short` is the line under the run clock ("3 / 5 cubes broken with lightning")
    LIST: [
        // reactions and switching
        { id: 'thaw',     kind: 'react',  tier: 1, name: 'Cold Shower',     stat: 'burnIce',    goal: 6,  how: 'Kill 6 burning enemies with ice.',                                   short: 'burning enemies finished with ice' },
        { id: 'zap',      kind: 'react',  tier: 2, name: 'Ice Breaker',     stat: 'cubeZap',    goal: 5,  how: 'Kill 5 ice-cubed enemies with lightning.',                           short: 'cubes broken with lightning', requires: B => B.has('lightning') },
        { id: 'swap',     kind: 'react',  tier: 1, name: 'Quick Hands',     stat: 'swapKills',  goal: 5,  how: 'Kill 5 enemies within 2 seconds of switching element.',              short: 'kills just after a switch' },
        { id: 'chain',    kind: 'react',  tier: 2, name: 'Chain Reaction',  stat: 'reactEls',   goal: 3,  how: 'Land reactions with three different elements within 6 seconds.',    short: 'elements reacting together', requires: B => B.has('lightning') },
        { id: 'four',     kind: 'react',  tier: 2, name: 'Full Spectrum',   stat: 'elKills',    goal: 4,  how: 'Kill an enemy with each of the four elements.',                      short: 'elements with a kill', requires: B => B.has('cosmic') },
        // skill
        { id: 'clean',    kind: 'skill',  tier: 2, name: 'Spotless',        stat: 'cleanRooms', goal: 1,  how: 'Clear a room of 4 or more enemies without taking a hit.',            short: 'rooms cleared unhurt' },
        { id: 'grounded', kind: 'skill',  tier: 1, name: 'Feet on the Ground', stat: 'stillRooms', goal: 2, how: 'Clear 2 rooms of 3 or more enemies without dashing.',             short: 'rooms cleared without a dash' },
        { id: 'streak',   kind: 'skill',  tier: 1, name: 'Not a Scratch',   stat: 'streak',     goal: 15, how: 'Kill 15 enemies in a row without taking a hit.',                     short: 'kills in a row, unhurt' },
        { id: 'flurry',   kind: 'skill',  tier: 2, name: 'Flurry',          stat: 'flurry',     goal: 4,  how: 'Kill 4 enemies within a second and a half.',                         short: 'kills in one flurry' },
        { id: 'brink',    kind: 'skill',  tier: 2, name: 'On the Brink',    stat: 'brink',      goal: 3,  how: 'Kill 3 enemies while under a quarter of your health.',               short: 'kills on the brink' },
        { id: 'noult',    kind: 'skill',  tier: 2, name: 'Bare Hands',      stat: 'noUltClear', goal: 1,  how: 'Clear a level without casting an ult.',                              short: 'levels cleared without an ult', requires: () => Progress.cleared('gauntlet') },
        // weapons (offered only for one you own, the one you hold least)
        { id: 'w_sword',  kind: 'weapon', tier: 2, name: 'Three in One',    weapon: 'flame_sword',    stat: 'multi_flame_sword',    goal: 3,  how: 'Kill 3 enemies with one swing of the Flame Sword.',            short: 'killed in one swing' },
        { id: 'w_magma',  kind: 'weapon', tier: 1, name: 'Lobber',          weapon: 'magma_staff',    stat: 'far4_magma_staff',     goal: 6,  how: 'Kill 6 enemies 4 or more tiles away with the Magma Staff.',    short: 'kills from 4 tiles off' },
        { id: 'w_ignite', kind: 'weapon', tier: 2, name: 'Powder Keg',      weapon: 'ignition',       stat: 'multi_ignition',       goal: 4,  how: 'Kill 4 enemies at once with Ignition.',                        short: 'killed at once' },
        { id: 'w_scythe', kind: 'weapon', tier: 2, name: 'Grim Grace',      weapon: 'ember_scythe',   stat: 'streak_ember_scythe',  goal: 12, how: 'Kill 12 enemies in a row with the Ember Scythe without taking a hit.', short: 'Scythe kills in a row, unhurt' },
        { id: 'w_icicle', kind: 'weapon', tier: 1, name: 'Sharpshooter',    weapon: 'icicle_cannon',  stat: 'far5_icicle_cannon',   goal: 8,  how: 'Kill 8 enemies 5 or more tiles away with the Icicle Cannon.',  short: 'kills from 5 tiles off' },
        { id: 'w_shard',  kind: 'weapon', tier: 1, name: 'Glass Garden',    weapon: 'fractal_shard',  stat: 'cubed_fractal_shard',  goal: 6,  how: 'Kill 6 ice-cubed enemies with the Fractal Shard.',             short: 'cubes shattered' },
        { id: 'w_glaive', kind: 'weapon', tier: 3, name: 'Thunderstorm',    weapon: 'thunder_glaive', stat: 'burst_thunder_glaive', goal: 10, how: 'Kill 10 enemies within 6 seconds with the Thunder Glaive.',    short: 'Glaive kills in 6 seconds' },
        { id: 'w_blade',  kind: 'weapon', tier: 2, name: 'Clean Cut',       weapon: 'void_blade',     stat: 'multi_void_blade',     goal: 3,  how: 'Kill 3 enemies with one cut of the Void Blade.',               short: 'killed in one cut' },
        // places
        { id: 'p_live',   kind: 'place',  tier: 2, name: 'Insulated',       stat: 'clear_gauntlet', goal: 1, how: 'Clear the Gauntlet with its live floor zapping you no more than twice.', short: '', requires: () => Progress.cleared('gauntlet') },
        { id: 'p_laser',  kind: 'place',  tier: 2, name: 'Out of Sight',    stat: 'clear_voidrift', goal: 1, how: "Clear the Void Rift without the Void Sovereign's laser touching you.", short: '', requires: () => Progress.cleared('voidrift') },
        { id: 'p_fault',  kind: 'place',  tier: 2, name: 'Sure Footing',    stat: 'clear_fracture', goal: 1, how: 'Clear the Fracture without a fault line catching you.',              short: '', requires: () => Progress.cleared('fracture') },
        { id: 'p_dry',    kind: 'place',  tier: 3, name: 'Dry Feet',        stat: 'clear_cistern',  goal: 1, how: 'Clear the Cistern without a Drowner landing a hit.',                   short: '', requires: () => Progress.unlocked('cistern') },
        { id: 'p_climb',  kind: 'place',  tier: 2, name: 'Long Climb',      stat: 'floors',         goal: 8, how: 'Clear 8 Tower floors in one climb.',                                   short: 'Tower floors this climb', requires: () => Progress.unlocked('tower') && TowerFloors.best() >= 6 },
        { id: 'p_crown',  kind: 'place',  tier: 3, name: 'Regicide',        stat: 'towerBoss',      goal: 1, how: 'Beat a Tower boss.',                                                    short: '', requires: () => Progress.unlocked('tower') && TowerFloors.best() >= 9 },
    ],

    // ── THE SAVE ─────────────────────────────────────────────────────────────
    // { active: [{ id, reward, best (the most one run got), done, seen }], free (the free reroll is there), rerolls (banked),
    //   recent (ids just taken down, not offered again for a while) }
    state() { return { active: [], free: true, rerolls: 0, recent: [], ...Achievements._read(this.KEY, {}) }; },
    _save(s) { Achievements._write(this.KEY, s); },
    def(id) { return this.LIST.find(d => d.id === id); },
    // what's up: each bounty's own fields over its definition's
    active(s = this.state()) { return s.active.filter(b => this.def(b.id)).map(b => ({ ...this.def(b.id), ...b })); },
    doneThisRun() { return this.run?.done || []; },

    // ── WHAT CAN BE OFFERED ──────────────────────────────────────────────────
    has(el) { return el === 'fire' || el === 'ice' || localStorage.getItem('unlocked_' + el) === 'true'; },
    owns(w) {
        const c = ShopScene.CATALOGUE.find(x => x.id === w);
        return !!c && this.has(c.element) && (!!c.defaultWeapon || Achievements._read('unlockedWeapons', []).includes(w));
    },
    open(d) { return (!d.weapon || this.owns(d.weapon)) && (!d.requires || !!d.requires(this)); },
    // how long each weapon's been held, over every run on record
    heldMs() { const t = {}; for (const r of Telemetry.all()) for (const [w, ms] of Object.entries(r.wpnMs || {})) t[w] = (t[w] || 0) + ms; return t; },
    // what your runs earn a minute against RATE (the records in this browser; too few, and it's 1)
    payScale() {
        let g = 0, ms = 0;
        for (const r of Telemetry.all().slice(-40)) { g += r.glorps || 0; ms += r.ms || 0; }
        return ms < 10 * 60000 ? 1 : Math.min(this.SCALE[1], Math.max(this.SCALE[0], g / (ms / 60000) / this.RATE));
    },
    _reward(d) {
        const glorps = Math.max(10, Math.round(this.TIER[d.tier] * this.payScale() / 5) * 5);
        return d.tier === 3 ? { glorps, books: 1 } : { glorps };
    },
    // one to put up: open, not up already, not just taken down; a weapon's for the weapon held least; a kind not up yet
    _pick(s) {
        const up = new Set(s.active.map(b => b.id)), kinds = new Set(s.active.map(b => this.def(b.id)?.kind));
        let pool = this.LIST.filter(d => !up.has(d.id) && this.open(d));
        const fresh = pool.filter(d => !s.recent.includes(d.id)); if (fresh.length) pool = fresh;
        const ws = pool.filter(d => d.weapon);
        if (ws.length) { const held = this.heldMs(), least = Math.min(...ws.map(d => held[d.weapon] || 0)); pool = pool.filter(d => !d.weapon || (held[d.weapon] || 0) === least); }
        const other = pool.filter(d => !kinds.has(d.kind)); if (other.length) pool = other;
        return pool[Math.floor(Math.random() * pool.length)] || null;
    },
    _post(s, at = s.active.length, seen = false) {
        const d = this._pick(s);
        if (d) s.active.splice(at, 0, { id: d.id, reward: this._reward(d), best: 0, seen });
        return d;
    },
    // On the map: the ones done come down, new ones go up in their place
    refresh() {
        const s = this.state();
        s.active = s.active.filter(b => this.def(b.id));
        for (let i = 0; i < s.active.length; i++) {
            const b = s.active[i];
            if (!b.done) continue;
            s.recent.unshift(b.id); (s.gone ||= []).push({ ...b, slot: i });
            s.active.splice(i, 1);
            if (!this._post(s, i)) i--;
        }
        while (s.active.length < this.UP && this._post(s));
        s.recent = [...new Set(s.recent)].slice(0, 8);
        this._save(s);
        return s;
    },
    canReroll(s = this.state()) { return s.free || s.rerolls > 0; },
    reroll(i) {
        const s = this.state(), b = s.active[i];
        if (!b || b.done || !this.canReroll(s)) return false;
        if (s.free) s.free = false; else s.rerolls--;
        s.active.splice(i, 1); s.recent = [...new Set([b.id, ...s.recent])].slice(0, 8);
        this._post(s, i, true);
        this._save(s);
        return true;
    },
    _bank() { const s = this.state(); s.rerolls = Math.min(this.REROLL_MAX, (s.rerolls || 0) + 1); this._save(s); },

    // ── THE RUN ──────────────────────────────────────────────────────────────
    // A new run starts its counters from nothing (and gives the free reroll back); the next floor of the same run
    // (continueRun: a Tower floor, a story level's next floor) keeps them. `up` is what's up, for the run.
    run: null,
    begin(scene) {
        if (!scene._sceneData?.continueRun || !this.run) {
            this.run = { stats: {}, done: [], ults: 0, hitsBy: {}, streak: 0, wStreak: {}, kills: [], els: new Set(), reactAt: {}, floors: 0 };
            const s = this.state(); if (!s.free) { s.free = true; this._save(s); }
        }
        Object.assign(this.run, { scene, live: true, up: this.active(), room: { r: -1, hits: 0, dashes: 0, kills: 0 }, cleared: new Set(),
                                  el: scene.currentElement, switchAt: -1e9, stamAt: scene._stamAt || 0, line: null });
    },
    _live(scene) { return !!this.run?.live && scene === this.run.scene; },
    // add n to a run's counter (or raise it to n, with max), and pay whatever that finishes (as Achievements.bump)
    bump(stat, n = 1, scene = null, max = false) {
        const R = this.run;
        if (!R?.live) return;
        const s = R.stats, was = s[stat] || 0;
        s[stat] = max ? Math.max(was, n) : was + n;
        if (s[stat] === was) return;
        for (const b of R.up) if (b.stat === stat && !b.done && s[stat] >= b.goal) this._earn(b, scene || R.scene);
    },
    _earn(b, scene) {
        b.done = true; b.best = b.goal;
        const s = this.state(), sb = s.active.find(x => x.id === b.id);
        if (sb) { sb.done = true; sb.best = b.goal; this._save(s); }
        Achievements.pay(b.reward, scene);
        this.run.done.push({ ...b, rs: scene?._runStats });   // (rs: the floor it was done on; the win screen counts its glorps on that floor's)
        if (scene?.add) Achievements.toast(scene, { ...b, draw: (sc, end) => this._scroll(sc, b, end) });
    },
    // The run's over, or this floor is: what it cleared, and the most it got on each bounty, kept
    end(scene, result) {
        const R = this.run;
        if (!this._live(scene)) return;
        if (result === 'clear') {
            if (scene.towerRun) {
                this.bump('floors', ++R.floors, scene, true);
                if (scene.towerRun.boss) this.bump('towerBoss', 1, scene);
                this._roomDone(scene);   // (a Tower floor is one room)
                if (R.floors % this.TOWER_EVERY === 0) this._bank();
            } else {
                const id = Progress.BY_LEVEL_INDEX[scene.currentLevelIndex], hits = k => R.hitsBy[k] || 0;
                if (id && !R.ults) this.bump('noUltClear', 1, scene);
                if ({ gauntlet: hits('live floor') <= 2, voidrift: !hits('sovereign laser'), fracture: !hits('core fault'), cistern: !hits('drowner') }[id]) this.bump('clear_' + id, 1, scene);
                this._bank();
            }
        }
        R.live = false;
        const s = this.state();
        let ch = false;
        for (const b of s.active) { const d = this.def(b.id), n = d ? Math.min(d.goal, R.stats[d.stat] || 0) : 0; if (!b.done && n > (b.best || 0)) { b.best = n; ch = true; } }
        if (ch) this._save(s);
    },
    // k: what hit you (Telemetry's key: an enemy's codex key, or a named hazard or move)
    hurt(scene, amount, k) {
        if (!this._live(scene) || !(amount > 0)) return;
        const R = this.run;
        R.hitsBy[k] = (R.hitsBy[k] || 0) + 1; R.room.hits++; R.streak = 0; R.wStreak = {};
    },
    ult(scene) { if (this._live(scene)) this.run.ults++; },
    onKill(scene, e) {
        if (!this._live(scene)) return;
        const R = this.run, now = scene.time.now, el = e._lastEl, w = el && scene.equippedWeapons?.[el], st = scene._ultStatusOf?.(e) || {};
        R.room.kills++;
        this.bump('streak', ++R.streak, scene, true);
        if (el === 'ice' && st.fire) this.bump('burnIce', 1, scene);
        if (el === 'lightning' && e._iceCube) this.bump('cubeZap', 1, scene);
        if (now - R.switchAt <= 2000) this.bump('swapKills', 1, scene);
        if (el) { R.els.add(el); this.bump('elKills', R.els.size, scene, true); }
        if (scene.health < (scene.maxHealth || 0) / 4) this.bump('brink', 1, scene);
        R.kills = R.kills.filter(k => now - k.t <= 6000); R.kills.push({ t: now, w });
        this.bump('flurry', R.kills.filter(k => now - k.t <= 1500).length, scene, true);
        if (!w) return;
        // the weapon's own: kills at once (one swing, one blast), kills in 6s, from afar, in a row unhurt, cubes it broke
        this.bump('multi_' + w, R.kills.filter(k => k.w === w && now - k.t <= 300).length, scene, true);
        this.bump('burst_' + w, R.kills.filter(k => k.w === w).length, scene, true);
        const far = Math.hypot(e.x - scene.playerX, e.y - scene.playerY);
        if (far >= 4) this.bump('far4_' + w, 1, scene);
        if (far >= 5) this.bump('far5_' + w, 1, scene);
        this.bump('streak_' + w, R.wStreak[w] = (R.wStreak[w] || 0) + 1, scene, true);
        if (e._iceCube) this.bump('cubed_' + w, 1, scene);
    },
    // a hit of element `el` on an enemy carrying another element's status (once per enemy in 350ms, as its spark)
    onReaction(scene, enemy, el) {
        const now = scene.time.now;
        if (!this._live(scene) || now - (enemy._btyReactAt || -1e9) < 350) return;
        enemy._btyReactAt = now;
        const at = this.run.reactAt; at[el] = now;
        this.bump('reactEls', Object.values(at).filter(t => now - t <= 6000).length, scene, true);
    },
    // Every frame of a run (Telemetry.room, `r` the room you're in): a switch, a dash, a room changed or cleared, the line under the clock
    tick(scene, r) {
        if (!this._live(scene)) return;
        const R = this.run;
        if (scene.currentElement !== R.el) { R.el = scene.currentElement; R.switchAt = scene.time.now; }
        if (scene._stamAt && scene._stamAt !== R.stamAt) { R.stamAt = scene._stamAt; R.room.dashes++; }   // every dash spends stamina (GameScene._stamSpend stamps _stamAt)
        if (r >= 0 && r !== R.room.r) R.room = { r, hits: 0, dashes: 0, kills: 0 };
        const C = scene.tutorialRoomCleared;
        if (C) for (const k in C) if (C[k] && !R.cleared.has(k)) { R.cleared.add(k); if (+k === R.room.r) this._roomDone(scene); }
        this._line(scene);
    },
    _roomDone(scene) {
        const m = this.run.room;
        if (m.kills >= 4 && !m.hits) this.bump('cleanRooms', 1, scene);
        if (m.kills >= 3 && !m.dashes) this.bump('stillRooms', 1, scene);
        this.run.room = { r: m.r, hits: 0, dashes: 0, kills: 0 };
    },

    // ── ON SCREEN ────────────────────────────────────────────────────────────
    // a bounty's picture: the weapon's own icon, else its kind's (ui_bounty)
    icon(scene, b, x, y, s = 2) {
        const k = b.weapon && MenuArt.iconSheet(scene, b.weapon);
        return k ? scene.add.image(x, y, k, '0').setScale(Math.max(1, Math.round(s * 2 / 3))) : scene.add.image(x, y, 'ui_bounty', this.KIND[b.kind].icon).setScale(s);
    },
    // A scroll: its paper (sp_line or sp_pop) shown from its middle out as far as it's open, a roll each side turning as it goes.
    // Returns { c (its container), open(t) }: t from 0 (rolled) to 1 (open).
    _scrollBits(scene, paper, x, y, depth) {
        const Z = 2, f = scene.textures.getFrame('ui_bounty_paper', paper), w = f.cutWidth, h = f.cutHeight, ph = h - 8;
        const c = scene.add.container(x, y).setScrollFactor(0).setDepth(depth);
        const p = scene.add.image(0, 0, 'ui_bounty_paper', paper).setScale(Z);
        const L = scene.add.image(0, -2 * Z, this._rollTex(scene, ph + 10, 0)).setScale(Z), Rr = scene.add.image(0, -2 * Z, this._rollTex(scene, ph + 10, 1)).setScale(Z);
        c.add([p, L, Rr]);
        const open = t => {
            const o = Math.max(2, Math.round((w - 8) * t)), x0 = Math.round((w - o) / 2);
            p.setCrop(x0, 0, o, h);
            L.setX((x0 - w / 2 - 4.5) * Z).setTexture(this._rollTex(scene, ph + 10, Math.floor(t * 9) % 3));
            Rr.setX((x0 + o - w / 2 + 4.5) * Z).setTexture(this._rollTex(scene, ph + 10, (Math.floor(t * 9) + 1) % 3));
        };
        open(0);
        return { c, open, w: w * Z, h: h * Z };
    },
    // the pop-up when one's done: a scroll unrolling at the top, its seal, BOUNTY · its name, what it was, the pay; then rolled up
    _scroll(scene, b, end) {
        const W = scene.scale.width, S = this._scrollBits(scene, 'sp_pop', W / 2, 70, 60), left = -S.w / 2 + 20, R = b.reward || {};
        const words = [scene.add.image(left + 20, 4, 'ui_bounty_paper', 'seal_' + b.tier).setScale(2),
            scene.add.text(left + 46, -32, `BOUNTY  ·  ${b.name.toUpperCase()}`, { fontSize: '17px', fontFamily: UIKit.FONT.title, fontStyle: 'bold', color: '#3b2716' }),
            scene.add.text(left + 46, -9, b.how, { fontSize: '13px', fontFamily: 'Georgia, serif', color: '#4a3220', wordWrap: { width: S.w - 110 } }),
            scene.add.image(left + 46, 15, 'ui_bounty_paper', 'st_glorp').setOrigin(0, 0).setScale(2),
            scene.add.text(left + 80, 19, `${(R.glorps || 0).toLocaleString('en-US')} glorps${R.books ? `   + ${R.books} sealed book${R.books > 1 ? 's' : ''}` : ''}`, { fontSize: '14px', fontFamily: 'Georgia, serif', fontStyle: 'bold', color: '#3a5a2a' })];
        words.forEach(o => o.setAlpha(0)); S.c.add(words);
        Sfx.play(scene, 'fanfare');
        const o = { t: 0 };
        scene.tweens.add({ targets: o, t: 1, duration: 320, ease: 'Quad.easeOut', onUpdate: () => S.open(o.t),
            onComplete: () => scene.tweens.add({ targets: words, alpha: 1, duration: 140 }) });
        scene.time.delayedCall(3600, () => {
            if (!S.c.active) return end();
            scene.tweens.add({ targets: words, alpha: 0, duration: 120 });
            scene.tweens.add({ targets: o, t: 0, duration: 260, delay: 120, ease: 'Quad.easeIn', onUpdate: () => S.open(o.t), onComplete: () => { S.c.destroy(); end(); } });
        });
    },
    // Under the run clock, while one that counts is at least half done: a small scroll that unrolls with its count and what it counts
    _line(scene) {
        const R = this.run, clock = scene._runClock;
        let best = null;
        for (const b of R.up) {
            const n = R.stats[b.stat] || 0, f = n / b.goal;
            if (!b.done && b.goal > 1 && f >= 0.5 && f > (best?.f ?? 0)) best = { b, n, f };
        }
        const s = best ? `${best.n} / ${best.b.goal}   ${best.b.short}` : '';
        if (!R.line?.c?.active) {
            if (!s || !clock?.active) return;
            const S = this._scrollBits(scene, 'sp_line', scene.scale.width / 2, clock.y + clock.height + 22, 40);
            S.t = scene.add.text(0, -1, '', { fontSize: '12px', fontFamily: 'Georgia, serif', fontStyle: 'bold', color: '#4a3220' }).setOrigin(0.5).setAlpha(0);
            S.c.add(S.t);
            const o = { t: 0 };
            scene.tweens.add({ targets: o, t: 1, duration: 260, ease: 'Quad.easeOut', onUpdate: () => S.open(o.t), onComplete: () => S.t.setAlpha(1) });
            R.line = S;
        }
        if (R.line.t.text !== s) R.line.t.setText(s);
        R.line.c.setVisible(!!s && !!clock?.visible);
    },

    // Beside the pause menu: what's up, each on a small scroll that unrolls (its seal, its name, what to do, this run's count and
    // the best run's, the pay); with no run going (the defence), the best run's alone
    pausePanel(scene, x, y, h, depth = 501) {
        const R = this.run, live = this._live(scene), up = live ? R.up : this.active(), f = scene.textures.getFrame('ui_bounty_paper', 'sp_list');
        const sw = (f?.cutWidth || 0) * 2 + 12;
        if (!up.length || !f || f.name === '__BASE' || x + sw > scene.scale.width - 6) return [];   // (no room beside the menu)
        const objs = [], cx = x + sw / 2, rh = Math.min(118, (h - 44) / this.UP);
        objs.push(scene.add.text(cx, y + 18, 'BOUNTIES', { fontSize: '18px', fontFamily: UIKit.FONT.title, fontStyle: 'bold', color: '#f0b84a', stroke: '#000', strokeThickness: 3 }).setOrigin(0.5).setScrollFactor(0).setDepth(depth + 2));
        up.forEach((b, i) => {
            const S = this._scrollBits(scene, 'sp_list', cx, y + 44 + rh * i + rh / 2, depth + 1), left = -S.w / 2 + 14, R2 = b.reward || {};
            const n = b.done ? b.goal : Math.min(b.goal, live ? R.stats[b.stat] || 0 : b.best || 0), best = Math.min(b.goal, b.best || 0);
            const count = b.done ? 'DONE' : b.goal > 1 ? (live ? `this run ${n} / ${b.goal}  ·  best ${best}` : `best run ${best} / ${b.goal}`) : (live ? 'not yet this run' : best ? 'done once' : 'not yet');
            const words = [scene.add.image(left + 12, -4, 'ui_bounty_paper', 'seal_' + b.tier).setScale(2),
                scene.add.text(left + 30, -36, b.name.toUpperCase(), { fontSize: '13px', fontFamily: UIKit.FONT.title, fontStyle: 'bold', color: '#3b2716' }),
                scene.add.text(left + 30, -20, b.how, { fontSize: '11px', fontFamily: 'Georgia, serif', color: '#4a3220', wordWrap: { width: S.w - 64 }, lineSpacing: -2 }),
                scene.add.text(left + 30, 18, count, { fontSize: '11px', fontFamily: 'Georgia, serif', fontStyle: 'italic', color: b.done ? '#3a5a2a' : '#5a3e22' }),
                scene.add.text(S.w / 2 - 16, 18, `${(R2.glorps || 0).toLocaleString('en-US')} glorps${R2.books ? ' + book' : ''}`, { fontSize: '11px', fontFamily: 'Georgia, serif', fontStyle: 'bold', color: '#3a5a2a' }).setOrigin(1, 0)];
            words.forEach(o => o.setAlpha(0)); S.c.add(words);
            const o = { t: 0 };
            scene.tweens.add({ targets: o, t: 1, duration: 220, delay: 60 + i * 90, ease: 'Quad.easeOut', onUpdate: () => S.c.active && S.open(o.t), onComplete: () => S.c.active && scene.tweens.add({ targets: words, alpha: 1, duration: 120 }) });   // (the menu may close first)
            objs.push(S.c);
        });
        return objs;
    },

    // The map's corner: the board, in the margin hand; a red ! by it while there's one you haven't looked at (or one done,
    // waiting to be taken down). First, the ones done come down and new ones go up in their places.
    mapBoard(scene, x, y) {
        const s = this.refresh();
        const g = scene.add.image(x, y, 'ui_bounty', 'sc_board').setOrigin(0.5, 0.6).setScale(2).setDepth(6);
        const t = scene.add.text(x, y + 16, 'bounties', { fontSize: '12px', fontFamily: UIKit.FONT.title, fontStyle: 'italic', color: '#5a3a1a' }).setOrigin(0.5, 0).setDepth(6).setAngle(-2);
        const nw = s.active.some(b => !b.seen) || s.gone?.length ? scene.add.image(x + 28, y - 14, 'ui_bounty', 'sc_new').setScale(2).setDepth(6) : null;
        const z = scene.add.zone(x, y + 4, 56, 50).setInteractive({ useHandCursor: true }).setDepth(7);
        z.on('pointerover', () => { g.setScale(2.24); t.setScale(1.08); });
        z.on('pointerout', () => { g.setScale(2); t.setScale(1); });
        z.on('pointerdown', () => { if (scene._settingsOpen) return; nw?.destroy(); this.openBoard(scene); });
    },

    // ── THE BOARD (ui_bounty_paper, drawn 2x) ────────────────────────────────
    // art pixels: the card (its frame has 4 of margin for its shadow), the frame's beams, the gaps
    CARD: { w: 136, h: 150, m: 4 }, BOARD: { pad: 8, gap: 10, top: 22, l: 10, r: 12, b: 12, foot: 20 },
    // where the board sits on a W x H screen (screen px: ox, oy; its size in art px: bw, bh), and a card's slot on it (art px)
    boardLayout(W, H) {
        const Z = 2, C = this.CARD, B = this.BOARD, bw = B.l + B.pad * 2 + C.w * this.UP + B.gap * (this.UP - 1) + B.r, bh = B.top + C.h + B.pad + B.foot + B.b;
        return { Z, bw, bh, ox: Math.round(W / 2 - bw * Z / 2), oy: Math.round(H / 2 - bh * Z / 2 + 6), slot: i => [B.l + B.pad + i * (C.w + B.gap), B.top], foot: B.top + C.h + B.pad };
    },
    // a texture made once from the sheet's own frames: the board (planks in a frame), a scroll's roll at a height and turn
    _tex(scene, key, w, h, paint) {
        if (scene.textures.exists(key)) return key;
        const ct = scene.textures.createCanvas(key, w, h), cx = ct.getContext(), src = scene.textures.get('ui_bounty_paper');
        const put = (n, x, y, ww, hh) => { const f = src.get(n); cx.drawImage(f.source.image, f.cutX, f.cutY, ww ?? f.cutWidth, hh ?? f.cutHeight, x, y, ww ?? f.cutWidth, hh ?? f.cutHeight); };
        const tile = (n, x, y, ww, hh) => { const f = src.get(n); for (let yy = 0; yy < hh; yy += f.cutHeight) for (let xx = 0; xx < ww; xx += f.cutWidth) put(n, x + xx, y + yy, Math.min(f.cutWidth, ww - xx), Math.min(f.cutHeight, hh - yy)); };
        paint(put, tile);
        ct.refresh();
        return key;
    },
    _boardTex(scene, w, h) {
        return this._tex(scene, `bty_board_${w}x${h}`, w, h, (put, tile) => {
            for (let y = 8; y < h - 10; y += 16) for (let x = 8; x < w - 10; x += 32) tile('wd_' + ((x / 32 + y / 16) % 2 | 0), x, y, Math.min(32, w - 10 - x), Math.min(16, h - 10 - y));
            tile('wt', 10, 0, w - 22, 10); tile('wb', 10, h - 12, w - 22, 12); tile('wl', 0, 10, 10, h - 22); tile('wr', w - 12, 10, 12, h - 22);
            put('wc_tl', 0, 0); put('wc_tr', w - 12, 0); put('wc_bl', 0, h - 12); put('wc_br', w - 12, h - 12);
        });
    },
    _rollTex(scene, h, f) {   // a roll h rows tall at turn f: its top, its body, its bottom
        return this._tex(scene, `bty_roll_${h}_${f}`, 9, h, (put) => { put('rl_top', 0, 0); for (let y = 7; y < h - 7; y++) put('rl_' + f, 0, y); put('rl_bot', 0, h - 7); });
    },

    // One bounty's notice at art pixel (x, y) of a board whose top left is (ox, oy) on the screen: the card, its pin, its seal,
    // its words, the count (the best one run got: or all of it, done), the pay, the quill that rewrites it. Returns its objects.
    _notice(scene, b, ox, oy, x, y, D, { done = false, reroll = null, can = true } = {}) {
        const Z = 2, C = this.CARD, objs = [], X = v => ox + v * Z, Y = v => oy + v * Z, cx = X(x + C.w / 2);
        const keep = o => { objs.push(o.setDepth(o.depth || D)); return o; };
        const T = (tx, ty, s, o) => keep(scene.add.text(tx, ty, s, { fontFamily: 'Georgia, "Palatino Linotype", serif', color: '#42301e', ...o }));
        const img = (n, ax, ay) => keep(scene.add.image(X(ax), Y(ay), 'ui_bounty_paper', n).setOrigin(0).setScale(Z));
        img('nt_plain', x - C.m, y - C.m);
        img(b.tier === 2 ? 'nail' : 'tack', x + 65, y + 2).setDepth(D + 0.5);
        img('seal_' + b.tier, x + 112, y + 10);
        T(cx, Y(y + 18), `${this.KIND[b.kind].name}  ·  ${this.TIER_NAME[b.tier]}`, { fontSize: '10px', fontStyle: 'bold', color: '#6a4a2a' }).setOrigin(0.5, 0);
        const name = T(cx, Y(y + 26), b.name.toUpperCase(), { fontSize: '21px', fontStyle: 'bold', color: '#36220f' }).setOrigin(0.5, 0);
        for (let f = 20; name.width > (C.w - 30) * Z && f > 13; f--) name.setFontSize(f);   // (a long name: smaller, to fit)
        for (let xx = x + 34; xx < x + C.w - 34; xx++) img('bar_m', xx, y + 39);
        T(cx, Y(y + 46), b.how, { fontSize: '14px', align: 'center', lineSpacing: 1, wordWrap: { width: (C.w - 24) * Z } }).setOrigin(0.5, 0);
        const n = done ? b.goal : Math.min(b.goal, b.best || 0), bx = x + 28, by = y + 92, bw = C.w - 56;
        T(cx, Y(by) - 17, done ? 'done' : b.goal > 1 ? `best run   ${n} / ${b.goal}` : n ? 'done once' : 'not yet', { fontSize: '12px', fontStyle: 'italic', color: '#5a3e22' }).setOrigin(0.5, 0);
        img('bar_l', bx, by); for (let xx = bx + 3; xx < bx + bw - 3; xx++) img('bar_m', xx, by); img('bar_r', bx + bw - 3, by);
        for (let xx = bx + 1; xx < bx + 1 + (bw - 2) * n / b.goal; xx++) img('bar_f', xx, by + 1);
        const R = b.reward || {};
        img('st_glorp', x + 16, y + 102); T(X(x + 34), Y(y + 105), `${(R.glorps || 0).toLocaleString('en-US')} glorps`, { fontSize: '15px', fontStyle: 'bold', color: '#3a5a2a' });
        if (R.books) { img('st_book', x + 16, y + 117); T(X(x + 34), Y(y + 120), `+ ${R.books} sealed book${R.books > 1 ? 's' : ''}`, { fontSize: '13px', fontStyle: 'bold', color: '#52346e' }); }
        if (reroll) {   // the quill: write another (dim with no rerolls left)
            const q = img('quill', x + 92, y + 133).setAlpha(can ? 1 : 0.4), t = T(X(x + 107), Y(y + 136), 'rewrite', { fontSize: '12px', fontStyle: 'italic', color: '#5a3e22' }).setAlpha(can ? 1 : 0.45);
            const z = keep(scene.add.zone(X(x + 90), Y(y + 131), 40 * Z, 16 * Z).setOrigin(0).setInteractive({ useHandCursor: true }));
            z.on('pointerover', () => t.setColor('#8a2a1a')); z.on('pointerout', () => t.setColor('#5a3e22'));
            z.on('pointerdown', reroll);
        }
        if (!b.seen && !done) T(X(x + 10), Y(y + 8), 'new', { fontSize: '13px', fontStyle: 'bold italic', color: '#a02a1a' });
        return objs;
    },
    // The board: the three up, each on its notice, the rerolls left. One done since you were last here is up first as it
    // was, stamped COMPLETE (wet, then dry), then crumpled and tossed over the board's top and gone behind it, and the one
    // that took its place goes up.
    openBoard(scene) {
        if (scene._settingsOpen) return;
        scene._settingsOpen = true;
        Sfx.play(scene, 'click');
        const W = scene.scale.width, H = scene.scale.height, D = 200, P = UIKit.PALETTE, Z = 2, C = this.CARD, B = this.BOARD;
        const { bw, bh, ox, oy, slot, foot } = this.boardLayout(W, H);
        let objs = [], msg = '', busy = false;
        const close = () => { if (busy) return; objs.forEach(o => o?.destroy?.()); objs = []; scene._settingsOpen = false; scene.input.keyboard.off('keydown-ESC', close); };
        const draw = (st = this.state(), only = null) => {
            objs.forEach(o => o?.destroy?.()); objs = [];
            const keep = o => { objs.push(o); return o; }, kit = k => { objs.push(...k.objs); return k; };
            kit(UIKit.overlay(scene, { alpha: 0.9, depth: D }));   // (the map well back: the board is all there is)
            keep(scene.add.image(ox, oy, this._boardTex(scene, bw, bh)).setOrigin(0).setScale(Z).setDepth(D + 2));
            const pw = 120, px = Math.round(bw / 2 - pw / 2), np = (n, x) => keep(scene.add.image(ox + x * Z, oy - 6 * Z, 'ui_bounty_paper', n).setOrigin(0).setScale(Z).setDepth(D + 3));
            np('plq_l', px); for (let x = 8; x < pw - 8; x += 4) np('plq_m', px + x); np('plq_r', px + pw - 8);
            keep(scene.add.text(ox + bw * Z / 2, oy - 6 * Z + 8, 'BOUNTY BOARD', { fontSize: '17px', fontFamily: UIKit.FONT.title, fontStyle: 'bold', color: '#f4dca8', stroke: '#1e1208', strokeThickness: 3 }).setOrigin(0.5, 0).setDepth(D + 4));
            const up = this.active(st), can = this.canReroll(st);
            up.forEach((b, i) => { if (only && !only.includes(i)) return;
                objs.push(...this._notice(scene, b, ox, oy, ...slot(i), D + 3, { can, reroll: () => { if (busy) return; if (this.reroll(i)) { Sfx.play(scene, 'pop'); msg = ''; } else { Sfx.play(scene, 'deny'); msg = 'No rerolls left: clear a level for another.'; } draw(); } })); });
            if (!up.length) keep(scene.add.text(W / 2, oy + bh * Z / 2, 'nothing to put up yet', { fontSize: '13px', fontFamily: 'monospace', color: UIKit.CSS.textLo }).setOrigin(0.5).setDepth(D + 4));
            // the board's own bottom rail: the rerolls left (what they are, on hover), and DONE on a plaque of its own
            const fy = oy + (foot + B.foot / 2) * Z, carved = { fontSize: '13px', fontFamily: UIKit.FONT.title, fontStyle: 'bold', color: '#f4dca8', stroke: '#1e1208', strokeThickness: 3 };
            const rr = keep(scene.add.text(ox + (B.l + B.pad) * Z, fy, `REROLLS:  ${st.free ? '1 free' : 'no free one'}  ·  ${st.rerolls || 0} banked (of ${this.REROLL_MAX})`, carved).setOrigin(0, 0.5).setDepth(D + 4));
            const tip = keep(scene.add.text(rr.x, rr.y - 20, msg || `Done in one run. A free reroll comes back with every run; one more is banked for every level you clear, or every ${this.TOWER_EVERY} floors of one climb.`,
                { fontSize: '12px', fontFamily: 'Georgia, serif', color: msg ? '#ffd0c0' : '#f4e8cc', backgroundColor: '#1e1208', padding: { x: 8, y: 5 }, wordWrap: { width: Math.min(420, bw * Z - 220) } }).setOrigin(0, 1).setDepth(D + 7).setVisible(!!msg));
            rr.setInteractive({ useHandCursor: true }).on('pointerover', () => tip.setVisible(true)).on('pointerout', () => tip.setVisible(!!msg));
            if (msg) scene.time.delayedCall(2500, () => { if (tip.active && tip.text === msg) tip.setVisible(false); });
            const dw = 64, dx = bw - B.r - B.pad - dw, dy = foot + 2, dp = (n, x) => keep(scene.add.image(ox + x * Z, oy + dy * Z, 'ui_bounty_paper', n).setOrigin(0).setScale(Z).setDepth(D + 4));
            dp('plq_l', dx); for (let x = dx + 8; x < dx + dw - 8; x += 4) dp('plq_m', x); dp('plq_r', dx + dw - 8);
            const dt = keep(scene.add.text(ox + (dx + dw / 2) * Z, oy + (dy + 8) * Z, 'DONE', { ...carved, fontSize: '14px' }).setOrigin(0.5).setDepth(D + 5));
            const dz = keep(scene.add.zone(ox + dx * Z, oy + dy * Z, dw * Z, 16 * Z).setOrigin(0).setInteractive({ useHandCursor: true }).setDepth(D + 6));
            dz.on('pointerover', () => dt.setColor('#ffffff')).on('pointerout', () => dt.setColor('#f4dca8')).on('pointerdown', () => { Sfx.play(scene, 'click'); close(); });
            if (up.some(b => !b.seen) && !busy) { st.active.forEach(b => { b.seen = true; }); this._save(st); }
        };
        const st = this.state(), gone = st.gone || [];
        if (!gone.length) { draw(st); scene.input.keyboard.on('keydown-ESC', close); return; }
        // the finished ones first, where they hung
        busy = true;
        draw(st, this.active(st).map((_, i) => i).filter(i => !gone.some(g => g.slot === i)));
        gone.forEach((g, k) => {
            const [x, y] = slot(g.slot), at = k * 900, card = this._notice(scene, { ...this.def(g.id), ...g }, ox, oy, x, y, D + 3, { done: true });
            objs.push(...card);
            const stamp = (n, a) => { const s = scene.add.image(ox + (x + C.w / 2 - 32) * Z, oy + (y + 50) * Z, 'ui_bounty_paper', n).setOrigin(0).setScale(Z).setDepth(D + 4).setAlpha(a); objs.push(s); card.push(s); return s; };   // (on the card: it goes with it)
            scene.time.delayedCall(at + 250, () => { if (!objs.length) return; stamp('done_0_u', 1); Sfx.play(scene, 'slam', { small: true }); scene.cameras.main.shake(60, 0.002); });
            scene.time.delayedCall(at + 520, () => { if (objs.length) stamp('done_1_u', 1); });
            scene.time.delayedCall(at + 1100, () => this._toss(scene, card, ox + (x + C.w / 2) * Z, oy + (y + C.h / 2) * Z, oy, D, objs));
        });
        scene.time.delayedCall(gone.length * 900 + 2000, () => {
            const s2 = this.state(); delete s2.gone; this._save(s2);
            busy = false; if (scene._settingsOpen) draw(s2);
        });
        scene.input.keyboard.on('keydown-ESC', close);
    },
    // a finished notice: it balls up where it hung (cr_a, cr_b), then the ball (turning: ball_0-2) flies up over the board's top
    // and drops behind it
    _toss(scene, card, cx, cy, top, D, objs) {
        if (!objs.length) return;
        card.forEach(o => o.setVisible(false));
        const Z = 2, img = (n, x, y, d = D + 5) => { const o = scene.add.image(x, y, 'ui_bounty_paper', n).setScale(Z).setDepth(d); objs.push(o); return o; };
        Sfx.play(scene, 'whoosh');
        const a = img('cr_a', cx, cy);
        scene.time.delayedCall(90, () => { a.setFrame('cr_b'); });
        scene.time.delayedCall(180, () => {
            a.setFrame('ball_0');
            const x0 = cx, y0 = cy, x1 = cx + 150, peak = top - 50, o = { t: 0 };
            scene.tweens.add({ targets: o, t: 1, duration: 760, ease: 'Linear',
                onUpdate: () => {
                    const t = o.t, y = (1 - t) * (1 - t) * y0 + 2 * (1 - t) * t * (peak - 60) + t * t * (top + 40);
                    a.setPosition(Math.round(x0 + (x1 - x0) * t), Math.round(y)).setFrame('ball_' + (Math.floor(t * 12) % 3));
                    if (t > 0.5 && a.depth > D + 1) a.setDepth(D + 1);   // over the top: now it falls behind the board
                },
                onComplete: () => a.destroy() });
        });
    },
};
