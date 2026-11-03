// ═══════════════════════════════════════════════════════════════════════════
// BallLightning.js — Ball Lightning (lightning's signature weapon): the ball, its seekers, and the ball embedded in an enemy.
// GameScene borrows each method through a one-line proxy, so `this` in them is the scene.
// ═══════════════════════════════════════════════════════════════════════════

class BallLightning {

    _blCfg() {
        return {
            COOLDOWN:   1600,
            SPEED:      90,     // px/s -- a third of Orb Emitter's 300; it is a moving wall
            PULSE_MS:   250,    // how often it forks to everything in range
            // Fork reach, not a blast radius.
            PULSE_R:    3.5 + 0.5 * WeaponLevels.perk('ball_lightning', 'field'),
            // 2 per tier-0 arc, NOT 5. The cascade multiplies far harder than it looks: at 5
            // damage with a 0.55 falloff, eight clustered enemies took 910 total -- 114 each,
            // which one-shots most of the roster. Measured down to 374 / 47 each.
            PULSE_DMG:  3.6,    // tier-0 arc damage; tiers below fall off from this (all four of its damages -10% on 2026-10-20: it was top dps on one target and on packs)

            // ── CASCADING FORKS ──────────────────────────────────────────────
            // Each enemy the orb forks to then forks onward to LINK_N nearby enemies, and those
            // fork again, TIERS deep. Three enemies in range therefore all receive the main
            // fork plus tier-1 and tier-2 arcs from each other, which is where the crowd
            // multiplication lives: total arcs grow far faster than enemy count.
            FORK_TIERS:   2,    // tiers BEYOND the direct fork
            FORK_LINK_N:  2,    // how many onward targets each node picks
            FORK_LINK_R:  3.0,  // tiles between linked enemies
            FORK_FALLOFF: 0.35, // damage multiplier per tier
            FORK_CAP:     48,   // hard ceiling on arcs per discharge, for sanity
            // WATER EXTENDS THE CASCADE. An arc terminating on an enemy standing in water
            // relays to EVERY enemy sharing that pool, ignoring FORK_LINK_R entirely -- the
            // puddle becomes one node in the fork tree. Deliberately reach, not damage: it
            // changes the cascade's SHAPE, so a flooded lane is worth waiting for without
            // inflating any number. It is also the reason to hold the throw, which the weapon
            // did not previously have -- optimal play was firing on cooldown forever.
            WATER_POOL_CAP: 40, // tiles of pool to consider
            WATER_RELAY_N:  6,  // most enemies one pool may relay to at once

            // CHARGE is spent per ARC DRAWN, not per enemy. With cascading that makes a crowd
            // self-balancing: a dense pack produces dozens of arcs and burns the orb out fast,
            // while a lone enemy produces one and the orb drifts on.
            CHARGE:     150 * (1 + 0.2 * WeaponLevels.perk('ball_lightning', 'life')),   // its lifespan (Long Charge)
            COST_IDLE:  4,      // a discharge that reaches nothing
            COST_ARC:   3.2,    // per arc drawn -- a dense pack burns the orb out fast

            // ── EMBEDDING ────────────────────────────────────────────────────
            // A direct hit does NOT burst. The orb buries itself in the enemy's core, arcs
            // between nearby enemies on a timer, then detonates inside the host. The host is
            // deliberately NOT where the payoff lands -- it takes a decent hit on contact and
            // only a fraction of the detonation, so the weapon converts one body into a
            // delivery mechanism for damaging everything around it.
            DIRECT_R:      0.5,   // tiles -- contact radius for embedding
            EMBED_MS:      2600,  // how long it sits before detonating
            EMBED_TICK_MS: 380,   // arc cadence while embedded
            EMBED_HIT:     14.4,  // on contact, to the host
            EMBED_TICK_DMG: 1.8,  // per tick, to enemies around the host
            // Host DPS SCALES WITH THE CASCADE. Lodged in a lone enemy the embed barely burns;
            // lodged in a pack it cooks. Before this, the embed was a complete single-target
            // kit (16 contact + 23 DPS + detonation) that fired whether or not there was a
            // crowd, which is what flattened per-enemy damage to 63 / 74 / 70 and erased
            // "weak against one target" from the element.
            EMBED_HOST_DPS: 8.1,  // per second AT FULL SPREAD, to the host
            EMBED_DPS_FLOOR: 0.22, // fraction of it with nothing else in range
            EMBED_DPS_FULL_AT: 4,  // arc targets needed for the full rate
            DETONATE_DMG:  10.8,  // detonation, to nearby enemies
            DETONATE_HOST_FRAC: 0.30,  // the host only takes this much of it
            DETONATE_R:    4.0,   // tiles

            // ── SEEKER SPRAY ─────────────────────────────────────────────────
            SEEKERS_MAX: 70 + 20 * WeaponLevels.perk('ball_lightning', 'swarm'),    // at full charge -- a genuine swarm (Swarm: more)
            SEEKERS_MIN: 20,    // floor, so a spent orb still sprays
            // A detonation (the orb was carried into a host) bursts at least this full. Its flight
            // through a pack burns most of the charge, so sized by what was left it always came
            // out at the 20-seeker floor and the swarm never showed.
            EMBED_BURST: 0.8,
            SEEK_SPEED: 480,    // eased off 620 so the spray is readable
            SEEK_R:     4.2,    // draw radius -- these are little balls, not pixels
            SEEK_DMG:   5.4,
            SEEK_ZAP_R: 1.6,    // tiles -- each impact forks to enemies this close
            SEEK_ZAP_DMG: 2.6,
            SEEK_ZAP_N: 2,      // how many nearby enemies one impact forks to
            SEEK_LIFE:  700,
            // Homing radius, tiles. It was read below and never defined, so `bd < TS * undefined`
            // was always false and no seeker has ever homed. 0 keeps exactly that, on purpose:
            // turned on at 2 tiles it cost ~14% of the pack damage (measured, 204 -> 176 DPS),
            // because the homing picks the nearest enemy even when it is already full
            // (SEEK_MAX_PER) and steers seekers into bodies that can no longer absorb them.
            SEEK_HOME_R: 0,
            SEEK_MAX_PER: 2,    // seekers one enemy can absorb
            // Movement is SUBSTEPPED: at speed a frame can advance further than the hit radius
            // and a seeker would step clean through a body without registering.
            SEEK_SUBSTEPS: 3,
            COLOR:      0xffee66
        };
    }

    ballLightningAttack(targetX, targetY) {
        const C = this._blCfg();
        const now = this.time.now;
        if (now - (this._lastBallTime || 0) < C.COOLDOWN) return;
        this._lastBallTime = now;
        this._gearFiredAt = now;   // the held weapon swings now (Creatures.gear)

        const TS = this.TILE_SIZE;
        const px = this._shotX(), py = this._shotY();   // from the slime as drawn
        const wx = targetX + this.cameras.main.scrollX;
        const wy = targetY + this.cameras.main.scrollY;
        const dx = wx - px, dy = wy - py;
        const len = Math.hypot(dx, dy) || 1;

        const gfx = this.add.graphics().setDepth(4);
        gfx.x = px; gfx.y = py;

        if (!this.ballLightnings) this.ballLightnings = [];
        const orb = {
            gfx, vx: (dx / len) * C.SPEED, vy: (dy / len) * C.SPEED,
            charge: C.CHARGE, maxCharge: C.CHARGE,
            lastPulse: now, born: now, hitThisPulse: new Set(), _done: false
        };
        this.ballLightnings.push(orb);
        this._drawBallGfx(orb, C);
        this.cameras.main.shake(20, 0.001);
    }

    // Charge drives the whole look: it dims, shrinks and loses its corona as it drains, so
    // "how much is left" is legible without a bar anywhere on screen.
    //
    // Redrawn EVERY FRAME, not just on discharge. The first version only redrew when it fired,
    // so between shots it was a frozen picture of a few strokes -- which is why it read as
    // cheap. A plasma ball has to be in constant motion to look like one.
    _drawBallGfx(orb, C) {
        const g = orb.gfx;
        if (!g?.active) return;
        const f = Math.max(0, orb.charge / orb.maxCharge);
        const t = (this.time.now - orb.born) / 1000;
        // The ball is pixel art (fx_storm ball_0-3, hand-drawn, roiling) in a soft glow; it shrinks and dims as it drains.
        if (!orb.spr) {
            if (!this.anims.exists('storm_ball')) this.anims.create({ key: 'storm_ball', frames: [0, 1, 2, 3].map(i => ({ key: 'fx_storm', frame: 'ball_' + i })), frameRate: 16, repeat: -1 });
            orb.spr = this.add.sprite(g.x, g.y, 'fx_storm', 'ball_0').setDepth(3.95).play('storm_ball');
            orb.glow = this.add.image(g.x, g.y, 'vfx_glow').setTint(0x5ac8ff).setBlendMode(Phaser.BlendModes.ADD).setDepth(3.9);
            g.once('destroy', () => { orb.spr.destroy(); orb.glow.destroy(); });
        }
        const sc = (0.7 + 0.5 * f) * (1 + Math.sin(t * 9) * 0.04);
        orb.spr.setPosition(g.x, g.y).setScale(1.25 * sc).setAlpha(0.6 + 0.4 * f);
        orb.glow.setPosition(g.x, g.y).setScale((0.4 + 0.3 * f) * (1 + Math.sin(t * 7) * 0.08)).setAlpha(0.3 + 0.3 * f);

        // ── LIVE ARCS: thin bolts leaping off the rim, laid fresh every frame so the edge writhes; how many is the
        // charge readout.
        const r = 14 * sc;
        const arcs = Math.round(2 + f * 4);
        for (let k = 0; k < arcs; k++) {
            const a = Math.random() * Math.PI * 2;
            const out = r * (1.3 + Math.random() * 1.1);
            WeaponSystem.bolt(this, g.x + Math.cos(a) * r * 0.85, g.y + Math.sin(a) * r * 0.85, g.x + Math.cos(a + 0.3) * out, g.y + Math.sin(a + 0.3) * out,
                k & 1 ? 'c' : 'w', { thin: true, br: 0, a: 0.55 + f * 0.45, d: 3.97, glow: false });
        }
        // ── SPARKS riding the corona, so the silhouette is never a clean circle
        const sparks = Math.round(2 + f * 3);
        for (let k = 0; k < sparks; k++) {
            const a = t * 3.5 + (k / sparks) * Math.PI * 2;
            const rr = r * (1.45 + Math.sin(t * 6 + k) * 0.25);
            WeaponSystem.zap(this, k & 1 ? 'spk_4' : 'spk_7', g.x + Math.cos(a) * rr, g.y + Math.sin(a) * rr, 0, 0.7 + f * 0.3, 3.97);
        }
    }

    updateBallLightnings(time, delta) {
        if (!this.ballLightnings?.length) return;
        const C = this._blCfg();
        const TS = this.TILE_SIZE;
        const dt = (delta || 16) / 1000;

        for (let i = this.ballLightnings.length - 1; i >= 0; i--) {
            const orb = this.ballLightnings[i];
            if (orb._done) {
                if (orb.gfx?.active) orb.gfx.destroy();
                this.ballLightnings.splice(i, 1);
                continue;
            }
            if (orb._embedded) { this._updateEmbeddedBall(orb, time, C); continue; }
            orb.gfx.x += orb.vx * dt;
            orb.gfx.y += orb.vy * dt;
            this._drawBallGfx(orb, C);      // every frame: the surface has to writhe

            const tx = Math.floor(orb.gfx.x / TS), ty = Math.floor(orb.gfx.y / TS);
            // Bursts on a WALL rather than bouncing -- the inversion against Orb Emitter, and
            // it makes aiming at the wall behind a pack a deliberate detonation.
            const oob = tx < 0 || tx >= this.WORLD_WIDTH || ty < 0 || ty >= this.WORLD_HEIGHT;
            if (oob || this.world[tx]?.[ty] === this.WALL || this.world[tx]?.[ty] === this.NOTHING
                || this.isInLockedRoom(tx, ty)) {
                this._burstBallLightning(orb, C);
                continue;
            }

            // DIRECT CONTACT EMBEDS. Not a burst -- the orb buries itself in the enemy's core
            // and becomes a bomb carried by that enemy. The earlier version detonated on
            // contact, which ended the orb 3.6 tiles in and skipped the whole grinding phase;
            // embedding keeps the orb alive AND gives the contact a purpose.
            let host = null;
            for (const e of this.enemies) {
                if (!e.sprite?.active || this._phasedOut(e)) continue;
                if (Math.hypot(e.sprite.x - orb.gfx.x, e.sprite.y - orb.gfx.y) <= TS * C.DIRECT_R) {
                    host = e; break;
                }
            }
            if (host) { this._embedBall(orb, host, C); continue; }
            // A boss or a queen is not in this.enemies: the orb flew straight through them and
            // never touched one. A boss it buries itself in, as in any enemy. A queen it stops at and
            // grinds (every discharge arcs into it, see _ballDischarge) until its charge runs out,
            // or bursts if the queen leaves it.
            const boss = [this.voltslimeBoss, this.voidSovereignBoss].find(b => b?.active && b.container?.visible
                && Math.hypot(b.container.x - orb.gfx.x, b.container.y - 14 - orb.gfx.y) <= TS * 1.6);
            if (boss) { this._embedBall(orb, boss, C, true); continue; }
            {
                const near = (this.portals || []).find(q => q.active && this._portalCoversTile?.(q, tx, ty));
                if (near && !orb._onBoss) { orb._onBoss = near; orb.vx = 0; orb.vy = 0; }
                else if (!near && orb._onBoss) { this._burstBallLightning(orb, C); continue; }
            }

            // NO DIRECT-HIT DETONATION. It was in the original design and it did work, but
            // measured against five enemies in a row it ended the orb 3.6 tiles in after three
            // discharges -- the slow grinding forker, which is the whole middle of the weapon,
            // never happened. It only bursts now on a WALL or on running out of charge, so the
            // orb always gets to travel and fork, and the burst lands where the charge ran out
            // (which in a crowd is inside the crowd).
            if (time - orb.lastPulse >= C.PULSE_MS) {
                orb.lastPulse = time;
                const arcs = this._ballDischarge(orb, C);
                orb.charge -= C.COST_IDLE + arcs * C.COST_ARC;
                if (orb.charge <= 0) { this._burstBallLightning(orb, C); continue; }
            }
        }
    }

    // ── CASCADING FORK ───────────────────────────────────────────────────────
    // Draws and damages a tree of arcs: origin -> each seed enemy (tier 0), then each of those
    // -> up to FORK_LINK_N nearby enemies (tier 1), and those onward again (tier 2).
    //
    // An enemy can be struck by several arcs, once per INCOMING fork, which is the point -- with
    // three enemies clustered, every one of them takes the direct arc plus arcs relayed from
    // both others. Arc count therefore grows much faster than enemy count, and since charge is
    // spent per arc, a dense pack burns the orb out quickly all on its own.
    //
    // Returns the number of arcs drawn, which is the charge cost basis.
    _cascadeForks(g, originX, originY, seeds, C, baseDmg, colour) {
        const TS = this.TILE_SIZE;
        const linkR = C.FORK_LINK_R * TS;
        let arcs = 0;

        // Each entry: { from: {x,y}, to: enemy, tier }. Breadth-first so tiers resolve in order.
        let frontier = seeds.map(e => ({ fx: originX, fy: originY, to: e, tier: 0 }));
        // Tracks how many times an enemy has RELAYED, not how often it was hit -- a relay hub
        // that fans out on every tier would double back and loop.
        const relayed = new Set(), zapSeen = [];

        while (frontier.length && arcs < C.FORK_CAP) {
            const next = [];
            for (const link of frontier) {
                if (arcs >= C.FORK_CAP) break;
                const e = link.to;
                if (!e.sprite?.active) continue;
                const tx = e.sprite.x, ty = e.sprite.y + 4;
                const alpha = 1 - link.tier * 0.28;
                // An arc relayed THROUGH water is drawn cyan, so you can see the pool doing the
                // work rather than just noticing more damage numbers than usual.
                const arcCol = link.viaWater ? 0x66ddff : colour;
                this._strokeFork(g, link.fx, link.fy, tx, ty, arcCol, alpha, link.tier === 0 ? 2 : 1);
                WeaponSystem.zap(this, link.tier ? 'spk_4' : 'spk_6', tx, ty, 150, 0.9 - link.tier * 0.2, g.depth);   // a spark where it lands
                arcs++;

                const dmg = baseDmg * Math.pow(C.FORK_FALLOFF, link.tier) * this.damageScaling;
                const _rdFork = this.resolveElementalHit(e, dmg, 'lightning');
                if (_rdFork !== null) {
                    e.health -= _rdFork;
                    this.showDamageNumber(e.sprite.x, e.sprite.y - 10 - link.tier * 6,
                                          Math.round(_rdFork), link.tier ? '#ffffaa' : '#ffee66');
                    this.updateEnemyHealthBar(e);
                    this.gainUltCharge(this.ultChargePerLightningHit * 0.2);
                    if (e.health <= 0) { this.killEnemy(e); continue; }
                }
                this._zapBosses(e, dmg, C.FORK_LINK_R, zapSeen);   // and Queens and bosses in reach, once a cascade

                if (link.tier >= C.FORK_TIERS || relayed.has(e)) continue;
                relayed.add(e);

                // ── WATER RELAY ──────────────────────────────────────────────
                // Standing in water, this enemy relays along the whole POOL rather than to its
                // nearest neighbours. Distance stops mattering: what matters is who shares the
                // puddle, so a pipe-fed lane becomes a conductor the cascade runs down.
                const wet = typeof this.isWaterAt === 'function' && this.isWaterAt(e.x, e.y);
                if (wet && typeof this.enemiesSharingPool === 'function') {
                    const shared = this.enemiesSharingPool(e.x, e.y, C.WATER_POOL_CAP)
                        .filter(o => o !== e && !relayed.has(o) && !this._phasedOut(o));
                    if (shared.length) {
                        for (const o of shared.slice(0, C.WATER_RELAY_N)) {
                            next.push({ fx: tx, fy: ty, to: o, tier: link.tier + 1, viaWater: true });
                        }
                        continue;   // the pool replaces the proximity relay, it does not stack
                    }
                }

                const onward = [];
                for (const o of this.enemies) {
                    if (o === e || !o.sprite?.active || this._phasedOut(o)) continue;
                    const d = Math.hypot(o.sprite.x - tx, o.sprite.y - ty);
                    if (d > linkR) continue;
                    onward.push({ o, d });
                }
                onward.sort((a, b) => a.d - b.d);
                for (const { o } of onward.slice(0, C.FORK_LINK_N)) {
                    next.push({ fx: tx, fy: ty, to: o, tier: link.tier + 1 });
                }
            }
            frontier = next;
        }
        return arcs;
    }

    // One discharge. Returns the number of arcs drawn, which is what the charge cost is computed
    // from -- so a discharge into a crowd is worth far more AND costs far more.
    _ballDischarge(orb, C) {
        const TS = this.TILE_SIZE;
        const R = C.PULSE_R * TS;
        const ox = orb.gfx.x, oy = orb.gfx.y;

        const seeds = [];
        for (const e of [...this.enemies]) {
            if (!e.sprite?.active) continue;
            if (Math.hypot(e.sprite.x - ox, e.sprite.y - oy) > R) continue;
            if (this._phasedOut(e)) continue;
            seeds.push(e);
        }

        const g = this.add.graphics().setDepth(3.8);
        let arcs = 0;
        if (seeds.length) arcs = this._cascadeForks(g, ox, oy, seeds, C, C.PULSE_DMG, C.COLOR);
        // Bosses and queens are not in this.enemies: they take the direct arc too.
        for (const b of [this.voltslimeBoss, this.voidSovereignBoss]) {
            if (!b?.active || !b.container?.visible) continue;
            const bx = b.container.x, by = b.container.y - 14;
            if (Math.hypot(bx - ox, by - oy) > R + TS) continue;
            this._strokeFork(g, ox, oy, bx, by, C.COLOR, 0.9, 2);
            this.damageBossAtTile(b.tileX, b.tileY, C.PULSE_DMG * this.damageScaling, 'ball_arc', 'lightning');
            arcs++;
        }
        for (const q of this.portals || []) {
            if (!q.active) continue;
            const qx = q.tileX * TS + TS / 2, qy = q.tileY * TS + TS / 2 + (q.hitOffY || 0);
            if (Math.hypot(qx - ox, qy - oy) > R + TS) continue;
            this._strokeFork(g, ox, oy, qx, qy, C.COLOR, 0.9, 2);
            this.damagePortal(q, C.PULSE_DMG * this.damageScaling);
            arcs++;
        }

        // A couple of forks into EMPTY space as well, so the orb reads as constantly
        // discharging rather than only ever pointing at enemies.
        for (let k = 0; k < 2; k++) {
            const a = Math.random() * Math.PI * 2;
            const d = R * (0.3 + Math.random() * 0.4);
            this._strokeFork(g, ox, oy, ox + Math.cos(a) * d, oy + Math.sin(a) * d,
                             C.COLOR, 0.40, 1);
        }
        // Short life: a fork is a strike, not a beam. It re-strikes on the next cadence.
        this.time.delayedCall(60, () => {
            if (!g.active) return;
            this.tweens.add({ targets: g, alpha: 0, duration: 120,
                              onComplete: () => g.destroy() });
        });
        return arcs;
    }

    // ── EMBEDDING ────────────────────────────────────────────────────────────
    // The orb stops, rides the host's sprite, and arcs between nearby enemies on a timer. When
    // the timer expires it detonates INSIDE the host -- and the host takes only
    // DETONATE_HOST_FRAC of it. The brunt goes to everything around it.
    //
    // That split is the whole idea: the enemy you hit becomes a delivery mechanism rather than
    // the victim. It also means the correct target is a body on the EDGE of a pack, not the one
    // you most want dead, which is a genuinely different aiming instinct from every other
    // weapon in the game.
    _embedBall(orb, host, C, boss = false) {
        if (orb._done || orb._embedded) return;
        orb._embedded = true;
        orb.host = host;
        orb.boss = boss;   // (a boss: no sprite and no health of its own here, so hits go through damageBossAtTile)
        host._ballHost = orb;
        const at = this._ballHostAt(orb);

        // Contact damage is decent -- the host is not getting away with being a carrier.
        if (boss) this.damageBossAtTile(host.tileX, host.tileY, C.EMBED_HIT * this.damageScaling, undefined, 'lightning');
        else {
            const _rdEmbed = this.resolveElementalHit(host, C.EMBED_HIT * this.damageScaling, 'lightning');
            if (_rdEmbed !== null) {
                host.health -= _rdEmbed;
                this.showDamageNumber(at.x, at.y - 12, Math.round(_rdEmbed), '#ffffff');
                this.updateEnemyHealthBar(host);
                this.gainUltCharge(this.ultChargePerLightningHit);
            }
        }
        this.showStatusText?.(at.x, at.y - 24, 'EMBEDDED', '#ffee66');

        WeaponSystem.zapFlare(this, at.x, at.y, 'w', 2, 5);   // it buries itself: a white strike, sparks
        WeaponSystem.zapSparks(this, 'c').emitParticleAt(at.x, at.y, 8);
        this.cameras.main.shake(70, 0.002);

        orb.embedEnd = this.time.now + C.EMBED_MS;
        orb.lastEmbedTick = this.time.now;
        // Host DPS is tracked separately from the arc cadence and accumulated as a FRACTION of
        // a frame, so the total over the embed is exactly EMBED_HOST_DPS * EMBED_MS regardless
        // of frame rate. Tying it to the arc ticks instead would make the damage depend on how
        // the two timers happened to line up.
        orb.hostDpsAt = this.time.now;
        // If the host dies early the orb detonates where it stood -- the payload is not lost
        // just because the carrier did not survive its own delivery.
        orb._hostWasAt = at;
    }

    // Where the orb's host is now, or null once it's gone (dead, phased out, a boss left the fight).
    _ballHostAt(orb) {
        const h = orb.host;
        if (orb.boss) return h?.active && h.container?.visible ? { x: h.container.x, y: h.container.y - 14 } : null;
        return h?.sprite?.active && !this._phasedOut(h) ? { x: h.sprite.x, y: h.sprite.y } : null;
    }

    // Per-frame while embedded. Split out of updateBallLightnings because an embedded orb shares
    // almost nothing with a travelling one: it does not move, does not spend charge on distance,
    // and ends on a timer rather than on geometry.
    _updateEmbeddedBall(orb, time, C) {
        const host = orb.host, at = this._ballHostAt(orb);
        if (at) {
            orb.gfx.x = at.x;
            orb.gfx.y = at.y;
            orb._hostWasAt = at;
        } else {
            // Host died mid-carry: detonate at its last position immediately.
            this._detonateEmbedded(orb, C);
            return;
        }
        this._drawBallGfx(orb, C);
        if (!orb.boss) this._superconduct(host, 1000);   // embedded, it amps its host for as long as it's lodged there (and a second after)

        // ── PERSISTENT DPS ON THE HOST ───────────────────────────────────────
        // It is burning a hole in whatever it is lodged in for the whole duration, so carrying
        // the bomb costs the host continuously rather than only at the two bookend moments.
        const dtSec = Math.max(0, (time - (orb.hostDpsAt || time)) / 1000);
        orb.hostDpsAt = time;
        if (dtSec > 0) {
            // Rate scales with how many enemies the last arc tick actually reached. A carrier
            // standing alone is barely warm; one inside a pack is being cooked by its own
            // neighbours' conductivity.
            const spread = orb.lastArcTargets || 0;
            const frac = C.EMBED_DPS_FLOOR +
                (1 - C.EMBED_DPS_FLOOR) * Math.min(1, spread / C.EMBED_DPS_FULL_AT);
            const tick = C.EMBED_HOST_DPS * frac * dtSec * this.damageScaling;
            // a boss takes it in a lump on each arc tick (a hit a frame would be a boss-hit sound a frame)
            if (orb.boss) orb._bossOwed = (orb._bossOwed || 0) + tick;
            const _rdHostDps = orb.boss ? null : this.resolveElementalHit(host, tick, 'lightning');
            if (_rdHostDps !== null) {
                host.health -= _rdHostDps;
                // Accumulate into a visible number rather than spamming a 0.15 every frame.
                orb._dpsShown = (orb._dpsShown || 0) + _rdHostDps;
                if (orb._dpsShown >= 3) {
                    this.showDamageNumber(host.sprite.x, host.sprite.y - 6,
                                          Math.round(orb._dpsShown), '#ffcc44');
                    orb._dpsShown = 0;
                }
                this.updateEnemyHealthBar(host);
                if (host.health <= 0) {
                    this.killEnemy(host);
                    this._detonateEmbedded(orb, C);
                    return;
                }
            }
        }

        if (time - orb.lastEmbedTick >= C.EMBED_TICK_MS) {
            orb.lastEmbedTick = time;
            if (orb.boss && orb._bossOwed > 0) { this.damageBossAtTile(host.tileX, host.tileY, orb._bossOwed, undefined, 'lightning'); orb._bossOwed = 0; }
            const TS = this.TILE_SIZE;
            const R = C.PULSE_R * TS;
            // Arcs go to OTHERS, not the host: the host is the emitter now.
            const seeds = [];
            for (const e of [...this.enemies]) {
                if (e === host || !e.sprite?.active || this._phasedOut(e)) continue;
                if (Math.hypot(e.sprite.x - orb.gfx.x, e.sprite.y - orb.gfx.y) > R) continue;
                seeds.push(e);
            }
            const g = this.add.graphics().setDepth(3.8);
            // Remembered for the host-DPS scaling above: arcs DRAWN, not seeds found, so a pool
            // relay counts toward it too.
            orb.lastArcTargets = seeds.length
                ? this._cascadeForks(g, orb.gfx.x, orb.gfx.y, seeds, C, C.EMBED_TICK_DMG, C.COLOR)
                : 0;
            for (let k = 0; k < 2; k++) {
                const a = Math.random() * Math.PI * 2;
                this._strokeFork(g, orb.gfx.x, orb.gfx.y,
                                 orb.gfx.x + Math.cos(a) * R * 0.3,
                                 orb.gfx.y + Math.sin(a) * R * 0.3, C.COLOR, 0.35, 1);
            }
            this.time.delayedCall(60, () => {
                if (!g.active) return;
                this.tweens.add({ targets: g, alpha: 0, duration: 120,
                                  onComplete: () => g.destroy() });
            });
        }

        if (time >= orb.embedEnd) this._detonateEmbedded(orb, C);
    }

    _detonateEmbedded(orb, C) {
        if (orb._done) return;
        orb._done = true;
        const host = orb.host;
        if (host) host._ballHost = null;
        const hostAt = host ? this._ballHostAt(orb) : null;
        const at = hostAt || orb._hostWasAt || { x: orb.gfx.x, y: orb.gfx.y };
        const TS = this.TILE_SIZE;
        const R = C.DETONATE_R * TS;

        // it goes off: a big strike, bolts torn out of it every way, sparks, a flash of light
        WeaponSystem.zapFlare(this, at.x, at.y, 'y', 3, 4.5);
        for (let k = 0; k < 8; k++) { const a = k / 8 * Math.PI * 2 + WeaponSystem.vr() * 0.5, r = R * (0.3 + WeaponSystem.vr() * 0.2); WeaponSystem.bolt(this, at.x, at.y, at.x + Math.cos(a) * r, at.y + Math.sin(a) * r, k & 1 ? 'c' : 'y', { life: 260, thin: k & 1, br: 1, d: 4.4, glow: !(k & 1) }); }
        WeaponSystem.zapSparks(this, 'y').emitParticleAt(at.x, at.y, 14);
        this._vfxFlash?.(at.x, at.y, R * 0.7, 0xffe14a, 260, 0.6);
        this.cameras.main.shake(160, 0.005);

        const seeds = [];
        for (const e of [...this.enemies]) {
            if (e === host || !e.sprite?.active || this._phasedOut(e)) continue;
            if (Math.hypot(e.sprite.x - at.x, e.sprite.y - at.y) > R) continue;
            seeds.push(e);
        }
        const g = this.add.graphics().setDepth(4);
        if (seeds.length) this._cascadeForks(g, at.x, at.y, seeds, C, C.DETONATE_DMG, 0xffffff);
        this.time.delayedCall(90, () => {
            if (!g.active) return;
            this.tweens.add({ targets: g, alpha: 0, duration: 200,
                              onComplete: () => g.destroy() });
        });

        // The host takes only a fraction. It carried the bomb; it is not the target.
        if (hostAt && orb.boss) this.damageBossAtTile(host.tileX, host.tileY, C.DETONATE_DMG * C.DETONATE_HOST_FRAC * this.damageScaling + (orb._bossOwed || 0), undefined, 'lightning');   // (and what it burned since the last tick)
        else if (hostAt) {
            const raw = C.DETONATE_DMG * C.DETONATE_HOST_FRAC * this.damageScaling;
            const _rdHost = this.resolveElementalHit(host, raw, 'lightning');
            if (_rdHost !== null) {
                host.health -= _rdHost;
                this.showDamageNumber(host.sprite.x, host.sprite.y - 10, Math.round(_rdHost), '#ffffff');
                this.updateEnemyHealthBar(host);
                if (host.health <= 0) this.killEnemy(host);
            }
        }

        // And it still sprays -- the detonation is the burst, at whatever charge is left.
        this._burstBallLightning(orb, C, at);
    }

    // Seeker count scales with charge REMAINING, which is what makes the charge budget a
    // decision rather than just a timer.
    _burstBallLightning(orb, C, originAt) {
        if (orb._done && !originAt) return;
        orb._done = true;
        const f = Math.max(originAt ? C.EMBED_BURST : 0, Math.min(1, orb.charge / orb.maxCharge));
        const count = Math.max(C.SEEKERS_MIN, Math.round(C.SEEKERS_MAX * f));
        const ox = originAt ? originAt.x : orb.gfx.x, oy = originAt ? originAt.y : orb.gfx.y;
        Sfx.play(this, 'blburst');

        WeaponSystem.zapFlare(this, ox, oy, 'c', 2.4, 4.5);   // it bursts: a blue strike, sparks
        WeaponSystem.zapSparks(this, 'c').emitParticleAt(ox, oy, 10);
        this.cameras.main.shake(90, 0.003);

        // Clear the per-burst saturation counters, or an enemy hit by an earlier burst would
        // be immune to every later one. (Bosses and queens keep the same counter now.)
        for (const e of (this.enemies || [])) e._seekHits = 0;
        for (const b of [this.voltslimeBoss, this.voidSovereignBoss, ...(this.portals || [])]) if (b) b._seekHits = 0;

        if (!this.ballSeekers) this.ballSeekers = [];
        for (let i = 0; i < count; i++) {
            // Angles are RANDOM, not an even fan. `(i / count) * 2PI` spaced them perfectly,
            // which at seventy seekers read as a mechanical starburst -- a rosette, not an
            // explosion. Jittering the slot by most of its own width breaks the ring up while
            // still covering every direction, and randomising SPEED too means the leading edge
            // is ragged instead of a single expanding circle.
            const slot = (i / count) * Math.PI * 2;
            const a = slot + (Math.random() - 0.5) * (Math.PI * 2 / count) * 2.8;
            const spd = C.SEEK_SPEED * (0.62 + Math.random() * 0.76);
            // the seeker: a little crackling ball (fx_storm seek_0-2) and its streak, drawn the way it flies (8 ways, never turned)
            if (!this.anims.exists('storm_seek')) this.anims.create({ key: 'storm_seek', frames: [0, 1, 0, 2].map(i => ({ key: 'fx_storm', frame: 'seek_' + i })), frameRate: 18, repeat: -1 });
            const sg = this.add.sprite(ox, oy, 'fx_storm', 'seek_0').setDepth(4).setScale(1.5).setBlendMode(Phaser.BlendModes.ADD).play({ key: 'storm_seek', startFrame: i & 3 });
            const k = ((Math.round(a / (Math.PI / 4)) % 8) + 8) % 8, [tf, fl] = [['e', 0], ['se', 0], ['s', 0], ['ne', 1], ['e', 1], ['se', 1], ['s', 1], ['ne', 0]][k];
            sg._trail = this.add.image(ox, oy, 'fx_storm', 'trail_' + tf).setDepth(3.99).setScale(1.5).setBlendMode(Phaser.BlendModes.ADD).setFlip(!!fl, !!fl).setAlpha(0.85);
            sg._back = WeaponSystem.ZAP_DIR[(k + 4) % 8];
            sg.once('destroy', () => sg._trail.destroy());
            this.ballSeekers.push({
                gfx: sg, vx: Math.cos(a) * spd, vy: Math.sin(a) * spd,
                // Stagger the birth times slightly so they do not all leave on the same frame.
                born: this.time.now + Math.random() * 90, _done: false,
                // Per-seeker phase, so the crackle on each one is out of step with the others.
                phase: Math.random() * 100
            });
        }
    }

    updateBallSeekers(time, delta) {
        if (!this.ballSeekers?.length) return;
        const C = this._blCfg();
        const TS = this.TILE_SIZE;
        const dt = (delta || 16) / 1000;

        for (let i = this.ballSeekers.length - 1; i >= 0; i--) {
            const s = this.ballSeekers[i];
            if (s._done || time - s.born > C.SEEK_LIFE) {
                if (s.gfx?.active) s.gfx.destroy();
                this.ballSeekers.splice(i, 1);
                continue;
            }
            // Mild homing: enough to feel like it seeks, not enough to be unmissable.
            let best = null, bd = Infinity;
            if (C.SEEK_HOME_R > 0) for (const e of this.enemies) {   // off (0): skip the scan, it's per seeker per frame
                if (!e.sprite?.active || this._phasedOut(e)) continue;
                const d = Math.hypot(e.sprite.x - s.gfx.x, e.sprite.y - s.gfx.y);
                if (d < bd) { bd = d; best = e; }
            }
            // Homing radius is DELIBERATELY SHORT. At 6 tiles every seeker in the burst
            // converged on the same lone enemy and the whole payload landed on one target --
            // measured as 44 damage to a single enemy against 85 to eight, which inverts the
            // element's identity instead of expressing it. A seeker should correct its aim,
            // not seek across the room.
            if (best && bd < TS * C.SEEK_HOME_R) {
                const ax = (best.sprite.x - s.gfx.x) / bd, ay = (best.sprite.y - s.gfx.y) / bd;
                s.vx += ax * 900 * dt; s.vy += ay * 900 * dt;
                const sp = Math.hypot(s.vx, s.vy) || 1;
                s.vx = s.vx / sp * C.SEEK_SPEED; s.vy = s.vy / sp * C.SEEK_SPEED;
            }
            // Advance in substeps, testing collisions after each, so a fast seeker cannot
            // tunnel through a body between frames.
            const steps = C.SEEK_SUBSTEPS;
            const sdt = dt / steps;
            for (let k = 0; k < steps && !s._done; k++) {
                s.gfx.x += s.vx * sdt; s.gfx.y += s.vy * sdt;

                const tx = Math.floor(s.gfx.x / TS), ty = Math.floor(s.gfx.y / TS);
                if (this.world[tx]?.[ty] === this.WALL || this.world[tx]?.[ty] === this.NOTHING) {
                    s._done = true; break;
                }
                // Bosses and queens are not in this.enemies; a seeker meeting one strikes it (as
                // many per burst as an enemy may absorb).
                {
                    const boss = [this.voltslimeBoss, this.voidSovereignBoss].find(b => b?.active && b.container?.visible
                        && Math.hypot(b.container.x - s.gfx.x, b.container.y - 14 - s.gfx.y) <= TS * 1.2);
                    const queen = boss ? null : (this.portals || []).find(q => q.active && this._portalCoversTile?.(q, tx, ty));
                    const hit = boss || queen;
                    if (hit && (hit._seekHits || 0) < C.SEEK_MAX_PER) {
                        hit._seekHits = (hit._seekHits || 0) + 1;
                        if (boss) this.damageBossAtTile(boss.tileX, boss.tileY, C.SEEK_DMG * this.damageScaling, undefined, 'lightning');
                        else this.damagePortal(queen, C.SEEK_DMG * this.damageScaling);
                        s._done = true; break;
                    }
                }
                for (const e of this.enemies) {   // no copy: the loop breaks right after a hit (a kill may splice)
                    if (!e.sprite?.active || this._phasedOut(e)) continue;
                    if (Math.abs(e.sprite.x - s.gfx.x) > TS * 0.6 || Math.abs(e.sprite.y - s.gfx.y) > TS * 0.6) continue;
                    if (Math.hypot(e.sprite.x - s.gfx.x, e.sprite.y - s.gfx.y) > TS * 0.6) continue;
                    // One enemy can only absorb SEEK_MAX_PER seekers. Without a cap the burst is
                    // just single-target damage whenever anything is closest, which is the same
                    // failure as the wide homing radius: the split stops being about the crowd.
                    e._seekHits = (e._seekHits || 0) + 1;
                    if (e._seekHits > C.SEEK_MAX_PER) { e._seekHits = C.SEEK_MAX_PER; continue; }
                    this._seekerHit(s, e, C);
                    break;
                }
            }
            if (s._done) continue;
            // the crackling ball (it animates itself) and its streak trailing behind it
            const g = s.gfx, tr = g._trail;
            if (tr) { tr.setPosition(g.x + g._back[0] * 7, g.y + g._back[1] * 7).setVisible(time >= s.born); g.setVisible(time >= s.born); }
        }
    }

    // Consumed on contact. The impact FORKS to nearby enemies rather than applying an invisible
    // radius of damage -- with thirty of these landing across a pack, the arcs between them are
    // most of what the burst looks like.
    _seekerHit(seeker, enemy, C) {
        seeker._done = true;
        Sfx.play(this, 'zap', { soft: true });
        const TS = this.TILE_SIZE;
        const hx = seeker.gfx.x, hy = seeker.gfx.y;

        WeaponSystem.zapFlare(this, hx, hy, 'y', 1, 3.6);   // it pops on what it hit

        // Direct target first, at full seeker damage. Named _rd* because the resistance check scans
        // for `.health -=` whose value did not come out of resolveElementalHit -- a local called
        // `direct` reads better and trips that guard, so the convention wins.
        const _rdSeekDirect = this.resolveElementalHit(enemy, C.SEEK_DMG * this.damageScaling, 'lightning');
        if (_rdSeekDirect !== null) {
            enemy.health -= _rdSeekDirect;
            this.showDamageNumber(enemy.sprite.x, enemy.sprite.y - 10, Math.round(_rdSeekDirect), '#ffffaa');
            this.updateEnemyHealthBar(enemy);
            this.gainUltCharge(this.ultChargePerLightningHit * 0.1);
            if (enemy.health <= 0) this.killEnemy(enemy);
        }

        // Then fork onward to the nearest few others.
        const R = C.SEEK_ZAP_R * TS;
        const near = [];
        for (const e of this.enemies) {
            if (e === enemy || !e.sprite?.active || this._phasedOut(e)) continue;
            const d = Math.hypot(e.sprite.x - hx, e.sprite.y - hy);
            if (d <= R) near.push({ e, d });
        }
        near.sort((a, b) => a.d - b.d);
        for (const { e } of near.slice(0, C.SEEK_ZAP_N)) {
            WeaponSystem.bolt(this, hx, hy, e.sprite.x, e.sprite.y + 4, 'y', { life: 170, a: 0.75, thin: true, br: 1, d: 3.6 });
            const _rdZap = this.resolveElementalHit(e, C.SEEK_ZAP_DMG * this.damageScaling, 'lightning');
            if (_rdZap === null) continue;
            e.health -= _rdZap;
            this.showDamageNumber(e.sprite.x, e.sprite.y - 10, Math.round(_rdZap), '#ffffcc');
            this.updateEnemyHealthBar(e);
            if (e.health <= 0) this.killEnemy(e);
        }
    }

}
