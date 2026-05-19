// ═══════════════════════════════════════════════════════════════════════════
// GAMESCENE.JS — Scene shell: create, update, input, proxies to all modules
// ═══════════════════════════════════════════════════════════════════════════
// Module files (loaded before this in index.html):
//   WorldGen.js        — level/world generation
//   TutorialManager.js — tutorial flow, dialogue, rooms
//   EnemyManager.js    — enemy AI, pathfinding, traps, drops
//   WeaponSystem.js    — all player weapons and projectiles
//   CombatSystem.js    — damage, kill, status effects
//   ElementSystem.js   — element ultimates and active abilities
//   HUD.js             — HUD, pause menu, death screen

class GameScene extends Phaser.Scene {
    constructor() { super({ key: 'Game' }); }

    preload() {
        this.load.spritesheet('slime_blue', 'assets/Slime_Blue_32x32.png', {
            frameWidth: 32,
            frameHeight: 32
        });
        this.load.spritesheet('slime_red', 'assets/Slime_Red_32x32.png', {
            frameWidth: 32,
            frameHeight: 32
        });
        this.load.spritesheet('slime_orange', 'assets/Slime_Orange_32x32.png', {
            frameWidth: 32,
            frameHeight: 32
        });
        this.load.spritesheet('tiles', 'assets/roguelikeDungeon_transparent.png', {
            frameWidth: 17,
            frameHeight: 17
        });
        this.load.spritesheet('cloud_storm', 'assets/cloud_storm.png', {
            frameWidth: 280,
            frameHeight: 70
        });
    }


    create(data) {
        this.currentLevelIndex = data?.levelIndex ?? 0;
        this.tutorialStage = data?.tutorialStage ?? 0;

        // ── MANDATORY STATE RESET — must run before anything else ────────────
        if (this.input?.keyboard) this.input.keyboard.enabled = true;
        this.lockedDoorTiles         = [];
        this.lockedDoorSprites       = [];
        this.tutorialChests          = [];
        this.portals                 = [];
        this.tutorialRoomCleared     = [];
        this.tutorialDoorsLocked     = [];
        this.currentTutorialRoom     = -1;
        this.tutorialNameEntered     = false;
        this.tutorialGlorpsCollected = false;
        this.tutorialIceUnlocked     = false;
        this.tutorialWeaponLocked    = false;
        this.isTutorial              = false;
        this.isIceTutorial           = false;
        this.isLightningTutorial     = false;
        this.isLevel2                = false;
        this._roomHadEnemies         = {};
        this._ultNagShown            = false;
        this._iceUltUsed             = false;
        this._lightningUltUsed       = false;
        this.voltslimeBoss           = null;
        this.lightningUltActive      = false;
        this.lightningUltInvuln      = false;
        this.lightningUltEndTime     = 0;
        // ────────────────────────────────────────────────────────────────────
        this.TILE_SIZE = 24;
        this.TILE_SCALE = 1.5;
        this.SLIME_SCALE = 1.2;
        this.WORLD_WIDTH = 120;
        this.WORLD_HEIGHT = 100;
        this.SLIME_Y_OFFSET = -10;

        this.NOTHING = 0;
        this.FLOOR = 1;
        this.WALL = 2;

        // Cloud storm animations
        if (!this.anims.exists('cloud_active')) this.anims.create({
            key: 'cloud_active',
            frames: this.anims.generateFrameNumbers('cloud_storm', { start: 0, end: 1 }),
            frameRate: 1.5,
            repeat: -1
        });
        if (!this.anims.exists('cloud_dissipate')) this.anims.create({
            key: 'cloud_dissipate',
            frames: this.anims.generateFrameNumbers('cloud_storm', { start: 2, end: 4 }),
            frameRate: 4,
            repeat: 0
        });

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
        this.tsunamiPuddles = [];
        this.tsunamiFrozenEnemies = [];
        this.tsunamiMaxRadius = 18;
        this.tsunamiWaveDuration = 2200;
        this.tsunamiFreezeDuration = 3000;
        this.tsunamiFreezeMultiplier = 1.5;
        this.tsunamiPuddleDuration = 9000;
        this.tsunamiPuddleSlowDuration = 900;

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

        // LIGHTNING ULT state
        this.lightningUltActive = false;
        this.lightningUltInvuln = false;
        this.lightningUltEndTime = 0;

        // Boss state reset
        this.voltslimeBoss = null;

        // game state
        this.maxHealth = 100;
        this.health = this.maxHealth;
        this.lastPlayerDamageTime = 0;
        this.playerDamageCooldown = 150;

        const seed = 12345;
        this.rng = this.createRng(seed);
        this.world = this.generateWorld();

        this.renderWorld();
        this.placePlayer();

        // create animations BEFORE spawning enemies
        if (!this.anims.exists('idle')) this.anims.create({
            key: 'idle',
            frames: [
                { key: 'slime_blue', frame: 0 },
                { key: 'slime_blue', frame: 18 }
            ],
            frameRate: 2,
            repeat: -1
        });

        if (!this.anims.exists('red_idle')) this.anims.create({
            key: 'red_idle',
            frames: [
                { key: 'slime_red', frame: 0 },
                { key: 'slime_red', frame: 18 }
            ],
            frameRate: 2,
            repeat: -1
        });

        if (!this.anims.exists('orange_idle')) this.anims.create({
            key: 'orange_idle',
            frames: [
                { key: 'slime_orange', frame: 0 },
                { key: 'slime_orange', frame: 18 }
            ],
            frameRate: 2,
            repeat: -1
        });

        // enemy management
        this.enemies = [];
        this.floorTraps = [];
        this.groundDrops = [];
        this.enemyProjectiles = [];
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

        // Track unlocked elements — level 2 gives fire+ice by default
        this.unlockedElements = new Set(['fire', 'ice']);
        if (localStorage.getItem('unlocked_lightning') === 'true') this.unlockedElements.add('lightning');
        if (localStorage.getItem('unlocked_cosmic') === 'true') this.unlockedElements.add('cosmic');

        // Weapon loadout - load from localStorage
        this.equippedWeapons = {
            fire: localStorage.getItem('equip_fire') || 'flame_fists',
            ice: localStorage.getItem('equip_ice') || 'ice_fists',
            lightning: localStorage.getItem('equip_lightning') || 'lightning_fists',
            cosmic: localStorage.getItem('equip_cosmic') || 'cosmic_fists',
        };
        // Force flame_fists ONLY in actual fire tutorial
        if (this.currentLevelIndex === 0 && this.tutorialStage === 0) {
            this.equippedWeapons.fire = 'flame_fists';
        }
        this.elementSwitchCooldown = 1000; // 1 second cooldown
        this.lastElementSwitchTime = 0;

        // ICE: bouncing shards
        this.iceShards = [];
        this.iceShardSpeed = 100;
        this.iceShardDamage = 1;
        this.iceShardMaxBounces = 5;
        this.iceShardFreezeChance = 0.02;   // 2% chance per hit to become a freeze block
        this.iceBlockChance = 0.15;          // 15% chance on fire to shoot a big freeze block instead
        this.iceBlockDamage = 5.0;
        this.iceBlockFreezeDuration = 3000;

        this.lightningChainRange = 4;
        this.baseLightningDamage = 0.7;
        this.lightningChainFalloff = 0.5;
        this.lightningUltChainFalloff = 0.95;
        this.lightningCooldown = 600;
        this.lightningMaxRange = 20;

        // CONDUCTOR NODE SYSTEM
        this.lightningNodes = [];
        this.lightningNodeMax = 3;
        this.lightningNodeRadius = 5;
        this.lightningNodeChainRange = 16;
        this.lightningNodeDamage = 1.5;
        this.lightningNodeZapInterval = 600;
        this.lightningNodeDuration = 18000;  // 18s — long enough to be strategic

        // Node battery stages — each bolt hit charges one stage
        this.lightningNodeMaxStage = 3;
        this.lightningNodeBaseRadius   = [0, 3, 4, 5];   // normal enemy range per stage (tiles)
        this.lightningNodeExtendRadius = [0, 0, 6, 8];   // superconducted range per stage
        this.lightningNodeStageColors  = [0x334455, 0xff2200, 0xff8800, 0xfff0aa]; // dormant/red/orange/gold-white

        this.lightningNodePreview = null;
        this.lightningProjectiles = [];
        this.lightningNodesCrafting = [];

        // Orb scraps — currency for nodes
        this.orbScraps = 0;
        this.orbNodeCost = 5;
        this.orbRefundPct = 0.4;
        this.orbDropChance = 0.08;
        this.orbPickupRadius = 3;      // tiles
        this.orbObjects = [];

        // Node channel — 3s still channel to craft or remove
        this.nodeChannelActive = false;
        this.nodeChannelType = null;   // 'craft' | 'remove'
        this.nodeChannelTarget = null; // { tileX, tileY }
        this.nodeChannelStartTime = 0;
        this.nodeChannelDuration = 3000;
        this.nodeChannelVisual = null;

        // Superconductor mechanic
        this.superConductDuration = 10000;

        this.stormCloud = null;
        this.stormCloudRadius = 8;
        this.stormCloudCharge = 100;
        this.stormCloudAutoAttackInterval = 250;
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
        this.cosmicBatteryCharges = 0; // start empty — must channel to earn
        this.cosmicMaxCharges = 10;

        // Active channeling (F key)
        this.cosmicChanneling = false;
        this.cosmicChannelStartTime = 0;
        this.cosmicChannelSecondsPerCharge = 2; // seconds of channeling per charge
        this.cosmicChannelLastCharge = 0;         // last time a charge was earned
        this.cosmicChannelVisual = null;
        this.cosmicDropChance = 0.5; // 50% chance on enemy death

        this.cosmicCharging = false;
        this.cosmicChargeStartTime = 0;
        this.cosmicChargeHoldTime = 0; // how long holding
        this.cosmicChargeIndicator = null;

        // Beam properties
        this.cosmicBaseBeamDamage = 1.0;
        this.cosmicBeamWidth = 1.5; // tiles

        // Cosmic marks system
        this.cosmicMarkDamagePerStack = 12; // bonus damage per mark consumed
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

        // ESC — open/close pause menu
        this.input.keyboard.on('keydown-ESC', () => {
            if (this._deathScreenActive) return;
            if (this._pauseMenuOpen) {
                this.closePauseMenu();
            } else {
                this.openPauseMenu();
            }
        });

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
        this.ultChargePerChain = 3.5;        // lightning per click
        this.ultChargePerFreeze = 6.0;       // ice freeze proc
        this.ultChargePerCosmicMark = 8.0;   // cosmic mark consumed

        // Cosmic continuous laser (during ult)
        this.cosmicContinuousLaserActive = false;
        this.cosmicUltActive = false;         // tracks if ult mode is active
        this.cosmicLaserDrainInterval = 500; // drain 1 charge per second
        this.cosmicLaserLastDrain = 0;
        this.cosmicLaserTickInterval = 80;    // fire beam visual every 80ms
        this.cosmicLaserLastTick = 0;

        this.damageReductionMultiplier = 1.0;
        this.attackSpeedMultiplier = 1.0;

        // E key to activate ult
        this.input.keyboard.on('keydown-E', () => {
            // If black hole projectile is in flight, E detonates it
            if (this.cosmicBlackHoleProjectile) {
                this.detonateCosmicBomb();
                return;
            }
            this.activateUlt();

            // Tutorial room 1 (fire tutorial only): track ult usage, then unlock element switching
            if (this.isTutorial && !this.isIceTutorial && this.getCurrentPlayerRoom() === 1) {
                this._ultUsedInRoom2 = true;
                this.tutorialWeaponLocked = false;
                const room1Enemies = this.enemies.filter(e => e.tutorialRoomIndex === 1);
                if (room1Enemies.length === 0 && this._roomHadEnemies?.[1]) {
                    this.onTutorialRoomClear(1);
                }
            }
            // Ice tutorial room 3: track ice ult usage
            if (this.isIceTutorial && this.currentElement === 'ice' && this.getCurrentPlayerRoom() === 3) {
                this._iceUltUsed = true;
                const room3Enemies = this.enemies.filter(e => e.tutorialRoomIndex === 3);
                if (room3Enemies.length === 0 && this._roomHadEnemies?.[3]) {
                    this.onTutorialRoomClear(3);
                }
            }
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

        // F key — cosmic charge channeling (hold to earn charges, vulnerable while channeling)
        this.input.keyboard.on('keydown-F', () => {
            if (this.currentElement !== 'cosmic') return;
            if (this.cosmicChanneling) return;
            if (this.cosmicBatteryCharges >= this.cosmicMaxCharges) return;
            this.startCosmicChanneling();
        });
        this.input.keyboard.on('keyup-F', () => {
            if (this.cosmicChanneling) this.stopCosmicChanneling(false);
        });
        this.cameras.main.setBounds(0, 0, this.WORLD_WIDTH * this.TILE_SIZE, this.WORLD_HEIGHT * this.TILE_SIZE);

        // create HUD
        this.createHUD();

        // ── DEV MODE ──────────────────────────────────────────────────────
        // Enable via: localStorage.setItem('devMode', 'true')
        // Disable via: localStorage.removeItem('devMode')
        this._devMode = localStorage.getItem('devMode') === 'true';
        this._devGodMode       = false;
        this._devOneShot       = false;
        this._devFreezeEnemies = false;
        this._devTeleportMode  = false;
        if (this._devMode) this._createDevPanel();

        // for mobile
        this.createTouchControls();

        this.keys = this.input.keyboard.addKeys('W,A,S,D');

        // fireball projectiles
        this.fireballs = [];
        this.enemyProjectiles = []; // ranged enemy shots
        this.groundDrops = [];      // glorp and health pot drops
        this.fireballSpeed = 300;
        this.lastFireballTime = 0;
        this.fireballCooldown = 500;
        this.iceballCooldown = 600;
        this.fireballMaxRange = 30;


        // hold mouse to shoot fireballs continuously
        this.isPointerDown = false;
        this.pointerX = 0;
        this.pointerY = 0;

        // Q toggles lightning node placement mode
        this.lightningNodeMode = false;
        this._nodePlacementRing = null; // circle showing placement range around player
        this.input.keyboard.on('keydown-Q', () => {
            if (this.currentElement !== 'lightning') return;
            this.lightningNodeMode = !this.lightningNodeMode;
            if (this.lightningNodeMode) {
                this.showNodePlacementRing();
            } else {
                this.clearNodeMode();
            }
        });

        this.input.on('pointerdown', (pointer) => {
            if (this._pauseMenuOpen || this._deathScreenActive) return;
            if (pointer.button !== 0) return;
            if (this._devTeleportMode) return; // teleport mode consumes left-click

            if (this.stormCloudActive && this.stormCloud && !this.stormCloud.thrown) {
                this.throwLightning();
                return;
            }

            if (this.currentElement === 'lightning') {
                if (this.lightningNodeMode) {
                    const worldX = pointer.x + this.cameras.main.scrollX;
                    const worldY = pointer.y + this.cameras.main.scrollY;
                    const tileX = Math.floor(worldX / this.TILE_SIZE);
                    const tileY = Math.floor(worldY / this.TILE_SIZE);
                    this.placeLightningNode(tileX, tileY);
                } else if ((this.equippedWeapons?.lightning || 'lightning_fists') === 'lightning_fists') {
                    this.isPointerDown = true;
                    this.pointerX = pointer.x;
                    this.pointerY = pointer.y;
                    this.fireEquippedWeapon(pointer.x, pointer.y);
                } else {
                    this.isPointerDown = true;
                    this.pointerX = pointer.x;
                    this.pointerY = pointer.y;
                    this.fireArcProjectile(pointer.x, pointer.y);
                }
                return;
            }

            if (this.currentElement === 'cosmic' && !this.cosmicInfiniteBeamActive) {
                this.pointerX = pointer.x;
                this.pointerY = pointer.y;
                return;
            }

            this.isPointerDown = true;
            this.pointerX = pointer.x;
            this.pointerY = pointer.y;
            // Use equipped weapon for current element
            this.fireEquippedWeapon(pointer.x, pointer.y);
        });

        this.input.on('pointerup', (pointer) => {
            this.isPointerDown = false;
        });

        this.input.on('pointermove', (pointer) => {
            this.pointerX = pointer.x;
            this.pointerY = pointer.y;
            if (this.currentElement === 'lightning' && this.lightningNodeMode) {
                const worldX = pointer.x + this.cameras.main.scrollX;
                const worldY = pointer.y + this.cameras.main.scrollY;
                this.updateNodePreview(
                    Math.floor(worldX / this.TILE_SIZE),
                    Math.floor(worldY / this.TILE_SIZE)
                );
            } else {
                this.clearNodePreview();
            }
        });

        // Backtick — toggle dev panel (only works if devMode is enabled in localStorage)
        this.input.keyboard.on('keydown-BACKTICK', () => {
            if (!this._devMode) return;
            if (this._devPanel) {
                const vis = !this._devPanel.visible;
                this._devPanel.setVisible(vis);
                // Turn off teleport mode when panel is hidden
                if (!vis) {
                    this._devTeleportMode = false;
                    if (this._devTeleportCursor) this._devTeleportCursor.setVisible(false);
                }
            }
        });

        // R key to remove lightning nodes
        this.input.keyboard.on('keydown-R', () => {
            if (this.currentElement === 'lightning' && this.lightningNodeMode) {
                const worldX = this.pointerX + this.cameras.main.scrollX;
                const worldY = this.pointerY + this.cameras.main.scrollY;
                const tileX = Math.floor(worldX / this.TILE_SIZE);
                const tileY = Math.floor(worldY / this.TILE_SIZE);
                // Try exact tile first, then find nearest within 2 tiles
                if (!this.removeLightningNodeAt(tileX, tileY)) {
                    // Find nearest node/craft within 2 tiles
                    let best = null, bestDist = 3;
                    for (const n of [...this.lightningNodes, ...this.lightningNodesCrafting]) {
                        const d = Math.abs(n.tileX - tileX) + Math.abs(n.tileY - tileY);
                        if (d < bestDist) { bestDist = d; best = n; }
                    }
                    if (best) this.removeLightningNodeAt(best.tileX, best.tileY);
                }
            }
        });

        this.lastMoveTime = 0;
        this.moveCooldown = 200;
        this.lastEnemyMoveTime = 0;
        this.enemyMoveCooldown = 1000;
        this.idleDelay = 500;
        this.isIdling = false;
        this.cameras.main.startFollow(this.player, true, 0.1, 0.1);
    }

    update(time, delta) {
        // Pause / death — freeze everything
        if (this._pauseMenuOpen || this._deathScreenActive) return;

        // Tutorial system
        if (this.isTutorial) {
            try {
                this.updateTutorial(time);
                this.checkTutorialPitCollision();
            } catch (e) { console.error('Tutorial error:', e); }
        }
        // Level 2+
        if (this.isLevel2) {
            try { this.updateLevel2(time); }
            catch (e) { console.error('Level 2 error:', e); }
        }
        // Voltslime boss
        if (this.voltslimeBoss?.active) {
            this.updateVoltslimeBoss(time, delta);
        }

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
                    this.world[newX][newY] === this.FLOOR &&
                    !this.isNodeAt(newX, newY)) {

                    // Tutorial: if the target tile is a sealed door tile, block and flash it
                    if ((this.isTutorial || this.isLevel2) && this.lockedDoorTiles) {
                        const sealedDoor = this.lockedDoorTiles.find(t => t.x === newX && t.y === newY);
                        if (sealedDoor) {
                            if (this.lockedDoorSprites && !this._doorFlashing) {
                                this._doorFlashing = true;
                                const doorSprites = this.lockedDoorSprites
                                    .filter(d => d.roomIndex === sealedDoor.roomIndex)
                                    .map(d => d.sprite);
                                this.tweens.add({
                                    targets: doorSprites,
                                    alpha: 1,
                                    duration: 80,
                                    yoyo: true,
                                    repeat: 2,
                                    onComplete: () => { this._doorFlashing = false; }
                                });
                            }
                            return; // block move, no pushback
                        }
                    }

                    this.playerX = newX;
                    this.playerY = newY;

                    // Smooth movement tween
                    const targetX = newX * this.TILE_SIZE + this.TILE_SIZE / 2;
                    const targetY = newY * this.TILE_SIZE + this.TILE_SIZE / 2 + this.SLIME_Y_OFFSET;
                    this.tweens.add({
                        targets: this.player,
                        x: targetX,
                        y: targetY,
                        duration: 100,
                        ease: 'Power2'
                    });

                    this.lastMoveTime = time;
                    this.player.stop();
                    this.player.setFrame(0);
                    this.isIdling = false;
                    if (this.nodeChannelActive) this.cancelNodeChannel();
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

        this.updateTsunamiPuddles(time);
        if (!this._devFreezeEnemies) this.moveEnemies();

        if (!this.isIdling && time - this.lastMoveTime > this.idleDelay) {
            this.player.play('idle');
            this.isIdling = true;
        }

        if (this.isPointerDown && this.currentElement !== 'cosmic') {
            if (this.currentElement === 'lightning' && !this.lightningNodeMode &&
                (this.equippedWeapons?.lightning || 'lightning_fists') !== 'lightning_fists') {
                this.fireArcProjectile(this.pointerX, this.pointerY);
            } else {
                this.fireEquippedWeapon(this.pointerX, this.pointerY);
            }
        }
        this.updateFireballs(delta);
        this.updateBurnEffects(time);
        this.updateIgnitionTrails(time);
        this.updateIceShards(delta);
        this.updateBrittleDecay(time);
        this.updateLightningNodes(time);
        this.updateArcProjectiles(delta);
        this.updateRangedEnemies(time);
        this.updateEnemyProjectiles(delta);
        this.updateFloorTraps(time);
        this.updateGroundDrops();
        this.updatePortals(time);
        this.updateSuperConductors(time);
        this.updateNodeCrafting(time);
        this.updateNodeChannel(time);
        this.updateOrbScraps();
        

        // Keep placement ring following player every frame
        if (this.lightningNodeMode && this._nodePlacementRing) {
            this._redrawPlacementRing();
        }
        this.updateTsunami(time);
        this.updateStormCloud(time);
        this.updateStormField(time);
        this.updateThunderhead(time, delta);

        // Level 2 boss
        if (this.voltslimeBoss) this.updateVoltslimeBoss(time, delta);
        this.updateCosmicChanneling(time);
        this.updateCosmicCharge(time);
        // Black hole projectile removed - using laser ult instead
        this.updateCosmicBlackHoleProjectile(delta);
        this.updateCosmicBlackHole(time);

        // Update HUD every frame for smooth ult drain bar and node count
        if (this.ultDrainActive || this.currentElement === 'cosmic' || this.currentElement === 'lightning') {
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


    // ─── METHOD PROXIES ─────────────────────────────────────────────────────────
    // Each method body lives in its module file. These one-liners delegate via .call()
    // so all module code still runs with `this` = the GameScene instance.

    // WorldGen
    generateWorld(...a) { return WorldGen.prototype.generateWorld.call(this, ...a); }
    generateTutorialLevel(...a) { return WorldGen.prototype.generateTutorialLevel.call(this, ...a); }
    generateIceTutorialLevel(...a) { return WorldGen.prototype.generateIceTutorialLevel.call(this, ...a); }
    generateLevel1(...a) { return WorldGen.prototype.generateLevel1.call(this, ...a); }
    generateLevel2(...a) { return WorldGen.prototype.generateLevel2.call(this, ...a); }
    canPlaceRoom(...a) { return WorldGen.prototype.canPlaceRoom.call(this, ...a); }
    carveRoom(...a) { return WorldGen.prototype.carveRoom.call(this, ...a); }
    connectRoomsMST(...a) { return WorldGen.prototype.connectRoomsMST.call(this, ...a); }
    addExtraConnections(...a) { return WorldGen.prototype.addExtraConnections.call(this, ...a); }
    roomDistance(...a) { return WorldGen.prototype.roomDistance.call(this, ...a); }
    connectRooms(...a) { return WorldGen.prototype.connectRooms.call(this, ...a); }
    addWalls(...a) { return WorldGen.prototype.addWalls.call(this, ...a); }
    hasFloorNeighbor(...a) { return WorldGen.prototype.hasFloorNeighbor.call(this, ...a); }
    isFloor(...a) { return WorldGen.prototype.isFloor.call(this, ...a); }
    getWallFrame(...a) { return WorldGen.prototype.getWallFrame.call(this, ...a); }
    renderWorld(...a) { return WorldGen.prototype.renderWorld.call(this, ...a); }
    placePlayer(...a) { return WorldGen.prototype.placePlayer.call(this, ...a); }
    createRng(...a) { return WorldGen.prototype.createRng.call(this, ...a); }

    // TutorialManager
    updateTutorial(...a) { return TutorialManager.prototype.updateTutorial.call(this, ...a); }
    // LevelManager proxies
    updateLevel2(...a)          { return LevelManager.prototype.updateLevel2.call(this, ...a); }
    _level2RoomClear(...a)      { return LevelManager.prototype._level2RoomClear.call(this, ...a); }
    spawnLevel2Enemies(...a)    { return LevelManager.prototype.spawnLevel2Enemies.call(this, ...a); }
    _spawnLevel2ChestRooms(...a){ return LevelManager.prototype._spawnLevel2ChestRooms.call(this, ...a); }
    spawnVoltslimeBoss(...a)    { return LevelManager.prototype.spawnVoltslimeBoss.call(this, ...a); }
    _voltslimeNextPhase(...a)   { return LevelManager.prototype._voltslimeNextPhase.call(this, ...a); }
    _voltslimeSlam(...a)        { return LevelManager.prototype._voltslimeSlam.call(this, ...a); }
    _voltslimeScatter(...a)     { return LevelManager.prototype._voltslimeScatter.call(this, ...a); }
    _voltslimeHoming(...a)      { return LevelManager.prototype._voltslimeHoming.call(this, ...a); }
    _voltslimeSpawner(...a)     { return LevelManager.prototype._voltslimeSpawner.call(this, ...a); }
    _voltslimeSpiral(...a)      { return LevelManager.prototype._voltslimeSpiral.call(this, ...a); }
    updateVoltslimeBoss(...a)   { return LevelManager.prototype.updateVoltslimeBoss.call(this, ...a); }
    damageVoltslimeBoss(...a)   { return LevelManager.prototype.damageVoltslimeBoss.call(this, ...a); }
    damageBossAtTile(...a)      { return LevelManager.prototype.damageBossAtTile.call(this, ...a); }
    _killVoltslimeBoss(...a)    { return LevelManager.prototype._killVoltslimeBoss.call(this, ...a); }
    _voltslimeRicochet(...a)    { return LevelManager.prototype._voltslimeRicochet.call(this, ...a); }
    spawnFinalLevelChest(...a)  { return LevelManager.prototype.spawnFinalLevelChest.call(this, ...a); }
    openFinalLevelChest(...a)   { return LevelManager.prototype.openFinalLevelChest.call(this, ...a); }
    _showElementUnlockCinematic(...a) { return LevelManager.prototype._showElementUnlockCinematic.call(this, ...a); }
    onGlorpsCollected(...a) { return TutorialManager.prototype.onGlorpsCollected.call(this, ...a); }
    isInLockedRoom(...a) { return TutorialManager.prototype.isInLockedRoom.call(this, ...a); }
    getCurrentPlayerRoom(...a) { return TutorialManager.prototype.getCurrentPlayerRoom.call(this, ...a); }
    onTutorialRoomEnter(...a) { return TutorialManager.prototype.onTutorialRoomEnter.call(this, ...a); }
    _onIceTutorialRoomEnter(...a) { return TutorialManager.prototype._onIceTutorialRoomEnter.call(this, ...a); }
    _triggerIceImmuneGlerpReaction(...a) { return TutorialManager.prototype._triggerIceImmuneGlerpReaction.call(this, ...a); }
    startTutorialIntro(...a) { return TutorialManager.prototype.startTutorialIntro.call(this, ...a); }
    showNameInput(...a) { return TutorialManager.prototype.showNameInput.call(this, ...a); }
    continueAfterName(...a) { return TutorialManager.prototype.continueAfterName.call(this, ...a); }
    spawnTutorialGlorps(...a) { return TutorialManager.prototype.spawnTutorialGlorps.call(this, ...a); }
    _buildGlorpContainer(...a) { return TutorialManager.prototype._buildGlorpContainer.call(this, ...a); }
    onTutorialRoomClear(...a) { return TutorialManager.prototype.onTutorialRoomClear.call(this, ...a); }
    isInCurrentRoom(...a) { return TutorialManager.prototype.isInCurrentRoom.call(this, ...a); }
    getPortalAt(...a) { return TutorialManager.prototype.getPortalAt.call(this, ...a); }
    lockTutorialDoors(...a) { return TutorialManager.prototype.lockTutorialDoors.call(this, ...a); }
    unlockTutorialDoors(...a) { return TutorialManager.prototype.unlockTutorialDoors.call(this, ...a); }
    spawnTutorialChest(...a) { return TutorialManager.prototype.spawnTutorialChest.call(this, ...a); }
    openTutorialChest(...a) { return TutorialManager.prototype.openTutorialChest.call(this, ...a); }
    spawnTutorialPortalPit(...a) { return TutorialManager.prototype.spawnTutorialPortalPit.call(this, ...a); }
    checkTutorialPitCollision(...a) { return TutorialManager.prototype.checkTutorialPitCollision.call(this, ...a); }
    startTutorialVoidFall(...a) { return TutorialManager.prototype.startTutorialVoidFall.call(this, ...a); }
    playVoidFallScene(...a) { return TutorialManager.prototype.playVoidFallScene.call(this, ...a); }
    endTutorialReturnToMenu(...a) { return TutorialManager.prototype.endTutorialReturnToMenu.call(this, ...a); }
    showTutorialDialogue(...a) { return TutorialManager.prototype.showTutorialDialogue.call(this, ...a); }
    clearTutorialDialogue(...a) { return TutorialManager.prototype.clearTutorialDialogue.call(this, ...a); }
    spawnEnemies(...a) { return TutorialManager.prototype.spawnEnemies.call(this, ...a); }
    spawnTutorialEnemies(...a) { return TutorialManager.prototype.spawnTutorialEnemies.call(this, ...a); }
    spawnIceTutorialEnemies(...a) { return TutorialManager.prototype.spawnIceTutorialEnemies.call(this, ...a); }
    spawnFireMark(...a) { return TutorialManager.prototype.spawnFireMark.call(this, ...a); }
    spawnIceMark(...a) { return TutorialManager.prototype.spawnIceMark.call(this, ...a); }
    createRangedEnemy(...a) { return TutorialManager.prototype.createRangedEnemy.call(this, ...a); }
    spawnIceTraps(...a) { return TutorialManager.prototype.spawnIceTraps.call(this, ...a); }
    spawnPortal(...a) { return TutorialManager.prototype.spawnPortal.call(this, ...a); }
    updatePortals(...a) { return TutorialManager.prototype.updatePortals.call(this, ...a); }
    damagePortal(...a) { return TutorialManager.prototype.damagePortal.call(this, ...a); }
    _destroyPortal(...a) { return TutorialManager.prototype._destroyPortal.call(this, ...a); }
    spawnLevel1Enemies(...a) { return TutorialManager.prototype.spawnLevel1Enemies.call(this, ...a); }

    // EnemyManager
    createEnemy(...a) { return EnemyManager.prototype.createEnemy.call(this, ...a); }
    updateEnemyHealthBar(...a) { return EnemyManager.prototype.updateEnemyHealthBar.call(this, ...a); }
    getEnemyAt(...a) { return EnemyManager.prototype.getEnemyAt.call(this, ...a); }
    isNodeAt(...a) { return EnemyManager.prototype.isNodeAt.call(this, ...a); }
    findPathBFS(...a) { return EnemyManager.prototype.findPathBFS.call(this, ...a); }
    _bfsRun(...a) { return EnemyManager.prototype._bfsRun.call(this, ...a); }
    reconstructPath(...a) { return EnemyManager.prototype.reconstructPath.call(this, ...a); }
    moveEnemies(...a) { return EnemyManager.prototype.moveEnemies.call(this, ...a); }
    enemyAttackAnimation(...a) { return EnemyManager.prototype.enemyAttackAnimation.call(this, ...a); }
    updateRangedEnemies(...a) { return EnemyManager.prototype.updateRangedEnemies.call(this, ...a); }
    _hasLineOfSight(...a)     { return EnemyManager.prototype._hasLineOfSight.call(this, ...a); }
    _findSniperRepositionTile(...a) { return EnemyManager.prototype._findSniperRepositionTile.call(this, ...a); }
    _moveSniperStep(...a)     { return EnemyManager.prototype._moveSniperStep.call(this, ...a); }
    _spawnPrefireBeam(...a) { return EnemyManager.prototype._spawnPrefireBeam.call(this, ...a); }
    _drawLockedBeam(...a) { return EnemyManager.prototype._drawLockedBeam.call(this, ...a); }
    _updatePrefireBeam(...a) { return EnemyManager.prototype._updatePrefireBeam.call(this, ...a); }
    _destroyPrefireBeam(...a) { return EnemyManager.prototype._destroyPrefireBeam.call(this, ...a); }
    _fireEnemyProjectile(...a) { return EnemyManager.prototype._fireEnemyProjectile.call(this, ...a); }
    updateEnemyProjectiles(...a) { return EnemyManager.prototype.updateEnemyProjectiles.call(this, ...a); }
    _destroyEnemyProjectile(...a) { return EnemyManager.prototype._destroyEnemyProjectile.call(this, ...a); }
    spawnPoisonTrap(...a) { return EnemyManager.prototype.spawnPoisonTrap.call(this, ...a); }
    spawnSpikeTrap(...a) { return EnemyManager.prototype.spawnSpikeTrap.call(this, ...a); }
    updateFloorTraps(...a) { return EnemyManager.prototype.updateFloorTraps.call(this, ...a); }
    tryDropFromEnemy(...a) { return EnemyManager.prototype.tryDropFromEnemy.call(this, ...a); }
    spawnGroundGlorp(...a) { return EnemyManager.prototype.spawnGroundGlorp.call(this, ...a); }
    spawnHealthPot(...a) { return EnemyManager.prototype.spawnHealthPot.call(this, ...a); }
    spawnUltPot(...a)    { return EnemyManager.prototype.spawnUltPot.call(this, ...a); }
    updateGroundDrops(...a) { return EnemyManager.prototype.updateGroundDrops.call(this, ...a); }
    _collectGroundGlorp(...a) { return EnemyManager.prototype._collectGroundGlorp.call(this, ...a); }
    _collectHealthPot(...a) { return EnemyManager.prototype._collectHealthPot.call(this, ...a); }
    _collectUltPot(...a)    { return EnemyManager.prototype._collectUltPot.call(this, ...a); }

    // WeaponSystem
    shootAttack(...a) { return WeaponSystem.prototype.shootAttack.call(this, ...a); }
    fireEquippedWeapon(...a) { return WeaponSystem.prototype.fireEquippedWeapon.call(this, ...a); }
    flameFistsAttack(...a) { return WeaponSystem.prototype.flameFistsAttack.call(this, ...a); }
    lightningFistsAttack(...a) { return WeaponSystem.prototype.lightningFistsAttack.call(this, ...a); }
    iceFistsAttack(...a) { return WeaponSystem.prototype.iceFistsAttack.call(this, ...a); }
    icicleStaffAttack(...a) { return WeaponSystem.prototype.icicleStaffAttack.call(this, ...a); }
    applyIceFistsHit(...a) { return WeaponSystem.prototype.applyIceFistsHit.call(this, ...a); }
    _updateChillIndicator(...a) { return WeaponSystem.prototype._updateChillIndicator.call(this, ...a); }
    _destroyChillIndicator(...a) { return WeaponSystem.prototype._destroyChillIndicator.call(this, ...a); }
    _triggerShatterBurst(...a) { return WeaponSystem.prototype._triggerShatterBurst.call(this, ...a); }
    _shatterWaterSplash(...a) { return WeaponSystem.prototype._shatterWaterSplash.call(this, ...a); }
    flameSwordAttack(...a) { return WeaponSystem.prototype.flameSwordAttack.call(this, ...a); }
    magmaHammerAttack(...a) { return WeaponSystem.prototype.magmaHammerAttack.call(this, ...a); }
    _magmaExplosion(...a) { return WeaponSystem.prototype._magmaExplosion.call(this, ...a); }
    shootFireball(...a) { return WeaponSystem.prototype.shootFireball.call(this, ...a); }
    shootIceShard(...a) { return WeaponSystem.prototype.shootIceShard.call(this, ...a); }
    spawnIceShardProjectile(...a) { return WeaponSystem.prototype.spawnIceShardProjectile.call(this, ...a); }
    updateIceShards(...a) { return WeaponSystem.prototype.updateIceShards.call(this, ...a); }
    distancePointToSegment(...a) { return WeaponSystem.prototype.distancePointToSegment.call(this, ...a); }
    spawnBounceImpact(...a) { return WeaponSystem.prototype.spawnBounceImpact.call(this, ...a); }
    destroyIceShard(...a) { return WeaponSystem.prototype.destroyIceShard.call(this, ...a); }
    updateFireballs(...a) { return WeaponSystem.prototype.updateFireballs.call(this, ...a); }
    spawnFireballLavaPool(...a) { return WeaponSystem.prototype.spawnFireballLavaPool.call(this, ...a); }

    // CombatSystem
    showCannotSwitchText(...a) { return CombatSystem.prototype.showCannotSwitchText.call(this, ...a); }
    showStatusText(...a) { return CombatSystem.prototype.showStatusText.call(this, ...a); }
    showDamageNumber(...a) { return CombatSystem.prototype.showDamageNumber.call(this, ...a); }
    damageEnemy(...a) { return CombatSystem.prototype.damageEnemy.call(this, ...a); }
    killEnemy(...a) { return CombatSystem.prototype.killEnemy.call(this, ...a); }
    takeDamage(...a) { if (this._devGodMode) return; return CombatSystem.prototype.takeDamage.call(this, ...a); }
    damageBossAtTile(...a) { return CombatSystem.prototype.damageBossAtTile.call(this, ...a); }
    gainUltCharge(...a) { return CombatSystem.prototype.gainUltCharge.call(this, ...a); }
    switchToElement(...a) { return CombatSystem.prototype.switchToElement.call(this, ...a); }
    updateBurnEffects(...a) { return CombatSystem.prototype.updateBurnEffects.call(this, ...a); }
    showBurnVisual(...a) { return CombatSystem.prototype.showBurnVisual.call(this, ...a); }
    clearBurnVisual(...a) { return CombatSystem.prototype.clearBurnVisual.call(this, ...a); }
    applyBrittle(...a) { return CombatSystem.prototype.applyBrittle.call(this, ...a); }
    updateBrittleVisual(...a) { return CombatSystem.prototype.updateBrittleVisual.call(this, ...a); }
    updateBrittleDecay(...a) { return CombatSystem.prototype.updateBrittleDecay.call(this, ...a); }
    freezeEnemy(...a) { return CombatSystem.prototype.freezeEnemy.call(this, ...a); }
    updateSlowEffect(...a) { return CombatSystem.prototype.updateSlowEffect.call(this, ...a); }
    spawnIceSplinter(...a) { return CombatSystem.prototype.spawnIceSplinter.call(this, ...a); }
    snapToNearestFloor(...a) { return CombatSystem.prototype.snapToNearestFloor.call(this, ...a); }
    damageEnemyIce(...a) { return CombatSystem.prototype.damageEnemyIce.call(this, ...a); }
    createFreezeVisual(...a) { return CombatSystem.prototype.createFreezeVisual.call(this, ...a); }
    showShieldBlock(...a) { return CombatSystem.prototype.showShieldBlock.call(this, ...a); }
    fireballSplash(...a) { return CombatSystem.prototype.fireballSplash.call(this, ...a); }
    triggerCombustion(...a) { return CombatSystem.prototype.triggerCombustion.call(this, ...a); }
    spawnIgnitionTrail(...a) { return CombatSystem.prototype.spawnIgnitionTrail.call(this, ...a); }
    updateIgnitionTrails(...a) { return CombatSystem.prototype.updateIgnitionTrails.call(this, ...a); }
    ignitionExplodeEnemy(...a) { return CombatSystem.prototype.ignitionExplodeEnemy.call(this, ...a); }

    // ElementSystem
    activateUlt(...a) { return ElementSystem.prototype.activateUlt.call(this, ...a); }
    activateFireScorch(...a) { return ElementSystem.prototype.activateFireScorch.call(this, ...a); }
    _fireShotgunBurst(...a) { return ElementSystem.prototype._fireShotgunBurst.call(this, ...a); }
    activateIceBlizzard(...a) { return ElementSystem.prototype.activateIceBlizzard.call(this, ...a); }
    deactivateTsunami(...a) { return ElementSystem.prototype.deactivateTsunami.call(this, ...a); }
    updateTsunami(...a) { return ElementSystem.prototype.updateTsunami.call(this, ...a); }
    updateTsunamiPuddles(...a) { return ElementSystem.prototype.updateTsunamiPuddles.call(this, ...a); }
    createTsunamiPuddle(...a) { return ElementSystem.prototype.createTsunamiPuddle.call(this, ...a); }
    activateLightningStorm(...a) { return ElementSystem.prototype.activateLightningStorm.call(this, ...a); }
    updateStormCloud(...a) { return ElementSystem.prototype.updateStormCloud.call(this, ...a); }
    stormCloudAutoAttack(...a) { return ElementSystem.prototype.stormCloudAutoAttack.call(this, ...a); }
    performChainLightningShared(...a) { return ElementSystem.prototype.performChainLightningShared.call(this, ...a); }
    deactivateStormCloud(...a) { return ElementSystem.prototype.deactivateStormCloud.call(this, ...a); }
    throwLightning(...a) { return ElementSystem.prototype.throwLightning.call(this, ...a); }
    updateThunderhead(...a) { return ElementSystem.prototype.updateThunderhead.call(this, ...a); }
    spawnThunderheadTrail(...a) { return ElementSystem.prototype.spawnThunderheadTrail.call(this, ...a); }
    deactivateThunderhead(...a) { return ElementSystem.prototype.deactivateThunderhead.call(this, ...a); }
    applySuperConduct(...a) { return ElementSystem.prototype.applySuperConduct.call(this, ...a); }
    clearSuperConduct(...a) { return ElementSystem.prototype.clearSuperConduct.call(this, ...a); }
    updateSuperConductors(...a) { return ElementSystem.prototype.updateSuperConductors.call(this, ...a); }
    placeLightningNode(...a) { return ElementSystem.prototype.placeLightningNode.call(this, ...a); }
    removeLightningNodeAt(...a) { return ElementSystem.prototype.removeLightningNodeAt.call(this, ...a); }
    cancelNodeChannel(...a) { return ElementSystem.prototype.cancelNodeChannel.call(this, ...a); }
    updateNodeChannel(...a) { return ElementSystem.prototype.updateNodeChannel.call(this, ...a); }
    spawnOrbScrap(...a) { return ElementSystem.prototype.spawnOrbScrap.call(this, ...a); }
    updateOrbScraps(...a) { return ElementSystem.prototype.updateOrbScraps.call(this, ...a); }
    updateNodeCrafting(...a) { return ElementSystem.prototype.updateNodeCrafting.call(this, ...a); }
    finishPlacingNode(...a) { return ElementSystem.prototype.finishPlacingNode.call(this, ...a); }
    activateLightningNode(...a) { return ElementSystem.prototype.activateLightningNode.call(this, ...a); }
    destroyLightningNode(...a) { return ElementSystem.prototype.destroyLightningNode.call(this, ...a); }
    updateLightningNodes(...a) { return ElementSystem.prototype.updateLightningNodes.call(this, ...a); }
    deactivateLightningNode(...a) { return ElementSystem.prototype.deactivateLightningNode.call(this, ...a); }
    drawNodeArc(...a) { return ElementSystem.prototype.drawNodeArc.call(this, ...a); }
    showNodePlacementRing(...a) { return ElementSystem.prototype.showNodePlacementRing.call(this, ...a); }
    clearNodePlacementRing(...a) { return ElementSystem.prototype.clearNodePlacementRing.call(this, ...a); }
    clearNodeMode(...a) { return ElementSystem.prototype.clearNodeMode.call(this, ...a); }
    updateNodePreview(...a) { return ElementSystem.prototype.updateNodePreview.call(this, ...a); }
    _redrawPlacementRing(...a) { return ElementSystem.prototype._redrawPlacementRing.call(this, ...a); }
    clearNodePreview(...a) { return ElementSystem.prototype.clearNodePreview.call(this, ...a); }
    fireArcProjectile(...a) { return ElementSystem.prototype.fireArcProjectile.call(this, ...a); }
    drawOrbProjectile(...a) { return ElementSystem.prototype.drawOrbProjectile.call(this, ...a); }
    updateArcProjectiles(...a) { return ElementSystem.prototype.updateArcProjectiles.call(this, ...a); }
    shootChainLightning(...a) { return ElementSystem.prototype.shootChainLightning.call(this, ...a); }
    performChainLightning(...a) { return ElementSystem.prototype.performChainLightning.call(this, ...a); }
    drawLightningBolt(...a) { return ElementSystem.prototype.drawLightningBolt.call(this, ...a); }
    deployStormField(...a) { return ElementSystem.prototype.deployStormField.call(this, ...a); }
    updateStormField(...a) { return ElementSystem.prototype.updateStormField.call(this, ...a); }
    deactivateStormField(...a) { return ElementSystem.prototype.deactivateStormField.call(this, ...a); }
    addCosmicCharge(...a) { return ElementSystem.prototype.addCosmicCharge.call(this, ...a); }
    startCosmicChanneling(...a) { return ElementSystem.prototype.startCosmicChanneling.call(this, ...a); }
    stopCosmicChanneling(...a) { return ElementSystem.prototype.stopCosmicChanneling.call(this, ...a); }
    updateCosmicChanneling(...a) { return ElementSystem.prototype.updateCosmicChanneling.call(this, ...a); }
    updateCosmicPassiveCharge(...a) { return ElementSystem.prototype.updateCosmicPassiveCharge.call(this, ...a); }
    updateCosmicCharge(...a) { return ElementSystem.prototype.updateCosmicCharge.call(this, ...a); }
    releaseCosmicBeam(...a) { return ElementSystem.prototype.releaseCosmicBeam.call(this, ...a); }
    fireCosmicBeam(...a) { return ElementSystem.prototype.fireCosmicBeam.call(this, ...a); }
    pointToLineDistance(...a) { return ElementSystem.prototype.pointToLineDistance.call(this, ...a); }
    activateCosmicBlackHole(...a) { return ElementSystem.prototype.activateCosmicBlackHole.call(this, ...a); }
    detonateCosmicBomb(...a) { return ElementSystem.prototype.detonateCosmicBomb.call(this, ...a); }
    updateCosmicBlackHoleProjectile(...a) { return ElementSystem.prototype.updateCosmicBlackHoleProjectile.call(this, ...a); }
    deployCosmicBlackHole(...a) { return ElementSystem.prototype.deployCosmicBlackHole.call(this, ...a); }
    updateCosmicBlackHole(...a) { return ElementSystem.prototype.updateCosmicBlackHole.call(this, ...a); }
    updateCosmicMarkVisual(...a) { return ElementSystem.prototype.updateCosmicMarkVisual.call(this, ...a); }
    cosmicDash(...a) { return ElementSystem.prototype.cosmicDash.call(this, ...a); }

    // HUD
    createHUD(...a) { return HUD.prototype.createHUD.call(this, ...a); }
    updateHUD(...a) { return HUD.prototype.updateHUD.call(this, ...a); }
    openPauseMenu(...a) { return HUD.prototype.openPauseMenu.call(this, ...a); }
    closePauseMenu(...a) { return HUD.prototype.closePauseMenu.call(this, ...a); }
    gameOver(...a) { return HUD.prototype.gameOver.call(this, ...a); }
    showDeathScreen(...a) { return HUD.prototype.showDeathScreen.call(this, ...a); }
    _showDeathContent(...a) { return HUD.prototype._showDeathContent.call(this, ...a); }

    // ── DEV PANEL ────────────────────────────────────────────────────────
    _createDevPanel() {
        const W = this.scale.width;
        const PANEL_W = 210, ROW_H = 32, PAD = 10;
        const toggles = [
            { label: 'God Mode',       key: '_devGodMode',       desc: 'No damage taken' },
            { label: 'One-Shot',       key: '_devOneShot',       desc: 'Enemies die in 1 hit' },
            { label: 'Freeze Enemies', key: '_devFreezeEnemies', desc: 'All enemies stop moving' },
            { label: 'Fill Ult',       key: null,                desc: 'Instantly max ult charge', action: () => { this.ultCharge = this.ultChargeMax; this.updateHUD(); } },
            { label: 'Kill All',       key: null,                desc: 'Kill enemies in room',      action: () => { for (const e of [...this.enemies]) { if (this.isInCurrentRoom(e.x, e.y)) this.killEnemy(e); } } },
            { label: 'Max Health',     key: null,                desc: 'Restore full HP',            action: () => { this.health = this.maxHealth; this.updateHUD(); } },
            { label: 'Teleport Mode',  key: '_devTeleportMode',  desc: 'Left-click to warp' },
        ];

        const panelH = PAD * 2 + toggles.length * ROW_H + 28;
        const px = W - PANEL_W - 8, py = 60;

        const panel = this.add.container(0, 0).setScrollFactor(0).setDepth(200);
        this._devPanel = panel;

        // Background
        const bg = this.add.graphics().setScrollFactor(0);
        bg.fillStyle(0x000000, 0.82);
        bg.fillRoundedRect(px, py, PANEL_W, panelH, 6);
        bg.lineStyle(1, 0x44ff44, 0.6);
        bg.strokeRoundedRect(px, py, PANEL_W, panelH, 6);
        panel.add(bg);

        const title = this.add.text(px + PAD, py + PAD, '🛠 DEV MODE', {
            fontSize: '11px', fontFamily: 'monospace', color: '#44ff44', fontStyle: 'bold'
        }).setScrollFactor(0);
        panel.add(title);

        const rows = [];
        toggles.forEach((t, i) => {
            const ry = py + PAD + 24 + i * ROW_H;

            // Hit area
            const hit = this.add.rectangle(px + PAD, ry, PANEL_W - PAD * 2, ROW_H - 4, 0xffffff, 0)
                .setOrigin(0, 0).setScrollFactor(0).setInteractive({ useHandCursor: true });

            // Indicator dot
            const dot = this.add.graphics().setScrollFactor(0);
            const drawDot = (active) => {
                dot.clear();
                dot.fillStyle(active ? 0x44ff44 : 0x334433, 1);
                dot.fillCircle(px + PAD + 6, ry + ROW_H / 2 - 2, 5);
            };
            drawDot(t.key ? this[t.key] : false);

            // Label
            const lbl = this.add.text(px + PAD + 16, ry + 2, t.label, {
                fontSize: '11px', fontFamily: 'monospace', color: '#ccffcc'
            }).setScrollFactor(0);

            // Desc
            const desc = this.add.text(px + PAD + 16, ry + 14, t.desc, {
                fontSize: '9px', fontFamily: 'monospace', color: '#557755'
            }).setScrollFactor(0);

            hit.on('pointerover',  () => lbl.setStyle({ color: '#ffffff' }));
            hit.on('pointerout',   () => lbl.setStyle({ color: '#ccffcc' }));
            hit.on('pointerdown',  () => {
                if (t.action) {
                    t.action();
                    // Flash the dot green briefly for one-shot actions
                    dot.clear();
                    dot.fillStyle(0xffff44, 1);
                    dot.fillCircle(px + PAD + 6, ry + ROW_H / 2 - 2, 5);
                    this.time.delayedCall(300, () => drawDot(false));
                } else {
                    this[t.key] = !this[t.key];
                    drawDot(this[t.key]);
                }
            });

            panel.add([dot, lbl, desc, hit]);
            rows.push({ dot, drawDot, toggle: t });
        });

        // Teleport mode — left-click warps player when _devTeleportMode is on
        // Show a crosshair that follows the cursor when active
        const teleportCursor = this.add.graphics().setScrollFactor(0).setDepth(201).setVisible(false);
        this._devTeleportCursor = teleportCursor;

        const drawCrosshair = (x, y, canPlace) => {
            teleportCursor.clear();
            const col = canPlace ? 0x44ff44 : 0xff4444;
            teleportCursor.lineStyle(1.5, col, 0.9);
            const R = 10, G = 4;
            teleportCursor.beginPath(); teleportCursor.moveTo(x - R, y); teleportCursor.lineTo(x - G, y); teleportCursor.strokePath();
            teleportCursor.beginPath(); teleportCursor.moveTo(x + G, y); teleportCursor.lineTo(x + R, y); teleportCursor.strokePath();
            teleportCursor.beginPath(); teleportCursor.moveTo(x, y - R); teleportCursor.lineTo(x, y - G); teleportCursor.strokePath();
            teleportCursor.beginPath(); teleportCursor.moveTo(x, y + G); teleportCursor.lineTo(x, y + R); teleportCursor.strokePath();
            teleportCursor.strokeCircle(x, y, G - 1);
        };

        this.input.on('pointermove', (p) => {
            if (!this._devTeleportMode) { teleportCursor.setVisible(false); return; }
            const wx = p.x + this.cameras.main.scrollX;
            const wy = p.y + this.cameras.main.scrollY;
            const tx = Math.floor(wx / this.TILE_SIZE);
            const ty = Math.floor(wy / this.TILE_SIZE);
            const canPlace = this.world[tx]?.[ty] === this.FLOOR;
            teleportCursor.setVisible(true);
            drawCrosshair(p.x, p.y, canPlace);
        });

        this.input.on('pointerdown', (p) => {
            if (!this._devTeleportMode || p.button !== 0) return;
            const wx = p.x + this.cameras.main.scrollX;
            const wy = p.y + this.cameras.main.scrollY;
            const tx = Math.floor(wx / this.TILE_SIZE);
            const ty = Math.floor(wy / this.TILE_SIZE);
            if (this.world[tx]?.[ty] === this.FLOOR) {
                this.playerX = tx; this.playerY = ty;
                const ppx = tx * this.TILE_SIZE + this.TILE_SIZE / 2;
                const ppy = ty * this.TILE_SIZE + this.TILE_SIZE / 2;
                this.player.x = ppx; this.player.y = ppy;
                this.cameras.main.centerOn(ppx, ppy);
            }
        });

        // Hint text at bottom
        const hint = this.add.text(px + PAD, py + panelH - PAD - 10,
            '` to toggle panel', {
            fontSize: '8px', fontFamily: 'monospace', color: '#335533'
        }).setScrollFactor(0);
        panel.add(hint);

        // Start hidden — show with backtick
        panel.setVisible(false);
    }

    // Override damageEnemy to support one-shot dev toggle
    damageEnemy(enemy, damage) {
        if (this._devOneShot) {
            return EnemyManager.prototype.damageEnemy
                ? CombatSystem.prototype.damageEnemy.call(this, enemy, enemy.health + 1)
                : CombatSystem.prototype.damageEnemy.call(this, enemy, 99999);
        }
        return CombatSystem.prototype.damageEnemy.call(this, enemy, damage);
    }
}


// ─── LEVEL SELECT SCENE ────────────────────────────────────────────────────