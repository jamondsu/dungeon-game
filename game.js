class GameScene extends Phaser.Scene {
    preload() {
        this.load.spritesheet('slime_blue', 'assets/Slime_Blue_32x32.png', {
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
        
        // game state
        this.maxHealth = 5;
        this.health = this.maxHealth;
        
        const seed = 12345;
        this.rng = this.createRng(seed);
        this.world = this.generateWorld();
        
        this.renderWorld();
        this.placePlayer();
        
        this.anims.create({
            key: 'idle',
            frames: [
                { key: 'slime_blue', frame: 0 },
                { key: 'slime_blue', frame: 18 }
            ],
            frameRate: 2,
            repeat: -1
        });
        
        // camera follows player
        this.cameras.main.startFollow(this.player);
        this.cameras.main.setBounds(0, 0, this.WORLD_WIDTH * this.TILE_SIZE, this.WORLD_HEIGHT * this.TILE_SIZE);
        
        // create HUD (uses scrollFactor 0 so it stays fixed on screen)
        this.createHUD();

        // for mobile
        this.createTouchControls();
        
        this.keys = this.input.keyboard.addKeys('W,A,S,D');
        
        this.lastMoveTime = 0;
        this.moveCooldown = 200;
        this.idleDelay = 500;
        this.isIdling = false;
    }
    
    createHUD() {
        // semi-transparent black background bar at top
        this.hudBg = this.add.rectangle(0, 0, this.scale.width, 40, 0x000000, 0.7);
        this.hudBg.setOrigin(0, 0);
        this.hudBg.setScrollFactor(0);
        
        // health text
        this.healthText = this.add.text(10, 10, '', { 
            fontSize: '18px', 
            color: '#ff5566',
            fontFamily: 'monospace'
        });
        this.healthText.setScrollFactor(0);
        
        // position/tile info on the right
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
        // hearts
        let hearts = 'HP: ';
        for (let i = 0; i < this.maxHealth; i++) {
            hearts += i < this.health ? '♥ ' : '♡ ';
        }
        this.healthText.setText(hearts);
        
        // position
        if (this.playerX !== undefined) {
            this.posText.setText(`Pos: (${this.playerX}, ${this.playerY})`);
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
                        y * this.TILE_SIZE + this.TILE_SIZE / 2 - 10,  // shift up a bit
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
            
            // keyboard input
            if (this.keys.W.isDown) dy = -1;
            else if (this.keys.S.isDown) dy = 1;
            else if (this.keys.A.isDown) dx = -1;
            else if (this.keys.D.isDown) dx = 1;
            
            // touch input (only if mobile and no keyboard input)
            if (this.isMobile && dx === 0 && dy === 0) {
                if (this.touchInput.up) dy = -1;
                else if (this.touchInput.down) dy = 1;
                else if (this.touchInput.left) dx = -1;
                else if (this.touchInput.right) dx = 1;
            }
            
            if (dx !== 0 || dy !== 0) {
                const newX = this.playerX + dx;
                const newY = this.playerY + dy;
                
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
        
        if (!this.isIdling && time - this.lastMoveTime > this.idleDelay) {
            this.player.play('idle');
            this.isIdling = true;
        }
    }

    createTouchControls() {
        // detect if mobile
        this.isMobile = !this.sys.game.device.os.desktop;
        
        if (!this.isMobile) return;
        
        const buttonSize = 70;
        const padding = 20;
        const baseX = padding + buttonSize;
        const baseY = this.scale.height - padding - buttonSize;
        
        // create 4 directional buttons
        const buttonStyle = { fontSize: '32px', color: '#ffffff' };
        const buttonAlpha = 0.4;
        
        // up
        this.btnUp = this.add.rectangle(baseX, baseY - buttonSize, buttonSize, buttonSize, 0x000000, buttonAlpha)
            .setScrollFactor(0).setInteractive();
        this.add.text(baseX, baseY - buttonSize, '▲', buttonStyle).setOrigin(0.5).setScrollFactor(0);
        
        // down
        this.btnDown = this.add.rectangle(baseX, baseY + buttonSize, buttonSize, buttonSize, 0x000000, buttonAlpha)
            .setScrollFactor(0).setInteractive();
        this.add.text(baseX, baseY + buttonSize, '▼', buttonStyle).setOrigin(0.5).setScrollFactor(0);
        
        // left
        this.btnLeft = this.add.rectangle(baseX - buttonSize, baseY, buttonSize, buttonSize, 0x000000, buttonAlpha)
            .setScrollFactor(0).setInteractive();
        this.add.text(baseX - buttonSize, baseY, '◀', buttonStyle).setOrigin(0.5).setScrollFactor(0);
        
        // right
        this.btnRight = this.add.rectangle(baseX + buttonSize, baseY, buttonSize, buttonSize, 0x000000, buttonAlpha)
            .setScrollFactor(0).setInteractive();
        this.add.text(baseX + buttonSize, baseY, '▶', buttonStyle).setOrigin(0.5).setScrollFactor(0);
        
        // track which buttons are being pressed
        this.touchInput = { up: false, down: false, left: false, right: false };
        
        this.btnUp.on('pointerdown', () => this.touchInput.up = true);
        this.btnUp.on('pointerup', () => this.touchInput.up = false);
        this.btnUp.on('pointerout', () => this.touchInput.up = false);
        
        this.btnDown.on('pointerdown', () => this.touchInput.down = true);
        this.btnDown.on('pointerup', () => this.touchInput.down = false);
        this.btnDown.on('pointerout', () => this.touchInput.down = false);
        
        this.btnLeft.on('pointerdown', () => this.touchInput.left = true);
        this.btnLeft.on('pointerup', () => this.touchInput.left = false);
        this.btnLeft.on('pointerout', () => this.touchInput.left = false);
        
        this.btnRight.on('pointerdown', () => this.touchInput.right = true);
        this.btnRight.on('pointerup', () => this.touchInput.right = false);
        this.btnRight.on('pointerout', () => this.touchInput.right = false);
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