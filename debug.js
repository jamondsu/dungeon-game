class GameScene extends Phaser.Scene {
    preload() {
        this.load.spritesheet('slime_blue', 'assets/Slime_Blue_32x32.png', {
            frameWidth: 32,
            frameHeight: 32
        });
        this.load.spritesheet('slime_red', 'assets/Slime_Red_32x32.png', {
            frameWidth: 32,
            frameHeight: 32
        });
        this.load.spritesheet('tiles', 'assets/roguelikeDungeon_transparent.png', {
            frameWidth: 17,
            frameHeight: 17
        });
    }
    
    create() {
        this.TILE_SIZE = 24;
        this.TILE_SCALE = 1.5;
        this.SLIME_SCALE = 1.2;
        this.WORLD_WIDTH = 200;
        this.WORLD_HEIGHT = 150;
        this.SLIME_Y_OFFSET = -10;

        this.NOTHING = 0;
        this.FLOOR = 1;
        this.WALL = 2;

        this.shiftWasDown = false;  
        
        this.FRAMES = {
            FLOOR: 156,
            WALL_TOP: 10,
            WALL_BOTTOM: 10,
            WALL_LEFT: 39,
            WALL_RIGHT: 39,
            CORNER_TOP_LEFT: 12,
            CORNER_TOP_RIGHT: 13,
            CORNER_BOTTOM_LEFT: 40,
            CORNER_BOTTOM_RIGHT: 41,
            WALL_FILLER: 39
        };

        this.damageLevel = 1; 
        this.damageScaling = 1.0;

        this.baseFireballDamage = 1.0;
        this.baseHailstormDamage = 2.0;
        this.baseBurnDamage = {
            degree1: 0.8,
            degree2: 1.5,
            degree3: 2.0,
            degree4: 2.5,
            degree5: 0.5
        };
        
        // game state
        this.maxHealth = 100;
        this.health = this.maxHealth;
        this.lastPlayerDamageTime = 0;
        this.playerDamageCooldown = 500;
        
        const seed = 12345;
        this.rng = this.createRng(seed);
        this.world = this.generateWorld();
        
        this.renderWorld();
        this.placePlayer();

        // create animations BEFORE spawning enemies
        this.anims.create({
            key: 'idle',
            frames: [
                { key: 'slime_blue', frame: 0 },
                { key: 'slime_blue', frame: 18 }
            ],
            frameRate: 2,
            repeat: -1
        });

        this.anims.create({
            key: 'red_idle',
            frames: [
                { key: 'slime_red', frame: 0 },
                { key: 'slime_red', frame: 18 }
            ],
            frameRate: 2,
            repeat: -1
        });

        // enemy management
        this.enemies = [];
        this.spawnEnemies();

        // create fireball graphic
        const graphics = this.make.graphics({ x: 0, y: 0, add: false });
        
        // outer glow (yellow)
        graphics.fillStyle(0xffaa00, 0.6);
        graphics.fillCircle(8, 8, 10);
        
        // middle (orange)
        graphics.fillStyle(0xff6600, 1);
        graphics.fillCircle(8, 8, 7);
        
        // core (bright yellow-white)
        graphics.fillStyle(0xffff00, 1);
        graphics.fillCircle(8, 8, 4);
        
        graphics.generateTexture('fireball', 16, 16);
        graphics.destroy();

        // Element system
        this.currentElement = 'fire'; // start with fire
        this.elements = ['fire', 'ice', 'lightning', 'cosmic'];
        this.elementSwitchCooldown = 2000; // 1 second cooldown
        this.lastElementSwitchTime = 0;

        // hailstorms (ice AOE attacks)
        this.hailstorms = [];
        this.hailstormRadius = 2; // tiles
        this.hailstormDuration = 1500; // 1.5 seconds
        this.hailstormTickInterval = 500; // damage every 0.5s
        this.hailstormDamage = 1.25;

        this.lightningChainRange = 4; // tiles - range to chain between enemies
        this.baseLightningDamage = 1; // weak first hit
        this.lightningChainFalloff = 0.5; // 50% damage per chain (manual attacks)
        this.lightningUltChainFalloff = 0.95; // 95% damage per chain (ult attacks)
        this.lightningCooldown = 1000;
        this.lightningMaxRange = 20; // can target enemies up to 20 tiles away

        this.stormCloud = null;
        this.stormCloudRadius = 8;
        this.stormCloudCharge = 100;
        this.stormCloudAutoAttackInterval = 150; 
        this.stormCloudLastAttack = 0;
        this.stormCloudChargeDecayPerAttack = 3; 
        this.stormCloudActive = false;

        this.stormField = null;
        this.stormFieldRadius = 6; 
        this.stormFieldMaxRadius = 15; 
        this.stormFieldTickInterval = 75; 
        this.stormFieldLastTick = 0;
        this.stormFieldDuration = 3000; 
        this.stormFieldLifeGainAmount = 600; 
        this.stormFieldLifeGainCooldown = 800;  
        this.stormFieldRadiusGrowthPerHit = 0.15;

        // COSMIC ELEMENT - BATTERY CHARGE SYSTEM
        this.cosmicBatteryCharges = 5; // start with 5 charges
        this.cosmicMaxCharges = 10; // cap at 10
        this.cosmicPassiveChargeInterval = 10000; // gain 1 charge every 10 seconds
        this.lastCosmicPassiveCharge = 0;
        this.cosmicDropChance = 0.5; // 50% chance on enemy death

        this.cosmicCharging = false;
        this.cosmicChargeStartTime = 0;
        this.cosmicChargeHoldTime = 0; // how long holding
        this.cosmicChargeIndicator = null;

        // Beam properties
        this.cosmicBaseBeamDamage = 2.0;
        this.cosmicBeamWidth = 1.5; // tiles

        // Cosmic marks system
        this.cosmicMarkDamagePerStack = 5; // bonus damage per mark consumed
        this.cosmicMaxMarks = 3; // max 3 marks per enemy

        // Black hole ult
        this.cosmicBlackHole = null;
        this.cosmicBlackHoleProjectile = null;
        this.cosmicBlackHoleDuration = 7000; // 5 seconds
        this.cosmicBlackHoleRadius = 6; // tiles
        this.cosmicBlackHoleMarkInterval = 1500;
        this.cosmicBlackHoleSpeed = 50; // projectile speed
        this.cosmicInfiniteBeamActive = false;
        this.cosmicInfiniteBeamEndTime = 0;
        this.cosmicBlackHoleGracePeriod = 4000;

        // Cosmic dash
        this.cosmicDashDistance = 3; // tiles
        this.cosmicDashCooldown = 1000; 
        this.cosmicDashCooldownUlt = 100;
        this.lastCosmicDashTime = 0;
        this.cosmicDashStunDuration = 800; // 0.8s stun
        this.cosmicDashDamage = 3.0; // damage per enemy hit

        // Visual battery display
        this.cosmicBatteryDisplay = null;

        this.input.keyboard.on('keydown-ONE', () => {
            this.switchToElement('fire');
        });

        this.input.keyboard.on('keydown-TWO', () => {
            this.switchToElement('ice');
        });

        this.input.keyboard.on('keydown-THREE', () => {
            this.switchToElement('lightning');
        });

        this.input.keyboard.on('keydown-FOUR', () => {
            this.switchToElement('cosmic');
        });

        // Element ultimate abilities
        this.ultActive = false;
        this.ultCooldowns = {
            'fire': 0,   
            'ice': 0,
            'lightning': 0,
            'cosmic': 0
        };
        this.lastUltTimes = {
            'fire': -99999,
            'ice': -99999,
            'lightning': -99999,
            'cosmic': -99999
        };

        // Ice ult specific state
        this.iceUltDuration = 5000; 
        this.iceUltEndTime = 0;
        this.damageReductionMultiplier = 1.0;
        this.attackSpeedMultiplier = 1.0;

        // E key to activate ult
        this.input.keyboard.on('keydown-E', () => {
            this.activateUlt();
        });

        // SPACE key to charge cosmic beam
        this.input.keyboard.on('keydown-SPACE', () => {
            if (this.currentElement === 'cosmic' && !this.cosmicCharging) {
                const chargeCost = this.cosmicInfiniteBeamActive ? 2 : 1;
                if (this.cosmicBatteryCharges >= chargeCost) {
                    // CONSUME CHARGE IMMEDIATELY
                    this.cosmicBatteryCharges -= chargeCost;
                    this.updateHUD();
                    
                    this.cosmicCharging = true;
                    this.cosmicChargeStartTime = this.time.now;
                } else {
                    console.log('No charges available!');
                }
            }
        });

        // Cosmic dash: hold Shift to charge, release to dash in last moved direction
        this.shiftKey = this.input.keyboard.addKey('SHIFT');

        this.input.keyboard.on('keyup-SPACE', () => {
            if (this.cosmicCharging && this.currentElement === 'cosmic') {
                this.releaseCosmicBeam();
            }
        });

        // camera follows player
        this.cameras.main.startFollow(this.player);
        this.cameras.main.setBounds(0, 0, this.WORLD_WIDTH * this.TILE_SIZE, this.WORLD_HEIGHT * this.TILE_SIZE);
        
        // create HUD
        this.createHUD();

        // for mobile
        this.createTouchControls();
        
        this.keys = this.input.keyboard.addKeys('W,A,S,D');

        // fireball projectiles
        this.fireballs = [];
        this.fireballSpeed = 300;
        this.lastFireballTime = 0;
        this.fireballCooldown = 500;
        this.iceballCooldown = 1500; 
        this.fireballMaxRange = 30; 
        this.hailstormMaxRange = 8;  
        
        // hold mouse to shoot fireballs continuously
        this.isPointerDown = false;
        this.pointerX = 0;
        this.pointerY = 0;

        this.input.on('pointerdown', (pointer) => {
            if (pointer.button !== 0) return; // only left mouse button
            
            // Check if storm cloud is active - click to throw it
            if (this.stormCloudActive && this.stormCloud && !this.stormCloud.thrown) {
                this.throwLightning();
                return;
            }
            
            // COSMIC: Start charging
            if (this.currentElement === 'cosmic' && !this.cosmicInfiniteBeamActive) {
                // Don't start charging, SPACE handles it
                this.pointerX = pointer.x;
                this.pointerY = pointer.y;
                return;
            }
            
            this.isPointerDown = true;
            this.pointerX = pointer.x;
            this.pointerY = pointer.y;
            this.shootAttack(pointer.x, pointer.y);
        });

        this.input.on('pointermove', (pointer) => {
            this.pointerX = pointer.x;
            this.pointerY = pointer.y;
        });

        this.input.on('pointerup', () => {
            this.isPointerDown = false;
        });
        
        this.lastMoveTime = 0;
        this.moveCooldown = 200;
        this.lastEnemyMoveTime = 0;
        this.enemyMoveCooldown = 1000;
        this.idleDelay = 500;
        this.isIdling = false;
    }
    
    createHUD() {
        this.hudBg = this.add.rectangle(0, 0, this.scale.width, 40, 0x000000, 0.7);
        this.hudBg.setOrigin(0, 0);
        this.hudBg.setScrollFactor(0);
        
        this.healthBarBg = this.add.rectangle(10, 20, 100, 16, 0x000000);
        this.healthBarBg.setOrigin(0, 0.5);
        this.healthBarBg.setScrollFactor(0);
        
        this.healthBarBorder = this.add.rectangle(10, 20, 100, 16);
        this.healthBarBorder.setStrokeStyle(2, 0xffffff, 0.8);
        this.healthBarBorder.setOrigin(0, 0.5);
        this.healthBarBorder.setScrollFactor(0);
        
        this.healthBarFill = this.add.rectangle(10, 20, 100, 16, 0xff5566);
        this.healthBarFill.setOrigin(0, 0.5);
        this.healthBarFill.setScrollFactor(0);
        
        this.healthText = this.add.text(15, 20, '', { 
            fontSize: '14px', 
            color: '#ffffff',
            fontFamily: 'monospace',
            fontStyle: 'bold'
        });
        this.healthText.setOrigin(0, 0.5);
        this.healthText.setScrollFactor(0);

        this.elementText = this.add.text(120, 10, '', {
            fontSize: '20px',
            color: '#ffffff',
            fontFamily: 'monospace',
            backgroundColor: '#000000',
            padding: { x: 8, y: 4 }
        });
        this.elementText.setScrollFactor(0);
        
        this.posText = this.add.text(this.scale.width - 10, 10, '', { 
            fontSize: '16px', 
            color: '#cccccc',
            fontFamily: 'monospace'
        });
        this.posText.setOrigin(1, 0);
        this.posText.setScrollFactor(0);

        // Cosmic battery display
        this.cosmicBatteryDisplay = this.add.text(this.scale.width / 2, 50, '', {
            fontSize: '24px',
            fontFamily: 'monospace',
            color: '#9966ff',
            stroke: '#000000',
            strokeThickness: 4,
            fontStyle: 'bold'
        });
        this.cosmicBatteryDisplay.setOrigin(0.5);
        this.cosmicBatteryDisplay.setScrollFactor(0);
        this.cosmicBatteryDisplay.setVisible(false);
        
        this.updateHUD();
    }
    
    updateHUD() {
        const healthPercent = this.health / this.maxHealth;
        this.healthBarFill.width = 100 * healthPercent;
        this.healthText.setText(`${this.health.toFixed(1)}/${this.maxHealth}`);
        
        const elementSymbols = {
            'fire': '🔥 FIRE',
            'ice': '❄️ ICE',
            'lightning': '⚡ LIGHTNING',
            'cosmic': '🌌 COSMIC'
        };
        
        let elementText = elementSymbols[this.currentElement] || '';
        
        const currentTime = this.time.now;
        const cooldown = this.ultCooldowns[this.currentElement];
        const lastUse = this.lastUltTimes[this.currentElement];
        const timeLeft = Math.max(0, cooldown - (currentTime - lastUse));
        
        if (timeLeft > 0) {
            elementText += ` | ULT: ${(timeLeft / 1000).toFixed(1)}s`;
        } else {
            elementText += ' | ULT: READY';
        }
        
        this.elementText.setText(elementText);
        
        if (this.playerX !== undefined) {
            this.posText.setText(`Pos: (${this.playerX}, ${this.playerY}) | Enemies: ${this.enemies.length}`);
        }

        // Show battery only when using cosmic
        if (this.currentElement === 'cosmic') {
            this.cosmicBatteryDisplay.setVisible(true);
            this.cosmicBatteryDisplay.setText(`⚡ ${this.cosmicBatteryCharges}/${this.cosmicMaxCharges}`);
        } else {
            this.cosmicBatteryDisplay.setVisible(false);
        }
    }
    
    generateWorld() {
        const world = [];
        for (let x = 0; x < this.WORLD_WIDTH; x++) {
            world[x] = [];
            for (let y = 0; y < this.WORLD_HEIGHT; y++) {
                world[x][y] = this.NOTHING;
            }
        }
        
        const rooms = [];
        const numRooms = 100 + Math.floor(this.rng() * 6);
        let attempts = 0;
        
        while (rooms.length < numRooms && attempts < 1000) {
            const w = 4 + Math.floor(this.rng() * 6);
            const h = 4 + Math.floor(this.rng() * 6);
            const x = 1 + Math.floor(this.rng() * (this.WORLD_WIDTH - w - 2));
            const y = 1 + Math.floor(this.rng() * (this.WORLD_HEIGHT - h - 2));
            
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
        
        const minX = Math.min(ax, bx);
        const maxX = Math.max(ax, bx);
        for (let x = minX; x <= maxX; x++) {
            world[x][ay] = this.FLOOR;
        }
        const minY = Math.min(ay, by);
        const maxY = Math.max(ay, by);
        for (let y = minY; y <= maxY; y++) {
            world[bx][y] = this.FLOOR;
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
    
    update(time, delta) {   
        const preUpdatePlayerX = this.playerX;
        const preUpdatePlayerY = this.playerY;
        
        if (this.currentElement === 'cosmic' && this.shiftKey.isDown && !this.shiftWasDown) {
            const mouseX = this.input.activePointer.worldX;
            const mouseY = this.input.activePointer.worldY;
            const playerCenterX = this.playerX * this.TILE_SIZE + this.TILE_SIZE / 2;
            const playerCenterY = this.playerY * this.TILE_SIZE + this.TILE_SIZE / 2;
            
            const dx = mouseX - playerCenterX;
            const dy = mouseY - playerCenterY;
            
            let dirX = 0;
            let dirY = 0;
            
            if (Math.abs(dx) > Math.abs(dy)) {
                dirX = dx > 0 ? 1 : -1;
            } else {
                dirY = dy > 0 ? 1 : -1;
            }
            
            this.cosmicDash(dirX, dirY, preUpdatePlayerX, preUpdatePlayerY);
        }
        this.shiftWasDown = this.shiftKey.isDown;

        if (time - this.lastMoveTime >= this.moveCooldown) {
            let dx = 0, dy = 0;
            
            const isCosmicCharging = this.currentElement === 'cosmic' && this.cosmicCharging;

            if (!isCosmicCharging) {
                if (this.keys.W.isDown) dy = -1;
                else if (this.keys.S.isDown) dy = 1;
                else if (this.keys.A.isDown) dx = -1;
                else if (this.keys.D.isDown) dx = 1;
            }
            
            if (this.isMobile && dx === 0 && dy === 0) {
                if (this.touchInput.up) dy = -1;
                else if (this.touchInput.down) dy = 1;
                else if (this.touchInput.left) dx = -1;
                else if (this.touchInput.right) dx = 1;
            }
            
            if (dx !== 0 || dy !== 0) {
                const newX = this.playerX + dx;
                const newY = this.playerY + dy;
                
                const enemyAtTarget = this.getEnemyAt(newX, newY);
                if (enemyAtTarget) {
                    this.takeDamage(1);
                    this.lastMoveTime = time;
                    return;
                }

                if (newX >= 0 && newX < this.WORLD_WIDTH &&
                    newY >= 0 && newY < this.WORLD_HEIGHT &&
                    this.world[newX][newY] === this.FLOOR) {
                    
                    this.playerX = newX;
                    this.playerY = newY;
                    this.player.x = newX * this.TILE_SIZE + this.TILE_SIZE / 2;
                    this.player.y = newY * this.TILE_SIZE + this.TILE_SIZE / 2 + this.SLIME_Y_OFFSET;
                    this.lastMoveTime = time;
                    this.player.stop();
                    this.player.setFrame(0);
                    this.isIdling = false;
                    
                    this.updateHUD();
                }
            }
        }
        
        this.moveEnemies();
        
        if (!this.isIdling && time - this.lastMoveTime > this.idleDelay) {
            this.player.play('idle');
            this.isIdling = true;
        }

        if (this.isPointerDown && this.currentElement !== 'cosmic') {
            this.shootAttack(this.pointerX, this.pointerY);
        }
        this.updateFireballs(delta);
        this.updateBurnEffects(time);
        this.updateHailstorms(time);
        this.updateStormCloud(time); 
        this.updateStormField(time);
        this.updateCosmicPassiveCharge(time);
        this.updateCosmicCharge(time);
        this.updateCosmicBlackHoleProjectile(delta);
        this.updateCosmicBlackHole(time);

        // Check if fast charging grace period ended
        if (this.cosmicInfiniteBeamActive && this.time.now >= this.cosmicInfiniteBeamEndTime) {
            this.cosmicInfiniteBeamActive = false;
            this.player.clearTint();
            console.log('Cosmic fast charging ended');
        }
    }

    createTouchControls() {
        this.isMobile = !this.sys.game.device.os.desktop;
        
        if (!this.isMobile) return;
        
        this.touchInput = { up: false, down: false, left: false, right: false };
        
        let startX = 0;
        let startY = 0;
        let isPointerDown = false;
        const swipeThreshold = 40;
        
        this.input.on('pointerdown', (pointer) => {
            startX = pointer.x;
            startY = pointer.y;
            isPointerDown = true;
        });
        
        this.input.on('pointermove', (pointer) => {
            if (!isPointerDown) return;
            
            const dx = pointer.x - startX;
            const dy = pointer.y - startY;
            const absDx = Math.abs(dx);
            const absDy = Math.abs(dy);
            
            this.touchInput = { up: false, down: false, left: false, right: false };
            
            if (absDx < swipeThreshold && absDy < swipeThreshold) return;
            
            if (absDx > absDy) {
                if (dx > 0) this.touchInput.right = true;
                else this.touchInput.left = true;
            } else {
                if (dy > 0) this.touchInput.down = true;
                else this.touchInput.up = true;
            }
        });
        
        this.input.on('pointerup', () => {
            isPointerDown = false;
            this.touchInput = { up: false, down: false, left: false, right: false };
        });
    }

    spawnEnemies() {
        const numEnemies = 15 + Math.floor(this.rng() * 10);
        let spawned = 0;
        let attempts = 0;
        
        while (spawned < numEnemies && attempts < 1000) {
            const x = Math.floor(this.rng() * this.WORLD_WIDTH);
            const y = Math.floor(this.rng() * this.WORLD_HEIGHT);
            
            if (this.world[x][y] === this.FLOOR) {
                const distToPlayer = Math.abs(x - this.playerX) + Math.abs(y - this.playerY);
                if (distToPlayer > 5 && distToPlayer < 50) {
                    this.createEnemy(x, y);
                    spawned++;
                }
            }
            attempts++;
        }
        
        console.log(`Spawned ${this.enemies.length} enemies`);
    }

    createEnemy(x, y) {
        const sprite = this.add.sprite(
            x * this.TILE_SIZE + this.TILE_SIZE / 2,
            y * this.TILE_SIZE + this.TILE_SIZE / 2 + this.SLIME_Y_OFFSET,
            'slime_red',
            0
        );
        sprite.setScale(this.SLIME_SCALE);
        sprite.play('red_idle');
        
        const healthBarBg = this.add.rectangle(
            sprite.x,
            sprite.y,
            24,
            4,
            0x000000
        );
        
        const healthBarFill = this.add.rectangle(
            sprite.x,
            sprite.y,
            24,
            4,
            0xff0000
        );
        
        const enemy = {
            x: x,
            y: y,
            sprite: sprite,
            health: 60,
            maxHealth: 60,
            healthBarBg: healthBarBg,
            healthBarFill: healthBarFill,
            burnStacks: 0,          
            burnDegree: 0,            
            burnTicksRemaining: 0,     
            lastBurnTime: 0,          
            lastHitTime: 0,
            hadSuperburn: false,    
            isFrozen: false,       
            frozenUntil: 0,        
            isSlowed: false,     
            slowedUntil: 0,
            lastMoveTime: 0,
            isStunned: false,
            stunnedUntil: 0,
            
            // COSMIC MARKS
            cosmicMarks: 0, // 0-3 marks
            cosmicMarkVisuals: null
        };
        
        this.enemies.push(enemy);
    }

    updateEnemyHealthBar(enemy) {
        if (!enemy.healthBarFill || !enemy.healthBarBg) return;
        
        const healthPercent = enemy.health / enemy.maxHealth;
        const maxWidth = 24;
        const currentWidth = maxWidth * healthPercent;
        
        enemy.healthBarFill.width = currentWidth;
        
        enemy.healthBarBg.x = enemy.sprite.x;
        enemy.healthBarBg.y = enemy.sprite.y;
        
        enemy.healthBarFill.x = enemy.sprite.x;
        enemy.healthBarFill.y = enemy.sprite.y;
    }

    takeDamage(amount) {
        const actualDamage = amount * this.damageReductionMultiplier;
        const blockedDamage = amount - actualDamage;
        
        this.health -= actualDamage;
        
        if (blockedDamage > 0 && this.ultActive && this.currentElement === 'ice') {
            this.showShieldBlock(blockedDamage);
        }
        
        this.player.setTint(0xff0000);
        this.time.delayedCall(200, () => {
            if (this.ultActive && this.currentElement === 'ice') {
                this.player.setTint(0x00ccff);
            } else {
                this.player.clearTint();
            }
        });
        
        this.updateHUD();
        
        if (this.health <= 0) {
            this.gameOver();
        }
    }

    gameOver() {
        console.log("You died!");
        this.scene.restart();
    }

    getEnemyAt(x, y) {
        for (let enemy of this.enemies) {
            if (enemy.x === x && enemy.y === y) {
                return enemy;
            }
        }
        return null;
    }

    findPathBFS(startX, startY, targetX, targetY) {
        if (startX === targetX && startY === targetY) {
            return null;
        }
        
        const queue = [];
        const visited = new Set();
        const parent = new Map();
        
        const startKey = `${startX},${startY}`;
        queue.push({ x: startX, y: startY });
        visited.add(startKey);
        parent.set(startKey, null);
        
        while (queue.length > 0) {
            const current = queue.shift();
            
            if (current.x === targetX && current.y === targetY) {
                return this.reconstructPath(parent, startX, startY, targetX, targetY);
            }
            
            const neighbors = [
                { x: current.x, y: current.y - 1 },
                { x: current.x, y: current.y + 1 },
                { x: current.x - 1, y: current.y },
                { x: current.x + 1, y: current.y }
            ];
            
            for (let neighbor of neighbors) {
                const nx = neighbor.x;
                const ny = neighbor.y;
                const nKey = `${nx},${ny}`;
                
                if (visited.has(nKey)) continue;
                
                if (nx < 0 || nx >= this.WORLD_WIDTH || ny < 0 || ny >= this.WORLD_HEIGHT) continue;
                
                if (this.world[nx][ny] !== this.FLOOR) continue;
                
                visited.add(nKey);
                parent.set(nKey, current);
                queue.push({ x: nx, y: ny });
            }
        }
        
        return null;
    }

    reconstructPath(parent, startX, startY, targetX, targetY) {
        const path = [];
        let current = { x: targetX, y: targetY };
        
        while (current) {
            path.unshift(current);
            const key = `${current.x},${current.y}`;
            current = parent.get(key);
        }
        
        return path;
    }

    moveEnemies() {
        const currentTime = this.time.now;
        
        for (let enemy of this.enemies) {
            // STUN CHECK
            if (enemy.isStunned && currentTime < enemy.stunnedUntil) {
                continue;
            } else if (enemy.isStunned && currentTime >= enemy.stunnedUntil) {
                enemy.isStunned = false;
            }
            
            if (enemy.isFrozen) {
                if (currentTime >= enemy.frozenUntil) {
                    enemy.isFrozen = false;
                    enemy.sprite.clearTint();
                    
                    if (enemy.freezeVisuals) {
                        this.tweens.killTweensOf(enemy.freezeVisuals.iceBlock);
                        this.tweens.killTweensOf(enemy.freezeVisuals.iceBorder); 
                        this.tweens.killTweensOf(enemy.freezeVisuals.multiplierText);
                        enemy.freezeVisuals.iceBlock.destroy();
                        enemy.freezeVisuals.iceBorder.destroy();
                        enemy.freezeVisuals.multiplierText.destroy();
                        enemy.freezeVisuals = null;
                    }
                } else {
                    if (enemy.freezeVisuals) {
                        const blockY = enemy.sprite.y + 10;
                        enemy.freezeVisuals.iceBlock.x = enemy.sprite.x;
                        enemy.freezeVisuals.iceBlock.y = blockY;
                        enemy.freezeVisuals.iceBorder.x = enemy.sprite.x;
                        enemy.freezeVisuals.iceBorder.y = blockY;
                        enemy.freezeVisuals.multiplierText.x = enemy.sprite.x;
                        enemy.freezeVisuals.multiplierText.y = blockY - 16;
                    }
                    continue;
                }
            }
            
            if (enemy.isSlowed && currentTime >= enemy.slowedUntil) {
                enemy.isSlowed = false;
            }
            
            const moveCooldown = enemy.isSlowed ? this.enemyMoveCooldown * 2 : this.enemyMoveCooldown;
            
            if (currentTime - enemy.lastMoveTime < moveCooldown) {
                continue;
            }
            
            const dist = Math.abs(enemy.x - this.playerX) + Math.abs(enemy.y - this.playerY);
            
            if (dist < 20) {
                const path = this.findPathBFS(enemy.x, enemy.y, this.playerX, this.playerY);
                
                if (path && path.length > 1) {
                    const nextStep = path[1];
                    
                    const blockingEnemy = this.getEnemyAt(nextStep.x, nextStep.y);
                    if (blockingEnemy && !(nextStep.x === this.playerX && nextStep.y === this.playerY)) {
                        continue;
                    }
                    
                    if (nextStep.x === this.playerX && nextStep.y === this.playerY) {
                        if (currentTime - this.lastPlayerDamageTime >= this.playerDamageCooldown) {
                            this.enemyAttackAnimation(enemy, this.playerX, this.playerY);
                            this.takeDamage(1);
                            this.lastPlayerDamageTime = currentTime;
                        }
                        continue;
                    }
                    
                    enemy.x = nextStep.x;
                    enemy.y = nextStep.y;
                    enemy.lastMoveTime = currentTime;
                    
                    enemy.sprite.x = enemy.x * this.TILE_SIZE + this.TILE_SIZE / 2;
                    enemy.sprite.y = enemy.y * this.TILE_SIZE + this.TILE_SIZE / 2 + this.SLIME_Y_OFFSET;
                    
                    enemy.healthBarBg.x = enemy.sprite.x;
                    enemy.healthBarBg.y = enemy.sprite.y;
                    enemy.healthBarFill.x = enemy.sprite.x;
                    enemy.healthBarFill.y = enemy.sprite.y;

                    if (enemy.burnIndicators && enemy.burnIndicators.length > 0) {
                        const numDots = enemy.burnDegree;
                        const dotSpacing = 8;
                        const startX = enemy.sprite.x - ((numDots - 1) * dotSpacing) / 2;
                        
                        let indicatorIndex = 0;
                        for (let i = 0; i < numDots; i++) {
                            const x = startX + (i * dotSpacing);
                            const y = enemy.sprite.y - 10;
                            
                            for (let j = 0; j < 3; j++) {
                                if (indicatorIndex < enemy.burnIndicators.length) {
                                    enemy.burnIndicators[indicatorIndex].x = x;
                                    enemy.burnIndicators[indicatorIndex].y = y;
                                    indicatorIndex++;
                                }
                            }
                        }
                    }
                    
                    // Update cosmic mark visuals
                    if (enemy.cosmicMarkVisuals && enemy.cosmicMarkVisuals.length > 0) {
                        const markY = enemy.sprite.y - 25;
                        for (let i = 0; i < enemy.cosmicMarks; i++) {
                            const offsetX = (i - 1) * 12;
                            const visualIndex = i * 2;
                            if (visualIndex < enemy.cosmicMarkVisuals.length) {
                                enemy.cosmicMarkVisuals[visualIndex].x = enemy.sprite.x + offsetX;
                                enemy.cosmicMarkVisuals[visualIndex].y = markY;
                            }
                            if (visualIndex + 1 < enemy.cosmicMarkVisuals.length) {
                                enemy.cosmicMarkVisuals[visualIndex + 1].x = enemy.sprite.x + offsetX;
                                enemy.cosmicMarkVisuals[visualIndex + 1].y = markY;
                            }
                        }
                    }
                }
            }
        }
        
        // SAFEGUARD: Teleport any enemies that ended up in walls back to nearest floor
        for (let enemy of this.enemies) {
            if (this.world[enemy.x][enemy.y] !== this.FLOOR) {
                console.log('Enemy clipped into wall! Teleporting back...');
                
                // Find nearest floor tile
                let foundFloor = false;
                for (let radius = 1; radius <= 5 && !foundFloor; radius++) {
                    for (let dx = -radius; dx <= radius && !foundFloor; dx++) {
                        for (let dy = -radius; dy <= radius && !foundFloor; dy++) {
                            const checkX = enemy.x + dx;
                            const checkY = enemy.y + dy;
                            
                            if (checkX >= 0 && checkX < this.WORLD_WIDTH &&
                                checkY >= 0 && checkY < this.WORLD_HEIGHT &&
                                this.world[checkX][checkY] === this.FLOOR) {
                                
                                // Teleport enemy to this floor tile
                                enemy.x = checkX;
                                enemy.y = checkY;
                                enemy.sprite.x = checkX * this.TILE_SIZE + this.TILE_SIZE / 2;
                                enemy.sprite.y = checkY * this.TILE_SIZE + this.TILE_SIZE / 2 + this.SLIME_Y_OFFSET;
                                
                                // Update health bars
                                this.updateEnemyHealthBar(enemy);
                                
                                // Update mark visuals
                                if (enemy.cosmicMarkVisuals && enemy.cosmicMarkVisuals.length > 0) {
                                    const markY = enemy.sprite.y - 25;
                                    for (let i = 0; i < enemy.cosmicMarks; i++) {
                                        const offsetX = (i - 1) * 12;
                                        const visualIndex = i * 2;
                                        if (visualIndex < enemy.cosmicMarkVisuals.length) {
                                            enemy.cosmicMarkVisuals[visualIndex].x = enemy.sprite.x + offsetX;
                                            enemy.cosmicMarkVisuals[visualIndex].y = markY;
                                        }
                                        if (visualIndex + 1 < enemy.cosmicMarkVisuals.length) {
                                            enemy.cosmicMarkVisuals[visualIndex + 1].x = enemy.sprite.x + offsetX;
                                            enemy.cosmicMarkVisuals[visualIndex + 1].y = markY;
                                        }
                                    }
                                }
                                
                                foundFloor = true;
                            }
                        }
                    }
                }
            }
        }
    }

    enemyAttackAnimation(enemy, targetX, targetY) {
        const dirX = targetX - enemy.x;
        const dirY = targetY - enemy.y;
        
        const lungeDistance = this.TILE_SIZE * 0.4;
        const targetSpriteX = enemy.sprite.x + (dirX * lungeDistance);
        const targetSpriteY = enemy.sprite.y + (dirY * lungeDistance);
        
        this.tweens.add({
            targets: enemy.sprite,
            scaleX: this.SLIME_SCALE * 0.8,
            scaleY: this.SLIME_SCALE * 1.2,
            duration: 100,
            yoyo: true,
            ease: 'Quad.easeOut'
        });
        
        this.tweens.add({
            targets: enemy.sprite,
            x: targetSpriteX,
            y: targetSpriteY,
            duration: 150,
            ease: 'Quad.easeOut',
            onComplete: () => {
                enemy.sprite.x = enemy.x * this.TILE_SIZE + this.TILE_SIZE / 2;
                enemy.sprite.y = enemy.y * this.TILE_SIZE + this.TILE_SIZE / 2 + this.SLIME_Y_OFFSET;
            }
        });
    }

    shootAttack(targetX, targetY) {
        const currentTime = this.time.now;
        
        const worldX = targetX + this.cameras.main.scrollX;
        const worldY = targetY + this.cameras.main.scrollY;
        const playerPixelX = this.playerX * this.TILE_SIZE + this.TILE_SIZE / 2;
        const playerPixelY = this.playerY * this.TILE_SIZE + this.TILE_SIZE / 2;
        
        const dx = worldX - playerPixelX;
        const dy = worldY - playerPixelY;
        const distanceInTiles = Math.sqrt(dx * dx + dy * dy) / this.TILE_SIZE;
        
        const maxRange = this.currentElement === 'fire' ? this.fireballMaxRange : this.hailstormMaxRange;
        if (distanceInTiles > maxRange) {
            return;
        }
        
        let attackMultiplier = 1.0;
        if (this.currentElement === 'fire') {
            const hasSuperburn = this.enemies.some(e => e.burnDegree === 5 && e.hadSuperburn);
            attackMultiplier = hasSuperburn ? 100000.0 : 1.0;
        }
        
        let baseCooldown;
        if (this.currentElement === 'fire') {
            baseCooldown = this.fireballCooldown;
        } else if (this.currentElement === 'ice') {
            baseCooldown = this.iceballCooldown;
        } else if (this.currentElement === 'lightning') {
            baseCooldown = this.lightningCooldown;
        }

        const effectiveCooldown = baseCooldown / (this.attackSpeedMultiplier * attackMultiplier);

        if (currentTime - this.lastFireballTime < effectiveCooldown) {
            return;
        }
        
        if (this.currentElement === 'fire') {
            this.shootFireball(targetX, targetY);
        } else if (this.currentElement === 'ice') {
            this.createHailstorm(targetX, targetY);
        } else if (this.currentElement === 'lightning') {
            this.shootChainLightning(targetX, targetY);
        }
        
        this.lastFireballTime = currentTime;
    }

    shootFireball(targetX, targetY) {
        const worldX = targetX + this.cameras.main.scrollX;
        const worldY = targetY + this.cameras.main.scrollY;
        
        const playerPixelX = this.playerX * this.TILE_SIZE + this.TILE_SIZE / 2;
        const playerPixelY = this.playerY * this.TILE_SIZE + this.TILE_SIZE / 2;
        
        const dx = worldX - playerPixelX;
        const dy = worldY - playerPixelY;
        const distance = Math.sqrt(dx * dx + dy * dy);
        
        if (distance === 0) return;
        
        const dirX = dx / distance;
        const dirY = dy / distance;
        
        const hasSuperburn = this.enemies.some(e => e.burnDegree === 5 && e.hadSuperburn);
        const damageMultiplier = hasSuperburn ? 0.0075 : 1.0;
        
        if (hasSuperburn) {
            const baseAngle = Math.atan2(dirY, dirX);
            const spreadAngle = Math.PI / 12;
            
            for (let i = -1; i <= 1; i++) {
                const angle = baseAngle + (i * spreadAngle);
                const spreadDirX = Math.cos(angle);
                const spreadDirY = Math.sin(angle);
                
                const fireball = this.add.sprite(playerPixelX, playerPixelY, 'fireball');
                fireball.setScale(1.5);
                
                this.fireballs.push({
                    sprite: fireball,
                    vx: spreadDirX * this.fireballSpeed,
                    vy: spreadDirY * this.fireballSpeed,
                    damage: this.baseFireballDamage * this.damageScaling * damageMultiplier
                });
            }
        } else {
            const fireball = this.add.sprite(playerPixelX, playerPixelY, 'fireball');
            fireball.setScale(1.5);
            
            this.fireballs.push({
                sprite: fireball,
                vx: dirX * this.fireballSpeed,
                vy: dirY * this.fireballSpeed,
                damage: this.baseFireballDamage * this.damageScaling
            });
        }
    }

    createHailstorm(targetX, targetY) {
        const worldX = targetX + this.cameras.main.scrollX;
        const worldY = targetY + this.cameras.main.scrollY;
        
        const tileX = Math.floor(worldX / this.TILE_SIZE);
        const tileY = Math.floor(worldY / this.TILE_SIZE);
        
        const centerPixelX = tileX * this.TILE_SIZE + this.TILE_SIZE / 2;
        const centerPixelY = tileY * this.TILE_SIZE + this.TILE_SIZE / 2;
        const radiusPixels = this.hailstormRadius * this.TILE_SIZE;
        
        const shards = [];
        
        const outerCircle = this.add.circle(
            centerPixelX,
            centerPixelY,
            radiusPixels,
            0x0099ff,
            0.4
        );
        
        const outerBorder = this.add.circle(
            centerPixelX,
            centerPixelY,
            radiusPixels
        );
        outerBorder.setStrokeStyle(3, 0xffffff, 0.8);
        
        const middleCircle = this.add.circle(
            centerPixelX,
            centerPixelY,
            radiusPixels * 0.7,
            0x00ccff,
            0.5
        );
        
        const middleBorder = this.add.circle(
            centerPixelX,
            centerPixelY,
            radiusPixels * 0.7
        );
        middleBorder.setStrokeStyle(2, 0xaaddff, 0.7);
        
        const innerCircle = this.add.circle(
            centerPixelX,
            centerPixelY,
            radiusPixels * 0.3,
            0xffffff,
            0.6
        );
        
        this.tweens.add({
            targets: [outerCircle, outerBorder],
            scaleX: 1.15,
            scaleY: 1.15,
            alpha: 0.6,
            duration: 600,
            yoyo: true,
            repeat: -1,
            ease: 'Sine.easeInOut'
        });
        
        this.tweens.add({
            targets: [middleCircle, middleBorder],
            scaleX: 1.2,
            scaleY: 1.2,
            alpha: 0.7,
            duration: 500,
            yoyo: true,
            repeat: -1,
            ease: 'Sine.easeInOut',
            delay: 100
        });
        
        this.tweens.add({
            targets: innerCircle,
            scaleX: 1.3,
            scaleY: 1.3,
            alpha: 0.8,
            duration: 400,
            yoyo: true,
            repeat: -1,
            ease: 'Sine.easeInOut',
            delay: 200
        });
        
        shards.push(outerCircle, outerBorder, middleCircle, middleBorder, innerCircle);
        
        const numShards = 12;
        
        for (let i = 0; i < numShards; i++) {
            const angle = (Math.PI * 2 / numShards) * i;
            const distance = radiusPixels * 0.85;
            const x = centerPixelX + Math.cos(angle) * distance;
            const y = centerPixelY + Math.sin(angle) * distance;
            
            const shard = this.add.rectangle(x, y, 8, 8, 0xccffff, 0.9);
            shard.setRotation(angle + Math.PI / 4);
            
            const shardBorder = this.add.rectangle(x, y, 8, 8);
            shardBorder.setStrokeStyle(2, 0xffffff, 1);
            shardBorder.setRotation(angle + Math.PI / 4);
            
            this.tweens.add({
                targets: [shard, shardBorder],
                angle: 360,
                duration: 1500,
                ease: 'Linear'
            });
            
            this.tweens.add({
                targets: [shard, shardBorder],
                scaleX: 1.4,
                scaleY: 1.4,
                alpha: 0.5,
                duration: 500,
                yoyo: true,
                repeat: -1,
                ease: 'Sine.easeInOut'
            });
            
            shards.push(shard, shardBorder);
        }
        
        const numInnerShards = 6;
        for (let i = 0; i < numInnerShards; i++) {
            const angle = (Math.PI * 2 / numInnerShards) * i;
            const distance = radiusPixels * 0.4;
            const x = centerPixelX + Math.cos(angle) * distance;
            const y = centerPixelY + Math.sin(angle) * distance;
            
            const innerShard = this.add.rectangle(x, y, 5, 5, 0xffffff, 0.8);
            innerShard.setRotation(angle);
            
            this.tweens.add({
                targets: innerShard,
                angle: -360,
                duration: 2000,
                ease: 'Linear'
            });
            
            shards.push(innerShard);
        }
        
        const hailstorm = {
            tileX: tileX,
            tileY: tileY,
            visuals: shards,
            createdAt: this.time.now,
            lastTickTime: this.time.now
        };
        
        this.hailstorms.push(hailstorm);
        
        console.log(`Hailstorm created at (${tileX}, ${tileY})`);
    }

    updateFireballs(delta) {
        const deltaSeconds = delta / 1000;
        
        for (let i = this.fireballs.length - 1; i >= 0; i--) {
            const fireball = this.fireballs[i];
            
            fireball.sprite.x += fireball.vx * deltaSeconds;
            fireball.sprite.y += fireball.vy * deltaSeconds;
            
            const tileX = Math.floor(fireball.sprite.x / this.TILE_SIZE);
            const tileY = Math.floor(fireball.sprite.y / this.TILE_SIZE);
            
            if (tileX < 0 || tileX >= this.WORLD_WIDTH || 
                tileY < 0 || tileY >= this.WORLD_HEIGHT ||
                this.world[tileX][tileY] === this.WALL) {
                fireball.sprite.destroy();
                this.fireballs.splice(i, 1);
                continue;
            }
            
            let hitEnemy = false;
            const fireballTileX = Math.floor(fireball.sprite.x / this.TILE_SIZE);
            const fireballTileY = Math.floor(fireball.sprite.y / this.TILE_SIZE);

            for (let enemy of this.enemies) {
                if (enemy.x === fireballTileX && enemy.y === fireballTileY) {
                    const tileTopY = fireballTileY * this.TILE_SIZE;
                    const tileCenterY = tileTopY + (this.TILE_SIZE * 0.25);
                    
                    if (fireball.sprite.y >= tileCenterY) {
                        this.damageEnemy(enemy, fireball.damage);
                        hitEnemy = true;
                        break;
                    }
                }
            }

            if (hitEnemy) {
                fireball.sprite.destroy();
                this.fireballs.splice(i, 1);
                continue;
            }
        }
    }

    damageEnemy(enemy, damage) {
        enemy.health -= damage;
        
        if (this.currentElement === 'fire') {
            if (enemy.hadSuperburn && enemy.burnDegree === 5) {
                enemy.burnStacks = Math.min(5, enemy.burnStacks + 1);
                enemy.lastHitTime = this.time.now;
                this.updateBurnVisual(enemy);
            } else {
                enemy.burnStacks++;
                enemy.lastHitTime = this.time.now;
                enemy.hadSuperburn = false;
                this.updateBurnDegree(enemy);
            }
        }
        
        if (this.currentElement === 'ice') {
            enemy.slowStacks = Math.min(5, enemy.slowStacks + 1);
            
            if (Math.random() < 0.2 && !enemy.isFrozen) {
                this.freezeEnemy(enemy);
            }
            
            this.updateSlowEffect(enemy);
        }
        
        if (enemy.isFrozen) {
            enemy.health -= damage * 0.5;
        }
        
        const flashColor = this.currentElement === 'ice' ? 0x00ffff : 0xffffff;
        enemy.sprite.setTint(flashColor);
        this.time.delayedCall(100, () => {
            if (enemy.sprite && enemy.sprite.active) {
                if (enemy.isFrozen) {
                    enemy.sprite.setTint(0x88ccff);
                } else if (enemy.burnDegree === 5) {
                    enemy.sprite.setTint(0x00ccff);
                } else if (enemy.burnDegree > 0) {
                    enemy.sprite.setTint(0xff6600);
                } else {
                    enemy.sprite.clearTint();
                }
            }
        });
        
        this.updateEnemyHealthBar(enemy);
        
        if (enemy.health <= 0) {
            this.killEnemy(enemy);
        }
    }

    killEnemy(enemy) {
        // COSMIC: 50% chance to drop charge
        if (this.currentElement === 'cosmic' && Math.random() < this.cosmicDropChance) {
            this.addCosmicCharge(enemy.sprite.x, enemy.sprite.y);
        }

        if (enemy.sprite) enemy.sprite.destroy();
        if (enemy.healthBarBg) enemy.healthBarBg.destroy();
        if (enemy.healthBarFill) enemy.healthBarFill.destroy();
        if (enemy.burnText) enemy.burnText.destroy();
        
        if (enemy.burnIndicators) {
            enemy.burnIndicators.forEach(indicator => {
                this.tweens.killTweensOf(indicator);
                indicator.destroy();
            });
        }
        
        if (enemy.freezeVisuals) {
            this.tweens.killTweensOf(enemy.freezeVisuals.iceBlock);
            this.tweens.killTweensOf(enemy.freezeVisuals.iceBorder);
            this.tweens.killTweensOf(enemy.freezeVisuals.multiplierText);
            enemy.freezeVisuals.iceBlock.destroy();
            enemy.freezeVisuals.iceBorder.destroy();
            enemy.freezeVisuals.multiplierText.destroy();
        }
        
        // COSMIC MARKS CLEANUP (make sure this is here!)
        if (enemy.cosmicMarkVisuals) {
            enemy.cosmicMarkVisuals.forEach(v => {
                this.tweens.killTweensOf(v);
                v.destroy();
            });
            enemy.cosmicMarkVisuals = null; // Set to null after destroying
        }
        
        const index = this.enemies.indexOf(enemy);
        if (index > -1) {
            this.enemies.splice(index, 1);
        }
    }

    switchToElement(targetElement) {
        const currentTime = this.time.now;
        
        // Can't switch to same element
        if (this.currentElement === targetElement) {
            return;
        }
        
        // Check cooldown
        if (currentTime - this.lastElementSwitchTime < this.elementSwitchCooldown) {
            return;
        }
        
        this.isPointerDown = false;
        
        // Clear projectiles
        for (let fireball of this.fireballs) {
            if (fireball.sprite) {
                fireball.sprite.destroy();
            }
        }
        this.fireballs = [];
        
        // Clear hailstorms
        for (let hailstorm of this.hailstorms) {
            if (hailstorm.visuals) {
                hailstorm.visuals.forEach(v => {
                    this.tweens.killTweensOf(v);
                    v.destroy();
                });
            }
        }
        this.hailstorms = [];
        
        // Switch to new element
        this.currentElement = targetElement;
        
        const colors = {
            'fire': 0xff6600,
            'ice': 0x00ccff,
            'lightning': 0xffff00,
            'cosmic': 0x9966ff
        };
        
        const pulseColor = colors[this.currentElement];
        
        const playerScreenX = this.player.x - this.cameras.main.scrollX;
        const playerScreenY = this.player.y - this.cameras.main.scrollY;
        
        const pulse = this.add.circle(
            playerScreenX,
            playerScreenY,
            10,
            pulseColor,
            0.6
        );
        pulse.setScrollFactor(0);
        
        this.tweens.add({
            targets: pulse,
            radius: Math.max(this.scale.width, this.scale.height) * 1.5,
            alpha: 0,
            duration: 400,
            ease: 'Cubic.easeOut',
            onComplete: () => {
                pulse.destroy();
            }
        });
        
        this.player.setTint(pulseColor);
        this.time.delayedCall(300, () => {
            this.player.clearTint();
        });
        
        this.lastElementSwitchTime = currentTime;
        this.updateHUD();
        
        console.log(`Switched to ${this.currentElement}`);
    }

    updateBurnDegree(enemy) {
        const stacks = enemy.burnStacks;
        
        let newDegree = 0;
        
        if (stacks >= 12) {
            newDegree = 4;
        } else if (stacks >= 6) {
            newDegree = 3;
        } else if (stacks >= 3) {
            newDegree = 2;
        } else if (stacks >= 1) {
            newDegree = 1;
        }
        
        if (newDegree > enemy.burnDegree) {
            enemy.burnDegree = newDegree;
            this.applyBurnDegree(enemy, newDegree);
            
            if (newDegree > 0) {
                enemy.sprite.setTint(0xff6600);
                this.updateBurnVisual(enemy);
            }
        } else if (newDegree === enemy.burnDegree && newDegree > 0 && enemy.burnDegree < 5) {
            this.applyBurnDegree(enemy, newDegree);
            this.updateBurnVisual(enemy);
        }
    }

    updateBurnEffects(time) {
        for (let enemy of this.enemies) {
            if (enemy.hadSuperburn && enemy.burnDegree === 5) {
                const timeSinceHit = time - enemy.lastHitTime;
                
                const stacksToLose = Math.floor(timeSinceHit / 450);
                
                if (stacksToLose > 0 && enemy.burnStacks > 0) {
                    enemy.burnStacks = Math.max(0, enemy.burnStacks - stacksToLose);
                    enemy.lastHitTime = time;
                    
                    if (enemy.burnStacks === 0) {
                        enemy.burnDegree = 0;
                        enemy.burnTicksRemaining = 0;
                        enemy.hadSuperburn = false;
                        if (enemy.sprite && enemy.sprite.active) {
                            enemy.sprite.clearTint();
                        }
                        this.updateBurnVisual(enemy);
                        console.log('Superburn ended - stacks depleted');
                    } else {
                        this.updateBurnVisual(enemy);
                    }
                }
            } else if (enemy.lastHitTime > 0 && enemy.burnDegree < 5) {
                const timeSinceHit = time - enemy.lastHitTime;
                if (timeSinceHit > 4000) {
                    enemy.burnStacks = 0;
                    enemy.burnDegree = 0;
                    enemy.burnTicksRemaining = 0;
                    enemy.lastHitTime = 0;
                    enemy.hadSuperburn = false;
                    if (enemy.sprite && enemy.sprite.active) {
                        enemy.sprite.clearTint();
                    }
                    this.updateBurnVisual(enemy);
                }
            }
            
            if (enemy.burnDegree > 0) {
                if (time - enemy.lastBurnTime >= enemy.burnTickInterval) {
                    enemy.health -= enemy.burnTickDamage;
                    
                    if (enemy.burnTicksRemaining > 0 && enemy.burnDegree < 5) {
                        enemy.burnTicksRemaining--;
                    }
                    
                    enemy.lastBurnTime = time;
                    
                    if (enemy.sprite && enemy.sprite.active) {
                        enemy.sprite.setTint(0xffffff);
                        this.time.delayedCall(100, () => {
                            if (enemy.sprite && enemy.sprite.active) {
                                if (enemy.burnDegree === 5) {
                                    enemy.sprite.setTint(0x00ccff);
                                } else if (enemy.burnDegree > 0) {
                                    enemy.sprite.setTint(0xff6600);
                                } else {
                                    enemy.sprite.clearTint();
                                }
                            }
                        });
                    }
                    
                    this.updateEnemyHealthBar(enemy);
                    
                    if (enemy.health <= 0) {
                        this.killEnemy(enemy);
                        continue;
                    }
                    
                    if (enemy.burnTicksRemaining <= 0 && enemy.burnDegree < 5) {
                        enemy.burnDegree = 0;
                        enemy.burnStacks = 0;
                        enemy.hadSuperburn = false;
                        enemy.lastHitTime = 0;
                        if (enemy.sprite && enemy.sprite.active) {
                            enemy.sprite.clearTint();
                        }
                        this.updateBurnVisual(enemy);
                    }
                }
            }
        }
    }

    updateBurnVisual(enemy) {
        if (enemy.burnIndicators) {
            enemy.burnIndicators.forEach(indicator => indicator.destroy());
        }
        enemy.burnIndicators = [];
        
        if (enemy.burnDegree === 0) return;
        
        let numDots;
        if (enemy.burnDegree === 5 && enemy.hadSuperburn) {
            numDots = enemy.burnStacks;
        } else {
            numDots = enemy.burnDegree;
        }
        
        const dotSpacing = 8;
        const startX = enemy.sprite.x - ((numDots - 1) * dotSpacing) / 2;
        
        let outerColor, middleColor, coreColor;
        
        if (enemy.burnDegree === 5) {
            outerColor = 0x0099ff;
            middleColor = 0x00ccff;
            coreColor = 0xffffff;
        } else {
            outerColor = 0xff3300;
            middleColor = 0xff6600;
            coreColor = 0xffff00;
        }
        
        for (let i = 0; i < numDots; i++) {
            const x = startX + (i * dotSpacing);
            const y = enemy.sprite.y - 10;
            
            const outer = this.add.circle(x, y, 3, outerColor, 0.8);
            enemy.burnIndicators.push(outer);
            
            const middle = this.add.circle(x, y, 2, middleColor, 1);
            enemy.burnIndicators.push(middle);
            
            const core = this.add.circle(x, y, 1, coreColor, 1);
            enemy.burnIndicators.push(core);
        }
    }

    updateHailstorms(time) {
        for (let i = this.hailstorms.length - 1; i >= 0; i--) {
            const hailstorm = this.hailstorms[i];
            const age = time - hailstorm.createdAt;
            
            if (age > this.hailstormDuration) {
                hailstorm.visuals.forEach(v => {
                    this.tweens.killTweensOf(v);
                    v.destroy();
                });
                this.hailstorms.splice(i, 1);
                continue;
            }
            
            if (time - hailstorm.lastTickTime >= this.hailstormTickInterval) {
                hailstorm.lastTickTime = time;
                
                for (let enemy of this.enemies) {
                    const dist = Math.abs(enemy.x - hailstorm.tileX) + Math.abs(enemy.y - hailstorm.tileY);
                    
                    if (dist <= this.hailstormRadius) {
                        this.damageEnemyIce(enemy, this.baseHailstormDamage * this.damageScaling);
                    }
                }
            }
        }
    }

    shootChainLightning(targetX, targetY) {
        const worldX = targetX + this.cameras.main.scrollX;
        const worldY = targetY + this.cameras.main.scrollY;
        
        const targetTileX = Math.floor(worldX / this.TILE_SIZE);
        const targetTileY = Math.floor(worldY / this.TILE_SIZE);
        
        let targetEnemy = null;
        let minDist = Infinity;
        
        for (let enemy of this.enemies) {
            const dist = Math.abs(enemy.x - targetTileX) + Math.abs(enemy.y - targetTileY);
            if (dist < minDist) {
                minDist = dist;
                targetEnemy = enemy;
            }
        }
        
        if (minDist <= 2) {
            this.drawLightningBolt(
                { sprite: this.player },
                targetEnemy
            );
            
            const falloff = this.stormCloudActive ? this.lightningUltChainFalloff : this.lightningChainFalloff;
            this.performChainLightning(targetEnemy, this.baseLightningDamage * this.damageScaling, [], falloff);
        } else {
            console.log('No enemy near target location');
        }
    }

    performChainLightning(sourceEnemy, damage, hitEnemies, falloff) {
        hitEnemies.push(sourceEnemy);
        
        this.damageEnemy(sourceEnemy, damage);
        
        sourceEnemy.sprite.setTint(0xffff00);
        this.time.delayedCall(100, () => {
            if (sourceEnemy.sprite && sourceEnemy.sprite.active) {
                sourceEnemy.sprite.clearTint();
            }
        });
        
        let nearestEnemy = null;
        let nearestDist = Infinity;
        
        for (let enemy of this.enemies) {
            if (hitEnemies.includes(enemy)) continue;
            
            const dist = Math.abs(enemy.x - sourceEnemy.x) + Math.abs(enemy.y - sourceEnemy.y);
            
            if (dist <= this.lightningChainRange && dist < nearestDist) {
                nearestEnemy = enemy;
                nearestDist = dist;
            }
        }
        
        if (nearestEnemy) {
            this.drawLightningBolt(sourceEnemy, nearestEnemy);
            
            const nextDamage = damage * falloff;
            
            this.performChainLightning(nearestEnemy, nextDamage, hitEnemies, falloff);
        } else {
            console.log(`Chain ended after hitting ${hitEnemies.length} enemies`);
        }
    }

    drawLightningBolt(fromEnemy, toEnemy) {
        const fromX = fromEnemy.sprite.x;
        const fromY = fromEnemy.sprite.y + 8;
        const toX = toEnemy.sprite.x;
        const toY = toEnemy.sprite.y + 8;
        
        const graphics = this.add.graphics();
        
        // MAIN BOLT - bright yellow core
        graphics.lineStyle(4, 0xffff00, 1);
        
        const segments = 8; // More segments for more jagged look
        const points = [];
        
        for (let i = 0; i <= segments; i++) {
            const t = i / segments;
            const x = fromX + (toX - fromX) * t;
            const y = fromY + (toY - fromY) * t;
            
            if (i > 0 && i < segments) {
                const dx = toX - fromX;
                const dy = toY - fromY;
                const length = Math.sqrt(dx * dx + dy * dy);
                
                const perpX = -dy / length;
                const perpY = dx / length;
                
                // More aggressive jagged offsets
                const offset = (Math.random() - 0.5) * 20;
                
                points.push({
                    x: x + perpX * offset,
                    y: y + perpY * offset
                });
            } else {
                points.push({ x, y });
            }
        }
        
        // OUTER GLOW (white/cyan)
        graphics.lineStyle(12, 0xaaffff, 0.3);
        graphics.beginPath();
        graphics.moveTo(points[0].x, points[0].y);
        for (let i = 1; i < points.length; i++) {
            graphics.lineTo(points[i].x, points[i].y);
        }
        graphics.strokePath();
        
        // MIDDLE LAYER (bright white)
        graphics.lineStyle(8, 0xffffff, 0.6);
        graphics.beginPath();
        graphics.moveTo(points[0].x, points[0].y);
        for (let i = 1; i < points.length; i++) {
            graphics.lineTo(points[i].x, points[i].y);
        }
        graphics.strokePath();
        
        // CORE BOLT (bright yellow)
        graphics.lineStyle(4, 0xffff00, 1);
        graphics.beginPath();
        graphics.moveTo(points[0].x, points[0].y);
        for (let i = 1; i < points.length; i++) {
            graphics.lineTo(points[i].x, points[i].y);
        }
        graphics.strokePath();
        
        // INNER BRIGHT LINE (pure white)
        graphics.lineStyle(2, 0xffffff, 1);
        graphics.beginPath();
        graphics.moveTo(points[0].x, points[0].y);
        for (let i = 1; i < points.length; i++) {
            graphics.lineTo(points[i].x, points[i].y);
        }
        graphics.strokePath();
        
        // SECONDARY FORKS (more and better)
        for (let i = 1; i < points.length - 1; i++) {
            if (Math.random() < 0.5) { // 50% chance for forks
                const forkLength = 15 + Math.random() * 25;
                const angle = Math.random() * Math.PI * 2;
                
                const forkMidX = points[i].x + Math.cos(angle) * (forkLength * 0.6);
                const forkMidY = points[i].y + Math.sin(angle) * (forkLength * 0.6);
                
                const forkEndX = points[i].x + Math.cos(angle + (Math.random() - 0.5) * 0.5) * forkLength;
                const forkEndY = points[i].y + Math.sin(angle + (Math.random() - 0.5) * 0.5) * forkLength;
                
                // Fork outer glow
                graphics.lineStyle(6, 0xaaffff, 0.3);
                graphics.beginPath();
                graphics.moveTo(points[i].x, points[i].y);
                graphics.lineTo(forkMidX, forkMidY);
                graphics.lineTo(forkEndX, forkEndY);
                graphics.strokePath();
                
                // Fork core
                graphics.lineStyle(2, 0xffff00, 0.9);
                graphics.beginPath();
                graphics.moveTo(points[i].x, points[i].y);
                graphics.lineTo(forkMidX, forkMidY);
                graphics.lineTo(forkEndX, forkEndY);
                graphics.strokePath();
                
                // Fork bright line
                graphics.lineStyle(1, 0xffffff, 1);
                graphics.beginPath();
                graphics.moveTo(points[i].x, points[i].y);
                graphics.lineTo(forkMidX, forkMidY);
                graphics.lineTo(forkEndX, forkEndY);
                graphics.strokePath();
            }
        }
        
        // IMPACT SPARKS at destination
        const numSparks = 8;
        for (let i = 0; i < numSparks; i++) {
            const angle = (Math.PI * 2 / numSparks) * i + Math.random() * 0.3;
            const length = 8 + Math.random() * 12;
            const endX = toX + Math.cos(angle) * length;
            const endY = toY + Math.sin(angle) * length;
            
            graphics.lineStyle(2, 0xffff00, 0.8);
            graphics.beginPath();
            graphics.moveTo(toX, toY);
            graphics.lineTo(endX, endY);
            graphics.strokePath();
        }
        
        // ORIGIN GLOW
        const originGlow = this.add.circle(fromX, fromY, 8, 0xffff00, 0.6);
        originGlow.setStrokeStyle(2, 0xffffff, 0.8);
        
        // DESTINATION IMPACT
        const impactFlash = this.add.circle(toX, toY, 12, 0xffffff, 0.9);
        const impactRing = this.add.circle(toX, toY, 12, 0xffff00, 0);
        impactRing.setStrokeStyle(3, 0xffff00, 1);
        
        // Animate impact
        this.tweens.add({
            targets: [impactFlash, impactRing],
            scaleX: 2,
            scaleY: 2,
            alpha: 0,
            duration: 200,
            ease: 'Quad.easeOut',
            onComplete: () => {
                impactFlash.destroy();
                impactRing.destroy();
            }
        });
        
        // Fade out origin glow
        this.tweens.add({
            targets: originGlow,
            alpha: 0,
            scaleX: 1.5,
            scaleY: 1.5,
            duration: 150,
            onComplete: () => originGlow.destroy()
        });
        
        // Main bolt fade out (faster)
        this.tweens.add({
            targets: graphics,
            alpha: 0,
            duration: 120,
            onComplete: () => {
                graphics.destroy();
            }
        });
    }

    deployStormField(targetX, targetY) {
        console.log('Deploying storm field!');
        
        const worldX = targetX + this.cameras.main.scrollX;
        const worldY = targetY + this.cameras.main.scrollY;
        
        const tileX = Math.floor(worldX / this.TILE_SIZE);
        const tileY = Math.floor(worldY / this.TILE_SIZE);
        
        const centerPixelX = tileX * this.TILE_SIZE + this.TILE_SIZE / 2;
        const centerPixelY = tileY * this.TILE_SIZE + this.TILE_SIZE / 2;
        
        // Destroy storm cloud visuals
        if (this.stormCloud) {
            if (this.stormCloud.flashInterval) {
                this.stormCloud.flashInterval.remove();
            }
            this.tweens.killTweensOf(this.stormCloud.body);
            this.tweens.killTweensOf(this.stormCloud.darkCore);
            this.tweens.killTweensOf(this.stormCloud.crackle);
            this.tweens.killTweensOf(this.stormCloud.outerCrackle);
            this.stormCloud.sparks.forEach(spark => this.tweens.killTweensOf(spark));
            
            this.stormCloud.body.destroy();
            this.stormCloud.darkCore.destroy();
            this.stormCloud.crackle.destroy();
            this.stormCloud.outerCrackle.destroy();
            this.stormCloud.chargeText.destroy();
            this.stormCloud.sparks.forEach(spark => spark.destroy());
            this.stormCloud = null;
        }
        
        const chargePercent = this.stormCloudCharge / 100;
        const startRadius = this.stormFieldRadius * chargePercent;
        const radiusPixels = startRadius * this.TILE_SIZE;
        
        const fieldCircle = this.add.circle(
            centerPixelX,
            centerPixelY,
            radiusPixels,
            0xffff00,
            0.2
        );
        
        const fieldBorder = this.add.circle(
            centerPixelX,
            centerPixelY,
            radiusPixels
        );
        fieldBorder.setStrokeStyle(3, 0xffff00, 0.8);
        
        const lifespanText = this.add.text(
            centerPixelX,
            centerPixelY,
            '3.0s',
            {
                fontSize: '16px',
                fontFamily: 'monospace',
                color: '#ffffff',
                stroke: '#ffff00',
                strokeThickness: 3,
                fontStyle: 'bold'
            }
        ).setOrigin(0.5);
        
        this.tweens.add({
            targets: [fieldCircle, fieldBorder],
            scaleX: 1.1,
            scaleY: 1.1,
            alpha: 0.4,
            duration: 300,
            yoyo: true,
            repeat: -1,
            ease: 'Sine.easeInOut'
        });
        
        this.stormField = {
            circle: fieldCircle,
            border: fieldBorder,
            lifespanText: lifespanText,
            tileX: tileX,
            tileY: tileY,
            createdAt: this.time.now,
            expiresAt: this.time.now + (this.stormFieldDuration * chargePercent),
            radiusTiles: startRadius,
            lastLifeGainTime: 0
        };
        
        this.stormCloudActive = false;
        this.stormFieldLastTick = this.time.now;
        
        console.log(`Storm field deployed with ${startRadius.toFixed(1)} tile radius`);
    }

    updateStormField(time) {
        if (!this.stormField) return;
        
        const timeLeft = (this.stormField.expiresAt - time) / 1000;
        if (timeLeft > 0) {
            this.stormField.lifespanText.setText(`${timeLeft.toFixed(1)}s`);
        }
        
        if (time >= this.stormField.expiresAt) {
            this.deactivateStormField();
            return;
        }
        
        // Radius based on charge percentage
        const chargePercent = this.stormCloudCharge / 100;
        const scaledRadius = this.stormField.radiusTiles * chargePercent;
        const radiusPixels = scaledRadius * this.TILE_SIZE;
        
        this.stormField.circle.radius = radiusPixels;
        this.stormField.border.radius = radiusPixels;
        
        // ATTACK ENEMIES IN FIELD
        if (time - this.stormFieldLastTick >= this.stormFieldTickInterval) {
            this.stormFieldLastTick = time;
            
            const enemiesInField = [];
            
            for (let enemy of this.enemies) {
                const enemyPixelX = enemy.x * this.TILE_SIZE + this.TILE_SIZE / 2;
                const enemyPixelY = enemy.y * this.TILE_SIZE + this.TILE_SIZE / 2;
                const fieldPixelX = this.stormField.tileX * this.TILE_SIZE + this.TILE_SIZE / 2;
                const fieldPixelY = this.stormField.tileY * this.TILE_SIZE + this.TILE_SIZE / 2;
                
                const dist = Phaser.Math.Distance.Between(
                    enemyPixelX, enemyPixelY,
                    fieldPixelX, fieldPixelY
                );
                
                if (dist <= radiusPixels) {
                    enemiesInField.push(enemy);
                }
            }
            
            if (enemiesInField.length > 0) {
                // Pick random enemy to start chain from
                const randomEnemy = enemiesInField[Math.floor(Math.random() * enemiesInField.length)];
                
                const fieldPixelX = this.stormField.tileX * this.TILE_SIZE + this.TILE_SIZE / 2;
                const fieldPixelY = this.stormField.tileY * this.TILE_SIZE + this.TILE_SIZE / 2;
                
                // Draw lightning from field center to enemy
                this.drawLightningBolt(
                    { sprite: { x: fieldPixelX, y: fieldPixelY } },
                    randomEnemy
                );
                
                // Chain lightning with group bonus
                const groupBonus = 1.0 + (enemiesInField.length * 0.2);
                const fieldDamage = (this.baseLightningDamage * this.damageScaling) * chargePercent * groupBonus;
                
                const hitEnemies = [];
                this.performChainLightning(randomEnemy, fieldDamage, hitEnemies, this.lightningUltChainFalloff);
                const hitCount = hitEnemies.length;
                
                // Extend lifespan if hit enemies
                if (hitCount > 0) {
                    if (time - this.stormField.lastLifeGainTime >= this.stormFieldLifeGainCooldown) {
                        this.stormField.expiresAt += this.stormFieldLifeGainAmount;
                        this.stormField.lastLifeGainTime = time;
                        console.log(`Storm field lifespan extended! +${this.stormFieldLifeGainAmount / 1000}s`);
                    }
                    
                    // Grow radius
                    for (let i = 0; i < hitCount; i++) {
                        if (this.stormField.radiusTiles < this.stormFieldMaxRadius) {
                            this.stormField.radiusTiles += this.stormFieldRadiusGrowthPerHit;
                            this.stormField.radiusTiles = Math.min(this.stormField.radiusTiles, this.stormFieldMaxRadius);
                        }
                    }
                }
            }
            
            // Decay charge
            this.stormCloudCharge -= this.stormCloudChargeDecayPerAttack;
            
            if (this.stormCloudCharge <= 0) {
                this.deactivateStormField();
            }
        }
    }

    deactivateStormField() {
        console.log('Storm field depleted!');
        
        if (this.stormField) {
            this.tweens.add({
                targets: [this.stormField.circle, this.stormField.border, this.stormField.lifespanText],
                alpha: 0,
                duration: 300,
                onComplete: () => {
                    this.tweens.killTweensOf(this.stormField.circle);
                    this.tweens.killTweensOf(this.stormField.border);
                    this.stormField.circle.destroy();
                    this.stormField.border.destroy();
                    this.stormField.lifespanText.destroy();
                    this.stormField = null;
                }
            });
        }
    }

    activateUlt() {
        const currentTime = this.time.now;
        const cooldown = this.ultCooldowns[this.currentElement];
        const lastUse = this.lastUltTimes[this.currentElement];
        
        if (currentTime - lastUse < cooldown) {
            console.log(`${this.currentElement} ult on cooldown`);
            return;
        }
        
        if (this.currentElement === 'fire') {
            this.activateFireScorch();
        } else if (this.currentElement === 'ice') {
            this.activateIceBlizzard();
        } else if (this.currentElement === 'lightning') {
            this.activateLightningStorm();
        } else if (this.currentElement === 'cosmic') {
            this.activateCosmicBlackHole();
        }
        
        this.lastUltTimes[this.currentElement] = currentTime;
    }

    activateFireScorch() {
        console.log('FIRE SCORCH ACTIVATED!');
        
        this.player.setTint(0xff0000);
        this.time.delayedCall(300, () => {
            this.player.clearTint();
        });
        
        let upgradedCount = 0;

        for (let enemy of this.enemies) {
            if (enemy.burnDegree > 0) {
                const oldDegree = enemy.burnDegree;
                enemy.burnDegree = Math.min(5, enemy.burnDegree + 1);
                
                if (enemy.burnDegree === 5) {
                    enemy.burnStacks = 5;
                }
        
                this.applyBurnDegree(enemy, enemy.burnDegree);
                
                upgradedCount++;
                
                enemy.sprite.setTint(0xff3300);
                this.time.delayedCall(200, () => {
                    if (enemy.sprite && enemy.sprite.active) {
                        if (enemy.burnDegree === 5) {
                            enemy.sprite.setTint(0x00ccff);
                        } else if (enemy.burnDegree > 0) {
                            enemy.sprite.setTint(0xff6600);
                        }
                    }
                });
                
                this.updateBurnVisual(enemy);
                
                console.log(`Enemy upgraded from degree ${oldDegree} to ${enemy.burnDegree}`);
            }
        }
        
        console.log(`Scorch upgraded ${upgradedCount} burning enemies`);
    }

    activateIceBlizzard() {
        console.log('ICE BLIZZARD ACTIVATED!');
        
        this.ultActive = true;
        this.iceUltEndTime = this.time.now + this.iceUltDuration;
        this.damageReductionMultiplier = 0.5;
        this.attackSpeedMultiplier = 4.0; 
        
        this.player.setTint(0x00ccff);
        
        this.time.delayedCall(this.iceUltDuration, () => {
            this.deactivateIceBlizzard();
        });
    }

    activateLightningStorm() {
        console.log('LIGHTNING STORM ACTIVATED!');
        
        this.stormCloudActive = true;
        this.stormCloudCharge = 100;
        this.stormCloudLastAttack = this.time.now;
        
        const cloudX = this.player.x;
        const cloudY = this.player.y - 40;
        
        // MASSIVE STORM CLOUD (much bigger)
        const cloudBody = this.add.circle(cloudX, cloudY, 35, 0x333333, 0.9);
        cloudBody.setStrokeStyle(3, 0x555555, 1);
        
        // INNER DARK CORE
        const darkCore = this.add.circle(cloudX, cloudY, 25, 0x222222, 1);
        
        // ELECTRIC CRACKLE RING (bright yellow)
        const crackle = this.add.circle(cloudX, cloudY, 38, 0xffff00, 0);
        crackle.setStrokeStyle(4, 0xffff00, 0.8);
        
        // OUTER ELECTRIC RING
        const outerCrackle = this.add.circle(cloudX, cloudY, 45, 0xffffff, 0);
        outerCrackle.setStrokeStyle(2, 0xaaffff, 0.5);
        
        // LIGHTNING SPARKS (small circles around cloud)
        const sparks = [];
        for (let i = 0; i < 6; i++) {
            const angle = (Math.PI * 2 / 6) * i;
            const distance = 40;
            const spark = this.add.circle(
                cloudX + Math.cos(angle) * distance,
                cloudY + Math.sin(angle) * distance,
                3,
                0xffff00,
                1
            );
            sparks.push(spark);
        }
        
        // CHARGE PERCENTAGE TEXT (bigger and brighter)
        const chargeText = this.add.text(
            cloudX,
            cloudY,
            '100%',
            {
                fontSize: '16px',
                fontFamily: 'monospace',
                color: '#ffff00',
                stroke: '#000000',
                strokeThickness: 4,
                fontStyle: 'bold'
            }
        ).setOrigin(0.5);
        
        // PULSING ANIMATIONS
        this.tweens.add({
            targets: [cloudBody, darkCore],
            scaleX: 1.15,
            scaleY: 1.15,
            duration: 400,
            yoyo: true,
            repeat: -1,
            ease: 'Sine.easeInOut'
        });
        
        this.tweens.add({
            targets: [crackle],
            scaleX: 1.3,
            scaleY: 1.3,
            alpha: 0.6,
            duration: 300,
            yoyo: true,
            repeat: -1,
            ease: 'Sine.easeInOut'
        });
        
        this.tweens.add({
            targets: [outerCrackle],
            scaleX: 1.4,
            scaleY: 1.4,
            alpha: 0.8,
            duration: 250,
            yoyo: true,
            repeat: -1,
            ease: 'Sine.easeInOut',
            delay: 100
        });
        
        // ROTATING SPARKS
        this.tweens.add({
            targets: sparks,
            angle: 360,
            duration: 2000,
            repeat: -1,
            ease: 'Linear'
        });
        
        // SPARK PULSING
        sparks.forEach((spark, index) => {
            this.tweens.add({
                targets: spark,
                scaleX: 1.5,
                scaleY: 1.5,
                alpha: 0.5,
                duration: 300,
                yoyo: true,
                repeat: -1,
                ease: 'Sine.easeInOut',
                delay: index * 50
            });
        });
        
        // RANDOM LIGHTNING FLASHES from cloud
        const flashInterval = this.time.addEvent({
            delay: 200,
            callback: () => {
                if (!this.stormCloudActive) {
                    flashInterval.remove();
                    return;
                }
                
                // Random lightning flash
                const flash = this.add.circle(cloudX, cloudY, 50, 0xffffff, 0.4);
                this.tweens.add({
                    targets: flash,
                    scaleX: 2,
                    scaleY: 2,
                    alpha: 0,
                    duration: 100,
                    onComplete: () => flash.destroy()
                });
            },
            loop: true
        });
        
        this.stormCloud = {
            body: cloudBody,
            darkCore: darkCore,
            crackle: crackle,
            outerCrackle: outerCrackle,
            sparks: sparks,
            chargeText: chargeText,
            flashInterval: flashInterval
        };
        
        // INITIAL SCREEN FLASH
        const screenFlash = this.add.rectangle(
            this.scale.width / 2,
            this.scale.height / 2,
            this.scale.width,
            this.scale.height,
            0xffffff,
            0.6
        );
        screenFlash.setScrollFactor(0);
        
        this.tweens.add({
            targets: screenFlash,
            alpha: 0,
            duration: 200,
            onComplete: () => screenFlash.destroy()
        });
        
        this.player.setTint(0xffff00);
        this.time.delayedCall(300, () => {
            this.player.clearTint();
        });
    }
    
    updateStormCloud(time) {
        if (!this.stormCloudActive || !this.stormCloud) return;
        
        const cloudX = this.stormCloud.thrown ? this.stormCloud.thrownX : this.player.x;
        const cloudY = this.stormCloud.thrown ? this.stormCloud.thrownY : (this.player.y - 40);
        
        // Only follow player if not thrown
        if (!this.stormCloud.thrown) {
            this.stormCloud.body.x = this.player.x;
            this.stormCloud.body.y = this.player.y - 40;
            this.stormCloud.darkCore.x = this.player.x;
            this.stormCloud.darkCore.y = this.player.y - 40;
            this.stormCloud.crackle.x = this.player.x;
            this.stormCloud.crackle.y = this.player.y - 40;
            this.stormCloud.outerCrackle.x = this.player.x;
            this.stormCloud.outerCrackle.y = this.player.y - 40;
            this.stormCloud.chargeText.x = this.player.x;
            this.stormCloud.chargeText.y = this.player.y - 40;
            
            // Update spark positions
            this.stormCloud.sparks.forEach((spark, index) => {
                const baseAngle = (Math.PI * 2 / 6) * index;
                const rotationAngle = baseAngle + (time / 2000) * Math.PI * 2;
                const distance = 40;
                spark.x = cloudX + Math.cos(rotationAngle) * distance;
                spark.y = cloudY + Math.sin(rotationAngle) * distance;
            });
        }
        
        // Update charge text and color
        const chargePercent = Math.floor(this.stormCloudCharge);
        this.stormCloud.chargeText.setText(`${chargePercent}%`);
        
        // Change color based on charge
        if (chargePercent > 70) {
            this.stormCloud.chargeText.setColor('#ffff00');
        } else if (chargePercent > 30) {
            this.stormCloud.chargeText.setColor('#ffaa00');
        } else {
            this.stormCloud.chargeText.setColor('#ff6600');
        }
        
        if (time - this.stormCloudLastAttack >= this.stormCloudAutoAttackInterval) {
            this.stormCloudAutoAttack();
            this.stormCloudLastAttack = time;
            
            this.stormCloudCharge -= this.stormCloudChargeDecayPerAttack;
            
            if (this.stormCloudCharge <= 0) {
                this.deactivateStormCloud();
            }
        }
        
        const chargePercent2 = this.stormCloudCharge / 100;
        this.stormCloud.body.setScale(0.8 + chargePercent2 * 0.4);
        this.stormCloud.darkCore.setScale(0.8 + chargePercent2 * 0.4);
        this.stormCloud.crackle.setAlpha(0.4 + chargePercent2 * 0.4);
        this.stormCloud.outerCrackle.setAlpha(0.3 + chargePercent2 * 0.5);
    }

    stormCloudAutoAttack() {
        const nearbyEnemies = [];
        const maxRange = 15;
        
        for (let enemy of this.enemies) {
            const dist = Math.abs(enemy.x - this.playerX) + Math.abs(enemy.y - this.playerY);
            if (dist <= maxRange) {
                nearbyEnemies.push({ enemy, dist });
            }
        }
        
        if (nearbyEnemies.length === 0) return;
        
        nearbyEnemies.sort((a, b) => a.dist - b.dist);
        
        const targetsToHit = Math.min(3, nearbyEnemies.length);
        const hitTargets = [];
        
        for (let i = 0; i < targetsToHit; i++) {
            const target = nearbyEnemies[i].enemy;
            
            let tooClose = false;
            for (let hitTarget of hitTargets) {
                const distBetween = Math.abs(target.x - hitTarget.x) + Math.abs(target.y - hitTarget.y);
                if (distBetween < 4) {
                    tooClose = true;
                    break;
                }
            }
            
            if (!tooClose) {
                hitTargets.push(target);
            }
        }
        
        for (let target of hitTargets) {
            console.log('Storm cloud auto-attack on spread enemy!');
            
            this.drawLightningBolt(
                { sprite: this.stormCloud.body },
                target
            );
            
            this.performChainLightning(target, this.baseLightningDamage * this.damageScaling * 0.8, [], this.lightningUltChainFalloff);
        }
    }

    deactivateStormCloud() {
        console.log('Storm cloud depleted!');
        
        this.stormCloudActive = false;
        
        if (this.stormCloud) {
            // Stop flash interval
            if (this.stormCloud.flashInterval) {
                this.stormCloud.flashInterval.remove();
            }
            
            // Kill all tweens
            this.tweens.killTweensOf(this.stormCloud.body);
            this.tweens.killTweensOf(this.stormCloud.darkCore);
            this.tweens.killTweensOf(this.stormCloud.crackle);
            this.tweens.killTweensOf(this.stormCloud.outerCrackle);
            this.stormCloud.sparks.forEach(spark => {
                this.tweens.killTweensOf(spark);
            });
            
            // Fade out all elements
            this.tweens.add({
                targets: [
                    this.stormCloud.body, 
                    this.stormCloud.darkCore,
                    this.stormCloud.crackle, 
                    this.stormCloud.outerCrackle,
                    this.stormCloud.chargeText,
                    ...this.stormCloud.sparks
                ],
                alpha: 0,
                duration: 300,
                onComplete: () => {
                    this.stormCloud.body.destroy();
                    this.stormCloud.darkCore.destroy();
                    this.stormCloud.crackle.destroy();
                    this.stormCloud.outerCrackle.destroy();
                    this.stormCloud.chargeText.destroy();
                    this.stormCloud.sparks.forEach(spark => spark.destroy());
                    this.stormCloud = null;
                }
            });
        }
    }

    throwLightning() {
        if (!this.stormCloudActive || !this.stormCloud) return;
        
        console.log('Throwing lightning storm!');
        
        const worldX = this.pointerX + this.cameras.main.scrollX;
        const worldY = this.pointerY + this.cameras.main.scrollY;
        
        const tileX = Math.floor(worldX / this.TILE_SIZE);
        const tileY = Math.floor(worldY / this.TILE_SIZE);
        
        const targetPixelX = tileX * this.TILE_SIZE + this.TILE_SIZE / 2;
        const targetPixelY = tileY * this.TILE_SIZE + this.TILE_SIZE / 2;
        
        // Mark cloud as thrown
        this.stormCloud.thrown = true;
        this.stormCloud.thrownX = targetPixelX;
        this.stormCloud.thrownY = targetPixelY;
        
        // Animate throw
        const allElements = [
            this.stormCloud.body,
            this.stormCloud.darkCore,
            this.stormCloud.crackle,
            this.stormCloud.outerCrackle,
            this.stormCloud.chargeText,
            ...this.stormCloud.sparks
        ];
        
        this.tweens.add({
            targets: allElements,
            x: targetPixelX,
            y: targetPixelY,
            duration: 500,
            ease: 'Quad.easeOut'
        });
        
        console.log(`Storm cloud thrown to (${tileX}, ${tileY})`);
    }

    deactivateIceBlizzard() {
        this.ultActive = false;
        this.damageReductionMultiplier = 1.0;
        this.attackSpeedMultiplier = 1.0;
        this.player.clearTint();
        console.log('Ice Blizzard ended');
    }

    applyBurnDegree(enemy, degree) {
        let tickInterval = 0;
        let tickDamage = 0;
        let ticks = 0;
        
        if (degree === 5) {
            tickInterval = 50;     
            tickDamage = this.baseBurnDamage.degree5 * this.damageScaling;     
            ticks = 999;
            enemy.hadSuperburn = true;       
        } else if (degree === 4) {
            tickInterval = 250;
            tickDamage = this.baseBurnDamage.degree4 * this.damageScaling;
            ticks = 3;
        } else if (degree === 3) {
            tickInterval = 500;
            tickDamage = this.baseBurnDamage.degree3 * this.damageScaling;
            ticks = 3;
        } else if (degree === 2) {
            tickInterval = 1000;
            tickDamage = this.baseBurnDamage.degree2 * this.damageScaling;
            ticks = 3;
        } else if (degree === 1) {
            tickInterval = 2000;
            tickDamage = this.baseBurnDamage.degree1 * this.damageScaling;
            ticks = 3;
        }
        
        enemy.burnTickInterval = tickInterval;
        enemy.burnTickDamage = tickDamage;
        enemy.burnTicksRemaining = ticks;
        enemy.lastBurnTime = this.time.now;
    }

    damageEnemyIce(enemy, damage) {
        const actualDamage = enemy.isFrozen ? damage * 1.5 : damage;
        enemy.health -= actualDamage;
            
        enemy.isSlowed = true;
        enemy.slowedUntil = this.time.now + 5000;
        
        if (Math.random() < 0.1 && !enemy.isFrozen) {
            enemy.isFrozen = true;
            enemy.frozenUntil = this.time.now + 2000;
            this.createFreezeVisual(enemy);
            console.log('Enemy frozen!');
        }
        
        if (!enemy.isFrozen) {
            enemy.sprite.setTint(0x00ffff);
            this.time.delayedCall(100, () => {
                if (enemy.sprite && enemy.sprite.active && !enemy.isFrozen) {
                    enemy.sprite.clearTint();
                }
            });
        }
        
        this.updateEnemyHealthBar(enemy);
        
        if (enemy.health <= 0) {
            this.killEnemy(enemy);
        }
    }

    createFreezeVisual(enemy) {
        const blockY = enemy.sprite.y + 10;

        const iceBlock = this.add.rectangle(
            enemy.sprite.x,
            blockY,
            this.TILE_SIZE * 0.8,
            this.TILE_SIZE * 0.8,
            0x88ccff,
            0.6
        );
        
        const iceBorder = this.add.rectangle(
            enemy.sprite.x,
            blockY,
            this.TILE_SIZE * 0.8,
            this.TILE_SIZE * 0.8
        );
        iceBorder.setStrokeStyle(2, 0xffffff, 0.8);
        
        const multiplierText = this.add.text(
            enemy.sprite.x,
            blockY - 16,
            '1.5x',
            {
                fontSize: '16px',
                fontFamily: 'monospace',
                color: '#ffffff',
                stroke: '#00ccff',
                strokeThickness: 2
            }
        ).setOrigin(0.5);
        
        this.tweens.add({
            targets: multiplierText,
            scaleX: 1.3,
            scaleY: 1.3,
            duration: 300,
            yoyo: true,
            repeat: -1,
            ease: 'Sine.easeInOut'
        });
        
        this.tweens.add({
            targets: [iceBlock, iceBorder],
            alpha: 0.8,
            duration: 500,
            yoyo: true,
            repeat: -1,
            ease: 'Sine.easeInOut'
        });
        
        enemy.sprite.setTint(0x88ccff);
        
        enemy.freezeVisuals = {
            iceBlock: iceBlock,
            iceBorder: iceBorder,
            multiplierText: multiplierText
        };
    }

    showShieldBlock(blockedAmount) {
        const shield = this.add.circle(
            this.player.x,
            this.player.y - 20,
            12,
            0x00ccff,
            0.8
        );
        
        const shieldBorder = this.add.circle(
            this.player.x,
            this.player.y - 20,
            12
        );
        shieldBorder.setStrokeStyle(3, 0xffffff, 1);
        
        const blockText = this.add.text(
            this.player.x,
            this.player.y - 20,
            `-${blockedAmount.toFixed(1)}`,
            {
                fontSize: '14px',
                fontFamily: 'monospace',
                color: '#ffffff',
                stroke: '#00ccff',
                strokeThickness: 3,
                fontStyle: 'bold'
            }
        ).setOrigin(0.5);
        
        this.tweens.add({
            targets: [shield, shieldBorder, blockText],
            y: this.player.y - 40,
            scaleX: 1.5,
            scaleY: 1.5,
            alpha: 0,
            duration: 800,
            ease: 'Quad.easeOut',
            onComplete: () => {
                shield.destroy();
                shieldBorder.destroy();
                blockText.destroy();
            }
        });
    }

    progressToNextFloor() {
        this.damageLevel++;
        this.damageScaling = 1.0 + (this.damageLevel - 1) * 0.2;
        console.log(`Floor ${this.damageLevel}: Damage scaling ${this.damageScaling.toFixed(2)}x`);
    }

    addCosmicCharge(x, y) {
        if (this.cosmicBatteryCharges >= this.cosmicMaxCharges) return;
        
        this.cosmicBatteryCharges++;
        this.updateHUD();
        
        const chargePickup = this.add.container(x, y);
        
        const outerGlow = this.add.circle(0, 0, 20, 0x9966ff, 0.3);
        
        const middleRing = this.add.circle(0, 0, 15, 0xcc99ff, 0.5);
        
        const innerCore = this.add.circle(0, 0, 10, 0xffffff, 0.8);
        
        const sparkles = [];
        for (let i = 0; i < 6; i++) {
            const angle = (Math.PI * 2 / 6) * i;
            const dist = 12;
            const sparkle = this.add.circle(
                Math.cos(angle) * dist,
                Math.sin(angle) * dist,
                2,
                0xffffff,
                0.9
            );
            sparkles.push(sparkle);
        }
        
        const text = this.add.text(0, -25, '+1', {
            fontSize: '20px',
            fontFamily: 'monospace',
            color: '#ffffff',
            stroke: '#9966ff',
            strokeThickness: 4,
            fontStyle: 'bold'
        }).setOrigin(0.5);
        
        chargePickup.add([outerGlow, middleRing, innerCore, ...sparkles, text]);
        
        this.tweens.add({
            targets: sparkles,
            angle: 360,
            duration: 1000,
            ease: 'Linear'
        });
        
        this.tweens.add({
            targets: chargePickup,
            y: y - 50,
            alpha: 0,
            duration: 1500,
            ease: 'Quad.easeOut',
            onComplete: () => chargePickup.destroy()
        });
        
        this.tweens.add({
            targets: [outerGlow, middleRing, innerCore],
            scaleX: 1.5,
            scaleY: 1.5,
            duration: 300,
            yoyo: true,
            ease: 'Quad.easeOut'
        });
    }

    updateCosmicPassiveCharge(time) {
        if (this.currentElement !== 'cosmic') return;
        
        if (time - this.lastCosmicPassiveCharge >= this.cosmicPassiveChargeInterval) {
            this.lastCosmicPassiveCharge = time;
            
            if (this.cosmicBatteryCharges < this.cosmicMaxCharges) {
                this.cosmicBatteryCharges++;
                this.updateHUD();
                
                const notification = this.add.text(
                    this.scale.width / 2,
                    80,
                    'CHARGE GAINED',
                    {
                        fontSize: '16px',
                        fontFamily: 'monospace',
                        color: '#9966ff',
                        stroke: '#000000',
                        strokeThickness: 3
                    }
                ).setOrigin(0.5).setScrollFactor(0);
                
                this.tweens.add({
                    targets: notification,
                    y: 60,
                    alpha: 0,
                    duration: 1000,
                    onComplete: () => notification.destroy()
                });
            }
        }
    }

    updateCosmicCharge(time) {
        if (!this.cosmicCharging) return;
        
        this.cosmicChargeHoldTime = time - this.cosmicChargeStartTime;
        
        // 3x charge rate during black hole
        const chargeRateMultiplier = this.cosmicBlackHole ? 3 : 1;
        const adjustedTime = this.cosmicChargeHoldTime * chargeRateMultiplier;
        
        const seconds = adjustedTime / 1000;
        const chargeMultiplier = Math.pow(2, Math.min(seconds, 3));
        
        if (!this.cosmicChargeIndicator) {
            this.cosmicChargeIndicator = this.add.container(this.player.x, this.player.y);
            
            const outerRing = this.add.circle(0, 0, 30, 0x9966ff, 0);
            outerRing.setStrokeStyle(3, 0x9966ff, 0.5);
            
            const middleRing = this.add.circle(0, 0, 20, 0xcc99ff, 0);
            middleRing.setStrokeStyle(2, 0xcc99ff, 0.7);
            
            const innerCore = this.add.circle(0, 0, 10, 0xffffff, 0.3);
            
            const chargeText = this.add.text(0, 0, '1x', {
                fontSize: '16px',
                fontFamily: 'monospace',
                color: '#ffffff',
                fontStyle: 'bold'
            }).setOrigin(0.5);
            
            this.cosmicChargeIndicator.add([outerRing, middleRing, innerCore, chargeText]);
            this.cosmicChargeIndicator.setData('outerRing', outerRing);
            this.cosmicChargeIndicator.setData('middleRing', middleRing);
            this.cosmicChargeIndicator.setData('innerCore', innerCore);
            this.cosmicChargeIndicator.setData('chargeText', chargeText);
        }
        
        this.cosmicChargeIndicator.x = this.player.x;
        this.cosmicChargeIndicator.y = this.player.y;
        
        const outerRing = this.cosmicChargeIndicator.getData('outerRing');
        const middleRing = this.cosmicChargeIndicator.getData('middleRing');
        const innerCore = this.cosmicChargeIndicator.getData('innerCore');
        const chargeText = this.cosmicChargeIndicator.getData('chargeText');
        
        outerRing.setScale(1 + seconds * 0.3);
        middleRing.setScale(1 + seconds * 0.2);
        innerCore.setScale(1 + seconds * 0.4);
        innerCore.setAlpha(0.3 + seconds * 0.2);
        
        chargeText.setText(`${chargeMultiplier.toFixed(1)}x`);
        
        // During black hole, make it more intense
        if (this.cosmicBlackHole) {
            const ultPulse = 1 + Math.sin(time / 30) * 0.2;
            outerRing.setScale(outerRing.scaleX * ultPulse);
            middleRing.setScale(middleRing.scaleX * ultPulse);
            innerCore.setAlpha(innerCore.alpha * ultPulse);
        } else if (seconds > 2) {
            const pulse = 1 + Math.sin(time / 50) * 0.1;
            outerRing.setScale(outerRing.scaleX * pulse);
            middleRing.setScale(middleRing.scaleX * pulse);
        }
    }

    releaseCosmicBeam() {
        const holdTime = this.time.now - this.cosmicChargeStartTime;
        const chargeRateMultiplier = this.cosmicBlackHole ? 3 : 1;
        const adjustedTime = holdTime * chargeRateMultiplier;
        const seconds = adjustedTime / 1000;
        const chargeMultiplier = Math.pow(2, Math.min(seconds, 3));
 
        const worldX = this.pointerX + this.cameras.main.scrollX;
        const worldY = this.pointerY + this.cameras.main.scrollY;
        
        const playerPixelX = this.playerX * this.TILE_SIZE + this.TILE_SIZE / 2;
        const playerPixelY = this.playerY * this.TILE_SIZE + this.TILE_SIZE / 2;
        
        const dx = worldX - playerPixelX;
        const dy = worldY - playerPixelY;
        const distance = Math.sqrt(dx * dx + dy * dy);
        
        if (distance === 0) {
            this.cosmicCharging = false;
            if (this.cosmicChargeIndicator) {
                this.cosmicChargeIndicator.destroy();
                this.cosmicChargeIndicator = null;
            }
            return;
        }
        
        const dirX = dx / distance;
        const dirY = dy / distance;
        
        // Black hole: no damage multiplier, just faster charging
        const beamWidthMultiplier = 1;
        
        const damage = this.cosmicBaseBeamDamage * this.damageScaling * chargeMultiplier;
        this.fireCosmicBeam(playerPixelX, playerPixelY, dirX, dirY, damage, chargeMultiplier, beamWidthMultiplier);
        
        this.cosmicCharging = false;
        if (this.cosmicChargeIndicator) {
            this.cosmicChargeIndicator.destroy();
            this.cosmicChargeIndicator = null;
        }
    }

    fireCosmicBeam(startX, startY, dirX, dirY, damage, visualMultiplier, beamWidthMultiplier = 1) {
        let beamEndX = startX;
        let beamEndY = startY;
        const maxRange = 100;
        
        for (let i = 0; i < maxRange * this.TILE_SIZE; i += this.TILE_SIZE / 4) {
            const testX = startX + dirX * i;
            const testY = startY + dirY * i;
            const tileX = Math.floor(testX / this.TILE_SIZE);
            const tileY = Math.floor(testY / this.TILE_SIZE);
            
            if (tileX < 0 || tileX >= this.WORLD_WIDTH || tileY < 0 || tileY >= this.WORLD_HEIGHT) {
                break;
            }
            
            if (this.world[tileX][tileY] === this.WALL) {
                break;
            }
            
            beamEndX = testX;
            beamEndY = testY;
        }
        
        const graphics = this.add.graphics();
        
        const outerWidth = (20 + visualMultiplier * 5) * beamWidthMultiplier;
        graphics.lineStyle(outerWidth, 0x9966ff, 0.2);
        graphics.beginPath();
        graphics.moveTo(startX, startY);
        graphics.lineTo(beamEndX, beamEndY);
        graphics.strokePath();
        
        const middleWidth = (12 + visualMultiplier * 3) * beamWidthMultiplier;
        graphics.lineStyle(middleWidth, 0xcc99ff, 0.5);
        graphics.beginPath();
        graphics.moveTo(startX, startY);
        graphics.lineTo(beamEndX, beamEndY);
        graphics.strokePath();
        
        const coreWidth = (6 + visualMultiplier * 2) * beamWidthMultiplier;
        graphics.lineStyle(coreWidth, 0xffffff, 0.9);
        graphics.beginPath();
        graphics.moveTo(startX, startY);
        graphics.lineTo(beamEndX, beamEndY);
        graphics.strokePath();
        
        graphics.lineStyle(3 * beamWidthMultiplier, 0xffffff, 1);
        graphics.beginPath();
        graphics.moveTo(startX, startY);
        graphics.lineTo(beamEndX, beamEndY);
        graphics.strokePath();
        
        this.tweens.add({
            targets: graphics,
            alpha: 0,
            duration: 400,
            onComplete: () => graphics.destroy()
        });
        
        const hitEnemies = [];
        const beamWidthPixels = this.cosmicBeamWidth * this.TILE_SIZE * beamWidthMultiplier;
        
        // Check if fully charged (8x)
        const isFullyCharged = visualMultiplier >= 8;
        
        for (let enemy of this.enemies) {
            const enemyPixelX = enemy.x * this.TILE_SIZE + this.TILE_SIZE / 2;
            const enemyPixelY = enemy.y * this.TILE_SIZE + this.TILE_SIZE / 2;
            
            const distToLine = this.pointToLineDistance(
                enemyPixelX, enemyPixelY,
                startX, startY,
                beamEndX, beamEndY
            );
            
            if (distToLine <= beamWidthPixels) {
                hitEnemies.push(enemy);
                
                let finalDamage = damage;
                
                // CONSUME MARKS if fully charged (8x)
                if (isFullyCharged && enemy.cosmicMarks > 0) {
                    const markBonus = enemy.cosmicMarks * this.cosmicMarkDamagePerStack;
                    finalDamage += markBonus;
                    
                    console.log(`Consumed ${enemy.cosmicMarks} marks for +${markBonus} bonus damage!`);
                    
                    // LIFESTEAL: Heal based on marks consumed
                    const healPerMark = 5; // Heal 5 HP per mark consumed
                    const healAmount = enemy.cosmicMarks * healPerMark;
                    
                    if (healAmount > 0 && this.health < this.maxHealth) {
                        this.health = Math.min(this.maxHealth, this.health + healAmount);
                        this.updateHUD();
                        
                        // Visual: healing sparkle on player
                        const healSparkle = this.add.text(
                            this.player.x,
                            this.player.y - 20,
                            `+${healAmount} HP`,
                            {
                                fontSize: '16px',
                                fontFamily: 'monospace',
                                color: '#66ff66',
                                stroke: '#003300',
                                strokeThickness: 3,
                                fontStyle: 'bold'
                            }
                        ).setOrigin(0.5);
                        
                        this.tweens.add({
                            targets: healSparkle,
                            y: this.player.y - 40,
                            alpha: 0,
                            duration: 800,
                            ease: 'Quad.easeOut',
                            onComplete: () => healSparkle.destroy()
                        });
                    }
                    
                    // Visual feedback for mark consumption
                    const consumeText = this.add.text(
                        enemyPixelX,
                        enemyPixelY - 30,
                        `+${markBonus}`,
                        {
                            fontSize: '18px',
                            fontFamily: 'monospace',
                            color: '#ffff00',
                            stroke: '#9966ff',
                            strokeThickness: 3,
                            fontStyle: 'bold'
                        }
                    ).setOrigin(0.5);
                    
                    this.tweens.add({
                        targets: consumeText,
                        y: enemyPixelY - 50,
                        alpha: 0,
                        duration: 800,
                        onComplete: () => consumeText.destroy()
                    });
                    
                    // Clear marks
                    enemy.cosmicMarks = 0;
                    this.updateCosmicMarkVisual(enemy);
                }
                
                const enemyHealthBefore = enemy.health;
                this.damageEnemy(enemy, finalDamage);

                // During black hole: guaranteed charge drop if enemy died
                if (this.cosmicBlackHole && enemy.health <= 0 && enemyHealthBefore > 0) {
                    this.addCosmicCharge(enemyPixelX, enemyPixelY);
                }
                
                const impact = this.add.container(enemyPixelX, enemyPixelY);

                const flash = this.add.circle(0, 0, 15, 0xffffff, 0.9);
                const ring = this.add.circle(0, 0, 15, 0x9966ff, 0);
                ring.setStrokeStyle(3, 0x9966ff, 0.8);

                impact.add([flash, ring]);

                this.tweens.add({
                    targets: [flash, ring],
                    scaleX: 2,
                    scaleY: 2,
                    alpha: 0,
                    duration: 300,
                    onComplete: () => impact.destroy()
                });
            }
        }
        
        console.log(`Cosmic beam hit ${hitEnemies.length} enemies with ${visualMultiplier.toFixed(1)}x charge`);
    }

    pointToLineDistance(px, py, x1, y1, x2, y2) {
        const dx = x2 - x1;
        const dy = y2 - y1;
        const lengthSquared = dx * dx + dy * dy;
        
        if (lengthSquared === 0) return Math.sqrt((px - x1) * (px - x1) + (py - y1) * (py - y1));
        
        let t = ((px - x1) * dx + (py - y1) * dy) / lengthSquared;
        t = Math.max(0, Math.min(1, t));
        
        const projX = x1 + t * dx;
        const projY = y1 + t * dy;
        
        return Math.sqrt((px - projX) * (px - projX) + (py - projY) * (py - projY));
    }

    activateCosmicBlackHole() {
        console.log('COSMIC BLACK HOLE ACTIVATED!');
        
        // GRANT CHARGES ON ULT ACTIVATION
        const chargesGranted = 3; // Give 3 charges instantly
        this.cosmicBatteryCharges = Math.min(this.cosmicMaxCharges, this.cosmicBatteryCharges + chargesGranted);
        this.updateHUD();
        
        // Visual feedback for charge gain
        const chargeNotif = this.add.text(
            this.scale.width / 2,
            80,
            `+${chargesGranted} CHARGES`,
            {
                fontSize: '20px',
                fontFamily: 'monospace',
                color: '#9966ff',
                stroke: '#000000',
                strokeThickness: 4,
                fontStyle: 'bold'
            }
        ).setOrigin(0.5).setScrollFactor(0);
        
        this.tweens.add({
            targets: chargeNotif,
            y: 60,
            alpha: 0,
            duration: 1000,
            onComplete: () => chargeNotif.destroy()
        });
        
        // Fire projectile toward mouse
        const worldX = this.pointerX + this.cameras.main.scrollX;
        const worldY = this.pointerY + this.cameras.main.scrollY;
        
        const playerPixelX = this.playerX * this.TILE_SIZE + this.TILE_SIZE / 2;
        const playerPixelY = this.playerY * this.TILE_SIZE + this.TILE_SIZE / 2;
        
        const dx = worldX - playerPixelX;
        const dy = worldY - playerPixelY;
        const distance = Math.sqrt(dx * dx + dy * dy);
        
        if (distance === 0) return;
        
        const dirX = dx / distance;
        const dirY = dy / distance;
        
        // Create projectile
        const projectile = this.add.circle(playerPixelX, playerPixelY, 12, 0x9966ff, 0.8);
        projectile.setData('vx', dirX * this.cosmicBlackHoleSpeed);
        projectile.setData('vy', dirY * this.cosmicBlackHoleSpeed);
        
        // Pulsing effect
        this.tweens.add({
            targets: projectile,
            scaleX: 1.5,
            scaleY: 1.5,
            duration: 200,
            yoyo: true,
            repeat: -1
        });
        
        this.cosmicBlackHoleProjectile = projectile;
    }

    updateCosmicBlackHoleProjectile(delta) {
        if (!this.cosmicBlackHoleProjectile) return;
        
        const deltaSeconds = delta / 1000;
        const proj = this.cosmicBlackHoleProjectile;
        
        proj.x += proj.getData('vx') * deltaSeconds;
        proj.y += proj.getData('vy') * deltaSeconds;
        
        const tileX = Math.floor(proj.x / this.TILE_SIZE);
        const tileY = Math.floor(proj.y / this.TILE_SIZE);
        
        // Check collision with wall or enemy
        let shouldDeploy = false;
        let deployX = proj.x;
        let deployY = proj.y;
        
        // Hit wall
        if (tileX < 0 || tileX >= this.WORLD_WIDTH || 
            tileY < 0 || tileY >= this.WORLD_HEIGHT ||
            this.world[tileX][tileY] === this.WALL) {
            shouldDeploy = true;
        }
        
        // Hit enemy
        for (let enemy of this.enemies) {
            const enemyPixelX = enemy.x * this.TILE_SIZE + this.TILE_SIZE / 2;
            const enemyPixelY = enemy.y * this.TILE_SIZE + this.TILE_SIZE / 2;
            
            const dist = Math.sqrt((proj.x - enemyPixelX) ** 2 + (proj.y - enemyPixelY) ** 2);
            if (dist < this.TILE_SIZE) {
                shouldDeploy = true;
                deployX = enemyPixelX;
                deployY = enemyPixelY;
                break;
            }
        }
        
        if (shouldDeploy) {
            this.deployCosmicBlackHole(deployX, deployY);
            this.tweens.killTweensOf(proj);
            proj.destroy();
            this.cosmicBlackHoleProjectile = null;
        }
    }

    deployCosmicBlackHole(x, y) {
        console.log('Black hole deployed!');
        
        // Create vortex visuals
        const vortex = this.add.container(x, y);
        
        // OUTER DISTORTION RING (largest, dark purple)
        const distortionRing = this.add.circle(0, 0, this.cosmicBlackHoleRadius * this.TILE_SIZE * 1.2, 0x220044, 0.2);
        distortionRing.setStrokeStyle(2, 0x6633aa, 0.4);
        
        // OUTER RING (purple with glow)
        const outerRing = this.add.circle(0, 0, this.cosmicBlackHoleRadius * this.TILE_SIZE, 0x330066, 0.4);
        outerRing.setStrokeStyle(5, 0x9966ff, 0.9);
        
        // MIDDLE RING (brighter purple)
        const middleRing = this.add.circle(0, 0, this.cosmicBlackHoleRadius * this.TILE_SIZE * 0.6, 0x660099, 0.6);
        middleRing.setStrokeStyle(4, 0xaa77ff, 1);
        
        // INNER RING (bright purple/pink)
        const innerRing = this.add.circle(0, 0, this.cosmicBlackHoleRadius * this.TILE_SIZE * 0.3, 0x9933cc, 0.7);
        innerRing.setStrokeStyle(3, 0xdd99ff, 1);
        
        // CORE (bright yellow-white singularity)
        const core = this.add.circle(0, 0, this.cosmicBlackHoleRadius * this.TILE_SIZE * 0.15, 0xffff00, 1);
        core.setStrokeStyle(2, 0xffffff, 1);
        
        // Add all rings to container
        vortex.add([distortionRing, outerRing, middleRing, innerRing, core]);
        
        // ROTATING SPIRAL ARMS
        const numArms = 4;
        const arms = [];
        for (let i = 0; i < numArms; i++) {
            const arm = this.add.graphics();
            const startAngle = (Math.PI * 2 / numArms) * i;
            
            arm.lineStyle(3, 0x9966ff, 0.6);
            arm.beginPath();
            
            // Create spiral arm
            const armLength = this.cosmicBlackHoleRadius * this.TILE_SIZE;
            for (let r = 5; r < armLength; r += 2) {
                const spiralAngle = startAngle + (r / armLength) * Math.PI;
                const sx = Math.cos(spiralAngle) * r;
                const sy = Math.sin(spiralAngle) * r;
                
                if (r === 5) {
                    arm.moveTo(sx, sy);
                } else {
                    arm.lineTo(sx, sy);
                }
            }
            arm.strokePath();
            
            arms.push(arm);
            vortex.add(arm);
        }
        
        // PARTICLE SWIRL (small dots orbiting inward)
        const particles = [];
        for (let i = 0; i < 20; i++) {
            const angle = Math.random() * Math.PI * 2;
            const distance = (Math.random() * 0.8 + 0.2) * this.cosmicBlackHoleRadius * this.TILE_SIZE;
            const particle = this.add.circle(
                Math.cos(angle) * distance,
                Math.sin(angle) * distance,
                2,
                0xffffff,
                0.8
            );
            particles.push(particle);
            vortex.add(particle);
        }
        
        // PULSING ANIMATION - rings expand and contract
        this.tweens.add({
            targets: [outerRing],
            scaleX: 1.15,
            scaleY: 1.15,
            alpha: 0.6,
            duration: 600,
            yoyo: true,
            repeat: -1,
            ease: 'Sine.easeInOut'
        });
        
        this.tweens.add({
            targets: [middleRing],
            scaleX: 1.2,
            scaleY: 1.2,
            alpha: 0.8,
            duration: 500,
            yoyo: true,
            repeat: -1,
            ease: 'Sine.easeInOut',
            delay: 100
        });
        
        this.tweens.add({
            targets: [innerRing],
            scaleX: 1.3,
            scaleY: 1.3,
            alpha: 0.9,
            duration: 400,
            yoyo: true,
            repeat: -1,
            ease: 'Sine.easeInOut',
            delay: 200
        });
        
        // CORE PULSING (bright singularity)
        this.tweens.add({
            targets: [core],
            scaleX: 1.5,
            scaleY: 1.5,
            alpha: 0.7,
            duration: 300,
            yoyo: true,
            repeat: -1,
            ease: 'Sine.easeInOut'
        });
        
        // DISTORTION RING (slow pulse)
        this.tweens.add({
            targets: [distortionRing],
            scaleX: 1.1,
            scaleY: 1.1,
            alpha: 0.3,
            duration: 800,
            yoyo: true,
            repeat: -1,
            ease: 'Sine.easeInOut'
        });
        
        // ROTATING SPIRAL ARMS
        this.tweens.add({
            targets: vortex,
            angle: -360, // Counter-clockwise rotation
            duration: 3000,
            repeat: -1,
            ease: 'Linear'
        });
        
        // PARTICLE SWIRL ANIMATION
        particles.forEach((particle, index) => {
            this.tweens.add({
                targets: particle,
                angle: 360,
                duration: 2000 + (index * 100),
                repeat: -1,
                ease: 'Linear'
            });
            
            // Particles fade as they spiral in
            this.tweens.add({
                targets: particle,
                scaleX: 0.5,
                scaleY: 0.5,
                alpha: 0.3,
                duration: 1500,
                yoyo: true,
                repeat: -1,
                ease: 'Sine.easeInOut',
                delay: index * 50
            });
        });
        
        this.cosmicBlackHole = {
            container: vortex,
            x: x,
            y: y,
            tileX: Math.floor(x / this.TILE_SIZE),
            tileY: Math.floor(y / this.TILE_SIZE),
            createdAt: this.time.now,
            expiresAt: this.time.now + this.cosmicBlackHoleDuration,
            lastMarkTime: this.time.now,
            affectedEnemies: [],
            spiralArms: arms, // Store for potential shrinking
            particles: particles
        };
        
        // Enable fast charging
        this.cosmicInfiniteBeamActive = true;
        this.cosmicInfiniteBeamEndTime = this.cosmicBlackHole.expiresAt;
    }

    updateCosmicBlackHole(time) {
        if (!this.cosmicBlackHole) return;
        
        const bh = this.cosmicBlackHole;
        const elapsed = time - bh.createdAt;
        const progress = elapsed / this.cosmicBlackHoleDuration; // 0 to 1
        
        // Shrinking radius over time (4 tiles → 1 tile)
        const currentRadius = this.cosmicBlackHoleRadius * (1 - progress * 0.75);
        
        // UPDATE VISUALS TO MATCH SHRINKING RADIUS
        const radiusPixels = currentRadius * this.TILE_SIZE;
        const container = bh.container;
        const children = container.list;
        
        children[0].setRadius(radiusPixels); // outer ring
        children[1].setRadius(radiusPixels * 0.6); // middle ring
        children[2].setRadius(radiusPixels * 0.2); // core
        
        // Find enemies in radius
        for (let enemy of this.enemies) {
            const dist = Math.abs(enemy.x - bh.tileX) + Math.abs(enemy.y - bh.tileY);
            
            if (dist <= currentRadius) {
                // Add to affected if not already
                if (!bh.affectedEnemies.includes(enemy)) {
                    bh.affectedEnemies.push(enemy);
                }
                
                // Orbit enemy around center (clockwise)
                const angle = (time / 500) + (bh.affectedEnemies.indexOf(enemy) * Math.PI / 3); // stagger
                const orbitRadius = currentRadius * this.TILE_SIZE * 0.8;
                
                const targetX = bh.x + Math.cos(angle) * orbitRadius;
                const targetY = bh.y + Math.sin(angle) * orbitRadius;
                
                // CHECK IF TARGET POSITION IS VALID (not a wall)
                const targetTileX = Math.floor(targetX / this.TILE_SIZE);
                const targetTileY = Math.floor((targetY - this.SLIME_Y_OFFSET) / this.TILE_SIZE);
                
                // Only move if target tile is floor
                if (targetTileX >= 0 && targetTileX < this.WORLD_WIDTH &&
                    targetTileY >= 0 && targetTileY < this.WORLD_HEIGHT &&
                    this.world[targetTileX][targetTileY] === this.FLOOR) {
                    
                    // Smoothly move enemy
                    enemy.sprite.x = Phaser.Math.Linear(enemy.sprite.x, targetX, 0.1);
                    enemy.sprite.y = Phaser.Math.Linear(enemy.sprite.y, targetY, 0.1);
                    
                    // Update tile position to match sprite
                    enemy.x = Math.floor(enemy.sprite.x / this.TILE_SIZE);
                    enemy.y = Math.floor((enemy.sprite.y - this.SLIME_Y_OFFSET) / this.TILE_SIZE);
                }
                // If target is a wall, enemy stays where they are (doesn't clip through)
                
                // Update health bars
                this.updateEnemyHealthBar(enemy);
                
                // Update cosmic mark visuals
                if (enemy.cosmicMarkVisuals && enemy.cosmicMarkVisuals.length > 0) {
                    const markY = enemy.sprite.y - 25;
                    for (let i = 0; i < enemy.cosmicMarks; i++) {
                        const offsetX = (i - 1) * 12;
                        const visualIndex = i * 2;
                        if (visualIndex < enemy.cosmicMarkVisuals.length) {
                            enemy.cosmicMarkVisuals[visualIndex].x = enemy.sprite.x + offsetX;
                            enemy.cosmicMarkVisuals[visualIndex].y = markY;
                        }
                        if (visualIndex + 1 < enemy.cosmicMarkVisuals.length) {
                            enemy.cosmicMarkVisuals[visualIndex + 1].x = enemy.sprite.x + offsetX;
                            enemy.cosmicMarkVisuals[visualIndex + 1].y = markY;
                        }
                    }
                }
            }
        }
        
        // Apply marks every interval
        if (time - bh.lastMarkTime >= this.cosmicBlackHoleMarkInterval) {
            for (let enemy of bh.affectedEnemies) {
                if (enemy.cosmicMarks < this.cosmicMaxMarks) {
                    enemy.cosmicMarks++;
                    this.updateCosmicMarkVisual(enemy);
                }
            }
            bh.lastMarkTime = time;
        }
        
        // Expire
        if (time >= bh.expiresAt) {
            // Stun all affected enemies briefly
            for (let enemy of bh.affectedEnemies) {
                enemy.isStunned = true;
                enemy.stunnedUntil = time + 500;
                this.time.delayedCall(500, () => {
                    if (enemy.sprite && enemy.sprite.active) {
                        enemy.isStunned = false;
                    }
                });
            }
            
            // Destroy visuals
            this.tweens.killTweensOf(bh.container);
            bh.container.destroy();
            this.cosmicBlackHole = null;
            
            // EXTEND FAST CHARGING FOR GRACE PERIOD
            this.cosmicInfiniteBeamEndTime = time + this.cosmicBlackHoleGracePeriod;
            // cosmicInfiniteBeamActive stays true for the grace period
            
            console.log('Black hole ended! Fast charging continues for 2 more seconds...');
        }
    }

    updateCosmicMarkVisual(enemy) {
        // Destroy old visuals
        if (enemy.cosmicMarkVisuals) {
            enemy.cosmicMarkVisuals.forEach(v => {
                this.tweens.killTweensOf(v);
                v.destroy();
            });
        }
        enemy.cosmicMarkVisuals = [];
        
        if (enemy.cosmicMarks === 0) return;
        
        const markY = enemy.sprite.y - 25;
        
        // Create black hole visual based on stack count
        for (let i = 0; i < enemy.cosmicMarks; i++) {
            const offsetX = (i - 1) * 12; // spread marks horizontally
            
            // Outer ring (purple)
            const outerRing = this.add.circle(enemy.sprite.x + offsetX, markY, 8, 0x9966ff, 0);
            outerRing.setStrokeStyle(2, 0x9966ff, 0.8);
            
            // Inner core (yellow/white)
            const innerCore = this.add.circle(enemy.sprite.x + offsetX, markY, 4, 0xffff00, 0.9);
            
            // Pulsing animation
            this.tweens.add({
                targets: [outerRing, innerCore],
                scaleX: 1.3,
                scaleY: 1.3,
                duration: 400,
                yoyo: true,
                repeat: -1,
                ease: 'Sine.easeInOut'
            });
            
            // Rotation
            this.tweens.add({
                targets: outerRing,
                angle: 360,
                duration: 2000,
                repeat: -1,
                ease: 'Linear'
            });
            
            enemy.cosmicMarkVisuals.push(outerRing, innerCore);
        }
    }

    cosmicDash(dirX, dirY, oldTileX, oldTileY) {
        const currentTime = this.time.now;
        
        const dashCooldown = this.cosmicBlackHole ? this.cosmicDashCooldownUlt : this.cosmicDashCooldown;
        if (currentTime - this.lastCosmicDashTime < dashCooldown) {
            console.log('Dash on cooldown!');
            return;
        }

        const chargeCost = this.cosmicBlackHole ? 0.5 : 1;
        if (this.cosmicBatteryCharges < chargeCost) {
            console.log(`Need ${chargeCost} charge(s) to dash!`);
            return;
        }
        
        // Calculate all tiles in dash path (pierce through)
        const dashPath = [];
        for (let i = 1; i <= this.cosmicDashDistance; i++) {
            const checkX = this.playerX + (dirX * i);
            const checkY = this.playerY + (dirY * i);
            dashPath.push({ x: checkX, y: checkY });
        }
        
        // Check if final destination is valid
        const targetX = this.playerX + (dirX * this.cosmicDashDistance);
        const targetY = this.playerY + (dirY * this.cosmicDashDistance);
        
        if (targetX < 0 || targetX >= this.WORLD_WIDTH || 
            targetY < 0 || targetY >= this.WORLD_HEIGHT ||
            this.world[targetX][targetY] !== this.FLOOR) {
            console.log('Cannot dash there!');
            return;
        }
        
        // Consume charges
        this.cosmicBatteryCharges -= chargeCost;
        
        // Check all enemies in dash path
        let hitUnmarkedEnemy = false;
        const hitEnemies = [];
        
        for (let enemy of this.enemies) {
            // Check if enemy is in dash path
            const inPath = dashPath.some(tile => tile.x === enemy.x && tile.y === enemy.y);
            
            if (inPath) {
                hitEnemies.push(enemy);
                
                // Apply mark (max 3)
                if (enemy.cosmicMarks < this.cosmicMaxMarks) {
                    if (enemy.cosmicMarks === 0) {
                        hitUnmarkedEnemy = true; // Fresh enemy!
                    }
                    enemy.cosmicMarks++;
                    this.updateCosmicMarkVisual(enemy);
                }
                
                // Stun enemy
                enemy.isStunned = true;
                enemy.stunnedUntil = currentTime + this.cosmicDashStunDuration;
                
                // Flash
                enemy.sprite.setTint(0x9966ff);
                this.time.delayedCall(this.cosmicDashStunDuration, () => {
                    if (enemy.sprite && enemy.sprite.active) {
                        enemy.sprite.clearTint();
                        enemy.isStunned = false;
                    }
                });
            }
        }
        
        // Refund charge if hit at least one unmarked enemy
        if (hitUnmarkedEnemy) {
            this.cosmicBatteryCharges = Math.min(this.cosmicMaxCharges, this.cosmicBatteryCharges + 1);
            console.log('Charge refunded!');
        }
        
        // Draw trail using graphics API
        const oldTrailX = oldTileX * this.TILE_SIZE + this.TILE_SIZE / 2;
        const oldTrailY = oldTileY * this.TILE_SIZE + this.TILE_SIZE / 2;
        const newTrailX = targetX * this.TILE_SIZE + this.TILE_SIZE / 2;
        const newTrailY = targetY * this.TILE_SIZE + this.TILE_SIZE / 2;

        const graphics = this.add.graphics();
        graphics.lineStyle(8, 0x9966ff, 0.6);
        graphics.beginPath();
        graphics.moveTo(oldTrailX, oldTrailY);
        graphics.lineTo(newTrailX, newTrailY);
        graphics.strokePath();
        
        this.tweens.add({
            targets: graphics,
            alpha: 0,
            duration: 300,
            onComplete: () => graphics.destroy()
        });
        
        // Teleport player
        this.playerX = targetX;
        this.playerY = targetY;
        this.player.x = targetX * this.TILE_SIZE + this.TILE_SIZE / 2;
        this.player.y = targetY * this.TILE_SIZE + this.TILE_SIZE / 2 + this.SLIME_Y_OFFSET;
        
        // Visuals
        const burst = this.add.circle(this.player.x, this.player.y, 5, 0xffffff, 1);
        this.tweens.add({
            targets: burst,
            radius: 25,
            alpha: 0,
            duration: 300,
            onComplete: () => burst.destroy()
        });
        
        this.player.setTint(0x9966ff);
        this.time.delayedCall(150, () => {
            if (this.cosmicBlackHole) {
                this.player.setTint(0x9966ff);
            } else {
                this.player.clearTint();
            }
        });
        
        this.lastCosmicDashTime = currentTime;
        this.updateHUD();
        
        console.log(`Dashed through ${hitEnemies.length} enemies!`);
    }
}

const config = {
    type: Phaser.AUTO,
    width: window.innerWidth,
    height: window.innerHeight,
    scene: GameScene,
    pixelArt: true,
    backgroundColor: '#000000'
};

const game = new Phaser.Game(config);