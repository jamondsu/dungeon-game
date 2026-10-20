// ═══════════════════════════════════════════════════════════════════════════
// Relics.js — trinkets you keep: each one trades something for something. You own them for good, wear up to slots() at once, and they work everywhere,
// story levels included.
//
// Where they come from: Glurp sells a few each day (stock(), seeded by the date), and every
// Tower boss floor drops one you don't have (TowerFloors._towerClear).
//
// What they do is the same shape as the Tower's boons (TowerFloors.mods): GameScene adds them
// up at the start of a level (scene._mods = Relics.combine(relics, boons)) and the game reads
// scene._mods where each effect acts. Stored in localStorage: relics_owned, relics_worn.
// Nothing here touches Phaser when the file loads.
// ═══════════════════════════════════════════════════════════════════════════

const Relics = {
    // Shelves: one per build. Each holds its relics in three tiers (TIERS): Novice for a first
    // run, Adept for the middle, Legend for the end game. Every relic trades something.
    SHELVES: [
        { id: 'precision', name: 'PRECISION', build: 'crit',            col: 0xffd34a },
        { id: 'ember',     name: 'EMBER',     build: 'fire and burn',   col: 0xff8844 },
        { id: 'rime',      name: 'RIME',      build: 'ice and chill',   col: 0x88eeff },
        { id: 'tempest',   name: 'TEMPEST',   build: 'lightning, water', col: 0xffe14a },
        { id: 'void',      name: 'VOID',      build: 'cosmic and hex',  col: 0xb388ff },
        { id: 'resonance', name: 'RESONANCE', build: 'ults, reactions', col: 0xd8a8ff },
        { id: 'bastion',   name: 'BASTION',   build: 'tank, thorns',    col: 0x9ab0c8 },
        { id: 'blood',     name: 'BLOOD',     build: 'healing',         col: 0xe05a7a },
        { id: 'zephyr',    name: 'ZEPHYR',    build: 'speed',           col: 0xa8e07a },
        { id: 'fortune',   name: 'FORTUNE',   build: 'glorps',          col: 0xf0c040 },
        { id: 'hunter',    name: 'HUNTER',    build: 'bosses, finishers', col: 0xe8b090 },
        { id: 'carnage',   name: 'CARNAGE',   build: 'crowds, kill bursts', col: 0xff6a4a },
        { id: 'chaos',     name: 'CHAOS',     build: 'luck, big swings',    col: 0x7ae08a },
        { id: 'corrupt',   name: 'CORRUPTED', build: 'siphoned relics',     col: 0x7aff5a },   // made, not found: siphon() fills it
    ],
    TIERS: [null, { name: 'NOVICE', col: 0xb8b8c8 }, { name: 'ADEPT', col: 0x6cb4f0 }, { name: 'LEGEND', col: 0xffc23a }],
    LEGEND_AT: 15,   // Legend relics stock once your Tower best reaches this
    // `sh`: its shelf; `t`: tier; `m`: the effect, in mods terms (text is written from it);
    // `shape`: its icon when it has no drawing of its own (icon()).
    LIST: [
        // PRECISION
        { id: 'keen_eye',      name: 'Keen Eye',          sh: 'precision', t: 1, col: 0xffe08a, price: 180,  shape: 'eye',     m: { crit: 0.05 } },
        { id: 'whetstone',     name: 'Whetstone',         sh: 'precision', t: 1, col: 0xc8c8d0, price: 220,  shape: 'rune',    m: { crit: 0.03, critMult: 0.15, hp: -5 } },
        { id: 'glass_fang',    name: 'Glass Fang',        sh: 'precision', t: 2, col: 0xe8f0ff, price: 450,  m: { dmg: 1.25, hp: -20 } },
        { id: 'lucky_charm',   name: 'Lucky Charm',       sh: 'precision', t: 2, col: 0x9be08a, price: 550,  m: { crit: 0.15, ult: 0.85 } },
        { id: 'marksman_lens', name: "Marksman's Lens",   sh: 'precision', t: 2, col: 0x7ad8ff, price: 600,  shape: 'orb',     m: { critMult: 0.4, dmg: 0.95 } },
        { id: 'assassin_mark', name: "Assassin's Mark",   sh: 'precision', t: 3, col: 0xff4a6a, price: 1800, shape: 'claw',    m: { crit: 0.2, critMult: 0.6, hp: -30 } },
        { id: 'loaded_dice',   name: 'Loaded Dice',       sh: 'precision', t: 3, col: 0xf4f0e0, price: 1600, shape: 'dice',    m: { crit: 0.3, dmg: 0.85 } },
        // EMBER
        { id: 'coal_pouch',    name: 'Coal Pouch',        sh: 'ember', t: 1, col: 0x6a4a3a, price: 160,  shape: 'chest',   m: { el: { fire: 1.08 } } },
        { id: 'tinderbox',     name: 'Tinderbox',         sh: 'ember', t: 1, col: 0xc87a3a, price: 200,  shape: 'bottle',  m: { vsBurn: 1.15 } },
        { id: 'ember_heart',   name: 'Ember Heart',       sh: 'ember', t: 2, col: 0xff8844, price: 550,  m: { swapBy: { fire: { hits: 3, bonus: 0.4 } }, ult: 0.92 } },
        { id: 'phoenix_feather', name: 'Phoenix Feather', sh: 'ember', t: 2, col: 0xff6a2a, price: 650,  shape: 'feather', m: { vsBurn: 1.2, heal: 0.1, hp: -10 } },
        { id: 'ashen_brand',   name: 'Ashen Brand',       sh: 'ember', t: 2, col: 0x8a6a5a, price: 600,  shape: 'rune',    m: { vsBurn: 1.35, speed: 1.06 } },
        { id: 'sun_core',      name: 'Heart of the Sun',  sh: 'ember', t: 3, col: 0xffb02a, price: 2000, shape: 'star',    m: { switchNova: 14, ult: 0.85 } },
        { id: 'pyre_crown',    name: 'Pyre Crown',        sh: 'ember', t: 3, col: 0xff5a1a, price: 1900, shape: 'crown',   m: { vsBurn: 1.6, boom: 10, taken: 1.1 } },
        // RIME
        { id: 'frost_bead',    name: 'Frost Bead',        sh: 'rime', t: 1, col: 0xb8e8ff, price: 160,  shape: 'gem',     m: { el: { ice: 1.08 } } },
        { id: 'snowglobe',     name: 'Snowglobe',         sh: 'rime', t: 1, col: 0xd8f4ff, price: 200,  shape: 'orb',     m: { vsChill: 1.15 } },
        { id: 'frost_core',    name: 'Frost Core',        sh: 'rime', t: 2, col: 0x88eeff, price: 550,  m: { chillOther: 1.2, hp: -10 } },
        { id: 'glacier_shard', name: 'Glacier Shard',     sh: 'rime', t: 2, col: 0x5ab8ff, price: 600,  shape: 'gem',     m: { el: { ice: 1.25 }, speed: 1.06 } },
        { id: 'winter_bell',   name: 'Winter Bell',       sh: 'rime', t: 2, col: 0xb8e0ff, price: 650,  shape: 'bell',    m: { vsChill: 1.3, hp: -10 } },
        { id: 'absolute_zero', name: 'Absolute Zero',     sh: 'rime', t: 3, col: 0xe8ffff, price: 2000, shape: 'star',    m: { reactBoom: 10, taken: 1.1 } },
        { id: 'frost_throne',  name: 'Frost Throne',      sh: 'rime', t: 3, col: 0x6ad0f0, price: 1900, shape: 'crown',   m: { vsChill: 1.5, taken: 0.85, speed: 1.12 } },
        // TEMPEST
        { id: 'spark_plug',    name: 'Spark Plug',        sh: 'tempest', t: 1, col: 0xd8c860, price: 160,  shape: 'bottle',  m: { el: { lightning: 1.08 } } },
        { id: 'copper_coil',   name: 'Copper Coil',       sh: 'tempest', t: 1, col: 0xd8864a, price: 200,  shape: 'ring',    m: { vsWet: 1.2 } },
        { id: 'storm_lens',    name: 'Storm Lens',        sh: 'tempest', t: 2, col: 0xffe14a, price: 550,  m: { stormLens: 1, ult: 0.92 } },
        { id: 'tesla_ring',    name: 'Tesla Ring',        sh: 'tempest', t: 2, col: 0x8ae8ff, price: 600,  shape: 'ring',    m: { el: { lightning: 1.25 }, hp: -15 } },
        { id: 'rain_totem',    name: 'Rain Totem',        sh: 'tempest', t: 2, col: 0x6a9ad8, price: 650,  shape: 'totem',   m: { vsWet: 1.4, speed: 1.06 } },
        { id: 'storm_eye',     name: 'Eye of the Storm',  sh: 'tempest', t: 3, col: 0xfff07a, price: 2000, shape: 'eye',     m: { pierceRes: 1, hp: -20 } },
        { id: 'thunderhead',   name: 'Thunderhead',       sh: 'tempest', t: 3, col: 0xd8d0ff, price: 1900, shape: 'bottle',  m: { proc: 0.15, el: { lightning: 1.2 }, taken: 1.15 } },
        // VOID
        { id: 'star_dust',     name: 'Star Dust',         sh: 'void', t: 1, col: 0xc8b8ff, price: 160,  shape: 'bottle',  m: { el: { cosmic: 1.08 } } },
        { id: 'hex_doll',      name: 'Hex Doll',          sh: 'void', t: 1, col: 0x9a6ad8, price: 200,  shape: 'totem',   m: { vsHex: 1.15 } },
        { id: 'void_prism',    name: 'Void Prism',        sh: 'void', t: 2, col: 0xb388ff, price: 550,  m: { hexReact: 1, speed: 1.06 } },
        { id: 'star_chart',    name: 'Star Chart',        sh: 'void', t: 2, col: 0x6a7ae0, price: 650,  shape: 'scroll',  m: { el: { cosmic: 1.3 }, ult: 1.1, hp: -15 } },
        { id: 'null_mirror',   name: 'Null Mirror',       sh: 'void', t: 2, col: 0xd8c8ff, price: 600,  shape: 'mirror',  m: { vsHex: 1.35, pay: 0.9 } },
        { id: 'event_horizon', name: 'Event Horizon',     sh: 'void', t: 3, col: 0x5a2aa6, price: 2000, shape: 'orb',     m: { killGem: 10, dmg: 0.9 } },
        { id: 'black_star',    name: 'Black Star',        sh: 'void', t: 3, col: 0x3a2a6a, price: 1900, shape: 'star',    m: { vsHex: 1.6, ult: 1.15, hp: -25 } },
        // RESONANCE
        { id: 'tuning_fork',   name: 'Tuning Fork',       sh: 'resonance', t: 1, col: 0xc8c8e0, price: 200,  shape: 'fork',    m: { ult: 1.1 } },
        { id: 'spark_jar',     name: 'Spark Jar',         sh: 'resonance', t: 1, col: 0xffe8a0, price: 220,  shape: 'bottle',  m: { react: 1.2 } },
        { id: 'catalyst_coil', name: 'Catalyst Coil',     sh: 'resonance', t: 2, col: 0x9af0e0, price: 650,  shape: 'ring',    m: { reactDmg: 1.3, ult: 0.9 } },
        { id: 'hourglass',     name: 'Cracked Hourglass', sh: 'resonance', t: 2, col: 0xd8a8ff, price: 500,  m: { ult: 1.25, ultDmg: 1.1, hp: -15 } },
        { id: 'catalyst_stone', name: 'Catalyst Stone',   sh: 'resonance', t: 2, col: 0x7ae0c0, price: 500,  m: { react: 1.5 / 0.85, ult: 0.85 } },
        { id: 'maestros_baton', name: "Maestro's Baton", sh: 'resonance', t: 2, col: 0xe8c8ff, price: 600, shape: 'rune', m: { ultDmg: 1.35, ult: 0.88 } },
        { id: 'grand_overture', name: 'Grand Overture',   sh: 'resonance', t: 3, col: 0xf0c8ff, price: 2200, shape: 'bell',    m: { ultLong: 1.3 } },
        { id: 'perpetual_engine', name: 'Perpetual Engine', sh: 'resonance', t: 3, col: 0xe0b860, price: 2000, shape: 'gear', m: { ult: 1.5, ultDmg: 1.15, hp: -35 } },
        { id: 'prism_heart',   name: 'Prismatic Heart',   sh: 'resonance', t: 3, col: 0xff9ae8, price: 1900, shape: 'heart',   m: { react: 2, ult: 0.9 } },
        // BASTION
        { id: 'thorn_mail',    name: 'Thorn Mail',        sh: 'bastion', t: 1, col: 0xc8a070, price: 400,  m: { thorns: 12, dmg: 0.92 } },
        { id: 'leather_cap',   name: 'Leather Cap',       sh: 'bastion', t: 1, col: 0x9a6a3a, price: 150,  shape: 'helm',    m: { hp: 15 } },
        { id: 'iron_shell',    name: 'Iron Shell',        sh: 'bastion', t: 2, col: 0x9ab0c8, price: 400,  m: { taken: 0.85, speed: 1.08 } },
        { id: 'bulwark_crest', name: 'Bulwark Crest',     sh: 'bastion', t: 2, col: 0x7a8aa0, price: 700,  shape: 'shield',  m: { armorDmg: 0.001, speed: 1.06 } },
        { id: 'spiked_bulwark', name: 'Spiked Bulwark',   sh: 'bastion', t: 2, col: 0x8a8a9a, price: 650,  shape: 'shield',  m: { thorns: 25, speed: 1.1 } },
        { id: 'colossus',      name: 'Colossus Core',     sh: 'bastion', t: 3, col: 0xc89a6a, price: 2000, shape: 'gear',    m: { hpHit: 0.01, thornsPct: 0.3, speed: 1.12 } },
        { id: 'aegis',         name: 'Aegis',             sh: 'bastion', t: 3, col: 0xf0d080, price: 2000, shape: 'shield',  m: { taken: 0.65, dmg: 0.8 } },
        { id: 'titan_heart',   name: "Titan's Heart",     sh: 'bastion', t: 3, col: 0xb07a5a, price: 1900, shape: 'heart',   m: { hp: 80, speed: 1.15, dmg: 0.9 } },
        // BLOOD
        { id: 'field_bandage', name: 'Field Bandage',     sh: 'blood', t: 1, col: 0xf0e6d0, price: 150,  shape: 'scroll',  m: { heal: 0.1 } },
        { id: 'leech_jar',     name: 'Leech Jar',         sh: 'blood', t: 1, col: 0x8a3a4a, price: 220,  shape: 'bottle',  m: { leech: 1 } },
        { id: 'vampire_tooth', name: 'Vampire Tooth',     sh: 'blood', t: 2, col: 0xe05a7a, price: 450,  m: { leech: 2, hp: -15 } },
        { id: 'bloodthirst',   name: 'Bloodthirst',       sh: 'blood', t: 2, col: 0xc8203a, price: 700,  shape: 'tooth',   m: { drain: 0.02, hp: -10 } },
        { id: 'blood_chalice', name: 'Blood Chalice',     sh: 'blood', t: 2, col: 0xb0203a, price: 650,  shape: 'chalice', m: { leech: 3, taken: 1.1 } },
        { id: 'crimson_grail', name: 'Crimson Grail',     sh: 'blood', t: 3, col: 0xff2a4a, price: 2000, shape: 'chalice', m: { leech: 5, hp: -30 } },
        { id: 'undying_ember', name: 'Undying Ember',     sh: 'blood', t: 3, col: 0xff7a5a, price: 1900, shape: 'heart',   m: { heal: 0.4, hp: 40, dmg: 0.85 } },
        // ZEPHYR
        { id: 'wind_charm',    name: 'Wind Charm',        sh: 'zephyr', t: 1, col: 0xa8e07a, price: 400,  m: { speed: 0.88, hp: -10 } },
        { id: 'light_boots',   name: 'Light Boots',       sh: 'zephyr', t: 1, col: 0xc8a878, price: 180,  shape: 'boot',    m: { speed: 0.94 } },
        { id: 'racing_heart',  name: 'Racing Heart',      sh: 'zephyr', t: 2, col: 0xff8a9a, price: 650,  shape: 'heart',   m: { momentum: 0.02, hp: -10 } },
        { id: 'feather_cloak', name: 'Feather Cloak',     sh: 'zephyr', t: 2, col: 0xe0f0d0, price: 600,  shape: 'feather', m: { speed: 0.85, taken: 1.1 } },
        { id: 'quickdraw',     name: 'Quickdraw',         sh: 'zephyr', t: 2, col: 0xd0b060, price: 650,  shape: 'claw',    m: { opener: 1.3, speed: 0.95 } },
        { id: 'trailblazer',   name: 'Trailblazer',       sh: 'zephyr', t: 3, col: 0x9af0c8, price: 2000, shape: 'boot',    m: { dashTrail: 1, taken: 1.1 } },
        { id: 'stormrunner',   name: 'Stormrunner',       sh: 'zephyr', t: 3, col: 0x7af0b0, price: 1900, shape: 'boot',    m: { speed: 0.75, hp: -30, dmg: 1.1 } },
        { id: 'phantom_step',  name: 'Phantom Step',      sh: 'zephyr', t: 3, col: 0xc0f0e0, price: 2000, shape: 'mirror',  m: { blink: 1, speed: 0.9, hp: -15 } },
        // FORTUNE
        { id: 'lucky_penny',   name: 'Lucky Penny',       sh: 'fortune', t: 1, col: 0xd8864a, price: 150,  shape: 'coin',    m: { pay: 1.1 } },
        { id: 'piggy_bank',    name: 'Piggy Bank',        sh: 'fortune', t: 1, col: 0xff9ab8, price: 250,  shape: 'chest',   m: { pay: 1.15, dmg: 0.95 } },
        { id: 'tinkers_gloves', name: "Tinker's Gloves", sh: 'fortune', t: 2, col: 0xb08a5a, price: 650,  shape: 'claw',    m: { gadgetCd: 0.6, taken: 1.1 } },
        { id: 'gamblers_coin', name: "Gambler's Coin",    sh: 'fortune', t: 2, col: 0xffd34a, price: 600,  m: { pay: 1.3, taken: 1.1 } },
        { id: 'golden_idol',   name: 'Golden Idol',       sh: 'fortune', t: 2, col: 0xf0c040, price: 700,  shape: 'totem',   m: { pay: 1.4, hp: -25 } },
        { id: 'midas_touch',   name: "Midas' Touch",      sh: 'fortune', t: 3, col: 0xffe060, price: 2200, shape: 'claw',    m: { pay: 1.8, taken: 1.2 } },
        { id: 'dragon_hoard',  name: "Dragon's Hoard",    sh: 'fortune', t: 3, col: 0xe0a020, price: 2400, shape: 'chest',   m: { pay: 1.5, dmg: 1.1, hp: -20 } },
        // HUNTER
        { id: 'trophy_tooth',  name: 'Trophy Tooth',      sh: 'hunter', t: 1, col: 0xf0e0c0, price: 200,  shape: 'tooth',   m: { boss: 1.12 } },
        { id: 'reaper_coin',   name: "Reaper's Coin",     sh: 'hunter', t: 1, col: 0x8a8aa0, price: 200,  shape: 'coin',    m: { exec: 1.2 } },
        { id: 'focus_lens',    name: 'Focus Lens',        sh: 'hunter', t: 2, col: 0xe0d8a0, price: 700,  shape: 'eye',     m: { burst: 5000, speed: 1.05 } },
        { id: 'giantslayer',   name: 'Giantslayer',       sh: 'hunter', t: 2, col: 0xc87a5a, price: 650,  shape: 'tooth',   m: { boss: 1.3, dmg: 0.95 } },
        { id: 'headsman_axe',  name: "Headsman's Axe",    sh: 'hunter', t: 2, col: 0xa0a0b0, price: 650,  shape: 'axe',     m: { exec: 1.45, opener: 0.9 } },
        { id: 'kingsbane',     name: 'Kingsbane',         sh: 'hunter', t: 3, col: 0xffd34a, price: 2000, shape: 'crown',   m: { boss: 1.6, dmg: 0.9, hp: -20 } },
        { id: 'deaths_door',   name: "Death's Door",      sh: 'hunter', t: 3, col: 0x6a5a7a, price: 1900, shape: 'skull',   m: { exec: 1.8, taken: 1.1 } },
        // CARNAGE
        { id: 'blast_cap',     name: 'Blast Cap',         sh: 'carnage', t: 1, col: 0xff8a4a, price: 180,  shape: 'bottle',  m: { boom: 4 } },
        { id: 'powder_keg',    name: 'Powder Keg',        sh: 'carnage', t: 1, col: 0x8a5a2a, price: 250,  shape: 'chest',   m: { boom: 7, hp: -10 } },
        { id: 'splinter_core', name: 'Splinter Core',     sh: 'carnage', t: 2, col: 0xd88a5a, price: 700,  shape: 'gem',     m: { splash: 0.25, dmg: 0.9 } },
        { id: 'chain_fuse',    name: 'Chain Fuse',        sh: 'carnage', t: 2, col: 0xffb04a, price: 650,  shape: 'ring',    m: { boom: 10, dmg: 0.95 } },
        { id: 'shrapnel',      name: 'Shrapnel Pouch',    sh: 'carnage', t: 2, col: 0x9a9aa8, price: 600,  shape: 'gem',     m: { boom: 8, opener: 1.15 } },
        { id: 'doomsday_clock', name: 'Doomsday Clock',   sh: 'carnage', t: 3, col: 0xff4a2a, price: 2000, shape: 'gear',    m: { boom: 20, taken: 1.15 } },
        { id: 'cataclysm',     name: 'Cataclysm',         sh: 'carnage', t: 3, col: 0xff2a1a, price: 2200, shape: 'skull',   m: { boom: 14, dmg: 1.1, hp: -30 } },
        // CHAOS: Luck (earned by clean kills, lost when hit) tilts every roll these make
        { id: 'four_leaf',     name: 'Four-Leaf Clover',  sh: 'chaos', t: 1, col: 0x6ad86a, price: 180,  shape: 'heart',   m: { luckBase: 5 } },
        { id: 'rabbit_foot',   name: "Rabbit's Foot",     sh: 'chaos', t: 1, col: 0xe8d8c0, price: 220,  shape: 'tooth',   m: { luckGain: 1 } },
        { id: 'cursed_die',    name: 'Cursed Die',        sh: 'chaos', t: 2, col: 0xe8e0f0, price: 650,  shape: 'dice',    m: { cursedDie: 1, hp: -10 } },
        { id: 'lucky_streak',  name: 'Lucky Streak',      sh: 'chaos', t: 2, col: 0xffd34a, price: 650,  shape: 'star',    m: { streak: 0.05, ult: 0.92 } },
        { id: 'jackpot',       name: 'Jackpot',           sh: 'chaos', t: 2, col: 0xf0c040, price: 700,  shape: 'coin',    m: { jackpot: 0.01, pay: 0.9 } },
        { id: 'wheel_of_fate', name: 'Wheel of Fate',     sh: 'chaos', t: 3, col: 0xc87ae0, price: 2200, shape: 'gear',    m: { wheel: 1, hp: -15 } },
        { id: 'double_or_nothing', name: 'Double or Nothing', sh: 'chaos', t: 3, col: 0xff6a8a, price: 2200, shape: 'dice', m: { doubleCrit: 1, taken: 1.1 } },
        { id: 'coin_flip',     name: 'Coin Flip',         sh: 'chaos', t: 3, col: 0xffe060, price: 2000, shape: 'coin',    m: { coinFlip: 1, hp: -20 } },
    ],
    STOCK: [3, 2, 1],   // today's stock: this many of each tier (Legends once you're far enough up the Tower)

    _get(k, d) { try { return JSON.parse(localStorage.getItem(k) || d); } catch (e) { return JSON.parse(d); } },
    _set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} },
    def(id) { return this.LIST.find(r => r.id === id) || this._corruptDef(id); },
    // ── CORRUPTED RELICS ──────────────────────────────────────────────────────
    // Siphon two relics you own into one: it keeps half of each one's upsides, none of their
    // downsides, and gains a small curse of its own. The two are gone for good. Wear one at most.
    SIPHON: 0.5,
    CURSES: [{ ult: 0.9 }, { taken: 1.08 }, { speed: 1.05 }, { hp: -10 }, { pay: 0.9 }],
    corrupted() { return this._get('relics_corrupt', '[]'); },
    _corruptDef(id) {
        const c = this.corrupted().find(x => x.id === id);
        if (!c) return null;
        const A = this.LIST.find(r => r.id === c.srcs[0]), B = this.LIST.find(r => r.id === c.srcs[1]);
        if (!A || !B) return null;
        return { id, name: `${A.name.split(' ').pop()} ${B.name.split(' ').pop()}`, sh: 'corrupt', t: 3, col: 0x7aff5a, price: 0, corrupt: true, srcs: c.srcs,
                 m: this._trim(this.combine(this.combine(this._good(A.m), this._good(B.m)), this.CURSES[c.curse % this.CURSES.length])) };
    },
    // a mods object without its neutral values (combine fills every key), so text() lists only real effects
    _trim(m) {
        const out = {};
        for (const k of this.MUL) if (m[k] != null && Math.abs(m[k] - 1) > 1e-6) out[k] = m[k];
        for (const k of this.ADD) if (m[k]) out[k] = m[k];
        for (const k of this.FLAG) if (m[k]) out[k] = m[k];
        const el = Object.fromEntries(Object.entries(m.el || {}).filter(([, v]) => Math.abs(v - 1) > 1e-6)); if (Object.keys(el).length) out.el = el;
        if (m.swapBy && Object.keys(m.swapBy).length) out.swapBy = m.swapBy;
        for (const k of ['killGem', 'burst', 'ultLong']) if (m[k]) out[k] = m[k];
        return out;
    },
    // a relic's upsides only, at SIPHON strength (on/off effects stay on: they're the costly half)
    _good(m) {
        const out = {}, k2 = this.SIPHON;
        for (const k of this.MUL) if (m[k] != null) { const good = ['taken', 'speed', 'gadgetCd'].includes(k) ? m[k] < 1 : m[k] > 1; if (good) out[k] = 1 + (m[k] - 1) * k2; }
        for (const k of this.ADD) if (m[k] > 0) out[k] = Math.round(m[k] * k2 * 1000) / 1000;
        for (const k of this.FLAG) if (m[k]) out[k] = 1;
        for (const e in (m.el || {})) if (m.el[e] > 1) (out.el ||= {})[e] = 1 + (m.el[e] - 1) * k2;
        if (m.swapBy) out.swapBy = Object.fromEntries(Object.entries(m.swapBy).map(([e, o]) => [e, { hits: o.hits, bonus: o.bonus * k2 }]));
        if (m.killGem) out.killGem = m.killGem; if (m.burst) out.burst = m.burst;
        return out;
    },
    // a and b (owned, ordinary) into a new corrupted relic; returns its id or null
    siphon(a, b, rnd = Math.random) {
        const A = this.LIST.find(r => r.id === a), B = this.LIST.find(r => r.id === b);
        if (!A || !B || a === b || !this.has(a) || !this.has(b)) return null;
        const id = 'cr_' + Date.now().toString(36);
        this._set('relics_corrupt', [...this.corrupted(), { id, srcs: [a, b], curse: Math.floor(rnd() * this.CURSES.length) }]);
        this._set('relics_owned', [...this.owned().filter(x => x !== a && x !== b), id]);
        this._set('relics_worn', this._get('relics_worn', '[]').filter(x => x !== a && x !== b));
        return id;
    },
    // every relic, the corrupted ones you've made included (the shop walks this)
    all() { return [...this.LIST, ...this.corrupted().map(c => this.def(c.id)).filter(Boolean)]; },
    owned() { return this._get('relics_owned', '[]').filter(id => this.def(id)); },
    has(id) { return this.owned().includes(id); },
    give(id) { const o = this.owned(); if (!o.includes(id) && this.def(id)) { o.push(id); this._set('relics_owned', o); } },
    // None to start: the Tower opens them. The first the first time you go in, then at these
    // best floors (SLOT_AT[0] = 0: just entering).
    SLOT_AT: [0, 5, 15, 30, 50],
    slots() {
        const b = (typeof TowerFloors !== 'undefined') ? TowerFloors.best() : 0, entered = b > 0 || localStorage.getItem('tower_entered') === '1';
        return entered ? this.SLOT_AT.filter(f => b >= f).length : 0;
    },
    // what opens slot i, for the shop
    slotNeeds(i) { return i === 0 ? 'enter the Tower' : `Tower floor ${this.SLOT_AT[i]}`; },
    worn() { const o = this.owned(); return this._get('relics_worn', '[]').filter(id => o.includes(id)).slice(0, this.slots()); },
    // Wear it (if there's a free slot) or take it off. Returns whether it's worn now.
    toggle(id) {
        let w = this.worn();
        if (w.includes(id)) w = w.filter(x => x !== id);
        else if (this.def(id)?.corrupt && w.some(x => this.def(x)?.corrupt)) return false;   // one corrupted relic worn at most
        else if (this.has(id) && w.length < this.slots()) w.push(id);
        this._set('relics_worn', w);
        return w.includes(id);
    },
    // Today's stock: relics you don't own, STOCK of each tier, the same all day.
    stock(day = Math.floor(Date.now() / 86400000)) {
        let s = (day * 9301 + 49297) % 233280;
        const rnd = () => (s = (s * 9301 + 49297) % 233280) / 233280;
        const legend = (typeof TowerFloors !== 'undefined' ? TowerFloors.best() : 0) >= this.LEGEND_AT;
        const out = [];
        for (const t of [1, 2, 3]) {
            if (t === 3 && !legend) continue;
            const left = this.LIST.filter(r => r.t === t && !this.has(r.id));
            for (let i = left.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [left[i], left[j]] = [left[j], left[i]]; }
            out.push(...left.slice(0, this.STOCK[t - 1]).map(r => r.id));
        }
        return out;
    },
    // A random one you don't have yet, or null (a Tower boss's drop): higher floors, higher tiers.
    drop(floor = 10) {
        const want = floor >= 40 ? [3] : floor >= 20 ? [2, 3] : [1, 2];
        for (const tiers of [want, [1, 2, 3]]) {
            const left = this.LIST.filter(r => tiers.includes(r.t) && !this.has(r.id));
            if (left.length) return left[Math.floor(Math.random() * left.length)].id;
        }
        return null;
    },
    shelf(id) { return this.SHELVES.find(s => s.id === id); },
    // a shelf's relics of one tier
    onShelf(sh, t) { return sh === 'corrupt' ? (t === 3 ? this.corrupted().map(c => this.def(c.id)).filter(Boolean) : []) : this.LIST.filter(r => r.sh === sh && r.t === t); },

    // ── EFFECTS ───────────────────────────────────────────────────────────────
    MUL: ['dmg', 'taken', 'ult', 'ultDmg', 'react', 'speed', 'pay', 'boss', 'exec', 'opener', 'vsBurn', 'vsChill', 'vsWet', 'vsHex', 'chillOther', 'reactDmg', 'gadgetCd'],
    ADD: ['hp', 'leech', 'thorns', 'heal', 'crit', 'critMult', 'proc', 'boom', 'switchNova', 'reactBoom', 'hpHit', 'thornsPct', 'armorDmg', 'momentum', 'drain', 'splash', 'luckBase', 'streak', 'jackpot'],
    // on or off (worn or not), and the ones that carry their own settings
    FLAG: ['stormLens', 'hexReact', 'pierceRes', 'blink', 'dashTrail', 'luckGain', 'cursedDie', 'wheel', 'doubleCrit', 'coinFlip'],
    // Nothing: the identity every mods object starts from.
    none() {
        const out = { el: { fire: 1, ice: 1, lightning: 1, cosmic: 1 } };
        for (const k of this.MUL) out[k] = 1;
        for (const k of this.ADD) out[k] = 0;
        for (const k of this.FLAG) out[k] = 0;
        out.swapBy = {}; out.killGem = 0; out.burst = 0; out.ultLong = 0;
        return out;
    },
    // Two mods objects together: multipliers multiply, flat amounts add.
    combine(a, b) {
        const out = this.none();
        for (const x of [a, b]) {
            if (!x) continue;
            for (const k of this.MUL) if (x[k] != null) out[k] *= x[k];
            for (const k of this.ADD) if (x[k] != null) out[k] += x[k];
            for (const k of this.FLAG) if (x[k]) out[k] = 1;
            for (const e in (x.swapBy || {})) { const o = out.swapBy[e] || { hits: 0, bonus: 0 }; out.swapBy[e] = { hits: Math.max(o.hits, x.swapBy[e].hits), bonus: o.bonus + x.swapBy[e].bonus }; }   // boons and relics stack per element
            if (x.killGem) out.killGem = out.killGem ? Math.min(out.killGem, x.killGem) : x.killGem;
            if (x.burst) out.burst = out.burst ? Math.min(out.burst, x.burst) : x.burst;
            if (x.ultLong) out.ultLong = Math.max(out.ultLong || 1, x.ultLong);
            for (const e in (x.el || {})) out.el[e] *= x.el[e];
        }
        return out;
    },
    // What the worn relics add up to.
    mods() { return this.worn().reduce((acc, id) => this.combine(acc, this.def(id).m), this.none()); },
    // The damage mods that depend on who's hit (CombatSystem._dmgOutMult): `enemy` null is a boss
    // or queen hit.
    vsMult(m, enemy, scene, el = null) {
        if (!m) return 1;
        if (!enemy || enemy.isBoss) {
            let b = m.boss ?? 1;
            if (m.momentum && scene?._moveLog) { const now = scene.time.now; b *= 1 + Math.min(0.2, m.momentum * scene._moveLog.filter(t => now - t < 2000).length); }
            if (m.armorDmg && typeof PlayerStats !== 'undefined') b *= 1 + Math.min(0.3, m.armorDmg * PlayerStats.armor());
            return b;
        }
        let k = 1;
        if (enemy.maxHealth && enemy.health / enemy.maxHealth < 0.3) k *= m.exec ?? 1;
        if (enemy.maxHealth && enemy.health >= enemy.maxHealth) k *= m.opener ?? 1;
        if (enemy.burnStacks > 0) k *= m.vsBurn ?? 1;
        if (enemy.isFrozen || enemy._iceCube || enemy.chillStacks > 0) k *= m.vsChill ?? 1;
        if ((enemy.isFrozen || enemy._iceCube || enemy.chillStacks > 0) && el && el !== 'ice') k *= m.chillOther ?? 1;   // Frost Core: chill it, then swap
        if ((enemy._csHexUntil || 0) > (scene?.time?.now ?? 0)) k *= m.vsHex ?? 1;
        if ((m.vsWet ?? 1) !== 1 && scene?.isWaterAt?.(enemy.x, enemy.y)) k *= m.vsWet;
        if (m.momentum && scene?._moveLog) { const now = scene.time.now; k *= 1 + Math.min(0.2, m.momentum * scene._moveLog.filter(t => now - t < 2000).length); }   // Racing Heart
        if (m.armorDmg && typeof PlayerStats !== 'undefined') k *= 1 + Math.min(0.3, m.armorDmg * PlayerStats.armor());                                     // Bulwark Crest
        return k;
    },
    // A relic's words, written from its numbers so they can't drift.
    text(r) {
        const m = r.m, out = [], pct = v => Math.round(Math.abs(v - 1) * 100), sg = v => (v >= 1 ? '+' : '-');
        const EL = { fire: 'Fire', ice: 'Ice', lightning: 'Lightning', cosmic: 'Cosmic' };
        const say = {
            dmg: v => `${sg(v)}${pct(v)}% damage`, hp: v => `${v > 0 ? '+' : '-'}${Math.abs(v)} max HP`,
            taken: v => `take ${pct(v)}% ${v < 1 ? 'less' : 'more'} damage`, ultDmg: v => `${sg(v)}${pct(v)}% ult damage`, ult: v => `ults charge ${pct(v)}% ${v > 1 ? 'faster' : 'slower'}`,
            react: v => `reactions charge ${pct(v)}% more`, speed: v => `move ${pct(v)}% ${v < 1 ? 'faster' : 'slower'}`,
            pay: v => `Tower floors pay ${pct(v)}% more`, leech: v => `kills heal ${v} HP`, thorns: v => `melee hits on you deal ${v} back`,
            heal: v => `heal ${Math.round(v * 100)}% more after a Tower floor`, crit: v => `+${Math.round(v * 100)}% crit chance`,
            critMult: v => `crits hit ${Math.round(v * 100)}% harder`, proc: v => `${Math.round(v * 100)}% of hits add their element's touch`,
            boom: v => `kills burst for ${v} on what's close`, boss: v => `${sg(v)}${pct(v)}% damage to bosses`,
            exec: v => `+${pct(v)}% damage to enemies under 30% health`, opener: v => `${sg(v)}${pct(v)}% damage to enemies at full health`,
            vsBurn: v => `+${pct(v)}% damage to enemies with Burn`, vsChill: v => `+${pct(v)}% damage to enemies with Chill or Brittle`,
            vsWet: v => `+${pct(v)}% damage to enemies in water`, vsHex: v => `+${pct(v)}% damage to enemies with Hex`,
            chillOther: v => `enemies with Chill or Brittle take +${pct(v)}% from non-ice hits`,
            swapBy: v => Object.entries(v).map(([e, o]) => `your first ${o.hits} hits after switching to ${e} deal +${Math.round(o.bonus * 100)}%`).join(', '),
            stormLens: () => 'lightning hits on enemies with Superconducted also apply a Burn stack and Chill',
            hexReact: () => 'hits on enemies with Hex count as reactions for any ult',
            switchNova: v => `switching element releases a nova of the new one (${v} damage)`,
            reactBoom: v => `reactions burst for ${v} on what's close`,
            pierceRes: () => 'resisted hits ignore half the resistance',
            killGem: v => `every ${v}th kill drops a gem shard (ult charge)`,
            blink: () => 'a hit while you\'re above 90% HP blinks you a tile away',
            dashTrail: () => 'dashing leaves a trail of your element (lava, frost, sparks, cosmic fluid)',
            ultLong: v => `ults last ${pct(v)}% longer, but you can only cast one with all four gems full`,
            gadgetCd: v => v < 1 ? `gadgets recharge ${pct(v)}% faster` : `gadgets recharge ${pct(v)}% slower`,
            hpHit: v => `your hits add ${Math.round(v * 100)}% of your max HP`,
            thornsPct: v => `melee hits on you deal ${Math.round(v * 100)}% of the hit back`,
            armorDmg: v => `+${Math.round(v * 1000)}% damage per 10 armor (30% at most)`,
            momentum: v => `+${Math.round(v * 100)}% damage per tile moved in the last 2s (20% at most)`,
            drain: v => `heal ${Math.round(v * 1000) / 10}% of your hit damage`,
            splash: v => `${Math.round(v * 100)}% of each hit spills onto enemies beside it`,
            burst: v => `every ${Math.round(v / 1000)}s your next hit deals x3`,
            reactDmg: v => `reactions deal +${pct(v)}%`,
            luckBase: v => `+${v} Luck`,
            luckGain: () => '+1 Luck per kill while you go unhit (20 at most), lost when you\'re hit',
            cursedDie: () => 'each hit rolls a die: a 1 misses, a 6 hits x4 (Luck turns 1s into rerolls)',
            streak: v => `crits in a row stack +${Math.round(v * 100)}% damage each (+50% at most)`,
            jackpot: v => `kills have a ${Math.round(v * 1000) / 10}% chance (more with Luck) to fill a random ult gem`,
            wheel: () => 'every 10s the Wheel of Fate spins: double damage, a moment untouchable, a full gem, double speed, or (rarely, less with Luck) a mild curse',
            doubleCrit: () => 'a crit can crit again, and again (x1.5 each), but non-crits sometimes stagger you',
            coinFlip: () => 'a killing blow flips a coin (Luck weights it): heads, you live on 1 HP (once a minute)',
        };
        const GOOD = ['chillOther', 'swapBy', 'stormLens', 'hexReact', 'switchNova', 'reactBoom', 'pierceRes', 'killGem', 'blink', 'dashTrail', 'ultLong', 'hpHit', 'thornsPct', 'armorDmg', 'momentum', 'drain', 'splash', 'burst', 'reactDmg', 'luckBase', 'luckGain', 'cursedDie', 'streak', 'jackpot', 'wheel', 'doubleCrit', 'coinFlip'];
        for (const e in (m.el || {})) out.push({ good: m.el[e] > 1, s: `${EL[e]} does ${pct(m.el[e])}% ${m.el[e] > 1 ? 'more' : 'less'}` });
        for (const k in m) if (say[k]) {
            const v = m[k], good = (GOOD.includes(k) && !(k === 'reactDmg' && v < 1)) || ((k === 'taken' || k === 'speed' || k === 'gadgetCd') ? v < 1 : (this.MUL.includes(k) ? v > 1 : v > 0));
            out.push({ good, s: say[k](v) });
        }
        const up = out.filter(o => o.good).map(o => o.s), down = out.filter(o => !o.good).map(o => o.s);
        const cap = t => t.charAt(0).toUpperCase() + t.slice(1);
        return cap(up.join(', ')) + (down.length ? `, but ${down.join(', ')}` : '') + '.';
    },

    // A relic's icon: 16px pixel art (ShopScene.icon) in its colour.
    icon(scene, id) {
        const r = this.def(id), key = 'relic_' + id;
        if (!r || typeof ShopScene === 'undefined' || !ShopScene.icon) return null;
        const hex = c => '#' + c.toString(16).padStart(6, '0');
        const lite = c => hex([16, 8, 0].reduce((v, sh) => v | (Math.min(255, ((c >> sh) & 255) + 70) << sh), 0));
        const dark = c => hex([16, 8, 0].reduce((v, sh) => v | (Math.floor(((c >> sh) & 255) * 0.45) << sh), 0));
        return ShopScene.icon(scene, key, 16, { a: hex(r.col), b: lite(r.col), d: dark(r.col), w: '#ffffff', G: '#d8b040', s: '#6a6a80', p: '#f0e6cc', g: '#fffbe0' }, (m, f) => {
            const D = {
                glass_fang:    () => { m.poly([[5, 2], [11, 2], [9, 14], [8, 14]], 'a'); m.line(6, 3, 8, 12, 'w'); m.rect(4, 2, 8, 2, 'G'); },
                iron_shell:    () => { m.disc(8, 9, 6, 'd'); m.disc(8, 9, 4.5, 'a'); for (let k = -1; k <= 1; k++) m.line(8 + k * 3, 4, 8 + k * 4, 14, 'd'); m.set(6, 6, 'w'); },
                hourglass:     () => { m.rect(3, 1, 10, 2, 'G'); m.rect(3, 13, 10, 2, 'G'); m.poly([[4, 3], [12, 3], [8, 8]], 'a'); m.poly([[8, 8], [12, 13], [4, 13]], 'b'); m.line(9, 4, 7, 12, 'd'); },
                ember_heart:   () => { m.disc(5.5, 6, 3, 'a'); m.disc(10.5, 6, 3, 'a'); m.poly([[2.6, 7], [13.4, 7], [8, 13.5]], 'a'); m.poly([[8, 4], [10, 8], [8, 11], [6, 8]], 'b'); m.set(8, 7, 'w'); },
                frost_core:    () => { m.poly([[8, 1], [13, 8], [8, 15], [3, 8]], 'a'); m.poly([[8, 4], [10.5, 8], [8, 12], [5.5, 8]], 'b'); m.set(7, 6, 'w'); },
                storm_lens:    () => { m.disc(8, 8, 6, 'd'); m.disc(8, 8, 4.5, 'b'); m.poly([[9, 4], [6, 8.5], [8, 8.5], [7, 12], [10.5, 7], [8.5, 7]], 'a'); m.set(6, 5, 'w'); },
                void_prism:    () => { m.poly([[8, 1], [14, 12], [2, 12]], 'a'); m.poly([[8, 4], [11, 10], [5, 10]], 'd'); m.line(8, 4, 8, 10, 'b'); m.set(7, 5, 'w'); },
                vampire_tooth: () => { m.poly([[4, 2], [12, 2], [11, 9], [8, 14], [5, 9]], 'w'); m.poly([[5, 2], [11, 2], [10, 6], [6, 6]], 's'); m.disc(8, 13, 1.4, 'a'); },
                thorn_mail:    () => { m.poly([[3, 3], [13, 3], [12, 13], [4, 13]], 'a'); for (let y = 4; y < 13; y += 3) for (let x = 4; x < 13; x += 3) m.set(x, y, 'd'); m.set(2, 6, 'b'); m.set(14, 6, 'b'); m.set(2, 10, 'b'); m.set(14, 10, 'b'); },
                gamblers_coin: () => { m.disc(8, 8, 6, 'a'); m.ring(8, 8, 6, 1, 'd'); m.rect(7, 4, 2, 8, 'd'); m.rect(5, 6, 6, 1, 'd'); m.set(6, 5, 'w'); },
                wind_charm:    () => { m.ring(8, 8, 5.5, 1.2, 'a'); m.line(2, 6, 10, 6, 'b'); m.line(4, 10, 13, 10, 'b'); m.set(12, 5, 'w'); m.rect(7, 1, 2, 3, 'G'); },
                lucky_charm:   () => { for (const [cx, cy] of [[5.5, 5.5], [10.5, 5.5], [5.5, 10.5], [10.5, 10.5]]) m.disc(cx, cy, 3, 'a'); m.disc(8, 8, 2, 'b'); m.line(9, 10, 12, 15, 'd'); m.set(5, 4, 'w'); },
                catalyst_stone:() => { m.poly([[8, 2], [13, 6], [11, 13], [5, 13], [3, 6]], 'a'); m.poly([[8, 5], [10, 7], [9, 11], [7, 11], [6, 7]], 'b'); m.set(8, 7, 'w'); },
            };
            const SH = {   // the shapes the newer relics are drawn from, in their colour
                eye:     () => { m.poly([[1, 8], [5, 4], [11, 4], [15, 8], [11, 12], [5, 12]], 'b'); m.disc(8, 8, 3, 'a'); m.disc(8, 8, 1.4, 'd'); m.set(7, 7, 'w'); },
                rune:    () => { m.poly([[4, 2], [12, 3], [13, 13], [3, 14]], 's'); m.line(8, 4, 8, 12, 'a'); m.line(6, 6, 10, 9, 'a'); m.line(10, 6, 6, 9, 'b'); },
                orb:     () => { m.disc(8, 8, 6, 'd'); m.disc(8, 8, 5, 'a'); m.disc(6.5, 6.5, 2, 'b'); m.set(6, 5, 'w'); m.rect(5, 13, 6, 2, 'G'); },
                claw:    () => { for (let k = 0; k < 3; k++) m.poly([[3 + k * 4, 13], [5 + k * 4, 13], [7 + k * 3, 2 + k], [5 + k * 3, 4 + k]], k === 1 ? 'b' : 'a'); m.rect(2, 12, 12, 3, 'd'); },
                dice:    () => { m.rect(3, 3, 10, 10, 'a'); m.rect(3, 3, 10, 2, 'b'); for (const [x, y] of [[5, 7], [8, 9], [11, 11], [11, 7], [5, 11]]) m.set(x, y, 'd'); },
                chest:   () => { m.rect(2, 6, 12, 8, 'a'); m.rect(2, 4, 12, 3, 'b'); m.rect(2, 9, 12, 1, 'd'); m.rect(7, 8, 2, 3, 'G'); },
                feather: () => { m.line(4, 14, 12, 2, 'd'); for (let k = 0; k < 7; k++) { m.line(5 + k, 12 - k * 1.6, 9 + k * 0.6, 13 - k * 1.6, 'a'); m.line(5 + k, 12 - k * 1.6, 2 + k, 9 - k * 1.4, 'b'); } },
                star:    () => { const pts = []; for (let k = 0; k < 10; k++) { const a = -Math.PI / 2 + k * Math.PI / 5, rr = k % 2 ? 2.8 : 6.8; pts.push([8 + Math.cos(a) * rr, 8.5 + Math.sin(a) * rr]); } m.poly(pts, 'a'); m.disc(8, 8.5, 2, 'b'); m.set(8, 8, 'w'); },
                crown:   () => { m.poly([[2, 13], [2, 5], [5, 9], [8, 3], [11, 9], [14, 5], [14, 13]], 'a'); m.rect(2, 11, 12, 2, 'd'); m.set(8, 6, 'b'); m.set(5, 11, 'b'); m.set(11, 11, 'b'); },
                gem:     () => { m.poly([[8, 1], [14, 6], [8, 15], [2, 6]], 'a'); m.poly([[8, 1], [11, 6], [8, 15], [5, 6]], 'b'); m.line(2, 6, 14, 6, 'd'); m.set(6, 4, 'w'); },
                bell:    () => { m.poly([[6, 3], [10, 3], [12, 10], [14, 12], [2, 12], [4, 10]], 'a'); m.rect(7, 1, 2, 2, 'G'); m.disc(8, 13.5, 1.4, 'd'); m.line(6, 5, 5, 10, 'b'); },
                ring:    () => { m.ring(8, 9, 5.5, 1.8, 'a'); m.ring(8, 9, 5.5, 0.8, 'b'); m.poly([[6, 2], [10, 2], [11, 4], [5, 4]], 'G'); m.set(8, 3, 'w'); },
                totem:   () => { m.rect(5, 2, 6, 12, 'a'); m.rect(5, 6, 6, 1, 'd'); m.rect(5, 10, 6, 1, 'd'); m.set(6, 4, 'w'); m.set(9, 4, 'w'); m.rect(6, 8, 4, 1, 'b'); m.rect(3, 14, 10, 1, 'd'); },
                bottle:  () => { m.rect(7, 1, 2, 3, 's'); m.poly([[6, 4], [10, 4], [13, 9], [12, 14], [4, 14], [3, 9]], 'a'); m.rect(5, 9, 6, 4, 'b'); m.set(6, 7, 'w'); },
                scroll:  () => { m.rect(3, 4, 10, 9, 'p'); m.rect(2, 3, 12, 2, 'a'); m.rect(2, 12, 12, 2, 'a'); for (let y = 6; y < 11; y += 2) m.line(5, y, 11, y, 'd'); },
                mirror:  () => { m.disc(8, 6.5, 5, 'G'); m.disc(8, 6.5, 4, 'a'); m.line(6, 4, 9, 8, 'w'); m.rect(7, 11, 2, 4, 'G'); },
                fork:    () => { m.rect(7, 8, 2, 7, 's'); m.rect(4, 2, 2, 8, 'a'); m.rect(10, 2, 2, 8, 'a'); m.rect(4, 8, 8, 2, 'a'); m.set(4, 2, 'w'); },
                heart:   () => { m.disc(5.5, 6, 3, 'a'); m.disc(10.5, 6, 3, 'a'); m.poly([[2.6, 7], [13.4, 7], [8, 13.5]], 'a'); m.disc(5, 5.5, 1.2, 'b'); m.set(5, 5, 'w'); },
                gear:    () => { for (let k = 0; k < 8; k++) { const a = k * Math.PI / 4; m.rect(8 + Math.cos(a) * 6 - 1, 8 + Math.sin(a) * 6 - 1, 2, 2, 'a'); } m.disc(8, 8, 5, 'a'); m.disc(8, 8, 2, 'd'); m.set(6, 5, 'b'); },
                helm:    () => { m.disc(8, 9, 6, 'a'); m.rect(2, 9, 12, 5, 'a'); m.rect(2, 12, 12, 2, 'd'); m.line(5, 5, 7, 4, 'b'); },
                shield:  () => { m.poly([[3, 2], [13, 2], [13, 8], [8, 14], [3, 8]], 'a'); m.poly([[5, 4], [11, 4], [11, 8], [8, 12], [5, 8]], 'b'); m.line(8, 3, 8, 12, 'd'); },
                boot:    () => { m.rect(5, 2, 5, 9, 'a'); m.rect(5, 10, 9, 4, 'a'); m.rect(5, 13, 9, 1, 'd'); m.rect(5, 2, 5, 2, 'b'); },
                coin:    () => { m.disc(8, 8, 6, 'a'); m.ring(8, 8, 6, 1, 'd'); m.disc(8, 8, 2.5, 'b'); m.set(6, 5, 'w'); },
                tooth:   () => { m.poly([[4, 2], [12, 2], [11, 8], [8, 14], [5, 8]], 'p'); m.rect(4, 2, 8, 2, 'a'); m.line(9, 4, 8, 11, 's'); },
                axe:     () => { m.line(4, 14, 11, 3, 's'); m.poly([[9, 1], [15, 4], [13, 9], [9, 5]], 'a'); m.line(10, 2, 14, 5, 'b'); },
                skull:   () => { m.disc(8, 7, 5.5, 'p'); m.rect(5, 11, 6, 3, 'p'); m.disc(6, 7, 1.5, 'd'); m.disc(10, 7, 1.5, 'd'); m.set(8, 10, 'd'); m.rect(4, 3, 8, 1, 'a'); },
            };
            if (r.corrupt) {   // a siphoned relic: two shards fused by a green seam, with glitch rows that slide
                m.poly([[3, 2], [8, 1], [7, 8], [2, 12]], 'd'); m.poly([[8, 1], [14, 4], [13, 13], [7, 8]], 'a'); m.poly([[2, 12], [7, 8], [13, 13], [6, 15]], 'b');
                m.line(8, 1, 7, 8, 'g'); m.line(7, 8, 2, 12, 'g'); m.line(7, 8, 13, 13, 'g');
                const gy = [3, 7, 11][f % 3]; m.rect(f % 2 ? 0 : 5, gy, 7, 1, 'k'); m.rect(f % 2 ? 9 : 2, gy + 2, 5, 1, 'a');
            } else (D[id] || SH[r.shape] || D.glass_fang)();
            if (r.t >= 2) { m.set(1, 15, 'G'); m.set(14, 15, 'G'); }   // an Adept's gold pins
            if (r.t === 3 && f % 2 === 0) { m.set(0, 1, 'g'); m.set(15, 3, 'g'); m.set(1, 13, 'g'); }   // a Legend's glow
            if (f % 4 === 1) { m.set(13, 2, 'g'); m.set(12, 3, 'g'); m.set(14, 3, 'g'); m.set(13, 4, 'g'); }   // a glint, now and then ('g' gets no outline)
        }, 4);
    },
};
