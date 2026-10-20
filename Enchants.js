// ═══════════════════════════════════════════════════════════════════════════
// Enchants.js — enchanted books, pulled like a gacha and put into weapons.
//
// Sealed books drop in the Tower (and Glurp sells them); unsealing one at the Isle (EnchantScene)
// costs dust and is a pull: a random
// enchant at a random rarity, level and quality, with pity (an Epic or better within
// PITY_EPIC pulls, a Legendary or better within PITY_LEG). Quality is pure luck (0-100, high
// rolls rare) and scales the effect from 70% to 130%. Two of the same book at the same level
// combine a level up, keeping the better quality.
//
// Every weapon has its own number of slots (SLOTS: the better weapons get more) and can't
// hold the same enchant twice. Each enchant belongs to a build (BUILDS) and some only fit
// some weapons: an element's own (burn, frost, storm), the ones with spread (True Aim), or any
// weapon that deals damage (not the cosmic buffs). The desk crosses out what doesn't fit.
//
// They act on that weapon's own hits: CombatSystem and the weapons ask with the weapon's id.
// Stored in localStorage: books (sealed), ench_books (the collection, [{id, lvl, q}]),
// ench_pity ({e, l}), ench_<weaponId> ([{id, lvl, q}]). Nothing here touches Phaser on load.
// ═══════════════════════════════════════════════════════════════════════════

const Enchants = {
    BOOK_PRICE: 300, PITY_EPIC: 25, PITY_LEG: 80,
    // Dust (the Isle's currency): unsealing a book costs UNSEAL; reforging a book's quality and
    // combining two cost by rarity; salvaging a book you don't want gives some back.
    UNSEAL: 40,
    REFORGE: [30, 60, 120, 250, 500, 0],
    COMBINE: [20, 40, 80, 160, 320, 0],
    SALVAGE: [10, 25, 60, 150, 400, 1500],
    RESEAL: [20, 35, 60, 100, 160, 250],   // dust to put a book back under its seal, by rarity (plus the 40 to unseal it again)
    RARITY: [
        { id: 'common',    name: 'COMMON',    col: 0xb8b8c8, w: 58,  cost: 80 },
        { id: 'rare',      name: 'RARE',      col: 0x4aa8ff, w: 27,  cost: 160 },
        { id: 'epic',      name: 'EPIC',      col: 0xb46aff, w: 11,  cost: 300 },
        { id: 'legendary', name: 'LEGENDARY', col: 0xffc23a, w: 3.5, cost: 500 },
        { id: 'mythic',    name: 'MYTHIC',    col: 0xff4a5a, w: 0.5, cost: 900 },
        { id: 'corrupted', name: 'CORRUPTED', col: 0x7aff5a, w: 0,   cost: 2000 },   // never by weight: CORRUPT_BASE, with soft pity
    ],
    // Corrupted: about 1 in 4000, and after CORRUPT_SOFT pulls without one the chance creeps up
    // CORRUPT_RAMP a pull (no guarantee, ever).
    CORRUPT_BASE: 0.0002, CORRUPT_SOFT: 600, CORRUPT_RAMP: 0.000006,
    // Rewriting one line of a corrupted book: sacrifice any one of these (about 140-200 pulls' worth each).
    REWRITE: [[1, 40], [2, 15], [3, 5], [4, 1]],   // [rarity, how many]
    // A corrupted book's curse: the price of its power. x is the size, fixed.
    CURSES: [
        { id: 'misfire', name: 'Misfire', x: 10, text: x => `${x}% of its hits miss.` },
        { id: 'fragile', name: 'Fragile', x: 20, text: x => `You take ${x}% more damage while you hold it.` },
        { id: 'leaden',  name: 'Leaden',  x: 15, text: x => `You move ${x}% slower while you hold it.` },
        { id: 'starved', name: 'Starved', x: 30, text: x => `Its hits charge your ult ${x}% less.` },
    ],
    // quality grades, by the lowest quality that earns them
    GRADES: [[101, 'CORRUPT', 0x7aff5a], [98, 'PERFECT', 0xff6ae0], [85, 'PRISTINE', 0xffd34a], [60, 'SUPERIOR', 0x7ae0c0], [25, 'FINE', 0xd2bf98], [0, 'FLAWED', 0x8a7a68]],
    // how many enchants each weapon holds: the starters 1, the better ones 2 or 3
    SLOTS: {
        flame_fists: 1, flame_sword: 2, magma_staff: 2, ignition: 3,
        ice_fists: 1, icicle_cannon: 2, fractal_shard: 3,
        lightning_fists: 2, orb_emitter: 2, ball_lightning: 3,
        cosmic_fists: 1, barrier_staff: 1, astrolabe: 2, singularity_staff: 2, void_blade: 2,
    },
    BUILDS: { CRIT: 0xffd34a, HUNTER: 0xe05a7a, BURN: 0xff8a3a, FROST: 0x7ad8ff, STORM: 0xffe85a, AIM: 0xc8d0e0, ULT: 0xd8a8ff, SUSTAIN: 0x8ae07a, CROWD: 0xff6a4a,
              TANK: 0xa8b8c8, SPEED: 0x8af0c8, REACT: 0xff7ae0, LUCK: 0x6ad86a },
    // weapons whose shots spread (True Aim): each scales its spread by Enchants.spread
    SPREAD: ['ignition', 'magma_staff', 'icicle_cannon', 'fractal_shard'],
    // r: rarity; max: top level; b: build; fit: 'dmg' (any weapon that deals damage, the
    // default), 'any', an element, or a list's name; v: the effect per level at quality 50;
    // text(x, lvl): x is v x level x quality.
    LIST: [
        { id: 'honed',       name: 'Honed',          r: 0, max: 5, b: 'CRIT',    v: 4,   text: x => `+${x}% damage.` },
        { id: 'keen',        name: 'Keen',           r: 0, max: 5, b: 'CRIT',    v: 2.5, text: x => `+${x}% chance to crit.` },
        { id: 'resonant',    name: 'Resonant',       r: 0, max: 4, b: 'ULT',     v: 6,   fit: 'any', text: x => `Its hits charge your ult ${x}% more.` },
        { id: 'bulwark',     name: 'Bulwark',        r: 1, max: 3, b: 'SUSTAIN', v: 4,   fit: 'any', text: x => `You take ${x}% less damage while you hold it.` },
        { id: 'bossbane',    name: 'Bossbane',       r: 1, max: 5, b: 'HUNTER',  v: 8,   text: x => `+${x}% damage to bosses and queens.` },
        { id: 'executing',   name: "Executioner's",  r: 1, max: 4, b: 'HUNTER',  v: 10,  text: x => `+${x}% damage to enemies under 30% health.` },
        { id: 'deadeye',     name: 'Deadeye',        r: 1, max: 3, b: 'CRIT',    v: 20,  text: x => `+${x}% damage to enemies at full health.` },
        { id: 'true_aim',    name: 'True Aim',       r: 1, max: 3, b: 'AIM',     v: 34,  fit: 'SPREAD', text: x => x >= 100 ? 'No spread: every shot flies dead straight.' : `${x}% less spread.` },
        { id: 'kindling',    name: 'Kindling',       r: 1, max: 3, b: 'BURN',    v: 6,   fit: 'fire', text: x => `${x}% of its hits apply a Burn stack.` },
        { id: 'frostbite',   name: 'Frostbite',      r: 1, max: 3, b: 'FROST',   v: 6,   fit: 'ice', text: x => `${x}% of its hits apply Chill.` },
        { id: 'static',      name: 'Static',         r: 1, max: 3, b: 'STORM',   v: 6,   fit: 'lightning', text: x => `${x}% of its hits jump to the nearest other enemy.` },
        { id: 'searing',     name: 'Searing',        r: 2, max: 3, b: 'BURN',    v: 10,  fit: 'fire', text: x => `+${x}% damage to enemies with Burn.` },
        { id: 'shatterpoint', name: 'Shatterpoint',  r: 2, max: 3, b: 'FROST',   v: 12,  fit: 'ice', text: x => `+${x}% damage to enemies with Chill or Brittle.` },
        { id: 'conductor',   name: 'Conductor',      r: 2, max: 3, b: 'STORM',   v: 15,  fit: 'lightning', text: x => `+${x}% damage to enemies standing in water.` },
        { id: 'overcharge',  name: 'Overcharged',    r: 2, max: 3, b: 'CRIT',    v: 20,  text: x => `Its crits hit ${x}% harder.` },
        { id: 'catalyst',    name: 'Catalyst',       r: 2, max: 3, b: 'ULT',     v: 15,  fit: 'any', text: x => `Reactions with it charge your ult ${x}% more.` },
        { id: 'devastation', name: 'Devastation',   r: 2, max: 3, b: 'ULT',     v: 10,  fit: 'any', text: x => `Its element's ult deals +${x}% damage.` },
        { id: 'vampiric',    name: 'Vampiric',       r: 2, max: 3, b: 'SUSTAIN', v: 1,   fit: 'any', text: x => `Kills while you hold it heal ${x} HP.` },
        { id: 'rhythm',      name: 'Rhythm',         r: 3, max: 2, b: 'CRIT',    v: 1,   text: (x, l, n) => `Every ${n}th hit is a crit.` },
        { id: 'volatile',    name: 'Volatile',       r: 3, max: 2, b: 'CROWD',   v: 8,   text: x => `Its kills burst, hitting everything close for ${x}.` },
        // Legendaries that give every build something to chase at the top...
        { id: 'juggernaut',  name: 'Juggernaut',     r: 3, max: 2, b: 'TANK',    v: 1.5, text: x => `Its hits deal ${x}% of your max HP on top.` },
        { id: 'slipstream',  name: 'Slipstream',     r: 3, max: 2, b: 'SPEED',   v: 40,  text: x => `After a dash, its next 3 hits deal +${x}%.` },
        { id: 'chain_reaction', name: 'Chain Reaction', r: 3, max: 2, b: 'REACT', v: 10, text: x => `Its reactions burst on everything close for ${x}.` },
        { id: 'sanguine',    name: 'Sanguine',       r: 3, max: 2, b: 'SUSTAIN', v: 1.5, text: x => `Heals ${x}% of its hit damage, bosses too (at most 6% of your max HP a second).` },
        { id: 'arc_lord',    name: 'Arc Lord',       r: 3, max: 2, b: 'STORM',   v: 20,  fit: 'lightning', text: x => `+${x}% damage to enemies with Superconducted.` },
        { id: 'loaded',      name: 'Loaded',         r: 3, max: 2, b: 'LUCK',    v: 6,   text: x => `+1 Luck a crit, up to ${Math.round(x)}. All of it goes when you're hit.` },
        // ...and bridges: each half weaker than a pure book, and only good if you run both builds
        { id: 'iron_edge',   name: 'Iron Edge',      r: 3, max: 2, b: 'TANK',  b2: 'CRIT',    v: 50, fit: 'any', text: x => `Your thorns crit twice as often, with +${x}% crit damage.` },
        { id: 'kinetic_core', name: 'Kinetic Core',  r: 3, max: 2, b: 'SPEED', b2: 'ULT',     v: 3,  fit: 'any', text: x => `Every 10 tiles you move charge your ult ${x}% of a gem.` },
        { id: 'bloodletter', name: 'Bloodletter',    r: 3, max: 2, b: 'SUSTAIN', b2: 'CRIT',  v: 3,  text: x => `Its crits heal ${x}% of their damage (at most 6% of your max HP a second).` },
        { id: 'fortunes_edge', name: "Fortune's Edge", r: 3, max: 2, b: 'LUCK', b2: 'CRIT',   v: 0.4, text: x => `+${x}% crit chance for every point of Luck.` },
        { id: 'last_stand',  name: 'Last Stand',     r: 3, max: 2, b: 'HUNTER', b2: 'TANK',   v: 30, text: x => `Up to +${x}% damage to bosses and queens, more the lower your HP.` },
        { id: 'earthshaker', name: 'Earthshaker',   r: 3, max: 2, b: 'ULT',   b2: 'TANK',    v: 2,  fit: 'any', text: x => `Its element's ult hits add ${x}% of your max HP.` },
        { id: 'contagion',   name: 'Contagion',      r: 3, max: 2, b: 'CROWD', b2: 'BURN',    v: 50, text: x => `Its kills pass ${x}% of their Burn and Chill to the nearest enemy.` },
        { id: 'worldbreaker', name: 'Worldbreaker',  r: 4, max: 1, b: 'CRIT',    v: 25,  text: x => `+${x}% damage, +${Math.round(x * 0.4)}% crit, and its crits hit twice as hard.` },
        // Mythic specials: a mythic book carries one of these and two ordinary properties.
        { id: 'everflame',   name: 'Everflame',      r: 4, max: 1, b: 'BURN',    v: 15,  text: x => `${x}% of its hits add a touch of their element.` },
        { id: 'unbreakable', name: 'Unbreakable',    r: 4, max: 1, b: 'TANK',    v: 30,  fit: 'any', text: x => `Once every 30s, a killing blow leaves you on 1 HP and blasts what's close for ${x}.` },
        { id: 'elemental_fusion', name: 'Elemental Fusion', r: 4, max: 1, b: 'REACT', v: 40, fit: 'any', text: x => `Its reactions also charge another element's gem (${x}% as much).` },
        { id: 'titan_pact',  name: "Titan's Pact",   r: 4, max: 1, b: 'SUSTAIN', v: 20,  fit: 'any', text: x => `Ults charge ${x}% faster and you take ${Math.round(x / 2)}% less damage while you hold it.` },
        // Corrupted specials: nothing else does these. A corrupted book carries one, three
        // ordinary properties and a curse.
        { id: 'twinstrike',  name: 'Twinstrike',     r: 5, max: 1, b: 'CRIT',    v: 15,  text: x => `${x}% of its hits strike twice.` },
        { id: 'bloodpact',   name: 'Bloodpact',      r: 5, max: 1, b: 'ULT',     v: 40,  fit: 'any', text: x => `Damage you take charges your ult (${x}% as much as a hit would).` },
        { id: 'prism',       name: 'Prism',          r: 5, max: 1, b: 'CROWD',   v: 12,  text: x => `${x}% of its hits add another element's touch.` },
        { id: 'reckoning',   name: 'Reckoning',      r: 5, max: 1, b: 'HUNTER',  v: 50,  text: x => `Up to +${x}% damage, more the lower your HP.` },
    ],

    _get(k, d) { try { return JSON.parse(localStorage.getItem(k) || d); } catch (e) { return JSON.parse(d); } },
    _set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} },
    def(id) { return this.LIST.find(e => e.id === id) || null; },
    rarity(id) { return this.RARITY[this.def(id)?.r ?? 0]; },
    roman(n) { return ['', 'I', 'II', 'III', 'IV', 'V'][n] || String(n); },
    grade(q) { const [, name, col] = this.GRADES.find(([at]) => q >= at); return { name, col }; },
    // quality 0-100 -> how strong: 70% at 0, 100% at 50, 130% at 100
    scale(q) { return 0.7 + 0.6 * (q ?? 50) / 100; },
    // a book's number: v x level x quality (rounded the way its text shows it)
    x(b) { const d = this.def(b.id), v = d.v * b.lvl * this.scale(b.q); return v >= 10 ? Math.round(v) : Math.round(v * 10) / 10; },
    _line(b) { const d = this.def(b.id); return d.text(d.id === 'true_aim' ? Math.min(100, Math.round(this.x(b))) : this.x(b), b.lvl, this._every(b)); },
    // A book's lines: what it does (a mythic or corrupted one: its special, then its other
    // properties at the book's quality, then a corrupted one's curse).
    lines(b) {
        const out = [this._line(b)];
        for (const p of (b.props || [])) out.push(this._line({ id: p.id, lvl: p.lvl, q: b.q }));
        if (b.curse) { const c = this.curse(b.curse); out.push('CURSE: ' + c.text(c.x)); }
        return out;
    },
    describe(b) { return this.lines(b).join(' '); },
    curse(id) { return this.CURSES.find(c => c.id === id); },
    _every(b) { return Math.max(4, Math.round((b.lvl >= 2 ? 6 : 8) / this.scale(b.q))); },   // Rhythm: better quality, fewer hits between crits
    element(weapon) { return (typeof ShopScene !== 'undefined' && ShopScene.CATALOGUE?.find(w => w.id === weapon)?.element) || null; },
    // Does it work on this weapon?
    fits(id, weapon) {
        const d = this.def(id), fit = d?.fit || 'dmg';
        if (!d || !weapon) return false;
        if (fit === 'any') return true;
        if (fit === 'dmg') return !(typeof WeaponLevels !== 'undefined' && WeaponLevels.NO_POWER.includes(weapon));
        if (Array.isArray(this[fit])) return this[fit].includes(weapon);
        return this.element(weapon) === fit;
    },
    fitsText(id) {
        const fit = this.def(id)?.fit || 'dmg';
        if (fit === 'any') return 'any weapon';
        if (fit === 'dmg') return 'any weapon that deals damage';
        if (Array.isArray(this[fit])) return this[fit].map(w => (typeof ShopScene !== 'undefined' && ShopScene.CATALOGUE?.find(c => c.id === w)?.name) || w).join(', ');
        return fit + ' weapons';
    },
    // what putting a book in costs: its rarity's price, a quarter more per level past I
    cost(b) { return Math.round(this.rarity(b.id).cost * (1 + 0.25 * (b.lvl - 1))); },

    // ── BOOKS ─────────────────────────────────────────────────────────────────
    books() { try { return Math.max(0, parseInt(localStorage.getItem('books') || '0', 10) || 0); } catch (e) { return 0; } },
    addBooks(n) { try { localStorage.setItem('books', String(this.books() + n)); } catch (e) {} },
    _book(b) {
        if (!b || !this.def(b.id)) return null;
        const o = { id: b.id, lvl: b.lvl || 1, q: b.q ?? 50 };
        if (b.props) o.props = b.props.filter(p => this.def(p.id));
        if (b.curse) o.curse = b.curse;
        return o;
    },
    // the ordinary properties a mythic or corrupted book draws from: ones that fit any damage weapon
    _basicPool() { return this.LIST.filter(d => d.r <= 3 && (!d.fit || d.fit === 'dmg' || d.fit === 'any')); },
    _rollProps(n, rnd, not = []) {
        const out = [], pool = this._basicPool().filter(d => !not.includes(d.id));
        while (out.length < n && pool.length) {
            const d = pool.splice(Math.floor(rnd() * pool.length), 1)[0];
            let lvl = 1; while (lvl < d.max && rnd() < 0.5) lvl++;
            out.push({ id: d.id, lvl });
        }
        return out;
    },
    collection() { return this._get('ench_books', '[]').map(b => this._book(b)).filter(Boolean); },
    _keep(list) { this._set('ench_books', list); },
    pity() { return Object.assign({ e: 0, l: 0, c: 0 }, this._get('ench_pity', '{}')); },
    // the codex: every enchant you've ever pulled (and any you hold, for saves from before it)
    seen() {
        const s = new Set(this._get('ench_seen', '[]'));
        for (const b of this.collection()) s.add(b.id);
        for (const k of Object.keys(localStorage)) if (k.startsWith('ench_') && !['ench_books', 'ench_pity', 'ench_seen'].includes(k)) for (const b of this._get(k, '[]')) if (b?.id || typeof b === 'string') s.add(b.id || b);
        return s;
    },
    _see(id) { const s = this._get('ench_seen', '[]'); if (!s.includes(id)) { s.push(id); this._set('ench_seen', s); } },
    corruptChance(p = this.pity()) { return this.CORRUPT_BASE + Math.max(0, p.c - this.CORRUPT_SOFT) * this.CORRUPT_RAMP; },
    dust() { try { return Math.max(0, parseInt(localStorage.getItem('dust') || '0', 10) || 0); } catch (e) { return 0; } },
    addDust(n) { try { localStorage.setItem('dust', String(Math.max(0, this.dust() + Math.round(n)))); } catch (e) {} },
    // what salvaging a book gives: its rarity's dust, more for a higher level and a better quality
    salvageValue(b) { return Math.round(this.SALVAGE[this.def(b.id).r] * b.lvl * (0.6 + 0.8 * b.q / 100)); },
    salvage(i) {
        const list = this.collection(), b = list[i];
        if (!b) return 0;
        const v = this.salvageValue(b);
        this._keep(list.filter((_, k) => k !== i));
        this.addDust(v);
        return v;
    },
    // Every book matching keep-not (by default Commons under 30%) to dust. Returns the dust.
    salvageWhere(test) {
        const list = this.collection(), go = list.filter(test);
        const v = go.reduce((a, b) => a + this.salvageValue(b), 0);
        this._keep(list.filter(b => !test(b)));
        this.addDust(v);
        return { n: go.length, dust: v };
    },
    // A new quality for book i, for dust: a gamble, the new roll replaces the old even when it's worse. Returns { rolled, q, was } or null.
    reforge(i, rnd = Math.random) {
        const list = this.collection(), b = list[i], cost = b && this.REFORGE[this.def(b.id).r];
        if (!b || this.def(b.id).r === 5 || this.dust() < cost) return null;   // a corrupted book is rewritten instead
        this.addDust(-cost);
        const rolled = Math.min(100, Math.floor(Math.pow(rnd(), 3) * 101)), was = b.q;   // high rolls rare: about 5% land 85+, under 1% 98+
        b.q = rolled;
        this._keep(list);
        return { rolled, q: b.q, was };
    },

    // One pull: a rarity (pity first), an enchant of it, a level (low ones likelier) and a
    // quality (high ones rarer: about 6% roll 90+). The sealed book is spent and the opened
    // one goes into the collection. null: no sealed book.
    open(rnd = Math.random) {
        if (this.books() < 1 || this.dust() < this.UNSEAL) return null;
        this.addDust(-this.UNSEAL);
        const p = this.pity();
        let r;
        if (rnd() < this.corruptChance(p)) r = 5;
        else if (p.l + 1 >= this.PITY_LEG) r = rnd() < 0.12 ? 4 : 3;
        else if (p.e + 1 >= this.PITY_EPIC) r = 2 + (rnd() < 0.3 ? 1 : 0);
        else {
            let x = rnd() * this.RARITY.reduce((a, q) => a + q.w, 0);
            r = this.RARITY.findIndex(q => (x -= q.w) < 0);
            if (r < 0) r = 0;
        }
        const pool = this.LIST.filter(d => d.r === r);
        const d = pool[Math.floor(rnd() * pool.length)];
        let lvl = 1;
        while (lvl < d.max && rnd() < 0.4) lvl++;
        // quality: a corrupted book's runs 60-150, past what any other can reach
        const q = r === 5 ? 60 + Math.floor(Math.pow(rnd(), 1.4) * 91) : Math.min(100, Math.floor(Math.pow(rnd(), 3) * 101));
        this._set('ench_pity', { e: r >= 2 ? 0 : p.e + 1, l: r >= 3 ? 0 : p.l + 1, c: r === 5 ? 0 : p.c + 1 });
        this.addBooks(-1);
        const b = { id: d.id, lvl, q };
        this._see(d.id);
        if (r === 4) b.props = this._rollProps(2, rnd);
        if (r === 5) { b.props = this._rollProps(3, rnd); b.curse = this.CURSES[Math.floor(rnd() * this.CURSES.length)].id; }
        this._keep([...this.collection(), b]);
        return b;
    },
    // Rewrite line `line` of corrupted book i (0: its special, 1-3: its properties, 'curse'),
    // sacrificing the worst `n` books of rarity `r` you hold (REWRITE). Returns what it became or null.
    canRewrite(i, r) {
        const list = this.collection(), cost = this.REWRITE.find(([rr]) => rr === r);
        return !!cost && this.def(list[i]?.id)?.r === 5 && list.filter((b, k) => k !== i && this.def(b.id).r === r).length >= cost[1];
    },
    rewrite(i, line, r, rnd = Math.random) {
        if (!this.canRewrite(i, r)) return null;
        let list = this.collection();
        const b = list[i], n = this.REWRITE.find(([rr]) => rr === r)[1];
        const victims = list.map((x, k) => ({ x, k })).filter(({ x, k }) => k !== i && this.def(x.id).r === r).sort((a, c) => a.x.q - c.x.q).slice(0, n).map(v => v.k);
        if (line === 'curse') { const others = this.CURSES.filter(c => c.id !== b.curse); b.curse = others[Math.floor(rnd() * others.length)].id; }
        else if (line === 0) { const others = this.LIST.filter(d => d.r === 5 && d.id !== b.id); b.id = others[Math.floor(rnd() * others.length)].id; }
        else { const keep = b.props.filter((_, k) => k !== line - 1).map(p => p.id); b.props[line - 1] = this._rollProps(1, rnd, [...keep, b.props[line - 1].id])[0]; }
        list = list.filter((_, k) => !victims.includes(k));
        this._keep(list);
        return b;
    },

    // Book i and the worst other copy of it (same enchant, same level) -> one, a level up,
    // with the better of their qualities. Returns the new book or null.
    combine(i) {
        const list = this.collection(), a = list[i], d = a && this.def(a.id);
        if (!d || a.lvl >= d.max) return null;
        const j = list.reduce((best, b, k) => (k !== i && b.id === a.id && b.lvl === a.lvl && (best < 0 || b.q < list[best].q) ? k : best), -1);
        if (j < 0 || this.dust() < this.COMBINE[d.r]) return null;
        this.addDust(-this.COMBINE[d.r]);
        const b = { id: a.id, lvl: a.lvl + 1, q: Math.max(a.q, list[j].q) };
        this._keep([...list.filter((_, k) => k !== i && k !== j), b]);
        return b;
    },
    // Combining at the Twin Pools: two or more copies of one book at one level. The more quality
    // you pour in, the likelier it takes: 15% + the copies' total quality / 250 (two at 50%: 55%,
    // two at 100%: 95%, three at 50%: 75%), 95% at most. It takes: one book a level up, at the best
    // quality of them. It fails: the worst copy is lost, the rest come back. Costs the dust either way.
    combineChance(idx, list = this.collection()) { return Math.min(0.95, 0.15 + idx.reduce((a, i) => a + (list[i]?.q || 0), 0) / 250); },
    canCombineMany(idx, list = this.collection()) {
        const bs = idx.map(i => list[i]), a = bs[0], d = a && this.def(a.id);
        return idx.length >= 2 && new Set(idx).size === idx.length && !!d && d.r !== 5 && a.lvl < d.max && bs.every(b => b && b.id === a.id && b.lvl === a.lvl);
    },
    combineMany(idx, rnd = Math.random) {
        const list = this.collection();
        if (!this.canCombineMany(idx, list)) return null;
        const d = this.def(list[idx[0]].id), cost = this.COMBINE[d.r];
        if (this.dust() < cost) return null;
        this.addDust(-cost);
        const chance = this.combineChance(idx, list), ok = rnd() < chance;
        if (ok) {
            const b = { id: d.id, lvl: list[idx[0]].lvl + 1, q: Math.max(...idx.map(i => list[i].q)) };
            this._keep([...list.filter((_, k) => !idx.includes(k)), b]);
            return { ok, chance, book: b };
        }
        const worst = idx.reduce((w, i) => (list[i].q < list[w].q ? i : w), idx[0]), lost = list[worst];
        this._keep(list.filter((_, k) => k !== worst));
        return { ok, chance, lost };
    },
    // Reseal: a book back under its seal, for a fresh pull later (+1 sealed book)
    reseal(i) {
        const list = this.collection(), cost = list[i] && this.RESEAL[this.def(list[i].id).r];
        if (!list[i] || this.dust() < cost) return false;
        this.addDust(-cost);
        this._keep(list.filter((_, k) => k !== i));
        this.addBooks(1);
        return true;
    },
    canCombine(i, list = this.collection()) {
        const a = list[i];
        return !!a && a.lvl < this.def(a.id).max && list.some((b, k) => k !== i && b.id === a.id && b.lvl === a.lvl);
    },

    // ── WEAPONS ───────────────────────────────────────────────────────────────
    // Read on every hit, so kept in memory; put/take are the only ways it changes. (Before the
    // books an enchant was stored as its id alone: those read as level III, quality 50.)
    _cache: {},
    on(weapon) {
        if (!weapon) return [];
        return this._cache[weapon] ??= this._get('ench_' + weapon, '[]').map(x => this._book(typeof x === 'string' ? { id: x, lvl: 3 } : x)).filter(Boolean);
    },
    slots(weapon) { return this.SLOTS[weapon] ?? 1; },
    // the enchants that act: no more than the weapon's slots
    _live(weapon) { return this.on(weapon).slice(0, this.slots(weapon)); },
    // Why a book can't go in (or null): it doesn't fit, the weapon has that enchant, no free slot.
    blocked(weapon, b) {
        if (!this.fits(b.id, weapon)) return 'fit';
        const cur = this.on(weapon);
        if (cur.some(x => x.id === b.id)) return 'dupe';
        if (this.def(b.id).r === 5 && cur.some(x => this.def(x.id).r === 5)) return 'corrupt';   // one corrupted book per weapon
        if (cur.length >= this.slots(weapon)) return 'full';
        return null;
    },
    // Book i of the collection into the weapon (the caller has checked and takes the glorps).
    put(weapon, i) {
        const list = this.collection(), b = list[i];
        if (!b || this.blocked(weapon, b)) return false;
        this._keep(list.filter((_, k) => k !== i));
        this._set('ench_' + weapon, this._cache[weapon] = [...this.on(weapon), b]);
        return true;
    },
    // Unbinding: the enchant in slot i is torn out of the weapon. It costs glorps (twice what binding
    // it did), the book itself is gone, and what comes out is its essence: a sealed book (a fresh pull)
    // and dust (what salvaging it would give). Returns { book, dust, cost } or null (the caller checks the glorps).
    unbindCost(b) { return this.cost(b) * 2; },
    unbind(weapon, i) {
        const cur = this.on(weapon), b = cur[i];
        if (!b) return null;
        this._set('ench_' + weapon, this._cache[weapon] = cur.filter((_, k) => k !== i));
        const dust = this.salvageValue(b);
        this.addBooks(1); this.addDust(dust);
        return { book: b, dust, cost: this.unbindCost(b) };
    },
    // The book in slot i back into the collection.
    take(weapon, i) {
        const cur = this.on(weapon), b = cur[i];
        if (!b) return null;
        this._set('ench_' + weapon, this._cache[weapon] = cur.filter((_, k) => k !== i));
        this._keep([...this.collection(), b]);
        return b;
    },

    // ── EFFECTS (CombatSystem, the weapons) ───────────────────────────────────
    // the weapon's number for an enchant (0 if it hasn't got it)
    n(weapon, id) {
        if (!weapon) return 0;
        let v = 0;
        for (const b of this._live(weapon)) {
            if (b.id === id) v += this.x(b);
            for (const p of (b.props || [])) if (p.id === id) v += this.x({ id: p.id, lvl: p.lvl, q: b.q });
        }
        return v;
    },
    cursed(weapon, id) { const b = weapon && this._live(weapon).find(x => x.curse === id); return b ? this.curse(id).x : 0; },
    corrupted(weapon) { return !!weapon && this._live(weapon).some(b => this.def(b.id).r === 5); },
    // `enemy` null is a boss or queen hit (their paths pass none); `scene` for water.
    dmgMult(weapon, enemy, scene = null) {
        if (!weapon || !this._live(weapon).length) return 1;
        const p = id => this.n(weapon, id) / 100;
        let m = (1 + p('honed')) * (1 + p('worldbreaker'));
        const low = scene?.maxHealth ? 1 - scene.health / scene.maxHealth : 0;
        if (!enemy || enemy.isBoss) return m * (1 + p('bossbane')) * (1 + p('last_stand') * low);   // Last Stand: bosses, the lower you are
        if (enemy.maxHealth && enemy.health / enemy.maxHealth < 0.3) m *= 1 + p('executing');
        if (enemy.maxHealth && enemy.health >= enemy.maxHealth) m *= 1 + p('deadeye');
        if (enemy.burnStacks > 0) m *= 1 + p('searing');
        if (enemy.isFrozen || enemy._iceCube || enemy.chillStacks > 0) m *= 1 + p('shatterpoint');
        if (scene?.isWaterAt?.(enemy.x, enemy.y)) m *= 1 + p('conductor');
        if (enemy.isSuperConducted) m *= 1 + p('arc_lord');
        if (scene?.maxHealth) m *= 1 + p('reckoning') * (1 - scene.health / scene.maxHealth);   // Reckoning: stronger the lower you are
        return m;
    },
    crit(weapon, luck = 0) { return (this.n(weapon, 'keen') + this.n(weapon, 'worldbreaker') * 0.4 + this.n(weapon, 'fortunes_edge') * luck) / 100; },
    critMult(weapon) { return this.n(weapon, 'overcharge') / 100 + (this.n(weapon, 'worldbreaker') ? 0.5 : 0); },
    ult(weapon) { return (1 + (this.n(weapon, 'resonant') + this.n(weapon, 'titan_pact')) / 100) * (1 - this.cursed(weapon, 'starved') / 100); },
    react(weapon) { return 1 + this.n(weapon, 'catalyst') / 100; },
    taken(weapon) { return Math.max(0.5, 1 - (this.n(weapon, 'bulwark') + this.n(weapon, 'titan_pact') / 2) / 100) * (1 + this.cursed(weapon, 'fragile') / 100); },
    speed(weapon) { return 1 + this.cursed(weapon, 'leaden') / 100; },   // a move-cooldown multiplier (Leaden)
    miss(weapon) { return this.cursed(weapon, 'misfire') / 100; },
    twin(weapon) { return this.n(weapon, 'twinstrike') / 100; },
    prism(weapon) { return this.n(weapon, 'prism') / 100; },
    bloodpact(weapon) { return this.n(weapon, 'bloodpact') / 100; },
    spread(weapon) { return Math.max(0, 1 - this.n(weapon, 'true_aim') / 100); },
    leech(weapon) { return Math.round(this.n(weapon, 'vampiric')); },
    // the chance a hit adds its element's touch (Kindling, Frostbite, Static: each fits only its element)
    proc(weapon) { return (this.n(weapon, 'kindling') + this.n(weapon, 'frostbite') + this.n(weapon, 'static') + this.n(weapon, 'everflame')) / 100; },
    rhythm(weapon) { const b = weapon && this._live(weapon).find(x => x.id === 'rhythm'); return b ? this._every(b) : 0; },
    volatile(weapon) { return this.n(weapon, 'volatile'); },
};
