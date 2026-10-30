// ═══════════════════════════════════════════════════════════════════════════
// Breakers.js — the Gauntlet's breaker rooms: power is both the danger and the key. Each breaker (a colour) powers what its
// wires run to: doors, and stretches of the conductive floor (Pulse.js). Step on a breaker and it flips. A door is open while
// every colour wired to it is on (one wired blue and yellow wants both); a stretch of floor zaps while its colour is on and lies
// dead while it's off. Work out the order: what you power to get through is what you'll have to cross. The wires show what goes
// where, lit while their colour's on.
// ═══════════════════════════════════════════════════════════════════════════
class Breakers {
    static TINT = { red: 0xff4a4a, blue: 0x4aa8ff, yellow: 0xffd84a, 'blue+yellow': 0x6aff7a, 'red+yellow': 0xffa040, 'blue+red': 0xc06aff };   // a door's light: its colour, or the two mixed
    static LIGHT = { red: 0, blue: 1, yellow: 2, 'blue+yellow': 3, 'red+yellow': 4, 'blue+red': 5 };   // (its column in gt_door)
    // A sliding metal door, the Gauntlet's (gt_door), on the doorway tile (x, y): a steel half that slides into the wall beside it to
    // open and out again to shut (in a two-tile doorway the halves part in the middle), its light the colour of what it waits for
    // (red: locked). isDoor(x, y): the doorway's other tiles (it won't slide into one of those). door.set(open, then) animates it
    static door(S, x, y, light = 'red', isDoor = () => false) {
        const T = S.TILE_SIZE, tex = S.textures.get('gt_door'), solid = (a, b) => S.world?.[a]?.[b] !== S.FLOOR && !isDoor(a, b);
        if (!tex.has('h_0')) for (let i = 0; i < 6; i++) { tex.add(`h_${i}`, 0, i * 24, 0, 24, 24); tex.add(`v_${i}`, 0, i * 24, 24, 24, 24); }
        const fl = (a, b) => S.world?.[a]?.[b] === S.FLOOR, vertical = (fl(x - 1, y) && fl(x + 1, y)) || !(fl(x, y - 1) && fl(x, y + 1));   // (as a ward reads it: a doorway in a wall running up-down)
        const dir = vertical ? (solid(x, y - 1) || !solid(x, y + 1) ? -1 : 1) : (solid(x - 1, y) || !solid(x + 1, y) ? -1 : 1);   // the way it slides away
        const cx = x * T + T / 2, cy = y * T + T / 2, img = S.add.image(cx, cy, 'gt_door', `${vertical ? 'v' : 'h'}_${Breakers.LIGHT[light] ?? 0}`).setDepth(0.9);
        const d = { img, k: 0, tw: null };   // k: 0 shut, 1 open (slid all the way into the wall)
        const draw = () => {
            const o = d.k * 24, w = 24 - o;
            if (vertical) img.setCrop(0, dir < 0 ? o : 0, 24, w).setPosition(cx, cy + dir * o);
            else img.setCrop(dir < 0 ? o : 0, 0, w, 24).setPosition(cx + dir * o, cy);
            img.setVisible(w > 0);
        };
        d.set = (open, then) => {
            d.tw?.stop();
            d.tw = S.tweens.addCounter({ from: d.k, to: open ? 1 : 0, duration: 280, ease: open ? 'Quad.easeIn' : 'Quad.easeOut', onUpdate: tw => { d.k = tw.getValue(); draw(); }, onComplete: () => { d.tw = null; then?.(); } });
        };
        d.snap = open => { d.tw?.stop(); d.tw = null; d.k = open ? 1 : 0; draw(); };
        draw();
        return d;
    }
    static COLOURS = ['red', 'blue', 'yellow'];   // (their rows in gt_circuit, in this order)
    static PIECES = ['h', 'v', 'ne', 'nw', 'se', 'sw', 'tn', 'ts', 'te', 'tw'];
    // L: { breakers: [{ x, y, colour, on }], doors: [{ tiles: [[x, y]], need: [colour] }],
    //      wires: [{ colour, path: [[x, y]] }] (its first and last tiles are what it joins: drawn between), exit: { x, msg } }
    static start(S, L) {
        Breakers.stop(S);
        const T = S.TILE_SIZE, tex = S.textures.get('gt_circuit');
        if (!tex.has('brk_red_0')) Breakers.COLOURS.forEach((c, ci) => {
            [0, 1].forEach(on => tex.add(`brk_${c}_${on}`, 0, (ci * 2 + on) * 12, 0, 12, 12));
            Breakers.PIECES.forEach((p, pi) => [0, 1].forEach(lit => tex.add(`w_${c}_${lit}_${p}`, 0, pi * 12, (1 + ci * 2 + lit) * 12, 12, 12)));
        });
        const at = (x, y) => [x * T + T / 2, y * T + T / 2];
        const st = S._breakers = { L, on: {}, wires: [], doors: [], breakers: [], last: null, through: false };
        for (const b of L.breakers) {
            st.on[b.colour] = !!b.on;
            st.breakers.push({ ...b, img: S.add.image(...at(b.x, b.y), 'gt_circuit', `brk_${b.colour}_${b.on ? 1 : 0}`).setScale(T / 12).setDepth(0.6) });
        }
        const join = new Map();   // every wire tile's ways out, a colour's wires merged (where one splits, a T)
        for (const w of L.wires) for (let i = 1; i < w.path.length - 1; i++) {
            const [x, y] = w.path[i], k = `${w.colour},${x},${y}`, d = join.get(k) || join.set(k, { colour: w.colour, x, y, d: new Set() }).get(k);
            for (const [nx, ny] of [w.path[i - 1], w.path[i + 1]]) d.d.add(nx > x ? 'e' : nx < x ? 'w' : ny > y ? 's' : 'n');
        }
        for (const { colour, x, y, d } of join.values()) {
            const k = [...'nesw'].filter(c => d.has(c)).join('');
            const piece = { ns: 'v', ew: 'h', ne: 'ne', nw: 'nw', es: 'se', sw: 'sw', new: 'tn', esw: 'ts', nes: 'te', nsw: 'tw' }[k] || (d.has('n') || d.has('s') ? 'v' : 'h');
            st.wires.push({ colour, piece, img: S.add.image(...at(x, y), 'gt_circuit', `w_${colour}_0_${piece}`).setScale(T / 12).setDepth(0.95) });   // (run over the walls: no safe lane through a live floor)
        }
        for (const d of L.doors) {
            const need = [...d.need].sort();
            const isDoor = (a, b) => d.tiles.some(([x, y]) => x === a && y === b);
            st.doors.push({ need, tiles: d.tiles.map(([x, y]) => ({ x, y, door: Breakers.door(S, x, y, need.join('+'), isDoor), closed: false })) });
        }
        st.doorSfxAt = S.time.now + 200;   // (no clunk as the room's laid out)
        st.tick = () => Breakers.tick(S); S.events.on('update', st.tick);
        st.off = () => Breakers.stop(S); S.events.once('shutdown', st.off);
        Breakers.refresh(S);
        return st;
    }
    // what's powered now: the breakers' lamps, the wires lit or dark, the doors open or shut (not on anyone standing in one)
    static refresh(S) {
        const st = S._breakers;
        for (const b of st.breakers) b.img.setFrame(`brk_${b.colour}_${st.on[b.colour] ? 1 : 0}`);
        for (const w of st.wires) w.img.setFrame(`w_${w.colour}_${st.on[w.colour] ? 1 : 0}_${w.piece}`);
        for (const d of st.doors) {
            const open = d.need.every(c => st.on[c]);
            for (const t of d.tiles) {
                if (open === !t.closed) continue;
                if (!open && ((t.x === S.playerX && t.y === S.playerY) || (S.enemies || []).some(e => e.sprite?.active && e.x === t.x && e.y === t.y))) continue;   // shuts once it's clear
                t.closed = !open; S.world[t.x][t.y] = open ? S.FLOOR : S.WALL; t.door.set(open);
                if (S.time.now - (st.doorSfxAt || -1e9) > 120) { st.doorSfxAt = S.time.now; Sfx.play(S, open ? 'whoosh' : 'thud'); }
            }
        }
    }
    static tick(S) {
        const st = S._breakers;
        if (!st || S._pauseMenuOpen) return;
        const here = `${S.playerX},${S.playerY}`;
        if (here !== st.last) {   // stepped onto a breaker: it flips
            st.last = here;
            const b = st.breakers.find(b => b.x === S.playerX && b.y === S.playerY);
            if (b) {
                st.on[b.colour] = !st.on[b.colour];
                Sfx.play(S, 'click');
                S.showStatusText?.(S.player.x, S.player.y - 30, `${b.colour.toUpperCase()} ${st.on[b.colour] ? 'ON' : 'OFF'}`, '#' + Breakers.TINT[b.colour].toString(16).padStart(6, '0'));
            }
        }
        Breakers.refresh(S);   // (every frame: a door waits for whoever's standing in it)
        if (!st.through && st.L.exit && S.playerX >= st.L.exit.x) { st.through = true; st.L.exit.msg?.(S); }
    }
    static powered(S, colour) { return !colour || !!S._breakers?.on[colour]; }
    static stop(S) {
        const st = S._breakers;
        if (!st) return;
        S.events.off('update', st.tick); S.events.off('shutdown', st.off);
        for (const o of [...st.breakers, ...st.wires]) o.img.destroy();
        for (const d of st.doors) for (const t of d.tiles) { t.door.tw?.stop(); t.door.img.destroy(); if (t.closed) S.world[t.x][t.y] = S.FLOOR; }
        S._breakers = null;
    }
}
