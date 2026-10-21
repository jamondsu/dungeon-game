// ═══════════════════════════════════════════════════════════════════════════
// Progress.js — which levels you've cleared, and so which ones are open.
//
// The story runs in order: each level opens once the one before it is cleared, and the Tower
// opens once the story is done. A clear is recorded once, the first time (clear() says
// whether it was the first, which is what first-clear rewards key off). Stored in localStorage as cleared_<id>.
//
// Where clears are recorded: the tutorial's own flags (TutorialManager), a story level's
// final chest (LevelManager.openFinalLevelChest), the Cistern's last room
// (LevelManager._cisternRoomCheck) and tower defense's victory (TowerDefenseScene._victory).
//
// devMode (localStorage devMode = 'true', the game's existing dev switch) opens everything.
//
// Fragments (what ult stages cost, with glorps) come from here too: a level's first clear,
// and its boss (more the first time, 1 every time after).
// ═══════════════════════════════════════════════════════════════════════════

const Progress = {
    FRAGS: {
        clear: { gauntlet: 3, voidrift: 4, fracture: 5, engdefense: 5, cistern: 8 },
        boss:  { gauntlet: 2, voidrift: 2, fracture: 3, cistern: 3 },
        bossAgain: 1,
    },
    // Glorps a story level pays on its first clear, 2,300 in all. Replays pay
    // their kill drops only.
    FIRST_CLEAR_GLORPS: { gauntlet: 300, voidrift: 400, fracture: 450, engdefense: 450, cistern: 700 },

    // In story order. `level`: the GameScene levelIndex that plays it.
    ORDER: ['tutorial', 'gauntlet', 'voidrift', 'fracture', 'engdefense', 'cistern', 'tower'],
    BY_LEVEL_INDEX: { 2: 'gauntlet', 3: 'voidrift', 4: 'fracture', 5: 'cistern' },
    NAMES: { tutorial: 'the Tutorial', gauntlet: 'The Gauntlet', voidrift: 'The Void Rift', fracture: 'The Fracture',
             engdefense: 'Eng. Defense', cistern: 'The Cistern', tower: 'The Tower' },

    _get(k) { try { return localStorage.getItem(k); } catch (e) { return null; } },
    devMode() { return this._get('devMode') === 'true'; },

    cleared(id) {
        if (this._get('cleared_' + id) === '1') return true;
        // Clears from before this file existed, read off what they left behind: the tutorial
        // sets its own flag, and beating The Gauntlet / The Void Rift unlocked an element.
        if (id === 'tutorial') return this._get('iceTutorialComplete') === '1';
        if (id === 'gauntlet') return this._get('unlocked_lightning') === 'true';
        if (id === 'voidrift') return this._get('unlocked_cosmic') === 'true';
        return false;
    },

    // Record a clear. Returns true the first time, false after.
    clear(id) {
        if (!id) return false;
        const first = this._get('cleared_' + id) !== '1';
        try { localStorage.setItem('cleared_' + id, '1'); localStorage.removeItem('losses_' + id); } catch (e) {}
        return first;
    },
    // Deaths in a row on a story level (a clear resets it). The second sets a nudge the lobby shows next time you're there.
    lost(id) {
        if (!id) return;
        const n = (parseInt(this._get('losses_' + id) || '0', 10) || 0) + 1;
        try {
            if (n >= 2) { localStorage.setItem('loss_nudge', id); localStorage.removeItem('losses_' + id); }
            else localStorage.setItem('losses_' + id, String(n));
        } catch (e) {}
    },
    clearLevelIndex(levelIndex) { return this.clear(this.BY_LEVEL_INDEX[levelIndex]); },

    // ── FRAGMENTS ───────────────────────────────────────────────────────────
    fragments() { return parseInt(this._get('ultFragments') || '0', 10) || 0; },
    addFragments(n) {
        const v = this.fragments() + n;
        try { localStorage.setItem('ultFragments', String(v)); } catch (e) {}
        return v;
    },
    // A level cleared: records it, and pays its fragments and glorps the first time.
    // `scene`: the one holding totalGlorps, so its count and the saved one stay in step.
    // { first, frags, glorps }
    rewardClear(id, scene = null) {
        const first = this.clear(id), frags = first ? (this.FRAGS.clear[id] || 0) : 0;
        if (frags) this.addFragments(frags);
        const glorps = first ? (this.FIRST_CLEAR_GLORPS[id] || 0) : 0;
        if (glorps) {
            const now = (scene && scene.totalGlorps != null ? scene.totalGlorps : parseInt(this._get('glorps') || '0', 10) || 0) + glorps;
            if (scene) scene.totalGlorps = now;
            try { localStorage.setItem('glorps', String(now)); } catch (e) {}
            scene?.glorpText?.setText?.(`✦ ${now} Glorps`);
            if (scene?.player && scene.showStatusText) scene.showStatusText(scene.player.x, scene.player.y - 58, `+${glorps} ✦ FIRST CLEAR`, '#ffd34a');
        }
        return { first, frags, glorps };
    },
    // A level's boss down: more the first time, then FRAGS.bossAgain every time. { first, frags }
    rewardBoss(id) {
        const first = this._get('bossKilled_' + id) !== '1';
        try { localStorage.setItem('bossKilled_' + id, '1'); } catch (e) {}
        const frags = first ? (this.FRAGS.boss[id] || 0) : this.FRAGS.bossAgain;
        if (frags) this.addFragments(frags);
        return { first, frags };
    },
    // Tell the player, over their head, and count it toward this level's tally (the level
    // complete and death screens show it).
    announce(scene, frags) {
        if (!frags || !scene) return;
        scene._fragsThisLevel = (scene._fragsThisLevel || 0) + frags;
        if (typeof Sfx !== 'undefined') Sfx.play(scene, 'fragment');
        if (scene.player && scene.showStatusText) scene.showStatusText(scene.player.x, scene.player.y - 40, `+${frags} ◈ FRAGMENTS`, '#6cb4f0');
    },

    // Open if it's the first, the one before it is cleared, or dev mode is on.
    unlocked(id) {
        const i = this.ORDER.indexOf(id);
        if (id === 'tower') return this.devMode() || this.cleared('tutorial');   // open alongside the story, once fire and ice are learnt
        return i <= 0 || this.devMode() || this.cleared(this.ORDER[i - 1]);
    },
    // What has to be cleared to open it (for the lock message), or null if it's open.
    needs(id) {
        if (this.unlocked(id)) return null;
        return id === 'tower' ? 'tutorial' : this.ORDER[this.ORDER.indexOf(id) - 1];
    },
};
