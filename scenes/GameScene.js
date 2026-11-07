// ═══════════════════════════════════════════════════════════════════════════
// GameScene.js — the dungeon scene itself: create, update, input. Everything else it does it borrows from the
// modules (the loop at the bottom of this file), each in its folder:
//   core/     Utils, Settings, Sound, Telemetry, Cloud, Uikit, Transitions, and how things look (Visuals, Creatures)
//   progress/  what you keep: Progress, Stats, Relics, Enchants, Garden, Achievements, Bounties, Loot, Drops
//   ui/        HUD (and the pause and death screens), Menus, TouchControls
//   combat/    CombatSystem (damage, kills, statuses), ElementSystem (the ults), ElementResist, Cosmic, Fork,
//              FieldKit (gadgets), Burn, Freeze
//   weapons/   WeaponSystem (what they share), then one file per weapon
//   enemies/   EnemyManager (movement, pathing, their shots), then one file per enemy type, and the bosses' looks
//   levels/    LevelManager (the story levels), WorldGen, LevelLayouts, TutorialManager, Training, Tower, the trials,
//              TideMother, Pulse, Breakers, Traps
//   scenes/    this one and the six others
// ═══════════════════════════════════════════════════════════════════════════

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
        this.storyFloor = data?.floor || 1; this._floorExit = null; this._cells = null; this._circuit = null; this._grav = null; this._slide = null; this._lightsOut = false; this._voltGateDone = false;   // a story level in floors: the one you're on (LevelManager._floorPlan)
        // Water lives on the scene object, which outlives a restart: the Cistern's (or a flooded
        // Tower floor's) tiles were still there, unseen, on the next level. Its pipes were too, still
        // refilling their old tiles on the new map and flinging water from mouths out in the void.
        this.waterTiles = null; this.steamTiles = null; this._pipes = null;
        // A Tower run (Tower.js): which floor, and what the run carries up from the last one
        this.towerRun = data?.tower ? { ...data.tower } : null;
        this.trainingRun = !!data?.training;   // Training.js: the Training Ground
        this._trainLayout = data?.trainLayout || null; this._trainRoomAt = data?.trainRoom ?? null;   // (a Training room with its own walls: Training.breakerWorld)
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
        this._bossIntroOn = false; this._bossIntroState = null; this._bossIntroSeen = {}; this._zzzAll = null;
        this._sfxHush = false;   // (a death or a win hushed the last run's sounds: Sfx.hush)
        this._rtrial = null;   // (a rhythm trial left running when the scene restarted)
        if (typeof Music !== 'undefined') Music.unduckAll();   // (nor its music, if a time stop or a cutscene was cut short)   // every boss makes its entrance again on a new run
        this._bannerActive = false; this._bannerClosing = null; this._encounterQueue = [];   // nor a first-encounter card left open
        // Poison and roots end on timers that a restart throws away: a run that ended poisoned
        // left traps unable to poison again, and one that ended rooted left you unable to walk
        // on any level that does not clear roots itself.
        this.playerPoisoned = false; this._poisonTickCount = 0; this._elStolen = null;
        this._poisonUntil = 0; this._bleedUntil = 0; this._pBurnUntil = 0; this._pBurn = 0; this._absHexUntil = 0; this._drippingUntil = 0; this._playerRooted = false; this._hurtTotal = 0;   // (the scene object outlives a restart: what was on you mustn't come with it)
        this._playerRooted  = false; this._playerRootUntil = 0; this._ccImmuneUntil = 0; this._bellRush = null;
        this._lifting = false;   // riding between a story level's floors (LevelManager._floorLeaveFx): no steps, no dashes
        this._actLocks = {}; this._actBan = null; this._actFlash = null;   // locked actions and their signs (HUD.lockActions)

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
            const bricks = this.add.image(0, 0, UIKit.bricks(this, W, H)).setOrigin(0).setScrollFactor(0).setDepth(5000);
            const dim = this.add.graphics().setScrollFactor(0).setDepth(5000);
            dim.fillStyle(0x000000, 0.62).fillRect(-W, -H, W * 3, H * 3);
            const cover = [wall, bricks, dim];
            let n = 0;
            const done = () => { if (++n < 3) return; this.game.events.off('postrender', done); if (wall.active) this.tweens.add({ targets: cover, alpha: 0, duration: 260, onComplete: () => cover.forEach(o => o.destroy()) }); };
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
        this._cavs                   = [];   // cavitation bubbles in flight (LevelManager._cavBubble)
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

        // Every ult's state (the scene object outlives a restart: dying mid-ult carried it into the next run,
        // and its per-frame watchers with it, since they run while these say the ult is up)
        this.ignitionActive = false; this._barrageOn = false; this._scorchHealt = 0;
        this._iceFrostUntil = 0; this._iceFrostAt = 0; this._iceShellUntil = 0; this._iceZoomed = false; this._coldEdge = null;
        this.tsunamiActive = false; this._iceUltDomainActive = false; this._iceUltDetonate = null;
        this._forkStop = false; this._forkAfter = null; this._forkSnapped = false;
        this._ultArmor = null; this._overflowBonus = {}; this._ultHit = null;

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
        } else if (this._floorPlan()?.sky && typeof MenuArt !== 'undefined') {
            this._atmoObjs = MenuArt.stormSky(this);   // Menus.js: the Gauntlet's roof, open to the storm
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
        this.iceBlockChance = 0.15;          // 15% chance on fire to shoot a big freeze block instead
        this.iceBlockDamage = 5.0;

        this.lightningChainRange = 4;
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

        // COSMIC ELEMENT - BATTERY CHARGE SYSTEM
        this.cosmicBatteryCharges = 0; // start empty — must channel to earn
        this.cosmicMaxCharges = 10;

        this.cosmicDropChance = 0;   // Cosmic.js: the cosmic gem fills with time; kills drop nothing

        // Cosmic marks system
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
        this.STAMINA = { MAX: 150, COST: 30, REGEN: 20, DELAY: 2000 };   // what a dash spends; refilled REGEN a second once you've not dashed for DELAY ms
        this.FIRE_DASH = { RUSH: 12, STAGGER: 300, OPEN_MS: 600, ERUPT: 16 };   // its hit going through, the stagger, the fissure's wait, each eruption's burst (x damageScaling)
        this._dashReadyAt = 0; this._stam = null; this._stamAt = 0; this._stamDeniedAt = 0; this._windedUntil = 0; this._gluUntil = 0; this._gluFx = null; this._tutFalling = false;
        this._dashInvulnUntil = 0;
        this._lastMoveDir = { x: 0, y: 1 };

        // Visual battery display
        this.cosmicBatteryDisplay = null;

        // ESC — open/close pause menu
        this.input.keyboard.on('keydown-ESC', () => {
            if (this._deathScreenActive) return;
            if (this._bossIntroOn) return this._bossIntroEnd();   // skips a boss's entrance
            if (this._pauseMenuOpen) {
                this.closePauseMenu();
            } else {
                this.openPauseMenu();
            }
        });

        // Every binding comes from Settings.js (the lobby's settings panel rebinds them).
        for (const el of ['fire', 'ice', 'lightning', 'cosmic']) {
            this.input.keyboard.on('keydown-' + Settings.key(el), () => this.actionLocked('swap') ? this._actionDenied('swap') : this.switchToElement(el));
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

        // E key to activate ult (a held key repeats its press: only the first counts, for all the ult keys)
        this.input.keyboard.on('keydown-' + Settings.key('ult'), (ev) => {
            if (ev?.repeat) return;
            // If black hole projectile is in flight, E detonates it
            if (this.cosmicBlackHoleProjectile) {
                this.detonateCosmicBomb();
                return;
            }
            if (this.currentElement === 'cosmic' && this._csVDown?.('ult')) return;   // holding cosmic, E is V: tap vs hold (Cosmic.js)
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
            this.input.keyboard.on('keydown-' + key, (ev) => {
                if (ev?.repeat) return;
                if (el === 'cosmic' && this._csVDown?.('ultCosmic')) return;   // Cosmic.js stage 2: tap vs hold
                this.castUlt(el);
            });
        }
        this.input.keyboard.on('keyup-' + Settings.key('ultCosmic'), () => this._csVUp?.('ultCosmic'));
        this.input.keyboard.on('keyup-' + Settings.key('ult'), () => this._csVUp?.('ult'));

        // SPACE — dash, any element. Queued here and spent in update (so it reads the movement
        // keys' direction there). Not polled with JustDown: a tap whose down and up land in the
        // same frame clears Key._justDown before update ever sees it, and the dash is lost.
        this.spaceKey = this.input.keyboard.addKey(Settings.key('dash'));
        this.input.keyboard.on('keydown-' + Settings.key('dash'), () => { if (this.actionLocked('dash')) this._actionDenied('dash'); else if (this._rtrial) RhythmTrial.jump(this); else this._dashQueued = true; });   // the rhythm trial: a jump (Shift still dashes)

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
        this._cinemaUntil = 0; this._fog = null; this._condAuto = false; this._condWires = []; this._condMisses = []; this._condPulses = []; this._condPairs = []; this._condRings = []; this._condRingMax = 0; this._condHold = null; this._condMode = 'live'; this._condWeb = 0; this._condG = null; this._condGL = null; this._condBar = null; this._condPool = []; this._condSparks = null; this._condLights = [];   // the Conductor's
        this._fracCharge = 0; this._fracBar = null; this._fracBlooming = false; this._fracFx = null;   // Fractal Shard's R   // Ignition's flamethrower starts each run out, on a full tank
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
        this.input.keyboard.on('keydown-' + Settings.key('detonate'), (ev) => {   // Ignition: every kindled mark goes off now
            if (this._pauseMenuOpen || this._deathScreenActive || this._encased?.() || ev?.repeat) return;
            if (this._condWielding?.()) {   // the Circuit Breaker: at a wire, a tap changes its kind and holding cuts it (_condHoverDraw); elsewhere, the next clamp's kind
                const hv = this._condHover?.();
                if (hv) { this._condHold = { w: hv, t0: this.time.now }; return; }
                const M = ['live', 'ins', 'cap'], next = M[(M.indexOf(this._condMode || 'live') + 1) % 3];   // the next clamp: live, insulator, capacitor
                this._condMode = next;
                this.showStatusText(this.player.x, this.player.y - 30, { live: 'LIVE WIRE', ins: 'INSULATOR', cap: 'CAPACITOR' }[next], { live: '#fff08a', ins: '#9fdcff', cap: '#ffb070' }[next]);
                Sfx.play(this, 'click');
                return;
            }
            this._kindleDetonateAll?.();
        });
        this.input.keyboard.on('keyup-' + Settings.key('detonate'), () => {   // let go before the hold cut it: a tap, so it changes kind
            const H = this._condHold; this._condHold = null;
            if (H && !H.cut && H.w.on) this._condRetype(H.w);
        });
        this.input.keyboard.on('keydown-' + Settings.key('gadget1'), () => {
            if (this._pauseMenuOpen || this._deathScreenActive) return;
            this.useGadget(0, this.pointerX, this.pointerY);
        });
        this.input.keyboard.on('keydown-' + Settings.key('call'), () => {   // Riyal's Call, once she's free (TideMother.js)
            if (this._pauseMenuOpen || this._deathScreenActive) return;
            TideMother.call(this);
        });

        this.input.mouse?.disableContextMenu();   // right-click is a game input (the Twin Collapse anchor)
        this.input.on('pointerdown', (pointer) => {
            if (this._pauseMenuOpen || this._deathScreenActive) return;
            if (this._dialogueObjects) return;   // a click on Glerp's box only moves the talk on
            if (this._towerPicking) return;      // Tower.js: choosing a pick
            if (this._train && Training.overPanel(this, pointer)) return;   // Training.js: a click on its panel
            if (this._train && (!this._touch || this._touch.aimPointer(pointer) === pointer) && Training.place(this, pointer)) return;   // Training.js: placing (or taking away) an enemy (a touch screen: never a thumb on a stick or a button)
            if (this._touch && !(pointer = this._touch.aimPointer(pointer))) return;   // a touch screen: only the aiming thumb attacks, where it aims (TouchControls.js)
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
            if (this._touch && !(pointer = this._touch.aimPointer(pointer))) return;   // (a thumb off a stick or a button lets go of nothing)
            this.isPointerDown = false;
            this._csRelease?.();   // Cosmic.js: a charged Void Blade slashes on release
            this._csPointerUp?.();  // ...and a Twin Collapse drag throws
        });

        // TAB used to cycle the selected gadget; with two fixed slots (Q, F) there is nothing
        // to cycle. Still swallowed so it can't move focus off the canvas.
        this.input.keyboard.on('keydown-TAB', (event) => event.preventDefault());

        this.input.on('pointermove', (pointer) => {
            if (this._touch && !(pointer = this._touch.aimPointer(pointer))) return;
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
            if (Scythe.held(this)) { Scythe.wave(this); return; }   // the Ember Scythe's Heat Wave
            if (Rimeguard.held(this)) { Rimeguard.release(this); return; }   // the Rimeguard's Shatterback
            if (Glaive.held(this)) { Glaive.r(this); return; }   // the Thunder Glaive: a tesla coil
            if (Trident.held(this)) { Trident.r(this); return; }   // the Boreal Trident's Frostkin
            // Ignition — burst fire mode
            if (this.currentElement === 'fire' &&
                (this.equippedWeapons?.fire || 'flame_fists') === 'ignition') {
                this.kindlingIgnitionMode();
                return;
            }
            // The Circuit Breaker: a current down a wire
            // R toggles it (no key to hold, as Ignition's click): on, the currents keep coming, one each time it's ready, until R again or no live wire is left
            if (this.currentElement === 'lightning' && this.equippedWeapons?.lightning === 'conductor') { this._conductorToggle(); return; }
            // Fractal Shard: Fractal Bloom (Fractal._fractalBloom), charged by fan shards on the spikes' marks
            if (this.currentElement === 'ice' && this.equippedWeapons?.ice === 'fractal_shard') { this._fractalBloom(); return; }
            // Icicle Cannon: a full charge raises the Frost Shield (CombatSystem._frostShieldHit)
            if (this.currentElement === 'ice' &&
                (this.equippedWeapons?.ice || 'ice_fists') === 'icicle_cannon') {
                const HITS_TO_CHARGE = 28;
                if ((this._icicleHitCounter || 0) >= HITS_TO_CHARGE) {
                    this._icicleHitCounter = 0;
                    this._frostShieldUntil = this.time.now + 5000; this._frostShieldMs = 5000;   // (how long it was raised for: the HUD's bar drains from full)
                    this._frostShieldFx?.();
                    this.showStatusText(this.player.x, this.player.y - 30, 'FROST SHIELD', '#bff4ff');
                    this._vfxBursts?.ice?.explode(20, this.player.x, this.player.y);
                    Sfx.play(this, 'frost_shield');
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
        if (this._floorPlan()) this._floorBegin();   // a story level's floor: what you carried up, its name, the way you came in
        if (this._floorPlan() && this.currentLevelIndex === 2) Pulse.gauntlet(this);   // the Gauntlet: its floors conduct (Pulse.js)
    }

    // Cosmic's dash toward (dirX, dirY), and the bookkeeping that rides on it: each tile
    // crossed feeds Void Fists' momentum and the Singularity Staff. Shift and Space both land here.
    // Cosmic's dash: two hops, HOP_GAP apart, each to the open tile nearest the cursor within reach, at any angle
    // (ElementSystem.cosmicDashAim). The second aims again, so you can bend the pair, but you can't walk in between.
    // The cooldown runs from the second.
    // While an ult runs, your step: the fire ult's heat drives you (about 1.8x faster), the ice ult's cold weighs
    // you down (about 1.9x slower: you've gone dangerously cold, and move like it until it thaws).
    _ultMoveMult() {   // (a move delay multiplier: the ice ult's cold starts at 1.9 and wears off to 1 over its SLOW_MS)
        if (this.ignitionActive) return 0.55;
        if (this._forkAfter && this.time.now < this._forkAfter.until) return this._forkCfg().SPEED_MULT;   // Fork's aftermath: fast
        const now = this.time.now, f = now < (this._iceFrostUntil || 0) ? Math.max(0, 1 - (now - (this._iceFrostAt || 0)) / this._iceFrostCfg().SLOW_MS) : this.tsunamiActive ? 1 : 0;
        return 1 + 0.9 * f;
    }

    // Stamina: every dash spends some (the cooldowns still pace them; this stops a run of them going on for ever), and it
    // refills once you've stopped dashing a moment. Relics raise the most you hold (stamMax), cut a dash's cost (stamCost),
    // quicken the refill (stamRegen). The bar sits under the health bar (Visuals._vfxDrawHud).
    _stamMax() { return this.STAMINA.MAX + (this._mods?.stamMax || 0); }
    _stamCost() { return this.STAMINA.COST * (this._mods?.stamCost ?? 1); }
    _stamTick(delta) {
        const max = this._stamMax();
        if (this._stam == null) this._stam = max;
        const up = this.time.now - this._stamAt >= this.STAMINA.DELAY && !((this._windedUntil || 0) > this.time.now) ? this.STAMINA.REGEN * (this._mods?.stamRegen ?? 1) * (delta || 16) / 1000 : 0;   // (WINDED: none)
        this._stam = Math.min(max, this._stam + up);
    }
    // a dash's worth spent, or false (and a nudge) when there isn't that much left
    _stamSpend() {
        if (this._rtrial) return true;   // the rhythm trial's dashes are on its beat
        const cost = this._stamCost(), now = this.time.now;
        if ((this._stam ?? this._stamMax()) < cost) {
            if (now - this._stamDeniedAt > 500) { this.showStatusText(this.player.x, this.player.y - 30, 'OUT OF STAMINA', '#7fc8ff'); Sfx.play(this, 'deny'); }
            this._stamDeniedAt = now;
            return false;
        }
        this._stam = (this._stam ?? this._stamMax()) - cost; this._stamAt = now;
        return true;
    }
    // WINDED, a status any enemy can put on you: your stamina doesn't refill till it ends (dashes cost what they always do).
    // It doesn't stack: the longest left wins. Its icon is in the row over you (_playerStatusRow), the bar goes grey and cracked.
    applyWinded(ms) {
        if (this._tauntAlly) return;   // (an ally standing in for you isn't winded: CombatSystem.tauntTo)
        const now = this.time.now, was = (this._windedUntil || 0) > now;
        if (now + ms <= (this._windedUntil || 0)) return;
        this._windedUntil = now + ms; this._windedMs = ms;
        if (!was && this.player) { this.showStatusText(this.player.x, this.player.y - 40, 'WINDED', '#c8d0dc'); Sfx.play(this, 'status'); }
    }

    _cosmicDashToward() {
        const now = this.time.now, HOP_GAP = 400;
        if (this._lifting || this._cosmicHops || this._playerRooted || now - (this.lastCosmicDashTime || 0) < this.cosmicDashCooldown) return;
        if (!this._stamSpend()) return;
        this._cosmicHops = true;
        this._glideUntil = now + HOP_GAP + 150;   // the catch: you can't walk during it, from the first hop until just after the second
        this._cosmicHop();
        this.time.delayedCall(HOP_GAP, () => {
            this._cosmicHops = false; this.lastCosmicDashTime = this.time.now;
            if (this.currentElement === 'cosmic' && !this._deathScreenActive && !this._csRooted?.() && !this._playerRooted && !this._glued() && !this.actionLocked('dash')) this._cosmicHop();
        });
    }
    _cosmicHop() {
        const preDashX = this.playerX, preDashY = this.playerY;
        if (!this.cosmicDashAim()) return;
        const tilesMoved = Math.max(Math.abs(this.playerX - preDashX), Math.abs(this.playerY - preDashY));
        Sfx.play(this, 'dash', { el: 'cosmic' });
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
        try { this._frame(time, delta); this._actLockTick(); }   // (the locks' signs after the frame, which returns early when paused or in stopped time)
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

        const shiftNow = this.shiftKey.isDown && !this.shiftWasDown && !(this._rtrial && !RhythmTrial.aimTile(this));   // (the rhythm trial: no dash due, no dash; it flew off toward the cursor)
        if (shiftNow && this.actionLocked('dash')) this._actionDenied('dash');
        else if (this.currentElement === 'cosmic' && shiftNow && !this._csRooted?.() && !this._glued()) {   // (glued: falls to the queue below, which refuses it)
            // Use stored pointer + scroll for guaranteed world coords
            const mouseWorldX = this.pointerX + this.cameras.main.scrollX;
            const mouseWorldY = this.pointerY + this.cameras.main.scrollY;
            const playerCenterX = this.playerX * this.TILE_SIZE + this.TILE_SIZE / 2;
            const playerCenterY = this.playerY * this.TILE_SIZE + this.TILE_SIZE / 2;

            this._cosmicDashToward();   // two hops toward the cursor, any angle
        } else if (shiftNow) this._dashQueued = true;   // any other element: Shift dashes like Space
        this.shiftWasDown = this.shiftKey.isDown;

        this._stamTick(delta);
        this._updateGlide(this.time.now);   // a dash in progress (ElementSystem.js). The scene clock, as the dash set it: after a pause
        // the frame's `time` runs ahead of it by the pause, and the glide finished on its first frame
        // Dash: the way the movement keys point, or the way you last moved.
        this._updateGlu();
        if (this._dashQueued && (this._csRooted?.() || this.actionLocked('dash'))) this._dashQueued = false;   // transforming, or locked since the press: no dash
        if (this._dashQueued && this._glued()) {   // a Glu (LevelManager._applyGlu): no dashing
            this._dashQueued = false;
            if (this.time.now - (this._pinnedSaidAt || 0) > 700) { this._pinnedSaidAt = this.time.now; this.showStatusText(this.player.x, this.player.y - 30, 'GLUED', '#e8c84a'); Sfx.play(this, 'deny'); }
        }
        if (this._dashQueued) {
            this._dashQueued = false;
            // toward the cursor, to the nearest of the 4 directions (cosmic's hop alone goes any way); on a touch screen (or
            // with the cursor right on you) the way the movement keys point, or the way you last moved
            let ddx = 0, ddy = 0;
            const ap = this._aim(this.input.activePointer), cam = this.cameras.main, T = this.TILE_SIZE;
            const mx = ap.x + cam.scrollX - (this.playerX * T + T / 2), my = ap.y + cam.scrollY - (this.playerY * T + T / 2);
            if (!this.isMobile && Math.abs(mx) + Math.abs(my) > 4) {
                const a = Math.round(Math.atan2(my, mx) / (Math.PI / 2)) * (Math.PI / 2);
                ddx = Math.round(Math.cos(a)); ddy = Math.round(Math.sin(a));
            } else {
                if (this.keys.W.isDown) ddy = -1;
                else if (this.keys.S.isDown) ddy = 1;
                else if (this.keys.A.isDown) ddx = -1;
                else if (this.keys.D.isDown) ddx = 1;
                if (!ddx && !ddy) { ddx = this._lastMoveDir.x; ddy = this._lastMoveDir.y; }
            }
            const auto = this._rtrial && RhythmTrial.aim(this);   // the rhythm trial: a dash goes for the next slab, wherever the cursor is
            if (auto) { ddx = auto[0]; ddy = auto[1]; }
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
        const stepMs = this.moveCooldown * _waterMult * (this._csMoveMult?.() ?? 1) * (this._frostHazeMult || 1) * (this._mods?.speed ?? 1) * Enchants.speed(this.equippedWeapons?.[this.currentElement]) * (this._chaosMove?.() ?? 1) * this._ultMoveMult() * this._diverSlow() * this._bellMoveMult();   // (a Torpedo Diver's hit)
        this._stepMul = stepMs / (200 * (this._mods?.speed ?? 1) * Enchants.speed(this.equippedWeapons?.[this.currentElement]));   // how much slower or faster than usual right now (relics and books aside): LevelManager._updateSpeedMarks
        if (this._slide) this._gravSlide();   // the gravity room: a fall under way, no steps till it stops (LevelManager)
        const _grav = this._gravZone();
        if (!this._slide && (_grav || time - this.lastMoveTime >= stepMs) && this.time.now >= (this._staggerUntil || 0) && this.time.now >= (this._glideUntil || 0) && !this._lifting) {   // (scene clock, not the loop's `time`: they part after a pause)   // Leaden: a corrupted book's curse; the Wheel of Fate; Double or Nothing's stagger
            let dx = 0, dy = 0;

            if (!this._playerRooted && !this._csRooted?.()) {
                if (this._rtrial || _grav) {   // the rhythm trial: a step per press (held, the quickened step stepped again, off the slab), a tap kept till the step's free (the gravity room: a fall)
                    const U = this._rtUsed ||= {};
                    let pick = null;
                    for (const [n, kx, ky] of [['W', 0, -1], ['S', 0, 1], ['A', -1, 0], ['D', 1, 0]]) {
                        const k = this.keys[n];
                        if (k.timeDown && k.timeDown !== U[n] && (!pick || k.timeDown > this.keys[pick[0]].timeDown)) pick = [n, kx, ky];
                    }
                    if (pick) { U[pick[0]] = this.keys[pick[0]].timeDown; dx = pick[1]; dy = pick[2]; }
                }
                else if (this.keys.W.isDown) dy = -1;
                else if (this.keys.S.isDown) dy = 1;
                else if (this.keys.A.isDown) dx = -1;
                else if (this.keys.D.isDown) dx = 1;
            }

            if (_grav) { if (dx || dy) this._gravPush(dx, dy); }
            else if (dx !== 0 || dy !== 0) {
                const newX = this.playerX + dx;
                const newY = this.playerY + dy;

                const enemyAtTarget = this.getEnemyAt(newX, newY);
                if (enemyAtTarget) {
                    // Walking into an enemy hurts you, unless Ironhide's Spiked Hide turns it round.
                    if (PlayerStats.has(this, 'spiked')) this.damageEnemy(enemyAtTarget, 8 * this.damageScaling, this.currentElement);
                    else this.takeDamage(1, enemyAtTarget);
                    this.lastMoveTime = time;
                    return;
                }

                if (this._circuit && this._circuitBump(newX, newY)) { this.lastMoveTime = time + 100; return; }   // a junction box: walking into it turns it

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

        this.updateTsunamiPuddles(time);
        if (!this._devFreezeEnemies) this.moveEnemies();

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
            this._magmaRippleReady = (this._magmaHeat || 0) >= MagmaStaff.SURGE_MIN_HEAT && this.time.now >= (this._magmaSurgeCdUntil || 0);
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
        Scythe.tick(this, time);
        Fractal.tick(this, time);
        Rimeguard.tick(this, time);
        Glaive.tick(this, time);
        Trident.tick(this, time);
        Blinder.tick(this, time);
        Sniper.tick(this, time);
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

        // Level 2 boss: updated once a frame, above. It was updated here a second time, so its
        // shots flew and turned at double their numbers; those are doubled where they are set.
        // Black hole projectile removed - using laser ult instead
        this.updateCosmicBlackHoleProjectile(delta);
        this.updateCosmicBlackHole(time);

        // Ult gems animate every frame (pulse, lockout sweep, ready ping).
        this._drawUltGems();
        this._chaosTick?.(time);   // the Wheel of Fate (Relics.js, the Chaos shelf)
        this._vfxUpdate(time, delta);
        this._cfxUpdate(time, delta);
        this._csUpdate(time, delta);
        for (const e of this.enemies) if (e.sprite?.active) this._syncEnemyMarks(e);   // after everything that moves them
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

    // A phone or a tablet: sticks and buttons on the screen (TouchControls.js)
    createTouchControls() {
        this.isMobile = TouchControls.on(this);
        this._touch = this.isMobile ? TouchControls.game(this) : null;
    }

    // Required: getPortalAt is proxied with .call(this), so `this` is the SCENE and its
    // internal this._portalCoversTile(...) resolves here, not on LevelManager.prototype.
    // Without this stub every portal hit test throws instead of missing.

    // CombatSystem
    damageEnemy(...a) { return CombatSystem.prototype.damageEnemy.call(this, ...a); }
    takeDamage(...a) { if (this._devGodMode && !this._tauntAlly) { Rimeguard.guard(this, a[0]); return; } return CombatSystem.prototype.takeDamage.call(this, ...a); }   // (god mode still fills the Rimeguard's Rime, to try it out; it's yours: an ally standing in for you is still hit)

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
        const name = roomObj?.name ?? nameMap[roomObj?.story ?? room] ?? (roomObj?.isChestRoom ? 'Chest Room' : null);   // (a floor's rooms by their number in the level as one map)   // (a laid-out side room carries its own)
        if (name) this.showRoomName(name);
    }

    // ── DEV PANEL ────────────────────────────────────────────────────────
    // To the corridor two tiles outside the boss room (each story level's last room), on the side the story path comes in by
    _devToBossDoor() {
        const B = [this.voltslimeBoss, this.voidSovereignBoss].find(o => o?.active && o.tileX != null), T = this.TILE_SIZE;   // (on a level in floors, the room the boss is actually in)
        const R = (B && this.rooms?.find(r => B.tileX >= r.x && B.tileX < r.x + r.w && B.tileY >= r.y && B.tileY < r.y + r.h)) || this.rooms?.[{ 2: 6, 3: 6, 4: 6, 5: 14 }[this.currentLevelIndex]];
        const say = (t, c = '#ff8866') => this.showStatusText(this.player.x, this.player.y - 20, t, c);
        if (!R) return say('NO BOSS ROOM HERE');
        const inR = (x, y) => x >= R.x && x < R.x + R.w && y >= R.y && y < R.y + R.h, F = (x, y) => this.world[x]?.[y] === this.FLOOR;
        const mouths = [];   // floor just outside the room, touching its floor: its doorways (and which way is out)
        for (let x = R.x - 1; x <= R.x + R.w; x++) for (let y = R.y - 1; y <= R.y + R.h; y++) {
            if (inR(x, y) || !F(x, y)) continue;
            const d = [[1, 0], [-1, 0], [0, 1], [0, -1]].find(([dx, dy]) => inR(x + dx, y + dy) && F(x + dx, y + dy));
            if (d) mouths.push([x, y, -d[0], -d[1]]);
        }
        if (!mouths.length) return say('NO WAY IN FOUND');
        const P = R._from || this.rooms[this.rooms.indexOf(R) - 1], pc = P ? [P.x + P.w / 2, P.y + P.h / 2] : [this.playerX, this.playerY];
        let [tx, ty, ox, oy] = mouths.sort((a, b) => Math.hypot(a[0] - pc[0], a[1] - pc[1]) - Math.hypot(b[0] - pc[0], b[1] - pc[1]))[0];
        if (F(tx + ox, ty + oy)) { tx += ox; ty += oy; }
        this.playerX = tx; this.playerY = ty; this._glideUntil = 0;
        this.player.setPosition(tx * T + T / 2, ty * T + T / 2 + (this.SLIME_Y_OFFSET || 0));
        this.cameras.main.centerOn(this.player.x, this.player.y);
        say('BOSS DOOR', '#44ff44');
    }
    // dev: straight to floor n of this level, as if you'd come up to it (your health, gems and element carried)
    _devToFloor(n) {
        this.scene.restart({ levelIndex: this.currentLevelIndex, floor: n, continueRun: true, carry: { hp: this.health, gems: { ...(this.ultGems || {}) }, el: this.currentElement } });
    }
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
            { label: 'To Boss Door',   key: null,                desc: 'Warp to the boss room corridor', action: () => this._devToBossDoor() },
            ...(LevelLayouts.FLOORS[this.currentLevelIndex] || []).map((F, i) => ({ label: `Floor ${this.currentLevelIndex}-${i + 1}`, key: null, desc: `Straight to ${F.name}`, action: () => this._devToFloor(i + 1) })),   // (a level in floors: any of them)
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
        if (enemy?._rhythmCore) damage *= RhythmTrial.coreMult(this);   // the rhythm trial's groove and breaks (RhythmTrial.js)
        return CombatSystem.prototype.damageEnemy.call(this, enemy, damage, element);
    }

    // ── Crumble tile system (Level 4 only) ───────────────────────────────────
    _getCrumbleTileKey(tx, ty) { return `${tx},${ty}`; }

    // the tiles that will crumble, marked (fx_ground crumble0: hairline cracks, chipped corners; flipped tile to tile)
    _renderCrumbleZones() {
        if (!this._crumbleZones) return;
        const TS = this.TILE_SIZE;
        for (const key of this._crumbleZones) {
            const [tx, ty] = key.split(',').map(Number);
            this.add.image(tx * TS + TS / 2, ty * TS + TS / 2, 'fx_ground', 'crumble0').setDepth(0.55).setFlipX(((tx + ty) & 1) === 1);
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

        // it cracks (fx_ground crumble1), then breaks open (crumble2: a dark pit between tilted plates)
        const gfx = this.add.image(px, py, 'fx_ground', 'crumble1').setDepth(0.6).setFlipX(((tx + ty) & 1) === 1);

        const entry = { state: 'cracking', gfx, x: tx, y: ty, timer: null };
        this._crumbleTiles.set(key, entry);

        // After 1.2s the tile fully cracks
        entry.timer = this.time.delayedCall(1200, () => {
            if (!this._crumbleTiles.has(key)) return;
            entry.state = 'broken';
            if (gfx.active) gfx.setFrame('crumble2');
            entry._brokenAt = this.time.now;

            // Restore after 12s
            entry.timer = this.time.delayedCall(12000, () => {
                this._restoreCrumbleTile(key);
            });
        });
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
                    this.takeDamage(DMG, 'crumbled floor');
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

// Every module's methods on the scene, so `this` in them is the scene: each body lives in its own file, in the folders
// beside this one. A name GameScene defines itself stays its own; the same name in two modules is a mistake, said once.
{
    const from = {};
    for (const M of [
        WorldGen, TutorialManager, LevelManager, TowerFloors,
        EnemyManager, Spitter, Berserker, Mortar, Splitter, Rooter, Anchor, HealerTotem, Sniper, BossFX, Traps, Drops,
        CombatSystem, ElementSystem, CosmicSystem, FieldKit, Burn, Freeze,
        WeaponSystem, FlameFists, FlameSword, MagmaStaff, KindlingBrand, IceFists, IcicleCannon, Fractal,
        LightningFists, OrbEmitter, BallLightning, Conductor, CosmicFists, SingularityStaff, Wrench,
        HUD, VisualFX, CreatureFX,
    ]) {
        for (const k of Object.getOwnPropertyNames(M.prototype)) {
            if (k === 'constructor') continue;
            if (Object.prototype.hasOwnProperty.call(GameScene.prototype, k)) {
                if (from[k]) console.warn(`${M.name}.${k} is also ${from[k]}.${k}: the scene keeps the first`);
                continue;
            }
            Object.defineProperty(GameScene.prototype, k, Object.getOwnPropertyDescriptor(M.prototype, k));
            from[k] = M.name;
        }
    }
}

// ─── LEVEL SELECT SCENE ────────────────────────────────────────────────────