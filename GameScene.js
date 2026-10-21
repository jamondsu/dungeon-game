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
        // Kept so later setup can read the launch flags (continueRun, tutorialStage)
        // without threading `data` down through every init helper.
        this._sceneData = data || {};
        this.tutorialStage = data?.tutorialStage ?? 0;
        // Water lives on the scene object, which outlives a restart: the Cistern's (or a flooded
        // Tower floor's) tiles were still there, unseen, on the next level.
        this.waterTiles = null; this.steamTiles = null;
        // A Tower run (Tower.js): which floor, and what the run carries up from the last one
        this.towerRun = data?.tower ? { ...data.tower } : null;
        this.trainingRun = !!data?.training;   // Training.js: the Training Ground
        this._train = null;

        // ── MANDATORY STATE RESET — must run before anything else ────────────
        if (this.input?.keyboard) this.input.keyboard.enabled = true;

        // Kill all lingering tweens (prevents stuck player animation from previous run)
        this.tweens.killAll();

        // Reset death/pause flags — these block input if left over from previous run
        this._deathScreenActive = false;
        // The scene clock outlives a restart: leaving through the pause menu (restart, main menu, then back into
        // any level) used to start the next game with time still frozen (timers held, cooldowns stuck after one
        // shot, the run clock still) until Esc paused and unpaused it. Thaw it first.
        if (this.time?._heldNow != null) { this._frozenTweens = null; this._freezeClock?.(false); }   // (its frozen tweens died with the old level)
        this._pauseMenuOpen     = false;
        this._bannerActive = false; this._bannerClosing = null; this._encounterQueue = [];   // nor a first-encounter card left open
        // Poison and roots end on timers that a restart throws away: a run that ended poisoned
        // left traps unable to poison again, and one that ended rooted left you unable to walk
        // on any level that does not clear roots itself.
        this.playerPoisoned = false; this._poisonTickCount = 0; this._elStolen = null;
        this._poisonUntil = 0; this._bleedUntil = 0; this._pBurnUntil = 0; this._pBurn = 0; this._absHexUntil = 0; this._drippingUntil = 0; this._playerRooted = false; this._hurtTotal = 0;   // (the scene object outlives a restart: what was on you mustn't come with it)
        this._playerRooted  = false; this._playerRootUntil = 0; this._ccImmuneUntil = 0;

        // Remove any extra cameras added by the death screen
        this.cameras.cameras.slice(1).forEach(c => this.cameras.remove(c));
        this.cameras.main.resetFX();
        // Not a fade from black: the first frame of a big level (the Cistern) blocks while the GPU takes its map, and a
        // black first frame meant staring at black for that long. The loading card's own brick wall instead (Transitions._card),
        // so the card hands over to it seamlessly, until the level has drawn twice; then it fades.
        {
            const W = this.scale.width, H = this.scale.height, P = UIKit.PALETTE;
            const wall = this.add.graphics().setScrollFactor(0).setDepth(5000);   // drawn a screen wider each way: whichever camera ends up drawing it, it covers
            wall.fillStyle(P.bgDeep, 1).fillRect(-W, -H, W * 3, H * 3);
            UIKit.brickWall(wall, 0, 0, W, H);
            wall.fillStyle(0x000000, 0.62).fillRect(-W, -H, W * 3, H * 3);
            let n = 0;
            const done = () => { if (++n < 3) return; this.game.events.off('postrender', done); if (wall.active) this.tweens.add({ targets: wall, alpha: 0, duration: 260, onComplete: () => wall.destroy() }); };
            this.game.events.on('postrender', done);
            this.events.once('shutdown', () => { this.game.events.off('postrender', done); if (wall.active) wall.destroy(); });
        }

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
        this.isLevel6                = false;
        this._roomHadEnemies         = {};
        this._ultNagShown            = false;
        this._iceUltUsed             = false;
        this._lightningUltUsed       = false;
        this.voltslimeBoss           = null;
        this.voidSovereignBoss       = null;
        this.fractureCore            = null;
        this._glide                  = null;
        this.fractureCoreActive      = false;   // a retried level 4 spawns its core again
        if (typeof Music !== 'undefined') Music.rate = 1;   // (the Fracture may have left the music quickened)
        this._fractureCoreReady      = false;
        this._debrisTiles            = [];
        this._debrisWarnings         = [];
        this._fractureWeakPoints     = [];
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
        this.damageScaling = 1.0;     // PLAYER weapon output. Not a difficulty knob --
                                      // 65 weapon sites read it. See applyFloorScaling.
        this.enemyHealthScale = 1.0;  // set per floor in create(), before enemies spawn
        this.enemyDamageScale = 1.0;

        // Ult stages — loaded from shop
        this.ultStage_fire      = parseInt(localStorage.getItem('ultStage_fire')      || '1');
        this.ultStage_ice       = parseInt(localStorage.getItem('ultStage_ice')       || '1');
        this.ultStage_lightning = parseInt(localStorage.getItem('ultStage_lightning') || '1');
        this.ultStage_cosmic    = parseInt(localStorage.getItem('ultStage_cosmic')    || '1');
        this._iceUltDomainActive  = false;
        this._iceUltDetonate      = null;
        this._iceUltSweepsFired   = 0;
        this._lightningUltSentries = null;
        this._thunderheadTimerText = null; // stale references survive scene restarts otherwise
        this._thunderheadAura      = null;
        this._thunderheadOuterRing = null;
        this._cloudSprite          = null;
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
        this.ignitionDuration = 8000;
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
        this.tsunamiWaveDuration = 1000;    // the ice ult's wave going out (was 2.2s)
        this.tsunamiFreezeDuration = 3120;   // (2026-10-19: the opening freeze shatters itself 3s in; was 4000)  // the ice ult holds everything this long, then it shatters
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

        // Every ult's state (the scene object outlives a restart: dying mid-ult carried it into the next run,
        // and its per-frame watchers with it, since they run while these say the ult is up)
        this.ignitionActive = false; this._barrageOn = false; this._scorchHealt = 0;
        this._iceFrostUntil = 0; this._iceFrostAt = 0; this._iceShellUntil = 0; this._iceZoomed = false; this._coldEdge = null;
        this.tsunamiActive = false; this._iceUltDomainActive = false; this._iceUltDetonate = null;
        this._forkStop = false; this._forkAfter = null; this._forkSnapped = false;
        this._ultArmor = null; this._overflowBonus = {}; this._ultHit = null;
        // LIGHTNING ULT state
        this.lightningUltActive = false;
        this.lightningUltInvuln = false;
        this.lightningUltEndTime = 0;

        // Boss state reset
        this.voltslimeBoss = null;

        // game state
        // The stats bought at Glurp's (Stats.js): max HP here, damage and armor read by
        // CombatSystem (_dmgOutMult, takeDamage).
        this.maxHealth = PlayerStats.maxHealth();
        this.health = this.maxHealth;
        this.statDamageMult = PlayerStats.damageMult();
        this.statTakenMult = PlayerStats.takenMult();
        PlayerStats.startRun(this);   // the talents every 5th stat level grants (this._tal)
        // Relics.js: what the worn relics trade. _mods is what the game reads (a Tower run adds its boons to it)
        this._relicMods = Relics.mods();
        this.statDamageMult *= this._relicMods.dmg;
        this.statTakenMult *= this._relicMods.taken;
        this.maxHealth = Math.max(10, this.maxHealth + this._relicMods.hp);
        this.health = this.maxHealth;
        this._mods = this._relicMods;
        this.lastPlayerDamageTime = 0;
        this.playerDamageCooldown = 150;

        const seed = this.towerRun ? (this.towerRun.seed + this.towerRun.floor * 7919) % 2147483647 : 12345;
        this.rng = this.createRng(seed);
        // Floor scaling must land before anything spawns: enemy HP is baked in at
        // creation, so setting it afterwards would leave the current floor unscaled.
        this.applyFloorScaling();

        this.world = this.generateWorld();

        this._vfxVoidVeil = null;   // set again by a backdrop that wants the dark lifted off the void
        this._vfxRenderWorld();   // Visuals.js: generated stone and brick (WorldGen.renderWorld is TD's now)

        // Atmosphere behind the tiles. Transitions.atmosphere was written for exactly this
        // and only ever wired into the level-select carousel, so during play every level
        // rendered its void as flat black. The Cistern is underwater, so it gets the flood
        // field -- scrollFactor 0 at depth -9..-5, i.e. behind every tile.
        if (this.isLevel6 && typeof MenuArt !== 'undefined' && MenuArt.cistern) {
            this._atmoObjs = MenuArt.cistern(this);   // Menus.js: a drowned hall, caustics, light
        } else if (this.isLevel6 && typeof Transitions !== 'undefined' && Transitions.atmosphere) {
            this._atmoObjs = Transitions.atmosphere(this, 'flood', 0x3fb6e8);
        }
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
        this._levelLive = false;   // until the level's own enemies are in: anything made after is spawned in a fight (and drops nothing)
        this.spawnEnemies();
        this._levelLive = true;
        this._spreadResistance();   // a share of every level's enemies resist an element (LevelManager)
        this._spreadUltBlockers();  // and a few block ults round them
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
        // MIGRATION. Saves predating the rework hold 'engineering_degree' in equip_lightning
        // and in unlockedWeapons. That id no longer dispatches to anything, so the weapon
        // switch would fall through to its default and a player who had bought and equipped
        // it would silently be holding Flame Fists on lightning. Rewrite it on load.
        try {
            if (localStorage.getItem('equip_lightning') === 'engineering_degree') {
                localStorage.setItem('equip_lightning', 'ball_lightning');
            }
            const owned = JSON.parse(localStorage.getItem('unlockedWeapons') || '[]');
            if (Array.isArray(owned) && owned.includes('engineering_degree')) {
                const migrated = owned.map(w => w === 'engineering_degree' ? 'ball_lightning' : w);
                localStorage.setItem('unlockedWeapons', JSON.stringify(migrated));
            }
        } catch (e) { /* corrupt storage must not block the level from loading */ }

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

        // Engineering Degree towers
        this.engineerTowers = [];
        this.engineerTowersCrafting = [];
        this.teslaBolts = [];      // Tesla Coil traveling chain bolts
        this.engineerBullets = []; // Machine Gun / Sniper Tower traveling bullets

        // Orb scraps — currency for nodes.
        // A fresh entry starts the run and wipes the bank; only an explicit
        // `continueRun: true` in the scene data carries it over. Nothing passes that yet,
        // so today the bank spans the rooms of one level, which is the span that matters:
        // bank through the early rooms, spend in the hard ones at the end. When floor
        // chaining lands it passes the flag and the bank follows the player down.
        this.orbScraps = 0;
        if (typeof this.beginScrapRun === 'function') {
            if (this._sceneData?.continueRun) this.loadScrapBank();
            else this.beginScrapRun();
        }
        // Gadgets: the two you carry, every one ready at the start of a level (FieldKit.js).
        this.beginGadgetRun();
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

        // Amped mechanic
        this.superConductDuration = 5000;   // the orb's tuned 5s (this 10s was read only by unused code)

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
        this.cosmicDropChance = 0;   // Cosmic.js: the cosmic gem fills with time; kills drop nothing

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
        this.cosmicBlackHoleDuration = 4000; // then it collapses (ElementSystem._cosmicCollapse)
        this.cosmicBlackHoleRadius = 6; // tiles
        this.cosmicBlackHoleMarkInterval = 1000;  // 3 marks over the 4s pull (the cap)
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
        // Dash (Space, any element): ElementSystem.playerDash
        this.DASH_TILES = 3;
        this.DASH_COOLDOWN = 1100;   // ms
        this.DASH_IFRAMES = 220;     // ms untouchable from the start of a dash
        this.FIRE_DASH = { RUSH: 12, STAGGER: 300, OPEN_MS: 600, ERUPT: 16 };   // its hit going through, the stagger, the fissure's wait, each eruption's burst (x damageScaling)
        this._dashReadyAt = 0;
        this._dashInvulnUntil = 0;
        this._lastMoveDir = { x: 0, y: 1 };

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

        // Every binding comes from Settings.js (the lobby's settings panel rebinds them).
        for (const el of ['fire', 'ice', 'lightning', 'cosmic']) {
            this.input.keyboard.on('keydown-' + Settings.key(el), () => this.switchToElement(el));
        }

        // Element ultimate abilities
        this.ultActive = false;

        // ULT CHARGE METER (replaces per-element cooldowns)
        this.ultCharge = 0;
        this.ultChargeMax = 100;
        this.ultChargeSwitchPenalty = 25;   // no longer applied: see switchToElement

        // FOUR ULT GEMS, one per element (see ElementSystem.activateUlt and _ultCfg). Each is
        // ultChargeMax deep. ultCharge above just mirrors the gem of the element you hold, for
        // anything that still reads it.
        this.ultGems = { fire: 0, ice: 0, lightning: 0, cosmic: 0 };
        this._ultLockUntil = 0;          // shared cooldown between casts
        this._ultNoChargeUntil = {};     // per element: sealed while its own ult is still working
        this._lastUltHit = null;         // set by the damage choke points, read by gainUltCharge
        this._ultReadyAt = {}; this._ultDenyAt = {}; this._ultCastAt = {}; this._ultFlashUntil = {};

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
        // Heat is per-RUN state. Without an explicit reset it would survive a restart on
        // the scene object and you would start a fresh run at whatever tier you died on —
        // the same class of leak as the wisp upgrade fields.
        this._magmaHeat     = 0;
        this._magmaLastHit  = 0;
        this._magmaHeatPrev = 0;
        // Kindling state is per-run for the same reason. _kindleMarked especially: it
        // holds enemy references, so carrying it across a restart would keep destroyed
        // objects alive and leave their meters to be swept against a dead scene.
        this._lastKindleTime     = 0;
        this._kindleIgniteUntil  = 0;
        this._kindleIgniteReady  = 0;
        this._kindleBullets      = [];
        this._kindleMarked       = null;
        this._kindleTarget       = null;
        this._magmaRippleBarBg     = null;
        this._magmaRippleBarFill   = null;
        this._magmaRippleLabel     = null;
        this._magmaOrbGraphics     = [];
        this._magmaOrbCount        = 0;

        // E key to activate ult
        this.input.keyboard.on('keydown-' + Settings.key('ult'), () => {
            // If black hole projectile is in flight, E detonates it
            if (this.cosmicBlackHoleProjectile) {
                this.detonateCosmicBomb();
                return;
            }
            // A second ice press shatters everything the ice ult froze (any stage now)
            if (this.currentElement === 'ice' && this._iceFrostEarly()) return;   // ends the ice ult early
            this.activateUlt();

            // The two tutorial rooms that ask for an ult (shared with Z/X/C/V, see castUlt).
            // Pressing E counts whether or not the ult went off, as it always did.
            this._tutorialUltGate(this.currentElement);
        });

        // Z/X/C/V: cast the fire / ice / lightning / cosmic ult from whatever element you're
        // holding (E still casts the held element's). See ElementSystem.castUlt.
        for (const [key, el] of [[Settings.key('ultFire'), 'fire'], [Settings.key('ultIce'), 'ice'], [Settings.key('ultLightning'), 'lightning'], [Settings.key('ultCosmic'), 'cosmic']]) {
            this.input.keyboard.on('keydown-' + key, () => {
                if (el === 'cosmic' && this._csVDown?.()) return;   // Cosmic.js stage 2: tap vs hold
                this.castUlt(el);
            });
        }
        this.input.keyboard.on('keyup-' + Settings.key('ultCosmic'), () => this._csVUp?.());

        // SPACE — dash, any element. Queued here and spent in update (so it reads the movement
        // keys' direction there). Not polled with JustDown: a tap whose down and up land in the
        // same frame clears Key._justDown before update ever sees it, and the dash is lost.
        this.spaceKey = this.input.keyboard.addKey(Settings.key('dash'));
        this.input.keyboard.on('keydown-' + Settings.key('dash'), () => { this._dashQueued = true; });

        // Cosmic dash: Shift dashes toward the mouse (Space, holding cosmic, dashes the way you move)
        this.shiftKey = this.input.keyboard.addKey(Settings.key('cosmicDash'));

        // M — mute / unmute every sound (Sound.js; remembered between sessions)
        this.input.keyboard.on('keydown-' + Settings.key('mute'), () => {
            const m = Sfx.toggleMute();
            this.showStatusText(this.player.x, this.player.y - 28, m ? 'SOUND OFF' : 'SOUND ON', '#d2bf98');
        });

        // F key — cosmic charge channeling (sidelined)
        // F — the second gadget slot (Q is the first; FieldKit.useGadget)
        this.input.keyboard.on('keydown-' + Settings.key('gadget2'), () => {
            if (this._pauseMenuOpen || this._deathScreenActive) return;
            this.useGadget(1, this.pointerX, this.pointerY);
        });
        this.input.keyboard.on('keyup-F', () => { /* cosmic channeling sidelined */ });
        this.cameras.main.setBounds(0, 0, this.WORLD_WIDTH * this.TILE_SIZE, this.WORLD_HEIGHT * this.TILE_SIZE);

        // create HUD
        this.createHUD();
        // What the death screen's run summary reads (HUD._deathSummary). The Tower adds
        // this.towerRun = { floor, best } when it starts a run.
        this._runStats = { t0: this.time.now, kills: 0, glorps0: this.totalGlorps || 0, dmg: {}, elTime: {}, tEnd: 0 };
        this._lastCombatAt = -1e9;
        if (!this.trainingRun) Telemetry.begin(this); else this._tele = null;   // the run's record (Telemetry.js)
        this.events.once('shutdown', () => Telemetry.end(this, 'quit'));   // left mid-level
        this._fragsThisLevel = 0; this._achThisLevel = [];   // fragments paid this level (Progress.announce)
        this.allies = [];           // the decoy now, voidlets later (CombatSystem._addAlly)
        this._musicCheckAt = 0;     // HUD._updateMusic (the scene object outlives a restart)
        this._frostShieldUntil = 0; // the Icicle Cannon's Frost Shield
        this._frostHazeMult = 1;    // a Frostborn's haze (LevelManager._frostUpdate)
        this._ultCfgCache = null;   // its key labels follow the keybinds (Settings.js)

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

        // named W/A/S/D throughout the code, whatever they're bound to
        this.keys = { W: this.input.keyboard.addKey(Settings.key('up')), A: this.input.keyboard.addKey(Settings.key('left')),
                      S: this.input.keyboard.addKey(Settings.key('down')), D: this.input.keyboard.addKey(Settings.key('right')) };
        // Screen shake, scaled (or switched off) by the setting
        const _cam = this.cameras.main;
        if (!_cam._shakeScaled) {
            _cam._shakeScaled = true;
            const _shake = _cam.shake.bind(_cam);
            _cam.shake = (d, i, ...r) => { const m = Settings.shake(); return m > 0 ? _shake(d, (i ?? 0.05) * m, ...r) : _cam; };
        }

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
        this._jetLit = false; this._fuel = 1; this._fuelDryUntil = 0;
        this._cinemaUntil = 0; this._fog = null; this._condRKey = null; this._condWires = []; this._condMisses = []; this._condPulses = []; this._condPairs = []; this._condMode = 'live'; this._condWeb = 0; this._condG = null; this._condGL = null; this._condBar = null; this._condPool = []; this._condSparks = null; this._condLights = [];   // the Conductor's
        this._fracCharge = 0; this._fracMode = null; this._fracMarked = new Set(); this._fracBar = null; this._fracOrbs = null; this._fracSpin = false;   // Fractal Shard's R   // Ignition's flamethrower starts each run out, on a full tank
        this.pointerX = 0;
        this.pointerY = 0;

        // ── FIELD KIT INPUT ──────────────────────────────────────────────────
        // Q used to toggle Engineering Degree's tower build mode, gated on lightning being
        // the active element AND Engineering Degree being the equipped lightning weapon.
        // Both gates are gone: the Field Kit is a passive, so its controls work in every
        // element and cost no weapon slot. The tower build mode itself is unhooked here
        // rather than deleted -- TowerDefenseScene proxies into the same implementation in
        // ElementSystem, and removing it would black-screen that mode.
        //
        // Q throws the selected gadget, B opens the purchase menu, the wheel cycles (the
        // wheel was the tower selector, so it is free now).
        this.engineerBuildMode = false;          // kept false: update loops still read it
        this.engineerSelectedTowerType = 'tesla_coil';
        this._engineerBuildRing = null;

        // Q — the first gadget slot (F is the second)
        this.input.keyboard.on('keydown-' + Settings.key('detonate'), () => {   // Ignition: every kindled mark goes off now
            if (this._pauseMenuOpen || this._deathScreenActive || this._encased?.()) return;
            if (this._condWielding?.()) {   // the Circuit Breaker
                const M = ['live', 'ins', 'cap'], next = M[(M.indexOf(this._condMode || 'live') + 1) % 3];   // the next clamp: live, insulator, capacitor
                this._condMode = next;
                this.showStatusText(this.player.x, this.player.y - 30, { live: 'LIVE WIRE', ins: 'INSULATOR', cap: 'CAPACITOR' }[next], { live: '#fff08a', ins: '#9fdcff', cap: '#ffb070' }[next]);
                Sfx.play(this, 'click');
                return;
            }
            this._kindleDetonateAll?.();
        });
        this.input.keyboard.on('keydown-' + Settings.key('gadget1'), () => {
            if (this._pauseMenuOpen || this._deathScreenActive) return;
            this.useGadget(0, this.pointerX, this.pointerY);
        });

        this.input.mouse?.disableContextMenu();   // right-click is a game input (the Twin Collapse anchor)
        this.input.on('pointerdown', (pointer) => {
            if (this._pauseMenuOpen || this._deathScreenActive) return;
            if (this._dialogueObjects) return;   // a click on Glerp's box only moves the talk on
            if (this._towerPicking) return;      // Tower.js: choosing a pick
            if (this._train && Training.overPanel(this, pointer)) return;   // Training.js: a click on its panel
            if (pointer.button === 2 && this._cs?.tf) { this._csPointerDown?.(pointer); return; }   // Cosmic.js: right-click moves the Twin Collapse anchor
            if (pointer.button !== 0) return;
            // A held Displacer group consumes the next click. Checked before everything else
            // -- including the level-4 weak point and the storm cloud -- because leaving the
            // group in limbo to fire a weapon is never what the player meant.
            if (this.displacerPending()) { const _a = this._aim(pointer); this.placeDisplaced(_a.x, _a.y); return; }
            // Cosmic.js stage 2: while transforming, clicks aim the drop or throw Twin Collapse
            if (this._csPointerDown?.(pointer)) return;
            if (this._devTeleportMode) return; // teleport mode consumes left-click

            // Level 4: while the Fracture Core's rhythm plays, clicks hit its notes (LevelManager._tryHitCurrentWeakPoint).
            if (this.isLevel4 && this.fractureCore?.state === 'rhythm') {   // the rhythm: a click is for the notes, not the weapon
                const _a = this._aim(pointer);
                this._tryHitCurrentWeakPoint(_a.x + this.cameras.main.scrollX, _a.y + this.cameras.main.scrollY);
                this.isPointerDown = true;   // (held, for the slides)
                return;
            }

            // (Ignition's marks go off on a key now, Settings 'detonate': a click only fires)

            if (this.stormCloudActive && this.stormCloud && !this.stormCloud.thrown) {
                this.throwLightning();
                return;
            }

            if (this.currentElement === 'lightning') {
                // The engineerBuildMode branch that used to sit here placed a tower on
                // left-click. Towers are no longer buildable in the overworld, so a click
                // on lightning is always just the weapon firing.
                if ((this.equippedWeapons?.lightning || 'lightning_fists') === 'lightning_fists') {
                    this.isPointerDown = true;
                    const _a = this._aim(pointer);
                    this.pointerX = _a.x;
                    this.pointerY = _a.y;
                    this.fireEquippedWeapon(_a.x, _a.y);
                } else {
                    this.isPointerDown = true;
                    const _a = this._aim(pointer);
                    this.pointerX = _a.x;
                    this.pointerY = _a.y;
                    this.fireEquippedWeapon(_a.x, _a.y);
                }
                return;
            }

            // Cosmic.js: every cosmic weapon casts on a click (or a hold); Collapse mode is retired.
            if (this.currentElement === 'cosmic' && this._csCast) {
                this.isPointerDown = true;
                const _a = this._aim(pointer);
                this.pointerX = _a.x;
                this.pointerY = _a.y;
                this._csClickAt = this.time.now;
                this.fireEquippedWeapon(_a.x, _a.y);
                return;
            }

            // Collapse decay phase — click launches orbs instead of firing
            if (this._collapseDecaying &&
                (this.equippedWeapons?.cosmic || 'cosmic_fists') === 'singularity_staff') {
                { const _a = this._aim(pointer); this.singularityCollapseRelease(_a.x, _a.y); }
                return;
            }

            // Singularity staff base attack is now Collapse (was orb fire) —
            // trigger on click, not held-fire, so we handle it here before
            // setting isPointerDown
            if (this.currentElement === 'cosmic' &&
                (this.equippedWeapons?.cosmic || 'cosmic_fists') === 'singularity_staff' &&
                !this._collapseDecaying) {
                this.singularityCollapseActivate();
                return;
            }

            if (this._jetHeld()) {   // the flamethrower: a click toggles it (not while it's run dry)
                if (!this._jetLit && this.time.now < (this._fuelDryUntil || 0)) { Sfx.play(this, 'click'); return; }
                this._jetLit = !this._jetLit; return;
            }

            this.isPointerDown = true;
            const _a = this._aim(pointer);
            this.pointerX = _a.x;
            this.pointerY = _a.y;
            this.fireEquippedWeapon(_a.x, _a.y);
        });

        this.input.on('pointerup', (pointer) => {
            this.isPointerDown = false;
            this._csRelease?.();   // Cosmic.js: a charged Void Blade slashes on release
            this._csPointerUp?.();  // ...and a Twin Collapse drag throws
        });

        // TAB used to cycle the selected gadget; with two fixed slots (Q, F) there is nothing
        // to cycle. Still swallowed so it can't move focus off the canvas.
        this.input.keyboard.on('keydown-TAB', (event) => event.preventDefault());

        this.input.on('pointermove', (pointer) => {
            const _a = this._aim(pointer);
            this.pointerX = _a.x;
            this.pointerY = _a.y;
            this._csPointerMove?.();
            if (this.currentElement === 'lightning' && this.engineerBuildMode) {
                const worldX = _a.x + this.cameras.main.scrollX;
                const worldY = _a.y + this.cameras.main.scrollY;
                this.updateEngineerTowerPreview(
                    Math.floor(worldX / this.TILE_SIZE),
                    Math.floor(worldY / this.TILE_SIZE)
                );
            } else {
                this.clearEngineerTowerPreview();
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

        // R key — remove engineer towers OR lightning nodes OR fire magma staff ripple
        this.input.keyboard.on('keydown-' + Settings.key('surge'), () => {
            if (this.currentElement === 'lightning' && this.engineerBuildMode) {
                const worldX = this.pointerX + this.cameras.main.scrollX;
                const worldY = this.pointerY + this.cameras.main.scrollY;
                const tileX = Math.floor(worldX / this.TILE_SIZE);
                const tileY = Math.floor(worldY / this.TILE_SIZE);
                if (!this.removeEngineerTowerAt(tileX, tileY)) {
                    let best = null, bestDist = 3;
                    for (const t of [...(this.engineerTowers || []), ...(this.engineerTowersCrafting || [])]) {
                        const d = Math.abs(t.tileX - tileX) + Math.abs(t.tileY - tileY);
                        if (d < bestDist) { bestDist = d; best = t; }
                    }
                    if (best) this.removeEngineerTowerAt(best.tileX, best.tileY);
                }
                return;
            }
            if (this.currentElement === 'cosmic' && this._csCast) return;   // Cosmic.js: no R on cosmic
            // Singularity staff R-attack is now orb fire (was Collapse)
            // Only fires when the passive charge bar is full
            if (this.currentElement === 'cosmic' &&
                (this.equippedWeapons?.cosmic || 'cosmic_fists') === 'singularity_staff') {
                if ((this._singOrbCharge || 0) >= 1) {
                    this.singularityStaffFire(this.pointerX, this.pointerY);
                } else {
                    this.showStatusText(this.player.x, this.player.y - 28, 'ORB NOT READY', '#cc44ff');
                }
                return;
            }
            // Magma staff surge
            if (this.currentElement === 'fire' &&
                (this.equippedWeapons?.fire || 'flame_fists') === 'magma_staff') {
                this.magmaStaffRipple();
                return;
            }
            // Ignition — burst fire mode
            if (this.currentElement === 'fire' &&
                (this.equippedWeapons?.fire || 'flame_fists') === 'ignition') {
                this.kindlingIgnitionMode();
                return;
            }
            // The Circuit Breaker: a current down a wire
            if (this.currentElement === 'lightning' && this.equippedWeapons?.lightning === 'conductor') { this._conductorOverload(); return; }
            // Fractal Shard: the gamble (WeaponSystem._fractalGamble), charged by fan shards on the spikes' marks
            if (this.currentElement === 'ice' && this.equippedWeapons?.ice === 'fractal_shard') { this._fractalGamble(); return; }
            // Icicle Cannon: a full charge raises the Frost Shield (CombatSystem._frostShieldHit)
            if (this.currentElement === 'ice' &&
                (this.equippedWeapons?.ice || 'ice_fists') === 'icicle_cannon') {
                const HITS_TO_CHARGE = 28;
                if ((this._icicleHitCounter || 0) >= HITS_TO_CHARGE) {
                    this._icicleHitCounter = 0;
                    this._frostShieldUntil = this.time.now + 5000;
                    this._frostShieldFx?.();
                    this.showStatusText(this.player.x, this.player.y - 30, 'FROST SHIELD', '#bff4ff');
                    this._vfxBursts?.ice?.explode(20, this.player.x, this.player.y);
                    Sfx.play(this, 'freeze');
                    this.cameras.main.shake(40, 0.002);
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
        this._vfxInit();   // Visuals.js: zoom, the HUD camera, light, the void
        this._cfxInit();   // Creatures.js: faces, status effects, pickups
        this._csInit();    // Cosmic.js: boons, the cosmic gem, the boon tray
        this._bfxInit();   // Bosses.js: the bosses, their attacks, every enemy shot
        if (this.towerRun) this._towerBegin();   // Tower.js: the floor's waves, label and carried HP
        if (this.trainingRun) Training.begin(this);   // Training.js: the arena, its panel
    }

    // Cosmic's dash toward (dirX, dirY), and the bookkeeping that rides on it: each tile
    // crossed feeds Void Fists' momentum and the Singularity Staff. Shift and Space both land here.
    // Cosmic's dash: two hops, HOP_GAP apart, each to the open tile nearest the cursor within reach, at any angle
    // (ElementSystem.cosmicDashAim). The second aims again, so you can bend the pair, but you can't walk in between.
    // The cooldown runs from the second.
    // While an ult runs, your step: the fire ult's heat drives you (about 1.8x faster), the ice ult's cold weighs
    // you down (about 1.9x slower: you've gone dangerously cold, and move like it until it thaws).
    _iceShellBegin(...a) { return ElementSystem.prototype._iceShellBegin.call(this, ...a); }
    _deepCreak(...a) { return ElementSystem.prototype._deepCreak.call(this, ...a); }
    _deepShatterFx(...a) { return ElementSystem.prototype._deepShatterFx.call(this, ...a); }
    _iceFrostEarly(...a) { return ElementSystem.prototype._iceFrostEarly.call(this, ...a); }
    _forkCfg(...a) { return ElementSystem.prototype._forkCfg.call(this, ...a); }
    _forkTargets(...a) { return ElementSystem.prototype._forkTargets.call(this, ...a); }
    _forkThump(...a) { return ElementSystem.prototype._forkThump.call(this, ...a); }
    _forkAim(...a) { return ElementSystem.prototype._forkAim.call(this, ...a); }
    _forkBolt(...a) { return ElementSystem.prototype._forkBolt.call(this, ...a); }
    _forkBegin(...a) { return ElementSystem.prototype._forkBegin.call(this, ...a); }
    _forkIgnite(...a) { return ElementSystem.prototype._forkIgnite.call(this, ...a); }
    _encased(...a) { return ElementSystem.prototype._encased.call(this, ...a); }
    _iceShellTex(...a) { return ElementSystem.prototype._iceShellTex.call(this, ...a); }
    _iceShellEnd(...a) { return ElementSystem.prototype._iceShellEnd.call(this, ...a); }
    _galeSpawn(...a) { return ElementSystem.prototype._galeSpawn.call(this, ...a); }
    _iceFrostCfg(...a) { return ElementSystem.prototype._iceFrostCfg.call(this, ...a); }
    _iceFrostBegin(...a) { return ElementSystem.prototype._iceFrostBegin.call(this, ...a); }
    _ultMoveMult() {   // (a move delay multiplier: the ice ult's cold starts at 1.9 and wears off to 1 over its SLOW_MS)
        if (this.ignitionActive) return 0.55;
        if (this._forkAfter && this.time.now < this._forkAfter.until) return this._forkCfg().SPEED_MULT;   // Fork's aftermath: fast
        const now = this.time.now, f = now < (this._iceFrostUntil || 0) ? Math.max(0, 1 - (now - (this._iceFrostAt || 0)) / this._iceFrostCfg().SLOW_MS) : this.tsunamiActive ? 1 : 0;
        return 1 + 0.9 * f;
    }

    _cosmicDashToward() {
        const now = this.time.now, HOP_GAP = 400;
        if (this._cosmicHops || now - (this.lastCosmicDashTime || 0) < this.cosmicDashCooldown) return;
        this._cosmicHops = true;
        this._glideUntil = now + HOP_GAP + 150;   // the catch: you can't walk during it, from the first hop until just after the second
        this._cosmicHop();
        this.time.delayedCall(HOP_GAP, () => {
            this._cosmicHops = false; this.lastCosmicDashTime = this.time.now;
            if (this.currentElement === 'cosmic' && !this._deathScreenActive && !this._csRooted?.()) this._cosmicHop();
        });
    }
    _cosmicHop() {
        const preDashX = this.playerX, preDashY = this.playerY;
        if (!this.cosmicDashAim()) return;
        const tilesMoved = Math.max(Math.abs(this.playerX - preDashX), Math.abs(this.playerY - preDashY));
        Sfx.play(this, 'dash');
        PlayerStats.onDash(this);   // Rolling Guard
        if (!this._cosmicDashTilesLog) this._cosmicDashTilesLog = [];
        const now = this.time.now;
        for (let t = 0; t < tilesMoved; t++) this._cosmicDashTilesLog.push({ time: now });
        this._cosmicDashTilesLog = this._cosmicDashTilesLog.filter(e => now - e.time < 2000);
        this._singTilesTraversed = (this._singTilesTraversed || 0) + tilesMoved;
        this._csOnDash?.(tilesMoved);   // Cosmic.js: Void Fists' Momentum
        this._relicDashTrail?.(preDashX, preDashY, this.playerX, this.playerY);   // Trailblazer (a relic)
    }

    // Ignition in hand, and the click is its own (Meteor Strike has it during Scorch)
    _jetHeld() { return this.currentElement === 'fire' && this.equippedWeapons?.fire === 'ignition' && !(this._barrageOn && this.ignitionActive); }

    // The frame, behind a net: a throw inside a Phaser step ends its loop for good, and the game froze solid on one bad frame (a
    // kindle passing to an enemy its own damage had just killed did it, 2026-10-20). Each distinct error is logged once.
    update(time, delta) {
        try { this._frame(time, delta); }
        catch (err) {
            const k = String(err?.message || err); (this._frameErrs ||= new Set());
            if (!this._frameErrs.has(k)) { this._frameErrs.add(k); console.error('GameScene.update:', err); }
        }
    }

    _frame(time, delta) {
        // Everything below runs on the SCENE clock. Phaser hands update the loop's time, but every stamp the game keeps
        // (chill, staggers, cooldowns) is this.time.now, and the two part after a pause or a first-encounter card:
        // chill then decayed the frame it landed, and the ice shell's hold ended at once.
        time = this.time.now;
        // Pause / death — freeze everything
        if (this._pauseMenuOpen || this._deathScreenActive) return;
        if (this._cinemaUntil > time) { this._vfxUpdate?.(time, delta); return; }   // a rebirth shown up close: the fight holds (LevelManager._rebirthCinematic)
        // A first-encounter card holds the whole game until it is dismissed.
        if (this._bannerActive) return;
        if (this._forkStop) return;   // Fork: time has stopped
        this._firstEncounterCheck();

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
        if (this.towerRun) {
            try { this._towerUpdate(time); }
            catch (e) { console.error('Tower error:', e); }
        }
        if (this.trainingRun) { try { Training.update(this, time); } catch (e) { console.error('Training error:', e); } }

        const preUpdatePlayerX = this.playerX;
        const preUpdatePlayerY = this.playerY;

        if (this.currentElement === 'cosmic' && this.shiftKey.isDown && !this.shiftWasDown && !this._csRooted?.() && !this._frostPinned?.()) {   // (pinned: falls to the queue below, which refuses it)
            // Use stored pointer + scroll for guaranteed world coords
            const mouseWorldX = this.pointerX + this.cameras.main.scrollX;
            const mouseWorldY = this.pointerY + this.cameras.main.scrollY;
            const playerCenterX = this.playerX * this.TILE_SIZE + this.TILE_SIZE / 2;
            const playerCenterY = this.playerY * this.TILE_SIZE + this.TILE_SIZE / 2;

            this._cosmicDashToward();   // two hops toward the cursor, any angle
        } else if (this.shiftKey.isDown && !this.shiftWasDown) this._dashQueued = true;   // any other element: Shift dashes like Space
        this.shiftWasDown = this.shiftKey.isDown;

        this._updateGlide(this.time.now);   // a dash in progress (ElementSystem.js). The scene clock, as the dash set it: after a pause
        // the frame's `time` runs ahead of it by the pause, and the glide finished on its first frame
        // Dash: the way the movement keys point, or the way you last moved.
        if (this._dashQueued && (this._csRooted?.() || this._iceShellUntil > this.time.now)) this._dashQueued = false;   // transforming or encased: no dash
        if (this._dashQueued && this._frostPinned?.()) {   // inside a Frost Slime's lit grid: no movement skills
            this._dashQueued = false;
            if (this.time.now - (this._pinnedSaidAt || 0) > 700) { this._pinnedSaidAt = this.time.now; this.showStatusText(this.player.x, this.player.y - 30, 'FROZEN IN PLACE', '#bff4ff'); }
        }
        if (this._dashQueued) {
            this._dashQueued = false;
            let ddx = 0, ddy = 0;
            if (this.keys.W.isDown) ddy = -1;
            else if (this.keys.S.isDown) ddy = 1;
            else if (this.keys.A.isDown) ddx = -1;
            else if (this.keys.D.isDown) ddx = 1;
            if (!ddx && !ddy) {
                // standing still: toward the cursor (the way you last moved was often nowhere yet,
                // so Space did nothing until you'd taken a step)
                const ap = this._aim(this.input.activePointer), cam = this.cameras.main, T = this.TILE_SIZE;
                const mx = ap.x + cam.scrollX - (this.playerX * T + T / 2), my = ap.y + cam.scrollY - (this.playerY * T + T / 2);
                if (Math.abs(mx) + Math.abs(my) > 4) { if (Math.abs(mx) > Math.abs(my)) ddx = Math.sign(mx); else ddy = Math.sign(my); }
                else { ddx = this._lastMoveDir.x; ddy = this._lastMoveDir.y; }
            }
            if (this.currentElement === 'cosmic') this._cosmicDashToward();
            else this.playerDash(ddx, ddy);
        }

        // Water changes what a step costs. playerWaterMult is 1 on dry ground, so this
        // is inert on every level that never calls generateWaterBlobs.
        const _waterMult = (typeof this.playerWaterMult === 'function') ? this.playerWaterMult() : 1;
        // The step glide, by hand each frame: a tween does nothing on its first frame, so one per tile left a dead frame every
        // step. Anything else moving the slime (a dash, a knock, a teleport) leaves it somewhere we didn't put it: the glide stops.
        const _st = this._step;
        if (_st) {
            if (this.player.x !== _st.lx || this.player.y !== _st.ly) this._step = null;
            else {
                const u = Math.min(1, (this.time.now - _st.t0) / _st.dur), k = 0.25 * u + 0.75 * (0.5 - 0.5 * Math.cos(Math.PI * u));   // mostly a hop (it nearly settles each tile), a little even so it never stops
                this.player.setPosition(_st.lx = _st.fx + (_st.tx - _st.fx) * k, _st.ly = _st.fy + (_st.ty - _st.fy) * k);
                if (u >= 1) this._step = null;
            }
        }
        const stepMs = this.moveCooldown * _waterMult * (this._csMoveMult?.() ?? 1) * (this._frostHazeMult || 1) * (this._mods?.speed ?? 1) * Enchants.speed(this.equippedWeapons?.[this.currentElement]) * (this._chaosMove?.() ?? 1) * this._ultMoveMult();
        this._stepMul = stepMs / (200 * (this._mods?.speed ?? 1) * Enchants.speed(this.equippedWeapons?.[this.currentElement]));   // how much slower or faster than usual right now (relics and books aside): LevelManager._updateSpeedMarks
        if (time - this.lastMoveTime >= stepMs && this.time.now >= (this._staggerUntil || 0) && this.time.now >= (this._glideUntil || 0)) {   // (scene clock, not the loop's `time`: they part after a pause)   // Leaden: a corrupted book's curse; the Wheel of Fate; Double or Nothing's stagger
            let dx = 0, dy = 0;

            const isCosmicCharging = this.currentElement === 'cosmic' && this.cosmicCharging;

            if (!isCosmicCharging && !this.thunderheadActive && !this._playerRooted && !this._csRooted?.()) {
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
                    // Walking into an enemy hurts you, unless Ironhide's Spiked Hide turns it round.
                    if (PlayerStats.has(this, 'spiked')) this.damageEnemy(enemyAtTarget, 8 * this.damageScaling, this.currentElement);
                    else this.takeDamage(1);
                    this.lastMoveTime = time;
                    return;
                }

                if (newX >= 0 && newX < this.WORLD_WIDTH &&
                    newY >= 0 && newY < this.WORLD_HEIGHT &&
                    this.world[newX][newY] === this.FLOOR &&
                    !this.isNodeAt(newX, newY) && !this._csOutsideDomain?.(newX, newY)) {

                    // Level 4 — debris tiles are impassable for the player
                    if (this.isLevel4 && this._debrisTiles?.length && this.fractureCore?.active) {
                        const targetWx = newX * this.TILE_SIZE + this.TILE_SIZE / 2;
                        const targetWy = newY * this.TILE_SIZE + this.TILE_SIZE / 2;
                        if (this._isInCrack(targetWx, targetWy)) {
                            this.lastMoveTime = time;
                            return;
                        }
                    }

                    // Tutorial: if the target tile is a sealed door tile, block and flash it
                    if (this._roomGated() && this.lockedDoorTiles) {
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
                    const _kc = Enchants.n(this.equippedWeapons?.[this.currentElement], 'kinetic_core');   // Kinetic Core: every 10 tiles charge the ult
                    if (_kc && (this._kinSteps = (this._kinSteps || 0) + 1) % 10 === 0) this.gainUltCharge(this.ultChargeMax * _kc / 100, this.currentElement, true);
                    if (this._mods?.momentum) { (this._moveLog ||= []).push(time); if (this._moveLog.length > 40) this._moveLog.splice(0, 20); }   // Racing Heart
                    this._lastMoveDir = { x: dx, y: dy };
                    this._singTilesTraversed = (this._singTilesTraversed || 0) + 1;
                    const targetX = newX * this.TILE_SIZE + this.TILE_SIZE / 2;
                    const targetY = newY * this.TILE_SIZE + this.TILE_SIZE / 2 + this.SLIME_Y_OFFSET;
                    // the glide (above) lasts the whole step at an even speed, a little over so held keys never pause between tiles
                    // (it was a 100ms eased-out tween inside a 200ms step: a lurch and a stop every tile)
                    this._step = { fx: this.player.x, fy: this.player.y, lx: this.player.x, ly: this.player.y, tx: targetX, ty: targetY, t0: this.time.now, dur: Math.min(320, stepMs + 20) };
                    this._vfxHop(this.player, undefined, Math.min(320, stepMs + 20));   // squash and stretch over the step (Visuals.js)

                    this.lastMoveTime = time;
                    this.player.stop();
                    this.player.setFrame(0);
                    this.isIdling = false;
                    if (this.nodeChannelActive) this.cancelNodeChannel();
                    this.updateHUD();
                    this._checkRoomNameDisplay();
                    if (this.isLevel4) this._onPlayerStepCrumble(this.playerX, this.playerY);
                    this._onPlayerStepWater(this.playerX, this.playerY, time);
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
                    this._onPlayerStepWater(this.playerX, this.playerY, time);
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

        // Ignition is a flamethrower: a click lights it or puts it out (_jetLit), the cursor only aims it; it runs on fuel
        this._jetFuelTick(delta);
        const jetOn = this._jetLit && this._jetHeld();
        if (this.isPointerDown || jetOn) {
            this.fireEquippedWeapon(this.pointerX, this.pointerY);
        }
        this.updateFireballs(delta);
        this._ultHit = null;   // updateFireballs marks the ult's own
        this.updateLightningOrbs(delta);
        this.updateSingularityStaff(delta);
        this.updateSingOrbCharge(delta);
        this.updateCollapseMode(delta);

        // Magma Surge readiness (it runs on the staff's heat) — only while the staff is out on fire
        if (this.currentElement === 'fire' &&
            (this.equippedWeapons?.fire || 'flame_fists') === 'magma_staff') {
            // the Surge spends the staff's heat: ready once there's enough of it to dump
            this._magmaRippleReady = (this._magmaHeat || 0) >= WeaponSystem.SURGE_MIN_HEAT && this.time.now >= (this._magmaSurgeCdUntil || 0);
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
        this._updateMagmaHeat(time);
        this._updateKindling(time, delta);
        this.updateWater(time);
        this.updatePipes(time);
        this.updateFieldKit(time);
        PlayerStats.tick(this, time, delta);   // Mending
        this._updateAllies(time);
        this._updateMusic(time);
        this._tickRunStats(time, delta);
        this._followResistMarks();
        this.updateIceCubes(time);
        this._updateKindleIgniteBar();
        this._updateFractalBar();
        this.updateBallLightnings(time, delta);
        this.updateBallSeekers(time, delta);
        this._conductorTick(time, delta);
        this._cisternRoomCheck();
        this._updateCisternEnemies(time, delta);
        this._updateBudding(time);
        this._updateHunters(time, delta);
        this._updateArmored(time);
        this._updateSpeedMarks(time);
        this._updateElites(time, delta);
        this._updateBleed(time);
        this._updatePoison(time);
        this._playerStatusRow(time);
        this.updateIceShards(delta);
        this.updateBrittleDecay(time);
        this.updateEngineerTowers(time);
        this.updateTeslaBolts(delta);
        this.updateEngineerBullets(delta);
        this.updateRangedEnemies(time);
        this.updateEnemyProjectiles(delta);
        this.updateFloorTraps(time);
        this.updateGroundDrops();
        this.updatePortals(time);
        this.updateSuperConductors(time);
        this.updateNodeChannel(time);
        this.updateOrbScraps();

        // Icicle cannon bars — reposition every frame to follow player
        if (this.player && (this._icicleBarBg || this._icicleHealBg)) {
            const BAR_W = 44;
            const bx = this.player.x;
            const by = this.player.y - 28;
            if (this._icicleBarLabel) { this._icicleBarLabel.x = bx;              this._icicleBarLabel.y = by + 6; }
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
        if (this.engineerBuildMode && this._engineerBuildRing) {
            this._redrawEngineerBuildRing();
        }
        this.updateTsunami(time);
        this.updateStormCloud(time);
        this.updateStormField(time);
        this.updateThunderhead(time, delta);

        // Level 2 boss: updated once a frame, above. It was updated here a second time, so its
        // shots flew and turned at double their numbers; those are doubled where they are set.
        this.updateCosmicChanneling(time);
        this.updateCosmicCharge(time);
        // Black hole projectile removed - using laser ult instead
        this.updateCosmicBlackHoleProjectile(delta);
        this.updateCosmicBlackHole(time);

        // Ult gems animate every frame (pulse, lockout sweep, ready ping).
        this._drawUltGems();
        this._chaosTick?.(time);   // the Wheel of Fate (Relics.js, the Chaos shelf)
        this._vfxUpdate(time, delta);
        this._cfxUpdate(time, delta);
        this._csUpdate(time, delta);
        this._stackStatusIcons();   // after everything that places them (HUD.js)
        this._bfxUpdate(time, delta);

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
    generateLevel6(...a) { return WorldGen.prototype.generateLevel6.call(this, ...a); }
    _gauntletFixed(...a) { return WorldGen.prototype._gauntletFixed.call(this, ...a); }
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
    _dressRooms(...a) { return WorldGen.prototype._dressRooms.call(this, ...a); }
    _roomDoors(...a) { return WorldGen.prototype._roomDoors.call(this, ...a); }
    _roomConnected(...a) { return WorldGen.prototype._roomConnected.call(this, ...a); }
    placePlayer(...a) { return WorldGen.prototype.placePlayer.call(this, ...a); }
    createRng(...a) { return WorldGen.prototype.createRng.call(this, ...a); }

    // TutorialManager
    updateTutorial(...a) { return TutorialManager.prototype.updateTutorial.call(this, ...a); }
    // LevelManager proxies
    updateLevel2(...a)          { return LevelManager.prototype.updateLevel2.call(this, ...a); }
    _poolTilesAt(...a) { return LevelManager.prototype._poolTilesAt.call(this, ...a); }
    enemiesSharingPool(...a) { return LevelManager.prototype.enemiesSharingPool.call(this, ...a); }
    _energizeCfg(...a) { return LevelManager.prototype._energizeCfg.call(this, ...a); }
    _energizePool(...a) { return LevelManager.prototype._energizePool.call(this, ...a); }
    _energizeFlash(...a) { return LevelManager.prototype._energizeFlash.call(this, ...a); }
    _level2RoomClear(...a)      { return LevelManager.prototype._level2RoomClear.call(this, ...a); }
    spawnLevel2Enemies(...a)    { return LevelManager.prototype.spawnLevel2Enemies.call(this, ...a); }
    _spawnLevel2ChestRooms(...a){ return LevelManager.prototype._spawnLevel2ChestRooms.call(this, ...a); }
    // Level 3 proxies
    updateLevel3(...a)           { return LevelManager.prototype.updateLevel3.call(this, ...a); }
    // Level 4 proxies
    updateLevel4(...a)           { return LevelManager.prototype.updateLevel4.call(this, ...a); }
    spawnLevel4Enemies(...a)     { return LevelManager.prototype.spawnLevel4Enemies.call(this, ...a); }
    spawnLevel6Enemies(...a) { return LevelManager.prototype.spawnLevel6Enemies.call(this, ...a); }
    _spawnLevel4ChestRooms(...a) { return LevelManager.prototype._spawnLevel4ChestRooms.call(this, ...a); }
    _level4RoomClear(...a)       { return LevelManager.prototype._level4RoomClear.call(this, ...a); }
    spawnFractureCoreStub(...a)  { return LevelManager.prototype.spawnFractureCoreStub.call(this, ...a); }
    _spawnFractureCore(...a)     { return LevelManager.prototype._spawnFractureCore.call(this, ...a); }
    _updateFractureCore(...a)    { return LevelManager.prototype._updateFractureCore.call(this, ...a); }
    damageFractureCore(...a)     { return LevelManager.prototype.damageFractureCore.call(this, ...a); }

    _isInCrack(...a)             { return LevelManager.prototype._isInCrack.call(this, ...a); }

    _drawWeakPointInner(...a)     { return LevelManager.prototype._drawWeakPointInner.call(this, ...a); }
    _drawWeakPointRing(...a)      { return LevelManager.prototype._drawWeakPointRing.call(this, ...a); }
    _drawWeakPointRing2(...a)     { return LevelManager.prototype._drawWeakPointRing2.call(this, ...a); }
    _activateWeakPoint(...a)      { return LevelManager.prototype._activateWeakPoint.call(this, ...a); }
    _updateWeakPointBar(...a)     { return LevelManager.prototype._updateWeakPointBar.call(this, ...a); }

    _checkProjectileCrackShrink(...a) { return LevelManager.prototype._checkProjectileCrackShrink.call(this, ...a); }
    spawnLevel4Enemy(...a)        { return LevelManager.prototype.spawnLevel4Enemy.call(this, ...a); }
    _hitFractureWeakPoint(...a)   { return LevelManager.prototype._hitFractureWeakPoint.call(this, ...a); }
    _tryHitCurrentWeakPoint(...a) { return LevelManager.prototype._tryHitCurrentWeakPoint.call(this, ...a); }
    _isClickOnActiveWeakPoint(...a) { return LevelManager.prototype._isClickOnActiveWeakPoint.call(this, ...a); }
    _initDebris(...a)              { return LevelManager.prototype._initDebris.call(this, ...a); }
    _triggerCeilingWarning(...a)   { return LevelManager.prototype._triggerCeilingWarning.call(this, ...a); }
    _dropDebris(...a)              { return LevelManager.prototype._dropDebris.call(this, ...a); }
    _redrawDebrisTile(...a)        { return LevelManager.prototype._redrawDebrisTile.call(this, ...a); }
    _updateDebris(...a)            { return LevelManager.prototype._updateDebris.call(this, ...a); }
    _pushPlayerOutOfDebris(...a)   { return LevelManager.prototype._pushPlayerOutOfDebris.call(this, ...a); }
    _debrisSpawnBurst(...a)        { return LevelManager.prototype._debrisSpawnBurst.call(this, ...a); }
    _findSpawnTileNear(...a)       { return LevelManager.prototype._findSpawnTileNear.call(this, ...a); }
    _clusterTiles(...a) { return LevelManager.prototype._clusterTiles.call(this, ...a); }
    spawnCluster(...a) { return LevelManager.prototype.spawnCluster.call(this, ...a); }
    _densestPointInRoom(...a) { return LevelManager.prototype._densestPointInRoom.call(this, ...a); }
    _placeSupportInCluster(...a) { return LevelManager.prototype._placeSupportInCluster.call(this, ...a); }
    _cleanupDebris(...a)           { return LevelManager.prototype._cleanupDebris.call(this, ...a); }
    _fractureCoreSurface(...a)    { return LevelManager.prototype._fractureCoreSurface.call(this, ...a); }
    _updateSurfaceWindow(...a)    { return LevelManager.prototype._updateSurfaceWindow.call(this, ...a); }
    _voidMawHop(...a)             { return LevelManager.prototype._voidMawHop.call(this, ...a); }
    _showRhythmSessionBanner(...a){ return LevelManager.prototype._showRhythmSessionBanner.call(this, ...a); }
    _gradeColor(...a)             { return LevelManager.prototype._gradeColor.call(this, ...a); }
    _worseGrade(...a)             { return LevelManager.prototype._worseGrade.call(this, ...a); }
    _gradeForDiff(...a)            { return LevelManager.prototype._gradeForDiff.call(this, ...a); }
    _resolveWeakPoint(...a)        { return LevelManager.prototype._resolveWeakPoint.call(this, ...a); }
    _fractureCoreSurfaceAbort(...a){ return LevelManager.prototype._fractureCoreSurfaceAbort.call(this, ...a); }
    _gradeWeight(...a)             { return LevelManager.prototype._gradeWeight.call(this, ...a); }
    _fractureCoreSubmerge(...a)   { return LevelManager.prototype._fractureCoreSubmerge.call(this, ...a); }

    _fractureCoreKill(...a)      { return LevelManager.prototype._fractureCoreKill.call(this, ...a); }
    _geodeCfg(...a) { return LevelManager.prototype._geodeCfg.call(this, ...a); }
    _geodePhase(...a) { return LevelManager.prototype._geodePhase.call(this, ...a); }
    _geodeArm(...a) { return LevelManager.prototype._geodeArm.call(this, ...a); }
    _geodePlateFacing(...a) { return LevelManager.prototype._geodePlateFacing.call(this, ...a); }
    _geodeHit(...a) { return LevelManager.prototype._geodeHit.call(this, ...a); }
    _geodeShatter(...a) { return LevelManager.prototype._geodeShatter.call(this, ...a); }
    _geodeExpose(...a) { return LevelManager.prototype._geodeExpose.call(this, ...a); }
    _geodeHurt(...a) { return LevelManager.prototype._geodeHurt.call(this, ...a); }
    _geodeFault(...a) { return LevelManager.prototype._geodeFault.call(this, ...a); }
    _geodeRift(...a) { return LevelManager.prototype._geodeRift.call(this, ...a); }
    _geodeStoneBreak(...a) { return LevelManager.prototype._geodeStoneBreak.call(this, ...a); }
    _geodeSpawnAdd(...a) { return LevelManager.prototype._geodeSpawnAdd.call(this, ...a); }
    _geodeHop(...a) { return LevelManager.prototype._geodeHop.call(this, ...a); }
    _geodeUpdate(...a) { return LevelManager.prototype._geodeUpdate.call(this, ...a); }
    _geodeDraw(...a) { return LevelManager.prototype._geodeDraw.call(this, ...a); }
    _fcCfg(...a) { return LevelManager.prototype._fcCfg.call(this, ...a); }
    _fcFree(...a) { return LevelManager.prototype._fcFree.call(this, ...a); }
    _fcPile(...a) { return LevelManager.prototype._fcPile.call(this, ...a); }
    _fcRocks(...a) { return LevelManager.prototype._fcRocks.call(this, ...a); }
    _fcCrumble(...a) { return LevelManager.prototype._fcCrumble.call(this, ...a); }
    _fcPhaseOf(...a) { return LevelManager.prototype._fcPhaseOf.call(this, ...a); }
    _fcHide(...a) { return LevelManager.prototype._fcHide.call(this, ...a); }
    _fcHurt(...a) { return LevelManager.prototype._fcHurt.call(this, ...a); }
    _fcOpenFissure(...a) { return LevelManager.prototype._fcOpenFissure.call(this, ...a); }
    _fcOnScreen(...a) { return LevelManager.prototype._fcOnScreen.call(this, ...a); }
    _fcArrows(...a) { return LevelManager.prototype._fcArrows.call(this, ...a); }
    _fcStage(...a) { return LevelManager.prototype._fcStage.call(this, ...a); }
    _fcTempo(...a) { return LevelManager.prototype._fcTempo.call(this, ...a); }
    _fcDrawFissure(...a) { return LevelManager.prototype._fcDrawFissure.call(this, ...a); }
    _fcHitFissure(...a) { return LevelManager.prototype._fcHitFissure.call(this, ...a); }
    _fcSeal(...a) { return LevelManager.prototype._fcSeal.call(this, ...a); }
    _fcHitFissureTile(...a) { return LevelManager.prototype._fcHitFissureTile.call(this, ...a); }
    _fcRhythmStart(...a) { return LevelManager.prototype._fcRhythmStart.call(this, ...a); }
    _fcGrade(...a) { return LevelManager.prototype._fcGrade.call(this, ...a); }
    _fcJudge(...a) { return LevelManager.prototype._fcJudge.call(this, ...a); }
    _fcRhythmTick(...a) { return LevelManager.prototype._fcRhythmTick.call(this, ...a); }
    _fcRhythmEnd(...a) { return LevelManager.prototype._fcRhythmEnd.call(this, ...a); }
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
    _setSpeedIndicator(...a)     { return EnemyManager.prototype._setSpeedIndicator.call(this, ...a); }
    _startSpeedIndicator(...a)   { return EnemyManager.prototype._startSpeedIndicator.call(this, ...a); }
    _spawnSpeedArrow(...a)       { return EnemyManager.prototype._spawnSpeedArrow.call(this, ...a); }
    _berserkerSwing(...a)        { return EnemyManager.prototype._berserkerSwing.call(this, ...a); }
    createQueenSlimePortal(...a) { return LevelManager.prototype.createQueenSlimePortal.call(this, ...a); }
    _rootPlayer(...a)            { return LevelManager.prototype._rootPlayer.call(this, ...a); }
    _ccGate(...a) { return LevelManager.prototype._ccGate.call(this, ...a); }
    _voidSovereignNextAttack(...a){ return LevelManager.prototype._voidSovereignNextAttack.call(this, ...a); }
    _voidSovereignDoAttack(...a) { return LevelManager.prototype._voidSovereignDoAttack.call(this, ...a); }
    _vsAttackVoidMines(...a)     { return LevelManager.prototype._vsAttackVoidMines.call(this, ...a); }
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
    _bossCube(...a) { return LevelManager.prototype._bossCube.call(this, ...a); }
    _bossCubeShatter(...a) { return LevelManager.prototype._bossCubeShatter.call(this, ...a); }
    _bossIceWatch(...a) { return LevelManager.prototype._bossIceWatch.call(this, ...a); }
    _bossBrittle(...a) { return CombatSystem.prototype._bossBrittle.call(this, ...a); }
    freezeBossFromIceWeapon(...a) { return LevelManager.prototype.freezeBossFromIceWeapon.call(this, ...a); }
    spawnFinalLevelChest(...a)  { return LevelManager.prototype.spawnFinalLevelChest.call(this, ...a); }
    openFinalLevelChest(...a)   { return LevelManager.prototype.openFinalLevelChest.call(this, ...a); }
    _showElementUnlockCinematic(...a) { return LevelManager.prototype._showElementUnlockCinematic.call(this, ...a); }
    onGlorpsCollected(...a) { return TutorialManager.prototype.onGlorpsCollected.call(this, ...a); }
    isInLockedRoom(...a) { return LevelManager.prototype.isInLockedRoom.call(this, ...a); }
    getCurrentPlayerRoom(...a) { return LevelManager.prototype.getCurrentPlayerRoom.call(this, ...a); }
    _floorCfg(...a)          { return LevelManager.prototype._floorCfg.call(this, ...a); }
    _tagResist(...a)         { return LevelManager.prototype._tagResist.call(this, ...a); }
    _spreadResistance(...a)  { return LevelManager.prototype._spreadResistance.call(this, ...a); }
    _buildResistAura(...a)   { return LevelManager.prototype._buildResistAura.call(this, ...a); }
    _showResistShield(...a)  { return CombatSystem.prototype._showResistShield.call(this, ...a); }
    addChillStacks(...a) { return CombatSystem.prototype.addChillStacks.call(this, ...a); }
    applyChill(...a) { return CombatSystem.prototype.applyChill.call(this, ...a); }
    _chillCfg(...a) { return CombatSystem.prototype._chillCfg.call(this, ...a); }
    _iceCubeCfg(...a) { return CombatSystem.prototype._iceCubeCfg.call(this, ...a); }
    makeIceCube(...a) { return CombatSystem.prototype.makeIceCube.call(this, ...a); }
    _drawIceCube(...a) { return CombatSystem.prototype._drawIceCube.call(this, ...a); }
    _clearIceCubeVisual(...a) { return CombatSystem.prototype._clearIceCubeVisual.call(this, ...a); }
    shatterIceCube(...a) { return CombatSystem.prototype.shatterIceCube.call(this, ...a); }
    updateIceCubes(...a) { return CombatSystem.prototype.updateIceCubes.call(this, ...a); }
    applyFloorScaling(...a)  { return LevelManager.prototype.applyFloorScaling.call(this, ...a); }
    _waterCfg(...a) { return LevelManager.prototype._waterCfg.call(this, ...a); }
    initWater(...a) { return LevelManager.prototype.initWater.call(this, ...a); }
    _wKey(...a) { return LevelManager.prototype._wKey.call(this, ...a); }
    isWaterAt(...a) { return LevelManager.prototype.isWaterAt.call(this, ...a); }
    isSteamAt(...a) { return LevelManager.prototype.isSteamAt.call(this, ...a); }
    addWater(...a) { return LevelManager.prototype.addWater.call(this, ...a); }
    evaporateWater(...a) { return LevelManager.prototype.evaporateWater.call(this, ...a); }
    _steamPuff(...a) { return LevelManager.prototype._steamPuff.call(this, ...a); }
    _fogOn(...a) { return LevelManager.prototype._fogOn.call(this, ...a); }
    _fogOff(...a) { return LevelManager.prototype._fogOff.call(this, ...a); }
    updateWater(...a) { return LevelManager.prototype.updateWater.call(this, ...a); }
    _waterPatch(...a) { return LevelManager.prototype._waterPatch.call(this, ...a); }
    _frostGridTick(...a) { return LevelManager.prototype._frostGridTick.call(this, ...a); }
    _frostPinned(...a) { return LevelManager.prototype._frostPinned.call(this, ...a); }
    _bakeWater(...a) { return LevelManager.prototype._bakeWater.call(this, ...a); }
    _redrawWater(...a) { return LevelManager.prototype._redrawWater.call(this, ...a); }
    generateWaterBlobs(...a) { return LevelManager.prototype.generateWaterBlobs.call(this, ...a); }
    playerWaterMult(...a) { return LevelManager.prototype.playerWaterMult.call(this, ...a); }
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
    _roomGated(...a) { return LevelManager.prototype._roomGated.call(this, ...a); }
    _cisternRoomCheck(...a) { return LevelManager.prototype._cisternRoomCheck.call(this, ...a); }
    _onPlayerStepWater(...a) { return LevelManager.prototype._onPlayerStepWater.call(this, ...a); }
    _updateCisternEnemies(...a) { return LevelManager.prototype._updateCisternEnemies.call(this, ...a); }
    _cisternMark(...a)       { return LevelManager.prototype._cisternMark.call(this, ...a); }
    _drownSubmergePlayer(...a){ return LevelManager.prototype._drownSubmergePlayer.call(this, ...a); }
    _drownSurfacePlayer(...a){ return LevelManager.prototype._drownSurfacePlayer.call(this, ...a); }
    _pipeCfg(...a)           { return LevelManager.prototype._pipeCfg.call(this, ...a); }
    initPipes(...a)          { return LevelManager.prototype.initPipes.call(this, ...a); }
    _pipeTiles(...a)         { return LevelManager.prototype._pipeTiles.call(this, ...a); }
    _drawPipeMouths(...a)    { return LevelManager.prototype._drawPipeMouths.call(this, ...a); }
    _startPipeDrips(...a)    { return LevelManager.prototype._startPipeDrips.call(this, ...a); }
    updatePipes(...a)        { return LevelManager.prototype.updatePipes.call(this, ...a); }
    _pipeTrickle(...a)       { return LevelManager.prototype._pipeTrickle.call(this, ...a); }
    _drownWeeds(...a)        { return LevelManager.prototype._drownWeeds.call(this, ...a); }
    _drownLockMark(...a)     { return LevelManager.prototype._drownLockMark.call(this, ...a); }
    _clearCisternGfx(...a)   { return LevelManager.prototype._clearCisternGfx.call(this, ...a); }
    createTidalGuard(...a)   { return LevelManager.prototype.createTidalGuard.call(this, ...a); }
    _tgTiles(...a)           { return LevelManager.prototype._tgTiles.call(this, ...a); }
    _tgAimAt(...a)           { return LevelManager.prototype._tgAimAt.call(this, ...a); }
    _tgDrawAim(...a)         { return LevelManager.prototype._tgDrawAim.call(this, ...a); }
    _tgFire(...a)            { return LevelManager.prototype._tgFire.call(this, ...a); }
    _dripCfg(...a)           { return LevelManager.prototype._dripCfg.call(this, ...a); }
    _applyDripping(...a)     { return LevelManager.prototype._applyDripping.call(this, ...a); }
    _updateDripping(...a)    { return LevelManager.prototype._updateDripping.call(this, ...a); }
    createWishingWell(...a)  { return LevelManager.prototype.createWishingWell.call(this, ...a); }
    _wwBlob(...a)            { return LevelManager.prototype._wwBlob.call(this, ...a); }
    _wwLob(...a)             { return LevelManager.prototype._wwLob.call(this, ...a); }
    _wwPulse(...a)           { return LevelManager.prototype._wwPulse.call(this, ...a); }
    _enemyWet(...a)          { return LevelManager.prototype._enemyWet.call(this, ...a); }
    _drownWarn(...a)         { return LevelManager.prototype._drownWarn.call(this, ...a); }
    _fireRippleVolley(...a)  { return LevelManager.prototype._fireRippleVolley.call(this, ...a); }
    _rippleDetonate(...a)    { return LevelManager.prototype._rippleDetonate.call(this, ...a); }
    _updateRippleOrbs(...a)  { return LevelManager.prototype._updateRippleOrbs.call(this, ...a); }
    _waveTell(...a)          { return LevelManager.prototype._waveTell.call(this, ...a); }
    _waveClearTell(...a)     { return LevelManager.prototype._waveClearTell.call(this, ...a); }
    _updateWaveCharge(...a)  { return LevelManager.prototype._updateWaveCharge.call(this, ...a); }
    _unstick(...a) { return LevelManager.prototype._unstick.call(this, ...a); }
    _spreadUltBlockers(...a) { return LevelManager.prototype._spreadUltBlockers.call(this, ...a); }
    _rollResist(...a) { return LevelManager.prototype._rollResist.call(this, ...a); }
    _enemyTypeKey(...a)        { return LevelManager.prototype._enemyTypeKey.call(this, ...a); }
    _enemyCodex(...a)          { return LevelManager.prototype._enemyCodex.call(this, ...a); }
    _seenEnemies(...a)         { return LevelManager.prototype._seenEnemies.call(this, ...a); }
    _markEnemySeen(...a)       { return LevelManager.prototype._markEnemySeen.call(this, ...a); }
    _firstEncounterCheck(...a) { return LevelManager.prototype._firstEncounterCheck.call(this, ...a); }
    _showEnemyBanner(...a)     { return LevelManager.prototype._showEnemyBanner.call(this, ...a); }
    createDrowner(...a)      { return LevelManager.prototype.createDrowner.call(this, ...a); }
    createRipplerunner(...a) { return LevelManager.prototype.createRipplerunner.call(this, ...a); }
    createTidecaller(...a)   { return LevelManager.prototype.createTidecaller.call(this, ...a); }
    createWaveRider(...a)    { return LevelManager.prototype.createWaveRider.call(this, ...a); }
    createConduit(...a)      { return LevelManager.prototype.createConduit.call(this, ...a); }
    getPortalAt(...a) { return LevelManager.prototype.getPortalAt.call(this, ...a); }
    // Required: getPortalAt is proxied with .call(this), so `this` is the SCENE and its
    // internal this._portalCoversTile(...) resolves here, not on LevelManager.prototype.
    // Without this stub every portal hit test throws instead of missing.
    _portalCoversTile(...a) { return LevelManager.prototype._portalCoversTile.call(this, ...a); }
    _queenPulse(...a) { return LevelManager.prototype._queenPulse.call(this, ...a); }
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
    _tutSay(...a) { return TutorialManager.prototype._tutSay.call(this, ...a); }
    _k(...a) { return TutorialManager.prototype._k.call(this, ...a); }
    _tutObjective(...a) { return TutorialManager.prototype._tutObjective.call(this, ...a); }
    _tutTips(...a) { return TutorialManager.prototype._tutTips.call(this, ...a); }
    clearTutorialDialogue(...a) { return TutorialManager.prototype.clearTutorialDialogue.call(this, ...a); }
    spawnEnemies(...a) { return LevelManager.prototype.spawnEnemies.call(this, ...a); }
    spawnTutorialEnemies(...a) { return TutorialManager.prototype.spawnTutorialEnemies.call(this, ...a); }
    spawnIceTutorialEnemies(...a) { return TutorialManager.prototype.spawnIceTutorialEnemies.call(this, ...a); }
    createRangedEnemy(...a) { return EnemyManager.prototype.createRangedEnemy.call(this, ...a); }
    _applyUltAbsorberVisual(...a) { return TutorialManager.prototype._applyUltAbsorberVisual.call(this, ...a); }
    _ultBlockerFx(...a) { return TutorialManager.prototype._ultBlockerFx.call(this, ...a); }
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
    _updateKindleIgniteBar(...a) { return WeaponSystem.prototype._updateKindleIgniteBar.call(this, ...a); }
    _destroyKindleIgniteBar(...a) { return WeaponSystem.prototype._destroyKindleIgniteBar.call(this, ...a); }
    _cascadeForks(...a) { return WeaponSystem.prototype._cascadeForks.call(this, ...a); }
    _embedBall(...a) { return WeaponSystem.prototype._embedBall.call(this, ...a); }
    _updateEmbeddedBall(...a) { return WeaponSystem.prototype._updateEmbeddedBall.call(this, ...a); }
    _detonateEmbedded(...a) { return WeaponSystem.prototype._detonateEmbedded.call(this, ...a); }
    _strokeFork(...a) { return WeaponSystem.prototype._strokeFork.call(this, ...a); }
    _arcPath(...a) { return WeaponSystem.prototype._arcPath.call(this, ...a); }
    _strokeArc(...a) { return WeaponSystem.prototype._strokeArc.call(this, ...a); }
    engineeringDegreeAttack(...a) { return WeaponSystem.prototype.engineeringDegreeAttack.call(this, ...a); }
    _throwWrenchArc(...a) { return WeaponSystem.prototype._throwWrenchArc.call(this, ...a); }
    _wrenchImpact(...a) { return WeaponSystem.prototype._wrenchImpact.call(this, ...a); }
    _drawWrenchGfx(...a) { return WeaponSystem.prototype._drawWrenchGfx.call(this, ...a); }
    _blCfg(...a) { return WeaponSystem.prototype._blCfg.call(this, ...a); }
    ballLightningAttack(...a) { return WeaponSystem.prototype.ballLightningAttack.call(this, ...a); }
    _drawBallGfx(...a) { return WeaponSystem.prototype._drawBallGfx.call(this, ...a); }
    updateBallLightnings(...a) { return WeaponSystem.prototype.updateBallLightnings.call(this, ...a); }
    _ballDischarge(...a) { return WeaponSystem.prototype._ballDischarge.call(this, ...a); }
    _burstBallLightning(...a) { return WeaponSystem.prototype._burstBallLightning.call(this, ...a); }
    updateBallSeekers(...a) { return WeaponSystem.prototype.updateBallSeekers.call(this, ...a); }
    _seekerHit(...a) { return WeaponSystem.prototype._seekerHit.call(this, ...a); }
    fireEquippedWeapon(...a) { return WeaponSystem.prototype.fireEquippedWeapon.call(this, ...a); }
    flameFistsAttack(...a) { return WeaponSystem.prototype.flameFistsAttack.call(this, ...a); }
    lightningFistsAttack(...a) { return WeaponSystem.prototype.lightningFistsAttack.call(this, ...a); }
    iceFistsAttack(...a) { return WeaponSystem.prototype.iceFistsAttack.call(this, ...a); }
    icicleStaffAttack(...a) { return WeaponSystem.prototype.icicleStaffAttack.call(this, ...a); }
    _fireIcicleNovaBurst(...a) { return WeaponSystem.prototype._fireIcicleNovaBurst.call(this, ...a); }

    applyIceFistsHit(...a)     { return WeaponSystem.prototype.applyIceFistsHit.call(this, ...a); }
    applyIcicleCannonHit(...a)   { return WeaponSystem.prototype.applyIcicleCannonHit.call(this, ...a); }
    applyFractalShardHit(...a)   { return WeaponSystem.prototype.applyFractalShardHit.call(this, ...a); }
    _updateChillIndicator(...a) { return WeaponSystem.prototype._updateChillIndicator.call(this, ...a); }
    _destroyChillIndicator(...a) { return WeaponSystem.prototype._destroyChillIndicator.call(this, ...a); }
    _showStunIndicator(...a) { return WeaponSystem.prototype._showStunIndicator.call(this, ...a); }
    _clearStunIndicator(...a) { return WeaponSystem.prototype._clearStunIndicator.call(this, ...a); }
    _applyGoldMark(...a)         { return WeaponSystem.prototype._applyGoldMark.call(this, ...a); }
    _applyPurpleMark(...a)       { return WeaponSystem.prototype._applyPurpleMark.call(this, ...a); }
    _clearShatterMark(...a)      { return WeaponSystem.prototype._clearShatterMark.call(this, ...a); }
    _applyGoldMarkBoss(...a)     { return WeaponSystem.prototype._applyGoldMarkBoss.call(this, ...a); }
    _applyPurpleMarkBoss(...a)   { return WeaponSystem.prototype._applyPurpleMarkBoss.call(this, ...a); }
    _applyIceElementalChill(...a) { return CombatSystem.prototype._applyIceElementalChill.call(this, ...a); }
    _triggerShatterBurst(...a) { return WeaponSystem.prototype._triggerShatterBurst.call(this, ...a); }
    _clearFreezeVisuals(...a)  { return WeaponSystem.prototype._clearFreezeVisuals.call(this, ...a); }
    _shatterWaterSplash(...a) { return WeaponSystem.prototype._shatterWaterSplash.call(this, ...a); }
    _conductorCfg(...a) { return WeaponSystem.prototype._conductorCfg.call(this, ...a); }
    conductorAttack(...a) { return WeaponSystem.prototype.conductorAttack.call(this, ...a); }
    _condWielding(...a) { return WeaponSystem.prototype._condWielding.call(this, ...a); }
    _condBigs(...a) { return WeaponSystem.prototype._condBigs.call(this, ...a); }
    _condTargets(...a) { return WeaponSystem.prototype._condTargets.call(this, ...a); }
    _condHit(...a) { return WeaponSystem.prototype._condHit.call(this, ...a); }
    _condSC(...a) { return WeaponSystem.prototype._condSC.call(this, ...a); }
    _condCable(...a) { return WeaponSystem.prototype._condCable.call(this, ...a); }
    _condClear(...a) { return WeaponSystem.prototype._condClear.call(this, ...a); }
    _condCapDraw(...a) { return WeaponSystem.prototype._condCapDraw.call(this, ...a); }
    _condInsDraw(...a) { return WeaponSystem.prototype._condInsDraw.call(this, ...a); }
    _condThrow(...a) { return WeaponSystem.prototype._condThrow.call(this, ...a); }
    _condResample(...a) { return WeaponSystem.prototype._condResample.call(this, ...a); }
    _condWebMul(...a) { return WeaponSystem.prototype._condWebMul.call(this, ...a); }
    _condDaze(...a) { return WeaponSystem.prototype._condDaze.call(this, ...a); }
    _condPulse(...a) { return WeaponSystem.prototype._condPulse.call(this, ...a); }
    _condTip(...a) { return WeaponSystem.prototype._condTip.call(this, ...a); }
    _condSpark(...a) { return WeaponSystem.prototype._condSpark.call(this, ...a); }
    _condSnap(...a) { return WeaponSystem.prototype._condSnap.call(this, ...a); }
    _condCurve(...a) { return WeaponSystem.prototype._condCurve.call(this, ...a); }
    _conductorTick(...a) { return WeaponSystem.prototype._conductorTick.call(this, ...a); }
    _conductorOverload(...a) { return WeaponSystem.prototype._conductorOverload.call(this, ...a); }
    _shotX(...a) { return WeaponSystem.prototype._shotX.call(this, ...a); }
    _shotY(...a) { return WeaponSystem.prototype._shotY.call(this, ...a); }
    flameSwordAttack(...a) { return WeaponSystem.prototype.flameSwordAttack.call(this, ...a); }
    magmaStaffAttack(...a)  { return WeaponSystem.prototype.magmaStaffAttack.call(this, ...a); }
    magmaStaffRipple(...a)  { return WeaponSystem.prototype.magmaStaffRipple.call(this, ...a); }
    _updateMagmaRippleBar(...a) { return WeaponSystem.prototype._updateMagmaRippleBar.call(this, ...a); }
    _magmaCfg(...a)        { return WeaponSystem.prototype._magmaCfg.call(this, ...a); }
    _magmaTier(...a)       { return WeaponSystem.prototype._magmaTier.call(this, ...a); }
    _addMagmaHeat(...a)    { return WeaponSystem.prototype._addMagmaHeat.call(this, ...a); }
    _updateMagmaHeat(...a) { return WeaponSystem.prototype._updateMagmaHeat.call(this, ...a); }
    _kindlingCfg(...a)         { return WeaponSystem.prototype._kindlingCfg.call(this, ...a); }
    _kindlingPayout(...a)      { return WeaponSystem.prototype._kindlingPayout.call(this, ...a); }
    _jetFx(...a) { return WeaponSystem.prototype._jetFx.call(this, ...a); }
    kindlingBrandAttack(...a)  { return WeaponSystem.prototype.kindlingBrandAttack.call(this, ...a); }
    kindlingIgnitionMode(...a) { return WeaponSystem.prototype.kindlingIgnitionMode.call(this, ...a); }
    _brandEnemy(...a)          { return WeaponSystem.prototype._brandEnemy.call(this, ...a); }
    _kindleOverMult(...a) { return WeaponSystem.prototype._kindleOverMult.call(this, ...a); }
    _jetFuelTick(...a) { return WeaponSystem.prototype._jetFuelTick.call(this, ...a); }
    _fractalCfg(...a) { return WeaponSystem.prototype._fractalCfg.call(this, ...a); }
    _fractalMark(...a) { return WeaponSystem.prototype._fractalMark.call(this, ...a); }
    _fractalConsume(...a) { return WeaponSystem.prototype._fractalConsume.call(this, ...a); }
    _shardBossSig(...a) { return WeaponSystem.prototype._shardBossSig.call(this, ...a); }
    _fractalGamble(...a) { return WeaponSystem.prototype._fractalGamble.call(this, ...a); }
    _fractalDeadly(...a) { return WeaponSystem.prototype._fractalDeadly.call(this, ...a); }
    _fractalDeadlyOpen(...a) { return WeaponSystem.prototype._fractalDeadlyOpen.call(this, ...a); }
    _updateFractalBar(...a) { return WeaponSystem.prototype._updateFractalBar.call(this, ...a); }
    _kindleDetonateAll(...a) { return WeaponSystem.prototype._kindleDetonateAll.call(this, ...a); }
    _kindlePassOn(...a)        { return WeaponSystem.prototype._kindlePassOn.call(this, ...a); }
    _updateKindling(...a)      { return WeaponSystem.prototype._updateKindling.call(this, ...a); }
    _drawKindleMark(...a) { return WeaponSystem.prototype._drawKindleMark.call(this, ...a); }
    _kindleBlast(...a) { return WeaponSystem.prototype._kindleBlast.call(this, ...a); }
    _kindleIgniteFx(...a) { return WeaponSystem.prototype._kindleIgniteFx.call(this, ...a); }
    _kindleClickDetonate(...a) { return WeaponSystem.prototype._kindleClickDetonate.call(this, ...a); }
    _detonateKindling(...a)    { return WeaponSystem.prototype._detonateKindling.call(this, ...a); }
    _clearKindle(...a)         { return WeaponSystem.prototype._clearKindle.call(this, ...a); }
    _updateKindleIndicator(...a){ return WeaponSystem.prototype._updateKindleIndicator.call(this, ...a); }
    _fireKindleRound(...a)     { return WeaponSystem.prototype._fireKindleRound.call(this, ...a); }
    _evaporate(...a) { return WeaponSystem.prototype._evaporate.call(this, ...a); }
    _kindleBrandables(...a) { return WeaponSystem.prototype._kindleBrandables.call(this, ...a); }
    _kindlePos(...a) { return WeaponSystem.prototype._kindlePos.call(this, ...a); }
    _kindleAlive(...a) { return WeaponSystem.prototype._kindleAlive.call(this, ...a); }
    _kindleDamage(...a) { return WeaponSystem.prototype._kindleDamage.call(this, ...a); }
    _updateKindleBullets(...a) { return WeaponSystem.prototype._updateKindleBullets.call(this, ...a); }
    _kindleMuzzle(...a) { return WeaponSystem.prototype._kindleMuzzle.call(this, ...a); }
    _kindleSpark(...a) { return WeaponSystem.prototype._kindleSpark.call(this, ...a); }
    _kindleHeatColor(...a) { return WeaponSystem.prototype._kindleHeatColor.call(this, ...a); }
    _clearKindleBullets(...a) { return WeaponSystem.prototype._clearKindleBullets.call(this, ...a); }
    _updateMagmaOrbs(...a)     { return WeaponSystem.prototype._updateMagmaOrbs.call(this, ...a); }
    applyBlueBurn(...a) { return WeaponSystem.prototype.applyBlueBurn.call(this, ...a); }
    _blueBurnPop(...a) { return WeaponSystem.prototype._blueBurnPop.call(this, ...a); }
    applyBurnStack(...a)    { return WeaponSystem.prototype.applyBurnStack.call(this, ...a); }
    applyBurnStackBoss(...a){ return WeaponSystem.prototype.applyBurnStackBoss.call(this, ...a); }
    _burnTierStats(...a)    { return WeaponSystem.prototype._burnTierStats.call(this, ...a); }
    _burnCfg(...a)          { return WeaponSystem.prototype._burnCfg.call(this, ...a); }
    _burnDecay(...a)        { return WeaponSystem.prototype._burnDecay.call(this, ...a); }
    _burnBossTicker(...a)   { return WeaponSystem.prototype._burnBossTicker.call(this, ...a); }
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
    _orbHitBig(...a) { return WeaponSystem.prototype._orbHitBig.call(this, ...a); }
    _orbBounceTarget(...a) { return WeaponSystem.prototype._orbBounceTarget.call(this, ...a); }
    updateLightningOrbs(...a) { return WeaponSystem.prototype.updateLightningOrbs.call(this, ...a); }
    cosmicFistsAttack(...a)  { return WeaponSystem.prototype.cosmicFistsAttack.call(this, ...a); }
    singularityStaffFire(...a)        { return WeaponSystem.prototype.singularityStaffFire.call(this, ...a); }
    updateSingularityStaff(...a)      { return WeaponSystem.prototype.updateSingularityStaff.call(this, ...a); }
    _singularityExplode(...a)         { return WeaponSystem.prototype._singularityExplode.call(this, ...a); }
    singularityCollapseActivate(...a) { return WeaponSystem.prototype.singularityCollapseActivate.call(this, ...a); }
    singularityCollapseRelease(...a)  { return WeaponSystem.prototype.singularityCollapseRelease.call(this, ...a); }
    updateSingOrbCharge(...a)         { return WeaponSystem.prototype.updateSingOrbCharge.call(this, ...a); }
    _updateSingOrbBar(...a)           { return WeaponSystem.prototype._updateSingOrbBar.call(this, ...a); }
    _destroySingOrbBar(...a)          { return WeaponSystem.prototype._destroySingOrbBar.call(this, ...a); }
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
    _superconduct(...a) { return WeaponSystem.prototype._superconduct.call(this, ...a); }
    _statusPop(...a) { return WeaponSystem.prototype._statusPop.call(this, ...a); }
    _orbHitEnemy(...a) { return WeaponSystem.prototype._orbHitEnemy.call(this, ...a); }
    spawnFireballLavaPool(...a)  { return WeaponSystem.prototype.spawnFireballLavaPool.call(this, ...a); }
    fractalShardAttack(...a)    { return WeaponSystem.prototype.fractalShardAttack.call(this, ...a); }
    _spawnPierceSpike(...a)     { return WeaponSystem.prototype._spawnPierceSpike.call(this, ...a); }
    _spawnFrostTotem(...a)      { return WeaponSystem.prototype._spawnFrostTotem.call(this, ...a); }
    _spawnSplitterShard(...a)   { return WeaponSystem.prototype._spawnSplitterShard.call(this, ...a); }
    _triggerSplitterSplit(...a) { return WeaponSystem.prototype._triggerSplitterSplit.call(this, ...a); }

    _updateIcicleChargeBar(...a)  { return WeaponSystem.prototype._updateIcicleChargeBar.call(this, ...a); }
    _updateIcicleAccuracyCircle(...a) { return WeaponSystem.prototype._updateIcicleAccuracyCircle.call(this, ...a); }
    _fireIcicleHealShard(...a)    { return WeaponSystem.prototype._fireIcicleHealShard.call(this, ...a); }

    // CombatSystem
    showCannotSwitchText(...a) { return CombatSystem.prototype.showCannotSwitchText.call(this, ...a); }
    showStatusText(...a) { return CombatSystem.prototype.showStatusText.call(this, ...a); }
    _dmgNote(...a) { return CombatSystem.prototype._dmgNote.call(this, ...a); }
    showDamageNumber(...a) { return CombatSystem.prototype.showDamageNumber.call(this, ...a); }
    damageEnemy(...a) { return CombatSystem.prototype.damageEnemy.call(this, ...a); }
    killEnemy(...a) { return CombatSystem.prototype.killEnemy.call(this, ...a); }
    takeDamage(...a) { if (this._devGodMode) return; return CombatSystem.prototype.takeDamage.call(this, ...a); }
    _frostShieldFx(...a) { return CombatSystem.prototype._frostShieldFx.call(this, ...a); }
    _frostShieldHit(...a) { return CombatSystem.prototype._frostShieldHit.call(this, ...a); }
    damageBossAtTile(...a) { return CombatSystem.prototype.damageBossAtTile.call(this, ...a); }
    _zapBosses(...a) { return CombatSystem.prototype._zapBosses.call(this, ...a); }
    gainUltCharge(...a) { return CombatSystem.prototype.gainUltCharge.call(this, ...a); }
    _noteUltHit(...a)   { return CombatSystem.prototype._noteUltHit.call(this, ...a); }
    _ultStatusOf(...a)  { return CombatSystem.prototype._ultStatusOf.call(this, ...a); }
    switchToElement(...a) { return CombatSystem.prototype.switchToElement.call(this, ...a); }
    updateUltAbsorbers(...a) { return CombatSystem.prototype.updateUltAbsorbers.call(this, ...a); }
    _absorberCast(...a) { return CombatSystem.prototype._absorberCast.call(this, ...a); }
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
    resolveElementalHit(...a) { return CombatSystem.prototype.resolveElementalHit.call(this, ...a); }
    _brittleMult(...a) { return CombatSystem.prototype._brittleMult.call(this, ...a); }
    _cubeNote(...a) { return CombatSystem.prototype._cubeNote.call(this, ...a); }
    _phasedOut(...a) { return CombatSystem.prototype._phasedOut.call(this, ...a); }
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
    castUlt(...a)            { return ElementSystem.prototype.castUlt.call(this, ...a); }
    _tutorialUltGate(...a)   { return ElementSystem.prototype._tutorialUltGate.call(this, ...a); }
    _ultCfg(...a)            { return ElementSystem.prototype._ultCfg.call(this, ...a); }
    _ultDeny(...a)           { return ElementSystem.prototype._ultDeny.call(this, ...a); }
    _ultCastFx(...a)         { return ElementSystem.prototype._ultCastFx.call(this, ...a); }
    _ultReactionSpark(...a)  { return ElementSystem.prototype._ultReactionSpark.call(this, ...a); }
    _maybeDropScrap(...a) { return ElementSystem.prototype._maybeDropScrap.call(this, ...a); }
    // ── FIELD KIT ────────────────────────────────────────────────────────────
    _smiteBoltPath(...a) { return FieldKit.prototype._smiteBoltPath.call(this, ...a); }
    _smiteStrike(...a) { return FieldKit.prototype._smiteStrike.call(this, ...a); }
    _decayEmpSlows(...a) { return FieldKit.prototype._decayEmpSlows.call(this, ...a); }
    _empShockwave(...a) { return FieldKit.prototype._empShockwave.call(this, ...a); }
    _fkClearHeldPrompt(...a) { return FieldKit.prototype._fkClearHeldPrompt.call(this, ...a); }
    _fkDrawHeldPrompt(...a) { return FieldKit.prototype._fkDrawHeldPrompt.call(this, ...a); }
    _fkNearestFloor(...a) { return FieldKit.prototype._fkNearestFloor.call(this, ...a); }
    _fkUpdateHeldPrompt(...a) { return FieldKit.prototype._fkUpdateHeldPrompt.call(this, ...a); }
    _fkVanishPuff(...a) { return FieldKit.prototype._fkVanishPuff.call(this, ...a); }
    _gadgetEmp(...a) { return FieldKit.prototype._gadgetEmp.call(this, ...a); }
    _releaseDisplaced(...a) { return FieldKit.prototype._releaseDisplaced.call(this, ...a); }
    _smiteBolt(...a) { return FieldKit.prototype._smiteBolt.call(this, ...a); }
    _timeoutDisplaced(...a) { return FieldKit.prototype._timeoutDisplaced.call(this, ...a); }
    displacerPending(...a) { return FieldKit.prototype.displacerPending.call(this, ...a); }
    placeDisplaced(...a) { return FieldKit.prototype.placeDisplaced.call(this, ...a); }
    updateFieldKit(...a) { return FieldKit.prototype.updateFieldKit.call(this, ...a); }
    gadgetLoadout(...a) { return FieldKit.prototype.gadgetLoadout.call(this, ...a); }
    setGadgetSlot(...a) { return FieldKit.prototype.setGadgetSlot.call(this, ...a); }
    beginGadgetRun(...a) { return FieldKit.prototype.beginGadgetRun.call(this, ...a); }
    gadgetCooldownLeft(...a) { return FieldKit.prototype.gadgetCooldownLeft.call(this, ...a); }
    useGadget(...a) { return FieldKit.prototype.useGadget.call(this, ...a); }
    _gadgetMend(...a) { return FieldKit.prototype._gadgetMend.call(this, ...a); }
    _fkUpdateMend(...a) { return FieldKit.prototype._fkUpdateMend.call(this, ...a); }
    _gadgetBulwark(...a) { return FieldKit.prototype._gadgetBulwark.call(this, ...a); }
    _fkDrawSockets(...a) { return FieldKit.prototype._fkDrawSockets.call(this, ...a); }
    _availableGadgets(...a) { return FieldKit.prototype._availableGadgets.call(this, ...a); }
    gadgetUnlocked(...a) { return FieldKit.prototype.gadgetUnlocked.call(this, ...a); }
    unlockGadget(...a) { return FieldKit.prototype.unlockGadget.call(this, ...a); }
    unlockedGadgets(...a) { return FieldKit.prototype.unlockedGadgets.call(this, ...a); }
    _unlockStoreKey(...a) { return FieldKit.prototype._unlockStoreKey.call(this, ...a); }
    _fkBurst(...a) { return FieldKit.prototype._fkBurst.call(this, ...a); }
    _fkCfg(...a) { return FieldKit.prototype._fkCfg.call(this, ...a); }
    _fkEnemiesIn(...a) { return FieldKit.prototype._fkEnemiesIn.call(this, ...a); }
    _fkThrowArc(...a) { return FieldKit.prototype._fkThrowArc.call(this, ...a); }
    _gadgetDefs(...a) { return FieldKit.prototype._gadgetDefs.call(this, ...a); }
    _gadgetDisplacer(...a) { return FieldKit.prototype._gadgetDisplacer.call(this, ...a); }
    _gadgetGrounding(...a) { return FieldKit.prototype._gadgetGrounding.call(this, ...a); }
    _gadgetOrder(...a) { return FieldKit.prototype._gadgetOrder.call(this, ...a); }
    _gadgetSmite(...a) { return FieldKit.prototype._gadgetSmite.call(this, ...a); }
    _resolveGadget(...a) { return FieldKit.prototype._resolveGadget.call(this, ...a); }
    _scrapCfg(...a) { return ElementSystem.prototype._scrapCfg.call(this, ...a); }
    beginScrapRun(...a) { return ElementSystem.prototype.beginScrapRun.call(this, ...a); }
    _scrapStore(...a) { return ElementSystem.prototype._scrapStore.call(this, ...a); }
    loadScrapBank(...a) { return ElementSystem.prototype.loadScrapBank.call(this, ...a); }
    saveScrapBank(...a) { return ElementSystem.prototype.saveScrapBank.call(this, ...a); }
    _scorchAura(...a) { return ElementSystem.prototype._scorchAura.call(this, ...a); }
    activateFireScorch(...a) { return ElementSystem.prototype.activateFireScorch.call(this, ...a); }
    _scorchCfg(...a) { return ElementSystem.prototype._scorchCfg.call(this, ...a); }
    _scorchMeteor(...a) { return ElementSystem.prototype._scorchMeteor.call(this, ...a); }
    _scorchImpact(...a) { return ElementSystem.prototype._scorchImpact.call(this, ...a); }
    _superBurnCfg(...a) { return WeaponSystem.prototype._superBurnCfg.call(this, ...a); }
    applySuperBurn(...a) { return WeaponSystem.prototype.applySuperBurn.call(this, ...a); }
    _superBurnDecay(...a) { return WeaponSystem.prototype._superBurnDecay.call(this, ...a); }
    _scorchHeal(...a) { return WeaponSystem.prototype._scorchHeal.call(this, ...a); }
    _deepFreezeFx(...a) { return ElementSystem.prototype._deepFreezeFx.call(this, ...a); }
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
    cancelNodeChannel(...a) { return ElementSystem.prototype.cancelNodeChannel.call(this, ...a); }
    placeEngineerTower(...a) { return ElementSystem.prototype.placeEngineerTower.call(this, ...a); }
    removeEngineerTowerAt(...a) { return ElementSystem.prototype.removeEngineerTowerAt.call(this, ...a); }
    _engineerTowerDefs(...a) { return ElementSystem.prototype._engineerTowerDefs.call(this, ...a); }
    finishPlacingEngineerTower(...a) { return ElementSystem.prototype.finishPlacingEngineerTower.call(this, ...a); }
    _drawEngineerTowerBody(...a) { return ElementSystem.prototype._drawEngineerTowerBody.call(this, ...a); }
    destroyEngineerTower(...a) { return ElementSystem.prototype.destroyEngineerTower.call(this, ...a); }
    damageEngineerTower(...a) { return ElementSystem.prototype.damageEngineerTower.call(this, ...a); }
    _damageTowersInTileRadius(...a) { return ElementSystem.prototype._damageTowersInTileRadius.call(this, ...a); }
    _damageTowersInPixelRadius(...a) { return ElementSystem.prototype._damageTowersInPixelRadius.call(this, ...a); }
    updateEngineerTowers(...a) { return ElementSystem.prototype.updateEngineerTowers.call(this, ...a); }
    _flashEngineerTower(...a) { return ElementSystem.prototype._flashEngineerTower.call(this, ...a); }
    _magnetizerPull(...a) { return ElementSystem.prototype._magnetizerPull.call(this, ...a); }
    _fireTeslaCoil(...a) { return ElementSystem.prototype._fireTeslaCoil.call(this, ...a); }
    _spawnTeslaBolt(...a) { return ElementSystem.prototype._spawnTeslaBolt.call(this, ...a); }
    updateTeslaBolts(...a) { return ElementSystem.prototype.updateTeslaBolts.call(this, ...a); }
    _fireMachineGunBullet(...a) { return ElementSystem.prototype._fireMachineGunBullet.call(this, ...a); }
    updateEngineerBullets(...a) { return ElementSystem.prototype.updateEngineerBullets.call(this, ...a); }
    _updateSniperTower(...a) { return ElementSystem.prototype._updateSniperTower.call(this, ...a); }
    _spawnSniperTowerWarning(...a) { return ElementSystem.prototype._spawnSniperTowerWarning.call(this, ...a); }
    _drawSniperTowerBeam(...a) { return ElementSystem.prototype._drawSniperTowerBeam.call(this, ...a); }
    _clearSniperTowerWarning(...a) { return ElementSystem.prototype._clearSniperTowerWarning.call(this, ...a); }
    _fireSniperTowerBullet(...a) { return ElementSystem.prototype._fireSniperTowerBullet.call(this, ...a); }
    showEngineerBuildUI(...a) { return ElementSystem.prototype.showEngineerBuildUI.call(this, ...a); }
    updateEngineerBuildUI(...a) { return ElementSystem.prototype.updateEngineerBuildUI.call(this, ...a); }
    clearEngineerBuildRing(...a) { return ElementSystem.prototype.clearEngineerBuildRing.call(this, ...a); }
    clearEngineerBuildMode(...a) { return ElementSystem.prototype.clearEngineerBuildMode.call(this, ...a); }
    _redrawEngineerBuildRing(...a) { return ElementSystem.prototype._redrawEngineerBuildRing.call(this, ...a); }
    updateEngineerTowerPreview(...a) { return ElementSystem.prototype.updateEngineerTowerPreview.call(this, ...a); }
    clearEngineerTowerPreview(...a) { return ElementSystem.prototype.clearEngineerTowerPreview.call(this, ...a); }
    updateNodeChannel(...a) { return ElementSystem.prototype.updateNodeChannel.call(this, ...a); }
    spawnOrbScrap(...a) { return ElementSystem.prototype.spawnOrbScrap.call(this, ...a); }
    updateOrbScraps(...a) { return ElementSystem.prototype.updateOrbScraps.call(this, ...a); }

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
    _voidBombFx(...a) { return ElementSystem.prototype._voidBombFx.call(this, ...a); }
    _voidBurstFx(...a) { return ElementSystem.prototype._voidBurstFx.call(this, ...a); }
    updateCosmicBlackHoleProjectile(...a) { return ElementSystem.prototype.updateCosmicBlackHoleProjectile.call(this, ...a); }
    deployCosmicBlackHole(...a) { return ElementSystem.prototype.deployCosmicBlackHole.call(this, ...a); }
    updateCosmicBlackHole(...a) { return ElementSystem.prototype.updateCosmicBlackHole.call(this, ...a); }
    _cosmicCollapse(...a) { return ElementSystem.prototype._cosmicCollapse.call(this, ...a); }
    updateCosmicMarkVisual(...a) { return ElementSystem.prototype.updateCosmicMarkVisual.call(this, ...a); }
    cosmicDash(...a) { return ElementSystem.prototype.cosmicDash.call(this, ...a); }
    cosmicDashAim(...a) { return ElementSystem.prototype.cosmicDashAim.call(this, ...a); }
    _dashDazeFx(...a) { return ElementSystem.prototype._dashDazeFx.call(this, ...a); }
    _updateGlide(...a) { return ElementSystem.prototype._updateGlide.call(this, ...a); }
    _relicDashTrail(...a) { return ElementSystem.prototype._relicDashTrail.call(this, ...a); }
    playerDash(...a) { return ElementSystem.prototype.playerDash.call(this, ...a); }
    _dashFx(...a) { return ElementSystem.prototype._dashFx.call(this, ...a); }
    _dashCanEnter(...a) { return ElementSystem.prototype._dashCanEnter.call(this, ...a); }
    _deathSummary(...a) { return HUD.prototype._deathSummary.call(this, ...a); }
    _deathFx(...a) { return HUD.prototype._deathFx.call(this, ...a); }

    // HUD
    createHUD(...a) { return HUD.prototype.createHUD.call(this, ...a); }
    updateHUD(...a) { return HUD.prototype.updateHUD.call(this, ...a); }
    _buildUltGems(...a) { return HUD.prototype._buildUltGems.call(this, ...a); }
    _drawUltGems(...a)  { return HUD.prototype._drawUltGems.call(this, ...a); }
    // ── CosmicSystem (Cosmic.js) ──
    _csCfg(...a) { return CosmicSystem.prototype._csCfg.call(this, ...a); }
    _csInit(...a) { return CosmicSystem.prototype._csInit.call(this, ...a); }
    _csTeardown(...a) { return CosmicSystem.prototype._csTeardown.call(this, ...a); }
    _csUnlockedNow(...a) { return CosmicSystem.prototype._csUnlockedNow.call(this, ...a); }
    _csWeapon(...a) { return CosmicSystem.prototype._csWeapon.call(this, ...a); }
    _csAscending(...a) { return CosmicSystem.prototype._csAscending.call(this, ...a); }
    _csMomentum(...a) { return CosmicSystem.prototype._csMomentum.call(this, ...a); }
    _csDmgMult(...a) { return CosmicSystem.prototype._csDmgMult.call(this, ...a); }
    _dmgOutMult(...a) { return CombatSystem.prototype._dmgOutMult.call(this, ...a); }
    _luckNow(...a) { return CombatSystem.prototype._luckNow.call(this, ...a); }
    _dieFx(...a) { return CombatSystem.prototype._dieFx.call(this, ...a); }
    _chaosTick(...a) { return CombatSystem.prototype._chaosTick.call(this, ...a); }
    _wheel(...a) { return CombatSystem.prototype._wheel.call(this, ...a); }
    _chaosMove(...a) { return CombatSystem.prototype._chaosMove.call(this, ...a); }
    _asUlt(...a) { return CombatSystem.prototype._asUlt.call(this, ...a); }
    _hitRoll(...a)    { return CombatSystem.prototype._hitRoll.call(this, ...a); }
    _afterHit(...a)   { return CombatSystem.prototype._afterHit.call(this, ...a); }
    _hitPortalsAround(...a) { return CombatSystem.prototype._hitPortalsAround.call(this, ...a); }
    _critEffect(...a) { return CombatSystem.prototype._critEffect.call(this, ...a); }
    _addAlly(...a) { return CombatSystem.prototype._addAlly.call(this, ...a); }
    _updateMusic(...a) { return HUD.prototype._updateMusic.call(this, ...a); }
    _tickRunStats(...a) { return HUD.prototype._tickRunStats.call(this, ...a); }
    _stackStatusIcons(...a) { return HUD.prototype._stackStatusIcons.call(this, ...a); }
    _showWinScreen(...a) { return HUD.prototype._showWinScreen.call(this, ...a); }
    _tallyDamage(...a) { return CombatSystem.prototype._tallyDamage.call(this, ...a); }
    _volleyMult(...a) { return CombatSystem.prototype._volleyMult.call(this, ...a); }
    _bossVolleyKey(...a) { return CombatSystem.prototype._bossVolleyKey.call(this, ...a); }
    _followResistMarks(...a) { return LevelManager.prototype._followResistMarks.call(this, ...a); }
    _frostCfg(...a) { return LevelManager.prototype._frostCfg.call(this, ...a); }
    createFrostSlime(...a) { return LevelManager.prototype.createFrostSlime.call(this, ...a); }
    createBuddingSlime(...a) { return LevelManager.prototype.createBuddingSlime.call(this, ...a); }
    _budCfg(...a)          { return LevelManager.prototype._budCfg.call(this, ...a); }
    _updateBudding(...a)   { return LevelManager.prototype._updateBudding.call(this, ...a); }
    _budCalm(...a)         { return LevelManager.prototype._budCalm.call(this, ...a); }
    _budVolley(...a)       { return LevelManager.prototype._budVolley.call(this, ...a); }
    _poisonRing(...a)      { return EnemyManager.prototype._poisonRing.call(this, ...a); }
    _poisonPlayer(...a)    { return EnemyManager.prototype._poisonPlayer.call(this, ...a); }
    _updatePoison(...a)    { return EnemyManager.prototype._updatePoison.call(this, ...a); }
    _budSplit(...a)        { return LevelManager.prototype._budSplit.call(this, ...a); }
    _specialHit(...a) { return LevelManager.prototype._specialHit.call(this, ...a); }
    _clearShot(...a) { return LevelManager.prototype._clearShot.call(this, ...a); }
    _updateElites(...a) { return LevelManager.prototype._updateElites.call(this, ...a); }
    _wraithCfg(...a) { return LevelManager.prototype._wraithCfg.call(this, ...a); }
    createWraith(...a) { return LevelManager.prototype.createWraith.call(this, ...a); }
    _wraithDrift(...a) { return LevelManager.prototype._wraithDrift.call(this, ...a); }
    _wraithTick(...a) { return LevelManager.prototype._wraithTick.call(this, ...a); }
    _shroudKeep(...a) { return LevelManager.prototype._shroudKeep.call(this, ...a); }
    _shroudLook(...a) { return LevelManager.prototype._shroudLook.call(this, ...a); }
    _shadeCfg(...a) { return LevelManager.prototype._shadeCfg.call(this, ...a); }
    createAdaptiveShade(...a) { return LevelManager.prototype.createAdaptiveShade.call(this, ...a); }
    _shadeForm(...a) { return LevelManager.prototype._shadeForm.call(this, ...a); }
    _shadeNote(...a) { return LevelManager.prototype._shadeNote.call(this, ...a); }
    _shadeTake(...a) { return LevelManager.prototype._shadeTake.call(this, ...a); }
    _shadeGuard(...a) { return LevelManager.prototype._shadeGuard.call(this, ...a); }
    _shadeAbsorb(...a) { return LevelManager.prototype._shadeAbsorb.call(this, ...a); }
    _shadeTick(...a) { return LevelManager.prototype._shadeTick.call(this, ...a); }
    _diverCfg(...a) { return LevelManager.prototype._diverCfg.call(this, ...a); }
    createTorpedoDiver(...a) { return LevelManager.prototype.createTorpedoDiver.call(this, ...a); }
    _diverTick(...a) { return LevelManager.prototype._diverTick.call(this, ...a); }
    _diverZip(...a) { return LevelManager.prototype._diverZip.call(this, ...a); }
    _leechCfg(...a) { return LevelManager.prototype._leechCfg.call(this, ...a); }
    createLeech(...a) { return LevelManager.prototype.createLeech.call(this, ...a); }
    _leechPick(...a) { return LevelManager.prototype._leechPick.call(this, ...a); }
    _leechTick(...a) { return LevelManager.prototype._leechTick.call(this, ...a); }
    _plateCfg(...a) { return LevelManager.prototype._plateCfg.call(this, ...a); }
    _plateGive(...a) { return LevelManager.prototype._plateGive.call(this, ...a); }
    _plateTake(...a) { return LevelManager.prototype._plateTake.call(this, ...a); }
    _plateDraw(...a) { return LevelManager.prototype._plateDraw.call(this, ...a); }
    _ceoCfg(...a) { return LevelManager.prototype._ceoCfg.call(this, ...a); }
    createSlimeCeo(...a) { return LevelManager.prototype.createSlimeCeo.call(this, ...a); }
    _ceoTick(...a) { return LevelManager.prototype._ceoTick.call(this, ...a); }
    _ceoWave(...a) { return LevelManager.prototype._ceoWave.call(this, ...a); }
    _leechSteal(...a) { return LevelManager.prototype._leechSteal.call(this, ...a); }
    _leechWarn(...a) { return LevelManager.prototype._leechWarn.call(this, ...a); }
    _leechHand(...a) { return LevelManager.prototype._leechHand.call(this, ...a); }
    _leechGemKey(...a) { return LevelManager.prototype._leechGemKey.call(this, ...a); }
    _leechHold(...a) { return LevelManager.prototype._leechHold.call(this, ...a); }
    _leechPort(...a) { return LevelManager.prototype._leechPort.call(this, ...a); }
    _leechFlee(...a) { return LevelManager.prototype._leechFlee.call(this, ...a); }
    _leechDie(...a) { return LevelManager.prototype._leechDie.call(this, ...a); }
    _gemCfg(...a) { return LevelManager.prototype._gemCfg.call(this, ...a); }
    createGem(...a) { return LevelManager.prototype.createGem.call(this, ...a); }
    _gemTick(...a) { return LevelManager.prototype._gemTick.call(this, ...a); }
    _gemDrop(...a) { return LevelManager.prototype._gemDrop.call(this, ...a); }
    _gemDome(...a) { return LevelManager.prototype._gemDome.call(this, ...a); }
    _gemShatter(...a) { return LevelManager.prototype._gemShatter.call(this, ...a); }
    _tideTick(...a) { return LevelManager.prototype._tideTick.call(this, ...a); }
    _tideCfg(...a) { return LevelManager.prototype._tideCfg.call(this, ...a); }
    createArmoredSlime(...a) { return LevelManager.prototype.createArmoredSlime.call(this, ...a); }
    _armorCfg(...a)        { return LevelManager.prototype._armorCfg.call(this, ...a); }
    _armorSide(...a)       { return LevelManager.prototype._armorSide.call(this, ...a); }
    _armorMult(...a)       { return LevelManager.prototype._armorMult.call(this, ...a); }
    _updateArmored(...a)   { return LevelManager.prototype._updateArmored.call(this, ...a); }
    createHunterSlime(...a) { return LevelManager.prototype.createHunterSlime.call(this, ...a); }
    _hunterCfg(...a)       { return LevelManager.prototype._hunterCfg.call(this, ...a); }
    _updateHunters(...a)   { return LevelManager.prototype._updateHunters.call(this, ...a); }
    _hunterPounce(...a)    { return LevelManager.prototype._hunterPounce.call(this, ...a); }
    _updateSpeedMarks(...a) { return LevelManager.prototype._updateSpeedMarks.call(this, ...a); }
    _hunterReset(...a)     { return LevelManager.prototype._hunterReset.call(this, ...a); }
    _hunterFrenzy(...a)    { return LevelManager.prototype._hunterFrenzy.call(this, ...a); }
    _hunterSlash(...a)     { return LevelManager.prototype._hunterSlash.call(this, ...a); }
    _playerStatusRow(...a) { return LevelManager.prototype._playerStatusRow.call(this, ...a); }
    _bleedStart(...a)      { return LevelManager.prototype._bleedStart.call(this, ...a); }
    _updateBleed(...a)     { return LevelManager.prototype._updateBleed.call(this, ...a); }
    _frostEncase(...a) { return LevelManager.prototype._frostEncase.call(this, ...a); }
    _encCfg(...a) { return LevelManager.prototype._encCfg.call(this, ...a); }
    createEncasedSlime(...a) { return LevelManager.prototype.createEncasedSlime.call(this, ...a); }
    _encEncase(...a) { return LevelManager.prototype._encEncase.call(this, ...a); }
    _encUpdate(...a) { return LevelManager.prototype._encUpdate.call(this, ...a); }
    _encReborn(...a) { return LevelManager.prototype._encReborn.call(this, ...a); }
    _encCast(...a) { return LevelManager.prototype._encCast.call(this, ...a); }
    _encAtkTick(...a) { return LevelManager.prototype._encAtkTick.call(this, ...a); }
    _encAtkEnd(...a) { return LevelManager.prototype._encAtkEnd.call(this, ...a); }
    _encCleanup(...a) { return LevelManager.prototype._encCleanup.call(this, ...a); }
    _frostUpdate(...a) { return LevelManager.prototype._frostUpdate.call(this, ...a); }
    _rebirthCinematic(...a) { return LevelManager.prototype._rebirthCinematic.call(this, ...a); }
    _frostHatch(...a) { return LevelManager.prototype._frostHatch.call(this, ...a); }
    _tauntBegin(...a) { return CombatSystem.prototype._tauntBegin.call(this, ...a); }
    _tauntEnd(...a) { return CombatSystem.prototype._tauntEnd.call(this, ...a); }
    _tauntBlocks(...a) { return CombatSystem.prototype._tauntBlocks.call(this, ...a); }
    _updateAllies(...a) { return CombatSystem.prototype._updateAllies.call(this, ...a); }
    _gadgetDecoy(...a) { return FieldKit.prototype._gadgetDecoy.call(this, ...a); }
    _csTakenMult(...a) { return CosmicSystem.prototype._csTakenMult.call(this, ...a); }
    _csMoveMult(...a) { return CosmicSystem.prototype._csMoveMult.call(this, ...a); }
    _meteorBarrage(...a) { return ElementSystem.prototype._meteorBarrage.call(this, ...a); }
    _barrageMeteor(...a) { return ElementSystem.prototype._barrageMeteor.call(this, ...a); }
    _csHpBoost(...a) { return CosmicSystem.prototype._csHpBoost.call(this, ...a); }
    _csHpBoostEnd(...a) { return CosmicSystem.prototype._csHpBoostEnd.call(this, ...a); }
    _csDomainRect(...a) { return CosmicSystem.prototype._csDomainRect.call(this, ...a); }
    _csDomainLine(...a) { return CosmicSystem.prototype._csDomainLine.call(this, ...a); }
    _csDomainBegin(...a) { return CosmicSystem.prototype._csDomainBegin.call(this, ...a); }
    _csDomainTide(...a) { return CosmicSystem.prototype._csDomainTide.call(this, ...a); }
    _csDomainFlood(...a) { return CosmicSystem.prototype._csDomainFlood.call(this, ...a); }
    _csOutsideDomain(...a) { return CosmicSystem.prototype._csOutsideDomain.call(this, ...a); }
    _csDomainEnd(...a) { return CosmicSystem.prototype._csDomainEnd.call(this, ...a); }
    _csFluidTile(...a) { return CosmicSystem.prototype._csFluidTile.call(this, ...a); }
    _csAscendBlast(...a) { return CosmicSystem.prototype._csAscendBlast.call(this, ...a); }
    _csAscendWave(...a) { return CosmicSystem.prototype._csAscendWave.call(this, ...a); }
    _csSwitchMult(...a) { return CosmicSystem.prototype._csSwitchMult.call(this, ...a); }
    _csMark(...a) { return CosmicSystem.prototype._csMark.call(this, ...a); }
    _csOnHit(...a) { return CosmicSystem.prototype._csOnHit.call(this, ...a); }
    _csOnDash(...a) { return CosmicSystem.prototype._csOnDash.call(this, ...a); }
    _csAddMomentum(...a) { return CosmicSystem.prototype._csAddMomentum.call(this, ...a); }
    _csOnHurt(...a) { return CosmicSystem.prototype._csOnHurt.call(this, ...a); }
    _csHex(...a) { return CosmicSystem.prototype._csHex.call(this, ...a); }
    _csWardCatch(...a) { return CosmicSystem.prototype._csWardCatch.call(this, ...a); }
    _csWardEat(...a) { return CosmicSystem.prototype._csWardEat.call(this, ...a); }
    _csCast(...a) { return CosmicSystem.prototype._csCast.call(this, ...a); }
    _csPunch(...a) { return CosmicSystem.prototype._csPunch.call(this, ...a); }
    _csBarrier(...a) { return CosmicSystem.prototype._csBarrier.call(this, ...a); }
    _csRaiseWards(...a) { return CosmicSystem.prototype._csRaiseWards.call(this, ...a); }
    _csAstrolabe(...a) { return CosmicSystem.prototype._csAstrolabe.call(this, ...a); }
    _csWell(...a) { return CosmicSystem.prototype._csWell.call(this, ...a); }
    _csWellEnd(...a) { return CosmicSystem.prototype._csWellEnd.call(this, ...a); }
    _csUpdateWellBeam(...a) { return CosmicSystem.prototype._csUpdateWellBeam.call(this, ...a); }
    _csWellOpen(...a) { return CosmicSystem.prototype._csWellOpen.call(this, ...a); }
    _csBlade(...a) { return CosmicSystem.prototype._csBlade.call(this, ...a); }
    _csAscend(...a) { return CosmicSystem.prototype._csAscend.call(this, ...a); }
    _csSupernova(...a) { return CosmicSystem.prototype._csSupernova.call(this, ...a); }
    _csUpdate(...a) { return CosmicSystem.prototype._csUpdate.call(this, ...a); }
    _csSweepProjectiles(...a) { return CosmicSystem.prototype._csSweepProjectiles.call(this, ...a); }
    _csUpdateStars(...a) { return CosmicSystem.prototype._csUpdateStars.call(this, ...a); }
    _csStarFall(...a) { return CosmicSystem.prototype._csStarFall.call(this, ...a); }
    _csSpendStars(...a) { return CosmicSystem.prototype._csSpendStars.call(this, ...a); }
    _csAstroFoes(...a) { return CosmicSystem.prototype._csAstroFoes.call(this, ...a); }
    _csAstralPop(...a) { return CosmicSystem.prototype._csAstralPop.call(this, ...a); }
    _csPopFx(...a) { return CosmicSystem.prototype._csPopFx.call(this, ...a); }
    _csUpdateAstral(...a) { return CosmicSystem.prototype._csUpdateAstral.call(this, ...a); }
    _csBladeCharge(...a) { return CosmicSystem.prototype._csBladeCharge.call(this, ...a); }
    _csBladeShape(...a) { return CosmicSystem.prototype._csBladeShape.call(this, ...a); }
    _csBladeTiles(...a) { return CosmicSystem.prototype._csBladeTiles.call(this, ...a); }
    _csUpdateBlade(...a) { return CosmicSystem.prototype._csUpdateBlade.call(this, ...a); }
    _csRelease(...a) { return CosmicSystem.prototype._csRelease.call(this, ...a); }
    _csWardShove(...a) { return CosmicSystem.prototype._csWardShove.call(this, ...a); }
    _csDragToward(...a) { return CosmicSystem.prototype._csDragToward.call(this, ...a); }
    _csArena(...a) { return CosmicSystem.prototype._csArena.call(this, ...a); }
    _csHidePreview(...a) { return CosmicSystem.prototype._csHidePreview.call(this, ...a); }
    _csVoidbeam(...a) { return CosmicSystem.prototype._csVoidbeam.call(this, ...a); }
    _csBladeF(...a) { return CosmicSystem.prototype._csBladeF.call(this, ...a); }
    _csBladeDrop(...a) { return CosmicSystem.prototype._csBladeDrop.call(this, ...a); }
    _csUpdateFluid(...a) { return CosmicSystem.prototype._csUpdateFluid.call(this, ...a); }
    _csStage(...a) { return CosmicSystem.prototype._csStage.call(this, ...a); }
    _csTf(...a) { return CosmicSystem.prototype._csTf.call(this, ...a); }
    _csRooted(...a) { return CosmicSystem.prototype._csRooted.call(this, ...a); }
    _csFormLock(...a) { return CosmicSystem.prototype._csFormLock.call(this, ...a); }
    _csVDown(...a) { return CosmicSystem.prototype._csVDown.call(this, ...a); }
    _csVUp(...a) { return CosmicSystem.prototype._csVUp.call(this, ...a); }
    _csMaxLayers(...a) { return CosmicSystem.prototype._csMaxLayers.call(this, ...a); }
    _csLayers(...a) { return CosmicSystem.prototype._csLayers.call(this, ...a); }
    _csSetLayers(...a) { return CosmicSystem.prototype._csSetLayers.call(this, ...a); }
    _csGainCharge(...a) { return CosmicSystem.prototype._csGainCharge.call(this, ...a); }
    _csChargeAt(...a) { return CosmicSystem.prototype._csChargeAt.call(this, ...a); }
    _csUpdateCharge(...a) { return CosmicSystem.prototype._csUpdateCharge.call(this, ...a); }
    _csChargeEnd(...a) { return CosmicSystem.prototype._csChargeEnd.call(this, ...a); }
    _csDrawCharge(...a) { return CosmicSystem.prototype._csDrawCharge.call(this, ...a); }
    _csSkinBuild(...a) { return CosmicSystem.prototype._csSkinBuild.call(this, ...a); }
    _csSkinSync(...a) { return CosmicSystem.prototype._csSkinSync.call(this, ...a); }
    _csSkinDrop(...a) { return CosmicSystem.prototype._csSkinDrop.call(this, ...a); }
    _csTfBegin(...a) { return CosmicSystem.prototype._csTfBegin.call(this, ...a); }
    _csTfTarget(...a) { return CosmicSystem.prototype._csTfTarget.call(this, ...a); }
    _csTfUpdate(...a) { return CosmicSystem.prototype._csTfUpdate.call(this, ...a); }
    _csTfDrop(...a) { return CosmicSystem.prototype._csTfDrop.call(this, ...a); }
    _csTfSlam(...a) { return CosmicSystem.prototype._csTfSlam.call(this, ...a); }
    _csTfEnd(...a) { return CosmicSystem.prototype._csTfEnd.call(this, ...a); }
    _csHitBosses(...a) { return CosmicSystem.prototype._csHitBosses.call(this, ...a); }
    _csPointerDown(...a) { return CosmicSystem.prototype._csPointerDown.call(this, ...a); }
    _csPointerMove(...a) { return CosmicSystem.prototype._csPointerMove.call(this, ...a); }
    _csSetAnchor(...a) { return CosmicSystem.prototype._csSetAnchor.call(this, ...a); }
    _csAnchorPair(...a) { return CosmicSystem.prototype._csAnchorPair.call(this, ...a); }
    _csPointerUp(...a) { return CosmicSystem.prototype._csPointerUp.call(this, ...a); }
    _csCollapsePlan(...a) { return CosmicSystem.prototype._csCollapsePlan.call(this, ...a); }
    _csCollapsePreview(...a) { return CosmicSystem.prototype._csCollapsePreview.call(this, ...a); }
    _csCollapseFire(...a) { return CosmicSystem.prototype._csCollapseFire.call(this, ...a); }
    _csUpdateCollapses(...a) { return CosmicSystem.prototype._csUpdateCollapses.call(this, ...a); }
    _csCollapseImpact(...a) { return CosmicSystem.prototype._csCollapseImpact.call(this, ...a); }
    _csSpawnVoidlets(...a) { return CosmicSystem.prototype._csSpawnVoidlets.call(this, ...a); }
    _csUpdateVoidlets(...a) { return CosmicSystem.prototype._csUpdateVoidlets.call(this, ...a); }
    _csUpdateWell(...a) { return CosmicSystem.prototype._csUpdateWell.call(this, ...a); }
    _csPull(...a) { return CosmicSystem.prototype._csPull.call(this, ...a); }
    _csUpdateMarks(...a) { return CosmicSystem.prototype._csUpdateMarks.call(this, ...a); }
    _csDrawFx(...a) { return CosmicSystem.prototype._csDrawFx.call(this, ...a); }
    _csLights(...a) { return CosmicSystem.prototype._csLights.call(this, ...a); }
    _csBuildTray(...a) { return CosmicSystem.prototype._csBuildTray.call(this, ...a); }
    _csTrayState(...a) { return CosmicSystem.prototype._csTrayState.call(this, ...a); }
    _csDrawTray(...a) { return CosmicSystem.prototype._csDrawTray.call(this, ...a); }
    _csCastFx(...a) { return CosmicSystem.prototype._csCastFx.call(this, ...a); }
    _csBurst(...a) { return CosmicSystem.prototype._csBurst.call(this, ...a); }
    _csBanner(...a) { return CosmicSystem.prototype._csBanner.call(this, ...a); }
    // ── BossFX (Bosses.js) ──
    _bfxCfg(...a) { return BossFX.prototype._bfxCfg.call(this, ...a); }
    _bfxInit(...a) { return BossFX.prototype._bfxInit.call(this, ...a); }
    _bfxUpdate(...a) { return BossFX.prototype._bfxUpdate.call(this, ...a); }
    _bfxSwap(...a) { return BossFX.prototype._bfxSwap.call(this, ...a); }
    _bfxVoltShot(...a) { return BossFX.prototype._bfxVoltShot.call(this, ...a); }
    _bfxFragTick(...a) { return BossFX.prototype._bfxFragTick.call(this, ...a); }
    _bfxTrails(...a) { return BossFX.prototype._bfxTrails.call(this, ...a); }
    _bfxLights(...a) { return BossFX.prototype._bfxLights.call(this, ...a); }
    _bfxCallout(...a) { return BossFX.prototype._bfxCallout.call(this, ...a); }
    _bfxBosses(...a) { return BossFX.prototype._bfxBosses.call(this, ...a); }
    _bfxBossBar(...a) { return BossFX.prototype._bfxBossBar.call(this, ...a); }
    _bfxHideBars(...a) { return BossFX.prototype._bfxHideBars.call(this, ...a); }
    _bfxCrisp(...a) { return BossFX.prototype._bfxCrisp.call(this, ...a); }
    _bfxBossIce(...a) { return BossFX.prototype._bfxBossIce.call(this, ...a); }
    _bfxHitFlash(...a) { return BossFX.prototype._bfxHitFlash.call(this, ...a); }
    _bfxVoltDress(...a) { return BossFX.prototype._bfxVoltDress.call(this, ...a); }
    _bfxVoltTick(...a) { return BossFX.prototype._bfxVoltTick.call(this, ...a); }
    _bfxSlamWarn(...a) { return BossFX.prototype._bfxSlamWarn.call(this, ...a); }
    _bfxSlamHit(...a) { return BossFX.prototype._bfxSlamHit.call(this, ...a); }
    _bfxVoltZap(...a) { return BossFX.prototype._bfxVoltZap.call(this, ...a); }
    _bfxVoltDeath(...a) { return BossFX.prototype._bfxVoltDeath.call(this, ...a); }
    _bfxVoidDress(...a) { return BossFX.prototype._bfxVoidDress.call(this, ...a); }
    _bfxVoidTick(...a) { return BossFX.prototype._bfxVoidTick.call(this, ...a); }
    _bfxDrawMine(...a) { return BossFX.prototype._bfxDrawMine.call(this, ...a); }
    _bfxMineBlast(...a) { return BossFX.prototype._bfxMineBlast.call(this, ...a); }
    _bfxBeams(...a) { return BossFX.prototype._bfxBeams.call(this, ...a); }
    _bfxFragment(...a) { return BossFX.prototype._bfxFragment.call(this, ...a); }
    _bfxShatter(...a) { return BossFX.prototype._bfxShatter.call(this, ...a); }
    _bfxStompTrack(...a) { return BossFX.prototype._bfxStompTrack.call(this, ...a); }
    _bfxStompLand(...a) { return BossFX.prototype._bfxStompLand.call(this, ...a); }
    _bfxRift(...a) { return BossFX.prototype._bfxRift.call(this, ...a); }
    _bfxRiftClose(...a) { return BossFX.prototype._bfxRiftClose.call(this, ...a); }
    _bfxDrawRifts(...a) { return BossFX.prototype._bfxDrawRifts.call(this, ...a); }
    _bfxDrawRift(...a) { return BossFX.prototype._bfxDrawRift.call(this, ...a); }
    _bfxSniperRift(...a) { return BossFX.prototype._bfxSniperRift.call(this, ...a); }
    _bfxSniperRiftClose(...a) { return BossFX.prototype._bfxSniperRiftClose.call(this, ...a); }
    _bfxCoreDraw(...a) { return BossFX.prototype._bfxCoreDraw.call(this, ...a); }
    _bfxCoreLayout(...a) { return BossFX.prototype._bfxCoreLayout.call(this, ...a); }
    _bfxCoreTick(...a) { return BossFX.prototype._bfxCoreTick.call(this, ...a); }
    _bfxCoreKick(...a) { return BossFX.prototype._bfxCoreKick.call(this, ...a); }
    _bfxCoreDeath(...a) { return BossFX.prototype._bfxCoreDeath.call(this, ...a); }
    _bfxDust(...a) { return BossFX.prototype._bfxDust.call(this, ...a); }
    _bfxQueenDress(...a) { return BossFX.prototype._bfxQueenDress.call(this, ...a); }
    _bfxQueenTick(...a) { return BossFX.prototype._bfxQueenTick.call(this, ...a); }
    _bfxQueenPulse(...a) { return BossFX.prototype._bfxQueenPulse.call(this, ...a); }
    _bfxQueenDeath(...a) { return BossFX.prototype._bfxQueenDeath.call(this, ...a); }
    _bfxDrawVine(...a) { return BossFX.prototype._bfxDrawVine.call(this, ...a); }
    _bfxVineSnap(...a) { return BossFX.prototype._bfxVineSnap.call(this, ...a); }
    _bfxThump(...a) { return BossFX.prototype._bfxThump.call(this, ...a); }
    _bfxRootFx(...a) { return BossFX.prototype._bfxRootFx.call(this, ...a); }
    _bfxSings(...a) { return BossFX.prototype._bfxSings.call(this, ...a); }
    _bfxCollapseStart(...a) { return BossFX.prototype._bfxCollapseStart.call(this, ...a); }
    _bfxCollapseTick(...a) { return BossFX.prototype._bfxCollapseTick.call(this, ...a); }
    _bfxCollapseEnd(...a) { return BossFX.prototype._bfxCollapseEnd.call(this, ...a); }
    _bfxHorizonRing(...a) { return BossFX.prototype._bfxHorizonRing.call(this, ...a); }
    _bfxHorizonPulse(...a) { return BossFX.prototype._bfxHorizonPulse.call(this, ...a); }
    _bfxCrumble(...a) { return BossFX.prototype._bfxCrumble.call(this, ...a); }
    _bfxTileFrame(...a) { return BossFX.prototype._bfxTileFrame.call(this, ...a); }
    _bfxVoidDeath(...a) { return BossFX.prototype._bfxVoidDeath.call(this, ...a); }
    // ── TowerFloors (Tower.js) ──
    towerScaling(...a)       { return TowerFloors.prototype.towerScaling.call(this, ...a); }
    generateTowerArena(...a) { return TowerFloors.prototype.generateTowerArena.call(this, ...a); }
    _towerBlocks(...a) { return TowerFloors.prototype._towerBlocks.call(this, ...a); }
    _towerShift(...a) { return TowerFloors.prototype._towerShift.call(this, ...a); }
    _towerConnected(...a)    { return TowerFloors.prototype._towerConnected.call(this, ...a); }
    _towerBegin(...a)        { return TowerFloors.prototype._towerBegin.call(this, ...a); }
    _towerLeaveFx(...a) { return TowerFloors.prototype._towerLeaveFx.call(this, ...a); }
    _towerArriveFx(...a) { return TowerFloors.prototype._towerArriveFx.call(this, ...a); }
    _towerLabel(...a)        { return TowerFloors.prototype._towerLabel.call(this, ...a); }
    _towerBanner(...a)       { return TowerFloors.prototype._towerBanner.call(this, ...a); }
    _towerUpdate(...a)       { return TowerFloors.prototype._towerUpdate.call(this, ...a); }
    _towerWave(...a)         { return TowerFloors.prototype._towerWave.call(this, ...a); }
    _towerSpots(...a)        { return TowerFloors.prototype._towerSpots.call(this, ...a); }
    _towerTelegraph(...a)    { return TowerFloors.prototype._towerTelegraph.call(this, ...a); }
    _towerSpawn(...a)        { return TowerFloors.prototype._towerSpawn.call(this, ...a); }
    _towerBoss(...a)         { return TowerFloors.prototype._towerBoss.call(this, ...a); }
    _towerClear(...a)        { return TowerFloors.prototype._towerClear.call(this, ...a); }
    _towerNext(...a)         { return TowerFloors.prototype._towerNext.call(this, ...a); }
    _towerOpenExit(...a)     { return TowerFloors.prototype._towerOpenExit.call(this, ...a); }
    _towerApplyMods(...a)    { return TowerFloors.prototype._towerApplyMods.call(this, ...a); }
    _towerOffer(...a)        { return TowerFloors.prototype._towerOffer.call(this, ...a); }
    _towerPickScreen(...a)   { return TowerFloors.prototype._towerPickScreen.call(this, ...a); }
    _towerDraft(...a)        { return TowerFloors.prototype._towerDraft.call(this, ...a); }
    // ── CreatureFX (Creatures.js) ──
    _cfxCfg(...a) { return CreatureFX.prototype._cfxCfg.call(this, ...a); }
    _cfxInit(...a) { return CreatureFX.prototype._cfxInit.call(this, ...a); }
    _cfxUpdate(...a) { return CreatureFX.prototype._cfxUpdate.call(this, ...a); }
    _cfxBodyDrips(...a) { return CreatureFX.prototype._cfxBodyDrips.call(this, ...a); }
    _cfxDress(...a) { return CreatureFX.prototype._cfxDress.call(this, ...a); }
    _cfxMarks(...a) { return CreatureFX.prototype._cfxMarks.call(this, ...a); }
    _cfxGem(...a) { return CreatureFX.prototype._cfxGem.call(this, ...a); }
    _cfxStatus(...a) { return CreatureFX.prototype._cfxStatus.call(this, ...a); }
    _cfxBody(...a) { return CreatureFX.prototype._cfxBody.call(this, ...a); }
    _cfxChillBar(...a) { return CreatureFX.prototype._cfxChillBar.call(this, ...a); }
    _cfxSparks(...a) { return CreatureFX.prototype._cfxSparks.call(this, ...a); }
    _cfxClear(...a) { return CreatureFX.prototype._cfxClear.call(this, ...a); }
    _cfxBosses(...a) { return CreatureFX.prototype._cfxBosses.call(this, ...a); }
    _cfxDrops(...a) { return CreatureFX.prototype._cfxDrops.call(this, ...a); }
    _cfxPuppet(...a) { return CreatureFX.prototype._cfxPuppet.call(this, ...a); }
    _cfxPuppetSync(...a) { return CreatureFX.prototype._cfxPuppetSync.call(this, ...a); }
    _cfxPuppetOne(...a) { return CreatureFX.prototype._cfxPuppetOne.call(this, ...a); }
    _cfxSpeedArrow(...a) { return CreatureFX.prototype._cfxSpeedArrow.call(this, ...a); }
    _cfxShieldBlock(...a) { return CreatureFX.prototype._cfxShieldBlock.call(this, ...a); }
    _cfxPortrait(...a) { return CreatureFX.prototype._cfxPortrait.call(this, ...a); }
    _cfxLights(...a) { return CreatureFX.prototype._cfxLights.call(this, ...a); }
    // ── VisualFX (Visuals.js) ──
    _vfxWallLift(...a) { return VisualFX.prototype._vfxWallLift.call(this, ...a); }
    _vfxTileEmitters(...a) { return VisualFX.prototype._vfxTileEmitters.call(this, ...a); }
    _vfxTileFx(...a) { return VisualFX.prototype._vfxTileFx.call(this, ...a); }
    _vfxSteamPuff(...a) { return VisualFX.prototype._vfxSteamPuff.call(this, ...a); }
    _vfxCfg(...a) { return VisualFX.prototype._vfxCfg.call(this, ...a); }
    _vfxTheme(...a) { return VisualFX.prototype._vfxTheme.call(this, ...a); }
    _vfxInit(...a) { return VisualFX.prototype._vfxInit.call(this, ...a); }
    _vfxWrapPlayerTint(...a) { return VisualFX.prototype._vfxWrapPlayerTint.call(this, ...a); }
    _vfxBuildBloom(...a) { return VisualFX.prototype._vfxBuildBloom.call(this, ...a); }
    _vfxQueueObj(...a) { return VisualFX.prototype._vfxQueueObj.call(this, ...a); }
    _vfxFlush(...a) { return VisualFX.prototype._vfxFlush.call(this, ...a); }
    _vfxSort(...a) { return VisualFX.prototype._vfxSort.call(this, ...a); }
    _vfxUnsort(...a) { return VisualFX.prototype._vfxUnsort.call(this, ...a); }
    _vfxFadeOut(...a) { return VisualFX.prototype._vfxFadeOut.call(this, ...a); }
    _vfxFadeIn(...a) { return VisualFX.prototype._vfxFadeIn.call(this, ...a); }
    _aim(...a) { return VisualFX.prototype._aim.call(this, ...a); }
    _scrX(...a) { return VisualFX.prototype._scrX.call(this, ...a); }
    _scrY(...a) { return VisualFX.prototype._scrY.call(this, ...a); }
    _vfxUpdate(...a) { return VisualFX.prototype._vfxUpdate.call(this, ...a); }
    _vfxTrails(...a) { return VisualFX.prototype._vfxTrails.call(this, ...a); }
    _vfxAtlas(...a) { return VisualFX.prototype._vfxAtlas.call(this, ...a); }
    _vfxFrame(...a) { return VisualFX.prototype._vfxFrame.call(this, ...a); }
    _vfxRng(...a) { return VisualFX.prototype._vfxRng.call(this, ...a); }
    _vfxSoftTextures(...a) { return VisualFX.prototype._vfxSoftTextures.call(this, ...a); }
    _vfxRenderWorld(...a) { return VisualFX.prototype._vfxRenderWorld.call(this, ...a); }
    _vfxPaintFloor(...a) { return VisualFX.prototype._vfxPaintFloor.call(this, ...a); }
    _vfxPaintAO(...a) { return VisualFX.prototype._vfxPaintAO.call(this, ...a); }
    _vfxTileFrame(...a) { return VisualFX.prototype._vfxTileFrame.call(this, ...a); }
    _vfxPlaceDecals(...a) { return VisualFX.prototype._vfxPlaceDecals.call(this, ...a); }
    _vfxPaintDecal(...a) { return VisualFX.prototype._vfxPaintDecal.call(this, ...a); }
    _vfxPlaceTorches(...a) { return VisualFX.prototype._vfxPlaceTorches.call(this, ...a); }
    _vfxPaintSconce(...a) { return VisualFX.prototype._vfxPaintSconce.call(this, ...a); }
    _vfxUpdateTorches(...a) { return VisualFX.prototype._vfxUpdateTorches.call(this, ...a); }
    _vfxWard(...a) { return VisualFX.prototype._vfxWard.call(this, ...a); }
    _vfxPaintWard(...a) { return VisualFX.prototype._vfxPaintWard.call(this, ...a); }
    _vfxSludgeTile(...a) { return VisualFX.prototype._vfxSludgeTile.call(this, ...a); }
    _vfxPaintSludge(...a) { return VisualFX.prototype._vfxPaintSludge.call(this, ...a); }
    _vfxFogTile(...a) { return VisualFX.prototype._vfxFogTile.call(this, ...a); }
    _vfxPaintFog(...a) { return VisualFX.prototype._vfxPaintFog.call(this, ...a); }
    _vfxIceTile(...a) { return VisualFX.prototype._vfxIceTile.call(this, ...a); }
    _vfxPaintIce(...a) { return VisualFX.prototype._vfxPaintIce.call(this, ...a); }
    _vfxBuildAir(...a) { return VisualFX.prototype._vfxBuildAir.call(this, ...a); }
    _vfxUpdateRune(...a) { return VisualFX.prototype._vfxUpdateRune.call(this, ...a); }
    _vfxBuildLight(...a) { return VisualFX.prototype._vfxBuildLight.call(this, ...a); }
    _vfxFlash(...a) { return VisualFX.prototype._vfxFlash.call(this, ...a); }
    _vfxLights(...a) { return VisualFX.prototype._vfxLights.call(this, ...a); }
    _waterFlush(...a) { return LevelManager.prototype._waterFlush.call(this, ...a); }
    _texPatchUpload(...a) { return LevelManager.prototype._texPatchUpload.call(this, ...a); }
    _fogUpdate(...a) { return VisualFX.prototype._fogUpdate.call(this, ...a); }
    _fogHides(...a) { return VisualFX.prototype._fogHides.call(this, ...a); }
    _vfxCull(...a) { return VisualFX.prototype._vfxCull.call(this, ...a); }
    _vfxPerfWatch(...a) { return VisualFX.prototype._vfxPerfWatch.call(this, ...a); }
    _vfxUpdateLight(...a) { return VisualFX.prototype._vfxUpdateLight.call(this, ...a); }
    _vfxBuildBursts(...a) { return VisualFX.prototype._vfxBuildBursts.call(this, ...a); }
    _vfxSpawn(...a) { return VisualFX.prototype._vfxSpawn.call(this, ...a); }
    _vfxHit(...a) { return VisualFX.prototype._vfxHit.call(this, ...a); }
    _vfxDeath(...a) { return VisualFX.prototype._vfxDeath.call(this, ...a); }
    _vfxUnitColor(...a) { return VisualFX.prototype._vfxUnitColor.call(this, ...a); }
    _vfxPlayerHurt(...a) { return VisualFX.prototype._vfxPlayerHurt.call(this, ...a); }
    _vfxUltBanner(...a) { return VisualFX.prototype._vfxUltBanner.call(this, ...a); }
    _vfxFreezeBanner(...a) { return VisualFX.prototype._vfxFreezeBanner.call(this, ...a); }
    _vfxDamageNumber(...a) { return VisualFX.prototype._vfxDamageNumber.call(this, ...a); }
    _vfxStatusText(...a) { return VisualFX.prototype._vfxStatusText.call(this, ...a); }
    _vfxStatusFloat(...a) { return VisualFX.prototype._vfxStatusFloat.call(this, ...a); }
    _vfxFloat(...a) { return VisualFX.prototype._vfxFloat.call(this, ...a); }
    _vfxLavaTile(...a) { return VisualFX.prototype._vfxLavaTile.call(this, ...a); }
    _vfxPaintLava(...a) { return VisualFX.prototype._vfxPaintLava.call(this, ...a); }
    _vfxWaterImg(...a) { return VisualFX.prototype._vfxWaterImg.call(this, ...a); }
    _vfxPaintWater(...a) { return VisualFX.prototype._vfxPaintWater.call(this, ...a); }
    _vfxDrawWater(...a) { return VisualFX.prototype._vfxDrawWater.call(this, ...a); }
    _vfxUpdateShadows(...a) { return VisualFX.prototype._vfxUpdateShadows.call(this, ...a); }
    _vfxHop(...a) { return VisualFX.prototype._vfxHop.call(this, ...a); }
    _vfxBuildHud(...a) { return VisualFX.prototype._vfxBuildHud.call(this, ...a); }
    _vfxDrawHud(...a) { return VisualFX.prototype._vfxDrawHud.call(this, ...a); }
    _vfxHeart(...a) { return VisualFX.prototype._vfxHeart.call(this, ...a); }
    _vfxElIcon(...a) { return VisualFX.prototype._vfxElIcon.call(this, ...a); }
    updateIciclePips(...a)          { return HUD.prototype.updateIciclePips.call(this, ...a); }
    updateIcicleChargeBar(...a)     { return HUD.prototype.updateIcicleChargeBar.call(this, ...a); }
    _destroyIcicleBarObjects(...a)  { return HUD.prototype._destroyIcicleBarObjects.call(this, ...a); }
    openPauseMenu(...a) { return HUD.prototype.openPauseMenu.call(this, ...a); }
    _freezeClock(...a) { return HUD.prototype._freezeClock.call(this, ...a); }
    closePauseMenu(...a) { return HUD.prototype.closePauseMenu.call(this, ...a); }
    gameOver(...a) { return HUD.prototype.gameOver.call(this, ...a); }
    showDeathScreen(...a) { return HUD.prototype.showDeathScreen.call(this, ...a); }
    _showDeathContent(...a) { return HUD.prototype._showDeathContent.call(this, ...a); }
    showRoomName(...a) { return HUD.prototype.showRoomName.call(this, ...a); }
    _bossBar(...a) { return HUD.prototype._bossBar.call(this, ...a); }
    _bossBarHide(...a) { return HUD.prototype._bossBarHide.call(this, ...a); }
    _bossBarsKeep(...a) { return HUD.prototype._bossBarsKeep.call(this, ...a); }

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
        const name = roomObj?.name ?? nameMap[room] ?? (roomObj?.isChestRoom ? 'Chest Room' : null);   // (a laid-out side room carries its own)
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
            { label: 'Fill Ult',       key: null,                desc: 'Instantly max ult charge (every cosmic layer too)', action: () => { for (const k in this.ultGems) this.ultGems[k] = this.ultChargeMax; this.ultCharge = this.ultChargeMax; this._csSetLayers?.(this._csMaxLayers?.() ?? 1); this.updateHUD(); } },
            { label: 'Kill All',       key: null,                desc: 'Kill enemies in room',      action: () => { for (const e of [...this.enemies]) { if (this.isInCurrentRoom(e.x, e.y)) this.killEnemy(e); } } },
            { label: 'Max Health',     key: null,                desc: 'Restore full HP',            action: () => { this.health = this.maxHealth; this.updateHUD(); } },
            // Was `this.orbScraps = 9999`, which the run-scoped bank clamps to BANK_CAP on
            // the next save -- so the readout jumped to 9999 and then silently snapped back
            // to 40 the moment anything was bought. Fill to the cap instead, which is the
            // most the game will ever let you hold anyway.
            { label: 'Fill Scraps',    key: null,                desc: 'Scrap bank to the cap',
              action: () => { this.orbScraps = this._scrapCfg().BANK_CAP; this.saveScrapBank(); this.updateHUD(); } },
            // Unlock everything and make every cooldown ready.
            { label: 'All Gadgets',    key: null,                desc: 'Unlock all, reset cooldowns',
              action: () => {
                  for (const id of this._gadgetOrder()) this.unlockGadget(id);
                  this.beginGadgetRun();
                  this.updateHUD();
                  this.showStatusText(this.player.x, this.player.y - 20, 'ALL GADGETS', '#66ffcc');
              } },
            // The inverse, because testing the GATED state is the harder thing to reach once
            // unlocks are permanent in localStorage -- without this you would be editing
            // storage by hand to get back to a fresh player's view.
            { label: 'Lock Gadgets',   key: null,                desc: 'Clear gadget unlocks',
              action: () => {
                  localStorage.removeItem(this._unlockStoreKey());
                  this.beginGadgetRun();
                  this.updateHUD();
                  this.showStatusText(this.player.x, this.player.y - 20, 'GADGETS LOCKED', '#ff8866');
              } },
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
            const wx = this._aim(p).x + this.cameras.main.scrollX;
            const wy = this._aim(p).y + this.cameras.main.scrollY;
            const tx = Math.floor(wx / this.TILE_SIZE);
            const ty = Math.floor(wy / this.TILE_SIZE);
            const canPlace = this.world[tx]?.[ty] === this.FLOOR;
            teleportCursor.setVisible(true);
            drawCrosshair(p.x, p.y, canPlace);
        });

        this.input.on('pointerdown', (p) => {
            if (!this._devTeleportMode || p.button !== 0) return;
            const wx = this._aim(p).x + this.cameras.main.scrollX;
            const wy = this._aim(p).y + this.cameras.main.scrollY;
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
    // Passes `element` through. It used to drop it, so every typed damageEnemy call in the
    // game was resolved as whatever element you happened to hold.
    damageEnemy(enemy, damage, element) {
        if (this._devOneShot) {
            // Was a ternary on `EnemyManager.prototype.damageEnemy`, which has never
            // existed -- damageEnemy lives in CombatSystem. The condition was always
            // falsy, so the enemy.health + 1 branch was unreachable and one-shot always
            // dealt a flat 99999. Kept the behaviour, dropped the pretence of a choice.
            return CombatSystem.prototype.damageEnemy.call(this, enemy, 99999, element);
        }
        return CombatSystem.prototype.damageEnemy.call(this, enemy, damage, element);
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
        // Expire the crumble slow first: the tile can grow back (and the map empty) before the slow
        // runs out, and the early return below used to skip this, leaving you slowed for good.
        if (this._crumbleSlowUntil && time > this._crumbleSlowUntil) {
            this._crumbleSlowUntil = 0;
            if (this.moveCooldown > 200) this.moveCooldown = 200;
            if (this._playerSlowIndTimer) { this._playerSlowIndTimer.remove(); this._playerSlowIndTimer = null; }
        }
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