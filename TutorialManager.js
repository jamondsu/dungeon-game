// ═══════════════════════════════════════════════════════════════════════
// TUTORIALMANAGER.JS — Tutorial flow, dialogue, rooms, doors, chests, enemy spawning
// ═══════════════════════════════════════════════════════════════════════
// All methods receive GameScene as `this` via .call(scene, ...) from GameScene.js
// Do NOT add local state here — all state lives on the scene object.

class TutorialManager {

    updateTutorial(time) {
        if (this.isLevel3 || this.isLevel2 || this.isLevel4) return;
        // Collect glorps
        if (this.glorps && this.glorps.length > 0) {
            const playerPx = this.playerX * this.TILE_SIZE + this.TILE_SIZE / 2;
            const playerPy = this.playerY * this.TILE_SIZE + this.TILE_SIZE / 2;
            const PICKUP_RADIUS  = this.TILE_SIZE * 2.2; // ~2 tiles euclidean
            const MAGNET_RADIUS  = this.TILE_SIZE * 3.5; // start pulling toward player

            for (let i = this.glorps.length - 1; i >= 0; i--) {
                const glorp = this.glorps[i];
                if (glorp._collecting) continue; // already in pickup tween

                const dx   = glorp.x - playerPx;
                const dy   = glorp.y - playerPy;
                const dist = Math.sqrt(dx * dx + dy * dy);

                if (dist < PICKUP_RADIUS) {
                    // Mark so we don't double-trigger
                    glorp._collecting = true;
                    this.glorps.splice(i, 1);

                    const value = glorp.getData('value') || 10;

                    // ── Magnetic fly-to-player tween ─────────────────────
                    this.tweens.add({
                        targets: glorp,
                        x: playerPx,
                        y: playerPy,
                        scaleX: 0.3,
                        scaleY: 0.3,
                        alpha: 0.6,
                        duration: 220,
                        ease: 'Cubic.easeIn',
                        onComplete: () => {
                            glorp.destroy();

                            // ── Burst particles ──────────────────────────
                            for (let p = 0; p < 8; p++) {
                                const angle = (p / 8) * Math.PI * 2;
                                const spark = this.add.rectangle(
                                    playerPx, playerPy, 4, 4, 0x00ffaa, 1
                                ).setDepth(10).setScrollFactor(0);
                                // Convert world → screen for scroll factor 0
                                spark.x = playerPx - this.cameras.main.scrollX;
                                spark.y = playerPy - this.cameras.main.scrollY;
                                this.tweens.add({
                                    targets: spark,
                                    x: spark.x + Math.cos(angle) * 22,
                                    y: spark.y + Math.sin(angle) * 22,
                                    alpha: 0,
                                    scaleX: 0.2, scaleY: 0.2,
                                    duration: 280,
                                    ease: 'Quad.easeOut',
                                    onComplete: () => spark.destroy()
                                });
                            }

                            // ── "+N Glorps" floating text ────────────────
                            const fx = playerPx - this.cameras.main.scrollX;
                            const fy = playerPy - this.cameras.main.scrollY - 20;
                            const ft = this.add.text(fx, fy, `+${value} Glorps`, {
                                fontSize: '14px', fontFamily: 'monospace', fontStyle: 'bold',
                                color: '#00ffaa', stroke: '#000000', strokeThickness: 3
                            }).setOrigin(0.5).setDepth(50).setScrollFactor(0);
                            this.tweens.add({
                                targets: ft,
                                y: fy - 28,
                                alpha: 0,
                                duration: 700,
                                ease: 'Quad.easeOut',
                                onComplete: () => ft.destroy()
                            });

                            // ── Tally ────────────────────────────────────
                            if (!this.totalGlorps) this.totalGlorps = 0;
                            this.totalGlorps += value;
                            if (this.glorpText) {
                                this.glorpText.setText(`✦ ${this.totalGlorps} Glorps`);
                                localStorage.setItem('glorps', this.totalGlorps);
                            }

                            // Check room 0 all-collected
                            if (this.glorps.length === 0 && this.currentTutorialRoom === 0 && !this.tutorialGlorpsCollected) {
                                this.tutorialGlorpsCollected = true;
                                this.onGlorpsCollected();
                            }
                        }
                    });

                } else if (dist < MAGNET_RADIUS) {
                    // Gentle drift toward player (magnet zone, no collect yet)
                    const speed = 80 * (1 - dist / MAGNET_RADIUS); // faster the closer
                    const ndx = -dx / dist, ndy = -dy / dist;
                    glorp.x += ndx * speed * (1 / 60); // approximate per-frame
                    glorp.y += ndy * speed * (1 / 60);
                }
            }
        }

        // Check which room player is in
        const playerRoom = this.getCurrentPlayerRoom();
        if (playerRoom === -1) return;

        // First time entering a room - trigger room start
        if (playerRoom !== this.currentTutorialRoom) {
            this.currentTutorialRoom = playerRoom;
            this.onTutorialRoomEnter(playerRoom);
        }

        // Check if room is cleared
        if (!this.tutorialRoomCleared[playerRoom]) {
            const roomEnemies = this.enemies.filter(e => e.tutorialRoomIndex === playerRoom);
            const hasEnemies = roomEnemies.length > 0;

            // Room 0 is special - enemies spawn after glorps
            if (playerRoom === 0 && !this._roomHadEnemies?.[0]) {
                // waiting for enemies to spawn
            } else if (!this.isIceTutorial && playerRoom === 1 && !this._ultUsedInRoom2) {
                // Fire tutorial room 1 requires ult
                if (!hasEnemies && !this._ultNagShown) {
                    this._ultNagShown = true;
                    this.showTutorialDialogue("Enemies defeated! Now press E to use your Ultimate before you can leave!", "Glerp");
                }
            } else if (this.isIceTutorial && playerRoom === 3 && !this._iceUltUsed) {
                // Ice tutorial room 3 requires ice ult
                if (!hasEnemies && !this._ultNagShown) {
                    this._ultNagShown = true;
                    this.showTutorialDialogue("Enemies down! Switch to Ice (press 2) and press E to unleash the Blizzard of Courage!\nYou must use your ice ult to leave.", "Glerp");
                }
            } else if (!hasEnemies && (this.tutorialDoorsLocked[playerRoom] || this._roomHadEnemies?.[playerRoom])) {
                // Room 6 also requires all portals destroyed
                if (playerRoom === 6) {
                    const roomPortals = (this.portals || []).filter(p => p.tutorialRoomIndex === 6);
                    if (roomPortals.length > 0) {
                        if (!this._portalNagShown) {
                            this._portalNagShown = true;
                            this.showTutorialDialogue("Enemies are defeated but the Queen Slimes keep spawning!\nDestroy all the Queen Slimes to clear the room!", "Glerp");
                        }
                    } else {
                        this.onTutorialRoomClear(playerRoom);
                    }
                } else {
                    this.onTutorialRoomClear(playerRoom);
                }
            }

            if (hasEnemies) {
                if (!this._roomHadEnemies) this._roomHadEnemies = {};
                this._roomHadEnemies[playerRoom] = true;
                if (playerRoom === 1 || playerRoom === 3 || playerRoom === 6) this._ultNagShown = false;
            }
        }

        // ── Walk-on chest detection ────────────────────────────────────────────
        if (this.tutorialChests) {
            for (const chest of this.tutorialChests) {
                if (chest.opened) continue;
                if (this.playerX === chest.tileX && this.playerY === chest.tileY) {
                    this.openTutorialChest(chest.roomIndex, chest.container, null);
                }
            }
        }

        // ── Per-frame mark sync — keep all marks glued to their enemy sprites ──
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
    }

    onGlorpsCollected() {
        // Spawn enemies immediately - don't wait for click
        if (this.tutorialEnemySpawns[0]) {
            for (let pos of this.tutorialEnemySpawns[0]) {
                const enemy = this.createEnemy(pos.x, pos.y, 30);
                enemy.tutorialRoomIndex = 0;
            }
            this.tutorialEnemySpawns[0] = null;
        }

        this.showTutorialDialogue(
            `Great job! Now defeat the enemies to unlock the exit!`,
            "Glerp"
        );
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

    onTutorialRoomEnter(roomIndex) {
        if (this.isLevel3 || this.isLevel2 || this.isLevel4) return;

        // Always lock doors immediately on entering any room
        if (this.tutorialDoorsLocked[roomIndex]) {
            this.lockTutorialDoors(roomIndex);
        }

        // Ice tutorial has its own message set
        if (this.isIceTutorial) {
            this._onIceTutorialRoomEnter(roomIndex);
            return;
        }

        // Room 0: Yellow Slime NPC introduction
        if (roomIndex === 0 && !this.tutorialNameEntered) {
            this.startTutorialIntro();
            return;
        }

        // Show tutorial text based on room
        const messages = [
            { text: "Defeat all enemies to unlock the next room!\nLeft click to punch with your Flame Fists.", speaker: "Glerp" },
            { text: `Nice work, ${this.playerName || 'Hero'}! Feel the ult bar filling up at the bottom?\nKill these enemies, then press E to unleash your Ultimate!\nYou MUST use your ult to leave this room.`, speaker: "Glerp" },
            { text: "Those enemies with the ORANGE mark are immune to fire!\nPress 2 to switch to Ice and freeze them!", speaker: "Glerp" },
            { text: `Final challenge, ${this.playerName || 'Hero'}! Watch out for enemies with RED rings — standing near them blocks your ult. Eliminate them first!`, speaker: "Glerp" }
        ];

        const msg = messages[roomIndex];
        if (msg && this.tutorialNameEntered) {
            const text = msg.text.replace('${this.playerName}', this.playerName || 'Hero');
            this.showTutorialDialogue(text, msg.speaker);
        }
    }

    _onIceTutorialRoomEnter(roomIndex) {
        // Reset Glerp ice reaction flag each room so it fires once per room
        this._iceGlerpFired = false;
        const name = this.playerName || 'Hero';
        // Room 0: Glerp greets the player and praises the flame sword
        if (roomIndex === 0) {
            this.time.delayedCall(400, () => {
                this.showTutorialDialogue(
                    `Welcome back, ${name}! That Flame Sword looks good on you.\nIt sweeps a wide arc — perfect for groups.\nHead into the next room and show 'em what it can do!`,
                    "Glerp"
                );
            });
            // Unlock room 0 doors immediately — no enemies
            this.tutorialDoorsLocked[0] = false;
            this.unlockTutorialDoors(0);
            return;
        }
        const messages = [
            null,
            { text: `Room full of baddies! ORANGE mark = fire immune, RED ring = blocks your ult.\nYour Flame Sword tears through the rest!`, speaker: "Glerp" },
            null,
            { text: `Snipers! They'll pelt you from range and there's nowhere to hide.\nYou're ICE-ONLY in here — no switching out.\nDefeat them, then press E on ICE to unleash the Blizzard of Courage!\nIt'll drag every one of them right to you. You MUST use it to leave.`, speaker: "Glerp" },
            { text: `Watch your step! Purple clouds = POISON (slows your damage).\nGrey spike tiles = OUCH. Enemies can drop health pots — pick them up!`, speaker: "Glerp" },
            { text: `Final mix, ${name}! Flame Sword for normals, Ice Fists for ice elementals.\nFreeze → Shatter for big damage. Almost done!`, speaker: "Glerp" },
            { text: `Those glowing PORTALS keep spawning slimes! Destroy them all to clear the room.\nWatch out for snipers and use both elements — you've got the full toolkit now!`, speaker: "Glerp" },
        ];
        const msg = messages[roomIndex];
        if (msg) this.showTutorialDialogue(msg.text, msg.speaker);
    }

    _triggerIceImmuneGlerpReaction() {
        if (!this.isIceTutorial || this._iceGlerpFired) return;
        const room = this.getCurrentPlayerRoom();
        if (room < 2) return;
        this._iceGlerpFired = true;
        // Unlock ice switching immediately
        this.tutorialIceUnlocked = true;
        this.time.delayedCall(250, () => {
            this.showTutorialDialogue(
                "Whoa! Your attacks bounced right off!\nThat's an ICE elemental — fire and physical attacks can't hurt them.\nPress 2 to switch to ICE, then left click to throw ice shards!\nStack enough hits and they'll FREEZE — then one more hit SHATTERS them!",
                "Glerp"
            );
        });
    }

    startTutorialIntro() {
        // Small delay to ensure world is rendered
        this.time.delayedCall(500, () => {
            // Spawn Yellow Slime NPC
            const npcX = 17;
            const npcY = 51;

            this.tutorialNPC = this.add.sprite(
                npcX * this.TILE_SIZE + this.TILE_SIZE / 2,
                npcY * this.TILE_SIZE + this.TILE_SIZE / 2 + this.SLIME_Y_OFFSET,
                'slime_orange', 0
            );
            this.tutorialNPC.setScale(this.SLIME_SCALE);
            this.tutorialNPC.setDepth(1);
            this.tutorialNPC.play('orange_idle');

            // Show intro dialogue then immediately ask name
            this.showTutorialDialogue(
                "Hey there, traveler! Welcome to the dungeon!\nI'm Glerp, your friendly neighborhood slime guide!",
                "Glerp",
                () => this.showNameInput()
            );
        });
    }

    showNameInput() {
        this.clearTutorialDialogue();

        // On replay, reuse the saved name — avoids re-showing the input
        // which would set keyboard.enabled = false and freeze movement
        const savedName = localStorage.getItem('playerName');
        if (savedName) {
            this.playerName = savedName;
            this.tutorialNameEntered = true;
            this.input.keyboard.enabled = true;
            this.time.delayedCall(100, () => this.continueAfterName());
            return;
        }

        const inputDiv = document.createElement('div');
        inputDiv.style.cssText = `
            position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%);
            background: #1a1a2e; padding: 30px; border: 3px solid #ffaa00;
            border-radius: 10px; z-index: 10000; font-family: monospace; text-align: center;
        `;
        inputDiv.innerHTML = `
            <p style="color:#ffff00;font-size:18px;margin:0 0 5px">Hey there, traveler!</p>
            <p style="color:#aaaaaa;font-size:13px;margin:0 0 15px">I'm Glerp! What's your name, brave adventurer?</p>
            <input id="playerNameInput" maxlength="12" placeholder="Hero"
                style="width:200px;padding:8px;font-size:16px;font-family:monospace;
                       background:#0f0f1e;color:#ffff00;border:2px solid #ffaa00;border-radius:5px;" />
            <button id="playerNameSubmit"
                style="display:block;margin:15px auto 0;padding:10px 30px;
                       background:#ffaa00;color:#000;font-size:16px;font-weight:bold;
                       border:none;border-radius:5px;cursor:pointer;font-family:monospace;">
                OK
            </button>
        `;
        document.body.appendChild(inputDiv);

        // Disable Phaser keyboard capture while typing
        this.input.keyboard.enabled = false;

        const input = inputDiv.querySelector('#playerNameInput');
        const submit = inputDiv.querySelector('#playerNameSubmit');
        input.focus();

        // Stop ALL key events from reaching Phaser
        input.addEventListener('keydown', (e) => e.stopPropagation());
        input.addEventListener('keyup', (e) => e.stopPropagation());
        input.addEventListener('keypress', (e) => e.stopPropagation());

        const submitName = () => {
            const name = input.value.trim() || "Hero";
            this.playerName = name;
            this.tutorialNameEntered = true;
            localStorage.setItem('playerName', name);
            this.input.keyboard.enabled = true;
            inputDiv.remove();
            this.time.delayedCall(100, () => this.continueAfterName());
        };

        submit.onclick = (e) => { e.stopPropagation(); submitName(); };
        input.onkeydown = (e) => { if (e.key === 'Enter') submitName(); };
    }

    continueAfterName() {
        this.showTutorialDialogue(
            `Nice to meet you, ${this.playerName}! Let me teach you the basics.\n\nFirst, collect these shiny Glorps! They're used to buy weapons.`,
            "Glerp",
            () => {
                // Spawn glorps in room
                this.spawnTutorialGlorps();
                this.showTutorialDialogue(
                    `Walk over the Glorps to collect them!\nThen we'll practice combat.`,
                    "Glerp"
                );
            }
        );
    }

    spawnTutorialGlorps() {
        const positions = [{ x: 14, y: 50 }, { x: 17, y: 52 }, { x: 20, y: 50 }];
        if (!this.glorps) this.glorps = [];
        for (const pos of positions) {
            const wx = pos.x * this.TILE_SIZE + this.TILE_SIZE / 2;
            const wy = pos.y * this.TILE_SIZE + this.TILE_SIZE / 2;
            this.glorps.push(this._buildGlorpContainer(wx, wy, 10));
        }
    }

    _buildGlorpContainer(worldX, worldY, value) {
        const glorp = this.add.container(worldX, worldY).setDepth(2);

        const shadow = this.add.ellipse(0, 10, 18, 6, 0x000000, 0.35);
        const aura = this.add.graphics();
        aura.lineStyle(2, 0x00ffaa, 0.35); aura.strokeCircle(0, 0, 13);
        const bodyGlow = this.add.graphics();
        bodyGlow.fillStyle(0x00ff88, 0.22); bodyGlow.fillCircle(0, 0, 11);
        const bodyMid = this.add.graphics();
        bodyMid.fillStyle(0x00ffaa, 0.75); bodyMid.fillCircle(0, 0, 8);
        const bodyCore = this.add.graphics();
        bodyCore.fillStyle(0xaaffdd, 1); bodyCore.fillCircle(0, 0, 5);
        const sparkle = this.add.graphics();
        sparkle.fillStyle(0xffffff, 0.9); sparkle.fillCircle(-3, -3, 2);
        const label = this.add.text(0, 14, `✦${value}`, {
            fontSize: '8px', fontFamily: 'monospace', color: '#00ffaa',
            stroke: '#000000', strokeThickness: 2
        }).setOrigin(0.5, 0);
        glorp.add([shadow, aura, bodyGlow, bodyMid, bodyCore, sparkle, label]);

        const baseY = worldY;
        const bobHeight = 18, riseTime = 700, fallTime = 420;
        const bobDown = () => {
            this.tweens.add({
                targets: glorp, y: baseY, duration: fallTime, ease: 'Cubic.easeIn',
                onComplete: () => {
                    this.tweens.add({ targets: glorp, scaleX: 1.25, scaleY: 0.78, duration: 60, yoyo: true, ease: 'Power1', onComplete: bobUp });
                }
            });
        };
        const bobUp = () => {
            this.tweens.add({ targets: glorp, y: baseY - bobHeight, duration: riseTime, ease: 'Cubic.easeOut', onComplete: bobDown });
        };
        bobUp();

        this.tweens.add({ targets: shadow, scaleX: 0.55, alpha: 0.15, duration: riseTime, ease: 'Cubic.easeOut', yoyo: true, repeat: -1, repeatDelay: fallTime + 60 });
        this.tweens.add({ targets: aura, alpha: 0.7, scaleX: 1.15, scaleY: 1.15, duration: 900, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });

        glorp.setData('isGlorp', true);
        glorp.setData('value', value);
        return glorp;
    }

    onTutorialRoomClear(roomIndex) {
        // Level 2/3/4 have their own room clear logic — don't run tutorial clear
        if (this.isLevel2 || this.isLevel3 || this.isLevel4) return;
        this.tutorialRoomCleared[roomIndex] = true;

        // Ice tutorial room 6 = final room
        if (this.isIceTutorial && roomIndex === 6) {
            this.time.delayedCall(600, () => {
                this.showTutorialDialogue(
                    `You did it, ${this.playerName || 'Hero'}! Fire, Ice, positioning, traps, portals — you handled it all.\nThe real dungeon awaits. Don't die.\n\n...Glerp believes in you. Probably.`,
                    "Glerp"
                );
                this.time.delayedCall(4000, () => this.endTutorialReturnToMenu());
            });
            return;
        }

        this.spawnTutorialChest(roomIndex);
        this.time.delayedCall(1000, () => {
            this.showTutorialDialogue("Room cleared! Open the chest to continue.", "Glerp");
        });
    }

    isInCurrentRoom(tx, ty) {
        if (!this.isTutorial && !this.isLevel2) return true;
        const ri = this.getCurrentPlayerRoom();
        if (ri < 0) return false;
        const r = this.rooms[ri];
        return tx >= r.x && tx < r.x + r.w && ty >= r.y && ty < r.y + r.h;
    }

    // getPortalAt, spawnPortal, updatePortals, damagePortal, _destroyPortal
    // moved to LevelManager — queen slime is a general enemy, not tutorial-exclusive

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

    spawnTutorialChest(roomIndex) {
        const room = this.rooms[roomIndex];
        let chestTileX = Math.floor(room.x + room.w / 2);
        let chestTileY = Math.floor(room.y + room.h / 2);

        // Spiral outward if centre is a wall or nothing
        if (!this.world[chestTileX] || this.world[chestTileX][chestTileY] !== this.FLOOR) {
            outer: for (let r = 1; r < Math.max(room.w, room.h); r++) {
                for (let dx = -r; dx <= r; dx++) {
                    for (let dy = -r; dy <= r; dy++) {
                        if (Math.abs(dx) !== r && Math.abs(dy) !== r) continue;
                        const tx = chestTileX + dx, ty = chestTileY + dy;
                        if (tx < room.x || tx >= room.x + room.w) continue;
                        if (ty < room.y || ty >= room.y + room.h) continue;
                        if (this.world[tx]?.[ty] === this.FLOOR) {
                            chestTileX = tx; chestTileY = ty;
                            break outer;
                        }
                    }
                }
            }
        }

        const cx = chestTileX * this.TILE_SIZE + this.TILE_SIZE / 2;
        const cy = chestTileY * this.TILE_SIZE + this.TILE_SIZE / 2;

        // Layered chest graphic — two parts: lid and body (for open animation)
        const container = this.add.container(cx, cy).setDepth(2);

        const shadow = this.add.ellipse(0, 6, 22, 8, 0x000000, 0.3);

        // Body (bottom half — stays put on open)
        const body = this.add.graphics();
        body.fillStyle(0x884400, 1); body.fillRect(-10, 0, 20, 7);
        body.fillStyle(0xffcc44, 1); body.fillRect(-3, 1, 6, 5);   // lock
        body.lineStyle(1, 0x553300, 1); body.strokeRect(-10, 0, 20, 7);

        // Lid (top half — flies up on open)
        const lid = this.add.graphics();
        lid.fillStyle(0xaa6600, 1); lid.fillRect(-10, -7, 20, 7);
        lid.lineStyle(1, 0x553300, 1); lid.strokeRect(-10, -7, 20, 7);

        const glow = this.add.rectangle(0, 0, 24, 16, 0xffaa00, 0.2);

        container.add([shadow, glow, body, lid]);

        // Bob animation
        const bobTween = this.tweens.add({ targets: container, y: cy - 4, duration: 600, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
        this.tweens.add({ targets: glow, alpha: 0.45, duration: 400, yoyo: true, repeat: -1 });

        // Store chest data for walk-on detection — no click needed
        if (!this.tutorialChests) this.tutorialChests = [];
        this.tutorialChests.push({
            tileX: chestTileX, tileY: chestTileY,
            roomIndex, container, lid, body, glow, shadow, bobTween,
            opened: false
        });
    }

    openTutorialChest(roomIndex, container, _unused) {
        // Level 2 chest branch rooms — mimic or loot (identified by isChestRoom flag on room)
        if (this.isLevel2 && this.rooms[roomIndex]?.isChestRoom) {
            const chest = (this.tutorialChests || []).find(c => c.roomIndex === 3 && !c.opened);
            if (!chest) return;
            chest.opened = true;
            this.tweens.killTweensOf(chest.container);

            if (chest.isMimic && !chest._mimicTriggered) {
                chest._mimicTriggered = true;
                this.cameras.main.shake(80, 0.007);
                this.tweens.add({ targets: chest.container, angle: 15, duration: 60, yoyo: true, repeat: 4, onComplete: () => {
                    chest.container.destroy();
                    const offsets = [{x:0,y:-1},{x:1,y:0},{x:0,y:1},{x:-1,y:0},{x:1,y:-1}];
                    for (const off of offsets) {
                        const ex = chest.tileX + off.x, ey = chest.tileY + off.y;
                        if (this.world[ex]?.[ey] === this.FLOOR) {
                            const e = this.createEnemy(ex, ey, 40);
                            e.tutorialRoomIndex = 3;
                            e.sprite.setTint(0xff4444);
                        }
                    }
                    this.showStatusText(chest.tileX * this.TILE_SIZE + this.TILE_SIZE/2, chest.tileY * this.TILE_SIZE - 10, 'MIMIC!', '#ff4444');
                }});
            } else if (!chest.isMimic) {
                // Open animation
                if (chest.lid) this.tweens.add({ targets: chest.lid, y: -28, angle: -30, alpha: 0, duration: 350, ease: 'Quad.easeOut', onComplete: () => chest.lid.destroy() });
                for (let i = 0; i < 8; i++) {
                    const a = (i / 8) * Math.PI * 2;
                    const spark = this.add.rectangle(chest.container.x, chest.container.y, 4, 4, 0xffcc44, 1).setDepth(4);
                    this.tweens.add({ targets: spark, x: spark.x + Math.cos(a) * 28, y: spark.y + Math.sin(a) * 28, alpha: 0, scaleX: 0.2, scaleY: 0.2, duration: 400, ease: 'Quad.easeOut', onComplete: () => spark.destroy() });
                }
                this.time.delayedCall(300, () => { if (chest.container?.active) chest.container.destroy(); });
                this.cameras.main.shake(50, 0.003);

                // Reward: 30 glorps + small pot chance
                this.totalGlorps = (this.totalGlorps || 0) + 30;
                localStorage.setItem('glorps', this.totalGlorps);
                if (this.glorpText) this.glorpText.setText(`✦ ${this.totalGlorps} Glorps`);
                const sx = chest.tileX * this.TILE_SIZE + this.TILE_SIZE/2 - this.cameras.main.scrollX;
                const sy = chest.tileY * this.TILE_SIZE - 10 - this.cameras.main.scrollY;
                const ft = this.add.text(sx, sy, '+30 Glorps', { fontSize: '14px', fontFamily: 'monospace', fontStyle: 'bold', color: '#00ffaa', stroke: '#000', strokeThickness: 3 }).setOrigin(0.5).setDepth(50).setScrollFactor(0);
                this.tweens.add({ targets: ft, y: sy - 28, alpha: 0, duration: 800, ease: 'Quad.easeOut', onComplete: () => ft.destroy() });
                if (Math.random() < 0.15) this.spawnUltPot(chest.tileX * this.TILE_SIZE, chest.tileY * this.TILE_SIZE);
                else if (Math.random() < 0.10) this.spawnHealthPot(chest.tileX * this.TILE_SIZE, chest.tileY * this.TILE_SIZE);
            }
            return;
        }

        this.tutorialDoorsLocked[roomIndex] = false;
        this.unlockTutorialDoors(roomIndex);

        // Find the chest object and mark opened
        const chest = this.tutorialChests?.find(c => c.roomIndex === roomIndex && !c.opened);
        if (chest) {
            chest.opened = true;
            // Stop bobbing
            if (chest.bobTween) this.tweens.killTweensOf(chest.container);
            chest.container.y = chest.tileY * this.TILE_SIZE + this.TILE_SIZE / 2;
        }

        // Open animation: lid flies up and rotates, sparks burst, then body fades
        if (chest) {
            // Lid pops up
            this.tweens.add({
                targets: chest.lid,
                y: -28, angle: -30, alpha: 0,
                duration: 400, ease: 'Quad.easeOut',
                onComplete: () => chest.lid.destroy()
            });
            // Sparkle burst
            for (let i = 0; i < 8; i++) {
                const angle = (i / 8) * Math.PI * 2;
                const spark = this.add.rectangle(
                    chest.container.x, chest.container.y,
                    4, 4, 0xffcc44, 1).setDepth(4);
                this.tweens.add({
                    targets: spark,
                    x: spark.x + Math.cos(angle) * 24,
                    y: spark.y + Math.sin(angle) * 24,
                    alpha: 0, scaleX: 0.2, scaleY: 0.2,
                    duration: 350, ease: 'Quad.easeOut',
                    onComplete: () => spark.destroy()
                });
            }
            // Body fades after short delay
            this.time.delayedCall(350, () => {
                this.tweens.add({
                    targets: chest.container, alpha: 0, duration: 250,
                    onComplete: () => chest.container.destroy()
                });
            });
        } else {
            // Fallback if chest object not found
            this.tweens.add({
                targets: container, scaleX: 1.5, scaleY: 1.5, alpha: 0, duration: 300,
                onComplete: () => container?.destroy()
            });
        }
        this.cameras.main.shake(60, 0.004);

        // Rewards — level 2 just gives glorps, no tutorial reward system
        let reward;
        if (this.isLevel2) {
            reward = { type: 'glorps', amount: 20, message: null };
        } else if (this.isIceTutorial) {
            const iceRewards = [
                null, // room 0: no chest
                { type: 'glorps', amount: 15, message: "15 Glorps! Keep pushing forward." },
                { type: 'glorps', amount: 20, message: "20 Glorps! Ice fists are tricky — practice the freeze combo." },
                { type: 'glorps', amount: 15, message: "15 Glorps! The ult is powerful — save it for groups." },
                { type: 'glorps', amount: 20, message: "20 Glorps! Careful through the traps ahead." },
                { type: 'glorps', amount: 25, message: "25 Glorps! One more room stands between you and freedom." },
                null, // room 6 final — handled separately
            ];
            reward = iceRewards[roomIndex] || { type: 'glorps', amount: 10, message: "Glorps collected!" };
        } else {
            const fireRewards = [
                { type: 'glorps', amount: 10, message: "10 Glorps! Keep collecting!" },
                { type: 'glorps', amount: 20, message: "20 Glorps! You're getting the hang of it." },
                { type: 'glorps', amount: 20, message: "20 Glorps! The lava tiles deal damage over time — use them!" },
                { type: 'glorps', amount: 25, message: "25 Glorps! Almost there!" },
                { type: 'glorps', amount: 25, message: "25 Glorps! That's 100 total — enough to buy your first weapon!" },
            ];
            reward = fireRewards[roomIndex] || { type: 'glorps', amount: 10, message: "Glorps!" };
        }

        // Apply reward
        if (reward.type === 'glorps') {
            if (!this.totalGlorps) this.totalGlorps = 0;
            this.totalGlorps += reward.amount;
            if (this.glorpText) {
                this.glorpText.setText(`✦ ${this.totalGlorps} Glorps`);
                localStorage.setItem('glorps', this.totalGlorps);
            }
            // Floating +N glorps
            const screenX = container.x - this.cameras.main.scrollX;
            const screenY = container.y - this.cameras.main.scrollY - 20;
            const ft = this.add.text(screenX, screenY, `+${reward.amount} Glorps`, {
                fontSize: '14px', fontFamily: 'monospace', fontStyle: 'bold',
                color: '#00ffaa', stroke: '#000', strokeThickness: 3
            }).setOrigin(0.5).setDepth(50).setScrollFactor(0);
            this.tweens.add({ targets: ft, y: screenY - 28, alpha: 0, duration: 800, ease: 'Quad.easeOut', onComplete: () => ft.destroy() });
        } else if (reward.type === 'flame_sword') {
            this.equippedWeapons.fire = 'flame_sword';
            localStorage.setItem('equip_fire', 'flame_sword');
            const uw = JSON.parse(localStorage.getItem('unlockedWeapons') || '[]');
            if (!uw.includes('flame_sword')) { uw.push('flame_sword'); localStorage.setItem('unlockedWeapons', JSON.stringify(uw)); }
            this.cameras.main.flash(300, 255, 140, 0);
        } else if (reward.type === 'ice_unlock') {
            this.tutorialIceUnlocked = true;
            this.cameras.main.flash(300, 100, 180, 255);
        }

        // Fire tutorial room 3 → pit sequence; level 2/3/4 → no dialogue; others → show reward message
        if (this.isLevel2 || this.isLevel3 || this.isLevel4) {
            // No Glerp dialogue in real dungeon levels
        } else if (!this.isIceTutorial && roomIndex === 3) {
            this.time.delayedCall(600, () => {
                this.showTutorialDialogue(
                    `Incredible, ${this.playerName || 'Hero'}! You've mastered the basics!\nNow... see that pit? Jump in. Trust me.`,
                    "Glerp",
                    () => this.spawnTutorialPortalPit()
                );
            });
        } else {
            this.showTutorialDialogue(reward.message, null);
        }
    }

    spawnTutorialPortalPit() {
        // Spawn a black swirling pit in room 4 center
        const room4 = this.rooms[3];
        const pitX = Math.floor(room4.x + room4.w / 2);
        const pitY = Math.floor(room4.y + room4.h / 2) + 3;

        const pitPx = pitX * this.TILE_SIZE + this.TILE_SIZE / 2;
        const pitPy = pitY * this.TILE_SIZE + this.TILE_SIZE / 2;

        // Outer glow ring
        const glow = this.add.circle(pitPx, pitPy, 32, 0x110022, 0.8).setDepth(0.8);
        const ring1 = this.add.circle(pitPx, pitPy, 28, 0x220033, 0).setDepth(0.9);
        ring1.setStrokeStyle(3, 0x9900ff, 0.9);
        const ring2 = this.add.circle(pitPx, pitPy, 20, 0x000000, 1).setDepth(1.0);
        const ring3 = this.add.circle(pitPx, pitPy, 20, 0x6600cc, 0).setDepth(1.1);
        ring3.setStrokeStyle(2, 0xcc44ff, 0.6);

        // Pulsing animation
        this.tweens.add({ targets: ring1, scaleX: 1.1, scaleY: 1.1, duration: 800, yoyo: true, repeat: -1 });
        this.tweens.add({ targets: ring3, scaleX: 0.9, scaleY: 0.9, duration: 600, yoyo: true, repeat: -1 });
        this.tweens.add({ targets: glow, alpha: 0.4, duration: 1000, yoyo: true, repeat: -1 });

        // Floating "JUMP IN" text above pit
        const pitLabel = this.add.text(pitPx, pitPy - 40, '▼ JUMP IN ▼', {
            fontSize: '11px', fontFamily: 'monospace', color: '#cc88ff',
            stroke: '#000000', strokeThickness: 3
        }).setOrigin(0.5).setDepth(5);
        this.tweens.add({ targets: pitLabel, y: pitPy - 46, duration: 600, yoyo: true, repeat: -1 });

        this._tutorialPit = { pitX, pitY, glow, ring1, ring2, ring3, pitLabel };

        this.showTutorialDialogue(
            "It's perfectly safe! Probably. Walk onto the dark circle.",
            "Glerp"
        );
    }

    checkTutorialPitCollision() {
        if (!this._tutorialPit || this._tutorialPitEntered) return;
        const { pitX, pitY } = this._tutorialPit;
        if (this.playerX === pitX && this.playerY === pitY) {
            this._tutorialPitEntered = true;
            this.startTutorialVoidFall();
        }
    }

    startTutorialVoidFall() {
        const W = this.scale.width;
        const H = this.scale.height;

        // Disable input
        this.input.keyboard.enabled = false;
        this.isPointerDown = false;

        // Player shrinks and falls into pit
        this.tweens.add({
            targets: this.player,
            scaleX: 0, scaleY: 0,
            duration: 400,
            ease: 'Power2'
        });

        // Screen fades to black
        const blackOut = this.add.rectangle(W / 2, H / 2, W, H, 0x000000, 0)
            .setDepth(2000).setScrollFactor(0);
        this.tweens.add({
            targets: blackOut,
            alpha: 1,
            duration: 600,
            delay: 200,
            onComplete: () => this.playVoidFallScene(blackOut)
        });
    }

    playVoidFallScene(blackOut) {
        const W = this.scale.width;
        const H = this.scale.height;

        // Small slime sprite falling in darkness
        const fallingSlime = this.add.sprite(W / 2, H * 0.3, 'slime_blue', 0)
            .setDepth(2001).setScrollFactor(0).setScale(1.5);

        // Tumbling fall animation
        this.tweens.add({
            targets: fallingSlime,
            y: H * 1.4,
            angle: 720,
            scaleX: 0.3, scaleY: 0.3,
            duration: 2000,
            ease: 'Power1'
        });

        // "..." appearing
        this.time.delayedCall(400, () => {
            const dot1 = this.add.text(W / 2, H * 0.55, '...', {
                fontSize: '28px', fontFamily: 'monospace', color: '#ffffff',
                stroke: '#000000', strokeThickness: 3
            }).setOrigin(0.5).setDepth(2002).setScrollFactor(0).setAlpha(0);
            this.tweens.add({ targets: dot1, alpha: 1, duration: 300 });
        });

        // Glerp's punchline
        this.time.delayedCall(1200, () => {
            this.showTutorialDialogue(
                "...I probably should have warned you it's a long way down.",
                "Glerp"
            );
        });

        // Second beat
        this.time.delayedCall(3000, () => {
            this.showTutorialDialogue(
                "Anyway! Head to the shop and buy the Flame Sword.\nIt costs 100 Glorps — exactly what you collected!",
                "Glerp",
                () => this.endTutorialReturnToMenu()
            );
        });
    }

    endTutorialReturnToMenu() {
        const W = this.scale.width;
        const H = this.scale.height;

        // Save glorps to localStorage
        const saved = parseInt(localStorage.getItem('glorps') || '0');
        localStorage.setItem('glorps', saved + (this.totalGlorps || 0));

        if (this.isIceTutorial) {
            localStorage.setItem('iceTutorialComplete', '1');
            localStorage.setItem('unlocked_ice', 'true');
        } else {
            localStorage.setItem('fireTutorialComplete', '1');
        }

        const flash = this.add.rectangle(W / 2, H / 2, W, H, 0xffffff, 0)
            .setDepth(3000).setScrollFactor(0);
        this.tweens.add({
            targets: flash, alpha: 1, duration: 400,
            onComplete: () => {
                this.input.keyboard.enabled = true;
                if (this.isIceTutorial) {
                    this.scene.start('LevelSelect');
                } else {
                    this.scene.start('LevelSelect', { showShopPrompt: true, glorps: this.totalGlorps });
                }
            }
        });
    }

    showTutorialDialogue(message, speakerName = null, onComplete = null) {
        // Remove ALL existing dialogue elements
        this.clearTutorialDialogue();

        const W = this.scale.width;
        const H = this.scale.height;

        // Track all dialogue objects so we can destroy them together
        this._dialogueObjects = [];

        // Background box
        const boxBg = this.add.rectangle(W / 2, H - 100, W - 100, 120, 0x1a1a2e, 0.95)
            .setDepth(1000).setScrollFactor(0);
        const boxBorder = this.add.rectangle(W / 2, H - 100, W - 100, 120, 0xffaa00, 0)
            .setDepth(1000).setScrollFactor(0);
        boxBorder.setStrokeStyle(3, 0xffaa00, 1);
        this._dialogueObjects.push(boxBg, boxBorder);

        // Speaker name + portrait
        if (speakerName) {
            const leftX = W / 2 - (W - 100) / 2;
            // Name label - shifted right
            const speakerText = this.add.text(leftX + 40, H - 145, speakerName, {
                fontSize: '15px', fontFamily: 'monospace',
                color: '#ffff00', stroke: '#000000', strokeThickness: 3, fontStyle: 'bold'
            }).setDepth(1002).setScrollFactor(0);
            this._dialogueObjects.push(speakerText);

            // Portrait - shifted right, vertically centered in box
            const portrait = this.add.sprite(leftX + 65, H - 114, 'slime_orange', 0)
                .setScale(3.5).setDepth(1002).setScrollFactor(0);
            portrait.play('orange_idle');
            this.tweens.add({ targets: portrait, y: H - 120, duration: 500, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
            this._dialogueObjects.push(portrait);
        }

        // Message text
        const messageText = this.add.text(W / 2, H - 100, message, {
            fontSize: '16px', fontFamily: 'monospace',
            color: '#ffffff', stroke: '#000000', strokeThickness: 2,
            align: 'center', wordWrap: { width: W - 160 }
        }).setOrigin(0.5).setDepth(1001).setScrollFactor(0);
        this._dialogueObjects.push(messageText);

        if (onComplete) {
            const continueText = this.add.text(W / 2, H - 55, '▼ Click to continue', {
                fontSize: '12px', fontFamily: 'monospace', color: '#ffaa00'
            }).setOrigin(0.5).setDepth(1001).setScrollFactor(0).setAlpha(0.7);
            this._dialogueObjects.push(continueText);
            this.tweens.add({ targets: continueText, alpha: 1, duration: 500, yoyo: true, repeat: -1 });

            if (this.dialogueClickHandler) this.input.off('pointerdown', this.dialogueClickHandler);
            this.dialogueClickHandler = () => {
                this.input.off('pointerdown', this.dialogueClickHandler);
                this.dialogueClickHandler = null;
                this.clearTutorialDialogue();
                if (onComplete) onComplete();
            };
            this.input.on('pointerdown', this.dialogueClickHandler);
        } else {
            // No callback — still require click to dismiss
            const dismissText = this.add.text(W / 2, H - 55, '▼ Click to dismiss', {
                fontSize: '12px', fontFamily: 'monospace', color: '#888888'
            }).setOrigin(0.5).setDepth(1001).setScrollFactor(0).setAlpha(0.5);
            this._dialogueObjects.push(dismissText);

            if (this.dialogueClickHandler) this.input.off('pointerdown', this.dialogueClickHandler);
            this.dialogueClickHandler = () => {
                this.input.off('pointerdown', this.dialogueClickHandler);
                this.dialogueClickHandler = null;
                this.clearTutorialDialogue();
            };
            this.input.on('pointerdown', this.dialogueClickHandler);
        }
    }

    clearTutorialDialogue() {
        if (this._dialogueObjects) {
            for (let obj of this._dialogueObjects) {
                if (obj && obj.active) {
                    this.tweens.killTweensOf(obj);
                    obj.destroy();
                }
            }
            this._dialogueObjects = null;
        }
        if (this.dialogueClickHandler) {
            this.input.off('pointerdown', this.dialogueClickHandler);
            this.dialogueClickHandler = null;
        }
    }

    // ─── PAUSE MENU ────────────────────────────────────────────────────────────

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

    spawnTutorialEnemies() {
        this.tutorialNPC = null;

        // Room 0: 3 enemies after glorps (fists only)
        // Room 1 (Ult intro): 5 easy enemies — kill them, then press E to exit
        const room2Positions = [
            { x: 33, y: 47, roomIndex: 1 },
            { x: 38, y: 47, roomIndex: 1 },
            { x: 43, y: 47, roomIndex: 1 },
            { x: 36, y: 52, roomIndex: 1 },
            { x: 41, y: 52, roomIndex: 1 }
        ];

        // Room 2 (element switching): 3 normal + 3 fire-immune enemies
        const room3Normal = [
            { x: 58, y: 48, roomIndex: 2 },
            { x: 62, y: 52, roomIndex: 2 },
            { x: 66, y: 48, roomIndex: 2 },
        ];
        const room3FireImmune = [
            { x: 60, y: 52, roomIndex: 2 },
            { x: 64, y: 48, roomIndex: 2 },
            { x: 68, y: 52, roomIndex: 2 },
        ];

        // Room 4 (final challenge): mix of normal and ult-inhibiting enemies
        // Normal enemies
        const room4Normal = [
            { x: 84, y: 44, roomIndex: 3 },
            { x: 92, y: 46, roomIndex: 3 },
            { x: 84, y: 52, roomIndex: 3 },
            { x: 92, y: 56, roomIndex: 3 },
            { x: 96, y: 58, roomIndex: 3 }
        ];
        // Ult-inhibiting enemies (red aura, block ult in 3-tile radius)
        const room4Inhibitors = [
            { x: 88, y: 44, roomIndex: 3 },
            { x: 96, y: 46, roomIndex: 3 },
            { x: 88, y: 54, roomIndex: 3 }
        ];
        const room4Positions = [...room4Normal, ...room4Inhibitors];

        // Store positions for delayed spawning
        this.tutorialEnemySpawns = {
            0: [ { x: 15, y: 49 }, { x: 18, y: 49 }, { x: 21, y: 49 } ],
            1: room2Positions,
            2: [...room3Normal, ...room3FireImmune],
            3: room4Positions
        };

        // Room 1: spawn normally (ult gate room — easy enemies, no gimmick)
        for (let pos of room2Positions) {
            const enemy = this.createEnemy(pos.x, pos.y, 25);
            enemy.tutorialRoomIndex = pos.roomIndex;
        }

        // Room 2: normal enemies
        for (let pos of room3Normal) {
            const enemy = this.createEnemy(pos.x, pos.y, 25);
            enemy.tutorialRoomIndex = pos.roomIndex;
        }

        // Room 2: fire-immune enemies - orange flame mark above head
        for (let pos of room3FireImmune) {
            const enemy = this.createEnemy(pos.x, pos.y, 30);
            enemy.tutorialRoomIndex = pos.roomIndex;
            enemy.fireImmune = true;
            enemy._fireMark = this.spawnFireMark(enemy);
        }

        // Room 3: ult-inhibiting enemies
        for (let pos of room4Inhibitors) {
            const enemy = this.createEnemy(pos.x, pos.y, 40);
            enemy.tutorialRoomIndex = pos.roomIndex;
            enemy.ultInhibitor = true;
            enemy.ultInhibitRadius = 3;
            const ring = this.add.graphics().setDepth(0.8);
            ring.x = enemy.sprite.x; ring.y = enemy.sprite.y;
            ring.lineStyle(2, 0xff2200, 0.7);
            ring.strokeCircle(0, 0, 3 * this.TILE_SIZE);
            this.tweens.add({ targets: ring, alpha: 0.3, duration: 600, yoyo: true, repeat: -1 });
            const redMark = this.add.graphics().setDepth(2);
            redMark.fillStyle(0xff2200, 0.9);
            redMark.fillCircle(0, 0, 5);
            redMark.lineStyle(2, 0xff6600, 1);
            redMark.strokeCircle(0, 0, 7);
            redMark.x = enemy.sprite.x; redMark.y = enemy.sprite.y - 22;
            // Scale-bob instead of y-bob
            this.tweens.add({ targets: redMark, scaleX: 1.2, scaleY: 1.2, duration: 600, yoyo: true, repeat: -1 });
            enemy._inhibitRing = ring; enemy._inhibitMark = redMark;
        }

        // Room 3 normal enemies
        for (let pos of room4Normal) {
            const enemy = this.createEnemy(pos.x, pos.y, 30);
            enemy.tutorialRoomIndex = pos.roomIndex;
        }

        // Room 2 (ult): shield-immune enemies removed - replaced with ult mechanic focus
    }

    spawnIceTutorialEnemies() {
        // Room 0: no enemies — Glerp welcome

        // Room 1: sword sweep enemies (room1: x=22..38, y=43..56, centre ≈ 30,49)
        const room1Normal = [
            { x: 25, y: 46, roomIndex: 1 }, { x: 28, y: 46, roomIndex: 1 },
            { x: 31, y: 46, roomIndex: 1 }, { x: 34, y: 46, roomIndex: 1 },
            { x: 27, y: 52, roomIndex: 1 }, { x: 32, y: 52, roomIndex: 1 },
        ];
        const room1FireImmune = [
            { x: 24, y: 52, roomIndex: 1 }, { x: 35, y: 52, roomIndex: 1 },
        ];
        const room1Inhibitors = [
            { x: 30, y: 49, roomIndex: 1 },
        ];
        const room1Ranged = [
            { x: 36, y: 46, roomIndex: 1 }, { x: 36, y: 52, roomIndex: 1 },
        ];

        for (let pos of room1Normal) {
            const e = this.createEnemy(pos.x, pos.y, 20);
            e.tutorialRoomIndex = pos.roomIndex;
        }
        for (let pos of room1FireImmune) {
            const e = this.createEnemy(pos.x, pos.y, 25);
            e.tutorialRoomIndex = pos.roomIndex;
            e.fireImmune = true;
            e._fireMark = this.spawnFireMark(e);
        }
        for (let pos of room1Inhibitors) {
            const e = this.createEnemy(pos.x, pos.y, 35);
            e.tutorialRoomIndex = pos.roomIndex;
            e.ultInhibitor = true;
            e.ultInhibitRadius = 3;
            const ring = this.add.graphics().setDepth(0.8);
            ring.x = e.sprite.x; ring.y = e.sprite.y;
            ring.lineStyle(2, 0xff2200, 0.7);
            ring.strokeCircle(0, 0, 3 * this.TILE_SIZE);
            this.tweens.add({ targets: ring, alpha: 0.3, duration: 600, yoyo: true, repeat: -1 });
            const redMark = this.add.graphics().setDepth(2);
            redMark.fillStyle(0xff2200, 0.9); redMark.fillCircle(0, 0, 5);
            redMark.lineStyle(2, 0xff6600, 1); redMark.strokeCircle(0, 0, 7);
            redMark.x = e.sprite.x; redMark.y = e.sprite.y - 22;
            this.tweens.add({ targets: redMark, scaleX: 1.2, scaleY: 1.2, duration: 600, yoyo: true, repeat: -1 });
            e._inhibitRing = ring; e._inhibitMark = redMark;
        }
        for (let pos of room1Ranged) {
            this.createRangedEnemy(pos.x, pos.y, 1);
        }

        // Room 2: ice elemental (room2: x=42..58, y=41..57, centre ≈ 50,49)
        const room2IceElemental = [
            { x: 48, y: 46, roomIndex: 2 },
            { x: 53, y: 52, roomIndex: 2 },
        ];
        for (let pos of room2IceElemental) {
            const e = this.createEnemy(pos.x, pos.y, 60);
            e.tutorialRoomIndex = pos.roomIndex;
            e.iceImmune = true;   // only hurt by shatter (damageEnemyIce when frozen)
            e._iceMark = this.spawnIceMark(e);
        }

        // Room 3: ice ult gate — 10 snipers spread across the room.
        // Blizzard ult pulls them all in, showcasing its crowd-control purpose.
        // room3 bounds: x=62..77, y=43..55 — clustered toward east/back wall
        const room3Snipers = [
            { x: 75, y: 44 }, { x: 73, y: 44 }, { x: 71, y: 44 },
            { x: 76, y: 47 }, { x: 69, y: 47 }, { x: 74, y: 50 },
            { x: 76, y: 52 }, { x: 72, y: 53 }, { x: 68, y: 52 }, { x: 65, y: 50 },
        ];
        for (const pos of room3Snipers) {
            this.createRangedEnemy(pos.x, pos.y, 3);
        }

        // Room 5: mix of all types (room5: x=75..97, y=66..86, centre ≈ 86,76)
        const room5Normal = [
            { x: 79, y: 70 }, { x: 83, y: 70 }, { x: 87, y: 72 },
            { x: 79, y: 80 }, { x: 87, y: 80 },
        ];
        const room5FireImmune = [
            { x: 81, y: 76 }, { x: 89, y: 76 },
        ];
        const room5IceElemental = [
            { x: 85, y: 70 }, { x: 81, y: 80 },
        ];
        for (let pos of room5Normal) {
            const e = this.createEnemy(pos.x, pos.y, 25); e.tutorialRoomIndex = 5;
        }
        for (let pos of room5FireImmune) {
            const e = this.createEnemy(pos.x, pos.y, 25);
            e.tutorialRoomIndex = 5; e.fireImmune = true; e._fireMark = this.spawnFireMark(e);
        }
        for (let pos of room5IceElemental) {
            const e = this.createEnemy(pos.x, pos.y, 60);
            e.tutorialRoomIndex = 5; e.iceImmune = true; e._iceMark = this.spawnIceMark(e);
        }

        // Spawn traps in room 4
        this.spawnIceTraps();

        // Room 6: spawner room — mixed immune + snipers + 3 portal spawners
        const room6FireImmune = [
            { x: 48, y: 70 }, { x: 56, y: 70 }, { x: 48, y: 80 }, { x: 56, y: 80 },
        ];
        const room6IceElemental = [
            { x: 52, y: 68 }, { x: 60, y: 74 }, { x: 52, y: 82 },
        ];
        const room6Ranged = [
            { x: 62, y: 70 }, { x: 62, y: 76 }, { x: 62, y: 82 },
        ];
        for (const pos of room6FireImmune) {
            const e = this.createEnemy(pos.x, pos.y, 30); e.tutorialRoomIndex = 6;
            e.fireImmune = true; e._fireMark = this.spawnFireMark(e);
        }
        for (const pos of room6IceElemental) {
            const e = this.createEnemy(pos.x, pos.y, 60); e.tutorialRoomIndex = 6;
            e.iceImmune = true; e._iceMark = this.spawnIceMark(e);
        }
        for (const pos of room6Ranged) {
            this.createRangedEnemy(pos.x, pos.y, 6);
        }
        this.spawnPortal(47, 68, 6);
        this.spawnPortal(60, 68, 6);
        this.spawnPortal(53, 80, 6);
    }

    // ── Shared mark spawners ───────────────────────────────────────────────

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

    createRangedEnemy(x, y, tutorialRoomIndex) {
        const enemy = this.createEnemy(x, y, 30);
        enemy.tutorialRoomIndex = tutorialRoomIndex;
        enemy.isRanged = true;
        enemy.rangedState = 'idle';

        // Yellow crosshair mark to distinguish from melee
        const mark = this.add.graphics().setDepth(2);
        mark.lineStyle(2, 0xffee00, 0.9);
        mark.strokeCircle(0, 0, 7);
        mark.beginPath(); mark.moveTo(-10, 0); mark.lineTo(10, 0); mark.strokePath();
        mark.beginPath(); mark.moveTo(0, -10); mark.lineTo(0, 10); mark.strokePath();
        mark.x = enemy.sprite.x; mark.y = enemy.sprite.y - 22;
        this.tweens.add({ targets: mark, scaleX: 1.2, scaleY: 1.2, duration: 500, yoyo: true, repeat: -1 });
        enemy._rangedMark = mark;

        return enemy;
    }

    // ─── FLOOR TRAPS ───────────────────────────────────────────────────────────

    spawnIceTraps() {
        // Room 4 bounds: x=82..99, y=41..61
        const poisonPatches = [
            { x: 84, y: 44 }, { x: 90, y: 46 }, { x: 84, y: 53 }, { x: 91, y: 55 },
        ];
        for (const p of poisonPatches) this.spawnPoisonTrap(p.x, p.y);

        const spikeLines = [
            [{ x: 86, y: 49 }, { x: 87, y: 49 }, { x: 88, y: 49 }, { x: 89, y: 49 }],
            [{ x: 94, y: 44 }, { x: 94, y: 45 }, { x: 94, y: 46 }, { x: 94, y: 47 }],
            [{ x: 92, y: 53 }, { x: 93, y: 53 }, { x: 93, y: 54 }, { x: 93, y: 55 }],
        ];
        for (const line of spikeLines)
            for (const s of line) this.spawnSpikeTrap(s.x, s.y);
    }

    // ─── QUEEN SLIME SPAWNERS ────────────────────────────────────────────────
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

    // ─── LIGHTNING TUTORIAL (LEVEL 2) ────────────────────────────────────────

    spawnLevel2Enemies() {
        // Room 0 (start): no enemies

        // Room 1: pillar corridor — 4 normal slimes weaving between pillars
        const r1 = [
            { x: 22, y: 45 }, { x: 28, y: 46 }, { x: 34, y: 45 }, { x: 28, y: 51 }
        ];
        for (const pos of r1) {
            const e = this.createEnemy(pos.x, pos.y, 80);
            e.tutorialRoomIndex = 1;
        }

        // Room 2: wide brawl — mixed fire-immune and ice elementals + normals
        // Normal
        const r2Normal = [ { x: 45, y: 43 }, { x: 55, y: 43 }, { x: 50, y: 50 }, { x: 45, y: 53 } ];
        // Fire-immune (orange mark)
        const r2Fire = [ { x: 53, y: 47 }, { x: 47, y: 47 } ];
        // Ice elemental (blue mark — only ice weapons can hurt)
        const r2Ice = [ { x: 56, y: 53 }, { x: 44, y: 53 } ];

        for (const pos of r2Normal) {
            const e = this.createEnemy(pos.x, pos.y, 80); e.tutorialRoomIndex = 2;
        }
        for (const pos of r2Fire) {
            const e = this.createEnemy(pos.x, pos.y, 100); e.tutorialRoomIndex = 2;
            e.fireImmune = true; e._fireMark = this.spawnFireMark(e);
        }
        for (const pos of r2Ice) {
            const e = this.createEnemy(pos.x, pos.y, 120); e.tutorialRoomIndex = 2;
            e.iceImmune = true; e._iceMark = this.spawnIceMark(e);
        }

        // Room 3: L-shape chokepoint — ranged snipers on far side of dividing wall + normals near entrance
        const r3Normal = [ { x: 66, y: 44 }, { x: 69, y: 52 }, { x: 66, y: 50 } ];
        const r3Ranged = [ { x: 76, y: 43 }, { x: 79, y: 47 }, { x: 76, y: 52 } ];
        const r3Ice = [ { x: 74, y: 44 }, { x: 74, y: 51 } ];

        for (const pos of r3Normal) {
            const e = this.createEnemy(pos.x, pos.y, 80); e.tutorialRoomIndex = 3;
        }
        for (const pos of r3Ranged) {
            this.createRangedEnemy(pos.x, pos.y, 3);
        }
        for (const pos of r3Ice) {
            const e = this.createEnemy(pos.x, pos.y, 120); e.tutorialRoomIndex = 3;
            e.iceImmune = true; e._iceMark = this.spawnIceMark(e);
        }

        // Room 4: trap maze — ult absorbers to punish ult-spamming through traps
        const r4Normal = [ { x: 68, y: 62 }, { x: 80, y: 62 }, { x: 74, y: 70 } ];
        const r4Absorbers = [ { x: 72, y: 65 }, { x: 78, y: 69 } ];

        for (const pos of r4Normal) {
            const e = this.createEnemy(pos.x, pos.y, 80); e.tutorialRoomIndex = 4;
        }
        for (const pos of r4Absorbers) {
            const e = this.createEnemy(pos.x, pos.y, 120); e.tutorialRoomIndex = 4;
            e.isUltAbsorber = true;
            this._applyUltAbsorberVisual(e);
        }

        // Room 5: ambush — mixed types hiding behind pillars
        const r5Normal = [ { x: 41, y: 64 }, { x: 54, y: 64 }, { x: 48, y: 67 }, { x: 41, y: 72 }, { x: 54, y: 72 } ];
        const r5Fire = [ { x: 44, y: 64 }, { x: 52, y: 72 } ];
        const r5Ice = [ { x: 52, y: 64 }, { x: 44, y: 72 } ];
        const r5Absorbers = [ { x: 48, y: 62 } ];

        for (const pos of r5Normal) {
            const e = this.createEnemy(pos.x, pos.y, 100); e.tutorialRoomIndex = 5;
        }
        for (const pos of r5Fire) {
            const e = this.createEnemy(pos.x, pos.y, 100); e.tutorialRoomIndex = 5;
            e.fireImmune = true; e._fireMark = this.spawnFireMark(e);
        }
        for (const pos of r5Ice) {
            const e = this.createEnemy(pos.x, pos.y, 130); e.tutorialRoomIndex = 5;
            e.iceImmune = true; e._iceMark = this.spawnIceMark(e);
        }
        for (const pos of r5Absorbers) {
            const e = this.createEnemy(pos.x, pos.y, 150); e.tutorialRoomIndex = 5;
            e.isUltAbsorber = true;
            this._applyUltAbsorberVisual(e);
        }

        // Room 6: boss arena — no pre-spawned enemies (voltslime spawns separately)
    }

    _applyUltAbsorberVisual(enemy) {
        // Absorbers are tankier — boost health
        enemy.health    = Math.round(enemy.health * 1.8);
        enemy.maxHealth = enemy.health;
        this.updateEnemyHealthBar(enemy);

        // Deep magenta tint on sprite to stand out from red goons
        if (enemy.sprite?.active) enemy.sprite.setTint(0xdd88ff);

        const sx = enemy.sprite.x, sy = enemy.sprite.y;

        // ── Rotating hex rune ring ────────────────────────────────────
        const aura = this.add.graphics().setDepth(1.2);
        aura.x = sx; aura.y = sy;
        aura._rotAngle = 0;

        const drawAura = (g) => {
            g.clear();
            const R = 26, rot = g._rotAngle;
            g.lineStyle(1.5, 0xcc44ff, 0.55); g.strokeCircle(0, 0, R);
            g.fillStyle(0xff88ff, 0.90);
            for (let i = 0; i < 6; i++) {
                const a = (i / 6) * Math.PI * 2 + rot;
                const nx = Math.cos(a) * R, ny = Math.sin(a) * R;
                g.beginPath(); g.moveTo(nx, ny-4); g.lineTo(nx+3, ny); g.lineTo(nx, ny+4); g.lineTo(nx-3, ny); g.closePath(); g.fillPath();
            }
            g.lineStyle(0.8, 0xdd66ff, 0.35);
            for (let i = 0; i < 3; i++) {
                const a = (i / 3) * Math.PI * 2 + rot;
                g.beginPath(); g.moveTo(Math.cos(a)*R*0.85, Math.sin(a)*R*0.85); g.lineTo(Math.cos(a+Math.PI)*R*0.85, Math.sin(a+Math.PI)*R*0.85); g.strokePath();
            }
        };
        drawAura(aura);
        enemy._ultAbsorberAura = aura;

        const rotTimer = this.time.addEvent({
            delay: 50, loop: true,
            callback: () => {
                if (!aura.active) { rotTimer.remove(); return; }
                aura._rotAngle += 0.04;
                drawAura(aura);
            }
        });
        enemy._ultAbsorberRotTimer = rotTimer;

        // ── Crown drain mark above head ───────────────────────────────
        const mark = this.add.graphics().setDepth(3.0);
        mark.x = sx; mark.y = sy - 22;
        mark.fillStyle(0xdd44ff, 0.95);
        mark.fillRect(-7, -2, 14, 4);
        mark.fillTriangle(-6, -2, -3, -2, -4.5, -8);
        mark.fillTriangle(-1, -2,  1, -2,  0,   -9);
        mark.fillTriangle( 3, -2,  6, -2,  4.5, -8);
        mark.lineStyle(1.0, 0xff99ff, 0.85); mark.strokeRect(-7, -2, 14, 4);
        enemy._ultAbsorberMark = mark;
        this.tweens.add({ targets: mark, alpha: 0.55, duration: 600, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    }

}