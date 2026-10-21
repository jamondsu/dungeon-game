// ═══════════════════════════════════════════════════════════════════════════
// Achievements.js — feats: things you did, counted forever, each paying once.
//
// A feat watches one counter (`stat`) and is earned when it reaches `goal`. Counters go up
// two ways: bump() from the game as things happen (kills, Tower floors), and check(), which
// reads what the save already knows (Tower best, fish caught, weapons owned) whenever the
// lobby opens. Rewards: glorps, dust, sealed books, and a few garden seeds nothing else gives
// (Garden.SEEDS with src 'feat'). Stored as ach_stats (the counters) and ach_done (earned ids).
// Training Ground kills never count.
// ═══════════════════════════════════════════════════════════════════════════

const Achievements = {
    // tier: 1 bronze, 2 silver, 3 gold. `how` says what to do; `desc` is the line it greets you with.
    LIST: [
        { id: 'stubborn1', name: 'Resilience',      tier: 1, stat: 'resistKills', goal: 25,   reward: { glorps: 150 },            how: 'Kill 25 enemies with the element they resist.',            desc: 'You really are a stubborn one.' },
        { id: 'stubborn2', name: 'Resilience II',   tier: 2, stat: 'resistKills', goal: 150,  reward: { glorps: 400, books: 2 },  how: 'Kill 150 enemies with the element they resist.',           desc: 'Has anyone told you about the other elements?' },
        { id: 'stubborn3', name: 'Resilience III',  tier: 3, stat: 'resistKills', goal: 500,  reward: { seed: 'stubthistle' },     how: 'Kill 500 enemies with the element they resist.',           desc: 'At this point it is a personality.' },
        { id: 'kills1',    name: 'Slime Time',      tier: 1, stat: 'kills',       goal: 250,  reward: { glorps: 100 },            how: 'Kill 250 enemies.',                                        desc: 'They keep coming. So do you.' },
        { id: 'kills2',    name: 'Slime Season',    tier: 2, stat: 'kills',       goal: 2500, reward: { glorps: 500, dust: 150 }, how: 'Kill 2,500 enemies.',                                      desc: 'The dungeon is starting to talk about you.' },
        { id: 'kills3',    name: 'Slime Extinction', tier: 3, stat: 'kills',      goal: 15000, reward: { glorps: 2000, books: 5 }, how: 'Kill 15,000 enemies.',                                    desc: 'Somewhere, a slime mother weeps.' },
        { id: 'fire',      name: 'Pyromaniac',      tier: 1, stat: 'kills_fire',  goal: 400,  reward: { glorps: 150 },            how: 'Kill 400 enemies with fire.',                              desc: 'It is not a problem if you enjoy it.' },
        { id: 'ice',       name: 'Cold Shoulder',   tier: 1, stat: 'kills_ice',   goal: 400,  reward: { glorps: 150 },            how: 'Kill 400 enemies with ice.',                               desc: 'Chill. No, really.' },
        { id: 'lightning', name: 'Live Wire',       tier: 1, stat: 'kills_lightning', goal: 400, reward: { glorps: 150 },         how: 'Kill 400 enemies with lightning.',                         desc: 'Your hair has never recovered.' },
        { id: 'cosmic',    name: 'Starstruck',      tier: 1, stat: 'kills_cosmic', goal: 400, reward: { glorps: 150 },            how: 'Kill 400 enemies with cosmic.',                            desc: 'The void says hi back.' },
        { id: 'climb1',    name: 'First Steps',     tier: 1, stat: 'towerBest',   goal: 10,   reward: { glorps: 200 },            how: 'Reach floor 10 of the Tower.',                             desc: 'The stairs only get worse from here.' },
        { id: 'climb2',    name: 'Halfway Up',      tier: 2, stat: 'towerBest',   goal: 25,   reward: { glorps: 600, dust: 200 }, how: 'Reach floor 25 of the Tower.',                             desc: 'Your legs have filed a complaint.' },
        { id: 'climb3',    name: 'Summit',          tier: 3, stat: 'towerBest',   goal: 50,   reward: { seed: 'summitbloom', glorps: 1500 }, how: 'Reach floor 50 of the Tower.',                  desc: 'Thin air, good view, nobody to share it with.' },
        { id: 'flawless',  name: 'Untouchable',     tier: 2, stat: 'flawless',    goal: 1,    reward: { glorps: 300 },            how: 'Clear a Tower floor from 10 up without taking a hit.',     desc: 'Did they even know you were there?' },
        { id: 'kingslayer', name: 'Kingslayer',     tier: 2, stat: 'towerBosses', goal: 5,    reward: { glorps: 500, books: 3 },  how: 'Beat 5 Tower bosses.',                                     desc: 'Crowns are heavier than they look.' },
        { id: 'bloom',     name: 'Wrong Kind of Gardener', tier: 1, stat: 'budFull', goal: 1, reward: { dust: 100 },              how: 'Let a Budding Slime grow a family of 8.',                  desc: 'You could have hit it. At any point.' },
        { id: 'angler',    name: 'Patient Angler',  tier: 1, stat: 'fish',        goal: 50,   reward: { dust: 200 },              how: 'Catch 50 fish.',                                           desc: 'The fish have started a support group.' },
        { id: 'collector', name: 'Armoury',         tier: 2, stat: 'weapons',     goal: 15,   reward: { glorps: 800 },            how: 'Own every weapon.',                                        desc: 'You can only hold four. You know that, right?' },
    ],

    _read(k, d) { try { return JSON.parse(localStorage.getItem(k)) ?? d; } catch (e) { return d; } },
    _write(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} },
    stats() { return this._read('ach_stats', {}); },
    done() { return new Set(this._read('ach_done', [])); },
    def(id) { return this.LIST.find(a => a.id === id); },

    // add n to a counter (or raise it to n, with max) and pay out whatever it finishes
    bump(stat, n = 1, scene = null, max = false) {
        const s = this.stats(), was = s[stat] || 0;
        s[stat] = max ? Math.max(was, n) : was + n;
        if (s[stat] === was) return;
        this._write('ach_stats', s);
        const done = this.done();
        for (const a of this.LIST) if (a.stat === stat && !done.has(a.id) && s[stat] >= a.goal) this._earn(a, scene);
    },
    // what the save already knows (the lobby calls this as it opens)
    check(scene = null) {
        const own = (() => { try { return JSON.parse(localStorage.getItem('unlockedWeapons') || '[]'); } catch (e) { return []; } })();
        const free = typeof ShopScene !== 'undefined' ? ShopScene.CATALOGUE.filter(w => w.defaultWeapon || own.includes(w.id)).length : 0;
        this.bump('weapons', free, scene, true);
        this.bump('towerBest', parseInt(localStorage.getItem('tower_best') || '0', 10) || 0, scene, true);
        if (typeof Garden !== 'undefined') this.bump('fish', Object.values(Garden.state().fishLog || {}).reduce((a, n) => a + n, 0), scene, true);
    },

    // From killEnemy. The last hit's element (CombatSystem.damageEnemy notes it) decides the rest.
    onKill(scene, e) {
        if (!e || scene.trainingRun || e._trainImmortal || e._isDummy || scene.scene?.key !== 'Game') return;
        this.bump('kills', 1, scene);
        if (e._lastEl) this.bump('kills_' + e._lastEl, 1, scene);
        if (e._lastResisted) this.bump('resistKills', 1, scene);
    },
    // From the Tower's floor clear: the best floor, a boss, a floor from 10 up without a scratch
    onFloor(scene, T) {
        this.bump('towerBest', T.floor, scene, true);
        if (T.boss) this.bump('towerBosses', 1, scene);
        if (T.floor >= 10 && !(scene._hurtTotal > 0)) this.bump('flawless', 1, scene);
    },

    _earn(a, scene) {
        const done = this.done(); done.add(a.id); this._write('ach_done', [...done]);
        const R = a.reward || {};
        scene ||= typeof game !== 'undefined' ? game.scene.getScenes(true).slice(-1)[0] : null;
        if (R.glorps) {
            try { localStorage.setItem('glorps', String((parseInt(localStorage.getItem('glorps') || '0', 10) || 0) + R.glorps)); } catch (e) {}
            if (typeof scene?.totalGlorps === 'number') scene.totalGlorps += R.glorps;   // scenes that keep their own purse and save it back
            if (typeof scene?.glorps === 'number') scene.glorps += R.glorps;
        }
        if (R.dust && typeof Enchants !== 'undefined') Enchants.addDust(R.dust);
        if (R.books && typeof Enchants !== 'undefined') Enchants.addBooks(R.books);
        if (R.seed && typeof Garden !== 'undefined') Garden.give(R.seed);
        scene?._achThisLevel?.push(a);   // the win screen's cards
        if (scene?.add) this.toast(scene, a);
    },
    rewardText(a) {
        const R = a.reward || {}, out = [];
        if (R.glorps) out.push(`✦ ${R.glorps.toLocaleString('en-US')} glorps`);
        if (R.dust) out.push(`✧ ${R.dust} dust`);
        if (R.books) out.push(`▤ ${R.books} sealed book${R.books > 1 ? 's' : ''}`);
        if (R.seed) out.push(`✿ ${typeof Garden !== 'undefined' ? Garden.seed(R.seed)?.name : 'a seed'} (only from this)`);
        return out.join('   ');
    },
    TIER_COL: [null, 0xc08a5a, 0xc8d4e0, 0xffd84a],

    // the card that slides down when one's earned; several queue up rather than stack
    toast(scene, a) {
        const q = this._queue ||= [];
        q.push([scene, a]);
        if (q.length === 1) this._next();
    },
    _next() {
        const [scene, a] = this._queue[0] || [];
        if (!a) return;
        const end = () => { this._queue.shift(); this._next(); };
        if (!scene?.sys?.isActive?.()) return end();
        const W = scene.scale.width, w = 440, h = 78, D = 60, col = this.TIER_COL[a.tier];
        const c = scene.add.container(W / 2, -h).setScrollFactor(0).setDepth(D);
        const bg = scene.add.graphics();
        bg.fillStyle(0x0b0812, 0.94).fillRoundedRect(-w / 2, 0, w, h, 8);
        bg.lineStyle(2, col, 1).strokeRoundedRect(-w / 2, 0, w, h, 8);
        bg.fillStyle(col, 1).fillCircle(-w / 2 + 38, h / 2, 20);
        bg.fillStyle(0x0b0812, 1).fillCircle(-w / 2 + 38, h / 2, 15);
        const star = scene.add.text(-w / 2 + 38, h / 2, '★', { fontSize: '20px', color: UIKit._hex(col) }).setOrigin(0.5);
        const t1 = scene.add.text(-w / 2 + 70, 10, `ACHIEVEMENT  ·  ${a.name.toUpperCase()}`, { fontSize: '15px', fontFamily: UIKit.FONT.title, fontStyle: 'bold', color: UIKit._hex(col) });
        const t2 = scene.add.text(-w / 2 + 70, 32, a.desc, { fontSize: '12px', fontFamily: 'monospace', color: '#e8dcc0' });
        const t3 = scene.add.text(-w / 2 + 70, 52, this.rewardText(a), { fontSize: '11px', fontFamily: 'monospace', color: '#9be08a' });
        c.add([bg, star, t1, t2, t3]);
        if (typeof Sfx !== 'undefined') Sfx.play(scene, 'fanfare');
        scene.tweens.add({ targets: c, y: 16, duration: 380, ease: 'Back.easeOut' });
        scene.tweens.add({ targets: c, y: -h - 10, delay: 3600, duration: 320, ease: 'Quad.easeIn', onComplete: () => { c.destroy(); end(); } });
    },
};
