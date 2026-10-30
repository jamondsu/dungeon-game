// ═══════════════════════════════════════════════════════════════════════════
// Trident.js — the Boreal Trident (ice, tier 5): a rime-ash trident, three tines of glacier ice, an aurora gem in its collar
// Click: a three-step combo (each within COMBO_MS of the last; POKE_CD after the thrust, CD after the swipe, SLAM_CD after the
// slam). THRUST, a quick poke: everything on a line REACH tiles down the exact aim, WIDTH tiles across (short of a wall), takes
// DMG and a little chill. SWIPE: everything within SWIPE_R tiles and SWIPE_ARC degrees either side of the aim, SWIPE_DMG and a
// little chill. LEAP: you spring into the air for up to LEAP_MS (untouchable the first LEAP_UP; no dashes, ults, gadgets or swaps
// while up), steered with the movement keys over enemies, hazards and walls (not out of the room you leapt in, nor through a sealed
// door), the slam's footprint under you (it comes down on the nearest floor if you're over a wall); a
// click brings you down early (LAND_MIN at the soonest). The SLAM where you land: SLAM_DMG and FROSTBITE to everything in its
// footprint (squircle: 7x7 with the corners cut, SLAM_R out), rime erupting over it (only the look).
// Hold the click and from HOLD_MS it's drawn back over your shoulder, its throw line showing; let go and it's HURLED straight down
// the aim, skimming low, RANGE tiles (RANGE_FULL drawn to FULL_MS; again after HURL_CD, less RECALL_UP a level of Swift Recall), at
// SPEED, a rip current tearing a wake through an icy sea behind it (its edges pushed out either side, slamming back together):
// every enemy within PULL_R tiles of its line is impaled or dragged onto its tines (CARRY_DMG) and carried; it stops at
// the first wall or boss (PINNED) or drops at its range, and rime crystallises over the floor it passes (LANE_W tiles either side; only its look). Where it
// stops the sea slams shut over it: what it carried takes END_DMG and DAZE_MS; into a wall, or two or more carried, END_BIG times
// that (END_PER more for each one past the first, WALL_DMG more at a wall) and a LONG_DAZE sealed in ice; LAND_DMG to what's within
// LAND_R that it wasn't carrying. Then it flies home to your hand; while it's out you've nothing to stab with. A throw that
// lands having caught something: FROST RUSH, the combo RUSH faster for RUSH_MS from the landing (RUSH_BACK after it's back, if
// later). While the throw is ready a press waits: let go before HOLD_MS and it's the combo's next hit, hold on and it's drawn;
// while it comes back round a press stabs at once.
// RIPTIDE (a perk, sold once Long Hurl is maxed): a click while it flies and you ride its wake (ride), set down a tile short of where it stops.
// FROSTBITE: each hit adds BITE_MS of it (BITE_MAX at most); while it lasts the enemy's chill grows on its own (GROW stacks a
// second) until it freezes into a cube.
// FROST, R's charge, comes only from the combo: each hit gives PTS (thrust, swipe, slam) for each enemy it struck (PTS_N at most).
// AURA, while you hold it: enemy shots within AURA tiles of you fly at SLOW of their speed (Trident.slow: every shot's step reads it).
// R, for KIN_COST frost: FROSTKIN, ice wisps fighting beside you till they're killed (KIN_CAP at most: the oldest shatter away;
// their HP a share of your max HP, KIN_STATS of your defence and of your damage bonus), one of each kind a call (KINDS). MELEE
// (KIN_HP, a KIN_TAUNT pull): nips an enemy (KIN_DMG) from a tile of its own beside it, chilling what's within KIN_AURA tiles
// KIN_CHILL stacks a second. HAIL (SEER_HP): keeps SEER_MIN to SEER_MAX tiles off with a clear line and every SEER_CD calls hail
// on its target: a ring of frost under it, then a spear of ice slanting down on each of the 3x3 tiles round it (the middle last),
// HAIL_DMG (HAIL_MID the middle) and a ninth of HAIL_CHILL of a splash's chill to what's on each. SQUALL (SQUALL_HP): SQUALL_MIN to SQUALL_MAX tiles off, breathes in (SQUALL_TELL) and every
// SQUALL_CD blows a GUST SQUALL_W tiles wide and SQUALL_RANGE long through everything: SQUALL_DMG and Frostbite, no push.
// Frostkin Pack adds one a level, a hail one then a squall.
// FROSTBITE comes only from the slam's hit and the Squall Frostkin; all the rime is only its look. Glacial Tide (a perk): the slam's Frostbite twice as long.
// Art: assets/art/fx_trident (tri_* (32 ways), sea_*/ice_*/foam_*/drop_*/crk_* (the sea and its freeze), spine_*/tip_*/spur_* (the thrust's spine), ride_*, kin_*, seer_*, bite_*, mote/spark/shard/chunk/glint/mist, ring_*, tail_*, core_*,
// wake/trough/spray_*, tell/spear/spot/crater_*, squall_*, gust_*, crystal_*, mark_*, lane_*, pip_*, ico_hurl) and Rimeguard's fx_rimeguard
// (slam_*, spike_*, crys_*, shard/mist: the rime and the bursts).
// ═══════════════════════════════════════════════════════════════════════════
class Trident {
    static CFG = { CD: 650, POKE_CD: 650, COMBO_MS: 1400, REACH: 8, WIDTH: 3, DMG: 4.8, SPIKE_DMG: 12, HIT_CHILL: 2, HIT_DAZE: 500, AFTER_THRUST: 650, SPINE_MS: 500, SPINE_HOLD: 500, CHILL: 0.3, SCALE: 1.25, GRIP: 10, JAB: 1.1,   // (GRIP: art px from the middle back to your hand; JAB: tiles the stab lunges; POKE_CD after the thrust, CD after the swipe)
        SWIPE_R: 3.5, SWIPE_ARC: 100, SWIPE_DMG: 4.8, SWEEP_MS: 300, SWIPE_SCALE: 1.8, AFTER_SWIPE: 600, SWIPE_FREEZE: 520, SWIPE_SPREAD: 250, SPINE_ROW: 5, SPINE_ROW_MS: 110, SHEET_STEP: 3.5 * Math.PI / 180, FREEZE_V: 0.9, FROZEN_MS: 1600, SHATTER_DMG: 10.2, SHATTER_R: 1.5, HIT_STOP: 30,   // (the swipe's boom, at its giant spine: SWEEP_MS + AFTER_SWIPE + SWIPE_SPREAD, the same as the thrust's, AFTER_THRUST + SPINE_MS)
        LEAP_MS: 1000, LAND_MIN: 420, LEAP_UP: 250, LEAP_SPEED: 5, LEAP_H: 48, LEAP_TAU: 320, FALL_MS: 95,   // (the climb: LEAP_H x (1 - e^(-t / LEAP_TAU)), fast off the floor, ever slower toward LEAP_H, never still)
        SLAM_CD: 650, SLAM_R: 3, SLAM_DMG: 10.8, ERUPT_DMG: 21.6, AFTER_SLAM: 750, HEIGHT_K: 0.45, SLAM_STOP: 130,   // (HEIGHT_K: how much more the slam hits from the full base height than from the earliest landing)   // (the hitstops: ms, real time; LEAP_SPEED tiles a second; SLAM_R how far the slam's footprint reaches from where you land)
        SEA_W: 2.6, SEA_GAP: 6, SEA_RUSH: 200, CREST_GAP: 5, CHURN_MS: 110,  CRASH_STOP: 80, LANE_FREEZE: 90, LANE_HOLD: 100, JET_MS: 450, JET_FROST: 330, JET_CATCH: 300, JET_W0: 1, JET_W1: 2.6, NOSE: 0.75, SLAM_WAVE: 690, SLAM_FROST: 40,
        KIN_SHIELD: 0.2, TRI_SHIELD_MS: 3000, TRI_SHIELD_CD: 3000,   // a Frostkin call: a shell of KIN_SHIELD of your max HP till it's broken; a full combo: the Icicle Cannon's Frost Shield for TRI_SHIELD_MS (not while it's up, nor for TRI_SHIELD_CD after)
        RIDE_SPEED: 250, RIDE_EASE: 250, RIDE_GAP: 1, RIDE_MAX: 3000,   // Riptide: you surf the wake at RIDE_SPEED px a second (about 60% of the throw's SPEED; eased in over RIDE_EASE), RIDE_GAP tiles behind the thrown trident at the closest (RIDE_MAX ms at most)   // the wake: its edges pushed out to about SEA_W tiles either side of the lob's line, a slice every SEA_GAP px, slamming shut SEA_LAG tiles behind it
        HOLD_MS: 350, FULL_MS: 900, HURL_CD: 7000, RECALL_UP: 600, RANGE: 5, RANGE_FULL: 8, RANGE_UP: 1, HURL_CHILL: 1, SPEED: 420, BACK: 1100, HANG: 350, HIT: 16, LAND_R: 1.6, LAND_DMG: 4.2,
        PULL_R: 2.5, CARRY_DMG: 3, END_DMG: 8.4, END_BIG: 1.4, END_PER: 0.1, WALL_DMG: 7.2, DAZE_MS: 600, LONG_DAZE: 2200, END_STOP: 110, LANE_W: 1,
        BITE_MS: 3000, BITE_MAX: 6000, GROW: 0.45, GROW_UP: 0.2, BITE_TICK: 200,
        AURA: 3.5, AURA_UP: 0.5, SLOW: 0.35,
        MARK_THRUST: 2, MARK_SWIPE: 1, MARK_MAX: 3, MARK_MS: 4000, MARK_K: 0.4, MARK_BITE: 1000,   // Rime marks: the thrust's and the swipe's, shattered by the slam's eruption
        PTS: [1, 1, 2], PTS_N: 5, KIN_COST: 48, KIN_MAX: 96,
        KIN_N: 3, KIN_CAP: 9, KIN_STATS: 0.5, KIN_HP: 0.25, KIN_TAUNT: 3, KIN_DMG: 3, KIN_STEP: 150, KIN_NIP: 650, KIN_SEEK: 8, KIN_AURA: 2, KIN_CHILL: 0.3,
        SEER_HP: 0.15, SEER_TAUNT: 2, SEER_STEP: 220, SEER_MIN: 3, SEER_MAX: 5, SEER_CD: 1600, HAIL_GAP: 70, HAIL_TELL: 350, HAIL_FALL: 170, HAIL_DMG: 0.6, HAIL_MID: 1.6, HAIL_CHILL: 0.5,   // (the hail: a spear on each of the 3x3 tiles round its target, the middle one last)
        SQUALL_HP: 0.15, SQUALL_MIN: 3, SQUALL_MAX: 6, SQUALL_CD: 4500, SQUALL_TELL: 400, SQUALL_W: 4, SQUALL_RANGE: 9.5, SQUALL_DMG: 2,
        RUSH: 0.85, RUSH_MS: 4000, RUSH_BACK: 3000,   // FROST RUSH: a throw that lands having caught something, the combo RUSH faster for RUSH_MS from the landing (RUSH_BACK after it's back in hand, if that's later)
        RIME_MS: 450, RIME_FAST: 300 };   // the rime (only its look): it stands RIME_MS (the throw's lane), RIME_FAST (the slam's and the swipe's), then melts
    // eighths of a turn clockwise from east: the frame, flipped across, flipped up
    static DIRS = [['e', 0, 0], ['se', 0, 0], ['s', 0, 0], ['se', 1, 0], ['e', 1, 0], ['ne', 1, 0], ['s', 0, 1], ['ne', 0, 0]];
    static held(S) { return S.currentElement === 'ice' && S.equippedWeapons?.ice === 'boreal_trident'; }
    static perk(k) { return WeaponLevels.perk('boreal_trident', k) || 0; }
    static grow() { return Trident.CFG.GROW * (1 + Trident.CFG.GROW_UP * Trident.perk('bite')); }
    static st(S) {
        if (!S._tri) {
            S._tri = { at: -1e9, cd: 0, combo: 0, press: null, buffer: 0, out: null, leap: null, charges: 0, kin: [], hails: [], marked: new Set(), seals: [], bitten: new Set(), crests: new Set(), rAt: 0, fx: null };
            S.events.once('shutdown', () => { if (S._tri?.locked) S.unlockActions?.('trident_leap'); if (S._tri?.ride) S.unlockActions?.('riptide'); S._tri = null; S._triBar = null; S._triAura = null; });
            const A = S.anims, mk = (key, frames, rate, repeat = 0) => { if (!A.exists(key)) A.create({ key, frames: frames.map(f => ({ key: 'fx_trident', frame: f })), frameRate: rate, repeat }); };
            const n = (b, k) => Array.from({ length: k }, (_, i) => `${b}_${i}`);
            mk('tri_kin_idle', ['kin_idle_0', 'kin_idle_1', 'kin_idle_0', 'kin_idle_1', 'kin_idle_0', 'kin_idle_2'], 6, -1);
            mk('tri_kin_dart', ['kin_dart_0', 'kin_dart_1'], 12, -1);
            mk('tri_kin_nip', ['kin_nip_0', 'kin_nip_1', 'kin_nip_1'], 16);
            mk('tri_kin_die', n('kin_die', 4), 10);
            mk('tri_squall_idle', ['squall_idle_0', 'squall_idle_0', 'squall_idle_1', 'squall_idle_1'], 6, -1);
            mk('tri_squall_tell', ['squall_tell_0', 'squall_tell_1'], 8, -1);
            mk('tri_squall_blow', ['squall_blow_0', 'squall_blow_0', 'squall_blow_0'], 8);
            mk('tri_squall_die', ['squall_die_0', 'kin_die_2', 'kin_die_3'], 9);
            mk('tri_seer_idle', ['seer_idle_0', 'seer_idle_1', 'seer_idle_0', 'seer_idle_1', 'seer_idle_0', 'seer_idle_2'], 5, -1);
            mk('tri_seer_cast', ['seer_cast_0', 'seer_cast_0', 'seer_cast_1', 'seer_cast_2'], 12);
            mk('tri_seer_die', ['seer_die_0', 'seer_die_1', 'kin_die_2', 'kin_die_3'], 10);
            mk('tri_tell', n('tell', 3), 9);
            Rimeguard.st(S);   // (its rime: rg_slam, rg_spike)
            if (!A.exists('tri_crys')) A.create({ key: 'tri_crys', frames: [0, 1, 2].map(i => ({ key: 'fx_rimeguard', frame: 'crys_' + i })), frameRate: 9 });
            mk('tri_bite', ['bite_0', 'bite_1'], 3, -1);
            for (const f of ['e', 'ne', 's', 'se']) {
                mk('tri_tail_' + f, n('tail_' + f, 3), 14);
            }
            mk('tri_ring', n('ring', 4), 20);
            mk('tri_core', ['core_0', 'core_1', 'core_2', 'core_1'], 16, -1);
            for (const f of ['e', 'ne', 's', 'se']) mk('tri_spray_' + f, n('spray_' + f, 3), 14);
            mk('tri_spear', ['spear_0', 'spear_1'], 24, -1);
            mk('tri_seal', ['crystal_0', 'crystal_1'], 14);
            mk('tri_unseal', ['crystal_2', 'crystal_2', 'crystal_3', 'crystal_4'], 12);
            mk('tri_mark', ['mark_0', 'mark_1'], 5, -1);
            mk('tri_glint', n('glint', 4), 16);
            for (const b of ['a', 'b']) for (const t of ['', 't', 'd']) mk('tri_sea_' + b + t, [0, 1, 2].map(i => 'sea_' + b + t + i), 6 + Math.floor(Math.random() * 3), -1);
            mk('tri_crk', n('crk', 3), 20);
            for (const f of ['e', 'ne', 's', 'se']) mk('tri_ride_' + f, n('ride_' + f, 2), 8, -1);
            mk('tri_spine_up', n('spine', 4), 30); mk('tri_tip_up', n('tip', 4), 26); mk('tri_spur_up', n('spur', 3), 30);
        }
        return S._tri;
    }
    static dir(a) { return Trident.DIRS[((Math.round(a / (Math.PI / 4)) % 8) + 8) % 8]; }
    // the trident, the nearest of thirty-two ways to `a`: its frame (a quarter's nine, typed: e e2 ese ese2 se sse2 sse s2 s) and the flips
    static T32 = ['e', 'e2', 'ese', 'ese2', 'se', 'sse2', 'sse', 's2', 's'];
    static dir32(a) { const i = ((Math.round(a / (Math.PI / 16)) % 32) + 32) % 32; return i <= 8 ? [i, 0, 0] : i <= 16 ? [16 - i, 1, 0] : i <= 24 ? [i - 16, 1, 1] : [32 - i, 0, 1]; }
    static face(spr, a) { const [b, fx, fy] = Trident.dir32(a); return spr.setFrame('tri_' + Trident.T32[b]).setFlip(!!fx, !!fy); }
    // a short streak behind it on a fast move: the frame it was on a moment ago, left fading where it was
    static streak(S, spr, alpha = 0.4, ms = 90) {
        if (!spr?.active) return;
        const g = S.add.image(spr.x, spr.y, 'fx_trident', spr.frame.name).setFlip(spr.flipX, spr.flipY).setScale(spr.scaleX, spr.scaleY).setDepth(spr.depth - 0.01).setAlpha(alpha * spr.alpha).setTint(0xbfefff);
        S.tweens.add({ targets: g, alpha: 0, duration: ms, onComplete: () => g.destroy() });
    }
    static aim(S) {
        const cam = S.cameras.main;
        return Math.atan2((S.pointerY ?? 0) + cam.scrollY - S._shotY(), (S.pointerX ?? 0) + cam.scrollX - S._shotX());
    }

    // The frost, a scene's particle emitters, made the first time: sparks and shards (white -> pale cyan -> blue), the aura's
    // motes, ice chunks flung up (falling), the soft glow
    static fx(S) {
        const st = Trident.st(S), ADD = Phaser.BlendModes.ADD;
        if (st.fx?.spark?.active) return st.fx;
        const F = { dir: null };
        const ang = () => F.dir ? F.dir[0] + (Math.random() - 0.5) * F.dir[1] : Math.random() * 360;
        F.spark = S.add.particles(0, 0, 'fx_trident', { frame: ['spark_0', 'spark_1', 'spark_2', 'spark_3'], emitting: false, lifespan: { min: 180, max: 420 },
            speed: { min: 10, max: 70 }, angle: { onEmit: ang }, scale: { start: 1.3, end: 0.6 }, alpha: { start: 1, end: 0 },
            color: [0xffffff, 0xdff8ff, 0x9fe4ff, 0x3a86c8], colorEase: 'quad.out', blendMode: ADD }).setDepth(3.45);
        F.shard = S.add.particles(0, 0, 'fx_trident', { frame: ['shard_0', 'shard_1', 'shard_2'], emitting: false, lifespan: { min: 260, max: 560 },
            speed: { min: 50, max: 170 }, angle: { onEmit: ang }, gravityY: 240, scale: { start: 1.6, end: 0.8 }, alpha: { start: 0.95, end: 0 },
            color: [0xe8fbff, 0xbfeeff, 0x7fc8f8, 0x3a86c8], colorEase: 'quad.out', blendMode: ADD }).setDepth(3.46);
        F.mote = S.add.particles(0, 0, 'fx_trident', { frame: ['mote_0', 'mote_1', 'mote_1', 'mote_2', 'mote_3'], emitting: false, lifespan: { min: 900, max: 1600 },
            speed: { min: 4, max: 14 }, angle: { onEmit: ang }, gravityY: 6, scale: { start: 1.2, end: 0.8 }, alpha: { onEmit: () => 0, onUpdate: (p, k, t) => t < 0.2 ? 3 * t : 0.6 * (1 - (t - 0.2) / 0.8) },
            color: [0xffffff, 0xcff4ff, 0x7fc8ff, 0x3a6ab8], blendMode: ADD }).setDepth(3.44);
        F.chunk = S.add.particles(0, 0, 'fx_trident', { frame: ['chunk_0', 'chunk_1', 'chunk_2', 'chunk_3', 'chunk_4'], emitting: false, lifespan: { min: 420, max: 780 },
            speed: { min: 70, max: 180 }, angle: { onEmit: ang }, gravityY: 460, scale: { start: 1.4, end: 1 }, alpha: { start: 1, end: 0, ease: 'Quad.easeIn' } }).setDepth(3.47);
        F.frost = S.add.particles(0, 0, 'fx_trident', { frame: ['glint_0', 'glint_2', 'mote_1'], emitting: false, lifespan: { min: 120, max: 220 },   // (rime on a slowed shot)
            speed: 0, scale: { start: 1.2, end: 0.6 }, alpha: { start: 0.8, end: 0 }, color: [0xffffff, 0xbfeeff, 0x6fb8ef], blendMode: ADD }).setDepth(4.6);
        F.fleck = S.add.particles(0, 0, 'fx_trident', { frame: ['fleck_0', 'fleck_0', 'fleck_1', 'fleck_2', 'foam_2'], emitting: false, lifespan: { min: 200, max: 380 },   // (spray and bubbles off a crest)
            speed: { min: 4, max: 18 }, angle: { min: 220, max: 320 }, gravityY: 30, scale: { start: 1.5, end: 1 }, alpha: { start: 0.95, end: 0 } }).setDepth(0.99);
        return (st.fx = F);
    }
    // a one-off: the typed animation `anim` played once at (x, y), then gone
    static once(S, x, y, anim, k, depth, add = true) {
        const s = S.add.sprite(x, y, 'fx_trident').setScale(k).setDepth(depth);
        if (add) s.setBlendMode(Phaser.BlendModes.ADD);
        s.play(anim).once('animationcomplete', () => s.destroy());
        return s;
    }
    // an 8-way effect `base` (tail) pointing at eighth i8, centred on (x, y)
    static fx8(S, x, y, base, i8, k, depth) {
        const [f, fx, fy] = Trident.DIRS[((i8 % 8) + 8) % 8];
        return Trident.once(S, x, y, `tri_${base}_${f}`, k, depth).setFlip(!!fx, !!fy);
    }
    // THE SEA (the swipe's sheet of water, the throw's wake) is only drawn: sprites, never a water tile (no addWater, nothing in
    // waterTiles, no wet flag on anything), so it wets nothing, conducts nothing, feeds no Diver and wakes no Drowner.
    // A piece of water at (x, y): typed, no outline, so a crowd of them is one body of water; its ripples moving
    static water(S, x, y, k, depth, tone) {
        const b = Math.random() < 0.5 ? 'a' : 'b', r = Math.random(), t = tone ?? (r < 0.5 ? '' : r < 0.8 ? 't' : 'd'), w = S.add.sprite(x, y, 'fx_trident', 'sea_' + b + t + '0').setScale(k).setFlip(Math.random() < 0.5, Math.random() < 0.5).setDepth(depth).setAlpha(0);
        w.play({ key: 'tri_sea_' + b + t, startFrame: Math.floor(Math.random() * 3) });
        w._kind = 'sea'; w._b = b;
        S.time.delayedCall(4500, () => w.active && w.destroy());   // (however its effect ended, never left behind)
        return w;
    }
    // a cast's own unevenness: 1 + a few sine waves of x at random phases (amps, freqs), so no two waves of the sea have the same shape
    static wavy(amps, freqs) { const ph = amps.map(() => Math.random() * Math.PI * 2); return x => 1 + amps.reduce((a, A, i) => a + A * Math.sin(freqs[i] * x + ph[i]), 0); }
    // in the body of the water at (x, y) heading a: now and then a darker streak of current (curr) or a ripple of light moving through
    // it (swell); kept in `sea`, so they freeze with it
    static churnBody(S, sea, x, y, a, depth, box) {
        const rr = Math.random();
        if (rr < 0.12) { const [f, fx, fy] = Trident.dir(a), c = S.add.image(x, y, 'fx_trident', 'curr_' + f).setFlip(!!fx, !!fy).setScale(1.5).setAlpha(0.45).setDepth(depth + 0.002); c._kind = 'curr'; box?.add(c); sea.push(c); S.tweens.add({ targets: c, x: c.x + Math.cos(a) * 8, y: c.y + Math.sin(a) * 8, duration: 500 }); }
        else if (rr < 0.24) {
            const w = S.add.image(x, y, 'fx_trident', 'swell_' + Math.floor(Math.random() * 3)).setScale(1.5).setFlipX(Math.random() < 0.5).setAlpha(0).setDepth(depth + 0.003); w._kind = 'swell'; box?.add(w); sea.push(w);
            S.tweens.add({ targets: w, alpha: 0.8, duration: 120, yoyo: true, hold: 80 }); S.tweens.add({ targets: w, x: w.x + Math.cos(a) * 12, y: w.y + Math.sin(a) * 12, duration: 400 });
        }
    }
    // a drop flung from (x, y) at (vx, vy) px a second, falling; frozen, it stops where it is (freezeBit kills its tweens)
    static drop(S, sea, x, y, vx, vy, depth = 3.13) {
        const d = S.add.image(x, y, 'fx_trident', 'drop_' + Math.floor(Math.random() * 3)).setScale(1.3 + Math.random() * 0.5).setDepth(depth);
        const ms = 380 + Math.random() * 220, fall = 0.5 * 700 * (ms / 1000) ** 2;
        d._kind = 'drop'; sea.push(d);
        S.tweens.add({ targets: d, x: x + vx * ms / 1000, duration: ms });
        S.tweens.add({ targets: d, y: { value: y + vy * ms / 1000 + fall, ease: p => p * p + (1 - p) * p * 0 }, duration: ms, onComplete: () => d.destroy() });
        return d;
    }
    // The swing's sea, a frame of it: water thrown all across the span the trident swept since the last frame (a0 to a1, R0 to R1 px
    // out), laid into `water` and `foam` (containers on you: the sheet moves with you as one piece while it's swung): pieces of water
    // running together into one sheet with a haze of blue under them, a foam crest along the reach, a foam front at the tines (going
    // in a moment, so it rides with them), drops flung off the crest like embers. Every piece rolls on outward and round the way it
    // was swung, the further out the further (the sheet curling over). sea: the pieces, for the freeze
    static sheet(S, sea, a0, a1, water, foam, side, R0, R1) {
        const T = S.TILE_SIZE, lob = sea._lob ||= Trident.wavy([0.06, 0.04], [4, 9]), torn = sea._torn ||= Trident.wavy([0.5, 0.35], [6, 13]);   // (this cast's own shape)
        const n = Math.max(1, Math.ceil(Math.abs(a1 - a0) / Trident.CFG.SHEET_STEP));   // (every SHEET_STEP of the swing, at its own angle, however long the frame)
        for (let i = 1; i <= n; i++) {
            const b = a0 + (a1 - a0) * i / n, c = Math.cos(b), sn = Math.sin(b), tc = -sn * side, ts = c * side, k = sea._k = (sea._k || 0) + 1;
            const put = (box, w, r, out, round, ms = 640) => { const wx = Math.floor((water.x + c * r) / T), wy = Math.floor((water.y + sn * r + 6) / T); if (S.world[wx]?.[wy] !== S.FLOOR || !Trident.clear(S, S.playerX, S.playerY, wx, wy)) { w.destroy(); return w; } box.add(w); w.setPosition(c * r, sn * r); sea.push(w);
                const ex = w.x + c * out + tc * round, ey = w.y + sn * out + ts * round, etx = Math.floor((water.x + ex) / T), ety = Math.floor((water.y + ey + 6) / T);
                if (S.world[etx]?.[ety] !== S.FLOOR || !Trident.clear(S, S.playerX, S.playerY, etx, ety)) { out = 0; round = 0; }   // (its creep stops short of a wall)
                S.tweens.add({ targets: w, x: w.x + c * out + tc * round, y: w.y + sn * out + ts * round, scaleX: w.scaleX * (1.2 + 1.4 * out / Math.max(20, r)), scaleY: w.scaleY * (1.2 + 1.4 * out / Math.max(20, r)), duration: ms * 2.6, ease: 'Quad.easeOut' }); return w; };   // (still creeping out when the frost comes, growing as it goes: one sheet)   // (still creeping out when the frost comes)
            if (k % 2) { const g = S.add.image(0, 0, 'vfx_glow').setTint(0x1a5aa6).setAlpha(0.28).setScale(0.4 + Math.random() * 0.2); g._kind = 'glow'; put(water, g, R0 + Math.random() * (R1 - R0), 6, 6); }
            const Rb = R1 * lob(b), Ra = R0 * Math.max(0.5, torn(b));   // (its reach lumpy, its inner edge torn)
            for (let j = 0; j < 4; j++) {   // the body: one piece in each of four bands across the span (jittered inside it), bigger further out, so they overlap both ways
                const r = Ra + (Rb - Ra) * (j + 0.3 + Math.random() * 0.4) / 4, q = r / R1, w = Trident.water(S, 0, 0, 1.4 + 0.5 * q + Math.random() * 0.2, 0);
                S.tweens.add({ targets: w, alpha: 0.88, duration: 70 });
                put(water, w, r, 2 + 10 * q, 2 + 12 * q);
            }
            put(foam, Trident.crest(S, 0, 0, b, k, 0), Rb + (Math.random() - 0.5) * 4, 10 + Math.random() * 8, 8 + Math.random() * 8);   // (the crest, a piece a step: unbroken, breaking unevenly)
            if (k % 2) { const rq = Ra + Math.random() * (Rb - Ra), wx = Math.floor((water.x + c * rq) / T), wy = Math.floor((water.y + sn * rq + 6) / T); if (S.world[wx]?.[wy] === S.FLOOR && Trident.clear(S, S.playerX, S.playerY, wx, wy)) Trident.churnBody(S, sea, c * rq, sn * rq, b + side * Math.PI / 2, 0, water); }
            if (!(k % 2)) {   // (the front, at the tines)
                const ff = S.add.image(0, 0, 'fx_trident', 'foam_' + Math.floor(Math.random() * 3)).setScale(1.2 + Math.random() * 0.4); ff._kind = 'foam';
                put(foam, ff, R0 + 4 + Math.random() * (R1 - R0 - 4), 3, 4, 200);
                S.tweens.add({ targets: ff, alpha: 0, delay: 60, duration: 160 });
            }
            if (Math.random() < 0.2 && S.world[Math.floor((water.x + c * R1) / T)]?.[Math.floor((water.y + sn * R1 + 6) / T)] === S.FLOOR && Trident.clear(S, S.playerX, S.playerY, Math.floor((water.x + c * R1) / T), Math.floor((water.y + sn * R1 + 6) / T))) { const v = 50 + Math.random() * 80, u = 20 + Math.random() * 50; Trident.drop(S, sea, water.x + c * R1, water.y + sn * R1, c * v + tc * u, sn * v + ts * u - 70); }
        }
    }
    // a piece of a wave's crest at (x, y), its front facing a: one of six typed shapes of foam, any of them, flipped along itself at
    // random (the callers laying them overlapping along a front, unevenly, so it's one unbroken edge that never repeats); it churns
    // while it rides (churn: its shape swapping, spray flecks thrown off it); frozen, white ice spray (freezeBit)
    static CREST8 = ['e', 'se', 's', 'sw', 'w', 'nw', 'n', 'ne'];
    static crest(S, x, y, a, k, depth) {
        const d = Trident.CREST8[((Math.round(a / (Math.PI / 4)) % 8) + 8) % 8], c = S.add.image(x, y, 'fx_trident', `crest_${d}_${Math.floor(Math.random() * 6)}`).setScale(1.05 + Math.random() * 0.95).setDepth(depth);
        if (d.length === 1) c.setFlip((d === 'n' || d === 's') && Math.random() < 0.5, (d === 'e' || d === 'w') && Math.random() < 0.5);
        c._kind = 'crest'; c._cd = d; c._fr = Math.random() * Math.random() * 0.4;   // (how much spray it throws: mostly little, some a lot)
        Trident.st(S).crests.add(c);
        return c;
    }
    // the crests churning, every CHURN_MS: a third of the riding pieces swap their shape; now and then a fleck of spray or a bubble off one
    static churn(S, time) {
        const st = S._tri;
        if (!st.crests.size || time < (st.churnAt || 0)) return;
        st.churnAt = time + Trident.CFG.CHURN_MS;
        const F = Trident.fx(S);
        for (const c of st.crests) {
            if (!c.active || c._iced) { st.crests.delete(c); continue; }
            if (!c.visible) continue;
            if (Math.random() < 0.33) c.setFrame(`crest_${c._cd}_${Math.floor(Math.random() * 6)}`);
            if (Math.random() < c._fr) { const [x, y] = Trident.wpos(c); F.fleck.emitParticleAt(x + (Math.random() - 0.5) * 10, y - 3 - Math.random() * 4, 1); }
        }
    }
    // where a piece of the sea is in the world (in a container or not)
    // the scene's own time, ms, slowed with it (a hitstop: S.time.now runs on through one, the tweens and timers don't), for the water
    // that grows on a clock: it stands still through the stop with everything else
    static clock(S) {
        let k = S._triClk;
        if (!k) { k = S._triClk = { t: 0 }; const f = (time, dt) => { k.t += dt * S.time.timeScale; }; S.events.on('preupdate', f); S.events.once('shutdown', () => { S.events.off('preupdate', f); if (S._triClk === k) S._triClk = null; }); }
        return k.t;
    }
    static wpos(w) { const c = w.parentContainer; return c ? [c.x + w.x, c.y + w.y] : [w.x, w.y]; }
    // THE CHASE: a frost front run out from (ox, oy) from now, at(t) how far it's got t ms on (px), till it's past `far`: each piece
    // of the sea it reaches flash-freezes that instant where it is, moving or not (freezeBit); the front a hard white crackling line
    // (line(r): points along it at r), a cold shadow running just ahead of it; a crackle rising as it goes, a crack as it's done
    static chase(S, sea, ox, oy, at, far, line) {
        const t0 = Trident.clock(S), F = Trident.fx(S);
        let half = false;
        Sfx.play(S, 'freeze', { soft: true });
        const ev = S.time.addEvent({ delay: 16, loop: true, callback: () => {
            if (!S.sys?.isActive()) { ev.remove(); return; }
            const r = at(Trident.clock(S) - t0);
            for (const w of sea) { if (!w.active || w._iced) continue; const [x, y] = Trident.wpos(w); if (Math.hypot(x - ox, y - oy) <= r) Trident.freezeBit(S, w); }
            if (r <= far + 4) {
                for (const [x, y] of line(r)) { Trident.once(S, x, y, 'tri_crk', 1.2, 3.3).setFlip(Math.random() < 0.5, Math.random() < 0.5); F.spark.emitParticleAt(x, y, 1); }
                for (const [x, y] of line(r + 14)) { const d = S.add.image(x, y, 'vfx_glow').setTint(0x081830).setAlpha(0.22).setScale(0.35).setDepth(0.99); S.tweens.add({ targets: d, alpha: 0, duration: 160, onComplete: () => d.destroy() }); }
            }
            if (!half && r >= far / 2) { half = true; Sfx.play(S, 'freeze'); }
            if (r >= far + 16) { ev.remove(); Sfx.play(S, 'shatter', { soft: true }); }
        } });
    }
    // The sea FLASH-FROZEN from (ox, oy) out, v px a ms: each piece stopped dead where it is as the front reaches it, gone white as
    // the frost goes through it, then ice; a white crackle racing through with the front. How long it took (ms)
    static flashFreeze(S, sea, ox, oy, v) {
        let far = 0;
        for (const w of sea) {
            if (!w.active) continue;
            const [x, y] = Trident.wpos(w), ms = Math.hypot(x - ox, y - oy) / v; far = Math.max(far, ms);
            S.time.delayedCall(ms, () => Trident.freezeBit(S, w));
        }
        Sfx.play(S, 'freeze');
        return far;
    }
    // a piece of the frozen sea blown apart from (cx, cy): flung out fast and gone (up: thrown up off the floor and falling back),
    // a shard off some of the ice
    static fling(S, w, cx, cy, far, up, ms = 200) {
        if (!w?.active) return;
        S.tweens.killTweensOf(w);
        if (w._kind === 'glow') { S.tweens.add({ targets: w, alpha: 0, duration: 140, onComplete: () => w.destroy() }); return; }
        const [wx, wy] = Trident.wpos(w), a = Math.atan2(wy - cy, wx - cx) + (Math.random() - 0.5) * 0.6, RF = Rimeguard.fx(S), T = S.TILE_SIZE;
        let d = far * (0.6 + Math.random() * 0.8);
        const btx = Math.floor(cx / T), bty = Math.floor(cy / T), ok = (x, y) => { const tx = Math.floor(x / T), ty = Math.floor(y / T); return S.world[tx]?.[ty] === S.FLOOR && Trident.clear(S, btx, bty, tx, ty); };   // (over floor in sight of the burst)
        const dd = up ? 0.5 : 1, n = Math.ceil(d * dd / (T / 4));   // (it flies only as far as that goes that way: never over or round a wall)
        for (let i = 1; i <= n; i++) if (!ok(wx + Math.cos(a) * d * dd * i / n, wy + (up ? 0 : Math.sin(a) * d * i / n))) { d *= (i - 1) / n; break; }
        let lift = 12 + Math.random() * 24;
        while (up && lift > 0 && !ok(wx + Math.cos(a) * d * 0.5, wy - lift)) lift -= 3;   // (thrown up, it's still never drawn over a wall)
        w.setDepth(3.3);
        if (up) {
            S.tweens.add({ targets: w, x: w.x + Math.cos(a) * d * 0.5, alpha: 0, duration: ms * 1.6, ease: 'Sine.easeOut', onComplete: () => w.destroy() });
            S.tweens.add({ targets: w, y: w.y - Math.max(0, lift), duration: ms * 0.7, ease: 'Quad.easeOut', yoyo: true });
        } else S.tweens.add({ targets: w, x: w.x + Math.cos(a) * d, y: w.y + Math.sin(a) * d, alpha: 0, duration: ms, ease: 'Quad.easeOut', onComplete: () => w.destroy() });
        if (w._kind === 'sea' && Math.random() < 0.35) { RF.dir = [(up ? -Math.PI / 2 : a) * 180 / Math.PI, 50]; RF.shard.emitParticleAt(wx, wy, 1); RF.dir = null; }
    }
    // an explosion of ice at (x, y), k its size: Rimeguard's burst and a flash (nova), a shockwave, shards and chunks blasted out;
    // sound 'full' a crack and a boom, 'small' a crack; from k 1 a shake
    static boom(S, x, y, k, sound) {
        const F = Trident.fx(S), RF = Rimeguard.fx(S);
        Trident.nova(S, x, y, k);
        if (k >= 1) Trident.ring(S, x, y + 2, 0.8 * k, 0);
        RF.shard.emitParticleAt(x, y - 4, Math.round(5 * k)); F.dir = [-90, 220]; F.chunk.emitParticleAt(x, y, Math.max(1, Math.round(3 * k))); F.dir = null;
        if (sound) { Sfx.play(S, 'shatter', sound === 'small' ? { soft: true } : undefined); if (sound === 'full') Sfx.play(S, 'slam', { small: k < 1.5 }); }
        if (k >= 1) S.cameras.main.shake(80 + 40 * k, 0.003 * k);
    }
    // a piece of the sea frozen: water to cracked ice (white first), foam to rime, a drop to a bead of ice, a sheet of spray
    // stopped mid-air, the haze under it to frost
    static freezeBit(S, w) {
        if (!w.active || w._iced) return;
        w._iced = true; S.tweens.killTweensOf(w);
        S.time.delayedCall(Trident.CFG.FROZEN_MS, () => w.active && S.tweens.add({ targets: w, alpha: 0, duration: 200, onComplete: () => w.destroy() }));   // (never left lying about)
        const k = w._kind, [wx, wy] = Trident.wpos(w), D = (w.parentContainer || w).depth;
        if (k === 'glow') { w.setTint(0x5fb8e8).setAlpha(Math.min(0.18, w.alpha)); return; }
        if (k === 'sea') {
            w.anims.stop(); w.setFrame('flash_' + w._b).setAlpha(0.28);   // (a glance of white as the frost goes through, then clear ice)
            S.time.delayedCall(35, () => w.active && w.setFrame('ice_' + w._b).setAlpha(0.66));
            if (Math.random() < 0.3) Trident.once(S, wx, wy, 'tri_crk', w.scaleX * 0.9, D + 0.05).setFlip(Math.random() < 0.5, Math.random() < 0.5);
        } else if (k === 'foam') w.setFrame('rimefoam_' + (Math.random() < 0.5 ? 0 : 1));
        else if (k === 'crest') w.setFrame('i' + w.frame.name);
        else if (k === 'curr' || k === 'swell') w.setTint(0xd8fff4).setAlpha(Math.max(0.5, w.alpha));
        else if (k === 'drop') w.setFrame('i' + w.frame.name);
        else if (k === 'spray') { w.anims.pause(); w.setTint(0xbfefff); Trident.once(S, wx, wy, 'tri_crk', w.scaleX * 0.8, D + 0.05); }
        if (Math.random() < 0.12) Trident.once(S, wx, wy - 3, 'tri_glint', 1, D + 0.06);
    }
    // a frost burst where something was struck
    static burst(S, x, y, k = 1) {
        S.add.sprite(x, y, 'fx_rimeguard', 'slam_0').setScale(0.8 * k).setBlendMode(Phaser.BlendModes.ADD).setDepth(4.5).play('rg_slam').once('animationcomplete', function () { this.destroy(); });
        Rimeguard.fx(S).shard.emitParticleAt(x, y, Math.round(3 * k)); Trident.fx(S).spark.emitParticleAt(x, y, 2);
    }
    // an impact: Rimeguard's burst of ice (a crater of light, crystals thrown off), a flash
    static nova(S, x, y, k) {
        S.add.sprite(x, y, 'fx_rimeguard', 'slam_0').setScale(1.1 * k).setBlendMode(Phaser.BlendModes.ADD).setDepth(4.55).play('rg_slam').once('animationcomplete', function () { this.destroy(); });
        S._vfxFlash?.(x, y, 14 * k, 0xd8fff4, 160 + 30 * k, Math.min(0.55, 0.18 * k));
    }
    // a frost shockwave out across the floor, k its size (k 1: about a tile round)
    static ring(S, x, y, k, delay = 0, add = true) {
        const go = () => S.sys?.isActive() && Trident.once(S, x, y, 'tri_ring', k, 0.98, add);
        delay ? S.time.delayedCall(delay, go) : go();
    }
    // rolling frost mist, n puffs out to r px
    static mist(S, x, y, n, r) {
        for (let i = 0; i < n; i++) {
            const a = (i + Math.random() * 0.6) / n * Math.PI * 2, m = S.add.image(x + Math.cos(a) * r * 0.25, y + Math.sin(a) * r * 0.18, 'fx_trident', 'mist_' + (i % 3))
                .setScale(1.6 + Math.random() * 0.8).setFlipX(Math.random() < 0.5).setAlpha(0).setDepth(2.9);
            S.tweens.add({ targets: m, x: x + Math.cos(a) * r, y: y + Math.sin(a) * r * 0.7 - 3, duration: 650 + Math.random() * 450, ease: 'Sine.easeOut', onComplete: () => m.destroy() });
            S.tweens.add({ targets: m, alpha: { from: 0.42, to: 0 }, duration: 650 + Math.random() * 450, ease: 'Quad.easeIn' });
        }
    }
    // a frost streak laid behind something moving from (x0, y0) to (x1, y1), n pieces
    static wake(S, x0, y0, x1, y1, n, k = 1.5, delay = 0) {
        const i8 = Math.round(Math.atan2(y1 - y0, x1 - x0) / (Math.PI / 4));
        for (let i = 0; i < n; i++) S.time.delayedCall(delay * i / n, () => S.sys?.isActive() && Trident.fx8(S, x0 + (x1 - x0) * (i + 0.5) / n, y0 + (y1 - y0) * (i + 0.5) / n, 'tail', i8, k, 3.3).setAlpha(0.8));
    }

    // An ice hit on e: through resistance, brittle and your damage (not damageEnemy: its ice hits have a free chance to cube), then
    // `chill` (applyChill's weight). Ice elementals take no damage, only the chill. 'kill' if it died.
    static hit(S, e, dmg, chill = 0) {
        if (S._roomGated?.() && e.tutorialRoomIndex !== undefined && e.tutorialRoomIndex !== S.getCurrentPlayerRoom()) return false;   // a room you haven't entered
        if (!e.iceImmune) {
            const d = S.resolveElementalHit(e, dmg, 'ice');
            if (d === null) return false;
            e.health -= d;
            S.showDamageNumber(e.sprite.x, e.sprite.y - 10, Math.round(d), '#aaeeff');
            CombatSystem.hitFlash(S, e, d, 'ice', true);
            S.updateEnemyHealthBar(e);
            if (!e._noUlt) S.gainUltCharge?.(S.ultChargePerHit);
            if (e.health <= 0) { S._destroyChillIndicator?.(e); S.killEnemy(e); return 'kill'; }
        }
        if (chill) S.applyChill(e, chill);
        return true;
    }
    // Frostbite on e for ms more (BITE_MAX at most)
    static bite(S, e, ms) {
        if (!e?.sprite?.active || e.health <= 0 || e._iceCube || e.isFrozen || e.fireImmune || e.elementImmune || e._immuneFx === 'ice') return;
        const st = Trident.st(S), now = S.time.now;
        e._tbUntil = Math.min(now + Trident.CFG.BITE_MAX, Math.max(e._tbUntil || 0, now) + ms);
        e._tbAt ??= now;
        st.bitten.add(e);
    }
    static unbite(st, e) { e._tbUntil = 0; e._tbAt = undefined; st.bitten.delete(e); }
    // Frost for R from a combo hit that struck n enemies: PTS[step] each, PTS_N of them at most
    static gain(S, n, step) {
        const C = Trident.CFG, st = Trident.st(S), was = st.charges;
        st.charges = Math.min(C.KIN_MAX, st.charges + Math.min(n, C.PTS_N) * C.PTS[step]);
        if (Math.floor(st.charges / C.KIN_COST) > Math.floor(was / C.KIN_COST) && Trident.held(S)) {
            Sfx.play(S, 'rready', { el: 'ice' });
            S.showStatusText?.(S.player.x, S.player.y - 34, st.charges >= C.KIN_MAX ? 'FROSTKIN ×2' : 'FROSTKIN READY', '#d8fff4');
        }
    }

    // ── the click: the combo (a press while the throw's ready waits to see if it's held: tick has it) ──
    static attack(S, targetX, targetY) {
        const st = Trident.st(S);
        if (st.out) { if (Trident.perk('riptide')) Trident.ride(S); return; }   // (thrown: nothing to stab with; with Riptide, a click rides its wake)
        if (st.press) return;   // (held: tick has it)
        st.press = { at: S.time.now, stab: false, drawn: false, ready: S.time.now >= (st.hurlAt || 0) && !st.leap };
    }
    // the combo's pace: its cooldowns (and its window, and how soon a leap can land) times this; less in a Frost Rush
    static pace(S) { return WeaponLevels.cdMult('boreal_trident') / ((S._tri?.rushUntil || 0) > S.time.now ? 1 + Trident.CFG.RUSH : 1); }
    static ready(S) { const st = Trident.st(S); return S.time.now - st.at >= (st.cd || Trident.CFG.CD) * Trident.pace(S); }
    static stab(S) {
        const st = Trident.st(S), C = Trident.CFG, now = S.time.now;
        if (!Trident.ready(S) || st.out || st.leap) return false;
        // mid-dash (a dash glides you to a tile you're already counted on): the leap waits till you've landed, the combo held for it
        if (S._glide && now < (S._glideUntil || 0) && now - st.at <= ((st.cd || C.CD) + C.COMBO_MS) * Trident.pace(S) && st.combo === 1) { st.holdCombo = S._glideUntil + 60; return false; }
        if (st.press) st.press.stab = true;
        Trident.thrust(S, Trident.aim(S));
        return true;
    }

    // The combo, each within COMBO_MS of the last: a thrust, a swipe, the leap and slam
    static thrust(S, aim) {
        const C = Trident.CFG, st = Trident.st(S), now = S.time.now;
        st.combo = now - st.at <= ((st.cd || C.CD) + C.COMBO_MS) * Trident.pace(S) || now <= (st.holdCombo || 0) ? (st.combo + 1) % 3 : 0;
        st.holdCombo = 0;
        st.at = now; st.cd = st.combo === 0 ? C.POKE_CD : C.CD; S._gearFiredAt = now; st.comboEnd = 0;
        if (st.combo === 0) { st.comboHits = [null, null, null]; Trident.jab(S, aim); }   // (a new combo: which of its hits struck, for the Frost Shield and the meter)
        else if (st.combo === 1) Trident.swipe(S, aim);
        else Trident.leap(S, aim);
    }
    // a struck enemy: the hit and a burst; true if it took it
    static strike(S, e, dmg, chill, aim, k = 1) {
        const r = Trident.hit(S, e, dmg, chill), F = Trident.fx(S);
        if (r && e.sprite?.active) { F.dir = [aim * 180 / Math.PI, 70]; Trident.burst(S, e.sprite.x, e.sprite.y - 4, k); F.dir = null; }
        return !!r;
    }
    // bosses and queens on the tiles (once)
    static tiles(S, cells, dmg) {
        const seen = new Set();
        let boss = false;
        for (const [x, y] of cells) {
            if (!boss && S.damageBossAtTile?.(x, y, dmg, undefined, 'ice')) boss = true;
            const p = S.getPortalAt?.(x, y); if (p && !seen.has(p)) { seen.add(p); S.damagePortal(p, dmg); }
        }
        return boss;
    }
    // 1. The thrust: a quick poke down a line REACH tiles toward `aim`, WIDTH across (short of a wall): POKE_DMG, a little chill
    // and MARK_THRUST Rime marks on what it hits. Then the AFTERSHOCK (AFTER_THRUST later): the spine of ice erupts along the same line,
    // your end to the tip, SPIKE_DMG to what's on it as it reaches it
    static jab(S, aim) {
        const C = Trident.CFG, T = S.TILE_SIZE, now = S.time.now, F = Trident.fx(S);
        Sfx.play(S, 'w_boreal_trident');
        const ux = Math.cos(aim), uy = Math.sin(aim), ox = S.playerX, oy = S.playerY;
        let reach = C.REACH;
        for (let d = 0.5; d <= C.REACH; d += 0.25) if (S.world[Math.round(ox + ux * d)]?.[Math.round(oy + uy * d)] !== S.FLOOR) { reach = d - 0.25; break; }
        const inLine = e => { const dx = e.x - ox, dy = e.y - oy, along = dx * ux + dy * uy, across = Math.abs(dy * ux - dx * uy); return along >= 0.4 && along <= reach + 0.3 && across <= C.WIDTH / 2 ? along : -1; };
        const dmg = C.DMG * (S.damageScaling || 1), chill = S._chillCfg().DIRECT * C.HIT_CHILL;
        let struck = 0;
        for (const e of [...(S.enemies || [])]) {
            if (!e.sprite?.active || e.health <= 0 || S._phasedOut?.(e) || !S.isInCurrentRoom(e.x, e.y) || inLine(e) < 0) continue;
            if (Trident.hit(S, e, dmg, chill)) { struck++; Trident.mark(S, e, C.MARK_THRUST); Trident.daze(S, e, C.HIT_DAZE); if (e.sprite?.active) Trident.once(S, e.sprite.x, e.sprite.y - 4, 'tri_spray_' + Trident.dir(aim)[0], 1.1, 3.3, false).setFlip(!!Trident.dir(aim)[1], !!Trident.dir(aim)[2]); }   // (a splash of the jet: the ice comes with the freeze)
        }
        const cells = [];
        for (let d = 0.5; d <= reach + 0.01; d += 0.5) for (const w of [-1, 0, 1]) cells.push([Math.round(ox + ux * d - uy * w), Math.round(oy + uy * d + ux * w)]);
        if (Trident.tiles(S, cells, dmg)) struck++;
        const st0 = Trident.st(S); if (st0.comboHits) st0.comboHits[0] = struck > 0;
        if (struck) { Glaive.hitstop(S, C.HIT_STOP); Trident.gain(S, struck, 0); }
        // the look: a quick poke straight down the aim and a JET of seawater driven down the line to the end of the reach (JET_MS):
        // one body of water three tiles wide, foam along its edges and a foam head riding its front, spray off it (only drawn: see
        // water). Its aftershock: the jet flash-freezes from you out, and the spine erupts out of it, blowing it apart as it goes
        const hx = S._shotX(), hy = S._shotY(), G = C.GRIP * C.SCALE;
        S._scytheSpinUntil = now + 200;   // (the one in your hand is the one stabbing)
        const spr = Trident.face(S.add.sprite(hx + ux * (G - 6), hy + uy * (G - 6), 'fx_trident', 'tri_e'), aim).setScale(C.SCALE).setDepth(3.2);
        const far = G + C.JAB * T * Math.min(1, reach / C.REACH);
        S.tweens.add({ targets: spr, x: hx + ux * far, y: hy + uy * far, duration: 60, ease: 'Quad.easeOut', onComplete: () =>
            S.tweens.add({ targets: spr, x: hx + ux * G, y: hy + uy * G, duration: 120, ease: 'Quad.easeIn', onComplete: () => spr.destroy() }) });
        const gx = ox * T + T / 2, gy = oy * T + T / 2 + 4, pc = Trident.pace(S), end = Math.max(T, reach * T), nx = -uy, ny = ux, jet = [], TJ = C.JET_MS * pc, TF = C.JET_FROST * pc;
        // its outline: narrow at the tines (JET_W0 tiles across), swelling to JET_W1 along its length, a rounded tail cap at your end
        // and a bull-nosed head (a half-round crest, NOSE of its width long, riding the front, water inside it); each edge its own
        // bulges and pinches (wl, wr), now and then a tongue licking out past it; the body laid behind the nose
        const ang = Math.atan2(uy, ux), wl = Trident.wavy([0.12, 0.09, 0.06], [1 / 5, 1 / 11, 1 / 3.3]), wr = Trident.wavy([0.12, 0.09, 0.06], [1 / 6, 1 / 13, 1 / 3.7]);
        const HW = d => { const k = Math.min(1, Math.max(0, d) / (0.6 * end)); return T * (C.JET_W0 + (C.JET_W1 - C.JET_W0) * k * k * (3 - 2 * k)) / 2; };
        const head = [], nose = [], nArc = Math.round(Math.PI * HW(end) / C.CREST_GAP);
        for (let i = 0; i < nArc; i++) { const c = Trident.crest(S, gx, gy, ang, i, 0.985); c._phi = -Math.PI / 2 + Math.PI * (i + 0.5 + (Math.random() - 0.5) * 0.5) / nArc; c._lag = (Math.random() - 0.5) * 6; c._d = end; head.push(c); jet.push(c); }
        for (let i = 0; i < 9; i++) { const w = Trident.water(S, gx, gy, 1.4 + Math.random() * 0.4, 0.97); w._u = Math.random(); w._v = Math.random() * 2 - 1; w._d = end; S.tweens.add({ targets: w, alpha: 0.88, duration: 60 }); nose.push(w); jet.push(w); }
        for (let i = 0, n = Math.round(Math.PI * HW(0) / C.CREST_GAP); i < n; i++) { const phi = Math.PI / 2 + Math.PI * (i + 0.5) / n, c = Trident.crest(S, gx + ux * (8 + Math.cos(phi) * HW(0) * 0.6) + nx * Math.sin(phi) * HW(0), gy + uy * (8 + Math.cos(phi) * HW(0) * 0.6) + ny * Math.sin(phi) * HW(0), ang + phi, i, 0.98); c._d = 8; jet.push(c); }   // (the tail cap, round)
        const wave = t => end * (1 - (1 - Math.min(1, t / TJ)) ** 2);   // (the water's front, t ms on: surging out, slowing as it gets there)
        let laid = 8, o3 = 0;
        Sfx.play(S, 'splash', { soft: true });
        const k0 = Trident.clock(S), jt = S.time.addEvent({ delay: 16, loop: true, callback: () => {
            if (!S.sys?.isActive()) { jt.remove(); return; }
            const t = Trident.clock(S) - k0, d = Math.max(16, wave(t) + (t > TJ ? 8 * (1 - Math.exp(-(t - TJ) / 260)) : 0)), R = HW(d), L = C.NOSE * R, c0 = d - L;   // (the nose: from c0 out to the front d)
            for (const c of head) if (!c._iced) { const al = c0 + (Math.cos(c._phi) * L + c._lag * Math.cos(c._phi)), ac = Math.sin(c._phi) * R * (c._phi < 0 ? wl(d) : wr(d)); c.setPosition(gx + ux * al + nx * ac, gy + uy * al + ny * ac); }
            for (const w of nose) if (!w._iced) { const al = c0 + w._u * L * 0.85, ac = w._v * R * 0.8 * Math.sqrt(Math.max(0, 1 - w._u * w._u)); w.setPosition(gx + ux * al + nx * ac, gy + uy * al + ny * ac); }
            if (Math.random() < 0.18) for (let i = 0, n = 2 + Math.floor(Math.random() * 4); i < n; i++) { const v = 50 + Math.random() * 70, sd = Math.random() < 0.5 ? 1 : -1; Trident.drop(S, jet, gx + ux * d, gy + uy * d - 4, nx * sd * v * 0.6 + ux * 70, ny * sd * v * 0.6 + uy * 70 - 70)._d = d; }   // (spray bursting off its head, now and then)
            for (; laid <= c0; laid += C.CREST_GAP * (0.7 + Math.random() * 0.4)) {
                const bx = gx + ux * laid, by = gy + uy * laid, hw = HW(laid);
                const g = S.add.image(bx, by, 'vfx_glow').setTint(0x1a5aa6).setAlpha(0.28).setScale(0.3 + hw / T * 0.25).setDepth(0.965); g._kind = 'glow'; g._d = laid; jet.push(g);
                if (o3++ % 2 === 0) for (let j = 0, n = Math.max(2, Math.ceil(hw * 1.7 / 10) + 1); j < n; j++) {   // (across its width, a piece every 10px or so, jittered a little: no holes)   // (the water washing on down the line till the frost has it, as wide as it is there)
                    const q = ((j + 0.5 + (Math.random() - 0.5) * 0.4) / n * 2 - 1) * hw * 0.85, w = Trident.water(S, bx + nx * q, by + ny * q, 1.5 + Math.random() * 0.4, 0.97); w._d = laid;
                    S.tweens.add({ targets: w, alpha: 0.88, duration: 60 }); S.tweens.add({ targets: w, x: w.x + nx * q * 0.22 + ux * 6 * laid / end, y: w.y + ny * q * 0.22 + uy * 6 * laid / end, scaleX: w.scaleX * (1.3 + 0.3 * Math.abs(q) / Math.max(1, hw)), scaleY: w.scaleY * (1.3 + 0.3 * Math.abs(q) / Math.max(1, hw)), duration: 1500, ease: 'Quad.easeOut' });   // (swelling all round, growing as it spreads: one body)
                    jet.push(w);
                }
                Trident.churnBody(S, jet, bx + nx * (Math.random() - 0.5) * hw, by + ny * (Math.random() - 0.5) * hw, ang, 0.97); if (jet.length) jet[jet.length - 1]._d ??= laid;
                const tongue = Math.random() < 0.08 ? (Math.random() < 0.5 ? -1 : 1) : 0;   // (now and then a tongue of it licking out past an edge)
                if (tongue) { const ow = hw * (tongue < 0 ? wl(laid) : wr(laid)) + T * 0.2, w = Trident.water(S, bx + nx * tongue * ow, by + ny * tongue * ow, 1.3, 0.97); w._d = laid; S.tweens.add({ targets: w, alpha: 0.88, duration: 60 }); jet.push(w); }
                for (const sd of [-1, 1]) { const o2 = hw * (sd < 0 ? wl(laid) : wr(laid)) + (sd === tongue ? T * (0.25 + Math.random() * 0.2) : 0), c = Trident.crest(S, bx + nx * sd * o2, by + ny * sd * o2, ang + sd * Math.PI / 2, Math.round(laid / C.CREST_GAP), 0.98); c._d = laid; jet.push(c); S.tweens.add({ targets: c, x: c.x + nx * sd * hw * 0.22, y: c.y + ny * sd * hw * 0.22, duration: 1500, ease: 'Quad.easeOut' }); }   // (its flanks creeping out with it)   // (its sides, unbroken)
                if (Math.random() < 0.4) { const v = 40 + Math.random() * 60, sd = Math.random() < 0.5 ? 1 : -1; Trident.drop(S, jet, bx, by - 4, nx * sd * v + ux * 40, ny * sd * v + uy * 40 - 60)._d = laid; }
            }
            if (t >= TJ + 400 || head.every(c => c._iced)) jt.remove();   // (creeping on till the frost has its head)
        } });
        if (struck) S.cameras.main.shake(50, 0.003);
        // the water on its own a beat (JET_FROST), then the frost racing out after it from the tines (JET_CATCH to the tip), catching its
        // crest at the tip as it gets there; then the spine (AFTER_THRUST)
        S.time.delayedCall(TF, () => S.sys?.isActive() && Trident.chase(S, jet, gx, gy, t => end * t / (C.JET_CATCH * pc), end,
            r => [0, 1].map(() => { const q = (Math.random() - 0.5) * 1.8; return [gx + ux * r + nx * q * T * 0.6, gy + uy * r + ny * q * T * 0.6]; })));
        // the aftershock: a SPINE of ice erupting out of the frozen jet a piece at a time over SPINE_MS, your end to the tip (spurs
        // branching off its sides, the last piece a great spike), blowing the ice apart as it goes, each enemy struck as it reaches
        // it; it stands SPINE_HOLD, then breaks up the way it came
        S.time.delayedCall(C.AFTER_THRUST * pc, () => {
            if (!S.sys?.isActive()) return;
            const sd = C.SPIKE_DMG * (S.damageScaling || 1), hitAt = new Set(), n = Math.max(2, Math.round(reach / 0.6)), RF = Rimeguard.fx(S);
            Sfx.play(S, 'slam', { small: true }); Sfx.play(S, 'freeze', { soft: true });
            for (let i = 1; i <= n; i++) {
                const d = 0.25 + (reach - 0.25) * i / n, t = C.SPINE_MS * pc * i / n, last = i === n, k = 1.2 + 0.5 * i / n, life = C.SPINE_MS * pc + C.SPINE_HOLD + 30 * i - t;
                S.time.delayedCall(t, () => {
                    if (!S.sys?.isActive()) return;
                    const j = (Math.random() - 0.5) * 4, x = gx + ux * d * T - uy * j, y = gy + uy * d * T + ux * j;
                    Trident.vertebra(S, x, y, last ? 'tip' : 'spine', last ? 1.7 : k, life);
                    for (const w of jet) if (!w._gone && w._d <= d * T + 8) { w._gone = true; Trident.fling(S, w, x, y + 8, T * 0.9, false, 180); }   // (the frozen jet blown apart where it erupts)
                    if (!last) {   // its spurs: one off a side (the sides taking turns), now and then the other; each may branch again, smaller, further out
                        const sides = [i % 2 ? 1 : -1]; if (Math.random() < 0.4) sides.push(-sides[0]);
                        for (const sd2 of sides) for (let g = 0, w = 0.62, kk = k * 0.8; g < 3 && (g === 0 || Math.random() < 0.55); g++, w *= 1.55, kk *= 0.72) {
                            const along = (Math.random() - 0.5) * 0.4 + 0.15 * g, sx = x + (-uy * sd2 * w + ux * along) * T, sy = y + (ux * sd2 * w + uy * along) * T;
                            if (S.world[Math.floor(sx / T)]?.[Math.floor((sy - 4) / T)] !== S.FLOOR) break;
                            S.time.delayedCall(40 + 45 * g, () => S.sys?.isActive() && Trident.vertebra(S, sx, sy, 'spur', kk, life - 40 - 45 * g, (-uy * sd2 || Math.random() - 0.5) < 0));
                        }
                    }
                    for (const e of [...(S.enemies || [])]) {   // the spine reaching this far: what's on the line here takes it, once
                        if (hitAt.has(e) || !e.sprite?.active || e.health <= 0 || S._phasedOut?.(e) || !S.isInCurrentRoom(e.x, e.y)) continue;
                        const a = inLine(e); if (a < 0 || a > d + 0.3) continue;
                        hitAt.add(e); if (Trident.hit(S, e, sd, 0) && e.sprite?.active) { Trident.burst(S, e.sprite.x, e.sprite.y - 6, last ? 1.4 : 1); Trident.jolt(S, e, last ? 5 : 3); }
                    }
                    if (last) {   // the great spike at the end: a heavier hit, a flash, a shake, a deeper crack
                        Trident.nova(S, x, y - 8, 1.3); S._vfxFlash?.(x, y - 16, 34, 0xd8fff4, 200, 0.55);
                        S.cameras.main.shake(120, 0.008); Sfx.play(S, 'slam'); Sfx.play(S, 'shatter');
                        RF.shard.emitParticleAt(x, y - 20, 6); F.dir = [-90, 120]; F.chunk.emitParticleAt(x, y - 4, 4); F.dir = null;
                    } else if (i % 3 === 1) S.cameras.main.shake(40, 0.002);
                });
            }
            Trident.tiles(S, cells, sd);
        });
    }
    // A piece of the thrust's spine (kind spine, tip or spur) bursting up out of the floor at (x, y), its foot there: it rises
    // (typed, the white flash as it's up), chips and a crack of light off its foot; stands its life (ms); cracks, breaks to a stump
    // (the spur just breaks), pieces flung, the stump melting away
    static vertebra(S, x, y, kind, k, life, flip = Math.random() < 0.5) {
        const RF = Rimeguard.fx(S), F = Trident.fx(S), last = kind === 'tip';
        const p = S.add.sprite(x, y, 'fx_trident', kind + '_0').setOrigin(0.5, 0.92).setScale(k).setFlipX(flip).setDepth(3.05 + y * 1e-5);
        p.play('tri_' + kind + '_up');
        const sh = S.add.image(x, y + 1, 'vfx_shadow').setTint(0x1a3a7a).setScale(0.32 * k, 0.16 * k).setAlpha(0.4).setDepth(0.94);
        S.add.sprite(x, y - 2, 'fx_rimeguard', 'slam_0').setScale((kind === 'spur' ? 0.3 : 0.5) * k).setBlendMode(Phaser.BlendModes.ADD).setDepth(3.04).play('rg_slam').once('animationcomplete', function () { this.destroy(); });
        if (kind !== 'spur') { RF.shard.emitParticleAt(x, y - 8 * k, last ? 4 : 2); F.dir = [-90, 140]; F.chunk.emitParticleAt(x, y - 2, last ? 3 : 1); F.dir = null; }
        S.time.delayedCall(Math.max(120, life), () => {
            if (!p.active) return;
            p.anims.stop(); p.setFrame(kind === 'spur' ? 'spur_3' : kind + '_4');
            S.time.delayedCall(70, () => {
                if (!p.active) return;
                RF.dir = [-90, 160]; RF.shard.emitParticleAt(x, y - 10 * k, kind === 'spur' ? 1 : last ? 6 : 3); RF.dir = null;
                if (kind === 'spur') { p.destroy(); sh.destroy(); return; }
                F.dir = [-90, 150]; F.chunk.emitParticleAt(x, y - 6 * k, last ? 4 : 2); F.dir = null;
                p.setFrame(kind + '_5');
                S.tweens.add({ targets: [p, sh], alpha: 0, delay: 250, duration: 350, onComplete: () => { p.destroy(); sh.destroy(); } });
            });
        });
    }
    // 2. The swipe: the tines swept round in front of you over SWEEP_MS, everything within SWIPE_R tiles and SWIPE_ARC° either side
    // of the aim takes SWIPE_DMG and MARK_SWIPE Rime marks; enemy shots in the arc are knocked out of the air. A crescent of ice
    // freezes where it was swung, hangs, and (AFTER_SWIPE after the sweep) SHATTERS outward: SHATTER_DMG to everything in the arc
    // out to SHATTER_R tiles past it, chips left lying on the floor
    static swipe(S, aim) {
        const C = Trident.CFG, T = S.TILE_SIZE, now = S.time.now, F = Trident.fx(S), ARC = C.SWIPE_ARC * Math.PI / 180, pc = Trident.pace(S);
        Sfx.play(S, 'swing'); Sfx.play(S, 'w_boreal_trident');   // (not 'whoosh': a transition's slow rush, it came in after the swing)
        const dmg = C.SWIPE_DMG * (S.damageScaling || 1), chill = S._chillCfg().DIRECT * C.HIT_CHILL, ox = S.playerX, oy = S.playerY;
        const inArc = (e, r) => { const dx = e.x - ox, dy = e.y - oy, d = Math.hypot(dx, dy); return d >= 0.4 && d <= r + 0.3 && Math.abs(Phaser.Math.Angle.Wrap(Math.atan2(dy, dx) - aim)) <= ARC && Trident.clear(S, ox, oy, e.x, e.y); };   // (never through a wall)
        const open = (x, y) => { const tx = Math.floor(x / T), ty = Math.floor(y / T); return S.world[tx]?.[ty] === S.FLOOR && Trident.clear(S, ox, oy, tx, ty); };   // (a spot of its look: in sight of you)
        let struck = 0;
        for (const e of [...(S.enemies || [])]) {
            if (!e.sprite?.active || e.health <= 0 || S._phasedOut?.(e) || !S.isInCurrentRoom(e.x, e.y) || !inArc(e, C.SWIPE_R)) continue;
            if (Trident.strike(S, e, dmg, chill, Math.atan2(e.y - oy, e.x - ox), 0.8)) { struck++; Trident.mark(S, e, C.MARK_SWIPE); Trident.daze(S, e, C.HIT_DAZE); if (e.sprite?.active) S._vfxFlash?.(e.sprite.x, e.sprite.y - 6, 18, 0xffffff, 120, 0.5); }
        }
        const cells = [];
        for (let da = -2; da <= 2; da++) for (let d = 1; d <= C.SWIPE_R; d++) { const a = aim + da * Math.PI / 4, x = Math.round(ox + Math.cos(a) * d), y = Math.round(oy + Math.sin(a) * d); if (S.world[x]?.[y] === S.FLOOR && Trident.clear(S, ox, oy, x, y)) cells.push([x, y]); }
        if (Trident.tiles(S, cells, dmg)) struck++;
        const st1 = Trident.st(S); if (st1.comboHits) st1.comboHits[1] = struck > 0;
        if (struck) { Glaive.hitstop(S, C.HIT_STOP); Trident.gain(S, struck, 1); }
        Trident.parry(S, ox * T + T / 2, oy * T + T / 2, aim, ARC, (C.SWIPE_R + 0.5) * T);
        // the look: the swing throws a sheet of seawater through the whole fan (sheet: one body of water, a foam crest at the reach,
        // a foam front at the tines, drops flung off it), one piece on you while it's swung (it moves with you); the trident carried
        // through it over SWEEP_MS (thirty-two ways, a streak behind it), always the same way round. As it ends, the frost chases
        // out through it from you (where it is then) to its crest, freezing it as it hangs, the crest a crisp rim of ice shards; and
        // AFTER_SWIPE after the sweep it EXPLODES: a flash, bursts of ice all along the arc, chunks and shards blasted out past its
        // edge, a crack and a boom, a shake, a hitstop on hits; rime left on the floor along the arc (only the look: no Frostbite)
        const hx = S._shotX(), hy = S._shotY(), side = 1, K = C.SWIPE_SCALE;
        const sweep = C.SWEEP_MS * pc, rr = C.SWIPE_R * T * 0.95, mid = 20 * K;   // (mid: the trident's middle, out from your hand)
        S._scytheSpinUntil = now + sweep + 80;
        const spr = S.add.sprite(hx, hy, 'fx_trident', 'tri_e').setScale(K).setDepth(3.2);
        const water = S.add.container(hx, hy).setDepth(0.97), foam = S.add.container(hx, hy).setDepth(0.98), sea = [], shards = [];
        let was = aim - side * ARC;   // (the sheet laid from the swing's very start to its very end, however few frames it gets)
        Sfx.play(S, 'splash', { soft: true });
        S.tweens.addCounter({ from: 0, to: 1, duration: sweep, ease: 'Linear',
            onUpdate: tw => {
                const v = tw.getValue(), a = aim + side * (-ARC + 2 * ARC * v), x = S._shotX(), y = S._shotY();
                water.setPosition(x, y); foam.setPosition(x, y);
                Trident.streak(S, spr);
                Trident.face(spr, a).setPosition(x + Math.cos(a) * mid, y + Math.sin(a) * mid);
                Trident.sheet(S, sea, was, a, water, foam, side, 14, rr); was = a;
            },
            onComplete: () => {
                Trident.sheet(S, sea, was, aim + side * ARC, water, foam, side, 14, rr); was = aim + side * ARC;
                S.tweens.add({ targets: spr, alpha: 0, duration: 120, delay: 40, onComplete: () => spr.destroy() });
            } });
        S.cameras.main.shake(70, 0.0025);
        S.time.delayedCall(sweep, () => {   // the frost chasing out through it from you, to its crest, over SWIPE_FREEZE
            if (!S.sys?.isActive()) return;
            const bx = water.x, by = water.y, TC = C.SWIPE_FREEZE * pc;
            Trident.chase(S, sea, bx, by, t => (rr + 14) * t / TC, rr + 14, r => [0, 1, 2].map(() => { const a = aim - ARC + Math.random() * 2 * ARC; return [bx + Math.cos(a) * r, by + Math.sin(a) * r]; }));
            S.time.delayedCall(TC * 0.95, () => {   // the crest frozen into a crisp rim of ice shards along the reach
                if (!S.sys?.isActive()) return;
                for (let i = 0; i <= 20; i++) { const a = aim - ARC + 2 * ARC * i / 20, [f, fx, fy] = Trident.dir(a); if (!open(bx + Math.cos(a) * rr * 1.08, by + Math.sin(a) * rr * 1.08 + 6)) continue; shards.push({ sh: S.add.image(bx + Math.cos(a) * rr * 1.08, by + Math.sin(a) * rr * 1.08, 'fx_trident', 'cres_' + f).setFlip(!!fx, !!fy).setScale(1.3).setDepth(3.28), a }); }
            });
        });
        // the aftershock: the frozen sheet EXPLODES outward
        S.time.delayedCall(sweep + C.AFTER_SWIPE * pc, () => {
            const done = () => S.time.delayedCall(700, () => { water.destroy(); foam.destroy(); });
            if (!S.sys?.isActive()) { shards.forEach(s => s.sh.destroy()); sea.forEach(w => w.destroy()); return done(); }
            const sd = C.SHATTER_DMG * (S.damageScaling || 1), bx = water.x, by = water.y, RF = Rimeguard.fx(S);
            let hits = 0;
            for (const e of [...(S.enemies || [])]) {
                if (!e.sprite?.active || e.health <= 0 || S._phasedOut?.(e) || !S.isInCurrentRoom(e.x, e.y) || !inArc(e, C.SWIPE_R + C.SHATTER_R)) continue;
                if (Trident.hit(S, e, sd, 0) && e.sprite?.active) { hits++; Trident.burst(S, e.sprite.x, e.sprite.y - 6, 0.8); Trident.jolt(S, e, 3); }
            }
            if (Trident.tiles(S, cells, sd)) hits++;
            if (hits) Glaive.hitstop(S, 60);
            S._vfxFlash?.(bx + Math.cos(aim) * rr * 0.55, by + Math.sin(aim) * rr * 0.55, rr * 1.3, 0xe8fbff, 240, 0.7);
            for (let i = 0; i < 9; i++) { const a = aim - ARC * 0.88 + 1.76 * ARC * i / 8; if (open(bx + Math.cos(a) * rr * 0.68, by + Math.sin(a) * rr * 0.68 + 6)) Trident.boom(S, bx + Math.cos(a) * rr * 0.68, by + Math.sin(a) * rr * 0.68, 1.15, null); }
            Sfx.play(S, 'shatter', { soft: true });   // (a crack: the boom comes with the giant spine at the end of the rime)
            for (let i = 0; i < 6; i++) { const a = aim - ARC + 2 * ARC * (i + Math.random()) / 6, r = rr * (0.55 + Math.random() * 0.4); if (open(bx + Math.cos(a) * r, by + Math.sin(a) * r + 6)) Rimeguard.spike(S, bx + Math.cos(a) * r, by + Math.sin(a) * r + 6, 1 + Math.random() * 0.5, 20 * i, true); }
            Trident.ring(S, bx, by + 4, rr / 22 * 0.85, 0);
            S.cameras.main.shake(160, 0.01);
            for (const w of sea) Trident.fling(S, w, bx, by, C.SHATTER_R * T * 1.4, false, 190);
            for (const { sh, a } of shards) {   // the rim, blasted out past the fan's edge
                if (!sh.active) continue;
                RF.dir = [a * 180 / Math.PI, 30]; RF.shard.emitParticleAt(sh.x, sh.y, 2); RF.dir = null;
                S.tweens.add({ targets: sh, x: sh.x + Math.cos(a) * C.SHATTER_R * T * 1.4, y: sh.y + Math.sin(a) * C.SHATTER_R * T * 1.4, alpha: 0, duration: 180, ease: 'Quad.easeOut', onComplete: () => sh.destroy() });
            }
            for (let i = 0; i < 8; i++) {   // and eight big shards thrown out past it, landing, gone within a second
                const a = aim - ARC + 2 * ARC * (i + 0.2 + Math.random() * 0.6) / 8, fx0 = bx + Math.cos(a) * rr, fy0 = by + Math.sin(a) * rr;
                if (!open(fx0, fy0 + 6)) continue;
                const ex = fx0 + Math.cos(a) * T * (1 + Math.random() * 1.2), ey = fy0 + Math.sin(a) * T * (1 + Math.random() * 1.2) + 6;
                const c = S.add.image(fx0, fy0, 'fx_rimeguard', 'shard_' + Math.floor(Math.random() * 3)).setScale(1.6 + Math.random() * 0.5).setFlipX(Math.random() < 0.5).setDepth(3.29);
                S.tweens.add({ targets: c, x: ex, duration: 240, ease: 'Quad.easeOut' }); S.tweens.add({ targets: c, y: { value: ey, ease: p => p * p * 1.3 - 0.3 * p }, duration: 240, onComplete: () => { c.setDepth(0.95); S.tweens.add({ targets: c, alpha: 0, delay: 450, duration: 300, onComplete: () => c.destroy() }); } });
            }
            // rime left on the floor along the arc (only its look: no iced tiles, no Frostbite)
            const tx0 = Math.floor(bx / T), ty0 = Math.floor(by / T), st = Trident.st(S); st.seed = (st.seed || 0) + 1;
            for (let dx = -C.SWIPE_R; dx <= C.SWIPE_R; dx++) for (let dy = -C.SWIPE_R; dy <= C.SWIPE_R; dy++) {
                const d = Math.hypot(dx, dy), x = tx0 + dx, y = ty0 + dy;
                if (d < 0.8 || d > C.SWIPE_R + 0.3 || Math.abs(Phaser.Math.Angle.Wrap(Math.atan2(dy, dx) - aim)) > ARC || S.world[x]?.[y] !== S.FLOOR || !Trident.clear(S, tx0, ty0, x, y)) continue;
                S.time.delayedCall(C.SWIPE_SPREAD * pc * d / C.SWIPE_R, () => S.sys?.isActive() && Trident.rimeTile(S, x, y, C.RIME_FAST, Math.max(0.2, 0.9 - 0.2 * Math.abs(d - C.SWIPE_R * 0.7))));
            }
            for (let k = 1; k <= 4; k++) S.time.delayedCall(C.SWIPE_SPREAD * pc * k / 4, () => {   // (its front, crystals bursting up as it spreads)
                if (!S.sys?.isActive()) return;
                for (let i = 0; i < 2 + k; i++) { const a = aim - ARC + 2 * ARC * Math.random(), r = rr * k / 4; if (open(bx + Math.cos(a) * r, by + Math.sin(a) * r + 6)) Rimeguard.spike(S, bx + Math.cos(a) * r, by + Math.sin(a) * r + 6, 0.7 + 0.15 * k, 0, true); }
            });
            S.time.delayedCall(C.SWIPE_SPREAD * pc, () => {   // and it ends in a ROW of great spines along the fan's edge (only the look: no hits)
                if (!S.sys?.isActive()) return;
                // five across it, the middle one (down the aim) the biggest and with the boom, the rest rippling out from it within
                // SPINE_ROW_MS, a little smaller toward the tips; each short of a wall
                const n = C.SPINE_ROW;
                for (let i = 0; i < n; i++) {
                    const u = i / (n - 1) * 2 - 1, a = aim + u * ARC * 0.9 + (Math.random() - 0.5) * 0.12, mid = i === (n - 1) / 2, k = mid ? 1.7 : 1.7 * (0.85 - 0.15 * Math.abs(u)) * (0.95 + Math.random() * 0.1);
                    S.time.delayedCall(C.SPINE_ROW_MS * Math.abs(u), () => {
                        if (!S.sys?.isActive()) return;
                        let r = rr * (1.02 + (Math.random() - 0.5) * 0.08), gx2 = bx + Math.cos(a) * r, gy2 = by + Math.sin(a) * r;
                        for (; r > T && !open(gx2, gy2 + 6); r -= T / 2) { gx2 = bx + Math.cos(a) * r; gy2 = by + Math.sin(a) * r; }
                        if (!open(gx2, gy2 + 6)) return;
                        Trident.vertebra(S, gx2, gy2 + 6, 'tip', k, 700 - 40 * Math.abs(u));
                        if (mid) {   // the middle one: its flank spines, the flash, the boom
                            for (const sd of [-1, 1]) Trident.vertebra(S, gx2 - Math.sin(aim) * sd * T * 0.7, gy2 + Math.cos(aim) * sd * T * 0.7 + 6, 'spine', 1.2, 620, sd < 0);
                            Trident.nova(S, gx2, gy2 - 8, 1.3); S._vfxFlash?.(gx2, gy2 - 16, 34, 0xd8fff4, 200, 0.55);
                            S.cameras.main.shake(120, 0.008); Sfx.play(S, 'slam'); Sfx.play(S, 'shatter');   // (the boom: the same as the thrust's spine and the slam's eruption)
                        } else Trident.nova(S, gx2, gy2 - 6, 0.8);
                    });
                }
            });
            done();
        });
    }
    // 3. The leap: up into the air, the trident raised over you; steered with the movement keys (air), down with a click or at LEAP_MS
    static leap(S, aim) {
        const C = Trident.CFG, st = Trident.st(S), T = S.TILE_SIZE, now = S.time.now, p = S.player, F = Trident.fx(S);
        S._glide = null; S.tweens.killTweensOf(p); S._step = null;
        const fx = p.x, fy = p.y - (S.SLIME_Y_OFFSET || 0);   // (from where you are: a step's glide may still be on its way to your tile)
        S._glideUntil = now + C.LEAP_MS + 100;   // (no steps: you're in the air)
        S._dashInvulnUntil = Math.max(S._dashInvulnUntil || 0, now + C.LEAP_UP);   // (the take-off)
        S._scytheSpinUntil = now + C.LEAP_MS + 400;
        Sfx.play(S, 'dash', { el: 'ice' }); Sfx.play(S, 'whoosh', { soft: true });
        const raised = S.add.sprite(p.x, p.y - 30, 'fx_trident', 'tri_s').setFlipY(true).setScale(C.SCALE).setDepth(3.25);   // (tip up, over your head)
        const glow = S.add.image(p.x, p.y - 44, 'vfx_glow').setTint(0x9fe4ff).setBlendMode(Phaser.BlendModes.ADD).setScale(0.3).setAlpha(0.45).setDepth(3.24);
        const shadow = S.add.image(fx, fy + 8, 'vfx_shadow').setDepth(0.95).setAlpha(0.5);
        const mark = S.add.sprite(fx, fy, 'fx_trident', 'mark_0').setScale(T / 12).setBlendMode(Phaser.BlendModes.ADD).setDepth(0.96).setAlpha(0.6);
        const foot = Trident.FOOT.map(() => S.add.image(0, 0, 'fx_trident', 'lane_0').setScale(T / 12).setDepth(0.95).setAlpha(0));   // (the slam's footprint under you, tile by tile)
        st.leap = { t0: now, fx, fy, aim, raised, glow, shadow, mark, foot, land: false, drop: 0, z: 0, z0: 0, tile: [S.playerX, S.playerY], tailAt: 0 };
        S.lockActions?.('trident_leap', ['dash', 'ult', 'gadget', 'swap']); st.locked = true;
        st.leap.zoom0 = S.cameras.main.zoom; st.leap.pace = Trident.pace(S);   // (a Frost Rush runs the whole leap faster)
        st.leap.room = (S.rooms || []).find(R => S.playerX >= R.x && S.playerX < R.x + R.w && S.playerY >= R.y && S.playerY < R.y + R.h) || null;
        st.leap.hx = Math.cos(aim); st.leap.hy = Math.sin(aim);   // (in the air: no dashes, ults, gadgets or swaps; tick lets go the moment it's over)
        // the launch: frost blasting off the floor where you left it
        Trident.nova(S, fx, fy + 4, 1); Trident.ring(S, fx, fy, 1.1);
        Trident.mist(S, fx, fy + 6, 4, T * 1.2);
        F.dir = [-90, 140]; F.chunk.emitParticleAt(fx, fy + 4, 4); F.spark.emitParticleAt(fx, fy, 6); F.dir = null;
    }
    // A frame in the air: the keys steer you (each way on its own, so you slide along the edge; a box round you that only takes in
    // tiles you may fly over: flyable), climbing toward LEAP_H; a click or LEAP_MS brings you down (FALL_MS) to the slam, on landAt
    static air(S, time) {
        const st = S._tri, L = st?.leap;
        if (!L) return;
        const C = Trident.CFG, T = S.TILE_SIZE, p = S.player, off = S.SLIME_Y_OFFSET || 0;
        if (!p?.active || S._deathScreenActive) { Trident.unleap(S); return; }
        if (S.playerX !== L.tile[0] || S.playerY !== L.tile[1]) { L.fx = S.playerX * T + T / 2; L.fy = S.playerY * T + T / 2; L.tile = [S.playerX, S.playerY]; }   // (something else moved you)
        const dt = Math.min(50, S.game.loop.delta || 16) / 1000, K = S.keys || {};
        const gx = (K.D?.isDown ? 1 : 0) - (K.A?.isDown ? 1 : 0), gy = (K.S?.isDown ? 1 : 0) - (K.W?.isDown ? 1 : 0);
        const open = (x, y) => Trident.flyable(S, L, Math.floor(x / T), Math.floor(y / T)), R = T * 0.3;
        if (gx || gy) {
            const n = Math.hypot(gx, gy), v = C.LEAP_SPEED * T * dt, nx = L.fx + gx / n * v, ny = L.fy + gy / n * v;
            if (gx && open(nx + Math.sign(gx) * R, L.fy - R) && open(nx + Math.sign(gx) * R, L.fy + R)) L.fx = nx;
            if (gy && open(L.fx - R, ny + Math.sign(gy) * R) && open(L.fx + R, ny + Math.sign(gy) * R)) L.fy = ny;
            const tx = Math.floor(L.fx / T), ty = Math.floor(L.fy / T);
            L.hx = gx / n; L.hy = gy / n;
            if ((tx !== S.playerX || ty !== S.playerY) && S._dashCanEnter(tx, ty) && !S.getEnemyAt(tx, ty)) { S.playerX = tx; S.playerY = ty; L.tile = [tx, ty]; S._checkRoomNameDisplay?.(); }   // (over an enemy you're still where you were)
        }
        const u = (time - L.t0) / (L.pace || 1);   // (the leap's own time: a Frost Rush runs it faster, the same climb)
        if (!L.drop && (u >= C.LEAP_MS - C.FALL_MS || (L.land && u >= C.LAND_MIN - C.FALL_MS))) { L.drop = time; L.z0 = L.z; Sfx.play(S, 'whoosh'); }
        if (L.drop) {   // the dive: down in a few frames, faster and faster, the orb's water pouring down the trident ahead of you
            const k = Math.min(1, (time - L.drop) / C.FALL_MS);
            L.z = L.z0 * (1 - k * k) + 4 * Math.max(0, Math.sin(Math.PI * Math.min(1, k * 3))) * (1 - k);   // (a hitch at the top, then down)
            if (k >= 1) { p.setPosition(L.fx, L.fy + off); Trident.slam(S); return; }
        } else L.z = C.LEAP_H * (1 - Math.exp(-u / C.LEAP_TAU));   // (climbing all the way, slower and slower)
        p.setPosition(L.fx, L.fy + off - L.z);
        L.raised.setPosition(p.x, p.y - 30); L.glow.setPosition(p.x, p.y - 44).setAlpha(0.35 + 0.15 * Math.sin(time * 0.02));
        const h = L.z / C.LEAP_H, cam = S.cameras.main;
        L.shadow.setPosition(L.fx, L.fy + 8).setScale(0.9 - 0.45 * h, 0.6 - 0.28 * h).setAlpha(0.6 - 0.35 * h);   // (your shadow on the floor, smaller and fainter the higher you are)
        if (L.zoom0) cam.setZoom(L.zoom0 * (1 - 0.05 * h));   // (the camera drawing back a touch with the height)
        const [mx, my] = Trident.landAt(S, L);   // (over a wall: the floor you'll come down on)
        const hn = Trident.height(L.z0 && L.drop ? L.z0 : L.z);
        L.mark.setPosition(mx * T + T / 2, my * T + T / 2).setFrame(hn > 0.55 ? 'mark_1' : 'mark_0').setScale(T / 12 * (0.75 + 0.45 * Math.min(1.2, hn))).setAlpha(0.55 + 0.4 * Math.min(1, hn));   // (the slam charging as you climb)
        const fp = Trident.footprint(S, mx, my);
        L.foot.forEach((im, i) => { const [dx, dy] = Trident.FOOT[i], x = mx + dx, y = my + dy, on = fp.has(x + ',' + y); im.setVisible(on).setPosition(x * T + T / 2, y * T + T / 2).setAlpha(on ? 0.16 + 0.06 * Math.sin(time * 0.012 - Math.abs(dx) - Math.abs(dy)) : 0); });
    }
    // A tile the leap may fly over: inside the room you leapt in (walls, pillars and all; no void, no locked or sealed tiles), or
    // out of any room (a corridor), only tiles you could walk onto
    static flyable(S, L, tx, ty) {
        if (S.isInLockedRoom?.(tx, ty) || (S._roomGated?.() && S.lockedDoorTiles?.some(t => t.x === tx && t.y === ty))) return false;
        const R = L.room;
        if (!R) return S._dashCanEnter(tx, ty);
        return tx >= R.x && tx < R.x + R.w && ty >= R.y && ty < R.y + R.h && (S.world[tx]?.[ty] ?? S.NOTHING) !== S.NOTHING;
    }
    // Where the leap comes down from where it is now: that tile, or (over a wall, or an enemy) the nearest you could stand on,
    // found by spreading out over what it could fly over, the way you were heading first
    static landAt(S, L) {
        const T = S.TILE_SIZE, x0 = Math.floor(L.fx / T), y0 = Math.floor(L.fy / T), ok = (x, y) => S._dashCanEnter(x, y) && !S.getEnemyAt(x, y) && (!L.room || Trident.flyable(S, L, x, y));
        if (ok(x0, y0)) return [x0, y0];
        const D4 = [[1, 0], [-1, 0], [0, 1], [0, -1]].sort((p, q) => (q[0] * L.hx + q[1] * L.hy) - (p[0] * L.hx + p[1] * L.hy));
        const q = [[x0, y0, 0]], seen = new Set([x0 + ',' + y0]);
        for (let h = 0; h < q.length; h++) {
            const [x, y, d] = q[h];
            if (d >= 8) break;
            for (const [ax, ay] of D4) {
                const nx = x + ax, ny = y + ay, k = nx + ',' + ny;
                if (seen.has(k) || !Trident.flyable(S, L, nx, ny) && !ok(nx, ny)) continue;
                seen.add(k);
                if (ok(nx, ny)) return [nx, ny];
                q.push([nx, ny, d + 1]);
            }
        }
        return L.tile;
    }
    // The leap's water: while you climb, a SPHERE OF AGGRESSIVE WATER churning at the trident's tines, bigger and spinning faster the
    // higher you are: a deep dark core, bands of water racing round it each its own way (the far side dimmer, behind), a foam rim
    // whipping round its edge, spray flung off it, seawater spiralling up round you into it. On the dive it BURSTS and pours down the
    // shaft to the ground, arriving as you land (its pieces into L.pool, so the slam's ring and freeze take them on)
    static orb(S, L, p, time, hn, mx, my) {
        const T = S.TILE_SIZE, O = L.orb ||= { w: [], rim: [], feedAt: 0 }, h = Math.min(1.2, Math.max(0, hn)), cx = p.x, cy = p.y - 50, R = 5 + 10 * h;
        if (L.drop) {
            if (O.burst) return;
            O.burst = true; L.pool ||= [];   // (it bursts, and pours down)
            const gx = mx * T + T / 2, gy = my * T + T / 2 + 4, ms = Math.max(40, Trident.CFG.FALL_MS * (L.pace || 1) - (time - L.drop));
            for (const w of [...O.w, ...O.rim, O.core]) {
                if (!w?.active) continue;
                L.pool.push(w); S.tweens.killTweensOf(w); w.setDepth(3.3);
                S.tweens.add({ targets: w, x: gx + (Math.random() - 0.5) * 12, y: gy + (Math.random() - 0.5) * 8, duration: ms * (0.7 + Math.random() * 0.3), ease: 'Quad.easeIn' });
            }
            for (let i = 0; i < 8; i++) Trident.drop(S, L.pool, cx + (Math.random() - 0.5) * R * 2, cy, (Math.random() - 0.5) * 100, -40 - Math.random() * 70, 3.3);   // (spray off the burst)
            S._vfxFlash?.(cx, cy, 20 + R, 0xbfefff, 120, 0.35);
            return;
        }
        const dt = Math.min(50, S.game.loop.delta || 16), spin = 0.006 + 0.012 * h;
        if (!O.core) { O.core = Trident.water(S, cx, cy, 1.4, 3.29, 'd'); S.tweens.add({ targets: O.core, alpha: 0.95, duration: 120 }); }
        O.core.setPosition(cx, cy).setScale(1.1 + 1.3 * h);
        const want = Math.round(6 + 14 * h);
        while (O.w.length < want) { const i = O.w.length, w = Trident.water(S, cx, cy, 0.9 + Math.random() * 0.4, 3.3); w._th = Math.random() * Math.PI * 2; w._ph = [-0.55, 0, 0.55][i % 3] + (Math.random() - 0.5) * 0.3; w._dir = [1, -1, 1.3][i % 3]; S.tweens.add({ targets: w, alpha: 0.9, duration: 120 }); O.w.push(w); }
        while (O.rim.length < 12) { const c = Trident.crest(S, cx, cy, 0, O.rim.length, 3.32); c._a = O.rim.length / 12 * Math.PI * 2; O.rim.push(c); }
        for (const w of O.w) {   // (bands racing round it, each its own way; the far side behind and dimmer)
            w._th += dt * spin * w._dir;
            const cp = Math.cos(w._ph), front = Math.sin(w._th) > 0;
            w.setPosition(cx + R * cp * Math.cos(w._th), cy + R * Math.sin(w._ph) * 0.8 + R * cp * Math.sin(w._th) * 0.3).setDepth(front ? 3.31 : 3.28).setAlpha(front ? 0.92 : 0.55);
        }
        for (const c of O.rim) { c._a += dt * spin * 1.4; c.setPosition(cx + Math.cos(c._a) * (R + 2), cy + Math.sin(c._a) * (R + 2) * 0.9).setScale(0.75 + 0.45 * h); }
        if (Math.random() < 0.2 + 0.4 * h) { const a = Math.random() * Math.PI * 2, v = 70 + 60 * h; Trident.drop(S, [], cx + Math.cos(a) * (R + 2), cy + Math.sin(a) * (R + 2) * 0.9, -Math.sin(a) * v + Math.cos(a) * 30, Math.cos(a) * v * 0.9 + Math.sin(a) * 30 - 30, 3.32); }   // (spray flung off it as it spins)
        if (time >= O.feedAt) {   // (seawater spiralling up round you into it)
            O.feedAt = time + 70;
            const w = Trident.water(S, cx, p.y + 4, 0.9 + Math.random() * 0.3, 3.29), a0 = Math.random() * Math.PI * 2, q = { u: 0 };
            S.tweens.add({ targets: w, alpha: 0.85, duration: 60 });
            S.tweens.add({ targets: q, u: 1, duration: 280, onUpdate: () => { if (!w.active || !L.orb) return; const a = a0 + q.u * 7, r = 12 * (1 - q.u) + R * 0.5; w.setPosition(p.x + Math.cos(a) * r, p.y + 4 + (cy - p.y - 4) * q.u + Math.sin(a) * r * 0.3); }, onComplete: () => w.destroy() });
        }
    }
    static unleap(S) {
        const L = S._tri?.leap;
        if (!L) return;
        S._tri.leap = null;
        if (S._tri.locked) { S._tri.locked = false; S.unlockActions?.('trident_leap'); }
        if (L.zoom0) S.cameras.main.setZoom(L.zoom0);
        L.raised.destroy(); L.glow.destroy(); L.shadow.destroy(); L.mark.destroy(); L.foot.forEach(im => im.destroy()); (L.pool || []).forEach(w => w.destroy());
        for (const w of [...(L.orb?.w || []), ...(L.orb?.rim || []), L.orb?.core]) w?.destroy();
        S._glideUntil = S.time.now;
    }
    // The slam where you come down: everything in a squircle SLAM_R tiles out takes SLAM_DMG and Frostbite; a crash of seawater over it,
    // frozen and blown up into the rime (erupt)
    static slam(S) {
        const C = Trident.CFG, st = S._tri, L = st.leap, T = S.TILE_SIZE, now = S.time.now, F = Trident.fx(S), p = S.player, off = S.SLIME_Y_OFFSET || 0;
        const spr = L.raised; L.raised = null;
        L.glow.destroy(); L.shadow.destroy(); L.mark.destroy(); L.foot.forEach(im => im.destroy()); st.leap = null;
        if (st.locked) { st.locked = false; S.unlockActions?.('trident_leap'); }
        const [tx, ty] = Trident.landAt(S, L), cx = tx * T + T / 2, cy = ty * T + T / 2;
        S.playerX = tx; S.playerY = ty; S._step = null; S.lastMoveTime = now; S._glideUntil = now;
        p.setPosition(cx, cy + off);
        st.at = now; st.cd = C.SLAM_CD; st.seed = (st.seed || 0) + 1;
        S._checkRoomNameDisplay?.(); S._onPlayerStepWater?.(tx, ty, now);
        if (S.isLevel4) S._onPlayerStepCrumble?.(tx, ty);
        const foot = Trident.footprint(S, tx, ty), hn = Trident.height(L.z0 || L.z), mult = 1 + C.HEIGHT_K * Math.max(0, hn), dmg = C.SLAM_DMG * mult * (S.damageScaling || 1);   // (the higher you came down from, the harder)
        let struck = 0;
        for (const e of [...(S.enemies || [])]) {
            if (!e.sprite?.active || e.health <= 0 || S._phasedOut?.(e) || !S.isInCurrentRoom(e.x, e.y)) continue;
            if (!foot.has(e.x + ',' + e.y)) continue;
            const r = Trident.hit(S, e, dmg, 0);
            if (!r) continue;
            struck++;
            if (r === true) { Trident.bite(S, e, C.BITE_MS * (1 + Trident.perk('tide'))); Trident.burst(S, e.sprite.x, e.sprite.y - 4, 1.1); }   // (Glacial Tide: twice as long)
        }
        const cells = [];
        for (const kk of foot) cells.push(kk.split(',').map(Number));
        if (Trident.tiles(S, cells, dmg)) struck++;
        if (struck) Trident.gain(S, struck, 2);
        Glaive.hitstop(S, C.SLAM_STOP + 10 * Math.min(4, struck));
        const cam = S.cameras.main, z0 = L.zoom0 || cam.zoom;
        cam.shake(200, 0.016);
        cam.setZoom(z0 * 1.07); S.tweens.add({ targets: cam, zoom: z0, duration: 170, ease: 'Quad.easeOut' });   // (a punch in, back out)
        S._vfxFlash?.(cx, cy - 4, 70, 0xffffff, 200, 0.7);
        Sfx.play(S, 'slam', { small: true });   // (a deep thud, the water's crash with it: the boom is the eruption's)
        for (const e of S.enemies || []) if (e.sprite?.active && foot.has(e.x + ',' + e.y)) Trident.jolt(S, e, 5);
        // the trident driven down tines first at your feet, standing a beat
        if (spr?.active) {
            spr.setFlipY(false).setPosition(cx, cy - 34);
            S.tweens.add({ targets: spr, y: cy - 12, duration: 60, ease: 'Quad.easeIn', onComplete: () =>
                S.tweens.add({ targets: spr, alpha: 0, duration: 160, delay: 300, onComplete: () => spr.destroy() }) });
        }
        // the impact: a crash of seawater, a splash thrown up and a ring wave of it rolling out across the footprint over SLAM_WAVE
        // (surging, slowing as it gets to the edge), surf breaking at its front (only drawn: see water); SLAM_FROST after the landing
        // the frost chases it out from where you came down, faster, and catches its crest at the rim just as it gets there; at
        // AFTER_SLAM the frozen ring EXPLODES upward into the rime (erupt)
        const pc = Trident.pace(S), sea = (L.pool || []).filter(w => w.active), R1 = (C.SLAM_R + 0.4) * T, hk = Math.min(1.2, hn), TW = C.SLAM_WAVE * pc, TF = C.SLAM_FROST * pc, oy4 = cy + 4;
        Sfx.play(S, 'splash', { big: true });
        for (const f of ['e', 's']) Trident.once(S, cx, cy - 4, 'tri_spray_' + f, 2.6 + 0.6 * hk, 3.4, false);
        for (let i = 0; i < 14; i++) { const a = -Math.PI / 2 + (Math.random() - 0.5) * 2.6, v = 80 + Math.random() * 110; Trident.drop(S, sea, cx, cy - 6, Math.cos(a) * v, Math.sin(a) * v, 3.4); }
        const wave = t => 6 + (R1 - 6) * (1 - (1 - Math.min(1, t / TW)) ** 2), lob = Trident.wavy([0.04, 0.025], [7, 13]), far = R1 * 1.08;   // (round, small local lumps of its own)
        let laid = 6;
        const ring = [], nr = Math.round(2 * Math.PI * R1 * 0.93 / C.CREST_GAP);   // (the crest: a full ring of strips, CREST_GAP apart at the rim)
        for (let i = 0; i < nr; i++) { const a = (i + (Math.random() - 0.5) * 0.6) / nr * Math.PI * 2, c = Trident.crest(S, cx, oy4, a, i, 0.985); c._a = a; c._j = (Math.random() - 0.5) * 3; c.setVisible(false); ring.push(c); sea.push(c); }
        const k0 = Trident.clock(S), wt = S.time.addEvent({ delay: 16, loop: true, callback: () => {
            if (!S.sys?.isActive()) { wt.remove(); return; }
            const t = Trident.clock(S) - k0, r = wave(t);
            for (; laid <= r; laid += 9) {   // the water behind its front, washing on outward till the frost has it
                const n = Math.max(4, Math.round(2 * Math.PI * laid / 11));
                for (let i = 0; i < n; i++) {
                    const a = (i + Math.random()) / n * Math.PI * 2, L2 = laid * lob(a), x = cx + Math.cos(a) * L2, y = oy4 + Math.sin(a) * L2 * 0.85;
                        if (!foot.has(Math.floor(x / T) + ',' + Math.floor((y - 4) / T))) continue;   // (the footprint only: nothing past a wall)
                    const w = Trident.water(S, x, y, 1.5 + Math.random() * 0.5, 0.97);
                    S.tweens.add({ targets: w, alpha: 0.88, duration: 60 }); const cr = foot.has(Math.floor((x + Math.cos(a) * 13) / T) + ',' + Math.floor((y + Math.sin(a) * 11 - 4) / T)) ? 1 : 0;   // (its creep stays on the footprint)
                    S.tweens.add({ targets: w, x: x + Math.cos(a) * 13 * cr, y: y + Math.sin(a) * 11 * cr, scaleX: w.scaleX * (1.15 + 13 / Math.max(14, L2)), scaleY: w.scaleY * (1.15 + 13 / Math.max(14, L2)), duration: 1300, ease: 'Quad.easeOut' });   // (growing as it spreads)
                    sea.push(w);
                }
                const g = S.add.image(cx, oy4, 'vfx_glow').setTint(0x1a5aa6).setAlpha(0.2).setScale(0.5 + laid / 40).setDepth(0.965); g._kind = 'glow'; sea.push(g);
                for (let i = 0; i < 3; i++) { const a = Math.random() * Math.PI * 2, L2 = laid * lob(a); Trident.churnBody(S, sea, cx + Math.cos(a) * L2, oy4 + Math.sin(a) * L2 * 0.85, a, 0.97); }
            }
            for (const c of ring) if (!c._iced) { const rr = r * lob(c._a) + c._j, x = cx + Math.cos(c._a) * rr, y = oy4 + Math.sin(c._a) * rr * 0.85; c.setPosition(x, y).setVisible(foot.has(Math.floor(x / T) + ',' + Math.floor((y - 4) / T))); }   // its crest, riding the front
            if (t >= TW) wt.remove();
        } });
        S.time.delayedCall(TF, () => S.sys?.isActive() && Trident.chase(S, sea, cx, oy4, t => far * t / Math.max(1, TW - TF), far,
            r => [0, 1, 2, 3].map(() => { const a = Math.random() * Math.PI * 2; return [cx + Math.cos(a) * r, oy4 + Math.sin(a) * r * 0.85]; })));
        st.comboEnd = now;   // (the combo meter flashes, then empties)
        // a full combo whose thrust, swipe and slam each struck something: the Icicle Cannon's own Frost Shield (its 35% less damage, its
        // chill back, its bubble) for TRI_SHIELD_MS; never refreshed while it's up (whoever raised it), and not again for TRI_SHIELD_CD after it ends
        if (st.comboHits) st.comboHits[2] = struck > 0;
        if (st.comboHits?.every(h => h) && now >= (S._frostShieldUntil || 0) && now >= (st.shieldBack || 0)) {
            S._frostShieldUntil = now + C.TRI_SHIELD_MS; S._frostShieldMs = C.TRI_SHIELD_MS; st.shieldBack = now + C.TRI_SHIELD_MS + C.TRI_SHIELD_CD;
            S._frostShieldFx?.(); S.showStatusText?.(p.x, p.y - 30, 'FROST SHIELD', '#bff4ff'); Sfx.play(S, 'frost_shield');
        }
        S.time.delayedCall(C.AFTER_SLAM * pc, () => {
            if (!S.sys?.isActive()) return;
            for (const w of sea) Trident.fling(S, w, cx, oy4, T * 1.2, true, 220);
            Trident.erupt(S, tx, ty, cells, mult, hn);
        });
    }
    // The slam's aftershock: the RIME ERUPTS up across the footprint, crystals and spikes bursting out of the floor (melting away in a
    // moment: only the look), a second heavier impact, and the Rime marks SHATTER: ERUPT_DMG to everything in it, MARK_K more for each mark
    // on it, MARK_BITE more Frostbite and a frost (R) a mark; a burst of rime off each, bigger the more marks; the more shattered at
    // once, the bigger the flash, the sound and the hitstop
    static erupt(S, tx, ty, cells, mult = 1, hn = 1) {
        const foot = new Set(cells.map(([x, y]) => x + ',' + y)), C = Trident.CFG, T = S.TILE_SIZE, st = Trident.st(S), cx = tx * T + T / 2, cy = ty * T + T / 2, F = Trident.fx(S), RF = Rimeguard.fx(S);
        for (const [x, y] of cells) {
            if (S.world[x]?.[y] !== S.FLOOR || !Trident.clear(S, tx, ty, x, y)) continue;
            const d = Math.hypot(x - tx, y - ty);
            S.time.delayedCall(25 * d, () => S.sys?.isActive() && Trident.rimeTile(S, x, y, C.RIME_FAST, Math.max(0.15, 1 - d / 3.4)));
            if (Math.random() < 0.3 + 0.25 * Math.min(1, hn)) Rimeguard.spike(S, x * T + T / 2 + (Math.random() - 0.5) * T * 0.6, y * T + T / 2 + 6, (1.1 + Math.random() * 0.6) * (0.8 + 0.3 * Math.min(1.2, hn)), 22 * d, true);
        }
        const ds = S.damageScaling || 1;
        let shattered = 0;
        for (const e of [...(S.enemies || [])]) {
            if (!e.sprite?.active || e.health <= 0 || S._phasedOut?.(e) || !S.isInCurrentRoom(e.x, e.y) || !foot.has(e.x + ',' + e.y)) continue;
            const m = e._rmN || 0, ex = e.sprite.x, ey = e.sprite.y;
            Trident.unmark(S, e);
            const r = Trident.hit(S, e, C.ERUPT_DMG * mult * (1 + C.MARK_K * m) * ds, 0);
            if (!r) continue;
            Trident.jolt(S, e, 4 + m);
            if (r === true && m) Trident.bite(S, e, C.MARK_BITE * m);
            if (m) {
                shattered += m;
                S.add.sprite(ex, ey - 6, 'fx_rimeguard', 'slam_0').setScale(0.9 + 0.45 * m).setDepth(4.56).play('rg_slam').once('animationcomplete', function () { this.destroy(); });
                RF.dir = [-90, 200]; RF.shard.emitParticleAt(ex, ey - 8, 3 + 3 * m); RF.dir = null;
            }
        }
        Trident.tiles(S, cells, C.ERUPT_DMG * ds);
        if (shattered) { st.charges = Math.min(C.KIN_MAX, st.charges + shattered); }
        const big = Math.min(1, shattered / 9);
        Glaive.hitstop(S, 60 + 10 * Math.min(9, shattered));
        S.cameras.main.shake(150 + 80 * big, 0.01 + 0.008 * big);
        S._vfxFlash?.(cx, cy - 4, 60 + 40 * big, 0xd8fff4, 220, 0.4 + 0.3 * big);
        Sfx.play(S, 'slam'); Sfx.play(S, 'shatter');
        if (shattered >= 3) Sfx.play(S, 'shatter', { soft: true });
        if (shattered >= 6) Sfx.play(S, 'freeze');
        Trident.mist(S, cx, cy + 4, 8, C.SLAM_R * T);
        Trident.ring(S, cx, cy, (0.8 + 0.3 * Math.min(1.2, hn)) * (C.SLAM_R + 0.5) * T / 22, 0, false);
        F.dir = [-90, 200]; F.chunk.emitParticleAt(cx, cy, 10); F.dir = null; RF.shard.emitParticleAt(cx, cy - 4, 10);
    }
    // how high a leap came down from, 0 at the earliest landing to 1 at the full base airtime (above 1 if it climbed longer)
    static height(z) {
        const C = Trident.CFG, at = ms => C.LEAP_H * (1 - Math.exp(-(ms - C.FALL_MS) / C.LEAP_TAU)), lo = at(C.LAND_MIN), hi = at(C.LEAP_MS);
        return Math.max(0, (z - lo) / (hi - lo));
    }
    // e moved by force (the throw's catch and its drop): everything of its own that would move it, or leave it half way, let go of
    // cleanly: its tweens (a step, a swing's lunge and snap back home), its hop, the swing's flag (else it never swings again), its
    // scale, and the path it had committed to (a step from that path, after the move, is the snap back to where it was caught)
    // the Frostkin shell topped up to KIN_SHIELD of your max HP (never above), a little burst of it re-forming round you
    static feedShell(S) {
        const st = Trident.st(S), cap = Trident.CFG.KIN_SHIELD * (S.maxHealth || 100), was = st.shell?.hp || 0;
        st.shell = { hp: Math.max(was, cap), max: cap };
        const p = S.player;
        if (p && st.shell.hp > was) { Trident.once(S, p.x, p.y - 4, 'tri_glint', 2, 3.4); Rimeguard.fx(S).shard.emitParticleAt(p.x, p.y - 4, 4); }
    }
    // a hit on you, after the Ember Scythe's slide shield (CombatSystem.takeDamage): the frost shell takes what it can (it has no time limit), cracking, and breaks
    static shell(S, amount) {
        const sh = S._tri?.shell;
        if (!sh || sh.hp <= 0 || !(amount > 0)) return amount;
        const took = Math.min(sh.hp, amount);
        sh.hp -= took;
        if (S.player) S._vfxFlash?.(S.player.x, S.player.y - 4, 30, 0xbfefff, 140, 0.55);
        if (sh.hp <= 0) {   // broken: the shell shatters off you
            const p = S.player, RF = Rimeguard.fx(S);
            if (p) { S.showStatusText?.(p.x, p.y - 30, 'SHELL BROKEN', '#bfefff'); RF.shard.emitParticleAt(p.x, p.y - 4, 10); Trident.fx(S).chunk.emitParticleAt(p.x, p.y, 4); }
            Sfx.play(S, 'shatter');
            for (const pl of S._tri.plates || []) { if (!pl.active) continue; const a = Math.atan2(pl.y - (p?.y ?? pl.y), pl.x - (p?.x ?? pl.x)); S.tweens.add({ targets: pl, x: pl.x + Math.cos(a) * 26, y: pl.y + Math.sin(a) * 18 + 8, alpha: 0, duration: 300, ease: 'Quad.easeOut', onComplete: () => pl.destroy() }); }   // (the plates flying off)
            S._tri.plates = null;
        }
        return amount - took;
    }
    // the Frostkin shell, shown: five plates of ice orbiting you at your middle (plate_0..2: whole, cracked, cracked through as it's
    // drained), the far ones behind you and dimmer; broken, they fly off (shell)
    static armour(S, time) {
        const st = S._tri, p = S.player;
        if (!p?.active) return;
        const sh = st.shell;
        if (!(sh?.hp > 0)) return;
        const plates = st.plates ||= Array.from({ length: 5 }, () => S.add.image(p.x, p.y, 'fx_trident', 'plate_0').setScale(1.5));
        const k = sh.hp / sh.max, fr = k > 0.66 ? 'plate_0' : k > 0.33 ? 'plate_1' : 'plate_2', D = p.depth ?? 3;
        plates.forEach((pl, i) => { const a = time * 0.0022 + i / plates.length * Math.PI * 2, front = Math.sin(a) > 0; pl.setFrame(fr).setPosition(p.x + Math.cos(a) * 17, p.y - 8 + Math.sin(a) * 5).setDepth(front ? D + 0.06 : D - 0.06).setAlpha(front ? 0.95 : 0.55); });
    }
    // the shots the aura slowed this frame, found by where they were (Trident.slow gets only a place): each tinted cold, a thin rime
    // rim drawn round it sized to it (shell_1; a big haze only a faint frosty edge, shell_0), a slow frost mote now and then off a
    // small one; let go of (its own tint back) the moment it's out of the aura
    static coldShots(S, time) {
        const st = S._tri, pts = S._triSlowAt, cold = st.cold ||= new Map();
        S._triSlowAt = null;
        if (pts?.length) for (const o of S.children.list) {
            if (!o.active || !o.visible || o.type === 'Container' || o.type === 'ParticleEmitter' || o === S.player || o.texture?.key === 'fx_trident' || !(o.displayWidth > 0)) continue;
            for (let i = 0; i < pts.length; i += 2) if (Math.abs(o.x - pts[i]) < 6 && Math.abs(o.y - pts[i + 1]) < 6) { cold.set(o, time); break; }
        }
        for (const [o, at] of cold) {
            const big = (o.displayWidth || 0) > 40;
            if (!o.active || time - at > 90) {   // (out of the aura, or gone)
                if (o.active && o._triTint !== undefined) { if (o._triTint === null) o.clearTint?.(); else o.setTint?.(o._triTint); }
                o._triTint = undefined; o._triRim?.destroy(); o._triRim = null; cold.delete(o); continue;
            }
            if (o._triTint === undefined && o.setTint) { o._triTint = o.isTinted ? o.tintTopLeft : null; o.setTint(0xbfe6ff); }
            const rim = o._triRim ||= S.add.image(o.x, o.y, 'fx_trident', big ? 'shell_0' : 'shell_1').setAlpha(big ? 0.22 : 0.6);
            rim.setPosition(o.x, o.y).setScale(Math.max(0.4, (o.displayWidth || 10) * 1.15 / 22)).setDepth((o.depth ?? 3) + 0.01);
            if (!big && Math.random() < 0.03) Trident.fx(S).mote.emitParticleAt(o.x + (Math.random() - 0.5) * 6, o.y, 1);
        }
    }
    // e dazed ms more (the thrust's and the swipe's hits), with the daze's own mark over it; bosses only take the hit
    static daze(S, e, ms) {
        if (!e?.sprite?.active || e.health <= 0 || e.isBoss) return;
        e.isStunned = true; e.stunnedUntil = Math.max(e.stunnedUntil || 0, S.time.now + ms);
        S._showStunIndicator?.(e);
    }
    static unhook(S, e) {
        if (!e?.sprite) return;
        S.tweens.killTweensOf(e.sprite); e.sprite._vfxHopTween?.stop(); e.sprite._vfxHopTween = null;
        e._attackAnimPlaying = false; e.sprite.setScale(e._baseScale ?? S.SLIME_SCALE);
        e._committedPath = null; e._pathIndex = undefined;
    }
    // e jolted a few pixels (a hit you see land; not knockback)
    static jolt(S, e, px) { if (e.sprite?.active && !S.tweens.isTweening(e.sprite)) S.tweens.add({ targets: e.sprite, y: e.sprite.y - px, duration: 55, yoyo: true, ease: 'Quad.easeOut' }); }
    // RIME MARKS: n more on e (MARK_MAX at most), lasting MARK_MS from the last; crystals over it (in the status icons' rows)
    static mark(S, e, n) {
        if (!e?.sprite?.active || e.health <= 0) return;
        const C = Trident.CFG, st = Trident.st(S), was = e._rmN || 0;
        e._rmN = Math.min(C.MARK_MAX, was + n); e._rmUntil = S.time.now + C.MARK_MS; st.marked.add(e);
        if (e._rmN === was) return;
        const ic = e._rmIcon ||= S.add.image(e.sprite.x, e.sprite.y - 30, 'fx_trident', 'rmark_1').setDepth(5.5);
        ic.setFrame('rmark_' + e._rmN).setAlpha(1).setScale(1.8);
        S.tweens.add({ targets: ic, scale: 1, duration: 160, ease: 'Back.easeOut' });
        Sfx.play(S, 'clink', { soft: true });
    }
    static unmark(S, e) {
        e._rmN = 0; e._rmUntil = 0; S._tri?.marked.delete(e);
        const ic = e._rmIcon; e._rmIcon = null;
        if (ic?.active) S.tweens.add({ targets: ic, alpha: 0, scale: 1.4, duration: 160, onComplete: () => ic.destroy() });
    }
    // the swipe knocking enemy shots out of the air: any within r px of (x, y) and arc of `aim` (the Blinder's haze too), each shattered
    static parry(S, x, y, aim, arc, r) {
        const RF = Rimeguard.fx(S), hit = (px, py) => Math.hypot(px - x, py - y) <= r && Math.abs(Phaser.Math.Angle.Wrap(Math.atan2(py - y, px - x) - aim)) <= arc;
        const pop = (px, py) => { RF.shard.emitParticleAt(px, py, 3); Trident.once(S, px, py, 'tri_glint', 1.2, 4.6); };
        const ep = S.enemyProjectiles;
        if (ep) for (let i = ep.length - 1; i >= 0; i--) {
            const p = ep[i], px = p.isRopeTendril ? p._tipX : p.gfx?.x, py = p.isRopeTendril ? p._tipY : p.gfx?.y;
            if (px === undefined || !hit(px, py)) continue;
            pop(px, py); S._destroyEnemyProjectile?.(p); ep.splice(i, 1);
        }
        const vr = S._voidRipples;
        if (vr) for (let i = vr.length - 1; i >= 0; i--) { const v = vr[i]; if (!v.gfx?.active || !hit(v.gfx.x, v.gfx.y)) continue; pop(v.gfx.x, v.gfx.y); v.gfx.destroy(); vr.splice(i, 1); }
        const boss = S.voltslimeBoss;
        if (boss?.active) for (const arr of [boss.projectiles, boss.homingProjectiles]) if (arr) for (let i = arr.length - 1; i >= 0; i--) { const p = arr[i]; if (!p.g?.active || !hit(p.g.x, p.g.y)) continue; pop(p.g.x, p.g.y); p.g.destroy(); arr.splice(i, 1); }
    }
    // the slam's footprint, tile offsets (dx, dy) from where you land: a 7x7 with its corners cut, 3 tiles on each outer edge
    //   ..XXX..  .XXXXX.  XXXXXXX (x3)  .XXXXX.  ..XXX..
    // the slam's footprint round (tx, ty): the tiles of its squircle you could walk to from there without crossing a wall (a flood
    // fill through floor), as a Set of 'x,y' (you fly over walls; the slam doesn't hit through them)
    static footprint(S, tx, ty) {
        const k = (x, y) => x + ',' + y, seen = new Set(), q = [[tx, ty]];
        if (S.world[tx]?.[ty] !== S.FLOOR) return seen;
        seen.add(k(tx, ty));
        for (let h = 0; h < q.length; h++) for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
            const x = q[h][0] + dx, y = q[h][1] + dy;
            if (seen.has(k(x, y)) || !Trident.squircle(x - tx, y - ty) || S.world[x]?.[y] !== S.FLOOR) continue;
            seen.add(k(x, y)); q.push([x, y]);
        }
        return seen;
    }
    static squircle(dx, dy) { const R = Trident.CFG.SLAM_R; return Math.max(Math.abs(dx), Math.abs(dy)) <= R && Math.abs(dx) + Math.abs(dy) <= R + 1; }
    static FOOT = (() => { const o = []; for (let dx = -3; dx <= 3; dx++) for (let dy = -3; dy <= 3; dy++) if (Math.max(Math.abs(dx), Math.abs(dy)) <= 3 && Math.abs(dx) + Math.abs(dy) <= 4) o.push([dx, dy]); return o; })();
    // Rime (Rimeguard's: its crystal clusters, spikes, shards and mist) crystallising over the floor: a cluster on each of
    // `spots` ([x, y, delay] px, ms), growing, glinting, then cracking and melting away; spikes bursting up among them here and
    // there; mist low over it
    static frost(S, spots, k = 1, life = 0) {
        const RF = Rimeguard.fx(S);
        for (const [x, y, d] of spots) S.time.delayedCall(d, () => {
            if (!S.sys?.isActive()) return;
            const c = S.add.sprite(x, y + 4, 'fx_rimeguard', 'crys_0').setOrigin(0.5, 1).setScale(k * (1.1 + Math.random() * 0.5)).setFlipX(Math.random() < 0.5).setDepth(1.05).play('tri_crys');
            if (Math.random() < 0.35) Trident.once(S, x + (Math.random() - 0.5) * 8, y - 6, 'tri_glint', 1, 3.6);
            S.time.delayedCall((life || Trident.CFG.RIME_MS) + Math.random() * 250, () => {   // cracking, melting away
                if (!c.active) return;
                RF.shard.emitParticleAt(c.x, c.y - 6, 1); if (Math.random() < 0.4) RF.mist.emitParticleAt(c.x, c.y - 2, 1);
                S.tweens.add({ targets: c, alpha: 0, scaleY: c.scaleY * 0.6, duration: 380, onComplete: () => c.destroy() });
            });
            if (Math.random() < 0.3) Rimeguard.spike(S, x + (Math.random() - 0.5) * 10, y + 6, k * (0.8 + Math.random() * 0.35), 30, true);
            if (Math.random() < 0.3) RF.mist.emitParticleAt(x, y + 2, 1);
        });
    }

    // ── the throw ──
    static hurlCd() { return Trident.CFG.HURL_CD - Trident.CFG.RECALL_UP * Trident.perk('recall'); }   // (Swift Recall: RECALL_UP less a level)
    static range(k) { const C = Trident.CFG; return C.RANGE + (C.RANGE_FULL - C.RANGE) * k + C.RANGE_UP * Trident.perk('hurl'); }
    static hurl(S, aim, k) {
        const C = Trident.CFG, st = Trident.st(S), now = S.time.now, F = Trident.fx(S), full = k >= 1, ADD = Phaser.BlendModes.ADD;
        const x = S._shotX(), y = S._shotY(), ux = Math.cos(aim), uy = Math.sin(aim), D = Trident.range(k) * S.TILE_SIZE;
        const spr = Trident.face(S.add.sprite(x + ux * 10, y + uy * 10, 'fx_trident', 'tri_e'), aim).setScale(C.SCALE * 1.2).setDepth(3.5);
        const glow = S.add.image(spr.x, spr.y, 'vfx_glow').setTint(0x7fd0ff).setBlendMode(ADD).setDepth(3.4).setScale(0.6).setAlpha(0.55);
        const core = S.add.sprite(spr.x, spr.y, 'fx_trident', 'core_0').setBlendMode(ADD).setDepth(3.52).setScale(1.5).play('tri_core');
        const shadow = S.add.image(x, y + 6, 'vfx_shadow').setDepth(0.95).setAlpha(0.5);
        st.hurlAt = now + Trident.hurlCd(); st.seed = (st.seed || 0) + 1;
        let stop = D; for (let d = 10; d <= D; d += 4) if (S.world[Math.floor((x + ux * d) / S.TILE_SIZE)]?.[Math.floor((y + uy * d) / S.TILE_SIZE)] !== S.FLOOR) { stop = d; break; }
        st.out = { spr, glow, core, shadow, ux, uy, a: aim, x0: x, y0: y, gx: x + ux * 10, gy: y + uy * 10, D, stop, arcH: Math.min(12, 4 + 0.04 * stop), trav: 10, leg: 'out', held: [], hit: new Set(), boss: false, tile: null, t0: now, ghostAt: 0, wakeAt: 10, water: [], lane: [] };
        S._gearFiredAt = now;
        Sfx.play(S, 'swing'); Sfx.play(S, 'w_boreal_trident'); Sfx.play(S, 'splash', { big: true });
        // the launch: frost torn off the tines and thrown back past you; the sea opens ahead of it (fly)
        F.dir = [aim * 180 / Math.PI, 40]; F.spark.emitParticleAt(x + ux * 14, y + uy * 14, full ? 10 : 6);
        F.dir = [aim * 180 / Math.PI + 180, 70]; F.shard.emitParticleAt(x, y, full ? 6 : 4); F.dir = null;
        S.cameras.main.shake(90, full ? 0.006 : 0.003);
    }
    // The trident in flight, a frame: a comet of frost tearing a wake through an icy sea (slice, shut), and every enemy within PULL_R tiles is dragged in onto its tines (CARRY_DMG as
    // they're caught) and carried to where it stops; rime over the floor it passes, LANE_W tiles either side (only the look). Then home to your hand.
    static fly(S, time) {
        const st = S._tri, o = st?.out;
        if (!o) return;
        const C = Trident.CFG, T = S.TILE_SIZE, F = Trident.fx(S), dt = Math.min(50, S.game.loop.delta || 16) / 1000, s = o.spr;
        if (!s.active || !S.player?.active || time - o.t0 > 6000) return Trident.catch(S);
        if (performance.now() < (S._glvStopUntil || 0)) return;   // (held still through a hitstop)
        S._scytheSpinUntil = time + 100;   // (your hand's empty)
        const x0 = s.x, y0 = s.y;
        if (o.leg === 'hang') { if (time >= o.until && !st.ride) { o.leg = 'back'; Trident.burst(S, s.x, s.y, 0.8); Sfx.play(S, 'shatter', { soft: true }); } return; }   // (ripped out of what it's stuck in)
        if (o.leg === 'back') {
            const hx = S._shotX(), hy = S._shotY(), d = Math.hypot(hx - x0, hy - y0), step = C.BACK * dt;
            if (d <= step + 8) return Trident.catch(S);
            const a = Math.atan2(hy - y0, hx - x0);
            Trident.streak(S, s);
            s.setPosition(x0 + (hx - x0) / d * step, y0 + (hy - y0) / d * step).setAlpha(0.85);
            Trident.face(s, a); o.glow.setPosition(s.x, s.y); o.core.setPosition(s.x + Math.cos(a) * 14, s.y + Math.sin(a) * 14).setScale(0.9);
            if (time >= o.ghostAt) { o.ghostAt = time + 50; Trident.fx8(S, s.x, s.y, 'tail', Math.round(a / (Math.PI / 4)), 1.1, 3.4).setAlpha(0.6); }
            return;
        }
        // straight down the aim at SPEED, skimming low over the floor (LOW px up), its shadow tight under it
        const step = Math.min(C.SPEED * dt, o.D - o.trav), gx0 = o.gx, gy0 = o.gy, x1 = gx0 + o.ux * step, y1 = gy0 + o.uy * step;
        o.trav += step;
        if (S.world[Math.floor(x1 / T)]?.[Math.floor(y1 / T)] !== S.FLOOR) return Trident.end(S, gx0, gy0, true);   // a wall
        o.gx = x1; o.gy = y1;
        const f = Math.min(1, o.trav / o.stop), z = 5 + 4 * o.arcH * f * (1 - f), vz = 4 * o.arcH * (1 - 2 * f) * C.SPEED / o.stop, sx = x1, sy = y1 - z, pitch = Math.atan2(o.uy * C.SPEED - vz, o.ux * C.SPEED);   // (a shallow arc to the eye; it flies straight)
        Trident.streak(S, s);
        Trident.face(s, pitch).setPosition(sx, sy);
        o.glow.setPosition(sx, sy).setScale(0.6 + 0.1 * Math.sin(time * 0.03));
        o.core.setPosition(sx + Math.cos(pitch) * 18, sy + Math.sin(pitch) * 18);
        o.shadow.setPosition(x1, y1 + 6).setScale(0.75 - 0.25 * (z - 5) / 12, 0.42 - 0.12 * (z - 5) / 12).setAlpha(0.55 - 0.2 * (z - 5) / 12);   // (on the floor, apart from it at the top of the arc)
        // the rip current: walls of water rushing in from both sides onto its line behind it, a slice every SEA_GAP of its travel
        for (; o.wakeAt <= o.trav; o.wakeAt += C.SEA_GAP) Trident.slice(S, o, o.wakeAt);
        // its trail: a streak of rime laid behind it
        if (time >= o.ghostAt) { o.ghostAt = time + 35; Trident.fx8(S, sx - Math.cos(pitch) * 8, sy - Math.sin(pitch) * 8, 'tail', Math.round(pitch / (Math.PI / 4)), 1.7, 3.44); }
        const ds = S.damageScaling || 1, chill = S._chillCfg().DIRECT * C.HURL_CHILL, R = C.PULL_R * T;
        // caught: everything in reach (bosses and the rooted ones only struck as it passes), dragged in by the water caving in
        for (const e of [...(S.enemies || [])]) {
            if (o.hit.has(e) || !e.sprite?.active || e.health <= 0 || S._phasedOut?.(e) || !S.isInCurrentRoom(e.x, e.y)) continue;
            const heavy = e.isBoss || e.isMortar || e.isHealerTotem || e.isAnchor;
            if (Math.hypot(e.sprite.x - x1, e.sprite.y - (S.SLIME_Y_OFFSET || 0) - y1) > (heavy ? C.HIT : R) || !Trident.clear(S, Math.floor(x1 / T), Math.floor(y1 / T), e.x, e.y)) continue;   // (never through a wall)
            o.hit.add(e);
            const r = Trident.hit(S, e, C.CARRY_DMG * ds, chill);
            if (r !== true) continue;   // (no Frostbite from the throw's own hits: its lane's rime gives it)
            if (heavy) { Trident.burst(S, e.sprite.x, e.sprite.y - 4, 1); continue; }
            Trident.unhook(S, e);
            e._surgeKnockedBack = true; e._triFrom = [e.sprite.x, e.sprite.y]; e._triAt = time;
            o.held.push(e);
            Trident.drag(S, e.sprite.x, e.sprite.y + 4, x1, y1 + 6);   // (the sea caving in drags it onto the tines)
            Sfx.play(S, 'splash', { soft: true });
        }
        // the carried: yanked in onto the tines, a heap riding ahead of it
        o.held = o.held.filter(e => e.sprite?.active && e.health > 0);
        const tx = Math.floor(x1 / T), ty = Math.floor(y1 / T), nx = -o.uy, ny = o.ux;
        o.held.forEach((e, i) => {
            const row = Math.floor(i / 3), col = (i % 3) - 1, k = Math.min(1, (time - e._triAt) / 160), q = 1 - (1 - k) * (1 - k);
            const hx = x1 + o.ux * (14 + 7 * row) + nx * col * 9, hy = y1 - z + o.uy * (14 + 7 * row) + ny * col * 9 + (S.SLIME_Y_OFFSET || 0) + 6;   // (stacked up on the tines)
            e.sprite.setPosition(e._triFrom[0] + (hx - e._triFrom[0]) * q, e._triFrom[1] + (hy - e._triFrom[1]) * q);
            e.isStunned = true; e.stunnedUntil = Math.max(e.stunnedUntil || 0, time + 300);
            e.x = tx; e.y = ty;
        });
        if (`${tx},${ty}` !== o.tile) {   // a new tile: a boss on it, a queen, and its rime across its line
            o.tile = `${tx},${ty}`;
            if (!o.boss && S.damageBossAtTile?.(tx, ty, C.CARRY_DMG * ds, undefined, 'ice')) { o.boss = true; o.hit.add('boss'); return Trident.end(S, x1, y1, true); }   // (a boss stops it: what it carries is pinned against it)
            const p = S.getPortalAt?.(tx, ty); if (p && !o.hit.has(p)) { o.hit.add(p); S.damagePortal(p, C.CARRY_DMG * ds); }
            const across = Math.abs(o.ux) >= Math.abs(o.uy) ? [0, 1] : [1, 0];
            for (let w = -C.LANE_W; w <= C.LANE_W; w++) { const x = tx + across[0] * w, y = ty + across[1] * w; if (S.world[x]?.[y] === S.FLOOR && !o.lane.some(l => l[0] === x && l[1] === y)) o.lane.push([x, y, w ? 0.4 : 0.85]); }   // (its rime comes with the freeze: end)
        }
        if (o.trav >= o.D) Trident.end(S, x1, y1, false);
    }
    // how far out from (px, py) along (nx, ny) it's open floor in sight of the line, up to max px (the rip current's walls, the zipper)
    static reachOut(S, px, py, nx, ny, max) {
        const T = S.TILE_SIZE, tx = Math.floor(px / T), ty = Math.floor((py - 6) / T);
        for (let r = 4; r <= max; r += 4) { const x = Math.floor((px + nx * r) / T), y = Math.floor((py - 6 + ny * r) / T); if (S.world[x]?.[y] !== S.FLOOR || !Trident.clear(S, tx, ty, x, y)) return Math.max(0, r - 8); }
        return max;
    }
    // A slice of the RIP CURRENT `d` px along the throw's line (every SEA_GAP of its travel, on its true path): from both sides a
    // BREAKING WAVE rolling in from SEA_W tiles out (short of walls) and crashing INWARD onto the line behind it (the rush that carries
    // enemies onto its tines). Each side comes in sections of its own (a few slices long, each crashing a little earlier or later,
    // higher or lower), its crest rearing up as it comes and curling over onto the line; spray bursting up where they meet, now and
    // then. Then lying there till the freeze (only drawn: see water)
    static slice(S, o, d) {
        const C = Trident.CFG, T = S.TILE_SIZE, px = o.x0 + o.ux * d, py = o.y0 + o.uy * d + 6, nx = -o.uy, ny = o.ux, k = o.slices = (o.slices || 0) + 1, a = Math.atan2(ny, nx);
        const wv = o.wv ||= [Trident.wavy([0.12, 0.06], [1 / 21, 1 / 8]), Trident.wavy([0.12, 0.06], [1 / 18, 1 / 9])], secs = o.secs ||= [{ n: 0 }, { n: 0 }];
        if (S.world[Math.floor(px / T)]?.[Math.floor(py / T)] !== S.FLOOR) return;
        for (const side of [-1, 1]) {
            const sec = secs[side < 0 ? 0 : 1];
            if (--sec.n <= 0) { sec.n = 3 + Math.floor(Math.random() * 4); sec.off = (Math.random() - 0.35) * 110; sec.amp = 0.8 + Math.random() * 0.35; sec.h = 3 + Math.random() * 7; }   // (a new section of the wave)
            const out = Trident.reachOut(S, px, py, nx * side, ny * side, C.SEA_W * T * 0.9 * sec.amp * wv[side < 0 ? 0 : 1](d)), stop = Math.min(out * 0.8, T * (0.12 + Math.random() * 0.3));   // (where it crashes, its side of the line: never further out than it's open)
            const ms = Math.max(90, C.SEA_RUSH + sec.off + (Math.random() - 0.5) * 30), wx = px + nx * side * stop + o.ux * 4, wy = py + ny * side * stop + o.uy * 4;
            for (const q of [1, 0.55]) {   // (its body: the wave and the water behind it, crashing in)
                const w = Trident.water(S, px + nx * side * out * q, py + ny * side * out * q, 1.5 + Math.random() * 0.4, 0.935);
                S.tweens.add({ targets: w, alpha: 0.88, duration: 60 }); S.tweens.add({ targets: w, x: wx + nx * side * (1 - q) * 6, y: wy + ny * side * (1 - q) * 6, duration: ms * (0.7 + 0.3 * q), ease: 'Quad.easeIn' });
                o.water.push(w);
            }
            const c = Trident.crest(S, px + nx * side * (out - 6), py + ny * side * (out - 6), a + (side < 0 ? 0 : Math.PI), k, 0.94);   // (its crest: rearing up as it comes, curling over onto the line)
            S.tweens.add({ targets: c, x: px + nx * side * 4, duration: ms, ease: 'Quad.easeIn' });
            S.tweens.add({ targets: c, y: { value: py + ny * side * 4, ease: p => p * p }, duration: ms });
            S.tweens.add({ targets: c, scaleY: c.scaleY * (1 + sec.h / 10), duration: ms * 0.55, yoyo: true, ease: 'Sine.easeOut' });
            o.water.push(c);
            if (sec.n === 1 && Math.random() < 0.6) { const sea = o.water; S.time.delayedCall(ms, () => {   // (spray bursting up where a section crashes onto the line)
                if (!S.sys?.isActive()) return;
                for (let i = 0, n = 2 + Math.floor(Math.random() * 4); i < n; i++) { const v = 40 + Math.random() * 70; Trident.drop(S, sea, px + (Math.random() - 0.5) * 8, py - 4, (Math.random() - 0.5) * 60 + o.ux * 30, -v + o.uy * 30, 3.2); }
                if (Math.random() < 0.5) { const [f, fx, fy] = Trident.dir(Math.atan2(o.uy, o.ux)), sp = Trident.once(S, px, py - 3, 'tri_spray_' + f, 1.1 + Math.random() * 0.5, 3.3, false).setFlip(!!fx, !!fy); sp._kind = 'spray'; sea.push(sp); }
            }); }
        }
        if (k % 2) Trident.churnBody(S, o.water, px + nx * (Math.random() - 0.5) * T * 0.6, py + ny * (Math.random() - 0.5) * T * 0.6, Math.atan2(o.uy, o.ux), 0.935);
        if (k % 2) { const g = S.add.image(px, py, 'vfx_glow').setTint(0x1a5aa6).setAlpha(0.3).setScale(0.55).setDepth(0.932); g._kind = 'glow'; o.water.push(g); }   // (a haze of blue under it: one water)
    }
    // the sea dragging an enemy in: a torn edge of it from the enemy rushing to the tines, spray where it gets there
    static drag(S, x0, y0, x1, y1) {
        const [f, fx, fy] = Trident.dir(Math.atan2(y1 - y0, x1 - x0));
        const w = S.add.image(x0, y0, 'fx_trident', 'wake_' + f).setFlip(!!fx, !!fy).setScale(1.5).setDepth(3.3);
        S.tweens.add({ targets: w, x: x1, y: y1, duration: 160, ease: 'Quad.easeIn', onComplete: () => { w.destroy(); if (S.sys?.isActive()) Trident.once(S, x1, y1 - 3, 'tri_spray_' + f, 1.3, 3.3, false).setFlip(!!fx, !!fy); } });
    }
    // Cascading rime from where the throw lands (x, y): Rimeguard's rime crystallising out over the floor in waves, a beat apart,
    // its clusters at irregular spots (a few to each wave, scattered, never a ring of them), then cracking and melting away
    static rime(S, x, y, big) {
        const T = S.TILE_SIZE, waves = big ? 4 : 3, spots = [];
        for (let j = 0; j < waves; j++) for (let i = 0, n = 3 + 3 * j + Math.floor(Math.random() * 3); i < n; i++) {
            const a = Math.random() * Math.PI * 2, rr = (0.4 + 0.65 * j + Math.random() * 0.6) * T, cx = x + Math.cos(a) * rr, cy = y + Math.sin(a) * rr * 0.8;
            if (S.world[Math.floor(cx / T)]?.[Math.floor(cy / T)] === S.FLOOR && Trident.clear(S, x / T - 0.5, y / T - 0.5, cx / T - 0.5, cy / T - 0.5)) spots.push([cx, cy, 30 + 130 * j + Math.random() * 70]);
        }
        Trident.frost(S, spots, big ? 1.15 : 1);
    }
    // Where it stops: the wake slams shut over it (spray, foam, mist, rime cascading out over the floor). What it carried comes
    // off in a heap and takes END_DMG. Into a wall, or two or more of them crashing together: END_BIG times that (END_PER more for each one past the first, WALL_DMG more at a wall) and the long daze,
    // each sealed in a block of ice that cracks open as it ends.
    static end(S, x, y, wall) {
        const st = S._tri, o = st.out, C = Trident.CFG, T = S.TILE_SIZE, now = S.time.now, F = Trident.fx(S);
        o.leg = 'hang'; o.until = now + C.HANG; o.glow.setPosition(x, y - 8); o.shadow?.destroy(); o.shadow = null;
        o.core.setPosition(x, y - 2).setScale(1.1);
        if (wall) {   // driven into the wall at its flight angle, tines buried, quivering; a crack in the wall and chips off it
            Trident.face(o.spr, o.a).setPosition(x + o.ux * 10, y + o.uy * 10 - 5);
            S.tweens.add({ targets: o.spr, x: o.spr.x - o.ux * 1.5, y: o.spr.y - o.uy * 1.5, duration: 45, yoyo: true, repeat: 4 });
            const c = S.add.image(x + o.ux * 16, y + o.uy * 16 - 4, 'fx_trident', 'crater_1').setScale(1.6).setDepth(3.49).setAlpha(0.9);
            S.tweens.add({ targets: c, alpha: 0, delay: C.HANG + 300, duration: 400, onComplete: () => c.destroy() });
            F.dir = [o.a * 180 / Math.PI + 180, 70]; F.chunk.emitParticleAt(x + o.ux * 12, y + o.uy * 12, 6); F.dir = null;
        } else {   // come down and planted steeply in the floor, tines in, the floor cracked round it
            Trident.face(o.spr, Math.atan2(0.92, 0.4 * (o.ux >= 0 ? 1 : -1))).setPosition(x, y - 10);
            const c = S.add.image(x, y + 4, 'fx_trident', 'crater_1').setScale(2).setDepth(0.94).setAlpha(0.9);
            S.tweens.add({ targets: c, alpha: 0, delay: C.HANG + 150, duration: 400, onComplete: () => c.destroy() });
        }
        const held = o.held.filter(e => e.sprite?.active && e.health > 0), n = held.length, big = wall;   // (PINNED at a wall or a boss; at its range it drops)
        o.held = [];
        // the landing, every time: what's within LAND_R that it wasn't carrying takes LAND_DMG
        const ds = S.damageScaling || 1, lx = x / T - 0.5, ly = y / T - 0.5;
        for (const e of [...(S.enemies || [])]) {
            if (held.includes(e) || !e.sprite?.active || e.health <= 0 || S._phasedOut?.(e) || !S.isInCurrentRoom(e.x, e.y)) continue;
            if (Math.hypot(e.x - lx, e.y - ly) > C.LAND_R) continue;
            Trident.hit(S, e, C.LAND_DMG * ds, S._chillCfg().SPLASH);
        }
        // the crash: what's left of the wake rushes in over it and slams shut in one burst: sheets of spray across both ways, a
        // ring of foam breaking up, spray thrown out, mist, and rime cascading out over the floor (only the look)
        S._vfxFlash?.(x, y, big ? 60 : 44, 0xd8fff4, 220, big ? 0.45 : 0.32);
        const sea = o.water; o.water = [];
        for (const f of ['e', 's']) { const sp = Trident.once(S, x, y - 2, 'tri_spray_' + f, big ? 2.6 : 2, 3.48, false); sp._kind = 'spray'; sea.push(sp); }
        for (let i = 0; i < (big ? 12 : 8); i++) { const a = -Math.PI / 2 + (Math.random() - 0.5) * 2.4, v = 70 + Math.random() * 90; Trident.drop(S, sea, x, y - 4, Math.cos(a) * v, Math.sin(a) * v, 3.49); }
        Trident.lanefreeze(S, sea, o.lane, x, y + 4, big, o);
        Trident.ring(S, x, y + 4, big ? 2.2 : 1.7);
        Trident.rime(S, x, y + 4, big);
        Trident.mist(S, x, y + 2, big ? 7 : 5, T * 1.8);
        F.dir = [-90, 170]; F.shard.emitParticleAt(x, y - 6, big ? 18 : 12); F.dir = null;
        Glaive.hitstop(S, big ? C.END_STOP + 30 : C.CRASH_STOP);
        if (o.hit.size) { o.rush = true; if (st.ride) st.ride.rush = true; else Trident.rush(S, now + C.RUSH_MS); }   // (riding: the rush starts as you land)   // (it caught something: FROST RUSH, the clump's for dumping the combo into)
        S.cameras.main.shake(big ? 200 : 140, big ? 0.014 : 0.008);
        Sfx.play(S, 'splash', { big: true }); Sfx.play(S, 'slam', { small: !big }); Sfx.play(S, 'freeze');
        if (!n) {
            Trident.rideLand(S, x, y, o, []);
            for (let k = 0; k < 4; k++) { const a = k / 4 * Math.PI * 2 + 0.4; Rimeguard.spike(S, x + Math.cos(a) * 15, y + Math.sin(a) * 11 + 4, 0.85, 60 + 20 * k, Math.sin(a) > -0.3); }
            return;
        }
        // the heap set down on the nearest open floor round where it stopped
        const ex = Math.floor((x + o.ux * 6) / T), ey = Math.floor((y + o.uy * 6) / T), cx0 = S.world[ex]?.[ey] === S.FLOOR ? ex : Math.floor(x / T), cy0 = S.world[ex]?.[ey] === S.FLOOR ? ey : Math.floor(y / T);
        const taken = new Set((S.enemies || []).filter(e => !held.includes(e) && e.sprite?.active).map(e => `${e.x},${e.y}`)).add(`${S.playerX},${S.playerY}`);
        const spots = [];
        for (let r = 0; r <= 8 && spots.length < n; r++) for (let dx = -r; dx <= r; dx++) for (let dy = -r; dy <= r; dy++) {   // (each its own free floor tile)
            if (Math.max(Math.abs(dx), Math.abs(dy)) !== r || spots.length >= n) continue;
            const sx = cx0 + dx, sy = cy0 + dy;
            if (S.world[sx]?.[sy] === S.FLOOR && !taken.has(`${sx},${sy}`)) { taken.add(`${sx},${sy}`); spots.push([sx, sy]); }
        }
        Trident.rideLand(S, x, y, o, spots);
        const dmg = (C.END_DMG * (big ? C.END_BIG : 1) * (1 + C.END_PER * (n - 1)) + (wall ? C.WALL_DMG : 0)) * (S.damageScaling || 1);
        held.forEach((e, i) => {
            e._surgeKnockedBack = false;
            const [sx, sy] = spots[i] || [e.x, e.y];
            Trident.unhook(S, e);   // (set down with nothing of its own left to pull it back)
            e.x = sx; e.y = sy;
            S.tweens.add({ targets: e.sprite, x: sx * T + T / 2, y: sy * T + T / 2 + S.SLIME_Y_OFFSET, duration: 90, ease: 'Quad.easeOut' });
            if (Trident.hit(S, e, dmg, 0) !== true) return;
            e.isStunned = true; e.stunnedUntil = Math.max(e.stunnedUntil || 0, now + (big ? C.LONG_DAZE : C.DAZE_MS));
            S._showStunIndicator?.(e);
            if (big) S.time.delayedCall(90, () => Trident.seal(S, e, e.stunnedUntil));
        });
        if (!big) return;
        Sfx.play(S, 'shatter');
        const hx = cx0 * T + T / 2, hy = cy0 * T + T / 2;
        S.showStatusText?.(hx, hy - 34, wall ? (n > 1 ? `PINNED ×${n}` : 'PINNED') : `IMPALED ×${n}`, '#d8fff4');
        for (let k = 0; k < 7; k++) {   // ice bursting up round the heap as the water freezes
            const a = k / 7 * Math.PI * 2 + Math.random() * 0.4, r = 14 + 6 * Math.min(3, n) + Math.random() * 6;
            Rimeguard.spike(S, hx + Math.cos(a) * r, hy + Math.sin(a) * r * 0.75 + 4, 0.9 + Math.random() * 0.4, 80 + 25 * k, Math.sin(a) > -0.3);
        }
    }
    // The throw's sea FLASH-FROZEN from YOU out along its corridor to where it landed (x, y), LANE_FREEZE ms after the crash: the
    // frost chasing out down it (FREEZE_V px a ms), catching what's still crashing mid-crash (frozen curls, frozen spray); LANE_HOLD
    // behind the front the frozen waves shatter in a rolling chain of bursts (irregularly spaced, varied sizes, chunks thrown up and in,
    // the ice there collapsing onto the line), the lane's rime spreading as they go (only its look); the chain ending in the biggest
    // burst at the landing, with the boom
    static lanefreeze(S, sea, lane, x, y, big, o) {
        const C = Trident.CFG, T = S.TILE_SIZE, v = C.FREEZE_V * 1.2, ux = o.ux, uy = o.uy, nx = -uy, ny = ux, x0 = o.x0, y0 = o.y0 + 6, F = Trident.fx(S);
        S.time.delayedCall(C.LANE_FREEZE, () => {
            if (!S.sys?.isActive()) return;
            const ox = S._shotX(), oy = S._shotY() + 6, at = (px, py) => Math.hypot(px - ox, py - oy) / v + C.LANE_HOLD;
            const L = Math.max(0, (x - x0) * ux + (y - y0) * uy), t0 = Math.min(L, Math.max(0, (ox - x0) * ux + (oy - y0) * uy)), far = Math.hypot(x - ox, y - oy) + T;
            Trident.chase(S, sea, ox, oy, t => v * t, far, r => [0, 1].map(() => { const q = (Math.random() - 0.5) * T * 2, al = t0 + r; return [x0 + ux * al + nx * q, y0 + uy * al + ny * q]; }));
            for (const [tx, ty, wgt] of lane) S.time.delayedCall(at(tx * T + T / 2, ty * T + T / 2) + 60, () => S.sys?.isActive() && Trident.rimeTile(S, tx, ty, C.RIME_MS, wgt));
            for (let t = t0 + T * (0.3 + Math.random() * 0.5); t < L - T * 0.6; t += T * (0.6 + Math.random() * 0.7)) {   // the chain of bursts
                const q = (Math.random() - 0.5) * T * 0.8, px = x0 + ux * t + nx * q, py = y0 + uy * t + ny * q, kk = 0.5 + Math.random() * 0.6;
                S.time.delayedCall(at(px, py), () => { if (!S.sys?.isActive()) return; Trident.boom(S, px, py - 4, kk, null); F.dir = [-90, 160]; F.chunk.emitParticleAt(px, py, 1 + Math.floor(kk * 3)); F.dir = null; if (Math.random() < 0.5) Sfx.play(S, 'shatter', { soft: true }); });
            }
            for (const w of sea) if (w.active) S.time.delayedCall(at(w.x, w.y) + 30, () => {   // (the ice collapsing up and onto the line as it's burst)
                if (!w.active) return;
                S.tweens.killTweensOf(w);
                const q = (w.x - x0) * nx + (w.y - y0) * ny, ex = w.x - nx * q * 0.8 + ux * 6, ey = w.y - ny * q * 0.8 + uy * 6;
                let up = 10 + Math.random() * 14; while (up > 0 && S.world[Math.floor(ex / T)]?.[Math.floor((ey - up) / T)] !== S.FLOOR) up -= 2;   // (popping up, never over the wall beside the lane)
                S.tweens.add({ targets: w, x: ex, y: ey - Math.max(0, up), alpha: 0, duration: 160 + Math.random() * 80, ease: 'Quad.easeOut', onComplete: () => w.destroy() });
            });
            S.time.delayedCall(at(x, y) + 60, () => {   // and the biggest at the landing, with the boom
                if (!S.sys?.isActive()) return;
                Trident.boom(S, x, y - 4, big ? 2 : 1.6, null); Sfx.play(S, 'slam'); Sfx.play(S, 'shatter');
                S._vfxFlash?.(x, y - 6, big ? 80 : 64, 0xe8fbff, 260, 0.6);
                S.cameras.main.shake(160, big ? 0.012 : 0.009);
            });
        });
    }
    // RIPTIDE (a perk, once Long Hurl is maxed): a click while the hurl flies and you RIDE ITS WAKE, carried behind it on the rip
    // current at a surfing pace (RIDE_SPEED px a second, eased in) and set down a tile short of where it stops, on free floor (rideLand);
    // it stays stuck there till you arrive, and its Frost Rush starts as you land. Hittable all the way (no i-frames), no dashes, ults, gadgets or swaps (lockActions 'riptide'), the
    // throw's cooldown from the landing. Never out of the room you set off in nor through a sealed door (flyable): at the edge you're
    // set down. Purely a move of yours over the drawn sea: no water anywhere.
    static ride(S) {
        const st = Trident.st(S), o = st.out, p = S.player, now = S.time.now;
        if (!o || o.leg !== 'out' || st.ride || st.leap || !p?.active || S._deathScreenActive) return;
        S._glide = null; S.tweens.killTweensOf(p); S._step = null;
        const off = S.SLIME_Y_OFFSET || 0, room = (S.rooms || []).find(R => S.playerX >= R.x && S.playerX < R.x + R.w && S.playerY >= R.y && S.playerY < R.y + R.h) || null;
        const board = S.add.sprite(p.x, p.y - off + 6, 'fx_trident', 'ride_e_0').setScale(1.5).setDepth(0.99).setAlpha(0.95);
        st.ride = { x: p.x, y: p.y - off, t0: now, room, board, f: null, land: null, trailAt: 0, hx: o.ux, hy: o.uy };
        S.lockActions?.('riptide', ['dash', 'ult', 'gadget', 'swap']);
        Sfx.play(S, 'splash'); Sfx.play(S, 'whoosh', { soft: true });
        Trident.once(S, p.x, p.y - off + 2, 'tri_spray_e', 1.6, 3.3, false); Trident.once(S, p.x, p.y - off + 2, 'tri_spray_s', 1.4, 3.3, false);
    }
    // a frame of the ride: on toward the spot behind the trident (or, once it's stopped, the one rideLand chose); the wave under
    // you, foam and spray left behind
    static surf(S, time, held) {
        const st = S._tri, R = st?.ride, o = st?.out, C = Trident.CFG, T = S.TILE_SIZE, p = S.player;
        if (!R) return;
        if (!p?.active || S._deathScreenActive || !held || time - R.t0 > C.RIDE_MAX) return Trident.unride(S);
        let gx, gy;
        if (R.land) { gx = R.land[0] * T + T / 2; gy = R.land[1] * T + T / 2; }
        else if (o?.leg === 'out') { gx = o.gx - o.ux * C.RIDE_GAP * T; gy = o.gy - o.uy * C.RIDE_GAP * T; }
        else return Trident.unride(S);
        const dt = Math.min(50, S.game.loop.delta || 16) / 1000, dx = gx - R.x, dy = gy - R.y, d = Math.hypot(dx, dy);
        S._glideUntil = time + 120; S._step = null;   // (none of your own steps while you ride)
        if (d > 1) {
            const k = Math.min(1, C.RIDE_SPEED * (0.2 + 0.8 * Math.min(1, (time - R.t0) / C.RIDE_EASE)) * dt / d), nx = R.x + dx * k, ny = R.y + dy * k, tx = Math.floor(nx / T), ty = Math.floor(ny / T);
            if (!Trident.flyable(S, R, tx, ty) || S.world[tx]?.[ty] !== S.FLOOR) { if (R.land) return Trident.unride(S); }   // (the edge: wait there for it to stop, then set down)
            else {
                R.x = nx; R.y = ny; R.hx = dx / d; R.hy = dy / d;
                if ((tx !== S.playerX || ty !== S.playerY) && S._dashCanEnter(tx, ty) && !S.getEnemyAt(tx, ty)) { S.playerX = tx; S.playerY = ty; S._checkRoomNameDisplay?.(); }
            }
        } else if (R.land) return Trident.unride(S);
        const off = S.SLIME_Y_OFFSET || 0, a = Math.atan2(R.hy, R.hx), [f, fx, fy] = Trident.dir(a);
        p.setPosition(R.x, R.y + off - 3);
        if (R.f !== f) { R.f = f; R.board.play({ key: 'tri_ride_' + f, startFrame: R.board.anims?.currentFrame?.index ? 1 : 0 }); }
        R.board.setFlip(!!fx, !!fy).setPosition(R.x - R.hx * 4, R.y + 6 - R.hy * 2);
        if (time >= R.trailAt) {   // foam left on the wake behind you, spray off the sides
            R.trailAt = time + 40;
            const fo = S.add.image(R.x - R.hx * 14 + (Math.random() - 0.5) * 8, R.y + 6 - R.hy * 14 + (Math.random() - 0.5) * 6, 'fx_trident', 'foam_' + Math.floor(Math.random() * 3)).setScale(1.3).setDepth(0.95);
            S.tweens.add({ targets: fo, alpha: 0, delay: 200, duration: 500, onComplete: () => fo.destroy() });
            const sd = Math.random() < 0.5 ? 1 : -1, v = 40 + Math.random() * 50;
            Trident.drop(S, [], R.x - R.hy * sd * 6, R.y + 4 + R.hx * sd * 6, -R.hy * sd * v - R.hx * 30, R.hx * sd * v - R.hy * 30 - 60, 3.2);
        }
    }
    // where the ride sets you down when the throw stops at (x, y): a tile short of it back along the line, or the nearest free floor
    // to that (not a wall, an enemy, the carried heap's spots, nor past the edge you may ride to)
    static rideLand(S, x, y, o, spots) {
        const R = S._tri?.ride;
        if (!R) return;
        const T = S.TILE_SIZE, taken = new Set(spots.map(([a, b]) => a + ',' + b));
        const ok = (a, b) => S.world[a]?.[b] === S.FLOOR && S._dashCanEnter(a, b) && !S.getEnemyAt(a, b) && !taken.has(a + ',' + b) && Trident.flyable(S, R, a, b);
        const x0 = Math.floor((x - o.ux * T) / T), y0 = Math.floor((y - o.uy * T) / T), q = [[x0, y0]], seen = new Set([x0 + ',' + y0]);
        for (let h = 0; h < q.length && h < 200; h++) {
            const [a, b] = q[h];
            if (ok(a, b)) { R.land = [a, b]; return; }
            for (const [da, db] of [[-Math.sign(o.ux), 0], [0, -Math.sign(o.uy)], [1, 0], [-1, 0], [0, 1], [0, -1]]) { const k = (a + da) + ',' + (b + db); if ((da || db) && !seen.has(k)) { seen.add(k); q.push([a + da, b + db]); } }
        }
        R.land = [S.playerX, S.playerY];
    }
    // the ride over, however: set down on free floor (where you are if that's free, else the nearest), a splash, the locks off, and
    // the throw's cooldown from now
    static unride(S) {
        const st = S._tri, R = st?.ride, p = S.player, T = S.TILE_SIZE, now = S.time.now;
        if (!R) return;
        st.ride = null; S.unlockActions?.('riptide');
        R.board.destroy();
        if (R.rush) Trident.rush(S, now + Trident.CFG.RUSH_MS);   // (Frost Rush as you land)
        st.hurlAt = Math.max(st.hurlAt || 0, now + Trident.hurlCd());
        if (!p?.active) return;
        const L = { fx: R.x, fy: R.y, hx: R.hx, hy: R.hy, room: R.room, tile: [S.playerX, S.playerY] }, [tx, ty] = Trident.landAt(S, L), off = S.SLIME_Y_OFFSET || 0;
        S.playerX = tx; S.playerY = ty; S._step = null; S._glideUntil = now; S.lastMoveTime = now;
        p.setPosition(tx * T + T / 2, ty * T + T / 2 + off);
        S._checkRoomNameDisplay?.();
        Trident.once(S, p.x, p.y - off + 2, 'tri_spray_e', 1.5, 3.3, false); Trident.once(S, p.x, p.y - off + 2, 'tri_spray_s', 1.5, 3.3, false);
        Sfx.play(S, 'splash', { soft: true });
    }
    // e sealed in a block of ice till `until` (the pin's daze): it rises round it, holds, cracks and bursts as the daze ends (tick)
    static seal(S, e, until) {
        if (!S.sys?.isActive() || !e.sprite?.active || e.health <= 0) return;
        const spr = S.add.sprite(e.sprite.x, e.sprite.y - 4, 'fx_trident', 'crystal_0').setScale(1.4).setDepth((e.sprite.depth ?? 3) + 0.05).setAlpha(0.88).play('tri_seal');
        Trident.st(S).seals.push({ e, spr, until });
        Trident.fx(S).spark.emitParticleAt(e.sprite.x, e.sprite.y - 4, 4);
    }
    static seals(S, time) {
        const st = S._tri;
        for (let i = st.seals.length - 1; i >= 0; i--) {
            const s = st.seals[i], e = s.e, on = e.sprite?.active && e.health > 0;
            if (on) s.spr.setPosition(e.sprite.x, e.sprite.y - 4);
            if (on && time < s.until - 280) continue;
            st.seals.splice(i, 1);   // (the daze running out, or it died: it cracks and bursts)
            s.spr.play('tri_unseal').once('animationcomplete', () => s.spr.destroy());
            const F = Trident.fx(S); F.dir = [-90, 200]; F.shard.emitParticleAt(s.spr.x, s.spr.y, 5); F.chunk.emitParticleAt(s.spr.x, s.spr.y, 3); F.dir = null;
            Sfx.play(S, 'shatter', { soft: true });
        }
    }
    static catch(S) {
        const st = S._tri, o = st?.out;
        if (!o) return;
        st.out = null;
        for (const e of o.held || []) e._surgeKnockedBack = false;
        o.glow?.destroy(); o.shadow?.destroy(); o.core?.destroy();
        if (st.ride) Trident.unride(S);   // (back in hand however it ended: set down)
        for (const w of o.water || []) w.destroy();
        if (o.spr.active) {
            Trident.fx(S).spark.emitParticleAt(o.spr.x, o.spr.y, 5);
            Trident.once(S, o.spr.x, o.spr.y, 'tri_glint', 1.6, 3.6);
            o.spr.destroy();
        }
        if (S.player?.active) Sfx.play(S, 'tri_catch');   // (it was the clink of a hit glancing off a resistance)
        if (o.rush) st.rushUntil = Math.max(st.rushUntil || 0, S.time.now + Trident.CFG.RUSH_BACK);   // (the rush runs on a while with it back in hand)
    }
    // The rime on frozen tile (x, y) for `life` ms, `weight` 0..1 (denser toward the middle of what froze it): 0 to 3 crystals
    // jittered about the tile, mixed with small spikes and loose shards, now and then a little one out toward the next tile; a bare
    // tile only glints. Seeded by the tile and the cast (st.seed), so a cast always lays the same rime.
    static rimeTile(S, x, y, life, weight) {
        const st = Trident.st(S), T = S.TILE_SIZE, R = n => Trident.hash(x * 7919 + y * 104729 + (st.seed || 0) * 31337 + n * 977), RF = Rimeguard.fx(S);
        const cx = x * T + T / 2, cy = y * T + T / 2, n = Math.max(0, Math.min(3, Math.floor(weight * 2.6 + R(1) * 1.5 - 0.5))), spots = [];
        for (let i = 0; i < n; i++) spots.push([cx + (R(10 + i) - 0.5) * T * 0.85, cy + (R(20 + i) - 0.5) * T * 0.85, R(30 + i) < 0.15 ? 'spike' : 'crys']);
        if (R(5) < 0.1 + 0.3 * weight) { const a = R(6) * Math.PI * 2; spots.push([cx + Math.cos(a) * T * 0.55, cy + Math.sin(a) * T * 0.5, 'shard']); }
        if (!spots.length) { if (R(7) < 0.7) Trident.once(S, cx + (R(8) - 0.5) * T * 0.6, cy + (R(9) - 0.5) * T * 0.5, 'tri_glint', 0.8, 1.06).setAlpha(0.55); return; }
        spots.forEach(([sx, sy, kind], i) => S.time.delayedCall(35 * i, () => {
            if (!S.sys?.isActive()) return;
            if (kind === 'spike') { Rimeguard.spike(S, sx, sy + 4, 0.55 + R(40 + i) * 0.35, 0, true); return; }
            const c = kind === 'shard' ? S.add.image(sx, sy, 'fx_rimeguard', 'shard_' + Math.floor(R(50 + i) * 3)).setScale(1.1 + R(55 + i) * 0.4).setAlpha(0.85)
                : S.add.sprite(sx, sy + 4, 'fx_rimeguard', 'crys_0').setOrigin(0.5, 1).setScale(0.85 + R(60 + i) * 0.75).play('tri_crys');
            c.setFlipX(R(70 + i) < 0.5).setDepth(1.04 + R(80 + i) * 0.01);
            if (R(90 + i) < 0.3) Trident.once(S, sx + (R(95 + i) - 0.5) * 8, sy - 5, 'tri_glint', 0.9, 3.6);
            S.time.delayedCall(life + R(100 + i) * 250, () => {   // cracking, melting away
                if (!c.active) return;
                if (R(110 + i) < 0.5) RF.shard.emitParticleAt(c.x, c.y - 5, 1); if (R(120 + i) < 0.3) RF.mist.emitParticleAt(c.x, c.y - 2, 1);
                S.tweens.add({ targets: c, alpha: 0, scaleY: c.scaleY * 0.6, duration: 380, onComplete: () => c.destroy() });
            });
        }));
    }
    static hash(a) { let t = (a ^ 0x9e3779b9) >>> 0; t = Math.imul(t ^ (t >>> 16), 0x85ebca6b); t = Math.imul(t ^ (t >>> 13), 0xc2b2ae35); return ((t ^ (t >>> 16)) >>> 0) / 4294967296; }

    // ── R: the Frostkin ──
    static r(S) {
        const C = Trident.CFG, st = Trident.st(S), now = S.time.now;
        if (st.charges < C.KIN_COST) {
            Sfx.play(S, 'deny');
            S.showStatusText?.(S.player.x, S.player.y - 34, `FROST ${st.charges}/${C.KIN_COST}: THE COMBO'S HITS CALL FROSTKIN`, '#9fdcff');
            return;
        }
        if (now < st.rAt) return;
        st.rAt = now + 400; st.charges -= C.KIN_COST;
        Trident.feedShell(S);   // (the shell: up to KIN_SHIELD of your max HP till it's broken; a call tops it back up, never above)
        const T = S.TILE_SIZE, F = Trident.fx(S), extra = Trident.perk('pack'), n = C.KIN_N + extra;
        S.showStatusText?.(S.player.x, S.player.y - 34, 'FROSTKIN', '#d8fff4');
        Sfx.play(S, 'frost_shield'); Sfx.play(S, 'spawn');
        Trident.nova(S, S.player.x, S.player.y - 6, 1.4); Trident.ring(S, S.player.x, S.player.y + 2, 1.4);
        const spots = [[1, 0], [-1, 0], [0, -1], [0, 1], [1, -1], [-1, -1], [1, 1], [-1, 1], [2, 0], [-2, 0], [0, 2], [0, -2]]
            .map(([dx, dy]) => [S.playerX + dx, S.playerY + dy]).filter(([x, y]) => Trident.open(S, x, y));
        for (let i = 0; i < n; i++) {
            // the call's own: one of each kind; Frostkin Pack's extras a hail one, then a squall
            const kind = Trident.KIN_ORDER[i < C.KIN_N ? i % 3 : (i - C.KIN_N + 1) % 3], KD = Trident.KINDS[kind], ranged = kind !== 'melee';
            const [x, y] = spots[i] || [S.playerX, S.playerY];
            const k = { kind, ranged, b: { x: x * T + T / 2, y: y * T + T / 2 }, lx: 0, ly: 0, ph: Math.random() * 6, stepAt: now + 250 + i * 60, nipAt: now + 400 + (ranged ? 300 : 0), e: null, goal: null };
            k.spr = S.add.sprite(k.b.x, k.b.y - 10, 'fx_trident', KD.look + '_idle_0').setScale(0.2).setDepth(3.3).play(`tri_${KD.look}_idle`);
            k.glow = S.add.image(k.b.x, k.b.y + 4, 'vfx_glow').setTint(KD.tint).setBlendMode(Phaser.BlendModes.ADD).setDepth(0.9).setScale(0.22).setAlpha(0.5);
            k.bar = S.add.graphics().setDepth(5);
            S.tweens.add({ targets: k.spr, scale: 1.25, duration: 240, delay: i * 60, ease: 'Back.easeOut' });
            S.time.delayedCall(i * 60, () => { if (!S.sys?.isActive()) return; Trident.once(S, k.b.x, k.b.y - 10, 'tri_glint', 2, 3.35); Trident.mist(S, k.b.x, k.b.y + 2, 2, T * 0.7); });
            F.dir = null; F.spark.emitParticleAt(k.b.x, k.b.y - 10, 6); F.shard.emitParticleAt(k.b.x, k.b.y - 6, 3);
            const hp = C[KD.hp] * (S.maxHealth || 100);
            k.ally = S._addAlly({ x, y, hp, maxHp: hp, taunt: C[KD.taunt], until: Infinity,
                hurt: amt => Trident.kinHurt(S, k, amt), onEnd: () => Trident.kinEnd(S, k) });
            st.kin.push(k);
        }
        // at most KIN_CAP of them: the oldest shatter away to make room
        const live = st.kin.filter(o => !o.gone);
        for (let j = 0; j < live.length - C.KIN_CAP; j++) { live[j].gone = true; live[j].ally.until = 0; }
        Trident.bar(S);
    }
    // A hit on a Frostkin (a taunted enemy's, CombatSystem.takeDamage): KIN_STATS of your defence is theirs: of the damage reduction
    // you have (damageReductionMultiplier), your armour (statTakenMult) and Bulwark on what you hold (Enchants.taken); Bedrock caps a
    // hit at a fifth of its HP over KIN_STATS
    static kinHurt(S, k, amt) {
        const a = k.ally, share = Trident.CFG.KIN_STATS;
        amt *= 1 - share * (1 - (S.damageReductionMultiplier ?? 1) * (S.statTakenMult ?? 1) * Enchants.taken(S.equippedWeapons?.[S.currentElement]));
        if (S._tal?.has?.has('bedrock')) amt = Math.min(amt, a.maxHp * 0.2 / share);
        if (!(amt > 0)) return;
        a.hp -= amt;
        if (k.spr.active) {
            k.spr.setTintFill(0xffffff); S.time.delayedCall(70, () => k.spr.active && k.spr.clearTint());
            S._vfxDamageNumber?.(k.spr.x, k.spr.y - 8, amt, '#ff8a9a');
        }
    }
    static open(S, x, y, self) {
        return S.world?.[x]?.[y] === S.FLOOR && !S.getEnemyAt(x, y) && !(x === S.playerX && y === S.playerY) && !S.isInLockedRoom?.(x, y)
            && !(S._tri?.kin || []).some(k => k !== self && k.ally.alive && k.ally.x === x && k.ally.y === y);
    }
    // a clear line from tile (x0, y0) to (x1, y1): floor all the way
    static clear(S, x0, y0, x1, y1) {
        const n = Math.ceil(Math.hypot(x1 - x0, y1 - y0) * 2);
        for (let i = 1; i < n; i++) if (S.world[Math.round(x0 + (x1 - x0) * i / n)]?.[Math.round(y0 + (y1 - y0) * i / n)] !== S.FLOOR) return false;
        return true;
    }
    // what a Frostkin's hit is scaled by: KIN_STATS of your damage bonus (the hit itself then takes all of it, _dmgOutMult)
    static kinPow(S, e = null) {
        const m = S._dmgOutMult?.(e, 'ice') || 1;
        return (1 + Trident.CFG.KIN_STATS * (m - 1)) / m;
    }
    static kinEnd(S, k) {
        const st = S._tri, i = st ? st.kin.indexOf(k) : -1;
        if (st && i < 0) return;   // (already gone: a second onEnd mustn't take another one with it)
        if (st) st.kin.splice(i, 1);
        S.tweens.killTweensOf([k, k.spr, k.b]);
        k.glow?.destroy(); k.bar?.destroy();
        if (!k.spr.active) return;
        k.spr.setScale(1.25).clearTint().play(`tri_${Trident.KINDS[k.kind].look}_die`);
        Trident.fx(S).shard.emitParticleAt(k.spr.x, k.spr.y, 4);
        Sfx.play(S, 'shatter', { soft: true });
        k.spr.once('animationcomplete', () => k.spr.destroy());
    }
    // something a Frostkin will go for: alive, here, in this room, and hurt by ice
    static prey(S, e) { return !!(e?.sprite?.active && e.health > 0 && !S._phasedOut?.(e) && S.isInCurrentRoom(e.x, e.y) && !e.iceImmune); }
    // A route from tile (x0, y0): breadth-first, eight ways (no cutting a wall's corner), R tiles out at most, round what `blocked`
    // says, to the nearest tile `goal` takes. { step: the first step or null if it's there, goal: [x, y] }, or null.
    static route(S, x0, y0, goal, blocked, R = 14) {
        if (goal(x0, y0)) return { step: null, goal: [x0, y0] };
        const W = 2 * R + 1, o = R * W + R, from = new Int32Array(W * W).fill(-1), q = [o];
        from[o] = o;
        for (let h = 0; h < q.length; h++) {
            const c = q[h], cx = ((c / W) | 0) - R + x0, cy = (c % W) - R + y0;
            for (const [dx, dy] of Trident.D8) {
                const nx = cx + dx, ny = cy + dy, ix = nx - x0 + R, iy = ny - y0 + R;
                if (ix < 0 || iy < 0 || ix >= W || iy >= W) continue;
                const n = ix * W + iy;
                if (from[n] >= 0 || blocked(nx, ny)) continue;
                if (dx && dy && (S.world[cx + dx]?.[cy] !== S.FLOOR || S.world[cx]?.[cy + dy] !== S.FLOOR)) continue;
                from[n] = c;
                if (goal(nx, ny)) { let s = n; while (from[s] !== o) s = from[s]; return { step: [((s / W) | 0) - R, (s % W) - R], goal: [nx, ny] }; }
                q.push(n);
            }
        }
        return null;
    }
    static D8 = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]];
    // The Frostkin, a frame. Each keeps its target till it dies or can't be reached. A melee one claims a free tile of its own next
    // to it, a seer a spot of its own SEER_MIN to SEER_MAX tiles off with a clear line, and each walks there by a real route
    // (round walls, water, enemies, you and each other); there, the melee one nips, the seer calls hail. With no target it can
    // reach it takes the nearest one it can, and with none it keeps by you or holds where it is (never a step and straight back).
    // HP follows your max HP (the same share); a bar over each.
    static kinTick(S, time) {
        const st = S._tri;
        if (st?.hails.length) Trident.hails(S, time);
        if (!st?.kin.length) return;
        const C = Trident.CFG, T = S.TILE_SIZE, F = Trident.fx(S), ds = S.damageScaling || 1, K = (x, y) => x * 4096 + y;
        const occ = new Set([K(S.playerX, S.playerY)]);
        for (const e of S.enemies || []) if (e.sprite?.active && e.health > 0) occ.add(K(e.x, e.y));
        const kinAt = new Map(), claims = new Map();
        for (const k of st.kin) if (k.ally.alive && !k.gone) { kinAt.set(K(k.ally.x, k.ally.y), k); if (k.goal) claims.set(K(...k.goal), k); }
        for (const k of [...st.kin]) {
            const a = k.ally;
            if (!a.alive || !k.spr.active || k.gone) continue;
            const KD = Trident.KINDS[k.kind], max = C[KD.hp] * (S.maxHealth || 100);   // (your max HP changed: the same share of it)
            if (a.maxHp !== max) { a.hp *= max / (a.maxHp || max); a.maxHp = max; }
            const bob = Math.sin(time * 0.007 + k.ph) * 1.5;
            k.spr.setPosition(k.b.x + k.lx, k.b.y - 10 + k.ly + bob);
            k.glow.setPosition(k.b.x, k.b.y + 5).setAlpha(0.4 + 0.1 * Math.sin(time * 0.01 + k.ph));
            k.bar.clear().fillStyle(0x06121e, 0.75).fillRect(k.b.x - 10, k.b.y - 28, 20, 3).fillStyle(KD.tint, 1).fillRect(k.b.x - 10, k.b.y - 28, 20 * Math.max(0, a.hp) / a.maxHp, 3);
            if (Math.random() < 0.08) F.mote.emitParticleAt(k.spr.x + (Math.random() - 0.5) * 10, k.spr.y + 4, 1);
            if (!k.ranged && time - (k.auraAt ??= time) >= C.BITE_TICK) {   // its aura: KIN_CHILL stacks a second on what's within KIN_AURA tiles, frost motes drifting round it
                const dt = Math.min(500, time - k.auraAt), r = C.KIN_AURA * T; k.auraAt = time;
                for (const e of S.enemies || []) if (Math.hypot(e.x - a.x, e.y - a.y) <= C.KIN_AURA) S.applyChill(e, C.KIN_CHILL * dt / 1000 / S._chillCfg().RATE);
                for (let n = Math.floor(dt / 1000 * 6 + Math.random()); n > 0; n--) {
                    const ang = Math.random() * Math.PI * 2, rr = r * (0.55 + Math.random() * 0.45);
                    F.dir = [ang * 180 / Math.PI + 90, 30];
                    F.mote.emitParticleAt(k.b.x + Math.cos(ang) * rr, k.b.y + Math.sin(ang) * rr * 0.9, 1);
                }
                F.dir = null;
            }
            if (Math.hypot(a.x - S.playerX, a.y - S.playerY) > 12) {   // left far behind: it blinks to you
                const s = [[1, 1], [-1, 1], [1, -1], [-1, -1], [1, 0], [-1, 0]].map(([dx, dy]) => [S.playerX + dx, S.playerY + dy]).find(([x, y]) => Trident.open(S, x, y, k));
                if (s) { F.spark.emitParticleAt(k.spr.x, k.spr.y, 5); kinAt.delete(K(a.x, a.y)); a.x = s[0]; a.y = s[1]; kinAt.set(K(a.x, a.y), k); k.b.x = a.x * T + T / 2; k.b.y = a.y * T + T / 2; k.e = null; k.goal = null; }
                continue;
            }
            if (k.e && !Trident.prey(S, k.e)) { k.e = null; k.goal = null; }
            // in place: the melee one beside it nips, the hail one in its band calls hail, the squall in its band blows
            const e = k.e;
            if (k.blowAt) { if (time >= k.blowAt) Trident.gust(S, k); continue; }   // (breathing in: it holds still)
            if (e && Trident.post(S, k, a.x, a.y, e)) {
                k.spr.setFlipX(e.x < a.x);
                if (k.kind === 'hail') { if (time >= k.nipAt) Trident.hail(S, k, e, time); }
                else if (k.kind === 'squall') { if (time >= k.nipAt) Trident.inhale(S, k, e, time); }
                else if (time >= k.nipAt) {   // a nip: lunge, bite, back
                    k.nipAt = time + C.KIN_NIP;
                    k.spr.play('tri_kin_nip');
                    k.spr.once('animationcomplete', () => k.spr.active && k.spr.play('tri_kin_idle'));
                    S.tweens.add({ targets: k, lx: (e.x - a.x) * 7, ly: (e.y - a.y) * 7, duration: 70, yoyo: true, ease: 'Quad.easeOut' });
                    Trident.hit(S, e, C.KIN_DMG * ds * Trident.kinPow(S, e), 0);
                    if (e.sprite?.active) { Trident.burst(S, e.sprite.x, e.sprite.y - 6, 0.6); F.dir = [Math.atan2(e.y - a.y, e.x - a.x) * 180 / Math.PI, 80]; F.spark.emitParticleAt(e.sprite.x, e.sprite.y - 6, 3); F.dir = null; }
                    Sfx.play(S, 'w_ice_fists', { soft: true });
                }
                continue;
            }
            if (time < k.stepAt) continue;
            k.stepAt = time + (k.ranged ? C.SEER_STEP : C.KIN_STEP);
            const blocked = (x, y) => S.world[x]?.[y] !== S.FLOOR || S.isWaterAt?.(x, y) || S.isInLockedRoom?.(x, y) || occ.has(K(x, y)) || (kinAt.get(K(x, y)) || k) !== k;
            const spot = t => (x, y) => (claims.get(K(x, y)) || k) === k && Trident.post(S, k, x, y, t);
            let r = e ? Trident.route(S, a.x, a.y, spot(e), blocked) : null;
            if (!r) {   // its target out of reach (or none): the nearest it can reach, the ones fewest kin are on first
                k.e = null;
                const on = t => st.kin.filter(o => o !== k && o.e === t).length;
                const cands = (S.enemies || []).filter(t => Trident.prey(S, t) && Math.hypot(t.x - a.x, t.y - a.y) <= C.KIN_SEEK + 4)
                    .sort((p, q) => Math.hypot(p.x - a.x, p.y - a.y) + 2 * on(p) - Math.hypot(q.x - a.x, q.y - a.y) - 2 * on(q)).slice(0, 4);
                for (const t of cands) if ((r = Trident.route(S, a.x, a.y, spot(t), blocked))) { k.e = t; break; }
                if (!r && Math.hypot(S.playerX - a.x, S.playerY - a.y) > 2) r = Trident.route(S, a.x, a.y, (x, y) => (claims.get(K(x, y)) || k) === k && Math.hypot(x - S.playerX, y - S.playerY) <= 2, blocked);
            }
            if (k.goal) claims.delete(K(...k.goal));
            k.goal = r?.goal || null;
            if (k.goal) claims.set(K(...k.goal), k);
            if (!r?.step) {   // there, or nowhere to go: it holds where it is
                const idle = `tri_${KD.look}_idle`, cur = k.spr.anims.currentAnim?.key;
                if (cur !== idle && cur !== 'tri_seer_cast' && cur !== 'tri_kin_nip' && cur !== 'tri_squall_blow') k.spr.play(idle);
                continue;
            }
            const ox = k.b.x, oy = k.b.y;
            kinAt.delete(K(a.x, a.y)); a.x += r.step[0]; a.y += r.step[1]; kinAt.set(K(a.x, a.y), k);
            if (r.step[0]) k.spr.setFlipX(r.step[0] < 0);
            if (!k.ranged && k.spr.anims.currentAnim?.key !== 'tri_kin_dart') k.spr.play('tri_kin_dart');
            const dur = (k.ranged ? C.SEER_STEP : C.KIN_STEP) * 0.9;
            S.tweens.add({ targets: k.b, x: a.x * T + T / 2, y: a.y * T + T / 2, duration: dur, ease: 'Sine.easeInOut' });
            if (!k.ranged) Trident.wake(S, ox, oy - 8, a.x * T + T / 2, a.y * T + T / 2 - 8, 1, 1);
        }
    }
    // the three kinds: their look (frames look_*), HP share, pull, pace, colour, and (the two that keep off) how far off
    static KIN_ORDER = ['melee', 'hail', 'squall'];
    static KINDS = { melee: { look: 'kin', hp: 'KIN_HP', taunt: 'KIN_TAUNT', tint: 0x7fd0ff }, hail: { look: 'seer', hp: 'SEER_HP', taunt: 'SEER_TAUNT', tint: 0xd8fff4, min: 'SEER_MIN', max: 'SEER_MAX' },
        squall: { look: 'squall', hp: 'SQUALL_HP', taunt: 'SEER_TAUNT', tint: 0xa8ffe0, min: 'SQUALL_MIN', max: 'SQUALL_MAX' } };
    // where kin k can do its work on e from tile (x, y): a melee one beside it; the others their min to max tiles off with a clear line
    static post(S, k, x, y, e) {
        const KD = Trident.KINDS[k.kind], C = Trident.CFG;
        if (!KD.min) return Math.max(Math.abs(e.x - x), Math.abs(e.y - y)) <= 1;
        const d = Math.hypot(e.x - x, e.y - y); return d >= C[KD.min] - 0.5 && d <= C[KD.max] + 0.5 && Trident.clear(S, x, y, e.x, e.y);
    }
    // A hail kin's HAIL on e: its shard raised and flaring, a ring of frost forming over the 3x3 tiles round e (HAIL_TELL), then
    // a spear of ice driven down on each of the nine (HAIL_GAP apart, in a shuffled order, the middle one last and heaviest),
    // each striking what's on its tile (hails, shard)
    static hail(S, k, e, time) {
        const C = Trident.CFG, T = S.TILE_SIZE;
        k.nipAt = time + C.SEER_CD;
        k.spr.play('tri_seer_cast').once('animationcomplete', () => k.spr.active && k.spr.play('tri_seer_idle'));
        Trident.once(S, k.spr.x + (k.spr.flipX ? -9 : 9), k.spr.y - 4, 'tri_glint', 1.6, 3.55);   // (its shard raised, flaring)
        const tiles = [[-1, -1], [0, -1], [1, -1], [-1, 0], [1, 0], [-1, 1], [0, 1], [1, 1]].map(([dx, dy]) => [e.x + dx, e.y + dy]);
        for (let i = tiles.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [tiles[i], tiles[j]] = [tiles[j], tiles[i]]; }
        tiles.push([e.x, e.y]);   // (the middle last)
        Trident.once(S, e.x * T + T / 2, e.y * T + T / 2 + 2, 'tri_tell', 3.6, 0.97).setAlpha(0.8);
        S._tri.hails.push({ tiles: tiles.filter(([x, y]) => S.world[x]?.[y] === S.FLOOR), at: time + C.HAIL_TELL, n: 0 });
        Sfx.play(S, 'w_icicle_cannon', { soft: true });
    }
    static hails(S, time) {
        const st = S._tri, C = Trident.CFG;
        for (let i = st.hails.length - 1; i >= 0; i--) {
            const h = st.hails[i];
            while (h.n < h.tiles.length && time >= h.at + h.n * C.HAIL_GAP) { Trident.shard(S, h.tiles[h.n], h.n === h.tiles.length - 1); h.n++; }
            if (h.n >= h.tiles.length) st.hails.splice(i, 1);
        }
    }
    // a spear of ice driven down at a steep slant (all from up-left, wind-driven: the typed spear frames, no turning) onto tile
    // (tx, ty), a long streak and a short afterimage behind it; its shadow growing on the tile under it as it comes
    static shard(S, [tx, ty], last) {
        const C = Trident.CFG, T = S.TILE_SIZE, x = tx * T + T / 2, y = ty * T + T / 2 + 4, H = 96, k = last ? 2 : 1.5;
        const spot = S.add.sprite(x, y, 'fx_trident', 'spot_0').setScale(last ? 2 : 1.6).setDepth(0.93).setAlpha(0.6);
        S.tweens.add({ targets: spot, alpha: 0.75, duration: C.HAIL_FALL });
        S.time.delayedCall(C.HAIL_FALL * 0.5, () => spot.active && spot.setFrame('spot_1'));
        const s = S.add.sprite(x - H * 0.4, y - H, 'fx_trident', 'spear_0').setOrigin(10 / 12, 29.5 / 30).setScale(k).setDepth(3.5).play('tri_spear');
        S.time.delayedCall(C.HAIL_FALL * 0.45, () => {   // (an afterimage of it, a beat behind)
            if (!s.active) return;
            const g = S.add.image(s.x, s.y, 'fx_trident', 'spear_1').setOrigin(10 / 12, 29.5 / 30).setScale(k).setDepth(3.49).setTint(0x9fe4ff).setBlendMode(Phaser.BlendModes.ADD).setAlpha(0.45);
            S.tweens.add({ targets: g, alpha: 0, duration: 120, onComplete: () => g.destroy() });
        });
        S.tweens.add({ targets: s, x, y, duration: C.HAIL_FALL, ease: 'Quad.easeIn', onComplete: () => { spot.setFrame('spot_2'); if (S.sys?.isActive()) Trident.hailHit(S, tx, ty, s, spot, last); else { s.destroy(); spot.destroy(); } } });
    }
    // where a spear lands: HAIL_DMG (the middle one HAIL_MID) and a ninth of HAIL_CHILL of a splash's chill to what's on its tile,
    // which flinches (a pixel or two, no knockback). It slams in: a white-blue flash, a shockwave ring, the spear stuck in the floor a
    // moment before it shatters into chunks thrown on along the slant, a crack left in the floor a second; the middle one bigger, a
    // hitstop and a shake
    static hailHit(S, tx, ty, spr, spot, last) {
        const C = Trident.CFG, T = S.TILE_SIZE, ds = S.damageScaling || 1, chill = S._chillCfg().SPLASH * C.HAIL_CHILL / 9, x = tx * T + T / 2, y = ty * T + T / 2 + 4, dmg = (last ? C.HAIL_MID : C.HAIL_DMG) * ds;
        for (const e of [...(S.enemies || [])]) {
            if (!e.sprite?.active || e.health <= 0 || S._phasedOut?.(e) || e.x !== tx || e.y !== ty) continue;
            Trident.hit(S, e, dmg * Trident.kinPow(S, e), chill);
            if (e.sprite?.active && !S.tweens.isTweening(e.sprite)) S.tweens.add({ targets: e.sprite, x: e.sprite.x + (last ? 2 : 1), y: e.sprite.y + (last ? 2 : 1), duration: 45, yoyo: true });   // (a flinch)
        }
        S.damageBossAtTile?.(tx, ty, dmg * Trident.kinPow(S), undefined, 'ice');
        S._vfxFlash?.(x, y - 4, last ? 40 : 26, 0xd8fff4, 180, last ? 0.5 : 0.32);
        Trident.nova(S, x, y - 3, last ? 1.3 : 0.8);
        Trident.ring(S, x, y, last ? 1.3 : 0.75);
        spr.setPosition(x, y + 3);   // (driven into the floor a moment)
        S.time.delayedCall(last ? 140 : 90, () => {
            if (!S.sys?.isActive()) { spr.destroy(); return; }
            const RF = Rimeguard.fx(S); RF.dir = [-55, 50];
            RF.shard.emitParticleAt(x, y - 6, last ? 7 : 3);
            Trident.fx(S).dir = [-55, 50]; Trident.fx(S).chunk.emitParticleAt(x, y - 4, last ? 6 : 3); Trident.fx(S).dir = null; RF.dir = null;
            spr.destroy();
        });
        S.tweens.add({ targets: spot, alpha: 0, duration: 260, onComplete: () => spot.destroy() });
        const c = S.add.image(x, y - 1, 'fx_trident', last ? 'crater_1' : 'crater_0').setScale(last ? 1.8 : 1.4).setDepth(0.94).setAlpha(0.85).setFlipX(Math.random() < 0.5);
        S.tweens.add({ targets: c, alpha: 0, duration: 400, delay: 800, onComplete: () => c.destroy() });
        Sfx.play(S, 'shatter', { soft: true });
        if (last) { Sfx.play(S, 'slam', { small: true }); Glaive.hitstop(S, 35); S.cameras.main.shake(80, 0.004); }
    }
    // A squall's breath in (SQUALL_TELL): puffed up, frost drawn in to it; then the gust (kinTick calls gust when it's done)
    static inhale(S, k, e, time) {
        const C = Trident.CFG, F = Trident.fx(S);
        k.nipAt = time + C.SQUALL_TELL + C.SQUALL_CD; k.blowAt = time + C.SQUALL_TELL; k.blowAt0 = [e.x, e.y];
        k.spr.play('tri_squall_tell');
        for (let i = 0; i < 6; i++) { const a = i / 6 * Math.PI * 2; F.dir = [a * 180 / Math.PI + 180, 10]; F.mote.emitParticleAt(k.spr.x + Math.cos(a) * 16, k.spr.y + Math.sin(a) * 12, 1); }
        F.dir = null;
        Sfx.play(S, 'whoosh', { soft: true });
    }
    // The GUST: a band SQUALL_W tiles wide from the squall toward its target, SQUALL_RANGE tiles long (short of a wall), through
    // everything in it: SQUALL_DMG and Frostbite, a frost mark popping on each one; no push. Curls of wind and snow fill the band.
    static gust(S, k) {
        const C = Trident.CFG, T = S.TILE_SIZE, a = k.ally, F = Trident.fx(S), ds = S.damageScaling || 1;
        k.blowAt = 0;
        if (!a.alive || !k.spr.active) return;
        const [tx, ty] = k.e?.sprite?.active ? [k.e.x, k.e.y] : k.blowAt0, aim = Math.atan2(ty - a.y, tx - a.x), ux = Math.cos(aim), uy = Math.sin(aim);
        let reach = C.SQUALL_RANGE;
        for (let d = 0.5; d <= C.SQUALL_RANGE; d += 0.25) if (S.world[Math.round(a.x + ux * d)]?.[Math.round(a.y + uy * d)] !== S.FLOOR) { reach = d - 0.25; break; }
        for (const e of [...(S.enemies || [])]) {
            if (!e.sprite?.active || e.health <= 0 || S._phasedOut?.(e) || !S.isInCurrentRoom(e.x, e.y)) continue;
            const dx = e.x - a.x, dy = e.y - a.y, along = dx * ux + dy * uy, across = Math.abs(dy * ux - dx * uy);
            if (along < 0.4 || along > reach + 0.3 || across > C.SQUALL_W / 2) continue;
            if (Trident.hit(S, e, C.SQUALL_DMG * ds * Trident.kinPow(S, e), 0) !== true) continue;
            Trident.bite(S, e, C.BITE_MS);
            if (e.sprite?.active) { const m = S.add.image(e.sprite.x, e.sprite.y - 20, 'fx_trident', 'bite_1').setScale(0.4).setDepth(4.6); S.tweens.add({ targets: m, scale: 1.6, duration: 140, ease: 'Back.easeOut', onComplete: () => S.tweens.add({ targets: m, alpha: 0, y: m.y - 6, duration: 360, delay: 200, onComplete: () => m.destroy() }) }); }
        }
        const cells = [];
        for (let d = 1; d <= reach; d += 0.5) for (const w of [-1.5, -0.5, 0.5, 1.5]) cells.push([Math.round(a.x + ux * d - uy * w), Math.round(a.y + uy * d + ux * w)]);
        Trident.tiles(S, cells, C.SQUALL_DMG * ds * Trident.kinPow(S));
        // the look: it blows; curls of wind sweep down the band, rows of them across its width, snow driven along it
        k.spr.setFlipX(ux < 0).play('tri_squall_blow').once('animationcomplete', () => k.spr.active && k.spr.play('tri_squall_idle'));
        Sfx.play(S, 'whoosh'); Sfx.play(S, 'frost_shield', { soft: true });
        const i8 = Math.round(aim / (Math.PI / 4)), [f, fx, fy] = Trident.DIRS[((i8 % 8) + 8) % 8], x0 = a.x * T + T / 2, y0 = a.y * T + T / 2, deg = aim * 180 / Math.PI;
        for (let d = 0.8; d <= reach; d += 1.2) for (const w of [-1.5, -0.5, 0.5, 1.5]) S.time.delayedCall(40 * d + Math.random() * 40, () => {
            if (!S.sys?.isActive()) return;
            const px = x0 + (ux * d - uy * w) * T, py = y0 + (uy * d + ux * w) * T - 6;
            const g = S.add.image(px, py, 'fx_trident', 'gust_' + f).setFlip(!!fx, !!fy).setScale(1.5).setBlendMode(Phaser.BlendModes.ADD).setDepth(3.32).setAlpha(0.9);
            S.tweens.add({ targets: g, x: px + ux * T * 1.4, y: py + uy * T * 1.4, alpha: 0, duration: 300, ease: 'Sine.easeOut', onComplete: () => g.destroy() });
            F.dir = [deg, 12]; F.spark.emitParticleAt(px + (Math.random() - 0.5) * T, py + (Math.random() - 0.5) * T, 1); F.mote.emitParticleAt(px, py, 1); F.dir = null;
        });
    }
    // A shot's step this frame, times this: SLOW inside your aura while you hold the trident, else 1 (every enemy shot reads it).
    // A slowed shot frosts over and trails ice.
    static slow(S, x, y) {
        const a = S._triAura;
        if (!a || (x - a.x) ** 2 + (y - a.y) ** 2 > a.r2) return 1;
        (S._triSlowAt ||= []).push(x, y);   // (coldShots shows it, from tick)
        return a.k;
    }

    // Every frame: the press (a held click draws it back; let go, it's thrown), the leap, the throw, Frostbite growing, the
    // seals, the Frostkin, the aura, the frost on the trident in your hand and the bars
    static tick(S, time) {
        time = S.time.now;   // (every stamp here is the scene clock's)
        const st = S._tri || (Trident.held(S) && S.player?.active ? Trident.st(S) : null);
        if (!st) { S._triAura = null; if (S._triBar) Trident.bar(S); return; }
        if (st.locked && !st.leap) { st.locked = false; S.unlockActions?.('trident_leap'); }   // (the leap's over, however it ended)
        const C = Trident.CFG, T = S.TILE_SIZE, held = Trident.held(S) && S.player?.active && !S._deathScreenActive;
        const p = st.press;
        if (p && (!S.isPointerDown || !held)) {   // let go
            st.press = null;
            if (p.drawn && held && !st.out) Trident.hurl(S, Trident.aim(S), Math.min(1, (time - p.at - C.HOLD_MS) / (C.FULL_MS - C.HOLD_MS)));
            else if (!p.stab && !p.land && held) st.buffer = time;   // (a tap: the combo's next hit now, or as soon as it's ready)
        } else if (p && !p.stab && !p.drawn) {
            if (st.leap) { if (!p.ready) { p.land = true; st.leap.land = true; } }   // (a click in the air: come down)
            else if (!p.ready && time - p.at < C.HOLD_MS) Trident.stab(S);   // (the throw coming back round: a press stabs at once)
        }
        if (st.buffer && (time - st.buffer < 250 || time <= (st.holdCombo || 0)) && !st.press && Trident.stab(S)) st.buffer = 0;   // (a leap held through a dash keeps its press)
        if (p && st.press && !p.land && !st.out && !st.leap && time - p.at >= C.HOLD_MS && time >= (st.hurlAt || 0)) p.drawn = true;
        Trident.air(S, time);
        Trident.draw(S, time);
        Trident.fly(S, time);
        if (st.ride) Trident.surf(S, time, held);
        // Frostbite: the chill growing on its own till it cubes
        const RATE = S._chillCfg().RATE;
        for (const e of [...st.bitten]) {
            if (!e.sprite?.active || e.health <= 0 || e._iceCube || e.isFrozen || time >= e._tbUntil) { Trident.unbite(st, e); continue; }
            if (time - e._tbAt >= C.BITE_TICK) {
                const dt = Math.min(500, time - e._tbAt); e._tbAt = time;
                S.applyChill(e, Trident.grow() * dt / 1000 / RATE);
                if (Math.random() < 0.3) Trident.fx(S).mote.emitParticleAt(e.sprite.x + (Math.random() - 0.5) * 14, e.sprite.y - 2, 1);
            }
        }
        if (st.seals.length) Trident.seals(S, time);
        Trident.churn(S, time);
        Trident.armour(S, time);
        Trident.coldShots(S, time);
        for (const e of st.marked) {   // Rime marks: on the enemy, gone when they run out
            if (!e.sprite?.active || e.health <= 0 || time >= e._rmUntil) Trident.unmark(S, e);
            else if (e._rmIcon?.active) e._rmIcon.setX(e.sprite.x);
        }
        if (st.rushUntil && time >= st.rushUntil) {   // the rush running out: it fizzles off the tines
            st.rushUntil = 0;
            if (held) { const F = Trident.fx(S), tip = CreatureFX.gearTip?.(S) || { x: S._shotX(), y: S._shotY() }; F.dir = [-90, 160]; F.mote.emitParticleAt(tip.x, tip.y, 6); F.spark.emitParticleAt(tip.x, tip.y, 4); F.dir = null; Sfx.play(S, 'clink', { soft: true }); }
        }
        if (st.hurlAt && time >= st.hurlAt) {   // the throw ready again: a ping, frost off you, the bar lit
            st.hurlAt = 0;
            if (held) { Sfx.play(S, 'ready', { soft: true }); Trident.fx(S).spark.emitParticleAt(S._shotX(), S._shotY() - 8, 6); if (S._triBar) S._triBar.ping = time; }
        }
        Trident.kinTick(S, time);
        Trident.aura(S, time, held);
        Trident.hand(S, time, held);
        Trident.bar(S);
    }
    // The aura: shots near you slowed; round you the ice ult's frost haze (ElementSystem._iceFrostBegin, the same recipe, a touch
    // fainter): soft puffs of icy mist drifting round within its reach, denser near you; snow falling all through it; frost
    // mist curling and snow settling along its edge, where the cold reaches
    static aura(S, time, held) {
        const st = S._tri, C = Trident.CFG, T = S.TILE_SIZE;
        const on = held && !(S._iceShellUntil > time);
        if (!on) {
            S._triAura = null;
            if (st.aura) { st.aura.puffs.forEach(p => p.img.destroy()); st.aura.snow.destroy(); st.aura.rim.destroy(); st.aura.rimSnow.destroy(); st.aura = null; }
            return;
        }
        const r = (C.AURA + C.AURA_UP * Trident.perk('aura')) * T, x = S._shotX(), y = S._shotY();
        S._triAura = { x, y, r2: r * r, k: C.SLOW };
        if (!st.aura) {
            WeaponSystem.iceArt(S); Rimeguard.st(S);
            const A = st.aura = { r, puffs: Array.from({ length: 22 }, (_, i) => ({ img: S.add.image(0, 0, 'vfx_glow').setTint(i % 3 ? 0xb8dcf0 : 0xe8f6ff).setDepth(0.9),
                a: Math.random() * Math.PI * 2, d: Math.sqrt(Math.random()), spin: (Math.random() - 0.5) * 0.0008, s: 0.7 + Math.random() * 0.6 })) };
            const zone = rim => ({ getRandomPoint: v => { const a = Math.random() * Math.PI * 2, d = A.r * (rim ? 0.93 + Math.random() * 0.12 : Math.sqrt(Math.random())); v.x = Math.cos(a) * d; v.y = Math.sin(a) * d * 0.8; return v; } });
            A.snow = S.add.particles(0, 0, 'fx_ice_w', { frame: ['flake_0', 'flake_1', 'flake_2'], lifespan: 1600, speedX: { min: -10, max: 10 }, speedY: { min: 4, max: 18 }, scale: { start: 1.3, end: 0.7 },
                alpha: { start: 0.6, end: 0 }, color: [0xffffff, 0xbff0ff, 0x7fc8ff], frequency: 80, emitZone: { type: 'random', source: zone(false) } }).setDepth(4.9);
            A.rim = S.add.particles(0, 0, 'fx_rimeguard', { frame: ['mist_0', 'mist_1'], lifespan: { min: 700, max: 1200 }, speed: { min: 4, max: 14 }, scale: { start: 1.4, end: 2.2 },
                alpha: { start: 0.12, end: 0 }, color: [0xbfeaff, 0x6fb8e8, 0x2a5a8a], blendMode: 'ADD', frequency: 40, emitZone: { type: 'random', source: zone(true) } }).setDepth(0.95);
            A.rimSnow = S.add.particles(0, 0, 'fx_ice_w', { frame: ['flake_0', 'flake_1', 'flake_2'], lifespan: { min: 500, max: 900 }, speed: { min: 6, max: 24 }, scale: { start: 1.4, end: 0.6 },
                alpha: { start: 0.7, end: 0 }, color: [0xffffff, 0xbff0ff, 0x7fc8ff], frequency: 35, emitZone: { type: 'random', source: zone(true) } }).setDepth(4.85);
        }
        const A = st.aura, px = S.player.x, py = S.player.y;
        A.r = r;
        for (const p of A.puffs) {
            p.a += p.spin * 16;
            const sz = (r / T) * 0.55 * p.s + 0.6;
            p.img.setPosition(px + Math.cos(p.a) * p.d * r, py + Math.sin(p.a) * p.d * r * 0.8).setScale(sz * (0.9 + 0.1 * Math.sin(time * 0.002 + p.a))).setAlpha(0.8 * 0.035 * (1.1 - p.d * 0.4));
        }
        A.snow.setPosition(px, py); A.rim.setPosition(px, py); A.rimSnow.setPosition(px, py);
    }
    // FROST RUSH till `until`: a crisp start (a chime, the words, a flash of frost on you)
    static rush(S, until) {
        const st = Trident.st(S), was = (st.rushUntil || 0) > S.time.now;
        st.rushUntil = Math.max(st.rushUntil || 0, until);
        if (was || !S.player?.active || !Trident.held(S)) return;
        Sfx.play(S, 'rready', { el: 'ice' }); Sfx.play(S, 'frost_shield', { soft: true });
        S.showStatusText?.(S.player.x, S.player.y - 40, 'FROST RUSH', '#d8fff4');
        S._vfxFlash?.(S.player.x, S.player.y - 4, 34, 0xd8fff4, 200, 0.5);
        Trident.once(S, S.player.x, S.player.y - 8, 'tri_glint', 2.6, 3.6);
    }
    // the trident in your hand: frost glowing on its tines, a glint now and then, rime drifting off it; in a Frost Rush you glow
    // frost-bright yourself the whole time (in hand, mid-stab or with it out)
    static hand(S, time, held) {
        const st = S._tri, rushing = held && (st.rushUntil || 0) > time && S.player?.active;
        const rg = st.rushGlow ||= S.add.image(0, 0, 'vfx_glow').setTint(0x9fe4ff).setBlendMode(Phaser.BlendModes.ADD).setDepth(3.38);
        rg.setVisible(!!rushing);
        if (rushing) { rg.setPosition(S.player.x, S.player.y - 4).setScale(0.42 + 0.04 * Math.sin(time * 0.02)).setAlpha(0.42 + 0.12 * Math.sin(time * 0.015)); if (Math.random() < 0.35) Trident.fx(S).spark.emitParticleAt(S.player.x + (Math.random() - 0.5) * 18, S.player.y - 4 + (Math.random() - 0.5) * 12, 1); }
        const tip = held && !st.out && !st.leap && !(S._scytheSpinUntil > time) ? CreatureFX.gearTip?.(S) : null;
        if (!tip) { if (st.handGlow) st.handGlow.setVisible(false); return; }
        const g = st.handGlow ||= S.add.image(0, 0, 'vfx_glow').setTint(0x9fe4ff).setBlendMode(Phaser.BlendModes.ADD).setDepth(3.39), rush = (st.rushUntil || 0) > time;
        g.setVisible(true).setPosition(tip.x, tip.y).setScale((rush ? 0.3 : 0.16) + 0.02 * Math.sin(time * 0.006)).setAlpha((rush ? 0.7 : 0.35) + 0.1 * Math.sin(time * (rush ? 0.02 : 0.004)));
        if (rush) { const F = Trident.fx(S); if (Math.random() < 0.5) F.spark.emitParticleAt(tip.x + (Math.random() - 0.5) * 10, tip.y + (Math.random() - 0.5) * 10, 1); if (Math.random() < 0.25) F.spark.emitParticleAt(S.player.x + (Math.random() - 0.5) * 16, S.player.y + (Math.random() - 0.5) * 10, 1); }
        if (time >= (st.glintAt || 0)) { st.glintAt = time + (rush ? 160 : 700 + Math.random() * 900); Trident.once(S, tip.x + (Math.random() - 0.5) * 6, tip.y + (Math.random() - 0.5) * 6, 'tri_glint', 1, 3.6); }
        if (Math.random() < 0.06) { const F = Trident.fx(S); F.dir = [90, 50]; F.mote.emitParticleAt(tip.x, tip.y, 1); F.dir = null; }
    }
    // While it's drawn: the trident pulled back over your shoulder, frost gathering on its tines, its throw line in motes
    static draw(S, time) {
        const st = S._tri, p = st.press, C = Trident.CFG, T = S.TILE_SIZE;
        const on = !!(p?.drawn && !st.out && Trident.held(S) && S.player?.active);
        if (!on) { if (st.drawn) { st.drawn.spr.destroy(); st.drawn.glow.destroy(); st.drawn.core.destroy(); st.drawn.dots.forEach(d => d.destroy()); st.drawn = null; } return; }
        const D = st.drawn ||= { spr: S.add.sprite(0, 0, 'fx_trident', 'tri_e').setScale(C.SCALE).setDepth(3.2),
            glow: S.add.image(0, 0, 'vfx_glow').setTint(0x9fe4ff).setBlendMode(Phaser.BlendModes.ADD).setDepth(3.21),
            core: S.add.sprite(0, 0, 'fx_trident', 'core_2').setBlendMode(Phaser.BlendModes.ADD).setDepth(3.22).play('tri_core'),
            dots: Array.from({ length: 14 }, () => S.add.image(0, 0, 'fx_trident', 'spark_0').setDepth(3.3)), fullAt: 0 };
        const aim = Trident.aim(S), k = Math.min(1, (time - p.at - C.HOLD_MS) / (C.FULL_MS - C.HOLD_MS)), ux = Math.cos(aim), uy = Math.sin(aim);
        const hx = S._shotX(), hy = S._shotY(), back = 12 + 6 * k;
        S._scytheSpinUntil = time + 120;
        Trident.face(D.spr, aim).setPosition(hx - ux * back, hy - uy * back - 3);
        const tx = D.spr.x + ux * 20 * C.SCALE, ty = D.spr.y + uy * 20 * C.SCALE;
        D.glow.setPosition(tx, ty).setScale(0.15 + 0.25 * k).setAlpha(0.25 + 0.35 * k + (k >= 1 ? 0.15 * Math.sin(time * 0.02) : 0));
        D.core.setPosition(tx, ty).setScale(0.5 + 0.9 * k).setAlpha(0.4 + 0.6 * k);
        if (Math.random() < 0.2 + 0.5 * k) { const F = Trident.fx(S); F.dir = [aim * 180 / Math.PI + 180, 120]; F.spark.emitParticleAt(tx + (Math.random() - 0.5) * 10, ty + (Math.random() - 0.5) * 10, 1); F.dir = null; }
        if (k >= 1 && !D.fullAt) { D.fullAt = time; Sfx.play(S, 'rready', { el: 'ice' }); Trident.burst(S, tx, ty, 0.6); Trident.once(S, tx, ty, 'tri_glint', 2.2, 3.6); }
        // the line it will fly, a mote along it, and where it stops (short of a wall)
        const ox = S.playerX + 0.5, oy = S.playerY + 0.5;
        let far = Trident.range(k);
        for (let d = 0.5; d <= far; d += 0.25) if (S.world[Math.floor(ox + ux * d)]?.[Math.floor(oy + uy * d)] !== S.FLOOR) { far = d - 0.25; break; }
        const n = D.dots.length - 1;
        D.dots.forEach((m, i) => {
            const end = i === n, d = end ? far : far * (i + 1) / n;
            m.setVisible(d > 0.5).setPosition(hx + ux * d * T, hy + uy * d * T).setFrame(end ? 'mote_2' : 'spark_0').setScale(end ? 2 : 1.1)
                .setTint(k >= 1 ? 0xffffff : 0xa8e8ff).setAlpha((0.55 + 0.4 * k) * (end ? 1 : 0.8 + 0.2 * Math.sin(time * 0.012 - i * 0.6)));
        });
    }
    // Over you while it's out: the frost bar (FROST toward the next call, a segment a call), under it the throw's (HURL_CD
    // filling, lit when it's ready), and right of them the combo meter
    static bar(S) {
        const st = S._tri, B = S._triBar;
        if (!st || !Trident.held(S) || !S.player?.active) {
            if (B) { B.g.destroy(); B.label.destroy(); B.ico.destroy(); B.combo?.pips.forEach(p => p.destroy()); B.combo?.next.destroy(); S._triBar = null; }
            return;
        }
        const top = CreatureFX.gearTop?.(S), C = Trident.CFG, px = S.player.x, py = Math.min(S.player.y - 18, top != null ? top - 13 : Infinity), ready = st.charges >= C.KIN_COST, now = S.time.now;   // (clear of the trident in your hand)
        const b = S._triBar ||= { g: S.add.graphics().setDepth(5.6), ico: S.add.image(0, 0, 'fx_trident', 'ico_hurl').setDepth(5.7),
            label: S.add.text(px, py + 10, '', { fontSize: '8px', fontFamily: UIKit.FONT.title, fontStyle: 'bold', color: '#7fd0ff', stroke: '#06121e', strokeThickness: 3, resolution: 2 }).setOrigin(0.5, 1).setDepth(5.7) };
        if (!b.g.active) { S._triBar = null; return; }
        UIKit.rBar(b.g.clear(), px - 20, py - 3, 48, st.charges / C.KIN_MAX, { col: 0x4fb0e6, hot: 0xd8fff4, dark: 0x06121e, time: now, ready, segs: C.KIN_MAX / C.KIN_COST });
        const k = st.out ? 0 : 1 - Math.max(0, Math.min(1, ((st.hurlAt || 0) - now) / Trident.hurlCd())), up = !st.out && k >= 1, ping = b.ping && now - b.ping < 260 ? 1 - (now - b.ping) / 260 : 0;
        b.g.fillStyle(0x06121e, 0.85).fillRect(px - 21, py + 5, 50, 4).fillStyle(up ? 0xd8fff4 : 0x4fb0e6, up ? 0.75 + 0.25 * Math.sin(now / 160) : 1).fillRect(px - 20, py + 6, 48 * k, 2);
        if (ping) b.g.fillStyle(0xffffff, ping).fillRect(px - 21, py + 5, 50, 4);
        b.ico.setPosition(px - 25, py + 7).setAlpha(up ? 1 : 0.45).setScale(1 + 0.6 * ping);
        // the combo: a pip a step (lit when done, the next one bracketed) right of the bars, the window left draining under them;
        // when it runs out the lit ones fade away, and when the slam lands they flash, then empty
        const M = b.combo ||= { pips: [0, 1, 2].map(() => S.add.image(0, 0, 'fx_trident', 'pip_t_off').setDepth(5.7)), next: S.add.image(0, 0, 'fx_trident', 'pip_next').setDepth(5.71) };
        const win = ((st.cd || C.CD) + C.COMBO_MS) * Trident.pace(S), left = st.at + win - now, open = !st.comboEnd && st.combo < 2;
        let lit = 0, next = 0, fade = 1, flash = 0, w = 0;
        if (st.leap) { lit = 2; next = 2; w = 1; }
        else if (st.comboEnd && now - st.comboEnd < 380) { lit = 3; next = -1; flash = 1 - (now - st.comboEnd) / 380; }
        else if (open && left > 0) { lit = st.combo + 1; next = lit; w = left / win; }
        else if (open && left > -300) { lit = st.combo + 1; fade = 1 + left / 300; }   // (the window's run out: it empties)
        const shUp = now < (S._frostShieldUntil || 0), shBack = !shUp && now < (st.shieldBack || 0);   // (the Frost Shield up, or recharging: a full combo won't raise it)
        M.pips.forEach((im, i) => im.setFrame(['pip_t', 'pip_s', 'pip_l'][i] + (i < lit ? '' : '_off')).setPosition(px + 36 + 8 * i, py).setAlpha(i < lit ? fade : 1).setScale(1 + 0.6 * flash * (i === 2 ? 1.5 : 1)).setTint(i < lit && st.comboHits?.[i] === false ? 0xff7a7a : shUp || shBack ? 0x7f9fb8 : 0xffffff));   // (a hit that missed: red, no Frost Shield this combo)
        M.next.setVisible(next >= 0).setPosition(px + 36 + 8 * Math.max(0, next), py).setAlpha(0.55 + 0.45 * Math.sin(now / 110));
        b.g.fillStyle(0x06121e, 0.85).fillRect(px + 31, py + 5, 26, 4);
        if (w > 0) b.g.fillStyle(w < 0.3 ? 0xff9a3a : 0xd8fff4, 1).fillRect(px + 32, py + 6, 24 * w, 2);
        if (flash) b.g.fillStyle(0xffffff, flash).fillRect(px + 31, py + 5, 26, 4);
        if (shUp || shBack) b.g.fillStyle(0x06121e, 0.85).fillRect(px + 31, py - 12, 26, 3).fillStyle(shUp ? 0xbff4ff : 0x4f7a99, 1).fillRect(px + 32, py - 11, 24 * (shUp ? Math.min(1, (S._frostShieldUntil - now) / C.TRI_SHIELD_MS) : 1 - (st.shieldBack - now) / C.TRI_SHIELD_CD), 1);   // (draining while it's up, refilling dim as it recharges)
        const rush = Math.max(0, Math.min(1, ((st.rushUntil || 0) - now) / C.RUSH_MS));
        if (rush > 0) b.g.fillStyle(0x06121e, 0.85).fillRect(px + 31, py - 8, 26, 3).fillStyle(0xffffff, 0.75 + 0.25 * Math.sin(now / 60)).fillRect(px + 32, py - 7, 24 * rush, 1);
        const quiet = st.leap || (st.comboEnd && now - st.comboEnd < C.AFTER_SLAM + 400);   // (the leap and the slam: faint, over the ring)
        b.label.setPosition(px, py - 13).setAlpha(quiet ? 0.25 : 1).setText(`FROST ${st.charges}/${C.KIN_MAX}  ·  KIN ${st.kin.filter(k => !k.gone).length}/${C.KIN_CAP}  ·  FROSTKIN [${Settings.label(Settings.key('surge'))}]`).setColor(ready ? '#d8fff4' : '#7fd0ff');
    }
}
