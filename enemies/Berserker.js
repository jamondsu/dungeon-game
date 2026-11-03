// ═══════════════════════════════════════════════════════════════════════════
// Berserker.js — the Berserker: made, and its swing.
// GameScene borrows each method, so `this` in them is the scene.
// ═══════════════════════════════════════════════════════════════════════════

class Berserker {

    createBerserker(x, y, tutorialRoomIndex) {
        const enemy = this.createEnemy(x, y, 180);
        enemy.tutorialRoomIndex = tutorialRoomIndex;
        enemy.isBerserker        = true;
        enemy._berserkerState    = 'idle';
        enemy._berserkerLastSwing  = 0;
        enemy._berserkerCooldown   = 3200;
        enemy._berserkerChargeDur  = 600;
        enemy._berserkerChargeStart = 0;
        SlimeModels.wear(this, enemy.sprite, 'berserker');   // its own body: a horned bull

        // Red ! mark — hidden until charging
        const markGfx = this.add.graphics().setDepth(3.5).setAlpha(0);
        markGfx.fillStyle(0xff2200, 1.0);
        markGfx.fillRect(-3, -12, 6, 9);
        markGfx.fillRect(-3,  -1, 6, 6);
        markGfx.lineStyle(1, 0xff8888, 0.80);
        markGfx.strokeRect(-3, -12, 6, 9);
        markGfx.strokeRect(-3,  -1, 6, 6);
        markGfx.x = enemy.sprite.x;
        markGfx.y = enemy.sprite.y - 26;
        enemy._berserkerMark = markGfx;
        return enemy;
    }

    _berserkerSwing(enemy) {
        Sfx.play(this, 'swing');
        const ex = enemy.sprite.x, ey = enemy.sprite.y;
        const facingAngle = Math.atan2(this.player.y - ey, this.player.x - ex);
        const halfSpread  = Math.PI * (60 / 180); // ±60° = 120° arc
        const RANGE       = 2.2 * this.TILE_SIZE;
        const SWING_DMG   = 18 * this.damageScaling;
        const SWING_DUR   = 220;

        // the swing: its own frames (horns back, then through), streaks of its gore along the arc (EnemyFX)
        const startAngle = facingAngle + halfSpread;
        const endAngle   = facingAngle - halfSpread;
        enemy.sprite._atkTw?.stop();   // (its charge frames give way)
        EnemyManager.playAtk(this, enemy.sprite, SWING_DUR + 120, this.player.x < ex, 'swing_');
        EnemyFX.cleave(this, ex, ey, startAngle, endAngle, RANGE, SWING_DUR);

        // Hit check — sample tiles in arc
        const hitTiles = new Set();
        for (let r = 0.8; r <= 2.2; r += 0.5) {
            for (let a = -halfSpread; a <= halfSpread; a += Math.PI / 8) {
                const wx = ex + Math.cos(facingAngle + a) * r * this.TILE_SIZE;
                const wy = ey + Math.sin(facingAngle + a) * r * this.TILE_SIZE;
                hitTiles.add(`${Math.round(wx / this.TILE_SIZE)},${Math.round(wy / this.TILE_SIZE)}`);
            }
        }
        CombatSystem.tauntBoth(this, () => {   // (the ally it swung at, and you if you're in it)
        const playerKey = `${Math.round(this.player.x / this.TILE_SIZE)},${Math.round(this.player.y / this.TILE_SIZE)}`;
        if (hitTiles.has(playerKey)) {
            this._hitBy = enemy; this._hitMelee = true; this.takeDamage(SWING_DMG); this._hitBy = null; this._hitMelee = false;
            this.cameras.main.shake(60, 0.006);
            // Knockback 1 tile away
            const kbDX = Math.sign(this.playerX - enemy.x);
            const kbDY = Math.sign(this.playerY - enemy.y);
            const nx = this.playerX + kbDX, ny = this.playerY + kbDY;
            if (this.world[nx]?.[ny] === this.FLOOR && (this._iceShellUntil || 0) <= this.time.now) {   // (not through the ice ult's shell)
                this.playerX = nx; this.playerY = ny;
                this.player.x = nx * this.TILE_SIZE + this.TILE_SIZE / 2;
                this.player.y = ny * this.TILE_SIZE + this.TILE_SIZE / 2 + this.SLIME_Y_OFFSET;
            }
        }
        });
        this.cameras.main.shake(35, 0.003);
    }

}
