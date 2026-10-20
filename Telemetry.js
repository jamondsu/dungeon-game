// ═══════════════════════════════════════════════════════════════════════════
// Telemetry.js — a record of every run.
//
// One record per level attempt: the level, the loadout and gear, then per room the time in it,
// the damage taken there and any deaths; the boss fight's length; ults cast; damage and combat
// time per element (GameScene._runStats); glorps and fragments earned; and how it ended
// ('clear', 'death', 'quit'). Kept in localStorage ('telemetry', the last MAX runs). The
// lobby's settings panel exports them as a JSON file.
//
// GameScene calls begin (create), room (each frame, via HUD._tickRunStats), hurt (takeDamage),
// ult (activateUlt), boss (HUD._updateMusic), death (gameOver) and end (the clear, the death
// screen, or the scene shutting down). Nothing here touches Phaser when the file loads.
// ═══════════════════════════════════════════════════════════════════════════

const Telemetry = {
    KEY: 'telemetry', MAX: 300,

    _load() { try { return JSON.parse(localStorage.getItem(this.KEY) || '[]') || []; } catch (e) { return []; } },
    _save(list) { try { localStorage.setItem(this.KEY, JSON.stringify(list.slice(-this.MAX))); } catch (e) {} },
    all() { return this._load(); },
    clear() { try { localStorage.removeItem(this.KEY); } catch (e) {} },

    begin(scene) {
        const lvl = id => { try { return parseInt(localStorage.getItem(id) || '0', 10) || 0; } catch (e) { return 0; } };
        scene._tele = {
            v: 1, src: 'player',
            level: scene.currentLevelIndex ?? 0, tutorialStage: scene.tutorialStage ?? 0, floor: scene.towerRun?.floor ?? null,
            loadout: { ...(scene.equippedWeapons || {}) },
            gear: { might: lvl('stat_damage'), vigor: lvl('stat_health'), ironhide: lvl('stat_armor'),
                    power: Object.fromEntries(Object.values(scene.equippedWeapons || {}).map(w => [w, lvl('wlv_' + w)])) },
            startedAt: Date.now(), t0: scene.time.now, room: null, rooms: {}, deaths: [], ults: {}, boss: null,
            glorps0: lvl('glorps'), result: null,
        };
    },
    _roomRec(T, r) { return T.rooms[r] || (T.rooms[r] = { ms: 0, dmg: 0, deaths: 0, enteredAt: null }); },
    // Each frame: which room you're in, and the time spent there.
    room(scene, r, delta) {
        const T = scene._tele;
        if (!T || T.result || r < 0) return;
        if (r !== T.room) { T.room = r; const R = this._roomRec(T, r); if (R.enteredAt == null) R.enteredAt = Math.round(scene.time.now - T.t0); }
        this._roomRec(T, r).ms += delta || 0;
    },
    hurt(scene, amount) {
        const T = scene._tele;
        if (T && !T.result && T.room != null) this._roomRec(T, T.room).dmg += amount;
    },
    ult(scene, el) { const T = scene._tele; if (T && !T.result) T.ults[el] = (T.ults[el] || 0) + 1; },
    // The boss fight: from when its music starts to when it stops (or the run ends).
    boss(scene, on) {
        const T = scene._tele;
        if (!T || T.result) return;
        if (on && !T.boss) T.boss = { startMs: Math.round(scene.time.now - T.t0), ms: null };
        else if (!on && T.boss && T.boss.ms == null) T.boss.ms = Math.round(scene.time.now - T.t0) - T.boss.startMs;
    },
    death(scene) {
        const T = scene._tele;
        if (!T || T.result) return;
        T.deaths.push(T.room);
        if (T.room != null) this._roomRec(T, T.room).deaths++;
    },
    end(scene, result) {
        const T = scene._tele;
        if (!T || T.result) return;
        T.result = result;
        T.ms = Math.round(scene.time.now - T.t0);
        if (T.boss && T.boss.ms == null) T.boss.ms = T.ms - T.boss.startMs;
        const R = scene._runStats || {};
        T.kills = R.kills || 0;
        T.dmgByEl = Object.fromEntries(Object.entries(R.dmg || {}).map(([k, v]) => [k, Math.round(v)]));
        T.timeByEl = Object.fromEntries(Object.entries(R.elTime || {}).map(([k, v]) => [k, Math.round(v)]));
        T.glorps = Math.max(0, (scene.totalGlorps || 0) - T.glorps0);
        T.frags = scene._fragsThisLevel || 0;
        for (const r of Object.values(T.rooms)) { r.ms = Math.round(r.ms); r.dmg = Math.round(r.dmg); }
        delete T.t0; delete T.room;
        const list = this._load(); list.push(T); this._save(list);
    },
    // The records as a downloaded JSON file (the settings panel's EXPORT).
    exportFile() {
        const blob = new Blob([JSON.stringify(this._load(), null, 1)], { type: 'application/json' });
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = `slime-dungeon-play-${new Date().toISOString().slice(0, 10)}.json`;
        a.click();
        setTimeout(() => URL.revokeObjectURL(a.href), 1000);
    },
};
