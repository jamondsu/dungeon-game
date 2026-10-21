// ═══════════════════════════════════════════════════════════════════════════
// LevelLayouts.js — a story level's map, laid out fresh each time you go in.
//
// A level is a RECIPE: its story rooms in order (start ... boss), each a hand-made TEMPLATE
// (its size and the walls inside it, in its own tiles), and a pool of side rooms. generate()
// walks the story rooms out from the start, each one off the last in any direction with a
// corridor between, so the path winds; then hangs the side rooms off rooms along the way
// (chest vaults, an elite den), and now and then joins a side room to a second story room, a
// loop. The story rooms keep their order as indices 0..n-1 (the level's code knows its boss
// room by number); side rooms come after. Each corridor gives both rooms a door on that side,
// which is all the gates need. Returns the rooms, or null if it couldn't fit them (the level
// then builds its fixed map).
// ═══════════════════════════════════════════════════════════════════════════

const LevelLayouts = {
    T: {
        // ── the Gauntlet's rooms (their walls as the fixed map had them, now in room tiles) ──
        g_start:   { w: 12, h: 9 },
        g_pillars: { w: 18, h: 11, walls: [5, 6, 11, 12].flatMap(x => [1, 2, 3, 5, 6, 7].map(y => [x, y])) },
        g_brawl:   { w: 18, h: 16, walls: [[1, 1], [2, 1], [1, 2], [15, 1], [16, 1], [16, 2], [1, 14], [2, 15], [1, 15], [15, 14], [16, 14], [16, 15]] },
        g_choke:   { w: 20, h: 16, walls: Array.from({ length: 16 }, (_, y) => y).filter(y => y !== 7 && y !== 8).map(y => [8, y]) },
        g_lanes:   { w: 20, h: 14, walls: [...Array.from({ length: 18 }, (_, i) => i + 1).filter(x => x !== 5 && x !== 6).map(x => [x, 3]),
                                           ...Array.from({ length: 18 }, (_, i) => i + 1).filter(x => x !== 12 && x !== 13).map(x => [x, 7])] },
        g_ambush:  { w: 22, h: 16, walls: [[3, 2], [3, 9], [14, 2], [14, 9], [8, 5]].flatMap(([x, y]) => [[x, y], [x + 1, y], [x, y + 1], [x + 1, y + 1]]) },
        g_boss:    { w: 24, h: 22, walls: [...[[2, 2], [20, 2], [2, 17], [20, 17]].flatMap(([x, y]) => [[x, y], [x + 1, y], [x, y + 1], [x + 1, y + 1]]),
                                           [11, 2], [12, 2], [11, 18], [12, 18], [2, 10], [2, 11], [21, 10], [21, 11]] },
        // ── side rooms ──
        chest:     { w: 12, h: 9, chest: true, name: 'Chest Room' },
        chest_s:   { w: 10, h: 8, chest: true, name: 'Chest Room' },
        elite:     { w: 14, h: 11, elite: true, name: 'Elite Den', walls: [[4, 3], [9, 3], [4, 7], [9, 7]] },
    },
    RECIPES: {
        gauntlet: { path: ['g_start', 'g_pillars', 'g_brawl', 'g_choke', 'g_lanes', 'g_ambush', 'g_boss'], side: [['chest', 1], ['chest_s', 1], ['elite', 1]], loop: 0.5 },
    },
    DIRS: { E: [1, 0], W: [-1, 0], N: [0, -1], S: [0, 1] },
    OPP: { E: 'W', W: 'E', N: 'S', S: 'N' },

    generate(gen, world, recipe, R = Math.random) {
        for (let tries = 0; tries < 40; tries++) {
            const w = world.map(col => col.slice());
            const rooms = LevelLayouts._try(gen, w, recipe, R);
            if (rooms) { for (let x = 0; x < world.length; x++) world[x] = w[x]; return rooms; }
        }
        return null;
    },

    _try(gen, world, recipe, R) {
        const W = gen.WORLD_WIDTH, H = gen.WORLD_HEIGHT, rooms = [];
        const free = (x, y, w, h, m) => { for (let i = x - m; i < x + w + m; i++) for (let j = y - m; j < y + h + m; j++) if (i < 1 || j < 1 || i >= W - 1 || j >= H - 1 || world[i][j] !== gen.NOTHING) return false; return true; };
        const put = (t, x, y, extra = {}) => {
            const T = LevelLayouts.T[t], room = { x, y, w: T.w, h: T.h, doorPositions: [], tpl: t, ...extra };
            if (T.name) room.name = T.name;
            gen.carveRoom(world, room);
            for (const [dx, dy] of T.walls || []) world[x + dx][y + dy] = gen.WALL;
            rooms.push(room);
            return room;
        };
        // a room off `from` on side d, a corridor of g tiles between, overlapping it by 3+ across the corridor
        const attach = (from, t, dirs, extra) => {
            const T = LevelLayouts.T[t];
            for (let k = 0; k < 30; k++) {
                const d = dirs[Math.floor(R() * dirs.length)], [dx, dy] = LevelLayouts.DIRS[d], g = 3 + Math.floor(R() * 4);
                let x, y;
                if (dx) { x = dx > 0 ? from.x + from.w + g : from.x - g - T.w; y = from.y + 3 - T.h + Math.floor(R() * (from.h + T.h - 6)); }
                else { y = dy > 0 ? from.y + from.h + g : from.y - g - T.h; x = from.x + 3 - T.w + Math.floor(R() * (from.w + T.w - 6)); }
                if (!free(x, y, T.w, T.h, 2)) continue;
                // the corridor: 3 wide, down the middle of where the two overlap
                const lo = dx ? Math.max(from.y, y) : Math.max(from.x, x), hi = dx ? Math.min(from.y + from.h, y + T.h) : Math.min(from.x + from.w, x + T.w), mid = Math.floor((lo + hi) / 2);
                const tiles = [];
                for (let s = 1; s <= g; s++) for (let o = -1; o <= 1; o++) {
                    const cx = dx ? (dx > 0 ? from.x + from.w - 1 + s : from.x - s) : mid + o, cy = dx ? mid + o : (dy > 0 ? from.y + from.h - 1 + s : from.y - s);
                    tiles.push([cx, cy, s]);
                }
                if (tiles.some(([cx, cy]) => world[cx]?.[cy] !== gen.NOTHING)) continue;
                const room = put(t, x, y, extra);
                for (const [cx, cy] of tiles) world[cx][cy] = gen.FLOOR;
                if (!from.doorPositions.some(p => p.direction === d)) from.doorPositions.push({ direction: d });
                room.doorPositions.push({ direction: LevelLayouts.OPP[d] });
                room._entrance = tiles.filter(([, , s]) => s === 1).map(([cx, cy]) => ({ x: cx, y: cy }));   // the corridor's mouth at `from`
                room._from = from;
                return room;
            }
            return null;
        };
        // the story rooms: the start somewhere toward a corner, then each off the last, never doubling straight back
        let last = put(recipe.path[0], 6 + Math.floor(R() * (W * 0.35)), 6 + Math.floor(R() * (H * 0.35)));
        let back = null;
        for (const t of recipe.path.slice(1)) {
            const dirs = Object.keys(LevelLayouts.DIRS).filter(d => d !== back);
            const r = attach(last, t, dirs);
            if (!r) return null;
            back = r.doorPositions[0].direction;   // the way back to `last`: the next room won't go there
            last = r;
        }
        const story = rooms.length;
        // the side rooms, off story rooms between the start and the boss
        for (const [t, n] of recipe.side || []) for (let i = 0; i < n; i++) {
            const T = LevelLayouts.T[t], order = Array.from({ length: story - 2 }, (_, k) => k + 1).sort(() => R() - 0.5);   // every story room in turn till one has space
            for (const pi of order) {
                const r = attach(rooms[pi], t, Object.keys(LevelLayouts.DIRS), T.chest ? { isChestRoom: true, parentTag: 'r' + pi } : {});
                if (!r) continue;
                if (T.chest) r.entranceTiles = r._entrance;
                break;
            }
        }
        // a loop: a side room's far side joined straight to another story room, if one lines up close enough
        if (R() < (recipe.loop || 0)) {
            for (const s of rooms.slice(story)) {
                if (s.isChestRoom) continue;
                for (const r of rooms.slice(1, story - 1)) {
                    if (r === s._from) continue;
                    if (LevelLayouts._join(gen, world, s, r)) { s._looped = true; break; }
                }
                if (s._looped) break;
            }
        }
        for (const r of rooms) { delete r._entrance; delete r._from; }
        return rooms;
    },

    // A straight corridor between two rooms that face each other with 3+ tiles of overlap and 3-10 of clear gap
    _join(gen, world, a, b) {
        for (const d of ['E', 'W', 'N', 'S']) {
            const [dx, dy] = LevelLayouts.DIRS[d];
            const gap = dx ? (dx > 0 ? b.x - (a.x + a.w) : a.x - (b.x + b.w)) : (dy > 0 ? b.y - (a.y + a.h) : a.y - (b.y + b.h));
            const lo = dx ? Math.max(a.y, b.y) : Math.max(a.x, b.x), hi = dx ? Math.min(a.y + a.h, b.y + b.h) : Math.min(a.x + a.w, b.x + b.w);
            if (gap < 3 || gap > 10 || hi - lo < 5) continue;
            const mid = Math.floor((lo + hi) / 2), tiles = [];
            for (let s = 1; s <= gap; s++) for (let o = -1; o <= 1; o++) tiles.push(dx ? [dx > 0 ? a.x + a.w - 1 + s : a.x - s, mid + o] : [mid + o, dy > 0 ? a.y + a.h - 1 + s : a.y - s]);
            if (tiles.some(([x, y]) => world[x]?.[y] !== gen.NOTHING)) continue;
            for (const [x, y] of tiles) world[x][y] = gen.FLOOR;
            if (!a.doorPositions.some(p => p.direction === d)) a.doorPositions.push({ direction: d });
            if (!b.doorPositions.some(p => p.direction === LevelLayouts.OPP[d])) b.doorPositions.push({ direction: LevelLayouts.OPP[d] });
            return true;
        }
        return false;
    },
};
