// ═══════════════════════════════════════════════════════════════════════════
// Tower.js — the endless climb.
//
// A run is a chain of GameScene restarts at levelIndex 6 with `tower` in the scene data:
// { seed, floor, hp, gems, glorps0, t0 }. Each floor is one arena (generateTowerArena, seeded
// by seed + floor, so any floor can be rebuilt exactly), cleared in waves drawn from a points
// budget out of a pool that grows with the floor, in the order the story introduced them.
// Every BOSS_EVERY-th floor is a boss instead. Clearing a floor pays glorps, heals a little
// and opens the way up (a rift in the middle of the arena); dying ends the run, keeping the
// glorps. Your best floor is saved (tower_best) and the death screen shows it (towerRun).
//
// Enemies are scaled by the tower's own curve (towerScaling: HP ×1.12 and damage ×1.07 a
// floor on top of where the story ends), through the same enemyHealthScale /
// enemyDamageScale every enemy factory already reads.
//
// GameScene calls: generateTowerArena (from generateWorld), towerScaling (from
// applyFloorScaling), _towerBegin (end of create), _towerUpdate (every frame).
// ═══════════════════════════════════════════════════════════════════════════

class TowerFloors {

    static CFG = {
        BASE_HP: 2.2, BASE_DMG: 1.41,    // floor 1 = where the Cistern leaves you (story ×1.15 / ×1.09, four steps); HP 1.75 till 2026-10-22: mid gear reached floor 13-15, not ~10
        HP_STEP: 1.08, DMG_STEP: 1.07,   // HP 1.12 till 2026-10-20: a wall by floor ~40
        CROWD0: 8, CROWD_EVERY: 4, CROWD_CAP: 24, WAVES: 3,
        PAY0: 10, PAY_GROWTH: 1.12, BOSS_PAY: 5, BOSS_EVERY: 10,
        KILL_SHARE: 0.6, KILL_DUST: 0.5, SEED_FLOOR: 0.2, BOOK0: 0.02, BOOK_STEP: 0.006, BOOK_MAX: 0.3,   // BOOK_*: a floor's sealed-book chance, bookChance(); KILL_DUST: this share of the floor's dust comes off its kills too   // a floor's pay: this share comes off its kills (the rest on the clear); a seed / a sealed book per floor, rolled per kill
        HEAL_ON_CLEAR: 0.15,             // of max HP, when a floor is cleared
        INTRO: [0.45, 0.6, 0.72, 0.84, 0.93],   // floors 1-5: HP and damage eased in by these (2026-10-20: floor 1 at full strength was no introduction)
        INTRO_CROWD: [5, 6, 7],          // and fewer of them on floors 1-3
        TELEGRAPH_MS: 800, WAVE_GAP_MS: 1200,
    };

    // The pool, in story order: cost (budget points) and the first floor it can appear on.
    // `make` gets (scene, x, y) and returns the enemy; room 0 is the arena.
    static POOL = [
        { id: 'slime',     cost: 1, from: 1, role: 'melee',  make: (S, x, y) => S.createEnemy(x, y) },
        { id: 'ranged',    cost: 2, from: 2, role: 'ranged',  make: (S, x, y) => S.createRangedEnemy(x, y, 0) },
        { id: 'berserker', cost: 3, from: 3, role: 'melee',  make: (S, x, y) => S.createBerserker(x, y, 0) },
        { id: 'splitter',  cost: 2, from: 4, role: 'melee',  make: (S, x, y) => S.createSplitter(x, y, 0) },
        { id: 'mortar',    cost: 3, from: 6, role: 'ranged',  make: (S, x, y) => S.createMortar(x, y, 0) },
        { id: 'rooter',    cost: 3, from: 7, role: 'ranged',  make: (S, x, y) => S.createRooter(x, y, 0) },
        { id: 'healer',    cost: 3, from: 8, role: 'support',  make: (S, x, y) => S.createHealerTotem(x, y, 0) },
        { id: 'anchor',    cost: 4, from: 12, role: 'support', make: (S, x, y) => S.createAnchorSlime(x, y, 0) },
        { id: 'leech',     cost: 2, from: 7, role: 'ranged',  make: (S, x, y) => S.createLeech(x, y, 0) },
        { id: 'diver',     cost: 3, from: 9, role: 'ranged',  make: (S, x, y) => S.createTorpedoDiver(x, y, 0) },
        { id: 'wraith',    cost: 4, from: 12, role: 'support', make: (S, x, y) => S.createWraith(x, y, 0) },
        { id: 'cheer',     cost: 3, from: 9, role: 'support', make: (S, x, y) => S.createCheerleader(x, y, 0) },
        { id: 'gem',       cost: 5, from: 14, role: 'elite', make: (S, x, y) => (S.enemies || []).some(e => e._isGem && e.sprite?.active) ? S.createEnemy(x, y) : S.createGem(x, y, 0) },   // one at a time
        { id: 'ceo',       cost: 6, from: 16, role: 'elite', make: (S, x, y) => S.createSlimeCeo(x, y, 0) },
        { id: 'shade',     cost: 8, from: 18, role: 'elite', make: (S, x, y) => S.createAdaptiveShade(x, y, 0) },
        { id: 'armored',   cost: 4, from: 8, role: 'melee',  make: (S, x, y) => S.createArmoredSlime(x, y, 0) },
        { id: 'hunter',    cost: 4, from: 11, role: 'melee', make: (S, x, y) => S.createHunterSlime(x, y, 0) },
        { id: 'bud',       cost: 3, from: 10, role: 'melee', make: (S, x, y) => S.createBuddingSlime(x, y, 0) },
        { id: 'sniper',    cost: 3, from: 14, role: 'ranged', make: (S, x, y) => S.createUpgradedSniper(x, y, 0) },
        // the Void Rift's, the Fracture's and the Cistern's, later up (water kinds only on a floor with pools: `water`)
        { id: 'lightningelem', cost: 3, from: 8,  role: 'ranged',  make: (S, x, y) => S.createLightningElemental(x, y, 0) },
        { id: 'voidsniper',    cost: 3, from: 9,  role: 'ranged',  make: (S, x, y) => S.createVoidSniper(x, y, 0) },
        { id: 'singularity',   cost: 4, from: 11, role: 'melee',   make: (S, x, y) => S.createSingularitySlime(x, y, 0) },
        { id: 'encased',       cost: 4, from: 13, role: 'ranged',  make: (S, x, y) => S.createEncasedSlime(x, y, 0) },
        { id: 'frost',         cost: 5, from: 15, role: 'elite',   make: (S, x, y) => S.createFrostSlime(x, y, 0) },
        { id: 'drowner',       cost: 3, from: 15, role: 'melee',   water: true, make: (S, x, y) => S.createDrowner(x, y, 0) },
        { id: 'ripplerunner',  cost: 3, from: 15, role: 'ranged',  water: true, make: (S, x, y) => S.createRipplerunner(x, y, 0) },
        { id: 'tidecaller',    cost: 4, from: 17, role: 'support', water: true, make: (S, x, y) => S.createTidecaller(x, y, 0) },
        { id: 'waverider',     cost: 4, from: 17, role: 'melee',   water: true, make: (S, x, y) => S.createWaveRider(x, y, 0) },
        { id: 'tidalguard',    cost: 4, from: 19, role: 'ranged',  water: true, make: (S, x, y) => S.createTidalGuard(x, y, 0) },
        { id: 'wishingwell',   cost: 4, from: 19, role: 'support', water: true, make: (S, x, y) => S.createWishingWell(x, y, 0) },
        { id: 'conduit',       cost: 4, from: 20, role: 'ranged',  water: true, make: (S, x, y) => S.createConduit(x, y, 0) },
    ];
    // A normal floor's PLAN (from floor PLAN_FROM): how many come (count), how strong each can be (budget), who's
    // likelier (roles), and the layouts that suit it. Rolled with the arena (generateTowerArena), named in the banner.
    static PLAN_FROM = 4;
    static PLANS = {
        mixed: { name: '',              w: 4,   count: 1,    budget: 1,   roles: {},                  layouts: ['pillars', 'bunkers', 'cross', 'ring', 'columns', 'lanes', 'pools'] },
        swarm: { name: 'A SWARM',       w: 2,   count: 1.5,  budget: 0.55, roles: { melee: 2.5 },     layouts: ['lanes', 'cross', 'ring'] },
        elite: { name: 'ELITES',        w: 1.5, count: 0.55, budget: 2.2, roles: { elite: 4, melee: 0.6 }, heavy: true, layouts: ['ring', 'pillars'] },   // heavy: dearer kinds likelier
        nest:  { name: "SNIPERS' NEST", w: 1.5, count: 1,    budget: 1,   roles: { ranged: 3 },       layouts: ['columns', 'bunkers'] },
        brawl: { name: 'A BRAWL',       w: 1.5, count: 1.15, budget: 1,   roles: { melee: 3 },        layouts: ['pillars', 'cross', 'pools'] },
        court: { name: 'THE COURT',     w: 1,   count: 0.9,  budget: 1.2, roles: { support: 3, elite: 1.5 }, layouts: ['ring', 'bunkers', 'pools'] },
    };
    static rollPlan(floor, R) {
        if (floor < TowerFloors.PLAN_FROM) return 'mixed';
        const P = Object.entries(TowerFloors.PLANS), tot = P.reduce((a, [, p]) => a + p.w, 0);
        let r = R() * tot;
        for (const [id, p] of P) if ((r -= p.w) < 0) return id;
        return 'mixed';
    }
    static BOSSES = ['voltslime', 'sovereign', 'brood', 'geode'];   // floor 10, 20, 30, 40, then round again

    // Floor twists: every TWIST_EVERY-th floor from floor 5 (boss floors aside) bends one
    // rule, borrowed from the story where it can be. `from`: the first floor it can roll on.
    // A twist floor pays TWIST_PAY more.
    static TWIST_EVERY = 4;
    static TWIST_PAY = 1.25;
    static TWISTS = [
        { id: 'flood',  name: 'FLOODED', from: 5,  text: 'The floor is water. Ice runs on it, lightning loves it.' },
        { id: 'swarm',  name: 'SWARM',   from: 5,  text: 'Half again as many, each a little weaker.' },
        { id: 'frenzy', name: 'FRENZY',  from: 9,  text: 'They move faster.' },
        { id: 'warded', name: 'WARDED',  from: 13, text: 'Every one resists an element. Switch.' },
        { id: 'shift',  name: 'SHIFTING', from: 5, text: 'The walls move between waves.' },
    ];
    static twistOf(floor, seed) {
        if (floor < 5 || floor % TowerFloors.CFG.BOSS_EVERY === 0 || floor % TowerFloors.TWIST_EVERY !== 1) return null;
        const can = TowerFloors.TWISTS.filter(t => t.from <= floor);
        let h = Math.imul((seed >>> 0) ^ Math.imul(floor, 0x9E3779B1), 0x85EBCA6B);   // a hash, so neighbouring floors don't fall into a pattern
        h ^= h >>> 13; h = Math.imul(h, 0xC2B2AE35); h ^= h >>> 16;
        return can[(h >>> 0) % can.length];
    }

    // ── ART ───────────────────────────────────────────────────────────────────
    // The way up: a stone dais in 3/4 view, runes going round its rim, gold light spiralling
    // into the well, chevrons rising out of it (48px, 8 frames).
    static exitKey(scene) {
        const key = 'tower_exit';
        if (typeof ShopScene === 'undefined' || !ShopScene.icon) return key;
        return ShopScene.icon(scene, key, 48, { d: '#2a2436', s: '#5a5270', S: '#8a82a4', D: '#3a3350', n: '#140c26', v: '#3a1e5a', o: '#ffb02a', y: '#ffe066', Y: '#fff6c0', w: '#ffffff', g: '#ffe9a0' }, (m, f) => {
            const ell = (cx, cy, rx, ry, c) => { for (let y = 0; y < 48; y++) for (let x = 0; x < 48; x++) if (((x + 0.5 - cx) / rx) ** 2 + ((y + 0.5 - cy) / ry) ** 2 <= 1) m.set(x, y, c); };
            const X = 24, Y = 32, ph = f / 8 * Math.PI * 2;
            for (const sx of [3, 41]) {                                        // two standing stones behind it, runes lit in turn
                m.rect(sx, 8, 5, 20, 's'); m.rect(sx, 8, 1, 20, 'S'); m.rect(sx + 4, 8, 1, 20, 'D'); m.rect(sx + 1, 6, 3, 2, 's');
                for (let k = 0; k < 4; k++) m.rect(sx + 2, 11 + k * 4, 1, 2, (k + f + (sx > 20 ? 2 : 0)) % 4 === 0 ? 'Y' : 'o');
                m.disc(sx + 2.5, 4.5, 1.6 + (f % 2) * 0.4, 'y'); m.set(sx + 2, 4, 'w');   // a flame of the same gold on top
            }
            ell(X, Y + 3, 21, 11.5, 'd'); ell(X, Y, 21, 11.5, 's');           // the dais: its side, its top
            for (let k = 0; k < 16; k++) {                                     // the stones of its rim
                const a = k / 16 * Math.PI * 2;
                m.line(X + Math.cos(a) * 17, Y + Math.sin(a) * 9.4, X + Math.cos(a) * 20.5, Y + Math.sin(a) * 11.2, 'D');
                if (Math.sin(a + 0.2) < -0.2) m.set(X + Math.cos(a + 0.2) * 19.5, Y + Math.sin(a + 0.2) * 10.6, 'S');
            }
            ell(X, Y, 16.5, 9, 'D'); ell(X, Y + 0.6, 15, 8, 'n'); ell(X, Y + 1, 10, 5.2, 'v');   // the lip, the well
            for (let k = 0; k < 6; k++) {                                      // runes, going round
                const a = k / 6 * Math.PI * 2 + ph / 6, x = X + Math.cos(a) * 18.7, y = Y + Math.sin(a) * 10.2;
                const c = k === f % 6 ? 'w' : 'y';
                m.set(x, y, c); m.set(x + 1, y, c); m.set(x, y - 1, 'o');
            }
            for (let arm = 0; arm < 3; arm++) {                                // light spiralling in
                for (let k = 0; k <= 20; k++) {
                    const t = k / 20, a = arm * 2.094 + t * 3.4 - ph * 0.5, r = (1 - t) * 13.5;
                    m.set(X + Math.cos(a) * r, Y + 1 + Math.sin(a) * r * 0.55, t < 0.45 ? 'o' : t < 0.8 ? 'y' : 'Y');
                }
            }
            ell(X, Y + 1, 3.2, 1.8, 'Y'); m.rect(X - 1, Y, 2, 1, 'w');
            for (let i = 0; i < 3; i++) {                                      // chevrons rising: up
                const yy = 27 - ((f * 3 + i * 8) % 24);
                for (let d = 0; d <= 3; d++) { m.set(X - d, yy + d, 'g'); m.set(X - 1 + d + 1, yy + d, 'g'); }
            }
        }, 8);
    }
    // The shrine: a stone pedestal with a carved rune, a bowl on top, and a boon crystal turning
    // over it (32px, 8 frames).
    static shrineKey(scene) {
        const key = 'tower_shrine';
        if (typeof ShopScene === 'undefined' || !ShopScene.icon) return key;
        return ShopScene.icon(scene, key, 32, { d: '#2a2e3a', s: '#566070', S: '#8a96a8', D: '#1c4a40', t: '#2a8a70', T: '#7ae0c0', a: '#7ae0c0', A: '#d8fff2', E: '#2f9a7e', w: '#ffffff', g: '#b8fff0' }, (m, f) => {
            const ell = (cx, cy, rx, ry, c) => { for (let y = 0; y < 32; y++) for (let x = 0; x < 32; x++) if (((x + 0.5 - cx) / rx) ** 2 + ((y + 0.5 - cy) / ry) ** 2 <= 1) m.set(x, y, c); };
            ell(16, 29.5, 11, 2.4, 'd'); m.rect(5, 26, 22, 4, 'd'); ell(16, 26, 11, 2.4, 's'); m.rect(7, 26, 2, 3, 's');   // the base slab
            m.rect(10, 15, 12, 11, 's'); m.rect(10, 15, 2, 11, 'S'); m.rect(20, 15, 2, 11, 'd');   // the column, lit from the left
            m.rect(10, 16, 12, 1, 'D'); m.rect(10, 24, 12, 1, 'D'); m.rect(12, 16, 8, 1, 't'); m.rect(12, 24, 8, 1, 't');   // carved bands, teal in the grooves
            const lit = [0, 1, 2, 2, 1, 0, 0, 0][f];
            m.poly([[16, 17], [18.5, 20], [16, 23], [13.5, 20]], lit ? 'T' : 't'); m.set(16, 20, lit > 1 ? 'w' : 'a');   // its rune
            ell(16, 14.5, 9, 3, 'd'); ell(16, 14, 8, 2.4, 's'); ell(16, 14, 6.5, 1.7, 'D'); ell(16, 14, 4.5, 1, 'T');   // the bowl, glowing
            const by = 6 + [0, 0, -1, -1, -1, -1, 0, 0][f], fx = 16 + 3.6 * Math.sin(f / 8 * Math.PI * 2);   // the crystal, turning: its facet edge sweeps across
            const gem = [[16, by - 6], [20.5, by - 2], [20.5, by + 2], [16, by + 6], [11.5, by + 2], [11.5, by - 2]];
            m.poly(gem, 'a');
            m.poly([[16, by - 6], [fx, by - 2], [fx, by + 2], [16, by + 6], [11.5, by + 2], [11.5, by - 2]], 'A');
            m.line(fx, by - 2, fx, by + 2, 'E'); m.line(19.5, by - 1, 19.5, by + 2, 'E');
            m.set(14, by - 3, 'w'); m.set(13, by - 1, 'w');
            for (let i = 0; i < 2; i++) { const a = f / 8 * Math.PI * 2 + i * Math.PI; m.set(16 + Math.cos(a) * 7, by + Math.sin(a) * 2.5, 'g'); }   // motes round it
        }, 8);
    }

    // ── PICKS ────────────────────────────────────────────────────────────
    // A choice of 3 every PICK_EVERY floors and after every boss; more for scraps (a reroll,
    // or the shrine on the other floors). Each pick has tiers; what they add up to is
    // TowerFloors.mods(picks), which the game reads as towerRun.mods.
    static PICK_EVERY = 3;
    static SHRINE_COST = 15;
    static PICKS = [
        { id: 'might',    name: 'Whetstone',   max: 5, col: 0xffb04a, text: t => `+${8 * t}% damage` },
        { id: 'vigor',    name: 'Thick Skin',  max: 5, col: 0xff6a6a, text: t => `+${15 * t} max HP` },
        { id: 'guard',    name: 'Hardened',    max: 5, col: 0x9ab0c8, text: t => `${Math.round(100 * (1 - Math.pow(0.93, t)))}% less damage taken` },
        { id: 'fire',     name: 'Kindled',     max: 5, col: 0xff8844, el: 'fire',      text: t => `your first 3 hits after switching to fire deal +${12 * t}%` },
        { id: 'ice',      name: 'Frostbitten', max: 5, col: 0x88eeff, el: 'ice',       text: t => `your first 3 hits after switching to ice deal +${12 * t}%` },
        { id: 'lightning',name: 'Overcharged', max: 5, col: 0xffe14a, el: 'lightning', text: t => `your first 3 hits after switching to lightning deal +${12 * t}%` },
        { id: 'cosmic',   name: 'Starlit',     max: 5, col: 0xb388ff, el: 'cosmic',    text: t => `your first 3 hits after switching to cosmic deal +${12 * t}%` },
        { id: 'fusion',   name: 'Fusion',      max: 3, col: 0xe0a8ff, text: t => `reactions deal +${10 * t}% damage` },
        { id: 'gems',     name: 'Quick Gems',  max: 5, col: 0xd8a8ff, text: t => `ults charge ${12 * t}% faster` },
        { id: 'crescendo', name: 'Crescendo',  max: 5, col: 0xe8c8ff, text: t => `ults deal +${10 * t}% damage` },
        { id: 'catalyst', name: 'Catalyst',    max: 3, col: 0x7ae0c0, text: t => `reactions charge ${25 * t}% more` },
        { id: 'swift',    name: 'Light Feet',  max: 3, col: 0xa8e07a, text: t => `${7 * t}% faster movement` },
        { id: 'leech',    name: 'Leech',       max: 5, col: 0xe05a7a, text: t => `kills heal ${t} HP` },
        { id: 'thorns',   name: 'Spiked Hide', max: 5, col: 0xc8a070, text: t => `melee hits on you deal ${5 * t} back` },
        { id: 'greed',    name: 'Greed',       max: 5, col: 0xffd34a, text: t => `floors pay ${15 * t}% more glorps` },
        { id: 'mend',     name: 'Second Wind', max: 3, col: 0x9be08a, text: t => `a cleared floor heals ${10 * t}% more` },
        { id: 'keen',     name: 'Keen Edge',   max: 5, col: 0xffd34a, text: t => `${5 * t}% of your hits crit (×1.5)` },
    ];
    // A boon's icon: 16px pixel art in its own colour (ShopScene.icon). `a` its colour, `b` a
    // lighter one, `w` the highlight.
    static pickIcon(scene, p) {
        const key = 'tw_pick_' + p.id;
        if (typeof ShopScene === 'undefined' || !ShopScene.icon) return null;
        const hex = c => '#' + c.toString(16).padStart(6, '0');
        const lite = c => hex([16, 8, 0].reduce((v, sh) => v | (Math.min(255, ((c >> sh) & 255) + 70) << sh), 0));
        return ShopScene.icon(scene, key, 16, { a: hex(p.col), b: lite(p.col), w: '#ffffff', d: '#3a2a1a', s: '#8a8aa0' }, (m) => {
            const D = {
                might:    () => { m.line(3, 12, 11, 4, 's'); m.line(4, 12, 12, 4, 'w'); m.line(4, 13, 12, 5, 's'); m.rect(2, 11, 3, 1, 'a'); m.rect(3, 10, 1, 3, 'a'); m.set(2, 13, 'd'); },
                vigor:    () => { m.disc(5.5, 6, 3, 'a'); m.disc(10.5, 6, 3, 'a'); m.poly([[2.6, 7], [13.4, 7], [8, 13.5]], 'a'); m.set(5, 5, 'w'); m.set(4, 6, 'b'); },
                guard:    () => { m.poly([[3, 3], [13, 3], [13, 8], [8, 14], [3, 8]], 'a'); m.poly([[5, 5], [11, 5], [11, 8], [8, 11.5], [5, 8]], 'b'); m.line(8, 4, 8, 12, 'w'); },
                fire:     () => { m.poly([[8, 1.5], [12.5, 8], [11.5, 13], [4.5, 13], [3.5, 8], [6, 9]], 'a'); m.poly([[8, 6], [10.5, 10], [10, 13], [6, 13], [5.5, 10]], 'b'); m.set(8, 11, 'w'); },
                ice:      () => { for (const [dx, dy] of [[0, 1], [1, 0], [1, 1], [1, -1]]) { m.line(8 - dx * 6, 8 - dy * 6, 8 + dx * 6, 8 + dy * 6, dx && dy ? 'b' : 'a'); } m.set(8, 8, 'w'); },
                lightning:() => { m.poly([[9.5, 1.5], [4, 9], [7.5, 9], [6, 14.5], [12, 6.5], [8.5, 6.5]], 'a'); m.line(8.5, 3, 6, 8, 'w'); },
                cosmic:   () => { m.poly([[8, 1.5], [9.6, 6.2], [14.5, 6.4], [10.6, 9.4], [12, 14.2], [8, 11.3], [4, 14.2], [5.4, 9.4], [1.5, 6.4], [6.4, 6.2]], 'a'); m.disc(8, 8, 1.6, 'b'); m.set(7, 7, 'w'); },
                gems:     () => { m.poly([[4, 6], [6, 3], [10, 3], [12, 6], [8, 13]], 'a'); m.poly([[6, 6], [7, 4], [9, 4], [10, 6], [8, 10]], 'b'); m.set(7, 5, 'w'); m.line(4, 6, 12, 6, 'b'); },
                catalyst: () => { m.rect(6, 2, 4, 4, 's'); m.poly([[6, 6], [10, 6], [13, 13], [3, 13]], 'a'); m.poly([[5, 10], [11, 10], [12.5, 13], [3.5, 13]], 'b'); m.set(7, 11, 'w'); m.set(9, 8, 'w'); },
                swift:    () => { m.poly([[4, 4], [8, 4], [8, 9], [13, 10], [13, 13], [4, 13]], 'a'); m.rect(4, 11, 9, 2, 'b'); for (let i = 0; i < 3; i++) m.line(1, 6 + i * 2, 3, 6 + i * 2, 'w'); },
                leech:    () => { m.poly([[8, 2], [12, 8], [11, 12], [8, 14], [5, 12], [4, 8]], 'a'); m.disc(8, 10, 2.5, 'b'); m.set(7, 9, 'w'); },
                thorns:   () => { m.disc(8, 9, 4, 'a'); for (let k = 0; k < 6; k++) { const t = k / 6 * Math.PI * 2; m.line(8 + Math.cos(t) * 4, 9 + Math.sin(t) * 4, 8 + Math.cos(t) * 7, 9 + Math.sin(t) * 7, 'b'); } m.set(7, 8, 'w'); },
                greed:    () => { m.disc(8, 8, 6, 'a'); m.ring(8, 8, 6, 1, 'd'); m.disc(8, 8, 3.5, 'b'); m.rect(7, 5, 2, 6, 'a'); m.set(6, 5, 'w'); },
                keen:     () => { m.poly([[3, 13], [12, 2], [14, 4], [5, 14]], 's'); m.line(4, 13, 13, 3, 'w'); m.poly([[8, 5], [9, 3], [10, 5], [12, 6], [10, 7], [9, 9], [8, 7], [6, 6]], 'a'); },
                crescendo:() => { m.ring(8, 9, 5.5, 1.2, 'a'); m.ring(8, 9, 3, 1, 'b'); m.disc(8, 9, 1.2, 'w'); for (let k = 0; k < 3; k++) m.line(3 + k * 4, 3, 5 + k * 4, 1, 'w'); },
                fusion:   () => { m.disc(5.5, 8, 4, 'a'); m.disc(10.5, 8, 4, 'b'); m.disc(8, 8, 2, 'w'); for (let k = 0; k < 4; k++) m.set(8 + Math.cos(k * 1.57) * 6, 8 + Math.sin(k * 1.57) * 6, 'w'); },
                mend:     () => { m.rect(6, 2, 4, 12, 'a'); m.rect(2, 6, 12, 4, 'a'); m.rect(7, 3, 2, 10, 'b'); m.rect(3, 7, 10, 2, 'b'); m.set(7, 7, 'w'); },
            };
            (D[p.id] || D.might)();
        });
    }

    // What a set of picks ({ id: tier }) adds up to.
    static mods(picks = {}) {
        const t = id => picks[id] || 0;
        return {
            dmg: 1 + 0.08 * t('might'), hp: 15 * t('vigor'), taken: Math.pow(0.93, t('guard')),
            // the element boons pay for switching INTO the element, not for staying on it
            swapBy: Object.fromEntries(['fire', 'ice', 'lightning', 'cosmic'].filter(e => t(e)).map(e => [e, { hits: 3, bonus: 0.12 * t(e) }])),
            reactDmg: 1 + 0.1 * t('fusion'),
            ult: 1 + 0.12 * t('gems'), ultDmg: 1 + 0.1 * t('crescendo'), react: 1 + 0.25 * t('catalyst'), speed: Math.pow(0.93, t('swift')),
            leech: t('leech'), thorns: 5 * t('thorns'), pay: 1 + 0.15 * t('greed'), heal: 0.1 * t('mend'), crit: 0.05 * t('keen'),
        };
    }

    // ── RUN STATE ─────────────────────────────────────────────────────────────
    static best() { try { return parseInt(localStorage.getItem('tower_best') || '0', 10) || 0; } catch (e) { return 0; } }
    static pay(floor) {
        const C = TowerFloors.CFG;
        return Math.round(C.PAY0 * Math.pow(C.PAY_GROWTH, floor - 1) * (floor % C.BOSS_EVERY === 0 ? C.BOSS_PAY : 1));
    }
    // A normal floor's chance of a sealed book: small early, growing with the floor (2% on floor 1, 8% on 10, 14% on 20, capped
    // at 30% from floor ~47). A flat 25% dropped ~10 books in half an hour of floor 1-4 climbs, 3,000 glorps of Glurp's books.
    static bookChance(floor) { const C = TowerFloors.CFG; return Math.min(C.BOOK_MAX, C.BOOK0 + C.BOOK_STEP * floor); }
    // How many enemies a floor holds, across its waves.
    // ── LOOT YOU SEE ── a kill drops its share of the floor's pay as glorp coins that fly to your counter, and now and then a seed
    // or a sealed book that pops out of it and into you. (A non-boss floor's seed and book chances are spread over its kills.)
    static onKill(S, e) {
        const T = S.towerRun, C = TowerFloors.CFG;
        if (!T || T.state === 'clear' || !e?.sprite) return;
        if (e._budCopy) return;   // a bud's copy drops nothing (the clear pays its share)
        // a splitter's family counts as one enemy: a third for the big one, a sixth for each half, a twelfth for each quarter
        const w = e.isSplitter ? 1 / (3 * 2 ** (e._splitterTier || 0)) : 1;
        const x = e.sprite.x, y = e.sprite.y - 6, pay = TowerFloors.pay(T.floor) * (S._mods?.pay ?? 1) * (T.twist ? TowerFloors.TWIST_PAY : 1);
        const budget = Math.round(pay * C.KILL_SHARE), each = Math.max(1, Math.round(budget / (T.total || TowerFloors.crowd(T.floor)))), give = Math.min(Math.round(each * w), budget - (T.killPaid || 0));
        if (give > 0) { T.killPaid = (T.killPaid || 0) + give; TowerFloors.flyGlorps(S, x, y, give); }
        const dustAll = TowerFloors.floorDust(T), dEach = Math.max(1, Math.round(dustAll * C.KILL_DUST / (T.total || TowerFloors.crowd(T.floor)))), dGive = Math.min(Math.round(dEach * w), Math.round(dustAll * C.KILL_DUST) - (T.killDust || 0));
        if (dGive > 0 && typeof Enchants !== 'undefined') { T.killDust = (T.killDust || 0) + dGive; Enchants.addDust(dGive); TowerFloors.flyDust(S, x, y, dGive, true); }
        T.lastKill = { x, y };   // where the clear's dust comes out
        if (T.boss) return;   // a boss floor pays its loot on the clear
        const n = T.total || TowerFloors.crowd(T.floor);
        if (typeof Garden !== 'undefined' && Math.random() < C.SEED_FLOOR * w / n) {
            const id = Garden.drop(T.floor, true), got = Garden.give(id), Sd = Garden.seed(id);
            const tex = typeof GardenScene !== 'undefined' ? GardenScene.prototype._seedTex.call(S, Sd) : null;
            TowerFloors.dropItem(S, x, y, tex, null, got.dust ? `${Sd.name} seed: +${got.dust} dust` : `+1 ${Sd.name} seed`, UIKit._hex(Sd.col), 3);
        }
        if (Math.random() < TowerFloors.bookChance(T.floor) * w / n) {
            Enchants.addBooks(1); T.books = (T.books || 0) + 1;
            TowerFloors.dropItem(S, x, y, ShopScene.bookIcon?.(S, -1), 0, '+1 sealed book', '#d8a8ff', 1.4);
        }
    }
    // Glorp coins burst out of (x, y) in the world and fly to the counter, which counts up as each one lands
    static flyGlorps(S, x, y, amount) {
        const cam = S.cameras.main, sx = (x - cam.worldView.x) * cam.zoom, sy = (y - cam.worldView.y) * cam.zoom;
        if (S.glorpText?.active) S.glorpText.setText(`✦ ${(S.totalGlorps || 0) - (S._glorpFlying || 0)} Glorps`);
        const gt = S.glorpText, coin = S._hudCoin?.active ? S._hudCoin : null, b = gt?.getBounds?.();
        const tx = coin ? coin.x : b ? b.x + 14 : S.scale.width - 120, ty = coin ? coin.y : b ? b.centerY : 20;
        const n = Math.min(12, 5 + Math.floor(Math.log2(amount + 1))), per = amount / n;   // always a handful, more for a bigger pay
        // banked now (a floor left before the coins land loses nothing); the counter only catches up as they arrive
        S._glorpFlying = (S._glorpFlying || 0) + amount;
        S.totalGlorps = (S.totalGlorps || 0) + amount;
        try { localStorage.setItem('glorps', S.totalGlorps); } catch (e) {}
        let shown = 0;
        for (let i = 0; i < n; i++) {
            const c = S.textures.exists('cfx_bits') ? S.add.image(sx, sy, 'cfx_bits', 'glorp') : S.add.circle(sx, sy, 4, 0x5dffb8);
            c.setScrollFactor(0).setDepth(35).setScale(3); S._vfxSort?.(c);
            const a = Math.random() * Math.PI * 2, r = 18 + Math.random() * 26, ox = sx + Math.cos(a) * r, oy = sy + Math.sin(a) * r * 0.7 - 10;
            S.tweens.add({ targets: c, x: ox, y: oy, duration: 220, ease: 'Quad.easeOut', onComplete: () =>   // out in a burst...
                S.tweens.add({ targets: c, x: tx, y: ty, scale: 1.6, duration: 420 + i * 55, delay: 120, ease: 'Cubic.easeIn', onComplete: () => {   // ...then home
                    c.destroy();
                    const add = (i === n - 1 ? amount : Math.round(per * (i + 1))) - shown; shown += add;   // running total: more coins than glorps never overshoots
                    S._glorpFlying = Math.max(0, (S._glorpFlying || 0) - add);
                    // the counter: the banked total less what's still flying (right whatever else pays)
                    if (gt?.active) { gt.setText(`✦ ${S.totalGlorps - S._glorpFlying} Glorps`); S.tweens.killTweensOf(gt); gt.setScale(1.18); S.tweens.add({ targets: gt, scale: 1, duration: 160, ease: 'Quad.easeOut' }); }
                    if (coin?.active) { S.tweens.killTweensOf(coin); coin.setScale(3.3); S.tweens.add({ targets: coin, scale: 2.6, duration: 160, ease: 'Quad.easeOut' }); }
                    if (i % 2 === 0) Sfx.play(S, 'coin');   // a dozen at once is noise
                } }) });
        }
    }
    // Dust for the Isle: a stream of violet motes out of (x, y) and into you, the amount over you when they're in
    static floorDust(T) { return (T.boss ? 60 : 6) + Math.floor(T.floor / 2); }
    static flyDust(S, x, y, amount, quiet = false) {   // quiet: a kill's pinch (no label; the clear says the total)
        const p = S.player; if (!p?.active) return;
        const n = quiet ? 3 : Math.max(6, Math.min(18, Math.round(amount / 3)));
        for (let i = 0; i < n; i++) {
            const m = S.add.image(x, y, 'vfx_dot').setTint(i % 3 ? 0xc8b8ff : 0xffffff).setBlendMode(Phaser.BlendModes.ADD).setScale(0.5 + Math.random() * 0.4).setDepth(6);
            const a = Math.random() * Math.PI * 2, r = 14 + Math.random() * 30, ox = x + Math.cos(a) * r, oy = y + Math.sin(a) * r * 0.7 - 12, q = { t: 0 };
            S.tweens.add({ targets: m, x: ox, y: oy, duration: 260, ease: 'Quad.easeOut', onComplete: () =>
                S.tweens.add({ targets: q, t: 1, duration: 380 + i * 35, delay: 100, ease: 'Cubic.easeIn', onUpdate: () => { m.setPosition(ox + (p.x - ox) * q.t, oy + (p.y - 10 - oy) * q.t - Math.sin(Math.PI * q.t) * 24); },
                    onComplete: () => { m.destroy(); if (i === n - 1 && !quiet) { S.showStatusText(p.x, p.y - 70, `+${amount} DUST`, '#c8b8ff'); S._vfxFlash?.(p.x, p.y - 8, 24, 0xb48cff, 200, 0.6); } if (i % 3 === 0) Sfx.play(S, 'pickup'); } }) });
        }
    }
    // An item popping out of (x, y): up in an arc, a bounce, a moment on the floor, then into you, its name over you
    static dropItem(S, x, y, key, frame, label, colour, scale = 2) {
        const p = S.player; if (!p?.active) return;
        const o = key && S.textures.exists(key) ? S.add.image(x, y, key, frame ?? undefined) : S.add.star(x, y, 5, 3, 7, 0xffe08a);
        o.setScale(scale).setDepth(6);
        const glow = S.add.image(x, y, 'vfx_glow').setTint(Phaser.Display.Color.HexStringToColor(colour).color).setBlendMode(Phaser.BlendModes.ADD).setScale(0.35).setAlpha(0.7).setDepth(5.9);
        const lx = x + (Math.random() - 0.5) * 30, ly = y + 6, q = { t: 0 };
        S.tweens.add({ targets: q, t: 1, duration: 420, ease: 'Linear', onUpdate: () => { const k = q.t, hop = Math.sin(Math.PI * k) * 26; o.setPosition(x + (lx - x) * k, y + (ly - y) * k - hop).setRotation(k * 6); glow.setPosition(o.x, o.y); },
            onComplete: () => {
                o.setRotation(0); S.tweens.add({ targets: o, y: ly - 6, duration: 140, yoyo: true, ease: 'Quad.easeOut' });   // the bounce
                S.time.delayedCall(450, () => { if (!o.active) return;
                    const r = { t: 0 }, fx = o.x, fy = o.y;
                    S.tweens.add({ targets: r, t: 1, duration: 320, ease: 'Cubic.easeIn', onUpdate: () => { o.setPosition(fx + (p.x - fx) * r.t, fy + (p.y - 10 - fy) * r.t).setScale(scale * (1 - 0.5 * r.t)); glow.setPosition(o.x, o.y); },
                        onComplete: () => { o.destroy(); glow.destroy(); S._vfxFlash?.(p.x, p.y - 8, 26, Phaser.Display.Color.HexStringToColor(colour).color, 200, 0.6); Sfx.play(S, 'pickup'); S.showStatusText(p.x, p.y - 34, label.toUpperCase(), colour); } });
                });
            } });
    }
    static crowd(floor) { const C = TowerFloors.CFG; return C.INTRO_CROWD[floor - 1] ?? Math.min(C.CROWD_CAP, C.CROWD0 + Math.floor((floor - 1) / C.CROWD_EVERY)); }
    // Scene data for a fresh run, from floor 1 or a later one (a skip: owed catch-up boons).
    static newRun(floor = 1) { return { seed: (Math.random() * 1e9) | 0, floor, t0: Date.now(), best0: TowerFloors.best(), owed: TowerFloors.owed(floor) }; }
    // Skipping: start on any floor up to your best minus SKIP_BACK, for twice what it pays (boss bonus aside).
    static SKIP_BACK = 3;
    static maxStart() { return Math.max(1, TowerFloors.best() - TowerFloors.SKIP_BACK); }
    static fee(floor) { const C = TowerFloors.CFG; return floor <= 1 ? 0 : 2 * Math.round(C.PAY0 * Math.pow(C.PAY_GROWTH, floor - 1)); }
    // The boons floors 1 to floor-1 would have given (every PICK_EVERY floors and every boss).
    static owed(floor) { let n = 0; for (let f = 1; f < floor; f++) if (f % TowerFloors.PICK_EVERY === 0 || f % TowerFloors.CFG.BOSS_EVERY === 0) n++; return n; }

    // From GameScene.create (before anything spawns): this floor's scaling.
    towerScaling() {
        const C = TowerFloors.CFG, f = this.towerRun.floor;
        const ease = C.INTRO[f - 1] ?? 1;
        this.enemyHealthScale = C.BASE_HP * Math.pow(C.HP_STEP, f - 1) * ease;
        this.enemyDamageScale = C.BASE_DMG * Math.pow(C.DMG_STEP, f - 1) * ease;
        return { floor: f, hp: this.enemyHealthScale, dmg: this.enemyDamageScale };
    }

    // ── THE ARENA ─────────────────────────────────────────────────────────────
    // One big room in the middle of the map, with seeded cover: pillars, broken walls or a
    // ring. Anything that would wall a part off is left out (flood fill), and the middle,
    // where the way up opens, stays clear.
    generateTowerArena() {
        const W = this.WORLD_WIDTH, H = this.WORLD_HEIGHT, R = this.rng;
        const world = [];
        for (let x = 0; x < W; x++) { world[x] = []; for (let y = 0; y < H; y++) world[x][y] = this.NOTHING; }
        const boss = this.towerRun.floor % TowerFloors.CFG.BOSS_EVERY === 0;
        const w = boss ? 32 : 24 + Math.floor(R() * 10), h = boss ? 24 : 17 + Math.floor(R() * 7);
        const room = { x: Math.floor(W / 2 - w / 2), y: Math.floor(H / 2 - h / 2), w, h, isArena: true };
        this.carveRoom(world, room);
        const cx = room.x + (w >> 1), cy = room.y + (h >> 1);
        const plan = boss ? null : TowerFloors.rollPlan(this.towerRun.floor, R);
        this.towerRun.plan = plan;
        const pick = plan ? TowerFloors.PLANS[plan].layouts : ['pillars'];
        const style = this.towerRun.floor < TowerFloors.PLAN_FROM && !boss ? ['pillars', 'bunkers', 'cross'][Math.floor(R() * 3)] : pick[Math.floor(R() * pick.length)];
        this._towerPools = null;
        this._towerBlocks(world, room, style);
        this.addWalls(world);
        this.rooms = [room];
        this._towerArena = { room, cx, cy, style };
        return world;
    }

    // Seeded cover of one style inside the room (world tiles go WALL); a block that would wall
    // part of the room off is left out. busy(x, y): tiles to keep clear (the shift's living things).
    _towerBlocks(world, room, style, busy = null) {
        const R = this.rng, w = room.w, h = room.h, cx = room.x + (w >> 1), cy = room.y + (h >> 1);
        const blocks = [];
        // mirrored left to right, so a layout reads as built: block [x, y, w, h] and its twin
        const twin = (bx, by, bw, bh) => { blocks.push([bx, by, bw, bh]); const mx = 2 * room.x + w - bx - bw; if (mx !== bx) blocks.push([mx, by, bw, bh]); };
        const qx = Math.floor(w / 4), qy = Math.floor(h / 4);
        if (style === 'pillars') {            // heavy cover to fight round
            for (const sy of [-1, 1]) twin(cx - qx - 1, cy + sy * qy - 1, 2, 2);
            twin(room.x + 3, cy - 1, 2, 2);
        } else if (style === 'bunkers') {     // L-shaped cover in each quarter, open toward the middle: shelter from shooters
            for (const sy of [-1, 1]) {
                const by = cy + sy * qy;
                twin(cx - qx - 2, by, 4, 1);                                // its long side, facing out
                twin(cx - qx - 2, sy < 0 ? by - 2 : by + 1, 1, 2);         // its back
            }
            twin(room.x + 3, cy - 1, 1, 3);                                 // and a wall to duck behind on each side
        } else if (style === 'cross') {       // arms from the walls toward the middle: four quarters joined through gaps
            twin(room.x + 2, cy, Math.max(2, cx - room.x - 6), 1);
            blocks.push([cx, room.y + 2, 1, Math.max(2, cy - room.y - 5)]);
            twin(cx - qx, room.y + 2, 1, 2);
        } else if (style === 'ring') {        // a wall round the middle with four doors: the inside or the outside
            const rx = Math.floor(w / 3), ry = Math.floor(h / 3);
            for (let i = 0; i < 64; i++) {
                const t = i / 64 * Math.PI * 2, x = Math.round(cx + Math.cos(t) * rx), y = Math.round(cy + Math.sin(t) * ry);
                if (Math.abs(x - cx) <= 1 || Math.abs(y - cy) <= 1) continue;   // the doors
                if (!blocks.some(([bx, by]) => bx === x && by === y)) blocks.push([x, y, 1, 1]);
            }
        } else if (style === 'columns') {     // rows of columns that break sight lines: shooters have to come round
            for (let y = room.y + 3; y < room.y + h - 4; y += 4) for (let x = room.x + 3 + ((y >> 2) % 2) * 2; x < cx - 1; x += 4) twin(x, y, 1, 2);
        } else if (style === 'lanes') {       // two long walls with gaps: three lanes and the doors between them
            const lx = cx - Math.max(3, Math.floor(w / 5));
            const g1 = room.y + Math.floor(h / 3), g2 = room.y + Math.floor(2 * h / 3);
            twin(lx, room.y + 2, 1, g1 - room.y - 3);
            twin(lx, g1 + 2, 1, g2 - g1 - 3);
            twin(lx, g2 + 2, 1, Math.max(1, room.y + h - 4 - g2 - 2));
        } else if (style === 'pools') {       // light cover and mirrored pools of water (fire dries them; some slimes love them)
            for (const sy of [-1, 1]) twin(cx - qx - 1, cy + sy * qy, 1, 1);
            const pools = this._towerPools = [];
            for (const sy of [-1, 1]) for (let dx = 0; dx < 3; dx++) for (let dy = 0; dy < 2; dy++) {
                const x = room.x + 3 + dx, y = cy + sy * (qy - 1) + dy;
                pools.push([x, y], [2 * room.x + w - 1 - x, y]);
            }
        } else if (style === 'walls') {
            for (let i = 0; i < 4; i++) {
                const horiz = R() < 0.5, len = 3 + Math.floor(R() * 4);
                blocks.push([room.x + 2 + Math.floor(R() * (w - 6)), room.y + 2 + Math.floor(R() * (h - 6)), horiz ? len : 1, horiz ? 1 : len]);
            }
        } else {
            for (let i = 0; i < 9; i++) blocks.push([room.x + 2 + Math.floor(R() * (w - 4)), room.y + 2 + Math.floor(R() * (h - 4)), 1, 1]);
        }
        for (const [bx, by, bw, bh] of blocks) {
            const cells = [];
            for (let x = bx; x < bx + bw; x++) for (let y = by; y < by + bh; y++) {
                if (x <= room.x || y <= room.y || x >= room.x + w - 1 || y >= room.y + h - 1) continue;
                if (Math.abs(x - cx) <= 2 && Math.abs(y - cy) <= 2) continue;          // the middle stays open
                if (Math.abs(x - cx) <= 1 && y >= room.y + h - 4) continue;            // and where you start
                if (busy?.(x, y)) continue;
                cells.push([x, y]);
            }
            for (const [x, y] of cells) world[x][y] = this.WALL;
            if (!this._towerConnected(world, room)) for (const [x, y] of cells) world[x][y] = this.FLOOR;
        }
    }

    // Every floor tile of the room reachable from its middle?
    _towerConnected(world, room) {
        const cx = room.x + (room.w >> 1), cy = room.y + (room.h >> 1);
        let total = 0;
        for (let x = room.x; x < room.x + room.w; x++) for (let y = room.y; y < room.y + room.h; y++) if (world[x][y] === this.FLOOR) total++;
        const seen = new Set([cx + ',' + cy]), q = [[cx, cy]];
        while (q.length) {
            const [x, y] = q.pop();
            for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
                const nx = x + dx, ny = y + dy, k = nx + ',' + ny;
                if (!seen.has(k) && world[nx]?.[ny] === this.FLOOR) { seen.add(k); q.push([nx, ny]); }
            }
        }
        return seen.size >= total;
    }

    // ── A FLOOR ───────────────────────────────────────────────────────────────
    // End of GameScene.create: put the player at the bottom of the arena, plan the waves,
    // carry over what the run carries (HP, ult gems), and put up the floor's label.
    _towerBegin() {
        const T = this.towerRun, A = this._towerArena, C = TowerFloors.CFG, TS = this.TILE_SIZE;
        if (!T || !A) return;
        const sx = A.cx, sy = A.room.y + A.room.h - 3;
        if (this.world[sx]?.[sy] === this.FLOOR) {
            this.playerX = sx; this.playerY = sy;
            this.player.setPosition(sx * TS + TS / 2, sy * TS + TS / 2 + this.SLIME_Y_OFFSET);
        }
        try { localStorage.setItem('tower_entered', '1'); } catch (e) {}   // the first relic slot (Relics.slots)
        T.picks ||= {};
        // the garden's blessings (Garden.js), banked by harvests, ride with the whole climb
        if (!T.blessings) { T.blessings = typeof Garden !== 'undefined' ? Garden.spendBlessings() : []; if (T.blessings.length) this.time.delayedCall(900, () => this._towerBanner(`BLESSED: ${T.blessings.map(id => Garden.seed(id).bless).join(', ').toUpperCase()}`, '#9affd8')); }
        T.mods = TowerFloors.mods();
        this._towerApplyMods(TowerFloors.mods(T.picks));
        T.rerollCost ??= 4;
        T.shrine = null;
        if (T.hp != null) this.health = Math.max(1, Math.min(this.maxHealth, T.hp));
        if (T.gems && this.ultGems) for (const k in T.gems) if (k in this.ultGems) this.ultGems[k] = Math.min(this.ultChargeMax, T.gems[k]);
        if (this._runStats && T.glorps0 != null) this._runStats.glorps0 = T.glorps0;   // the death screen: glorps this run
        T.glorps0 ??= this.totalGlorps || 0;
        T.best = TowerFloors.best();
        T.best0 ??= T.best;
        T.newBest = T.best > T.best0;   // beaten earlier this run (the death screen's NEW BEST)
        T.boss = T.floor % C.BOSS_EVERY === 0;
        this._hurtTotal = 0;
        T.wave = 0; T.waves = T.boss ? 1 : C.WAVES;
        // how many this floor, and how they're split over the waves: from floor PLAN_FROM a little random, and uneven
        const P = TowerFloors.PLANS[T.plan || 'mixed'], late = T.floor >= TowerFloors.PLAN_FROM, R = this.rng;
        T.total = Math.max(3, Math.round(TowerFloors.crowd(T.floor) * P.count * (late ? 0.8 + R() * 0.4 : 1)));
        const sp = Array.from({ length: C.WAVES }, () => late ? 0.7 + R() * 0.6 : 1), st = sp.reduce((a, v) => a + v, 0);
        T.split = sp.map(v => v / st);
        T.kinds = {};
        if (this._towerPools) for (const [x, y] of this._towerPools) this.addWater?.(x, y, 0);
        T.shifted = false;
        // the floor's twist, if it has one
        T.twist = TowerFloors.twistOf(T.floor, T.seed);
        if (T.twist?.id === 'flood') this.generateWaterBlobs?.(0.35);
        if (T.twist?.id === 'swarm') { this.enemyHealthScale *= 0.7; T.total = Math.round(T.total * 1.5); }
        if (T.twist?.id === 'frenzy') this.enemyMoveCooldown = Math.round(this.enemyMoveCooldown * 0.75);
        T.state = 'start'; T.nextAt = this.time.now + 1400;
        if (T.owed > 0) { T.state = 'draft'; this.time.delayedCall(700, () => this._towerDraft()); }   // a skip: the boons the floors below would have given
        T.pending = []; T.exit = null;
        // the label: FLOOR n, and the wave / what's left
        const W = this.scale.width;
        T.label = this.add.text(W / 2, 40, '', { fontSize: '18px', fontFamily: UIKit.FONT.title, fontStyle: 'bold', color: '#f3e3b8', stroke: '#05060a', strokeThickness: 4 })
            .setOrigin(0.5, 0).setScrollFactor(0).setDepth(30);
        T.sub = this.add.text(W / 2, 63, '', { fontSize: '12px', fontFamily: 'monospace', color: '#b8a888', stroke: '#05060a', strokeThickness: 3 })
            .setOrigin(0.5, 0).setScrollFactor(0).setDepth(30);
        this._towerBanner(T.boss ? `FLOOR ${T.floor}  ·  BOSS` : T.twist ? `FLOOR ${T.floor}  ·  ${T.twist.name}` : TowerFloors.PLANS[T.plan]?.name ? `FLOOR ${T.floor}  ·  ${TowerFloors.PLANS[T.plan].name}` : `FLOOR ${T.floor}`, T.boss ? '#ff8a6a' : T.twist ? '#7ad8f0' : '#f3e3b8');
        if (T.twist) this.time.delayedCall(900, () => this.showStatusText(this.player.x, this.player.y - 40, T.twist.text, '#a8e8f8'));
        this._towerLabel();
        this._towerArriveFx();
    }

    // ── BETWEEN FLOORS ────────────────────────────────────────────────────────
    // Leaving: the ground shakes harder and harder, the arena falls away into the dark from its
    // edges in toward you, and you rise up the light; a flash, and the next floor.
    _towerLeaveFx(then) {
        const A = this._towerArena, T = this.TILE_SIZE, room = A?.room;
        if (!room || !this.player) { then(); return; }
        Sfx.play(this, 'collapse');
        const cam = this.cameras.main;
        for (let k = 0; k < 4; k++) this.time.delayedCall(k * 260, () => cam.shake(280, 0.003 + k * 0.003));
        const maxD = Math.hypot(room.w, room.h) / 2;
        for (let x = room.x; x < room.x + room.w; x++) for (let y = room.y; y < room.y + room.h; y++) {
            if (this.world[x]?.[y] !== this.FLOOR || (x === this.playerX && y === this.playerY)) continue;
            const d = Math.hypot(x - this.playerX, y - this.playerY), delay = 80 + (1 - Math.min(1, d / maxD)) * 900 + Math.random() * 120;
            this.time.delayedCall(delay, () => {
                const px = x * T + T / 2, py = y * T + T / 2;
                const hole = this.add.rectangle(px, py, T, T, 0x040208, 1).setDepth(0.25).setAlpha(0);
                const chunk = this.add.rectangle(px, py, T - 2, T - 2, (x + y) % 2 ? 0x4a4458 : 0x3c3650).setDepth(0.26).setStrokeStyle(1, 0x1a1626);
                this.tweens.add({ targets: hole, alpha: 1, duration: 120 });
                this.tweens.add({ targets: chunk, y: py + 26 + Math.random() * 20, angle: (Math.random() - 0.5) * 40, scale: 0.6, alpha: 0, duration: 420, ease: 'Quad.easeIn', onComplete: () => chunk.destroy() });
                if (Math.random() < 0.15) this._vfxBursts?.goo?.setParticleTint?.(0x6a6280)?.explode?.(4, px, py);
            });
        }
        const p = this.player;
        this.time.delayedCall(700, () => {
            if (!p.active) return;
            const glow = this.add.image(p.x, p.y, 'vfx_glow').setTint(0xffe8a0).setBlendMode(Phaser.BlendModes.ADD).setDepth(p.depth - 0.01).setScale(0.3).setAlpha(0.8);
            this.tweens.add({ targets: glow, scale: 1.4, alpha: 0, duration: 700 });
            this.tweens.add({ targets: p, y: p.y - 60, alpha: 0.2, duration: 650, ease: 'Quad.easeIn' });
        });
        this.time.delayedCall(1250, () => { cam.flash(250, 255, 240, 200); });
        this.time.delayedCall(1380, then);
    }
    // Arriving: the new floor builds itself out from where you land, tile by tile, dust thrown
    // up as each one settles, and you drop in onto it.
    _towerArriveFx() {
        const A = this._towerArena, T = this.TILE_SIZE, room = A?.room;
        if (!room || !this.player) return;
        const maxD = Math.hypot(room.w, room.h) / 2;
        for (let x = room.x - 1; x <= room.x + room.w; x++) for (let y = room.y - 1; y <= room.y + room.h; y++) {
            const px = x * T + T / 2, py = y * T + T / 2, d = Math.hypot(x - this.playerX, y - this.playerY);
            const cover = this.add.rectangle(px, py, T + 1, T + 1, 0x040208, 1).setDepth(0.28);
            this.tweens.add({ targets: cover, alpha: 0, scale: 0.4, delay: 120 + Math.min(1, d / maxD) * 800 + Math.random() * 80, duration: 220, ease: 'Quad.easeOut', onComplete: () => cover.destroy() });
        }
        this.cameras.main.shake(700, 0.004);
        const p = this.player, y1 = p.y;
        p.y = y1 - 70; p.setAlpha(0.3);
        this.tweens.add({ targets: p, y: y1, alpha: 1, duration: 420, delay: 150, ease: 'Bounce.easeOut' });
        this.time.delayedCall(560, () => { this._vfxFlash?.(p.x, y1 + 6, 50, 0xd8c8a0, 260, 0.7); Sfx.play(this, 'dash'); });
    }

    _towerLabel() {
        const T = this.towerRun;
        if (!T?.label?.active) return;
        T.label.setText(T.twist ? `FLOOR ${T.floor}  ·  ${T.twist.name}` : `FLOOR ${T.floor}`);
        const left = (this.enemies || []).filter(e => e.sprite?.active && e.health > 0).length + T.pending.length;
        T.sub.setText(T.state === 'clear' ? 'CLEARED  ·  the way up is open' : T.boss ? `BOSS  ·  best ${T.best}`
            : `WAVE ${Math.max(1, T.wave)} / ${T.waves}  ·  ${left} left  ·  best ${T.best}`);
    }

    // Catch-up boons, one screen each, then the floor starts.
    _towerDraft() {
        const T = this.towerRun;
        if (!T || T.state !== 'draft') return;
        if (T.owed <= 0) { T.state = 'start'; T.nextAt = this.time.now + 1200; return; }
        const total = T.owedTotal ??= T.owed;
        this._towerPickScreen(`Catch-up boon ${total - T.owed + 1} of ${total}`, () => { T.owed--; this._towerDraft(); });
    }

    // A big word across the middle of the screen, then gone.
    _towerBanner(text, color) {
        const W = this.scale.width, H = this.scale.height;
        const t = this.add.text(W / 2, H * 0.3, text, { fontSize: '40px', fontFamily: UIKit.FONT.title, fontStyle: 'bold', color, stroke: '#05060a', strokeThickness: 6 })
            .setOrigin(0.5).setScrollFactor(0).setDepth(40).setAlpha(0).setScale(0.8);
        this.tweens.add({ targets: t, alpha: 1, scale: 1, duration: 260, ease: 'Back.easeOut' });
        this.tweens.add({ targets: t, alpha: 0, y: H * 0.26, delay: 1500, duration: 400, onComplete: () => t.destroy() });
    }

    // Every frame (GameScene.update).
    _towerUpdate(time) {
        const T = this.towerRun;
        if (!T || !T.state || this._deathScreenActive) return;
        // spawns whose warning has run out
        for (let i = T.pending.length - 1; i >= 0; i--) {
            const p = T.pending[i];
            if (time < p.at) continue;
            T.pending.splice(i, 1);
            p.ring?.destroy();
            this._towerSpawn(p);
        }
        if (this.voidSovereignBoss?.active) this._updateVoidSovereign(time);   // its update lives in the Void Rift's otherwise
        if (this.fractureCore?.active) this._updateFractureCore(time, this.game.loop.delta);   // and the Geode's in the Fracture's
        const alive = (this.enemies || []).some(e => e.sprite?.active && e.health > 0)
            || this.voltslimeBoss?.active || this.voidSovereignBoss?.active || this.fractureCore?.active || (this.portals || []).some(p => p.active);
        // a boss at half health reshapes its arena
        if (T.boss && T.state === 'fight' && !T.shifted) {
            const bs = [this.voltslimeBoss, this.voidSovereignBoss, ...(this.portals || [])].filter(b => b?.active && b.maxHp);
            if (bs.length && bs.reduce((a, b) => a + b.hp, 0) <= 0.5 * bs.reduce((a, b) => a + b.maxHp, 0)) { T.shifted = true; this._towerShift(); }
            const gc = this.fractureCore;   // (the Geode keeps health, not hp)
            if (gc?.active && gc.health <= 0.5 * gc.maxHealth) { T.shifted = true; this._towerShift(); }
        }
        if (T.state === 'start' && time >= T.nextAt) { T.state = 'fight'; this._towerWave(); }
        else if (T.state === 'fight' && !alive && !T.pending.length) {
            if (T.wave < T.waves) {
                T.state = 'gap'; T.nextAt = time + TowerFloors.CFG.WAVE_GAP_MS;
                if (T.twist?.id === 'shift') { this._towerShift(); T.nextAt += 900; }   // the banner clears first, and you get a beat to find cover
            }
            else this._towerClear();
        } else if (T.state === 'gap' && time >= T.nextAt) { T.state = 'fight'; this._towerWave(); }
        else if (T.state === 'clear' && T.exit && this.playerX === T.exit.x && this.playerY === T.exit.y && !this._towerPicking && !T.exiting) { T.exiting = true; this._towerLeaveFx(() => this._towerNext()); }
        else if (T.state === 'clear' && T.shrine && !T.shrine.used && !this._towerPicking && this.playerX === T.shrine.x && this.playerY === T.shrine.y) {
            if ((this.orbScraps || 0) >= TowerFloors.SHRINE_COST) {
                T.shrine.used = true;
                this.orbScraps -= TowerFloors.SHRINE_COST; this.saveScrapBank?.();
                T.shrine.parts.forEach(o => { this.tweens.killTweensOf(o); o.destroy(); });
                this._towerPickScreen('Bought at the shrine', null);
            } else if (time > (T.shrineNagAt || 0)) {
                T.shrineNagAt = time + 1500;
                this.showStatusText(this.player.x, this.player.y - 30, `needs ⚙${TowerFloors.SHRINE_COST} scraps`, '#a8f0d8');
            }
        }
        if (time >= (T.labelAt || 0)) { T.labelAt = time + 250; this._towerLabel(); }
    }

    // The arena reshapes (Shifting floors between waves, every boss at half health): a flash,
    // the cover crumbles, and new cover of another style rises. Nothing living gets walled in.
    _towerShift() {
        const A = this._towerArena, room = A?.room, W = this.world;
        if (!room || this._deathScreenActive) return;
        const before = [];
        for (let x = room.x + 1; x < room.x + room.w - 1; x++) for (let y = room.y + 1; y < room.y + room.h - 1; y++) {
            before.push([x, y, W[x][y]]);
            if (W[x][y] === this.WALL) W[x][y] = this.FLOOR;
        }
        const busy = [[this.playerX, this.playerY, 1]];
        for (const e of this.enemies || []) if (e.sprite?.active) busy.push([e.x, e.y, 0]);
        for (const b of [this.voltslimeBoss, this.voidSovereignBoss, ...(this.portals || [])]) if (b?.active && b.tileX != null) busy.push([b.tileX, b.tileY, 2]);
        for (const p of this.towerRun.pending || []) busy.push([p.x, p.y, 0]);
        const styles = ['pillars', 'bunkers', 'cross', 'ring', 'columns', 'lanes'].filter(s => s !== A.style);
        A.style = styles[Math.floor(this.rng() * styles.length)];
        this._towerBlocks(W, room, A.style, (x, y) => busy.some(([bx, by, r]) => Math.abs(bx - x) <= r && Math.abs(by - y) <= r));
        const changed = before.filter(([x, y, t]) => W[x][y] !== t).map(([x, y]) => [x, y]);
        for (const [x, y] of changed) if (W[x][y] === this.WALL) { this.waterTiles?.delete(x + ',' + y); this.steamTiles?.delete?.(x + ',' + y); this._fogOff(x + ',' + y); }
        this.cameras.main.flash(220, 255, 244, 214);
        this.cameras.main.shake(380, 0.008);
        Sfx.play(this, 'collapse');
        this._bfxCrumble?.(changed);
        this._towerBanner('THE WALLS SHIFT', '#d8c8a0');
    }

    // Draw a wave from the budget and telegraph where each one will land.
    _towerWave() {
        const T = this.towerRun, C = TowerFloors.CFG, A = this._towerArena, R = this.rng;
        T.wave++;
        if (T.boss) {
            const kind = TowerFloors.BOSSES[Math.floor(T.floor / C.BOSS_EVERY - 1) % TowerFloors.BOSSES.length];
            T.pending.push(this._towerTelegraph(A.cx, A.room.y + 4, { boss: kind }, 1600));
            Sfx.play(this, 'roar', { big: true });
            return;
        }
        const P = TowerFloors.PLANS[T.plan || 'mixed'];
        // the waves before the last take their share rounded down, and the last takes what's left, so the floor holds T.total
        const total = T.total || TowerFloors.crowd(T.floor), share = w => Math.max(1, Math.floor(total * (T.split?.[w] ?? 1 / C.WAVES)));
        let n = share(T.wave - 1);
        if (T.wave === C.WAVES) { n = total; for (let w = 0; w < C.WAVES - 1; w++) n -= share(w); n = Math.max(1, n); }
        const wet = (this.waterTiles?.size || 0) >= 8;   // a floor laid out with pools
        const pool = TowerFloors.POOL.filter(p => p.from <= T.floor && (!p.water || wet));
        let budget = Math.round(n * (1.2 + T.floor / 12) * P.budget);
        const spots = this._towerSpots(n);
        // the plan's roles weigh the draw; a floor holds two of any heavy kind at most, and one of each elite.
        // The last wave opens with its headliner: the dearest thing it can afford.
        const kinds = T.kinds ||= {};
        const allowed = p => !((p.cost >= 4 && (kinds[p.id] || 0) >= 2) || (p.role === 'elite' && (kinds[p.id] || 0) >= 1));
        for (let i = 0; i < n && spots.length; i++) {
            const can = pool.filter(p => p.cost <= Math.max(1, budget - (n - i - 1)) && allowed(p));
            let pick;
            if (i === 0 && T.wave === C.WAVES && T.floor >= TowerFloors.PLAN_FROM) pick = can.reduce((a, p) => !a || p.cost > a.cost ? p : a, null);
            else {
                const wts = can.map(p => (P.roles[p.role] ?? 1) * (P.heavy ? p.cost * p.cost : p.cost > 1 ? 1 : 0.8)), tot = wts.reduce((a, v) => a + v, 0);
                let r = R() * tot; pick = can.find((p, k) => (r -= wts[k]) < 0);
            }
            pick ||= pool[0];
            kinds[pick.id] = (kinds[pick.id] || 0) + 1;
            budget -= pick.cost;
            const [x, y] = spots.pop();
            T.pending.push(this._towerTelegraph(x, y, { kind: pick }, C.TELEGRAPH_MS + i * 70));
        }
        if (T.wave > 1) this._towerBanner(`WAVE ${T.wave}`, '#d8c8a0');
    }

    // n open floor tiles at least 5 from you and from each other where possible.
    _towerSpots(n) {
        const A = this._towerArena, R = this.rng, out = [];
        for (let tries = 0; tries < 400 && out.length < n; tries++) {
            const x = A.room.x + 1 + Math.floor(R() * (A.room.w - 2)), y = A.room.y + 1 + Math.floor(R() * (A.room.h - 2));
            if (this.world[x]?.[y] !== this.FLOOR || this.getEnemyAt(x, y)) continue;
            if (Math.hypot(x - this.playerX, y - this.playerY) < 5) continue;
            if (out.some(([ox, oy]) => Math.abs(ox - x) + Math.abs(oy - y) < (tries < 250 ? 3 : 1))) continue;
            out.push([x, y]);
        }
        return out;
    }

    // A ring on the floor where something is about to arrive.
    _towerTelegraph(x, y, what, ms) {
        const TS = this.TILE_SIZE, px = x * TS + TS / 2, py = y * TS + TS / 2;
        const col = what.boss ? 0xff5a3a : 0xff8a6a;
        const ring = this.add.image(px, py, VisualFX.auraTex(this, 'ring')).setTint(col).setBlendMode(Phaser.BlendModes.ADD).setDepth(0.9).setDisplaySize(what.boss ? 120 : 40, what.boss ? 120 : 40).setAlpha(0);
        this.tweens.add({ targets: ring, alpha: 0.9, duration: 200 });
        this.tweens.add({ targets: ring, scale: ring.scale * 0.45, duration: ms, ease: 'Quad.easeIn' });
        return { x, y, at: this.time.now + ms, ring, ...what };
    }

    _towerSpawn(p) {
        let { x, y } = p;
        if (this.getEnemyAt(x, y) || (x === this.playerX && y === this.playerY)) {
            const s = this._towerSpots(1)[0]; if (!s) return; [x, y] = s;
        }
        if (p.boss) { this._towerBoss(p.boss, x, y); return; }
        this._towerSpawning = true;   // a wave's own enemies, not summoned ones: they drop as usual
        let e; try { e = p.kind.make(this, x, y); } finally { this._towerSpawning = false; }
        if (!e) return;
        this._vfxSpawn?.(e);
        const T = this.towerRun;
        // some arrive resisting an element (switch to break them): from floor 4, more the higher you go; doubles, and from 15 the odd triple
        if (T.twist?.id === 'warded' || (T.floor >= 4 && this.rng() < Math.min(0.5, 0.12 + T.floor * 0.012))) { const k = this._rollResist(this.rng, T.floor >= 15); this._tagResist(e, e.resistTrait ? [...new Set([].concat(e.resistTrait, k))] : k); }   // on top of its own (a Storm Elemental keeps lightning)
    }

    // A story boss, scaled to the floor (their HP is fixed in the story, so it's set here).
    _towerBoss(kind, x, y) {
        const k = this.enemyHealthScale / TowerFloors.CFG.BASE_HP;
        if (kind === 'voltslime') { this.spawnVoltslimeBoss(x, y); const b = this.voltslimeBoss; if (b) { b.hp = b.maxHp = Math.round(b.maxHp * k); } }
        else if (kind === 'sovereign') { this.spawnVoidSovereignBoss(x, y); const b = this.voidSovereignBoss; if (b) { b.hp = b.maxHp = Math.round(b.maxHp * k); } }
        else if (kind === 'geode') {   // the Fracture's Geode, risen in the middle of the arena
            this._spawnFractureCore(this._towerArena.room, true);
            const c = this.fractureCore; if (c) c.health = c.maxHealth = Math.round(c.maxHealth * k);
        }
        else {   // the Brood: two Queen Slimes, each tougher than a story queen, breeding all fight
            const A = this._towerArena;
            for (const [i, qx] of [[0, A.room.x + Math.floor(A.room.w * 0.25)], [1, A.room.x + Math.floor(A.room.w * 0.75)]]) {
                this.spawnPortal(qx, A.room.y + 4, 0, 'tower_q' + i);
                const q = this.portals[this.portals.length - 1];
                if (q) q.hp = q.maxHp = Math.round(q.maxHp * k * 2.5);
            }
        }
        this.cameras.main.shake(260, 0.01);
    }

    // The floor is done: pay, heal a little, save the best, open the way up.
    _towerClear() {
        const T = this.towerRun, C = TowerFloors.CFG, A = this._towerArena, TS = this.TILE_SIZE;
        T.state = 'clear';
        const pay = Math.round(TowerFloors.pay(T.floor) * this._mods.pay * (T.twist ? TowerFloors.TWIST_PAY : 1));
        const rest = Math.max(0, pay - (T.killPaid || 0));   // the kills paid the rest as they fell (TowerFloors.onKill)
        if (rest > 0) TowerFloors.flyGlorps(this, this.player.x, this.player.y - 20, rest);
        if (T.floor > TowerFloors.best()) { try { localStorage.setItem('tower_best', String(T.floor)); } catch (e) {} T.best = T.floor; T.newBest = T.floor > T.best0; }
        this.health = Math.min(this.maxHealth, this.health + this.maxHealth * (C.HEAL_ON_CLEAR + this._mods.heal));
        Telemetry.end(this, 'clear');
        Achievements.onFloor(this, T);
        Sfx.play(this, T.boss ? 'fanfare' : 'clear');
        this._towerBanner(`FLOOR ${T.floor} CLEARED`, '#9be08a');
        this.showStatusText(this.player.x, this.player.y - 34, `FLOOR PAY +${pay} ✦`, '#ffd34a');
        // dust for the Isle (Enchants.js): a little every floor, more from a boss
        const dustAll = TowerFloors.floorDust(T), dust = Math.max(0, dustAll - (T.killDust || 0));   // (the kills gave the rest)
        if (dust > 0) Enchants.addDust(dust);
        { const at = T.lastKill || { x: this.player.x, y: this.player.y - 30 }; if (dust > 0) this.time.delayedCall(250, () => TowerFloors.flyDust(this, at.x, at.y, dust)); }   // out of the last one to fall, into you
        // sealed books, to unseal at the Isle (Enchants.js): 3 from a boss, one floor in four gives one
        const nb = T.boss ? 3 : 0;   // (a normal floor's book is rolled on its kills now)
        if (nb) {
            Enchants.addBooks(nb);
            T.books = (T.books || 0) + nb;
            this.time.delayedCall(400, () => this.showStatusText(this.player.x, this.player.y - 52, `+${nb} SEALED BOOK${nb > 1 ? 'S' : ''}`, '#d8a8ff'));
        }
        // a garden seed (Garden.js): one floor in five, every boss; a copy, or dust once you've plenty
        const seed = T.boss && typeof Garden !== 'undefined' ? Garden.drop(T.floor, true) : null;   // (a normal floor's seed is rolled on its kills now)
        if (seed) {
            const got = Garden.give(seed), S = Garden.seed(seed);
            this.time.delayedCall(550, () => this.showStatusText(this.player.x, this.player.y - 88, got.dust ? `${S.name.toUpperCase()} SEED (SPARE): +${got.dust} DUST` : `+1 ${S.name.toUpperCase()} SEED`, UIKit._hex(S.col)));
        }
        // a boss from floor 20 sometimes drops a sapling for the garden's orchard (the rare trees come only this way)
        const sap = T.boss && typeof Garden !== 'undefined' ? Garden.dropSapling(T.floor) : null;
        if (sap) { const Tr = Garden.giveSapling(sap); this.time.delayedCall(850, () => this._towerBanner(`SAPLING: ${Tr.name.toUpperCase()}`, UIKit._hex(Tr.col))); }
        // a boss floor drops a relic you don't have (Relics.js), yours for good
        const relic = T.boss ? Relics.drop(T.floor) : null;
        if (relic) {
            Relics.give(relic);
            const R = Relics.def(relic), ik = Relics.icon(this, relic);
            this.time.delayedCall(700, () => this._towerBanner(`RELIC: ${R.name.toUpperCase()}`, UIKit._hex(R.col)));
            if (ik && this.player) {
                const im = this.add.image(this.player.x, this.player.y - 40, ik).setScale(2.5).setDepth(5);
                this.tweens.add({ targets: im, y: im.y - 30, alpha: 0, delay: 900, duration: 900, onComplete: () => im.destroy() });
            }
            T.relics = (T.relics || 0) + 1;
        }
        if (T.boss || T.floor % TowerFloors.PICK_EVERY === 0)
            this.time.delayedCall(1300, () => this._towerPickScreen(T.boss ? 'The boss is down' : `Floor ${T.floor} cleared`, () => this._towerOpenExit(false)));
        else this._towerOpenExit(true);
        this._towerLabel();
    }

    // The way up (a rift in the middle of the arena) and, on floors without a pick, the shrine
    // beside it where scraps buy one.
    _towerOpenExit(shrine) {
        const T = this.towerRun, A = this._towerArena, TS = this.TILE_SIZE;
        if (!T || T.exit) return;
        let ex = A.cx, ey = A.cy;
        if (this.world[ex]?.[ey] !== this.FLOOR) { const s = this._towerSpots(1)[0]; if (s) [ex, ey] = s; }
        const px = ex * TS + TS / 2, py = ey * TS + TS / 2;
        const glow = this.add.image(px, py, 'vfx_glow').setTint(0xffd36a).setBlendMode(Phaser.BlendModes.ADD).setDepth(0.95).setScale(0).setAlpha(0.7);
        const ekey = TowerFloors.exitKey(this);
        const disk = this.add.sprite(px, py - 6, ekey, '0').setDepth(0.96).setScale(0);
        if (this.anims.exists(ekey)) { disk.play(ekey); disk.anims.timeScale = 1.6; }
        // a column of light standing up out of it, and motes riding it up
        const beam = this.add.image(px, py + 2, 'vfx_glow').setOrigin(0.5, 0.82).setTint(0xffd36a).setBlendMode(Phaser.BlendModes.ADD).setDepth(3.3).setScale(0.16, 0).setAlpha(0.45);
        const tag = this.add.text(px, py - 46, 'UP ▲', { fontSize: '12px', fontFamily: UIKit.FONT.title, fontStyle: 'bold', color: '#ffe8a0', stroke: '#05060a', strokeThickness: 3 }).setOrigin(0.5).setDepth(4);
        this.tweens.add({ targets: disk, scale: 1, duration: 450, ease: 'Back.easeOut' });
        this.tweens.add({ targets: glow, scale: 0.55, duration: 400 });
        this.tweens.add({ targets: beam, scaleY: 0.75, duration: 600, ease: 'Quad.easeOut' });
        this.tweens.add({ targets: beam, alpha: 0.25, duration: 900, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
        this.tweens.add({ targets: tag, y: py - 52, duration: 700, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
        T.exitPulse = this.time.addEvent({ delay: 900, loop: true, callback: () => VisualFX.ripple(this, px, py, 10, 40, 0xffd36a, { depth: 0.97, duration: 800, alpha: 0.7 }) });
        T.exitMotes = this.time.addEvent({ delay: 120, loop: true, callback: () => {
            const d = this.add.image(px + (Math.random() - 0.5) * 26, py + (Math.random() - 0.3) * 8, 'vfx_glow').setTint(Math.random() < 0.5 ? 0xffe066 : 0xfff6c0).setBlendMode(Phaser.BlendModes.ADD).setDepth(3.4).setScale(0.035 + Math.random() * 0.03);
            this.tweens.add({ targets: d, y: d.y - 40 - Math.random() * 30, alpha: 0, duration: 900 + Math.random() * 500, ease: 'Quad.easeOut', onComplete: () => d.destroy() });
        } });
        T.exit = { x: ex, y: ey };
        if (shrine) {
            // a free floor tile a few steps to the side of the rift
            const spot = [[-3, 0], [3, 0], [0, 3], [0, -3], [-2, 2], [2, 2], [-2, -2], [2, -2]].map(([dx, dy]) => [ex + dx, ey + dy]).find(([x, y]) => this.world[x]?.[y] === this.FLOOR);
            if (spot) {
                const [sx, sy] = spot;
                const spx = sx * TS + TS / 2, spy = sy * TS + TS / 2;
                const skey = TowerFloors.shrineKey(this);
                const g = this.add.sprite(spx, spy - 10, skey, '0').setDepth(0.96);
                if (this.anims.exists(skey)) g.play(skey);
                const gem = this.add.image(spx, spy - 20, 'vfx_glow').setTint(0x7ae0c0).setBlendMode(Phaser.BlendModes.ADD).setDepth(0.97).setScale(0.22).setAlpha(0.5);
                this.tweens.add({ targets: gem, scale: 0.28, alpha: 0.7, duration: 800, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
                const tag = this.add.text(spx, spy - 36, `BOON  ⚙${TowerFloors.SHRINE_COST}`, { fontSize: '11px', fontFamily: UIKit.FONT.title, fontStyle: 'bold', color: '#a8f0d8', stroke: '#05060a', strokeThickness: 3 }).setOrigin(0.5).setDepth(4);
                T.shrine = { x: sx, y: sy, used: false, parts: [g, gem, tag] };
            }
        }
        this._towerLabel();
    }

    // ── THE PICK SCREEN ───────────────────────────────────────────────────────
    // Recompute what the picks add up to and apply the difference to the scene's own numbers
    // (damage, damage taken, max HP); the rest of the mods are read where they act.
    _towerApplyMods(next) {
        const T = this.towerRun, prev = T.mods;
        if (T.blessings?.length && typeof Garden !== 'undefined') next = Relics.combine(next, Garden.mods(T.blessings));   // the climb's blessings, with the boons
        this.statDamageMult = (this.statDamageMult ?? 1) * next.dmg / prev.dmg;
        this.statTakenMult = (this.statTakenMult ?? 1) * next.taken / prev.taken;
        const dh = next.hp - prev.hp;
        this.maxHealth += dh; this.health = Math.min(this.maxHealth, this.health + Math.max(0, dh));
        T.mods = next;
        this._mods = Relics.combine(this._relicMods, next);   // what the game reads: relics and boons together
    }

    // Three you don't have maxed; element picks only for elements you have.
    _towerOffer() {
        const T = this.towerRun, have = this.unlockedElements || new Set(['fire', 'ice']);
        const pool = TowerFloors.PICKS.filter(p => (T.picks[p.id] || 0) < p.max && (!p.el || have.has(p.el)));
        for (let i = pool.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [pool[i], pool[j]] = [pool[j], pool[i]]; }
        return pool.slice(0, 3);
    }

    _towerPickScreen(reason, onDone, offer = null) {
        const T = this.towerRun, P = UIKit.PALETTE, W = this.scale.width, H = this.scale.height, D = 520;
        offer ||= this._towerOffer();
        if (!offer.length) { onDone?.(); return; }
        this._towerPicking = true;
        const objs = [], keep = o => { objs.push(o); return o; };
        const close = () => { objs.forEach(o => { if (o?.active) { this.tweens.killTweensOf(o); o.destroy(); } }); this._towerPicking = false; this._towerTake = null; };
        objs.push(...UIKit.overlay(this, { alpha: 0.72, depth: D }).objs);
        keep(this.add.text(W / 2, H * 0.16, 'CHOOSE A BOON', { fontSize: '32px', fontFamily: UIKit.FONT.title, fontStyle: 'bold', color: '#f3e3b8', stroke: '#05060a', strokeThickness: 6 }).setOrigin(0.5).setScrollFactor(0).setDepth(D + 3));
        keep(this.add.text(W / 2, H * 0.16 + 32, `${reason}  ·  it lasts this climb`, { fontSize: '13px', fontFamily: 'monospace', color: UIKit.CSS.textLo }).setOrigin(0.5).setScrollFactor(0).setDepth(D + 3));
        const takes = [];
        this._towerTake = i => takes[i]?.();   // pick card i
        this._towerOfferIds = offer.map(p => p.id);   // what's on the cards
        const cw = 230, ch = 250, gap = 24, x0 = W / 2 - (offer.length * cw + (offer.length - 1) * gap) / 2, y0 = H * 0.16 + 64;
        offer.forEach((p, i) => {
            const t = T.picks[p.id] || 0, x = x0 + i * (cw + gap), cx = x + cw / 2;
            objs.push(...UIKit.panel(this, { x, y: y0, w: cw, h: ch, accent: p.col, depth: D + 1 }).objs);
            const glow = keep(this.add.image(cx, y0 + 52, 'vfx_glow').setTint(p.col).setBlendMode(Phaser.BlendModes.ADD).setScrollFactor(0).setDepth(D + 2).setScale(0.3).setAlpha(0.7));
            this.tweens.add({ targets: glow, scale: 0.36, alpha: 0.9, duration: 900, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
            const ik = TowerFloors.pickIcon(this, p);
            if (ik) keep(this.add.image(cx, y0 + 52, ik).setScale(3).setScrollFactor(0).setDepth(D + 3));
            keep(this.add.text(cx, y0 + 98, p.name, { fontSize: '20px', fontFamily: UIKit.FONT.title, fontStyle: 'bold', color: UIKit._hex(p.col) }).setOrigin(0.5).setScrollFactor(0).setDepth(D + 3));
            const pips = keep(this.add.graphics().setScrollFactor(0).setDepth(D + 3));
            for (let k = 0; k < p.max; k++) {
                const px = cx - (p.max - 1) * 9 + k * 18, py = y0 + 124;
                pips.fillStyle(k < t ? p.col : k === t ? 0xffffff : 0x2a2a38, k === t ? 0.9 : 1);
                pips.fillPoints([{ x: px, y: py - 5 }, { x: px + 5, y: py }, { x: px, y: py + 5 }, { x: px - 5, y: py }], true);
            }
            keep(this.add.text(cx, y0 + 148, p.text(t + 1), { fontSize: '13px', fontFamily: 'monospace', color: UIKit.CSS.textHi, align: 'center', wordWrap: { width: cw - 30 } }).setOrigin(0.5, 0).setScrollFactor(0).setDepth(D + 3));
            if (t) keep(this.add.text(cx, y0 + 186, `now: ${p.text(t)}`, { fontSize: '11px', fontFamily: 'monospace', color: UIKit.CSS.textLo, align: 'center', wordWrap: { width: cw - 30 } }).setOrigin(0.5, 0).setScrollFactor(0).setDepth(D + 3));
            const take = takes[i] = () => {
                    if (!this._towerPicking) return;
                    T.picks[p.id] = t + 1;
                    this._towerApplyMods(TowerFloors.mods(T.picks));
                    Sfx.play(this, 'pickup');
                    close();
                    this._towerBanner(p.name.toUpperCase(), UIKit._hex(p.col));
                    onDone?.();
                };
            objs.push(...UIKit.button(this, { x: cx, y: y0 + ch - 26, w: cw - 40, h: 34, label: t ? `TAKE  ·  ${t + 1}/${p.max}` : 'TAKE', accent: p.col, depth: D + 4, fontSize: '14px', fireOn: 'down', onClick: take }).objs);
        });
        const scraps = this.orbScraps || 0, cost = T.rerollCost;
        objs.push(...UIKit.button(this, { x: W / 2, y: y0 + ch + 42, w: 220, h: 36, label: `REROLL  ⚙ ${cost}`, accent: scraps >= cost ? P.accentGreen : P.line, depth: D + 4, fontSize: '14px', fireOn: 'down',
            onClick: () => {
                if ((this.orbScraps || 0) < cost) { Sfx.play(this, 'deny'); return; }
                this.orbScraps -= cost; this.saveScrapBank?.();
                T.rerollCost += 2;
                close();
                this._towerPickScreen(reason, onDone);
            } }).objs);
        keep(this.add.text(W / 2, y0 + ch + 70, `you have ⚙ ${scraps} scraps`, { fontSize: '11px', fontFamily: 'monospace', color: UIKit.CSS.textLo }).setOrigin(0.5).setScrollFactor(0).setDepth(D + 3));
    }

    // Into the rift: the next floor, carrying HP, ult gems and the run's tally.
    _towerNext() {
        const T = this.towerRun;
        if (T.leaving) return;
        T.leaving = true;
        Sfx.play(this, 'whoosh');
        this.cameras.main.fadeOut(350, 0, 0, 0);
        this.time.delayedCall(380, () => this.scene.restart({
            levelIndex: 6, continueRun: true,
            tower: { seed: T.seed, floor: T.floor + 1, hp: this.health, gems: { ...(this.ultGems || {}) }, glorps0: T.glorps0, t0: T.t0, best0: T.best0, picks: { ...T.picks }, blessings: [...(T.blessings || [])], rerollCost: T.rerollCost,
                     relics: T.relics || 0, books: T.books || 0, kills: (T.kills || 0) + (this._runStats?.kills || 0) },
        }));
    }
}
