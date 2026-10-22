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
                                spark.x = this._scrX(playerPx);
                                spark.y = this._scrY(playerPy);
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
                            const fx = this._scrX(playerPx);
                            const fy = this._scrY(playerPy) - 20;
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

        this._tutTips();

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
                    this.showTutorialDialogue(`Slimes down! Now cast your fire ult (${this._k('ult')} or ${this._k('ultFire')}) to open the doors.`, "Glerp");
                }
            } else if (this.isIceTutorial && playerRoom === 3 && !this._iceUltUsed) {
                // Ice tutorial room 3 requires ice ult
                if (!hasEnemies && !this._ultNagShown) {
                    this._ultNagShown = true;
                    this.showTutorialDialogue(`Snipers down! Cast the Blizzard (${this._k('ultIce')}) to open the doors.`, "Glerp");
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
            // Chill bar -- ONE Graphics object now, not three dots.
            if (enemy._chillBar?.active) {
                enemy._chillBar.x = enemy.sprite.x - 11;
                enemy._chillBar.y = enemy.sprite.y - 30;
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

        this._tutSay([
            `Slimes! Left click to punch with your Flame Fists (hold it to keep punching). Their health bars show once they're hurt.`,
            `Fire BURNS: hit something again and again and it keeps taking damage. And if it gets busy, press ${this._k('dash')} to DASH: you zip through enemies and can't be hurt mid-dash.`,
        ], () => this._tutObjective('Defeat the slimes'));
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
        if (!this.tutorialNameEntered) return;
        const name = this.playerName || 'Hero';
        const LESSONS = {
            1: [[`Nice work, ${name}! Now: ULTS. See the four gems at the bottom of the screen? Every element has its own.`,
                 `A gem fills when you hit things with that element. Hit a slime that's carrying ANOTHER element's effect (burning, chilled...) and that's a REACTION: it charges much faster.`,
                 `Full gem? ${this._k('ult')} casts the ult of the element you're holding, and ${this._k('ultFire')} casts the fire ult directly. Once you unlock more elements, ${this._k('ultIce')} ${this._k('ultLightning')} ${this._k('ultCosmic')} cast theirs from anything.`,
                 `Beat these slimes, then cast your fire ult. This room won't open until you do!`],
                'Defeat the slimes, then cast your fire ult'],
            2: [[`See the rings at their feet? Those are RESISTANCE wards. Orange means fire: your fire does about 60% less to them.`,
                 `Fire's all you have for now, so they're TANKY. Keep the pressure on, let their burn tick, and don't let them surround you.`,
                 `Later you'll unlock other elements and can switch to one they don't resist. That's the real answer to a ward!`],
                'Beat the fire-resistant slimes (they take longer)'],
            3: [[`Last room, ${name}! Slimes with a RED ring block your ult while you're near them. Take them out first.`,
                 `Slimes sometimes drop red HEALTH POTS. Walk over one when you're hurt.`],
                'Take out the red-ringed ult blockers first'],
        };
        const L = LESSONS[roomIndex];
        if (L) this._tutSay(L[0], () => this._tutObjective(L[1]));
    }

    _onIceTutorialRoomEnter(roomIndex) {
        // Reset Glerp ice reaction flag each room so it fires once per room
        this._iceGlerpFired = false;
        const name = this.playerName || 'Hero';
        // Room 0: Glerp's welcome back: weapons, and the shape of the fight
        if (roomIndex === 0) {
            this.time.delayedCall(400, () => this._tutSay([
                `Welcome back, ${name}! This time you get the whole toolkit. Fire hits hard, ice controls the crowd, and switching between them mid-fight is the game.`,
                `Each element holds one weapon, and ${this._k('fire')}-${this._k('cosmic')} swap between them. Glurp sells more, and every weapon you own can be upgraded: POWER for damage, and its own PERKS.`,
                `Got the Flame Sword? It sweeps a wide arc, perfect for groups. Let's go!`,
            ], () => this._tutObjective('Head into the next room')));
            // Unlock room 0 doors immediately — no enemies
            this.tutorialDoorsLocked[0] = false;
            this.unlockTutorialDoors(0);
            return;
        }
        const LESSONS = {
            1: [[`A crowd! Read their rings: orange resists fire, blue resists ice, yellow resists lightning. A RED ring blocks your ult while you're close.`,
                 `Resisted isn't immune. It just hurts less, so swap to the element that works and keep swinging.`],
                'Clear the room'],
            2: [[`Something tougher in here. Hit it with fire and see what happens...`], 'Find what works on them'],
            3: [[`Snipers! They hit from range, and you're ICE-ONLY in here. I've filled your ice gem for you.`,
                 `Your ice ult is the BLIZZARD: ${this._k('ult')} holding ice, or ${this._k('ultIce')} from anything. A wave freezes everything it reaches solid, and a moment later the ice shatters by itself, hard.`,
                 `Beat the spitters, then cast the Blizzard. You must use it to leave.`],
                `Ice only: beat the spitters, then cast the Blizzard ${this._k('ultIce')}`],
            4: [[`New faces! Every slime has its own trick, so learn to read them.`,
                 `The BERSERKER winds up, then lunges: step aside when it shakes. The SPLITTER breaks into smaller slimes when it dies, so finish the pieces. The MORTAR lobs shells: the circle on the floor is where it lands, so move off it.`,
                 `Dash ${this._k('dash')} out of trouble: you can't be hurt mid-dash. And grab any health pots the slimes drop.`],
                'Beat the berserker, the splitter and the mortar'],
            5: [[`Final mix, ${name}! The best combo: ice cubes them, and while they're cubed, a chunk of their health is cracked off (BRITTLE).`,
                 `Hit a cubed slime with fire before it thaws and that chunk is gone for good. Fire on a chilled slime, or ice on a burning one, is a REACTION, and reactions fill your ult gems fast.`],
                'Cube them with ice, then hit them with fire'],
            6: [[`PORTALS! They keep spawning slimes until they're destroyed. Break every portal to clear the room.`,
                 `Snipers too. Keep moving, use both elements: you've got the full toolkit now!`],
                'Destroy every portal'],
        };
        if (roomIndex === 3 && this.ultGems) { this.ultGems.ice = this.ultChargeMax; this._ultNoChargeUntil && (this._ultNoChargeUntil.ice = 0); this.updateHUD?.(); }   // the sniper room: the Blizzard is the lesson, so it's ready
        const L = LESSONS[roomIndex];
        if (L) this._tutSay(L[0], () => this._tutObjective(L[1]));
    }

    _triggerIceImmuneGlerpReaction() {
        if (!this.isIceTutorial || this._iceGlerpFired) return;
        const room = this.getCurrentPlayerRoom();
        if (room < 2) return;
        this._iceGlerpFired = true;
        // Unlock ice switching immediately
        this.tutorialIceUnlocked = true;
        this.time.delayedCall(250, () => {
            this._tutSay([
                `Whoa, that barely scratched it! See the orange ring? These slimes RESIST fire.`,
                `Press ${this._k('ice')} for ICE and hit them. Every hit stacks chill, and a full bar freezes them into a cube that cracks a chunk off their health!`,
            ], () => this._tutObjective(`Switch to Ice ${this._k('ice')}: freeze and shatter them`));
        });
    }

    startTutorialIntro() {
        // Small delay to ensure world is rendered
        this.time.delayedCall(500, () => {
            // Spawn Yellow Slime NPC
            const npcX = 13;   // (17, 51 was the room's middle: where you spawn, so you stood on him)
            const npcY = 53;

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
        this._tutSay([
            `Nice to meet you, ${this.playerName}! Let's get you ready for the dungeon.`,
            `Move with ${this._k('up')} ${this._k('left')} ${this._k('down')} ${this._k('right')}. Rooms seal when you walk in, and open again once every slime in them is gone.`,
            `See those shiny things? GLORPS, the dungeon's money. Glurp's shop takes them for weapons, upgrades and training. Go grab them!`,
        ], () => {
            this.spawnTutorialGlorps();
            this._tutObjective('Collect the 3 Glorps');
        });
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
            fontSize: '9px', fontFamily: UIKit.FONT.title, fontStyle: 'bold', color: '#7dffc8', resolution: 2,
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
        if (this.tutorialRoomCleared[roomIndex]) return;   // once: each ult press used to clear it again (a second chest)
        this.tutorialRoomCleared[roomIndex] = true;

        // Ice tutorial room 6 = final room
        if (this.isIceTutorial && roomIndex === 6) {
            this.time.delayedCall(600, () => {
                this._tutObjective(null);
                this._tutSay([
                    `You did it, ${this.playerName || 'Hero'}! Fire, ice, positioning, traps, portals: you handled it all.`,
                    `Out there, THE GAUNTLET earns you LIGHTNING and THE VOID RIFT earns you COSMIC. Clearing a level for the first time pays FRAGMENTS too.`,
                    `At Glurp's: new weapons and their upgrades, STATS to train (keep them even: every 5 levels earns a talent), ULT STAGES (glorps + fragments) and GADGETS for ${this._k('gadget1')} and ${this._k('gadget2')}.`,
                    `Settings and keybinds live in the lobby. The real dungeon awaits. Don't die... Glerp believes in you. Probably.`,
                ], () => this.endTutorialReturnToMenu());
            });
            return;
        }

        this.spawnTutorialChest(roomIndex);
        this._tutObjective('Walk onto the chest to open it');
        this.time.delayedCall(1000, () => {
            if ((this.tutorialChests || []).some(c => c.roomIndex === roomIndex && !c.opened))   // not if you beat me to it
                this.showTutorialDialogue("Room cleared! Walk onto the chest to open it.", "Glerp");
        });
    }

    // isInCurrentRoom, lockTutorialDoors, unlockTutorialDoors moved to LevelManager —
    // used by every level's combat/door-seal logic, not tutorial-exclusive
    // (getCurrentPlayerRoom, isInLockedRoom also moved there for the same reason)

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

        // The chest (Loot.js): oak and iron, lid and body apart so the lid can open. It sits on
        // the floor (it used to bob in the air).
        const { container, body, lid, glow, shadow } = LootFX.chest(this, cx, cy, 'wood');
        const bobTween = null;

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
            // this room's chest (it looked for room 3's, which no chest room is: none of them opened)
            const chest = (this.tutorialChests || []).find(c => c.roomIndex === roomIndex && !c.opened);
            if (!chest) return;
            chest.opened = true;
            this.tweens.killTweensOf(chest.container);

            if (chest.isMimic && !chest._mimicTriggered) {
                chest._mimicTriggered = true;
                this.cameras.main.shake(80, 0.007);
                if (chest.lid?.active) this.tweens.add({ targets: chest.lid, y: chest.lid.y - 5, duration: 60, yoyo: true, repeat: 4 });   // it snaps
                this.tweens.add({ targets: chest.container, angle: 15, duration: 60, yoyo: true, repeat: 4, onComplete: () => {
                    chest.container.destroy();
                    const offsets = [{x:0,y:-1},{x:1,y:0},{x:0,y:1},{x:-1,y:0},{x:1,y:-1}];
                    for (const off of offsets) {
                        const ex = chest.tileX + off.x, ey = chest.tileY + off.y;
                        if (this.world[ex]?.[ey] === this.FLOOR) {
                            const e = this.createEnemy(ex, ey, 40);
                            e.tutorialRoomIndex = roomIndex;
                            e.sprite.setTint(0xff4444);
                        }
                    }
                    this.showStatusText(chest.tileX * this.TILE_SIZE + this.TILE_SIZE/2, chest.tileY * this.TILE_SIZE - 10, 'MIMIC!', '#ff4444');
                }});
            } else if (!chest.isMimic) {
                // Loot.js: the lid flips back, light and coins spill, the chest fades
                LootFX.open(this, chest);
                this.cameras.main.shake(50, 0.003);

                // Reward: 30 glorps + small pot chance
                this.totalGlorps = (this.totalGlorps || 0) + 30;
                localStorage.setItem('glorps', this.totalGlorps);
                if (this.glorpText) this.glorpText.setText(`✦ ${this.totalGlorps} Glorps`);
                LootFX.reward(this, chest.tileX * this.TILE_SIZE + this.TILE_SIZE / 2, chest.tileY * this.TILE_SIZE - 4, '+30');
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

        // Open animation (Loot.js): the lid flips back, light and coins spill out, the chest fades
        if (chest) LootFX.open(this, chest);
        else this.tweens.add({ targets: container, scaleX: 1.5, scaleY: 1.5, alpha: 0, duration: 300, onComplete: () => container?.destroy() });
        this.cameras.main.shake(60, 0.004);

        // Rewards — level 2 just gives glorps, no tutorial reward system
        let reward;
        if (this.isLevel2) {
            reward = { type: 'glorps', amount: 20, message: null };
        } else if (this.isLevel6) {   // the Cistern's room chests: deeper, so more, and no tutorial lines
            reward = { type: 'glorps', amount: 35, message: null };
        } else if (this.isIceTutorial) {
            const iceRewards = [
                null, // room 0: no chest
                { type: 'glorps', amount: 15, message: "15 Glorps! Keep pushing forward." },
                { type: 'glorps', amount: 20, message: "20 Glorps! Freeze, then shatter: practice that combo." },
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
                { type: 'glorps', amount: 20, message: "20 Glorps! Switching elements mid-fight is how you win." },
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
            // +N, rising off the chest (Loot.js)
            LootFX.reward(this, container.x, container.y - 14, `+${reward.amount}`);
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

        if (this.isTutorial) this._tutObjective('Head to the next room');
        // Fire tutorial room 3 → pit sequence; level 2/3/4 → no dialogue; others → show reward message
        if (this.isLevel2 || this.isLevel3 || this.isLevel4 || this.isLevel6 || !this.isTutorial) {
            // No Glerp dialogue in real dungeon levels (the Cistern's chests fell through to the fire tutorial's lines)
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

        // A void rift torn in the floor (it was three plain circles): a rim of broken stone with violet cracks running out of it,
        // a dark vortex inside turning slowly (a spiral in a container squashed flat, so it lies on the floor), motes drawn in.
        const T = this.TILE_SIZE;
        const rimKey = MenuArt.tex(this, 'tut_rift_rim', 72, 44, P => {
            const R = MenuArt.rng(77), cx = 36, cy = 22;
            for (let y = 0; y < 44; y++) for (let x = 0; x < 72; x++) {
                const d = Math.hypot((x + 0.5 - cx) / 30, (y + 0.5 - cy) / 17);
                if (d < 0.82 || d > 1.06) continue;
                if (R() < 0.18) continue;   // broken, not a clean ring
                P.put(x, y, d < 0.9 ? 0x1a1024 : R() < 0.5 ? 0x4a4058 : 0x6a5e78);
            }
            for (let k = 0; k < 9; k++) {   // cracks, glowing violet, running out across the floor
                let a = k / 9 * Math.PI * 2 + R() * 0.4, r = 0.95, x = cx + Math.cos(a) * 30 * r, y = cy + Math.sin(a) * 17 * r;
                for (let j = 0; j < 6 + R() * 6; j++) { a += (R() - 0.5) * 0.7; x += Math.cos(a) * 1.4; y += Math.sin(a) * 0.8; P.put(x, y, j < 3 ? 0xc07cff : 0x6a3aa8); }
            }
        });
        const coreKey = MenuArt.tex(this, 'tut_rift_core', 56, 56, P => {
            for (let y = 0; y < 56; y++) for (let x = 0; x < 56; x++) {
                const dx = x + 0.5 - 28, dy = y + 0.5 - 28, d = Math.hypot(dx, dy) / 27;
                if (d > 1) continue;
                const arm = Math.sin(Math.atan2(dy, dx) * 3 + d * 9);   // three spiral arms
                const c = d < 0.22 ? 0x000000 : arm > 0.55 ? (d < 0.6 ? 0xd8a8ff : 0x9a5cf0) : arm > 0.1 ? 0x4a1a8a : d > 0.92 ? 0x2a0a4a : 0x12041e;
                P.put(x, y, c);
            }
            for (const [x, y] of [[12, 20], [40, 14], [44, 38], [18, 42], [28, 8]]) P.put(x, y, 0xffffff);   // stars caught in it
        });
        const floorY = 0.6;
        const holder = this.add.container(pitPx, pitPy).setDepth(0.85).setScale(1.25, 1.25 * floorY);
        const core = this.add.image(0, 0, coreKey).setScale(T / 20);
        holder.add(core);
        this.tweens.add({ targets: core, angle: -360, duration: 7000, repeat: -1 });
        const glow = this.textures.exists('vfx_glow') ? this.add.image(pitPx, pitPy, 'vfx_glow').setTint(0x9a5cf0).setBlendMode(Phaser.BlendModes.ADD).setScale(0.9, 0.55).setAlpha(0.55).setDepth(0.86) : null;
        if (glow) this.tweens.add({ targets: glow, alpha: 0.25, duration: 1100, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
        const rim = this.add.image(pitPx, pitPy, rimKey).setScale(T / 20).setDepth(0.87);
        const motes = this.add.particles(0, 0, this.textures.exists('vfx_dot') ? 'vfx_dot' : 'mn_px2', {   // (mn_px2 is a menu texture: a level has vfx_dot)
            emitZone: { type: 'edge', source: new Phaser.Geom.Ellipse(pitPx, pitPy, T * 4.4, T * 2.6), quantity: 24 },
            moveToX: pitPx, moveToY: pitPy, lifespan: 900, scale: { start: 0.6, end: 0.1 }, alpha: { start: 0.9, end: 0 },
            tint: [0xd8a8ff, 0x9a5cf0, 0xffffff], blendMode: 'ADD', frequency: 70 }).setDepth(0.88);

        // Floating "JUMP IN" text above pit
        const pitLabel = this.add.text(pitPx, pitPy - T * 1.6, '▼ JUMP IN ▼', {
            fontSize: '13px', fontFamily: UIKit.FONT.title, fontStyle: 'bold', color: '#e0c0ff',
            stroke: '#12041e', strokeThickness: 4
        }).setOrigin(0.5).setDepth(5);
        this.tweens.add({ targets: pitLabel, y: pitPy - T * 1.6 - 6, duration: 600, yoyo: true, repeat: -1 });
        const ring1 = holder, ring2 = rim, ring3 = motes;   // (kept in _tutorialPit under the old names)

        this._tutorialPit = { pitX, pitY, glow, ring1, ring2, ring3, pitLabel };

        this._tutObjective('Jump into the pit');
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

        // The jump: a hop up off the floor, stretching, then a dive into the middle of the rift, spinning and shrinking away
        // (its fists hidden: Creatures.gear), the rift flaring as it takes you, then the screen goes black
        const p = this.player, T = this.TILE_SIZE, P = this._tutorialPit, cx = P.pitX * T + T / 2, cy = P.pitY * T + T / 2;
        const sx = p.scaleX, sy = p.scaleY, y0 = p.y;
        this.tweens.killTweensOf(p); this._step = null;
        this._tutFalling = true;
        Sfx.play(this, 'swing', { soft: true });
        this.tweens.add({ targets: p, x: cx, y: y0 - 20, scaleX: sx * 0.85, scaleY: sy * 1.2, duration: 230, ease: 'Quad.easeOut', onComplete: () => {
            Sfx.play(this, 'whoosh');
            this.tweens.add({ targets: p, y: cy - 2, scaleX: sx * 0.12, scaleY: sy * 0.12, angle: 200, alpha: 0, duration: 420, ease: 'Quad.easeIn', onComplete: () => {
                p.setVisible(false);
                Sfx.play(this, 'portal', { close: true });
                this._vfxFlash?.(cx, cy, T * 3, 0xc07cff, 360, 0.9);
                const core = P.ring1?.list?.[0];   // the vortex spins up as it swallows you
                if (core) { this.tweens.killTweensOf(core); this.tweens.add({ targets: core, angle: core.angle - 720, duration: 900, ease: 'Cubic.easeOut' }); }
                if (P.ring1) this.tweens.add({ targets: P.ring1, scaleX: P.ring1.scaleX * 1.25, scaleY: P.ring1.scaleY * 1.25, duration: 160, yoyo: true, ease: 'Quad.easeOut' });
            } });
        } });

        // Screen fades to black (its fill opaque, the rectangle fading in: a fill alpha of 0 left it invisible however the alpha went)
        const blackOut = this.add.rectangle(W / 2, H / 2, W, H, 0x000000, 1).setAlpha(0)
            .setDepth(2000).setScrollFactor(0);
        this.tweens.add({
            targets: blackOut,
            alpha: 1,
            duration: 500,
            delay: 700,
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
            this._tutSay([
                "Anyway! You've got the basics. Next stop: Glurp's shop.",
                "Buy the Flame Sword. It costs 100 Glorps, exactly what you collected! Then come back for the Ice tutorial.",
            ], () => this.endTutorialReturnToMenu());
        });
    }

    endTutorialReturnToMenu() {
        const W = this.scale.width;
        const H = this.scale.height;

        // Save glorps to localStorage. totalGlorps is the whole balance (the HUD loads it from
        // here and every pickup writes it back), so adding the saved figure on top of it
        // doubled every glorp picked up in a tutorial.
        localStorage.setItem('glorps', this.totalGlorps || 0);

        if (this.isIceTutorial) {
            localStorage.setItem('iceTutorialComplete', '1');
            Progress.clear('tutorial');   // both halves done: The Gauntlet opens
            localStorage.setItem('unlocked_ice', 'true');
        } else {
            localStorage.setItem('fireTutorialComplete', '1');
        }

        const flash = this.add.rectangle(W / 2, H / 2, W, H, 0xffffff, 1).setAlpha(0)
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

    // Glerp's speech box, along the bottom: a panel, his portrait, the line typing itself out
    // (a click or Enter finishes it, the next one moves on), and a page count when it's one of
    // a run (_tutSay). Used by every level for its story beats too.
    showTutorialDialogue(message, speakerName = null, onComplete = null, page = null) {
        this.clearTutorialDialogue();
        const W = this.scale.width, H = this.scale.height, P = UIKit.PALETTE, D = 1000;
        const bw = Math.min(980, W - 80), bh = 132, bx = W / 2 - bw / 2, by = H - bh - 78;   // above the ult gems
        this._dialogueObjects = [];
        const keep = o => { this._dialogueObjects.push(o); o.setScrollFactor?.(0); return o; };
        this._dialogueObjects.push(...UIKit.panel(this, { x: bx, y: by, w: bw, h: bh, accent: P.accentGold, depth: D }).objs);
        let tx = bx + 28;
        if (speakerName) {
            const portrait = keep(this.add.sprite(bx + 62, by + bh / 2 - 22, 'slime_orange', 0).setScale(3.4).setDepth(D + 2));   // the slime fills its frame's bottom
            portrait.play('orange_idle');
            if (typeof CreatureFX !== 'undefined') CreatureFX.face(this, portrait, { mood: 'friend', look: () => null });   // Creatures.js
            this.tweens.add({ targets: portrait, y: portrait.y - 4, duration: 520, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
            keep(this.add.text(bx + 62, by + 16, speakerName.toUpperCase(), {
                fontSize: '13px', fontFamily: UIKit.FONT.title, fontStyle: 'bold', color: '#f6d58a', stroke: '#000', strokeThickness: 3,
            }).setOrigin(0.5, 0).setDepth(D + 2));
            tx = bx + 120;
        }
        const msg = keep(this.add.text(tx, by + 22, '', {
            fontSize: '16px', fontFamily: 'monospace', color: UIKit.CSS.textHi, lineSpacing: 6,
            wordWrap: { width: bx + bw - 28 - tx },
        }).setDepth(D + 1));
        const foot = keep(this.add.text(bx + bw - 22, by + bh - 14, (page ? `${page[0]} / ${page[1]}   ` : '') + '▼ click or Enter', {
            fontSize: '11px', fontFamily: 'monospace', color: '#d2bf98',
        }).setOrigin(1, 1).setDepth(D + 1).setAlpha(0));
        // type it out, two letters a frame
        let n = 0;
        const typer = this.time.addEvent({ delay: 16, loop: true, callback: () => {
            n = Math.min(message.length, n + 2);
            msg.setText(message.slice(0, n));
            if (speakerName && (n >> 1) % 5 === 0 && /[a-z0-9]/i.test(message[n - 1] || '')) Sfx.play(this, 'blip', { v: speakerName.toLowerCase() });   // the speaker's voice, every few letters
            if (n >= message.length) { typer.remove(); foot.setAlpha(1); this.tweens.add({ targets: foot, alpha: 0.45, duration: 600, yoyo: true, repeat: -1 }); }
        } });
        this._dialogueTyper = typer;
        const advance = () => {
            if (this._pauseMenuOpen) return;   // clicks and Enter are the pause menu's while it's open
            if (n < message.length) { n = message.length - 2; return; }   // first press: finish the line
            this.clearTutorialDialogue();
            if (onComplete) onComplete();
        };
        this.dialogueClickHandler = advance;
        this.input.on('pointerdown', advance);
        this._dialogueKeyHandler = advance;
        this.input.keyboard?.on('keydown-ENTER', advance);
    }

    // A run of lines, one after another (page counts on each), then `onDone`.
    _tutSay(lines, onDone = null, speaker = 'Glerp') {
        const go = (i) => this.showTutorialDialogue(lines[i], speaker, i + 1 < lines.length ? () => go(i + 1) : onDone || (() => {}), lines.length > 1 ? [i + 1, lines.length] : null);
        go(0);
    }
    // A key as it's bound right now (Settings.js), in brackets: _k('dash') → '[Space]'.
    _k(id) { return `[${Settings.label(Settings.key(id))}]`; }

    // What to do right now, under the clock. Null clears it.
    _tutObjective(text) {
        const o = this._tutObj;
        if (!text) { if (o) { o.box.destroy(); o.txt.destroy(); this._tutObj = null; } return; }
        if (!o?.txt?.active) {
            const box = this.add.graphics().setScrollFactor(0).setDepth(39);
            const txt = this.add.text(this.scale.width / 2, 44, '', {
                fontSize: '13px', fontFamily: 'monospace', fontStyle: 'bold', color: '#f6d58a', stroke: '#05060a', strokeThickness: 3,
            }).setOrigin(0.5, 0).setScrollFactor(0).setDepth(40);
            this._tutObj = { box, txt };
        }
        const { box, txt } = this._tutObj;
        txt.setText('◆ ' + text);
        box.clear().fillStyle(0x0b0d16, 0.78).fillRoundedRect(txt.x - txt.width / 2 - 12, 40, txt.width + 24, txt.height + 8, 6)
           .lineStyle(1, 0xf0b84a, 0.6).strokeRoundedRect(txt.x - txt.width / 2 - 12, 40, txt.width + 24, txt.height + 8, 6);
        this.tweens.add({ targets: txt, scale: { from: 1.15, to: 1 }, duration: 220, ease: 'Back.easeOut' });
    }

    // Once each, during a tutorial: the first full ult gem, the first time you're badly hurt.
    _tutTips() {
        if (!this.isTutorial || this._dialogueObjects) return;
        const seen = this._tutSeen || (this._tutSeen = {});
        const KEY = { fire: 'ultFire', ice: 'ultIce', lightning: 'ultLightning', cosmic: 'ultCosmic' };
        for (const el of this.isIceTutorial ? ['fire', 'ice'] : ['fire']) {   // only what you have
            if (!seen['gem_' + el] && (this.ultGems?.[el] || 0) >= this.ultChargeMax) {
                seen['gem_' + el] = true;
                this.showTutorialDialogue(`Your ${el.toUpperCase()} gem is full! Cast it with ${this._k('ult')} while holding ${el}, or ${this._k(KEY[el])} from any element.`, 'Glerp');
                return;
            }
        }
        if (!seen.hurt && this.health > 0 && this.health < (this.maxHealth || 100) * 0.4) {
            seen.hurt = true;
            this.showTutorialDialogue(`You're hurt! Slimes sometimes drop red HEALTH POTS: walk over one to heal. ${this._k('dash')} dashes you out of a crowd, and you can't be hit mid-dash.`, 'Glerp');
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
        if (this._dialogueKeyHandler) { this.input.keyboard?.off('keydown-ENTER', this._dialogueKeyHandler); this._dialogueKeyHandler = null; }
        if (this._dialogueTyper) { this._dialogueTyper.remove(); this._dialogueTyper = null; }
    }

    // ─── PAUSE MENU ────────────────────────────────────────────────────────────

    // spawnEnemies (level dispatcher) moved to LevelManager — routes to all levels,
    // not tutorial-specific, even though it happened to live here historically

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
            this._tagResist(enemy, 'fire');
        }

        // Room 3: ult-inhibiting enemies
        for (let pos of room4Inhibitors) {
            const enemy = this.createEnemy(pos.x, pos.y, 40);
            enemy.tutorialRoomIndex = pos.roomIndex;
            this._ultBlockerFx(enemy, false);   // its zone and mark (radius ULT_BLOCK_R)
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
            this._tagResist(e, 'fire');
        }
        for (let pos of room1Inhibitors) {
            const e = this.createEnemy(pos.x, pos.y, 35);
            e.tutorialRoomIndex = pos.roomIndex;
            this._ultBlockerFx(e, false);   // its zone and mark (radius ULT_BLOCK_R)
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
            this._tagResist(e, 'fire');   // the ice tutorial's lesson: fire barely touches these, ice does
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
            e.tutorialRoomIndex = 5; this._tagResist(e, 'fire');
        }
        for (let pos of room5IceElemental) {
            const e = this.createEnemy(pos.x, pos.y, 60);
            e.tutorialRoomIndex = 5; this._tagResist(e, 'fire');   // the ice tutorial's lesson: fire barely touches these, ice does
        }

        // Spawn traps in room 4
        // room 4: the basic slime types (it was a spike and poison trap room)
        this.createBerserker(86, 46, 4); this.createSplitter(94, 47, 4); this.createMortar(95, 57, 4);
        for (const [x, y] of [[85, 55], [91, 52]]) { const e = this.createEnemy(x, y, 25); e.tutorialRoomIndex = 4; }

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
            this._tagResist(e, 'fire');
        }
        for (const pos of room6IceElemental) {
            const e = this.createEnemy(pos.x, pos.y, 60); e.tutorialRoomIndex = 6;
            this._tagResist(e, 'fire');   // the ice tutorial's lesson: fire barely touches these, ice does
        }
        for (const pos of room6Ranged) {
            this.createRangedEnemy(pos.x, pos.y, 6);
        }
        this.spawnPortal(47, 68, 6);
        this.spawnPortal(60, 68, 6);
        this.spawnPortal(53, 80, 6);
    }

    // already used by Level 2/3's elemental-immune enemies, not tutorial-exclusive

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

    // spawnLevel1Enemies moved to LevelManager — alongside Level 2/3/4's equivalents

    // ─── LIGHTNING TUTORIAL (LEVEL 2) ────────────────────────────────────────

    // The ult blockers' look (inhibitors red, absorbers violet): their zone on the floor, ULT_BLOCK_R tiles, the radius the cast
    // check uses (ElementSystem.activateUlt, Cosmic's transform), a filled disc with a dashed ring turning slowly and rune ticks; a
    // pixel mark over the head (an ult gem struck through, or being drained). Follows the enemy each frame, gone when it is.
    // (It was a thin 3-tile circle and a red dot, and the check was a diamond that didn't match the circle.)
    static ULT_BLOCK_R = 5;
    static ABSORB_R = 3;   // the absorbers' zone, smaller (5 till 2026-10-21)
    _ultBlockerFx(enemy, absorb) {
        const R = absorb ? TutorialManager.ABSORB_R : TutorialManager.ULT_BLOCK_R, T = this.TILE_SIZE, col = absorb ? 0xb05cff : 0xff3a2a, hi = absorb ? 0xe0b0ff : 0xffa080;
        if (absorb) enemy.isUltAbsorber = true; else enemy.ultInhibitor = true;
        enemy.ultInhibitRadius = R;
        // soft, like the other enemies' fields (the Mortar's, the Anchor's): a glow over the zone, a soft rim, a ripple now and then
        const r = R * T, x0 = enemy.sprite.x, y0 = enemy.sprite.y;
        const field = VisualFX.aura(this, x0, y0, r, col, { style: 'field', depth: 0.8, alpha: absorb ? 0.2 : 0.45 });
        const rim = VisualFX.aura(this, x0, y0, r, hi, { style: 'ring', depth: 0.81, alpha: absorb ? 0.35 : 0.6 });
        const pulse = this.time.addEvent({ delay: 2600, loop: true, callback: () => { if (enemy.sprite?.active) VisualFX.ripple(this, enemy.sprite.x, enemy.sprite.y, r * 0.3, r, col, { depth: 0.82, duration: 1400, alpha: 0.5 }); } });
        const ring = field;   // (what the rest of the game moves and destroys as _inhibitRing; the rim and the ripples go with it)
        field.once('destroy', () => { if (rim.active) rim.destroy(); pulse.remove(); });
        const key = ShopScene.icon(this, absorb ? 'fx_ultblock_drain' : 'fx_ultblock_ban', 12, { G: absorb ? '#c48aff' : '#9fe8ff', g: absorb ? '#7a3ad8' : '#4aa8d8', r: '#ff3a2a' }, m => {
            m.poly([[6, 1], [10, 6], [6, 11], [2, 6]], 'G'); m.poly([[6, 1], [10, 6], [6, 11]], 'g'); m.set(5, 4, 'W');
            if (absorb) { m.set(6, 0, 'g'); m.set(3, 2, 'g'); m.set(9, 2, 'g'); } else m.line(1, 10, 10, 1, 'r');
        });
        const mark = this.add.image(enemy.sprite.x, enemy.sprite.y - 24, key).setDepth(4.4);
        this.tweens.add({ targets: mark, scale: 1.15, duration: 700, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
        enemy._inhibitRing = ring; enemy._inhibitMark = mark;
        const follow = () => {
            if (!enemy.sprite?.active || enemy.health <= 0 || !ring.active) { this.events.off('update', follow); for (const o of [ring, mark]) if (o.active) { this.tweens.killTweensOf(o); o.destroy(); } return; }
            for (const o of [field, rim]) { if (o.x !== enemy.sprite.x || o.y !== enemy.sprite.y) { o.setPosition(enemy.sprite.x, enemy.sprite.y); VisualFX.clipAura(this, o); } }
            mark.setPosition(enemy.sprite.x, enemy.sprite.y - 24);
            if (absorb && this.time.now - (enemy._absMoteAt || 0) > 110) {   // an absorber's zone pulls: motes drift in from its edge and vanish into it
                enemy._absMoteAt = this.time.now;
                const a = Math.random() * Math.PI * 2, sx = enemy.sprite.x, sy = enemy.sprite.y;
                const m = this.add.rectangle(sx + Math.cos(a) * r * 0.95, sy + Math.sin(a) * r * 0.95, 2, 2, Math.random() < 0.3 ? 0xffffff : hi).setBlendMode(Phaser.BlendModes.ADD).setDepth(0.85).setAlpha(0);
                this.tweens.add({ targets: m, x: sx + Math.cos(a + 0.6) * 6, y: sy + Math.sin(a + 0.6) * 6, duration: 1400, ease: 'Quad.easeIn', onUpdate: tw => m.setAlpha(Math.sin(tw.progress * Math.PI) * 0.8), onComplete: () => m.destroy() });
            }
        };
        this.events.on('update', follow); this.events.once('shutdown', () => this.events.off('update', follow));
    }

    _applyUltAbsorberVisual(enemy) {
        // Absorbers are tankier — boost health
        enemy.health    = Math.round(enemy.health * 1.8);
        enemy.maxHealth = enemy.health;
        this.updateEnemyHealthBar(enemy);

        // Deep magenta tint on sprite to stand out from red goons
        if (enemy.sprite?.active) enemy.sprite.setTint(0xdd88ff);
        this._ultBlockerFx(enemy, true);
    }

}