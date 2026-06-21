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
        this.load.spritesheet('slime_purple', 'assets/Slime_Purple_32x32.png', {
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

        // Kill all lingering tweens (prevents stuck player animation from previous run)
        this.tweens.killAll();

        // Reset death/pause flags — these block input if left over from previous run
        this._deathScreenActive = false;
        this._pauseMenuOpen     = false;

        // Remove any extra cameras added by the death screen
        this.cameras.cameras.slice(1).forEach(c => this.cameras.remove(c));
        this.cameras.main.resetFX();
        this.cameras.main.fadeIn(200);

        // Destroy orphaned icicle bar/pip objects from previous run
        if (this._icicleBarBg)    { this._icicleBarBg.destroy();    this._icicleBarBg    = null; }
        if (this._icicleBarFill)  { this._icicleBarFill.destroy();  this._icicleBarFill  = null; }
        if (this._icicleHealBg)   { this._icicleHealBg.destroy();   this._icicleHealBg   = null; }
        if (this._icicleHealFill) { this._icicleHealFill.destroy(); this._icicleHealFill = null; }
        if (this._icicleBarLabel) { this._icicleBarLabel.destroy(); this._icicleBarLabel = null; }
        if (this._icicleHealLabel){ this._icicleHealLabel.destroy();this._icicleHealLabel= null; }
        if (this._iciclePips) {
            for (const p of this._iciclePips) p.destroy();
            this._iciclePips = null;
        }
        if (this._iciclePipBg)    { this._iciclePipBg.destroy();    this._iciclePipBg    = null; }
        if (this._iciclePipLabel) { this._iciclePipLabel.destroy(); this._iciclePipLabel = null; }

        // Reset icicle cannon counter
        this._icicleHitCounter    = 0;
        this._iciclePrevCount     = 0;
        this._iciclePipsWereFull  = false;
        this._icicleHealModeActive = false;
        if (this._icicleAccuracyCircle) { this._icicleAccuracyCircle.destroy(); this._icicleAccuracyCircle = null; }

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
        this._lastDisplayedRoom      = -1; // tracks last room we showed a name for
        this.isIceTutorial           = false;
        this.isLightningTutorial     = false;
        this.isLevel2                = false;
        this.isLevel3                = false;
        this.isLevel4                = false;
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
        // Crumble tile system (Level 4)
        this._crumbleTiles = new Map(); // key: 'x,y' → { state, gfx, timer, x, y }
        // state: 'cracking' | 'broken' | 'restoring'

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

        // Ult stages — loaded from shop
        this.ultStage_fire      = parseInt(localStorage.getItem('ultStage_fire')      || '1');
        this.ultStage_ice       = parseInt(localStorage.getItem('ultStage_ice')       || '1');
        this.ultStage_lightning = parseInt(localStorage.getItem('ultStage_lightning') || '1');
        this.ultStage_cosmic    = parseInt(localStorage.getItem('ultStage_cosmic')    || '1');
        this._iceUltDomainActive  = false;
        this._iceUltDetonate      = null;
        this._iceUltSweepsFired   = 0;
        this._lightningUltSentries = null;
        this._level3KeysCollected  = 0;
        this._voidKeys             = [];
        this._bossDoor             = null;
        this._bossDoorLastTry      = 0;

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
        this.thunderheadGlideSpeed = 160; // px/s
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
        if (!this.anims.exists('purple_idle')) this.anims.create({
            key: 'purple_idle',
            frames: [
                { key: 'slime_purple', frame: 0 },
                { key: 'slime_purple', frame: 18 }
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
        if (this.isLevel4) this._renderCrumbleZones();

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
        this._cosmicDashTilesLog = []; // [{time}] — one entry per tile traversed in a dash
        this._singTilesTraversed = 0;  // cumulative tiles walked/dashed — feeds singularity speed
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
        this.ultChargePerBurnTick = 1.2;     // fire burn tick
        this.ultChargePerLightningHit = 4.0; // lightning fist direct hit
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

        // Magma staff state
        this._magmaRippleCharge    = 0;
        this._magmaRippleMaxCharge = 12000; // 12 seconds
        this._magmaRippleReady     = false;
        this._magmaStaffFireballCount = undefined;
        this._magmaRippleBarBg     = null;
        this._magmaRippleBarFill   = null;
        this._magmaRippleLabel     = null;
        this._magmaOrbGraphics     = [];
        this._magmaOrbCount        = 0;

        // E key to activate ult
        this.input.keyboard.on('keydown-E', () => {
            // If black hole projectile is in flight, E detonates it
            if (this.cosmicBlackHoleProjectile) {
                this.detonateCosmicBomb();
                return;
            }
            // Ice domain E detonation (stage 2+)
            const iceUltStage = parseInt(localStorage.getItem('ultStage_ice') || '1');
            if (this.currentElement === 'ice' && this._iceUltDomainActive && this._iceUltDetonate && iceUltStage >= 2) {
                this._iceUltDetonate();
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
        this.input.keyboard.on('keydown-SPACE', () => { /* cosmic beam sidelined */ });

        // Cosmic dash: hold Shift to charge, release to dash in last moved direction
        this.shiftKey = this.input.keyboard.addKey('SHIFT');

        this.input.keyboard.on('keyup-SPACE', () => { /* cosmic beam sidelined */ });

        // F key — cosmic charge channeling (sidelined)
        this.input.keyboard.on('keydown-F', () => { /* cosmic channeling sidelined */ });
        this.input.keyboard.on('keyup-F', () => { /* cosmic channeling sidelined */ });
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
        this.lightningOrbs    = []; // orb emitter orbs
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

            // Level 4 — during surface window, clicks ON the active weak point route to
            // the rhythm system. Clicks elsewhere fall through to normal weapon fire.
            if (this.isLevel4 && this.fractureCore?._surfaced && this._fractureWeakPoints?.length) {
                const worldX = pointer.x + this.cameras.main.scrollX;
                const worldY = pointer.y + this.cameras.main.scrollY;
                if (this._isClickOnActiveWeakPoint(worldX, worldY)) {
                    this._tryHitCurrentWeakPoint(worldX, worldY);
                    return;
                }
                // not on the weak point — fall through to normal combat below
            }

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
                    this.fireEquippedWeapon(pointer.x, pointer.y);
                }
                return;
            }

            // Collapse decay phase — click launches orbs instead of firing
            if (this._collapseDecaying &&
                (this.equippedWeapons?.cosmic || 'cosmic_fists') === 'singularity_staff') {
                this.singularityCollapseRelease(pointer.x, pointer.y);
                return;
            }

            this.isPointerDown = true;
            this.pointerX = pointer.x;
            this.pointerY = pointer.y;
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

        // R key — remove lightning nodes OR fire magma staff ripple
        this.input.keyboard.on('keydown-R', () => {
            if (this.currentElement === 'lightning' && this.lightningNodeMode) {
                const worldX = this.pointerX + this.cameras.main.scrollX;
                const worldY = this.pointerY + this.cameras.main.scrollY;
                const tileX = Math.floor(worldX / this.TILE_SIZE);
                const tileY = Math.floor(worldY / this.TILE_SIZE);
                if (!this.removeLightningNodeAt(tileX, tileY)) {
                    let best = null, bestDist = 3;
                    for (const n of [...this.lightningNodes, ...this.lightningNodesCrafting]) {
                        const d = Math.abs(n.tileX - tileX) + Math.abs(n.tileY - tileY);
                        if (d < bestDist) { bestDist = d; best = n; }
                    }
                    if (best) this.removeLightningNodeAt(best.tileX, best.tileY);
                }
                return;
            }
            // Singularity staff collapse
            if (this.currentElement === 'cosmic' &&
                (this.equippedWeapons?.cosmic || 'cosmic_fists') === 'singularity_staff') {
                this.singularityCollapseActivate();
                return;
            }
            // Magma staff surge
            if (this.currentElement === 'fire' &&
                (this.equippedWeapons?.fire || 'flame_fists') === 'magma_staff') {
                this.magmaStaffRipple();
                return;
            }
            // Icicle cannon heal mode — toggle on/off if charge bar is full
            if (this.currentElement === 'ice' &&
                (this.equippedWeapons?.ice || 'ice_fists') === 'icicle_cannon') {
                const HITS_TO_CHARGE = 28;
                if ((this._icicleHitCounter || 0) >= HITS_TO_CHARGE) {
                    this._icicleHealModeActive = !this._icicleHealModeActive;
                    if (this._icicleHealModeActive) {
                        this.showStatusText(this.player.x, this.player.y - 30, '✦ HEAL READY', '#00ff88');
                        this.cameras.main.shake(40, 0.002);
                    } else {
                        this.showStatusText(this.player.x, this.player.y - 30, 'HEAL OFF', '#336655');
                    }
                    this._updateIcicleChargeBar();
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
        if (this.isLevel3) {
            try { this.updateLevel3(time); }
            catch (e) { console.error('Level 3 error:', e); }
            this.updateVoidRipples(delta);
        }
        if (this.isLevel4) {
            try { this.updateLevel4(time, delta); }
            catch (e) { console.error('Level 4 error:', e); }
            this._updateCrumbleTiles(time);
        }
        // Voltslime boss
        if (this.voltslimeBoss?.active) {
            this.updateVoltslimeBoss(time, delta);
        }

        const preUpdatePlayerX = this.playerX;
        const preUpdatePlayerY = this.playerY;

        if (this.currentElement === 'cosmic' && this.shiftKey.isDown && !this.shiftWasDown) {
            // Use stored pointer + scroll for guaranteed world coords
            const mouseWorldX = this.pointerX + this.cameras.main.scrollX;
            const mouseWorldY = this.pointerY + this.cameras.main.scrollY;
            const playerCenterX = this.playerX * this.TILE_SIZE + this.TILE_SIZE / 2;
            const playerCenterY = this.playerY * this.TILE_SIZE + this.TILE_SIZE / 2;

            const ddx = mouseWorldX - playerCenterX;
            const ddy = mouseWorldY - playerCenterY;

            let dirX = 0, dirY = 0;
            if (Math.abs(ddx) > Math.abs(ddy)) dirX = ddx > 0 ? 1 : -1;
            else dirY = ddy > 0 ? 1 : -1;

            const preDashX = this.playerX, preDashY = this.playerY;
            this.cosmicDash(dirX, dirY, preUpdatePlayerX, preUpdatePlayerY);

            // Log each tile traversed for cosmic fists momentum
            const tilesMoved = Math.abs(this.playerX - preDashX) + Math.abs(this.playerY - preDashY);
            if (!this._cosmicDashTilesLog) this._cosmicDashTilesLog = [];
            const now = this.time.now;
            for (let t = 0; t < tilesMoved; t++) this._cosmicDashTilesLog.push({ time: now });
            this._cosmicDashTilesLog = this._cosmicDashTilesLog.filter(e => now - e.time < 2000);
                this._singTilesTraversed = (this._singTilesTraversed || 0) + tilesMoved;
        }
        this.shiftWasDown = this.shiftKey.isDown;

        if (time - this.lastMoveTime >= this.moveCooldown) {
            let dx = 0, dy = 0;

            const isCosmicCharging = this.currentElement === 'cosmic' && this.cosmicCharging;

            if (!isCosmicCharging && !this.thunderheadActive && !this._playerRooted) {
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

                    // Level 4 — crack tiles are impassable for the player while dormant
                    if (this.isLevel4 && this._cracks?.length && this.fractureCore?.active && !this.fractureCore._surfaced) {
                        const targetWx = newX * this.TILE_SIZE + this.TILE_SIZE / 2;
                        const targetWy = newY * this.TILE_SIZE + this.TILE_SIZE / 2;
                        if (this._isInCrack(targetWx, targetWy)) {
                            this.showStatusText(this.player.x, this.player.y - 28, 'IMPASSABLE', '#ff8844');
                            this.lastMoveTime = time;
                            return;
                        }
                    }

                    // Tutorial: if the target tile is a sealed door tile, block and flash it
                    if ((this.isTutorial || this.isLevel2 || this.isLevel3 || this.isLevel4) && this.lockedDoorTiles) {
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
                    this._singTilesTraversed = (this._singTilesTraversed || 0) + 1;
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
                    this._checkRoomNameDisplay();
                    if (this.isLevel4) this._onPlayerStepCrumble(this.playerX, this.playerY);
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
                const spd = this.thunderheadGlideSpeed * (delta / 1000); // speed is px/s
                const nx = this.thunderheadGlideX + (gdx / len) * spd;
                const ny = this.thunderheadGlideY + (gdy / len) * spd;

                // Kill any tile-movement tweens that would fight the glide
                this.tweens.killTweensOf(this.player);

                // Pixel-accurate wall check: test leading edge (half-tile radius ahead)
                const RADIUS = this.TILE_SIZE * 0.35;
                const checkX = nx + (gdx / len) * RADIUS;
                const checkY = ny + (gdy / len) * RADIUS;
                const ntx = Math.floor(checkX / this.TILE_SIZE);
                const nty = Math.floor(checkY / this.TILE_SIZE);
                const inBounds = ntx >= 0 && ntx < this.WORLD_WIDTH && nty >= 0 && nty < this.WORLD_HEIGHT;
                const passable = inBounds && (this.world[ntx][nty] === this.FLOOR) && !this.isInLockedRoom(ntx, nty);

                if (passable) {
                    this.thunderheadGlideX = nx;
                    this.thunderheadGlideY = ny;
                    this.playerX = Math.floor(nx / this.TILE_SIZE);
                    this.playerY = Math.floor(ny / this.TILE_SIZE);
                    this.player.x = nx;
                    this.player.y = ny + this.SLIME_Y_OFFSET;
                    this.updateHUD();
                    this._checkRoomNameDisplay();
                    if (this.isLevel4) this._onPlayerStepCrumble(this.playerX, this.playerY);
                }
            }
        }

        this.updateTsunamiPuddles(time);
        if (!this._devFreezeEnemies) this.moveEnemies();
        if (this.isLevel3) this.updateVoidSniperBolts(delta);

        if (!this.isIdling && time - this.lastMoveTime > this.idleDelay) {
            this.player.play('idle');
            this.isIdling = true;
        }

        if (this.isPointerDown) {
            if (this.currentElement === 'lightning' && !this.lightningNodeMode &&
                (this.equippedWeapons?.lightning || 'lightning_fists') !== 'lightning_fists') {
                this.fireEquippedWeapon(this.pointerX, this.pointerY);
            } else {
                this.fireEquippedWeapon(this.pointerX, this.pointerY);
            }
        }
        this.updateFireballs(delta);
        this.updateLightningOrbs(delta);
        this.updateSingularityStaff(delta);
        this.updateCollapseMode(delta);

        // Magma staff ripple charge — only accrues when staff is equipped on fire
        if (this.currentElement === 'fire' &&
            (this.equippedWeapons?.fire || 'flame_fists') === 'magma_staff') {
            if (!this._magmaRippleReady) {
                this._magmaRippleCharge = Math.min(
                    this._magmaRippleMaxCharge,
                    (this._magmaRippleCharge || 0) + delta
                );
                if (this._magmaRippleCharge >= this._magmaRippleMaxCharge) {
                    this._magmaRippleReady = true;
                }
            }
            this._updateMagmaRippleBar();
        } else {
            // Clean up bar if not on fire/staff
            if (this._magmaRippleBarBg) this._updateMagmaRippleBar();
        }
        // Orbiting fire orbs — always update so they fade out when switching away
        this._updateMagmaOrbs(time);
        this._updateIcicleAccuracyCircle(this.pointerX || 0, this.pointerY || 0);
        this.updateUltAbsorbers(time);
        this.updateBurnEffects(time);
        this.updateIgnitionTrails(time);
        this.updateIceShards(delta);
        this.updateBrittleDecay(time);
        this.updateLightningNodes(time);
        this.updateRangedEnemies(time);
        this.updateEnemyProjectiles(delta);
        this.updateFloorTraps(time);
        this.updateGroundDrops();
        this.updatePortals(time);
        this.updateSuperConductors(time);
        this.updateNodeCrafting(time);
        this.updateNodeChannel(time);
        this.updateOrbScraps();

        // Icicle cannon bars — reposition every frame to follow player
        if (this.player && (this._icicleBarBg || this._icicleHealBg)) {
            const BAR_W = 44;
            const bx = this.player.x;
            const by = this.player.y - 28;
            if (this._icicleBarBg)    { this._icicleBarBg.x    = bx;              this._icicleBarBg.y    = by; }
            if (this._icicleBarFill)  { this._icicleBarFill.x  = bx - BAR_W / 2; this._icicleBarFill.y  = by; }
            if (this._icicleBarLabel) { this._icicleBarLabel.x = bx;              this._icicleBarLabel.y = by + 6; }
            if (this._icicleHealBg)   { this._icicleHealBg.x   = bx;              this._icicleHealBg.y   = by - 7; }
            if (this._icicleHealFill) { this._icicleHealFill.x = bx - BAR_W / 2; this._icicleHealFill.y = by - 7; }
            if (this._icicleHealLabel){ this._icicleHealLabel.x= bx;              this._icicleHealLabel.y= by - 7 - 5; }
            if (this._icicleReadyText){ this._icicleReadyText.x = bx; }
            // Also update heal mode bar width each frame (timer depletes in real-time)
            const isCannon = this.currentElement === 'ice' &&
                (this.equippedWeapons?.ice || 'ice_fists') === 'icicle_cannon';
            if (isCannon && typeof HUD !== 'undefined') {
                HUD.prototype.updateIcicleChargeBar.call(this);
            }
        }
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
    generateLevel3(...a) { return WorldGen.prototype.generateLevel3.call(this, ...a); }
    generateLevel4(...a) { return WorldGen.prototype.generateLevel4.call(this, ...a); }
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
    // Level 3 proxies
    updateLevel3(...a)           { return LevelManager.prototype.updateLevel3.call(this, ...a); }
    // Level 4 proxies
    updateLevel4(...a)           { return LevelManager.prototype.updateLevel4.call(this, ...a); }
    spawnLevel4Enemies(...a)     { return LevelManager.prototype.spawnLevel4Enemies.call(this, ...a); }
    _spawnLevel4ChestRooms(...a) { return LevelManager.prototype._spawnLevel4ChestRooms.call(this, ...a); }
    _level4RoomClear(...a)       { return LevelManager.prototype._level4RoomClear.call(this, ...a); }
    spawnFractureCoreStub(...a)  { return LevelManager.prototype.spawnFractureCoreStub.call(this, ...a); }
    _spawnFractureCore(...a)     { return LevelManager.prototype._spawnFractureCore.call(this, ...a); }
    _updateFractureCore(...a)    { return LevelManager.prototype._updateFractureCore.call(this, ...a); }
    damageFractureCore(...a)     { return LevelManager.prototype.damageFractureCore.call(this, ...a); }
    _updateCracks(...a)          { return LevelManager.prototype._updateCracks.call(this, ...a); }
    _isInCrack(...a)             { return LevelManager.prototype._isInCrack.call(this, ...a); }
    _closestPointOnCrack(...a)   { return LevelManager.prototype._closestPointOnCrack.call(this, ...a); }
    _crackMidpoint(...a)         { return LevelManager.prototype._crackMidpoint.call(this, ...a); }
    _generateCrackPoints(...a)   { return LevelManager.prototype._generateCrackPoints.call(this, ...a); }
    _drawWeakPointInner(...a)     { return LevelManager.prototype._drawWeakPointInner.call(this, ...a); }
    _drawWeakPointRing(...a)      { return LevelManager.prototype._drawWeakPointRing.call(this, ...a); }
    _drawWeakPointRing2(...a)     { return LevelManager.prototype._drawWeakPointRing2.call(this, ...a); }
    _activateWeakPoint(...a)      { return LevelManager.prototype._activateWeakPoint.call(this, ...a); }
    _updateWeakPointBar(...a)     { return LevelManager.prototype._updateWeakPointBar.call(this, ...a); }
    _shrinkCrack(...a)            { return LevelManager.prototype._shrinkCrack.call(this, ...a); }
    _crackWiden(...a)              { return LevelManager.prototype._crackWiden.call(this, ...a); }
    _tryBreakCrackPulse(...a)     { return LevelManager.prototype._tryBreakCrackPulse.call(this, ...a); }
    _hitFractureWeakPoint(...a)   { return LevelManager.prototype._hitFractureWeakPoint.call(this, ...a); }
    _tryHitCurrentWeakPoint(...a) { return LevelManager.prototype._tryHitCurrentWeakPoint.call(this, ...a); }
    _isClickOnActiveWeakPoint(...a) { return LevelManager.prototype._isClickOnActiveWeakPoint.call(this, ...a); }
    _crackPhaseUp(...a)           { return LevelManager.prototype._crackPhaseUp.call(this, ...a); }
    _pushPlayerOutOfCracks(...a)  { return LevelManager.prototype._pushPlayerOutOfCracks.call(this, ...a); }
    _initCracks(...a)             { return LevelManager.prototype._initCracks.call(this, ...a); }
    _addCrack(...a)               { return LevelManager.prototype._addCrack.call(this, ...a); }
    _crackPulseWave(...a)         { return LevelManager.prototype._crackPulseWave.call(this, ...a); }
    _tickCrackPulses(...a)        { return LevelManager.prototype._tickCrackPulses.call(this, ...a); }
    _crackSpawnBurst(...a)        { return LevelManager.prototype._crackSpawnBurst.call(this, ...a); }
    _fractureCoreSurface(...a)    { return LevelManager.prototype._fractureCoreSurface.call(this, ...a); }
    _updateSurfaceWindow(...a)    { return LevelManager.prototype._updateSurfaceWindow.call(this, ...a); }
    _spawnNewCrack(...a)          { return LevelManager.prototype._spawnNewCrack.call(this, ...a); }
    _voidMawHop(...a)             { return LevelManager.prototype._voidMawHop.call(this, ...a); }
    _drawCrackPulseWave(...a)     { return LevelManager.prototype._drawCrackPulseWave.call(this, ...a); }
    _showRhythmSessionBanner(...a){ return LevelManager.prototype._showRhythmSessionBanner.call(this, ...a); }
    _gradeColor(...a)             { return LevelManager.prototype._gradeColor.call(this, ...a); }
    _worseGrade(...a)             { return LevelManager.prototype._worseGrade.call(this, ...a); }
    _gradeForDiff(...a)            { return LevelManager.prototype._gradeForDiff.call(this, ...a); }
    _resolveWeakPoint(...a)        { return LevelManager.prototype._resolveWeakPoint.call(this, ...a); }
    _fractureCoreSurfaceAbort(...a){ return LevelManager.prototype._fractureCoreSurfaceAbort.call(this, ...a); }
    _gradeWeight(...a)             { return LevelManager.prototype._gradeWeight.call(this, ...a); }
    _fractureCoreSubmerge(...a)   { return LevelManager.prototype._fractureCoreSubmerge.call(this, ...a); }
    _fractureCoreNextAttack(...a){ return LevelManager.prototype._fractureCoreNextAttack.call(this, ...a); }
    _fractureCoreDoAttack(...a)  { return LevelManager.prototype._fractureCoreDoAttack.call(this, ...a); }
    _fractureCorePhase2Transition(...a){ return LevelManager.prototype._fractureCorePhase2Transition.call(this, ...a); }
    _fractureCorePhase3Transition(...a){ return LevelManager.prototype._fractureCorePhase3Transition.call(this, ...a); }
    _fractureCoreKill(...a)      { return LevelManager.prototype._fractureCoreKill.call(this, ...a); }
    createMortar(...a)           { return EnemyManager.prototype.createMortar.call(this, ...a); }
    createSplitter(...a)         { return EnemyManager.prototype.createSplitter.call(this, ...a); }
    createRooter(...a)           { return EnemyManager.prototype.createRooter.call(this, ...a); }
    createAnchorSlime(...a)      { return EnemyManager.prototype.createAnchorSlime.call(this, ...a); }
    createHealerTotem(...a)      { return EnemyManager.prototype.createHealerTotem.call(this, ...a); }
    createUpgradedSniper(...a)   { return EnemyManager.prototype.createUpgradedSniper.call(this, ...a); }
    _fireMortarShot(...a)        { return EnemyManager.prototype._fireMortarShot.call(this, ...a); }
    _fireRootTendril(...a)       { return EnemyManager.prototype._fireRootTendril.call(this, ...a); }
    _rooterGroundThump(...a)     { return EnemyManager.prototype._rooterGroundThump.call(this, ...a); }
    _triggerSplitterDeath(...a)  { return EnemyManager.prototype._triggerSplitterDeath.call(this, ...a); }
    _fireRicochetArrow(...a)     { return EnemyManager.prototype._fireRicochetArrow.call(this, ...a); }
    _fireSniperShotgun(...a)     { return EnemyManager.prototype._fireSniperShotgun.call(this, ...a); }
    _spawnSniperPortal(...a)     { return LevelManager.prototype._spawnSniperPortal.call(this, ...a); }
    _closeSniperPortal(...a)     { return LevelManager.prototype._closeSniperPortal.call(this, ...a); }
    _level3RoomClear(...a)       { return LevelManager.prototype._level3RoomClear.call(this, ...a); }
    _spawnVoidKey(...a)          { return LevelManager.prototype._spawnVoidKey.call(this, ...a); }
    _spawnBossDoor(...a)         { return LevelManager.prototype._spawnBossDoor.call(this, ...a); }
    _tryUnlockBossDoor(...a)     { return LevelManager.prototype._tryUnlockBossDoor.call(this, ...a); }
    _collectVoidKey(...a)        { return LevelManager.prototype._collectVoidKey.call(this, ...a); }
    spawnLevel3Enemies(...a)     { return LevelManager.prototype.spawnLevel3Enemies.call(this, ...a); }
    _spawnLevel3ChestRooms(...a) { return LevelManager.prototype._spawnLevel3ChestRooms.call(this, ...a); }
    spawnVoidSovereignBoss(...a) { return LevelManager.prototype.spawnVoidSovereignBoss.call(this, ...a); }
    damageVoidSovereignBoss(...a){ return LevelManager.prototype.damageVoidSovereignBoss.call(this, ...a); }
    _freezeVoidSovereign(...a)  { return LevelManager.prototype._freezeVoidSovereign.call(this, ...a); }
    _thawVoidSovereign(...a)    { return LevelManager.prototype._thawVoidSovereign.call(this, ...a); }
    updateVoidRipples(...a)      { return LevelManager.prototype.updateVoidRipples.call(this, ...a); }
    createLightningElemental(...a){ return LevelManager.prototype.createLightningElemental.call(this, ...a); }
    _spawnLightningMark(...a)    { return LevelManager.prototype._spawnLightningMark.call(this, ...a); }
    createVoidSniper(...a)       { return LevelManager.prototype.createVoidSniper.call(this, ...a); }
    createSingularitySlime(...a) { return LevelManager.prototype.createSingularitySlime.call(this, ...a); }
    _vsAttackSingularitySlimes(...a) { return LevelManager.prototype._vsAttackSingularitySlimes.call(this, ...a); }
    _spawnVoidMark(...a)         { return LevelManager.prototype._spawnVoidMark.call(this, ...a); }
    createBerserker(...a)        { return EnemyManager.prototype.createBerserker.call(this, ...a); }
    _startSpeedIndicator(...a)   { return EnemyManager.prototype._startSpeedIndicator.call(this, ...a); }
    _spawnSpeedArrow(...a)       { return EnemyManager.prototype._spawnSpeedArrow.call(this, ...a); }
    _berserkerSwing(...a)        { return EnemyManager.prototype._berserkerSwing.call(this, ...a); }
    createQueenSlimePortal(...a) { return LevelManager.prototype.createQueenSlimePortal.call(this, ...a); }
    _rootPlayer(...a)            { return LevelManager.prototype._rootPlayer.call(this, ...a); }
    _voidSovereignNextAttack(...a){ return LevelManager.prototype._voidSovereignNextAttack.call(this, ...a); }
    _voidSovereignDoAttack(...a) { return LevelManager.prototype._voidSovereignDoAttack.call(this, ...a); }
    _vsAttackVoidMines(...a)     { return LevelManager.prototype._vsAttackVoidMines.call(this, ...a); }
    _vsAttackSingularitySlimes(...a) { return LevelManager.prototype._vsAttackSingularitySlimes.call(this, ...a); }
    _vsAttackLaserCross(...a)    { return LevelManager.prototype._vsAttackLaserCross.call(this, ...a); }
    _vsAttackDarkFragments(...a) { return LevelManager.prototype._vsAttackDarkFragments.call(this, ...a); }
    _vsAttackStomp(...a)         { return LevelManager.prototype._vsAttackStomp.call(this, ...a); }
    _vsAttackSingularityCollapse(...a){ return LevelManager.prototype._vsAttackSingularityCollapse.call(this, ...a); }
    _vsAttackEventHorizon(...a)  { return LevelManager.prototype._vsAttackEventHorizon.call(this, ...a); }
    _vsAttackVoidMaw(...a)        { return LevelManager.prototype._vsAttackVoidMaw.call(this, ...a); }
    _fireVoidMawShotgun(...a)     { return LevelManager.prototype._fireVoidMawShotgun.call(this, ...a); }
    _voidSovereignPhase2Transition(...a){ return LevelManager.prototype._voidSovereignPhase2Transition.call(this, ...a); }
    _voidSovereignDeath(...a)    { return LevelManager.prototype._voidSovereignDeath.call(this, ...a); }
    _spawnVoidRipple(...a)       { return LevelManager.prototype._spawnVoidRipple.call(this, ...a); }
    _voidMineDetonate(...a)      { return LevelManager.prototype._voidMineDetonate.call(this, ...a); }
    _updateVoidSovereign(...a)   { return LevelManager.prototype._updateVoidSovereign.call(this, ...a); }
    _showCosmicTutorial(...a)    { return LevelManager.prototype._showCosmicTutorial.call(this, ...a); }
    _drawVoidCrown(...a)         { return LevelManager.prototype._drawVoidCrown.call(this, ...a); }
    spawnVoltslimeBoss(...a)    { return LevelManager.prototype.spawnVoltslimeBoss.call(this, ...a); }
    _voltslimeNextPhase(...a)   { return LevelManager.prototype._voltslimeNextPhase.call(this, ...a); }
    _voltslimeSlam(...a)        { return LevelManager.prototype._voltslimeSlam.call(this, ...a); }
    _voltslimeScatter(...a)     { return LevelManager.prototype._voltslimeScatter.call(this, ...a); }
    _voltslimeHoming(...a)      { return LevelManager.prototype._voltslimeHoming.call(this, ...a); }
    _voltslimeSpawner(...a)     { return LevelManager.prototype._voltslimeSpawner.call(this, ...a); }
    _voltslimeSpiral(...a)      { return LevelManager.prototype._voltslimeSpiral.call(this, ...a); }
    updateVoltslimeBoss(...a)   { return LevelManager.prototype.updateVoltslimeBoss.call(this, ...a); }
    damageVoltslimeBoss(...a)   { return LevelManager.prototype.damageVoltslimeBoss.call(this, ...a); }
    _killVoltslimeBoss(...a)    { return LevelManager.prototype._killVoltslimeBoss.call(this, ...a); }
    _voltslimeRicochet(...a)    { return LevelManager.prototype._voltslimeRicochet.call(this, ...a); }
    freezeVoltslime(...a)       { return LevelManager.prototype.freezeVoltslime.call(this, ...a); }
    _thawVoltslime(...a)        { return LevelManager.prototype._thawVoltslime.call(this, ...a); }
    freezeBossFromIceWeapon(...a) { return LevelManager.prototype.freezeBossFromIceWeapon.call(this, ...a); }
    spawnFinalLevelChest(...a)  { return LevelManager.prototype.spawnFinalLevelChest.call(this, ...a); }
    openFinalLevelChest(...a)   { return LevelManager.prototype.openFinalLevelChest.call(this, ...a); }
    _showElementUnlockCinematic(...a) { return LevelManager.prototype._showElementUnlockCinematic.call(this, ...a); }
    onGlorpsCollected(...a) { return TutorialManager.prototype.onGlorpsCollected.call(this, ...a); }
    isInLockedRoom(...a) { return LevelManager.prototype.isInLockedRoom.call(this, ...a); }
    getCurrentPlayerRoom(...a) { return LevelManager.prototype.getCurrentPlayerRoom.call(this, ...a); }
    onTutorialRoomEnter(...a) { return TutorialManager.prototype.onTutorialRoomEnter.call(this, ...a); }
    _onIceTutorialRoomEnter(...a) { return TutorialManager.prototype._onIceTutorialRoomEnter.call(this, ...a); }
    _triggerIceImmuneGlerpReaction(...a) { return TutorialManager.prototype._triggerIceImmuneGlerpReaction.call(this, ...a); }
    startTutorialIntro(...a) { return TutorialManager.prototype.startTutorialIntro.call(this, ...a); }
    showNameInput(...a) { return TutorialManager.prototype.showNameInput.call(this, ...a); }
    continueAfterName(...a) { return TutorialManager.prototype.continueAfterName.call(this, ...a); }
    spawnTutorialGlorps(...a) { return TutorialManager.prototype.spawnTutorialGlorps.call(this, ...a); }
    _buildGlorpContainer(...a) { return TutorialManager.prototype._buildGlorpContainer.call(this, ...a); }
    onTutorialRoomClear(...a) { return TutorialManager.prototype.onTutorialRoomClear.call(this, ...a); }
    isInCurrentRoom(...a) { return LevelManager.prototype.isInCurrentRoom.call(this, ...a); }
    getPortalAt(...a) { return LevelManager.prototype.getPortalAt.call(this, ...a); }
    lockTutorialDoors(...a) { return LevelManager.prototype.lockTutorialDoors.call(this, ...a); }
    unlockTutorialDoors(...a) { return LevelManager.prototype.unlockTutorialDoors.call(this, ...a); }
    spawnTutorialChest(...a) { return TutorialManager.prototype.spawnTutorialChest.call(this, ...a); }
    openTutorialChest(...a) { return TutorialManager.prototype.openTutorialChest.call(this, ...a); }
    spawnTutorialPortalPit(...a) { return TutorialManager.prototype.spawnTutorialPortalPit.call(this, ...a); }
    checkTutorialPitCollision(...a) { return TutorialManager.prototype.checkTutorialPitCollision.call(this, ...a); }
    startTutorialVoidFall(...a) { return TutorialManager.prototype.startTutorialVoidFall.call(this, ...a); }
    playVoidFallScene(...a) { return TutorialManager.prototype.playVoidFallScene.call(this, ...a); }
    endTutorialReturnToMenu(...a) { return TutorialManager.prototype.endTutorialReturnToMenu.call(this, ...a); }
    showTutorialDialogue(...a) { return TutorialManager.prototype.showTutorialDialogue.call(this, ...a); }
    clearTutorialDialogue(...a) { return TutorialManager.prototype.clearTutorialDialogue.call(this, ...a); }
    spawnEnemies(...a) { return LevelManager.prototype.spawnEnemies.call(this, ...a); }
    spawnTutorialEnemies(...a) { return TutorialManager.prototype.spawnTutorialEnemies.call(this, ...a); }
    spawnIceTutorialEnemies(...a) { return TutorialManager.prototype.spawnIceTutorialEnemies.call(this, ...a); }
    spawnFireMark(...a) { return LevelManager.prototype.spawnFireMark.call(this, ...a); }
    spawnIceMark(...a) { return LevelManager.prototype.spawnIceMark.call(this, ...a); }
    createRangedEnemy(...a) { return EnemyManager.prototype.createRangedEnemy.call(this, ...a); }
    _applyUltAbsorberVisual(...a) { return TutorialManager.prototype._applyUltAbsorberVisual.call(this, ...a); }
    spawnIceTraps(...a) { return TutorialManager.prototype.spawnIceTraps.call(this, ...a); }
    spawnPortal(...a) { return LevelManager.prototype.spawnPortal.call(this, ...a); }
    updatePortals(...a) { return LevelManager.prototype.updatePortals.call(this, ...a); }
    damagePortal(...a) { return LevelManager.prototype.damagePortal.call(this, ...a); }
    _destroyPortal(...a) { return LevelManager.prototype._destroyPortal.call(this, ...a); }
    spawnLevel1Enemies(...a) { return LevelManager.prototype.spawnLevel1Enemies.call(this, ...a); }

    // EnemyManager
    createEnemy(...a) { return EnemyManager.prototype.createEnemy.call(this, ...a); }
    updateEnemyHealthBar(...a) { return EnemyManager.prototype.updateEnemyHealthBar.call(this, ...a); }
    getEnemyAt(...a) { return EnemyManager.prototype.getEnemyAt.call(this, ...a); }
    isNodeAt(...a) { return EnemyManager.prototype.isNodeAt.call(this, ...a); }
    findPathBFS(...a) { return EnemyManager.prototype.findPathBFS.call(this, ...a); }
    _bfsRun(...a) { return EnemyManager.prototype._bfsRun.call(this, ...a); }
    reconstructPath(...a) { return EnemyManager.prototype.reconstructPath.call(this, ...a); }
    moveEnemies(...a) { return EnemyManager.prototype.moveEnemies.call(this, ...a); }
    updateVoidSniperBolts(...a) { return EnemyManager.prototype.updateVoidSniperBolts.call(this, ...a); }
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
    _fireIcicleNovaBurst(...a) { return WeaponSystem.prototype._fireIcicleNovaBurst.call(this, ...a); }
    _fireHealIcicle(...a)   { return WeaponSystem.prototype._fireHealIcicle.call(this, ...a); }
    _triggerHealIcicleSplit(...a) { return WeaponSystem.prototype._triggerHealIcicleSplit.call(this, ...a); }
    applyIceFistsHit(...a)     { return WeaponSystem.prototype.applyIceFistsHit.call(this, ...a); }
    applyIcicleCannonHit(...a)   { return WeaponSystem.prototype.applyIcicleCannonHit.call(this, ...a); }
    applyFractalShardHit(...a)   { return WeaponSystem.prototype.applyFractalShardHit.call(this, ...a); }
    _updateChillIndicator(...a) { return WeaponSystem.prototype._updateChillIndicator.call(this, ...a); }
    _destroyChillIndicator(...a) { return WeaponSystem.prototype._destroyChillIndicator.call(this, ...a); }
    _applyGoldMark(...a)         { return WeaponSystem.prototype._applyGoldMark.call(this, ...a); }
    _applyPurpleMark(...a)       { return WeaponSystem.prototype._applyPurpleMark.call(this, ...a); }
    _clearShatterMark(...a)      { return WeaponSystem.prototype._clearShatterMark.call(this, ...a); }
    _applyGoldMarkBoss(...a)     { return WeaponSystem.prototype._applyGoldMarkBoss.call(this, ...a); }
    _applyPurpleMarkBoss(...a)   { return WeaponSystem.prototype._applyPurpleMarkBoss.call(this, ...a); }
    _applyIceElementalChill(...a) { return CombatSystem.prototype._applyIceElementalChill.call(this, ...a); }
    _triggerShatterBurst(...a) { return WeaponSystem.prototype._triggerShatterBurst.call(this, ...a); }
    _clearFreezeVisuals(...a)  { return WeaponSystem.prototype._clearFreezeVisuals.call(this, ...a); }
    _shatterWaterSplash(...a) { return WeaponSystem.prototype._shatterWaterSplash.call(this, ...a); }
    flameSwordAttack(...a) { return WeaponSystem.prototype.flameSwordAttack.call(this, ...a); }
    magmaStaffAttack(...a)  { return WeaponSystem.prototype.magmaStaffAttack.call(this, ...a); }
    magmaStaffRipple(...a)  { return WeaponSystem.prototype.magmaStaffRipple.call(this, ...a); }
    _updateMagmaRippleBar(...a) { return WeaponSystem.prototype._updateMagmaRippleBar.call(this, ...a); }
    _updateMagmaOrbs(...a)     { return WeaponSystem.prototype._updateMagmaOrbs.call(this, ...a); }
    applyBurnStack(...a)    { return WeaponSystem.prototype.applyBurnStack.call(this, ...a); }
    applyBurnStackBoss(...a){ return WeaponSystem.prototype.applyBurnStackBoss.call(this, ...a); }
    _burnTierStats(...a)    { return WeaponSystem.prototype._burnTierStats.call(this, ...a); }
    _applyBurnDoTVoidSovereign(...a){ return WeaponSystem.prototype._applyBurnDoTVoidSovereign.call(this, ...a); }
    _recalcMagmaFireballCount(...a) { return WeaponSystem.prototype._recalcMagmaFireballCount.call(this, ...a); }
    _applyBurnDoT(...a)     { return WeaponSystem.prototype._applyBurnDoT.call(this, ...a); }
    _applyBurnDoTBoss(...a) { return WeaponSystem.prototype._applyBurnDoTBoss.call(this, ...a); }
    _updateBurnStackIndicator(...a) { return WeaponSystem.prototype._updateBurnStackIndicator.call(this, ...a); }
    _updateBossBurnIndicator(...a)  { return WeaponSystem.prototype._updateBossBurnIndicator.call(this, ...a); }
    _clearBurnStackIndicator(...a)  { return WeaponSystem.prototype._clearBurnStackIndicator.call(this, ...a); }
    _magmaExplosion(...a) { return WeaponSystem.prototype._magmaExplosion.call(this, ...a); }
    shootFireball(...a) { return WeaponSystem.prototype.shootFireball.call(this, ...a); }
    shootIceShard(...a) { return WeaponSystem.prototype.shootIceShard.call(this, ...a); }
    spawnIceShardProjectile(...a) { return WeaponSystem.prototype.spawnIceShardProjectile.call(this, ...a); }
    updateIceShards(...a) { return WeaponSystem.prototype.updateIceShards.call(this, ...a); }
    distancePointToSegment(...a) { return WeaponSystem.prototype.distancePointToSegment.call(this, ...a); }
    spawnBounceImpact(...a) { return WeaponSystem.prototype.spawnBounceImpact.call(this, ...a); }
    destroyIceShard(...a) { return WeaponSystem.prototype.destroyIceShard.call(this, ...a); }
    updateFireballs(...a) { return WeaponSystem.prototype.updateFireballs.call(this, ...a); }
    _checkProjectileCrackShrink(...a) { return WeaponSystem.prototype._checkProjectileCrackShrink.call(this, ...a); }
    updateLightningOrbs(...a) { return WeaponSystem.prototype.updateLightningOrbs.call(this, ...a); }
    cosmicFistsAttack(...a)  { return WeaponSystem.prototype.cosmicFistsAttack.call(this, ...a); }
    singularityStaffFire(...a)        { return WeaponSystem.prototype.singularityStaffFire.call(this, ...a); }
    updateSingularityStaff(...a)      { return WeaponSystem.prototype.updateSingularityStaff.call(this, ...a); }
    _singularityExplode(...a)         { return WeaponSystem.prototype._singularityExplode.call(this, ...a); }
    singularityCollapseActivate(...a) { return WeaponSystem.prototype.singularityCollapseActivate.call(this, ...a); }
    singularityCollapseRelease(...a)  { return WeaponSystem.prototype.singularityCollapseRelease.call(this, ...a); }
    updateCollapseMode(...a)          { return WeaponSystem.prototype.updateCollapseMode.call(this, ...a); }
    _updateLaunchingOrbs(...a)        { return WeaponSystem.prototype._updateLaunchingOrbs.call(this, ...a); }
    _spawnCollapseOrb(...a)           { return WeaponSystem.prototype._spawnCollapseOrb.call(this, ...a); }
    _orbitCollapseOrbs(...a)          { return WeaponSystem.prototype._orbitCollapseOrbs.call(this, ...a); }
    _collapseOrbDamage(...a)          { return WeaponSystem.prototype._collapseOrbDamage.call(this, ...a); }
    _collapseOrbBlockProjectiles(...a){ return WeaponSystem.prototype._collapseOrbBlockProjectiles.call(this, ...a); }
    _drawCollapseCursor(...a)         { return WeaponSystem.prototype._drawCollapseCursor.call(this, ...a); }
    _dissipateCollapseOrbs(...a)      { return WeaponSystem.prototype._dissipateCollapseOrbs.call(this, ...a); }
    _endCollapseMode(...a)            { return WeaponSystem.prototype._endCollapseMode.call(this, ...a); }
    _updateCollapseBar(...a)          { return WeaponSystem.prototype._updateCollapseBar.call(this, ...a); }
    orbEmitterAttack(...a)            { return WeaponSystem.prototype.orbEmitterAttack.call(this, ...a); }
    _drawOrbEmitterGfx(...a) { return WeaponSystem.prototype._drawOrbEmitterGfx.call(this, ...a); }
    _orbHitEnemy(...a) { return WeaponSystem.prototype._orbHitEnemy.call(this, ...a); }
    spawnFireballLavaPool(...a)  { return WeaponSystem.prototype.spawnFireballLavaPool.call(this, ...a); }
    fractalShardAttack(...a)    { return WeaponSystem.prototype.fractalShardAttack.call(this, ...a); }
    _spawnPierceSpike(...a)     { return WeaponSystem.prototype._spawnPierceSpike.call(this, ...a); }
    _spawnFrostTotem(...a)      { return WeaponSystem.prototype._spawnFrostTotem.call(this, ...a); }
    _spawnSplitterShard(...a)   { return WeaponSystem.prototype._spawnSplitterShard.call(this, ...a); }
    _triggerSplitterSplit(...a) { return WeaponSystem.prototype._triggerSplitterSplit.call(this, ...a); }
    _updateIciclePips(...a)       { return WeaponSystem.prototype._updateIciclePips.call(this, ...a); }
    _updateIcicleChargeBar(...a)  { return WeaponSystem.prototype._updateIcicleChargeBar.call(this, ...a); }
    _updateIcicleAccuracyCircle(...a) { return WeaponSystem.prototype._updateIcicleAccuracyCircle.call(this, ...a); }
    _fireIcicleHealShard(...a)    { return WeaponSystem.prototype._fireIcicleHealShard.call(this, ...a); }

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
    updateUltAbsorbers(...a) { return CombatSystem.prototype.updateUltAbsorbers.call(this, ...a); }
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
    _applyIgnitionMark(...a) { return WeaponSystem.prototype._applyIgnitionMark.call(this, ...a); }
    activateIceBlizzard(...a) { return ElementSystem.prototype.activateIceBlizzard.call(this, ...a); }
    deactivateTsunami(...a) { return ElementSystem.prototype.deactivateTsunami.call(this, ...a); }
    updateTsunami(...a) { return ElementSystem.prototype.updateTsunami.call(this, ...a); }
    updateTsunamiPuddles(...a) { return ElementSystem.prototype.updateTsunamiPuddles.call(this, ...a); }
    createTsunamiPuddle(...a) { return ElementSystem.prototype.createTsunamiPuddle.call(this, ...a); }
    activateLightningStorm(...a) { return ElementSystem.prototype.activateLightningStorm.call(this, ...a); }
    _spawnLightningSentry(...a)  { return ElementSystem.prototype._spawnLightningSentry.call(this, ...a); }
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
    drawOrbProjectile(...a) { return ElementSystem.prototype.drawOrbProjectile.call(this, ...a); }
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
    updateIciclePips(...a)          { return HUD.prototype.updateIciclePips.call(this, ...a); }
    updateIcicleChargeBar(...a)     { return HUD.prototype.updateIcicleChargeBar.call(this, ...a); }
    _destroyIcicleBarObjects(...a)  { return HUD.prototype._destroyIcicleBarObjects.call(this, ...a); }
    openPauseMenu(...a) { return HUD.prototype.openPauseMenu.call(this, ...a); }
    closePauseMenu(...a) { return HUD.prototype.closePauseMenu.call(this, ...a); }
    gameOver(...a) { return HUD.prototype.gameOver.call(this, ...a); }
    showDeathScreen(...a) { return HUD.prototype.showDeathScreen.call(this, ...a); }
    _showDeathContent(...a) { return HUD.prototype._showDeathContent.call(this, ...a); }
    showRoomName(...a) { return HUD.prototype.showRoomName.call(this, ...a); }

    _checkRoomNameDisplay() {
        const room = this.getCurrentPlayerRoom();
        if (room === -1 || room === this._lastDisplayedRoom) return;
        this._lastDisplayedRoom = room;

        // Room name maps per level
        const tutorialNames = {
            0: 'Entrance Hall',
            1: 'The Training Grounds',
            2: 'The Armory',
            3: 'Trial Chamber',
            4: 'Hall of Elements',
            5: 'The Gauntlet',
            6: 'Queen\'s Lair',
        };
        const level1Names = {
            0: 'The Corridor',
            1: 'Side Chamber',
            2: 'The Depths',
            3: 'Forgotten Hall',
            4: 'Lair of the Queen',
        };
        const level2Names = {
            0: 'Fractured Keep',
            1: 'The Crucible',
            2: 'Vault of Ice',
            3: 'Ult Gauntlet',
            4: 'Voltslime\'s Domain',
            5: 'The Ambush',
            6: 'Storm Arena',
            7: 'Chest Room',
            8: 'Chest Room',
        };
        const level3Names = {
            0: 'The Void Rift',
            1: 'Elemental Crucible',
            2: 'Cosmic Observatory',
            3: 'X Marks the Spot',
            4: 'Ambush',
            5: 'Queen Slime Chamber',
            6: 'Void Sovereign\'s Arena',
            7: 'Chest Room',
            8: 'Chest Room',
        };

        const level4Names = {
            0: 'The Rubble',
            1: 'Entry Crater',
            2: 'The Sinkhole',
            3: 'Chain Gang',
            4: 'Splitter Farm',
            5: 'Trap Gauntlet',
            6: 'Fracture Core Arena',
            7: 'Chest Room',
            8: 'Chest Room',
        };

        let nameMap;
        if (this.isLevel4)       nameMap = level4Names;
        else if (this.isLevel3)  nameMap = level3Names;
        else if (this.isLevel2)  nameMap = level2Names;
        else if (this.isTutorial) nameMap = tutorialNames;
        else                      nameMap = level1Names;

        const roomObj = this.rooms?.[room];
        const name = nameMap[room] ?? (roomObj?.isChestRoom ? 'Chest Room' : null);
        if (name) this.showRoomName(name);
    }

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
            let tx = Math.floor(wx / this.TILE_SIZE);
            let ty = Math.floor(wy / this.TILE_SIZE);

            // If clicked tile is a wall, spiral outward to find nearest floor tile
            if (this.world[tx]?.[ty] !== this.FLOOR) {
                let found = false;
                for (let r = 1; r <= 6 && !found; r++) {
                    for (let dx = -r; dx <= r && !found; dx++) {
                        for (let dy = -r; dy <= r && !found; dy++) {
                            if (Math.abs(dx) !== r && Math.abs(dy) !== r) continue;
                            const nx = tx + dx, ny = ty + dy;
                            if (this.world[nx]?.[ny] === this.FLOOR) {
                                tx = nx; ty = ny; found = true;
                            }
                        }
                    }
                }
                if (!found) return;
            }

            this.playerX = tx; this.playerY = ty;
            const ppx = tx * this.TILE_SIZE + this.TILE_SIZE / 2;
            const ppy = ty * this.TILE_SIZE + this.TILE_SIZE / 2;
            this.player.x = ppx; this.player.y = ppy;
            this.cameras.main.centerOn(ppx, ppy);
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

    // ── Crumble tile system (Level 4 only) ───────────────────────────────────
    _getCrumbleTileKey(tx, ty) { return `${tx},${ty}`; }

    _renderCrumbleZones() {
        if (!this._crumbleZones) return;
        const TS = this.TILE_SIZE;
        for (const key of this._crumbleZones) {
            const [tx, ty] = key.split(',').map(Number);
            const px = tx * TS + TS / 2, py = ty * TS + TS / 2;
            const g = this.add.graphics().setDepth(0.55);
            // Faint hairline crack pattern — visible but not distracting
            // Darker tint on the tile
            g.fillStyle(0x000000, 0.18);
            g.fillRect(px - TS/2 + 1, py - TS/2 + 1, TS - 2, TS - 2);
            // Light hairline cracks
            const seed = (tx * 7 + ty * 13) % 100;
            g.lineStyle(0.8, 0x888866, 0.55);
            const lines = [
                [0, 0, -TS*0.4 + (seed%5)-2, -TS*0.35 + (seed%3)],
                [0, 0,  TS*0.35 + (seed%4)-2, -TS*0.3  + (seed%5)],
                [0, 0, -TS*0.3  + (seed%3),    TS*0.4  + (seed%4)-2],
            ];
            for (const [x1,y1,x2,y2] of lines) {
                const mx = px + (x1+x2)/2 + (seed%3)-1;
                const my = py + (y1+y2)/2 + (seed%2);
                g.beginPath();
                g.moveTo(px + x1, py + y1);
                g.lineTo(mx, my);
                g.lineTo(px + x2, py + y2);
                g.strokePath();
            }
            // Small corner chips
            g.fillStyle(0x555544, 0.45);
            g.fillRect(px - TS/2 + 1, py - TS/2 + 1, 2, 2);
            g.fillRect(px + TS/2 - 3, py - TS/2 + 1, 2, 2);
        }
    }

    _onPlayerStepCrumble(tx, ty) {
        const key = this._getCrumbleTileKey(tx, ty);
        if (this._crumbleTiles.has(key)) return; // already crumbling/broken
        if (this.world[tx]?.[ty] !== this.FLOOR) return;
        // Only pre-designated crumble zone tiles crumble
        if (!this._crumbleZones?.has(key)) return;

        const TS = this.TILE_SIZE;
        const px = tx * TS + TS / 2, py = ty * TS + TS / 2;

        // Crack overlay — draw fracture lines on the tile
        const gfx = this.add.graphics().setDepth(0.6);
        this._drawCrackOverlay(gfx, px, py, 0.45); // initial light cracks

        const entry = { state: 'cracking', gfx, x: tx, y: ty, timer: null };
        this._crumbleTiles.set(key, entry);

        // After 1.2s the tile fully cracks
        entry.timer = this.time.delayedCall(1200, () => {
            if (!this._crumbleTiles.has(key)) return;
            entry.state = 'broken';
            this._drawCrackOverlay(gfx, px, py, 1.0); // heavy dark cracks
            // Dark pit overlay
            const pit = this.add.graphics().setDepth(0.5);
            pit.fillStyle(0x111111, 0.55);
            pit.fillRect(px - TS/2 + 1, py - TS/2 + 1, TS - 2, TS - 2);
            entry.pitGfx = pit;
            entry._brokenAt = this.time.now;

            // Restore after 12s
            entry.timer = this.time.delayedCall(12000, () => {
                this._restoreCrumbleTile(key);
            });
        });
    }

    _drawCrackOverlay(gfx, px, py, alpha) {
        const TS = this.TILE_SIZE;
        gfx.clear();
        // Dark vignette
        gfx.fillStyle(0x000000, alpha * 0.40);
        gfx.fillRect(px - TS/2 + 1, py - TS/2 + 1, TS - 2, TS - 2);
        // Crack lines — pseudo-random but deterministic per pixel position
        const seed = (px * 7 + py * 13) % 100;
        gfx.lineStyle(1, 0x222222, alpha * 0.85);
        // 4-5 jagged fracture lines radiating from center
        const lines = [
            [0, 0, -TS*0.4 + (seed%5)-2, -TS*0.35 + (seed%3)],
            [0, 0,  TS*0.35 + (seed%4)-2, -TS*0.3  + (seed%5)],
            [0, 0, -TS*0.3  + (seed%3),    TS*0.4  + (seed%4)-2],
            [0, 0,  TS*0.4  + (seed%5)-3,  TS*0.3  + (seed%3)],
            [-TS*0.2, -TS*0.1, -TS*0.45 + (seed%4), TS*0.2],
        ];
        for (const [x1,y1,x2,y2] of lines) {
            gfx.beginPath();
            gfx.moveTo(px + x1, py + y1);
            // Mid-point jitter for jagged look
            const mx = px + (x1+x2)/2 + (seed%5)-2;
            const my = py + (y1+y2)/2 + (seed%3)-1;
            gfx.lineTo(mx, my);
            gfx.lineTo(px + x2, py + y2);
            gfx.strokePath();
        }
        // Small debris dots
        if (alpha > 0.7) {
            gfx.fillStyle(0x333333, 0.70);
            for (let i = 0; i < 5; i++) {
                const dx = (seed * (i+1) * 7 % TS) - TS/2 + 2;
                const dy = (seed * (i+1) * 11 % TS) - TS/2 + 2;
                gfx.fillRect(px + dx, py + dy, 2, 2);
            }
        }
    }

    _updateCrumbleTiles(time) {
        if (!this._crumbleTiles || this._crumbleTiles.size === 0) return;
        const TS = this.TILE_SIZE;
        const DMG = 8 * this.damageScaling;
        const SLOW_COOLDOWN = 200 / 0.6; // ~333ms moveCooldown

        for (const [key, entry] of this._crumbleTiles) {
            if (entry.state !== 'broken') continue;

            // Damage + slow player if standing on broken tile
            if (this.playerX === entry.x && this.playerY === entry.y) {
                if (!entry._lastDmgTime || time - entry._lastDmgTime > 400) {
                    entry._lastDmgTime = time;
                    this.takeDamage(DMG);
                    this.moveCooldown = Math.max(this.moveCooldown, Math.round(SLOW_COOLDOWN));
                    this._crumbleSlowUntil = time + 600;
                    if (!this._playerSlowIndTimer) {
                        this._playerSlowIndTimer = this._startSpeedIndicator(
                            () => this.player?.active ? { x: this.player.x, y: this.player.y } : null,
                            'slow_goop', 300
                        );
                    }
                }
            }
        }

        // Expire crumble slow
        if (this._crumbleSlowUntil && time > this._crumbleSlowUntil) {
            this._crumbleSlowUntil = 0;
            if (this.moveCooldown > 200) this.moveCooldown = 200;
            if (this._playerSlowIndTimer) { this._playerSlowIndTimer.remove(); this._playerSlowIndTimer = null; }
        }
    }

    _restoreCrumbleTile(key) {
        const entry = this._crumbleTiles.get(key);
        if (!entry) return;
        if (entry.gfx?.active)    { entry.gfx.destroy(); }
        if (entry.pitGfx?.active) { entry.pitGfx.destroy(); }
        this._crumbleTiles.delete(key);
    }
}



// ─── LEVEL SELECT SCENE ────────────────────────────────────────────────────