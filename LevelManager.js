// ═══════════════════════════════════════════════════════════════════════════
// LEVELMANAGER.JS — Real dungeon level logic (level 2+)
// All methods use .call(this) from GameScene via proxy stubs, same as other modules.
// ═══════════════════════════════════════════════════════════════════════════

class LevelManager {

    // ─── CROSS-LEVEL GEOMETRY & DISPATCH HELPERS ───────────────────────────
    // Moved here from TutorialManager.js — these are used by every level
    // (enemy AI, boss attacks, weapon hit detection, dev tools), not tutorial-
    // exclusive logic, even though some originated there historically.

    getCurrentPlayerRoom() {
        for (let i = 0; i < this.rooms.length; i++) {
            const room = this.rooms[i];
            if (this.playerX >= room.x && this.playerX < room.x + room.w &&
                this.playerY >= room.y && this.playerY < room.y + room.h) {
                return i;
            }
        }
        return -1;
    }

    isInCurrentRoom(tx, ty) {
        if (!this.isTutorial && !this.isLevel2 && !this.isLevel3 && !this.isLevel4) return true;
        const ri = this.getCurrentPlayerRoom();
        if (ri < 0) return false;
        const r = this.rooms[ri];
        return tx >= r.x && tx < r.x + r.w && ty >= r.y && ty < r.y + r.h;
    }

    isInLockedRoom(tileX, tileY) {
        if ((!this.isTutorial && !this.isLevel2 && !this.isLevel3 && !this.isLevel4) || !this.tutorialDoorsLocked) return false;
        for (let i = 0; i < this.rooms.length; i++) {
            if (!this.tutorialDoorsLocked[i]) continue;
            const room = this.rooms[i];
            if (tileX >= room.x && tileX < room.x + room.w &&
                tileY >= room.y && tileY < room.y + room.h) {
                // Only block if player is NOT in this room
                const playerRoom = this.getCurrentPlayerRoom();
                if (playerRoom !== i) return true;
            }
        }
        return false;
    }

    lockTutorialDoors(roomIndex) {
        const room = this.rooms[roomIndex];
        if (!room || !room.doorPositions) return;
        if (!this.lockedDoorTiles) this.lockedDoorTiles = [];
        if (!this.lockedDoorSprites) this.lockedDoorSprites = [];

        for (let door of room.doorPositions) {
            let sealTiles = [];

            if (door.direction === 'east') {
                const ex = room.x + room.w - 1;
                for (let ty = room.y; ty < room.y + room.h; ty++) sealTiles.push({ x: ex, y: ty });
            } else if (door.direction === 'west') {
                const wx = room.x;
                for (let ty = room.y; ty < room.y + room.h; ty++) sealTiles.push({ x: wx, y: ty });
            } else if (door.direction === 'north') {
                const ny = room.y;
                for (let tx = room.x; tx < room.x + room.w; tx++) sealTiles.push({ x: tx, y: ny });
            } else if (door.direction === 'south') {
                const sy = room.y + room.h - 1;
                for (let tx = room.x; tx < room.x + room.w; tx++) sealTiles.push({ x: tx, y: sy });
            }

            for (let { x: tx, y: ty } of sealTiles) {
                if (!this.world[tx] || this.world[tx][ty] !== this.FLOOR) continue;
                this.world[tx][ty] = this.WALL;
                this.lockedDoorTiles.push({ x: tx, y: ty, roomIndex });
                const px = tx * this.TILE_SIZE + this.TILE_SIZE / 2;
                const py = ty * this.TILE_SIZE + this.TILE_SIZE / 2;
                const bar = this.add.rectangle(px, py, this.TILE_SIZE, this.TILE_SIZE, 0xff2200, 0.55).setDepth(0.9);
                this.tweens.add({ targets: bar, alpha: 0.3, duration: 700, yoyo: true, repeat: -1 });
                this.lockedDoorSprites.push({ sprite: bar, roomIndex });
            }

            // If player is on a sealed tile, nudge them 2 tiles inward
            const onSeal = sealTiles.some(t => t.x === this.playerX && t.y === this.playerY);
            if (onSeal) {
                let nx = 0, ny = 0;
                if (door.direction === 'east')  nx = -2;
                if (door.direction === 'west')  nx =  2;
                if (door.direction === 'north') ny =  2;
                if (door.direction === 'south') ny = -2;
                const tx2 = this.playerX + nx;
                const ty2 = this.playerY + ny;
                const clampedX = Math.max(room.x + 1, Math.min(room.x + room.w - 2, tx2));
                const clampedY = Math.max(room.y + 1, Math.min(room.y + room.h - 2, ty2));
                this.playerX = clampedX;
                this.playerY = clampedY;
                const wx = clampedX * this.TILE_SIZE + this.TILE_SIZE / 2;
                const wy = clampedY * this.TILE_SIZE + this.TILE_SIZE / 2 + this.SLIME_Y_OFFSET;
                this.tweens.killTweensOf(this.player);
                this.tweens.add({ targets: this.player, x: wx, y: wy, duration: 120, ease: 'Power2' });
            }
        }

        // Also seal corridor entrances to chest rooms branching off this combat room
        if (this.isLevel2 && this.rooms) {
            const combatRooms = this.rooms.filter(r => !r.isChestRoom);
            const combatIdx = combatRooms.indexOf(room);
            const tagMap = ['r0','r1','r2','r3','r4','r5','boss'];
            const tag = tagMap[combatIdx] || null;
            if (tag) {
                for (const cr of this.rooms) {
                    if (!cr.isChestRoom || cr.parentTag !== tag) continue;
                    if (!cr.entranceTiles) continue;
                    for (const { x: tx, y: ty } of cr.entranceTiles) {
                        if (!this.world[tx] || this.world[tx][ty] !== this.FLOOR) continue;
                        this.world[tx][ty] = this.WALL;
                        this.lockedDoorTiles.push({ x: tx, y: ty, roomIndex });
                        const px = tx * this.TILE_SIZE + this.TILE_SIZE / 2;
                        const py = ty * this.TILE_SIZE + this.TILE_SIZE / 2;
                        const bar = this.add.rectangle(px, py, this.TILE_SIZE, this.TILE_SIZE, 0xff2200, 0.55).setDepth(0.9);
                        this.tweens.add({ targets: bar, alpha: 0.3, duration: 700, yoyo: true, repeat: -1 });
                        this.lockedDoorSprites.push({ sprite: bar, roomIndex });
                    }
                }
            }
        }
    }

    unlockTutorialDoors(roomIndex) {
        if (!this.lockedDoorTiles) return;

        // Remove wall tiles
        for (let i = this.lockedDoorTiles.length - 1; i >= 0; i--) {
            const tile = this.lockedDoorTiles[i];
            if (tile.roomIndex === roomIndex) {
                this.world[tile.x][tile.y] = this.FLOOR;
                this.lockedDoorTiles.splice(i, 1);
            }
        }

        // Remove visual sprites
        if (this.lockedDoorSprites) {
            for (let i = this.lockedDoorSprites.length - 1; i >= 0; i--) {
                const doorSprite = this.lockedDoorSprites[i];
                if (doorSprite.roomIndex === roomIndex) {
                    doorSprite.sprite.destroy();
                    this.lockedDoorSprites.splice(i, 1);
                }
            }
        }
    }

    // ─── ENEMY SPAWN DISPATCH ───────────────────────────────────────────────

    spawnEnemies() {
        // Tutorial level has custom enemy placement
        if (this.currentLevelIndex === 0) {
            if (this.isIceTutorial) {
                this.spawnIceTutorialEnemies();
            } else {
                this.spawnTutorialEnemies();
            }
            return;
        } else if (this.currentLevelIndex === 1) {
            this.spawnLevel1Enemies();
            return;
        } else if (this.currentLevelIndex === 2) {
            this.spawnLevel2Enemies();
            return;
        } else if (this.currentLevelIndex === 3) {
            this.spawnLevel3Enemies();
            return;
        } else if (this.currentLevelIndex === 4) {
            this.spawnLevel4Enemies();
            return;
        }

        // Fixed enemy range per run: 3–5 enemies per room, skip player's starting room
        const minPerRoom = 3;
        const maxPerRoom = 5;
        const rooms = this.rooms || [];

        for (let i = 0; i < rooms.length; i++) {
            const room = rooms[i];
            const cx = Math.floor(room.x + room.w / 2);
            const cy = Math.floor(room.y + room.h / 2);

            // Skip the room the player starts in
            const distToPlayer = Math.abs(cx - this.playerX) + Math.abs(cy - this.playerY);
            if (distToPlayer < 8) continue;

            const count = minPerRoom + Math.floor(this.rng() * (maxPerRoom - minPerRoom + 1));
            let spawned = 0;
            let attempts = 0;

            while (spawned < count && attempts < 100) {
                attempts++;
                const x = room.x + 1 + Math.floor(this.rng() * (room.w - 2));
                const y = room.y + 1 + Math.floor(this.rng() * (room.h - 2));

                if (this.world[x][y] === this.FLOOR && !this.getEnemyAt(x, y)) {
                    this.createEnemy(x, y);
                    spawned++;
                }
            }
        }
    }

    spawnLevel1Enemies() {
        // Starting room: No enemies

        // Hub room (T-junction): 2 enemies to introduce threat
        const hubPositions = [
            { x: 47, y: 48 },
            { x: 52, y: 51 }
        ];
        for (let pos of hubPositions) {
            this.createEnemy(pos.x, pos.y);
        }

        // Left branch room: 5 enemies in a defensive formation
        const leftPositions = [
            { x: 21, y: 34 },
            { x: 24, y: 36 },
            { x: 21, y: 38 },
            { x: 24, y: 40 },
            { x: 27, y: 38 }
        ];
        for (let pos of leftPositions) {
            this.createEnemy(pos.x, pos.y);
        }

        // Right branch room: 5 enemies clustered
        const rightPositions = [
            { x: 74, y: 35 },
            { x: 77, y: 35 },
            { x: 80, y: 37 },
            { x: 77, y: 40 },
            { x: 74, y: 42 }
        ];
        for (let pos of rightPositions) {
            this.createEnemy(pos.x, pos.y);
        }

        // Boss room: 8 enemies spread throughout
        const bossPositions = [
            { x: 80, y: 44 },
            { x: 84, y: 44 },
            { x: 88, y: 46 },
            { x: 92, y: 46 },
            { x: 84, y: 50 },
            { x: 88, y: 50 },
            { x: 90, y: 54 },
            { x: 94, y: 56 }
        ];
        for (let pos of bossPositions) {
            this.createEnemy(pos.x, pos.y);
        }
    }

    // ─── SHARED ENEMY VISUAL MARKERS ────────────────────────────────────────

    spawnFireMark(enemy) {
        const mark = this.add.graphics().setDepth(2);
        mark.fillStyle(0xff6600, 0.95);
        mark.fillTriangle(0, -9, -6, 3, 6, 3);
        mark.fillStyle(0xffdd00, 1);
        mark.fillCircle(0, -2, 3);
        mark.x = enemy.sprite.x; mark.y = enemy.sprite.y - 22;
        this.tweens.add({ targets: mark, scaleY: 1.25, duration: 700, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
        return mark;
    }

    spawnIceMark(enemy) {
        const mark = this.add.graphics().setDepth(2);
        // Snowflake: 6 arms + centre circle
        mark.lineStyle(2, 0x88eeff, 1);
        for (let i = 0; i < 6; i++) {
            const a = (i / 6) * Math.PI * 2;
            mark.beginPath();
            mark.moveTo(0, 0);
            mark.lineTo(Math.cos(a) * 8, Math.sin(a) * 8);
            mark.strokePath();
            // small tick at 60% along each arm
            const bx = Math.cos(a) * 5, by = Math.sin(a) * 5;
            const px = Math.cos(a + Math.PI / 2) * 3, py = Math.sin(a + Math.PI / 2) * 3;
            mark.beginPath();
            mark.moveTo(bx - px, by - py); mark.lineTo(bx + px, by + py);
            mark.strokePath();
        }
        mark.fillStyle(0xaaffff, 0.9);
        mark.fillCircle(0, 0, 3);
        mark.x = enemy.sprite.x; mark.y = enemy.sprite.y - 22;
        // Slow spin
        this.tweens.add({ targets: mark, angle: 360, duration: 2400, repeat: -1, ease: 'Linear' });
        return mark;
    }

    // ─── LEVEL 2 UPDATE LOOP ──────────────────────────────────────────────

    updateLevel2(time) {
        const playerRoom = this.getCurrentPlayerRoom();
        if (playerRoom === -1) return;

        for (let enemy of this.enemies) {
            if (!enemy.sprite || !enemy.sprite.active) continue;
            const mx = enemy.sprite.x, my = enemy.sprite.y;

            if (enemy._fireMark?.active)   enemy._fireMark.setPosition(mx, my - 22);
            if (enemy._inhibitRing?.active) enemy._inhibitRing.setPosition(mx, my);
            if (enemy._inhibitMark?.active) enemy._inhibitMark.setPosition(mx, my - 22);
            if (enemy._shieldMark?.active)  enemy._shieldMark.setPosition(mx, my - 22);
            if (enemy._iceMark?.active)     enemy._iceMark.setPosition(mx, my - 22);
            if (enemy._rangedMark?.active)  enemy._rangedMark.setPosition(mx, my - 22);
            // Chill stack dots
            if (enemy._chillBar) {
                for (let i = 0; i < enemy._chillBar.length; i++) {
                    const dot = enemy._chillBar[i];
                    if (dot.active) {
                        dot.x = enemy.sprite.x + (i - 1) * 10;
                        dot.y = enemy.sprite.y - 30;
                    }
                }
            }
        }

        if (playerRoom !== this.currentTutorialRoom) {
            this.currentTutorialRoom = playerRoom;
            if (this.tutorialDoorsLocked[playerRoom]) this.lockTutorialDoors(playerRoom);
            if (playerRoom === 0) {
                this.tutorialRoomCleared[0] = true;
                this.tutorialDoorsLocked[0] = false;
                this.unlockTutorialDoors(0);
            }
            // Boss room — activate Voltslime when player enters
            const bossRoomIndex = 6;
            if (playerRoom === bossRoomIndex && this.voltslimeBoss && !this.voltslimeBoss._activated) {
                this.voltslimeBoss._activated = true;
                this.voltslimeBoss.phase = 'idle';
                this.time.delayedCall(1500, () => this._voltslimeNextPhase());
            }
        }

        if (!this._roomHadEnemies) this._roomHadEnemies = {};
        if (!this.tutorialRoomCleared[playerRoom]) {
            const roomEnemies = this.enemies.filter(e => e.tutorialRoomIndex === playerRoom);
            if (roomEnemies.length > 0) this._roomHadEnemies[playerRoom] = true;
            if (roomEnemies.length === 0 && this._roomHadEnemies[playerRoom]) {
                const bossRoomIndex = 6;
                if (playerRoom === bossRoomIndex) {
                    if (!this.voltslimeBoss?.active) this._level2RoomClear(playerRoom);
                } else {
                    this._level2RoomClear(playerRoom);
                }
            }
        }

        // Walk-on chest detection
        if (this.tutorialChests) {
            for (const chest of this.tutorialChests) {
                if (chest.opened) continue;
                if (this.playerX !== chest.tileX || this.playerY !== chest.tileY) continue;
                if (chest.isFinalChest) {
                    if (!this.voltslimeBoss?.active) this.openFinalLevelChest(chest);
                } else {
                    this.openTutorialChest(chest.roomIndex, chest.container, null);
                }
            }
        }
    }

    _level2RoomClear(roomIndex) {
        this.tutorialRoomCleared[roomIndex] = true;
        this.unlockTutorialDoors(roomIndex);
        const bossRoomIndex = 6;
        if (roomIndex === bossRoomIndex) {
            this.time.delayedCall(800, () => {
                const chest = (this.tutorialChests || []).find(c => c.isFinalChest && !c.opened);
                if (chest) this.openFinalLevelChest(chest);
            });
            return;
        }
        this.spawnTutorialChest(roomIndex);
    }

    // ─── LEVEL 2 ENEMY SPAWNING ───────────────────────────────────────────

    spawnLevel2Enemies() {
        // R1: pillar gauntlet — add an ice elemental flanking
        const r1 = [
            { x: 23, y: 45 }, { x: 23, y: 50 },
            { x: 34, y: 45 }, { x: 34, y: 50 },
        ];
        for (const p of r1) { const e = this.createEnemy(p.x, p.y, 30); e.tutorialRoomIndex = 1; }
        this.createRangedEnemy(29, 47, 1);
        // Ice elemental — iceImmune, slightly tougher
        const r1ice = [{ x: 26, y: 47 }];
        for (const p of r1ice) { const e = this.createEnemy(p.x, p.y, 50); e.tutorialRoomIndex = 1; e.iceImmune = true; e._iceMark = this.spawnIceMark(e); }

        // R2: wide brawl — add ult absorber healer in back
        const r2Normal = [{ x: 45, y: 43 }, { x: 50, y: 54 }, { x: 55, y: 43 }];
        const r2Fire   = [{ x: 47, y: 50 }, { x: 54, y: 50 }];
        for (const p of r2Normal) { const e = this.createEnemy(p.x, p.y, 35); e.tutorialRoomIndex = 2; }
        for (const p of r2Fire)   { const e = this.createEnemy(p.x, p.y, 35); e.tutorialRoomIndex = 2; e.fireImmune = true; e._fireMark = this.spawnFireMark(e); }
        this.createRangedEnemy(57, 43, 2);
        // Ult absorber healer hiding at the back
        const r2abs = { x: 52, y: 47 };
        { const e = this.createEnemy(r2abs.x, r2abs.y, 55); e.tutorialRoomIndex = 2; e.isUltAbsorber = true; TutorialManager.prototype._applyUltAbsorberVisual.call(this, e); }

        // Chest branch rooms
        this._spawnLevel2ChestRooms();

        // R3: L-shape — mix in ice elemental and ult absorber
        const r3 = [{ x: 76, y: 42 }, { x: 79, y: 42 }, { x: 82, y: 43 }];
        const r3f = [{ x: 77, y: 51 }, { x: 80, y: 52 }];
        for (const p of r3)  { const e = this.createEnemy(p.x, p.y, 38); e.tutorialRoomIndex = 3; }
        for (const p of r3f) { const e = this.createEnemy(p.x, p.y, 38); e.tutorialRoomIndex = 3; e.fireImmune = true; e._fireMark = this.spawnFireMark(e); }
        // Ice elemental pair
        const r3ice = [{ x: 78, y: 46 }, { x: 82, y: 48 }];
        for (const p of r3ice) { const e = this.createEnemy(p.x, p.y, 55); e.tutorialRoomIndex = 3; e.iceImmune = true; e._iceMark = this.spawnIceMark(e); }
        // Ult absorber lurking in corner
        { const e = this.createEnemy(74, 50, 65); e.tutorialRoomIndex = 3; e.isUltAbsorber = true; TutorialManager.prototype._applyUltAbsorberVisual.call(this, e); }

        // R4: spike maze — add ice elemental behind spikes
        const spikeRow1 = [{ x:67,y:62 },{ x:68,y:62 },{ x:69,y:62 },{ x:72,y:62 },{ x:73,y:62 }];
        const spikeRow2 = [{ x:67,y:65 },{ x:68,y:65 },{ x:71,y:65 },{ x:72,y:65 },{ x:73,y:65 }];
        for (const s of spikeRow1) this.spawnSpikeTrap(s.x, s.y);
        for (const s of spikeRow2) this.spawnSpikeTrap(s.x, s.y);
        this.spawnPoisonTrap(79, 61); this.spawnPoisonTrap(79, 68);
        [{ x:70,y:62 }, { x:75,y:69 }, { x:82,y:65 }].forEach(p => { const e = this.createEnemy(p.x, p.y, 40); e.tutorialRoomIndex = 4; });
        this.createRangedEnemy(78, 62, 4);
        // Ice elementals guarding the back
        const r4ice = [{ x:80, y:62 }, { x:80, y:68 }];
        for (const p of r4ice) { const e = this.createEnemy(p.x, p.y, 60); e.tutorialRoomIndex = 4; e.iceImmune = true; e._iceMark = this.spawnIceMark(e); }

        // R5: ambush — add ult absorber and more ice elementals
        const r5  = [{ x:40,y:63 },{ x:40,y:70 },{ x:46,y:67 },{ x:51,y:63 },{ x:51,y:71 }];
        const r5f = [{ x:45,y:62 },{ x:53,y:70 }];
        for (const p of r5)  { const e = this.createEnemy(p.x, p.y, 40); e.tutorialRoomIndex = 5; }
        for (const p of r5f) { const e = this.createEnemy(p.x, p.y, 40); e.tutorialRoomIndex = 5; e.fireImmune = true; e._fireMark = this.spawnFireMark(e); }
        this.createRangedEnemy(55, 63, 5); this.createRangedEnemy(55, 70, 5);
        // Ice elementals flanking ambush
        const r5ice = [{ x:43,y:65 }, { x:50,y:67 }];
        for (const p of r5ice) { const e = this.createEnemy(p.x, p.y, 60); e.tutorialRoomIndex = 5; e.iceImmune = true; e._iceMark = this.spawnIceMark(e); }
        // Ult absorber healer in the centre of the ambush
        { const e = this.createEnemy(47, 66, 75); e.tutorialRoomIndex = 5; e.isUltAbsorber = true; TutorialManager.prototype._applyUltAbsorberVisual.call(this, e); }

        // Boss arena guards — mix in ice elemental
        const bossIdx = 6;
        [{ x:8,y:61 },{ x:24,y:61 },{ x:8,y:73 },{ x:24,y:73 }].forEach(p => {
            const e = this.createEnemy(p.x, p.y, 45); e.tutorialRoomIndex = bossIdx;
        });
        // One ice elemental guard in boss room
        { const e = this.createEnemy(16, 62, 70); e.tutorialRoomIndex = bossIdx; e.iceImmune = true; e._iceMark = this.spawnIceMark(e); }
        this.spawnVoltslimeBoss(16, 67);
        this.spawnFinalLevelChest(16, 59, 'lightning');
    }

    _spawnLevel2ChestRooms() {
        if (!this.tutorialChests) this.tutorialChests = [];
        for (let i = 0; i < this.rooms.length; i++) {
            const room = this.rooms[i];
            if (!room.isChestRoom) continue;
            let cx = Math.floor(room.x + room.w / 2);
            let cy = Math.floor(room.y + room.h / 2);
            if (this.world[cx]?.[cy] !== this.FLOOR) {
                outer: for (let r = 1; r < Math.max(room.w, room.h); r++) {
                    for (let dx = -r; dx <= r; dx++) for (let dy = -r; dy <= r; dy++) {
                        if (Math.abs(dx) !== r && Math.abs(dy) !== r) continue;
                        const tx = cx+dx, ty = cy+dy;
                        if (this.world[tx]?.[ty] === this.FLOOR) { cx = tx; cy = ty; break outer; }
                    }
                }
            }
            const wx = cx * this.TILE_SIZE + this.TILE_SIZE / 2;
            const wy = cy * this.TILE_SIZE + this.TILE_SIZE / 2;
            const isMimic = Math.random() < 0.12;
            const container = this.add.container(wx, wy).setDepth(2);
            const body = this.add.graphics();
            body.fillStyle(0x884400,1); body.fillRect(-10,0,20,7);
            body.fillStyle(0xffcc44,1); body.fillRect(-3,1,6,5);
            body.lineStyle(1,0x553300,1); body.strokeRect(-10,0,20,7);
            const lid = this.add.graphics();
            lid.fillStyle(0xaa6600,1); lid.fillRect(-10,-7,20,7);
            lid.lineStyle(1,0x553300,1); lid.strokeRect(-10,-7,20,7);
            const glow = this.add.rectangle(0,0,24,16, isMimic ? 0xff2200 : 0xffaa00, 0.15);
            container.add([glow,body,lid]);
            this.tweens.add({ targets:container, y:wy-5, duration:600, yoyo:true, repeat:-1, ease:'Sine.easeInOut' });
            if (!isMimic) this.tweens.add({ targets:glow, alpha:0.45, duration:400, yoyo:true, repeat:-1 });
            this.tutorialChests.push({ tileX:cx, tileY:cy, roomIndex:i, container, lid, glow, opened:false, isMimic, _mimicTriggered:false });
        }
    }

    // ─── VOLTSLIME BOSS ───────────────────────────────────────────────────

    spawnVoltslimeBoss(tileX, tileY) {
        const px = tileX * this.TILE_SIZE + this.TILE_SIZE / 2;
        const py = tileY * this.TILE_SIZE + this.TILE_SIZE / 2;
        const offsetY = this.SLIME_Y_OFFSET || -10;
        const container = this.add.container(px, py + offsetY).setDepth(3);
        const body = this.add.sprite(0, -65, 'slime_red', 0).setScale(4.5);
        body.setTint(0x88ffff);
        if (this.anims.exists('red_idle')) body.play('red_idle');

        const crown = this.add.graphics();
        crown.fillStyle(0xffff00,1); crown.fillRect(-16,-46,32,9);
        crown.fillTriangle(-16,-46,-12,-62,-7,-46); crown.fillTriangle(-3,-46,0,-64,3,-46); crown.fillTriangle(7,-46,12,-62,16,-46);
        crown.fillStyle(0x44ffff,1); crown.fillCircle(-12,-42,4);
        crown.fillStyle(0xffff44,1); crown.fillCircle(0,-42,4);
        crown.fillStyle(0x44ffff,1); crown.fillCircle(12,-42,4);
        crown.lineStyle(1.5,0xaaaa00,1); crown.strokeRect(-16,-46,32,9);

        const shadow = this.add.ellipse(0, 10, 64, 16, 0x000000, 0.3);
        const hpBg = this.add.rectangle(0,-66,72,8,0x330033,1); hpBg.setStrokeStyle(1,0x000000,1);
        const hpBar = this.add.rectangle(-36,-66,72,8,0x44ffff,1).setOrigin(0,0.5);
        const hpLabel = this.add.text(0,-78,'VOLTSLIME',{ fontSize:'9px',fontFamily:'monospace',color:'#88ffff',stroke:'#000',strokeThickness:2,fontStyle:'bold' }).setOrigin(0.5);
        const aura = this.add.graphics().setDepth(3.5);
        container.add([shadow,hpBg,hpBar,hpLabel,body,crown]);

        const baseY = py + offsetY;
        this.tweens.add({ targets:container, y:baseY-8, duration:800, yoyo:true, repeat:-1, ease:'Sine.easeInOut' });

        this.voltslimeBoss = {
            tileX, tileY, hp:1500, maxHp:1500,
            container, body, hpBar, aura,
            active:true, phase:'waiting', phaseIndex:-1,
            projectiles:[], homingProjectiles:[],
            _lastAuraTime:0, _baseY:baseY, _activated:false,
        };
    }

    _voltslimeNextPhase() {
        const boss = this.voltslimeBoss;
        if (!boss?.active) return;
        // If frozen, queue the next phase to start once thawed
        if (boss._isFrozen) {
            boss._pendingNextPhase = true;
            return;
        }
        this._voltslimeSlam(() => {
            const phases = ['scatter','homing','spawner','spiral','ricochet'];
            boss.phaseIndex = (boss.phaseIndex + 1) % phases.length;
            boss.phase = phases[boss.phaseIndex];
            if      (boss.phase === 'scatter')   this._voltslimeScatter();
            else if (boss.phase === 'homing')    this._voltslimeHoming();
            else if (boss.phase === 'spawner')   this._voltslimeSpawner();
            else if (boss.phase === 'spiral')    this._voltslimeSpiral();
            else if (boss.phase === 'ricochet')  this._voltslimeRicochet();
        });
    }

    _voltslimeSlam(onDone) {
        const boss = this.voltslimeBoss;
        if (!boss?.active) { if (onDone) onDone(); return; }
        boss.phase = 'slam';
        const bpx = boss.container.x, bpy = boss.container.y;

        // Warning ring
        const warn = this.add.circle(bpx, bpy, 8, 0xffff44, 0).setDepth(2.5);
        warn.setStrokeStyle(3, 0xffff44, 0.9);
        this.tweens.add({ targets:warn, radius: 3 * this.TILE_SIZE, alpha:0, duration:700, ease:'Quad.easeOut', onComplete:()=>warn.destroy() });

        // Wind-up squish
        this.tweens.killTweensOf(boss.body);
        this.tweens.add({ targets:boss.body, scaleX:5.5, scaleY:3.2, duration:500, ease:'Power2' });

        this.time.delayedCall(700, () => {
            if (!boss.active) { if (onDone) onDone(); return; }
            this.tweens.killTweensOf(boss.body);
            this.tweens.add({ targets:boss.body, scaleX:4.5, scaleY:4.5, duration:100, ease:'Bounce.easeOut' });
            this.cameras.main.shake(120, 0.009);

            // AoE damage in 2-tile radius — reduced from 3 tiles for melee viability
            const playerDist = Math.abs(this.playerX - boss.tileX) + Math.abs(this.playerY - boss.tileY);
            if (playerDist <= 2) {
                this.takeDamage(12);
                this.showStatusText(this.player.x, this.player.y - 20, 'SLAM!', '#ffff44');
            }

            const burst = this.add.circle(boss.container.x, boss.container.y, 12, 0xffff44, 0.9).setDepth(4);
            this.tweens.add({ targets:burst, radius: 3*this.TILE_SIZE, alpha:0, duration:350, ease:'Quad.easeOut', onComplete:()=>burst.destroy() });

            this.time.delayedCall(1000, () => { if (onDone) onDone(); });
        });
    }

    _voltslimeScatter() {
        // 10-shot rings, alternating offset — gaps of previous wave are filled by next
        const boss = this.voltslimeBoss;
        if (!boss?.active) return;
        boss.phase = 'scatter';
        const SHOTS = 10, SPEED = 100;
        let wave = 0;
        const fireWave = (offset) => {
            if (!boss.active) return;
            this.cameras.main.shake(35, 0.003);
            boss.body.setTint(0xffff44);
            this.time.delayedCall(60, () => { if (boss.body?.active) boss.body.setTint(0x88ffff); });
            for (let i = 0; i < SHOTS; i++) {
                const angle = (Math.PI * 2 / SHOTS) * i + offset;
                const g = this.add.graphics().setDepth(3);
                g.x = boss.container.x; g.y = boss.container.y;
                boss.projectiles.push({ g, vx: Math.cos(angle)*SPEED, vy: Math.sin(angle)*SPEED, startX:g.x, startY:g.y, createdAt:this.time.now });
            }
            wave++;
            if (wave < 4) this.time.delayedCall(800, () => fireWave(offset + Math.PI / SHOTS));
            else this.time.delayedCall(500, () => this._voltslimeNextPhase());
        };
        fireWave(0);
    }

    _voltslimeHoming() {
        const boss = this.voltslimeBoss;
        if (!boss?.active) return;
        boss.phase = 'homing';
        // Slow homing balls — reduced from 4 to 3, damage 45→20, more readable turn rate
        let fired = 0;
        const fireOne = () => {
            if (!boss.active) return;
            const g = this.add.graphics().setDepth(3);
            g.x = boss.container.x; g.y = boss.container.y;
            boss.homingProjectiles.push({ g, vx:0, vy:0, speed:25, createdAt:this.time.now, damage:20 });
            fired++;
            if (fired < 3) this.time.delayedCall(800, fireOne);
            else this.time.delayedCall(4000, () => this._voltslimeNextPhase());
        };
        fireOne();
    }

    _voltslimeSpawner() {
        const boss = this.voltslimeBoss;
        if (!boss?.active) return;
        boss.phase = 'spawner';
        const bossRoom = this.rooms?.[6];
        if (!bossRoom) { this.time.delayedCall(400, () => this._voltslimeNextPhase()); return; }
        let spawned = 0, attempts = 0;
        while (spawned < 4 && attempts < 80) {
            attempts++;
            const rx = bossRoom.x + 1 + Math.floor(Math.random() * (bossRoom.w - 2));
            const ry = bossRoom.y + 1 + Math.floor(Math.random() * (bossRoom.h - 2));
            if (this.world[rx]?.[ry] !== this.FLOOR) continue;
            if (this.getEnemyAt(rx, ry)) continue;
            if (Math.abs(rx - this.playerX) < 2 && Math.abs(ry - this.playerY) < 2) continue;
            const wpx = rx * this.TILE_SIZE + this.TILE_SIZE / 2;
            const wpy = ry * this.TILE_SIZE + this.TILE_SIZE / 2;
            const flash = this.add.circle(wpx, wpy, 10, 0x44ffff, 0.8).setDepth(4);
            this.tweens.add({ targets:flash, radius:20, alpha:0, duration:300, onComplete:()=>flash.destroy() });
            this.time.delayedCall(300, () => {
                if (!boss.active) return;
                if (this.world[rx]?.[ry] === this.FLOOR && !this.getEnemyAt(rx, ry)) {
                    const e = this.createEnemy(rx, ry, 30);
                    e.tutorialRoomIndex = 6;
                    e.isElectrical = true;
                    e.sprite.setTint(0x44ffff);

                    // Forking lightning aura that pulses every 600ms
                    const auraGfx = this.add.graphics().setDepth(2.5);
                    e._electricalAura = auraGfx;
                    e._electricalAuraTimer = this.time.addEvent({
                        delay: 600, loop: true,
                        callback: () => {
                            if (!e.sprite?.active || !auraGfx.active) { e._electricalAuraTimer?.remove(); auraGfx.destroy(); return; }
                            auraGfx.clear();
                            const bx = e.sprite.x, by = e.sprite.y;
                            for (let i = 0; i < 3; i++) {
                                const a = Math.random() * Math.PI * 2;
                                const r1 = 8, r2 = 18 + Math.random() * 8;
                                const ma = a + (Math.random() - 0.5) * 1.2;
                                auraGfx.lineStyle(1.5, 0x44ffff, 0.8);
                                auraGfx.beginPath();
                                auraGfx.moveTo(bx + Math.cos(a)*r1, by + Math.sin(a)*r1);
                                auraGfx.lineTo(bx + Math.cos(ma)*((r1+r2)/2), by + Math.sin(ma)*((r1+r2)/2));
                                auraGfx.lineTo(bx + Math.cos(a)*r2, by + Math.sin(a)*r2);
                                auraGfx.strokePath();
                            }
                            // Micro-stun nearby player
                            const pd = Math.abs(e.x - this.playerX) + Math.abs(e.y - this.playerY);
                            if (pd <= 1) this.takeDamage(5);
                        }
                    });
                }
            });
            spawned++;
        }
        boss.body.setTint(0xffffff);
        this.time.delayedCall(80, () => { if (boss.body?.active) boss.body.setTint(0x88ffff); });
        this.time.delayedCall(2000, () => this._voltslimeNextPhase());
    }

    _voltslimeSpiral() {
        const boss = this.voltslimeBoss;
        if (!boss?.active) return;
        boss.phase = 'spiral';
        // Faster, more projectiles — 48 shots = 4 full rotations
        const TOTAL = 48, SPEED = 90;
        const STEP = (Math.PI * 2) / 12;
        let shot = 0;
        const t = this.time.addEvent({
            delay: 90, repeat: TOTAL - 1,
            callback: () => {
                if (!boss.active) { t.remove(); return; }
                const angle = STEP * shot;
                const g = this.add.graphics().setDepth(3);
                g.x = boss.container.x; g.y = boss.container.y;
                boss.projectiles.push({ g, vx:Math.cos(angle)*SPEED, vy:Math.sin(angle)*SPEED, startX:g.x, startY:g.y, createdAt:this.time.now });
                shot++;
                if (shot >= TOTAL) this.time.delayedCall(800, () => this._voltslimeNextPhase());
            }
        });
    }

    _voltslimeRicochet() {
        // Fires 24 projectiles at random angles — each bounces off walls up to 4 times
        // Fills the room with hard-to-avoid shots; forces player to move constantly
        const boss = this.voltslimeBoss;
        if (!boss?.active) return;
        boss.phase = 'ricochet';
        const SPEED = 110, SHOTS = 16;
        boss.body.setTint(0xff44ff);
        this.time.delayedCall(60, () => { if (boss.body?.active) boss.body.setTint(0x88ffff); });
        this.cameras.main.shake(50, 0.005);

        for (let i = 0; i < SHOTS; i++) {
            const angle = (Math.PI * 2 / SHOTS) * i + Math.random() * 0.3;
            const g = this.add.graphics().setDepth(3);
            g.x = boss.container.x; g.y = boss.container.y;
            boss.projectiles.push({
                g,
                vx: Math.cos(angle) * SPEED,
                vy: Math.sin(angle) * SPEED,
                startX: g.x, startY: g.y,
                createdAt: this.time.now,
                type: 'ricochet',
                bounces: 0,
                maxBounces: 2,
            });
        }
        this.time.delayedCall(3500, () => this._voltslimeNextPhase());
    }

    updateVoltslimeBoss(time, delta) {
        const boss = this.voltslimeBoss;
        if (!boss?.active) return;
        if (boss.phase === 'waiting') return;
        const ds = delta / 1000;
        const playerPx = this.playerX * this.TILE_SIZE + this.TILE_SIZE / 2;
        const playerPy = this.playerY * this.TILE_SIZE + this.TILE_SIZE / 2;

        // Update freeze visual positions — proxy freezeVisuals follow the boss each frame
        if (boss._isFrozen && boss._bossProxy?.freezeVisuals) {
            const fbx = boss.container.x;
            const fby = boss.container.y - 20;
            const fv  = boss._bossProxy.freezeVisuals;
            if (fv.iceBlock)       { fv.iceBlock.x = fbx;       fv.iceBlock.y = fby; }
            if (fv.iceBorder)      { fv.iceBorder.x = fbx;      fv.iceBorder.y = fby; }
            if (fv.multiplierText) {
                fv.multiplierText.x = fbx;
                fv.multiplierText.y = fby - (this.TILE_SIZE * 3.2 * 0.8) / 2 - 8;
            }
        }

        // Track boss shatter/purple mark visual position
        if (boss._shatterMarkVisual) {
            boss._shatterMarkVisual.x = boss.container.x;
            boss._shatterMarkVisual.y = boss.container.y - 100;
        }

        // Update boss burn stack pip positions
        if (boss._burnStackBar) {
            const bx = boss.container.x;
            const by = boss.container.y - 130;
            const stacks = boss._burnStackBar.length;
            const GAP = 8, W = 8;
            const totalW = stacks * W + (stacks - 1) * GAP;
            for (let i = 0; i < stacks; i++) {
                const pip = boss._burnStackBar[i];
                if (!pip?.active) continue;
                pip.x = bx - totalW / 2 + i * (W + GAP) + W / 2;
                pip.y = by;
            }
        }

        // Frozen — visuals still update (overlay tracked above), but no new phase actions
        // Boss keeps shooting existing projectiles and aura; _isFrozen blocks new phase starts
        // via freezeVoltslime / _voltslimeNextPhase guard, not here.
        if (boss._isFrozen && time >= boss._frozenUntil) this._thawVoltslime();

        // Electric aura
        if (time - boss._lastAuraTime > 80) {
            boss._lastAuraTime = time;
            boss.aura.clear();
            const bx = boss.container.x, by = boss.container.y;
            for (let i = 0; i < 6; i++) {
                const a = Math.random()*Math.PI*2, r1 = 28, r2 = 38+Math.random()*12, ma = a+(Math.random()-0.5)*0.9;
                boss.aura.lineStyle(1.5, 0x44ffff, 0.5+Math.random()*0.5);
                boss.aura.beginPath();
                boss.aura.moveTo(bx+Math.cos(a)*r1, by+Math.sin(a)*r1);
                boss.aura.lineTo(bx+Math.cos(ma)*((r1+r2)/2), by+Math.sin(ma)*((r1+r2)/2));
                boss.aura.lineTo(bx+Math.cos(a)*r2, by+Math.sin(a)*r2);
                boss.aura.strokePath();
            }
        }

        // Scatter/spiral projectiles
        for (let i = boss.projectiles.length - 1; i >= 0; i--) {
            const p = boss.projectiles[i];
            p.g.x += p.vx * ds; p.g.y += p.vy * ds;
            p.g.clear();
            // Ricochet projectiles are magenta, others cyan
            if (p.type === 'ricochet') {
                p.g.fillStyle(0xff44ff, 0.9); p.g.fillCircle(0,0,5);
                p.g.fillStyle(0xffffff, 0.7); p.g.fillCircle(0,0,2.5);
            } else {
                p.g.fillStyle(0x44ffff, 0.9); p.g.fillCircle(0,0,5);
                p.g.fillStyle(0xffffff, 0.7); p.g.fillCircle(0,0,2.5);
            }
            const maxRange = p.type === 'ricochet' ? 40 * this.TILE_SIZE : 18 * this.TILE_SIZE;
            if (Math.hypot(p.g.x-p.startX, p.g.y-p.startY) > maxRange) { p.g.destroy(); boss.projectiles.splice(i,1); continue; }
            const tx = Math.floor(p.g.x/this.TILE_SIZE), ty = Math.floor(p.g.y/this.TILE_SIZE);
            const outOfBounds = tx < 0 || tx >= this.WORLD_WIDTH || ty < 0 || ty >= this.WORLD_HEIGHT;
            const hitWall = !outOfBounds && this.world[tx][ty] === this.WALL;
            if (outOfBounds || hitWall) {
                if (p.type === 'ricochet' && p.bounces < p.maxBounces) {
                    // Determine bounce axis
                    const fromTx = Math.floor((p.g.x - p.vx * ds) / this.TILE_SIZE);
                    const fromTy = Math.floor((p.g.y - p.vy * ds) / this.TILE_SIZE);
                    const wallOnX = !outOfBounds && this.world[tx]?.[fromTy] === this.WALL;
                    const wallOnY = !outOfBounds && this.world[fromTx]?.[ty] === this.WALL;
                    if (wallOnX && !wallOnY) p.vx = -p.vx;
                    else if (wallOnY && !wallOnX) p.vy = -p.vy;
                    else { p.vx = -p.vx; p.vy = -p.vy; }
                    p.bounces++;
                    p.g.x += p.vx * ds * 3;
                    p.g.y += p.vy * ds * 3;
                } else {
                    p.g.destroy(); boss.projectiles.splice(i,1); continue;
                }
            }
            if (Math.abs(p.g.x-playerPx) < this.TILE_SIZE*0.7 && Math.abs(p.g.y-playerPy) < this.TILE_SIZE*0.7) { this.takeDamage(10); p.g.destroy(); boss.projectiles.splice(i,1); }
        }

        // Homing projectiles
        for (let i = boss.homingProjectiles.length - 1; i >= 0; i--) {
            const p = boss.homingProjectiles[i];
            const ddx = playerPx-p.g.x, ddy = playerPy-p.g.y;
            if (Math.hypot(ddx,ddy) > 0) {
                const TURN = 0.7, target = Math.atan2(ddy,ddx);
                const cur = Math.atan2(p.vy,p.vx) || target;
                let diff = target - cur;
                while (diff > Math.PI) diff -= Math.PI*2;
                while (diff < -Math.PI) diff += Math.PI*2;
                const newA = cur + Math.sign(diff)*Math.min(Math.abs(diff), TURN*ds);
                p.vx = Math.cos(newA)*p.speed; p.vy = Math.sin(newA)*p.speed;
            }
            p.g.x += p.vx*ds; p.g.y += p.vy*ds;
            p.g.clear();
            const pulse = 0.7 + Math.sin(time/120)*0.3;
            p.g.fillStyle(0xaa44ff, 0.9*pulse); p.g.fillCircle(0,0,10);
            p.g.fillStyle(0xffffff, 0.6); p.g.fillCircle(0,0,4);
            p.g.lineStyle(1, 0xaa44ff, 0.35); p.g.strokeCircle(0,0,16);
            if (time - p.createdAt > 7000) { p.g.destroy(); boss.homingProjectiles.splice(i,1); continue; }
            const tx2 = Math.floor(p.g.x/this.TILE_SIZE), ty2 = Math.floor(p.g.y/this.TILE_SIZE);
            if (tx2 < 0 || tx2 >= this.WORLD_WIDTH || ty2 < 0 || ty2 >= this.WORLD_HEIGHT || this.world[tx2][ty2] === this.WALL) { p.g.destroy(); boss.homingProjectiles.splice(i,1); continue; }
            if (Math.abs(p.g.x-playerPx) < this.TILE_SIZE*0.9 && Math.abs(p.g.y-playerPy) < this.TILE_SIZE*0.9) {
                this.takeDamage(p.damage);
                this.showStatusText(this.player.x, this.player.y-20, 'HOMING HIT!', '#aa44ff');
                p.g.destroy(); boss.homingProjectiles.splice(i,1);
            }
        }

        boss.tileX = Math.floor(boss.container.x / this.TILE_SIZE);
        boss.tileY = Math.floor(boss.container.y / this.TILE_SIZE);
        boss.hpBar.width = 72 * Math.max(0, boss.hp / boss.maxHp);
        if (boss.hp <= 0) this._killVoltslimeBoss();
    }

    damageVoltslimeBoss(damage) {
        const boss = this.voltslimeBoss;
        if (!boss?.active) return;

        // Shatter: if frozen and not in shatter immunity window
        if (boss._isFrozen && !boss._shatterImmune) {
            damage *= 2.5;
            // Dramatic shatter burst before thawing
            const bx = boss.container.x, by = boss.container.y;
            for (let i = 0; i < 16; i++) {
                const a = (i / 16) * Math.PI * 2;
                const shard = this.add.graphics().setDepth(6);
                shard.x = bx; shard.y = by;
                const sl = 8 + Math.random() * 14, sw = 2.5;
                shard.fillStyle(i % 2 === 0 ? 0xddf8ff : 0xffffff, 0.95);
                shard.beginPath();
                shard.moveTo(Math.cos(a)*6, Math.sin(a)*6);
                shard.lineTo(Math.cos(a)*sl + Math.sin(a)*sw, Math.sin(a)*sl - Math.cos(a)*sw);
                shard.lineTo(Math.cos(a)*sl - Math.sin(a)*sw, Math.sin(a)*sl + Math.cos(a)*sw);
                shard.closePath(); shard.fillPath();
                this.tweens.add({
                    targets: shard,
                    x: bx + Math.cos(a)*(50 + Math.random()*20),
                    y: by + Math.sin(a)*(50 + Math.random()*20),
                    alpha: 0, scaleX: 0.2, scaleY: 0.2, duration: 400 + Math.random()*150,
                    onComplete: () => shard.destroy()
                });
            }
            // Shockwave rings
            for (let r = 0; r < 3; r++) {
                const ring = this.add.graphics().setDepth(5.8);
                ring.x = bx; ring.y = by;
                ring.lineStyle(3 - r, r === 0 ? 0xffffff : 0x88ddff, 0.9 - r*0.2);
                ring.strokeCircle(0, 0, 10 + r*8);
                this.tweens.add({ targets: ring, scaleX: 5 + r, scaleY: 5 + r, alpha: 0, duration: 380 + r*60, ease: 'Quad.easeOut', onComplete: () => ring.destroy() });
            }
            this._thawVoltslime();
            // Clean up mark visual on shatter
            // Mark persists through shatter — only expires via its own timer
            // Brief shatter immunity — prevents cascade from multiple simultaneous splitter hits
            boss._shatterImmune = true;
            this.time.delayedCall(600, () => { if (boss) boss._shatterImmune = false; });
            if (typeof this._shatterWaterSplash === 'function') this._shatterWaterSplash(boss.tileX, boss.tileY);
            this.showStatusText(bx, by - 70, 'SHATTER!', '#aaffff');
            this.cameras.main.shake(160, 0.014);
        }

        boss.hp -= damage;
        boss.hpBar.width = 72 * Math.max(0, boss.hp / boss.maxHp);
        // Show damage number above boss
        this.showDamageNumber(
            boss.container.x + (Math.random() - 0.5) * 30,
            boss.container.y - 90,
            damage,
            boss._isFrozen ? '#aaffff' : '#ffffff'
        );
        if (!boss._isFrozen) {
            boss.body.setTint(0xffffff);
            this.time.delayedCall(80, () => { if (boss.body?.active) boss.body.setTint(0x88ffff); });
        }
        if (boss.hp <= 0) this._killVoltslimeBoss();
    }

    freezeVoltslime(duration) {
        const boss = this.voltslimeBoss;
        if (!boss?.active || boss._isFrozen) return;
        boss._isFrozen = true;
        boss._frozenUntil = this.time.now + duration;
        boss.body.setTint(0x88ccff);

        // Clear per-shard hit tracking on THAW (not on freeze) so shards already
        // in flight can't immediately re-shatter the newly frozen boss
        // (clearing happens in _thawVoltslime)

        const bx = boss.container.x;
        const by = boss.container.y - 20; // body centre in world space

        // Proxy for createFreezeVisual — it adds +10 internally so we subtract 10
        const proxy = {
            sprite: { x: bx, y: by - 10, setTint: () => {}, active: true },
            freezeVisuals: null
        };

        // Scale TILE_SIZE so the block covers the 4.5× boss body
        const origTileSize = this.TILE_SIZE;
        this.TILE_SIZE = origTileSize * 3.2;
        this.createFreezeVisual(proxy);
        this.TILE_SIZE = origTileSize;

        // Set depth high so it's always visible above the boss
        if (proxy.freezeVisuals) {
            const fv = proxy.freezeVisuals;
            if (fv.iceBlock)       fv.iceBlock.setDepth(8);
            if (fv.iceBorder)      fv.iceBorder.setDepth(8.1);
            if (fv.multiplierText) { fv.multiplierText.setDepth(8.2); fv.multiplierText.setText('2.5x DMG'); }
        }

        boss._bossProxy  = proxy;
        boss._iceOverlay = proxy.freezeVisuals?.iceBlock || null;

        if (typeof this.spawnIceSplinter === 'function') {
            this.spawnIceSplinter(bx, by);
            this.spawnIceSplinter(bx, by);
        }

        this.showStatusText(bx, by - origTileSize * 1.5, 'FROZEN!', '#88ccff');
        boss._freezeTimer = this.time.delayedCall(duration, () => this._thawVoltslime());
    }

    _thawVoltslime() {
        const boss = this.voltslimeBoss;
        if (!boss?.active || !boss._isFrozen) return;
        boss._isFrozen = false;
        if (boss._freezeTimer) { boss._freezeTimer.remove(); boss._freezeTimer = null; }
        // Clear shard hit tracking on thaw — shards fired after this can hit again
        boss._hitShards      = new Set();
        boss._frozenByShards = new Set();
        // Clean up freeze visuals via proxy — same path as regular enemy thaw
        if (boss._bossProxy?.freezeVisuals) {
            const fv = boss._bossProxy.freezeVisuals;
            ['iceBlock', 'iceBorder', 'multiplierText'].forEach(k => {
                if (fv[k]) { this.tweens.killTweensOf(fv[k]); fv[k].setVisible(false); fv[k].destroy(); }
            });
            boss._bossProxy.freezeVisuals = null;
        }
        boss._bossProxy  = null;
        boss._iceOverlay = null;
        boss.body.setTint(0x88ffff);
        if (boss._pendingNextPhase) {
            boss._pendingNextPhase = false;
            this.time.delayedCall(200, () => this._voltslimeNextPhase());
        }
    }

    // Called by ice weapons (pierce spike, splitter, heal splinter) to
    // accumulate freeze stacks on the boss independently of current element.
    freezeBossFromIceWeapon(instantFreeze) {
        // Voltslime
        if (this.voltslimeBoss?.active) {
            const boss = this.voltslimeBoss;
            if (!boss._isFrozen) {
                if (instantFreeze) {
                    boss._freezeStacks = 0;
                    this.freezeVoltslime(2200);
                } else {
                    boss._freezeStacks = (boss._freezeStacks || 0) + 1;
                    if (boss._freezeStacks >= 3) {
                        boss._freezeStacks = 0;
                        this.freezeVoltslime(2200);
                    }
                }
            }
        }
        // Void Sovereign — same chill stack logic
        if (this.voidSovereignBoss?.active && !this.voidSovereignBoss._isInvulnerable) {
            const boss = this.voidSovereignBoss;
            if (!boss._isFrozen) {
                if (instantFreeze) {
                    boss._freezeStacks = 0;
                    this._freezeVoidSovereign(2200);
                } else {
                    boss._freezeStacks = (boss._freezeStacks || 0) + 1;
                    if (boss._freezeStacks >= 3) {
                        boss._freezeStacks = 0;
                        this._freezeVoidSovereign(2200);
                    }
                }
            }
        }
    }

    _freezeVoidSovereign(duration) {
        const boss = this.voidSovereignBoss;
        if (!boss?.active || boss._isFrozen) return;
        boss._isFrozen = true;
        boss._frozenUntil = this.time.now + duration;
        boss._freezeStacks = 0;
        if (boss.body?.active) boss.body.setTint(0x88ccff);

        const bx = boss.container.x;
        const by = boss.container.y - 20;

        // Proxy mirrors voltslime pattern — createFreezeVisual expects sprite.x/y
        const proxy = {
            sprite: { x: bx, y: by - 10, setTint: () => {}, active: true },
            freezeVisuals: null
        };

        // Scale TILE_SIZE so the block covers the 5× boss body
        const origTileSize = this.TILE_SIZE;
        this.TILE_SIZE = origTileSize * 3.6;
        this.createFreezeVisual(proxy);
        this.TILE_SIZE = origTileSize;

        if (proxy.freezeVisuals) {
            const fv = proxy.freezeVisuals;
            if (fv.iceBlock)  fv.iceBlock.setDepth(8);
            if (fv.iceBorder) fv.iceBorder.setDepth(8.1);
        }

        boss._bossProxy  = proxy;
        boss._iceOverlay = proxy.freezeVisuals?.iceBlock || null;

        if (typeof this.spawnIceSplinter === 'function') {
            this.spawnIceSplinter(bx, by);
            this.spawnIceSplinter(bx, by);
        }

        this.showStatusText(bx, by - origTileSize * 1.8, 'FROZEN!', '#88ccff');
        boss._freezeTimer = this.time.delayedCall(duration, () => this._thawVoidSovereign());
    }

    _thawVoidSovereign() {
        const boss = this.voidSovereignBoss;
        if (!boss?.active) return;
        boss._isFrozen = false;
        boss._frozenUntil = 0;
        if (boss._freezeTimer) { boss._freezeTimer.remove(); boss._freezeTimer = null; }
        if (boss._bossProxy?.freezeVisuals) {
            const fv = boss._bossProxy.freezeVisuals;
            if (fv._extraLayers) { for (const l of fv._extraLayers) { this.tweens.killTweensOf(l); l.destroy(); } fv._extraLayers = []; }
            ['iceBlock', 'iceBorder'].forEach(k => {
                if (fv[k]) { this.tweens.killTweensOf(fv[k]); fv[k].setVisible(false); fv[k].destroy(); }
            });
            boss._bossProxy.freezeVisuals = null;
        }
        boss._bossProxy  = null;
        boss._iceOverlay = null;
        boss._hitShards  = new Set();
        if (boss.body?.active) boss.body.setTint(0x6600aa); // restore base dark purple
    }

    _killVoltslimeBoss() {
        const boss = this.voltslimeBoss;
        if (!boss?.active) return;
        boss.active = false;
        for (const p of [...boss.projectiles, ...boss.homingProjectiles]) { if (p.g?.active) p.g.destroy(); }
        boss.projectiles = []; boss.homingProjectiles = [];
        if (boss.aura?.active) boss.aura.destroy();
        // Clean up burn stacks
        if (boss._burnDoTTimer) { boss._burnDoTTimer.remove(); boss._burnDoTTimer = null; }
        if (boss._burnStackBar) { for (const pip of boss._burnStackBar) pip.destroy(); boss._burnStackBar = null; }
        boss.burnStacks = 0;
        if (boss._bossProxy?.freezeVisuals) {
            const fv = boss._bossProxy.freezeVisuals;
            ['iceBlock', 'iceBorder', 'multiplierText'].forEach(k => { if (fv[k]) { fv[k].destroy(); } });
            boss._bossProxy.freezeVisuals = null;
        }
        boss._bossProxy = null; boss._iceOverlay = null;
        if (boss._shatterMarkVisual) { boss._shatterMarkVisual.destroy(); boss._shatterMarkVisual = null; }
        if (boss._shatterMarkTimer)  { boss._shatterMarkTimer.remove();  boss._shatterMarkTimer  = null; }
        if (typeof this._recalcMagmaFireballCount === 'function') this._recalcMagmaFireballCount();

        const bpx = boss.container.x, bpy = boss.container.y;
        const flash = this.add.circle(bpx, bpy, 20, 0xffffff, 1).setDepth(6);
        this.tweens.add({ targets:flash, radius:80, alpha:0, duration:500, ease:'Quad.easeOut', onComplete:()=>flash.destroy() });
        for (let i = 0; i < 20; i++) {
            const a = (i/20)*Math.PI*2;
            const blob = this.add.circle(bpx, bpy, 5+Math.random()*7, 0x44ffff, 1).setDepth(5);
            this.tweens.add({ targets:blob, x:bpx+Math.cos(a)*(40+Math.random()*40), y:bpy+Math.sin(a)*(40+Math.random()*40), alpha:0, scaleX:0.1, scaleY:0.1, duration:500+Math.random()*200, ease:'Quad.easeOut', onComplete:()=>blob.destroy() });
        }
        this.cameras.main.shake(200, 0.013);
        this.showStatusText(bpx, bpy-50, 'VOLTSLIME DEFEATED!', '#44ffff');
        this.tweens.killTweensOf(boss.container);
        this.tweens.add({ targets:boss.container, alpha:0, duration:400, onComplete:()=>boss.container.destroy() });
        this.totalGlorps = (this.totalGlorps || 0) + 80;
        localStorage.setItem('glorps', this.totalGlorps);
        if (this.glorpText) this.glorpText.setText(`✦ ${this.totalGlorps} Glorps`);
        this._level2RoomClear(6);
    }

    // ─── FINAL CHEST + UNLOCK CINEMATIC ──────────────────────────────────

    spawnFinalLevelChest(tileX, tileY, elementToUnlock) {
        const cx = tileX * this.TILE_SIZE + this.TILE_SIZE / 2;
        const cy = tileY * this.TILE_SIZE + this.TILE_SIZE / 2;
        const container = this.add.container(cx, cy).setDepth(3);
        const shadow = this.add.ellipse(0, 6, 22, 8, 0x000000, 0.3);
        const body = this.add.graphics();
        body.fillStyle(0x884400,1); body.fillRect(-10,0,20,7); body.fillStyle(0xffcc44,1); body.fillRect(-3,1,6,5); body.lineStyle(1,0x553300,1); body.strokeRect(-10,0,20,7);
        const lid = this.add.graphics();
        lid.fillStyle(0xaa6600,1); lid.fillRect(-10,-7,20,7); lid.lineStyle(1,0x553300,1); lid.strokeRect(-10,-7,20,7);
        const crackleGfx = this.add.graphics().setDepth(3.5);
        const glow = this.add.rectangle(0,0,28,18,0xffff00,0.25);
        container.add([shadow,glow,body,lid]);

        const hoverY = cy - 28;
        this.tweens.add({ targets:container, y:hoverY, duration:900, ease:'Sine.easeOut', onComplete:() => {
            this.tweens.add({ targets:container, y:hoverY-6, duration:700, yoyo:true, repeat:-1, ease:'Sine.easeInOut' });
        }});
        this.tweens.add({ targets:glow, alpha:0.55, duration:350, yoyo:true, repeat:-1 });

        const crackleTimer = this.time.addEvent({ delay:80, loop:true, callback:() => {
            if (!crackleGfx.active) return;
            crackleGfx.clear();
            const bx = container.x, by = container.y;
            for (let i = 0; i < 5; i++) {
                const a = Math.random()*Math.PI*2, r1 = 14+Math.random()*4, r2 = 22+Math.random()*10, ma = a+(Math.random()-0.5)*0.8;
                crackleGfx.lineStyle(1.5, 0xffff44, 0.6+Math.random()*0.4);
                crackleGfx.beginPath();
                crackleGfx.moveTo(bx+Math.cos(a)*r1, by+Math.sin(a)*r1);
                crackleGfx.lineTo(bx+Math.cos(ma)*((r1+r2)/2), by+Math.sin(ma)*((r1+r2)/2));
                crackleGfx.lineTo(bx+Math.cos(a)*r2, by+Math.sin(a)*r2);
                crackleGfx.strokePath();
            }
        }});

        if (!this.tutorialChests) this.tutorialChests = [];
        this.tutorialChests.push({ tileX, tileY, roomIndex:-1, container, lid, body, glow, shadow, crackleGfx, crackleTimer, opened:false, isFinalChest:true, elementToUnlock });
    }

    openFinalLevelChest(chest) {
        if (!chest || chest.opened) return;
        chest.opened = true;
        if (chest.crackleTimer) chest.crackleTimer.remove();
        if (chest.crackleGfx) { this.tweens.add({ targets:chest.crackleGfx, alpha:0, duration:200, onComplete:()=>chest.crackleGfx.destroy() }); }
        this.tweens.add({ targets:chest.lid, y:-40, angle:-25, alpha:0, duration:350, ease:'Quad.easeOut', onComplete:()=>chest.lid.destroy() });
        for (let i = 0; i < 14; i++) {
            const a = (i/14)*Math.PI*2;
            const spark = this.add.rectangle(chest.container.x, chest.container.y, 4,4, 0xffff44, 1).setDepth(5);
            this.tweens.add({ targets:spark, x:spark.x+Math.cos(a)*40, y:spark.y+Math.sin(a)*40, alpha:0, scaleX:0.1, scaleY:0.1, duration:500, ease:'Quad.easeOut', onComplete:()=>spark.destroy() });
        }
        this.time.delayedCall(300, () => { this.tweens.add({ targets:chest.container, alpha:0, duration:300, onComplete:()=>chest.container.destroy() }); });
        this.cameras.main.shake(80, 0.006);

        const element = chest.elementToUnlock;
        let alreadyHad = false;
        if (element) {
            alreadyHad = localStorage.getItem(`unlocked_${element}`) === 'true';
            localStorage.setItem(`unlocked_${element}`, 'true');
            if (!this.unlockedElements) this.unlockedElements = new Set(['fire','ice']);
            this.unlockedElements.add(element);
        }

        this.time.delayedCall(600, () => this._showElementUnlockCinematic(element, alreadyHad));
    }

    _showElementUnlockCinematic(element, alreadyUnlocked) {
        const W = this.scale.width, H = this.scale.height;
        const blackBg = this.add.rectangle(W/2,H/2,W,H,0x000000,0).setScrollFactor(0).setDepth(500);
        this.tweens.add({ targets:blackBg, alpha:1, duration:600, ease:'Quad.easeIn', onComplete:() => {
            const colors = { lightning:0xffff44, cosmic:0xcc88ff, fire:0xff6600, ice:0x44ccff };
            const names  = { lightning:'LIGHTNING', cosmic:'COSMIC', fire:'FIRE', ice:'ICE' };
            const keys   = { lightning:'3', cosmic:'4', fire:'1', ice:'2' };
            const col = element ? (colors[element] || 0xffffff) : 0xffd866;
            const colHex = '#'+col.toString(16).padStart(6,'0');
            const elName = element ? (names[element] || element.toUpperCase()) : null;
            const keyNum = element ? (keys[element] || '?') : null;
            const sx = W/2, sy = H/2 - 60;

            const sigil = this.add.graphics().setScrollFactor(0).setDepth(501).setAlpha(0);
            sigil.fillStyle(col,0.15); sigil.fillCircle(sx,sy,52);
            sigil.lineStyle(3,col,0.8); sigil.strokeCircle(sx,sy,52);
            if (element === 'lightning') {
                sigil.fillStyle(col,1);
                sigil.fillTriangle(sx-8,sy-30,sx+14,sy-30,sx+2,sy+2);
                sigil.fillTriangle(sx-14,sy+2,sx+8,sy+2,sx-2,sy+30);
                sigil.fillStyle(0xffffff,0.7); sigil.fillTriangle(sx-4,sy-26,sx+8,sy-26,sx+1,sy-4);
            }
            this.tweens.add({ targets:sigil, alpha:1, duration:500, ease:'Quad.easeOut' });

            const ring = this.add.circle(sx,sy,10,0x000000,0).setScrollFactor(0).setDepth(501).setStrokeStyle(2,col,0.9).setAlpha(0);
            this.tweens.add({ targets:ring, alpha:1, duration:300, onComplete:() => {
                this.tweens.add({ targets:ring, radius:70, alpha:0, duration:700, ease:'Quad.easeOut', onComplete:()=>ring.destroy() });
            }});

            const unlockLabel = !element
                ? this.add.text(W/2,H/2+20,'LEVEL COMPLETE',{ fontSize:'30px',fontFamily:'monospace',color:colHex,stroke:'#000000',strokeThickness:5,fontStyle:'bold' }).setOrigin(0.5).setScrollFactor(0).setDepth(502).setAlpha(0)
                : alreadyUnlocked
                    ? this.add.text(W/2,H/2+20,`${elName} MASTERED`,{ fontSize:'28px',fontFamily:'monospace',color:colHex,stroke:'#000000',strokeThickness:5,fontStyle:'bold' }).setOrigin(0.5).setScrollFactor(0).setDepth(502).setAlpha(0)
                    : this.add.text(W/2,H/2+10,'YOU UNLOCKED',{ fontSize:'18px',fontFamily:'monospace',color:'#aaaaaa',stroke:'#000000',strokeThickness:3 }).setOrigin(0.5).setScrollFactor(0).setDepth(502).setAlpha(0);
            const elLabel = (!element || alreadyUnlocked) ? null : this.add.text(W/2,H/2+44,elName,{ fontSize:'38px',fontFamily:'monospace',color:colHex,stroke:'#000000',strokeThickness:6,fontStyle:'bold' }).setOrigin(0.5).setScrollFactor(0).setDepth(502).setAlpha(0);
            const subLabel = element ? this.add.text(W/2,H/2+90,`Press ${keyNum} to switch`,{ fontSize:'14px',fontFamily:'monospace',color:'#666666',stroke:'#000000',strokeThickness:2 }).setOrigin(0.5).setScrollFactor(0).setDepth(502).setAlpha(0) : null;
            const contLabel = this.add.text(W/2,H-80,'▼ Click to continue',{ fontSize:'13px',fontFamily:'monospace',color:'#444444' }).setOrigin(0.5).setScrollFactor(0).setDepth(502).setAlpha(0);

            this.time.delayedCall(200, () => {
                this.tweens.add({ targets:unlockLabel, alpha:1, y:unlockLabel.y-8, duration:500, ease:'Quad.easeOut' });
                if (elLabel) this.tweens.add({ targets:elLabel, alpha:1, y:elLabel.y-8, duration:500, ease:'Quad.easeOut', delay:150 });
                if (subLabel) this.tweens.add({ targets:subLabel, alpha:0.7, duration:400, delay:400 });
                this.tweens.add({ targets:contLabel, alpha:0.6, duration:400, delay:700, onComplete:() => {
                    this.tweens.add({ targets:contLabel, alpha:0.3, duration:600, yoyo:true, repeat:-1 });
                }});
            });

            const handler = () => {
                this.input.off('pointerdown', handler);
                [blackBg,sigil,unlockLabel,elLabel,subLabel,contLabel].forEach(o => { if (o?.active) { this.tweens.killTweensOf(o); this.tweens.add({ targets:o, alpha:0, duration:400 }); }});
                this.time.delayedCall(450, () => { this.cameras.main.fadeOut(400,0,0,0); this.time.delayedCall(400, () => this.scene.start('LevelSelect')); });
            };
            this.time.delayedCall(800, () => this.input.on('pointerdown', handler));
        }});
    }

    // ═══════════════════════════════════════════════════════════════════════
    // LEVEL 3 — THE VOID RIFT
    // ═══════════════════════════════════════════════════════════════════════

    updateLevel3(time) {
        const playerRoom = this.getCurrentPlayerRoom();
        if (playerRoom === -1) return;

        for (let enemy of this.enemies) {
            if (!enemy.sprite || !enemy.sprite.active) continue;
            const mx = enemy.sprite.x, my = enemy.sprite.y;
            if (enemy._fireMark?.active)   enemy._fireMark.setPosition(mx, my - 22);
            if (enemy._inhibitRing?.active) enemy._inhibitRing.setPosition(mx, my);
            if (enemy._iceMark?.active)     enemy._iceMark.setPosition(mx, my - 22);
            if (enemy._lightningMark?.active) enemy._lightningMark.setPosition(mx, my - 22);
            if (enemy._voidMark?.active)    enemy._voidMark.setPosition(mx, my - 22);
            if (enemy._chillBar) {
                for (let i = 0; i < enemy._chillBar.length; i++) {
                    const dot = enemy._chillBar[i];
                    if (dot.active) { dot.x = mx + (i - 1) * 10; dot.y = my - 30; }
                }
            }
            // Void sniper: update charge zone visual
            if (enemy.isVoidSniper && enemy._sniperCharging && enemy._sniperChargeGfx?.active) {
                enemy._sniperChargeGfx.x = enemy.sprite.x;
                enemy._sniperChargeGfx.y = enemy.sprite.y;
            }
        }

        if (playerRoom !== this.currentTutorialRoom) {
            this.currentTutorialRoom = playerRoom;
            if (this.tutorialDoorsLocked[playerRoom]) this.lockTutorialDoors(playerRoom);
            if (playerRoom === 0) {
                this.tutorialRoomCleared[0] = true;
                this.tutorialDoorsLocked[0] = false;
                this.unlockTutorialDoors(0);
            }
            // Boss room — activate Void Sovereign when player enters
            const bossRoomIndex = 6;
            if (playerRoom === bossRoomIndex && this.voidSovereignBoss && !this.voidSovereignBoss._activated) {
                this.voidSovereignBoss._activated = true;
                this.time.delayedCall(1800, () => this._voidSovereignNextAttack());
            }
            // Cosmic tutorial room
            if (playerRoom === 2 && !this._cosmicTutorialShown) {
                this._cosmicTutorialShown = true;
                this._showCosmicTutorial();
            }
        }

        if (!this._roomHadEnemies) this._roomHadEnemies = {};
        if (!this.tutorialRoomCleared[playerRoom]) {
            const roomEnemies = this.enemies.filter(e => e.tutorialRoomIndex === playerRoom);
            if (roomEnemies.length > 0) this._roomHadEnemies[playerRoom] = true;
            if (roomEnemies.length === 0 && this._roomHadEnemies[playerRoom]) {
                const bossRoomIndex = 6;
                if (playerRoom === bossRoomIndex) {
                    if (!this.voidSovereignBoss?.active) this._level3RoomClear(playerRoom);
                } else {
                    this._level3RoomClear(playerRoom);
                }
            }
        }

        // Key pickup detection
        if (this._voidKeys?.length) {
            for (const key of this._voidKeys) {
                if (key.collected) continue;
                if (Math.abs(key.tileX - this.playerX) <= 1 && Math.abs(key.tileY - this.playerY) <= 1) {
                    this._collectVoidKey(key);
                }
            }
        }

        // Boss door interaction — player bumping into it tries to unlock
        if (this._bossDoor?.locked) {
            const bd = this._bossDoor;
            for (let dx = 0; dx < bd.w; dx++) {
                if (Math.abs(this.playerX - (bd.tileX + dx)) <= 1 && Math.abs(this.playerY - bd.tileY) <= 1) {
                    if (!this._bossDoorLastTry || this.time.now - this._bossDoorLastTry > 1500) {
                        this._bossDoorLastTry = this.time.now;
                        this._tryUnlockBossDoor();
                    }
                    break;
                }
            }
        }

        // Chest detection
        if (this.tutorialChests) {
            for (const chest of this.tutorialChests) {
                if (chest.opened) continue;
                if (this.playerX !== chest.tileX || this.playerY !== chest.tileY) continue;
                if (chest.isFinalChest) {
                    if (!this.voidSovereignBoss?.active) this.openFinalLevelChest(chest);
                } else {
                    this.openTutorialChest(chest.roomIndex, chest.container, null);
                }
            }
        }

        // Update Void Sovereign boss
        if (this.voidSovereignBoss?.active) {
            this._updateVoidSovereign(time);
        }

        // Update player root
        if (this._playerRooted && time >= this._playerRootUntil) {
            this._playerRooted = false;
            if (this.player?.active) this.player.clearTint();
        }
    }

    _level3RoomClear(roomIndex) {
        this.tutorialRoomCleared[roomIndex] = true;
        this.unlockTutorialDoors(roomIndex);
        const bossRoomIndex = 6;
        if (roomIndex === bossRoomIndex) {
            this.time.delayedCall(800, () => {
                const chest = (this.tutorialChests || []).find(c => c.isFinalChest && !c.opened);
                if (chest) this.openFinalLevelChest(chest);
            });
            return;
        }
        this.spawnTutorialChest(roomIndex);
        // Key rooms: R1 Crucible, R3 Gauntlet, R4 Sniper Hall
        if (roomIndex === 1 || roomIndex === 3 || roomIndex === 4) {
            this.time.delayedCall(600, () => this._spawnVoidKey(roomIndex));
        }
    }

    _spawnVoidKey(roomIndex) {
        const room = this.rooms[roomIndex];
        if (!room) return;
        // Spawn at room center
        const tx = Math.floor(room.x + room.w / 2);
        const ty = Math.floor(room.y + room.h / 2);
        const px = tx * this.TILE_SIZE + this.TILE_SIZE / 2;
        const py = ty * this.TILE_SIZE + this.TILE_SIZE / 2;

        // Visual — glowing purple void crystal key
        const g = this.add.graphics().setDepth(3);
        const drawKey = () => {
            g.clear();
            const t = this.time.now / 600;
            const pulse = 0.7 + 0.3 * Math.sin(t);
            // Outer glow
            g.fillStyle(0xcc44ff, 0.15 * pulse); g.fillCircle(px, py, 16);
            // Key shaft
            g.fillStyle(0xcc44ff, 0.90); g.fillRect(px - 2, py - 10, 4, 18);
            // Key bow (top circle)
            g.lineStyle(3, 0xcc44ff, 0.90); g.strokeCircle(px, py - 13, 6);
            g.fillStyle(0xee88ff, 0.80); g.fillCircle(px, py - 13, 3);
            // Key teeth
            g.fillStyle(0xcc44ff, 0.90);
            g.fillRect(px + 2, py + 2, 5, 3);
            g.fillRect(px + 2, py + 7, 4, 3);
            // Sparkle
            g.fillStyle(0xffffff, pulse * 0.70); g.fillCircle(px - 3, py - 16, 1.5);
        };
        drawKey();

        // Bob animation
        const startY = py;
        const bobTimer = this.time.addEvent({ delay: 30, loop: true, callback: () => {
            if (!g.active) { bobTimer.remove(); return; }
            g.clear();
            const t2 = this.time.now / 600;
            const pulse2 = 0.7 + 0.3 * Math.sin(t2);
            const bobOffset = Math.sin(this.time.now / 400) * 4;
            const yOff = startY + bobOffset;
            g.fillStyle(0xcc44ff, 0.15 * pulse2); g.fillCircle(px, yOff, 16);
            g.fillStyle(0xcc44ff, 0.90); g.fillRect(px - 2, yOff - 10, 4, 18);
            g.lineStyle(3, 0xcc44ff, 0.90); g.strokeCircle(px, yOff - 13, 6);
            g.fillStyle(0xee88ff, 0.80); g.fillCircle(px, yOff - 13, 3);
            g.fillStyle(0xcc44ff, 0.90);
            g.fillRect(px + 2, yOff + 2, 5, 3);
            g.fillRect(px + 2, yOff + 7, 4, 3);
            g.fillStyle(0xffffff, pulse2 * 0.70); g.fillCircle(px - 3, yOff - 16, 1.5);
        }});

        if (!this._voidKeys) this._voidKeys = [];
        this._voidKeys.push({ gfx: g, tileX: tx, tileY: ty, roomIndex, timer: bobTimer, collected: false });

        // Label
        const lbl = this.add.text(px, py - 28, 'VOID KEY', {
            fontSize: '8px', fontFamily: 'monospace', color: '#cc88ff',
            stroke: '#000', strokeThickness: 2, fontStyle: 'bold'
        }).setOrigin(0.5).setDepth(4);
        this.tweens.add({ targets: lbl, y: lbl.y - 6, alpha: 0.6, duration: 800, yoyo: true, repeat: -1 });
        g._label = lbl;
    }

    _spawnBossDoor() {
        // Portcullis in the corridor between R5 (y:61-73) and R6 (y:78)
        // Corridor is at x:49-51, y:73-77 — place door at y:73 (south edge of R5)
        const DOOR_Y   = 73;
        const DOOR_X   = 49; // left edge
        const DOOR_W   = 3;  // tiles wide
        const T        = this.TILE_SIZE;

        if (!this._bossDoor) {
            const g = this.add.graphics().setDepth(1.5);
            this._bossDoorGfx = g;

            const _draw = () => {
                g.clear();
                for (let dx = 0; dx < DOOR_W; dx++) {
                    const wx = (DOOR_X + dx) * T;
                    const wy = DOOR_Y * T;
                    // Dark stone frame
                    g.fillStyle(0x1a1a2e, 0.95); g.fillRect(wx, wy, T, T * 2);
                    // Metal bars — 3 vertical bars per tile
                    for (let b = 0; b < 3; b++) {
                        const bx = wx + 3 + b * 5;
                        g.fillStyle(0x556677, 1); g.fillRect(bx, wy + 1, 3, T * 2 - 2);
                        g.fillStyle(0x88aacc, 0.6); g.fillRect(bx + 1, wy + 2, 1, T * 2 - 4);
                    }
                    // Horizontal crossbar
                    g.fillStyle(0x445566, 1); g.fillRect(wx, wy + T / 2 - 2, T, 4);
                    g.fillStyle(0x667799, 0.5); g.fillRect(wx, wy + T / 2 - 1, T, 2);
                    // Purple glow edges
                    g.lineStyle(2, 0xcc44ff, 0.35); g.strokeRect(wx, wy, T, T * 2);
                }
                // Lock symbol in center
                const cx = (DOOR_X + DOOR_W / 2) * T;
                const cy = DOOR_Y * T + T;
                g.fillStyle(0xcc44ff, 0.90); g.fillCircle(cx, cy, 6);
                g.fillStyle(0x000000, 1);    g.fillCircle(cx, cy, 3.5);
                g.fillStyle(0xcc44ff, 0.80); g.fillRect(cx - 2, cy, 4, 5);
                g.lineStyle(1.5, 0xee88ff, 0.50); g.strokeCircle(cx, cy, 8);
            };
            _draw();
            // Pulse glow
            this.tweens.add({ targets: g, alpha: 0.80, duration: 800, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });

            // Block the tiles
            for (let dx = 0; dx < DOOR_W; dx++) {
                if (this.world[DOOR_X + dx]?.[DOOR_Y] === this.FLOOR) {
                    this.world[DOOR_X + dx][DOOR_Y] = this.WALL;
                }
            }

            this._bossDoor = { gfx: g, tileX: DOOR_X, tileY: DOOR_Y, w: DOOR_W, locked: true };
        }
    }

    _tryUnlockBossDoor() {
        if (!this._bossDoor?.locked) return;
        const keys = this._level3KeysCollected || 0;
        if (keys < 3) {
            // Flash "need X more keys"
            const needed = 3 - keys;
            const cx = (this._bossDoor.tileX + this._bossDoor.w / 2) * this.TILE_SIZE;
            const cy = this._bossDoor.tileY * this.TILE_SIZE - 16;
            this.showStatusText(cx, cy, `🗝 Need ${needed} more key${needed > 1 ? 's' : ''}`, '#cc44ff');
            this.cameras.main.shake(25, 0.003);
            return;
        }
        // UNLOCK — raise portcullis
        this._bossDoor.locked = false;
        this.tweens.killTweensOf(this._bossDoor.gfx);
        this.cameras.main.shake(60, 0.005);
        // Rise animation
        this.tweens.add({
            targets: this._bossDoor.gfx, y: -this.TILE_SIZE * 3,
            alpha: 0, duration: 600, ease: 'Quad.easeIn',
            onComplete: () => { if (this._bossDoor.gfx?.active) this._bossDoor.gfx.destroy(); }
        });
        // Unblock tiles
        for (let dx = 0; dx < this._bossDoor.w; dx++) {
            if (this.world[this._bossDoor.tileX + dx]?.[this._bossDoor.tileY] === this.WALL) {
                this.world[this._bossDoor.tileX + dx][this._bossDoor.tileY] = this.FLOOR;
            }
        }
        this.showStatusText(
            (this._bossDoor.tileX + 1) * this.TILE_SIZE, this._bossDoor.tileY * this.TILE_SIZE - 24,
            '⚡ BOSS DOOR UNLOCKED', '#cc88ff'
        );
        // Unlock the lockedDoorTiles for R5 south door if it was locked
        if (this.lockedDoorTiles) {
            this.lockedDoorTiles = this.lockedDoorTiles.filter(t => t.y !== this._bossDoor.tileY);
        }
    }

    _collectVoidKey(key) {
        if (key.collected) return;
        key.collected = true;
        key.timer?.remove();
        if (key.gfx?.active) {
            // Collect flash
            const flash = this.add.circle(key.gfx.x || key.tileX * this.TILE_SIZE + this.TILE_SIZE / 2,
                key.gfx.y || key.tileY * this.TILE_SIZE + this.TILE_SIZE / 2, 6, 0xcc44ff, 0.90).setDepth(5);
            this.tweens.add({ targets: flash, radius: 28, alpha: 0, duration: 300, onComplete: () => flash.destroy() });
            this.tweens.add({ targets: key.gfx, scaleX: 2, scaleY: 2, alpha: 0, duration: 250,
                onComplete: () => { key.gfx.destroy(); if (key.gfx._label?.active) key.gfx._label.destroy(); }
            });
        }
        if (!this._level3KeysCollected) this._level3KeysCollected = 0;
        this._level3KeysCollected++;
        this.cameras.main.shake(30, 0.003);

        // Update HUD
        if (this.keyCounterText) {
            this.keyCounterText.setText(`🗝 ${this._level3KeysCollected} / 3`);
            this.keyCounterText.setVisible(true);
            // Pulse
            this.tweens.add({ targets: this.keyCounterText, scaleX: 1.3, scaleY: 1.3, duration: 150, yoyo: true, ease: 'Quad.easeOut' });
            if (this._level3KeysCollected >= 3) {
                this.keyCounterText.setColor('#ffdd44');
                this.showStatusText(this.player.x, this.player.y - 40, '🗝 ALL KEYS COLLECTED!', '#ffdd44');
            }
        }
        this.showStatusText(this.player.x, this.player.y - 28, `🗝 Key ${this._level3KeysCollected}/3`, '#cc88ff');
    }

    // ─── LEVEL 3 ENEMY SPAWNING ───────────────────────────────────────────

    spawnLevel3Enemies() {
        // ── Hub layout coords (see WorldGen.generateLevel3) ─────────────────
        // R0: x:43,y:28,w:14,h:10 — Spawn, SAFE — no enemies

        // R1: x:18,y:22,w:20,h:14 — Elemental Crucible (WEST)
        { const e = this.createEnemy(22, 25, 80); e.tutorialRoomIndex = 1; e.fireImmune = true; e._fireMark = this.spawnFireMark(e); }
        { const e = this.createEnemy(34, 25, 80); e.tutorialRoomIndex = 1; e.iceImmune = true; e._iceMark = this.spawnIceMark(e); }
        this.createLightningElemental(22, 33, 1);
        this.createBerserker(29, 29, 1);
        [{ x:28,y:28 },{ x:34,y:34 }].forEach(p => { const e = this.createEnemy(p.x, p.y, 65); e.tutorialRoomIndex = 1; });
        this.createQueenSlimePortal(20, 34, 1, 1);
        this.createRangedEnemy(35, 27, 1);
        this.createRangedEnemy(35, 33, 1);

        // R2: x:44,y:10,w:12,h:10 — Cosmic Tutorial (NORTH)
        [{ x:47,y:12 },{ x:51,y:16 },{ x:47,y:18 }].forEach(p => { const e = this.createEnemy(p.x, p.y, 40); e.tutorialRoomIndex = 2; });

        // R3: x:63,y:23,w:22,h:14 — Ult Gauntlet (EAST)
        const r3abs = [{ x:66,y:26 },{ x:80,y:26 },{ x:66,y:34 },{ x:80,y:34 }];
        for (const p of r3abs) { const e = this.createEnemy(p.x, p.y, 90); e.tutorialRoomIndex = 3; e.isUltAbsorber = true; TutorialManager.prototype._applyUltAbsorberVisual.call(this, e); }
        [{ x:70,y:29 },{ x:75,y:29 },{ x:70,y:33 },{ x:75,y:33 },{ x:73,y:31 }].forEach(p => {
            const e = this.createEnemy(p.x, p.y, 70); e.tutorialRoomIndex = 3;
        });
        this.createVoidSniper(83, 26, 3);
        this.createBerserker(82, 33, 3);
        this.createRangedEnemy(68, 27, 3);
        this.createRangedEnemy(68, 34, 3);
        this.createRangedEnemy(78, 27, 3);

        // R4: x:40,y:44,w:20,h:12 — Sniper Hall
        const r4snipers = [{ x:42,y:46 },{ x:42,y:53 },{ x:50,y:46 },{ x:50,y:53 },{ x:57,y:46 },{ x:57,y:53 }];
        const r4ranged  = [{ x:44,y:49 },{ x:44,y:55 },{ x:51,y:49 },{ x:51,y:55 },{ x:58,y:49 },{ x:58,y:55 }];
        for (const p of r4snipers) this.createVoidSniper(p.x, p.y, 4);
        for (const p of r4ranged)  this.createRangedEnemy(p.x, p.y, 4);

        // R5: x:37,y:61,w:26,h:12 — Queen Slime Chamber
        this.createQueenSlimePortal(42, 66, 5, 2);
        this.createQueenSlimePortal(56, 66, 5, 3);
        { const e = this.createEnemy(43, 63, 75); e.tutorialRoomIndex = 5; e.iceImmune = true; e._iceMark = this.spawnIceMark(e); }
        this.createLightningElemental(56, 63, 5);
        this.createBerserker(50, 69, 5);
        this.createRangedEnemy(40, 65, 5);
        this.createRangedEnemy(58, 65, 5);

        // R6: x:34,y:102,w:32,h:26 — Boss Arena
        [{ x:37,y:81 },{ x:62,y:81 },{ x:37,y:95 },{ x:62,y:95 }].forEach(p => {
            const e = this.createEnemy(p.x, p.y, 80); e.tutorialRoomIndex = 6;
        });
        this.createLightningElemental(50, 79, 6);
        this.createBerserker(37, 88, 6);
        this.createBerserker(62, 88, 6);

        this.spawnVoidSovereignBoss(50, 88);
        this.spawnFinalLevelChest(50, 79, 'cosmic');
        this._spawnLevel3ChestRooms();

        // Key system — spawn boss door and show HUD
        this._level3KeysCollected = 0;
        this._voidKeys = [];
        this._spawnBossDoor();
        if (this.keyCounterText) this.keyCounterText.setVisible(true);
    }

    _spawnLevel3ChestRooms() {
        if (!this.tutorialChests) this.tutorialChests = [];
        for (let i = 0; i < this.rooms.length; i++) {
            const room = this.rooms[i];
            if (!room.isChestRoom) continue;
            let cx = Math.floor(room.x + room.w / 2);
            let cy = Math.floor(room.y + room.h / 2);
            if (this.world[cx]?.[cy] !== this.FLOOR) {
                outer: for (let r = 1; r < Math.max(room.w, room.h); r++) {
                    for (let dx = -r; dx <= r; dx++) for (let dy = -r; dy <= r; dy++) {
                        if (Math.abs(dx) !== r && Math.abs(dy) !== r) continue;
                        const tx = cx+dx, ty = cy+dy;
                        if (this.world[tx]?.[ty] === this.FLOOR) { cx = tx; cy = ty; break outer; }
                    }
                }
            }
            const wx = cx * this.TILE_SIZE + this.TILE_SIZE / 2;
            const wy = cy * this.TILE_SIZE + this.TILE_SIZE / 2;
            const container = this.add.container(wx, wy).setDepth(2);
            const body = this.add.graphics();
            body.fillStyle(0x220044,1); body.fillRect(-10,0,20,7);
            body.fillStyle(0xcc44ff,1); body.fillRect(-3,1,6,5);
            body.lineStyle(1,0x110022,1); body.strokeRect(-10,0,20,7);
            const lid = this.add.graphics();
            lid.fillStyle(0x440066,1); lid.fillRect(-10,-7,20,7);
            lid.lineStyle(1,0x110022,1); lid.strokeRect(-10,-7,20,7);
            const glow = this.add.rectangle(0,0,24,16, 0xcc44ff, 0.20);
            container.add([glow,body,lid]);
            this.tweens.add({ targets:container, y:wy-5, duration:700, yoyo:true, repeat:-1, ease:'Sine.easeInOut' });
            this.tweens.add({ targets:glow, alpha:0.55, duration:500, yoyo:true, repeat:-1 });
            this.tutorialChests.push({ tileX:cx, tileY:cy, roomIndex:i, container, lid, glow, opened:false, isMimic:false, _mimicTriggered:false });
        }
    }

    // ─── NEW ENEMY TYPES ─────────────────────────────────────────────────

    // ─── LEVEL 4 ENEMY SPAWNING ───────────────────────────────────────────
    spawnLevel4Enemies() {
        // R0: spawn — safe, no enemies

        // Mark crumble tile clusters — scattered in R2 (Sinkhole) and R5 (Trap Gauntlet)
        // These are pre-designated tiles that crumble on first step
        this._crumbleZones = new Set([
            // R2: Sinkhole — 8 tiles
            '6,24','7,25','8,24','9,26','6,30','8,31','13,25','13,30',
            // R5: Trap Gauntlet — 12 tiles spread across corridors
            '40,47','42,48','44,50','46,52','48,54','50,53',
            '53,47','55,48','57,50','59,52','61,54','58,53',
            // R1 and R4: a few scattered tiles
            '22,26','30,27','96,26','106,27',
        ]);

        // R1: Entry Crater — rooters + normals
        for (const p of [{x:20,y:25},{x:33,y:25},{x:20,y:32},{x:33,y:32}])
            { const e = this.createEnemy(p.x, p.y, 50); e.tutorialRoomIndex = 1; }
        this.createRooter(22, 28, 1); this.createRooter(31, 28, 1);
        this.createAnchorSlime(27, 29, 1);

        // R2: Sinkhole — slow elementals + mortar behind wall
        for (const p of [{x:6,y:24},{x:15,y:24},{x:6,y:32},{x:15,y:32}])
            { const e = this.createEnemy(p.x, p.y, 60); e.tutorialRoomIndex = 2; }
        this.createMortar(12, 26, 2); // behind internal wall
        this.createHealerTotem(8, 29, 2);
        this.spawnTutorialChest && this.rooms[7] && (()=>{ /* chest handled by room clear */ })();

        // R3: Chain Gang — rooters tethered in pairs + upgraded snipers
        this.createRooter(65, 25, 3); this.createRooter(82, 25, 3);
        this.createRooter(65, 33, 3); this.createRooter(82, 33, 3);
        this.createUpgradedSniper(72, 28, 3); this.createUpgradedSniper(72, 32, 3);
        this.createAnchorSlime(74, 30, 3);

        // R4: Splitter Farm — 3 large splitters, open space
        this.createSplitter(97, 27, 4, 0);
        this.createSplitter(108, 27, 4, 0);
        this.createSplitter(102, 35, 4, 0);
        this.createMortar(113, 31, 4); // far corner mortar

        // R5: Trap Gauntlet — rooters + anchor slimes + healer totem
        this.createRooter(39, 47, 5); this.createRooter(60, 47, 5);
        this.createRooter(39, 54, 5); this.createRooter(60, 54, 5);
        this.createAnchorSlime(50, 51, 5);
        this.createHealerTotem(45, 47, 5);
        for (const p of [{x:43,y:50},{x:57,y:50},{x:50,y:46},{x:50,y:55}])
            { const e = this.createEnemy(p.x, p.y, 50); e.tutorialRoomIndex = 5; }

        // R6: Boss Arena — Fracture Core + guards
        for (const p of [{x:34,y:67},{x:64,y:67},{x:34,y:84},{x:64,y:84}])
            { const e = this.createEnemy(p.x, p.y, 80); e.tutorialRoomIndex = 6; }
        this.createRooter(40, 75, 6); this.createRooter(58, 75, 6);
        this.createMortar(48, 66, 6); // mortar at entrance
        this.spawnFractureCoreStub();

        this._spawnLevel4ChestRooms();
    }

    _spawnLevel4ChestRooms() {
        // Chest off R2 — rooms[7]
        if (this.rooms[7]) {
            const c1 = this.rooms[7];
            const cx = Math.floor(c1.x + c1.w/2), cy = Math.floor(c1.y + c1.h/2);
            this.spawnTutorialChest(7);
        }
        // Chest off R4 — rooms[8]
        if (this.rooms[8]) {
            this.spawnTutorialChest(8);
        }
    }

    spawnFractureCoreStub() {
        // Fracture Core — spawned when player enters R6
        // Actual spawn happens in updateLevel4 on room entry
        this._fractureCoreReady = true;
    }

    updateLevel4(time, delta) {
        const playerRoom = this.getCurrentPlayerRoom();
        if (playerRoom === -1) return;

        for (const enemy of this.enemies) {
            if (!enemy.sprite?.active) continue;
            const mx = enemy.sprite.x, my = enemy.sprite.y;
            if (enemy._rooterMark?.active)  enemy._rooterMark.setPosition(mx, my - 22);
            if (enemy._splitterMark?.active) enemy._splitterMark.setPosition(mx, my - 26);
            if (enemy._healerCross?.active)  enemy._healerCross.setPosition(mx, my - 28);
        }

        // Anchor slow expiry
        if (this._anchorSlowUntil && time > this._anchorSlowUntil) {
            this._anchorSlowUntil = 0;
            if (this.moveCooldown > 200) this.moveCooldown = 200;
            if (this._playerSlowIndTimer) { this._playerSlowIndTimer.remove(); this._playerSlowIndTimer = null; }
        }

        if (playerRoom !== this.currentTutorialRoom) {
            this.currentTutorialRoom = playerRoom;
            if (this.tutorialDoorsLocked[playerRoom]) this.lockTutorialDoors(playerRoom);
            if (playerRoom === 0) {
                this.tutorialRoomCleared[0] = true;
                this.tutorialDoorsLocked[0] = false;
                this.unlockTutorialDoors(0);
            }
            // Boss room — spawn Fracture Core on entry
            if (playerRoom === 6 && this._fractureCoreReady && !this.fractureCoreActive) {
                this.fractureCoreActive = true;
                this.time.delayedCall(1500, () => this._spawnFractureCore());
            }
        }

        if (!this._roomHadEnemies) this._roomHadEnemies = {};
        if (!this.tutorialRoomCleared[playerRoom]) {
            const roomEnemies = this.enemies.filter(e => e.tutorialRoomIndex === playerRoom);
            if (roomEnemies.length > 0) this._roomHadEnemies[playerRoom] = true;
            if (roomEnemies.length === 0 && this._roomHadEnemies[playerRoom]) {
                if (playerRoom === 6) {
                    if (!this.fractureCore?.active) this._level4RoomClear(playerRoom);
                } else {
                    this._level4RoomClear(playerRoom);
                }
            }
        }

        // Chest pickup
        if (this.tutorialChests) {
            for (const chest of this.tutorialChests) {
                if (chest.opened) continue;
                if (this.playerX !== chest.tileX || this.playerY !== chest.tileY) continue;
                if (chest.isFinalChest) {
                    if (!this.fractureCore?.active) this.openFinalLevelChest(chest);
                } else {
                    this.openTutorialChest(chest.roomIndex, chest.container, null);
                }
            }
        }

        if (this.fractureCore?.active) this._updateFractureCore(time, delta);

        if (this._playerRooted && time >= this._playerRootUntil) {
            this._playerRooted = false;
            if (this.player?.active) this.player.clearTint();
        }
    }

    _level4RoomClear(roomIndex) {
        this.tutorialRoomCleared[roomIndex] = true;
        this.unlockTutorialDoors(roomIndex);
        if (roomIndex === 6) {
            this.time.delayedCall(800, () => {
                const chest = (this.tutorialChests||[]).find(c => c.isFinalChest && !c.opened);
                if (chest) this.openFinalLevelChest(chest);
            });
            return;
        }
        this.spawnTutorialChest(roomIndex);
    }

    // ══════════════════════════════════════════════════════════════════════
    // FRACTURE CORE BOSS
    // ══════════════════════════════════════════════════════════════════════
    _spawnFractureCore() {
        const bossRoom = this.rooms[6];
        const cx = Math.floor(bossRoom.x + bossRoom.w / 2);
        const cy = Math.floor(bossRoom.y + bossRoom.h / 2);
        const px = cx * this.TILE_SIZE + this.TILE_SIZE / 2;
        const py = cy * this.TILE_SIZE + this.TILE_SIZE / 2;
        const TS = this.TILE_SIZE;

        this.showStatusText(px, py - 80, '✦ FRACTURE CORE ✦', '#ff6600');
        this.cameras.main.shake(60, 0.006);

        // Core body — crystalline octagon (hidden while dormant)
        const container = this.add.container(px, py).setDepth(3);
        const body = this.add.graphics();
        body.fillStyle(0xff6600, 0.90);
        const R = 28;
        body.beginPath();
        for (let i = 0; i < 8; i++) {
            const a = (i / 8) * Math.PI * 2 - Math.PI/8;
            if (i === 0) body.moveTo(Math.cos(a)*R, Math.sin(a)*R);
            else body.lineTo(Math.cos(a)*R, Math.sin(a)*R);
        }
        body.closePath(); body.fillPath();
        body.fillStyle(0xffaa44, 0.70);
        const Ri = R * 0.55;
        body.beginPath();
        for (let i = 0; i < 8; i++) {
            const a = (i / 8) * Math.PI * 2;
            if (i === 0) body.moveTo(Math.cos(a)*Ri, Math.sin(a)*Ri);
            else body.lineTo(Math.cos(a)*Ri, Math.sin(a)*Ri);
        }
        body.closePath(); body.fillPath();
        body.fillStyle(0xffffff, 0.85); body.fillCircle(0, 0, 8);
        body.lineStyle(2.5, 0xff4400, 0.90);
        body.beginPath();
        for (let i = 0; i < 8; i++) {
            const a = (i / 8) * Math.PI * 2 - Math.PI/8;
            if (i === 0) body.moveTo(Math.cos(a)*R, Math.sin(a)*R);
            else body.lineTo(Math.cos(a)*R, Math.sin(a)*R);
        }
        body.closePath(); body.strokePath();
        container.add(body);
        this.tweens.add({ targets: container, angle: 360, duration: 8000, repeat: -1, ease: 'Linear' });
        container.setVisible(false); // hidden until surfaced

        // Health bar (always visible — tracks core HP even while submerged/hidden)
        const hpBg   = this.add.rectangle(px, py - 50, 80, 8, 0x330000, 0.85).setDepth(4);
        const hpFill = this.add.rectangle(px - 40, py - 50, 80, 8, 0xff6600, 1.0).setDepth(4).setOrigin(0, 0.5);
        const hpText = this.add.text(px, py - 62, 'FRACTURE CORE', {
            fontSize: '10px', fontFamily: 'monospace', color: '#ff8844',
            stroke: '#000', strokeThickness: 2, fontStyle: 'bold'
        }).setOrigin(0.5).setDepth(4);

        // Damage-cap bar (shown only while surfaced)
        const capBg   = this.add.rectangle(px, py - 38, 80, 6, 0x222222, 0.85).setDepth(4);
        const capFill = this.add.rectangle(px - 40, py - 38, 80, 6, 0xffff44, 1.0).setDepth(4).setOrigin(0, 0.5);
        const capText = this.add.text(px, py - 48, 'DAMAGE CAP', {
            fontSize: '8px', fontFamily: 'monospace', color: '#ffff88',
            stroke: '#000', strokeThickness: 2, fontStyle: 'bold'
        }).setOrigin(0.5).setDepth(4);
        capBg.setVisible(false); capFill.setVisible(false); capText.setVisible(false);

        const MAX_HP = 4000;
        this.fractureCore = {
            active: true, container, body, hpBg, hpFill, hpText, capBg, capFill, capText,
            health: MAX_HP, maxHealth: MAX_HP,
            tileX: cx, tileY: cy,
            _phase: 1,
            _isInvulnerable: true, // invulnerable until first surface
            _surfaced: false,
            _rootPhaseActive: false,
        };

        // ── Crack system init ───────────────────────────────────────────────
        this._crackPhase = 0;            // escalation level — increases via instant bursts
        this._crackMaxPhase = 5;         // hard cap
        this._cracks = [];               // array of crack objects
        this._crackSpawnInterval = 12000;
        this._crackSpawnTimer = this.time.now + 14000; // next enemy-spawn burst
        this._crackPulseTimer = this.time.now + 9000; // next pulse wave
        this._nextSurfaceTime = this.time.now + 12000; // first surface window
        this._fractureWeakPoints = [];   // active weak points during surface
        this._totalWidens = 0;           // tracks crack-widen events for global escalation
        this._nextNewCrackTime = this.time.now + 30000; // periodic new-crack timer — independent of widens
        this._crackPulses = [];

        this._initCracks(bossRoom);

        this.spawnFinalLevelChest(cx, cy + 4, null);
    }

    // ── CRACK SYSTEM ─────────────────────────────────────────────────────────
    _initCracks(bossRoom) {
        // Two irregular fissures crossing the arena at oblique angles
        const cx = bossRoom.x + bossRoom.w / 2;
        const cy = bossRoom.y + bossRoom.h / 2;
        const w = bossRoom.w, h = bossRoom.h;

        // Fissure 1 — runs roughly NW-SE, off-center, jagged
        this._addCrack({
            x1: bossRoom.x + w * 0.18, y1: bossRoom.y + h * 0.08,
            x2: bossRoom.x + w * 0.72, y2: bossRoom.y + h * 0.95,
        });
        // Fissure 2 — runs roughly NE-SW, crossing the first at an angle
        this._addCrack({
            x1: bossRoom.x + w * 0.88, y1: bossRoom.y + h * 0.20,
            x2: bossRoom.x + w * 0.22, y2: bossRoom.y + h * 0.85,
        });
    }

    // Generates a jagged polyline of tile-coord points between two endpoints
    _generateCrackPoints(x1, y1, x2, y2) {
        const dx = x2 - x1, dy = y2 - y1;
        const len = Math.hypot(dx, dy);
        const segments = Math.max(4, Math.round(len / 2.2)); // ~1 jag every ~2 tiles
        const perpX = -dy / len, perpY = dx / len;

        const points = [];
        for (let i = 0; i <= segments; i++) {
            const t = i / segments;
            let px = x1 + dx * t, py = y1 + dy * t;
            // Jitter perpendicular to the main direction — less at the very ends
            const edgeFade = Math.sin(t * Math.PI); // 0 at ends, 1 at middle
            const jitter = (Math.random() - 0.5) * 2.6 * (0.3 + edgeFade * 0.7);
            px += perpX * jitter;
            py += perpY * jitter;
            points.push({ x: px, y: py });
        }
        return points;
    }

    _addCrack(opts) {
        const gfx = this.add.graphics().setDepth(2.6);
        const points = this._generateCrackPoints(opts.x1, opts.y1, opts.x2, opts.y2);
        const crack = {
            gfx,
            x1: opts.x1, y1: opts.y1, x2: opts.x2, y2: opts.y2, // tile coords — endpoints (for tendrils/spawn refs)
            points,            // jagged polyline — array of {x,y} tile coords
            width: 0.35,       // tile-widths — how wide the impassable zone is
            baseWidth: 0.35,   // minimum width — shrinking can't go below this
            growth: 0,         // 0-100 — ticks up over time, drives auto-widen
            intensity: 0.4,    // visual pulse intensity, scales with phase/growth
            phase: Math.random() * Math.PI * 2, // animation phase offset
            lastShrinkHit: 0,  // cooldown tracker for projectile shrink
            _debris: null,     // cached debris specks (generated once)
        };
        this._cracks.push(crack);
        return crack;
    }

    // Returns the crack object if (wx,wy) world-pixel position is inside its impassable fissure
    _isInCrack(wx, wy) {
        const TS = this.TILE_SIZE;
        for (const crack of this._cracks) {
            const halfW = crack.width * TS / 2;
            const pts = crack.points;
            for (let i = 0; i < pts.length - 1; i++) {
                const x1 = pts[i].x * TS, y1 = pts[i].y * TS;
                const x2 = pts[i+1].x * TS, y2 = pts[i+1].y * TS;
                const d = Utils.distancePointToSegment(wx, wy, x1, y1, x2, y2);
                if (d < halfW) return crack;
            }
        }
        return null;
    }

    // Closest point on a crack's polyline to a given world position — returns {x, y, segIdx}
    _closestPointOnCrack(crack, wx, wy) {
        const TS = this.TILE_SIZE;
        const pts = crack.points;
        let best = null, bestDist = Infinity;
        for (let i = 0; i < pts.length - 1; i++) {
            const x1 = pts[i].x * TS, y1 = pts[i].y * TS;
            const x2 = pts[i+1].x * TS, y2 = pts[i+1].y * TS;
            const dx = x2 - x1, dy = y2 - y1;
            const lenSq = dx*dx + dy*dy || 1;
            const t = Math.max(0, Math.min(1, ((wx - x1)*dx + (wy - y1)*dy) / lenSq));
            const cx = x1 + t * dx, cy = y1 + t * dy;
            const d = Math.hypot(wx - cx, wy - cy);
            if (d < bestDist) { bestDist = d; best = { x: cx, y: cy, segIdx: i }; }
        }
        return best;
    }

    // Called when an individual crack's growth meter fills — widens that crack
    // and, every few total widen-events, escalates globally (new crack, faster spawns)
    _crackWiden(crack) {
        crack.width = Math.min(2.2, crack.width + 0.35);
        crack.intensity = Math.min(1.0, crack.intensity + 0.15);
        crack.growth = 0;

        const core = this.fractureCore;
        this.cameras.main.shake(50, 0.004);
        this.showStatusText(crack.gfx.x || core.container.x, (crack.points[0].y * this.TILE_SIZE) - 30, '⚡ CRACK WIDENS', '#ff4400');

        // Push player out if they're now standing in the widened crack
        this._pushPlayerOutOfCracks();

        // Global escalation tracking
        this._totalWidens = (this._totalWidens || 0) + 1;
        const WIDEN_THRESHOLD = 3; // every 3 widen-events, escalate globally
        if (this._totalWidens >= WIDEN_THRESHOLD && this._crackPhase < this._crackMaxPhase) {
            this._totalWidens = 0;
            this._crackPhaseUp();
        }
    }

    // Global escalation — adds a new crack and increases spawn/growth rates
    _crackPhaseUp() {
        if (this._crackPhase >= this._crackMaxPhase) return;
        this._crackPhase++;
        const core = this.fractureCore;

        this.cameras.main.shake(70, 0.006);
        this.cameras.main.flash(180, 255, 100, 50);
        this.showStatusText(core.container.x, core.container.y - 90, `⚡⚡ NEW CRACK FORMS (${this._crackPhase}/${this._crackMaxPhase})`, '#ff4400');

        this._spawnNewCrack();

        // Increase enemy spawn rate
        this._crackSpawnInterval = Math.max(5000, 12000 - this._crackPhase * 1000);

        // Push player out of the new crack if it spawned on top of them
        this._pushPlayerOutOfCracks();
    }

    // Picks a geometry variant and adds a new crack to the arena
    _spawnNewCrack() {
        const bossRoom = this.rooms[6];
        const variant = (this._cracks.length + this._crackPhase) % 4;
        const w = bossRoom.w, h = bossRoom.h;
        let opts;
        if (variant === 0) {
            opts = { x1: bossRoom.x + w * 0.08, y1: bossRoom.y + h * 0.35, x2: bossRoom.x + w * 0.95, y2: bossRoom.y + h * 0.62 };
        } else if (variant === 1) {
            opts = { x1: bossRoom.x + w * 0.45, y1: bossRoom.y + h * 0.02, x2: bossRoom.x + w * 0.30, y2: bossRoom.y + h * 0.98 };
        } else if (variant === 2) {
            opts = { x1: bossRoom.x + w * 0.05, y1: bossRoom.y + h * 0.70, x2: bossRoom.x + w * 0.60, y2: bossRoom.y + h * 0.05 };
        } else {
            opts = { x1: bossRoom.x + w * 0.95, y1: bossRoom.y + h * 0.40, x2: bossRoom.x + w * 0.40, y2: bossRoom.y + h * 0.95 };
        }
        const nc = this._addCrack(opts);
        nc.width = 0.5;
        nc.intensity = 0.5;
        return nc;
    }

    _pushPlayerOutOfCracks() {
        const TS = this.TILE_SIZE;
        const crack = this._isInCrack(this.player.x, this.player.y);
        if (!crack) return;

        // Find the nearest segment of the jagged polyline and push away from it
        const pts = crack.points;
        let bestSeg = null, bestDist = Infinity;
        for (let i = 0; i < pts.length - 1; i++) {
            const x1 = pts[i].x * TS, y1 = pts[i].y * TS;
            const x2 = pts[i+1].x * TS, y2 = pts[i+1].y * TS;
            const d = Utils.distancePointToSegment(this.player.x, this.player.y, x1, y1, x2, y2);
            if (d < bestDist) { bestDist = d; bestSeg = { x1, y1, x2, y2 }; }
        }
        if (!bestSeg) return;

        const dx = bestSeg.x2 - bestSeg.x1, dy = bestSeg.y2 - bestSeg.y1;
        const len = Math.hypot(dx, dy) || 1;
        let perpX = -dy / len, perpY = dx / len;
        // Determine which side the player is on relative to this segment
        const toPx = this.player.x - bestSeg.x1, toPy = this.player.y - bestSeg.y1;
        const side = toPx * perpX + toPy * perpY;
        if (side < 0) { perpX = -perpX; perpY = -perpY; }

        const pushDist = (crack.width * TS / 2) + TS * 0.6;
        let newX = this.player.x + perpX * pushDist;
        let newY = this.player.y + perpY * pushDist;

        // Clamp to floor bounds
        const ntx = Math.floor(newX / TS), nty = Math.floor(newY / TS);
        if (this.world[ntx]?.[nty] === this.FLOOR) {
            this.player.x = newX;
            this.player.y = newY;
            this.playerX = ntx;
            this.playerY = nty;
            this.showStatusText(newX, newY - 30, 'PUSHED BACK', '#ff8844');
        }
    }

    _updateCracks(time, delta) {
        if (!this._cracks?.length) return;
        const TS = this.TILE_SIZE;
        const core = this.fractureCore;

        // ── Player collision — block movement into cracks ─────────────────
        const playerCrack = this._isInCrack(this.player.x, this.player.y);
        if (playerCrack && !core._surfaced) {
            this._pushPlayerOutOfCracks();
        }

        // ── Render all cracks as jagged ground fissures ─────────────────────
        for (const crack of this._cracks) {
            if (!crack.gfx?.active) continue;
            crack.phase += delta * 0.003;
            const pulse = 0.6 + 0.4 * Math.sin(crack.phase);
            const pts = crack.points;
            const halfW = Math.max(1.5, crack.width * TS * 0.5);
            const growthPct = crack.growth / 100;
            const glowAlpha = (0.15 + crack.intensity * 0.25) * pulse + growthPct * 0.25;
            const edgeCol = growthPct > 0.7 ? 0xffffff : 0xffaa44;

            crack.gfx.clear();

            // Build two offset polylines (left/right edges of the fissure gap)
            // by offsetting each point perpendicular to its local segment direction.
            const leftPts = [], rightPts = [];
            for (let i = 0; i < pts.length; i++) {
                // Use direction from prev->next for a smoother perpendicular at joints
                const prev = pts[Math.max(0, i - 1)];
                const next = pts[Math.min(pts.length - 1, i + 1)];
                const ddx = (next.x - prev.x) * TS, ddy = (next.y - prev.y) * TS;
                const dlen = Math.hypot(ddx, ddy) || 1;
                const px = -ddy / dlen, py = ddx / dlen;
                const wx = pts[i].x * TS, wy = pts[i].y * TS;
                leftPts.push({ x: wx + px * halfW, y: wy + py * halfW });
                rightPts.push({ x: wx - px * halfW, y: wy - py * halfW });
            }

            // Outer glow — wide soft halo following the fissure
            crack.gfx.lineStyle(halfW * 3.5, 0xff6600, glowAlpha * 0.35);
            crack.gfx.beginPath();
            crack.gfx.moveTo(pts[0].x * TS, pts[0].y * TS);
            for (let i = 1; i < pts.length; i++) crack.gfx.lineTo(pts[i].x * TS, pts[i].y * TS);
            crack.gfx.strokePath();

            // Dark void fill — the actual gap in the ground (filled polygon between edges)
            crack.gfx.fillStyle(0x0a0408, 0.92);
            crack.gfx.beginPath();
            crack.gfx.moveTo(leftPts[0].x, leftPts[0].y);
            for (let i = 1; i < leftPts.length; i++) crack.gfx.lineTo(leftPts[i].x, leftPts[i].y);
            for (let i = rightPts.length - 1; i >= 0; i--) crack.gfx.lineTo(rightPts[i].x, rightPts[i].y);
            crack.gfx.closePath();
            crack.gfx.fillPath();

            // Glowing edge lines — both sides of the fissure, jagged
            crack.gfx.lineStyle(Math.max(1.5, halfW * 0.35), edgeCol, 0.65 + crack.intensity * 0.30);
            crack.gfx.beginPath();
            crack.gfx.moveTo(leftPts[0].x, leftPts[0].y);
            for (let i = 1; i < leftPts.length; i++) crack.gfx.lineTo(leftPts[i].x, leftPts[i].y);
            crack.gfx.strokePath();
            crack.gfx.beginPath();
            crack.gfx.moveTo(rightPts[0].x, rightPts[0].y);
            for (let i = 1; i < rightPts.length; i++) crack.gfx.lineTo(rightPts[i].x, rightPts[i].y);
            crack.gfx.strokePath();

            // Bright pulsing seam down the center
            crack.gfx.lineStyle(Math.max(1, halfW * 0.25), 0xffffff, 0.5 + 0.4 * pulse);
            crack.gfx.beginPath();
            crack.gfx.moveTo(pts[0].x * TS, pts[0].y * TS);
            for (let i = 1; i < pts.length; i++) crack.gfx.lineTo(pts[i].x * TS, pts[i].y * TS);
            crack.gfx.strokePath();

            // Debris specks scattered along the fissure edges (generated once, cached)
            if (!crack._debris) {
                crack._debris = [];
                for (let i = 0; i < pts.length - 1; i++) {
                    const numSpecks = 1 + Math.floor(Math.random() * 2);
                    for (let s = 0; s < numSpecks; s++) {
                        const t = Math.random();
                        const side = Math.random() < 0.5 ? leftPts : rightPts;
                        crack._debris.push({
                            segIdx: i, t,
                            side: side === leftPts ? 1 : -1,
                            offset: (Math.random() - 0.5) * halfW * 0.6,
                            size: 1 + Math.random() * 2,
                        });
                    }
                }
            }
            for (const d of crack._debris) {
                const baseX = pts[d.segIdx].x * TS + (pts[d.segIdx+1].x - pts[d.segIdx].x) * TS * d.t;
                const baseY = pts[d.segIdx].y * TS + (pts[d.segIdx+1].y - pts[d.segIdx].y) * TS * d.t;
                crack.gfx.fillStyle(0x442211, 0.7);
                crack.gfx.fillCircle(baseX + d.offset, baseY + d.offset * 0.6, d.size);
            }
        }

        // ── Growth meter — each crack grows toward auto-widen, faster at higher phase ──
        if (!core._surfaced) {
            const growthRate = (0.012 + this._crackPhase * 0.006) * delta; // points per ms, scales with phase
            for (const crack of this._cracks) {
                crack.growth = Math.min(100, crack.growth + growthRate);
                if (crack.growth >= 100) {
                    this._crackWiden(crack);
                }
            }
        }

        // ── Periodic new-crack timer — independent of widen events, the arena ──
        // ── inevitably gets more cracks over time regardless of player skill ──
        if (!core._surfaced && time >= this._nextNewCrackTime) {
            if (this._crackPhase < this._crackMaxPhase) {
                this._crackPhase++;
                this.cameras.main.shake(70, 0.006);
                this.cameras.main.flash(180, 255, 100, 50);
                this.showStatusText(core.container.x, core.container.y - 90, `⚡⚡ NEW CRACK FORMS (${this._crackPhase}/${this._crackMaxPhase})`, '#ff4400');
                this._spawnNewCrack();
                this._crackSpawnInterval = Math.max(5000, 12000 - this._crackPhase * 1000);
                this._pushPlayerOutOfCracks();
            }
            // Next new crack a bit sooner each time, with a sane floor
            this._nextNewCrackTime = time + Math.max(18000, 30000 - this._crackPhase * 2000);
        }

        // ── Surface cycle ────────────────────────────────────────────────────
        if (!core._surfaced && time >= this._nextSurfaceTime) {
            this._fractureCoreSurface();
        }
        if (core._surfaced) {
            this._updateSurfaceWindow(time, delta);
        }

        // ── Pulse wave timer ─────────────────────────────────────────────────
        if (!core._surfaced && time >= this._crackPulseTimer) {
            this._crackPulseWave();
            this._crackPulseTimer = time + Math.max(4500, 9000 - this._crackPhase * 700);
        }

        // ── Spawn burst timer ────────────────────────────────────────────────
        if (!core._surfaced && time >= this._crackSpawnTimer) {
            this._crackSpawnBurst();
            this._crackSpawnTimer = time + (this._crackSpawnInterval || 12000);
        }
    }

    // ── PULSE WAVE — every active crack fires a pulse toward the player ──────
    _crackPulseWave() {
        const TS = this.TILE_SIZE;
        this.showStatusText(this.player.x, this.player.y - 40, '◢ CRACK PULSE', '#ff6600');
        for (const crack of this._cracks) {
            if (!crack.gfx?.active) continue;
            // Closest point on crack line to player
            const closest = this._closestPointOnCrack(crack, this.player.x, this.player.y);
            const originX = closest.x, originY = closest.y;

            const pdx = this.player.x - originX, pdy = this.player.y - originY;
            const plen = Math.hypot(pdx, pdy) || 1;
            const dirX = pdx / plen, dirY = pdy / plen;

            // Pulse projectile — drawn as a curved wave/arc facing its travel direction,
            // not a ball. The arc bows forward (convex toward dirX/dirY).
            const travelAngle = Math.atan2(dirY, dirX);
            const g = this.add.graphics().setDepth(3.4);
            g.x = originX; g.y = originY;
            g.rotation = travelAngle;
            this._drawCrackPulseWave(g);

            const SPEED = 110; // slower moving — was 200, gives more time to react/dodge
            const vx = dirX * SPEED, vy = dirY * SPEED;

            const pulseObj = { gfx: g, crack, vx, vy, speed: SPEED, dist: 0, broken: false };
            if (!this._crackPulses) this._crackPulses = [];
            this._crackPulses.push(pulseObj);
        }
        this._tickCrackPulses();
    }

    // Draws the arc/wave shape for a crack pulse, in the graphics object's own local
    // space (already rotated to face travel direction — local +X is "forward").
    _drawCrackPulseWave(g) {
        g.clear();
        const R = 30;           // arc radius — much wider wave-front (was 16)
        const SPAN = 2.7;       // arc span in radians (~155°) — broad, sweeping crescent (was 1.9 / ~109°)

        // Outer glow pass — wider, faint
        g.lineStyle(7, 0xffaa44, 0.22);
        g.beginPath();
        g.arc(0, 0, R + 4, -SPAN / 2, SPAN / 2, false);
        g.strokePath();

        // Main wave stroke — thick, bright, leading edge of the crack's energy
        g.lineStyle(4, 0xff6600, 0.92);
        g.beginPath();
        g.arc(0, 0, R, -SPAN / 2, SPAN / 2, false);
        g.strokePath();

        // Inner highlight — thin bright core line
        g.lineStyle(2, 0xffe8cc, 0.85);
        g.beginPath();
        g.arc(0, 0, R - 3.5, -SPAN / 2.6, SPAN / 2.6, false);
        g.strokePath();
    }

    _tickCrackPulses() {
        if (!this._crackPulses?.length) return;
        const TS = this.TILE_SIZE;
        const tick = () => {
            if (!this.fractureCore?.active || !this.player?.active) {
                for (const p of this._crackPulses) { if (p.gfx?.active) p.gfx.destroy(); }
                this._crackPulses = [];
                return;
            }
            for (let i = this._crackPulses.length - 1; i >= 0; i--) {
                const p = this._crackPulses[i];
                if (!p.gfx?.active || p.broken) {
                    if (p.gfx?.active) p.gfx.destroy();
                    this._crackPulses.splice(i, 1); continue;
                }
                p.gfx.x += p.vx * 0.016;
                p.gfx.y += p.vy * 0.016;
                p.dist += p.speed * 0.016;

                // Hit player
                if (Math.hypot(p.gfx.x - this.player.x, p.gfx.y - this.player.y) < TS * 0.6) {
                    this.takeDamage(6 * this.damageScaling);
                    p.gfx.destroy();
                    this._crackPulses.splice(i, 1);
                    continue;
                }
                // Expire
                if (p.dist > 14 * TS) {
                    p.gfx.destroy();
                    this._crackPulses.splice(i, 1);
                }
            }
            if (this._crackPulses.length > 0) {
                this.time.delayedCall(16, tick);
            }
        };
        tick();
    }

    // Break a pulse projectile if player attacks near it — called from CombatSystem on hit
    _tryBreakCrackPulse(wx, wy, radius) {
        if (!this._crackPulses?.length) return false;
        let broke = false;
        for (const p of this._crackPulses) {
            if (p.broken || !p.gfx?.active) continue;
            if (Math.hypot(p.gfx.x - wx, p.gfx.y - wy) < radius) {
                p.broken = true;
                // Breaking reduces that crack's intensity slightly
                p.crack.intensity = Math.max(0.2, p.crack.intensity - 0.08);
                const burst = this.add.graphics().setDepth(4);
                burst.x = p.gfx.x; burst.y = p.gfx.y;
                burst.fillStyle(0xffffff, 0.85); burst.fillCircle(0, 0, 10);
                this.tweens.add({ targets: burst, scaleX: 2, scaleY: 2, alpha: 0, duration: 200, onComplete: () => burst.destroy() });
                broke = true;
            }
        }
        return broke;
    }

    // ── ENEMY SPAWN BURST FROM CRACKS ─────────────────────────────────────────
    _crackSpawnBurst() {
        const TS = this.TILE_SIZE;
        this.showStatusText(this.fractureCore.container.x, this.fractureCore.container.y - 100, '◉ CRACKS OPEN', '#ff4400');
        this.cameras.main.shake(40, 0.003);

        // Spawn count scales with crack phase
        // Spawn count scales with crack phase — gentler curve
        const count = 1 + Math.floor(this._crackPhase * 0.6);
        const types = ['rooter', 'mortar', 'anchor', 'healer', 'splitter', 'normal'];

        for (let i = 0; i < count; i++) {
            // Pick a random crack and spawn point along its jagged polyline
            const crack = this._cracks[Math.floor(Math.random() * this._cracks.length)];
            if (!crack?.points?.length) continue;
            const pt = crack.points[Math.floor(Math.random() * crack.points.length)];
            const tx = Math.round(pt.x);
            const ty = Math.round(pt.y);
            if (this.world[tx]?.[ty] !== this.FLOOR) continue;
            if (this.getEnemyAt && this.getEnemyAt(tx, ty)) continue;

            // Emergence visual
            const burst = this.add.graphics().setDepth(3.5);
            burst.x = tx * TS + TS/2; burst.y = ty * TS + TS/2;
            burst.fillStyle(0xff6600, 0.70); burst.fillCircle(0, 0, 4);
            burst.lineStyle(2, 0xffaa44, 0.80); burst.strokeCircle(0, 0, 4);
            this.tweens.add({ targets: burst, scaleX: 6, scaleY: 6, alpha: 0, duration: 350, onComplete: () => burst.destroy() });

            const type = types[Math.floor(Math.random() * types.length)];
            this.time.delayedCall(200, () => {
                let e;
                switch (type) {
                    case 'rooter':   e = this.createRooter?.(tx, ty, 6); break;
                    case 'mortar':   e = this.createMortar?.(tx, ty, 6); break;
                    case 'anchor':   e = this.createAnchorSlime?.(tx, ty, 6); break;
                    case 'healer':   e = this.createHealerTotem?.(tx, ty, 6); break;
                    case 'splitter': e = this.createSplitter?.(tx, ty, 6, 0); break;
                    default:         e = this.createEnemy(tx, ty, 40); e.tutorialRoomIndex = 6; break;
                }
            });
        }
    }

    // Midpoint of a crack's jagged polyline (world pixel coords) — kept as a general helper
    _crackMidpoint(crack) {
        const TS = this.TILE_SIZE;
        const pts = crack.points;
        const mid = pts[Math.floor(pts.length / 2)];
        return { x: mid.x * TS, y: mid.y * TS };
    }

    // Called when a player projectile hits a crack — shrinks it (cooldown-gated per crack)
    _shrinkCrack(crack, time) {
        if (time - (crack.lastShrinkHit || 0) < 400) return false; // cooldown
        crack.lastShrinkHit = time;

        // Reduce growth meter and width
        crack.growth = Math.max(0, crack.growth - 18);
        crack.width = Math.max(crack.baseWidth, crack.width - 0.05);
        crack.intensity = Math.max(0.2, crack.intensity - 0.02);

        // Visual flash — follow the jagged polyline, cool blue/white to contrast the hot crack glow
        const TS = this.TILE_SIZE;
        const flash = this.add.graphics().setDepth(3);
        const pts = crack.points;
        flash.lineStyle(Math.max(2, crack.width * TS * 0.8), 0x88ccff, 0.55);
        flash.beginPath();
        flash.moveTo(pts[0].x * TS, pts[0].y * TS);
        for (let i = 1; i < pts.length; i++) flash.lineTo(pts[i].x * TS, pts[i].y * TS);
        flash.strokePath();
        this.tweens.add({ targets: flash, alpha: 0, duration: 200, onComplete: () => flash.destroy() });

        return true;
    }

    // ── SURFACE WINDOW — Fracture Core erupts, ordered weak point sequence ────
    // Unmissable screen-anchored banner for rhythm session start/end — distinct from
    // the small floating showStatusText, which is easy to lose in on-screen chaos.
    _showRhythmSessionBanner(text, color = '#ffff44', subtext = null) {
        const W = this.scale.width, H = this.scale.height;
        const bannerY = H * 0.22;

        const bg = this.add.rectangle(W / 2, bannerY, W * 0.8, subtext ? 64 : 46, 0x000000, 0.55)
            .setScrollFactor(0).setDepth(520).setAlpha(0);
        const label = this.add.text(W / 2, bannerY - (subtext ? 10 : 0), text, {
            fontSize: '26px', fontFamily: 'monospace', color, stroke: '#000000',
            strokeThickness: 5, fontStyle: 'bold'
        }).setOrigin(0.5).setScrollFactor(0).setDepth(521).setAlpha(0);
        const sub = subtext ? this.add.text(W / 2, bannerY + 20, subtext, {
            fontSize: '13px', fontFamily: 'monospace', color: '#cccccc', stroke: '#000000',
            strokeThickness: 3
        }).setOrigin(0.5).setScrollFactor(0).setDepth(521).setAlpha(0) : null;

        const targets = sub ? [bg, label, sub] : [bg, label];
        this.tweens.add({
            targets, alpha: 1, duration: 180, ease: 'Power1',
            onComplete: () => {
                this.tweens.add({
                    targets, alpha: 0, duration: 350, delay: 900, ease: 'Power1',
                    onComplete: () => targets.forEach(t => t.destroy())
                });
            }
        });
        // Small punch-in scale on the label for extra emphasis
        label.setScale(0.7);
        this.tweens.add({ targets: label, scale: 1, duration: 220, ease: 'Back.easeOut' });
    }

    _fractureCoreSurface() {
        const core = this.fractureCore;
        if (!core?.active) return;
        const TS = this.TILE_SIZE;
        const phase = this._crackPhase;

        core._surfaced = true;
        core._isInvulnerable = false;
        core.container.setVisible(true);
        core.capBg.setVisible(true); core.capFill.setVisible(true); core.capText.setVisible(true);

        core._surfaceEndTime = this.time.now + 10000;

        this.showStatusText(core.container.x, core.container.y - 100, '✦ CORE SURFACES ✦', '#ffff44');
        this._showRhythmSessionBanner('◆ WEAK POINT SEQUENCE ◆', '#ffff44', 'Click each point as the ring converges');
        this.cameras.main.shake(80, 0.007);
        this.cameras.main.flash(200, 255, 200, 100);
        this.tweens.add({ targets: core.container, scaleX: 1.3, scaleY: 1.3, duration: 200, yoyo: true, ease: 'Back.easeOut' });

        // Ring duration scales with phase AND how many cracks/weak points are active
        // this window — more cracks means each individual ring converges faster, so
        // more simultaneous threats genuinely means less time per point, not just a
        // longer sequence at the same pace.
        const crackCount = this._cracks.length;
        const BASE_RING_DURATION = Math.max(1100, 2200 - phase * 100 - crackCount * 120);

        // Build weak points from each crack, shuffled into random order
        const candidates = [];
        for (let i = 0; i < this._cracks.length; i++) {
            const crack = this._cracks[i];
            const pts = crack.points;
            const idx = Math.floor(pts.length * (0.2 + Math.random() * 0.6));
            const pt = pts[Math.min(pts.length - 1, idx)];
            const wx = pt.x * TS, wy = pt.y * TS;

            // Armored (double-ring) rare at low phase, more common at high phase, but always rare
            const armorChance = 0.15 + phase * 0.06;
            const armored = Math.random() < armorChance;

            candidates.push({
                x: wx, y: wy, armored,
                resolved: false, complete: false, grade: null,
                innerR: 20, outerStart: 64, ringDuration: BASE_RING_DURATION,
                ringElapsed: 0, ringR: 64,
                // Second ring for armored — converges concurrently alongside ring 1, but each
                // ring needs its OWN click. First click always judges ring 1; once ring 1 is
                // resolved (hit or auto-miss on convergence) it disappears and the next click
                // judges ring 2, which has kept shrinking independently in the background.
                ring1Done: false, grade1: null, grade2: null,
                ring2R: armored ? 104 : null, ring2Elapsed: 0,
                outerStart2: 104,
                innerGfx: null, ringGfx: null, ring2Gfx: null,
                active: false, // only the current point is active
            });
        }

        // Shuffle order randomly
        for (let i = candidates.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [candidates[i], candidates[j]] = [candidates[j], candidates[i]];
        }

        // Create graphics for all points
        for (const wp of candidates) {
            wp.innerGfx = this.add.graphics().setDepth(4.5);
            wp.ringGfx  = this.add.graphics().setDepth(4.6);
            wp.innerGfx.x = wp.x; wp.innerGfx.y = wp.y;
            wp.ringGfx.x  = wp.x; wp.ringGfx.y  = wp.y;
            if (wp.armored) {
                wp.ring2Gfx = this.add.graphics().setDepth(4.6);
                wp.ring2Gfx.x = wp.x; wp.ring2Gfx.y = wp.y;
            }
        }

        this._fractureWeakPoints = candidates;
        this._wpSequenceIdx = 0; // current active point index
        this._wpTotalMisses = 0; // total misses this surface window — 3 aborts it early
        this._activateWeakPoint(0);
        this._updateWeakPointBar();
    }

    // Activates (brightens) the weak point at index idx, dims all others
    _activateWeakPoint(idx) {
        if (!this._fractureWeakPoints?.length) return;
        this._wpSequenceIdx = idx;
        for (let i = 0; i < this._fractureWeakPoints.length; i++) {
            const wp = this._fractureWeakPoints[i];
            wp.active = (i === idx) && !wp.resolved;
            // Reset ring position when newly activated
            if (wp.active) {
                wp.ringElapsed = 0;
                wp.ringR = wp.outerStart;
                if (wp.armored) {
                    wp.ring1Done = false;
                    wp.grade1 = null; wp.grade2 = null;
                    wp.ring2Elapsed = 0; // ring 2 still shrinks concurrently with ring 1
                    wp.ring2R = wp.outerStart2;
                }
            }
            this._drawWeakPointInner(wp);
        }
    }

    // Fixed inner target — dim if not active, colored based on state
    _drawWeakPointInner(wp) {
        const g = wp.innerGfx;
        if (!g?.active) return;
        g.clear();
        const dimAlpha = wp.active ? 1.0 : 0.25;
        if (wp.complete && wp.grade === 'MISS') {
            // Resolved as a miss — dead, red-gray, no longer interactive
            g.fillStyle(0x552222, 0.85); g.fillCircle(0, 0, wp.innerR);
            g.lineStyle(2, 0xff4444, 0.85); g.strokeCircle(0, 0, wp.innerR + 2);
        } else if (wp.complete) {
            g.fillStyle(0x44ff88, 0.85); g.fillCircle(0, 0, wp.innerR);
            g.lineStyle(2, 0xffffff, 0.95); g.strokeCircle(0, 0, wp.innerR + 2);
        } else if (wp.armored) {
            g.fillStyle(0x888888, dimAlpha); g.fillCircle(0, 0, wp.innerR);
            g.lineStyle(2, 0xcccccc, dimAlpha); g.strokeCircle(0, 0, wp.innerR + 2);
            g.fillStyle(0xffff00, dimAlpha * 0.55); g.fillCircle(0, 0, wp.innerR * 0.5);
        } else {
            g.fillStyle(0xffff00, dimAlpha); g.fillCircle(0, 0, wp.innerR);
            g.lineStyle(2, 0xffffff, dimAlpha * 0.90); g.strokeCircle(0, 0, wp.innerR + 2);
        }
    }

    // Shrinking outer ring — only drawn for active non-complete points
    _drawWeakPointRing(wp) {
        const g = wp.ringGfx;
        if (!g?.active) return;
        g.clear();
        if (wp.complete || !wp.active) return;
        const diff = Math.abs(wp.ringR - wp.innerR);
        const grade = this._gradeForDiff(diff);
        let col = 0xffffff, alpha = 0.75;
        if (grade === 'PERFECT')        { col = 0x44ff88; alpha = 1.0; }
        else if (grade === 'EXCELLENT') { col = 0xaaff44; alpha = 0.90; }
        else if (grade === 'GOOD')      { col = 0xffdd44; alpha = 0.80; }
        g.lineStyle(2.5, col, alpha);
        g.strokeCircle(0, 0, Math.max(wp.innerR, wp.ringR));
    }

    // Second outer ring for armored points
    _drawWeakPointRing2(wp) {
        const g = wp.ring2Gfx;
        if (!g?.active) return;
        g.clear();
        if (wp.complete || !wp.active || !wp.armored) return;
        const diff2 = Math.abs(wp.ring2R - wp.innerR);
        const grade2 = this._gradeForDiff(diff2);
        let col = 0xff8844, alpha = 0.65; // orange tint to distinguish
        if (grade2 === 'PERFECT')        { col = 0x44ff88; alpha = 1.0; }
        else if (grade2 === 'EXCELLENT') { col = 0xaaff44; alpha = 0.85; }
        else if (grade2 === 'GOOD')      { col = 0xffdd44; alpha = 0.75; }
        g.lineStyle(2.5, col, alpha);
        g.strokeCircle(0, 0, Math.max(wp.innerR, wp.ring2R));
    }

    _updateSurfaceWindow(time, delta) {
        const core = this.fractureCore;
        if (!core?._surfaced) return;
        const px = core.container.x, py = core.container.y;

        // Update HP bar position
        core.hpFill.width = 80 * Math.max(0, core.health / core.maxHealth);
        core.hpBg.x = px; core.hpBg.y = py - 50;
        core.hpFill.x = px - 40; core.hpFill.y = py - 50;
        core.hpText.x = px; core.hpText.y = py - 62;
        core.capBg.x = px; core.capBg.y = py - 38;
        core.capFill.x = px - 40; core.capFill.y = py - 38;
        core.capText.x = px; core.capText.y = py - 48;

        // Tick the ring(s) for the current active weak point — one cycle only per ring.
        // Normal points: single ring, auto-MISS on convergence if not clicked.
        // Armored points: ring 1 and ring 2 both shrink concurrently from the start.
        // Ring 1 stops ticking once judged (click or timeout); ring 2 keeps going
        // independently and is judged by the next click (or its own timeout).
        const wp = this._fractureWeakPoints?.[this._wpSequenceIdx];
        if (wp && !wp.resolved && wp.active) {
            if (!wp.armored) {
                wp.ringElapsed += (delta || 16);
                const t = Math.min(1, wp.ringElapsed / wp.ringDuration);
                wp.ringR = wp.outerStart - (wp.outerStart - wp.innerR) * t;
                this._drawWeakPointRing(wp);
                if (t >= 1) {
                    this._resolveWeakPoint(wp, this._wpSequenceIdx, 'MISS');
                }
            } else {
                if (!wp.ring1Done) {
                    wp.ringElapsed += (delta || 16);
                    const t = Math.min(1, wp.ringElapsed / wp.ringDuration);
                    wp.ringR = wp.outerStart - (wp.outerStart - wp.innerR) * t;
                    this._drawWeakPointRing(wp);
                    if (t >= 1) {
                        // Ring 1 timed out without a click — auto-MISS for ring 1, ring 2 carries on
                        wp.grade1 = 'MISS';
                        wp.ring1Done = true;
                        if (wp.ringGfx?.active) wp.ringGfx.clear();
                        this.showStatusText(wp.x, wp.y - 28, 'MISSED', this._gradeColor('MISS'));
                    }
                }
                // Ring 2 always ticks concurrently, independent of ring 1's state
                wp.ring2Elapsed = (wp.ring2Elapsed || 0) + (delta || 16);
                const t2 = Math.min(1, wp.ring2Elapsed / wp.ringDuration);
                wp.ring2R = wp.outerStart2 - (wp.outerStart2 - wp.innerR) * t2;
                this._drawWeakPointRing2(wp);
                if (t2 >= 1 && wp.grade2 === null) {
                    // Ring 2 timed out without a click — auto-MISS for ring 2, point resolves now
                    wp.grade2 = 'MISS';
                    const finalGrade = wp.ring1Done ? this._worseGrade(wp.grade1, wp.grade2) : 'MISS';
                    this._resolveWeakPoint(wp, this._wpSequenceIdx, finalGrade);
                }
            }
        }

        this._updateWeakPointBar();

        if (time >= core._surfaceEndTime) {
            const total = this._fractureWeakPoints.length;
            const hitCount = this._fractureWeakPoints.filter(w => w.grade && w.grade !== 'MISS').length;
            const thresholdMet = total > 0 && (hitCount / total) >= 0.6;
            this._fractureCoreSubmerge(thresholdMet);
        }
    }

    // Grade → damage weight, used both for the live bar and final damage calc
    _gradeWeight(grade) {
        if (grade === 'PERFECT')   return 1.0;
        if (grade === 'EXCELLENT') return 0.75;
        if (grade === 'GOOD')      return 0.40;
        return 0; // MISS or unresolved
    }

    _updateWeakPointBar() {
        const core = this.fractureCore;
        if (!core?.capFill) return;
        const points = this._fractureWeakPoints || [];
        const total = points.length || 1;
        const resolved = points.filter(wp => wp.resolved).length;
        const weightSum = points.reduce((sum, wp) => sum + this._gradeWeight(wp.grade), 0);
        const pct = weightSum / total; // current damage % if window ended right now
        core.capFill.width = 80 * pct;
        core.capFill.setFillStyle(pct >= 0.6 ? 0x44ff88 : 0xffff44);
        core.capText.setText(`DAMAGE ${Math.round(pct * 100)}% (${resolved}/${total})`);
    }

    _fractureCoreSubmerge(thresholdMet, failReason = 'Not enough points hit') {
        const core = this.fractureCore;
        if (!core?.active || !core._surfaced) return; // already submerged this tick — avoid double-fire

        core._surfaced = false;
        core._isInvulnerable = true;
        core.container.setVisible(false);
        core.capBg.setVisible(false); core.capFill.setVisible(false); core.capText.setVisible(false);

        const resolvedPoints = this._fractureWeakPoints; // snapshot before clearing below

        for (const wp of resolvedPoints) {
            if (wp.innerGfx?.active) { this.tweens.killTweensOf(wp.innerGfx); wp.innerGfx.destroy(); }
            if (wp.ringGfx?.active)  { this.tweens.killTweensOf(wp.ringGfx);  wp.ringGfx.destroy(); }
            if (wp.ring2Gfx?.active) { this.tweens.killTweensOf(wp.ring2Gfx); wp.ring2Gfx.destroy(); }
        }
        this._fractureWeakPoints = [];

        if (thresholdMet) {
            const MAX_DAMAGE = 500 + this._crackPhase * 60; // ceiling, same scaling as before
            const total = resolvedPoints.length || 1;
            const weightSum = resolvedPoints.reduce((sum, wp) => sum + this._gradeWeight(wp.grade), 0);
            const gradePct = weightSum / total; // average grade quality across ALL points, misses count as 0
            const damage = Math.round(MAX_DAMAGE * gradePct);

            core.health -= damage;
            core.hpFill.width = 80 * Math.max(0, core.health / core.maxHealth);
            this.showDamageNumber(core.container.x, core.container.y - 40, damage, '#ff8844');
            this.showStatusText(core.container.x, core.container.y - 80, `✦ CORE STAGGERED! (${Math.round(gradePct * 100)}%)`, '#44ff88');
            this._showRhythmSessionBanner('◆ SEQUENCE COMPLETE ◆', '#44ff88', `${Math.round(gradePct * 100)}% damage dealt`);
            this.cameras.main.shake(80, 0.008);
            this._nextSurfaceTime = this.time.now + 6000;
            if (core.health <= 0) { this._fractureCoreKill(); return; }
        } else {
            this.showStatusText(core.container.x, core.container.y - 80, 'CORE RETREATS — NO DAMAGE', '#ff8844');
            this._showRhythmSessionBanner('◆ SEQUENCE FAILED ◆', '#ff8844', `${failReason} — no damage dealt`);
            this._nextSurfaceTime = this.time.now + 10000;
        }
        this.cameras.main.shake(60, 0.005);
    }

    // True if the given world coords land within the CURRENT target ring's click radius.
    // For armored points this is ring 1 until it's resolved, then ring 2.
    // Used both to decide whether a click should be intercepted at all (GameScene's
    // pointerdown handler) and inside the actual resolution logic below.
    _isClickOnActiveWeakPoint(wx, wy) {
        const core = this.fractureCore;
        if (!core?._surfaced || !this._fractureWeakPoints?.length) return false;
        const idx = this._wpSequenceIdx;
        if (idx >= this._fractureWeakPoints.length) return false;
        const wp = this._fractureWeakPoints[idx];
        if (!wp || wp.resolved || !wp.active) return false;

        const targetingRing2 = wp.armored && wp.ring1Done;
        const targetR = targetingRing2 ? wp.outerStart2 : wp.outerStart;
        const clickDist = Math.hypot(wp.x - wx, wp.y - wy);
        const CLICK_RADIUS = targetR + 12;
        return clickDist <= CLICK_RADIUS;
    }

    // Main click handler — routes to the currently active weak point only.
    // Armored points need two separate clicks: the first always judges ring 1
    // (which then disappears), the second judges ring 2 (which kept shrinking
    // independently the whole time). Final grade is the worse of the two.
    _tryHitCurrentWeakPoint(wx, wy) {
        const core = this.fractureCore;
        if (!core?._surfaced || !this._fractureWeakPoints?.length) return;

        const idx = this._wpSequenceIdx;
        if (idx >= this._fractureWeakPoints.length) return;
        const wp = this._fractureWeakPoints[idx];
        if (!wp || wp.resolved || !wp.active) return;

        if (!this._isClickOnActiveWeakPoint(wx, wy)) return; // missed the point entirely, no punishment

        if (!wp.armored) {
            // Normal point — single ring, single click
            const diff = Math.abs(wp.ringR - wp.innerR);
            const grade = this._gradeForDiff(diff);
            this._resolveWeakPoint(wp, idx, grade);
            return;
        }

        if (!wp.ring1Done) {
            // This click judges ring 1
            const diff1 = Math.abs(wp.ringR - wp.innerR);
            wp.grade1 = this._gradeForDiff(diff1);
            wp.ring1Done = true;
            if (wp.ringGfx?.active) wp.ringGfx.clear(); // ring 1 disappears once judged
            this.showStatusText(wp.x, wp.y - 28, wp.grade1, this._gradeColor(wp.grade1));
            // Point doesn't resolve yet — ring 2 still converging, next click judges it
        } else {
            // This click judges ring 2 — finalize the point with the worse of both grades
            const diff2 = Math.abs(wp.ring2R - wp.innerR);
            wp.grade2 = this._gradeForDiff(diff2);
            const finalGrade = this._worseGrade(wp.grade1, wp.grade2);
            this._resolveWeakPoint(wp, idx, finalGrade);
        }
    }

    // Returns a hex color string for a grade — shared by inline status text calls
    _gradeColor(grade) {
        const COLORS = { PERFECT: '#44ff88', EXCELLENT: '#aaff44', GOOD: '#ffdd44', MISS: '#ff4444' };
        return COLORS[grade] || '#ffffff';
    }

    // Returns whichever of two grades is worse (MISS worst, PERFECT best)
    _worseGrade(g1, g2) {
        const RANK = { PERFECT: 3, EXCELLENT: 2, GOOD: 1, MISS: 0 };
        return RANK[g1] <= RANK[g2] ? g1 : g2;
    }

    // Converts a ring-tolerance diff into a letter grade
    _gradeForDiff(worstDiff) {
        if (worstDiff <= 8)      return 'PERFECT';
        if (worstDiff <= 18)     return 'EXCELLENT';
        if (worstDiff <= 30)     return 'GOOD';
        return 'MISS';
    }

    // Resolves the current weak point with a final grade (from a click or from timeout),
    // applies visuals/punishment/total-miss tracking, and advances the sequence.
    // One cycle only — no retries, whatever grade lands here is final for this point.
    _resolveWeakPoint(wp, idx, grade) {
        if (wp.resolved) return;
        wp.resolved = true;

        const GRADE_COLORS = {
            PERFECT: '#44ff88', EXCELLENT: '#aaff44', GOOD: '#ffdd44', MISS: '#ff4444'
        };
        const gradeCol = GRADE_COLORS[grade];

        if (grade === 'MISS') {
            const miss = this.add.graphics().setDepth(4.6);
            miss.x = wp.x; miss.y = wp.y;
            miss.lineStyle(2.5, 0xff4444, 0.90); miss.strokeCircle(0, 0, wp.ringR);
            this.tweens.add({ targets: miss, alpha: 0, duration: 250, onComplete: () => miss.destroy() });
            this.showStatusText(wp.x, wp.y - 28, 'MISSED', gradeCol);
            this.takeDamage(8 * (this.damageScaling || 1));

            this._wpTotalMisses = (this._wpTotalMisses || 0) + 1;
            wp.grade = 'MISS';
        } else {
            this.showStatusText(wp.x, wp.y - 28, grade, gradeCol);

            const flashCol = grade === 'PERFECT' ? 0xffffff : grade === 'EXCELLENT' ? 0xaaff44 : 0xffdd44;
            const flash = this.add.graphics().setDepth(4.7);
            flash.x = wp.x; flash.y = wp.y;
            flash.fillStyle(flashCol, 0.85); flash.fillCircle(0, 0, 16);
            this.tweens.add({ targets: flash, scaleX: 2.0, scaleY: 2.0, alpha: 0, duration: 180, onComplete: () => flash.destroy() });

            wp.grade = grade;
        }

        // Point is done (hit or missed) — lock it visually and clear rings
        wp.complete = true;
        wp.active = false;
        if (wp.ringGfx?.active)  wp.ringGfx.clear();
        if (wp.ring2Gfx?.active) wp.ring2Gfx.clear();
        this._drawWeakPointInner(wp);
        this._updateWeakPointBar();

        // Premature sink-back: 3 TOTAL misses across the session aborts the whole window
        if ((this._wpTotalMisses || 0) >= 3) {
            this._fractureCoreSurfaceAbort();
            return;
        }

        // All points resolved — end the surface window immediately instead of
        // waiting out the rest of the timer
        const allResolved = this._fractureWeakPoints.every(w => w.resolved);
        if (allResolved) {
            const total = this._fractureWeakPoints.length;
            const hitCount = this._fractureWeakPoints.filter(w => w.grade && w.grade !== 'MISS').length;
            const thresholdMet = total > 0 && (hitCount / total) >= 0.6;
            this._fractureCoreSubmerge(thresholdMet);
            return;
        }

        // Advance to next point in sequence
        const nextIdx = idx + 1;
        if (nextIdx < this._fractureWeakPoints.length) {
            this._activateWeakPoint(nextIdx);
        }
    }

    // Core sinks back early as punishment for 3 total missed weak points this session —
    // counts as a failed window (no core damage), plus a fixed player damage hit.
    _fractureCoreSurfaceAbort() {
        const core = this.fractureCore;
        if (!core?.active) return;
        this.showStatusText(core.container.x, core.container.y - 90, '✦ CORE RETREATS — TOO MANY MISSES', '#ff4444');
        this.takeDamage((15 + this._crackPhase * 3) * (this.damageScaling || 1));
        this._fractureCoreSubmerge(false, 'Too many misses');
    }

    // Legacy routing (called from CombatSystem/WeaponSystem) — now just delegates to click handler
    _hitFractureWeakPoint(wx, wy, radius, damage) {
        this._tryHitCurrentWeakPoint(wx, wy);
        return false; // weapon projectiles don't deal direct weak-point damage
    }

    _updateFractureCore(time, delta) {
        const core = this.fractureCore;
        if (!core?.active) return;

        // Crack system drives everything — surface cycle, pulses, spawns, tendrils
        this._updateCracks(time, delta || 16);
    }

    // Called when the player's attack lands on a weak point during a surface window.
    // Damage to the core is NOT applied per-hit — it's a fixed amount applied when
    // all weak points are completed (see _fractureCoreSubmerge).
    damageFractureCore(amount, wx, wy) {
        const core = this.fractureCore;
        if (!core?.active || core._isInvulnerable || !core._surfaced) return;
        if (wx === undefined || wy === undefined) return;

        const radius = this.TILE_SIZE * 0.6;
        this._hitFractureWeakPoint(wx, wy, radius, amount);

        // Visual feedback on the core itself
        this.tweens.killTweensOf(core.container);
        this.tweens.add({ targets: core.container, angle: core.container.angle + 45, duration: 100,
            onComplete: () => this.tweens.add({ targets: core.container, angle: 360, duration: 8000, repeat: -1, ease: 'Linear' }) });
    }

    _fractureCoreKill() {
        const core = this.fractureCore;
        if (!core) return;
        this.showStatusText(core.container.x, core.container.y - 80, '✦ FRACTURE CORE DESTROYED', '#ff6600');
        this.cameras.main.shake(300, 0.020);
        this.cameras.main.flash(500, 255, 150, 50);
        // Death burst
        for (let i = 0; i < 16; i++) {
            const a = (i/16)*Math.PI*2;
            const r = 20 + Math.random()*40;
            const g = this.add.graphics().setDepth(6);
            g.fillStyle(0xff6600, 0.90); g.fillCircle(core.container.x, core.container.y, 12);
            this.tweens.add({ targets: g,
                x: core.container.x + Math.cos(a)*r, y: core.container.y + Math.sin(a)*r,
                scaleX: 0, scaleY: 0, alpha: 0, duration: 600, ease: 'Quad.easeOut',
                onComplete: () => g.destroy() });
        }
        core.container.destroy();
        core.hpBg.destroy(); core.hpFill.destroy(); core.hpText.destroy();
        core.capBg?.destroy(); core.capFill?.destroy(); core.capText?.destroy();
        core.active = false;

        // Clean up crack system
        for (const crack of (this._cracks || [])) {
            if (crack.gfx?.active) crack.gfx.destroy();
        }
        this._cracks = [];
        for (const wp of (this._fractureWeakPoints || [])) {
            if (wp.innerGfx?.active) { this.tweens.killTweensOf(wp.innerGfx); wp.innerGfx.destroy(); }
            if (wp.ringGfx?.active)  { this.tweens.killTweensOf(wp.ringGfx);  wp.ringGfx.destroy(); }
        }
        this._fractureWeakPoints = [];
        for (const p of (this._crackPulses || [])) {
            if (p.gfx?.active) p.gfx.destroy();
        }
        this._crackPulses = [];

        this.fractureCore = null;
        this._level4RoomClear(6);
    }

    createLightningElemental(x, y, tutorialRoomIndex) {
        const e = this.createEnemy(x, y, 90);
        e.tutorialRoomIndex = tutorialRoomIndex;
        e.lightningImmune = true;
        e.elementImmune = false; // can be damaged by fire/ice
        e._lightningMark = this._spawnLightningMark(e);
        // Periodic arc attack toward player
        e._arcCooldown = 2500;
        e._lastArcTime = 0;
        // Arc range ring — dashed circle showing 5-tile threat radius
        const ringR = 5 * this.TILE_SIZE;
        const ring = this.add.graphics().setDepth(1.0);
        ring.x = e.sprite.x; ring.y = e.sprite.y;
        const SEGS = 24;
        for (let i = 0; i < SEGS; i++) {
            if (i % 2 === 0) continue; // every other segment → dashed
            const a1 = (i / SEGS) * Math.PI * 2;
            const a2 = ((i + 0.85) / SEGS) * Math.PI * 2;
            ring.lineStyle(1.5, 0xffff44, 0.35);
            ring.beginPath();
            ring.arc(0, 0, ringR, a1, a2, false);
            ring.strokePath();
        }
        this.tweens.add({ targets: ring, alpha: 0.15, duration: 900, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
        e._arcRangeRing = ring;
        return e;
    }

    _spawnLightningMark(enemy) {
        const mark = this.add.graphics().setDepth(3.0);
        mark.x = enemy.sprite.x; mark.y = enemy.sprite.y - 22;
        // Outer glow ring
        mark.lineStyle(1.5, 0xffff44, 0.40); mark.strokeCircle(0, 0, 10);
        // 3 zigzag lightning bolts radiating outward
        const bolts = [0, (2/3)*Math.PI, (4/3)*Math.PI];
        for (const baseA of bolts) {
            mark.lineStyle(2, 0xffff00, 0.95);
            mark.beginPath();
            mark.moveTo(0, 0);
            // zigzag: step out at base angle with offsets
            const r1 = 5, r2 = 9;
            const side = baseA + Math.PI / 2;
            mark.lineTo(Math.cos(baseA)*r1 + Math.cos(side)*2.5, Math.sin(baseA)*r1 + Math.sin(side)*2.5);
            mark.lineTo(Math.cos(baseA)*r2 - Math.cos(side)*2, Math.sin(baseA)*r2 - Math.sin(side)*2);
            mark.strokePath();
            // bright tip dot
            mark.fillStyle(0xffffff, 0.90);
            mark.fillCircle(Math.cos(baseA)*r2 - Math.cos(side)*2, Math.sin(baseA)*r2 - Math.sin(side)*2, 1.5);
        }
        // Centre core
        mark.fillStyle(0xffffff, 1.0); mark.fillCircle(0, 0, 2.5);
        mark.fillStyle(0xffff44, 0.80); mark.fillCircle(0, 0, 4);
        this.tweens.add({ targets: mark, alpha: 0.4, duration: 180, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
        return mark;
    }

    createVoidSniper(x, y, tutorialRoomIndex) {
        const e = this.createEnemy(x, y, 35);
        e.tutorialRoomIndex = tutorialRoomIndex;
        e.isVoidSniper = true;
        e._sniperInvisible = true; // kept for status-immunity guards
        e._inDimension = true;
        e._sniperExiting = false;
        e._sniperVulnerable = false;
        // Stagger first appearance 4-8s
        e._nextDimensionExit = this.time.now + 4000 + Math.random() * 4000;
        // Swap to purple slime sprite
        if (this.anims.exists('purple_idle')) {
            e.sprite.setTexture('slime_purple', 0);
            e.sprite.play('purple_idle');
        }
        // Fully hidden — lives in dimension
        e.sprite.setAlpha(0);
        e.sprite.setTint(0x220044);
        if (e.healthBarBg?.active)   e.healthBarBg.setAlpha(0);
        if (e.healthBarFill?.active) e.healthBarFill.setAlpha(0);
        // Void mark (hidden while in dimension)
        e._voidMark = this._spawnVoidMark(e);
        // Spawn idle portal at starting tile so player can see something exists here
        this._spawnSniperPortal(e, x * this.TILE_SIZE + this.TILE_SIZE / 2, y * this.TILE_SIZE + this.TILE_SIZE / 2 + (this.SLIME_Y_OFFSET || -10));
        return e;
    }

    // ─── SNIPER PORTAL VFX ───────────────────────────────────────────────────
    _spawnSniperPortal(enemy, wx, wy) {
        // Close any existing portal first
        if (enemy._portalGfx?.active) {
            if (enemy._portalSpinTween) { enemy._portalSpinTween.stop(); enemy._portalSpinTween = null; }
            enemy._portalGfx.destroy(); enemy._portalGfx = null;
        }
        const g = this.add.graphics().setDepth(3.2);
        g.x = wx; g.y = wy;
        const R = this.TILE_SIZE * 0.42;
        // Outer ring
        g.lineStyle(3, 0xcc44ff, 0.85); g.strokeCircle(0, 0, R);
        // Inner swirl spokes
        for (let i = 0; i < 8; i++) {
            const a = (i / 8) * Math.PI * 2;
            g.lineStyle(1.5, 0xee88ff, 0.55);
            g.beginPath(); g.moveTo(0, 0); g.lineTo(Math.cos(a) * R * 0.55, Math.sin(a) * R * 0.55); g.strokePath();
        }
        // Dark void centre
        g.fillStyle(0x110022, 0.90); g.fillCircle(0, 0, R * 0.45);
        g.fillStyle(0xcc44ff, 0.60); g.fillCircle(0, 0, R * 0.18);
        // Spin
        const spinTween = this.tweens.add({ targets: g, angle: 360, duration: 1200, repeat: -1 });
        // Pop in
        g.setScale(0.1);
        this.tweens.add({ targets: g, scaleX: 1, scaleY: 1, duration: 280, ease: 'Back.easeOut' });
        enemy._portalGfx = g;
        enemy._portalSpinTween = spinTween;
    }

    _closeSniperPortal(enemy) {
        if (!enemy._portalGfx?.active) return;
        if (enemy._portalSpinTween) { enemy._portalSpinTween.stop(); enemy._portalSpinTween = null; }
        const g = enemy._portalGfx;
        enemy._portalGfx = null;
        this.tweens.add({
            targets: g, scaleX: 0, scaleY: 0, alpha: 0,
            duration: 220, ease: 'Quad.easeIn',
            onComplete: () => { if (g?.active) g.destroy(); }
        });
    }

    _spawnVoidMark(enemy) {
        const mark = this.add.graphics().setDepth(3.0).setAlpha(0.08);
        mark.x = enemy.sprite.x; mark.y = enemy.sprite.y - 22;
        // Purple crosshair — 4 lines with gap in centre
        const col = 0xcc44ff, colB = 0xee88ff;
        const gap = 3, len = 9;
        mark.lineStyle(2, col, 0.95);
        // cross arms
        mark.beginPath(); mark.moveTo(-gap, 0); mark.lineTo(-len, 0); mark.strokePath();
        mark.beginPath(); mark.moveTo( gap, 0); mark.lineTo( len, 0); mark.strokePath();
        mark.beginPath(); mark.moveTo(0, -gap); mark.lineTo(0, -len); mark.strokePath();
        mark.beginPath(); mark.moveTo(0,  gap); mark.lineTo(0,  len); mark.strokePath();
        // outer circle
        mark.lineStyle(1.5, col, 0.70); mark.strokeCircle(0, 0, len + 2);
        // small tick marks at diagonals
        mark.lineStyle(1, colB, 0.60);
        for (const a of [Math.PI/4, 3*Math.PI/4, 5*Math.PI/4, 7*Math.PI/4]) {
            mark.beginPath();
            mark.moveTo(Math.cos(a)*9, Math.sin(a)*9);
            mark.lineTo(Math.cos(a)*12, Math.sin(a)*12);
            mark.strokePath();
        }
        // centre dot
        mark.fillStyle(colB, 0.90); mark.fillCircle(0, 0, 2);
        this.tweens.add({ targets: mark, alpha: 0.08, duration: 0 }); // starts hidden, shown on reveal
        return mark;
    }

    createQueenSlimePortal(x, y, tutorialRoomIndex, portalId) {
        return this.spawnPortal(x, y, tutorialRoomIndex);
    }

    // ─── QUEEN SLIME PORTAL SYSTEM ───────────────────────────────────────

    getPortalAt(tileX, tileY) {
        if (!this.portals) return null;
        return this.portals.find(p => p.active && p.tileX === tileX && p.tileY === tileY) || null;
    }

    spawnPortal(tileX, tileY, tutorialRoomIndex) {
        if (!this.portals) this.portals = [];
        const px = tileX * this.TILE_SIZE + this.TILE_SIZE / 2;
        const py = tileY * this.TILE_SIZE + this.TILE_SIZE / 2;

        const container = this.add.container(px, py + (this.SLIME_Y_OFFSET || -10)).setDepth(1.5);

        const shadow = this.add.ellipse(0, 10, 52, 14, 0x000000, 0.25);
        const hpBg = this.add.rectangle(0, -76, 48, 6, 0x330000, 1);
        hpBg.setStrokeStyle(1, 0x000000, 1);
        const hpBar = this.add.rectangle(-24, -76, 48, 6, 0xee2222, 1).setOrigin(0, 0.5);
        const hpLabel = this.add.text(0, -86, 'QUEEN', {
            fontSize: '7px', fontFamily: 'monospace', color: '#ffaaaa',
            stroke: '#000', strokeThickness: 2
        }).setOrigin(0.5);

        const sprite = this.add.sprite(0, -40, 'slime_red', 0).setScale(3.2);
        if (this.anims.exists('red_idle')) sprite.play('red_idle');

        const crown = this.add.graphics();
        crown.fillStyle(0xffcc00, 1); crown.fillRect(-13, -38, 26, 8);
        crown.fillTriangle(-13, -38, -10, -52, -6, -38);
        crown.fillTriangle(-3, -38, 0, -54, 3, -38);
        crown.fillTriangle(6, -38, 10, -52, 13, -38);
        crown.fillStyle(0xff2222, 1); crown.fillCircle(-10, -34, 3);
        crown.fillStyle(0x22ffff, 1); crown.fillCircle(0, -34, 3);
        crown.fillStyle(0xff2222, 1); crown.fillCircle(10, -34, 3);
        crown.lineStyle(1.5, 0xaa8800, 1); crown.strokeRect(-13, -38, 26, 8);

        const glow = this.add.rectangle(0, 0, 24, 16, 0xffaa00, 0.2);

        const AMMO_MAX = 6;
        const ammoSegs = [];
        const spawnLabel = this.add.text(0, -66, 'SPAWN', {
            fontSize: '6px', fontFamily: 'monospace', color: '#ff8888',
            stroke: '#000', strokeThickness: 2
        }).setOrigin(0.5);
        for (let i = 0; i < AMMO_MAX; i++) {
            const sx = -23 + i * 9;
            const bg   = this.add.rectangle(sx, -59, 8, 5, 0x220000, 1).setOrigin(0, 0.5);
            const fill = this.add.rectangle(sx, -59, 8, 5, 0xff4444, 1).setOrigin(0, 0.5);
            ammoSegs.push({ bg, fill, full: true });
            container.add([bg, fill]);
        }

        const qHitbox = this.add.graphics();
        qHitbox.lineStyle(1.5, 0xff8800, 0.55);
        const qr = this.TILE_SIZE * 1.25;
        qHitbox.strokeRect(-qr, -qr, qr * 2, qr * 2);
        container.add([shadow, sprite, crown, glow, hpBg, hpBar, hpLabel, spawnLabel, qHitbox]);
        this.tweens.add({ targets: glow, alpha: 0.45, duration: 400, yoyo: true, repeat: -1 });

        const bobBaseY = py + (this.SLIME_Y_OFFSET || -10);
        this.tweens.add({ targets: container, y: bobBaseY - 6, duration: 700, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });

        const portal = {
            tileX, tileY,
            hp: 250, maxHp: 250,
            tutorialRoomIndex,
            container, sprite, hpBar, ammoSegs,
            gfxObjs: [container],
            spawnedEnemies: [],
            ammo: AMMO_MAX, ammoMax: AMMO_MAX,
            lastAmmoTime: 0,
            ammoRecharge: 4000,
            spawnRadius: 14,
            spawnCap: 5,
            _spawning: false,
            active: true,
            _baseScale: 3.2,
        };
        this.portals.push(portal);
        return portal;
    }

    updatePortals(time) {
        if (!this.portals || !this.portals.length) return;
        for (let pi = this.portals.length - 1; pi >= 0; pi--) {
            const queen = this.portals[pi];
            if (!queen.active) continue;
            // Only update when player is in the same room
            if (this.getCurrentPlayerRoom() !== queen.tutorialRoomIndex) continue;

            queen.spawnedEnemies = queen.spawnedEnemies.filter(e => this.enemies.includes(e));

            if (queen.ammo < queen.ammoMax && time - queen.lastAmmoTime >= queen.ammoRecharge) {
                queen.ammo = Math.min(queen.ammoMax, queen.ammo + 1);
                queen.lastAmmoTime = time;
            }

            for (let i = 0; i < queen.ammoMax; i++) {
                const seg = queen.ammoSegs[i];
                if (!seg) continue;
                const filled = i < queen.ammo;
                if (filled !== seg.full) { seg.full = filled; seg.fill.setVisible(filled); }
            }

            if (!queen._spawning && queen.ammo > 0 && queen.spawnedEnemies.length < queen.spawnCap) {
                const dx = this.playerX - queen.tileX, dy = this.playerY - queen.tileY;
                if (Math.sqrt(dx * dx + dy * dy) <= queen.spawnRadius) {
                    const offsets = [{x:0,y:-1},{x:1,y:0},{x:0,y:1},{x:-1,y:0},
                                     {x:1,y:-1},{x:1,y:1},{x:-1,y:1},{x:-1,y:-1}];
                    for (const off of offsets) {
                        const sx = queen.tileX + off.x, sy = queen.tileY + off.y;
                        if (!this.world[sx] || this.world[sx][sy] !== this.FLOOR) continue;
                        if (this.getEnemyAt(sx, sy)) continue;

                        queen.ammo--;
                        queen.lastAmmoTime = time;
                        queen._spawning = true;

                        const wpx = sx * this.TILE_SIZE + this.TILE_SIZE / 2;
                        const wpy = sy * this.TILE_SIZE + this.TILE_SIZE / 2;

                        const warn = this.add.text(wpx, wpy - 20, '!', {
                            fontSize: '18px', fontFamily: 'monospace', fontStyle: 'bold',
                            color: '#ff4400', stroke: '#000', strokeThickness: 3
                        }).setOrigin(0.5).setDepth(5);
                        const warnTween = this.tweens.add({
                            targets: warn, scaleX: 1.3, scaleY: 1.3,
                            duration: 200, yoyo: true, repeat: -1
                        });

                        this.tweens.killTweensOf(queen.sprite);
                        this.tweens.add({
                            targets: queen.sprite, scaleX: 2.6, scaleY: 3.8,
                            duration: 350, ease: 'Power2'
                        });

                        this.time.delayedCall(800, () => {
                            warnTween.stop(); warn.destroy();
                            queen._spawning = false;
                            if (!queen.active) return;
                            if (this.world[sx]?.[sy] !== this.FLOOR || this.getEnemyAt(sx, sy)) return;

                            const e = this.createEnemy(sx, sy, 25);
                            e.tutorialRoomIndex = queen.tutorialRoomIndex;
                            e.sprite.setTint(0xff8888);
                            queen.spawnedEnemies.push(e);

                            const bs = queen._baseScale || 3.2;
                            this.tweens.killTweensOf(queen.sprite);
                            this.tweens.add({
                                targets: queen.sprite,
                                scaleX: bs * 1.2, scaleY: bs * 0.85,
                                duration: 80, ease: 'Power2',
                                onComplete: () => {
                                    this.tweens.add({
                                        targets: queen.sprite,
                                        scaleX: bs, scaleY: bs,
                                        duration: 120, ease: 'Bounce.easeOut'
                                    });
                                }
                            });
                            const pop = this.add.circle(wpx, wpy, 6, 0xff4444, 0.8).setDepth(3);
                            this.tweens.add({
                                targets: pop, scaleX: 2.5, scaleY: 2.5,
                                alpha: 0, duration: 260,
                                onComplete: () => pop.destroy()
                            });
                        });
                        break;
                    }
                }
            }
        }
    }

    damagePortal(portal, damage, opts = {}) {
        if (!portal.active) return;
        const time = this.time.now;

        if (portal.isFrozen) {
            damage *= 2;
            portal.isFrozen = false;
            portal.frozenUntil = 0;
            if (portal.sprite?.active) portal.sprite.clearTint();
            if (portal._freezeTimer) { portal._freezeTimer.remove(); portal._freezeTimer = null; }
            const px = portal.tileX * this.TILE_SIZE + this.TILE_SIZE / 2;
            const py = portal.tileY * this.TILE_SIZE + this.TILE_SIZE / 2;
            const sb = this.add.graphics().setDepth(5);
            sb.fillStyle(0xffffff, 0.8); sb.fillCircle(px, py, 20);
            this.tweens.add({ targets: sb, scaleX: 2.5, scaleY: 2.5, alpha: 0, duration: 250, onComplete: () => sb.destroy() });
            this.showStatusText(px, py - 28, 'SHATTER!', '#aaffff');
        } else if (opts.freeze) {
            // Instant freeze — pierce spike path
            portal.chillStacks = 0;
            if (!portal.isFrozen) {
                portal.isFrozen = true;
                portal.frozenUntil = time + 8000;
                if (portal.sprite?.active) portal.sprite.setTint(0x88ccff);
                const px = portal.tileX * this.TILE_SIZE + this.TILE_SIZE / 2;
                const py = portal.tileY * this.TILE_SIZE + this.TILE_SIZE / 2;
                this.showStatusText(px, py - 28, 'FROZEN!', '#88ddff');
                if (typeof this.gainUltCharge === 'function') this.gainUltCharge(this.ultChargePerFreeze);
                portal._freezeTimer = this.time.delayedCall(8000, () => {
                    if (portal.active) {
                        portal.isFrozen = false; portal.frozenUntil = 0;
                        if (portal.sprite?.active) portal.sprite.clearTint();
                    }
                });
                return; // don't deal damage the frame we freeze
            }
        } else if (opts.chill) {
            if (!portal.chillStacks) portal.chillStacks = 0;
            portal.chillStacks++;
            portal.lastChillTime = time;
            if (portal.chillStacks >= 3) {
                portal.chillStacks = 0;
                portal.isFrozen = true;
                portal.frozenUntil = time + 8000;
                if (portal.sprite?.active) portal.sprite.setTint(0x88ccff);
                const px = portal.tileX * this.TILE_SIZE + this.TILE_SIZE / 2;
                const py = portal.tileY * this.TILE_SIZE + this.TILE_SIZE / 2;
                this.showStatusText(px, py - 28, 'FROZEN!', '#88ddff');
                if (typeof this.gainUltCharge === 'function') this.gainUltCharge(this.ultChargePerFreeze);
                portal._freezeTimer = this.time.delayedCall(8000, () => {
                    if (portal.active) {
                        portal.isFrozen = false; portal.frozenUntil = 0;
                        if (portal.sprite?.active) portal.sprite.clearTint();
                    }
                });
                return;
            } else {
                if (portal.sprite?.active) portal.sprite.setTint(0xaaddff);
                this.time.delayedCall(120, () => { if (portal.sprite?.active && !portal.isFrozen) portal.sprite.clearTint(); });
            }
        }

        portal.hp -= damage;
        portal.hpBar.width = 48 * Math.max(0, portal.hp / portal.maxHp);

        if (!portal.isFrozen && portal.sprite?.active) {
            portal.sprite.setTint(0xffffff);
            this.time.delayedCall(80, () => { if (portal.sprite?.active && !portal.isFrozen) portal.sprite.clearTint(); });
        }

        if (portal.hp <= 0) this._destroyPortal(portal);
    }

    _destroyPortal(portal) {
        portal.active = false;
        const px = portal.tileX * this.TILE_SIZE + this.TILE_SIZE / 2;
        const py = portal.tileY * this.TILE_SIZE + this.TILE_SIZE / 2;

        for (let i = 0; i < 14; i++) {
            const angle = (i / 14) * Math.PI * 2;
            const blob = this.add.circle(px, py, 4 + Math.random() * 6, 0xff2222, 1).setDepth(4);
            this.tweens.add({
                targets: blob,
                x: px + Math.cos(angle) * (22 + Math.random() * 22),
                y: py + Math.sin(angle) * (22 + Math.random() * 22),
                alpha: 0, scaleX: 0.1, scaleY: 0.1,
                duration: 400 + Math.random() * 150, ease: 'Quad.easeOut',
                onComplete: () => blob.destroy()
            });
        }
        const burst = this.add.circle(px, py, 12, 0xffffff, 0.9).setDepth(4);
        this.tweens.add({ targets: burst, scaleX: 3.5, scaleY: 3.5, alpha: 0, duration: 300, onComplete: () => burst.destroy() });
        this.cameras.main.shake(80, 0.006);
        this.showStatusText(px, py - 40, 'QUEEN SLAIN!', '#ff8888');

        for (const g of portal.gfxObjs) {
            if (g?.active) { this.tweens.killTweensOf(g); g.destroy(); }
        }
        portal.gfxObjs = [];
        const idx = this.portals.indexOf(portal);
        if (idx !== -1) this.portals.splice(idx, 1);
    }

    _showCosmicTutorial() {
        const msgs = [
            'COSMIC ELEMENT UNLOCKED! (Press 4)',
            'CHANNEL [Hold C] to accumulate cosmic charges',
            'BEAM [Left Click] — charge then fire a devastating beam',
            'DASH [Space] — teleport through enemies marking them',
            'BLACK HOLE [E] — launch a void bomb, E again to detonate',
        ];
        msgs.forEach((msg, i) => {
            this.time.delayedCall(i * 2200, () => {
                this.showStatusText(this.player.x, this.player.y - 40 - i * 14, msg, '#cc88ff');
            });
        });
    }

    // ─── VOID SOVEREIGN BOSS ─────────────────────────────────────────────

    spawnVoidSovereignBoss(tileX, tileY) {
        const px = tileX * this.TILE_SIZE + this.TILE_SIZE / 2;
        const py = tileY * this.TILE_SIZE + this.TILE_SIZE / 2;
        const offsetY = this.SLIME_Y_OFFSET || -10;

        const container = this.add.container(px, py + offsetY).setDepth(3);

        // Body — purple slime sprite scaled up
        const body = this.add.sprite(0, -70, 'slime_purple', 0).setScale(5.0);
        body.setTint(0x6600aa); // darken to deep void purple
        if (this.anims.exists('purple_idle')) body.play('purple_idle');

        // Void crown — orbiting dark particles
        const crownGfx = this.add.graphics();
        this._drawVoidCrown(crownGfx);

        // Orbiting void ring
        const orbitRing = this.add.graphics();
        orbitRing.lineStyle(3, 0x6600aa, 0.70); orbitRing.strokeCircle(0, -70, 55);
        orbitRing.lineStyle(1.5, 0xcc44ff, 0.45); orbitRing.strokeCircle(0, -70, 48);

        // Shadow
        const shadow = this.add.ellipse(0, 8, 72, 20, 0x000000, 0.35);

        // HP bar
        const hpBg = this.add.rectangle(0, -88, 88, 9, 0x110022, 1);
        hpBg.setStrokeStyle(1, 0x000000, 1);
        const hpBar = this.add.rectangle(-44, -88, 88, 9, 0xaa22ff, 1).setOrigin(0, 0.5);
        const hpLabel = this.add.text(0, -100, 'VOID SOVEREIGN', {
            fontSize: '9px', fontFamily: 'monospace', color: '#cc88ff',
            stroke: '#000', strokeThickness: 2, fontStyle: 'bold'
        }).setOrigin(0.5);

        // Debug hitbox — shows the ±2 tile damage range (5×5 tiles, centred on tileX/tileY)
        const hitboxRing = this.add.graphics();
        hitboxRing.lineStyle(1.5, 0xff44ff, 0.55);
        const hr = 2 * this.TILE_SIZE; // half the 5-tile box
        hitboxRing.strokeRect(-hr, -hr, hr * 2, hr * 2 - this.TILE_SIZE);
        container.add([shadow, hpBg, hpBar, hpLabel, orbitRing, body, crownGfx, hitboxRing]);

        const baseY = py + offsetY;
        const idleBobTween = this.tweens.add({ targets:container, y:baseY - 10, duration:1200, yoyo:true, repeat:-1, ease:'Sine.easeInOut' });
        // Rotate orbitRing continuously
        this.tweens.add({ targets:orbitRing, angle:360, duration:4000, repeat:-1, ease:'Linear' });

        // Orbiting particle debris — 8 void shards
        const debris = [];
        for (let i = 0; i < 8; i++) {
            const d = this.add.graphics().setDepth(3.5);
            d.fillStyle(i % 2 === 0 ? 0x9922cc : 0xcc44ff, 0.85);
            d.fillCircle(0, 0, 3 + (i % 3));
            container.add(d);
            debris.push({ gfx:d, angle:(i / 8) * Math.PI * 2, radius: 55 + (i % 3) * 6 });
        }

        this.voidSovereignBoss = {
            tileX, tileY, hp: 3000, maxHp: 3000,
            container, body, hpBar, orbitRing, crownGfx, debris,
            active: true, phase: 'waiting',
            _baseY: baseY, _activated: false, _idleBobTween: idleBobTween,
            _attackQueue: [], _attackIndex: 0,
            _pillarPositions: [[6,59],[24,59],[6,74],[24,74]], // destroyable at 60%
            _pillarsDestroyed: false,
            _phase2Unlocked: false,
            _phase3Unlocked: false,
            _voidMines: [],
            _laserGfx: null,
            _gravityHole: null,
            _fragmentOrbs: [],
            _isInvulnerable: false,
            _singWaveId: 0,
        };

        // Debris orbit update timer
        this.time.addEvent({
            delay: 30, loop: true,
            callback: () => {
                const boss = this.voidSovereignBoss;
                if (!boss?.active) return;
                boss.debris.forEach(d => {
                    d.angle += 0.025;
                    d.gfx.x = Math.cos(d.angle) * d.radius;
                    d.gfx.y = -70 + Math.sin(d.angle) * d.radius * 0.5;
                });
            }
        });
    }

    _drawVoidCrown(g) {
        g.clear();
        g.fillStyle(0xcc44ff, 0.90);
        g.fillRect(-18, -108, 36, 10);
        g.fillTriangle(-18,-108,-14,-128,-9,-108);
        g.fillTriangle(-4,-108, 0,-132, 4,-108);
        g.fillTriangle( 9,-108, 14,-128, 18,-108);
        g.fillStyle(0xffffff, 0.70);
        g.fillCircle(-13,-104, 4); g.fillCircle(0,-104, 4); g.fillCircle(13,-104, 4);
        g.lineStyle(1.5, 0x880099, 1); g.strokeRect(-18,-108,36,10);
    }

    _updateVoidSovereign(time) {
        const boss = this.voidSovereignBoss;
        if (!boss?.active) return;

        // Sync tile position
        boss.tileX = Math.floor(boss.container.x / this.TILE_SIZE);
        boss.tileY = Math.floor(boss.container.y / this.TILE_SIZE);

        // Track freeze visual position
        if (boss._isFrozen && boss._bossProxy?.freezeVisuals) {
            const fbx = boss.container.x;
            const fby = boss.container.y - 20;
            const fv  = boss._bossProxy.freezeVisuals;
            if (fv.iceBlock)  { fv.iceBlock.x  = fbx; fv.iceBlock.y  = fby; }
            if (fv.iceBorder) { fv.iceBorder.x = fbx; fv.iceBorder.y = fby; }
        }

        // Update HP bar
        const hpPct = Math.max(0, boss.hp / boss.maxHp);
        boss.hpBar.width = 88 * hpPct;
        const hpCol = hpPct > 0.6 ? 0xaa22ff : hpPct > 0.3 ? 0xff6600 : 0xff2200;
        boss.hpBar.setFillStyle(hpCol);

        // Update boss burn stack pip positions
        if (boss._burnStackBar) {
            const bx = boss.container.x;
            const by = boss.container.y - 130;
            const stacks = boss._burnStackBar.length;
            const GAP = 8, W = 8;
            const totalW = stacks * W + (stacks - 1) * GAP;
            for (let i = 0; i < stacks; i++) {
                const pip = boss._burnStackBar[i];
                if (!pip?.active) continue;
                pip.x = bx - totalW / 2 + i * (W + GAP) + W / 2;
                pip.y = by;
            }
        }

        // Phase transitions
        if (!boss._phase2Unlocked && hpPct <= 0.60) {
            boss._phase2Unlocked = true;
            this._voidSovereignPhase2Transition();
        }
        if (!boss._phase3Unlocked && hpPct <= 0.30) {
            boss._phase3Unlocked = true;
        }

        // Update void mines — tick timers and handle detonation
        for (let i = boss._voidMines.length - 1; i >= 0; i--) {
            const mine = boss._voidMines[i];
            if (!mine.gfx?.active) { boss._voidMines.splice(i, 1); continue; }
            const elapsed = time - mine.spawnTime;
            const progress = Math.min(elapsed / mine.duration, 1);

            // Draw sweep arc
            mine.gfx.clear();
            mine.gfx.fillStyle(0x110022, 0.85); mine.gfx.fillCircle(0, 0, mine.radius * this.TILE_SIZE);
            mine.gfx.lineStyle(2, 0x220044, 0.80); mine.gfx.strokeCircle(0, 0, mine.radius * this.TILE_SIZE);
            mine.gfx.fillStyle(0x9922cc, 0.70); mine.gfx.fillCircle(0, 0, 6);
            // Sweep arc
            if (progress < 1) {
                mine.gfx.lineStyle(3, 0xff44ff, 0.90);
                mine.gfx.beginPath();
                mine.gfx.arc(0, 0, mine.radius * this.TILE_SIZE - 3, -Math.PI/2, -Math.PI/2 + progress * Math.PI * 2, false);
                mine.gfx.strokePath();
            }

            if (progress >= 1) {
                // DETONATE
                this._voidMineDetonate(mine, time);
                mine.gfx.destroy();
                boss._voidMines.splice(i, 1);
            }
        }

        // Gravity hole pull
        if (boss._gravityHole?.active) {
            const gh = boss._gravityHole;
            const now = time;
            if (now - (gh._lastPull || 0) >= 800) {
                gh._lastPull = now;
                const ghTX = Math.floor(gh.x / this.TILE_SIZE);
                const ghTY = Math.floor(gh.y / this.TILE_SIZE);
                const dx = ghTX - this.playerX, dy = ghTY - this.playerY;
                if (Math.sqrt(dx*dx + dy*dy) <= 6 && !this._playerRooted) {
                    const pullX = this.playerX + Math.sign(dx);
                    const pullY = this.playerY + Math.sign(dy);
                    if (this.world[pullX]?.[pullY] === this.FLOOR) {
                        this.playerX = pullX; this.playerY = pullY;
                        this.player.x = pullX * this.TILE_SIZE + this.TILE_SIZE / 2;
                        this.player.y = pullY * this.TILE_SIZE + this.TILE_SIZE / 2 + this.SLIME_Y_OFFSET;
                    }
                }
            }
            if (time >= gh._expiresAt) {
                this.tweens.killTweensOf(gh); gh.destroy();
                boss._gravityHole = null;
            }
        }
    }

    _voidMineDetonate(mine, time) {
        const radiusPx = mine.radius * this.TILE_SIZE;
        const px = this.player.x, py = this.player.y;
        const dx = px - mine.gfx.x, dy = py - mine.gfx.y;

        // Explosion visual
        const exp = this.add.graphics().setDepth(5);
        exp.x = mine.gfx.x; exp.y = mine.gfx.y;
        exp.fillStyle(0x9922cc, 0.55); exp.fillCircle(0, 0, radiusPx * 1.5);
        exp.fillStyle(0xffffff, 0.85); exp.fillCircle(0, 0, radiusPx * 0.4);
        exp.lineStyle(3, 0xcc44ff, 0.90); exp.strokeCircle(0, 0, radiusPx);
        this.tweens.add({ targets:exp, scaleX:1.8, scaleY:1.8, alpha:0, duration:400, ease:'Quad.easeOut', onComplete:()=>exp.destroy() });
        this.cameras.main.shake(50, 0.005);

        if (Math.sqrt(dx*dx + dy*dy) <= radiusPx) {
            this.takeDamage(10 * this.damageScaling);
            this._rootPlayer(3000, time);
        }
    }

    _rootPlayer(duration, time) {
        this._playerRooted = true;
        this._playerRootUntil = (time || this.time.now) + duration;
        if (this.player?.active) this.player.setTint(0x9922cc);
        const rootTxt = this.add.text(this.player.x, this.player.y - 28, 'ROOTED', {
            fontSize: '10px', fontFamily: 'monospace', color: '#cc44ff',
            stroke: '#000', strokeThickness: 2, fontStyle: 'bold'
        }).setOrigin(0.5).setDepth(10);
        this.tweens.add({ targets:rootTxt, y:rootTxt.y - 14, alpha:0, duration:duration * 0.6, onComplete:()=>rootTxt.destroy() });
        this.time.delayedCall(duration, () => {
            if (this.player?.active) this.player.clearTint();
            this._playerRooted = false;
        });
    }

    _voidSovereignNextAttack() {
        const boss = this.voidSovereignBoss;
        if (!boss?.active) return;

        // Phase 1 attacks
        const p1 = ['voidMines', 'singularitySlimes', 'laserCross'];
        // Phase 2 adds darkFragments + stomp — weighted 2× so they appear more often
        const p2 = [...p1, 'darkFragments', 'darkFragments', 'stomp', 'stomp'];
        // Phase 3 adds singularityCollapse + eventHorizon + voidMaw — weighted 2× alongside boosted p2 attacks
        const p3 = [...p1, 'darkFragments', 'darkFragments', 'stomp', 'stomp',
                          'singularityCollapse', 'singularityCollapse', 'eventHorizon', 'eventHorizon',
                          'voidMaw', 'voidMaw'];

        const pool = boss._phase3Unlocked ? p3 : boss._phase2Unlocked ? p2 : p1;

        // Pick random attack that isn't the same as last
        let attack;
        do { attack = pool[Math.floor(Math.random() * pool.length)]; }
        while (attack === boss._lastAttack && pool.length > 1);
        boss._lastAttack = attack;

        const pauseBetween = boss._phase3Unlocked ? 900 : boss._phase2Unlocked ? 1300 : 1800;

        this.time.delayedCall(pauseBetween, () => {
            if (!boss.active) return;
            this._voidSovereignDoAttack(attack);
        });
    }

    _voidSovereignDoAttack(attack) {
        const boss = this.voidSovereignBoss;
        if (!boss?.active) return;
        if      (attack === 'voidMines')          this._vsAttackVoidMines();
        else if (attack === 'singularitySlimes')   this._vsAttackSingularitySlimes();
        else if (attack === 'laserCross')          this._vsAttackLaserCross();
        else if (attack === 'darkFragments')       this._vsAttackDarkFragments();
        else if (attack === 'stomp')               this._vsAttackStomp();
        else if (attack === 'singularityCollapse') this._vsAttackSingularityCollapse();
        else if (attack === 'eventHorizon')        this._vsAttackEventHorizon();
        else if (attack === 'voidMaw')             this._vsAttackVoidMaw();
    }

    // ─── BOSS ATTACKS ────────────────────────────────────────────────────

    _vsAttackVoidMines() {
        const boss = this.voidSovereignBoss;
        this.showStatusText(boss.container.x, boss.container.y - 80, '☠ VOID MINES', '#cc44ff');
        this.cameras.main.shake(30, 0.003);
        const bossRoomBounds = this.rooms[6];

        // Rhythmic waves: 2 mines per tick, 600ms between ticks, 3 waves with a pause
        const waveCounts = boss._phase3Unlocked ? [5, 5, 5] : boss._phase2Unlocked ? [4, 4, 4] : [3, 3, 3];
        const tickInterval = 550;   // ms between each pair of mines within a wave
        const wavePause    = 1800;  // ms gap between waves
        const mineDuration = 1200;  // how fast each mine detonates

        const spawnMine = () => {
            if (!boss.active) return;
            // Always bias to player position so both mines land near you
            for (let m = 0; m < 2; m++) {
                let tx, ty, attempts = 0;
                const biased = Math.random() < 0.75;
                do {
                    if (biased) {
                        const spread = 1 + Math.floor(Math.random() * 4);
                        tx = this.playerX + Math.floor((Math.random() * 2 - 1) * spread);
                        ty = this.playerY + Math.floor((Math.random() * 2 - 1) * spread);
                        tx = Math.max(bossRoomBounds.x + 1, Math.min(bossRoomBounds.x + bossRoomBounds.w - 2, tx));
                        ty = Math.max(bossRoomBounds.y + 1, Math.min(bossRoomBounds.y + bossRoomBounds.h - 2, ty));
                    } else {
                        tx = bossRoomBounds.x + 2 + Math.floor(Math.random() * (bossRoomBounds.w - 4));
                        ty = bossRoomBounds.y + 2 + Math.floor(Math.random() * (bossRoomBounds.h - 4));
                    }
                    attempts++;
                } while ((this.world[tx]?.[ty] !== this.FLOOR || (Math.abs(tx - this.playerX) < 1 && Math.abs(ty - this.playerY) < 1)) && attempts < 30);

                const mpx = tx * this.TILE_SIZE + this.TILE_SIZE / 2;
                const mpy = ty * this.TILE_SIZE + this.TILE_SIZE / 2;
                const mineGfx = this.add.graphics().setDepth(2);
                mineGfx.x = mpx; mineGfx.y = mpy;
                boss._voidMines.push({ gfx: mineGfx, spawnTime: this.time.now, duration: mineDuration, radius: 2.5 });

                const flash = this.add.circle(mpx, mpy, 8, 0x9922cc, 0.8).setDepth(4);
                this.tweens.add({ targets: flash, radius: 20, alpha: 0, duration: 200, onComplete: () => flash.destroy() });
            }
        };

        let totalDelay = 0;
        for (let w = 0; w < waveCounts.length; w++) {
            const ticks = waveCounts[w];
            for (let t = 0; t < ticks; t++) {
                const delay = totalDelay + t * tickInterval;
                this.time.delayedCall(delay, spawnMine);
            }
            totalDelay += ticks * tickInterval + wavePause;
        }

        // Next attack after all waves finish + last mine detonates
        this.time.delayedCall(totalDelay + mineDuration + 200, () => this._voidSovereignNextAttack());
    }

    _vsAttackSingularitySlimes() {
        const boss = this.voidSovereignBoss;
        this.showStatusText(boss.container.x, boss.container.y - 80, '☄ SINGULARITY SLIMES', '#cc44ff');
        this.cameras.main.shake(30, 0.003);

        const bossRoom = this.rooms[6];
        const count = boss._phase3Unlocked ? 18 : boss._phase2Unlocked ? 13 : 8;
        const waveId = ++boss._singWaveId;    // unique ID for this wave

        for (let i = 0; i < count; i++) {
            this.time.delayedCall(i * 200, () => {
                if (!boss.active || boss._singWaveId !== waveId) return;
                let tx, ty, attempts = 0;
                do {
                    tx = bossRoom.x + 2 + Math.floor(Math.random() * (bossRoom.w - 4));
                    ty = bossRoom.y + 2 + Math.floor(Math.random() * (bossRoom.h - 4));
                    attempts++;
                } while ((this.world[tx]?.[ty] !== this.FLOOR) && attempts < 30);

                const spx = tx * this.TILE_SIZE + this.TILE_SIZE / 2;
                const spy = ty * this.TILE_SIZE + this.TILE_SIZE / 2;
                const flash = this.add.circle(spx, spy, 14, 0xcc44ff, 0.8).setDepth(5);
                this.tweens.add({ targets: flash, scaleX: 2.5, scaleY: 2.5, alpha: 0, duration: 280, onComplete: () => flash.destroy() });

                const slime = this.createSingularitySlime(tx, ty, 6);
                slime._singWaveId = waveId;   // tag with this wave
            });
        }

        // Cleanup: only kill slimes from THIS wave
        this.time.delayedCall(8000, () => {
            if (!boss.active) return;
            // Don't kill survivors — they stay in the arena and keep pressuring the player
            this._voidSovereignNextAttack();
        });
    }

    createSingularitySlime(x, y, tutorialRoomIndex) {
        const e = this.createEnemy(x, y, 50);
        e.tutorialRoomIndex = tutorialRoomIndex;
        e.isSingularitySlime = true;
        e._singState    = 'idle';
        e._singLastAtk  = 0;
        e._singCooldown = 2800;
        e._singChargeDur = 700;
        e._singChargeStart = 0;

        // Swap to purple sprite with dark cosmic tint
        if (this.anims.exists('purple_idle')) {
            e.sprite.setTexture('slime_purple', 0);
            e.sprite.play('purple_idle');
        }
        e.sprite.setTint(0x440088);

        // ! mark — hidden until charging
        const markGfx = this.add.graphics().setDepth(3.5).setAlpha(0);
        markGfx.fillStyle(0xcc44ff, 1.0);
        markGfx.fillRect(-3, -12, 6, 9);
        markGfx.fillRect(-3,  -1, 6, 6);
        markGfx.lineStyle(1, 0xee88ff, 0.80);
        markGfx.strokeRect(-3, -12, 6, 9);
        markGfx.strokeRect(-3,  -1, 6, 6);
        markGfx.x = e.sprite.x;
        markGfx.y = e.sprite.y - 26;
        e._singMark = markGfx;

        return e;
    }

    _vsAttackLaserCross() {
        const boss = this.voidSovereignBoss;
        this.showStatusText(boss.container.x, boss.container.y - 80, '▦ LASER GRID', '#ff44ff');
        this.cameras.main.shake(30, 0.004);

        const bossRoom = this.rooms[6];
        const roomX1 = bossRoom.x * this.TILE_SIZE;
        const roomY1 = bossRoom.y * this.TILE_SIZE;
        const roomX2 = (bossRoom.x + bossRoom.w) * this.TILE_SIZE;
        const roomY2 = (bossRoom.y + bossRoom.h) * this.TILE_SIZE;
        const roomCX = (roomX1 + roomX2) / 2;
        const TS = this.TILE_SIZE;

        const LASER_DMG = 14 * this.damageScaling;
        const WARN_DUR  = 1400;
        const HOLD_DUR  = 2400;
        const BEAM_HALF = TS * 0.20; // tight hitbox — laser is visually 3px wide

        // ── Liang-Barsky clip to room ─────────────────────────────────────────
        const clipSeg = (x1, y1, x2, y2) => {
            let t0 = 0, t1 = 1;
            const dx = x2-x1, dy = y2-y1;
            for (const [p,q] of [[-dx,x1-roomX1],[dx,roomX2-x1],[-dy,y1-roomY1],[dy,roomY2-y1]]) {
                if (p === 0) { if (q < 0) return null; continue; }
                const r = q/p;
                if (p < 0) t0 = Math.max(t0,r); else t1 = Math.min(t1,r);
            }
            if (t0 > t1) return null;
            return [x1+t0*dx, y1+t0*dy, x1+t1*dx, y1+t1*dy];
        };

        // ── Draw segments ─────────────────────────────────────────────────────
        const drawSegs = (gfx, segs, col, alpha) => {
            gfx.clear();
            gfx.lineStyle(3, col, alpha);
            for (const [x1,y1,x2,y2] of segs) { gfx.beginPath(); gfx.moveTo(x1,y1); gfx.lineTo(x2,y2); gfx.strokePath(); }
            gfx.lineStyle(1, 0xffffff, alpha * 0.65);
            for (const [x1,y1,x2,y2] of segs) { gfx.beginPath(); gfx.moveTo(x1,y1); gfx.lineTo(x2,y2); gfx.strokePath(); }
        };

        // ── Hit check ─────────────────────────────────────────────────────────
        const checkHit = (segs) => {
            const px = this.player.x, py = this.player.y;
            for (const [x1,y1,x2,y2] of segs) {
                if (Utils.distancePointToSegment(px,py,x1,y1,x2,y2) < BEAM_HALF) {
                    this.takeDamage(LASER_DMG); return;
                }
            }
        };

        // ── Flicker then lock in ──────────────────────────────────────────────
        const flickerIn = (gfx, segs, col, cb) => {
            let n = 0;
            const ft = this.time.addEvent({ delay: 120, loop: true, callback: () => {
                n++;
                if (n % 2 === 0) drawSegs(gfx, segs, col, 0.40); else gfx.clear();
                if (n > 6) ft.delay = 65;
            }});
            this.time.delayedCall(WARN_DUR, () => {
                if (!boss.active) { ft.remove(); return; }
                ft.remove(); drawSegs(gfx, segs, col, 0.92);
                this.cameras.main.shake(25, 0.003); cb();
            });
        };

        // ── Fade out then continue ────────────────────────────────────────────
        const fadeOut = (gfx, dt, next) => {
            if (dt) dt.remove();
            this.tweens.add({ targets: gfx, alpha: 0, duration: 220,
                onComplete: () => { if (gfx?.active) gfx.destroy(); this.time.delayedCall(300, next); }
            });
        };

        // ── Random angle grid — two independent angle families, spacing in tiles ─
        const buildRandomGrid = (spacingTiles) => {
            const spacing = spacingTiles * TS;
            // Two random angles, guaranteed not near-parallel (>25° apart)
            const a1 = Math.random() * Math.PI;
            const a2 = a1 + Math.PI * (0.22 + Math.random() * 0.56);
            const ext = Math.max(roomX2-roomX1, roomY2-roomY1) * 2;
            const segs = [];
            for (const angle of [a1, a2]) {
                const cos = Math.cos(angle), sin = Math.sin(angle);
                const perpCos = -sin, perpSin = cos;
                // Bias offset so a gap lands near player
                const px = this.player.x - roomCX, py = this.player.y - ((roomY1+roomY2)/2);
                const playerPerp = px * perpCos + py * perpSin;
                const baseOff = ((playerPerp % spacing) + spacing) % spacing;
                const offset = (baseOff + spacing * 0.55) % spacing;
                for (let d = -ext + offset; d < ext; d += spacing) {
                    const ox = roomCX + perpCos * d, oy = (roomY1+roomY2)/2 + perpSin * d;
                    const c = clipSeg(ox - cos*ext, oy - sin*ext, ox + cos*ext, oy + sin*ext);
                    if (c) segs.push(c);
                }
            }
            return segs;
        };

        // ── Pattern 3: closing grid — 3 layers, flicker before each ──────────
        // Base 5 tiles → 2.5 → 1.25 — survivable but tight
        const runClosing = (gfx, ox, oy, onDone) => {
            // All lines snapped to tile boundaries — spacing in whole tiles
            // Layer 0: every 4 tiles (3 tile gaps)
            // Layer 1: bisect to every 2 tiles (1 tile gap) — always survivable
            const BASE_TILES = 4;
            const BASE = BASE_TILES * TS;

            // Snap ox/oy to nearest tile boundary so lines always land on tile edges
            const snappedOX = Math.round(ox / TS) * TS;
            const snappedOY = Math.round(oy / TS) * TS;

            const squareLayer = (spacingTiles, offX, offY) => {
                const spacing = spacingTiles * TS;
                const s = [];
                for (let y = roomY1 + offY; y < roomY2; y += spacing) s.push([roomX1, y, roomX2, y]);
                for (let x = roomX1 + offX; x < roomX2; x += spacing) s.push([x, roomY1, x, roomY2]);
                return s;
            };

            let allSegs = squareLayer(BASE_TILES, snappedOX, snappedOY);
            let dmgTimer = this.time.addEvent({ delay: 200, loop: true,
                callback: () => { if (boss.active) checkHit(allSegs); }
            });

            drawSegs(gfx, allSegs, 0xff22ff, 0.92);

            let layer = 0;
            const LAYERS = 2; // base + 1 bisect — final spacing 2 tiles (1-tile safe gaps)
            const LAYER_HOLD = 1200;

            const addLayer = () => {
                if (!boss.active) { dmgTimer.remove(); onDone(); return; }
                layer++;
                // Bisect: new lines fall exactly halfway between existing ones (2-tile spacing)
                // Offset by BASE_TILES/2 tiles from base — guaranteed to land on tile edge
                const halfTiles = BASE_TILES / Math.pow(2, layer);
                const newSegs = squareLayer(BASE_TILES / Math.pow(2, layer - 1),
                    snappedOX + halfTiles * TS, snappedOY + halfTiles * TS);

                // Flicker the new lines in
                const flashGfx = this.add.graphics().setDepth(4.1);
                let fn = 0;
                const ft = this.time.addEvent({ delay: 100, loop: true, callback: () => {
                    fn++;
                    if (fn % 2 === 0) drawSegs(flashGfx, newSegs, 0xffffff, 0.55); else flashGfx.clear();
                    if (fn > 5) ft.delay = 55;
                }});
                this.cameras.main.shake(18 + layer * 8, 0.003);

                this.time.delayedCall(800, () => {
                    if (!boss.active) { ft.remove(); flashGfx.destroy(); dmgTimer.remove(); onDone(); return; }
                    ft.remove(); flashGfx.destroy();
                    allSegs = [...allSegs, ...newSegs];
                    drawSegs(gfx, allSegs, 0xff22ff, 0.92);
                    this.cameras.main.shake(28, 0.004);

                    if (layer < LAYERS - 1) {
                        this.time.delayedCall(LAYER_HOLD, addLayer);
                    } else {
                        this.time.delayedCall(HOLD_DUR, () => { dmgTimer.remove(); onDone(); });
                    }
                });
            };

            this.time.delayedCall(LAYER_HOLD, addLayer);
        };

        // ── Pattern 1: random angle, 3-tile spacing ───────────────────────────
        const runP1 = () => {
            if (!boss.active) return;
            this.showStatusText(roomCX, roomY1 + TS, '⚠ FIND THE GAP', '#ff44ff');
            const segs = buildRandomGrid(3);
            const g = this.add.graphics().setDepth(4);
            flickerIn(g, segs, 0xff44ff, () => {
                const dt = this.time.addEvent({ delay: 200, loop: true, callback: () => { if (boss.active) checkHit(segs); } });
                this.time.delayedCall(HOLD_DUR, () => fadeOut(g, dt, runP2));
            });
        };

        // ── Pattern 2: different random angle, 2.5-tile spacing ──────────────
        const runP2 = () => {
            if (!boss.active) return;
            this.showStatusText(roomCX, roomY1 + TS, '⚠ FIND THE GAP', '#cc44ff');
            const segs = buildRandomGrid(2.5);
            const g = this.add.graphics().setDepth(4);
            flickerIn(g, segs, 0xcc44ff, () => {
                const dt = this.time.addEvent({ delay: 200, loop: true, callback: () => { if (boss.active) checkHit(segs); } });
                this.time.delayedCall(HOLD_DUR, () => fadeOut(g, dt, runP3));
            });
        };

        // ── Pattern 3: closing grid ───────────────────────────────────────────
        const runP3 = () => {
            if (!boss.active) return;
            this.showStatusText(roomCX, roomY1 + TS, '▦ CLOSING GRID', '#ff2200');
            const g = this.add.graphics().setDepth(4);
            // Flicker the base layer in first — snapped to tile grid
            const BASE = 4 * TS;
            const px = this.player.x - roomX1, py = this.player.y - roomY1;
            const rawOX = (Math.round(px / BASE) * BASE - TS * 0.6 + BASE * 10) % BASE;
            const rawOY = (Math.round(py / BASE) * BASE - TS * 0.6 + BASE * 10) % BASE;
            const ox = Math.round(rawOX / TS) * TS;
            const oy = Math.round(rawOY / TS) * TS;
            const baseSegs = [];
            for (let y = roomY1 + oy; y < roomY2; y += BASE) baseSegs.push([roomX1, y, roomX2, y]);
            for (let x = roomX1 + ox; x < roomX2; x += BASE) baseSegs.push([x, roomY1, x, roomY2]);
            flickerIn(g, baseSegs, 0xff2200, () => {
                runClosing(g, ox, oy, () => {
                    if (g?.active) g.destroy();
                    this.time.delayedCall(600, () => this._voidSovereignNextAttack());
                });
            });
        };

        runP1();
    }



    _vsAttackDarkFragments() {
        const boss = this.voidSovereignBoss;
        boss._isInvulnerable = true;
        this.showStatusText(boss.container.x, boss.container.y - 80, '◈ DARK MATTER FRAGMENTS', '#9922cc');
        boss.container.setVisible(false);

        const bossRoom = this.rooms[6];
        const cx = (bossRoom.x + bossRoom.w/2) * this.TILE_SIZE;
        const cy = (bossRoom.y + bossRoom.h/2) * this.TILE_SIZE;
        const ORBIT_R = 9 * this.TILE_SIZE;
        const fragCount = 4;
        const fragmentsHP = [1, 1, 1, 1];
        const fragmentsHit = [false, false, false, false];
        const fragGfxList = [];
        let fragAngle = 0;
        let fragsAlive = 4;
        const phaseStart = this.time.now;

        // Escalation — every 5s without a kill, orbits faster and ripples hurt more
        const escalateTimer = this.time.addEvent({
            delay: 5000, loop: true,
            callback: () => {
                if (fragsAlive <= 0) return;
                const elapsed = Math.floor((this.time.now - phaseStart) / 5000);
                // Increase orbit speed
                const orbitBoost = 0.004 * elapsed;
                fragGfxList.forEach(fg => { if (fg._alive) fg._orbitSpeedBoost = orbitBoost; });
                // Flash warning
                if (elapsed >= 2) {
                    this.showStatusText(cx, cy - 60, '⚠ ESCALATING!', '#ff4400');
                    this.cameras.main.shake(30, 0.004);
                }
            }
        });

        for (let i = 0; i < fragCount; i++) {
            const fg = this.add.graphics().setDepth(3.5);
            fg.fillStyle(0x9922cc, 0.90); fg.fillCircle(0, 0, 14);
            fg.fillStyle(0xcc44ff, 0.70); fg.fillCircle(0, 0, 8);
            fg.fillStyle(0xffffff, 0.85); fg.fillCircle(0, 0, 4);
            fg.lineStyle(2, 0x6600aa, 0.80); fg.strokeCircle(0, 0, 14);
            fg._hp = fragmentsHP[i];
            fg._index = i;
            fg._alive = true;

            // Health bar — bg and fill as separate Graphics
            const hpBg   = this.add.rectangle(0, -22, 28, 4, 0x220033, 1).setDepth(3.6);
            const hpFill = this.add.rectangle(0, -22, 28, 4, 0xcc44ff, 1).setDepth(3.7).setOrigin(0.5, 0.5);
            hpBg.setStrokeStyle(1, 0x000000, 0.8);
            fg._hpBg   = hpBg;
            fg._hpFill = hpFill;

            fragGfxList.push(fg);

            // Fragment fires ripples periodically
            fg._rippleTimer = this.time.addEvent({
                delay: 2000 + i * 300, loop: true,
                callback: () => {
                    if (!fg._alive || !fg.active) return;
                    const elapsed = (this.time.now - phaseStart) / 5000; // 5s intervals
                    const dmgMult = 1 + Math.floor(elapsed) * 0.5; // +50% per 5s
                    this._spawnVoidRipple(fg.x, fg.y, 6, 80, 12 * this.damageScaling * dmgMult, false);
                }
            });
        }

        // Orbit update
        const orbitTimer = this.time.addEvent({
            delay: 30, loop: true,
            callback: () => {
                const speedBoost = fragGfxList.reduce((max, fg) => Math.max(max, fg._orbitSpeedBoost || 0), 0);
                fragAngle += 0.018 + speedBoost;
                fragGfxList.forEach((fg, i) => {
                    if (!fg._alive) return;
                    const a = fragAngle + (i / fragCount) * Math.PI * 2;
                    fg.x = cx + Math.cos(a) * ORBIT_R;
                    fg.y = cy + Math.sin(a) * ORBIT_R;
                    // Update health bar position and width
                    if (fg._hpBg?.active)   { fg._hpBg.x   = fg.x; fg._hpBg.y   = fg.y - 22; }
                    if (fg._hpFill?.active && tempEnemies?.[i]) {
                        const pct = Math.max(0, tempEnemies[i].health / tempEnemies[i].maxHealth);
                        fg._hpFill.x = fg.x - 14 + (28 * pct) / 2; // left-align origin adjustment
                        fg._hpFill.y = fg.y - 22;
                        fg._hpFill.width = 28 * pct;
                        const col = pct > 0.6 ? 0xcc44ff : pct > 0.3 ? 0xff8800 : 0xff2222;
                        fg._hpFill.setFillStyle(col);
                    }
                    // Hit detection vs player
                    const dx = this.player.x - fg.x, dy = this.player.y - fg.y;
                    if (Math.sqrt(dx*dx + dy*dy) < this.TILE_SIZE * 1.2) {
                        this.takeDamage(15 * this.damageScaling);
                    }
                });
            }
        });

        // Fragment hit detection — check if player's projectiles hit them
        // We expose them to the damage system via enemies array temporarily
        const tempEnemies = fragGfxList.map((fg, i) => {
            const te = {
                x: Math.floor(cx / this.TILE_SIZE), y: Math.floor(cy / this.TILE_SIZE),
                sprite: fg, health: 1, maxHealth: 1,
                healthBarBg: null, healthBarFill: null,
                isFrozen: false, frozenUntil: 0, frozenByTsunami: false,
                isSlowed: false, slowedUntil: 0, lastMoveTime: 0,
                isStunned: false, stunnedUntil: 0, brittleStacks: 0,
                isBurning: false, burnUntil: 0, lastBurnTick: 0, burnVisual: null,
                isSuperConducted: false, superConductUntil: 0, superConductVisual: null,
                combustionTriggered: false, cosmicMarks: 0, cosmicMarkVisuals: null,
                _fragmentIndex: i, isFragment: true,
            };
            this.enemies.push(te);
            return te;
        });

        // Helper: destroy all lingering marks on a fragment temp enemy
        const cleanFragMarks = (te) => {
            ['_purpleMarkVisual', '_shatterMarkVisual', '_goldMark', '_purpleMark',
             '_fireMark', '_iceMark', '_lightningMark', '_voidMark'].forEach(k => {
                if (te[k]?.active) { this.tweens?.killTweensOf(te[k]); te[k].destroy(); te[k] = null; }
            });
            if (te.freezeVisuals) {
                if (te.freezeVisuals._extraLayers) { for (const l of te.freezeVisuals._extraLayers) { this.tweens?.killTweensOf(l); l.destroy(); } }
                ['iceBlock','iceBorder'].forEach(k => { if (te.freezeVisuals[k]) { this.tweens?.killTweensOf(te.freezeVisuals[k]); te.freezeVisuals[k].destroy(); } });
                te.freezeVisuals = null;
            }
            if (te._chillBar) { for (const d of te._chillBar) { if (d?.active) d.destroy(); } te._chillBar = null; }
        };

        const checkFragmentsDead = () => {
            fragsAlive--;
            if (fragsAlive <= 0) {
                escalateTimer.remove();
                // All fragments destroyed — reassemble boss
                orbitTimer.remove();
                fragGfxList.forEach(fg => {
                    if (fg._rippleTimer) fg._rippleTimer.remove();
                    if (fg._hpBg?.active)   fg._hpBg.destroy();
                    if (fg._hpFill?.active) fg._hpFill.destroy();
                    fg.destroy();
                });
                tempEnemies.forEach(te => {
                    cleanFragMarks(te);
                    const idx = this.enemies.indexOf(te);
                    if (idx !== -1) this.enemies.splice(idx, 1);
                });
                boss.container.setVisible(true);
                boss._isInvulnerable = false;
                // Vulnerable window — 4s of 2× damage
                boss._vulnerableUntil = this.time.now + 4000;
                this.showStatusText(boss.container.x, boss.container.y - 80, '💥 VULNERABLE! 2× DAMAGE', '#ff4444');
                const vFlash = this.add.circle(boss.container.x, boss.container.y, 8, 0xff4444, 0.5).setDepth(5);
                this.tweens.add({ targets:vFlash, radius:60, alpha:0, duration:400, onComplete:()=>vFlash.destroy() });
                this.time.delayedCall(4500, () => this._voidSovereignNextAttack());
            }
        };

        // Watch fragment health via update
        const watchTimer = this.time.addEvent({
            delay: 100, loop: true,
            callback: () => {
                tempEnemies.forEach((te, i) => {
                    if (!fragGfxList[i]._alive) return;
                    if (te.health <= 0) {
                        fragGfxList[i]._alive = false;
                        if (fragGfxList[i]._rippleTimer) fragGfxList[i]._rippleTimer.remove();
                        this.tweens.killTweensOf(fragGfxList[i]);
                        if (fragGfxList[i]._hpBg?.active)   fragGfxList[i]._hpBg.destroy();
                        if (fragGfxList[i]._hpFill?.active) fragGfxList[i]._hpFill.destroy();
                        fragGfxList[i].destroy();
                        cleanFragMarks(te);
                        const idx = this.enemies.indexOf(te);
                        if (idx !== -1) this.enemies.splice(idx, 1);
                        checkFragmentsDead();
                    }
                });
                if (fragsAlive <= 0) watchTimer.remove();
            }
        });
    }

    _vsAttackStomp() {
        const boss = this.voidSovereignBoss;
        this.showStatusText(boss.container.x, boss.container.y - 80, '⬆ STOMP INCOMING', '#ff4444');

        // Pause the idle bob tween so it doesn't fight over container.y during the stomp sequence
        if (boss._idleBobTween) boss._idleBobTween.pause();

        // Boss flies up (scale down + fade)
        this.tweens.add({ targets:boss.container, scaleY:0.1, alpha:0.1, duration:600, ease:'Quad.easeIn' });

        this.time.delayedCall(700, () => {
            if (!boss.active) return;
            boss.container.setVisible(false);

            // Tracking circle follows player
            const trackGfx = this.add.graphics().setDepth(4.5);
            const TRACK_DUR = 2500;
            const startTime = this.time.now;
            let circleX = this.player.x, circleY = this.player.y;

            const trackTimer = this.time.addEvent({
                delay: 30, loop: true,
                callback: () => {
                    const elapsed = this.time.now - startTime;
                    if (elapsed >= TRACK_DUR) { trackTimer.remove(); return; }
                    // Snap to player's tile centre for accurate targeting
                    circleX = this.playerX * this.TILE_SIZE + this.TILE_SIZE / 2;
                    circleY = this.playerY * this.TILE_SIZE + this.TILE_SIZE / 2;
                    trackGfx.clear();
                    trackGfx.lineStyle(3, 0xff2200, 0.85); trackGfx.strokeCircle(circleX, circleY, 2.5 * this.TILE_SIZE);
                    trackGfx.lineStyle(1, 0xff6600, 0.50); trackGfx.strokeCircle(circleX, circleY, 1.5 * this.TILE_SIZE);
                    // Crosshair lines
                    trackGfx.lineStyle(1.5, 0xff2200, 0.70);
                    trackGfx.beginPath(); trackGfx.moveTo(circleX - 3*this.TILE_SIZE, circleY); trackGfx.lineTo(circleX + 3*this.TILE_SIZE, circleY); trackGfx.strokePath();
                    trackGfx.beginPath(); trackGfx.moveTo(circleX, circleY - 3*this.TILE_SIZE); trackGfx.lineTo(circleX, circleY + 3*this.TILE_SIZE); trackGfx.strokePath();
                }
            });

            // After tracking, pause — escape window
            this.time.delayedCall(TRACK_DUR, () => {
                if (!boss.active) return;
                trackTimer.remove();
                const finalX = circleX, finalY = circleY;
                // Flash the circle rapidly — escape window 0.8s
                let flashing = true;
                const escapeFlash = this.time.addEvent({ delay:80, repeat:10, callback: () => trackGfx.setVisible(!trackGfx.visible) });
                this.showStatusText(finalX, finalY - 40, 'MOVE!', '#ff2200');

                this.time.delayedCall(800, () => {
                    escapeFlash.remove(); trackGfx.destroy();
                    if (!boss.active) return;

                    // STOMP — land exactly where the circle was
                    boss.container.setVisible(true);
                    boss.container.x = finalX;
                    boss.container.y = finalY + (this.SLIME_Y_OFFSET || -10);
                    boss.container.scaleY = 0.1; boss.container.alpha = 1;
                    this.tweens.add({ targets:boss.container, scaleY:1, duration:220, ease:'Bounce.easeOut' });
                    this.cameras.main.shake(180, 0.018);

                    const stompRing = this.add.circle(finalX, finalY, 8, 0xff2200, 0.7).setDepth(5);
                    stompRing.setStrokeStyle(4, 0xff6600, 1);
                    this.tweens.add({ targets:stompRing, radius:4*this.TILE_SIZE, alpha:0, duration:400, onComplete:()=>stompRing.destroy() });

                    // Damage player if nearby
                    const dx = this.player.x - finalX, dy = this.player.y - finalY;
                    if (Math.sqrt(dx*dx + dy*dy) <= 2.5 * this.TILE_SIZE) {
                        this.takeDamage(40 * this.damageScaling);
                        this._rootPlayer(2000, this.time.now);
                    }

                    // Boss returns to original position
                    this.time.delayedCall(600, () => {
                        const bossSpawn = this.rooms[6];
                        const homeX = (bossSpawn.x + bossSpawn.w/2) * this.TILE_SIZE;
                        const homeY = boss._baseY; // use the stored home Y (matches idle bob anchor exactly)
                        this.tweens.add({
                            targets: boss.container, x: homeX, y: homeY, duration: 700, ease: 'Quad.easeOut',
                            onComplete: () => {
                                if (boss._idleBobTween) boss._idleBobTween.resume();
                            }
                        });
                        this.time.delayedCall(1200, () => this._voidSovereignNextAttack());
                    });
                });
            });
        });
    }

    // ── VOID MAW — boss sinks into a giant portal, reappears flanking the player, ──
    // ── then unleashes a wide shotgun wave of ricocheting pellets ───────────────
    // Void Maw — boss teleports via portal 4 times in one attack, firing an all-around
    // burst at each landing spot. First hop is slow/telegraphed; hops 2-4 ramp up faster.
    _vsAttackVoidMaw() {
        const boss = this.voidSovereignBoss;
        this.showStatusText(boss.container.x, boss.container.y - 80, '◉ VOID MAW OPENING', '#cc44ff');
        if (boss._idleBobTween) boss._idleBobTween.pause();
        this._voidMawHop(boss, 0, boss.container.x, boss.container.y);
    }

    // Performs one teleport-and-fire hop, then either chains to the next hop or returns
    // the boss home after the final one. hopIndex 0 = first (slow) hop, 1-3 = faster hops.
    _voidMawHop(boss, hopIndex, fromX, fromY) {
        const TOTAL_HOPS = 4;
        if (!boss?.active) return;

        // Timing ramps up after the first hop — shorter telegraphs, more pressure
        const isFirst = hopIndex === 0;
        const PORTAL_OPEN_DUR = isFirst ? 1400 : 700;
        const TRAVEL_PAUSE    = isFirst ? 900  : 450;
        const ARRIVE_OPEN_DUR = isFirst ? 900  : 500;
        const RETURN_PAUSE_AFTER_FIRE = isFirst ? 900 : 550;

        const PORTAL_R = 1.6 * this.TILE_SIZE;

        // ── Sink portal at current position ──
        const portalGfx = this.add.graphics().setDepth(2.0);
        portalGfx.x = fromX; portalGfx.y = fromY;
        let portalAngle = 0;
        const drawGiantPortal = (scale) => {
            portalGfx.clear();
            const r = PORTAL_R * scale;
            portalGfx.lineStyle(5, 0xcc44ff, 0.85); portalGfx.strokeCircle(0, 0, r);
            for (let i = 0; i < 10; i++) {
                const a = portalAngle + (i / 10) * Math.PI * 2;
                portalGfx.lineStyle(2, 0xee88ff, 0.50);
                portalGfx.beginPath(); portalGfx.moveTo(0, 0); portalGfx.lineTo(Math.cos(a) * r * 0.6, Math.sin(a) * r * 0.6); portalGfx.strokePath();
            }
            portalGfx.fillStyle(0x110022, 0.92); portalGfx.fillCircle(0, 0, r * 0.55);
            portalGfx.fillStyle(0xcc44ff, 0.55); portalGfx.fillCircle(0, 0, r * 0.22);
        };
        drawGiantPortal(0.05);
        const portalSpinTimer = this.time.addEvent({ delay: 30, loop: true, callback: () => { portalAngle += 0.04; } });

        const openStart = this.time.now;
        const portalGrowTimer = this.time.addEvent({
            delay: 30, loop: true,
            callback: () => {
                const t = Math.min((this.time.now - openStart) / PORTAL_OPEN_DUR, 1);
                drawGiantPortal(0.05 + t * 0.95);
                if (t >= 1) portalGrowTimer.remove();
            }
        });

        this.tweens.add({ targets: boss.container, scaleX: 0.15, scaleY: 0.15, alpha: 0.15, duration: PORTAL_OPEN_DUR, ease: 'Quad.easeIn' });

        this.time.delayedCall(PORTAL_OPEN_DUR + 150, () => {
            if (!boss.active) { portalSpinTimer.remove(); portalGfx.destroy(); return; }
            boss.container.setVisible(false);

            this.tweens.add({
                targets: portalGfx, scaleX: 0.05, scaleY: 0.05, alpha: 0, duration: 400, ease: 'Quad.easeIn',
                onComplete: () => { portalSpinTimer.remove(); portalGfx.destroy(); }
            });

            // ── Travel beneath the arena ──
            this.time.delayedCall(TRAVEL_PAUSE, () => {
                if (!boss.active) return;

                // Pick a new flanking tile near the player (re-rolled every hop)
                const flanks = [];
                for (let ddx = -3; ddx <= 3; ddx++) {
                    for (let ddy = -3; ddy <= 3; ddy++) {
                        const md = Math.abs(ddx) + Math.abs(ddy);
                        if (md < 2 || md > 3) continue;
                        const tx2 = this.playerX + ddx, ty2 = this.playerY + ddy;
                        if (tx2 < 0 || tx2 >= this.WORLD_WIDTH || ty2 < 0 || ty2 >= this.WORLD_HEIGHT) continue;
                        if (this.world[tx2][ty2] !== this.FLOOR) continue;
                        if (!this.isInCurrentRoom(tx2, ty2)) continue;
                        flanks.push({ x: tx2, y: ty2 });
                    }
                }
                let pick = flanks.length ? flanks[Math.floor(Math.random() * flanks.length)] : { x: this.playerX, y: this.playerY };
                const wx = pick.x * this.TILE_SIZE + this.TILE_SIZE / 2;
                const wy = pick.y * this.TILE_SIZE + this.TILE_SIZE / 2 + (this.SLIME_Y_OFFSET || -10);

                // Re-open the giant portal at the new position
                const arrivePortal = this.add.graphics().setDepth(2.0);
                arrivePortal.x = wx; arrivePortal.y = wy;
                let arriveAngle = 0;
                const drawArrivePortal = (scale) => {
                    arrivePortal.clear();
                    const r = PORTAL_R * scale;
                    arrivePortal.lineStyle(5, 0xcc44ff, 0.85); arrivePortal.strokeCircle(0, 0, r);
                    for (let i = 0; i < 10; i++) {
                        const a = arriveAngle + (i / 10) * Math.PI * 2;
                        arrivePortal.lineStyle(2, 0xee88ff, 0.50);
                        arrivePortal.beginPath(); arrivePortal.moveTo(0, 0); arrivePortal.lineTo(Math.cos(a) * r * 0.6, Math.sin(a) * r * 0.6); arrivePortal.strokePath();
                    }
                    arrivePortal.fillStyle(0x110022, 0.92); arrivePortal.fillCircle(0, 0, r * 0.55);
                    arrivePortal.fillStyle(0xcc44ff, 0.55); arrivePortal.fillCircle(0, 0, r * 0.22);
                };
                drawArrivePortal(0.05);
                const arriveSpinTimer = this.time.addEvent({ delay: 30, loop: true, callback: () => { arriveAngle += 0.04; } });

                this.showStatusText(wx, wy - 70, hopIndex < TOTAL_HOPS - 1 ? `⚠ MAW SURFACING (${hopIndex + 1}/${TOTAL_HOPS})` : '⚠ MAW SURFACING — FINAL', '#ff2200');

                const arriveOpenStart = this.time.now;
                const arriveGrowTimer = this.time.addEvent({
                    delay: 30, loop: true,
                    callback: () => {
                        const t = Math.min((this.time.now - arriveOpenStart) / ARRIVE_OPEN_DUR, 1);
                        drawArrivePortal(0.05 + t * 0.95);
                        if (t >= 1) arriveGrowTimer.remove();
                    }
                });

                this.time.delayedCall(ARRIVE_OPEN_DUR, () => {
                    if (!boss.active) { arriveSpinTimer.remove(); arrivePortal.destroy(); return; }

                    boss.container.x = wx; boss.container.y = wy;
                    boss.container.setVisible(true);
                    boss.container.scaleX = 0.1; boss.container.scaleY = 0.1; boss.container.alpha = 1;
                    this.tweens.add({ targets: boss.container, scaleX: 1, scaleY: 1, duration: 300, ease: 'Back.easeOut' });
                    this.cameras.main.shake(100, 0.010);

                    this.tweens.add({
                        targets: arrivePortal, scaleX: 0.05, scaleY: 0.05, alpha: 0, duration: 350, ease: 'Quad.easeIn',
                        onComplete: () => { arriveSpinTimer.remove(); arrivePortal.destroy(); }
                    });

                    // ── All-around burst — fires in every direction, not aimed at the player ──
                    this.time.delayedCall(250, () => {
                        if (!boss.active) return;
                        this._fireVoidMawShotgun(boss);

                        const nextHop = hopIndex + 1;
                        this.time.delayedCall(RETURN_PAUSE_AFTER_FIRE, () => {
                            if (!boss.active) return;
                            if (nextHop < TOTAL_HOPS) {
                                // Chain to the next hop from this landing spot
                                this._voidMawHop(boss, nextHop, boss.container.x, boss.container.y);
                            } else {
                                // Final hop done — return home
                                const bossSpawn = this.rooms[6];
                                const returnHomeX = (bossSpawn.x + bossSpawn.w / 2) * this.TILE_SIZE;
                                const returnHomeY = boss._baseY;
                                this.tweens.add({
                                    targets: boss.container, x: returnHomeX, y: returnHomeY, duration: 700, ease: 'Quad.easeOut',
                                    onComplete: () => { if (boss._idleBobTween) boss._idleBobTween.resume(); }
                                });
                                this.time.delayedCall(1200, () => this._voidSovereignNextAttack());
                            }
                        });
                    });
                });
            });
        });
    }

    // All-around burst fired by Void Maw — pellets spread across the FULL 360°,
    // not aimed at the player, so positioning around the boss matters at every landing.
    _fireVoidMawShotgun(boss) {
        const ex = boss.container.x, ey = boss.container.y;
        const PELLETS = 16;
        const SPEED = 230; // medium speed, dodgeable
        const DAMAGE = 11;
        const MAX_DIST = this.TILE_SIZE * 9;

        // Big muzzle flash
        const flash = this.add.graphics().setDepth(4);
        flash.x = ex; flash.y = ey;
        flash.fillStyle(0xcc44ff, 0.85); flash.fillCircle(0, 0, 26);
        flash.lineStyle(3, 0xffffff, 0.90); flash.strokeCircle(0, 0, 34);
        this.tweens.add({ targets: flash, scaleX: 2.2, scaleY: 2.2, alpha: 0, duration: 240, ease: 'Quad.easeOut', onComplete: () => flash.destroy() });
        this.cameras.main.shake(70, 0.008);

        if (!this.enemyProjectiles) this.enemyProjectiles = [];

        for (let i = 0; i < PELLETS; i++) {
            const angle = (i / PELLETS) * Math.PI * 2; // even spread, full circle
            const vx = Math.cos(angle) * SPEED;
            const vy = Math.sin(angle) * SPEED;

            const g = this.add.graphics().setDepth(2.8);
            g.lineStyle(3, 0xdd66ff, 1);
            g.beginPath();
            g.moveTo(-Math.cos(angle) * 6, -Math.sin(angle) * 6);
            g.lineTo( Math.cos(angle) * 6,  Math.sin(angle) * 6);
            g.strokePath();
            g.fillStyle(0xffffff, 0.9); g.fillCircle(0, 0, 3);
            g.x = ex; g.y = ey;

            this.enemyProjectiles.push({
                gfx: g, vx, vy, damage: DAMAGE * (this.damageScaling || 1),
                startX: ex, startY: ey, maxDist: MAX_DIST,
                isRicochetArrow: true, ricochetLeft: 5,
            });
        }
    }

    _vsAttackSingularityCollapse() {
        const boss = this.voidSovereignBoss;
        boss._isInvulnerable = true;
        const _bossOrigDepth = boss.container.depth;
        this.showStatusText(boss.container.x, boss.container.y - 80, '◉ SINGULARITY COLLAPSE', '#220044');
        this.cameras.main.shake(40, 0.004);

        const bossRoom = this.rooms[6];
        const cx = (bossRoom.x + bossRoom.w / 2) * this.TILE_SIZE;
        const cy = (bossRoom.y + bossRoom.h / 2) * this.TILE_SIZE;
        const centerTX = Math.floor(cx / this.TILE_SIZE);
        const centerTY = Math.floor(cy / this.TILE_SIZE);

        // Full screen darkness — fades in ominously, held until collapse. Covers player/enemies
        // (depth ~1) but NOT the boss itself, which is lifted above the overlay so it stays
        // visible — the void sovereign is the source of the dark, not a victim of it.
        const dark = this.add.rectangle(this.scale.width/2, this.scale.height/2,
            this.scale.width, this.scale.height, 0x000000, 1).setScrollFactor(0).setDepth(15).setAlpha(0);
        this.tweens.add({ targets: dark, alpha: 0.72, duration: 2000, ease: 'Quad.easeIn' });
        boss.container.setDepth(16);

        // Inward-sucking particles — intensify exponentially as collapse nears
        const COLLAPSE_DURATION = 9000; // total time before the killing collapse fires
        const particleInterval = this.time.addEvent({
            delay: 200, loop: true,
            callback: () => {
                if (!boss?.active) return;
                const elapsed = this.time.now - collapseStartTime;
                const tLin = Math.min(elapsed / COLLAPSE_DURATION, 1);
                const t = Math.pow(tLin, 3); // cubic — stays mild early, ramps hard late
                // More particles + faster travel as we near collapse
                const count = Math.floor(2 + t * 10);
                const travelDur = Math.max(250, 1200 - t * 950);
                for (let i = 0; i < count; i++) {
                    const a = Math.random() * Math.PI * 2;
                    const r = 4 * this.TILE_SIZE + Math.random() * 6 * this.TILE_SIZE;
                    const pg = this.add.graphics().setDepth(16);
                    const col = t > 0.6 ? 0xff44ff : 0xcc44ff;
                    pg.fillStyle(col, 0.70 + t * 0.25);
                    pg.fillCircle(0, 0, 2 + Math.random() * 3 + t * 2);
                    pg.x = cx + Math.cos(a) * r; pg.y = cy + Math.sin(a) * r;
                    this.tweens.add({ targets: pg, x: cx, y: cy, alpha: 0, duration: travelDur, ease: 'Quad.easeIn', onComplete: () => pg.destroy() });
                }
            }
        });
        const collapseStartTime = this.time.now;

        // ── Gradual player suck — starts slow, accelerates EXPONENTIALLY over the duration ──
        // Moves player toward center periodically; interval shrinks exponentially, and the
        // distance pulled per tick also grows late in the sequence for a true "falling in" feel.
        // LOS check each tick — walls block the pull.
        let _suckTimer = null;
        const _scheduleNextSuck = (delay) => {
            _suckTimer = this.time.delayedCall(delay, () => {
                if (!boss?.active) return;
                const elapsed = this.time.now - collapseStartTime;
                if (elapsed >= COLLAPSE_DURATION) return; // collapse fires, stop gradual suck

                // LOS check — wall blocks pull
                const playerPx = this.player.x, playerPy = this.player.y;
                const dxC = cx - playerPx, dyC = cy - playerPy;
                const steps = Math.ceil(Math.sqrt(dxC*dxC + dyC*dyC) / (this.TILE_SIZE * 0.5));
                let blocked = false;
                for (let s = 1; s <= steps; s++) {
                    const t2 = s / steps;
                    const checkX = Math.floor((playerPx + dxC * t2) / this.TILE_SIZE);
                    const checkY = Math.floor((playerPy + dyC * t2) / this.TILE_SIZE);
                    if (this.world[checkX]?.[checkY] === this.WALL) { blocked = true; break; }
                }

                const tLin = Math.min(elapsed / COLLAPSE_DURATION, 1);
                const t = Math.pow(tLin, 3); // matches particle ramp — mild early, brutal late

                if (!blocked) {
                    // Pull distance grows from 1 tile up to 3 tiles per tick as collapse nears
                    const pullTiles = Math.max(1, Math.round(1 + t * 2));
                    const ddx = centerTX - this.playerX;
                    const ddy = centerTY - this.playerY;
                    const dist = Math.sqrt(ddx*ddx + ddy*ddy);
                    if (dist > 1.5) { // don't pull if already at center
                        const stepX = ddx !== 0 ? Math.sign(ddx) : 0;
                        const stepY = ddy !== 0 ? Math.sign(ddy) : 0;
                        // Prefer the dominant axis each step, walking up to pullTiles tiles,
                        // stopping early if a wall blocks further movement along the path.
                        let nx = this.playerX, ny = this.playerY;
                        for (let p = 0; p < pullTiles; p++) {
                            const moveX = Math.abs(ddx) >= Math.abs(ddy) ? stepX : 0;
                            const moveY = Math.abs(ddy) > Math.abs(ddx) ? stepY : 0;
                            const tryX = nx + moveX, tryY = ny + moveY;
                            if (this.world[tryX]?.[tryY] !== this.FLOOR) break;
                            nx = tryX; ny = tryY;
                            if (nx === centerTX && ny === centerTY) break;
                        }
                        if (nx !== this.playerX || ny !== this.playerY) {
                            this.playerX = nx;
                            this.playerY = ny;
                            const npx = nx * this.TILE_SIZE + this.TILE_SIZE / 2;
                            const npy = ny * this.TILE_SIZE + this.TILE_SIZE / 2;
                            this.tweens.add({ targets: this.player, x: npx, y: npy, duration: Math.max(90, 180 - t * 90), ease: 'Quad.easeOut' });
                        }
                    }
                }

                // Acceleration: interval shrinks exponentially from 1100ms → 150ms
                const nextDelay = 1100 * Math.pow(150 / 1100, t);
                _scheduleNextSuck(nextDelay);
            });
        };
        _scheduleNextSuck(1100); // first pull after 1.1s — gives player a moment to react

        // Warning text
        this.time.delayedCall(Math.round(COLLAPSE_DURATION * 0.2), () => {
            if (!boss.active) return;
            this.showStatusText(cx, cy - 80, '⚠ FIND COVER ⚠', '#ff2200');
        });
        this.time.delayedCall(Math.round(COLLAPSE_DURATION * 0.45), () => {
            if (!boss.active) return;
            this.showStatusText(cx, cy - 80, '◉ THE PULL INTENSIFIES', '#9922cc');
            this.cameras.main.shake(60, 0.006);
        });
        this.time.delayedCall(Math.round(COLLAPSE_DURATION * 0.75), () => {
            if (!boss.active) return;
            this.showStatusText(cx, cy - 80, '◉ COLLAPSE IMMINENT', '#9922cc');
            this.cameras.main.shake(80, 0.008);
        });

        // COLLAPSE at the end of the duration — instant suck + 1HP
        this.time.delayedCall(COLLAPSE_DURATION, () => {
            if (!boss.active) return;
            if (_suckTimer) { _suckTimer.remove(); _suckTimer = null; }
            particleInterval.remove();

            this.cameras.main.shake(300, 0.025);

            // Suck all enemies to center and kill them
            for (let i = this.enemies.length - 1; i >= 0; i--) {
                const e = this.enemies[i];
                if (!e.sprite?.active) continue;
                this.tweens.add({
                    targets: e.sprite,
                    x: cx, y: cy,
                    duration: 400, ease: 'Quad.easeIn',
                    onComplete: () => { if (e.sprite?.active) this.killEnemy(e); }
                });
            }

            // Final LOS check for the killing blow
            const playerPx = this.player.x, playerPy = this.player.y;
            const dxC = cx - playerPx, dyC = cy - playerPy;
            const steps = Math.ceil(Math.sqrt(dxC*dxC + dyC*dyC) / (this.TILE_SIZE * 0.5));
            let blocked = false;
            for (let s = 1; s <= steps; s++) {
                const t = s / steps;
                const checkX = Math.floor((playerPx + dxC * t) / this.TILE_SIZE);
                const checkY = Math.floor((playerPy + dyC * t) / this.TILE_SIZE);
                if (this.world[checkX]?.[checkY] === this.WALL) { blocked = true; break; }
            }

            if (!blocked) {
                // Instant suck to center + 1HP
                this.tweens.add({
                    targets: this.player,
                    x: cx, y: cy,
                    duration: 500, ease: 'Quad.easeIn',
                    onComplete: () => {
                        this.playerX = Math.floor(cx / this.TILE_SIZE);
                        this.playerY = Math.floor(cy / this.TILE_SIZE);
                    }
                });
                const dmg = Math.max(0, this.health - 1);
                if (dmg > 0) this.takeDamage(dmg);
                this.showStatusText(cx, cy - 60, '💀 CAUGHT!', '#ff0000');
                this._rootPlayer(2000, this.time.now);
            } else {
                this.showStatusText(playerPx, playerPy - 30, '🛡 BLOCKED!', '#44ff88');
            }

            // Flash and lift darkness
            const flash = this.add.rectangle(this.scale.width/2, this.scale.height/2,
                this.scale.width, this.scale.height, 0xffffff, 0.80).setScrollFactor(0).setDepth(40);
            this.tweens.add({ targets: flash, alpha: 0, duration: 600, onComplete: () => flash.destroy() });
            this.tweens.add({ targets: dark, alpha: 0, duration: 1200, onComplete: () => dark.destroy() });
            boss.container.setDepth(_bossOrigDepth);

            boss._isInvulnerable = false;
            this.time.delayedCall(2000, () => this._voidSovereignNextAttack());
        });
    }

    _vsAttackEventHorizon() {
        const boss = this.voidSovereignBoss;
        const DURATION = 7000;
        boss._isInvulnerable = true;
        boss._eventHorizonActive = true;
        this.showStatusText(boss.container.x, boss.container.y - 80, '🌑 EVENT HORIZON', '#110022');
        this.cameras.main.shake(40, 0.005);

        const startTime = this.time.now;
        const RING_START_R = 2.8 * this.TILE_SIZE;
        const RING_END_R = 1.6 * this.TILE_SIZE; // the safe radius shrinks toward this over the duration

        // Spinning reflective void ring around boss — radius slowly contracts over DURATION
        const ringGfx = this.add.graphics().setDepth(4.5);
        let ringAngle = 0;
        let currentRingR = RING_START_R;
        const drawRing = () => {
            ringGfx.clear();
            ringGfx.lineStyle(8, 0x220044, 0.80); ringGfx.strokeCircle(boss.container.x, boss.container.y, currentRingR);
            for (let i = 0; i < 8; i++) {
                const a1 = ringAngle + (i / 8) * Math.PI * 2;
                const a2 = a1 + 0.4;
                ringGfx.lineStyle(3, i % 2 === 0 ? 0xcc44ff : 0xffffff, 0.90);
                ringGfx.beginPath();
                ringGfx.arc(boss.container.x, boss.container.y, currentRingR, a1, a2, false);
                ringGfx.strokePath();
                ringGfx.fillStyle(0xffffff, 0.70);
                ringGfx.fillCircle(
                    boss.container.x + Math.cos(a1) * currentRingR,
                    boss.container.y + Math.sin(a1) * currentRingR, 2.5
                );
            }
        };
        const ringTimer = this.time.addEvent({
            delay: 25, loop: true,
            callback: () => {
                ringAngle += 0.06;
                const t = Math.min((this.time.now - startTime) / DURATION, 1);
                currentRingR = RING_START_R - (RING_START_R - RING_END_R) * t;
                drawRing();
            }
        });

        // ── Reflective pulse — fires outward periodically. Standing inside the pulse's
        // ── radius when it fires gets you knocked back and damaged ("reflected").
        const firePulse = () => {
            if (!boss._eventHorizonActive) return;
            const px = boss.container.x, py = boss.container.y;
            const pulseGfx = this.add.graphics().setDepth(4.4);
            const PULSE_MAX = 6 * this.TILE_SIZE;
            const PULSE_DUR = 550;
            const pulseStart = this.time.now;
            this.cameras.main.shake(20, 0.003);
            const pulseTimer = this.time.addEvent({
                delay: 16, loop: true,
                callback: () => {
                    const pt = (this.time.now - pulseStart) / PULSE_DUR;
                    if (pt >= 1) { pulseGfx.destroy(); pulseTimer.remove(); return; }
                    const r = currentRingR + pt * (PULSE_MAX - currentRingR);
                    pulseGfx.clear();
                    pulseGfx.lineStyle(5, 0xcc44ff, 0.85 * (1 - pt));
                    pulseGfx.strokeCircle(px, py, r);
                    pulseGfx.lineStyle(2, 0xffffff, 0.6 * (1 - pt));
                    pulseGfx.strokeCircle(px, py, r);

                    // Catch the player if the expanding ring sweeps through their position
                    const dist = Math.hypot(this.player.x - px, this.player.y - py);
                    if (!boss._pulseHitThisCycle && Math.abs(dist - r) < this.TILE_SIZE * 0.6) {
                        boss._pulseHitThisCycle = true;
                        this.takeDamage(12 * (this.damageScaling || 1));
                        this.showStatusText(this.player.x, this.player.y - 28, 'REFLECTED!', '#cc44ff');
                        // Knockback away from the boss
                        const dx = this.player.x - px, dy = this.player.y - py;
                        const dlen = Math.hypot(dx, dy) || 1;
                        const knockDist = this.TILE_SIZE * 1.5;
                        let nx = this.player.x + (dx / dlen) * knockDist;
                        let ny = this.player.y + (dy / dlen) * knockDist;
                        const ntx = Math.floor(nx / this.TILE_SIZE), nty = Math.floor(ny / this.TILE_SIZE);
                        if (this.world[ntx]?.[nty] === this.FLOOR) {
                            this.tweens.add({ targets: this.player, x: nx, y: ny, duration: 200, ease: 'Quad.easeOut' });
                            this.playerX = ntx; this.playerY = nty;
                        }
                    }
                }
            });
        };

        const pulseInterval = this.time.addEvent({
            delay: 1500, loop: true,
            callback: () => {
                if (!boss._eventHorizonActive) return;
                boss._pulseHitThisCycle = false;
                firePulse();
            }
        });

        // Show immunity/warning text periodically
        const immuneTimer = this.time.addEvent({ delay:1800, loop:true, callback:() => {
            if (!boss._eventHorizonActive) return;
            this.showStatusText(boss.container.x, boss.container.y - 60, 'PROJECTILES REFLECTED — STAY MOBILE', '#cc44ff');
        }});

        this.time.delayedCall(DURATION, () => {
            ringTimer.remove(); immuneTimer.remove(); pulseInterval.remove();
            ringGfx.destroy();
            boss._eventHorizonActive = false;
            boss._isInvulnerable = false;
            this._voidSovereignNextAttack();
        });
    }

    _voidSovereignPhase2Transition() {
        const boss = this.voidSovereignBoss;
        this.showStatusText(boss.container.x, boss.container.y - 80, '⚠ PHASE 2', '#ff4400');
        this.cameras.main.shake(200, 0.015);

        // Destroy corner pillars
        const bossRoom = this.rooms[6];
        const pillarPositions = [[6,59],[24,59],[6,74],[24,74]];
        for (const [px, py] of pillarPositions) {
            for (let dx = 0; dx <= 1; dx++) for (let dy = 0; dy <= 1; dy++) {
                if (this.world[px+dx]?.[py+dy] === this.WALL) {
                    this.world[px+dx][py+dy] = this.FLOOR;
                    // Visual: rubble flash
                    const rx = (px+dx) * this.TILE_SIZE + this.TILE_SIZE/2;
                    const ry = (py+dy) * this.TILE_SIZE + this.TILE_SIZE/2;
                    const rg = this.add.rectangle(rx, ry, this.TILE_SIZE, this.TILE_SIZE, 0x664422, 1).setDepth(0.5);
                    this.tweens.add({ targets:rg, alpha:0, duration:400, onComplete:()=>rg.destroy() });
                }
            }
        }
        boss._pillarsDestroyed = true;
        // Redraw walls
        if (typeof this.renderWalls === 'function') this.renderWalls();
    }

    _spawnVoidRipple(ox, oy, count, speed, damage, slowsPlayer) {
        for (let i = 0; i < count; i++) {
            const angle = (i / count) * Math.PI * 2;
            const g = this.add.graphics().setDepth(2.5);
            g.x = ox; g.y = oy;
            g.fillStyle(0x9922cc, 0.75); g.fillCircle(0, 0, 5);
            g.lineStyle(1.5, 0xcc44ff, 0.60); g.strokeCircle(0, 0, 7);
            const vx = Math.cos(angle) * speed, vy = Math.sin(angle) * speed;
            // Manual movement
            const ripple = { gfx:g, vx, vy, damage, slowsPlayer, createdAt:this.time.now };
            if (!this._voidRipples) this._voidRipples = [];
            this._voidRipples.push(ripple);
        }
    }

    updateVoidRipples(delta) {
        if (!this._voidRipples) return;
        const ds = delta / 1000;
        for (let i = this._voidRipples.length - 1; i >= 0; i--) {
            const r = this._voidRipples[i];
            if (!r.gfx?.active) { this._voidRipples.splice(i, 1); continue; }
            r.gfx.x += r.vx * ds; r.gfx.y += r.vy * ds;
            // Lifetime check
            if (this.time.now - r.createdAt > 4000) { r.gfx.destroy(); this._voidRipples.splice(i, 1); continue; }
            // Wall check
            const tx = Math.floor(r.gfx.x / this.TILE_SIZE), ty = Math.floor(r.gfx.y / this.TILE_SIZE);
            if (this.world[tx]?.[ty] === this.WALL || !this.world[tx]) { r.gfx.destroy(); this._voidRipples.splice(i, 1); continue; }
            // Player hit
            const dx = this.player.x - r.gfx.x, dy = this.player.y - r.gfx.y;
            if (Math.sqrt(dx*dx + dy*dy) < this.TILE_SIZE * 0.9) {
                this.takeDamage(r.damage || 8);
                if (r.slowsPlayer) {
                    this.isSlowed = true;
                    this.slowedUntil = this.time.now + 3000;
                }
                r.gfx.destroy(); this._voidRipples.splice(i, 1);
            }
        }
    }

    damageVoidSovereignBoss(amount) {
        const boss = this.voidSovereignBoss;
        if (!boss?.active) return;
        if (boss._isInvulnerable) return;

        // Shatter if frozen — only the FIRST hit that shatters gets 2× and shows text
        if (boss._isFrozen) {
            const now = this.time.now;
            const alreadyShattering = boss._shatterStartedAt && now - boss._shatterStartedAt < 200;
            if (!alreadyShattering) {
                // First hit this shatter — mark it, show text, clear freeze visuals
                boss._shatterStartedAt = now;
                boss._isFrozen = false;
                boss._frozenUntil = 0;
                boss._freezeStacks = 0;
                if (boss._freezeTimer) { boss._freezeTimer.remove(); boss._freezeTimer = null; }
                if (boss._bossProxy?.freezeVisuals) {
                    const fv = boss._bossProxy.freezeVisuals;
                    if (fv._extraLayers) { for (const l of fv._extraLayers) { this.tweens.killTweensOf(l); l.destroy(); } fv._extraLayers = []; }
                    ['iceBlock', 'iceBorder'].forEach(k => {
                        if (fv[k]) { this.tweens.killTweensOf(fv[k]); fv[k].setVisible(false); fv[k].destroy(); }
                    });
                    boss._bossProxy.freezeVisuals = null;
                }
                boss._bossProxy  = null;
                boss._iceOverlay = null;
                boss._hitShards  = new Set();
                if (boss.body?.active) boss.body.setTint(0x6600aa); // restore base dark purple
                this.showStatusText(boss.container.x, boss.container.y - 75, 'SHATTER!', '#aaffff');
                this.cameras.main.shake(60, 0.006);
                amount *= 2;
            }
            // Subsequent shards in same frame get normal damage, no text
        }

        // 2× vulnerable window (dark fragments phase)
        const mult = (this.time.now < (boss._vulnerableUntil || 0)) ? 2.0 : 1.0;
        const finalDmg = amount * mult;
        boss.hp -= finalDmg;

        // Show damage number — deduplicate rapid hits with a cooldown
        const now2 = this.time.now;
        if (!boss._lastDmgNumTime || now2 - boss._lastDmgNumTime >= 60) {
            boss._lastDmgNumTime = now2;
            const col = mult > 1 ? '#ff4444' : boss._isFrozen ? '#aaffff' : '#cc88ff';
            this.showDamageNumber(boss.container.x + (Math.random()-0.5)*20, boss.container.y - 70, Math.round(finalDmg), col);
        }
        if (mult > 1) this.showStatusText(boss.container.x, boss.container.y - 60, `×2! ${Math.round(finalDmg)}`, '#ff4444');

        this.cameras.main.shake(25, 0.003);

        if (boss.hp <= 0) {
            boss.hp = 0;
            boss.active = false;
            this._voidSovereignDeath();
        }
    }

    _voidSovereignDeath() {
        const boss = this.voidSovereignBoss;
        this.cameras.main.shake(350, 0.025);

        // Clean up any surviving singularity slimes
        for (let i = this.enemies.length - 1; i >= 0; i--) {
            const e = this.enemies[i];
            if (e.isSingularitySlime) {
                if (e._singMark?.active) { this.tweens.killTweensOf(e._singMark); e._singMark.destroy(); }
                if (e._singWarningTiles) { for (const wg of e._singWarningTiles) { this.tweens.killTweensOf(wg); wg.destroy(); } }
                this.killEnemy(e);
            }
        }

        // Death explosion sequence
        for (let i = 0; i < 12; i++) {
            this.time.delayedCall(i * 120, () => {
                const a = Math.random() * Math.PI * 2;
                const r = 20 + Math.random() * 50;
                const ex = boss.container.x + Math.cos(a) * r;
                const ey = boss.container.y + Math.sin(a) * r;
                const eg = this.add.circle(ex, ey, 8, 0x9922cc, 0.90).setDepth(5);
                eg.setStrokeStyle(2, 0xffffff, 0.85);
                this.tweens.add({ targets:eg, radius:30, alpha:0, duration:300, onComplete:()=>eg.destroy() });
            });
        }

        this.time.delayedCall(800, () => {
            this.tweens.add({ targets:boss.container, scaleX:2, scaleY:0.1, alpha:0, duration:400, ease:'Quad.easeIn', onComplete:()=>boss.container.destroy() });
            // Drop fragments
            for (let i = 0; i < 8; i++) {
                const a = (i/8)*Math.PI*2;
                const fx = boss.container.x + Math.cos(a)*40, fy = boss.container.y + Math.sin(a)*40;
                const fg = this.add.graphics().setDepth(3);
                fg.fillStyle(0xcc44ff, 0.90); fg.fillCircle(fx, fy, 4);
                this.tweens.add({ targets:fg, alpha:0, duration:800, delay:i*60, onComplete:()=>fg.destroy() });
            }
        });

        // Clear any active attacks
        if (boss._voidMines) boss._voidMines.forEach(m => { if (m.gfx?.active) m.gfx.destroy(); });
        boss._voidMines = [];
        if (boss._gravityHole?.active) { this.tweens.killTweensOf(boss._gravityHole); boss._gravityHole.destroy(); }
        if (this._voidRipples) this._voidRipples.forEach(r => { if (r.gfx?.active) r.gfx.destroy(); }); this._voidRipples = [];
        // Clean up freeze visuals if boss dies while frozen
        if (boss._bossProxy?.freezeVisuals) {
            const fv = boss._bossProxy.freezeVisuals;
            if (fv._extraLayers) { for (const l of fv._extraLayers) { this.tweens.killTweensOf(l); l.destroy(); } }
            ['iceBlock', 'iceBorder'].forEach(k => { if (fv[k]) { this.tweens.killTweensOf(fv[k]); fv[k].destroy(); } });
            boss._bossProxy.freezeVisuals = null;
        }
        if (boss._freezeTimer) { boss._freezeTimer.remove(); boss._freezeTimer = null; }
        boss._bossProxy = null; boss._iceOverlay = null;

        // Clean up burn stacks
        if (boss._burnDoTTimer) { boss._burnDoTTimer.remove(); boss._burnDoTTimer = null; }
        if (boss._burnStackBar) { for (const pip of boss._burnStackBar) pip.destroy(); boss._burnStackBar = null; }
        boss.burnStacks = 0;

        // Drop reward fragments
        for (let i = 0; i < 8; i++) this.spawnOrbScrap(boss.container.x + (Math.random()-0.5)*60, boss.container.y + (Math.random()-0.5)*60);

        this.time.delayedCall(1500, () => this._level3RoomClear(5));
    }
}