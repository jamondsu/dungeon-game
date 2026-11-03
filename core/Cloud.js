// ═══════════════════════════════════════════════════════════════════════════
// Cloud.js — your account (Supabase): your save kept online, and the leaderboards.
//
// None of it is needed to play: without an account the game saves in this browser as it always has. Signed in (an email, a
// password, and a name for the leaderboards), your save (everything the game keeps in this browser) goes up a few seconds after
// it changes and comes down on any device you sign in on; your best times go up to the leaderboards. Its window (the account,
// the leaderboards, which save to keep) is plain HTML over the game, so typing in it never reaches the game's keys.
// ═══════════════════════════════════════════════════════════════════════════
const Cloud = {
    URL: 'https://disihvpedyyrhyzmipvp.supabase.co',
    KEY: 'sb_publishable_j8jaH_aUgnM7sFHW-P_brg_oRuN37wz',   // (public by design: the database's own rules decide what it may touch)
    // the leaderboards: the Hall's fastest way out (time: lower is better), and the rhythm run's points, one board per song (or its
    // own beat) and difficulty
    boards() { return ['hall_time', ...['beat', ...Object.keys(RhythmTrial.SONGS)].flatMap(s => Object.keys(RhythmTrial.DIFF).map(d => `rhythm_${s}_${d}`))]; },
    info(b) {
        if (b === 'hall_time') return { title: 'THE HALL OF REFLECTIONS', what: 'fastest way out', time: true };
        const [, song, diff = ''] = b.match(/^rhythm_(.+)_([a-z]+)$/) || [], S = RhythmTrial.SONGS[song];
        return { title: `RHYTHM RUN · ${S ? S.title.toUpperCase() : 'ITS OWN BEAT'} · ${diff.toUpperCase()}`, what: 'most points' };
    },
    SKIP: ['telemetry', 'devMode', 'cloud_sync'],   // what stays on this device (and the account's own keys, sb-...)
    db: null, user: null, name: null, dirtyAt: 0, timer: null, pushing: false, applying: false, el: null, view: null,

    init() {
        if (this.db || typeof supabase === 'undefined') return;   // (the library didn't load, say offline: everything stays in this browser)
        this.db = supabase.createClient(this.URL, this.KEY);
        // any change to the save: up a few seconds after the last one (at most half a minute after the first)
        const self = this, set = Storage.prototype.setItem, rm = Storage.prototype.removeItem;
        Storage.prototype.setItem = function (k, v) { set.call(this, k, v); if (this === localStorage) self._changed(k); };
        Storage.prototype.removeItem = function (k) { rm.call(this, k); if (this === localStorage) self._changed(k); };
        addEventListener('pagehide', () => this.push());
        document.addEventListener('visibilitychange', () => { if (document.hidden) this.push(); });
        this.db.auth.onAuthStateChange((ev, s) => setTimeout(() => this._session(s?.user || null), 0));   // (not inside its callback: it would wait on itself)
    },
    _mine(k) { return !k.startsWith('sb-') && !this.SKIP.includes(k); },
    _snapshot() { const d = {}; for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); if (this._mine(k)) d[k] = localStorage.getItem(k); } return d; },
    _same(a, b) { const ka = Object.keys(a).sort(), kb = Object.keys(b).sort(); return ka.length === kb.length && ka.every((k, i) => k === kb[i] && a[k] === b[k]); },
    _mark(at) { Storage.prototype.setItem.call(localStorage, 'cloud_sync', JSON.stringify({ user: this.user?.id, at })); this.lastAt = at; this._render(); },
    _changed(k) {
        if (!this.user || this.applying || !this._mine(k)) return;
        if (!this.dirtyAt) this.dirtyAt = Date.now();
        clearTimeout(this.timer);
        this.timer = setTimeout(() => this.push(), Date.now() - this.dirtyAt > 30000 ? 0 : 4000);
    },
    // your save, up
    async push() {
        if (!this.user || !this.dirtyAt || this.pushing) return;
        this.pushing = true; this.dirtyAt = 0;
        const at = new Date().toISOString(), { error } = await this.db.from('saves').upsert({ user_id: this.user.id, data: this._snapshot(), updated_at: at });
        this.pushing = false;
        if (error) { this.dirtyAt = Date.now(); clearTimeout(this.timer); this.timer = setTimeout(() => this.push(), 30000); return; }   // (try again in a while)
        this._mark(at);
    },
    // signed in (or out): your name, then which save to keep
    async _session(user) {
        if ((user?.id || null) === (this.user?.id || null)) return;
        this.user = user; this.name = null;
        if (!user) return this._render();
        const { data: p } = await this.db.from('profiles').select('name').eq('user_id', user.id).maybeSingle();
        this.name = p?.name || null;
        if (!this.name && user.user_metadata?.name) await this.setName(user.user_metadata.name);   // (the name given when the account was made)
        this._render();
        const { data: row, error } = await this.db.from('saves').select('data, updated_at').eq('user_id', user.id).maybeSingle();
        if (error) return;
        const here = this._snapshot(), sync = JSON.parse(localStorage.getItem('cloud_sync') || 'null');
        if (!row) { this.dirtyAt = Date.now(); return this.push(); }   // (nothing online yet: this device's goes up)
        if (this._same(row.data, here)) return this._mark(row.updated_at);
        if (sync?.user === user.id && sync.at >= row.updated_at) { this.dirtyAt = Date.now(); return this.push(); }   // (this device saved it last: it's the newer)
        this.pending = row; this.open('choose');
    },
    // the online save, here: this device's replaced, and the game started over on it
    _apply(row) {
        this.applying = true;
        for (const k of Object.keys(localStorage)) if (this._mine(k)) localStorage.removeItem(k);
        for (const [k, v] of Object.entries(row.data)) localStorage.setItem(k, v);
        this._mark(row.updated_at);
        location.reload();
    },
    async setName(name) {
        const { error } = await this.db.from('profiles').upsert({ user_id: this.user.id, name: name.trim() });
        if (error) return error.code === '23505' ? 'That name is taken.' : 'Names are 2 to 16 letters, numbers, spaces, _ . or -.';
        this.name = name.trim(); return null;
    },
    // the leaderboards: post one (signed in, named); each player's best on a board; where yours puts you
    async post(board, value) {
        if (typeof Progress !== 'undefined' && Progress.devMode()) return { why: 'dev' };   // (dev mode's god mode, one-shots and floor skips: not for the boards)
        if (!this.db || !this.user) return { why: 'out' };
        if (!this.name) return { why: 'name' };
        const { error } = await this.db.from('scores').insert({ board, value });
        return error ? { why: 'error' } : (await this.rank(board)) || { why: 'error' };
    },
    async rank(board) {
        const B = this.info(board), { data: me } = await this.db.from('leaderboard').select('value').eq('board', board).eq('user_id', this.user.id).maybeSingle();
        if (!me) return null;
        const { count } = await this.db.from('leaderboard').select('*', { count: 'exact', head: true }).eq('board', board)[B.time ? 'lt' : 'gt']('value', me.value);
        return { best: +me.value, rank: (count || 0) + 1 };
    },
    async top(board, n = 20) {
        const { data } = await this.db.from('leaderboard').select('user_id, name, value').eq('board', board).order('value', { ascending: !!this.info(board).time }).limit(n);
        return data || [];
    },
    show(board, v) { return this.info(board).time ? `${Math.floor(v / 60)}:${(v % 60).toFixed(1).padStart(4, '0')}` : Math.round(v).toLocaleString('en-US'); },

    // ── its window ───────────────────────────────────────────────────────────
    open(view = 'account', board = 'hall_time') {
        if (!this.el) {
            const st = document.createElement('style');
            st.textContent = `#cloud{position:fixed;inset:0;display:flex;align-items:center;justify-content:center;background:rgba(5,3,10,.72);z-index:10;font:15px Georgia,"Palatino Linotype",serif;color:#e8dcc0}
#cloud .p{background:#17120e;border:2px solid #6b5434;box-shadow:0 0 0 4px #0d0a07;padding:22px 26px;width:min(440px,calc(100vw - 32px));max-height:calc(100vh - 32px);overflow:auto;box-sizing:border-box}
#cloud h2{margin:0 0 6px;font-size:22px;letter-spacing:1px;color:#ffd36a}#cloud p{margin:6px 0 12px;line-height:1.4;color:#c8b896}#cloud small{color:#9c8a6a}
#cloud label{display:block;margin:10px 0 4px;font-size:13px;color:#d2bf98}#cloud input{width:100%;box-sizing:border-box;padding:8px;background:#0d0a07;border:1px solid #6b5434;color:#f0ece0;font:15px Georgia,serif}
#cloud select{width:100%;margin:6px 0 2px;padding:7px;background:#0d0a07;border:1px solid #6b5434;color:#ffd36a;font:bold 13px Georgia,serif}
#cloud button{margin:12px 8px 0 0;padding:8px 14px;background:#2a2016;border:1px solid #9c7f52;color:#f0e2bc;font:bold 13px Georgia,serif;letter-spacing:1px;cursor:pointer}#cloud button:hover{background:#3a2c1c}
#cloud button.on{background:#6b5434;color:#fff}#cloud .msg{min-height:18px;margin-top:10px;color:#ff9ab8}#cloud ol{margin:8px 0;padding:0;list-style:none}
#cloud li{display:flex;gap:10px;padding:4px 6px;border-bottom:1px solid #2a2016}#cloud li b{width:28px;color:#9c8a6a}#cloud li span{flex:1}#cloud li.me{background:#2a2016;color:#ffd36a}`;
            document.head.appendChild(st);
            this.el = document.createElement('div'); this.el.id = 'cloud';
            this.el.addEventListener('keydown', e => { e.stopPropagation(); if (e.key === 'Escape' && this.view !== 'choose') this.close(); });   // (its keys are its own, not the game's)
            this.el.addEventListener('keyup', e => e.stopPropagation());
            this.el.addEventListener('pointerdown', e => { if (e.target === this.el && this.view !== 'choose') this.close(); });
        }
        this.view = view; this.board = board; this.tab ||= 'in';
        if (!this.el.isConnected) document.body.appendChild(this.el);
        this._render();
    },
    close() { this.el?.remove(); this.view = null; },
    _render() {
        if (!this.el?.isConnected) return;
        const h = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]), p = document.createElement('div');
        p.className = 'p';
        const wire = () => { this.el.replaceChildren(p); const i = p.querySelector('input'); if (i) i.focus(); else { this.el.tabIndex = -1; this.el.focus({ preventScroll: true }); } };   // (focus in it, so Escape closes it, not the game behind)
        const btn = (sel, f) => p.querySelector(sel)?.addEventListener('click', f), say = t => { const m = p.querySelector('.msg'); if (m) m.textContent = t; };
        if (!this.db) { p.innerHTML = `<h2>ACCOUNT</h2><p>Can't reach the server right now. Your progress is still saved in this browser.</p><button class="x">CLOSE</button>`; wire(); return btn('.x', () => this.close()); }
        if (this.view === 'choose') {
            const g = d => (parseInt(d.glorps || '0', 10) || 0).toLocaleString('en-US'), when = new Date(this.pending.updated_at).toLocaleString();
            p.innerHTML = `<h2>WHICH SAVE?</h2><p>This device and your account have different progress. Keep one; the other is replaced.</p>
<button class="up">KEEP THE ONE ONLINE</button><br><small>${g(this.pending.data)} glorps, saved ${h(when)}. This device's is replaced and the game restarts.</small><br>
<button class="here">KEEP THIS DEVICE'S</button><br><small>${g(this._snapshot())} glorps. The online save is replaced.</small>`;
            wire(); btn('.up', () => this._apply(this.pending)); btn('.here', () => { this.pending = null; this.dirtyAt = Date.now(); this.push(); this.open('account'); });
            return;
        }
        if (this.view === 'board') {
            const B = this.info(this.board);
            p.innerHTML = `<h2>LEADERBOARDS</h2><select class="pick">${this.boards().map(b => `<option value="${b}"${b === this.board ? ' selected' : ''}>${h(this.info(b).title)}</option>`).join('')}</select><p><small>each player's ${B.what}</small></p><ol><li><span>Loading...</span></li></ol><p class="you"></p><button class="acc">ACCOUNT</button><button class="x">CLOSE</button>`;
            wire(); btn('.x', () => this.close()); btn('.acc', () => this.open('account'));
            p.querySelector('.pick').addEventListener('change', e => this.open('board', e.target.value));
            const board = this.board;
            this.top(board).then(async rows => {
                if (this.view !== 'board' || this.board !== board) return;
                p.querySelector('ol').innerHTML = rows.length ? rows.map((r, i) => `<li class="${r.user_id === this.user?.id ? 'me' : ''}"><b>${i + 1}</b><span>${h(r.name)}</span>${this.show(board, +r.value)}</li>`).join('') : '<li><span>No one yet. Be the first.</span></li>';
                const you = p.querySelector('.you');
                if (!this.user) you.textContent = 'Sign in to put yours here.';
                else if (!rows.some(r => r.user_id === this.user.id)) { const r = await this.rank(board); you.textContent = r ? `You: #${r.rank}, ${this.show(board, r.best)}` : 'You have nothing on this one yet.'; }
            });
            return;
        }
        if (this.user) {   // signed in
            const saved = this.pushing ? 'saving...' : this.lastAt ? `saved ${new Date(this.lastAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}` : 'kept online';
            p.innerHTML = `<h2>ACCOUNT</h2><p>Signed in as <b>${h(this.name || '(no name yet)')}</b><br><small>${h(this.user.email || '')} · your save: ${saved}</small></p>
${this.name ? '' : '<label>YOUR NAME ON THE LEADERBOARDS</label><input class="nm" maxlength="16"><button class="setnm">SET NAME</button>'}
<div class="msg"></div><button class="sv">SAVE NOW</button><button class="lb">LEADERBOARDS</button><button class="out">SIGN OUT</button><button class="x">CLOSE</button>`;
            wire();
            btn('.sv', () => { this.dirtyAt = Date.now(); this.push(); });
            btn('.lb', () => this.open('board'));
            btn('.out', async () => { await this.push(); await this.db.auth.signOut(); });
            btn('.x', () => this.close());
            btn('.setnm', async () => { const err = await this.setName(p.querySelector('.nm').value); err ? say(err) : this._render(); });
            return;
        }
        const make = this.tab === 'new';   // signed out: sign in, or make an account
        p.innerHTML = `<h2>ACCOUNT</h2><p>Your progress is saved in this browser either way. An account keeps it online for any device, and puts your times on the leaderboards.</p>
<button class="t-in ${make ? '' : 'on'}">SIGN IN</button><button class="t-new ${make ? 'on' : ''}">CREATE ACCOUNT</button>
<form>${make ? `<label>YOUR NAME ON THE LEADERBOARDS</label><input class="nm" maxlength="16" required value="${h(localStorage.getItem('playerName') || '')}">` : ''}
<label>EMAIL</label><input class="em" type="email" autocomplete="email" required>
<label>PASSWORD</label><input class="pw" type="password" autocomplete="${make ? 'new-password' : 'current-password'}" minlength="6" required>
<button type="submit">${make ? 'CREATE ACCOUNT' : 'SIGN IN'}</button><button type="button" class="x">CLOSE</button></form><div class="msg"></div>`;
        wire();
        btn('.t-in', () => { this.tab = 'in'; this._render(); }); btn('.t-new', () => { this.tab = 'new'; this._render(); }); btn('.x', () => this.close());
        p.querySelector('form').addEventListener('submit', async e => {
            e.preventDefault();
            const email = p.querySelector('.em').value.trim(), password = p.querySelector('.pw').value, name = p.querySelector('.nm')?.value.trim();
            if (make && !/^[A-Za-z0-9 _.-]{2,16}$/.test(name)) return say('Names are 2 to 16 letters, numbers, spaces, _ . or -.');
            if (make) { const { data: taken } = await this.db.from('profiles').select('user_id').eq('name', name).maybeSingle(); if (taken) return say('That name is taken.'); }
            say('...');
            const { data, error } = make ? await this.db.auth.signUp({ email, password, options: { data: { name } } }) : await this.db.auth.signInWithPassword({ email, password });
            if (error) return say(error.message);
            if (make && !data.session) say('Almost: check your email to confirm it, then sign in.');
        });
    },
};
