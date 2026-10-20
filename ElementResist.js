// ═══════════════════════════════════════════════════════════════════════
// Extracted from index.html. This file is now the ONLY copy: index.html
// loads it with a <script src> tag. Editing the file used to do nothing,
// because a duplicate lived inline and that duplicate was what ran.
// ═══════════════════════════════════════════════════════════════════════

// ─────────────────────────────────────────────────────────────────────────────
// ElementResist — the single source of truth for "does this element hurt this enemy".
//
// WHY THIS EXISTS
// Elemental immunity was 86 inlined boolean checks spread across CombatSystem (18),
// WeaponSystem (49), ElementSystem (5) and LevelManager (14), written in EIGHT
// different combinations:
//     iceImmune                                    x27
//     fireImmune                                   x12
//     fireImmune || elementImmune                   x6
//     iceImmune || fireImmune || elementImmune      x4
//     elementImmune                                 x4
//     + three more one-off orderings
// Every one was a hard bail-out, so immunity could only ever mean 0x. Expressing
// anything else — Cosmic's reduced-but-nonzero chip, a future lightning elemental,
// a partial resistance — meant editing all 86 and keeping them in agreement, which
// the eight variants above show does not happen.
//
// This file replaces the question "is this enemy immune?" with "what multiplier
// applies?". Immunity becomes the 0.0 row of a table rather than a control-flow
// shortcut, and a new element or resistance is a data change in one place.
//
// BACKWARDS COMPATIBILITY
// The existing enemy flags (fireImmune / iceImmune / elementImmune / lightningImmune)
// remain the source of truth for WHICH profile an enemy has — nothing needs to be
// re-tagged, and the 86 legacy sites keep working unchanged while callers migrate.
// The TABLE below reproduces today's behaviour exactly for fire, ice and lightning:
// every cell that was a hard bail-out is 0.0. The only NEW behaviour is the cosmic
// row.
//
// COSMIC
// Cosmic damages everything and excels at nothing: 0.70x against normal enemies and
// 0.50x against element-resistant ones. Note the direction of that trade — every
// other element deals 0x to a resistant target, so cosmic's 0.50x is not a penalty
// against them, it is the entire point. The 0.70x baseline is what pays for it, and
// without that baseline cut cosmic would be strictly the best pick everywhere (never
// zero, never reduced) rather than the safe one.
//
// TUNING NOTE: cosmic weapon base damage was authored BEFORE this multiplier existed
// (cosmic_fists is 8 base, the lowest in the game, plus up to +75% dash momentum).
// Applying 0.70x on top lowers its effective output to ~5.6-9.8. If cosmic ends up
// feeling limp, raise the weapons' base damage rather than COSMIC_VS_NORMAL — the
// multiplier is the design statement, the base damage is the dial.
// ─────────────────────────────────────────────────────────────────────────────

const ElementResist = {

    // Cosmic's two constants, named so they are tunable in one place.
    COSMIC_VS_NORMAL:    0.70,
    COSMIC_VS_RESISTANT: 0.50,

    // How hard a partial resistance bites. 0.40 roughly doubles time-to-kill with the
    // wrong element: a reason to switch, not a reason to give up.
    PARTIAL: 0.40,

    // ── PROFILES ─────────────────────────────────────────────────────────────
    // Multiplier per attacking element. 0 means refused (the old immunity).
    // 'physical' covers damage with no element — fireball splash, melee, collision.
    //
    // fireElemental and iceElemental both read as near-total walls because that is
    // what the old code did: the central gate in damageEnemy bailed on BOTH flags
    // regardless of which element was attacking, so lightning was already dealing 0
    // to both. Those zeroes are preserved deliberately — this refactor is not a
    // balance change for the existing three elements.
    //
    // Each profile also records its ESCAPE HATCH: the indirect route that always
    // worked and bypasses this table entirely because it never called damageEnemy.
    TABLE: {
        none: {
            label: null,
            mult: { fire: 1, ice: 1, lightning: 1, cosmic: 0.70, physical: 1 }
        },
        fireElemental: {
            label: 'IMMUNE', color: '#ff8844',
            // Escape hatch: lava tiles and burn DoT (environmental, not direct).
            mult: { fire: 0, ice: 0, lightning: 0, cosmic: 0.50, physical: 0 }
        },
        iceElemental: {
            label: 'IMMUNE', color: '#88eeff',
            // Escape hatch: shatter via damageEnemyIce while frozen. Also chillImmune
            // stacking — 3 stacks freeze it (see CombatSystem's chill helper).
            mult: { fire: 0, ice: 0, lightning: 0, cosmic: 0.50, physical: 0 }
        },
        // Not yet used by any spawner. CombatSystem carried a bare
        // `lightningImmune (future)` comment for this and nothing else, so lightning
        // is currently the one element with no resistant enemy at all — which also
        // means cosmic's safety valve has nothing to protect against there. Tag an
        // enemy with lightningImmune and it works immediately.
        lightningElemental: {
            label: 'IMMUNE', color: '#ffff44',
            mult: { fire: 1, ice: 1, lightning: 0, cosmic: 0.50, physical: 1 }
        },
        // ── PARTIAL RESISTANCE ───────────────────────────────────────────────
        // A TRAIT, not a species. Any enemy can carry one via `resistTrait`, so a Tidal
        // Guard may be fire-resistant, ice-resistant or neither, and the same roster
        // reads differently from room to room. This is what the 0.0-vs-1.0 boolean
        // could never express, and the reason the multiplier table exists.
        //
        // 0.40 is chosen to be felt without being a wall: the wrong element roughly
        // doubles your time-to-kill, which is a reason to switch rather than a reason
        // to give up. Cosmic stays at its normal 0.70 here -- its 0.50 bonus row exists
        // to answer enemies NOTHING else can hurt, and a partially-resistant enemy is
        // still perfectly killable with any of the other three.
        fireResistant: {
            label: 'RESIST', color: '#ff8844',
            mult: { fire: 0.40, ice: 1, lightning: 1, cosmic: 0.70, physical: 1 }
        },
        iceResistant: {
            label: 'RESIST', color: '#88eeff',
            mult: { fire: 1, ice: 0.40, lightning: 1, cosmic: 0.70, physical: 1 }
        },
        lightningResistant: {
            label: 'RESIST', color: '#ffff44',
            mult: { fire: 1, ice: 1, lightning: 0.40, cosmic: 0.70, physical: 1 }
        },

        // Generic "immune to elements" tag used by a few scripted enemies.
        elemental: {
            label: 'IMMUNE', color: '#8888ff',
            mult: { fire: 0, ice: 0, lightning: 0, cosmic: 0.50, physical: 0 }
        }
    },

    // ── THE CONSTANTS ABOVE WERE DECORATIVE ──────────────────────────────────
    // A sibling key cannot reference another key inside the same object literal, so
    // every row above had to spell 0.40 and 0.50/0.70 out as literals while PARTIAL
    // and COSMIC_VS_* sat beside them looking like the source of truth. They were
    // not: assigning ElementResist.PARTIAL = 0.55 changed the resistance of exactly
    // nothing, because only multiProfile() ever read it. A balance sweep through the
    // named constant silently measured the old value -- the same failure mode as the
    // dead ElementResist.js file, one scope smaller.
    //
    // bindConstants() closes the gap by writing the constants back over the literals
    // once at load. At today's values it is a no-op, which is the point: it can be
    // verified to change nothing now and it makes the names authoritative from here on.
    bindConstants() {
        for (const el of ['fire', 'ice', 'lightning']) {
            this.TABLE[el + 'Resistant'].mult[el] = this.PARTIAL;
        }
        for (const row of Object.values(this.TABLE)) {
            // A row is a full wall if it refuses the element it is named for; those get
            // cosmic's answer-to-the-unanswerable rate, everything else the normal one.
            const wall = row.mult.fire === 0 || row.mult.ice === 0 || row.mult.lightning === 0;
            row.mult.cosmic = wall ? this.COSMIC_VS_RESISTANT : this.COSMIC_VS_NORMAL;
        }
        return this;
    },

    // ── PROFILE RESOLUTION ───────────────────────────────────────────────────
    // Order matters and encodes the old precedence: the legacy gate tested
    // `fireImmune || iceImmune` with fire first, and the scattered sites that also
    // tested elementImmune always listed it last. Keeping that order means an enemy
    // carrying more than one flag resolves the way it always did.
    profileOf(enemy) {
        if (!enemy) return this.TABLE.none;
        if (enemy.fireImmune)      return this.TABLE.fireElemental;
        if (enemy.iceImmune)       return this.TABLE.iceElemental;
        if (enemy.lightningImmune) return this.TABLE.lightningElemental;
        if (enemy.elementImmune)   return this.TABLE.elemental;
        // Grounding Spike suppression sits HERE -- after immunities, before traits -- because
        // the gadget strips partial RESISTANCE, not immunity. A fire elemental does not
        // become burnable because you threw a spike at it; what lifts is the resistTrait
        // multiplier, which is the thing that compounds with floor HP scaling into a 4.2x
        // slog by floor 5.
        if (enemy._resistSuppressed) return this.TABLE.none;

        // Traits come after immunities: a full immunity always wins over a resistance,
        // so an enemy carrying both resolves the way it did before traits existed.
        // resistTrait may be a single string or an array. Multi-resistant enemies are
        // meant to be rare, so rather than hand-authoring every combination the profile
        // is synthesised and cached on first use.
        const t = enemy.resistTrait;
        if (Array.isArray(t)) {
            const traits = t.filter(x => x === 'fire' || x === 'ice' || x === 'lightning');
            if (traits.length > 1) return this.multiProfile(traits);
            if (traits.length === 1) return this.profileOf({ resistTrait: traits[0] });
            return this.TABLE.none;
        }
        if (t === 'fire')      return this.TABLE.fireResistant;
        if (t === 'ice')       return this.TABLE.iceResistant;
        if (t === 'lightning') return this.TABLE.lightningResistant;
        return this.TABLE.none;
    },

    // True when the enemy resists ANY element — i.e. it is one of the wall profiles.
    // Cosmic's 0.50x row is what this predicate exists to select.
    // A profile resisting several elements at once, built on demand. Note it stays on
    // cosmic's NORMAL row: even an enemy resisting two elements has a third that works
    // on it at full, so it is not the wall that cosmic's bonus exists to answer.
    multiProfile(traits) {
        const key = traits.slice().sort().join('+');
        if (!this._multi) this._multi = {};
        if (this._multi[key]) return this._multi[key];
        const mult = { fire: 1, ice: 1, lightning: 1,
                       cosmic: this.COSMIC_VS_NORMAL, physical: 1 };
        for (const t of traits) mult[t] = this.PARTIAL;
        this._multi[key] = { label: 'RESIST', color: '#b388ff', mult, traits: traits.slice() };
        return this._multi[key];
    },

    // Which elements a given enemy actually resists, for badges and UI.
    traitsOf(enemy) {
        const p = this.profileOf(enemy);
        if (p.traits) return p.traits.slice();
        return ['fire', 'ice', 'lightning'].filter(e => p.mult[e] < 1);
    },

    // True only for the WALL profiles -- the ones some element cannot hurt at all.
    // Partial traits deliberately do not count: cosmic's edge is answering enemies
    // nothing else can touch, and a fire-resistant enemy still dies fine to ice.
    isResistant(enemy) {
        const p = this.profileOf(enemy);
        return p !== this.TABLE.none
            && p !== this.TABLE.fireResistant
            && p !== this.TABLE.iceResistant
            && p !== this.TABLE.lightningResistant
            && !p.traits;                       // synthesised multi profiles are partial too
    },

    // ── MULTIPLIER ───────────────────────────────────────────────────────────
    // `element` is one of fire / ice / lightning / cosmic / physical. Anything
    // unrecognised (null, undefined, 'void', a typo) is treated as physical, which
    // matches the old behaviour: untagged damage went through the same gate.
    multiplier(enemy, element) {
        const prof = this.profileOf(enemy);
        const key = Object.prototype.hasOwnProperty.call(prof.mult, element) ? element : 'physical';
        return prof.mult[key];
    },

    // ── RESOLVE ──────────────────────────────────────────────────────────────
    // The call damage code should make. Returns everything needed to either apply
    // the hit or show the refusal, so callers never re-derive any of it:
    //   { dmg, mult, refused, label, color, profile }
    // `refused` is true only at exactly 0 — a reduced hit is NOT a refusal, which is
    // the whole distinction the old boolean gate could not express.
    resolve(enemy, element, raw) {
        const prof = this.profileOf(enemy);
        const mult = this.multiplier(enemy, element);
        const dmg = (raw || 0) * mult;
        return {
            dmg,
            mult,
            refused: mult === 0,
            label: mult === 0 ? (prof.label || 'IMMUNE') : null,
            color: prof.color || '#ffffff',
            profile: prof
        };
    },

    // Human-readable matrix, for a dev panel or a sanity check in the console.
    describe() {
        const els = ['fire', 'ice', 'lightning', 'cosmic', 'physical'];
        const rows = [['profile'].concat(els).join('\t')];
        for (const [name, prof] of Object.entries(this.TABLE)) {
            rows.push([name].concat(els.map(e => prof.mult[e].toFixed(2))).join('\t'));
        }
        return rows.join('\n');
    }
};

// Bind before anything can resolve a profile.
ElementResist.bindConstants();