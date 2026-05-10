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

        // FIRE: simple burn DoT
        this.burnDuration = 3000;      // ms enemy stays burning
        this.burnTickInterval = 600;   // ms between ticks
        this.burnTickDamage = 1.2;     // damage per tick

        // FIRE: splash + combustion
        this.fireballSplashRadius = 2;
        this.fireballSplashDamageRatio = 0.4;
        this.combustionThreshold = 15;
        this.combustionBurstMultiplier = 8.0;
        this.ignitionActive = false;
        this.ignitionEndTime = 0;
        this.ignitionDuration = 5000;
        this.ignitionPierceTrails = [];
        this.ignitionTrailDuration = 2000;

        // ICE ULT: tsunami
        this.brittlePerStack = 0.06;
        this.brittleMaxStacks = 5;
        this.brittleDecayTime = 6000;
        this.slowDuration = 3000;

        // ICE ULT: tsunami
        this.tsunamiActive = false;
        this.tsunamiTiles = [];
        this.tsunamiFrozenEnemies = [];
        this.tsunamiMaxRadius = 18;
        this.tsunamiWaveDuration = 2200;
        this.tsunamiFreezeDuration = 3000;
        this.tsunamiFreezeMultiplier = 1.5;

        // LIGHTNING: Thunderhead ult
        this.thunderheadActive = false;
        this.thunderheadEndTime = 0;
        this.thunderheadDuration = 6000;
        this.thunderheadGlideSpeed = 0.06;
        this.thunderheadTrailVisuals = [];
        this.thunderheadTrailInterval = 80;
        this.thunderheadLastTrail = 0;
        this.thunderheadTrailDamageRadius = 3;
        this.thunderheadChainFalloff = 0.85;
        this.thunderheadGlideX = 0;
        this.thunderheadGlideY = 0;
        
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
        this.elementSwitchCooldown = 1000; // 1 second cooldown
        this.lastElementSwitchTime = 0;

        // ICE: bouncing shards
        this.iceShards = [];
        this.iceShardSpeed = 150;
        this.iceShardDamage = 1.5;
        this.iceShardMaxBounces = 3;
        this.iceShardFreezeChance = 0.02;   // 2% chance per hit to become a freeze block
        this.iceBlockChance = 0.15;          // 15% chance on fire to shoot a big freeze block instead
        this.iceBlockDamage = 5.0;
        this.iceBlockFreezeDuration = 3000;

        this.lightningChainRange = 4; // tiles - range to chain between enemies
        this.baseLightningDamage = 1; // weak first hit
        this.lightningChainFalloff = 0.5; // 50% damage per chain (manual attacks)
        this.lightningUltChainFalloff = 0.95; // 95% damage per chain (ult attacks)
        this.lightningCooldown = 250;
        this.lightningMaxRange = 15; // can target enemies up to 15 tiles away

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

        // ULT CHARGE METER (replaces per-element cooldowns)
        this.ultCharge = 0;
        this.ultChargeMax = 100;
        this.ultChargeSwitchPenalty = 25;

        // Active ult drain tracking
        this.ultDrainActive = false;
        this.ultDrainStartTime = 0;
        this.ultDrainDuration = 0; // set when ult fires // lose this much on element switch

        // Charge rates per source
        this.ultChargePerHit = 3.0;          // fire/ice direct hit
        this.ultChargePerBurnTick = 0.8;     // fire burn tick
        this.ultChargePerChain = 1.5;        // lightning per click
        this.ultChargePerFreeze = 6.0;       // ice freeze proc
        this.ultChargePerCosmicMark = 8.0;   // cosmic mark consumed

        // Cosmic continuous laser (during ult)
        this.cosmicContinuousLaserActive = false;
        this.cosmicUltActive = false;         // tracks if ult mode is active
        this.cosmicLaserDrainInterval = 1000; // drain 1 charge per second
        this.cosmicLaserLastDrain = 0;
        this.cosmicLaserTickInterval = 80;    // fire beam visual every 80ms
        this.cosmicLaserLastTick = 0;

        this.damageReductionMultiplier = 1.0;
        this.attackSpeedMultiplier = 1.0;

        // E key to activate ult
        this.input.keyboard.on('keydown-E', () => {
            this.activateUlt();
        });

        // SPACE key — continuous laser only when cosmic ult is active
        this.input.keyboard.on('keydown-SPACE', () => {
            if (this.currentElement !== 'cosmic') return;

            if (this.cosmicUltActive && this.cosmicBatteryCharges >= 1) {
                // Ult is active and we have charges — activate laser
                this.cosmicContinuousLaserActive = true;
                this.cosmicLaserLastDrain = this.time.now;
                this.cosmicLaserLastTick = this.time.now;
            } else if (!this.cosmicUltActive && !this.cosmicCharging) {
                // Normal mode (no ult) — charge beam
                this.cosmicCharging = true;
                this.cosmicChargeStartTime = this.time.now;
            }
        });

        // Cosmic dash: hold Shift to charge, release to dash in last moved direction
        this.shiftKey = this.input.keyboard.addKey('SHIFT');

        this.input.keyboard.on('keyup-SPACE', () => {
            if (this.currentElement !== 'cosmic') return;
            if (this.cosmicUltActive) {
                this.cosmicContinuousLaserActive = false;
            } else if (this.cosmicCharging) {
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
        this.iceballCooldown = 500;
        this.fireballMaxRange = 30; 

        
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

        // Cosmic battery bar (purple) — shown above ult bar when on cosmic
        const cBarW = 280;
        const cBarH = 14;
        const cBarX = this.scale.width / 2 - cBarW / 2;
        const cBarY = this.scale.height - 58;

        this.cosmicBatteryBg = this.add.rectangle(cBarX, cBarY, cBarW, cBarH, 0x000000, 0.8).setOrigin(0, 0).setScrollFactor(0).setDepth(30);
        this.cosmicBatteryBorder = this.add.rectangle(cBarX, cBarY, cBarW, cBarH).setOrigin(0, 0).setScrollFactor(0).setDepth(30);
        this.cosmicBatteryBorder.setStrokeStyle(2, 0x9966ff, 0.8);
        this.cosmicBatteryFill = this.add.rectangle(cBarX, cBarY, 0, cBarH, 0x9966ff, 1).setOrigin(0, 0).setScrollFactor(0).setDepth(30);
        this.cosmicBatteryLabel = this.add.text(this.scale.width / 2, cBarY - 3, 'CHARGE', {
            fontSize: '10px', fontFamily: 'monospace', color: '#cc99ff',
            stroke: '#000000', strokeThickness: 2
        }).setOrigin(0.5, 1).setScrollFactor(0).setDepth(30);

        // Hide cosmic bar by default
        this.cosmicBatteryBg.setVisible(false);
        this.cosmicBatteryBorder.setVisible(false);
        this.cosmicBatteryFill.setVisible(false);
        this.cosmicBatteryLabel.setVisible(false);

        // Legacy text display — hidden, replaced by bar
        this.cosmicBatteryDisplay = { setVisible: () => {}, setText: () => {} };

        // ULT CHARGE BAR — bottom center
        this.ultBarW = 280;
        this.ultBarH = 20;
        this.ultBarX = this.scale.width / 2 - this.ultBarW / 2;
        this.ultBarY = this.scale.height - 36;

        this.ultBarBg = this.add.rectangle(this.ultBarX, this.ultBarY, this.ultBarW, this.ultBarH, 0x000000, 0.8).setOrigin(0, 0).setScrollFactor(0).setDepth(30);
        this.ultBarBorder = this.add.rectangle(this.ultBarX, this.ultBarY, this.ultBarW, this.ultBarH).setOrigin(0, 0).setScrollFactor(0).setDepth(30);
        this.ultBarBorder.setStrokeStyle(2, 0xffffff, 0.6);
        this.ultBarFill = this.make.graphics({ x: 0, y: 0, add: true });
        this.ultBarFill.setScrollFactor(0).setDepth(30);
        this.ultBarLabel = this.add.text(this.scale.width / 2, this.ultBarY - 4, 'ULT', {
            fontSize: '11px', fontFamily: 'monospace', color: '#aaaaaa',
            stroke: '#000000', strokeThickness: 2
        }).setOrigin(0.5, 1).setScrollFactor(0).setDepth(30);
        
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

        let ready;
        let elementText = elementSymbols[this.currentElement] || '';

        if (this.currentElement === 'cosmic') {
            ready = this.cosmicBatteryCharges >= 10;
            elementText += ready ? ' | ULT: READY' : ` | ULT: ${this.cosmicBatteryCharges}/10⚡`;
        } else {
            ready = this.ultCharge >= this.ultChargeMax;
            elementText += ready ? ' | ULT: READY' : ` | ULT: ${Math.floor(this.ultCharge)}%`;
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

        // Update ult bar / cosmic battery bar
        if (this.ultBarFill) {
            const barW = this.ultBarW;

            if (this.currentElement === 'cosmic') {
                // Hide ult bar, show cosmic purple bar
                this.ultBarBg.setVisible(false);
                this.ultBarBorder.setVisible(false);
                this.ultBarFill.setVisible(false);
                this.ultBarLabel.setVisible(false);

                const cPct = Math.min(this.cosmicBatteryCharges / this.cosmicMaxCharges, 1);
                this.cosmicBatteryBg.setVisible(true);
                this.cosmicBatteryBorder.setVisible(true);
                this.cosmicBatteryFill.setVisible(true);
                this.cosmicBatteryLabel.setVisible(true);
                this.cosmicBatteryFill.width = barW * cPct;
                // Pulse brighter at 10 charges
                if (this.cosmicBatteryCharges >= 10) {
                    this.cosmicBatteryFill.setFillStyle(0xddaaff);
                } else {
                    this.cosmicBatteryFill.setFillStyle(0x9966ff);
                }
            } else {
                // Show ult bar, hide cosmic bar
                this.cosmicBatteryBg.setVisible(false);
                this.cosmicBatteryBorder.setVisible(false);
                this.cosmicBatteryFill.setVisible(false);
                this.cosmicBatteryLabel.setVisible(false);
                this.ultBarBg.setVisible(true);
                this.ultBarBorder.setVisible(true);
                this.ultBarFill.setVisible(true);
                this.ultBarLabel.setVisible(true);

                if (this.ultDrainActive) {
                    const elapsed = this.time.now - this.ultDrainStartTime;
                    const pct = Math.max(0, 1 - elapsed / this.ultDrainDuration);
                    const width = barW * pct;
                    
                    this.ultBarFill.clear();
                    this.ultBarFill.fillGradientStyle(0xff2222, 0xff2222, 0xff2222, 0xff2222, 1);
                    this.ultBarFill.fillRect(this.ultBarX, this.ultBarY, width, this.ultBarH);
                    
                    this.ultBarLabel.setText('ULT ACTIVE');
                    this.ultBarLabel.setColor('#ff8888');
                } else {
                    const pct = Math.min(this.ultCharge / this.ultChargeMax, 1);
                    const width = barW * pct;
                    
                    // Interpolate between green and red based on charge percentage
                    const red = Math.floor(0xff * pct);
                    const green = Math.floor(0xff * (1 - pct));
                    const color = (red << 16) | (green << 8);
                    
                    this.ultBarFill.clear();
                    this.ultBarFill.fillGradientStyle(color, color, color, color, 1);
                    this.ultBarFill.fillRect(this.ultBarX, this.ultBarY, width, this.ultBarH);

                    if (ready) {
                        this.ultBarLabel.setText('ULT READY');
                        this.ultBarLabel.setColor('#ffffff');
                    } else {
                        this.ultBarLabel.setText('ULT');
                        this.ultBarLabel.setColor('#aaaaaa');
                    }
                }
            }
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

            if (!isCosmicCharging && !this.thunderheadActive) {
                if (this.keys.W.isDown) dy = -1;
                else if (this.keys.S.isDown) dy = 1;
                else if (this.keys.A.isDown) dx = -1;
                else if (this.keys.D.isDown) dx = 1;
            }
            
            if (this.isMobile && dx === 0 && dy === 0 && !this.thunderheadActive) {
                if (this.touchInput.up) dy = -1;
                else if (this.touchInput.down) dy = 1;
                else if (this.touchInput.left) dx = -1;
                else if (this.touchInput.right) dx = 1;
            }
            
            if (dx !== 0 || dy !== 0) {
                const newX = this.playerX + dx;
                const newY = this.playerY + dy;
                
                const enemyAtTarget = this.getEnemyAt(newX, newY);
                if (enemyAtTarget && !this.thunderheadActive) {
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

        // THUNDERHEAD: smooth glide movement overrides tile stepping
        if (this.thunderheadActive) {
            let gdx = 0, gdy = 0;
            if (this.keys.W.isDown) gdy = -1;
            else if (this.keys.S.isDown) gdy = 1;
            if (this.keys.A.isDown) gdx = -1;
            else if (this.keys.D.isDown) gdx = 1;

            if (gdx !== 0 || gdy !== 0) {
                const len = Math.sqrt(gdx * gdx + gdy * gdy);
                const spd = this.thunderheadGlideSpeed * delta;
                const nx = this.thunderheadGlideX + (gdx / len) * spd;
                const ny = this.thunderheadGlideY + (gdy / len) * spd;

                const ntx = Math.floor(nx / this.TILE_SIZE);
                const nty = Math.floor(ny / this.TILE_SIZE);

                if (ntx >= 0 && ntx < this.WORLD_WIDTH && nty >= 0 && nty < this.WORLD_HEIGHT && this.world[ntx][nty] === this.FLOOR) {
                    this.thunderheadGlideX = nx;
                    this.thunderheadGlideY = ny;
                    this.playerX = ntx;
                    this.playerY = nty;
                    this.player.x = nx;
                    this.player.y = ny + this.SLIME_Y_OFFSET;
                    this.updateHUD();
                } else {
                    // Snap to nearest valid floor tile
                    const snapResult = this.snapToNearestFloor(this.thunderheadGlideX, this.thunderheadGlideY);
                    if (snapResult) {
                        this.thunderheadGlideX = snapResult.px;
                        this.thunderheadGlideY = snapResult.py;
                        this.playerX = snapResult.tx;
                        this.playerY = snapResult.ty;
                        this.player.x = snapResult.px;
                        this.player.y = snapResult.py + this.SLIME_Y_OFFSET;
                        this.updateHUD();
                    }
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
        this.updateIgnitionTrails(time);
        this.updateIceShards(delta);
        this.updateBrittleDecay(time);
        this.updateTsunami(time);
        this.updateStormCloud(time); 
        this.updateStormField(time);
        this.updateThunderhead(time, delta);
        this.updateCosmicPassiveCharge(time);
        this.updateCosmicCharge(time);
        // Black hole projectile removed - using laser ult instead
        // this.updateCosmicBlackHoleProjectile(delta);
        this.updateCosmicBlackHole(time);

        // Update HUD every frame for smooth ult drain bar
        if (this.ultDrainActive || this.currentElement === 'cosmic') {
            this.updateHUD();
        }

        // Check if fast charging grace period ended
        if (this.cosmicInfiniteBeamActive && this.time.now >= this.cosmicInfiniteBeamEndTime) {
            this.cosmicInfiniteBeamActive = false;
            this.player.clearTint();
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
        sprite.setDepth(1);
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
            isFrozen: false,       
            frozenUntil: 0,        
            isSlowed: false,     
            slowedUntil: 0,
            lastMoveTime: 0,
            isStunned: false,
            stunnedUntil: 0,

            // ICE: brittle stacks
            brittleStacks: 0,
            lastBrittleHitTime: 0,

            // FIRE: simple burn
            isBurning: false,
            burnUntil: 0,
            lastBurnTick: 0,
            burnVisual: null,

            // FIRE: combustion
            combustionTriggered: false,

            // COSMIC MARKS
            cosmicMarks: 0,
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
        // Untargetable during Thunderhead
        if (this.thunderheadActive) {
            const ix = this.player.x - this.cameras.main.scrollX;
            const iy = this.player.y - this.cameras.main.scrollY;
            const txt = this.add.text(ix, iy - 20, 'IMMUNE', {
                fontSize: '14px', fontFamily: 'monospace',
                color: '#ffff88', stroke: '#000000', strokeThickness: 3, fontStyle: 'bold'
            }).setOrigin(0.5).setScrollFactor(0).setDepth(20);
            this.tweens.add({ targets: txt, y: txt.y - 20, alpha: 0, duration: 600, ease: 'Quad.easeOut', onComplete: () => txt.destroy() });
            return;
        }

        const actualDamage = amount * this.damageReductionMultiplier;
        const blockedDamage = amount - actualDamage;
        
        this.health -= actualDamage;
        
        if (blockedDamage > 0) {
            this.showShieldBlock(blockedDamage);
        }
        
        this.player.setTint(0xff0000);
        this.time.delayedCall(200, () => {
            this.player.clearTint();
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
                        if (enemy.freezeVisuals.iceBlock) {
                            this.tweens.killTweensOf(enemy.freezeVisuals.iceBlock);
                            enemy.freezeVisuals.iceBlock.setVisible(false);
                            enemy.freezeVisuals.iceBlock.destroy();
                        }
                        if (enemy.freezeVisuals.iceBorder) {
                            this.tweens.killTweensOf(enemy.freezeVisuals.iceBorder);
                            enemy.freezeVisuals.iceBorder.setVisible(false);
                            enemy.freezeVisuals.iceBorder.destroy();
                        }
                        if (enemy.freezeVisuals.multiplierText) {
                            this.tweens.killTweensOf(enemy.freezeVisuals.multiplierText);
                            enemy.freezeVisuals.multiplierText.setVisible(false);
                            enemy.freezeVisuals.multiplierText.destroy();
                        }
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
        
        const maxRange = this.currentElement === 'fire' ? this.fireballMaxRange : 30;
        if (distanceInTiles > maxRange) {
            return;
        }
        
        let baseCooldown;
        if (this.currentElement === 'fire') {
            baseCooldown = this.fireballCooldown;
        } else if (this.currentElement === 'ice') {
            baseCooldown = this.iceballCooldown;
        } else if (this.currentElement === 'lightning') {
            baseCooldown = this.lightningCooldown;
        }

        const effectiveCooldown = baseCooldown / this.attackSpeedMultiplier;

        if (currentTime - this.lastFireballTime < effectiveCooldown) {
            return;
        }
        
        if (this.currentElement === 'fire') {
            this.shootFireball(targetX, targetY);
        } else if (this.currentElement === 'ice') {
            this.shootIceShard(targetX, targetY);
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

        const fireball = this.add.sprite(playerPixelX, playerPixelY, 'fireball');
        fireball.setScale(1.5);
        
        this.fireballs.push({
            sprite: fireball,
            vx: dirX * this.fireballSpeed,
            vy: dirY * this.fireballSpeed,
            damage: this.baseFireballDamage * this.damageScaling,
            piercedEnemies: new Set()
        });
    }

    shootIceShard(targetX, targetY) {
        const worldX = targetX + this.cameras.main.scrollX;
        const worldY = targetY + this.cameras.main.scrollY;
        const playerPixelX = this.playerX * this.TILE_SIZE + this.TILE_SIZE / 2;
        const playerPixelY = this.playerY * this.TILE_SIZE + this.TILE_SIZE / 2;

        const dx = worldX - playerPixelX;
        const dy = worldY - playerPixelY;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist === 0) return;

        const vx = (dx / dist) * this.iceShardSpeed;
        const vy = (dy / dist) * this.iceShardSpeed;

        const isBlock = Math.random() < this.iceBlockChance;

        // Visual: sharp rotated diamond (shard) or bigger chunky square (block)
        let sprite;
        if (isBlock) {
            // Large ice block — bright cyan square with white border
            sprite = this.add.rectangle(playerPixelX, playerPixelY, 14, 14, 0x88eeff, 1);
            sprite.setStrokeStyle(2, 0xffffff, 1);
            sprite.setRotation(Math.PI / 4);
            sprite.setDepth(1);
            // Pulsing glow
            const glow = this.add.rectangle(playerPixelX, playerPixelY, 20, 20, 0x00ccff, 0.3);
            glow.setRotation(Math.PI / 4);
            glow.setDepth(1);
            this.tweens.add({ targets: glow, scaleX: 1.4, scaleY: 1.4, alpha: 0.1, duration: 200, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
            sprite._glow = glow;
        } else {
            // Small shard — narrow elongated diamond
            sprite = this.add.rectangle(playerPixelX, playerPixelY, 5, 12, 0xccffff, 0.95);
            sprite.setStrokeStyle(1, 0xffffff, 0.8);
            sprite.setRotation(Math.atan2(vy, vx) + Math.PI / 2);
            sprite.setDepth(1);
        }

        // Frost trail: tiny particles left behind
        this.iceShards.push({
            sprite,
            vx, vy,
            prevX: sprite.x,
            prevY: sprite.y,
            isBlock,
            bounces: 0,
            damage: isBlock ? this.iceBlockDamage * this.damageScaling : this.iceShardDamage * this.damageScaling,
            lastTrailTime: 0,
            hitEnemies: new Set()
        });
    }

    updateIceShards(delta) {
        const ds = delta / 1000;
        const time = this.time.now;

        for (let i = this.iceShards.length - 1; i >= 0; i--) {
            const s = this.iceShards[i];

            // Store previous position before moving
            const oldX = s.sprite.x;
            const oldY = s.sprite.y;

            // Move
            s.sprite.x += s.vx * ds;
            s.sprite.y += s.vy * ds;
            if (s.sprite._glow) { s.sprite._glow.x = s.sprite.x; s.sprite._glow.y = s.sprite.y; }

            // Frost trail
            if (time - s.lastTrailTime > 60) {
                s.lastTrailTime = time;
                const t = this.add.rectangle(s.sprite.x, s.sprite.y, 4, 4, 0xaaddff, 0.5);
                t.setDepth(0.5);
                this.tweens.add({ targets: t, alpha: 0, scaleX: 0.3, scaleY: 0.3, duration: 300, onComplete: () => t.destroy() });
            }

            const tileX = Math.floor(s.sprite.x / this.TILE_SIZE);
            const tileY = Math.floor(s.sprite.y / this.TILE_SIZE);

            // Check X and Y axes independently by probing one step ahead on each axis
            const nextTileX = Math.floor((s.sprite.x + s.vx * ds) / this.TILE_SIZE);
            const nextTileY = Math.floor((s.sprite.y + s.vy * ds) / this.TILE_SIZE);

            const outX = nextTileX < 0 || nextTileX >= this.WORLD_WIDTH;
            const outY = nextTileY < 0 || nextTileY >= this.WORLD_HEIGHT;

            const hitWallX = outX || (!outY && this.world[nextTileX][tileY] === this.WALL);
            const hitWallY = outY || (!outX && this.world[tileX][nextTileY] === this.WALL);

            if (hitWallX && !hitWallY) { s.vx = -s.vx; s.bounces++; this.spawnBounceImpact(s.sprite.x, s.sprite.y); }
            else if (hitWallY && !hitWallX) { s.vy = -s.vy; s.bounces++; this.spawnBounceImpact(s.sprite.x, s.sprite.y); }
            else if (hitWallX && hitWallY) { s.vx = -s.vx; s.vy = -s.vy; s.bounces += 2; this.spawnBounceImpact(s.sprite.x, s.sprite.y); }

            if (s.bounces > this.iceShardMaxBounces) {
                this.destroyIceShard(s);
                this.iceShards.splice(i, 1);
                continue;
            }

            // Rotate shard to match velocity direction
            if (!s.isBlock) {
                s.sprite.setRotation(Math.atan2(s.vy, s.vx) + Math.PI / 2);
            }

            // Enemy hit
            let destroyed = false;
            for (let enemy of this.enemies) {
                if (s.hitEnemies.has(enemy)) continue;
                const ex = enemy.sprite.x, ey = enemy.sprite.y;
                
                // Check distance from shard's path to enemy
                const distToPath = this.distancePointToSegment(ex, ey, oldX, oldY, s.sprite.x, s.sprite.y);
                const hitRadius = s.isBlock ? 16 : 10;
                
                if (distToPath < hitRadius) {
                    s.hitEnemies.add(enemy);
                    this.damageEnemyIce(enemy, s.damage);

                    if (s.isBlock) {
                        // Always freeze on block hit
                        this.freezeEnemy(enemy, this.iceBlockFreezeDuration);
                        this.applyBrittle(enemy, 2);
                        // Ice shatter burst
                        this.spawnIceSplinter(ex, ey);
                        this.spawnIceSplinter(ex, ey);
                        this.destroyIceShard(s);
                        this.iceShards.splice(i, 1);
                        destroyed = true;
                        break;
                    } else {
                        // Small shard: chance to freeze
                        if (Math.random() < this.iceShardFreezeChance && !enemy.isFrozen) {
                            this.freezeEnemy(enemy, 1500);
                        }
                        this.spawnBounceImpact(s.sprite.x, s.sprite.y);
                        // Bounce off enemy
                        const nx = (ex - s.sprite.x), ny = (ey - s.sprite.y);
                        const len = Math.sqrt(nx * nx + ny * ny);
                        const dot = (s.vx * nx + s.vy * ny) / (len * len);
                        s.vx -= 2 * dot * nx;
                        s.vy -= 2 * dot * ny;
                        s.bounces++;
                        if (s.bounces > this.iceShardMaxBounces) {
                            this.destroyIceShard(s);
                            this.iceShards.splice(i, 1);
                            destroyed = true;
                        }
                        break;
                    }
                }
            }
            if (destroyed) continue;
        }
    }

    distancePointToSegment(px, py, x1, y1, x2, y2) {
        // Distance from point (px, py) to line segment from (x1, y1) to (x2, y2)
        const dx = x2 - x1, dy = y2 - y1;
        const len2 = dx * dx + dy * dy;
        if (len2 === 0) return Math.hypot(px - x1, py - y1);
        let t = Math.max(0, Math.min(1, ((px - x1) * dx + (py - y1) * dy) / len2));
        const closestX = x1 + t * dx, closestY = y1 + t * dy;
        return Math.hypot(px - closestX, py - closestY);
    }

    spawnBounceImpact(x, y) {
        const ring = this.add.circle(x, y, 4, 0xaaddff, 0.7);
        ring.setStrokeStyle(1, 0xffffff, 0.9);
        this.tweens.add({ targets: ring, radius: 10, alpha: 0, duration: 180, ease: 'Quad.easeOut', onComplete: () => ring.destroy() });
        // A couple of tiny shards flying off
        for (let i = 0; i < 3; i++) {
            const angle = Math.random() * Math.PI * 2;
            const sp = this.add.rectangle(x, y, 3, 6, 0xccffff, 0.9);
            sp.setDepth(1);
            this.tweens.add({
                targets: sp,
                x: x + Math.cos(angle) * 12, y: y + Math.sin(angle) * 12,
                alpha: 0, duration: 200, ease: 'Quad.easeOut', onComplete: () => sp.destroy()
            });
        }
    }

    destroyIceShard(s) {
        if (s.sprite._glow) { this.tweens.killTweensOf(s.sprite._glow); s.sprite._glow.destroy(); }
        this.tweens.killTweensOf(s.sprite);
        s.sprite.destroy();
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
            
            // During ignition, leave lava trail on every new tile the fireball crosses
            if (this.ignitionActive) {
                this.spawnIgnitionTrail(fireball.sprite.x, fireball.sprite.y);
            }

            let hitEnemy = false;
            const fireballTileX = Math.floor(fireball.sprite.x / this.TILE_SIZE);
            const fireballTileY = Math.floor(fireball.sprite.y / this.TILE_SIZE);

            for (let enemy of this.enemies) {
                // Check both logical tile pos and sprite pixel pos (handles mid-tween knockback)
                const spriteTileX = Math.floor(enemy.sprite.x / this.TILE_SIZE);
                const spriteTileY = Math.floor(enemy.sprite.y / this.TILE_SIZE);
                const onTile = (enemy.x === fireballTileX && enemy.y === fireballTileY)
                            || (spriteTileX === fireballTileX && spriteTileY === fireballTileY);
                if (!onTile) continue;
                if (fireball.piercedEnemies && fireball.piercedEnemies.has(enemy)) continue;
                    const tileTopY = fireballTileY * this.TILE_SIZE;
                    const tileCenterY = tileTopY + (this.TILE_SIZE * 0.25);
                    
                    if (fireball.sprite.y >= tileCenterY) {
                        this.damageEnemy(enemy, fireball.damage);
                        this.fireballSplash(fireball.sprite.x, fireball.sprite.y, fireball.damage, enemy);
                        hitEnemy = true;
                        if (fireball.piercedEnemies) fireball.piercedEnemies.add(enemy);
                        break;
                    }
            }

            if (hitEnemy) {
                if (!this.ignitionActive) {
                    fireball.sprite.destroy();
                    this.fireballs.splice(i, 1);
                }
                continue;
            }
        }
    }

    showDamageNumber(x, y, amount, color = '#ffffff') {
        if (!amount || amount <= 0) return;
        const txt = this.add.text(
            x + (Math.random() - 0.5) * 12,
            y - 14,
            `-${amount.toFixed(1)}`,
            {
                fontSize: '13px',
                fontFamily: 'monospace',
                color,
                stroke: '#000000',
                strokeThickness: 3,
                fontStyle: 'bold'
            }
        ).setOrigin(0.5).setDepth(10);
        this.tweens.add({
            targets: txt,
            y: txt.y - 24,
            alpha: 0,
            duration: 750,
            ease: 'Quad.easeOut',
            onComplete: () => txt.destroy()
        });
    }

    damageEnemy(enemy, damage) {
        // Apply brittle damage bonus
        const brittleBonus = enemy.brittleStacks ? (1 + enemy.brittleStacks * this.brittlePerStack) : 1;
        const tsunamiBonus = this.tsunamiFrozenEnemies.includes(enemy) ? this.tsunamiFreezeMultiplier : 1;
        const actualDamage = damage * brittleBonus * tsunamiBonus;
        enemy.health -= actualDamage;

        // Gain ult charge on hit (skip for lightning to prevent chain spam)
        if (this.currentElement !== 'lightning') {
            this.gainUltCharge(this.ultChargePerHit);
        }

        // Show damage number
        if (enemy.sprite && enemy.sprite.active) {
            const color = this.currentElement === 'fire' ? '#ff8800'
                : this.currentElement === 'ice' ? '#88eeff'
                : this.currentElement === 'lightning' ? '#ffff44'
                : '#cc99ff';
            this.showDamageNumber(enemy.sprite.x, enemy.sprite.y, actualDamage, color);
        }
        
        if (this.currentElement === 'fire') {
            enemy.isBurning = true;
            enemy.burnUntil = this.time.now + this.burnDuration;
            if (!enemy.burnVisualActive) this.showBurnVisual(enemy);
        }
        
        if (this.currentElement === 'ice') {
            // Apply brittle stacks on ice hit
            this.applyBrittle(enemy, 1);
            enemy.isSlowed = true;
            enemy.slowedUntil = this.time.now + this.slowDuration;
            
            if (Math.random() < 0.15 && !enemy.isFrozen) {
                this.freezeEnemy(enemy, 2000);
            }
            
            this.updateSlowEffect(enemy);
        }
        
        if (enemy.isFrozen) {
            enemy.health -= actualDamage * 0.5;
        }
        
        const flashColor = this.currentElement === 'ice' ? 0x00ffff : 0xffffff;
        enemy.sprite.setTint(flashColor);
        this.time.delayedCall(100, () => {
            if (enemy.sprite && enemy.sprite.active) {
                if (enemy.isFrozen) {
                    enemy.sprite.setTint(0x88ccff);
                } else if (enemy.isBurning) {
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
        this.clearBurnVisual(enemy);
        
        if (enemy.freezeVisuals) {
            if (enemy.freezeVisuals.iceBlock) {
                this.tweens.killTweensOf(enemy.freezeVisuals.iceBlock);
                enemy.freezeVisuals.iceBlock.setVisible(false);
                enemy.freezeVisuals.iceBlock.destroy();
            }
            if (enemy.freezeVisuals.iceBorder) {
                this.tweens.killTweensOf(enemy.freezeVisuals.iceBorder);
                enemy.freezeVisuals.iceBorder.setVisible(false);
                enemy.freezeVisuals.iceBorder.destroy();
            }
            if (enemy.freezeVisuals.multiplierText) {
                this.tweens.killTweensOf(enemy.freezeVisuals.multiplierText);
                enemy.freezeVisuals.multiplierText.setVisible(false);
                enemy.freezeVisuals.multiplierText.destroy();
            }
            enemy.freezeVisuals = null;
        }

        if (enemy.brittleVisual) {
            enemy.brittleVisual.destroy();
            enemy.brittleVisual = null;
        }

        if (enemy._tsunamiMultText) { enemy._tsunamiMultText.destroy(); enemy._tsunamiMultText = null; }
        const tfi = this.tsunamiFrozenEnemies.indexOf(enemy);
        if (tfi > -1) this.tsunamiFrozenEnemies.splice(tfi, 1);

        // Remove from all active projectile hit sets so they can hit the tile again
        for (const fb of this.fireballs) {
            if (fb.piercedEnemies) fb.piercedEnemies.delete(enemy);
        }
        for (const s of this.iceShards) {
            if (s.hitEnemies) s.hitEnemies.delete(enemy);
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

    gainUltCharge(amount) {
        if (this.ultCharge >= this.ultChargeMax || this.ultDrainActive) return;
        const wasReady = this.ultCharge >= this.ultChargeMax;
        this.ultCharge = Math.min(this.ultChargeMax, this.ultCharge + amount);
        const nowReady = this.ultCharge >= this.ultChargeMax;
        // Flash the bar label when it first hits full
        if (!wasReady && nowReady && this.ultBarLabel) {
            this.tweens.add({ targets: this.ultBarLabel, scaleX: 1.4, scaleY: 1.4, duration: 120, yoyo: true, ease: 'Quad.easeOut' });
        }
        this.updateHUD();
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
        
        // Clear ice shards
        for (let s of this.iceShards) this.destroyIceShard(s);
        this.iceShards = [];
        
        // Switch to new element — apply charge penalty
        this.currentElement = targetElement;
        this.ultCharge = Math.max(0, this.ultCharge - this.ultChargeSwitchPenalty);
        this.updateHUD();

        const px = this.player.x - this.cameras.main.scrollX;
        const py = this.player.y - this.cameras.main.scrollY;

        if (targetElement === 'fire') {
            // Eruption: rings of fire expanding outward, embers flying up
            const screenFlash = this.add.rectangle(this.scale.width / 2, this.scale.height / 2, this.scale.width, this.scale.height, 0xff3300, 0.25).setScrollFactor(0).setDepth(20);
            this.tweens.add({ targets: screenFlash, alpha: 0, duration: 300, onComplete: () => screenFlash.destroy() });
            for (let r = 0; r < 3; r++) {
                const ring = this.add.circle(px, py, 10, 0xff6600, 0).setScrollFactor(0).setDepth(20);
                ring.setStrokeStyle(3 - r, 0xff4400, 0.9 - r * 0.2);
                this.tweens.add({ targets: ring, radius: 80 + r * 40, alpha: 0, duration: 350 + r * 80, delay: r * 60, ease: 'Quad.easeOut', onComplete: () => ring.destroy() });
            }
            for (let i = 0; i < 10; i++) {
                const angle = Math.random() * Math.PI * 2;
                const spd = 30 + Math.random() * 50;
                const ember = this.add.circle(px, py, 2 + Math.random() * 2, Math.random() < 0.5 ? 0xff6600 : 0xffaa00, 1).setScrollFactor(0).setDepth(20);
                this.tweens.add({ targets: ember, x: px + Math.cos(angle) * spd, y: py + Math.sin(angle) * spd - 20, alpha: 0, duration: 400 + Math.random() * 200, ease: 'Quad.easeOut', onComplete: () => ember.destroy() });
            }
            this.player.setTint(0xff6600);
            this.time.delayedCall(300, () => this.player.clearTint());

        } else if (targetElement === 'ice') {
            // Freeze burst: crystalline shards radiating out, screen tints blue
            const screenFlash = this.add.rectangle(this.scale.width / 2, this.scale.height / 2, this.scale.width, this.scale.height, 0x0099cc, 0.2).setScrollFactor(0).setDepth(20);
            this.tweens.add({ targets: screenFlash, alpha: 0, duration: 400, onComplete: () => screenFlash.destroy() });
            for (let i = 0; i < 12; i++) {
                const angle = (Math.PI * 2 / 12) * i;
                const len = 30 + Math.random() * 40;
                const shard = this.add.rectangle(px, py, 4, 12, 0xaaddff, 0.9).setScrollFactor(0).setDepth(20);
                shard.setRotation(angle);
                this.tweens.add({ targets: shard, x: px + Math.cos(angle) * len, y: py + Math.sin(angle) * len, alpha: 0, scaleY: 0.3, duration: 350, ease: 'Quad.easeOut', onComplete: () => shard.destroy() });
            }
            const frost = this.add.circle(px, py, 8, 0xffffff, 0.7).setScrollFactor(0).setDepth(20);
            this.tweens.add({ targets: frost, radius: 60, alpha: 0, duration: 300, ease: 'Quad.easeOut', onComplete: () => frost.destroy() });
            this.player.setTint(0x00ccff);
            this.time.delayedCall(350, () => this.player.clearTint());

        } else if (targetElement === 'lightning') {
            // Electric discharge: jagged arcs flying out, screen flash yellow
            const screenFlash = this.add.rectangle(this.scale.width / 2, this.scale.height / 2, this.scale.width, this.scale.height, 0xffff00, 0.3).setScrollFactor(0).setDepth(20);
            this.tweens.add({ targets: screenFlash, alpha: 0, duration: 150, onComplete: () => screenFlash.destroy() });
            for (let i = 0; i < 6; i++) {
                const angle = (Math.PI * 2 / 6) * i + (Math.random() - 0.5) * 0.5;
                const g = this.add.graphics().setScrollFactor(0).setDepth(20);
                g.lineStyle(2, 0xffff00, 1);
                g.beginPath(); g.moveTo(px, py);
                let cx2 = px, cy2 = py;
                for (let s = 0; s < 4; s++) {
                    cx2 += Math.cos(angle) * 15 + (Math.random() - 0.5) * 10;
                    cy2 += Math.sin(angle) * 15 + (Math.random() - 0.5) * 10;
                    g.lineTo(cx2, cy2);
                }
                g.strokePath();
                this.tweens.add({ targets: g, alpha: 0, duration: 200, onComplete: () => g.destroy() });
            }
            this.player.setTint(0xffff00);
            this.time.delayedCall(200, () => this.player.clearTint());

        } else if (targetElement === 'cosmic') {
            // Void implosion then expansion: dark circle shrinks in then explodes purple
            const screenFlash = this.add.rectangle(this.scale.width / 2, this.scale.height / 2, this.scale.width, this.scale.height, 0x220033, 0.35).setScrollFactor(0).setDepth(20);
            this.tweens.add({ targets: screenFlash, alpha: 0, duration: 500, onComplete: () => screenFlash.destroy() });
            const void1 = this.add.circle(px, py, 50, 0x110022, 0.8).setScrollFactor(0).setDepth(20);
            this.tweens.add({ targets: void1, radius: 5, duration: 200, ease: 'Quad.easeIn', onComplete: () => {
                this.tweens.add({ targets: void1, radius: 120, alpha: 0, duration: 300, ease: 'Quad.easeOut', onComplete: () => void1.destroy() });
                for (let i = 0; i < 8; i++) {
                    const angle = (Math.PI * 2 / 8) * i;
                    const orb = this.add.circle(px, py, 4, 0xcc88ff, 1).setScrollFactor(0).setDepth(20);
                    this.tweens.add({ targets: orb, x: px + Math.cos(angle) * 70, y: py + Math.sin(angle) * 70, alpha: 0, duration: 350, ease: 'Quad.easeOut', onComplete: () => orb.destroy() });
                }
            }});
            this.player.setTint(0x9966ff);
            this.time.delayedCall(400, () => this.player.clearTint());
        }
        
        this.lastElementSwitchTime = currentTime;
        this.updateHUD();
        
        console.log(`Switched to ${this.currentElement}`);
    }

    updateBurnEffects(time) {
        for (let enemy of this.enemies) {
            if (!enemy.isBurning) continue;

            // Expire
            if (time >= enemy.burnUntil) {
                enemy.isBurning = false;
                this.clearBurnVisual(enemy);
                if (enemy.sprite && enemy.sprite.active && !enemy.isFrozen) {
                    enemy.sprite.clearTint();
                }
                continue;
            }

            // Tick damage
            if (time - enemy.lastBurnTick >= this.burnTickInterval) {
                enemy.lastBurnTick = time;
                const tickDmg = this.burnTickDamage * this.damageScaling;
                enemy.health -= tickDmg;
                this.gainUltCharge(this.ultChargePerBurnTick);

                // Floating damage number
                if (enemy.sprite && enemy.sprite.active) {
                    this.showDamageNumber(enemy.sprite.x, enemy.sprite.y, tickDmg, '#ff8800');
                }

                // Flicker tint
                if (enemy.sprite && enemy.sprite.active) {
                    enemy.sprite.setTint(0xffffff);
                    this.time.delayedCall(80, () => {
                        if (enemy.sprite && enemy.sprite.active && enemy.isBurning) {
                            enemy.sprite.setTint(0xff6600);
                        }
                    });
                }

                this.updateEnemyHealthBar(enemy);
                if (enemy.health <= 0) { this.killEnemy(enemy); continue; }
            }

            // Keep flame visual synced to enemy position
            if (enemy.burnVisual && enemy.sprite) {
                enemy.burnVisual.x = enemy.sprite.x;
                enemy.burnVisual.y = enemy.sprite.y - 18;
            }
        }
    }

    showBurnVisual(enemy) {
        this.clearBurnVisual(enemy);

        const x = enemy.sprite.x;
        const y = enemy.sprite.y - 18;

        // Draw a flame: layered circles tapering upward
        const g = this.add.graphics();
        g.fillStyle(0xff2200, 0.9);
        g.fillEllipse(0, 0, 10, 14);   // outer flame body
        g.fillStyle(0xff7700, 1);
        g.fillEllipse(0, -3, 7, 10);   // mid flame
        g.fillStyle(0xffdd00, 1);
        g.fillEllipse(0, -5, 4, 6);    // bright core tip
        g.x = x;
        g.y = y;

        this.tweens.add({
            targets: g,
            scaleX: 1.25, scaleY: 1.2,
            y: y - 3,
            duration: 180,
            yoyo: true, repeat: -1,
            ease: 'Sine.easeInOut'
        });

        enemy.burnVisual = g;
        enemy.burnVisualActive = true;
        enemy.sprite.setTint(0xff6600);
    }

    clearBurnVisual(enemy) {
        if (enemy.burnVisual) {
            this.tweens.killTweensOf(enemy.burnVisual);
            enemy.burnVisual.destroy();
            enemy.burnVisual = null;
        }
        enemy.burnVisualActive = false;
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
            this.drawLightningBolt({ sprite: this.player }, targetEnemy);
            const falloff = this.stormCloudActive ? this.lightningUltChainFalloff : this.lightningChainFalloff;
            const hitEnemies = [];
            this.performChainLightning(targetEnemy, this.baseLightningDamage * this.damageScaling, hitEnemies, falloff);
            // Flat charge per click regardless of chain length
            this.gainUltCharge(this.ultChargePerChain);
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
        // Cosmic uses its own battery charge system
        if (this.currentElement === 'cosmic') {
            if (this.cosmicBatteryCharges < 10) {
                console.log(`Cosmic ult needs 10 charges: ${this.cosmicBatteryCharges}/10`);
                return;
            }
            this.cosmicBatteryCharges -= 5;
            this.updateHUD();
            this.activateCosmicBlackHole();
            return;
        }

        if (this.ultCharge < this.ultChargeMax) {
            console.log(`Ult not ready: ${Math.floor(this.ultCharge)}%`);
            return;
        }

        this.ultCharge = 0;
        this.updateHUD();
        
        if (this.currentElement === 'fire') {
            this.activateFireScorch();
        } else if (this.currentElement === 'ice') {
            this.activateIceBlizzard();
        } else if (this.currentElement === 'lightning') {
            this.activateLightningStorm();
        } else if (this.currentElement === 'cosmic') {
            this.activateCosmicBlackHole();
        }
    }

    activateFireScorch() {
        console.log('IGNITION ACTIVATED!');
        this.ultDrainActive = true;
        this.ultDrainStartTime = this.time.now;
        this.ultDrainDuration = this.ignitionDuration;

        this.ignitionActive = true;
        this.ignitionEndTime = this.time.now + this.ignitionDuration;

        // Trigger combustion burst on ALL burning enemies immediately
        // and lay lava tiles under all enemies in range
        let burstCount = 0;
        for (let enemy of [...this.enemies]) {
            if (enemy.isBurning) {
                this.spawnIgnitionTrail(enemy.sprite.x, enemy.sprite.y);
                this.triggerCombustion(enemy, true);
                burstCount++;
            }
        }

        // Dramatic screen flash — deep orange/red
        const screenFlash = this.add.rectangle(
            this.scale.width / 2, this.scale.height / 2,
            this.scale.width, this.scale.height,
            0xff3300, 0.55
        ).setScrollFactor(0);
        this.tweens.add({ targets: screenFlash, alpha: 0, duration: 350, onComplete: () => screenFlash.destroy() });

        this.player.setTint(0xff6600);

        // Pulsing fire aura around player for duration
        const aura = this.add.circle(this.player.x, this.player.y, 40, 0xff4400, 0.35);
        this.tweens.add({ targets: aura, scaleX: 1.5, scaleY: 1.5, alpha: 0.15, duration: 400, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
        this._ignitionAura = aura;

        this.time.delayedCall(this.ignitionDuration, () => {
            this.ignitionActive = false;
            this.ultDrainActive = false;
            this.player.clearTint();
            if (this._ignitionAura) { this._ignitionAura.destroy(); this._ignitionAura = null; }
        });

        console.log(`Ignition burst ${burstCount} burning enemies!`);
    }

    activateIceBlizzard() {
        console.log('TSUNAMI ACTIVATED!');
        this.ultDrainActive = true;
        this.ultDrainStartTime = this.time.now;
        this.ultDrainDuration = this.tsunamiWaveDuration + 600 + 900 + this.tsunamiFreezeDuration;

        this.tsunamiActive = true;
        this.tsunamiTiles = [];
        this.tsunamiFrozenEnemies = [];

        const originX = this.playerX;
        const originY = this.playerY;
        const maxR = this.tsunamiMaxRadius;
        const waveDur = this.tsunamiWaveDuration; // outward phase duration
        const pauseDur = 600;                      // how long water sits before retracting
        const retractDur = 900;                    // retract phase duration

        // Screen flash — deep blue
        const screenFlash = this.add.rectangle(this.scale.width / 2, this.scale.height / 2, this.scale.width, this.scale.height, 0x003366, 0.5).setScrollFactor(0).setDepth(20);
        this.tweens.add({ targets: screenFlash, alpha: 0, duration: 400, onComplete: () => screenFlash.destroy() });

        const tilesHit = new Set();
        const wetEnemies = new Set(); // enemies touched by water

        // ── OUTWARD WAVE ──────────────────────────────────────────────
        // t^2.5 easing: extremely fast at start, crawls to a halt at edge
        for (let r = 1; r <= maxR; r++) {
            const t = r / maxR;
            const delay = waveDur * Math.pow(t, 2.5);

            this.time.delayedCall(delay, () => {
                if (!this.tsunamiActive) return;

                for (let dx = -r; dx <= r; dx++) {
                    for (let dy = -r; dy <= r; dy++) {
                        const dist = Math.sqrt(dx * dx + dy * dy);
                        if (dist < r - 0.8 || dist > r + 0.1) continue;
                        const tx = originX + dx;
                        const ty = originY + dy;
                        const key = `${tx},${ty}`;
                        if (tilesHit.has(key)) continue;
                        if (tx < 0 || tx >= this.WORLD_WIDTH || ty < 0 || ty >= this.WORLD_HEIGHT) continue;
                        if (this.world[tx][ty] !== this.FLOOR) continue;
                        tilesHit.add(key);

                        const px2 = tx * this.TILE_SIZE + this.TILE_SIZE / 2;
                        const py2 = ty * this.TILE_SIZE + this.TILE_SIZE / 2;

                        const waterTile = this.add.rectangle(px2, py2, this.TILE_SIZE, this.TILE_SIZE, 0x0066cc, 0.55).setDepth(0.5);
                        const waterShimmer = this.add.rectangle(px2, py2, this.TILE_SIZE - 4, this.TILE_SIZE - 4, 0x44aaff, 0.3).setDepth(0.5);
                        this.tweens.add({ targets: waterShimmer, alpha: 0.6, duration: 150 + Math.random() * 100, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });

                        this.tsunamiTiles.push({ waterTile, waterShimmer, tileX: tx, tileY: ty, r });
                    }
                }

                // Mark any enemies in this ring as wet
                for (let enemy of this.enemies) {
                    if (wetEnemies.has(enemy)) continue;
                    const edx = enemy.x - originX;
                    const edy = enemy.y - originY;
                    const eDist = Math.sqrt(edx * edx + edy * edy);
                    if (eDist <= r + 0.5) {
                        wetEnemies.add(enemy);
                        // Tint enemy blue to show they're wet
                        if (enemy.sprite && enemy.sprite.active) {
                            enemy.sprite.setTint(0x4499ff);
                        }
                    }
                }
            });
        }

        // ── PAUSE ─────────────────────────────────────────────────────
        this.time.delayedCall(waveDur + pauseDur, () => {
            if (!this.tsunamiActive) return;

            // Darken water tiles slightly to signal retract incoming
            for (const t of this.tsunamiTiles) {
                this.tweens.killTweensOf(t.waterShimmer);
                this.tweens.add({ targets: [t.waterTile, t.waterShimmer], alpha: 0.7, duration: 200 });
            }
        });

        // ── RETRACT WAVE ──────────────────────────────────────────────
        // Rings disappear outside-in. Use fast ease (t^0.4 = starts fast)
        for (let r = maxR; r >= 1; r--) {
            const t = (maxR - r) / maxR; // 0 at edge, 1 at center
            const delay = waveDur + pauseDur + retractDur * Math.pow(t, 0.4);

            this.time.delayedCall(delay, () => {
                if (!this.tsunamiActive) return;

                // Remove water tiles at this radius
                for (let i = this.tsunamiTiles.length - 1; i >= 0; i--) {
                    const t2 = this.tsunamiTiles[i];
                    if (t2.r !== r) continue;
                    this.tweens.killTweensOf(t2.waterShimmer);
                    this.tweens.add({
                        targets: [t2.waterTile, t2.waterShimmer],
                        alpha: 0, duration: 120,
                        onComplete: () => { t2.waterTile.destroy(); t2.waterShimmer.destroy(); }
                    });
                    this.tsunamiTiles.splice(i, 1);
                }

                // Pull wet enemies at this radius one tile toward origin
                for (let enemy of wetEnemies) {
                    const edx = enemy.x - originX;
                    const edy = enemy.y - originY;
                    const eDist = Math.sqrt(edx * edx + edy * edy);
                    if (Math.abs(eDist - r) > 1.0) continue;

                    const pullDirX = edx === 0 && edy === 0 ? 0 : -Math.round(edx / Math.max(Math.abs(edx), Math.abs(edy)));
                    const pullDirY = edx === 0 && edy === 0 ? 0 : -Math.round(edy / Math.max(Math.abs(edx), Math.abs(edy)));
                    const newEx = enemy.x + pullDirX;
                    const newEy = enemy.y + pullDirY;

                    if (newEx >= 0 && newEx < this.WORLD_WIDTH && newEy >= 0 && newEy < this.WORLD_HEIGHT
                        && this.world[newEx][newEy] === this.FLOOR && !this.getEnemyAt(newEx, newEy)) {
                        enemy.x = newEx;
                        enemy.y = newEy;
                        this.tweens.add({
                            targets: enemy.sprite,
                            x: newEx * this.TILE_SIZE + this.TILE_SIZE / 2,
                            y: newEy * this.TILE_SIZE + this.TILE_SIZE / 2 + this.SLIME_Y_OFFSET,
                            duration: 140,
                            ease: 'Quad.easeIn',
                            onUpdate: () => {
                                if (enemy.healthBarBg) { enemy.healthBarBg.x = enemy.sprite.x; enemy.healthBarBg.y = enemy.sprite.y; }
                                if (enemy.healthBarFill) { enemy.healthBarFill.x = enemy.sprite.x; enemy.healthBarFill.y = enemy.sprite.y; }
                                if (enemy.burnVisual) { enemy.burnVisual.x = enemy.sprite.x; enemy.burnVisual.y = enemy.sprite.y - 18; }
                                if (enemy.brittleVisual) { enemy.brittleVisual.x = enemy.sprite.x; enemy.brittleVisual.y = enemy.sprite.y + 14; }
                                if (enemy._tsunamiMultText) { enemy._tsunamiMultText.x = enemy.sprite.x; enemy._tsunamiMultText.y = enemy.sprite.y - 28; }
                            }
                        });
                    }
                }
            });
        }

        // ── FLASH FREEZE ──────────────────────────────────────────────
        // Fires when retract fully reaches center
        this.time.delayedCall(waveDur + pauseDur + retractDur + 100, () => {
            if (!this.tsunamiActive) return;

            // Screen flash white
            const freezeFlash = this.add.rectangle(this.scale.width / 2, this.scale.height / 2, this.scale.width, this.scale.height, 0xffffff, 0.65).setScrollFactor(0).setDepth(20);
            this.tweens.add({ targets: freezeFlash, alpha: 0, duration: 350, onComplete: () => freezeFlash.destroy() });

            // Freeze all wet enemies
            for (let enemy of wetEnemies) {
                if (!enemy.sprite || !enemy.sprite.active) continue;

                this.freezeEnemy(enemy, this.tsunamiFreezeDuration);
                this.applyBrittle(enemy, 2);
                this.tsunamiFrozenEnemies.push(enemy);
                this.spawnIceSplinter(enemy.sprite.x, enemy.sprite.y);
                enemy.sprite.clearTint(); // clear wet tint, freeze visual takes over

                const multTxt = this.add.text(enemy.sprite.x, enemy.sprite.y - 28, `${this.tsunamiFreezeMultiplier}x DMG`, {
                    fontSize: '12px', fontFamily: 'monospace', color: '#88eeff',
                    stroke: '#000000', strokeThickness: 3, fontStyle: 'bold'
                }).setOrigin(0.5).setDepth(10);
                enemy._tsunamiMultText = multTxt;
            }

            // Clean up any remaining water tiles
            for (const t of this.tsunamiTiles) {
                this.tweens.killTweensOf(t.waterShimmer);
                t.waterTile.destroy(); t.waterShimmer.destroy();
            }
            this.tsunamiTiles = [];

            this.time.delayedCall(this.tsunamiFreezeDuration, () => {
                this.deactivateTsunami();
            });
        });
    }

    activateLightningStorm() {
        console.log('THUNDERHEAD ACTIVATED!');
        this.ultDrainActive = true;
        this.ultDrainStartTime = this.time.now;
        this.ultDrainDuration = this.thunderheadDuration;

        this.thunderheadActive = true;
        this.thunderheadEndTime = this.time.now + this.thunderheadDuration;
        this.thunderheadGlideX = this.player.x;
        this.thunderheadGlideY = this.player.y - this.SLIME_Y_OFFSET; // pixel center

        // Visual: player becomes a crackling storm cloud
        this.player.setTint(0xccffff);
        this.player.setAlpha(0.6);

        // Big electric aura
        const aura = this.add.circle(this.player.x, this.player.y, 35, 0xffff88, 0.25);
        aura.setStrokeStyle(4, 0xffff00, 0.7);
        this._thunderheadAura = aura;

        // Outer crackling ring
        const outerRing = this.add.circle(this.player.x, this.player.y, 50, 0xffffff, 0);
        outerRing.setStrokeStyle(2, 0xaaffff, 0.4);
        this._thunderheadOuterRing = outerRing;

        this.tweens.add({
            targets: aura,
            scaleX: 1.4, scaleY: 1.4, alpha: 0.1,
            duration: 300, yoyo: true, repeat: -1, ease: 'Sine.easeInOut'
        });
        this.tweens.add({
            targets: outerRing,
            scaleX: 1.6, scaleY: 1.6, alpha: 0.6,
            duration: 250, yoyo: true, repeat: -1, ease: 'Sine.easeInOut', delay: 80
        });

        // Screen flash yellow
        const screenFlash = this.add.rectangle(
            this.scale.width / 2, this.scale.height / 2,
            this.scale.width, this.scale.height,
            0xffff00, 0.4
        ).setScrollFactor(0);
        this.tweens.add({ targets: screenFlash, alpha: 0, duration: 200, onComplete: () => screenFlash.destroy() });

        // HUD notification
        const notice = this.add.text(this.scale.width / 2, 80, '⚡ THUNDERHEAD ⚡', {
            fontSize: '22px', fontFamily: 'monospace', color: '#ffff00',
            stroke: '#000000', strokeThickness: 4, fontStyle: 'bold'
        }).setOrigin(0.5).setScrollFactor(0);
        this.tweens.add({
            targets: notice, y: 55, alpha: 0, duration: 2000,
            onComplete: () => notice.destroy()
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

        // Use the cloud's actual position (thrown location or player position)
        const cloudTileX = this.stormCloud.thrown
            ? Math.floor(this.stormCloud.thrownX / this.TILE_SIZE)
            : this.playerX;
        const cloudTileY = this.stormCloud.thrown
            ? Math.floor(this.stormCloud.thrownY / this.TILE_SIZE)
            : this.playerY;
        
        for (let enemy of this.enemies) {
            const dist = Math.abs(enemy.x - cloudTileX) + Math.abs(enemy.y - cloudTileY);
            if (dist <= maxRange) {
                nearbyEnemies.push({ enemy, dist });
            }
        }
        
        if (nearbyEnemies.length === 0) return;

        // Track all enemies hit this tick so chains don't double-hit
        const globalHitEnemies = [];

        for (let { enemy } of nearbyEnemies) {
            // Skip if already hit by a chain this tick
            if (globalHitEnemies.includes(enemy)) continue;

            this.drawLightningBolt(
                { sprite: this.stormCloud.body },
                enemy
            );

            this.performChainLightningShared(enemy, this.baseLightningDamage * this.damageScaling * 0.8, globalHitEnemies, this.lightningUltChainFalloff);
        }
    }

    // Like performChainLightning but shares a hit-list across the whole tick
    performChainLightningShared(sourceEnemy, damage, globalHitEnemies, falloff) {
        globalHitEnemies.push(sourceEnemy);

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
            if (globalHitEnemies.includes(enemy)) continue;

            const dist = Math.abs(enemy.x - sourceEnemy.x) + Math.abs(enemy.y - sourceEnemy.y);

            if (dist <= this.lightningChainRange && dist < nearestDist) {
                nearestEnemy = enemy;
                nearestDist = dist;
            }
        }

        if (nearestEnemy) {
            this.drawLightningBolt(sourceEnemy, nearestEnemy);
            this.performChainLightningShared(nearestEnemy, damage * falloff, globalHitEnemies, falloff);
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

    deactivateTsunami() {
        this.tsunamiActive = false;
        this.ultDrainActive = false;

        for (let enemy of this.tsunamiFrozenEnemies) {
            if (enemy._tsunamiMultText) {
                enemy._tsunamiMultText.destroy();
                enemy._tsunamiMultText = null;
            }
        }
        this.tsunamiFrozenEnemies = [];

        // Fade out any remaining water tiles (e.g. if cancelled early)
        for (const t of this.tsunamiTiles) {
            this.tweens.killTweensOf(t.waterShimmer);
            this.tweens.add({
                targets: [t.waterTile, t.waterShimmer],
                alpha: 0, duration: 400,
                onComplete: () => { t.waterTile.destroy(); t.waterShimmer.destroy(); }
            });
        }
        this.tsunamiTiles = [];

        // Clear wet tint from any enemies that weren't frozen
        for (let enemy of this.enemies) {
            if (enemy.sprite && enemy.sprite.active && !enemy.isFrozen) {
                enemy.sprite.clearTint();
            }
        }
    }

    updateTsunami(time) {
        // Keep multiplier text pinned above frozen enemies
        for (let enemy of this.tsunamiFrozenEnemies) {
            if (enemy._tsunamiMultText && enemy.sprite && enemy.sprite.active) {
                enemy._tsunamiMultText.x = enemy.sprite.x;
                enemy._tsunamiMultText.y = enemy.sprite.y - 28;
            }
        }
    }

    // ─── FIRE HELPERS ──────────────────────────────────────────────────

    fireballSplash(pixelX, pixelY, directDamage, directEnemy) {
        const splashDamage = directDamage * this.fireballSplashDamageRatio;
        const splashTileX = Math.floor(pixelX / this.TILE_SIZE);
        const splashTileY = Math.floor(pixelY / this.TILE_SIZE);

        for (let enemy of this.enemies) {
            if (enemy === directEnemy) continue;
            const dist = Math.abs(enemy.x - splashTileX) + Math.abs(enemy.y - splashTileY);
            if (dist <= this.fireballSplashRadius) {
                enemy.health -= splashDamage;
                enemy.isBurning = true;
                enemy.burnUntil = this.time.now + this.burnDuration;
                if (!enemy.burnVisualActive) this.showBurnVisual(enemy);
                this.updateEnemyHealthBar(enemy);
                if (enemy.health <= 0) this.killEnemy(enemy);
            }
        }

        // Splash visual ring
        const ring = this.add.circle(pixelX, pixelY, 4, 0xff6600, 0.6);
        ring.setStrokeStyle(2, 0xffaa00, 0.8);
        this.tweens.add({
            targets: ring,
            radius: this.fireballSplashRadius * this.TILE_SIZE,
            alpha: 0,
            duration: 250,
            ease: 'Quad.easeOut',
            onComplete: () => ring.destroy()
        });
    }

    triggerCombustion(enemy, isUlt) {
        if (!enemy.sprite || !enemy.sprite.active) return;
        enemy.combustionTriggered = true;

        // Burst damage: flat amount scaled by ult bonus
        const burstDamage = (isUlt ? 30 : 15) * this.damageScaling;
        enemy.health -= burstDamage;
        enemy.isBurning = false;
        enemy.burnUntil = 0;
        this.clearBurnVisual(enemy);
        if (enemy.sprite && enemy.sprite.active) enemy.sprite.clearTint();

        const cx = enemy.sprite.x;
        const cy = enemy.sprite.y;

        // Central explosion core
        const core = this.add.circle(cx, cy, 6, 0xffffff, 1);
        const mid = this.add.circle(cx, cy, 12, 0xff6600, 0.85);
        const outer = this.add.circle(cx, cy, 18, 0xff2200, 0.55);
        const glow = this.add.circle(cx, cy, 30, 0xffaa00, 0.3);

        this.tweens.add({ targets: core,  radius: 24, alpha: 0, duration: 300, ease: 'Quad.easeOut', onComplete: () => core.destroy() });
        this.tweens.add({ targets: mid,   radius: 40, alpha: 0, duration: 400, ease: 'Quad.easeOut', onComplete: () => mid.destroy() });
        this.tweens.add({ targets: outer, radius: 55, alpha: 0, duration: 500, ease: 'Quad.easeOut', onComplete: () => outer.destroy() });
        this.tweens.add({ targets: glow,  radius: 70, alpha: 0, duration: 600, ease: 'Quad.easeOut', onComplete: () => glow.destroy() });

        // Ember particles
        for (let i = 0; i < 10; i++) {
            const angle = Math.random() * Math.PI * 2;
            const spd = 40 + Math.random() * 60;
            const ember = this.add.circle(cx, cy, 2 + Math.random() * 2, 0xff6600, 1);
            this.tweens.add({
                targets: ember,
                x: cx + Math.cos(angle) * spd,
                y: cy + Math.sin(angle) * spd,
                alpha: 0, duration: 400 + Math.random() * 200,
                ease: 'Quad.easeOut', onComplete: () => ember.destroy()
            });
        }

        // Damage number pop
        const txt = this.add.text(cx, cy - 20, `COMBUSTION!\n${burstDamage.toFixed(0)}`, {
            fontSize: '13px', fontFamily: 'monospace', color: '#ffaa00',
            stroke: '#000', strokeThickness: 3, fontStyle: 'bold', align: 'center'
        }).setOrigin(0.5);
        this.tweens.add({ targets: txt, y: cy - 50, alpha: 0, duration: 900, ease: 'Quad.easeOut', onComplete: () => txt.destroy() });

        this.updateEnemyHealthBar(enemy);
        if (enemy.health <= 0) this.killEnemy(enemy);
        else { enemy.combustionTriggered = false; }
    }

    spawnIgnitionTrail(x, y) {
        const tileX = Math.floor(x / this.TILE_SIZE);
        const tileY = Math.floor(y / this.TILE_SIZE);
        const tilePixelX = tileX * this.TILE_SIZE + this.TILE_SIZE / 2;
        const tilePixelY = tileY * this.TILE_SIZE + this.TILE_SIZE / 2;

        // Avoid duplicate trail on same tile
        if (this.ignitionPierceTrails.some(t => t.tileX === tileX && t.tileY === tileY)) return;

        // Lava tile: base orange rectangle covering the tile, with a shimmering inner glow
        const base = this.add.rectangle(tilePixelX, tilePixelY, this.TILE_SIZE, this.TILE_SIZE, 0xcc2200, 0.85).setDepth(0.5);
        const glow = this.add.rectangle(tilePixelX, tilePixelY, this.TILE_SIZE - 4, this.TILE_SIZE - 4, 0xff6600, 0.6).setDepth(0.5);
        const core = this.add.rectangle(tilePixelX, tilePixelY, this.TILE_SIZE - 10, this.TILE_SIZE - 10, 0xffaa00, 0.4).setDepth(0.5);

        // Shimmer animation on the inner layers
        this.tweens.add({ targets: glow, alpha: 0.9, duration: 180, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
        this.tweens.add({ targets: core, alpha: 0.7, scaleX: 0.85, scaleY: 0.85, duration: 130, yoyo: true, repeat: -1, ease: 'Sine.easeInOut', delay: 60 });

        this.ignitionPierceTrails.push({
            visuals: [base, glow, core],
            createdAt: this.time.now,
            lastDamageTick: 0,
            tileX, tileY, x: tilePixelX, y: tilePixelY
        });
    }

    updateIgnitionTrails(time) {
        for (let i = this.ignitionPierceTrails.length - 1; i >= 0; i--) {
            const t = this.ignitionPierceTrails[i];
            const age = time - t.createdAt;

            if (age > this.ignitionTrailDuration) {
                for (const v of t.visuals) { this.tweens.killTweensOf(v); v.destroy(); }
                this.ignitionPierceTrails.splice(i, 1);
                continue;
            }

            // Fade out in the last 400ms
            if (age > this.ignitionTrailDuration - 400) {
                const fadeAlpha = 1 - (age - (this.ignitionTrailDuration - 400)) / 400;
                for (const v of t.visuals) v.setAlpha(v.alpha * fadeAlpha);
            }

            // Small flat damage tick every 500ms — just a light burn, not stack-based
            if (time - t.lastDamageTick >= 500) {
                t.lastDamageTick = time;
                for (let enemy of this.enemies) {
                    if (enemy.x === t.tileX && enemy.y === t.tileY) {
                        enemy.health -= 0.8 * this.damageScaling;
                        enemy.isBurning = true;
                        enemy.burnUntil = Math.max(enemy.burnUntil, time + this.burnDuration);
                        this.updateEnemyHealthBar(enemy);
                        if (enemy.health <= 0) this.killEnemy(enemy);
                    }
                }
            }
        }
    }

    // ─── ICE HELPERS ──────────────────────────────────────────────────

    applyBrittle(enemy, stacks) {
        enemy.brittleStacks = Math.min(this.brittleMaxStacks, (enemy.brittleStacks || 0) + stacks);
        enemy.lastBrittleHitTime = this.time.now;
        this.updateBrittleVisual(enemy);
    }

    updateBrittleVisual(enemy) {
        if (enemy.brittleVisual) { enemy.brittleVisual.destroy(); enemy.brittleVisual = null; }
        if (!enemy.brittleStacks || enemy.brittleStacks === 0) return;

        const pct = enemy.brittleStacks / this.brittleMaxStacks;
        const alpha = 0.3 + pct * 0.5;
        const bv = this.add.text(enemy.sprite.x, enemy.sprite.y + 14, '❄'.repeat(enemy.brittleStacks), {
            fontSize: '8px', color: '#88ddff', stroke: '#000', strokeThickness: 2
        }).setOrigin(0.5);
        bv.setAlpha(alpha);
        enemy.brittleVisual = bv;
    }

    updateBrittleDecay(time) {
        for (let enemy of this.enemies) {
            if (!enemy.brittleStacks || enemy.brittleStacks === 0) continue;
            if (time - enemy.lastBrittleHitTime > this.brittleDecayTime) {
                enemy.brittleStacks = 0;
                this.updateBrittleVisual(enemy);
            }
            // Keep visual in sync with enemy position
            if (enemy.brittleVisual) {
                enemy.brittleVisual.x = enemy.sprite.x;
                enemy.brittleVisual.y = enemy.sprite.y + 14;
            }
        }
    }

    freezeEnemy(enemy, duration) {
        // Clear existing freeze visuals if already frozen
        if (enemy.isFrozen && enemy.freezeVisuals) {
            if (enemy.freezeVisuals.iceBlock) {
                this.tweens.killTweensOf(enemy.freezeVisuals.iceBlock);
                enemy.freezeVisuals.iceBlock.setVisible(false);
                enemy.freezeVisuals.iceBlock.destroy();
            }
            if (enemy.freezeVisuals.iceBorder) {
                this.tweens.killTweensOf(enemy.freezeVisuals.iceBorder);
                enemy.freezeVisuals.iceBorder.setVisible(false);
                enemy.freezeVisuals.iceBorder.destroy();
            }
            if (enemy.freezeVisuals.multiplierText) {
                this.tweens.killTweensOf(enemy.freezeVisuals.multiplierText);
                enemy.freezeVisuals.multiplierText.setVisible(false);
                enemy.freezeVisuals.multiplierText.destroy();
            }
            enemy.freezeVisuals = null;
        }
        enemy.isFrozen = true;
        enemy.frozenUntil = this.time.now + duration;
        this.createFreezeVisual(enemy);
    }

    updateSlowEffect(enemy) {
        // Visual handled by tint; nothing extra needed
    }

    spawnIceSplinter(x, y) {
        const numShards = 6;
        for (let i = 0; i < numShards; i++) {
            const angle = (Math.PI * 2 / numShards) * i + Math.random() * 0.5;
            const dist = 15 + Math.random() * 20;
            const shard = this.add.rectangle(x, y, 4, 10, 0xaaddff, 0.9);
            shard.setRotation(angle);
            this.tweens.add({
                targets: shard,
                x: x + Math.cos(angle) * dist,
                y: y + Math.sin(angle) * dist,
                alpha: 0, scaleX: 0.5, scaleY: 0.5,
                duration: 350 + Math.random() * 150, ease: 'Quad.easeOut',
                onComplete: () => shard.destroy()
            });
        }
        // Freeze flash
        const flash = this.add.circle(x, y, 14, 0xffffff, 0.8);
        this.tweens.add({ targets: flash, radius: 22, alpha: 0, duration: 200, onComplete: () => flash.destroy() });
    }

    // ─── LIGHTNING THUNDERHEAD ─────────────────────────────────────────

    updateThunderhead(time, delta) {
        if (!this.thunderheadActive) return;

        if (time >= this.thunderheadEndTime) {
            this.deactivateThunderhead();
            return;
        }

        // Update aura to follow player
        if (this._thunderheadAura) {
            this._thunderheadAura.x = this.player.x;
            this._thunderheadAura.y = this.player.y;
        }
        if (this._thunderheadOuterRing) {
            this._thunderheadOuterRing.x = this.player.x;
            this._thunderheadOuterRing.y = this.player.y;
        }

        // Spawn crackling trail
        if (time - this.thunderheadLastTrail >= this.thunderheadTrailInterval) {
            this.thunderheadLastTrail = time;
            this.spawnThunderheadTrail(this.player.x, this.player.y, time);
        }

        // Zap nearby enemies from current position (reduced falloff)
        if (time - this.stormCloudLastAttack >= this.stormCloudAutoAttackInterval) {
            this.stormCloudLastAttack = time;
            this.thunderheadZap(time);
        }

        // HUD timer
        const remaining = ((this.thunderheadEndTime - time) / 1000).toFixed(1);
        if (!this._thunderheadTimerText) {
            this._thunderheadTimerText = this.add.text(this.scale.width / 2, 100, '', {
                fontSize: '18px', fontFamily: 'monospace', color: '#ffff88',
                stroke: '#000000', strokeThickness: 3
            }).setOrigin(0.5).setScrollFactor(0);
        }
        this._thunderheadTimerText.setText(`⚡ THUNDERHEAD ${remaining}s`);
    }

    spawnThunderheadTrail(x, y, time) {
        // Bright crackling node
        const node = this.add.circle(x, y, 8, 0xffff00, 0.7);
        node.setStrokeStyle(2, 0xffffff, 0.9);
        const inner = this.add.circle(x, y, 4, 0xffffff, 1);

        this.tweens.add({
            targets: [node, inner],
            radius: { from: node.radius, to: 2 },
            alpha: 0,
            duration: 600,
            ease: 'Quad.easeIn',
            onComplete: () => { node.destroy(); inner.destroy(); }
        });

        // Small arcs radiating out
        for (let i = 0; i < 3; i++) {
            const angle = Math.random() * Math.PI * 2;
            const len = 10 + Math.random() * 15;
            const g = this.add.graphics();
            g.lineStyle(1.5, 0xffff00, 0.8);
            g.beginPath();
            g.moveTo(x, y);
            g.lineTo(x + Math.cos(angle) * len, y + Math.sin(angle) * len);
            g.strokePath();
            this.tweens.add({ targets: g, alpha: 0, duration: 150, onComplete: () => g.destroy() });
        }
    }

    thunderheadZap(time) {
        const maxRange = 12;
        const playerTileX = this.playerX;
        const playerTileY = this.playerY;

        const nearby = this.enemies.filter(e => {
            const d = Math.abs(e.x - playerTileX) + Math.abs(e.y - playerTileY);
            return d <= maxRange;
        });

        if (nearby.length === 0) return;

        const globalHit = [];
        for (let enemy of nearby) {
            if (globalHit.includes(enemy)) continue;
            this.drawLightningBolt({ sprite: this.player }, enemy);
            this.performChainLightningShared(
                enemy,
                this.baseLightningDamage * this.damageScaling * 1.2,
                globalHit,
                this.thunderheadChainFalloff  // better falloff than normal
            );
        }
    }

    deactivateThunderhead() {
        this.thunderheadActive = false;
        this.ultDrainActive = false;
        this.player.setAlpha(1);
        this.player.clearTint();

        if (this._thunderheadAura) { this.tweens.killTweensOf(this._thunderheadAura); this._thunderheadAura.destroy(); this._thunderheadAura = null; }
        if (this._thunderheadOuterRing) { this.tweens.killTweensOf(this._thunderheadOuterRing); this._thunderheadOuterRing.destroy(); this._thunderheadOuterRing = null; }
        if (this._thunderheadTimerText) { this._thunderheadTimerText.destroy(); this._thunderheadTimerText = null; }

        // Snap to nearest valid floor tile from current glide position
        const snap = this.snapToNearestFloor(this.thunderheadGlideX, this.thunderheadGlideY);
        if (snap) {
            this.playerX = snap.tx;
            this.playerY = snap.ty;
            this.player.x = snap.px;
            this.player.y = snap.py + this.SLIME_Y_OFFSET;
        } else {
            this.player.x = this.playerX * this.TILE_SIZE + this.TILE_SIZE / 2;
            this.player.y = this.playerY * this.TILE_SIZE + this.TILE_SIZE / 2 + this.SLIME_Y_OFFSET;
        }

        console.log('Thunderhead ended');
    }

    snapToNearestFloor(pixelX, pixelY) {
        const originTX = Math.floor(pixelX / this.TILE_SIZE);
        const originTY = Math.floor(pixelY / this.TILE_SIZE);

        // Already on a floor tile
        if (originTX >= 0 && originTX < this.WORLD_WIDTH &&
            originTY >= 0 && originTY < this.WORLD_HEIGHT &&
            this.world[originTX][originTY] === this.FLOOR) {
            return {
                tx: originTX, ty: originTY,
                px: originTX * this.TILE_SIZE + this.TILE_SIZE / 2,
                py: originTY * this.TILE_SIZE + this.TILE_SIZE / 2
            };
        }

        // Search outward in rings
        for (let r = 1; r <= 5; r++) {
            for (let dx = -r; dx <= r; dx++) {
                for (let dy = -r; dy <= r; dy++) {
                    if (Math.abs(dx) !== r && Math.abs(dy) !== r) continue; // only ring edge
                    const tx = originTX + dx;
                    const ty = originTY + dy;
                    if (tx >= 0 && tx < this.WORLD_WIDTH && ty >= 0 && ty < this.WORLD_HEIGHT && this.world[tx][ty] === this.FLOOR) {
                        return {
                            tx, ty,
                            px: tx * this.TILE_SIZE + this.TILE_SIZE / 2,
                            py: ty * this.TILE_SIZE + this.TILE_SIZE / 2
                        };
                    }
                }
            }
        }
        return null;
    }

    damageEnemyIce(enemy, damage) {
        const brittleBonus = enemy.brittleStacks ? (1 + enemy.brittleStacks * this.brittlePerStack) : 1;
        const actualDamage = (enemy.isFrozen ? damage * 1.5 : damage) * brittleBonus;
        enemy.health -= actualDamage;
        this.gainUltCharge(this.ultChargePerHit);

        if (enemy.sprite && enemy.sprite.active) {
            this.showDamageNumber(enemy.sprite.x, enemy.sprite.y, actualDamage, '#88eeff');
        }

        this.applyBrittle(enemy, 1);
        enemy.isSlowed = true;
        enemy.slowedUntil = this.time.now + this.slowDuration;
        
        if (Math.random() < 0.1 && !enemy.isFrozen) {
            this.freezeEnemy(enemy, 2000);
            this.gainUltCharge(this.ultChargePerFreeze);
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
        // ── CONTINUOUS LASER (SPACE held, any time with charges) ──────
        if (this.cosmicContinuousLaserActive) {
            // Drain 1 charge per second
            if (time - this.cosmicLaserLastDrain >= this.cosmicLaserDrainInterval) {
                this.cosmicLaserLastDrain = time;
                this.cosmicBatteryCharges--;
                this.updateHUD();
                if (this.cosmicBatteryCharges <= 0) {
                    this.cosmicBatteryCharges = 0;
                    this.cosmicContinuousLaserActive = false;
                    this.updateHUD();
                }
            }

            // Fire beam toward mouse every tick
            if (this.cosmicContinuousLaserActive && time - this.cosmicLaserLastTick >= this.cosmicLaserTickInterval) {
                this.cosmicLaserLastTick = time;
                const playerPixelX = this.playerX * this.TILE_SIZE + this.TILE_SIZE / 2;
                const playerPixelY = this.playerY * this.TILE_SIZE + this.TILE_SIZE / 2;
                const worldX = this.pointerX + this.cameras.main.scrollX;
                const worldY = this.pointerY + this.cameras.main.scrollY;
                const dx = worldX - playerPixelX;
                const dy = worldY - playerPixelY;
                const dist = Math.sqrt(dx * dx + dy * dy);
                if (dist > 0) {
                    this.fireCosmicBeam(playerPixelX, playerPixelY, dx / dist, dy / dist,
                        this.cosmicBaseBeamDamage * this.damageScaling * 1.5, 4, 1);
                }
            }
            return;
        } else if (!this.cosmicContinuousLaserActive && !this.cosmicCharging) {
            return;
        }
        
        this.cosmicChargeHoldTime = time - this.cosmicChargeStartTime;
        
        // Faster base charge rate (3x), even faster during black hole (6x)
        const chargeRateMultiplier = this.cosmicBlackHole ? 6 : 3;
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
        const chargeRateMultiplier = this.cosmicBlackHole ? 6 : 3;
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
                    
                    // Clear marks and gain charge per mark consumed
                    const marksConsumed = enemy.cosmicMarks;
                    enemy.cosmicMarks = 0;
                    this.updateCosmicMarkVisual(enemy);
                    this.gainUltCharge(marksConsumed * this.ultChargePerCosmicMark);
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
        console.log('COSMIC ULT ACTIVATED - CONTINUOUS LASER MODE');
        
        // Activate ult mode - player can now hold SPACE to fire laser
        this.cosmicUltActive = true;
        this.ultDrainActive = true;
        this.ultDrainStartTime = this.time.now;
        this.ultDrainDuration = 10000; // 10 second timeout if player holds space the whole time
        
        // Visual feedback
        const ultNotif = this.add.text(
            this.scale.width / 2,
            80,
            'LASER ULT ACTIVE - HOLD SPACE TO FIRE',
            {
                fontSize: '16px',
                fontFamily: 'monospace',
                color: '#9966ff',
                stroke: '#000000',
                strokeThickness: 3,
                fontStyle: 'bold'
            }
        ).setOrigin(0.5).setScrollFactor(0);
        
        this.tweens.add({
            targets: ultNotif,
            y: 60,
            alpha: 0,
            duration: 2000,
            onComplete: () => ultNotif.destroy()
        });
        
        // Ult ends when charges deplete or after timeout
        this.time.delayedCall(this.ultDrainDuration, () => {
            if (this.cosmicUltActive) {
                this.cosmicUltActive = false;
                this.cosmicContinuousLaserActive = false;
                this.ultDrainActive = false;
                this.updateHUD();
            }
        });
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
        const progress = elapsed / this.cosmicBlackHoleDuration;
        
        // Shrinking radius over time (4 tiles → 1 tile)
        const currentRadius = this.cosmicBlackHoleRadius * (1 - progress * 0.75);
        
        // Update visuals
        const radiusPixels = currentRadius * this.TILE_SIZE;
        const children = bh.container.list;
        children[0].setRadius(radiusPixels);
        children[1].setRadius(radiusPixels * 0.6);
        children[2].setRadius(radiusPixels * 0.2);
        
        // Prune dead enemies from affectedEnemies
        bh.affectedEnemies = bh.affectedEnemies.filter(e => e.sprite && e.sprite.active);

        // Find enemies in radius — pull them smoothly toward the center
        for (let enemy of this.enemies) {
            const dist = Math.abs(enemy.x - bh.tileX) + Math.abs(enemy.y - bh.tileY);

            if (dist <= currentRadius) {
                if (!bh.affectedEnemies.includes(enemy)) {
                    bh.affectedEnemies.push(enemy);
                }

                // Smooth pull toward black hole center pixel by pixel
                const ex = enemy.sprite.x;
                const ey = enemy.sprite.y;
                const dx = bh.x - ex;
                const dy = bh.y - ey;
                const pixelDist = Math.sqrt(dx * dx + dy * dy);

                if (pixelDist > 4) {
                    // Pull speed increases as enemy gets closer (gravity feel)
                    const pullStrength = Phaser.Math.Clamp(0.06 + (1 - pixelDist / (currentRadius * this.TILE_SIZE)) * 0.1, 0.04, 0.16);
                    const newX = Phaser.Math.Linear(ex, bh.x, pullStrength);
                    const newY = Phaser.Math.Linear(ey, bh.y, pullStrength);

                    const targetTileX = Math.floor(newX / this.TILE_SIZE);
                    const targetTileY = Math.floor((newY - this.SLIME_Y_OFFSET) / this.TILE_SIZE);

                    if (targetTileX >= 0 && targetTileX < this.WORLD_WIDTH &&
                        targetTileY >= 0 && targetTileY < this.WORLD_HEIGHT &&
                        this.world[targetTileX][targetTileY] === this.FLOOR) {
                        enemy.sprite.x = newX;
                        enemy.sprite.y = newY;
                        enemy.x = targetTileX;
                        enemy.y = targetTileY;
                    }
                }

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
            for (let enemy of bh.affectedEnemies) {
                if (!enemy.sprite || !enemy.sprite.active) continue;
                enemy.isStunned = true;
                enemy.stunnedUntil = time + 500;
                this.time.delayedCall(500, () => {
                    if (enemy.sprite && enemy.sprite.active) {
                        enemy.isStunned = false;
                    }
                });
            }
            
            this.tweens.killTweensOf(bh.container);
            bh.container.destroy();
            this.cosmicBlackHole = null;
            this.cosmicContinuousLaserActive = false;
            
            this.cosmicInfiniteBeamEndTime = time + this.cosmicBlackHoleGracePeriod;
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