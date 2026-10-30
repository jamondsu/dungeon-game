// ═══════════════════════════════════════════════════════════════════════════
// Telemetry.js — a record of every run.
//
// One record per level attempt: the level, the loadout and gear, then per room the time in it,
// the damage taken there and any deaths; the boss fight's length; ults cast; damage and combat
// time per element (GameScene._runStats); glorps and fragments earned; and how it ended
// ('clear', 'death', 'quit'). v2 adds: the damage taken per source (dmgBySource: an enemy's
// codex key, or a named hazard or boss move; 'other' when the hit didn't say), each death's
// killer, room, tile, second and HP before the blow, the time each weapon was held (wpnMs) and
// how often you switched (swaps), and a one-line summary. Kept in localStorage ('telemetry',
// the last MAX runs). The lobby's settings panel exports them as a JSON file.
//
// GameScene calls begin (create), room (each frame, via HUD._tickRunStats), hurt (takeDamage: its src, or _hitBy),
// ult (activateUlt), boss (HUD._updateMusic), death (gameOver) and end (the clear, the death
// screen, or the scene shutting down). Nothing here touches Phaser when the file loads. Bounties (Bounties.js) listens on the
// same calls (bounty() below): what it counts is the run this records, so the Training Ground, unrecorded, never counts.
// ═══════════════════════════════════════════════════════════════════════════

const Telemetry = {
    KEY: 'telemetry', MAX: 300,

    _load() { try { return JSON.parse(localStorage.getItem(this.KEY) || '[]') || []; } catch (e) { return []; } },
    _save(list) { for (let n = this.MAX; n >= 1; n >>= 1) try { localStorage.setItem(this.KEY, JSON.stringify(list.slice(-n))); return; } catch (e) {} },   // storage full: keep the newest that fit
    all() { return this._load(); },
    clear() { try { localStorage.removeItem(this.KEY); } catch (e) {} },

    bounty(fn, ...a) { if (typeof Bounties !== 'undefined') Bounties[fn](...a); },
    begin(scene) {
        const lvl = id => { try { return parseInt(localStorage.getItem(id) || '0', 10) || 0; } catch (e) { return 0; } };
        scene._tele = {
            v: 2, src: 'player', summary: '',   // (filled in at the end; first, for a skim of the JSON)
            level: scene.currentLevelIndex ?? 0, tutorialStage: scene.tutorialStage ?? 0, floor: scene.towerRun?.floor ?? null,
            loadout: { ...(scene.equippedWeapons || {}) },
            gear: { might: lvl('stat_damage'), vigor: lvl('stat_health'), ironhide: lvl('stat_armor'),
                    power: Object.fromEntries(Object.values(scene.equippedWeapons || {}).map(w => [w, lvl('wlv_' + w)])) },
            startedAt: Date.now(), t0: scene.time.now, room: null, rooms: {}, deaths: [], ults: {}, boss: null,
            dmgBySource: {}, wpnMs: {}, swaps: 0, wpn: null, last: null,
            glorps0: lvl('glorps'), result: null,
        };
        this.bounty('begin', scene);
    },
    _roomRec(T, r) { return T.rooms[r] || (T.rooms[r] = { ms: 0, dmg: 0, deaths: 0, enteredAt: null }); },
    // Each frame: which room you're in, and the time spent there; the weapon in hand, and the time held.
    room(scene, r, delta) {
        const T = scene._tele;
        if (!T || T.result) return;
        this.bounty('tick', scene, r);
        const w = scene.equippedWeapons?.[scene.currentElement];
        if (w) { if (w !== T.wpn) { if (T.wpn) T.swaps++; T.wpn = w; } T.wpnMs[w] = (T.wpnMs[w] || 0) + (delta || 0); }
        if (r < 0) return;
        if (r !== T.room) { T.room = r; const R = this._roomRec(T, r); if (R.enteredAt == null) R.enteredAt = Math.round(scene.time.now - T.t0); }
        this._roomRec(T, r).ms += delta || 0;
    },
    // src: a name, or the enemy that hit you (its codex key)
    hurt(scene, amount, src) {
        const T = scene._tele;
        if (!T || T.result) return;
        const k = typeof src === 'string' ? src : (src && scene._enemyTypeKey?.(src)) || 'other';
        T.dmgBySource[k] = (T.dmgBySource[k] || 0) + amount;
        this.bounty('hurt', scene, amount, k);
        T.last = { killer: k, hp: Math.round((scene.health + amount) * 10) / 10 };   // HP before this hit
        if (T.room != null) this._roomRec(T, T.room).dmg += amount;
    },
    ult(scene, el) { const T = scene._tele; if (T && !T.result) { T.ults[el] = (T.ults[el] || 0) + 1; this.bounty('ult', scene); } },
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
        T.deaths.push({ room: T.room, tile: [scene.playerX, scene.playerY], s: Math.round((scene.time.now - T.t0) / 1000), killer: T.last?.killer || 'other', hp: T.last?.hp ?? null });
        if (T.room != null) this._roomRec(T, T.room).deaths++;
    },
    end(scene, result) {
        const T = scene._tele;
        if (!T || T.result) return;
        T.result = result;
        this.bounty('end', scene, result);
        T.ms = Math.round(scene.time.now - T.t0);
        if (T.boss && T.boss.ms == null) T.boss.ms = T.ms - T.boss.startMs;
        const R = scene._runStats || {};
        T.kills = R.kills || 0;
        T.dmgByEl = Object.fromEntries(Object.entries(R.dmg || {}).map(([k, v]) => [k, Math.round(v)]));
        T.timeByEl = Object.fromEntries(Object.entries(R.elTime || {}).map(([k, v]) => [k, Math.round(v)]));
        T.glorps = Math.max(0, (scene.totalGlorps || 0) - T.glorps0);
        T.frags = scene._fragsThisLevel || 0;
        for (const r of Object.values(T.rooms)) { r.ms = Math.round(r.ms); r.dmg = Math.round(r.dmg); }
        for (const o of [T.dmgBySource, T.wpnMs]) for (const k in o) o[k] = Math.round(o[k]);
        const top = Object.entries(T.dmgBySource).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([k, v]) => `${k} ${v}`).join(', ');
        const name = (typeof Progress !== 'undefined' && Progress.BY_LEVEL_INDEX?.[T.level]) || 'level ' + T.level, sec = Math.round(T.ms / 1000);
        T.summary = `${name}${T.floor != null ? ' floor ' + T.floor : ''}: ${result} in ${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')}`
            + (T.deaths.length ? `; killed by ${T.deaths.map(d => `${d.killer} (room ${d.room ?? '-'}, at ${d.hp} HP)`).join(', ')}` : '')
            + (top ? `; hurt most by ${top}` : '; unhurt');
        delete T.t0; delete T.room; delete T.wpn; delete T.last;
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
