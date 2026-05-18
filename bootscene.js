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
    }

    create() {
        const W = this.scale.width;
        const H = this.scale.height;

        this.add.rectangle(0, 0, W, H, 0x050a10).setOrigin(0);

        // Title text
        this.add.text(W / 2, H * 0.28, 'DUNGEON', {
            fontSize: '42px', fontFamily: 'monospace', color: '#aaccff',
            stroke: '#000000', strokeThickness: 6, fontStyle: 'bold'
        }).setOrigin(0.5);

        this.add.text(W / 2, H * 0.28 + 50, 'ROGUELIKE', {
            fontSize: '22px', fontFamily: 'monospace', color: '#445566',
            stroke: '#000000', strokeThickness: 4
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

        this.add.rectangle(barX, barY, barW, barH, 0x111122).setOrigin(0);
        const barBorder = this.add.rectangle(barX, barY, barW, barH).setOrigin(0);
        barBorder.setStrokeStyle(2, 0x2244aa, 0.8);
        const barFill = this.add.rectangle(barX, barY, 0, barH, 0x3366cc).setOrigin(0);

        const loadText = this.add.text(W / 2, barY + 24, 'Loading...', {
            fontSize: '12px', fontFamily: 'monospace', color: '#334455'
        }).setOrigin(0.5);

        // Simulate loading progress then launch
        let progress = 0;
        const loadTimer = this.time.addEvent({
            delay: 20,
            repeat: 49,
            callback: () => {
                progress += 2;
                barFill.width = barW * (progress / 100);
                if (progress >= 100) {
                    loadText.setText('Press any key to start');
                    loadText.setStyle({ color: '#aaccff' });
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