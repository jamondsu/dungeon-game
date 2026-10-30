// ═══════════════════════════════════════════════════════════════════════════
// BOOTSCENE.JS - Loading screen with falling blue slime
// ═══════════════════════════════════════════════════════════════════════════

class BootScene extends Phaser.Scene {
    constructor() { super({ key: 'Boot' }); }

    preload() {
        // Load just what we need for the loading screen itself
        this.load.spritesheet('slime_blue', 'assets/Slime_Blue_32x32.png', {
            frameWidth: 32, frameHeight: 32
        });
        // the menus' level pictures and the loader show the game's own slimes (Menus.js diorama)
        for (const c of ['red', 'orange', 'purple']) this.load.spritesheet('slime_' + c, `assets/Slime_${c[0].toUpperCase() + c.slice(1)}_32x32.png`, { frameWidth: 32, frameHeight: 32 });
        // and the level's own sheets, so entering one never waits on a load (a scene loading draws nothing: a black frame,
        // left on screen while a big level builds)
        this.load.spritesheet('tiles', 'assets/roguelikeDungeon_transparent.png', { frameWidth: 17, frameHeight: 17 });
        this.load.spritesheet('cloud_storm', 'assets/cloud_storm.png', { frameWidth: 280, frameHeight: 70 });
        // the art the code used to paint, kept as files (assets/art) so it can be redrawn by hand: manifest.json lists them
        // (an atlas where a texture has named frames). The code that painted each one still paints it if its file is missing
        // (it only paints a texture that isn't there).
        // Version tags, so a browser never mixes an old file with a new one after a release: on the site each file's own
        // (`v` in the manifest, window.BUILD for the manifest, set when a release is stamped); played at home, always fresh.
        // Only the art here is tagged (the music/sfx and a few scenes' own loads aren't); tag them if they change often.
        const home = /^(localhost|127\.|0\.0\.0\.0|$)/.test(location.hostname), now = Date.now();
        const q = v => `?v=${home ? now : (v || window.BUILD || '')}`;
        this.load.json('art_manifest', 'assets/art/manifest.json' + q());
        this.load.once('filecomplete-json-art_manifest', (key, type, M) => {
            for (const f of M?.files || []) {
                if (f.atlas) this.load.atlas(f.key, `assets/art/${f.key}.png${q(f.v)}`, `assets/art/${f.key}.json${q(f.v)}`);
                else this.load.image(f.key, `assets/art/${f.key}.png${q(f.v)}`);
            }
        });
    }

    create() {
        // the glows and gradients were drawn smooth; a loaded file is pixel-sharp unless told otherwise
        for (const f of this.cache.json.get('art_manifest')?.files || []) if (f.linear && this.textures.exists(f.key)) this.textures.get(f.key).setFilter(Phaser.Textures.FilterMode.LINEAR);
        Music.play(this, 'menu');
        const W = this.scale.width;
        const H = this.scale.height;

        this.add.rectangle(0, 0, W, H, 0x050a10).setOrigin(0).setDepth(-60);
        // Visuals.js: the same starfield, dust and vignette as the dungeon, and its glow
        if (typeof VisualFX !== 'undefined') VisualFX.dressMenu(this, { depth: -50, bloom: true });

        // Title text: big, lit from within, breathing slowly
        const title = this.add.text(W / 2, H * 0.28, 'DUNGEON', {
            fontSize: '72px', fontFamily: 'monospace', color: '#e6f0ff',
            stroke: '#0b1430', strokeThickness: 8, fontStyle: 'bold',
            padding: { x: 28, y: 28 }          // room for the glow, or it's clipped to a box
        }).setOrigin(0.5);
        const titleFill = title.context.createLinearGradient(0, 0, 0, title.height);
        titleFill.addColorStop(0.25, '#ffffff'); titleFill.addColorStop(1, '#7fa6ff');
        title.setFill(titleFill).setShadow(0, 0, '#4f7dff', 22, true, true);
        this.tweens.add({ targets: title, scale: 1.03, duration: 1800, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
        const titleRule = this.add.rectangle(W / 2, H * 0.28 + 52, 320, 2, 0x6f95ff, 0.9).setScale(0, 1);
        this.tweens.add({ targets: titleRule, scaleX: 1, duration: 700, delay: 150, ease: 'Cubic.easeOut' });

        this.add.text(W / 2, H * 0.28 + 76, 'R O G U E L I K E', {
            fontSize: '18px', fontFamily: 'monospace', color: '#8ea2d6',
            stroke: '#000000', strokeThickness: 3
        }).setOrigin(0.5);

        // Slime falls from above, fast
        this.anims.create({
            key: 'slime_boot_idle',
            frames: [
                { key: 'slime_blue', frame: 0 },
                { key: 'slime_blue', frame: 18 }
            ],
            frameRate: 8,
            repeat: -1
        });

        const slime = this.add.sprite(W / 2, -60, 'slime_blue', 0)
            .setScale(3)
            .setDepth(5);
        if (typeof CreatureFX !== 'undefined') { CreatureFX.face(this, slime, { mood: 'friend', look: 'pointer' }); CreatureFX.boopable(this, slime, 'boot'); }   // Creatures.js (a boop: a secret)
        // A pool of its own light on the ground, growing as it falls (Visuals.js' soft glow)
        if (this.textures.exists('vfx_glow')) {
            const pool = this.add.image(W / 2, H * 0.58 + 44, 'vfx_glow').setBlendMode(Phaser.BlendModes.ADD)
                .setTint(0x2ad1b0).setScale(0.4, 0.1).setAlpha(0).setDepth(4);
            this.tweens.add({ targets: pool, scaleX: 1.6, scaleY: 0.38, alpha: 0.45, duration: 380, ease: 'Power2.easeIn' });
        }

        // Squish on landing
        const landY = H * 0.58;

        this.tweens.add({
            targets: slime,
            y: landY,
            duration: 380,
            ease: 'Power2.easeIn',
            onComplete: () => {
                // Squish
                this.tweens.add({
                    targets: slime,
                    scaleX: 3.8, scaleY: 2.0,
                    duration: 80,
                    yoyo: true,
                    ease: 'Power1',
                    onComplete: () => {
                        slime.play('slime_boot_idle');
                        // Small bounce
                        this.tweens.add({
                            targets: slime,
                            y: landY - 18,
                            duration: 140,
                            yoyo: true,
                            ease: 'Power1',
                            onComplete: () => this.showLoadingBar(W, H, slime, landY)
                        });
                    }
                });
            }
        });
    }

    showLoadingBar(W, H, slime, landY) {
        // Loading bar
        const barW = 280, barH = 14;
        const barX = W / 2 - barW / 2;
        const barY = landY + 60;

        // its frame and fill are typed pieces (assets/art ui_bootbar, ui_bootfill), at 2x: the fill is one column, drawn as wide as it's filled
        this.add.nineslice(barX, barY, 'ui_bootbar', null, barW / 2, barH / 2, 1, 1, 1, 1).setOrigin(0).setScale(2);
        const barFill = this.add.image(barX + 2, barY + 2, 'ui_bootfill').setOrigin(0).setScale(0, 2);

        const loadText = this.add.text(W / 2, barY + 26, 'Loading...', {
            fontSize: '12px', fontFamily: 'monospace', color: '#5a6a8a'
        }).setOrigin(0.5);

        // Simulate loading progress then launch
        let progress = 0;
        const loadTimer = this.time.addEvent({
            delay: 20,
            repeat: 49,
            callback: () => {
                progress += 2;
                barFill.scaleX = Math.round((barW - 4) / 2 * (progress / 100)) * 2;
                if (progress >= 100) {
                    loadText.setText('Press any key to start');
                    loadText.setStyle({ color: '#cfe0ff', fontSize: '14px' });
                    this.tweens.add({ targets: loadText, alpha: 0.45, duration: 700, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
                    // Slime bobs happily
                    this.tweens.add({
                        targets: slime,
                        y: landY - 10,
                        duration: 400,
                        yoyo: true,
                        repeat: -1,
                        ease: 'Sine.easeInOut'
                    });
                    this.startWhenReady();
                }
            }
        });
    }

    startWhenReady() {
        // Wait for any key or click
        this.input.once('pointerdown', () => this.launchGame());
        this.input.keyboard.once('keydown', () => this.launchGame());
    }

    launchGame() {
        this.cameras.main.fadeOut(300, 0, 0, 0);
        this.time.delayedCall(300, () => {
            this.scene.start('LevelSelect');
        });
    }
}