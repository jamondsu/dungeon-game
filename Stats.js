// ═══════════════════════════════════════════════════════════════════════════
// Stats.js — the permanent stats you buy at Glurp's: damage, health, armor.
//
// One table (DEFS) and the maths on it, read by the shop (to sell levels) and by the scenes
// (to apply them when a level loads). Stats are capped (they are the floor of your power; uncapped weapon levels
// are the ceiling), and each level costs `first × growth^level`.
//
//   damage  +5% per level, compounding, to everything you deal. Applied at the damage choke
//           points (CombatSystem._dmgOutMult), never through damageScaling, which enemy
//           attacks also read.
//   health  +10 max HP per level on the base 100.
//   armor   +10 armor per level. Damage taken × K / (K + armor), K = 100: every point is
//           the same +1% effective HP, and it never reaches immunity (cap: hits do 29%).
//
// Levels persist in localStorage as stat_<id>. Nothing here touches Phaser.
// ═══════════════════════════════════════════════════════════════════════════

const PlayerStats = {
    DEFS: {
        damage: { name: 'Might',     first: 40, growth: 1.18, cap: 25, per: 0.05,
                  blurb: 'Everything you deal hits harder.' },
        health: { name: 'Vigor',     first: 30, growth: 1.15, cap: 25, per: 10, base: 100,
                  blurb: 'More health to lose before you go down.' },
        armor:  { name: 'Ironhide',  first: 35, growth: 1.16, cap: 25, per: 10, K: 100,
                  blurb: 'Every hit you take lands softer.' },
    },
    ORDER: ['damage', 'health', 'armor'],

    level(id) {
        try { return Math.max(0, Math.min(this.DEFS[id].cap, parseInt(localStorage.getItem('stat_' + id) || '0', 10) || 0)); }
        catch (e) { return 0; }
    },
    setLevel(id, n) { try { localStorage.setItem('stat_' + id, String(n)); } catch (e) {} },
    // Glorps for the next level, or null at the cap.
    cost(id, lvl = this.level(id)) {
        const d = this.DEFS[id];
        return lvl >= d.cap ? null : Math.round(d.first * Math.pow(d.growth, lvl));
    },

    damageMult(lvl = this.level('damage')) { return Math.pow(1 + this.DEFS.damage.per, lvl); },
    maxHealth(lvl = this.level('health')) { return this.DEFS.health.base + this.DEFS.health.per * lvl; },
    armor(lvl = this.level('armor')) { return this.DEFS.armor.per * lvl; },
    takenMult(lvl = this.level('armor')) { const K = this.DEFS.armor.K; return K / (K + this.armor(lvl)); },

    // ── TIERS ───────────────────────────────────────────────────────────────
    // Levels come in tiers of 5, and a stat can't start its next tier until the other two have
    // finished this one: levels 1-5 are free, 6 needs the others at 5, 11 needs them at 10, and
    // so on. So you train all three evenly rather than piling everything into one.
    // Returns null if level `lvl + 1` can be bought, or the level the others must reach.
    tierGate(id, lvl = this.level(id)) {
        if (lvl === 0 || lvl % 5 !== 0 || lvl >= this.DEFS[id].cap) return null;
        return this.ORDER.some(o => o !== id && this.level(o) < lvl) ? lvl : null;
    },
    tier() { return Math.floor(Math.min(...this.ORDER.map(id => this.level(id))) / 5); },

    // ── TALENTS ─────────────────────────────────────────────────────────────
    // Every 5th level of a stat grants a permanent talent: something that changes how you
    // play a little, rather than another percentage. Supplementary on purpose.
    TALENTS: {
        damage: [
            { at: 5,  id: 'opening',     name: 'Opening Strike', desc: 'Your first hit on each enemy deals +30%.' },
            { at: 10, id: 'executioner', name: 'Executioner',    desc: '+20% damage to enemies under 30% health.' },
            { at: 15, id: 'bloodrush',   name: 'Bloodrush',      desc: 'Each kill: +4% damage for 5s, stacking 5 times.' },
            { at: 20, id: 'overflow',    name: 'Overflow',       desc: "A kill's leftover damage spills, at half, onto the nearest enemy." },
            { at: 25, id: 'ruin',        name: 'Ruin',           desc: '1 hit in 10 is a crushing blow: double damage.' },
        ],
        health: [
            { at: 5,  id: 'secondwind',  name: 'Second Wind',    desc: 'Once per level, dropping under 30% heals 25% of your max.' },
            { at: 10, id: 'hearty',      name: 'Hearty',         desc: 'Health pickups heal 50% more.' },
            { at: 15, id: 'mending',     name: 'Mending',        desc: 'After 4s unhurt, regain 1.5% max HP a second.' },
            { at: 20, id: 'feast',       name: 'Feast',          desc: 'Every kill heals 1% of your max HP.' },
            { at: 25, id: 'undying',     name: 'Undying',        desc: 'Once per level, a killing blow leaves you at 1 HP, untouchable for 2s.' },
        ],
        armor: [
            { at: 5,  id: 'brace',       name: 'Brace',          desc: 'The first hit after 6s unhurt is halved.' },
            { at: 10, id: 'spiked',      name: 'Spiked Hide',    desc: 'Walking into an enemy hurts it instead of you.' },
            { at: 15, id: 'rollguard',   name: 'Rolling Guard',  desc: 'Dashing gives +60 armor for 1.5s.' },
            { at: 20, id: 'bedrock',     name: 'Bedrock',        desc: 'No single hit takes more than 20% of your max HP.' },
            { at: 25, id: 'aegis',       name: 'Aegis',          desc: 'Every 12s, a shield that absorbs one hit entirely.' },
        ],
    },
    owned() {
        const out = new Set();
        for (const id of this.ORDER) for (const t of this.TALENTS[id]) if (this.level(id) >= t.at) out.add(t.id);
        return out;
    },

    // What the talents do, as hooks the scenes call. `scene._tal` holds a run's talent state
    // (startRun); a scene without it (the shop) gets no effects.
    startRun(scene) {
        return (scene._tal = { has: this.owned(), rush: [], lastHurt: -1e9, secondWind: false, undying: false,
                               guardUntil: 0, aegisAt: 0, crushSaid: 0, spill: 0 });
    },
    has(scene, t) { return !!scene._tal?.has.has(t); },

    // × on every hit you deal (CombatSystem._dmgOutMult). `enemy` is null for boss hits.
    outMult(scene, enemy) {
        const T = scene._tal;
        if (!T) return 1;
        const now = scene.time.now;
        let m = 1;
        if (enemy && T.has.has('opening') && !enemy._talTouched) { enemy._talTouched = true; m *= 1.3; }
        if (enemy && T.has.has('executioner') && enemy.maxHealth > 0 && enemy.health / enemy.maxHealth < 0.3) m *= 1.2;
        if (T.has.has('bloodrush')) { T.rush = T.rush.filter(t => t > now); m *= 1 + 0.04 * T.rush.length; }
        if (T.has.has('ruin') && Math.random() < 0.1) {
            m *= 2;
            if (enemy?.sprite?.active && now - T.crushSaid > 180) { T.crushSaid = now; scene.showStatusText?.(enemy.sprite.x, enemy.sprite.y - 26, 'CRUSH!', '#f0b84a'); }
        }
        return m;
    },

    // A hit about to land on you (CombatSystem.takeDamage): returns what it should do instead
    // (0: absorbed). `armorNow` is the armor the hit already went through.
    hurt(scene, dmg) {
        const T = scene._tal;
        if (!T) return dmg;
        const now = scene.time.now, max = scene.maxHealth || 100;
        if (T.has.has('aegis') && now >= T.aegisAt) {
            T.aegisAt = now + 12000;
            scene.showStatusText?.(scene.player.x, scene.player.y - 28, 'AEGIS', '#6cb4f0');
            return 0;
        }
        if (T.has.has('rollguard') && now < T.guardUntil) {
            const K = this.DEFS.armor.K, a = this.armor();
            dmg *= (K + a) / (K + a + 60);
        }
        if (T.has.has('brace') && now - T.lastHurt > 6000) dmg *= 0.5;
        if (T.has.has('bedrock')) dmg = Math.min(dmg, max * 0.2);
        T.lastHurt = now;
        return dmg;
    },
    // After a hit has landed: the last-ditch talents.
    afterHurt(scene) {
        const T = scene._tal;
        if (!T) return;
        const max = scene.maxHealth || 100, now = scene.time.now;
        if (scene.health <= 0 && T.has.has('undying') && !T.undying) {
            T.undying = true;
            scene.health = 1;
            scene._dashInvulnUntil = Math.max(scene._dashInvulnUntil || 0, now + 2000);
            scene.showStatusText?.(scene.player.x, scene.player.y - 30, 'UNDYING', '#f0b84a');
            scene.cameras?.main?.flash?.(200, 240, 184, 74);
        }
        if (scene.health > 0 && scene.health < max * 0.3 && T.has.has('secondwind') && !T.secondWind) {
            T.secondWind = true;
            scene.health = Math.min(max, scene.health + max * 0.25);
            scene.showStatusText?.(scene.player.x, scene.player.y - 30, 'SECOND WIND', '#7fd06a');
        }
    },
    // An enemy died (CombatSystem.killEnemy).
    onKill(scene, enemy) {
        const T = scene._tal;
        if (!T) return;
        const now = scene.time.now, max = scene.maxHealth || 100;
        if (T.has.has('bloodrush')) { T.rush = T.rush.filter(t => t > now); if (T.rush.length >= 5) T.rush.shift(); T.rush.push(now + 5000); }
        if (T.has.has('feast') && scene.health > 0) scene.health = Math.min(max, scene.health + max * 0.01);
        // Overflow: half the overkill onto the nearest enemy within 3 tiles. Halved at every
        // step, and at most 3 deep, so a chain always ends.
        if (T.has.has('overflow') && enemy && enemy.health < 0 && T.spill < 3) {
            const left = -enemy.health * 0.5;
            let best = null, bd = 3.01;
            for (const e of scene.enemies || []) {
                if (e === enemy || !e.sprite?.active) continue;
                const d = Math.hypot(e.x - enemy.x, e.y - enemy.y);
                if (d < bd) { bd = d; best = e; }
            }
            if (best && left >= 1) { T.spill++; scene.damageEnemy?.(best, left, scene.currentElement); T.spill--; }
        }
    },
    // Every frame (GameScene.update): Mending.
    tick(scene, time, delta) {
        const T = scene._tal;
        if (!T || !T.has.has('mending') || scene._deathScreenActive) return;
        const max = scene.maxHealth || 100;
        if (time - T.lastHurt > 4000 && scene.health > 0 && scene.health < max) {
            scene.health = Math.min(max, scene.health + max * 0.015 * (delta / 1000));
        }
    },
    onDash(scene) { if (scene._tal) scene._tal.guardUntil = scene.time.now + 1500; },
    healMult(scene) { return this.has(scene, 'hearty') ? 1.5 : 1; },

    // What a stat reads as at a level, for the shop: "+28% damage", "150 HP", "40 armor · −29% damage taken".
    describe(id, lvl = this.level(id)) {
        if (id === 'damage') return lvl ? `+${Math.round((this.damageMult(lvl) - 1) * 100)}% damage` : 'no bonus';
        if (id === 'health') return `${this.maxHealth(lvl)} max HP`;
        return lvl ? `${this.armor(lvl)} armor · −${Math.round((1 - this.takenMult(lvl)) * 100)}% taken` : 'no armor';
    },
};

// ═══════════════════════════════════════════════════════════════════════════
// WeaponLevels — each weapon's own upgrades, bought at Glurp's (the weapon's tag).
//
//   Power   +PER damage per level with that weapon, no cap (the Tower is endless), each level
//           costing DMG_COST × DMG_GROWTH^level. Applied at the damage choke point
//           (CombatSystem._dmgOutMult), to the weapon equipped for the hit's element.
//   Perks   the things that weapon does, done more (PERKS[id], one to four each): swing
//           width, fireballs, pellets, range, wards... each capped, each level costing
//           first × growth^level. The weapon's own code reads WeaponLevels.perk(id, key).
// Stored as wlv_<id> (power) and wpk_<id>_<key> (perks).
// ═══════════════════════════════════════════════════════════════════════════
const WeaponLevels = {
    PER: 0.08, DMG_COST: 60, DMG_GROWTH: 1.15,
    // [key, name, cap, first cost, growth, what level p does]
    PERKS: {
        flame_fists:       [['speed', 'Quick Jabs', 3, 180, 1.8, p => `${8 * p}% faster punches`]],
        flame_sword:       [['arc', 'Wide Arc', 3, 180, 1.8, p => `+${p} tile${p === 1 ? '' : 's'} per swing`]],
        magma_staff:       [['volley', 'Fuller Volley', 3, 200, 1.8, p => `+${p} fireball${p === 1 ? '' : 's'} a cast`],
                            ['burn', 'Slow Burn', 1, 600, 1, () => 'heat stages last 40% longer']],
        ignition:          [['reach', 'Long Nozzle', 3, 180, 1.8, p => `+${(0.8 * p).toFixed(1)} tiles of flame`],
                            ['spray', 'Wide Spray', 3, 200, 1.8, p => `a ${15 * p}% wider fan`],
                            ['mix', 'Hot Mix', 3, 200, 1.8, p => `+${4 * p}% burn chance a tick`],
                            ['burst', 'Long Flame', 3, 180, 1.8, p => `Blue Flame lasts ${p}s longer`]],   // (key kept from Hair Trigger, the old burst chance, for saves)
        ice_fists:         [['speed', 'Quick Jabs', 3, 180, 1.8, p => `${8 * p}% faster punches`]],
        icicle_cannon:     [['pellets', 'Spread Shot', 3, 200, 3.5, p => p >= 3 ? 'DOUBLE BARREL: two volleys a shot' : `+${p} icicle${p === 1 ? '' : 's'} a shot`],
                            ['choke', 'Tight Choke', 3, 160, 1.7, p => `${20 * p}% tighter, +${1.5 * p} tiles`]],
        fractal_shard:     [['shards', 'Splinter', 2, 220, 2, p => `the spikes hit ${20 * p}% harder`],
                            ['fan', 'Burst Fan', 3, 200, 1.8, p => `+${2 * p} shards in the burst`],
                            ['speed', 'Rapid Facets', 3, 200, 1.8, p => `${8 * p}% faster, both strikes`]],
        lightning_fists:   [['speed', 'Quick Jabs', 3, 180, 1.8, p => `${8 * p}% faster punches`]],
        orb_emitter:       [['forks', 'Long Forks', 3, 200, 1.8, p => `+${0.5 * p} tiles fork range`]],
        ball_lightning:    [['life', 'Long Charge', 3, 200, 1.8, p => `orbs last ${20 * p}% longer`],
                            ['field', 'Wider Field', 3, 200, 1.8, p => `+${0.5 * p} tiles pulse range`],
                            ['swarm', 'Swarm', 3, 200, 1.8, p => `+${20 * p} seekers on burst`]],   // capped: each seeker is a live object
        conductor:         [['reach', 'Long Lines', 3, 220, 1.8, p => `wires reach ${p} tile${p > 1 ? 's' : ''} further`],
                            ['wires', 'Extra Line', 1, 400, 2, p => `${3 + p} wires at once`]],
        cosmic_fists:      [['momentum', 'Deep Momentum', 2, 300, 2, p => `${3 + p} Momentum at most`]],
        barrier_staff:     [['wards', 'More Wards', 6, 220, 1.6, p => `${4 + p} wards`],
                            ['cd', 'Quick Recast', 3, 200, 1.8, p => `${10 * p}% shorter cooldown`]],
        astrolabe:         [['stars', 'Meteor Shower', 3, 200, 1.8, p => `+${2 * p} stars fall`],
                            ['impact', 'Heavy Stars', 3, 200, 1.8, p => `+${0.5 * p} tiles, +${(0.3 * p).toFixed(1)}s daze`],
                            ['charts', 'Star Charts', 3, 220, 1.8, p => `+${25 * p}% charge from marks`],
                            ['gift', 'Star Gift', 1, 900, 1, () => 'a star: 50% of a cosmic gem']],
        singularity_staff: [['radius', 'Wider Well', 3, 200, 1.8, p => `+${0.5 * p} tiles well radius`],
                            ['time', 'Long Horizon', 3, 200, 1.8, p => `the well lasts +${p}s`],
                            ['guard', 'Event Shield', 3, 220, 1.8, p => `${30 + 5 * p}% less damage taken`]],
        void_blade:        [['charge', 'Quick Draw', 3, 200, 1.8, p => `charges ${15 * p}% faster`],
                            ['stun', 'Deep Stun', 3, 220, 1.8, p => `stun up to ${(3.5 + 2.5 * p / 3).toFixed(1)}s`],
                            ['fan', 'Fan Cut', 3, 240, 1.8, p => p >= 3 ? 'a full fan' : p ? 'fans out wider' : 'a thin line']],
    },
    // Cosmic weapons are buffs you cast: no Power levels.
    NO_POWER: ['cosmic_fists', 'barrier_staff', 'astrolabe', 'singularity_staff', 'void_blade'],
    _int(k) { try { return Math.max(0, parseInt(localStorage.getItem(k) || '0', 10) || 0); } catch (e) { return 0; } },
    _put(k, v) { try { localStorage.setItem(k, String(v)); } catch (e) {} },
    _def(id, key) { return (this.PERKS[id] || []).find(d => d[0] === key) || null; },
    level(id) { return this._int('wlv_' + id); },
    setLevel(id, n) { this._put('wlv_' + id, n); },
    perk(id, key) { const d = this._def(id, key); return d ? Math.min(d[2], this._int(`wpk_${id}_${key}`)) : 0; },
    setPerk(id, key, n) { this._put(`wpk_${id}_${key}`, n); },
    dmgMult(id) { return id && !this.NO_POWER.includes(id) ? 1 + this.PER * this.level(id) : 1; },
    cdMult(id, key = 'speed') { return 1 - 0.08 * this.perk(id, key); },   // the Quick Jabs family
    dmgCost(id) { return Math.round(this.DMG_COST * Math.pow(this.DMG_GROWTH, this.level(id))); },
    perkCost(id, key) { const d = this._def(id, key), p = this.perk(id, key); return !d || p >= d[2] ? null : Math.round(d[3] * Math.pow(d[4], p)); },
};
