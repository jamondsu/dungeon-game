// ═══════════════════════════════════════════════════════════════════════
// WORLDGEN.JS — World/level generation, room carving, BSP, wall rendering
// ═══════════════════════════════════════════════════════════════════════
// All methods receive GameScene as `this` via .call(scene, ...) from GameScene.js
// Do NOT add local state here — all state lives on the scene object.

class WorldGen {

    generateWorld() {
        if (this.towerRun) return this.generateTowerArena();   // Tower.js
        if (this.trainingRun) return Training.world(this);    // Training.js
        // Check if we have a handcrafted level for this index
        if (this.currentLevelIndex === 0) {
            if (this.tutorialStage === 1) return this.generateIceTutorialLevel();
            return this.generateTutorialLevel();
        } else if (this.currentLevelIndex === 1) {
            return this.generateLevel1();
        } else if (this.currentLevelIndex === 2) {
            return this.generateLevel2();
        } else if (this.currentLevelIndex === 3) {
            return this.generateLevel3();
        } else if (this.currentLevelIndex === 4) {
            return this.generateLevel4();
        } else if (this.currentLevelIndex === 5) {
            return this.generateLevel6();
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
        this.rooms.push(r3); // rooms[3]

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
        this.rooms.push(r4); // rooms[4]

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
        this.rooms.push(r5); // rooms[5]

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
        this.rooms.push(rBoss); // rooms[6]

        // ── CHEST BRANCH ROOMS — placed AFTER all main rooms are carved ───────
        // This ensures canPlaceRoom correctly rejects anything overlapping main rooms.
        const chestCandidates = [
            {
                room:         { x: 46, y: 24, w: 12, h: 9 },
                corridor:     (w) => { for (let y = 33; y <= 40; y++) for (let dx = -1; dx <= 1; dx++) w[51+dx][y] = this.FLOOR; },
                entranceTiles: [{ x:50,y:40 },{ x:51,y:40 },{ x:52,y:40 }],
                parentTag:    'r2',
            },
            {
                room:         { x: 23, y: 55, w: 10, h: 8 },
                corridor:     (w) => { for (let dx = -1; dx <= 1; dx++) w[28+dx][54] = this.FLOOR; },
                entranceTiles: [{ x:27,y:54 },{ x:28,y:54 },{ x:29,y:54 }],
                parentTag:    'r1',
            },
            {
                // East of R3 — corridor goes right from R3's east wall at mid-height
                room:         { x: 86, y: 43, w: 10, h: 8 },
                corridor:     (w) => { for (let x = 84; x <= 85; x++) for (let dy = -1; dy <= 1; dy++) w[x][47+dy] = this.FLOOR; },
                entranceTiles: [{ x:84,y:46 },{ x:84,y:47 },{ x:84,y:48 }],
                parentTag:    'r3',
            },
        ];

        const shuffled = [...chestCandidates].sort(() => Math.random() - 0.5);
        let placed = 0;
        for (const c of shuffled) {
            if (placed >= 2) break;
            if (this.canPlaceRoom(world, c.room)) {
                c.corridor(world);
                const r = { ...c.room, doorPositions: [], isChestRoom: true, entranceTiles: c.entranceTiles, parentTag: c.parentTag };
                this.carveRoom(world, r);
                this.rooms.push(r);
                placed++;
            }
        }
        if (placed === 0) {
            for (const c of chestCandidates) {
                if (this.canPlaceRoom(world, c.room)) {
                    c.corridor(world);
                    const r = { ...c.room, doorPositions: [], isChestRoom: true, entranceTiles: c.entranceTiles, parentTag: c.parentTag };
                    this.carveRoom(world, r);
                    this.rooms.push(r);
                    break;
                }
            }
        }

        this.addWalls(world);

        // Level 2 is a real dungeon — NOT isTutorial
        this.isTutorial          = false;
        this.isIceTutorial       = false;
        this.isLightningTutorial = false;
        this.isLevel2            = true;
        this.currentTutorialRoom = -1;
        this.tutorialWeaponLocked = false;

        // Dynamic arrays — chest rooms and room 0 never locked
        this.tutorialRoomCleared = this.rooms.map(() => false);
        this.tutorialDoorsLocked = this.rooms.map((r, i) => {
            if (i === 0) return false;       // safe start
            if (r.isChestRoom) return false; // free explore
            return true;
        });
        this.tutorialRoomCleared[0] = true;

        this._dressRooms(world, 'gauntlet', [], [[16, 67]]);   // the Voltslime's room left clear
        return world;
    }

    generateLevel3() {
        // ── Level 3: "The Void Rift" ─────────────────────────────────────────
        // Hub-and-spoke layout. All coords fit within WORLD_WIDTH:120, WORLD_HEIGHT:100
        //
        //                [R2: Cosmic Tutorial]  (north)
        //                       │
        //  [R1: Crucible] ── [R0: Spawn] ── [R3: Ult Gauntlet]
        //                       │
        //                 [R4: Sniper Hall]
        //                       │
        //                 [R5: QS Chamber]
        //                       │
        //                 [R6: Boss Arena]
        //
        // Chest rooms off R1(NW) and R3(NE)

        const world = [];
        for (let x = 0; x < this.WORLD_WIDTH; x++) {
            world[x] = [];
            for (let y = 0; y < this.WORLD_HEIGHT; y++) world[x][y] = this.NOTHING;
        }
        this.rooms = [];

        // ── ROOM 0: Spawn (14×10) — safe hub ────────────────────────────────
        const r0 = { x: 43, y: 28, w: 14, h: 10, doorPositions: [] };
        this.carveRoom(world, r0);
        r0.doorPositions.push({ x: 43, y: 33, direction: 'west'  });
        r0.doorPositions.push({ x: 57, y: 33, direction: 'east'  });
        r0.doorPositions.push({ x: 50, y: 28, direction: 'north' });
        r0.doorPositions.push({ x: 50, y: 38, direction: 'south' });
        [[44,29],[55,29],[44,36],[55,36]].forEach(([px,py]) => {
            world[px][py] = this.WALL; world[px+1][py] = this.WALL;
        });
        this.rooms.push(r0); // rooms[0]

        // ── ROOM 1: Elemental Crucible (20×14) — WEST ───────────────────────
        for (let x = 38; x <= 42; x++)
            for (let dy = -1; dy <= 1; dy++) world[x][33 + dy] = this.FLOOR;
        const r1 = { x: 18, y: 22, w: 20, h: 14, doorPositions: [] };
        this.carveRoom(world, r1);
        r1.doorPositions.push({ x: 38, y: 33, direction: 'east' });
        for (let y = 22; y <= 32; y++) world[30][y] = this.WALL;
        world[30][30] = this.FLOOR; world[30][31] = this.FLOOR;
        [[20,24],[35,24],[20,33],[35,33]].forEach(([px,py]) => { world[px][py] = this.WALL; });
        this.rooms.push(r1); // rooms[1]

        // ── ROOM 2: Cosmic Tutorial (12×10) — NORTH ─────────────────────────
        for (let y = 20; y <= 28; y++)
            for (let dx = -1; dx <= 1; dx++) world[50 + dx][y] = this.FLOOR;
        const r2 = { x: 44, y: 10, w: 12, h: 10, doorPositions: [] };
        this.carveRoom(world, r2);
        r2.doorPositions.push({ x: 50, y: 20, direction: 'south' });
        world[44][12] = this.FLOOR; world[44][13] = this.FLOOR;
        world[55][12] = this.FLOOR; world[55][13] = this.FLOOR;
        world[44][17] = this.FLOOR; world[44][18] = this.FLOOR;
        world[55][17] = this.FLOOR; world[55][18] = this.FLOOR;
        this.rooms.push(r2); // rooms[2]

        // ── ROOM 3: Ult Gauntlet (22×14) — EAST ─────────────────────────────
        for (let x = 57; x <= 62; x++)
            for (let dy = -1; dy <= 1; dy++) world[x][33 + dy] = this.FLOOR;
        const r3 = { x: 63, y: 23, w: 22, h: 14, doorPositions: [] };
        this.carveRoom(world, r3);
        r3.doorPositions.push({ x: 63, y: 33, direction: 'west' });
        [[65,25],[80,25],[65,33],[80,33],[72,25],[72,33]].forEach(([px,py]) => {
            world[px][py] = this.WALL; world[px+1][py] = this.WALL;
        });
        this.rooms.push(r3); // rooms[3]

        // ── ROOM 4: Sniper Hall (20×12) — SOUTH ─────────────────────────────
        for (let y = 38; y <= 43; y++)
            for (let dx = -1; dx <= 1; dx++) world[50 + dx][y] = this.FLOOR;
        const r4 = { x: 40, y: 44, w: 20, h: 12, doorPositions: [] };
        this.carveRoom(world, r4);
        r4.doorPositions.push({ x: 50, y: 44, direction: 'north' });
        r4.doorPositions.push({ x: 50, y: 56, direction: 'south' });
        [[41,46],[57,46],[41,52],[57,52]].forEach(([px,py]) => {
            world[px][py] = this.WALL; world[px+1][py] = this.WALL;
            world[px][py+1] = this.WALL; world[px+1][py+1] = this.WALL;
        });
        world[49][50] = this.WALL; world[50][50] = this.WALL;
        this.rooms.push(r4); // rooms[4]

        // ── ROOM 5: Queen Slime Chamber (26×12) ─────────────────────────────
        for (let y = 56; y <= 60; y++)
            for (let dx = -1; dx <= 1; dx++) world[50 + dx][y] = this.FLOOR;
        const r5 = { x: 37, y: 61, w: 26, h: 12, doorPositions: [] };
        this.carveRoom(world, r5);
        r5.doorPositions.push({ x: 50, y: 61, direction: 'north' });
        r5.doorPositions.push({ x: 50, y: 73, direction: 'south' });
        for (let y = 61; y <= 72; y++) {
            if (y === 65 || y === 66 || y === 70 || y === 71) continue;
            world[50][y] = this.WALL;
        }
        this.rooms.push(r5); // rooms[5]

        // ── ROOM 6: Boss Arena (30×22) ───────────────────────────────────────
        for (let y = 73; y <= 77; y++)
            for (let dx = -1; dx <= 1; dx++) world[50 + dx][y] = this.FLOOR;
        const r6 = { x: 34, y: 78, w: 32, h: 20, doorPositions: [] };
        this.carveRoom(world, r6);
        r6.doorPositions.push({ x: 50, y: 78, direction: 'north' });
        // 4 corner pillars — destroyable at phase 2
        [[36,80],[60,80],[36,94],[60,94]].forEach(([px,py]) => {
            world[px][py] = this.WALL; world[px+1][py] = this.WALL;
            world[px][py+1] = this.WALL; world[px+1][py+1] = this.WALL;
        });
        // Mid-wall cover
        world[49][80] = this.WALL; world[50][80] = this.WALL;
        world[49][96] = this.WALL; world[50][96] = this.WALL;
        world[35][88] = this.WALL; world[35][89] = this.WALL;
        world[63][88] = this.WALL; world[63][89] = this.WALL;
        this.rooms.push(r6); // rooms[6]

        // ── CHEST BRANCH ROOMS ───────────────────────────────────────────────
        // Off R1 north-west
        const c1 = { x: 18, y: 10, w: 10, h: 9, isChestRoom: true };
        for (let y = 13; y <= 21; y++)
            for (let dx = -1; dx <= 1; dx++) world[23 + dx][y] = this.FLOOR;
        this.carveRoom(world, c1);
        this.rooms.push(c1);

        // Off R3 north-east
        const c2 = { x: 73, y: 10, w: 10, h: 9, isChestRoom: true };
        for (let y = 13; y <= 22; y++)
            for (let dx = -1; dx <= 1; dx++) world[78 + dx][y] = this.FLOOR;
        this.carveRoom(world, c2);
        this.rooms.push(c2);

        this.addWalls(world);

        this.isTutorial          = false;
        this.isIceTutorial       = false;
        this.isLightningTutorial = false;
        this.isLevel2            = false;
        this.isLevel3            = true;
        this.currentTutorialRoom = -1;
        this.tutorialWeaponLocked = false;

        this.tutorialRoomCleared = this.rooms.map(() => false);
        this.tutorialDoorsLocked = this.rooms.map((r, i) => {
            if (i === 0) return false;
            if (r.isChestRoom) return false;
            return true;
        });
        this.tutorialRoomCleared[0] = true;

        this._dressRooms(world, 'voidrift', [], [[50, 88], [20, 34], [42, 66], [56, 66]]);   // the Sovereign's and the Queens' rooms left clear
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

    // ── ROOM DRESSING ────────────────────────────────────────────────────────
    // A story level's rooms, each given cover in the level's own style (mirrored left to right, from the
    // level's fixed seed, so a level is the same every time). Left alone: the first room, small ones, ones
    // with inside walls already, any in `skip` (bosses, tutorials) or holding a `keep` point, a 2-tile margin
    // inside the walls, the middle, and anything near a door. A block that would cut part of a room off isn't
    // placed. Whatever spawns on new cover is stepped off it afterwards (LevelManager._unstick).
    static DRESS = {
        gauntlet: { styles: ['pillars', 'colonnade', 'brokenwall'] },
        voidrift: { styles: ['crystals', 'pillars', 'crystals'], round: true },
        fracture: { styles: ['cracks', 'rubble', 'brokenwall'] },
        cistern:  { styles: ['columns', 'colonnade', 'pillars'] },
    };
    _dressRooms(world, theme, skip = [], keep = []) {
        const D = WorldGen.DRESS[theme], R = this.rng;
        if (!D || !this.rooms) return;
        this.rooms.forEach((room, ri) => {
            if (ri === 0 || skip.includes(ri) || room.w < 10 || room.h < 8) return;
            if (keep.some(([x, y]) => x >= room.x && x < room.x + room.w && y >= room.y && y < room.y + room.h)) return;
            for (let x = room.x + 1; x < room.x + room.w - 1; x++) for (let y = room.y + 1; y < room.y + room.h - 1; y++) if (world[x][y] !== this.FLOOR) return;   // already built inside
            const doors = this._roomDoors(world, room);
            const ok = (x, y) => world[x]?.[y] === this.FLOOR && !doors.some(([dx, dy]) => Math.abs(dx - x) + Math.abs(dy - y) <= 2);
            const place = (cells) => {
                const put = cells.filter(([x, y]) => ok(x, y));
                for (const [x, y] of put) world[x][y] = this.WALL;
                if (!this._roomConnected(world, room, doors)) for (const [x, y] of put) world[x][y] = this.FLOOR;
            };
            if (D.round) {   // the corners rounded off
                const r = Math.min(3, Math.floor(Math.min(room.w, room.h) / 4));
                for (const [cx, cy, sx, sy] of [[room.x, room.y, 1, 1], [room.x + room.w - 1, room.y, -1, 1], [room.x, room.y + room.h - 1, 1, -1], [room.x + room.w - 1, room.y + room.h - 1, -1, -1]]) {
                    const cells = [];
                    for (let i = 0; i < r; i++) for (let j = 0; j < r - i; j++) cells.push([cx + sx * i, cy + sy * j]);
                    place(cells);
                }
            }
            const style = D.styles[Math.floor(R() * D.styles.length)];
            const x0 = room.x + 2, y0 = room.y + 2, x1 = room.x + room.w - 3, y1 = room.y + room.h - 3;
            const mx = room.x + (room.w >> 1), my = room.y + (room.h >> 1), w = room.w, h = room.h;
            const inside = (x, y) => x >= x0 && x <= x1 && y >= y0 && y <= y1 && !(Math.abs(x - mx) <= 1 && Math.abs(y - my) <= 1);
            const blocks = [];   // each [cells]; mirrored left to right
            const twin = (cells) => { blocks.push(cells); const m = cells.map(([x, y]) => [2 * room.x + w - 1 - x, y]); if (m.some(([x], i) => x !== cells[i][0])) blocks.push(m); };
            const rect = (bx, by, bw, bh) => { const c = []; for (let x = bx; x < bx + bw; x++) for (let y = by; y < by + bh; y++) c.push([x, y]); return c; };
            if (style === 'pillars') {
                for (const fy of [0.3, 0.7]) twin(rect(room.x + Math.floor(w * 0.28), room.y + Math.floor(h * fy) - 1, 2, 2));
            } else if (style === 'colonnade') {   // two rows of columns down the long side
                const along = w >= h;
                for (const f of [0.3, 0.7]) for (let k = 3; k < (along ? w : h) - 3; k += 3) {
                    const c = along ? [room.x + k, room.y + Math.round(h * f)] : [room.x + Math.round(w * f), room.y + k];
                    if (along ? c[0] < mx : true) (along ? twin : (cs) => blocks.push(cs))([c]);
                }
            } else if (style === 'brokenwall') {  // a wall across the middle with gaps in it
                const horiz = w >= h, line = [];
                if (horiz) { for (let x = x0; x < mx - 1; x++) if ((x - x0) % 5 < 3) line.push([x, my]); }
                else { for (let y = y0; y <= y1; y++) if ((y - y0) % 5 < 3) line.push([mx - Math.floor(w / 4), y]); }
                twin(line);
            } else if (style === 'crystals') {    // an arc of void crystals round the middle
                const rx = Math.max(2, Math.floor(w / 3)), ry = Math.max(2, Math.floor(h / 3));
                for (let i = 0; i < 20; i++) {
                    const t = i / 20 * Math.PI * 2, x = Math.round(mx + Math.cos(t) * rx), y = Math.round(my + Math.sin(t) * ry);
                    if (i % 4 === 0 || x >= mx) continue;
                    twin([[x, y]]);
                }
            } else if (style === 'cracks') {      // jagged rifts running in from the corners
                for (const sy of [1, -1]) {
                    const c = [];
                    let x = x0 + 1, y = sy > 0 ? y0 + 1 : y1 - 1;
                    for (let k = 0; k < 5; k++) { c.push([x, y]); if (k % 2) x++; else y += sy; }
                    twin(c);
                }
            } else if (style === 'rubble') {      // heaps of fallen stone
                for (let k = 0; k < 3; k++) {
                    const bx = x0 + Math.floor(R() * Math.max(1, mx - x0 - 2)), by = y0 + Math.floor(R() * Math.max(1, y1 - y0));
                    twin([[bx, by], [bx + 1, by], [bx, by + (R() < 0.5 ? 1 : -1)]]);
                }
            } else if (style === 'columns') {     // a cistern's hall of columns
                for (let x = x0 + 1; x < mx - 1; x += 3) for (let y = y0 + 1; y <= y1 - 1; y += 3) twin([[x, y]]);
            }
            for (const cells of blocks) place(cells.filter(([x, y]) => inside(x, y)));
        });
    }
    // Floor tiles on a room's edge with floor just outside it: where corridors come in
    _roomDoors(world, room) {
        const out = [];
        for (let x = room.x; x < room.x + room.w; x++) for (let y = room.y; y < room.y + room.h; y++) {
            if (x !== room.x && y !== room.y && x !== room.x + room.w - 1 && y !== room.y + room.h - 1) continue;
            if (world[x][y] !== this.FLOOR) continue;
            for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
                const nx = x + dx, ny = y + dy;
                if ((nx < room.x || ny < room.y || nx >= room.x + room.w || ny >= room.y + room.h) && world[nx]?.[ny] === this.FLOOR) { out.push([x, y]); break; }
            }
        }
        return out;
    }
    // Every floor tile in the room reachable from its first door (or any floor tile)?
    _roomConnected(world, room, doors) {
        const inR = (x, y) => x >= room.x && y >= room.y && x < room.x + room.w && y < room.y + room.h;
        let total = 0, start = doors[0];
        for (let x = room.x; x < room.x + room.w; x++) for (let y = room.y; y < room.y + room.h; y++) if (world[x][y] === this.FLOOR) { total++; start ||= [x, y]; }
        if (!start) return true;
        const seen = new Set([start[0] + ',' + start[1]]), q = [start];
        while (q.length) {
            const [x, y] = q.pop();
            for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
                const nx = x + dx, ny = y + dy, k = nx + ',' + ny;
                if (inR(nx, ny) && !seen.has(k) && world[nx][ny] === this.FLOOR) { seen.add(k); q.push([nx, ny]); }
            }
        }
        return seen.size >= total;
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
        // Use center of rooms[0] (always the spawn room, never a chest room)
        const spawnRoom = this.rooms?.find(r => !r.isChestRoom);
        if (spawnRoom) {
            const cx = Math.floor(spawnRoom.x + spawnRoom.w / 2);
            const cy = Math.floor(spawnRoom.y + spawnRoom.h / 2);
            for (let r = 0; r < Math.max(spawnRoom.w, spawnRoom.h); r++) {
                for (let dx = -r; dx <= r; dx++) {
                    for (let dy = -r; dy <= r; dy++) {
                        if (Math.abs(dx) !== r && Math.abs(dy) !== r) continue;
                        const tx = cx + dx, ty = cy + dy;
                        if (this.world[tx]?.[ty] === this.FLOOR) {
                            this.playerX = tx; this.playerY = ty;
                            this.player = this.add.sprite(
                                tx * this.TILE_SIZE + this.TILE_SIZE / 2,
                                ty * this.TILE_SIZE + this.TILE_SIZE / 2 + this.SLIME_Y_OFFSET,
                                'slime_blue', 0
                            );
                            this.player.setScale(this.SLIME_SCALE);
                            this.player.setDepth(1);
                            return;
                        }
                    }
                }
            }
        }
        // Fallback: first floor tile
        for (let x = 0; x < this.WORLD_WIDTH; x++) {
            for (let y = 0; y < this.WORLD_HEIGHT; y++) {
                if (this.world[x][y] === this.FLOOR) {
                    this.playerX = x; this.playerY = y;
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

    generateLevel6() {
        // ── Level 6: "The Cistern" ───────────────────────────────────────────
        // Fifteen rooms. The first nine teach one type each on terrain built to make that
        // type legible. The last five are STACKS -- a room full of one thing, because four
        // Drowners together is a different problem from four different enemies, and three
        // Wave Riders crossing is a different problem from one.
        //
        //   R6 Headrace -- R5 Switchgear -- R4 Confluence -- R3 Stillwell
        //    |                                                    |
        //   R7 Long Gallery                                  R2 Runnels
        //    |                                                    |
        //   R8 Grating -- R9 Drawing Rm    R0 Spawn -- R1 Shallows
        //                      |
        //                 R10 Torrent -- R11 Picket
        //                                      |
        //   R14 Sluice -- R13 Drowning Pool -- R12 Switchyard
        //
        // Water only pools inside room rectangles, so every wall is also a bank: pillars
        // make islands, long runs make channels, a gap is somewhere you have to wade.

        const world = [];
        for (let x = 0; x < this.WORLD_WIDTH; x++) {
            world[x] = [];
            for (let y = 0; y < this.WORLD_HEIGHT; y++) world[x][y] = this.NOTHING;
        }
        this.rooms = [];
        // Leaking pipes. Each one sits in the wall OUTSIDE a room and bleeds inward, and
        // LevelManager keeps refilling its tiles a tile at a time -- so burning a pool off
        // buys you seconds, not the room. `kind` is 'pool' (a blob at the mouth) or 'line'
        // (a run straight in), and `len` is how far it reaches.
        this.pipes = [];
        const pipe = (mx, my, dx, dy, kind, len) => this.pipes.push({ mx, my, dx, dy, kind, len });
        const hall   = (x0, x1, y) => { for (let x = x0; x <= x1; x++) for (let d = -1; d <= 1; d++) world[x][y+d] = this.FLOOR; };
        const shaft  = (y0, y1, x) => { for (let y = y0; y <= y1; y++) for (let d = -1; d <= 1; d++) world[x+d][y] = this.FLOOR; };
        const pillar = (px, py, w, h) => { for (let x = px; x < px+w; x++) for (let y = py; y < py+h; y++) world[x][y] = this.WALL; };
        const room = (x, y, w, h, doors) => {
            const r = { x, y, w, h, doorPositions: [] };
            this.carveRoom(world, r);
            for (const d of doors) r.doorPositions.push(d);
            this.rooms.push(r);
            return r;
        };

        // ── R0: Dry Landing (14x10) — the control ───────────────────────────
        // Bone dry. You need ground that does nothing to you or the soak never reads.
        room(52, 44, 14, 10, [{ x: 65, y: 48, direction: 'east' }]);
        pillar(55, 46, 2, 1); pillar(62, 51, 2, 1);

        // ── R1: The Shallows (18x14) — the floor is the lesson ──────────────
        room(70, 42, 18, 14, [{ x: 70, y: 48, direction: 'west' },
                              { x: 87, y: 48, direction: 'east' }]);
        pillar(74, 45, 2, 2); pillar(83, 52, 2, 2); pillar(78, 49, 3, 2);
        hall(65, 71, 48);

        // ── R2: The Runnels (22x18) — Ripplerunner ─────────────────────────
        // Four long channel banks. It skims the flooded lanes and bogs down crossing them.
        room(92, 38, 22, 18, [{ x: 92, y: 48, direction: 'west' },
                              { x: 103, y: 38, direction: 'north' }]);
        // two pipes feeding the channels from the east wall, so the lanes re-flood
        pipe(114, 43, -1, 0, 'line', 9);
        pipe(114, 51, -1, 0, 'line', 9);
        pillar(95, 41, 14, 1); pillar(97, 45, 14, 1);
        pillar(95, 49, 14, 1); pillar(97, 53, 14, 1);
        hall(87, 93, 48);

        // ── R3: Stillwell (22x18) — Drowner, on dry ground ─────────────────
        // A ring of columns around open floor, and the driest room in the level. Learn the
        // commit here, where getting it wrong is damage instead of damage plus a pin.
        room(92, 14, 22, 18, [{ x: 103, y: 31, direction: 'south' },
                              { x: 92, y: 22, direction: 'west' }]);
        for (const [px, py] of [[96,17],[108,17],[96,27],[108,27],[102,16],[102,29]]) pillar(px, py, 2, 2);
        shaft(31, 39, 103);

        // ── R4: Confluence (22x18) — the first pairing ─────────────────────
        // A cross of banks cuts it into four quadrants with a wet middle.
        room(64, 10, 22, 18, [{ x: 85, y: 20, direction: 'east' },
                              { x: 64, y: 18, direction: 'west' }]);
        pillar(74, 12, 2, 5); pillar(74, 21, 2, 5);
        pillar(67, 17, 5, 2); pillar(78, 17, 5, 2);
        hall(85, 93, 22);

        // ── R5: Switchgear (22x16) — Conduit ───────────────────────────────
        // Machine blocks on a grid. The dry lanes between them are the answer, and you can
        // see them from the doorway.
        room(36, 10, 22, 16, [{ x: 57, y: 18, direction: 'east' },
                              { x: 36, y: 18, direction: 'west' }]);
        for (let gx = 0; gx < 4; gx++) for (let gy = 0; gy < 3; gy++) pillar(39 + gx*5, 12 + gy*4, 2, 2);
        hall(57, 65, 18);

        // ── R6: Headrace (22x18) — Tidecaller ──────────────────────────────
        // Two long races with gaps. It refills whichever one you dried.
        room(8, 12, 22, 18, [{ x: 29, y: 19, direction: 'east' },
                             { x: 17, y: 29, direction: 'south' }]);
        // the races are fed from the west wall — dry one and it fills again from the end
        pipe(7, 20, 1, 0, 'line', 11);
        pipe(7, 28, 1, 0, 'line', 11);
        pillar(11, 16, 7, 1); pillar(20, 16, 7, 1);
        pillar(11, 24, 7, 1); pillar(20, 24, 7, 1);
        hall(29, 37, 19);

        // ── R7: The Long Gallery (34x12) — Wave Rider ──────────────────────
        // Thirty-four tiles end to end and almost nothing in it: you watch the whole charge
        // cross in front of you, which is the only way to learn to leave the lane.
        room(4, 36, 34, 12, [{ x: 17, y: 36, direction: 'north' },
                             { x: 12, y: 47, direction: 'south' }]);
        pillar(13, 40, 2, 2); pillar(24, 42, 2, 2); pillar(32, 40, 2, 2);
        shaft(29, 37, 17);

        // ── R8: The Grating (18x20) — Tidal Guard ──────────────────────────
        // Tall and open down the middle; the guard holds the bottom so its trident runs the
        // length of the room at you. Pillars sit wide, off the prong lanes.
        room(4, 54, 18, 20, [{ x: 12, y: 54, direction: 'north' },
                             { x: 21, y: 64, direction: 'east' }]);
        pillar(6, 58, 2, 2); pillar(18, 58, 2, 2);
        pillar(6, 69, 2, 2); pillar(18, 69, 2, 2);
        shaft(47, 55, 12);

        // ── R9: The Drawing Room (20x16) — Wishing Well ────────────────────
        // Open and unthreatening. Watch what a Well does to a floor before anything is
        // standing on that floor trying to kill you.
        room(26, 56, 20, 16, [{ x: 26, y: 64, direction: 'west' },
                              { x: 45, y: 64, direction: 'east' }]);
        pillar(30, 59, 2, 2); pillar(41, 67, 2, 2);
        hall(21, 27, 64);

        // ── R10: The Torrent (32x14) — a PACK of Wave Riders ───────────────
        // Long, and deliberately almost empty. Three of them telegraph and charge across
        // the same open floor, so the carpets overlap and the lane you dodged into is the
        // lane the next one takes. Staggered short banks give you something to break
        // line-of-sight on without ever blocking a charge outright.
        room(50, 60, 32, 14, [{ x: 50, y: 66, direction: 'west' },
                              { x: 81, y: 66, direction: 'east' }]);
        // pools across the charge lanes, so the Wave Riders always have water to ride
        pipe(57, 59, 0, 1, 'pool', 3);
        pipe(74, 74, 0, -1, 'pool', 3);
        pillar(56, 63, 3, 1); pillar(64, 69, 3, 1); pillar(72, 63, 3, 1);
        hall(45, 51, 66);

        // ── R11: The Picket (24x18) — a TRIO of Tidal Guards ───────────────
        // Thin pickets cut long sightlines through the room. Three guards aim down them
        // from different angles, so a step out of one trident is a step into another --
        // the safe lane of one sits inside the prong of the next.
        room(86, 60, 24, 18, [{ x: 86, y: 66, direction: 'west' },
                              { x: 97, y: 77, direction: 'south' }]);
        // one pool only: wet guards aim in 600ms instead of 1000, so this room does not
        // need much help
        pipe(93, 59, 0, 1, 'pool', 2);
        pillar(90, 64, 1, 5); pillar(96, 70, 1, 5); pillar(103, 64, 1, 5);
        pillar(93, 73, 4, 1); pillar(100, 62, 4, 1);
        hall(81, 87, 66);

        // ── R12: The Switchyard (18x12) — a Conduit LATTICE ────────────────
        // Sized to the mechanic: at 18x12 a 3x2 lattice of four-tile fields covers ~94% of
        // the floor, leaving a seam you can find rather than a room you cannot enter.
        room(88, 82, 18, 12, [{ x: 97, y: 82, direction: 'north' },
                              { x: 88, y: 86, direction: 'west' }]);
        // the lattice is fed from both ends — this is the room where drying a seam is the
        // whole tactic, so the seam closing again is the whole pressure
        // ONE main, not two. This room's whole tactic is burning a dry seam through the
        // Conduit lattice, and two streams crossing it leaves nowhere to make one.
        pipe(87, 90, 1, 0, 'line', 8);   // clear of the corridor band at y85-87
        pillar(89, 83, 2, 1); pillar(103, 92, 2, 1);
        shaft(77, 83, 97);

        // ── R13: The Drowning Pool (24x18) — a PACK of Drowners ────────────
        // Four, plus Wells to keep it wet. Their commits land on overlapping timers, so you
        // cannot answer them one at a time -- you have to pick ground that answers all of
        // them, and every strike on dry floor takes some of that ground away.
        room(58, 78, 24, 18, [{ x: 81, y: 86, direction: 'east' },
                              { x: 58, y: 86, direction: 'west' }]);
        // three pipes: the Drowning Pool should refuse to stay dry
        pipe(66, 77, 0, 1, 'pool', 3);
        pipe(79, 96, 0, -1, 'pool', 3);   // outside the south wall, draining north
        pillar(62, 82, 3, 3); pillar(74, 82, 3, 3); pillar(68, 90, 3, 2);
        hall(81, 89, 86);

        // ── R14: Sluice Gate (38x18) — finale ──────────────────────────────
        // Wide enough for the Wave Riders to build speed and for the queen's adds to have
        // somewhere to come from. Gate housings give cover, but every piece is an island.
        room(14, 78, 38, 18, [{ x: 51, y: 86, direction: 'east' }]);
        // finale: two long lines down the arena plus a pool at the queen's end
        pipe(13, 86, 1, 0, 'line', 12);
        pipe(33, 77, 0, 1, 'pool', 3);
        for (const [px, py] of [[19,82],[31,82],[43,82],[25,90],[37,90],[47,90]]) pillar(px, py, 3, 2);
        hall(51, 59, 86);

        this.isLevel6 = true;   // turns on room gating: see LevelManager._roomGated

        // Room state, the same shape generateLevel2/3/4 set. Level 6 had none of this, so
        // the door flags were whatever the previously played level left behind.
        // lockTutorialDoors is deliberately NOT called here: these are intent flags, and
        // the barrier is raised in _cisternRoomCheck when you walk into the room.
        this.currentTutorialRoom = -1;
        this.tutorialRoomCleared = this.rooms.map(() => false);
        this.tutorialDoorsLocked = this.rooms.map((r, i) => i !== 0);

        const spawnRoom = this.rooms[0];
        this.playerX = Math.floor(spawnRoom.x + spawnRoom.w / 2);
        this.playerY = Math.floor(spawnRoom.y + spawnRoom.h / 2);

        this.addWalls(world);
        this._dressRooms(world, 'cistern', [], [[32, 86], [104, 62]]);   // the Queens' rooms left clear
        return world;
    }

    generateLevel4() {
        // ── Level 4: "The Fracture" ──────────────────────────────────────────
        // Layout:
        //
        //  [R2: Sinkhole] — [R1: Crater] — [R0: Spawn] — [R3: Chain Gang] — [R4: Splitter Farm]
        //                                       |
        //                                  [R5: Trap Gauntlet]
        //                                       |
        //                                  [R6: Fracture Core Arena]
        //
        // Chest rooms off R2(NW) and R4(NE)

        const world = [];
        for (let x = 0; x < this.WORLD_WIDTH; x++) {
            world[x] = [];
            for (let y = 0; y < this.WORLD_HEIGHT; y++) world[x][y] = this.NOTHING;
        }
        this.rooms = [];

        // ── R0: Spawn hub (14×10) ────────────────────────────────────────────
        const r0 = { x: 43, y: 28, w: 14, h: 10, doorPositions: [] };
        this.carveRoom(world, r0);
        r0.doorPositions.push({ x: 43, y: 33, direction: 'west'  });
        r0.doorPositions.push({ x: 57, y: 33, direction: 'east'  });
        r0.doorPositions.push({ x: 50, y: 38, direction: 'south' });
        [[44,29],[55,29],[44,36],[55,36]].forEach(([px,py]) => {
            world[px][py] = this.WALL; world[px+1][py] = this.WALL;
        });
        this.rooms.push(r0); // rooms[0]

        // ── R1: Entry Crater (16×14) — WEST ─────────────────────────────────
        for (let x = 38; x <= 42; x++)
            for (let dy = -1; dy <= 1; dy++) world[x][33+dy] = this.FLOOR;
        const r1 = { x: 22, y: 22, w: 16, h: 14, doorPositions: [] };   // (x 18 touched R2: the two rooms were one open space)
        this.carveRoom(world, r1);
        r1.doorPositions.push({ x: 38, y: 33, direction: 'east' });
        r1.doorPositions.push({ x: 22, y: 33, direction: 'west' });
        // Rubble pillars
        [[24,24],[34,24],[24,32],[34,32]].forEach(([px,py]) => {
            world[px][py] = this.WALL; world[px+1][py] = this.WALL;
            world[px][py+1] = this.WALL;
        });
        this.rooms.push(r1); // rooms[1]

        // ── R2: Sinkhole (14×14) — FAR WEST, a short corridor (x 18-21) to R1 ──
        for (let x = 18; x <= 21; x++)
            for (let dy = -1; dy <= 1; dy++) world[x][33+dy] = this.FLOOR;
        const r2 = { x: 4, y: 22, w: 14, h: 14, doorPositions: [] };
        this.carveRoom(world, r2);
        r2.doorPositions.push({ x: 18, y: 33, direction: 'east' });
        // Internal wall creating cover zones
        for (let y = 25; y <= 31; y++) world[11][y] = this.WALL;
        world[11][28] = this.FLOOR;
        this.rooms.push(r2); // rooms[2]

        // ── R3: Chain Gang (22×14) — EAST ───────────────────────────────────
        for (let x = 57; x <= 62; x++)
            for (let dy = -1; dy <= 1; dy++) world[x][33+dy] = this.FLOOR;
        const r3 = { x: 63, y: 23, w: 22, h: 14, doorPositions: [] };
        this.carveRoom(world, r3);
        r3.doorPositions.push({ x: 63, y: 33, direction: 'west' });
        r3.doorPositions.push({ x: 85, y: 33, direction: 'east' });
        [[65,25],[80,25],[65,33],[80,33]].forEach(([px,py]) => {
            world[px][py] = this.WALL; world[px+1][py] = this.WALL;
        });
        this.rooms.push(r3); // rooms[3]

        // ── R4: Splitter Farm (22×16) — FAR EAST ────────────────────────────
        for (let x = 85; x <= 91; x++)
            for (let dy = -1; dy <= 1; dy++) world[x][33+dy] = this.FLOOR;
        const r4 = { x: 92, y: 23, w: 22, h: 16, doorPositions: [] };
        this.carveRoom(world, r4);
        r4.doorPositions.push({ x: 92, y: 33, direction: 'west' });
        // Open space — minimal pillars for kiting
        [[94,25],[110,25]].forEach(([px,py]) => { world[px][py] = this.WALL; world[px+1][py] = this.WALL; });
        this.rooms.push(r4); // rooms[4]

        // ── R5: Trap Gauntlet (26×14) — SOUTH ───────────────────────────────
        for (let y = 38; y <= 43; y++)
            for (let dx = -1; dx <= 1; dx++) world[50+dx][y] = this.FLOOR;
        const r5 = { x: 37, y: 44, w: 26, h: 14, doorPositions: [] };
        this.carveRoom(world, r5);
        r5.doorPositions.push({ x: 50, y: 44, direction: 'north' });
        r5.doorPositions.push({ x: 50, y: 58, direction: 'south' });
        // Pillars creating trap corridors
        [[39,46],[59,46],[39,54],[59,54],[49,50]].forEach(([px,py]) => {
            world[px][py] = this.WALL; world[px+1][py] = this.WALL;
        });
        this.rooms.push(r5); // rooms[5]

        // ── R6: Fracture Core Arena (36×26) ─────────────────────────────────
        for (let y = 58; y <= 63; y++)
            for (let dx = -1; dx <= 1; dx++) world[50+dx][y] = this.FLOOR;
        const r6 = { x: 31, y: 64, w: 36, h: 26, doorPositions: [] };
        this.carveRoom(world, r6);
        r6.doorPositions.push({ x: 50, y: 64, direction: 'north' });
        // Four quadrant dividers with gaps (no full walls — just cover pillars)
        [[33,68],[62,68],[33,84],[62,84]].forEach(([px,py]) => {
            world[px][py] = this.WALL; world[px+1][py] = this.WALL;
            world[px][py+1] = this.WALL; world[px+1][py+1] = this.WALL;
        });
        // Mid-room rubble pillars
        [[47,72],[52,72],[47,80],[52,80]].forEach(([px,py]) => { world[px][py] = this.WALL; });
        this.rooms.push(r6); // rooms[6]

        // ── CHEST BRANCHES ───────────────────────────────────────────────────
        // Off R2 (north)
        const c1 = { x: 5, y: 10, w: 10, h: 10, isChestRoom: true };
        for (let y = 10; y <= 21; y++)
            for (let dx = -1; dx <= 1; dx++) world[11+dx][y] = this.FLOOR;
        this.carveRoom(world, c1);
        this.rooms.push(c1); // rooms[7]

        // Off R4 (north)
        const c2 = { x: 98, y: 10, w: 10, h: 10, isChestRoom: true };
        for (let y = 10; y <= 22; y++)
            for (let dx = -1; dx <= 1; dx++) world[103+dx][y] = this.FLOOR;
        this.carveRoom(world, c2);
        this.rooms.push(c2); // rooms[8]

        this.addWalls(world);

        this.isTutorial          = false;
        this.isIceTutorial       = false;
        this.isLightningTutorial = false;
        this.isLevel2            = false;
        this.isLevel3            = false;
        this.isLevel4            = true;
        this.currentTutorialRoom = -1;
        this.tutorialWeaponLocked = false;

        this.tutorialRoomCleared = this.rooms.map(() => false);
        this.tutorialDoorsLocked = this.rooms.map((r, i) => {
            if (i === 0) return false;
            if (r.isChestRoom) return false;
            return true;
        });

        const spawnRoom = this.rooms[0];
        const spawnCX = Math.floor(spawnRoom.x + spawnRoom.w / 2);
        const spawnCY = Math.floor(spawnRoom.y + spawnRoom.h / 2);
        this.playerX = spawnCX; this.playerY = spawnCY;

        this._dressRooms(world, 'fracture', [6]);   // the Fracture Core's room left clear
        return world;
    }

}