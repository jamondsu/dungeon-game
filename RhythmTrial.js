// ═══════════════════════════════════════════════════════════════════════════
// RHYTHMTRIAL.JS - a playable sketch of the Fracture's rhythm run (the Training Ground's TRIAL button)
// ═══════════════════════════════════════════════════════════════════════════
// The floor is gone: an abyss. You move and dash as ever, but the only ground is a route of floating slabs that forms one at a time,
// exactly on its note: the next slab snaps up out of the one you're on (flying over the gap when it's a dash away), and
// the one you're on crumbles HOLD of a beat later. Get onto each in time; stand anywhere else and you fall into the dark.
// The song comes in phases, one per row, each at its own fixed tempo (BPM); between them a BREAK, a few beats with no
// notes to throw everything at the core, then a two-beat count-in. Each beat is a little rhythm (PATTERNS): a crotchet,
// two quavers, a dotted quaver and a semiquaver, a run of semiquavers... busier as the phases go on.
// A gap is as long as one element's dash (lightning 3, fire 4, ice 6, on Shift) or wants cosmic's aimed hop; on a quake
// the slab you're on tears apart and mends MEND later, so you jump (Space) over it, not too early. There's no note lane:
// fault lines of light open round each slab's cell and close in on it, landing on its beat; a note over each, coloured by
// its value (crotchet, quaver...), says how long it lasts; a dash or a jump is drawn a few beats early as an arrow from the slab you'll go from
// (hud). The ornaments are extras, never misses: a step marked with a MORDENT wants forward, back, forward (land on it, step
// back to the slab you came from and onto it again, untimed, before the next slab forms) for a hit on the core; an ACCENT (>):
// click as you land on it and the core takes a big hit. Skip either and nothing's lost. A TRILL (rare): your step quickens, and
// you hop back and forth TRILL_N times before its time runs out (that one's a must). A SLUR over a few steps: its slabs stay till the phrase ends
// and nothing in it grades below GOOD. Once a run a GLISSANDO: no notes, a row of keys shown, and on the beat you sweep your
// finger along them (T to P, F to L, V to ,) for a big hit. With a SONG (set in the panel; a file of your own in
// assets/music/local/, kept out of git) the run is played to it: one tempo, its beat found in the file by ear. Each is graded: PERFECT builds the combo and the groove (a run of them
// multiplies your damage to the core, GROOVE), GOOD keeps the combo, BAD (made it, only just) breaks both. The core floats
// in the middle, out of reach, and your PLAYING is what hurts it: every note you land flies into it and hits (PERF: a
// PERFECT's full share, a GOOD's less, a BAD's nothing; the groove multiplies it), sized so a run of near-PERFECTs kills it
// before the song's out; the ornaments, the glissando and your weapons in the breaks hit it on top. Kill it before the song
// ends AND reach the far side alive. LIVES lives; a fall puts you back on the newest slab.
class RhythmTrial {
    static CFG = { BPM: [66, 82, 96, 110], COUNT_IN: 4, HOLD: 0.55, LIVES: 5, CORE_HP: 1500, ROWS: [5, 2, -2, -5], HALF: 8,
        PERFECT: 85, GOOD: 170, EARLY: 220,   // the grades (ms either side of the note); you may land EARLY ms before a slab forms
        JUMP_MS: 560, JGRACE: 130, MEND: 340,   // a jump's time in the air; a torn slab holds JGRACE, and is whole at MEND (jump more than EARLY early and you land before it is)
        STEP_MS: 110,   // your step during the trial (200 as ever): quick enough for a run of semiquavers at the top tempo
        GROOVE: [[32, 2], [16, 1.5], [8, 1.25]],   // perfects in a row: damage to the core
        BREAK_BEATS: 4, BREAK_MULT: 1.5,   // the break between phases, and the core's damage taken in it
        SNAP_MS: 90, GAP_MS: 1400,   // GAP_MS: dash to dash at least (ice's cooldown, and an element switch's; each difficulty sets its own, DIFF.GAP)
        // each note value's colour (semiquavers: a semiquaver, quaver, dotted quaver, crotchet, dotted crotchet, minim), kept off the elements'
        NOTE_COL: { 0.5: 0xff2e6e, 1: 0xff5ab4, 2: 0x3fe8c8, 3: 0xa8ff5a, 4: 0xfff2d8, 6: 0xffb070, 8: 0x9ab0ff, 12: 0xb4a8ff, 16: 0xe4c8ff },   // (8 up: a hold's minim, dotted minim, semibreve)
        LEAD: [2000, 2800], AHEAD: [1400, 2400],   // ms of warning for a dash or jump's arrow (3 beats, within these), and the notes' values shown ahead (2.5 beats)
        // a beat's rhythm: where its notes fall in it, in semiquavers, and its weight in each phase
        PATTERNS: [
            { on: [0], w: [6, 4, 3, 2] },            // a crotchet
            { on: [0, 2], w: [2, 3, 3, 3] },         // two quavers
            { on: [2], w: [0, 1, 1, 1] },            // off the beat
            { on: [0, 3], w: [1, 3, 4, 5] },         // a dotted quaver and a semiquaver (the busy phases' staple: one semiquaver at a time reads far easier than a run)
            { on: [0, 1], w: [0, 1, 1, 1] },         // a semiquaver and a dotted quaver
            { on: [0, 2, 3], w: [0, 1, 1, 1] },      // a quaver and two semiquavers
            { on: [0, 1, 2], w: [0, 0, 1, 1] },      // two semiquavers and a quaver
            { on: [0, 1, 2, 3], w: [0, 0, 0, 1] },   // four semiquavers (the busiest phase only)
            { on: [], w: [3, 3, 2, 2] },             // a rest (and with a song, its quiet beats rest more often: quiet)
        ],
        QUAKE_P: [0.1, 0.14, 0.16, 0.18], MORDENT_P: [0.05, 0.07, 0.09, 0.1], MORDENT_GAP: 340,   // a mordent's odds on a step, and the least time after it (its two steps back and forth; past that the rhythm's free)
        START_BEAT: 8,   // with a song: the route's first beat, this many of the song's in (the count-in, the four before it)
        GHOST: 0.4,   // you, your face and what you hold, see-through for the trial: solid, you sat on the symbols and over the cell above
        ACCENT_P: [0.05, 0.06, 0.07, 0.08], ACCENT_WIN: 160, ACCENT: 3, MORDENT_HIT: 1.5,   // an accent's odds on a step; click and landing this close count as together; its hit, a mordent's (in PERFECT notes' worth, PERF)
        PERF: { KILL: 1.3, GOOD: 0.55 },   // your notes' hits on the core: a PERFECT's is 1 / (KILL x the run's notes) of its health (a run of them all, KILL runs to kill it before the groove: about 85% PERFECTs kill it by the end), a GOOD's this share of that
        TRILL_P: [0, 0.03, 0.04, 0.1], TRILL_MS: 2800, TRILL_N: 10, TRILL_STEP: 60,   // 1 or 2 a run: the time for it, the hops it wants (each difficulty its own, DIFF.TRILL; even, to end on it), your step meanwhile
        SLUR_P: 0.18,   // the odds a run of plain steps is slurred
        GLISS: { BEATS: 9, SLIDE: 6, WIN: [700, 1100], SPAN: 900, PERFECT: [180, 500], DMG: [36, 22] },   // its beats clear of notes, the beat to slide on, the window (early, late), all the keys within SPAN ms, a perfect's start and length, its hits (in notes' worth)
        DASH: { lightning: 3, fire: 4, ice: 6 },
        DASH_CD: { fire: 715, lightning: 825, ice: 1265, cosmic: 1400 }, SWITCH_CD: 1000,   // the game's own: a dash's cooldown after it (DASH_COOLDOWN x its element's), a hop's (from its second jump), an element switch's
        LAND: { fire: 250, ice: 750, cosmic: 750 },   // ms before the next note after each kind of dash (the glide, the hop's two jumps)
        UNLOCK: { lightning: 0.15, fire: 0.35, ice: 0.5, cosmic: 0.62 },   // how far through the route each kind of gap first turns up
        MCOL: { step: 0xfff2d8, lightning: 0xffe14a, fire: 0xff7a2a, ice: 0x7fd8ff, cosmic: 0xc77dff, quake: 0xff4a5a } };   // (steps white-hot: colour is for elements, and quakes)

    // The run as it's set in the Training panel (settings, kept in localStorage): SPEED scales every tempo; EASY and HARD
    // take the rhythms a phase or two simpler or a phase busier, widen or narrow the grades and a slab's hold, and thin or
    // thicken the quakes. C is the run's config, CFG tuned to them when it starts.
    // The songs to play it to: files of your own in assets/music/local/ (<file>.mp3 or .wav; the folder's kept out of git, so
    // they never reach the repo or the site), their tempo, and a MAP of the song (without one, the beat's found on load, phase).
    // A map, in the song's bars (bar 0 starts at `first` ms in the file): playback `from` a bar, the first note's bar `start`
    // (the count-in is the bar before it: over the song when `from` is earlier, else ahead of it, the song coming in after),
    // the last `end`; its sections [bar, kind, level] (level: how busy the rhythms are, 0 to 3; a 'break' has no notes, attack
    // the core); a quake on each of `quakes` (the drops' first hits; 2.25 is bar 2's second beat), the glissando's slide
    // landing on `gliss`, a trill in each of `trills`, an accent on each of `hits` (big hits); and in a drop, accents on the
    // snares now and then. Tempo and first beat measured off the files' kick drums (to 0.05 BPM: a hair off, and by the end
    // of the song the beat's half a second adrift).
    // Each song's CHART: its bars from bar 0 (one string each), each of the bar's 16 semiquavers as how hard the music hits there,
    // 0-9 ('.' nothing), measured off the file once (kick, snare and hats/lead bands) and free to
    // be edited by hand. The route takes each beat's rhythm from it (fit): the manageable pattern that best catches its hits.
    static CHARTS = {
        hooligans: [
            '...1 7143 1132 2218', '.194 1.9. .163 8136', '7191 7161 1137 1129', '.193 117. ..63 6284',   // 0
            '719. 8339 5939 5111', '4221 7411 4241 4211', '5131 7124 1162 2252', '411. 2213 1.21 9559',   // 4
            '..22 1.71 3141 .143', '3271 2172 3313 1231', '3161 1.53 3272 .133', '3161 2171 2414 1315',   // 8
            '1169 1147 1574 .478', '3359 3478 1526 1727', '1626 .638 26.9 .628', '1719 1419 13.7 .312',   // 12
            '3819 1617 1729 .528', '1829 1717 1637 1738', '1828 1618 1729 .668', '1727 .616 1539 1678',   // 16
            '1827 .617 1938 .528', '1847 .817 1849 .688', '1918 .918 1937 .628', '1937 1717 1848 1257',   // 20
            '1817 1517 1726 .527', '1629 1618 1638 1688', '1816 .717 1917 .528', '1829 1718 1638 1738',   // 24
            '1727 .516 1937 .528', '1937 1716 1626 1796', '1917 1925 1377 1376', '1717 22.6 23.7 3122',   // 28
            '1144 1121 3112 3.12', '1213 1211 3121 1413', '1424 2113 1111 2131', '1198 9687 6219 3419',   // 32
            '1715 3142 1222 1331', '2121 1311 2.14 1312', '1.12 1.13 131. 2161', '3111 252. 2141 1241',   // 36
            '1152 4364 5122 1175', '1122 2321 5183 1182', '2172 5442 4211 3172', '4142 1291 9417 9291',   // 40
            '7283 2261 4662 5252', '3252 2451 4551 3281', '147. 4261 5251 4151', '2131 4132 5252 273.',   // 44
            '7.94 5689 527. 6181', '517. 5.81 519. 6381', '6191 6.81 5.7. 5161', '6181 6.81 529. 6181',   // 48
            '617. 4.71 517. 5171', '5.9. 6.81 5291 6271', '6181 6151 5191 618.', '819. 317. 417. 4123',   // 52
            '9.9. 8141 917. 3641', '8282 5561 1641 1841', '2372 3152 3171 3141', '2452 3232 1273 1332',   // 56
            '5433 6332 5112 5.31', '5113 5134 15.3 5231', '7411 4.43 5.21 5131', '5311 4142 7332 6131',   // 60
            '1111 7221 37.1 6727', '7415 5826 .914 3819', '4726 4716 26.6 2837', '39.7 1816 28.7 3817',   // 64
            '27.4 1719 38.5 6819', '37.7 1716 3717 8717', '16.6 2919 27.6 6817', '1918 1818 2615 2434',   // 68
        ],
        squadkill: [
            '1... .... .1.. ....', '4111 ...2 1.1. ..1.', '1... .1.. 1.1. ....', '1.1. 1.1. 1.1. 1...',   // 0
            '1.1. .... 1.92 7489', '.91. .1.1 ..1. 1...', '1... .... 1... ....', '1..1 .1.1 .1.1 ...3',   // 4
            '1121 3.11 .4.1 ..12', '1113 1313 ..1. 2516', '2112 21.5 1241 121.', '2121 .131 3114 1112',   // 8
            '211. 1213 ..11 21.5', '2121 11.1 1212 ..98', '9488 8912 2917 7214', '.111 11.2 1215 2147',   // 12
            '2173 7213 2112 1121', '4131 1114 1132 1217', '1131 1411 212. 1218', '321. .1.5 9439 4936',   // 16
            '1743 6131 1252 2511', '1141 1131 1311 5117', '1321 3131 1421 1626', '9262 6.55 1121 6425',   // 20
            '1625 1974 2652 5426', '5411 5226 1523 2527', '1524 4427 2622 4626', '2526 3927 1919 8942',   // 24
            '8442 3252 2522 2541', '2423 2443 2571 5222', '6525 2716 2427 2771', '.212 .13. 1.21 .115',   // 28
            '2736 2521 1252 41.1', '1352 533. ..1. .3.2', '7223 5291 282. 9.96', '6345 2286 .... 1312',   // 32
            '3112 4291 241. 6194', '3525 3183 4191 4191', '3221 3291 7814 7181', '2121 .193 .1.1 2271',   // 36
            '2253 3271 3131 7.81', '4141 139. 929. 2181', '3343 4192 7514 7.92', '2212 2361 7.8. 1171',   // 40
            '3313 1192 2241 5182', '3271 4391 8291 4171', '3134 3492 9327 6171', '4132 2381 7.7. 1172',   // 44
            '6161 .1.. 1111 .111', '1111 1.3. 111. .11.', '2112 1332 1864 9193', '1211 2141 1111 1161',   // 48
            '2.41 3131 21.1 7.6.', '131. .121 2121 2161', '1121 2112 12.1 7172', '1313 3221 2253 711.',   // 52
            '1111 111. .2.. ..41', '7473 6254 2131 7.15', '2222 1241 5225 1365', '2632 5231 1..9 8938',   // 56
            '7882 1842 1622 4312', '7272 3213 1141 3964', '1444 .811 2621 4525', '2272 3919 6386 2753',   // 60
            '2631 2928 1623 5554', '2751 5826 5272 2815', '2471 6823 7623 3752', '3766 3724 4923 8562',   // 64
            '7413 1945 2638 3866', '2371 8673 9394 4175', '7164 9832 7282 6772', '5764 7472 6393 9896',   // 68
        ],
        // (and each one's hats and lead alone: Impossible's lover plays these, you the drums)
        hooligans_hi: [
            '.... 8..1 1... 2...', '.... .... ..1. 9...', '8... 7... .... ....', '..1. .... ..1. 7...',   // 0
            '..3. 5..5 1338 1.1.', '.1.. .1.. ..1. ..1.', '...1 ...1 .111 .2.1', '.1.. .1.1 ..11 1115',   // 4
            '.... 1.1. 3... ....', '4... 1.1. 3... .1..', '3... 1... 3... ...1', '2... .... 2... .1..',   // 8
            '2..5 ...8 15.5 .5.9', '13.5 .4.9 1524 .518', '1712 .6.9 17.5 .7.9', '1715 .215 .216 .31.',   // 12
            '13.4 .6.8 .614 .619', '.715 .7.8 .515 .618', '.715 .6.9 .715 .619', '.715 .617 .625 .719',   // 16
            '.715 .6.8 .715 .619', '.615 .6.8 .625 .719', '.816 .819 .826 .619', '.615 .718 .719 .218',   // 20
            '.2.5 .618 .514 .618', '.615 .719 .625 .729', '.715 .618 1614 .619', '.715 .719 .725 .729',   // 24
            '.61. .6.7 .715 .619', '.82. .813 .62. .826', '.91. .8.2 .1.. .413', '.4.. ...2 .... 1...',   // 28
            '1.1. 1211 ..12 ....', '1... .... ..1. ....', '..1. 1..1 .... ....', '1.19 319. 71.2 .2.9',   // 32
            '.7.. .... ..1. 1...', '..1. 1... .1.. ....', '1... 1.1. 1... 1...', '2.2. 21.. 2.1. 1.1.',   // 36
            '.15. 11.1 6.21 1.81', '1.1. 13.. 5.8. 1.9.', '..7. 1411 3... 1.8.', '.1.. 128. 9317 3.6.',   // 40
            '3.9. 131. 4.2. ..6.', '1.2. 131. 5.6. 1.9.', '..4. 21.. 2.1. 1.3.', '.... 11.. 1.1. .14.',   // 44
            '7.51 6.91 6.5. 6.9.', '6.5. 6.8. 615. 619.', '715. 6.9. 6.5. 6.7.', '6.5. 6.9. 615. 719.',   // 48
            '714. 2.8. 615. 618.', '615. 6.9. 615. 618.', '715. 616. 612. 719.', '917. 31.. 31.. 31.1',   // 52
            '4.2. 712. 8... 1.2.', '2261 6.3. ...1 .911', '.2.. .14. .1.1 ..4.', '...1 ..3. 1..1 ..4.',   // 56
            '...2 114. .1.1 ..3.', '..1. ..4. 1..1 ..3.', '..1. ..4. 1..1 ..3.', '.... ..2. ..2. 1.2.',   // 60
            '...2 ..2. .4.. 1816', '.4.5 .914 .5.1 2918', '15.7 1817 14.6 1817', '15.7 1917 25.8 2917',   // 64
            '15.5 .717 14.6 19.7', '15.8 18.7 25.8 18.7', '14.6 2918 15.7 19.8', '15.9 18.7 14.3 1525',   // 68
        ],
        squadkill_hi: [
            '.... .... .... ....', '.... .... .... ....', '.... .... .... ....', '.... .... .... ....',   // 0
            '.... .... ..91 4595', '.4.. .... .... ....', '.... .... .... ....', '.... .... .... ....',   // 4
            '.... .... .... ....', '.... .... .... ....', '.... .... .... ....', '.... .... .... ....',   // 8
            '.... .... .... ....', '.... .... .... ..19', '529. 91.1 .118 ....', '.... .... ..1. ...8',   // 12
            '111. ...1 .1.. .1..', '.1.1 .1.1 .... 1..2', '..1. .1.1 ..1. .119', '.... ...4 8339 5933',   // 16
            '1212 .1.1 1... 2.1.', '11.2 ..1. .1.1 .112', '112. .1.1 .121 1.17', '2.1. 1.26 ..1. 151.',   // 20
            '13.2 1..2 .112 111.', '11.1 .1.1 .212 .211', '1311 .2.. 1212 1121', '12.2 .212 .911 9552',   // 24
            '.112 .1.2 1212 .2.1', '2112 1114 111. 1212', '.121 1413 1316 1121', '..12 .13. 1.31 .126',   // 28
            '11.. 1... .... ....', '.... .... ..1. .3.1', '2..4 ..9. 27.. 9.36', '..5. 2291 .... .3..',   // 32
            '.... ..51 252. 4.25', '1521 129. 419. 514.', '121. 3.91 3115 213.', '1... ..91 ...1 ..41',   // 36
            '1111 1282 424. 4.42', '4.4. 229. 625. 2131', '1314 2292 3525 2151', '1.1. 316. 4.3. ..51',   // 40
            '.... ..92 225. 6.62', '3171 349. 727. 4161', '423. 3.92 8238 3171', '4.4. 2391 2.4. ..81',   // 44
            '1... .... .... ....', '.... .... .... ....', '.... ..1. 1925 914.', '.... ..1. .... ..2.',   // 48
            '1... ..1. .... 2.2.', '..1. ..1. .... ..1.', '.1.1 .1.. .1.1 .2..', '.2.. ..11 1..1 .1..',   // 52
            '.... .... .... ..31', '113. 1... 1... 1.1.', '.... ..2. .... .31.', '.1.. .... ...1 9519',   // 56
            '291. ..13 11.2 .21.', '2.1. ..1. .14. .5.5', '1.41 .911 2631 .513', '1351 1913 7393 2713',   // 60
            '1241 2913 1313 1251', '1161 2911 2281 1615', '1251 2922 3622 1512', '1362 3821 3632 1511',   // 64
            '.1.. .722 2639 3932', '1161 2721 7292 5114', '1172 3931 8283 3822', '4172 2523 6271 2936',   // 68
        ],
    };
    static SONGS = {
        hooligans: { title: 'Hooligans', artist: 'Evgeny Bardyuzha', bpm: 104.75, file: 'hooligans', map: { first: 198, from: 0, start: 0, end: 72,
            sections: [[0, 'intro', 0], [4, 'groove', 1], [20, 'groove', 2], [32, 'break'], [36, 'calm', 0], [40, 'build', 2], [48, 'drop', 3]],
            quakes: [0.25, 2.25, 4], gliss: [48], trills: [45], hits: [57], mordent: [0.08, 0.14, 0.12, 0.08], chart: RhythmTrial.CHARTS.hooligans, chart2: RhythmTrial.CHARTS.hooligans_hi } },   // (the opening's two hits are jumps; mordent: its own odds by level: it's full of little turns)
        squadkill: { title: 'Squad Kill', artist: 'Grisly Brill', bpm: 109.75, file: 'squad_kill', map: { first: 250, from: 8, start: 9, end: 72,
            sections: [[9, 'intro', 0], [14, 'groove', 1], [24, 'groove', 2], [32, 'drop', 3], [48, 'break'], [52, 'calm', 0], [54, 'build', 2], [56, 'drop', 3]],
            quakes: [14, 56], gliss: [32], trills: [53], hits: [60], chart: RhythmTrial.CHARTS.squadkill, chart2: RhythmTrial.CHARTS.squadkill_hi } } };
    // how thick a song's ornaments (jumps, mordents, accents) come in each kind of section, times the difficulty's ORN: the chorus loaded
    static SECTION_ORN = { drop: 1.8, build: 1.3, groove: 1, intro: 0.5, calm: 0.5, break: 0 };
    static SECTION = { groove: ['GROOVE', 'find the beat'], build: ['BUILD-UP', 'here it comes'], drop: ['DROP!', 'everything at once'] };
    // (GAP: a dash to the next at least, ms; mordent: their odds, scaled; CHART: how hard a song's hit must be to get a note; SPACE:
    // a song's notes at least this many semiquavers apart, and at most this many semiquaver gaps in a row (Normal: a dotted pair, never a run);
    // METRIC: a hit's worth on the beat, its e, +, a (the easier, the more the beat wins: Hooligans' claps on every a were a slog on Easy);
    // PULSE: a beat the music plays through but leaves nothing on keeps a step on its downbeat (else Easy went silent under syncopation);
    // DASH_SQ: semiquavers clear before and after a dash: a semiquaver either side of one was a nightmare to time with Shift; ACC_WIN: an
    // accent's click and landing this close count as together (clicking and stepping at once is hard: wider the easier); ACC_GAP: a
    // song's accents, on its strongest hits, at least this many semiquavers apart; ACC_HIT: how strong a hit takes one; ACC_LEAD: the
    // semiquavers clear before one, to line the click up; ORN: how thick the ornaments come, with SECTION_ORN)
    static DIFF = { easy: { shift: -2, quake: 0.5, mordent: 0.7, PERFECT: 115, GOOD: 230, EARLY: 300, HOLD: 0.8, GAP: 5000, TRILL: 8, CHART: 0.75, SPACE: [2, 0], METRIC: [1, 0.6, 0.85, 0.6], PULSE: true, DASH_SQ: 4, ACC_WIN: 300, ACC_GAP: 32, ACC_HIT: 0.9, ACC_LEAD: 2, ORN: 0.7 },
        normal: { shift: -1, quake: 0.8, mordent: 1, PERFECT: 100, GOOD: 200, EARLY: 260, HOLD: 0.65, GAP: 3200, TRILL: 10, CHART: 0.6, SPACE: [1, 1], METRIC: [1, 0.8, 0.9, 0.8], DASH_SQ: 2, ACC_WIN: 240, ACC_GAP: 16, ACC_HIT: 0.9, ACC_LEAD: 2, ORN: 1 },
        hard: { shift: 0, quake: 1, mordent: 1, PERFECT: 85, GOOD: 170, EARLY: 220, HOLD: 0.55, GAP: 1600, TRILL: 12, CHART: 0.45, SPACE: [1, 3], METRIC: [1, 1, 1, 1], DASH_SQ: 1, ACC_WIN: 180, ACC_GAP: 16, ACC_HIT: 0.75, ACC_LEAD: 1, ORN: 1.6, DASH_P: 0.45, UNLOCK_X: 0.4, SWITCH: true, DEMI_P: 0.05, DD_P: 0.3, STEP: 55 },
        // IMPOSSIBLE: Hard, twice: you and your lover (DUAL), each a Hard part of your own, and the notes shown much further ahead
        // (AHEAD_B / LEAD_B beats). (DASH_P: a dash's odds where one fits; UNLOCK_X: the elements come in that much sooner; SWITCH:
        // each dash another element than the last; DEMI_P: a demisemiquaver's odds after a step (a quick double step); DD_P: a dash's
        // odds of following a dash nearly at once (once its cooldown's over: DASH_CD; another element, once the switch's is too);
        // STEP: your step's cooldown, ms, for them)
        impossible: { shift: 0, quake: 1, mordent: 1, PERFECT: 85, GOOD: 170, EARLY: 220, HOLD: 0.55, GAP: 1600, TRILL: 12, CHART: 0.45, SPACE: [1, 3], METRIC: [1, 1, 1, 1], DASH_SQ: 1, ACC_WIN: 180, ACC_GAP: 16, ACC_HIT: 0.75, ACC_LEAD: 1, ORN: 1.6, DASH_P: 0.45, UNLOCK_X: 0.4, SWITCH: true, DEMI_P: 0.05, DD_P: 0.3, STEP: 55,
            DUAL: true, AHEAD_B: 5, AHEAD: [2800, 5200], LEAD_B: 5, LEAD: [3000, 5200] } };
    static C = RhythmTrial.CFG;
    // a beat's four semiquavers in a song's chart (0-1), the beat counted from the map's start bar; null past its end
    static chartBeat(M, b) {
        const row = M.chart?.[M.start + Math.floor(b / 4)];
        return row ? [...row.replace(/ /g, '').slice((b % 4) * 4, (b % 4) * 4 + 4)].map(c => c === '.' ? 0 : +c / 9) : null;
    }
    static chartAt(M, q) { return RhythmTrial.chartBeat(M, Math.floor(q / 4))?.[((q % 4) + 4) % 4] ?? 0; }   // (one semiquaver's)
    // a beat's notes from a song's chart (as semiquavers from the route's start; the beat's first is q0): its hits over thr, the
    // strongest first, each kept only if it leaves every note at least SPACE[0] semiquavers apart and no more than SPACE[1]
    // semiquaver gaps in a row, counting the notes just before (prev). Nothing kept: a rest, but in a quiet section every other beat
    // keeps its downbeat (pulse): a slow pulse, two beats a step (a hold, where it can)
    static fit(hits, q0, prev, thr, [min, run], pulse) {
        const keep = [];
        for (const o of [0, 1, 2, 3].filter(o => hits[o] >= thr).sort((a, b) => hits[b] - hits[a])) {
            const all = [...prev.filter(q => q > q0 - 8), ...keep, q0 + o].sort((a, b) => a - b), gaps = all.slice(1).map((q, i) => q - all[i]);
            let n = 0, ok = gaps.every(g => g >= min);
            for (const g of gaps) { n = g === 1 ? n + 1 : 0; if (n > run) ok = false; }
            if (ok) keep.push(q0 + o);
        }
        if (!keep.length && pulse) keep.push(q0);
        return keep.sort((a, b) => a - b);
    }
    static settings() {
        let diff = 'normal', speed = 1, inf = false, song = '', offset = 0;
        try { diff = localStorage.getItem('rt_diff') || diff; speed = parseFloat(localStorage.getItem('rt_speed')) || 1; inf = localStorage.getItem('rt_inf') === '1';
            song = localStorage.getItem('rt_song') || ''; offset = parseInt(localStorage.getItem('rt_off'), 10) || 0; } catch (e) {}
        return { diff: RhythmTrial.DIFF[diff] ? diff : 'normal', speed: Math.max(0.5, Math.min(1.5, Math.round(speed * 10) / 10)), inf, song: RhythmTrial.SONGS[song] ? song : '', offset };
    }
    static set(o) { try { for (const k in o) localStorage.setItem('rt_' + k, String(o[k])); } catch (e) {} }
    static tuned(track = null) {   // (with a song: its tempo all through, the phases busier in their rhythms, not faster)
        const B = RhythmTrial.CFG, { diff, speed } = RhythmTrial.settings(), D = RhythmTrial.DIFF[diff], BPM = B.BPM.map(b => track ? track.bpm * speed : Math.round(b * speed));
        return { ...B, BPM, MAP: track?.map || null, SHIFT: D.shift, QUAKE_P: B.QUAKE_P.map(p => p * D.quake), MORDENT_P: (track?.map?.mordent || B.MORDENT_P).map(p => p * D.mordent), GAP_MS: D.GAP, TRILL_N: D.TRILL, CHART_THR: D.CHART, SPACE: D.SPACE, METRIC: D.METRIC, PULSE: !!D.PULSE, ACCENT_WIN: D.ACC_WIN, ACC_GAP: D.ACC_GAP, ACC_HIT: D.ACC_HIT, ACC_LEAD: D.ACC_LEAD, ORN: D.ORN, DASH_SQ: D.DASH_SQ, DASH_P: D.DASH_P || 0.3, UNLOCK_X: D.UNLOCK_X ?? 1, SWITCH: !!D.SWITCH, DEMI_P: D.DEMI_P || 0, DD_P: D.DD_P || 0, DUAL: !!D.DUAL, AHEAD: D.AHEAD || B.AHEAD, LEAD: D.LEAD || B.LEAD, AHEAD_B: D.AHEAD_B || 2.5, LEAD_B: D.LEAD_B || 3, PERFECT: D.PERFECT, GOOD: D.GOOD, EARLY: D.EARLY, HOLD: D.HOLD,
            MEND: B.JUMP_MS - D.EARLY,   // (jump more than EARLY early and you land before the slab's whole)
            BEAMED: diff === 'easy',   // each beat's notes as one figure, beamed (route's `lead`/`mask`)
            STEP_MS: Math.min(D.STEP || B.STEP_MS, Math.floor(15000 / Math.max(...BPM)) - 15) };   // (a semiquaver at the top tempo, and a little to spare)
    }

    // the run's clock: the scene's, or with a song, the song's own (its playback position: it can't drift, and a pause holds it)
    static now(S) { return S.time.now + (S._rtrial?.drift || 0); }
    static groove(S) { const s = S._rtrial?.streak || 0; return (RhythmTrial.C.GROOVE.find(([n]) => s >= n) || [0, 1])[1]; }
    static inBreak(st, now) { return st.breaks.some(b => now >= b.t0 && now < b.t1); }
    // what a hit on the core is multiplied by (GameScene.damageEnemy): the groove, and the break
    static coreMult(S) { const st = S._rtrial; return st ? RhythmTrial.groove(S) * (RhythmTrial.inBreak(st, RhythmTrial.now(S)) ? RhythmTrial.C.BREAK_MULT : 1) : 1; }

    // tile k is ground from its note until HOLD of a beat after the next one's (the last, for good; a respawn's, a beat
    // longer; one torn by a quake, JGRACE after it tears)
    static from(st, k) { return k === 0 ? -Infinity : st.times[k]; }
    // how early you may land on note k: as early as you may be late (HOLD of its beat: the slab before holds that long), EARLY at least
    static early(st, k) { const C = RhythmTrial.C; return Math.max(C.EARLY, C.HOLD * st.R[k].beat); }
    static until(st, k) {
        const C = RhythmTrial.C, N = st.R.length - 1;
        if (st.cut?.[k] != null) return st.cut[k];   // (cut short: a trill's partner, once the trill's over)
        if (k >= N) return Infinity;
        const se = st.R[k].slurEnd;
        if (se != null && k < se) return RhythmTrial.until(st, se);   // (a slur's slabs stay till its last goes)
        if (st.R[k + 1].kind === 'quake') return st.times[k + 1] + C.JGRACE;
        if (st.R[k + 1].mordent || st.R[k + 1].trill) return k + 2 <= N ? st.times[k + 2] : Infinity;   // (the slab you step back onto in a mordent, a trill)
        const b = st.R[k + 1].beat;
        return st.times[k + 1] + C.HOLD * b + (st.graceI === k ? b : 0);
    }

    // The route: four rows across the arena (the core's band left clear), back and forth, joined by climbs a dash long (or
    // a cosmic hop across). Along a row: steps, sidesteps, quakes and, once they're unlocked, gaps to dash, GAP_MS apart at
    // least. Each move gets its time as it's laid (ms from the first slab's beat): the next note of the beat's pattern, far
    // enough after a dash or a jump to land first. Each phase's beat runs from its own start (t0), q semiquavers in.
    static route(A, o = {}) {   // (o.lane 1: Impossible's lover, the right half, on the hats-and-lead chart; o.other: your route, its dashes and jumps to fit)
        const C = RhythmTrial.C, b0 = 60000 / C.BPM[0], M = C.MAP, song = !!M;
        // a song's map in the route's time (0: the first note's bar's downbeat); `holes`, stretches with no notes (breaks, a glissando)
        const tBar = b => (b - (M?.start ?? 0)) * 4 * b0;
        const secs = song ? M.sections.map(([b, kind, lvl], i) => ({ t: tBar(b), t1: tBar(M.sections[i + 1]?.[0] ?? M.end), kind, lvl: lvl ?? 0 })) : [];
        const secAt = t => secs.findLast(x => t >= x.t) || secs[0], endT = song ? tBar(M.end) : Infinity;
        const gl0 = song && !C.DUAL ? (M.gliss || []).map(b => ({ t: tBar(b) - C.GLISS.SLIDE * b0, beat: b0, row: Math.floor(Math.random() * 3) })) : [];
        // two of you (DUAL): you both play at once, each your own part; only in the quiet sections (intro, calm) you take turns, a
        // bar each (yours the even ones, the lover's the odd: the other's rest, holes)
        const alt = C.DUAL && song ? secs.filter(x => x.kind === 'intro' || x.kind === 'calm') : [];
        const turns = alt.flatMap(x => { const n = Math.round((x.t1 - x.t) / (4 * b0)); return Array.from({ length: n }, (_, j) => j).filter(j => j % 2 === (o.lane ? 0 : 1)).map(j => [x.t + j * 4 * b0, x.t + (j + 1) * 4 * b0]); });
        const holes = [...secs.filter(x => x.kind === 'break').map(x => [x.t, x.t1]), ...gl0.map(g => [g.t, g.t + C.GLISS.BEATS * b0]), ...turns,
            ...(o.other || []).filter(m => m.kind === 'quake').map(m => [m.t + 1, m.t + C.JUMP_MS + 80])];   // (the lover's in the air with you on your jumps: nothing to step on then)
        const qOn = new Set([...(M?.quakes || []).map(b => Math.round(tBar(b) / b0) * 4), ...(o.other || []).filter(m => m.kind === 'quake').map(m => m.q)]),   // (the lover jumps with you: Space is both)
            MC = o.lane && M?.chart2 ? { ...M, chart: M.chart2 } : M, hitOn = new Set((M?.hits || []).map(b => Math.round(tBar(b) / b0) * 4));
        const musts = new Set([...qOn, ...hitOn].map(q => q / 4)), trillDone = new Set();   // beats a note must fall on
        const X0 = o.lane ? A.cx + 1 : A.cx - C.HALF, X1 = o.lane ? A.cx + C.HALF : C.DUAL ? A.cx - 1 : A.cx + C.HALF;   // (the rows' ends: with two of you, yours the left half, the lover's the right)
        const R = [{ x: o.lane ? X1 : X0, y: A.cy + C.ROWS[0], kind: 'start', t: 0, ph: 0, beat: b0, q: 0 }];
        const phases = [{ t0: 0, beat: b0, ph: 0, call: 0 }], breaks = [], last = () => R[R.length - 1];
        let dir = o.lane ? -1 : 1, row = 0, ph = 0, beat = b0, t0 = 0, q = 0, nextB = 1, queue = [], lastSp = -1e9, gap = null, lastEl = null;
        const glisses = [], trillsMax = C.DUAL ? 0 : 1 + (Math.random() < 0.5 ? 1 : 0), picked = [];   // (two of you: no trills, no glissando)
        let lastAcc = -1e9;   // (picked: the charted notes so far, for their spacing)
        let trills = trillsMax, glissed = false;
        const pick = () => {   // the next beat's pattern (with a song, its section's)
            const lv = song ? secAt(nextB * beat).lvl : ph, W = C.PATTERNS.map(p => p.w[Math.max(0, Math.min(3, lv + (C.SHIFT || 0)))]);
            const own = song && RhythmTrial.chartBeat(MC, nextB), yours = o.lane && song && RhythmTrial.chartBeat(M, nextB), sc = song && secAt(nextB * beat);
            const hits = own && yours ? own.map((h, i) => Math.max(h, yours[i] * [0.4, 0.95, 0.6, 0.95][i])) : own;   // (the lover: its hats and lead, else your offbeats: a part of its own)
            if (hits) { queue = RhythmTrial.fit(hits.map((h, o) => h * C.METRIC[o]), nextB * 4, picked, (C.CHART_THR - 0.04 * sc.lvl) * (o.lane ? 0.7 : 1), C.SPACE, (C.PULSE && Math.max(...hits) >= 0.35) || (nextB % 2 === 0 && ['intro', 'calm'].includes(sc.kind))); picked.push(...queue); }   // (busier sections take a little less; the lover's thinner hats-and-lead chart, less again: a Hard part too)
            else { let r = Math.random() * W.reduce((a, b) => a + b), i = 0; while ((r -= W[i]) > 0) i++; queue = C.PATTERNS[i].on.map(o => nextB * 4 + o); }
            if (!hits && song && C.QUIET?.has(nextB) && Math.random() < 0.7) queue = [];   // the music goes quiet: so do you (no chart)
            if (musts.has(nextB) && queue[0] !== nextB * 4) queue.unshift(nextB * 4);
            nextB++;
        };
        const plan = () => {
            if (gap) return gap;
            if (!song && row !== ph) return gap = { dq: 99, at: t0 + (Math.floor(q / 4) + 1 + C.BREAK_BEATS) * beat + 2 * 60000 / C.BPM[row] };   // a new phase: the break, the count-in
            const p = last(), sq = beat / 4, land = p.kind === 'quake' ? C.JUMP_MS + 80 : p.trill ? C.TRILL_MS + 700 : p.mordent ? C.MORDENT_GAP : p.kind === 'step' ? 0 : Math.max(C.LAND[p.el] || 0, (C.DASH_SQ || 1) * sq - 1);   // (a dash: DASH_SQ clear after it)
            for (;;) {
                if (!queue.length) pick();
                const hole = queue.length && holes.find(([a, b]) => t0 + queue[0] * sq >= a - 1 && t0 + queue[0] * sq < b - 1);   // (a ms either way: q * sq lands a hair under a bar's start)
                if (hole) { nextB = Math.ceil(hole[1] / beat - 1e-6); queue = []; continue; }   // (a break, a glissando: on past it)
                if (queue.length && (queue[0] - q) * sq >= Math.max(land, 1)) return gap = { dq: queue[0] - q, q: queue[0], at: t0 + queue[0] * sq };
                queue.shift();   // too soon to have landed (or a rest): on to the next
            }
        };
        // the end of a phase: a break from the next beat, then the next phase's count-in and its first beat
        const turn = () => {
            const B = t0 + (Math.floor(q / 4) + 1) * beat, end = B + C.BREAK_BEATS * beat;
            phases[phases.length - 1].end = B;
            breaks.push({ t0: B, t1: end });
            ph = row; beat = 60000 / C.BPM[ph]; t0 = end + 2 * beat; q = -4; nextB = 0; queue = []; gap = null;
            phases.push({ t0, beat, ph, call: end });
        };
        const pos = () => { const p = last(); return p.hold ? { ...p, x: p.x + p.hold * p.hdx } : p; };   // where the route stands: a hold's far end
        const push = (x, y, kind, el) => {
            if (!song && row !== ph) turn();
            const p = pos(), g = plan(); gap = null; q = g.q;
            const t = t0 + q * beat / 4;
            R.push({ x, y, kind, el, dx: Math.sign(x - p.x), dy: Math.sign(y - p.y), t, ph: song ? secAt(t).lvl : ph, beat, q });
            if (kind === 'dash' || kind === 'hop') { lastSp = t; lastEl = el; }
        };
        const level = () => song ? secAt(plan().at).lvl : row, over = () => song && plan().at >= endT;
        const orn = t => (C.ORN || 1) * (song ? RhythmTrial.SECTION_ORN[secAt(t).kind] ?? 1 : 1);   // (ornaments thicker in a song's chorus, on Hard)
        const canDash = (dd = false) => { const g = plan(); return (dd || g.at - lastSp >= C.GAP_MS) && (C.DASH_SQ > 1 ? g.dq >= C.DASH_SQ : g.dq >= 2 || level() >= 2) && ![...musts].some(b => b * beat > g.at && b * beat - g.at < 1200); };   // (a dash's landing doesn't swallow a must)
        // the lover's dash: with one of yours, the same element at the same moment; else clear of yours by more than Shift's reach
        // (700ms) for the same element, by the switch's cooldown (1s, and a little) for another (one Shift, one element)
        const xDash = (t, el) => !o.other || o.other.every(m => (m.kind !== 'dash' && m.kind !== 'hop') || (Math.abs(m.t - t) < 1 ? m.el === el : Math.abs(m.t - t) >= (m.el === el ? 700 : 1100)));
        // a dash this soon after the last: its cooldown over (and, for another element, the switch's), with a little to spare for timing
        const ddOk = (t, el) => t - lastSp >= Math.max(C.DASH_CD[lastEl] || 0, el === lastEl ? 0 : C.SWITCH_CD) + 150;
        const twin = () => o.other?.find(m => m.kind === 'dash' && Math.abs(m.t - plan().at) < 1);   // a dash of yours right when the lover's next note comes
        const pickEl = cands => { const fresh = C.SWITCH ? cands.filter(([e]) => e !== lastEl) : [], pool = fresh.length ? fresh : cands; return pool[Math.floor(Math.random() * pool.length)]; };   // (Hard: another element than the last dash's)
        const unl = el => u0 => u0 >= C.UNLOCK[el] * (C.UNLOCK_X ?? 1);   // (Hard: the elements come in sooner)
        const mustNear = (t, w) => song && [...musts].some(b => b * beat > t && b * beat - t < w);   // a must coming before a move's landing would be done
        const mustQuake = () => song && qOn.has(plan().q) && !last().mordent && !last().trill;   // (after a quake too: its slab's mended by then)
        const trillDue = q0 => !song || C.DUAL ? undefined : (M.trills || []).find(b => !trillDone.has(b) && q0 * b0 / 4 >= tBar(b) && q0 * b0 / 4 < tBar(b) + 4 * b0);   // not a semiquaver after a step, till the third phase
        const prog = (ri, x) => (ri + Math.abs(x - (A.cx - C.HALF * (ri % 2 ? -1 : 1))) / (2 * C.HALF)) / C.ROWS.length;
        const fresh = (x, y) => !R.slice(-10).some(m => m.y === y && (m.x === x || (m.hold && (x - m.x) * m.hdx > 0 && (x - m.x) * m.hdx <= m.hold)));   // a cell the route hasn't stood on lately (its slab long gone)
        // the rows in order (a song's route goes back and forth over them till the song's done)
        const order = song ? Array.from({ length: 80 }, (_, k) => [0, 1, 2, 3, 2, 1][k % 6]) : C.ROWS.map((_, i) => i);
        for (let oi = 0; oi < order.length && !over(); oi++) {
            const ri = order[oi], ry = C.ROWS[ri];
            row = ri;
            const y0 = ry + A.cy, end = dir > 0 ? X1 : X0;
            while ((end - pos().x) * dir > 0 && !over()) {
                const p = pos(), room = (end - p.x) * dir, r = Math.random(), u = song ? Math.min(1, plan().at / endT) : prog(ri, p.x), lv = level(), sec = song ? secAt(plan().at) : null;
                const fits = Object.entries(C.DASH).filter(([el, n]) => n <= room && unl(el)(u) && xDash(plan().at, el));
                const dd = C.DD_P && p.kind === 'dash' && Math.random() < C.DD_P;   // (Hard: a dash right after a dash, as soon as the cooldowns allow)
                let dfits = dd ? fits.filter(([e]) => ddOk(plan().at, e)) : fits;
                if (dd && !dfits.length && fits.length) {   // (not yet: the notes till the cooldown's over go unplayed, a breath, then the dash; never a must)
                    const tgt = lastSp + 150 + Math.min(...fits.map(([e]) => Math.max(C.DASH_CD[lastEl] || 0, e === lastEl ? 0 : C.SWITCH_CD)));
                    while (plan().at < tgt && tgt - plan().at < 2 * beat && !musts.has(plan().q / 4)) { gap = null; queue.shift(); }
                    dfits = fits.filter(([e]) => ddOk(plan().at, e) && xDash(plan().at, e));
                }
                if (mustQuake()) push(p.x, p.y, 'quake');   // a drop's first hit: the floor tears, wherever you are
                else if (p.y !== y0) {   // off the row: on along the lane a step at least, then back onto the row at a new cell (straight back
                    // was onto the slab just left, still standing: up-down-up read as one muddle)
                    if (!fresh(p.x, y0) || (room > 1 && Math.random() < 0.4)) push(p.x + dir, p.y, 'step');
                    else push(p.x, y0, 'step');
                }
                else if (song && (hitOn.has(plan().q) || (trillDue(plan().q) != null && room > 2))) push(p.x + dir, p.y, 'step');   // a big hit, a trill's bar: a plain step, to carry it
                else if (twin() && fits.some(([e]) => e === twin().el) && canDash() && Math.random() < 0.85) push(p.x + C.DASH[twin().el] * dir, p.y, 'dash', twin().el);   // (with yours: one Shift)
                else if (dfits.length && (dd || r < (C.DASH_P || 0.3)) && canDash(dd)) { const [el, n] = pickEl(dfits); push(p.x + n * dir, p.y, 'dash', el); }
                else if (!o.lane && r > 1 - Math.min(0.45, C.QUAKE_P[lv] * orn(plan().at)) && p.kind === 'step' && !p.hold && (song || row === ph) && plan().dq >= 2 && plan().q % 4 === 0 && !mustNear(plan().at, C.JUMP_MS + 80)) push(p.x, p.y, 'quake');   // on a beat
                else if (r < 0.42 && u > 0.08 && room > 1 && [-1, 1].some(d => fresh(p.x, p.y + d))) {   // (room to go on along the lane after; never back onto a lane just left)
                    const ds = [-1, 1].filter(d => fresh(p.x, p.y + d));
                    push(p.x, p.y + ds[Math.floor(Math.random() * ds.length)], 'step');
                }
                else push(p.x + dir, p.y, 'step');
                const q2 = last(), moved = q2.x !== p.x || q2.y !== p.y, plainStep = q2.kind === 'step' && moved;   // a mordent on a step now and then (not off a quake: there's no slab behind to step back to; sideways only: up-down-up is far harder than A-D-A)
                if (plainStep && !q2.dy && u > 0.1 && p.kind !== 'quake' && !p.hold && !hitOn.has(q2.q) && !mustNear(q2.t, C.MORDENT_GAP + 50) && Math.random() < C.MORDENT_P[lv] * orn(q2.t)) q2.mordent = true;
                // an accent, with a quaver at least before it (a strike wants a moment to line up); with a song, on its big hits,
                // and in a drop on the snares (beats 2 and 4) now and then
                // (a charted song: on each of its strongest hits, ACC_GAP apart at least)
                const accP = o.lane ? 0 : song ? (hitOn.has(q2.q) ? 1 : M.chart ? +(RhythmTrial.chartAt(M, q2.q) >= C.ACC_HIT && q2.q - lastAcc >= Math.max(8, C.ACC_GAP / orn(q2.t))) : sec.kind === 'drop' && q2.q % 8 === 4 ? 0.3 : 0) : C.ACCENT_P[lv];
                if (plainStep && !q2.mordent && u > 0.08 && q2.t - p.t >= q2.beat / (hitOn.has(q2.q) ? 4 : 4 / (C.ACC_LEAD || 2)) - 1 && Math.random() < accP) { q2.accent = true; lastAcc = q2.q; }
                // a trill, rarely (1 or 2 a run; the last row makes sure of one; with a song, in its trill bars), off a step, with room on along the row (sideways only, like a mordent)
                const trillBar = trillDue(q2.q);
                if (plainStep && (song ? trillBar != null && trillBar !== false && !mustNear(q2.t, C.TRILL_MS + 750) : trills > 0 && ri >= 1) && !q2.dy && !q2.mordent && !q2.accent && p.kind === 'step' && !p.hold && (end - q2.x) * dir > 1
                    && (song || Math.random() < C.TRILL_P[ri] || (ri === C.ROWS.length - 1 && u > 0.8 && trills === trillsMax))) { q2.trill = true; trills--; if (song) trillDone.add(trillBar); }
                // the glissando: once, halfway along the third row, BEATS clear of notes from the next beat (a song's is in its map)
                if (!song && !C.DUAL && !glissed && ri === 2 && u > 0.55 && plainStep && !q2.mordent && !q2.trill && !q2.accent) {
                    glissed = true;
                    const nb = Math.floor(q / 4) + 1;
                    glisses.push({ t: t0 + nb * beat, beat, row: Math.floor(Math.random() * 3) });
                    nextB = nb + C.GLISS.BEATS; queue = []; gap = null;
                }
                // a long note: a plain step along the row with two beats or more till the next becomes a slab as many cells long
                // as its beats (a minim 2, a dotted minim 3, a semibreve 4; as far as the row goes), held along; on a beat (alone in it,
                // so Easy's figure is the note); not where a song goes quiet (a rest, there), nor over a break or a glissando, nor into
                // a quake (its slab tears where you stand)
                if (plainStep && q2.q % 4 === 0 && !q2.dy && !q2.mordent && !q2.trill && !q2.accent && !p.hold && (song || row === ph)) {
                    const g = plan(), n = Math.min(4, Math.floor((g.at - q2.t) / beat + 1e-6), (end - q2.x) * dir + 1), b1 = Math.floor(q2.t / beat + 1e-6) + 1;
                    const quiet = song && Array.from({ length: Math.max(0, Math.ceil(g.at / beat - 1e-6) - b1) }, (_, i) => b1 + i).some(b => C.QUIET?.has(b));
                    const clear = ![...holes, ...glisses.map(G => [G.t, G.t + C.GLISS.BEATS * G.beat])].some(([a, b]) => a < g.at && b > q2.t);
                    if (n >= 2 && !quiet && clear && !qOn.has(g.q)) Object.assign(q2, { hold: n - 1, hdx: dir, holdV: n * 4, holdMs: n * beat });
                }
                // a demisemiquaver now and then (Hard): a step on along the row half a semiquaver after this one, a quick double step,
                // with a semiquaver at least before the next
                if (C.DEMI_P && plainStep && !q2.dy && !q2.mordent && !q2.trill && !q2.accent && !q2.hold && (end - q2.x) * dir >= 2 && fresh(q2.x + dir, q2.y) && Math.random() < C.DEMI_P * orn(q2.t)) {
                    const g = plan(), td = q2.t + beat / 8;
                    if (g.q - q2.q >= 2 && !holes.some(([a, b]) => td >= a - 1 && td < b)) R.push({ x: q2.x + dir, y: q2.y, kind: 'step', dx: dir, dy: 0, t: td, ph: q2.ph, beat, q: q2.q + 0.5, demi: true });
                }
            }
            if (over()) break;
            if (mustQuake()) push(pos().x, pos().y, 'quake');
            if (pos().y !== y0) push(pos().x, y0, 'step');
            const next = C.ROWS[order[oi + 1]];
            if (next !== undefined && !over()) {   // up or down to the next row
                const p = pos(), climb = Math.abs(ry - next), sg = Math.sign(next - ry), u = song ? Math.min(1, plan().at / endT) : (ri + 1) / C.ROWS.length;
                const el = Object.entries(C.DASH).find(([e, n]) => n === climb && unl(e)(u))?.[0];
                if (mustQuake()) push(p.x, p.y, 'quake');
                const ddc = C.DD_P && p.kind === 'dash' && Math.random() < C.DD_P * 2, sameOk = e => !ddc || ddOk(plan().at, e);   // (Hard: off a row's last dash, straight up or down by another)
                if (unl('cosmic')(u) && Math.random() < 0.5 && canDash(ddc) && xDash(plan().at, 'cosmic') && sameOk('cosmic')) push(p.x - dir * 2, A.cy + next, 'hop', 'cosmic');
                else if (el && canDash(ddc) && xDash(plan().at, el) && sameOk(el)) push(p.x, A.cy + next, 'dash', el);
                else for (let k = 0; k < climb;) { if (mustQuake()) { push(pos().x, pos().y, 'quake'); continue; } push(p.x, last().y + sg, 'step'); k++; }   // (a drop mid-climb: the quake where you are)
            }
            dir = -dir;
        }
        last().end = true;
        R.forEach((m, k) => { m.dur = k < R.length - 1 ? Math.round(2 * (R[k + 1].t - m.t) / (m.beat / 4)) / 2 : 4; });   // each note's value: semiquavers till the next (halves: a demisemiquaver)
        // each beat's notes together (Easy draws a beat as one figure): `lead`, the beat's first note (not the slab you start
        // on), and on it `mask`, which of the beat's four semiquavers have a note (bit o: o in)
        const beatOf = m => m.t - (((m.q % 4) + 4) % 4) * m.beat / 4;   // (when its beat starts)
        for (let k = 1; k < R.length; k++) {
            const m = R[k], p = R[k - 1], f = k > 1 && Math.abs(beatOf(p) - beatOf(m)) < 1 ? p.lead : m;
            m.lead = f; f.mask = (f === m ? 0 : f.mask) | 1 << (((m.q % 4) + 4) % 4);
        }
        // a song's big hits, an accent wherever they fell (a climb's step, a row's last)
        if (song) for (const m of R) if (hitOn.has(m.q) && m.kind === 'step' && !m.mordent && !m.trill && !m.end && (m.dx || m.dy)) m.accent = true;
        // slurs: now and then a run of 3 to 5 plain steps in a phase, tied in one phrase
        const plain = (j, ph0) => R[j] && R[j].kind === 'step' && !R[j].mordent && !R[j].accent && !R[j].trill && !R[j].hold && !R[j].end && R[j].ph === ph0;
        for (let k = 1; k < R.length - 3; k++) {
            if (!plain(k, R[k].ph) || Math.random() > C.SLUR_P) continue;
            let e = k;
            while (e - k < 4 && plain(e + 1, R[k].ph)) e++;
            if (e - k < 2) continue;
            for (let j = k; j <= e; j++) { R[j].slurStart = k; R[j].slurEnd = e; }
            k = e + 1;
        }
        phases[phases.length - 1].end = last().t + beat;
        // the metronome: every beat of each phase, from its count-in (the first phase's is the trial's own, before it)
        const ticks = [];
        if (song) {   // one tempo throughout; its sections called out as they come
            for (let t = 0; t < last().t + beat; t += beat) ticks.push(t);
            return { R, ticks, phases: secs.slice(1).filter(x => RhythmTrial.SECTION[x.kind]).map(x => ({ t: x.t, ph: x.lvl, name: x.kind })), glisses: gl0,
                breaks: secs.filter(x => x.kind === 'break').map(x => ({ t0: x.t, t1: x.t1 })) };
        }
        phases.forEach((P, i) => { for (let t = i ? P.t0 - 2 * P.beat : P.t0; t < P.end - 1; t += P.beat) ticks.push(t); });
        return { R, ticks, phases: phases.slice(1).map(P => ({ t: P.call, ph: P.ph })), breaks, glisses };
    }

    // The art is in assets/art: the slab (fx_rt_top; under it fx_rt_face, its cut face and the rock tapering to a point below,
    // hung a cell under it), and a note for each value (dur, semiquavers till the next), white to be tinted its NOTE_COL:
    // fx_rt_n1 a semiquaver, n2 a quaver, n3 a dotted quaver, n4 a crotchet, n6 a dotted crotchet, n8 a minim (anything longer)
    // (two beats or more till the next: a crotchet and rests after it, one a silent beat, a quaver rest for a half: restsOf)
    static noteVal(dur) { return dur < 1 ? 0.5 : dur <= 1 ? 1 : dur === 2 ? 2 : dur === 3 ? 3 : dur <= 5 ? 4 : dur <= 7 ? 6 : 4; }
    static restsOf(dur) { if (dur < 8) return []; const r = dur - 4, out = Array(Math.min(2, Math.floor(r / 4))).fill('fx_rt_r4'); if (r % 4 >= 2) out.push('fx_rt_r2'); return out.slice(0, 3); }
    static noteKey(dur) { return RhythmTrial.valKey(RhythmTrial.noteVal(dur)); }
    static valKey(v) { return 'fx_rt_n' + (v === 0.5 ? '05' : v); }   // (fx_rt_n05: a demisemiquaver)
    // A HOLD (a long note: route's hold, hdx, holdV its value in semiquavers, holdMs): a slab hold + 1 cells along the row, from
    // its note's; held along, you're carried from the first cell to the last over its beats; each cell but the last crumbles
    // once the beat's half a cell past it (and GOOD more)
    static endX(m) { return m.x + (m.hold || 0) * (m.hdx || 0); }
    // A slab you made takes its note's colour (noteCol), flashing white first and swelling, a hold's cells one after another;
    // one you missed goes red (MISS_COL). It keeps it as it crumbles. Not formed yet: it takes it when it does (tile)
    static noteCol(st, k) { return RhythmTrial.C.NOTE_COL[RhythmTrial.look(st.R[k], st.R[k + 1])[1]]; }
    static paint(S, k, col) {
        const st = S._rtrial, t = st.tiles[k];
        if (!t) { (st.paint ||= {})[k] = col; return; }
        if (!t.box?.active || t.ghost || t.gone) return;
        t.col = col;
        const dark = Phaser.Display.Color.IntegerToColor(col).darken(40).color;
        (t.cells || [[t.top, t.face]]).forEach(([top, face], c) => {
            if (top.gone) return;
            top.setTintFill(0xffffff);
            S.time.delayedCall(60 + c * 45, () => { if (top.active) { top.setTint(col); face.setTint(dark); } });
        });
        S.tweens.add({ targets: t.box, scale: 1.1, duration: 80, yoyo: true, ease: 'Quad.easeOut' });
    }
    static MISS_COL = 0xff3a3a;
    // a slab done with falls away into the dark: turning over, drifting, shrinking with the depth, and fades only at the end
    static tumble(S, o, onDone) {
        const T = S.TILE_SIZE, spin = (Math.random() < 0.5 ? -1 : 1) * (100 + Math.random() * 140);
        o.setDepth(0.6);   // (under the slabs still standing)
        S.tweens.add({ targets: o, y: o.y + T * 3.4, x: o.x + (Math.random() - 0.5) * T, angle: spin, scale: 0.22, duration: 1150, delay: 120, ease: 'Quad.easeIn', onComplete: () => { o.destroy(); onDone?.(); } });
        S.tweens.add({ targets: o, alpha: 0, duration: 380, delay: 890 });
    }
    static cellGone(st, k, c) { const m = st.R[k]; return st.times[k] + (c + 0.5) / m.hold * m.holdMs + RhythmTrial.C.GOOD; }
    // its line along the foot of the slab in its note's colour, to a dot at the far end; the one you're on lit as far as the beat's got
    static holdBar(S, k, a) {
        const st = S._rtrial, T = S.TILE_SIZE, m = st.R[k], col = RhythmTrial.C.NOTE_COL[m.holdV], y = m.y * T + T / 2 + T * 0.32, x0 = m.x * T + T / 2, x1 = RhythmTrial.endX(m) * T + T / 2;
        st.fx.lineStyle(T * 0.16, 0x07060a, 0.6 * a).lineBetween(x0, y, x1, y);
        st.fx.lineStyle(T * 0.09, col, 0.85 * a).lineBetween(x0, y, x1, y);
        st.fx.fillStyle(col, a).fillCircle(x1, y, T * 0.1);
        if (k === st.i) st.fx.lineStyle(T * 0.09, 0xffffff, a).lineBetween(x0, y, x0 + (x1 - x0) * Phaser.Math.Clamp((RhythmTrial.now(S) - st.times[k]) / m.holdMs, 0, 1), y);
    }
    // Easy, a beat as one figure (beamed, on its first note; fx_rt_head, a notehead, on the rest): a note's value within its
    // beat (semiquavers to the beat's next note or its end), and the beats after with no note (a crotchet rest each, under the
    // beat's last note). The figure is the fx_rt_fig atlas's layers for its mask, stacked like the notes are drawn (a coloured
    // edge round a dark stroke): the lead-in rest's edge, each note's in its own value's colour, the beam's (theirs if they're
    // all one value), then every stroke over them
    static inBeat(m) { const o = ((m.q % 4) + 4) % 4, M = m.lead.mask; let e = o + 1; while (e < 4 && !(M >> e & 1)) e++; return e - o; }
    static look(m, next) {   // what's drawn for note m: [texture, colour value, rests, the figure's layers ([frame, tint]) or null]
        const C = RhythmTrial.C;
        if (m.hold) return ['fx_rt_n' + m.holdV, m.holdV, Array(Phaser.Math.Clamp(Math.floor((m.dur - m.holdV) / 4), 0, 2)).fill('fx_rt_r4'), null];   // (on a beat, alone in it)
        if (!C.BEAMED || !m.lead) return [RhythmTrial.noteKey(m.dur), RhythmTrial.noteVal(m.dur), RhythmTrial.restsOf(m.dur), null];
        const silent = next && next.lead !== m.lead && next.beat === m.beat ? Math.round((next.t - m.t) / m.beat - (4 - (((m.q % 4) + 4) % 4)) / 4 - (((next.q % 4) + 4) % 4) / 4) : 0;
        const rests = Array(Phaser.Math.Clamp(silent, 0, 2)).fill('fx_rt_r4');
        if (m.lead !== m) return ['fx_rt_head', RhythmTrial.inBeat(m), rests, null];
        const on = [0, 1, 2, 3].filter(o => m.mask >> o & 1), d = on.map((o, i) => (on[i + 1] ?? 4) - o), L = [];
        if (on[0]) L.push([m.mask + 'r', 0xf0ecff]);
        d.forEach((v, i) => L.push([m.mask + 'n' + i, C.NOTE_COL[v]]));
        if (on.length > 1) L.push([m.mask + 'b', C.NOTE_COL[d.every(v => v === d[0]) ? d[0] : 4]]);
        return ['fx_rt_fig', d[0], rests, [...L, [m.mask + 'o', null]]];
    }

    // you and what goes with you: the body, its face, the weapon in hand and its pair
    // every press so far, spent: none carries into the trial, or out of a fall (GameScene's step takes each press once)
    static eatKeys(S) { S._rtUsed = Object.fromEntries(['W', 'S', 'A', 'D'].map(n => [n, S.keys?.[n]?.timeDown])); }
    static ghosts(S) { const G = S._cfxGearState; return [S.player, S.player?._cfx?.eyes, S.player?._cfx?.hat, G?.main, G?.off].filter(o => o?.active); }

    // ── START / STOP ──
    static start(S) {
        if (S._rtrial) RhythmTrial.stop(S);
        if (!S._trainArena) return;
        const set = RhythmTrial.settings(), song = set.song && RhythmTrial.SONGS[set.song], key = 'rt_song_' + set.song;
        if (!song) return RhythmTrial.begin(S, null);
        if (S.cache.audio.exists(key)) return RhythmTrial.begin(S, { ...song, key });
        Training.showPanel(S, false);
        S.showStatusText?.(S.player.x, S.player.y - 40, 'LOADING THE SONG...', '#f3e3b8');
        RhythmTrial.loadSong(S, song, key, ok => {
            if (ok) return RhythmTrial.begin(S, { ...song, key });
            S.showStatusText?.(S.player.x, S.player.y - 40, `NO SONG: SAVE IT AS assets/music/local/${song.file}.mp3`, '#ff9a6a');
            RhythmTrial.begin(S, null);
        });
    }
    // a song's file (.mp3, else .wav), loaded once
    static loadSong(S, song, key, done) {
        (async () => {
            for (const ext of ['mp3', 'wav']) {
                const url = `assets/music/local/${song.file}.${ext}`;
                try { if (!(await fetch(url, { method: 'HEAD' })).ok) continue; } catch (e) { continue; }
                S.load.audio(key, url);
                S.load.once('complete', () => done(S.cache.audio.exists(key)));
                S.load.start();
                return;
            }
            done(false);
        })();
    }
    // Where a song's beats fall in its file (ms to the first, under a beat): its loudness rising, frame by frame (5ms), summed
    // along a beat grid at each starting point; the grid the kicks and snares land on scores highest. Once per song.
    static phase(S, key, bpm) {
        const C = (S._rtPhase ||= {});
        if (C[key] != null) return C[key];
        const buf = S.cache.audio.get(key);
        if (!buf?.getChannelData) return (C[key] = 0);   // (no Web Audio: from the top)
        const ch = buf.getChannelData(0), hop = Math.round(buf.sampleRate * 0.005), N = Math.min(Math.floor(ch.length / hop), 12000), env = new Float32Array(N);
        let prev = 0;
        for (let i = 0; i < N; i++) { let e = 0; for (let j = i * hop, J = j + hop; j < J; j++) e += ch[j] * ch[j]; e = Math.sqrt(e / hop); env[i] = Math.max(0, e - prev); prev = e; }
        const per = 60000 / bpm / 5;
        let best = 0, top = -1;
        for (let p = 0; p < per; p++) { let sum = 0; for (let t = p; t < N; t += per) sum += env[Math.round(t)] || 0; if (sum > top) { top = sum; best = p; } }
        return (C[key] = best * 5);
    }

    // A mapped song's quiet beats (no kick, no snare: its loudness hardly rising at the beat), as the route's beats: rests come
    // there more often. Once per song.
    static quiet(S, track) {
        const M = track.map, Q = (S._rtQuiet ||= {});
        if (Q[track.key]) return Q[track.key];
        const buf = S.cache.audio.get(track.key), out = new Set();
        if (!buf?.getChannelData) return (Q[track.key] = out);
        const ch = buf.getChannelData(0), hop = Math.round(buf.sampleRate * 0.01), n = Math.floor(ch.length / hop), env = new Float32Array(n);
        for (let i = 0; i < n; i++) { let e = 0; for (let j = i * hop, J = j + hop; j < J; j++) e += ch[j] * ch[j]; env[i] = Math.sqrt(e / hop); }
        const bf = 60000 / track.bpm, beats = (M.end - M.start) * 4, hit = new Float32Array(beats);
        for (let b = 0; b < beats; b++) {
            const ms = M.first + (M.start * 4 + b) * bf;
            for (let i = Math.max(2, Math.floor((ms - 40) / 10)); i <= Math.min(n - 1, Math.floor((ms + 60) / 10)); i++) hit[b] = Math.max(hit[b], env[i] - env[i - 2]);
        }
        const med = [...hit].sort((a, b) => a - b)[beats >> 1] || 0;
        hit.forEach((h, b) => { if (h < med * 0.45) out.add(b); });
        return (Q[track.key] = out);
    }

    static begin(S, track) {
        const A = S._trainArena, C = RhythmTrial.C = RhythmTrial.tuned(track), T = S.TILE_SIZE, set = RhythmTrial.settings();
        if (!A || S._rtrial) return;
        if (track?.map) C.QUIET = RhythmTrial.quiet(S, track);
        Training.clear(S);
        const { R, ticks, phases, breaks, glisses } = RhythmTrial.route(A), b0 = 60000 / C.BPM[0];
        let t0 = S.time.now + 600, song = t0 + C.COUNT_IN * b0, snd = null;
        let songT0 = S.time.now, playAt = 0, seek = 0;
        if (track) {   // the song plays from a map's `from` bar; the route on its first note (a map's `start` bar; else START_BEAT
            // beats in, from the first beat found by phase), nudged by the panel's offset. The song comes in as late as the
            // count-in needs: right away when it has bars to play under it, after it when the notes start with the song (tick plays it)
            const r = set.speed, beatFile = 60000 / track.bpm, M = track.map, first = M ? M.first : RhythmTrial.phase(S, track.key, track.bpm);
            const startMs = first + (M ? M.start * 4 : C.START_BEAT) * beatFile;
            seek = M?.from ? Math.max(0, first + M.from * 4 * beatFile - 60) / 1000 : 0;
            const lead = (startMs + set.offset) / r - seek * 1000 / r;   // (from the song coming in to the first note)
            snd = S.sound.add(track.key, { volume: Music.muted() ? 0 : Math.min(1, Music.volume() * 2), rate: r });
            song = S.time.now + Math.max(lead, 600 + C.COUNT_IN * b0); t0 = song - C.COUNT_IN * b0;
            playAt = song - lead; songT0 = playAt - seek * 1000 / r;
            Music.duck(true, 'trial');
        }
        const st = S._rtrial = { R, t0, times: R.map(m => song + m.t), ticks: [], tk: 0, phases: phases.map(p => ({ ...p, t: song + p.t })), pi: 0,
            breaks: breaks.map(b => ({ t0: song + b.t0, t1: song + b.t1 })), bi: 0, glisses: glisses.map(g => ({ ...g, t: song + g.t })), gi: 0,
            clickAt: -1e9, landAt: -1e9, landK: null, landDone: true, told: {},
            i: 0, lives: RhythmTrial.settings().inf ? Infinity : C.LIVES, combo: 0, streak: 0, objs: [], tiles: [], graceI: -1, done: false, falling: false, pulse: 0, shake: 0, flash: 0, kick: 0,   // (lives unlimited, set in the panel: a fall costs the combo, never the run)
            pScale: [S.player.scaleX, S.player.scaleY], mc0: S.moveCooldown, snd, songT0, playAt, seek, rate: set.speed, drift: 0, track };
        for (let b = 0; b < C.COUNT_IN; b++) st.ticks.push(t0 + b * b0);
        st.ticks.push(...ticks.map(t => song + t));
        S.moveCooldown = C.STEP_MS;
        const keep = o => { st.objs.push(o); return o; }, ADD = Phaser.BlendModes.ADD;
        // the abyss where the floor was: near-black over every floor cell, nebulae of violet and blue breathing far below, motes
        // drifting and twinkling, now and then a crumb of rock tumbling away into the dark; the core's light swells on the beat
        const LR = Training.R, cells = [], dark = keep(S.add.graphics().setDepth(0.5));
        for (let x = A.cx - LR; x <= A.cx + LR; x++) for (let y = A.cy - LR; y <= A.cy + LR; y++) {
            if (S.world[x]?.[y] !== S.FLOOR) continue;
            cells.push([x, y]);
            dark.fillStyle(0x06040c, 1).fillRect(x * T, y * T, T + 0.5, T + 0.5);   // (one shade: two made a checkerboard)
        }
        st.cells = cells;
        const at = () => { const [x, y] = cells[Math.floor(Math.random() * cells.length)]; return [x * T + Math.random() * T, y * T + Math.random() * T]; };
        for (let k = 0; k < 6; k++) {
            const [x, y] = at(), n = keep(S.add.image(x, y, 'vfx_glow').setBlendMode(ADD).setTint(k % 2 ? 0x3a1a7a : 0x1a2a7a).setScale(3 + Math.random() * 2).setAlpha(0.14).setDepth(0.51));
            S.tweens.add({ targets: n, alpha: 0.24, x: x + (Math.random() - 0.5) * T * 4, y: y + (Math.random() - 0.5) * T * 4, duration: 4000 + Math.random() * 4000, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
        }
        for (let k = 0; k < 60; k++) {
            const [x, y] = at(), d = keep(S.add.image(x, y, 'vfx_dot').setBlendMode(ADD).setTint([0xb89aff, 0x8ad8ff, 0xffffff][k % 3]).setScale(0.25 + Math.random() * 0.35).setAlpha(0.15 + Math.random() * 0.4).setDepth(0.515));
            S.tweens.add({ targets: d, alpha: 0.05, x: x + (Math.random() - 0.5) * T, y: y + (Math.random() - 0.5) * T, duration: 1500 + Math.random() * 3000, yoyo: true, repeat: -1, ease: 'Sine.easeInOut', delay: Math.random() * 2000 });
        }
        st.crumbs = S.time.addEvent({ delay: 260, loop: true, callback: () => {
            if (S._rtrial !== st) return;
            const [x, y] = at(), c = S.add.image(x, y, 'vfx_dot').setTint(0x6a5a7a).setScale(0.7).setAlpha(0.8).setDepth(0.52);
            S.tweens.add({ targets: c, scale: 0.1, alpha: 0, y: y + T * 0.8, angle: 180, duration: 1600, ease: 'Quad.easeIn', onComplete: () => c.destroy() });
        } });
        st.glow = keep(S.add.image(A.cx * T + T / 2, A.cy * T + T / 2, 'vfx_glow').setTint(0x7a4aff).setBlendMode(ADD).setDisplaySize(T * 26, T * 26).setAlpha(0.1).setDepth(0.52));
        // the core: out of reach in the middle, floating, a real enemy (every weapon hits it)
        const core = st.core = S.createEnemy(A.cx, A.cy, Math.round(C.CORE_HP * Math.max(1, R[R.length - 1].t / 55000)));   // (as tough as the run is long: a song's runs three times as long)
        core.tutorialRoomIndex = 0; core._moveCdMult = 999; core._rhythmCore = true;
        core._baseScale = S.SLIME_SCALE * 1.8; core.sprite.setScale(core._baseScale); LevelManager.seat(core, 1.8);
        core.sprite.setTint(0xffc860);
        st.coreGlow = keep(S.add.image(core.sprite.x, core.sprite.y, 'vfx_glow').setTint(0xffa040).setBlendMode(ADD).setScale(0.8).setAlpha(0.5).setDepth(0.95));
        // you, on the first slab
        const p0 = R[0];
        S.playerX = p0.x; S.playerY = p0.y; S._step = null;
        S.player.setPosition(p0.x * T + T / 2, p0.y * T + T / 2 + (S.SLIME_Y_OFFSET || 0));
        RhythmTrial.tile(S, 0, false);
        RhythmTrial.eatKeys(S);
        // left mid-run (LEAVE, the menu): the song is the game's, not the scene's, and would play on over the menus; the music
        // would stay hushed; a glissando's keyboard would stay off into the next level
        S.events.once('shutdown', () => {
            if (S._rtrial !== st) return;
            if (st.lover) { const l2 = st.lover.st2; S.events.off('update', l2.tick); S.events.off('postupdate', l2.ghost); S.input.keyboard.off('keydown-' + Settings.key('dash'), l2.onJump); st.lover.S2._rtrial = null; }
            if (st.snd) { st.snd.stop(); st.snd.destroy(); Music.duck(false, 'trial'); }
            if (st.glKey) window.removeEventListener('keydown', st.glKey);
            S.input.keyboard.enabled = true;
            S._rtrial = null;
        });
        st.tick = () => RhythmTrial.tick(S);
        S.events.on('update', st.tick);
        st.ghost = () => { if (!st.falling) RhythmTrial.ghosts(S).forEach(o => o.setAlpha(C.GHOST)); };   // after the frame's own updates, which set their alpha
        S.events.on('postupdate', st.ghost);
        st.onClick = p => { if (!p.rightButtonDown()) RhythmTrial.strike(S, 'click'); };   // a fresh click (an accent's strike: held fire doesn't count)
        S.input.on('pointerdown', st.onClick);
        RhythmTrial.hudBuild(S);
        // the world camera in close (about 21 x 11 tiles; the HUD has its own camera), leaning toward the core so it's in
        // sight from every row (tick)
        const cam = S.cameras.main; st.z0 = cam.zoom; st.fo = [cam.followOffset.x, cam.followOffset.y];
        st.zBase = Math.max(st.z0, Math.min(S.scale.width / ((C.DUAL ? 23 : 21) * T), S.scale.height / ((C.DUAL ? 13 : 11.5) * T))); st.zoomAt = RhythmTrial.now(S) + 750;   // (two of you: both halves in view)
        cam.zoomTo(st.zBase, 700, 'Cubic.easeInOut', true);
        Training.showPanel(S, false);   // the Training panel out of the way (back at the end)
        if (C.DUAL) RhythmTrial.loverBegin(S, st, song);
        st.unit = 1 / (C.PERF.KILL * (st.R.length - 1 + (st.lover ? st.lover.st2.R.length - 1 : 0)));   // a PERFECT note's hit on the core (PERF: the lover's notes count too)
        RhythmTrial.banner(S, 'READY', C.DUAL ? 'YOU: WASD  ·  YOUR LOVER: ARROWS  ·  SHIFT dashes, SPACE jumps, both of you' : 'WASD step  ·  SHIFT dash  ·  SPACE jump', '#f3e3b8');
    }
    static stop(S) {
        const st = S._rtrial;
        if (!st) return;
        S.events.off('update', st.tick); S.events.off('postupdate', st.ghost); S.input.off('pointerdown', st.onClick);
        if (st.gl) RhythmTrial.glissClean(S);
        if (st.snd) { const sn = st.snd; S.tweens.add({ targets: sn, volume: 0, duration: 700, onComplete: () => { sn.stop(); sn.destroy(); } }); Music.duck(false, 'trial'); }
        RhythmTrial.ghosts(S).forEach(o => o.setAlpha(1));
        st.crumbs?.remove();
        for (const o of [...st.objs, ...st.tiles.flatMap(t => t ? [t.box, t.shadow, t.rim] : [])]) if (o?.active) { S.tweens.killTweensOf(o); o.destroy(); }
        if (st.lover) {   // (the lover's run, its slime and slabs)
            const { S2, st2 } = st.lover;
            S.events.off('update', st2.tick); S.events.off('postupdate', st2.ghost); S.input.keyboard.off('keydown-' + Settings.key('dash'), st2.onJump);
            for (const o of [...st2.objs, ...st2.tiles.flatMap(t => t ? [t.box, t.shadow, t.rim] : [])]) if (o?.active) { S.tweens.killTweensOf(o); o.destroy(); }
            S2._rtrial = null;
        }
        if (st.core?.sprite?.active) S.killEnemy(st.core);
        S._rtrial = null;
        S.moveCooldown = st.mc0;
        const cam = S.cameras.main;
        cam.setFollowOffset(...st.fo); cam.zoomTo(st.z0, 500, 'Cubic.easeInOut', true);
        S.tweens.killTweensOf(S.player); S.player.setAlpha(1).setScale(...st.pScale);
        Training.showPanel(S, true);
        const A = S._trainArena, T = S.TILE_SIZE;
        S.playerX = A.cx; S.playerY = A.cy + 4; S._step = null;
        S.player.setPosition(S.playerX * T + T / 2, S.playerY * T + T / 2 + (S.SLIME_Y_OFFSET || 0));
    }

    // slab k (a violet glow under its point holding it up, a faint one along its foot); `snap`: it flies up out of the slab
    // before it and locks into place. Lower rows draw over higher ones, so a slab's face hides behind the slab in front of it.
    static tile(S, k, snap = true) {
        const st = S._rtrial, C = RhythmTrial.C, T = S.TILE_SIZE, m = st.R[k], x = m.x * T + T / 2, y = m.y * T + T / 2;
        const n = (m.hold || 0) + 1, mid = x + (n - 1) * (m.hdx || 0) * T / 2;   // (a hold's: n cells along the row)
        const shadow = S.add.image(mid, y + T * 1.35, 'vfx_glow').setBlendMode(Phaser.BlendModes.ADD).setTint(0x8a5aff).setScale(0.3 * n, 0.22).setAlpha(0.55).setDepth(0.53);
        const rim = S.add.image(mid, y + T * 0.75, 'vfx_glow').setBlendMode(Phaser.BlendModes.ADD).setTint(0x6a4ad8).setScale(0.5 * n, 0.25).setAlpha(0.3).setDepth(0.54);
        const cells = Array.from({ length: n }, (_, c) => [S.add.image(c * (m.hdx || 0) * T, 0, 'fx_rt_top').setDisplaySize(T, T), S.add.image(c * (m.hdx || 0) * T, T / 2, 'fx_rt_face').setOrigin(0.5, 0).setDisplaySize(T, T)]);
        const [top, face] = cells[0];
        if (m.end) { top.setTint(0xb8f0b8); face.setTint(0xb8f0b8); }
        const box = S.add.container(x, y, [...cells.map(c => c[1]), ...cells.map(c => c[0])]).setDepth(0.9 + m.y * 1e-4);
        st.tiles[k] = { box, top, face, shadow, rim, cells: n > 1 ? cells : null };
        const pc = st.paint?.[k];   // (marked before it formed: a miss)
        if (pc != null) { st.tiles[k].col = pc; cells.forEach(([tp, fc]) => { tp.setTint(pc); fc.setTint(Phaser.Display.Color.IntegerToColor(pc).darken(40).color); }); }
        if (!snap) return;
        const p = st.R[k - 1];
        box.setPosition(RhythmTrial.endX(p) * T + T / 2, p.y * T + T / 2).setScale(0.6).setAngle((m.dx || m.dy) * 24);
        shadow.setAlpha(0); rim.setAlpha(0);
        S.tweens.add({ targets: [shadow, rim], alpha: { getEnd: (o) => o === shadow ? 0.55 : 0.3 }, duration: C.SNAP_MS });
        S.tweens.add({ targets: box, x, y, scale: 1, angle: 0, duration: C.SNAP_MS, ease: 'Back.easeOut', onComplete: () => {
            S.tweens.add({ targets: box, scale: 1.1, duration: 55, yoyo: true });
            for (let j = 0; j < 5; j++) { const d = S.add.image(x + (Math.random() - 0.5) * T, y + T * 0.7, 'vfx_dot').setTint(j % 2 ? 0xc8b8a0 : 0xffa040).setScale(0.6).setDepth(0.95); S.tweens.add({ targets: d, y: d.y - 4 - Math.random() * 6, x: d.x + (Math.random() - 0.5) * 12, alpha: 0, duration: 320, onComplete: () => d.destroy() }); }
        } });
        Sfx.play(S, 'clink');
    }

    // ── EVERY FRAME ──
    static tick(S) {
        const st = S._rtrial;
        if (!st) return;
        if (st.snd) {   // the song's clock: where it is in the file, as the run's time (paused, it holds; it never drifts off the beat)
            if (!st.played && S.time.now >= st.playAt && !st.done) { st.played = true; st.snd.play({ seek: st.seek }); }   // (the run's clock till then: the paused clock holds it)
            if (S._pauseMenuOpen && st.snd.isPlaying) st.snd.pause(); else if (!S._pauseMenuOpen && st.snd.isPaused) st.snd.resume();
            if (st.snd.isPlaying || st.snd.isPaused) st.drift = st.songT0 + st.snd.seek * 1000 / st.rate - S.time.now;
            const vol = Music.muted() ? 0 : Math.min(1, Music.volume() * 2);   // (M, or the volume, changed mid-run: the song follows)
            if (st.snd.volume !== vol && !st.done) st.snd.setVolume(vol);
        }
        const C = RhythmTrial.C, now = RhythmTrial.now(S), N = st.R.length - 1, dt = S.game.loop.delta || 16, T = S.TILE_SIZE;
        // the beat: a tick (the count-in's louder), the core's light swelling, a ring at your feet
        while (st.tk < st.ticks.length && now >= st.ticks[st.tk]) {
            const b = st.tk++;
            if (st.done) continue;
            if (b < C.COUNT_IN || !st.snd) Sfx.play(S, b < C.COUNT_IN ? 'e_tick' : 'click');   // (over a song, the song keeps the time)
            st.pulse = 1; st.glow.setAlpha(0.22); RhythmTrial.pulseRing(S);
            const fr = S.add.image(S.player.x, S.player.y + T * 0.2, 'vfx_ring').setBlendMode(Phaser.BlendModes.ADD).setTint(0xfff2d8).setScale(0.12, 0.07).setAlpha(0.7).setDepth(0.99);   // and at your feet
            S.tweens.add({ targets: fr, scaleX: 0.5, scaleY: 0.28, alpha: 0, duration: 340, ease: 'Quad.easeOut', onComplete: () => fr.destroy() });
            S.tweens.add({ targets: st.glow, alpha: 0.1, duration: 420 });
            if (b < C.COUNT_IN) RhythmTrial.banner(S, b === C.COUNT_IN - 1 ? 'GO!' : String(C.COUNT_IN - 1 - b), null, b === C.COUNT_IN - 1 ? '#ffe14a' : '#f3e3b8', true);
        }
        while (st.bi < st.breaks.length && now >= st.breaks[st.bi].t0) {
            st.bi++;
            if (!st.done) { RhythmTrial.banner(S, 'BREAK!', `ATTACK THE CORE  ·  x${C.BREAK_MULT} DAMAGE`, '#ffd84a'); Sfx.play(S, 'stinger'); }
        }
        while (st.pi < st.phases.length && now >= st.phases[st.pi].t) {
            const P = st.phases[st.pi++], nm = RhythmTrial.SECTION[P.name];
            if (!st.done) RhythmTrial.banner(S, nm ? nm[0] : `PHASE ${P.ph + 1}`, nm ? nm[1] : st.snd ? 'the rhythm thickens' : `FASTER  ·  ${C.BPM[P.ph]} BPM`, '#ffb84a');
        }
        // each slab forms exactly on its note (and not a frame before)
        if (!st.done) for (let k = 1; k <= N; k++) {
            if (!st.tiles[k] && now >= RhythmTrial.from(st, k) && now < RhythmTrial.until(st, k)) st.R[k].kind === 'quake' ? RhythmTrial.quake(S, k) : RhythmTrial.tile(S, k);
        }
        // slabs past their time crumble at once: a shiver, then away down into the dark
        st.tiles.forEach((t, k) => {
            if (!t || t.gone || now < RhythmTrial.until(st, k) || st.done) return;
            t.gone = true;
            if (t.ghost) return;
            if (t.col == null) { t.top.setTint(0x7a6a78); t.face.setTint(0x5a4a58); }   // (a painted one keeps its colour going down)
            S.tweens.add({ targets: t.box, x: t.box.x + 2, duration: 30, yoyo: true, repeat: 1 });
            S.tweens.add({ targets: [t.shadow, t.rim], alpha: 0, duration: 200, delay: 60 });
            RhythmTrial.tumble(S, t.box, () => { t.shadow.destroy(); t.rim.destroy(); });
        });
        // a hold's cells, crumbling one by one behind the beat (its last goes with the slab)
        st.tiles.forEach((t, k) => {
            if (!t?.cells || t.gone || st.done) return;
            t.cells.forEach(([top, face], c) => {
                if (c === t.cells.length - 1 || top.gone || now < RhythmTrial.cellGone(st, k, c) || (st.carry === k && c === (S.playerX - st.R[k].x) * st.R[k].hdx)) return;   // (not from under you while you hold)
                top.gone = true; if (t.col == null) { top.setTint(0x7a6a78); face.setTint(0x5a4a58); }
                const piece = S.add.container(t.box.x + top.x, t.box.y, []);   // (lifted out of the slab, to fall on its own)
                t.box.remove([top, face]); top.x = 0; face.x = 0; piece.add([face, top]);
                RhythmTrial.tumble(S, piece);
            });
        });
        // where you are: on the next slab (graded by how near its note you made it, or for a quake, how near it you
        // jumped; a little early counts, the slab forms under you), on ground, or over the abyss
        if (st.lane && !st.done && !st.falling) RhythmTrial.loverMove(S, now);   // (the lover's steps and dashes: GameScene moves only you)
        if ((S._glideUntil || 0) > (st.gu || 0)) { st.gu = S._glideUntil; st.liftAt = now; }   // a dash's glide or a hop began: when it was pressed (graded by that)
        if (!st.done && !st.falling) {
            const airborne = (S._glideUntil || 0) > now;
            const ground = k => {
                const t = st.tiles[k], q = st.R[k].kind === 'quake';
                return t ? !t.gone && (!q || now >= st.times[k] + C.MEND) : !q && k >= st.i && now >= st.times[k] - RhythmTrial.early(st, k) && now < RhythmTrial.until(st, k);   // (>=: landed early, it's yours till it forms under you)
            };
            const on = k => { const m = st.R[k], c = (S.playerX - m.x) * (m.hdx || 1); return m.y === S.playerY && ground(k) && (m.hold ? c >= 0 && c <= m.hold && (c === m.hold || now < RhythmTrial.cellGone(st, k, c) || st.carry === k) : c === 0); };   // (a hold's cell under you holds while you do)
            // a hold: while its key's down (held from the landing on), you're carried along at the beat's pace. Let go and you stop;
            // hold it again and you're after the beat three times as fast, and the cell you're on holds while you do: caught up, SAVED
            const h = st.R[st.i], hk = h.hold && S.keys[h.hdx > 0 ? 'D' : 'A'];
            if (h.hold && !airborne && !S._step && S.playerY === h.y) {
                const head = Phaser.Math.Clamp((now - st.times[st.i]) / h.holdMs, 0, 1) * h.hold, hx = (h.x + h.hdx * head) * T + T / 2;
                if (st.carry === st.i && !hk.isDown && head < h.hold * 0.98) { st.carry = null; st.letGo = st.i; RhythmTrial.judge(S, 'LET GO', '#ffb08a'); }
                else if (st.carry !== st.i && st.letGo === st.i && hk.isDown) st.carry = st.i;
                if (st.carry === st.i && (hx - S.player.x) * h.hdx > 0) {
                    S.player.x = st.letGo === st.i ? S.player.x + h.hdx * Math.min(Math.abs(hx - S.player.x), 3 * h.hold * T / h.holdMs * dt) : hx;
                    S.playerX = h.x + h.hdx * Phaser.Math.Clamp(Math.round(((S.player.x - T / 2) / T - h.x) * h.hdx), 0, h.hold);
                }
                if (st.carry === st.i && st.letGo === st.i && head >= h.hold && Math.abs(hx - S.player.x) < 1) { st.letGo = null; st.combo++; RhythmTrial.judge(S, 'SAVED', '#9dffb0'); }
            }
            if (!airborne) for (let k = st.i + 1; k <= N && now >= st.times[k] - RhythmTrial.early(st, k); k++) if (on(k)) {
                const kd = st.R[k].kind, lift = (kd === 'dash' || kd === 'hop') && now - (st.liftAt ?? -1e9) < 900;   // (an ice glide, a hop: you land half a second after you pressed)
                const off = Math.abs((kd === 'quake' ? st.jumpAt ?? -1e9 : lift ? st.liftAt : now) - st.times[k]);
                st.i = k; st.carry = st.R[k].hold && S.keys[st.R[k].hdx > 0 ? 'D' : 'A']?.isDown ? k : null;
                let grade = off <= C.PERFECT ? 'perfect' : off <= C.GOOD ? 'good' : 'bad';
                if (grade === 'bad' && st.R[k].slurEnd != null) grade = 'good';   // (a slur forgives)
                RhythmTrial.hitFx(S, k, grade);
                if (st.R[k].mordent) { st.mord = { k, stage: 1 }; RhythmTrial.light(S, k); }
                if (st.R[k].trill) RhythmTrial.trillStart(S, k);
                if (st.R[k].kind !== 'quake') { st.landAt = now; st.landK = k; st.landDone = false; RhythmTrial.strike(S, 'land'); }
                if (st.R[k].end) RhythmTrial.finish(S, st.coreDead ? 'CLEARED!' : 'THE CORE SURVIVED', st.coreDead);
                break;
            }
            if (!airborne && !st.done && !st.R.some((m, k) => on(k))) RhythmTrial.fall(S);
            // a mordent under way: back onto the slab before it, then onto it again; the next slab forming first ends it
            const md = st.mord, at = j => S.playerX === st.R[j].x && S.playerY === st.R[j].y;
            if (md && !md.done && !st.falling && !st.done) {
                if (md.stage === 1 && at(md.k - 1) && !airborne) { md.stage = 2; RhythmTrial.light(S, md.k - 1); if (!st.snd) Sfx.play(S, 'rt_hit', { n: 2 }); }
                else if (md.stage === 2 && at(md.k) && !airborne) { md.done = true; RhythmTrial.mordentDone(S, md.k); }
                if (!md.done && (md.k >= N || now >= st.times[md.k + 1] + C.GOOD)) md.done = true;   // let go by: nothing lost (an extra, not a must)
            }
            // a trill under way: each hop between its slab and the one before counts; done on its own slab, or out of time
            const tr = st.trill;
            if (tr && !tr.done && !st.falling && !st.done) {
                const here = at(tr.k) ? tr.k : at(tr.k - 1) ? tr.k - 1 : null;
                if (here != null && here !== tr.on && !airborne) { tr.on = here; tr.n++; RhythmTrial.light(S, here); if (!st.snd) Sfx.play(S, 'rt_hit', { n: tr.n % 10 }); }
                if (tr.n >= C.TRILL_N && tr.on === tr.k) RhythmTrial.trillEnd(S, true);
                else if (now >= tr.until) RhythmTrial.trillEnd(S, false);
            }
            // a landing nobody struck: an accent's chance gone
            if (!st.landDone && st.landK != null && now - st.landAt > C.ACCENT_WIN) { st.landDone = true; if (st.R[st.landK].accent) RhythmTrial.accentMiss(S); }
        }
        // the glissando: shown, counted in, slid on the beat, then cleared away
        while (st.gi < st.glisses.length && now >= st.glisses[st.gi].t) RhythmTrial.glissStart(S, st.glisses[st.gi++]);
        const gl = st.gl;
        if (gl) {
            if (!gl.done) {
                if (gl.c < 3 && now >= gl.slide - (3 - gl.c) * gl.g.beat) { RhythmTrial.banner(S, String(3 - gl.c), null, '#7fe8ff', true); gl.caps.forEach(c => S.tweens.add({ targets: c.img, scale: c.img.scale * 1.08, duration: 70, yoyo: true })); gl.c++; }
                if (!gl.said && now >= gl.slide) { gl.said = true; RhythmTrial.banner(S, 'SLIDE!', null, '#7fe8ff', true); }
                if (now > gl.slide + C.GLISS.WIN[1]) RhythmTrial.glissEnd(S, 'miss');
            }
            else if (now >= gl.end) RhythmTrial.glissClean(S);
        }
        // the core floating (in a break, it blazes: hit it now); its death called out once
        if (st.lane) return RhythmTrial.hud(S, now, dt);   // (the lover: its own cues; the core, the camera are yours)
        const core = st.core, brk = RhythmTrial.inBreak(st, now);
        if (core?.sprite?.active) {
            core._floatY ??= core.sprite.y; core.sprite.y = core._floatY - 6 + Math.sin(now / 500) * 5;
            st.coreGlow.setPosition(core.sprite.x, core.sprite.y).setScale(brk ? 1.15 + 0.15 * Math.sin(now / 80) : 0.8).setAlpha(brk ? 0.8 : 0.5);
        }
        if (!st.coreDead && (!core?.sprite?.active || core.health <= 0)) { st.coreDead = true; st.coreGlow?.setVisible(false); RhythmTrial.say(S, 'CORE SHATTERED!', '#ffd84a'); S.cameras.main.shake(200, 0.006); }
        // the camera: a kick on each note landed, and leaning a third of the way toward the core
        const cam = S.cameras.main, A = S._trainArena;
        st.kick = Math.max(0, st.kick - dt / 160);
        if (now >= st.zoomAt) cam.setZoom(st.zBase * (1 + 0.016 * st.kick));
        const lv = st.lover?.S2.player;   // (two of you: the camera between you)
        if (lv) cam.setFollowOffset((S.player.x - lv.x) / 2, (S.player.y - lv.y) / 2);
        else cam.setFollowOffset((S.player.x - (A.cx * T + T / 2)) * 0.33, (S.player.y - (A.cy * T + T / 2)) * 0.33);
        RhythmTrial.hud(S, now, dt);
    }

    // ── QUAKES AND JUMPING ──
    // a quake: the slab you're on tears into pieces that fly apart on the note, then fly back and lock together at MEND
    // (the same slab, now note k's); the ground shakes
    static quake(S, k) {
        const st = S._rtrial, C = RhythmTrial.C, T = S.TILE_SIZE, old = st.tiles[k - 1];
        if (!old?.box?.active || old.gone) return RhythmTrial.tile(S, k, false);
        st.tiles[k] = old; st.tiles[k - 1] = { ghost: true };
        const { box } = old, x = box.x, y = box.y;
        box.setVisible(false);
        const bits = [0, 1, 2, 3].map(q => S.add.image(x, y, 'fx_rt_top').setDisplaySize(T, T).setCrop((q % 2) * 8, (q >> 1) * 8, 8, 8).setDepth(box.depth));
        bits.push(...[0, 1].map(q => S.add.image(x, y + T / 2, 'fx_rt_face').setOrigin(0.5, 0).setDisplaySize(T, T).setCrop(q * 8, 0, 8, 7).setDepth(box.depth - 1e-5)));
        bits.forEach((b, j) => {
            const sx = j < 4 ? (j % 2 ? 1 : -1) : (j === 4 ? -1 : 1), sy = j < 4 ? ((j >> 1) ? 1 : -1) : 1.3;
            S.tweens.add({ targets: b, x: b.x + sx * T * (0.45 + Math.random() * 0.35), y: b.y + sy * T * (0.35 + Math.random() * 0.3), angle: (Math.random() - 0.5) * 70, duration: 110, ease: 'Quad.easeOut' });
            S.tweens.add({ targets: b, x: b.x, y: b.y, angle: 0, duration: 150, delay: C.MEND - 150, ease: 'Quad.easeIn', onComplete: () => b.destroy() });
        });
        for (let j = 0; j < 8; j++) {   // rubble and dust thrown up
            const a = Math.random() * Math.PI * 2, d = S.add.image(x, y + T * 0.3, 'vfx_dot').setTint(j % 3 ? 0x9a8aa8 : 0xff8a30).setScale(0.8).setDepth(0.96);
            S.tweens.add({ targets: d, x: x + Math.cos(a) * T * 0.9, y: y - Math.random() * T * 0.8, alpha: 0, duration: 420, ease: 'Quad.easeOut', onComplete: () => d.destroy() });
        }
        S.time.delayedCall(C.MEND, () => {
            if (!box.active || S._rtrial !== st) return;
            box.setVisible(true);
            S.tweens.add({ targets: box, scale: 1.12, duration: 60, yoyo: true });
            Sfx.play(S, 'clink');
        });
        S.cameras.main.shake(220, 0.009);
        Sfx.play(S, 'quake');
    }
    // Space: a jump straight up, in the air JUMP_MS (no steps until you land; the abyss can't have you while you're up)
    static jump(S) {
        const st = S._rtrial, C = RhythmTrial.C, now = RhythmTrial.now(S), T = S.TILE_SIZE;
        if (!st || st.done || st.falling || (S._glideUntil || 0) > now) return;
        st.jumpAt = now; S._glideUntil = now + C.JUMP_MS; S._step = null;
        const base = () => S.playerY * T + T / 2 + (S.SLIME_Y_OFFSET || 0), o = { h: 0 }, [kx, ky] = st.pScale;
        const sh = S.add.image(S.player.x, base() + T * 0.3, 'vfx_shadow').setScale(T / 64 * 0.8, T / 64 * 0.3).setAlpha(0.6).setDepth(0.97);
        st.objs.push(sh);
        S.tweens.killTweensOf(S.player);
        S.player.setScale(kx * 1.15, ky * 0.8);
        S.tweens.add({ targets: S.player, scaleX: kx * 0.9, scaleY: ky * 1.15, duration: 120 });
        S.tweens.add({ targets: o, h: T * 0.95, duration: C.JUMP_MS / 2, yoyo: true, ease: 'Quad.easeOut',
            onUpdate: () => { if (S.player.active) S.player.y = base() - o.h; sh.setScale(T / 64 * (0.8 - o.h / T * 0.35), T / 64 * 0.3).setAlpha(0.6 - o.h / T * 0.3); },
            onComplete: () => {
                sh.destroy();
                if (!S.player.active) return;
                S.player.y = base(); S.player.setScale(kx * 1.2, ky * 0.78);
                S.tweens.add({ targets: S.player, scaleX: kx, scaleY: ky, duration: 140, ease: 'Back.easeOut' });
            } });
        Sfx.play(S, 'jump');
    }

    // ── MORDENTS ──
    // a slab lit gold (a mordent's steps, as you make them)
    static light(S, k) {
        const st = S._rtrial, t = st.tiles[k], T = S.TILE_SIZE, m = st.R[k];
        if (t?.top?.active) { t.top.setTint(0xffd84a); t.face.setTint(0xd8a83a); }
        const r = S.add.image(m.x * T + T / 2, m.y * T + T / 2, 'vfx_ring').setBlendMode(Phaser.BlendModes.ADD).setTint(0xffd84a).setScale(0.2).setAlpha(0.9).setDepth(0.99);
        S.tweens.add({ targets: r, scale: 0.8, alpha: 0, duration: 300, ease: 'Quad.easeOut', onComplete: () => r.destroy() });
    }
    static mordentDone(S, k) {
        const st = S._rtrial;
        for (const j of [k - 1, k]) { const t = st.tiles[j]; if (t?.top?.active) { t.top.setTintFill(0xffffff); S.time.delayedCall(90, () => { if (t.top.active && !t.gone) { t.top.clearTint(); t.top.setTint(0xffd84a); } }); } RhythmTrial.light(S, j); }
        [0, 70, 140].forEach((d, i) => S.time.delayedCall(d, () => Sfx.play(S, 'rt_hit', { n: 5 + i * 2, perfect: true })));
        st.combo++; st.best = Math.max(st.best || 0, st.combo); st.kick = 1;
        RhythmTrial.judge(S, 'MORDENT!', '#ffd84a');
        RhythmTrial.hurtCore(S, RhythmTrial.C.MORDENT_HIT);
    }
    // a life lost where you stand (a trill left unfinished)
    static penalty(S, text) {
        const st = S._rtrial;
        st.lives--; st.combo = 0; st.streak = 0; st.shake = 1; st.flash = 1; st.misses = (st.misses || 0) + 1;
        RhythmTrial.paint(S, st.i, RhythmTrial.MISS_COL); RhythmTrial.noteLost(S, st.i);
        Sfx.play(S, 'deny'); S.cameras.main.shake(160, 0.006);
        RhythmTrial.judge(S, 'MISS', '#ff5a5a');
        RhythmTrial.say(S, st.lives > 0 && st.lives < Infinity ? `${text}  ·  ${st.lives} LEFT` : text, '#ff7a5a');
        if (st.lives <= 0) RhythmTrial.finish(S, 'OUT OF LIVES', false);
    }

    // ── YOUR LOVER (Impossible: two of you) ──
    // The lover has a world of its own: the arena's right half (yours the left: the two never cross, a tile between at the nearest),
    // its own route (route, lane 1) on the song's hats and lead (you the drums), played at the same time as yours but in the quiet
    // sections, where you take turns. Its dashes come with yours (the same element) or well clear of them, its jumps with yours:
    // Shift and Space are both of yours.
    // the lover's run: its own view of the scene (Object.create: its own slime, place, keys and run; the rest the scene's), its
    // own slabs and cues; lives, the combo, the clock shared with yours
    static loverBegin(S, st, song) {
        const C = RhythmTrial.C, T = S.TILE_SIZE, A = S._trainArena, off = S.SLIME_Y_OFFSET || 0;
        const R2 = RhythmTrial.route(A, { lane: 1, other: st.R }).R, S2 = Object.create(S);
        const st2 = { R: R2, t0: st.t0, times: R2.map(m => song + m.t), ticks: [], tk: 0, phases: [], pi: 0, breaks: [], bi: 0, glisses: [], gi: 0,
            clickAt: -1e9, landAt: -1e9, landK: null, landDone: true, told: st.told, i: 0, objs: [], tiles: [], graceI: -1, falling: false, pulse: 0, shake: 0, flash: 0,
            lane: 1, main: S, core: st.core, track: st.track, pScale: st.pScale, mc0: S.moveCooldown, rate: st.rate };
        for (const k of ['lives', 'combo', 'streak', 'best', 'misses', 'kick', 'done', 'coreDead', 'drift']) Object.defineProperty(st2, k, { get: () => st[k], set: v => { st[k] = v; } });
        const dk = LevelManager.slimeRecolor(S, 'slime_decoy', [[60, 14, 40], [150, 50, 100], [230, 110, 170], [255, 170, 210], [255, 230, 242]]);   // (pink: the decoy's)
        const m0 = R2[0], spr = S.add.sprite(m0.x * T + T / 2, m0.y * T + T / 2 + off, dk || S.player.texture.key, 0).setScale(...st.pScale).setDepth(S.player.depth).setFlipX(true);
        if (dk && S.anims.exists(dk + '_idle')) spr.play(dk + '_idle');
        if (typeof CreatureFX !== 'undefined') CreatureFX.face(S, spr, { mood: 'friend' });   // (its eyes, like the decoy's)
        const heart = S.add.text(0, 0, '♥', { fontSize: '12px', color: '#ff7ab8', stroke: '#3a0a1e', strokeThickness: 3 }).setOrigin(0.5).setDepth(S.player.depth + 0.01);
        st2.objs.push(spr, heart); st2.heart = heart;
        const cur = S.input.keyboard.createCursorKeys();
        Object.assign(S2, { _rtrial: st2, player: spr, playerX: m0.x, playerY: m0.y, _step: null, _glideUntil: 0, keys: { W: cur.up, S: cur.down, A: cur.left, D: cur.right } });
        st.lover = { S2, st2 };
        RhythmTrial.tile(S2, 0, false);
        RhythmTrial.eatKeys(S2);
        RhythmTrial.hudBuild(S2);
        for (const o of [st2.livesTxt, st2.raceTxt, st2.comboTxt, st2.comboLbl, st2.grooveTxt, st2.missTxt, st2.queueLbl]) o?.setVisible(false);
        st2.tick = () => RhythmTrial.tick(S2); S.events.on('update', st2.tick);
        st2.ghost = () => { if (!st2.falling) [spr, spr._cfx?.eyes].forEach(o => o?.active && o.setAlpha(C.GHOST)); }; S.events.on('postupdate', st2.ghost);
        st2.onJump = () => { if (S2._rtrial) RhythmTrial.jump(S2); }; S.input.keyboard.on('keydown-' + Settings.key('dash'), st2.onJump);
    }
    // the lover's moves: a step per fresh arrow press (quick as yours; a press during one kept till it's done), and Shift, when its own
    // dash is due, sends it over the gap: the element you're on decides how far (the wrong one falls short or long)
    static loverMove(S, now) {
        const st = S._rtrial, C = RhythmTrial.C, airborne = (S._glideUntil || 0) > now, U = (S._rtUsed ||= {});
        st.heart?.setPosition(S.player.x, S.player.y - S.TILE_SIZE * 0.85 + Math.sin(now / 200) * 1.5);
        let pick = null;
        for (const [n, kx, ky] of [['W', 0, -1], ['S', 0, 1], ['A', -1, 0], ['D', 1, 0]]) { const k = S.keys[n]; if (k.timeDown && k.timeDown !== U[n] && (!pick || k.timeDown > S.keys[pick[0]].timeDown)) pick = [n, kx, ky]; }
        if (pick && !airborne && !S._step && S.time.now - (st.stepAt || 0) >= C.STEP_MS) {
            U[pick[0]] = S.keys[pick[0]].timeDown; st.stepAt = S.time.now;
            RhythmTrial.loverGo(S, S.playerX + pick[1], S.playerY + pick[2], Math.min(130, C.STEP_MS + 20));
        }
        const sh = !!S.shiftKey?.isDown;
        if (sh && !st.shiftWas && !airborne && RhythmTrial.aimTile(S)) RhythmTrial.loverDash(S, st.i + 1, now);
        st.shiftWas = sh;
    }
    static loverGo(S, x, y, ms, ease = 'Sine.easeOut') {
        const T = S.TILE_SIZE, off = S.SLIME_Y_OFFSET || 0;
        S.playerX = x; S.playerY = y; S._step = true;
        S.tweens.add({ targets: S.player, x: x * T + T / 2, y: y * T + T / 2 + off, duration: ms, ease, onComplete: () => { S._step = null; } });
    }
    static loverDash(S, k, now) {
        const st = S._rtrial, C = RhythmTrial.C, T = S.TILE_SIZE, m = st.R[k], el = S.currentElement, off = S.SLIME_Y_OFFSET || 0;
        let tx = m.x, ty = m.y;
        if (m.kind === 'hop' ? el !== 'cosmic' : el !== m.el) {   // the wrong element: its own reach, the right way
            const dx = Math.sign(m.x - S.playerX), dy = Math.sign(m.y - S.playerY), n = C.DASH[el] || 3;
            tx = S.playerX + (dx ? dx * n : 0); ty = S.playerY + (dx ? 0 : dy * n);
        }
        const ms = m.kind === 'hop' ? 420 : Math.max(120, C.LAND[el] || 0);
        S._glideUntil = now + ms;
        Sfx.play(S, 'dash', { el });
        if (m.kind === 'hop' && el === 'cosmic') {   // (the hop: two jumps, out wide to its turn and in)
            const v = RhythmTrial.hopVia(S, k) || { x: tx, y: ty };
            S.playerX = tx; S.playerY = ty; S._step = true;
            S.tweens.chain({ targets: S.player, tweens: [{ x: v.x * T + T / 2, y: v.y * T + T / 2 + off, duration: ms / 2, ease: 'Quad.easeOut' }, { x: tx * T + T / 2, y: ty * T + T / 2 + off, duration: ms / 2, ease: 'Quad.easeIn' }], onComplete: () => { S._step = null; } });
        }
        else RhythmTrial.loverGo(S, tx, ty, ms, 'Cubic.easeOut');
    }

    // ── DASHING ──
    // the next note, if it's a dash or a hop: where it lands (the dash and the hop go there themselves: no aiming)
    // (`first`: a hop's first jump, which goes for its turn, hopVia)
    static aimTile(S, first = false) {
        const st = S._rtrial, m = st && !st.done && st.R[st.i + 1];
        if (!m || (m.kind !== 'dash' && m.kind !== 'hop')) return null;
        if (RhythmTrial.C.DUAL && st.times[st.i + 1] - RhythmTrial.now(S) > Math.max(RhythmTrial.C.EARLY, m.beat)) return null;   // (one Shift for two: only a dash that's due)
        return (first && m.kind === 'hop' && RhythmTrial.hopVia(S, st.i + 1)) || { x: m.x, y: m.y };
    }
    // a hop's turn: the cell its first jump lands on, as far off the straight way as both jumps reach (each its longest), bowed
    // out away from the core (back the other way if that's walled)
    static hopVia(S, k) {
        const st = S._rtrial, vias = (st.vias ||= {});
        if (k in vias) return vias[k];
        const m = st.R[k], p = st.R[k - 1], ax = RhythmTrial.endX(p), ay = p.y, R = (S.cosmicDashDistance || 3) + 0.5, A = S._trainArena;
        const L = Math.hypot(m.x - ax, m.y - ay) || 1, nx = -(m.y - ay) / L, ny = (m.x - ax) / L, cx = (ax + m.x) / 2, cy = (ay + m.y) / 2;
        const out = Math.sign((cx - A.cx) * nx + (cy - A.cy) * ny) || 1;
        let best = null, bs = -Infinity;
        for (let x = Math.floor(cx) - 5; x <= Math.ceil(cx) + 5; x++) for (let y = Math.floor(cy) - 5; y <= Math.ceil(cy) + 5; y++) {
            if (Math.hypot(x - ax, y - ay) > R || Math.hypot(m.x - x, m.y - y) > R || !S._dashCanEnter(x, y)) continue;
            const off = ((x - cx) * nx + (y - cy) * ny) * out, sc = off >= 0 ? off : off - 100;   // (the other side only when this one's shut)
            if (sc > bs) { bs = sc; best = { x, y }; }
        }
        return (vias[k] = best);
    }
    static aim(S) {
        const t = RhythmTrial.aimTile(S);
        if (!t) return null;
        const dx = t.x - S.playerX, dy = t.y - S.playerY;
        return Math.abs(dx) >= Math.abs(dy) ? [Math.sign(dx), 0] : [0, Math.sign(dy)];
    }

    // ── ACCENTS ──
    // a click and a landing within ACCENT_WIN of each other, whichever came first: on an accent, the strike
    static strike(S, src) {
        const st = S._rtrial, C = RhythmTrial.C, now = RhythmTrial.now(S);
        if (!st) return;
        if (src === 'click') st.clickAt = now;
        const nx = st.landK != null && st.R[st.landK + 1];   // (clicked a little early for the accent just ahead: it's that one's, not this slab's)
        if (src === 'click' && !st.R[st.landK]?.accent && nx?.accent && st.times[st.landK + 1] - now <= C.ACCENT_WIN) return;
        if (st.landDone || st.landK == null || st.done || st.falling || Math.abs(st.clickAt - st.landAt) > C.ACCENT_WIN) return;
        st.landDone = true; st.clickAt = -1e9;   // (a click strikes once: an accent's then broke a semiquaver landed right after it)
        if (st.R[st.landK].accent) RhythmTrial.accentHit(S, st.landK);   // (struck anywhere else: nothing, it's an extra)
    }
    static accentHit(S, k) {
        const st = S._rtrial, C = RhythmTrial.C, core = st.core, T = S.TILE_SIZE;
        st.combo++; st.best = Math.max(st.best || 0, st.combo); st.kick = 1.4;
        RhythmTrial.judge(S, 'ACCENT!', '#ff7a4a');
        Sfx.play(S, 'boom'); Sfx.play(S, 'rt_hit', { n: 9, perfect: true });
        if (!core?.sprite?.active) return;
        const g = S.add.graphics().setDepth(RhythmTrial.DEPTH + 0.3), x0 = S.player.x, y0 = S.player.y, x1 = core.sprite.x, y1 = core.sprite.y;   // a bolt to the core
        const o = { a: 1 };
        S.tweens.add({ targets: o, a: 0, duration: 260, onUpdate: () => { g.clear(); g.lineStyle(5, 0xff7a4a, 0.35 * o.a).lineBetween(x0, y0, x1, y1); g.lineStyle(2, 0xffe0c0, o.a); RhythmTrial.crack(g, x0, y0, x1, y1, k * 7.7, 6); }, onComplete: () => g.destroy() });
        const r = S.add.image(x1, y1, 'vfx_ring').setBlendMode(Phaser.BlendModes.ADD).setTint(0xff7a4a).setScale(0.3).setDepth(RhythmTrial.DEPTH + 0.3);
        S.tweens.add({ targets: r, scale: 2.2, alpha: 0, duration: 380, ease: 'Quad.easeOut', onComplete: () => r.destroy() });
        S.cameras.main.shake(140, 0.005);
        RhythmTrial.hurtCore(S, C.ACCENT);
    }
    static accentMiss(S) { RhythmTrial.judge(S, 'NO STRIKE', '#a89ab8'); }   // (let go by: the combo stands)
    // A hit on the core from your playing: `n` PERFECT notes' worth, times the groove, with no roll and none of your stats in
    // it: how well you play is all that counts
    static hurtCore(S, n) {
        const st = S._rtrial, main = st?.main || S, core = st?.core;
        if (!core?.sprite?.active || core.health <= 0 || !main._rtrial || !(n > 0)) return;
        core.health -= core.maxHealth * n * main._rtrial.unit * RhythmTrial.groove(main);
        main.updateEnemyHealthBar?.(core);
        if (core.health <= 0) main.killEnemy(core);
    }

    // ── TRILLS ──
    static trillStart(S, k) {
        const st = S._rtrial, C = RhythmTrial.C, W = S.scale.width;
        st.trill = { k, on: k, n: 0, until: RhythmTrial.now(S) + C.TRILL_MS, done: false };
        S.moveCooldown = C.TRILL_STEP;   // the quickened step (back to STEP_MS when it's over)
        RhythmTrial.light(S, k);
        st.trillTxt ||= (() => { const o = S.add.text(W / 2, 0, '', { fontSize: '18px', fontFamily: UIKit.FONT.title, fontStyle: 'bold', color: '#c8a0ff', stroke: '#07060a', strokeThickness: 6 }).setOrigin(0.5).setScrollFactor(0).setDepth(48); st.objs.push(o); return o; })();
        st.trillTxt.setVisible(true);
        // the trill's own slab, the one to finish on, marked: its sign over it and a ring at its foot (the one you hop back to isn't)
        const T = S.TILE_SIZE, m = st.R[k], D = RhythmTrial.DEPTH;
        st.trillMark ||= (() => { const o = S.add.image(0, 0, 'fx_rt_trill').setTint(0xc8a0ff).setDepth(D + 0.33); st.objs.push(o); return o; })();
        st.trillRing ||= (() => { const o = S.add.image(0, 0, 'vfx_ring').setBlendMode(Phaser.BlendModes.ADD).setTint(0xc8a0ff).setDepth(D + 0.06); st.objs.push(o); return o; })();
        st.trillMark.setPosition(m.x * T + T / 2, m.y * T + T / 2 - T * 0.85).setDisplaySize(T * 0.75, T * 0.75).setVisible(true);
        st.trillRing.setPosition(m.x * T + T / 2, m.y * T + T / 2).setVisible(true);
    }
    static trillEnd(S, ok) {
        const st = S._rtrial, tr = st.trill;
        tr.done = true; S.moveCooldown = RhythmTrial.C.STEP_MS; st.trillTxt?.setVisible(false);
        st.trillMark?.setVisible(false); st.trillRing?.setVisible(false);
        const pj = tr.k - 1;   // the slab you hopped back onto goes now, so only the trill's own is left to go on from
        if (S.playerX !== st.R[pj].x || S.playerY !== st.R[pj].y) (st.cut ||= {})[pj] = RhythmTrial.now(S);
        if (!ok) return RhythmTrial.penalty(S, 'TRILL UNFINISHED');
        for (const j of [tr.k - 1, tr.k]) { const t = st.tiles[j]; if (t?.top?.active) t.top.setTint(0xd8b8ff); RhythmTrial.light(S, j); }
        [0, 60, 120, 180].forEach((d, i) => S.time.delayedCall(d, () => Sfx.play(S, 'rt_hit', { n: 4 + i * 2, perfect: true })));
        st.combo += 2; st.best = Math.max(st.best || 0, st.combo); st.kick = 1.2;
        RhythmTrial.judge(S, 'TRILL!', '#c8a0ff');
        RhythmTrial.hurtCore(S, RhythmTrial.C.TRILL_N);   // (a note's worth a hop)
    }

    // ── GLISSANDO ──
    // the rows to slide: physical keys (KeyboardEvent.code, so any layout slides the same row), and their QWERTY faces
    static GLISS_ROWS = [[['KeyT', 'T'], ['KeyY', 'Y'], ['KeyU', 'U'], ['KeyI', 'I'], ['KeyO', 'O'], ['KeyP', 'P']],
        [['KeyF', 'F'], ['KeyG', 'G'], ['KeyH', 'H'], ['KeyJ', 'J'], ['KeyK', 'K'], ['KeyL', 'L']],
        [['KeyV', 'V'], ['KeyB', 'B'], ['KeyN', 'N'], ['KeyM', 'M'], ['Comma', ',']]];
    static glissStart(S, g) {
        const st = S._rtrial, C = RhythmTrial.C, W = S.scale.width, H = S.scale.height, keys = RhythmTrial.GLISS_ROWS[g.row], n = keys.length, kw = 54;
        const x0 = W / 2 - (n - 1) * kw / 2, y = H * 0.68, pin = o => { st.objs.push(o); return o.setScrollFactor(0).setDepth(60); };
        const caps = keys.map(([code, label], i) => ({ code,
            img: pin(S.add.image(x0 + i * kw, y, 'fx_rt_key').setDisplaySize(48, 48)),
            txt: pin(S.add.text(x0 + i * kw, y - 4, label, { fontSize: '20px', fontFamily: UIKit.FONT.title, fontStyle: 'bold', color: '#2a2030' }).setOrigin(0.5)) }));
        const arrow = pin(S.add.image(W / 2, y + 44, 'fx_rt_arrow').setDisplaySize(56, 56).setTint(0x7fe8ff));   // which way to slide (at its own size: stretched, it broke up)
        st.gl = { g, caps, arrow, hit: new Map(), c: 0, done: false, said: false, slide: g.t + C.GLISS.SLIDE * g.beat, end: g.t + (C.GLISS.BEATS - 0.5) * g.beat };
        S.input.keyboard.resetKeys(); S.input.keyboard.enabled = false;   // the game's own keys stand down (some of these switch elements, throw gadgets...)
        st.glKey = e => RhythmTrial.glissKey(S, e);
        window.addEventListener('keydown', st.glKey);
        RhythmTrial.banner(S, 'GLISSANDO', `get ready: slide ${keys[0][1]} → ${keys[n - 1][1]} on the beat`, '#7fe8ff');
        Sfx.play(S, 'stinger');
        // you fall: off your slab, back and down into the dark (only to look at: you're still on it), and a flight of blocks, a key
        // each, rises from there up to it: each key slid takes you a step up (glissKey), the last back onto your slab (glissEnd)
        const T = S.TILE_SIZE, off = S.SLIME_Y_OFFSET || 0, sx = S.playerX * T + T / 2, sy = S.playerY * T + T / 2 + off, d = st.R[st.i + 1]?.dx || 1, fx = sx - d * T * 1.8, fy = sy + T * 2.6;
        st.gl.home = [sx, sy];
        // the flight of steps: glowing ice-blue slabs, each its key's letter on it, popping up one after another with a sparkle
        st.gl.steps = Array.from({ length: n }, (_, i) => {
            const f = (i + 1) / (n + 1), x = fx + (sx - fx) * f, y = fy + (sy - fy) * f;
            const glow = S.add.image(0, T * 0.2, 'vfx_glow').setBlendMode(Phaser.BlendModes.ADD).setTint(0x7fe8ff).setScale(0.32, 0.18).setAlpha(0.25);
            const top = S.add.image(0, 0, 'fx_rt_top').setDisplaySize(T * 0.62, T * 0.62).setTint(0xd8fbff), face = S.add.image(0, T * 0.31, 'fx_rt_face').setOrigin(0.5, 0).setDisplaySize(T * 0.62, T * 0.62).setTint(0x8fcfe8);
            const key = S.add.text(0, -T * 0.05, keys[i][1], { fontSize: '9px', fontFamily: UIKit.FONT.title, fontStyle: 'bold', color: '#1a3a4a' }).setOrigin(0.5);
            const b = S.add.container(x, y - off + T * 0.9, [glow, face, top, key]).setDepth(0.9 + (y / T) * 1e-4).setAlpha(0);
            st.objs.push(b);
            S.tweens.add({ targets: b, y: y - off, alpha: 1, duration: 320, delay: 380 + i * 90, ease: 'Back.easeOut', onComplete: () => {
                for (let j = 0; j < 4; j++) { const a = Math.random() * Math.PI * 2, d = S.add.image(x, y - off, 'vfx_dot').setBlendMode(Phaser.BlendModes.ADD).setTint(j % 2 ? 0x7fe8ff : 0xffffff).setScale(0.5).setDepth(1.2); S.tweens.add({ targets: d, x: x + Math.cos(a) * T * 0.5, y: y - off + Math.sin(a) * T * 0.35, alpha: 0, scale: 0.1, duration: 320, onComplete: () => d.destroy() }); }
            } });
            return { b, top, glow, x, y };
        });
        S.tweens.killTweensOf(S.player);
        S.tweens.add({ targets: S.player, x: fx, y: fy, duration: 520, ease: 'Quad.easeIn' });
        Sfx.play(S, 'whoosh');
    }
    // A finger dragged along a row presses its keys nearly together, now and then two a hair out of order: so every key of the
    // row, in any order, within SPAN ms of each other, anywhere in the window. Presses before it are let go (never a miss).
    static glissKey(S, e) {
        const st = S._rtrial, gl = st?.gl, C = RhythmTrial.C;
        if (!gl || gl.done || e.repeat) return;
        const now = RhythmTrial.now(S), cap = gl.caps.find(c => c.code === e.code);
        if (!cap || now < gl.slide - C.GLISS.WIN[0]) return;
        for (const [code, t] of gl.hit) if (now - t > C.GLISS.SPAN) { gl.hit.delete(code); gl.caps.find(c => c.code === code)?.img.clearTint(); }   // too long ago to be this slide
        if (gl.hit.has(e.code)) return;
        gl.hit.set(e.code, now);
        cap.img.setTint(0x7fe8ff);
        const step = gl.steps?.[gl.hit.size - 1];   // (a step up the flight: lit, you on it, an afterimage behind, its note off into the core)
        if (step) {
            const ghost = S.add.image(S.player.x, S.player.y, S.player.texture.key, S.player.frame.name).setScale(S.player.scaleX, S.player.scaleY).setTintFill(0x7fe8ff).setAlpha(0.5).setBlendMode(Phaser.BlendModes.ADD).setDepth(S.player.depth - 0.01);
            S.tweens.add({ targets: ghost, alpha: 0, duration: 260, onComplete: () => ghost.destroy() });
            S.tweens.killTweensOf(S.player); S.tweens.add({ targets: S.player, x: step.x, y: step.y, duration: 80, ease: 'Sine.easeOut' });
            step.top.setTint(0x7fe8ff); step.glow.setAlpha(0.5).setScale(0.38, 0.22);   // (lit, not blown out: the bloom doubles every glow)
            RhythmTrial.noteFly(S, step.x, step.y - (S.SLIME_Y_OFFSET || 0), 2, false);
        }
        S.tweens.add({ targets: [cap.img, cap.txt], y: '+=4', duration: 60, yoyo: true });
        Sfx.play(S, 'rt_hit', { n: gl.hit.size * 2, perfect: true });   // a run of notes up the slide
        if (gl.hit.size >= gl.caps.length) {
            const ts = [...gl.hit.values()], first = Math.min(...ts), span = Math.max(...ts) - first;
            RhythmTrial.glissEnd(S, Math.abs(first - gl.slide) <= C.GLISS.PERFECT[0] && span <= C.GLISS.PERFECT[1] ? 'perfect' : 'good');
        }
    }
    static glissEnd(S, grade) {
        const st = S._rtrial, gl = st.gl, C = RhythmTrial.C;
        if (!gl || gl.done) return;
        gl.done = true;
        // back onto your slab (a hop off the top step, or sprung up from the dark on a miss), the flight falling away behind you
        if (gl.home) {
            S.tweens.killTweensOf(S.player); S.tweens.add({ targets: S.player, x: gl.home[0], y: gl.home[1], duration: grade === 'miss' ? 360 : 160, ease: 'Back.easeOut' });
            if (grade !== 'miss') {   // (home: a burst of the slide's ice-blue where you land)
                const r = S.add.image(gl.home[0], gl.home[1], 'vfx_ring').setBlendMode(Phaser.BlendModes.ADD).setTint(0x7fe8ff).setScale(0.3).setAlpha(0.9).setDepth(1.2);
                S.tweens.add({ targets: r, scale: grade === 'perfect' ? 2 : 1.4, alpha: 0, duration: 420, delay: 140, ease: 'Quad.easeOut', onComplete: () => r.destroy() });
            }
        }
        (gl.steps || []).forEach((st8, i) => { if (grade === 'miss') st8.top.setTint(0xff6a6a); S.time.delayedCall(160 + i * 55, () => { if (st8.b.active) RhythmTrial.tumble(S, st8.b); }); });
        if (grade === 'miss') {
            gl.caps.forEach(c => c.img.setTint(0xff6a6a));
            st.combo = 0;
            RhythmTrial.judge(S, 'MISSED', '#ff8a8a');
            return;
        }
        gl.caps.forEach((c, i) => S.time.delayedCall(i * 30, () => { if (c.img.active) { c.img.setTint(0xffe14a); S.tweens.add({ targets: c.img, scale: c.img.scale * 1.15, duration: 90, yoyo: true }); } }));
        st.combo += 3; st.best = Math.max(st.best || 0, st.combo); st.kick = 1.6;
        RhythmTrial.banner(S, grade === 'perfect' ? 'GLISSANDO!' : 'GLISSANDO', grade === 'perfect' ? 'perfect slide' : null, '#7fe8ff', true);
        Sfx.play(S, 'fanfare'); S.cameras.main.shake(160, 0.006);
        RhythmTrial.hurtCore(S, C.GLISS.DMG[grade === 'perfect' ? 0 : 1]);
    }
    static glissClean(S) {
        const st = S._rtrial, gl = st?.gl;
        if (!gl) return;
        window.removeEventListener('keydown', st.glKey);
        S.input.keyboard.enabled = true; S.input.keyboard.resetKeys();   // (nothing held across it stays stuck down)
        for (const o of [gl.arrow, ...gl.caps.flatMap(c => [c.img, c.txt])]) if (o?.active) { S.tweens.killTweensOf(o); o.destroy(); }
        if (gl.home && !st.falling) S.player.setPosition(...gl.home);   // (home, whatever happened)
        st.gl = null;
    }

    // ── FALLING / THE END ──
    static fall(S) {
        const st = S._rtrial, T = S.TILE_SIZE;
        if (!st || st.done || st.falling) return;
        if (st.streak >= RhythmTrial.C.GROOVE.at(-1)[0]) RhythmTrial.say(S, 'GROOVE LOST', '#c8a0ff');
        st.falling = true; st.lives--; st.combo = 0; st.streak = 0; st.shake = 1; st.flash = 1; st.misses = (st.misses || 0) + 1;
        const h = st.R[st.i], now0 = RhythmTrial.now(S), formed = st.i + 1 < st.R.length && now0 >= RhythmTrial.from(st, st.i + 1);
        const mk = (h.hold && now0 < st.times[st.i + 1] && st.carry !== st.i) || !formed ? st.i : st.i + 1;   // the miss: the slab you didn't reach (or the one you went off, or the hold you let go of)
        if (mk < st.R.length) { RhythmTrial.paint(S, mk, RhythmTrial.MISS_COL); RhythmTrial.noteLost(S, mk); }
        if (st.mord) st.mord.done = true;   // (a mordent you fell out of is over; a trill too)
        if (st.trill && !st.trill.done) { st.trill.done = true; S.moveCooldown = RhythmTrial.C.STEP_MS; st.trillTxt?.setVisible(false); st.trillMark?.setVisible(false); st.trillRing?.setVisible(false); }
        const x = S.player.x, y = S.player.y;
        Sfx.play(S, 'whoosh'); Sfx.play(S, 'deny');
        S.cameras.main.shake(180, 0.006);
        for (let k = 0; k < 10; k++) {   // a puff of the dark where you went
            const a = Math.random() * Math.PI * 2, d = S.add.image(x, y + 6, 'vfx_dot').setTint(Math.random() < 0.5 ? 0x8a5aff : 0x3a2a6a).setBlendMode(Phaser.BlendModes.ADD).setScale(0.9).setDepth(1.2);
            S.tweens.add({ targets: d, x: x + Math.cos(a) * 22, y: y + Math.sin(a) * 14, alpha: 0, duration: 520, ease: 'Quad.easeOut', onComplete: () => d.destroy() });
        }
        S.tweens.add({ targets: S.player, alpha: 0, scaleX: st.pScale[0] * 0.2, scaleY: st.pScale[1] * 0.2, y: S.player.y + 14, duration: 380, ease: 'Quad.easeIn' });   // down and away
        RhythmTrial.judge(S, 'MISS', '#ff5a5a');
        RhythmTrial.say(S, st.lives > 0 && st.lives < Infinity ? `FELL  ·  ${st.lives} LEFT` : 'FELL', '#b89aff');
        S.time.delayedCall(420, () => {
            if (S._rtrial !== st) return;
            S.tweens.killTweensOf(S.player);
            S.player.setAlpha(1).setScale(...st.pScale);
            if (st.lives <= 0) return RhythmTrial.finish(S, 'OUT OF LIVES', false);
            // back on the newest slab, held a beat longer for you
            const N = st.R.length - 1, now = RhythmTrial.now(S);
            let j = st.i;
            for (let k = st.i; k <= N; k++) if (now >= RhythmTrial.from(st, k)) j = k;
            st.i = j; st.graceI = j; st.falling = false;
            const m = st.R[j];
            if (!st.tiles[j] || st.tiles[j].gone || st.tiles[j].ghost) RhythmTrial.tile(S, j, false);
            S.playerX = RhythmTrial.endX(m); S.playerY = m.y; S._step = null; S._glideUntil = 0; st.carry = null;   // (a hold's far end: its first cells may be gone)
            S.player.setPosition(S.playerX * T + T / 2, m.y * T + T / 2 + (S.SLIME_Y_OFFSET || 0));
            RhythmTrial.eatKeys(S);   // (a press made while falling doesn't step you off the slab you're put back on)
            if (st.R[j].end) RhythmTrial.finish(S, st.coreDead ? 'CLEARED!' : 'THE CORE SURVIVED', st.coreDead);
        });
    }
    static finish(S, text, won) {
        const st = S._rtrial;
        if (st?.lane) return RhythmTrial.finish(st.main, text, won);   // (the lover's run ends with yours)
        if (!st || st.done) return;
        st.done = true;
        RhythmTrial.banner(S, text, won ? `BEST COMBO ${st.best || st.combo}` : null, won ? '#ffe14a' : '#ff8a6a');
        Sfx.play(S, won ? 'fanfare' : 'deny');
        S.time.delayedCall(2600, () => { if (S._rtrial === st) RhythmTrial.stop(S); });
    }

    // ── HUD: no lane. The floor is the score: before each slab bursts up, fault lines of light open in the dark round the
    // cell it will rise from and close in on it, glowing hotter, to land on its edges on its beat (APP ms of warning); a spark
    // runs down a fissure from the slab before it, getting there on the beat too. Over each cell, from AHEAD ms out (and over
    // the one you're on), an inked note: its value, so a run reads like a bar of music. A dash is drawn LEAD ms early as an
    // arrow from the slab you'll leave to the one you'll land on, dashes marching along it, your element's badge on it (time to
    // switch); cosmic's hop, a curved one; a jump, an arrow that leaves your slab and loops back down onto it. A quake then
    // cracks your own slab red from the middle. Every beat a pulse of light rolls out from the core across the dark. Up top: lives, the race (the core's health
    // against the song); the combo at the right; the grades pop over you ──
    static ARROW_COL = 0xffb02e;   // the route's arrows: amber, a colour no note has (white, they read as more steps)
    static DEPTH = 6;   // the cues' layer: over the slime (1) and the weapons' bars over it (to 5.7)
    static app(m) { return Phaser.Math.Clamp(m.beat * 1.5, 600, 1100); }
    static col(m) { const M = RhythmTrial.C.MCOL; return m.kind === 'step' ? M.step : m.kind === 'quake' ? M.quake : M[m.el]; }
    static hash(n) { const s = Math.sin(n * 127.1 + 311.7) * 43758.5453; return s - Math.floor(s); }
    // a jagged crack from (x0,y0) to (x1,y1), the same shape every frame for the same seed; amp: how far it wanders
    static crack(g, x0, y0, x1, y1, seed, amp) {
        const L = Math.hypot(x1 - x0, y1 - y0) || 1, n = Math.max(2, Math.round(L / 5)), nx = -(y1 - y0) / L, ny = (x1 - x0) / L;
        let px = x0, py = y0;
        for (let i = 1; i <= n; i++) {
            const f = i / n, j = i === n ? 0 : (RhythmTrial.hash(seed + i * 7.3) - 0.5) * amp, x = x0 + (x1 - x0) * f + nx * j, y = y0 + (y1 - y0) * f + ny * j;
            g.lineBetween(px, py, x, y); px = x; py = y;
        }
    }
    // a quadratic curve from a through control c to b, as n + 1 points
    static bez(a, c, b, n) { return Array.from({ length: n + 1 }, (_, i) => { const t = i / n, v = 1 - t; return [v * v * a[0] + 2 * v * t * c[0] + t * t * b[0], v * v * a[1] + 2 * v * t * c[1] + t * t * b[1]]; }); }
    // a dashed line along pts, on px drawn, off px gaps, the dashes marching on as phase falls
    static dashes(g, pts, on, off, phase) {
        const P = on + off;
        let s = 0;
        for (let i = 1; i < pts.length; i++) {
            const [ax, ay] = pts[i - 1], [bx, by] = pts[i], L = Math.hypot(bx - ax, by - ay) || 1e-6;
            for (let d = 0; d < L; d += 1.5) {
                const d2 = Math.min(L, d + 1.5);
                if ((((s + d + phase) % P) + P) % P < on) g.lineBetween(ax + (bx - ax) * d / L, ay + (by - ay) * d / L, ax + (bx - ax) * d2 / L, ay + (by - ay) * d2 / L);
            }
            s += L;
        }
    }
    // where a point of the world is on the screen (for the crisp text over it, drawn by the HUD camera)
    static toScreen(S, x, y) { const cam = S.cameras.main; return [(x - cam.worldView.x) * cam.zoom, (y - cam.worldView.y) * cam.zoom]; }
    static hudBuild(S) {
        const C_ARROW = RhythmTrial.ARROW_COL, st = S._rtrial, W = S.scale.width, H = S.scale.height, keep = o => { st.objs.push(o); return o; }, pin = o => keep(o).setScrollFactor(0), ADD = Phaser.BlendModes.ADD;
        st.hud = pin(S.add.graphics().setDepth(45));
        // every cue draws over everything else in the world, you and your weapons' bars included (DEPTH): under you, a cue in the
        // cell above was hidden whenever the route went up
        const D = RhythmTrial.DEPTH;
        st.fx = keep(S.add.graphics().setDepth(D));          // the fault lines, the trail
        st.fxTop = keep(S.add.graphics().setDepth(D + 0.1));  // the arrows, a quake's cracks
        st.sparks = Array.from({ length: 36 }, () => keep(S.add.image(0, 0, 'vfx_glow').setBlendMode(ADD).setDepth(D + 0.05).setVisible(false)));
        st.noteGlow = Array.from({ length: 24 }, () => keep(S.add.image(0, 0, 'vfx_glow').setBlendMode(ADD).setDepth(D + 0.15).setVisible(false)));   // each note's glow
        st.notes = Array.from({ length: 24 }, () => keep(S.add.image(0, 0, '__DEFAULT').setDepth(D + 0.2).setVisible(false)));   // the notes, in their cells
        st.figs = Array.from({ length: 40 }, () => keep(S.add.image(0, 0, '__DEFAULT').setDepth(D + 0.2).setVisible(false)));   // Easy's beat figures, a layer each (in order: drawn in order)
        st.rests = Array.from({ length: 24 }, () => keep(S.add.image(0, 0, 'fx_rt_r4').setTint(0xf0ecff).setDepth(D + 0.32).setVisible(false)));   // rest marks (on a dark disc: on the pale slab they were lost)
        st.marks = Array.from({ length: 6 }, () => keep(S.add.image(0, 0, 'fx_rt_mordent').setDepth(D + 0.25).setVisible(false)));   // ornament marks (mordent, accent, trill)
        st.dirBack = keep(S.add.graphics().setDepth(D + 0.28));   // the discs under the route's arrows (over the notes: under them, between two cells they blurred in)
        st.dirs = Array.from({ length: 4 }, () => keep(S.add.image(0, 0, 'fx_rt_arrow').setTint(C_ARROW).setDepth(D + 0.3).setVisible(false)));   // the arrows for the next steps
        st.chevs = Array.from({ length: 48 }, () => keep(S.add.image(0, 0, 'fx_rt_chev').setDepth(D + 0.12).setVisible(false)));   // a dash's gap: chevrons marching along it
        st.badges = Array.from({ length: 6 }, () => keep(S.add.image(0, 0, 'el_icon_fire').setDepth(D + 0.31).setVisible(false)));   // its element, on a badge
        st.glyphs = Array.from({ length: 12 }, () => pin(S.add.text(0, 0, '', { fontSize: '15px', fontFamily: UIKit.FONT.title, fontStyle: 'bold', color: '#fff', stroke: '#07060a', strokeThickness: 5 }).setOrigin(0.5).setDepth(44).setVisible(false)));
        // the dashes coming, in order, over your element bar: each one's element, the key that switches to it, the beats till it
        st.queueG = pin(S.add.graphics().setDepth(46));
        const qt = (size, col) => pin(S.add.text(0, 0, '', { fontSize: size + 'px', fontFamily: UIKit.FONT.title, fontStyle: 'bold', color: col, stroke: '#07060a', strokeThickness: 4 }).setOrigin(0.5).setDepth(47).setVisible(false));
        st.queueChip = Array.from({ length: 4 }, () => pin(S.add.nineslice(0, 0, 'ui_tr', 'btn', 30, 30, 4, 4, 4, 4).setDepth(46.2).setVisible(false)));   // a chip each
        st.queueIcon = Array.from({ length: 4 }, () => pin(S.add.image(0, 0, 'el_icon_fire').setDepth(46.5).setVisible(false)));   // its element, animated
        st.queueCap = Array.from({ length: 4 }, () => pin(S.add.image(0, 0, 'fx_rt_key').setDepth(46.6).setVisible(false)));   // the key that switches to it, on a keycap
        st.queueArrow = Array.from({ length: 3 }, () => pin(S.add.image(0, 0, 'fx_rt_chev').setTint(0xcdbf9f).setAlpha(0.7).setDepth(46.3).setVisible(false)));
        st.queueKey = Array.from({ length: 4 }, () => qt(11, '#ffffff').setDepth(46.7)); st.queueIn = Array.from({ length: 4 }, () => qt(12, '#cdbf9f'));
        st.queueLbl = qt(10, '#f6d58a').setText('NEXT DASHES');
        st.missTxt = pin(S.add.text(W / 2 + 100, 62, '', { fontSize: '16px', fontFamily: UIKit.FONT.title, fontStyle: 'bold', color: '#ff7a6a', stroke: '#07060a', strokeThickness: 5 }).setOrigin(0, 0.5).setDepth(46));   // the misses so far
        st.livesTxt = pin(S.add.text(W / 2, 62, '', { fontSize: '22px', fontFamily: 'monospace', fontStyle: 'bold', color: '#ff5a6a', stroke: '#000', strokeThickness: 5 }).setOrigin(0.5).setDepth(46));
        st.raceTxt = pin(S.add.text(W / 2, 122, '', { fontSize: '12px', fontFamily: 'monospace', fontStyle: 'bold', color: '#e8d8b0', stroke: '#000', strokeThickness: 4 }).setOrigin(0.5, 0).setDepth(46));
        st.comboTxt = pin(S.add.text(W - 110, H * 0.4, '', { fontSize: '40px', fontFamily: UIKit.FONT.title, fontStyle: 'bold', color: '#ffffff', stroke: '#07060a', strokeThickness: 8 }).setOrigin(0.5).setDepth(48));
        st.comboLbl = pin(S.add.text(W - 110, H * 0.4 + 28, 'COMBO', { fontSize: '12px', fontFamily: UIKit.FONT.title, fontStyle: 'bold', color: '#cdbf9f', stroke: '#07060a', strokeThickness: 4 }).setOrigin(0.5).setDepth(48).setVisible(false));
        st.grooveTxt = pin(S.add.text(W - 110, H * 0.4 + 52, '', { fontSize: '14px', fontFamily: UIKit.FONT.title, fontStyle: 'bold', color: '#c8a0ff', stroke: '#07060a', strokeThickness: 5 }).setOrigin(0.5).setDepth(48));
    }
    static hud(S, now, dt) {
        const st = S._rtrial, C = RhythmTrial.C, W = S.scale.width, g = st.hud, T = S.TILE_SIZE;
        if (!g?.active) return;
        g.clear(); st.fx.clear(); st.fxTop.clear(); st.dirBack.clear();
        st.pulse = Math.max(0, st.pulse - dt / 260); st.shake = Math.max(0, st.shake - dt / 300); st.flash = Math.max(0, st.flash - dt / 400);
        const N = st.R.length - 1, song = Phaser.Math.Clamp((now - st.times[0]) / (st.times[N] - st.times[0]), 0, 1);
        // the race, along the top (its frame flushing red on a miss, warm on the beat)
        const core = st.core, hp = core?.sprite?.active ? Math.max(0, core.health / core.maxHealth) : 0, BW = 380, bx = W / 2 - BW / 2;
        if (!st.lane) {   // (the lover's run draws only its own cues: the screen's are yours)
        g.fillStyle(0x07060a, 0.7).fillRoundedRect(bx - 6, 82, BW + 12, 36, 8);
        g.lineStyle(2, st.flash > 0 ? 0xff3a3a : 0xffb050, Math.max(st.flash, st.pulse * 0.6)).strokeRoundedRect(bx - 6, 82, BW + 12, 36, 8);
        g.fillStyle(0x3a1010, 1).fillRoundedRect(bx, 88, BW, 10, 4); if (hp > 0) g.fillStyle(0xff5a3a, 1).fillRoundedRect(bx, 88, Math.max(8, BW * hp), 10, 4);
        g.fillStyle(0x2a2410, 1).fillRoundedRect(bx, 103, BW, 10, 4); if (song > 0) g.fillStyle(0xffd84a, 1).fillRoundedRect(bx, 103, Math.max(8, BW * song), 10, 4);
        const ph = st.R[Math.min(N, st.i + 1)].ph;
        st.raceTxt.setText(`CORE ${Math.round(hp * 100)}%   ·   SONG ${Math.round(song * 100)}%   ·   ${st.track ? `♪ ${st.track.title}  ${Math.round(C.BPM[0])} BPM` : `PHASE ${ph + 1}  ${C.BPM[ph]} BPM`}`);
        st.livesTxt.setText(st.lives === Infinity ? '♥ ∞' : '♥ '.repeat(Math.max(0, st.lives)).trim() || '·');
        }
        // the fault lines
        let sp = 0, gl = 0;
        const spark = (x, y, col, s, a) => { if (sp < st.sparks.length) st.sparks[sp++].setPosition(x, y).setTint(col).setScale(s).setAlpha(a).setVisible(true); };
        const glyph = (x, y, t, col, a) => {
            if (gl >= st.glyphs.length) return;
            const o = st.glyphs[gl++], [sx, sy] = RhythmTrial.toScreen(S, x, y);
            if (o._col !== col) o.setColor(Phaser.Display.Color.IntegerToColor(o._col = col).rgba);   // (setColor redraws the text every call)
            o.setText(t).setPosition(sx, sy).setAlpha(a).setVisible(true);
        };
        if (!st.done) for (let k = st.i + 1; k <= N; k++) {
            const m = st.R[k], left = st.times[k] - now, A = RhythmTrial.app(m);
            if (left > 1100) break;
            if (left > A || (st.tiles[k] && m.kind !== 'quake') || left < -60) continue;
            const u = Phaser.Math.Clamp(1 - left / A, 0, 1), col = RhythmTrial.col(m), x = m.x * T + T / 2, y = m.y * T + T / 2, seed = k * 13.1;
            if (m.kind === 'quake') {   // your own slab: cracks out from its middle, a red square closing on its edges, JUMP over you
                const G = st.fxTop, h = T / 2 * (1 + 1.2 * (1 - u));
                G.lineStyle(1 + 0.8 * u, col, 0.35 + 0.65 * u);
                for (let r = 0; r < 5; r++) { const a = r / 5 * Math.PI * 2 + RhythmTrial.hash(seed + r) * 0.8; RhythmTrial.crack(G, x, y, x + Math.cos(a) * T * 0.5 * u, y + Math.sin(a) * T * 0.5 * u, seed + r * 3, 2); }
                RhythmTrial.crack(G, x - h, y - h, x + h, y - h, seed + 1, 3 * (1 - u)); RhythmTrial.crack(G, x + h, y - h, x + h, y + h, seed + 2, 3 * (1 - u));
                RhythmTrial.crack(G, x + h, y + h, x - h, y + h, seed + 3, 3 * (1 - u)); RhythmTrial.crack(G, x - h, y + h, x - h, y - h, seed + 4, 3 * (1 - u));
                continue;
            }
            // the fissure from the slab before, a spark running down it
            const p = st.R[k - 1], px = RhythmTrial.endX(p) * T + T / 2, py = p.y * T + T / 2;
            st.fx.lineStyle(1, col, 0.15 + 0.35 * u); RhythmTrial.crack(st.fx, px, py, x, y, seed + 50, 3);
            spark(px + (x - px) * u, py + (y - py) * u, col, 0.12 + 0.1 * u, 0.5 + 0.5 * u);
            // the cell heating up, and the square of cracks closing in on its edges
            st.fx.fillStyle(col, 0.05 + 0.3 * u * u).fillRect(x - T / 2, y - T / 2, T, T);
            const h = T / 2 * (1 + 1.4 * (1 - u)), amp = 4 * (1 - u) + 0.6;
            st.fx.lineStyle(1 + 1.2 * u, col, 0.3 + 0.7 * u);
            RhythmTrial.crack(st.fx, x - h, y - h, x + h, y - h, seed + 1, amp); RhythmTrial.crack(st.fx, x + h, y - h, x + h, y + h, seed + 2, amp);
            RhythmTrial.crack(st.fx, x + h, y + h, x - h, y + h, seed + 3, amp); RhythmTrial.crack(st.fx, x - h, y + h, x - h, y - h, seed + 4, amp);
            for (const [cx, cy] of [[x - h, y - h], [x + h, y - h], [x + h, y + h], [x - h, y + h]]) spark(cx, cy, col, 0.1 + 0.12 * u, 0.25 + 0.6 * u);
        }
        // the notes in the cells they're for (staying on the slab once it forms, till you land on it), each in its value's
        // colour, glowing: they pop in, sway, and bounce on the beat. Two in one cell sit side by side; the one you're on is
        // under you, so not shown; a quake's rides the top of its jump loop. A little hand-drawn arrow between each cell and the
        // next says which way the route goes; a slur's arc spans its phrase.
        let nn = 0, dd = 0, prev = [RhythmTrial.endX(st.R[st.i]) * T + T / 2, st.R[st.i].y * T + T / 2];
        const show = [], per = new Map();
        if (!st.done) for (let k = st.i + 1; k <= N && show.length < st.notes.length; k++) {
            const m = st.R[k], left = st.times[k] - now, ahead = Phaser.Math.Clamp(m.beat * C.AHEAD_B, C.AHEAD[0], C.AHEAD[1]);
            if (left > ahead) break;
            const cell = m.x + ',' + m.y;
            if (m.kind !== 'quake') per.set(cell, (per.get(cell) || 0) + 1);
            show.push({ k, m, left, ahead, cell, i: m.kind === 'quake' ? 0 : per.get(cell) - 1 });
        }
        let mm = 0, rr = 0, ff = 0;
        const MARK = { mordent: ['fx_rt_mordent', 0xffd84a, 'MORDENT', 'forward  ·  back  ·  forward'], accent: ['fx_rt_accent', 0xff6a3a, 'ACCENT', 'click as you land on it: a big hit on the core'],
            trill: ['fx_rt_trill', 0xc8a0ff, 'TRILL', `back and forth, fast: ${C.TRILL_N} hops before time runs out`] };
        if (!st.done && st.R[st.i].hold) RhythmTrial.holdBar(S, st.i, 1);
        for (const { k, m, left, ahead, cell, i } of show) {
            const cx = m.x * T + T / 2, cy = m.y * T + T / 2, a = Phaser.Math.Clamp((ahead - left) / 250, 0, 1), many = m.kind === 'quake' ? 1 : per.get(cell);
            const pop = Phaser.Math.Easing.Back.Out(Phaser.Math.Clamp((ahead - left) / 220, 0, 1)), s = T * (many > 1 ? 0.5 : 0.68) * pop * (1 + 0.16 * st.pulse);
            const [key, val, rs, fig] = RhythmTrial.look(m, st.R[k + 1]), col = C.NOTE_COL[val];   // (rs: its rests, in a row under it, the cell's note raised to make room)
            if (m.kind !== 'quake' && (prev[0] !== cx || prev[1] !== cy)) {
                if (Math.abs(prev[0] - cx) + Math.abs(prev[1] - cy) <= T * 1.01 && dd < st.dirs.length) {   // a step: its arrow on the edge between (a dash has its own), the next
                    // one boldest, nudging the way it points on each beat
                    const ang = Math.atan2(cy - prev[1], cx - prev[0]), nudge = T * 0.12 * st.pulse, al = [1, 0.8, 0.6, 0.45][dd] * a, sz = T * (dd === 0 ? 0.66 : 0.56);
                    const ax = (prev[0] + cx) / 2 + Math.cos(ang) * nudge, ay = (prev[1] + cy) / 2 + Math.sin(ang) * nudge;
                    st.dirBack.fillStyle(0x07060a, 0.6 * al).fillCircle(ax, ay, sz * 0.48);
                    st.dirs[dd++].setPosition(ax, ay).setRotation(ang).setDisplaySize(sz, sz).setAlpha(al).setVisible(true);
                }
                prev = [RhythmTrial.endX(m) * T + T / 2, cy];
            }
            if (m.hold) {   // a hold: its line along the slab (the first, told)
                RhythmTrial.holdBar(S, k, a);
                if (!st.told.HOLD) { st.told.HOLD = true; RhythmTrial.banner(S, 'HOLD', 'keep the key down: it carries you to the end', '#b4a8ff'); }
            }
            const mk = MARK[m.mordent ? 'mordent' : m.accent ? 'accent' : m.trill ? 'trill' : ''];
            const [nx, ny0] = m.kind === 'quake' ? [cx - T * 0.86, cy - T * 1.6] : [cx + (i - (many - 1) / 2) * T * 0.4, cy + Math.sin(now / 260 + k) * 0.8], ny = ny0 + (mk ? T * 0.12 : 0) - (rs.length ? T * 0.12 : 0);
            if (mk && mm < st.marks.length) {   // an ornament's mark across the top of the cell (and the first of each, told)
                st.marks[mm++].setTexture(mk[0]).setTint(mk[1]).setDisplaySize(T * 0.62 * pop, T * 0.62 * pop).setPosition(cx, cy - T * 0.3 + Math.sin(now / 120) * 0.8).setAlpha(a).setVisible(true);
                if (!st.told[mk[2]]) { st.told[mk[2]] = true; RhythmTrial.banner(S, mk[2], mk[3], '#' + mk[1].toString(16).padStart(6, '0')); }
            }
            rs.forEach((key, j) => {
                if (rr >= st.rests.length) return;
                const rx = nx + (j - (rs.length - 1) / 2) * T * 0.36, ry = ny + T * 0.34;
                st.dirBack.fillStyle(0x07060a, 0.55 * a).fillCircle(rx, ry, T * 0.2 * pop);
                st.rests[rr++].setTexture(key).setDisplaySize(T * 0.44 * pop, T * 0.44 * pop).setPosition(rx, ry).setAlpha(a).setVisible(true);
            });
            st.noteGlow[nn].setPosition(nx, ny).setTint(col).setScale(0.32 * pop * (1 + 0.3 * st.pulse)).setAlpha(0.45 * a).setVisible(true);
            const img = st.notes[nn++], ang = Math.sin(now / 240 + k * 1.7) * 8;
            if (fig) {   // a beat's figure, layer on layer (wider than a note: as tall, its own width)
                img.setVisible(false);
                for (const [fr, c] of fig) if (ff < st.figs.length) { const L = st.figs[ff++].setTexture(key, fr); (c == null ? L.clearTint() : L.setTint(c)).setDisplaySize(s * L.frame.width / 16, s).setAngle(ang).setPosition(nx, ny).setAlpha(a).setVisible(true); }
            }
            else img.setTexture(key).setTint(col).setDisplaySize(s, s).setAngle(ang).setPosition(nx, ny).setAlpha(a).setVisible(true);
        }
        for (; nn < st.notes.length; nn++) { st.notes[nn].setVisible(false); st.noteGlow[nn].setVisible(false); }
        for (; mm < st.marks.length; mm++) st.marks[mm].setVisible(false);
        for (; rr < st.rests.length; rr++) st.rests[rr].setVisible(false);
        for (; ff < st.figs.length; ff++) st.figs[ff].setVisible(false);
        for (; dd < st.dirs.length; dd++) st.dirs[dd].setVisible(false);
        // slurs: an arc over each phrase showing (or under way)
        const slurs = new Set([st.R[st.i].slurEnd != null ? st.R[st.i].slurStart : null, ...show.map(o => o.m.slurStart)].filter(v => v != null));
        for (const s0 of slurs) {
            const a0 = st.R[s0], a1 = st.R[a0.slurEnd];
            if (!a1 || st.i > a0.slurEnd) continue;
            const x0 = a0.x * T + T / 2, y0 = a0.y * T + T / 2 - T * 0.45, x1 = a1.x * T + T / 2, y1 = a1.y * T + T / 2 - T * 0.45;
            const pts = RhythmTrial.bez([x0, y0], [(x0 + x1) / 2, Math.min(y0, y1) - T * 0.9], [x1, y1], 16), line = (w, c, al) => { st.fx.lineStyle(w, c, al); for (let j = 1; j < pts.length; j++) st.fx.lineBetween(...pts[j - 1], ...pts[j]); };
            line(4, 0x07060a, 0.5); line(2, 0xc8e0ff, 0.9);
        }
        // a trill's count, over you
        if (st.trill && !st.trill.done && st.trillTxt) {
            const [tx, ty] = RhythmTrial.toScreen(S, S.player.x, S.player.y - T * 1.4);
            st.trillTxt.setText(`TRILL  ${st.trill.n} / ${C.TRILL_N}   ${Math.max(0, (st.trill.until - now) / 1000).toFixed(1)}s`).setPosition(tx, ty);
            const m = st.R[st.trill.k], u = (now / 420) % 1;
            st.trillMark?.setY(m.y * T + T / 2 - T * 0.85 + Math.sin(now / 160) * 2);
            st.trillRing?.setScale(0.25 + 0.35 * u).setAlpha(0.8 * (1 - u));
        }
        // the arrows for what's coming: dashes, hops, jumps
        const G = st.fxTop;
        let cv = 0, bb = 0;
        if (!st.done) for (let k = st.i + 1; k <= N; k++) {
            const m = st.R[k], left = st.times[k] - now;
            if (left > C.LEAD[1]) break;
            if (m.kind === 'step' || left < -80) continue;
            const lead = Phaser.Math.Clamp(m.beat * C.LEAD_B, C.LEAD[0], C.LEAD[1]);
            if (left > lead) continue;
            const u = 1 - Math.max(0, left) / lead, a = Phaser.Math.Clamp((lead - left) / 300, 0, 1) * (0.55 + 0.45 * u), col = RhythmTrial.col(m);
            const p = st.R[k - 1], ax = RhythmTrial.endX(p) * T + T / 2, ay = p.y * T + T / 2, bx = m.x * T + T / 2, by = m.y * T + T / 2;
            let pts;
            if (m.kind === 'quake') pts = RhythmTrial.bez([ax - T * 0.3, ay - T * 0.15], [ax - T * 1.6, ay - T * 3], [ax + T * 0.05, ay - T * 0.3], 20);   // up off your slab and back down onto it, leaning off to the left of the notes
            else if (m.kind === 'hop') {   // the hop's two jumps, each as long as it goes, bowed out wide: an arc up to its turn and another down
                const v = RhythmTrial.hopVia(S, k) || m, vx = v.x * T + T / 2, vy = v.y * T + T / 2;
                const arc = (x0, y0, x1, y1) => RhythmTrial.bez([x0, y0], [(x0 + x1) / 2, (y0 + y1) / 2 - Math.hypot(x1 - x0, y1 - y0) * 0.45], [x1, y1], 12);
                pts = [...arc(ax, ay, vx, vy), ...arc(vx, vy, bx, by).slice(1)];
            }
            else pts = [[ax, ay], [bx, by]];
            const line = (w, c, al) => { G.lineStyle(w, c, al); for (let i = 1; i < pts.length; i++) G.lineBetween(...pts[i - 1], ...pts[i]); };
            const [mx, my] = pts.length > 2 ? pts[Math.floor(pts.length / 2)] : [(pts[0][0] + pts[1][0]) / 2, (pts[0][1] + pts[1][1]) / 2];
            if (m.kind === 'quake') {
                line(7, col, 0.16 * a); line(4, 0x07060a, 0.55 * a);   // a glow under it, a dark edge
                G.lineStyle(2.6, col, a); RhythmTrial.dashes(G, pts, 5, 3, -now / 25);
                const [hx, hy] = pts[pts.length - 1], [qx, qy] = pts[pts.length - 2], hl = Math.hypot(hx - qx, hy - qy) || 1, ux = (hx - qx) / hl, uy = (hy - qy) / hl;
                G.fillStyle(0x07060a, 0.6 * a).fillTriangle(hx + ux * 6.5, hy + uy * 6.5, hx - uy * 5.2, hy + ux * 5.2, hx + uy * 5.2, hy - ux * 5.2);
                G.fillStyle(col, a).fillTriangle(hx + ux * 5, hy + uy * 5, hx - uy * 3.8, hy + ux * 3.8, hx + uy * 3.8, hy - ux * 3.8);
            }
            else {   // a dash or a hop: chevrons in its element's colour marching along the gap, brightening toward the slab, on a soft glow
                line(10, col, 0.1 * a);
                const seg = pts.slice(1).map((q, i) => Math.hypot(q[0] - pts[i][0], q[1] - pts[i][1])), Lt = seg.reduce((x, y) => x + y, 0), sp = T * 0.42, s0 = T * 0.32;
                for (let d = s0 + (now / 25) % sp; d < Lt - s0 && cv < st.chevs.length; d += sp) {
                    let i = 0, r = d; while (i < seg.length - 1 && r > seg[i]) r -= seg[i++];
                    const [x0, y0] = pts[i], [x1, y1] = pts[i + 1], f = r / (seg[i] || 1), x = x0 + (x1 - x0) * f, y = y0 + (y1 - y0) * f;
                    if (Math.hypot(x - mx, y - my) < T * 0.5) continue;   // (clear of the badge)
                    st.chevs[cv++].setPosition(x, y).setRotation(Math.atan2(y1 - y0, x1 - x0)).setTint(col).setDisplaySize(T * 0.42, T * 0.42).setAlpha(a * (0.35 + 0.65 * d / Lt)).setVisible(true);
                }
            }
            if (m.kind === 'quake') glyph(mx, my - T * 0.62 - 2 * Math.sin(now / 70) * u, 'JUMP', col, a);   // (over its note, at the loop's top)
            else {   // the element you'll need, on a badge: ringed green when you're on it (then just Shift), else its key, pulsing
                const ready = S.currentElement === m.el;
                G.fillStyle(0x07060a, 0.85 * a).fillCircle(mx, my, 8.5); G.lineStyle(1.4, col, a).strokeCircle(mx, my, 8.5);
                if (bb < st.badges.length) st.badges[bb++].setTexture('el_icon_' + m.el).setPosition(mx, my).setDisplaySize(12, 12).setAlpha(a).setVisible(true);
                if (ready) G.lineStyle(1.6, 0x7dff9a, a).strokeCircle(mx, my, 10.5);
                glyph(mx, my - 14, ready ? '⇧' : Settings.label(Settings.key(m.el)), ready ? col : 0xffffff, a * (ready ? 1 : 0.6 + 0.4 * Math.abs(Math.sin(now / 120))));
            }
        }
        for (; sp < st.sparks.length; sp++) st.sparks[sp].setVisible(false);
        for (; gl < st.glyphs.length; gl++) st.glyphs[gl].setVisible(false);
        for (; cv < st.chevs.length; cv++) st.chevs[cv].setVisible(false);
        for (; bb < st.badges.length; bb++) st.badges[bb].setVisible(false);
        // the dashes coming: the next four, however far off (the first ringed green when you're on its element), right under you
        // (where your eyes are), or over you when the route's about to go down
        const QG = st.queueG, up = [], cam = S.cameras.main, Tz = T * cam.zoom, [px, py] = RhythmTrial.toScreen(S, S.player.x, S.player.y);
        QG.clear();
        if (!st.done) for (let k = st.i + 1; k <= N && up.length < 4; k++) if (st.R[k].kind === 'dash' || st.R[k].kind === 'hop') up.push(k);
        // each a chip (lit when you're on the first one's element) with its element, the key that switches to it on a keycap at
        // its corner (a tick once you're on it), the beats till it over it, and round the first a ring of its colour closing as it comes
        const down = st.R.slice(st.i + 1, st.i + 3).some(m => m.y > S.playerY), sz = up.map((k, j) => j ? 30 : 40), gw = 16;
        const qy = py + (down ? -2.1 : 1.5) * Tz;
        let qx = px - (sz.reduce((a, b) => a + b, 0) + gw * Math.max(0, up.length - 1)) / 2;
        st.queueLbl.setVisible(false);
        up.forEach((k, j) => {
            const m = st.R[k], col = RhythmTrial.col(m), first = j === 0, ready = first && S.currentElement === m.el, s = sz[j], x = qx + s / 2;
            qx += s + gw;
            const left = st.times[k] - now, beats = Math.max(0, Math.ceil(left / m.beat)), soon = first && !ready && beats <= 4;
            const chip = st.queueChip[j], fr = ready ? 'btn_on' : 'btn';
            if (chip._fr !== fr) { chip._fr = fr; chip.setFrame(fr); chip.updateUVs?.(); }
            chip.setSize(s, s).setPosition(x, qy).setTint(ready ? 0xa8ffb8 : 0xffffff).setAlpha(first ? 1 : 0.85).setVisible(true);
            st.queueIcon[j].setTexture('el_icon_' + m.el, String((Math.floor(now / 140) + j) % 4)).setPosition(x, qy).setDisplaySize(s * 0.64, s * 0.64).setVisible(true);
            if (first) {
                const r = s / 2 + 5, u = Phaser.Math.Clamp(1 - left / C.LEAD[1], 0, 1), al = soon ? 0.55 + 0.45 * Math.abs(Math.sin(now / 110)) : 1;
                QG.lineStyle(6, 0x07060a, 0.7).strokeCircle(x, qy, r);
                QG.lineStyle(3, ready ? 0x7dff9a : col, al).beginPath(); QG.arc(x, qy, r, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * u); QG.strokePath();
            }
            const cs = first ? 20 : 16, kx = x + s / 2 - 1, ky = qy + s / 2 - 1, kt = st.queueKey[j];
            st.queueCap[j].setPosition(kx, ky).setDisplaySize(cs, cs).setTint(ready ? 0x7dff9a : 0xffffff).setVisible(true);
            kt.setText(ready ? '✓' : Settings.label(Settings.key(m.el))).setPosition(kx, ky - 1).setVisible(true);
            if (kt._col !== (ready ? 1 : 0)) { kt._col = ready ? 1 : 0; kt.setColor(ready ? '#0a2a12' : '#1a1422').setStroke('#000000', 0); }
            st.queueIn[j].setText(beats > 0 ? `${beats}` : 'NOW').setPosition(x, qy - s / 2 - (first ? 15 : 9)).setVisible(true);
            if (j < up.length - 1) st.queueArrow[j].setPosition(x + s / 2 + gw / 2, qy).setDisplaySize(10, 10).setVisible(true);
        });
        for (let j = up.length; j < 4; j++) [st.queueKey, st.queueIn, st.queueIcon, st.queueChip, st.queueCap].forEach(a => a[j].setVisible(false));
        for (let j = Math.max(0, up.length - 1); j < 3; j++) st.queueArrow[j].setVisible(false);
        st.missTxt.setText(st.misses ? `✕ ${st.misses} MISS${st.misses > 1 ? 'ES' : ''}` : '');
        if (st.lane) return;
        st.comboTxt.setText(st.combo >= 2 ? String(st.combo) : ''); st.comboLbl.setVisible(st.combo >= 2);
        const gv = RhythmTrial.groove(S), nx = C.GROOVE.slice().reverse().find(([k]) => st.streak < k);
        st.grooveTxt.setText(st.streak ? `GROOVE ×${gv}  ·  ★${st.streak}${nx ? ` / ${nx[0]}` : ''}` : '');
    }
    // the core's heartbeat: a ring of its light rolling out across the dark on every beat
    static pulseRing(S) {
        const st = S._rtrial, c = st.core?.sprite;
        if (!c?.active) return;
        const r = S.add.image(c.x, c.y, 'vfx_ring').setBlendMode(Phaser.BlendModes.ADD).setTint(0xffb860).setScale(0.3).setAlpha(0.3).setDepth(0.555);
        S.tweens.add({ targets: r, scale: 6.5, alpha: 0, duration: 760, ease: 'Quad.easeOut', onComplete: () => r.destroy() });
    }
    // a note landed: the slab bursts in its colour where you landed, you squash onto it, a note rings out (climbing with the
    // combo), the camera kicks, the grade pops over you and the combo up top. PERFECT: the slab flashes gold and the groove
    // builds; GOOD: the combo goes on; BAD: combo and groove gone, and you're singed
    static hitFx(S, k, grade) {
        const st = S._rtrial, T = S.TILE_SIZE, m = st.R[k], col = RhythmTrial.col(m), ADD = Phaser.BlendModes.ADD, perfect = grade === 'perfect';
        const g0 = RhythmTrial.groove(S);
        if (grade === 'bad') {
            if (g0 > 1) RhythmTrial.say(S, 'GROOVE LOST', '#c8a0ff');
            st.combo = 0; st.streak = 0; st.shake = 0.5;
            RhythmTrial.judge(S, 'BAD', '#ff9a4a');
            Sfx.play(S, 'e_crack');
            S.player.setTint(0xff8a3a); S.time.delayedCall(160, () => S.player?.active && S.player.clearTint());
            for (let j = 0; j < 4; j++) { const d = S.add.image(S.player.x + (Math.random() - 0.5) * 12, S.player.y - 4, 'vfx_dot').setTint(0x4a4048).setAlpha(0.8).setDepth(1.2); S.tweens.add({ targets: d, y: d.y - 18, alpha: 0, scale: 1.6, duration: 500, delay: j * 50, onComplete: () => d.destroy() }); }
            return;
        }
        st.combo++; if (perfect) st.streak++;
        st.best = Math.max(st.best || 0, st.combo); st.pulse = 1; st.kick = perfect ? 1 : 0.6;
        if (!st.snd) Sfx.play(S, 'rt_hit', { n: (st.combo - 1) % 10, perfect });   // (a note's pluck; over a song, the song's the music)
        const g1 = RhythmTrial.groove(S);
        if (g1 > g0) { RhythmTrial.banner(S, `GROOVE ×${g1}`, 'damage to the core', '#c8a0ff', true); Sfx.play(S, 'fanfare'); }
        else if ([10, 25, 50, 75, 100].includes(st.combo)) RhythmTrial.banner(S, `${st.combo} COMBO!`, null, '#7fffd0', true);
        const t = st.tiles[k];
        RhythmTrial.paint(S, k, RhythmTrial.noteCol(st, k));   // (made it: its note's colour)
        const x = m.x * T + T / 2, y = m.y * T + T / 2, c = perfect ? 0xffe14a : col;
        const ring = S.add.image(x, y, 'vfx_ring').setBlendMode(ADD).setTint(c).setScale(0.25).setAlpha(0.9).setDepth(0.99);
        S.tweens.add({ targets: ring, scale: perfect ? 1.2 : 0.9, alpha: 0, duration: 320, ease: 'Quad.easeOut', onComplete: () => ring.destroy() });
        for (let s = 0; s < (perfect ? 9 : 5); s++) {
            const a = -Math.PI / 2 + (Math.random() - 0.5) * 2.6, d = S.add.image(x, y + 4, 'vfx_dot').setBlendMode(ADD).setTint(s % 2 ? c : 0xffffff).setScale(0.7).setDepth(1.2);
            S.tweens.add({ targets: d, x: x + Math.cos(a) * (10 + Math.random() * 14), y: y + Math.sin(a) * (12 + Math.random() * 14), alpha: 0, scale: 0.2, duration: 420, ease: 'Quad.easeOut', onComplete: () => d.destroy() });
        }
        const v = m.hold ? m.holdV : RhythmTrial.C.BEAMED && m.lead ? RhythmTrial.inBeat(m) : RhythmTrial.noteVal(m.dur);
        RhythmTrial.noteFly(S, x, y, v, perfect);
        if (m.kind === 'step' || m.kind === 'dash') {   // landing on it: a squash
            const [kx, ky] = st.pScale;
            S.player.setScale(kx * 1.18, ky * 0.82);
            S.tweens.add({ targets: S.player, scaleX: kx, scaleY: ky, duration: 150, ease: 'Back.easeOut' });
        }
        RhythmTrial.judge(S, perfect ? 'PERFECT' : 'GOOD', perfect ? '#ffe14a' : '#9fe0a0');
        if (st.combo >= 2) { S.tweens.killTweensOf(st.comboTxt); st.comboTxt.setScale(1.4); S.tweens.add({ targets: st.comboTxt, scale: 1, duration: 200, ease: 'Back.easeOut' }); }
    }
    // A note you made leaves its slab for the core like it's falling into a black hole: from the moment you land it, it's caught,
    // barely moving at first, then drawn faster and faster into orbit round it (a tilted disc: an ellipse) and spiralling in,
    // faster as it falls (as tight orbits go), shrinking and spinning, a trail of
    // its colour behind it (a PERFECT's brighter, sparkling); a faint violet vortex turns round the core while any are in it. It
    // goes in with a little implosion, then a ring of its colour (bigger on every tenth of the combo), a flash, sparks on a
    // PERFECT: your playing is what hits it. No core left: it just bursts where it was.
    static noteFly(S, x, y, v, perfect) {
        const st = S._rtrial, T = S.TILE_SIZE, ADD = Phaser.BlendModes.ADD, D = RhythmTrial.DEPTH, col = RhythmTrial.C.NOTE_COL[v] ?? 0xfff2d8, c = st.core?.sprite;
        const nb = S.add.image(x, y, RhythmTrial.valKey(v)).setTint(col).setDisplaySize(T * 0.7, T * 0.7).setDepth(D + 0.3), s0 = nb.scaleX;
        if (!c?.active) return S.tweens.add({ targets: nb, scale: s0 * 2, alpha: 0, y: y - 6, duration: 320, ease: 'Quad.easeOut', onComplete: () => nb.destroy() });
        const big = st.combo > 0 && st.combo % 10 === 0, R0 = T * (1.4 + Math.random() * 0.5), TILT = 0.55, o = { u: 0, w: 0 };
        const a0 = Math.atan2((y - c.y) / TILT, x - c.x) + 0.9;   // (it comes in a little ahead of where it starts: it falls into the orbit)
        const at = (r, a) => [c.x + Math.cos(a) * r, c.y + Math.sin(a) * r * TILT];
        let tx0 = x, ty0 = y;
        const trail = () => {   // (a dot every few pixels it travels: thin while it's slow, thick as it's pulled in)
            if (Math.hypot(nb.x - tx0, nb.y - ty0) < T * 0.22) return;
            tx0 = nb.x; ty0 = nb.y;
            const d = S.add.image(nb.x, nb.y, perfect ? 'vfx_glow' : 'vfx_dot').setBlendMode(ADD).setTint(col).setScale((perfect ? 0.2 : 0.32) * (nb.scaleX / s0 + 0.3)).setAlpha(0.75).setDepth(D + 0.29);
            S.tweens.add({ targets: d, alpha: 0, scale: d.scale * 0.3, duration: 260, onComplete: () => d.destroy() });
        };
        st.flying = (st.flying || 0) + 1;
        const vortex = st.vortex ||= (() => { const r = S.add.image(c.x, c.y, 'vfx_ring').setBlendMode(ADD).setTint(0xb48cff).setAlpha(0).setDepth(D + 0.05); st.objs.push(r); return r; })();
        const swirl = () => { if (!vortex.active || !c.active) return; vortex.setPosition(c.x, c.y).setScale(R0 / 64 * 2.2, R0 / 64 * 2.2 * TILT).setRotation(vortex.rotation + 0.06).setAlpha(Math.min(0.45, 0.14 * st.flying)); };
        // caught: lifting off barely moving, then pulled faster and faster to its orbit (a cubic ease-in: still at first)
        S.tweens.add({ targets: o, u: 1, duration: 950 + Math.random() * 150, ease: 'Cubic.easeIn',
            onUpdate: () => {
                const [ex, ey] = at(R0, a0), mx = x + (ex - x) * 0.25, my = y - T * 0.9, u = o.u, w = 1 - u;
                nb.setPosition(w * w * x + 2 * w * u * mx + u * u * ex, w * w * y + 2 * w * u * my + u * u * ey).setScale(s0 * (1 + 0.15 * Math.sin(Math.min(1, u * 4) * Math.PI) - 0.2 * u)).setAngle(u * 120);
                trail(); swirl();
            },
            onComplete: () => S.tweens.add({ targets: o, w: 1, duration: 700 + Math.random() * 120, ease: 'Linear',   // and spiralling in, keeping its speed (no stall at the orbit)
                onUpdate: () => {
                    const w = o.w, [px, py] = at(R0 * Math.pow(1 - w, 1.2), a0 + 6 * w + 2.5 * w * w);   // (round faster as it falls)
                    nb.setPosition(px, py).setScale(s0 * (0.8 - 0.6 * w)).setAngle(90 + w * 540).setAlpha(1 - 0.3 * w);
                    trail(); swirl();
                },
                onComplete: () => {
                    nb.destroy();
                    st.flying = Math.max(0, st.flying - 1);
                    if (!st.flying && vortex.active) S.tweens.add({ targets: vortex, alpha: 0, duration: 400 });
                    if (!c.active) return;
                    RhythmTrial.hurtCore(S, perfect ? 1 : RhythmTrial.C.PERF.GOOD);   // in it goes: its hit (PERF)
                    const imp = S.add.image(c.x, c.y, 'vfx_ring').setBlendMode(ADD).setTint(0x7a4aff).setScale(0.9).setAlpha(0.6).setDepth(D + 0.3);   // (the gulp: a ring pulled in)
                    S.tweens.add({ targets: imp, scale: 0.15, alpha: 0, duration: 110, ease: 'Quad.easeIn', onComplete: () => {
                        imp.destroy();
                        if (!c.active) return;
                        const r = S.add.image(c.x, c.y, 'vfx_ring').setBlendMode(ADD).setTint(col).setScale(0.3).setAlpha(0.9).setDepth(D + 0.3);
                        S.tweens.add({ targets: r, scale: big ? 2.4 : perfect ? 1.4 : 1.05, alpha: 0, duration: big ? 560 : 320, ease: 'Quad.easeOut', onComplete: () => r.destroy() });
                        const p = S.add.image(c.x, c.y, 'vfx_glow').setBlendMode(ADD).setTint(perfect ? 0xffffff : col).setScale(0.45).setAlpha(perfect ? 0.85 : 0.55).setDepth(D + 0.28);
                        S.tweens.add({ targets: p, alpha: 0, scale: 0.95, duration: 240, onComplete: () => p.destroy() });
                        for (let j = 0; j < (perfect ? 6 : 3); j++) {
                            const a = Math.random() * Math.PI * 2, d = S.add.image(c.x, c.y, 'vfx_dot').setBlendMode(ADD).setTint(j % 2 ? col : 0xffffff).setScale(0.6).setDepth(D + 0.3);
                            S.tweens.add({ targets: d, x: c.x + Math.cos(a) * T * (0.7 + Math.random() * 0.5), y: c.y + Math.sin(a) * T * (0.7 + Math.random() * 0.5) * TILT, alpha: 0, scale: 0.15, duration: 380, ease: 'Quad.easeOut', onComplete: () => d.destroy() });
                        }
                    } });
                } }) });
    }
    // a note missed: it cracks red and drops into the dark where it was
    static noteLost(S, k) {
        const st = S._rtrial, T = S.TILE_SIZE, m = st.R[k];
        if (!m) return;
        const v = RhythmTrial.look(m, st.R[k + 1])[1], x = m.x * T + T / 2, y = m.y * T + T / 2;
        const nb = S.add.image(x, y - T * 0.1, RhythmTrial.valKey(v)).setTint(RhythmTrial.MISS_COL).setDisplaySize(T * 0.7, T * 0.7).setDepth(RhythmTrial.DEPTH + 0.3);
        S.tweens.add({ targets: nb, x: x + (Math.random() - 0.5) * T, y: y + T * 2.6, angle: (Math.random() < 0.5 ? -1 : 1) * (120 + Math.random() * 120), scale: nb.scaleX * 0.5, duration: 900, ease: 'Quad.easeIn', onComplete: () => nb.destroy() });
        S.tweens.add({ targets: nb, alpha: 0, duration: 300, delay: 620 });
    }
    // the grade, popping over you
    static judge(S, text, col) {
        const st = S._rtrial, T = S.TILE_SIZE, [x, y] = RhythmTrial.toScreen(S, S.player.x, S.player.y - T * 1.1);
        st.judgeTxt?.destroy();
        const t = st.judgeTxt = S.add.text(x, y, text, { fontSize: '24px', fontFamily: UIKit.FONT.title, fontStyle: 'bold', color: col, stroke: '#07060a', strokeThickness: 6 })
            .setOrigin(0.5).setScrollFactor(0).setDepth(48).setScale(1.7);
        S.tweens.add({ targets: t, scale: 1, duration: 160, ease: 'Back.easeOut' });
        S.tweens.add({ targets: t, y: t.y - 16, alpha: 0, duration: 300, delay: 300, onComplete: () => t.destroy() });
    }
    // a big callout across the middle of the screen (`quick`: the count-in, gone before the next beat)
    static banner(S, text, sub, col, quick) {
        const st = S._rtrial, W = S.scale.width, H = S.scale.height;
        if (!st) return;
        st.bannerObjs?.forEach(o => { S.tweens.killTweensOf(o); o.destroy(); });
        const t = S.add.text(W / 2, H * 0.3, text, { fontSize: quick ? '64px' : '50px', fontFamily: UIKit.FONT.title, fontStyle: 'bold', color: col, stroke: '#07060a', strokeThickness: 10, padding: { x: 16, y: 16 } })
            .setOrigin(0.5).setScrollFactor(0).setDepth(62).setScale(2.2).setAlpha(0);
        const s = sub && S.add.text(W / 2, H * 0.3 + 44, sub, { fontSize: '16px', fontFamily: UIKit.FONT.title, fontStyle: 'bold', color: '#f3e3b8', stroke: '#07060a', strokeThickness: 5 })
            .setOrigin(0.5).setScrollFactor(0).setDepth(62).setAlpha(0);
        const all = st.bannerObjs = [t, s].filter(Boolean);
        all.forEach(o => st.objs.push(o));
        S.tweens.add({ targets: t, scale: 1, alpha: 1, duration: 200, ease: 'Back.easeOut' });
        if (s) S.tweens.add({ targets: s, alpha: 1, duration: 200, delay: 120 });
        S.tweens.add({ targets: all, alpha: 0, y: '-=12', duration: 260, delay: quick ? 380 : 1100 });
    }
    static say(S, text, col) {
        if (S._rtrial) S.showStatusText?.(S.player.x, S.player.y - 34, text, col);
    }
}
