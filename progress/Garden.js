// ═══════════════════════════════════════════════════════════════════════════
// Garden.js — the Dust Garden on the Enchanter's Isle (GardenScene walks it).
//
// Seeds drop in the Tower. A seed is a copy you own, never used up: planting puts a copy to work,
// harvesting gives it back. A second copy of a seed lets you grow two plots of it at once; copies
// past your plot count turn into dust. A ripe crop gives dust (well under what the Tower pays) and
// banks its blessing for your next Tower climb: different crops stack, the same one doesn't, and
// the garden's tier caps how many you can bank. Nothing withers: a ripe crop just waits.
//
// The garden shop sells, for glorps: the rake (more plots, each tier opened by a best Tower floor),
// the watering can (faster growth), fertilizer (a plot's next harvest doubled).
// Stored in localStorage `garden2`. Nothing here touches Phaser.
// ═══════════════════════════════════════════════════════════════════════════

const Garden = {
    // t: tier (which floors drop it), hrs to ripen, dust a harvest, col: its crystals' colour,
    // the blessing it banks (m: what it adds to scene._mods for the climb)
    SEEDS: [
        // t: tier (1-3 the Tower's floors; 0 found, not dropped), src: where it comes from, shape: its crop's look
        { id: 'sprout',     name: 'Dust Sprout',    t: 1, src: 'tower', shape: 'crystal',  hrs: 0.25,  dust: 12, col: 0x8affd8, bless: 'Sharp',      m: { dmg: 1.03 },    text: '+3% damage' },
        { id: 'glowroot',   name: 'Glowroot',       t: 1, src: 'tower', shape: 'bulb',     hrs: 0.25,  dust: 12, col: 0x9aff8a, bless: 'Hardy',      m: { hp: 10 },       text: '+10 max HP' },
        { id: 'mossbell',   name: 'Mossbell',       t: 1, src: 'tower', shape: 'flower', time: 'day',   hrs: 0.4,  dust: 14, col: 0xc8f08a, bless: 'Mending',    m: { heal: 0.05 },   text: 'cleared floors heal 5% more' },
        { id: 'starbloom',  name: 'Starbloom',      t: 2, src: 'tower', shape: 'flower', time: 'night',   hrs: 1,  dust: 45, col: 0xffe08a, bless: 'Lucky',      m: { crit: 0.02 },   text: '+2% crit chance' },
        { id: 'frostfern',  name: 'Frostfern',      t: 2, src: 'tower', shape: 'fern', time: 'night',     hrs: 1,  dust: 45, col: 0x9ad8ff, bless: 'Quickened',  m: { ult: 1.06 },    text: 'ults charge 6% faster' },
        { id: 'sunpetal',   name: 'Sunpetal',       t: 2, src: 'tower', shape: 'spire', time: 'day',    hrs: 1.5,  dust: 50, col: 0xffb86a, bless: 'Kindled',    m: { react: 1.08 },  text: 'reactions charge 8% more' },
        { id: 'emberheart', name: 'Emberheart',     t: 3, src: 'tower', shape: 'orb', time: 'day',      hrs: 3,  dust: 90, col: 0xff9a6a, bless: 'Fleet',      m: { speed: 0.96 },  text: 'move 4% faster' },
        { id: 'voidlily',   name: 'Void Lily',      t: 3, src: 'tower', shape: 'lotus', time: 'night',    hrs: 3,  dust: 90, col: 0xd8a8ff, bless: 'Prosperous', m: { pay: 1.05 },    text: 'Tower floors pay 5% more' },
        { id: 'nebulorchid', name: 'Nebula Orchid', t: 3, src: 'tower', shape: 'spire', time: 'night',    hrs: 3.5,  dust: 100, col: 0xb07aff, bless: 'Thunderous', m: { ultDmg: 1.05 }, text: 'ults deal 5% more damage' },
        { id: 'puffcap',    name: 'Puffcap',        t: 1, src: 'tower', shape: 'mushroom', hrs: 0.25,  dust: 13, col: 0xffb8d8, bless: 'Padded',     m: { taken: 0.98 },  text: 'take 2% less damage' },
        { id: 'twinklegrass', name: 'Twinkle Grass', t: 1, src: 'tower', shape: 'grass', time: 'night', hrs: 0.4, dust: 14, col: 0xd8e8ff, bless: 'Glinting', m: { crit: 0.015 }, text: '+1.5% crit chance' },
        { id: 'bubblewort', name: 'Bubblewort',     t: 2, src: 'tower', shape: 'bubble',   hrs: 1,  dust: 48, col: 0x9ae8ff, bless: 'Buoyant',    m: { speed: 0.97 },  text: 'move 3% faster' },
        { id: 'pinwheel',   name: 'Pinwheel Poppy', t: 2, src: 'tower', shape: 'flower', time: 'day', hrs: 1.5, dust: 50, col: 0xff6a8a, bless: 'Whirling',  m: { ult: 1.05 },    text: 'ults charge 5% faster' },
        { id: 'emberpepper', name: 'Ember Pepper',  t: 2, src: 'tower', shape: 'pepper', time: 'day', hrs: 1, dust: 46, col: 0xff5a3a, bless: 'Spicy',     m: { dmg: 1.02, react: 1.03 }, text: '+2% damage, reactions charge 3% more' },
        { id: 'eyestalk',   name: 'Eyestalk',       t: 3, src: 'tower', shape: 'stalk', time: 'night', hrs: 3.5, dust: 95, col: 0x9aff6a, bless: 'Watchful',  m: { crit: 0.025 },  text: '+2.5% crit chance' },
        { id: 'galaxygourd', name: 'Galaxy Gourd',  t: 3, src: 'tower', shape: 'gourd',    hrs: 4, dust: 110, col: 0x6a6aff, bless: 'Spiralled', m: { ultDmg: 1.04, ult: 1.03 }, text: 'ults deal 4% more and charge 3% faster' },
        // the river's and the lake's own: only fishing brings these up
        { id: 'tidelotus',  name: 'Tide Lotus',     t: 0, src: 'river', shape: 'lotus', time: 'day',    hrs: 2,  dust: 55, col: 0x7ad8ff, bless: 'Thirsty',    m: { leech: 1 },     text: 'kills heal 1 HP' },
        { id: 'reedwhistle', name: 'Reedwhistle',   t: 0, src: 'river', shape: 'reed', time: 'day', hrs: 1.5, dust: 40, col: 0xc8a86a, bless: 'Steady',     m: { hp: 15 },       text: '+15 max HP' },
        { id: 'lanternlily', name: 'Lantern Lily',  t: 0, src: 'river', shape: 'lotus', time: 'night', hrs: 2.5, dust: 60, col: 0xffe08a, bless: 'Lit',       m: { heal: 0.04 },   text: 'cleared floors heal 4% more' },
        { id: 'coralfan',   name: 'Coral Fan',      t: 0, src: 'lake',  shape: 'coral',    hrs: 3.5,  dust: 75, col: 0xff8a9a, bless: 'Reefed',     m: { taken: 0.98, hp: 5 }, text: 'take 2% less damage, +5 max HP' },
        { id: 'moonmelon',  name: 'Moonmelon',      t: 0, src: 'lake',  shape: 'melon', time: 'night', hrs: 4, dust: 85, col: 0xd8f0a0, bless: 'Ripened',  m: { pay: 1.04 },    text: 'Tower floors pay 4% more' },
        { id: 'pearlkelp',  name: 'Pearl Kelp',     t: 0, src: 'lake',  shape: 'fern',     hrs: 3,  dust: 70, col: 0xe8f0ff, bless: 'Pearled',    m: { taken: 0.97 },  text: 'take 3% less damage' },
        { id: 'abyssbloom', name: 'Abyssbloom',     t: 0, src: 'lake',  shape: 'mushroom', hrs: 5, dust: 120, col: 0x5a7aff, bless: 'Deep',      m: { luckBase: 1 },  text: '+1 Luck (a trophy)' },
        // the Underwell's own (the cosmic fluid under the Isle): only its fishing brings these up
        { id: 'cosmicseed', name: 'Cosmic Seed',    t: 0, src: 'cosmic', shape: 'orb',     hrs: 6, dust: 180, col: 0xb07aff, bless: 'Astral',     m: { ultDmg: 1.06, ult: 1.04 }, text: 'ults deal 6% more and charge 4% faster' },
        { id: 'corruptseed', name: 'Corrupted Seed', t: 0, src: 'cosmic', shape: 'mushroom', hrs: 8, dust: 220, col: 0x7aff5a, bless: 'Corrupted', m: { dmg: 1.08, taken: 1.06 }, text: '+8% damage, but take 6% more', corrupt: true },
        { id: 'starvine',   name: 'Starvine',       t: 0, src: 'cosmic', shape: 'vine',    hrs: 6, dust: 190, col: 0xfff0a0, bless: 'Starlit',    m: { crit: 0.02, ultDmg: 1.03 }, text: '+2% crit chance, ults deal 3% more' },
        { id: 'riftroot',   name: 'Riftroot',       t: 0, src: 'cosmic', shape: 'rift',    hrs: 7, dust: 210, col: 0xff6ae0, bless: 'Riven',      m: { react: 1.1 },   text: 'reactions charge 10% more' },
        // the mud patch's own
        // the Cloud Sea's own (up the trampoline): only its fishing brings these down
        { id: 'cloudcotton', name: 'Cloud Cotton',  t: 0, src: 'sky',   shape: 'bubble',   hrs: 4,  dust: 130, col: 0xf0f4ff, bless: 'Airy',      m: { speed: 0.97, taken: 0.98 }, text: 'move 3% faster, take 2% less damage' },
        { id: 'skybloom',   name: 'Sky Bloom',      t: 0, src: 'sky',   shape: 'flower', time: 'day', hrs: 4.5, dust: 150, col: 0x8ac8ff, bless: 'Windborne', m: { crit: 0.02, ult: 1.04 }, text: '+2% crit chance, ults charge 4% faster' },
        { id: 'bogbean',    name: 'Bogbean',        t: 0, src: 'mud',   shape: 'bean',     hrs: 2,  dust: 50, col: 0x8a9a4a, bless: 'Boggy',      m: { leech: 1 },     text: 'kills heal 1 HP' },
        // earned, never dropped: each is a gold achievement's reward (Achievements.js)
        { id: 'stubthistle', name: 'Stubborn Thistle', t: 0, src: 'feat', feat: 'stubborn3', shape: 'stalk', hrs: 5, dust: 140, col: 0xc86aff, bless: 'Stubborn', m: { taken: 0.96, hp: 10 }, text: 'take 4% less damage, +10 max HP' },
        { id: 'summitbloom', name: 'Summit Edelweiss', t: 0, src: 'feat', feat: 'climb3', shape: 'flower', hrs: 6, dust: 170, col: 0xf4f8ff, bless: 'Lofty', m: { pay: 1.06, dmg: 1.02 }, text: 'Tower floors pay 6% more, +2% damage' },
        // the secret one: found, never dropped (somewhere in Starfall Grove). Dust only, no blessing: one for the collection
        { id: 'stardrop',   name: 'Stardrop',       t: 0, src: 'secret', shape: 'star',    hrs: 2,  dust: 60, col: 0xfff0a0, bless: null, m: {}, text: 'no blessing: a rare one, for the collection', secret: true },
    ],
    // the rake's tiers: plots, blessings you can bank, the best floor that opens it, glorps
    TIERS: [
        { plots: 3, bank: 1, floor: 0,  cost: 0 },
        { plots: 4, bank: 2, floor: 5,  cost: 1500 },
        { plots: 5, bank: 3, floor: 15, cost: 5000 },
        { plots: 6, bank: 3, floor: 30, cost: 15000 },
    ],
    // the watering cans: a planted seed waits until it's watered, and the can you water it with sets how long it
    // takes (its hours / speed). You start with the clay one; the better ones are bought (glorps), some opened by the Tower
    CAN: [{ id: 'clay', name: 'Clay Can', speed: 1, cost: 0, floor: 0, col: 0xb86a3a },
          { id: 'copper', name: 'Copper Can', speed: 1.6, cost: 800, floor: 0, col: 0xd8884a },
          { id: 'silver', name: 'Silver Can', speed: 2.5, cost: 3000, floor: 5, col: 0xd8dce8 },
          { id: 'crystal', name: 'Crystal Can', speed: 4, cost: 9000, floor: 15, col: 0x8affd8 },
          { id: 'starwell', name: 'Starwell Can', speed: 6, cost: 25000, floor: 30, col: 0xb07aff }],
    FERT_COST: 150,
    EXTRA_DUST: [0, 15, 30, 60],   // a copy past your plot count, by tier: dust instead

    _get() { try { return JSON.parse(localStorage.getItem('garden2') || '{}'); } catch (e) { return {}; } },
    _set(s) { try { localStorage.setItem('garden2', JSON.stringify(s)); } catch (e) {} },
    seed(id) { return this.SEEDS.find(s => s.id === id) || this.TREES.find(t => t.id === id); },   // (a tree's fruit banks its blessing like a crop)
    state() {
        const s = this._get();
        s.tier = Math.min(this.TIERS.length - 1, s.tier || 0); s.can = s.can || 0; s.fert = s.fert || 0;
        s.seeds ||= {}; s.bank ||= []; s.plots ||= [];
        while (s.plots.length < this.TIERS[s.tier].plots) s.plots.push({ cells: Array(this.FIELD).fill(null), fert: false });
        for (const p of s.plots) this.cells(p);
        return s;
    },
    tier() { return this.TIERS[this.state().tier]; },
    // A bed is a field of FIELD plants sprinkled where they landed: { seed, x, y (0..1 across the bed), at, dur, watered }
    // or null. One copy of a seed covers a whole field, and a plant gives 1/FIELD of its crop's dust, so a field of one
    // crop pays what a bed always did; a mix buys blessing choice, not more dust.
    CELLS: 8, FIELD: 24,
    cells(p) {
        if (!p.cells) { p.cells = Array.from({ length: this.CELLS }, () => p.seed ? { seed: p.seed, at: p.at, dur: p.dur, watered: p.watered ?? p.at > 0 } : null); delete p.seed; }   // (a one-crop bed from before)
        if (p.cells.length !== this.FIELD) {   // an 8-spot bed: each spot becomes three plants in its square
            const old = p.cells; p.cells = [];
            old.forEach((c, i) => { for (let j = 0; j < 3; j++) p.cells.push(c ? { ...c, x: ((i % 4) + 0.2 + 0.3 * j) / 4, y: ((i >> 2) + 0.35 + 0.3 * (j % 2)) / 2 } : null); });
            while (p.cells.length < this.FIELD) p.cells.push(null);
            p.cells.length = this.FIELD;
        }
        p.cells.forEach((c, i) => { if (c && c.x == null) { c.x = ((i % 6) + 0.5) / 6; c.y = (Math.floor(i / 6) + 0.5) / 4; } });   // (dev saves: a plain grid)
        return p.cells;
    },
    has(p, id) { return this.cells(p).some(c => c?.seed === id); },
    planted(s, id) { return s.plots.filter(p => this.has(p, id)).length; },
    free(id, s = this.state()) { return (s.seeds[id] || 0) - this.planted(s, id); },
    canPlant(k, id, s = this.state()) { const p = s.plots[k]; return !!p && (this.has(p, id) || this.free(id, s) > 0); },
    // a bed at a glance: spots planted, empty, dry (planted, not watered), ripe, growing; the soonest ripe in
    bed(p, now = Date.now(), s = this.state()) {
        const o = { n: 0, empty: 0, dry: 0, ripe: 0, growing: 0, left: Infinity, paused: false, f: 0 };
        for (const c of this.cells(p)) {
            if (!c) { o.empty++; continue; }
            o.n++;
            if (!this.watered(c)) { o.dry++; continue; }
            const g = this.growth(c, now, s);
            if (g.f >= 1) o.ripe++; else { o.growing++; if (g.left < o.left) { o.left = g.left; o.paused = !!g.paused; } o.f = Math.max(o.f, g.f); }
        }
        return o;
    },
    // a plot's growth, 0..1 (and how long until it's ripe)
    // A day crop only grows by day, a night crop only by night: it needs its hours' share of its own time
    // (so in real time it takes about as long as any other), and pauses the rest of the day.
    growth(p, now = Date.now(), s = this.state()) {
        if (!p.seed) return { f: 0, left: 0 };
        if (!this.watered(p)) return { f: 0, left: Infinity, dry: true };
        const S = this.seed(p.seed), ms = p.dur || S.hrs * 3600000 / this.CAN[s.can].speed;
        if (!S.time) { const f = Math.min(1, (now - p.at) / ms); return { f, left: Math.max(0, ms - (now - p.at)) }; }
        const need = ms * this.share(S.time), got = this.within(p.at, now, S.time), f = Math.min(1, got / need);
        return { f, left: f >= 1 ? 0 : this.until(now, need - got, S.time) - now, paused: !this.isTime(S.time, now) };
    },
    // ── DAY AND NIGHT ── a garden day lasts DAY_MS of real time: day, dusk, night, dawn (phase 0..1)
    DAY_MS: 20 * 60000, NIGHT: [0.6, 0.95],
    phase(now = Date.now()) { const sh = +(localStorage.getItem('garden_tshift') || 0); return (((now + sh) % this.DAY_MS) + this.DAY_MS) % this.DAY_MS / this.DAY_MS; },   // (garden_tshift: the dev panel's day/night switch)
    isNight(now = Date.now()) { const p = this.phase(now); return p >= this.NIGHT[0] && p < this.NIGHT[1]; },
    isTime(t, now = Date.now()) { return !t || (t === 'night') === this.isNight(now); },
    share(t) { const n = this.NIGHT[1] - this.NIGHT[0]; return t === 'night' ? n : t === 'day' ? 1 - n : 1; },
    // how much of [a, b] fell in that time of day
    within(a, b, t) {
        if (b <= a) return 0;
        const sh = +(localStorage.getItem('garden_tshift') || 0); a += sh; b += sh;
        const D = this.DAY_MS, [n0, n1] = this.NIGHT, wins = t === 'night' ? [[n0, n1]] : [[0, n0], [n1, 1]];
        // up to a point x: whole days times the window's share, plus the part of the last day (no loop over days: a crop
        // ripened by the dev tools dates from 1970, and a loop over its days froze the garden)
        const upTo = x => { const c = Math.floor(x / D), f = x / D - c; let r = 0; for (const [u0, u1] of wins) r += c * (u1 - u0) + Math.max(0, Math.min(f, u1) - u0); return r * D; };
        return upTo(b) - upTo(a);
    },
    // when that much more of its time will have passed
    until(now, more, t) {
        const D = this.DAY_MS; let lo = now, hi = now + more / Math.max(0.05, this.share(t)) + D;
        for (let i = 0; i < 40; i++) { const mid = (lo + hi) / 2; if (this.within(now, mid, t) >= more) hi = mid; else lo = mid; }
        return hi;
    },
    // A handful of seeds sprinkled over field k's empty places: mix is { seedId: weight }, each plant's crop drawn by
    // weight, each kind landing in a clump or two (so the field grows in patches), spread so they don't sit on each
    // other. Watered as they land. Returns the places sown.
    sow(k, mix, now = Date.now(), rnd = Math.random) {
        const s = this.state(), p = s.plots[k];
        if (!p) return [];
        const ids = Object.keys(mix).filter(id => mix[id] > 0 && this.canPlant(k, id, s));
        const cs = this.cells(p), empty = cs.map((c, i) => c ? -1 : i).filter(i => i >= 0);
        if (!ids.length || !empty.length) return [];
        const tot = ids.reduce((a, id) => a + mix[id], 0), g = () => (rnd() + rnd() + rnd() - 1.5) / 1.5;
        const clumps = Object.fromEntries(ids.map(id => [id, Array.from({ length: rnd() < 0.5 ? 2 : 1 }, () => [0.15 + rnd() * 0.7, 0.2 + rnd() * 0.6])]));
        const taken = cs.filter(Boolean).map(c => [c.x, c.y]);
        for (const i of empty) {
            let r = rnd() * tot; const id = ids.find(x => (r -= mix[x]) < 0) || ids[0], cl = clumps[id][Math.floor(rnd() * clumps[id].length)];
            let best = null, bd = -1;
            for (let t = 0; t < 16; t++) {   // a few throws, half of them near its clump; keep the one with the most room (in tiles: the field is 4 x 2), so the field fills evenly and each kind still gathers
                const near = ids.length > 1 && t % 2 === 0, x = Math.min(0.94, Math.max(0.06, near ? cl[0] + g() * 0.35 : 0.06 + rnd() * 0.88)), y = Math.min(0.9, Math.max(0.14, near ? cl[1] + g() * 0.5 : 0.14 + rnd() * 0.76));
                const d = taken.reduce((m, [a, b]) => Math.min(m, Math.hypot((a - x) * 4, (b - y) * 2)), 9) - (near ? 0 : 0.05);
                if (d > bd) { bd = d; best = [x, y]; }
            }
            taken.push(best); cs[i] = { seed: id, x: best[0], y: best[1], at: 0, dur: 0, watered: false };
        }
        this._set(s); this.water(k, now);
        return empty;
    },
    sowAll(k, id, now = Date.now()) { return this.sow(k, { [id]: 1 }, now).length; },
    // n plants shared out by how long each seed was sprinkled ({ id: ms }): largest remainder, so they always add to n
    allot(times, n) {
        const ids = Object.keys(times).filter(id => times[id] > 0), tot = ids.reduce((a, id) => a + times[id], 0);
        if (!tot) return {};
        const out = {}, rem = ids.map(id => { const q = times[id] / tot * n; out[id] = Math.floor(q); return [id, q - out[id]]; }).sort((a, b) => b[1] - a[1]);
        for (let left = n - ids.reduce((a, id) => a + out[id], 0), i = 0; left > 0; left--, i++) out[rem[i % rem.length][0]]++;
        for (const id of ids) if (!out[id]) delete out[id];
        return out;
    },
    // Sprinkled by hand: times { id: ms } split field k's empty places, and each kind grows where it was thrown (pts:
    // [{ id, x, y }] in the field's 0..1, Garden.sow's range), spread so no two sit on each other. Watered. Returns the places.
    sowAt(k, times, pts, now = Date.now(), rnd = Math.random) {
        const s = this.state(), p = s.plots[k];
        if (!p) return [];
        const cs = this.cells(p), empty = cs.map((c, i) => c ? -1 : i).filter(i => i >= 0);
        const ok = Object.fromEntries(Object.entries(times).filter(([id]) => this.canPlant(k, id, s)));
        const share = this.allot(ok, empty.length), taken = cs.filter(Boolean).map(c => [c.x, c.y]), out = [];
        const room = (x, y) => taken.reduce((m, [a, b]) => Math.min(m, Math.hypot((a - x) * 4, (b - y) * 2)), 9);
        for (const [id, n] of Object.entries(share)) {
            const mine = pts.filter(q => q.id === id);
            for (let j = 0; j < n; j++) {
                let best = null, bd = -1;   // of a dozen of its own landing spots (nudged), the one with the most room
                for (let t = 0; t < 12; t++) {
                    const q = mine.length ? mine[Math.floor(rnd() * mine.length)] : { x: 0.06 + rnd() * 0.88, y: 0.14 + rnd() * 0.76 };
                    const x = Math.min(0.94, Math.max(0.06, q.x + (rnd() - 0.5) * 0.06)), y = Math.min(0.9, Math.max(0.14, q.y + (rnd() - 0.5) * 0.1)), d = room(x, y);
                    if (d > bd) { bd = d; best = [x, y]; }
                }
                const i = empty[out.length]; taken.push(best); out.push(i);
                cs[i] = { seed: id, x: best[0], y: best[1], at: 0, dur: 0, watered: false };
            }
        }
        this._set(s); if (out.length) this.water(k, now);
        return out;
    },
    plant(k, i, id) {
        const s = this.state(), p = s.plots[k];
        if (!p || p.cells[i] || !this.canPlant(k, id, s)) return false;
        p.cells[i] = { seed: id, at: 0, dur: 0, watered: false };
        this._set(s); return true;
    },
    watered(p) { return p.watered ?? p.at > 0; },   // (plots planted before cans mattered count as watered)
    can() { return this.CAN[this.state().can] || this.CAN[0]; },
    // watering a planted bed starts it growing; the can you hold decides how long it takes
    water(k, now = Date.now()) {
        const s = this.state(), p = s.plots[k], dry = (p?.cells || []).filter(c => c && !this.watered(c));
        if (!dry.length) return false;
        for (const c of dry) { c.watered = true; c.at = now; c.dur = this.seed(c.seed).hrs * 3600000 / (this.CAN[s.can] || this.CAN[0]).speed * (s.pet === 'mothsprite' ? 0.94 : 1); }
        p.dur = Math.max(...dry.map(c => c.dur));   // (how long the worms' window runs)
        // worms may turn up in it while it grows: at most one infestation a day a bed, about half the time
        const day = Math.floor(now / 86400000); s.wormDay ||= {};
        if (s.wormDay[k] !== day && Math.random() < 0.5) { s.wormDay[k] = day; p.wormAt = now + Math.min(p.dur * 0.8, 3600000) * (0.15 + Math.random() * 0.85); }
        this._set(s); return true;
    },
    // A bed's ripe spots: an eighth of each crop's dust (doubled if fertilized), each kind's blessing banked (if
    // there's room and it's not banked already). The bed's fertilizer and worm bonus last till it's empty.
    // Returns { dust, seeds, blessed: [seeds banked], full: [seeds with no room] } or null.
    harvest(k, now = Date.now(), only = null) {   // only: the plants a sickle swept (all the ripe ones without it)
        const s = this.state(), p = s.plots[k];
        if (!p) return null;
        const cs = this.cells(p), ripe = cs.map((c, i) => i).filter(i => cs[i] && (!only || only.has(i)) && this.watered(cs[i]) && this.growth(cs[i], now, s).f >= 1);
        if (!ripe.length) return null;
        const pet = s.pet === 'glimfox' ? 1.1 : 1;   // fertilizer (x2) and the worm bonus each cover one field's worth of plants (fertN, bonusN), or end when the field's cleared
        let dust = 0; const seeds = [];
        const seedOf = {}, at = {};
        for (const i of ripe) { const S = this.seed(cs[i].seed); let mult = pet; if (p.fert && (p.fertN ??= this.FIELD) > 0) { mult *= 2; p.fertN--; } if (p.bonus > 1 && (p.bonusN ??= this.FIELD) > 0) { mult *= p.bonus; p.bonusN--; } seedOf[i] = S.id; at[i] = [cs[i].x, cs[i].y]; dust += S.dust / this.FIELD * mult; if (!seeds.includes(S)) seeds.push(S); cs[i] = null; }
        dust = Math.round(dust);
        const blessed = [], full = [];
        for (const S of seeds) { if (!S.bless || s.bank.includes(S.id)) continue; if (s.bank.length >= this.TIERS[s.tier].bank) full.push(S); else { s.bank.push(S.id); blessed.push(S); } }
        if (p.fert && p.fertN <= 0) { p.fert = false; delete p.fertN; }
        if (p.bonus > 1 && p.bonusN <= 0) { p.bonus = 0; delete p.bonusN; }
        if (cs.every(c => !c)) { p.fert = false; p.bonus = 0; p.wormAt = 0; p.dur = 0; }
        this._set(s);
        if (typeof Enchants !== 'undefined') Enchants.addDust(dust);
        return { dust, seeds, blessed, full, ripe };
    },
    fertilize(k) {
        const s = this.state(), p = s.plots[k];
        if (!p || !this.bed(p, Date.now(), s).n || p.fert || s.fert < 1) return false;
        p.fert = true; p.fertN = this.FIELD; s.fert--; this._set(s); return true;   // it doubles the next FIELD plants cut, then it's spent
    },
    // A seed from the Tower: a new copy, or (past your plot count) dust instead. Returns what happened.
    give(id) {
        const s = this.state(), S = this.seed(id);
        if (!S) return null;
        if ((s.seeds[id] || 0) >= this.TIERS[s.tier].plots) { const d = this.EXTRA_DUST[S.t]; if (typeof Enchants !== 'undefined') Enchants.addDust(d); return { id, dust: d }; }
        s.seeds[id] = (s.seeds[id] || 0) + 1; this._set(s);
        return { id, copy: s.seeds[id] };
    },
    // A Tower floor's chance of a seed (a boss always drops one); higher floors, better seeds.
    drop(floor, boss, rnd = Math.random) {
        if (!boss && rnd() > 0.2) return null;
        const tiers = floor >= 25 ? [1, 2, 2, 3, 3] : floor >= 10 ? [1, 1, 2] : [1];
        const t = tiers[Math.floor(rnd() * tiers.length)], pool = this.SEEDS.filter(s => s.t === t && s.src === 'tower');
        return pool[Math.floor(rnd() * pool.length)].id;
    },
    // the climb starting: the banked blessings go with it (and leave the bank)
    spendBlessings() { const s = this.state(), b = s.bank; s.bank = []; this._set(s); return b; },
    ADD: ['hp', 'crit', 'heal', 'leech', 'luckBase'],   // added up (as Relics.ADD does); the rest multiply
    mods(ids = []) {
        const out = {};
        for (const id of ids) { const m = this.seed(id)?.m || {}; for (const k in m) out[k] = this.ADD.includes(k) ? (out[k] || 0) + m[k] : (out[k] || 1) * m[k]; }
        return out;
    },
    // ── THE ORCHARD (Starfall Grove) ──
    // Saplings of trees from nowhere near here. src: 'shop' the kiosk always sells it (dust); 'stock' the kiosk
    // has two of these a day; 'drop' never sold: Tower bosses from floor 20 drop them (`floor` says how deep),
    // and the Underwell gives up the cosmic ones. Planted in an orchard plot, a tree takes `grow` hours to grow up, then bears
    // fruit every `every` hours, for good. Picking its fruit gives dust and banks the tree's blessing,
    // just like a crop. No water: they drink starlight. A tree with a time only grows by day or by night.
    TREES: [
        { id: 'lumenwillow', name: 'Lumen Willow',   fruit: 'glowdrops',     grow: 16, every: 6,  dust: 70,  cost: 400,  floor: 0,  col: 0x9affe8, time: 'night', bless: 'Lucid',     m: { crit: 0.03 },  text: '+3% crit chance', src: 'shop' },
        { id: 'orreryoak',   name: 'Orrery Oak',     fruit: 'planetfruit',   grow: 20, every: 7,  dust: 80,  cost: 500,  floor: 0,  col: 0xffc85a, bless: 'Orbital',   m: { ult: 1.08 },   text: 'ults charge 8% faster', src: 'shop' },
        { id: 'bubblebark',  name: 'Bubblebark',     fruit: 'bubble pods',   grow: 18, every: 6,  dust: 75,  cost: 450,  floor: 5,  col: 0x9ad8ff, time: 'day', bless: 'Floaty',  m: { speed: 0.95 }, text: 'move 5% faster', src: 'shop' },
        { id: 'moonpeach',   name: 'Moonpeach',      fruit: 'crescent peaches', grow: 22, every: 8, dust: 95, cost: 700, floor: 10, col: 0xffe8c8, time: 'night', bless: 'Moonfed', m: { heal: 0.07 }, text: 'cleared floors heal 7% more', src: 'shop' },
        { id: 'jellyfruit',  name: 'Jellyfruit Tree', fruit: 'jellyfruit',   grow: 24, every: 8,  dust: 100, cost: 800,  floor: 10, col: 0xff9ad8, bless: 'Wobbly',    m: { hp: 20 },      text: '+20 max HP', src: 'shop' },
        { id: 'cometbirch',  name: 'Comet Birch',    fruit: 'little comets', grow: 26, every: 9,  dust: 120, cost: 1000, floor: 15, col: 0x9ad8ff, bless: 'Streaking', m: { speed: 0.96, dmg: 1.02 }, text: 'move 4% faster, +2% damage', src: 'stock' },
        { id: 'prismwood',   name: 'Prismwood',      fruit: 'prism shards',  grow: 28, every: 9,  dust: 130, cost: 1200, floor: 20, col: 0xd8f8ff, time: 'day', bless: 'Refracted', m: { react: 1.12 }, text: 'reactions charge 12% more', src: 'stock' },
        { id: 'spiralgourd', name: 'Spiral Gourdtree', fruit: 'lantern gourds', grow: 28, every: 10, dust: 140, cost: 1400, floor: 20, col: 0xffa84a, bless: 'Glutted', m: { leech: 2 }, text: 'kills heal 2 HP', src: 'stock' },
        { id: 'voidpine',    name: 'Voidpine',       fruit: 'void cones',    grow: 32, every: 10, dust: 170, cost: 1800, floor: 20, col: 0xb07aff, time: 'night', bless: 'Hollowed', m: { ultDmg: 1.07 }, text: 'ults deal 7% more damage', src: 'drop' },
        { id: 'nebulapalm',  name: 'Nebula Palm',    fruit: 'nebula nuts',   grow: 32, every: 11, dust: 180, cost: 2000, floor: 20, col: 0xff8ad8, bless: 'Wealthy',   m: { pay: 1.07 },   text: 'Tower floors pay 7% more', src: 'drop' },
        { id: 'eyeberry',    name: 'Eyeberry',       fruit: 'eyeberries',    grow: 30, every: 10, dust: 160, cost: 2200, floor: 30, col: 0x9aff6a, time: 'night', bless: 'Seeing',  m: { crit: 0.02, dmg: 1.03 }, text: '+2% crit chance, +3% damage', src: 'stock' },
        { id: 'halotree',    name: 'Halo Tree',      fruit: 'halo rings',    grow: 36, every: 12, dust: 220, cost: 3000, floor: 30, col: 0xfff0a0, time: 'day', bless: 'Haloed',  m: { taken: 0.95 }, text: 'take 5% less damage', src: 'drop' },
        { id: 'eclipsefig',  name: 'Eclipse Fig',    fruit: 'eclipse figs',  grow: 40, every: 12, dust: 260, cost: 4000, floor: 40, col: 0xffb86a, bless: 'Eclipsed',  m: { ultDmg: 1.05, crit: 0.02 }, text: 'ults deal 5% more, +2% crit chance', src: 'drop' },
        { id: 'tendrilheart', name: 'Tendril Heart', fruit: 'heartbeats',    grow: 40, every: 12, dust: 300, cost: 5000, floor: 50, col: 0x7aff5a, bless: 'Devoured',  m: { dmg: 1.1, taken: 1.05 }, text: '+10% damage, but take 5% more', corrupt: true, src: 'drop' },
    ],
    // the orchard's plots: four to start, more cleared at the kiosk (glorps), each opened by a best Tower floor
    ORCH_TIERS: [{ n: 4, floor: 0, cost: 0 }, { n: 5, floor: 10, cost: 4000 }, { n: 6, floor: 20, cost: 10000 }, { n: 7, floor: 35, cost: 20000 }, { n: 8, floor: 50, cost: 40000 }],
    tree(id) { return this.TREES.find(t => t.id === id); },
    orchard() { const s = this.state(); s.orchard ||= []; s.orchTier = Math.min(this.ORCH_TIERS.length - 1, s.orchTier || 0); while (s.orchard.length < this.ORCH_TIERS[s.orchTier].n) s.orchard.push({ tree: null, at: 0, pick: 0 }); s.saplings ||= {}; return s; },
    nextOrch() { return this.ORCH_TIERS[this.orchard().orchTier + 1] || null; },
    buyOrch() { const s = this.orchard(); if (!this.ORCH_TIERS[s.orchTier + 1]) return false; s.orchTier++; this._set(s); this.orchard(); return true; },
    // today's two stock saplings (the same all day, a new pair tomorrow)
    stock(day = Math.floor(Date.now() / 86400000)) { const pool = this.TREES.filter(t => t.src === 'stock'), a = (day * 7) % pool.length; return [pool[a], pool[(a + 1 + (day % (pool.length - 1))) % pool.length]].map(t => t.id); },
    giveSapling(id) { const s = this.orchard(); s.saplings[id] = (s.saplings[id] || 0) + 1; this._set(s); return this.tree(id); },
    // a Tower boss's sapling: from floor 20, about one boss in three; deeper bosses reach the rarer trees
    dropSapling(floor, rnd = Math.random) {
        if (floor < 20 || rnd() > 0.35) return null;
        const pool = this.TREES.filter(t => t.src === 'drop' && t.floor <= floor);
        return pool.length ? pool[Math.floor(rnd() * pool.length)].id : null;
    },
    // hrs of a tree's own time since `from`: how far along (0..1) and how long till it's done
    _prog(from, hrs, t, now) {
        const ms = hrs * 3600000;
        if (!t) return { f: Math.min(1, (now - from) / ms), left: Math.max(0, ms - (now - from)) };
        const need = ms * this.share(t), got = this.within(from, now, t), f = Math.min(1, got / need);
        return { f, left: f >= 1 ? 0 : this.until(now, need - got, t) - now };
    },
    // a plot's tree: grown (0..1), and once grown its fruit (0..1). The first fruit comes `every` hours after it's grown.
    treeState(p, now = Date.now()) {
        const T = this.tree(p.tree); if (!T) return null;
        const g = this._prog(p.at, T.grow, T.time, now), fr = this._prog(p.pick || p.at, p.pick ? T.every : T.grow + T.every, T.time, now);
        return { T, grown: g.f, growLeft: g.left, fruit: g.f < 1 ? 0 : fr.f, fruitLeft: fr.left, ripe: g.f >= 1 && fr.f >= 1, stage: g.f >= 1 ? (fr.f >= 1 ? 3 : 2) : g.f >= 0.5 ? 1 : 0 };
    },
    buySapling(id) { const s = this.orchard(), T = this.tree(id); if (!T || T.src === 'drop' || (T.src === 'stock' && !this.stock().includes(id)) || typeof Enchants === 'undefined' || Enchants.dust() < T.cost) return false; Enchants.addDust(-T.cost); s.saplings[id] = (s.saplings[id] || 0) + 1; this._set(s); return true; },
    plantTree(k, id, now = Date.now()) { const s = this.orchard(), p = s.orchard[k]; if (!p || p.tree || !(s.saplings[id] > 0)) return false; s.saplings[id]--; Object.assign(p, { tree: id, at: now, pick: 0 }); s.treeLog ||= {}; s.treeLog[id] = 1; this._set(s); return true; },
    uproot(k) { const s = this.orchard(), p = s.orchard[k]; if (!p?.tree) return false; s.saplings[p.tree] = (s.saplings[p.tree] || 0) + 1; Object.assign(p, { tree: null, at: 0, pick: 0 }); this._set(s); return true; },   // the tree goes back in its pot, to plant again
    // its fruit picked: dust, its blessing banked (crop rules), the next crop's clock started
    pick(k, now = Date.now()) {
        const s = this.orchard(), p = s.orchard[k], st = p && this.treeState(p, now);
        if (!st?.ripe) return null;
        const T = st.T, dust = Math.round(T.dust * (s.pet === 'glimfox' ? 1.1 : 1));
        const has = s.bank.includes(T.id), full = !has && s.bank.length >= this.TIERS[s.tier].bank, blessed = !has && !full;
        if (blessed) s.bank.push(T.id);
        p.pick = now; s.fruitLog ||= {}; s.fruitLog[T.id] = (s.fruitLog[T.id] || 0) + 1;
        this._set(s);
        if (typeof Enchants !== 'undefined') Enchants.addDust(dust);
        return { dust, blessed, full, tree: T };
    },
    // ── FISHING (the garden's river) ──
    // A cast, a bite, then a reel: hit the moving zone three times. Rarer fish swim faster with a
    // smaller zone. They pay dust (halved once you've landed 15 today: the fish get wary) and the
    // rare ones can drop a seed. `w` is how often it bites, `speed` / `zone` the reel's difficulty.
    // where: 'river' or 'lake'. shape: its body (round, long, eel, ray, koi, puffer, angler, jelly, pike);
    // col / fin its colours; seed: its chance of a seed (its water's own when it has one)
    FISH: [
        { id: 'mudgill',    name: 'Mudgill',        where: 'river', w: 40, dust: 4,   speed: 0.9, zone: 0.30, col: 0x8a7a5a, fin: 0x5a4a3a, shape: 'round',  seed: 0 },
        { id: 'pebblefin',  name: 'Pebblefin',      where: 'river', w: 30, dust: 6,   speed: 1.0, zone: 0.28, col: 0x9a9488, fin: 0x6a6458, shape: 'long',   seed: 0 },
        { id: 'glimmer',    name: 'Glimmer Carp',   where: 'river', w: 24, dust: 8,   speed: 1.1, zone: 0.26, col: 0xffd060, fin: 0xff9a3a, shape: 'koi', time: 'day',    seed: 0 },
        { id: 'mosstrout',  name: 'Moss Trout',     where: 'river', w: 18, dust: 10,  speed: 1.2, zone: 0.24, col: 0x6aa84a, fin: 0x3a6230, shape: 'long', time: 'day',   seed: 0.05 },
        { id: 'lanternguppy', name: 'Lantern Guppy', where: 'river', w: 12, dust: 14, speed: 1.4, zone: 0.22, col: 0xffe8a0, fin: 0xff8a3a, shape: 'round', time: 'night',  seed: 0.08, glow: true },
        { id: 'moonfin',    name: 'Moonfin',        where: 'river', w: 8,  dust: 18,  speed: 1.5, zone: 0.20, col: 0xc8d8ff, fin: 0x8aa0e0, shape: 'ray', time: 'night',    seed: 0.12, glow: true },
        { id: 'stareel',    name: 'Star Eel',       where: 'river', w: 4,  dust: 40,  speed: 1.9, zone: 0.17, col: 0xd8a8ff, fin: 0x8a4ae0, shape: 'eel', time: 'night',    seed: 0.3, glow: true },
        { id: 'riverwisp',  name: 'River Wisp',     where: 'river', w: 1.2, dust: 80, speed: 2.4, zone: 0.14, col: 0x9affe8, fin: 0xffffff, shape: 'jelly', time: 'night',  seed: 0.6, glow: true },
        { id: 'glassminnow', name: 'Glass Minnow',  where: 'river', w: 26, dust: 7,   speed: 1.1, zone: 0.27, col: 0xd8f0f0, fin: 0xa8d8e0, shape: 'long',   seed: 0 },
        { id: 'thornback',  name: 'Thornback',      where: 'river', w: 20, dust: 9,   speed: 1.2, zone: 0.25, col: 0x7a8a3a, fin: 0xb85a2a, shape: 'round', time: 'day', seed: 0.04 },
        { id: 'ribbonfin',  name: 'Ribbonfin',      where: 'river', w: 10, dust: 16,  speed: 1.5, zone: 0.21, col: 0xe8a8e0, fin: 0xb07aff, shape: 'koi', time: 'night', seed: 0.08, glow: true },
        { id: 'emberloach', name: 'Ember Loach',    where: 'river', w: 6,  dust: 24,  speed: 1.7, zone: 0.19, col: 0x5a2a1a, fin: 0xff8a3a, shape: 'eel', time: 'night', seed: 0.15, glow: true },
        { id: 'lakeperch',  name: 'Lake Perch',     where: 'lake',  w: 36, dust: 8,   speed: 1.0, zone: 0.28, col: 0x7a9a6a, fin: 0xd87a3a, shape: 'round',  seed: 0 },
        { id: 'bluegill',   name: 'Bluegill Sprite', where: 'lake', w: 28, dust: 10,  speed: 1.2, zone: 0.26, col: 0x5a8ad8, fin: 0xffe08a, shape: 'koi', time: 'day',    seed: 0.04 },
        { id: 'crystalpike', name: 'Crystal Pike',  where: 'lake',  w: 18, dust: 16,  speed: 1.4, zone: 0.22, col: 0x8affd8, fin: 0xffffff, shape: 'pike',   seed: 0.08, glow: true },
        { id: 'mirrorbass', name: 'Mirror Bass',    where: 'lake',  w: 12, dust: 22,  speed: 1.5, zone: 0.21, col: 0xd8e0e8, fin: 0x8a94a8, shape: 'round', time: 'day',  seed: 0.1 },
        { id: 'puffglow',   name: 'Puffglow',       where: 'lake',  w: 8,  dust: 28,  speed: 1.7, zone: 0.19, col: 0xff9ad8, fin: 0xffe0f0, shape: 'puffer', time: 'night', seed: 0.15, glow: true },
        { id: 'nebulajelly', name: 'Nebula Jelly',  where: 'lake',  w: 5,  dust: 45,  speed: 1.9, zone: 0.17, col: 0xb07aff, fin: 0xff9ad8, shape: 'jelly', time: 'night',  seed: 0.3, glow: true },
        { id: 'voidkoi',    name: 'Void Koi',       where: 'lake',  w: 2,  dust: 90,  speed: 2.3, zone: 0.14, col: 0x2a1a4a, fin: 0xff6ae0, shape: 'koi', time: 'night',    seed: 0.6, glow: true },
        { id: 'abyssangler', name: 'Abyssal Angler', where: 'lake', w: 0.8, dust: 150, speed: 2.7, zone: 0.12, col: 0x1a2a5a, fin: 0x9affe8, shape: 'angler', time: 'night', seed: 1, glow: true },
        { id: 'zebradart',  name: 'Zebra Dart',     where: 'lake',  w: 24, dust: 11,  speed: 1.3, zone: 0.25, col: 0xe8e0d0, fin: 0x2a2a3a, shape: 'long',   seed: 0.02 },
        { id: 'crownedcichlid', name: 'Crowned Cichlid', where: 'lake', w: 16, dust: 18, speed: 1.4, zone: 0.23, col: 0x3a8ad8, fin: 0xffb83a, shape: 'round', time: 'day', seed: 0.06 },
        { id: 'bubbleeye',  name: 'Bubble-eye',     where: 'lake',  w: 10, dust: 24,  speed: 1.5, zone: 0.21, col: 0xff8a4a, fin: 0xffd0a0, shape: 'round',  seed: 0.1 },
        { id: 'seahorse',   name: 'Lantern Seahorse', where: 'lake', w: 4, dust: 50,  speed: 2.0, zone: 0.17, col: 0xffc85a, fin: 0x5ad8c8, shape: 'horse', time: 'night', seed: 0.3, glow: true },
        { id: 'mossturtle', name: 'Moss Turtle',    where: 'lake',  w: 3,  dust: 70,  speed: 1.2, zone: 0.2,  col: 0x5a8a4a, fin: 0x8ab85a, shape: 'turtle', time: 'day', seed: 0.4 },
        // the Lagoon's mud patch: the only place these live
        { id: 'mudskipper', name: 'Mudskipper',     where: 'mud',   w: 1,  dust: 77,  speed: 1.7, zone: 0.2,  col: 0x8a7a4a, fin: 0x4a8ab8, shape: 'skipper', time: 'day', seed: 0 },
        { id: 'crawdad',    name: 'Bog Crawdad',    where: 'mud',   w: 1.5, dust: 60, speed: 1.5, zone: 0.21, col: 0xb84a2a, fin: 0x6a2a1a, shape: 'crab', time: 'day', seed: 0.25 },
        { id: 'sludgegulper', name: 'Sludge Gulper', where: 'mud',  w: 1,  dust: 90,  speed: 1.9, zone: 0.18, col: 0x5a4a2a, fin: 0x8a9a4a, shape: 'round', time: 'night', seed: 0.35 },
        // the Cloud Sea: bright, quick fish that leap out of the cloud tops
        { id: 'puffwisp',   name: 'Puffwisp',       where: 'sky', w: 60, dust: 14,  speed: 1.0, zone: 0.28, col: 0xf0f4ff, fin: 0xb8d0f0, shape: 'puffer', seed: 0.02 },
        { id: 'breezefin',  name: 'Featherfin',      where: 'sky', w: 40, dust: 20,  speed: 1.2, zone: 0.26, col: 0xd8ecff, fin: 0x8ac8ff, shape: 'koi',    seed: 0.03 },
        { id: 'dewguppy',   name: 'Dewdrop Guppy',  where: 'sky', w: 30, dust: 24,  speed: 1.3, zone: 0.25, col: 0xa8e8ff, fin: 0xffffff, shape: 'round',  seed: 0.04, time: 'day' },
        { id: 'sunskipper', name: 'Sun Sparrowfish',     where: 'sky', w: 14, dust: 45,  speed: 1.6, zone: 0.21, col: 0xffe08a, fin: 0xffb84a, shape: 'skipper', seed: 0.08, time: 'day' },
        { id: 'moonmoth',   name: 'Moonmoth Ray',   where: 'sky', w: 10, dust: 55,  speed: 1.7, zone: 0.2,  col: 0xc8c0f0, fin: 0xfff6d0, shape: 'ray',    seed: 0.12, time: 'night', glow: true },
        { id: 'prismtrout', name: 'Rainbow Glider',  where: 'sky', w: 6,  dust: 80,  speed: 1.8, zone: 0.19, col: 0xff9ad8, fin: 0x8affd8, shape: 'koi',    seed: 0.18 },
        { id: 'thunderjelly', name: 'Stormcloud Jelly', where: 'sky', w: 4,  dust: 95,  speed: 1.9, zone: 0.18, col: 0xfff0a0, fin: 0x8ac8ff, shape: 'jelly',  seed: 0.22, glow: true },
        { id: 'stormeel',   name: 'Storm Dragon',      where: 'sky', w: 1.5, dust: 160, speed: 2.3, zone: 0.15, col: 0x5a6a8a, fin: 0xffe060, shape: 'eel',   seed: 0.4, time: 'night', glow: true },
        { id: 'sunrisekoi', name: 'Dawn Phoenix Koi',    where: 'sky', w: 0.15, dust: 520, speed: 2.8, zone: 0.11, col: 0xff8a3a, fin: 0xffe08a, shape: 'koi',  seed: 1, time: 'day' },
        { id: 'skywhale',   name: 'Sky Whale Pup',  where: 'sky', w: 0.3, dust: 400, speed: 2.6, zone: 0.12, col: 0x8ab8e8, fin: 0xffffff, shape: 'angler', seed: 0.8 },
        // the Underwell: skewed hard. The common ones bite all the time, the rare ones almost never
        { id: 'driftling',  name: 'Driftling',      where: 'cosmic', w: 70, dust: 12,  speed: 1.0, zone: 0.28, col: 0x8a6ad8, fin: 0xd8b8ff, shape: 'round',  seed: 0.01, glow: true },
        { id: 'starmote',   name: 'Starmote',       where: 'cosmic', w: 45, dust: 16,  speed: 1.2, zone: 0.26, col: 0xd8d0ff, fin: 0xfff0a0, shape: 'puffer', seed: 0.02, glow: true },
        { id: 'orbitfish',  name: 'Orbitfish',      where: 'cosmic', w: 30, dust: 20,  speed: 1.3, zone: 0.25, col: 0x5a8ad8, fin: 0xd8e8ff, shape: 'round',  seed: 0.03, glow: true },
        { id: 'prismfin',   name: 'Prismfin',       where: 'cosmic', w: 12, dust: 40,  speed: 1.6, zone: 0.21, col: 0xd8f8ff, fin: 0xff9ad8, shape: 'koi',    seed: 0.08, glow: true },
        { id: 'gazer',      name: 'Gazer',          where: 'cosmic', w: 6,  dust: 60,  speed: 1.8, zone: 0.19, col: 0x3a1a4a, fin: 0x9aff6a, shape: 'round',  seed: 0.15, glow: true },
        { id: 'nebulite',   name: 'Nebulite',       where: 'cosmic', w: 4,  dust: 70,  speed: 1.8, zone: 0.18, col: 0xff8ad8, fin: 0x8a4ae0, shape: 'jelly',  seed: 0.2, glow: true },
        { id: 'voidray',    name: 'Void Ray',       where: 'cosmic', w: 1.2, dust: 140, speed: 2.2, zone: 0.15, col: 0x1a0a3a, fin: 0xb07aff, shape: 'ray',   seed: 0.4, glow: true },
        { id: 'cometsquid', name: 'Comet Squid',    where: 'cosmic', w: 0.6, dust: 220, speed: 2.4, zone: 0.13, col: 0xd8e8ff, fin: 0x6ad8ff, shape: 'squid', seed: 0.5, glow: true },
        { id: 'haloeel',    name: 'Halo Eel',       where: 'cosmic', w: 0.15, dust: 450, speed: 2.8, zone: 0.11, col: 0xfff0c0, fin: 0xffd060, shape: 'eel',  seed: 1, glow: true },
        { id: 'cometkoi',   name: 'Comet Koi',      where: 'cosmic', w: 0.3, dust: 300, speed: 2.6, zone: 0.12, col: 0xfff0d0, fin: 0x6ad8ff, shape: 'koi',   seed: 0.7, glow: true },
        { id: 'riftwyrm',   name: 'Rift Wyrm',      where: 'cosmic', w: 0.08, dust: 600, speed: 3.0, zone: 0.10, col: 0x7aff5a, fin: 0x2a0a3a, shape: 'eel',  seed: 1, glow: true },
        { id: 'starwhale',  name: 'Star Whale Calf', where: 'cosmic', w: 0.02, dust: 1200, speed: 3.2, zone: 0.09, col: 0x2a3a8a, fin: 0xffffff, shape: 'angler', seed: 1, glow: true },
    ],
    // rods: bought with dust at the kiosk, the better ones opened by your best Tower floor. Luck: rarer
    // bites, a little more dust a catch, and treasure more often (fertilizer, sealed books, seeds, hats)
    // ctl (control): a bigger, steadier catch bar, calmer fish, slower slipping and a longer bite window
    RODS: [
        { id: 'twig',      name: 'Twig Rod',      luck: 0, ctl: 0, cost: 0,     floor: 0,  col: 0x8a6a42, tip: 0xc8b898 },
        { id: 'willow',    name: 'Willow Rod',    luck: 1, ctl: 1, cost: 300,   floor: 0,  col: 0xa88a5a, tip: 0x9aff8a },
        { id: 'crystal',   name: 'Crystal Rod',   luck: 2, ctl: 2, cost: 1200,  floor: 5,  col: 0x8affd8, tip: 0xffffff },
        { id: 'starweave', name: 'Starweave Rod', luck: 3, ctl: 3, cost: 4000,  floor: 15, col: 0xffe08a, tip: 0xd8a8ff },
        { id: 'voidcaster', name: 'Voidcaster',   luck: 4, ctl: 4, cost: 12000, floor: 30, col: 0x5a3a9a, tip: 0xff6ae0 },
    ],
    LAKE_FLOOR: 10,
    SKY_FLOOR: 20,   // the trampoline springs high enough for the Cloud Sea from this best Tower floor
    WELL_FLOOR: 40,   // the moonwell lets you in (down to the Underwell) from this best Tower floor   // the Lagoon's lake opens at this best Tower floor
    HATS: ['ripplerunner', 'waverider', 'tidecaller', 'tidalguard', 'wishingwell', 'drowner'],   // fishing's cosmetics (the face sheet's own hats)
    rod() { const s = this.state(); return this.RODS.find(r => r.id === (s.rod || 'twig')) || this.RODS[0]; },
    ownsRod(id) { const s = this.state(); return id === 'twig' || (s.rods || []).includes(id); },
    buyRod(id) { const s = this.state(); s.rods = [...new Set([...(s.rods || []), id])]; s.rod = id; this._set(s); },
    useRod(id) { if (!this.ownsRod(id)) return; const s = this.state(); s.rod = id; this._set(s); },
    wearHat(id) { const s = this.state(); s.hat = id || null; this._set(s); try { localStorage.setItem('slime_hat', id || ''); } catch (e) {} },
    WARY_AFTER: 15,
    // a bite in `where` ('river' or 'lake'): your rod's luck tips it toward the rarer fish
    bite(rnd = Math.random, where = 'river') {
        const L = (this.rod().luck + this.tankLuck() + (this.state().pet === 'puddlewyrm' ? 0.5 : 0)) * (where === 'cosmic' ? 0.5 : 1), pool = this.FISH.filter(f => f.where === where && this.isTime(f.time)), w = f => f.w * (f.w <= 12 ? 1 + 0.35 * L : 1);
        let x = rnd() * pool.reduce((a, f) => a + w(f), 0); return pool.find(f => (x -= w(f)) < 0) || pool[0];
    },
    // the secret seed, picked up in the Grove: once
    foundEgg() { return !!this.state().egg; },
    findEgg() { const s = this.state(); if (s.egg) return false; s.egg = true; s.seeds.stardrop = (s.seeds.stardrop || 0) + 1; this._set(s); return true; },
    // landed: its dust (wary fish pay half), maybe a seed, and the log
    catchFish(id, rnd = Math.random) {
        const s = this.state(), F = this.FISH.find(f => f.id === id), day = Math.floor(Date.now() / 86400000), L = this.rod().luck;
        if (s.fishDay !== day) { s.fishDay = day; s.fishToday = 0; }
        s.fishToday++; s.fishLog ||= {}; s.fishLog[id] = (s.fishLog[id] || 0) + 1;
        const wary = s.fishToday > this.WARY_AFTER, dust = Math.max(1, Math.round(F.dust * (1 + 0.1 * L) * (wary ? 0.5 : 1)));
        this._set(s);
        if (typeof Enchants !== 'undefined') Enchants.addDust(dust);
        const out = { fish: F, dust, wary, treasure: [] }, lk = 1 + 0.3 * L;
        if (rnd() < F.seed * lk) {   // a seed: the water's own when it has one, now and then a Tower one
            const own = this.SEEDS.filter(S2 => S2.src === F.where), pick = own.length && rnd() < 0.7 ? own[Math.floor(rnd() * own.length)].id : this.drop(F.where === 'cosmic' ? 40 : F.where === 'sky' ? 30 : F.where === 'lake' ? 25 : 12, true, rnd);
            out.seed = this.give(pick);
        }
        if (F.where === 'cosmic' && rnd() < 0.01 * lk * (1 + F.dust / 100)) { const t = rnd() < 0.5 ? 'voidpine' : 'nebulapalm'; this.giveSapling(t); out.treasure.push('sapling:' + t); }   // the Underwell's cosmic saplings, rarer on common fish
        if (rnd() < 0.05 * lk) { this.buyFert(); out.treasure.push('fertilizer'); }                                   // treasure: fertilizer
        if (rnd() < 0.008 * lk && typeof Enchants !== 'undefined') { Enchants.addBooks(1); out.treasure.push('book'); }   // a sealed book, rarely
        if (rnd() < 0.02 * lk) { const kind = rnd() < 0.5 ? 'lamp' : 'crystal', st = this._fill(this.state()); if (this._put(st, { k: 'decor', id: kind })) { this._set(st); out.treasure.push('decor:' + kind); } }   // decor, now and then
        if (rnd() < 0.004 * lk) { const left = this.PETS.filter(p => !this.ownsPet(p.id)); if (left.length) { const pt = left[Math.floor(rnd() * left.length)]; this.givePet(pt.id); out.treasure.push('pet:' + pt.id); } }   // a pet, very rarely
        if (rnd() < 0.006 * lk) {   // a hat for the slime, very rarely
            const st = this.state(), left = this.HATS.filter(h => !(st.hats || []).includes(h));
            if (left.length) { const h = left[Math.floor(rnd() * left.length)]; st.hats = [...(st.hats || []), h]; this._set(st); out.treasure.push('hat:' + h); }
        }
        return out;
    },
    // The backpack: 48 slots (bag and chest are one store now, kept as two lists for old saves). Rods and seeds you own get
    // a slot each (it points at them: a seed slot counts your copies); fish you land are kept there too, stacked by kind.
    BAG: 8, CHEST: 40,
    _fill(s) {
        s.bag ||= Array(this.BAG).fill(null); s.chest ||= Array(this.CHEST).fill(null);
        while (s.chest.length < this.CHEST) s.chest.push(null);   // (a 24-slot chest from before)
        const all = () => [...s.bag, ...s.chest], want = [...['twig', ...(s.rods || [])].filter(id => this.RODS.some(r => r.id === id)).map(id => ['rod', id]), ['can', 'can'], ...(s.fert > 0 ? [['fert', 'fert']] : []), ...Object.keys(s.seeds).filter(id => s.seeds[id] > 0 && this.seed(id)).map(id => ['seed', id])];
        for (const L of [s.bag, s.chest]) L.forEach((o, i) => { if (o?.k === 'fert' && !(s.fert > 0)) L[i] = null; });   // the sack goes when it's empty
        for (const [k, id] of want) if (!all().some(o => o && o.k === k && o.id === id)) this._put(s, { k, id });
        return s;
    },
    _put(s, o) {   // a stack of its kind, else the first free slot (the hotbar first); false if it's all full
        if (o.k === 'fish') { const st = [...s.bag, ...s.chest].find(x => x && x.k === 'fish' && x.id === o.id); if (st) { st.n += 1; return true; } o.n = 1; }
        for (const L of [s.bag, s.chest]) { const i = L.indexOf(null); if (i >= 0) { L[i] = o; return true; } }
        return false;
    },
    slots() { const s = this._fill(this.state()); this._set(s); return s; },
    keepFish(id) { const s = this._fill(this.state()), ok = this._put(s, { k: 'fish', id }); this._set(s); return ok; },
    swap(a, i, b, j) { const s = this._fill(this.state()); [s[a][i], s[b][j]] = [s[b][j], s[a][i]]; this._set(s); },
    // where you've moved the garden's things to (build mode): { BEDS: [...], STALL: [...], ... }
    layout() { return this.state().layout || {}; },
    setLayout(key, v) { const s = this.state(); s.layout = { ...(s.layout || {}), [key]: v }; this._set(s); },

    // Sleeping on the Grove's bench: every watered crop grows SLEEP_H hours, once per SLEEP_CD (real time).
    // Ripe stays ripe. Now and then you wake to a small dream gift.
    SLEEP_H: 2, SLEEP_CD: 12 * 3600000,
    sleepLeft(now = Date.now()) { return Math.max(0, (this.state().slept || 0) + this.SLEEP_CD - now); },
    sleep(now = Date.now(), rnd = Math.random) {
        if (this.sleepLeft(now) > 0) return null;
        const s = this.state(), grown = s.plots.filter(p => p.cells.some(c => c && this.watered(c)));
        const h = this.SLEEP_H + (s.pet === 'starowl' ? 1 : 0); for (const p of grown) for (const c of p.cells) if (c && this.watered(c)) c.at -= h * 3600000;
        s.slept = now;
        const r = rnd(), gift = r < 0.25 ? 'fert' : r < 0.4 ? 'dust' : r < 0.45 ? 'seed' : null;
        if (gift === 'fert') s.fert++;
        this._set(s);
        const out = { beds: grown.length, gift, h };
        if (gift === 'dust') { out.dust = 20 + Math.floor(rnd() * 40); if (typeof Enchants !== 'undefined') Enchants.addDust(out.dust); }
        if (gift === 'seed') out.seed = this.give(this.drop(5, true, rnd));
        return out;
    },

    // ── WORMS ── a growing bed now and then gets worms. Pick the pests (the rake), leave the helpers.
    // Clearing it: +15% dust on that bed's harvest (+25% for a perfect round). Skipping costs nothing.
    WORMS: [
        { id: 'rotworm',   name: 'Rot Worm',     pest: true,  w: 40, col: 0xc83a2a, text: 'striped red with a dark head; it eats the roots' },
        { id: 'borer',     name: 'Grub Borer',   pest: true,  w: 30, col: 0xe8dcb8, text: 'pale and fat; it bores into the stems' },
        { id: 'earthworm', name: 'Earthworm',    pest: false, w: 34, col: 0xe88a9a, text: 'plump and pink, a leaf on its back; it keeps the soil soft' },
        { id: 'glowworm',  name: 'Glowworm',     pest: false, w: 20, col: 0x9aff8a, text: 'it shines softly; the crops grow toward it' },
        { id: 'starworm',  name: 'Starworm',     pest: true,  w: 3,  col: 0xffe08a, text: 'a rare golden pest that fell from the Isle\'s sky' },
        { id: 'riftworm',  name: 'Rift Worm',    pest: true,  w: 1,  col: 0x7aff5a, text: 'very rare, corrupted, flickering in and out' },
    ],
    hasRake() { return this.state().tier >= 1; },
    infested(p, now = Date.now()) { return !!(p && p.wormAt && now >= p.wormAt && this.bed(p, now).growing > 0); },
    clearWorms(k, bonus) { const s = this.state(), p = s.plots[k]; if (!p) return; p.wormAt = 0; p.bonus = Math.max(p.bonus || 1, bonus); p.bonusN = this.FIELD; this._set(s); },
    skipWorms(k) { const s = this.state(), p = s.plots[k]; if (!p) return; p.wormAt = 0; this._set(s); },
    logWorm(id) { const s = this.state(); s.wormLog ||= {}; s.wormLog[id] = (s.wormLog[id] || 0) + 1; this._set(s); },
    pickWorm(rnd = Math.random) { const L = this.WORMS; let x = rnd() * L.reduce((a, w) => a + w.w, 0); return L.find(w => (x -= w.w) < 0) || L[0]; },

    // ── PETS ── mythical little creatures of the Isle, found now and then in the water. One comes along with
    // you at a time, tends the beds now and then, and has one small garden perk (nothing in fights).
    PETS: [
        { id: 'mothsprite', name: 'Moth Sprite',  col: 0xfff0a0, perk: 'crops grow 6% faster',       text: 'a moth of pale light that sleeps in lanterns' },
        { id: 'glimfox',    name: 'Glimmerfox',   col: 0x8affd8, perk: 'harvests give 10% more dust', text: 'a fox with a coat of crystal; it hums when it\'s happy' },
        { id: 'puddlewyrm', name: 'Puddlewyrm',   col: 0x6ab8ff, perk: '+0.5 fishing luck',           text: 'a dragon the size of a teacup that lives in rain' },
        { id: 'starowl',    name: 'Star Owl',     col: 0xd8a8ff, perk: 'sleeping grows crops 3h, not 2h', text: 'an owl made of the night sky; its eyes are two stars' },
    ],
    pet() { const s = this.state(); return this.PETS.find(p => p.id === s.pet) || null; },
    ownsPet(id) { return (this.state().pets || []).includes(id); },
    givePet(id) { const s = this.state(); if ((s.pets || []).includes(id)) return false; s.pets = [...(s.pets || []), id]; if (!s.pet) s.pet = id; this._set(s); return true; },
    usePet(id) { const s = this.state(); if (id && !(s.pets || []).includes(id)) return; s.pet = id || null; this._set(s); },

    // ── DECOR ── lamps and crystal clusters you own beyond the garden's own: bought at the kiosk (dust) or fished
    // up as treasure, set down in build mode (they go in the hotbar/chest until then).
    DECOR: { lamp: { name: 'Violet Lantern', cost: 80 }, crystal: { name: 'Crystal Cluster', cost: 120 }, pot: { name: 'Potted Star Tree', cost: 200 } },
    buyDecor(kind) { const s = this._fill(this.state()); if (typeof Enchants !== 'undefined') Enchants.addDust(-this.DECOR[kind].cost); const ok = this._put(s, { k: 'decor', id: kind }); this._set(s); return ok; },
    useDecor(kind) { const s = this._fill(this.state()); for (const L of [s.bag, s.chest]) { const i = L.findIndex(o => o && o.k === 'decor' && o.id === kind); if (i >= 0) { L[i] = null; this._set(s); return true; } } return false; },

    // ── AQUARIUMS ── one for each water: the river tank, the lagoon tank, the Underwell pool. Each holds only its
    // own water's fish (the mud's skipper counts as river). A sprinkle of stardust keeps one lively for a day:
    // then it trickles a little dust (more for rarer fish) and every different kind on show adds a little fishing
    // luck. Left alone it goes murky and the fish doze; nothing is lost, the bonus only pauses.
    TANK_KINDS: { river: { name: 'River Aquarium', cost: 2500 }, lake: { name: 'Lagoon Aquarium', cost: 4000 }, cosmic: { name: 'Underwell Pool', cost: 8000 } },
    TANK_SLOTS: 6, TANK_SLOTS_MAX: 10, TANK_SLOT_COST: 1200, SPRINKLE: 15, LIT_MS: 86400000, TANK_CAP: 120,
    tankWater(F) { return F.where === 'mud' ? 'river' : F.where; },
    tanks() { const s = this.state(); if (s.tank && !s.tanks) { s.tanks = { river: s.tank }; delete s.tank; this._set(s); } return s.tanks || {}; },
    tank(kind) { return this.tanks()[kind] || null; },
    tankOpen(kind, best = 0) { const s = this.state(); return kind === 'river' || (kind === 'lake' ? best >= this.LAKE_FLOOR : !!s.deep); },
    buyTank(kind) { this.tanks(); const s = this.state(); s.tanks = { ...(s.tanks || {}), [kind]: { fish: [], lit: 0, at: Date.now(), slots: this.TANK_SLOTS, acc: 0 } }; this._set(s); },
    _tk(fn) { this.tanks(); const s = this._fill(this.state()); const r = fn(s); this._set(s); return r; },
    tankLit(kind, now = Date.now()) { const t = this.tank(kind); return !!t && now < t.lit; },
    tankAdd(kind, id) {
        const F = this.FISH.find(f => f.id === id); if (!F || this.tankWater(F) !== kind) return false;
        return this._tk(s => {
            const t = s.tanks?.[kind]; if (!t || t.fish.length >= t.slots) return false;
            const st = [...s.bag, ...s.chest].find(o => o && o.k === 'fish' && o.id === id); if (!st) return false;
            st.n--; for (const L of [s.bag, s.chest]) L.forEach((o, i) => { if (o === st && o.n <= 0) L[i] = null; });
            t.fish.push(id); return true;
        });
    },
    tankTake(kind, i) { const id = this._tk(s => s.tanks?.[kind]?.fish.splice(i, 1)[0]); if (id) this.keepFish(id); return !!id; },
    tankRate(t) { return t ? t.fish.reduce((a, id) => a + Math.max(0.2, (this.FISH.find(f => f.id === id)?.dust || 0) / 100), 0) : 0; },   // dust an hour
    tankTick(kind, now = Date.now()) {
        return this._tk(s => {
            const t = s.tanks?.[kind]; if (!t) return 0;
            const from = t.at || now, to = Math.min(now, t.lit || 0); t.at = now;
            if (to > from) t.acc = Math.min(this.TANK_CAP, (t.acc || 0) + this.tankRate(t) * (to - from) / 3600000);
            return t.acc;
        });
    },
    tankCollect(kind) { this.tankTick(kind); const d = this._tk(s => { const t = s.tanks?.[kind], d = Math.floor(t?.acc || 0); if (d) t.acc -= d; return d; }); if (d && typeof Enchants !== 'undefined') Enchants.addDust(d); return d; },
    sprinkle(kind, now = Date.now()) {
        if (typeof Enchants !== 'undefined' && Enchants.dust() < this.SPRINKLE) return false;
        this.tankTick(kind, now);
        const ok = this._tk(s => { const t = s.tanks?.[kind]; if (!t) return false; t.lit = Math.min(Math.max(now, t.lit || 0) + this.LIT_MS, now + this.LIT_MS * 2); return true; });
        if (ok && typeof Enchants !== 'undefined') Enchants.addDust(-this.SPRINKLE);
        return ok;
    },
    tankSlot(kind) { return this._tk(s => { const t = s.tanks?.[kind]; if (!t || t.slots >= this.TANK_SLOTS_MAX) return false; t.slots++; return true; }); },
    tankLuck(now = Date.now()) { let k = 0; for (const [kind, t] of Object.entries(this.tanks())) if (this.tankLit(kind, now)) k += new Set(t.fish).size; return Math.min(0.8, k * 0.1); },

    // seeds you've ever owned (the Plantdex shows the rest as ???)
    known(id) { const s = this.state(); return (s.seeds[id] || 0) > 0 || s.plots.some(p => this.has(p, id)); },

    // the shop
    nextTier() { const s = this.state(); return s.tier + 1 < this.TIERS.length ? this.TIERS[s.tier + 1] : null; },
    rakeBlocked(glorps, best) { const n = this.nextTier(); return !n ? 'max' : best < n.floor ? 'floor' : glorps < n.cost ? 'glorps' : null; },
    buyRake() { const s = this.state(); s.tier++; this._set(s); this.state(); },
    nextCan() { const s = this.state(); return s.can + 1 < this.CAN.length ? this.CAN[s.can + 1] : null; },
    buyCan() { const s = this.state(); s.can++; this._set(s); },
    buyFert() { const s = this.state(); s.fert++; this._set(s); },
};
