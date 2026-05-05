class DebugScene extends Phaser.Scene {
    preload() {
        this.load.spritesheet('tiles', 'assets/roguelikeDungeon_transparent.png', {
            frameWidth: 17,
            frameHeight: 17
        });
    }
    
    create() {
        for (let i = 0; i < 200; i++) {
            const x = 30 + (i % 15) * 36;
            const y = 30 + Math.floor(i / 15) * 36;
            this.add.sprite(x, y, 'tiles', i).setScale(2);
            this.add.text(x - 12, y + 18, i.toString(), { fontSize: '10px', color: '#fff' });
        }
    }
}

const config = {
    type: Phaser.AUTO,
    width: 800,
    height: 800,
    scene: DebugScene,
    pixelArt: true,
    backgroundColor: '#000000'
};

const game = new Phaser.Game(config);