// ═══════════════════════════════════════════════════════════════════════════
// Creatures.js — how the creatures look.
//
// A mixin like Visuals.js (GameScene borrows each method through a one-line proxy), plus a few
// static helpers any scene can call (CreatureFX.face for the shop's Glerp, the title slime and
// tower defense). Everything in here is presentation: nothing changes a number the game plays by.
//
//   faces    every slime gets eyes. Enemies glare at you, you look where you aim; they blink,
//            wince when hit, go to X's when stunned and stare when frozen
//   hats     each enemy type wears what it is (horns, a mortar barrel, a sprout, a fin, a helmet,
//            a raincloud...) in place of the icon that used to float over its head
//   status   drawn on the body from the enemy's state: fire on it, frost creeping in, a block of
//            ice, stars, sparks, drips, marks orbiting it; flame pips for stacked burns
//   symbols  the "!" warnings, slow and speed chevrons, pickups (glorps, potions, scrap) as
//            small pixel-art things that glow, and the new-enemy card shows the real slime
//
// The old pieces it replaces are kept and only stop drawing (CreatureFX.mute): game code still
// moves them, fades them and destroys them, so nothing that reads them has to change. Where one
// still means something (a "!" fading in), a stand-in copies it every frame (_cfxPuppet).
// The pixel art is in CreatureFX.art(); sizes, rates and colours worth tuning in _cfxCfg().
// ═══════════════════════════════════════════════════════════════════════════
class CreatureFX {

    // ── THE ART ──────────────────────────────────────────────────────────────
    // Rows of characters, one per pixel ('.' is clear; k is the slimes' own outline colour).
    // Faces and hats are drawn on a 32x32 slime frame: (x, y) is the piece's top-left on the
    // idle frame (0); the squashed idle frame (18) sits a row lower. JSON between the markers,
    // so a script can draw the art outside the game for review.
    static art() {
        if (CreatureFX._art) return CreatureFX._art;
        return (CreatureFX._art = /*ART*/{
 "eyes": {
  "friend": {"at": [[12, 26], [19, 26]], "open": [["wk", "kk"], ["wk", "kk"]], "blink": [["..", "kk"], ["..", "kk"]], "wince": [["k..", ".k.", "k.."], ["..k", ".k.", "..k"]], "wince_at": [[11, 25], [19, 25]], "x": [["k.k", ".k.", "k.k"], ["k.k", ".k.", "k.k"]], "x_at": [[11, 25], [19, 25]]},
  "kind": {"at": [[12, 25], [19, 25]], "open": [["wk", "kk", "kk"], ["wk", "kk", "kk"]], "blink": [["..", "..", "kk"], ["..", "..", "kk"]], "wince": [["k..", ".k.", "k.."], ["..k", ".k.", "..k"]], "wince_at": [[11, 25], [19, 25]], "x": [["k.k", ".k.", "k.k"], ["k.k", ".k.", "k.k"]], "x_at": [[11, 25], [19, 25]]},
  "calm": {"at": [[11, 26], [19, 26]], "open": [["kkk", ".wk"], ["kkk", "kw."]], "blink": [["...", "kkk"], ["...", "kkk"]], "wince": [["k..", ".k.", "k.."], ["..k", ".k.", "..k"]], "wince_at": [[11, 25], [19, 25]], "x": [["k.k", ".k.", "k.k"], ["k.k", ".k.", "k.k"]], "x_at": [[11, 25], [19, 25]]},
  "sly": {"at": [[11, 27], [19, 27]], "open": [["kkw"], ["wkk"]], "blink": [["kkk"], ["kkk"]], "wince": [["k..", ".k.", "k.."], ["..k", ".k.", "..k"]], "wince_at": [[11, 25], [19, 25]], "x": [["k.k", ".k.", "k.k"], ["k.k", ".k.", "k.k"]], "x_at": [[11, 25], [19, 25]]},
  "angry": {"at": [[11, 26], [19, 26]], "c": [["kkw", ".wk"], ["wkk", "kw."]], "l": [["kkw", ".kw"], ["wkk", "kw."]], "r": [["kkw", ".wk"], ["wkk", "wk."]], "blink": [["kk.", ".kk"], [".kk", "kk."]], "wince": [["k..", ".k.", "k.."], ["..k", ".k.", "..k"]], "wince_at": [[11, 25], [19, 25]], "x": [["k.k", ".k.", "k.k"], ["k.k", ".k.", "k.k"]], "x_at": [[11, 25], [19, 25]]}
 },
 "hats": {
  "horns": {"x": 9, "y": 16, "pal": {"b": "#f2e9d2", "s": "#b8aa8c"}, "rows": [
    ".k...........k.", "kbk.........kbk", "kbk.........kbk", "kbbk.......kbbk", ".kbbk.....kbbk.", ".ksbbk...kbbsk.",
    "..ksbk...kbsk..", "...kk.....kk..."]},
  "mortar": {"x": 12, "y": 15, "pal": {"m": "#6f7c8f", "M": "#3d4656", "o": "#ff7a1a", "O": "#ffd060", "r": "#8a6a3a"}, "rows": [
    "..kkkkk..", ".kmoOomk.", ".kMmmmMk.", "..kMmMk..", "..kMmMk..", ".kkMmMkk.", ".krrrrrk.", "kkrrrrrkk",
    ".kkkkkkk."]},
  "sprout": {"x": 12, "y": 17, "pal": {"L": "#b6ff7a", "l": "#46c24e", "s": "#2c8a3a"}, "rows": [
    ".kk...kk.", "kLlk.klLk", "klllklllk", ".kklslkk.", "...ksk...", "...ksk...", "....k...."]},
  "bud": {"x": 12, "y": 15, "pal": {"P": "#ffb0dc", "p": "#e0609e", "L": "#b6ff7a", "l": "#46c24e"}, "rows": [
    "...kkk...", "..kPPpk..", ".kPPPppk.", ".kPPpppk.", "..kpppk..", "kk.klk.kk", "kLkklkkLk", ".kLLlLLk.", "..kkkkk.."]},
  "ears": {"x": 9, "y": 15, "pal": {"E": "#3a2a32", "e": "#5a4048", "r": "#c8303a", "R": "#ff6a6a"}, "rows": [
    "kk.........kk", "kEk.......kEk", "kEek.....keEk", "kEeEk...kEeEk", "kEEEkkkkkEEEk", "krrRrrrrrrRrk", ".kkkkkkkkkkk."]},
  "flamecrown": {"x": 10, "y": 16, "pal": {"F": "#ffd04a", "f": "#ff7a1a", "r": "#c02a0a"}, "rows": [
    "..k...k...k..", ".kFk.kFk.kFk.", ".kfFkFffkFfk.", "kfffffrfffffk", "krrrrrrrrrrrk", ".kkkkkkkkkkk."]},
  "tophat": {"x": 11, "y": 16, "pal": {"B": "#1a1420", "b": "#3a2e48", "g": "#ffd84a"}, "rows": [
    "..kkkkkkk..", "..kBBBBBk..", "..kBbBBBk..", "..kBbBBBk..", "..kgggggk..", "kkkBBBBBkkk", "kBBBBBBBBBk", ".kkkkkkkkk."]},
  "medic": {"x": 11, "y": 18, "pal": {"W": "#f4fff8", "w": "#c8e8d8", "G": "#3ad86a"}, "rows": [
    "...kkkkk...", "..kWWGWWk..", ".kWWGGGWWk.", ".kWWWGWWWk.", "kwwwwwwwwwk", ".kkkkkkkkk."]},
  "anchorhat": {"x": 12, "y": 14, "pal": {"S": "#8aa4c0", "s": "#4a6078"}, "rows": [
    "...kkk...", "...kSk...", ".kkkSkkk.", ".kSSSSSk.", "...kSk...", "k..kSk..k", "kSkkSkkSk", ".kSSsSSk.", "..kkkkk.."]},
  "goggles": {"x": 7, "y": 20, "pal": {"B": "#1a2a3a", "L": "#9fe8ff", "l": "#3aa8d8", "W": "#ffffff"}, "rows": [
    "...kkkk....kkkk...", "..kLWLLkBBkLWLLk..", "..kLllLk..kLllLk..", "...kkkk....kkkk..."]},
  "shades": {"x": 10, "y": 25, "pal": {"P": "#c070ff", "p": "#7a30c0"}, "rows": [
    "kkkkkkkkkkkkk", "kPPpk...kPPpk", ".kkk.....kkk."]},
  "mask": {"x": 9, "y": 28, "pal": {"M": "#3a2450", "m": "#24163a"}, "rows": [
    "kMMMMMMMMMMMMMk", ".kmmmmmmmmmmmk."]},
  "fangs": {"x": 15, "y": 29, "pal": {"W": "#ffffff", "R": "#d01a1a"}, "rows": [
    "W.W", "R.R"]},
  "terminals": {"x": 11, "y": 18, "pal": {"W": "#ffe08a", "R": "#d83a2a", "D": "#2a2a2a"}, "rows": [
    ".kWk...kWk.", ".kRk...kDk.", ".kRk...kDk.", "kkkkk.kkkkk"]},
  "bud0": {"x": 14, "y": 19, "pal": {"S": "#a0703a", "s": "#6a4a20"}, "rows": [
    ".kk.", "kSsk", ".kk."]},
  "bud1": {"x": 13, "y": 17, "pal": {"L": "#7ad84a", "G": "#3a8a2a"}, "rows": [
    ".L.L.", "LkGkL", "..G..", "..G..", "..G.."]},
  "bud2": {"x": 13, "y": 15, "pal": {"B": "#5ab83a", "b": "#2a7a22", "L": "#7ad84a", "G": "#3a8a2a"}, "rows": [
    "..k..", ".kBk.", ".kbk.", "L.G.L", ".LGL.", "..G..", "..G.."]},
  "bud3": {"x": 12, "y": 14, "pal": {"P": "#ff9ad8", "p": "#ffd0ec", "L": "#7ad84a", "G": "#3a8a2a"}, "rows": [
    "..kpk..", ".kpPpk.", ".kPPPk.", "..kGk..", ".L.G.L.", "..LGL..", "...G...", "...G..."]},
  "wisps": {"x": 10, "y": 16, "pal": {"W": "#f6f0ff", "B": "#cbbcf0", "b": "#7a68b0"}, "rows": [
    ".k....k....k.", "kWk..kWk..kWk", "kBk..kBWk.kBk", ".kBkkBbBkkBk.", "..kbbbbbbbk..", "...kkkkkkk..."]},
  "voidcrown": {"x": 10, "y": 16, "pal": {"V": "#c08aff", "v": "#6a2ab8", "S": "#fff0a0"}, "rows": [
    "......k......", ".k...kSk...k.", "kVk.kVvVk.kVk", "kvVkVvvvVkVvk", "kvvvvvSvvvvvk", ".kkkkkkkkkkk."]},
  "frostspikes": {"x": 10, "y": 16, "pal": {"I": "#e8fbff", "i": "#8fd8f8", "d": "#3a7ab0"}, "rows": [
    "..k.......k..", ".kIk..k..kIk.", ".kIk.kIk.kik.", "kiIikkIikkIik", "kdddiiiiidddk", ".kkkkkkkkkkk."]},
  "boltcrown": {"x": 10, "y": 16, "pal": {"Y": "#fff27a", "y": "#e0b020", "W": "#ffffff"}, "rows": [
    ".k...kk...k..", "kYk..kYk.kYk.", ".kYk.kYYk.kYk", "kYyk.kyYkkYyk", "kyyyyyWyyyyyk", ".kkkkkkkkkkk."]},
  "seam": {"x": 14, "y": 23, "pal": {"t": "#f4ead2"}, "rows": [
    "..k..", ".tkt.", "..k..", ".tkt.", "..k.."]},
  "spout": {"x": 12, "y": 27, "pal": {"r": "#5a0c1c", "p": "#ff9fb4"}, "rows": [
    "....kkk....", "p..krrrk..p", "....krk...."]},
  "hood": {"x": 9, "y": 15, "pal": {"h": "#3a1d5c", "H": "#5c3388"}, "rows": [
    ".......k.......", "......khk......", ".....khHhk.....", "....khHHhhk....", "...khHHhhhhk...", "..khHHhhhhhhk..",
    ".khHhhhhhhhhhk.", "khHhhhhhhhhhhhk", "khhhhhhhhhhhhhk", "khhkkkkkkkkkhhk", "khk.........khk", ".k...........k."]},
  "monocle": {"x": 18, "y": 25, "pal": {"g": "#ffcf4a", "G": "#b8892a"}, "rows": [
    ".ggg.", "g...g", "g...g", ".gGg.", "...G.", "....G"]},
  "fin": {"x": 13, "y": 14, "pal": {"f": "#e6f6ff", "F": "#9fc8e6"}, "rows": [
    "......k", ".....kk", "....kfk", "...kfk.", "..kffk.", ".kfFfk.", ".kfFffk", "kfFfffk", "kfffffk", ".kkkkk."]},
  "antennae": {"x": 11, "y": 16, "pal": {"o": "#66f0ff", "O": "#e0ffff"}, "rows": [
    ".kk.....kk.", "kOok...kOok", ".kk.....kk.", "..k.....k..", "...k...k...", "...k...k...", "....k.k....",
    "....k.k...."]},
  "cloud": {"x": 11, "y": 10, "pal": {"c": "#9fb4d4", "C": "#dfe9f8", "s": "#6f84a8", "d": "#4aa8ff"}, "rows": [
    "....kkk....", "..kkCCCkk..", ".kcCCCCCck.", "kcccCCcccck", "ksssssssssk", ".kkkkkkkkk.", "..d...d....",
    "....d...d.."]},
  "helm": {"x": 10, "y": 14, "pal": {"t": "#ffd24a", "T": "#b8892a", "h": "#a9bdd2", "H": "#e2ecf6", "d": "#5f7186"}, "rows": [
    "....t.t.t....", "....t.t.t....", "....ttttt....", ".....ktk.....", "....kkTkk....", "...khHHHhk...",
    "..khHHhhhhk..", ".khHhhhhhhhk.", ".khhhhhhhhhk.", "khhhhhhhhhhhk", "kdddddddddddk", ".kkkkkkkkkkk."]},
  "rod": {"x": 14, "y": 11, "pal": {"Y": "#ffe94a", "W": "#ffffff", "m": "#8e9bb0", "M": "#5b6577"}, "rows": [
    ".kkk.", "kYWYk", ".kYk.", "..k..", ".kmk.", "..m..", ".kmk.", "..m..", ".kmk.", "..M..", ".kMk.", "kmmmk",
    ".kkk."]},
  "storm": {"x": 10, "y": 14, "pal": {"y": "#fff27a", "Y": "#ffffff"}, "rows": [
    "......k......", ".....kyk.....", ".k...kYk...k.", "kyk.kYk...kyk", ".kyk.kyk.kyk.", "..kYk.kYkYk..",
    "..kykkYkkyk..", "...kyk.kyk...", "....k...k...."]},
  "halo": {"x": 10, "y": 15, "pal": {"v": "#6a2aa8", "V": "#c07cff"}, "rows": [
    "...kkkkkkk...", ".kkVVVVVVVkk.", "kVVkkkkkkkVVk", "kvvk.....kvvk", ".kkvvvvvvvkk.", "...kkkkkkk..."]},
  "weeds": {"x": 10, "y": 20, "pal": {"s": "#2f6b3e", "S": "#5aa860"}, "rows": [
    ".....kkk.....", "...kksSskk...", "..ksSssSssk..", ".ksksk.ksSsk.", ".ks.s...k.sk.", ".sk.k.....s..",
    ".s........k..", ".k..........."]},
  "roof": {"x": 8, "y": 12, "pal": {"r": "#a0522d", "R": "#d2783c", "p": "#6b4423"}, "rows": [
    "......kkkkk......", "....kkrRRRrkk....", "..kkrRRRRRRRrkk..", "kkrRRRRRRRRRRRrkk", "kkkkkkkkkkkkkkkkk",
    ".kp...........pk.", ".kp...........pk.", ".kp...........pk.", ".kp...........pk.", ".kp...........pk.",
    ".kp...........pk.", ".kp...........pk.", ".kk...........kk."]},
  "crown": {"x": 10, "y": 17, "pal": {"g": "#ffd84a", "G": "#fff3a8", "d": "#b8892a", "c": "#5ff4ff", "y": "#ff5a8a"}, "rows": [
    "k.....k.....k", "kk...kGk...kk", "kgk..kgk..kgk", "kggkkgGgkkggk", "kGcgGgygGgcGk", "kdddddddddddk",
    ".kkkkkkkkkkk."]},
  "icecrown": {"x": 10, "y": 13, "pal": {"W": "#ffffff", "I": "#9fe8ff", "i": "#5fb8e0", "d": "#2a6a9a"}, "rows": [
    "......k......", ".....kWk.....", "..k..kIk..k..", ".kWk.kIk.kWk.", ".kIkkiIikkIk.", "kiIiiIIIiiIik", "kiiiiiiiiiiik",
    "kdddddddddddk", ".kkkkkkkkkkk."]},
  "bow": {"x": 11, "y": 18, "pal": {"P": "#fff3a8", "p": "#ffd84a", "d": "#c89a2a"}, "rows": [
    ".kk.....kk.", "kPpk...kpPk", "kPppkkkpppk", "kpppkPkpppk", "kdppkkkppdk", ".kkk...kkk."]},
  "qcrown": {"x": 11, "y": 18, "pal": {"g": "#ffd84a", "G": "#fff3a8", "d": "#b8892a", "r": "#ff3a5a", "c": "#5ff4ff"}, "rows": [
    "k....k....k", "kk..kGk..kk", "kGk.kgk.kGk", "kgrkgGgkrgk", "kgggggcgggk", "kdddddddddk", ".kkkkkkkkk."]}
 },
 "sets": {"berserker": ["horns"], "rooter": ["sprout"], "voidsniper": ["shades", "mask"], "sniper": ["hood", "monocle"], "lightningelem": ["storm"], "drowner": ["weeds"], "tidecaller": ["cloud"], "tidalguard": ["helm"], "frost": ["icecrown"], "wishingwell": ["roof"], "conduit": ["terminals"], "volt": ["crown"], "queen": ["qcrown"], "bud": ["bud"], "bud0": ["bud0"], "bud1": ["bud1"], "bud2": ["bud2"], "bud3": ["bud3"], "leech": ["fangs"], "hunter": ["ears", "fangs"], "shade": ["voidcrown"], "shade_fire": ["flamecrown"], "shade_ice": ["frostspikes"], "shade_lightning": ["boltcrown"], "wraith": ["wisps"], "diver": ["goggles"], "ceo": ["tophat"], "healer": ["medic"], "anchor": ["anchorhat"], "cheer": ["bow"]},
 "bits": {
  "star": {"pal": {"Y": "#ffe94a", "W": "#ffffff"}, "rows": [
    "...k...", "..kYk..", ".kkYkk.", "kYYWYYk", ".kkYkk.", "..kYk..", "...k..."]},
  "flake": {"pal": {"c": "#9fe6ff", "W": "#ffffff"}, "rows": [
    "..c..", "c.c.c", ".cWc.", "c.c.c", "..c.."]},
  "drop": {"pal": {"b": "#4aa8ff", "B": "#bfe6ff"}, "rows": [
    ".b.", "bBb", "bBb", ".b."]},
  "mote": {"pal": {"V": "#c99cff", "W": "#ffffff"}, "rows": [
    "..k..", ".kVk.", "kVWVk", ".kVk.", "..k.."]},
  "chevron": {"pal": {"w": "#ffffff", "s": "#b8c4d8"}, "rows": [
    "kk...kk", "kwk.kwk", ".kwkwk.", "..ksk..", "...k..."]},
  "bubble": {"pal": {"g": "#8aff5a", "W": "#ffffff"}, "rows": [
    ".gg.", "g.Wg", "g..g", ".gg."]},
  "flame": {"pal": {"y": "#ffe27a", "o": "#ff8a2a", "r": "#e8401a"}, "rows": [
    "..k..", ".kok.", ".koyk", "koyyk", "kryok", ".krk."]},
  "alert": {"pal": {"w": "#ffffff", "s": "#c8ccd8"}, "rows": [
    ".kkk.", "kwwwk", "kwwsk", "kwwsk", ".kwk.", ".kwk.", "..k..", ".kkk.", "kwwsk", ".kkk."]},
  "glorp": {"pal": {"G": "#b6ffc8", "g": "#2fe08a", "d": "#169a5e", "W": "#ffffff"}, "rows": [
    "...kkk...", "..kGGgk..", ".kGWGggk.", "kgGGggggk", "kgggggggk", "kgggggdgk", ".kgggddk.", "..kdddk..",
    "...kkk..."]},
  "potion_hp": {"pal": {"c": "#b88a5a", "g": "#cfe0ff", "r": "#ff3a5a", "R": "#ff9aae", "d": "#a01030", "W": "#ffffff"}, "rows": [
    "...kkk...", "...kck...", "..kkkkk..", "...kgk...", "..kgggk..", ".kgrrrgk.", "kgRWrrrgk", "krRrrrrrk",
    "krrrrrrdk", "kdrrrrddk", ".kdddddk.", "..kkkkk.."]},
  "potion_ult": {"pal": {"c": "#b88a5a", "g": "#cfe0ff", "r": "#ffc83a", "R": "#fff2a8", "d": "#b8862a", "W": "#ffffff"}, "rows": [
    "...kkk...", "...kck...", "..kkkkk..", "...kgk...", "..kgggk..", ".kgrrrgk.", "kgRWrrrgk", "krRrrrrrk",
    "krrrrrrdk", "kdrrrrddk", ".kdddddk.", "..kkkkk.."]},
  "scrap": {"pal": {"c": "#5ff0c8", "C": "#c8fff0", "d": "#1f9a7e"}, "rows": [
    "...k.k...", "..kckck..", ".kcCccck.", "kcCckkcck", ".kck.kck.", "kcckkccdk", ".kcccddk.", "..kdkdk..",
    "...k.k..."]},
  "anchor": {"pal": {"B": "#e6fbff", "I": "#9fb8d2", "b": "#6fd8ff", "d": "#34465c", "i": "#5d7590"}, "rows": [
    "...........kkk...........", "..........kIIIk..........", ".........kIdddIk.........", "........kIdkkkIIk........",
    "........kIdk.kIdk........", "........kIdkkkIdk........", ".........kIIIIdk.........", "..........kIidk..........",
    "..kkk.....kIidk.....kkk..", ".kBBBkkkkkkIidkkkkkkBBBk.", "kBbbbBIIIIIiiiIIIIIBbbbBk", "kBbkBbIiiiiiiiiiiidBbkBbk",
    "kBbBbbIddddiiidddddBbBbbk", ".kBbbkkkkkkIidkkkkkkBbbk.", "..kkk.....kIidk.....kkk..", "..........kIidk..........",
    "..........kIidk..........", "..........kIidk..........", "..........kIidk..........", "....kk....kIidk.....kk...",
    "...kBBk...kIidk....kBBk..", "..kBbbBk..kIidk...kBbbBk.", "..kBbbbk..kIidk...kBbbbk.", "..kBbbbk..kIidk...kBbbbk.",
    "...kBbk...kIidk....kBbk..", "...kIIIk..kIidk...kIIIk..", "....kIiIk.kIidk..kIidk...", ".....kIdkkkIidkkkkIdk....",
    ".....kIiIIIiiiIIIIidk....", "......kIdddddddddddk.....", ".......kkkkkkkkkkkk......", "........................."]},
  "totem": {"pal": {"G": "#14b85a", "H": "#e8ffe8", "M": "#3c4a6a", "S": "#8a8fa8", "g": "#3cff8c", "m": "#26304a", "n": "#171d30", "r": "#59ff9a", "s": "#5f6479", "t": "#3f4357"}, "rows": [
    "....k.....krk.....k....", "...krk..kkMMMkk..krk...", "....krkkMMmmmMMkkrk....", ".....krMmnnnnnmMrk.....",
    ".....kMmnHHHHHMmMk.....", "....kMmnHHHgggHMmMk....", "....kMnHgHgggggHMnk....", "..kkMmnHgggGgggGMmMkk..",
    ".krrMmnHggGkHggGMmnrrk.", "..kkMmnHgggHgggGMmnkk..", "....kMnHgggggggGMnk....", "....kMmMHgggggGMmnk....",
    ".....kMmMHGGGGMmnk.....", ".....krMmMMMMMmnrk.....", "....krMmmmmmmmmmMrk....", "...krkMmmmmnmmmmnkrk...",
    "....kkMmmmnrMmmmnkk....", ".....kMmrrrrrrrmnk.....", ".....kMmmmmMmmmmnk.....", ".....kMmmmmmmmmmnk.....",
    ".....kMmrrrrrrrmnk.....", ".....kMmmmmmmmmmnk.....", ".....kMmmmmmmmmmnk.....", ".....kMmrrrrrrrmnk.....",
    ".....kMmmmmmmmmmnk.....", ".....kMmmmmmmmmmnk.....", ".....kMmmmmmmmmmnk.....", "..kkkkMmmmmmmmmmnkkkk..",
    ".kSSSSMnnnnnnnnnnSSSSk.", ".kSsssSStSSSSStSSssstk.", ".kSttttttttttttttttttk.", ".kSssssstssssstssssstk.",
    ".kSssssstssssstssssstk.", ".kSttttttttttttttttttk.", "..kkkkkkkkkkkkkkkkkkk.."]},
  "shield": {"pal": {"c": "#5fd8ff", "C": "#2a8fd0", "W": "#ffffff"}, "rows": [
    ".kkkkkkk.", "kWWccccck", "kWccccCck", "kcccccCck", "kcccccCck", ".kccccCk.", ".kcccCck.", "..kcCck..",
    "...kck...", "....k...."]},
  "mark_gold": {"pal": {"Y": "#fff3a0", "y": "#ffcc33", "o": "#b8862a", "W": "#ffffff"}, "rows": [
    "....k....", "...kYk...", "..kYWyk..", ".kYWyyyk.", "kYyyyyyok", ".kyyyyok.", "..kyyok..", "...kok...",
    "....k...."]},
  "mark_purple": {"pal": {"V": "#f0c8ff", "v": "#b45cff", "p": "#7a2ad0", "W": "#ffffff"}, "rows": [
    ".....k.....", "....kVk....", "...kVWvk...", "..kVWvvvk..", ".kVvvWvvpk.", "kVvvWWWvvpk", ".kvvvWvvpk.",
    "..kvvvvpk..", "...kvvpk...", "....kpk....", ".....k....."]}
 }
}/*END*/);
    }

    // Paints rows of characters into a 2D context, one pixel each.
    static pix(ctx, x0, y0, rows, pal) {
        const BASE = { k: '#1c1728', K: '#0b0812', w: '#ffffff' };
        rows.forEach((row, j) => {
            for (let i = 0; i < row.length; i++) {
                const ch = row[i];
                if (ch === '.' || ch === ' ') continue;
                ctx.fillStyle = (pal && pal[ch]) || BASE[ch] || '#ff00ff';
                ctx.fillRect(x0 + i, y0 + j, 1, 1);
            }
        });
    }

    // ── TEXTURES ─────────────────────────────────────────────────────────────
    // Built once per game, from whichever scene asks first:
    //   cfx_face  32x32 frames laid over a slime frame: e_<mood>_<frame>_<look>, h_<set>_<frame>
    //   cfx_bits  the small sprites (stars, flakes, drops, chevrons, pickups...)
    //   cfx_ice   the ice block, whole and cracked
    static sheets(scene) {
        const tm = scene?.textures;
        const A = CreatureFX.art();
        if (!A.hats.ears1) for (let n = 0; n <= 4; n++) {   // the Hunter's ears filling with blood, bottom up, as its rage builds (LevelManager._updateHunters)
            const ears = A.hats.ears;
            A.hats['ears' + n] = { ...ears, pal: { ...ears.pal, b: '#a0101e', B: '#ff3a3a' }, rows: ears.rows.map((row, j) => j >= 1 && j <= 4 && j >= 5 - n ? row.replace(/E/g, 'b').replace(/e/g, 'B') : row) };
            A.sets['hunter' + n] = ['ears' + n, 'fangs'];
        }
        if (!tm || tm.exists('cfx_face')) return !!tm;   // (the sheet from its file: the ears above still have to be in the art)
        const cells = [];
        for (const mood of Object.keys(A.eyes)) {
            const E = A.eyes[mood];
            for (const body of [0, 18]) {
                const dy = body === 18 ? 1 : 0;
                for (const st of ['c', 'l', 'r', 'blink', 'wince', 'x']) {
                    cells.push([`e_${mood}_${body}_${st}`, (ctx, X, Y) => {
                        let key = st, shift = 0;
                        if (!E[key]) { key = 'open'; shift = st === 'l' ? -1 : st === 'r' ? 1 : 0; }
                        const at = E[key + '_at'] || E.at;
                        at.forEach(([ax, ay], i) => CreatureFX.pix(ctx, X + ax + shift, Y + ay + dy, E[key][i], null));
                    }]);
                }
            }
        }
        for (const [set, parts] of Object.entries(A.sets)) {
            for (const body of [0, 18]) {
                cells.push([`h_${set}_${body}`, (ctx, X, Y) => {
                    for (const p of parts) {
                        const h = A.hats[p];
                        if (h) CreatureFX.pix(ctx, X + h.x, Y + h.y + (body === 18 ? 1 : 0), h.rows, h.pal);
                    }
                }]);
            }
        }
        const COLS = 8, ROWS = Math.ceil(cells.length / COLS);
        const face = tm.createCanvas('cfx_face', COLS * 32, ROWS * 32);
        const fctx = face.getContext();
        cells.forEach(([name, paint], i) => {
            const X = (i % COLS) * 32, Y = Math.floor(i / COLS) * 32;
            paint(fctx, X, Y);
            face.add(name, 0, X, Y, 32, 32);
        });
        face.refresh();

        // the small sprites, packed in rows (a pixel of air between them), framed to their own size
        const B = Object.entries(A.bits), BW = 128, place = [];
        let bx = 0, by = 0, rowH = 0;
        for (const [name, b] of B) {
            const w = b.rows[0].length, h = b.rows.length;
            if (bx + w > BW) { bx = 0; by += rowH + 1; rowH = 0; }
            place.push([name, b, bx, by, w, h]);
            bx += w + 1; rowH = Math.max(rowH, h);
        }
        const bits = tm.createCanvas('cfx_bits', BW, by + rowH);
        const bctx = bits.getContext();
        for (const [name, b, X, Y, w, h] of place) {
            CreatureFX.pix(bctx, X, Y, b.rows, b.pal);
            bits.add(name, 0, X, Y, w, h);
        }
        bits.refresh();

        // the ice block, whole (a hard freeze) and cracked (a brittle cube)
        const IW = 26, IH = 21;
        const ice = tm.createCanvas('cfx_ice', IW * 2, IH);
        const ictx = ice.getContext();
        CreatureFX.paintIce(ictx, 0, 0, IW, IH, false);
        CreatureFX.paintIce(ictx, IW, 0, IW, IH, true);
        ice.add('ice', 0, 0, 0, IW, IH);
        ice.add('ice_cracked', 0, IW, 0, IW, IH);
        ice.refresh();
        return true;
    }

    // A block of ice, pixel by pixel: cut corners, a bright rim on the lit (top-left) edges and
    // a deeper one on the others, frosted toward the rim and clear in the middle so the slime
    // shows through, a slanted shine, a couple of faint facets. Cracked: white cracks with a
    // dark edge running in from three sides.
    static paintIce(ctx, X, Y, W, H, cracked) {
        const put = (x, y, rgb, a) => { ctx.fillStyle = `rgba(${rgb},${a})`; ctx.fillRect(X + x, Y + y, 1, 1); };
        const CUT = 3;
        for (let y = 0; y < H; y++) {
            for (let x = 0; x < W; x++) {
                const ex = Math.min(x, W - 1 - x), ey = Math.min(y, H - 1 - y);
                if (ex + ey < CUT) continue;                           // the cut corners
                const edge = Math.min(ex, ey, ex + ey - CUT);          // 0 on the outline
                const lit = x + y * 1.2 < (W + H * 1.2) * 0.45;
                let rgb, a;
                if (edge === 0) { rgb = lit ? '236,252,255' : '96,170,214'; a = 0.95; }
                else if (edge === 1) { rgb = lit ? '196,238,255' : '140,206,240'; a = 0.7; }
                else if (edge === 2) { rgb = '150,214,246'; a = 0.42; }
                else { rgb = '120,196,238'; a = 0.26; }
                const band = x - y * 0.9;                              // the shine, top left
                if (edge > 0 && band > W * 0.14 && band < W * 0.14 + 2.4 && y < H * 0.62) { rgb = '246,253,255'; a = 0.8; }
                const band2 = x - y * 0.9;                             // a thinner one beside it
                if (edge > 1 && band2 > W * 0.32 && band2 < W * 0.32 + 1 && y < H * 0.45) { rgb = '236,250,255'; a = 0.55; }
                put(x, y, rgb, a);
            }
        }
        // facets: two faint lines from the corners in
        ctx.fillStyle = 'rgba(220,246,255,0.35)';
        for (let i = 3; i < 9; i++) { ctx.fillRect(X + W - 1 - i, Y + H - 4 - Math.floor(i * 0.6), 1, 1); }
        if (!cracked) return;
        const crack = pts => {
            for (let i = 0; i < pts.length - 1; i++) {
                let [x0, y0] = pts[i]; const [x1, y1] = pts[i + 1];
                const n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0));
                for (let k = 0; k <= n; k++) {
                    const x = Math.round(x0 + (x1 - x0) * k / n), y = Math.round(y0 + (y1 - y0) * k / n);
                    ctx.fillStyle = 'rgba(255,255,255,0.95)'; ctx.fillRect(X + x, Y + y, 1, 1);
                    ctx.fillStyle = 'rgba(40,80,120,0.55)'; ctx.fillRect(X + x + 1, Y + y, 1, 1);
                }
            }
        };
        crack([[2, 7], [6, 9], [8, 13], [12, 14]]);
        crack([[W - 3, 4], [W - 7, 7], [W - 9, 6]]);
        crack([[W - 6, H - 2], [W - 8, H - 6], [W - 12, H - 7]]);
        crack([[11, 2], [12, 5], [10, 7]]);
    }

    // Stops a game object drawing without touching anything the game reads or writes on it:
    // position, alpha, scale, visibility, tweens and destroy all keep working. Containers stop
    // drawing their children too.
    static mute(o) {
        if (!o || o._cfxMuted || typeof o.renderWebGL !== 'function' && typeof o.renderCanvas !== 'function') return o;
        o._cfxMuted = true;
        o.renderWebGL = CreatureFX._noop;
        o.renderCanvas = CreatureFX._noop;
        return o;
    }
    static _noop() {}

    // Tinted slimes keep their colour. Whatever tint a creature's maker gives it before its first
    // frame is its own (createEnemy wraps the sprite, the maker tints it, _cfxDress settles it).
    // After that, clearTint (a hit flash ending, a burn, a freeze, a soak or a daze wearing off)
    // and setTint(white) put that colour back: they used to leave the slime plain white, so a
    // tinted type turned into a red slime the first time you hit it. `base` dresses a sprite
    // that is already settled, with the colour it has now.
    // ── ULT ARMOUR ───────────────────────────────────────────────────────────
    // While a fire, ice or lightning ult runs, the slime wears its element (cosmic has its own, Cosmic.js):
    //   fire       magma armour: cooled basalt over the body, lava glowing through its cracks, embers rising
    //   ice        frost mail: a shell of pale ice, crystal spikes along its back, rime glinting
    //   lightning  storm plate: dark steel, arcs crawling over it, now and then a spark jumping off
    // Layers copy the player's frame every tick (so they move and squash with it), and come off at `ms`.
    // The ult's armour on the slime while the ult runs: the body recoloured as a shell, a rim of the element's light,
    // and a form drawn over it every frame (u, v are fractions of the slime's frame; its body is the lower part):
    //   fire       Magma Armor: obsidian plates split by a network of lava seams pulsing like a heartbeat, a crown
    //              of flame tongues, lava dripping off it, heat on the floor, embers rising
    //   ice        Ice King: a clear ice shell, a faceted crystal crown, rime round its edge, a cape of shards trailing
    //              behind it, snowflakes circling, cold mist at its feet
    //   lightning  Lightning God: a storm-dark plate etched with glowing circuits, a crackling halo with nodes over it,
    //              eyes alight, arcs crawling, now and then a bolt from the halo to the ground
    // `target`: another creature's sprite to wear it instead (an Ult Absorber with an ult it stole): a partial suit, the shell
    // thinner, no rune circle or screen wash, and cosmic gets one too (a void shell, stars circling).
    static ultArmor(scene, el, ms, target = null) {
        const p = target || scene.player, part = !!target, holder = part ? target : scene;
        if (!p?.active || !['fire', 'ice', 'lightning', ...(part ? ['cosmic'] : [])].includes(el)) return;
        holder._ultArmor?.end?.();
        const ADD = Phaser.BlendModes.ADD;
        const K = { fire: { tint: 0x1e100c, a: 0.9, rim: 0xff7a2a, ra: 0.5, floor: 0xff5a1a }, ice: { tint: 0x9ad8ff, a: 0.55, rim: 0xffffff, ra: 0.5, floor: 0x9ad8ff }, cosmic: { tint: 0x1a0a2e, a: 0.85, rim: 0xb47cff, ra: 0.55, floor: 0x9966ff }, lightning: { tint: 0x1a1a34, a: 0.82, rim: 0xffe14a, ra: 0.55, floor: 0xffe14a } }[el];
        const shell = scene.add.sprite(p.x, p.y, p.texture.key, p.frame.name).setTintFill(K.tint);
        const rim = scene.add.sprite(p.x, p.y, p.texture.key, p.frame.name).setTintFill(K.rim).setBlendMode(ADD);
        const floor = scene.textures.exists('vfx_glow') ? scene.add.image(p.x, p.y, 'vfx_glow').setTint(K.floor).setBlendMode(ADD) : null;
        const back = scene.add.graphics(), g = scene.add.graphics(), glow = scene.add.graphics().setBlendMode(ADD), t0 = scene.time.now, fw = p.frame.width, fh = p.frame.height;
        // its aura: a rune circle of the element turning on the floor under it, and the screen's edges washed in its colour
        const runes = scene.add.graphics().setBlendMode(ADD), edge = scene.add.graphics().setScrollFactor(0).setDepth(19).setBlendMode(ADD);
        { const W = scene.scale.width, H = scene.scale.height; for (let k = 0; k < 14; k++) { const a = 0.05 * (1 - k / 14); edge.fillStyle(K.rim, a); edge.fillRect(0, k * 6, W, 6); edge.fillRect(0, H - (k + 1) * 6, W, 6); edge.fillRect(k * 6, 0, 6, H); edge.fillRect(W - (k + 1) * 6, 0, 6, H); } }
        scene._vfxSort?.(edge);
        if (part) { edge.setVisible(false); runes.setVisible(false); }
        let pulseAt = t0;
        const R = (seed => () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296))(el.length * 7919);
        // the lava seams / circuits: a few branching paths over the body, fixed for the whole ult
        // kept inside the body: its top edge at u is about bodyTop(u) (a dome), its bottom at 0.97
        const bodyTop = u => 0.7 + 0.25 * ((u - 0.5) / 0.32) ** 2, inBody = ([u, v]) => [Math.max(0.22, Math.min(0.78, u)), Math.max(bodyTop(Math.max(0.22, Math.min(0.78, u))) + 0.03, Math.min(0.95, v))];
        const seams = Array.from({ length: 3 }, (_, k) => { const v0 = 0.8 + k * 0.055, pts = []; for (let j = 0; j <= 5; j++) pts.push(inBody([0.26 + j * 0.096, v0 + (R() - 0.5) * 0.06])); return pts; })
            .concat(Array.from({ length: 3 }, () => { const u = 0.33 + R() * 0.34; return [inBody([u, 0.8]), inBody([u + (R() - 0.5) * 0.06, 0.86]), inBody([u + (R() - 0.5) * 0.08, 0.93])]; }));   // the long cracks, and short ones joining them
        const circuit = Array.from({ length: 3 }, (_, k) => { const v = 0.81 + k * 0.05, u0 = 0.3 + R() * 0.05, u1 = 0.66 + R() * 0.05, um = (u0 + u1) / 2; return [inBody([u0, v]), inBody([um, v]), inBody([um + 0.04, v - 0.04]), inBody([u1, v - 0.04])]; });
        const flakes = Array.from({ length: 6 }, (_, k) => ({ a: k / 6 * Math.PI * 2, r: 0.9 + R() * 0.3, s: 0.6 + R() * 0.5 }));
        let arcs = [], arcAt = 0, boltAt = t0 + 400;
        const tick = () => {
            const now = scene.time.now, life = (now - t0) / ms, tt = now - t0;
            if (!shell.active || !rim.active) { scene.events.off('postupdate', tick); if (holder._ultArmor === A) holder._ultArmor = null; return; }   // destroyed under it (ended mid-frame, or a floor change / death: scene events outlive the objects). It used to throw here, and a throw in a Phaser step ends the game loop for good
            if (!p.active || life >= 1) return A.end();
            const fade = Math.min(1, (now - t0) / 200, (ms - (now - t0)) / 300), d = p.depth ?? 1, sx = p.scaleX, sy = p.scaleY, vis = p.visible, al = (p.alpha ?? 1) * fade;
            for (const [o, ds, a, k] of [[shell, 0.0004, K.a * (part ? 0.6 : 1), 1], [rim, -0.01, K.ra * (0.7 + 0.3 * Math.sin(now * (el === 'lightning' ? 0.05 : 0.01))), 1.12]])
                o.setTexture(p.texture.key, p.frame.name).setPosition(p.x, p.y).setOrigin(p.originX, p.originY).setScale(sx * k, sy * k).setFlipX(p.flipX).setDepth(d + ds).setAlpha(a * al).setVisible(vis);
            const ox = fw * p.originX, oy = fh * p.originY, px = Math.max(1, Math.abs(sx)), dir = p.flipX ? -1 : 1;
            const wx = u => p.flipX ? p.x + (ox - u * fw) * Math.abs(sx) : p.x + (u * fw - ox) * Math.abs(sx), wy = v => p.y + (v * fh - oy) * Math.abs(sy);
            const cx = wx(0.5), top = wy(0.6), feet = wy(1.0), W = fw * Math.abs(sx) * 0.42;
            if (floor) floor.setPosition(cx, feet - px * 2).setDisplaySize(W * 3.2, W * 1.1).setDepth(d - 0.02).setAlpha((0.35 + 0.15 * Math.sin(now * 0.006)) * al).setVisible(vis);
            for (const o of [back, g, glow]) o.clear().setAlpha(al).setVisible(vis);
            // the rune circle: two rings, the element's glyph-marks between them, turning; a pulse ring out every half second
            runes.clear().setDepth(d - 0.03).setAlpha(al * (0.75 + 0.25 * Math.sin(now * 0.006))).setVisible(vis && !part);
            const rx = W * 2.1, ry = W * 0.75, rot = tt * 0.0012, rc = K.rim;
            runes.lineStyle(px * 1.2, rc, 0.8); runes.strokeEllipse(cx, feet, rx * 2, ry * 2); runes.lineStyle(px * 0.8, rc, 0.5); runes.strokeEllipse(cx, feet, rx * 1.6, ry * 1.6);
            for (let k = 0; k < 8; k++) {
                const a = rot + k / 8 * Math.PI * 2, mx = cx + Math.cos(a) * rx * 0.9, my = feet + Math.sin(a) * ry * 0.9, s2 = px * 1.6;
                runes.lineStyle(px * 0.9, rc, 0.9);
                if (el === 'fire') { runes.lineBetween(mx, my - s2, mx - s2 * 0.7, my + s2 * 0.5); runes.lineBetween(mx, my - s2, mx + s2 * 0.7, my + s2 * 0.5); }
                else if (el === 'ice') { runes.lineBetween(mx - s2, my, mx + s2, my); runes.lineBetween(mx, my - s2 * 0.6, mx, my + s2 * 0.6); }
                else { runes.lineBetween(mx - s2 * 0.4, my - s2 * 0.6, mx + s2 * 0.2, my); runes.lineBetween(mx + s2 * 0.2, my, mx - s2 * 0.2, my + s2 * 0.6); }
            }
            for (let k = 0; k < 3; k++) { const a = -rot * 1.6 + k / 3 * Math.PI * 2; runes.lineBetween(cx + Math.cos(a) * rx * 0.8, feet + Math.sin(a) * ry * 0.8, cx + Math.cos(a + 2.094) * rx * 0.8, feet + Math.sin(a + 2.094) * ry * 0.8); }   // a triangle turning the other way
            edge.setAlpha(fade * (0.75 + 0.25 * Math.sin(now * 0.004)));
            if (!part && now - pulseAt > 520) {
                pulseAt = now;
                const ring = scene.add.ellipse(cx, feet, rx * 0.6, ry * 0.6).setStrokeStyle(px * 1.2, rc, 0.9).setBlendMode(ADD).setDepth(d - 0.03);
                scene.tweens.add({ targets: ring, scale: 2.6, alpha: 0, duration: 650, ease: 'Quad.easeOut', onComplete: () => ring.destroy() });
            }
            if (!part && Math.random() < 0.35) {   // motes of its light rising off the circle
                const a = Math.random() * Math.PI * 2, m = scene.add.rectangle(cx + Math.cos(a) * rx * 0.9, feet + Math.sin(a) * ry * 0.9, px * 1.2, px * 2.4, rc).setBlendMode(ADD).setDepth(d + 0.01);
                scene.tweens.add({ targets: m, y: m.y - 26 - Math.random() * 20, alpha: 0, duration: 700 + Math.random() * 300, onComplete: () => m.destroy() });
            }
            back.setDepth(d - 0.005); g.setDepth(d + 0.0007); glow.setDepth(d + 0.0009);
            const poly = (G, pts, w, c, a) => { G.lineStyle(w, c, a); G.beginPath(); pts.forEach(([u, v], k) => (k ? G.lineTo(wx(u), wy(v)) : G.moveTo(wx(u), wy(v)))); G.strokePath(); };
            if (el === 'fire') {
                const beat = Math.pow(0.5 + 0.5 * Math.sin(now * 0.009), 3);   // a heartbeat in the magma
                for (const S of seams) { poly(g, S, px * 2.4, 0x140806, 0.9); poly(glow, S, px * 1.8, 0xff4a12, 0.6 + 0.4 * beat); poly(glow, S, px * 0.8, 0xffe08a, 0.4 + 0.6 * beat); }
                for (let k = 0; k < 7; k++) {   // the crown: tongues of flame, flickering
                    const u = 0.3 + k * 0.067, x = wx(u), h = (6 + 5 * Math.sin(now * 0.02 + k * 1.7) * 0.5 + (k === 3 ? 5 : 0)) * px * 0.7, w = px * 1.8;
                    glow.fillStyle(0xff5a1a, 0.85); glow.fillTriangle(x - w, top + px, x + Math.sin(now * 0.015 + k) * px, top - h, x + w, top + px);
                    glow.fillStyle(0xffe08a, 0.9); glow.fillTriangle(x - w * 0.45, top + px, x + Math.sin(now * 0.015 + k) * px * 0.6, top - h * 0.55, x + w * 0.45, top + px);
                }
                if (Math.random() < 0.12) { const u = 0.25 + Math.random() * 0.5, x = wx(u), y = wy(0.97), dr = scene.add.rectangle(x, y, px * 1.4, px * 2, 0xff6a1a).setDepth(d + 0.02).setBlendMode(ADD); scene.tweens.add({ targets: dr, y: y + 10, scaleY: 1.8, alpha: 0, duration: 500, ease: 'Quad.easeIn', onComplete: () => dr.destroy() }); }   // lava dripping off it
                if (Math.random() < 0.3) { const e = scene.add.rectangle(wx(0.25 + Math.random() * 0.5), top + Math.random() * W * 0.4, px * 1.4, px * 1.4, Math.random() < 0.5 ? 0xffb040 : 0xff5a1a).setDepth(d + 0.02).setBlendMode(ADD); scene.tweens.add({ targets: e, y: e.y - 16 - Math.random() * 12, x: e.x + (Math.random() - 0.5) * 8, alpha: 0, duration: 700, onComplete: () => e.destroy() }); }   // embers
            } else if (el === 'ice') {
                for (let k = 0; k < 6; k++) {   // the cape: shards trailing behind it, swaying
                    const a = Math.PI / 2 + dir * (0.6 + k * 0.18), L = W * (0.7 + k * 0.1), sw = Math.sin(now * 0.004 + k) * 0.08;
                    const bx = cx - dir * W * 0.6, by = top + W * 0.4, tx = bx + Math.cos(a + sw) * L * -dir * 0.6 - dir * k * px * 2, ty = by + Math.sin(a + sw) * L * 0.5;
                    back.fillStyle(k % 2 ? 0x9ad8ff : 0xd8f4ff, 0.75); back.fillTriangle(bx, by - px * 2, tx, ty, bx - dir * px * 3, by + px * 3);
                }
                const crown = [[0.3, 6], [0.38, 9], [0.46, 7], [0.5, 14], [0.54, 7], [0.62, 9], [0.7, 6]];   // the crown: crystal spires, the middle tallest
                for (const [u, hh] of crown) {
                    const x = wx(u), h = hh * px * 0.75, w = px * 1.7, glint = Math.max(0, Math.sin(now * 0.005 - u * 8));
                    g.fillStyle(0x5aa8e8, 0.95); g.fillTriangle(x - w, top + px, x, top - h, x + w, top + px);
                    g.fillStyle(0xd8f4ff, 0.95); g.fillTriangle(x - w, top + px, x, top - h, x, top + px);
                    g.fillStyle(0xffffff, 0.5 + 0.5 * glint); g.fillRect(x - px * 0.4, top - h * 0.8, px * 0.7, h * 0.45);
                }
                g.fillStyle(0xbfe8ff, 0.9); g.fillRect(wx(0.28), top, W * 0.95, px * 1.4);   // its band
                for (const q of flakes) {   // snowflakes circling it
                    const a = q.a + tt * 0.0012 * q.s, x = cx + Math.cos(a) * W * 1.3 * q.r, y = top + W * 0.4 + Math.sin(a) * W * 0.45 * q.r, z = Math.sin(a) > 0;
                    const G = z ? glow : back; G.lineStyle(px * 0.8, 0xffffff, 0.9); for (let k = 0; k < 3; k++) { const b = k * Math.PI / 3 + tt * 0.002; G.lineBetween(x - Math.cos(b) * px * 2, y - Math.sin(b) * px * 2, x + Math.cos(b) * px * 2, y + Math.sin(b) * px * 2); }
                }
                if (Math.random() < 0.1) { const m = scene.add.circle(cx + (Math.random() - 0.5) * W * 2.4, feet, px * 1.5, 0xe8f8ff, 0.16).setDepth(d - 0.01); scene.tweens.add({ targets: m, x: m.x + (Math.random() - 0.5) * 16, scale: 2.2, alpha: 0, duration: 1100, onComplete: () => m.destroy() }); }   // a thin cold mist
            } else if (el === 'cosmic') {
                for (let k = 0; k < 5; k++) {   // stars circling it, the far ones behind
                    const a = k / 5 * Math.PI * 2 + tt * 0.002, x = cx + Math.cos(a) * W * 1.2, y = top + W * 0.4 + Math.sin(a) * W * 0.4, G = Math.sin(a) > 0 ? glow : back;
                    G.fillStyle(k % 2 ? 0xe0c8ff : 0xb47cff, 0.95); G.fillRect(x - px, y - px * 2.2, px * 2, px * 4.4); G.fillRect(x - px * 2.2, y - px, px * 4.4, px * 2);
                }
            } else {
                const hy = top - W * 0.55 + Math.sin(now * 0.004) * px;   // the halo, over it
                glow.lineStyle(px * 1.6, 0xffe14a, 0.9); glow.strokeEllipse(cx, hy, W * 1.5, W * 0.45);
                glow.lineStyle(px * 0.7, 0xffffff, 0.8); glow.strokeEllipse(cx, hy, W * 1.5, W * 0.45);
                for (let k = 0; k < 6; k++) { const a = k / 6 * Math.PI * 2 + tt * 0.004; glow.fillStyle(0xfff6c0, 1); glow.fillCircle(cx + Math.cos(a) * W * 0.75, hy + Math.sin(a) * W * 0.22, px * (Math.sin(a) > 0 ? 1.3 : 0.9)); }
                for (const C of circuit) { poly(g, C, px * 1.6, 0x0a0a1a, 0.9); poly(glow, C, px * 0.8, 0xffe14a, 0.55 + 0.45 * Math.sin(now * 0.02 + C[0][1] * 40)); }   // circuits
                for (const u of [0.38, 0.62]) { glow.fillStyle(0xfff6a0, 0.9); glow.fillCircle(wx(u), wy(0.78), px * 1.5); glow.fillStyle(0xffffff, 1); glow.fillCircle(wx(u), wy(0.78), px * 0.7); }   // eyes alight
                if (now > arcAt) { arcAt = now + 70; arcs = Array.from({ length: 3 }, () => [[0.2 + Math.random() * 0.6, 0.68 + Math.random() * 0.28], [0.2 + Math.random() * 0.6, 0.68 + Math.random() * 0.28]]); }
                for (const [a, b] of arcs) { glow.lineStyle(px * 1.1, 0xfff6a0, 1); glow.beginPath(); glow.moveTo(wx(a[0]), wy(a[1])); for (let k = 1; k <= 4; k++) glow.lineTo(wx(a[0] + (b[0] - a[0]) * k / 4) + (Math.random() - 0.5) * 3 * px, wy(a[1] + (b[1] - a[1]) * k / 4) + (Math.random() - 0.5) * 3 * px); glow.strokePath(); }
                if (!part && now > boltAt) {   // a bolt from the halo to the ground beside it
                    boltAt = now + 500 + Math.random() * 600;
                    const gx = cx + (Math.random() < 0.5 ? -1 : 1) * W * (1 + Math.random()), bolt = scene.add.graphics().setDepth(d + 0.03).setBlendMode(ADD);
                    let bx = cx + (gx > cx ? 1 : -1) * W * 0.6, by = hy; bolt.lineStyle(px * 1.4, 0xfff6a0, 1); bolt.beginPath(); bolt.moveTo(bx, by);
                    for (let k = 1; k <= 5; k++) { bx += (gx - bx) / (6 - k) + (Math.random() - 0.5) * 6; by += (feet - by) / (6 - k); bolt.lineTo(bx, by); } bolt.strokePath();
                    scene._vfxFlash?.(gx, feet, 26, 0xffe14a, 140, 0.6);
                    scene.tweens.add({ targets: bolt, alpha: 0, duration: 160, onComplete: () => bolt.destroy() });
                }
            }
        };
        const A = holder._ultArmor = { el, end: () => { scene.events.off('postupdate', tick); for (const o of [shell, rim, back, g, glow, floor, runes]) o?.destroy(); if (edge.active) scene.tweens.add({ targets: edge, alpha: 0, duration: 300, onComplete: () => edge.destroy() }); if (holder._ultArmor === A) holder._ultArmor = null; } };
        scene.events.on('postupdate', tick); scene.events.once('shutdown', A.end);   // after the scene's own update, where the step glide moves the slime: on 'update' it trailed a frame behind, the slime's blue showing at its edge
        tick();
        // putting it on: a flash of the element over the slime, and a ring out across the floor
        const flash = scene.add.sprite(p.x, p.y, p.texture.key, p.frame.name).setOrigin(p.originX, p.originY).setScale(p.scaleX * 1.3, p.scaleY * 1.3).setFlipX(p.flipX).setTintFill(K.rim).setBlendMode(ADD).setDepth((p.depth ?? 1) + 0.03).setAlpha(0.9);
        scene.tweens.add({ targets: flash, scaleX: p.scaleX, scaleY: p.scaleY, alpha: 0, duration: 320, onComplete: () => flash.destroy() });
        const ring = scene.add.ellipse(p.x, p.y + 10, 20, 8).setStrokeStyle(2, K.rim, 1).setBlendMode(ADD).setDepth((p.depth ?? 1) - 0.01);
        scene.tweens.add({ targets: ring, scale: 6, alpha: 0, duration: 560, ease: 'Quad.easeOut', onComplete: () => ring.destroy() });
        if (part) return;
        const pillar = scene.add.rectangle(p.x, p.y - 60, 26, 160, K.rim, 0.55).setBlendMode(ADD).setDepth((p.depth ?? 1) + 0.04);
        scene.tweens.add({ targets: pillar, scaleX: 0.1, alpha: 0, duration: 520, ease: 'Quad.easeIn', onComplete: () => pillar.destroy() });   // a column of its light, collapsing onto it
        scene.cameras.main.shake(180, 0.006);
    }
    // A status colour (burning, say) laid over the enemy's own tint rather than replacing it: a Rooter on fire stays a Rooter.
    static tintOver(sprite, col, k = 0.55) {
        const b = sprite?._cfxTint?.base;
        sprite?.setTint?.(b == null ? col : MenuArt.mix(b, col, k));
    }
    static keepTint(sprite, base) {
        if (!sprite || sprite._cfxTint) return;
        const P = Object.getPrototypeOf(sprite), setTint = P.setTint, clearTint = P.clearTint;
        if (typeof setTint !== 'function' || typeof clearTint !== 'function') return;
        const k = sprite._cfxTint = { base: base ?? null, settled: base !== undefined };
        sprite.setTint = function (c, ...more) {
            const white = c === undefined || c === 0xffffff;
            if (!k.settled) k.base = white ? null : c;
            else if (white && !more.length && k.base != null) return setTint.call(this, k.base);
            return setTint.call(this, c, ...more);
        };
        sprite.clearTint = function () {
            clearTint.call(this);
            if (k.base != null) setTint.call(this, k.base);
            return this;
        };
    }

    // A ring and a few sparks where a piece of loot was picked up (from _cfxPuppetSync).
    static pickupPop(scene, x, y, col) {
        if (!scene.textures.exists('vfx_ring')) return;
        const ADD = Phaser.BlendModes.ADD;
        const r = scene.add.image(x, y, 'vfx_ring').setTint(col).setBlendMode(ADD).setScale(0.12).setAlpha(0.95).setDepth(4.2);
        scene._vfxSort?.(r);
        scene.tweens.add({ targets: r, scale: 0.55, alpha: 0, duration: 280, ease: 'Quad.easeOut', onComplete: () => r.destroy() });
        if (!scene.textures.exists('cfx_bits')) return;
        for (let i = 0; i < 5; i++) {
            const a = i / 5 * Math.PI * 2 + Math.random() * 0.6, d = 10 + Math.random() * 8;
            const st = scene.add.image(x, y, 'cfx_bits', 'star').setTint(i % 2 ? 0xffffff : col).setBlendMode(ADD).setDepth(4.2);
            scene._vfxSort?.(st);
            scene.tweens.add({ targets: st, x: x + Math.cos(a) * d, y: y + Math.sin(a) * d - 4, scale: 0.2, alpha: 0,
                duration: 320 + Math.random() * 120, ease: 'Quad.easeOut', onComplete: () => st.destroy() });
        }
    }

    // ── WHAT YOU HOLD ────────────────────────────────────────────────────────
    // The weapon you have out, drawn on you: its shop icon (Menus.js), idling, held the way its
    // kind is held. Fists float at both sides and the near one jabs; blades rest raised and swing
    // through your aim; guns and wands point where you aim and kick back; staffs stand at your
    // side and lean in; orbs hover at your shoulder. A new weapon or element swaps in with a pop.
    // `art` is the icon's own direction (radians, 0 = right) and where the hand is on it.
    static GEAR() {
        if (CreatureFX._gear) return CreatureFX._gear;
        const fists = { type: 'fists', s: 0.47 }, punch = { type: 'punch', s: 0.47, art: 0, ox: 0.5, oy: 0.5 };
        const blade = { type: 'blade', s: 0.64, art: -Math.PI / 4, ox: 0.2, oy: 0.8 };
        const staff = { type: 'staff', s: 0.64, art: -Math.PI / 2, ox: 0.5, oy: 0.72 };
        const wand = { type: 'gun', s: 0.6, art: -Math.PI / 4, ox: 0.25, oy: 0.78 };
        return (CreatureFX._gear = {
            flame_fists: fists, ice_fists: fists, lightning_fists: punch, cosmic_fists: punch,
            flame_sword: blade, void_blade: blade,
            magma_staff: staff, barrier_staff: staff, singularity_staff: staff,
            ignition: { type: 'gun', s: 0.6, art: 0, ox: 0.28, oy: 0.55 }, icicle_cannon: wand, orb_emitter: wand, conductor: staff,
            ball_lightning: { type: 'orb', s: 0.48 }, astrolabe: { type: 'orb', s: 0.52, spin: 0.0012 }, fractal_shard: { type: 'orb', s: 0.52 },
        });
    }
    // The far end of the weapon in your hand (a staff's head), in world space, or null: where a cast leaves from.
    static gearTip(scene) {
        const G = scene._cfxGearState, M = G?.main;
        if (!M?.active || !M.visible || G.ang == null) return null;
        const L = Math.max(M.displayWidth, M.displayHeight) * 0.72;
        return { x: M.x + Math.cos(G.ang) * L, y: M.y + Math.sin(G.ang) * L };
    }
    static gear(scene, now) {
        const p = scene.player;
        let G = scene._cfxGearState;
        if (G && (!G.main?.active || G.main.scene !== scene)) G = scene._cfxGearState = null;   // the scene restarted
        const id = scene.equippedWeapons?.[scene.currentElement];
        const def = CreatureFX.GEAR()[id];
        const key = def && typeof MenuArt !== 'undefined' ? MenuArt.iconSheet(scene, id) : null;
        const show = !!(p?.active && key && p.visible !== false && (p.alpha ?? 1) > 0.05 && !scene._deathScreenActive && !(scene._iceShellUntil > scene.time.now) && !scene._tutFalling);   // (hidden while the ice ult encases you)
        if (!show) { if (G) { G.main.setVisible(false); G.off.setVisible(false); } return; }
        if (!G) {
            const mk = () => scene.add.sprite(p.x, p.y, key, '0');
            G = scene._cfxGearState = { main: mk(), off: mk(), id: null, kick: 0, swapAt: 0, ang: null, was: false, heldAt: 0 };
        }
        if (G.id !== id) {
            G.id = id; G.swapAt = now; G.ang = null;
            for (const o of [G.main, G.off]) { o.setTexture(key, '0'); o.play(key); o.setRotation(0).setFlip(false, false).setOrigin(0.5, 0.5); }
        }
        // where you aim, and the kick: each time the weapon actually attacks (the attack marks
        // scene._gearFiredAt once its own cooldown lets it through), so the motion runs at that
        // weapon's real rate rather than on one timer for all of them. Fists take turns.
        const ptr = scene.input?.activePointer, cam = scene.cameras.main;
        let ax = scene._cfxAimX ?? p.x + 1, ay = p.y;
        if (ptr && scene._aim) { const a = scene._aim(ptr); ax = a.x + cam.scrollX; ay = a.y + cam.scrollY; }
        if (scene._gearFiredAt && scene._gearFiredAt !== G.firedAt) {
            G.firedAt = scene._gearFiredAt; G.kick = 1; G.hand = G.hand ? 0 : 1;
        }
        G.kick = Math.max(0, G.kick - (scene.game?.loop?.delta || 16) / 170);
        // the slime's body is the lower part of its frame: its middle is 13px below the sprite's
        const by = p.y + 13 * Math.abs((p.scaleY || 1.2) / 1.2);
        const th = Math.atan2(ay - by, ax - p.x), right = Math.cos(th) >= 0, dir = right ? 1 : -1, k = G.kick;
        const pop = Math.min(1, (now - G.swapAt) / 200), grow = 1 - Math.pow(1 - pop, 3);
        const S = def.s * (0.3 + 0.7 * grow) * (1 + (1 - grow) * 0.4);
        const bob = Math.sin(now * 0.005), z = (p.depth ?? 1) + 0.02, al = p.alpha ?? 1;
        const M = G.main, O = G.off;
        const turn = (from, to, f) => from == null ? to : from + (Math.atan2(Math.sin(to - from), Math.cos(to - from))) * f;
        // point the art (direction `def.art`) along angle `a`; on your left it is mirrored, so it reads the same way up
        const aim = (o, a, x, y) => {
            const art = def.art ?? 0;
            o.setFlip(!right, false).setOrigin(right ? def.ox : 1 - def.ox, def.oy);
            o.setRotation(right ? a - art : a - (Math.PI - art)).setPosition(x, y);
        };
        M.setVisible(true).setAlpha(al).setScale(S); O.setAlpha(al).setScale(S);
        if (def.type === 'fists' || def.type === 'punch') {
            // Two fists, one each side; they take turns: each punch throws the other one.
            O.setVisible(true);
            const near = { x: p.x + dir * 13, y: by + bob }, far = { x: p.x - dir * 13, y: by - bob };
            const jabber = G.hand ? O : M, rest = G.hand ? M : O, from = G.hand ? far : near, home = G.hand ? near : far;
            const reach = 7 * k + (G.hand ? 10 * k : 0);   // the far fist has further to go
            const jx = from.x + Math.cos(th) * reach, jy = from.y + Math.sin(th) * reach;
            if (def.type === 'punch') {         // a side-on fist: it turns to punch where you aim
                G.ang = turn(G.ang, k > 0.02 ? th : (right ? 0 : Math.PI), k > 0.02 ? 0.6 : 0.2);
                aim(jabber, G.ang, jx, jy);
                aim(rest, right ? 0 : Math.PI, home.x, home.y);
            } else {
                jabber.setRotation(0).setOrigin(0.5).setFlip(!right, false).setPosition(jx, jy);
                rest.setRotation(0).setOrigin(0.5).setFlip(right, false).setPosition(home.x, home.y);
            }
            jabber.setDepth(z); rest.setDepth(z - 0.04);
            CreatureFX._gearAura(scene, G, id, now, jabber);
            return;
        }
        O.setVisible(false);
        if (def.type === 'blade') {             // rests raised; a click swings it back and through your aim
            const rest = right ? -1.05 : -Math.PI + 1.05;
            const target = k > 0.02 ? th - dir * 1.5 * (k - 0.35) : rest;
            G.ang = turn(G.ang, target, k > 0.02 ? 0.55 : 0.18);
            aim(M, G.ang, p.x + dir * 9, by + 2 + bob * 0.6);
        } else if (def.type === 'staff') {      // stands at your side, leans toward your aim
            const lean = -Math.PI / 2 + dir * 0.14 + (Math.atan2(Math.sin(th + Math.PI / 2), Math.cos(th + Math.PI / 2))) * (0.18 + 0.35 * k);
            G.ang = turn(G.ang, lean, 0.25);
            aim(M, G.ang, p.x + dir * 12, by + 3 + bob);
        } else if (def.type === 'gun') {        // points where you aim, kicks back
            G.ang = turn(G.ang, th, 0.4);
            const back = 3.5 * k;
            aim(M, G.ang, p.x + dir * 8 - Math.cos(th) * back, by + 2 + bob * 0.5 - Math.sin(th) * back);
        } else {                                // hovers at your shoulder
            const lift = 4 * k;
            M.setOrigin(0.5).setFlip(false, false).setRotation(def.spin ? now * def.spin : 0)
                .setPosition(p.x + dir * 14 + Math.cos(th) * lift, by - 10 + bob * 2 + Math.sin(th) * lift).setScale(S * (1 + 0.25 * k));
        }
        M.setDepth(Math.sin(th) < -0.55 && def.type !== 'orb' ? z - 0.04 : z);   // aimed up: behind you
        CreatureFX._gearAura(scene, G, id, now, M);
    }

    // The held weapon's aura (Enchants.js): none until it's enchanted, then a glow in its best
    // book's colour that grows and pulses harder with each enchant, sparkling from two up.
    static _gearAura(scene, G, id, now, M) {
        const on = typeof Enchants !== 'undefined' ? Enchants.on(id) : [], n = on.length;
        if (G.auraId !== id) {   // a different weapon: build its aura afresh
            G.aura?.destroy(); G.auraMotes?.destroy(); G.auraOrbit?.destroy(); G.auraHalo?.destroy(); G.aura = G.auraMotes = G.auraOrbit = G.auraHalo = null; G.auraId = id;
            if (n && scene.textures.exists('vfx_glow')) {
                const corrupt = Enchants.corrupted(id), top = Math.max(...on.map(b => Enchants.def(b.id).r)), col = corrupt ? 0x7aff5a : top ? Enchants.RARITY[top].col : 0xb48aff;   // Common: enchant violet, as in the menus
                G.aura = scene.add.image(M.x, M.y, 'vfx_glow').setTint(corrupt ? 0x10001a : col);   // corrupted: a dark aura, not a glow
                if (!corrupt) G.aura.setBlendMode(Phaser.BlendModes.ADD);
                G.auraCorrupt = corrupt;
                G.auraCols = on.map(b => { const r = Enchants.def(b.id).r; return corrupt && r === 5 ? 0x7aff5a : r ? Enchants.RARITY[r].col : 0xb48aff; });
                G.auraOrbit = scene.add.graphics().setBlendMode(Phaser.BlendModes.ADD);   // a spark per enchant, circling the weapon
                G.auraHalo = scene.add.sprite(M.x, M.y, M.texture.key, M.frame.name).setTintFill(corrupt ? 0x10001a : col);   // the weapon's own outline, glowing
                if (!corrupt) G.auraHalo.setBlendMode(Phaser.BlendModes.ADD);
                if (n >= 2 || corrupt) G.auraMotes = scene.add.particles(0, 0, 'vfx_glow', { follow: M, followOffset: { x: 0, y: 0 }, lifespan: 600, speed: { min: 6, max: 22 },
                    scale: { start: 0.05 + n * 0.01, end: 0 }, alpha: { start: 0.9, end: 0 }, tint: corrupt ? [0x7aff5a, 0xff3aa0] : [col, 0xffffff], blendMode: 'ADD', frequency: corrupt ? 70 : 260 - n * 60 });
                G.auraN = n;
            }
        }
        if (!G.aura) return;
        const pulse = 0.5 + 0.5 * Math.sin(now * (0.004 + G.auraN * 0.0015));
        G.aura.setPosition(M.x, M.y).setVisible(M.visible).setDepth(M.depth - 0.01)
            .setScale(0.32 + G.auraN * 0.1 + pulse * 0.04 * G.auraN).setAlpha((G.auraCorrupt ? (Math.random() < 0.08 ? 0.35 : 0.85) : (0.45 + G.auraN * 0.12) * (0.75 + 0.25 * pulse)) * (M.alpha ?? 1));
        G.auraMotes?.setDepth(M.depth + 0.01).setVisible(M.visible);
        if (G.auraHalo) {
            const H = G.auraHalo;
            if (H.frame.name !== M.frame.name) H.setFrame(M.frame.name);
            H.setPosition(M.x, M.y).setOrigin(M.originX, M.originY).setRotation(M.rotation).setFlip(M.flipX, M.flipY)
             .setScale(M.scaleX * 1.18, M.scaleY * 1.18).setDepth(M.depth - 0.005).setVisible(M.visible)
             .setAlpha((G.auraCorrupt ? 0.8 : 0.35 + 0.12 * G.auraN + 0.15 * pulse) * (M.alpha ?? 1));
        }
        const o = G.auraOrbit;
        if (o) {
            o.clear().setDepth(M.depth + 0.02).setVisible(M.visible);
            const n = G.auraCols.length, r = 11 + n * 2, sp = now * (0.003 + n * 0.0008);
            G.auraCols.forEach((col, k) => {
                for (let tr = 0; tr < 4; tr++) {   // each spark trails three fading copies behind it
                    const a = sp + k / n * Math.PI * 2 - tr * 0.22, px = M.x + Math.cos(a) * r, py = M.y + Math.sin(a) * r * 0.55;
                    o.fillStyle(tr ? col : 0xffffff, (tr ? 0.55 - tr * 0.13 : 0.95) * (M.alpha ?? 1));
                    o.fillRect(Math.round(px) - (tr ? 1 : 1.5), Math.round(py) - (tr ? 1 : 1.5), tr ? 2 : 3, tr ? 2 : 3);
                }
            });
        }
    }

    // ── FACES (any scene) ────────────────────────────────────────────────────
    // Gives a slime sprite eyes (and a hat): two images laid exactly over it, the same frame
    // size, origin, scale and position, so their pixels line up with its pixels whatever it is
    // doing. Synced after every update (postupdate), from the sprite: its idle frame, where it
    // is, how faded, squashed or cropped. Works on a sprite inside a container (the bosses).
    //   mood   'friend' (round eyes with a shine), 'angry' (brows down), 'kind' (tall soft eyes), 'calm' (flat lids) or 'sly' (slits)
    //   hat    a set name from art().sets, or null
    //   eye    a tint for the eyes ('angry' void types glow pink)
    //   look   a function giving the world x to look toward, or 'pointer'; default: the player
    static face(scene, sprite, o = {}) {
        if (!scene?.add || !sprite || !sprite.scene) return null;
        if (sprite._cfx) return sprite._cfx;
        if (!CreatureFX.sheets(scene)) return null;
        const cont = sprite.parentContainer || null;
        const mk = (frame) => {
            let img;
            if (cont) {
                img = scene.make.image({ x: sprite.x, y: sprite.y, key: 'cfx_face', frame }, false);
                cont.addAt(img, cont.getIndex(sprite) + 1);
            } else {
                // pinned or not, and how deep, before Visuals.js picks its camera
                img = scene.add.image(sprite.x, sprite.y, 'cfx_face', frame)
                    .setScrollFactor(sprite.scrollFactorX, sprite.scrollFactorY).setDepth((sprite.depth || 0) + 0.001);
                scene._vfxSort?.(img);
            }
            return img.setVisible(false);
        };
        const mood = CreatureFX.art().eyes[o.mood] ? o.mood : 'angry';
        const u = {
            s: sprite, mood, set: o.hat || null, eye: o.eye ?? 0xffffff, look: o.look,
            eyes: mk(`e_${mood}_0_c`), hat: null, expr: null, hidden: false,
            blinkAt: (scene.time?.now || 0) + 800 + Math.random() * 4000, blinkUntil: 0, lastLook: 'c',
        };
        if (u.eye !== 0xffffff) u.eyes.setTint(u.eye);
        if (u.set) u.hat = mk(`h_${u.set}_0`);
        sprite._cfx = u;
        (scene._cfxUnits || (scene._cfxUnits = [])).push(u);
        if (!scene._cfxSyncOn) {
            scene._cfxSyncOn = true;
            const sync = () => CreatureFX.sync(scene);
            scene.events.on('postupdate', sync);
            scene.events.once('shutdown', () => {
                scene.events.off('postupdate', sync);
                scene._cfxSyncOn = false;
                scene._cfxUnits = null;
            });
        }
        return u;
    }

    // A friendly slime that holds still for it: click it and it's booped (Achievements.BOOPS names them). Its click stops there
    // (the loading screen's own click would start the game).
    static boopable(scene, sprite, id) {
        if (!sprite?.setInteractive) return;
        sprite.setInteractive({ useHandCursor: true });
        sprite.on('pointerdown', (p, lx, ly, ev) => {
            ev?.stopPropagation?.();
            const r = sprite.getBounds();   // (from its body: a slime's frame has room above it)
            CreatureFX.boopFx(scene, r.centerX, r.y + r.height * 0.65, id, sprite.scrollFactorX);
            if (sprite._booping) return;
            sprite._booping = true;
            const sx = sprite.scaleX, sy = sprite.scaleY;   // a squish, and it squints
            scene.tweens.add({ targets: sprite, scaleX: sx * 1.25, scaleY: sy * 0.75, duration: 90, yoyo: true, ease: 'Quad.easeOut', onComplete: () => { sprite.setScale(sx, sy); sprite._booping = false; } });
            if (sprite._cfx) { sprite._cfx.expr = 'wince'; scene.time.delayedCall(350, () => { if (sprite._cfx) sprite._cfx.expr = null; }); }
        });
    }
    // a boop at (x, y): a squeak, a heart popping up off it; the first time for this one, it counts
    static boopFx(scene, x, y, id, sf = 0) {
        if (typeof Sfx !== 'undefined') { Sfx.play(scene, 'pop'); scene.time.delayedCall(60, () => Sfx.play(scene, 'giggle')); }
        const h = scene.add.text(x, y, '♥', { fontSize: '30px', fontFamily: 'monospace', fontStyle: 'bold', color: '#ff7ac0', stroke: '#2a0a1a', strokeThickness: 5 })
            .setOrigin(0.5).setDepth(100).setScrollFactor(sf);
        scene.tweens.add({ targets: h, y: y - 50, scale: 1.4, alpha: 0, duration: 700, ease: 'Quad.easeOut', onComplete: () => h.destroy() });
        if (typeof Achievements !== 'undefined' && Achievements.booped(id, scene)) {
            const got = Achievements._read('boops', []).length, all = Achievements.BOOPS.length;
            const t = scene.add.text(x, y - 30, got < all ? `BOOP! ${got}/${all}` : 'BOOP! EVERY ONE', { fontSize: '16px', fontFamily: 'monospace', fontStyle: 'bold', color: '#ffd0ea', stroke: '#2a0a1a', strokeThickness: 4 })
                .setOrigin(0.5).setDepth(100).setScrollFactor(sf);
            scene.tweens.add({ targets: t, y: y - 80, alpha: 0, delay: 600, duration: 700, onComplete: () => t.destroy() });
        }
    }

    // The eyes an enemy wears, by what it does: carers look kind, the stubborn ones calm, the sneaky ones sly, the rest angry
    static MOODS = { healer: 'kind', tidecaller: 'kind', wishingwell: 'kind', cheer: 'kind',
        armored: 'calm', encased: 'calm', gem: 'calm', anchor: 'calm', shade: 'calm', frost: 'calm', tidalguard: 'calm', conduit: 'calm',
        wraith: 'sly', leech: 'angry', hunter: 'sly', drowner: 'sly', voidsniper: 'sly', ceo: 'sly' };
    static moodOf(key) { return CreatureFX.MOODS[key] || 'angry'; }

    // Changes what an existing face wears (or its eye colour).
    static dress(u, set, eye) {
        if (!u) return;
        const scene = u.s?.scene;
        if (set !== undefined && set !== u.set) {
            u.set = set;
            if (set && !u.hat && scene) {
                const cont = u.s.parentContainer;
                if (cont) {
                    u.hat = scene.make.image({ x: u.s.x, y: u.s.y, key: 'cfx_face', frame: `h_${set}_0` }, false);
                    cont.addAt(u.hat, cont.getIndex(u.eyes) + 1);
                } else {
                    u.hat = scene.add.image(u.s.x, u.s.y, 'cfx_face', `h_${set}_0`)
                        .setScrollFactor(u.s.scrollFactorX, u.s.scrollFactorY).setDepth((u.s.depth || 0) + 0.002);
                    scene._vfxSort?.(u.hat);
                }
            }
            if (!set && u.hat) { u.hat.destroy(); u.hat = null; }
        }
        if (eye !== undefined && eye !== u.eye) { u.eye = eye ?? 0xffffff; u.eyes?.setTint(u.eye); }
    }

    static sync(scene) {
        const list = scene._cfxUnits;
        if (!list) return;
        const now = scene.time?.now || 0;
        for (let i = list.length - 1; i >= 0; i--) {
            if (CreatureFX.syncOne(scene, list[i], now)) continue;
            const u = list[i];
            u.eyes?.destroy(); u.hat?.destroy();
            if (u.s) u.s._cfx = null;
            list.splice(i, 1);
        }
    }

    static syncOne(scene, u, now) {
        const s = u.s;
        if (!s || !s.active || !s.scene) return false;
        const fn = s.frame ? s.frame.name : null;
        const body = (fn === 18 || fn === '18') ? 18 : (fn === 0 || fn === '0') ? 0 : -1;
        const vis = body >= 0 && s.visible && s.alpha > 0.03 && !u.hidden && !s.tintFill
                 && (s.texture?.key || '').startsWith('slime_');
        // what the eyes do: an expression the scene set, else blink now and then, else look
        let st = u.expr;
        if (!st) {
            if (now >= u.blinkAt) { u.blinkUntil = now + 120; u.blinkAt = now + 2200 + Math.random() * 3800; }
            if (now < u.blinkUntil) st = 'blink';
            else {
                let tx = null;
                if (typeof u.look === 'function') tx = u.look();
                else if (u.look === 'pointer') tx = scene.input?.activePointer?.worldX;
                else tx = scene.player?.x;
                if (typeof tx === 'number' && !isNaN(tx)) {
                    const wx = (s.parentContainer ? s.parentContainer.x : 0) + s.x;
                    const dead = 10 * Math.abs(s.scaleX || 1) / 1.2;
                    // a little stickiness so the eyes don't flick back and forth at the edge
                    const lim = u.lastLook === 'c' ? dead : dead * 0.6;
                    st = tx < wx - lim ? 'l' : tx > wx + lim ? 'r' : 'c';
                } else st = 'c';
                u.lastLook = st;
            }
        }
        const put = (img, frame, dz) => {
            if (!img) return;
            if (!vis) { if (img.visible) img.setVisible(false); return; }
            if (img.frame.name !== frame) img.setFrame(frame);
            img.setVisible(true);
            img.x = s.x; img.y = s.y;
            img.scaleX = s.scaleX; img.scaleY = s.scaleY;
            img.rotation = s.rotation;
            img.alpha = s.alpha;
            img.flipX = s.flipX; img.flipY = s.flipY;
            if (img.originX !== s.originX || img.originY !== s.originY) img.setOrigin(s.originX, s.originY);
            if (img.scrollFactorX !== s.scrollFactorX) img.setScrollFactor(s.scrollFactorX, s.scrollFactorY);
            if (!img.parentContainer && img.depth !== s.depth + dz) img.setDepth(s.depth + dz);
            if (s.isCropped && s._crop) img.setCrop(s._crop.x, s._crop.y, s._crop.width, s._crop.height);
            else if (img.isCropped) img.setCrop();
        };
        put(u.eyes, `e_${u.mood}_${body}_${st}`, 0.001);
        put(u.hat, u.set ? `h_${u.set}_${body}` : null, 0.002);
        return true;
    }

    // ═══ GAME SCENE (mixin) ══════════════════════════════════════════════════

    _cfxCfg() {
        if (this._cfxCfgCache) return this._cfxCfgCache;
        return (this._cfxCfgCache = {
            WINCE_MS: 170,                       // eyes squeeze shut this long after a hit
            // What each enemy type wears (a set in art().sets), the colour its eyes glow, and the
            // old floating marks the hat replaces (those stop drawing; the game still owns them).
            TYPES: {
                berserker:     { hat: 'berserker' },
                ranged:        { hat: null, mute: ['_rangedMark'] },
                rooter:        { hat: 'rooter', mute: ['_rooterMark'] },
                splitter:      { hat: null, mute: ['_splitterMark'] },
                mortar:        { hat: null, mute: ['_mortarGfx'] },
                voidsniper:    { hat: 'voidsniper', eye: 0xff8cff, mute: ['_sniperMark'] },
                lightningelem: { hat: 'lightningelem', eye: 0xfff6a0, mute: ['_lightningMark'] },
                singularity:   { hat: null, eye: 0xff8cff },
                drowner:       { hat: 'drowner' },
                ripplerunner:  { hat: null, mute: ['_cisternMark'] },
                tidecaller:    { hat: 'tidecaller', mute: ['_cisternMark', '_rangedMark'] },
                waverider:     { hat: null, mute: ['_cisternMark'] },
                tidalguard:    { hat: 'tidalguard', mute: ['_cisternMark'] },
                frost:         { hat: 'frost', eye: 0xdff8ff, mute: ['_cisternMark'] },   // a crown of icicles
                wishingwell:   { hat: 'wishingwell', mute: ['_cisternMark'] },
                conduit:       { hat: 'conduit', mute: ['_cisternMark'] },
                bud:           { hat: 'bud0', eye: 0xffd0ec },   // its head grows seed to flower as its clock runs (LevelManager._updateBudding)
                budcopy:       { eye: 0xffd0ec },   // a Budding Slime's copy: bare-headed, so the original stands out
                shade:         { hat: 'shade', eye: 0xd8a0ff },   // its four forms (LevelManager._shadeForm re-dresses it)
                shade_fire:    { hat: 'shade_fire', eye: 0x3a0800 },
                shade_ice:     { hat: 'shade_ice', eye: 0x0a2a44 },
                shade_lightning: { hat: 'shade_lightning', eye: 0x3a2a00 },
                wraith:        { hat: 'wraith', eye: 0x9fe8ff },
                diver:         { hat: 'diver', eye: 0xbff0ff },
                leech:         { hat: 'leech', eye: 0xff4aff },   // its eyes take its colour (LevelManager._leechPick)
                ceo:           { hat: 'ceo', eye: 0xffd84a },
                gem:           {},
                healer:        { hat: 'healer', eye: 0xc8ffd8 },
                anchor:        { hat: 'anchor', eye: 0xc8dcf0 },
                hunter:        { hat: 'hunter', eye: 0xffe8d0 },   // red when it frenzies (LevelManager._hunterFrenzy)
                cheer:         { hat: 'cheer', eye: 0xffd0ec },
            },
            // The warnings that fade in over a head ("!") keep their timing; only the drawing
            // changes. Field -> colour (null: read it off the game's own text).
            ALERTS: { _berserkerMark: 0xff3a2a, _singMark: 0xcc5cff, _prefireWarning: null },
            // fire on a burning body, the ember rate, frost, drips, sparks, orbiting marks
            FLAME: { COLORS: [0xff6a20, 0xffa040, 0xff7a28], EMBER_MS: 60 },
            CHILL: { W: 18, H: 3, FLAKES_PER_STACK: 2.5 },
            DRIP_MS: 230,
            ARC: { COLOR: 0xfff27a, EVERY: 55 },
            MOTE: { MAX: 5, SPIN: 0.004 },
            POISON_MS: 80,   // bubbles off you while poisoned (160 was easy to miss)
        });
    }

    // From GameScene.create (after _vfxInit): the player's face and the shared emitters.
    _cfxInit() {
        if (!CreatureFX.sheets(this)) return;
        this._cfxOn = true;
        this._cfxLive = new Set();
        this._cfxPuppets = [];
        if (this.player) CreatureFX.face(this, this.player, { mood: 'friend', look: () => this._cfxAimX });
        if (this.add.particles) {
            const mk = (key, frame, cfg) => {
                const p = this.add.particles(0, 0, key, Object.assign({ emitting: false }, frame ? { frame } : {}, cfg)).setDepth(4.4);
                this._vfxSort?.(p);
                return p;
            };
            this._cfxEmbers = mk('vfx_dot', null, {
                speedY: { min: -60, max: -26 }, speedX: { min: -12, max: 12 }, lifespan: { min: 380, max: 700 },
                scale: { start: 0.55, end: 0 }, alpha: { start: 1, end: 0 }, tint: [0xffb050, 0xff7a2a, 0xffe08a], blendMode: 'ADD',
            });
            this._cfxFrost = mk('cfx_bits', 'flake', {
                speedY: { min: 6, max: 18 }, speedX: { min: -8, max: 8 }, lifespan: { min: 500, max: 850 },
                scale: { start: 1, end: 0.4 }, alpha: { start: 0.95, end: 0 }, rotate: { min: 0, max: 90 },
            });
            this._cfxDrips = mk('cfx_bits', 'drop', {
                speedY: { min: 10, max: 30 }, speedX: { min: -6, max: 6 }, gravityY: 320, lifespan: { min: 280, max: 420 },
                alpha: { start: 1, end: 0.2 },
            });
            this._cfxBubbles = mk('cfx_bits', 'bubble', {
                speedY: { min: -26, max: -12 }, speedX: { min: -6, max: 6 }, lifespan: { min: 500, max: 800 },
                scale: { start: 0.7, end: 1.1 }, alpha: { start: 1, end: 0 },
            });
        }
        this._cfxG = this.add.graphics().setDepth(4.6);            // bars and pips
        this._cfxArcs = this.add.graphics().setDepth(4.5).setBlendMode(Phaser.BlendModes.ADD);
        this._vfxSort?.(this._cfxG); this._vfxSort?.(this._cfxArcs);
        this.events.once('shutdown', () => {
            this._cfxOn = false; this._cfxLive = null; this._cfxPuppets = null;
            this._cfxEmbers = this._cfxFrost = this._cfxDrips = this._cfxBubbles = null;
            this._cfxG = this._cfxArcs = null;
        });
    }

    // Every frame, from GameScene.update (after _vfxUpdate).
    _cfxUpdate(time, delta) {
        if (!this._cfxOn) return;
        const now = this.time.now, dt = Math.min(100, delta || 16);
        // where you're aiming, for your eyes
        const ptr = this.input?.activePointer, cam = this.cameras.main;
        if (ptr && this._aim) { const a = this._aim(ptr); this._cfxAimX = a.x + cam.scrollX; }
        this._cfxG?.clear(); this._cfxArcs?.clear();
        // you
        const p = this.player;
        if (p?._cfx) {
            const C = this._cfxCfg();
            const hurt = now - (this._vfxHurtAt ?? -1e9) < C.WINCE_MS;
            // held in place: straining against it
            p._cfx.expr = hurt ? 'wince' : this._playerRooted ? (Math.floor(now / 280) % 2 ? 'wince' : 'c') : null;
            if (this.playerPoisoned && p.visible && Math.random() < dt / C.POISON_MS) {
                this._cfxBubbles?.emitParticleAt(p.x + (Math.random() - 0.5) * 14, p.y + 10, 1);
            }
            if (now < (this._drippingUntil || 0) && p.visible && Math.random() < dt / C.DRIP_MS) {
                this._cfxDrips?.emitParticleAt(p.x + (Math.random() - 0.5) * 16, p.y + 12, 1);
            }
        } else if (p?.active && p.texture?.key?.startsWith('slime_')) {
            CreatureFX.face(this, p, { mood: 'friend', look: () => this._cfxAimX });
        }
        CreatureFX.gear(this, now);   // the weapon you have out, in your hands
        if (this.tutorialNPC?.active && !this.tutorialNPC._cfx) CreatureFX.face(this, this.tutorialNPC, { mood: 'friend' });
        // the enemies
        const seen = new Set();
        for (const e of this.enemies || []) {
            const s = e?.sprite;
            if (!s?.active || e.health <= 0) continue;
            seen.add(e);
            if (!e._cfxDressed) this._cfxDress(e);
            this._cfxMarks(e);
            this._cfxStatus(e, now, dt);
            this._cfxBodyDrips(e, now);
        }
        for (const e of this._cfxLive) if (!seen.has(e)) { this._cfxClear(e); this._cfxLive.delete(e); }
        this._cfxBosses();
        this._cfxDrops();
        this._cfxPuppetSync();
    }

    // Now and then a drop runs off it: water off the Drowner's mossy head, a thick blob of goo off the Singularity Slime
    _cfxBodyDrips(e, now) {
        const D = { drowner: { col: 0x7fd0ff, every: 900, sz: 0.5, fall: 16 }, singularity: { col: 0x9a50e0, every: 650, sz: 0.85, fall: 10 } }[e._cfxType];
        const s = e.sprite;
        if (!D || !s?.visible || s.alpha < 0.3 || now < (e._dripAt || 0) || !this.textures.exists('vfx_dot')) return;
        e._dripAt = now + D.every * (0.6 + Math.random() * 0.8);
        const sy = Math.abs(s.scaleY || 1), x = s.x + (Math.random() - 0.5) * 14 * sy, y = s.y + 8 * sy;
        const d = this.add.image(x, y, 'vfx_dot').setTint(D.col).setScale(D.sz, D.sz * 1.4).setDepth((s.depth ?? 1) + 0.01);
        this._vfxSort?.(d);
        this.tweens.add({ targets: d, y: y + D.fall * sy, scaleY: D.sz * 2, duration: 420, ease: 'Quad.easeIn', onComplete: () => {
            this.tweens.add({ targets: d, scaleX: D.sz * 2.2, scaleY: D.sz * 0.6, alpha: 0, duration: 220, onComplete: () => d.destroy() });   // it splats
        } });
    }

    // The enemy's type picks its hat and eye colour; the floating mark the hat replaces stops
    // drawing. Its health bar moves up out of the hat's way.
    _cfxDress(e) {
        e._cfxDressed = true;
        const ts = e.sprite;
        const mk = this._enemyTypeKey?.(e);
        const model = e._modelKey || mk;   // (a kind can pick its own variant: the Armored Slime's open side)
        if (model && typeof SlimeModels !== 'undefined' && SlimeModels.DEFS[model]) SlimeModels.wear(this, ts, model);   // its own body (SlimeModels.js), not a tint
        if (ts?._cfxTint) ts._cfxTint.settled = true;
        else if (ts) {
            const clean = !ts.tintFill && !e.isFrozen && !e._iceCube && !((e.burnStacks || 0) > 0) && !e.isBurning && !e.isWet && !e.isSuperConducted;
            CreatureFX.keepTint(ts, clean && ts.isTinted ? ts.tintTopLeft : null);
        }
        e._cfxSeed = Math.random() * 100;
        const key = this._enemyTypeKey?.(e) || 'slime';
        const T = this._cfxCfg().TYPES[key] || {};
        let set = T.hat || null;
        if (e._upgradedSniper) set = 'sniper';
        e._cfxType = key; e._cfxMute = T.mute || [];
        const u = e.sprite._cfx || CreatureFX.face(this, e.sprite, { mood: CreatureFX.moodOf(key) });
        if (!u) return;
        u.mood = CreatureFX.moodOf(key);   // (a face made before its type was known)
        CreatureFX.dress(u, set, T.eye ?? 0xffffff);
        u.look = () => this.player?.x;
        // the health bar sits on the sprite's centre (frame row 16); a hat reaching higher than
        // row 18 would run into it, so the bar moves up by the difference
        const parts = set ? CreatureFX.art().sets[set] || [] : [];
        let top = 22;
        for (const n of parts) { const h = CreatureFX.art().hats[n]; if (h) top = Math.min(top, h.y); }
        const lift = Math.max(0, (18.5 - top) * Math.abs(e.sprite.scaleY || 1.2));
        if (lift > 0) e._hpBarYOff = (e._hpBarYOff || 0) - Math.round(lift);
        e._cfxTop = top;
        this.updateEnemyHealthBar?.(e);   // the bar starts at the lifted height, not on its face till its first step
    }

    // Marks: the replaced ones stop drawing (checked every frame: some are made later, or
    // remade); the "!" warnings get a crisp stand-in that copies their fade and pulse.
    _cfxMarks(e) {
        for (const f of e._cfxMute || []) if (e[f] && !e[f]._cfxMuted) CreatureFX.mute(e[f]);
        // the anchor and the healer totem draw their own bodies: pixel-art ones in their place
        if (e._anchorBodyGfx?.active && !e._anchorBodyGfx._cfxP) {
            const img = this.add.image(0, 0, 'cfx_bits', 'anchor');
            this._vfxSort?.(img);
            this._cfxPuppet(e._anchorBodyGfx, [{ o: img, dy: 1 }]);
        }
        if (e._totemGfx?.active && !e._totemGfx._cfxP) {
            const img = this.add.image(0, 0, 'cfx_bits', 'totem');
            this._vfxSort?.(img);
            this._cfxPuppet(e._totemGfx, [{ o: img }]);
        }
        this._cfxGem(e._shatterMarkVisual, !!e._purpleMarked);
        if (e._orbGlow?.active && !e._orbGlow._cfxP) {   // the totem's orb breathes
            const gl = this.add.image(0, 0, 'vfx_glow').setTint(0x44ff88).setBlendMode(Phaser.BlendModes.ADD);
            this._vfxSort?.(gl);
            this._cfxPuppet(e._orbGlow, [{ o: gl, dy: 8, sx: 0.2, sy: 0.2 }]);
        }
        const AL = this._cfxCfg().ALERTS;
        for (const f in AL) {
            const m = e[f];
            if (!m || !m.active || m._cfxP) continue;
            let col = AL[f];
            if (col === null) col = parseInt(String(m.style?.color || '#ff4400').replace('#', ''), 16) || 0xff4400;
            const img = this.add.image(m.x, m.y, 'cfx_bits', 'alert').setTint(col).setOrigin(0.5, 0.75);
            const glow = this.add.image(m.x, m.y, 'vfx_glow').setTint(col).setBlendMode(Phaser.BlendModes.ADD);
            this._vfxSort?.(img); this._vfxSort?.(glow);
            const P = this._cfxPuppet(m, [{ o: glow, a: 0.6, sx: 0.22, sy: 0.22, dy: -3 }, { o: img, sx: 1.1, sy: 1.1 }]);
            if (P && m.type === 'Text') P.text = true;
        }
    }

    // The fractal shard's marks: a gold gem over the head, a bigger violet one once amplified.
    _cfxGem(sm, purple) {
        if (!sm?.active || sm._cfxP) return;
        const col = purple ? 0xb45cff : 0xffcc33;
        const glow = this.add.image(sm.x, sm.y, 'vfx_glow').setTint(col).setBlendMode(Phaser.BlendModes.ADD);
        const img = this.add.image(sm.x, sm.y, 'cfx_bits', purple ? 'mark_purple' : 'mark_gold');
        this._vfxSort?.(glow); this._vfxSort?.(img);
        // (a little lower than the drawn one hung: the gem is smaller)
        this._cfxPuppet(sm, [{ o: glow, a: 0.55, sx: 0.2, sy: 0.2, dy: 6 }, { o: img, dy: 6 }]);
    }

    // The pieces of one enemy's status effects, made when a state starts and dropped when it
    // ends, all placed from the sprite each frame.
    _cfxStatus(e, now, dt) {
        const s = e.sprite, fx = e._cfxFx || (e._cfxFx = {}), C = this._cfxCfg();
        this._cfxLive.add(e);
        // (the anchor and the totem hide their slime and draw their own body: they still burn)
        const shown = ((s.visible && s.alpha > 0.05) || !!(e._anchorBodyGfx?.active || e._totemGfx?.active)) && !e._sniperInvisible;
        const B = this._cfxBody(s, e), d = s.depth || 1;
        const dep = (o, z) => { if (o.depth !== z) o.setDepth(z); return o; };
        const u = s._cfx;
        const drop = k => { if (fx[k]) { (Array.isArray(fx[k]) ? fx[k] : [fx[k]]).forEach(o => o?.destroy()); fx[k] = null; } };
        const imgs = (k, n, key, frame, setup) => {
            if (!fx[k] || fx[k].length !== n) {
                drop(k);
                fx[k] = [];
                for (let i = 0; i < n; i++) {
                    const o = this.add.image(B.x, B.mid, key, frame);
                    this._vfxSort?.(o);
                    setup?.(o, i);
                    fx[k].push(o);
                }
            }
            return fx[k];
        };

        // ── the old status drawings stop drawing ──
        if (e.burnVisual) CreatureFX.mute(e.burnVisual);
        if (e._stunIndicator) CreatureFX.mute(e._stunIndicator);
        if (e.superConductVisual?.container) CreatureFX.mute(e.superConductVisual.container);
        if (e._chillBar) CreatureFX.mute(e._chillBar);
        for (const v of e.cosmicMarkVisuals || []) CreatureFX.mute(v);
        for (const v of e._burnStackBar || []) CreatureFX.mute(v);
        const fv = e.freezeVisuals;
        if (fv) { CreatureFX.mute(fv.iceBlock); CreatureFX.mute(fv.iceBorder); for (const l of fv._extraLayers || []) CreatureFX.mute(l); }

        const frozen = !!(e.isFrozen || e._iceCube);
        const stunned = !!e.isStunned && !(e.stunnedUntil > 0 && now > e.stunnedUntil + 100);
        // the eyes: squeezed after a hit, X's while stunned, a fixed stare in the ice
        if (u) u.expr = now - (e._vfxHitAt ?? -1e9) < C.WINCE_MS ? 'wince' : stunned ? 'x' : frozen ? 'c' : null;

        // ── fire: two tongues licking up behind it, embers off it ──
        const burning = shown && ((e.isBurning && now < (e.burnUntil || 0)) || (e.burnStacks || 0) > 0 || (e.superBurn || 0) > 0);
        if (burning) {
            const fl = imgs('flames', 3, 'vfx_flame', null, (o, i) => o.setBlendMode(Phaser.BlendModes.ADD).setOrigin(0.5, 0.92).setTint(C.FLAME.COLORS[i]));
            const blueOn = (e.blueBurn || 0) > 0, BLUEF = [0x6ab0ff, 0xbfe8ff, 0x8ac8ff];   // blue burn in it: the flames burn blue
            fl.forEach((o, i) => {
                o.setTint(blueOn ? BLUEF[i] : C.FLAME.COLORS[i]);
                const side = i - 1, sd = e._cfxSeed + i * 2.1, tall = i === 1 ? 1.35 : 1;
                const n = 0.5 * Math.sin(now * 0.031 + sd) + 0.5 * Math.sin(now * 0.017 + sd * 1.7);
                o.setPosition(B.x + side * B.hw * 0.5, B.top + (i === 1 ? 5 : 7) * B.k)
                 .setScale((0.5 + 0.07 * n) * B.k, (0.7 + 0.22 * n) * tall * B.k).setAlpha(0.9 + 0.1 * n);
                dep(o, d - 0.004);
            });
            if (Math.random() < dt / C.FLAME.EMBER_MS) this._cfxEmbers?.emitParticleAt(B.x + (Math.random() - 0.5) * B.hw * 1.6, B.mid - 2 * B.k, 1);
        } else drop('flames');
        const chillOn = shown && !frozen && (e.chillStacks || 0) > 0.03;
        // stacked burns: a flame pip per stack, over the health bar (and over the frost bar)
        const stacks = shown ? Math.min(5, e.burnStacks || 0) : 0;
        if (stacks > 0) {
            const pips = imgs('pips', stacks, 'cfx_bits', 'flame', null);
            const y0 = B.over - (chillOn ? 10 : 4);
            const blue = Math.min(stacks, e.blueBurn || 0);   // the blue ones last in the row, blue
            pips.forEach((o, i) => { o.setPosition(B.x + (i - (stacks - 1) / 2) * 6, y0 + Math.sin(now * 0.012 + i) * 0.6); if (i >= stacks - blue) o.setTintFill(0xffffff, 0xffffff, 0x4a8aff, 0x3a6aff); else if (o.tintFill) o.clearTint(); });   // a blue flame: white-hot top, blue body
            pips.forEach(o => dep(o, 4.62));
        } else drop('pips');
        // Super Burn (the fire ult): its stacks as big white-hot flame pips, flickering, over the ordinary ones
        const sb = shown ? Math.min(3, e.superBurn || 0) : 0;
        if (sb > 0) {
            const sp = imgs('spips', sb, 'cfx_bits', 'flame', o => o.setBlendMode(Phaser.BlendModes.ADD));
            const y1 = B.over - (chillOn ? 10 : 4) - (stacks > 0 ? 9 : 0) - 3;
            sp.forEach((o, i) => o.setPosition(B.x + (i - (sb - 1) / 2) * 10, y1 + Math.sin(now * 0.02 + i) * 1).setScale(1.9 + 0.25 * Math.sin(now * 0.03 + i * 2)).setTint(i % 2 ? 0xfff0a0 : 0xffffff));
            sp.forEach(o => dep(o, 4.63));
        } else drop('spips');

        // ── chill: a frost bar over the head, flakes falling off it ──
        const chill = shown && !frozen ? Math.max(0, Math.min(1, (e.chillStacks || 0) / 3)) : 0;
        if (chill > 0.01) {
            this._cfxChillBar(B.x, B.over - 3, chill, now);
            if (Math.random() < dt / 1000 * C.CHILL.FLAKES_PER_STACK * 3 * chill * 3) {
                this._cfxFrost?.emitParticleAt(B.x + (Math.random() - 0.5) * B.hw * 1.8, B.top + Math.random() * (B.bot - B.top), 1);
            }
        }

        // ── ice: a block around it (cracked when it's a brittle cube, and shivering at the end) ──
        if (frozen && shown) {
            const [blk] = imgs('ice', 1, 'cfx_ice', 'ice', null);
            const cube = !!e._iceCube && !e.isFrozen;
            const fr = cube ? 'ice_cracked' : 'ice';
            if (blk.frame.name !== fr) blk.setFrame(fr);
            let jx = 0;
            const left = cube ? (e._iceCubeUntil || 0) - now : Infinity;
            if (left < 700) jx = Math.sin(now * 0.09) * (left < 300 ? 1.2 : 0.6);
            blk.setPosition(Math.round(B.x + jx), B.bot - 10 * B.k).setScale(B.k).setAlpha(s.alpha);
            dep(blk, d + 0.005);
            const tw = fx.twinkle || (fx.twinkle = { at: 0, img: null });
            if (now > tw.at) {
                tw.at = now + 500 + Math.random() * 900;
                tw.ox = (Math.random() - 0.5) * 18; tw.oy = -Math.random() * 14; tw.t = now;
                if (!tw.img) { tw.img = this.add.image(0, 0, 'cfx_bits', 'star').setTint(0xffffff).setBlendMode(Phaser.BlendModes.ADD); this._vfxSort?.(tw.img); }
            }
            if (tw.img) {
                const k = Math.max(0, 1 - (now - tw.t) / 320);
                tw.img.setPosition(B.x + tw.ox * B.k, B.bot - 4 * B.k + tw.oy * B.k).setScale(0.35 + 0.4 * k).setAlpha(k);
                dep(tw.img, d + 0.006);
            }
        } else { drop('ice'); if (fx.twinkle?.img) { fx.twinkle.img.destroy(); fx.twinkle = null; } }

        // ── stun: three stars circling over the head ──
        if (stunned && shown) {
            const st = imgs('stars', 3, 'cfx_bits', 'star', null);
            const cy = B.top - 4 * B.k, rx = B.hw * 1.05, ry = 3.5 * B.k;
            st.forEach((o, i) => {
                const a = now * 0.006 + i * Math.PI * 2 / 3, sn = Math.sin(a);
                o.setPosition(B.x + Math.cos(a) * rx, cy + sn * ry).setScale(1.05 + 0.25 * sn).setAlpha(0.8 + 0.2 * sn);
                dep(o, sn > 0 ? d + 0.006 : d - 0.003);
            });
        } else drop('stars');

        // ── amped: sparks crackling over it ──
        if (e.isSuperConducted && shown) {
            if (!fx.arcAt || now - fx.arcAt > C.ARC.EVERY) { fx.arcAt = now; fx.arcSeed = Math.random() * 1000; }
            this._cfxSparks(B, fx.arcSeed);
        }

        // ── Hex, cosmic's mark: one mote per stack orbiting it, pink, magenta, violet; they blink as it runs out ──
        const hexLeft = (e._csHexUntil || 0) - now, marks = shown && hexLeft > 0 ? Math.min(3, e._csHexStacks || 1) : 0;
        if (marks > 0) {
            const HUE = [0xff7ad8, 0xd86aff, 0x9a5aff], blink = hexLeft < 900 && Math.floor(now / 90) % 2 ? 0.35 : 1;
            const mo = imgs('motes', marks, 'cfx_bits', 'mote', null);
            const gl = imgs('moteGlow', marks, 'vfx_glow', null, o => o.setBlendMode(Phaser.BlendModes.ADD));
            const rx = B.hw * 1.3, ry = 4 * B.k, cy = B.mid - 1;
            mo.forEach((o, i) => {
                const a = now * C.MOTE.SPIN * (1 + marks * 0.25) + i * Math.PI * 2 / marks, sn = Math.sin(a);   // spinning faster the deeper the Hex
                const x = B.x + Math.cos(a) * rx, y = cy + sn * ry, dz = sn > 0 ? d + 0.006 : d - 0.003;
                dep(o.setPosition(x, y).setTintFill(HUE[i]).setScale(2.1 + 0.4 * sn).setAlpha(blink), dz);
                dep(gl[i].setPosition(x, y).setTint(HUE[i]).setScale(0.3).setAlpha((0.6 + 0.3 * sn) * blink), dz - 0.0005);
            });
        } else { drop('motes'); drop('moteGlow'); }

        // ── wet: drips ──
        if (e.isWet && shown && !frozen && Math.random() < dt / C.DRIP_MS) {
            this._cfxDrips?.emitParticleAt(B.x + (Math.random() - 0.5) * B.hw * 1.7, B.mid + Math.random() * 4 * B.k, 1);
        }
    }

    // Where a slime's body is, from its sprite: the frame's pixel rows 22-31, columns 8-24.
    _cfxBody(s, e) {
        const sx = Math.abs(s.scaleX || 1), sy = Math.abs(s.scaleY || 1), oy = (s.originY ?? 0.5) * 32;
        const top = s.y + (22 - oy) * sy, bot = s.y + (32 - oy) * sy;
        return {
            x: s.x + (16.5 - (s.originX ?? 0.5) * 32) * sx, top, bot, mid: (top + bot) / 2, hw: 8.5 * sx, k: sy / 1.2,
            // where things over its head start: over the health bar while it shows (it sits on the
            // sprite's centre, raised out of a hat's way), else just over the head or hat
            over: e?.healthBarBg?.visible ? s.y + (e._hpBarYOff || 0) - 3 : s.y + ((e?._cfxTop ?? 22) - oy) * sy - 2,
        };
    }

    _cfxChillBar(x, y, f, now) {
        const g = this._cfxG, C = this._cfxCfg().CHILL;
        if (!g) return;
        const W = C.W, H = C.H, x0 = Math.round(x - W / 2), y0 = Math.round(y - H);
        g.fillStyle(0x020a14, 0.85); g.fillRect(x0 - 1, y0 - 1, W + 2, H + 2);
        g.fillStyle(0x10304a, 1); g.fillRect(x0, y0, W, H);
        const hot = f > 0.82;
        g.fillStyle(hot ? 0xeafaff : f > 0.5 ? 0x8ad8ff : 0x4aa8e8, 1); g.fillRect(x0, y0, Math.max(1, Math.round(W * f)), H);
        g.fillStyle(0xffffff, hot ? 0.8 : 0.45); g.fillRect(x0, y0, Math.max(1, Math.round(W * f)), 1);
        g.fillStyle(0x020a14, 0.7);
        for (let i = 1; i < 3; i++) g.fillRect(x0 + Math.round(W * i / 3), y0, 1, H);
        if (hot) { g.lineStyle(1, 0xffffff, 0.35 + 0.5 * Math.abs(Math.sin(now / 90))); g.strokeRect(x0 - 1.5, y0 - 1.5, W + 3, H + 3); }
    }

    // A few short jagged arcs jumping between points on the body, redrawn every few frames.
    _cfxSparks(B, seed) {
        const g = this._cfxArcs, C = this._cfxCfg().ARC;
        if (!g) return;
        const R = VisualFX.prototype._vfxRng ? VisualFX.prototype._vfxRng(Math.floor(seed * 1000)) : Math.random;
        for (let n = 0; n < 2; n++) {
            const a0 = R() * Math.PI * 2, a1 = a0 + (0.6 + R() * 1.2) * (R() < 0.5 ? -1 : 1);
            const px = a => B.x + Math.cos(a) * B.hw * 1.05, py = a => B.mid + Math.sin(a) * (B.bot - B.top) * 0.62;
            const pts = [];
            for (let i = 0; i <= 4; i++) {
                const a = a0 + (a1 - a0) * i / 4, j = i === 0 || i === 4 ? 0 : (R() - 0.5) * 5;
                pts.push([px(a) + j, py(a) + j * 0.6 - (i === 2 ? 3 : 0)]);
            }
            for (const [w, col, al] of [[2.2, C.COLOR, 0.35], [1, 0xffffff, 0.95]]) {
                g.lineStyle(w, col, al);
                g.beginPath(); g.moveTo(pts[0][0], pts[0][1]);
                for (let i = 1; i < pts.length; i++) g.lineTo(pts[i][0], pts[i][1]);
                g.strokePath();
            }
        }
    }

    _cfxClear(e) {
        const fx = e._cfxFx;
        if (!fx) return;
        for (const k of Object.keys(fx)) {
            const v = fx[k];
            if (Array.isArray(v)) v.forEach(o => o?.destroy?.());
            else if (v && v.img) v.img.destroy();
            else if (v && v.destroy) v.destroy();
        }
        e._cfxFx = null;
    }

    // ── BOSSES ───────────────────────────────────────────────────────────────
    // Their bodies are slimes too: eyes, and a pixel crown for the Voltslime and the Queen in
    // place of the drawn one (which stops drawing; it isn't kept anywhere, so it's found as the
    // drawing right after the body in the boss's container).
    _cfxBosses() {
        const crown = (cont, body) => {
            if (!cont?.list) return;
            const i = cont.getIndex(body);
            for (let k = i + 1; k < cont.list.length; k++) {
                const o = cont.list[k];
                if (o.type === 'Graphics') { CreatureFX.mute(o); return; }
            }
        };
        const vb = this.voltslimeBoss;
        if (vb?.body?.active && !vb.body._cfx) {
            CreatureFX.face(this, vb.body, { mood: 'angry', hat: vb._asleep ? null : 'volt' });   // asleep, its crown's on the floor (LevelManager._voltSleep)
            crown(vb.container, vb.body);
        }
        for (const b of [vb, this.voidSovereignBoss]) if (b?.active !== false) this._cfxGem(b?._shatterMarkVisual, !!b?._purpleMarked);
        const vs = this.voidSovereignBoss;
        if (vs?.body?.active && !vs.body._cfx) {
            CreatureFX.face(this, vs.body, { mood: 'angry', eye: 0xff8cff });
            // its floating crown sat right on its name; it floats a little higher now
            if (vs.crownGfx?.active) vs.crownGfx.y -= 24;
        }
        for (const q of this.portals || []) {
            const s = q?.sprite;
            if (!s?.active || s._cfx) continue;
            CreatureFX.face(this, s, { mood: 'angry', hat: 'queen' });
            crown(q.container, s);
        }
    }

    // ── PICKUPS ──────────────────────────────────────────────────────────────
    // Glorps, potions and scrap become little pixel-art things with a glow and a shadow. The
    // game's own containers keep flying, bobbing and being collected; they just stop drawing.
    _cfxDrops() {
        // the tutorial's glorps live in their own list (TutorialManager.spawnTutorialGlorps)
        const tut = (this.glorps || []).map(c => ({ type: 'glorp', container: c, value: c.getData?.('value'), worldY: c.y }));
        for (const d of [...(this.groundDrops || []), ...tut]) {
            const c = d.container;
            if (!c?.active || c._cfxP) continue;
            const kind = d.type === 'healthpot' ? 'potion_hp' : d.type === 'ultpot' ? 'potion_ult' : 'glorp';
            const col = kind === 'potion_hp' ? 0xff4a6a : kind === 'potion_ult' ? 0xffc83a : 0x3dffb0;
            const glow = this.add.image(c.x, c.y, 'vfx_glow').setTint(col).setBlendMode(Phaser.BlendModes.ADD);
            const img = this.add.image(c.x, c.y, 'cfx_bits', kind);
            // a breathing glow, the item a size up (a glorp turns as it hangs there)
            const parts = [{ o: glow, a: 0.6, sx: 0.36, sy: 0.36, pulse: 0.005 }, { o: img, sx: 1.25, sy: 1.25, wobble: kind === 'glorp' }];
            if (kind === 'glorp' && d.value) {
                const t = this.add.text(c.x, c.y, String(d.value), {
                    fontSize: '9px', fontFamily: 'monospace', fontStyle: 'bold', color: '#7dffc8', stroke: '#05060a', strokeThickness: 3,
                }).setOrigin(0.5, 0);
                parts.push({ o: t, dy: 7, noScale: true });
            }
            for (const q of parts) this._vfxSort?.(q.o);
            const sh = this.add.image(c.x, (d.worldY ?? c.y) + 9, 'vfx_shadow').setDepth(0.95);
            this._vfxSort?.(sh);
            const P = this._cfxPuppet(c, parts, { depth: 2.02 });
            if (P) {
                P.shadow = sh; P.groundY = (d.worldY ?? c.y) + 9;
                const now = this.time.now;
                P.drop = col; P.pop = { t0: now, dx: (Math.random() - 0.5) * 18 }; P.twinkle = now + 500 + Math.random() * 900;
            }
            else sh.destroy();
        }
        for (const orb of this.orbObjects || []) {
            const g = orb?.g;
            if (!g?.active || g._cfxP) continue;
            const glow = this.add.image(g.x, g.y, 'vfx_glow').setTint(0x5ff0c8).setBlendMode(Phaser.BlendModes.ADD);
            const img = this.add.image(g.x, g.y, 'cfx_bits', 'scrap');
            this._vfxSort?.(glow); this._vfxSort?.(img);
            this._cfxPuppet(g, [{ o: glow, a: 0.5, sx: 0.2, sy: 0.2 }, { o: img, spin: 0.0016 }]);
        }
    }

    // A stand-in for one of the game's pieces: the original stops drawing, the parts copy where
    // it is, how big and how faded, every frame, and go when it goes. parts: { o, dx, dy, a
    // (alpha x), sx/sy (scale x), spin, noScale }.
    _cfxPuppet(src, parts, { depth } = {}) {
        if (!src || src._cfxP) return null;
        CreatureFX.mute(src);
        const P = { src, parts, depth };
        src._cfxP = P;
        (this._cfxPuppets || (this._cfxPuppets = [])).push(P);
        this._cfxPuppetOne(P, this.time.now);
        return P;
    }

    _cfxPuppetSync() {
        const list = this._cfxPuppets;
        if (!list) return;
        const now = this.time.now;
        for (let i = list.length - 1; i >= 0; i--) {
            const P = list[i];
            if (P.src.active && P.src.scene) { this._cfxPuppetOne(P, now); continue; }
            if (P.drop !== undefined && P.lastX !== undefined) CreatureFX.pickupPop(this, P.lastX, P.lastY, P.drop);
            for (const q of P.parts) q.o?.destroy();
            P.shadow?.destroy();
            list.splice(i, 1);
        }
    }

    _cfxPuppetOne(P, now) {
        const s = P.src, vis = s.visible !== false && (s.alpha ?? 1) > 0.01;
        const kx = s.scaleX ?? 1, ky = s.scaleY ?? 1, z = (P.depth ?? s.depth ?? 1);
        // loot: a hop out of the kill (up and over from where it fell, a squash as it lands)
        let ox = 0, oy = 0, sq = 1;
        if (P.pop) {
            const k = (now - P.pop.t0) / 380;
            if (k >= 1 || k < 0) P.pop = null;
            else { ox = -P.pop.dx * (1 - k); oy = -18 * 4 * k * (1 - k); if (k > 0.8) sq = 0.78; }
        }
        P.parts.forEach((q, i) => {
            const o = q.o;
            if (!o?.active) return;
            o.setVisible(vis);
            if (!vis) return;
            o.x = s.x + (q.dx || 0) * kx + ox; o.y = s.y + (q.dy || 0) * ky + oy;
            if (!q.noScale) { o.scaleX = kx * (q.sx ?? 1) * (2 - sq); o.scaleY = ky * (q.sy ?? 1) * sq; }
            if (q.wobble) o.scaleX *= 0.78 + 0.22 * Math.abs(Math.cos(now * 0.0032 + i));
            o.alpha = (s.alpha ?? 1) * (q.a ?? 1) * (q.pulse ? 0.7 + 0.3 * Math.sin(now * q.pulse) : 1);
            if (q.spin) o.rotation = now * q.spin;
            const dz = z + 0.001 * (i + 1);
            if (o.depth !== dz) o.setDepth(dz);
        });
        // now and then a glint on it
        if (P.twinkle && now > P.twinkle && vis && this.textures.exists('cfx_bits')) {
            P.twinkle = now + 1100 + Math.random() * 1800;
            const it = P.parts[1]?.o;
            if (it?.active) {
                const st = this.add.image(it.x - 3 + Math.random() * 5, it.y - 5 + Math.random() * 4, 'cfx_bits', 'star')
                    .setBlendMode(Phaser.BlendModes.ADD).setScale(0).setDepth(it.depth + 0.005);
                this._vfxSort?.(st);
                this.tweens.add({ targets: st, scale: 1, duration: 130, yoyo: true, onComplete: () => st.destroy() });
            }
        }
        P.lastX = P.parts[1]?.o?.x ?? s.x; P.lastY = P.parts[1]?.o?.y ?? s.y;
        if (P.text) {   // a "!" text recolours itself as it locks on
            const col = parseInt(String(s.style?.color || '').replace('#', ''), 16);
            if (!isNaN(col)) for (const q of P.parts) q.o.setTint?.(col);
        }
        if (P.shadow?.active) {
            const lift = Math.max(0, P.groundY - 9 - s.y);
            P.shadow.setVisible(vis).setPosition(s.x, P.groundY).setScale(0.32 - Math.min(0.14, lift * 0.008), 0.12).setAlpha(0.55 * (s.alpha ?? 1));
        }
    }

    // ── SPEED ARROWS ─────────────────────────────────────────────────────────
    // From _spawnSpeedArrow: a chevron that slides the way the speed went (down and blue for a
    // slow, up for a boost) instead of a drawn arrow. Returns true when it drew one.
    _cfxSpeedArrow(x, y, type) {
        if (!this._cfxOn || !this.textures.exists('cfx_bits')) return false;
        if (this._deathScreenActive) return true;   // nothing new over the death screen
        const up = String(type).startsWith('speed');
        const col = type === 'slow_ice' ? 0x7fd8ff : type === 'slow_goop' ? 0xb8c0cc : type === 'slow_anchor' ? 0x9aa4b8
                  : type === 'speed_anchor' ? 0x9cff9c : 0xffa050;
        const ox = (Math.random() - 0.5) * 18, y0 = y + (up ? 8 : -6);
        const c = this.add.image(x + ox, y0, 'cfx_bits', 'chevron').setTint(col).setFlipY(up).setDepth(4.5).setAlpha(0);
        this._vfxSort?.(c);
        this.tweens.add({ targets: c, alpha: 1, duration: 90 });
        this.tweens.add({ targets: c, y: y0 + (up ? -12 : 12), alpha: 0, delay: 90, duration: 420, ease: 'Quad.easeIn', onComplete: () => c.destroy() });
        return true;
    }

    // ── SHIELD ───────────────────────────────────────────────────────────────
    // From showShieldBlock: a shield flashes up over you with what it stopped, and a ring goes
    // out from you. Returns true when it drew it.
    _cfxShieldBlock(blocked) {
        const p = this.player;
        if (!this._cfxOn || !p?.active || !this.textures.exists('cfx_bits')) return false;
        const C = 0x5fd8ff, now = this.time.now, last = this._cfxShieldPop;
        if (last?.t?.active && now - last.at < 300) {   // blocks in quick succession add up on the one shield instead of stacking a popup each
            last.total += +blocked || 0; last.at = now; last.t.setText(`-${last.total.toFixed(1)}`).setPosition(p.x + 8, p.y - 17);
            return true;
        }
        const ring = this.add.image(p.x, p.y + 4, 'vfx_ring').setTint(C).setBlendMode(Phaser.BlendModes.ADD)
            .setDepth(4.5).setScale(0.25).setAlpha(0.95);
        const sh = this.add.image(p.x, p.y - 16, 'cfx_bits', 'shield').setDepth(5).setScale(0.6);
        const t = this.add.text(p.x + 8, p.y - 17, `-${(+blocked || 0).toFixed(1)}`, {
            fontSize: '10px', fontFamily: 'monospace', fontStyle: 'bold', color: '#bff0ff', stroke: '#05060a', strokeThickness: 3,
        }).setOrigin(0, 0.5).setDepth(5);
        for (const o of [ring, sh, t]) this._vfxSort?.(o);
        this._cfxShieldPop = { t, at: now, total: +blocked || 0 };
        this.tweens.add({ targets: ring, scale: 0.9, alpha: 0, duration: 380, ease: 'Cubic.easeOut', onComplete: () => ring.destroy() });
        this.tweens.add({ targets: sh, scale: 1.2, duration: 140, ease: 'Back.easeOut' });
        this.tweens.add({ targets: [sh, t], y: '-=12', alpha: 0, delay: 380, duration: 420, ease: 'Quad.easeIn',
                          onComplete: () => { sh.destroy(); t.destroy(); } });
        this._vfxFlash?.(p.x, p.y, 60, C, 220, 0.6);
        return true;
    }

    // ── THE NEW-ENEMY CARD ───────────────────────────────────────────────────
    // From _showEnemyBanner: the portrait shows the slime itself, in its colours, wearing its
    // hat and glaring, instead of a flat disc.
    _cfxPortrait(panel, portrait, key, entry) {
        if (!panel || !portrait || !CreatureFX.sheets(this)) return;
        portrait.clear();
        portrait.fillStyle(0x000000, 0.45); portrait.fillCircle(0, 0, 36);
        portrait.fillStyle(entry.tint, 0.16); portrait.fillCircle(0, 0, 33);
        portrait.lineStyle(2, entry.tint, 0.75); portrait.strokeCircle(0, 0, 36);
        portrait.lineStyle(1, 0xffffff, 0.18); portrait.strokeCircle(0, 0, 31);
        const L = LevelManager.look(this, key);   // its body, as the game draws it (LevelManager.LOOKS)
        if (!this.textures.exists(L.tex)) return;
        const spr = this.make.sprite({ x: portrait.x, y: portrait.y - 22, key: L.tex, frame: 0 }, false).setScale(3.4);
        if (L.tint) spr.setTint(L.tint);
        if (this.anims.exists(L.anim)) spr.play(L.anim);
        panel.add(spr);
        const T = this._cfxCfg().TYPES[key] || {};
        CreatureFX.face(this, spr, { mood: CreatureFX.moodOf(key), hat: T.hat || null, eye: T.eye, look: () => null });
    }

    // ── LIGHT ────────────────────────────────────────────────────────────────
    // From _vfxLights: burning enemies glow orange and flicker, amped ones yellow, frozen
    // ones a little cyan. A handful at most, so they never crowd out the rest.
    _cfxLights(time) {
        const out = [];
        for (const e of this.enemies || []) {
            const s = e.sprite;
            if (!s?.active || !s.visible || s.alpha < 0.05 || out.length >= 8) continue;
            const burning = (e.isBurning && time < (e.burnUntil || 0)) || (e.burnStacks || 0) > 0;
            if (burning) out.push({ x: s.x, y: s.y + 8, r: 46 + 6 * Math.sin(time * 0.03 + (e._cfxSeed || 0)), color: 0xff7a30, a: 0.55, g: 0.26 });
            else if (e.isSuperConducted) out.push({ x: s.x, y: s.y + 8, r: 40, color: 0xfff27a, a: 0.5, g: 0.22 });
            else if (e.isFrozen || e._iceCube) out.push({ x: s.x, y: s.y + 10, r: 34, color: 0x9fe6ff, a: 0.4, g: 0.16 });
        }
        for (const ch of this.tutorialChests || []) {               // Loot.js chests: their own light
            const c = ch.container;
            if (ch.opened || !c?.active || out.length >= 12) continue;
            out.push({ x: c.x, y: c.y, r: 50 + 4 * Math.sin(time * 0.004 + (ch.tileX || 0)), color: c._ltGlow ?? 0xffb040, a: 0.55, g: 0.22 });
        }
        for (const L of this._csLights?.(time) || []) out.push(L);   // Cosmic.js: wards, the well, Ascend
        return out;
    }
}
