// ═══════════════════════════════════════════════════════════════════════════
// Settings.js — keybinds and the gameplay options, kept in localStorage.
//
//   Settings.key('dash')      → the Phaser key name bound to it ('SPACE')
//   Settings.label('SPACE')   → what to print for it ('Space')
//   Settings.shake()          → the screen-shake multiplier (1, 0.5 or 0)
//   Settings.glow()           → 1 or 0: the bloom pass on bright things
//
// GameScene reads every binding through key() when a level loads, so a change made in the
// lobby's settings panel (LevelSelectScene._openSettings) applies from the next level on.
// Audio volumes live with the sounds (Sfx / Music in Sound.js). Nothing here touches Phaser
// when the file loads.
// ═══════════════════════════════════════════════════════════════════════════

const Settings = {
    // In the order the panel lists them. `def`: the Phaser key name it starts on.
    ACTIONS: [
        { id: 'up',         label: 'Move up',            def: 'W' },
        { id: 'left',       label: 'Move left',          def: 'A' },
        { id: 'down',       label: 'Move down',          def: 'S' },
        { id: 'right',      label: 'Move right',         def: 'D' },
        { id: 'dash',       label: 'Dash',               def: 'SPACE' },
        { id: 'cosmicDash', label: 'Dash (cosmic: aimed)', def: 'SHIFT' },
        { id: 'fire',       label: 'Fire',               def: 'ONE' },
        { id: 'ice',        label: 'Ice',                def: 'TWO' },
        { id: 'lightning',  label: 'Lightning',          def: 'THREE' },
        { id: 'cosmic',     label: 'Cosmic',             def: 'FOUR' },
        { id: 'ult',        label: 'Ult (held element)', def: 'E' },
        { id: 'ultFire',    label: 'Fire ult',           def: 'Z' },
        { id: 'ultIce',     label: 'Ice ult',            def: 'X' },
        { id: 'ultLightning', label: 'Lightning ult',    def: 'C' },
        { id: 'ultCosmic',  label: 'Cosmic ult (hold)',  def: 'V' },
        { id: 'gadget1',    label: 'Gadget 1',           def: 'Q' },
        { id: 'gadget2',    label: 'Gadget 2',           def: 'F' },
        { id: 'surge',      label: 'Weapon ability',     def: 'R' },
        { id: 'detonate',   label: 'Detonate kindles',   def: 'G' },   // Ignition: every kindled mark goes off at once   // Magma surge, Icicle heal, Ignition... (each weapon's own)
        { id: 'mute',       label: 'Mute',               def: 'M' },
    ],
    // Keys the game keeps for itself (pause, the dev console), never bindable.
    RESERVED: ['ESC', 'BACKTICK', 'TAB'],

    _get(k) { try { return localStorage.getItem(k); } catch (e) { return null; } },
    _set(k, v) { try { localStorage.setItem(k, v); } catch (e) {} },

    _binds() {
        if (this._cache) return this._cache;
        let b = {};
        try { b = JSON.parse(this._get('keybinds') || '{}') || {}; } catch (e) { b = {}; }
        return (this._cache = b);
    },
    key(id) {
        const a = this.ACTIONS.find(x => x.id === id);
        return this._binds()[id] || a?.def || null;
    },
    // Bind `id` to `name`. Whatever else had that key takes this one's old key instead, so
    // two actions never share one. Returns the id that was swapped, or null.
    set(id, name) {
        const b = { ...this._binds() }, old = this.key(id);
        const clash = this.ACTIONS.find(x => x.id !== id && this.key(x.id) === name);
        b[id] = name;
        if (clash) b[clash.id] = old;
        this._cache = b;
        this._set('keybinds', JSON.stringify(b));
        return clash ? clash.id : null;
    },
    reset() { this._cache = {}; this._set('keybinds', '{}'); },

    LABELS: { ONE: '1', TWO: '2', THREE: '3', FOUR: '4', FIVE: '5', SIX: '6', SEVEN: '7', EIGHT: '8', NINE: '9', ZERO: '0',
              SPACE: 'Space', SHIFT: 'Shift', CTRL: 'Ctrl', ALT: 'Alt', ENTER: 'Enter', BACKSPACE: 'Bksp', CAPS_LOCK: 'Caps',
              UP: '↑', DOWN: '↓', LEFT: '←', RIGHT: '→', COMMA: ',', PERIOD: '.', FORWARD_SLASH: '/', SEMICOLON: ';',
              QUOTES: "'", OPEN_BRACKET: '[', CLOSED_BRACKET: ']', BACK_SLASH: '\\', MINUS: '-', PLUS: '=' },
    label(name) { return this.LABELS[name] || name || '—'; },
    // The Phaser key name for a browser keydown event, or null if it isn't one Phaser names.
    nameOf(ev) {
        const KC = (typeof Phaser !== 'undefined') ? Phaser.Input.Keyboard.KeyCodes : {};
        for (const n in KC) if (KC[n] === ev.keyCode) return n;
        return null;
    },

    // ── GAMEPLAY ─────────────────────────────────────────────────────────────
    SHAKE: [['FULL', 1], ['REDUCED', 0.5], ['OFF', 0]],
    shake() { const v = parseFloat(this._get('screenShake')); return isNaN(v) ? 1 : v; },
    setShake(v) { this._set('screenShake', String(v)); },
    // the glow off bright things (the bloom pass): off is lighter on a weak GPU. Takes effect when a level loads
    GLOW: [['ON', 1], ['OFF', 0]],
    glow() { return this._get('glow') === '0' ? 0 : 1; },
    setGlow(v) { this._set('glow', String(v)); },
    // a frame counter in the corner (fpsMeter): the frame rate, and the worst frame of the last second
    FPS: [['ON', 1], ['OFF', 0]],
    fps() { return this._get('fps') === '0' ? 0 : 1; },
    setFps(v) { this._set('fps', String(v)); },
    // A page element, not a game object: it shows over every scene and costs the game nothing to draw.
    // Green from 55 fps, amber from 30, red under; "low" is the slowest frame of the last second, where a hitch shows.
    fpsMeter(game) {
        const el = document.createElement('div');
        el.style.cssText = 'position:fixed;left:50%;top:46px;transform:translateX(-50%);z-index:10;font:bold 12px monospace;padding:2px 6px;border-radius:4px;background:rgba(5,6,10,0.7);pointer-events:none;';
        document.body.appendChild(el);
        let n = 0, t0 = performance.now(), last = t0, worst = 0;
        const tick = (now) => {
            const dt = now - last; last = now; n++; worst = Math.max(worst, dt);
            if (now - t0 >= 1000) {
                const fps = n * 1000 / (now - t0), low = 1000 / worst;
                el.style.display = this.fps() ? 'block' : 'none';
                el.style.color = fps >= 55 ? '#7dff9a' : fps >= 30 ? '#ffd060' : '#ff6a5a';
                el.textContent = `${Math.round(fps)} FPS  low ${Math.round(low)}  ${game.scene.getScenes(true).map(s => s.sys.settings.key).filter(k => k !== 'HUD').join(',')}`;
                n = 0; t0 = now; worst = 0;
            }
            requestAnimationFrame(tick);
        };
        requestAnimationFrame(tick);
    },
};

// ── DEV TOOLS (the lobby's Settings > DEV TOOLS) ─────────────────────────────
// Give yourself things, or wipe one part of the save at a time. Each part is the
// localStorage keys (or key prefixes) it lives in.
const DevSave = {
    PARTS: {
        weapons:  { name: 'Weapons', keys: ['unlockedWeapons'], prefixes: ['wlv_', 'wpk_', 'equip_'] },
        stats:    { name: 'Stats',                prefixes: ['stat_'] },
        ults:     { name: 'Ults',   keys: ['ultFragments'], prefixes: ['ultStage_'] },
        gadgets:  { name: 'Gadgets',              keys: ['unlockedGadgets', 'gadgetLoadout'] },
        relics:   { name: 'Relics',               keys: ['relics_owned', 'relics_worn'] },
        enchants: { name: 'Enchanting', keys: ['books', 'dust'], prefixes: ['ench_'] },
        tower:    { name: 'Tower best',           keys: ['tower_best'] },
        levels:   { name: 'Cleared levels',       keys: ['unlocked_lightning', 'unlocked_cosmic', 'unlocked_ice', 'iceTutorialComplete', 'fireTutorialComplete'], prefixes: ['cleared_', 'bossKilled_'] },
        glorps:   { name: 'Glorps',               keys: ['glorps'] },
        garden:   { name: 'Garden',               keys: ['garden2', 'slime_hat'] },
    },
    reset(part) {
        const P = this.PARTS[part];
        if (!P) return 0;
        const gone = Object.keys(localStorage).filter(k => (P.keys || []).includes(k) || (P.prefixes || []).some(p => k.startsWith(p)));
        gone.forEach(k => localStorage.removeItem(k));
        if (typeof Enchants !== 'undefined') Enchants._cache = {};
        return gone.length;
    },
    resetAll() { return Object.keys(this.PARTS).reduce((n, p) => n + this.reset(p), 0); },
    _add(k, n) { localStorage.setItem(k, String(Math.max(0, (parseInt(localStorage.getItem(k) || '0', 10) || 0) + n))); },
    glorps(n) { this._add('glorps', n); },
    books(n) { this._add('books', n); },
    dust(n) { this._add('dust', n); },
    fragments(n) { this._add('ultFragments', n); },
    towerBest(n) { this._add('tower_best', n); },
    unlockWeapons() { if (typeof ShopScene !== 'undefined') localStorage.setItem('unlockedWeapons', JSON.stringify(ShopScene.CATALOGUE.map(w => w.id))); },
    power(n) { if (typeof ShopScene !== 'undefined') for (const w of ShopScene.CATALOGUE) if (!WeaponLevels.NO_POWER.includes(w.id)) WeaponLevels.setLevel(w.id, Math.max(0, WeaponLevels.level(w.id) + n)); },
    // every story level cleared (and the elements they give), so the whole map is open
    unlockLevels() {
        if (typeof Progress !== 'undefined') for (const id of Progress.ORDER) localStorage.setItem('cleared_' + id, '1');
        for (const k of ['unlocked_lightning', 'unlocked_cosmic', 'unlocked_ice']) localStorage.setItem(k, 'true');
        for (const k of ['iceTutorialComplete', 'fireTutorialComplete']) localStorage.setItem(k, '1');
    },
    // the garden: every crop planted ripens now
    ripen() { if (typeof Garden === 'undefined') return; const s = Garden.state(); for (const p of s.plots) for (const c of p.cells) if (c) { c.watered = true; c.at = 1; } for (const p of s.orchard || []) if (p.tree) { p.at = 1; p.pick = 0; } Garden._set(s); },
    // the garden's events: worms in every growing bed; day and night swapped
    worms() { if (typeof Garden === 'undefined') return; const s = Garden.state(); for (const p of s.plots) if (p.cells.some(c => c)) { p.wormAt = 1; for (const c of p.cells) if (c && !Garden.watered(c)) { c.watered = true; c.at = Date.now(); c.dur = Garden.seed(c.seed).hrs * 3600000; } } Garden._set(s); },
    flipDay() { if (typeof Garden === 'undefined') return; const sh = +(localStorage.getItem('garden_tshift') || 0); localStorage.setItem('garden_tshift', String(sh + Garden.DAY_MS / 2)); },
    // the garden: time passes (every planted crop grows h hours)
    skip(h) { if (typeof Garden === 'undefined') return; const s = Garden.state(); for (const p of s.plots) for (const c of p.cells) if (c && Garden.watered(c)) c.at -= h * 3600000; for (const p of s.orchard || []) if (p.tree) { p.at -= h * 3600000; if (p.pick) p.pick -= h * 3600000; } Garden._set(s); },   // (a dry bed waits for water)
    // the garden, all of it: top tier and can, every rod, seed (a copy per plot), fish, hat, the Grove's seed, fertilizer
    garden() {
        if (typeof Garden === 'undefined') return;
        const s = Garden.state(); s.tier = Garden.TIERS.length - 1; s.can = Garden.CAN.length - 1; s.fert += 10; s.egg = true;
        s.rods = Garden.RODS.map(r => r.id); s.pets = Garden.PETS.map(p => p.id); s.pet ||= s.pets[0]; s.hats = [...Garden.HATS]; s.fishLog ||= {};
        for (const S of Garden.SEEDS) s.seeds[S.id] = Math.max(s.seeds[S.id] || 0, Garden.TIERS[s.tier].plots);
        for (const F of Garden.FISH) s.fishLog[F.id] = Math.max(1, s.fishLog[F.id] || 0);
        s.saplings ||= {}; for (const T of Garden.TREES) s.saplings[T.id] = Math.max(1, s.saplings[T.id] || 0);
        Garden._set(s); Garden.slots();
    },
    relics() { if (typeof Relics !== 'undefined') localStorage.setItem('relics_owned', JSON.stringify(Relics.all().map(r => r.id))); },
    // A legal build for a story level (DevBuilds.js): the save becomes what that player would own walking
    // in, levels before it cleared, the rest wiped (settings, garden and recorded runs kept).
    loadBuild(level, tier, n = 0) {
        const list = typeof DevBuilds !== 'undefined' && DevBuilds[level]?.[tier];
        if (!list?.length) return null;
        const b = list[n % list.length];
        for (const p of ['weapons', 'stats', 'ults', 'relics', 'enchants', 'tower', 'levels', 'glorps']) this.reset(p);
        const set = (k, v) => localStorage.setItem(k, String(v));
        const order = Progress.ORDER;
        for (const id of order.slice(0, order.indexOf(level))) set('cleared_' + id, '1');
        set('iceTutorialComplete', '1'); set('fireTutorialComplete', '1'); set('unlocked_ice', 'true');
        if (order.indexOf(level) > order.indexOf('gauntlet')) set('unlocked_lightning', 'true');
        if (order.indexOf(level) > order.indexOf('voidrift')) set('unlocked_cosmic', 'true');
        localStorage.setItem('unlockedWeapons', JSON.stringify(Object.values(b.held).filter(id => !ShopScene.CATALOGUE.find(w => w.id === id)?.defaultWeapon)));
        for (const [el, id] of Object.entries(b.held)) set('equip_' + el, id);
        for (const [id, lv] of Object.entries(b.levels)) WeaponLevels.setLevel(id, lv);
        for (const [id, lv] of Object.entries(b.stats)) PlayerStats.setLevel(id, lv);
        if (b.best) { set('tower_best', b.best); set('tower_entered', '1'); }
        localStorage.setItem('relics_owned', JSON.stringify(b.relics)); localStorage.setItem('relics_worn', JSON.stringify(b.relics));
        set('glorps', b.glorps); set('books', b.books); set('dust', b.dust); set('ultFragments', b.frags);
        if (typeof Enchants !== 'undefined') Enchants._cache = {};
        return b;
    },
    devMode() { return localStorage.getItem('devMode') === 'true'; },
    setDevMode(on) { if (on) localStorage.setItem('devMode', 'true'); else localStorage.removeItem('devMode'); },
};
