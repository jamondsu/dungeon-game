// ═══════════════════════════════════════════════════════════════════════════
// LEVELMANAGER.JS — Real dungeon level logic (level 2+)
// All methods use .call(this) from GameScene via proxy stubs, same as other modules.
// ═══════════════════════════════════════════════════════════════════════════

class LevelManager {

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
        // R1: pillar gauntlet
        const r1 = [
            { x: 23, y: 45 }, { x: 23, y: 50 },
            { x: 34, y: 45 }, { x: 34, y: 50 },
        ];
        for (const p of r1) { const e = this.createEnemy(p.x, p.y, 30); e.tutorialRoomIndex = 1; }
        this.createRangedEnemy(29, 47, 1);

        // R2: wide brawl
        const r2Normal = [{ x: 45, y: 43 }, { x: 50, y: 54 }, { x: 55, y: 43 }];
        const r2Fire   = [{ x: 47, y: 50 }, { x: 54, y: 50 }];
        for (const p of r2Normal) { const e = this.createEnemy(p.x, p.y, 35); e.tutorialRoomIndex = 2; }
        for (const p of r2Fire)   { const e = this.createEnemy(p.x, p.y, 35); e.tutorialRoomIndex = 2; e.fireImmune = true; e._fireMark = this.spawnFireMark(e); }
        this.createRangedEnemy(57, 43, 2);

        // Chest branch rooms — spawn chests in each isChestRoom
        this._spawnLevel2ChestRooms();

        // R3: L-shape
        const r3 = [{ x: 76, y: 42 }, { x: 79, y: 42 }, { x: 82, y: 43 }];
        const r3f = [{ x: 77, y: 51 }, { x: 80, y: 52 }];
        for (const p of r3)  { const e = this.createEnemy(p.x, p.y, 38); e.tutorialRoomIndex = 3; }
        for (const p of r3f) { const e = this.createEnemy(p.x, p.y, 38); e.tutorialRoomIndex = 3; e.fireImmune = true; e._fireMark = this.spawnFireMark(e); }

        // R4: spike maze
        const spikeRow1 = [{ x:67,y:62 },{ x:68,y:62 },{ x:69,y:62 },{ x:72,y:62 },{ x:73,y:62 }];
        const spikeRow2 = [{ x:67,y:65 },{ x:68,y:65 },{ x:71,y:65 },{ x:72,y:65 },{ x:73,y:65 }];
        for (const s of spikeRow1) this.spawnSpikeTrap(s.x, s.y);
        for (const s of spikeRow2) this.spawnSpikeTrap(s.x, s.y);
        this.spawnPoisonTrap(79, 61); this.spawnPoisonTrap(79, 68);
        [{ x:70,y:62 }, { x:75,y:69 }, { x:82,y:65 }].forEach(p => { const e = this.createEnemy(p.x, p.y, 40); e.tutorialRoomIndex = 4; });
        this.createRangedEnemy(78, 62, 4);

        // R5: ambush
        const r5  = [{ x:40,y:63 },{ x:40,y:70 },{ x:46,y:67 },{ x:51,y:63 },{ x:51,y:71 }];
        const r5f = [{ x:45,y:62 },{ x:53,y:70 }];
        for (const p of r5)  { const e = this.createEnemy(p.x, p.y, 40); e.tutorialRoomIndex = 5; }
        for (const p of r5f) { const e = this.createEnemy(p.x, p.y, 40); e.tutorialRoomIndex = 5; e.fireImmune = true; e._fireMark = this.spawnFireMark(e); }
        this.createRangedEnemy(55, 63, 5); this.createRangedEnemy(55, 70, 5);

        // Boss arena guards
        const bossIdx = 6;
        [{ x:8,y:61 },{ x:24,y:61 },{ x:8,y:73 },{ x:24,y:73 }].forEach(p => {
            const e = this.createEnemy(p.x, p.y, 45); e.tutorialRoomIndex = bossIdx;
        });
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
        boss.hp -= damage;
        boss.hpBar.width = 72 * Math.max(0, boss.hp / boss.maxHp);
        boss.body.setTint(0xffffff);
        this.time.delayedCall(80, () => { if (boss.body?.active) boss.body.setTint(0x88ffff); });
        if (boss.hp <= 0) this._killVoltslimeBoss();
    }

    damageBossAtTile(tileX, tileY, damage) {
        if (!this.voltslimeBoss?.active) return false;
        const boss = this.voltslimeBoss;
        if (Math.abs(tileX - boss.tileX) <= 1 && Math.abs(tileY - boss.tileY) <= 1) {
            this.damageVoltslimeBoss(damage);
            return true;
        }
        return false;
    }

    _killVoltslimeBoss() {
        const boss = this.voltslimeBoss;
        if (!boss?.active) return;
        boss.active = false;
        for (const p of [...boss.projectiles, ...boss.homingProjectiles]) { if (p.g?.active) p.g.destroy(); }
        boss.projectiles = []; boss.homingProjectiles = [];
        if (boss.aura?.active) boss.aura.destroy();

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
        const alreadyHad = localStorage.getItem(`unlocked_${element}`) === 'true';
        localStorage.setItem(`unlocked_${element}`, 'true');
        if (!this.unlockedElements) this.unlockedElements = new Set(['fire','ice']);
        this.unlockedElements.add(element);

        this.time.delayedCall(600, () => this._showElementUnlockCinematic(element, alreadyHad));
    }

    _showElementUnlockCinematic(element, alreadyUnlocked) {
        const W = this.scale.width, H = this.scale.height;
        const blackBg = this.add.rectangle(W/2,H/2,W,H,0x000000,0).setScrollFactor(0).setDepth(500);
        this.tweens.add({ targets:blackBg, alpha:1, duration:600, ease:'Quad.easeIn', onComplete:() => {
            const colors = { lightning:0xffff44, cosmic:0xcc88ff, fire:0xff6600, ice:0x44ccff };
            const names  = { lightning:'LIGHTNING', cosmic:'COSMIC', fire:'FIRE', ice:'ICE' };
            const keys   = { lightning:'3', cosmic:'4', fire:'1', ice:'2' };
            const col = colors[element] || 0xffffff;
            const colHex = '#'+col.toString(16).padStart(6,'0');
            const elName = names[element] || element.toUpperCase();
            const keyNum = keys[element] || '?';
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

            const unlockLabel = alreadyUnlocked
                ? this.add.text(W/2,H/2+20,`${elName} MASTERED`,{ fontSize:'28px',fontFamily:'monospace',color:colHex,stroke:'#000000',strokeThickness:5,fontStyle:'bold' }).setOrigin(0.5).setScrollFactor(0).setDepth(502).setAlpha(0)
                : this.add.text(W/2,H/2+10,'YOU UNLOCKED',{ fontSize:'18px',fontFamily:'monospace',color:'#aaaaaa',stroke:'#000000',strokeThickness:3 }).setOrigin(0.5).setScrollFactor(0).setDepth(502).setAlpha(0);
            const elLabel = alreadyUnlocked ? null : this.add.text(W/2,H/2+44,elName,{ fontSize:'38px',fontFamily:'monospace',color:colHex,stroke:'#000000',strokeThickness:6,fontStyle:'bold' }).setOrigin(0.5).setScrollFactor(0).setDepth(502).setAlpha(0);
            const subLabel = this.add.text(W/2,H/2+90,`Press ${keyNum} to switch`,{ fontSize:'14px',fontFamily:'monospace',color:'#666666',stroke:'#000000',strokeThickness:2 }).setOrigin(0.5).setScrollFactor(0).setDepth(502).setAlpha(0);
            const contLabel = this.add.text(W/2,H-80,'▼ Click to continue',{ fontSize:'13px',fontFamily:'monospace',color:'#444444' }).setOrigin(0.5).setScrollFactor(0).setDepth(502).setAlpha(0);

            this.time.delayedCall(200, () => {
                this.tweens.add({ targets:unlockLabel, alpha:1, y:unlockLabel.y-8, duration:500, ease:'Quad.easeOut' });
                if (elLabel) this.tweens.add({ targets:elLabel, alpha:1, y:elLabel.y-8, duration:500, ease:'Quad.easeOut', delay:150 });
                this.tweens.add({ targets:subLabel, alpha:0.7, duration:400, delay:400 });
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
}