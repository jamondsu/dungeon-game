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
            degree5: 1.25
        };
        
        // game state
        this.maxHealth = 5;
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
        this.elements = ['fire', 'ice', 'lightning'];
        this.elementSwitchCooldown = 1000; // 1 second cooldown
        this.lastElementSwitchTime = 0;

        // hailstorms (ice AOE attacks)
        this.hailstorms = [];
        this.hailstormRadius = 2; // tiles
        this.hailstormDuration = 1500; // 1.5 seconds
        this.hailstormTickInterval = 500; // damage every 0.5s
        this.hailstormDamage = 1.25;

        this.lightningChainRange = 4; // tiles - range to chain between enemies
        this.baseLightningDamage = 0.6; // weak first hit
        this.lightningChainFalloff = 0.6; // 60% damage per chain (manual attacks)
        this.lightningUltChainFalloff = 0.95; // 95% damage per chain (ult attacks)
        this.lightningCooldown = 100;
        this.lightningMaxRange = 20; // can target enemies up to 20 tiles away

        this.stormCloud = null;
        this.stormCloudCharge = 100;
        this.stormCloudAutoAttackInterval = 90; 
        this.stormCloudLastAttack = 0;
        this.stormCloudChargeDecayPerAttack = 1; 
        this.stormCloudActive = false;

        this.stormField = null;
        this.stormFieldRadius = 4; 
        this.stormFieldMaxRadius = 15; 
        this.stormFieldTickInterval = 75; 
        this.stormFieldLastTick = 0;
        this.stormFieldDuration = 3000; 
        this.stormFieldLifeGainAmount = 600; 
        this.stormFieldLifeGainCooldown = 800;  
        this.stormFieldRadiusGrowthPerHit = 0.15;

        // Q key to switch elements
        this.input.keyboard.on('keydown-Q', () => {
            this.switchElement();
        });

        // Element ultimate abilities
        this.ultActive = false;
        this.ultCooldowns = {
            'fire': 0,   
            'ice': 0,
            'lightning': 0
        };
        this.lastUltTimes = {
            'fire': -99999,
            'ice': -99999,
            'lightning': -99999
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
            
            // Check if storm cloud is active - click to deploy
            if (this.stormCloudActive && this.stormCloud) {
                this.deployStormField(pointer.x, pointer.y);
                return;
            }
            
            this.isPointerDown = true;
            this.pointerX = pointer.x;
            this.pointerY = pointer.y;
            this.shootAttack(pointer.x, pointer.y);
        });

        this.input.on('pointermove', (pointer) => {
            if (this.isPointerDown) {
                this.pointerX = pointer.x;
                this.pointerY = pointer.y;
            }
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
        
        this.updateHUD();
    }
    
    updateHUD() {
        const healthPercent = this.health / this.maxHealth;
        this.healthBarFill.width = 100 * healthPercent;
        this.healthText.setText(`${this.health.toFixed(1)}/${this.maxHealth}`);
        
        const elementSymbols = {
            'fire': '🔥 FIRE',
            'ice': '❄️ ICE',
            'lightning': '⚡ LIGHTNING'
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
        if (time - this.lastMoveTime >= this.moveCooldown) {
            let dx = 0, dy = 0;
            
            if (this.keys.W.isDown) dy = -1;
            else if (this.keys.S.isDown) dy = 1;
            else if (this.keys.A.isDown) dx = -1;
            else if (this.keys.D.isDown) dx = 1;
            
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

        if (this.isPointerDown) {
            this.shootAttack(this.pointerX, this.pointerY);
        }
        this.updateFireballs(delta);
        this.updateBurnEffects(time);
        this.updateHailstorms(time);
        this.updateStormCloud(time); 
        this.updateStormField(time);
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
            lastMoveTime: 0
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
            attackMultiplier = hasSuperburn ? 1000.0 : 1.0;
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
        const damageMultiplier = hasSuperburn ? 0.02 : 1.0;
        
        if (hasSuperburn) {
            const baseAngle = Math.atan2(dirY, dirX);
            const spreadAngle = Math.PI / 8;
            
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
        
        const index = this.enemies.indexOf(enemy);
        if (index > -1) {
            this.enemies.splice(index, 1);
        }
    }

    switchElement() {
        const currentTime = this.time.now;
        
        if (currentTime - this.lastElementSwitchTime < this.elementSwitchCooldown) {
            return;
        }
        
        this.isPointerDown = false;
        
        for (let fireball of this.fireballs) {
            if (fireball.sprite) {
                fireball.sprite.destroy();
            }
        }
        this.fireballs = [];
        
        for (let hailstorm of this.hailstorms) {
            if (hailstorm.visuals) {
                hailstorm.visuals.forEach(v => {
                    this.tweens.killTweensOf(v);
                    v.destroy();
                });
            }
        }
        this.hailstorms = [];
        
        const currentIndex = this.elements.indexOf(this.currentElement);
        const nextIndex = (currentIndex + 1) % this.elements.length;
        this.currentElement = this.elements[nextIndex];
        
        const colors = {
            'fire': 0xff6600,
            'ice': 0x00ccff,
            'lightning': 0xffff00
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
            
            // Use manual falloff for non-ult attacks
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
        
        graphics.lineStyle(3, 0xffff00, 1);
        
        const segments = 6;
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
                
                const offset = (Math.random() - 0.5) * 16;
                
                points.push({
                    x: x + perpX * offset,
                    y: y + perpY * offset
                });
            } else {
                points.push({ x, y });
            }
        }
        
        graphics.beginPath();
        graphics.moveTo(points[0].x, points[0].y);
        for (let i = 1; i < points.length; i++) {
            graphics.lineTo(points[i].x, points[i].y);
        }
        graphics.strokePath();
        
        graphics.lineStyle(6, 0xffffff, 0.4);
        graphics.beginPath();
        graphics.moveTo(points[0].x, points[0].y);
        for (let i = 1; i < points.length; i++) {
            graphics.lineTo(points[i].x, points[i].y);
        }
        graphics.strokePath();
        
        for (let i = 1; i < points.length - 1; i++) {
            if (Math.random() < 0.3) {
                const forkLength = 10 + Math.random() * 15;
                const angle = Math.random() * Math.PI * 2;
                
                const forkEndX = points[i].x + Math.cos(angle) * forkLength;
                const forkEndY = points[i].y + Math.sin(angle) * forkLength;
                
                graphics.lineStyle(2, 0xffff00, 0.8);
                graphics.beginPath();
                graphics.moveTo(points[i].x, points[i].y);
                graphics.lineTo(forkEndX, forkEndY);
                graphics.strokePath();
            }
        }
        
        this.tweens.add({
            targets: graphics,
            alpha: 0,
            duration: 150,
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
        
        if (this.stormCloud) {
            this.tweens.killTweensOf(this.stormCloud.body);
            this.tweens.killTweensOf(this.stormCloud.crackle);
            this.stormCloud.body.destroy();
            this.stormCloud.crackle.destroy();
            this.stormCloud.chargeText.destroy();
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
            currentRadius: startRadius,
            createdAt: this.time.now,
            expiresAt: this.time.now + (this.stormFieldDuration * chargePercent),
            radiusTiles: startRadius,
            lastLifeGainTime: 0 
        };
        
        this.stormCloudActive = false;
        this.stormFieldLastTick = this.time.now;
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
        
        const chargePercent = this.stormCloudCharge / 100;
        const scaledRadius = this.stormField.radiusTiles * chargePercent;
        const radiusPixels = scaledRadius * this.TILE_SIZE;
        
        this.stormField.circle.radius = radiusPixels;
        this.stormField.border.radius = radiusPixels;
        
        if (time - this.stormFieldLastTick >= this.stormFieldTickInterval) {
            this.stormFieldLastTick = time;
            
            const enemiesInField = [];
            
            for (let enemy of this.enemies) {
                const dist = Math.abs(enemy.x - this.stormField.tileX) + Math.abs(enemy.y - this.stormField.tileY);
                if (dist <= scaledRadius) {
                    enemiesInField.push(enemy);
                }
            }
            
            if (enemiesInField.length > 0) {
                const randomEnemy = enemiesInField[Math.floor(Math.random() * enemiesInField.length)];
                
                this.drawLightningBolt(
                    { sprite: this.stormField.circle },
                    randomEnemy
                );
                
                // Group bonus: +20% damage per enemy in field
                const groupBonus = 1.0 + (enemiesInField.length * 0.2);
                const fieldDamage = (this.baseLightningDamage * this.damageScaling) * chargePercent * groupBonus;
                
                // Start chain with ult falloff
                const hitEnemies = [];
                this.performChainLightning(randomEnemy, fieldDamage, hitEnemies, this.lightningUltChainFalloff);
                const hitCount = hitEnemies.length;
                
                if (hitCount > 0) {
                    if (time - this.stormField.lastLifeGainTime >= this.stormFieldLifeGainCooldown) {
                        this.stormField.expiresAt += this.stormFieldLifeGainAmount;
                        this.stormField.lastLifeGainTime = time;
                        console.log(`Lifespan extended! +${this.stormFieldLifeGainAmount / 1000}s`);
                    }
                    
                    for (let i = 0; i < hitCount; i++) {
                        if (this.stormField.radiusTiles < this.stormFieldMaxRadius) {
                            this.stormField.radiusTiles += this.stormFieldRadiusGrowthPerHit;
                            this.stormField.radiusTiles = Math.min(this.stormField.radiusTiles, this.stormFieldMaxRadius);
                        }
                    }
                }
            }
            
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
        
        const cloudBody = this.add.circle(cloudX, cloudY, 20, 0x666666, 0.8);
        
        const crackle = this.add.circle(cloudX, cloudY, 22, 0xffff00, 0.4);
        
        this.tweens.add({
            targets: [cloudBody, crackle],
            scaleX: 1.2,
            scaleY: 1.2,
            duration: 300,
            yoyo: true,
            repeat: -1,
            ease: 'Sine.easeInOut'
        });
        
        const chargeText = this.add.text(
            cloudX,
            cloudY,
            '100%',
            {
                fontSize: '12px',
                fontFamily: 'monospace',
                color: '#ffffff',
                fontStyle: 'bold'
            }
        ).setOrigin(0.5);
        
        this.stormCloud = {
            body: cloudBody,
            crackle: crackle,
            chargeText: chargeText
        };
        
        this.player.setTint(0xffff00);
        this.time.delayedCall(300, () => {
            this.player.clearTint();
        });
    }

    updateStormCloud(time) {
        if (!this.stormCloudActive || !this.stormCloud) return;
        
        this.stormCloud.body.x = this.player.x;
        this.stormCloud.body.y = this.player.y - 40;
        this.stormCloud.crackle.x = this.player.x;
        this.stormCloud.crackle.y = this.player.y - 40;
        this.stormCloud.chargeText.x = this.player.x;
        this.stormCloud.chargeText.y = this.player.y - 40;
        
        this.stormCloud.chargeText.setText(`${Math.floor(this.stormCloudCharge)}%`);
        
        if (time - this.stormCloudLastAttack >= this.stormCloudAutoAttackInterval) {
            this.stormCloudAutoAttack();
            this.stormCloudLastAttack = time;
            
            this.stormCloudCharge -= this.stormCloudChargeDecayPerAttack;
            
            if (this.stormCloudCharge <= 0) {
                this.deactivateStormCloud();
            }
        }
        
        const chargePercent = this.stormCloudCharge / 100;
        this.stormCloud.body.setScale(0.5 + chargePercent * 0.5);
        this.stormCloud.crackle.setAlpha(0.2 + chargePercent * 0.3);
    }

    stormCloudAutoAttack() {
        // Find ALL enemies within reasonable range
        const nearbyEnemies = [];
        const maxRange = 15;
        
        for (let enemy of this.enemies) {
            const dist = Math.abs(enemy.x - this.playerX) + Math.abs(enemy.y - this.playerY);
            if (dist <= maxRange) {
                nearbyEnemies.push({ enemy, dist });
            }
        }
        
        if (nearbyEnemies.length === 0) return;
        
        // Sort by distance
        nearbyEnemies.sort((a, b) => a.dist - b.dist);
        
        // Hit up to 3 separate targets (must be spread apart)
        const targetsToHit = Math.min(3, nearbyEnemies.length);
        const hitTargets = [];
        
        for (let i = 0; i < targetsToHit; i++) {
            const target = nearbyEnemies[i].enemy;
            
            // Check if this enemy is too close to already-hit enemies
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
        
        // Attack each spread-out target
        for (let target of hitTargets) {
            console.log('Storm cloud auto-attack on spread enemy!');
            
            this.drawLightningBolt(
                { sprite: this.stormCloud.body },
                target
            );
            
            // Use ult falloff for cloud attacks
            this.performChainLightning(target, this.baseLightningDamage * this.damageScaling * 0.8, [], this.lightningUltChainFalloff);
        }
    }

    deactivateStormCloud() {
        console.log('Storm cloud depleted!');
        
        this.stormCloudActive = false;
        
        if (this.stormCloud) {
            this.tweens.add({
                targets: [this.stormCloud.body, this.stormCloud.crackle, this.stormCloud.chargeText],
                alpha: 0,
                duration: 300,
                onComplete: () => {
                    this.tweens.killTweensOf(this.stormCloud.body);
                    this.tweens.killTweensOf(this.stormCloud.crackle);
                    this.stormCloud.body.destroy();
                    this.stormCloud.crackle.destroy();
                    this.stormCloud.chargeText.destroy();
                    this.stormCloud = null;
                }
            });
        }
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