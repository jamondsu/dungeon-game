// ═══════════════════════════════════════════════════════════════════════════
// MirrorTrial.js — the Hall of Reflections, a first try (the Training Ground's TRIAL page).
//
// You step through a mirror into a hall and see through your slime's eyes, a step a tile and a quarter turn at a time. The
// mirror breaks behind you, and the things in the hall take your powers the moment you're in: you can't fight them, only
// get out. They're far beyond you, and you're a game to them: they don't want to hurt you, they want to scare you. They
// sleep at first, and stay asleep till you come too near or make a noise (a dash, a knock on a pane), and
// every fragment of the way out you take wakes another. Awake, they're bigger than you and they move only while nothing
// sees them, never while you watch, and only ever in still poses, a new one each step: asleep, looking like you; awake and
// wrong, or toying with you, by how riled they are: every one wakes calm and slow (reading, juggling your gems, whistling...),
// and the longer it's awake the worse it gets: playful (waving, peekaboo...), then hunting and quick (staring, up the walls...).
// Staring at one, a noise near it, glass breaking, rile it quicker; each fragment taken riles them all a little, and the way
// out whole sets them all hunting; a hunter that has lost you a while cools to playful, and a shoo or a prank calms one right
// down. One that can see you comes quicker; lose it round a corner and it slows. However near, it wears its mood's look (so you
// can tell how riled it is), or through a pane, up against the glass (squashing its face on it, a heart in its breath...). They giggle (where they are, to your ears) when they wake
// and after they've made you jump. Watching them holds them, but don't meet their eyes: looking straight at one that's
// awake fills you with dread (the screen darkens, cracks, your heart pounds) till you can't bear it and look away, and for a
// moment nothing watches them. In a reflection they can't reach you that way: watch them there.
// Seven fragments of the way out are in mirrors, spread through the hall (five make it whole, two more are worth glorps), and every pane is a mirror or glass. The mirrors here
// don't show you anything straight on: they look just like glass, and you see through both. Only a reflection of a
// reflection shows: turn your back on a pane and hold up your shard (SPACE) to your eyes, and in it a mirror shows you
// (holding it up, a beat behind you), glass what's beyond; held low, it's no help. Your decoys and sentries are made of
// reflection: a mirror shows them even
// straight on. C marks a pane (your guess, glass or mirror). Walk into a pane to chalk it: a mirror rings (an eye; its
// fragment, if it holds one); glass shatters (a cross), and they hear it: the sleepers near wake, the awake lunge at you,
// a whole mood worse. Five fragments, and the way out is whole again (and every one of them wakes, for the run home): step back
// through it. They can't hurt you, but they can scare you: one reaching you pranks you (a third of your stress, for good;
// it goes back to sleep far off), and your dread from looking at them goes on top: full dread, you black out for a moment
// (two pranks in, that does it; three, a moment's look); full stress, you're scared to death. The more they've got you, the
// more your heart pounds and the dark pulses in. Hold one in your shard (a reflection) a while and it slinks off. Sent off, they sleep it off a while, then they're up again, calm.
// The shard: held up you see behind you, and the view ahead is unwatched behind it; your arm tires (the shard shakes and
// sinks), and when it gives out the shard drops till it's rested a little. (Stands, mirrors at 45 degrees you walk into to
// turn, still work if a map has them: L R; this one doesn't.) You walk slowly. SHIFT drinks one of your vials of goo (up to
// three, one a flask found; you come in with one; they fill back up slowly): a dash, a few tiles on in a flash, past one
// of them if it's in the way (not through stone or glass), loud. Found in the hall: decoy slimes (Q, you in pink: set one
// down and it stares the way you face for a while; they take it for you, and anything in its line holds) and sentry
// slimes (E sets one down: one of them moving within its reach, even a wall away, or one asleep by it waking, sets it off: it pings twice, each ping
// showing you where they are for a moment, then it's spent). Your map (TAB, held up to your face: only your decoys watch them) is
// the whole hall: its panes as you've chalked or marked them, your decoys and sentries, you; them only as a ping shows.
// Drawn small and scaled up: a ray a column through the tile map, off mirrors and through glass, shaded to black with
// distance and dithered to a few levels a colour; the shard's view the same, turned round and flipped, cut to its shape.
// ═══════════════════════════════════════════════════════════════════════════
class MirrorTrial extends Phaser.Scene {
    static CFG = {
        W: 256, H: 144, FOV: 0.66, FOG: 12, BOUNCES: 4, LEVELS: 11,   // the view, drawn this small; how wide; how far you see; mirrors deep; the dither
        BACK: { W: 96, H: 72, FOV: 0.5 },                           // the shard's view (the size of its art, mt_shard)
        STEP_MS: 340, TURN_MS: 160, RAISE_MS: 220,                   // your step, turn, and lifting the shard
        ARM: { HOLD_MS: 4000, REST_MS: 10000, BACK: 0.35 },         // the shard held up: your arm gives out after HOLD_MS, rests in REST_MS, back up at BACK
        BLUR: { CLEAR_MS: [15000, 30000], STEP_MS: [8000, 18000], STEP: 0.34, FADE_MS: 2000, WIPE_MS: 1500, UP: 0.35, REACH: 3 },   // the shard down, it fogs up: clear a while (CLEAR_MS, at random), then a smudge more every STEP_MS (fading in over FADE_MS); held up, you see through it better (UP of it); F held wipes it clean in WIPE_MS (your arm can't rest meanwhile); fogged right up, held up, it holds them only REACH tiles off
        GOO: { VIALS: 3, CHARGE_MS: 9000, FOV: 1.22 },              // your goo: at most this many vials (each a flask found), one back every CHARGE_MS; the view widened as you dash
        WARD_MS: 7000, WARD_RANGE: 8,                                // decoy slimes (found in the hall): how long one stares, how far
        DASH: { TILES: 3, COST: 1 },                                 // SHIFT: a dash, up to TILES on, for COST vials
        SENTRY: { R: 3.5, WALLS: 1, PINGS: 2, EVERY_MS: 3000, SHOW_MS: 1000, LIT_MS: 2500 },   // sentries (found in the hall): their reach (a squircle, through WALLS of stone); set off, PINGS pings EVERY_MS apart, each showing them SHOW_MS; their reach lit, just set down
        OVER: { UP_MS: 420, BACK: 2.4, HIGH: 3, PITCH: 0.74, YAW: 0.5, F: 700, SEE: [2, 5.5] },   // the view from up behind you (TAB): how long the rise takes; how far back, how high (tiles), how steeply it looks down; how far it swings round toward the middle of the hall; its lens; the dark (clear within SEE[0] tiles, black by SEE[1])
        MOOD: { calm: 1.5, play: 1, hunt: 0.72, PLAY_S: 75, HUNT_S: 75, STARE: 1.5, COOL_MS: 20000, FRAG: 0.25, NOISE: 0.5, SHATTER: 1, SEES: 0.8, LOST: 1.25, REST_MS: [15000, 25000], TRUE: 1 / 250 },   // how long a step takes at each stage (x ENT_MS); awake, one climbs a stage every PLAY_S then HUNT_S seconds (STARE times quicker stared at), a noise near it a NOISE of one, glass shattering all of them SHATTER; one that can see you steps SEES as long, one that's lost you LOST; one sent off sleeps REST_MS; the odds a step from afar shows its true face
        ENT_MS: 600, ENT_SHARD: 30, ENT_MIN: 450, GRACE_MS: 5000,    // unseen this long, one moves (quicker by ENT_SHARD a shard found: not far off your walk, so you can't leave one be); none at first
        WAKE: { NEAR: 2, DASH: 6, TAP: 4, TURN: 3, MS: 1500 },         // asleep, one wakes: you this near (tiles), or a noise this near; it takes MS to come to
        HEAR: 10,                                                    // how far off you hear one move
        MIRRORS: 0.45, FRAGMENTS: 7, NEED: 5, BONUS: 25, MID_MAX: 2, FRAG_FAR: 5, FRAG_APART: 4, SHATTER: { WAKE: 7, LUNGE: 2 },     // a pane's odds of being a mirror; the way out's fragments (in mirrors: NEED make it whole, the rest are worth BONUS glorps; one or MID_MAX in the gallery, one a quarter outside it, the rest anywhere; none within FRAG_FAR steps of your start, none within FRAG_APART of another); glass struck: sleepers this near wake, the awake lunge this many steps
        ECHO_MS: 300,                                                // how far behind you your reflection is
        SEEN_PX: 6, SEEN_BACK: 3, LIT: 0.05, BIG: 1.35,              // this much of one on screen (in the shard), this lit, holds it; how tall they stand
        SHOO_MS: 2000,                                               // one held in a reflection (your shard) this long leaves: they don't like being caught there
        LOOK_STEPS: [2, 3],
        WAY: { NEAR: 3, AHEAD: 3, STARTLE: 3, BACK: [4, 7] },     // their ways of hunting (_target): within NEAR steps any of them comes straight at you; the ambusher heads AHEAD tiles past where you face; a prank startles the others within STARTLE steps back to BACK steps off                                          // a look holds this many steps (at random), sooner if its mood turns
        DREAD: { RISE: 0.12, CLOSE: 0.6, CLOSE_PX: 3500, FALL: 0.35, WAIT: 500, STING: 0.25, OUT_MS: 1000, AFTER: 0.55 },   // a second's straight look at one awake (more the more it fills your view); ebbing after WAIT; the sting of one turning near; full: you black out OUT_MS, back at AFTER
        STRESS: { PRANK: 0.3, DREAD: 0.4, CALM_MS: 2000 },            // your stress: each prank of theirs adds PRANK for good, your dread on top (full: DREAD); 1: scared to death (two pranks and a full dread; three and a moment's). After a prank, CALM_MS with none of them moving
    };
    // # stone, P a pane (each a mirror or glass, at random; every one a window, open both sides), L R mirror stands at 45 degrees
    // (L like /, R like \), O the way out (broken), h the shard for your hand, g glorps, v a flask of goo, d a decoy slime, n a
    // sentry slime, W one of them, @ you (facing north). An outer ring and an inner one, a glass gallery in the middle (four
    // panes standing free in it, round its middle), closets off the sides; the inner ring's walls are windows onto the outer, the gallery's onto the inner.
    static MAP = [
        '###################',
        '#W...g...g...g...W#',
        '#.###P#P#.#P#P###.#',
        '#...P.........P...#',
        '#.#W#.#P#.#P#.#v#g#',
        '#.P.PgP....gPdP.P.#',
        '#.#P#.#.P.P.#.#P#.#',
        '#n....P.....P....n#',
        '#.#P#.#.P.P.#.#P#.#',
        '#.P.PdP..g..PgP.P.#',
        '#g#v#.#P#.#P#.#W#.#',
        '#.#.P....h....P.#.#',
        '#.#.#P#P#.#P#P#.#.#',
        '#..g.....@.....g..#',
        '#########O#########',
    ];
    static DIRS = [[0, -1], [1, 0], [0, 1], [-1, 0]];   // north, east, south, west
    // HOW THE HALL WORKS: the game's own guide (LevelSelectScene._guide), a picture from the hall a page (assets/mirror_guide).
    // By itself the first time you come in (mirror_guide_seen), and on H; the hall holds still while it's open
    static GUIDE = [
        ['THE HALL OF REFLECTIONS', 'Seven fragments of the way out are in mirrors, spread through the hall\'s 38 panes. Walk into a pane to chalk it: a mirror rings and gives up its fragment if it has one; glass shatters, and they hear it. Five make the way out whole, and taking the fifth wakes every one of them for the run home. The other two are worth glorps. H shows this again.'],
        ['MIRROR OR GLASS?', 'Straight on, a mirror here looks just like glass: you see through both. Only a reflection of a reflection shows. Turn your back on a pane and hold up your shard (SPACE): a mirror shows you, holding the shard; glass shows what\'s beyond it. Your decoys and sentries are made of reflection, so a mirror shows them even straight on.'],
        ['CHALK AND MARKS', 'Chalk is the real test: an eye for a mirror, a cross for glass. C puts your own mark on a pane (glass, then mirror, then rubbed out) so you don\'t test it twice; with the shard up, it marks the pane behind you. Shattered glass wakes every sleeper near it, and the awake ones lunge two steps at you.'],
        ['THEM', 'They only move while nothing is watching them: your eyes, your raised shard, your decoys. Look away and they come, each its own way, and its looks tell you which: the show-off (snacking, lounging, licking the glass) comes straight at you; the trickster (whistling, shh, peekaboo) heads you off; the collector (reading, juggling your gems) waits by the fragment you\'re after; the baby (its pacifier, giggling, floating) wanders till it\'s near. Asleep, one wakes within two tiles of you, or at a dash, a chalked pane or breaking glass. Each fragment you take wakes another.'],
        ['THEIR MOODS', 'Every one wakes calm and slow (reading, juggling, whistling), and the longer it\'s awake the worse it gets: playful, then hunting and quick (staring, up the walls). You\'ll hear it turn. Staring at one, a noise near it and breaking glass rile it faster, a fragment a little. A hunter that loses you for 20 seconds cools to playful; a shoo or a prank calms one right down. One that can see you comes quicker: lose it round a corner.'],
        ['DON\'T MEET THEIR EYES', 'Looking straight at one that\'s awake fills you with dread. When it\'s full you black out for a second, and only your decoys still watch them. In your shard they can\'t do that to you. Hold one in your raised shard for two seconds and it slinks off to sleep it off somewhere far away, for a while.'],
        ['THEY CAN\'T HURT YOU', 'Right next to you, one you\'re not watching reaches for you first, and you hear it: turn and catch it. Look away again and it pranks you, and that stays with you as stress. They have four pranks, never the same one twice running; one spins you round to face the other way. Your dread counts toward your stress too, while it lasts. Two pranks in, a full dread scares you to death. Three in, one moment\'s look does. A fourth prank always does.'],
        ['YOUR SHARD', 'Held up, your arm tires: it gives out after four seconds, and rests slowly once it\'s down. The goo arm beside the shard shows what\'s left. Down, the shard fogs up now and then, and a fogged shard only holds the ones close behind you. Hold F to wipe it, but your arm can\'t rest while you do.'],
        ['WHAT YOU\'LL FIND', 'Flasks of your goo: SHIFT dashes you up to three tiles on, past one of them, loudly. Decoys (Q): they take it for you, and whatever it stares at holds. Sentries (E): one of them moving near it, even a wall away, or waking beside it, sets it off, and two pings show you where they are. Glorps go into your purse.'],
        ['LOOKING FROM ABOVE', 'Hold TAB to step out of your own eyes, up behind yourself: you, the panes round you with your chalk and marks, your slimes. You never see them this way, except where a sentry pings. While you\'re up there only your decoys watch them, and you can\'t move till you let go. W S step, A D turn, ESC leaves the hall.'],
    ];
    // their looks (mt_twin, a strip): asleep; awake, by their mood, however near: calm (reading in
    // glasses, juggling your gems, whistling, counting glorps, a baby with a pacifier, caught snacking on a burger, lounging...), playful (waving, peekaboo, copying you...), hunting
    // (staring, up the walls, splatted on one, weeping...); right behind a pane between you, up against the glass
    // (face squashed on it, a heart in its breath, waving in, licking it, knocking); REACH, right next to you, the step before it gets
    // you, caught in time (mid-reach, sneaking up, mid-BOO, going for a hug); (frames 38-44, the old near looks, unused); (a prank's
    // face is its own drawing, mt_face); TRUE, what they really are (rare, and only ever seen straight on); CORRIDOR, the ones holding a corridor's walls (only where it runs toward you); WALLED, the ones
    // flat on the wall right behind them (only where there is one)
    // what some of their looks say, now and then, when you can hear it (Sound.js, the hv_ recordings): reading, whistling, counting
    // glorps, the baby, snacking, lounging, giggling, shh, waving, peekaboo, weeping, a heart in the fog, waving in, licking, knocking
    static LOOK_SOUNDS = { 2: 'hv_mmm', 4: 'hv_whistle', 5: 'hv_count', 6: 'hv_coo', 7: 'hv_bite', 8: 'hv_sigh', 12: ['hv_giggle1', 'hv_giggle3'], 13: 'hv_shh',
        16: 'hv_hi', 17: 'hv_whisper', 32: 'hv_sniff', 34: 'hv_breath', 35: 'hv_hi', 36: 'hv_squeak', 37: 'hv_knock' };
    // their four ways of hunting, one each (_target)
    static WAYS = ['chase', 'ambush', 'cut', 'wander'];
    static POSES = { SLEEP: [0, 1], GLASS: [33, 37], TRUE: 50, CORRIDOR: [28, 29, 30], WALLED: [31] };
    // each of the four is its own sort, by its way, and wears only its own looks: the chaser a show-off (snacking, lounging in the
    // air, a tower of them; the smile, two of you; staring, too tall; face on the glass, licking it; BOO, mid-reach), the ambusher
    // a trickster (whistling, shh, turned away; peekaboo, coming up, face sideways; too tall, on the ceiling; waving in, knocking;
    // sneaking, a sheepish mid-BOO), the cutter a collector (reading, juggling your gems, counting glorps, showing off your decoy;
    // copying you, no eyes; staring, weeping; a heart in the fog, knocking; mid-reach, sneaking), the wanderer a baby (the
    // pacifier, cuddling your decoy, giggling, a puddle; waving, floating; on the ceiling, weeping; a heart in the fog, waving in;
    // a sheepish mid-BOO, a hug). Any of them holds a corridor's walls or splats on the wall behind it
    static LOOKS = {
        chase: { calm: [7, 8, 11], play: [19, 22], hunt: [25, 26, 28, 29, 30, 31], GLASS: [33, 36], REACH: [45, 46] },
        ambush: { calm: [4, 13, 14], play: [17, 21, 23], hunt: [26, 27, 28, 29, 30, 31], GLASS: [35, 37], REACH: [47, 48] },
        cut: { calm: [2, 3, 5, 10], play: [18, 24], hunt: [25, 32, 28, 29, 30, 31], GLASS: [34, 37], REACH: [46, 47] },
        wander: { calm: [6, 9, 12, 15], play: [16, 20], hunt: [27, 32, 28, 29, 30, 31], GLASS: [34, 35], REACH: [48, 49] },
    };
    static TEX = ['mt_wall', 'mt_glass', 'mt_mirror', 'mt_broken', 'mt_self', 'mt_twin', 'mt_shard', 'mt_pickup', 'mt_decoy', 'mt_mark_m', 'mt_mark_g', 'mt_sentry', 'mt_glorp', 'mt_items'];
    static BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5].map(v => (v + 0.5) / 16 - 0.5);

    // From the Training Ground: down into your slime's eyes, and through
    static enter(S, opts = {}) {   // (opts.ending: just the ending, then back out)
        if (S._mirrorBusy || !S.player || !S.scene.get('MirrorTrial')) return;
        S._mirrorBusy = true;
        Training.showPanel(S, false);
        const cam = S.cameras.main, zoom = cam.zoom;
        Sfx.play(S, 'whoosh');
        cam.zoomTo(zoom * 4, 650, 'Cubic.easeIn');
        cam.fadeOut(650, 8, 4, 16);
        S.time.delayedCall(680, () => { S.scene.launch('MirrorTrial', { zoom, ...opts }); S.scene.pause(); });
    }

    constructor() { super('MirrorTrial'); }

    create(data) {
        const C = MirrorTrial.CFG, W = this.scale.width, H = this.scale.height;
        this.zoom0 = data?.zoom || 1;
        this.map = MirrorTrial.MAP.map(r => r.split(''));
        this.ents = []; this.glorps = []; this.items = []; this.hand = null; this.gotGlorps = 0;
        this.map.forEach((row, y) => row.forEach((c, x) => {
            if (c === '@') this.me = { x, y, dir: 0 };
            else if (c === 'P') { row[x] = Math.random() < C.MIRRORS ? 'M' : 'G'; return; }
            else if (c === 'W') this.ents.push({ x, y, pose: Math.random() < 0.5 ? 0 : 1, t: 0, seen: false, awake: false, way: MirrorTrial.WAYS[this.ents.length % 4] });
            else if (c === 'h') this.hand = { x, y };
            else if (c === 'g') this.glorps.push({ x, y, n: 3 + Math.floor(Math.random() * 4) });
            else if ('vdn'.includes(c)) this.items.push({ x, y, k: c });
            else return;
            row[x] = '.';
        }));
        this.view = { x: this.me.x + 0.5, y: this.me.y + 0.5, a: -Math.PI / 2 };
        // the way out's fragments, in mirrors, spread out: one or two in the gallery (the middle), one in each quarter of the hall
        // outside it, the rest anywhere; never near where you start or next to another (a pane picked for one made a mirror if it
        // wasn't); and at least a few more mirrors than that
        const mirrors = [], rows = this.map.length, cols = this.map[0].length, area = (x, y) => x >= 6 && x <= 12 && y >= 4 && y <= 10 ? 'mid' : (y < rows / 2 ? 'n' : 's') + (x < cols / 2 ? 'w' : 'e');
        const panes = {}; this.map.forEach((row, y) => row.forEach((c, x) => { if (c === 'M' || c === 'G') (panes[area(x, y)] ||= []).push([x, y]); if (c === 'M') mirrors.push(y * 64 + x); }));
        this.frags = new Set();
        const picked = [], far = ([x, y]) => Math.abs(x - this.me.x) + Math.abs(y - this.me.y) >= C.FRAG_FAR;
        const take = (list, n, apart = C.FRAG_APART) => { for (const p of list.filter(far).sort(() => Math.random() - 0.5)) { if (n <= 0) return; if (picked.some(q => Math.abs(q[0] - p[0]) + Math.abs(q[1] - p[1]) < apart || (q[0] === p[0] && q[1] === p[1]))) continue; picked.push(p); n--; } };
        take(panes.mid || [], 1 + Math.floor(Math.random() * C.MID_MAX));
        for (const q of ['nw', 'ne', 'sw', 'se']) take(panes[q] || [], 1);
        const all = Object.values(panes).flat();
        take(all, C.FRAGMENTS - picked.length); take(all, C.FRAGMENTS - picked.length, 1);   // (spread out if they can be; never short)
        for (const [x, y] of picked) { if (this.map[y][x] === 'G') { this.map[y][x] = 'M'; mirrors.push(y * 64 + x); } this.frags.add(y * 64 + x); }
        for (let i = 0; mirrors.length < C.FRAGMENTS + 3 && i < 200; i++) { const y = Math.floor(Math.random() * rows), x = Math.floor(Math.random() * cols); if (this.map[y][x] === 'G') { this.map[y][x] = 'M'; mirrors.push(y * 64 + x); } }
        Object.assign(this, { found: 0, holding: false, raised: false, t0: this.time.now, done: false, caught: false, leaving: false, moving: false, queued: null,
            charges: 1, vials: 1, chargeT: 0, fovK: 1, gooK: 0, bubbles: [], drips: [], echoes: [], wards: 0, placed: [], labels: {}, marks: {}, sentries: [], sentryLeft: 0, lines: new Map(), escaped: false, pranks: 0, breaks: 0, closest: Infinity,
            dread: 0, dreadAt: 0, scarred: 0, stress: 0, calmUntil: 0, blackUntil: 0, heartAt: 0, arm: 1, armOut: false, reading: false, blur: 0, blurTo: 0, blurAt: this.time.now + Phaser.Math.Between(...C.BLUR.CLEAR_MS), wiping: false, mapUp: false });
        // the dread's cracks: from the screen's edges in, a little further the more you dread (fixed, so they grow, not jump)
        let seed = 9; const rnd = () => (seed = (seed * 1103515245 + 12345) >>> 0) / 4294967296;
        this.cracks = Array.from({ length: 12 }, (_, i) => {
            const side = i % 4, t = rnd(), pts = [[side === 1 ? W : side === 3 ? 0 : t * W, side === 0 ? 0 : side === 2 ? H : t * H]];
            for (let k = 0; k < 9; k++) { const [x, y] = pts[pts.length - 1], a = Math.atan2(H / 2 - y, W / 2 - x) + (rnd() - 0.5) * 1.4; pts.push([x + Math.cos(a) * (25 + rnd() * 35), y + Math.sin(a) * (25 + rnd() * 35)]); }
            return pts;
        });
        // the textures, as pixels to read
        this.tex = {};
        for (const k of MirrorTrial.TEX) {
            const src = this.textures.get(k).getSourceImage(), c = document.createElement('canvas');
            c.width = src.width; c.height = src.height;
            const x = c.getContext('2d'); x.drawImage(src, 0, 0);
            this.tex[k] = { w: src.width, h: src.height, d: x.getImageData(0, 0, src.width, src.height).data };
        }
        this.tex.mt_twin.fw = this.tex.mt_decoy.fw = this.tex.mt_items.fw = this.tex.mt_self.fw = 48;   // strips: its poses, the decoy's four sides, things to find, you (the shard down, up)
        // the two views: ahead (the screen), and the shard's (behind you), each a canvas drawn every frame
        const canvas = (key, w, h) => {
            const t = this.textures.exists(key) ? this.textures.get(key) : this.textures.createCanvas(key, w, h), ctx = t.getContext();
            return { key, tex: t, ctx, img: ctx.createImageData(w, h), W: w, H: h, zbuf: new Float32Array(w), cols: new Array(w) };
        };
        this.front = canvas('mt_view', C.W, C.H);
        this.back = canvas('mt_back', C.BACK.W, C.BACK.H);
        this.viewImg = this.add.image(W / 2, H / 2, 'mt_view').setScale(Math.max(W / C.W, H / C.H));
        this.dim = this.add.rectangle(0, 0, W, H, 0x000000).setOrigin(0).setAlpha(0);   // ahead, unwatched while you look in the shard
        this.shard = this.add.container(0, 0, [this.add.image(0, 0, 'mt_back'), this.add.image(0, 0, 'mt_shard')]).setVisible(false);
        const at = this.textures.get('mt_arm');   // your arm's strength, by the shard: a tendril of your goo holding one, lit as far as it has left
        if (!at.has('full')) { at.add('full', 0, 0, 0, 9, 30); at.add('spent', 0, 9, 0, 9, 30); }
        this.arms = ['spent', 'full'].map(f => this.add.image(0, 0, 'mt_arm', f).setScale(Math.max(W / C.W, H / C.H)).setDepth(5).setVisible(false));
        this._shardAt(false, 0);
        // what's said, and the keys
        const T = (y, s, size, col) => this.add.text(W / 2, y, s, { fontSize: size, fontFamily: UIKit.FONT.title, fontStyle: 'bold', color: col, stroke: '#05030a', strokeThickness: 5, align: 'center' }).setOrigin(0.5).setDepth(6);
        this.title = T(H * 0.38, 'THE HALL OF REFLECTIONS', '30px', '#d8c8ff');
        this.sub = T(H * 0.38 + 44, 'Seven fragments of the way out are in mirrors; five make it whole. Walk into a pane to chalk it.\nBut half the panes are glass, and glass shatters. They\'re asleep. Don\'t wake them: they\'ll want to play.\nThey can\'t hurt you. But they can scare you out of your mind.', '16px', '#a898c8');
        this.time.delayedCall(1300, () => { Sfx.play(this, 'shatter'); this.cameras.main.shake(200, 0.006); });
        this.time.delayedCall(2300, () => Sfx.play(this, 'e_absorb'));
        this.tweens.add({ targets: [this.title, this.sub], alpha: 0, delay: C.GRACE_MS - 500, duration: 600 });
        this.keysTxt = this.add.text(W / 2, H - 30, '', { fontSize: '13px', fontFamily: 'monospace', align: 'center', lineSpacing: 4, color: '#8a7aa8', stroke: '#05030a', strokeThickness: 3 }).setOrigin(0.5).setDepth(6);
        this.fx = this.add.graphics().setDepth(4);   // a dash's streaks and goo
        this.gooGlow = this.add.rectangle(0, 0, W, H, 0x2fe8c8).setOrigin(0).setBlendMode(Phaser.BlendModes.ADD).setAlpha(0).setDepth(3);
        // your goo: three vials, bottom left; an empty one fills back up from the bottom
        const ct = this.textures.get('mt_charge');
        if (!ct.has('full')) { ct.add('full', 0, 0, 0, 10, 13); ct.add('empty', 0, 10, 0, 10, 13); }
        this.cans = Array.from({ length: C.GOO.VIALS }, (_, i) => {
            const x = 52 + i * 58, y = H - 92, P = Math.max(W / C.W, H / C.H);   // (drawn the view's pixel size; in from the edge, where the zoom pulses would push it)
            return { glow: this.add.image(x, y, 'vfx_glow').setTint(0x40d8b8).setBlendMode(Phaser.BlendModes.ADD).setScale(0.55).setAlpha(0.35).setDepth(5),
                     empty: this.add.image(x, y, 'mt_charge', 'empty').setScale(P).setDepth(5), full: this.add.image(x, y, 'mt_charge', 'full').setScale(P).setDepth(5), P };
        });
        this.dreadG = this.add.graphics().setDepth(4.2);   // the dread: the edges darkening, the cracks
        this.black = this.add.rectangle(0, 0, W, H, 0x000000).setOrigin(0).setAlpha(0).setDepth(5.5);
        this.faint = this.add.rectangle(0, 0, W, H, 0x000000).setOrigin(0).setAlpha(0).setDepth(5.4);   // (stressed: the dark pulsing in)   // blacking out (over a prank's face)
        this.stingWash = this.add.rectangle(0, 0, W, H, 0xffffff).setOrigin(0).setBlendMode(Phaser.BlendModes.ADD).setAlpha(0).setDepth(4.3);   // the shock: a flash over it, not hiding it
        this.mapDim = this.add.rectangle(0, 0, W, H, 0x05030a).setOrigin(0).setAlpha(0).setDepth(6.4);
        this.overCv = canvas('mt_over', W, H);   // the hall from above, drawn each frame it's out
        this.mapImg = this.add.image(W / 2, H / 2, 'mt_over').setDepth(6.5).setVisible(false);
        this.mapHint = this.add.text(W / 2, H - 58, 'AN EYE: A MIRROR · A CROSS: GLASS · FAINT: YOUR MARK (C) · PLAIN: NOT TESTED\nOUT OF YOUR OWN EYES. WHILE YOU ARE, ONLY YOUR DECOYS WATCH THEM', { fontSize: '13px', fontFamily: 'monospace', fontStyle: 'bold', color: '#d6c49a', stroke: '#05030a', strokeThickness: 4, align: 'center' }).setOrigin(0.5).setDepth(6.6).setAlpha(0);
        this.mapMode = null;
        this.input.keyboard.addCapture(Phaser.Input.Keyboard.KeyCodes.TAB);
        this.glorpTxt = this.add.text(W - 24, 20, '', { fontSize: '20px', fontFamily: UIKit.FONT.title, fontStyle: 'bold', color: '#5dffb8', stroke: '#05030a', strokeThickness: 5 }).setOrigin(1, 0).setDepth(6);
        this.noteTxt = this.add.text(W / 2, H * 0.72, '', { fontSize: '18px', fontFamily: UIKit.FONT.title, fontStyle: 'bold', color: '#f0ece0', stroke: '#05030a', strokeThickness: 5 }).setOrigin(0.5).setDepth(6).setAlpha(0);
        this.countTxt = this.add.text(W / 2, 22, '', { fontSize: '15px', fontFamily: UIKit.FONT.title, fontStyle: 'bold', color: '#bfd8ff', stroke: '#05030a', strokeThickness: 4 }).setOrigin(0.5).setDepth(6);
        this._hud();
        this.input.keyboard.on('keydown', this._key, this);
        this.input.keyboard.on('keyup', this._keyUp, this);
        this.input.on('pointerdown', this._boop, this);
        this.events.once('shutdown', () => { this.input.keyboard.off('keydown', this._key, this); this.input.keyboard.off('keyup', this._keyUp, this); this.input.off('pointerdown', this._boop, this); });
        if (typeof Music !== 'undefined') Music.duck(true, 'mirror');
        this.cameras.main.fadeIn(700, 8, 4, 16);
        if (data?.ending) {   // just the ending (the Training Ground's WATCH THE ENDING): nothing moves, then straight back out
            this.escaped = true; this.title.setAlpha(0); this.sub.setAlpha(0);
            if (MirrorTrial.ENDING.every(k => this.textures.exists(k))) this.time.delayedCall(500, () => this._ending(() => this._leave(null)));
            else { this._note('THE ENDING ISN\'T DRAWN YET.'); this.time.delayedCall(2000, () => this._leave(null)); }
            return;
        }
        this.time.delayedCall(750, () => this._openGuide(false));   // (the first time in: how it works)
    }

    // the guide: the game's (LevelSelectScene's, and the shop's words under it); the hall holds still meanwhile (its clock moved on
    // after, by as long as you read)
    _guide(...a) { return LevelSelectScene.prototype._guide.call(this, ...a); }
    _richText(...a) { return ShopScene.prototype._richText.call(this, ...a); }
    _tipZone(...a) { return ShopScene.prototype._tipZone.call(this, ...a); }
    _showTip(...a) { return LevelSelectScene.prototype._showTip.call(this, ...a); }
    _moveTip(...a) { return ShopScene.prototype._moveTip.call(this, ...a); }
    _hideTip(...a) { return ShopScene.prototype._hideTip.call(this, ...a); }
    _openGuide(force) {
        if (this.reading || this.caught || this.escaped || this.leaving) return;
        this.reading = true; const at = this.time.now;
        if (this.raised) { this.raised = false; this._shardAt(false, 0); }
        this._guide({ id: 'mguide', dir: 'mirror_guide', title: 'HOW THE HALL WORKS', pages: MirrorTrial.GUIDE, seenKey: 'mirror_guide_seen', force, end: 'INTO THE HALL  ▸',
            then: () => { this._shiftTime(this.time.now - at); this.reading = false; } });
    }
    // every moment the hall keeps, on by dt (it held still that long)
    _shiftTime(dt) {
        for (const k of ['t0', 'calmUntil', 'blurAt', 'blackUntil', 'dreadAt', 'heartAt', 'wipeAt']) if (this[k] != null) this[k] += dt;
        for (const w of this.placed) { w.at += dt; w.until += dt; }
        for (const o of this.sentries) for (const k of ['at', 'next', 'showUntil', 'pingAt']) if (o[k] != null) o[k] += dt;
        for (const e of this.ents) for (const k of ['movedAt', 'restUntil']) if (e[k] != null) e[k] += dt;
    }

    _hud() {
        const have = [this.holding && 'SPACE (hold) the shard · F (hold) wipe it', this.vials && 'SHIFT dash',
            (this.wards || this.placed.length) && `Q decoy slime (${this.wards})`, (this.sentryLeft || this.sentries.length) && `E set down / pick up a sentry (${this.sentryLeft})`].filter(Boolean);
        this.keysTxt.setText(`W S step · A D turn · TAB (hold) look from above · walk into a pane: chalk it · C mark it · H how it works · ESC leave` + (have.length ? '\n' + have.join(' · ') : ''));   // (only what you've found)
        const C = MirrorTrial.CFG, more = Math.max(0, this.found - C.NEED);
        this.countTxt.setText(this.done ? `THE WAY OUT IS WHOLE  ·  FRAGMENTS MORE  ${'◆ '.repeat(more)}${'◇ '.repeat(C.FRAGMENTS - C.NEED - more)}`.trim()
            : `FRAGMENTS OF THE WAY OUT  ${'◆ '.repeat(this.found)}${'◇ '.repeat(C.NEED - this.found)}`.trim());
    }
    _say(a, b, col = '#d8c8ff', hold = 2600) {
        for (const o of [this.title, this.sub]) { this.tweens.killTweensOf(o); o.setAlpha(1); }
        this.title.setText(a).setColor(col); this.sub.setText(b || '');
        if (hold) this.tweens.add({ targets: [this.title, this.sub], alpha: 0, delay: hold, duration: 600 });
    }
    // the shard: low in your hand, or held up before your eyes (filling the view)
    _shardAt(up, ms) {
        const W = this.scale.width, H = this.scale.height, to = up ? { x: W - 290, y: H / 2 + 30, scale: 6, angle: -3 } : { x: W - 150, y: H - 110, scale: 2.4, angle: -8 };   // (up: at your side, ahead still in view round it)
        this.tweens.killTweensOf([this.shard, this.dim]);
        if (!ms) { this.shard.setPosition(to.x, to.y).setScale(to.scale).setAngle(to.angle); return; }
        this.tweens.add({ targets: this.shard, ...to, duration: ms, ease: 'Cubic.easeOut' });
        this.tweens.add({ targets: this.dim, alpha: up ? 0.12 : 0, duration: ms });
    }

    _key(e) {
        if (this.leaving || this.reading) return;   // (reading the guide: its keys)
        const k = e.code;
        if (this.ending) { if (k === 'Enter' || k === 'Space' || k === 'Escape') this._endingSkip?.(); return; }   // (the ending playing: these skip it)
        if (k === 'KeyH') return this._openGuide(true);
        if (k === 'Escape') return this._leave(this.escaped ? 'YOU GOT OUT OF THE HALL OF REFLECTIONS' : null);
        if (this.caught || this.escaped) { if (k === 'KeyR' || (this.escaped && k === 'Enter')) this.scene.restart({ zoom: this.zoom0 }); return; }
        if (k === 'Space') { if (e.repeat) return; if (this.holding && !this.raised && !this.mapUp && this.armOut) return Sfx.play(this, 'deny'); if (this.holding && !this.raised && !this.mapUp) { this.raised = true; Sfx.play(this, 'hover'); this._shardAt(true, MirrorTrial.CFG.RAISE_MS); } return; }
        if ((k === 'ShiftLeft' || k === 'ShiftRight') && e.repeat) return;   // (held: one dash)
        if (k === 'Tab') { this.mapUp = true; if (this.raised) { this.raised = false; this._shardAt(false, MirrorTrial.CFG.RAISE_MS); } return; }
        if (this.mapUp) return;   // (looking at the map: nothing else)
        if (k === 'KeyQ') return this._ward();
        if (k === 'KeyE') return this._sentry();
        if (k === 'KeyC') return this._mark();
        if (k === 'KeyF') { if (!e.repeat && this.holding) this.wiping = true; return; }
        if (this.moving) { this.queued = k; return; }
        this._act(k);
    }
    _keyUp(e) {
        if (e.code === 'Space' && this.raised) { this.raised = false; this._shardAt(false, MirrorTrial.CFG.RAISE_MS); }
        if (e.code === 'Tab') this.mapUp = false;
        if (e.code === 'KeyF') this.wiping = false;
    }
    // a click on a decoy (where the view drew it this frame): booped (Achievements.BOOPS), it squishes
    _boop(p) {
        const P = this.scale.width / this.front.W, x = Math.floor(p.x / P), y = Math.floor(p.y / P);
        const hit = (this.front.picks || []).find(k => k.cols.has(x) && y >= k.top && y < k.bottom);
        if (!hit) return;
        hit.w.boopAt = this.time.now;
        CreatureFX.boopFx(this, p.x, p.y, 'decoy');
    }
    // C: your own mark on a pane (the one you face; the shard up, the one right behind you): glass, then mirror, then none.
    // Not a test: only what you think it is
    _mark() {
        const [dx, dy] = MirrorTrial.DIRS[this.me.dir], s = this.raised ? -1 : 1, x = this.me.x + dx * s, y = this.me.y + dy * s, c = this.map[y]?.[x], k = y * 64 + x;
        if ((c !== 'M' && c !== 'G') || this.labels[k]) return Sfx.play(this, 'deny');
        this.marks[k] = !this.marks[k] ? 'G' : this.marks[k] === 'G' ? 'M' : null;
        Sfx.play(this, 'click');
        this._note(this.marks[k] === 'G' ? 'MARKED: GLASS, YOU THINK' : this.marks[k] === 'M' ? 'MARKED: A MIRROR, YOU THINK' : 'MARK RUBBED OUT');
    }
    // a decoy slime set down where you stand, staring the way you face
    _ward() {
        const C = MirrorTrial.CFG, { x, y, dir } = this.me;
        if (this.wards <= 0 || this.placed.some(w => w.x === x && w.y === y)) return Sfx.play(this, 'deny');
        this.wards--; this.placed.push({ x, y, dir, at: this.time.now, until: this.time.now + C.WARD_MS });
        Sfx.play(this, 'ready'); this._note('A DECOY: YOU, IN PINK, STARING THAT WAY. THEY\'LL TAKE IT FOR YOU.');
        this._hud();
    }
    // the wards' stares: along the way each faces, through glass, to the first thing in the way; burnt out, gone
    _wardsWatch(now) {
        const C = MirrorTrial.CFG;
        this.placed = this.placed.filter(w => w.until > now);
        for (const w of this.placed) {
            const [dx, dy] = MirrorTrial.DIRS[w.dir];
            for (let i = 1; i <= C.WARD_RANGE; i++) {
                const x = w.x + dx * i, y = w.y + dy * i, c = this.map[y]?.[x];
                if (c !== '.' && c !== 'G' && c !== 'M') break;
                for (const e of this.ents) if (e.x === x && e.y === y) e.seen = true;
            }
        }
    }
    _noCans() {
        Sfx.play(this, 'deny');
        for (const c of this.cans) { this.tweens.killTweensOf(c.empty); this.tweens.add({ targets: c.empty, x: c.empty.x + 3, duration: 40, yoyo: true, repeat: 2 }); }
    }
    // SHIFT: a vial drunk, a dash: a white flash and you're a few tiles on (past one of them, not through stone or glass), goo
    // splashing out of the vial and the view wobbling teal like jelly for a moment
    _dash() {
        const C = MirrorTrial.CFG, [dx, dy] = MirrorTrial.DIRS[this.me.dir];
        if (this.charges < C.DASH.COST || this.moving || this.caught || this.leaving) return this._noCans();
        let land = 0;
        for (let i = 1; i <= C.DASH.TILES; i++) {
            const x = this.me.x + dx * i, y = this.me.y + dy * i;
            if (!this._open(x, y)) break;
            if (!this.ents.some(e => e.x === x && e.y === y)) land = i;
        }
        if (!land) return this._noCans();
        for (let n = 0; n < C.DASH.COST; n++) {
            const can = this.cans[--this.charges];
            this.tweens.add({ targets: can.full, scale: can.P * 1.2, duration: 90, yoyo: true });
            for (let k = 0; k < 30; k++) this.bubbles.push({ x: can.full.x + (Math.random() - 0.5) * 30, y: can.full.y - 30, vx: (Math.random() - 0.3) * 260, vy: -150 - Math.random() * 380, r: 3 + Math.random() * 6, life: 1 });
        }
        const x = this.me.x + dx * land, y = this.me.y + dy * land;
        this.me.x = x; this.me.y = y; this.moving = true;
        this.cameras.main.flash(280, 255, 255, 255); this.cameras.main.shake(120, 0.006);
        Sfx.play(this, 'gulp'); Sfx.play(this, 'dash'); Sfx.play(this, 'whoosh');
        this._noise(x, y, C.WAKE.DASH);
        this.dashAt = this.time.now;   // (the goo over the view and the view widening follow from this: update)
        this.tweens.add({ targets: this.view, x: x + 0.5, y: y + 0.5, duration: 90, ease: 'Quad.easeOut', onComplete: () => this._moved() });
    }
    // E: a sentry set down where you stand; or, standing on one that hasn't gone off, picked back up
    _sentry() {
        const { x, y } = this.me, i = this.sentries.findIndex(o => o.x === x && o.y === y && !o.pings);
        if (i >= 0) { this.sentries.splice(i, 1); this.sentryLeft++; Sfx.play(this, 'pickup'); this._note('SENTRY PICKED UP'); }
        else if (this.sentryLeft > 0) {
            const o = { x, y, at: this.time.now, pings: 0, next: 0, showUntil: 0, cells: [] };
            this.map.forEach((row, cy) => row.forEach((c, cx) => { if (c === '.' && this._inReach(o, cx, cy)) o.cells.push(cy * 64 + cx); }));
            this.sentries.push(o); this.sentryLeft--; Sfx.play(this, 'pop'); this._note('A SENTRY. IF ONE OF THEM MOVES NEAR IT, IT\'LL PING.');
        }
        else Sfx.play(this, 'deny');
        this._hud();
    }
    // a sentry's reach: a squircle round it, through no more than SENTRY.WALLS of stone (or panes, or stands)
    _inReach(o, x, y) {
        const S = MirrorTrial.CFG.SENTRY, dx = x - o.x, dy = y - o.y;
        if (dx ** 4 + dy ** 4 > S.R ** 4) return false;
        let walls = 0, last = -1;
        for (let i = 1, n = Math.ceil(Math.hypot(dx, dy) * 3); i < n; i++) {
            const cx = Math.floor(o.x + 0.5 + dx * i / n), cy = Math.floor(o.y + 0.5 + dy * i / n), k = cy * 64 + cx;
            if (k !== last && this.map[cy]?.[cx] !== '.') { walls++; last = k; }
        }
        return walls <= S.WALLS;
    }
    // lit on the floor: a sentry's reach (just set down, and as it pings) and a decoy's stare: cell -> how bright
    _sentryLines(now) {
        const C = MirrorTrial.CFG, L = this.lines;
        L.clear();
        for (const o of this.sentries) {
            const k = Math.max(0.3 * Math.max(0, 1 - (now - o.at) / C.SENTRY.LIT_MS), 0.8 * Math.max(0, 1 - (now - (o.pingAt || -1e9)) / 700));
            if (k > 0.01) for (const c of o.cells) L.set(c, Math.max(L.get(c) || 0, k));
        }
        for (const w of this.placed) {   // a decoy's stare, in pink (negative: lines' values; its own colour on the floor)
            const [dx, dy] = MirrorTrial.DIRS[w.dir];
            for (let i = 1; i <= C.WARD_RANGE; i++) {
                const x = w.x + dx * i, y = w.y + dy * i, c = this.map[y]?.[x];
                if (c !== '.' && c !== 'G' && c !== 'M') break;
                if (c === '.') L.set(y * 64 + x, -0.35);
            }
        }
    }
    // Your dread: looking straight at one that's awake (not in a reflection) builds it, faster the more of it fills your view;
    // it ebbs when you stop. One that's just turned horrible stings the first time it's seen, anywhere. Full: you black out for
    // a moment (and only your decoys watch them). Your stress: what their pranks left you with, for good, and your dread on top; full,
    // you're scared to death (two pranks in, a full dread does it; three, a moment's). The look of it: the edges darkening, the
    // colour going (your dread); cracks creeping in (your stress: as far as the pranks took them, they stay); and once they've
    // got you, your heart going all the time and the dark pulsing in, like you're about to faint, worse with every prank.
    _dread(now, delta) {
        const C = MirrorTrial.CFG, D = C.DREAD, W = this.scale.width, H = this.scale.height, g = this.dreadG, dt = delta / 1000;
        const direct = this.ents.reduce((a, e) => a + (e.pose >= 2 ? e.dpx || 0 : 0), 0);
        for (const e of this.ents) if (e.fresh && e.seen) {
            e.fresh = false;
            Sfx.play(this, 'boom', { big: true }); Sfx.play(this, 'whoosh'); this.cameras.main.shake(260, 0.012);
            this.tweens.killTweensOf(this.stingWash); this.stingWash.setAlpha(0.5); this.tweens.add({ targets: this.stingWash, alpha: 0, duration: 450, ease: 'Quad.easeIn' });
            this._punch(1.12, 50, 380);   // (it jumps at the screen)
            if (e.dpx) this.dread += D.STING;
            this.time.delayedCall(420, () => !this.caught && this._giggle(e, 1));   // (got you)
        }
        if (this.caught || now < this.blackUntil) {}
        else if (direct >= C.SEEN_PX) { this.dread += (D.RISE + D.CLOSE * Math.min(1, direct / D.CLOSE_PX)) * dt; this.dreadAt = now; }
        else if (now - this.dreadAt > D.WAIT) this.dread = Math.max(0, this.dread - D.FALL * dt);
        this.dread = Math.min(this.dread, 1);
        this.stress = this.scarred + this.dread * C.STRESS.DREAD;
        if (this.stress >= 0.999 && !this.caught) this._die();
        if (this.dread >= 1 && !this.caught && now >= this.blackUntil) {
            this.blackUntil = now + D.OUT_MS; this.dread = D.AFTER; this.breaks++;
            Sfx.play(this, 'hurt'); this.cameras.main.shake(300, 0.012);
            this.tweens.killTweensOf(this.black);
            this.tweens.chain({ targets: this.black, tweens: [{ alpha: 1, duration: 120 }, { alpha: 1, duration: D.OUT_MS - 520 }, { alpha: 0, duration: 400 }] });
            this._note('YOU BLACK OUT. YOU CAN\'T BEAR IT.');
        }
        const sp = Math.min(1, this.scarred / (3 * C.STRESS.PRANK)), hk = Math.max(this.dread, sp && 0.25 + 0.6 * sp), k = Math.max(this.dread, 0.7 * sp), cs = this.stress;   // (sp: how far their pranks have got you, 0-1 by the third)
        if (hk > 0.2 && !this.caught && now - this.heartAt > 1000 - 650 * hk) { this.heartAt = now; Sfx.play(this, 'heartbeat', { hard: hk }); if (hk > 0.7) this.cameras.main.shake(90, 0.003 * hk); }
        // your stress in your sight: the view trembling, none at first, a little two pranks in, hard when you're nearly done for
        const amp = this.caught ? 0 : cs < 0.45 ? 0 : cs < 0.85 ? 1 + 2.5 * (cs - 0.45) / 0.4 : 3.5 + 12 * ((cs - 0.85) / 0.15) ** 2, P0 = Math.max(W / C.W, H / C.H);
        this.viewImg.setScale(P0 * (1 + 2.4 * amp / W)).setPosition(W / 2 + (Math.random() - 0.5) * 2 * amp, H / 2 + (Math.random() - 0.5) * 2 * amp);   // (a touch bigger: no edge showing)
        const per = 5000 - 2600 * sp, beat = sp && !this.caught ? Math.max(0, Math.sin((now % per) / per * Math.PI * 2)) ** 3 : 0;   // (the dark pulsing in)
        this.faint.setAlpha(beat * (0.12 + 0.5 * sp * sp));
        g.clear();
        if (k < 0.02 && cs < 0.02) return;
        for (let i = 0; i < 9; i++) g.lineStyle(20, 0x000000, 0.1 * k).strokeRect(10 + i * 20, 10 + i * 20, W - 20 - i * 40, H - 20 - i * 40);
        const P = Math.max(W / C.W, H / C.H), snap = v => Math.floor(v / P) * P;   // (the cracks in the view's own chunky pixels)
        for (const pts of this.cracks) {
            const n = Math.floor(pts.length * cs);
            for (let i = 1; i < n; i++) {
                const [x0, y0] = pts[i - 1], [x1, y1] = pts[i], len = Math.hypot(x1 - x0, y1 - y0);
                for (let t = 0; t <= len; t += P) {
                    const x = snap(x0 + (x1 - x0) * t / len), y = snap(y0 + (y1 - y0) * t / len);
                    g.fillStyle(0x05030a, 0.8 * cs).fillRect(x + P, y + P, P, P);
                    g.fillStyle(0xe8e0ff, 0.55 * cs).fillRect(x, y, P, P);
                }
            }
        }
    }
    // TAB: out of your own eyes, back and up a little: the hall from up behind you, looking down ahead (the rise eased in and
    // out of: overT, 0 your own eyes, 1 up behind you)
    _mapShow(mode) {
        if (mode === this.mapMode) return;
        const O = MirrorTrial.CFG.OVER, img = this.mapImg;
        this.mapMode = mode;
        this.tweens.killTweensOf([this, img, this.mapDim, this.mapHint, this.keysTxt]);
        if (mode === 'big') {
            img.setVisible(true).setAlpha(1); this.overT = this.overT || 0;
            Sfx.play(this, 'whoosh');
            this.tweens.add({ targets: this, overT: 1, duration: O.UP_MS, ease: 'Cubic.easeOut' });
            this.tweens.add({ targets: this.mapHint, alpha: 1, duration: O.UP_MS });
            this.tweens.add({ targets: this.keysTxt, alpha: 0, duration: O.UP_MS });   // (the hint where the keys were)
        } else {
            this.tweens.add({ targets: this, overT: 0, duration: 200, ease: 'Cubic.easeIn', onComplete: () => img.setVisible(false) });
            this.tweens.add({ targets: this.mapHint, alpha: 0, duration: 200 });
            this.tweens.add({ targets: this.keysTxt, alpha: 1, duration: 200 });
        }
    }
    // The hall from up behind you, looking down ahead (a camera BACK tiles behind, HIGH up, PITCH down, swung YAW round toward the
    // hall's middle, so it's angled by where in the hall you are; overT from your own eyes):
    // stone in blocks (the ones between it and you see-through), panes as glass (chalked, or your mark faint on them), the stands,
    // the way out, the floor lit where a sentry reaches or a decoy stares; what's lying about, your slimes, you; them only where a
    // ping shows them. Far to near, a row at a time, what stands in a row after it; the dark closing in round you
    _overDraw(now) {
        const O = MirrorTrial.CFG.OVER, V = this.overCv, x = V.ctx, W = V.W, H = V.H, rows = this.map.length, cols = this.map[0].length;
        const t = this.overT || 0, b = O.BACK * t, h = 0.5 + (O.HIGH - 0.5) * t, pc = Math.cos(O.PITCH * t), ps = Math.sin(O.PITCH * t);
        const [dx0, dy0] = MirrorTrial.DIRS[this.me.dir], mx = this.me.x + 0.5, my = this.me.y + 0.5;
        const side = Math.sign((cols / 2 - mx) * -dy0 + (rows / 2 - my) * dx0) || 1, yaw = Math.atan2(dy0, dx0) + side * O.YAW * t;   // (swung toward the middle)
        const fx = Math.cos(yaw), fy = Math.sin(yaw);
        const rf = (px, py) => [(px - mx) * -fy + (py - my) * fx, (px - mx) * fx + (py - my) * fy];   // (a spot in the hall: right of the camera's line, ahead along it)
        const pr = (r, f, u) => { const dz = f + b, dy = h - u, zc = dz * pc + dy * ps; if (zc < 0.08) return null; return [W / 2 + r * O.F / zc, H / 2 + (dy * pc - dz * ps) * O.F / zc, zc]; };
        const quad = (pts, fill, edge) => { if (pts.some(p => !p)) return; x.beginPath(); x.moveTo(pts[0][0], pts[0][1]); for (const p of pts.slice(1)) x.lineTo(p[0], p[1]); x.closePath(); if (fill) { x.fillStyle = fill; x.fill(); } if (edge) { x.strokeStyle = edge; x.lineWidth = 1; x.stroke(); } };
        const tri = (img, p0, p1, p2, q0, q1, q2) => {   // (img's triangle q0 q1 q2, its pixels, onto p0 p1 p2)
            const d = (q1[0] - q0[0]) * (q2[1] - q0[1]) - (q2[0] - q0[0]) * (q1[1] - q0[1]); if (!d) return;
            const a = ((p1[0] - p0[0]) * (q2[1] - q0[1]) - (p2[0] - p0[0]) * (q1[1] - q0[1])) / d, bb = ((p1[1] - p0[1]) * (q2[1] - q0[1]) - (p2[1] - p0[1]) * (q1[1] - q0[1])) / d;
            const c = ((p2[0] - p0[0]) * (q1[0] - q0[0]) - (p1[0] - p0[0]) * (q2[0] - q0[0])) / d, dd = ((p2[1] - p0[1]) * (q1[0] - q0[0]) - (p1[1] - p0[1]) * (q2[0] - q0[0])) / d;
            x.save(); x.beginPath(); x.moveTo(p0[0], p0[1]); x.lineTo(p1[0], p1[1]); x.lineTo(p2[0], p2[1]); x.closePath(); x.clip();
            x.transform(a, bb, c, dd, p0[0] - a * q0[0] - c * q0[1], p0[1] - bb * q0[0] - dd * q0[1]); x.drawImage(img, 0, 0); x.restore();
        };
        const texQuad = (img, pts, a = 1) => {   // (pts: top-left, top-right, bottom-right, bottom-left)
            if (pts.some(p => !p)) return; const w = img.width, hh = img.height; x.globalAlpha = a;
            tri(img, pts[0], pts[1], pts[2], [0, 0], [w, 0], [w, hh]); tri(img, pts[0], pts[2], pts[3], [0, 0], [w, hh], [0, hh]); x.globalAlpha = 1;
        };
        const dim = (hex, k, a = 1) => { const n = parseInt(hex.slice(1), 16), m = 1 - k; return `rgba(${((n >> 16) & 255) * m | 0},${((n >> 8) & 255) * m | 0},${(n & 255) * m | 0},${a})`; };
        const src = k => this.textures.get(k).getSourceImage();
        x.fillStyle = '#07050c'; x.fillRect(0, 0, W, H); x.imageSmoothingEnabled = false;
        const cells = [];
        for (let gy = 0; gy < rows; gy++) for (let gx = 0; gx < cols; gx++) { const [r, f] = rf(gx + 0.5, gy + 0.5); if (f > -O.BACK - 1 && f < 10 && Math.abs(r) < 8) cells.push({ gx, gy, r, f }); }
        cells.sort((p, q) => q.f - p.f || Math.abs(q.r) - Math.abs(p.r));
        // what stands where: drawn after its row
        const who = new Map(), put = (gx, gy, draw) => { const k = gy * 64 + gx; (who.get(k) || who.set(k, []).get(k)).push(draw); };
        const sprite = (k, f, gx, gy, alpha = 1) => {
            const [r, ff] = rf(gx + 0.5, gy + 0.5), a = pr(r, ff, 0), top = pr(r, ff, 1.35); if (!a || !top) return;
            const hgt = a[1] - top[1], w = 1.01 * O.F / a[2], dk = Math.max(0, Math.min(1, (Math.hypot(r, ff) - O.SEE[0]) / (O.SEE[1] - O.SEE[0])));
            x.fillStyle = `rgba(0,0,0,${0.35 * alpha * (1 - dk)})`; x.beginPath(); x.ellipse(a[0], a[1] - hgt * 0.02, w * 0.36, w * 0.36 * ps * 0.9 + 1, 0, 0, 7); x.fill();   // (its shadow)
            x.globalAlpha = alpha * (1 - dk); x.drawImage(src(k), f * 48, 0, 48, 64, a[0] - w / 2, top[1], w, hgt); x.globalAlpha = 1;
        };
        for (const o of [...this.items, ...this.glorps]) if (!o.got) put(o.x, o.y, () => o.k ? sprite('mt_items', 'vdn'.indexOf(o.k), o.x, o.y) : sprite('mt_glorp', 0, o.x, o.y));
        if (this.hand) put(this.hand.x, this.hand.y, () => sprite('mt_pickup', 0, this.hand.x, this.hand.y));
        for (const w of this.placed) put(w.x, w.y, () => sprite('mt_decoy', 0, w.x, w.y));
        for (const o of this.sentries) put(o.x, o.y, () => sprite('mt_sentry', 0, o.x, o.y, now < o.showUntil && Math.floor(now / 200) % 2 ? 0.6 : 1));
        for (const e of this.ents) if (e.pinged) put(e.x, e.y, () => sprite('mt_twin', e.pose, e.x, e.y, 0.75));
        put(this.me.x, this.me.y, () => sprite('mt_self', this.raised ? 1 : 0, this.me.x, this.me.y));
        let row = null, pend = [];
        const flush = () => { for (const d of pend) d(); pend = []; };
        for (const cl of cells) {
            if (row !== null && Math.round(cl.f) !== row) flush();
            row = Math.round(cl.f);
            const { gx, gy } = cl, c = this.map[gy][gx], k = gy * 64 + gx, dk = Math.max(0, Math.min(1, (Math.hypot(cl.r, cl.f) - O.SEE[0]) / (O.SEE[1] - O.SEE[0])));
            if (dk >= 1) { pend.push(...(who.get(k) || [])); continue; }
            // the cell's corners (right of you, ahead), near-left first, round
            const cs = [[gx, gy], [gx + 1, gy], [gx + 1, gy + 1], [gx, gy + 1]].map(([px, py]) => rf(px, py));
            const at = u => cs.map(([r, f]) => pr(r, f, u));
            const floor = at(0);
            const box = (hgt, side, top, edge, a = 1, tex = null) => {   // its faces toward the camera (textured, if it has one; the ones side-on darker), then its top
                const up = at(hgt);
                for (let i = 0; i < 4; i++) {
                    const j = (i + 1) % 4, [r0, f0] = cs[i], [r1, f1] = cs[j], em = [(r0 + r1) / 2, (f0 + f1) / 2], out = [em[0] - cl.r, em[1] - cl.f];   // (an edge; out from the cell's middle)
                    if (out[0] * (0 - em[0]) + out[1] * (-b - em[1]) <= 0) continue;   // (facing away from the camera)
                    const face = [up[i], up[j], floor[j], floor[i]];
                    if (tex) { texQuad(tex, face, a); quad(face, `rgba(5,3,10,${Math.min(1, dk + (Math.abs(out[0]) > Math.abs(out[1]) ? 0.35 : 0.1)) * a})`, edge); }
                    else quad(face, dim(side, dk, a), edge);
                }
                quad(up, dim(top, dk, a), edge);
            };
            if (c === '#' || c === 'O' || c === 'Q') { const behind = cl.f < -0.2; box(1, c === 'Q' ? '#6a3ac0' : '#2e2648', c === 'Q' ? '#b89aff' : '#3d3358', null, behind ? 0.18 : 1, c === 'Q' ? null : src(c === 'O' ? 'mt_broken' : 'mt_wall')); }
            else {
                quad(floor, dim((gx + gy) % 2 ? '#2c2342' : '#30264a', dk), dim('#1e1830', dk));
                const lt = this.lines.get(k);
                if (lt > 0) quad(floor, `rgba(80,220,190,${0.5 * lt * (1 - dk)})`); else if (lt < 0) quad(floor, `rgba(230,110,170,${0.3 * (1 - dk)})`);
                if (c === 'M' || c === 'G') {
                    const near = cl.f < -0.2 ? 0.25 : 1;   // (between it and you: faint)
                    box(1, '#a8d0ff', '#cde8ff', `rgba(207,234,255,${0.6 * (1 - dk) * near})`, 0.2 * near);
                    for (const [i, j] of [[0, 1], [1, 2], [2, 3], [3, 0]]) { const em = [(cs[i][0] + cs[j][0]) / 2, (cs[i][1] + cs[j][1]) / 2]; if ((em[0] - cl.r) * -em[0] + (em[1] - cl.f) * (-b - em[1]) > 0) texQuad(src('mt_glass'), [pr(...cs[i], 1), pr(...cs[j], 1), pr(...cs[j], 0), pr(...cs[i], 0)], (1 - dk) * near); }   // (its sheen)
                    const lab = this.labels[k] || this.marks[k], mid = pr(cl.r, cl.f, 0.55);
                    if (lab && mid) { const sz = 0.55 * O.F / mid[2]; x.globalAlpha = (this.labels[k] ? 1 : 0.5) * (1 - dk); x.drawImage(src(lab === 'M' ? 'mt_mark_m' : 'mt_mark_g'), mid[0] - sz / 2, mid[1] - sz / 2, sz, sz); x.globalAlpha = 1; }
                } else if (c === 'L' || c === 'R') {   // a stand: its mirror on the diagonal, standing
                    const [p0, p1] = c === 'L' ? [cs[3], cs[1]] : [cs[0], cs[2]];
                    quad([pr(p0[0], p0[1], 0), pr(p1[0], p1[1], 0), pr(p1[0], p1[1], 1), pr(p0[0], p0[1], 1)], `rgba(200,225,255,${0.5 * (1 - dk)})`, `rgba(232,240,255,${1 - dk})`);
                }
            }
            pend.push(...(who.get(k) || []));
        }
        flush();
        V.tex.refresh();
    }
    // the sentries: one of them on the move within reach (awake and stepping, or just woken; a sleeper doesn't) sets one off,
    // so one set down by a sleeper tells you when it wakes. It pings, and again EVERY_MS on; each ping shows you where any of
    // them in its reach are, live, for SHOW_MS (through the walls ahead of you, and from above); then it's spent
    _sentryWatch(now) {
        const S = MirrorTrial.CFG.SENTRY;
        for (const e of this.ents) e.pinged = false;
        for (const o of this.sentries) {
            const near = this.ents.filter(e => this._inReach(o, e.x, e.y));
            if (o.pings < S.PINGS && now >= o.next && (o.pings || near.some(e => e.awake && now - (e.movedAt ?? -1e9) < 400))) {
                o.pings++; o.next = now + S.EVERY_MS; o.showUntil = now + S.SHOW_MS; o.pingAt = now;
                Sfx.play(this, 'blip'); this.time.delayedCall(110, () => Sfx.play(this, 'blip'));
                if (o.pings === 1) this._note('A SENTRY PINGS: ONE OF THEM IS NEAR IT.');
            }
            if (now < o.showUntil) for (const e of near) e.pinged = true;
            if (o.pings >= S.PINGS && now >= o.showUntil) { o.spent = true; Sfx.play(this, 'pop'); }
        }
        this.sentries = this.sentries.filter(o => !o.spent);
    }
    // the view jumping at you and settling back (back once the zoom in's done: not from inside it, which would end the way back too)
    _punch(z, inMs, outMs) {
        const cam = this.cameras.main;
        cam.zoomTo(z, inMs, 'Quad.easeOut', true);
        cam.once(Phaser.Cameras.Scene2D.Events.ZOOM_COMPLETE, () => cam.zoomTo(1, outMs, 'Quad.easeOut', true));
    }
    _note(t) {
        this.tweens.killTweensOf(this.noteTxt);
        this.noteTxt.setText(t).setAlpha(1);
        this.tweens.add({ targets: this.noteTxt, alpha: 0, delay: 1300, duration: 500 });
    }
    // every frame: the vials filling back; a dash's streaks, goo dripping down the view and globs of it floating up, the screen's
    // edge flaring
    _gooTick(now, delta) {
        const C = MirrorTrial.CFG, S = C.GOO, W = this.scale.width, H = this.scale.height, g = this.fx, k = this.gooK;
        if (this.charges < this.vials) {
            if ((this.chargeT += delta) >= S.CHARGE_MS) {
                this.chargeT = 0; const can = this.cans[this.charges++];
                Sfx.play(this, 'ready');
                this.tweens.add({ targets: can.full, scale: can.P * 1.15, duration: 120, yoyo: true });
            }
        } else this.chargeT = 0;
        this.cans.forEach((c, i) => {
            for (const o of [c.empty, c.glow]) o.setVisible(i < this.vials);   // (a flask not found yet: not there)
            const f = i >= this.vials ? 0 : i < this.charges ? 1 : i === this.charges ? this.chargeT / S.CHARGE_MS : 0;
            const rows = Math.round(13 * f);   // (it fills a pixel row at a time)
            c.full.setVisible(rows > 0).setCrop(0, 13 - rows, 10, rows);
            c.glow.setAlpha(i < this.charges ? 0.25 + 0.15 * Math.sin(now / 300 + i) : 0);
        });
        this.gooGlow.setAlpha(k * 0.13);
        g.clear();
        // (all of it in the view's own chunky pixels, P screen pixels each)
        const P = Math.max(W / C.W, H / C.H), snap = v => Math.floor(v / P) * P;
        const blob = (cx, cy, r, col, a) => { g.fillStyle(col, a); for (let y = -r; y <= r; y += P) for (let x = -r; x <= r; x += P) if (x * x + y * y <= r * r) g.fillRect(snap(cx + x), snap(cy + y), P, P); };
        if (k > 0.02) {
            for (let i = 0; i < 26; i++) {   // the world rushing past
                const a = Math.random() * Math.PI * 2, r0 = H * (0.4 + Math.random() * 0.32), len = 40 + Math.random() * 160 * k;
                g.fillStyle(Math.random() < 0.35 ? 0xffffff : Math.random() < 0.5 ? 0x8ff4dc : 0x2fe8c8, 0.4 * k);
                for (let t = 0; t < len; t += P) g.fillRect(snap(W / 2 + Math.cos(a) * (r0 + t)), snap(H / 2 + Math.sin(a) * (r0 + t) * 0.7), P, P);
            }
            const edge = P * (1 + Math.round(2 * k));   // the edge of the screen, flaring
            g.fillStyle(0x2fe8c8, 0.6 * k).fillRect(0, 0, W, edge).fillRect(0, H - edge, W, edge).fillRect(0, 0, edge, H).fillRect(W - edge, 0, edge, H);
            if (Math.random() < 0.5) this.bubbles.push({ x: Math.random() * W, y: H + 8, vx: (Math.random() - 0.5) * 30, vy: -90 - Math.random() * 160, r: 3 + Math.random() * 7, life: 1 });   // globs of goo floating up
            if (Math.random() < 0.3) this.drips.push({ x: Math.random() * W, y: -4, v: 30 + Math.random() * 60, r: 5 + Math.random() * 7, len: 0 });   // goo dripping down from the top
        }
        const dt = delta / 1000;
        this.bubbles = this.bubbles.filter(b => (b.life -= dt * 0.7) > 0 && b.y > -10);
        for (const b of this.bubbles) {   // goo globs: wobbling as they go
            b.x += (b.vx + Math.sin((now + b.r * 200) / 160) * 40) * dt; b.y += b.vy * dt; b.vy *= 0.995;
            blob(b.x, b.y, Math.max(P, b.r), 0x2fb8a2, 0.6 * b.life);
            g.fillStyle(0x8ff4dc, 0.8 * b.life).fillRect(snap(b.x - b.r * 0.4), snap(b.y - b.r * 0.4), P, P);
        }
        this.drips = this.drips.filter(p => p.y < H + 30);
        for (const p of this.drips) {   // drips: a streak from the top, a drop at its end, sliding down and off
            p.v += 60 * dt; p.y += p.v * dt; p.len = Math.min(p.y, 140);
            const a = 0.6 * Math.max(k, 0.2), w = p.r > 8 ? 2 * P : P;
            g.fillStyle(0x2fb8a2, a).fillRect(snap(p.x - w / 2), 0, w, snap(p.y));
            blob(p.x, p.y, p.r, 0x2fb8a2, a);
            g.fillStyle(0x8ff4dc, a).fillRect(snap(p.x - p.r * 0.4), snap(p.y - p.r * 0.3), P, P);
        }
    }
    // walking into a pane: chalking it. A mirror rings and takes your chalk (an eye), and gives up the fragment in it, if
    // there's one; glass shatters (marked with a cross, after), and they hear it. One already chalked or cracked: nothing.
    _tap(x, y, c) {
        const C = MirrorTrial.CFG, key = y * 64 + x;
        if (this.labels[key]) return this.cameras.main.shake(60, 0.002);
        this.labels[key] = c;
        if (c === 'G') return this._shatter(x, y);
        this._noise(x, y, C.WAKE.TAP);
        Sfx.play(this, 'clink'); this.cameras.main.shake(60, 0.002);
        if (!this.frags.has(key)) return this._note('IT RINGS: A MIRROR. CHALKED. NOTHING IN IT.');
        this.frags.delete(key); this.found++;
        Sfx.play(this, 'pickup'); this.time.delayedCall(120, () => Sfx.play(this, 'ready')); this.cameras.main.flash(260, 200, 220, 255);
        const sleepers = this.ents.filter(e => !e.awake).sort((a, b) => (Math.abs(a.x - x) + Math.abs(a.y - y)) - (Math.abs(b.x - x) + Math.abs(b.y - y)));   // (each fragment wakes the nearest still asleep)
        if (sleepers[0]) this._wake(sleepers[0]);
        if (this.found < C.NEED) for (const e of this.ents) if (e.awake) this._rile(e, C.MOOD.FRAG);   // (each fragment riles them a little)
        if (this.found < C.NEED) this._say(`A FRAGMENT OF THE WAY OUT  ${this.found}/${C.NEED}`, 'It comes out of the mirror into your hand. They\'re getting restless.', '#bfd8ff', 2400);
        else if (this.found === C.NEED) {   // the way out, whole: and every one of them up for the run home
            this.done = true;
            this.map.forEach(row => row.forEach((ch, i) => { if (ch === 'O') row[i] = 'Q'; }));
            for (const e of this.ents) { this._wake(e); this._rile(e, 0); }   // (all hunting)
            Sfx.play(this, 'surge'); this.cameras.main.shake(400, 0.008);
            this._say('THE MIRROR IS WHOLE', 'Go back the way you came. Through it.\nAnd they\'re all awake now.', '#bfeeff', 3600);
        } else {   // one more than it needed: worth glorps
            const G = this.scene.get('Game');
            this.gotGlorps += C.BONUS; if (G) { G.totalGlorps = (G.totalGlorps || 0) + C.BONUS; try { localStorage.setItem('glorps', G.totalGlorps); } catch (e) {} }
            this.glorpTxt.setText(`✦ ${this.gotGlorps}`); Sfx.play(this, 'coin');
            this._say(`A FRAGMENT MORE  ${this.found}/${C.FRAGMENTS}`, `The way out didn\'t need it. +${C.BONUS} glorps.`, '#bfd8ff', 2400);
        }
        this._hud();
    }
    // glass, chalked: it shatters, loud. The awake lunge at you (LUNGE steps, watched or not); the asleep near it wake
    _shatter(x, y) {
        const C = MirrorTrial.CFG;
        this.shattered = (this.shattered || 0) + 1;
        Sfx.play(this, 'shatter'); Sfx.play(this, 'boom', { big: true }); this.cameras.main.shake(320, 0.012);
        this.tweens.killTweensOf(this.stingWash); this.stingWash.setAlpha(0.3); this.tweens.add({ targets: this.stingWash, alpha: 0, duration: 400 });
        this._note('GLASS. IT SHATTERS. THEY HEARD THAT.');
        for (const e of this.ents) if (e.awake) { this._rile(e, C.MOOD.SHATTER); for (let k = 0; k < C.SHATTER.LUNGE && !this.caught; k++) this._entStep(e, true); }   // (and riled, a whole stage)
        if (!this.caught) this._noise(x, y, C.SHATTER.WAKE);
    }
    _act(k) {
        if (k === 'KeyW' || k === 'ArrowUp') this._step(1);
        else if (k === 'KeyS' || k === 'ArrowDown') this._step(-1);
        else if (k === 'KeyA' || k === 'ArrowLeft') this._turn(-1);
        else if (k === 'KeyD' || k === 'ArrowRight') this._turn(1);
        else if (k === 'ShiftLeft' || k === 'ShiftRight') this._dash();
    }
    _open(x, y) { return this.map[y]?.[x] === '.'; }
    _step(s) {
        const [dx, dy] = MirrorTrial.DIRS[this.me.dir], x = this.me.x + dx * s, y = this.me.y + dy * s;
        if (this.done && this.map[y]?.[x] === 'Q') return this._escape();   // back through the mirror, whole
        const c = this.map[y]?.[x];
        if (c === 'L' || c === 'R') { this.map[y][x] = c === 'L' ? 'R' : 'L'; Sfx.play(this, 'switch'); this.cameras.main.shake(60, 0.003); this._noise(x, y, MirrorTrial.CFG.WAKE.TURN); return; }   // a stand: turned a quarter
        if (c === 'M' || c === 'G') return this._tap(x, y, c);
        if (!this._open(x, y) || this.ents.some(e => e.x === x && e.y === y)) { this.cameras.main.shake(80, 0.004); return; }
        this.me.x = x; this.me.y = y; this.moving = true;
        this.tweens.add({ targets: this.view, x: x + 0.5, y: y + 0.5, duration: MirrorTrial.CFG.STEP_MS, ease: 'Sine.easeInOut', onComplete: () => this._moved() });
    }
    _turn(s) {
        this.me.dir = (this.me.dir + s + 4) % 4; this.moving = true;
        this.tweens.add({ targets: this.view, a: this.view.a + s * Math.PI / 2, duration: MirrorTrial.CFG.TURN_MS, ease: 'Sine.easeInOut', onComplete: () => this._moved() });
    }
    _moved() {
        this.moving = false;
        this._pickUp();
        const q = this.queued; this.queued = null;
        if (q && !this.caught && !this.leaving) this._act(q);
    }
    // standing on a shard: the one for your hand, or one of the way out's (all three: it's whole); on glorps: yours (the purse
    // you came in with)
    _pickUp() {
        const { x, y } = this.me, gl = this.glorps.find(o => !o.got && o.x === x && o.y === y), it = this.items.find(o => !o.got && o.x === x && o.y === y);
        if (it) {   // a tool, and what it does
            it.got = true; Sfx.play(this, 'pickup'); this.time.delayedCall(90, () => Sfx.play(this, 'ready'));
            if (it.k === 'v') {
                const can = this.cans[this.vials++]; this.charges++;
                this.tweens.add({ targets: can.full, scale: can.P * 1.3, duration: 140, yoyo: true });
                this._say('A FLASK OF YOUR GOO', this.vials === 1 ? 'SHIFT: a dash, a few tiles on in a flash, past one of them if it\'s in the way.\nLoud. It fills back up, slowly.' : this.vials === 2 ? 'Two now. They fill back up one at a time.' : 'A third.', '#8ff4dc', 3200);
            } else if (it.k === 'd') { this.wards++; this._say('A DECOY SLIME, ASLEEP', 'Q sets it down, staring the way you face.\nThey take it for you: whatever it stares at holds. It\'s made of reflection: a mirror shows it, even straight on.', '#ffaad2', 3600); }
            else { this.sentryLeft++; this._say('A SENTRY SLIME, ASLEEP', 'E sets it down. When one of them moves near it (even a wall away), or one asleep by it wakes, it pings twice:\neach ping shows you where they are. Then it\'s spent. It\'s made of reflection: a mirror shows it, even straight on.', '#8ff4dc', 3600); }
            this._hud();
        }
        if (gl) {
            const G = this.scene.get('Game'), W = this.scale.width, H = this.scale.height;
            gl.got = true; this.gotGlorps += gl.n;
            if (G) { G.totalGlorps = (G.totalGlorps || 0) + gl.n; try { localStorage.setItem('glorps', G.totalGlorps); } catch (e) {} }
            Sfx.play(this, 'coin'); this.time.delayedCall(70, () => Sfx.play(this, 'pickup'));
            this.glorpTxt.setText(`✦ ${this.gotGlorps}`).setScale(1.5);
            this.tweens.add({ targets: this.glorpTxt, scale: 1, duration: 260, ease: 'Back.easeOut' });
            const pop = this.add.text(W / 2, H * 0.62, `+${gl.n}`, { fontSize: '40px', fontFamily: UIKit.FONT.title, fontStyle: 'bold', color: '#5dffb8', stroke: '#05030a', strokeThickness: 6 }).setOrigin(0.5).setDepth(6);
            this.tweens.add({ targets: pop, y: pop.y - 70, alpha: 0, scale: 1.3, duration: 700, ease: 'Quad.easeOut', onComplete: () => pop.destroy() });
            this.cameras.main.flash(90, 60, 200, 120);
        }
        if (this.hand && this.hand.x === x && this.hand.y === y) {
            this.hand = null; this.holding = true; this.shard.setVisible(true);
            Sfx.play(this, 'pickup');
            this._say('A SHARD OF MIRROR', 'Hold SPACE to see what\'s behind you, while your arm holds out.\nThe mirrors here only show you in it, held up to your eyes.\nHold one of them in it a while: they don\'t like being caught in a reflection.', '#bfd8ff', 5200);
            this._hud();
            return;
        }
    }

    update(time, delta) {
        if (this.reading) return;   // (the guide open: the hall holds still)
        const C = MirrorTrial.CFG, now = this.time.now;
        // a dash's goo over the view and the view widened: in quickly, held, back out, worked out from the time since the dash
        // each frame, so another dash or TAB can never leave the view stuck wide (a yoyo tween killed partway did)
        const dt = now - (this.dashAt ?? -1e9), dk = dt < 90 ? 1 - (1 - dt / 90) ** 2 : dt < 350 ? 1 : dt < 440 ? 1 - (dt - 350) / 90 : 0;
        this.gooK = dk; this.fovK = 1 + (C.GOO.FOV - 1) * dk;
        this._gooTick(now, delta);
        // your reflection: a beat behind you (where you were ECHO_MS ago, the shard up or not)
        this.echoes.push({ at: now, x: this.view.x, y: this.view.y, up: this.raised });
        while (this.echoes.length > 1 && now - this.echoes[1].at >= C.ECHO_MS) this.echoes.shift();
        // ahead (watching, the shard held up covering some of it), and the shard's view: behind you, flipped as a mirror shows it;
        // the wards' stares; the sentries' lines
        for (const e of this.ents) { e.seen = false; e.dpx = 0; e.rpx = 0; }
        this._sentryWatch(now);
        this._sentryLines(now);
        // the shard held up: your arm tiring (the shard shaking, sinking) till it gives out and drops it; down, resting
        if (this.raised) {
            this.arm -= delta / C.ARM.HOLD_MS;
            if (this.arm <= 0) { this.arm = 0; this.armOut = true; this.raised = false; this._shardAt(false, C.RAISE_MS); Sfx.play(this, 'deny'); this._note('YOUR ARM GIVES OUT.'); }
        } else if (!this.wiping && (this.arm = Math.min(1, this.arm + delta / C.ARM.REST_MS)) >= C.ARM.BACK) this.armOut = false;   // (wiping, it's busy)
        const [spent, full] = this.arms, Wd = this.scale.width, Hd = this.scale.height, up = Math.max(0, Math.min(1, (this.shard.scaleX - 2.4) / 3.6)), rows = Math.round(30 * this.arm);   // (beside the shard, low or held up)
        for (const a of this.arms) a.setVisible(this.holding).setPosition(Wd - 290 - 320 * up, Hd - 100 - (Hd / 2 - 130) * up);
        full.setVisible(this.holding && rows > 0).setCrop(0, 30 - rows, 9, rows);
        spent.setAlpha(this.armOut && Math.floor(now / 220) % 2 ? 0.45 : 1);
        // the shard fogging up while it's down: clear a while, then a smudge at a time, at random; F held rubs it clean (and, clean,
        // it's clear a while again)
        const B = C.BLUR;
        if (this.holding && !this.raised) {
            if (this.wiping) {
                this.blur = this.blurTo = Math.max(0, this.blur - delta / B.WIPE_MS);
                this.blurAt = now + Phaser.Math.Between(...(this.blur ? B.STEP_MS : B.CLEAR_MS));
                if (now - (this.wipeAt || 0) > 260) { this.wipeAt = now; Sfx.play(this, 'hover'); }
            } else if (now >= this.blurAt && this.blurTo < 1) {
                this.blurTo = Math.min(1, this.blurTo + B.STEP); this.blurAt = now + Phaser.Math.Between(...B.STEP_MS);
                if (!this.toldBlur) { this.toldBlur = true; this._note('YOUR SHARD\'S FOGGING UP. HOLD F TO WIPE IT.'); }
            }
        } else if (this.raised) this.blurAt += delta;   // (in use: it doesn't)
        this.blur = Math.min(this.blurTo, this.blur + delta / B.FADE_MS);
        const tire = this.raised ? (1 - this.arm) ** 2 : 0, rub = this.wiping && !this.raised ? Math.sin(now / 40) * 2 : 0;
        for (const c of this.shard.list) c.setPosition((Math.random() - 0.5) * 2.4 * tire + rub, (Math.random() - 0.5) * 2.4 * tire + 5 * tire);
        this.front.cover = this.raised && this.shard;
        this._render(this.front, this.view.a, C.FOV * this.fovK, false, !this.mapUp);
        if (this.holding) this._render(this.back, this.view.a + Math.PI, C.BACK.FOV, true, this.raised);
        if (now < this.blackUntil) for (const e of this.ents) e.seen = false;   // (blacked out: you hold nothing)
        for (const e of this.ents) if (e.reaching && e.seen && !e.oops) { e.oops = true; Sfx.play(this, 'hall_voice', { ...(this._where(e) || {}), near: 1, v: 'hv_whoops' }); }   // (turned and caught it reaching: whoops)
        this._dread(now, delta);
        for (const e of this.ents) if (e.truly && !e.trueSeen && e.dpx >= C.SEEN_PX && !this.caught) this._trueFace(e);
        // one caught in a reflection, held there: it fades and, long enough, leaves
        for (const e of this.ents) {
            if (e.awake && e.rpx >= C.SEEN_BACK && now >= this.blackUntil && !this.caught) { if ((e.shy = (e.shy || 0) + delta) >= C.SHOO_MS) this._shoo(e); }   // (any mood: a calm one goes too)
            else e.shy = Math.max(0, (e.shy || 0) - delta);
        }
        this._wardsWatch(now);
        this._mapShow(this.mapUp ? 'big' : null);
        if (this.mapImg.visible) this._overDraw(now);
        if (!this.caught && !this.escaped && !this.leaving && now - this.t0 > C.GRACE_MS && now >= this.calmUntil) {
            const ms = Math.max(C.ENT_MIN, C.ENT_MS - C.ENT_SHARD * this.found);
            for (const e of this.ents) {
                if (!e.awake) { if (Math.abs(e.x - this.me.x) + Math.abs(e.y - this.me.y) <= C.WAKE.NEAR || now >= (e.restUntil ?? Infinity)) this._wake(e); continue; }   // (asleep: still, till you come too near, or its rest is over)
                this._rile(e, delta / 1000 / (e.rile < 1 ? C.MOOD.PLAY_S : C.MOOD.HUNT_S) * (e.dpx >= C.SEEN_PX ? C.MOOD.STARE : 1));   // (riled, slowly; stared at, a little quicker)
                if (this._sees(e)) e.sawAt = now;
                else if (e.mood === 'hunt' && now - (e.sawAt ?? now) >= C.MOOD.COOL_MS) { e.sawAt = now; this._rile(e, 1.5 - e.rile); }   // (lost you a while: it cools to playful, unless the way out is whole)
                if (e.seen) e.t = 0;
                else if ((e.t += delta) >= ms * C.MOOD[e.mood || 'play'] * (this._sees(e) ? C.MOOD.SEES : C.MOOD.LOST) * (0.85 + 0.3 * ((e.x * 7 + e.y * 3) % 5) / 4)) { e.t = 0; this._entStep(e); if (this.caught) break; }   // (not all in step)
            }
        }
    }

    // Unseen long enough: a step toward you (the shortest way, round the others), in a new pose for how near it is; next to
    // you, it has you
    _entStep(e, atYou = false) {   // (atYou: straight at you whatever its way: glass breaking)
        const me = this.me, toMe = this._path(e, me.x, me.y);
        if (!toMe) return;
        const [tx, ty] = atYou ? [me.x, me.y] : this._target(e, toMe), path = tx === me.x && ty === me.y ? toMe : this._path(e, tx, ty) || toMe;
        if (path.length < 2) return;   // (there already: it waits, out of sight)
        const [nx, ny] = path[1];
        if (nx === me.x && ny === me.y) return e.reaching ? this._prank(e) : this._reach(e);   // (next to you: it reaches first, then it has you)
        e.reaching = false;
        e.x = nx; e.y = ny; e.movedAt = this.time.now;
        this.closest = Math.min(this.closest, Math.abs(nx - me.x) + Math.abs(ny - me.y));
        // a new look (never the one it had): right behind a pane between you, mostly up against the glass; else its mood's,
        // however near (so you can always tell how riled it is); the ones holding a corridor's walls only in a corridor running at you
        const P = MirrorTrial.POSES, L = MirrorTrial.LOOKS[e.way], near = (this._path(e, me.x, me.y)?.length ?? 99) - 1, along = Math.abs(nx - me.x) >= Math.abs(ny - me.y), was = e.pose;
        const sx = along ? Math.sign(me.x - nx) : 0, sy = along ? 0 : Math.sign(me.y - ny), pane = this.map[ny + sy]?.[nx + sx];
        const atPane = (pane === 'M' || pane === 'G') && Math.abs(along ? me.x - nx : me.y - ny) >= 2;
        const walled = along ? !this._open(nx, ny - 1) && !this._open(nx, ny + 1) : !this._open(nx - 1, ny) && !this._open(nx + 1, ny);
        const backed = (sx || sy) && !this._open(nx - sx, ny - sy) && !this.map[ny - sy]?.[nx - sx]?.match(/[MG]/);   // (stone right behind it, away from you)
        // a look holds for LOOK_STEPS steps, so you can make it out: a new one sooner only when its mood turns (you see it turn), or
        // when the look no longer fits where it stands (off the glass, out of the corridor, no wall behind it)
        const wasGlass = was >= P.GLASS[0] && was <= P.GLASS[1], turned = e.lookMood !== e.mood;
        const fits = wasGlass ? atPane : (L[e.mood || 'play'].includes(was) && (walled || !P.CORRIDOR.includes(was)) && (backed || !P.WALLED.includes(was)));
        const glass = wasGlass && fits && !turned ? true : atPane && !turned && Math.random() < 0.75;
        if ((e.lookLeft || 0) > 0 && fits && !turned) e.lookLeft--;
        else {
            const looks = (glass ? L.GLASS : L[e.mood || 'play']).filter(f => f !== was && (walled || !P.CORRIDOR.includes(f)) && (backed || !P.WALLED.includes(f)));
            e.pose = looks[Math.floor(Math.random() * looks.length)]; e.lookMood = e.mood;
            const [a0, a1] = MirrorTrial.CFG.LOOK_STEPS; e.lookLeft = a0 - 1 + Math.floor(Math.random() * (a1 - a0 + 1));
        }
        if (e.pose !== was) this._lookSound(e);
        const inGlass = e.pose >= P.GLASS[0] && e.pose <= P.GLASS[1];
        e.lean = inGlass ? [sx, sy] : P.WALLED.includes(e.pose) ? [-sx, -sy] : null;
        e.truly = !inGlass && near >= 3 && Math.random() < MirrorTrial.CFG.MOOD.TRUE; e.trueSeen = false;   // (now and then, what it really is: only straight on)   // (up against the glass, or flat on the wall behind)
        if (near <= 2 && (e.near ?? 9) > 2) e.fresh = true;   // (come right up on you: the first time you see it there, the sting)
        e.near = near;
        this._hear(e);
    }
    // where one is, to your ears: left or right of the way you face, louder the nearer, dull through stone (null: too far off)
    _where(e) {
        const dx = e.x - this.me.x, dy = e.y - this.me.y, d = Math.hypot(dx, dy);
        if (d > MirrorTrial.CFG.HEAR) return null;
        const a = this.view.a, pan = (dx * -Math.sin(a) + dy * Math.cos(a)) / (d || 1);
        let muffled = false;
        for (let i = 1, n = Math.ceil(d * 2); i < n && !muffled; i++) { const c = this.map[Math.floor(this.me.y + 0.5 + dy * i / n)]?.[Math.floor(this.me.x + 0.5 + dx * i / n)]; muffled = c === '#' || c === 'O' || c === 'Q'; }
        return { pan, near: Math.max(0, 1 - d / MirrorTrial.CFG.HEAR), muffled };
    }
    // one moving, heard
    _hear(e) { const w = this._where(e); if (w) Sfx.play(this, 'shift', w); }
    // one giggling (far off: faint, from nowhere you can tell)
    _giggle(e, n = 0) { Sfx.play(this, 'hall_giggle', { ...(this._where(e) || { near: 0.1, muffled: true }), n }); }
    // one wakes, calm (hunting once the way out is whole); its eyes open (seen as
    // it happens: a jolt)
    _wake(e) {
        if (e.awake) return;
        e.rile = 0; e.mood = null; this._rile(e, 0); e.restUntil = null;
        e.awake = true; e.sawAt = this.time.now; e.pose = MirrorTrial.LOOKS[e.way][e.mood][0]; e.lean = null; e.t = -MirrorTrial.CFG.WAKE.MS; e.movedAt = this.time.now;   // (stirring: a sentry near it hears that)   // (coming to: a moment before its first step, to see it coming)
        Sfx.play(this, 'tell'); this.time.delayedCall(500, () => !this.caught && this._giggle(e));
        this._note('SOMETHING WOKE UP. IT WANTS TO PLAY.');
        if (e.seen) { this.tweens.killTweensOf(this.stingWash); this.stingWash.setAlpha(0.25); this.tweens.add({ targets: this.stingWash, alpha: 0, duration: 500 }); this.cameras.main.shake(140, 0.006); }
    }
    // a noise at (x, y): any asleep within r tiles wakes, and every one there's riled a little
    _noise(x, y, r) {
        for (const e of this.ents) if (Math.abs(e.x - x) + Math.abs(e.y - y) <= r) { this._wake(e); this._rile(e, MirrorTrial.CFG.MOOD.NOISE); }
    }
    // how riled one is (rile): under 1 calm, under 2 playful, then hunting. It climbs (a hunter that lost you a while cools to
    // playful), never below hunting once the way out is whole, till a shoo or a prank calms it right down (_sendOff)
    _rile(e, by) {
        const was = e.mood, floor = this.found >= MirrorTrial.CFG.NEED ? 2 : 0;
        e.rile = Math.min(2.5, Math.max(floor, (e.rile || 0) + by));
        e.mood = e.rile >= 2 ? 'hunt' : e.rile >= 1 ? 'play' : 'calm';
        if (was && e.mood !== was && by > 0 && e.awake && !this.caught) this._moodUp(e);
    }
    // a stage worse, and you hear it: a giggle (playful); a low, quick one (hunting)
    _moodUp(e) {
        if (e.mood !== 'hunt') return this._giggle(e);
        Sfx.play(this, 'hall_giggle', { ...(this._where(e) || { near: 0.15, muffled: true }), low: true, n: 2 });
        this._note('YOU HEAR ONE OF THEM START HUNTING.');
    }
    // one of them can see you: a straight line to you through nothing but floor and panes
    _sees(e) {
        const dx = this.me.x - e.x, dy = this.me.y - e.y, n = Math.ceil(Math.hypot(dx, dy) * 2);
        for (let i = 1; i < n; i++) { const c = this.map[Math.floor(e.y + 0.5 + dy * i / n)]?.[Math.floor(e.x + 0.5 + dx * i / n)]; if (c !== '.' && c !== 'M' && c !== 'G') return false; }
        return true;
    }
    // Out: the ending (if its pictures are in), then how it went
    _escape() {
        if (this.escaped) return;
        this.escaped = true;
        const t = (this.time.now - this.t0) / 1000;   // (your time stops as you step through)
        for (const o of [this.title, this.sub, this.noteTxt, this.countTxt, this.keysTxt]) { this.tweens.killTweensOf(o); o.setAlpha(0); }   // (what was being said: gone)
        if (MirrorTrial.ENDING.every(k => this.textures.exists(k))) this._ending(() => this._endCard(t));
        else this._endCard(t);
    }
    static ENDING = ['mt_end_relief', 'mt_end_cower', 'mt_end_sad', 'mt_end_loom', 'mt_end_kid1', 'mt_end_kid2', 'mt_end_kid3'];
    // The ending, about eleven seconds (Enter, Space or Esc skip it): you, through, sweating with relief ("Finally. I can be free
    // of this terrible place."); then three of them loom up round you, huge and dark, and you cower; the mirror blazes up behind
    // them, the dark burns off, and they're only what they really are, three little slimes who wanted to play; and you're sad to go
    _ending(done) {
        const W = this.scale.width, H = this.scale.height, D = 7, objs = [], cam = this.cameras.main, add = o => { objs.push(o); return o; };
        let over = false;
        this.ending = true;
        const finish = () => {
            if (over) return;
            over = true; this.ending = false;
            this.tweens.killTweensOf(objs); objs.forEach(o => o !== bg && o.destroy());   // (the dark stays: what comes next goes over it)
            done();
        };
        this._endingSkip = finish;
        const at = (ms, fn) => this.time.delayedCall(ms, () => { if (!over) fn(); });
        const sc = Math.round(H / 115), feet = H * 0.86;   // (your slime about a quarter of the screen tall)
        const bg = add(this.add.rectangle(0, 0, W, H, 0x05030a).setOrigin(0).setAlpha(0).setDepth(D));
        if (!this.textures.exists('mt_end_glow')) {   // the mirror's light: soft, falling away from its middle (a light, so drawn here)
            const R = 256, tx = this.textures.createCanvas('mt_end_glow', R * 2, R * 2), cx = tx.getContext(), gr = cx.createRadialGradient(R, R, 0, R, R, R);
            gr.addColorStop(0, 'rgba(255,250,255,1)'); gr.addColorStop(0.25, 'rgba(214,196,255,0.75)'); gr.addColorStop(0.6, 'rgba(150,120,230,0.25)'); gr.addColorStop(1, 'rgba(90,60,180,0)');
            cx.fillStyle = gr; cx.fillRect(0, 0, R * 2, R * 2); tx.refresh();
        }
        const glow = add(this.add.image(W / 2, H * 0.5, 'mt_end_glow').setScale(H * 1.2 / 512 * 0.4).setAlpha(0).setDepth(D).setBlendMode(Phaser.BlendModes.ADD));   // (the mirror's light, behind them)
        const you = add(this.add.image(W / 2, feet, 'mt_end_relief').setOrigin(0.5, 1).setScale(sc).setDepth(D + 3).setAlpha(0));
        const say = add(this.add.text(W / 2, H * 0.16, '', { fontSize: '26px', fontFamily: UIKit.FONT.title, fontStyle: 'bold', color: '#f0ece0', stroke: '#05030a', strokeThickness: 6, align: 'center', wordWrap: { width: W * 0.8 } }).setOrigin(0.5).setDepth(D + 4));
        const line = (s, col = '#f0ece0') => { say.setColor(col).setText(''); let n = 0; const ev = this.time.addEvent({ delay: 38, repeat: s.length - 1, callback: () => { if (!over) say.setText(s.slice(0, ++n)); } }); objs.push({ destroy: () => ev.remove() }); };
        const spots = [[W * 0.24, 0.92, -1], [W / 2, 1.08, 1], [W * 0.76, 0.92, 1]];   // (x, size, which way it faces)
        // 1. relief
        this.cameras.main.flash(500, 200, 170, 255); Sfx.play(this, 'surge');
        this.tweens.add({ targets: bg, alpha: 1, duration: 600 });
        this.tweens.add({ targets: you, alpha: 1, duration: 600 });
        this.tweens.add({ targets: you, scaleY: sc * 0.95, scaleX: sc * 1.04, duration: 900, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });   // (breathing hard)
        at(700, () => line('Finally... I can be free of this terrible place.'));
        // 2. they loom
        const looms = spots.map(([x, k, f]) => add(this.add.image(x, feet + H * 0.1, 'mt_end_loom').setOrigin(0.5, 1).setScale(sc * 1.6 * k).setFlipX(f < 0).setDepth(D + 2).setAlpha(0)));
        at(3400, () => {
            say.setText(''); Sfx.play(this, 'boom', { big: true }); Sfx.play(this, 'heartbeat', { hard: 1 }); cam.shake(500, 0.008);
            looms.forEach((l, i) => this.tweens.add({ targets: l, alpha: 1, y: feet - H * 0.02, delay: i * 160, duration: 900, ease: 'Cubic.easeOut' }));
            this.tweens.killTweensOf(you); you.setTexture('mt_end_cower').setScale(sc);
            this.tweens.add({ targets: you, x: { from: W / 2 - 3, to: W / 2 + 3 }, duration: 45, yoyo: true, repeat: -1 });   // (shaking)
        });
        at(4300, () => Sfx.play(this, 'heartbeat', { hard: 1 }));
        at(5100, () => { Sfx.play(this, 'heartbeat', { hard: 1 }); Sfx.play(this, 'hall_giggle', { near: 1, low: true, n: 2 }); });
        // 3. the mirror blazes up, and they're only little
        const kids = [W * 0.2, W * 0.35, W * 0.78].map((x, i) => add(this.add.image(x, feet, 'mt_end_kid' + (i + 1)).setOrigin(0.5, 1).setScale(0).setDepth(D + 2)));   // (round you, not behind you)
        at(6200, () => {
            Sfx.play(this, 'ready'); Sfx.play(this, 'fanfare'); cam.flash(700, 230, 215, 255);
            this.tweens.add({ targets: glow, alpha: 0.85, scale: H * 1.2 / 512, duration: 900, ease: 'Cubic.easeOut' });
            this.tweens.add({ targets: glow, alpha: 0.6, delay: 900, duration: 1400, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });   // (it breathes)
            looms.forEach(l => this.tweens.add({ targets: l, alpha: 0, scaleY: l.scaleY * 0.3, duration: 500, ease: 'Quad.easeIn' }));
            kids.forEach((c, i) => this.time.delayedCall(250 + i * 130, () => {
                if (over) return;
                this.tweens.add({ targets: c, scale: sc * 1.3, duration: 420, ease: 'Back.easeOut' });
                this.tweens.add({ targets: c, y: feet - sc * 3, delay: 500 + i * 90, duration: 260, yoyo: true, repeat: -1, repeatDelay: 380, ease: 'Quad.easeOut' });   // (bouncing: they want to play)
            }));
            this.tweens.killTweensOf(you); you.setX(W / 2).setTexture('mt_end_relief');
        });
        at(6700, () => Sfx.play(this, 'hall_giggle', { near: 1 }));
        at(7300, () => Sfx.play(this, 'hall_giggle', { near: 0.8, pan: -0.5 }));
        at(7700, () => line('...oh. They only wanted to play.', '#d8c8ff'));
        // 4. and you're sad to go
        at(8600, () => { you.setTexture('mt_end_sad'); this.tweens.add({ targets: you, scaleY: sc * 0.96, duration: 1200, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' }); });
        at(9000, () => kids.forEach((c, i) => this.tweens.add({ targets: c, angle: { from: -8, to: 8 }, delay: i * 120, duration: 300, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' })));   // (waving you off)
        at(10200, () => line("I'll miss them.", '#bfd8ff'));
        at(11600, () => this.tweens.add({ targets: objs.filter(o => o.setAlpha && o !== bg), alpha: 0, duration: 600, onComplete: finish }));
    }
    // how it went: your time and your best, the glorps, how often they got you, how close they came
    _endCard(t) {
        const W = this.scale.width, H = this.scale.height;
        let best = 0; try { best = parseFloat(localStorage.getItem('mt_best')) || 0; } catch (e) {}
        const isBest = !best || t < best; if (isBest) try { localStorage.setItem('mt_best', t.toFixed(1)); } catch (e) {}
        const clock = v => `${Math.floor(v / 60)}:${(v % 60).toFixed(1).padStart(4, '0')}`;
        Sfx.play(this, 'fanfare'); this.cameras.main.flash(400, 200, 170, 255);
        this.add.rectangle(0, 0, W, H, 0x05030a).setOrigin(0).setAlpha(0.82).setDepth(7);
        const line = (y, s, size, col) => this.add.text(W / 2, y, s, { fontSize: size, fontFamily: y < H * 0.3 ? UIKit.FONT.title : 'monospace', fontStyle: 'bold', color: col, stroke: '#05030a', strokeThickness: 5, align: 'center' }).setOrigin(0.5).setDepth(8);
        line(H * 0.24, 'YOU GOT OUT', '44px', '#d8c8ff');
        line(H * 0.38, `TIME  ${clock(t)}`, '24px', '#f0ece0');
        line(H * 0.38 + 34, isBest ? (best ? `NEW BEST  (was ${clock(best)})` : 'YOUR FIRST TIME OUT') : `BEST  ${clock(best)}`, '16px', isBest ? '#ffd84a' : '#a898c8');
        line(H * 0.52, `GLORPS  +${this.gotGlorps}`, '18px', '#5dffb8');
        line(H * 0.52 + 30, this.pranks ? `THEY GOT YOU ${this.pranks} TIME${this.pranks > 1 ? 'S' : ''}` : 'THEY NEVER GOT YOU', '18px', '#f0ece0');
        line(H * 0.52 + 90, this.shattered ? `GLASS YOU SHATTERED  ${this.shattered}` : 'YOU NEVER SHATTERED THE GLASS', '18px', '#bfd8ff');
        line(H * 0.52 + 180, `FRAGMENTS  ${this.found} OF ${MirrorTrial.CFG.FRAGMENTS}`, '18px', '#bfd8ff');
        line(H * 0.52 + 150, this.shooed ? `YOU SENT ${this.shooed} OF THEM OFF` : 'YOU NEVER SENT ONE OFF', '18px', '#8ff4dc');
        line(H * 0.52 + 120, this.breaks ? `YOU BLACKED OUT ${this.breaks} TIME${this.breaks > 1 ? 'S' : ''}` : 'YOU NEVER BLACKED OUT', '18px', '#f0ece0');
        line(H * 0.52 + 60, this.closest === Infinity ? 'NONE OF THEM GOT NEAR YOU' : `CLOSEST CALL  ${this.closest} TILE${this.closest > 1 ? 'S' : ''} AWAY`, '18px', '#ff9ab8');
        line(H * 0.88, 'ENTER  again        ESC  leave', '16px', '#8a7aa8');
    }
    // One reached you: a prank, a different one each time (never the same twice running): BOO, its face slammed into yours; the
    // lights out and its eyes opening in the dark, right in front of you; a splat, leapt onto your face; or grabbed and spun round,
    // left facing the other way. A beat, then it laughs, and it's gone (asleep again, far off). It stays with you: STRESS.PRANK
    // more stress, for good. While you get your breath back (and while it's at it), none of them moves
    static PRANKS = { boo: '_boo', dark: '_lightsOut', splat: '_splat', spin: '_spin' };
    _prank(e) {
        const C = MirrorTrial.CFG, now = this.time.now;
        if (now < this.calmUntil) return;
        this.pranks++; this.scarred = Math.min(1, this.scarred + C.STRESS.PRANK);
        if (this.raised) { this.raised = false; this._shardAt(false, C.RAISE_MS); }
        const kind = this.lastPrank = Phaser.Utils.Array.GetRandom(Object.keys(MirrorTrial.PRANKS).filter(k => k !== this.lastPrank));
        const laugh = this[MirrorTrial.PRANKS[kind]]();   // (how long till it laughs)
        this.calmUntil = now + Math.max(C.STRESS.CALM_MS, laugh + 1100);
        this._sendOff(e);
        this._startle(e);
        this.time.delayedCall(laugh, () => {
            Sfx.play(this, 'hall_giggle', { near: 1, n: 3 });
            if (this.scarred >= 0.999) return this._die();
            this._note(this.scarred + C.STRESS.DREAD * 0.5 >= 1 ? 'GOT YOU. YOUR HEART CAN\'T TAKE MUCH MORE.' : 'GOT YOU. IT\'S LAUGHING.');
        });
    }
    // BOO: the biggest scare it has, slammed into your face
    _boo() {
        const W = this.scale.width, H = this.scale.height, cam = this.cameras.main;
        Sfx.play(this, 'boom', { big: true }); Sfx.play(this, 'bosshit'); Sfx.play(this, 'whoosh');
        Sfx.play(this, 'hall_voice', { v: 'hv_boo', near: 1, vol: 1, rate: 0.86, double: 0.5, grit: 0.2 });
        cam.shake(420, 0.02); this._punch(1.18, 60, 500);
        this.tweens.killTweensOf(this.stingWash); this.stingWash.setAlpha(0.7); this.tweens.add({ targets: this.stingWash, alpha: 0, duration: 600, ease: 'Quad.easeIn' });
        const fs = H * 1.15 / this.textures.get('mt_face').getSourceImage().height, face = this.add.image(W / 2, H / 2, 'mt_face').setScale(fs * 1.8).setDepth(5);   // (its own drawing, made for the whole screen)
        this.tweens.add({ targets: face, scale: fs, duration: 140, ease: 'Back.easeOut' });
        this.tweens.add({ targets: face, alpha: 0, delay: 900, duration: 350, onComplete: () => face.destroy() });
        return 900;
    }
    // lights out: black, your heart; then its eyes snap open in the dark, right in front of you, and blink, slowly, before the
    // light comes back (you hold nothing while it's dark: nothing builds your dread either)
    _lightsOut() {
        const W = this.scale.width, H = this.scale.height, cam = this.cameras.main, now = this.time.now;
        this.tweens.killTweensOf(this.black); this.black.setAlpha(1); this.blackUntil = Math.max(this.blackUntil, now + 1750);
        Sfx.play(this, 'heartbeat', { hard: 1 });
        const sc = W * 0.62 / this.textures.get('mt_prank_eyes').getSourceImage().width, eyes = this.add.image(W / 2, H * 0.45, 'mt_prank_eyes_shut').setScale(sc).setDepth(5.6).setAlpha(0);
        const at = (ms, key) => this.time.delayedCall(ms, () => eyes.active && eyes.setTexture(key));
        this.time.delayedCall(560, () => { eyes.setAlpha(1); Sfx.play(this, 'boom', { big: true }); Sfx.play(this, 'whoosh'); cam.shake(260, 0.014); this._punch(1.12, 50, 380); });
        at(560, 'mt_prank_eyes_half'); at(620, 'mt_prank_eyes'); at(1180, 'mt_prank_eyes_half'); at(1260, 'mt_prank_eyes_shut'); at(1360, 'mt_prank_eyes_half'); at(1430, 'mt_prank_eyes');
        this.time.delayedCall(1750, () => {
            this.tweens.add({ targets: eyes, alpha: 0, duration: 300, onComplete: () => eyes.destroy() });
            if (!this.caught) this.tweens.add({ targets: this.black, alpha: 0, duration: 450 });
        });
        return 1300;
    }
    // a splat: it's leapt onto your face, squashed flat on your view, grinning at you; then it slides off, slowly, down
    _splat() {
        const W = this.scale.width, H = this.scale.height, cam = this.cameras.main;
        Sfx.play(this, 'split'); Sfx.play(this, 'kill'); Sfx.play(this, 'boom', { big: true });
        cam.shake(320, 0.016); this._punch(1.15, 50, 450);
        const sc = H * 1.3 / this.textures.get('mt_prank_splat').getSourceImage().height, g = this.add.image(W / 2, H * 0.52, 'mt_prank_splat').setScale(sc * 1.6).setDepth(5).setAngle(Phaser.Math.Between(-7, 7));
        this.tweens.add({ targets: g, scale: sc, duration: 110, ease: 'Back.easeOut' });
        this.tweens.add({ targets: g, y: H * 1.45, scaleY: sc * 1.15, delay: 1000, duration: 1700, ease: 'Quad.easeIn', onComplete: () => g.destroy() });
        this.time.delayedCall(1000, () => Sfx.play(this, 'shift', { near: 1 }));
        return 900;
    }
    // grabbed and spun round: its hands up out of the dark at you, and the hall goes round; you're left facing the other way
    _spin() {
        const W = this.scale.width, H = this.scale.height, cam = this.cameras.main, src = this.textures.get('mt_prank_hands').getSourceImage();
        const sc = W * 0.8 / src.width, hands = this.add.image(W / 2, H + src.height * sc, 'mt_prank_hands').setOrigin(0.5, 1).setScale(sc).setDepth(5);
        Sfx.play(this, 'whoosh'); Sfx.play(this, 'boom', { big: true }); cam.shake(200, 0.012);
        this.tweens.add({ targets: hands, y: H + 12, duration: 150, ease: 'Back.easeOut' });
        this.time.delayedCall(230, () => {
            Sfx.play(this, 'whoosh'); this.time.delayedCall(250, () => Sfx.play(this, 'whoosh'));
            this.tweens.add({ targets: cam, rotation: Math.PI * 2, duration: 800, ease: 'Cubic.easeInOut', onComplete: () => cam.setRotation(0) });
            this.tweens.killTweensOf(this.view);   // (mid-step or mid-turn: where you were going, and facing what you'd turned to)
            const base = (this.me.dir - 1) * Math.PI / 2;
            Object.assign(this.view, { x: this.me.x + 0.5, y: this.me.y + 0.5, a: base + Math.round((this.view.a - base) / (Math.PI * 2)) * Math.PI * 2 });
            this.me.dir = (this.me.dir + 2) % 4; this.moving = true;
            this.tweens.add({ targets: this.view, a: this.view.a + Math.PI, duration: 800, ease: 'Cubic.easeInOut', onComplete: () => this._moved() });
            this.tweens.add({ targets: hands, y: H + src.height * sc + 20, delay: 420, duration: 300, onComplete: () => hands.destroy() });
        });
        return 1000;
    }
    // its true face, seen straight on: what they really are (rare: the feat 'trueface', once); it keeps it till its next step
    _trueFace(e) {
        e.trueSeen = true;
        Sfx.play(this, 'portal'); this.time.delayedCall(200, () => Sfx.play(this, 'hall_giggle', { ...(this._where(e) || {}), n: 2 }));
        this.cameras.main.flash(500, 120, 80, 220);
        this._say('YOU SAW WHAT THEY REALLY ARE', 'Just for a moment. It won\'t let a reflection show it.', '#c8a0ff', 3000);
        if (typeof Achievements !== 'undefined') { Achievements.bump('trueFace', 1, this, true); const G = this.scene.get('Game'); if (G) try { G.totalGlorps = parseInt(localStorage.getItem('glorps'), 10) || G.totalGlorps; } catch (er) {} }   // (its glorps went to the save: the Game's purse kept in step)
    }
    // one of them off: asleep again, anywhere open far from you that nobody's in
    // a new look, heard now and then (not too often from any one of them), from where it is
    _lookSound(e) {
        const v = MirrorTrial.LOOK_SOUNDS[e.pose], now = this.time.now, w = v && this._where(e);
        if (!w || now < (e.saidAt || 0) + 5000 || Math.random() > 0.55) return;
        e.saidAt = now; Sfx.play(this, 'hall_voice', { ...w, v });
    }
    // the way for `e` to (tx, ty) over open floor, round the others: [where it is, ..., there], or null
    _path(e, tx, ty) {
        const key = (x, y) => y * 64 + x, from = new Map([[key(e.x, e.y), null]]), q = [[e.x, e.y]];
        const blocked = (x, y) => this.ents.some(o => o !== e && o.x === x && o.y === y);
        while (q.length) {
            const [x, y] = q.shift();
            if (x === tx && y === ty) break;
            for (const [dx, dy] of MirrorTrial.DIRS) {
                const nx = x + dx, ny = y + dy, k = key(nx, ny);
                if (!from.has(k) && this._open(nx, ny) && !blocked(nx, ny)) { from.set(k, [x, y]); q.push([nx, ny]); }
            }
        }
        if (!from.has(key(tx, ty))) return null;
        let at = [tx, ty]; const path = [at];
        while (from.get(key(...at))) { at = from.get(key(...at)); path.unshift(at); }
        return path;
    }
    // Where one is headed, by its way (e.way): the chaser straight at you; the ambusher a few tiles past where you face, to meet
    // you there; the cutter beside the fragment you're nearest (the way out, once it's whole), so it's there when you get there;
    // the wanderer anywhere, a spot at a time. Any of them comes straight at you once it's within WAY.NEAR steps (toMe: its way to you)
    _target(e, toMe) {
        const me = this.me, W = MirrorTrial.CFG.WAY, here = [me.x, me.y];
        if (e.way === 'chase' || !e.way || toMe.length - 1 <= W.NEAR) return here;
        const free = ([x, y]) => this._open(x, y) && !this.ents.some(o => o !== e && o.x === x && o.y === y);
        if (e.way === 'ambush') {
            const [dx, dy] = MirrorTrial.DIRS[me.dir]; let x = me.x, y = me.y;
            for (let k = 0; k < W.AHEAD && this._open(x + dx, y + dy); k++) { x += dx; y += dy; }
            return free([x, y]) ? [x, y] : here;
        }
        if (e.way === 'cut') {
            const goals = this.done ? [...this.map.entries()].flatMap(([y, row]) => row.map((c, x) => c === 'Q' ? [x, y] : null).filter(Boolean)) : [...this.frags].map(k => [k % 64, Math.floor(k / 64)]);
            const spots = goals.flatMap(([gx, gy]) => MirrorTrial.DIRS.map(([dx, dy]) => [gx + dx, gy + dy])).filter(free);
            if (!spots.length) return here;
            return spots.reduce((a, b) => Math.abs(b[0] - me.x) + Math.abs(b[1] - me.y) < Math.abs(a[0] - me.x) + Math.abs(a[1] - me.y) ? b : a);
        }
        if (!e.roam || (e.x === e.roam[0] && e.y === e.roam[1]) || !free(e.roam)) {   // the wanderer: somewhere new
            const open = []; this.map.forEach((row, y) => row.forEach((c, x) => { if (c === '.') open.push([x, y]); }));
            e.roam = open[Math.floor(Math.random() * open.length)];
        }
        return e.roam;
    }
    // A prank startles the rest: any other within WAY.STARTLE steps scampers back to BACK steps off (out of your sight if it can),
    // its reach undone, so one prank never runs straight into the next
    _startle(by) {
        const W = MirrorTrial.CFG.WAY, me = this.me;
        for (const e of this.ents) {
            if (e === by || !e.awake) continue;
            const p = this._path(e, me.x, me.y);
            if (!p || p.length - 1 > W.STARTLE) continue;
            const spots = []; this.map.forEach((row, y) => row.forEach((c, x) => { if (c !== '.' || this.ents.some(o => o.x === x && o.y === y)) return;
                const d = this._path({ x, y }, me.x, me.y); if (d && d.length - 1 >= W.BACK[0] && d.length - 1 <= W.BACK[1]) spots.push([x, y, !this._sees({ x, y })]); }));
            const hid = spots.filter(s => s[2]), pick = (hid.length ? hid : spots)[Math.floor(Math.random() * (hid.length || spots.length))];
            if (pick) Object.assign(e, { x: pick[0], y: pick[1], reaching: false, lookLeft: 0, lookMood: null, t: 0, movedAt: this.time.now });
        }
    }
    // Right next to you and unseen: it doesn't get you yet. It reaches, caught in time almost on you, and you hear it; its next
    // unseen step has you, so that's your one chance to turn and catch it
    _reach(e) {
        Object.assign(e, { reaching: true, oops: false, pose: Phaser.Utils.Array.GetRandom(MirrorTrial.LOOKS[e.way].REACH), lean: null, truly: false, lookLeft: 0, lookMood: null, fresh: true, movedAt: this.time.now });
        Sfx.play(this, 'hall_reach', this._where(e) || {});
    }
    _sendOff(e) {
        const far = [];
        this.map.forEach((row, y) => row.forEach((c, x) => { if (c === '.' && Math.abs(x - this.me.x) + Math.abs(y - this.me.y) >= 8 && !this.ents.some(o => o.x === x && o.y === y)) far.push([x, y]); }));
        if (far.length) [e.x, e.y] = far[Math.floor(Math.random() * far.length)];
        Object.assign(e, { awake: false, reaching: false, pose: Math.random() < 0.5 ? 0 : 1, t: 0, fresh: false, shy: 0, lean: null, mood: null, rile: 0, restUntil: this.time.now + Phaser.Math.Between(...MirrorTrial.CFG.MOOD.REST_MS) });   // (it's had its fun: a rest, then up again, calm)   // (it's had its fun: calm, next time it wakes)
    }
    // held in a reflection long enough: it doesn't like being caught there, and slinks off
    _shoo(e) {
        Sfx.play(this, 'hall_voice', { ...(this._where(e) || {}), v: 'hv_ohno' }); Sfx.play(this, 'whoosh');
        this.shooed = (this.shooed || 0) + 1;
        this._note('CAUGHT IN A REFLECTION. IT SLINKS OFF.');
        this._sendOff(e);
    }
    // Your stress full: scared to death. Your heart, hard, twice, and then not; the dark; they giggle all round you. Over
    _die() {
        if (this.caught) return;
        const H = this.scale.height;
        this.caught = true;
        if (this.raised) { this.raised = false; this._shardAt(false, MirrorTrial.CFG.RAISE_MS); }
        Sfx.play(this, 'heartbeat', { hard: 1 }); this.time.delayedCall(260, () => Sfx.play(this, 'heartbeat', { hard: 1 })); this.cameras.main.shake(300, 0.012);
        this.tweens.killTweensOf([this.black, this.noteTxt]); this.noteTxt.setAlpha(0);
        this.tweens.add({ targets: this.black, alpha: 1, duration: 900, ease: 'Quad.easeIn' });
        [-0.8, 0.7, 0].forEach((pan, i) => this.time.delayedCall(700 + i * 380, () => Sfx.play(this, 'hall_giggle', { pan, near: 0.7 - i * 0.15, n: i })));
        this.time.delayedCall(1500, () => {
            this._say('SCARED TO DEATH', `They got you ${this.pranks} time${this.pranks === 1 ? '' : 's'}, and your heart gave out. They'll want to play again.\nR  again        ESC  leave`, '#ff8aa0', 0);
            this.title.setY(H * 0.42); this.sub.setY(H * 0.42 + 52);
        });
    }
    _leave(msg) {
        if (this.leaving) return;
        this.leaving = true;
        if (msg) Sfx.play(this, 'whoosh');
        this.cameras.main.fadeOut(450, 0, 0, 0);
        this.time.delayedCall(470, () => {
            const G = this.scene.get('Game'), zoom = this.zoom0;
            if (typeof Music !== 'undefined') Music.duck(false, 'mirror');
            this.scene.stop();
            if (!G) return;
            G.scene.resume();
            G._mirrorBusy = false;
            Training.showPanel(G, true);   // (the Training panel back, as it was)
            G.cameras.main.setZoom(zoom); G.cameras.main.fadeIn(500, 8, 4, 16);
            G.updateHUD?.();   // (the glorps picked up in here)
            if (msg && G.player) G.showStatusText?.(G.player.x, G.player.y - 40, msg, '#d8c8ff');
        });
    }

    // ── A VIEW ────────────────────────────────────────────────────────────────
    // Into view V (a canvas), from where you stand, facing angle a: a ray down each column, through glass (its sheet kept, to lay
    // over what's behind), off up to BOUNCES mirrors (their frames kept the same way), on to stone or the way out. Then, column
    // by column, far to near: the sheets and frames, and what stands there: them and the shards (in front of the first mirror
    // or wall), and in the first mirror you and them again (mirrored across its face, behind it and in front of what it shows
    // next). flip: drawn left to right reversed (the shard's). watch: the ones it shows are seen (held).
    _render(V, a, fov, flip, watch) {
        const C = MirrorTrial.CFG, W = V.W, H = V.H, d = V.img.data;
        const px = this.view.x, py = this.view.y, dx = Math.cos(a), dy = Math.sin(a), plx = -dy * fov, ply = dx * fov;
        const lit = t => { const k = Math.max(0, 1 - t / C.FOG); return Math.min(1, k * k * 1.15); };
        const lines = V === this.front && this.lines.size ? this.lines : null;
        // the floor (its flagstones' joints, for knowing where you are) and the dark above
        const r0x = dx - plx, r0y = dy - ply, r1x = dx + plx, r1y = dy + ply;
        for (let y = 0; y < H; y++) {
            const below = y >= H / 2, t = (H / 2) / Math.max(0.5, Math.abs(y - H / 2) + 0.5), b = lit(t * 0.9);
            let fx = px + t * r0x, fy = py + t * r0y;
            const sx = t * (r1x - r0x) / W, sy = t * (r1y - r0y) / W;
            for (let x = 0; x < W; x++, fx += sx, fy += sy) {
                const i = (y * W + x) * 4;
                let r = 14, g = 10, bl = 22;
                if (below) {
                    const ex = fx - Math.floor(fx), ey = fy - Math.floor(fy), joint = ex < 0.04 || ex > 0.96 || ey < 0.04 || ey > 0.96; r = joint ? 16 : 46; g = joint ? 11 : 36; bl = joint ? 26 : 62;
                    const hl = lines && lines.get(Math.floor(fy) * 64 + Math.floor(fx));   // a sentry's line of sight
                    if (hl > 0 && !joint) { g += 70 * hl; bl += 60 * hl; } else if (hl < 0 && !joint) { r -= 140 * hl; bl -= 70 * hl; }   // (teal: a sentry's; pink: a decoy's)
                }
                d[i] = r * b; d[i + 1] = g * b; d[i + 2] = bl * b; d[i + 3] = 255;
            }
        }
        // the rays
        const groups = new Map(), ghosts = new Map();
        for (let x = 0; x < W; x++) {
            const cx = 2 * x / W - 1; let rx = dx + plx * cx, ry = dy + ply * cx; const n = Math.hypot(rx, ry); rx /= n; ry /= n;
            const cos = rx * dx + ry * dy, ov = [];
            let ox = px, oy = py, T = 0, first = null, after = Infinity, zOpaque = Infinity;
            for (let b = 0; ; b++) {
                const h = this._cast(ox, oy, rx, ry, ov, T, b === 0 && (V === this.front || !this.raised));   // (straight on, or in the shard held low: no reflection in a wall mirror)
                T += h.t;
                if (b === 1) after = T * cos;
                if ((h.c === 'M' || h.c === 'Q' || h.diag) && b < C.BOUNCES) {
                    ov.push({ k: h.diag ? 'mt_mirror' : 'mt_glass', T, u: h.u, tint: h.c === 'Q' ? 2 : h.diag ? 1 : 0 });   // (a mirror in a wall looks like glass)
                    const lab = this.labels[h.cell] || this.marks[h.cell];
                    if (lab) ov.push({ k: lab === 'M' ? 'mt_mark_m' : 'mt_mark_g', T, u: h.u });
                    if (b === 0) { zOpaque = T * cos; first = { key: h.diag ? h.c + ':' + h.k : h.side + ':' + h.plane, side: h.side, plane: h.plane, diag: h.diag && h.c, k: h.k, z: T * cos }; if (!groups.has(first.key)) groups.set(first.key, first); }
                    if (h.diag) [rx, ry] = h.c === 'L' ? [-ry, -rx] : [ry, rx];
                    else if (h.side === 0) rx = -rx; else ry = -ry;
                    ox = h.hx; oy = h.hy;
                    continue;
                }
                if (b === 0) zOpaque = T * cos;
                this._slice(V, x, T * cos, h.c === 'O' ? 'mt_broken' : h.c === 'M' || h.c === 'Q' || h.diag ? 'mt_mirror' : 'mt_wall', h.u, lit(T));
                break;
            }
            V.zbuf[x] = zOpaque;
            const sw = ov.find(o => o.see), ghost = sw && { key: sw.see.side + ':' + sw.see.plane, ...sw.see, z: sw.T * cos };   // (the first wall mirror looked through)
            if (ghost && !ghosts.has(ghost.key)) ghosts.set(ghost.key, ghost);
            V.cols[x] = { cos, ov, mirror: first && first.key, mz: first ? first.z : Infinity, after, ghost };
        }
        // what stands in the hall: them, the shards on the floor, and in each mirror you and them again
        const sprites = [];
        const ex = e => e.x + 0.5 + (e.lean ? e.lean[0] * 0.42 : 0), ey = e => e.y + 0.5 + (e.lean ? e.lean[1] * 0.42 : 0);   // (up against a pane: leaning to it)
        for (const e of this.ents) sprites.push({ x: ex(e), y: ey(e), k: 'mt_twin', f: e.truly && V === this.front ? MirrorTrial.POSES.TRUE : e.pose, ent: e, big: C.BIG });   // (in your shard, in a mirror: its pose)
        if (this.hand) sprites.push({ x: this.hand.x + 0.5, y: this.hand.y + 0.5, k: 'mt_pickup', f: 0, glint: true });
        const now = this.time.now;
        // the decoys, from whichever side you see them (its face, back, right, left: f), flickering as they give out
        const side = (sx, sy, fx, fy) => { const vx = sx - px, vy = sy - py, n = Math.hypot(vx, vy) || 1, dot = (fx * vx + fy * vy) / n; return dot < -0.7 ? 0 : dot > 0.7 ? 1 : fx * -dy + fy * dx > 0 ? 2 : 3; };
        const decoys = this.placed.filter(w => !(w.until - now < 1500 && Math.floor(now / 90) % 2));
        for (const w of decoys) {
            const [fx, fy] = MirrorTrial.DIRS[w.dir], sq = Math.max(0, 1 - (now - (w.boopAt || -1e9)) / 260);   // (booped: a squish)
            sprites.push({ x: w.x + 0.5, y: w.y + 0.5, k: 'mt_decoy', f: side(w.x + 0.5, w.y + 0.5, fx, fy), glint: true, w, sq: 1 - 0.25 * sq, sw: 1 + 0.3 * sq });
        }
        for (const o of this.sentries) sprites.push({ x: o.x + 0.5, y: o.y + 0.5, k: 'mt_sentry', f: 0, glint: true });
        if (V === this.front) for (const e of this.ents) if (e.pinged) sprites.push({ x: ex(e), y: ey(e), k: 'mt_twin', f: e.pose, big: C.BIG, xray: true });
        for (const o of this.glorps) if (!o.got) sprites.push({ x: o.x + 0.5, y: o.y + 0.5, k: 'mt_glorp', f: 0, glint: true });
        for (const o of this.items) if (!o.got) sprites.push({ x: o.x + 0.5, y: o.y + 0.5, k: 'mt_items', f: 'vdn'.indexOf(o.k), glint: true });
        const E = this.echoes[0] || { x: px, y: py, up: false };
        for (const g of groups.values()) {
            const m = (vx, vy) => g.diag === 'L' ? { x: g.k - vy, y: g.k - vx } : g.diag === 'R' ? { x: vy + g.k, y: vx - g.k }
                : g.side === 0 ? { x: 2 * g.plane - vx, y: vy } : { x: vx, y: 2 * g.plane - vy };
            sprites.push({ ...m(E.x, E.y), k: 'mt_self', f: E.up ? 1 : 0, in: g.key });
            for (const e of this.ents) sprites.push({ ...m(ex(e), ey(e)), k: 'mt_twin', f: e.pose, ent: e, big: C.BIG, in: g.key });
        }
        for (const g of ghosts.values()) {   // a wall mirror looked at straight on shows nothing but reflections: the slimes you set down (they're made of them)
            const m = (vx, vy) => g.side === 0 ? { x: 2 * g.plane - vx, y: vy } : { x: vx, y: 2 * g.plane - vy };
            for (const w of decoys) { const [fx, fy] = MirrorTrial.DIRS[w.dir], p = m(w.x + 0.5, w.y + 0.5); sprites.push({ ...p, k: 'mt_decoy', f: side(p.x, p.y, g.side === 0 ? -fx : fx, g.side === 0 ? fy : -fy), glint: true, ghost: g.key }); }
            for (const o of this.sentries) sprites.push({ ...m(o.x + 0.5, o.y + 0.5), k: 'mt_sentry', f: 0, glint: true, ghost: g.key });
        }
        const inv = 1 / (plx * dy - dx * ply), per = Array.from({ length: W }, () => []);
        if (V === this.front) V.picks = [];   // (the decoys as drawn, for a click: _boop)
        for (const s of sprites) {
            const rx = s.x - px, ry = s.y - py, tX = inv * (dy * rx - dx * ry), tY = inv * (-ply * rx + plx * ry);
            if (tY < 0.15) continue;
            const sx = (W / 2) * (1 + tX / tY), h = H / tY * (s.big || 1) * (s.sq || 1), w = h * 0.75 * (s.sw || 1) / (s.sq || 1), x0 = Math.floor(sx - w / 2), x1 = Math.ceil(sx + w / 2);
            const pick = s.w && !s.in && !s.ghost && V === this.front ? { w: s.w, cols: new Set(), top: Math.floor(H / 2 + H / tY / 2 - h), bottom: Math.ceil(H / 2 + H / tY / 2) } : null;
            if (pick) V.picks.push(pick);
            for (let x = Math.max(0, x0); x < Math.min(W, x1); x++) {
                const col = V.cols[x];
                if (!s.xray && (s.ghost ? (col.ghost?.key !== s.ghost || tY <= col.ghost.z) : s.in ? (col.mirror !== s.in || tY <= col.mz || tY >= col.after) : tY >= V.zbuf[x])) continue;
                per[x].push({ s, z: tY, k: s.xray ? 1e-3 : s.ghost && col.ghost.z - 0.001, u: (x - (sx - w / 2)) / w, h });   // (k: a reflection on a mirror's face; a ping's outline, over everything)   // (k: drawn on the mirror's face, over what's seen through it)
                pick?.cols.add(x);
            }
        }
        const px0 = new Map(this.ents.map(e => [e, 0])), straight = watch && V === this.front, reach = V === this.back ? C.FOG - (C.FOG - C.BLUR.REACH) * this.blur : Infinity;   // (a fogged shard: only the near ones held)
        for (let x = 0; x < W; x++) {
            const col = V.cols[x], items = col.ov.map(o => ({ o, z: o.T * col.cos })).concat(per[x]).sort((p, q) => (q.k || q.z) - (p.k || p.z));
            for (const it of items) {
                if (it.o) { this._slice(V, x, it.z, it.o.k, it.o.u, lit(it.o.T), it.o.tint); continue; }
                const b = lit(it.z / col.cos), n = this._sprite(V, x, it.z, it.s, it.u, it.s.glint ? Math.max(0.55, b) : b, it.h);
                if (it.s.ent && it.z <= reach) { px0.set(it.s.ent, px0.get(it.s.ent) + n); if (straight && !it.s.in) it.s.ent.dpx += n; if (watch && (V === this.back || it.s.in)) it.s.ent.rpx += n; }   // (straight on, not in a mirror: the dread's; in a reflection: the shoo's)
            }
        }
        for (const e of this.ents) if (px0.get(e) >= (V === this.back ? C.SEEN_BACK : C.SEEN_PX)) { if (watch) e.seen = true; }
        // the dither (each channel to a few levels, a 4x4 Bayer pattern between them); flipped, for the shard; cut to its shape
        // (dashing, the view ahead: its colours pushed to your teal, and wobbling like jelly, row by row)
        const fog = V === this.back ? this.blur * (this.raised ? C.BLUR.UP : 1) : 0;   // (the shard fogged up)
        if (fog > 0.02) {
            const r = Math.ceil(fog * 3), tmp = this._fogRow ||= new Float32Array(Math.max(W, H) * 3);
            for (const [len, n, at] of [[W, H, (a, i) => (a * W + i) * 4], [H, W, (a, i) => (i * W + a) * 4]]) for (let a = 0; a < n; a++) {
                for (let i = 0; i < len; i++) { let sr = 0, sg = 0, sb = 0, m = 0; for (let j = Math.max(0, i - r); j <= Math.min(len - 1, i + r); j++) { const q = at(a, j); sr += d[q]; sg += d[q + 1]; sb += d[q + 2]; m++; } tmp[i * 3] = sr / m; tmp[i * 3 + 1] = sg / m; tmp[i * 3 + 2] = sb / m; }
                for (let i = 0; i < len; i++) { const q = at(a, i); d[q] = tmp[i * 3] + (120 - tmp[i * 3]) * fog * 0.3; d[q + 1] = tmp[i * 3 + 1] + (118 - tmp[i * 3 + 1]) * fog * 0.3; d[q + 2] = tmp[i * 3 + 2] + (140 - tmp[i * 3 + 2]) * fog * 0.3; }
            }
        }
        const L = C.LEVELS - 1, BAY = MirrorTrial.BAYER, cut = V === this.back ? this.tex.mt_shard.d : null, sk = V === this.front ? this.gooK : 0;
        const grey = V === this.front ? this.dread * 0.75 : 0;
        const gain = [1 + 0.05 * sk, 1 + 0.55 * sk, 1 + 0.5 * sk], lift = 12 * sk, wob = 3 * sk, row = this._row ||= new Uint8ClampedArray(W * 4 + 8);
        for (let y = 0; y < H; y++) {
            if (flip) for (let x = 0; x < W / 2; x++) { const i = (y * W + x) * 4, j = (y * W + W - 1 - x) * 4; for (let c = 0; c < 4; c++) { const t = d[i + c]; d[i + c] = d[j + c]; d[j + c] = t; } }
            const sh = wob ? Math.round(Math.sin(y * 0.16 + now / 85) * wob) : 0;
            if (sh) { row.set(d.subarray(y * W * 4, (y + 1) * W * 4)); for (let x = 0; x < W; x++) { const i = (y * W + x) * 4, j = Math.max(0, Math.min(W - 1, x - sh)) * 4; d[i] = row[j]; d[i + 1] = row[j + 1]; d[i + 2] = row[j + 2]; } }
            for (let x = 0; x < W; x++) {
                const i = (y * W + x) * 4, o = BAY[(y & 3) * 4 + (x & 3)];
                if (grey) { const l = d[i] * 0.3 + d[i + 1] * 0.59 + d[i + 2] * 0.11; d[i] += (l - d[i]) * grey; d[i + 1] += (l - d[i + 1]) * grey; d[i + 2] += (l - d[i + 2]) * grey; }
                for (let c = 0; c < 3; c++) d[i + c] = Math.max(0, Math.min(L, Math.round((d[i + c] * gain[c] + lift) / 255 * L + o))) * 255 / L;
                if (cut) d[i + 3] = cut[i + 3] ? 255 : 0;
            }
        }
        V.ctx.putImageData(V.img, 0, 0);
        V.tex.refresh();
    }

    // along a ray from (ox, oy) to the first stone, mirror or the way out; the glass on the way kept in `ov` (at T0 + its distance).
    // thru: a look straight on, which goes through a mirror in a wall as through glass (kept in `ov` too, `see`: its plane).
    // (The cell it starts in isn't looked at: off a stand's mirror, the ray goes on from inside its cell.)
    _cast(ox, oy, rx, ry, ov, T0, thru) {
        let mx = Math.floor(ox), my = Math.floor(oy);
        const ddx = Math.abs(1 / rx), ddy = Math.abs(1 / ry), sx = rx < 0 ? -1 : 1, sy = ry < 0 ? -1 : 1;
        let tx = (rx < 0 ? ox - mx : mx + 1 - ox) * ddx, ty = (ry < 0 ? oy - my : my + 1 - oy) * ddy;
        for (let n = 0; n < 64; n++) {
            let side, t;
            if (tx < ty) { t = tx; tx += ddx; mx += sx; side = 0; } else { t = ty; ty += ddy; my += sy; side = 1; }
            const c = this.map[my]?.[mx] ?? '#';
            if (c === '.') continue;
            if (c === 'L' || c === 'R') {   // a stand: its mirror runs corner to corner (L: x + y = k, R: x - y = k); a ray may pass it by
                const k = c === 'L' ? mx + my + 1 : mx - my, den = c === 'L' ? rx + ry : rx - ry;
                const td = Math.abs(den) < 1e-9 ? -1 : (c === 'L' ? k - ox - oy : k - ox + oy) / den;
                if (td >= t - 1e-9 && td <= Math.min(tx, ty) + 1e-9) { const hx = ox + rx * td, hy = oy + ry * td; return { t: td, c, diag: true, k, u: hx - mx, hx, hy }; }
                continue;
            }
            const hx = ox + rx * t, hy = oy + ry * t, u = side === 0 ? hy - Math.floor(hy) : hx - Math.floor(hx);
            if (c === 'G' || (thru && c === 'M')) {
                ov.push({ k: 'mt_glass', T: T0 + t, u, see: c === 'M' && { side, plane: side === 0 ? (sx > 0 ? mx : mx + 1) : (sy > 0 ? my : my + 1) } });
                const lab = this.labels[my * 64 + mx] || this.marks[my * 64 + mx];
                if (lab) ov.push({ k: lab === 'M' ? 'mt_mark_m' : 'mt_mark_g', T: T0 + t, u });
                continue;
            }
            return { t, c, side, u, hx, hy, cell: my * 64 + mx, plane: side === 0 ? (sx > 0 ? mx : mx + 1) : (sy > 0 ? my : my + 1) };
        }
        return { t: 64, c: '#', side: 0, u: 0, hx: ox, hy: oy, plane: 0 };
    }
    // a texture's column u, a tile tall at depth z, over column x of view V (blended by its alpha; tint: a mirror's cold
    // sheen first, 2 the way out's, whole again, violet)
    _slice(V, x, z, k, u, b, tint) {
        const W = V.W, H = V.H, tex = this.tex[k], d = V.img.data, h = H / z, top = H / 2 - h / 2;
        const tx = Math.min(tex.w - 1, Math.floor(u * tex.w)), [tr, tg, tb] = tint === 2 ? [200, 150, 255] : [160, 200, 255], ta = tint === 2 ? 0.25 : 0.12;
        for (let y = Math.max(0, Math.floor(top)), y1 = Math.min(H, Math.ceil(top + h)); y < y1; y++) {
            const i = (y * W + x) * 4;
            if (tint) { d[i] = d[i] * (1 - ta) + tr * ta * b; d[i + 1] = d[i + 1] * (1 - ta) + tg * ta * b; d[i + 2] = d[i + 2] * (1 - ta) + tb * ta * b; }
            const j = (Math.max(0, Math.min(tex.h - 1, Math.floor((y - top) / h * tex.h))) * tex.w + tx) * 4, al = tex.d[j + 3] / 255;
            if (!al) continue;
            for (let c = 0; c < 3; c++) d[i + c] = d[i + c] * (1 - al) + tex.d[j + c] * b * al;
        }
    }
    // view V's pixel (x, y) behind the shard held up (its glass, its edge, your hand): there, you can't see
    _covered(V, x, y) {
        const S = V.cover, P = this.scale.width / V.W, T = this.tex.mt_shard, o = S.list[1];   // (o: shaking in your hand)
        const u = Math.floor(((x + 0.5) * P - S.x) / S.scaleX - o.x + T.w / 2), v = Math.floor(((y + 0.5) * P - S.y) / S.scaleY - o.y + T.h / 2);
        return u >= 0 && v >= 0 && u < T.w && v < T.h && T.d[(v * T.w + u) * 4 + 3] > 0;
    }
    // a sprite's column u (its pose f, in a strip), standing on the floor at depth z (s.big: taller); how many lit pixels it put down
    _sprite(V, x, z, s, u, b, sh) {
        const C = MirrorTrial.CFG, W = V.W, H = V.H, tex = this.tex[s.k], fw = tex.fw || tex.w, d = V.img.data, h = sh || H / z * (s.big || 1), top = H / 2 + H / z / 2 - h;
        const tx = s.f * fw + Math.min(fw - 1, Math.max(0, Math.floor(u * fw))), fade = s.ent?.shy ? 0.8 * s.ent.shy / C.SHOO_MS : 0;
        let n = 0;
        for (let y = Math.max(0, Math.floor(top)), y1 = Math.min(H, Math.ceil(top + h)); y < y1; y++) {
            const j = (Math.max(0, Math.min(tex.h - 1, Math.floor((y - top) / h * tex.h))) * tex.w + tx) * 4, al = tex.d[j + 3] / 255;
            if (al < 0.5) continue;
            const i = (y * W + x) * 4;
            if (s.xray) { if ((x + y) % 2) { d[i] += (143 - d[i]) * 0.6; d[i + 1] += (244 - d[i + 1]) * 0.6; d[i + 2] += (220 - d[i + 2]) * 0.6; } continue; }   // (a ping's: a teal ghost of it)
            if (b >= C.LIT && !(V.cover && this._covered(V, x, y))) n++;
            if (fade && Math.random() < fade) continue;   // (being shooed: coming apart)
            for (let c = 0; c < 3; c++) d[i + c] = tex.d[j + c] * b + 30 * b * (c === 2);
        }
        return n;
    }
}
