// ═══════════════════════════════════════════════════════════════════════
// WORLDGEN.JS — World/level generation, room carving, BSP, wall rendering
// ═══════════════════════════════════════════════════════════════════════
// All methods receive GameScene as `this` via .call(scene, ...) from GameScene.js
// Do NOT add local state here — all state lives on the scene object.

class WorldGen {

    generateWorld() {
        // Check if we have a handcrafted level for this index
        if (this.currentLevelIndex === 0) {
            if (this.tutorialStage === 1) return this.generateIceTutorialLevel();
            return this.generateTutorialLevel();
        } else if (this.currentLevelIndex === 1) {
            return this.generateLevel1();
        } else if (this.currentLevelIndex === 2) {
            return this.generateLevel2();
        }

        // Otherwise use procedural generation
        const world = [];
        for (let x = 0; x < this.WORLD_WIDTH; x++) {
            world[x] = [];
            for (let y = 0; y < this.WORLD_HEIGHT; y++) {
                world[x][y] = this.NOTHING;
            }
        }

        const rooms = [];
        const numRooms = 10 + Math.floor(this.rng() * 5); // 10–14 rooms
        let attempts = 0;

        while (rooms.length < numRooms && attempts < 2000) {
            const w = 8 + Math.floor(this.rng() * 10);  // 8–17 tiles wide
            const h = 7 + Math.floor(this.rng() * 8);   // 7–14 tiles tall
            const x = 2 + Math.floor(this.rng() * (this.WORLD_WIDTH - w - 4));
            const y = 2 + Math.floor(this.rng() * (this.WORLD_HEIGHT - h - 4));

            const room = { x, y, w, h };

            if (this.canPlaceRoom(world, room)) {
                this.carveRoom(world, room);
                rooms.push(room);
            }
            attempts++;
        }

        this.connectRoomsMST(world, rooms);
        this.addExtraConnections(world, rooms);
        this.addWalls(world);
        this.rooms = rooms; // store for enemy spawning

        return world;
    }

    generateTutorialLevel() {
        // Tutorial: 4 rooms teaching core mechanics with locked doors
        const world = [];
        for (let x = 0; x < this.WORLD_WIDTH; x++) {
            world[x] = [];
            for (let y = 0; y < this.WORLD_HEIGHT; y++) {
                world[x][y] = this.NOTHING;
            }
        }

        this.rooms = [];

        // Room 1: Movement & Melee (Flame Sword intro)
        const room1 = { x: 10, y: 46, w: 14, h: 10, type: 'melee_intro', doorPositions: [] };
        this.carveRoom(world, room1);
        room1.doorPositions.push({ x: 24, y: 51, direction: 'east' });
        this.rooms.push(room1);

        // Short corridor to room 2
        for (let x = 24; x <= 28; x++) {
            for (let dy = -1; dy <= 1; dy++) {
                world[x][51 + dy] = this.FLOOR;
            }
        }

        // Room 2: Ult Gate (kill enemies then press E)
        const room2 = { x: 29, y: 44, w: 16, h: 14, type: 'ult_intro', doorPositions: [] };
        this.carveRoom(world, room2);
        room2.doorPositions.push({ x: 28, y: 51, direction: 'west' });
        room2.doorPositions.push({ x: 45, y: 51, direction: 'east' });
        this.rooms.push(room2);

        // Corridor to room 3
        for (let x = 45; x <= 52; x++) {
            for (let dy = -1; dy <= 1; dy++) {
                world[x][51 + dy] = this.FLOOR;
            }
        }

        // Room 3: Element Gimmick (Lava intro)
        const room3 = { x: 53, y: 42, w: 18, h: 18, type: 'gimmick_intro', doorPositions: [] };
        this.carveRoom(world, room3);
        room3.doorPositions.push({ x: 52, y: 51, direction: 'west' });
        room3.doorPositions.push({ x: 71, y: 51, direction: 'east' });
        this.rooms.push(room3);

        // Corridor to boss room
        for (let x = 71; x <= 78; x++) {
            for (let dy = -1; dy <= 1; dy++) {
                world[x][51 + dy] = this.FLOOR;
            }
        }

        // Room 4: Boss Arena (Ultimate intro)
        const room4 = { x: 79, y: 38, w: 22, h: 26, type: 'boss_intro', doorPositions: [] };
        this.carveRoom(world, room4);
        room4.doorPositions.push({ x: 78, y: 51, direction: 'west' });
        this.rooms.push(room4);

        this.addWalls(world);

        // Mark this as tutorial for special behavior
        this.isTutorial = true;
        this.currentTutorialRoom = -1; // -1 so room 0 triggers on first enter
        this.tutorialRoomCleared = [false, false, false, false];
        this.tutorialDoorsLocked = [true, true, true, true];
        this.tutorialWeaponLocked = true; // prevents switching elements until room 2

        return world;
    }

    generateIceTutorialLevel() {
        const world = [];
        for (let x = 0; x < this.WORLD_WIDTH; x++) {
            world[x] = [];
            for (let y = 0; y < this.WORLD_HEIGHT; y++) world[x][y] = this.NOTHING;
        }
        this.rooms = [];

        // ── ROW 1 (y≈44): rooms 0-1-2, going east ────────────────────────
        // Room 0: Welcome (x=4..17, y=44..54)
        const room0 = { x: 4, y: 44, w: 14, h: 10, type: 'ice_welcome', doorPositions: [] };
        this.carveRoom(world, room0);
        room0.doorPositions.push({ x: 18, y: 49, direction: 'east' });
        this.rooms.push(room0);

        for (let x = 18; x <= 21; x++)
            for (let dy = -1; dy <= 1; dy++) world[x][49 + dy] = this.FLOOR;

        // Room 1: Sword sweep (x=22..38, y=43..56)
        const room1 = { x: 22, y: 43, w: 16, h: 13, type: 'sword_sweep', doorPositions: [] };
        this.carveRoom(world, room1);
        room1.doorPositions.push({ x: 21, y: 49, direction: 'west' });
        room1.doorPositions.push({ x: 38, y: 49, direction: 'east' });
        this.rooms.push(room1);

        for (let x = 38; x <= 41; x++)
            for (let dy = -1; dy <= 1; dy++) world[x][49 + dy] = this.FLOOR;

        // Room 2: Ice fists intro (x=42..57, y=41..58)
        const room2 = { x: 42, y: 41, w: 16, h: 16, type: 'ice_intro', doorPositions: [] };
        this.carveRoom(world, room2);
        room2.doorPositions.push({ x: 41, y: 49, direction: 'west' });
        room2.doorPositions.push({ x: 58, y: 49, direction: 'east' });
        this.rooms.push(room2);

        for (let x = 58; x <= 61; x++)
            for (let dy = -1; dy <= 1; dy++) world[x][49 + dy] = this.FLOOR;

        // Room 3: Ice ult gate (x=62..77, y=43..56)
        const room3 = { x: 62, y: 43, w: 16, h: 13, type: 'ice_ult_gate', doorPositions: [] };
        this.carveRoom(world, room3);
        room3.doorPositions.push({ x: 61, y: 49, direction: 'west' });
        room3.doorPositions.push({ x: 78, y: 49, direction: 'east' });
        this.rooms.push(room3);

        for (let x = 78; x <= 81; x++)
            for (let dy = -1; dy <= 1; dy++) world[x][49 + dy] = this.FLOOR;

        // Room 4: Trap room (x=82..99, y=41..62)
        const room4 = { x: 82, y: 41, w: 17, h: 20, type: 'trap_intro', doorPositions: [] };
        this.carveRoom(world, room4);
        room4.doorPositions.push({ x: 81, y: 49, direction: 'west' });
        room4.doorPositions.push({ x: 90, y: 60, direction: 'south' });
        this.rooms.push(room4);

        // Corridor south from room 4 down to room 5 — starts at y=61 to connect flush with room bottom (y=60)
        for (let y = 61; y <= 65; y++)
            for (let dx2 = -1; dx2 <= 1; dx2++) world[90 + dx2][y] = this.FLOOR;

        // Room 5: Final mix (x=75..97, y=66..86)
        const room5 = { x: 75, y: 66, w: 22, h: 20, type: 'ice_final', doorPositions: [] };
        this.carveRoom(world, room5);
        room5.doorPositions.push({ x: 90, y: 66, direction: 'north' });
        room5.doorPositions.push({ x: 75, y: 76, direction: 'west' });
        this.rooms.push(room5);

        // Corridor west from room 5 to room 6
        for (let x = 64; x <= 75; x++)
            for (let dy = -1; dy <= 1; dy++) world[x][76 + dy] = this.FLOOR;

        // Room 6: Spawner room (x=44..64, y=66..86)
        const room6 = { x: 44, y: 66, w: 20, h: 20, type: 'spawner_room', doorPositions: [] };
        this.carveRoom(world, room6);
        room6.doorPositions.push({ x: 64, y: 76, direction: 'east' });
        this.rooms.push(room6);

        this.addWalls(world);

        this.isTutorial = true;
        this.isIceTutorial = true;
        this.currentTutorialRoom = -1;
        this.tutorialRoomCleared = [false, false, false, false, false, false, false];
        this.tutorialDoorsLocked = [true, true, true, true, true, true, true];
        this.tutorialWeaponLocked = false;
        this._iceGlerpFired = false;
        this._iceUltUsed = false;
        this.tutorialIceUnlocked = false; // unlocks when Glerp reacts to ice-immune enemy

        return world;
    }

    generateLevel1() {
        // Level 1 - "The Corridor": T-junction layout with enemy-filled branches
        const world = [];
        for (let x = 0; x < this.WORLD_WIDTH; x++) {
            world[x] = [];
            for (let y = 0; y < this.WORLD_HEIGHT; y++) {
                world[x][y] = this.NOTHING;
            }
        }

        this.rooms = [];

        // Starting room (small, safe)
        const startRoom = { x: 12, y: 46, w: 10, h: 8 };
        this.carveRoom(world, startRoom);
        this.rooms.push(startRoom);

        // Main corridor leading forward
        for (let x = 22; x <= 42; x++) {
            for (let dy = -1; dy <= 1; dy++) {
                world[x][50 + dy] = this.FLOOR;
            }
        }

        // T-junction hub (medium room where paths split)
        const hubRoom = { x: 43, y: 44, w: 14, h: 12 };
        this.carveRoom(world, hubRoom);
        this.rooms.push(hubRoom);

        // Left branch corridor
        for (let x = 30; x <= 42; x++) {
            for (let dy = -1; dy <= 1; dy++) {
                world[x][38 + dy] = this.FLOOR;
            }
        }

        // Left branch room (combat - 5 enemies)
        const leftRoom = { x: 18, y: 30, w: 12, h: 16 };
        this.carveRoom(world, leftRoom);
        this.rooms.push(leftRoom);

        // Right branch corridor
        for (let x = 58; x <= 70; x++) {
            for (let dy = -1; dy <= 1; dy++) {
                world[x][38 + dy] = this.FLOOR;
            }
        }

        // Right branch room (combat - 5 enemies)
        const rightRoom = { x: 71, y: 30, w: 12, h: 16 };
        this.carveRoom(world, rightRoom);
        this.rooms.push(rightRoom);

        // Forward corridor from hub
        for (let x = 57; x <= 75; x++) {
            for (let dy = -1; dy <= 1; dy++) {
                world[x][50 + dy] = this.FLOOR;
            }
        }

        // Final boss room (large arena - 8 enemies)
        const bossRoom = { x: 76, y: 40, w: 22, h: 20 };
        this.carveRoom(world, bossRoom);
        this.rooms.push(bossRoom);

        this.addWalls(world);
        return world;
    }

    generateLevel2() {
        // ── Level 2: "The Gauntlet" ──────────────────────────────────────────
        // 7 rooms: start safe → 5 combat rooms → boss arena, all linear east then south
        // Uses isTutorial=true so the full door/barrier/room-clear system works.
        // Room indices: 0=start, 1=corridor, 2=wide brawl, 3=chokepoint,
        //               4=trap maze, 5=ambush, 6=boss arena
        //
        // Layout (world coords, TILE_SIZE=24):
        //
        //  [R0]──[R1]──[R2]──[R3]
        //                     │
        //                    [R4]
        //                     │
        //              [R6]──[R5]
        //
        // Secret branch room hangs off R2 to the north — no barriers, free explore.

        const world = [];
        for (let x = 0; x < this.WORLD_WIDTH; x++) {
            world[x] = [];
            for (let y = 0; y < this.WORLD_HEIGHT; y++) world[x][y] = this.NOTHING;
        }
        this.rooms = [];

        // ── ROOM 0: Safe start (12×9) ──────────────────────────────────────
        const r0 = { x: 4, y: 44, w: 12, h: 9, doorPositions: [] };
        this.carveRoom(world, r0);
        r0.doorPositions.push({ x: 16, y: 48, direction: 'east' });
        this.rooms.push(r0); // rooms[0]

        // Corridor east from R0 → R1
        for (let x = 16; x <= 19; x++)
            for (let dy = -1; dy <= 1; dy++) world[x][48 + dy] = this.FLOOR;

        // ── ROOM 1: Pillar corridor (18×9) ─────────────────────────────────
        // Two thick pillar columns force lane choice
        const r1 = { x: 20, y: 43, w: 18, h: 11, doorPositions: [] };
        this.carveRoom(world, r1);
        r1.doorPositions.push({ x: 20, y: 48, direction: 'west' });
        r1.doorPositions.push({ x: 37, y: 48, direction: 'east' });
        // Pillar A — blocks centre-north lane
        world[25][44] = this.WALL; world[25][45] = this.WALL; world[25][46] = this.WALL;
        world[26][44] = this.WALL; world[26][45] = this.WALL; world[26][46] = this.WALL;
        // Gap at 47 — one-tile passage
        world[25][48] = this.WALL; world[25][49] = this.WALL; world[25][50] = this.WALL;
        world[26][48] = this.WALL; world[26][49] = this.WALL; world[26][50] = this.WALL;
        // Pillar B — mirror east side
        world[31][44] = this.WALL; world[31][45] = this.WALL; world[31][46] = this.WALL;
        world[32][44] = this.WALL; world[32][45] = this.WALL; world[32][46] = this.WALL;
        world[31][48] = this.WALL; world[31][49] = this.WALL; world[31][50] = this.WALL;
        world[32][48] = this.WALL; world[32][49] = this.WALL; world[32][50] = this.WALL;
        this.rooms.push(r1); // rooms[1]

        // Corridor east from R1 → R2
        for (let x = 38; x <= 41; x++)
            for (let dy = -1; dy <= 1; dy++) world[x][48 + dy] = this.FLOOR;

        // ── ROOM 2: Wide brawl (18×16) ─────────────────────────────────────
        // Open room, corner barriers, secret branch goes north from here
        const r2 = { x: 42, y: 40, w: 18, h: 16, doorPositions: [] };
        this.carveRoom(world, r2);
        r2.doorPositions.push({ x: 42, y: 48, direction: 'west' });
        r2.doorPositions.push({ x: 59, y: 48, direction: 'east' });
        // Corner barriers — make enemies harder to kite
        world[43][41] = this.WALL; world[44][41] = this.WALL; world[43][42] = this.WALL;
        world[57][41] = this.WALL; world[58][41] = this.WALL; world[58][42] = this.WALL;
        world[43][54] = this.WALL; world[44][55] = this.WALL; world[43][55] = this.WALL;
        world[57][54] = this.WALL; world[58][54] = this.WALL; world[58][55] = this.WALL;
        this.rooms.push(r2); // rooms[2]

        // ── RANDOM CHEST BRANCH ROOMS (1 or 2) ────────────────────────────
        // Pick 1-2 random candidate rooms to sprout a small chest branch off of.
        // Candidates and their branch directions/coords are predefined to guarantee
        // they don't overlap other rooms. Each has a 65% chance to spawn.
        // rooms[3..] will be the chest rooms (variable count).

        const chestCandidates = [
            // { parentRoom, branchDir, corridorTiles, room definition }
            {
                // North off R2
                corridor: () => { for (let y = 32; y <= 40; y++) for (let dx = -1; dx <= 1; dx++) world[51+dx][y] = this.FLOOR; },
                room: { x: 46, y: 24, w: 12, h: 9 },
            },
            {
                // South off R1 (pillar corridor)
                corridor: () => { for (let y = 54; y <= 57; y++) for (let dx = -1; dx <= 1; dx++) world[28+dx][y] = this.FLOOR; },
                room: { x: 23, y: 58, w: 10, h: 8 },
            },
            {
                // South off R3 (L-shape) — hangs below the horizontal arm
                corridor: () => { for (let y = 56; y <= 59; y++) for (let dx = -1; dx <= 1; dx++) world[68+dx][y] = this.FLOOR; },
                room: { x: 64, y: 60, w: 10, h: 8 },
            },
        ];

        // Pick 1 or 2 randomly (each independently has 65% chance, min 1)
        const shuffled = chestCandidates.sort(() => Math.random() - 0.5);
        let chestCount = 0;
        for (const candidate of shuffled) {
            if (chestCount >= 2) break;
            if (chestCount === 0 || Math.random() < 0.65) {
                candidate.corridor();
                const r = { ...candidate.room, doorPositions: [], isChestRoom: true };
                this.carveRoom(world, r);
                this.rooms.push(r); // rooms[3], maybe rooms[4]
                chestCount++;
            }
        }
        // Guarantee at least 1
        if (chestCount === 0) {
            const c = chestCandidates[0];
            c.corridor();
            const r = { ...c.room, doorPositions: [], isChestRoom: true };
            this.carveRoom(world, r);
            this.rooms.push(r);
        }

        // Corridor east from R2 → R3
        for (let x = 60; x <= 63; x++)
            for (let dy = -1; dy <= 1; dy++) world[x][48 + dy] = this.FLOOR;

        // ── ROOM 3: L-shape chokepoint ──────────────────────────────────────
        // Wide horizontal arm + narrow vertical shaft, internal wall with gap
        const r3 = { x: 64, y: 40, w: 20, h: 16, doorPositions: [] };
        this.carveRoom(world, r3);
        r3.doorPositions.push({ x: 64, y: 48, direction: 'west' });
        r3.doorPositions.push({ x: 74, y: 55, direction: 'south' });
        // Internal dividing wall with single gap — enemies pile on far side
        for (let y = 40; y <= 55; y++) {
            if (y === 47 || y === 48) continue; // gap
            world[72][y] = this.WALL;
        }
        this.rooms.push(r3); // rooms[4]

        // Corridor south from R3 → R4
        for (let y = 56; y <= 59; y++)
            for (let dx = -1; dx <= 1; dx++) world[74 + dx][y] = this.FLOOR;

        // ── ROOM 4: Spike trap maze (18×14) ────────────────────────────────
        // Horizontal wall rows with offset gaps — three narrow lanes
        const r4 = { x: 65, y: 60, w: 20, h: 14, doorPositions: [] };
        this.carveRoom(world, r4);
        r4.doorPositions.push({ x: 74, y: 60, direction: 'north' });
        r4.doorPositions.push({ x: 65, y: 67, direction: 'west' });
        // Wall row 1 — gap at x=70,71
        for (let x = 66; x <= 83; x++) {
            if (x === 70 || x === 71) continue;
            world[x][63] = this.WALL;
        }
        // Wall row 2 — gap at x=77,78 (offset from row 1)
        for (let x = 66; x <= 83; x++) {
            if (x === 77 || x === 78) continue;
            world[x][67] = this.WALL;
        }
        this.rooms.push(r4); // rooms[5]

        // Corridor west from R4 → R5
        for (let y = 67; y <= 67; y++)
            for (let x = 57; x <= 65; x++) world[x][y] = this.FLOOR;

        // ── ROOM 5: Ambush (20×16) ─────────────────────────────────────────
        // Large open room with 2×2 pillar clusters enemies hide behind
        const r5 = { x: 36, y: 60, w: 22, h: 16, doorPositions: [] };
        this.carveRoom(world, r5);
        r5.doorPositions.push({ x: 57, y: 67, direction: 'east' });
        r5.doorPositions.push({ x: 36, y: 67, direction: 'west' });
        // Pillar clusters
        [[39,62],[39,69],[50,62],[50,69],[44,65]].forEach(([px, py]) => {
            world[px][py] = this.WALL; world[px+1][py] = this.WALL;
            world[px][py+1] = this.WALL; world[px+1][py+1] = this.WALL;
        });
        this.rooms.push(r5); // rooms[6]

        // Corridor west from R5 → Boss
        for (let x = 18; x <= 36; x++)
            for (let dy = -1; dy <= 1; dy++) world[x][67 + dy] = this.FLOOR;

        // ── ROOM 6: Boss Arena (24×22) ─────────────────────────────────────
        // Large arena — ring of pillars near edges for dodge cover
        const rBoss = { x: 4, y: 57, w: 24, h: 22, doorPositions: [] };
        this.carveRoom(world, rBoss);
        rBoss.doorPositions.push({ x: 17, y: 67, direction: 'east' });
        // 4 corner pillar pairs give the player cover while dodging
        [[6,59],[24,59],[6,74],[24,74]].forEach(([px,py]) => {
            world[px][py] = this.WALL; world[px+1][py] = this.WALL;
            world[px][py+1] = this.WALL; world[px+1][py+1] = this.WALL;
        });
        // Mid-edge single pillars punish wall-hugging
        world[15][59] = this.WALL; world[16][59] = this.WALL;
        world[15][75] = this.WALL; world[16][75] = this.WALL;
        world[6][67]  = this.WALL; world[6][68]  = this.WALL;
        world[25][67] = this.WALL; world[25][68] = this.WALL;
        this.rooms.push(rBoss); // rooms[7]

        this.addWalls(world);

        this.isTutorial          = false;
        this.isIceTutorial       = false;
        this.isLightningTutorial = false;
        this.isLevel2            = true;
        this.currentTutorialRoom = -1;
        this.tutorialWeaponLocked = false;

        // Dynamic door/clear arrays — chest rooms (isChestRoom) and room 0 never locked
        this.tutorialRoomCleared = this.rooms.map(() => false);
        this.tutorialDoorsLocked = this.rooms.map((r, i) => {
            if (i === 0) return false;
            if (r.isChestRoom) return false;
            return true;
        });
        this.tutorialRoomCleared[0] = true;

        return world;
    }

    canPlaceRoom(world, room) {
        for (let x = room.x - 1; x <= room.x + room.w; x++) {
            for (let y = room.y - 1; y <= room.y + room.h; y++) {
                if (world[x][y] !== this.NOTHING) return false;
            }
        }
        return true;
    }

    carveRoom(world, room) {
        for (let x = room.x; x < room.x + room.w; x++) {
            for (let y = room.y; y < room.y + room.h; y++) {
                world[x][y] = this.FLOOR;
            }
        }
    }

    connectRoomsMST(world, rooms) {
        if (rooms.length === 0) return;

        const connected = [rooms[0]];
        const unconnected = rooms.slice(1);

        while (unconnected.length > 0) {
            let bestDist = Infinity;
            let bestFrom = null;
            let bestTo = null;
            let bestIdx = -1;

            for (let i = 0; i < connected.length; i++) {
                for (let j = 0; j < unconnected.length; j++) {
                    const dist = this.roomDistance(connected[i], unconnected[j]);
                    if (dist < bestDist) {
                        bestDist = dist;
                        bestFrom = connected[i];
                        bestTo = unconnected[j];
                        bestIdx = j;
                    }
                }
            }

            this.connectRooms(world, bestFrom, bestTo);
            connected.push(bestTo);
            unconnected.splice(bestIdx, 1);
        }
    }

    addExtraConnections(world, rooms) {
        const extraConnections = 2 + Math.floor(this.rng() * 2);
        for (let i = 0; i < extraConnections; i++) {
            const a = rooms[Math.floor(this.rng() * rooms.length)];
            const b = rooms[Math.floor(this.rng() * rooms.length)];
            if (a !== b) {
                this.connectRooms(world, a, b);
            }
        }
    }

    roomDistance(a, b) {
        const ax = a.x + a.w / 2;
        const ay = a.y + a.h / 2;
        const bx = b.x + b.w / 2;
        const by = b.y + b.h / 2;
        return Math.abs(ax - bx) + Math.abs(ay - by);
    }

    connectRooms(world, a, b) {
        const ax = Math.floor(a.x + a.w / 2);
        const ay = Math.floor(a.y + a.h / 2);
        const bx = Math.floor(b.x + b.w / 2);
        const by = Math.floor(b.y + b.h / 2);
        const hw = 1; // half-width — gives 3 tile wide corridor (hw*2+1)

        // Horizontal segment
        const minX = Math.min(ax, bx);
        const maxX = Math.max(ax, bx);
        for (let x = minX; x <= maxX; x++) {
            for (let o = -hw; o <= hw; o++) {
                const ty = ay + o;
                if (ty >= 0 && ty < this.WORLD_HEIGHT) world[x][ty] = this.FLOOR;
            }
        }
        // Vertical segment
        const minY = Math.min(ay, by);
        const maxY = Math.max(ay, by);
        for (let y = minY; y <= maxY; y++) {
            for (let o = -hw; o <= hw; o++) {
                const tx = bx + o;
                if (tx >= 0 && tx < this.WORLD_WIDTH) world[tx][y] = this.FLOOR;
            }
        }
    }

    addWalls(world) {
        for (let x = 0; x < this.WORLD_WIDTH; x++) {
            for (let y = 0; y < this.WORLD_HEIGHT; y++) {
                if (world[x][y] === this.NOTHING) {
                    if (this.hasFloorNeighbor(world, x, y)) {
                        world[x][y] = this.WALL;
                    }
                }
            }
        }
    }

    hasFloorNeighbor(world, x, y) {
        for (let dx = -1; dx <= 1; dx++) {
            for (let dy = -1; dy <= 1; dy++) {
                const nx = x + dx;
                const ny = y + dy;
                if (nx >= 0 && nx < this.WORLD_WIDTH && ny >= 0 && ny < this.WORLD_HEIGHT) {
                    if (world[nx][ny] === this.FLOOR) return true;
                }
            }
        }
        return false;
    }

    isFloor(x, y) {
        if (x < 0 || x >= this.WORLD_WIDTH || y < 0 || y >= this.WORLD_HEIGHT) {
            return false;
        }
        return this.world[x][y] === this.FLOOR;
    }

    getWallFrame(x, y) {
        const N = this.isFloor(x, y - 1);
        const S = this.isFloor(x, y + 1);
        const E = this.isFloor(x + 1, y);
        const W = this.isFloor(x - 1, y);
        const NE = this.isFloor(x + 1, y - 1);
        const NW = this.isFloor(x - 1, y - 1);
        const SE = this.isFloor(x + 1, y + 1);
        const SW = this.isFloor(x - 1, y + 1);

        if (NE && !N && !E) return this.FRAMES.CORNER_BOTTOM_LEFT;
        if (NW && !N && !W) return this.FRAMES.CORNER_BOTTOM_RIGHT;
        if (SE && !S && !E) return this.FRAMES.CORNER_TOP_LEFT;
        if (SW && !S && !W) return this.FRAMES.CORNER_TOP_RIGHT;

        if (S && E) return this.FRAMES.CORNER_BOTTOM_RIGHT;
        if (S && W) return this.FRAMES.CORNER_BOTTOM_LEFT;
        if (N && E) return this.FRAMES.CORNER_TOP_RIGHT;
        if (N && W) return this.FRAMES.CORNER_TOP_LEFT;

        if (S) return this.FRAMES.WALL_TOP;
        if (N) return this.FRAMES.WALL_BOTTOM;
        if (E) return this.FRAMES.WALL_LEFT;
        if (W) return this.FRAMES.WALL_RIGHT;

        return this.FRAMES.WALL_FILLER;
    }

    renderWorld() {
        for (let x = 0; x < this.WORLD_WIDTH; x++) {
            for (let y = 0; y < this.WORLD_HEIGHT; y++) {
                const tile = this.world[x][y];
                if (tile === this.FLOOR) {
                    this.add.sprite(
                        x * this.TILE_SIZE + this.TILE_SIZE / 2,
                        y * this.TILE_SIZE + this.TILE_SIZE / 2,
                        'tiles', this.FRAMES.FLOOR
                    ).setScale(this.TILE_SCALE);
                } else if (tile === this.WALL) {
                    const frame = this.getWallFrame(x, y);
                    this.add.sprite(
                        x * this.TILE_SIZE + this.TILE_SIZE / 2,
                        y * this.TILE_SIZE + this.TILE_SIZE / 2,
                        'tiles', frame
                    ).setScale(this.TILE_SCALE);
                }
            }
        }
    }

    placePlayer() {
        for (let x = 0; x < this.WORLD_WIDTH; x++) {
            for (let y = 0; y < this.WORLD_HEIGHT; y++) {
                if (this.world[x][y] === this.FLOOR) {
                    this.playerX = x;
                    this.playerY = y;
                    this.player = this.add.sprite(
                        x * this.TILE_SIZE + this.TILE_SIZE / 2,
                        y * this.TILE_SIZE + this.TILE_SIZE / 2 + this.SLIME_Y_OFFSET,
                        'slime_blue', 0
                    );
                    this.player.setScale(this.SLIME_SCALE);
                    this.player.setDepth(1);
                    return;
                }
            }
        }
    }

    createRng(seed) {
        let s = seed;
        return function() {
            s = (s * 9301 + 49297) % 233280;
            return s / 233280;
        };
    }

}