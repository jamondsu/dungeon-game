// ═══════════════════════════════════════════════════════════════════════════
// Cosmic.js — cosmic is the buff element.
//
// A mixin like Visuals.js (GameScene borrows each method through a one-line proxy). A cosmic
// weapon does little damage itself: casting it gives you a BOON that keeps working after you
// switch back to fire, ice or lightning. The loop is: switch to cosmic, cast, switch away.
//
//   Void Fists     a punch; every punch or dash that lands is a stack of Momentum (max 4):
//                  +7% damage (every element) and +8% move speed each, for 8s after the last
//   Barrier Staff  5 wards orbit you for 10s, each eats one enemy projectile and knocks
//                  the enemies close to you 2 tiles back; a recast tops them up       (9s)
//   Astrolabe      Starfall, in a room with enemies in it: shooting stars crash around the
//                  room (more in a bigger one), dazing what they land on. Collect the fallen
//                  stars before they fade: each one astrally marks 2 enemies in that room
//                  (nearest first, bosses too; 10 at most). A mark lasts until you hit it:
//                  the hit pops it for 6% of your current element's gem and 2% of the
//                  others                                                             (40s)
//   Singularity    a well at the cursor pulls enemies in for 5s, Hexing them deeper the longer they stay
//                  Event Horizon: -30% damage taken while it's out and 5s after (12s)
//   Void Blade     hold to charge, release to slash: longer, wider and a longer stun the
//                  longer you held (3-7 tiles, 1-3 wide, 0.6-1.8s). Retribution, 10s: when
//                  you're hit, everything within 3 tiles is Hexed for 5s (up to +45%
//                  taken, -40% speed, a mark)                                        (12s)
//   Pendulum       no attack: a click flings it onto the cursor (6 tiles at most) and it lays a
//                  TIME LOCK (a 7x7 with its corners cut, 4s): time stops in it for all but you;
//                  hits on what's in it are stored and land at once when it ends; shots stop at its
//                  edge. R: REWIND, back along your path to 3s ago, the HP and the ailments since
//                  undone. One cooldown: 12s after the lock, 30s after Rewind
//   Ascend (ult)   10s: +25% max HP, free switching, fluid blasts, trail and waves, your boon at full
//                  strength, then a supernova that cashes every mark in reach in as damage
//   Stage 2        two layers; tap V for Ascend (-20% damage taken), hold V to transform:
//                  rift drop (its slam a Big Crunch: what's Hexed near is pulled in and its
//                  Hex cashed in as damage), Twin Collapse, two voidlets (the STAGE 2 section)
//   Stage 3        the full transformation: untouchable while turning, regenerating, a
//                  dazing Big Crunch, the constellation (eight-object collapses through walls
//                  that drag, each landing cashing in the Hex on what it lands on), voidlets (TF3)
//
// The cosmic gem fills from every hit you land, whatever element dealt it: each hit's ult
// charge (CombatSystem.gainUltCharge) also goes to cosmic at CHARGE_SHARE, overflowing into
// the next layer from stage 2. (It filled with time until 2026-10-18; waiting in an empty
// room for a full gem was an exploit.) The game calls in through guarded hooks:
//   _csDmgMult      every damage path (damageEnemy, resolveElementalHit, the boss/portal ones)
//   _csOnHit        every hit that lands (Ascend marks it)
//   _csAstralPop    _noteUltHit: a hit on an astral mark pops it (Astrolabe)
//   _csMoveMult     the player's step (Momentum)
//   _csSwitchMult   the element switch (Ascend)
//   _csWardCatch    a projectile about to reach you (Barrier)
//   _csOnHurt       you took damage (Retribution)
//   _csOnDash       a cosmic dash went off (Momentum)
//   _csCast         the five weapons; _csAscend the ult
// ═══════════════════════════════════════════════════════════════════════════
class CosmicSystem {

    // ── NUMBERS ──────────────────────────────────────────────────────────────
    _csCfg() {
        if (this._csCfgCache) return this._csCfgCache;
        return (this._csCfgCache = {
            CHARGE_SHARE: 1.25,          // × each hit's ult charge, to the cosmic gem (any element)
            MARK_MS: 8000,               // a cosmic mark lasts this long after the last one landed
            FISTS:   { CD: 450, DMG: 6, MAX: 3 + WeaponLevels.perk('cosmic_fists', 'momentum'), DMG_PER: 0.07, SPEED_PER: 0.08, MS: 8000 },
            // 5 wards on 9s (was 3 on 12s): this game throws a lot of projectiles. Wards last
            // longer than the cooldown, so a recast before they run out keeps you covered.
            // Each shot eaten shoves the enemies within SHOVE_R tiles SHOVE tiles away.
            BARRIER: { CD: 9000 * (1 - 0.1 * WeaponLevels.perk('barrier_staff', 'cd')), MS: 10000, WARDS: 4 + WeaponLevels.perk('barrier_staff', 'wards'), ORBIT: 19, SPIN: 2.6, CATCH: 40, SHOVE_R: 2.5, SHOVE: 2 },
            // Starfall. Stars: about one per PER_TILES floor tiles of the room you're in,
            // MIN..MAX. They fall over FALL_MS (staggered by STAGGER), daze within DAZE_R tiles
            // for DAZE_MS (no damage), then lie for WINDOW to be picked up within PICK_R tiles.
            // Each one collected marks MARKS_PER enemies in the room, MAX_MARKS at most. A mark
            // stays until a hit pops it: POP_CUR of a gem to the element you hold, POP_OTHER to
            // each other one, none to cosmic's (the stars are its share). Ascend doubles the pops.
            // A long cooldown and a big payout (2026-10-22; CD 14s and half the charge before: at 14s
            // it was a charger without a limit, about 0.8 of an Ascend from the stars alone every cast).
            ASTRO:   { CD: 40000, MIN: 4 + WeaponLevels.perk('astrolabe', 'stars'), MAX: 10 + 2 * WeaponLevels.perk('astrolabe', 'stars'), PER_TILES: 40, FALL_MS: 420, STAGGER: 110, DAZE_R: 1.5 + 0.5 * WeaponLevels.perk('astrolabe', 'impact'), DAZE_MS: 700 + 300 * WeaponLevels.perk('astrolabe', 'impact'),
                       WINDOW: 5000, PICK_R: 1.0, MARKS_PER: 2, MAX_MARKS: 10, POP_CUR: 0.06 * (1 + 0.25 * WeaponLevels.perk('astrolabe', 'charts')), POP_OTHER: 0.02 * (1 + 0.25 * WeaponLevels.perk('astrolabe', 'charts')),
                       STAR_CHARGE: WeaponLevels.perk('astrolabe', 'gift') ? 0.5 : 0.16 },   // each star collected: 16% of a cosmic gem
            WELL:    { CD: 12000, MS: 5000 + 1000 * WeaponLevels.perk('singularity_staff', 'time'), AFTER: 5000, TICK: 500, DMG: 2, RADIUS: 3 + 0.5 * WeaponLevels.perk('singularity_staff', 'radius'), RANGE: 9, TAKEN: 0.7 - 0.05 * WeaponLevels.perk('singularity_staff', 'guard'),
                       HEX_RAMP: 2000, HEX_AFTER: 1000,
                       BEAM_SPEED: 24, BEAM_HEX_MS: 1000, GROW_FROM: 0.6, GROW_TO: 1.4, END_DAZE_MS: 1000 },   // the beam (tiles a second, its Hex); the well's reach grows; the daze when it closes   // in the well: a Hex stack per HEX_RAMP ms inside (3 at most), gone HEX_AFTER after leaving
            // Charged: f = held / CHARGE_MS (0..1) sets the length, width, stun and damage.
            // Charged by holding (HOLD_MAX for everything): TILES → TILES_MAX long, W0 → W1 tiles
            // either side of its line, DMG → DMG_MAX, and a stun of STUN → STUN_MAX on a
            // STUN_CURVE power curve. Charging slows your step by up to SLOW× and zooms the camera
            // by up to ZOOM. Its fluid wells up CASCADE_MS per tile out from you and lasts
            // FLUID_MS → FLUID_MAX (the same curve); standing in it Hexes every FLUID_TICK. A Hex is stacks (HEX_STACKS: the
            // damage taken at 1, 2, 3), HEX_MS from the last one, slowing (HEX_SLOW); MS and
            // HEX_R are Retribution's (Ascend holding the blade).
            BLADE:   { CD: 12000, MS: 10000, HOLD_MAX: 3500 * (1 - 0.15 * WeaponLevels.perk('void_blade', 'charge')), TILES: 3, TILES_MAX: 18, W0: 0.35, W1: 0.6, DMG: 10, DMG_MAX: 18,
                       FAN: 0.13 * WeaponLevels.perk('void_blade', 'fan'),   // Fan Cut: half-width added per tile out
                       STUN: 600, STUN_MAX: 3500 + 2500 * WeaponLevels.perk('void_blade', 'stun') / 3, STUN_CURVE: 1.8, SLOW: 2.6, ZOOM: 0.14, CASCADE_MS: 30, FLUID_MS: 2500, FLUID_MAX: 6500, FLUID_TICK: 2000,
                       HEX_R: 3, HEX_MS: 5000, HEX_STACKS: [1.10, 1.25, 1.45], HEX_SLOW: 0.6,
                       // the blade's own Hex (from its fluid) outlasts every other source, longer the longer the charge
                       HEX_BLADE_MS: 6000, HEX_BLADE_MAX: 14000 },
            ASCEND:  { MS: 10000, HP: 0.25, NOVA_R: 4, NOVA_BASE: 12, NOVA_PER_MARK: 8, TAKEN_S2: 0.8,
                       BLAST_R: 7, FLUID_MS: 2000, HEX_MS: 6000, CASCADE: 75, SPEED: 1.35, WAVE_EVERY: 3000, WAVE_W: 7, WAVE_LEN: 24, WAVE_STEP: 80 },   // the fluid blasts (start and end), its trail, its waves (tiles, ms)
            // Stage 2 (the STAGE 2 section). Ranges in tiles, times in ms. Collapse damage is
            // COLLAPSE_BASE + COLLAPSE_PER × closing speed (tiles/s), before damageScaling:
            // about 8 for a 2-tile throw, 13 for 6, 16 for the full 10. Objects accelerate at
            // COLLAPSE_ACC tiles/s², so the full throw lands in about 0.6s.
            // The charge bar (V held with 2+ layers): ms to halfway, to 80%, and the last stretch.
            CHARGE:  { HALF_MS: 700, MID_MS: 500, END_MS: 1700 },
            TF:      { LAUNCH_MS: 250, PICK_MS: 5000, TURN_MS: 1000, AIM_MS: 3000, AIM_RANGE: 14, DROP_MS: 1000,
                       SLAM_R: 2.5, SLAM_DMG: 20, SLAM_SLOW: 1.5, SLAM_SLOW_MS: 2000,
                       // the Big Crunch: the slam pulls what's Hexed within CRUNCH_R tiles CRUNCH_PULL tiles in, then cashes
                       // every Hex stack on it in: CASH + CASH_PCT of its max HP a stack (CASH_BOSS for a boss), the stacks gone
                       CRUNCH_R: 6, CRUNCH_PULL: 3, CASH: 12, CASH_PCT: 0.06, CASH_BOSS: 0.015,
                       FORM_MS: 9000, FORM_MAX_MS: 16000, EXTEND_1: 500, EXTEND_3: 1000,
                       // every throw is four objects (your pair and its mirror at ROT°), landing MULT ×
                       // a pair's hit in COLLAPSE_R tiles, and pulling what's within PULL_R in PULL tiles first
                       COLLAPSE_CD: 600, COLLAPSE_CD_FULL: 950, COLLAPSE_ACC: 30, COLLAPSE_R: 2.2, MULT: 1.5, ROT: [90], PULL_R: 3.5, PULL: 2,
                       COLLAPSE_BASE: 3, COLLAPSE_PER: 0.5, PIERCE_DMG: 3, PIERCE_SHARE: 0.75,
                       VOIDLET_HP: 40, VOIDLET_TAUNT: 3,   // voidlets stay till they fall
                       // the domain: the room, sealed off and dark; the partial form's Hex tides (WAVE_W tiles wide, a tile every
                       // WAVE_STEP ms, one every WAVE_EVERY, their fluid's Hex for WAVE_HEX), the full form's floor all fluid
                       HP: 0.35, HP_FULL: 0.5, DOMAIN_FADE: 600, WAVE_EVERY: 2600, WAVE_STEP: 110, WAVE_W: [1, 2], WAVE_HEX: 4000, FLOOD_HEX: 6000,
                       WARRIOR_SEEK: 7, WARRIOR_STEP_MS: 260, WARRIOR_HIT_MS: 600, WARRIOR_DMG: 7,
                       // the voidbeam: locks on for BEAM_LOCK_MS, then fires a wide beam through its
                       // target that pierces everything and ricochets off walls BEAM_BOUNCES times,
                       // BEAM_LEN tiles in all
                       BEAM_RANGE: 6, BEAM_MS: 1800, BEAM_DMG: 9, BEAM_LOCK_MS: 450, BEAM_LEN: 16, BEAM_BOUNCES: 2, BEAM_W: 0.6 },
            // Stage 3, the full transformation: these replace stage 2's numbers. Untouchable
            // from the hold to the slam; the slam is wider, harder and dazes; cosmic
            // regeneration (REGEN of max HP every REGEN_MS, 1.6%/s) the whole time. Each throw
            // is eight objects, a star of four pairs crashing into the centre (MULT × a pair's
            // hit, in a wider COLLAPSE_R; each pierces at PIERCE_SHARE). They
            // pass through walls and drag what they pierce along; where they land they cash in the
            // Hex on what's there (as the Big Crunch does), or Hex it if it had none. A longer form than the partial
            // one's, so spending the third layer is always worth it.
            TF3:     { SLAM_R: 3, SLAM_DMG: 30, DAZE_MS: 1500, CRUNCH_R: 8, FORM_MS: 11000, FORM_MAX_MS: 18000,
                       REGEN: 0.0008, REGEN_MS: 50,
                       // eight objects: the pair and three more pairs turned 45°, 90° and 135°
                       COLLAPSE_R: 2.6, MULT: 2.4, ROT: [45, 90, 135], PIERCE_SHARE: 0.6,
                       DRAG_STEP_MS: 60, VOIDLET_HP: 70, VOIDLETS: ['warrior', 'beam', 'warrior', 'beam', 'warrior'] },
            // The Pendulum, a support tool with no attack. A click lays its field, Time Lock, at the cursor, RANGE tiles at
            // most: MASK round it (a 7x7 with its corners cut: rows of 3, 5, 7, 7, 7, 5, 3).
            // Rewind (R): BACK_MS back along your path in PULL_MS; under MIN_MS of past, nothing to rewind. The two share one
            // cooldown: Stasis sets it to STASIS_CD, Rewind to REWIND_CD (it was the stronger one alone).
            // TLOCK: the field's Time Lock: MS long (4s, +0.5s a level of Long Lock); what's stored lands x REL_MUL; a boss's time runs BOSS_SLOW slower in it.
            // THROW (ms): the wind-up; the fling and the bounces, each [how far along the way it lands, ms, its height]; the float; the
            // growth; the drop. About 1.45s from the click to the thud.
            // HANG_UP: how far above the field's middle the big one's bob hangs (px); FADE: its alpha while anything's under it
            PEND:    { RANGE: 6, HANG_UP: 48, FADE: 0.55, THROW: { WIND: 180, HOPS: [[0.55, 340, 1], [0.82, 180, 0.45], [0.95, 130, 0.2], [1, 90, 0.08]], FLOAT: 160, GROW: 260, DROP: 110 },
                       MASK: ['..###..', '.#####.', '#######', '#######', '#######', '.#####.', '..###..'],
                       TLOCK: { MS: 4000 + 500 * WeaponLevels.perk('pendulum', 'hold'), REL_MUL: 1, BOSS_SLOW: 0.8 },
                       STASIS_CD: 12000 * (1 - 0.1 * WeaponLevels.perk('pendulum', 'cd')),
                       BACK_MS: 3000, REWIND_CD: 30000 * (1 - 0.1 * WeaponLevels.perk('pendulum', 'echo')), PULL_MS: 420, MIN_MS: 400 },
            COL:     { violet: 0xb47cff, lilac: 0xe2c8ff, deep: 0x5a24a8, gold: 0xffd060, hex: 0xff5fd2 },
            NAMES:   { cosmic_fists: 'VOID FISTS', barrier_staff: 'BARRIER', astrolabe: 'ASTROLABE',
                       singularity_staff: 'SINGULARITY', void_blade: 'VOID BLADE', pendulum: 'PENDULUM' },
        });
    }

    // ── ART ──────────────────────────────────────────────────────────────────
    // Rows of characters, one per pixel ('.' clear, k the house outline). The disk, rings and
    // the slash are painted procedurally into the same sheet (CosmicSystem.sheets).
    static art() {
        if (CosmicSystem._art) return CosmicSystem._art;
        const P = { L: '#f3e8ff', V: '#c99bff', v: '#9a5cff', p: '#5a24a8', D: '#2a1450', W: '#ffffff',
                    Y: '#ffd060', y: '#b8842a', h: '#ff5fd2', H: '#ffc8f0' };
        return (CosmicSystem._art = { P, bits: {
            ward: [
                "...kkk...", "..kLVvk..", ".kLWVvvk.", "kLWVvvvpk", "kVVvvvppk", "kvvvvpppk", ".kvvpppk.",
                "..kpppk..", "...kkk..."],
            star: [
                "....k....", "...kYk...", "...kYk...", ".kkYWYkk.", "kYYWWWYYk", ".kkYWYkk.", "...kYk...",
                "...kYk...", "....k...."],
            hex: [
                "..kkkkk..", ".khhhhhk.", "khHkkkHhk", "khHkWkHhk", "khHkkkHhk", ".khhhhhk.", "..kkkkk.."],
            mote: [".V.", "VWV", ".V."],
            i_cosmic_fists: [
                "............", "..kkkkkkk...", ".kVLkVLkVLk.", ".kVvkVvkVvk.", ".kvvkvvkvvk.", "kVkvvvvvvvk.",
                "kVvkvvvvvvk.", "kvvvvvvvvpk.", ".kvvvvvvppk.", "..kvvvvppk..", "...kkkkkk...", "............"],
            i_barrier_staff: [
                ".....kk.....", "....kLVk....", "....kVpk....", ".....kk.....", "..k......k..", ".k........k.",
                ".kk......kk.", "kLVk....kLVk", "kVpk....kVpk", ".kk..kk..kk.", "....k..k....", "............"],
            i_astrolabe: [
                "....kkkk....", "..kkyYYykk..", ".kYk....kYk.", ".ky..kk..yk.", "kY..kYYk..Yk", "kY.kYWWYk.Yk",
                "kY.kYWWYk.Yk", "kY..kYYk..Yk", ".ky..kk..yk.", ".kYk....kYk.", "..kkyYYykk..", "....kkkk...."],
            i_singularity_staff: [
                "...kkkkkk...", "..kvVVVVvk..", ".kvVpppppVk.", "kvVpkkkkpVvk", "kVpkkDDkkpVk", "kVpkDkkDkpVk",
                "kVpkDkkDkpVk", "kVpkkDDkkpVk", "kvVpkkkkpVvk", ".kvVpppppVk.", "..kvVVVVvk..", "...kkkkkk..."],
            i_void_blade: [
                "..........kk", ".........kLk", "........kLVk", ".......kLVk.", "......kLVk..", ".....kLVk...",
                "....kLVk....", "...kVvk.....", "k.kVvk......", "kkkvk.......", ".kyyk.......", "kyk.k......."],
            i_ascend: [
                "............", ".k...kk...k.", "kYk.kYYk.kYk", "kYYkYWWYkYYk", "kYYYYWWYYYYk", "kYYYYYYYYYYk",
                "kyYYYYYYYYyk", "kyyyyyyyyyyk", ".kkkkkkkkkk.", "............", "............", "............"],
            halo: [
                "...kkkkkk...", ".kkYYYYYYkk.", "kYYy....yYYk", ".kkYYYYYYkk.", "...kkkkkk..."],
        } });
    }

    static pix(ctx, x0, y0, rows, pal) {
        const BASE = { k: '#1c1728', K: '#0b0812' };
        rows.forEach((row, j) => {
            for (let i = 0; i < row.length; i++) {
                const ch = row[i];
                if (ch === '.' || ch === ' ') continue;
                ctx.fillStyle = (pal && pal[ch]) || BASE[ch] || '#ff00ff';
                ctx.fillRect(x0 + i, y0 + j, 1, 1);
            }
        });
    }

    // An accretion disk from above: a black core, a bright photon ring, three arms winding out,
    // quantised to a few shades so it stays pixel art.
    static paintWell(ctx, X, Y, S) {
        const c = (S - 1) / 2;
        const pal = [[38, 16, 74], [72, 30, 142], [122, 60, 214], [176, 122, 255], [226, 198, 255], [255, 244, 255]];
        for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
            const dx = x - c, dy = y - c, r = Math.hypot(dx, dy), a = Math.atan2(dy, dx);
            if (r > c) continue;
            let col, al = 1;
            if (r < S * 0.12) col = [5, 2, 12];
            else if (r < S * 0.16) col = [255, 232, 168];
            else {
                const t = (r - S * 0.16) / (c - S * 0.16);
                const arm = 0.5 + 0.5 * Math.cos(a * 3 - t * 7.5);
                const v = (1 - t * 0.85) * (0.35 + 0.65 * arm);
                const k = Math.max(0, Math.min(5, Math.floor(v * 5.4)));
                if (k === 0 && arm < 0.45) continue;
                col = pal[k];
                if (t > 0.8) al = (1 - t) / 0.2;
            }
            ctx.fillStyle = `rgba(${col[0]},${col[1]},${col[2]},${al.toFixed(2)})`;
            ctx.fillRect(X + x, Y + y, 1, 1);
        }
    }

    // A thin ring with gaps (gaps = 0 for a whole one).
    static paintRing(ctx, X, Y, S, rgb, gaps) {
        const c = (S - 1) / 2, R = c - 1.5;
        for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
            const dx = x - c, dy = y - c, d = Math.abs(Math.hypot(dx, dy) - R);
            if (d > 1.6) continue;
            if (gaps) { const f = ((Math.atan2(dy, dx) + Math.PI) / (Math.PI * 2) * gaps) % 1; if (f < 0.16) continue; }
            ctx.fillStyle = `rgba(${rgb},${d < 0.7 ? 1 : 0.4})`;
            ctx.fillRect(X + x, Y + y, 1, 1);
        }
    }

    // A ring of thorns pointing out.
    static paintThorns(ctx, X, Y, S) {
        const c = (S - 1) / 2, R = c * 0.62, N = 12;
        for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
            const dx = x - c, dy = y - c, r = Math.hypot(dx, dy), a = Math.atan2(dy, dx);
            const k = ((a + Math.PI) / (Math.PI * 2) * N) % 1, spike = 1 - Math.abs(k - 0.5) * 2;   // 1 at a tip
            const outer = R + 1 + spike * spike * (c - R - 1.5);
            if (r < R - 1 || r > outer) continue;
            const edge = r > outer - 1 || r < R;
            ctx.fillStyle = edge ? 'rgba(255,200,240,1)' : `rgba(255,95,210,${(0.55 + 0.45 * spike).toFixed(2)})`;
            ctx.fillRect(X + x, Y + y, 1, 1);
        }
    }

    // A crescent slash, pointing right: white on its cutting edge, violet behind.
    static paintSlash(ctx, X, Y, W, H) {
        const cx = W * 0.18, cy = H / 2, R1 = W * 0.82, R2 = W * 0.7;
        for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
            const d1 = Math.hypot((x - cx) / 1, (y - cy) * (W / H) * 0.55);
            const d2 = Math.hypot((x - cx + W * 0.12), (y - cy) * (W / H) * 0.55);
            if (d1 > R1 || d2 < R2) continue;
            const edge = d1 > R1 - 1.3;
            const t = (x / W);
            ctx.fillStyle = edge ? 'rgba(255,255,255,1)' : `rgba(${Math.round(150 + 90 * t)},${Math.round(100 + 100 * t)},255,${(0.35 + 0.6 * t).toFixed(2)})`;
            ctx.fillRect(X + x, Y + y, 1, 1);
        }
    }

    // ── THE ULT'S ART ────────────────────────────────────────────────────────
    // assets/art/fx_cosmic_ult, typed by hand: Ascend's halo, a burst of light (violet, and gold for the full form), eight
    // runes and the eight-point star the rune circles are made of, the rift, the Twin Collapse objects, the two voidlets,
    // the voidbeam's lock and the little marks. Spinning things turn by frames; nothing is turned. The animations, and a
    // mint emitter for the full form's regeneration, are made the first time.
    static ultFx(S) {
        if (S._csUltE?.heal?.active) return S._csUltE;
        CosmicSystem.fx(S);
        const A = S.anims, K = 'fx_cosmic_ult', n = (b, k) => Array.from({ length: k }, (_, i) => b + i);
        const anim = (key, frames, frameRate, repeat = -1) => { if (!A.exists(key)) A.create({ key, frames: frames.map(frame => ({ key: K, frame })), frameRate, repeat }); };
        anim('csu_halo', n('halo_', 4), 6); anim('csu_sigil', n('sigil_', 4), 8); anim('csu_portal', n('portal_', 4), 10);
        anim('csu_orb', n('orb_', 4), 12); anim('csu_orbg', n('orbg_', 4), 12); anim('csu_vw', n('vw_', 4), 7); anim('csu_vb', n('vb_', 4), 6);
        anim('csu_reticle', n('reticle_', 4), 14); anim('csu_pin', n('pin_', 4), 8); anim('csu_twinkle', ['twinkle_0', 'twinkle_1', 'twinkle_0', 'twinkle_2', 'twinkle_3'], 7);
        anim('csu_crack', ['crack_0', 'crack_1'], 9); anim('csu_nova', n('nova_', 4), 16, 0); anim('csu_novag', n('novag_', 4), 16, 0);
        const heal = S.add.particles(0, 0, 'fx_cosmic', { frame: ['p_0', 'p_3', 'p_4', 'p_6', 'p_7'], emitting: false, blendMode: Phaser.BlendModes.ADD,
            lifespan: { min: 450, max: 750 }, speedY: { min: -40, max: -20 }, speedX: { min: -6, max: 6 }, scale: { start: 1.1, end: 0.6 },
            alpha: { start: 0.9, end: 0 }, color: [0xffffff, 0xd8ffe0, 0x7dff9a, 0x2a9a4a], colorEase: 'quad.out' }).setDepth(4.55);
        return (S._csUltE = { heal });
    }
    // A burst of light at (x, y) (gold or violet), sc its size (whole numbers keep its pixels even), played once
    static nova(S, x, y, sc = 1, gold = false, depth = 4.7) {
        CosmicSystem.ultFx(S);
        const o = S.add.sprite(Math.round(x), Math.round(y), 'fx_cosmic_ult', gold ? 'novag_0' : 'nova_0').setScale(sc).setDepth(depth);
        o.play(gold ? 'csu_novag' : 'csu_nova'); o.once('animationcomplete', () => o.destroy());
        return o;
    }
    // n particles from a ring of radius r round (cx, cy) (flattened by sq), drawn in to the middle over ms
    static inward(E, cx, cy, r, ms, n, sq = 1) {
        for (let i = 0; i < n; i++) {
            const a = Math.random() * Math.PI * 2, rr = r * (0.85 + Math.random() * 0.3), x = cx + Math.cos(a) * rr, y = cy + Math.sin(a) * rr * sq;
            const p = E.emitParticleAt(x, y, 1);
            if (!p) continue;
            const t = ms * (0.8 + Math.random() * 0.4) / 1000;
            p.velocityX = (cx - x) / t; p.velocityY = (cy - y) / t; p.life = p.lifeCurrent = t * 1000;
        }
    }
    // Particles laid along (x0, y0)→(x1, y1), one every `step` px, drifting off it at up to v px a second (ms: how long they live)
    static along(E, x0, y0, x1, y1, step, ms, v = 10) {
        const L = Math.hypot(x1 - x0, y1 - y0), k = Math.max(1, Math.round(L / step));
        for (let i = 0; i <= k; i++) {
            const f = (i + Math.random() * 0.6) / k, p = E.emitParticleAt(x0 + (x1 - x0) * f, y0 + (y1 - y0) * f, 1);
            if (!p) continue;
            const a = Math.random() * Math.PI * 2;
            p.velocityX = Math.cos(a) * v * Math.random(); p.velocityY = Math.sin(a) * v * Math.random();
            if (ms) p.life = p.lifeCurrent = ms * (0.75 + Math.random() * 0.5);
        }
    }
    // A rune circle stamped down at (x, y) and thrown off: the circle swelling out to r and fading, its runes flung past it
    static stamp(S, x, y, r, tint, depth = 4.65) {
        CosmicSystem.ultFx(S);
        const ring = S.add.image(x, y, 'fx_cosmic_ult', 'ring_l').setTint(tint).setDepth(depth).setScale(r * 0.45 / 28);
        S.tweens.add({ targets: ring, scale: r * 1.2 / 28, alpha: 0, duration: 520, ease: 'Cubic.easeOut', onComplete: () => ring.destroy() });
        const runes = CosmicSystem.runes(S, 8, tint, depth).place(x, y, r * 0.4, Math.random() * 6);
        runes.imgs.forEach(im => S.tweens.add({ targets: im, x: x + (im.x - x) * 3.4, y: y + (im.y - y) * 3.4, alpha: 0, duration: 520, ease: 'Cubic.easeOut', onComplete: () => im.destroy() }));
    }
    // A rune circle: n of the eight runes (each upright, never turned), set round a circle that turns by moving them. place()
    // each frame: centre, radius, the angle it has turned to, how many are lit (the rest dark), its alpha, how flat it lies
    static runes(S, n, tint, depth = 0.96, sc = 1) {
        CosmicSystem.ultFx(S);
        const imgs = Array.from({ length: n }, (_, i) => S.add.image(0, 0, 'fx_cosmic_ult', 'rune_' + ((i * 3) % 8)).setDepth(depth).setScale(sc));
        const R = { imgs, tint,
            place(cx, cy, r, a0, lit = n, alpha = 1, sq = 1) {
                imgs.forEach((im, i) => {
                    const a = a0 + i * Math.PI * 2 / n, on = i < lit;
                    im.setPosition(Math.round(cx + Math.cos(a) * r), Math.round(cy + Math.sin(a) * r * sq)).setTint(on ? R.tint : 0x2a1a4a).setAlpha(alpha * (on ? 1 : 0.55)).setVisible(true);
                });
                return R;
            },
            setVisible(v) { imgs.forEach(im => im.setVisible(v)); return R; },
            hide() { return R.setVisible(false); },
            destroy() { imgs.forEach(im => im.destroy()); },
        };
        return R;
    }

    static sheets(scene) {
        const tm = scene?.textures;
        if (!tm) return false;
        if (tm.exists('cs_sheet')) return true;
        const A = CosmicSystem.art();
        const SW = 192, SH = 96;
        const t = tm.createCanvas('cs_sheet', SW, SH), ctx = t.getContext();
        let bx = 0, by = 0, rowH = 0;
        for (const [name, rows] of Object.entries(A.bits)) {
            const w = rows[0].length, h = rows.length;
            if (bx + w > SW) { bx = 0; by += rowH + 1; rowH = 0; }
            CosmicSystem.pix(ctx, bx, by, rows, A.P);
            t.add(name, 0, bx, by, w, h);
            bx += w + 1; rowH = Math.max(rowH, h);
        }
        // the procedural ones, in a band underneath
        const y0 = by + rowH + 2;
        CosmicSystem.paintWell(ctx, 0, y0, 40);                        t.add('well', 0, 0, y0, 40, 40);
        CosmicSystem.paintRing(ctx, 41, y0, 36, '201,155,255', 3);      t.add('horizon', 0, 41, y0, 36, 36);
        CosmicSystem.paintThorns(ctx, 78, y0, 38);                     t.add('thorns', 0, 78, y0, 38, 38);
        CosmicSystem.paintSlash(ctx, 117, y0, 40, 18);                 t.add('slash', 0, 117, y0, 40, 18);
        CosmicSystem.paintRing(ctx, 117, y0 + 19, 20, '255,208,96', 0); t.add('ring_gold', 0, 117, y0 + 19, 20, 20);
        t.refresh();
        return true;
    }

    // ── THE WEAPONS' ART ─────────────────────────────────────────────────────
    // assets/art/fx_cosmic, typed by hand: the fist's burst, the wards, the stars and marks, the seed and the well's heart,
    // the Hex motes, the Event Horizon's shell, the blade, its cut, its fluid and Retribution's thorns. What has a direction is drawn east and
    // north-east (south and south-east are those a quarter turn round) and flipped for the other four, never turned.
    // The scene's animations and particle emitters, made the first time: dust (ten hand-drawn motes, stars and wisps,
    // white as they're born, then violet, then deep purple as they go), finer dust for trails, gold for the stars, pink
    // for the Hex, and a soft glow under them; all light, added, so where they crowd they burn white
    static fx(S) {
        if (S._csFxE?.dust?.active) return S._csFxE;
        const A = S.anims, K = 'fx_cosmic', ADD = Phaser.BlendModes.ADD;
        const n = (b, k) => Array.from({ length: k }, (_, i) => b + i);
        const anim = (key, frames, frameRate, repeat = 0) => { if (!A.exists(key)) A.create({ key, frames: frames.map(frame => ({ key: K, frame })), frameRate, repeat }); };
        for (const d of ['e', 's']) anim('csw_punch_' + d, n(`punch_${d}_`, 4), 22);
        anim('csw_ward', n('ward_', 4), 8, -1); anim('csw_wardpop', n('wardpop_', 4), 18);
        anim('csw_comet', n('comet_', 2), 12, -1); anim('csw_star', ['star_0', 'star_1', 'star_0', 'star_2'], 6, -1);
        anim('csw_mark', n('mark_', 4), 8, -1); anim('csw_pop', n('pop_', 5), 20);
        anim('csw_seed', n('seed_', 4), 14, -1); anim('csw_core', n('core_', 4), 7, -1);
        anim('csw_thorns', ['thorns_0', 'thorns_1', 'thorns_0', 'thorns_2'], 6, -1); anim('csw_shell', n('shell_', 4), 8, -1);
        // (each its own size, shrinking as it goes: a stream of them, never one shape stamped over and over)
        const size = (lo, hi, k = 0.6) => ({ scaleX: { onEmit: p => (p._s = lo + Math.random() * (hi - lo)), onUpdate: (p, key, t) => (p._s || lo) * (1 - k * t) },
                                             scaleY: { onEmit: p => p._s || lo, onUpdate: (p, key, t) => (p._s || lo) * (1 - k * t) } });
        const mk = (frames, cfg, depth) => S.add.particles(0, 0, K, { frame: frames, emitting: false, blendMode: ADD, angle: { min: 0, max: 360 }, ...cfg }).setDepth(depth);
        const VIOLET = [0xf4ecff, 0xd8bcff, 0xa874f8, 0x6a32c8, 0x2a1060];
        const dust = mk(n('p_', 10), { lifespan: { min: 300, max: 650 }, speed: { min: 10, max: 50 }, gravityY: -20, ...size(0.8, 1.6),
            alpha: { start: 0.9, end: 0 }, color: VIOLET, colorEase: 'quad.out' }, 4.5);
        const fine = mk(['p_0', 'p_3', 'p_4', 'p_6', 'p_9'], { lifespan: { min: 250, max: 480 }, speed: { min: 0, max: 14 }, gravityY: -12, ...size(0.8, 1.2),
            alpha: { start: 0.9, end: 0 }, color: VIOLET, colorEase: 'quad.out' }, 4.5);
        const gold = mk(['p_0', 'p_1', 'p_2', 'p_3', 'p_6', 'p_7'], { lifespan: { min: 300, max: 700 }, speed: { min: 10, max: 60 }, gravityY: 40, ...size(0.8, 1.5),
            alpha: { start: 1, end: 0 }, color: [0xffffff, 0xfff0b0, 0xffd060, 0xc88a20, 0x5a3a08], colorEase: 'quad.out' }, 4.55);
        const pink = mk(n('p_', 10), { lifespan: { min: 300, max: 650 }, speed: { min: 6, max: 40 }, gravityY: -30, ...size(0.8, 1.5),
            alpha: { start: 0.9, end: 0 }, color: [0xfff0fa, 0xffc8f0, 0xff5fd2, 0xa0207a, 0x3a0a30], colorEase: 'quad.out' }, 4.5);
        const glow = S.add.particles(0, 0, 'vfx_glow', { emitting: false, lifespan: { min: 220, max: 420 }, speed: { min: 0, max: 18 },
            scale: { start: 0.3, end: 0.08 }, alpha: { start: 0.22, end: 0 }, color: [0xe2c8ff, 0x9a5cf0, 0x3a1470], blendMode: ADD }).setDepth(4.45);
        return (S._csFxE = { dust, fine, gold, pink, glow });
    }
    // n particles from emitter E at (x, y), thrown out at v0..v1 px a second within `spread` of angle a (Math.PI: all
    // round); ms, if given, how long they live
    static puff(E, x, y, n, a = 0, spread = Math.PI, v0 = 20, v1 = 80, ms = 0) {
        for (let i = 0; i < n; i++) {
            const p = E.emitParticleAt(x + (n > 2 ? (Math.random() - 0.5) * 6 : 0), y + (n > 2 ? (Math.random() - 0.5) * 6 : 0), 1);   // (a few px apart, never all on one spot)
            if (!p) continue;
            const b = a + (Math.random() * 2 - 1) * spread, v = v0 + Math.random() * (v1 - v0);
            p.velocityX = Math.cos(b) * v; p.velocityY = Math.sin(b) * v;
            if (ms) p.life = p.lifeCurrent = ms * (0.8 + Math.random() * 0.4);
        }
    }
    // A ring of n particles flung out from (x, y) to reach radius r as they die, ms on (r0: how far out they start, so a
    // big ring isn't one white-hot spot at its birth)
    static ring(E, x, y, r, ms, n, r0 = 3) {
        for (let i = 0; i < n; i++) {
            const a = (i + Math.random() * 0.7) / n * Math.PI * 2, p = E.emitParticleAt(x + Math.cos(a) * r0, y + Math.sin(a) * r0, 1);
            if (!p) continue;
            const v = (r - r0) / (ms / 1000) * (0.8 + Math.random() * 0.35);
            p.velocityX = Math.cos(a) * v; p.velocityY = Math.sin(a) * v; p.life = p.lifeCurrent = ms;
        }
    }
    // The nearest of the eight ways to angle a, as the frame drawn for it and whether it's flipped both ways
    static way(a) { return [['e', 0], ['se', 0], ['s', 0], ['ne', 1], ['e', 1], ['se', 1], ['s', 1], ['ne', 0]][((Math.round(a / (Math.PI / 4)) % 8) + 8) % 8]; }
    // A well's swirl at (cx, cy): its own emitter, the dust it's given wheeling in round the heart (flattened, it lies on
    // the floor), quicker and tighter the nearer it gets, hotter, whiter as it falls, swallowed at the middle
    static swirl(S, cx, cy) {
        const E = S.add.particles(0, 0, 'fx_cosmic', { frame: Array.from({ length: 10 }, (_, i) => 'p_' + i), emitting: false, blendMode: Phaser.BlendModes.ADD,
            lifespan: 1500, speed: 0,
            scaleX: { onEmit: p => (p._s = 0.7 + Math.random() * 0.7), onUpdate: (p, k, t) => (p._s || 1) * (1 - 0.45 * t) },
            scaleY: { onEmit: p => p._s || 1, onUpdate: (p, k, t) => (p._s || 1) * (1 - 0.45 * t) },
            alpha: { onEmit: () => 0.4, onUpdate: (p, k, t) => 0.4 + 0.5 * Math.min(1, t * 5) },   // (seen from the moment it's drawn in: the dust marks the well's reach)
            color: [0x4a22a0, 0x8a52e8, 0xc8a0ff, 0xf0e4ff, 0xffffff], colorEase: 'quad.in' }).setDepth(0.975);
        const pr = new Phaser.GameObjects.Particles.ParticleProcessor(cx, cy, true), SQ = 0.6;
        pr.update = (p, delta, step) => {
            const dx = p.x - cx, dy = (p.y - cy) / SQ, r = Math.hypot(dx, dy);
            if (r < 5) { p.lifeCurrent = 0; return; }   // swallowed
            const a = Math.atan2(dy, dx) + step * (1.4 + 90 / r), nr = r - step * (14 + 1100 / r);
            p.x = cx + Math.cos(a) * nr; p.y = cy + Math.sin(a) * nr * SQ;
            p.velocityX = p.velocityY = 0;
        };
        E.addParticleProcessor(pr);
        return E;
    }

    // ── SETUP ────────────────────────────────────────────────────────────────
    // From GameScene.create. Everything is per level: boons, the gem, the wards.
    _csInit() {
        this._csCfgCache = null;   // re-read per level: weapon perks bought in the shop change it
        if (!CosmicSystem.sheets(this)) return;
        this._cs = {
            unlocked: this._csUnlockedNow(), unlockCheckAt: 0,
            cdUntil: 0, castAt: -1e9, punchAt: -1e9,
            momentum: 0, momentumAt: -1e9,
            wards: [], wardsUntil: 0, wardAngle: 0,
            stars: [], well: null, astro: null, astral: new Map(), blade: null,
            horizonUntil: 0, retributionUntil: 0, retAt: -1e9,
            ascendUntil: 0, ascendAt: -1e9, nova: false,
            layer2: 0, layer3: 0, charge: null, tf: null, drag: null, collapses: [], voidlets: [],
            ghostAt: 0, lastPX: 0, lastPY: 0,
            fx: {}, hexFx: new Map(),
        };
        this._csBuildTray();
        this.events.once('shutdown', () => this._csTeardown());
    }

    _csTeardown() {
        const S = this._cs;
        if (!S) return;
        for (const w of S.wards) { w.img?.destroy(); w.glow?.destroy(); }
        for (const s of S.stars) { s.img?.destroy(); s.glow?.destroy(); }
        for (const p of S.astro?.pickups || []) { p.img?.destroy(); p.glow?.destroy(); }
        for (const [, o] of S.astral) o?.destroy?.();
        S.blade?.g?.destroy(); S.blade?.big?.destroy(); S.blade?.halo?.destroy();
        for (const t of S.fluid || []) t.img?.destroy();
        if (S.tf) { S.tf.portal?.glow?.destroy(); S.tf.portal?.destroy(); this._csSkinDrop(S.tf.skin); }
        if (S.charge) { S.charge.edge?.destroy(); for (const o of S.charge.ui || []) o?.destroy?.(); }
        S.charge?.snd?.stop(); S.blade?.snd?.stop(); Music.duck(false);   // never leave a drone or silent music behind
        for (const c of S.collapses || []) for (const o of c.objs) { o.glow?.destroy(); o.core?.destroy(); }
        for (const v of S.voidlets || []) [v.spr, v.glow, v.eye, v.bar, v.reticle].forEach(o => o?.destroy());
        if (S.well) this._csWellEnd(true);
        if (S.wellBeam) { S.wellBeam.g?.destroy(); S.wellBeam = null; }
        if (S.stasis) this._csStasisEnd('gone');   // (the scene's going: nothing stored lands)
        S.fly?.spr?.destroy(); S.fly?.shadow?.destroy(); S.fly?.ghost?.forEach(o => o.destroy());
        for (const k in S.fx) S.fx[k]?.destroy?.();
        for (const [, o] of S.hexFx) o?.destroy?.();
        this._cs = null;
        this._csTrayG = this._csTrayIcon = this._csTrayText = this._csTrayPips = this._csEdge = null;
    }

    _csUnlockedNow() {
        if (this.isTutorial) return false;
        try { return localStorage.getItem('unlocked_cosmic') === 'true'; } catch (e) { return false; }
    }

    _csWeapon() { return this.equippedWeapons?.cosmic || 'cosmic_fists'; }
    _csAscending() { return !!this._cs && this.time.now < this._cs.ascendUntil; }

    // ── WHAT THE BOONS DO (the hooks) ────────────────────────────────────────
    _csMomentum() {
        const S = this._cs;
        if (!S || this._csWeapon() !== 'cosmic_fists') return 0;
        if (this._csAscending()) return this._csCfg().FISTS.MAX;
        return this.time.now - S.momentumAt <= this._csCfg().FISTS.MS ? S.momentum : 0;
    }

    // Everything you deal is multiplied by this. enemy: the target, or null for a boss.
    _csDmgMult(enemy) {
        const S = this._cs;
        if (!S) return 1;
        const C = this._csCfg();
        let m = 1;
        const st = this._csMomentum();
        if (st > 0) m *= 1 + C.FISTS.DMG_PER * st;
        if (enemy && (enemy._csHexUntil || 0) > this.time.now) m *= C.BLADE.HEX_STACKS[Math.min(3, enemy._csHexStacks || 1) - 1];
        return m;
    }

    // Damage you take is multiplied by this (it becomes damageReductionMultiplier).
    _csTakenMult() {
        const S = this._cs;
        if (!S) return 1;
        let m = this.time.now < S.horizonUntil ? this._csCfg().WELL.TAKEN : 1;
        if (this._csStage() >= 2 && this._csAscending()) m *= this._csCfg().ASCEND.TAKEN_S2;   // stage 2's Ascend
        return m;
    }

    // The player's step cooldown is multiplied by this.
    _csMoveMult() {
        const st = this._csMomentum();
        let m = st > 0 ? 1 / (1 + this._csCfg().FISTS.SPEED_PER * st) : 1;
        if (this._cs?.blade) m *= 1 + (this._csCfg().BLADE.SLOW - 1) * this._csBladeF(this.time.now);   // charging the Void Blade
        if (this._csAscending()) m /= this._csCfg().ASCEND.SPEED;   // Ascend: quicker on your feet
        return m;
    }

    _csSwitchMult() { return this._csAscending() ? 0 : 1; }

    _csMark(e, n = 1) {
        if (!e || this._phasedOut?.(e)) return;
        const max = this.cosmicMaxMarks || 3;
        e.cosmicMarks = Math.min(max, (e.cosmicMarks || 0) + n);
        e._csMarkAt = this.time.now;
    }

    // Every hit that lands, from the damage choke points.
    _csOnHit(enemy, el) {
        const S = this._cs;
        if (!S || !enemy || S.nova || this.time.now >= S.ascendUntil) return;
    }

    _csOnDash(tiles) {
        if ((tiles || 0) > 0) this._csAddMomentum();
    }

    _csAddMomentum() {
        const S = this._cs;
        if (!S || this._csWeapon() !== 'cosmic_fists') return;
        const C = this._csCfg().FISTS, was = this._csMomentum();
        S.momentum = Math.min(C.MAX, was + 1);
        S.momentumAt = this.time.now;
        if (S.momentum > was && this.player?.active && this.textures.exists('cfx_bits')) {
            for (let i = 0; i < 2; i++) {
                const c = this.add.image(this.player.x + (i ? 7 : -7), this.player.y + 6, 'cfx_bits', 'chevron')
                    .setTint(0xc99bff).setFlipY(true).setDepth(4.5);
                this.tweens.add({ targets: c, y: c.y - 14, alpha: 0, duration: 420, delay: i * 60, ease: 'Quad.easeIn', onComplete: () => c.destroy() });
            }
        }
    }

    // You took a hit (after reductions). Retribution hexes everything close.
    _csOnHurt(amount) {
        const S = this._cs;
        if (!S || !(amount > 0)) return;
        const now = this.time.now;
        if (now >= S.retributionUntil || now - S.retAt < 250) return;
        S.retAt = now;
        const C = this._csCfg().BLADE;
        for (const e of this.enemies || []) {
            if (!e.sprite?.active || e.health <= 0 || this._phasedOut?.(e)) continue;
            if (Math.hypot(e.x - this.playerX, e.y - this.playerY) > C.HEX_R + 0.01) continue;
            this._csHex(e);
        }
        this._csBurst(this.player.x, this.player.y, C.HEX_R * this.TILE_SIZE, this._csCfg().COL.hex, 360);
        this.cameras.main.shake(60, 0.004);
    }

    // One more Hex stack (3 at most): +10% / +25% / +45% damage taken, slowed. The timer keeps whichever
    // lasts longer, what's left or the new one; when it runs out the stacks fall off one a second
    // (_csUpdateMarks). Every cosmic Hex goes through here (the fluid, Retribution, collapses).
    // `ms`: how long this source's Hex lasts; a shorter one never cuts a longer one short.
    _csHex(e, ms = this._csCfg().BLADE.HEX_MS) {
        if (this._phasedOut?.(e)) return;
        const now = this.time.now;
        if (e._hexImmune) {   // the Adaptive Shade: hex slides off it
            if (e.sprite?.active && now - (e._hexNoAt || 0) > 900) { e._hexNoAt = now; this.showStatusText(e.sprite.x, e.sprite.y - 30, 'IMMUNE TO HEX', '#d8a0ff'); }
            return;
        }
        if ((e._csHexUntil || 0) <= now) e._csHexStacks = 0;
        const n = Math.min(3, (e._csHexStacks || 0) + 1), grew = n !== e._csHexStacks;
        e._csHexStacks = n;
        e._csHexUntil = Math.max(e._csHexUntil || 0, now + ms);
        const at = e.sprite?.active ? e.sprite : e.container?.active !== false && e.container ? { x: e.container.x, y: e.container.y - 60 } : null;   // (a story boss has a container, not a sprite)
        if (grew && at) this.showStatusText(at.x, at.y - 12, n > 1 ? `HEX ×${n}` : 'HEXED', '#ff8ce0');
        if (!e.sprite) this._bossIceWatch?.();   // a boss: its motes are drawn there
    }

    // A projectile is about to reach you: a ward eats it (EnemyManager.updateEnemyProjectiles
    // asks just before its hit test; the other projectile kinds are swept every frame).
    _csWardCatch(x, y, src = null) {
        const S = this._cs;
        if (!S || !S.wards.length) return false;
        const T = this.TILE_SIZE;
        const px = this.playerX * T + T / 2, py = this.playerY * T + T / 2;
        if (Math.hypot(x - px, y - py) > this._csCfg().BARRIER.CATCH) return false;
        this._csWardEat(x, y, src);
        return true;
    }

    _csWardEat(x, y, src = null) {
        const S = this._cs;
        // whoever fired it is Hexed (5s): its owner, or the enemy standing where it was fired from
        const T = this.TILE_SIZE;
        const owner = src?.owner || (src?.startX !== undefined ? (this.enemies || []).filter(e => e.sprite?.active && e.health > 0)
            .map(e => ({ e, d: Math.hypot(e.sprite.x - src.startX, e.sprite.y - src.startY) })).filter(c => c.d < T * 2.5).sort((a, b) => a.d - b.d)[0]?.e : null);
        if (owner) this._csHex(owner, 5000);
        let best = 0, bd = 1e9;
        S.wards.forEach((w, i) => { const d = Math.hypot(w.img.x - x, w.img.y - y); if (d < bd) { bd = d; best = i; } });
        const w = S.wards[best];
        const C = this._csCfg().COL;
        // the ward lunges onto the shot, a streak of dust behind it, and both go: the ward shatters, its light thrown out
        const F = CosmicSystem.fx(this);
        for (let k = 0; k <= 6; k++) CosmicSystem.puff(F.fine, w.img.x + (x - w.img.x) * k / 6, w.img.y + (y - w.img.y) * k / 6, 1, 0, Math.PI, 4, 22);
        const pop = this.add.sprite(x, y, 'fx_cosmic', 'wardpop_0').setScale(1.6).setBlendMode(Phaser.BlendModes.ADD).setDepth(4.6).play('csw_wardpop');
        pop.once('animationcomplete', () => pop.destroy());
        CosmicSystem.puff(F.dust, x, y, 9, 0, Math.PI, 30, 110);
        this._vfxFlash?.(x, y, 50, C.violet, 200, 0.7);
        const keep = this._csAscending() && this._csWeapon() === 'barrier_staff';   // Ascend: wards hold
        if (!keep) {
            S.wards.splice(best, 1);
            this.tweens.add({ targets: [w.img, w.glow], scale: 0, alpha: 0, duration: 140, onComplete: () => { w.img.destroy(); w.glow.destroy(); } });
            if (!S.wards.length) S.wardsUntil = 0;
        }
        this.showStatusText(this.player.x, this.player.y - 26, 'BLOCKED', '#d9b8ff');
        Sfx.play(this, 'block');
        this._csWardShove();
    }

    // Every shot a ward eats sends a pulse out: the enemies close to you (within SHOVE_R) are
    // knocked SHOVE tiles straight away from you, stopping early at walls and other enemies.
    // Things rooted to the spot (mortars, totems, anchors) stay put; bosses aren't shoved.
    _csWardShove() {
        const C = this._csCfg().BARRIER, T = this.TILE_SIZE, px = this.playerX, py = this.playerY;
        const blocked = (x, y) => this.world?.[x]?.[y] !== this.FLOOR || this.getEnemyAt(x, y) || (x === px && y === py) || this.isInLockedRoom?.(x, y);
        let n = 0;
        for (const e of this.enemies || []) {
            if (!e.sprite?.active || e.health <= 0 || e.isMortar || e.isHealerTotem || e.isAnchor || this._phasedOut?.(e)) continue;
            const dx = e.x - px, dy = e.y - py, d = Math.hypot(dx, dy);
            if (d > C.SHOVE_R + 0.01) continue;
            // straight away from you: along the bigger axis, or diagonally when it's level
            const sx = d === 0 ? 1 : Math.abs(dx) >= Math.abs(dy) * 0.5 ? Math.sign(dx) : 0;
            const sy = d === 0 ? 0 : Math.abs(dy) >= Math.abs(dx) * 0.5 ? Math.sign(dy) : 0;
            let k = 0;
            while (k < C.SHOVE && !blocked(e.x + sx, e.y + sy)) { e.x += sx; e.y += sy; k++; }
            if (!k) continue;
            n++;
            e._committedPath = null; e._pathIndex = undefined;
            e.lastMoveTime = this.time.now;   // a beat before it comes back
            this.tweens.add({ targets: e.sprite, x: e.x * T + T / 2, y: e.y * T + T / 2 + (this.SLIME_Y_OFFSET || 0),
                              duration: 140 + 40 * k, ease: 'Quad.easeOut', onUpdate: () => this.updateEnemyHealthBar?.(e) });
        }
        if (n && this.player?.active) CosmicSystem.ring(CosmicSystem.fx(this).dust, this.player.x, this.player.y + 2, (C.SHOVE_R + 1) * T, 320, 30);   // the pulse: a ring of dust thrown out
    }

    // ── THE WEAPONS ──────────────────────────────────────────────────────────
    // From fireEquippedWeapon (click or hold, like every weapon). tx/ty as the game passes them.
    _csCast(weapon, tx, ty) {
        const S = this._cs;
        if (!S || !this.player?.active) return;
        if (weapon === 'cosmic_fists') { this._csPunch(tx, ty); return; }
        const C = this._csCfg(), now = this.time.now;
        if (now < S.cdUntil) {
            // a fresh click, made after the last cast (the click that cast is still held the frames after it: that's no refusal)
            if (now - (this._csClickAt ?? -1e9) < 60 && this._csClickAt > S.castAt && now - (S.notReadyAt || -1e9) > 500) {
                S.notReadyAt = now;
                this.showStatusText(this.player.x, this.player.y - 28, `${((S.cdUntil - now) / 1000).toFixed(1)}s`, '#9a8cb8');
                Sfx.play(this, 'deny');
            }
            return;
        }
        const cam = this.cameras.main, wx = tx + cam.scrollX, wy = ty + cam.scrollY;
        let ok = false, cd = 0;
        if (weapon === 'barrier_staff')          { ok = this._csBarrier();       cd = C.BARRIER.CD; }
        else if (weapon === 'astrolabe')         { ok = this._csAstrolabe(wx, wy); cd = C.ASTRO.CD; }
        else if (weapon === 'singularity_staff') { ok = this._csWell(wx, wy);    cd = C.WELL.CD; }
        else if (weapon === 'void_blade')        { this._csBladeCharge(); return; }   // fires on release (_csRelease)
        else if (weapon === 'pendulum')          { ok = this._csStasisCast(wx, wy); cd = C.PEND.STASIS_CD; }
        if (!ok) return;
        S.cdUntil = now + cd; S.cdMs = cd;
        this._gearFiredAt = now;   // the held weapon swings now (Creatures.gear)
        S.castAt = now;
    }

    _csPunch(tx, ty) {
        const S = this._cs, C = this._csCfg().FISTS, now = this.time.now;
        if (now - S.punchAt < C.CD) return;
        S.punchAt = now;
        this._gearFiredAt = now;   // the held weapon swings now (Creatures.gear)
        const T = this.TILE_SIZE, cam = this.cameras.main;
        const wx = tx + cam.scrollX, wy = ty + cam.scrollY;
        const px = this.playerX * T + T / 2, py = this.playerY * T + T / 2;
        const dx = wx - px, dy = wy - py;
        let fx = 0, fy = 0;
        if (Math.abs(dx) > Math.abs(dy)) fx = dx > 0 ? 1 : -1; else fy = dy > 0 ? 1 : -1;
        const tile = { x: this.playerX + fx, y: this.playerY + fy };
        if (this.world?.[tile.x]?.[tile.y] !== this.FLOOR) return;
        if (this.isInCurrentRoom && !this.isInCurrentRoom(tile.x, tile.y)) return;
        const hx = tile.x * T + T / 2, hy = tile.y * T + T / 2;
        const dmg = C.DMG * (this.damageScaling || 1);
        let hit = false;
        for (const e of [...(this.enemies || [])]) {
            if (e.x !== tile.x || e.y !== tile.y || !e.sprite?.active) continue;
            this.damageEnemy(e, dmg, 'cosmic');
            if (this._dmgLanded) hit = true;
        }
        const portal = this.getPortalAt?.(tile.x, tile.y);
        if (portal) { this.damagePortal(portal, dmg); hit = true; }
        if (this.damageBossAtTile(tile.x, tile.y, dmg, undefined, 'cosmic')) hit = true;
        // the knuckle burst (hand-drawn, the way you punched) on the tile, void dust thrown on through it; it connects: bigger,
        // brighter, gold sparks off it
        const col = this._csCfg().COL, F = CosmicSystem.fx(this), [d, fl] = CosmicSystem.way(Math.atan2(fy, fx)), a = Math.atan2(fy, fx);
        const bx = hx - fx * 2, by = hy - fy * 2 - 3;
        const b = this.add.sprite(bx, by, 'fx_cosmic', `punch_${d}_0`).setFlip(!!fl, !!fl).setScale(hit ? 1.6 : 1.1).setAlpha(hit ? 1 : 0.7)
            .setBlendMode(Phaser.BlendModes.ADD).setDepth(4.6).play('csw_punch_' + d);
        b.once('animationcomplete', () => b.destroy());
        CosmicSystem.puff(F.dust, bx - fx * 6, by - fy * 6, hit ? 12 : 4, a, 0.7, 40, hit ? 170 : 90);
        if (hit) {
            CosmicSystem.puff(F.gold, bx, by, 4, a, 1, 50, 140);
            F.glow.emitParticleAt(bx, by, 2);
            this._vfxFlash?.(hx, hy, 56, col.violet, 160, 0.6); this._csAddMomentum();
        }
        this.cameras.main.shake(hit ? 50 : 25, hit ? 0.003 : 0.0015);
    }

    _csBarrier() {
        this._csRaiseWards(this._csCfg().BARRIER.MS);
        this._csCastFx('WARDS', this._csCfg().COL.violet);
        return true;
    }

    _csRaiseWards(ms) {
        const S = this._cs, C = this._csCfg().BARRIER, col = this._csCfg().COL;
        S.wardsUntil = Math.max(S.wardsUntil, this.time.now + ms);
        CosmicSystem.fx(this);
        while (S.wards.length < C.WARDS) {   // (each a crystal turning, by its own frames, out of step with the others)
            const img = this.add.sprite(this.player.x, this.player.y, 'fx_cosmic', 'ward_0').setDepth(this.player.depth + 0.01).setScale(0).play({ key: 'csw_ward', startFrame: S.wards.length % 4 });
            const glow = this.add.image(this.player.x, this.player.y, 'vfx_glow').setTint(col.violet)
                .setBlendMode(Phaser.BlendModes.ADD).setDepth(0.9).setScale(0).setAlpha(0.55);
            this.tweens.add({ targets: img, scale: 1.3, duration: 220, ease: 'Back.easeOut' });
            this.tweens.add({ targets: glow, scale: 0.16, duration: 220 });
            S.wards.push({ img, glow });
        }
    }

    // ── ASTROLABE: STARFALL ──────────────────────────────────────────────────
    // Shooting stars crash on open floor around the room you're in (more in a bigger room),
    // dazing whatever they land on. Where each one lands it lies glowing until the window
    // closes; walk over it to collect it. Then the stars you hold are spent: each one marks
    // MARKS_PER enemies in the area (nearest first, bosses too), and each mark pops for ult
    // charge the first time you hit it (_csAstralPop). Combat only: an area with no foes refuses.
    _csAstrolabe() {
        const S = this._cs, C = this._csCfg().ASTRO, col = this._csCfg().COL, now = this.time.now, T = this.TILE_SIZE;
        // where they can fall: the room you're in, or the open floor around you
        const ri = this.getCurrentPlayerRoom?.() ?? -1, room = ri >= 0 ? this.rooms?.[ri] : null;
        const spots = [];
        const x0 = room ? room.x : this.playerX - 8, x1 = room ? room.x + room.w : this.playerX + 8;
        const y0 = room ? room.y : this.playerY - 6, y1 = room ? room.y + room.h : this.playerY + 6;
        const area = { x0, x1, y0, y1 };
        // Combat only: with nobody in the area there is nothing to mark, and collecting stars in
        // an empty room used to send the marks to enemies in rooms you hadn't reached.
        if (!this._csAstroFoes(area).length) {
            this.showStatusText(this.player.x, this.player.y - 28, 'NO FOES HERE', '#9a8cb8');
            return false;
        }
        for (let x = x0; x < x1; x++) for (let y = y0; y < y1; y++) {
            if (this.world?.[x]?.[y] !== this.FLOOR || this.isInLockedRoom?.(x, y)) continue;
            if (Math.abs(x - this.playerX) + Math.abs(y - this.playerY) < 2) continue;
            spots.push({ x, y });
        }
        if (!spots.length) return false;
        const n = Math.max(C.MIN, Math.min(C.MAX, Math.round(spots.length / C.PER_TILES)));
        // spread out: random picks, none within 2 tiles of another (relaxed if the room is small)
        const pick = [];
        for (let tries = 0; pick.length < n && tries < 400; tries++) {
            const s = spots[Math.floor(Math.random() * spots.length)];
            if (tries < 300 && pick.some(p => Math.abs(p.x - s.x) + Math.abs(p.y - s.y) < 3)) continue;
            if (!pick.includes(s)) pick.push(s);
        }
        if (S.astro) for (const p of S.astro.pickups) { p.img?.destroy(); p.glow?.destroy(); }
        S.astro = { until: now + C.FALL_MS + C.STAGGER * pick.length + C.WINDOW, pickups: [], got: 0, area };
        pick.forEach((sp, i) => this.time.delayedCall(i * C.STAGGER, () => this._csStarFall(sp.x, sp.y)));
        this._csCastFx('STARFALL', col.gold);
        return true;
    }

    // One shooting star, from high up and to the side, onto tile (tx, ty).
    _csStarFall(tx, ty) {
        const S = this._cs;
        if (!S?.astro) return;
        const C = this._csCfg().ASTRO, col = this._csCfg().COL, T = this.TILE_SIZE;
        // (always the one slant, two down to one across, the way the star is drawn falling; a shower of them falls parallel)
        const x = tx * T + T / 2, y = ty * T + T / 2, sx = x - 130, sy = y - 260, F = CosmicSystem.fx(this), back = Math.atan2(sy - y, sx - x);
        const img = this.add.sprite(sx, sy, 'fx_cosmic', 'comet_0').setOrigin(11.5 / 16, 19.5 / 26).setDepth(4.6).setScale(1.5).play('csw_comet');
        const glow = this.add.image(sx, sy, 'vfx_glow').setTint(col.gold).setBlendMode(Phaser.BlendModes.ADD).setDepth(4.5).setScale(0.3).setAlpha(0.9);
        this.tweens.add({ targets: img, x, y, duration: C.FALL_MS, ease: 'Quad.easeIn',
            onUpdate: () => { glow.setPosition(img.x, img.y); CosmicSystem.puff(F.gold, img.x, img.y, 2, back, 0.35, 20, 70); },   // gold shed off its tail
            onComplete: () => {
            glow.setPosition(x, y);
            if (!this._cs?.astro) { img.destroy(); glow.destroy(); return; }
            // impact: it bursts on the floor, sparks bounce off it, a flash, and everything close is dazed (no damage)
            const b = this.add.sprite(x, y, 'fx_cosmic', 'pop_0').setScale(1.4).setBlendMode(Phaser.BlendModes.ADD).setDepth(4.6).play('csw_pop');
            b.once('animationcomplete', () => b.destroy());
            CosmicSystem.puff(F.gold, x, y, 10, -Math.PI / 2, 1.3, 40, 130);
            this._csBurst(x, y, C.DAZE_R * T, col.gold, 320);
            this._vfxFlash?.(x, y, 80, col.gold, 260, 0.8);
            this.cameras.main.shake(40, 0.002);
            const now = this.time.now;
            for (const e of this.enemies || []) {
                if (!e.sprite?.active || e.health <= 0 || this._phasedOut?.(e)) continue;
                if (Math.hypot(e.x - tx, e.y - ty) > C.DAZE_R) continue;
                e.isStunned = true;
                e.stunnedUntil = Math.max(e.stunnedUntil || 0, now + C.DAZE_MS);
                this.showStatusText(e.sprite.x, e.sprite.y - 12, 'DAZED', '#ffe08a');
            }
            // the fallen star, lying there to be picked up
            img.setOrigin(0.5).setScale(1.3).setDepth(0.95).play({ key: 'csw_star', startFrame: Math.floor(Math.random() * 4) });
            glow.setScale(0.22).setDepth(0.94).setAlpha(0.7);
            this.tweens.add({ targets: img, y: y - 3, duration: 600, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
            this._cs.astro.pickups.push({ tx, ty, img, glow, taken: false });
        } });
    }

    // Every frame: pick up the stars you walk over; when the window closes, spend them.
    _csUpdateStars(now) {
        const S = this._cs, A = S.astro;
        this._csUpdateAstral(now);
        if (!A) return;
        const C = this._csCfg().ASTRO, col = this._csCfg().COL;
        for (const p of A.pickups) {
            if (p.taken) continue;
            if (A.until - now < 1200) p.img.setAlpha(Math.floor(now / 120) % 2 ? 0.35 : 1);   // fading: it blinks
            if (Math.hypot(this.playerX - p.tx, this.playerY - p.ty) > C.PICK_R) continue;
            p.taken = true; A.got++;
            Sfx.play(this, 'pickup');
            this._csGainCharge(this.ultChargeMax * C.STAR_CHARGE / this._csCfg().CHARGE_SHARE);   // a star caught: cosmic charge
            this.tweens.killTweensOf(p.img);
            CosmicSystem.puff(CosmicSystem.fx(this).gold, p.img.x, p.img.y, 7, -Math.PI / 2, Math.PI, 20, 90);   // it lifts off in a puff of gold
            this.tweens.add({ targets: [p.img, p.glow], x: this.player.x, y: this.player.y - 10, scale: 0.4, duration: 220, ease: 'Quad.easeIn',
                              onComplete: () => { p.img.destroy(); p.glow.destroy(); } });
            this.showStatusText(this.player.x, this.player.y - 30, `★ ${A.got}`, '#ffe08a');
        }
        if (now < A.until) return;
        S.astro = null;
        for (const p of A.pickups) if (!p.taken) this.tweens.add({ targets: [p.img, p.glow], alpha: 0, duration: 260, onComplete: () => { p.img.destroy(); p.glow.destroy(); } });
        this._csSpendStars(A.got, A.area);
    }

    // The stars you collected circle you, tighten, and burst into beams: each finds an enemy
    // (nearest first, bosses included) and marks it.
    // The enemies (and bosses) inside an area, as { e, x, y } with their screen position.
    _csAstroFoes(a) {
        const T = this.TILE_SIZE, inA = (tx, ty) => tx >= a.x0 && tx < a.x1 && ty >= a.y0 && ty < a.y1;
        const out = (this.enemies || []).filter(e => e.sprite?.active && e.health > 0 && !this._phasedOut?.(e) && inA(e.x, e.y))
            .map(e => ({ e, x: e.sprite.x, y: e.sprite.y }));
        for (const b of [this.voltslimeBoss, this.voidSovereignBoss, this.fractureCore]) {
            if (b?.active && b.container && inA(Math.floor(b.container.x / T), Math.floor(b.container.y / T))) out.push({ e: b, x: b.container.x, y: b.container.y });
        }
        return out;
    }

    _csSpendStars(got, area) {
        const S = this._cs, C = this._csCfg().ASTRO, col = this._csCfg().COL, now = this.time.now;
        if (!got || !this.player?.active) { if (this.player) this.showStatusText(this.player.x, this.player.y - 30, 'NO STARS', '#9a8cb8'); return; }
        const px = this.player.x, py = this.player.y - 8, F = CosmicSystem.fx(this);
        const orbit = [];
        for (let i = 0; i < got; i++) {
            const s = this.add.sprite(px, py, 'fx_cosmic', 'star_0').setDepth(4.7).setBlendMode(Phaser.BlendModes.ADD).play({ key: 'csw_star', startFrame: i % 4 });
            orbit.push(s);
        }
        const spin = { t: 0 };
        this.tweens.add({ targets: spin, t: 1, duration: 650, ease: 'Cubic.easeIn',
            onUpdate: () => orbit.forEach((s, i) => {   // (each sheds gold as it goes round)
                const a = spin.t * Math.PI * 4 + i / got * Math.PI * 2, r = 34 * (1 - spin.t) + 4;
                s.setPosition(this.player.x + Math.cos(a) * r, this.player.y - 8 + Math.sin(a) * r * 0.6).setScale(1.2 + spin.t * 0.5);
                if (Math.random() < 0.6) CosmicSystem.puff(F.gold, s.x, s.y, 1, 0, Math.PI, 2, 14);
            }),
            onComplete: () => {
                orbit.forEach(s => s.destroy());
                if (!this._cs || !this.player?.active) return;
                const cx = this.player.x, cy = this.player.y - 8;
                this._vfxFlash?.(cx, cy, 120, col.gold, 300, 1);
                Sfx.play(this, 'ult');
                const pool = this._csAstroFoes(area);
                pool.sort((a, b) => Math.hypot(a.x - cx, a.y - cy) - Math.hypot(b.x - cx, b.y - cy));
                const n = Math.min(pool.length, got * C.MARKS_PER, C.MAX_MARKS);
                CosmicSystem.puff(F.gold, cx, cy, 14, 0, Math.PI, 40, 140);
                pool.slice(0, n).forEach(t => {
                    t.e._csAstral = true;
                    // a shooting star from you to it, shedding gold all the way, bursting where it strikes (its mark grows there)
                    const s = this.add.sprite(cx, cy, 'fx_cosmic', 'star_2').setBlendMode(Phaser.BlendModes.ADD).setDepth(4.7).setScale(1.3);
                    this.tweens.add({ targets: s, x: t.x, y: t.y - 18, duration: 200, ease: 'Quad.easeIn',
                        onUpdate: () => CosmicSystem.puff(F.gold, s.x, s.y, 2, 0, Math.PI, 4, 26),
                        onComplete: () => { s.destroy(); this._csBurst(t.x, t.y - 18, 18, col.gold, 260); } });
                });
                this.showStatusText(cx, cy - 26, `ASTRAL ×${n}`, '#ffd060');
            } });
    }

    // A hit landed on an astral mark: pop it. Charge goes to the element you hold (POP_CUR of a
    // gem) and a little to every other (POP_OTHER); none to cosmic's (the stars are its share).
    // Doubled during Ascend.
    _csAstralPop(enemy) {
        if (!enemy?._csAstral || !this.ultGems) return;
        enemy._csAstral = false;
        const C = this._csCfg().ASTRO, col = this._csCfg().COL, max = this.ultChargeMax, k = this._csAscending() ? 2 : 1;
        this._cs.popping = true;   // (gainUltCharge passes every gain on to the cosmic gem: 1.25x the pop, more than the gem you hold got)
        try { for (const el of ['fire', 'ice', 'lightning']) this.gainUltCharge(max * (el === this.currentElement ? C.POP_CUR : C.POP_OTHER) * k, el, true); }
        finally { this._cs.popping = false; }
        const x = enemy.sprite?.x ?? enemy.container?.x, y = (enemy.sprite?.y ?? enemy.container?.y) - 18;
        if (x === undefined) return;
        // a chain of pops climbs the scale and grows a little each time
        const S = this._cs, now = this.time.now;
        S.popN = now - (S.popAt || -1e9) < 1400 ? (S.popN || 0) + 1 : 0; S.popAt = now;
        Sfx.play(this, 'astropop', { n: S.popN });
        this._csPopFx(x, y, Math.min(1.6, 1 + S.popN * 0.08));
        // its ring flies off spinning, instead of vanishing
        const r = S.astral?.get(enemy);
        if (r?.active) { S.astral.delete(enemy); r.anims.timeScale = 3; this.tweens.add({ targets: r, scale: r.scale * 2.2, alpha: 0, duration: 320, ease: 'Quad.easeOut', onComplete: () => r.destroy() }); }
        this.showStatusText(x, y - 14, `+${Math.round(C.POP_CUR * 100 * k)}%`, '#ffd060');
    }

    // The pop: the hand-drawn gold star bursting open and breaking into sparks, gold thrown out and falling, a flash,
    // and three motes of gold that fly up to the fire, ice and lightning gems and flash them.
    _csPopFx(x, y, s = 1) {
        const ADD = Phaser.BlendModes.ADD, col = this._csCfg().COL, F = CosmicSystem.fx(this);
        const b = this.add.sprite(x, y, 'fx_cosmic', 'pop_0').setScale(1.6 * s).setBlendMode(ADD).setDepth(4.5).play('csw_pop');
        b.once('animationcomplete', () => b.destroy());
        CosmicSystem.puff(F.gold, x, y, Math.round(14 * s), 0, Math.PI, 40, 120 * s);
        F.glow.emitParticleAt(x, y, 2);
        this._vfxFlash?.(x, y, 60 * s, col.gold, 260, 0.8);
        this.cameras.main.shake(40, 0.0015 * s);
        // the charge it gives, flying to the gems (they're on the HUD camera, so the motes start where the pop is on screen)
        const cam = this.cameras.main, z = cam.zoom || 1, ox = cam.width * cam.originX, oy = cam.height * cam.originY;
        const sx = cam.x + ox + z * (x - cam.scrollX - ox), sy = cam.y + oy + z * (y - cam.scrollY - oy);
        for (const u of (this._ultGemUI || []).filter(u => u.el !== 'cosmic')) {
            const m = this.add.image(sx, sy, 'vfx_dot').setScrollFactor(0).setDepth(45).setTint(col.gold).setBlendMode(ADD).setScale(1.2);
            const f = { t: 0 }, cx = (sx + u.x) / 2 + (Math.random() - 0.5) * 200, cy = Math.min(sy, u.y) - 80 - Math.random() * 80;
            this.tweens.add({ targets: f, t: 1, duration: 520 + Math.random() * 160, ease: 'Quad.easeIn', onUpdate: () => {
                const t = f.t, it = 1 - t; m.setPosition(it * it * sx + 2 * it * t * cx + t * t * u.x, it * it * sy + 2 * it * t * cy + t * t * u.y).setScale(1.2 - t * 0.5);
            }, onComplete: () => { m.destroy(); if (this._ultFlashUntil) this._ultFlashUntil[u.el] = this.time.now + 160; } });
        }
    }

    // The astral marks: a gold star turning (by its own frames) over each marked enemy until it's popped.
    _csUpdateAstral(now) {
        const S = this._cs;
        const live = new Set();
        const each = (e, x, y) => {
            if (!e || !e._csAstral) return;
            live.add(e);
            let r = S.astral.get(e);
            if (!r || !r.active) {
                // the mark lands (its shooting star strikes as it grows) with a chime; a soft gold light under it
                CosmicSystem.fx(this);
                r = this.add.sprite(x, y - 18, 'fx_cosmic', 'mark_0').setDepth(4.3).setScale(0).play({ key: 'csw_mark', startFrame: Math.floor(Math.random() * 4) });
                r._born = now; S.astral.set(e, r);
                const gl = this.add.image(x, y - 18, 'vfx_glow').setTint(0xffd060).setBlendMode(Phaser.BlendModes.ADD).setDepth(4.29).setScale(0).setAlpha(0.5);
                r._glow = gl; r.once('destroy', () => gl.destroy());
                Sfx.play(this, 'csplace', { gold: true });
            }
            // the mark: pulsing, now and then a glint of gold falling off it
            const age = now - r._born, grow = Math.min(1, Math.max(0, (age - 200) / 160)), p = 0.92 + 0.08 * Math.sin(now * 0.008);
            r.setPosition(Math.round(x), Math.round(y - 18)).setScale(1.5 * grow * p);
            r._glow.setPosition(x, y - 18).setScale(0.16 * grow * p);
            if (grow >= 1 && Math.random() < 0.03) CosmicSystem.fx(this).gold.emitParticleAt(x + (Math.random() - 0.5) * 10, y - 18 + (Math.random() - 0.5) * 8, 1);
        };
        for (const e of this.enemies || []) if (e.sprite?.active) each(e, e.sprite.x, e.sprite.y);
        for (const b of [this.voltslimeBoss, this.voidSovereignBoss, this.fractureCore]) if (b?.active && b.container) each(b, b.container.x, b.container.y - 20);
        for (const [e, r] of S.astral) if (!live.has(e)) { r?.destroy(); S.astral.delete(e); }
    }

    // The staff fires a beam at the spot you clicked: it goes through walls but stops short of a room
    // you haven't opened, Hexes what it touches for a second, and where it ends the well opens.
    _csWell(wx, wy) {
        const S = this._cs, C = this._csCfg().WELL, now = this.time.now, T = this.TILE_SIZE;
        const px = this.playerX, py = this.playerY;
        let tx = Math.floor(wx / T), ty = Math.floor(wy / T);
        const d = Math.hypot(tx - px, ty - py);
        if (d > C.RANGE) { tx = Math.round(px + (tx - px) * C.RANGE / d); ty = Math.round(py + (ty - py) * C.RANGE / d); }
        // walk the line out: the last open floor before the end, or before a sealed room
        const n = Math.max(1, Math.ceil(Math.hypot(tx - px, ty - py) * 3));
        let end = { x: px, y: py };
        for (let k = 1; k <= n; k++) {
            const x = Math.round(px + (tx - px) * k / n), y = Math.round(py + (ty - py) * k / n);
            if (this.isInLockedRoom?.(x, y)) break;
            if (this.world?.[x]?.[y] === this.FLOOR) end = { x, y };
        }
        if (S.wellBeam) S.wellBeam.g?.destroy();
        const tip = typeof CreatureFX !== 'undefined' ? CreatureFX.gearTip?.(this) : null;   // it leaves from the staff's head
        const x0 = tip?.x ?? this.player.x, y0 = tip?.y ?? this.player.y - 6, x1 = end.x * T + T / 2, y1 = end.y * T + T / 2;
        // the seed: a little black hole, its disk turning (hand-drawn frames), a violet light round it
        CosmicSystem.fx(this);
        const seed = this.add.sprite(x0, y0, 'fx_cosmic', 'seed_0').setDepth(3.4).setScale(1.3).play('csw_seed');
        const glow = this.add.image(x0, y0, 'vfx_glow').setTint(this._csCfg().COL.violet).setBlendMode(Phaser.BlendModes.ADD).setDepth(3.39).setScale(0.22).setAlpha(0.75);
        seed.once('destroy', () => glow.destroy());
        S.wellBeam = { x0, y0, x1, y1, tx: end.x, ty: end.y, t0: now, dur: Math.max(260, Math.hypot(x1 - x0, y1 - y0) / (C.BEAM_SPEED * T) * 1000 * 1.7), hit: new Set(), g: seed, glow };
        this._csBurst?.(x0, y0, 10, this._csCfg().COL.lilac, 200);   // a flare at the staff's head as it lets go
        Sfx.play(this, 'csbeam');
        return true;
    }
    _csUpdateWellBeam(now) {
        const S = this._cs, B = S.wellBeam;
        if (!B) return;
        const C = this._csCfg().WELL, T = this.TILE_SIZE, u = Math.min(1, (now - B.t0) / B.dur);
        // a seed of the well: it leaves the staff slowly and accelerates in (eased by u^2.4), shedding a trail of dust
        // that streams longer as it gathers speed, motes falling into it from round about
        const at = v => { const e = Math.pow(Math.max(0, v), 2.4); return [B.x0 + (B.x1 - B.x0) * e, B.y0 + (B.y1 - B.y0) * e]; };
        const [hx, hy] = at(u), F = CosmicSystem.fx(this);
        const L = Math.hypot(B.x1 - B.x0, B.y1 - B.y0) || 1, nx = (B.x1 - B.x0) / L, ny = (B.y1 - B.y0) / L, back = Math.atan2(-ny, -nx);
        const speed = 2.4 * Math.pow(u, 1.4);
        B.g.setPosition(Math.round(hx), Math.round(hy)); B.glow.setPosition(hx, hy);
        CosmicSystem.puff(F.dust, hx - nx * 5, hy - ny * 5, 1 + Math.round(speed), back, 0.3, 10 + 40 * speed, 30 + 90 * speed, 260);
        CosmicSystem.puff(F.fine, hx, hy, 1, back, Math.PI, 4, 20);
        if (Math.random() < 0.5) { const a = Math.random() * Math.PI * 2; CosmicSystem.puff(F.fine, hx + Math.cos(a) * 14, hy + Math.sin(a) * 14, 1, a + Math.PI, 0.05, 80, 90, 160); }
        for (const e of this.enemies || []) {
            if (this._phasedOut?.(e)) continue;
            if (!e.sprite?.active || e.health <= 0 || B.hit.has(e)) continue;
            if (Math.hypot(e.sprite.x - hx, e.sprite.y - hy) > T * 0.75) continue;
            B.hit.add(e); this._csHex(e, C.BEAM_HEX_MS);
        }
        if (u >= 1) { B.g.destroy(); S.wellBeam = null; this._csWellOpen(B.tx, B.ty); }
    }
    _csWellOpen(tx, ty) {
        const S = this._cs, C = this._csCfg().WELL, col = this._csCfg().COL, now = this.time.now, T = this.TILE_SIZE;
        if (S.well) this._csWellEnd(true);
        const x = tx * T + T / 2, y = ty * T + T / 2;
        const shade = this.add.image(x, y, 'vfx_glow').setTint(0x000000).setDepth(0.95).setScale(0.75).setAlpha(0.7);
        const glow = this.add.image(x, y, 'vfx_glow').setTint(col.violet).setBlendMode(Phaser.BlendModes.ADD).setDepth(0.96).setScale(0).setAlpha(0.7);
        // its heart (hand-drawn: black, its photon ring shimmering), and the swirl of dust wheeling into it from its reach
        CosmicSystem.fx(this);
        const disk = this.add.sprite(x, y, 'fx_cosmic', 'core_0').setDepth(0.985).setScale(0.1).play('csw_core');
        const ring = CosmicSystem.swirl(this, x, y);
        this.tweens.add({ targets: disk, scale: 1.4, duration: 320, ease: 'Back.easeOut' });
        this.tweens.add({ targets: glow, scale: 0.85, duration: 320 });
        S.well = { tx, ty, x, y, t0: now, until: now + C.MS, tickAt: now + 250, shade, glow, disk, ring, r: C.RADIUS * C.GROW_FROM };
        S.horizonUntil = Math.max(S.horizonUntil, now + C.MS + C.AFTER);
        this._csCastFx('EVENT HORIZON', col.violet);
        this.cameras.main.shake(70, 0.003);
        return true;
    }

    _csWellEnd(quiet) {
        const S = this._cs, W = S?.well;
        if (!W) return;
        S.well = null;
        const parts = [W.shade, W.glow, W.disk];
        if (quiet) { parts.forEach(o => o?.destroy()); W.ring?.destroy(); return; }
        this.tweens.add({ targets: W.disk, scale: 0, duration: 260, ease: 'Back.easeIn' });
        this.tweens.add({ targets: [W.shade, W.glow], alpha: 0, duration: 300, onComplete: () => parts.forEach(o => o?.destroy()) });
        this.time.delayedCall(1600, () => W.ring?.destroy());   // (the swirl's last dust falls in first)
        // it collapses: dust from all round its reach snaps into the heart, it bursts, and everything still inside is dazed for a moment
        const C = this._csCfg().WELL, T = this.TILE_SIZE, now = this.time.now, F = CosmicSystem.fx(this), R = W.r * T;
        for (let i = 0; i < 32; i++) {
            const a = (i + Math.random() * 0.5) / 32 * Math.PI * 2, p = F.dust.emitParticleAt(W.x + Math.cos(a) * R, W.y + Math.sin(a) * R * 0.6, 1);
            if (p) { p.velocityX = -Math.cos(a) * R / 0.24; p.velocityY = -Math.sin(a) * R * 0.6 / 0.24; p.life = p.lifeCurrent = 240; }
        }
        this.time.delayedCall(240, () => {
            this._vfxFlash?.(W.x, W.y, R, this._csCfg().COL.violet, 300, 0.8);
            CosmicSystem.puff(F.dust, W.x, W.y, 16, 0, Math.PI, 30, 130);
            CosmicSystem.puff(F.fine, W.x, W.y, 10, 0, Math.PI, 10, 60);
        });
        this.cameras.main.shake(90, 0.004);
        for (const e of this.enemies || []) {
            if (this._phasedOut?.(e)) continue;
            if (!e.sprite?.active || e.health <= 0 || Math.hypot(e.x - W.tx, e.y - W.ty) > W.r + 0.01) continue;
            e.isStunned = true; e.stunnedUntil = Math.max(e.stunnedUntil || 0, now + C.END_DAZE_MS);
            this.showStatusText(e.sprite.x, e.sprite.y - 10, 'DAZED', '#d8a8ff');
        }
    }

    // ── VOID BLADE: CHARGE ───────────────────────────────────────────────────
    // Hold to charge, release to cut toward the cursor, at any angle. The longer you hold
    // (up to HOLD_MAX), the longer the cut (TILES → TILES_MAX), the wider, the harder, and the
    // longer the stun (STUN → STUN_MAX, on a curve that rewards holding to the end). While
    // charging you move slowly, the camera leans in on you, and the blade in your hand grows.
    // The cut leaves cosmic fluid on every tile it crossed, appearing from you outward and
    // drying up in the same order (_csUpdateFluid); standing in it Hexes (_csHex).
    _csBladeCharge() {
        const S = this._cs;
        if (S.blade) return;
        // the blade in your hand, growing (hand-drawn, pointed the nearest of eight ways), a Hex-pink glow round it; the
        // preview's tile markers (g)
        CosmicSystem.fx(this);
        const big = this.add.sprite(this.player.x, this.player.y, 'fx_cosmic', 'blade_e').setDepth(this.player.depth + 0.05);
        const halo = this.add.sprite(this.player.x, this.player.y, 'fx_cosmic', 'blade_e').setTintFill(this._csCfg().COL.hex).setBlendMode(Phaser.BlendModes.ADD).setDepth(this.player.depth + 0.04);
        S.blade = { start: this.time.now, g: this.add.container(0, 0).setDepth(1.2), z0: this.cameras.main.zoom, big, halo, snd: Sfx.charge(this, 'blade') };
        Music.duck(true);   // the music drops out while it builds
    }
    _csBladeF(now) { return Math.min(1, (now - this._cs.blade.start) / this._csCfg().BLADE.HOLD_MAX); }
    _csBladeShape(f) {
        const C = this._csCfg().BLADE;
        return { len: C.TILES + (C.TILES_MAX - C.TILES) * Math.pow(f, 0.8), hw: C.W0 + (C.W1 - C.W0) * f,
                 stun: C.STUN + (C.STUN_MAX - C.STUN) * Math.pow(f, C.STUN_CURVE), dmg: C.DMG + (C.DMG_MAX - C.DMG) * f };
    }
    // The tiles a cut from you toward (wx, wy) covers at charge f, in order out from you: every
    // tile within the cut's half-width of its line, which a wall ends.
    _csBladeTiles(wx, wy, f) {
        const T = this.TILE_SIZE, sh = this._csBladeShape(f);
        const px = this.playerX + 0.5, py = this.playerY + 0.5;
        let dx = wx / T - px, dy = wy / T - py;
        const L = Math.hypot(dx, dy) || 1; dx /= L; dy /= L;
        const seen = new Set(), tiles = [];
        let reach = 0;
        // Rays from you: a band of parallel ones (the cut's width), spread into a fan by Fan Cut.
        // Each runs the full length and stops at its own wall, so a pillar ahead blocks only the
        // part of the sweep behind it (it used to end the whole cut).
        const fan = Math.atan(this._csCfg().BLADE.FAN), spanTiles = sh.hw + Math.tan(fan) * sh.len;
        const rays = Math.max(3, Math.ceil(spanTiles * 2 / 0.4));
        for (let r = 0; r < rays; r++) {
            const u = rays === 1 ? 0 : r / (rays - 1) * 2 - 1;   // -1..1 across the cut
            const a = u * fan, rdx = dx * Math.cos(a) - dy * Math.sin(a), rdy = dx * Math.sin(a) + dy * Math.cos(a);
            const ox = px - dy * u * sh.hw, oy = py + dx * u * sh.hw;
            for (let d = 0.5; d <= sh.len; d += 0.25) {
                const x = Math.floor(ox + rdx * d), y = Math.floor(oy + rdy * d), k = x + ',' + y;
                if (this.world?.[x]?.[y] !== this.FLOOR || this.isInLockedRoom?.(x, y)) break;
                if (u === 0 || Math.abs(u) < 1 / rays) reach = Math.max(reach, d);
                if (seen.has(k) || (x === this.playerX && y === this.playerY)) continue;
                seen.add(k); tiles.push({ x, y, d });
            }
        }
        tiles.sort((a, b) => a.d - b.d);
        return { tiles, dx, dy, len: reach || sh.len * 0.25, fan };
    }
    // Every frame while charging: the preview, the slowing, the lean-in, the growing blade.
    _csUpdateBlade(now) {
        const S = this._cs, B = S.blade;
        if (!B) return;
        if (this.currentElement !== 'cosmic' || this._csWeapon() !== 'void_blade') { this._csBladeDrop(); return; }
        if (!this.isPointerDown) { this._csRelease(); return; }   // a release we didn't hear
        const C = this._csCfg().BLADE, col = this._csCfg().COL, T = this.TILE_SIZE, cam = this.cameras.main, p = this.player;
        const f = this._csBladeF(now), ap = this._aim(this.input.activePointer);
        const { tiles, dx, dy } = this._csBladeTiles(ap.x + cam.scrollX, ap.y + cam.scrollY, f);
        // the preview: a marker on every tile the cut will take, pulsing out along it, white at a full charge
        while (B.g.list.length < tiles.length) B.g.add(this.add.image(0, 0, 'fx_cosmic', 'aim_0').setBlendMode(Phaser.BlendModes.ADD));
        B.g.list.forEach((m, i) => {
            const t = tiles[i];
            if (!t) { m.setVisible(false); return; }
            m.setVisible(true).setFrame(f >= 1 ? 'aim_1' : 'aim_0').setPosition(t.x * T + T / 2, t.y * T + T / 2).setScale(T / 24)
             .setAlpha(0.3 + 0.35 * f + 0.25 * Math.sin(now * 0.01 - t.d * 0.8));
        });
        cam.setZoom(B.z0 * (1 + C.ZOOM * f));
        B.snd?.set(f);
        // the blade: its grip in your hand, pointed the nearest of the eight ways to your aim
        const ang = Math.atan2(dy, dx), sc = 1.2 + 1.1 * f, [d, fl] = CosmicSystem.way(ang), snap = Math.round(ang / (Math.PI / 4)) * (Math.PI / 4);
        const ux = Math.cos(snap), uy = Math.sin(snap), bx = p.x + ux * (6 + 11 * sc), by = p.y + 4 + uy * (6 + 11 * sc);
        for (const [s, k] of [[B.big, 1], [B.halo, 1.15]]) s?.setFrame('blade_' + d).setFlip(!!fl, !!fl).setPosition(Math.round(bx), Math.round(by)).setScale(sc * k);
        B.halo?.setAlpha(0.25 + 0.35 * f + 0.15 * Math.sin(now * 0.02));
        const F = CosmicSystem.fx(this);
        if (Math.random() < 0.3 + 0.7 * f) {   // the void drawn in to it
            const a = Math.random() * Math.PI * 2, r = 26 + Math.random() * 24, sx = bx + Math.cos(a) * r, sy = by + Math.sin(a) * r, q = F.pink.emitParticleAt(sx, sy, 1);
            if (q) { q.velocityX = (bx - sx) / 0.3; q.velocityY = (by - sy) / 0.3; q.life = q.lifeCurrent = 300; }
        }
        if (Math.random() < f) { const k = (Math.random() * 2 - 1) * 11 * sc; F.fine.emitParticleAt(bx + ux * k, by + uy * k - 2, 1); }   // and glittering along its edge
        if (f >= 1 && !B.full) { B.full = true; this._vfxFlash?.(p.x, p.y, 70, col.hex, 200, 0.7); Sfx.play(this, 'ready'); }
    }
    _csBladeDrop() {
        const S = this._cs, B = S?.blade;
        if (!B) return;
        this.cameras.main.setZoom(B.z0);
        B.g?.destroy(); B.big?.destroy(); B.halo?.destroy();
        B.snd?.stop(); Music.duck(false);
        S.blade = null;
    }
    // The button came up: cut with whatever charge built up.
    _csRelease() {
        const S = this._cs, B = S?.blade;
        if (!B) return;
        const C = this._csCfg().BLADE, now = this.time.now, cam = this.cameras.main, f = this._csBladeF(now);
        this._csBladeDrop();
        if (f > 0.5) Sfx.play(this, 'cslam', { gold: f >= 1 });   // a heavy cut lands with weight
        const ap = this._aim(this.input.activePointer);
        this._csBlade(ap.x + cam.scrollX, ap.y + cam.scrollY, f);
        S.cdUntil = now + C.CD;
        S.castAt = now;
        this._gearFiredAt = now;   // the held weapon swings now (Creatures.gear)
    }

    _csBlade(wx, wy, f = 0) {
        const S = this._cs, C = this._csCfg().BLADE, col = this._csCfg().COL, now = this.time.now, T = this.TILE_SIZE;
        Sfx.play(this, 'w_void_blade');
        const px = this.playerX * T + T / 2, py = this.playerY * T + T / 2;
        const sh = this._csBladeShape(f);
        const { tiles, dx, dy, len } = this._csBladeTiles(wx, wy, f);
        const dmg = sh.dmg * (this.damageScaling || 1);
        for (const t of tiles) {
            for (const e of [...(this.enemies || [])]) {
                if (e.x !== t.x || e.y !== t.y || !e.sprite?.active) continue;
                this.damageEnemy(e, dmg, 'cosmic');
                if (this._dmgLanded && e.health > 0) {
                    e.isStunned = true;
                    e.stunnedUntil = Math.max(e.stunnedUntil || 0, now + sh.stun);
                    this._showStunIndicator?.(e);
                }
            }
            const portal = this.getPortalAt?.(t.x, t.y);
            if (portal) this.damagePortal(portal, dmg);
            this.damageBossAtTile(t.x, t.y, dmg, 'void_blade', 'cosmic');
        }
        // the fluid: each tile wells up in turn out from you, and dries in the same order
        // the longer the charge, the longer it stays, on the stun's curve
        const life = C.FLUID_MS + (C.FLUID_MAX - C.FLUID_MS) * Math.pow(f, C.STUN_CURVE);
        if (!S.fluid) S.fluid = [];
        const hexMs = C.HEX_BLADE_MS + (C.HEX_BLADE_MAX - C.HEX_BLADE_MS) * Math.pow(f, C.STUN_CURVE);
        for (const t of tiles) S.fluid.push({ x: t.x, y: t.y, t0: now + t.d * C.CASCADE_MS, t1: now + t.d * C.CASCADE_MS + life, img: null, hexMs });
        // the tray's bar: from now until the last tile dries
        S.fluidSpan = { from: now, to: Math.max(S.fluidSpan?.to || 0, ...S.fluid.map(t => t.t1)) };
        // the cut: the hand-drawn crescent sweeping out along the line (the nearest of eight ways), two fainter ones after
        // it, shedding void dust across the cut's whole width and Hex sparks behind it; an afterimage of you at its head
        const ang = Math.atan2(dy, dx), L = Math.max(1, len) * T, wide = 1 + sh.hw * 1.6, ADD = Phaser.BlendModes.ADD;
        const fan = Math.atan(C.FAN), F = CosmicSystem.fx(this), [d, fl] = CosmicSystem.way(ang), nx = -dy, ny = dx, half = (0.5 + sh.hw) * T;
        if (fan > 0.01) {   // Fan Cut: the blade sweeps across the whole fan, side to side, at full reach, dust off its edge
            const sweep = { u: 0 };
            this.tweens.add({ targets: sweep, u: 1, duration: 260 + 4 * len, ease: 'Cubic.easeOut', onUpdate: () => {
                const a1 = ang - fan + 2 * fan * sweep.u, c = Math.cos(a1), sn = Math.sin(a1);
                for (let k = 0; k < 5; k++) { const r = L * (0.3 + Math.random() * 0.7); CosmicSystem.puff(F.dust, px + c * r, py - 4 + sn * r, 1, a1 + Math.PI / 2, 0.5, 10, 50); }
                CosmicSystem.puff(F.pink, px + c * L, py - 4 + sn * L, 2, a1, 0.6, 20, 70);
            } });
        }
        for (let i = 0; i < 3; i++) {
            const s = this.add.sprite(px, py - 4, 'fx_cosmic', `slash_${d}_0`).setFlip(!!fl, !!fl).setBlendMode(ADD).setDepth(4.4)
                .setAlpha(0.95 - i * 0.3).setScale((1.2 + 0.5 * wide) * (1 - i * 0.12));
            this.tweens.add({ targets: s, x: px + dx * L, y: py - 4 + dy * L, delay: i * 35, duration: 150 + 6 * len, ease: 'Cubic.easeOut',
                onUpdate: tw => {
                    s.setFrame(`slash_${d}_${tw.progress < 0.1 ? 0 : tw.progress < 0.75 ? 1 : 2}`);
                    if (i) return;
                    for (let k = 0; k < 3; k++) { const o = (Math.random() * 2 - 1) * half; CosmicSystem.puff(F.dust, s.x + nx * o, s.y + ny * o, 1, ang, 0.5, 10, 70); }
                    if (Math.random() < 0.7) { const o = (Math.random() * 2 - 1) * half * 0.7; CosmicSystem.puff(F.pink, s.x + nx * o, s.y + ny * o, 1, ang + Math.PI, 0.6, 10, 40); }
                },
                onComplete: () => { s.setFrame(`slash_${d}_3`); this.tweens.add({ targets: s, alpha: 0, duration: 160, onComplete: () => s.destroy() }); } });
        }
        if (this.player?.active) {
            const ghost = this.add.image(this.player.x, this.player.y, this.player.texture.key, this.player.frame.name)
                .setScale(this.player.scaleX, this.player.scaleY).setTint(col.hex).setAlpha(0.6).setBlendMode(Phaser.BlendModes.ADD).setDepth(this.player.depth - 0.01);
            this.tweens.add({ targets: ghost, x: px + dx * L * 0.8, y: this.player.y + dy * L * 0.8, alpha: 0, duration: 220, ease: 'Quad.easeOut', onComplete: () => ghost.destroy() });
        }
        this._vfxFlash?.(px + dx * L / 2, py + dy * L / 2, 80 + 60 * f, col.hex, 220, 0.8);
        this.cameras.main.shake(70 + 160 * f, 0.004 + 0.008 * f);
        this._csCastFx('COSMIC FLUID', col.hex);
        return true;
    }

    // The cosmic fluid, every frame: each tile appears at its t0 and dries at its t1; an enemy
    // in it gains a Hex stack on stepping in and every FLUID_TICK while it stays.
    _csUpdateFluid(now) {
        const S = this._cs, F = S.fluid;
        if (!F?.length) return;
        // (two hand-drawn tiles, one mirrored now and then, their stars twinkling all in step so a pool reads as one;
        // now and then a bubble of void rising off it)
        const C = this._csCfg().BLADE, T = this.TILE_SIZE, tw = Math.floor(now / 170) % 4, FX = CosmicSystem.fx(this);
        const wet = new Map();   // tile → its Hex length
        for (let i = F.length - 1; i >= 0; i--) {
            const t = F[i];
            if (now >= t.t1) {
                if (t.img) { const im = t.img; this.tweens.add({ targets: im, alpha: 0, scale: im.scale * 0.6, duration: 180, onComplete: () => im.destroy() }); }
                F.splice(i, 1); continue;
            }
            if (now < t.t0) continue;
            if (!t.img) {
                const h = Math.imul(t.x * 73 + 11, 0x9e3779b1) ^ Math.imul(t.y * 151 + 7, 0x85ebca6b);   // (which tile, mirrored or not, scrambled per tile: never a checkerboard)
                t.v = (h >>> 7) & 1 ? 'b' : 'a';
                t.img = this.add.image(t.x * T + T / 2, t.y * T + T / 2, 'fx_cosmic', `fluid_${t.v}_${tw}`).setFlipX(!!((h >>> 11) & 1)).setScale(T / 24).setDepth(0.92).setAlpha(0);
                t.tw = tw;
                this.tweens.add({ targets: t.img, alpha: 0.92, duration: 140 });
                if (Math.random() < 0.35) this._csBurst(t.x * T + T / 2, t.y * T + T / 2, 10, this._csCfg().COL.hex, 200);
            }
            if (t.tw !== tw && t.img.active) { t.tw = tw; t.img.setFrame(`fluid_${t.v}_${tw}`); }
            if (Math.random() < 0.006) CosmicSystem.puff(FX.pink, t.x * T + 3 + Math.random() * (T - 6), t.y * T + 3 + Math.random() * (T - 6), 1, -Math.PI / 2, 0.4, 8, 26);
            wet.set(t.x + ',' + t.y, t.hexMs);
        }
        for (const e of this.enemies || []) {
            if (!e.sprite?.active || e.health <= 0 || !wet.has(e.x + ',' + e.y)) continue;
            if (now - (e._csFluidAt ?? -1e9) < C.FLUID_TICK) continue;
            e._csFluidAt = now;
            this._csHex(e, wet.get(e.x + ',' + e.y));
        }
        for (const b of [this.voltslimeBoss, this.voidSovereignBoss]) {   // the story bosses stand in it too
            if (!b?.active || b._isInvulnerable || now - (b._csFluidAt ?? -1e9) < C.FLUID_TICK) continue;
            const k = [...wet.keys()].find(k => { const [x, y] = k.split(',').map(Number); return Math.abs(x - b.tileX) <= 1 && Math.abs(y - b.tileY) <= 1; });
            if (k) { b._csFluidAt = now; this._csHex(b, wet.get(k)); }
        }
    }

    // A tile of cosmic fluid from t0 for ms (an enemy in it gains Hex for hexMs). One a tile: a second just lengthens it.
    _csFluidTile(x, y, t0, ms, hexMs) {
        if (this.world?.[x]?.[y] !== this.FLOOR) return false;
        const S = this._cs, F = S.fluid ||= [];
        const old = F.find(t => t.x === x && t.y === y && t.t1 > t0);
        if (old) { old.t1 = Math.max(old.t1, t0 + ms); old.hexMs = Math.max(old.hexMs || 0, hexMs); return true; }
        F.push({ x, y, t0, t1: t0 + ms, hexMs });
        return true;
    }
    // Ascend's blast (it opens and closes with one): fluid cascading out from you in a ring, BLAST_R tiles, the near tiles first
    _csAscendBlast() {
        if (!this.player?.active) return;
        const C = this._csCfg().ASCEND, now = this.time.now, px = this.playerX, py = this.playerY, R = C.BLAST_R;
        for (let dx = -R; dx <= R; dx++) for (let dy = -R; dy <= R; dy++) {
            const d = Math.hypot(dx, dy); if (d > R + 0.4) continue;
            this._csFluidTile(px + dx, py + dy, now + d * C.CASCADE, C.FLUID_MS, C.HEX_MS);
        }
        // the wave front: a ring of Hex-pink dust riding the cascade out, violet dust a step behind it, a little gold
        const T = this.TILE_SIZE, x = this.player.x, y = this.player.y + 4, ms = R * C.CASCADE + 200, F = CosmicSystem.fx(this);
        CosmicSystem.ring(F.pink, x, y, R * T, ms, 84);
        CosmicSystem.ring(F.dust, x, y, R * T * 0.8, ms, 52);
        CosmicSystem.ring(F.gold, x, y, R * T * 0.55, ms * 0.8, 14);
        this.cameras.main.shake(180, 0.007); Sfx.play(this, 'whoosh');
    }
    // Every WAVE_EVERY while ascended: a WAVE_W-tile-wide wave of fluid rolls toward the crosshair, WAVE_LEN tiles,
    // each lane stopping at the first wall it meets
    _csAscendWave() {
        if (!this.player?.active) return;
        const C = this._csCfg().ASCEND, now = this.time.now, T = this.TILE_SIZE, cam = this.cameras.main;
        const ap = this._aim ? this._aim(this.input.activePointer) : this.input.activePointer;
        let dx = ap.x + cam.scrollX - (this.playerX * T + T / 2), dy = ap.y + cam.scrollY - (this.playerY * T + T / 2);
        const L = Math.hypot(dx, dy) || 1; dx /= L; dy /= L;
        const half = (C.WAVE_W - 1) / 2;
        for (let o = -half; o <= half; o++) {
            for (let k = 1; k <= C.WAVE_LEN; k++) {
                const x = Math.round(this.playerX + dx * k - dy * o), y = Math.round(this.playerY + dy * k + dx * o);
                if (!this._csFluidTile(x, y, now + k * C.WAVE_STEP, C.FLUID_MS, C.HEX_MS)) break;   // a wall: this lane stops
            }
        }
        this._csBurst(this.player.x + dx * T, this.player.y + dy * T, 50, this._csCfg().COL.hex, 260);
        Sfx.play(this, 'whoosh'); this.cameras.main.shake(90, 0.004);
    }

    // ── THE PENDULUM: THE CAST ───────────────────────────────────────────────
    // A click lays the Time Lock at the cursor (RANGE tiles at most, along the line out from you: the last open floor before a wall,
    // a sealed room or the edge of the view, so never through one). You fling the pendulum (assets/art/fx_pendulum): small,
    // its bob whirling on its chain (fly_0..15), on a curve onto the spot; there it rises a little and grows (grow_0, grow_1,
    // the big hang frames: typed bigger, never scaled), then drops onto the spot with a heavy thud, and the field snaps on.
    _csStasisCast(wx, wy) {
        const S = this._cs, C = this._csCfg().PEND, now = this.time.now, T = this.TILE_SIZE, px = this.playerX, py = this.playerY;
        if (S.fly) return false;
        let tx = Math.floor(wx / T), ty = Math.floor(wy / T);
        const d = Math.hypot(tx - px, ty - py);
        if (d > C.RANGE) { tx = Math.round(px + (tx - px) * C.RANGE / d); ty = Math.round(py + (ty - py) * C.RANGE / d); }
        const view = this.cameras.main.worldView, n = Math.max(1, Math.ceil(Math.hypot(tx - px, ty - py) * 3));
        let end = { x: px, y: py };
        for (let k = 1; k <= n; k++) {
            const x = Math.round(px + (tx - px) * k / n), y = Math.round(py + (ty - py) * k / n);
            if (this.world?.[x]?.[y] !== this.FLOOR || this.isInLockedRoom?.(x, y) || !view.contains(x * T + T / 2, y * T + T / 2)) break;
            end = { x, y };
        }
        const M = this._cfxGearState?.main, x0 = M?.visible ? M.x : this.player.x, y0 = M?.visible ? M.y : this.player.y - 10;
        const x1 = end.x * T + T / 2, y1 = end.y * T + T / 2, L = Math.hypot(x1 - x0, y1 - y0);
        const spr = this.add.sprite(x0, y0, 'fx_pendulum', 'fly_0').setDepth(4.6).setScale(1.5);
        const shadow = this.add.image(x0, y0 + 10, 'vfx_shadow').setDepth(0.97).setAlpha(0.45).setScale(0.16, 0.07);
        // where it'll land: the field's edge, faint, pulsing, from the click till the thud
        const T2 = this.TILE_SIZE, tiles = this._csStasisTiles(end.x, end.y), ghost = [];
        for (const k of tiles) {
            const [cx, cy] = k.split(',').map(Number), X = cx * T2 + T2 / 2, Y = cy * T2 + T2 / 2;
            for (const [dx, dy, side, ox, oy] of [[0, -1, 'n', 0, -10], [0, 1, 's', 0, 10], [-1, 0, 'w', -10, 0], [1, 0, 'e', 10, 0]])
                if (!tiles.has((cx + dx) + ',' + (cy + dy))) ghost.push(this.add.image(X + ox, Y + oy, 'fx_pendulum', 'edge_' + side).setDepth(0.945).setAlpha(0.25));
        }
        S.fly = { x0, y0, x1, y1, tx: end.x, ty: end.y, t0: now, spr, shadow, ghost, phase: 'wind', L };
        S.away = true;   // (the one in your hand is out there now: CreatureFX.gear hides it till it's back)
        return true;
    }
    // Where the bob's middle is below the pivot in each hanging frame (px, before the 1.5 it's drawn at)
    static BOB_AT = { grow_0: 7, grow_1: 16, hang: 48 };   // (the Reliquary's orb: its middle in grow_0, grow_1 and the big hanging frames)
    // THE THROW (PEND.THROW): a wind-up at your hand (it whirls faster and draws back), the fling on an arc that lands short
    // of the spot, bounces along the line to it (each lower and shorter, a puff and a tick where it touches), then it floats
    // up off the spot, grows (typed bigger frame by frame, never scaled) and drops with a heavy thud: the field opens then.
    _csFlyTick(now) {
        const S = this._cs, F = S.fly;
        if (!F) return;
        const B = CosmicSystem.BOB_AT, spr = F.spr, C = this._csCfg().PEND.THROW, t = now - F.t0;
        const at = f => [F.x0 + (F.x1 - F.x0) * f, F.y0 + (F.y1 - F.y0) * f];
        for (const g of F.ghost) g.setAlpha(0.18 + 0.12 * Math.sin(now / 120));
        let hopEnd = C.WIND;
        for (const [, ms] of C.HOPS) hopEnd += ms;
        if (t < C.WIND) {   // the wind-up: drawn back from the target, whirling ever faster
            const u = t / C.WIND, [bx, by] = at(-0.12 * u);
            spr.setPosition(Math.round(bx), Math.round(by - 4 * u)).setFrame('fly_' + (Math.floor(t * (1 + 2 * u) / 45) % 16));
            F.shadow.setPosition(bx, by + 10);
            return;
        }
        if (t < hopEnd) {   // the fling and its bounces: hop k from f0 to f1, its height h x the first
            let t0 = C.WIND, f0 = -0.12;
            for (const [f1, ms, h] of C.HOPS) {
                if (t < t0 + ms) {
                    const u = (t - t0) / ms, [gx, gy] = at(f0 + (f1 - f0) * u), H = h * Math.max(26, F.L * 0.35);
                    spr.setPosition(Math.round(gx), Math.round(gy - H * 4 * u * (1 - u))).setFrame('fly_' + (Math.floor(t / 35) % 16));
                    F.shadow.setPosition(gx, gy + 10).setScale(0.16 * (1 - 0.4 * 4 * u * (1 - u) * h), 0.07 * (1 - 0.4 * 4 * u * (1 - u) * h));
                    if (Math.random() < 0.6) CosmicSystem.pendFx(this).haze.emitParticleAt(spr.x, spr.y, 1);
                    break;
                }
                if (F.hop !== f1) {   // (it touched down: a puff of dust and a tick, once a landing)
                    F.hop = f1;
                    const [lx, ly] = at(f1);
                    CosmicSystem.puff(CosmicSystem.fx(this).dust, lx, ly + 6, 4 + Math.round(6 * h), 0, Math.PI, 15, 50);
                    Sfx.play(this, 'ptick');
                }
                t0 += ms; f0 = f1;
            }
            return;
        }
        // on the spot: it floats up (FLOAT), grows a frame at a time as it rises a little more (GROW), then drops (DROP)
        if (!F.landed) { F.landed = true; spr.setOrigin(0.5, 0); F.shadow.destroy(); }
        const u = t - hopEnd, RISE = 14, MORE = 6;
        let r, frame;
        if (u < C.FLOAT) { const k = u / C.FLOAT; r = RISE * (1 - (1 - k) * (1 - k)); frame = 'grow_0'; }
        else if (u < C.FLOAT + C.GROW) { const k = (u - C.FLOAT) / C.GROW; r = RISE + MORE * k; frame = k < 0.5 ? 'grow_1' : 'hang_2'; }
        else { const k = Math.min(1, (u - C.FLOAT - C.GROW) / C.DROP); r = (RISE + MORE) * (1 - k * k); frame = 'hang_2'; }
        spr.setFrame(frame).setPosition(Math.round(F.x1), Math.round(F.y1 - this._csCfg().PEND.HANG_UP * Math.min(1, u / (C.FLOAT + C.GROW)) - r - (B[frame] ?? B.hang) * 1.5));   // (rising to where it hangs, over the field's upper rows)
        if (u < C.FLOAT + C.GROW + C.DROP) return;
        S.fly = null;
        F.ghost.forEach(o => o.destroy());
        this._csStasisOpen(F.tx, F.ty, spr);
    }
    // The pendulum's light in flight: soft pieces of haze with no outline (fx_fractal's), lilac to deep violet, that run
    // together where they crowd into one smear behind it
    static pendFx(S) {
        if (S._csPendFx?.haze?.active) return S._csPendFx;
        const haze = S.add.particles(0, 0, 'fx_fractal', { frame: ['haze_0', 'haze_1', 'haze_2', 'haze_3', 'haze_4', 'haze_5'], emitting: false, blendMode: Phaser.BlendModes.ADD,
            lifespan: { min: 220, max: 380 }, speed: { min: 0, max: 12 }, scale: { start: 1.8, end: 0.9 }, alpha: { start: 0.5, end: 0 },
            color: [0xf0e4ff, 0xc8a0ff, 0x8a52e8, 0x3a1470], colorEase: 'quad.out' }).setDepth(4.55);
        return (S._csPendFx = { haze });
    }

    // ── THE PENDULUM: TIME LOCK ──────────────────────────────────────────────
    // The field (in the code still "stasis"), for TLOCK.MS: the tiles of a 7x7 with its corners cut (MASK) that can be
    // reached from the middle over open floor (a wall cuts it off), each lit (tile_0) with its edge drawn round them, the
    // big pendulum hanging over the middle swinging slowly and ticking. Inside it time stops for everything but you: what
    // stands on it is locked (_csLockOn, _csFieldAct), your shots and theirs stop where they reach it (_csLockShots), and
    // when it ends everything stored is let go at once (_csFieldRelease).
    _csStasisTiles(tx, ty) {
        const M = this._csCfg().PEND.MASK, h = (M.length - 1) / 2, inMask = (x, y) => M[y - ty + h]?.[x - tx + h] === '#', tiles = new Set([tx + ',' + ty]), q = [[tx, ty]];
        while (q.length) {
            const [x, y] = q.shift();
            for (const [nx, ny] of [[x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]]) {
                const k = nx + ',' + ny;
                if (tiles.has(k) || !inMask(nx, ny) || this.world?.[nx]?.[ny] !== this.FLOOR || this.isInLockedRoom?.(nx, ny)) continue;
                tiles.add(k); q.push([nx, ny]);
            }
        }
        return tiles;
    }
    _csStasisOpen(tx, ty, big = null) {
        const S = this._cs, C = this._csCfg().PEND, col = this._csCfg().COL, now = this.time.now, T = this.TILE_SIZE;
        if (S.stasis) this._csStasisEnd(true);
        const x = tx * T + T / 2, y = ty * T + T / 2, tiles = this._csStasisTiles(tx, ty), parts = [];
        for (const k of tiles) {
            const [cx, cy] = k.split(',').map(Number), X = cx * T + T / 2, Y = cy * T + T / 2;
            parts.push(this.add.image(X, Y, 'fx_pendulum', 'tile_0').setDepth(0.94).setFlip(Math.random() < 0.5, Math.random() < 0.5));
            for (const [dx, dy, side, ox, oy] of [[0, -1, 'n', 0, -10], [0, 1, 's', 0, 10], [-1, 0, 'w', -10, 0], [1, 0, 'e', 10, 0]])
                if (!tiles.has((cx + dx) + ',' + (cy + dy))) parts.push(this.add.image(X + ox, Y + oy, 'fx_pendulum', 'edge_' + side).setDepth(0.945));
        }
        const glow = this.add.image(x, y, 'vfx_glow').setTint(col.violet).setBlendMode(Phaser.BlendModes.ADD).setDepth(0.93).setScale(1.75).setAlpha(0.3);
        if (!big) big = this.add.sprite(x, 0, 'fx_pendulum', 'hang_2').setOrigin(0.5, 0).setDepth(4.6).setScale(1.5);
        big.setPosition(Math.round(x), Math.round(y - C.HANG_UP - CosmicSystem.BOB_AT.hang * 1.5)).setAlpha(0.9);
        if (!this.anims.exists('csw_pend')) this.anims.create({ key: 'csw_pend', frames: [0, 1, 2, 3, 4, 3, 2, 1].map(i => ({ key: 'fx_pendulum', frame: 'hang_' + i })), frameRate: 5, repeat: -1 });
        big.play({ key: 'csw_pend', startFrame: 2 });
        big.on('animationupdate', (a, fr) => { if (fr.textureFrame === 'hang_0' || fr.textureFrame === 'hang_4') Sfx.play(this, 'ptick'); });   // a tick at each end of its swing
        // the dust in it hangs where it is: motes that neither fall nor drift, only glint and go out
        const motes = this.add.particles(x, y, 'fx_cosmic', { frame: ['p_0', 'p_3', 'p_4', 'p_6', 'p_7', 'p_9'], blendMode: Phaser.BlendModes.ADD,
            emitZone: { type: 'random', source: new Phaser.Geom.Rectangle(-80, -82, 160, 160) }, frequency: 18, lifespan: { min: 700, max: 1500 }, speed: 0,
            alpha: { onEmit: () => 0, onUpdate: (p, k, t) => Math.sin(t * Math.PI) * 0.85 }, scale: 1.2, tint: [0xfff0b0, 0xe2c8ff, 0xffffff] }).setDepth(4.4);
        S.stasis = { tx, ty, x, y, tiles, t0: now, at: now, until: now + C.TLOCK.MS, parts, glow, big, motes, locked: new Map(), shots: [] };
        // the thud: the ground shakes, time ripples out from it (Rewind's ring thrown wide, soft haze, the dust kicked up)
        this.showStatusText(x, y - 64, 'TIME LOCK', '#ffe08a');
        this._vfxFlash?.(x, y, 90, col.gold, 240, 0.55);
        const ring = this.add.image(x, y, 'fx_pendulum', 'rw_ring').setDepth(4.5).setScale(1).setAlpha(0.9);
        this.tweens.add({ targets: ring, scale: 5.8, alpha: 0, duration: 460, ease: 'Quad.easeOut', onComplete: () => ring.destroy() });
        CosmicSystem.ring(CosmicSystem.pendFx(this).haze, x, y, T * 3.6, 420, 40, 18);
        CosmicSystem.ring(CosmicSystem.fx(this).dust, x, y + 6, T * 3.2, 360, 32, 8);
        this.cameras.main.shake(140, 0.006);
        Sfx.play(this, 'stasis');
    }
    // Every frame while it lies: whatever stands on it is locked (once locked it stays so till the end: it can't move off),
    // what it does to each, the shots it stops; in its last moments it flickers
    _csStasisTick(now) {
        const S = this._cs, F = S.stasis;
        if (!F) return;
        if (now >= F.until) { this._csStasisEnd(); return; }
        const dt = Math.max(0, now - F.at);
        F.at = now;
        for (const e of this.enemies || []) if (!F.locked.has(e) && e.sprite?.active && e.health > 0 && !this._phasedOut?.(e) && this._csInField(e)) this._csLockOn(e);
        for (const [e, L] of F.locked) this._csFieldAct(e, L, now, dt);
        this._csLockShots(now, dt);
        this._csBigFade(F);
        const a = F.until - now < 600 && Math.floor(now / 90) % 2 ? 0.5 : 1;
        if (a !== F.alpha) { F.alpha = a; for (const o of F.parts) o.setAlpha(a); }
    }
    // The big pendulum fades to FADE while you, an enemy or a shot is under it (its bob and its rod), so it never hides one
    _csBigFade(F) {
        const B = F.big, C = this._csCfg().PEND;
        if (!B?.active) return;
        const s = B.scaleY, top = B.y, bob = top + (CosmicSystem.BOB_AT.hang - 12) * s, bot = top + (CosmicSystem.BOB_AT.hang + 12) * s, x = B.x;
        const under = (px, py) => py > top && py < bot + 8 && Math.abs(px - x) < (py > bob - 4 ? 20 : 5) * s;
        let hit = this.player?.active && under(this.player.x, this.player.y);
        for (const e of this.enemies || []) if (!hit && e.sprite?.active && under(e.sprite.x, e.sprite.y)) hit = true;
        for (const list of [this.fireballs, this.iceShards, this.ballLightnings, this.ballSeekers, this.lightningOrbs, this.enemyProjectiles])
            for (const o of list || []) { const p = o.gfx || o.sprite; if (!hit && p?.active && under(p.x, p.y)) hit = true; }
        const want = hit ? C.FADE : 0.9;
        B.setAlpha(B.alpha + (want - B.alpha) * 0.25);
    }
    // Is e (an enemy, or a story boss by any tile of its 3x3) on the field?
    _csInField(e) {
        const F = this._cs?.stasis;
        if (!F || !e) return false;
        if (e.sprite || !e.container) return F.tiles.has(e.x + ',' + e.y);
        const T = this.TILE_SIZE, bx = Math.floor(e.container.x / T), by = Math.floor(e.container.y / T);
        return [-1, 0, 1].some(dx => [-1, 0, 1].some(dy => F.tiles.has((bx + dx) + ',' + (by + dy))));
    }
    // e steps into stopped time. Its health (and, unless it's a boss, its tile) can't be changed any more: what lowers it is
    // STORED (every hit, from anything), what raises it still lands; what moves it moves nothing. A boss isn't frozen solid:
    // its time only slows (TLOCK.BOSS_SLOW). Over it, the tally of what's stored.
    _csLockOn(e) {
        const F = this._cs.stasis, C = this._csCfg().PEND.TLOCK, now = this.time.now;
        const L = { boss: !!e.isBoss, h: e.health, stored: 0, stun: Math.max(0, (e.stunnedUntil || 0) - now), tw: this.tweens.getTweensOf(e.sprite) };
        Object.defineProperty(e, 'health', { configurable: true, enumerable: true, get: () => L.h, set: v => { if (v < L.h) L.stored += L.h - v; else L.h = v; } });
        if (L.boss) L.tw.forEach(t => { t.timeScale = 1 - C.BOSS_SLOW; });
        else {
            L.x = e.x; L.y = e.y; L.sx = e.sprite.x; L.sy = e.sprite.y;
            for (const k of ['x', 'y']) Object.defineProperty(e, k, { configurable: true, enumerable: true, get: () => L[k], set: () => {} });
            L.tw = L.tw.filter(t => t.isPlaying?.()); L.tw.forEach(t => t.pause());
            e.sprite.anims?.pause();
            e._tlock = L;   // (CreatureFX: no stun stars on it; its stun is only stopped time)
        }
        L.txt = this.add.text(e.sprite.x, e.sprite.y - 40, '', { fontSize: '12px', fontFamily: 'monospace', fontStyle: 'bold', color: '#ffe08a', stroke: '#1c1728', strokeThickness: 3 })
            .setOrigin(0.5).setDepth(5.6).setVisible(false);
        // its mark in the row of status pips over it (HUD._stackStatusIcons places the row): the stopped clock, its hand twitching
        if (!this.anims.exists('csw_tmark')) this.anims.create({ key: 'csw_tmark', frames: ['tmark_0', 'tmark_1'].map(frame => ({ key: 'fx_pendulum', frame })), frameRate: 3, repeat: -1 });
        L.mark = this.add.sprite(e.sprite.x, e.sprite.y - 30, 'fx_pendulum', 'tmark_0').setDepth(4.62).play('csw_tmark');
        e._tlMark = L.mark; e._tlTally = L.txt;
        F.locked.set(e, L);
    }
    // WHAT THE FIELD DOES to one locked enemy, each frame, for the dt that passed. The one place its effect lives: swap this
    // (and _csLockOn, _csFieldRelease) to change what the field is. Now: TIME LOCK. Every clock on it stands still (each of
    // its times, ...Until, ...At, ...Time, pushed on by dt; a boss's by BOSS_SLOW of it), so its ailments don't run down
    // (what they tick is stored like any hit) and whatever you put on it waits for time to start again; it holds still where
    // it was, stunned while time's stopped (no acting, casting or summoning); the tally shows.
    static HELD_SINCE = ['lastChillTime', '_csMarkAt', '_tbAt', 'lastBurnStackTime'];   // (chill's hold, cosmic marks, Frostbite's growth, Burn's last stack)
    _csFieldAct(e, L, now, dt) {
        const k = L.boss ? this._csCfg().PEND.TLOCK.BOSS_SLOW : 1, lo = now - 120000, hi = now + 600000;
        for (const key in e) {
            if (key === 'x' || key === 'y' || key === 'health') continue;
            const v = e[key];
            if (typeof v !== 'number') continue;
            // what's still to come waits (its ailments' ends, its stun, its own next move); a status counted from when it last
            // came holds its count (HELD_SINCE). A past "last hit at" is left alone: that's your weapon's, and it keeps hitting
            if ((v > now && v < hi && /(Until|At|Time)$/.test(key)) || (v > lo && v <= now && CosmicSystem.HELD_SINCE.includes(key))) e[key] = v + dt * k;
        }
        if (!L.boss && e.sprite?.active) {
            e.isStunned = true;
            if (!(e.stunnedUntil > now + 100)) e.stunnedUntil = now + 100;
            e.sprite.setPosition(L.sx, L.sy);
        }
        if (e.sprite?.active) L.mark.setX(Math.round(e.sprite.x));   // (its height: the status row, HUD._stackStatusIcons)
        if (L.stored > 0 && e.sprite?.active) {
            const n = String(Math.round(L.stored));
            if (L.txt.text !== n) { L.txt.setText(n).setVisible(true).setScale(1.35); this.tweens.add({ targets: L.txt, scale: 1, duration: 140 }); }
            L.txt.setX(Math.round(e.sprite.x));
        }
    }
    // Shots in flight (yours, and theirs) stop where they reach the field and hang there, their clocks stopped too; they go
    // on at the speed they had when it ends
    _csLockShots(now, dt) {
        const F = this._cs.stasis, T = this.TILE_SIZE, lo = now - 120000, hi = now + 600000;
        for (const list of [this.fireballs, this.iceShards, this.ballLightnings, this.ballSeekers, this.lightningOrbs, this.enemyProjectiles]) for (const o of list || []) {
            const p = o.gfx || o.sprite || o;
            if (typeof o.vx !== 'number' || !p || p.active === false) continue;
            if (!o.__tl) {
                if (!F.tiles.has(Math.floor(p.x / T) + ',' + Math.floor(p.y / T))) continue;
                o.__tl = { vx: o.vx, vy: o.vy }; o.vx = o.vy = 0; F.shots.push(o);
            }
            for (const key in o) { const v = o[key]; if (/(Until|At|Time|born|t0)$/.test(key) && typeof v === 'number' && v > lo && v < hi) o[key] = v + dt; }
        }
    }
    // The field ends: time starts again. Every locked enemy gets its health and tile back, then all it stored lands at once
    // (x REL_MUL: its tally bursting, the number, a kill, a split or a drop happening now), then what was put on it runs on
    // (its clocks were only held), then the stopped shots fly on. quiet: no show (the scene's going)
    _csFieldRelease(F, quiet) {
        const C = this._csCfg().PEND.TLOCK, now = this.time.now, Fx = quiet ? null : CosmicSystem.fx(this);
        for (const [e, L] of F.locked) {
            L.mark.destroy(); e._tlMark = e._tlTally = null;
            delete e.health; e.health = L.h;
            if (L.boss) L.tw.forEach(t => { t.timeScale = 1; });
            else {
                delete e.x; delete e.y; e.x = L.x; e.y = L.y; e._tlock = null;
                if (e.sprite?.active) { e.sprite.setPosition(L.sx, L.sy); e.sprite.anims?.resume(); }
                L.tw.forEach(t => t.isPaused?.() && t.resume());
                if (!(e.stunnedUntil - now > 150) && L.stun <= 150) { e.isStunned = false; e.stunnedUntil = now; }   // (the stun was only stopped time)
            }
        }
        for (const [e, L] of F.locked) {
            const d = L.stored * C.REL_MUL;
            if (!quiet && L.txt.visible) { this.tweens.add({ targets: L.txt, scale: 1.9, alpha: 0, y: L.txt.y - 10, duration: 320, ease: 'Quad.easeOut', onComplete: () => L.txt.destroy() }); }
            else L.txt.destroy();
            if (!(d > 0) || !e.sprite?.active || quiet === 'gone') continue;
            e.health -= d;
            if (!quiet) {
                this.showDamageNumber?.(e.sprite.x, e.sprite.y - 12, d, '#ffe08a');
                CosmicSystem.puff(Fx.gold, e.sprite.x, e.sprite.y - 4, 10, 0, Math.PI, 40, 160);
                this._vfxFlash?.(e.sprite.x, e.sprite.y, 40, 0xffe08a, 200, 0.6);
            }
            this.updateEnemyHealthBar?.(e);
            if (e.health <= 0) this.killEnemy(e);
        }
        for (const o of F.shots) if (o.__tl) { o.vx = o.__tl.vx; o.vy = o.__tl.vy; o.__tl = null; }
        F.locked.clear(); F.shots.length = 0;
    }
    _csStasisEnd(quiet) {
        const S = this._cs, F = S?.stasis;
        if (!F) return;
        S.stasis = null;
        this._csFieldRelease(F, quiet);
        F.motes.stop();
        const B = F.big;
        B.off('animationupdate');
        if (quiet) { [...F.parts, F.glow, B].forEach(o => o.destroy()); F.motes.destroy(); if (S && !S.fly) S.away = false; return; }
        this.tweens.add({ targets: [...F.parts, F.glow], alpha: 0, duration: 260, onComplete: () => [...F.parts, F.glow].forEach(o => o.destroy()) });
        this.time.delayedCall(1600, () => F.motes.destroy());
        CosmicSystem.puff(CosmicSystem.fx(this).fine, F.x, F.y, 14, 0, Math.PI, 10, 50);   // time going again: the hanging dust let go
        // the release: time cracks open across the field (fx_fractal's cracks of light, lilac), the clock's ring spun backwards
        for (let i = 0; i < 6; i++) {
            const [way, fx, fy] = [['e', 0, 0], ['ne', 0, 0], ['s', 0, 0], ['se', 0, 0], ['e', 1, 0], ['ne', 1, 1]][i], a = i / 6 * Math.PI * 2 + Math.random() * 0.4;
            const c = this.add.image(F.x + Math.cos(a) * 16, F.y + Math.sin(a) * 16, 'fx_fractal', 'crack_' + way).setFlip(!!fx, !!fy).setTint(0xe2c8ff).setBlendMode(Phaser.BlendModes.ADD).setDepth(0.96).setScale(1.5);
            this.tweens.add({ targets: c, alpha: 0, duration: 520, delay: 80, onComplete: () => c.destroy() });
        }
        this._csRewindRing(F.x, F.y, true).setScale(3);
        this._vfxFlash?.(F.x, F.y, 110, 0xffe08a, 260, 0.7);
        this.cameras.main.shake(160, 0.007);
        Sfx.play(this, 'shatter'); Sfx.play(this, 'rewind');
        // it shrinks back the way it grew, then flies home to your hand, whirling
        B.stop();
        const up = this._csCfg().PEND.HANG_UP, at = fr => B.setFrame(fr).setY(Math.round(F.y - up - CosmicSystem.BOB_AT[fr] * 1.5));
        at('grow_1');
        this.time.delayedCall(90, () => B.active && at('grow_0'));
        this.time.delayedCall(180, () => {
            if (!B.active) return;
            B.setOrigin(0.5).setFrame('fly_0').setY(F.y - up);
            const t0 = this.time.now, p = this.player;
            this.tweens.add({ targets: B, x: () => p?.x ?? B.x, y: () => (p?.y ?? B.y) - 10, duration: 260, ease: 'Quad.easeIn',
                onUpdate: () => B.setFrame('fly_' + (15 - Math.floor((this.time.now - t0) / 35) % 16)), onComplete: () => { B.destroy(); if (this._cs && !this._cs.fly) this._cs.away = false; } });
        });
    }

    // ── THE PENDULUM: REWIND (R) ─────────────────────────────────────────────
    // Every 50ms: where you are, your HP and which ailments are on you (FieldKit._playerAilments), kept for BACK_MS. A new
    // room (through a door, sealed or not), a lift or a fall starts it afresh: you can't rewind through one.
    _csRewindRecord(now) {
        const S = this._cs, C = this._csCfg().PEND, R = S.rw || (S.rw = { buf: [], room: null, pull: null });
        if (R.pull || !this.player?.active) return;
        const room = this.getCurrentPlayerRoom?.() ?? -1;
        if (room !== R.room || this._lifting || this._tutFalling || this._deathScreenActive) { R.buf.length = 0; R.room = room; }
        const last = R.buf[R.buf.length - 1];
        if (last && now - last.t < 50) return;
        const ail = (this._playerAilments?.() || []).filter(a => a[1](now)).map(a => a[0]);
        R.buf.push({ t: now, x: this.playerX, y: this.playerY, px: this.player.x, py: this.player.y, hp: this.health, ail });
        while (R.buf.length > 1 && now - R.buf[0].t > C.BACK_MS) R.buf.shift();
    }
    // R, holding the Pendulum: back to the furthest moment kept whose tile is still open, pulled back along the way you came
    // (afterimages of you strung out behind, a clock ring ticking backwards). The HP you've lost since comes back (a heal
    // since is never taken away) and every ailment you've picked up since goes. Ults, gadgets and stamina stay spent.
    _csRewind() {
        const S = this._cs, p = this.player;
        if (!S || this._csWeapon() !== 'pendulum' || !p?.active || this._deathScreenActive) return;
        const C = this._csCfg().PEND, now = this.time.now, R = S.rw;
        if (!R || R.pull) return;
        const say = (t, c = '#9a8cb8') => this.showStatusText(p.x, p.y - 30, t, c);
        if (now < S.cdUntil) { say(`${((S.cdUntil - now) / 1000).toFixed(1)}s`); Sfx.play(this, 'deny'); return; }   // (the cooldown the Time Lock shares)
        // what holds your dash holds this (a lift, the ice ult's shell, a story beat), except a root or a Glu: picked up since, it undoes them
        const L = this._actLocks || {};
        if (Object.entries(L).some(([id, k]) => id !== '#glued' && id !== '#rooted' && (k.until == null || now < k.until) && k.kinds.includes('dash'))) return this._actionDenied?.('dash');
        if (this._lifting || this._csTf() || this._iceShellUntil > now) { Sfx.play(this, 'deny'); return; }
        const free = s => this.world?.[s.x]?.[s.y] === this.FLOOR && !this.isInLockedRoom?.(s.x, s.y) && (!this.getEnemyAt?.(s.x, s.y) || (s.x === this.playerX && s.y === this.playerY));
        let i = 0;
        while (i < R.buf.length && !free(R.buf[i])) i++;
        const to = R.buf[i];
        if (!to || now - to.t < C.MIN_MS) { say('NOTHING TO REWIND'); Sfx.play(this, 'deny'); return; }
        S.cdUntil = now + C.REWIND_CD; S.cdMs = C.REWIND_CD; S.castAt = now;
        const path = [[p.x, p.y], ...R.buf.slice(i).reverse().map(s => [s.px, s.py])];
        const back = Math.min(this.maxHealth, Math.max(this.health, to.hp)) - this.health;
        this.health += back;
        for (const [k, on, clear] of this._playerAilments?.() || []) if (on(now) && !to.ail.includes(k)) clear(now);
        this.updateHUD?.();
        // your tile at once (what's after you has lost you), your body pulled back to it; nothing touches you on the way
        this.playerX = to.x; this.playerY = to.y; this._step = null; this._glide = null;
        this._glideUntil = Math.max(this._glideUntil || 0, now + C.PULL_MS);
        this._dashInvulnUntil = Math.max(this._dashInvulnUntil || 0, now + C.PULL_MS);
        R.buf.length = 0;
        R.pull = { path, t0: now, ms: C.PULL_MS, to, ghostAt: 0 };
        this._csRewindRing(p.x, p.y, true);
        say('REWIND', '#e2c8ff');
        if (back >= 1) this.showStatusText(p.x, p.y - 44, `+${Math.round(back)}`, '#9af0a8');
        Sfx.play(this, 'rewind');
    }
    _csRewindTick(now) {
        const R = this._cs.rw, P = R?.pull, p = this.player;
        if (!P) return;
        if (!p?.active) { R.pull = null; return; }
        if (this.playerX !== P.to.x || this.playerY !== P.to.y) {   // something else moved you on the way (a knock, a pull): it has you now
            R.pull = null;
            // ...but never leave your body where the pull had got to: back on your tile, unless a step or a dash is carrying it there
            if (!this._glide && !this._step) p.setPosition(this.playerX * this.TILE_SIZE + this.TILE_SIZE / 2, this.playerY * this.TILE_SIZE + this.TILE_SIZE / 2 + (this.SLIME_Y_OFFSET || 0));
            return;
        }
        const T = this.TILE_SIZE, u = Math.min(1, (now - P.t0) / P.ms), e = 1 - (1 - u) * (1 - u);   // fast away, easing in
        const k = e * (P.path.length - 1), i = Math.floor(k), f = k - i, a = P.path[i], b = P.path[Math.min(P.path.length - 1, i + 1)];
        p.setPosition(a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f);
        if (now >= P.ghostAt) {   // you, left behind on the way, fading
            P.ghostAt = now + 28;
            const g = this.add.sprite(p.x, p.y, p.texture.key, p.frame.name).setOrigin(p.originX, p.originY).setScale(p.scaleX, p.scaleY).setFlipX(p.flipX)
                .setTintFill(0xc8a8ff).setBlendMode(Phaser.BlendModes.ADD).setDepth((p.depth ?? 2) - 0.01).setAlpha(0.5);
            this.tweens.add({ targets: g, alpha: 0, duration: 340, onComplete: () => g.destroy() });
        }
        if (u < 1) return;
        R.pull = null;
        p.setPosition(P.to.x * T + T / 2, P.to.y * T + T / 2 + (this.SLIME_Y_OFFSET || 0));
        this._csRewindRing(p.x, p.y, false);
        this._vfxFlash?.(p.x, p.y, 60, this._csCfg().COL.lilac, 220, 0.6);
        CosmicSystem.puff(CosmicSystem.fx(this).dust, p.x, p.y + 2, 12, 0, Math.PI, 20, 90);
    }
    // Rewind's clock round you: its ring, and a glint ticking round it backwards (twelve ticks, from twelve o'clock)
    _csRewindRing(x, y, depart) {
        const ring = this.add.image(x, y + 2, 'fx_pendulum', 'rw_ring').setDepth(4.55).setScale(depart ? 1.5 : 0.7).setAlpha(0.95);
        this.tweens.add({ targets: ring, scale: depart ? 1.2 : 1.5, alpha: 0, duration: depart ? 520 : 420, ease: 'Quad.easeOut', onComplete: () => ring.destroy() });
        const E = CosmicSystem.fx(this).gold;
        for (let i = 0; i < 12; i++) this.time.delayedCall(i * 30, () => {
            if (!ring.active) return;
            const a = -Math.PI / 2 - i * Math.PI / 6, r = 13 * ring.scaleX, q = E.emitParticleAt(ring.x + Math.cos(a) * r, ring.y + Math.sin(a) * r, 1);
            if (q) { q.velocityX = q.velocityY = 0; q.life = q.lifeCurrent = 260; }
        });
        return ring;
    }

    // ── THE ULT ──────────────────────────────────────────────────────────────
    // From activateUlt (which has already emptied the gem). Ignores the shared lockout and
    // doesn't start it, so it can open a combo.
    _csAscend() {
        const S = this._cs;
        if (!S) return;
        const C = this._csCfg(), now = this.time.now, w = this._csWeapon();
        S.ascendAt = now;
        S.ascendUntil = now + C.ASCEND.MS * (this._mods?.ultLong || 1);   // Grand Overture runs it longer
        // stage 2: that was one of two layers; the other stays
        // (activateUlt has already emptied the gem: whatever layers sat above it drop down)
        if (this._csStage() >= 2) this._csSetLayers((S.layer2 >= 1 ? 1 : 0) + (S.layer3 >= 1 ? 1 : 0));
        // your boon, at full strength for the whole of it
        if (w === 'cosmic_fists') { S.momentum = C.FISTS.MAX; S.momentumAt = now; }
        if (w === 'barrier_staff') this._csRaiseWards(C.ASCEND.MS);
        // astrolabe: its pops are doubled while Ascend runs (_csAstralPop)
        if (w === 'singularity_staff') S.horizonUntil = Math.max(S.horizonUntil, S.ascendUntil);
        if (w === 'void_blade') S.retributionUntil = Math.max(S.retributionUntil, S.ascendUntil);
        this._csBanner('A S C E N D', C.COL.violet);
        S.ascendWaveAt = now + C.ASCEND.WAVE_EVERY; S.ascendTile = null;
        this._csHpBoost('ascend', C.ASCEND.HP);
        this._csAscendBlast();
        if (this.player?.active) {
            // a burst of light on you, and a column of stardust going up off you (the halo comes down: _csDrawFx)
            const x = this.player.x, y = this.player.y, F = CosmicSystem.fx(this);
            CosmicSystem.nova(this, x, y - 2, 1);
            CosmicSystem.ring(F.dust, x, y + 4, 90, 420, 24, 14);
            for (let i = 0; i < 28; i++) {   // (born up and down the column, not all on one spot)
                const E = i % 3 === 0 ? F.gold : i % 3 === 1 ? F.fine : F.dust;
                CosmicSystem.puff(E, x + (Math.random() - 0.5) * 16, y + 6 - Math.random() * 30, 1, -Math.PI / 2, 0.15, 70, 240, 500 + Math.random() * 300);
            }
            this._vfxFlash?.(x, y, 220, C.COL.violet, 600, 0.75);
        }
        this.cameras.main.shake(140, 0.006);
    }

    // When Ascend runs out: everything close takes a base hit plus a bonus per mark it carries,
    // (a Hex stack counts as a mark).
    _csSupernova() {
        if (this._ultHit !== 'cosmic' && this._asUlt) return this._asUlt('cosmic', () => this._csSupernova());   // ult damage
        const S = this._cs, C = this._csCfg().ASCEND, col = this._csCfg().COL, T = this.TILE_SIZE;
        if (!this.player?.active) return;
        const cx = this.player.x, cy = this.player.y, R = C.NOVA_R * T, ds = this.damageScaling || 1;
        S.nova = true;
        for (const e of [...(this.enemies || [])]) {
            if (!e.sprite?.active || e.health <= 0) continue;
            if (Math.hypot(e.sprite.x - cx, e.sprite.y - cy) > R) continue;
            const marks = (e._csHexUntil || 0) > this.time.now ? (e._csHexStacks || 0) : 0;   // a Hex stack a mark
            this.damageEnemy(e, (C.NOVA_BASE + C.NOVA_PER_MARK * marks) * ds, 'cosmic');
        }
        const bosses = [];
        const vb = this.voltslimeBoss, vs = this.voidSovereignBoss;
        if (vb?.active && vb.container) bosses.push([vb, vb.container.x, vb.container.y]);
        if (vs?.active && vs.container) bosses.push([vs, vs.container.x, vs.container.y + (this.SLIME_Y_OFFSET || 0)]);
        for (const [b, bx, by] of bosses) {
            if (Math.hypot(bx - cx, by - cy) > R + T * 1.5) continue;
            const marks = (b._csHexUntil || 0) > this.time.now ? (b._csHexStacks || 0) : 0;
            this.damageBossAtTile(Math.floor(bx / T), Math.floor(by / T), (C.NOVA_BASE + C.NOVA_PER_MARK * marks) * ds, 'nova', 'cosmic');
        }
        S.nova = false;
        // an implosion (the dust drawn in, the light pinched), then the blast: a burst of light, a rune circle thrown off,
        // rings of dust to its reach
        const F = CosmicSystem.fx(this);
        CosmicSystem.inward(F.dust, cx, cy, R * 0.8, 140, 26);
        const core = this.add.image(cx, cy, 'vfx_glow').setTint(col.lilac).setBlendMode(Phaser.BlendModes.ADD).setDepth(4.7).setScale(0.9).setAlpha(0.3);
        this.tweens.add({ targets: core, scale: 0.15, alpha: 0.9, duration: 140, ease: 'Quad.easeIn', onComplete: () => {
            core.destroy();
            if (!this._cs) return;
            CosmicSystem.nova(this, cx, cy, 2);
            CosmicSystem.stamp(this, cx, cy, R, col.lilac);
            CosmicSystem.ring(F.dust, cx, cy, R, 520, 44, R * 0.25);
            CosmicSystem.ring(F.pink, cx, cy, R * 0.85, 460, 30, R * 0.2);
            CosmicSystem.ring(F.gold, cx, cy, R * 0.6, 380, 18, R * 0.15);
            CosmicSystem.puff(F.fine, cx, cy, 16, 0, Math.PI, 30, 120, 500);
        } });
        this._vfxFlash?.(cx, cy, R * 1.6, col.lilac, 600, 0.8);
        this.cameras.main.shake(160, 0.008);
        this.showStatusText(cx, cy - 34, 'SUPERNOVA', '#f0dcff');
    }

    // ── STAGE 2: TWO LAYERS AND THE PARTIAL TRANSFORMATION ───────────────────
    // From stage 2 the gem holds layers (see LAYERS AND THE CHARGE):
    // V spends one on Ascend (with 20% damage reduction from this stage), two on the partial
    // transformation, three (stage 3) on the full one. A transformation runs:
    //   turn   1.5s rooted, no attacks, you can be hit
    //   aim    a 2.5-tile slam preview follows the cursor (8 tiles, open floor); click, or 3s
    //   drop   ~1s: you fade, a portal opens on the target, you fall out of it and slam
    //          (damage, 2s slow) and two voidlets step out
    //   form   6s of Twin Collapse in place of your attack, +0.5s per collapse that lands
    //          (+1s for 3+ hit), 15s at most. No element switching.
    // The voidlets (a Warrior and a Voidbeam) are allies (CombatSystem._addAlly): they have HP,
    // taunt what's near them, and last 10s.
    _csStage() { return this.ultStage_cosmic || 1; }
    _csTf() { return this._cs?.tf || null; }
    // Rooted: turning, aiming and dropping (the form itself moves freely).
    _csRooted() { const t = this._csTf(); return !!t && t.phase !== 'form'; }
    _csFormLock() { return !!this._csTf(); }

    // V pressed. True when it's handled here (the transformation, or deciding tap vs hold);
    // false to let castUlt do the usual.
    // ── LAYERS AND THE CHARGE ────────────────────────────────────────────────
    // From stage 2 the cosmic gem holds as many layers as your stage (2 or 3), 45s each: the
    // gem itself, then S.layer2, then S.layer3, each filling once the one before is full.
    // With two or more full, V doesn't cast at once: holding it fills the charge bar
    // (S.charge), and letting go decides. Before the halfway mark: Ascend (one layer). Past
    // it: the partial transformation (two). Held to the end (stage 3, three layers): the
    // full transformation, which goes off by itself as the bar fills, after a slow, heavy
    // last stretch and a white flash.
    _csMaxLayers() { return Math.min(3, this._csStage()); }
    _csLayers() {
        const S = this._cs;
        if (!S) return 0;
        return (this.ultGems?.cosmic >= this.ultChargeMax ? 1 : 0) + (S.layer2 >= 1 ? 1 : 0) + (S.layer3 >= 1 ? 1 : 0);
    }
    _csSetLayers(n) {
        const S = this._cs;
        if (!S || !this.ultGems) return;
        this.ultGems.cosmic = n >= 1 ? this.ultChargeMax : 0;
        S.layer2 = n >= 2 ? 1 : 0; S.layer3 = n >= 3 ? 1 : 0;
        if (this.currentElement === 'cosmic') this.ultCharge = this.ultGems.cosmic;
    }
    // A hit's ult charge (CombatSystem.gainUltCharge): the gem first, then each layer up to
    // your stage's. Nothing while sealed (Ascend running), transformed or charging.
    _csGainCharge(amt) {
        const S = this._cs, now = this.time.now, max = this.ultChargeMax;
        if (!S?.unlocked || !this.ultGems || S.tf || S.charge || S.popping || now < (this._ultNoChargeUntil?.cosmic || 0)) return;
        let left = amt * this._csCfg().CHARGE_SHARE;
        if (this.ultGems.cosmic < max) {
            const take = Math.min(left, max - this.ultGems.cosmic);
            this.ultGems.cosmic += take; left -= take;
            if (this.ultGems.cosmic >= max && this._ultReadyAt) this._ultReadyAt.cosmic = now;
            if (this.currentElement === 'cosmic') this.ultCharge = this.ultGems.cosmic;
        }
        for (const k of ['layer2', 'layer3'].slice(0, this._csMaxLayers() - 1)) {
            if (left <= 0) break;
            if (S[k] >= 1) continue;
            const take = Math.min(left / max, 1 - S[k]);
            S[k] += take; left -= take * max;
            if (S[k] >= 1 && this._ultReadyAt) this._ultReadyAt.cosmic = now;
        }
    }

    // V (or E, holding cosmic) pressed. True when it's handled here (the charge), false to let castUlt do the usual. `key`: which
    // one, so only its own release ends the charge
    _csVDown(key) {
        const S = this._cs;
        if (!S || this._csStage() < 2 || this.actionLocked?.('ult_cosmic')) return false;   // (locked: castUlt refuses it)
        if (S.tf || S.charge) return true;
        const n = this._csLayers();
        if (n < 2) return false;
        const cam = this.cameras.main;
        S.charge = { key, at: this.time.now, p: 0, cap: n >= 3 && this._csStage() >= 3 ? 1 : 0.5, half: false, dramatic: false, z0: cam.zoom, shakeAt: 0, snd: Sfx.charge(this) };
        Music.duck(true);
        return true;
    }
    // V (or E) released: what the bar reached decides.
    _csVUp(key) {
        const S = this._cs, ch = S?.charge;
        if (!ch || ch.key !== key) return;
        this._csChargeEnd();
        if (ch.p >= 0.5) this._csTfBegin(false);
        else this.castUlt('cosmic');   // Ascend, one layer (_csAscend keeps the rest)
    }
    // How far the bar is after `h` ms held: quick to halfway, steady to 80%, then a slow,
    // heavy crawl that speeds up into the flash.
    _csChargeAt(h) {
        const C = this._csCfg().CHARGE;
        if (h <= C.HALF_MS) return 0.5 * h / C.HALF_MS;
        if (h <= C.HALF_MS + C.MID_MS) return 0.5 + 0.3 * (h - C.HALF_MS) / C.MID_MS;
        return Math.min(1, 0.8 + 0.2 * Math.pow((h - C.HALF_MS - C.MID_MS) / C.END_MS, 1.6));
    }
    _csUpdateCharge(now, dt) {
        const S = this._cs, ch = S.charge;
        if (!ch) return;
        const col = this._csCfg().COL, p = this.player, cam = this.cameras.main;
        ch.p = Math.min(ch.cap, this._csChargeAt(now - ch.at));
        ch.snd?.set(ch.p);
        if (!ch.half && ch.p >= 0.5) { ch.half = true; Sfx.play(this, 'ready'); this._csBurst(p.x, p.y, 26, col.lilac, 260); }
        // void energy pouring in, faster the fuller it gets
        if (p?.active && Math.random() < dt / (30 - 20 * ch.p)) {
            const F = CosmicSystem.fx(this);
            CosmicSystem.inward(ch.p > 0.8 && Math.random() < 0.5 ? F.gold : F.dust, p.x, p.y, 40 + Math.random() * 40, 420 - 200 * ch.p, 1, 0.7);
        }
        // the last stretch: the world leans in, darkens and shakes
        if (ch.cap >= 1 && ch.p > 0.8) {
            const k = (ch.p - 0.8) / 0.2;
            if (!ch.dramatic) { ch.dramatic = true; Sfx.play(this, 'transform'); }
            cam.setZoom(ch.z0 * (1 + 0.08 * k));
            if (now >= ch.shakeAt) { ch.shakeAt = now + 90; cam.shake(110, 0.0015 + 0.006 * k); }
            if (this.textures.exists('vfx_edge')) {
                const W = this.scale.width, H = this.scale.height;
                ch.edge = ch.edge || this.add.image(W / 2, H / 2, 'vfx_edge').setDisplaySize(W, H).setScrollFactor(0).setDepth(28).setTint(0x1a0830);
                ch.edge.setAlpha(0.35 + 0.6 * k);
            }
            if (ch.p >= 1) {   // the burst, and the full transformation: gold light breaking out of you, its circle thrown wide
                if (p?.active) {
                    const F = CosmicSystem.fx(this);
                    CosmicSystem.nova(this, p.x, p.y - 2, 2, true);
                    CosmicSystem.stamp(this, p.x, p.y + 4, 90, col.gold);
                    CosmicSystem.ring(F.gold, p.x, p.y + 4, 120, 520, 40, 16);
                    this._vfxFlash?.(p.x, p.y, 200, col.gold, 500, 0.8);
                }
                Sfx.play(this, 'boom', { big: true });
                this._csChargeEnd();
                this._csTfBegin(true);
                return;
            }
        }
        this._csDrawCharge(now);
    }
    _csChargeEnd() {
        const S = this._cs, ch = S?.charge;
        if (!ch) return;
        this.cameras.main.setZoom(ch.z0);
        ch.snd?.stop(); Music.duck(false);
        ch.edge?.destroy();
        for (const o of ch.ui || []) o?.destroy?.();
        S.charge = null;
    }
    // The bar, over the ult gems: Ascend to the halfway notch, the partial transformation to
    // the end, and the last stretch (stage 3, three layers) to the full one. What you can't
    // reach yet is dark, with what it needs written on it.
    _csDrawCharge(now) {
        const ch = this._cs.charge, col = this._csCfg().COL, W = this.scale.width, H = this.scale.height;
        const bw = 320, bh = 12, x0 = W / 2 - bw / 2, y = H - 104;
        if (!ch.ui) {
            const g = this.add.graphics().setScrollFactor(0).setDepth(33);
            const lbl = (x, t) => this.add.text(x, y + 14, t, { fontSize: '10px', fontFamily: 'monospace', fontStyle: 'bold', color: '#d9c4ff', stroke: '#05060a', strokeThickness: 3 })
                .setOrigin(0.5, 0).setScrollFactor(0).setDepth(33);
            ch.ui = [g, lbl(x0 + bw * 0.22, 'ASCEND'), lbl(x0 + bw * 0.5, 'PARTIAL'), lbl(x0 + bw, ch.cap >= 1 ? 'FULL' : (this._csStage() >= 3 ? 'FULL · 3 LAYERS' : 'FULL · STAGE III'))];
            if (ch.cap < 1) ch.ui[3].setColor('#6a6286');
        }
        const g = ch.ui[0];
        g.clear();
        g.fillStyle(0x05060a, 0.85); g.fillRoundedRect(x0 - 4, y - 4, bw + 8, bh + 8, 6);
        g.fillStyle(0x1a1430, 1); g.fillRect(x0, y, bw, bh);
        if (ch.cap < 1) { g.fillStyle(0x0b0912, 1); g.fillRect(x0 + bw * ch.cap, y, bw * (1 - ch.cap), bh); }
        const f = bw * ch.p, gold = ch.p > 0.8;
        g.fillStyle(ch.p >= 0.5 ? col.violet : col.lilac, 1); g.fillRect(x0, y, Math.min(f, bw * 0.8), bh);
        if (gold) { g.fillStyle(col.gold, 0.7 + 0.3 * Math.sin(now * 0.03)); g.fillRect(x0 + bw * 0.8, y, f - bw * 0.8, bh); }
        g.fillStyle(0xffffff, 0.9); g.fillRect(x0 + f - 2, y - 2, 3, bh + 4);
        g.lineStyle(2, 0xffffff, ch.half ? 0.9 : 0.4); g.lineBetween(x0 + bw * 0.5, y - 5, x0 + bw * 0.5, y + bh + 5);
        g.lineStyle(1, col.gold, 0.5); g.lineBetween(x0 + bw * 0.8, y - 2, x0 + bw * 0.8, y + bh + 2);
        g.lineStyle(1, ch.p >= 0.5 ? col.violet : 0x2b3256, 1); g.strokeRect(x0 - 0.5, y - 0.5, bw + 1, bh + 1);
    }

    // ── THE TRANSFORMED LOOK ─────────────────────────────────────────────────
    // While transformed, your slime wears cosmic armour: a copy of your sprite filled with
    // the void, speckled with stars. The full form wears all of it, rimmed in gold with a
    // halo; the partial form only some, its edge cracked open with light leaking through.
    _csSkinBuild(full) {
        const p = this.player, col = this._csCfg().COL, ADD = Phaser.BlendModes.ADD;
        CosmicSystem.ultFx(this);
        const armor = this.add.sprite(p.x, p.y, p.texture.key, p.frame.name).setTintFill(full ? 0x1c0b3e : 0x2a1458);
        const rim = this.add.sprite(p.x, p.y, p.texture.key, p.frame.name).setTintFill(full ? col.gold : col.lilac).setBlendMode(ADD);
        const halo = full ? this.add.sprite(p.x, p.y, 'fx_cosmic_ult', 'halo_0').play('csu_halo') : null;
        // the partial form's break: light leaking through a jagged crack
        const crack = full ? null : this.add.sprite(p.x, p.y, 'fx_cosmic_ult', 'crack_0').setBlendMode(ADD).play('csu_crack');
        // fixed star points across the body, in frame coordinates, each twinkling in its own time
        const fw = p.frame.width, fh = p.frame.height, stars = [];
        for (let i = 0; i < (full ? 9 : 5); i++) {
            const st = { u: 0.22 + Math.random() * (full ? 0.56 : 0.33), v: 0.74 + Math.random() * 0.2, ph: Math.random() * 6 };
            st.img = this.add.sprite(p.x, p.y, 'fx_cosmic_ult', 'twinkle_0').setBlendMode(ADD).setTint(full && st.ph > 3 ? col.gold : 0xffffff);
            st.img.play({ key: 'csu_twinkle', startFrame: i % 5, delay: Math.random() * 400 });
            stars.push(st);
        }
        return { full, armor, rim, halo, crack, stars, fw, fh, CUT: 0.58 };
    }
    _csSkinSync(sk, now) {
        const p = this.player;
        if (!p?.active) return;
        const d = p.depth ?? 1, al = p.alpha ?? 1, sx = p.scaleX, sy = p.scaleY;
        // the armour sits just under the eyes (CreatureFX.face draws at +0.001)
        for (const [s, ds, a, k] of [[sk.armor, 0.0004, sk.full ? 0.88 : 0.82, 1], [sk.rim, -0.01, (sk.full ? 0.4 : 0.25) * (0.75 + 0.25 * Math.sin(now * 0.01)), 1.12]]) {
            s.setTexture(p.texture.key, p.frame.name).setPosition(p.x, p.y).setOrigin(p.originX, p.originY)
             .setScale(sx * k, sy * k).setFlipX(p.flipX).setDepth(d + ds).setAlpha(a * al).setVisible(p.visible);
        }
        // the partial form: armour over one side only, broken off at a jagged crack
        const fw = sk.fw, fh = sk.fh, ox = fw * p.originX, oy = fh * p.originY;
        if (!sk.full) sk.armor.setCrop(0, 0, fw * sk.CUT, fh);
        const wx = u => p.flipX ? p.x + (ox - u * fw) * Math.abs(sx) : p.x + (u * fw - ox) * Math.abs(sx);
        const wy = v => p.y + (v * fh - oy) * Math.abs(sy);
        if (sk.crack) {   // the body is the frame's lower third
            const k = 0.32 * fh * Math.abs(sy) / 16, cx = wx(sk.CUT), cy = wy(0.82);
            sk.crack.setPosition(Math.round(cx), Math.round(cy)).setScale(k).setFlipX(p.flipX).setDepth(d + 0.0007).setAlpha(al * (0.75 + 0.25 * Math.sin(now * 0.012))).setVisible(p.visible);
            if (Math.random() < 0.08) CosmicSystem.puff(CosmicSystem.fx(this).fine, cx, cy + (Math.random() - 0.5) * 12 * k, 1, p.flipX ? Math.PI * 1.15 : -Math.PI * 0.15, 0.4, 20, 40, 380);   // shards of light flaking off the break
        }
        for (const st of sk.stars) st.img.setPosition(Math.round(wx(st.u)), Math.round(wy(st.v))).setDepth(d + 0.0007).setAlpha(al).setVisible(p.visible);
        if (sk.halo) sk.halo.setPosition(Math.round(p.x), Math.round(wy(0.6) - 2 + Math.sin(now * 0.006) * 1.5)).setDepth(d + 0.03).setAlpha(al).setVisible(p.visible);
    }
    _csSkinDrop(sk) {
        if (!sk) return;
        for (const o of [sk.armor, sk.rim, sk.halo, sk.crack, ...sk.stars.map(s => s.img)]) o?.destroy?.();
    }

    // full: the full transformation (three layers), else the partial one (two).
    _csTfBegin(full = false) {
        if (this.actionLocked?.('ult_cosmic')) return this._actionDenied('ult_cosmic');   // locked since the charge began: its layers stay
        const S = this._cs, C = this._csCfg().TF, col = this._csCfg().COL, now = this.time.now;
        // the ult blockers stop this too
        for (const e of this.enemies || []) {
            if (!e.ultInhibitor && !e.isUltAbsorber) continue;
            if (Math.hypot(e.x - this.playerX, e.y - this.playerY) <= (e.ultInhibitRadius || (e.isUltAbsorber ? 4 : 3)) + 0.25) {
                this.showStatusText(this.player.x, this.player.y - 20, 'ULT BLOCKED!', '#ff2200');
                return;
            }
        }
        this._csSetLayers(this._csLayers() - (full ? 3 : 2));
        this._ultCastAt.cosmic = now;
        this.isPointerDown = false;
        S.tf = { phase: 'turn', at: now, until: now + C.TURN_MS, full };
        S.tf.skin = this._csSkinBuild(full);
        // stage 3: nothing touches you from here to the slam (_csTfSlam lets go)
        if (S.tf.full) this._dashInvulnUntil = Math.max(this._dashInvulnUntil || 0, now + C.TURN_MS + C.AIM_MS + C.DROP_MS + 400);
        this.player.setTint(full ? col.gold : col.lilac);
        this._csDomainLine(full ? col.gold : col.violet);
        this._csHpBoost('tf', full ? C.HP_FULL : C.HP);
        this._csDomainBegin();
        Sfx.play(this, full ? 'ascendant' : 'transform');
        this.cameras.main.shake(300, 0.003);
    }

    // Where the slam would land for a cursor at world (wx, wy): the cursor's tile if it's open
    // floor within reach, else the last open tile on the line from you toward it.
    _csTfTarget(wx, wy) {
        const T = this.TILE_SIZE, R = this._csCfg().TF.AIM_RANGE;
        const px = this.playerX + 0.5, py = this.playerY + 0.5;
        let dx = wx / T - px, dy = wy / T - py;
        const d = Math.hypot(dx, dy);
        if (d > R) { dx *= R / d; dy *= R / d; }
        const ok = (x, y) => this.world?.[x]?.[y] === this.FLOOR && !this.isInLockedRoom(x, y) && !this._isInCrack?.((x + 0.5) * this.TILE_SIZE, (y + 0.5) * this.TILE_SIZE);
        let best = { x: this.playerX, y: this.playerY };
        const n = Math.ceil(Math.hypot(dx, dy) * 3);
        for (let i = 1; i <= n; i++) {
            const tx = Math.floor(px + dx * i / n), ty = Math.floor(py + dy * i / n);
            if (this.world?.[tx]?.[ty] !== this.FLOOR) break;
            if (ok(tx, ty)) best = { x: tx, y: ty };
        }
        return best;
    }

    _csTfUpdate(now, dt) {
        const S = this._cs, tf = S.tf;
        if (!tf) return;
        const C = this._csCfg().TF, col = this._csCfg().COL, T = this.TILE_SIZE, p = this.player, F = CosmicSystem.fx(this);
        if (tf.skin) this._csSkinSync(tf.skin, now);
        const Dm = S.domain;
        if (Dm && tf.phase === 'form' && !tf.full && now >= Dm.waveAt) { Dm.waveAt = now + C.WAVE_EVERY; this._csDomainTide(); }
        // stage 3: cosmic regeneration, from the hold to the end of the form
        if (tf.full && this.health > 0) {
            const C3 = this._csCfg().TF3, max = this.maxHealth || 100;
            tf.regenAcc = (tf.regenAcc || 0) + dt;
            while (tf.regenAcc >= C3.REGEN_MS) { tf.regenAcc -= C3.REGEN_MS; this.health = Math.min(max, this.health + max * C3.REGEN); }
            if (this.health < max && Math.random() < dt / 160) CosmicSystem.ultFx(this).heal.emitParticleAt(p.x + (Math.random() - 0.5) * 22, p.y + 6, 1);
        }
        if (tf.phase === 'turn') {
            // the turn: dust pours in, a circle of runes closes round you, you flicker white and violet
            const k = Math.min(1, (now - tf.at) / C.TURN_MS), e = 1 - (1 - k) * (1 - k);
            p.setTint(Math.floor(now / 90) % 2 ? (tf.full ? col.gold : col.lilac) : col.violet);
            if (Math.random() < dt / 22) CosmicSystem.inward(Math.random() < 0.3 ? F.gold : F.dust, p.x, p.y, 46 + Math.random() * 20, 380, 1, 0.6);
            tf.turnFx ||= CosmicSystem.runes(this, 10, tf.full ? col.gold : col.lilac);
            tf.turnFx.place(p.x, p.y + 6, 70 * (1 - e) + 16, now * 0.004, 10, 0.3 + 0.7 * k, 0.55);
            if (now >= tf.until) { tf.turnFx.destroy(); tf.turnFx = null; tf.phase = 'aim'; tf.until = now + C.AIM_MS; this.showStatusText(p.x, p.y - 30, 'CHOOSE WHERE', '#e2c8ff'); }
            return;
        }
        if (tf.phase === 'aim') {
            // the live pointer, not pointerX (only pointermove updates that; a mouse that hasn't
            // moved since the level loaded would aim at a stale point)
            const cam = this.cameras.main, ap = this._aim(this.input.activePointer);
            tf.target = this._csTfTarget(ap.x + cam.scrollX, ap.y + cam.scrollY);
            const cx = tf.target.x * T + T / 2, cy = tf.target.y * T + T / 2, R = (tf.full ? this._csCfg().TF3.SLAM_R : C.SLAM_R) * T;
            const left = Math.max(0, (tf.until - now) / C.AIM_MS), tint = tf.full ? col.gold : col.lilac;
            // the landing: a rune circle the size of the slam over a glow, its runes going round in it (one goes dark for
            // every twelfth of the time gone), a few more turning against them, the star at its heart, dust drawn down into it
            const rs = R / 28;   // (ring_l's outer line is 28 px out)
            if (!tf.aimFx) {
                CosmicSystem.ultFx(this);
                tf.aimFx = [VisualFX.aura(this, cx, cy, R * 1.15, tf.full ? col.gold : col.violet, { depth: 0.9, alpha: 0.9 }),
                            CosmicSystem.runes(this, 12, tint, 0.961, 2), CosmicSystem.runes(this, 6, col.violet),
                            this.add.sprite(cx, cy, 'fx_cosmic_ult', 'sigil_0').setTint(tint).setDepth(0.96).setScale(2).play('csu_sigil'),
                            this.add.image(cx, cy, 'fx_cosmic_ult', 'ring_l').setTint(tint).setDepth(0.96).setScale(rs)];
            }
            const [au, r1, r2, sig, ring] = tf.aimFx;
            au.setPosition(cx, cy);
            ring.setPosition(cx, cy).setAlpha(0.8 + 0.2 * Math.sin(now * 0.008));
            r1.place(cx, cy, 24.5 * rs, now * 0.0008, Math.ceil(left * 12), 1);
            r2.place(cx, cy, R * 0.5, -now * 0.0014, 6, 0.8);
            sig.setPosition(cx, cy);
            if (Math.random() < dt / 30) { const a = Math.random() * Math.PI * 2; F.fine.emitParticleAt(cx + Math.cos(a) * R, cy + Math.sin(a) * R, 1); }   // the circle's line, glittering
            if (Math.random() < dt / 40) CosmicSystem.inward(tf.full ? F.gold : F.dust, cx, cy, R, 500, 1);
            // the way there: dust flowing from you to it
            if (Math.random() < dt / 18) {
                const f = Math.random(), a = Math.atan2(cy - p.y, cx - p.x);
                CosmicSystem.puff(tf.full ? F.gold : F.fine, p.x + (cx - p.x) * f, p.y + (cy - p.y) * f, 1, a, 0.06, 110, 170, 320);
            }
            p.setTint(col.lilac);
            if (now >= tf.until) this._csTfDrop();
            return;
        }
        if (tf.phase === 'drop') {
            const P = tf.portal;
            if (P) P.glow.setAlpha(0.6 + 0.3 * Math.sin(now * 0.02));
            return;
        }
        // the form: a violet aura, the time left on the tray
        if (now >= tf.until) { this._csTfEnd(); return; }
        p.setTint(tf.full ? col.gold : col.lilac);
        if (S.drag && !S.drag.anchored && now - S.drag.at > C.PICK_MS) S.drag = null;   // a first point left too long lapses
        if (S.drag) this._csCollapsePreview(S.drag); else this._csHidePreview();
    }

    // Aim chosen (a click, or the time ran out): the rift drop.
    _csTfDrop() {
        const S = this._cs, tf = S.tf, C = this._csCfg().TF, col = this._csCfg().COL, T = this.TILE_SIZE, now = this.time.now, p = this.player;
        for (const o of tf.aimFx || []) o?.destroy?.();
        tf.aimFx = null;
        const tgt = tf.target || { x: this.playerX, y: this.playerY };
        // never land on an enemy: the nearest open tile instead
        let land = tgt;
        const free = (x, y) => this.world?.[x]?.[y] === this.FLOOR && !this.getEnemyAt(x, y) && !this.isInLockedRoom(x, y);
        if (!free(land.x, land.y)) {
            land = null;
            for (let r = 1; !land && r <= 3; r++) for (let dx = -r; dx <= r && !land; dx++) for (let dy = -r; dy <= r && !land; dy++)
                if (free(tgt.x + dx, tgt.y + dy)) land = { x: tgt.x + dx, y: tgt.y + dy };
            land = land || { x: this.playerX, y: this.playerY };
        }
        tf.phase = 'drop'; tf.at = now; tf.land = land;
        Sfx.play(this, 'csrift');
        this._dashInvulnUntil = Math.max(this._dashInvulnUntil || 0, now + C.DROP_MS + 150);   // untargetable while gone
        const cx = land.x * T + T / 2, cy = land.y * T + T / 2;
        // the portal: a rift opening in the floor, the dark in it turning, dust thrown up off its lip
        const glow = this.add.image(cx, cy, 'vfx_glow').setTint(col.violet).setBlendMode(Phaser.BlendModes.ADD).setDepth(0.9).setScale(0.1);
        CosmicSystem.ultFx(this);
        const portal = this.add.sprite(cx, cy, 'fx_cosmic_ult', 'portal_0').setDepth(0.95).setScale(0.1).play('csu_portal');
        portal.glow = glow; tf.portal = portal;
        this.tweens.add({ targets: portal, scale: 1.5, duration: 300, ease: 'Back.easeOut' });
        this.tweens.add({ targets: glow, scale: 1.1, duration: 300 });
        const F = CosmicSystem.fx(this);
        this.time.delayedCall(120, () => { if (!this._cs) return; CosmicSystem.ring(F.dust, cx, cy, T * 1.6, 360, 18); CosmicSystem.puff(F.fine, cx, cy - 2, 10, -Math.PI / 2, 0.5, 30, 90, 500); });
        // you fade out where you stand
        this._csBurst(p.x, p.y, 30, col.lilac, 260);
        this.tweens.add({ targets: p, alpha: 0, scaleY: p.scaleY * 1.6, scaleX: p.scaleX * 0.4, duration: 220, ease: 'Quad.easeIn' });
        const sx = p.scaleX, sy = p.scaleY;
        this.time.delayedCall(C.DROP_MS * 0.55, () => {
            if (!this._cs?.tf || !p.active) return;
            this.tweens.killTweensOf(p);
            this.playerX = land.x; this.playerY = land.y;
            p.setPosition(cx, cy - 70 + (this.SLIME_Y_OFFSET || 0)).setScale(sx, sy).setAlpha(1);
            this.cameras.main.centerOn?.(cx, cy);
            this.tweens.add({ targets: p, y: cy + (this.SLIME_Y_OFFSET || 0), duration: C.DROP_MS * 0.35, ease: 'Quad.easeIn', onComplete: () => this._csTfSlam() });
        });
    }

    _csTfSlam() {
        if (this._ultHit !== 'cosmic' && this._asUlt) return this._asUlt('cosmic', () => this._csTfSlam());   // ult damage
        const S = this._cs, tf = S?.tf;
        if (!tf) return;
        const C = this._csCfg().TF, C3 = this._csCfg().TF3, col = this._csCfg().COL, T = this.TILE_SIZE, now = this.time.now;
        const cx = tf.land.x * T + T / 2, cy = tf.land.y * T + T / 2, ds = this.damageScaling || 1;
        const SR = tf.full ? C3.SLAM_R : C.SLAM_R, SD = tf.full ? C3.SLAM_DMG : C.SLAM_DMG;
        if (tf.full) this._dashInvulnUntil = Math.min(this._dashInvulnUntil || 0, now + 150);   // touchable again
        // the Big Crunch: what's Hexed in reach is pulled in first (the slam lands on it), then its Hex is cashed in
        const CR = tf.full ? C3.CRUNCH_R : C.CRUNCH_R, hexed = e => (e._csHexUntil || 0) > now && e._csHexStacks > 0;
        const crunch = (this.enemies || []).filter(e => e.sprite?.active && e.health > 0 && !this._phasedOut?.(e) && hexed(e) && Math.hypot(e.x - tf.land.x, e.y - tf.land.y) <= CR);
        for (const e of crunch) if (!e.isMortar && !e.isHealerTotem && !e.isAnchor && !e.isBoss) for (let k = 0; k < C.CRUNCH_PULL; k++) { e._csDragAt = 0; this._csDragToward(e, tf.land.x, tf.land.y, now); }
        for (const e of [...(this.enemies || [])]) {
            if (!e.sprite?.active || e.health <= 0) continue;
            if (Math.hypot(e.x - tf.land.x, e.y - tf.land.y) > SR) continue;
            this.damageEnemy(e, SD * ds, 'cosmic');
            if (e.health <= 0 || !e.sprite?.active) continue;
            e.isSlowed = true; e._slowMult = C.SLAM_SLOW; e.slowedUntil = now + C.SLAM_SLOW_MS;
            if (tf.full) {   // dazed
                e.isStunned = true; e.stunnedUntil = Math.max(e.stunnedUntil || 0, now + C3.DAZE_MS);
                this._showStunIndicator?.(e);
            }
        }
        this._csHitBosses(cx, cy, SR * T, SD * ds);
        let cashed = this._csHitBosses(cx, cy, CR * T, 0, true);
        for (const e of crunch) if (e.health > 0 && e.sprite?.active && this._csCashHex(e)) cashed++;
        if (cashed) {
            CosmicSystem.inward(CosmicSystem.fx(this).pink, cx, cy, CR * T * 0.8, 180, 30);
            this.showStatusText(cx, cy - 48, 'BIG CRUNCH', '#ff8ce0');
            this.cameras.main.shake(260, 0.016);
        }
        Sfx.play(this, 'cslam', { gold: tf.full });
        // a burst of light where you land, the aim's circle stamped down and thrown off, dust flung out over the slam's reach
        // and a ring of it riding past
        const F = CosmicSystem.fx(this);
        CosmicSystem.nova(this, cx, cy - 2, 2, tf.full);
        CosmicSystem.stamp(this, cx, cy, SR * T, tf.full ? col.gold : col.lilac, 0.97);
        this._csBurst(cx, cy, SR * T, col.violet, 460);
        this._csBurst(cx, cy, SR * T * 0.5, col.gold, 300);
        CosmicSystem.ring(tf.full ? F.gold : F.pink, cx, cy, SR * T * 1.3, 500, 36, SR * T * 0.3);
        CosmicSystem.puff(F.fine, cx, cy, 14, -Math.PI / 2, 0.9, 40, 140, 600);
        this._vfxFlash?.(cx, cy, SR * T * 1.8, tf.full ? col.gold : col.lilac, 500, 1);
        this.cameras.main.shake(220, 0.012);
        const P = tf.portal;
        if (P) this.tweens.add({ targets: [P, P.glow], scale: 0, alpha: 0, duration: 500, delay: 300, onComplete: () => { P.glow.destroy(); P.destroy(); } });
        tf.portal = null;
        this._csSpawnVoidlets(tf.land.x, tf.land.y);
        tf.phase = 'form'; tf.at = now; tf.cdUntil = 0;
        tf.until = now + (tf.full ? C3.FORM_MS : C.FORM_MS); tf.cap = now + (tf.full ? C3.FORM_MAX_MS : C.FORM_MAX_MS);
        this.showStatusText(cx, cy - 34, 'TWIN COLLAPSE', '#f0dcff');
        if (S.domain) { S.domain.waveAt = now + 400; if (tf.full) this._csDomainFlood(tf.cap); }
    }

    _csTfEnd() {
        const S = this._cs, tf = S?.tf;
        if (!tf) return;
        tf.portal?.glow?.destroy(); tf.portal?.destroy(); tf.turnFx?.destroy();
        this._csSkinDrop(tf.skin);
        S.tf = null; S.drag = null;
        // a throw still gathering when the form ends never launches (ones already flying finish)
        for (const c of [...(S.collapses || [])]) if (c.at > this.time.now) { for (const o of c.objs) { o.glow?.destroy(); o.core?.destroy(); } S.collapses.splice(S.collapses.indexOf(c), 1); }
        // (the voidlets stay: they fight on till they fall)
        this._csDomainEnd();
        this._csHpBoostEnd('tf');
        for (const k of ['aimFx', 'pvFx']) for (const o of tf[k] || []) o?.destroy?.();
        if (this.player?.active) { this.player.clearTint(); this.player.setAlpha(1); this._csBurst(this.player.x, this.player.y, 40, this._csCfg().COL.lilac, 300); }
    }

    // The bosses in reach of (cx, cy) take `dmg` (bosses aren't in this.enemies); `cash`: their Hex is cashed in too.
    _csHitBosses(cx, cy, R, dmg, cash = false) {
        const T = this.TILE_SIZE, vb = this.voltslimeBoss, vs = this.voidSovereignBoss;
        const list = [];
        if (vb?.active && vb.container) list.push([vb, vb.container.x, vb.container.y]);
        if (vs?.active && vs.container) list.push([vs, vs.container.x, vs.container.y + (this.SLIME_Y_OFFSET || 0)]);
        let n = 0;
        for (const [b, bx, by] of list) {
            if (Math.hypot(bx - cx, by - cy) > R + T * 1.5) continue;
            if (dmg > 0) { this.damageBossAtTile(Math.floor(bx / T), Math.floor(by / T), dmg, 'collapse', 'cosmic'); n++; }
            if (cash && this._csCashHex(b, bx, by) && !(dmg > 0)) n++;
        }
        return n;
    }
    // Every Hex stack on e (an enemy, or a story boss at bx, by) cashed in at once: CASH + CASH_PCT of its max HP a stack
    // (CASH_BOSS for a boss), the stacks gone after the hit (it lands at their +damage taken). The stacks it had, 0 for none.
    _csCashHex(e, bx, by) {
        const C = this._csCfg().TF, col = this._csCfg().COL, T = this.TILE_SIZE, now = this.time.now;
        const n = (e._csHexUntil || 0) > now ? Math.min(3, e._csHexStacks || 0) : 0;
        if (!n) return 0;
        const story = !e.sprite, pct = story || e.isBoss ? C.CASH_BOSS : C.CASH_PCT;
        const dmg = (C.CASH + pct * ((story ? e.maxHp : e.maxHealth) || 0)) * n * (this.damageScaling || 1);
        const x = story ? bx : e.sprite.x, y = story ? by : e.sprite.y;
        if (story) this.damageBossAtTile(Math.floor(bx / T), Math.floor(by / T), dmg, 'collapse', 'cosmic');
        else this.damageEnemy(e, dmg, 'cosmic');
        e._csHexStacks = 0; e._csHexUntil = 0;
        this._csBurst(x, y, 12 + 8 * n, col.hex, 300);
        CosmicSystem.puff(CosmicSystem.fx(this).pink, x, y, 4 + 3 * n, 0, Math.PI, 30, 110, 420);
        return n;
    }

    // ── TWIN COLLAPSE ────────────────────────────────────────────────────────
    // Anchored. The first click sets the anchor, an object that stays put where you put it. After that every click
    // throws: the anchored object flies from the anchor toward where you clicked, its twin flies in from the mirror
    // point behind the click, and they collapse ON the click (pulled in toward it if a wall's in the way). The farther
    // the click is from the anchor, the faster they close: the harder and wider the collapse. What they pass through is
    // hit and Hexed. Right-click moves the anchor to the cursor. The aim (a stream from each side, the rune circle at
    // the collapse, sized and coloured by its power) is shown the whole time (_csCollapsePreview on S.drag).
    // A wall stops an object (it fizzles); the full form ignores walls (and adds the mirror pair).
    _csPointerDown(pointer) {
        const S = this._cs, tf = S?.tf;
        if (!tf) return false;
        if (tf.phase === 'aim') { this._csTfDrop(); return true; }
        if (tf.phase !== 'form') return true;   // turning or dropping: no attacks
        const cam = this.cameras.main, a = this._aim(pointer), now = this.time.now;
        const w = { x: a.x + cam.scrollX, y: a.y + cam.scrollY };
        if (pointer.button === 2 || !S.drag) return this._csSetAnchor(w);   // right-click, or no anchor yet: (re)place it
        const pair = this._csAnchorPair(w), plan = pair && this._csCollapsePlan(pair.a, pair.b);
        if (!plan) { this.showStatusText(this.player.x, this.player.y - 24, 'NO FLOOR THERE', '#e2c8ff'); return true; }
        // one throw waiting at most: a click while one is still gathering is ignored (fast clicks used to queue
        // up ten throws, 600ms apart, that went on landing after the form had ended)
        if ((S.collapses || []).some(c => c.at > now)) return true;
        const C = this._csCfg().TF, wait = Math.max(C.LAUNCH_MS, tf.cdUntil - now);
        tf.cdUntil = now + wait + (tf.full ? C.COLLAPSE_CD_FULL : C.COLLAPSE_CD);
        this._csCollapseFire(plan, wait);
        return true;
    }
    _csSetAnchor(w) {
        const S = this._cs, tf = S.tf;
        if (!this._csCollapsePlan(w, w)) { this.showStatusText(this.player.x, this.player.y - 24, 'NO FLOOR THERE', '#e2c8ff'); return true; }
        S.drag = { a: w, b: w, at: this.time.now, anchored: true };
        this._csBurst(w.x, w.y, 18, tf.full ? this._csCfg().COL.gold : this._csCfg().COL.lilac, 240);
        Sfx.play(this, 'csplace', { gold: tf.full });
        return true;
    }
    // The pair for a throw at w: the anchor, and its mirror through w, walked in toward w until it's on usable ground.
    _csAnchorPair(w) {
        const S = this._cs, A = S.drag?.a; if (!A) return null;
        for (const k of [1, 0.8, 0.6, 0.4, 0.2, 0]) {
            const b = { x: w.x + (w.x - A.x) * k, y: w.y + (w.y - A.y) * k };
            if (this._csCollapsePlan(A, b)) return { a: A, b };
        }
        return null;
    }
    _csPointerMove() {
        const S = this._cs;
        if (!S?.drag) return;
        const cam = this.cameras.main, w = { x: this.pointerX + cam.scrollX, y: this.pointerY + cam.scrollY };
        S.drag.b = S.drag.anchored ? (this._csAnchorPair(w)?.b ?? w) : w;
    }
    _csPointerUp() {}

    // Where Twin Collapse can reach, in world px: the room you're in (one tile out, over its
    // walls, for the full form), or 12 tiles around you in a corridor.
    _csArena(full) {
        const T = this.TILE_SIZE, px = this.playerX, py = this.playerY;
        const R = (this.rooms || []).find(r => px >= r.x && px < r.x + r.w && py >= r.y && py < r.y + r.h);
        const pad = full ? 1 : 0;
        if (R) return { x0: (R.x - pad) * T + 1, y0: (R.y - pad) * T + 1, x1: (R.x + R.w + pad) * T - 1, y1: (R.y + R.h + pad) * T - 1 };
        return { x0: (px - 12) * T, y0: (py - 12) * T, x1: (px + 13) * T, y1: (py + 13) * T };
    }

    // The two paths for objects placed at a and b (world px), or null if a point isn't usable.
    _csCollapsePlan(a, b) {
        const C = this._csCfg().TF, T = this.TILE_SIZE, full = !!this._cs?.tf?.full;
        // No reach or span limit: anywhere in the room you're in (its walls included for the
        // full form, which ignores them), never out in the void beyond. Points outside are
        // pulled back in to the room's edge.
        const A = this._csArena(full);
        const inA = p => ({ x: Math.max(A.x0, Math.min(A.x1, p.x)), y: Math.max(A.y0, Math.min(A.y1, p.y)) });
        a = inA(a); b = inA(b);
        const fl = full ? (x, y) => this.world?.[Math.floor(x / T)]?.[Math.floor(y / T)] !== undefined
                        : (x, y) => this.world?.[Math.floor(x / T)]?.[Math.floor(y / T)] === this.FLOOR;
        if (!fl(a.x, a.y) || !fl(b.x, b.y)) return null;
        const len = Math.hypot(b.x - a.x, b.y - a.y);
        if (len < T * 0.75) {   // a click, not a drag: both objects from either side of the cursor
            const ux = len > 0 ? (b.x - a.x) / len : 1, uy = len > 0 ? (b.y - a.y) / len : 0, m = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
            a = { x: m.x - ux * T, y: m.y - uy * T }; b = { x: m.x + ux * T, y: m.y + uy * T };
            if (!fl(a.x, a.y) || !fl(b.x, b.y)) { a = m; b = m; }
        }
        const L = Math.hypot(b.x - a.x, b.y - a.y), steps = Math.max(1, Math.ceil(L / (T / 4)));
        const at = i => ({ x: a.x + (b.x - a.x) * i / steps, y: a.y + (b.y - a.y) * i / steps });
        // first blocked sample walking from each end
        let wa = steps + 1, wb = -1;
        for (let i = 0; i <= steps; i++) { const q = at(i); if (!fl(q.x, q.y)) { wa = i; break; } }
        for (let i = steps; i >= 0; i--) { const q = at(i); if (!fl(q.x, q.y)) { wb = i; break; } }
        const mid = steps / 2;
        let endA, endB, meet, fizzA = false, fizzB = false;
        if (wa > steps) { endA = endB = mid; meet = 'mid'; }
        else if (wa > mid) { endA = wa - 1; endB = wa - 1; fizzB = true; meet = 'a'; }   // B hits the wall; A goes on to it
        else if (wb < mid) { endA = wb + 1; endB = wb + 1; fizzA = true; meet = 'b'; }
        else { endA = wa - 1; endB = wb + 1; meet = 'both'; }
        if (meet === 'a') endB = wb + 1;
        if (meet === 'b') endA = wa - 1;
        const tiles = px => px / T;
        const dA = tiles(L * endA / steps), dB = tiles(L * (steps - endB) / steps);
        const v = d => Math.sqrt(2 * C.COLLAPSE_ACC * Math.max(0.01, d));   // tiles/s at the end
        let impacts;
        if (meet === 'mid') impacts = [{ p: at(mid), speed: v(dA) + v(dB), t: Math.sqrt(2 * dA / C.COLLAPSE_ACC) }];
        else if (meet === 'a') impacts = [{ p: at(endA), speed: v(dA), t: Math.sqrt(2 * dA / C.COLLAPSE_ACC) }];
        else if (meet === 'b') impacts = [{ p: at(endB), speed: v(dB), t: Math.sqrt(2 * dB / C.COLLAPSE_ACC) }];
        else impacts = [{ p: at(endA), speed: v(dA), t: Math.sqrt(2 * dA / C.COLLAPSE_ACC) }, { p: at(endB), speed: v(dB), t: Math.sqrt(2 * dB / C.COLLAPSE_ACC) }];
        // all the objects land together: MULT × a pair's hit (4 objects partial, 8 full)
        const F = full ? this._csCfg().TF3 : C;
        for (const im of impacts) { im.dmg = (C.COLLAPSE_BASE + C.COLLAPSE_PER * im.speed) * F.MULT; im.rMul = Math.min(1.6, 0.75 + im.speed / 60); }   // a harder throw lands wider too
        const plan = { a, b, endA: at(endA), endB: at(endB), dA, dB, fizzA, fizzB, impacts, mirrors: [] };
        // the other pairs, turned about the midpoint, crashing into the same centre. The full
        // form's ignore walls; the partial form's start no further out than open floor reaches.
        const m = at(mid);
        for (const deg of F.ROT) {
            const r = deg * Math.PI / 180, cs = Math.cos(r), sn = Math.sin(r);
            const rot = p => {
                let q = inA({ x: m.x + (p.x - m.x) * cs - (p.y - m.y) * sn, y: m.y + (p.x - m.x) * sn + (p.y - m.y) * cs });
                if (!full) {   // walk out from the centre, stop at the last open floor
                    const L2 = Math.hypot(q.x - m.x, q.y - m.y), n = Math.ceil(L2 / (T / 4));
                    let last = m;
                    for (let i = 1; i <= n; i++) { const s = { x: m.x + (q.x - m.x) * i / n, y: m.y + (q.y - m.y) * i / n }; if (!fl(s.x, s.y)) break; last = s; }
                    q = last;
                }
                return q;
            };
            const a2 = rot(a), b2 = rot(b);
            plan.mirrors.push({ a: a2, b: b2, dA: Math.hypot(a2.x - m.x, a2.y - m.y) / T, dB: Math.hypot(b2.x - m.x, b2.y - m.y) / T, end: m });
        }
        return plan;
    }

    // While you choose the second point: the first object already waiting where you put it,
    // a ghost of the second under the cursor, each one's path as a stream of dust flowing
    // to where they'll meet, an X where a wall stops one, and at the meeting point a rune
    // circle that grows and turns gold the harder it will hit, a pip lit over it per fifth
    // of the full power.
    _csCollapsePreview(drag) {
        const tf = this._cs.tf, col = this._csCfg().COL, T = this.TILE_SIZE, R = (tf.full ? this._csCfg().TF3 : this._csCfg().TF).COLLAPSE_R * T, now = this.time.now;
        const plan = this._csCollapsePlan(drag.a, drag.b), F = CosmicSystem.fx(this), K = 'fx_cosmic_ult';
        if (!tf.pvFx) {
            CosmicSystem.ultFx(this);
            const orb = () => this.add.sprite(0, 0, K, 'orb_0').setScale(1.4).setDepth(4.56).setAlpha(0.85).play('csu_orb');
            const nope = () => this.add.image(0, 0, K, 'nope').setScale(1.5).setDepth(4.57);
            tf.pvFx = [orb(), orb().setAlpha(0.45), CosmicSystem.runes(this, 8, col.violet, 0.961), this.add.sprite(0, 0, K, 'sigil_0').setDepth(0.96).play('csu_sigil'),
                       VisualFX.aura(this, 0, 0, R * 1.2, col.violet, { depth: 0.9, alpha: 0.8 }), CosmicSystem.runes(this, 6, col.lilac), nope(), nope(), nope(),
                       ...Array.from({ length: 5 }, () => this.add.image(0, 0, K, 'pip_0').setDepth(4.57)),
                       ...Array.from({ length: 6 }, () => this.add.sprite(0, 0, K, 'pin_0').setBlendMode(Phaser.BlendModes.ADD).setDepth(4.56).play('csu_pin')),
                       this.add.image(0, 0, K, 'ring_m').setDepth(0.96).setScale(2)];
        }
        const [oa, ob, ring, sig, au, ring2, nA, nB, nC] = tf.pvFx, pips = tf.pvFx.slice(9, 14), pins = tf.pvFx.slice(14, 20), circle = tf.pvFx[20];
        for (const o of [ring2, nA, nB, nC, ...pins]) o.setVisible(false);
        oa.setPosition(Math.round(drag.a.x), Math.round(drag.a.y)).setVisible(true);
        if (!plan) {
            for (const o of [ob, ring, sig, au, circle, ...pips]) o.setVisible(false);
            nC.setVisible(true).setPosition(Math.round(drag.b.x), Math.round(drag.b.y)).setScale(2);
            return;
        }
        ob.setPosition(Math.round(plan.b.x), Math.round(plan.b.y)).setVisible(true);
        const stream = (p, q, E) => {   // a grain now and then, flowing along the path, gone where it ends
            const L = Math.hypot(q.x - p.x, q.y - p.y);
            if (L < 6 || Math.random() < 0.4) return;
            const f = Math.random() * 0.85, v = 90 + 60 * f, pt = E.emitParticleAt(p.x + (q.x - p.x) * f, p.y + (q.y - p.y) * f, 1);
            if (!pt) return;
            pt.velocityX = (q.x - p.x) / L * v; pt.velocityY = (q.y - p.y) / L * v; pt.life = pt.lifeCurrent = Math.min(500, (1 - f) * L / v * 1000);
        };
        stream(plan.a, plan.endA, F.fine); stream(plan.b, plan.endB, F.fine);
        let pi = 0;
        for (const M of plan.mirrors || []) {
            const E2 = tf.full ? F.gold : F.dust;
            stream(M.a, M.end, E2); stream(M.b, M.end, E2);
            for (const q of [M.a, M.b]) if (pi < pins.length) pins[pi++].setVisible(true).setPosition(Math.round(q.x), Math.round(q.y)).setTint(tf.full ? col.gold : col.violet);
        }
        [[plan.fizzA, plan.endA, nA], [plan.fizzB, plan.endB, nB]].forEach(([f, q, n]) => { if (f) n.setVisible(true).setPosition(Math.round(q.x), Math.round(q.y)).setScale(1.5); });
        const im = plan.impacts.reduce((m, i) => (i.dmg > m.dmg ? i : m), plan.impacts[0]);
        const top = (this._csCfg().TF.COLLAPSE_BASE + this._csCfg().TF.COLLAPSE_PER * 50) * (tf.full ? this._csCfg().TF3.MULT : this._csCfg().TF.MULT);
        const k = Math.min(1, im.dmg / top), tint = k > 0.66 ? col.gold : k > 0.33 ? col.lilac : col.violet;
        const big = k >= 0.5, band = big ? 49 : 35;   // (the band between the circle's lines, at its size of 2)
        circle.setVisible(true).setFrame(big ? 'ring_l' : 'ring_m').setPosition(Math.round(im.p.x), Math.round(im.p.y)).setTint(tint).setAlpha(0.6 + 0.4 * k);
        ring.tint = tint; ring.place(im.p.x, im.p.y, band, now * (0.001 + 0.003 * k), 8, 0.65 + 0.35 * k);
        sig.setVisible(true).setPosition(Math.round(im.p.x), Math.round(im.p.y)).setTint(tint).setScale(Math.round((1 + k) * 2) / 2).setAlpha(0.6 + 0.4 * k);
        au.setVisible(true).setPosition(im.p.x, im.p.y).setTint(tint);
        const lit = Math.max(1, Math.ceil(k * 5)), pr = (big ? 56 : 40) + 9;
        pips.forEach((o, i) => {
            const a = -Math.PI / 2 + (i - 2) * 0.28;
            o.setVisible(true).setFrame(i < lit ? 'pip_1' : 'pip_0').setPosition(Math.round(im.p.x + Math.cos(a) * pr), Math.round(im.p.y + Math.sin(a) * pr));
        });
        for (const extra of plan.impacts) if (extra !== im) ring2.place(extra.p.x, extra.p.y, R, -now * 0.002, 6, 0.7);
    }
    _csHidePreview() {
        for (const o of this._cs?.tf?.pvFx || []) o?.setVisible?.(false);
    }

    // `wait` ms with the objects sitting at their origins, gathering, before they launch.
    _csCollapseFire(plan, wait = 0) {
        const S = this._cs, col = this._csCfg().COL, now = this.time.now;
        const mk = (from, to, d, fizz, gold = false) => {
            const glow = this.add.image(from.x, from.y, 'vfx_glow').setTint(gold ? col.gold : col.violet).setBlendMode(Phaser.BlendModes.ADD).setDepth(4.55).setScale(0.35).setAlpha(0.6);
            CosmicSystem.ultFx(this);
            const core = this.add.sprite(from.x, from.y, 'fx_cosmic_ult', gold ? 'orbg_0' : 'orb_0').setDepth(4.56).setScale(1.6).play(gold ? 'csu_orbg' : 'csu_orb');
            core._csGold = gold;
            return { from, to, d, fizz, glow, core, hit: new Set(), done: d < 0.05, drag: S.tf?.full ? [] : null };
        };
        if (!S.collapses) S.collapses = [];
        const objs = [mk(plan.a, plan.endA, plan.dA, plan.fizzA), mk(plan.b, plan.endB, plan.dB, plan.fizzB)];
        for (const M of plan.mirrors || []) {   // the other pairs (gold in the full form), into the same centre
            for (const [from, d] of [[M.a, M.dA], [M.b, M.dB]]) {
                const o = mk(from, M.end, d, false, !!S.tf?.full);
                objs.push(o);
                this._csBurst(from.x, from.y, 16, S.tf?.full ? col.gold : col.violet, 200);
            }
        }
        S.collapses.push({ at: now + wait, objs, impacts: plan.impacts.map(i => ({ ...i, fired: false })) });
        Sfx.play(this, 'csplace', { gold: !!S.tf?.full });
        this.time.delayedCall(Math.max(0, wait - 120), () => Sfx.play(this, 'cslaunch'));
        this._csBurst(plan.a.x, plan.a.y, 16, col.lilac, 200); this._csBurst(plan.b.x, plan.b.y, 16, col.lilac, 200);
    }

    _csUpdateCollapses(now) {
        const S = this._cs;
        if (!S.collapses?.length) return;
        const C = this._csCfg().TF, col = this._csCfg().COL, T = this.TILE_SIZE, ds = this.damageScaling || 1;
        for (const c of [...S.collapses]) {
            const t = (now - c.at) / 1000;
            if (t < 0) {   // still gathering at their origins: pulsing, a line drawn between them
                for (const o of c.objs) { const k = 1 + 0.25 * Math.sin(now * 0.04); o.glow.setScale(0.3 * k); o.core.setScale(1.6 * k); }
                continue;
            }
            for (const o of c.objs) {
                if (o.done) { o.glow.setVisible(false); o.core.setVisible(false); continue; }
                const s = Math.min(o.d, 0.5 * C.COLLAPSE_ACC * t * t), f = o.d > 0 ? s / o.d : 1;
                const x = o.from.x + (o.to.x - o.from.x) * f, y = o.from.y + (o.to.y - o.from.y) * f;
                o.glow.setPosition(x, y).setScale(0.3 + 0.25 * f); o.core.setPosition(x, y).setScale(1.6 + 0.6 * f);
                // a tail of dust, longer the faster it's going
                if (Math.random() < 0.4 + 0.6 * f) { const FX = CosmicSystem.fx(this); CosmicSystem.puff(o.core._csGold ? FX.gold : (Math.random() < 0.5 ? FX.fine : FX.dust), x, y, 1, 0, Math.PI, 0, 12, 260 + 200 * f); }
                // pierce: everything it passes, once
                const tx = Math.floor(x / T), ty = Math.floor(y / T);
                for (const e of this.enemies || []) {
                    if (this._phasedOut?.(e)) continue;
                    if (o.hit.has(e) || !e.sprite?.active || e.health <= 0) continue;
                    if (Math.abs(e.x - tx) > 0 || Math.abs(e.y - ty) > 0) continue;
                    o.hit.add(e); Sfx.play(this, 'cspierce'); this.damageEnemy(e, C.PIERCE_DMG * ds * (S.tf?.full ? this._csCfg().TF3 : C).PIERCE_SHARE, 'cosmic');
                    if (e.health > 0 && e.sprite?.active) this._csHex(e, 2000);   // what it passes through is Hexed
                    if (o.drag && e.health > 0 && !e.isMortar && !e.isHealerTotem && !e.isAnchor) o.drag.push(e);
                }
                // stage 3: what it pierced is dragged along behind it, a tile at a time
                if (o.drag) for (const e of o.drag) this._csDragToward(e, tx, ty, now);
                if (f >= 1) {
                    o.done = true;
                    // a fast throw can outrun the per-frame drag: whatever it pierced finishes the
                    // trip now, up beside where it stopped
                    if (o.drag) for (const e of o.drag) for (let k = 0; k < 12; k++) { e._csDragAt = 0; const x0 = e.x, y0 = e.y; this._csDragToward(e, tx, ty, now); if (e.x === x0 && e.y === y0) break; }
                    if (o.fizz) this._csBurst(x, y, 14, col.lilac, 220);
                }
            }
            for (const im of c.impacts) {
                if (im.fired || t < im.t) continue;
                im.fired = true;
                this._csCollapseImpact(im.p.x, im.p.y, im.dmg * ds, im.rMul);
            }
            if (c.impacts.every(i => i.fired) && c.objs.every(o => o.done)) {
                for (const o of c.objs) { o.glow.destroy(); o.core.destroy(); }
                S.collapses.splice(S.collapses.indexOf(c), 1);
            }
        }
    }

    _csCollapseImpact(x, y, dmg, rMul = 1) {
        const S = this._cs, tf = S.tf, C = this._csCfg().TF, col = this._csCfg().COL, T = this.TILE_SIZE, R = (tf?.full ? this._csCfg().TF3 : C).COLLAPSE_R * rMul;
        const tx = x / T - 0.5, ty = y / T - 0.5;
        let n = 0;
        // the partial form's implosion: what's near is pulled in before it lands (the full
        // form's objects already drag what they pierce)
        if (tf && !tf.full) {
            const cx = Math.round(tx), cy = Math.round(ty), now = this.time.now;
            for (const e of this.enemies || []) {
                if (this._phasedOut?.(e)) continue;
                if (!e.sprite?.active || e.health <= 0 || e.isMortar || e.isHealerTotem || e.isAnchor) continue;
                if (Math.hypot(e.x - tx, e.y - ty) > C.PULL_R) continue;
                for (let k = 0; k < C.PULL; k++) { e._csDragAt = 0; this._csDragToward(e, cx, cy, now); }
            }
        }
        for (const e of [...(this.enemies || [])]) {
            if (!e.sprite?.active || e.health <= 0) continue;
            if (Math.hypot(e.x - tx, e.y - ty) > R + 0.01) continue;
            this.damageEnemy(e, dmg, 'cosmic'); n++;
            if (tf?.full && e.health > 0 && e.sprite?.active && !this._csCashHex(e)) this._csHex(e);   // the constellation cashes its Hex in (none: Hexed for the next)
        }
        n += this._csHitBosses(x, y, R * T, dmg, !!tf?.full);
        Sfx.play(this, 'collapse', { big: dmg > 14 * (this.damageScaling || 1), gold: !!tf?.full });
        // the form lasts longer for collapses that land
        if (tf?.phase === 'form' && n > 0) {
            const add = n >= 3 ? C.EXTEND_3 : C.EXTEND_1;
            tf.until = Math.min(tf.cap, tf.until + add);
            this.showStatusText(this.player.x, this.player.y - 30, `+${(add / 1000).toFixed(1)}s`, '#ffe08a');
        }
        // The impact: everything pulled in for a beat (an implosion), then a burst of light, the runes
        // of a circle thrown off, three rings of dust, streaks of light, debris flung out, a scar of
        // void left on the floor, and the camera punched in.
        const big = dmg > 14 * (this.damageScaling || 1), hue = tf?.full ? col.gold : col.lilac, RR = R * T, F = CosmicSystem.fx(this), HE = tf?.full ? F.gold : F.dust;
        CosmicSystem.inward(F.fine, x, y, RR * 0.9, 110, 10);
        const core = this.add.image(x, y, 'vfx_glow').setTint(hue).setBlendMode(Phaser.BlendModes.ADD).setDepth(4.7).setScale(0.7).setAlpha(0.6);
        this.tweens.add({ targets: core, scale: 0.08, alpha: 1, duration: 110, ease: 'Quad.easeIn', onComplete: () => {
            core.destroy();
            if (!this._cs) return;
            CosmicSystem.nova(this, x, y, 1, !!tf?.full);   // (small: these land again and again, and the pack under them must show)
            CosmicSystem.stamp(this, x, y, RR * 1.1, hue);
            [[F.fine, 1.1, 260, 18], [HE, 1.6, 420, 24], [F.dust, 2.3, 600, 28]].forEach(([E, sc, ms, n], i) =>
                this.time.delayedCall(i * 60, () => this._cs && CosmicSystem.ring(E, x, y, RR * sc * (big ? 1.25 : 1), ms, n, RR * 0.35)));
            for (let i = 0; i < 12; i++) {   // streaks: a few grains thrown along one line at different speeds
                const a = i * Math.PI / 6 + Math.random() * 0.2, l = RR * (1.3 + Math.random() * 0.8);
                CosmicSystem.puff(i % 3 ? HE : F.fine, x + Math.cos(a) * RR * 0.35, y + Math.sin(a) * RR * 0.35, 2, a, 0.03, l * 1.4, l * 3, 300);
            }
            CosmicSystem.puff(Math.random() < 0.5 ? HE : F.dust, x, y, big ? 12 : 8, 0, Math.PI, RR * 1.4, RR * 3.6, 560);
            const scar = VisualFX.aura(this, x, y, RR * 1.1, col.violet, { breathe: false, alpha: 1 });
            this.tweens.add({ targets: scar, alpha: 0, duration: 1400, ease: 'Quad.easeIn', onComplete: () => scar.destroy() });
            this._csBurst(x, y, RR, col.violet, 420);
            this._vfxFlash?.(x, y, RR * 2.4, hue, 320, 0.55);
            const cam = this.cameras.main;
            if (!S.charge && !cam._csPunch) {
                const z0 = cam.zoom; cam._csPunch = true;
                cam.setZoom(z0 * (big ? 1.05 : 1.03));
                this.tweens.addCounter({ from: 1, to: 0, duration: 200, ease: 'Quad.easeOut', onUpdate: tw => cam.setZoom(z0 * (1 + (big ? 0.05 : 0.03) * tw.getValue())), onComplete: () => { cam.setZoom(z0); cam._csPunch = false; } });
            }
        } });
        this.cameras.main.shake(big ? 220 : 140, big ? 0.012 : 0.007);
    }

    // A voidbeam from (x0, y0) through (x1, y1), world px: it travels BEAM_LEN tiles, bouncing
    // off walls (the axis it hit flips), and hits every enemy within BEAM_W tiles of its path,
    // once each. Drawn in light along its path: a magenta haze, a white core, sparks at every
    // bounce, fading as it goes.
    _csVoidbeam(x0, y0, x1, y1) {
        const C = this._csCfg().TF, col = this._csCfg().COL, T = this.TILE_SIZE, ds = this.damageScaling || 1;
        const wall = (x, y) => this.world?.[Math.floor(x / T)]?.[Math.floor(y / T)] !== this.FLOOR;
        let dx = x1 - x0, dy = y1 - y0;
        const L = Math.hypot(dx, dy) || 1; dx /= L; dy /= L;
        const pts = [{ x: x0, y: y0 }], step = T / 5;
        let x = x0, y = y0, bounces = 0;
        for (let d = 0; d < C.BEAM_LEN * T; d += step) {
            let nx = x + dx * step, ny = y + dy * step;
            if (wall(nx, ny)) {
                if (bounces >= C.BEAM_BOUNCES) { pts.push({ x, y }); break; }
                if (wall(nx, y)) dx = -dx;
                if (wall(x, ny)) dy = -dy;
                if (!wall(nx, y) && !wall(x, ny)) { dx = -dx; dy = -dy; }   // straight into a corner
                bounces++; pts.push({ x, y });
                this._csBurst(x, y, 12, col.hex, 200);
                nx = x + dx * step; ny = y + dy * step;
            }
            x = nx; y = ny;
        }
        if (pts.length === 1 || pts[pts.length - 1].x !== x) pts.push({ x, y });
        // what it touched: within BEAM_W tiles of any segment
        const hit = new Set();
        for (let i = 1; i < pts.length; i++) {
            const a = pts[i - 1], b = pts[i], vx = b.x - a.x, vy = b.y - a.y, l2 = vx * vx + vy * vy || 1;
            for (const e of this.enemies || []) {
                if (this._phasedOut?.(e)) continue;
                if (hit.has(e) || !e.sprite?.active || e.health <= 0) continue;
                const ex = e.x * T + T / 2, ey = e.y * T + T / 2, t = Math.max(0, Math.min(1, ((ex - a.x) * vx + (ey - a.y) * vy) / l2));
                if (Math.hypot(a.x + vx * t - ex, a.y + vy * t - ey) <= C.BEAM_W * T) hit.add(e);
            }
        }
        for (const e of hit) { this.damageEnemy(e, C.BEAM_DMG * ds, 'cosmic'); if (e.sprite?.active) this._csBurst(e.sprite.x, e.sprite.y, 10, col.hex, 160); }
        Sfx.play(this, 'csbeam');
        // the beam, laid in light along its path: a Hex-pink haze, a white core, motes shed off it; a flare where it leaves
        const F = CosmicSystem.fx(this);
        for (let i = 1; i < pts.length; i++) {
            const a = pts[i - 1], b = pts[i];
            CosmicSystem.along(F.pink, a.x, a.y, b.x, b.y, 3, 420, 14);
            CosmicSystem.along(F.fine, a.x, a.y, b.x, b.y, 2, 260, 3);
            CosmicSystem.along(F.dust, a.x, a.y, b.x, b.y, 22, 460, 30);
        }
        CosmicSystem.puff(F.pink, x0, y0, 8, Math.atan2(y1 - y0, x1 - x0), 0.5, 40, 120, 260);
        this._vfxFlash?.(x0, y0, 40, col.hex, 260, 0.8);
        return hit.size;
    }

    // One step toward tile (tx, ty) for a dragged enemy, if the next tile is open floor.
    _csDragToward(e, tx, ty, now) {
        if (!e.sprite?.active || e.health <= 0 || now - (e._csDragAt || 0) < this._csCfg().TF3.DRAG_STEP_MS) return;
        const dx = tx - e.x, dy = ty - e.y;
        if (Math.abs(dx) + Math.abs(dy) <= 1) return;
        const steps = Math.abs(dx) >= Math.abs(dy) ? [[Math.sign(dx), 0], [0, Math.sign(dy)]] : [[0, Math.sign(dy)], [Math.sign(dx), 0]];
        for (const [sx, sy] of steps) {
            if (!sx && !sy) continue;
            const nx = e.x + sx, ny = e.y + sy;
            if (this.world?.[nx]?.[ny] !== this.FLOOR || this.getEnemyAt(nx, ny) || (nx === this.playerX && ny === this.playerY)) continue;
            e.x = nx; e.y = ny; e._csDragAt = now;
            e._committedPath = null; e._pathIndex = undefined;
            const T = this.TILE_SIZE;
            this.tweens.add({ targets: e.sprite, x: nx * T + T / 2, y: ny * T + T / 2 + (this.SLIME_Y_OFFSET || 0), duration: 60, onUpdate: () => this.updateEnemyHealthBar?.(e) });
            return;
        }
    }

    // ── VOIDLETS ─────────────────────────────────────────────────────────────
    // Two allies out of the portal: a Warrior that walks to the nearest enemy and hits it, and a
    // Voidbeam that keeps by you and lasers the nearest enemy in range. HP, taunt, 10s.
    _csSpawnVoidlets(tx, ty) {
        const S = this._cs, C = this._csCfg().TF, col = this._csCfg().COL, T = this.TILE_SIZE, now = this.time.now;
        if (!S.voidlets) S.voidlets = [];
        const open = (x, y) => this.world?.[x]?.[y] === this.FLOOR && !this.getEnemyAt(x, y) && !(x === this.playerX && y === this.playerY) && !S.voidlets.some(v => v.ally.alive && v.ally.x === x && v.ally.y === y);
        const spot = () => { for (const [dx, dy] of [[-1, 0], [1, 0], [0, 1], [0, -1], [-1, 1], [1, 1], [-1, -1], [1, -1]]) if (open(tx + dx, ty + dy)) return { x: tx + dx, y: ty + dy }; return { x: tx, y: ty }; };
        const full = !!S.tf?.full, HP = full ? this._csCfg().TF3.VOIDLET_HP : C.VOIDLET_HP;
        for (const kind of (full ? this._csCfg().TF3.VOIDLETS : ['warrior', 'beam'])) {
            const at = spot(), px = at.x * T + T / 2, py = at.y * T + T / 2;
            const vk = kind === 'warrior' ? 'csu_vw' : 'csu_vb', SC = 1.5;
            // on the ground beside you (the crystal hovers a touch): VY lines their feet up with a slime's
            const VY = kind === 'warrior' ? 6 : 3;
            CosmicSystem.ultFx(this);
            const spr = this.add.sprite(px, py + (this.SLIME_Y_OFFSET || 0) + VY, 'fx_cosmic_ult', kind === 'warrior' ? 'vw_0' : 'vb_0').setScale(SC).setDepth(this.player.depth - 0.01).play(vk);
            CosmicSystem.puff(CosmicSystem.fx(this).dust, px, py, 10, -Math.PI / 2, 0.8, 20, 70, 450);   // stepping out of the dark
            const glow = this.add.image(px, py, 'vfx_glow').setTint(kind === 'warrior' ? col.violet : col.hex).setBlendMode(Phaser.BlendModes.ADD).setDepth(0.9).setScale(0.35).setAlpha(0.7);
            const eye = this.add.image(px, py, 'cs_sheet', 'mote').setVisible(false);   // (the sprite has its own eyes)
            const bar = this.add.graphics().setDepth(5);
            const v = { kind, spr, glow, eye, bar, VY, stepAt: now + 300, hitAt: now + 500, lock: null };
            v.ally = this._addAlly({
                x: at.x, y: at.y, hp: HP, maxHp: HP, taunt: C.VOIDLET_TAUNT, until: Infinity,   // the form's end sets it (_csTfEnd)
                hurt: (amt) => { v.ally.hp -= amt; spr.setTintFill(0xffffff); this.time.delayedCall(70, () => spr.active && spr.clearTint()); },
                onEnd: () => {
                    Sfx.play(this, 'pop');
                    this._csBurst(spr.x, spr.y, 22, col.violet, 260);
                    [spr, glow, eye, bar, v.reticle].forEach(o => o?.active && o.destroy());
                    S.voidlets?.splice(S.voidlets.indexOf(v), 1);
                },
            });
            spr.setScale(0.1); this.tweens.add({ targets: spr, scale: SC, duration: 260, ease: 'Back.easeOut' });
            S.voidlets.push(v);
        }
    }

    _csUpdateVoidlets(now) {
        const S = this._cs;
        if (!S.voidlets?.length) return;
        const C = this._csCfg().TF, col = this._csCfg().COL, T = this.TILE_SIZE, ds = this.damageScaling || 1;
        const nearest = (x, y, max) => {
            let best = null, bd = max + 0.01;
            for (const e of this.enemies || []) {
                if (!e.sprite?.active || e.health <= 0 || this._phasedOut?.(e)) continue;
                const d = Math.hypot(e.x - x, e.y - y);
                if (d < bd) { bd = d; best = e; }
            }
            return best;
        };
        const taken = (x, y, self) => this.world?.[x]?.[y] !== this.FLOOR || this.getEnemyAt(x, y) || (x === this.playerX && y === this.playerY)
            || S.voidlets.some(o => o !== self && o.ally.x === x && o.ally.y === y) || this.isInLockedRoom(x, y);
        const stepToward = (v, gx, gy) => {
            const a = v.ally, dx = Math.sign(gx - a.x), dy = Math.sign(gy - a.y);
            const tries = Math.abs(gx - a.x) >= Math.abs(gy - a.y) ? [[dx, 0], [0, dy]] : [[0, dy], [dx, 0]];
            for (const [sx, sy] of tries) {
                if (!sx && !sy) continue;
                if (taken(a.x + sx, a.y + sy, v)) continue;
                a.x += sx; a.y += sy;
                this.tweens.add({ targets: v.spr, x: a.x * T + T / 2, y: a.y * T + T / 2 + (this.SLIME_Y_OFFSET || 0) + v.VY, duration: 160 });
                return true;
            }
            return false;
        };
        const room = r => (this.rooms || []).findIndex(R => r.x >= R.x && r.x < R.x + R.w && r.y >= R.y && r.y < R.y + R.h);
        const pr = room({ x: this.playerX, y: this.playerY });
        for (const v of [...S.voidlets]) {
            const a = v.ally;
            if (!a.alive || !v.spr.active) continue;
            // left behind (a sealed door, another room): it blinks to your side
            if (pr >= 0 && room(a) !== pr && now >= (v.blinkAt || 0)) {
                v.blinkAt = now + 600;
                for (let d = 1; d <= 3; d++) { const spot = [[d, 0], [-d, 0], [0, d], [0, -d], [d, d], [-d, -d], [d, -d], [-d, d]].map(([dx, dy]) => ({ x: this.playerX + dx, y: this.playerY + dy })).find(q => !taken(q.x, q.y, v) && room(q) === pr);
                    if (!spot) continue;
                    this._csBurst(v.spr.x, v.spr.y, 20, col.violet, 220);
                    a.x = spot.x; a.y = spot.y; v.spr.setPosition(a.x * T + T / 2, a.y * T + T / 2 + (this.SLIME_Y_OFFSET || 0) + v.VY);
                    this._csBurst(v.spr.x, v.spr.y, 20, col.lilac, 220); break; }
            }
            const ex = v.spr.x, ey = v.spr.y - (this.SLIME_Y_OFFSET || 0) - v.VY;
            v.glow.setPosition(ex, ey + 4);
            v.spr.setFlipX(this.playerX < a.x);
            v.bar.clear(); v.bar.fillStyle(0x000000, 0.6).fillRect(ex - 10, ey - 22, 20, 3);
            v.bar.fillStyle(col.lilac, 1).fillRect(ex - 10, ey - 22, 20 * Math.max(0, a.hp) / (a.maxHp || C.VOIDLET_HP), 3);
            if ((a.until - now) < 1200) v.spr.setAlpha(Math.floor(now / 100) % 2 ? 0.45 : 1);
            if (v.kind === 'warrior') {
                const e = nearest(a.x, a.y, C.WARRIOR_SEEK);
                if (e && Math.abs(e.x - a.x) + Math.abs(e.y - a.y) <= 1) {
                    if (now >= v.hitAt) {
                        v.hitAt = now + C.WARRIOR_HIT_MS;
                        this.damageEnemy(e, C.WARRIOR_DMG * ds, 'cosmic');
                        this.tweens.add({ targets: v.spr, x: v.spr.x + (e.x - a.x) * 6, y: v.spr.y + (e.y - a.y) * 6, duration: 70, yoyo: true });
                        if (e.sprite?.active) this._csBurst(e.sprite.x, e.sprite.y, 12, col.violet, 160);
                    }
                } else if (now >= v.stepAt) {
                    v.stepAt = now + C.WARRIOR_STEP_MS;
                    if (e) stepToward(v, e.x, e.y);
                    else if (Math.abs(this.playerX - a.x) + Math.abs(this.playerY - a.y) > 2) stepToward(v, this.playerX, this.playerY);
                }
            } else {
                if (now >= v.stepAt) {
                    v.stepAt = now + C.WARRIOR_STEP_MS;
                    if (Math.abs(this.playerX - a.x) + Math.abs(this.playerY - a.y) > 2) stepToward(v, this.playerX, this.playerY);
                }
                // lock on (a reticle closes on the target), then fire the beam through it
                if (!v.lock && now >= v.hitAt) {
                    const e = nearest(a.x, a.y, C.BEAM_RANGE);
                    if (e) {
                        v.lock = { e, at: now };
                        v.reticle = v.reticle || this.add.sprite(0, 0, 'fx_cosmic_ult', 'reticle_0').setBlendMode(Phaser.BlendModes.ADD).setDepth(4.6).play('csu_reticle');
                    }
                }
                if (v.lock) {
                    const e = v.lock.e, k = Math.min(1, (now - v.lock.at) / C.BEAM_LOCK_MS);
                    if (!e.sprite?.active || e.health <= 0) { v.lock = null; v.reticle?.setVisible(false); }
                    else {
                        v.reticle.setVisible(true).setPosition(e.sprite.x, e.sprite.y).setScale((60 - 36 * k) / 15).setAlpha(0.4 + 0.6 * k);
                        if (k >= 1) {
                            v.reticle.setVisible(false);
                            this._csVoidbeam(ex, ey - 4, e.sprite.x, e.sprite.y);
                            v.lock = null; v.hitAt = now + C.BEAM_MS;
                        }
                    }
                }
            }
        }
    }

    // ── EVERY FRAME ──────────────────────────────────────────────────────────
    // From GameScene.update (after _cfxUpdate).
    _csUpdate(time, delta) {
        const S = this._cs;
        if (!S) return;
        const C = this._csCfg(), now = this.time.now, dt = Math.min(100, delta || 16);
        if (now >= S.unlockCheckAt) { S.unlockCheckAt = now + 2000; S.unlocked = this._csUnlockedNow(); }
        if (this._csStage() >= 2) this._csUpdateCharge(now, dt);
        this._csTfUpdate(now, dt);
        this._csUpdateCollapses(now);
        this._csUpdateVoidlets(now);
        if (S.ascendUntil && now >= S.ascendUntil) {
            this._csSupernova();
            this._csAscendBlast();
            this._csHpBoostEnd('ascend');
            S.ascendUntil = 0;
            if (this._csWeapon() === 'cosmic_fists') S.momentumAt = now;   // the stacks stay for their usual 8s
        }
        if (S.wards.length && now >= S.wardsUntil) {
            for (const w of S.wards) this.tweens.add({ targets: [w.img, w.glow], alpha: 0, scale: 0, duration: 200, onComplete: () => { w.img.destroy(); w.glow.destroy(); } });
            S.wards = [];
        }
        this._csSweepProjectiles();
        this._csUpdateStars(now);
        this._csUpdateBlade(now);
        if (this._csAscending()) {
            const k = this.playerX + ',' + this.playerY;   // a trail of fluid where you've been
            if (k !== S.ascendTile) { S.ascendTile = k; this._csFluidTile(this.playerX, this.playerY, now, this._csCfg().ASCEND.FLUID_MS, this._csCfg().ASCEND.HEX_MS); }
            if (now >= S.ascendWaveAt) { S.ascendWaveAt = now + this._csCfg().ASCEND.WAVE_EVERY; this._csAscendWave(); }
        }
        this._csUpdateFluid(now);
        this._csUpdateWellBeam(now);
        this._csUpdateWell(now, dt);
        this._csFlyTick(now);
        this._csStasisTick(now);
        this._csRewindRecord(now);
        this._csRewindTick(now);
        this._csUpdateMarks(now);
        this.damageReductionMultiplier = this._csTakenMult();
        this._csDrawFx(now, dt);
        this._csDrawTray(now);
    }

    // Wards against the projectile kinds that don't go through enemyProjectiles.
    _csSweepProjectiles() {
        const S = this._cs;
        if (!S.wards.length || !this.player?.active) return;
        const T = this.TILE_SIZE, CATCH = this._csCfg().BARRIER.CATCH;
        const cx = this.playerX * T + T / 2, cy = this.playerY * T + T / 2;
        const near = (x, y) => S.wards.length > 0 && Math.hypot(x - cx, y - cy) <= CATCH;
        const ep = this.enemyProjectiles;
        if (ep) for (let i = ep.length - 1; i >= 0; i--) {
            const p = ep[i], x = p.isRopeTendril ? p._tipX : p.gfx?.x, y = p.isRopeTendril ? p._tipY : p.gfx?.y;
            if (x === undefined || !near(x, y)) continue;
            this._csWardEat(x, y, p); this._destroyEnemyProjectile?.(p); ep.splice(i, 1);
        }
        for (const b of [...(this._cavs || [])]) {   // cavitation bubbles (LevelManager._cavBubble)
            if (!near(b.x, b.y)) continue;
            this._csWardEat(b.x, b.y); this._cavBurst(b, true);
        }
        const vr = this._voidRipples;
        if (vr) for (let i = vr.length - 1; i >= 0; i--) {
            const r = vr[i];
            if (!r.gfx?.active || !near(r.gfx.x, r.gfx.y)) continue;
            this._csWardEat(r.gfx.x, r.gfx.y); r.gfx.destroy(); vr.splice(i, 1);
        }
        const boss = this.voltslimeBoss;
        if (boss?.active) for (const arr of [boss.projectiles, boss.homingProjectiles]) {
            if (!arr) continue;
            for (let i = arr.length - 1; i >= 0; i--) {
                const p = arr[i];
                if (!p.g?.active || !near(p.g.x, p.g.y)) continue;
                this._csWardEat(p.g.x, p.g.y); p.g.destroy(); arr.splice(i, 1);
            }
        }
    }

    _csUpdateWell(now, dt) {
        const S = this._cs, W = S.well;
        if (!W) return;
        const C = this._csCfg().WELL, T = this.TILE_SIZE;
        W.glow.setAlpha(0.55 + 0.15 * Math.sin(now * 0.008));
        // it grows as it feeds: its reach from GROW_FROM to GROW_TO of RADIUS over its life
        W.r = C.RADIUS * (C.GROW_FROM + (C.GROW_TO - C.GROW_FROM) * Math.min(1, (now - W.t0) / C.MS));
        W.glow.setScale(0.85 * W.r / C.RADIUS);
        // dust drawn in from its edge in three arms (the swirl winds them into a spiral), a little scattered between, so
        // its reach is where the dust begins
        const arm = now * 0.0016;
        for (let i = Math.round(dt / 6 + Math.random()); i > 0; i--) {
            const a = Math.random() < 0.7 ? arm + Math.floor(Math.random() * 3) * Math.PI * 2 / 3 + (Math.random() - 0.5) * 0.35 : Math.random() * Math.PI * 2;
            const r = W.r * T * (0.92 + Math.random() * 0.08);
            W.ring.emitParticleAt(W.x + Math.cos(a) * r, W.y + Math.sin(a) * r * 0.6, 1);
        }
        if (now >= W.tickAt) {
            W.tickAt = now + C.TICK;
            const dmg = C.DMG * (this.damageScaling || 1);
            for (const e of [...(this.enemies || [])]) {
                if (!e.sprite?.active || e.health <= 0 || this._phasedOut?.(e)) continue;
                if (Math.hypot(e.x - W.tx, e.y - W.ty) > W.r + 0.01) continue;
                this.damageEnemy(e, dmg, 'cosmic');
                if (e.health > 0 && e.sprite?.active) this._csPull(e, W);
                // the longer it's held in the well, the deeper the Hex (and it lets go soon after)
                if (now - (e._csWellAt ?? -1e9) > C.TICK * 2) e._csWellSince = now;   // (re)entered
                e._csWellAt = now;
                const want = Math.min(3, 1 + Math.floor((now - e._csWellSince) / C.HEX_RAMP));
                const live = (e._csHexUntil || 0) > now ? (e._csHexStacks || 0) : 0;
                if (live < want) this._csHex(e, C.HEX_AFTER);
                else e._csHexUntil = Math.max(e._csHexUntil || 0, now + C.HEX_AFTER);
            }
            // a boss in its reach (bosses aren't in this.enemies) takes the tick too, its Hex with it (damageBossAtTile); too big to pull
            for (const b of [this.voltslimeBoss, this.voidSovereignBoss]) {
                if (!b?.active || !b.container) continue;
                const bx = b.container.x, by = b.container.y + (b === this.voidSovereignBoss ? (this.SLIME_Y_OFFSET || 0) : 0);
                if (Math.hypot(bx - W.x, by - W.y) > (W.r + 1.5) * T) continue;
                this.damageBossAtTile(Math.floor(bx / T), Math.floor(by / T), dmg, 'well', 'cosmic');
            }
        }
        if (now >= W.until) this._csWellEnd(false);
    }

    // One tile toward the well, if that tile is free. Things rooted to the spot stay put.
    _csPull(e, W) {
        if (e.isMortar || e.isHealerTotem || e.isAnchor || this._phasedOut?.(e)) return;
        const ddx = W.tx - e.x, ddy = W.ty - e.y;
        if (Math.abs(ddx) + Math.abs(ddy) <= 0) return;
        const steps = Math.abs(ddx) >= Math.abs(ddy)
            ? [[Math.sign(ddx), 0], [0, Math.sign(ddy)]] : [[0, Math.sign(ddy)], [Math.sign(ddx), 0]];
        for (const [sx, sy] of steps) {
            if (!sx && !sy) continue;
            const nx = e.x + sx, ny = e.y + sy;
            if (this.world?.[nx]?.[ny] !== this.FLOOR) continue;
            if (this.getEnemyAt(nx, ny)) continue;
            if (nx === this.playerX && ny === this.playerY) continue;
            e.x = nx; e.y = ny;
            e._committedPath = null; e._pathIndex = undefined;
            const T = this.TILE_SIZE;
            this.tweens.add({ targets: e.sprite, x: nx * T + T / 2, y: ny * T + T / 2 + (this.SLIME_Y_OFFSET || 0),
                              duration: 200, ease: 'Quad.easeOut', onUpdate: () => this.updateEnemyHealthBar?.(e) });
            return;
        }
    }

    _csUpdateMarks(now) {
        const S = this._cs, M = this._csCfg().MARK_MS;
        for (const e of this.enemies || []) {
            if ((e.cosmicMarks || 0) > 0 && now - (e._csMarkAt || 0) > M) e.cosmicMarks = 0;
        }
        // a Hex runs out a stack at a time: when its timer ends with more than one stack, one falls off and
        // the rest hold another second (like burn), instead of all of them dropping at once
        for (const e of this.enemies || []) {
            if ((e._csHexStacks || 0) > 1 && e._csHexUntil && e._csHexUntil <= now) { e._csHexStacks--; e._csHexUntil = now + 1000; }
        }
        // (old hex sigils, cleared: the Hex shows as its orbiting stacks now, CreatureFX)
        for (const [e, img] of S.hexFx) {
            if (e.sprite?.active && (e._csHexUntil || 0) > now) continue;
            img.destroy(); S.hexFx.delete(e);
        }
    }

    // The boons, worn: wards orbiting, a shell, thorns, gold sparks, afterimages, Ascend's glow.
    _csDrawFx(now, dt) {
        const S = this._cs, C = this._csCfg(), col = C.COL, p = this.player;
        if (!p?.active) return;
        const fx = S.fx, d = p.depth || 1;
        const keep = (k, make) => fx[k] || (fx[k] = make());
        const drop = k => { if (fx[k]) { fx[k].destroy(); fx[k] = null; } };
        const cx = p.x, cy = p.y + 2;
        // wards
        if (S.wards.length) {
            S.wardAngle += C.BARRIER.SPIN * dt / 1000;
            const n = S.wards.length, R = C.BARRIER.ORBIT;
            S.wards.forEach((w, i) => {
                const a = S.wardAngle + i * Math.PI * 2 / n, sn = Math.sin(a);
                const x = cx + Math.cos(a) * R, y = cy + sn * R * 0.55;
                w.img.setPosition(Math.round(x), Math.round(y - 4)).setDepth(sn > 0 ? d + 0.01 : d - 0.01);
                w.glow.setPosition(x, y - 4);
                if (Math.random() < dt / 110) CosmicSystem.fx(this).fine.emitParticleAt(x + (Math.random() - 0.5) * 4, y - 4 + (Math.random() - 0.5) * 6, 1);   // a glitter left behind it
                const left = S.wardsUntil - now;
                w.img.setAlpha(left < 1200 && !this._csAscending() ? (Math.floor(now / 100) % 2 ? 0.4 : 1) : 1);
            });
        }
        // Event Horizon: a shell of the dark between stars round you (hand-drawn, a glint going round its rim), a deep
        // violet light in it, stars glinting in it; struck, it flares and swells for a moment
        if (now < S.horizonUntil) {
            const F = CosmicSystem.fx(this);
            const sh = keep('horizon', () => this.add.sprite(cx, cy, 'fx_cosmic', 'shell_0').setBlendMode(Phaser.BlendModes.ADD).play('csw_shell'));
            const gl = keep('horizonGlow', () => this.add.image(cx, cy, 'vfx_glow').setTint(0x6a2ac8).setBlendMode(Phaser.BlendModes.ADD));
            const left = S.horizonUntil - now, fade = Math.min(1, (now - (S.horizonAt ??= now)) / 200) * (left < 1200 ? 0.45 + 0.55 * (Math.floor(now / 100) % 2) : 1);
            const hit = Math.max(0, 1 - (now - (S.horizonHitAt || 0)) / 260);
            sh.setPosition(Math.round(cx), Math.round(cy)).setDepth(d + 0.02).setScale(1.3 * (1 + 0.1 * hit)).setAlpha(fade * (0.7 + 0.3 * hit));
            gl.setPosition(cx, cy).setDepth(d - 0.03).setScale(0.55 + 0.1 * hit).setAlpha((0.3 + 0.3 * hit) * fade);
            if (Math.random() < dt / 110) { const a = Math.random() * Math.PI * 2, r = Math.random() * 20; F.fine.emitParticleAt(cx + Math.cos(a) * r, cy + Math.sin(a) * r * 0.8, 1); }
        } else { S.horizonAt = undefined; drop('horizon'); drop('horizonGlow'); }
        // Retribution: a crown of thorns round your feet (hand-drawn, its tips glinting), bigger for a moment after they bit
        if (now < S.retributionUntil) {
            const t = keep('thorns', () => { CosmicSystem.fx(this); return this.add.sprite(cx, cy, 'fx_cosmic', 'thorns_0').setBlendMode(Phaser.BlendModes.ADD).play('csw_thorns'); });
            const bite = Math.max(0, 1 - (now - S.retAt) / 300);
            t.setPosition(Math.round(cx), Math.round(cy + 5)).setDepth(d - 0.02)
             .setScale(1.15 + 0.3 * bite).setAlpha((S.retributionUntil - now < 1200 ? 0.35 : 0.6) + 0.4 * bite);
        } else drop('thorns');
        // Starfall: while the window is open, a gold spark circles you per star you've picked up
        if (S.astro?.got) {
            for (let i = 0; i < 3; i++) {
                const k = 'tail' + i;
                if (i >= S.astro.got) { drop(k); continue; }
                const s = keep(k, () => this.add.image(cx, cy, 'fx_cosmic', 'p_1').setBlendMode(Phaser.BlendModes.ADD).setTint(col.gold));
                const a = now * 0.005 + i * Math.PI * 2 / 3, sn = Math.sin(a);
                s.setPosition(cx + Math.cos(a) * 12, cy - 6 + sn * 5 - ((now * 0.02 + i * 7) % 10))
                 .setDepth(sn > 0 ? d + 0.01 : d - 0.01).setScale(1 + 0.3 * sn).setAlpha(0.9);
            }
        } else { drop('tail0'); drop('tail1'); drop('tail2'); }
        // Momentum: violet afterimages while you move
        const moved = Math.hypot(p.x - S.lastPX, p.y - S.lastPY) > 0.5;
        S.lastPX = p.x; S.lastPY = p.y;
        if (this._csMomentum() > 0 && moved && now - S.ghostAt > 70) {
            S.ghostAt = now;
            const g = this.add.image(p.x, p.y, p.texture.key, p.frame.name).setScale(p.scaleX, p.scaleY)
                .setTint(col.violet).setAlpha(0.18 + 0.07 * this._csMomentum()).setBlendMode(Phaser.BlendModes.ADD).setDepth(d - 0.03);
            this.tweens.add({ targets: g, alpha: 0, duration: 260, onComplete: () => g.destroy() });
        }
        // Ascend: a glow, a halo, rising motes, and the screen's edge
        if (this._csAscending()) {
            const gl = keep('aura', () => this.add.image(cx, cy, 'vfx_glow').setTint(col.violet).setBlendMode(Phaser.BlendModes.ADD));
            gl.setPosition(cx, cy).setDepth(0.9).setScale(0.75 + 0.08 * Math.sin(now * 0.012)).setAlpha(0.8);
            // the halo comes down onto you as it starts, then floats there, a glint going round it
            const h = keep('halo', () => { CosmicSystem.ultFx(this); return this.add.sprite(cx, cy, 'fx_cosmic_ult', 'halo_0').play('csu_halo'); });
            const k = Math.min(1, (now - S.ascendAt) / 380);
            h.setPosition(Math.round(p.x), Math.round(p.y - 15 - 26 * (1 - k) * (1 - k) + Math.sin(now * 0.008) * 1.5)).setDepth(d + 0.03).setAlpha(k);
            if (Math.random() < dt / 30) {   // stardust rising off you
                const F = CosmicSystem.fx(this);
                CosmicSystem.puff(Math.random() < 0.35 ? F.gold : F.fine, p.x + (Math.random() - 0.5) * 18, p.y + 6, 1, -Math.PI / 2, 0.2, 25, 50, 650 + Math.random() * 250);
            }
            if (this.textures.exists('vfx_edge')) {
                const W = this.scale.width, H = this.scale.height;
                const e = keep('edge', () => this.add.image(W / 2, H / 2, 'vfx_edge').setDisplaySize(W, H).setScrollFactor(0).setDepth(28).setTint(col.violet));
                const left = S.ascendUntil - now;
                e.setAlpha((left < 1000 ? left / 1000 : 1) * (0.3 + 0.08 * Math.sin(now * 0.01)));
            }
        } else { drop('aura'); drop('halo'); drop('edge'); }
    }

    // Light for the real light pass (Creatures.js asks for it in _cfxLights).
    _csLights(time) {
        const S = this._cs, out = [];
        if (!S || !this.player?.active) return out;
        const col = this._csCfg().COL, p = this.player;
        if (this._csAscending()) out.push({ x: p.x, y: p.y + 4, r: 110 + 10 * Math.sin(time * 0.01), color: col.violet, a: 0.7, g: 0.32 });
        else if (S.wards.length) out.push({ x: p.x, y: p.y + 4, r: 58, color: col.violet, a: 0.45, g: 0.18 });
        if (S.well) out.push({ x: S.well.x, y: S.well.y, r: 90, color: col.violet, a: 0.55, g: 0.24 });
        for (const s of S.stars) out.push({ x: s.x, y: s.y, r: 44, color: col.gold, a: 0.6, g: 0.25 });
        return out;
    }

    // ── HUD ──────────────────────────────────────────────────────────────────
    // A capsule to the right of the ult gems: the cosmic weapon, what its boon is doing, and a
    // bar (the boon running down, or the cooldown filling).
    _csBuildTray() {
        this._csTrayG = this.add.graphics().setScrollFactor(0).setDepth(31);
        this._csTrayIcon = this.add.image(0, 0, ...this._csTrayArt(false)).setScrollFactor(0).setDepth(32).setScale(2);
        this._csTrayText = this.add.text(0, 0, '', {
            fontSize: '11px', fontFamily: 'monospace', fontStyle: 'bold', color: '#e2d2ff', stroke: '#05060a', strokeThickness: 3,
        }).setOrigin(0, 0.5).setScrollFactor(0).setDepth(32);
    }

    _csTrayState(now) {
        const S = this._cs, C = this._csCfg(), w = this._csWeapon();
        const tf = S.tf;
        if (tf) {
            if (tf.phase === 'form') return { label: `COLLAPSE ${((tf.until - now) / 1000).toFixed(1)}s`, frac: (tf.until - now) / C.TF.FORM_MS, mode: 'ascend' };
            return { label: tf.phase === 'turn' ? 'TURNING...' : tf.phase === 'aim' ? 'CHOOSE WHERE' : 'RIFT DROP', frac: tf.phase === 'turn' ? (now - tf.at) / C.TF.TURN_MS : 1, mode: 'ascend' };
        }
        if (this._csAscending()) return { label: 'ASCEND', frac: (S.ascendUntil - now) / C.ASCEND.MS, mode: 'ascend' };
        if (w === 'cosmic_fists') {
            const m = this._csMomentum();
            if (m > 0) return { label: `MOMENTUM ×${m}`, frac: 1 - (now - S.momentumAt) / C.FISTS.MS, mode: 'boon', pips: m };
            return { label: 'VOID FISTS', frac: 0, mode: 'idle', pips: 0 };
        }
        const boon = w === 'barrier_staff' ? (S.wards.length ? [`WARDS ×${S.wards.length}`, (S.wardsUntil - now) / C.BARRIER.MS] : null)
            : w === 'astrolabe' ? (S.astro ? [`STARFALL ★${S.astro.got}`, (S.astro.until - now) / C.ASTRO.WINDOW]
                : S.astral.size ? [`ASTRAL ×${S.astral.size}`, 1] : null)
            : w === 'singularity_staff' ? (now < S.horizonUntil ? ['HORIZON -30%', (S.horizonUntil - now) / (C.WELL.MS + C.WELL.AFTER)] : null)
            : w === 'void_blade' ? (S.fluid?.some(t => !t.dash) && S.fluidSpan ? ['COSMIC FLUID', (S.fluidSpan.to - now) / (S.fluidSpan.to - S.fluidSpan.from)] : now < S.retributionUntil ? ['RETRIBUTION', (S.retributionUntil - now) / C.BLADE.MS] : null)
            : w === 'pendulum' ? (S.stasis ? [`TIME LOCK ${((S.stasis.until - now) / 1000).toFixed(1)}s`, (S.stasis.until - now) / C.PEND.TLOCK.MS] : null) : null;
        if (boon) return { label: boon[0], frac: boon[1], mode: 'boon', cd: now < S.cdUntil };
        if (now < S.cdUntil) {
            const cd = { barrier_staff: C.BARRIER.CD, astrolabe: C.ASTRO.CD, singularity_staff: C.WELL.CD, void_blade: C.BLADE.CD, pendulum: S.cdMs || C.PEND.STASIS_CD }[w] || 12000;   // (the Pendulum's: whichever of its two set it)
            return { label: `${C.NAMES[w] || w}  ${Math.ceil((S.cdUntil - now) / 1000)}s`, frac: 1 - (S.cdUntil - now) / cd, mode: 'cd' };
        }
        return { label: `${C.NAMES[w] || w}  READY`, frac: 1, mode: 'ready' };
    }
    // the tray's icon: cs_sheet's, the Pendulum's in its own sheet (fx_pendulum)
    _csTrayArt(asc) { return asc ? ['cs_sheet', 'i_ascend'] : this._csWeapon() === 'pendulum' ? ['fx_pendulum', 'i_pendulum'] : ['cs_sheet', 'i_' + this._csWeapon()]; }

    _csDrawTray(now) {
        const g = this._csTrayG;
        if (!g?.active) return;
        const S = this._cs, on = S.unlocked && !this._deathScreenActive;
        g.clear();
        this._csTrayIcon.setVisible(on); this._csTrayText.setVisible(on);
        if (!on) return;
        const C = this._csCfg(), col = C.COL;
        const W = this.scale.width, H = this.scale.height;
        const x0 = Math.round(W / 2 + 121), y = Math.round(H - 36), w = 140, h = 30;
        const st = this._csTrayState(now);
        const asc = st.mode === 'ascend', live = asc || st.mode === 'boon';
        const accent = asc ? col.gold : st.mode === 'boon' ? (this._csWeapon() === 'void_blade' ? col.hex : ['astrolabe', 'pendulum'].includes(this._csWeapon()) ? col.gold : col.violet)
                     : st.mode === 'ready' ? col.lilac : 0x6a6286;
        g.fillStyle(0x090b14, 0.82); g.fillRoundedRect(x0, y - h / 2, w, h, 8);
        g.lineStyle(1, live ? accent : 0x2b3256, live ? 0.9 : 0.9); g.strokeRoundedRect(x0 + 0.5, y - h / 2 + 0.5, w - 1, h - 1, 8);
        // the icon in a socket
        g.fillStyle(0x05060a, 0.9); g.fillCircle(x0 + 16, y, 12);
        g.lineStyle(1.5, accent, live || st.mode === 'ready' ? 0.95 : 0.4); g.strokeCircle(x0 + 16, y, 12);
        if (st.mode === 'cd') {   // the cooldown, sweeping back round the socket
            g.fillStyle(0x000000, 0.55);
            g.slice(x0 + 16, y, 12, -Math.PI / 2, -Math.PI / 2 + (1 - st.frac) * Math.PI * 2, false); g.fillPath();
        }
        if (st.mode === 'ready') {
            const k = 0.5 + 0.5 * Math.sin(now / 220);
            g.lineStyle(1.5, col.lilac, 0.25 + 0.35 * k); g.strokeCircle(x0 + 16, y, 14 + 2 * k);
        }
        this._csTrayIcon.setTexture(...this._csTrayArt(asc)).setPosition(x0 + 16, y)
            .setAlpha(st.mode === 'cd' || st.mode === 'idle' ? 0.5 : 1);
        // label and bar
        const bx = x0 + 34, bw = w - 44, by = y + 6;
        this._csTrayText.setPosition(bx, y - 5).setText(st.label)
            .setColor(asc ? '#ffe08a' : live ? '#f0e4ff' : st.mode === 'ready' ? '#d9c4ff' : '#8a84a6');
        g.fillStyle(0x1a1430, 1); g.fillRect(bx, by, bw, 4);
        const f = Math.max(0, Math.min(1, st.frac || 0));
        if (f > 0) { g.fillStyle(accent, live ? 1 : 0.55); g.fillRect(bx, by, Math.round(bw * f), 4); }
        if (st.pips) {   // momentum: a diamond per stack, right of the label
            for (let i = 0; i < this._csCfg().FISTS.MAX; i++) {
                const px = x0 + w - 12 - (this._csCfg().FISTS.MAX - 1 - i) * 7, py = y - 5;
                g.fillStyle(i < st.pips ? col.violet : 0x2b2540, 1);
                g.fillTriangle(px, py - 3, px + 3, py, px, py + 3); g.fillTriangle(px, py - 3, px - 3, py, px, py + 3);
            }
        }
    }

    // ── LITTLE PIECES ────────────────────────────────────────────────────────
    _csCastFx(label, color) {
        const p = this.player;
        if (!p?.active) return;
        this._csBurst(p.x, p.y + 2, 34, color, 300);
        this._vfxFlash?.(p.x, p.y, 120, color, 320, 0.8);
        this.showStatusText(p.x, p.y - 30, label, '#' + color.toString(16).padStart(6, '0'));
    }

    // A burst going out from (x, y) to radius r over ms: a ring of hand-drawn dust flung out, gold, Hex pink or violet by colour
    _csBurst(x, y, r, color, ms) {
        const F = CosmicSystem.fx(this), C = this._csCfg().COL;
        const E = color === C.gold || color === 0xffe08a ? F.gold : color === C.hex ? F.pink : F.dust;
        CosmicSystem.ring(E, x, y, Math.max(6, r), ms, Math.max(6, Math.min(30, Math.round(r / 2.5))));
    }

    // The ult's name across the screen (Visuals.js draws the other three).
    // Extra max HP for a while (key: 'ascend' or 'tf'): max HP rises by frac and you're healed by the same; when it ends
    // the extra comes off max HP again (your health can't sit above it)
    _csHpBoost(key, frac) {
        const S = this._cs; if (!S) return;
        this._csHpBoostEnd(key);
        const add = Math.round(this.maxHealth * frac);
        (S.hpBoost ||= {})[key] = add;
        this.maxHealth += add; this.health = Math.min(this.maxHealth, this.health + add);
        if (this.player?.active) this.showStatusText(this.player.x, this.player.y - 30, `+${add} MAX HP`, '#9aff8a');
        this.updateHealthBar?.();
    }
    _csHpBoostEnd(key) {
        const S = this._cs, add = S?.hpBoost?.[key]; if (!add) return;
        delete S.hpBoost[key];
        this.maxHealth = Math.max(1, this.maxHealth - add); this.health = Math.min(this.health, this.maxHealth);
        this.updateHealthBar?.();
    }
    // ── THE DOMAIN ───────────────────────────────────────────────────────────
    // A transformation seals you in with them: the line, the world outside the room going black and the room itself
    // turning a deep cosmic dusk, stars drifting in it. The partial form sends Hex tides across it; the full one floods it.
    _csDomainRect() {
        const ri = this.getCurrentPlayerRoom?.() ?? -1, R = ri >= 0 ? this.rooms?.[ri] : null;
        return R ? { x: R.x, y: R.y, w: R.w, h: R.h } : { x: this.playerX - 9, y: this.playerY - 6, w: 19, h: 13 };   // (between rooms: the ground round you)
    }
    _csDomainLine(color) {
        const W = this.scale.width, H = this.scale.height, css = '#' + color.toString(16).padStart(6, '0'), D = 27;
        const words = ["YOU'RE", 'IN', 'MY', 'DOMAIN', 'NOW'], objs = [];
        const big = this.add.text(W / 2, H * 0.3, '', { fontSize: '58px', fontFamily: UIKit.FONT.title, fontStyle: 'bold', color: '#ffffff', stroke: css, strokeThickness: 7, padding: { x: 30, y: 30 } }).setOrigin(0.5).setScrollFactor(0).setDepth(D);
        big.setShadow(0, 0, css, 26, true, true); objs.push(big);
        words.forEach((w, i) => this.time.delayedCall(i * 170, () => {   // a word at a time, each one landing with a thud
            big.setText(words.slice(0, i + 1).join(' ')).setScale(1.25); this.tweens.add({ targets: big, scale: 1, duration: 140, ease: 'Back.easeOut' });
            this.cameras.main.shake(90, 0.003 + i * 0.001); Sfx.play(this, i === words.length - 1 ? 'e_snap' : 'e_tick', { p: i / 4 });
        }));
        const full = this.add.text(0, 0, words.join(' '), big.style).setVisible(false), bw = full.width - 60; full.destroy();   // the whole line's width (its padding off)
        const bar = this.add.rectangle(W / 2, H * 0.3 + 40, bw, 4, color, 1).setScrollFactor(0).setDepth(D).setScale(0, 1); objs.push(bar);   // grows out from the middle
        this.tweens.add({ targets: bar, scaleX: 1, duration: 900, ease: 'Cubic.easeOut' });
        this.time.delayedCall(2100, () => this.tweens.add({ targets: objs, alpha: 0, y: '-=18', duration: 500, onComplete: () => objs.forEach(o => o.destroy()) }));
    }
    _csDomainBegin() {
        this._csDomainEnd();
        const S = this._cs, C = this._csCfg().TF, col = this._csCfg().COL, T = this.TILE_SIZE, R = this._csDomainRect(), big = 6000;
        const x0 = R.x * T, y0 = R.y * T, x1 = (R.x + R.w) * T, y1 = (R.y + R.h) * T, objs = [];
        // outside: black, every side of the room
        for (const [x, y, w, h] of [[x0 - big, y0 - big, big * 2 + (x1 - x0), big], [x0 - big, y1, big * 2 + (x1 - x0), big], [x0 - big, y0, big, y1 - y0], [x1, y0, big, y1 - y0]])
            objs.push(this.add.rectangle(x, y, w, h, 0x020008, 1).setOrigin(0).setDepth(6.5).setAlpha(0));
        // inside: the dusk of another place, and its stars
        objs.push(this.add.rectangle(x0, y0, x1 - x0, y1 - y0, 0x1a0638, 0.5).setOrigin(0).setDepth(0.95).setAlpha(0));
        // its edge: a line of light round the room, glowing outward, a star at each corner (typed pieces laid tile by tile)
        const K = 'fx_cosmic_ult', ADD = Phaser.BlendModes.ADD, edge = [];
        for (let x = x0; x < x1; x += T) edge.push(this.add.image(x, y0, K, 'rim_h').setOrigin(0, 0.5), this.add.image(x, y1, K, 'rim_h').setOrigin(0, 0.5).setFlipY(true));
        for (let y = y0; y < y1; y += T) edge.push(this.add.image(x0, y, K, 'rim_v').setOrigin(0.5, 0).setFlipX(true), this.add.image(x1, y, K, 'rim_v').setOrigin(0.5, 0));
        for (const [x, y] of [[x0, y0], [x1, y0], [x0, y1], [x1, y1]]) edge.push(this.add.image(x, y, K, 'rim_c').setScale(2));
        edge.forEach(o => o.setBlendMode(ADD).setScale(o.scaleX * T / 24, o.scaleY * T / 24));
        const rim = this.add.container(0, 0, edge).setDepth(6.6).setAlpha(0); objs.push(rim);
        const stars = this.add.particles(0, 0, 'fx_cosmic', { frame: ['p_0', 'p_1', 'p_6', 'p_7', 'p_9'], x: { min: x0, max: x1 }, y: { min: y0, max: y1 }, lifespan: 2600, speedY: { min: -10, max: -2 }, scale: { start: 1, end: 0.3 }, alpha: { start: 0.9, end: 0 },
            tint: [0xffffff, col.lilac, col.hex], blendMode: 'ADD', frequency: Math.max(20, 9000 / (R.w * R.h)) }).setDepth(5).setAlpha(0);
        objs.push(stars);
        objs.forEach(o => this.tweens.add({ targets: o, alpha: o === objs[4] ? 0.5 : 1, duration: C.DOMAIN_FADE }));
        if (objs[4]) objs[4].setFillStyle(0x1a0638, 1);
        S.domain = { R, objs, waveAt: Infinity, flood: false };
    }
    // the partial form: a tide of fluid 1-2 tiles wide washing from one corner of the room to the far one, slow and spaced
    _csDomainTide() {
        const S = this._cs, Dm = S.domain, C = this._csCfg().TF, R = Dm.R, now = this.time.now;
        const sx = Math.random() < 0.5 ? 1 : -1, sy = Math.random() < 0.5 ? 1 : -1, cx = sx > 0 ? R.x : R.x + R.w - 1, cy = sy > 0 ? R.y : R.y + R.h - 1;
        const w = C.WAVE_W[0] + Math.floor(Math.random() * (C.WAVE_W[1] - C.WAVE_W[0] + 1));
        for (let x = R.x; x < R.x + R.w; x++) for (let y = R.y; y < R.y + R.h; y++) {
            const d = (x - cx) * sx + (y - cy) * sy;   // diagonal steps from the corner
            this._csFluidTile(x, y, now + d * C.WAVE_STEP, w * C.WAVE_STEP, C.WAVE_HEX);
        }
        Sfx.play(this, 'whoosh');
    }
    // the full form: the whole room's floor fluid till the form ends
    _csDomainFlood(until) {
        const S = this._cs, R = S.domain.R, C = this._csCfg().TF, now = this.time.now;
        S.domain.flood = true;
        for (let x = R.x; x < R.x + R.w; x++) for (let y = R.y; y < R.y + R.h; y++) {
            const d = Math.hypot(x - this.playerX, y - this.playerY);
            if (this._csFluidTile(x, y, now + d * 40, until - now, C.FLOOD_HEX)) { const t = S.fluid[S.fluid.length - 1]; if (t.x === x && t.y === y) t.domain = true; }
        }
    }
    // past the walls of a standing domain (cleared room or not: while the form lasts you're in it)
    _csOutsideDomain(x, y) { const R = this._cs?.domain?.R; return !!R && (x < R.x || x >= R.x + R.w || y < R.y || y >= R.y + R.h); }
    _csDomainEnd() {
        const S = this._cs, Dm = S?.domain;
        if (!Dm) return;
        S.domain = null;
        for (const t of S.fluid || []) if (t.domain) t.t1 = Math.min(t.t1, this.time.now);   // the flood drains with it
        this.tweens.add({ targets: Dm.objs, alpha: 0, duration: 500, onComplete: () => Dm.objs.forEach(o => o.destroy()) });
    }

    _csBanner(text, color) {
        const W = this.scale.width, H = this.scale.height, y = Math.round(H * 0.2);
        const css = '#' + color.toString(16).padStart(6, '0');
        const t = this.add.text(W / 2, y, text, {
            fontSize: '40px', fontFamily: 'monospace', fontStyle: 'bold', color: '#ffffff', stroke: css, strokeThickness: 5,
            padding: { x: 22, y: 22 },
        }).setOrigin(0.5).setScrollFactor(0).setDepth(26).setAlpha(0).setScale(1.7);
        t.setShadow(0, 0, css, 18, true, true);
        const bar = this.add.rectangle(W / 2, y + 30, 240, 3, color, 1).setScrollFactor(0).setDepth(26).setAlpha(0).setScale(0.05, 1);
        this.tweens.add({ targets: t, alpha: 1, scale: 1, duration: 200, ease: 'Back.easeOut' });
        this.tweens.add({ targets: bar, alpha: 1, scaleX: 1, duration: 260, ease: 'Cubic.easeOut' });
        this.tweens.add({ targets: [t, bar], alpha: 0, y: '-=16', duration: 420, delay: 760, ease: 'Quad.easeIn',
                          onComplete: () => { t.destroy(); bar.destroy(); } });
    }
}
