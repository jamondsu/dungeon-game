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
//                  the hit pops it for 3% of your current element's gem and 1% of the
//                  others                                                             (14s)
//   Singularity    a well at the cursor pulls enemies in for 5s, Hexing them deeper the longer they stay
//                  Event Horizon: -30% damage taken while it's out and 5s after (12s)
//   Void Blade     hold to charge, release to slash: longer, wider and a longer stun the
//                  longer you held (3-7 tiles, 1-3 wide, 0.6-1.8s). Retribution, 10s: when
//                  you're hit, everything within 3 tiles is Hexed for 5s (+25% damage
//                  taken, -40% speed, a mark)                                        (12s)
//   Ascend (ult)   10s: +25% max HP, free switching, fluid blasts, trail and waves, your boon at full
//                  strength, then a supernova that cashes every mark in reach in as damage
//   Stage 2        two layers; tap V for Ascend (-20% damage taken), hold V to transform:
//                  rift drop, Twin Collapse, two voidlets (the STAGE 2 section)
//   Stage 3        the full transformation: untouchable while turning, regenerating, a
//                  dazing slam, four-object collapses (the pair and its mirror) through
//                  walls that drag and Hex, four voidlets (TF3)
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
            // each other one (cosmic's fills with time only). Ascend doubles the pops.
            // About 6 marks on an average catch: ~+60% ult rate; a perfect one roughly doubles it.
            ASTRO:   { CD: 14000, MIN: 4 + WeaponLevels.perk('astrolabe', 'stars'), MAX: 10 + 2 * WeaponLevels.perk('astrolabe', 'stars'), PER_TILES: 40, FALL_MS: 420, STAGGER: 110, DAZE_R: 1.5 + 0.5 * WeaponLevels.perk('astrolabe', 'impact'), DAZE_MS: 700 + 300 * WeaponLevels.perk('astrolabe', 'impact'),
                       WINDOW: 5000, PICK_R: 1.0, MARKS_PER: 2, MAX_MARKS: 10, POP_CUR: 0.03 * (1 + 0.25 * WeaponLevels.perk('astrolabe', 'charts')), POP_OTHER: 0.01 * (1 + 0.25 * WeaponLevels.perk('astrolabe', 'charts')),
                       STAR_CHARGE: WeaponLevels.perk('astrolabe', 'gift') ? 0.25 : 0.08 },   // each star collected: 8% of a cosmic gem
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
                       HEX_R: 3, HEX_MS: 5000, HEX_STACKS: [1.07, 1.15, 1.25], HEX_SLOW: 0.6,
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
            TF:      { LAUNCH_MS: 250, PICK_MS: 5000, TURN_MS: 1500, AIM_MS: 3000, AIM_RANGE: 14, DROP_MS: 1000,
                       SLAM_R: 2.5, SLAM_DMG: 20, SLAM_SLOW: 1.5, SLAM_SLOW_MS: 2000,
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
            // pass through walls, drag what they pierce along, and Hex what they land on
            // (Void Blade's Hex: +25% damage taken, slowed). A longer form than the partial
            // one's, so spending the third layer is always worth it.
            TF3:     { SLAM_R: 3, SLAM_DMG: 30, DAZE_MS: 1500, FORM_MS: 11000, FORM_MAX_MS: 18000,
                       REGEN: 0.0008, REGEN_MS: 50,
                       // eight objects: the pair and three more pairs turned 45°, 90° and 135°
                       COLLAPSE_R: 2.6, MULT: 2.4, ROT: [45, 90, 135], PIERCE_SHARE: 0.6,
                       DRAG_STEP_MS: 60, VOIDLET_HP: 70, VOIDLETS: ['warrior', 'beam', 'warrior', 'beam', 'warrior'] },
            COL:     { violet: 0xb47cff, lilac: 0xe2c8ff, deep: 0x5a24a8, gold: 0xffd060, hex: 0xff5fd2 },
            NAMES:   { cosmic_fists: 'VOID FISTS', barrier_staff: 'BARRIER', astrolabe: 'ASTROLABE',
                       singularity_staff: 'SINGULARITY', void_blade: 'VOID BLADE' },
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

    // A Twin Collapse object: a 16px little nebula, two spiral arms turning round a white
    // core, sparks thrown off it (4 frames). Violet for your pair, gold for the full form's
    // mirror pair.
    static orbKey(scene, gold = false) {
        const key = gold ? 'cs_orb_gold' : 'cs_orb';
        if (typeof ShopScene === 'undefined' || !ShopScene.icon) return null;
        const pal = gold ? { k: '#2a1a04', n: '#6a4208', m: '#d89a1a', l: '#ffe08a', w: '#ffffff', g: '#ffd060' }
                         : { k: '#0c0420', n: '#2a1060', m: '#7a3ad8', l: '#d4b0ff', w: '#ffffff', g: '#b47cff' };
        return ShopScene.icon(scene, key, 16, pal, (m, f) => {
            m.disc(8, 8, 6.2, 'n');
            for (let k = 0; k < 2; k++) for (let t = 0; t <= 1.001; t += 0.07) {
                const a = f * Math.PI / 4 + k * Math.PI + t * 2.6, r = 1.2 + t * 4.6;
                m.set(8 + Math.cos(a) * r, 8 + Math.sin(a) * r, t < 0.45 ? 'l' : 'm');
            }
            m.set(5, 4, 'l'); m.set(4, 5, 'l'); m.set(6, 3, 'm');          // a rim catching light
            m.disc(8, 8, 1.8, 'l'); m.set(8, 8, 'w'); m.set(7, 7, 'w');
            for (let k = 0; k < 3; k++) {                                   // sparks circling it
                const a = f * Math.PI / 2 + k * Math.PI * 2 / 3;
                m.set(8 + Math.cos(a) * 7.4, 8 + Math.sin(a) * 7.4, 'g');
            }
        }, 4);
    }
    // The voidlets, 20px, 4 frames. Warrior: a void slime with small horns, gold eyes, a star
    // or two inside it, a lilac blade it swings. Voidbeam: a floating crystal with an eye at
    // its heart, shards circling it.
    static voidletKey(scene, kind) {
        const key = 'cs_voidlet_' + kind;
        if (typeof ShopScene === 'undefined' || !ShopScene.icon) return null;
        if (kind === 'warrior') return ShopScene.icon(scene, key, 20, { k: '#0a0418', b: '#2a1060', d: '#1a0a40', l: '#6a3ad0', e: '#ffd060', w: '#ffffff', s: '#d4b0ff', h: '#4a2a90', g: '#b47cff' }, (m, f) => {
            const bob = [0, -1, 0, 1][f], sq = f % 2;
            m.disc(10, 13 + bob, 6.5 + sq * 0.3, 'b'); m.rect(4, 13 + bob, 13, 5, 'b'); m.rect(4, 17 + bob, 13, 1, 'd');
            m.rect(6, 9 + bob, 6, 1, 'l'); m.set(5, 10 + bob, 'l');
            m.set(6, 6 + bob, 'h'); m.set(7, 7 + bob, 'h'); m.set(14, 6 + bob, 'h'); m.set(13, 7 + bob, 'h');   // horns
            m.set(8, 12 + bob, 'e'); m.set(12, 12 + bob, 'e');                                               // eyes
            m.set(7, 15 + bob, 'w'); m.set(13, 14 + bob, 'g');                                               // stars inside
            const ba = [-0.9, -0.4, 0.1, -0.4][f];                                                           // the blade, swinging
            m.line(16, 13 + bob, 16 + Math.cos(ba) * 4, 13 + bob + Math.sin(ba) * 4, 's');
            m.set(16 + Math.cos(ba) * 4.6, 13 + bob + Math.sin(ba) * 4.6, 'w');
        }, 4);
        return ShopScene.icon(scene, key, 20, { k: '#0a0418', c: '#3a1880', l: '#9a6aff', p: '#d4b0ff', e: '#ff5fd2', w: '#ffffff', g: '#ff8ce0' }, (m, f) => {
            const bob = [0, -1, -1, 0][f];
            m.poly([[10, 2 + bob], [16, 9 + bob], [10, 17 + bob], [4, 9 + bob]], 'c');
            m.poly([[10, 2 + bob], [16, 9 + bob], [10, 9 + bob]], 'l');
            m.line(10, 3 + bob, 10, 16 + bob, 'p');
            m.disc(10, 9 + bob, 2.4, f === 2 ? 'g' : 'e'); m.set(10, 9 + bob, 'w');                         // the eye, pulsing
            for (let k = 0; k < 3; k++) { const a = f * Math.PI / 2 + k * 2.09; m.set(10 + Math.cos(a) * 8, 10 + Math.sin(a) * 4 + bob, 'g'); }
        }, 4);
    }

    // Cosmic fluid, one 16px floor tile, 4 frames: deep violet liquid, a swirl of lighter
    // current turning through it, stars glinting in it.
    static fluidKey(scene) {
        const key = 'cs_fluid2';
        if (typeof ShopScene === 'undefined' || !ShopScene.icon) return key;
        return ShopScene.icon(scene, key, 16, { d: '#1c0a3c', b: '#2c1258', m: '#5a2aa8', l: '#b47cff', w: '#ffffff', p: '#ff8ce0' }, (m, f) => {
            m.rect(0, 0, 16, 16, 'b');                     // edge to edge, so a run of tiles reads as one pool
            m.set((f * 5) % 16, 15 - f, 'd'); m.set(14 - f * 3, (f * 7) % 16, 'd');
            for (let t = 0; t <= 1.001; t += 0.06) {
                const a = f * Math.PI / 2 + t * 4.4, r = 1 + t * 6;
                m.set(8 + Math.cos(a) * r, 8 + Math.sin(a) * r, t < 0.5 ? 'l' : 'm');
            }
            m.set(3 + f, 3, 'w'); m.set(12, 11 - f, 'w'); m.set(5, 12, f % 2 ? 'p' : 'l'); m.set(11, 4, f % 2 ? 'l' : 'p');
        }, 4);
    }

    // A rune circle, white, 128px: two rings, ticks between, an eight-point star, a hub, and
    // eight rune dots. Tinted and turned for the aim and impact previews.
    static sigilKey(scene) {
        const key = 'cs_sigil';
        if (scene.textures.exists(key)) return key;
        const N = 128, c = scene.textures.createCanvas(key, N, N), x = c.getContext(), h = N / 2;
        x.strokeStyle = '#fff'; x.fillStyle = '#fff';
        const ring = (r, w, a = 1) => { x.globalAlpha = a; x.lineWidth = w; x.beginPath(); x.arc(h, h, r, 0, Math.PI * 2); x.stroke(); };
        ring(61, 2.5); ring(53, 1, 0.7); ring(23, 1.5, 0.9);
        for (let i = 0; i < 32; i++) {
            const a = i / 32 * Math.PI * 2, long = i % 4 === 0;
            x.globalAlpha = long ? 1 : 0.6; x.lineWidth = long ? 2 : 1;
            x.beginPath(); x.moveTo(h + Math.cos(a) * 53, h + Math.sin(a) * 53); x.lineTo(h + Math.cos(a) * (long ? 61 : 58), h + Math.sin(a) * (long ? 61 : 58)); x.stroke();
        }
        x.globalAlpha = 0.85; x.lineWidth = 1.5;
        for (const off of [0, Math.PI / 4]) {                              // two squares: the star
            x.beginPath();
            for (let i = 0; i <= 4; i++) { const a = off + i * Math.PI / 2; const px = h + Math.cos(a) * 46, py = h + Math.sin(a) * 46; i ? x.lineTo(px, py) : x.moveTo(px, py); }
            x.stroke();
        }
        x.globalAlpha = 1;
        for (let i = 0; i < 8; i++) { const a = i * Math.PI / 4 + Math.PI / 8; x.beginPath(); x.arc(h + Math.cos(a) * 57, h + Math.sin(a) * 57, 2.2, 0, Math.PI * 2); x.fill(); }
        x.beginPath(); x.arc(h, h, 3, 0, Math.PI * 2); x.fill();
        c.refresh();
        return key;
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
        if (S.tf) { S.tf.g?.destroy(); S.tf.portal?.glow?.destroy(); S.tf.portal?.destroy(); this._csSkinDrop(S.tf.skin); }
        if (S.charge) { S.charge.edge?.destroy(); for (const o of S.charge.ui || []) o?.destroy?.(); }
        S.charge?.snd?.stop(); S.blade?.snd?.stop(); Music.duck(false);   // never leave a drone or silent music behind
        for (const c of S.collapses || []) for (const o of c.objs) { o.glow?.destroy(); o.core?.destroy(); }
        for (const v of S.voidlets || []) [v.spr, v.glow, v.eye, v.bar, v.reticle].forEach(o => o?.destroy());
        if (S.well) this._csWellEnd(true);
        if (S.wellBeam) { S.wellBeam.g?.destroy(); S.wellBeam = null; }
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

    // One more Hex stack (3 at most): +7% / +15% / +25% damage taken, slowed. The timer keeps whichever
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
        // the ward lunges onto the shot and both go in a flash
        const zap = this.add.graphics().setDepth(4.6).setBlendMode(Phaser.BlendModes.ADD);
        zap.lineStyle(2, C.lilac, 0.9); zap.lineBetween(w.img.x, w.img.y, x, y);
        this.tweens.add({ targets: zap, alpha: 0, duration: 160, onComplete: () => zap.destroy() });
        this._csBurst(x, y, 16, C.violet, 220);
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
        const C = this._csCfg().BARRIER, col = this._csCfg().COL, T = this.TILE_SIZE, px = this.playerX, py = this.playerY;
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
        if (n && this.player?.active) VisualFX.ripple(this, this.player.x, this.player.y, 10, (C.SHOVE_R + 1) * T, col.lilac, { depth: 4.5, duration: 320 });
    }

    // ── THE WEAPONS ──────────────────────────────────────────────────────────
    // From fireEquippedWeapon (click or hold, like every weapon). tx/ty as the game passes them.
    _csCast(weapon, tx, ty) {
        const S = this._cs;
        if (!S || !this.player?.active) return;
        if (weapon === 'cosmic_fists') { this._csPunch(tx, ty); return; }
        const C = this._csCfg(), now = this.time.now;
        if (now < S.cdUntil) {
            if (now - (this._csClickAt ?? -1e9) < 60 && now - (S.notReadyAt || -1e9) > 500) {
                S.notReadyAt = now;
                this.showStatusText(this.player.x, this.player.y - 28, `${((S.cdUntil - now) / 1000).toFixed(1)}s`, '#9a8cb8');
            }
            return;
        }
        const cam = this.cameras.main, wx = tx + cam.scrollX, wy = ty + cam.scrollY;
        let ok = false, cd = 0;
        if (weapon === 'barrier_staff')          { ok = this._csBarrier();       cd = C.BARRIER.CD; }
        else if (weapon === 'astrolabe')         { ok = this._csAstrolabe(wx, wy); cd = C.ASTRO.CD; }
        else if (weapon === 'singularity_staff') { ok = this._csWell(wx, wy);    cd = C.WELL.CD; }
        else if (weapon === 'void_blade')        { this._csBladeCharge(); return; }   // fires on release (_csRelease)
        if (!ok) return;
        S.cdUntil = now + cd;
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
        // a violet knuckle-burst on the tile, bigger when it connects
        const col = this._csCfg().COL;
        const ring = this.add.image(hx, hy, 'vfx_ring').setTint(hit ? col.lilac : col.violet)
            .setBlendMode(Phaser.BlendModes.ADD).setDepth(3.4).setScale(0.12).setAlpha(0.95);
        this.tweens.add({ targets: ring, scale: hit ? 0.62 : 0.4, alpha: 0, duration: 230, ease: 'Cubic.easeOut', onComplete: () => ring.destroy() });
        const n = hit ? 6 : 3;
        for (let i = 0; i < n; i++) {
            const a = Math.atan2(fy, fx) + (i - (n - 1) / 2) * 0.5 + (Math.random() - 0.5) * 0.3;
            const s = this.add.image(hx, hy, 'cs_sheet', 'mote').setDepth(3.5).setBlendMode(Phaser.BlendModes.ADD)
                .setTint(i % 2 ? col.gold : col.lilac);
            this.tweens.add({ targets: s, x: hx + Math.cos(a) * 16, y: hy + Math.sin(a) * 16, alpha: 0, scale: 0.4,
                              duration: 200 + Math.random() * 90, ease: 'Quad.easeOut', onComplete: () => s.destroy() });
        }
        if (hit) { this._vfxFlash?.(hx, hy, 56, col.violet, 160, 0.6); this._csAddMomentum(); }
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
        while (S.wards.length < C.WARDS) {
            const img = this.add.image(this.player.x, this.player.y, 'cs_sheet', 'ward').setDepth(this.player.depth + 0.01).setScale(0);
            const glow = this.add.image(this.player.x, this.player.y, 'vfx_glow').setTint(col.violet)
                .setBlendMode(Phaser.BlendModes.ADD).setDepth(0.9).setScale(0).setAlpha(0.55);
            this.tweens.add({ targets: img, scale: 1, duration: 220, ease: 'Back.easeOut' });
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
        const x = tx * T + T / 2, y = ty * T + T / 2, sx = x - 120 + Math.random() * 60, sy = y - 260;
        const img = this.add.image(sx, sy, 'cs_sheet', 'star').setDepth(4.6).setScale(1.4).setRotation(Math.atan2(y - sy, x - sx));
        const glow = this.add.image(sx, sy, 'vfx_glow').setTint(col.gold).setBlendMode(Phaser.BlendModes.ADD).setDepth(4.5).setScale(0.3).setAlpha(0.9);
        const trail = this.time.addEvent({ delay: 30, loop: true, callback: () => {
            if (!img.active) return;
            const m = this.add.image(img.x, img.y, 'cs_sheet', 'mote').setTint(Math.random() < 0.5 ? col.gold : 0xffffff).setBlendMode(Phaser.BlendModes.ADD).setDepth(4.4);
            this.tweens.add({ targets: m, alpha: 0, scale: 0.2, duration: 300, onComplete: () => m.destroy() });
        } });
        this.tweens.add({ targets: [img, glow], x, y, duration: C.FALL_MS, ease: 'Quad.easeIn', onComplete: () => {
            trail.remove();
            if (!this._cs?.astro) { img.destroy(); glow.destroy(); return; }
            // impact: a flash, a ring, and everything close is dazed (no damage)
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
            img.setRotation(0).setScale(1.1).setDepth(0.95);
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
        const px = this.player.x, py = this.player.y - 8;
        const orbit = [];
        for (let i = 0; i < got; i++) {
            const s = this.add.image(px, py, 'cs_sheet', 'star').setDepth(4.7).setBlendMode(Phaser.BlendModes.ADD);
            orbit.push(s);
        }
        const spin = { t: 0 };
        this.tweens.add({ targets: spin, t: 1, duration: 650, ease: 'Cubic.easeIn',
            onUpdate: () => orbit.forEach((s, i) => {
                const a = spin.t * Math.PI * 4 + i / got * Math.PI * 2, r = 34 * (1 - spin.t) + 4;
                s.setPosition(this.player.x + Math.cos(a) * r, this.player.y - 8 + Math.sin(a) * r * 0.6).setScale(1 + spin.t * 0.6);
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
                pool.slice(0, n).forEach((t, i) => {
                    t.e._csAstral = true;
                    const beam = this.add.graphics().setDepth(4.6).setBlendMode(Phaser.BlendModes.ADD);
                    beam.lineStyle(3, col.gold, 0.9); beam.lineBetween(cx, cy, t.x, t.y);
                    beam.lineStyle(1, 0xffffff, 1); beam.lineBetween(cx, cy, t.x, t.y);
                    this.tweens.add({ targets: beam, alpha: 0, duration: 380, delay: i * 30, onComplete: () => beam.destroy() });
                    this._csBurst(t.x, t.y, 18, col.gold, 260);
                });
                this.showStatusText(cx, cy - 26, `ASTRAL ×${n}`, '#ffd060');
            } });
    }

    // A hit landed on an astral mark: pop it. Charge goes to the element you hold (POP_CUR of a
    // gem) and a little to every other (POP_OTHER); cosmic's own gem fills with time only.
    // Doubled during Ascend.
    _csAstralPop(enemy) {
        if (!enemy?._csAstral || !this.ultGems) return;
        enemy._csAstral = false;
        const C = this._csCfg().ASTRO, col = this._csCfg().COL, max = this.ultChargeMax, k = this._csAscending() ? 2 : 1;
        for (const el of ['fire', 'ice', 'lightning']) {
            this.gainUltCharge(max * (el === this.currentElement ? C.POP_CUR : C.POP_OTHER) * k, el, true);
        }
        const x = enemy.sprite?.x ?? enemy.container?.x, y = (enemy.sprite?.y ?? enemy.container?.y) - 18;
        if (x === undefined) return;
        // a chain of pops climbs the scale and grows a little each time
        const S = this._cs, now = this.time.now;
        S.popN = now - (S.popAt || -1e9) < 1400 ? (S.popN || 0) + 1 : 0; S.popAt = now;
        Sfx.play(this, 'astropop', { n: S.popN });
        this._csPopFx(x, y, Math.min(1.6, 1 + S.popN * 0.08));
        // its ring flies off spinning, instead of vanishing
        const r = S.astral?.get(enemy);
        if (r?.active) { S.astral.delete(enemy); this.tweens.add({ targets: r, scale: 2.4, alpha: 0, rotation: r.rotation + 4, duration: 320, ease: 'Quad.easeOut', onComplete: () => r.destroy() }); }
        this.showStatusText(x, y - 14, `+${Math.round(C.POP_CUR * 100 * k)}%`, '#ffd060');
    }

    // The pop: a white flash and a gold star bursting out (eight rays, the long four turning), a ring, sparks
    // thrown out and falling, and three motes of gold that fly up to the fire, ice and lightning gems and flash them.
    _csPopFx(x, y, s = 1) {
        const ADD = Phaser.BlendModes.ADD, col = this._csCfg().COL, g = this.add.graphics().setPosition(x, y).setDepth(4.5).setBlendMode(ADD);
        for (let k = 0; k < 8; k++) {
            const a = k * Math.PI / 4, L = (k % 2 ? 9 : 18) * s, w = k % 2 ? 1.6 : 2.6, c = Math.cos(a), sn = Math.sin(a);
            g.fillStyle(col.gold, 0.95); g.fillTriangle(c * L, sn * L, -sn * w, c * w, sn * w, -c * w);
            g.fillStyle(0xffffff, 1); g.fillTriangle(c * L * 0.6, sn * L * 0.6, -sn * w * 0.4, c * w * 0.4, sn * w * 0.4, -c * w * 0.4);
        }
        g.fillStyle(0xffffff, 1); g.fillCircle(0, 0, 3.5 * s);
        g.setScale(0.3);
        this.tweens.add({ targets: g, scale: 1.25, rotation: 0.5, duration: 160, ease: 'Back.easeOut' });
        this.tweens.add({ targets: g, alpha: 0, scale: 1.6, delay: 140, duration: 260, ease: 'Quad.easeIn', onComplete: () => g.destroy() });
        const ring = this.add.circle(x, y, 6, 0, 0).setStrokeStyle(2, col.gold, 1).setDepth(4.45).setBlendMode(ADD);
        this.tweens.add({ targets: ring, scale: 4 * s, alpha: 0, duration: 380, ease: 'Quad.easeOut', onComplete: () => ring.destroy() });
        for (let k = 0; k < 12; k++) {
            const a = Math.random() * Math.PI * 2, d = (14 + Math.random() * 18) * s, sp = this.add.rectangle(x, y, 2, 2, k % 3 ? col.gold : 0xffffff).setDepth(4.46).setBlendMode(ADD);
            this.tweens.add({ targets: sp, x: x + Math.cos(a) * d, y: y + Math.sin(a) * d + 10, alpha: 0, duration: 420 + Math.random() * 260, ease: 'Quad.easeOut', onComplete: () => sp.destroy() });
        }
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

    // The astral marks: a gold ring turning over each marked enemy until it's popped.
    _csUpdateAstral(now) {
        const S = this._cs;
        const live = new Set();
        const each = (e, x, y) => {
            if (!e || !e._csAstral) return;
            live.add(e);
            let r = S.astral.get(e);
            if (!r || !r.active) {
                // the mark lands: a star streaks down onto it with a chime, and a ring flashes open where it strikes
                r = this.add.graphics().setDepth(4.3).setBlendMode(Phaser.BlendModes.ADD); r._born = now; S.astral.set(e, r);
                const st = this.add.image(x + 30, y - 90, 'cs_sheet', 'mote').setTint(0xffd060).setBlendMode(Phaser.BlendModes.ADD).setDepth(4.35).setScale(1.6);
                this.tweens.add({ targets: st, x, y: y - 18, duration: 220, ease: 'Quad.easeIn', onComplete: () => {
                    st.destroy(); this._csBurst?.(x, y - 18, 10, 0xffd060, 200);
                    const ring = this.add.circle(x, y - 18, 4, 0, 0).setStrokeStyle(2, 0xffe08a, 1).setDepth(4.35).setBlendMode(Phaser.BlendModes.ADD);
                    this.tweens.add({ targets: ring, scale: 4, alpha: 0, duration: 320, ease: 'Quad.easeOut', onComplete: () => ring.destroy() });
                } });
                Sfx.play(this, 'csplace', { gold: true });
            }
            // the mark: a four-point gold star turning over it, pulsing, a soft glow, a mote orbiting
            const age = now - r._born, grow = Math.min(1, Math.max(0, (age - 200) / 160)), p = 0.85 + 0.15 * Math.sin(now * 0.008), R = 9 * grow * p, rot = now * 0.002;
            r.clear().setPosition(x, y - 18);
            if (grow > 0) {
                r.fillStyle(0xffd060, 0.18); r.fillCircle(0, 0, R * 1.6);
                for (let k = 0; k < 4; k++) { const a = rot + k * Math.PI / 2, c = Math.cos(a), sn = Math.sin(a), w = 2.4; r.fillStyle(0xffd060, 0.95); r.fillTriangle(c * R, sn * R, -sn * w, c * w, sn * w, -c * w); r.fillStyle(0xffffff, 1); r.fillTriangle(c * R * 0.55, sn * R * 0.55, -sn * w * 0.4, c * w * 0.4, sn * w * 0.4, -c * w * 0.4); }
                for (let k = 0; k < 4; k++) { const a = rot + Math.PI / 4 + k * Math.PI / 2; r.fillStyle(0xffe8a0, 0.7); r.fillCircle(Math.cos(a) * R * 0.5, Math.sin(a) * R * 0.5, 1); }
                r.fillStyle(0xffffff, 1); r.fillCircle(0, 0, 1.8);
                const oa = -now * 0.005; r.fillStyle(0xfff0c0, 0.9); r.fillCircle(Math.cos(oa) * R * 1.4, Math.sin(oa) * R * 0.6, 1.3);
            }
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
        S.wellBeam = { x0, y0, x1, y1, tx: end.x, ty: end.y, t0: now, dur: Math.max(260, Math.hypot(x1 - x0, y1 - y0) / (C.BEAM_SPEED * T) * 1000 * 1.7), hit: new Set(), ang: 0,
                       g: this.add.graphics().setDepth(3.4).setBlendMode(Phaser.BlendModes.ADD) };
        this._csBurst?.(x0, y0, 10, this._csCfg().COL.lilac, 200);   // a flare at the staff's head as it lets go
        Sfx.play(this, 'csbeam');
        return true;
    }
    _csUpdateWellBeam(now) {
        const S = this._cs, B = S.wellBeam;
        if (!B) return;
        const C = this._csCfg().WELL, col = this._csCfg().COL, T = this.TILE_SIZE, u = Math.min(1, (now - B.t0) / B.dur);
        // a seed of the well: it leaves the staff slowly and accelerates in (eased by u^2.4), dragging a short trail
        const at = v => { const e = Math.pow(Math.max(0, v), 2.4); return [B.x0 + (B.x1 - B.x0) * e, B.y0 + (B.y1 - B.y0) * e]; };
        const [hx, hy] = at(u), g = B.g; g.clear();
        const L = Math.hypot(B.x1 - B.x0, B.y1 - B.y0) || 1, nx = (B.x1 - B.x0) / L, ny = (B.y1 - B.y0) / L;
        const speed = 2.4 * Math.pow(u, 1.4), trail = Math.min(T * 1.4, 6 + speed * T * 0.9);   // longer as it gathers speed, never long
        for (let k = 0; k < 8; k++) {
            const f = k / 8, x = hx - nx * trail * f, y = hy - ny * trail * f, w = (7 - k * 0.8) * (0.6 + 0.4 * Math.min(1, speed));
            g.fillStyle(k < 2 ? 0xffffff : k < 4 ? col.lilac : col.violet, (1 - f) * 0.8); g.fillCircle(x + (Math.random() - 0.5) * k * 0.6, y + (Math.random() - 0.5) * k * 0.6, Math.max(0.6, w * 0.5));
        }
        B.ang += 0.25 + speed * 0.35;
        g.lineStyle(1.5, col.lilac, 0.9); g.strokeEllipse(hx, hy, 18, 7);   // its accretion ring, turning
        for (let k = 0; k < 3; k++) { const a = B.ang + k * 2.094; g.fillStyle(k ? col.lilac : 0xffffff, 1); g.fillCircle(hx + Math.cos(a) * 9, hy + Math.sin(a) * 3.5, 1.3); }
        g.fillStyle(col.violet, 0.45); g.fillCircle(hx, hy, 8);
        g.fillStyle(0x0a0418, 1); g.fillCircle(hx, hy, 4);        // the dark heart
        g.lineStyle(1.2, 0xffffff, 0.9); g.strokeCircle(hx, hy, 4.2);   // its event horizon, a hairline of light
        if (Math.random() < 0.5) { const a = Math.random() * Math.PI * 2, m = this.add.rectangle(hx + Math.cos(a) * 14, hy + Math.sin(a) * 14, 2, 2, col.lilac).setDepth(3.41).setBlendMode(Phaser.BlendModes.ADD); this.tweens.add({ targets: m, x: hx, y: hy, alpha: 0.2, duration: 160, onComplete: () => m.destroy() }); }   // motes falling in
        for (const e of this.enemies || []) {
            if (this._phasedOut?.(e)) continue;
            if (!e.sprite?.active || e.health <= 0 || B.hit.has(e)) continue;
            if (Math.hypot(e.sprite.x - hx, e.sprite.y - hy) > T * 0.75) continue;
            B.hit.add(e); this._csHex(e, C.BEAM_HEX_MS);
        }
        if (u >= 1) { g.destroy(); S.wellBeam = null; this._csWellOpen(B.tx, B.ty); }
    }
    _csWellOpen(tx, ty) {
        const S = this._cs, C = this._csCfg().WELL, col = this._csCfg().COL, now = this.time.now, T = this.TILE_SIZE;
        if (S.well) this._csWellEnd(true);
        const x = tx * T + T / 2, y = ty * T + T / 2;
        const shade = this.add.image(x, y, 'vfx_glow').setTint(0x000000).setDepth(0.95).setScale(0.75).setAlpha(0.7);
        const glow = this.add.image(x, y, 'vfx_glow').setTint(col.violet).setBlendMode(Phaser.BlendModes.ADD).setDepth(0.96).setScale(0).setAlpha(0.7);
        const disk = this.add.image(x, y, 'cs_sheet', 'well').setDepth(0.97).setScale(0.1);
        const ring = this.add.image(x, y, 'cs_sheet', 'horizon').setDepth(0.98).setScale(C.RADIUS * T * 2 / 36).setAlpha(0.35);
        this.tweens.add({ targets: disk, scale: 1.25, duration: 320, ease: 'Back.easeOut' });
        this.tweens.add({ targets: glow, scale: 0.85, duration: 320 });
        S.well = { tx, ty, x, y, t0: now, until: now + C.MS, tickAt: now + 250, moteAt: 0, shade, glow, disk, ring, r: C.RADIUS * C.GROW_FROM };
        S.horizonUntil = Math.max(S.horizonUntil, now + C.MS + C.AFTER);
        this._csCastFx('EVENT HORIZON', col.violet);
        this.cameras.main.shake(70, 0.003);
        return true;
    }

    _csWellEnd(quiet) {
        const S = this._cs, W = S?.well;
        if (!W) return;
        S.well = null;
        const parts = [W.shade, W.glow, W.disk, W.ring];
        if (quiet) { parts.forEach(o => o?.destroy()); return; }
        this.tweens.add({ targets: W.disk, scale: 0, angle: W.disk.angle - 180, duration: 260, ease: 'Back.easeIn' });
        this.tweens.add({ targets: [W.shade, W.glow, W.ring], alpha: 0, duration: 300, onComplete: () => parts.forEach(o => o?.destroy()) });
        this._csBurst(W.x, W.y, 26, this._csCfg().COL.lilac, 260);
        // it collapses: a ring snaps inward and everything still inside is dazed for a moment
        const C = this._csCfg().WELL, T = this.TILE_SIZE, now = this.time.now;
        const ring = this.add.circle(W.x, W.y, W.r * T, 0, 0).setStrokeStyle(3, this._csCfg().COL.lilac, 1).setDepth(3.4).setBlendMode(Phaser.BlendModes.ADD);
        this.tweens.add({ targets: ring, scale: 0.05, alpha: 0.2, duration: 240, ease: 'Quad.easeIn', onComplete: () => { ring.destroy(); this._vfxFlash?.(W.x, W.y, W.r * T, this._csCfg().COL.violet, 300, 0.8); } });
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
        const key = typeof MenuArt !== 'undefined' ? MenuArt.iconSheet?.(this, 'void_blade') : null;
        const big = key ? this.add.sprite(this.player.x, this.player.y, key, '0').setDepth(this.player.depth + 0.05) : null;
        const halo = key ? this.add.sprite(this.player.x, this.player.y, key, '0').setTintFill(this._csCfg().COL.hex).setBlendMode(Phaser.BlendModes.ADD).setDepth(this.player.depth + 0.04) : null;
        S.blade = { start: this.time.now, g: this.add.graphics().setDepth(1.2), z0: this.cameras.main.zoom, big, halo, snd: Sfx.charge(this, 'blade') };
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
        B.g.clear();
        for (const t of tiles) {
            const a = 0.1 + 0.2 * f + 0.1 * Math.sin(now * 0.01 - t.d * 0.8);
            B.g.fillStyle(col.hex, a); B.g.fillRect(t.x * T + 1, t.y * T + 1, T - 2, T - 2);
        }
        B.g.lineStyle(1, f >= 1 ? 0xffffff : col.hex, f >= 1 ? 0.9 : 0.55);
        for (const t of tiles) B.g.strokeRect(t.x * T + 1, t.y * T + 1, T - 2, T - 2);
        cam.setZoom(B.z0 * (1 + C.ZOOM * f));
        B.snd?.set(f);
        const ang = Math.atan2(dy, dx), sc = 1.4 + 3.6 * f;
        for (const [s, k] of [[B.big, 1], [B.halo, 1.15]]) s?.setPosition(p.x + dx * 10 * (1 + f), p.y - 6 + dy * 10 * (1 + f)).setRotation(ang + Math.PI / 4).setScale(sc * k);
        B.halo?.setAlpha(0.25 + 0.35 * f + 0.15 * Math.sin(now * 0.02));
        if (Math.random() < 0.2 + 0.6 * f) {
            const m = this.add.image(p.x + (Math.random() - 0.5) * 40, p.y + (Math.random() - 0.5) * 30, 'cs_sheet', 'mote').setTint(col.hex).setBlendMode(Phaser.BlendModes.ADD).setDepth(4.6);
            this.tweens.add({ targets: m, x: B.big?.x ?? p.x, y: B.big?.y ?? p.y, alpha: 0, duration: 300, onComplete: () => m.destroy() });
        }
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
        // the cut: a crescent sweeping out along the line, an afterimage of you at its head
        const ang = Math.atan2(dy, dx), L = Math.max(1, len) * T, wide = 1 + sh.hw * 1.6;
        const fan = Math.atan(C.FAN);
        if (fan > 0.01) {   // Fan Cut: the blade sweeps across the whole fan, side to side, at full reach
            const sw = this.add.graphics().setDepth(4.4).setBlendMode(Phaser.BlendModes.ADD), sweep = { u: 0 };
            this.tweens.add({ targets: sweep, u: 1, duration: 260 + 4 * len, ease: 'Cubic.easeOut', onUpdate: () => {
                sw.clear();
                const a0 = ang - fan, a1 = ang - fan + 2 * fan * sweep.u;
                for (const [r, wd, al] of [[L, 10, 0.85], [L * 0.8, 6, 0.5], [L * 0.55, 4, 0.3]]) {
                    sw.lineStyle(wd, col.hex, al); sw.beginPath(); sw.arc(px, py - 4, r, a0, a1); sw.strokePath();
                }
                sw.lineStyle(3, 0xffffff, 0.9); sw.beginPath(); sw.arc(px, py - 4, L, Math.max(a0, a1 - 0.25), a1); sw.strokePath();
                sw.lineStyle(4, col.hex, 0.7); sw.lineBetween(px, py - 4, px + Math.cos(a1) * L, py - 4 + Math.sin(a1) * L);   // the blade edge itself
            }, onComplete: () => this.tweens.add({ targets: sw, alpha: 0, duration: 220, onComplete: () => sw.destroy() }) });
        }
        for (let i = 0; i < 3; i++) {
            const s = this.add.image(px, py - 4, 'cs_sheet', 'slash').setRotation(ang).setDepth(4.4)
                .setBlendMode(Phaser.BlendModes.ADD).setAlpha(0.95 - i * 0.25).setScale(0.6, (1.1 - i * 0.15) * wide);
            this.tweens.add({ targets: s, x: px + dx * L, y: py - 4 + dy * L, scaleX: 1.15, delay: i * 35, duration: 150 + 6 * len,
                              ease: 'Cubic.easeOut', onComplete: () => this.tweens.add({ targets: s, alpha: 0, duration: 160, onComplete: () => s.destroy() }) });
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
        const C = this._csCfg().BLADE, T = this.TILE_SIZE, key = CosmicSystem.fluidKey(this);
        const wet = new Map();   // tile → its Hex length
        for (let i = F.length - 1; i >= 0; i--) {
            const t = F[i];
            if (now >= t.t1) {
                if (t.img) { const im = t.img; this.tweens.add({ targets: im, alpha: 0, scale: im.scale * 0.6, duration: 180, onComplete: () => im.destroy() }); }
                F.splice(i, 1); continue;
            }
            if (now < t.t0) continue;
            if (!t.img) {
                t.img = this.add.sprite(t.x * T + T / 2, t.y * T + T / 2, key, '0').setDisplaySize(T, T).setDepth(0.92).setAlpha(0);
                if (this.anims.exists(key)) t.img.play({ key, startFrame: (t.x + t.y) % 4 });
                this.tweens.add({ targets: t.img, alpha: 0.92, duration: 140 });
                if (Math.random() < 0.35) this._csBurst(t.x * T + T / 2, t.y * T + T / 2, 10, this._csCfg().COL.hex, 200);
            }
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
        const col = this._csCfg().COL, T = this.TILE_SIZE, x = this.player.x, y = this.player.y;
        const ring = this.add.circle(x, y, T * 0.5).setStrokeStyle(6, col.hex, 0.9).setDepth(4.6).setBlendMode(Phaser.BlendModes.ADD);
        this.tweens.add({ targets: ring, radius: R * T, alpha: 0, duration: R * C.CASCADE + 200, ease: 'Quad.easeOut', onComplete: () => ring.destroy() });
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
            this._csBurst(this.player.x, this.player.y, 90, C.COL.lilac, 420);
            this._vfxFlash?.(this.player.x, this.player.y, 260, C.COL.violet, 600, 1);
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
        // an implosion, then the blast
        const core = this.add.image(cx, cy, 'vfx_glow').setTint(col.lilac).setBlendMode(Phaser.BlendModes.ADD).setDepth(4.7).setScale(1.2).setAlpha(0.4);
        this.tweens.add({ targets: core, scale: 0.15, alpha: 1, duration: 140, ease: 'Quad.easeIn', onComplete: () => {
            core.destroy();
            this._csBurst(cx, cy, R, col.violet, 520);
            this._csBurst(cx, cy, R * 0.6, col.gold, 380);
            const flash = this.add.image(cx, cy, 'vfx_glow').setTint(0xffffff).setBlendMode(Phaser.BlendModes.ADD).setDepth(4.8).setScale(0.4);
            this.tweens.add({ targets: flash, scale: R / 40, alpha: 0, duration: 360, ease: 'Quad.easeOut', onComplete: () => flash.destroy() });
        } });
        this._vfxFlash?.(cx, cy, R * 1.6, col.lilac, 600, 1);
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
        if (!S?.unlocked || !this.ultGems || S.tf || S.charge || now < (this._ultNoChargeUntil?.cosmic || 0)) return;
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

    // V pressed. True when it's handled here (the charge), false to let castUlt do the usual.
    _csVDown() {
        const S = this._cs;
        if (!S || this._csStage() < 2) return false;
        if (S.tf || S.charge) return true;
        const n = this._csLayers();
        if (n < 2) return false;
        const cam = this.cameras.main;
        S.charge = { at: this.time.now, p: 0, cap: n >= 3 && this._csStage() >= 3 ? 1 : 0.5, half: false, dramatic: false, z0: cam.zoom, shakeAt: 0, snd: Sfx.charge(this) };
        Music.duck(true);
        return true;
    }
    // V released: what the bar reached decides.
    _csVUp() {
        const S = this._cs, ch = S?.charge;
        if (!ch) return;
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
        if (p?.active && Math.random() < dt / (60 - 40 * ch.p)) {
            const a = Math.random() * Math.PI * 2, r = 40 + Math.random() * 40;
            const m = this.add.image(p.x + Math.cos(a) * r, p.y + Math.sin(a) * r * 0.7, 'cs_sheet', 'mote')
                .setTint(ch.p > 0.8 ? (Math.random() < 0.5 ? col.gold : 0xffffff) : col.lilac).setBlendMode(Phaser.BlendModes.ADD).setDepth(4.6);
            this.tweens.add({ targets: m, x: p.x, y: p.y, alpha: 0.2, scale: 0.3, duration: 420 - 200 * ch.p, ease: 'Quad.easeIn', onComplete: () => m.destroy() });
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
            if (ch.p >= 1) {   // the flash, and the full transformation
                cam.flash(260, 255, 255, 255);
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
        const p = this.player, col = this._csCfg().COL;
        const armor = this.add.sprite(p.x, p.y, p.texture.key, p.frame.name).setTintFill(full ? 0x1c0b3e : 0x2a1458);
        const rim = this.add.sprite(p.x, p.y, p.texture.key, p.frame.name).setTintFill(full ? col.gold : col.lilac).setBlendMode(Phaser.BlendModes.ADD);
        const g = this.add.graphics();
        const halo = full ? this.add.image(p.x, p.y, 'cs_sheet', 'halo').setTint(col.gold) : null;
        // fixed star points across the body, in frame coordinates
        const fw = p.frame.width, fh = p.frame.height, stars = [];
        for (let i = 0; i < (full ? 9 : 5); i++) stars.push({ u: 0.22 + Math.random() * (full ? 0.56 : 0.33), v: 0.74 + Math.random() * 0.2, ph: Math.random() * 6 });
        return { full, armor, rim, g, halo, stars, fw, fh, CUT: 0.58 };
    }
    _csSkinSync(sk, now) {
        const p = this.player;
        if (!p?.active) return;
        const col = this._csCfg().COL, d = p.depth ?? 1, al = p.alpha ?? 1, sx = p.scaleX, sy = p.scaleY;
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
        const g = sk.g.clear().setDepth(d + 0.0007).setAlpha(al).setVisible(p.visible);
        if (!sk.full) {
            const pts = [];
            for (let i = 0; i <= 6; i++) pts.push({ x: wx(sk.CUT + (i % 2 ? 0.04 : -0.02)), y: wy(0.66 + 0.32 * i / 6) });   // the body is the frame's lower third
            g.lineStyle(3, col.lilac, 0.35 + 0.25 * Math.sin(now * 0.012)); g.strokePoints(pts);
            g.lineStyle(1, 0xffffff, 0.9); g.strokePoints(pts);
            if (Math.random() < 0.08) {   // shards of light flaking off the break
                const q = pts[1 + Math.floor(Math.random() * 5)];
                const m = this.add.image(q.x, q.y, 'cs_sheet', 'mote').setTint(col.lilac).setBlendMode(Phaser.BlendModes.ADD).setDepth(d + 0.02);
                this.tweens.add({ targets: m, x: q.x + (p.flipX ? -10 : 10), y: q.y - 8, alpha: 0, duration: 380, onComplete: () => m.destroy() });
            }
        }
        for (const st of sk.stars) {
            const tw = 0.4 + 0.6 * Math.max(0, Math.sin(now * 0.006 + st.ph));
            g.fillStyle(sk.full && st.ph > 3 ? col.gold : 0xffffff, tw); g.fillRect(wx(st.u) - 1, wy(st.v) - 1, 2, 2);
        }
        if (sk.halo) sk.halo.setPosition(p.x, wy(0.6) + Math.sin(now * 0.006) * 1.5).setDepth(d + 0.03).setAlpha(al).setVisible(p.visible);
    }
    _csSkinDrop(sk) {
        if (!sk) return;
        for (const o of [sk.armor, sk.rim, sk.g, sk.halo]) o?.destroy?.();
    }

    // full: the full transformation (three layers), else the partial one (two).
    _csTfBegin(full = false) {
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
        S.tf = { phase: 'turn', at: now, until: now + C.TURN_MS, g: this.add.graphics().setDepth(4.6), full };
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
        const C = this._csCfg().TF, col = this._csCfg().COL, T = this.TILE_SIZE, p = this.player, g = tf.g;
        g.clear();
        if (tf.skin) this._csSkinSync(tf.skin, now);
        const Dm = S.domain;
        if (Dm && tf.phase === 'form' && !tf.full && now >= Dm.waveAt) { Dm.waveAt = now + C.WAVE_EVERY; this._csDomainTide(); }
        // stage 3: cosmic regeneration, from the hold to the end of the form
        if (tf.full && this.health > 0) {
            const C3 = this._csCfg().TF3, max = this.maxHealth || 100;
            tf.regenAcc = (tf.regenAcc || 0) + dt;
            while (tf.regenAcc >= C3.REGEN_MS) { tf.regenAcc -= C3.REGEN_MS; this.health = Math.min(max, this.health + max * C3.REGEN); }
            if (this.health < max && Math.random() < dt / 160) {
                const m = this.add.image(p.x + (Math.random() - 0.5) * 22, p.y + 6, 'cs_sheet', 'mote').setTint(0x9dffb0).setBlendMode(Phaser.BlendModes.ADD).setDepth(p.depth + 0.02);
                this.tweens.add({ targets: m, y: m.y - 22, alpha: 0, duration: 600, onComplete: () => m.destroy() });
            }
        }
        if (tf.phase === 'turn') {
            // the turn: motes pour in, a ring tightens, you flicker white and violet
            const k = (now - tf.at) / C.TURN_MS;
            p.setTint(Math.floor(now / 90) % 2 ? (tf.full ? col.gold : col.lilac) : col.violet);
            if (tf.full) { g.lineStyle(2, col.gold, 0.5 + 0.4 * Math.sin(now * 0.02)); g.strokeCircle(p.x, p.y - 4, 20 + 3 * Math.sin(now * 0.015)); }
            if (Math.random() < dt / 22) {
                const a = Math.random() * Math.PI * 2, r = 46 + Math.random() * 20;
                const m = this.add.image(p.x + Math.cos(a) * r, p.y + Math.sin(a) * r * 0.6, 'cs_sheet', 'mote')
                    .setTint(Math.random() < 0.3 ? col.gold : col.lilac).setBlendMode(Phaser.BlendModes.ADD).setDepth(4.6);
                this.tweens.add({ targets: m, x: p.x, y: p.y, alpha: 0.2, scale: 0.3, duration: 380, ease: 'Quad.easeIn', onComplete: () => m.destroy() });
            }
            g.lineStyle(2, col.violet, 0.3 + 0.6 * k); g.strokeEllipse(p.x, p.y + 6, 70 * (1 - k) + 22, (70 * (1 - k) + 22) * 0.5);
            if (now >= tf.until) { tf.phase = 'aim'; tf.until = now + C.AIM_MS; this.showStatusText(p.x, p.y - 30, 'CHOOSE WHERE', '#e2c8ff'); }
            return;
        }
        if (tf.phase === 'aim') {
            // the live pointer, not pointerX (only pointermove updates that; a mouse that hasn't
            // moved since the level loaded would aim at a stale point)
            const cam = this.cameras.main, ap = this._aim(this.input.activePointer);
            tf.target = this._csTfTarget(ap.x + cam.scrollX, ap.y + cam.scrollY);
            const cx = tf.target.x * T + T / 2, cy = tf.target.y * T + T / 2, R = (tf.full ? this._csCfg().TF3.SLAM_R : C.SLAM_R) * T;
            const left = (tf.until - now) / C.AIM_MS, tint = tf.full ? col.gold : col.lilac;
            // the landing: a rune circle turning over a glow, a smaller one turning against it,
            // motes drawn down into it, and the time left as a gold sweep
            if (!tf.aimFx) {
                const sk = CosmicSystem.sigilKey(this);
                tf.aimFx = [VisualFX.aura(this, cx, cy, R * 1.15, tf.full ? col.gold : col.violet, { depth: 0.9, alpha: 0.9 }),
                            this.add.image(cx, cy, sk).setTint(tint).setBlendMode(Phaser.BlendModes.ADD).setDepth(4.55),
                            this.add.image(cx, cy, sk).setTint(col.violet).setBlendMode(Phaser.BlendModes.ADD).setDepth(4.55)];
            }
            const [au, s1, s2] = tf.aimFx;
            au.setPosition(cx, cy);
            s1.setPosition(cx, cy).setDisplaySize(R * 2, R * 2).setRotation(now * 0.0012).setAlpha(0.75 + 0.2 * Math.sin(now * 0.008));
            s2.setPosition(cx, cy).setDisplaySize(R * 1.1, R * 1.1).setRotation(-now * 0.002).setAlpha(0.6);
            if (Math.random() < dt / 40) {
                const a = Math.random() * Math.PI * 2;
                const m = this.add.image(cx + Math.cos(a) * R, cy + Math.sin(a) * R, 'cs_sheet', 'mote').setTint(tint).setBlendMode(Phaser.BlendModes.ADD).setDepth(4.56);
                this.tweens.add({ targets: m, x: cx, y: cy, alpha: 0.2, scale: 0.4, duration: 500, ease: 'Quad.easeIn', onComplete: () => m.destroy() });
            }
            g.lineStyle(3, col.gold, 0.85); g.beginPath(); g.arc(cx, cy, R + 6, -Math.PI / 2, -Math.PI / 2 + left * Math.PI * 2); g.strokePath();
            // the way there: a stream of dots flowing from you to it
            const L = Math.hypot(cx - p.x, cy - p.y), n = Math.floor(L / 10), off = (now * 0.06) % 10;
            for (let i = 0; i < n; i++) {
                const d = i * 10 + off, f = d / L;
                if (f > 1) break;
                g.fillStyle(tint, 0.25 + 0.6 * f); g.fillRect(p.x + (cx - p.x) * f - 1, p.y + (cy - p.y) * f - 1, 2, 2);
            }
            p.setTint(col.lilac);
            if (now >= tf.until) this._csTfDrop();
            return;
        }
        if (tf.phase === 'drop') {
            const P = tf.portal;
            if (P) { P.rotation += dt * 0.008; P.glow.setAlpha(0.6 + 0.3 * Math.sin(now * 0.02)); }
            return;
        }
        // the form: a violet aura, the time left on the tray
        if (now >= tf.until) { this._csTfEnd(); return; }
        p.setTint(tf.full ? col.gold : col.lilac);
        if (S.drag && !S.drag.anchored && now - S.drag.at > C.PICK_MS) S.drag = null;   // a first point left too long lapses
        if (S.drag) this._csCollapsePreview(g, S.drag); else this._csHidePreview();
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
        tf.g.clear();
        this._dashInvulnUntil = Math.max(this._dashInvulnUntil || 0, now + C.DROP_MS + 150);   // untargetable while gone
        const cx = land.x * T + T / 2, cy = land.y * T + T / 2;
        // the portal
        const glow = this.add.image(cx, cy, 'vfx_glow').setTint(col.violet).setBlendMode(Phaser.BlendModes.ADD).setDepth(0.9).setScale(0.1);
        const portal = this.add.image(cx, cy, 'cs_sheet', 'horizon').setDepth(0.95).setScale(0.1);
        portal.glow = glow; tf.portal = portal;
        this.tweens.add({ targets: portal, scaleX: 1.6, scaleY: 0.9, duration: 300, ease: 'Back.easeOut' });
        this.tweens.add({ targets: glow, scale: 1.1, duration: 300 });
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
        Sfx.play(this, 'cslam', { gold: tf.full });
        this._csBurst(cx, cy, SR * T, col.violet, 460);
        this._csBurst(cx, cy, SR * T * 0.5, col.gold, 300);
        VisualFX.ripple(this, cx, cy, 10, SR * T * 1.3, tf.full ? col.gold : col.lilac, { depth: 4.5, duration: 500 });
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
        tf.g?.destroy(); tf.portal?.glow?.destroy(); tf.portal?.destroy();
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

    // The bosses in reach of (cx, cy) take `dmg` (bosses aren't in this.enemies).
    _csHitBosses(cx, cy, R, dmg) {
        const T = this.TILE_SIZE, vb = this.voltslimeBoss, vs = this.voidSovereignBoss;
        const list = [];
        if (vb?.active && vb.container) list.push([vb.container.x, vb.container.y]);
        if (vs?.active && vs.container) list.push([vs.container.x, vs.container.y + (this.SLIME_Y_OFFSET || 0)]);
        let n = 0;
        for (const [bx, by] of list) {
            if (Math.hypot(bx - cx, by - cy) > R + T * 1.5) continue;
            this.damageBossAtTile(Math.floor(bx / T), Math.floor(by / T), dmg, 'collapse', 'cosmic');
            n++;
        }
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
    // a ghost of the second under the cursor, each one's path as a stream of motes flowing
    // to where they'll meet, an X where a wall stops one, and at the meeting point a rune
    // circle that grows and turns gold the harder it will hit, ringed with a pip per fifth
    // of the full power.
    _csCollapsePreview(g, drag) {
        const tf = this._cs.tf, col = this._csCfg().COL, T = this.TILE_SIZE, R = (tf.full ? this._csCfg().TF3 : this._csCfg().TF).COLLAPSE_R * T, now = this.time.now;
        const plan = this._csCollapsePlan(drag.a, drag.b);
        if (!tf.pvFx) {
            const ok = CosmicSystem.orbKey(this, false), sk = CosmicSystem.sigilKey(this);
            const orb = () => { const o = this.add.sprite(0, 0, ok, '0').setScale(1.4).setDepth(4.56).setAlpha(0.85); if (this.anims.exists(ok)) o.play(ok); return o; };
            tf.pvFx = [orb(), orb().setAlpha(0.45), this.add.image(0, 0, sk).setBlendMode(Phaser.BlendModes.ADD).setDepth(4.55),
                       VisualFX.aura(this, 0, 0, R * 1.2, col.violet, { depth: 0.9, alpha: 0.8 })];
        }
        const [oa, ob, sig, au] = tf.pvFx;
        oa.setPosition(drag.a.x, drag.a.y).setVisible(true);
        if (!plan) {
            ob.setVisible(false); sig.setVisible(false); au.setVisible(false);
            g.lineStyle(2, 0xff5a5a, 0.7); g.strokeCircle(drag.b.x, drag.b.y, 8);
            g.lineBetween(drag.b.x - 5, drag.b.y - 5, drag.b.x + 5, drag.b.y + 5); g.lineBetween(drag.b.x - 5, drag.b.y + 5, drag.b.x + 5, drag.b.y - 5);
            return;
        }
        ob.setPosition(plan.b.x, plan.b.y).setVisible(true);
        const stream = (p, q, c) => {
            const L = Math.hypot(q.x - p.x, q.y - p.y);
            if (L < 2) return;
            const off = (now * 0.08) % 9;
            for (let d = off; d < L; d += 9) {
                const f = d / L, s = 1 + f * 1.5;
                g.fillStyle(c, 0.25 + 0.65 * f);
                g.fillPoints([{ x: p.x + (q.x - p.x) * f, y: p.y + (q.y - p.y) * f - s }, { x: p.x + (q.x - p.x) * f + s, y: p.y + (q.y - p.y) * f },
                              { x: p.x + (q.x - p.x) * f, y: p.y + (q.y - p.y) * f + s }, { x: p.x + (q.x - p.x) * f - s, y: p.y + (q.y - p.y) * f }], true);
            }
        };
        stream(plan.a, plan.endA, col.lilac); stream(plan.b, plan.endB, col.lilac);
        for (const M of plan.mirrors || []) {
            const c2 = tf.full ? col.gold : col.violet;
            stream(M.a, M.end, c2); stream(M.b, M.end, c2);
            for (const q of [M.a, M.b]) { g.lineStyle(1.5, c2, 0.8); g.strokeCircle(q.x, q.y, 5 + Math.sin(now * 0.01)); }
        }
        for (const [f, q] of [[plan.fizzA, plan.endA], [plan.fizzB, plan.endB]]) if (f) {
            g.lineStyle(2.5, 0xff7a7a, 0.95); g.lineBetween(q.x - 5, q.y - 5, q.x + 5, q.y + 5); g.lineBetween(q.x - 5, q.y + 5, q.x + 5, q.y - 5);
        }
        const im = plan.impacts.reduce((m, i) => (i.dmg > m.dmg ? i : m), plan.impacts[0]);
        const top = (this._csCfg().TF.COLLAPSE_BASE + this._csCfg().TF.COLLAPSE_PER * 50) * (tf.full ? this._csCfg().TF3.MULT : this._csCfg().TF.MULT);
        const k = Math.min(1, im.dmg / top), tint = k > 0.66 ? col.gold : k > 0.33 ? col.lilac : col.violet;
        sig.setVisible(true).setPosition(im.p.x, im.p.y).setTint(tint).setRotation(now * (0.001 + 0.003 * k))
           .setDisplaySize(R * (1.4 + 0.8 * k), R * (1.4 + 0.8 * k)).setAlpha(0.55 + 0.35 * k);
        au.setVisible(true).setPosition(im.p.x, im.p.y).setTint(tint);
        const pips = Math.max(1, Math.ceil(k * 5)), pr = R * (0.8 + 0.4 * k) + 8;
        for (let i = 0; i < 5; i++) {
            const a = -Math.PI / 2 + (i - 2) * 0.28, x = im.p.x + Math.cos(a) * pr, y = im.p.y + Math.sin(a) * pr;
            g.fillStyle(i < pips ? col.gold : 0x2b2540, i < pips ? 1 : 0.8);
            g.fillPoints([{ x, y: y - 3 }, { x: x + 3, y }, { x, y: y + 3 }, { x: x - 3, y }], true);
        }
        for (const extra of plan.impacts) if (extra !== im) { g.lineStyle(2, col.lilac, 0.7); g.strokeCircle(extra.p.x, extra.p.y, R); }
    }
    _csHidePreview() {
        for (const o of this._cs?.tf?.pvFx || []) o?.setVisible?.(false);
    }

    // `wait` ms with the objects sitting at their origins, gathering, before they launch.
    _csCollapseFire(plan, wait = 0) {
        const S = this._cs, col = this._csCfg().COL, now = this.time.now;
        const mk = (from, to, d, fizz, gold = false) => {
            const glow = this.add.image(from.x, from.y, 'vfx_glow').setTint(gold ? col.gold : col.violet).setBlendMode(Phaser.BlendModes.ADD).setDepth(4.55).setScale(0.35);
            const ok = CosmicSystem.orbKey(this, gold);
            const core = ok ? this.add.sprite(from.x, from.y, ok, '0').setDepth(4.56).setScale(1.6)
                            : this.add.image(from.x, from.y, 'cs_sheet', 'mote').setTint(col.lilac).setBlendMode(Phaser.BlendModes.ADD).setDepth(4.56).setScale(2.2);
            if (ok && this.anims.exists(ok)) core.play(ok);
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
                // a tail of motes, longer the faster it's going
                if (Math.random() < 0.4 + 0.6 * f) {
                    const m = this.add.image(x, y, 'cs_sheet', 'mote').setTint(o.core._csGold ? col.gold : col.lilac).setBlendMode(Phaser.BlendModes.ADD).setDepth(4.54);
                    this.tweens.add({ targets: m, alpha: 0, scale: 0.2, duration: 260 + 200 * f, onComplete: () => m.destroy() });
                }
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
            if (tf?.full && e.health > 0 && e.sprite?.active) this._csHex(e);
        }
        n += this._csHitBosses(x, y, R * T, dmg);
        Sfx.play(this, 'collapse', { big: dmg > 14 * (this.damageScaling || 1), gold: !!tf?.full });
        // the form lasts longer for collapses that land
        if (tf?.phase === 'form' && n > 0) {
            const add = n >= 3 ? C.EXTEND_3 : C.EXTEND_1;
            tf.until = Math.min(tf.cap, tf.until + add);
            this.showStatusText(this.player.x, this.player.y - 30, `+${(add / 1000).toFixed(1)}s`, '#ffe08a');
        }
        // The impact: everything pulled in for a beat (an implosion), then a white core, a rune
        // circle stamped and thrown off, three shock rings, rays, debris flung out, a scar of
        // void left on the floor, and the camera punched in.
        const big = dmg > 14 * (this.damageScaling || 1), hue = tf?.full ? col.gold : col.lilac, RR = R * T;
        const core = this.add.image(x, y, 'vfx_glow').setTint(hue).setBlendMode(Phaser.BlendModes.ADD).setDepth(4.7).setScale(1.1);
        this.tweens.add({ targets: core, scale: 0.08, duration: 110, ease: 'Quad.easeIn', onComplete: () => {
            core.destroy();
            const flash = this.add.image(x, y, 'vfx_glow').setTint(0xffffff).setBlendMode(Phaser.BlendModes.ADD).setDepth(4.8).setScale(0.3);
            this.tweens.add({ targets: flash, scale: RR / 30, alpha: 0, duration: 260, ease: 'Quad.easeOut', onComplete: () => flash.destroy() });
            const sig = this.add.image(x, y, CosmicSystem.sigilKey(this)).setTint(hue).setBlendMode(Phaser.BlendModes.ADD).setDepth(4.65).setDisplaySize(RR, RR);
            this.tweens.add({ targets: sig, scaleX: sig.scaleX * 2.6, scaleY: sig.scaleY * 2.6, rotation: 1.2, alpha: 0, duration: 520, ease: 'Cubic.easeOut', onComplete: () => sig.destroy() });
            [[0xffffff, 1.1, 260], [hue, 1.6, 420], [col.violet, 2.3, 600]].forEach(([c, s, ms], i) =>
                this.time.delayedCall(i * 60, () => VisualFX.ripple(this, x, y, 6, RR * s * (big ? 1.25 : 1), c, { depth: 4.6, duration: ms })));
            const rays = this.add.graphics().setDepth(4.66).setBlendMode(Phaser.BlendModes.ADD).setPosition(x, y);
            for (let i = 0; i < 12; i++) {
                const a = i * Math.PI / 6 + Math.random() * 0.2, l = RR * (1.3 + Math.random() * 0.8);
                rays.lineStyle(i % 2 ? 1.5 : 3, i % 3 ? hue : 0xffffff, 0.9); rays.lineBetween(Math.cos(a) * 6, Math.sin(a) * 6, Math.cos(a) * l, Math.sin(a) * l);
            }
            rays.setScale(0.3);
            this.tweens.add({ targets: rays, scale: 1, alpha: 0, duration: 340, ease: 'Quad.easeOut', onComplete: () => rays.destroy() });
            for (let i = 0; i < (big ? 22 : 14); i++) {
                const a = Math.random() * Math.PI * 2, d = RR * (0.8 + Math.random() * 1.4);
                const m = this.add.image(x, y, 'cs_sheet', 'mote').setTint(Math.random() < 0.4 ? 0xffffff : hue).setBlendMode(Phaser.BlendModes.ADD).setDepth(4.64).setScale(1 + Math.random());
                this.tweens.add({ targets: m, x: x + Math.cos(a) * d, y: y + Math.sin(a) * d, alpha: 0, scale: 0.2, duration: 380 + Math.random() * 300, ease: 'Cubic.easeOut', onComplete: () => m.destroy() });
            }
            const scar = VisualFX.aura(this, x, y, RR * 1.1, col.violet, { breathe: false, alpha: 1 });
            this.tweens.add({ targets: scar, alpha: 0, duration: 1400, ease: 'Quad.easeIn', onComplete: () => scar.destroy() });
            this._csBurst(x, y, RR, col.violet, 420);
            this._vfxFlash?.(x, y, RR * 2.4, hue, 320, 0.9);
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
    // once each. Drawn as a wide beam: a magenta haze, a lilac body, a white core, sparks at
    // every bounce, fading as it goes.
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
        const g = this.add.graphics().setDepth(4.5).setBlendMode(Phaser.BlendModes.ADD);
        for (const [w, c, a] of [[16, col.hex, 0.22], [9, col.lilac, 0.55], [3, 0xffffff, 0.95]]) { g.lineStyle(w, c, a); g.strokePoints(pts); }
        for (let i = 1; i < pts.length; i++) {   // a few motes shed along it
            for (let k = 0; k < 4; k++) {
                const f = Math.random(), mx = pts[i - 1].x + (pts[i].x - pts[i - 1].x) * f, my = pts[i - 1].y + (pts[i].y - pts[i - 1].y) * f;
                const m = this.add.image(mx, my, 'cs_sheet', 'mote').setTint(col.hex).setBlendMode(Phaser.BlendModes.ADD).setDepth(4.55);
                this.tweens.add({ targets: m, y: my - 10, alpha: 0, duration: 380, onComplete: () => m.destroy() });
            }
        }
        this.tweens.add({ targets: g, alpha: 0, duration: 320, ease: 'Quad.easeIn', onComplete: () => g.destroy() });
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
            const vk = CosmicSystem.voidletKey(this, kind), SC = kind === 'warrior' ? 1.7 : 1.5;
            // on the ground beside you (the crystal hovers a touch): VY lines their feet up with a slime's
            const VY = kind === 'warrior' ? 6 : 3;
            const spr = this.add.sprite(px, py + (this.SLIME_Y_OFFSET || 0) + VY, vk, '0').setScale(SC).setDepth(this.player.depth - 0.01);
            if (this.anims.exists(vk)) spr.play(vk);
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
                        v.reticle = v.reticle || this.add.image(0, 0, CosmicSystem.sigilKey(this)).setTint(col.hex).setBlendMode(Phaser.BlendModes.ADD).setDepth(4.6);
                    }
                }
                if (v.lock) {
                    const e = v.lock.e, k = Math.min(1, (now - v.lock.at) / C.BEAM_LOCK_MS);
                    if (!e.sprite?.active || e.health <= 0) { v.lock = null; v.reticle?.setVisible(false); }
                    else {
                        v.reticle.setVisible(true).setPosition(e.sprite.x, e.sprite.y).setDisplaySize(60 - 36 * k, 60 - 36 * k).setRotation(now * 0.008).setAlpha(0.4 + 0.6 * k);
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
        const vb = this._voidSniperBolts;
        if (vb) for (let i = vb.length - 1; i >= 0; i--) {
            const b = vb[i];
            if (!b.gfx?.active || !near(b.gfx.x, b.gfx.y)) continue;
            this._csWardEat(b.gfx.x, b.gfx.y, b); b.gfx.destroy(); vb.splice(i, 1);
        }
        const ro = this._rippleOrbs;
        if (ro) for (let i = ro.length - 1; i >= 0; i--) {
            const o = ro[i];
            if (!near(o.x, o.y)) continue;
            this._csWardEat(o.x, o.y); o.g?.destroy(); ro.splice(i, 1);
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
        const C = this._csCfg().WELL, col = this._csCfg().COL, T = this.TILE_SIZE;
        W.disk.rotation -= dt * 0.004;
        W.ring.rotation += dt * 0.0012;
        W.glow.setAlpha(0.55 + 0.15 * Math.sin(now * 0.008));
        // it grows as it feeds: its reach from GROW_FROM to GROW_TO of RADIUS over its life
        W.r = C.RADIUS * (C.GROW_FROM + (C.GROW_TO - C.GROW_FROM) * Math.min(1, (now - W.t0) / C.MS));
        W.ring.setScale(W.r * T * 2 / 36); W.glow.setScale(0.85 * W.r / C.RADIUS);
        // motes spiralling in
        if (now - W.moteAt > 70) {
            W.moteAt = now;
            const a = Math.random() * Math.PI * 2, r = W.r * T * (0.6 + Math.random() * 0.4);
            const m = this.add.image(W.x + Math.cos(a) * r, W.y + Math.sin(a) * r, 'cs_sheet', 'mote')
                .setTint(Math.random() < 0.3 ? col.gold : col.lilac).setBlendMode(Phaser.BlendModes.ADD).setDepth(1.05);
            this.tweens.add({ targets: m, x: W.x, y: W.y, scale: 0.2, alpha: 0.2, duration: 520, ease: 'Quad.easeIn', onComplete: () => m.destroy() });
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
                const left = S.wardsUntil - now;
                w.img.setAlpha(left < 1200 && !this._csAscending() ? (Math.floor(now / 100) % 2 ? 0.4 : 1) : 1);
            });
        }
        // Event Horizon: a dark violet shell
        // Event Horizon: a force field of the dark between stars round you (VisualFX.forceField), stars caught in it
        if (now < S.horizonUntil) {
            const g = keep('horizon', () => this.add.graphics().setBlendMode(Phaser.BlendModes.ADD));
            const left = S.horizonUntil - now, fade = Math.min(1, (now - (S.horizonAt ??= now)) / 200) * (left < 1200 ? 0.45 + 0.55 * (Math.floor(now / 100) % 2) : 1);
            const hit = Math.max(0, 1 - (now - (S.horizonHitAt || 0)) / 260), R = this.TILE_SIZE * 1.05;
            g.clear().setPosition(cx, cy).setDepth(d + 0.02);
            VisualFX.forceField(g, { col: 0x6a2ac8, rim: 0xd8a8ff, R, t: now - S.horizonAt, fade, hit, hitA: S.horizonHitA ?? -Math.PI / 2 });
            for (let k = 0; k < 5; k++) { const a = now * 0.0007 * (k % 2 ? 1 : -1) + k * 1.3, rr = 0.45 + (k % 3) * 0.17; g.fillStyle(k % 2 ? 0xffffff : 0xffd060, 0.8 * fade); g.fillRect(Math.cos(a) * R * rr - 1, Math.sin(a) * R * 0.86 * rr - 1, 2, 2); }   // stars turning in it
        } else { S.horizonAt = undefined; drop('horizon'); }
        // Retribution: thorns, turning slowly, sharper for a moment after they bit
        if (now < S.retributionUntil) {
            const t = keep('thorns', () => this.add.image(cx, cy, 'cs_sheet', 'thorns').setBlendMode(Phaser.BlendModes.ADD));
            const bite = Math.max(0, 1 - (now - S.retAt) / 300);
            t.setPosition(cx, cy).setDepth(d - 0.02).setRotation(t.rotation + dt * 0.0008)
             .setScale(0.95 + 0.25 * bite).setAlpha((S.retributionUntil - now < 1200 ? 0.3 : 0.55) + 0.45 * bite);
        } else drop('thorns');
        // Starfall: while the window is open, a gold spark circles you per star you've picked up
        if (S.astro?.got) {
            for (let i = 0; i < 3; i++) {
                const k = 'tail' + i;
                if (i >= S.astro.got) { drop(k); continue; }
                const s = keep(k, () => this.add.image(cx, cy, 'cs_sheet', 'mote').setBlendMode(Phaser.BlendModes.ADD).setTint(col.gold));
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
            const h = keep('halo', () => this.add.image(cx, cy, 'cs_sheet', 'halo'));
            h.setPosition(Math.round(p.x), Math.round(p.y - 19 + Math.sin(now * 0.008) * 1.5)).setDepth(d + 0.03);
            if (Math.random() < dt / 45) {
                const m = this.add.image(p.x + (Math.random() - 0.5) * 18, p.y + 8, 'cs_sheet', 'mote')
                    .setTint(Math.random() < 0.35 ? col.gold : col.lilac).setBlendMode(Phaser.BlendModes.ADD).setDepth(d + 0.02);
                this.tweens.add({ targets: m, y: m.y - 26, alpha: 0, duration: 520 + Math.random() * 260, onComplete: () => m.destroy() });
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
        this._csTrayIcon = this.add.image(0, 0, 'cs_sheet', 'i_' + this._csWeapon()).setScrollFactor(0).setDepth(32).setScale(2);
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
            : w === 'void_blade' ? (S.fluid?.some(t => !t.dash) && S.fluidSpan ? ['COSMIC FLUID', (S.fluidSpan.to - now) / (S.fluidSpan.to - S.fluidSpan.from)] : now < S.retributionUntil ? ['RETRIBUTION', (S.retributionUntil - now) / C.BLADE.MS] : null) : null;
        if (boon) return { label: boon[0], frac: boon[1], mode: 'boon', cd: now < S.cdUntil };
        if (now < S.cdUntil) {
            const cd = { barrier_staff: C.BARRIER.CD, astrolabe: C.ASTRO.CD, singularity_staff: C.WELL.CD, void_blade: C.BLADE.CD }[w] || 12000;
            return { label: `${C.NAMES[w] || w}  ${Math.ceil((S.cdUntil - now) / 1000)}s`, frac: 1 - (S.cdUntil - now) / cd, mode: 'cd' };
        }
        return { label: `${C.NAMES[w] || w}  READY`, frac: 1, mode: 'ready' };
    }

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
        const accent = asc ? col.gold : st.mode === 'boon' ? (this._csWeapon() === 'void_blade' ? col.hex : this._csWeapon() === 'astrolabe' ? col.gold : col.violet)
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
        this._csTrayIcon.setFrame(asc ? 'i_ascend' : 'i_' + this._csWeapon()).setPosition(x0 + 16, y)
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

    // A ring going out from (x, y) to radius r.
    _csBurst(x, y, r, color, ms) {
        const ring = this.add.image(x, y, 'vfx_ring').setTint(color).setBlendMode(Phaser.BlendModes.ADD).setDepth(4.5).setScale(0.1).setAlpha(1);
        this.tweens.add({ targets: ring, scale: Math.max(0.2, r / 30), alpha: 0, duration: ms, ease: 'Cubic.easeOut', onComplete: () => ring.destroy() });
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
        const rim = this.add.graphics().setDepth(6.6).setAlpha(0); rim.lineStyle(4, col.violet, 0.9); rim.strokeRect(x0, y0, x1 - x0, y1 - y0); rim.lineStyle(10, col.violet, 0.2); rim.strokeRect(x0 - 4, y0 - 4, x1 - x0 + 8, y1 - y0 + 8); objs.push(rim);
        const stars = this.add.particles(0, 0, 'vfx_dot', { x: { min: x0, max: x1 }, y: { min: y0, max: y1 }, lifespan: 2600, speedY: { min: -10, max: -2 }, scale: { start: 0.5, end: 0 }, alpha: { start: 0.9, end: 0 },
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
