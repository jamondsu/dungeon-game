// TowerDefenseScene.js — Engineering Defense Minigame
// Reuses ALL of WeaponSystem, EnemyManager, WorldGen directly via prototype proxies.
// Enemies path toward baseTileX/baseTileY instead of playerX/playerY.

// NOTE ON ENEMY ITERATION
// Loops that can kill iterate `[...this.enemies]`, never `this.enemies` directly.
// killEnemy -> CombatSystem.killEnemy SPLICES this.enemies, and a live for...of over a
// spliced array skips the element after each removal — so an AoE that kills its first
// target silently spares every second enemy in range. The spread makes a snapshot; the
// dead entries are filtered by the `sprite?.active` guards each body already has.
// `(this.enemies||[])` is NOT a snapshot — it is a nullish guard. The copy is the spread.

class TowerDefenseScene extends Phaser.Scene {
    constructor() { super({ key: 'TowerDefenseScene' }); }

    // ─── WorldGen proxies ─────────────────────────────────────────────────────
    carveRoom(...a){return WorldGen.prototype.carveRoom.call(this,...a);}
    connectRooms(world,a,b){
        // TD uses wider 5-tile corridors (hw=2) vs the main game's 3-tile default —
        // gives room for swarms to spread and enemies to fan out toward the base.
        const ax=Math.floor(a.x+a.w/2), ay=Math.floor(a.y+a.h/2);
        const bx=Math.floor(b.x+b.w/2), by=Math.floor(b.y+b.h/2);
        const hw=2; // 2*2+1 = 5 tile wide
        const minX=Math.min(ax,bx), maxX=Math.max(ax,bx);
        for(let x=minX;x<=maxX;x++){
            for(let o=-hw;o<=hw;o++){
                const ty=ay+o;
                if(ty>=0&&ty<this.WORLD_HEIGHT) world[x][ty]=this.FLOOR;
            }
        }
        const minY=Math.min(ay,by), maxY=Math.max(ay,by);
        for(let y=minY;y<=maxY;y++){
            for(let o=-hw;o<=hw;o++){
                const tx=bx+o;
                if(tx>=0&&tx<this.WORLD_WIDTH) world[tx][y]=this.FLOOR;
            }
        }
    }
    addWalls(...a){return WorldGen.prototype.addWalls.call(this,...a);}
    renderWorld(...a){return WorldGen.prototype.renderWorld.call(this,...a);}
    // Visuals.js: the dungeon's stone, brick and torches (TD keeps its own camera, HUD and effects)
    _vfxCfg(...a){return VisualFX.prototype._vfxCfg.call(this,...a);}
    _vfxTheme(...a){return VisualFX.prototype._vfxTheme.call(this,...a);}
    _vfxAtlas(...a){return VisualFX.prototype._vfxAtlas.call(this,...a);}
    _vfxFrame(...a){return VisualFX.prototype._vfxFrame.call(this,...a);}
    _vfxRng(...a){return VisualFX.prototype._vfxRng.call(this,...a);}
    _vfxSoftTextures(...a){return VisualFX.prototype._vfxSoftTextures.call(this,...a);}
    _vfxRenderWorld(...a){return VisualFX.prototype._vfxRenderWorld.call(this,...a);}
    _vfxPaintFloor(...a){return VisualFX.prototype._vfxPaintFloor.call(this,...a);}
    _vfxPaintAO(...a){return VisualFX.prototype._vfxPaintAO.call(this,...a);}
    _vfxTileFrame(...a){return VisualFX.prototype._vfxTileFrame.call(this,...a);}
    _vfxPlaceDecals(...a){return VisualFX.prototype._vfxPlaceDecals.call(this,...a);}
    _vfxPaintDecal(...a){return VisualFX.prototype._vfxPaintDecal.call(this,...a);}
    _vfxPlaceTorches(...a){return VisualFX.prototype._vfxPlaceTorches.call(this,...a);}
    _vfxPaintSconce(...a){return VisualFX.prototype._vfxPaintSconce.call(this,...a);}
    _vfxUpdateTorches(...a){return VisualFX.prototype._vfxUpdateTorches.call(this,...a);}
    _vfxPaintLava(...a){return VisualFX.prototype._vfxPaintLava.call(this,...a);}
    _vfxPaintWater(...a){return VisualFX.prototype._vfxPaintWater.call(this,...a);}
    _vfxPaintIce(...a){return VisualFX.prototype._vfxPaintIce.call(this,...a);}
    _vfxPaintWard(...a){return VisualFX.prototype._vfxPaintWard.call(this,...a);}
    _vfxPaintSludge(...a){return VisualFX.prototype._vfxPaintSludge.call(this,...a);}
    _vfxPaintFog(...a){return VisualFX.prototype._vfxPaintFog.call(this,...a);}
    getWallFrame(...a){return WorldGen.prototype.getWallFrame.call(this,...a);}
    hasFloorNeighbor(...a){return WorldGen.prototype.hasFloorNeighbor.call(this,...a);}
    isFloor(...a){return WorldGen.prototype.isFloor.call(this,...a);}
    createRng(...a){return WorldGen.prototype.createRng.call(this,...a);}

    // ─── WeaponSystem proxies — ALL of them ───────────────────────────────────
    fireEquippedWeapon(...a){return WeaponSystem.prototype.fireEquippedWeapon.call(this,...a);}
    _roomGated(){return false;}   // tower defense has no rooms to gate
    _dmgNote(...a){ return CombatSystem.prototype._dmgNote.call(this,...a); }
    resolveElementalHit(...a){ return CombatSystem.prototype.resolveElementalHit.call(this,...a); }
    _brittleMult(...a){ return CombatSystem.prototype._brittleMult.call(this,...a); }
    _cubeNote(...a){ return CombatSystem.prototype._cubeNote.call(this,...a); }
    _dmgOutMult(...a){ return CombatSystem.prototype._dmgOutMult.call(this,...a); }
    _luckNow(...a){ return CombatSystem.prototype._luckNow.call(this,...a); }
    _dieFx(...a){ return CombatSystem.prototype._dieFx.call(this,...a); }
    _wheel(...a){ return CombatSystem.prototype._wheel.call(this,...a); }
    _asUlt(...a){ return CombatSystem.prototype._asUlt.call(this,...a); }
    _hitRoll(...a){ return CombatSystem.prototype._hitRoll.call(this,...a); }
    _afterHit(...a){ return CombatSystem.prototype._afterHit.call(this,...a); }
    _critEffect(...a){ return CombatSystem.prototype._critEffect.call(this,...a); }
    _tallyDamage(...a){return CombatSystem.prototype._tallyDamage.call(this,...a);}
    _volleyMult(...a){return CombatSystem.prototype._volleyMult.call(this,...a);}
    _bossVolleyKey(...a){return CombatSystem.prototype._bossVolleyKey.call(this,...a);}
    _freezeClock(...a){return HUD.prototype._freezeClock.call(this,...a);}
    _noteUltHit(){}   // the shared damage choke points call it; TD has no ult gems
    _phasedOut(e){ return !!(e && e.isVoidSniper && (e._inDimension || e._sniperInvisible)); }
    _firstEncounterCheck(){}   // no room-entry codex in tower defense
    updatePipes(){}            // no leaking pipes in tower defense
    applyFloorScaling(){ this.enemyHealthScale=1; this.enemyDamageScale=1; }   // TD has its own wave scaling
    // The staff is reachable from fireEquippedWeapon here too, and its heat helpers are
    // resolved off `this` — which is THIS scene, not WeaponSystem.prototype. Without these
    // four, equipping the Magma Staff in Engineering Defense throws on the first click.
    _magmaCfg(...a)        { return WeaponSystem.prototype._magmaCfg.call(this,...a); }
    _magmaTier(...a)       { return WeaponSystem.prototype._magmaTier.call(this,...a); }
    _addMagmaHeat(...a)    { return WeaponSystem.prototype._addMagmaHeat.call(this,...a); }
    _updateMagmaHeat(...a) { return WeaponSystem.prototype._updateMagmaHeat.call(this,...a); }
    // Kindling Brand is reachable from fireEquippedWeapon here as well. Same rule as the
    // staff: every helper it calls off `this` has to exist on THIS scene.
    _kindlingCfg(...a)          { return WeaponSystem.prototype._kindlingCfg.call(this,...a); }
    _kindlingPayout(...a)       { return WeaponSystem.prototype._kindlingPayout.call(this,...a); }
    _kindleOverMult(...a)       { return WeaponSystem.prototype._kindleOverMult.call(this,...a); }
    _jetFx(...a)                { return WeaponSystem.prototype._jetFx.call(this,...a); }
    kindlingBrandAttack(...a)   { return WeaponSystem.prototype.kindlingBrandAttack.call(this,...a); }
    kindlingIgnitionMode(...a)  { return WeaponSystem.prototype.kindlingIgnitionMode.call(this,...a); }
    _brandEnemy(...a)           { return WeaponSystem.prototype._brandEnemy.call(this,...a); }
    _kindlePassOn(...a)         { return WeaponSystem.prototype._kindlePassOn.call(this,...a); }
    _updateKindling(...a)       { return WeaponSystem.prototype._updateKindling.call(this,...a); }
    _detonateKindling(...a)     { return WeaponSystem.prototype._detonateKindling.call(this,...a); }
    _clearKindle(...a)          { return WeaponSystem.prototype._clearKindle.call(this,...a); }
    _updateKindleIndicator(...a){ return WeaponSystem.prototype._updateKindleIndicator.call(this,...a); }
    _drawKindleMark(...a){ return WeaponSystem.prototype._drawKindleMark.call(this,...a); }
    _kindleBlast(...a){ return WeaponSystem.prototype._kindleBlast.call(this,...a); }
    _kindleIgniteFx(...a){ return WeaponSystem.prototype._kindleIgniteFx.call(this,...a); }
    _kindleClickDetonate(...a){ return WeaponSystem.prototype._kindleClickDetonate.call(this,...a); }
    _fireKindleRound(...a)      { return WeaponSystem.prototype._fireKindleRound.call(this,...a); }
    _evaporate(...a) { return WeaponSystem.prototype._evaporate.call(this, ...a); }
    _kindleBrandables(...a) { return WeaponSystem.prototype._kindleBrandables.call(this, ...a); }
    _kindlePos(...a) { return WeaponSystem.prototype._kindlePos.call(this, ...a); }
    _kindleAlive(...a) { return WeaponSystem.prototype._kindleAlive.call(this, ...a); }
    _kindleDamage(...a) { return WeaponSystem.prototype._kindleDamage.call(this, ...a); }
    _updateKindleBullets(...a) { return WeaponSystem.prototype._updateKindleBullets.call(this, ...a); }
    _kindleMuzzle(...a) { return WeaponSystem.prototype._kindleMuzzle.call(this, ...a); }
    _kindleSpark(...a) { return WeaponSystem.prototype._kindleSpark.call(this, ...a); }
    _kindleHeatColor(...a) { return WeaponSystem.prototype._kindleHeatColor.call(this, ...a); }
    _clearKindleBullets(...a) { return WeaponSystem.prototype._clearKindleBullets.call(this, ...a); }
    engineeringDegreeAttack(targetX,targetY){
        const isGold=this._wrenchTier==='gold'||this._wrenchTier==='diamond';
        if(!isGold) return WeaponSystem.prototype.engineeringDegreeAttack.call(this,targetX,targetY);
        if(this._wrenchTier==='diamond'){
            const currentTime=this.time.now;
            const worldX=targetX+this.cameras.main.scrollX;
            const worldY=targetY+this.cameras.main.scrollY;
            this._throwOrbitDiamond(worldX,worldY,currentTime);
            return;
        }
        const currentTime=this.time.now;
        if(currentTime-(this._lastWrenchTime||0)<1500)return;
        this._lastWrenchTime=currentTime;
        const TS=this.TILE_SIZE;
        const worldX=targetX+this.cameras.main.scrollX;
        const worldY=targetY+this.cameras.main.scrollY;
        const px=this.player.x, py=this.player.y;
        const dx=worldX-px, dy=worldY-py;
        const dist=Math.sqrt(dx*dx+dy*dy)||1;
        const dirX=dx/dist, dirY=dy/dist;
        const BOUNCES=this._extraBounces||0;
        this._throwWrenchArc(px,py,worldX,worldY,BOUNCES,dirX,dirY,dist);
    }

    // Diamond wrench: pierce-throw that boomerangs back. No idle orbit around the
    // player (that visually clashed with wisp orbits) — it only exists while thrown.
    _throwOrbitDiamond(worldX,worldY,currentTime){
        if(currentTime-(this._lastDiamondThrow||0)<700)return; // per-throw cooldown
        this._lastDiamondThrow=currentTime;
        const TS=this.TILE_SIZE;
        const px=this.player.x, py=this.player.y;
        const dx=worldX-px, dy=worldY-py;
        const dist=Math.hypot(dx,dy)||1;
        const dirX=dx/dist, dirY=dy/dist;
        if(!this._diamondThrows) this._diamondThrows=[];
        const gfx=this.add.graphics().setDepth(5.4); // above wisps (4.5) so no z-fight, but only exists in flight
        this._diamondThrows.push({
            gfx, state:'thrown',
            curX:px, curY:py, dirX, dirY, tx:worldX, ty:worldY,
            traveled:0, lastTileX:-1, lastTileY:-1, lastTickTime:0,
            hitOutbound:new Set(), // enemy refs clipped on the way out — checked again on return for the crush bonus
        });
    }

    _updateDiamondOrbit(time,dt){
        if(!this._diamondThrows?.length)return;
        const TS=this.TILE_SIZE;
        const px=this.player.x, py=this.player.y;
        for(let i=this._diamondThrows.length-1;i>=0;i--){
            const w=this._diamondThrows[i];
            if(w.state==='thrown'){
                const speed=TS*18; // faster, punchier throw
                const moved=speed*dt;
                w.curX+=w.dirX*moved; w.curY+=w.dirY*moved;
                w.traveled+=moved;
                w.gfx.clear();
                this._drawWrenchGfx(w.gfx,time*0.012,false,true);
                w.gfx.x=w.curX; w.gfx.y=w.curY;
                const ctxVal=Math.floor(w.curX/TS), ctyVal=Math.floor(w.curY/TS);
                if((ctxVal!==w.lastTileX||ctyVal!==w.lastTileY)&&this.world[ctxVal]?.[ctyVal]===this.FLOOR){
                    w.lastTileX=ctxVal; w.lastTileY=ctyVal;
                    this._spawnDiamondTile(ctxVal,ctyVal);
                }
                if(time-w.lastTickTime>=120){
                    for(const e of [...this.enemies]){
                        if(!e.sprite?.active||e._isTotem)continue;
                        if(Math.hypot(e.sprite.x-w.curX,e.sprite.y-w.curY)>TS*0.6)continue;
                        w.lastTickTime=time;
                        e.health-=3.5*this.damageScaling; this.updateEnemyHealthBar(e);
                        this._applyEncased(e,2.0);
                        w.hitOutbound.add(e); // remembered for the return-trip crush bonus
                        if(e.health<=0)this.killEnemy(e);
                    }
                }
                const distToTarget=Math.hypot(w.tx-w.curX,w.ty-w.curY);
                const hitWall=this.world[ctxVal]?.[ctyVal]!==this.FLOOR;
                if(distToTarget<TS*0.6||hitWall||w.traveled>TS*40){
                    w.state='returning';
                    const imp=this.add.graphics().setDepth(5.8);
                    imp.x=w.curX; imp.y=w.curY;
                    imp.fillStyle(0xaaeeff,0.8); imp.fillCircle(0,0,TS*0.9);
                    imp.fillStyle(0xffffff,0.6); imp.fillCircle(0,0,TS*0.4);
                    this.tweens.add({targets:imp,scaleX:1.8,scaleY:1.8,alpha:0,duration:250,onComplete:()=>imp.destroy()});
                }
            } else { // returning
                const speed=TS*18;
                const dx=px-w.curX, dy=py-w.curY;
                const dist=Math.hypot(dx,dy)||1;
                if(dist<TS*0.5){
                    // Arrived back at player — done, remove from active throws
                    const dimp=this.add.graphics().setDepth(5.6);
                    dimp.x=px; dimp.y=py;
                    dimp.fillStyle(0xaaeeff,0.6); dimp.fillCircle(0,0,TS*0.5);
                    this.tweens.add({targets:dimp,alpha:0,scaleX:1.5,scaleY:1.5,duration:200,onComplete:()=>dimp.destroy()});
                    w.gfx.destroy();
                    this._diamondThrows.splice(i,1);
                    continue;
                }
                const moved=speed*dt;
                w.curX+=(dx/dist)*moved; w.curY+=(dy/dist)*moved;
                w.gfx.clear();
                this._drawWrenchGfx(w.gfx,time*0.014,false,true);
                w.gfx.x=w.curX; w.gfx.y=w.curY;
                const ctxVal=Math.floor(w.curX/TS), ctyVal=Math.floor(w.curY/TS);
                if((ctxVal!==w.lastTileX||ctyVal!==w.lastTileY)&&this.world[ctxVal]?.[ctyVal]===this.FLOOR){
                    w.lastTileX=ctxVal; w.lastTileY=ctyVal;
                    this._spawnDiamondTile(ctxVal,ctyVal);
                }
                if(time-w.lastTickTime>=120){
                    for(const e of [...this.enemies]){
                        if(!e.sprite?.active||e._isTotem)continue;
                        if(Math.hypot(e.sprite.x-w.curX,e.sprite.y-w.curY)>TS*0.6)continue;
                        w.lastTickTime=time;
                        const wasHitOutbound=w.hitOutbound.has(e);
                        if(wasHitOutbound){
                            // Crushed between the throw and the boomerang — big bonus burst
                            const crushDmg=9*this.damageScaling;
                            e.health-=crushDmg; this.updateEnemyHealthBar(e);
                            this._showFloatingText(e.sprite.x,e.sprite.y-26,'CRUSHED!','#aaeeff');
                            // Visual flash — bright burst distinct from the normal tick hit
                            const cf=this.add.graphics().setDepth(6.2);
                            cf.x=e.sprite.x; cf.y=e.sprite.y;
                            cf.fillStyle(0xffffff,0.9); cf.fillCircle(0,0,TS*0.7);
                            cf.fillStyle(0xaaeeff,0.6); cf.fillCircle(0,0,TS*1.1);
                            for(let s=0;s<5;s++){
                                const sa=s/5*Math.PI*2;
                                cf.lineStyle(2,0xffffff,0.8);
                                cf.lineBetween(0,0,Math.cos(sa)*TS*0.9,Math.sin(sa)*TS*0.9);
                            }
                            this.tweens.add({targets:cf,scaleX:1.8,scaleY:1.8,alpha:0,duration:280,onComplete:()=>cf.destroy()});
                            this.cameras.main.shake(40,0.0015);
                            w.hitOutbound.delete(e); // one crush bonus per enemy per throw
                        } else {
                            e.health-=3.5*this.damageScaling; this.updateEnemyHealthBar(e);
                        }
                        this._applyEncased(e,2.0);
                        if(e.health<=0)this.killEnemy(e);
                    }
                }
            }
        }
    }



    _spawnDiamondTile(tx,ty){
        if(!this._diamondTiles) this._diamondTiles=new Set();
        const key=`${tx},${ty}`;
        if(this._diamondTiles.has(key))return;
        this._diamondTiles.add(key);
        const TS=this.TILE_SIZE, px=tx*TS, py=ty*TS;
        const g=this.add.graphics().setDepth(0.95);
        // Cyan/white diamond tile
        g.fillStyle(0xaaeeff,0.28); g.fillRect(px,py,TS,TS);
        g.fillStyle(0xffffff,0.15); g.fillRect(px+2,py+2,TS-4,TS-4);
        g.lineStyle(1,0xaaeeff,0.7); g.strokeRect(px+0.5,py+0.5,TS-1,TS-1);
        // Diamond shape in center
        const cx2=px+TS/2, cy2=py+TS/2, dr=5;
        g.fillStyle(0xffffff,0.5);
        g.fillTriangle(cx2,cy2-dr,cx2-dr,cy2,cx2,cy2+dr); // left half
        g.fillTriangle(cx2,cy2-dr,cx2+dr,cy2,cx2,cy2+dr); // right half
        g.lineStyle(1,0xffffff,0.4);
        g.lineBetween(cx2-dr,cy2,cx2,cy2-dr); g.lineBetween(cx2,cy2-dr,cx2+dr,cy2);
        g.lineBetween(cx2-dr,cy2,cx2,cy2+dr); g.lineBetween(cx2+dr,cy2,cx2,cy2+dr);
        this.tweens.add({targets:g,alpha:0.4,duration:300+Math.random()*200,yoyo:true,repeat:-1,ease:'Sine.easeInOut'});
        const ticker=this.time.addEvent({delay:150,loop:true,callback:()=>{
            for(const e of this.enemies){
                if(!e.sprite?.active||e._isTotem||e._encased)continue;
                if(Math.floor(e.sprite.x/TS)===tx&&Math.floor(e.sprite.y/TS)===ty)
                    this._applyEncased(e,2.0);
            }
        }});
        this.time.delayedCall(3500,()=>{
            ticker.remove(); this._diamondTiles.delete(key);
            this.tweens.add({targets:g,alpha:0,duration:600,onComplete:()=>g.destroy()});
        });
    }
    _throwWrenchArc(fx,fy,tx,ty,bounces,dx,dy,hopDist){
        this._lastWrenchDirX=dx; this._lastWrenchDirY=dy;
        const TS=this.TILE_SIZE;
        const isGold=this._wrenchTier==='gold'||this._wrenchTier==='diamond';
        if(isGold){
            const WRENCH_DMG=2*this.damageScaling;
            const speed=TS*14;
            const gfx=this.add.graphics().setDepth(5);
            gfx.x=fx; gfx.y=fy;
            const totalDist=Math.hypot(tx-fx,ty-fy)||1;
            const dirNx=(tx-fx)/totalDist, dirNy=(ty-fy)/totalDist;
            let elapsed=0, lastTileX=-1, lastTileY=-1, stopped=false;
            const doImpact=(ix,iy)=>{
                if(stopped)return; stopped=true; timer.remove(); gfx.destroy();
                // Gold impact — bright golden explosion
                const imp=this.add.graphics().setDepth(5.5);
                imp.x=ix; imp.y=iy;
                imp.fillStyle(0xffcc00,0.9); imp.fillCircle(0,0,TS*1.5);
                imp.fillStyle(0xffee88,0.65); imp.fillCircle(0,0,TS*0.85);
                imp.fillStyle(0xffffff,0.55); imp.fillCircle(0,0,TS*0.35);
                this.tweens.add({targets:imp,scaleX:2.2,scaleY:2.2,alpha:0,duration:400,onComplete:()=>imp.destroy()});
                this.cameras.main.shake(60,0.002);
                const splashR=1.5*TS;
                for(const e of [...this.enemies]){
                    if(!e.sprite?.active||e._isTotem)continue;
                    if(Math.hypot(e.sprite.x-ix,e.sprite.y-iy)>splashR)continue;
                    e.health-=WRENCH_DMG; this.updateEnemyHealthBar(e);
                    this._applyEncased(e);
                    if(e.health<=0)this.killEnemy(e);
                }
                if(bounces>0){
                    const nextDist=hopDist*0.55;
                    const nx2=ix+dirNx*nextDist, ny2=iy+dirNy*nextDist;
                    if(this.world[Math.floor(nx2/TS)]?.[Math.floor(ny2/TS)]===this.FLOOR)
                        this._throwWrenchArc(ix,iy,nx2,ny2,bounces-1,dirNx,dirNy,nextDist);
                }
            };
            const timer=this.time.addEvent({delay:16,loop:true,callback:()=>{
                if(stopped)return;
                elapsed+=16;
                const moved=speed*(elapsed/1000);
                gfx.x=fx+dirNx*moved; gfx.y=fy+dirNy*moved;
                this._drawWrenchGfx(gfx,elapsed*0.008,true);
                const ctxVal=Math.floor(gfx.x/TS), ctyVal=Math.floor(gfx.y/TS);
                // Wall hit — stop here
                if(this.world[ctxVal]?.[ctyVal]!==this.FLOOR){ doImpact(gfx.x,gfx.y); return; }
                // Spawn tile as projectile enters each new tile
                if(ctxVal!==lastTileX||ctyVal!==lastTileY){
                    lastTileX=ctxVal; lastTileY=ctyVal;
                    this._spawnGoldenTile(ctxVal,ctyVal);
                }
                // Safety max range 40 tiles
                if(moved>TS*40) doImpact(gfx.x,gfx.y);
            }});
            return;
        }
        // Normal wrench — original arc behavior
        return WeaponSystem.prototype._throwWrenchArc.call(this,fx,fy,tx,ty,bounces,dx,dy,hopDist);
    }
    _drawWrenchGfx(gfx,rotation,isGold=false,isDiamond=false){
        gfx.clear(); gfx.rotation=rotation;
        const handleCol=isDiamond?0x88ddff:isGold?0xffcc00:0xaaaaaa;
        const jawCol=isDiamond?0x44aadd:isGold?0xffaa00:0x888888;
        const highlightCol=isDiamond?0xffffff:isGold?0xffee88:0xdddddd;
        const outlineCol=isDiamond?0x226688:isGold?0xcc8800:0x555555;
        gfx.fillStyle(handleCol,0.95); gfx.fillRect(-2,-9,4,18);
        gfx.fillStyle(jawCol,1); gfx.beginPath(); gfx.arc(0,-9,5,-Math.PI*0.2,Math.PI*1.2,false); gfx.fillPath();
        gfx.lineStyle(1,outlineCol,0.9); gfx.beginPath(); gfx.arc(0,-9,5,-Math.PI*0.2,Math.PI*1.2,false); gfx.strokePath();
        gfx.lineStyle(2,outlineCol,0.7); gfx.lineBetween(-2,-9,-2,-4); gfx.lineBetween(2,-9,2,-4);
        gfx.fillStyle(jawCol,1); gfx.beginPath(); gfx.arc(0,9,4,-Math.PI*0.3,Math.PI*1.3,false); gfx.fillPath();
        gfx.lineStyle(1,outlineCol,0.9); gfx.beginPath(); gfx.arc(0,9,4,-Math.PI*0.3,Math.PI*1.3,false); gfx.strokePath();
        gfx.lineStyle(2,outlineCol,0.7); gfx.lineBetween(-1.5,9,-1.5,6); gfx.lineBetween(1.5,9,1.5,6);
        gfx.lineStyle(1.5,highlightCol,0.7); gfx.lineBetween(-0.5,-12,-0.5,12);
        if(isGold||isDiamond){ gfx.fillStyle(0xffffff,0.8); gfx.fillCircle(-3,-11,1); gfx.fillCircle(3,-7,0.8); gfx.fillCircle(-2,10,0.8); }
        if(isDiamond){ gfx.lineStyle(1,0xffffff,0.6); gfx.lineBetween(-4,-2,4,-2); gfx.lineBetween(0,-6,0,2); }
    }
    _wrenchImpact(px,py,dmg,splashR,stunR){
        const effStunR=this._stunWholeRadius?splashR:stunR;
        const result=WeaponSystem.prototype._wrenchImpact.call(this,px,py,dmg,splashR,effStunR);
        const TS=this.TILE_SIZE;
        // Show STUNNED! on everything the impact just stunned. (Doing it here, tied to the
        // stun application, is reliable — the damage-path text only fires on a damage tick,
        // so a stun landing on a no-damage frame was silently missing its label.)
        if(effStunR>0){
            for(const e of this.enemies){
                if(!e.sprite?.active||e._isTotem)continue;
                if(Math.hypot(e.sprite.x-px,e.sprite.y-py)>effStunR*TS)continue;
                if(e.isStunned && this.time.now<(e.stunnedUntil||0)) this._showStatusHit?.(e,'STUNNED!','#ffee66');
            }
        }
        // Gold: encase enemies in splash radius
        if(this._wrenchTier==='gold'||this._wrenchTier==='diamond'){
            for(const e of this.enemies){
                if(!e.sprite?.active||e._isTotem||e._encased)continue;
                if(Math.hypot(e.sprite.x-px,e.sprite.y-py)>splashR*TS)continue;
                this._applyEncased(e);
            }
        }
        // Diamond: 25% chance to split into 2 wrenches on impact
        if(this._wrenchTier==='diamond'&&Math.random()<0.25){
            const angles=[Math.PI/4,-Math.PI/4];
            for(const ang of angles){
                const cos=Math.cos(ang),sin=Math.sin(ang);
                const dx=this._lastWrenchDirX||1, dy=this._lastWrenchDirY||0;
                const nx=dx*cos-dy*sin, ny=dx*sin+dy*cos;
                const dist=TS*3;
                this._throwWrenchArc(px,py,px+nx*dist,py+ny*dist,0,nx,ny,dist);
            }
        }
        return result;
    }
    _spawnGoldenTile(tx,ty){
        if(!this._goldenTiles) this._goldenTiles=new Set();
        const key=`${tx},${ty}`;
        if(this._goldenTiles.has(key))return;
        this._goldenTiles.add(key);
        const TS=this.TILE_SIZE;
        const px=tx*TS, py=ty*TS;
        const g=this.add.graphics().setDepth(0.95);
        g.fillStyle(0xffcc00,0.35); g.fillRect(px,py,TS,TS);
        g.fillStyle(0xffee44,0.18); g.fillRect(px+2,py+2,TS-4,TS-4);
        g.lineStyle(1,0xffdd44,0.7); g.strokeRect(px+0.5,py+0.5,TS-1,TS-1);
        g.lineStyle(1,0xffffff,0.45); g.lineBetween(px+4,py+TS/2,px+TS-4,py+TS/2);
        g.lineBetween(px+TS/2,py+4,px+TS/2,py+TS-4);
        g.fillStyle(0xffffff,0.5); g.fillCircle(px+TS/2,py+TS/2,2);
        this.tweens.add({targets:g,alpha:0.4,duration:350+Math.random()*200,yoyo:true,repeat:-1,ease:'Sine.easeInOut'});
        const ticker=this.time.addEvent({delay:150,loop:true,callback:()=>{
            for(const e of this.enemies){
                if(!e.sprite?.active||e._isTotem||e._encased)continue;
                if(Math.floor(e.sprite.x/TS)===tx&&Math.floor(e.sprite.y/TS)===ty) this._applyEncased(e);
            }
        }});
        this.time.delayedCall(4000,()=>{
            ticker.remove(); this._goldenTiles.delete(key);
            this.tweens.add({targets:g,alpha:0,duration:600,onComplete:()=>g.destroy()});
        });
    }
    _applyEncased(e,multiplier=1.5){
        if(e._encased)return;
        e._encased=true; e._encasedMult=multiplier;
        const isDiamond=multiplier>=2;
        const col=isDiamond?0xaaeeff:0xffcc00;
        const label=isDiamond?'💎 ENCASED 2×':'✨ ENCASED 1.5×';
        if(e.sprite?.active){
            e.sprite.setTint(col);
            const g=this.add.graphics().setDepth(5);
            g.x=e.sprite.x; g.y=e.sprite.y; // anchor at enemy so scale works correctly
            const r=this.TILE_SIZE*0.55;
            for(let i=0;i<6;i++){
                const ang=i/6*Math.PI*2;
                g.fillStyle(col,0.9); g.fillCircle(Math.cos(ang)*r,Math.sin(ang)*r,2.5);
                g.fillStyle(0xffffff,0.7); g.fillCircle(Math.cos(ang)*r,Math.sin(ang)*r,1);
            }
            this.tweens.add({targets:g,alpha:0,scaleX:1.8,scaleY:1.8,duration:500,onComplete:()=>g.destroy()});
            this._showFloatingText(e.sprite.x,e.sprite.y-20,label,'#'+col.toString(16).padStart(6,'0'));
        }
    }
    // _drawWrenchGfx defined above with gold support
    _showStunIndicator(...a){return WeaponSystem.prototype._showStunIndicator.call(this,...a);}
    _clearStunIndicator(...a){return WeaponSystem.prototype._clearStunIndicator.call(this,...a);}
    showDamageNumber(x,y,n,c){ const t=(typeof n==="number")?String(Math.round(n)):n; this._showFloatingText(x,y,t,c||"#ffffff"); }
    gainUltCharge(){}
    // Stubs for things wrench calls that don't apply in TD
    _destroyEnemyProjectile(...a){ return EnemyManager.prototype._destroyEnemyProjectile.call(this,...a); }
    _fireEnemyProjectile(...a){ return EnemyManager.prototype._fireEnemyProjectile.call(this,...a); }
    getPortalAt(){return null;} damagePortal(){}
    damageEngineerTower(...a)    { return ElementSystem.prototype.destroyEngineerTower ? this._tdDamageEngineerTower(...a) : undefined; }
    _tdDamageEngineerTower(tower,dmg){
        if(!tower||!tower.active)return;
        this._damageTower(tower,dmg); // shared HP/bar/destroy path (no refund on destroy)
    }
    // killEnemy calls these — proxy from their real modules
    _destroyPrefireBeam(...a)   { return EnemyManager.prototype._destroyPrefireBeam.call(this,...a); }
    _destroyChillIndicator(...a){ return WeaponSystem.prototype._destroyChillIndicator.call(this,...a); }
    _clearFreezeVisuals(...a)   { return WeaponSystem.prototype._clearFreezeVisuals.call(this,...a); }
    _triggerShatterBurst(...a)  { return WeaponSystem.prototype._triggerShatterBurst.call(this,...a); }
    _shatterWaterSplash(...a)   { return WeaponSystem.prototype._shatterWaterSplash.call(this,...a); }
    // Splitter children are created inside EnemyManager and pushed straight into
    // this.enemies, so they carry none of TD's metadata (_tdType/_tdDmg). Tag them, or
    // they fall back to the generic 8 base damage and are missing from kill rewards.
    _triggerSplitterDeath(...a){
        const before=this.enemies.length;
        const r=EnemyManager.prototype._triggerSplitterDeath.call(this,...a);
        const waveMult=Math.pow(1.045,(this.wave||1)-1);
        for(let i=before;i<this.enemies.length;i++){
            const c=this.enemies[i];
            if(c&&!c._tdWaveScaled){
                c._tdType='splitter';
                c._tdDmg=this._enemyTables().dmg.splitter;
                // Children use createSplitter's flat tier HP table — apply wave scaling like the
                // parent did. Guard with a dedicated flag (not _tdType, which is already set on
                // children and was making this skip them → children one-tapped at high waves).
                c.health=Math.round(c.health*waveMult); c.maxHealth=Math.round(c.maxHealth*waveMult);
                c._lastTrackedHealth=c.health;
                c._tdWaveScaled=true;
            }
        }
        return r;
    }
    // All EnemyManager internal methods used by updateRangedEnemies and other systems
    _hasLineOfSight(...a)          { return EnemyManager.prototype._hasLineOfSight.call(this,...a); }
    _atkSpd(...a)                  { return LevelManager.prototype._atkSpd.call(this,...a); }
    _cheerEnd(...a)                { return LevelManager.prototype._cheerEnd.call(this,...a); }
    _cheerCfg(...a)                { return LevelManager.prototype._cheerCfg.call(this,...a); }
    _findSniperRepositionTile(enemy,minRange,attackMax){
        if(enemy?._tdStationary)return{x:enemy._pinnedX??enemy.x,y:enemy._pinnedY??enemy.y};
        // TD sniper: the stock dungeon algorithm only ever searches a small radius
        // around the base for a valid firing tile — fine for tiny dungeon rooms, but
        // useless once a sniper is dozens of tiles out near a portal (it finds nothing
        // and just freezes). Instead, walk the real path toward the base and pick the
        // point 'attackMax' steps back from it, so the sniper visibly closes distance
        // and settles into range rather than teleporting or getting stuck.
        if(enemy?._tdType==='sniper'){
            const distToBase=Math.abs(enemy.x-this.baseTileX)+Math.abs(enemy.y-this.baseTileY);
            if(distToBase>attackMax){
                const path=this.findPathBFS(enemy.x,enemy.y,this.baseTileX,this.baseTileY);
                if(path&&path.length>1){
                    const idx=Math.max(1,path.length-1-attackMax);
                    return{x:path[idx].x,y:path[idx].y};
                }
                return null;
            }
            // Already close enough that the normal annulus search (small, local) is fine —
            // e.g. backing off if knocked within minRange.
        }
        return EnemyManager.prototype._findSniperRepositionTile.call(this,enemy,minRange,attackMax);
    }
    _moveSniperStep(enemy,...a){
        if(enemy?._tdStationary)return;
        return EnemyManager.prototype._moveSniperStep.call(this,enemy,...a);
    }
    _spawnPrefireBeam(...a)        { return EnemyManager.prototype._spawnPrefireBeam.call(this,...a); }
    _drawLockedBeam(...a)          { return EnemyManager.prototype._drawLockedBeam.call(this,...a); }
    _updatePrefireBeam(...a)       { return EnemyManager.prototype._updatePrefireBeam.call(this,...a); }
    _fireSniperShotgun(...a)       { return EnemyManager.prototype._fireSniperShotgun.call(this,...a); }
    _fireRicochetArrow(...a)       { return EnemyManager.prototype._fireRicochetArrow.call(this,...a); }
    _fireMortarShot(...a)          { return EnemyManager.prototype._fireMortarShot.call(this,...a); }
    // Rooter tether (TD). A rooter entangles the nearest tower in range with a tendril: while
    // held, the tower fires ~50% slower AND cannot be healed. It holds ONE tower at a time,
    // with a re-tether cooldown, and releases when the rooter dies or the tower leaves range.
    // (Replaces the dungeon's player-pull, which corrupted the base position in TD.)
    _fireRootTendril(){ /* disabled in TD — tether is handled per-frame in _updateRooterTether */ }

    _updateRooterTether(e,time){
        const TS=this.TILE_SIZE;
        const range=(e._tendrilRange||14)*TS;              // longer reach — grabs towers from further
        let t=e._tetherTower;
        // Drop the current tether if the tower died or moved out of range.
        if(t && (!t.active || Math.hypot(t.px-e.sprite.x,t.py-e.sprite.y)>range)){
            this._releaseRooterTether(e);
            t=null;
            e._tetherCdUntil=time+1500; // brief cooldown before it can grab another
        }
        // Acquire a new tether if free and off cooldown.
        if(!t && time>=(e._tetherCdUntil||0) && (e._tetherCount||0)<2){
            let best=null,bd=range;
            for(const tw of (this.towers||[])){
                if(!tw.active||tw._tetheredBy)continue;
                const d=Math.hypot(tw.px-e.sprite.x,tw.py-e.sprite.y);
                if(d<=bd){bd=d;best=tw;}
            }
            if(best){
                e._tetherTower=best; best._tetheredBy=e;
                best._fireRateMult=(best._fireRateMult||1)*2;   // slows non-ES towers (cannon/skyward)
                best._tetherSlow=true;                           // slows ES towers via lastFireTime nudging
                best._healBlocked=true;                          // healers can't touch it
                e._tetherCount=(e._tetherCount||0)+1;
                t=best;
                if(!e._tetherGfx) e._tetherGfx=this.add.graphics().setDepth(3.1);
            }
        }
        // While tethered, delay the tower's shots ~50% by nudging its fire clock forward.
        if(t && t._tetherSlow){
            t.lastFireTime = (t.lastFireTime||0) + (this.game.loop.delta||16)*0.5;
        }
        // TETHER DoT — the tendril drains the tower's HP over time, so a rooter left alone will
        // eventually DESTROY the tower it's latched onto (not just slow it). This is what makes
        // the rooter a real threat: you must kill it or lose the tower.
        if(t && t.active){
            const dt=(this.game.loop.delta||16)/1000;
            const dps=e._tetherDps||3;                       // HP/sec chipped while tethered (chip, not kill)
            this._damageTower(t, dps*dt);
        }
        // Draw the living tendril while held (organic, writhing green rope).
        if(t && e._tetherGfx){
            const g=e._tetherGfx; g.clear();
            const x0=e.sprite.x, y0=e.sprite.y+this.TILE_SIZE*0.28, x1=t.px,y1=t.py; // origin at the slime body (lower half of tile), not tile centre
            const segs=8;
            g.lineStyle(3,0x44ff88,0.85);
            g.beginPath(); g.moveTo(x0,y0);
            for(let s=1;s<=segs;s++){
                const f=s/segs;
                const wob=Math.sin(time*0.008+s*0.9)*4*(1-Math.abs(f-0.5)*2);
                const px=x0+(x1-x0)*f, py=y0+(y1-y0)*f;
                const nx=-(y1-y0), ny=(x1-x0), nl=Math.hypot(nx,ny)||1;
                g.lineTo(px+nx/nl*wob, py+ny/nl*wob);
            }
            g.strokePath();
            // Entangle knot on the tower — pulses red as it drains HP.
            const pulse=0.5+0.3*Math.sin(time*0.012);
            g.fillStyle(0x44ff88,0.5); g.fillCircle(x1,y1,7);
            g.lineStyle(2,0xff4444,pulse); g.strokeCircle(x1,y1,7+pulse*2);
        }
    }

    _releaseRooterTether(e){
        const t=e._tetherTower;
        if(t){
            // The tangle LINGERS: the tower stays slowed for a moment after the rooter dies or
            // lets go, then recovers. So killing the rooter doesn't instantly free the tower —
            // the vines take a few seconds to wither. _updateTetherLinger clears it.
            t._tetherLingerUntil=this.time.now+2500;
            if(t._fireRateMult) t._fireRateMult=t._fireRateMult/2; // undo the fire-rate slow now...
            // ...but keep _tetherSlow ON during the linger so ES towers stay slowed; healing
            // stays blocked too. Both clear when the linger expires.
            if(t._tetheredBy===e) t._tetheredBy=null;
        }
        e._tetherTower=null;
        e._tetherGfx?.clear();
    }
    // Clears lingering tether debuffs once their timer expires (called each frame).
    _updateTetherLinger(time){
        for(const t of (this.towers||[])){
            if(!t?._tetherLingerUntil) continue;
            if(t._tetheredBy){ t._tetherLingerUntil=0; continue; } // re-tethered — linger irrelevant
            if(time>=t._tetherLingerUntil){
                t._tetherSlow=false; t._healBlocked=false; t._tetherLingerUntil=0;
            } else if(t._tetherSlow){
                // still withering — keep the ES slow active during linger
                t.lastFireTime=(t.lastFireTime||0)+(this.game.loop.delta||16)*0.5;
            }
        }
    }
    _rooterGroundThump(){ /* disabled in TD — rooters use the tower tether, not a player root */ }
    _spawnSpeedArrow(...a)         { return EnemyManager.prototype._spawnSpeedArrow.call(this,...a); }
    _berserkerSwing(...a)          { return EnemyManager.prototype._berserkerSwing.call(this,...a); }
    // EMS electromagnetic pulse — disables every turret in a wide radius for 2.5s. Turrets can't
    // fire while disabled (see the _emsDisabledUntil check in the tower-fire paths). A cluster of
    // towers all shut down at once is the threat; killing the EMS before it reaches them is the
    // counter, but its shield makes that hard against burst.
    _emsPulse(px,py,deliberate=false){
        const R=this._emsPulseRadius||(6.5*this.TILE_SIZE);
        // A deliberate SELF-detonation (reached its target) overloads far harder than a death
        // pulse (killed en route): ~5s epicenter stun vs 2.5s. Punishes letting it connect.
        const fullDur=deliberate?(this._emsSelfDetonateDur||5000):(this._emsDisableDur||2500);
        const minDur=this._emsMinDisable||500;     // stun at the very edge (a graze)
        const now=this.time.now;
        let hit=0;
        for(const t of (this.towers||[])){
            if(!t.active)continue;
            const d=Math.hypot(t.px-px,t.py-py);
            if(d<=R){
                // Linear falloff: full lockout up close, brief hiccup at the rim. Rewards the
                // player for spacing towers back, and the EMS for detonating deep in a cluster.
                const dur=minDur+(fullDur-minDur)*(1-d/R);
                t._emsDisabledUntil=Math.max(t._emsDisabledUntil||0, now+dur);
                hit++;
            }
        }
        // Expanding electric ring visual.
        const g=this.add.graphics().setDepth(6);
        g.x=px; g.y=py;
        g.lineStyle(4,0x66ccff,0.9); g.strokeCircle(0,0,R*0.3);
        g.lineStyle(2,0xaaddff,0.6); g.strokeCircle(0,0,R*0.5);
        // crackle spokes
        for(let k=0;k<12;k++){ const a=k*Math.PI/6; g.lineStyle(2,0xcceeff,0.7); g.beginPath(); g.moveTo(Math.cos(a)*R*0.3,Math.sin(a)*R*0.3); g.lineTo(Math.cos(a)*R*0.55,Math.sin(a)*R*0.55); g.strokePath(); }
        this.tweens.add({targets:g,alpha:0,scaleX:3.3,scaleY:3.3,duration:450,onComplete:()=>g.destroy()});
        if(hit>0) this._showFloatingText(px,py-20,`EMP! ${hit} hit`,'#66ccff');
        this.cameras.main.shake(120,0.004);
    }
    // Per-frame EMS shield: a blue barrier that reduces one damage instance by 90%, then drops
    // and regenerates after a cooldown. Lets the fragile EMS survive burst fire long enough to
    // reach a cluster (sustained fire still wears it down between shields — the counterplay).
    _updateEmsShield(e,time){
        if(!e._tdEMS)return;
        if(e._emsShield===undefined){ e._emsShield=true; e._emsShieldCd=e._emsShieldCd||2000; }
        // Regenerate the shield once its cooldown elapses after a break.
        if(!e._emsShield && time>=(e._emsShieldReadyAt||0)){ e._emsShield=true; }
        // Shield bubble visual + icon while up.
        if(e._emsShield && e.sprite?.active){
            if(!e._emsShieldGfx) e._emsShieldGfx=this.add.graphics().setDepth(4.2);
            const g=e._emsShieldGfx; g.clear();
            const r=13+Math.sin(time*0.01)*1.5;
            g.lineStyle(2,0x66ccff,0.85); g.strokeCircle(e.sprite.x,e.sprite.y,r);
            g.lineStyle(1,0xccf0ff,0.5); g.strokeCircle(e.sprite.x,e.sprite.y,r*0.75);
            g.fillStyle(0x66ccff,0.12); g.fillCircle(e.sprite.x,e.sprite.y,r);
        } else if(e._emsShieldGfx){ e._emsShieldGfx.clear(); }
    }
    // Berserker swipe — a 2×3 tile arc of claws in front of the berserker (facing its target).
    // Every tower in that box takes damage; the berserker LIFESTEALS a fraction of total damage
    // dealt, healing itself (which also eases it out of rage). A frenzied bruiser that feeds on
    // your towers — the longer it's swiping, the harder it is to bring down.
    _berserkerSwipe(e,tgt){
        const TS=this.TILE_SIZE;
        const ex=e.sprite.x, ey=e.sprite.y;
        const ang=Math.atan2(tgt.py-ey, tgt.px-ex);
        const dmg=e._bersSwipeDmg||22;
        // Box centre is ~1.5 tiles ahead along the facing; box is 3 wide (perp) × 2 deep (along).
        const cx=ex+Math.cos(ang)*TS*1.5, cy=ey+Math.sin(ang)*TS*1.5;
        const fwdX=Math.cos(ang), fwdY=Math.sin(ang), perpX=-fwdY, perpY=fwdX;
        let dealt=0;
        for(const tw of (this.towers||[])){
            if(!tw.active)continue;
            const rx=tw.px-cx, ry=tw.py-cy;
            const along=Math.abs(rx*fwdX+ry*fwdY), across=Math.abs(rx*perpX+ry*perpY);
            if(along<=TS*1.0 && across<=TS*1.5){        // 2 deep × 3 wide
                const before=tw.hp;
                this._damageTower(tw,dmg);
                dealt+=Math.max(0, before-(tw.hp||0));
            }
        }
        // Lifesteal — heal from damage dealt to towers (capped at maxHealth).
        if(dealt>0){
            const heal=dealt*(e._bersLifesteal||0.6);
            e.health=Math.min(e.maxHealth, e.health+heal);
            this._showFloatingText(ex,ey-18,`+${Math.round(heal)}`,'#ff6688');
        }
        // Claw slash visual — three quick arcs across the swipe box.
        const g=this.add.graphics().setDepth(5);
        g.lineStyle(3,0xff3344,0.9);
        for(let i=-1;i<=1;i++){
            const off=i*TS*0.6;
            const sx=cx+perpX*off-fwdX*TS*0.8, sy=cy+perpY*off-fwdY*TS*0.8;
            const tx2=cx+perpX*off+fwdX*TS*0.8, ty2=cy+perpY*off+fwdY*TS*0.8;
            g.beginPath(); g.moveTo(sx,sy); g.lineTo(tx2,ty2); g.strokePath();
        }
        this.tweens.add({targets:g,alpha:0,duration:220,onComplete:()=>g.destroy()});
    }
    enemyAttackAnimation(...a)     { return EnemyManager.prototype.enemyAttackAnimation.call(this,...a); }
    addCosmicCharge()           {}
    cosmicDropChance            = 0;
    _deathScreenActive          = false;
    updateLightningOrbs(){}
    showStatusText(){}

    // ─── EnemyManager proxies — ALL of them ───────────────────────────────────
    createEnemy(...a){return EnemyManager.prototype.createEnemy.call(this,...a);}
    createRangedEnemy(...a){return EnemyManager.prototype.createRangedEnemy.call(this,...a);}
    createBerserker(...a){return EnemyManager.prototype.createBerserker.call(this,...a);}
    createUpgradedSniper(...a){return EnemyManager.prototype.createUpgradedSniper.call(this,...a);}
    createMortar(...a){return EnemyManager.prototype.createMortar.call(this,...a);}
    createSplitter(...a){return EnemyManager.prototype.createSplitter.call(this,...a);}
    createRooter(...a){return EnemyManager.prototype.createRooter.call(this,...a);}
    createAnchorSlime(x,y,roomIndex){
        // TD-specific: a visible slime body (unlike the main game's pure-anchor-object,
        // which hides the slime sprite entirely) dragging a chained anchor behind it as
        // it walks toward the base — speeds up nearby enemies, slows the player in range.
        const e=EnemyManager.prototype.createAnchorSlime.call(this,x,y,roomIndex);
        // Parent hides the slime and draws an ornate anchor body — drop that; we want a
        // visible slime that simply drags a chain + anchor behind it.
        e._anchorBodyGfx?.destroy(); e._anchorBodyGfx=null;
        e.sprite.setAlpha(1);
        e.sprite.setTint(0x6688aa); // steely blue-grey distinguishes it from basic slimes
        e.sprite.setScale(this.SLIME_SCALE*1.25);
        e._baseScale=this.SLIME_SCALE*1.25;
        // Disable the parent's built-in pulse (it instant-sets full speed + slows the player,
        // neither of which fits TD). We drive our own accelerate-pulse from _updateAnchorDrag.
        e._anchorPulseInterval=999999999;
        e._tdAnchorPulseEvery=1600;   // ms between TD accelerate pulses
        e._tdAnchorLastPulse=0;
        e._tdAnchorStep=0.35;          // speed added per pulse (stacks, then decays)
        e._tdAnchorMax=2.2;            // hard cap on total speed multiplier
        // Small anchor weight at the end of the dragged chain (drawn in the drag updater).
        const drag=this.add.graphics().setDepth(2.3);
        e._anchorDragGfx=drag;
        e._anchorDragPhase=0;
        if(e.healthBarBg?.active)   e.healthBarBg.y   = e.sprite.y-22;
        if(e.healthBarFill?.active) e.healthBarFill.y = e.sprite.y-22;
        return e;
    }
    createHealerTotem(x,y,roomIndex){
        // TD version: a proper healer SLIME (green, visible sprite) with a floating heal
        // cross bobbing above it — not the main game's off-theme stone pillar.
        const e=EnemyManager.prototype.createHealerTotem.call(this,x,y,roomIndex);
        // Kill the stone-pillar graphic and its orb glow; keep the aura ring + heal particles.
        e._totemGfx?.destroy(); e._totemGfx=null;
        e._orbGlow?.destroy();  e._orbGlow=null;
        // Show the slime body, tinted healing-green.
        e.sprite.setAlpha(1);
        e.sprite.setTint(0x44ff99);
        e.sprite.setScale(this.SLIME_SCALE*1.1);
        e._baseScale=this.SLIME_SCALE*1.1;
        // Floating heal cross above the slime.
        const mark=this.add.graphics().setDepth(3);
        e._healSlimeMark=mark;
        e._healSlimePhase=Math.random()*Math.PI*2;
        // Restore the HP bar to sit above the slime (parent moved it up for the pillar).
        if(e.healthBarBg?.active)   e.healthBarBg.y   = e.sprite.y-20;
        if(e.healthBarFill?.active) e.healthBarFill.y = e.sprite.y-20;
        return e;
    }
    _origCreateHealerTotem(...a){return EnemyManager.prototype.createHealerTotem.call(this,...a);}
    updateEnemyHealthBar(enemy){
        if(enemy && enemy._lastTrackedHealth !== undefined){
            let rawDmg = enemy._lastTrackedHealth - enemy.health;
            if(rawDmg > 0){
                // ── CLOAKED = immune ─────────────────────────────────────────────────
                // A cloaked enemy takes NO damage from anything (stray splash, chained
                // bolt, etc.) and shows -0, until it's revealed (which clears _cloaked).
                if(enemy._cloaked){
                    enemy.health=enemy._lastTrackedHealth; // undo
                    if(enemy.sprite?.active) this._showFloatingText(enemy.sprite.x,enemy.sprite.y-18,'-0','#8888aa');
                    return enemy;
                }
                // ── DEMON submerged = invulnerable + untargetable (diving in hell) ────
                if(enemy._demonInvuln||enemy._demonHidden){
                    enemy.health=enemy._lastTrackedHealth; // undo
                    return enemy;
                }
                // ── ANGEL flies → only WISPS can hit it, towers can't ────────────────
                // Tower/bullet damage flows through with _lastDamageFromWisp unset; wisp
                // damage sets it. An angel ignores non-wisp damage entirely.
                if(enemy._turretImmune && !this._lastDamageFromWisp){
                    enemy.health=enemy._lastTrackedHealth; // undo — turrets can't reach a flyer
                    if(enemy.sprite?.active) this._showFloatingText(enemy.sprite.x,enemy.sprite.y-18,'✦','#ffee88');
                    return enemy;
                }
                // ── ENLIGHTENED (under an Angel's ring) → 35% damage reduction ────────
                if(enemy._enlightenedUntil>this.time.now){
                    enemy.health += rawDmg*0.35;      // give back 35% of the hit
                    rawDmg *= 0.65;
                    enemy._lastTrackedHealth = enemy.health;
                }
                // ── TAUNTER redirect (universal) ─────────────────────────────────────
                // Catches EVERY damage source, because they all land here via
                // health-=dmg → updateEnemyHealthBar (wrench, wisps, towers, splash). A
                // protected enemy takes ZERO; the taunter absorbs a share onto itself.
                if(!enemy._tdTaunter && !enemy._isDummy){
                    const taunter=this.enemies.find(t=>t._tdTaunter&&t.sprite?.active&&t!==enemy&&
                        Math.hypot(enemy.sprite.x-t.sprite.x,enemy.sprite.y-t.sprite.y)<t._taunterRadius*this.TILE_SIZE);
                    if(taunter){
                        enemy.health=enemy._lastTrackedHealth;          // undo — protected takes none
                        const absorbed=rawDmg*(taunter._taunterAbsorb??0.5);
                        taunter.health-=absorbed;
                        taunter._lastTrackedHealth=taunter.health;
                        this._taunterAbsorbFx?.(taunter);
                        this._showStatusHit?.(enemy,'PROTECTED!','#ffbb33');
                        // Show the reduced damage the taunter actually took (amber = mitigated).
                        if(taunter.sprite?.active) this._showFloatingText(taunter.sprite.x,taunter.sprite.y-22,`-${Math.round(absorbed)}`,'#ffcc66');
                        if(taunter.health<=0) this.killEnemy(taunter);
                        else if(taunter.sprite?.active) EnemyManager.prototype.updateEnemyHealthBar.call(this,taunter);
                        return enemy;
                    }
                }
                // DPS training dummy — log the raw hit, refund HP so it never dies, and stop
                // here. Returning early deliberately skips the encase / vulnerable / armor
                // multipliers below, so the meter reads pure per-source output instead of
                // buff-inflated numbers.
                if(enemy._isDummy){
                    enemy._dmgLog.push({t:this.time.now,v:rawDmg});
                    enemy._totalDmg+=rawDmg;
                    enemy.health=999999; enemy._lastTrackedHealth=999999;
                    return;
                }
                // EMS SHIELD — a blue barrier that absorbs 90% of ONE damage instance, then
                // breaks and regenerates after a cooldown. Hard-counters burst (a big sniper hit
                // is 90% wasted) but not sustained fire (each bullet pops it, then it's exposed
                // during the ~2s cooldown). This is how the fragile EMS survives to its target.
                if(enemy._tdEMS && enemy._emsShield && rawDmg>0){
                    this._showStatusHit(enemy,'SHIELDED!','#66ccff');
                    if(enemy.sprite?.active) this._showFloatingText(enemy.sprite.x,enemy.sprite.y-18,`-${Math.round(rawDmg*0.1)}`,'#66ccff');
                    // Absorb 90%: heal back most of the applied hit and reduce rawDmg so all the
                    // downstream logic (multipliers, tracking) sees the reduced effective damage.
                    enemy.health = Math.min(enemy.maxHealth, enemy.health + rawDmg*0.90);
                    rawDmg *= 0.10;
                    enemy._lastTrackedHealth = enemy.health;
                    enemy._emsShield=false;                        // shield breaks
                    enemy._emsShieldReadyAt=this.time.now+(enemy._emsShieldCd||2000);
                    if(enemy._emsShieldGfx){ enemy._emsShieldGfx.clear(); }
                }
                // HOLY SHIELD — granted to enemies in an angel ring when a demon dies. Absorbs 90%
                // of the next 2 damage instances, then it's spent.
                if(enemy._holyShieldCharges>0 && rawDmg>0){
                    this._showStatusHit(enemy,'BLESSED!','#ffffaa');
                    enemy.health = Math.min(enemy.maxHealth, enemy.health + rawDmg*0.90);
                    rawDmg *= 0.10;
                    enemy._lastTrackedHealth = enemy.health;
                    enemy._holyShieldCharges--;
                }
                // Big status-hit text so every effect reads clearly when it matters on a hit.
                if(enemy._encased) this._showStatusHit(enemy,'FROZEN!','#99ddff');
                if(enemy._vulnerable && this.time.now<(enemy._vulnerableUntil||0)) this._showStatusHit(enemy,'VULNERABLE!','#ffdd44');
                if(enemy.isStunned && this.time.now<(enemy.stunnedUntil||0)) this._showStatusHit(enemy,'STUNNED!','#ffee66');
                if(enemy.isSlowed && this.time.now<(enemy.slowedUntil||0)) this._showStatusHit(enemy,'SLOWED!','#66ccff');
                if((enemy._shield>0)||(enemy._ceoShield>0)) this._showStatusHit(enemy,'SHIELDED!','#88ccff');
                if(enemy._ceoKnight && enemy._knightArmour>0) this._showStatusHit(enemy,'ARMORED!','#cccccc');
                // Encased enemies take multiplied damage (1.5× gold, 2× diamond) permanently
                if(enemy._encased&&rawDmg>0){
                    enemy.health-=rawDmg*((enemy._encasedMult||1.5)-1);
                }
                // Vulnerable enemies take extra damage (2× base, 3× with Overcharge).
                if(enemy._vulnerable && this.time.now < (enemy._vulnerableUntil||0)){
                    const vm=(enemy._vulnMult||2)-1;   // bonus multiplier on top of the base hit
                    enemy.health -= rawDmg*vm;
                }
                // BRITTLE (from Ice shatter) — the next NON-ICE damage instance is amplified, then
                // the brittle is consumed. Excluding Ice's own damage means Ice can freeze/shatter
                // freely without its lasers wasting the proc — Ice sets up, other sources cash in.
                if(enemy._brittle && rawDmg>0 && !this._lastDamageFromIce){
                    let bm=(enemy._brittleMult||1.75)-1;
                    // SUBZERO capstone — brittle bites harder into ARMOURED enemies.
                    const armoured = enemy._ceoKnight || enemy._knightArmour>0 || enemy._isBulwark || enemy._armour>0;
                    if(this._iceSubzero && armoured){ bm += (this._iceSubzeroBonus||0.75); }
                    enemy.health -= rawDmg*bm;
                    // SHATTERSTORM capstone — brittle survives more than one instance.
                    enemy._brittleLeft=(enemy._brittleLeft||1)-1;
                    if(enemy._brittleLeft<=0){ enemy._brittle=false; enemy._brittleGfx?.clear(); }
                    this._showStatusHit(enemy,'BRITTLE!','#bbeeff');
                    if(enemy.sprite?.active) this._showFloatingText(enemy.sprite.x,enemy.sprite.y-20,'SHATTERED','#cceeff');
                }
                // Possessed enemies take 25% more damage
                if(enemy._possessed && enemy._phantomDmgBonus>0){
                    enemy.health -= rawDmg * enemy._phantomDmgBonus;
                }
                if(enemy._ceoKnight && enemy._knightArmour > 0){
                    // Knight armour is the durable part; the body HP underneath is small.
                    // Normal fire is mostly soaked (only ~35% leaks past). AP rounds bypass the
                    // ABSORPTION — they burn the armour pool at full damage — but they still
                    // have to chew through it, so AP is efficient, not an instant delete.
                    if(enemy._bypassArmour){
                        enemy._knightArmour -= rawDmg;               // full damage to armour pool
                    } else {
                        const eff=enemy._knightArmourEfficiency||0.8;
                        enemy._knightArmour -= rawDmg * eff;
                    }
                    if(enemy._knightArmour < 0) enemy._knightArmour = 0;
                    enemy.health = enemy._lastTrackedHealth;         // body HP untouched while armour holds
                    if(enemy.sprite?.active){
                        const shown=enemy._bypassArmour?rawDmg:rawDmg*(enemy._knightArmourEfficiency||0.8);
                        this._showFloatingText(enemy.sprite.x,enemy.sprite.y-18,`-${Math.round(shown)}`,enemy._bypassArmour?'#ffcc44':'#888888');
                    }
                } else if(!enemy._bypassArmour && enemy._tdCEO && enemy._ceoShield > 0){
                    // Shield absorbs 50% of damage — CEO takes half damage while shielded
                    const shieldHit=rawDmg*0.5;
                    const absorbed=Math.min(enemy._ceoShield, shieldHit);
                    enemy._ceoShield -= absorbed;
                    // Remaining 50% + any shield overflow hits HP
                    const hpDmg=rawDmg*0.5 + (shieldHit - absorbed);
                    enemy.health = enemy._lastTrackedHealth - hpDmg;
                }
                // Show a raw damage number for (nearly) every hit. Light throttle only to
                // avoid literal same-frame duplicate spam — not to hide hits.
                const hpDmg = enemy._lastTrackedHealth - enemy.health;
                if(hpDmg > 0 && enemy.sprite?.active){
                    const now=this.time.now;
                    if(!enemy._lastDmgNum||now-enemy._lastDmgNum>110){
                        enemy._lastDmgNum=now;
                        const pct=hpDmg/enemy.maxHealth;
                        const col=pct>=0.15?'#ff4444':pct>=0.05?'#ffaa44':'#ffdd88';
                        const ox=(Math.random()-0.5)*16;
                        this._showFloatingText(enemy.sprite.x+ox,enemy.sprite.y-14,`-${Math.round(hpDmg)}`,col);
                    }
                }
            }
            enemy._bypassArmour = false;
        }
        enemy._lastTrackedHealth = enemy.health;
        EnemyManager.prototype.updateEnemyHealthBar.call(this, enemy);
        return enemy;
    }


    // Big floating status text ("PROTECTED!", "STUNNED!", …) shown when a status is relevant
    // to a hit. Throttled per-enemy-per-status so rapid fire doesn't spam duplicates.
    _showStatusHit(enemy,text,color){
        if(!enemy?.sprite?.active)return;
        const now=this.time.now;
        enemy._statusHitTimes||(enemy._statusHitTimes={});
        if(now < (enemy._statusHitTimes[text]||0)) return;
        enemy._statusHitTimes[text]=now+700; // one per 0.7s per status label
        const t=this.add.text(enemy.sprite.x,enemy.sprite.y-30,text,
            {fontSize:'17px',fontFamily:UIKit.FONT.title,color,fontStyle:'bold',stroke:'#000',strokeThickness:4})
            .setOrigin(0.5).setDepth(8).setScrollFactor(1);
        this.tweens.add({targets:t,y:t.y-26,alpha:0,scaleX:1.15,scaleY:1.15,duration:800,ease:'Quad.easeOut',onComplete:()=>t.destroy()});
    }

    // ── UNIFIED STATUS ICON SYSTEM ───────────────────────────────────────────────
    // One consistent visual language for every buff/debuff on any unit (enemy or tower).
    // Each active status contributes one small glyph; they render in a row above the unit so
    // the board is readable at a glance ("gold clock = attack slowed" means the same
    // everywhere). Add a new status by listing its flag + draw fn in _statusDefs.
    _statusDefs(){
        // key: [predicate(unit), drawGlyph(g, cx, cy, r, time), tint]
        return this.__statusDefs || (this.__statusDefs = {
            invuln:   { on:u=>u._cloaked||u._invulnerable, color:0xbbccff,
                        draw:(g,x,y,r)=>{ g.lineStyle(2,0xbbccff,0.95); g.strokeCircle(x,y,r*0.7);
                                          g.lineStyle(1.5,0xffffff,0.9); g.beginPath(); g.arc(x,y,r*0.4,0,Math.PI*2); g.strokePath(); } },
            shield:   { on:u=>(u._shield>0)||(u._ceoShield>0), color:0x88ccff,
                        draw:(g,x,y,r)=>{ g.fillStyle(0x88ccff,0.9); g.beginPath();
                                          g.moveTo(x,y-r); g.lineTo(x+r*0.8,y-r*0.4); g.lineTo(x+r*0.8,y+r*0.3);
                                          g.lineTo(x,y+r); g.lineTo(x-r*0.8,y+r*0.3); g.lineTo(x-r*0.8,y-r*0.4);
                                          g.closePath(); g.fillPath(); } },
            armor:    { on:u=>u._ceoKnight&&u._knightArmour>0, color:0xaaaaaa,
                        draw:(g,x,y,r)=>{ g.fillStyle(0x999999,0.95); g.fillRoundedRect(x-r*0.7,y-r*0.7,r*1.4,r*1.4,2);
                                          g.lineStyle(1,0x444444,1); g.strokeRoundedRect(x-r*0.7,y-r*0.7,r*1.4,r*1.4,2);
                                          g.lineBetween(x,y-r*0.7,x,y+r*0.7); } },
            vuln:     { on:u=>u._vulnerable&&this.time.now<(u._vulnerableUntil||0), color:0xffdd44,
                        draw:(g,x,y,r)=>{ g.lineStyle(2,0xffdd44,0.95); // cracked target
                                          g.strokeCircle(x,y,r*0.7); g.lineBetween(x-r*0.5,y-r*0.3,x+r*0.4,y+r*0.5); } },
            encase:   { on:u=>u._encased, color:0x99ddff,
                        draw:(g,x,y,r)=>{ g.lineStyle(1.5,0x99ddff,0.9); // ice cube
                                          g.strokeRect(x-r*0.6,y-r*0.6,r*1.2,r*1.2); g.lineBetween(x-r*0.6,y,x+r*0.6,y); g.lineBetween(x,y-r*0.6,x,y+r*0.6); } },
            stun:     { on:u=>u.isStunned&&this.time.now<(u.stunnedUntil||0), color:0xffee66,
                        draw:(g,x,y,r,t)=>{ g.fillStyle(0xffee66,0.95); // spinning stars
                                          for(let i=0;i<3;i++){ const a=t*0.006+i*(Math.PI*2/3); g.fillCircle(x+Math.cos(a)*r*0.6,y+Math.sin(a)*r*0.4,1.6); } } },
            atkslow:  { on:u=>u._tetherSlow, color:0x66ffaa,
                        draw:(g,x,y,r,t)=>{ g.lineStyle(1.6,0x66ffaa,0.95); g.strokeCircle(x,y,r*0.7); // clock
                                          const ha=t*0.002; g.lineBetween(x,y,x+Math.cos(ha)*r*0.5,y+Math.sin(ha)*r*0.5); } },
            noheal:   { on:u=>u._healBlocked, color:0xff6688,
                        draw:(g,x,y,r)=>{ g.fillStyle(0xff6688,0.9); // heart + slash
                                          g.fillCircle(x-r*0.25,y-r*0.1,r*0.3); g.fillCircle(x+r*0.25,y-r*0.1,r*0.3);
                                          g.fillTriangle(x-r*0.55,y+r*0.05,x+r*0.55,y+r*0.05,x,y+r*0.6);
                                          g.lineStyle(2,0xffffff,1); g.lineBetween(x-r*0.7,y-r*0.7,x+r*0.7,y+r*0.7); } },
            brittle:  { on:u=>u._brittle, color:0xbbeeff,
                        draw:(g,x,y,r,t)=>{ const fl=0.6+0.4*Math.sin(t*0.015); // cracked shard
                                          g.lineStyle(1.5,0xbbeeff,fl);
                                          g.beginPath(); g.moveTo(x,y-r*0.7); g.lineTo(x-r*0.3,y); g.lineTo(x,y+r*0.2); g.lineTo(x+r*0.3,y+r*0.7); g.strokePath();
                                          g.beginPath(); g.moveTo(x-r*0.5,y-r*0.2); g.lineTo(x+r*0.5,y+r*0.1); g.strokePath(); } },
            enlightened:{ on:u=>u._enlightenedUntil>this.time.now, color:0xffee88,
                        draw:(g,x,y,r,t)=>{ // holy sparkle — 4-point star + glow
                                          const fl=0.6+0.4*Math.sin(t*0.01);
                                          g.fillStyle(0xffee88,0.25*fl); g.fillCircle(x,y,r*0.8);
                                          g.fillStyle(0xfff6cc,0.95);
                                          g.fillTriangle(x,y-r*0.8,x-r*0.22,y,x+r*0.22,y);
                                          g.fillTriangle(x,y+r*0.8,x-r*0.22,y,x+r*0.22,y);
                                          g.fillTriangle(x-r*0.8,y,x,y-r*0.22,x,y+r*0.22);
                                          g.fillTriangle(x+r*0.8,y,x,y-r*0.22,x,y+r*0.22); } },
            taunt:    { on:u=>u._taunterProtected&&this.time.now<(u._taunterProtTouch||0)+200, color:0xffbb33,
                        draw:(g,x,y,r)=>{ g.lineStyle(2,0xffbb33,0.9); g.strokeCircle(x,y,r*0.7); // aura link
                                          g.strokeCircle(x,y,r*0.35); } },
            nearsight:{ on:u=>u._nearsightUntil>this.time.now, color:0xcc88ff,
                        draw:(g,x,y,r)=>{ // eye with a slash — vision impaired
                                          g.lineStyle(2,0xcc88ff,0.95); g.strokeCircle(x,y,r*0.7);
                                          g.fillStyle(0xcc88ff,0.9); g.fillCircle(x,y,r*0.28);
                                          g.lineStyle(2,0xffffff,0.9); g.lineBetween(x-r*0.7,y+r*0.5,x+r*0.7,y-r*0.5); } },
            purplefire:{ on:u=>u._purpleFire&&this.time.now<(u._purpleFireUntil||0), color:0xcc44ff,
                        draw:(g,x,y,r,t)=>{ const fl=0.6+0.4*Math.sin(t*0.02); // purple flame
                                          g.fillStyle(0xaa44ff,0.5+0.3*fl); g.fillTriangle(x-r*0.6,y+r*0.5,x+r*0.6,y+r*0.5,x,y-r*0.7);
                                          g.fillStyle(0xee99ff,0.9); g.fillTriangle(x-r*0.3,y+r*0.4,x+r*0.3,y+r*0.4,x,y-r*0.2); } },
            emsdis:   { on:u=>u._emsDisabledUntil>this.time.now, color:0x66ccff,
                        draw:(g,x,y,r,t)=>{ // disabled: crackling bolt with a slash (no power)
                                          const fl=0.6+0.4*Math.sin(t*0.02);
                                          g.lineStyle(2,0x66ccff,fl); g.beginPath();
                                          g.moveTo(x-r*0.3,y-r*0.6); g.lineTo(x+r*0.1,y-r*0.1); g.lineTo(x-r*0.15,y); g.lineTo(x+r*0.3,y+r*0.6); g.strokePath();
                                          g.lineStyle(2,0xff5566,0.9); g.lineBetween(x-r*0.7,y+r*0.7,x+r*0.7,y-r*0.7); } },
            emsshield:{ on:u=>u._tdEMS&&u._emsShield, color:0x66ccff,
                        draw:(g,x,y,r)=>{ g.lineStyle(2,0x66ccff,0.95); g.strokeCircle(x,y,r*0.72);
                                          g.fillStyle(0x66ccff,0.25); g.fillCircle(x,y,r*0.72); } },
        });
    }

    _updateStatusIcons(unit){
        const spr = unit.sprite;
        const ux = spr?.active ? spr.x : unit.px;
        const uy = spr?.active ? spr.y : unit.py;
        const alive = spr ? spr.active : unit.active;
        if(!alive || ux==null){ unit._statusGfx?.setVisible(false); return; }
        const defs = this._statusDefs();
        const active = [];
        for(const key in defs){ try{ if(defs[key].on(unit)) active.push(defs[key]); }catch(_){} }
        if(!active.length){ unit._statusGfx?.setVisible(false); return; }
        if(!unit._statusGfx){ unit._statusGfx = this.add.graphics().setDepth(6.5); }
        const g = unit._statusGfx; g.setVisible(true); g.clear();
        const t = this.time.now;
        const R = 7, GAP = 4, step = R*2+GAP;
        const yTop = uy - (unit._healSlimeMark ? 24 : (spr ? 20 : 22));
        const totalW = active.length*step - GAP;
        let x = ux - totalW/2 + R;
        for(const d of active){
            g.fillStyle(0x000000,0.35); g.fillCircle(x,yTop,R+1.5);
            d.draw(g, x, yTop, R, t);
            x += step;
        }
    }

    // Overheal shown as a distinct GOLD bar above the HP bar. Called EVERY FRAME from the
    // custom-enemy loop (not inside updateEnemyHealthBar, which only fires on damage and so
    // lagged behind moving enemies). Fill is scaled so it can represent a big range (up to
    // ~10× HP) without instantly maxing out — it creeps up as the totem stacks overheal.
    _drawOverheal(enemy){
        if(!enemy.sprite?.active) return;
        const over = enemy.health - enemy.maxHealth;
        if(over <= 0){ enemy._overhealGfx?.setVisible(false); return; }
        // Clamp the green base bar to full so it never stretches past its slot.
        if(enemy.healthBarFill){ enemy.healthBarFill.width = 24; }
        const frac = over / enemy.maxHealth;              // 0..~9 (health capped at 10× below)
        // Log scale: +100% fills ~40% of the bar, +400% ~75%, +900% ~100%. Big range, readable.
        const fill = Math.min(1, Math.log10(1+frac)/Math.log10(10));
        if(!enemy._overhealGfx){
            enemy._overhealGfx = this.add.rectangle(0,0,24,3,0xffcc33,1)
                .setOrigin(0,0.5).setDepth(6.2);
        }
        const g = enemy._overhealGfx;
        g.setVisible(true);
        // Sit directly on top of the health bar (which is at sprite.y), just a few px above it.
        const barX = enemy.sprite.x - 12;
        const barY = (enemy.healthBarBg?.active ? enemy.healthBarBg.y : enemy.sprite.y) - 5;
        g.x = barX; g.y = barY;
        g.width = 24 * fill;
        // Thicker + brighter the more overhealed, so a huge shield reads as "very buffed".
        g.height = 3 + Math.min(3, frac*0.6);
        g.fillColor = (Math.sin(this.time.now*0.006)>0) ? 0xffee66 : 0xffbb22;
    }
    updateRangedEnemies(...a){return EnemyManager.prototype.updateRangedEnemies.call(this,...a);}
    updateEnemyProjectiles(...a){return EnemyManager.prototype.updateEnemyProjectiles.call(this,...a);}
    updateFloorTraps(...a){return EnemyManager.prototype.updateFloorTraps.call(this,...a);}
    _poisonPlayer(...a){return EnemyManager.prototype._poisonPlayer.call(this,...a);}
    _poisonRing(...a){return EnemyManager.prototype._poisonRing.call(this,...a);}
    updateGroundDrops(...a){return EnemyManager.prototype.updateGroundDrops.call(this,...a);}
    moveEnemies(...a){
        this.enemies=this.enemies.filter(e=>e!=null);
        const skip=this.enemies.filter(e=>e._isDummy);
        if(skip.length) this.enemies=this.enemies.filter(e=>!e._isDummy);

        // For fleeing enemies: find the farthest reachable tile from base via BFS,
        // rather than a fixed projected point (which can land in a wall near corners
        // and leave the enemy with no valid path — looking frozen).
        const fleeing=this.enemies.filter(e=>e._fleeing&&e.sprite?.active);
        for(const e of fleeing){
            // Only recompute periodically — BFS is more expensive than a flat projection.
            // Stagger replan times slightly per-enemy so simultaneous possessions don't
            // all replan on the same tick and converge on the same tile.
            if(!e._fleeReplanAt||this.time.now>=e._fleeReplanAt){
                e._fleeReplanAt=this.time.now+550+Math.floor(Math.random()*150);
                if(e._fleeJitterSeed===undefined) e._fleeJitterSeed=Math.random();
                const target=this._findFarthestFleeTile(e.x,e.y,14,e._fleeJitterSeed);
                if(target&&(e._fleeTargetX!==target.x||e._fleeTargetY!==target.y)){
                    e._fleeTargetX=target.x; e._fleeTargetY=target.y;
                    e._committedPath=null; e._pathIndex=undefined;
                }
            }
        }

        // Swap playerX/Y for fleeing enemies by running moveEnemies twice:
        // once for normal enemies, once for fleeing with redirected target
        // Anchored portal bringers don't move (they're pinned dropping portals), so they're
        // excluded from normalEnemies for MOVEMENT — but they must stay in this.enemies or
        // they become un-targetable ghosts that also stop running their portal-drop update.
        const anchoredPB=this.enemies.filter(e=>e._pbAnchored&&e.sprite?.active&&!e._fleeing&&!e._tdBomber);
        const normalEnemies=this.enemies.filter(e=>!e._fleeing&&!(e._pbAnchored)&&!e._tdBomber);
        const fleeingEnemies=this.enemies.filter(e=>e._fleeing&&e.sprite?.active);
        // ── SAPPER behaviour ──────────────────────────────────────────────────
        // Travels toward the base normally. When a tower enters detection range it enters a
        // brief "!" alert pause, then RUSHES the nearest tower at boosted speed. It targets a
        // walkable tile ADJACENT to the tower (the tower's own tile is blocked, so pathing
        // onto it produced no valid step → the sapper froze).
        const bombers=this.enemies.filter(e=>e._tdBomber&&e.sprite?.active&&!e._fleeing);
        const now=this.time.now;
        for(const b of bombers){
            const R=b._bomberDetectR||14;
            let best=null,bd=R+1;
            for(const t of (this.towers||[])){ if(!t.active)continue;
                const d=Math.abs(t.tileX-b.x)+Math.abs(t.tileY-b.y);
                if(d<=R&&d<bd){bd=d;best=t;} }

            if(best){
                // Found a tower. Enter alert state once, pause, then commit to the rush.
                if(b._bomberState!=='alert'&&b._bomberState!=='rush'){
                    b._bomberState='alert';
                    b._bomberAlertUntil=now+700;    // pause with a "!" before charging
                    b._bomberSpeedMult=0.9;         // nearly stopped during the alert
                }
                if(b._bomberState==='alert'&&now>=b._bomberAlertUntil){
                    b._bomberState='rush';
                    b._bomberSpeedMult=0.22;        // ~4.5× speed — terrifying once it commits
                }
                b._bomberTarget=best;
                // Path to a walkable tile next to the tower, not onto it.
                const adj=this._nearestWalkableAdjacent(best.tileX,best.tileY,b.x,b.y);
                var tgtX=adj.x, tgtY=adj.y;
            } else {
                // No tower in range: plain march to base.
                b._bomberState='march';
                b._bomberTarget=null;
                b._bomberSpeedMult=0.6;             // brisk but not the full rush
                var tgtX=this.baseTileX, tgtY=this.baseTileY;
            }
            if(b._bTgtX!==tgtX||b._bTgtY!==tgtY){ b._bTgtX=tgtX; b._bTgtY=tgtY; b._committedPath=null; b._pathIndex=undefined; }
        }

        // Anchor slimes are mobile in TD (unlike the stationary anchor in the main game),
        // but EnemyManager's shared moveEnemies has an early `continue` for isAnchor that
        // skips pathfinding entirely. Temporarily clear the flag so they path normally,
        // then restore it right after so their speed-buff/slow-aura logic still fires.
        const anchorsMoving=normalEnemies.filter(e=>e.isAnchor);
        for(const a2 of anchorsMoving) a2.isAnchor=false;

        if(normalEnemies.length){
            // Clear a waypoint once the enemy is close to its lane bow — from then on it heads
            // to the base normally. Enemies still heading to a bow are grouped by that bow and
            // moved in a batched pass, so the crowd splits across both sub-lanes.
            const toBase=[]; const byWaypoint=new Map();
            for(const e of normalEnemies){
                const wp=e._laneWaypoint;
                if(wp && !e._laneMergeReached){
                    if(Math.abs(e.x-wp.x)+Math.abs(e.y-wp.y)<=3){
                        e._laneMergeReached=true;
                        // Drop the cached path toward the bow — otherwise the enemy keeps
                        // walking the stale committed path into the side pocket ("cubbies")
                        // instead of repathing to the base.
                        e._committedPath=null; e._pathIndex=undefined; e._pathStepsLeft=0;
                        toBase.push(e);
                    }
                    else{ const k=wp.x+','+wp.y; (byWaypoint.get(k)||byWaypoint.set(k,[]).get(k)).push(e); }
                } else toBase.push(e);
            }
            // Base-bound enemies: normal single pass.
            if(toBase.length){ this.enemies=toBase; EnemyManager.prototype.moveEnemies.call(this,...a); }
            // Waypoint groups: one pass each, target swapped to the bow point.
            for(const [k,grp] of byWaypoint){
                const [wx,wy]=k.split(',').map(Number);
                this.enemies=grp;
                const oTX=this._enemyTargetX, oTY=this._enemyTargetY;
                this._enemyTargetX=wx; this._enemyTargetY=wy;
                EnemyManager.prototype.moveEnemies.call(this,...a);
                this._enemyTargetX=oTX; this._enemyTargetY=oTY;
            }
        }

        for(const a2 of anchorsMoving) a2.isAnchor=true;

        // Run a second pass with the flag restored, isolated to just the anchors, so their
        // speed-buff-pulse/player-slow logic (bundled inside the same isAnchor branch we just
        // bypassed for movement) still fires every frame.
        if(anchorsMoving.length){
            this.enemies=anchorsMoving;
            EnemyManager.prototype.moveEnemies.call(this,...a);
        }

        if(fleeingEnemies.length){
            this.enemies=fleeingEnemies;
            for(const e of fleeingEnemies){
                this.enemies=[e];
                const origTX=this._enemyTargetX, origTY=this._enemyTargetY;
                this._enemyTargetX=e._fleeTargetX??origTX;
                this._enemyTargetY=e._fleeTargetY??origTY;
                EnemyManager.prototype.moveEnemies.call(this,...a);
                this._enemyTargetX=origTX; this._enemyTargetY=origTY;
            }
        }

        // Bombers: run each one isolated with its target swapped to its tower (or base).
        if(bombers.length){
            for(const e of bombers){
                this.enemies=[e];
                const origTX=this._enemyTargetX, origTY=this._enemyTargetY;
                this._enemyTargetX=e._bTgtX??origTX;
                this._enemyTargetY=e._bTgtY??origTY;
                EnemyManager.prototype.moveEnemies.call(this,...a);
                this._enemyTargetX=origTX; this._enemyTargetY=origTY;
            }
        }

        this.enemies=[...normalEnemies,...fleeingEnemies,...bombers,...anchoredPB,...skip];
    }
    _findFarthestFleeTile(startX,startY,maxSteps,jitterSeed){
        // BFS outward from the enemy's current tile, bounded by maxSteps for performance.
        // Among all reachable tiles in that radius, return one near the maximum distance
        // from the base — guaranteed walkable/reachable since BFS only visits actual floor
        // tiles, unlike a fixed projected point that can land in a wall near corners.
        const W=this.world.length, H=this.world[0]?.length||0;
        const visited=new Set();
        const queue=[{x:startX,y:startY,steps:0}];
        visited.add(`${startX},${startY}`);
        // Collect all tiles within 1.5 of the max distance found, then pick among them
        // with a per-enemy jitter so multiple fleeing enemies near the same corner don't
        // all converge on the literal same tile and block each other.
        let bestDist=-1;
        const farTiles=[];
        while(queue.length){
            const cur=queue.shift();
            const distFromBase=Math.hypot(cur.x-this.baseTileX,cur.y-this.baseTileY);
            if(distFromBase>bestDist) bestDist=distFromBase;
            farTiles.push({x:cur.x,y:cur.y,dist:distFromBase});
            if(cur.steps>=maxSteps)continue;
            const neighbors=[{x:cur.x,y:cur.y-1},{x:cur.x,y:cur.y+1},{x:cur.x-1,y:cur.y},{x:cur.x+1,y:cur.y}];
            for(const n of neighbors){
                if(n.x<0||n.x>=W||n.y<0||n.y>=H)continue;
                const key=`${n.x},${n.y}`;
                if(visited.has(key))continue;
                if(this.world[n.x]?.[n.y]!==this.FLOOR)continue;
                visited.add(key);
                queue.push({x:n.x,y:n.y,steps:cur.steps+1});
            }
        }
        if(!farTiles.length)return null;
        const candidates=farTiles.filter(t=>t.dist>=bestDist-1.5);
        if(!candidates.length)return farTiles[farTiles.length-1];
        const idx=Math.floor((jitterSeed??Math.random())*candidates.length)%candidates.length;
        return candidates[idx];
    }


    findPathBFS(...a){return EnemyManager.prototype.findPathBFS.call(this,...a);}
    _bfsRun(...a){return EnemyManager.prototype._bfsRun.call(this,...a);}
    reconstructPath(...a){return EnemyManager.prototype.reconstructPath.call(this,...a);}
    getEnemyAt(...a){return EnemyManager.prototype.getEnemyAt.call(this,...a);}
    isNodeAt(){return false;}
    killEnemy(...a){return CombatSystem.prototype.killEnemy.call(this,...a);}
    // Spawn scraps with consolidation — if total > threshold, use large orbs instead
    // Large orbs are worth more per object, reducing clutter and Graphics object count
    spawnOrbScrap(x,y,value=1){
        // Route through our own spawner so we can control value
        this._spawnTDOrb(x,y,value);
    }

    _spawnTDOrb(x,y,value=1){
        const isLarge=value>=5;
        const isMega =value>=20;
        const g=this.add.graphics().setDepth(3.5);
        if(isMega){
            g.fillStyle(0xffaa00,1); g.fillCircle(0,0,9);
            g.fillStyle(0xffdd44,0.85); g.fillCircle(0,0,6.5);
            g.fillStyle(0xffffff,0.6); g.fillCircle(-2,-2,2.5);
            g.lineStyle(2,0xffcc00,0.9); g.strokeCircle(0,0,9);
        } else if(isLarge){
            g.fillStyle(0x44ffaa,1); g.fillCircle(0,0,7);
            g.fillStyle(0x88ffcc,0.8); g.fillCircle(0,0,5);
            g.fillStyle(0xffffff,0.65); g.fillCircle(-1.5,-1.5,2);
            g.lineStyle(1.5,0x00ffcc,0.9); g.strokeCircle(0,0,7);
        } else {
            g.fillStyle(0x00cc88,1); g.fillCircle(0,0,5);
            g.fillStyle(0x00ffaa,0.8); g.fillCircle(0,0,3.5);
            g.fillStyle(0xffffff,0.7); g.fillCircle(-1.5,-1.5,1.5);
            g.lineStyle(1.5,0x00ffcc,0.9); g.strokeCircle(0,0,5);
        }
        g.x=x; g.y=y;
        const landX=x+(Math.random()-0.5)*20;
        const landY=y+6+Math.random()*8;
        const orb={g,landX,landY,attracting:false,tweensKilled:false,_value:value};
        this.orbObjects.push(orb);
        this.tweens.add({targets:g,x:landX,y:y-18,duration:180,ease:'Quad.easeOut',
            onComplete:()=>{
                if(!g.active)return;
                this.tweens.add({targets:g,y:landY,duration:240,ease:'Bounce.easeOut',
                    onComplete:()=>{
                        if(!g.active||orb.attracting)return;
                        this.tweens.add({targets:g,y:landY-2,duration:500,yoyo:true,repeat:-1,ease:'Sine.easeInOut'});
                    }
                });
            }
        });
    }

    updateOrbScraps(){
        // Override ES updateOrbScraps to handle multi-value orbs
        const px=this.player.x,py=this.player.y;
        const attractDist=this.orbPickupRadius*this.TILE_SIZE;
        const now=this.time.now;
        for(let i=this.orbObjects.length-1;i>=0;i--){
            const orb=this.orbObjects[i];
            if(!orb.g?.active){this.orbObjects.splice(i,1);continue;}
            const dx=px-orb.g.x,dy=py-orb.g.y;
            const dist=Math.sqrt(dx*dx+dy*dy);
            if(dist<attractDist&&!orb.attracting){
                orb.attracting=true;
                if(!orb.tweensKilled){this.tweens.killTweensOf(orb.g);orb.tweensKilled=true;}
            }
            if(orb.attracting){
                const speed=Math.min(1,0.12+(attractDist-dist)/attractDist*0.3);
                orb.g.x+=dx*speed;orb.g.y+=dy*speed;
                if(dist<12){
                    const val=orb._value||1;
                    this.orbScraps+=val;
                    this.scraps=this.orbScraps;
                    orb.g.destroy();
                    this.orbObjects.splice(i,1);
                }
            }
        }
    }
    tryDropFromEnemy(e){
        // Clean up custom enemy visuals on death
        e._ceoHitRing?.destroy();
        e._ceoShieldBg?.destroy(); e._ceoShieldFill?.destroy();
        e._knightArmourBg?.destroy(); e._knightArmourFill?.destroy();
        e._taunterAura?.destroy();
        e._pbGfx?.destroy();
        e._gbGfx?.destroy();
        e._infernalBeam?.destroy();
        e._electricalAura?.destroy();
        e._pulseGfx?.destroy();
        e._shieldGfx?.destroy();
        e._healSlimeMark?.destroy();
        e._healerAura?.destroy();
        e._anchorDragGfx?.destroy();
        e._anchorAuraGfx?.destroy();
        e._anchorRocks=null;
        e._anchorRing?.destroy();
        e._particleTimer?.remove();
        e._overhealGfx?.destroy();
        e._lightBrandGfx?.destroy();
        e._lightBrandFire?.destroy();
        e._revealHaloGfx?.destroy();
        e._emsShieldGfx?.destroy();
        e._brittleGfx?.destroy();
        e._iceFrozenGfx?.destroy();
        e._iceMeltEvent?.remove();
        e._demonPortalGfx?.destroy();
        e._demonFlameGfx?.destroy();
        e._demonArrowGfx?.destroy();
        e._hornGfx?.destroy();
        e._angelGfx?.destroy();
        e._angelHealGfx?.destroy();
        // ── PAIRED DEATH TRIGGERS ────────────────────────────────────────────────────
        if(e._tdAngel) this._onAngelDeath(e);
        if(e._tdDemon) this._onDemonDeath(e);
        if(e._tetherTower){ this._releaseRooterTether(e); }
        e._tetherGfx?.destroy();
        e._statusGfx?.destroy();
        e._slowIndTimer?.remove();
        // A sapper ALWAYS explodes when it dies — whether it reached a tower or was shot
        // down en route. So towers/wisps killing one still eat the blast if they're close;
        // you have to kill it early, not just anywhere. _bomberExploded guards against the
        // intentional-detonation path (which already applied damage) re-triggering here.
        if(e._tdBomber&&!e._bomberExploded){
            e._bomberExploded=true;
            if(e._tdEMS){
                // EMS slime — a wide electromagnetic pulse that DISABLES turrets rather than
                // damaging them. Less lethal than the sapper's blast, but shuts down a whole
                // cluster for 2.5s (its shield is how it survives to deliver this).
                this._emsPulse(e.sprite?.x??this.basePx, e.sprite?.y??this.basePy);
            } else {
                this._bomberBlast(e.sprite?.x??this.basePx, e.sprite?.y??this.basePy, e._bomberTowerDmg||90);
            }
        }
        const baseRewards=this._enemyTables().rewards;
        const base=(e._tdType?baseRewards[e._tdType]:2)||2;
        const waveMult=1+this.wave*0.08;
        const total=Math.max(1,Math.round(base*waveMult*(this._scrapMult||1)));
        const ex=e.sprite?.x||this.basePx, ey=e.sprite?.y||this.basePy;

        // Always max 2 orbs regardless of value — kills lag
        if(total<=1){
            this._spawnTDOrb(ex,ey,total);
        } else {
            const half=Math.ceil(total/2);
            this._spawnTDOrb(ex+(Math.random()-0.5)*10, ey+(Math.random()-0.5)*10, half);
            this._spawnTDOrb(ex+(Math.random()-0.5)*10, ey+(Math.random()-0.5)*10, total-half);
        }
        if(!e._isStationary||e._tdType==='sniper'||e._tdType==='ranged') this.enemiesLeft--;
        // Glorps trickle from kills — bigger enemies grant more. Feeds wisp skill trees.
        const glorpVal=this._enemyTables().glorps[e._tdType]||1;
        this.glorps=(this.glorps||0)+glorpVal;
    }
    spawnGroundGlorp(){}  spawnHealthPot(){} spawnUltPot(){} dropGlorps(){}
    updateHUD(){} // suppress main game HUD updates
    _rootPlayer(dur, time){
        // In TD there's no player to root — instead pull the rooter itself toward the base
        // Find the rooter that just fired (closest one to base)
        const rooter = this.enemies.find(e => e.isRooter && e.sprite?.active);
        if(!rooter) return;
        const PULL = 3; // tiles toward base
        const dx = Math.sign(this.baseTileX - rooter.x);
        const dy = Math.sign(this.baseTileY - rooter.y);
        for(let i = 0; i < PULL; i++){
            const nx = rooter.x + dx, ny = rooter.y + dy;
            if(this.world[nx]?.[ny] === this.FLOOR){ rooter.x = nx; rooter.y = ny; }
            else break;
        }
        const tx = rooter.x * this.TILE_SIZE + this.TILE_SIZE/2;
        const ty = rooter.y * this.TILE_SIZE + this.TILE_SIZE/2 + this.SLIME_Y_OFFSET;
        this.tweens.add({targets: rooter.sprite, x: tx, y: ty, duration: 300, ease: 'Quad.easeOut'});
        this._showFloatingText(rooter.sprite.x, rooter.sprite.y - 20, 'DRAGGED!', '#44ff88');
    }
    takeDamage(amt){ this._damageBase(amt||5); }
    getCurrentPlayerRoom(){return -1;}
    cancelNodeChannel(){} _checkRoomNameDisplay(){} _onPlayerStepCrumble(){}
    _isInCrack(){return null;}
    createTsunamiPuddle(){} // EnemyManager calls this on wet tile, no-op in TD
    isInLockedRoom(){return false;}
    // EnemyManager internal functions that need stubs in TD
    _spawnSniperPortal(){} _closeSniperPortal(){}
    _setSpeedIndicator(...a)       { return EnemyManager.prototype._setSpeedIndicator.call(this,...a); }
    _startSpeedIndicator(...a)     { return EnemyManager.prototype._startSpeedIndicator.call(this,...a); }
    _updateBurnStackIndicator(){} _updateChillIndicator(){}
    _singularitySlowed=false; _singularitySlowUntil=0;

    // ─── CombatSystem proxies — ALL of them ──────────────────────────────────
    killEnemy(...a){
        if(a[0]?._isDummy){a[0].health=999999; a[0]._lastTrackedHealth=999999; return;}
        a[0]?._onKillDetonate?.();
        this._killCount=(this._killCount||0)+1;
        try{
            return CombatSystem.prototype.killEnemy.call(this,...a);
        }catch(err){
            // CombatSystem.killEnemy destroys the sprite BEFORE splicing the array. If it
            // throws in between (historically: a missing proxy stub), the enemy survives as
            // an invisible zombie that keeps chipping the base and stalls the wave. Always
            // guarantee removal, and surface the error instead of swallowing it silently.
            console.error('killEnemy failed — force-removing enemy:',err);
            const e=a[0];
            if(e){
                if(e.sprite?.active) e.sprite.destroy();
                const i=this.enemies.indexOf(e);
                if(i!==-1) this.enemies.splice(i,1);
            }
        }
    }
    damageEnemy(...a)            { return CombatSystem.prototype.damageEnemy.call(this,...a); }
    damageEnemyIce(...a)         { return CombatSystem.prototype.damageEnemyIce.call(this,...a); }
    // TDS borrows damageEnemy / damageEnemyIce / _applyIceElementalChill, all three of which now
    // reach the shared chill+cube path. Borrowing a mixin method means adopting its transitive
    // dependencies -- a missing proxy here is a black screen, not a warning.
    makeIceCube(...a)            { return CombatSystem.prototype.makeIceCube.call(this,...a); }
    applyChill(...a)             { return CombatSystem.prototype.applyChill.call(this,...a); }
    _chillCfg(...a)              { return CombatSystem.prototype._chillCfg.call(this,...a); }
    addChillStacks(...a)         { return CombatSystem.prototype.addChillStacks.call(this,...a); }
    _iceCubeCfg(...a)            { return CombatSystem.prototype._iceCubeCfg.call(this,...a); }
    _drawIceCube(...a)           { return CombatSystem.prototype._drawIceCube.call(this,...a); }
    shatterIceCube(...a)         { return CombatSystem.prototype.shatterIceCube.call(this,...a); }
    _clearIceCubeVisual(...a)    { return CombatSystem.prototype._clearIceCubeVisual.call(this,...a); }
    freezeEnemy(...a)            { return CombatSystem.prototype.freezeEnemy.call(this,...a); }
    createFreezeVisual(...a)     { return CombatSystem.prototype.createFreezeVisual.call(this,...a); }
    snapToNearestFloor(...a)     { return CombatSystem.prototype.snapToNearestFloor.call(this,...a); }
    // Reached from resolveElementalHit (borrowed above) on a partially-resisted hit.
    // Latent rather than live today: nothing in TDS carries fireImmune / iceImmune /
    // lightningImmune / elementImmune / resistTrait, so profileOf() returns TABLE.none
    // for every enemy here and the call is gated off. It arms itself the moment one
    // resistant enemy is added -- which is a normal thing to do and would otherwise be
    // a black screen on the damage path. Its only mixin dependency is showStatusText,
    // stubbed just below, so the crest draws and the percentage text stays suppressed.
    _showResistShield(...a)      { return CombatSystem.prototype._showResistShield.call(this,...a); }
    showStatusText()             {} // suppress main-game status texts (ROOTED, etc) in TD
    // Tutorial-only, and deliberately NOT proxied. damageEnemy calls it behind
    // `enemy.iceImmune && this.isIceTutorial`; TDS never sets isIceTutorial, so the
    // real method would bail on its own first line anyway. Stubbing states that here
    // instead of dragging TutorialManager's dialogue chain into this scene for code
    // that cannot run.
    _triggerIceImmuneGlerpReaction() {}
    showShieldBlock()            {}
    gainUltCharge()              {}
    switchToElement()            {}
    updateUltAbsorbers()         {}
    updateBurnEffects()          {}
    updateIgnitionTrails()       {}
    updateSlowEffect()           {}
    updateBrittleDecay()         {}
    updateBrittleVisual()        {}
    _applyIceElementalChill()    {}
    applyBrittle()               {}
    clearBurnVisual()            {}
    showBurnVisual()             {}
    showCannotSwitchText()       {}
    spawnIceSplinter()           {}
    spawnIgnitionTrail()         {}
    _specialHit(e, d)            { return d; }   // no Armored, Shade or plated enemies here
    _leechDie()                  {}              // no Leeches either
    _shotX(...a) { return WeaponSystem.prototype._shotX.call(this,...a); }
    conductorAttack()            {}   // (not in tower defense)
    _shotY(...a) { return WeaponSystem.prototype._shotY.call(this,...a); }
    _clearShot(...a)             { return LevelManager.prototype._clearShot.call(this, ...a); }
    triggerCombustion()          {}
    ignitionExplodeEnemy()       {}
    fireballSplash()             {}
    damageBossAtTile()           {}

    // ─── ElementSystem proxies (tower visuals + fire mechanics) ──────────────
    updateEngineerTowers(time){
        const skipped=[];
        for(let i=this.engineerTowers.length-1;i>=0;i--){
            if(this.engineerTowers[i]._skipESFire){
                skipped.push(this.engineerTowers.splice(i,1)[0]);
            }
        }
        const esDefs=this._engineerTowerDefs();
        const allEnemies=this.enemies;
        for(const tower of this.engineerTowers){
            const def=esDefs[tower.towerType||tower.type];
            if(!def)continue;
            const range=(def.range||5)+(tower._rangeBonus||0)+Math.min(2,this._globalRangeBonus||0); // cap signal boost effect on engineer towers
            this.enemies=allEnemies.filter(e=>{
                if(!e.sprite?.active||e._isTotem)return false;
                return Math.abs(e.x-tower.tileX)+Math.abs(e.y-tower.tileY)<=range;
            });
            const savedRange=def.range;
            def.range=range;
            const allTowers=this.engineerTowers;
            this.engineerTowers=[tower];
            ElementSystem.prototype.updateEngineerTowers.call(this,time);
            this.engineerTowers=allTowers;
            def.range=savedRange;
        }
        this.enemies=allEnemies;
        for(const t of skipped) this.engineerTowers.push(t);
    }
    updateTeslaBolts(...a)        { return ElementSystem.prototype.updateTeslaBolts.call(this,...a); }
    _engineerTowerDefs(...a)      { return ElementSystem.prototype._engineerTowerDefs.call(this,...a); }
    _drawEngineerTowerBody(...a)  { return ElementSystem.prototype._drawEngineerTowerBody.call(this,...a); }
    _fireTeslaCoil(...a)          { return ElementSystem.prototype._fireTeslaCoil.call(this,...a); }
    _spawnTeslaBolt(...a)         { return ElementSystem.prototype._spawnTeslaBolt.call(this,...a); }
    _fireMachineGunBullet(tower,def,enemy){
        // Fixed aim moved to cannon
        if(false){
            // Create a virtual enemy at the fixed angle so ES fires that way
            const range=(def.range+(tower._rangeBonus||0))*this.TILE_SIZE;
            const vx=tower.px+Math.cos(tower._cannonFixedAng)*range;
            const vy=tower.py+Math.sin(tower._cannonFixedAng)*range;
            const virtualEnemy={sprite:{x:vx,y:vy,active:true},x:Math.floor(vx/this.TILE_SIZE),y:Math.floor(vy/this.TILE_SIZE)};
            return ElementSystem.prototype._fireMachineGunBullet.call(this,tower,def,virtualEnemy);
        }
        return ElementSystem.prototype._fireMachineGunBullet.call(this,tower,def,enemy);
    }
    _updateSniperTower(...a)      { return ElementSystem.prototype._updateSniperTower.call(this,...a); }
    _magnetizerPull(...a)         { return ElementSystem.prototype._magnetizerPull.call(this,...a); }
    _flashEngineerTower(...a)     { return ElementSystem.prototype._flashEngineerTower.call(this,...a); }
    _clearSniperTowerWarning(...a){ return ElementSystem.prototype._clearSniperTowerWarning.call(this,...a); }
    _spawnSniperTowerWarning(...a){ return ElementSystem.prototype._spawnSniperTowerWarning.call(this,...a); }
    _drawSniperTowerBeam(...a)    { return ElementSystem.prototype._drawSniperTowerBeam.call(this,...a); }
    _fireSniperTowerBullet(...a)  { return ElementSystem.prototype._fireSniperTowerBullet.call(this,...a); }
    updateEngineerBullets(...a)   { return ElementSystem.prototype.updateEngineerBullets.call(this,...a); }
    // Stubs for ES build UI state — not used in TD but called by internals
    engineerSelectedTowerType     = null;
    _engineerBuildRing            = null;
    _engineerModeLabel            = null;
    updateEngineerBuildUI()       {}
    _redrawEngineerBuildRing()    {}
    clearEngineerBuildRing()      {}
    // Stubs for ElementSystem internals
    _getSuperConductedMultiplier(){ return 1; }
    // REQUIRED: CombatSystem.killEnemy calls this whenever enemy.isSuperConducted is set
    // (WeaponSystem's bounce hits set it, so it IS reachable in TD). Without this stub it
    // threw mid-kill — after sprite.destroy() but BEFORE enemies.splice() — leaving an
    // invisible enemy in this.enemies that kept chipping the base, and aborting the update
    // loop so every other enemy froze.
    clearSuperConduct(...a){ return ElementSystem.prototype.clearSuperConduct.call(this,...a); }
    // Also called from inside moveEnemies. drawLightningBolt is pure VFX and TD-safe.
    // isInCurrentRoom gates dungeon room logic — TD is one open map, so always true.
    drawLightningBolt(...a){ return ElementSystem.prototype.drawLightningBolt.call(this,...a); }
    isInCurrentRoom(){ return true; }
    updateLightningNodeVisuals()  {}
    _isSuperConducted()           { return false; }
    orbObjects                    = [];

    preload(){
        if(!this.textures.exists('slime_green'))  this.load.spritesheet('slime_green',  'assets/Slime_Green_32x32.png',  {frameWidth:32,frameHeight:32});
        if(!this.textures.exists('slime_blue'))   this.load.spritesheet('slime_blue',  'assets/Slime_Blue_32x32.png',  {frameWidth:32,frameHeight:32});
        if(!this.textures.exists('slime_red'))    this.load.spritesheet('slime_red',   'assets/Slime_Red_32x32.png',   {frameWidth:32,frameHeight:32});
        if(!this.textures.exists('slime_orange')) this.load.spritesheet('slime_orange','assets/Slime_Orange_32x32.png',{frameWidth:32,frameHeight:32});
        if(!this.textures.exists('slime_purple')) this.load.spritesheet('slime_purple','assets/Slime_Purple_32x32.png',{frameWidth:32,frameHeight:32});
        if(!this.textures.exists('tiles'))        this.load.spritesheet('tiles','assets/roguelikeDungeon_transparent.png',{frameWidth:17,frameHeight:17});
    }

    create(){
        if(this.time?._heldNow!=null){this._frozenTweens=null;this._freezeClock(false);}   // left through the pause menu last time: the clock is still frozen
        this._pauseMenuOpen=false;
        Music.play(this, 'fracture');
        // ── Reset all upgrade/purchase state ─────────────────────────────────
        this._shopPurchased={};
        this._wrenchTier=undefined;
        this._extraBounces=0;
        this._petDmgMult=1;
        this._petRange=5;
        this._petLightChains=1;
        this._petIceBeams=1;   // Ice's locked identity is SINGLE-target splash-slow support.
        this.pets=[];
        this._ownedWisps=new Set();
        this._equippedWisps=new Set();
        this._wispStamina={};
        this._wispBeds=null;
        this._restingWisps=null;
        this._wispLockoutUntil={};
        this._bedAuraGfx=null;
        this._wispRosterOpen=false; this._wrObjs=[];
        this._dpsTotemList=[];
        this._pinkShield=0;
        this._pinkShieldGfx?.destroy(); this._pinkShieldGfx=null;
        this._overhealBarBg=null; this._overhealBarFill=null;
        this._goldenTiles=null; this._diamondTiles=null;
        this._petIceTiles=null; this._petPoisonTiles=null;
        // Ice water systems (puddles from shatter/melt, and the player's Wake trail).
        this._waterGfx?.destroy(); this._waterGfx=null; this._waterDirty=false;
        this._waterPuddles=[]; this._iceTrail=[];
        this._lastWakeTile=null; this._iceSlipRamp=0; this._iceSlipBonus=0;
        this._cannonFixedAng=undefined; this._cannonFixedDist=undefined;
        this._diamondThrows?.forEach(w=>w.gfx?.destroy());
        this._diamondThrows=[];
        this._voidlets?.forEach(v=>v.gfx?.destroy());
        this._voidlets=[];
        this._lifeAuraLastTick=0;
        this._fireWispMode='single';
        this._gbBullets=[];
        this._miniPortals=[];
        // ── Exact same constants as GameScene ─────────────────────────────────
        this.TILE_SIZE=24; this.TILE_SCALE=1.5; this.SLIME_SCALE=1.2; this.SLIME_Y_OFFSET=-10;
        this.WORLD_WIDTH=120; this.WORLD_HEIGHT=100;
        this.NOTHING=0; this.FLOOR=1; this.WALL=2;
        this.FRAMES={FLOOR:156,WALL_TOP:10,WALL_BOTTOM:10,WALL_LEFT:39,WALL_RIGHT:39,CORNER_TOP_LEFT:12,CORNER_TOP_RIGHT:13,CORNER_BOTTOM_LEFT:40,CORNER_BOTTOM_RIGHT:41,WALL_FILLER:39};
        // WeaponSystem/EnemyManager state
        // damageScaling is what WeaponSystem.engineeringDegreeAttack uses:
        // WRENCH_DMG = 2 * this.damageScaling
        // Set to 3 so wave 1 wrench does 6 dmg → 3-shots a 15HP basic slime
        this.damageScaling=3.0;
        // Mortar shells hit the BASE, not a player with regenerating HP. At 20×3.0=60/shell
        // every 3.2s, 2-3 mortars shredded the base. Tune it down for TD specifically.
        this._mortarShellDamage=22;
        this.statDamageMult=PlayerStats.damageMult(); PlayerStats.startRun(this);   // the damage stat (Stats.js) counts here too; the base takes the hits, so health and armor don't
        this.wrenchDmg=6; // kept in sync for display: wrenchDmg = damageScaling * 2 this.health=100; this.maxHealth=100;
        this.isTutorial=false; this.isLevel2=false; this.isLevel3=false; this.isLevel4=false; this.isLevel6=false;
        this._voidSniperBolts=[]; this.floorTraps=[]; this.groundDrops=[]; this.enemyProjectiles=[];
        this.fireballs=[]; this.iceShards=[]; this.tsunamiFrozenEnemies=[];
        this._magmaStaffFireballCount=0;
        this._magmaHeat=0; this._magmaLastHit=0; this._magmaHeatPrev=0; this._lastKindleTime=0;
        this._kindleIgniteUntil=0; this._kindleIgniteReady=0;
        this._kindleBullets      = [];
        this._kindleMarked       = null;
        this._kindleTarget       = null;
        this._recalcMagmaFireballCount=()=>{};
        this.lastPlayerDamageTime=0; this.playerDamageCooldown=150;
        this.ultChargePerHit=3; this.ultChargePerLightningHit=4;
        this.currentElement='lightning';
        // Stays 'engineering_degree'. That id is dead in the OVERWORLD -- Ball Lightning
        // replaced it there -- but it is how this mode's entire Wrench upgrade tab is wired,
        // and TowerDefenseScene overrides engineeringDegreeAttack to add the Gold/Diamond
        // reforges. Pointing it at ball_lightning disconnected the wrench tree and dispatched
        // to a method this scene does not proxy.
        this.equippedWeapons={lightning:'engineering_degree'};
        this.engineerTowers=[]; this.engineerTowersCrafting=[];
        this.orbScraps=10;
        this.orbPickupRadius=4;
        // Per-wisp skill-tree purchases: { light:{nodeId:tierCount}, ... }.
        // Lives on the scene (not the pet) so it survives equip/unequip. The derived
        // combat values (_lightDmgMult etc.) are mutated cumulatively by each node's
        // eff() at purchase time, mirroring how the tower upgrade tree works.
        this._wispUpgrades={};
        // Mastery resets with the run, matching _wispUpgrades. Delete this line to turn
        // mastery into meta-progression that carries between runs instead.
        this._wispMastery={};
        // Tree node eff() calls mutate these cumulative fields directly, and every one of
        // them initialises with `??` — so without an explicit reset they survived into the
        // next run while _wispUpgrades above went back to empty. That handed the player the
        // accumulated power of last run's tree with every node showing as unpurchased.
        for(const f of ['_lightFlat','_lightDmgAdd','_lightChainLen','_lightJumpRad','_lightCoeff',
                        '_lightExecute','_lightExecThreshold','_lightCascade','_lightInterval','_lightDrain',
                        '_lightMaxStam','_lightBrand','_lightBrandMax','_lightInstant','_lightSolarFlare',
                        '_lightRevealRadius','_lightRevealCd','_lightRevealDur','_lightRevealChain',
                        '_iceFreezeChance','_iceFreezeBonus','_iceWetFreezeBonus','_iceFreezeDur',
                        '_icePuddleSlow','_icePuddleRadius','_icePuddleDur','_iceShatterBrittleR',
                        '_iceWetDur','_iceWetHealCut','_iceFrostbiteDps','_iceCascadeChance','_iceCascadeR',
                        '_iceFlashDmg','_iceFlashFreezeChance','_iceSubzeroBonus','_iceSubzero',
                        '_iceWake','_iceSlipstream','_iceSlipMax','_iceFrostwalker','_iceFlashFreeze',
                        '_iceDeepFreeze','_iceLockTarget','_brittleMult','_brittleCharges']) this[f]=undefined;
        // Glorps: the wisp-progression currency, kept separate from scraps (towers/base/
        // wrench) so wisp skill trees don't compete with your defensive economy. Earned
        // from kills and wave clears.
        this.glorps=20;
        this._endlessMode=false;
        // EnemyManager movement uses playerX/playerY as target — we redirect to base
        // by keeping playerX/playerY always pointing at base (updated in update())
        this.enemies=[];
        this.engineerTowers=[];
        this.engineerTowersCrafting=[];
        this.teslaBolts=[];
        this.engineerBullets=[];  // used by _fireMachineGunBullet and _fireSniperTowerBullet
        this.machineGunBullets=[];
        this.sniperBullets=[];
        this.moveCooldown=150; this.lastMoveTime=0; this.isIdling=true;
        this.pointerX=0; this.pointerY=0;
        this.enemyMoveCooldown=1000; // same as GameScene — controls enemy step rate
        this.lastEnemyMoveTime=0;
        this.idleDelay=500;
        // TD state
        this.towers=[]; this.scraps=10;
        this.wave=0; this.waveActive=false; this.enemiesLeft=0;
        this._waveCompCache=null; // rolled per-wave; must not survive a scene restart
        // Incremented whenever a wave starts or is abandoned. Queued spawn callbacks capture
        // the token and no-op if it has moved on — otherwise a skipped wave's delayedCalls
        // keep spawning enemies into the wave that replaced it.
        this._waveToken=0;
        this.baseHP=500; this.baseMaxHP=500;
        this.playerHP=100; this.playerMaxHP=100;
        this.wrenchDmg=18; this.turretDmgMult=1.0;
        this.tsunamiPuddleDuration=5000;
        this.tsunamiPuddleSlowDuration=1500;
        this._towerCDMult=1.0; this._globalRangeBonus=0;
        this._chainBonus=0; this._pierceBonus=0;
        this._waveBoost=1; this._scrapMult=1; this.shieldPct=0;
        this.baseHealRate=0; this.baseAuras=[];
        this.gameOver=false; this.baseAuras=[]; this.shieldPct=0; this.baseHealRate=0;
        this._powerupTiers={}; this._buildMenuOpen=false; this._upgradeMenuOpen=false; this._placementMode=null;

        // ── World ─────────────────────────────────────────────────────────────
        this.rng=this.createRng(77777);
        this.world=this._genTDLevel();
        if (this._vfxRenderWorld) { this._vfxRenderWorld({ decals: false }); VisualFX.dressTD(this); }
        else this.renderWorld();

        // ── Animations (same as GameScene) ────────────────────────────────────
        const mk=(key,spr,f0,f1)=>{if(!this.anims.exists(key))this.anims.create({key,frames:[{key:spr,frame:f0},{key:spr,frame:f1}],frameRate:2,repeat:-1});};
        mk('idle','slime_blue',0,18); mk('red_idle','slime_red',0,18);
        mk('orange_idle','slime_orange',0,18); mk('purple_idle','slime_purple',0,18);
        mk('green_idle','slime_green',0,18);

        // KEY: enemies path to base tile, not the player
        // _enemyTargetX/Y overrides the moveEnemies target (normally playerX/Y)
        // _enemyActivationRange overrides the dist<20 gate — 999 = always active
        const cr=this._centreRoom;
        this.baseTileX=Math.floor(cr.x+cr.w/2); this.baseTileY=Math.floor(cr.y+cr.h/2);
        this._enemyTargetX=this.baseTileX; this._enemyTargetY=this.baseTileY;
        this._enemyActivationRange=999;
        this.playerX=this.baseTileX; this.playerY=this.baseTileY; // keep in sync for other systems
        this.basePx=this.baseTileX*this.TILE_SIZE+this.TILE_SIZE/2;
        this.basePy=this.baseTileY*this.TILE_SIZE+this.TILE_SIZE/2;
        // Actual player uses _myX/_myY
        this._myX=this.baseTileX; this._myY=this.baseTileY-3;
        this.player=this.add.sprite(this._myX*this.TILE_SIZE+this.TILE_SIZE/2,this._myY*this.TILE_SIZE+this.TILE_SIZE/2+this.SLIME_Y_OFFSET,'slime_blue',0).setScale(this.SLIME_SCALE).setDepth(4);
        this.player.play('idle');
        if (typeof CreatureFX !== 'undefined') CreatureFX.face(this, this.player, { mood: 'friend', look: 'pointer' });   // Creatures.js

        this._buildBaseOverlay();
        this._buildPortalOverlays();
        this._buildGlorpShop();
        this._buildWaveTV();

        // ── Input ─────────────────────────────────────────────────────────────
        this.keys=this.input.keyboard.addKeys({W:Phaser.Input.Keyboard.KeyCodes.W,S:Phaser.Input.Keyboard.KeyCodes.S,A:Phaser.Input.Keyboard.KeyCodes.A,D:Phaser.Input.Keyboard.KeyCodes.D});
        // Q / R are pure toggles: opening a panel now closes any other open panel
        // (see _closeAllPanels), so the old "don't open while X is up" guards are gone.
        // Still suppressed while the pause menu is up, since that's a game-state overlay.
        this.input.keyboard.on('keydown-Q',()=>{if(this._pmActive)return; this._buildMenuOpen?this._closeBuildMenu():this._openBuildMenu();});
        this.input.keyboard.on('keydown-R',()=>{if(this._pmActive)return; this._wispRosterOpen?this._closeWispRoster():this._openWispRoster();});
        this.input.keyboard.on('keydown-ESC',()=>{
            if(this._pmActive){ this._closePauseMenu(); return; }
            if(this._waveTVOpen){ this._closeWaveTV(); return; }
            if(this._devTreeMenuOpen){ this._closeDevWispTreeMenu(); return; }
            if(this._wispTreeOpen){ this._closeWispSkillTree(); return; }
            if(this._wispRosterOpen){ this._closeWispRoster(); return; }
            if(this._glurpShopOpen){ this._closeGlurpShop(); return; }
            if(this._upgradeMenuOpen){ this._closeUpgradeMenu(); return; }
            if(this._buildMenuOpen){ this._closeBuildMenu(); return; }
            if(this._placementMode){ this._cancelPlacement(); return; }
            this._openPauseMenu();
        });
        this.input.keyboard.on('keydown-P',()=>this._pmActive?this._closePauseMenu():this._openPauseMenu());
        this.input.on('pointermove',ptr=>{this.pointerX=ptr.x;this.pointerY=ptr.y;});
        this.input.on('pointerdown',ptr=>{
            this.pointerX=ptr.x; this.pointerY=ptr.y;
            this._onPointerDown(ptr);
            // Poll every 100ms — WeaponSystem's internal _lastWrenchTime gates actual firing
            // so this just ensures we never miss a window due to timer jitter
            this._holdAttackTimer=this.time.addEvent({
                delay:100, loop:true,
                callback:()=>{
                    if(this._buildMenuOpen||this._upgradeMenuOpen||this._placementMode||this._glurpShopOpen)return;
                    this.fireEquippedWeapon(this.pointerX,this.pointerY);
                }
            });
        });
        this.input.on('pointerup',()=>{
            this._holdAttackTimer?.remove();
            this._holdAttackTimer=null;
        });
        this.input.keyboard.on('keydown-E',()=>this._tryInteractGlorp());
        this.input.keyboard.on('keydown-F',()=>this._tryInteractWaveTV());

        // ── DEV MODE ─────────────────────────────────────────────────────────
        this._devMode=true;
        this.input.keyboard.on('keydown-BACKTICK',()=>{
            if(this._devPanelOpen) this._closeDevPanel();
            else this._openDevPanel();
        });

        this.cameras.main.setBounds(0,0,this.WORLD_WIDTH*this.TILE_SIZE,this.WORLD_HEIGHT*this.TILE_SIZE);
        this.cameras.main.startFollow(this.player,true,0.08,0.08);

        this._buildHUD();
        this._buildBuildMenu();

        this.time.delayedCall(2500,()=>this._startNextWave());
        this._showBanner('⚙ ENGINEERING DEFENSE ⚙','#aaddff','Defend the core — Q to build');
    }

    update(time,delta){
        this._vfxUpdateTorches?.(time);   // Visuals.js
        if(this.gameOver||this._pmActive)return;
        this.orbScraps=this.scraps; // sync into ES before it runs
        // Magma heat bleeds here too. Without this call it only ever rises, so the staff
        // would lock at max tier for the rest of the run the first time you reached it.
        this._updateMagmaHeat(time);
        this._updateKindling(time, delta);
        // playerX/playerY permanently = baseTileX/Y so moveEnemies paths to base
        this.moveEnemies();
        this.updateRangedEnemies(time);
        this.updateEnemyProjectiles(delta);
        // Rooter tendrils: restore playerX/Y and redirect pull toward base
        // The pull tendril hit code moves playerX/Y directly — we undo it and
        // instead pull the sourceEnemy (rooter) toward the base
        if(this.playerX!==this.baseTileX||this.playerY!==this.baseTileY){
            // A tendril just modified playerX/Y — find which rooter did it
            // by looking for any rooter with a recently-fired pull tendril
            const rooter=this.enemies.find(e=>e.isRooter&&e.sprite?.active&&
                Math.hypot(e.sprite.x-this.basePx,e.sprite.y-this.basePy)<20*this.TILE_SIZE);
            this.playerX=this.baseTileX; this.playerY=this.baseTileY;
            this.tweens.killTweensOf(this.player);
            this.player.x=this._myX*this.TILE_SIZE+this.TILE_SIZE/2;
            this.player.y=this._myY*this.TILE_SIZE+this.TILE_SIZE/2+this.SLIME_Y_OFFSET;
            // Pull the rooter toward base
            if(rooter){
                const PULL=3;
                const dx=Math.sign(this.baseTileX-rooter.x), dy=Math.sign(this.baseTileY-rooter.y);
                for(let i=0;i<PULL;i++){
                    const nx=rooter.x+dx, ny=rooter.y+dy;
                    if(this.world[nx]?.[ny]===this.FLOOR){rooter.x=nx;rooter.y=ny;}
                    else break;
                }
                const tx=rooter.x*this.TILE_SIZE+this.TILE_SIZE/2;
                const ty=rooter.y*this.TILE_SIZE+this.TILE_SIZE/2+this.SLIME_Y_OFFSET;
                this.tweens.add({targets:rooter.sprite,x:tx,y:ty,duration:300,ease:'Quad.easeOut'});
                this._showFloatingText(rooter.sprite.x,rooter.sprite.y-20,'DRAGGED!','#44ff88');
            }
        }
        this.updateGroundDrops();
        this.updateOrbScraps();    // move orbs toward player, collect on proximity
        this.scraps=this.orbScraps;// sync back — ES increments orbScraps on collect
        this._checkEnemiesAtBase();
        this._movePlayer(time);
        // Show/hide Glorp interact label
        if(this._glorpLabel?.active){
            const dx=Math.abs(this._myX-this._glorpTileX),dy=Math.abs(this._myY-this._glorpTileY);
            this._glorpLabel.setVisible(dx+dy<=3&&!this._glurpShopOpen);
        }
        this._updateTowers(time,delta/1000);
        this._updateLavaTiles(time);
        this._updateCustomEnemies(time,delta/1000);
        this._updateCloakSystem(time);
        this._updateTetherLinger(time);
        this._updateWaterPuddles(time);
        this._updateIceWake(time);
        this._redrawWaterBodies();   // single shared graphics, only redraws when _waterDirty
        this._updatePurpleFire(time,delta/1000);
        this._updateWaveTV(time);
        this._updateTowerChipDamage(time);
        this._updateAuras(time,delta/1000);
        this._lastDamageFromWisp=true;   // damage during pet updates counts as wisp damage
        this._updatePets(time,delta/1000);
        this._lastDamageFromWisp=false;
        this._updateDiamondOrbit(time,delta/1000);
        this._updateVoidlets(time,delta/1000);
        this._updateGhostBullets(time,delta/1000);
        this._updateMiniPortals(time,delta/1000);
        this._updateAnchorDrag(time,delta/1000);
        this._updateLifeWispAura(time,delta/1000);
        this._updatePoisonDot(time);
        this._updateSlowVisuals(time);
        this._updateRestingWisps(time,delta/1000);
        this._updateHUD();
        if(this._wispRosterOpen) this._updateWispRosterLive();
        this._checkWaveEnd();
    }

    // Carve a straight 5-wide corridor between two tile points (H then V, L-shaped).
    _carveCorridor(world,ax,ay,bx,by,hw=2){
        const minX=Math.min(ax,bx),maxX=Math.max(ax,bx);
        for(let x=minX;x<=maxX;x++) for(let o=-hw;o<=hw;o++){
            const ty=ay+o; if(ty>=0&&ty<this.WORLD_HEIGHT) world[x][ty]=this.FLOOR;
        }
        const minY=Math.min(ay,by),maxY=Math.max(ay,by);
        for(let y=minY;y<=maxY;y++) for(let o=-hw;o<=hw;o++){
            const tx=bx+o; if(tx>=0&&tx<this.WORLD_WIDTH) world[tx][y]=this.FLOOR;
        }
    }
    // Straight point-to-point carve (Bresenham) — no L-corner, so no nook bulges off the bend.
    // Used for the branching sub-lanes to keep them clean diagonal runs.
    _carveLine(world,ax,ay,bx,by,hw=1){
        const dx=Math.abs(bx-ax), dy=Math.abs(by-ay);
        const sx=ax<bx?1:-1, sy=ay<by?1:-1;
        let err=dx-dy, x=ax, y=ay;
        const stamp=(cx,cy)=>{ for(let ox=-hw;ox<=hw;ox++) for(let oy=-hw;oy<=hw;oy++){
            const tx=cx+ox, ty=cy+oy;
            if(tx>=0&&tx<this.WORLD_WIDTH&&ty>=0&&ty<this.WORLD_HEIGHT) world[tx][ty]=this.FLOOR; } };
        for(;;){ stamp(x,y); if(x===bx&&y===by)break; const e2=2*err; if(e2>-dy){err-=dy;x+=sx;} if(e2<dx){err+=dx;y+=sy;} }
    }

    // Branching approach: from a portal, split into two sub-lanes that bow out around a
    // central pillar of wall, then rejoin at a merge point just outside the centre room.
    // A blind AoE can only sit on one sub-lane, so enemies always partly slip past it.
    _carveBranchingApproach(world,portal,mergeX,mergeY){
        const px=Math.floor(portal.x+portal.w/2), py=Math.floor(portal.y+portal.h/2);
        // Decide the dominant axis of travel (portal → centre): horizontal or vertical approach.
        const dx=mergeX-px, dy=mergeY-py;
        const horizontal=Math.abs(dx)>=Math.abs(dy);
        const spread=6;   // perpendicular offset between the two parallel lanes
        // Fork point: a short way out from the portal along the travel axis.
        const forkX=Math.round(px+dx*0.30), forkY=Math.round(py+dy*0.30);
        // Stem from the portal to the fork.
        this._carveCorridor(world,px,py,forkX,forkY,1);
        const bows=[];
        for(const s of [1,-1]){
            // Two straight parallel lanes offset perpendicular to travel. Each runs ORTHOGONALLY
            // (one axis then the other) — no diagonals → flat edges, clean split, no notches.
            if(horizontal){
                const laneY=forkY+s*spread;
                // fork → step to lane offset → run across → merge into centre
                this._carveCorridor(world,forkX,forkY,forkX,laneY,1); // short perpendicular step
                this._carveCorridor(world,forkX,laneY,mergeX,laneY,1); // straight across
                this._carveCorridor(world,mergeX,laneY,mergeX,mergeY,1);// into the room
                bows.push({x:Math.round((forkX+mergeX)/2),y:laneY});
            } else {
                const laneX=forkX+s*spread;
                this._carveCorridor(world,forkX,forkY,laneX,forkY,1);
                this._carveCorridor(world,laneX,forkY,laneX,mergeY,1);
                this._carveCorridor(world,laneX,mergeY,mergeX,mergeY,1);
                bows.push({x:laneX,y:Math.round((forkY+mergeY)/2)});
            }
        }
        return {forkX,forkY,mergeX,mergeY,bows};
    }

    _genTDLevel(){
        const W=this.WORLD_WIDTH,H=this.WORLD_HEIGHT;
        const world=[];for(let x=0;x<W;x++){world[x]=[];for(let y=0;y<H;y++)world[x][y]=this.NOTHING;}

        // Large centre room — exactly centred in world
        const cr={x:Math.floor(this.WORLD_WIDTH/2)-16, y:Math.floor(this.WORLD_HEIGHT/2)-12, w:32,h:24};
        this._centreRoom=cr; this.carveRoom(world,cr);
        const cx=cr.x+Math.floor(cr.w/2);
        const cy=cr.y+Math.floor(cr.h/2);

        // Portal rooms — pulled in tighter now that the branching bows are modest (spread 9),
        // so the map isn't oversized with dead space between rooms and centre.
        const defs=[
            {x:cx-32,y:cy-20,w:12,h:10}, // NW
            {x:cx+20,y:cy-20,w:12,h:10}, // NE
            {x:cx-34,y:cy+8, w:12,h:10}, // W
            {x:cx+22,y:cy+8, w:12,h:10}, // E
            {x:cx-8, y:cy+24,w:16,h:10}, // S
        ];
        this._portalRooms=[];
        this._approaches=[];
        for(let di=0; di<defs.length; di++){
            const d=defs[di];
            d.x=Math.max(2,Math.min(W-d.w-2,d.x));
            d.y=Math.max(2,Math.min(H-d.h-2,d.y));
            this.carveRoom(world,d);
            // Merge point: on the centre-room edge nearest this portal.
            const pcx=Math.floor(d.x+d.w/2), pcy=Math.floor(d.y+d.h/2);
            const mergeX=Math.max(cr.x+1,Math.min(cr.x+cr.w-2,pcx));
            const mergeY=Math.max(cr.y+1,Math.min(cr.y+cr.h-2,pcy));
            let a;
            if(di===4){
                // BOTTOM portal: two straight vertical lanes, perfectly MIRRORED around the
                // portal's centre X. Each runs straight up into the centre room — no step-across,
                // so the two entrances are symmetric.
                const off=4;                         // half-distance between the two lanes
                const lx=pcx-off, rx=pcx+off, sy=d.y;
                const mY=cr.y+cr.h-2;                // enter the centre room's bottom edge
                // straight vertical runs (both lanes identical length & shape)
                this._carveCorridor(world,lx,sy,lx,mY,1);
                this._carveCorridor(world,rx,sy,rx,mY,1);
                a={forkX:pcx,forkY:pcy,mergeX,mergeY,bows:[{x:lx,y:Math.round((sy+mY)/2)},{x:rx,y:Math.round((sy+mY)/2)}]};
            } else {
                a=this._carveBranchingApproach(world,d,mergeX,mergeY);
            }
            this._approaches.push(a);
            this._portalRooms.push(d);
        }
        // Small bed room directly above centre room — wisp rest area
        const br={x:cx-12, y:cr.y-9, w:24, h:7};
        br.x=Math.max(2,Math.min(W-br.w-2,br.x));
        br.y=Math.max(2,Math.min(H-br.h-2,br.y));
        this.carveRoom(world,br);
        this.connectRooms(world,cr,br);
        this._bedRoom=br;

        this.addWalls(world);
        this._fillVoidIslands(world);    // remove enclosed void pockets (the center cubby)
        this._sealDeadEndSlots(world);   // then fill any floor dead-end stubs
        this.addWalls(world);            // final re-wall pass
        this.rooms=[cr,...this._portalRooms];
        return world;
    }
    // Fill enclosed VOID islands: a small NOTHING pocket fully surrounded by the walkable area
    // (not connected to the outer void) shows up as a wall-bump "cubby" enemies path around.
    // Flood-fill the OUTER void from the map border; any NOTHING/​WALL tile not reached that sits
    // amid floor is an interior island → convert to FLOOR so the bump disappears.
    _fillVoidIslands(world){
        const W=this.WORLD_WIDTH,H=this.WORLD_HEIGHT;
        const outside=Array.from({length:W},()=>new Uint8Array(H));
        const stack=[];
        for(let x=0;x<W;x++){ for(const y of [0,H-1]){ if(world[x][y]!==this.FLOOR){outside[x][y]=1;stack.push([x,y]);} } }
        for(let y=0;y<H;y++){ for(const x of [0,W-1]){ if(world[x][y]!==this.FLOOR&&!outside[x][y]){outside[x][y]=1;stack.push([x,y]);} } }
        while(stack.length){
            const [x,y]=stack.pop();
            for(const [dx,dy] of [[1,0],[-1,0],[0,1],[0,-1]]){
                const nx=x+dx, ny=y+dy;
                if(nx<0||ny<0||nx>=W||ny>=H||outside[nx][ny])continue;
                if(world[nx][ny]!==this.FLOOR){ outside[nx][ny]=1; stack.push([nx,ny]); }
            }
        }
        // Interior islands = non-floor tiles the exterior flood didn't reach. Group them into
        // connected components; fill ONLY small compact blobs (cubbies). A deliberate lane-divider
        // pillar between two split corridors is long & thin (or large) → left intact so branching
        // survives.
        const seen=Array.from({length:W},()=>new Uint8Array(H));
        let filled=0;
        for(let x=1;x<W-1;x++) for(let y=1;y<H-1;y++){
            if(world[x][y]===this.FLOOR||outside[x][y]||seen[x][y])continue;
            // BFS this island component
            const comp=[]; const q=[[x,y]]; seen[x][y]=1;
            let minX=x,maxX=x,minY=y,maxY=y;
            while(q.length){
                const [cx,cy]=q.pop(); comp.push([cx,cy]);
                minX=Math.min(minX,cx);maxX=Math.max(maxX,cx);minY=Math.min(minY,cy);maxY=Math.max(maxY,cy);
                for(const [dx,dy] of [[1,0],[-1,0],[0,1],[0,-1]]){
                    const nx=cx+dx, ny=cy+dy;
                    if(nx<0||ny<0||nx>=W||ny>=H||seen[nx][ny])continue;
                    if(world[nx][ny]!==this.FLOOR && !outside[nx][ny]){ seen[nx][ny]=1; q.push([nx,ny]); }
                }
            }
            const bw=maxX-minX+1, bh=maxY-minY+1;
            const longSide=Math.max(bw,bh), shortSide=Math.min(bw,bh);
            // Cubby = small AND compact. Keep anything that's large or elongated (a lane divider).
            const isCubby = comp.length<=8 && longSide<=4 && shortSide<=3;
            if(isCubby){ for(const [cx,cy] of comp){ world[cx][cy]=this.FLOOR; } filled+=comp.length; }
        }
        return filled;
    }
    // Seal dead-end nooks: any FLOOR tile walled on 3+ orthogonal sides is a dead-end an enemy
    // can only detour INTO and back out of — never a through-path. Fill it, and repeat, so a
    // whole slot erodes back to the corridor mouth. Room interiors are protected (they have open
    // neighbours), so this only bites corridor stubs and the little wall-enclosed notches.
    _sealDeadEndSlots(world){
        const W=this.WORLD_WIDTH,H=this.WORLD_HEIGHT;
        const inRoom=(x,y)=>{
            for(const r of [this._centreRoom,this._bedRoom,...(this._portalRooms||[])]){
                if(r&&x>=r.x-1&&x<r.x+r.w+1&&y>=r.y-1&&y<r.y+r.h+1) return true;
            }
            return false;
        };
        for(let pass=0; pass<12; pass++){
            let filled=0;
            for(let x=1;x<W-1;x++) for(let y=1;y<H-1;y++){
                if(world[x][y]!==this.FLOOR || inRoom(x,y)) continue;
                let walls=0;
                if(world[x+1][y]!==this.FLOOR)walls++;
                if(world[x-1][y]!==this.FLOOR)walls++;
                if(world[x][y+1]!==this.FLOOR)walls++;
                if(world[x][y-1]!==this.FLOOR)walls++;
                if(walls>=3){ world[x][y]=this.NOTHING; filled++; } // dead-end stub → seal it
            }
            if(!filled) break;
        }
    }

    _buildBaseOverlay(){
        const TS=this.TILE_SIZE,cr=this._centreRoom;
        const cx=Math.floor((cr.x+cr.w/2))*TS+TS/2;
        const cy=Math.floor((cr.y+cr.h/2))*TS+TS/2;
        this.basePx=cx; this.basePy=cy;
        this._auraGfx=this.add.graphics().setDepth(0.4);

        const g=this.add.graphics().setDepth(0.6);
        const S=TS; // 1 tile = 24px

        // ── Step 3 (outermost) — broad base platform ──────────────────────────
        const s3W=S*5, s3H=S*4;
        g.fillStyle(0x2a2a35,0.9);
        g.fillRect(cx-s3W/2,cy-s3H/2,s3W,s3H);
        g.lineStyle(1,0x3a3a4a,0.8);
        g.strokeRect(cx-s3W/2,cy-s3H/2,s3W,s3H);

        // ── Step 2 — mid platform ─────────────────────────────────────────────
        const s2W=S*4, s2H=S*3;
        g.fillStyle(0x323240,0.95);
        g.fillRect(cx-s2W/2,cy-s2H/2,s2W,s2H);
        g.lineStyle(1,0x4a4a5a,0.7);
        g.strokeRect(cx-s2W/2,cy-s2H/2,s2W,s2H);

        // ── Step 1 — altar top ────────────────────────────────────────────────
        const s1W=S*3, s1H=S*2;
        g.fillStyle(0x3a3a50,1);
        g.fillRect(cx-s1W/2,cy-s1H/2,s1W,s1H);
        g.lineStyle(1.5,0x5a5a7a,0.9);
        g.strokeRect(cx-s1W/2,cy-s1H/2,s1W,s1H);

        // ── Stone edge highlights (carved look) ───────────────────────────────
        g.lineStyle(1,0x6a6a8a,0.4);
        g.lineBetween(cx-s1W/2+2,cy-s1H/2+2, cx+s1W/2-2,cy-s1H/2+2); // top edge
        g.lineBetween(cx-s1W/2+2,cy-s1H/2+2, cx-s1W/2+2,cy+s1H/2-2); // left edge

        // ── 4 corner pillars ─────────────────────────────────────────────────
        const pillarPositions=[
            {x:cx-s2W/2+4, y:cy-s2H/2+4},  // TL
            {x:cx+s2W/2-12,y:cy-s2H/2+4},  // TR
            {x:cx-s2W/2+4, y:cy+s2H/2-12}, // BL
            {x:cx+s2W/2-12,y:cy+s2H/2-12}, // BR
        ];
        for(const p of pillarPositions){
            g.fillStyle(0x28283a,1); g.fillRect(p.x,p.y,8,8);         // pillar base
            g.fillStyle(0x44445a,1); g.fillRect(p.x+1,p.y+1,6,6);     // pillar body
            g.fillStyle(0x6666aa,0.6); g.fillRect(p.x+2,p.y+2,4,4);   // pillar cap glow
            g.lineStyle(1,0x8888cc,0.4); g.strokeRect(p.x,p.y,8,8);
        }

        // ── Rune carvings on altar top ────────────────────────────────────────
        g.lineStyle(1,0x4455aa,0.5);
        // Left rune
        g.beginPath(); g.moveTo(cx-S+2,cy-6); g.lineTo(cx-S+2,cy+6); g.strokePath();
        g.beginPath(); g.moveTo(cx-S-4,cy); g.lineTo(cx-S+8,cy); g.strokePath();
        // Right rune
        g.beginPath(); g.moveTo(cx+S-2,cy-6); g.lineTo(cx+S-2,cy+6); g.strokePath();
        g.beginPath(); g.moveTo(cx+S-8,cy); g.lineTo(cx+S+4,cy); g.strokePath();

        // ── Crystal housing ───────────────────────────────────────────────────
        g.fillStyle(0x1a1a2e,1); g.fillRect(cx-7,cy-10,14,16);         // housing base
        g.lineStyle(1.5,0x334466,0.8); g.strokeRect(cx-7,cy-10,14,16);
        // Crystal facets
        const cx2=cx, cy2=cy-2;
        g.fillStyle(0x3366cc,0.8);
        g.fillTriangle(cx2,cy2-8, cx2-5,cy2+2, cx2+5,cy2+2);           // upper facet
        g.fillStyle(0x5588ee,0.6);
        g.fillTriangle(cx2,cy2-8, cx2-5,cy2+2, cx2,cy2-2);             // left highlight
        g.fillStyle(0x2244aa,0.9);
        g.fillTriangle(cx2-5,cy2+2, cx2+5,cy2+2, cx2,cy2+6);           // lower facet
        g.lineStyle(1,0x88aaff,0.7);
        g.beginPath(); g.moveTo(cx2,cy2-8); g.lineTo(cx2-5,cy2+2); g.lineTo(cx2,cy2+6); g.lineTo(cx2+5,cy2+2); g.closePath(); g.strokePath();

        // ── Pulsing crystal glow ──────────────────────────────────────────────
        const orb=this.add.graphics().setDepth(2);
        this.time.addEvent({delay:32,loop:true,callback:()=>{
            if(!orb.active)return; orb.clear();
            const t=this.time.now*0.002, r=6+Math.sin(t)*2;
            orb.fillStyle(0x3366cc,0.07+0.04*Math.sin(t)); orb.fillCircle(cx,cy-2,r*3);
            orb.fillStyle(0x5599ff,0.18+0.08*Math.sin(t*1.3)); orb.fillCircle(cx,cy-2,r*1.6);
            orb.fillStyle(0xaaccff,0.45); orb.fillCircle(cx,cy-2,r*0.8);
            orb.fillStyle(0xffffff,0.9); orb.fillCircle(cx,cy-2,r*0.25);
        }});

        // ── HP bar ────────────────────────────────────────────────────────────
        this._baseHpBg  =this.add.rectangle(cx,cy-s3H/2-10,84,8,0x000000,0.8).setDepth(5);
        this._baseHpFill=this.add.rectangle(cx-40,cy-s3H/2-10,80,5,0x4477ff,1).setDepth(5.1).setOrigin(0,0.5);
        this.add.text(cx,cy-s3H/2-22,'THE CORE',{fontSize:'11px',fontFamily:UIKit.FONT.title,fontStyle:'bold',color:'#b8c8ff',stroke:'#05060a',strokeThickness:3,resolution:2}).setOrigin(0.5).setDepth(5.1);
        // Pink overheal bar — sits above HP bar
        this._overhealBarBg=this.add.rectangle(cx,cy-s3H/2-20,84,5,0x000000,0.7).setDepth(5);
        this._overhealBarFill=this.add.rectangle(cx-40,cy-s3H/2-20,0,4,0xff44aa,1).setDepth(5.1).setOrigin(0,0.5);
        this._overhealBarBg.setVisible(false); this._overhealBarFill.setVisible(false);
    }

    _buildPortalOverlays(){
        const TS=this.TILE_SIZE;
        this._portalGfx=this._portalRooms.map(r=>({gfx:this.add.graphics().setDepth(1.5),px:(r.x+r.w/2)*TS,py:(r.y+r.h/2)*TS}));
        this.time.addEvent({delay:48,loop:true,callback:()=>{if(this.gameOver)return;this._portalGfx.forEach((p,i)=>{const pulse=Math.sin(this.time.now*0.003+i*1.2)*0.5+0.5,g=p.gfx,r=18;g.clear();g.fillStyle(0x8800ff,0.10+0.08*pulse);g.fillCircle(p.px,p.py,r*2);g.lineStyle(2.5,0xaa44ff,0.65+0.3*pulse);g.strokeCircle(p.px,p.py,r);g.fillStyle(0x6600cc,0.85);g.fillCircle(p.px,p.py,r*0.7);g.fillStyle(0xcc88ff,0.5+0.3*pulse);g.fillCircle(p.px,p.py,r*0.35);g.fillStyle(0xffffff,0.4*pulse);g.fillCircle(p.px,p.py,r*0.14);});}});
    }

    // ─── PLAYER MOVEMENT (same tile-stepping as GameScene) ────────────────────
    _buildGlorpShop(){
        const TS=this.TILE_SIZE,cr=this._centreRoom;
        const gx=(cr.x+Math.floor(cr.w/2))*TS+TS/2;
        const gy=(cr.y+2)*TS+TS/2 - TS/2;
        this._glorpTileX=cr.x+Math.floor(cr.w/2);
        this._glorpTileY=cr.y+2;

        // Table
        const table=this.add.graphics().setDepth(1.5);
        table.fillStyle(0x5c3a1e,1); table.fillRect(gx-32,gy+6,64,14);
        table.fillStyle(0x7a4f2a,1); table.fillRect(gx-30,gy+4,60,5);
        table.fillStyle(0x3a2010,1); table.fillRect(gx-28,gy+18,8,12); table.fillRect(gx+20,gy+18,8,12);
        // Items on table
        table.fillStyle(0xffdd44,0.9); table.fillCircle(gx-14,gy+1,4);
        table.fillStyle(0x44aaff,0.8); table.fillRect(gx+4,gy-2,7,7);
        table.fillStyle(0xff6644,0.8); table.fillCircle(gx+16,gy+2,3);

        // Glurp — green slime, bigger
        if(!this.textures.exists('slime_green'))
            this.load.spritesheet('slime_green','assets/Slime_Green_32x32.png',{frameWidth:32,frameHeight:32});
        if(!this.anims.exists('green_idle'))
            this.anims.create({key:'green_idle',frames:[{key:'slime_green',frame:0},{key:'slime_green',frame:18}],frameRate:2,repeat:-1});

        this._glorpNPC=this.add.sprite(gx,gy+this.SLIME_Y_OFFSET,'slime_green',0).setScale(this.SLIME_SCALE*1.2).setDepth(2);
        this._glorpNPC.play('green_idle');
        if (typeof CreatureFX !== 'undefined') CreatureFX.face(this, this._glorpNPC, { mood: 'friend' });   // Creatures.js

        this.add.text(gx,gy-38,'GLURP',{fontSize:'11px',fontFamily:UIKit.FONT.title,fontStyle:'bold',color:'#9aff8a',stroke:'#05060a',strokeThickness:3,resolution:2}).setOrigin(0.5).setDepth(3);

        this._glorpLabel=this.add.text(gx,gy-52,'[E] Shop',{
            fontSize:'10px',fontFamily:'monospace',color:'#ffdd88',
            stroke:'#000',strokeThickness:2,backgroundColor:'#00000088',padding:{x:4,y:2}
        }).setOrigin(0.5).setDepth(6).setVisible(false);

        // Pulse ring
        const ring=this.add.graphics().setDepth(1.4);
        this.time.addEvent({delay:48,loop:true,callback:()=>{
            if(!ring.active)return; ring.clear();
            const t=this.time.now*0.002;
            ring.lineStyle(1.5,0x44ff88,0.25+0.15*Math.sin(t));
            ring.strokeCircle(gx,gy,24+3*Math.sin(t));
        }});
    }

    _tryInteractGlorp(){
        if(this._buildMenuOpen||this._upgradeMenuOpen||this._glurpShopOpen||this._powerupPending)return;
        const dx=Math.abs(this._myX-this._glorpTileX),dy=Math.abs(this._myY-this._glorpTileY);
        if(dx+dy<=3)this._openGlurpShop();
    }

    _openGlurpShop(){
        if(this._glurpShopOpen)return;
        this._closeAllPanels('shop');
        this._glurpShopOpen=true;
        if(!this._shopPurchased)this._shopPurchased={};

        const catalogue=this._buildShopCatalogue();
        this._openGlurpShopUI(catalogue);
    }

    _buildShopCatalogue(){
        return [
            // ── WRENCH ───────────────────────────────────────────────────────
            {
                id:'wrench_dmg', tab:'Wrench', icon:'🔧', name:'Wrench +1', maxTier:50,
                costFn: t=>Math.round(10 + t*8 + Math.pow(t,1.6)*2),   // 10, 20, 35, 55... ~800 at T50
                descFn: t=>`+1 dmg per hit  (now: ${Math.round(this.damageScaling*2)+1})`,
                eff: ()=>{ this.damageScaling+=0.5; this.wrenchDmg=Math.round(this.damageScaling*2); }
            },
            {
                id:'wrench_bounce', tab:'Wrench', icon:'↩', name:'Extra Bounce', maxTier:3,
                costFn: t=>[40,120,280][t]||999,
                descFn: t=>`Wrench bounces ${t+1} extra time${t>0?'s':''} (${4+t} total impacts)`,
                eff: ()=>{ this._extraBounces=(this._extraBounces||0)+1; }
                // Note: WeaponSystem hardcodes TOTAL_BOUNCES=3. We patch it via override below.
            },
            {
                id:'wrench_range', tab:'Wrench', icon:'🎯', name:'Long Arm', maxTier:1,
                costFn: t=>60,
                descFn: t=>`+5 tile throw range (13 tiles total)`,
                eff: ()=>{ this._wrenchRangeBonus=5; }
            },
            {
                id:'wrench_speed', tab:'Wrench', icon:'⚡', name:'Quick Release', maxTier:10,
                // Goes from 1500ms base down to ~750ms at T10 (double speed)
                costFn: t=>Math.round(25 + t*30 + Math.pow(t,1.8)*5),  // 25,60,110,170... ~800 at T10
                descFn: t=>{ const cd=Math.round(1500-t*75); return `-75ms cooldown (now: ${cd}ms)`; },
                eff: ()=>{ this._wrenchCDBonus=(this._wrenchCDBonus||0)+75; }
            },
            {
                id:'wrench_gold', tab:'Wrench', icon:'🌟', name:'Gold Wrench', maxTier:1,
                costFn: t=>300,
                descFn: t=>`Reforge into Gold Wrench — your choice of bonus`,
                eff: ()=>{ this._wrenchTier='gold'; this._showBanner('⭐ GOLD WRENCH ⭐','#ffdd44','Golden trail — enemies hit or walking on tiles get ENCASED: 1.5× damage permanently'); }
            },
            {
                id:'wrench_diamond', tab:'Wrench', icon:'💎', name:'Diamond Wrench', maxTier:1,
                costFn: t=>800,
                descFn: t=>`Pierces to your cursor and boomerangs back — enemies hit on BOTH legs get crushed for massive bonus damage`,
                eff: ()=>{ this._wrenchTier='diamond'; this._showBanner('💎 DIAMOND WRENCH 💎','#aaeeff','Pierces to cursor and boomerangs back!'); }
            },
            {
                id:'wrench_stun_radius', tab:'Wrench', icon:'💫', name:'Stun Zone', maxTier:1,
                costFn: t=>600,
                descFn: t=>`Every enemy in the full splash radius is stunned on hit`,
                eff: ()=>{ this._stunWholeRadius=true; }
            },
            // ── TOWERS ───────────────────────────────────────────────────────
            {
                id:'turret_dmg', tab:'Towers', icon:'⚡', name:'Overclock', maxTier:20,
                costFn: t=>Math.round(15 + t*12 + Math.pow(t,1.5)*3),
                descFn: t=>`+8% all turret damage (now: ${Math.round((1+(t*0.08))*100)}%)`,
                eff: ()=>{ this.turretDmgMult+=0.08; }
            },
            {
                id:'tower_range', tab:'Towers', icon:'📡', name:'Signal Boost', maxTier:5,
                costFn: t=>[20,45,90,180,350][t]||999,
                descFn: t=>`+1 tile range all towers`,
                eff: ()=>{
                    this._globalRangeBonus++;
                    // Update range rings on all existing towers
                    const TS=this.TILE_SIZE;
                    for(const t of this.towers){
                        t._rangeBonus=(t._rangeBonus||0)+1;
                        const def=this._towerDefs()[t.type];
                        if(def&&t.rangeRing){
                            const r=(def.range+t._rangeBonus)*TS;
                            t.rangeRing.setRadius(r);
                        }
                    }
                }
            },
            {
                id:'tower_reload', tab:'Towers', icon:'⏱', name:'Fast Reload', maxTier:8,
                costFn: t=>Math.round(25 + t*20 + Math.pow(t,1.6)*4),
                descFn: t=>`-8% tower fire intervals`,
                eff: ()=>{
                    this._towerCDMult*=0.92;
                    for(const t of this.towers) t._fireRateMult=(t._fireRateMult||1)*0.92;
                }
            },
            {
                id:'tesla_chain', tab:'Towers', icon:'🌩', name:'Arc Amplifier', maxTier:5,
                costFn: t=>[30,70,140,250,400][t]||999,
                descFn: t=>`Tesla chains to +1 more enemy`,
                eff: ()=>{ this._chainBonus++; }
            },
            {
                id:'sniper_pierce', tab:'Towers', icon:'🎯', name:'AP Rounds', maxTier:4,
                costFn: t=>[25,60,130,260][t]||999,
                descFn: t=>`Sniper pierces +1 more enemy`,
                eff: ()=>{ this._pierceBonus++; }
            },
            // ── BASE ─────────────────────────────────────────────────────────
            {
                id:'base_hp', tab:'Base', icon:'🏛', name:'Armor Plating', maxTier:20,
                costFn: t=>Math.round(12 + t*10 + Math.pow(t,1.5)*2),
                descFn: t=>`+100 max base HP`,
                eff: ()=>{ this.baseMaxHP+=100; this.baseHP=Math.min(this.baseHP+100,this.baseMaxHP); }
            },
            {
                id:'base_regen', tab:'Base', icon:'💊', name:'Auto-Repair', maxTier:10,
                costFn: t=>Math.round(20 + t*15 + Math.pow(t,1.6)*3),
                descFn: t=>`Base heals +2 HP/s`,
                eff: ()=>{ this.baseHealRate+=2; }
            },
            {
                id:'base_shield', tab:'Base', icon:'🛡', name:'Reflect Shield', maxTier:6,
                costFn: t=>[30,75,160,300,500,800][t]||999,
                descFn: t=>`+12% projectile reflect`,
                eff: ()=>{ this.shieldPct=Math.min(0.75,this.shieldPct+0.12); }
            },
            {
                id:'base_poison', tab:'Base', icon:'☠', name:'Toxin Field', maxTier:5,
                costFn: t=>[25,60,130,260,500][t]||999,
                descFn: t=>`Stronger poison aura around base`,
                eff: ()=>{ const x=this.baseAuras.find(a=>a.type==='poison'); x?x.tier=Math.min(4,x.tier+1):this.baseAuras.push({type:'poison',tier:0}); }
            },
            // ── ITEMS ─────────────────────────────────────────────────────────
            {
                id:'heal_self', tab:'Items', icon:'❤', name:'Med Kit', maxTier:999,
                costFn: t=>8,
                descFn: t=>`Restore 50 player HP`,
                eff: ()=>{ this.playerHP=Math.min(this.playerMaxHP,this.playerHP+50); }
            },
            {
                id:'repair_base', tab:'Items', icon:'🔩', name:'Base Repair', maxTier:999,
                costFn: t=>12,
                descFn: t=>`Restore 200 base HP`,
                eff: ()=>{ this.baseHP=Math.min(this.baseMaxHP,this.baseHP+200); }
            },
            {
                id:'dmg_boost', tab:'Items', icon:'🔥', name:'Power Core', maxTier:999,
                costFn: t=>20,
                descFn: t=>`2× all damage for next wave`,
                eff: ()=>{ this._waveBoost=2; this._showBanner('POWER CORE','#ff8844','2× damage next wave!'); }
            },
            {
                id:'scrap_pack', tab:'Items', icon:'💰', name:'Scrap Stash', maxTier:999,
                costFn: t=>0,
                descFn: t=>`FREE — gives 25 scraps`,
                eff: ()=>{ this.orbScraps+=25; this.scraps=this.orbScraps; }
            },
            {
                id:'scrap_magnet', tab:'Items', icon:'🧲', name:'Scrap Magnet', maxTier:8,
                costFn: t=>Math.round(15+t*20+Math.pow(t,1.5)*5), // 15, 38, 72, 118...
                descFn: t=>`+1 tile scrap pickup radius (now: ${this.orbPickupRadius+1} tiles)`,
                eff: ()=>{ this.orbPickupRadius++; }
            },
            // ── PETS ─────────────────────────────────────────────────────────
            {
                id:'pet_light', tab:'Pets', icon:'✨', name:'Light Wisp', maxTier:1,
                costFn: t=>180,
                descFn: t=>`Fires chain lasers that jump between nearby enemies`,
                petType: 'light', eff: ()=>{ this._ownWisp('light'); }
            },
            {
                id:'pet_ice', tab:'Pets', icon:'❄', name:'Ice Wisp', maxTier:1,
                costFn: t=>160,
                descFn: t=>`Single-target frost — chance to freeze; shatter for brittle + a slowing water puddle.`,
                petType: 'ice', eff: ()=>{
                    this._ownWisp('ice');
                    this._iceFreezeChance=this._iceFreezeChance??0.15;   // base freeze chance per hit
                    this._iceFreezeBonus=this._iceFreezeBonus??0;        // +from upgrades
                    this._iceWetFreezeBonus=this._iceWetFreezeBonus??0.35;// +if target is wet
                    this._iceFreezeDur=this._iceFreezeDur??4000;         // freeze/stun window
                    this._icePuddleSlow=this._icePuddleSlow??0.4;        // puddle slow strength
                    this._icePuddleRadius=this._icePuddleRadius??1;      // puddle half-size (1 = 3×3)
                    this._icePuddleDur=this._icePuddleDur??4000;         // puddle lifetime
                    this._brittleMult=this._brittleMult??1.75;           // brittle amp
                    this._brittleCharges=this._brittleCharges??1;        // SHATTERSTORM raises to 2
                    this._iceShatterBrittleR=this._iceShatterBrittleR??1.5; // shatter brittle radius (tiles)
                    this._iceWetDur=this._iceWetDur??1500;               // how long wet lingers
                    this._iceWetHealCut=this._iceWetHealCut??0;          // WATERLOG anti-heal
                    this._iceFrostbiteDps=this._iceFrostbiteDps??0;      // FROSTBITE wet DoT
                    this._iceCascadeChance=this._iceCascadeChance??0;    // CASCADE chain-shatter
                    this._iceCascadeR=this._iceCascadeR??3;              // cascade reach (tiles)
                    this._iceFlashDmg=this._iceFlashDmg??14;             // flash-freeze / frostwalker hit
                    this._iceFlashFreezeChance=this._iceFlashFreezeChance??0.25;
                    this._iceSubzeroBonus=this._iceSubzeroBonus??0.75;   // SUBZERO extra amp vs armour
                    this._petIceBeams=this._petIceBeams??1;              // single-target by identity
                }
            },
            {
                id:'pet_boom', tab:'Pets', icon:'💥', name:'Boom Wisp', maxTier:1,
                costFn: t=>200,
                descFn: t=>`Laser marks targets — explodes with AoE damage after 2s`,
                petType: 'boom', eff: ()=>{ this._ownWisp('boom'); }
            },
            {
                id:'pet_fire', tab:'Pets', icon:'🔥', name:'Fiery Wisp', maxTier:1,
                costFn: t=>170,
                descFn: t=>`Two modes (toggle in [R] Roster): Single locks one target and ramps into a devastating purple beam; Multi whips weaker flames across up to 10 enemies at once`,
                petType: 'fire', eff: ()=>{ this._ownWisp('fire'); }
            },
            {
                id:'pet_chains', tab:'Pets', icon:'⛓', name:'Light Upgrade', maxTier:2,
                costFn: t=>[120,250][t]||999,
                descFn: t=>`Light Wisp shoots +1 chain laser per tier`,
                eff: ()=>{ this._petLightChains=Math.min(3,(this._petLightChains||1)+1); }
            },
            {
                // Kept deliberately. Ice's locked identity is SINGLE-target, and this is
                // the paid opt-out from it — a real choice rather than a contradiction.
                // The tradeoff is named in the description because it is not obvious:
                // extra beams spread the rotation thinner, so freezes land on more
                // enemies but each one is revisited less often, and the freeze window is
                // finite. Frozen targets still outrank everything in _pickIceTargets, so
                // the shatter follow-up is protected either way.
                id:'pet_ice_beams', tab:'Pets', icon:'🎯', name:'Ice Upgrade', maxTier:2,
                costFn: t=>[120,250][t]||999,
                descFn: t=>`Ice targets +1 enemy per tier.\nSpreads freezes wider, but\nrevisits each target less\noften — the freeze window\nis unchanged.`,
                eff: ()=>{ this._petIceBeams=(this._petIceBeams||1)+1; }
            },
            {
                id:'pet_fist', tab:'Pets', icon:'👊', name:'Fist Wisp', maxTier:1,
                costFn: t=>190,
                descFn: t=>`Chases enemies and combos them — every 3rd punch knocks back and stuns for 2s`,
                petType: 'fist', eff: ()=>{ this._ownWisp('fist'); }
            },
            {
                id:'pet_void', tab:'Pets', icon:'🌑', name:'Void Wisp', maxTier:1,
                costFn: t=>250,
                descFn: t=>`Every 5s fires a purple laser — hit creates a black hole that implodes leaving enemies vulnerable for 2s`,
                petType: 'void', eff: ()=>{ this._ownWisp('void'); }
            },
            {
                id:'pet_poison', tab:'Pets', icon:'☠', name:'Poison Wisp', maxTier:1,
                costFn: t=>200,
                descFn: t=>`Barfs on enemies creating a 3×3 poison pool. Ignores shields, applies % DoT`,
                petType: 'poison', eff: ()=>{ this._ownWisp('poison'); }
            },
            {
                id:'pet_skyward', tab:'Pets', icon:'🌟', name:'Skyward Apprentice', maxTier:1,
                costFn: t=>300,
                descFn: t=>`Every 15s, locks crosshairs on enemies then rains cannon fire`,
                petType: 'skyward', eff: ()=>{ this._ownWisp('skyward'); }
            },
            {
                id:'pet_phantom', tab:'Pets', icon:'👻', name:'Phantom Wisp', maxTier:1,
                costFn: t=>280,
                descFn: t=>`Possesses nearest enemy — makes it flee, hazy cloud slows nearby enemies`,
                petType: 'phantom', eff: ()=>{ this._ownWisp('phantom'); }
            },
            {
                id:'pet_life', tab:'Pets', icon:'🌸', name:'Life Wisp', maxTier:1,
                costFn: t=>260,
                descFn: t=>`Passively heals every other equipped wisp's stamina every 5s — landing drains on enemies speeds up the next heal tick`,
                petType: 'life', eff: ()=>{ this._ownWisp('life'); }
            },
            {
                id:'pet_dmg', tab:'Pets', icon:'⬆', name:'Wisp Power', maxTier:3,
                costFn: t=>[100,200,350][t]||999,
                descFn: t=>`+25% all pet damage per tier`,
                eff: ()=>{ this._petDmgMult=(this._petDmgMult||1)+0.25; }
            },
            {
                id:'pet_range', tab:'Pets', icon:'🌀', name:'Wisp Lens', maxTier:3,
                costFn: t=>[80,160,280][t]||999,
                descFn: t=>`+1 tile pet attack radius per tier`,
                eff: ()=>{ this._petRange=(this._petRange||5)+1; }
            },
        ]; // end _buildShopCatalogue
    }

    _openGlurpShopUI(catalogue){
        const tabs=['Wrench','Towers','Base','Items','Pets'];
        let activeTab='Wrench';

        const W=this.scale.width,H=this.scale.height;
        const objs=this._gsObjs=[];const tr=o=>{objs.push(o);return o;};
        let cardObjs=[];

        tr(this.add.rectangle(W/2,H/2,W,H,0x000000,0.85).setScrollFactor(0).setDepth(45).setInteractive()
            .on('pointerdown',()=>this._closeGlurpShop()));

        const pw=Math.min(W*0.94,1000),ph=Math.min(H*0.94,720),px=W/2-pw/2,py=H/2-ph/2;
        const panel=tr(this.add.graphics().setScrollFactor(0).setDepth(46));
        panel.fillStyle(0x08121a,0.99); panel.fillRoundedRect(px,py,pw,ph,12);
        panel.lineStyle(2,0x44ff88,0.55); panel.strokeRoundedRect(px,py,pw,ph,12);

        tr(this.add.text(px+pw/2,py+28,"GLURP'S SHOP",{fontSize:'24px',fontFamily:UIKit.FONT.title,color:'#44ff88',stroke:'#000',strokeThickness:4,fontStyle:'bold'}).setOrigin(0.5).setScrollFactor(0).setDepth(47));
        const scrT=tr(this.add.text(px+pw-46,py+28,`⚙ ${this.scraps}`,{fontSize:'19px',fontFamily:UIKit.FONT.title,color:'#ffdd88',stroke:'#000',strokeThickness:2,fontStyle:'bold'}).setOrigin(1,0.5).setScrollFactor(0).setDepth(47));
        tr(this.add.text(px+pw-16,py+10,'✕',{fontSize:'22px',fontFamily:UIKit.FONT.title,color:'#ff6666'}).setOrigin(1,0).setScrollFactor(0).setDepth(48).setInteractive().on('pointerdown',()=>this._closeGlurpShop()));

        // Glurp mini
        const miniSprite=tr(this.add.sprite(px+46,py+ph/2,'slime_green',0).setScale(2.2).setScrollFactor(0).setDepth(47));
        miniSprite.play('green_idle');

        // Tabs
        const tabX=px+92,tabY=py+56,tabW=Math.min(160,(pw-120)/5-6),tabH=38,tabGap=6;
        const tabBgs=[],tabLabels=[];
        const drawTabs=()=>tabs.forEach((tab,i)=>{
            const active=tab===activeTab;
            tabBgs[i].clear();
            tabBgs[i].fillStyle(active?0x144028:0x0e1820,0.99);
            tabBgs[i].fillRoundedRect(tabX+i*(tabW+tabGap),tabY,tabW,tabH,5);
            tabBgs[i].lineStyle(2,active?0x44ff88:0x1e2e3e,active?0.85:0.45);
            tabBgs[i].strokeRoundedRect(tabX+i*(tabW+tabGap),tabY,tabW,tabH,5);
            tabLabels[i].setColor(active?'#44ff88':'#8899aa');
        });
        tabs.forEach((tab,i)=>{
            const bg=tr(this.add.graphics().setScrollFactor(0).setDepth(47));
            const lbl=tr(this.add.text(tabX+i*(tabW+tabGap)+tabW/2,tabY+tabH/2,tab,{fontSize:'16px',fontFamily:UIKit.FONT.title,color:'#8899aa',fontStyle:'bold'}).setOrigin(0.5).setScrollFactor(0).setDepth(48));
            tabBgs.push(bg); tabLabels.push(lbl);
            const hit=tr(this.add.rectangle(tabX+i*(tabW+tabGap)+tabW/2,tabY+tabH/2,tabW,tabH,0xffffff,0).setScrollFactor(0).setDepth(49).setInteractive());
            hit.on('pointerdown',p=>{p.event.stopPropagation();activeTab=tab;scrollOffset=0;drawTabs();buildCards();});
        });
        drawTabs();

        let scrollOffset=0;
        const buildCards=()=>{
            cardObjs.forEach(o=>o?.active&&o.destroy()); cardObjs=[];
            const ctr=o=>{cardObjs.push(o);objs.push(o);return o;};
            const items=catalogue.filter(it=>it.tab===activeTab);
            const cols=3,gap=12;
            const gridX=px+92,gridY=py+108;
            const gridW=pw-92-56; // leave room for the scroll arrows on the right
            const cardW=Math.floor((gridW-(cols-1)*gap)/cols), cardH=158;
            const maxRows=Math.max(1,Math.floor((ph-140)/(cardH+gap)));
            const totalRows=Math.ceil(items.length/cols);
            const maxScroll=Math.max(0,totalRows-maxRows);
            scrollOffset=Math.max(0,Math.min(scrollOffset,maxScroll));
            // Scroll arrows
            if(totalRows>maxRows){
                const upBtn=ctr(this.add.text(px+pw-30,py+112,'▲',{fontSize:'22px',fontFamily:UIKit.FONT.title,color:scrollOffset>0?'#ffdd44':'#334455'}).setOrigin(0.5,0).setScrollFactor(0).setDepth(49).setInteractive());
                const dnBtn=ctr(this.add.text(px+pw-30,py+ph-52,'▼',{fontSize:'22px',fontFamily:UIKit.FONT.title,color:scrollOffset<maxScroll?'#ffdd44':'#334455'}).setOrigin(0.5,0).setScrollFactor(0).setDepth(49).setInteractive());
                upBtn.on('pointerdown',()=>{ if(scrollOffset>0){scrollOffset--;buildCards();} });
                dnBtn.on('pointerdown',()=>{ if(scrollOffset<maxScroll){scrollOffset++;buildCards();} });
            }
            items.forEach((item,i)=>{
                const col=i%cols,row=Math.floor(i/cols)-scrollOffset;
                if(row<0||row>=maxRows)return;
                const bx=gridX+col*(cardW+gap),by=gridY+row*(cardH+gap);
                const bought=this._shopPurchased[item.id]||0;
                const isPetItem=!!item.petType;
                const isOwned=isPetItem&&this._ownedWisps?.has(item.petType);
                const maxed=isPetItem?(isOwned):bought>=item.maxTier;
                const locked=item.id==='wrench_diamond'&&this._wrenchTier!=='gold';
                const cost=locked?999:item.costFn(bought);
                const canAfford=!(isPetItem?isOwned:maxed)&&!locked&&this.scraps>=cost;
                const isEquipped=isPetItem&&this._equippedWisps?.has(item.petType);
                const equippedCount=this._equippedWisps?.size||0;

                const bg=ctr(this.add.graphics().setScrollFactor(0).setDepth(47));
                const draw=hov=>{
                    bg.clear();
                    const fill=isEquipped?0x0a2020:isOwned?0x0a1a10:locked?0x1a0a0a:hov?0x122030:0x0a1420;
                    bg.fillStyle(fill,0.99); bg.fillRoundedRect(bx,by,cardW,cardH,7);
                    bg.lineStyle(1.5,isEquipped?0x44ffaa:isOwned?0x44ff88:locked?0x443333:hov?0x4488cc:0x1a2a3a,isEquipped||isOwned?0.8:0.55);
                    bg.strokeRoundedRect(bx,by,cardW,cardH,7);
                    // Tier counter top-right
                    if(item.maxTier<=50&&item.maxTier>1){
                        bg.fillStyle(0x223344,0.7); bg.fillRoundedRect(bx+cardW-58,by+8,50,22,5);
                    }
                };
                draw(false);

                // Icon + name row
                ctr(this.add.text(bx+14,by+12,item.icon,{fontSize:'28px'}).setScrollFactor(0).setDepth(48));
                ctr(this.add.text(bx+52,by+16,item.name,{fontSize:'15px',fontFamily:'monospace',color:isEquipped?'#44ffaa':isOwned?'#44ff88':locked?'#664444':'#ffffff',fontStyle:'bold',wordWrap:{width:cardW-118}}).setScrollFactor(0).setDepth(48));
                // Tier badge
                if(item.maxTier>1&&item.maxTier<=50){
                    ctr(this.add.text(bx+cardW-33,by+19,`${bought}/${item.maxTier}`,{fontSize:'12px',fontFamily:'monospace',color:'#7d8fa3'}).setOrigin(0.5).setScrollFactor(0).setDepth(48));
                } else if(item.maxTier>50){
                    ctr(this.add.text(bx+cardW-33,by+19,`×${bought}`,{fontSize:'12px',fontFamily:'monospace',color:'#7d8fa3'}).setOrigin(0.5).setScrollFactor(0).setDepth(48));
                }
                // Description
                const desc=locked?'Requires Gold Wrench':(isPetItem?item.descFn(bought):maxed?'MAXED':item.descFn(bought));
                ctr(this.add.text(bx+14,by+52,desc,{fontSize:'12px',fontFamily:'monospace',color:(isPetItem?isOwned:maxed)?'#44aa55':locked?'#664444':'#8a9bb0',wordWrap:{width:cardW-26},lineSpacing:2}).setScrollFactor(0).setDepth(48));
                // Cost button / equip UI for wisps
                if(isPetItem&&isOwned){
                    // Show equip/unequip toggle instead of buy button
                    const toggleCol=isEquipped?'#44ff88':'#778899';
                    const toggleLabel=isEquipped?'✓ EQUIPPED':'+ EQUIP';
                    const slotTxt=ctr(this.add.text(bx+cardW/2,by+cardH-22,toggleLabel,{fontSize:'15px',fontFamily:'monospace',color:toggleCol,fontStyle:'bold'}).setOrigin(0.5).setScrollFactor(0).setDepth(48));
                    if(!isEquipped&&equippedCount>=5){
                        // Slots full — show greyed
                        slotTxt.setText('SLOTS FULL').setColor('#554444');
                    }
                    const toggleHit=ctr(this.add.rectangle(bx+cardW/2,by+cardH/2,cardW,cardH,0xffffff,0).setScrollFactor(0).setDepth(49).setInteractive());
                    toggleHit.on('pointerover',()=>draw(true));
                    toggleHit.on('pointerout', ()=>draw(false));
                    toggleHit.on('pointerdown',p=>{
                        p.event.stopPropagation();
                        if(isEquipped){ this._unequipWisp(item.petType); }
                        else { this._equipWisp(item.petType); }
                        buildCards();
                    });
                    // Slot counter in corner
                    ctr(this.add.text(bx+cardW-10,by+10,`${equippedCount}/5`,{fontSize:'11px',fontFamily:'monospace',color:'#7d8fa3'}).setOrigin(1,0).setScrollFactor(0).setDepth(48));
                } else if(!isPetItem&&!maxed&&!locked&&cost>=0){
                    const costStr=maxed?'OWNED':locked?'LOCKED':`⚙ ${cost}`;
                    const costCol=maxed?'#44ff88':locked?'#664444':canAfford?'#ffdd44':'#664433';
                    ctr(this.add.text(bx+cardW/2,by+cardH-22,costStr,{fontSize:'17px',fontFamily:UIKit.FONT.title,color:costCol,fontStyle:'bold'}).setOrigin(0.5).setScrollFactor(0).setDepth(48));
                    const hit=ctr(this.add.rectangle(bx+cardW/2,by+cardH/2,cardW,cardH,0xffffff,0).setScrollFactor(0).setDepth(49).setInteractive());
                    hit.on('pointerover',()=>draw(true));
                    hit.on('pointerout', ()=>draw(false));
                    hit.on('pointerdown',p=>{
                        p.event.stopPropagation();
                        const c=item.costFn(this._shopPurchased[item.id]||0);
                        if(this.scraps<c)return;
                        this.scraps-=c; this.orbScraps=this.scraps;
                        item.eff();
                        this._shopPurchased[item.id]=(this._shopPurchased[item.id]||0)+1;
                        scrT.setText(`⚙ ${this.scraps}`);
                        this._showFloatingText(bx+cardW/2,by-8,`${item.icon} ${item.name}`,'#44ff88',0);
                        buildCards();
                    });
                } else if(!isPetItem){
                    const costStr=maxed?'OWNED':locked?'LOCKED':`⚙ ${cost}`;
                    const costCol=maxed?'#44ff88':locked?'#664444':canAfford?'#ffdd44':'#664433';
                    ctr(this.add.text(bx+cardW/2,by+cardH-22,costStr,{fontSize:'17px',fontFamily:UIKit.FONT.title,color:costCol,fontStyle:'bold'}).setOrigin(0.5).setScrollFactor(0).setDepth(48));
                } else if(isPetItem&&!isOwned&&!maxed&&!locked&&cost>=0){
                    // Not yet purchased — show buy button
                    const costStr=`⚙ ${cost}`;
                    const costCol=canAfford?'#ffdd44':'#664433';
                    ctr(this.add.text(bx+cardW/2,by+cardH-22,costStr,{fontSize:'17px',fontFamily:UIKit.FONT.title,color:costCol,fontStyle:'bold'}).setOrigin(0.5).setScrollFactor(0).setDepth(48));
                    const hit=ctr(this.add.rectangle(bx+cardW/2,by+cardH/2,cardW,cardH,0xffffff,0).setScrollFactor(0).setDepth(49).setInteractive());
                    hit.on('pointerover',()=>draw(true));
                    hit.on('pointerout', ()=>draw(false));
                    hit.on('pointerdown',p=>{
                        p.event.stopPropagation();
                        const c=item.costFn(this._shopPurchased[item.id]||0);
                        if(this.scraps<c)return;
                        this.scraps-=c; this.orbScraps=this.scraps;
                        item.eff();
                        this._shopPurchased[item.id]=(this._shopPurchased[item.id]||0)+1;
                        scrT.setText(`⚙ ${this.scraps}`);
                        this._showFloatingText(bx+cardW/2,by-8,`${item.icon} ${item.name}`,'#44ff88',0);
                        buildCards();
                    });
                }
            });
        };
        buildCards();
        // Exposed so _refreshShopUI can rebuild just the cards in place. Reopening the
        // whole shop would reset activeTab and scrollOffset (both closure locals), which
        // is why buying a wisp used to bounce you back to the first tab.
        this._gsBuildCards=buildCards;
        this._gsScrapTxt=scrT;
    }

    _closeGlurpShop(){
        this._glurpShopOpen=false;
        this._gsBuildCards=null; this._gsScrapTxt=null;
        (this._gsObjs||[]).forEach(o=>o?.active&&o.destroy());
        this._gsObjs=[];
    }

    _movePlayer(time){
        if(time-this.lastMoveTime<this.moveCooldown)return;
        const k=this.keys;let dx=0,dy=0;
        if(k.W.isDown)dy=-1;else if(k.S.isDown)dy=1;else if(k.A.isDown)dx=-1;else if(k.D.isDown)dx=1;
        if(!dx&&!dy)return;
        const nx=this._myX+dx,ny=this._myY+dy;
        if(nx>=0&&nx<this.WORLD_WIDTH&&ny>=0&&ny<this.WORLD_HEIGHT
            &&this.world[nx][ny]===this.FLOOR
            &&!this.towers.some(t=>t.tileX===nx&&t.tileY===ny)){
            this._myX=nx;this._myY=ny;
            this.tweens.add({targets:this.player,
                x:nx*this.TILE_SIZE+this.TILE_SIZE/2,
                y:ny*this.TILE_SIZE+this.TILE_SIZE/2+this.SLIME_Y_OFFSET,
                duration:100,ease:'Power2'});
            this.lastMoveTime=time;
        }
    }

    _onPointerDown(ptr){
        // Wave direction setter
        const waveTower=this.towers.find(t=>t._settingWaveDir&&t.type==='magnetizer');
        if(waveTower&&!this._buildMenuOpen&&!this._upgradeMenuOpen&&!this._placementMode){
            waveTower._waveAng=Math.atan2(ptr.worldY-waveTower.py,ptr.worldX-waveTower.px);
            waveTower._settingWaveDir=false;
            this._showFloatingText(ptr.worldX,ptr.worldY-16,'WAVE DIR SET','#4488ff');
            return;
        }
        if(this._buildMenuOpen||this._upgradeMenuOpen)return;
        if(this._placementMode){
            const tx=Math.floor(ptr.worldX/this.TILE_SIZE),ty=Math.floor(ptr.worldY/this.TILE_SIZE);
            if(this._placeTower(this._placementMode,tx,ty))this._showFloatingText(ptr.worldX,ptr.worldY-16,'PLACED','#44ff88');
            this._cancelPlacement();return;
        }
        // Real WeaponSystem wrench — exact same as main game
        this.fireEquippedWeapon(ptr.x,ptr.y);
    }

    // ─── ENEMY BASE DETECTION ────────────────────────────────────────────────
    // ─── CUSTOM TD ENEMIES ────────────────────────────────────────────────────

    _spawnTaunter(tx,ty,hp){
        const e=this.createEnemy(tx,ty,hp);
        if(!e)return null;
        e.sprite.setTint(0xffbb33); // amber/gold — a "commander" look, distinct from green rooter
        e.sprite.setScale(this.SLIME_SCALE*1.3);
        e._baseScale=this.SLIME_SCALE*1.3;
        e._tdTaunter=true;
        e._taunterRadius=5;
        e._taunterAbsorb=0.35;     // takes only 35% of redirected damage — a stronger tank
        // Extra-tanky: it's meant to eat sustained single-target fire. HP is set by the
        // spawn's base table (60) × wave scaling; bump it so it isn't trivially popped.
        e.health=Math.floor(e.health*2.4); e.maxHealth=e.health; e._lastTrackedHealth=e.health;
        e._taunterAura=this.add.graphics().setDepth(2.4);
        return e;
    }
    // Brief green pulse when the taunter soaks a redirected hit.
    _taunterAbsorbFx(t){
        if(!t?.sprite?.active)return;
        if(t._absorbFxAt&&this.time.now-t._absorbFxAt<60)return; // throttle in a crowd
        t._absorbFxAt=this.time.now;
        t.sprite.setTint(0xbbffcc);
        this.time.delayedCall(70,()=>{ if(t.sprite?.active) t.sprite.setTint(0x44ff88); });
    }

    _spawnCEO(tx,ty,hp){
        const e=this.createEnemy(tx,ty,hp);
        if(!e)return null;
        e.health=hp; e.maxHealth=hp;
        e._tdCEO=true;
        e._ceoShield=Math.floor(hp*1.2); e._ceoMaxShield=e._ceoShield;
        e._ceoLastTransform=0; e._ceoTransformInterval=8000;
        e._ceoLastSwing=0; e._ceoSwingInterval=2500;
        e.sprite.setTint(0xddaaff);
        e.sprite.setScale(this.SLIME_SCALE*1.6);
        // Shift the CEO visually upward via origin (once) rather than overwriting sprite.y
        // every frame — the per-frame overwrite fought the movement tween and made it choppy.
        e.sprite.setOrigin(0.5,0.5+0.3/1.6);
        e._spriteYOffset = 0;
        const TS=this.TILE_SIZE, hr=TS*1.2;
        const hLeft  = -hr + TS*0.3;   // sides in 0.3
        const hRight =  hr - TS*0.3;
        const hTop   = -hr + TS*1.3;   // top down 1.3 (was 0.8)
        const hBot   =  hr;
        const hitRing=this.add.graphics().setDepth(e.sprite.depth+0.1);
        hitRing.lineStyle(1.5,0xff44ff,0.55);
        hitRing.strokeRect(hLeft, hTop, hRight-hLeft, hBot-hTop);
        hitRing.x=e.sprite.x; hitRing.y=e.sprite.y;
        e._ceoHitRing=hitRing;
        // Shield bar
        const sbBg  =this.add.rectangle(e.sprite.x,e.sprite.y-6,24,4,0x000000,0.85).setDepth(4.7);
        const sbFill=this.add.rectangle(e.sprite.x-11,e.sprite.y-6,22,3,0x8844ff,1).setDepth(4.8).setOrigin(0,0.5);
        e._ceoShieldBg=sbBg; e._ceoShieldFill=sbFill;
        e._lastTrackedHealth=hp;
        return e;
    }

    // Mortars pick whichever is closer: the base, or the nearest tower. Lets them threaten
    // your defensive line, not just the core.
    _mortarTargetOverride(enemy){
        const TS=this.TILE_SIZE;
        let px=this.basePx, py=this.basePy;
        let bd=Math.hypot(enemy.sprite.x-px,enemy.sprite.y-py);
        for(const t of (this.towers||[])){
            if(!t.active)continue;
            const d=Math.hypot(enemy.sprite.x-t.px,enemy.sprite.y-t.py);
            if(d<bd){bd=d;px=t.px;py=t.py;}
        }
        return {px,py};
    }

    _makeKnight(nearby){
        nearby.sprite.setTint(0xdd88ff);
        nearby.sprite.setScale(this.SLIME_SCALE*1.35);
        nearby._baseScale=this.SLIME_SCALE*1.35; // so encase/thaw scale-restores keep it big
        const waveScale=Math.pow(1.045,(this.wave||1)-1); // same exponential curve as all enemies
        const knightHP=Math.floor(320*waveScale);       // the tankiest elite — a real wall late
        const knightArmour=Math.floor(knightHP*2.5);     // was 2.0× — tankier still
        nearby.health=knightHP; nearby.maxHealth=knightHP;
        nearby._ceoKnight=true;
        nearby._tdType='knight';
        nearby._tdDmg=26;                                // heavy base damage if it leaks (was ~8 fallback)
        nearby._knightArmour=knightArmour;
        nearby._knightMaxArmour=knightArmour;
        nearby._knightArmourEfficiency=0.32;             // only 32% of a NON-AP hit chews armour
        const aoBg  =this.add.rectangle(nearby.sprite.x,nearby.sprite.y-6,26,4,0x000000,0.85).setDepth(4.7);
        const aoFill=this.add.rectangle(nearby.sprite.x-12,nearby.sprite.y-6,24,3,0x888888,1).setDepth(4.8).setOrigin(0,0.5);
        nearby._knightArmourBg=aoBg; nearby._knightArmourFill=aoFill;
        nearby._lastTrackedHealth=nearby.health;
        this.updateEnemyHealthBar(nearby);
        this._showFloatingText(nearby.sprite.x,nearby.sprite.y-20,'KNIGHT!','#dd88ff');
    }

    _spawnInfernal(tx,ty,hp){
        // Infernal: locks on and fires a growing continuous laser at the base
        // Stages 1→5, growing in width/damage; interrupted = reset to stage 1
        const e=this.createEnemy(tx,ty,hp);
        if(!e)return null;
        e.sprite.setTint(0xff4400);
        e._tdInfernal=true;
        e._infernalStage=0; // 0=idle, 1-5=firing stages
        e._infernalLockTime=0;
        e._infernalLastStageTime=0;
        e._infernalStageThresholds=[3000,4000,4000,5000,7000]; // ms per stage
        e._infernalBeam=null;
        e._infernalInterrupted=false;
        return e;
    }

    _spawnPortalBringer(tx,ty,hp){
        const TS=this.TILE_SIZE;
        // Very tanky — designed to be a race against time. The longer it lives the
        // more mini-portals accumulate in the center room, each spawning enemies close to base.
        const e=this.createEnemy(tx,ty,Math.round(hp*3.5)); // 3.5× the normal HP for its wave
        if(!e)return null;
        e.sprite.setScale(this.SLIME_SCALE*1.45);
        e.sprite.setTint(0x8844ff);
        e._tdPortalBringer=true;
        e._pbAnchored=false;
        e._pbLastPortal=0;
        e._pbPortalInterval=5000; // drops a mini-portal every 5s once anchored
        e._pbGfx=this.add.graphics().setDepth(3.2);
        e._pbRot=0;
        return e;
    }

    _spawnMiniPortal(tileX,tileY,dmgMult){
        // A mini-portal planted in the center room — spawns enemies periodically.
        // Pressure compounds the longer the portal bringer lives.
        if(!this._miniPortals) this._miniPortals=[];
        const TS=this.TILE_SIZE;
        const px=tileX*TS+TS/2, py=tileY*TS+TS/2;
        const gfx=this.add.graphics().setDepth(3.5);
        const portal={
            tileX,tileY,x:px,y:py,gfx,
            dmgMult,
            lastSpawn:0,
            spawnInterval:2200,
            rot:Math.random()*Math.PI*2,
            active:true,
            expiresAt:this.time.now+25000, // closes after 25s — punishing but not permanent
        };
        this._miniPortals.push(portal);
        // Arrival burst visual
        const burst=this.add.graphics().setDepth(5.5);
        burst.x=px; burst.y=py;
        burst.fillStyle(0xaa44ff,0.7); burst.fillCircle(0,0,TS*1.2);
        burst.fillStyle(0xffffff,0.5); burst.fillCircle(0,0,TS*0.5);
        this.tweens.add({targets:burst,scaleX:2.5,scaleY:2.5,alpha:0,duration:400,onComplete:()=>burst.destroy()});
        this._showFloatingText(px,py-24,'MINI PORTAL!','#cc44ff');
        this.cameras.main.shake(60,0.004);
        return portal;
    }

    _updateMiniPortals(time,dt){
        if(!this._miniPortals?.length)return;
        const TS=this.TILE_SIZE;
        for(let i=this._miniPortals.length-1;i>=0;i--){
            const p=this._miniPortals[i];
            if(!p.active||!p.gfx?.active){this._miniPortals.splice(i,1);continue;}
            // Close after duration
            if(time>=p.expiresAt){
                p.active=false;
                // The portal graphic bakes absolute world coords into its draw calls, so its
                // own transform sits at (0,0). Scale-tweening it would scale around (0,0) and
                // fling the visual to the top-left. Just clear and destroy it.
                p.gfx?.destroy();
                this._miniPortals.splice(i,1);
                continue;
            }
            // Pulse warning when close to expiry
            const timeLeft=p.expiresAt-time;
            const closingPulse=timeLeft<5000?(0.5+0.5*Math.sin(time*0.02)):1;
            // Draw pulsing portal ring
            p.rot+=dt*3.5;
            p.gfx.clear();
            const pulse=(0.55+0.35*Math.sin(time*0.006))*closingPulse;
            // Outer glow
            p.gfx.fillStyle(0x6600aa,0.18*pulse); p.gfx.fillCircle(p.x,p.y,TS*1.1);
            // Two counter-rotating arcs
            for(let a=0;a<2;a++){
                const ang=p.rot*(a?1:-1.3)+a*Math.PI;
                p.gfx.lineStyle(3,0xaa44ff,0.8*pulse);
                p.gfx.beginPath(); p.gfx.arc(p.x,p.y,TS*0.7,ang,ang+Math.PI*1.2,false); p.gfx.strokePath();
                p.gfx.lineStyle(1.5,0xddaaff,0.5*pulse);
                p.gfx.beginPath(); p.gfx.arc(p.x,p.y,TS*0.7,ang+Math.PI*1.3,ang+Math.PI*1.9,false); p.gfx.strokePath();
            }
            // Bright core
            p.gfx.fillStyle(0xff88ff,0.7*pulse); p.gfx.fillCircle(p.x,p.y,TS*0.25);
            p.gfx.fillStyle(0xffffff,0.6*pulse); p.gfx.fillCircle(p.x,p.y,TS*0.12);
            // Spawn enemies periodically — spawns in the portal room then they path to base
            if(time-p.lastSpawn>=p.spawnInterval){
                p.lastSpawn=time;
                const roll=Math.random();
                const type=roll<0.4?'basic':roll<0.65?'speed':roll<0.8?'berserker':roll<0.92?'splitter':'rooter';
                // Spawn near the portal visually (center room) — they ARE close range,
                // that's the threat. They have a short path to the base.
                const sx=p.tileX+Math.round((Math.random()-0.5)*2);
                const sy=p.tileY+Math.round((Math.random()-0.5)*2);
                this._spawnEnemy(type,sx,sy,1,false);
                // Flash portal on spawn
                const flash=this.add.graphics().setDepth(5.6);
                flash.x=p.x; flash.y=p.y;
                flash.fillStyle(0xffffff,0.5); flash.fillCircle(0,0,TS*0.6);
                this.tweens.add({targets:flash,scaleX:1.8,scaleY:1.8,alpha:0,duration:200,onComplete:()=>flash.destroy()});
            }
        }
    }



    _spawnGhostBuster(tx,ty,hp){
        const TS=this.TILE_SIZE;
        const e=this.createEnemy(tx,ty,hp);
        if(!e)return null;
        e.sprite.setTint(0xeeeeff);
        e.sprite.setScale(this.SLIME_SCALE*1.15);
        e._baseScale=this.SLIME_SCALE*1.15;
        e._tdGhostBuster=true;
        e._gbLastShot=0;
        e._gbShotInterval=3500;
        e._gbGfx=this.add.graphics().setDepth(3.1);
        return e;
    }

    _fireGhostBusterSpread(e,time){
        const TS=this.TILE_SIZE;
        const bx=this.basePx, by=this.basePy;
        const dx=bx-e.sprite.x, dy=by-e.sprite.y;
        const baseAng=Math.atan2(dy,dx);
        const spreadCount=5;
        const spreadAngle=Math.PI*0.4; // total spread arc
        if(!this._gbBullets) this._gbBullets=[];
        for(let i=0;i<spreadCount;i++){
            const frac=(i/(spreadCount-1)-0.5); // -0.5 to 0.5
            const ang=baseAng+frac*spreadAngle;
            // Ghost bullet: alternating black/white gradient appearance
            const isWhite=(i%2===0);
            const gfx=this.add.graphics().setDepth(5.8);
            gfx.fillStyle(isWhite?0xffffff:0x111133,0.9); gfx.fillCircle(0,0,4.5);
            gfx.lineStyle(1.5,isWhite?0x8888ff:0xffffff,0.7); gfx.strokeCircle(0,0,4.5);
            gfx.fillStyle(isWhite?0x8888ff:0xffffff,0.6); gfx.fillCircle(0,0,2);
            gfx.x=e.sprite.x; gfx.y=e.sprite.y;
            const speed=TS*9;
            const vx=Math.cos(ang)*speed, vy=Math.sin(ang)*speed;
            this._gbBullets.push({gfx,vx,vy,x:e.sprite.x,y:e.sprite.y,born:time,isWhite});
        }
    }

    _updateGhostBullets(time,dt){
        if(!this._gbBullets?.length)return;
        const TS=this.TILE_SIZE;
        for(let i=this._gbBullets.length-1;i>=0;i--){
            const b=this._gbBullets[i];
            if(!b.gfx?.active){this._gbBullets.splice(i,1);continue;}
            // Fade as it travels
            const age=(time-b.born)/3000;
            if(age>1){b.gfx.destroy();this._gbBullets.splice(i,1);continue;}
            b.x+=b.vx*dt; b.y+=b.vy*dt;
            b.gfx.x=b.x; b.gfx.y=b.y;
            b.gfx.setAlpha(1-age*0.6);
            // Check wall collision
            const tx=Math.floor(b.x/TS), ty=Math.floor(b.y/TS);
            if(this.world[tx]?.[ty]!==this.FLOOR){b.gfx.destroy();this._gbBullets.splice(i,1);continue;}
            // Check hit on player (damage the player avatar)
            const px=this.player.x, py=this.player.y;
            if(Math.hypot(b.x-px,b.y-py)<TS*0.55){
                b.gfx.destroy();this._gbBullets.splice(i,1);
                this._applyGhostMute();
                continue;
            }
        }
    }

    _applyGhostMute(){
        const candidates=this.pets?.filter(p=>!p._sleeping&&!p._travelingToSleep&&!p._ghostMuted)||[];
        if(!candidates.length)return;
        const target=candidates[Math.floor(Math.random()*candidates.length)];
        target._ghostMuted=true;
        target.stamina=Math.max(0,(target.stamina||0)-8);
        const mutedGfx=this.add.graphics().setDepth(5.9);
        this._showFloatingText(this.player.x,this.player.y-30,`${target.type} MUTED!`,'#ff4444');
        // Release after 5s
        this.time.delayedCall(5000,()=>{
            target._ghostMuted=false;
            mutedGfx?.destroy();
            if(target.gfx?.active){
                const ox=target.gfx?.x??this.player.x, oy=target.gfx?.y??this.player.y;
                this._showFloatingText(ox,oy-20,'UNMUTED','#aaaaff');
            }
        });
        target._mutedGfx=mutedGfx;
        target._mutedLabel=null; // no text label — the graphic IS the indicator
    }

    // A capstone — Radiant Execution: a struck enemy already below the HP threshold is
    // vaporized outright (bursts into light). Excludes bosses so the finale stays a fight.
    _lightExecuteCheck(e,pet){
        if(!this._lightExecute||!e?.sprite?.active||e.health<=0)return false;
        if(e._isDummy||e._isTotem)return false; // never execute the DPS training dummy
        if(e._tdType==='ceo'||e._tdType==='infernal'||e._tdType==='portal_bringer')return false;
        if(e.health>e.maxHealth*(this._lightExecThreshold||0.14))return false;
        const bx=e.sprite.x, by=e.sprite.y;
        const g=this.add.graphics().setDepth(6).setPosition(bx,by);
        g.fillStyle(0xffffff,0.95); g.fillCircle(0,0,7);
        g.lineStyle(3,0xffee88,0.9); g.strokeCircle(0,0,11);
        this.tweens.add({targets:g,alpha:0,scaleX:3,scaleY:3,duration:300,onComplete:()=>g.destroy()});
        this._showFloatingText(bx,by-16,'EXECUTE','#ffffaa');
        this.killEnemy(e);
        return true;
    }

    // Light BRAND: each hit on an enemy raises its brand tier (up to _lightBrandMax, cap 3).
    // Higher tiers discount the stamina cost of attacking THAT enemy — so focusing a durable
    // target gets cheaper, while fodder dies before the brand ramps. Brand dies with the enemy
    // (it's per-enemy state on the sprite), so no permanent discount can be banked.
    _applyLightBrand(e){
        if(!this._lightBrand||!e?.sprite?.active)return;
        const max=this._lightBrandMax||1;
        e._lightBrandTier=Math.min(max,(e._lightBrandTier||0)+1);
        e._lightBrandShownAt=this.time.now;
    }
    // Discount multiplier for attacking a branded enemy (1 = full cost … 0.5 = half at tier 3).
    _lightBrandMult(e){
        const t=e?._lightBrandTier||0;
        // Deep endurance reward: a fully-seared target costs almost nothing to keep hitting, so
        // Light's STAYING POWER (its identity) is strong even though its raw damage is modest.
        return t>=3?0.18 : t===2?0.45 : t===1?0.72 : 1;
    }

    // ─── CLOAK / STEALTH SYSTEM ────────────────────────────────────────────────
    // A cloaked enemy is untargetable AND invincible: its health is frozen every
    // frame by _updateCloakSystem, so even an AoE tick that doesn't individually
    // check _cloaked still can't hurt it. The player can still SEE a faded sprite.
    // Cloaked enemies crawl (EnemyManager.moveEnemies reads _cloakSlowMult). The
    // only current decloak source is Light's reveal pulse; _permaCloaked enemies
    // (Wraith + its victims) re-cloak once their reveal window lapses. Designed so a
    // future camo-sight tower can reuse _revealEnemy / a canSeeCloaked flag verbatim.
    _cloakEnemy(e){
        if(!e||e._cloaked||!e.sprite)return;
        e._cloaked=true;
        e._cloakLockHealth=e.health;   // freeze point — invuln, but no free healing
        e._cloakSlowMult=e._cloakSlowMult||2.2;
        e._committedPath=null;          // re-plan at the new (slow) speed
        e.sprite.setAlpha(0.26);
        if(e.healthBarBg)   e.healthBarBg.setVisible(false);
        if(e.healthBarFill) e.healthBarFill.setVisible(false);
        const s=this.add.graphics().setDepth(6).setPosition(e.sprite.x,e.sprite.y);
        s.lineStyle(2,0x88aacc,0.85); s.strokeCircle(0,0,16);
        this.tweens.add({targets:s,alpha:0,scaleX:0.2,scaleY:0.2,duration:300,onComplete:()=>s.destroy()});
    }
    _revealEnemy(e,dur=5000){
        if(!e||!e._cloaked||!e.sprite?.active)return;
        e._cloaked=false;
        e._revealedUntil=this.time.now+dur;
        e._committedPath=null;          // regain normal speed immediately
        if(e.sprite) e.sprite.setAlpha(1);
        if(e.healthBarBg)   e.healthBarBg.setVisible(true);
        if(e.healthBarFill) e.healthBarFill.setVisible(true);
        const f=this.add.graphics().setDepth(6).setPosition(e.sprite.x,e.sprite.y);
        f.fillStyle(0xffffff,0.5); f.fillCircle(0,0,14);
        this.tweens.add({targets:f,alpha:0,scaleX:2,scaleY:2,duration:280,onComplete:()=>f.destroy()});
        this._showFloatingText(e.sprite.x,e.sprite.y-22,'REVEALED','#ffffaa');
    }
    _revealPulse(cx,cy,radius,dur=5000){
        if(!Number.isFinite(cx)||!Number.isFinite(cy))return; // wisp position not resolved yet
        const ring=this.add.graphics().setDepth(4);
        this.tweens.addCounter({from:0,to:1,duration:500,
            onUpdate:tw=>{
                // The graphics can be destroyed mid-tween (wave end / scene restart), and
                // drawing into a destroyed Graphics throws.
                if(!ring.active)return;
                const p=tw.getValue(); ring.clear(); ring.lineStyle(3,0xffffcc,0.9*(1-p)); ring.strokeCircle(cx,cy,10+radius*p);
            },
            onComplete:()=>{ if(ring.active) ring.destroy(); }});
        const r2=radius*radius;
        // Snapshot: _revealEnemy mutates enemy state, and killEnemy can splice this.enemies.
        for(const e of [...this.enemies]){
            if(!e?.sprite?.active||!e._cloaked)continue;
            const dx=e.sprite.x-cx, dy=e.sprite.y-cy;
            if(dx*dx+dy*dy<=r2) this._revealEnemy(e,dur);
        }
    }
    // Golden reveal beam — travels from Light to the target cloaked enemy, exposing it on
    // arrival. If the halo-chain upgrade is owned, the revealed enemy sprouts a brilliant halo
    // that jumps (with a short delay between hops) to nearby cloaked enemies, revealing and
    // chipping each — up to 3 jumps (4 revealed total), turning a cloaked cluster against itself.
    _fireRevealBeam(ox,oy,target){
        if(!target?.sprite?.active)return;
        const tx=target.sprite.x, ty=target.sprite.y;
        const dur=this._lightRevealDur||5000;
        const g=this.add.graphics().setDepth(5.5);
        const dist=Math.hypot(tx-ox,ty-oy);
        const travel=Math.min(360, 120+dist*1.2); // travel time scales a bit with distance
        this.tweens.addCounter({from:0,to:1,duration:travel,onUpdate:tw=>{
            if(!g.active)return;
            const p=tw.getValue(); const hx=ox+(tx-ox)*p, hy=oy+(ty-oy)*p;
            g.clear();
            g.lineStyle(4,0xffdd55,0.18); g.beginPath(); g.moveTo(ox,oy); g.lineTo(hx,hy); g.strokePath();
            g.lineStyle(2,0xfff2aa,0.85); g.beginPath(); g.moveTo(ox,oy); g.lineTo(hx,hy); g.strokePath();
            g.fillStyle(0xffffff,1); g.fillCircle(hx,hy,3);
            g.fillStyle(0xffdd55,0.5); g.fillCircle(hx,hy,6);
        },onComplete:()=>{
            if(g.active) this.tweens.add({targets:g,alpha:0,duration:180,onComplete:()=>g.destroy()});
            if(target?.sprite?.active&&target._cloaked){
                this._revealEnemy(target,dur);
                target._revealHaloUntil=this.time.now+900; // source glows
                if(this._lightBrand) this._applyLightBrand(target); // reveal also brands
                // Launch the cascade from the target's POSITION immediately, so it fires even if
                // the target is instantly deleted by massed fire the moment it's exposed.
                if(this._lightRevealChain) this._startRevealHalo(target.sprite.x,target.sprite.y,dur,3,target);
            }
        }});
    }
    // Staggered halo cascade from a position (not a live enemy) — survives the source dying.
    // Each hop reveals + brands + chips the nearest still-cloaked enemy, then continues.
    _startRevealHalo(fx,fy,dur,jumpsLeft,exclude){
        if(jumpsLeft<=0)return;
        this.time.delayedCall(320,()=>{ // brief delay before the halo can bounce (readable + counterplay)
            const R=4.5*this.TILE_SIZE;
            let next=null,bd=R*R;
            for(const e of this.enemies){
                if(!e?.sprite?.active||!e._cloaked||e===exclude)continue;
                const dx=e.sprite.x-fx, dy=e.sprite.y-fy, d2=dx*dx+dy*dy;
                if(d2<=bd){ bd=d2; next=e; }
            }
            if(next){
                const g=this.add.graphics().setDepth(5.5);
                g.lineStyle(2.5,0xffee88,0.85); g.beginPath(); g.moveTo(fx,fy); g.lineTo(next.sprite.x,next.sprite.y); g.strokePath();
                this.tweens.add({targets:g,alpha:0,duration:300,onComplete:()=>g.destroy()});
                this._revealEnemy(next,dur);
                if(this._lightBrand) this._applyLightBrand(next); // cascade also brands
                const nx=next.sprite.x, ny=next.sprite.y;         // capture position before possible death
                if(next.sprite?.active){ next.health-=Math.max(8,next.maxHealth*0.05); this.updateEnemyHealthBar(next); if(next.health<=0)this.killEnemy(next); }
                next._revealHaloUntil=this.time.now+900;
                this._startRevealHalo(nx,ny,dur,jumpsLeft-1,next); // continue from its position
            }
        });
    }
    _updateCloakSystem(time){
        // Light's reveal pulse (Revealing Light node) — passive, fires on its own timer.
        // It originates from the LIGHT WISP's own position, and only while that wisp is
        // genuinely active: equipped, awake (not resting/traveling to bed), not ghost-muted,
        // and not in a stamina lockout. If Light is asleep or unequipped, nothing pulses.
        // Light's REVEAL BEAM — Light detects cloaked enemies and, on a long cooldown, fires a
        // golden beam (with travel time) at the nearest one, exposing it. Not a blanket pulse
        // (that was a feel-bad hard counter) — a precious, limited, auto-aimed tool, so wraiths
        // stay threatening even with Light out. Positioning Light to cover stealth lanes is the
        // skill. The chain upgrade makes the reveal cascade through a cloaked cluster.
        if(this._lightRevealRadius){
            const lp=this.pets?.find(p=>p.type==='light'&&p.active
                &&!p._sleeping&&!p._travelingToSleep&&!p._flyingToBed
                &&!p._muted&&!p.fatigued);
            if(lp){
                const ox=lp._wx??this.player.x, oy=lp._wy??this.player.y;
                const R=this._lightRevealRadius*this.TILE_SIZE;
                if(time>=(this._nextLightReveal||0)){
                    // Find the nearest cloaked enemy in detection range.
                    let target=null,bd=R*R;
                    for(const e of this.enemies){
                        if(!e?.sprite?.active||!e._cloaked)continue;
                        const dx=e.sprite.x-ox, dy=e.sprite.y-oy, d2=dx*dx+dy*dy;
                        if(d2<=bd){ bd=d2; target=e; }
                    }
                    if(target){
                        this._nextLightReveal=time+(this._lightRevealCd||7000); // long cd — reveal is precious
                        this._fireRevealBeam(ox,oy,target);
                    }
                }
            } else {
                this._nextLightReveal=time+(this._lightRevealCd||7000);
            }
        }
        for(const e of this.enemies){
            if(!e||!e.sprite?.active)continue;
            if(e._permaCloaked&&!e._cloaked&&(e._revealedUntil||0)<=time) this._cloakEnemy(e);
            if(e._cloaked&&e._cloakLockHealth!=null) e.health=e._cloakLockHealth; // invincibility net
        }
    }

    _updateCustomEnemies(time,dt){
        for(const e of this.enemies){
            if(!e.sprite?.active)continue;

            // ── TOWER AGGRO TIERS ────────────────────────────────────────────────────────
            // Enemies fall into three tiers (set at spawn via _towerAggro):
            //   'ignore'        → beeline to base, never touch towers (basics, speed, etc.)
            //   'opportunistic' → head to base, but SWAT any tower they pass within melee range
            //   'hunter'        → actively path to & attack the nearest tower (sapper/EMS/berserker/rooter,
            //                     handled by their own dedicated logic)
            // This block handles the 'opportunistic' middle tier generically: if a tower is in
            // melee range, chip it on a short cooldown — no path detour, just punish proximity.
            if(e._towerAggro==='opportunistic' && time>=(e._oppSwatUntil||0)){
                const mr=this.TILE_SIZE*1.5;
                let near=null,bd=mr;
                for(const tw of (this.towers||[])){
                    if(!tw.active)continue;
                    const d=Math.hypot(tw.px-e.sprite.x,tw.py-e.sprite.y);
                    if(d<=bd){bd=d;near=tw;}
                }
                if(near){
                    e._oppSwatUntil=time+900;                 // swat cadence
                    this._damageTower(near,(e._tdDmg||5)*1.5); // a passing hit, not a full assault
                    const g=this.add.graphics().setDepth(5);
                    g.lineStyle(2.5,0xff8844,0.8);
                    g.lineBetween(e.sprite.x,e.sprite.y,near.px,near.py);
                    this.tweens.add({targets:g,alpha:0,duration:180,onComplete:()=>g.destroy()});
                }
            }

            // ── OVERHEAL DECAY — the excess above max HP bleeds off at a rate that grows
            // with how much overheal there is, so a huge shield is dramatic but short-lived
            // while a small top-up lingers. (Enemies re-topped by a totem each tick offset
            // this, so standing in the aura keeps them shielded.)
            if(e.sprite?.active && e.maxHealth>0 && e.health>e.maxHealth){
                const over=e.health-e.maxHealth;
                const frac=over/e.maxHealth;                 // how many "bars" of overheal
                // Rate grows with the SQUARE of the overheal fraction, so a big shield
                // evaporates fast (short lifetime) while a small top-up lingers. Tuned so
                // +400% is gone in ~5s, +100% in ~9s, +50% in ~12s.
                const ratePerSec=e.maxHealth*(0.02+0.10*frac*frac);
                e.health=Math.max(e.maxHealth, e.health-ratePerSec*dt);
                e._lastTrackedHealth=e.health;
            }
            // Overheal bar drawn every frame so it tracks the moving enemy (was inside
            // updateEnemyHealthBar, which only fires on damage → the bar lagged behind).
            this._drawOverheal(e);
            // Unified status icons (vulnerable / shielded / slowed / etc.) above the unit.
            this._updateStatusIcons(e);

            // ── ROOTER — keep the tendril mark on the sprite and hold its tint even when
            // pinned at the base (the move-loop updater stops running once it stops moving,
            // which left the mark frozen mid-map and the tint cleared).
            if(e.isRooter){
                if(e._rooterMark?.active){ e._rooterMark.x=e.sprite.x; e._rooterMark.y=e.sprite.y-22; }
                if(e.sprite?.active && !e._vulnerable && !e._encased){ e.sprite.setTint(0x226633); }
                this._updateRooterTether(e,time);
            }

            // ── REVEAL HALO — brilliant golden halo on an enemy marked by the reveal cascade ──
            if(e._revealHaloUntil>this.time.now && e.sprite?.active){
                if(!e._revealHaloGfx) e._revealHaloGfx=this.add.graphics().setDepth(6.6);
                const hg=e._revealHaloGfx; hg.clear();
                const t=this.time.now*0.008;
                const rr=13+2*Math.sin(t*2);
                hg.lineStyle(2.5,0xffee88,0.85); hg.strokeCircle(e.sprite.x,e.sprite.y,rr);
                hg.lineStyle(1.5,0xffffff,0.7); hg.strokeCircle(e.sprite.x,e.sprite.y,rr*0.7);
                // radiant spokes
                for(let k=0;k<8;k++){ const a=k*Math.PI/4+t; hg.lineStyle(1.5,0xfff2aa,0.5+0.3*Math.sin(t*3+k)); hg.beginPath(); hg.moveTo(e.sprite.x+Math.cos(a)*rr,e.sprite.y+Math.sin(a)*rr); hg.lineTo(e.sprite.x+Math.cos(a)*(rr+5),e.sprite.y+Math.sin(a)*(rr+5)); hg.strokePath(); }
            } else if(e._revealHaloGfx){
                e._revealHaloGfx.destroy(); e._revealHaloGfx=null;
            }

            // ── LIGHT BRAND — burning holy mark that intensifies with tier and decays if
            // Light stops feeding it (holds, then blinks, then loses a tier and fades). ──
            if(e._lightBrandTier>0 && e.sprite?.active){
                const now=this.time.now;
                const since=now-(e._lightBrandShownAt||0);
                const HOLD=2600, BLINK=1400;              // hold fully, then blink for a bit
                // Decay: once past HOLD+BLINK without a fresh hit, drop a tier and reset timer.
                if(since>HOLD+BLINK){
                    e._lightBrandTier--; e._lightBrandShownAt=now;
                    if(e._lightBrandTier<=0){ e._lightBrandGfx?.destroy(); e._lightBrandGfx=null; e._lightBrandFire?.destroy(); e._lightBrandFire=null; }
                }
                if(e._lightBrandTier>0){
                    const tier=e._lightBrandTier;
                    // Blink alpha in the blink window (fast flicker as it's about to fade).
                    let vis=1;
                    if(since>HOLD){ const bp=(since-HOLD)/BLINK; vis=0.35+0.65*Math.abs(Math.sin(now*0.02)); vis*=(1-bp*0.5); }
                    const bx=e.sprite.x, by=e.sprite.y-30; // brand anchor — marks + fire share this

                    // The MARKS are the brand; fire licks up AROUND them (drawn behind the text).
                    // More tiers = more/taller flame tongues surrounding the numerals.
                    if(!e._lightBrandFire) e._lightBrandFire=this.add.graphics().setDepth(6.85);
                    const fg=e._lightBrandFire; fg.clear();
                    const markW=tier*9;                       // marks span wider with more tiers
                    const flames=3+tier*3;                    // flame tongues wrap the marks
                    const height=9+tier*4;                    // taller blaze per tier
                    for(let i=0;i<flames;i++){
                        // Spread flames across the width of the marks so fire wraps the numerals.
                        const fx=bx+(i/(flames-1)-0.5)*(markW+6) + Math.sin(now*0.011+i)*1.3;
                        const flick=0.55+0.45*Math.sin(now*0.022+i*1.7);
                        const h=height*(0.55+0.45*Math.sin(now*0.016+i*2.3))*flick;
                        const baseY=by+5;                      // flames rise from just below the marks
                        fg.fillStyle(0xff4400,0.28*vis*flick); fg.fillTriangle(fx-3,baseY, fx+3,baseY, fx,baseY-h);
                        fg.fillStyle(0xff9922,0.50*vis*flick); fg.fillTriangle(fx-2,baseY-1, fx+2,baseY-1, fx,baseY-h*0.78);
                        fg.fillStyle(0xffee88,0.80*vis*flick); fg.fillTriangle(fx-1.2,baseY-2, fx+1.2,baseY-2, fx,baseY-h*0.52);
                    }
                    // Hot glow directly behind the marks so they read as sitting inside the blaze.
                    fg.fillStyle(0xff6622,0.30*vis*(0.6+0.4*Math.sin(now*0.03))); fg.fillCircle(bx,by,markW*0.6+5);

                    // Holy numeral marks — centered IN the fire (same anchor), glowing hot.
                    if(!e._lightBrandGfx){
                        e._lightBrandGfx=this.add.text(bx,by,'',{fontSize:'15px',fontFamily:'serif',color:'#fff6cc',fontStyle:'bold',stroke:'#ff5500',strokeThickness:4}).setOrigin(0.5).setDepth(7);
                    }
                    const bt=e._lightBrandGfx;
                    bt.setText('✦'.repeat(tier));
                    bt.x=bx; bt.y=by-1*Math.sin(now*0.006); // tiny bob, but stays inside the fire
                    bt.setAlpha(vis);
                }
            } else if(e._lightBrandGfx||e._lightBrandFire){
                e._lightBrandGfx?.destroy(); e._lightBrandGfx=null;
                e._lightBrandFire?.destroy(); e._lightBrandFire=null;
            }

            // ── BERSERKER — the more wounded, the more enraged. Move + swing speed ramp up
            // as HP drops, so chipping it makes it faster: burst it down or it sprints in.
            if(e._tdEMS && e.sprite?.active) this._updateEmsShield(e,time);
            if(e._brittle && e.sprite?.active) this._updateBrittleVisual(e,time);
            if(e._iceFrozen && e.sprite?.active){
                if(!e._iceFrozenGfx) e._iceFrozenGfx=this.add.graphics().setDepth((e.sprite.depth||1)+0.2);
                const g=e._iceFrozenGfx; g.clear();
                const x=e.sprite.x,y=e.sprite.y,fl=0.5+0.3*Math.sin(time*0.006);
                g.fillStyle(0x88ddff,0.25); g.fillCircle(x,y,10);
                g.lineStyle(1.5,0xcceeff,0.8+0.2*Math.sin(time*0.01));
                for(let i=0;i<6;i++){ const a=i*Math.PI/3+time*0.0005; g.beginPath(); g.moveTo(x,y); g.lineTo(x+Math.cos(a)*9,y+Math.sin(a)*9); g.strokePath(); }
                g.fillStyle(0xffffff,fl*0.5); g.fillCircle(x,y,3);
            }
            if(e._tdDemon && e.sprite?.active){ this._updateDemon(e,time,dt); if(e._demonHidden) this._setEnemyBarsVisible(e,false); }
            if(e._tdAngel && e.sprite?.active) this._updateAngel(e,time,dt);

            if(e._tdBerserker && e.sprite?.active){
                const missing=1-(e.health/(e.maxHealth||1));     // 0 (full) → 1 (near death)
                const rage=1+missing*2.4;                         // DRASTIC: up to 3.4× near death (was 2.4×)
                e._speedBuff=rage; e._anchorSpeedMult=rage;       // drives movement + shows up-arrows
                e._berserkSwingMult=rage;
                // Redden hard as it enrages.
                const g=Math.floor(0x55*(1-missing*0.85));
                e.sprite.setTint((0xff<<16)|(g<<8)|g);

                // TARGET TOWERS: a berserker hunts the nearest tower and swipes a 2×3 area in
                // front of it, damaging every tower caught — and LIFESTEALS from the damage it
                // deals, healing itself (and easing out of rage). Kill it fast or it snowballs.
                const TS=this.TILE_SIZE, huntR=16*TS;
                let tgt=null,bd=huntR*huntR;
                for(const tw of (this.towers||[])){
                    if(!tw.active)continue;
                    const dx=tw.px-e.sprite.x, dy=tw.py-e.sprite.y, d2=dx*dx+dy*dy;
                    if(d2<bd){bd=d2;tgt=tw;}
                }
                e._bersTarget=tgt;
                if(tgt){
                    const dist=Math.sqrt(bd);
                    // In swipe range → attack on a rage-accelerated cooldown.
                    if(dist<=2.2*TS){
                        const cd=(e._bersSwingCd||1100)/rage;      // rage speeds up swings too
                        if(time>=(e._bersNextSwing||0)){
                            e._bersNextSwing=time+cd;
                            this._berserkerSwipe(e,tgt);
                        }
                    }
                }
            }

            // ── HEALER SLIME — bob a heal cross above it; keep aura/particles anchored ──
            if(e.isHealerTotem && e._healSlimeMark?.active){
                const bob=Math.sin(time*0.005+e._healSlimePhase)*3;
                const mx=e.sprite.x, my=e.sprite.y-22+bob;
                const g=e._healSlimeMark; g.clear();
                g.fillStyle(0x66ffaa,0.35); g.fillCircle(mx,my,7);        // soft glow
                g.fillStyle(0xffffff,0.95);
                g.fillRect(mx-1.7,my-6,3.4,12);                           // vertical arm
                g.fillRect(mx-6,my-1.7,12,3.4);                           // horizontal arm
                if(e._healerAura?.active){ e._healerAura.x=e.sprite.x; e._healerAura.y=e.sprite.y; }
            }

            // ── BULWARK shield: face the base, regenerate after a break, draw the arc ──
            if(e._tdBulwark){
                e._shieldFacing=Math.atan2(this.basePy-e.sprite.y,this.basePx-e.sprite.x);
                if(e._shield<=0 && time>=e._shieldBrokenUntil){
                    e._shield=Math.min(e._shieldMax,e._shield+(e._shieldRegenRate||0.5)*(time-(e._shieldRegenLast||time)));
                }
                e._shieldRegenLast=time;
                if(e._shieldGfx?.active){
                    const g=e._shieldGfx; g.clear();
                    const up=e._shield>0, frac=e._shieldMax?e._shield/e._shieldMax:0;
                    const R=this.TILE_SIZE*1.25, half=(e._shieldArc||Math.PI*0.9)/2;
                    const cx2=e.sprite.x, cy2=e.sprite.y, f=e._shieldFacing||0;
                    if(up){
                        const hitFlash=(time-(e._shieldHitAt||0)<120)?0.4:0;
                        g.lineStyle(4,0x88ccff,0.55*frac+0.25+hitFlash);
                        g.beginPath(); g.arc(cx2,cy2,R,f-half,f+half,false); g.strokePath();
                        g.lineStyle(2,0xcceeff,0.4*frac+0.2+hitFlash);
                        g.beginPath(); g.arc(cx2,cy2,R-4,f-half,f+half,false); g.strokePath();
                        g.fillStyle(0x88ccff,0.08+0.10*frac);
                        g.beginPath(); g.moveTo(cx2,cy2);
                        g.arc(cx2,cy2,R,f-half,f+half,false); g.closePath(); g.fillPath();
                    } else {
                        const regenSoon=time>=e._shieldBrokenUntil;
                        g.lineStyle(1.5,0x445566,regenSoon?0.5:0.25);
                        for(let s=0;s<7;s++){ const a0=f-half+(s/7)*(half*2), a1=a0+(half*2/7)*0.5;
                            g.beginPath(); g.arc(cx2,cy2,R,a0,a1,false); g.strokePath(); }
                    }
                }
            }

            // ── BOMBER (sapper) — alert "!" + pulsing aura + detonate on contact ──────
            if(e._tdBomber){
                if(e._pulseGfx?.active){
                    const g=e._pulseGfx; g.clear();
                    const rushing=e._bomberState==='rush';
                    const p=0.5+0.5*Math.sin(time*(rushing?0.03:0.012));
                    const col=rushing?0xff0000:0xff3300;
                    g.lineStyle(rushing?3:2,col,0.4+0.5*p);
                    g.strokeCircle(e.sprite.x,e.sprite.y,10+p*(rushing?9:6));
                    g.fillStyle(0xffdd00,0.12+0.14*p);
                    g.fillCircle(e.sprite.x,e.sprite.y,10+p*(rushing?9:6));
                    // "!" during the alert pause
                    if(e._bomberState==='alert'){
                        g.fillStyle(0xffee00,1);
                        g.fillRect(e.sprite.x-1.5,e.sprite.y-30,3,10);
                        g.fillCircle(e.sprite.x,e.sprite.y-17,2);
                    }
                }
                const tt=e._bomberTarget;
                if(tt&&tt.active&&Math.hypot(tt.px-e.sprite.x,tt.py-e.sprite.y)<=this.TILE_SIZE*1.7){
                    this._bomberDetonate(e,tt);
                    continue;
                }
                const distBase=Math.abs(this.baseTileX-e.x)+Math.abs(this.baseTileY-e.y);
                if(distBase<=1){
                    this._bomberDetonate(e,null);
                    continue;
                }
            }

            // ── SPEEDY lightning aura — follow the sprite every frame (was a 600ms timer,
            // which lagged the fast slime badly). Regenerate the jagged shape periodically.
            if(e.isElectrical&&e._electricalAura?.active){
                if(time>=(e._boltNextGen||0)){
                    e._boltNextGen=time+140;
                    e._boltSeed=[];
                    for(let i=0;i<3;i++) e._boltSeed.push({ang:Math.random()*Math.PI*2,spread:(Math.random()-0.5)*1.2,r2:18+Math.random()*8});
                }
                const g=e._electricalAura; g.clear();
                const bx=e.sprite.x, by=e.sprite.y, r1=8;
                for(const s of e._boltSeed){
                    const ma=s.ang+s.spread, rmid=(r1+s.r2)/2;
                    g.lineStyle(1.5,0x44ffff,0.8);
                    g.beginPath();
                    g.moveTo(bx+Math.cos(s.ang)*r1,by+Math.sin(s.ang)*r1);
                    g.lineTo(bx+Math.cos(ma)*rmid,by+Math.sin(ma)*rmid);
                    g.lineTo(bx+Math.cos(s.ang)*s.r2,by+Math.sin(s.ang)*s.r2);
                    g.strokePath();
                }
            }

            // ── ADVANCING SHOOTERS (sniper + mobile ranged) ───────────────────
            // Both walk toward the base via the normal BFS mover (isRanged is false) and
            // lob a bolt at the base periodically once they have line of sight. Pinned
            // edge-spawned ranged enemies are excluded — updateRangedEnemies drives those.
            if((e._tdType==='sniper'||e._tdType==='ranged')&&!e._tdStationary){
                const TS=this.TILE_SIZE;
                const isSniper=e._tdType==='sniper';
                const fireKey=isSniper?'_sniperNextFire':'_rangedNextFire';
                const cadence=isSniper?2600:2000;
                const maxRange=isSniper?16:10;
                // Aim at whichever is closer: base, or a tower in range with line of sight.
                let aimTX=this.baseTileX, aimTY=this.baseTileY;
                let aimD=Math.abs(e.x-aimTX)+Math.abs(e.y-aimTY);
                for(const t of (this.towers||[])){
                    if(!t.active)continue;
                    const td=Math.abs(e.x-t.tileX)+Math.abs(e.y-t.tileY);
                    if(td<aimD&&td<=maxRange&&this._hasLineOfSight(e.x,e.y,t.tileX,t.tileY)){ aimD=td; aimTX=t.tileX; aimTY=t.tileY; }
                }
                if(time>=(e[fireKey]||0) && aimD<=maxRange &&
                   this._hasLineOfSight(e.x,e.y,aimTX,aimTY)){
                    e[fireKey]=time+cadence;
                    const ppx=aimTX*TS+TS/2, ppy=aimTY*TS+TS/2;
                    const dx=ppx-e.sprite.x, dy=ppy-e.sprite.y, len=Math.hypot(dx,dy)||1;
                    e.lockedDir={x:dx/len,y:dy/len};
                    this._fireEnemyProjectile(e);
                }
            }

            // ── WRAITH ────────────────────────────────────────────────────────
            // Permanently cloaked (player sees a faded sprite; untargetable until
            // revealed). Crawls toward base and, on a timer, permanently cloaks a
            // few nearby enemies — turning an ordinary wave into an invincible one
            // unless the player brought a reveal source.
            if(e._tdWraith){
                if(!e._wraithInit){
                    e._wraithInit=true; e._permaCloaked=true;
                    e._wraithCloakInterval=e._wraithCloakInterval||4200;
                    e._wraithCloakRadius=e._wraithCloakRadius||6;
                    e._wraithCloakCount=e._wraithCloakCount||3;
                    e._nextWraithPulse=time+1600;
                    if(!e._cloaked) this._cloakEnemy(e);
                }
                if(time>=(e._nextWraithPulse||0)){
                    e._nextWraithPulse=time+e._wraithCloakInterval;
                    const TS=this.TILE_SIZE, R=e._wraithCloakRadius*TS;
                    let count=0;
                    for(const o of this.enemies){
                        if(count>=e._wraithCloakCount)break;
                        if(o===e||!o.sprite?.active||o._cloaked||o._isTotem||o._isDummy)continue;
                        if(o._tdWraith||o._tdType==='healer_totem')continue;
                        if(Math.hypot(o.sprite.x-e.sprite.x,o.sprite.y-e.sprite.y)<=R){
                            this._cloakEnemy(o); o._permaCloaked=true; count++;
                            const beam=this.add.graphics().setDepth(3);
                            beam.lineStyle(2,0x88aacc,0.7); beam.lineBetween(e.sprite.x,e.sprite.y,o.sprite.x,o.sprite.y);
                            this.tweens.add({targets:beam,alpha:0,duration:400,onComplete:()=>beam.destroy()});
                        }
                    }
                    if(count>0) this._showFloatingText(e.sprite.x,e.sprite.y-24,'CLOAK','#aac4dd');
                }
            }

            // ── PORTAL BRINGER ────────────────────────────────────────────────
            if(e._tdPortalBringer){
                const TS=this.TILE_SIZE;
                const cr=this._centreRoom;
                const cx=Math.floor(cr.x+cr.w/2), cy=Math.floor(cr.y+cr.h/2);
                const inCentreRoom=e.x>=cr.x&&e.x<cr.x+cr.w&&e.y>=cr.y&&e.y<cr.y+cr.h;
                if(!e._pbAnchored&&inCentreRoom){
                    e._pbAnchored=true;
                    e._pbAnchorX=e.x; e._pbAnchorY=e.y; // remember exactly where it stopped
                    e.sprite.setTint(0xaa44ff);
                    this.enemiesLeft=Math.max(0,(this.enemiesLeft||1)-1);
                    this._showFloatingText(e.sprite.x,e.sprite.y-28,'PORTAL OPENED!','#aa44ff');
                }
                if(e._pbAnchored){
                    // Lock position every frame
                    e.x=e._pbAnchorX||e.x; e.y=e._pbAnchorY||e.y;
                    e._committedPath=null; e._pathIndex=undefined;
                    if(!e._pbFrozen){
                        e._pbFrozen=true;
                        const TS2=this.TILE_SIZE;
                        e.sprite.x=e.x*TS2+TS2/2; e.sprite.y=e.y*TS2+TS2/2+this.SLIME_Y_OFFSET;
                        if(e.healthBarBg){ e.healthBarBg.x=e.sprite.x; e.healthBarBg.y=e.sprite.y; }
                        if(e.healthBarFill){ e.healthBarFill.x=e.sprite.x; e.healthBarFill.y=e.sprite.y; }
                    }
                    // Every _pbPortalInterval ms, drop a mini-portal in a random spot in the centre room
                    if(time-e._pbLastPortal>=e._pbPortalInterval){
                        e._pbLastPortal=time;
                        const cr2=this._centreRoom;
                        let attempts=0, sx, sy;
                        do {
                            sx=cr2.x+1+Math.floor(Math.random()*(cr2.w-2));
                            sy=cr2.y+1+Math.floor(Math.random()*(cr2.h-2));
                            attempts++;
                        } while(attempts<20&&Math.hypot(sx-this.baseTileX,sy-this.baseTileY)<3);
                        if(this.world[sx]?.[sy]===this.FLOOR){
                            this._spawnMiniPortal(sx,sy,1);
                        }
                        e.sprite.setTint(0xffffff);
                        this.time.delayedCall(150,()=>{ if(e.sprite?.active) e.sprite.setTint(0xaa44ff); });
                    }
                }
                // Visual — two orbiting portal rings, one inside the other, rotating
                if(e._pbGfx?.active){
                    e._pbRot=(e._pbRot||0)+dt*2.2;
                    const g=e._pbGfx; g.clear();
                    const ex=e.sprite.x, ey=e.sprite.y;
                    // Outer ring: purple swirling arc
                    for(let i=0;i<2;i++){
                        const ang=e._pbRot+i*Math.PI;
                        const r=18+3*Math.sin(time*0.003);
                        g.lineStyle(2.5,0x9933ff,0.7);
                        g.beginPath(); g.arc(ex,ey,r,ang,ang+Math.PI*1.1,false); g.strokePath();
                        g.lineStyle(1,0xddaaff,0.4);
                        g.beginPath(); g.arc(ex,ey,r,ang+Math.PI*1.15,ang+Math.PI*1.7,false); g.strokePath();
                    }
                    // Inner ring: smaller, counter-rotating
                    for(let i=0;i<2;i++){
                        const ang=-e._pbRot*1.4+i*Math.PI;
                        g.lineStyle(1.8,0x6600cc,0.8);
                        g.beginPath(); g.arc(ex,ey,10,ang,ang+Math.PI*0.9,false); g.strokePath();
                    }
                    // Glowing portal core — swirls inward when anchored
                    const coreColor=e._pbAnchored?0xff88ff:0xaa44ff;
                    const corePulse=0.6+0.4*Math.sin(time*0.008);
                    g.fillStyle(coreColor,0.35*corePulse); g.fillCircle(ex,ey,8);
                    g.fillStyle(0xffffff,0.5*corePulse); g.fillCircle(ex,ey,3.5);
                    // Particles sucking inward if anchored (outward if traveling)
                    if(Math.random()<0.15){
                        const particleAng=Math.random()*Math.PI*2;
                        const particleR=e._pbAnchored?22:28;
                        const px2=ex+Math.cos(particleAng)*particleR;
                        const py2=ey+Math.sin(particleAng)*particleR;
                        const p=this.add.graphics().setDepth(3.3);
                        p.fillStyle(0xcc88ff,0.7); p.fillCircle(0,0,1.5);
                        p.x=px2; p.y=py2;
                        const targetX=e._pbAnchored?ex:px2+Math.cos(particleAng)*12;
                        const targetY=e._pbAnchored?ey:py2+Math.sin(particleAng)*12;
                        this.tweens.add({targets:p,x:targetX,y:targetY,alpha:0,duration:350,onComplete:()=>p.destroy()});
                    }
                }
            }

            // ── GHOST BUSTER ──────────────────────────────────────────────────
            if(e._tdGhostBuster){
                const TS=this.TILE_SIZE;
                // Visual — translucent ghostly body with drifting white wisps
                if(e._gbGfx?.active){
                    const g=e._gbGfx; g.clear();
                    const ex=e.sprite.x, ey=e.sprite.y;
                    const pulse=0.5+0.35*Math.sin(time*0.007);
                    // Main ghost body — soft translucent white oval
                    g.fillStyle(0xeeeeff,0.18*pulse); g.fillEllipse(ex,ey,26,22);
                    g.fillStyle(0xffffff,0.55*pulse); g.fillEllipse(ex,ey-2,16,18);
                    // Three wavy tail lobes (same ghost silhouette as phantom)
                    for(let t2=0;t2<3;t2++){
                        const tw=Math.sin(time*0.006+t2*1.4)*2;
                        g.fillStyle(0xffffff,0.45*pulse);
                        g.fillCircle(ex-4+t2*4+tw,ey+8,3.2-t2*0.3);
                    }
                    // Two dark hollow eyes — ghost style
                    g.fillStyle(0x111133,0.75); g.fillCircle(ex-3.5,ey-2,2); g.fillCircle(ex+3.5,ey-2,2);
                    // Ethereal outline ring
                    g.lineStyle(1,0xccccff,0.3*pulse); g.strokeCircle(ex,ey,14);
                    // Gun barrel — a small spectral cannon pointing downward
                    g.lineStyle(2,0xffffff,0.6*pulse); g.lineBetween(ex,ey+3,ex,ey+10);
                    g.fillStyle(0xffffff,0.7); g.fillCircle(ex,ey+10,2.2);
                }
                // Shoot 5-bullet ghostly spread at the base
                if(time-e._gbLastShot>=e._gbShotInterval){
                    e._gbLastShot=time;
                    this._fireGhostBusterSpread(e,time);
                }
            }

            // ── TAUNTER ──────────────────────────────────────────────────────
            if(e._tdTaunter&&e._taunterAura?.active){
                const R=e._taunterRadius*this.TILE_SIZE;
                e._taunterAura.clear();
                const t2=this.time.now*0.003;
                e._taunterAura.lineStyle(2,0xffbb33,0.35+0.15*Math.sin(t2));
                e._taunterAura.strokeCircle(e.sprite.x,e.sprite.y,R);
                e._taunterAura.fillStyle(0xffbb33,0.05); e._taunterAura.fillCircle(e.sprite.x,e.sprite.y,R);
                // Tag every enemy in radius as protected (drives the status icon).
                for(const o of this.enemies){
                    if(o===e||!o.sprite?.active)continue;
                    if(Math.hypot(o.sprite.x-e.sprite.x,o.sprite.y-e.sprite.y)<=R){ o._taunterProtected=true; o._taunterProtTouch=this.time.now; }
                }
            }

            // ── CEO ───────────────────────────────────────────────────────────
            if(e._tdCEO){
                // (Vertical shift is baked into the sprite origin at creation — no per-frame
                // y overwrite, which previously fought the movement tween and caused choppiness.)
                // Shield bar directly above HP bar
                if(e._ceoShieldBg?.active){
                    e._ceoShieldBg.x=e.sprite.x;    e._ceoShieldBg.y=e.sprite.y-14;
                    e._ceoShieldFill.x=e.sprite.x-11; e._ceoShieldFill.y=e.sprite.y-14;
                    e._ceoShieldFill.width=22*Math.max(0,e._ceoShield/e._ceoMaxShield);
                    e._ceoShieldBg.setVisible(e._ceoShield>0);
                    e._ceoShieldFill.setVisible(e._ceoShield>0);
                }
                // Hitbox ring follows sprite (with offset)
                if(e._ceoHitRing?.active){
                    e._ceoHitRing.x=e.sprite.x; e._ceoHitRing.y=e.sprite.y;
                }
                // NEARSIGHT: on a cooldown, the CEO curses a tower engaging it — that tower's
                // range collapses for a few seconds, punishing towers that focus the CEO and
                // forcing you to bring it down with range to spare (or eat the debuff).
                if(time-(e._ceoLastNearsight||0) > (e._ceoNearsightCd||5000)){
                    const TS=this.TILE_SIZE;
                    // Find a tower in range of the CEO (presumed to be shooting it) that isn't
                    // already nearsighted.
                    let victim=null,bd=12*TS;
                    for(const tw of (this.towers||[])){
                        if(!tw.active||tw._nearsightUntil>time)continue;
                        const d=Math.hypot(tw.px-e.sprite.x,tw.py-e.sprite.y);
                        if(d<=bd){bd=d;victim=tw;}
                    }
                    if(victim){
                        e._ceoLastNearsight=time;
                        victim._nearsightUntil=time+4000;      // range slashed for 4s
                        this._showStatusHit?.(victim,'NEARSIGHTED!','#cc88ff');
                    }
                }
                if(time-e._ceoLastTransform>e._ceoTransformInterval){
                    e._ceoLastTransform=time;
                    const nearby=this.enemies.find(n=>!n._tdCEO&&!n._ceoKnight&&n._tdType==='basic'&&n.sprite?.active&&
                        Math.hypot(n.sprite.x-e.sprite.x,n.sprite.y-e.sprite.y)<6*this.TILE_SIZE);
                    if(nearby) this._makeKnight(nearby);
                }
                if(time-e._ceoLastSwing>e._ceoSwingInterval){
                    e._ceoLastSwing=time;
                    const r=3*this.TILE_SIZE;
                    const sg=this.add.graphics().setDepth(4);
                    sg.x=e.sprite.x; sg.y=e.sprite.y;
                    sg.fillStyle(0x8844ff,0.4); sg.fillCircle(0,0,r);
                    this.tweens.add({targets:sg,alpha:0,scaleX:1.3,scaleY:1.3,duration:400,onComplete:()=>sg.destroy()});
                    this._damageBase(8);
                    this._showFloatingText(e.sprite.x,e.sprite.y-30,'SWING!','#8844ff');
                }
            }

            // Knight armour bar — stacked directly above HP bar (HP bar at sprite.y)
            if(e._ceoKnight&&e._knightArmourBg?.active){
                e._knightArmourBg.x=e.sprite.x;    e._knightArmourBg.y=e.sprite.y-6;
                e._knightArmourFill.x=e.sprite.x-11; e._knightArmourFill.y=e.sprite.y-6;
                e._knightArmourFill.width=22*Math.max(0,e._knightArmour/e._knightMaxArmour);
                e._knightArmourBg.setVisible(e._knightArmour>0);
                e._knightArmourFill.setVisible(e._knightArmour>0);
            }

            // ── INFERNAL ──────────────────────────────────────────────────────
            if(e._tdInfernal){
                const TS=this.TILE_SIZE;
                const R=10*TS; // range: shorter than sniper (16), longer than MG/tesla (5)
                // Lock the nearest tower in range (keep the current target if still valid).
                let tgt=e._infernalTarget;
                if(tgt && (!tgt.active || Math.hypot(tgt.px-e.sprite.x,tgt.py-e.sprite.y)>R)) tgt=null;
                if(!tgt){
                    let bd=R;
                    for(const tw of (this.towers||[])){
                        if(!tw.active)continue;
                        const d=Math.hypot(tw.px-e.sprite.x,tw.py-e.sprite.y);
                        if(d<=bd){bd=d;tgt=tw;}
                    }
                    e._infernalTarget=tgt;
                    if(tgt){ e._infernalStage=0; } // fresh lock resets the ramp
                }

                if(!tgt){
                    // No tower in range — stop lasering and advance toward the base normally.
                    if(e._infernalBeam){e._infernalBeam.destroy();e._infernalBeam=null;}
                    e._infernalStage=0; e.isMortar=false;
                    continue;
                }

                if(e._infernalStage===0){
                    e._infernalStage=1; e._infernalLastStageTime=time; e._infernalLockTime=time;
                    e.isMortar=true; // plant while lasering
                }
                // Advance stages — the longer the tower is lasered uninterrupted, the worse.
                const stageThresh=e._infernalStageThresholds[e._infernalStage-1]||99999;
                if(e._infernalStage<5&&time-e._infernalLastStageTime>stageThresh){
                    e._infernalStage++; e._infernalLastStageTime=time;
                    this._showFloatingText(e.sprite.x,e.sprite.y-24,`STAGE ${e._infernalStage}`,'#ff4400');
                }

                const stageW=[2,4,6,9,13][e._infernalStage-1]||2;
                const stageDPS=[6,14,30,55,110][e._infernalStage-1]||6; // scales hard — melts towers late
                const sx=e.sprite.x, sy=e.sprite.y, bpx=tgt.px, bpy=tgt.py;
                const ang=Math.atan2(bpy-sy,bpx-sx);
                const len=Math.hypot(bpx-sx,bpy-sy);
                const pulse=0.75+0.25*Math.sin(time*0.02);
                const flick=0.85+0.15*Math.sin(time*0.05+e.x);

                if(!e._infernalBeam||!e._infernalBeam.active){ e._infernalBeam=this.add.graphics().setDepth(3.5); }
                const g=e._infernalBeam; g.clear();
                g.lineStyle(stageW*3*pulse,0xff6600,0.10*flick); g.beginPath(); g.moveTo(sx,sy); g.lineTo(bpx,bpy); g.strokePath();
                g.lineStyle(stageW*1.7*pulse,0xff2200,0.45*flick); g.beginPath(); g.moveTo(sx,sy); g.lineTo(bpx,bpy); g.strokePath();
                g.lineStyle(stageW*0.8,0xffaa22,0.85); g.beginPath(); g.moveTo(sx,sy); g.lineTo(bpx,bpy); g.strokePath();
                g.lineStyle(Math.max(1,stageW*0.3),0xffffee,0.95); g.beginPath(); g.moveTo(sx,sy); g.lineTo(bpx,bpy); g.strokePath();
                const sparkN=2+e._infernalStage;
                for(let i=0;i<sparkN;i++){
                    const t=((time*0.0009*(1+e._infernalStage*0.4))+i/sparkN)%1;
                    const px=sx+Math.cos(ang)*len*t, py=sy+Math.sin(ang)*len*t;
                    const jit=(stageW*0.6); g.fillStyle(0xffdd66,0.8*flick);
                    g.fillCircle(px+Math.sin(t*30+i)*jit,py+Math.cos(t*30+i)*jit,stageW*0.28);
                }
                g.fillStyle(0xff4400,0.35*pulse); g.fillCircle(sx,sy,stageW*1.6*pulse);
                g.fillStyle(0xffcc44,0.9);        g.fillCircle(sx,sy,stageW*0.7);
                g.fillStyle(0xffffee,1);          g.fillCircle(sx,sy,stageW*0.35);
                const ir=stageW*(1.4+0.5*Math.sin(time*0.04));
                g.fillStyle(0xff5500,0.5*flick);  g.fillCircle(bpx,bpy,ir);
                g.fillStyle(0xffdd88,0.85);       g.fillCircle(bpx,bpy,ir*0.5);

                // Burn the TARGET TOWER. High stages destroy it — interrupt (kill the infernal)
                // before it reaches stage 4-5 or you lose the tower.
                this._damageTower(tgt, stageDPS*dt);
            }
        }

        // ── SPLITTER MARK TRACKING ──────────────────────────────────────────
        // updateRangedEnemies only runs this for isRanged enemies (wrong),
        // so we do it here every frame for all splitters instead.
        for(const e of this.enemies){
            if(e._splitterMark?.active&&e.sprite?.active){
                e._splitterMark.x=e.sprite.x;
                e._splitterMark.y=e.sprite.y-22;
            }
        }

        // ── FROZEN ENEMY DETECTION ──────────────────────────────────────────
        // Enemies that haven't moved in 4s but aren't fleeing/anchored/stationary
        // get their path cleared so they try to reroute rather than blocking traffic.
        if(!this._frozenCheckAt||time-this._frozenCheckAt>2000){
            this._frozenCheckAt=time;
            for(const e of this.enemies){
                if(!e.sprite?.active||e._isStationary||e._fleeing||e.isAnchor)continue;
                const ex=Math.round(e.sprite.x), ey=Math.round(e.sprite.y);
                if(e._lastCheckedX===ex&&e._lastCheckedY===ey){
                    e._frozenFrames=(e._frozenFrames||0)+1;
                    if(e._frozenFrames>=2){
                        // Force reroute — clear committed path so BFS recalculates
                        e._committedPath=null; e._pathIndex=undefined; e._frozenFrames=0;
                    }
                } else {
                    e._frozenFrames=0;
                }
                e._lastCheckedX=ex; e._lastCheckedY=ey;
            }
        }

        // ── SCRAP MERGING ─────────────────────────────────────────────────
        // When many orbs pile up at the same location, merge nearby ones into a
        // single larger orb to reduce graphics object count and prevent lag.
        if(!this._scrapMergeAt||time-this._scrapMergeAt>3000){
            this._scrapMergeAt=time;
            const TS=this.TILE_SIZE;
            const MERGE_R=TS*0.8; // orbs within 0.8 tiles of each other get merged
            for(let i=this.orbObjects.length-1;i>=0;i--){
                const a2=this.orbObjects[i];
                if(!a2.g?.active||a2.attracting)continue;
                for(let j=i-1;j>=0;j--){
                    const b=this.orbObjects[j];
                    if(!b.g?.active||b.attracting)continue;
                    if(Math.hypot(a2.g.x-b.g.x,a2.g.y-b.g.y)<MERGE_R){
                        // Merge a into b — b gets the combined value
                        b._value=(b._value||1)+(a2._value||1);
                        a2.g.destroy();
                        this.orbObjects.splice(i,1);
                        // Redraw b as a larger orb to reflect its new value
                        b.g.clear();
                        const v=b._value;
                        if(v>=20){
                            b.g.fillStyle(0xffaa00,1); b.g.fillCircle(0,0,9);
                            b.g.fillStyle(0xffdd44,0.85); b.g.fillCircle(0,0,6.5);
                            b.g.lineStyle(2,0xffcc00,0.9); b.g.strokeCircle(0,0,9);
                        } else if(v>=5){
                            b.g.fillStyle(0x44ffaa,1); b.g.fillCircle(0,0,7);
                            b.g.fillStyle(0x88ffcc,0.8); b.g.fillCircle(0,0,5);
                            b.g.lineStyle(1.5,0x00ffcc,0.9); b.g.strokeCircle(0,0,7);
                        } else {
                            b.g.fillStyle(0x00cc88,1); b.g.fillCircle(0,0,5);
                            b.g.fillStyle(0x00ffaa,0.8); b.g.fillCircle(0,0,3.5);
                            b.g.lineStyle(1.5,0x00ffcc,0.9); b.g.strokeCircle(0,0,5);
                        }
                        break; // only merge a once
                    }
                }
            }
        }
    }

    // Single chokepoint for wisp/tower damage so taunter redirect, knight armour and CEO
    // shield actually apply. Wisps historically did `enemy.health -= dmg` directly, which
    // bypassed all of that. Migrate damage sources onto this one at a time.
    // Single chokepoint for wisp/tower damage.
    //   opts.blockable  — true (default) direct-fire; false = lobbed/AoE, bypasses shields
    //   opts.fromX/fromY — attacker world position for the bulwark's directional shield
    _dealDamage(enemy,dmg,opts){
        if(!enemy?.sprite?.active||!dmg)return;
        // Fresh armour evaluation each hit — a stale bypass flag from a prior hit must not
        // carry over (AP re-sets it per hit from the sniper check inside the armour block).
        enemy._bypassArmour=false;
        // Wisp-sourced damage (for wisp-only targets like the flying Angel). Honours an explicit
        // opts.fromWisp even in DEFERRED callbacks where the ambient _updatePets flag has reset.
        const prevWisp=this._lastDamageFromWisp;
        if(opts?.fromWisp!==undefined) this._lastDamageFromWisp=opts.fromWisp;
        // Stash shield context read by damageEnemy for this one call, then clear it.
        this._bypassShield = opts?.blockable===false;
        this._shieldFromX = opts?.fromX; this._shieldFromY = opts?.fromY;
        this.damageEnemy(enemy,dmg);
        this._bypassShield=false; this._shieldFromX=this._shieldFromY=undefined;
        this._lastDamageFromWisp=prevWisp;
    }

    damageEnemy(enemy,dmg,...rest){
        if(!dmg||!enemy?.sprite?.active) return CombatSystem.prototype.damageEnemy.call(this,enemy,dmg,...rest);
        // ── BULWARK shield (direct-fire) ────────────────────────────────────────
        // Everything that reaches damageEnemy is direct-fire (towers, wisp bolts). Lobbed/AoE
        // sources (cannon, poison) apply damage directly to health and never come here, so
        // they correctly bypass the shield. The shield faces the base; towers sit on the base
        // side of the enemy, so tower fire is treated as frontal unless an explicit attacker
        // position (opts via _dealDamage) says otherwise.
        if(enemy._tdBulwark && enemy._shield>0 && enemy._shieldFacing!=null && !this._bypassShield){
            let inArc=true;
            const fx=this._shieldFromX, fy=this._shieldFromY;
            if(fx!=null&&fy!=null){
                const aToAttacker=Math.atan2(fy-enemy.sprite.y,fx-enemy.sprite.x);
                inArc=Math.abs(Phaser.Math.Angle.Wrap(aToAttacker-enemy._shieldFacing))<=(enemy._shieldArc||Math.PI*0.9)/2;
            }
            if(inArc){
                enemy._shield-=dmg; enemy._shieldHitAt=this.time.now;
                if(enemy._shield<=0){
                    enemy._shield=0;
                    enemy._shieldBrokenUntil=this.time.now+(enemy._shieldRegenDelay||4000);
                    this._showFloatingText(enemy.sprite.x,enemy.sprite.y-30,'SHIELD DOWN','#88ccff');
                }
                return; // absorbed
            }
        }
        // (Taunter redirect now lives in updateEnemyHealthBar so it catches every damage
        // source, including the wrench and wisps that bypass damageEnemy.)
        // CEO shield absorbs first
        if(enemy._tdCEO&&enemy._ceoShield>0){
            const absorbed=Math.min(enemy._ceoShield,dmg);
            enemy._ceoShield-=absorbed; dmg-=absorbed;
            if(dmg<=0){ enemy._lastTrackedHealth=enemy.health; return; }
        }
        // Check AP first so bypass is set before armour block
        const sniperTower=this._currentSniperBullet?._sourceTower||
            this.towers.find(t=>t.type==='sniper'&&t._sniperTarget===enemy);
        if(sniperTower&&sniperTower._snArmorPierce) enemy._bypassArmour=true;

        // Armour/shield — HP fully protected while armour > 0 (unless AP bypasses)
        if(!enemy._bypassArmour){
            if(enemy._ceoKnight&&enemy._knightArmour>0){
                // AP burns the armour pool at FULL damage; normal fire only 80% effective.
                // Either way the shot is spent on the armour — no leaking to the soft body
                // until the armour is fully stripped (that's what stops the one-shot).
                let apDmg=dmg;
                if(sniperTower&&sniperTower._snArmorPierce){
                    apDmg=dmg*1.5;                              // AP is elevated vs armour by default
                    if(sniperTower._snAntiArmor) apDmg=dmg*2.4; // Anti-Armor: shreds armour hard
                    enemy._knightArmour-=apDmg;
                    if(enemy.sprite?.active) this._showFloatingText(enemy.sprite.x,enemy.sprite.y-18,`-${Math.round(apDmg)}`,'#ffcc44');
                } else {
                    // Non-AP fire barely dents armour, AND a single hit can strip only a capped
                    // amount — so even a huge Light hit (solar/cascade burst) can't burst the
                    // armour down. Armour is a hit-COUNT wall; raw damage size can't shortcut it.
                    // AP (above) ignores this cap, staying the efficient armour counter.
                    const perHitArmourCap=(enemy._knightMaxArmour||enemy._knightArmour)*0.04; // ≤4% of pool per hit
                    enemy._knightArmour-=Math.min(dmg*0.2, perHitArmourCap);
                }
                if(enemy._knightArmour<0) enemy._knightArmour=0;
                enemy._lastTrackedHealth=enemy.health;
                enemy._bypassArmour=true; // armour already handled here — don't let
                                          // updateEnemyHealthBar dent it AGAIN with its own
                                          // formula (that double-dip was shredding knights)
                return; // HP untouched while armour holds
            } else if(enemy._tdCEO&&enemy._ceoShield>0){
                const absorbed=Math.min(enemy._ceoShield,dmg);
                enemy._ceoShield-=absorbed;
                dmg-=absorbed;
                if(dmg<=0){ enemy._lastTrackedHealth=enemy.health; return; }
            }
        }
        enemy._bypassArmour=true; // prevent updateEnemyHealthBar double-processing

        if(sniperTower){
            if(sniperTower._snArmorPierce){
                // AP vs armored: flat damage + 15% current HP
                if(enemy._ceoKnight||enemy._tdCEO){
                    const pctBonus=enemy.health*0.08;
                    dmg+=pctBonus;
                    if(sniperTower._snAntiArmor) dmg*=2;    // Anti-Armor: doubles the whole hit
                } else if(sniperTower._snAntiArmor){
                    dmg*=1.5; // Anti-Armor still does something vs non-armored
                }
            }
            // Crit
            if(sniperTower._snCritChance&&Math.random()<sniperTower._snCritChance){
                dmg*=(sniperTower._snCritMult||2);
                this._showFloatingText(enemy.sprite.x,enemy.sprite.y-28,'CRIT!','#ffdd44');
            }
            // Explosion on hit
            if(sniperTower._snExplode&&enemy.sprite?.active){
                const r=(sniperTower._snAoeR||1.5)*this.TILE_SIZE;
                const exp=this.add.graphics().setDepth(5);
                exp.x=enemy.sprite.x; exp.y=enemy.sprite.y;
                exp.fillStyle(0xff8844,0.6); exp.fillCircle(0,0,r);
                this.tweens.add({targets:exp,scaleX:1.4,scaleY:1.4,alpha:0,duration:280,onComplete:()=>exp.destroy()});
                for(const e2 of this.enemies){
                    if(!e2.sprite?.active||e2===enemy)continue;
                    if(Math.hypot(e2.sprite.x-enemy.sprite.x,e2.sprite.y-enemy.sprite.y)<=r){
                        CombatSystem.prototype.damageEnemy.call(this,e2,dmg*0.5);
                    }
                }
                // Shrapnel — percentage based so it chunks survivors regardless of HP pool
                if(sniperTower._snShrapnel){
                    for(let i=0;i<6;i++){
                        const ang=(i/6)*Math.PI*2;
                        const sg=this.add.graphics().setDepth(5);
                        sg.fillStyle(0xffaa44,0.9); sg.fillCircle(0,0,3);
                        sg.x=enemy.sprite.x; sg.y=enemy.sprite.y;
                        const tx=enemy.sprite.x+Math.cos(ang)*r*2;
                        const ty=enemy.sprite.y+Math.sin(ang)*r*2;
                        this.tweens.add({targets:sg,x:tx,y:ty,alpha:0,duration:320,onComplete:()=>{
                            for(const e2 of this.enemies){
                                if(!e2.sprite?.active)continue;
                                if(Math.hypot(e2.sprite.x-tx,e2.sprite.y-ty)<=this.TILE_SIZE*0.8){
                                    // 10% current HP per shrapnel — punishes tanky survivors
                                    const shrapDmg=Math.max(dmg*0.2, e2.health*0.02);
                                    CombatSystem.prototype.damageEnemy.call(this,e2,shrapDmg);
                                }
                            }
                            sg.destroy();
                        }});
                    }
                }
            }
        }
        CombatSystem.prototype.damageEnemy.call(this,enemy,dmg,...rest);
        // Sync tracked health so updateEnemyHealthBar doesn't double-absorb this hit
        if(enemy._lastTrackedHealth!==undefined) enemy._lastTrackedHealth=enemy.health;
    }

    _taunterTendrils(taunter){
        for(let i=0;i<2;i++){
            const ang=Math.random()*Math.PI*2;
            const len=taunter._taunterRadius*this.TILE_SIZE;
            const ex=taunter.sprite.x+Math.cos(ang)*len;
            const ey=taunter.sprite.y+Math.sin(ang)*len;
            const g=this.add.graphics().setDepth(4);
            g.lineStyle(2,0x44ff44,0.9);
            g.beginPath(); g.moveTo(taunter.sprite.x,taunter.sprite.y); g.lineTo(ex,ey); g.strokePath();
            this.tweens.add({targets:g,alpha:0,duration:300,onComplete:()=>g.destroy()});
        }
    }

    _checkEnemiesAtBase(){
        // Safety net: if killEnemy ever aborts partway (it destroys the sprite BEFORE
        // splicing the array), an invisible enemy would linger — chipping the base and
        // keeping enemiesLeft above zero so the wave never ends. Purge those here.
        for(let i=this.enemies.length-1;i>=0;i--){
            const e=this.enemies[i];
            if(!e){ this.enemies.splice(i,1); continue; }
            if(e.sprite&&!e.sprite.active&&!e._isDummy){
                this.enemies.splice(i,1);
                if(!e._isStationary||e._tdType==='sniper'||e._tdType==='ranged') this.enemiesLeft=Math.max(0,this.enemiesLeft-1);
            }
        }
        const R=3*this.TILE_SIZE+8;
        for(let i=this.enemies.length-1;i>=0;i--){
            const e=this.enemies[i];
            if(!e||!e.sprite?.active||e._isTotem||e._isDummy||e._fleeing)continue;
            const dx=this.basePx-e.sprite.x,dy=this.basePy-e.sprite.y;
            if(Math.sqrt(dx*dx+dy*dy)<=R){
                // Leaked enemies hurt MORE as waves scale — a missed W30 wave should threaten
                // the run, not shrug off. Base per-type dmg × a wave multiplier.
                const waveDmgMult=1+((this.wave||1)*0.06); // W10 1.6×, W20 2.2×, W30 2.8×
                const dmg=(e._tdDmg||8)*waveDmgMult;
                this._damageBase(dmg);
                this.killEnemy(e);
            }
        }
    }

    _damageBase(amount){
        // Bulwark Aura (fountain): base takes less damage while a warding fountain reaches it.
        if(this._baseWardActive) amount*=0.88;
        if(this.shieldPct>0&&Math.random()<this.shieldPct){this._showFloatingText(this.basePx,this.basePy-50,'REFLECTED','#aaddff');return;}
        // Fountain projectile shield absorbs damage first (regenerates while a fountain covers
        // the base). This is what makes a fountain near-mandatory against ranged barrages.
        if(this._baseProjShield>0){
            const absorbed=Math.min(this._baseProjShield,amount);
            this._baseProjShield-=absorbed; amount-=absorbed;
            if(absorbed>0) this._showFloatingText(this.basePx+(Math.random()-0.5)*36,this.basePy-46,'🛡 SHIELD','#88ddff');
            if(amount<=0)return;
        }
        // Pink overheal shield absorbs damage first
        if(this._pinkShield>0){
            const absorbed=Math.min(this._pinkShield,amount);
            this._pinkShield-=absorbed; amount-=absorbed;
            if(absorbed>0) this._showFloatingText(this.basePx+(Math.random()-0.5)*30,this.basePy-40,'💗 ABSORBED','#ff88bb');
            if(this._pinkShield<=0){ this._pinkShieldGfx?.destroy(); this._pinkShieldGfx=null; }
            if(amount<=0)return;
        }
        const rounded=Math.round(amount);
        if(rounded>0) this._showFloatingText(this.basePx+(Math.random()-0.5)*40,this.basePy-30,`-${rounded}`,'#ff2222');
        this.baseHP=Math.max(0,this.baseHP-amount);this.cameras.main.shake(12,0.002);
        if(this.baseHP<=0)this._triggerGameOver();
    }

    // ─── WAVES ────────────────────────────────────────────────────────────────
    // Stationary types spawn at room edges, not portals
    _isStationary(type){ return type==='mortar'||type==='healer_totem'||type==='sniper'||type==='ranged'; }

    // Inner tiles within 8 tiles of base — for sniper enemies (need AGGRO_RANGE<=12)
    // Corridor mouths: FLOOR tiles just OUTSIDE the centre room's edge, on the approach
    // from each portal. Placing healer totems here means they overheal enemies exactly as
    // they funnel into the main room and enter the base's kill zone — the chokepoint you
    // actually want, not the far portal end.
    // Nearest walkable tile adjacent to (tx,ty), preferring the side closest to (fromX,fromY).
    // Towers occupy non-walkable tiles, so anything hunting a tower must path to a neighbour.
    _nearestWalkableAdjacent(tx,ty,fromX,fromY){
        const cand=[[tx+1,ty],[tx-1,ty],[tx,ty+1],[tx,ty-1],[tx+1,ty+1],[tx-1,ty-1],[tx+1,ty-1],[tx-1,ty+1]];
        let best=null,bd=1e9;
        for(const [x,y] of cand){
            if(this.world?.[x]?.[y]!==this.FLOOR)continue;
            const d=Math.abs(x-fromX)+Math.abs(y-fromY);
            if(d<bd){bd=d;best={x,y};}
        }
        return best||{x:tx,y:ty};
    }

    _getCorridorMouthTiles(){
        // On the branching map, each approach rejoins at a merge point just outside the
        // centre room — that's the true chokepoint where enemies re-converge, so totems go
        // there. Falls back to the angular walk for any approach without a stored merge.
        const tiles=[];
        for(const a of (this._approaches||[])){
            if(a && this.world[a.mergeX]?.[a.mergeY]===this.FLOOR){
                tiles.push({x:a.mergeX,y:a.mergeY});
            }
        }
        if(tiles.length) return tiles;
        // Fallback: original straight-corridor walk.
        const cr=this._centreRoom;
        const cx=Math.floor(cr.x+cr.w/2), cy=Math.floor(cr.y+cr.h/2);
        for(const pr of (this._portalRooms||[])){
            const prx=Math.floor(pr.x+pr.w/2), pry=Math.floor(pr.y+pr.h/2);
            const ang=Math.atan2(pry-cy,prx-cx);
            for(let d=Math.max(cr.w,cr.h)/2; d<Math.max(cr.w,cr.h)/2+10; d++){
                const tx=Math.round(cx+Math.cos(ang)*d), ty=Math.round(cy+Math.sin(ang)*d);
                const outsideRoom = tx<cr.x||tx>=cr.x+cr.w||ty<cr.y||ty>=cr.y+cr.h;
                if(outsideRoom && this.world[tx]?.[ty]===this.FLOOR){ tiles.push({x:tx,y:ty}); break; }
            }
        }
        return tiles.length?tiles:this._getPortalEntranceTiles();
    }

    _getPortalEntranceTiles(){
        // Returns tiles ~4 tiles away from each portal room's center,
        // along the path toward the main room — where totems can heal incoming enemies.
        const TS=this.TILE_SIZE;
        const cr=this._centreRoom;
        const cx=Math.floor(cr.x+cr.w/2), cy=Math.floor(cr.y+cr.h/2);
        const tiles=[];
        for(const pr of (this._portalRooms||[])){
            const prx=Math.floor(pr.x+pr.w/2), pry=Math.floor(pr.y+pr.h/2);
            const dx=Math.sign(cx-prx), dy=Math.sign(cy-pry);
            // Walk 4 tiles from portal center toward main room center.
            // (Two dead lines here previously called `clamp`, which is a local defined
            // inside _waveComposition — out of scope here, so this threw a ReferenceError
            // the first time a healer totem tried to pick an entrance tile.)
            const clamp2=(v,lo,hi)=>Math.max(lo,Math.min(hi,v));
            const fx=clamp2(prx+dx*4,2,this.WORLD_WIDTH-2);
            const fy=clamp2(pry+dy*4,2,this.WORLD_HEIGHT-2);
            if(this.world[fx]?.[fy]===this.FLOOR) tiles.push({x:fx,y:fy});
        }
        return tiles.length?tiles:this._getEdgeSpawnTiles();
    }

    _getInnerSpawnTiles(){
        const cr=this._centreRoom, tiles=[];
        for(let x=cr.x+1;x<cr.x+cr.w-1;x++){
            for(let y=cr.y+1;y<cr.y+cr.h-1;y++){
                const d=Math.abs(x-this.baseTileX)+Math.abs(y-this.baseTileY);
                // Within aggro range but not too close to altar (d>3) and is floor
                if(d>=5&&d<=10&&this.world[x]?.[y]===this.FLOOR){
                    tiles.push({x,y});
                }
            }
        }
        return tiles.length?tiles:[{x:this.baseTileX+4,y:this.baseTileY}];
    }
    _getEdgeSpawnTiles(){
        const cr=this._centreRoom;
        const tiles=[];
        // Top and bottom edges (skip corners)
        for(let x=cr.x+2;x<cr.x+cr.w-2;x+=3){
            tiles.push({x,y:cr.y+1});           // top edge
            tiles.push({x,y:cr.y+cr.h-2});      // bottom edge
        }
        // Left and right edges
        for(let y=cr.y+2;y<cr.y+cr.h-2;y+=3){
            tiles.push({x:cr.x+1,    y});        // left edge
            tiles.push({x:cr.x+cr.w-2,y});       // right edge
        }
        return tiles;
    }

    _waveComposition(wave){
        const a=(t,n)=>Array(n).fill(t);
        const clamp=(v,lo,hi)=>Math.max(lo,Math.min(hi,v));

        // ── STRUCTURED WAVE SCHEDULE ──────────────────────────────────────────
        // Named waves override the formula entirely for a specific designed feel.
        // Formula waves fill the gaps with gradual scaling.
        // Every 5th wave is a boss or major event wave.
        // ─────────────────────────────────────────────────────────────────────
        //  W1  : Tutorial — just basics, nothing scary
        //  W2  : A few ranged introduced gently
        //  W3  : Bigger basic swarm
        //  W4  : First berserker appears
        //  W5  : BOSS — Bulwark (big tanky berserker, lots of HP, requires sustained DPS)
        //  W6  : Speedies introduced — first panic wave
        //  W7  : Mixed basic+ranged+berserker
        //  W8  : Speed swarm — many speedies, single target wisps shine against runners
        //  W9  : Rooters introduced
        //  W10 : BOSS — Torrent (giant basic that periodically emits a shockwave)
        //  W11 : First portal bringer
        //  W12 : Mortar introduced — first base-targeting threat
        //  W13 : Splitters + speed combo
        //  W14 : Ghost Buster appears — wises up the player on wisp variety
        //  W15 : BOSS — The Stampede (20 speedies all at once — multi-target fire/turrets shine)
        //  W16 : Anchor slime — changes movement dynamics
        //  W17 : Sniper + ranged corner siege
        //  W18 : Mixed heavy wave
        //  W19 : Portal Bringer + ghost buster combo
        //  W20 : BOSS — Architect (healer totem escort — must kill totem first)
        //  W25 : BOSS — The Hivemind (3 portal bringers, must shut them all down fast)
        //  W30 : BOSS — Voltclaw (CEO with extra knights + anchor aura)

        const namedWaves = {
            1:  { mobile: a('basic',8) },
            2:  { mobile: [...a('basic',11)] },
            3:  { mobile: a('basic',15) },
            4:  { mobile: [...a('basic',10), ...a('berserker',4)] },
            5:  { mobile: [...a('basic',8), ...a('berserker',3), ...a('speed',5)],
                  stationary: [], _banner:'⚔ BULWARK APPROACHES ⚔', _bannerCol:'#ff8844' },
            6:  { mobile: [...a('speed',10), ...a('basic',7)] },
            7:  { mobile: [...a('basic',13), ...a('berserker',4)] },
            8:  { mobile: [...a('speed',18), ...a('basic',5)],
                  _banner:'💨 SPEED SWARM! 💨', _bannerCol:'#44ffee' },
            9:  { mobile: [...a('basic',13), ...a('rooter',3)] },
            10: { mobile: [...a('berserker',8), ...a('basic',6), ...a('speed',6)],
                  _banner:'🌊 THE TORRENT 🌊', _bannerCol:'#4488ff' },
            11: { mobile: [...a('basic',10), ...a('portal_bringer',1)] },
            12: { mobile: [...a('basic',8), ...a('berserker',5)],
                  stationary: ['mortar'],
                  _banner:'💥 MORTAR DEPLOYED 💥', _bannerCol:'#ffaa44' },
            13: { mobile: [...a('splitter',6), ...a('speed',8), ...a('basic',5)] },
            14: { mobile: [...a('basic',13), ...a('ghost_buster',1)],
                  _banner:'👻 GHOST BUSTER 👻', _bannerCol:'#8888ff' },
            15: { mobile: a('speed',30),
                  _banner:'🏃 THE STAMPEDE 🏃', _bannerCol:'#44ffee' },
            16: { mobile: [...a('basic',10), ...a('berserker',5), ...a('anchor',2)] },
            17: { mobile: [...a('basic',13)],
                  stationary: ['sniper','sniper'],
                  _banner:'🎯 CORNER SIEGE 🎯', _bannerCol:'#ccaa44' },
            18: { mobile: [...a('berserker',6), ...a('speed',7), ...a('rooter',4), ...a('splitter',4)] },
            19: { mobile: [...a('basic',7), ...a('portal_bringer',1), ...a('ghost_buster',1)] },
            20: { mobile: [...a('berserker',5), ...a('basic',6), ...a('taunter',1)],
                  stationary: ['healer_totem','healer_totem'],
                  _banner:'🏛 THE ARCHITECT 🏛', _bannerCol:'#44ff88' },
            22: { mobile: [...a('knight',3), ...a('berserker',4), ...a('basic',5)],
                  _banner:'🛡 IRON VANGUARD 🛡', _bannerCol:'#dd88ff' },
            25: { mobile: [...a('basic',6), ...a('speed',6), ...a('portal_bringer',2), ...a('ceo',1)],
                  _banner:'🌀 THE HIVEMIND 🌀', _bannerCol:'#aa44ff' },
            28: { mobile: [...a('wraith',1), ...a('basic',8), ...a('berserker',4)],
                  stationary: [],
                  _banner:'👁 THE VEIL 👁', _bannerCol:'#aac4dd' },
            30: { mobile: [...a('berserker',5), ...a('anchor',3), ...a('infernal',1)],
                  stationary: ['mortar','mortar'],
                  _banner:'⚡ VOLTCLAW ⚡', _bannerCol:'#ffdd44' },
            33: { mobile: [...a('wraith',2), ...a('knight',3), ...a('speed',8)],
                  stationary: ['sniper'],
                  _banner:'🌑 SHROUDED HOST 🌑', _bannerCol:'#8899cc' },
            35: { mobile: [...a('ceo',1), ...a('infernal',2), ...a('taunter',2), ...a('portal_bringer',2), ...a('berserker',6)],
                  stationary: ['mortar','healer_totem'],
                  _banner:'👑 THE CONVERGENCE 👑', _bannerCol:'#ffcc44', _final:true },
        };

        if(namedWaves[wave]){
            const named=namedWaves[wave];
            return {
                mobile:    named.mobile||[],
                stationary:named.stationary||[],
                _banner:   named._banner,
                _bannerCol:named._bannerCol,
                _final:    named._final||false,
            };
        }

        // ── FORMULA WAVES (fill the gaps) ─────────────────────────────────────
        let mobile=[], stationary=[];

        // Counts scaled up and elite threats pulled earlier — high waves were spawning ~10
        // enemies over a long interval, so the field looked empty. Bigger counts + a tighter
        // spawn interval (below) make late waves feel like a genuine flood.
        const basic = wave<=4  ? 6+wave : wave<=12 ? 14 : wave<=30 ? 16 : 12;

        const ranged = wave<5  ? 0
                     : wave<=12 ? clamp((wave-4)*2,2,12)
                     : clamp(12+Math.floor((wave-12)/2),12,26);

        const berserker = wave<8  ? 0
                        : wave<=18 ? clamp((wave-7)*2,2,22)
                        : clamp(22+Math.floor((wave-18)/2),22,44);

        const speed = wave<13 ? 0
                    : wave<=25 ? clamp((wave-12)*3,3,30)
                    : clamp(30+Math.floor((wave-25)/2),30,60);

        const splitter = wave<18 ? 0
                       : wave<=32 ? clamp(Math.floor((wave-16)),2,18)
                       : clamp(18+Math.floor((wave-32)/2),18,40);

        const rooter = wave<23 ? 0
                     : wave<=40 ? clamp(Math.floor((wave-21)),2,16)
                     : clamp(16+Math.floor((wave-40)/3),16,30);

        // Elite threats now appear through the mid-game instead of W50+, so W25-45 has real
        // texture (armour, taunts, boss beams) rather than only basics/zerks/speed.
        const taunter  = wave<24 ? 0 : clamp(1+Math.floor((wave-24)/8),1,6);
        const knight   = wave<26 ? 0 : clamp(1+Math.floor((wave-26)/6),1,6);
        const ceo      = wave<32 ? 0 : clamp(1+Math.floor((wave-32)/10),1,4);
        const infernal = wave<30 ? 0 : clamp(1+Math.floor((wave-30)/8),1,5);

        const portalBringer = wave<15 ? 0 : wave<28 ? 1 : wave<45 ? (Math.random()<0.5?2:1) : 3;
        const ghostBuster   = wave<20 ? 0 : wave<35 ? 1 : clamp(Math.floor((wave-20)/8),1,4);
        const wraith        = wave<32 ? 0 : clamp(Math.floor((wave-31)/6),1,4); // stealth pressure late
        // Sappers: start mid-game, arrive in sizeable packs — individually killable, but a
        // cluster overwhelms a tower line since towers can't focus them all before they land.
        const bomber        = wave<22 ? 0 : clamp(3+Math.floor((wave-22)/2),3,20);
        // Bulwarks: front-line shields. Appear mid-game; a couple per wave is plenty since
        // they force you to bring lobbed/AoE answers rather than out-DPS them head-on.
        const bulwark       = wave<20 ? 0 : clamp(1+Math.floor((wave-20)/7),1,5);

        if(basic     >0) mobile.push(...a('basic',          basic));
        if(berserker >0) mobile.push(...a('berserker',      berserker));
        if(speed     >0) mobile.push(...a('speed',          speed));
        if(rooter    >0) mobile.push(...a('rooter',         rooter));
        if(splitter  >0) mobile.push(...a('splitter',       splitter));
        if(knight    >0) mobile.push(...a('knight',         knight));
        if(taunter   >0) mobile.push(...a('taunter',        taunter));
        if(ceo       >0) mobile.push(...a('ceo',            ceo));
        if(infernal  >0) mobile.push(...a('infernal',       infernal));
        if(portalBringer>0) mobile.push(...a('portal_bringer',portalBringer));
        if(ghostBuster  >0) mobile.push(...a('ghost_buster',  ghostBuster));
        if(wraith       >0) mobile.push(...a('wraith',         wraith));
        if(bomber       >0) mobile.push(...a('bomber',          bomber));
        if(bulwark      >0) mobile.push(...a('bulwark',         bulwark));
        // Interleave so the wave arrives as a MIX (basic+zerk+speed together) instead of
        // one long block of basics, then a block of zerks — that blocky order was part of
        // why waves felt thin and predictable moment-to-moment.
        this._shuffleWave?.(mobile);

        const mortarCount     = wave<28 ? 0 : wave<40 ? 1 : wave<55 ? 2 : clamp(2+Math.floor((wave-55)/20),2,3);
        const healerCount     = wave<33 ? 0 : wave<48 ? 1 : 2;
        const anchorCount     = wave<43 ? 0 : wave<58 ? 1 : 2;
        const sniperEdgeCount = wave<38 ? 0 : wave<50 ? 1 : clamp(Math.floor((wave-38)/6),1,3);
        const rangedEdgeCount = wave<5  ? 0 : wave<20 ? 1 : clamp(Math.floor((wave-5)/10),1,2);

        if(mortarCount    >0) stationary.push(...a('mortar',       mortarCount));
        if(healerCount    >0) stationary.push(...a('healer_totem', healerCount));
        if(anchorCount    >0) mobile.push(    ...a('anchor',       anchorCount));
        if(sniperEdgeCount>0) stationary.push(...a('sniper',       sniperEdgeCount));

        return{ mobile, stationary };
    }

    // _waveComposition rolls Math.random() (portal bringer count), so calling it twice
    // gives different answers. The wave TV must show EXACTLY what will spawn, so both it
    // and _startNextWave read this cached, roll-once-per-wave result.
    _getWaveComposition(wave){
        if(!this._waveCompCache||this._waveCompCache.wave!==wave){
            this._waveCompCache={wave,comp:this._waveComposition(wave)};
        }
        return this._waveCompCache.comp;
    }

    _startNextWave(){
        if(this.gameOver)return;
        this.wave++;
        const waveToken=++this._waveToken; // stale spawns from an abandoned wave will no-op
        const {mobile,stationary,_banner,_bannerCol,_final}=this._getWaveComposition(this.wave);
        this._currentWaveFinal=!!_final;

        this._clearStationaries();

        const edgeTiles=this._getEdgeSpawnTiles();
        const innerTiles=this._getInnerSpawnTiles();
        Phaser.Utils.Array.Shuffle(edgeTiles);
        Phaser.Utils.Array.Shuffle(innerTiles);

        this._waveStartTime=this.time.now;
        const spawnTimes=this._computeSpawnTimes(this.wave,mobile.length);
        this._waveMobileInterval=spawnTimes.length>1?(spawnTimes[1]-spawnTimes[0]):400;
        this._waveSpawnTimes=spawnTimes.slice(); // exact per-index schedule for the TV belt
        const waveExpectedDur=(spawnTimes[spawnTimes.length-1]||0)+400;
        let edgeIdx=0, innerIdx=0;
        stationary.forEach((type,i)=>{
            const frac=(stationary.length>1?(i/(stationary.length-1)):0.5);
            const delay=Math.round(waveExpectedDur*(0.2+frac*0.6));
            this.time.delayedCall(delay,()=>{
                if(this.gameOver||this._waveToken!==waveToken)return;
                if(type==='ranged'){
                    const t=innerTiles[innerIdx%innerTiles.length]; innerIdx++;
                    this._spawnEnemy(type,t.x,t.y,1,true);
                } else if(type==='sniper'){
                    // Snipers advance from a portal like other enemies (mobile), firing as
                    // they close — never pinned, so they always reach the kill zone.
                    const room=this._portalRooms[Math.floor(Math.random()*this._portalRooms.length)];
                    this._spawnEnemy(type,room.x+Math.floor(room.w/2),room.y+Math.floor(room.h/2),1,false);
                } else if(type==='healer_totem'){
                    // At the corridor MOUTHS into the main room, so they overheal enemies as
                    // they funnel in and enter the base's fire — not parked out by the portals.
                    const entranceTiles=this._getCorridorMouthTiles();
                    const t=entranceTiles[i%entranceTiles.length]||edgeTiles[edgeIdx%edgeTiles.length];
                    edgeIdx++;
                    this._spawnEnemy(type,t.x,t.y,1,true);
                } else {
                    const t=edgeTiles[edgeIdx%edgeTiles.length]; edgeIdx++;
                    this._spawnEnemy(type,t.x,t.y,1,true);
                }
            });
        });

        this.enemiesLeft=mobile.length+stationary.filter(t=>t==='sniper'||t==='ranged').length;

        // Named-wave banner overrides the generic "WAVE N" for designed moments
        if(_banner){
            this._showBanner(`WAVE ${this.wave} — ${_banner}`,_bannerCol||'#ffdd44',`${mobile.length} enemies${stationary.length?` + ${stationary.length} installations`:''}`);
        } else {
            this._showBanner(`WAVE ${this.wave}`,'#ffdd44',`${mobile.length} enemies${stationary.length?` + ${stationary.length} installations`:''}`);
        }

        mobile.forEach((type,i)=>this.time.delayedCall(spawnTimes[i]??(i*400),()=>{
            if(this.gameOver||this._waveToken!==waveToken)return;
            // Spread a surge across DIFFERENT portals so a cluster attacks from multiple
            // sides at once rather than single-file from one doorway.
            const rooms=this._portalRooms;
            const roomIdx=(i+ (Math.random()<0.5?0:1))%rooms.length;
            const room=rooms[roomIdx];
            const e=this._spawnEnemy(type,room.x+Math.floor(room.w/2),room.y+Math.floor(room.h/2),1,false);
            // Assign this enemy to one of the two sub-lanes of its approach, alternating so
            // the crowd splits evenly around the wall pillar instead of all taking the
            // fractionally-shorter branch. The lane's bow point is a waypoint it heads to
            // before continuing to the base.
            if(e){
                const appr=this._approaches?.[roomIdx];
                if(appr?.bows?.length){
                    const lane=i%2;
                    const bow=appr.bows[lane];
                    e._laneWaypoint={x:bow.x,y:bow.y};
                    e._laneMergeReached=false;
                }
            }
        }));
        this.waveActive=true;
        this._guardianUsed={}; // Guardian triggers once per tower per wave
        for(const t of (this.towers||[])) t._negateReadyAt=0; // fatal-hit negations refresh each wave
        // Enemy speed slowly increases with waves — each wave they move a little faster
        // by tightening their step cooldown. 1000ms base, shrinks ~4ms per wave, min 500ms.
        this.enemyMoveCooldown=Math.max(500,1000-this.wave*4);
    }

    _clearStationaries(){
        for(let i=this.enemies.length-1;i>=0;i--){
            const e=this.enemies[i];
            if(e._isStationary&&e.sprite?.active) this.killEnemy(e);
        }
    }

    // Static enemy stat/visual tables — memoized (previously rebuilt on every spawn
    // and every kill). Pure lookups; nothing mutates these.
    _enemyTables(){
        return this.__enemyTables||(this.__enemyTables={
            hp:{basic:15,ranged:12,berserker:28,speed:10,sniper:20,mortar:22,splitter:14,rooter:70,anchor:50,healer_totem:14,taunter:60,ceo:120,infernal:45,knight:60,portal_bringer:70,ghost_buster:35,wraith:45,bomber:8,bulwark:55,ems:16,demon:55,angel:70},
            dmg:{basic:5,ranged:6,berserker:14,speed:4,sniper:8,mortar:12,splitter:6,rooter:7,anchor:10,healer_totem:4,taunter:10,ceo:20,infernal:8,portal_bringer:12,ghost_buster:6,wraith:9,bomber:3,bulwark:11,ems:2,demon:8,angel:4},
            rewards:{basic:2,ranged:3,berserker:5,speed:3,sniper:4,mortar:6,splitter:3,rooter:3,anchor:8,healer_totem:5,taunter:12,ceo:25,infernal:15,wraith:14,knight:7,bomber:4,bulwark:9,ems:6,demon:14,angel:16},
            glorps:{taunter:4,ceo:8,infernal:6,wraith:5,portal_bringer:4,ghost_buster:3,knight:3,berserker:2,anchor:3,bomber:3,bulwark:4,ems:3,demon:5,angel:6},
            visuals:{
                basic:{tint:0xff5555,scale:1.0}, berserker:{tint:0xff2200,scale:1.35}, speed:{tint:0x44ffee,scale:0.75},
                rooter:{tint:0x33aa33,scale:1.2}, splitter:{tint:0xffaa00,scale:1.1}, ranged:{tint:0x9999ff,scale:1.0},
                sniper:{tint:0xcc8800,scale:1.15}, mortar:{tint:0x445566,scale:1.3}, anchor:{tint:0x6688aa,scale:1.25},
                healer_totem:{tint:0x44ff88,scale:1.1}, taunter:{tint:0x44ff88,scale:1.4}, ceo:{tint:0xddaaff,scale:1.6},
                infernal:{tint:0xff4400,scale:1.3}, wraith:{tint:0x99aadd,scale:1.2}, bomber:{tint:0xffdd00,scale:0.8},
                bulwark:{tint:0x88ccff,scale:1.25}, ems:{tint:0x66ccff,scale:0.85},
                demon:{tint:0xcc3366,scale:1.15}, angel:{tint:0xfff2aa,scale:1.15},
            },
        });
    }

    _spawnEnemy(type,tx,ty,sc=1,isStationary=false){
        const baseHP=this._enemyTables().hp;
        // Calm HP scaling — 1.045^wave gives:
        // W10: 1.55×  W20: 2.4×  W30: 3.7×  W50: 8.6×  W80: 29×
        // vs old 1.12^wave: W30≈23×, W50≈225× — way too spikey
        const waveMult=Math.pow(1.045,this.wave-1);
        const hp=Math.max(1,Math.floor((baseHP[type]||15)*waveMult));
        let e;
        switch(type){
            case 'ranged':
                if(isStationary){
                    // Edge shooters spawned on inner tiles near the base: pinned in place.
                    // isRanged=true hands them to updateRangedEnemies, which fires at the
                    // base. They sit within its 12-tile aggro window, so this works.
                    e=this.createRangedEnemy(tx,ty,-1);
                    if(e){
                        e._tdStationary=true;
                        e._pinnedX=tx; e._pinnedY=ty;
                    }
                } else {
                    // Mobile ranged (wave `mobile` lists) spawn at a PORTAL, ~30+ tiles out.
                    // createRangedEnemy would pin them there: moveEnemies skips isRanged
                    // enemies, and updateRangedEnemies only moves them within 12 tiles of
                    // base — so they'd stand at the portal forever and hang the wave.
                    // Instead they advance like the sniper (plain mover, isRanged false) and
                    // fire en route from _updateCustomEnemies.
                    e=this.createEnemy(tx,ty,hp);
                    if(e) e._rangedNextFire=this.time.now+1200;
                }
                break;
            case 'berserker':
                e=this.createBerserker(tx,ty,-1);
                if(e){
                    e._tdBerserker=true;
                    e._bersSwipeDmg=22;    // per-swipe damage to each tower in the 2×3 box
                    e._bersSwingCd=1100;   // ms between swipes (divided by rage → faster when hurt)
                    e._bersLifesteal=0.6;  // heals 60% of damage dealt to towers
                }
                break;
            case 'sniper':
                // TD sniper = advancing artillery. It walks toward the base like any other
                // enemy (so it always enters the player's kill zone and the wave can complete)
                // and fires bolts en route from _updateCustomEnemies. It deliberately does NOT
                // use the dungeon ranged/void-sniper AI: that AI stands off at max range and
                // holds position, which in TD (immobile player, short wisp range) leaves it
                // permanently unreachable and hangs the wave. isRanged stays false so the
                // normal BFS mover drives it.
                e=this.createEnemy(tx,ty,hp);
                if(e) e._sniperNextFire=this.time.now+1500;
                break;
            case 'mortar':       e=this.createMortar(tx,ty,-1);        break;
            case 'splitter':
                e=this.createSplitter(tx,ty,-1,0);
                if(e){ // createSplitter uses a flat tier HP table — apply wave scaling like everything else
                    e.health=Math.round(e.health*waveMult); e.maxHealth=Math.round(e.maxHealth*waveMult);
                    e._lastTrackedHealth=e.health;
                }
                break;
            case 'bulwark':
                // Carries a directional, regenerating shield facing the base. Blockable
                // (direct-fire) damage from within its frontal cone is absorbed by the shield
                // until it's depleted; it then drops for a few seconds and regenerates.
                // Lobbed/AoE attacks bypass it entirely — the intended counterplay.
                e=this.createEnemy(tx,ty,hp);
                if(e){
                    e.sprite.setTint(0x88ccff);
                    e.sprite.setScale(this.SLIME_SCALE*1.25);
                    e._baseScale=this.SLIME_SCALE*1.25;
                    e._tdBulwark=true;
                    e._shieldMax=Math.round(hp*4);   // shield ≫ body HP — the durable part
                    e._shield=e._shieldMax;
                    e._shieldArc=Math.PI*0.9;         // ~160° frontal protected cone
                    e._shieldRegenDelay=4000;         // ms after break before regen starts
                    e._shieldRegenRate=0.5;           // shield HP restored per ms while regen
                    e._shieldBrokenUntil=0;
                    e._shieldGfx=this.add.graphics().setDepth(2.7);
                }
                break;
            case 'demon':
                e=this.createEnemy(tx,ty,hp);
                if(e){
                    e.sprite.setTint(0xcc3366);
                    e._tdDemon=true;
                    e._demonFlameDps=16;      // flamethrower DPS to a tower
                    e._demonFlameRange=9*this.TILE_SIZE; // long reach — torches towers from well back
                    e._demonState='walk';
                }
                break;
            case 'angel':
                e=this.createEnemy(tx,ty,hp);
                if(e){
                    e.sprite.setTint(0xfff2aa);
                    e.sprite.setScale(this.SLIME_SCALE*1.15);
                    e._tdAngel=true;
                    e._angelHealFrac=0.04;  // heals 4%/sec of each enemy's MAX HP under its ring (no overheal)
                    e._flying=true; e._turretImmune=true; // only wisps can hit it
                }
                break;
            case 'ems':
                // Electromagnetic slime — reuses the bomber's fast rush-to-tower movement, but
                // its "detonation" is a wide turret-DISABLE pulse, not raw damage. A reactive
                // shield (see _updateEmsShield) lets it survive burst fire to reach a cluster.
                e=this.createEnemy(tx,ty,hp);
                if(e){
                    e.sprite.setTint(0x66ccff);
                    e.sprite.setScale(this.SLIME_SCALE*0.85);
                    e._tdBomber=true;         // inherit the rush-to-nearest-tower AI
                    e._tdEMS=true;            // ...but detonate as an EMP pulse
                    e._bomberSpeedMult=0.32;  // fast, like the sapper
                    e._bomberDetectR=18;
                    e._emsShield=true; e._emsShieldCd=2000;   // 90%-absorb shield, 2s cooldown
                    e._emsPulseRadius=6.5*this.TILE_SIZE;
                    e._emsDisableDur=2500;   // full stun at epicenter (killed en route)
                    e._emsSelfDetonateDur=5000; // MUCH longer if it reaches a tower & self-detonates
                    e._emsMinDisable=500;    // brief graze at the blast edge (distance-scaled)
                    e._pulseGfx=this.add.graphics().setDepth(2.6);
                }
                break;
            case 'bomber':
                // Sapper: very fast, low HP, rushes the NEAREST tower and detonates for huge
                // tower damage. With no towers it runs to the base for chip damage. Movement
                // retargeting + detonation handled in _updateCustomEnemies.
                e=this.createEnemy(tx,ty,hp);
                if(e){
                    e.sprite.setTint(0xffdd00);
                    e.sprite.setScale(this.SLIME_SCALE*0.8);
                    e._tdBomber=true;
                    e._bomberSpeedMult=0.3;   // ~3.3× normal speed — a blink, hard to shoot down
                    e._bomberTowerDmg=90;     // devastating to a single tower
                    e._bomberDetectR=20;      // large radius: any tower within this is hunted
                    e._pulseGfx=this.add.graphics().setDepth(2.6);
                }
                break;
            case 'rooter':
                e=this.createRooter(tx,ty,-1);
                if(e){ // createRooter uses a flat base HP — apply wave scaling like everything else
                    e.health=Math.round(e.health*waveMult); e.maxHealth=Math.round(e.maxHealth*waveMult);
                    e._lastTrackedHealth=e.health;
                }
                break;
            case 'anchor':
                e=this.createAnchorSlime(tx,ty,-1);
                if(e){ e.health=Math.round(e.health*waveMult); e.maxHealth=Math.round(e.maxHealth*waveMult); e._lastTrackedHealth=e.health; }
                break;
            case 'healer_totem':
                e=this.createHealerTotem(tx,ty,-1);
                if(e){ e.health=Math.round(e.health*waveMult); e.maxHealth=Math.round(e.maxHealth*waveMult); e._lastTrackedHealth=e.health; }
                break;
            case 'taunter':      e=this._spawnTaunter(tx,ty,hp);    break;
            case 'ceo':          e=this._spawnCEO(tx,ty,hp);        break;
            case 'infernal':     e=this._spawnInfernal(tx,ty,hp);   break;
            case 'knight':{
                e=this.createEnemy(tx,ty,hp);
                if(e) this._makeKnight(e);
                break;
            }
            case 'speed':
                e=this.createEnemy(tx,ty,hp);
                if(e){
                    e.isElectrical=true;
                    e.sprite.setTint(0x44ffff);
                    // Forking lightning aura. The bolt SHAPE is regenerated every ~140ms, but
                    // it's re-anchored to the sprite EVERY FRAME in _updateCustomEnemies — the
                    // old version only redrew on a 600ms timer, so the bolts lagged the fast
                    // slime by up to 600ms and looked choppy.
                    e._electricalAura=this.add.graphics().setDepth(2.5);
                    e._boltNextGen=0;
                    e._boltSeed=[]; // stored angle/length offsets, regenerated periodically
                }
                break;
            case 'portal_bringer': e=this._spawnPortalBringer(tx,ty,hp); break;
            case 'ghost_buster':   e=this._spawnGhostBuster(tx,ty,hp);   break;
            case 'wraith':
                // Slow stealth enemy — cloaks itself and nearby allies (see _updateCustomEnemies).
                e=this.createEnemy(tx,ty,hp);
                if(e){
                    e._tdWraith=true;
                    // Cloak the wraith itself immediately at spawn — otherwise it exists
                    // uncloaked for one frame (the custom loop runs after tower updates) and
                    // towers snipe it on spawn. We do NOT set _wraithInit here — the update
                    // loop's init sets up the ally-cloak pulse timing; pre-setting it would
                    // skip that and the wraith would never cloak nearby allies.
                    e._permaCloaked=true;
                    this._cloakEnemy(e);
                }
                break;
            default:             e=this.createEnemy(tx,ty,hp);         break;
        }
        if(!e)return;
        // Only enemies made via the generic createEnemy(tx,ty,hp) path take the raw wave hp.
        // Types with their own HP (splitter's tier table + wave scaling, taunter ×2.4, CEO/knight
        // shields, anchor, healer totem, etc.) set it in their case and must NOT be overwritten —
        // this unconditional reset was stomping all those custom values (splitter one-tap bug).
        const CUSTOM_HP=new Set(['splitter','taunter','ceo','infernal','knight','rooter','anchor','healer_totem']);
        if(!CUSTOM_HP.has(type)){ e.health=hp; e.maxHealth=hp; }
        e._lastTrackedHealth=e.health;
        const barY=e.sprite.y-18;
        if(e.healthBarBg)  e.healthBarBg.y=barY;
        if(e.healthBarFill)e.healthBarFill.y=barY;
        e._tdType=type;
        e._tdDmg=this._enemyTables().dmg[type]||5;
        // Tower-aggro tier (see the block in _updateCustomEnemies). 'hunter' types (sapper, EMS,
        // berserker, rooter, infernal) have their own dedicated seek+attack logic, so they're
        // left at the default; here we tag the OPPORTUNISTIC mid-tier (swat towers they pass)
        // and leave everything else as base-rushers ('ignore').
        const opportunistic=new Set(['knight','bulwark','sniper','mortar']);
        const hunters=new Set(['bomber','ems','berserker','rooter','infernal']);
        e._towerAggro = hunters.has(type) ? 'hunter' : (opportunistic.has(type) ? 'opportunistic' : 'ignore');
        // Per-type visual identity — tint + scale so enemies are distinguishable at a glance
        const typeVisuals=this._enemyTables().visuals;
        const vis=typeVisuals[type];
        if(vis&&e.sprite){
            e.sprite.setTint(vis.tint);
            // Splitters set their own tier-based scale in createSplitter (2.4× for the big
            // tier-0); don't let the generic per-type scale clobber it back to normal size.
            if(vis.scale!==1.0 && type!=='splitter') e.sprite.setScale(this.SLIME_SCALE*vis.scale);
        }
        e.tutorialRoomIndex=-1;
        e._isStationary=isStationary;
        e._lastTrackedHealth=e.health; // for armour interception in updateEnemyHealthBar override
        this.updateEnemyHealthBar(e);
        return e;
    }

    _checkWaveEnd(){
        if(!this.waveActive)return;
        // Count enemies that must die to end wave — don't trust enemiesLeft counter
        const mobileAlive=this.enemies.filter(e=>e.sprite?.active&&!e._isTotem&&!e._isDummy&&(!e._isStationary||e._tdType==='sniper'||e._tdType==='ranged')).length;
        // Also check enemiesLeft in case some haven't spawned yet
        if(mobileAlive>0||this.enemiesLeft>0)return;
        this.waveActive=false;
        const bonus=Math.floor(20*Math.pow(1.15,this.wave-1));this.scraps+=bonus;this.orbScraps=this.scraps;
        // Glorps (wisp-progression currency) — a slower curve than scraps
        const gbonus=Math.floor(15*Math.pow(1.12,this.wave-1));this.glorps=(this.glorps||0)+gbonus;
        this._showFloatingText(this.scale.width/2,this.scale.height/2-40,`WAVE ${this.wave} CLEAR  +${bonus}⚙  +${gbonus}✦`,'#ffdd44',0);
        if(this._currentWaveFinal){ this.time.delayedCall(1200,()=>this._victory()); return; }
        if(this.wave%5===0)this.time.delayedCall(1500,()=>this._offerPowerups());
        else                this.time.delayedCall(3000,()=>this._startNextWave());
    }

    _victory(){
        if(this.gameOver)return;
        this.gameOver=true;
        // The Cistern opens, and the first win pays its fragments (Progress.js)
        const _clr = Progress.rewardClear('engdefense');
        if (_clr.frags || _clr.glorps) this.add.text(this.scale.width/2,this.scale.height/2+130,[_clr.frags ? `+${_clr.frags} ◈ FRAGMENTS` : '', _clr.glorps ? `+${_clr.glorps} ✦ GLORPS` : ''].filter(Boolean).join('   '),{fontSize:'20px',fontFamily:UIKit.FONT.title,fontStyle:'bold',color:'#6cb4f0',stroke:'#000',strokeThickness:4}).setOrigin(0.5).setScrollFactor(0).setDepth(303);
        const W=this.scale.width,H=this.scale.height;
        this.add.rectangle(W/2,H/2,W,H,0x001018,0.82).setScrollFactor(0).setDepth(300);
        const glow=this.add.graphics().setScrollFactor(0).setDepth(301);
        glow.fillStyle(0xffdd44,0.12); glow.fillCircle(W/2,H/2-40,180);
        this.add.text(W/2,H/2-70,'👑 VICTORY 👑',{fontSize:'46px',fontFamily:'monospace',color:'#ffdd44',fontStyle:'bold',stroke:'#000',strokeThickness:7}).setOrigin(0.5).setScrollFactor(0).setDepth(302);
        this.add.text(W/2,H/2-18,'The Convergence is broken. The core holds.',{fontSize:'15px',fontFamily:'monospace',color:'#cfe4ff'}).setOrigin(0.5).setScrollFactor(0).setDepth(302);
        this.add.text(W/2,H/2+22,`Cleared ${this.wave} waves · Base HP ${Math.ceil(this.baseHP)}/${this.baseMaxHP}`,{fontSize:'12px',fontFamily:'monospace',color:'#8fb0cc'}).setOrigin(0.5).setScrollFactor(0).setDepth(302);
        // Continue into endless, or restart
        const mk=(x,label,col,cb)=>{
            const w=190,h=40,y=H/2+74;
            const g=this.add.graphics().setScrollFactor(0).setDepth(302);
            g.fillStyle(0x0d2233,0.98); g.fillRoundedRect(x-w/2,y-h/2,w,h,8);
            g.lineStyle(2,col,0.8); g.strokeRoundedRect(x-w/2,y-h/2,w,h,8);
            this.add.text(x,y,label,{fontSize:'13px',fontFamily:'monospace',color:'#ffffff',fontStyle:'bold'}).setOrigin(0.5).setScrollFactor(0).setDepth(303);
            this.add.rectangle(x,y,w,h,0xffffff,0).setScrollFactor(0).setDepth(304).setInteractive({useHandCursor:true}).on('pointerdown',cb);
        };
        mk(W/2-104,'ENDLESS MODE','#44ff88',()=>{
            this.gameOver=false; this._currentWaveFinal=false; this._endlessMode=true;
            this.children.list.filter(o=>o.depth>=300).forEach(o=>o.destroy());
            this.time.delayedCall(400,()=>this._startNextWave());
        });
        mk(W/2+104,'RESTART','#ffaa44',()=>this.scene.restart());
    }

    // ─── TOWER DURABILITY ───────────────────────────────────────────────────────
    // Enemies path AROUND towers (towers are non-FLOOR tiles), so an enemy squeezing
    // past a tower placed in the flow chips it. This makes placement a real risk/reward
    // choice and gives the healer towers a job. Enemies never divert to attack — they
    // just damage what they brush past — so towers can't be used as an exploit wall.
    // Area blast: explosion FX + damage every tower within 1 tile of the blast point.
    // Called both when a sapper reaches its target AND when it's killed en route.
    _bomberBlast(x,y,dmg){
        const boom=this.add.graphics().setDepth(6);
        boom.x=x; boom.y=y;
        boom.fillStyle(0xffdd00,0.7); boom.fillCircle(0,0,10);
        boom.fillStyle(0xff5500,0.5); boom.fillCircle(0,0,20);
        boom.lineStyle(3,0xffaa00,0.9); boom.strokeCircle(0,0,14);
        this.tweens.add({targets:boom,scaleX:2.2,scaleY:2.2,alpha:0,duration:300,onComplete:()=>boom.destroy()});
        this.cameras.main.shake(90,0.004);
        const TS=this.TILE_SIZE;
        let hitTower=false;
        for(const t of (this.towers||[])){
            if(!t.active)continue;
            const d=Math.hypot((t.px??t.tileX*TS)-x,(t.py??t.tileY*TS)-y);
            if(d<=TS*1.5){ this._damageTower(t,dmg); hitTower=true; }
        }
        if(hitTower) this._showFloatingText(x,y-14,'💥 SAPPED','#ffdd00');
    }

    // Intentional detonation when the sapper reaches its target. Marks itself so the
    // death-explosion in killEnemy doesn't blast a second time.
    _bomberDetonate(e,tower){
        const x=e.sprite?.x??this.basePx, y=e.sprite?.y??this.basePy;
        e._bomberExploded=true;
        if(e._tdEMS){
            // EMS reached its target and SELF-detonates on purpose → a devastating overload
            // pulse (much longer stun). This is the punishing outcome for letting it connect.
            // (Killing it en route instead triggers the weaker death pulse via killEnemy.)
            this._emsPulse(x,y,true);
        } else {
            this._bomberBlast(x,y,e._bomberTowerDmg||90);
        }
        if(!tower||!tower.active) this._damageBase(e._tdDmg||3); // no tower reached → chip base
        this.killEnemy(e);
    }

    // Does any active healer with the given flag cover this tower's tile?
    _healerCovers(tower,flag){
        for(const h of (this.towers||[])){
            if(!h.active||h===tower||!h[flag])continue;
            const d=this._towerDefs()[h.type];
            const r=((d?.range||0)+(h._rangeBonus||0))*this.TILE_SIZE;
            if(Math.hypot(h.px-tower.px,h.py-tower.py)<=r) return true;
        }
        return false;
    }
    // Returns the first active healer covering `tower` that has the given flag (or null).
    _healerWith(tower,flag){
        for(const h of (this.towers||[])){
            if(!h.active||h===tower||!h[flag])continue;
            const d=this._towerDefs()[h.type];
            const r=((d?.range||0)+(h._rangeBonus||0))*this.TILE_SIZE;
            if(Math.hypot(h.px-tower.px,h.py-tower.py)<=r) return h;
        }
        return null;
    }
    _damageTower(tower,dmg){
        if(!tower||!tower.active||tower.hp==null)return;
        // Reinforce (turret) / Bulwark Aura: flat damage reduction while covered.
        if(this._healerCovers(tower,'_reinforce')) dmg*=0.85;
        tower.hp=Math.max(0,tower.hp-dmg);

        // Fatal-hit negation. Emergency (turret) and Sanctuary (fountain) can each cancel a
        // KILLING blow — the tower survives at low HP — but the covering healer then goes on
        // a 15s cooldown, so between saves the tower is genuinely in danger. This replaces the
        // old always-on protection that made lines immortal.
        if(tower.hp<=0){
            const now=this.time.now;
            for(const flag of ['_emergency','_sanctuary']){
                const healer=this._healerWith(tower,flag);
                if(healer && now>=(healer._negateReadyAt||0)){
                    healer._negateReadyAt=now+15000;
                    tower.hp=Math.max(1,Math.round(tower.maxHp*0.15)); // survives at 15%
                    this._showFloatingText(tower.px,tower.py-16,'⛨ SAVED','#88ffcc');
                    this._flashEngineerTower(healer,0x88ffcc);
                    break;
                }
            }
        }
        // Guardian (turret capstone): a separate, once-per-wave hard save at 1 HP.
        if(tower.hp<=0 && this._healerCovers(tower,'_guardian')){
            const key=`${tower.tileX},${tower.tileY}`;
            if(!this._guardianUsed?.[key]){
                (this._guardianUsed||(this._guardianUsed={}))[key]=true;
                tower.hp=1;
                this._showFloatingText(tower.px,tower.py-16,'GUARDED','#88ffcc');
            }
        }
        if(tower.hpBarBg)   tower.hpBarBg.setVisible(true);
        if(tower.hpBarFill){ tower.hpBarFill.setVisible(true); tower.hpBarFill.width=this.TILE_SIZE*Math.max(0,tower.hp/(tower.maxHp||1)); }
        if(tower.hp<=0){
            this._showFloatingText(tower.px,tower.py-10,'TOWER DOWN','#ff5544');
            // PURPLE FIRE chain: a tower that dies while burning bursts, dealing 3×3 damage and
            // igniting neighbors (which can then die & burst too — a cascade through a cluster).
            if(tower._purpleFire) this._purpleFireBurst(tower);
            this._sellTower(tower,false); // destroyed — no refund
        }
    }
    // Purple-fire death-burst: a burning tower that dies erupts, damaging + igniting towers in a
    // 3×3 tile area. Bounded so it can't loop forever: _purpleBurst marks a tower as already
    // burst, and the burst only DAMAGES + IGNITES — neighbors only chain if they THEN die (so a
    // healthy cluster survives it; only an already-weakened one cascades).
    _purpleFireBurst(tower){
        if(tower._purpleBurst)return; tower._purpleBurst=true;
        const TS=this.TILE_SIZE, px=tower.px, py=tower.py;
        const g=this.add.graphics().setDepth(6); g.x=px; g.y=py;
        g.fillStyle(0xaa44ff,0.5); g.fillCircle(0,0,TS*1.4);
        g.fillStyle(0xff66ff,0.4); g.fillCircle(0,0,TS*0.9);
        g.lineStyle(3,0xcc66ff,0.9); g.strokeCircle(0,0,TS*1.2);
        this.tweens.add({targets:g,scaleX:1.6,scaleY:1.6,alpha:0,duration:350,onComplete:()=>g.destroy()});
        this._showFloatingText(px,py-12,'PURPLE BURST','#cc66ff');
        for(const t of (this.towers||[])){
            if(!t.active||t===tower)continue;
            if(Math.abs(t.tileX-tower.tileX)<=1 && Math.abs(t.tileY-tower.tileY)<=1){
                this._ignitePurpleFire(t);                       // ignite neighbor
                this._damageTower(t, this._purpleBurstDmg||30);  // decent burst damage (not an instakill)
            }
        }
    }
    // Apply / refresh the purple-fire DoT status on a tower.
    _ignitePurpleFire(tower){
        if(!tower?.active)return;
        tower._purpleFire=true;
        tower._purpleFireUntil=this.time.now+(this._purpleFireDur||3500);
        tower._purpleFireDps=this._purpleFireDps||10;
    }
    // Per-frame purple-fire DoT — ticks damage on burning towers; expires on its timer.
    _updatePurpleFire(time,dt){
        for(const t of (this.towers||[])){
            if(!t.active||!t._purpleFire)continue;
            if(time>=(t._purpleFireUntil||0)){ t._purpleFire=false; t._purpleFireGfx?.clear(); continue; }
            this._damageTower(t,(t._purpleFireDps||10)*dt);
            // purple flame lick visual
            if(!t._purpleFireGfx) t._purpleFireGfx=this.add.graphics().setDepth(5.3);
            const g=t._purpleFireGfx; g.clear();
            for(let i=0;i<4;i++){
                const fx=t.px+(i/3-0.5)*this.TILE_SIZE*0.7 + Math.sin(time*0.012+i)*2;
                const h=8+6*Math.abs(Math.sin(time*0.015+i*1.9));
                g.fillStyle(0xaa44ff,0.5); g.fillTriangle(fx-2.5,t.py+4,fx+2.5,t.py+4,fx,t.py+4-h);
                g.fillStyle(0xdd88ff,0.8); g.fillTriangle(fx-1.2,t.py+3,fx+1.2,t.py+3,fx,t.py+3-h*0.6);
            }
        }
    }
    // ── DEMON: dives into a hell-portal (invulnerable), resurfaces on a semi-random timer,
    // flamethrowers the nearest tower with purple fire, then has a vulnerable window before it
    // can dive again. A portal decal + resurface telegraph keep it readable while submerged.
    _updateDemon(e,time,dt){
        if(!e._tdDemon||!e.sprite?.active)return;
        e._demonState=e._demonState||'walk';
        const TS=this.TILE_SIZE;
        const SINK=650, RISE=650;   // gradual sink/rise durations

        if(e._demonState==='walk'){
            // horns follow the demon on the surface
            this._drawDemonHorns(e,time,1);
            if(time>=(e._demonNextDive||(e._demonNextDive=time+2500+Math.random()*2500))){
                e._demonState='sinking'; e._demonPhaseStart=time;
                e._demonPortalX=e.sprite.x; e._demonPortalY=e.sprite.y;
                this._setEnemyBarsVisible(e,false);   // hide bar IMMEDIATELY on dive (was interfering)
                e._demonHidden=true;                   // untargetable the moment it starts diving
            }
        } else if(e._demonState==='sinking'){
            // Actually SINK: keep full scale and translate the body DOWN into the portal (it
            // descends into the ground), fading out in the last stretch. Portal grows underneath.
            const p=Math.min(1,(time-e._demonPhaseStart)/SINK);
            e.sprite.setScale(e._baseScale||this.SLIME_SCALE);   // full size — no shrink
            e.sprite.y=e._demonPortalY + p*20;                    // descends into the ground
            e.sprite.setAlpha(p<0.7 ? 1 : 1-(p-0.7)/0.3);        // fade only at the end as it vanishes
            this._setEnemyBarsVisible(e,false);
            this._drawDemonHorns(e,time,p<0.7?1:1-(p-0.7)/0.3);
            this._drawDemonPortal(e,time,Math.min(1,p*1.2));     // portal expands 0→1
            if(p>=1){
                e._demonState='submerged'; e._demonInvuln=true; e._demonHidden=true;
                e._demonSurfaceAt=time+2000+Math.random()*2000;
                e.sprite.setVisible(false);
                e.sprite.y=e._demonPortalY;             // reset for underground movement
                e._hornGfx?.clear();
                e._demonPortalGfx?.clear();             // portal CLOSES once it's fully in hell
            }
        } else if(e._demonState==='submerged'){
            // The demon keeps travelling underground (its sprite still moves invisibly), so the
            // arrow tracks its LIVE position, not the dive spot. Portal stays closed until it's
            // about to resurface.
            // Arrow tracks the demon's true tile position (converted to pixels) — accurate even
            // if the invisible sprite's pixel position lags.
            const ax=(e.x!=null? e.x*TS+TS/2 : e.sprite.x);
            const ay=(e.y!=null? e.y*TS+TS/2 : e.sprite.y);
            e._demonPortalX=ax; e._demonPortalY=ay;   // keep portal reopen point in sync too
            this._drawDemonArrow(e,time,ax,ay);
            // When about to resurface, re-open a portal at the demon's CURRENT position.
            if(time>=e._demonSurfaceAt){
                e._demonState='rising'; e._demonPhaseStart=time;
                e._demonPortalX=ax; e._demonPortalY=ay; // reopen here
                e.sprite.x=ax; e.sprite.y=ay;           // seat sprite at the true tile
                e.sprite.setVisible(true); e._demonHidden=false; e._demonInvuln=false;
                e._demonArrowGfx?.clear();
                this._setEnemyBarsVisible(e,true);
            }
        } else if(e._demonState==='rising'){
            // Rise UP FROM THE FLOOR: the demon hops into view from below (vertical translate),
            // clipped by starting below ground and moving up — not a scale-from-tiny pop.
            const p=Math.min(1,(time-e._demonPhaseStart)/RISE);
            e.sprite.setScale(e._baseScale||this.SLIME_SCALE);   // full size immediately
            e.sprite.setAlpha(Math.min(1,p*1.6));
            e.sprite.y=e._demonPortalY + (1-p)*22;               // starts 22px below, rises to seat
            this._drawDemonHorns(e,time,p);
            // portal is open then shrinks away as it finishes rising
            this._drawDemonPortal(e,time, p<0.6 ? 1 : (1-(p-0.6)/0.4));
            if(p>=1){
                e.sprite.setScale(e._baseScale||this.SLIME_SCALE); e.sprite.setAlpha(1);
                e.sprite.y=e._demonPortalY;
                e._demonPortalGfx?.clear();
                e._demonState='attack';
                e._demonAttackUntil=time+1800;    // full attack window
                e._demonRecoverUntil=time+1800+1400;
                // Target the nearest tower within the demon's (longer) flame range.
                const fr=e._demonFlameRange||7*this.TILE_SIZE;
                let best=null,bd=fr;
                for(const t of (this.towers||[])){ if(!t.active)continue; const d=Math.hypot(t.px-e.sprite.x,t.py-e.sprite.y); if(d<=bd){bd=d;best=t;} }
                // If nothing in range, still grab the nearest so it isn't a wasted surface.
                if(!best){ let nd=Infinity; for(const t of (this.towers||[])){ if(!t.active)continue; const d=Math.hypot(t.px-e.sprite.x,t.py-e.sprite.y); if(d<nd){nd=d;best=t;} } }
                e._demonFlameTarget=best;
            }
        } else if(e._demonState==='attack'){
            this._drawDemonHorns(e,time,1);
            const tt=e._demonFlameTarget;
            if(tt&&tt.active){
                this._damageTower(tt,(e._demonFlameDps||16)*(e._demonAtkSpeedMult||1)*dt);
                this._ignitePurpleFire(tt);
                this._drawDemonFlame(e,tt,time);
            }
            if(time>=e._demonAttackUntil){ e._demonState='recover'; e._demonFlameGfx?.clear(); }
        } else if(e._demonState==='recover'){
            this._drawDemonHorns(e,time,1);
            if(time>=e._demonRecoverUntil){ e._demonState='walk'; e._demonNextDive=time+2500+Math.random()*2500; }
        }
    }
    // ANGEL death → every CURRENTLY-living demon permanently gains +50% move & attack speed
    // (flat/additive per angel death — two deaths = +100%, not compounding). Descent speed is
    // unchanged. The demons are enraged by the loss of their protector.
    _onAngelDeath(angel){
        for(const d of (this.enemies||[])){
            if(!d._tdDemon||!d.sprite?.active)continue;
            d._demonRageStacks=(d._demonRageStacks||0)+1;      // flat stacks
            const mult=1+0.5*d._demonRageStacks;               // +50% per stack
            d._demonRageMult=mult;                             // PERMANENT (survives anchor decay)
            d._anchorSpeedMult=Math.max(d._anchorSpeedMult||1,mult); // move speed now
            d._demonAtkSpeedMult=mult;                         // attack speed (shortens attack window)
            if(d.sprite?.active) this._showFloatingText(d.sprite.x,d.sprite.y-20,'ENRAGED','#ff4466');
        }
    }
    // DEMON death → all living angels heal to FULL, and every enemy currently inside an angel's
    // ring gets a shield absorbing 90% of its next 2 damage instances.
    _onDemonDeath(demon){
        const angels=(this.enemies||[]).filter(a=>a._tdAngel&&a.sprite?.active);
        for(const a of angels){
            a.health=a.maxHealth||a.health;
            a._lastTrackedHealth=a.health;
            if(a.healthBarFill&&a.maxHealth) a.healthBarFill.width=24;
            this._showFloatingText(a.sprite.x,a.sprite.y-24,'RESTORED','#ffee88');
        }
        // Shield every enemy currently under any angel ring.
        for(const a of angels){
            const rr=a._angelRingR||3.5*this.TILE_SIZE;
            for(const o of (this.enemies||[])){
                if(!o.sprite?.active)continue;
                if(Math.hypot(o.sprite.x-a.sprite.x,o.sprite.y-a.sprite.y)<=rr){
                    o._holyShieldCharges=2;      // absorbs 90% of the next 2 hits
                    if(o.sprite?.active) this._showFloatingText(o.sprite.x,o.sprite.y-16,'⛨×2','#ffffaa');
                }
            }
        }
    }
    // Apply BRITTLE — a damage-amplifier debuff (not a shield): the enemy's next non-ice hit is
    // boosted. Cracked-ice visual so it reads as "fragile," never confused with a shield/frozen.
    _applyBrittle(e){
        if(!e?.sprite?.active||e._isTotem)return;
        e._brittle=true;
        e._brittleMult=this._brittleMult||1.75;   // next non-ice hit ×1.75 (tunable)
        e._brittleLeft=this._brittleCharges||1;   // SHATTERSTORM raises this to 2+
        e._brittleUntil=this.time.now+6000;        // lingers a while waiting for the payoff hit
        if(!e._brittleGfx) e._brittleGfx=this.add.graphics().setDepth((e.sprite.depth||1)+0.15);
    }
    _updateBrittleVisual(e,time){
        if(!e._brittle){ e._brittleGfx?.clear(); return; }
        if(this.time.now>(e._brittleUntil||0)){ e._brittle=false; e._brittleGfx?.clear(); return; }
        if(!e._brittleGfx) e._brittleGfx=this.add.graphics().setDepth((e.sprite.depth||1)+0.15);
        const g=e._brittleGfx; g.clear();
        const x=e.sprite.x, y=e.sprite.y, r=8;
        const fl=0.6+0.3*Math.sin(time*0.02);
        g.lineStyle(1.2,0xcceeff,fl);
        for(let i=0;i<4;i++){
            const a=i*Math.PI/2+0.4;
            g.beginPath(); g.moveTo(x,y);
            g.lineTo(x+Math.cos(a)*r*0.6, y+Math.sin(a)*r*0.6);
            g.lineTo(x+Math.cos(a+0.3)*r, y+Math.sin(a+0.3)*r);
            g.strokePath();
        }
        g.lineStyle(1,0xffffff,fl*0.7); g.strokeCircle(x,y,r);
    }
    // Freeze a single target: hard stun for a 4s window. If a follow-up ICE hit lands in that
    // window it SHATTERS (brittle + small puddle); otherwise it MELTS into a BIGGER puddle.
    // durMult is used by the Deep Freeze capstone to double the window on a locked target.
    _freezeIceTarget(e,durMult=1){
        if(!e?.sprite?.active||e._isTotem||e._iceFrozen)return;
        this._addWispMastery('ice',8);   // mastery: landing a freeze IS Ice's job
        e._iceFrozen=true;
        const dur=(this._iceFreezeDur||4000)*(durMult||1);
        e._iceFrozenUntil=this.time.now+dur;
        // Hard stun for the window (reuse the standard stun system).
        e.isStunned=true; e.stunnedUntil=this.time.now+dur;
        e._committedPath=null; e._pathIndex=undefined;
        e.sprite.setTint(0x88ddff);
        if(!e._iceFrozenGfx) e._iceFrozenGfx=this.add.graphics().setDepth((e.sprite.depth||1)+0.2);
        // Auto-melt: if still frozen when the window ends, melt into a bigger puddle.
        e._iceMeltEvent=this.time.delayedCall(dur,()=>{
            if(e._iceFrozen && e.sprite?.active){
                this._meltFrozen(e);
            }
        });
    }
    // SHATTER (follow-up ice hit landed): brittle nearby + small water puddle + burst crack.
    _shatterFrozen(e){
        if(!e?.sprite?.active)return;
        this._addWispMastery('ice',14);  // mastery: cashing the shatter is the harder half
        e._iceFrozen=false; e.isStunned=false; e._iceMeltEvent?.remove();
        e.sprite.clearTint?.(); e._iceFrozenGfx?.clear();
        const TS=this.TILE_SIZE, cx=e.sprite.x, cy=e.sprite.y;
        // Shatter burst visual.
        const g=this.add.graphics().setDepth(5).setPosition(cx,cy);
        g.fillStyle(0xcceeff,0.7); g.fillCircle(0,0,TS*0.5);
        for(let i=0;i<8;i++){ const a=i*Math.PI/4; g.lineStyle(2,0xffffff,0.8); g.beginPath(); g.moveTo(0,0); g.lineTo(Math.cos(a)*TS*0.7,Math.sin(a)*TS*0.7); g.strokePath(); }
        this.tweens.add({targets:g,alpha:0,scaleX:1.6,scaleY:1.6,duration:300,onComplete:()=>g.destroy()});
        this._showFloatingText(cx,cy-18,'SHATTER','#cceeff');
        // Apply BRITTLE to nearby enemies (the payoff for other damage sources).
        const br=(this._iceShatterBrittleR||1.5)*TS;
        for(const o of (this.enemies||[])){
            if(!o.sprite?.active||o===e)continue;
            if(Math.hypot(o.sprite.x-cx,o.sprite.y-cy)<=br) this._applyBrittle(o);
        }
        this._applyBrittle(e);
        // Small water puddle (3×3).
        this._spawnWaterPuddle(Math.floor(cx/TS),Math.floor(cy/TS), this._icePuddleRadius||1);
        // CASCADE — a shatter can chain into nearby FROZEN enemies. Bounded by a re-entrancy
        // guard so a cluster resolves once rather than recursing forever.
        const cc=this._iceCascadeChance||0;
        if(cc>0 && !this._iceCascading){
            this._iceCascading=true;
            const reach=(this._iceCascadeR||3)*TS;
            // Snapshot: _shatterFrozen can kill, and killEnemy splices this.enemies, which
            // makes a live for...of skip the element after each removal. `(this.enemies||[])`
            // is only a nullish guard — the COPY is the spread.
            for(const o of [...(this.enemies||[])]){
                if(!o.sprite?.active||o===e||!o._iceFrozen)continue;
                if(Math.hypot(o.sprite.x-cx,o.sprite.y-cy)>reach)continue;
                if(Math.random()<cc) this._shatterFrozen(o);
            }
            this._iceCascading=false;
        }
    }
    // MELT (window expired, no follow-up hit): no brittle, but a BIGGER puddle as consolation.
    _meltFrozen(e){
        if(!e?.sprite?.active)return;
        e._iceFrozen=false; e.isStunned=false;
        e.sprite.clearTint?.(); e._iceFrozenGfx?.clear();
        const TS=this.TILE_SIZE, cx=e.sprite.x, cy=e.sprite.y;
        this._showFloatingText(cx,cy-18,'melt','#aaccff');
        this._spawnWaterPuddle(Math.floor(cx/TS),Math.floor(cy/TS), (this._icePuddleRadius||1)+1); // bigger
    }
    // ─── WATER / ICE SURFACE RENDERING ─────────────────────────────────
    // One shared graphics for every water and ice tile, redrawn only when the tile set
    // changes. Previously each tile owned its own graphics and stroked its own full rect,
    // so a pool rendered as a checkerboard of outlined squares rather than a body of water.
    // Now tiles are grouped by STATE (liquid vs frozen) rather than by which system spawned
    // them, so a wake trail running into a puddle reads as one continuous surface.
    _redrawWaterBodies(){
        if(!this._waterDirty)return;
        this._waterDirty=false;
        const anyTiles=(this._waterPuddles?.length||0)+(this._iceTrail?.length||0);
        if(!anyTiles){ this._waterGfx?.clear(); return; }
        if(!this._waterGfx||!this._waterGfx.active) this._waterGfx=this.add.graphics().setDepth(0.85);
        const g=this._waterGfx; g.clear();
        const k=(x,y)=>x+','+y;
        const liquid=new Set(), frozen=new Set();
        for(const t of (this._waterPuddles||[])) (t.flashFrozen?frozen:liquid).add(k(t.tx,t.ty));
        for(const t of (this._iceTrail||[]))     (t.frozen     ?frozen:liquid).add(k(t.tx,t.ty));
        // Frozen wins if a tile somehow appears in both (a trail tile laid over a frozen puddle).
        for(const key of frozen) liquid.delete(key);
        this._paintTileBody(g,liquid,{fill:0x3388cc,fillA:0.32,edge:0x66bbee,edgeA:0.75,ice:false});
        this._paintTileBody(g,frozen,{fill:0x99e6ff,fillA:0.42,edge:0xddf6ff,edgeA:0.90,ice:true});
    }

    // Paint a tile set as ONE body: fill every tile, but stroke only the edges whose
    // neighbour is outside the set. That perimeter-only pass is what removes the interior
    // grid. Interior detail is derived from tile coordinates, never Math.random(), so the
    // surface does not crawl every time an unrelated tile expires and forces a redraw.
    _paintTileBody(g,tiles,opt){
        if(!tiles.size)return;
        const TS=this.TILE_SIZE;
        const coords=[...tiles].map(key=>{const i=key.indexOf(',');return [ +key.slice(0,i), +key.slice(i+1) ];});
        g.fillStyle(opt.fill,opt.fillA);
        for(const [tx,ty] of coords) g.fillRect(tx*TS,ty*TS,TS,TS);
        for(const [tx,ty] of coords){
            const px=tx*TS, py=ty*TS;
            if(opt.ice){
                // Two thin diagonal crystal streaks — matches the original game's ice overlay.
                g.lineStyle(0.7,0xffffff,0.45);
                g.beginPath(); g.moveTo(px+4,py+4);      g.lineTo(px+TS-6,py+TS-4); g.strokePath();
                g.beginPath(); g.moveTo(px+TS/2,py+2);   g.lineTo(px+6,py+TS-4);    g.strokePath();
            } else {
                // Short ripple dashes, offset per tile by a coordinate hash.
                const h=((tx*73856093)^(ty*19349663))>>>0;
                const o1=h%7, o2=(h>>3)%9;
                g.lineStyle(1,0x99ddff,0.28);
                g.beginPath(); g.moveTo(px+3+o1,py+7);     g.lineTo(px+9+o1,py+7);     g.strokePath();
                g.beginPath(); g.moveTo(px+5+o2,py+TS-7);  g.lineTo(px+12+o2,py+TS-7); g.strokePath();
            }
        }
        g.lineStyle(1.6,opt.edge,opt.edgeA);
        for(const [tx,ty] of coords){
            const px=tx*TS, py=ty*TS;
            if(!tiles.has((tx)+','+(ty-1))){ g.beginPath(); g.moveTo(px,py);    g.lineTo(px+TS,py);    g.strokePath(); }
            if(!tiles.has((tx)+','+(ty+1))){ g.beginPath(); g.moveTo(px,py+TS); g.lineTo(px+TS,py+TS); g.strokePath(); }
            if(!tiles.has((tx-1)+','+(ty))){ g.beginPath(); g.moveTo(px,py);    g.lineTo(px,py+TS);    g.strokePath(); }
            if(!tiles.has((tx+1)+','+(ty))){ g.beginPath(); g.moveTo(px+TS,py); g.lineTo(px+TS,py+TS); g.strokePath(); }
        }
    }

    // Water puddle: slows + "wets" enemies standing in it. Radius (in tiles) → square of tiles.
    _spawnWaterPuddle(ctx,cty,radius){
        if(!this._waterPuddles) this._waterPuddles=[];
        const TS=this.TILE_SIZE;
        const dur=this._icePuddleDur||4000;
        for(let dx=-radius;dx<=radius;dx++) for(let dy=-radius;dy<=radius;dy++){
            const tx=ctx+dx, ty=cty+dy;
            if(this.world[tx]?.[ty]!==this.FLOOR)continue;
            const existing=this._waterPuddles.find(p=>p.tx===tx&&p.ty===ty);
            if(existing){
                existing.expiresAt=this.time.now+dur;
                // A refreshed tile is fresh water again — re-arm its flash-freeze clock.
                if(existing.flashFrozen){ existing.flashFrozen=false; existing.createdAt=this.time.now; this._waterDirty=true; }
                continue;
            }
            this._waterPuddles.push({tx,ty,createdAt:this.time.now,expiresAt:this.time.now+dur,flashFrozen:false});
            this._waterDirty=true;
        }
    }
    // Per-frame: puddles slow+wet enemies on them, expire on timer, and (with FLASH FREEZE) snap
    // the whole connected body to ice once an enemy is standing in a ripened puddle.
    _updateWaterPuddles(time){
        if(!this._waterPuddles?.length)return;
        const TS=this.TILE_SIZE, slowMult=this._icePuddleSlow||0.4;
        const wetDur=this._iceWetDur||1500;
        const beforeCount=this._waterPuddles.length;
        this._waterPuddles=this._waterPuddles.filter(p=>time<=p.expiresAt);
        if(this._waterPuddles.length!==beforeCount) this._waterDirty=true;
        for(const e of (this.enemies||[])){
            if(!e.sprite?.active||e._isTotem)continue;
            const etx=Math.floor(e.sprite.x/TS), ety=Math.floor(e.sprite.y/TS);
            const on=this._waterPuddles.find(p=>p.tx===etx&&p.ty===ety);
            if(on){
                e.isSlowed=true; e.slowedUntil=time+250; e._slowMult=slowMult; e._slowType='slow_ice';
                // Sync BOTH names. The engine reads isWet/wetUntil; the ice systems read
                // _wetUntil. Writing only _wetUntil left every engine-side wet check blind,
                // so Waterlog's anti-heal never applied where the engine evaluates it.
                e._wetUntil=time+wetDur;   // wet lingers briefly after leaving the water
                e.isWet=true; e.wetUntil=time+wetDur;
                // FLASH FREEZE capstone: 2s after a tile forms, an enemy standing on it snaps the
                // ENTIRE connected water body to ice.
                if(this._iceFlashFreeze && !on.flashFrozen && time>=on.createdAt+2000){
                    this._flashFreezeBody(on,time);
                }
            }
        }
        // FROSTBITE — wet enemies take a small frost DoT.
        const fb=this._iceFrostbiteDps||0;
        if(fb>0 && time-(this._lastFrostbiteTick||0)>=500){
            this._lastFrostbiteTick=time;
            for(const e of [...(this.enemies||[])]){   // snapshot: killEnemy splices below
                if(!e.sprite?.active||e._isTotem)continue;
                if(!(e._wetUntil>time))continue;
                this._lastDamageFromWisp=true; this._lastDamageFromIce=true;
                e.health-=fb*0.5; this.updateEnemyHealthBar(e);
                this._lastDamageFromWisp=false; this._lastDamageFromIce=false;
                if(e.health<=0) this.killEnemy(e);
            }
        }
    }
    // Flood-fill the connected water body containing `seed` and snap it all to ice: every enemy
    // standing on any of those tiles takes damage, becomes brittle, and rolls a freeze.
    _flashFreezeBody(seed,time){
        const TS=this.TILE_SIZE;
        const key=(x,y)=>x+','+y;
        const lookup=new Map();
        for(const p of this._waterPuddles) lookup.set(key(p.tx,p.ty),p);
        // Traverse the WHOLE connected body, including tiles that are already frozen.
        // The old fill bailed on frozen neighbours (`if(n && !n.flashFrozen)`), so a frozen
        // section became a wall the fill could not cross and the remaining water froze in
        // fragments as enemies wandered onto each piece. Now one trigger snaps everything
        // that is connected, in a single frame.
        const body=[]; const seen=new Set([key(seed.tx,seed.ty)]); const stack=[seed];
        while(stack.length){
            const p=stack.pop(); body.push(p);
            for(const [dx,dy] of [[1,0],[-1,0],[0,1],[0,-1]]){
                const k=key(p.tx+dx,p.ty+dy);
                if(seen.has(k))continue;
                const n=lookup.get(k);
                if(n){ seen.add(k); stack.push(n); }
            }
        }
        // Effects apply only to tiles that were still liquid, so an already-frozen tile
        // cannot damage the same enemy twice when a neighbouring pool triggers later.
        const fresh=body.filter(p=>!p.flashFrozen);
        if(!fresh.length)return;
        const tiles=new Set(fresh.map(p=>key(p.tx,p.ty)));
        for(const p of fresh) p.flashFrozen=true;
        this._waterDirty=true;
        // Snap flash over the frozen area so the whole body visibly goes at once.
        const flash=this.add.graphics().setDepth(1.9);
        flash.fillStyle(0xffffff,0.5);
        for(const p of fresh) flash.fillRect(p.tx*TS,p.ty*TS,TS,TS);
        this.tweens.add({targets:flash,alpha:0,duration:260,onComplete:()=>flash.destroy()});
        // Hit everything standing on the body.
        const dmg=this._iceFlashDmg||14;
        for(const e of [...(this.enemies||[])]){   // snapshot: killEnemy splices below
            if(!e.sprite?.active||e._isTotem)continue;
            if(!tiles.has(key(Math.floor(e.sprite.x/TS),Math.floor(e.sprite.y/TS))))continue;
            this._lastDamageFromWisp=true; this._lastDamageFromIce=true;
            e.health-=dmg; this.updateEnemyHealthBar(e);
            this._lastDamageFromWisp=false; this._lastDamageFromIce=false;
            if(e.health<=0){ this.killEnemy(e); continue; }
            this._applyBrittle(e);
            const chance=(this._iceFlashFreezeChance||0.25)+(this._iceFreezeBonus||0);
            if(Math.random()<chance) this._freezeIceTarget(e);
        }
        if(body.length) this._showFloatingText(seed.tx*TS+TS/2, seed.ty*TS-6, 'FLASH FREEZE', '#ccf4ff');
    }
    // WAKE / SLIPSTREAM / FROSTWALKER — the player's water trail.
    _updateIceWake(time){
        if(!this._iceWake || !this.player?.active)return;
        const TS=this.TILE_SIZE;
        const ptx=Math.floor(this.player.x/TS), pty=Math.floor(this.player.y/TS);
        if(!this._iceTrail) this._iceTrail=[];
        // Lay a trail tile on the tile the player just left (not the one they're on) so walking
        // forward never self-buffs — the payoff is doubling back over your own wake.
        if(this._lastWakeTile && (this._lastWakeTile.tx!==ptx||this._lastWakeTile.ty!==pty)){
            const {tx,ty}=this._lastWakeTile;
            if(this.world[tx]?.[ty]===this.FLOOR && !this._iceTrail.some(t=>t.tx===tx&&t.ty===ty)){
                this._iceTrail.push({tx,ty,createdAt:time,frozen:false});
                this._waterDirty=true;
            }
        }
        this._lastWakeTile={tx:ptx,ty:pty};
        // Expire trail tiles (~2s).
        const trailBefore=this._iceTrail.length;
        this._iceTrail=this._iceTrail.filter(t=>time<=t.createdAt+2000);
        if(this._iceTrail.length!==trailBefore) this._waterDirty=true;
        // FROSTWALKER: a trail tile flash-freezes 2s… it expires at 2s, so freeze it just before,
        // at 1.6s, then it lingers briefly as ice while it fades.
        if(this._iceFrostwalker){
            for(const t of this._iceTrail){
                if(t.frozen || time < t.createdAt+1600)continue;
                t.frozen=true;
                this._waterDirty=true;
                for(const e of [...(this.enemies||[])]){   // snapshot: killEnemy splices below
                    if(!e.sprite?.active||e._isTotem)continue;
                    if(Math.floor(e.sprite.x/TS)!==t.tx||Math.floor(e.sprite.y/TS)!==t.ty)continue;
                    this._lastDamageFromWisp=true; this._lastDamageFromIce=true;
                    e.health-=(this._iceFlashDmg||14); this.updateEnemyHealthBar(e);
                    this._lastDamageFromWisp=false; this._lastDamageFromIce=false;
                    if(e.health<=0){ this.killEnemy(e); continue; }
                    this._applyBrittle(e);
                    const chance=(this._iceFlashFreezeChance||0.25)+(this._iceFreezeBonus||0);
                    if(Math.random()<chance) this._freezeIceTarget(e);
                }
            }
        }
        // SLIPSTREAM: standing on ANY water (trail or puddle) ramps the player's speed.
        if(this._iceSlipstream){
            const onWater = this._iceTrail.some(t=>t.tx===ptx&&t.ty===pty) ||
                            (this._waterPuddles||[]).some(p=>p.tx===ptx&&p.ty===pty);
            const max=this._iceSlipMax||0;
            if(onWater){ this._iceSlipRamp=Math.min(max,(this._iceSlipRamp||0)+0.0006*(this.game.loop.delta||16)); }
            else       { this._iceSlipRamp=Math.max(0,(this._iceSlipRamp||0)-0.0012*(this.game.loop.delta||16)); }
            this._iceSlipBonus=this._iceSlipRamp||0;
            // Faster tile-stepping while the ramp is up. The base slow system clamps cooldown to
            // 200 when unslowed, so re-apply the bonus every frame after that clamp runs.
            if(this._iceSlipBonus>0 && this.moveCooldown<=200){
                this.moveCooldown=Math.max(90,Math.round(200*(1-this._iceSlipBonus)));
            }
        }
    }
    _drawDemonPortal(e,time,scale){
        if(scale<=0.01){ e._demonPortalGfx?.clear(); return; }
        if(!e._demonPortalGfx) e._demonPortalGfx=this.add.graphics().setDepth(2.4);
        const g=e._demonPortalGfx; g.clear();
        const TS=this.TILE_SIZE, px=e._demonPortalX, py=e._demonPortalY;
        const rx=TS*1.5*scale, ry=TS*0.85*scale;
        // dark void
        g.fillStyle(0x1a0022,0.85); g.fillEllipse(px,py,rx,ry);
        g.fillStyle(0x440066,0.5);  g.fillEllipse(px,py,rx*0.7,ry*0.7);
        // molten rim
        g.lineStyle(3,0xcc44ff,0.9); g.strokeEllipse(px,py,rx,ry);
        g.lineStyle(1.5,0xff88ff,0.7); g.strokeEllipse(px,py,rx*1.08,ry*1.08);
        // swirling embers around the rim
        for(let i=0;i<6;i++){
            const a=time*0.004+i*Math.PI/3;
            const ex=px+Math.cos(a)*rx*0.9, ey=py+Math.sin(a)*ry*0.9;
            g.fillStyle(0xff66cc,0.6*scale); g.fillCircle(ex,ey,2);
        }
    }
    // Downward arrow bobbing over the demon's LIVE position, tracking it as it moves underground.
    _drawDemonArrow(e,time,tx,ty){
        if(!e._demonArrowGfx) e._demonArrowGfx=this.add.graphics().setDepth(6.5);
        const g=e._demonArrowGfx; g.clear();
        const px=tx, py=ty-38+Math.sin(time*0.006)*4;
        const prog=1-Math.max(0,(e._demonSurfaceAt-time)/2000); // brightens as resurface nears
        const col=prog>0.7?0xff5555:0xcc44ff;
        g.fillStyle(col,0.9);
        g.fillTriangle(px-7,py-8, px+7,py-8, px,py+4);   // arrowhead pointing down
        g.fillRect(px-3,py-16,6,8);
    }
    // Red curved horns riding on the demon's head (alpha for the sink/rise fade).
    _drawDemonHorns(e,time,alpha){
        if(!e.sprite?.active){ e._hornGfx?.clear(); return; }
        if(!e._hornGfx) e._hornGfx=this.add.graphics().setDepth((e.sprite.depth||5)+0.1);
        const g=e._hornGfx; g.clear();
        if(alpha<=0.02) return;
        const x=e.sprite.x, y=e.sprite.y+this.TILE_SIZE*0.68, s=(e.sprite.scaleY||1)/(this._baseScale||this.SLIME_SCALE||1); // head sits low on the tile
        const hh=8*s;   // horn height scales with the (shrinking) demon
        g.fillStyle(0xcc2222,alpha); g.lineStyle(1.5,0x881111,alpha);
        // left horn (curves up-out) — base on the head, tips up
        g.beginPath(); g.moveTo(x-5*s,y-3*s); g.lineTo(x-8*s,y-3*s-hh); g.lineTo(x-3*s,y-4*s); g.closePath(); g.fillPath();
        // right horn
        g.beginPath(); g.moveTo(x+5*s,y-3*s); g.lineTo(x+8*s,y-3*s-hh); g.lineTo(x+3*s,y-4*s); g.closePath(); g.fillPath();
    }
    _drawDemonFlame(e,tt,time){
        if(!e._demonFlameGfx) e._demonFlameGfx=this.add.graphics().setDepth(5.2);
        const g=e._demonFlameGfx; g.clear();
        const x0=e.sprite.x,y0=e.sprite.y,x1=tt.px,y1=tt.py;
        const ang=Math.atan2(y1-y0,x1-x0), len=Math.hypot(x1-x0,y1-y0);
        const px=Math.cos(ang), py=Math.sin(ang);        // along
        const nx=-py, ny=px;                              // perp
        // Turbulent billowing plume: many soft puffs of varied size, jittering perpendicular so
        // the jet looks smoky/wispy (like the reference) rather than a clean cone. Time-seeded
        // pseudo-random keeps it animated but coherent frame-to-frame.
        const puffs=Math.max(14,Math.round(len/5));
        const seed=(i)=>Math.sin(i*12.9898+time*0.003)*43758.5453%1;
        for(let layer=0;layer<3;layer++){
            const col=[0x5500aa,0x9922ee,0xdd88ff][layer];
            const baseA=[0.14,0.26,0.5][layer];
            const wMul=[1.15,0.8,0.45][layer];
            for(let i=1;i<=puffs;i++){
                const t=i/puffs;
                const turb=(Math.abs(seed(i*2.1))-0.5)*2;      // -1..1 turbulence
                const billow=Math.sin(time*0.012+i*0.9)*t*6 + turb*t*7;
                const cx=x0+px*len*t + nx*billow;
                const cy=y0+py*len*t + ny*billow;
                const rad=(2+t*13*wMul)*(0.7+0.5*Math.abs(seed(i*3.7)));
                g.fillStyle(col, baseA*(0.6+0.4*Math.sin(time*0.02+i)));
                g.fillCircle(cx,cy,rad);
                // little wispy tendrils peeling off the edges
                if(layer===2 && i%3===0){
                    const wob=(seed(i*5.5))*8;
                    g.fillStyle(0xeeaaff,0.4); g.fillCircle(cx+nx*wob,cy+ny*wob,1.5);
                }
            }
        }
        // Hot bright mouth at the demon.
        g.fillStyle(0xffffff,0.85); g.fillCircle(x0,y0,3.5);
        g.fillStyle(0xffccff,0.6); g.fillCircle(x0,y0,6);
    }
    // Show/hide an enemy's health bar + overheal bar (used when the demon is submerged in hell).
    _setEnemyBarsVisible(e,vis){
        e.healthBarBg?.setVisible(vis);
        e.healthBarFill?.setVisible(vis);
        e._overhealGfx?.setVisible(vis);
    }
    // ── ANGEL: flies (turret-immune, wisp-only), casts a ground ring giving enemies under it
    // 35% damage reduction. Tethered to nearby Demons; ring scales with tethered-demon count.
    _updateAngel(e,time,dt){
        if(!e._tdAngel||!e.sprite?.active)return;
        e._flying=true; e._turretImmune=true;
        const R=8*this.TILE_SIZE;
        const demons=(this.enemies||[]).filter(o=>o._tdDemon&&o.sprite?.active&&Math.hypot(o.sprite.x-e.sprite.x,o.sprite.y-e.sprite.y)<=R);
        e._tetheredDemons=demons.length;
        const ringR=(3.5+Math.min(3,demons.length)*0.8)*this.TILE_SIZE;
        e._angelRingR=ringR;
        const healFrac=e._angelHealFrac||0.04;    // fraction of MAX HP healed per second (scales w/ enemy size + waves)
        if(!e._angelHealGfx) e._angelHealGfx=this.add.graphics().setDepth(4.5);
        const hg=e._angelHealGfx; hg.clear();
        for(const o of (this.enemies||[])){
            if(!o.sprite?.active)continue;
            if(Math.hypot(o.sprite.x-e.sprite.x,o.sprite.y-e.sprite.y)<=ringR){
                o._enlightenedUntil=time+120;
                // Heal over time (% of max HP) — but NEVER overheal (capped at maxHealth).
                const mh=o.maxHealth||o._maxHealth||o.health;
                // WATERLOG (Ice/Douse) — wet enemies receive reduced healing.
                const wetCut=(o._wetUntil>time)?(1-(this._iceWetHealCut||0)):1;
                if(o.health<mh && wetCut>0){
                    o.health=Math.min(mh, o.health+mh*healFrac*wetCut*dt);
                    o._lastTrackedHealth=o.health; // keep damage tracking consistent with the heal
                    if(o.healthBarFill && mh>0) o.healthBarFill.width=24*(o.health/mh); // reflect heal on the bar
                    // green heal shimmer — rising plus-motes over the healed enemy
                    const ph=(time*0.004+o.sprite.x)%1;
                    hg.fillStyle(0x66ff99,0.7*(1-ph));
                    const hx=o.sprite.x+Math.sin(time*0.01+o.sprite.x)*4, hy=o.sprite.y+4-ph*16;
                    hg.fillRect(hx-3,hy-1,6,2); hg.fillRect(hx-1,hy-3,2,6);
                }
            }
        }
        for(const d of demons){ d._angelBuffed=true; }
        // Fly the angel BODY up off the ground, leaving a shadow at its true (path) position.
        // We don't move e.sprite (that's the pathing anchor) — we lift its display via origin and
        // draw the wings/halo/shadow relative to the lifted body.
        const LIFT=26;
        const gx=e.sprite.x, gy=e.sprite.y;      // ground/path position
        const bx=gx, by=gy-LIFT;                  // flying body position
        e.sprite.y = gy;                          // keep sprite anchored to ground logically...
        e.sprite.setOrigin?.(0.5, 0.5 + LIFT/ (e.sprite.displayHeight||24)); // ...but draw it lifted

        if(!e._angelGfx) e._angelGfx=this.add.graphics().setDepth(2.2);
        const g=e._angelGfx; g.clear();

        // 1) GROUND SHADOW at the true position (soft ellipse), shrinks a touch as it "hovers".
        const shb=0.9+0.1*Math.sin(time*0.004);
        g.fillStyle(0x000000,0.22); g.fillEllipse(gx,gy+6,20*shb,7*shb);

        // 2) DETAILED HOLY RING on the ground — layered, rotating, with radiant tick marks.
        const rr=ringR;
        g.lineStyle(3,0xfff2aa,0.55+0.2*Math.sin(time*0.005)); g.strokeCircle(gx,gy,rr);
        g.lineStyle(1.5,0xffffff,0.4); g.strokeCircle(gx,gy,rr*0.92);
        g.fillStyle(0xffee88,0.05); g.fillCircle(gx,gy,rr);
        // rotating radiant ticks around the rim
        const ticks=16;
        for(let i=0;i<ticks;i++){
            const a=time*0.0015+i*(Math.PI*2/ticks);
            const inr=rr*0.9, outr=rr*(i%2?1.0:0.97);
            const fl=0.4+0.5*Math.abs(Math.sin(time*0.004+i));
            g.lineStyle(1.5,0xfff6cc,fl);
            g.beginPath(); g.moveTo(gx+Math.cos(a)*inr,gy+Math.sin(a)*inr); g.lineTo(gx+Math.cos(a)*outr,gy+Math.sin(a)*outr); g.strokePath();
        }
        // faint inner glow pulse
        g.fillStyle(0xffffff,0.05+0.04*Math.sin(time*0.008)); g.fillCircle(gx,gy,rr*0.5);

        // 3) TETHERS to demons — pulsing holy threads.
        for(const d of demons){
            const pulse=0.35+0.35*Math.sin(time*0.01+d.sprite.x*0.05);
            g.lineStyle(2,0xffccff,pulse); g.beginPath(); g.moveTo(bx,by); g.lineTo(d.sprite.x,d.sprite.y); g.strokePath();
        }

        // 4) WINGS — anchored on the visible slime body. The slime art sits on the lower half of
        // its frame, so the real body centre is BELOW `by`; hang the wings there so they don't
        // float up by the halo.
        const bodyY=by+this.TILE_SIZE*0.15;   // where the visible slime actually is
        const flap=Math.sin(time*0.006)*0.25;
        g.fillStyle(0xffffff,0.85); g.lineStyle(1,0xffe9b0,0.9);
        for(const side of [-1,1]){
            const wroot=bx+side*7;
            for(let f=0;f<3;f++){
                const spread=(0.35+f*0.32)+flap*side*0.3;
                const wx=wroot+side*(6+f*7)*Math.cos(spread);
                const wy=bodyY-(6+f*7)*Math.sin(spread)*0.6;
                g.beginPath(); g.moveTo(wroot,bodyY); g.lineTo(wx,wy); g.lineTo(wroot+side*3,bodyY+5); g.closePath(); g.fillPath();
            }
        }

        // 5) HALO ring just above the head (head top ≈ bodyY - ~8).
        const hy=bodyY-9-2*Math.sin(time*0.004);
        g.lineStyle(3,0xffee66,0.95); g.strokeEllipse(bx,hy,15,5);
        g.lineStyle(1.5,0xffffff,0.8); g.strokeEllipse(bx,hy,12,4);

        // Health bar: sit it neatly just above the halo. The fill is a centre-origin rect (same
        // as the base bars), so just centre it at bx — don't left-anchor it (that fought the base
        // positioning and made the red part drift left).
        const barY=hy-9;
        if(e.healthBarBg){ e.healthBarBg.y=barY; e.healthBarBg.x=bx; }
        if(e.healthBarFill){ e.healthBarFill.y=barY; e.healthBarFill.x=bx; }
    }
    _updateTowerChipDamage(time){
        if(!this.towers||!this.towers.length)return;
        if(time<(this._nextTowerChip||0))return;
        this._nextTowerChip=time+500; // check twice a second
        for(const e of this.enemies){
            if(!e?.sprite?.active||e._isTotem||e._isDummy||e.isRanged||e._fleeing)continue;
            // Melee enemies only; ranged/stationary don't melee towers.
            for(const t of this.towers){
                if(!t.active||t.hp==null)continue;
                if(Math.abs(e.x-t.tileX)+Math.abs(e.y-t.tileY)===1){ // orthogonally adjacent
                    this._damageTower(t,(e._tdDmg||5)*0.5);
                    break; // one tower per enemy per tick
                }
            }
        }
    }

    // ─── TOWERS ───────────────────────────────────────────────────────────────
    // Static definition data — memoized so it isn't rebuilt on every call (this runs
    // per-frame per-tower inside _updateTowers). These are read-only lookups; upgrades
    // write to per-tower fields (tower._rangeBonus etc.), never to this object.
    _towerDefs(){ return this.__towerDefs||(this.__towerDefs=this._buildTowerDefs()); }
    _buildTowerDefs(){return{
        tesla_coil:      {name:'Tesla Coil',   cost:45, hp:120,range:5, damage:8,fireInterval:900,   color:0x44aaff,icon:'⚡',desc:'Chains lightning to 4 enemies',chainTargets:4,chainFalloff:3},
        sniper:          {name:'Sniper',        cost:35, hp:60, range:16,damage:28,fireInterval:1800,  color:0xff6644,icon:'🎯',desc:'Extreme range, pierces 2 enemies',pierce:2},
        machine_gun:     {name:'Machine Gun',  cost:25, hp:80, range:5, damage:3, fireInterval:150,   color:0xffcc44,icon:'🔫',desc:'Shreds up close — very high DPS, short range',burstCount:3},
        magnetizer:      {name:'Magnetizer',   cost:80, hp:200,range:10,damage:0, fireInterval:8000, color:0x44ffaa,icon:'🧲',desc:'Fires a gravity well at enemies — pulls nearby enemies in, then implodes leaving them vulnerable',slowAura:false},
        healer_turret:   {name:'Healer Turret',cost:40, hp:100,range:5, healAmt:8,fireInterval:2000,  color:0x44ff88,icon:'💚',desc:'Heals nearby towers',isHealer:true},
        healing_fountain:{name:'Fountain',     cost:50, hp:150,range:4, healAmt:12,fireInterval:1500, color:0x88ffdd,icon:'⛲',desc:'Shields the base from projectiles when placed near it; also heals nearby towers',isHealer:true},
        cannon:          {name:'Cannon',       cost:40, hp:90, range:8, damage:50,fireInterval:3000,  color:0xff8844,icon:'💣',desc:'Slow but massive AoE blast',aoe:true,aoeRadius:2.5},
        skyward:         {name:'Skyward',      cost:200,hp:500,range:0, damage:0, fireInterval:45000, color:0xff4422,icon:'🛰',desc:'One only. Rains death on 50% of all enemies',unique:true,footprint:3},
    };}

    // Cost scales 1.5× per existing turret of that type currently placed
    _getTowerCost(type){
        const base=this._towerDefs()[type]?.cost||10;
        if(type==='skyward')return base;
        if(type==='magnetizer'){
            const count=this.towers.filter(t=>t.type==='magnetizer').length;
            const costs=[80,200,500,1250];
            return costs[Math.min(count,costs.length-1)];
        }
        const count=this.towers.filter(t=>t.type===type).length;
        return Math.round(base*Math.pow(1.5,count));
    }

    _placeTower(type,tileX,tileY){
        const TS=this.TILE_SIZE,def=this._towerDefs()[type];
        const cost=this._getTowerCost(type);
        const fp=def.footprint||1, half=Math.floor(fp/2);
        if(!def||this.scraps<cost)return false;
        // Validate entire footprint
        for(let dx=-half;dx<=half;dx++) for(let dy=-half;dy<=half;dy++){
            const nx=tileX+dx,ny=tileY+dy;
            if(this.world[nx]?.[ny]!==this.FLOOR)return false;
            if(this.towers.some(t=>t.tileX===nx&&t.tileY===ny))return false;
            if(Math.hypot(nx-this.baseTileX,ny-this.baseTileY)<=3)return false;
        }
        this.scraps-=cost; this.orbScraps=this.scraps;
        const px=tileX*TS+TS/2, py=tileY*TS+TS/2;
        const fpW=fp*TS;

        // Base plate — full footprint size
        const base=this.add.graphics().setDepth(1.6);
        if(fp>1){
            const ox=tileX*TS-half*TS, oy=tileY*TS-half*TS;
            // Outer dark base
            base.fillStyle(0x111111,0.97);
            base.fillRect(ox+2,oy+2,fpW-4,fpW-4);
            base.lineStyle(2,def.color,0.8);
            base.strokeRect(ox+2,oy+2,fpW-4,fpW-4);
            // Outer border inset panel (grey)
            base.lineStyle(1,0x444444,0.7);
            base.strokeRect(ox+5,oy+5,fpW-10,fpW-10);
            // 4 outer panels — lines from outer edge to inner core boundary
            const mid=ox+half*TS+TS/2;
            const coreL=tileX*TS-2, coreR=tileX*TS+TS+2, coreT=tileY*TS-2, coreB=tileY*TS+TS+2;
            base.lineStyle(1,0x333333,0.8);
            base.beginPath(); base.moveTo(mid,oy+5);   base.lineTo(mid,coreT); base.strokePath();
            base.beginPath(); base.moveTo(mid,coreB);  base.lineTo(mid,oy+fpW-5); base.strokePath();
            base.beginPath(); base.moveTo(ox+5,mid);   base.lineTo(coreL,mid); base.strokePath();
            base.beginPath(); base.moveTo(coreR,mid);  base.lineTo(ox+fpW-5,mid); base.strokePath();
            // Rivets at 4 corners of inner panel
            base.fillStyle(0x666666,0.9);
            [[ox+8,oy+8],[ox+fpW-8,oy+8],[ox+8,oy+fpW-8],[ox+fpW-8,oy+fpW-8]].forEach(([rx,ry])=>{
                base.fillCircle(rx,ry,2.5);
                base.lineStyle(0.5,0x888888,0.6); base.strokeCircle(rx,ry,2.5);
            });
            // Inner core area — slightly lighter dark
            base.fillStyle(0x1e0e02,0.97);
            base.fillRect(tileX*TS-2,tileY*TS-2,TS+4,TS+4);
            base.lineStyle(1.5,def.color,0.6);
            base.strokeRect(tileX*TS-2,tileY*TS-2,TS+4,TS+4);
            // Inner core subtle cross-panel lines
            base.lineStyle(0.5,0x2a1a08,0.8);
            base.beginPath(); base.moveTo(tileX*TS+TS/2,tileY*TS-2); base.lineTo(tileX*TS+TS/2,tileY*TS+TS+2); base.strokePath();
            base.beginPath(); base.moveTo(tileX*TS-2,tileY*TS+TS/2); base.lineTo(tileX*TS+TS+2,tileY*TS+TS/2); base.strokePath();
        } else {
            base.fillStyle(0x222222,0.92);
            base.fillRect(tileX*TS+3,tileY*TS+3,TS-6,TS-6);
            base.lineStyle(1.5,def.color,0.85);
            base.strokeRect(tileX*TS+3,tileY*TS+3,TS-6,TS-6);
        }

        // Mark all footprint tiles as occupied
        for(let dx=-half;dx<=half;dx++) for(let dy=-half;dy<=half;dy++)
            this.world[tileX+dx][tileY+dy]=3; // 3=tower-occupied

        // Body — drawn in local space
        const body=this.add.graphics().setDepth(1.7);
        body.x=px; body.y=py;
        const esTypeMap={tesla_coil:'tesla_coil',sniper:'sniper_tower',machine_gun:'machine_gun',magnetizer:'magnetizer'};
        const esType=esTypeMap[type];
        if(esType) this._drawEngineerTowerBody(body,esType,def.color);
        else        this._drawTDTowerBody(body,type,def.color);

        // Range ring
        const rangeRing=this.add.circle(px,py,def.range*TS,0,0).setDepth(1.5);
        rangeRing.setStrokeStyle(1,def.color,0.18);

        // HP bar
        const hpBarBg  =this.add.rectangle(px,tileY*TS-half*TS-4,fpW,4,0x000000,0.75).setDepth(3.5).setVisible(false);
        const hpBarFill=this.add.rectangle(px-fpW/2,tileY*TS-half*TS-4,fpW,4,def.color,0.95).setOrigin(0,0.5).setDepth(3.6).setVisible(false);

        // Placement flash
        const flash=this.add.circle(px,py,fpW*0.6,def.color,0.4).setDepth(3);
        this.tweens.add({targets:flash,radius:fpW,alpha:0,duration:250,onComplete:()=>flash.destroy()});

        const tower={
            type,towerType:esType||type,tileX,tileY,px,py,
            base,body,rangeRing,hpBarBg,hpBarFill,
            hp:def.hp,maxHp:def.hp,lastFireTime:this.time.now,level:1,upgradePath:null,
            active:true,paidCost:cost,slowAura:!!def.slowAura,
            _rangeBonus:this._globalRangeBonus||0,
            _fireRateMult:this._towerCDMult||1,
            _tdUnique:!esType,
            _footprint:fp,
        };
        this.towers.push(tower);
        if(esType) this.engineerTowers.push(tower);

        // If this is a duplicate placement, copy upgrades from source tower
        if(this._dupSource&&this._dupSource.type===type){
            const src=this._dupSource;
            this._dupSource=null;
            // Copy all upgrade flags and _upgrades record
            if(src._upgrades) tower._upgrades={...src._upgrades};
            // Copy all upgrade effect properties
            const copyProps=['_dmgMult','_fireRateMult','_rangeBonus','_aoeBonus',
                '_tcChains','_tcOmnistrike','_tcChainRadius','_tcCrowdMult','_tcCrowdBonus','_tcCrowdCap','_tcSlowAura',
                '_snExplode','_snAoeR','_snShrapnel','_snArmorPierce','_snFlatBonus','_snAntiArmor','_snCritChance','_snCritMult','_snPriority',
                '_mgWarmup','_mgOverheatTime','_mgThermalCore','_mgLaser','_mgLaserBounces','_mgChainDeath','_mgFocus','_mgArmorBreak','_mgExecute',
                '_mgShotgun','_mgBullets','_mgHollowPoint',
                '_canCatapult','_canNapalm','_canShotCount','_canCarpetBomb','_canCoreBonus','_canCoreStun','_canPrecision','_canAftershock','_canPctDmg',
                '_magPullDist','_magPullInterval','_magStunOnPull','_magContinuous','_magImplosion','_magMode',
                '_magPullRadius','_magWellDur','_magVulnDur','_magVulnMult','_magTwinWells','_magSlowOnRelease','_magLingerVuln',
                '_wavePushTiles','_waveInterval','_waveSlowAmt','_waveSlowDur','_waveWidth','_waveAng',
                '_chillTickInterval','_chillFreezeDur',
                '_healBonus','_incendiary','_burstBonus',
                '_healTriage','_healAll','_emergency','_healBase','_baseRepairRate','_baseWard',
                '_regenField','_reinforce','_guardian','_cleanse','_overflow','_sanctuary'];
            for(const p of copyProps) if(src[p]!==undefined) tower[p]=src[p];
            // Reapply range ring if range changed
            if(tower._rangeBonus&&tower.rangeRing){
                const newRange=(this._towerDefs()[type]?.range||8)+(tower._rangeBonus||0);
                tower.rangeRing.setRadius(newRange*this.TILE_SIZE);
            }
            this._showFloatingText(tower.px,tower.py-20,'DUPLICATED!','#44ffaa');
        } else {
            this._dupSource=null;
        }

        const hit=this.add.rectangle(px,py,fpW,fpW,0xffffff,0).setDepth(5).setInteractive();
        tower.hitArea=hit;
        hit.on('pointerdown',p=>{
            p.event.stopPropagation();
            this._openUpgradeMenu(tower);
        });
        return true;
    }

    // Body for TD-unique types (cannon, healer_turret, healing_fountain) — local space
    _drawTDTowerBody(g,type,color){
        g.clear();
        if(type==='cannon'){
            g.fillStyle(0x444455,1); g.fillCircle(0,-2,9);
            g.fillStyle(color,0.9);  g.fillCircle(0,-2,5);
            g.lineStyle(4,0x777788,1); g.beginPath(); g.moveTo(0,2); g.lineTo(0,-14); g.strokePath();
            g.fillStyle(0x999aaa,1); g.fillCircle(0,-14,3);
        } else if(type==='healer_turret'){
            g.fillStyle(0x1a3322,0.9); g.fillCircle(0,-2,9);
            g.fillStyle(color,0.9);   g.fillCircle(0,-2,6);
            g.fillStyle(0xffffff,1);  g.fillRect(-4,-3,8,2); g.fillRect(-1,-6,2,8);
        } else if(type==='healing_fountain'){
            g.fillStyle(0x1a3344,0.9); g.fillCircle(0,-2,9);
            g.fillStyle(color,0.8);   g.fillCircle(0,-2,6);
            g.fillStyle(0xaaeeff,0.7);g.fillCircle(0,-2,3);
        } else if(type==='skyward'){
            // Armoured platform: inner circle, 4 diagonal struts with nubs, crosshair, hot core
            g.fillStyle(0x1a0a00,1); g.fillCircle(0,0,9);
            g.lineStyle(1.5,0xff4422,0.7); g.strokeCircle(0,0,9);
            // 4 diagonal struts
            g.lineStyle(2,0xff4422,0.9);
            for(let a=0;a<4;a++){
                const ang=a*Math.PI/2+Math.PI/4;
                g.beginPath(); g.moveTo(Math.cos(ang)*5,Math.sin(ang)*5);
                g.lineTo(Math.cos(ang)*10,Math.sin(ang)*10); g.strokePath();
                g.fillStyle(0xff6644,1); g.fillCircle(Math.cos(ang)*10,Math.sin(ang)*10,2);
            }
            // Crosshair
            g.lineStyle(1,0xff2200,0.5);
            g.beginPath(); g.moveTo(-9,0); g.lineTo(9,0); g.strokePath();
            g.beginPath(); g.moveTo(0,-9); g.lineTo(0,9); g.strokePath();
            // Hot core
            g.fillStyle(0xff2200,1); g.fillCircle(0,0,3.5);
            g.fillStyle(0xff8844,0.9); g.fillCircle(0,0,1.5);
        }
    }

    _sellTower(tower,refund=true){
        if(refund){
            const def=this._towerDefs()[tower.type];
            const paid=tower.paidCost||def.cost;
            // Refund scales with condition: a full-HP tower gives the standard 60%, a badly
            // damaged one gives much less (down to a 20% floor), so letting towers get chewed
            // up costs you. hp/maxHp defaults to 1 for towers that never took the HP system.
            const hpFrac=(tower.maxHp>0)?Math.max(0,Math.min(1,tower.hp/tower.maxHp)):1;
            const rate=0.2+0.4*hpFrac;   // 20% at 0 HP → 60% at full
            this.scraps+=Math.floor(paid*rate);
            this.orbScraps=this.scraps;
        }
        // Free entire footprint
        const fp=tower._footprint||1, half=Math.floor(fp/2);
        for(let dx=-half;dx<=half;dx++) for(let dy=-half;dy<=half;dy++)
            this.world[tower.tileX+dx][tower.tileY+dy]=this.FLOOR;
        tower.base?.destroy(); tower.body?.destroy(); tower.rangeRing?.destroy(); tower._statusGfx?.destroy();
        tower._dotGfx?.destroy(); tower._skyAuraGfx?.destroy(); tower._skyReadyTxt?.destroy();
        tower._mgFocusGfx?.destroy(); tower._waveDirGfx?.destroy(); tower._auraGfx?.destroy();
        tower._mgAimGfx?.destroy();
        tower._purpleFireGfx?.destroy();
        if(tower._chillTiles){ tower._chillTiles.forEach(ct=>ct.gfx?.destroy()); tower._chillTiles=null; }
        tower.hpBarBg?.destroy(); tower.hpBarFill?.destroy(); tower.hitArea?.destroy();
        tower.active=false;
        const ti=this.towers.indexOf(tower); if(ti!==-1)this.towers.splice(ti,1);
        const ei=this.engineerTowers?.indexOf(tower); if(ei!==-1)this.engineerTowers.splice(ei,1);
    }

    // Towers cannot see cloaked enemies (Wraith stealth) — they're invincible to tower fire
    // anyway, so targeting them just wastes shots. Only Light's reveal pulse exposes them.
    _towerCanTarget(e){ return e?.sprite?.active && !e._cloaked && !e._demonHidden; }

    _updateTowers(time,dt){
        const TS=this.TILE_SIZE;

        // Status icons on towers (attack-slowed / heal-blocked from tethers, etc.)
        for(const tower of this.towers){ if(tower.active) this._updateStatusIcons(tower); }

        // EMS DISABLE — a tower hit by an EMS pulse can't fire until the disable expires. Pinning
        // lastFireTime to 'now' each frame means the fire interval never elapses, which blocks
        // BOTH the ES engine towers and the custom (cannon/sniper/skyward) fire paths uniformly.
        for(const tower of this.towers){
            if(tower.active && tower._emsDisabledUntil>time){
                tower.lastFireTime=time;                 // never accrues enough to fire
                if(!tower._emsDisabled){
                    // Just got EMPed — snapshot normal state and go "powered down".
                    tower._emsDisabled=true;
                    tower._emsPreRot = tower.body?.rotation||0;
                }
                // Gray out (drained of power) and droop the barrel downward like it went limp.
                if(tower.body?.active){
                    tower.body.setTint?.(0x556677);
                    // Tilt the barrel down toward "resting" — rotate toward pointing down (PI/2)
                    // and sag slightly below the base.
                    tower.body.rotation = Phaser.Math.Angle.RotateTo(tower.body.rotation, Math.PI/2, 0.12);
                    tower.body.y = (tower.py||tower.body.y) + 2*Math.sin(time*0.004); // faint powerless wobble
                }
                if(tower.base?.active) tower.base.setTint?.(0x556677);
            } else if(tower._emsDisabled){
                // Recovered — restore color and hand rotation back to the aiming system.
                tower._emsDisabled=false;
                tower.body?.clearTint?.();
                tower.base?.clearTint?.();
                if(tower.body) tower.body.y = tower.py||tower.body.y;
                // brief "power back on" flash
                if(tower.body?.active){
                    tower.body.setTint?.(0xaaffff);
                    this.time.delayedCall(150,()=>{ tower.body?.clearTint?.(); });
                }
            }
        }

        // Patch ES tower defs with TD damage/range/interval values before ES update runs
        const esDefs=this._engineerTowerDefs();
        const tdDefs=this._towerDefs();
        const esMap={tesla_coil:'tesla_coil',sniper:'sniper_tower',machine_gun:'machine_gun',magnetizer:'magnetizer'};
        for(const [tdType,esType] of Object.entries(esMap)){
            if(!esDefs[esType]||!tdDefs[tdType])continue;
            const d=esDefs[esType],t=tdDefs[tdType];
            d.baseDamage = t.damage * this.turretDmgMult * (this._waveBoost||1);
            d.damage     = d.baseDamage;
            // Per-tower damage multiplier from upgrades
            const esT=this.towers.find(tw=>tw.type===tdType&&tw.active);
            if(esT?._dmgMult){ d.baseDamage*=esT._dmgMult; d.damage=d.baseDamage; }
            d.range      = t.range + this._globalRangeBonus;
            // CEO nearsight: if this tower type's tower is currently nearsighted, collapse its
            // ES range too (the ES engine reads this def range — without this, nearsight only
            // affected non-ES towers and did nothing to tesla/sniper/MG).
            if(esT?._nearsightUntil>time) d.range*=0.4;
            d.fireInterval = t.fireInterval * this._towerCDMult;
            if(t.chainTargets) d.chainTargets = t.chainTargets + this._chainBonus;
            if(t.pierce)       d.pierce       = t.pierce       + this._pierceBonus;
        }
        // Per-tower tesla overrides (chain count, falloff, dmg bonus + crowd multiplier)
        for(const tower of this.towers){
            if(tower.type!=='tesla_coil'||!tower.active)continue;
            const d=esDefs['tesla_coil'];
            // Omnistrike: fire directly at all enemies in range (no chain routing)
            if(tower._tcOmnistrike) d.chainTargets=999;
            else if(tower._tcChains) d.chainTargets=tower._tcChains;
            // Arc Mastery tight chain radius — patch onto def so updateTeslaBolts reads it
            d.chainRadius = tower._tcChainRadius||null; // null = use full range
            if(tower._dmgMult){ d.baseDamage*=tower._dmgMult; d.damage=d.baseDamage; }
            // Crowd multiplier
            if(tower._tcCrowdMult){
                const range=(tdDefs.tesla_coil.range+(tower._rangeBonus||0))*TS;
                const inRange=this.enemies.filter(e=>this._towerCanTarget(e)&&Math.hypot(e.sprite.x-tower.px,e.sprite.y-tower.py)<=range).length;
                const crowdBonus=Math.min(tower._tcCrowdCap||10,inRange)*(tower._tcCrowdBonus||0.08);
                d.baseDamage=d.baseDamage*(1+crowdBonus);
                d.damage=d.baseDamage;
            }
            break;
        }

        // Pre-pass: mark laser MG towers so updateEngineerTowers skips them
        for(const tower of this.towers){
            if(tower.type==='machine_gun'&&tower.active)
                tower._skipESFire=!!(tower._mgLaser||tower._mgShotgun);
        }

        // Run the real ES tower update for tesla/sniper/MG/magnetizer
        this.updateEngineerTowers(time);
        this.updateTeslaBolts(dt*1000);
        this.updateEngineerBullets(dt*1000);

        // Rotate directional tower bodies toward nearest enemy every frame
        for(const tower of this.towers){
            if(!tower.body?.active)continue;
            if(tower._emsDisabled)continue;   // EMPed towers droop; don't fight the disable animation
            if(tower.type!=='sniper'&&tower.type!=='machine_gun'&&tower.type!=='cannon')continue;
            const def=tdDefs[tower.type];
            const rangeTiles=(def.range+(tower._rangeBonus||0))*((tower._nearsightUntil>time)?0.4:1);
            let targetSprite=null;

            // Sniper: use locked target (_sniperTarget) for immediate head-turn on lock
            if(tower.type==='sniper'&&tower._sniperTarget?.sprite?.active){
                targetSprite=tower._sniperTarget.sprite;
            } else {
                let nd=Infinity;
                for(const e of this.enemies){
                    if(!this._towerCanTarget(e))continue;
                    const dtiles=Math.abs(e.x-tower.tileX)+Math.abs(e.y-tower.tileY);
                    if(dtiles<=rangeTiles&&dtiles<nd){nd=dtiles;targetSprite=e.sprite;}
                }
            }

            if(targetSprite){
                tower._aimAngle=Math.atan2(targetSprite.y-tower.py,targetSprite.x-tower.px)+Math.PI/2;
            }
            if(tower._aimAngle!==undefined){
                // Sniper snaps faster when locked, smooth otherwise
                const step=tower.type==='sniper'&&tower._sniperTarget?.sprite?.active?0.35:0.18;
                tower.body.rotation=Phaser.Math.Angle.RotateTo(tower.body.rotation,tower._aimAngle,step);
            }
        }

        // Per-tower sniper overrides — Deadeye speeds up prefire and bullet
        for(const tower of this.towers){
            if(tower.type!=='sniper'||!tower.active)continue;
            const d=esDefs['sniper_tower'];
            if(tower._upgrades?.sn_3c){
                d.prefireDur=300;
                d.bulletSpeed=1400;
            } else {
                d.prefireDur=900;
                d.bulletSpeed=600;
            }
            break;
        }

        // Per-tower MG overrides — reset def to base FIRST, then each tower applies its own patches
        {
            const d=esDefs['machine_gun'];
            const baseFI=d._baseFI||(d._baseFI=d.fireInterval);
            const baseDmg=d._baseDmg||(d._baseDmg=d.baseDamage);
            // Reset to base before any tower patches
            d.baseDamage=baseDmg; d.damage=baseDmg; d.fireInterval=baseFI;

            for(const tower of this.towers){
                if(tower.type!=='machine_gun'||!tower.active)continue;

                // ── WARMUP ──────────────────────────────────────────────────
                if(tower._mgWarmup){
                    const inRange=this.enemies.filter(e=>this._towerCanTarget(e)&&
                        Math.hypot(e.sprite.x-tower.px,e.sprite.y-tower.py)<=(d.range+(tower._rangeBonus||0))*this.TILE_SIZE);
                    const shooting=inRange.length>0&&!tower._mgOverheated;
                    if(shooting){
                        tower._mgHeat=(tower._mgHeat||0)+time-(tower._mgLastTick||time);
                        if(tower._mgHeat>=(tower._mgOverheatTime||8000)){
                            tower._mgOverheated=true; tower._mgHeat=0;
                            tower._mgCooldownEnd=time+3000;
                            this._showFloatingText(tower.px,tower.py-20,'OVERHEAT!','#ff4422');
                        }
                    } else {
                        tower._mgHeat=Math.max(0,(tower._mgHeat||0)-(time-(tower._mgLastTick||time))*0.5);
                    }
                    if(tower._mgOverheated&&time>=tower._mgCooldownEnd){
                        tower._mgOverheated=false;
                        if(tower._mgThermalCore) tower._mgThermalBurst=time+2000;
                    }
                    tower._mgLastTick=time;
                    const pct=Math.min(1,(tower._mgHeat||0)/(tower._mgOverheatTime||8000));
                    if(tower._mgOverheated){ d.baseDamage=0; d.damage=0; d.fireInterval=99999; }
                    else if(tower._mgThermalBurst&&time<tower._mgThermalBurst){ d.baseDamage=baseDmg*3; d.damage=baseDmg*3; }
                    else { const m=1+pct*2; d.baseDamage=baseDmg*m; d.damage=baseDmg*m; d.fireInterval=baseFI*(1-pct*0.5); }
                }

                // ── FOCUS FIRE ──────────────────────────────────────────────
                if(tower._mgFocus){
                    const mgRange=(d.range+(tower._rangeBonus||0))*this.TILE_SIZE;
                    const target=this.enemies.find(e=>this._towerCanTarget(e)&&Math.hypot(e.sprite.x-tower.px,e.sprite.y-tower.py)<=mgRange)||null;
                    if(target!==tower._mgFocusTarget){
                        tower._mgFocusGfx?.destroy(); tower._mgFocusGfx=null;
                        tower._mgFocusRamp=1; tower._mgFocusTarget=target; tower._mgFocusRampStart=time;
                    }
                    if(target&&target.sprite?.active){
                        tower._mgFocusRamp=Math.min(5,1+(time-tower._mgFocusRampStart)/1000);
                        let mult=tower._mgFocusRamp*(tower._dmgMult||1);
                        if(tower._mgExecute&&target.health/target.maxHealth<0.2) mult*=3;
                        d.baseDamage=baseDmg*mult; d.damage=d.baseDamage;
                        if(tower._mgArmorBreak) target._mgDmgAmpBonus=tower._mgArmorBreak||0;
                        // Draw target crosshair
                        if(!tower._mgFocusGfx||!tower._mgFocusGfx.active)
                            tower._mgFocusGfx=this.add.graphics().setDepth(0.8);
                        const g2=tower._mgFocusGfx; g2.clear();
                        const flash=0.5+0.4*Math.sin(time*0.01);
                        const TS2=this.TILE_SIZE;
                        g2.lineStyle(2,0xff4444,0.8*flash); g2.strokeCircle(target.sprite.x,target.sprite.y,TS2*1.1);
                        g2.lineStyle(1,0xff8844,0.5*flash); g2.strokeCircle(target.sprite.x,target.sprite.y,TS2*0.55);
                        const cl=TS2*1.5;
                        g2.lineStyle(1.5,0xff4444,0.7*flash);
                        g2.beginPath();g2.moveTo(target.sprite.x-cl,target.sprite.y);g2.lineTo(target.sprite.x+cl,target.sprite.y);g2.strokePath();
                        g2.beginPath();g2.moveTo(target.sprite.x,target.sprite.y-cl);g2.lineTo(target.sprite.x,target.sprite.y+cl);g2.strokePath();
                        if(tower._mgFocusRamp>1.5) this._showFloatingText(target.sprite.x,target.sprite.y-28,`${tower._mgFocusRamp.toFixed(1)}×`,'#ffaa44');
                    } else {
                        tower._mgFocusGfx?.destroy(); tower._mgFocusGfx=null;
                        tower._mgFocusRamp=1; tower._mgFocusTarget=null;
                    }
                }

                // ── SHOTGUN MG ──────────────────────────────────────────────
                if(tower._mgShotgun){
                    // Shotgun uses slower volley interval
                    const shotgunFI=Math.max(100,baseFI*4/3)*(tower._fireRateMult||1);
                    if(time-(tower._mgShotgunLastFire||0)>=shotgunFI){
                        const sgRange=(d.range+(tower._rangeBonus||0))*this.TILE_SIZE;
                        const tgt=this.enemies.find(e=>this._towerCanTarget(e)&&Math.hypot(e.sprite.x-tower.px,e.sprite.y-tower.py)<=sgRange);
                        if(tgt){
                            tower._mgShotgunLastFire=time;
                            this._fireShotgunVolley(tower,tgt,baseDmg*(tower._dmgMult||1));
                        }
                    }
                    tower._skipESFire=true;
                }
                if(tower._mgLaser){
                    const fi=baseFI*(tower._fireRateMult||1);
                    if(time-tower.lastFireTime>=fi){
                        const laserRange=(d.range+(tower._rangeBonus||0))*this.TILE_SIZE;
                        const tgt=this.enemies.find(e=>this._towerCanTarget(e)&&Math.hypot(e.sprite.x-tower.px,e.sprite.y-tower.py)<=laserRange);
                        if(tgt){
                            tower.lastFireTime=time;
                            const baseAng=Math.atan2(tgt.sprite.y-tower.py,tgt.sprite.x-tower.px);
                            const bounces=tower._mgLaserBounces||0;
                            const laserCount=bounces>=2?3:1;
                            const dmgPerLaser=(baseDmg*(tower._dmgMult||1))/laserCount;
                            const perpAng=baseAng+Math.PI/2; // perpendicular to aim
                            const offsetPx=6; // pixels between parallel beams
                            for(let i=0;i<laserCount;i++){
                                const off=laserCount===1?0:(i-1)*offsetPx;
                                const ox=Math.cos(perpAng)*off, oy=Math.sin(perpAng)*off;
                                this._fireLaserMG(tower,baseAng,dmgPerLaser,bounces,tower._mgChainDeath||false,tower.px+ox,tower.py+oy);
                            }
                            this._flashEngineerTower(tower,0x44ffaa);
                        }
                    }
                    tower._skipESFire=true;
                } // end laser block
            }
        }

        // MG fixed aim indicator
        for(const tower of this.towers){
            if(tower.type!=='cannon'||!tower.active||tower._cannonFixedAng===undefined)continue;
            if(!tower._mgAimGfx||!tower._mgAimGfx.active) tower._mgAimGfx=this.add.graphics().setDepth(1.8);
            const ag=tower._mgAimGfx; ag.clear();
            const r=(this._towerDefs?.()[tower.type]?.range||6)+(tower._rangeBonus||0)+(this._globalRangeBonus||0);
            ag.lineStyle(1,0xffcc44,0.4);
            ag.beginPath();
            ag.moveTo(tower.px,tower.py);
            ag.lineTo(tower.px+Math.cos(tower._cannonFixedAng)*r*this.TILE_SIZE,tower.py+Math.sin(tower._cannonFixedAng)*r*this.TILE_SIZE);
            ag.strokePath();
        }
        for(const tower of this.towers){
            if(tower.type!=='tesla_coil'||!tower.active)continue;
            const range=(tdDefs.tesla_coil.range+(tower._rangeBonus||0))*TS;
            // Slow aura — refresh each frame for enemies inside radius
            if(tower._tcSlowAura){
                for(const e of this.enemies){
                    if(!e.sprite?.active)continue;
                    if(Math.hypot(e.sprite.x-tower.px,e.sprite.y-tower.py)<=range){
                        e.isSlowed=true; e.slowedUntil=time+200; e._slowType='slow_ice';
                    }
                }
            }
        }

        // Magnetizer — active gravity well turret (up to 3 simultaneous non-overlapping wells)
        for(const tower of this.towers){
            if(tower.type!=='magnetizer'||!tower.active)continue;
            const range=(tdDefs.magnetizer.range+(tower._rangeBonus||0))*TS;
            const interval=8000*(tower._fireRateMult||1);
            if(time-tower.lastFireTime<interval)continue;

            // Track active well positions for overlap check
            if(!tower._activeWells) tower._activeWells=[];
            // Remove wells that have expired by time
            tower._activeWells=tower._activeWells.filter(w=>time<w.expiresAt);
            const maxWells=3;
            const wellR=(tower._magPullRadius||5)*TS;

            // Find up to 3 valid targets — each well must not overlap existing wells
            const candidates=this.enemies.filter(e=>this._towerCanTarget(e)&&Math.hypot(e.sprite.x-tower.px,e.sprite.y-tower.py)<=range);
            const chosen=[];
            for(const e of candidates){
                if(chosen.length+tower._activeWells.length>=maxWells)break;
                const tx2=e.sprite.x, ty2=e.sprite.y;
                // Check no overlap with existing wells or chosen targets
                const overlaps=[...tower._activeWells.map(w=>({x:w.x,y:w.y})),...chosen]
                    .some(p=>Math.hypot(tx2-p.x,ty2-p.y)<wellR*1.5);
                if(!overlaps) chosen.push({x:tx2,y:ty2,e});
            }
            if(!chosen.length)continue;
            tower.lastFireTime=time;

            for(const {x:tx,y:ty} of chosen){
                const proj=this.add.graphics().setDepth(5);
                proj.fillStyle(0x44ffaa,0.9); proj.fillCircle(0,0,6);
                proj.fillStyle(0xffffff,0.5); proj.fillCircle(0,0,3);
                proj.lineStyle(2,0x00ffcc,0.7); proj.strokeCircle(0,0,8);
                proj.x=tower.px; proj.y=tower.py;
                this._flashEngineerTower(tower,0x44ffaa);
                this.tweens.add({targets:proj,x:tx,y:ty,duration:300,ease:'Quad.easeIn',
                    onComplete:()=>{
                        proj.destroy();
                        const well=this._spawnGravityWell(tower,tx,ty);
                        if(well) tower._activeWells.push(well);
                    }
                });
            }
        }
        for(const tower of this.towers){
            if(!tower._tdUnique||!tower.active)continue;
            const def=tdDefs[tower.type]; if(!def)continue;
            const range=(def.range + this._globalRangeBonus + (tower._rangeBonus||0)) * TS;
            const interval=(def.fireInterval||999999) * this._towerCDMult;

            // HP bar
            const damaged=tower.hp<tower.maxHp;
            tower.hpBarBg.setVisible(damaged); tower.hpBarFill.setVisible(damaged);
            if(damaged)tower.hpBarFill.width=TS*Math.max(0,tower.hp/tower.maxHp);

            if(time-tower.lastFireTime<interval){
                // Still update Skyward aura even during cooldown
                if(tower.type==='skyward'){
                    const cooldown=def.fireInterval*(tower._fireRateMult||1);
                    const pct=Math.min(1,(time-tower.lastFireTime)/cooldown);
                    if(!tower._skyAuraGfx||!tower._skyAuraGfx.active)
                        tower._skyAuraGfx=this.add.graphics().setDepth(2.2);
                    const ag=tower._skyAuraGfx; ag.clear();
                    const t2=time*0.001, p=pct;
                    const speed=0.5+p*4.5, orbitR=10+p*14, alpha=0.35+p*0.55, lw=1+p*2.5;
                    for(let a=0;a<3;a++){
                        const baseAng=t2*speed+a*(Math.PI*2/3);
                        const arcLen=0.25+p*0.8;
                        ag.lineStyle(lw,0xff4422,alpha);
                        ag.beginPath(); ag.arc(tower.px,tower.py,orbitR,baseAng,baseAng+arcLen,false); ag.strokePath();
                        // Tip particle
                        ag.fillStyle(0xffcc44,alpha); ag.fillCircle(tower.px+Math.cos(baseAng+arcLen)*orbitR,tower.py+Math.sin(baseAng+arcLen)*orbitR,1+p*3);
                    }
                    // Orbiting embers
                    const ec=Math.floor(p*5);
                    for(let e2=0;e2<ec;e2++){
                        const ang=t2*speed*1.4+e2*(Math.PI*2/Math.max(1,ec));
                        ag.fillStyle(e2%2===0?0xff5522:0xffaa33,(0.4+0.6*Math.abs(Math.sin(t2*4+e2)))*alpha);
                        ag.fillCircle(tower.px+Math.cos(ang)*orbitR*0.65,tower.py+Math.sin(ang)*orbitR*0.65,0.8+p*2.2);
                    }
                }
                continue;
            }

            if(def.isHealer){
                let h=false;
                const healMult=tower._healBonus||1;
                const baseAmt=def.healAmt*healMult*2.2; // buffed: healers must matter vs the new tower damage
                // Gather damaged towers in range.
                const inRange=this.towers.filter(t2=>t2!==tower&&t2.hp<t2.maxHp&&!t2._healBlocked&&
                    Math.hypot(t2.px-tower.px,t2.py-tower.py)<=range);
                if(inRange.length){
                    // Triage: sort so the lowest-HP-fraction tower is healed first.
                    if(tower._healTriage) inRange.sort((a,b)=>(a.hp/a.maxHp)-(b.hp/b.maxHp));
                    // Field Medic heals every tower in range; otherwise just the first (triaged) one.
                    const targets=tower._healAll?inRange:[inRange[0]];
                    for(const t2 of targets){
                        let amt=baseAmt;
                        t2.hp=Math.min(t2.maxHp,t2.hp+amt); h=true;
                        this._showFloatingText(t2.px,t2.py-20,`+${Math.round(amt)}`,'#44ff88');
                    }
                }
                // Base repair: flat rate (fountain) and/or a share of heal output.
                if(tower._healBase||tower._baseRepairRate){
                    const bAmt=(tower._baseRepairRate||0)+baseAmt*0.4;
                    this.baseHP=Math.min(this.baseMaxHP,this.baseHP+bAmt);
                }
                if(h){tower.lastFireTime=time;this._flashEngineerTower(tower,def.color);}
                continue;
            }
            if(def.isPlayerHealer){
                if(Math.hypot(this.player.x-tower.px,this.player.y-tower.py)<=range&&this.playerHP<this.playerMaxHP){
                    const amt=def.healAmt*(1+(tower._healBonus||0));
                    this.playerHP=Math.min(this.playerMaxHP,this.playerHP+amt);
                    this._showFloatingText(this.player.x,this.player.y-28,`+${Math.round(amt)}HP`,'#88ffdd');
                    tower.lastFireTime=time;
                }
                continue;
            }
            // Cannon AoE lob
            if(tower.type==='skyward'){
                const threshold=tower._skyThreshold||20;
                const activeEnemies=this.enemies.filter(e=>e.sprite?.active);
                const cooldown=def.fireInterval*(tower._fireRateMult||1);
                const pct=Math.min(1,(time-tower.lastFireTime)/cooldown);
                const enemyReady=activeEnemies.length>=threshold;
                const ready=enemyReady&&pct>=1;

                // Aura — always a rotating ring. pct 0→1: small/slow/dim → big/fast/fierce
                if(!tower._skyAuraGfx||!tower._skyAuraGfx.active)
                    tower._skyAuraGfx=this.add.graphics().setDepth(2.2);
                const ag=tower._skyAuraGfx;
                ag.clear();
                {
                    const t=time*0.001;
                    const p=ready?1:pct;
                    const speed=0.5+p*4.5, orbitR=10+p*14, alpha=0.35+p*0.55, lw=1+p*2.5;

                    // 3 rotating arcs with tip particles
                    for(let a=0;a<3;a++){
                        const baseAng=t*speed+a*(Math.PI*2/3);
                        const arcLen=ready?(0.9+0.4*Math.sin(t*5+a)):(0.25+p*0.8);
                        ag.lineStyle(lw,0xff4422,alpha);
                        ag.beginPath(); ag.arc(tower.px,tower.py,orbitR,baseAng,baseAng+arcLen,false); ag.strokePath();
                        ag.fillStyle(0xffcc44,alpha);
                        ag.fillCircle(tower.px+Math.cos(baseAng+arcLen)*orbitR,tower.py+Math.sin(baseAng+arcLen)*orbitR,ready?(2+2*Math.random()):(1+p*3));
                    }

                    // Orbiting embers
                    const ec=ready?5:Math.floor(p*5);
                    for(let e2=0;e2<ec;e2++){
                        const ang=t*speed*1.4+e2*(Math.PI*2/Math.max(1,ec));
                        ag.fillStyle(e2%2===0?0xff5522:0xffaa33,(0.4+0.6*Math.abs(Math.sin(t*4+e2)))*alpha);
                        ag.fillCircle(tower.px+Math.cos(ang)*orbitR*0.65,tower.py+Math.sin(ang)*orbitR*0.65,ready?(1.5+1.5*Math.random()):(0.8+p*2.2));
                    }

                    // Outer burst ring + extra embers only at full charge
                    if(ready){
                        const bp=0.35+0.35*Math.abs(Math.sin(t*6));
                        ag.lineStyle(1.5,0xff6644,bp);
                        ag.strokeCircle(tower.px,tower.py,orbitR*1.7);
                        for(let e3=0;e3<6;e3++){
                            const ang=t*speed*0.9+e3*(Math.PI/3);
                            ag.fillStyle(e3%2===0?0xff2200:0xffcc00,0.4+0.5*Math.abs(Math.sin(t*7+e3)));
                            ag.fillCircle(tower.px+Math.cos(ang)*orbitR*1.45,tower.py+Math.sin(ang)*orbitR*1.45,1+1.5*Math.random());
                        }
                    }
                }

                if(ready&&!tower._skyFiring){
                    tower._skyFiring=true;
                    tower.lastFireTime=time;
                    tower._skyAuraGfx?.clear(); // reset aura immediately
                    this._skywardStrike(tower,activeEnemies);
                    this.time.delayedCall(500,()=>{ tower._skyFiring=false; });
                }
                continue;
            }
            if(tower.type==='cannon'){
                if(tower._cannonFixedAng!==undefined){
                    // Fixed aim — always fire at locked point, completely ignores enemies
                    if(time-tower.lastFireTime<(def.fireInterval||2000)*this._towerCDMult)continue;
                    tower.lastFireTime=time;
                    const ang=tower._cannonFixedAng;
                    const fireDist=tower._cannonFixedDist??range;
                    const tx=tower.px+Math.cos(ang)*fireDist;
                    const ty=tower.py+Math.sin(ang)*fireDist;
                    const baseDmg=def.damage*this.turretDmgMult*(this._waveBoost||1)*(tower._dmgMult||1);
                    const aoeR=((def.aoeRadius||2.5)+(tower._aoeBonus||0))*TS;
                    const coreR=((tower._canCoreBonus||0)+0.8)*TS;
                    const travelDist=Math.hypot(tx-tower.px,ty-tower.py);
                    this._flashEngineerTower(tower,def.color);
                    const shotCount=tower._canShotCount||1;
                    for(let si=0;si<shotCount;si++){
                        const isBowler=tower._canCarpetBomb&&si===shotCount-1;
                        this.time.delayedCall(si*220,()=>{
                            if(tower._canCatapult){
                                this._cannonImpact(tower,tx,ty,baseDmg,aoeR,coreR,travelDist,false);
                                return;
                            }
                            if(tower._canCarpetBomb){
                                const dirX=(tx-tower.px)/travelDist, dirY=(ty-tower.py)/travelDist;
                                const maxBounces=isBowler?2:3;
                                const shellSize=isBowler?10:4+si*0.5;
                                this._cannonBounceArc(tower.px,tower.py,tx,ty,dirX,dirY,travelDist,maxBounces,baseDmg,aoeR,coreR,shellSize,isBowler);
                                return;
                            }
                            const shellR=4+si*0.5;
                            const shell=this.add.graphics().setDepth(5);
                            shell.fillStyle(def.color,1); shell.fillCircle(0,0,shellR);
                            shell.fillStyle(0xffdd44,0.6); shell.fillCircle(0,0,shellR*0.5);
                            shell.x=tower.px; shell.y=tower.py;
                            this.tweens.add({targets:shell,x:tx,y:ty,duration:400+si*40,ease:'Quad.easeIn',
                                onComplete:()=>{ shell.destroy(); this._cannonImpact(tower,tx,ty,baseDmg,aoeR,coreR,travelDist,false); }
                            });
                        });
                    }
                    continue;
                }
                const inRange=this.enemies.filter(e=>this._towerCanTarget(e)&&Math.hypot(e.sprite.x-tower.px,e.sprite.y-tower.py)<=range);
                if(!inRange.length)continue;
                const tgt=tower._canPrecision ? inRange.reduce((a,b)=>a.health>b.health?a:b) : inRange[0];
                let tx=tgt.sprite.x, ty=tgt.sprite.y;
                if(!tgt)continue;
                tower.lastFireTime=time;

                const baseDmg=def.damage * this.turretDmgMult * (this._waveBoost||1) * (tower._dmgMult||1);
                const aoeR=((def.aoeRadius||2.5)+(tower._aoeBonus||0))*TS;
                const coreR=((tower._canCoreBonus||0)+0.8)*TS; // inner core radius
                const shotCount=tower._canShotCount||1; // multi-shot
                this._flashEngineerTower(tower,def.color);

                // Fire multiple shells if barrage upgraded
                for(let si=0;si<shotCount;si++){
                    const capTgt=inRange[si%inRange.length]||tgt;
                    const capTx=si===0?tx:(capTgt?.sprite?.x||tx);
                    const capTy=si===0?ty:(capTgt?.sprite?.y||ty);
                    const isBowler=tower._canCarpetBomb&&si===shotCount-1;
                    this.time.delayedCall(si*220,()=>{
                        const tx=capTx, ty=capTy;
                        const travelDist=Math.hypot(tx-tower.px,ty-tower.py);

                        if(tower._canCatapult){
                            this._cannonImpact(tower,tx,ty,baseDmg,aoeR,coreR,travelDist,false);
                            return;
                        }

                        if(tower._canCarpetBomb){
                            // Bouncing ball — arc from tower to target then keep bouncing same distance
                            const dirX=(tx-tower.px)/travelDist, dirY=(ty-tower.py)/travelDist;
                            const hopDist=travelDist;
                            const maxBounces=isBowler?2:3;
                            const shellSize=isBowler?10:4+si*0.5;
                            this._cannonBounceArc(tower.px,tower.py,tx,ty,dirX,dirY,hopDist,maxBounces,baseDmg,aoeR,coreR,shellSize,isBowler);
                            return;
                        }

                        // Normal flat shell
                        const shellR=4+si*0.5;
                        const shell=this.add.graphics().setDepth(5);
                        shell.fillStyle(def.color,1); shell.fillCircle(0,0,shellR);
                        shell.fillStyle(0xffdd44,0.6); shell.fillCircle(0,0,shellR*0.5);
                        shell.x=tower.px; shell.y=tower.py;
                        this.tweens.add({targets:shell,x:tx,y:ty,duration:400+si*40,ease:'Quad.easeIn',
                            onComplete:()=>{
                                shell.destroy();
                                this._cannonImpact(tower,tx,ty,baseDmg,aoeR,coreR,travelDist,false);
                            }
                        });
                    });
                }
            }
        }
    }

    _fireShotgunVolley(tower,tgt,baseDmg){
        const TS=this.TILE_SIZE;
        const bulletCount=tower._mgBullets||7;
        const spreadAng=Math.PI/7.2+(bulletCount-7)*0.02; // ~25° base, widens slightly with more bullets
        const centerAng=Math.atan2(tgt.sprite.y-tower.py,tgt.sprite.x-tower.px);
        const half=Math.floor(bulletCount/2);
        const speed=650;
        const pierce=tower._mgHollowPoint;

        for(let i=0;i<bulletCount;i++){
            const slot=i-half; // -half .. 0 .. +half
            const t=bulletCount>1?Math.abs(slot)/half:0; // 0=center, 1=edge
            const ang=centerAng+(slot/(half||1))*spreadAng*0.5;

            // Inverse damage: center=30%, mid=55%, edge=80%+%HP
            let dmg, isEdge=false, isMid=false;
            if(Math.abs(slot)===half){ dmg=baseDmg*0.267; isEdge=true; }
            else if(Math.abs(slot)>=half-1&&half>1){ dmg=baseDmg*0.183; isMid=true; }
            else{ dmg=baseDmg*0.10; }

            // Bullet visual — center=yellow, mid=white-blue, edge=ice blue+glow
            const bul=this.add.graphics().setDepth(5);
            if(isEdge){
                bul.fillStyle(0x88ddff,1); bul.fillCircle(0,0,4);
                bul.fillStyle(0xffffff,0.8); bul.fillCircle(0,0,2);
                bul.lineStyle(1.5,0xaaeeff,0.7); bul.strokeCircle(0,0,5);
            } else if(isMid){
                bul.fillStyle(0xbbddff,0.9); bul.fillCircle(0,0,3);
                bul.fillStyle(0xffffff,0.6); bul.fillCircle(0,0,1.5);
            } else {
                bul.fillStyle(0xff8844,0.9); bul.fillCircle(0,0,2.5);
            }
            bul.x=tower.px; bul.y=tower.py;

            const vx=Math.cos(ang)*speed, vy=Math.sin(ang)*speed;
            let dist=0;
            const hitSet=new Set();

            const timer=this.time.addEvent({delay:16,loop:true,callback:()=>{
                if(!bul.active){timer.remove();return;}
                bul.x+=vx*(16/1000); bul.y+=vy*(16/1000);
                dist+=speed*(16/1000);
                const btx=Math.floor(bul.x/TS),bty=Math.floor(bul.y/TS);
                if(dist>TS*1.5&&this.world[btx]?.[bty]!==this.FLOOR){bul.destroy();timer.remove();return;}
                if(dist<TS*1.5)return; // skip all checks until clear of tower
                for(const e of [...this.enemies]){
                    if(!e.sprite?.active||hitSet.has(e))continue;
                    if(Math.hypot(e.sprite.x-bul.x,e.sprite.y-bul.y)>TS*0.7)continue;
                    let totalDmg=dmg;
                    if(isEdge){
                        totalDmg+=e.health*(tower._mgHollowPoint?0.005:0.005); // 0.5% — small assist only
                        totalDmg+=baseDmg*0.133; // extra flat on top (120% total vs 80% base)
                        // Ice slow
                        const slowAmt=tower._mgHollowPoint?0.35:0.20;
                        e.isSlowed=true; e.slowedUntil=this.time.now+1500; e._slowType='slow_ice';
                        e._slowMult=slowAmt;
                        // Ice visual
                        if(e.sprite?.active) e.sprite.setTint(0x88ccff);
                        this.time.delayedCall(1500,()=>{if(e.sprite?.active)e.sprite.clearTint();});
                        // Ice hit spark
                        const spark=this.add.graphics().setDepth(5);
                        spark.x=e.sprite.x; spark.y=e.sprite.y;
                        spark.fillStyle(0xaaddff,0.9); spark.fillCircle(0,0,6);
                        spark.lineStyle(1.5,0xffffff,0.8); spark.strokeCircle(0,0,8);
                        this.tweens.add({targets:spark,scaleX:2.5,scaleY:2.5,alpha:0,duration:250,onComplete:()=>spark.destroy()});
                    }
                    e.health-=totalDmg; this.updateEnemyHealthBar(e);
                    if(e.health<=0)this.killEnemy(e);
                    hitSet.add(e);
                    bul.destroy(); timer.remove(); return; // bullet absorbed by enemy
                }
            }});
        }
    }

    _fireLaserMG(tower,ang,dmg,bouncesLeft,chainDeath,fromX,fromY){
        const TS=this.TILE_SIZE;
        fromX=fromX??tower.px; fromY=fromY??tower.py;
        const dx=Math.cos(ang), dy=Math.sin(ang);
        const laserLen=38*TS;

        // Find wall hit point
        let hitWall=false;
        let endX=fromX+dx*laserLen, endY=fromY+dy*laserLen;
        for(let t=TS*2;t<laserLen;t+=3){
            const lx=fromX+dx*t, ly=fromY+dy*t;
            if(this.world[Math.floor(lx/TS)]?.[Math.floor(ly/TS)]!==this.FLOOR){
                endX=lx-dx*3; endY=ly-dy*3; hitWall=true; break;
            }
        }

        // Draw beam instantly — 3 layer wide glow
        const beam=this.add.graphics().setDepth(4.5);
        beam.lineStyle(6,0x44ffaa,0.2);  beam.beginPath(); beam.moveTo(fromX,fromY); beam.lineTo(endX,endY); beam.strokePath();
        beam.lineStyle(3,0x44ffaa,0.65); beam.beginPath(); beam.moveTo(fromX,fromY); beam.lineTo(endX,endY); beam.strokePath();
        beam.lineStyle(1,0xaaffdd,0.95); beam.beginPath(); beam.moveTo(fromX,fromY); beam.lineTo(endX,endY); beam.strokePath();
        this.tweens.add({targets:beam,alpha:0,duration:120,onComplete:()=>beam.destroy()});

        // Wall flash
        if(hitWall){
            const wf=this.add.graphics().setDepth(4.5);
            wf.x=endX; wf.y=endY;
            wf.fillStyle(0x44ffaa,0.9); wf.fillCircle(0,0,7);
            this.tweens.add({targets:wf,scaleX:3,scaleY:3,alpha:0,duration:180,onComplete:()=>wf.destroy()});
        }

        // Damage enemies along beam
        const bx=endX-fromX, by=endY-fromY;
        const blen2=bx*bx+by*by||1;
        for(const e of [...this.enemies]){
            if(!e.sprite?.active)continue;
            const ex=e.sprite.x-fromX, ey=e.sprite.y-fromY;
            const t2=Math.max(0,Math.min(1,(ex*bx+ey*by)/blen2));
            if(Math.hypot(ex-bx*t2,ey-by*t2)>TS*0.9)continue;
            e.health-=dmg+e.health*0.002;
            this.updateEnemyHealthBar(e);
            if(chainDeath) e._mgMarked=true;
            if(e.health<=0){
                const ex2=e.sprite.x, ey2=e.sprite.y;
                const wasMarked=e._mgMarked;
                this.killEnemy(e);
                if(wasMarked&&chainDeath) this._mgChainExplosion(ex2,ey2,dmg);
            }
        }

        // Ricochet
        if(hitWall&&bouncesLeft>0){
            const wx=Math.floor(endX/TS), wy=Math.floor(endY/TS);
            const hitH=this.world[Math.floor((endX+dx*4)/TS)]?.[wy]!==this.FLOOR;
            const hitV=this.world[wx]?.[Math.floor((endY+dy*4)/TS)]!==this.FLOOR;
            let newAng;
            if(hitH&&hitV) newAng=ang+Math.PI;
            else if(hitH)  newAng=Math.atan2(dy,-dx);
            else           newAng=Math.atan2(-dy,dx);
            this._fireLaserMG(tower,newAng,dmg,bouncesLeft-1,chainDeath,endX,endY);
        }
    }

    _mgChainExplosion(ex,ey,baseDmg){
        const r=this.TILE_SIZE*2;
        const exp=this.add.graphics().setDepth(5);
        exp.x=ex; exp.y=ey;
        exp.fillStyle(0x44ffaa,0.6); exp.fillCircle(0,0,r);
        exp.fillStyle(0xffffff,0.3); exp.fillCircle(0,0,r*0.4);
        this.tweens.add({targets:exp,scaleX:1.6,scaleY:1.6,alpha:0,duration:300,onComplete:()=>exp.destroy()});
        for(const e2 of [...this.enemies]){
            if(!e2.sprite?.active)continue;
            if(Math.hypot(e2.sprite.x-ex,e2.sprite.y-ey)>r)continue;
            e2.health-=baseDmg+e2.health*0.03;
            this.updateEnemyHealthBar(e2);
            if(e2.health<=0)this.killEnemy(e2);
        }
    }

    _spawnGravityWell(tower,cx,cy){
        const TS=this.TILE_SIZE;
        const pullRadius=(tower._magPullRadius||5)*TS;
        const wellDur=tower._magWellDur||3000;
        const pullInterval=tower._magPullInterval||600;
        const pullDist=tower._magPullDist||1;
        const wellRef={x:cx,y:cy,expiresAt:this.time.now+wellDur};

        // Well visual — swirling vortex
        const well=this.add.graphics().setDepth(3);
        well.x=cx; well.y=cy;
        let rot=0;
        const wellTimer=this.time.addEvent({delay:16,loop:true,callback:()=>{
            if(!well.active){wellTimer.remove();return;}
            rot+=0.08;
            well.clear();
            // Outer rings
            for(let r=0;r<3;r++){
                const rr=pullRadius*(0.3+r*0.35);
                const a=rot*(r%2===0?1:-1);
                well.lineStyle(2-r*0.5,0x44ffaa,0.5-r*0.12);
                well.beginPath();
                well.arc(0,0,rr,a,a+Math.PI*1.5,false);
                well.strokePath();
                // Tip spark
                well.fillStyle(0xaaffcc,0.7-r*0.2);
                well.fillCircle(Math.cos(a)*rr,Math.sin(a)*rr,2);
            }
            // Inner glow
            well.fillStyle(0x44ffaa,0.12);
            well.fillCircle(0,0,pullRadius*0.25);
        }});

        // Pull enemies toward well center periodically
        let elapsed=0;
        const pullTimer=this.time.addEvent({delay:pullInterval,loop:true,callback:()=>{
            elapsed+=pullInterval;
            if(elapsed>=wellDur){pullTimer.remove();return;}
            for(const e of this.enemies){
                if(!e.sprite?.active)continue;
                const dx=cx-e.sprite.x, dy=cy-e.sprite.y;
                const d=Math.hypot(dx,dy);
                if(d>pullRadius||d<TS*0.5)continue;
                const pullPx=Math.min(d-TS*0.5,pullDist*TS);
                const nx=e.sprite.x+(dx/d)*pullPx, ny=e.sprite.y+(dy/d)*pullPx;
                const ntx=Math.floor(nx/TS), nty=Math.floor(ny/TS);
                if(!e._isDummy&&this.world[ntx]?.[nty]===this.FLOOR){
                    e.x=ntx; e.y=nty;
                    e.sprite.x=ntx*TS+TS/2; e.sprite.y=nty*TS+TS/2;
                    e._committedPath=undefined; e._pathIndex=undefined;
                }
            }
        }});

        // Implosion at end of duration
        this.time.delayedCall(wellDur,()=>{
            wellTimer.remove();
            well.destroy();

            // Implosion rings
            for(let r=0;r<4;r++){
                this.time.delayedCall(r*60,()=>{
                    const ig=this.add.graphics().setDepth(4);
                    ig.x=cx; ig.y=cy;
                    ig.lineStyle(3-r*0.5,0xffdd44,0.9-r*0.2);
                    ig.strokeCircle(0,0,pullRadius*(1-r*0.2));
                    this.tweens.add({targets:ig,scaleX:0.05,scaleY:0.05,alpha:0,duration:350,ease:'Quad.easeIn',onComplete:()=>ig.destroy()});
                });
            }
            this.cameras.main.shake(100,0.004);
            this._showFloatingText(cx,cy-24,'VULNERABLE!','#ffdd44');

            const vulnDur=(tower._magVulnDur||3000)+(tower._magLingerVuln?4000:0);
            const vulnMult=tower._magVulnMult||2;
            for(const e of this.enemies){
                if(!e.sprite?.active)continue;
                if(Math.hypot(e.sprite.x-cx,e.sprite.y-cy)>pullRadius)continue;
                e._vulnerable=true;
                e._vulnerableUntil=this.time.now+vulnDur;
                e._vulnMult=vulnMult;
                e.sprite.setTint(0xffdd44);
                if(tower._magSlowOnRelease){
                    e.isSlowed=true; e.slowedUntil=this.time.now+2000; e._slowMult=0.40; e._slowType='slow_ice';
                }
                this.time.delayedCall(vulnDur,()=>{ if(e.sprite?.active){e._vulnerable=false; e.sprite.clearTint();} });
            }
        });
        return wellRef;
    }

    _phantomThump(cx,cy,thumpR,dmgMult){
        const TS=this.TILE_SIZE;
        // Ring of cloudiness — a dense band of wispy tendrils that expands outward
        // Redrawn each frame on a single graphics object so it moves as a coherent ring
        const ringGfx=this.add.graphics().setDepth(4.2);
        const startTime=this.time.now;
        const dur=1800;
        const ticker=this.time.addEvent({delay:16,loop:true,callback:()=>{
            if(!ringGfx.active){ticker.remove();return;}
            const elapsed=this.time.now-startTime;
            if(elapsed>=dur){ticker.remove();ringGfx.destroy();return;}
            const t=elapsed/dur;
            const fade=t<0.12?t/0.12:1-((t-0.12)/0.88);
            const ringR=thumpR*(0.1+t*0.9);
            const bandW=thumpR*0.38; // thicker band
            ringGfx.clear();
            const numClouds=36; // more puffs = denser ring
            for(let i=0;i<numClouds;i++){
                const ang=i/numClouds*Math.PI*2;
                const radOffset=Math.sin(i*2.3+1.1)*bandW*0.4+Math.sin(i*3.7)*bandW*0.25;
                const r=ringR+radOffset;
                const bx=cx+Math.cos(ang)*r, by=cy+Math.sin(ang)*r;
                const puffR=bandW*(0.42+Math.sin(i*1.9+0.5)*0.15);
                // Thick outer glow layer
                ringGfx.fillStyle(0xddccff,fade*0.18); ringGfx.fillCircle(bx,by,puffR*1.8);
                // Dense mid layer
                ringGfx.fillStyle(0xccaaff,fade*0.32); ringGfx.fillCircle(bx,by,puffR*1.1);
                // Bright core
                ringGfx.fillStyle(0xeeddff,fade*0.22); ringGfx.fillCircle(bx,by,puffR*0.65);
                // Highlight spot
                ringGfx.fillStyle(0xffeeff,fade*0.18); ringGfx.fillCircle(bx-puffR*0.25,by-puffR*0.28,puffR*0.35);
                // Secondary offset puff
                const ang2=ang+Math.PI*2/numClouds*0.5;
                const r2=ringR+radOffset*0.5+bandW*0.12;
                const bx2=cx+Math.cos(ang2)*r2, by2=cy+Math.sin(ang2)*r2;
                ringGfx.fillStyle(0xccaaff,fade*0.20); ringGfx.fillCircle(bx2,by2,puffR*0.85);
                ringGfx.fillStyle(0xeeddff,fade*0.12); ringGfx.fillCircle(bx2,by2,puffR*0.45);
            }
            // Visible inner ring fill to make it feel substantial
            ringGfx.fillStyle(0xaa88cc,fade*0.08); ringGfx.fillCircle(cx,cy,ringR*0.75);
            ringGfx.fillStyle(0xccaaff,fade*0.05); ringGfx.fillCircle(cx,cy,ringR*0.45);
        }});

        // Decaying slow — 70% at start, fades to 0 over dur
        const slowR=thumpR*0.9, slowStart=this.time.now;
        const slowTick=this.time.addEvent({delay:100,loop:true,callback:()=>{
            const elapsed=this.time.now-slowStart;
            if(elapsed>dur){slowTick.remove();return;}
            const slowMult=0.7*(1-elapsed/dur);
            if(slowMult<0.05)return;
            for(const e of this.enemies){
                if(!e.sprite?.active||e._isTotem)continue;
                if(Math.hypot(e.sprite.x-cx,e.sprite.y-cy)>slowR)continue;
                if(!e.isSlowed||e._slowMult<slowMult){
                    e.isSlowed=true; e.slowedUntil=this.time.now+150; e._slowMult=slowMult; e._slowType='slow_goop';
                }
            }
        }});
        // Small impact damage
        this._lastDamageFromWisp=true;
        for(const e of [...this.enemies]){
            if(!e.sprite?.active||e._isTotem)continue;
            if(Math.hypot(e.sprite.x-cx,e.sprite.y-cy)>thumpR)continue;
            e.health-=e.health*0.006*(dmgMult||1);
            this.updateEnemyHealthBar(e);
            if(e.health<=0)this.killEnemy(e);
        }
        this._lastDamageFromWisp=false;
    }



    _createPinkShieldGfx(){
        this._pinkShieldGfx?.destroy();
        const g=this.add.graphics().setDepth(3.5);
        this._pinkShieldGfx=g;
        this._updatePinkShieldGfx();
    }

    _updatePinkShieldGfx(){
        const g=this._pinkShieldGfx; if(!g?.active)return;
        const pct=Math.min(1,this._pinkShield/(this.baseMaxHP*5.0));
        const pulse=0.5+0.3*Math.sin(this.time.now*0.006);
        g.clear();
        // Ring thickness/brightness scales with amount
        const lw=1+pct*3;
        g.lineStyle(lw+2,0xff88bb,0.3+0.3*pct*pulse); g.strokeCircle(this.basePx,this.basePy,this.TILE_SIZE*3.2);
        g.fillStyle(0xff88bb,0.05*pct*pulse); g.fillCircle(this.basePx,this.basePy,this.TILE_SIZE*3.2);
        if(pct>0.3){ g.lineStyle(1,0xffeeff,0.2*pct*pulse); g.strokeCircle(this.basePx,this.basePy,this.TILE_SIZE*3.6); }
    }

    _spawnIceGravityField(cx,cy,dmgMult){
        const TS=this.TILE_SIZE;
        const radius=TS*2.2;
        const dur=2500;
        const gfx=this.add.graphics().setDepth(1.5);
        let rot=0;
        const ticker=this.time.addEvent({delay:32,loop:true,callback:()=>{
            if(!gfx.active){ticker.remove();return;}
            rot+=0.08;
            gfx.clear();
            gfx.fillStyle(0x88ddff,0.08); gfx.fillCircle(cx,cy,radius);
            for(let r=0;r<2;r++){
                const rr=radius*(0.5+r*0.3);
                const a=rot*(r%2===0?1:-1);
                gfx.lineStyle(1.5,0xaaeeff,0.5-r*0.15);
                gfx.beginPath(); gfx.arc(cx,cy,rr,a,a+Math.PI*1.2,false); gfx.strokePath();
                gfx.fillStyle(0xffffff,0.4-r*0.1); gfx.fillCircle(cx+Math.cos(a)*rr,cy+Math.sin(a)*rr,2);
            }
            gfx.lineStyle(1,0x88ddff,0.25); gfx.strokeCircle(cx,cy,radius);
            for(const e of this.enemies){
                if(!e.sprite?.active||e._isTotem||e._isDummy)continue;
                const dx=cx-e.sprite.x, dy=cy-e.sprite.y;
                const d=Math.hypot(dx,dy);
                if(d>radius||d<4)continue;
                const pull=(1-d/radius)*2.0;
                e.sprite.x+=dx/d*pull; e.sprite.y+=dy/d*pull;
                if(!e._iceSnapTime||this.time.now-e._iceSnapTime>300){
                    e._iceSnapTime=this.time.now;
                    const ntx=Math.floor(e.sprite.x/TS),nty=Math.floor(e.sprite.y/TS);
                    if(this.world[ntx]?.[nty]===this.FLOOR){
                        e.x=ntx; e.y=nty;
                        e._committedPath=null; e._pathIndex=undefined;
                    }
                }
            }
        }});
        this.time.delayedCall(dur,()=>{
            ticker.remove();
            const imp=this.add.graphics().setDepth(2);
            imp.x=cx; imp.y=cy;
            imp.lineStyle(2,0xaaeeff,0.8); imp.strokeCircle(0,0,radius);
            this.tweens.add({targets:imp,scaleX:0.1,scaleY:0.1,alpha:0,duration:300,ease:'Quad.easeIn',onComplete:()=>{imp.destroy();gfx.destroy();}});
        });
    }


    _spawnDPSTotem(){
        const TS=this.TILE_SIZE;
        const tx=this._myX, ty=this._myY+2;
        const px=tx*TS+TS/2, py=ty*TS+TS/2;
        if(!this._dpsTotemList) this._dpsTotemList=[];

        // Visual
        const g=this.add.graphics().setDepth(3);
        g.fillStyle(0x886644,1); g.fillRect(px-3,py-TS,6,TS+TS/2);
        g.fillStyle(0xccaa66,1); g.fillCircle(px,py-TS,TS*0.55);
        g.lineStyle(3,0xcc3333,1); g.strokeCircle(px,py-TS,TS*0.4);
        g.lineStyle(2,0xcc3333,1); g.strokeCircle(px,py-TS,TS*0.2);
        g.fillStyle(0xcc3333,1); g.fillCircle(px,py-TS,TS*0.08);
        g.fillStyle(0x333333,1); g.fillCircle(px-5,py-TS-4,2); g.fillCircle(px+5,py-TS-4,2);
        g.lineStyle(1,0x553322,0.5);
        g.lineBetween(px-8,py-TS-12,px+8,py-TS-12);
        g.lineBetween(px,py-TS-4,px,py-TS-20);

        const label=this.add.text(px,py-TS*2,'DPS: 0',{
            fontSize:'9px',fontFamily:'monospace',color:'#ffdd44',
            stroke:'#000',strokeThickness:2,backgroundColor:'#00000088',padding:{x:4,y:2}
        }).setOrigin(0.5).setDepth(6);
        const totalLabel=this.add.text(px,py-TS*2.6,'Total: 0',{
            fontSize:'8px',fontFamily:'monospace',color:'#aaffaa',
            stroke:'#000',strokeThickness:2,backgroundColor:'#00000088',padding:{x:3,y:1}
        }).setOrigin(0.5).setDepth(6);

        // Fake sprite that stays put. Every sprite method a damage or status loop might
        // call is a chainable no-op, so the dummy can be safely included in every targeting
        // loop (that's the whole point — it must receive damage) without ever crashing on a
        // missing method.
        const fakeSprite={
            x:px, y:py-TS, active:true, visible:true, alpha:1,
            destroy(){ fakeSprite.active=false; },
        };
        ['setTint','clearTint','setTintFill','setVisible','setAlpha','setScale','setPosition',
         'setOrigin','setRotation','setAngle','setFlipX','setFlipY','setDepth','setFrame',
         'setTexture','play','stop','setDisplaySize','setPipeline','setBlendMode']
            .forEach(m=>{ fakeSprite[m]=()=>fakeSprite; });

        const totem={
            x:tx, y:ty,
            health:999999, maxHealth:999999,
            // MUST be initialized: updateEnemyHealthBar guards on `_lastTrackedHealth !== undefined`,
            // so without this the damage-logging block is skipped entirely and DPS reads 0.
            _lastTrackedHealth:999999,
            _isDummy:true, _isStationary:true,
            sprite:fakeSprite,
            _dmgLog:[], _totalDmg:0,
            _label:label, _totalLabel:totalLabel, _gfx:g,
        };
        this.enemies.push(totem);
        this._dpsTotemList.push(totem);

        const ticker=this.time.addEvent({delay:200,loop:true,callback:()=>{
            if(!fakeSprite.active)return;
            const now=this.time.now;
            totem._dmgLog=totem._dmgLog.filter(d=>now-d.t<3000);
            const dps=totem._dmgLog.reduce((s,d)=>s+d.v,0)/3;
            label.setText(`DPS: ${Math.round(dps)}`);
            totalLabel.setText(`Total: ${Math.round(totem._totalDmg)}`);
            label.setColor(dps>5000?'#ff4444':dps>1000?'#ffaa44':dps>100?'#ffdd44':'#aaffaa');
            totem.health=999999; totem._lastTrackedHealth=999999; // never die; keep tracker in sync
        }});
        totem._ticker=ticker;
        this._showFloatingText(px,py-TS*3,'DPS TOTEM PLACED','#ffdd44');
    }

    _devBuyAllUpgrades(){
        if(!this._shopPurchased) this._shopPurchased={};
        this.scraps=999999; this.orbScraps=999999;
        const catalogue=this._buildShopCatalogue();
        // Buy every item to max tier
        let bought=0;
        for(const item of catalogue){
            const maxTier=Math.min(item.maxTier,50); // cap to prevent infinite loops
            while((this._shopPurchased[item.id]||0)<maxTier){
                const tier=this._shopPurchased[item.id]||0;
                // Skip diamond wrench if gold not purchased
                if(item.id==='wrench_diamond'&&this._wrenchTier!=='gold') break;
                try{ item.eff(); } catch(e){}
                this._shopPurchased[item.id]=tier+1;
                bought++;
            }
        }
        this.scraps=9999; this.orbScraps=9999;
        this._showFloatingText(this.player.x,this.player.y-40,`${bought} upgrades bought!`,'#ffdd44');
    }

    _clearDPSTotems(){
        if(!this._dpsTotemList)return;
        for(const t of this._dpsTotemList){
            t._ticker?.remove();
            t._gfx?.destroy();
            t._label?.destroy();
            t._totalLabel?.destroy();
            t.sprite.active=false;
        }
        this.enemies=this.enemies.filter(e=>!e._isDummy);
        this._dpsTotemList=[];
    }

    _spawnVoidBlackHole(cx,cy,dmgMult,sourceX,sourceY){
        const TS=this.TILE_SIZE;
        const radius=TS*3.2;
        const dur=1400;
        const gfx=this.add.graphics().setDepth(4.8);
        let rot=0, t=0;
        // Leave a voidlet behind at the center — it'll fire its own beam once the
        // black hole's duration ends, then keep attacking nearby enemies on its own
        const tileX=Math.floor(cx/TS), tileY=Math.floor(cy/TS);
        this._spawnVoidlet(tileX,tileY,dmgMult);
        const timer=this.time.addEvent({delay:16,loop:true,callback:()=>{
            if(!gfx.active){timer.remove();return;}
            rot+=0.15; t+=0.016;
            // Jitter — black hole center trembles
            const jx=cx+Math.sin(t*31)*2.5+Math.sin(t*47)*1.5;
            const jy=cy+Math.cos(t*37)*2.5+Math.cos(t*53)*1.5;
            gfx.clear();
            // Pulsing dark core — size oscillates
            const coreR=radius*(0.35+0.08*Math.sin(t*18));
            gfx.fillStyle(0x000000,0.92); gfx.fillCircle(jx,jy,coreR);
            gfx.fillStyle(0x110022,0.5); gfx.fillCircle(jx,jy,coreR*0.6);
            // Event horizon shimmer
            gfx.lineStyle(2,0x6600aa,0.4+0.3*Math.sin(t*22));
            gfx.strokeCircle(jx,jy,coreR);
            // 3 unstable arcs — each wobbles independently
            for(let r=0;r<3;r++){
                const rr=radius*(0.5+r*0.2)+Math.sin(t*15+r*2.1)*3;
                const a=rot*(r%2===0?1:-1)+Math.sin(t*9+r)*0.3;
                const arcLen=Math.PI*1.4+Math.sin(t*11+r*1.7)*0.4;
                // Offset each arc slightly for instability
                const ox=Math.sin(t*19+r*1.3)*2, oy=Math.cos(t*23+r*0.9)*2;
                gfx.lineStyle(2.5-r*0.5,0xaa00ff,0.75-r*0.2);
                gfx.beginPath(); gfx.arc(jx+ox,jy+oy,rr,a,a+arcLen,false); gfx.strokePath();
                // Crackling tip dots
                gfx.fillStyle(0xcc44ff,0.8-r*0.15);
                gfx.fillCircle(jx+ox+Math.cos(a)*rr,jy+oy+Math.sin(a)*rr,2+Math.sin(t*25+r)*1);
                gfx.fillCircle(jx+ox+Math.cos(a+arcLen)*rr,jy+oy+Math.sin(a+arcLen)*rr,1.5);
                // Thin crackling inner line
                if(r===0){
                    gfx.lineStyle(1,0xff88ff,0.3+0.2*Math.sin(t*33));
                    gfx.beginPath(); gfx.arc(jx,jy,rr*0.75,a+0.5,a+arcLen-0.3,false); gfx.strokePath();
                }
            }
            // Suck enemies toward center
            for(const e of [...this.enemies]){
                if(!e.sprite?.active||e._isTotem||e._isDummy)continue;
                const dx=cx-e.sprite.x, dy=cy-e.sprite.y;
                const d=Math.hypot(dx,dy);
                if(d>radius||d<4)continue;
                const pull=(1-d/radius)*4.2; // slightly stronger pull
                e.sprite.x+=dx/d*pull; e.sprite.y+=dy/d*pull;
                if(!(e._bhSnap)||this.time.now-e._bhSnap>300){
                    e._bhSnap=this.time.now;
                    const ntx=Math.floor(e.sprite.x/TS), nty=Math.floor(e.sprite.y/TS);
                    if(this.world[ntx]?.[nty]===this.FLOOR){
                        e.x=ntx; e.y=nty;
                        e._committedPath=undefined; e._pathIndex=undefined;
                    }
                }
                this._lastDamageFromWisp=true;
                e.health-=e.health*0.0055*dmgMult; // was 0.003 — meaningfully stronger DPS for a 5s-cooldown payoff
                this.updateEnemyHealthBar(e);
                this._lastDamageFromWisp=false;
                if(e.health<=0)this.killEnemy(e);
            }
        }});
        // Implosion at end
        this.time.delayedCall(dur,()=>{
            timer.remove(); gfx.destroy();
            // Collapsing rings
            for(let r=0;r<4;r++){
                this.time.delayedCall(r*50,()=>{
                    const ig=this.add.graphics().setDepth(5);
                    ig.x=cx; ig.y=cy;
                    ig.lineStyle(3-r*0.5,0xaa00ff,0.9-r*0.2); ig.strokeCircle(0,0,radius*(1-r*0.2));
                    this.tweens.add({targets:ig,scaleX:0.05,scaleY:0.05,alpha:0,duration:300,ease:'Quad.easeIn',onComplete:()=>ig.destroy()});
                });
            }
            this.cameras.main.shake(80,0.003);
            this._showFloatingText(cx,cy-24,'VULNERABLE!','#cc44ff');
            // Mark vulnerable 3s — longer window for other damage sources to capitalize on 2×
            for(const e of this.enemies){
                if(!e.sprite?.active||e._isTotem)continue;
                if(Math.hypot(e.sprite.x-cx,e.sprite.y-cy)>radius)continue;
                e._vulnerable=true; e._vulnerableUntil=this.time.now+3000;
                e.sprite.setTint(0xaa00ff);
                this.time.delayedCall(3000,()=>{ if(e.sprite?.active){e._vulnerable=false; e.sprite.clearTint();} });
            }
            // Every voidlet currently active across the map joins in — they all fire a big
            // beam converging on this black hole's location shortly after the implosion.
            this.time.delayedCall(250,()=>{
                if(!this._voidlets?.length)return;
                this._voidlets.forEach((vl,idx)=>{
                    this.time.delayedCall(idx*60,()=>{
                        if(!vl.gfx?.active)return;
                        const distToImpact=Math.hypot(vl.x-cx,vl.y-cy);
                        if(distToImpact<TS*0.5){
                            // This voidlet IS the one at the impact site — fire outward in a
                            // random direction instead of a zero-length beam at itself
                            const ang=Math.random()*Math.PI*2;
                            this._voidletFireBeam(vl,vl.x+Math.cos(ang)*TS*10,vl.y+Math.sin(ang)*TS*10,dmgMult,true);
                        } else {
                            this._voidletFireBeam(vl,cx,cy,dmgMult,true);
                        }
                    });
                });
            });
        });
    }

    _spawnVoidlet(tileX,tileY,dmgMult){
        const TS=this.TILE_SIZE;
        if(!this._voidlets) this._voidlets=[];
        const existing=this._voidlets.find(v=>v.tileX===tileX&&v.tileY===tileY);
        if(existing){ existing.lastActiveTime=this.time.now; existing.gfx.setVisible(true); existing.label?.setVisible(true); return existing; }
        const cx=tileX*TS+TS/2, cy=tileY*TS+TS/2;
        const gfx=this.add.graphics().setDepth(2.4);
        // Hovering name label, same family as the wisp bed nameplates — glow copy + crisp white text, gently bobbing
        const glowTxt=this.add.text(cx,cy-13,'Voidlet',{fontSize:'7px',fontFamily:'monospace',color:'#aa44dd',stroke:'#aa44dd',strokeThickness:1.5,fontStyle:'bold'}).setOrigin(0.5).setDepth(2.38).setAlpha(0.4).setScale(1.12);
        const label=this.add.text(cx,cy-13,'Voidlet',{fontSize:'7px',fontFamily:'monospace',color:'#eeccff',stroke:'#000',strokeThickness:2,fontStyle:'bold'}).setOrigin(0.5).setDepth(2.42);
        this.tweens.add({targets:label,y:cy-16,duration:1300+Math.random()*300,yoyo:true,repeat:-1,ease:'Sine.easeInOut'});
        this.tweens.add({targets:glowTxt,y:cy-15,scaleX:1.22,scaleY:1.22,alpha:0.22,duration:1500+Math.random()*300,yoyo:true,repeat:-1,ease:'Sine.easeInOut'});
        const voidlet={
            tileX,tileY,x:cx,y:cy,gfx,label,glowTxt,dmgMult,
            spawnTime:this.time.now, lastActiveTime:this.time.now,
            lastAttackTime:0, attackInterval:1400,
            despawnAfterIdle:9000,
            blinkTimer:0, blinking:false,
        };
        this._voidlets.push(voidlet);
        return voidlet;
    }

    _voidletFireBeam(voidlet,throughX,throughY,dmgMult,isAwakening){
        voidlet.lastActiveTime=this.time.now;
        const scale=isAwakening?1:0.45; // the awakening shot is the full-size beam; routine attacks are the "baby beam"
        this._fireVoidBeam(voidlet.x,voidlet.y,throughX,throughY,dmgMult,scale);
    }

    // ── LIFE WISP PASSIVE AURA ── "Vital Anchor"
    // While a Life Wisp is equipped, every 5 seconds it pulses 11 stamina to every other
    // equipped wisp at once — a chunked heal tick, not a continuous trickle. Each healed
    // wisp's own stamina arc flashes pink for ~1s to show the heal landing, then settles
    // back to its normal green/yellow/red based on its actual stamina level. A small pink
    // "+" floats up from each wisp the moment it's healed.
    _updateLifeWispAura(time,dt){
        const lifePet=this.pets?.find(p=>p.type==='life'&&!p._sleeping&&!p._travelingToSleep&&!p._flyingToBed);
        if(!lifePet)return;
        if(time-(this._lifeAuraLastTick||0)<5000)return;
        this._lifeAuraLastTick=time;
        const HEAL_AMOUNT=11;
        // Only wisps actually below max get healed — a wisp already full has nothing to gain,
        // and animating a heal that does nothing is just noisy clutter.
        const recipients=this.pets.filter(o=>o!==lifePet&&o.type!=='life'&&!o._sleeping&&!o._travelingToSleep&&(o.stamina??o.maxStamina)<o.maxStamina);
        if(!recipients.length)return; // nobody needs it — skip the tick's visuals entirely
        const px=this.player.x, py=this.player.y;
        for(const other of recipients){
            other.stamina=Math.min(other.maxStamina,(other.stamina||0)+HEAL_AMOUNT);
            // Tracked so _drawStaminaArc can render only the newly-added sliver in pink,
            // shrinking back into the base color over 1s, rather than flashing the whole ring
            other._lifeHealEndTime=time+1000;
            other._lifeHealAmount=HEAL_AMOUNT;
            // Wisps don't store their own screen position on gfx.x/y (drawn in local space each
            // frame instead) — compute the actual current orbit position from angle+orbitR.
            const ox=other._fistX??(px+Math.cos(other.angle)*other.orbitR);
            const oy=other._fistY??(py+Math.sin(other.angle)*other.orbitR);
            // A few plus signs drifting upward and fading, staggered slightly for a livelier feel
            for(let i=0;i<3;i++){
                this.time.delayedCall(i*90,()=>{
                    const offsetX=(i-1)*5;
                    const plus=this.add.text(ox+offsetX,oy-10,'+',{fontSize:'9px',fontFamily:'monospace',color:'#ff66aa',stroke:'#000',strokeThickness:2,fontStyle:'bold'}).setOrigin(0.5).setDepth(6);
                    this.tweens.add({targets:plus,y:oy-24,alpha:0,duration:650,ease:'Quad.easeOut',onComplete:()=>plus.destroy()});
                });
            }
        }
    }

    _updateAnchorDrag(time,dt){
        const TS=this.TILE_SIZE;
        // Anchor GRAVITY WELL: a low-gravity zone with floating debris. Every pulse, enemies
        // inside get an ACCELERATE bump (stacking); between pulses the speed continuously
        // decays. Like the healer slime but for speed — a well an enemy leaves faster than it
        // entered, dropping back down as it moves away.
        for(const e of this.enemies){
            if(!e.isAnchor||!e.sprite?.active)continue;
            e.isSlowed=true; e.slowedUntil=time+9999999; e._slowMult=0.6; // persistent self-slow
            e._suppressSpeedArrows=true; // innate slowness — don't nag with its own arrows
            const auraR=(e._anchorRange||6)*TS;

            // ── Gravity-well visual: swirling ring + floating rocks orbiting slowly (low-G) ──
            if(!e._anchorAuraGfx) e._anchorAuraGfx=this.add.graphics().setDepth(0.8);
            const ag=e._anchorAuraGfx; ag.clear();
            const puls=0.5+0.5*Math.sin(time*0.003);
            ag.fillStyle(0x334466,0.10+0.06*puls); ag.fillCircle(e.sprite.x,e.sprite.y,auraR);
            ag.lineStyle(2,0x6688cc,0.30+0.30*puls); ag.strokeCircle(e.sprite.x,e.sprite.y,auraR);
            ag.lineStyle(1.5,0x88aadd,0.15+0.2*puls); ag.strokeCircle(e.sprite.x,e.sprite.y,auraR*(0.55+0.1*puls));
            // Floating rocks orbiting slowly (signals low gravity from the anchor's burden).
            if(!e._anchorRocks){ e._anchorRocks=[]; for(let k=0;k<6;k++) e._anchorRocks.push({a:Math.random()*Math.PI*2,r:auraR*(0.3+Math.random()*0.6),sp:0.0003+Math.random()*0.0005,sz:1.5+Math.random()*2.5,bob:Math.random()*Math.PI*2}); }
            for(const rk of e._anchorRocks){
                rk.a+=rk.sp; // slow orbit
                const rx=e.sprite.x+Math.cos(rk.a)*rk.r;
                const ry=e.sprite.y+Math.sin(rk.a)*rk.r+Math.sin(time*0.002+rk.bob)*3; // gentle float
                ag.fillStyle(0x557799,0.7); ag.fillCircle(rx,ry,rk.sz);
                ag.fillStyle(0x99bbdd,0.5); ag.fillCircle(rx-rk.sz*0.3,ry-rk.sz*0.3,rk.sz*0.4); // highlight
            }

            // ── Pulse: bump speed of everyone inside, one notch per pulse (visible steps) ──
            if(time-e._tdAnchorLastPulse>=e._tdAnchorPulseEvery){
                e._tdAnchorLastPulse=time;
                // Expanding shock ring on the pulse.
                const ring=this.add.graphics().setDepth(1.2);
                ring.lineStyle(3,0x88bbff,0.8); ring.strokeCircle(0,0,auraR*0.5);
                ring.x=e.sprite.x; ring.y=e.sprite.y;
                this.tweens.add({targets:ring,scaleX:2,scaleY:2,alpha:0,duration:650,ease:'Quad.easeOut',onComplete:()=>ring.destroy()});
                for(const o of this.enemies){
                    if(o===e||!o.sprite?.active||o.isAnchor)continue;
                    if(Math.hypot(o.sprite.x-e.sprite.x,o.sprite.y-e.sprite.y)<=auraR){
                        o._speedBuff=Math.min(e._tdAnchorMax||2.2,(o._speedBuff||1)+(e._tdAnchorStep||0.22));
                        this._showStatusHit?.(o,'ACCELERATE','#88ccff');
                    }
                }
            }
        }
        // Continuous decay of the speed buff (runs whether or not the enemy is still inside —
        // the pulse re-tops it, so staying in the well keeps it fast; leaving lets it drop).
        for(const o of this.enemies){
            if(!o.sprite?.active||o.isAnchor)continue;
            if(o._speedBuff && o._speedBuff>1){
                o._speedBuff=Math.max(1,o._speedBuff-dt*0.12); // gentle decay — buff builds while pulsed
                o._anchorSpeedMult=Math.max(o._speedBuff, o._demonRageMult||1); // never below permanent demon rage
                if(o._speedBuff<=1.01){ o._speedBuff=1; o._anchorSpeedMult=Math.max(1,o._demonRageMult||1); }
            } else if(o._demonRageMult>1){
                o._anchorSpeedMult=o._demonRageMult; // keep the permanent rage applied
            }
        }

        for(const e of this.enemies){
            if(!e.isAnchor||!e.sprite?.active)continue;
            if(e._anchorLastX===undefined){ e._anchorLastX=e.sprite.x; e._anchorLastY=e.sprite.y; e._anchorFacingX=0; e._anchorFacingY=1; }
            const mdx=e.sprite.x-e._anchorLastX, mdy=e.sprite.y-e._anchorLastY;
            const mlen=Math.hypot(mdx,mdy);
            if(mlen>0.3){ e._anchorFacingX=mdx/mlen; e._anchorFacingY=mdy/mlen; }
            e._anchorLastX=e.sprite.x; e._anchorLastY=e.sprite.y;
            const dragDist=14;
            e._anchorDragPhase=(e._anchorDragPhase||0)+dt*3;
            const sway=Math.sin(e._anchorDragPhase)*2.5;
            const perpX=-e._anchorFacingY, perpY=e._anchorFacingX;
            const ax=e.sprite.x-e._anchorFacingX*dragDist+perpX*sway;
            const ay=e.sprite.y-e._anchorFacingY*dragDist+perpY*sway;
            if(e._anchorBodyGfx?.active){ e._anchorBodyGfx.x=ax; e._anchorBodyGfx.y=ay; }
            if(e._anchorRing?.active){ e._anchorRing.x=e.sprite.x; e._anchorRing.y=e.sprite.y; }
            if(e._anchorDragGfx?.active){
                const g=e._anchorDragGfx;
                g.clear();
                const segs=4;
                g.lineStyle(1.5,0x556677,0.7);
                for(let s=0;s<segs;s++){
                    const t0=s/segs, t1=(s+1)/segs;
                    const x0=e.sprite.x+(ax-e.sprite.x)*t0, y0=e.sprite.y+(ay-e.sprite.y)*t0;
                    const x1=e.sprite.x+(ax-e.sprite.x)*t1, y1=e.sprite.y+(ay-e.sprite.y)*t1;
                    g.lineBetween(x0,y0,x1,y1);
                    g.fillStyle(0x778899,0.6); g.fillCircle(x0,y0,1.3);
                }
                // Anchor weight at the chain's end.
                g.lineStyle(2.2,0x8899aa,0.9);
                g.strokeCircle(ax,ay-4,3);                       // ring at top
                g.lineBetween(ax,ay-1,ax,ay+7);                  // shank
                g.lineBetween(ax-5,ay+4,ax+5,ay+4);              // stock
                g.beginPath();                                    // curved arms (flukes)
                g.arc(ax,ay+3,6,Math.PI*0.15,Math.PI*0.85,false);
                g.strokePath();
            }
        }
    }

    _updateVoidlets(time,dt){
        if(!this._voidlets?.length)return;
        const TS=this.TILE_SIZE;
        for(let i=this._voidlets.length-1;i>=0;i--){
            const v=this._voidlets[i];
            // Despawn after prolonged inactivity
            if(time-v.lastActiveTime>v.despawnAfterIdle){
                const fade=this.add.graphics().setDepth(2.4);
                fade.x=v.x; fade.y=v.y;
                fade.fillStyle(0x6600aa,0.6); fade.fillCircle(0,0,5);
                this.tweens.add({targets:fade,alpha:0,scaleX:0.3,scaleY:0.3,duration:400,onComplete:()=>fade.destroy()});
                v.gfx.destroy(); v.label?.destroy(); v.glowTxt?.destroy();
                this._voidlets.splice(i,1);
                continue;
            }
            const idleFrac=Math.min(1,(time-v.lastActiveTime)/v.despawnAfterIdle);
            const fade=1-idleFrac*0.7; // visibly dims as it approaches despawn
            if(v.label?.active) v.label.setAlpha(fade);
            if(v.glowTxt?.active) v.glowTxt.setAlpha(0.22*fade);
            const bob=Math.sin(time*0.0028+v.x*0.05)*1.2; // gentle floaty bob, body included
            const bx=v.x, by=v.y+bob;
            // Blink occasionally for personality
            if(!v.blinking&&Math.random()<0.01){ v.blinking=true; v.blinkTimer=time; }
            if(v.blinking&&time-v.blinkTimer>120){ v.blinking=false; }
            v.gfx.clear();
            // Soft trailing wisps drifting off the back — little personality tendrils
            for(let s=0;s<3;s++){
                const sAng=time*0.0012+s*2.1;
                const sx=bx+Math.cos(sAng)*5.5, sy=by+Math.sin(sAng)*2.5+3;
                v.gfx.fillStyle(0x6600aa,0.18*fade); v.gfx.fillCircle(sx,sy,1.6-s*0.3);
            }
            // Outer soft glow
            v.gfx.fillStyle(0x440077,0.22*fade); v.gfx.fillCircle(bx,by,8);
            // Round chibi body — soft purple blob
            v.gfx.fillStyle(0x440077,0.9*fade); v.gfx.fillCircle(bx,by,5.5);
            v.gfx.fillStyle(0x6622aa,0.7*fade); v.gfx.fillCircle(bx-0.8,by-1,4.2);
            // Tiny highlight sheen
            v.gfx.fillStyle(0xcc99ee,0.35*fade); v.gfx.fillCircle(bx-1.6,by-1.8,1.4);
            // Big cute eyes — round and simple, blink by squishing to a line
            const eyeY=by-0.3;
            if(v.blinking){
                v.gfx.lineStyle(1,0xffffff,0.9*fade);
                v.gfx.lineBetween(bx-2.6,eyeY,bx-0.8,eyeY);
                v.gfx.lineBetween(bx+0.8,eyeY,bx+2.6,eyeY);
            } else {
                v.gfx.fillStyle(0xffffff,0.95*fade); v.gfx.fillCircle(bx-1.7,eyeY,1.3); v.gfx.fillCircle(bx+1.7,eyeY,1.3);
                v.gfx.fillStyle(0x220033,0.95*fade); v.gfx.fillCircle(bx-1.5,eyeY+0.2,0.6); v.gfx.fillCircle(bx+1.9,eyeY+0.2,0.6);
            }
            // Thin outline ring
            v.gfx.lineStyle(0.8,0x8822bb,0.35*fade); v.gfx.strokeCircle(bx,by,6.2);
            // Label position and bob are owned entirely by its own tween (set at spawn time)
            // Attack nearby enemies with a small beam, similar to but weaker than the wisp's own
            if(time-v.lastAttackTime>=v.attackInterval){
                const range=TS*3.5;
                const tgt=this.enemies.find(e=>e.sprite?.active&&!e._isTotem&&Math.hypot(e.sprite.x-v.x,e.sprite.y-v.y)<=range);
                if(tgt){
                    v.lastAttackTime=time;
                    this._voidletFireBeam(v,tgt.sprite.x,tgt.sprite.y,v.dmgMult,false);
                }
            }
        }
    }

    _fireVoidBeam(sourceX,sourceY,throughX,throughY,dmgMult,beamScale=1){
        const TS=this.TILE_SIZE;
        const dirX0=throughX-sourceX, dirY0=throughY-sourceY;
        const len0=Math.hypot(dirX0,dirY0)||1;
        const dirX=dirX0/len0, dirY=dirY0/len0;
        const maxLen=TS*60; // damage/travel range is effectively infinite — well past any reachable map edge
        const trailLen=TS*(2.2+1.4*beamScale); // the VISUAL bolt is short — full beam ~3.6 tiles, baby beam ~2.6
        const beamWidth=TS*1.1*beamScale;
        const chargeDur=300*Math.min(1,0.6+beamScale*0.4); // smaller voidlet beams charge a bit faster
        const frontSpeed=TS*22; // slower than before — gives the bolt real weight and travel time
        const hitSet=new Set();

        // Charge-up telegraph — a thin building line + pulsing dot at the origin
        const charge=this.add.graphics().setDepth(5.0);
        let chargeT=0;
        const chargeTimer=this.time.addEvent({delay:16,loop:true,callback:()=>{
            chargeT+=16;
            const pct=Math.min(1,chargeT/chargeDur);
            charge.clear();
            charge.fillStyle(0xcc44ff,0.5+pct*0.4); charge.fillCircle(sourceX,sourceY,(3+pct*5)*beamScale);
            charge.lineStyle(1,0xaa00ff,0.3*pct); charge.strokeCircle(sourceX,sourceY,(6+pct*6)*beamScale);
            if(pct>=1){ chargeTimer.remove(); charge.destroy(); }
        }});

        this.time.delayedCall(chargeDur,()=>{
            // The bolt travels outward at frontSpeed as a short trailing segment (not the full
            // origin-to-head line) — reads as a compact projectile rather than a sustained laser,
            // while its damage/pierce range is still effectively infinite along its path.
            const beam=this.add.graphics().setDepth(5.3);
            const head=this.add.graphics().setDepth(5.4);
            let traveled=0;
            const dmg=14*this.damageScaling*dmgMult*beamScale;
            this.cameras.main.shake(40*beamScale,0.0012*beamScale);
            const beamTimer=this.time.addEvent({delay:16,loop:true,callback:()=>{
                const prevTraveled=traveled;
                traveled+=frontSpeed*0.016;
                const headX=sourceX+dirX*traveled, headY=sourceY+dirY*traveled;
                const tailDist=Math.max(0,traveled-trailLen);
                const tailX=sourceX+dirX*tailDist, tailY=sourceY+dirY*tailDist;
                beam.clear(); head.clear();
                // Short trailing bolt body — only the last trailLen behind the head, not the whole path
                beam.lineStyle(beamWidth*1.8,0x6600aa,0.16);
                beam.beginPath(); beam.moveTo(tailX,tailY); beam.lineTo(headX,headY); beam.strokePath();
                beam.lineStyle(beamWidth,0xaa00ff,0.5);
                beam.beginPath(); beam.moveTo(tailX,tailY); beam.lineTo(headX,headY); beam.strokePath();
                beam.lineStyle(beamWidth*0.35,0xeebbff,0.8);
                beam.beginPath(); beam.moveTo(tailX,tailY); beam.lineTo(headX,headY); beam.strokePath();
                beam.lineStyle(beamWidth*0.12,0xffffff,0.85);
                beam.beginPath(); beam.moveTo(tailX,tailY); beam.lineTo(headX,headY); beam.strokePath();
                // Bright leading head — the actual "projectile" tip
                head.fillStyle(0xeebbff,0.9); head.fillCircle(headX,headY,beamWidth*0.55);
                head.fillStyle(0xffffff,0.95); head.fillCircle(headX,headY,beamWidth*0.25);
                // Damage — sweep the segment the front just crossed this frame, so enemies are
                // hit exactly when the leading edge reaches them, not all at once on cast.
                // This still checks along the full infinite path, independent of the short visual trail.
                for(const e of [...this.enemies]){
                    if(!e.sprite?.active||e._isTotem||hitSet.has(e))continue;
                    const ex=e.sprite.x-sourceX, ey=e.sprite.y-sourceY;
                    const proj=ex*dirX+ey*dirY;
                    if(proj<prevTraveled-TS*0.3||proj>traveled+TS*0.3)continue; // only near the moving front
                    const perp=Math.abs(ex*dirY-ey*dirX);
                    if(perp>beamWidth*0.6)continue;
                    hitSet.add(e);
                    this._lastDamageFromWisp=true;
                    this._lastDamageFromWisp=true; e.health-=dmg; this.updateEnemyHealthBar(e); this._lastDamageFromWisp=false;
                    this._lastDamageFromWisp=false;
                    this._showFloatingText(e.sprite.x,e.sprite.y-22,'PIERCED','#cc44ff');
                    if(e.health<=0)this.killEnemy(e);
                }
                if(traveled>=maxLen){
                    beamTimer.remove();
                    this.tweens.add({targets:[beam,head],alpha:0,duration:200,onComplete:()=>{beam.destroy();head.destroy();}});
                }
            }});
        });
    }

    _spawnPoisonTile(tx,ty,dmgMult){
        const TS=this.TILE_SIZE;
        const px=tx*TS, py=ty*TS;
        if(this._poisonTiles?.find(t=>t.tx===tx&&t.ty===ty)){
            const existing=this._poisonTiles.find(t=>t.tx===tx&&t.ty===ty);
            existing.expiresAt=this.time.now+6000; return;
        }
        if(!this._poisonTiles) this._poisonTiles=[];

        // Textured base — dark pool with mottled green patches
        const base=this.add.graphics().setDepth(0.5);
        base.fillStyle(0x002200,0.95); base.fillRect(px,py,TS,TS);
        base.fillStyle(0x003d00,0.7); base.fillRect(px+2,py+2,TS*0.55,TS*0.5);
        base.fillStyle(0x004400,0.6); base.fillRect(px+TS*0.4,py+TS*0.35,TS*0.5,TS*0.45);
        base.fillStyle(0x003300,0.8); base.fillRect(px+3,py+TS*0.5,TS*0.4,TS*0.45);
        base.fillStyle(0x005500,0.4); base.fillRect(px+TS*0.55,py+TS*0.6,TS*0.38,TS*0.35);
        base.fillStyle(0x006600,0.25); base.fillRect(px+6,py+TS*0.3,TS*0.25,3);
        base.fillStyle(0x006600,0.2); base.fillRect(px+TS*0.5,py+TS*0.15,TS*0.3,2);
        base.lineStyle(1.5,0x001100,0.8); base.strokeRect(px+0.5,py+0.5,TS-1,TS-1);
        this.tweens.add({targets:base,alpha:0.75,duration:1200,yoyo:true,repeat:-1,ease:'Sine.easeInOut'});

        // Bubble graphics — pop cycle animation
        const bubbleData=[
            {ox:0.22,oy:0.28,r:2.5,period:1800,offset:0},
            {ox:0.68,oy:0.48,r:2.0,period:2200,offset:600},
            {ox:0.42,oy:0.70,r:2.8,period:1600,offset:1100},
            {ox:0.18,oy:0.62,r:1.8,period:2000,offset:400},
            {ox:0.75,oy:0.22,r:2.2,period:1900,offset:900},
            {ox:0.55,oy:0.40,r:1.6,period:2400,offset:1500},
        ];
        const bubbleGfx=this.add.graphics().setDepth(0.56);
        const drawBubbles=()=>{
            bubbleGfx.clear();
            const now=this.time.now;
            for(const b of bubbleData){
                const phase=((now+b.offset)%b.period)/b.period; // 0→1 cycle
                if(phase>0.85)continue; // popped — invisible for last 15% of cycle
                // 0→0.6: grow, 0.6→0.85: shrink/pop
                const grow=phase<0.6 ? phase/0.6 : 1-(phase-0.6)/0.25;
                const r=b.r*Math.max(0,grow);
                if(r<0.3)continue;
                const bx=px+b.ox*TS, by=py+b.oy*TS;
                // Sphere body
                bubbleGfx.fillStyle(0x00cc33,0.7*grow); bubbleGfx.fillCircle(bx,by,r);
                // Rim
                bubbleGfx.lineStyle(0.8,0x004411,0.5*grow); bubbleGfx.strokeCircle(bx,by,r);
                // Shadow
                bubbleGfx.fillStyle(0x001100,0.3*grow); bubbleGfx.fillCircle(bx+r*0.25,by+r*0.3,r*0.6);
                // Highlight
                bubbleGfx.fillStyle(0x99ffaa,0.9*grow); bubbleGfx.fillCircle(bx-r*0.3,by-r*0.32,r*0.3);
                bubbleGfx.fillStyle(0xffffff,0.7*grow); bubbleGfx.fillCircle(bx-r*0.38,by-r*0.42,r*0.13);
                // Pop flash at phase 0.75-0.85
                if(phase>0.75){
                    const popT=(phase-0.75)/0.1;
                    bubbleGfx.lineStyle(0.8,0x44ff44,0.6*(1-popT));
                    bubbleGfx.strokeCircle(bx,by,r*(1+popT*0.8));
                }
            }
        };
        const bubbleTimer=this.time.addEvent({delay:32,loop:true,callback:drawBubbles});
        drawBubbles();
        this.tweens.add({targets:base,alpha:0.7,duration:1000,yoyo:true,repeat:-1,ease:'Sine.easeInOut'});

        const tile={tx,ty,base,bubbleGfx,bubbleTimer,expiresAt:this.time.now+6000,dmgMult};
        this._poisonTiles.push(tile);

        const ticker=this.time.addEvent({delay:500,loop:true,callback:()=>{
            if(this.time.now>tile.expiresAt){
                ticker.remove(); tile.bubbleTimer.remove();
                this.tweens.add({targets:[base,bubbleGfx],alpha:0,duration:500,onComplete:()=>{ base.destroy(); bubbleGfx.destroy(); }});
                this._poisonTiles=this._poisonTiles?.filter(t=>t!==tile); return;
            }
            // Apply/refresh poison status — tile doesn't damage directly
            for(const e of this.enemies){
                if(!e.sprite?.active||e._isTotem)continue;
                if(Math.floor(e.sprite.x/TS)!==tx||Math.floor(e.sprite.y/TS)!==ty)continue;
                // Refresh poison — damage ticks on the enemy separately
                e._poisoned=true;
                e._poisonUntil=this.time.now+2000; // refreshes duration
                e._poisonMult=dmgMult;
                if(e.sprite?.active) e.sprite.setTint(0x44ff44);
            }
        }});
    }

    _updateSlowVisuals(time){
        for(const e of this.enemies){
            if(!e.sprite?.active||e._isTotem)continue;
            const slowed = e.isSlowed && time<e.slowedUntil && !e._suppressSpeedArrows;
            const spedUp = e._speedBuff && e._speedBuff>1.05 && !e._suppressSpeedArrows;
            // Pick the active movement-speed state; slow takes priority if somehow both.
            const want = slowed ? (e._slowType||'slow_ice') : (spedUp ? 'speed_anchor' : null);
            if(want && e._speedIndType!==want){
                // State changed — restart the emitter with the right arrow type/direction.
                e._slowIndTimer?.remove();
                e._slowIndTimer=this._startSpeedIndicator(
                    ()=>e.sprite?.active?{x:e.sprite.x,y:e.sprite.y}:null,
                    want, 260
                );
                e._speedIndType=want;
            } else if(!want && e._slowIndTimer){
                e._slowIndTimer.remove(); e._slowIndTimer=null; e._speedIndType=null;
            }
        }
    }

    _updatePoisonDot(time){
        for(const e of [...this.enemies]){
            if(!e.sprite?.active||!e._poisoned)continue;
            if(time>e._poisonUntil){
                e._poisoned=false;
                if(e.sprite?.active) e.sprite.clearTint();
                continue;
            }
            if(time-(e._poisonLastTick||0)<500)continue;
            e._poisonLastTick=time;
            // Bypass CEO shield
            const saved=e._ceoShield;
            e._ceoShield=0;
            // 2.5× multiplier vs armored — poison melts through armor
            const armorMult=(e._ceoKnight&&(e._knightArmour||0)>0)?2:1;
            const poisonRate=0.02*(e._poisonMult||1)*armorMult; // 4%/s base, 8%/s vs armored
            // Also bypass knight armor directly
            const savedArmour=e._knightArmour;
            e._knightArmour=0;
            this._lastDamageFromWisp=true;
            e.health-=e.health*poisonRate;
            this.updateEnemyHealthBar(e);
            this._lastDamageFromWisp=false;
            e._knightArmour=savedArmour;
            e._ceoShield=saved;
            if(e.health<=0)this.killEnemy(e);
        }
    }

    // _spawnPetIceTile was REMOVED here — 48 lines, zero call sites. The Ice redesign
    // replaced its tile-based chill system with the water/wet economy, and it has been
    // unreachable ever since.
    //
    // It was the last surviving implementation of CHILL STACKS, so the mechanic is
    // recorded rather than lost: an enemy standing on a pet ice tile accrued one stack
    // per 400ms (`e._chillStacks`, gated by `e._lastChillTick`); at 5 stacks the stacks
    // reset and the enemy froze solid for 1200ms via freezeEnemy(e, 1200), with an ice
    // crystal flash at the freeze. Tiles expired after 3000ms and refreshed rather than
    // stacked when re-applied.
    //
    // If the Ice tree ever gains a tile-focused branch, that is the design to restore —
    // graded chill reads better than the current binary frozen + RNG roll.


    _updateRestingWisps(time,dt){
        // Ambient aura under every owned wisp's bed — reflects current state at a glance
        if(this._wispBeds&&this._ownedWisps){
            if(!this._bedAuraGfx) this._bedAuraGfx={};
            for(const type of this._ownedWisps){
                const bed=this._wispBeds[type]; if(!bed)continue;
                if(!this._bedAuraGfx[type]||!this._bedAuraGfx[type].active){
                    this._bedAuraGfx[type]=this.add.graphics().setDepth(0.95); // above bed (0.7) so it's actually visible
                }
                const g=this._bedAuraGfx[type];
                const lockoutUntil=this._wispLockoutUntil?.[type]||0;
                const isLockedOut=this.time.now<lockoutUntil;
                const isEquipped=this._equippedWisps?.has(type);
                const pet=isEquipped?this.pets?.find(p=>p.type===type):null;
                const maxStam=(isEquipped&&pet?.maxStamina)?pet.maxStamina
                              :(type==='light'&&this._lightMaxStam?this._lightMaxStam:(type==='fire'?200:100));
                const stamina=pet?.stamina??this._wispStamina?.[type]??maxStam;
                const pct=Math.max(0,Math.min(1,stamina/maxStam));
                g.clear();
                const pulse=0.6+0.25*Math.sin(time*0.0035);
                let col;
                if(isLockedOut) col=0xff2244;
                else if(isEquipped) col=0x4488ff;
                else if(pct>0.6) col=0x44ff88;
                else if(pct>0.25) col=0xffdd44;
                else col=0xff8844;
                // Glow ring AROUND the bed (larger than bed's 30×20 footprint), not underneath it
                const ringAlpha=isLockedOut?0.7*pulse:0.45+0.25*pct*pulse;
                g.lineStyle(2.5,col,ringAlpha); g.strokeEllipse(bed.x,bed.y+1,38,26);
                g.lineStyle(1,col,ringAlpha*0.6); g.strokeEllipse(bed.x,bed.y+1,44,30);
                // Soft outer glow fill, large enough to peek past the bed's opaque base
                g.fillStyle(col,0.06+0.06*pct*pulse); g.fillEllipse(bed.x,bed.y+1,44,30);
            }
        }
        if(!this._restingWisps)return;
        for(const type in this._restingWisps){
            const r=this._restingWisps[type];
            if(!r.gfx?.active)continue;
            const bob=Math.sin(time*0.0025+r.bx*0.1)*1.5;
            const pulse=0.7+0.2*Math.sin(time*0.003);
            r.gfx.clear();
            r.gfx.fillStyle(r.col,0.7*pulse); r.gfx.fillCircle(r.bx,r.by-3+bob,4.5);
            r.gfx.fillStyle(0xffffff,0.6); r.gfx.fillCircle(r.bx-1,r.by-4+bob,1.8);
            // Recover stamina while resting — works even starting from 0
            if(!this._wispStamina) this._wispStamina={};
            const maxStam=type==='fire'?200:100;
            const cur=this._wispStamina[type]??maxStam;
            this._wispStamina[type]=Math.min(maxStam,cur+3*(dt??0));
            // Draw stamina arc above the bed
            this._drawBedStaminaArc(r.staminaGfx,r.bx,r.by-14,this._wispStamina[type],maxStam);
        }
    }

    _drawBedStaminaArc(g,wx,wy,stamina,maxStamina){
        if(!g?.active)return;
        g.clear();
        const pct=Math.min(1,stamina/maxStamina);
        if(pct>=0.99)return;
        const r=12;
        g.lineStyle(2,0x222222,0.6); g.beginPath(); g.arc(wx,wy,r,-Math.PI/2,-Math.PI/2+Math.PI*2,false); g.strokePath();
        const col=pct>0.5?0x44ff88:pct>0.25?0xffdd44:0xff4444;
        g.lineStyle(2.5,col,0.9);
        g.beginPath(); g.arc(wx,wy,r,-Math.PI/2,-Math.PI/2+pct*Math.PI*2,false); g.strokePath();
        const endAng=-Math.PI/2+pct*Math.PI*2;
        g.fillStyle(col,1); g.fillCircle(wx+Math.cos(endAng)*r,wy+Math.sin(endAng)*r,2);
    }

    _spawnWispBeds(){
        if(this._wispBeds)return;
        this._wispBeds={};
        const TS=this.TILE_SIZE;
        const br=this._bedRoom;
        const wispTypes=['light','ice','boom','fire','fist','void','poison','skyward','phantom','life'];
        const bedY=br.y+Math.floor(br.h/2);
        const startX=br.x+Math.floor((br.w-wispTypes.length*2)/2)+1;
        const colors={light:0xffffff,ice:0x88ddff,boom:0xff8844,fire:0xff4422,fist:0xff6622,void:0xaa00ff,poison:0x44cc44,skyward:0xffdd44,phantom:0xccaaff,life:0xff88bb};
        const icons={light:'✨',ice:'❄',boom:'💥',fire:'🔥',fist:'👊',void:'🌑',poison:'☠',skyward:'🌟',phantom:'👻',life:'🌸'};
        // Room label
        this.add.text((br.x+br.w/2)*TS,(br.y-1)*TS,'💤 WISP QUARTERS',{fontSize:'9px',fontFamily:'monospace',color:'#556677'}).setOrigin(0.5).setDepth(0.8);
        wispTypes.forEach((type,i)=>{
            const bx=(startX+i*2)*TS+TS/2, by=bedY*TS+TS/2;
            const col=colors[type]||0xffffff;
            const g=this.add.graphics().setDepth(0.7);
            // Outer ring — raised cushioned rim (dog-bed style)
            g.fillStyle(0x2a1f1a,0.95); g.fillEllipse(bx,by+2,30,20);
            g.fillStyle(0x4a3a2e,0.9); g.fillEllipse(bx,by,28,18);
            // Rim highlight
            g.lineStyle(2,0x6a5544,0.6); g.strokeEllipse(bx,by-1,26,16);
            // Inner cushion — soft sunken pillow colored by wisp
            g.fillStyle(col,0.28); g.fillEllipse(bx,by+1,19,11);
            g.fillStyle(col,0.15); g.fillEllipse(bx,by+1,12,7);
            // Stitch dots around rim
            for(let s=0;s<8;s++){
                const sa=s/8*Math.PI*2;
                g.fillStyle(0x6a5544,0.5);
                g.fillCircle(bx+Math.cos(sa)*13,by+Math.sin(sa)*8,1);
            }
            // Soft highlight sheen top-left
            g.fillStyle(0xffffff,0.08); g.fillEllipse(bx-5,by-4,10,5);
            // Hovering name plate instead of an emoji — full wisp name, glowing, gently bobbing
            const dispName=type.charAt(0).toUpperCase()+type.slice(1);
            const glowTxt=this.add.text(bx,by-18,dispName,{fontSize:'8px',fontFamily:'monospace',color:'#'+col.toString(16).padStart(6,'0'),stroke:'#'+col.toString(16).padStart(6,'0'),strokeThickness:1.5,fontStyle:'bold'}).setOrigin(0.5).setDepth(0.78).setAlpha(0.4).setScale(1.12);
            const label=this.add.text(bx,by-18,dispName,{fontSize:'8px',fontFamily:'monospace',color:'#ffffff',stroke:'#000',strokeThickness:2,fontStyle:'bold'}).setOrigin(0.5).setDepth(0.8);
            // Gentle hover/bob animation, glow pulses slightly out of phase
            this.tweens.add({targets:label,y:by-21,duration:1400+Math.random()*300,yoyo:true,repeat:-1,ease:'Sine.easeInOut'});
            this.tweens.add({targets:glowTxt,y:by-20,scaleX:1.22,scaleY:1.22,alpha:0.22,duration:1600+Math.random()*300,yoyo:true,repeat:-1,ease:'Sine.easeInOut'});
            this._wispBeds[type]={x:bx,y:by-2,gfx:g,label,occupied:false};
        });
    }

    _wispGoToSleep(pet){
        const bed=this._wispBeds?.[pet.type];
        if(bed) bed.occupied=true;
        this._equippedWisps?.delete(pet.type);
        if(!this._wispStamina) this._wispStamina={};
        this._wispStamina[pet.type]=0;
        if(!this._wispLockoutUntil) this._wispLockoutUntil={};
        this._wispLockoutUntil[pet.type]=this.time.now+8000; // 8s forced lockout before recharge even begins
        // Phantom Wisp going to sleep mid-possession would otherwise leave the possessed
        // enemy permanently stuck (fleeing forever, tinted, damage-bonused) since its own
        // combat block — the only place that normally clears this — stops running the
        // instant it's removed from active duty. Release the possession right here instead.
        if(pet.type==='phantom'&&pet._phantomTarget){
            const e=pet._phantomTarget;
            if(e.sprite?.active){
                e._fleeing=false; e._possessed=false; e._phantomDmgBonus=0;
                e.sprite.clearTint();
            }
            pet._phantomTarget=null;
        }
        pet._travelingToSleep=true;
        pet._sleepTargetX=bed?.x??pet.gfx?.x;
        pet._sleepTargetY=bed?.y??pet.gfx?.y;
        this._showFloatingText(this.player.x,this.player.y-30,`${pet.type} wisp crashed... zz`,'#ff8888');
    }

    // ─── EXCLUSIVE PANELS ──────────────────────────────────────────────────────
    // Only one UI panel may be open at a time. Overlapping panels caused stale reads:
    // e.g. the roster caches its card refs when it opens, so buying a wisp in the shop
    // underneath it left the roster showing the old state until reopened.
    // `except` skips one key so a panel can legitimately re-open itself (the tower
    // upgrade menu does this when returning from its sub-dialogs).
    _closeAllPanels(except){
        const P={
            roster:   ()=>{ if(this._wispRosterOpen)   this._closeWispRoster(); },
            tree:     ()=>{ if(this._wispTreeOpen)     this._closeWispSkillTree(); },
            shop:     ()=>{ if(this._glurpShopOpen)    this._closeGlurpShop(); },
            build:    ()=>{ if(this._buildMenuOpen)    this._closeBuildMenu(); },
            upgrade:  ()=>{ if(this._upgradeMenuOpen)  this._closeUpgradeMenu(); },
            devpanel: ()=>{ if(this._devPanelOpen)     this._closeDevPanel(); },
            devspawn: ()=>{ if(this._devSpawnOpen)     this._closeDevSpawnMenu(); },
            devtree:  ()=>{ if(this._devTreeMenuOpen)  this._closeDevWispTreeMenu(); },
            wavetv:   ()=>{ if(this._waveTVOpen)       this._closeWaveTV(); },
        };
        for(const k in P) if(k!==except) P[k]();
    }

    // ─── WAVE INTEL TV ─────────────────────────────────────────────────────────
    // A CRT in the centre room. Walk up and press [F] to see exactly what the current
    // (or next) wave contains: real enemy sprites, counts, HP, a threat estimate, and a
    // conveyor showing spawn order. Reads the CACHED composition so it can never disagree
    // with what actually spawns.
    _buildWaveTV(){
        const TS=this.TILE_SIZE, cr=this._centreRoom;
        this._tvTileX=cr.x+3; this._tvTileY=cr.y+2;
        const x=this._tvTileX*TS+TS/2, y=this._tvTileY*TS+TS/2-TS/2;

        const g=this.add.graphics().setDepth(1.5);
        // stand
        g.fillStyle(0x2a2a33,1); g.fillRect(x-6,y+20,12,8); g.fillRect(x-16,y+27,32,4);
        // body
        g.fillStyle(0x3b3b47,1); g.fillRoundedRect(x-26,y-16,52,38,4);
        g.lineStyle(2,0x1a1a22,1); g.strokeRoundedRect(x-26,y-16,52,38,4);
        // screen
        g.fillStyle(0x061018,1); g.fillRoundedRect(x-21,y-12,36,28,2);
        g.lineStyle(1,0x224466,0.9); g.strokeRoundedRect(x-21,y-12,36,28,2);
        // knobs
        g.fillStyle(0x8a8a99,1); g.fillCircle(x+20,y-6,2.4); g.fillCircle(x+20,y+2,2.4);
        // antenna
        g.lineStyle(2,0x8a8a99,1);
        g.lineBetween(x-6,y-16,x-16,y-30); g.lineBetween(x+4,y-16,x+14,y-30);
        this._tvGfx=g;

        // animated scanline / flicker on the screen
        this._tvScreen=this.add.graphics().setDepth(1.6);
        this._tvScreenBox={x:x-21,y:y-12,w:36,h:28};

        this._tvLabel=this.add.text(x,y-42,'[F] Wave Intel',{
            fontSize:'11px',fontFamily:'monospace',color:'#66ddff',stroke:'#000',strokeThickness:3
        }).setOrigin(0.5).setDepth(3).setVisible(false);
    }

    // Drives the TV's live conveyor. Enemy i is drawn at markerX + (spawnAt - elapsed)*PPMS,
    // so the queue physically slides left and each slime crosses the SPAWN marker at the
    // exact moment its delayedCall fires in _startNextWave.
    _updateWaveTVBelt(time){
        const B=this._tvBelt; if(!B)return;
        // Before the wave begins there's no clock — show the queue parked at the marker.
        const elapsed=this.waveActive&&this._waveStartTime!=null?(time-this._waveStartTime):0;
        const rightEdge=B.beltX+B.beltW-8;
        let spawned=0;

        for(const it of B.items){
            const x=B.markerX+(it.spawnAt-elapsed)*B.PPMS;
            const past=x<B.markerX-2;
            if(past)spawned++;
            const visible=x>B.beltX-20&&x<rightEdge;
            if(!it.spr.active)continue;
            it.spr.setVisible(visible).setPosition(x,B.beltY+14);
            // Slimes that have already spawned drain away to the left.
            it.spr.setAlpha(past?Math.max(0,1-(B.markerX-x)/40):1);
            if(it.lbl?.active){
                it.lbl.setVisible(visible&&!past).setPosition(x,B.beltY+29);
            }
        }
        // Scrolling treads sell the motion.
        const g=B.treads; g.clear();
        const off=this.waveActive?((elapsed*B.PPMS)%10):0;
        for(let x=B.beltX+6-off;x<rightEdge;x+=10){
            g.lineStyle(1,0x18293a,1); g.lineBetween(x,B.beltY+32,x+5,B.beltY+32);
        }
        if(B.spawnedTxt?.active){
            B.spawnedTxt.setText(this.waveActive
                ? `${Math.min(spawned,B.total)} / ${B.total} released`
                : `${B.total} queued — starts on wave`);
        }
    }

    _updateWaveTV(time){
        if(this._waveTVOpen) this._updateWaveTVBelt(time);
        if(!this._tvScreen||!this._tvScreenBox)return;
        const b=this._tvScreenBox;
        const g=this._tvScreen; g.clear();
        // faint moving scanline so the TV reads as "on"
        const t=(time%1600)/1600;
        g.fillStyle(0x0d2b3d,0.55); g.fillRect(b.x+1,b.y+1,b.w-2,b.h-2);
        g.fillStyle(0x66ddff,0.10); g.fillRect(b.x+1,b.y+1+ t*(b.h-4),b.w-2,3);
        for(let i=2;i<b.h-2;i+=4){ g.fillStyle(0x000000,0.18); g.fillRect(b.x+1,b.y+i,b.w-2,1); }
        // proximity label
        const near=Math.abs(this._myX-this._tvTileX)+Math.abs(this._myY-this._tvTileY)<=3;
        this._tvLabel?.setVisible(near&&!this._waveTVOpen);
    }

    _tryInteractWaveTV(){
        if(this._pmActive)return;
        if(this._waveTVOpen){ this._closeWaveTV(); return; }
        const dx=Math.abs(this._myX-this._tvTileX),dy=Math.abs(this._myY-this._tvTileY);
        if(dx+dy<=3) this._openWaveTV();
    }

    // Aggregate a composition into {type,count} rows plus a threat score.
    _waveIntel(wave){
        const comp=this._getWaveComposition(wave);
        const T=this._enemyTables();
        const waveMult=Math.pow(1.045,wave-1);
        const tally=list=>{ const m=new Map(); for(const t of list) m.set(t,(m.get(t)||0)+1); return [...m.entries()].map(([type,count])=>({type,count})); };
        const mobRows=tally(comp.mobile), staRows=tally(comp.stationary);
        let threat=0;
        for(const r of [...mobRows,...staRows]){
            const hp=(T.hp[r.type]||15)*waveMult;
            const dmg=(T.dmg[r.type]||5);
            threat += r.count*(hp*0.6+dmg*3);
        }
        return {comp,mobRows,staRows,threat:Math.round(threat),waveMult};
    }

    _openWaveTV(){
        this._closeAllPanels('wavetv');
        this._waveTVOpen=true;
        const objs=this._tvObjs=[]; const tr=o=>{objs.push(o);return o;};
        const W=this.scale.width,H=this.scale.height;
        const cx=W/2,cy=H/2;
        const PW=Math.min(W*0.94,880), PH=Math.min(H*0.94,760);
        const px=cx-PW/2, py=cy-PH/2;

        // Current wave while it's running; otherwise the wave you're about to face.
        const wave=this.waveActive?this.wave:this.wave+1;
        const {comp,mobRows,staRows,threat}=this._waveIntel(wave);
        const T=this._enemyTables();
        const waveMult=Math.pow(1.045,wave-1);
        const names={basic:'Basic Slime',berserker:'Berserker',speed:'Speedy',rooter:'Rooter',splitter:'Splitter',
            ranged:'Ranged',sniper:'Sniper',mortar:'Mortar',healer_totem:'Healer Totem',anchor:'Anchor',
            taunter:'Taunter',ceo:'CEO',knight:'Knight',infernal:'Infernal',portal_bringer:'Portal Bringer',
            ghost_buster:'Ghost Buster',wraith:'Wraith'};

        tr(this.add.rectangle(cx,cy,W,H,0x000000,0.78).setScrollFactor(0).setDepth(60).setInteractive()
            .on('pointerdown',()=>this._closeWaveTV()));
        const bg=tr(this.add.graphics().setScrollFactor(0).setDepth(61));
        bg.fillStyle(0x050d14,0.99); bg.fillRoundedRect(px,py,PW,PH,12);
        bg.lineStyle(2,0x2f7fa5,0.7); bg.strokeRoundedRect(px,py,PW,PH,12);

        // Header — banner if the wave is a named one
        const title=comp._banner?`WAVE ${wave} — ${comp._banner}`:`WAVE ${wave}`;
        tr(this.add.text(cx,py+30,title,{fontSize:'22px',fontFamily:UIKit.FONT.title,
            color:comp._bannerCol||'#66ddff',fontStyle:'bold',stroke:'#000',strokeThickness:4})
            .setOrigin(0.5).setScrollFactor(0).setDepth(63));
        tr(this.add.text(cx,py+56,this.waveActive?'INCOMING — wave in progress':'NEXT WAVE — prepare',
            {fontSize:'12px',fontFamily:'monospace',color:'#5f7d92'}).setOrigin(0.5).setScrollFactor(0).setDepth(63));
        tr(this.add.text(px+PW-18,py+30,'✕',{fontSize:'20px',fontFamily:UIKit.FONT.title,color:'#ff6666'})
            .setOrigin(1,0.5).setScrollFactor(0).setDepth(64).setInteractive().on('pointerdown',()=>this._closeWaveTV()));

        // Threat estimate bar. Benchmark ~2600 = the W35 "Convergence" finale, so the bar
        // reads green early, amber through the mid-game spike waves, red at the finale.
        const tBarW=PW-120, tBarX=px+60, tBarY=py+82;
        const frac=Math.max(0.03,Math.min(1,threat/2600));
        const tg=tr(this.add.graphics().setScrollFactor(0).setDepth(63));
        tg.fillStyle(0x101c26,1); tg.fillRoundedRect(tBarX,tBarY,tBarW,12,6);
        const tCol=frac>0.62?0xff4444:frac>0.32?0xffaa33:0x44dd88;
        tg.fillStyle(tCol,0.95); tg.fillRoundedRect(tBarX,tBarY,Math.max(10,tBarW*frac),12,6);
        tg.lineStyle(1,0x2f7fa5,0.6); tg.strokeRoundedRect(tBarX,tBarY,tBarW,12,6);
        tr(this.add.text(tBarX,tBarY-14,`THREAT  ${threat.toLocaleString()}`,{fontSize:'11px',fontFamily:'monospace',color:'#8fb0c4'})
            .setOrigin(0,0.5).setScrollFactor(0).setDepth(63));
        tr(this.add.text(tBarX+tBarW,tBarY-14,`${comp.mobile.length} enemies${comp.stationary.length?`  +${comp.stationary.length} installations`:''}`,
            {fontSize:'11px',fontFamily:'monospace',color:'#8fb0c4'}).setOrigin(1,0.5).setScrollFactor(0).setDepth(63));

        // ── Enemy roster list: real sprite + count + per-enemy HP ──
        const listTop=py+112;
        const rowH=46;
        const allRows=[...mobRows.map(r=>({...r,kind:'mobile'})),...staRows.map(r=>({...r,kind:'installation'}))];
        allRows.sort((a,b)=>b.count-a.count);
        const maxRows=Math.floor((PH-112-150)/rowH);
        const shown=allRows.slice(0,maxRows);

        shown.forEach((r,i)=>{
            const ry=listTop+i*rowH;
            const rg=tr(this.add.graphics().setScrollFactor(0).setDepth(62));
            rg.fillStyle(i%2?0x0a1620:0x08121a,0.9); rg.fillRoundedRect(px+22,ry,PW-44,rowH-6,6);

            const vis=T.visuals[r.type]||{tint:0xff5555,scale:1};
            const spr=tr(this.add.sprite(px+52,ry+(rowH-6)/2,'slime_red',0)
                .setScale(this.SLIME_SCALE*vis.scale*0.85).setTint(vis.tint)
                .setScrollFactor(0).setDepth(63));
            if(this.anims.exists('red_idle')) spr.play('red_idle');

            tr(this.add.text(px+84,ry+10,names[r.type]||r.type,{fontSize:'15px',fontFamily:'monospace',
                color:'#dbe7f2',fontStyle:'bold'}).setOrigin(0,0.5).setScrollFactor(0).setDepth(63));
            tr(this.add.text(px+84,ry+28,r.kind==='installation'?'installation':'mobile',
                {fontSize:'10px',fontFamily:'monospace',color:'#5f7d92'}).setOrigin(0,0.5).setScrollFactor(0).setDepth(63));

            const hp=Math.max(1,Math.floor((T.hp[r.type]||15)*waveMult));
            tr(this.add.text(px+PW-150,ry+(rowH-6)/2,`${hp} HP`,{fontSize:'12px',fontFamily:'monospace',color:'#8fb0c4'})
                .setOrigin(0.5).setScrollFactor(0).setDepth(63));
            tr(this.add.text(px+PW-52,ry+(rowH-6)/2,`×${r.count}`,{fontSize:'19px',fontFamily:UIKit.FONT.title,
                color:'#ffdd44',fontStyle:'bold'}).setOrigin(1,0.5).setScrollFactor(0).setDepth(63));
        });
        if(allRows.length>shown.length){
            tr(this.add.text(cx,listTop+shown.length*rowH+8,`+${allRows.length-shown.length} more types…`,
                {fontSize:'11px',fontFamily:'monospace',color:'#5f7d92'}).setOrigin(0.5).setScrollFactor(0).setDepth(63));
        }

        // ── Conveyor belt: LIVE spawn queue. Enemies slide left toward the SPAWN marker,
        // crossing it exactly when they actually spawn (driven by _updateWaveTVBelt). ──
        const beltY=py+PH-72;
        const beltX=px+22, beltW=PW-44;
        tr(this.add.text(beltX+2,beltY-22,'SPAWN QUEUE',{fontSize:'11px',fontFamily:'monospace',color:'#5f7d92',fontStyle:'bold'})
            .setOrigin(0,0.5).setScrollFactor(0).setDepth(63));
        const beltG=tr(this.add.graphics().setScrollFactor(0).setDepth(62));
        beltG.fillStyle(0x0a1620,0.95); beltG.fillRoundedRect(beltX,beltY-8,beltW,46,6);
        beltG.lineStyle(1,0x1e3245,1);  beltG.strokeRoundedRect(beltX,beltY-8,beltW,46,6);

        const slot=26;
        const markerX=beltX+34;                 // the "portal" — items cross here on spawn
        // Real per-index spawn schedule (bursty). Use the live one while a wave runs;
        // recompute deterministically for the previewed wave otherwise, so the belt spacing
        // matches exactly what will spawn.
        const spawnTimes=(this.waveActive&&this._waveSpawnTimes)?this._waveSpawnTimes
                                                                :this._computeSpawnTimes(wave,comp.mobile.length);
        const avgInterval=spawnTimes.length>1?(spawnTimes[spawnTimes.length-1]/(spawnTimes.length-1)):400;
        const PPMS=slot/Math.max(120,avgInterval); // px per ms

        // Moving treads (scroll with the belt)
        const treads=tr(this.add.graphics().setScrollFactor(0).setDepth(62.5));

        // Marker + label
        const mk=tr(this.add.graphics().setScrollFactor(0).setDepth(63.5));
        mk.lineStyle(2,0xff6644,0.9); mk.lineBetween(markerX,beltY-6,markerX,beltY+34);
        mk.fillStyle(0xff6644,0.9); mk.fillTriangle(markerX-4,beltY-6,markerX+4,beltY-6,markerX,beltY);
        tr(this.add.text(markerX,beltY+38,'SPAWN',{fontSize:'8px',fontFamily:'monospace',color:'#ff8866'})
            .setOrigin(0.5,0).setScrollFactor(0).setDepth(63.5));

        // Build a sprite per queued enemy (capped — a wave is at most a few dozen).
        const items=[];
        comp.mobile.slice(0,80).forEach((type,i)=>{
            const vis=T.visuals[type]||{tint:0xff5555,scale:1};
            const s=tr(this.add.sprite(-999,beltY+14,'slime_red',0)
                .setScale(this.SLIME_SCALE*vis.scale*0.5).setTint(vis.tint)
                .setScrollFactor(0).setDepth(63));
            if(this.anims.exists('red_idle')) s.play('red_idle');
            const spawnAt=spawnTimes[i]??(i*400);
            let lbl=null;
            if(this._devMode){
                lbl=tr(this.add.text(-999,beltY+29,`${(spawnAt/1000).toFixed(1)}s`,
                    {fontSize:'8px',fontFamily:'monospace',color:'#44ff44'}).setOrigin(0.5,0).setScrollFactor(0).setDepth(64));
            }
            items.push({spr:s,lbl,spawnAt});
        });
        const spawnedTxt=tr(this.add.text(beltX+beltW-6,beltY-22,'',{fontSize:'11px',fontFamily:'monospace',color:'#5f7d92'})
            .setOrigin(1,0.5).setScrollFactor(0).setDepth(63));

        this._tvBelt={items,treads,beltX,beltY,beltW,markerX,PPMS,slot,spawnedTxt,
                      total:comp.mobile.length,interval:avgInterval};
        this._updateWaveTVBelt(this.time.now);

        tr(this.add.text(cx,py+PH-14,'[F] or [ESC] to close',{fontSize:'11px',fontFamily:'monospace',color:'#3f5566'})
            .setOrigin(0.5,1).setScrollFactor(0).setDepth(63));
    }

    _closeWaveTV(){
        this._waveTVOpen=false;
        this._tvBelt=null; // updater must not touch destroyed sprites
        (this._tvObjs||[]).forEach(o=>o?.active&&o.destroy());
        this._tvObjs=[];
    }

    // Deterministic interleave: spreads enemy types evenly through the spawn order using a
    // fixed stride, so a wave arrives as a varied stream rather than type-blocks. Seeded by
    // wave number so the Wave Intel TV preview matches the real spawn order exactly.
    _shuffleWave(list){
        if(!list||list.length<3)return list;
        const n=list.length;
        // Sort by a hash of (type, index-within-type) to distribute types without RNG.
        const idxByType={};
        const keyed=list.map(t=>{ idxByType[t]=(idxByType[t]||0)+1; return {t,k:(idxByType[t]-1)}; });
        const total={}; for(const t of list) total[t]=(total[t]||0)+1;
        // position = fractional slot each copy should occupy, evenly spaced per type
        keyed.forEach(o=>{ o.pos=(o.k+0.5)/total[o.t]; });
        keyed.sort((x,y)=>x.pos-y.pos);
        for(let i=0;i<n;i++) list[i]=keyed[i].t;
        return list;
    }

    // Per-index spawn schedule for a wave: a faster base cadence at high waves, with
    // enemies arriving in tight surges of ~3 then a breath, so the field pulses and stays
    // dense instead of trickling evenly. Deterministic — spawner and TV belt share it.
    _computeSpawnTimes(wave,count){
        const base=Math.max(160,760-Math.min(wave,60)*8.5);
        const times=[]; let t=0;
        for(let i=0;i<count;i++){
            times.push(t);
            t += (i%5)<3 ? base*0.35 : base*1.6;
        }
        return times;
    }

    _openWispRoster(){
        this._closeAllPanels('roster');
        this._wispRosterOpen=true;
        const objs=[]; this._wrObjs=objs;
        this._wrCardRefs={}; // per-type live-update refs
        const tr=o=>{objs.push(o);return o;};
        const W=this.scale.width,H=this.scale.height;
        const owned=[...(this._ownedWisps||[])];
        const cols=5, cardW=112, cardH=120, gap=12;
        const panelW=cols*cardW+(cols-1)*gap+48;
        const rows=Math.max(1,Math.ceil(owned.length/cols));
        const panelH=rows*cardH+(rows-1)*gap+124;
        const px=W/2-panelW/2, py=H/2-panelH/2;

        tr(this.add.rectangle(W/2,H/2,W,H,0x000000,0.55).setScrollFactor(0).setDepth(40).setInteractive());
        const bg=tr(this.add.graphics().setScrollFactor(0).setDepth(41));
        bg.fillStyle(0x0a0f18,0.97); bg.fillRoundedRect(px,py,panelW,panelH,10);
        bg.lineStyle(2,0x4488cc,0.7); bg.strokeRoundedRect(px,py,panelW,panelH,10);
        tr(this.add.text(px+panelW/2,py+30,'🧚 WISP ROSTER',{fontSize:'23px',fontFamily:UIKit.FONT.title,color:'#88ccff',fontStyle:'bold'}).setOrigin(0.5).setScrollFactor(0).setDepth(42));
        const equipTxt=tr(this.add.text(px+panelW/2,py+58,'',{fontSize:'13px',fontFamily:'monospace',color:'#778899'}).setOrigin(0.5).setScrollFactor(0).setDepth(42));
        this._wrEquipTxt=equipTxt;

        const icons={light:'✨',ice:'❄',boom:'💥',fire:'🔥',fist:'👊',void:'🌑',poison:'☠',skyward:'🌟',phantom:'👻',life:'🌸'};
        const names={light:'Light',ice:'Ice',boom:'Boom',fire:'Fiery',fist:'Fist',void:'Void',poison:'Poison',skyward:'Skyward',phantom:'Phantom',life:'Life'};

        if(!owned.length){
            tr(this.add.text(px+panelW/2,py+panelH/2,'No wisps owned yet.\nBuy some from the Glurp Shop!',{fontSize:'15px',fontFamily:'monospace',color:'#556677',align:'center'}).setOrigin(0.5).setScrollFactor(0).setDepth(42));
        }

        owned.forEach((type,i)=>{
            const col=i%cols, row=Math.floor(i/cols);
            const bx=px+24+col*(cardW+gap), by=py+84+row*(cardH+gap);

            const cardBg=tr(this.add.graphics().setScrollFactor(0).setDepth(42));
            const drawCard=(hov,isEquipped,isAsleep)=>{
                cardBg.clear();
                const fill=isEquipped?0x0a2a20:isAsleep?0x1a1010:hov?0x152535:0x0d1622;
                cardBg.fillStyle(fill,0.99); cardBg.fillRoundedRect(bx,by,cardW,cardH,8);
                cardBg.lineStyle(2,isEquipped?0x44ffaa:isAsleep?0x553333:hov?0x4488cc:0x223344,isEquipped?0.9:0.5);
                cardBg.strokeRoundedRect(bx,by,cardW,cardH,8);
            };

            tr(this.add.text(bx+cardW/2,by+26,icons[type]||'?',{fontSize:'34px'}).setOrigin(0.5).setScrollFactor(0).setDepth(43));
            const nameTxt=tr(this.add.text(bx+cardW/2,by+60,names[type]||type,{fontSize:'14px',fontFamily:'monospace',color:'#ccddee',fontStyle:'bold'}).setOrigin(0.5).setScrollFactor(0).setDepth(43));

            const barBg=tr(this.add.rectangle(bx+cardW/2,by+80,88,8,0x000000,0.6).setScrollFactor(0).setDepth(43));
            const barFill=tr(this.add.rectangle(bx+cardW/2-44,by+80,1,6,0x44ff88,0.9).setOrigin(0,0.5).setScrollFactor(0).setDepth(44));
            const statusTxt=tr(this.add.text(bx+cardW/2,by+98,'',{fontSize:'12px',fontFamily:'monospace',color:'#7788aa'}).setOrigin(0.5).setScrollFactor(0).setDepth(43));

            const hit=tr(this.add.rectangle(bx+cardW/2,by+cardH/2,cardW,cardH,0xffffff,0).setScrollFactor(0).setDepth(45).setInteractive());
            hit.on('pointerover',()=>{ const r=this._wrCardRefs[type]; drawCard(true,r._isEquipped,r._isAsleep); });
            hit.on('pointerout', ()=>{ const r=this._wrCardRefs[type]; drawCard(false,r._isEquipped,r._isAsleep); });
            hit.on('pointerdown',p=>{
                p.event.stopPropagation();
                const r=this._wrCardRefs[type];
                if(r._isAsleep)return; // can't interact while sleeping
                if(r._isEquipped) this._unequipWisp(type);
                else this._equipWisp(type);
            });

            this._wrCardRefs[type]={cardBg,drawCard,nameTxt,barFill,statusTxt,bx,by,_isEquipped:false,_isAsleep:false};

            // Skill-tree access badge (top-left corner) — only for wisps that have a tree.
            // Clicking it opens the radial tree; stopPropagation keeps it from also
            // triggering the card's equip/unequip toggle.
            if(this._getWispSkillTree(type)){
                const badge=tr(this.add.graphics().setScrollFactor(0).setDepth(46));
                const drawBadge=(hov)=>{ badge.clear(); badge.fillStyle(hov?0x2a4a7a:0x14243f,0.98); badge.fillCircle(bx+19,by+19,13); badge.lineStyle(2,0x66aaff,hov?1:0.75); badge.strokeCircle(bx+19,by+19,13); };
                drawBadge(false);
                tr(this.add.text(bx+19,by+18,'✦',{fontSize:'16px',color:'#aaccff'}).setOrigin(0.5).setScrollFactor(0).setDepth(47));
                const bhit=tr(this.add.rectangle(bx+19,by+19,30,30,0xffffff,0).setScrollFactor(0).setDepth(48).setInteractive());
                bhit.on('pointerover',()=>drawBadge(true)); bhit.on('pointerout',()=>drawBadge(false));
                bhit.on('pointerdown',p=>{ p.event.stopPropagation(); this._openWispSkillTree(type); });
            }

            // Fire Wisp gets a small mode toggle beneath its card — Multi (spread, mediocre
            // damage per target) vs Single (the old ramp-to-purple-beam, now scaled even higher)
            if(type==='fire'){
                if(this._fireWispMode===undefined) this._fireWispMode='single';
                // Sits INSIDE the card's lower edge — with the tighter row gap, hanging it
                // below the card would overlap the next row.
                const modeBg=tr(this.add.rectangle(bx+cardW/2,by+cardH-11,cardW-10,18,0x0d1622,0.95).setScrollFactor(0).setDepth(43).setInteractive());
                const modeTxt=tr(this.add.text(bx+cardW/2,by+cardH-11,'',{fontSize:'11px',fontFamily:'monospace',color:'#ffaa44',fontStyle:'bold'}).setOrigin(0.5).setScrollFactor(0).setDepth(44));
                const refreshModeTxt=()=>{
                    modeTxt.setText(this._fireWispMode==='single'?'◀ SINGLE ▶':'◀ MULTI ▶');
                    modeTxt.setColor(this._fireWispMode==='single'?'#ffaa44':'#ff6644');
                };
                refreshModeTxt();
                modeBg.on('pointerdown',p=>{
                    p.event.stopPropagation();
                    this._fireWispMode=this._fireWispMode==='single'?'multi':'single';
                    refreshModeTxt();
                    // Switching modes mid-lock clears the current target/ramp so it starts clean
                    const firePet=this.pets?.find(pp=>pp.type==='fire');
                    if(firePet){ firePet._fireTarget=null; firePet._fireRamp=0; firePet._fireMultiTargets=null; }
                });
            }
        });

        tr(this.add.text(px+panelW/2,py+panelH-22,'[R] or [ESC] to close',{fontSize:'12px',fontFamily:'monospace',color:'#556a7a'}).setOrigin(0.5).setScrollFactor(0).setDepth(42));
        this._updateWispRosterLive(); // initial paint
    }

    _updateWispRosterLive(){
        if(!this._wrCardRefs)return;
        const equippedCount=this._equippedWisps?.size||0;
        if(this._wrEquipTxt?.active) this._wrEquipTxt.setText(`Equipped: ${equippedCount}/5 — click to equip/unequip`);
        for(const type in this._wrCardRefs){
            const r=this._wrCardRefs[type];
            if(!r.cardBg?.active)continue;
            const isEquipped=this._equippedWisps?.has(type);
            const pet=isEquipped?this.pets?.find(p=>p.type===type):null;
            // Use the ACTUAL (possibly upgraded) max, not a hardcoded base — otherwise a
            // maxed max-stamina upgrade makes the roster read 100% when it isn't.
            const baseMax=type==='fire'?200:100;
            const maxStam=(isEquipped&&pet?.maxStamina)?pet.maxStamina
                          :(type==='light'&&this._lightMaxStam?this._lightMaxStam:baseMax);
            const stamina=isEquipped?(pet?.stamina??maxStam):(this._wispStamina?.[type]??maxStam);
            const isAsleep=stamina<=0&&!isEquipped;
            const lockoutUntil=this._wispLockoutUntil?.[type]||0;
            const isLockedOut=isAsleep&&this.time.now<lockoutUntil;
            const staminaPct=Math.max(0,Math.min(1,stamina/maxStam));
            r._isEquipped=isEquipped; r._isAsleep=isAsleep;
            r.drawCard(false,isEquipped,isAsleep);
            r.nameTxt.setColor(isAsleep?'#996666':'#ccddee');
            const barCol=isLockedOut?0xff2244:isAsleep?0x553333:staminaPct>0.5?0x44ff88:staminaPct>0.25?0xffdd44:0xff4444;
            r.barFill.width=Math.max(1,88*staminaPct);
            r.barFill.fillColor=barCol;
            const statusStr=isLockedOut?`LOCKED ${Math.ceil((lockoutUntil-this.time.now)/1000)}s`:isAsleep?'Sleeping':isEquipped?'✓ Active':`${Math.round(staminaPct*100)}%`;
            r.statusTxt.setText(statusStr);
            r.statusTxt.setColor(isLockedOut?'#ff6688':isAsleep?'#996666':isEquipped?'#44ffaa':'#7788aa');
        }
    }

    _closeWispRoster(){
        this._wispRosterOpen=false;
        (this._wrObjs||[]).forEach(o=>o?.active&&o.destroy());
        this._wrObjs=[]; this._wrCardRefs=null;
    }

    // ─── WISP MASTERY & SHARDS ─────────────────────────────────────────
    // Mastery is earned from element-APPROPRIATE events, never from raw attack count.
    // Fire intervals span 500ms (Light) to 15000ms (Skyward), so counting attacks would
    // hand Light ~30× the income before stamina drain is even considered, and would make
    // "spam attacks at anything" the optimal play. Tying each wisp's progress to the thing
    // that wisp is FOR — freezes landed, chain hops made, bombs detonated — keeps the rates
    // comparable across wisps AND doubles as a nudge toward playing the wisp correctly.
    // You cannot grind Ice mastery by plinking; you have to actually land freezes.
    //
    // Levels grant shards, which gate CAPSTONES only. Glorps still pay for them. The two
    // currencies do different jobs: Glorps force WHICH capstone (you can't afford them all),
    // shards force whether you actually committed to the wisp.
    //
    // GLYPHS, all distinct on purpose: ✦ Glorps · ◈ Fragments (ShopScene ult upgrades)
    // · ❖ mastery shards. Shards originally reused ◈, which already meant Fragments in
    // the shop — two unrelated currencies rendering identically.
    _masteryNeed(level){ return Math.round(60*Math.pow(1.45,level)); }

    // Returns the live record — callers mutate it, so this must not hand back a fresh object.
    _masteryStore(type){
        if(!this._wispMastery) this._wispMastery={};
        return this._wispMastery[type]||(this._wispMastery[type]={xp:0,level:0,shards:0});
    }

    _addWispMastery(type,amount){
        if(!amount||!type)return;
        const m=this._masteryStore(type);
        m.xp+=amount;
        let leveled=false;
        // while, not if: a single large award can cross more than one threshold.
        while(m.xp>=this._masteryNeed(m.level)){ m.xp-=this._masteryNeed(m.level); m.level++; m.shards++; leveled=true; }
        if(leveled&&this.player?.active)
            this._showFloatingText(this.player.x,this.player.y-46,`❖ ${type.toUpperCase()} MASTERY ${m.level}`,'#ffdd66');
    }

    // ─── WISP SKILL TREES ──────────────────────────────────────────────────────
    // Same linear-branch data shape as the tower _getUpgradeTree (nodes with
    // name/tiers/costFn/requires/exclusive/eff), plus radial metadata (branch angle,
    // colour, label) consumed only by the renderer. Each node's eff() mutates a
    // cumulative scene field once per purchase — never re-derived from scratch — so
    // stacking behaves exactly like the tower trees. Returns null for wisps with no
    // tree yet, which suppresses the roster's skill badge for them.
    _getWispSkillTree(type){
        const TS=this;
        const trees={
            light:{
                title:'LIGHT', icon:'✨', accent:0xaaccff,
                paths:[
                    // ── Branch A — Amplification (the damage-scaling backbone) ──
                    {label:'Amplification', angle:-135, color:0xffee88, ids:['lt_a1','lt_a2','lt_a3','lt_a4','lt_a5'], nodes:[
                        {name:'Focused Beam', tiers:4, costFn:t=>[30,55,90,140][t]||999,
                         desc:t=>{ const f=TS._lightFlat||0;
                                   return `+2 flat damage per hit. Now +${f} → +${f+2} next tier.  ${TS._lightDmgLine()}`; },
                         eff:()=>{ TS._lightFlat=(TS._lightFlat||0)+2; }},
                        {name:'Radiant Core', tiers:5, costFn:t=>[50,90,150,230,340][t]||999, requires:'lt_a1',
                         desc:t=>{ const m=1+(TS._lightDmgAdd||0);
                                   return `+8% Light damage per tier (additive). Now ×${m.toFixed(2)} → ×${(m+0.08).toFixed(2)} next tier.  ${TS._lightDmgLine()}`; },
                         eff:()=>{ TS._lightDmgAdd=(TS._lightDmgAdd||0)+0.08; }},
                        {name:'Concentrated Ray', tiers:4, costFn:t=>[90,150,240,360][t]||999, requires:'lt_a2',
                         desc:t=>{ const m=1+(TS._lightDmgAdd||0);
                                   return `+12% Light damage per tier (additive). Now ×${m.toFixed(2)} → ×${(m+0.12).toFixed(2)} next tier.  ${TS._lightDmgLine()}`; },
                         eff:()=>{ TS._lightDmgAdd=(TS._lightDmgAdd||0)+0.12; }},
                        {name:'Overload Prism', tiers:3, costFn:t=>[160,270,410][t]||999, requires:'lt_a3',
                         desc:t=>{ const m=1+(TS._lightDmgAdd||0);
                                   return `+20% Light damage per tier (additive) — the late-game scaling payoff. Now ×${m.toFixed(2)} → ×${(m+0.20).toFixed(2)} next tier.  ${TS._lightDmgLine()}`; },
                         eff:()=>{ TS._lightDmgAdd=(TS._lightDmgAdd||0)+0.20; }},
                        {name:'Radiant Execution', tiers:2, costFn:t=>[200,340][t]||999, requires:'lt_a4', capstone:true, shardCost:3,
                         desc:t=>t>=1?'CAPSTONE — struck enemies below 16% HP are vaporized (bosses excluded).'
                                     :(t===0?'CAPSTONE — struck enemies below the HP threshold are instantly vaporized (bosses excluded). T1: 10% · T2: 16%.'
                                            :'CAPSTONE — execute threshold 10% → 16%.'),
                         eff:()=>{ TS._lightExecute=true; TS._lightExecThreshold=((TS._wispUpgrades.light?.lt_a5||0)<=1?0.10:0.16); }},
                    ]},
                    // ── Branch B — Conduction (chains & reach — you rebuild the old base here) ──
                    {label:'Conduction', angle:135, color:0x66ccff, ids:['lt_b1','lt_b2','lt_b3','lt_b4','lt_b5'], nodes:[
                        {name:'Longer Reach', tiers:4, costFn:t=>[60,120,210,340][t]||999,
                         desc:t=>{ const c=TS._lightChainLen||2;
                                   return t>=4?`Chain length: ${c} targets (max).`:`+1 chain length per tier. Now ${c} → ${c+1} targets next tier.  ${TS._lightDmgLine()}`; },
                         eff:()=>{ TS._lightChainLen=(TS._lightChainLen||2)+1; }},
                        {name:'Wider Arc', tiers:4, costFn:t=>[50,100,170,260][t]||999, requires:'lt_b1',
                         desc:t=>{ const r=TS._lightJumpRad||5;
                                   return t>=4?`Jump radius: ${r} tiles (max).`:`+1 tile jump radius per tier. Now ${r} → ${r+1} tiles between targets.`; },
                         eff:()=>{ TS._lightJumpRad=(TS._lightJumpRad||5)+1; }},
                        {name:'Amplified Jump', tiers:3, costFn:t=>[70,140,240][t]||999, requires:'lt_b2',
                         desc:t=>{ const c=TS._lightCoeff||4;
                                   return t>=3?`Coefficient: ${c} (max).`:`+2 damage-per-target coefficient. Now ${c} → ${c+2} next tier.  ${TS._lightDmgLine()}`; },
                         eff:()=>{ TS._lightCoeff=(TS._lightCoeff||4)+2; }},
                        {name:'Extra Arc', tiers:2, costFn:t=>[160,320][t]||999, requires:'lt_b3',
                         desc:t=>{ const c=TS._petLightChains||1;
                                   return t>=2?`Simultaneous chains: ${c} (max).`:`+1 simultaneous chain. Now ${c} → ${c+1} chains next tier.`; },
                         eff:()=>{ TS._petLightChains=Math.min(3,(TS._petLightChains||1)+1); }},
                        {name:'Cascade Charge', tiers:1, costFn:_=>400, requires:'lt_b4', capstone:true, shardCost:3,
                         desc:'CAPSTONE — each hop in a chain hits +15% harder than the last (capped 1.6×). Rewards stacking length and count.',
                         eff:()=>{ TS._lightCascade=true; }},
                    ]},
                    // ── Branch C — Radiance (tempo & stamina — the longest branch) ──
                    {label:'Radiance', angle:-45, color:0xffaa44, ids:['lt_c1','lt_c2','lt_c3','lt_c4','lt_c6','lt_c5'], nodes:[
                        {name:'Rapid Pulse', tiers:5, costFn:t=>[40,80,130,200,290][t]||999,
                         desc:t=>{ const cur=TS._lightInterval||500; const nxt=Math.round(cur*0.93);
                                   return t>=5?`Fire interval: ${cur}ms (max).`:`-7% fire interval per tier. Now ${cur}ms → ${nxt}ms next tier.`; },
                         eff:()=>{ TS._lightInterval=Math.round((TS._lightInterval||500)*0.93); TS._syncLightPets(); }},
                        {name:'Efficient Optics', tiers:6, costFn:t=>[30,60,100,150,210,280][t]||999, requires:'lt_c1',
                         desc:t=>{ const cur=TS._lightDrain??5; const nxt=Math.max(2,cur-0.5);
                                   return t>=6?`Stamina drain: ${cur}/attack (max).`:`-0.5 stamina drain per attack. Now ${cur} → ${nxt} next tier. (Core uptime line.)`; },
                         eff:()=>{ TS._lightDrain=Math.max(2,(TS._lightDrain??5)-0.5); TS._syncLightPets(); }},
                        {name:'Overcharge Cells', tiers:3, costFn:t=>[60,120,200][t]||999, requires:'lt_c2',
                         desc:t=>{ const cur=TS._lightMaxStam||100; const nxt=cur+20;
                                   return t>=3?`Max stamina: ${cur} (max).`:`+20 max stamina per tier. Now ${cur} → ${nxt} next tier — longer bursts before lockout.`; },
                         eff:()=>{ TS._lightMaxStam=(TS._lightMaxStam||100)+20; TS._syncLightPets();
                                   // Top up current stamina to the new max on all light wisps and
                                   // the stored roster value, so the upgrade fills the bar rather
                                   // than leaving it at a partial percentage.
                                   for(const p of (TS.pets||[])) if(p.type==='light'){ p.maxStamina=TS._lightMaxStam; p.stamina=TS._lightMaxStam; }
                                   if(TS._wispStamina) TS._wispStamina.light=TS._lightMaxStam; }},
                        {name:'Sear', tiers:3, costFn:t=>[70,140,230][t]||999, requires:'lt_c3',
                         desc:t=>{ const tiers=TS._lightBrandMax||0;
                                   return t>=3?`Brand reaches tier 3 (−82% stamina on a fully seared enemy).`
                                             :`Light BRANDS enemies it hits with holy numerals. Each hit on the same enemy raises its brand (up to tier ${(TS._lightBrandMax||0)+1}), and attacking a branded enemy costs far less stamina (−28%/−55%/−82%). Rewards focusing a durable target — Light's endurance identity.`; },
                         eff:()=>{ TS._lightBrand=true; TS._lightBrandMax=Math.min(3,(TS._lightBrandMax||0)+1); }},
                        {name:'Lightspeed', tiers:1, costFn:_=>400, requires:'lt_c4',
                         desc:t=>{ const r=TS._lightJumpRad||5;
                                   return t>=1?`Beams travel very fast. Chain reach ${r+4} tiles.`:`Beams travel much faster (the bolt still visibly arcs down the chain, just quick) and reach goes ${r} → ${r+4} tiles.`; },
                         eff:()=>{ TS._lightInstant=true; }},
                        {name:'Solar Flare', tiers:1, costFn:_=>420, requires:'lt_c6', capstone:true, shardCost:3,
                         desc:'CAPSTONE — every 5th cast supercharges: all chains ×2.5 damage and +2 length',
                         eff:()=>{ TS._lightSolarFlare=true; }},
                    ]},
                    // ── Branch D — Revelation (anti-stealth + pass-through). Spoke points down. ──
                    {label:'Revelation', angle:45, color:0xccffff, ids:['lt_d1','lt_d2'], nodes:[
                        {name:'Revealing Light', tiers:2, costFn:t=>[200,380][t]||999,
                         desc:'Light DETECTS the nearest cloaked enemy and, on a long cooldown, fires a golden beam that travels to it and exposes it. A precious, limited answer to stealth — not a blanket reveal. Tier 2: larger detection range, shorter cooldown.',
                         eff:()=>{
                             const owned=(TS._wispUpgrades.light?.lt_d1||0);
                             if(owned<=1){ TS._lightRevealRadius=6;  TS._lightRevealCd=7500; TS._lightRevealDur=5000; }
                             else        { TS._lightRevealRadius=9;  TS._lightRevealCd=6000; TS._lightRevealDur=5500; }
                         }},
                        {name:'Cascading Halo', tiers:1, costFn:_=>500, requires:'lt_d1', capstone:true, shardCost:4,
                         desc:'MILESTONE — a revealed enemy sprouts a brilliant halo that leaps (with a brief delay each jump) to nearby cloaked enemies, revealing and chipping them. Chains up to 3 jumps — 4 exposed per beam. Turns a hidden cluster against itself.',
                         eff:()=>{ TS._lightRevealChain=true; }},
                    ]},
                ],
            },
            // Five branches, one theme each. The old cut folded the player's water-trail
            // mobility nodes (Wake / Slipstream / Frostwalker) into the freeze branch, which
            // meant Rime was simultaneously "make freezing better" and "make YOU faster" —
            // two unrelated fantasies competing for the same points. Movement is now its own
            // spoke, and Rime is purely the freeze engine.
            //
            // Angles are the 5 points of a 72°-spaced star rotated to put a spoke straight up.
            // Wake sits on the vertical because it is the shortest branch and the vertical
            // has the least room; per-spoke R (see _openWispSkillTree) handles the rest.
            ice:{
                title:'ICE', icon:'❄', accent:0x88ddff,
                paths:[
                    // ── RIME — the freeze engine. Nothing here touches the player. ──
                    {label:'Rime', angle:-18, color:0x88ddff, ids:['ic_a1','ic_a2','ic_a3','ic_a4'], nodes:[
                        {name:'Hoarfrost', tiers:5, costFn:t=>[40,75,120,180,260][t]||999,
                         desc:t=>{ const c=Math.round(((TS._iceFreezeChance||0.15)+(TS._iceFreezeBonus||0))*100);
                                   return t>=5?`Freeze chance: ${c}% (max).`:`+5% freeze chance per hit. Now ${c}% → ${c+5}% next tier.`; },
                         eff:()=>{ TS._iceFreezeBonus=(TS._iceFreezeBonus||0)+0.05; }},
                        {name:'Glaciate', tiers:4, costFn:t=>[60,110,180,270][t]||999, requires:'ic_a1',
                         desc:t=>{ const d=((TS._iceFreezeDur||4000)/1000).toFixed(1);
                                   return t>=4?`Freeze window: ${d}s (max).`:`+0.5s freeze window — more time to land the shatter. Now ${d}s → ${(+d+0.5).toFixed(1)}s.`; },
                         eff:()=>{ TS._iceFreezeDur=(TS._iceFreezeDur||4000)+500; }},
                        {name:'Waterlogged', tiers:3, costFn:t=>[90,160,250][t]||999, requires:'ic_a2',
                         desc:t=>{ const b=Math.round((TS._iceWetFreezeBonus||0.35)*100);
                                   return t>=3?`Wet freeze bonus: +${b}% (max).`:`Wet enemies freeze much more readily. +15% wet freeze bonus. Now +${b}% → +${b+15}%.`; },
                         eff:()=>{ TS._iceWetFreezeBonus=(TS._iceWetFreezeBonus||0.35)+0.15; }},
                        {name:'Deep Freeze', tiers:1, costFn:_=>440, requires:'ic_a3', capstone:true, shardCost:3,
                         desc:'CAPSTONE — Ice stops rotating between targets and LOCKS the toughest enemy in range. Against that target freeze chance and freeze duration are both DOUBLED. The single-target answer to a tanky threat, and a deliberate fork away from spreading freezes across a crowd.',
                         eff:()=>{ TS._iceDeepFreeze=true; }},
                    ]},
                    // ── WAKE — player mobility. The only branch that buffs YOU, not the beam. ──
                    {label:'Wake', angle:-90, color:0x55ccdd, ids:['ic_b1','ic_b2','ic_b3'], nodes:[
                        {name:'Wake', tiers:1, costFn:_=>140,
                         desc:'You leave a short-lived water trail (~2s) on the tiles behind you as you move.',
                         eff:()=>{ TS._iceWake=true; }},
                        {name:'Slipstream', tiers:3, costFn:t=>[80,150,240][t]||999, requires:'ic_b1',
                         desc:t=>{ const b=Math.round((TS._iceSlipMax||0)*100);
                                   return t>=3?`Water speed: up to +${b}% (max) — ramps the longer you stay on water.`
                                              :`Standing on ANY water speeds you up — and it RAMPS the longer you stay on it (doubling back / circling = fast). +8% per tier. Now +${b}%.`; },
                         eff:()=>{ TS._iceSlipstream=true; TS._iceSlipMax=(TS._iceSlipMax||0)+0.08; }},
                        {name:'Frostwalker', tiers:1, costFn:_=>420, requires:'ic_b2', capstone:true, shardCost:3,
                         desc:'CAPSTONE — your water trail FLASH-FREEZES 2s after you lay it: enemies on it take damage, become brittle, and can freeze. Walk the battlefield and freeze in your wake.',
                         eff:()=>{ TS._iceFrostwalker=true; }},
                    ]},
                    // ── DELUGE — the terrain branch: puddle size, slow, lifetime. ──
                    {label:'Deluge', angle:54, color:0x66bbee, ids:['ic_c1','ic_c2','ic_c3','ic_c4'], nodes:[
                        {name:'Floodplain', tiers:4, costFn:t=>[40,80,140,220][t]||999,
                         desc:t=>{ const s=Math.round((TS._icePuddleSlow||0.4)*100);
                                   return t>=4?`Puddle slow: ${s}% (max).`:`+7% puddle slow. Now ${s}% → ${s+7}% next tier.`; },
                         eff:()=>{ TS._icePuddleSlow=Math.min(0.85,(TS._icePuddleSlow||0.4)+0.07); }},
                        {name:'Tidal Reach', tiers:2, costFn:t=>[110,200][t]||999, requires:'ic_c1',
                         desc:t=>{ const r=TS._icePuddleRadius||1;
                                   return t>=2?`Puddle size: ${r*2+1}×${r*2+1} (max).`:`+1 puddle radius. Now ${r*2+1}× → ${(r+1)*2+1}× wide (bigger connected bodies for Flash Freeze).`; },
                         eff:()=>{ TS._icePuddleRadius=(TS._icePuddleRadius||1)+1; }},
                        {name:'Standing Water', tiers:3, costFn:t=>[70,130,210][t]||999, requires:'ic_c2',
                         desc:t=>{ const d=((TS._icePuddleDur||4000)/1000).toFixed(1);
                                   return t>=3?`Puddle duration: ${d}s (max).`:`+1s puddle duration. Now ${d}s → ${(+d+1).toFixed(1)}s.`; },
                         eff:()=>{ TS._icePuddleDur=(TS._icePuddleDur||4000)+1000; }},
                        {name:'Flash Freeze', tiers:1, costFn:_=>420, requires:'ic_c3', capstone:true, shardCost:3,
                         desc:'CAPSTONE — 2s after a puddle forms, an enemy standing in it snaps the ENTIRE connected water body to ice at once: everyone caught takes damage, becomes brittle, and can freeze. Bigger pools = bigger payoffs.',
                         eff:()=>{ TS._iceFlashFreeze=true; }},
                    ]},
                    // ── DOUSE — wet as a support debuff: lingering, anti-heal, frost DoT. ──
                    {label:'Douse', angle:126, color:0x4499cc, ids:['ic_d1','ic_d2','ic_d3','ic_d4'], nodes:[
                        {name:'Drench', tiers:3, costFn:t=>[50,100,170][t]||999,
                         desc:t=>{ const d=((TS._iceWetDur||1500)/1000).toFixed(1);
                                   return t>=3?`Wet duration: ${d}s (max).`:`+0.6s wet duration (wet lingers after leaving water). Now ${d}s → ${(+d+0.6).toFixed(1)}s.`; },
                         eff:()=>{ TS._iceWetDur=(TS._iceWetDur||1500)+600; }},
                        {name:'Waterlog', tiers:2, costFn:t=>[120,220][t]||999, requires:'ic_d1',
                         desc:t=>{ const r=Math.round((TS._iceWetHealCut||0)*100);
                                   return t>=2?`Wet healing reduction: ${r}% (max).`:`Wet enemies receive 20% less healing per tier — douses the Angel's ring and any regen. Now −${r}%.`; },
                         eff:()=>{ TS._iceWetHealCut=Math.min(0.4,(TS._iceWetHealCut||0)+0.2); }},
                        {name:'Frostbite', tiers:3, costFn:t=>[70,130,210][t]||999, requires:'ic_d2',
                         desc:t=>{ const d=(TS._iceFrostbiteDps||0);
                                   return t>=3?`Frost DoT: ${d}/s on wet enemies (max).`:`Wet enemies take a small frost DoT. +1/s per tier. Now ${d}/s.`; },
                         eff:()=>{ TS._iceFrostbiteDps=(TS._iceFrostbiteDps||0)+1; }},
                        {name:'Subzero', tiers:1, costFn:_=>380, requires:'ic_d3', capstone:true, shardCost:3,
                         desc:'CAPSTONE — brittle deals bonus damage against ARMORED enemies (armour cracks in the cold). A targeted answer to knights and bulwarks.',
                         eff:()=>{ TS._iceSubzero=true; }},
                    ]},
                    // ── SHATTERPOINT — the brittle payoff branch. ──
                    {label:'Shatterpoint', angle:-162, color:0xcceeff, ids:['ic_e1','ic_e2','ic_e3','ic_e4'], nodes:[
                        {name:'Fault Lines', tiers:4, costFn:t=>[60,110,180,270][t]||999,
                         desc:t=>{ const m=Math.round(((TS._brittleMult||1.75)-1)*100);
                                   return t>=4?`Brittle amp: +${m}% (max).`:`+10% brittle amp (the next non-ice hit hits harder). Now +${m}% → +${m+10}%.`; },
                         eff:()=>{ TS._brittleMult=(TS._brittleMult||1.75)+0.10; }},
                        {name:'Splinter', tiers:2, costFn:t=>[100,190][t]||999, requires:'ic_e1',
                         desc:t=>{ const r=TS._iceShatterBrittleR||1.5;
                                   return t>=2?`Shatter radius: ${r} tiles (max).`:`+0.75 tile shatter radius (brittles more enemies). Now ${r} → ${(r+0.75).toFixed(2)} tiles.`; },
                         eff:()=>{ TS._iceShatterBrittleR=(TS._iceShatterBrittleR||1.5)+0.75; }},
                        {name:'Cascade', tiers:3, costFn:t=>[90,160,250][t]||999, requires:'ic_e2',
                         desc:t=>{ const c=Math.round((TS._iceCascadeChance||0)*100);
                                   return t>=3?`Chain-shatter chance: ${c}% (max).`:`A shatter can chain to nearby FROZEN enemies. +20% per tier. Now ${c}%.`; },
                         eff:()=>{ TS._iceCascadeChance=(TS._iceCascadeChance||0)+0.20; }},
                        {name:'Shatterstorm', tiers:1, costFn:_=>400, requires:'ic_e3', capstone:true, shardCost:3,
                         desc:'CAPSTONE — brittle now applies to 2 damage instances instead of 1 before it is consumed — a far longer payoff window.',
                         eff:()=>{ TS._brittleCharges=2; }},
                    ]},
                ],
            },
        };
        return trees[type]||null;
    }

    // Live readout of Light's current damage per hit at full chain length, mirroring the
    // combat formula: (10 + chainLen*coeff + flat) * petDmgMult * lightMult.
    // Used by the skill-tree descriptions so numbers update as tiers are bought.
    _lightDmgLine(){
        const len=this._lightChainLen||2, coeff=this._lightCoeff||4, flat=this._lightFlat||0;
        const lmult=1+(this._lightDmgAdd||0), gmult=this._petDmgMult||1;
        const dmg=(10+len*coeff+flat)*lmult*gmult;
        return `[Now: ${dmg.toFixed(0)} dmg/hit at ${len}-chain]`;
    }

    // Push live interval/drain changes onto an already-equipped Light pet so purchases
    // take effect immediately rather than only after the next respawn.
    _syncLightPets(){
        const p=this.pets?.find(pp=>pp.type==='light');
        if(p) this._applyWispStats(p);
    }

    _openWispSkillTree(type){
        const tree=this._getWispSkillTree(type);
        if(!tree)return;
        this._closeAllPanels('tree');
        this._closeWispSkillTree();
        this._wispTreeOpen=true;
        const objs=this._wtObjs=[]; const tr=o=>{objs.push(o);return o;};
        const W=this.scale.width,H=this.scale.height;
        const cx=W/2, cy=H/2;
        // Panel now fills most of the screen (was a 620px square) so nodes and text can breathe.
        const PW=Math.min(W*0.96,1060), PH=Math.min(H*0.96,860);
        const px=cx-PW/2, py=cy-PH/2;
        const accentHex='#'+tree.accent.toString(16).padStart(6,'0');

        // Dim + click-out to close
        tr(this.add.rectangle(cx,cy,W,H,0x000000,0.72).setScrollFactor(0).setDepth(50)
            .setInteractive().on('pointerdown',()=>this._closeWispSkillTree()));
        const bg=tr(this.add.graphics().setScrollFactor(0).setDepth(51));
        bg.fillStyle(0x070b12,0.98); bg.fillRoundedRect(px,py,PW,PH,14);
        bg.lineStyle(2,tree.accent,0.55); bg.strokeRoundedRect(px,py,PW,PH,14);

        // ── Header: title · ESC hint (moved here, out of the info panel) · Glorps ──
        tr(this.add.text(px+22,py+24,`${tree.icon}  ${tree.title} — SKILL TREE`,
            {fontSize:'20px',fontFamily:UIKit.FONT.title,color:accentHex,fontStyle:'bold',stroke:'#000',strokeThickness:3})
            .setOrigin(0,0.5).setScrollFactor(0).setDepth(53));
        tr(this.add.text(cx,py+24,'[ESC] close',{fontSize:'12px',fontFamily:'monospace',color:'#5a6a7a'})
            .setOrigin(0.5).setScrollFactor(0).setDepth(53));
        const scrapTxt=tr(this.add.text(px+PW-22,py+18,`✦ ${this.glorps||0}`,
            {fontSize:'19px',fontFamily:UIKit.FONT.title,color:'#ccffff',fontStyle:'bold',stroke:'#000',strokeThickness:2})
            .setOrigin(1,0.5).setScrollFactor(0).setDepth(53));
        // Mastery readout sits on its own line — the currency line is right-aligned against
        // the centred [ESC] hint and has no room to grow.
        const masteryTxt=tr(this.add.text(px+PW-22,py+38,'',
            {fontSize:'12px',fontFamily:'monospace',color:'#ffdd66',stroke:'#000',strokeThickness:2})
            .setOrigin(1,0.5).setScrollFactor(0).setDepth(53));

        // ── Info panel: fixed block at the bottom, generous height so wrapped text can't
        // collide with anything. Scrolls internally if the description overflows. ──
        // ── Info panel: fixed block at the bottom. Descriptions are short (≤3 lines at
        // this wrap width), so no mask/scroll is needed — and a geometry mask would be
        // WRONG here: mask graphics live in world space, but this text is pinned to the
        // screen with setScrollFactor(0). With the camera centred on the base the mask
        // ended up ~1400px away and clipped the description away entirely. ──
        const infoH=130;
        const infoTop=py+PH-infoH;
        const infoDiv=tr(this.add.graphics().setScrollFactor(0).setDepth(52));
        infoDiv.fillStyle(0x0a121c,0.95); infoDiv.fillRoundedRect(px+12,infoTop,PW-24,infoH-12,10);
        infoDiv.lineStyle(1,0x1e3245,1);  infoDiv.strokeRoundedRect(px+12,infoTop,PW-24,infoH-12,10);
        const infoName=tr(this.add.text(cx,infoTop+22,'Hover a node',{fontSize:'18px',fontFamily:UIKit.FONT.title,color:'#ccd8ee',fontStyle:'bold'}).setOrigin(0.5).setScrollFactor(0).setDepth(53));
        const infoDesc=tr(this.add.text(cx,infoTop+46,'Tap an unlocked node to spend ✦ Glorps.',{fontSize:'14px',fontFamily:'monospace',color:'#8a9bb0',align:'center',wordWrap:{width:PW-80},lineSpacing:4}).setOrigin(0.5,0).setScrollFactor(0).setDepth(53));
        const setInfo=(name,desc,col)=>{
            if(infoName.active){infoName.setText(name);infoName.setColor(col||'#ccd8ee');}
            if(infoDesc.active) infoDesc.setText(desc||'');
        };

        // Radial wheel occupies the space between the header and the info panel.
        // R is derived from the branches' ACTUAL angles: a spoke pointing straight up is
        // limited by panel height, but a diagonal spoke costs only sin(angle) vertically,
        // so diagonals let the wheel grow ~1.4x. Clearance covers node radius + cost tag +
        // branch label. Without this the 5-node branches physically overlapped.
        const wheelTop=py+56, wheelBot=infoTop-16;
        const cy2=(wheelTop+wheelBot)/2;
        const halfH=(wheelBot-wheelTop)/2, halfW=PW/2-24;
        const CLEAR=90;
        // R is computed PER SPOKE rather than once for the whole wheel. A single global R
        // takes the worst direction and applies it everywhere, so adding one near-vertical
        // branch shrank every diagonal branch too — which is what blocked a 5th spoke.
        // Each spoke now spends only its own directional budget.
        const rFor=angDeg=>{
            const a=angDeg*Math.PI/180;
            const sin=Math.max(0.15,Math.abs(Math.sin(a)));
            const cos=Math.max(0.15,Math.abs(Math.cos(a)));
            return Math.max(120,Math.min((halfH-CLEAR)/sin,(halfW-CLEAR)/cos));
        };
        const pathR=tree.paths.map(pp=>rFor(pp.angle));
        // Node distance along each spoke. Spans 0.28→1.0 of that spoke's R.
        const frFor=n=>n>1?Array.from({length:n},(_,i)=>0.28+0.72*(i/(n-1))):[0.64];
        // Node radius is DERIVED from the tightest spoke's node spacing, so circles never
        // overlap on smaller screens (a fixed radius did). Budget: two adjacent nodes plus
        // their 3px halos plus a small gap. Capstones are 5px larger.
        const tightest=Math.min(...tree.paths.map((p,pi)=>p.nodes.length>1?pathR[pi]*(frFor(p.nodes.length)[1]-frFor(p.nodes.length)[0]):999));
        const NR=Math.max(12,Math.min(22,Math.floor((tightest-16)/2)));
        const NRC=NR+5;
        const fBig=NR>=19, glyphF=fBig?'16px':'12px', capF=fBig?'24px':'17px', costF=fBig?'14px':'11px';

        let nodeObjs=[];
        const rebuild=()=>{
            nodeObjs.forEach(o=>{const i=objs.indexOf(o);if(i!==-1)objs.splice(i,1);o?.active&&o.destroy();});
            nodeObjs=[];
            const nt=o=>{nodeObjs.push(o);objs.push(o);return o;};
            const mNow=this._masteryStore(type);
            if(scrapTxt.active)   scrapTxt.setText(`✦ ${this.glorps||0}    ❖ ${mNow.shards}`);
            if(masteryTxt.active) masteryTxt.setText(`${tree.title} MASTERY ${mNow.level}   ${mNow.xp}/${this._masteryNeed(mNow.level)} to next ❖`);
            const store=this._wispUpgrades[type]||(this._wispUpgrades[type]={});

            // Spokes + connectors first (under nodes)
            tree.paths.forEach((path,pi)=>{
                const ang=path.angle*Math.PI/180;
                const fr=frFor(path.nodes.length);
                const RR=pathR[pi];
                let prevX=cx, prevY=cy2, prevPurchased=true;
                path.nodes.forEach((node,ti)=>{
                    const rr=RR*fr[ti];
                    const nx=cx+Math.cos(ang)*rr, ny=cy2+Math.sin(ang)*rr;
                    const purchased=store[path.ids[ti]]||0;
                    const cg=nt(this.add.graphics().setScrollFactor(0).setDepth(51.5));
                    cg.lineStyle(node.capstone?5:4,path.color,prevPurchased?(purchased>0?0.9:0.42):0.16);
                    cg.lineBetween(prevX,prevY,nx,ny);
                    prevX=nx; prevY=ny; prevPurchased=purchased>0;
                });
            });

            // Hub — the wisp gem
            const hub=nt(this.add.graphics().setScrollFactor(0).setDepth(52));
            const hr=Math.round(NR*1.05);
            hub.fillStyle(tree.accent,0.16); hub.fillCircle(cx,cy2,hr*1.85);
            hub.fillStyle(0x04070c,1);      hub.fillCircle(cx,cy2,hr+4);
            hub.fillStyle(0xffffff,0.96);   hub.fillCircle(cx,cy2,hr);
            hub.lineStyle(2.5,tree.accent,0.95); hub.strokeCircle(cx,cy2,hr);
            for(let i=0;i<5;i++){ const a=(i/5)*Math.PI*2-Math.PI/2; hub.lineStyle(1.5,0xffffff,0.5); hub.lineBetween(cx,cy2,cx+Math.cos(a)*(hr-2),cy2+Math.sin(a)*(hr-2)); }
            nt(this.add.text(cx,cy2,tree.icon,{fontSize:(NR>=19?'26px':'18px')}).setOrigin(0.5).setScrollFactor(0).setDepth(53));

            // Nodes
            tree.paths.forEach((path,pi)=>{
                const ang=path.angle*Math.PI/180;
                const fr=frFor(path.nodes.length);
                const RR=pathR[pi];
                const pcHex='#'+path.color.toString(16).padStart(6,'0');
                // Branch label just past the last node
                // Branch label sits clear of the outermost node AND its cost/lock tag.
                // The tag is drawn at ny+nr+15 and is ~15px tall, so we must clear nr+30.
                const lastNr=path.nodes[path.nodes.length-1].capstone?NRC:NR;
                const lr=RR*fr[fr.length-1]+lastNr+40;
                nt(this.add.text(cx+Math.cos(ang)*lr,cy2+Math.sin(ang)*lr,path.label,
                    {fontSize:'16px',fontFamily:UIKit.FONT.title,color:pcHex,fontStyle:'bold',stroke:'#000',strokeThickness:3})
                    .setOrigin(0.5).setScrollFactor(0).setDepth(53));

                path.nodes.forEach((node,ti)=>{
                    const rr=RR*fr[ti];
                    const nx=cx+Math.cos(ang)*rr, ny=cy2+Math.sin(ang)*rr;
                    const nodeId=path.ids[ti];
                    const store2=this._wispUpgrades[type];
                    const purchased=store2[nodeId]||0;
                    const maxed=purchased>=node.tiers;
                    const prereq=!node.requires||(store2[node.requires]||0)>0;
                    const cost=node.costFn(purchased);
                    const canAfford=(this.glorps||0)>=cost;
                    const unlocked=prereq&&!maxed;
                    // Shard gate folds into `available` so an unaffordable capstone doesn't
                    // glow as purchasable just because the Glorp cost is covered.
                    const shardNeedEarly=node.shardCost||0;
                    const available=unlocked&&canAfford&&(!shardNeedEarly||this._masteryStore(type).shards>=shardNeedEarly);
                    const nr=node.capstone?NRC:NR;

                    const ng=nt(this.add.graphics().setScrollFactor(0).setDepth(52.5));
                    const drawNode=(hov)=>{
                        ng.clear();
                        // Fills are lifted well clear of the panel bg (luminance ~11) so the
                        // circles actually read; locked nodes stay dim but still visible.
                        const fill=maxed?0x0e3a20:!prereq?0x151b26:hov?0x2a4463:0x1c2c40;
                        const border=maxed?0x55ffa0:!prereq?0x39485c:(hov&&available?0xffffff:path.color);
                        const bAlpha=maxed?1:prereq?(available?1:0.75):0.6;
                        // Dark halo first: separates the node from the spoke line running under it.
                        ng.fillStyle(0x04070c,1); ng.fillCircle(nx,ny,nr+3);
                        // Soft accent glow so buyable nodes pop.
                        if(available) { ng.fillStyle(path.color,hov?0.30:0.16); ng.fillCircle(nx,ny,nr+3); }
                        if(node.capstone){
                            ng.fillStyle(fill,1); ng.fillCircle(nx,ny,nr);
                            ng.lineStyle(3,border,bAlpha); ng.strokeCircle(nx,ny,nr);
                            for(let i=0;i<8;i++){ const a=(i/8)*Math.PI*2; ng.lineStyle(2,border,bAlpha*0.85); ng.lineBetween(nx+Math.cos(a)*nr,ny+Math.sin(a)*nr,nx+Math.cos(a)*(nr+6),ny+Math.sin(a)*(nr+6)); }
                        } else {
                            ng.fillStyle(fill,1); ng.fillCircle(nx,ny,nr);
                            ng.lineStyle(2.5,border,bAlpha); ng.strokeCircle(nx,ny,nr);
                        }
                        // Inner highlight ring gives the disc some depth.
                        ng.lineStyle(1,0xffffff,prereq?0.14:0.05); ng.strokeCircle(nx,ny,nr-4);
                        // tier pips (small dots under the node)
                        if(node.tiers>1) for(let t=0;t<node.tiers;t++){
                            const px2=nx-((node.tiers-1)*8)/2+t*8;
                            ng.fillStyle(t<purchased?path.color:0x2e3d4f,1);
                            ng.fillCircle(px2,ny+nr+9,3.2);
                        }
                    };
                    drawNode(false);

                    // glyph: capstone star, else tier count or check
                    const glyph=node.capstone?'★':maxed?'✓':`${purchased}/${node.tiers}`;
                    nt(this.add.text(nx,ny-1,glyph,{fontSize:node.capstone?capF:glyphF,fontFamily:'monospace',
                        color:maxed?'#7dffbe':prereq?'#ffffff':'#5a6b7d',fontStyle:'bold'}).setOrigin(0.5).setScrollFactor(0).setDepth(53));
                    // cost tag
                    const shardNeed=node.shardCost||0;
                    const haveShards=this._masteryStore(type).shards;
                    const shardOk=!shardNeed||haveShards>=shardNeed;
                    const costStr=maxed?'MAX':!prereq?'LOCKED':(shardNeed?`${cost}✦ ${shardNeed}❖`:`${cost}✦`);
                    const costCol=maxed?'#55ffa0':!prereq?'#6a7788':(canAfford&&shardOk)?'#ffdd44':'#9a7a45';
                    nt(this.add.text(nx,ny+nr+15,costStr,{fontSize:costF,fontFamily:'monospace',color:costCol,fontStyle:'bold',stroke:'#04070c',strokeThickness:3})
                        .setOrigin(0.5,0).setScrollFactor(0).setDepth(53));

                    // hit area — invisible rectangle (matches the roster/tower-menu pattern)
                    // Hit area matches the halo (nr+3); larger would overlap the neighbouring node.
                    const hit=nt(this.add.rectangle(nx,ny,(nr+3)*2,(nr+3)*2,0xffffff,0).setScrollFactor(0).setDepth(54).setInteractive());
                    // desc may be a string OR a function(purchasedTiers) so nodes can show
                    // live "current → next" values that update as you buy tiers.
                    const descFor=t=>typeof node.desc==='function'?node.desc(t):node.desc;
                    hit.on('pointerover',()=>{ drawNode(true); setInfo(node.name+(node.tiers>1?`  (${purchased}/${node.tiers})`:''),descFor(purchased),available?pcHex:(maxed?'#44ff88':'#889')); });
                    hit.on('pointerout',()=>{ drawNode(false); });
                    // Always handle the click so the player gets a REASON when they can't buy,
                    // instead of the click silently doing nothing.
                    hit.on('pointerdown',p=>{
                        p.event.stopPropagation();
                        if(maxed){ setInfo(node.name,'✓ Fully upgraded. '+descFor(purchased),'#44ff88'); return; }
                        if(!prereq){ setInfo(node.name,'Locked: buy the previous node on this branch first.','#cc9955'); return; }
                        const c=node.costFn(this._wispUpgrades[type][nodeId]||0);
                        // Capstones additionally cost MASTERY SHARDS, earned by actually
                        // playing this wisp. Checked before Glorps so the player sees the
                        // commitment requirement rather than a generic "can't afford".
                        const sc=node.shardCost||0;
                        const mstore=this._masteryStore(type);
                        if(sc && mstore.shards<sc){
                            setInfo(node.name,`Needs ${sc} ❖ ${type} shards — you have ${mstore.shards}. Shards come from ${type.toUpperCase()} MASTERY levels, earned by using this wisp well (currently level ${mstore.level}, ${mstore.xp}/${this._masteryNeed(mstore.level)} to next).`,'#ff7755');
                            return;
                        }
                        if((this.glorps||0)<c){ setInfo(node.name,`Not enough Glorps — need ${c} ✦ (you have ${this.glorps||0} ✦). Earn Glorps from kills and wave clears.`,'#ff7755'); return; }
                        this.glorps-=c;
                        if(sc) mstore.shards-=sc;
                        this._wispUpgrades[type][nodeId]=(this._wispUpgrades[type][nodeId]||0)+1;
                        node.eff(this);
                        this._showFloatingText(this.player.x,this.player.y-30,`↑ ${node.name}`,pcHex);
                        rebuild();
                        // Re-render the info panel AFTER eff() ran, so the readout shows the
                        // new current value and the next tier's value (rebuild() alone would
                        // leave the pre-purchase text on screen).
                        const nowT=this._wispUpgrades[type][nodeId];
                        const nowMax=nowT>=node.tiers;
                        setInfo(node.name+(node.tiers>1?`  (${nowT}/${node.tiers})`:''),
                                (nowMax?'✓ Fully upgraded. ':'')+descFor(nowT),
                                nowMax?'#44ff88':pcHex);
                    });
                });
            });
        };
        rebuild();
    }

    _closeWispSkillTree(){
        this._wispTreeOpen=false;
        (this._wtObjs||[]).forEach(o=>o?.active&&o.destroy());
        this._wtObjs=[];
    }

    _ownWisp(type){
        if(!this._ownedWisps) this._ownedWisps=new Set();
        if(!this._equippedWisps) this._equippedWisps=new Set();
        if(!this._wispStamina) this._wispStamina={};
        this._spawnWispBeds();
        this._ownedWisps.add(type);
        this._wispStamina[type]=type==='fire'?200:100;
        if((this._equippedWisps?.size||0)<5){
            this._equipWisp(type,true); // skip fly animation on first purchase
        } else {
            this._spawnRestingWisp(type);
        }
        this._refreshShopUI();
    }

    _spawnRestingWisp(type){
        if(this._restingWisps?.[type])return;
        const bed=this._wispBeds?.[type]; if(!bed)return;
        bed.occupied=true;
        const colors={light:0xffffff,ice:0x88ddff,boom:0xff8844,fire:0xff4422,fist:0xff6622,void:0xaa00ff,poison:0x44cc44,skyward:0xffdd44,phantom:0xccaaff,life:0xff88bb};
        const g=this.add.graphics().setDepth(0.75);
        const staminaGfx=this.add.graphics().setDepth(0.78);
        if(!this._restingWisps) this._restingWisps={};
        this._restingWisps[type]={gfx:g,staminaGfx,bx:bed.x,by:bed.y,col:colors[type]||0xffffff};
    }

    _despawnRestingWisp(type){
        const r=this._restingWisps?.[type];
        if(!r)return;
        r.gfx?.destroy(); r.staminaGfx?.destroy();
        delete this._restingWisps[type];
        if(this._wispBeds?.[type]) this._wispBeds[type].occupied=false;
    }

    _equipWisp(type,skipFlyIn){
        if(!this._ownedWisps?.has(type))return;
        if(this._equippedWisps?.has(type))return;
        const lockoutUntil=this._wispLockoutUntil?.[type]||0;
        if(this.time.now<lockoutUntil){
            const secsLeft=Math.ceil((lockoutUntil-this.time.now)/1000);
            this._showFloatingText(this.player.x,this.player.y-30,`Crashed — ${secsLeft}s left`,'#ff8888');
            return;
        }
        if((this._wispStamina?.[type]??100)<=0){
            this._showFloatingText(this.player.x,this.player.y-30,'Still recharging...','#888899');
            return;
        }
        if((this._equippedWisps?.size||0)>=5){
            this._showFloatingText(this.player.x,this.player.y-30,'Max 5 wisps!','#ff4444');
            return;
        }
        // If this wisp is mid-flight back to its bed, just redirect it — don't spawn a duplicate
        const flyingPet=this.pets?.find(p=>p.type===type&&p._flyingToBed);
        if(flyingPet){
            flyingPet._flyingToBed=false;
            flyingPet._flyingIn=true;
            flyingPet._flyFromX=flyingPet.gfx?.lastBedX??flyingPet.gfx?.lastX??this.player.x;
            flyingPet._flyFromY=flyingPet.gfx?.lastBedY??flyingPet.gfx?.lastY??this.player.y;
            this._equippedWisps.add(type);
            return;
        }
        // If this wisp is still sleeping/recharging in its bed (post-lockout burst included),
        // wake it directly rather than spawning a second pet object — same root cause as above.
        const sleepingPet=this.pets?.find(p=>p.type===type&&(p._sleeping||p._travelingToSleep));
        if(sleepingPet){
            sleepingPet._sleeping=false;
            sleepingPet._travelingToSleep=false;
            sleepingPet._lockoutBurstGiven=false;
            const bed=this._wispBeds?.[type];
            const wakeX=bed?.x??sleepingPet.gfx?.lastX??this.player.x;
            const wakeY=bed?.y??sleepingPet.gfx?.lastY??this.player.y;
            sleepingPet._flyingIn=true;
            sleepingPet._flyFromX=wakeX; sleepingPet._flyFromY=wakeY;
            this._equippedWisps.add(type);
            if(bed) bed.occupied=false;
            return;
        }
        if(!this._equippedWisps) this._equippedWisps=new Set();
        this._equippedWisps.add(type);
        const bed=this._wispBeds?.[type];
        const startX=bed?.x??this.player.x, startY=bed?.y??this.player.y;
        this._despawnRestingWisp(type);
        this._spawnPet(type);
        const pet=this.pets.find(p=>p.type===type);
        if(pet&&this._wispStamina?.[type]!==undefined){
            pet.stamina=this._wispStamina[type];
        }
        if(pet&&!skipFlyIn){
            // Fly in from bed to player's side
            pet._flyingIn=true;
            pet._flyFromX=startX; pet._flyFromY=startY;
        }
    }

    _unequipWisp(type){
        if(!this._equippedWisps?.has(type))return;
        // Can't unequip a ghost-muted wisp — the mute must expire first
        const mutedCheck=this.pets?.find(p=>p.type===type);
        if(mutedCheck?._ghostMuted){
            this._showFloatingText(this.player.x,this.player.y-30,'Wisp is muted! 🔇','#8888ff');
            return;
        }
        this._equippedWisps.delete(type);
        if(!this.pets)return;
        const idx=this.pets.findIndex(p=>p.type===type);
        if(idx===-1)return;
        const pet=this.pets[idx];
        // Same fix as the fatigue-crash path — manually pulling Phantom Wisp out of action
        // mid-possession must release the enemy it's holding, or it's stuck fleeing forever.
        if(type==='phantom'&&pet._phantomTarget){
            const e=pet._phantomTarget;
            if(e.sprite?.active){
                e._fleeing=false; e._possessed=false; e._phantomDmgBonus=0;
                e.sprite.clearTint();
            }
            pet._phantomTarget=null;
        }
        if(!this._wispStamina) this._wispStamina={};
        this._wispStamina[type]=pet.stamina||0;
        const bed=this._wispBeds?.[type];
        if(bed){
            // If currently mid-flight from bed (flyingIn), redirect from its actual current position
            const wasFlyingIn=pet._flyingIn;
            const curX=wasFlyingIn?pet._flyFromX:undefined;
            const curY=wasFlyingIn?pet._flyFromY:undefined;
            pet._flyingIn=false;
            pet._flyingToBed=true;
            pet._bedTargetX=bed.x; pet._bedTargetY=bed.y;
            if(wasFlyingIn&&curX!==undefined){
                // Seed the bed-flight start position so it continues from here, not teleporting
                pet.gfx.lastBedX=curX; pet.gfx.lastBedY=curY;
            }
        } else {
            pet.gfx?.destroy(); pet.ring?.destroy(); pet.staminaGfx?.destroy(); pet._fireLaserGfx?.destroy();
            pet._jugGfx?.destroy(); pet._jugLabel?.destroy();
            this.pets.splice(idx,1);
            this._spawnRestingWisp(type);
        }
    }


    _refreshShopUI(){
        // Rebuild only the cards, so the active tab and scroll position survive.
        // (Previously checked `_shopOpen` — a flag nothing ever set — and later a
        // close+reopen, which reset the tab back to the first one.)
        if(!this._glurpShopOpen)return;
        this._gsScrapTxt?.active && this._gsScrapTxt.setText(`⚙ ${this.scraps}`);
        this._gsBuildCards?.();
    }

    _drawStaminaArc(pet,wx,wy){
        const g=pet.staminaGfx; if(!g?.active)return;
        g.clear();
        const pct=Math.min(1,(pet.stamina||0)/pet.maxStamina);
        const healActive=this.time.now<(pet._lifeHealEndTime||0);
        if(pct>=0.99&&!healActive)return;
        const outerRadii={skyward:21,void:16,boom:14,life:13,fire:13};
        const r=outerRadii[pet.type]??15;
        g.lineStyle(2,0x222222,0.6); g.beginPath(); g.arc(wx,wy,r,-Math.PI/2,-Math.PI/2+Math.PI*2,false); g.strokePath();
        const baseCol=pct>0.5?0x44ff88:pct>0.25?0xffdd44:0xff4444;
        if(healActive){
            // The pink sliver represents ONLY the portion just added by Life Wisp. It starts
            // at full size (the exact amount healed) and shrinks back toward the boundary over
            // 1s, so the arc reads as "old color, then a thin pink cap at the leading edge" that
            // gradually gets reabsorbed into the base color rather than the whole ring flashing.
            const healDur=1000;
            const elapsed=healDur-((pet._lifeHealEndTime||0)-this.time.now);
            const settleT=Math.max(0,Math.min(1,elapsed/healDur));
            const healedFraction=pet._lifeHealAmount/pet.maxStamina; // the slice size at the moment of the heal
            const curPinkFraction=healedFraction*(1-settleT); // shrinks to 0 as it settles
            const boundaryPct=Math.max(0,pct-curPinkFraction);
            // Base-colored arc up to the boundary (the "already settled" stamina)
            if(boundaryPct>0){
                g.lineStyle(2.5,baseCol,0.9);
                g.beginPath(); g.arc(wx,wy,r,-Math.PI/2,-Math.PI/2+boundaryPct*Math.PI*2,false); g.strokePath();
            }
            // Pink sliver from the boundary to the current total — the still-fresh portion
            if(curPinkFraction>0.001){
                g.lineStyle(2.5,0xff66aa,0.95);
                g.beginPath(); g.arc(wx,wy,r,-Math.PI/2+boundaryPct*Math.PI*2,-Math.PI/2+pct*Math.PI*2,false); g.strokePath();
            }
        } else {
            g.lineStyle(2.5,baseCol,0.9);
            g.beginPath(); g.arc(wx,wy,r,-Math.PI/2,-Math.PI/2+pct*Math.PI*2,false); g.strokePath();
        }
        const endAng=-Math.PI/2+pct*Math.PI*2;
        const tipCol=healActive?0xff66aa:baseCol;
        g.fillStyle(tipCol,1); g.fillCircle(wx+Math.cos(endAng)*r,wy+Math.sin(endAng)*r,2);
    }

    _spawnPet(type){
        if(!this.pets) this.pets=[];
        const TS=this.TILE_SIZE;
        const angleOffset=(this.pets.length*Math.PI*2/3);
        const orbitRadii={light:1.6, ice:2.0, boom:2.4, fire:1.8, fist:1.0, void:2.8, poison:2.2, skyward:3.2, phantom:2.6, life:2.0};
        const orbitSpeeds={light:1.4, ice:0.9, boom:0.7, fire:1.1, fist:0.6, void:0.5, poison:0.8, skyward:0.4, phantom:0.65, life:0.85};
        // Stamina drain per attack — weighted by impact not fire rate
        // Max stamina = 100 (200 for Fiery — built to sustain). Recover rate = 3/s while resting.
        const fatigueDrain={light:5, ice:5, boom:12, fire:4, fist:6, void:20, poison:8, skyward:6, phantom:15, life:4};
        const maxStaminaByType={fire:200};
        const pet={
            type, active:true,
            angle:angleOffset,
            orbitR:(orbitRadii[type]??1.8)*TS,
            orbitSpeed:orbitSpeeds[type]??1.0,
            lastFire:0,
            fireInterval: type==='light'?500 : type==='ice'?800 : type==='boom'?1200 : type==='fist'?450 : type==='void'?4200 : type==='poison'?2500 : type==='skyward'?15000 : type==='phantom'?3000 : type==='life'?600 : 800,
            stamina:maxStaminaByType[type]??100, maxStamina:maxStaminaByType[type]??100,
            fatigueDrain: fatigueDrain[type]??6,
            fatigued:false,
            _fireTarget:null, _fireLockStart:0, _fireRamp:0,
            _boomMarked:new Set(),
        };
        const g=this.add.graphics().setDepth(4.5);
        const ring=this.add.graphics().setDepth(1.2);
        const staminaGfx=this.add.graphics().setDepth(5.2);
        pet.gfx=g; pet.ring=ring; pet.staminaGfx=staminaGfx;
        this.pets.push(pet);
        // Skill-tree stats that live on the pet (interval/drain) are re-applied here so they
        // survive the respawn that happens on every equip — the pet literal above always
        // resets them to base, so this must run after.
        this._applyWispStats(pet);
        this._showFloatingText(this.player.x,this.player.y-30,`${type.charAt(0).toUpperCase()+type.slice(1)} Wisp!`,'#ffdd44');
    }

    // Re-applies scene-stored skill-tree stats that live on the pet object (fire interval,
    // stamina drain). Combat multipliers (damage, chains, coeff) are read live from scene
    // fields in the attack loop, so they don't need re-applying here.
    _applyWispStats(pet){
        if(!pet)return;
        if(pet.type==='light'){
            pet.fireInterval=this._lightInterval||500;
            pet.fatigueDrain=this._lightDrain??5;
            pet.maxStamina=this._lightMaxStam||100;   // Overcharge Cells raises this
            if(pet.stamina>pet.maxStamina) pet.stamina=pet.maxStamina;
        }
    }

    _updatePets(time,dt){
        if(!this.pets?.length)return;
        const TS=this.TILE_SIZE;
        const px=this.player.x, py=this.player.y;
        const dmgMult=this._petDmgMult||1;
        const attackR=(this._petRange||5)*TS;

        for(const pet of this.pets){
            if(!pet.active)continue;

            // Ghost mute — wisp can't attack or be unequipped, no-symbol draws over it
            if(pet._ghostMuted){
                const orbitX=px+Math.cos(pet.angle)*pet.orbitR;
                const orbitY=py+Math.sin(pet.angle)*pet.orbitR;
                if(pet._mutedGfx?.active){
                    const g=pet._mutedGfx;
                    g.clear();
                    const r=12;
                    // Red circle
                    g.lineStyle(2.5,0xff2222,0.92);
                    g.strokeCircle(orbitX,orbitY,r);
                    // Diagonal slash — top-right to bottom-left (classic no/mute symbol)
                    const slashAng=Math.PI*0.75; // 135 degrees
                    const sx1=orbitX+Math.cos(slashAng)*r, sy1=orbitY+Math.sin(slashAng)*r;
                    const sx2=orbitX+Math.cos(slashAng+Math.PI)*r, sy2=orbitY+Math.sin(slashAng+Math.PI)*r;
                    g.lineStyle(2.5,0xff2222,0.92);
                    g.lineBetween(sx1,sy1,sx2,sy2);
                    // Soft red fill to show area
                    g.fillStyle(0xff0000,0.12);
                    g.fillCircle(orbitX,orbitY,r);
                }
            }

            // Flying back to bed when manually unequipped
            if(pet._flyingToBed){
                const curX=pet.gfx?.lastBedX??(px+Math.cos(pet.angle)*pet.orbitR);
                const curY=pet.gfx?.lastBedY??(py+Math.sin(pet.angle)*pet.orbitR);
                const tdx=pet._bedTargetX-curX, tdy=pet._bedTargetY-curY;
                const td=Math.hypot(tdx,tdy)||1;
                const speed=TS*7*dt;
                if(td<8){
                    // Arrived — convert to resting visual
                    pet.gfx?.destroy(); pet.ring?.destroy(); pet.staminaGfx?.destroy(); pet._fireLaserGfx?.destroy();
                    pet._jugGfx?.destroy(); pet._jugLabel?.destroy();
                    const idx=this.pets.indexOf(pet);
                    if(idx!==-1) this.pets.splice(idx,1);
                    this._spawnRestingWisp(pet.type);
                    continue;
                } else {
                    const nx=curX+tdx/td*speed, ny=curY+tdy/td*speed;
                    pet.gfx.clear();
                    pet.gfx.lastBedX=nx; pet.gfx.lastBedY=ny;
                    pet.gfx.fillStyle(0xffffff,0.7); pet.gfx.fillCircle(nx,ny,5);
                    pet.gfx.fillStyle(0xffffff,0.35); pet.gfx.fillCircle(nx,ny,8);
                    pet.ring?.clear(); pet.staminaGfx?.clear(); pet._fireLaserGfx?.clear();
                    continue;
                }
            }

            // Flying in from bed when newly equipped
            if(pet._flyingIn){
                const orbitX=px+Math.cos(pet.angle)*pet.orbitR;
                const orbitY=py+Math.sin(pet.angle)*pet.orbitR;
                const tdx=orbitX-pet._flyFromX, tdy=orbitY-pet._flyFromY;
                const td=Math.hypot(tdx,tdy)||1;
                const speed=TS*8*dt;
                if(td<8){ pet._flyingIn=false; }
                else {
                    pet._flyFromX+=tdx/td*speed; pet._flyFromY+=tdy/td*speed;
                    pet.gfx.clear();
                    pet.gfx.fillStyle(0xffffff,0.85); pet.gfx.fillCircle(pet._flyFromX,pet._flyFromY,5);
                    pet.gfx.fillStyle(0xffffff,0.4); pet.gfx.fillCircle(pet._flyFromX,pet._flyFromY,8);
                    // Sparkle trail
                    const tg=this.add.graphics().setDepth(4.3);
                    tg.fillStyle(0xffffaa,0.6); tg.fillCircle(pet._flyFromX,pet._flyFromY,2);
                    this.tweens.add({targets:tg,alpha:0,duration:300,onComplete:()=>tg.destroy()});
                    pet.ring?.clear(); pet.staminaGfx?.clear(); pet._fireLaserGfx?.clear();
                    continue;
                }
            }

            // Stamina hit 0 — trigger travel-to-sleep (only once)
            if((pet.stamina||0)<=0&&!pet._travelingToSleep&&!pet._sleeping){
                this._wispGoToSleep(pet);
            }

            // Traveling to bed — fly there, ignore all combat logic
            if(pet._travelingToSleep){
                const curX=pet.gfx?.lastX??(px+Math.cos(pet.angle)*pet.orbitR);
                const curY=pet.gfx?.lastY??(py+Math.sin(pet.angle)*pet.orbitR);
                const tdx=pet._sleepTargetX-curX, tdy=pet._sleepTargetY-curY;
                const td=Math.hypot(tdx,tdy)||1;
                const speed=TS*6*dt;
                let nx,ny;
                if(td<6){ nx=pet._sleepTargetX; ny=pet._sleepTargetY; pet._travelingToSleep=false; pet._sleeping=true; }
                else { nx=curX+tdx/td*speed; ny=curY+tdy/td*speed; }
                pet.gfx.clear();
                pet.gfx.lastX=nx; pet.gfx.lastY=ny;
                pet.gfx.fillStyle(0x666677,0.6); pet.gfx.fillCircle(nx,ny,5);
                pet.gfx.fillStyle(0x9999aa,0.5); pet.gfx.fillCircle(nx,ny,2);
                pet.ring?.clear();
                pet.staminaGfx?.clear();
                pet._fireLaserGfx?.clear();
                continue;
            }

            // Sleeping in bed — show resting animation + recharging arc, no combat
            if(pet._sleeping){
                const lockoutUntil=this._wispLockoutUntil?.[pet.type]||0;
                const isLockedOut=this.time.now<lockoutUntil;
                if(!isLockedOut){
                    // Lockout just ended — burst of stamina to kick off recharge
                    if(!pet._lockoutBurstGiven){
                        pet._lockoutBurstGiven=true;
                        pet.stamina=Math.max(pet.stamina||0,pet.maxStamina*0.15);
                        this._showFloatingText(pet._sleepTargetX,pet._sleepTargetY-24,'⚡ Recharging!','#66ddff');
                    }
                    pet.stamina=Math.min(pet.maxStamina,(pet.stamina||0)+3*dt);
                    this._wispStamina[pet.type]=pet.stamina;
                }
                const bed=this._wispBeds?.[pet.type];
                const bx=bed?.x??pet._sleepTargetX, by=bed?.y??pet._sleepTargetY;
                const breathe=1+0.08*Math.sin(time*0.002);
                pet.gfx.clear();
                const bodyCol=isLockedOut?0x553344:0x777788;
                pet.gfx.fillStyle(bodyCol,0.55); pet.gfx.fillEllipse(bx,by,9*breathe,6);
                pet.gfx.fillStyle(isLockedOut?0x884466:0xaaaabb,0.4); pet.gfx.fillEllipse(bx-1,by-1,4,3);
                // Zzz floating up — red-tinted while locked out
                if(!pet._zzzTimer||time-pet._zzzTimer>1400){
                    pet._zzzTimer=time;
                    const zz=this.add.text(bx+6,by-8,'z',{fontSize:'9px',fontFamily:'monospace',color:isLockedOut?'#cc6688':'#aaaacc'}).setDepth(5);
                    this.tweens.add({targets:zz,y:by-22,alpha:0,duration:1300,onComplete:()=>zz.destroy()});
                }
                pet.ring?.clear();
                pet._fireLaserGfx?.clear();
                if(isLockedOut){
                    // Show countdown ring instead of stamina arc while locked out
                    pet.staminaGfx?.clear();
                    const lockPct=1-Math.max(0,(lockoutUntil-this.time.now)/8000);
                    const g=pet.staminaGfx;
                    if(g?.active){
                        g.lineStyle(2,0x331122,0.7); g.beginPath(); g.arc(bx,by-14,12,-Math.PI/2,-Math.PI/2+Math.PI*2,false); g.strokePath();
                        g.lineStyle(2.5,0xff4466,0.85); g.beginPath(); g.arc(bx,by-14,12,-Math.PI/2,-Math.PI/2+lockPct*Math.PI*2,false); g.strokePath();
                    }
                } else {
                    this._drawStaminaArc(pet,bx,by-14);
                }
                if(!isLockedOut&&pet.stamina>=pet.maxStamina){
                    pet._sleeping=false; pet._lockoutBurstGiven=false;
                    pet.gfx?.destroy(); pet.ring?.destroy(); pet.staminaGfx?.destroy(); pet._fireLaserGfx?.destroy();
                    pet._jugGfx?.destroy(); pet._jugLabel?.destroy();
                    const idx=this.pets.indexOf(pet);
                    if(idx!==-1) this.pets.splice(idx,1);
                    this._showFloatingText(bx,by-20,`${pet.type} wisp is well rested! ✨`,'#44ffaa');
                    this._spawnRestingWisp(pet.type);
                }
                continue;
            }

            pet.angle+=dt*pet.orbitSpeed;
            if(pet.type==='fist'&&pet._fistX===undefined){ pet._fistX=px+this.TILE_SIZE; pet._fistY=py; }
            if(pet.type==='phantom'&&pet._fistX===undefined){ pet._fistX=px; pet._fistY=py; }

            // Compute orbit position first
            const orbitX=px+Math.cos(pet.angle)*pet.orbitR;
            const orbitY=py+Math.sin(pet.angle)*pet.orbitR;

            // For phantom: manage position based on state
            if(pet.type==='phantom'){
                const destX=pet._phantomTravelDest?.x??orbitX;
                const destY=pet._phantomTravelDest?.y??orbitY;
                if(pet._phantomTraveling){
                    // Move toward destination at speed
                    const tdx=destX-pet._fistX, tdy=destY-pet._fistY;
                    const td=Math.hypot(tdx,tdy)||1;
                    const speed=TS*7*dt;
                    if(td<TS*0.4){
                        // Arrived
                        pet._fistX=destX; pet._fistY=destY;
                        pet._phantomTraveling=false;
                        pet._phantomTravelDest=null;
                        // If pending enemy, possess it now
                        if(pet._phantomPending?.sprite?.active&&!pet._phantomPending._possessed){
                            pet._phantomTarget=pet._phantomPending;
                            pet._phantomPending=null;
                            pet._phantomHopTime=time;
                            pet._thumpedStart=false; pet._thumpedEnd=false; pet._auraLastTick=0;
                        }
                    } else {
                        pet._fistX+=tdx/td*Math.min(speed,td);
                        pet._fistY+=tdy/td*Math.min(speed,td);
                    }
                } else if(pet._phantomTarget?.sprite?.active){
                    // Hover over possessed enemy
                    pet._fistX=pet._phantomTarget.sprite.x;
                    pet._fistY=pet._phantomTarget.sprite.y-TS*0.6;
                } else {
                    // Drift back to orbit
                    pet._fistX+=(orbitX-pet._fistX)*Math.min(1,dt*8);
                    pet._fistY+=(orbitY-pet._fistY)*Math.min(1,dt*8);
                }
            }
            const isOwnPos=pet.type==='fist'||pet.type==='phantom';
            const wx=isOwnPos?(pet._fistX??orbitX):orbitX;
            const wy=isOwnPos?(pet._fistY??orbitY):orbitY;
            // Cache the wisp's live world position so systems outside this loop (e.g. Light's
            // reveal pulse in _updateCloakSystem) can originate effects from the wisp itself
            // rather than from the player/base.
            pet._wx=wx; pet._wy=wy;

            // Draw wisp body
            pet.gfx.clear();
            const col=pet.type==='light'?0xffffff : pet.type==='ice'?0x88ddff : pet.type==='boom'?0xff8844 : pet.type==='fist'?0xff6622 : pet.type==='void'?0xaa00ff : pet.type==='poison'?0x44cc44 : pet.type==='skyward'?0xffdd44 : pet.type==='phantom'?0xccaaff : pet.type==='life'?0xff88bb : 0xff4422;
            const pulse=0.7+0.3*Math.sin(time*0.008+(pet.type==='fire'?pet._fireRamp*2:0));
            if(!(pet.type==='fire'&&pet._fireRamp>=10)&&pet.type!=='fist'&&pet.type!=='phantom'&&pet.type!=='skyward'&&pet.type!=='life'&&pet.type!=='fire'){
                // Dim toward grey as stamina depletes below 30%
                const stamPct=(pet.stamina||100)/pet.maxStamina;
                const dimAmt=stamPct<0.3?1-(stamPct/0.3):0; // 0=full color, 1=fully grey
                const finalCol=dimAmt>0?Phaser.Display.Color.Interpolate.ColorWithColor(
                    Phaser.Display.Color.IntegerToColor(col),
                    Phaser.Display.Color.IntegerToColor(0x555566),
                    100,dimAmt*100
                ):null;
                const drawCol=finalCol?Phaser.Display.Color.GetColor(finalCol.r,finalCol.g,finalCol.b):col;
                const da=1-dimAmt*0.3, dimGate=1-dimAmt*0.4;
                const spin=time*0.0025;

                if(pet.type==='light'){
                    // Faceted gem — bright core with 5 sharp rays, like a tiny shard of pure light
                    pet.gfx.fillStyle(drawCol,0.18*pulse*da); pet.gfx.fillCircle(wx,wy,11);
                    for(let i=0;i<5;i++){
                        const a=spin+(i/5)*Math.PI*2;
                        const rx=wx+Math.cos(a)*8, ry=wy+Math.sin(a)*8;
                        pet.gfx.lineStyle(1,0xffffff,0.55*pulse*da);
                        pet.gfx.lineBetween(wx,wy,rx,ry);
                    }
                    pet.gfx.fillStyle(drawCol,0.9*pulse*da); pet.gfx.fillCircle(wx,wy,5);
                    pet.gfx.lineStyle(1,0xffffff,0.7*dimGate); pet.gfx.strokeCircle(wx,wy,5);
                    pet.gfx.fillStyle(0xffffff,0.95*dimGate); pet.gfx.fillCircle(wx-1,wy-1,1.6);

                } else if(pet.type==='ice'){
                    // Hexagonal snowflake-crystal — six-pointed facets with a frosty core
                    pet.gfx.fillStyle(drawCol,0.85*pulse*da);
                    pet.gfx.beginPath();
                    for(let i=0;i<6;i++){
                        const a=Math.PI/6+(i/6)*Math.PI*2;
                        const px2=wx+Math.cos(a)*5.5, py2=wy+Math.sin(a)*5.5;
                        i===0?pet.gfx.moveTo(px2,py2):pet.gfx.lineTo(px2,py2);
                    }
                    pet.gfx.closePath(); pet.gfx.fillPath();
                    pet.gfx.lineStyle(1,0xffffff,0.6*dimGate); pet.gfx.strokePath();
                    for(let i=0;i<6;i++){
                        const a=(i/6)*Math.PI*2;
                        pet.gfx.lineStyle(0.8,0xffffff,0.4*pulse*da);
                        pet.gfx.lineBetween(wx,wy,wx+Math.cos(a)*8,wy+Math.sin(a)*8);
                    }
                    pet.gfx.fillStyle(0xffffff,0.85*dimGate); pet.gfx.fillCircle(wx,wy,1.8);

                } else if(pet.type==='boom'){
                    // Spiked powder-keg orb — jagged spikes radiating off a core, fuse-like flicker
                    pet.gfx.fillStyle(0x331100,0.7*pulse*da); pet.gfx.fillCircle(wx,wy,6.5);
                    pet.gfx.fillStyle(drawCol,0.85*pulse*da); pet.gfx.fillCircle(wx,wy,5);
                    for(let i=0;i<8;i++){
                        const a=spin*1.5+(i/8)*Math.PI*2;
                        const baseR=5, tipR=8.5+Math.sin(time*0.01+i)*0.8;
                        const bx=wx+Math.cos(a)*baseR, by=wy+Math.sin(a)*baseR;
                        const tx=wx+Math.cos(a)*tipR, ty=wy+Math.sin(a)*tipR;
                        pet.gfx.lineStyle(1.4,0xffaa44,0.7*pulse*da);
                        pet.gfx.lineBetween(bx,by,tx,ty);
                    }
                    pet.gfx.fillStyle(0xffdd66,0.9*dimGate); pet.gfx.fillCircle(wx-1,wy-1,1.7);

                } else if(pet.type==='void'){
                    // Tiny event-horizon — dark core ringed by an orbiting accretion arc
                    pet.gfx.fillStyle(0x110022,0.9*pulse*da); pet.gfx.fillCircle(wx,wy,5.5);
                    pet.gfx.lineStyle(1.6,drawCol,0.8*pulse*da);
                    pet.gfx.beginPath(); pet.gfx.arc(wx,wy,8,spin*3,spin*3+Math.PI*1.3,false); pet.gfx.strokePath();
                    pet.gfx.lineStyle(1,0xdd88ff,0.5*pulse*da);
                    pet.gfx.beginPath(); pet.gfx.arc(wx,wy,8,spin*3+Math.PI,spin*3+Math.PI+Math.PI*0.6,false); pet.gfx.strokePath();
                    pet.gfx.fillStyle(0xdd88ff,0.7*dimGate); pet.gfx.fillCircle(wx+Math.cos(spin*3)*8,wy+Math.sin(spin*3)*8,1.2);
                    pet.gfx.fillStyle(0xffffff,0.5*dimGate); pet.gfx.fillCircle(wx-1,wy-1,1);

                } else if(pet.type==='poison'){
                    // Bubbling vial-blob — irregular drip silhouette with rising bubbles
                    pet.gfx.fillStyle(drawCol,0.85*pulse*da);
                    pet.gfx.fillCircle(wx,wy+1,5.2);
                    pet.gfx.fillCircle(wx-2.5,wy-1.5,2.6);
                    pet.gfx.fillCircle(wx+2.8,wy-1,2.4);
                    pet.gfx.fillStyle(0x226622,0.3*pulse*da); pet.gfx.fillCircle(wx,wy+1,5.2);
                    for(let i=0;i<3;i++){
                        const bub=(time*0.003+i*1.7)%1;
                        const by2=wy+4-bub*9;
                        pet.gfx.fillStyle(0xaaffaa,0.5*(1-bub)*da);
                        pet.gfx.fillCircle(wx+(i-1)*2.2,by2,0.8+bub*0.6);
                    }
                    pet.gfx.fillStyle(0xccffcc,0.8*dimGate); pet.gfx.fillCircle(wx-1,wy-1,1.5);

                } else if(pet.type==='fire'){
                    // Flickering flame teardrop — layered tongues of fire with rising embers
                    const flicker=0.8+0.2*Math.sin(time*0.02)+0.1*Math.sin(time*0.035+1.3);
                    pet.gfx.fillStyle(0x882200,0.5*pulse*da); pet.gfx.fillCircle(wx,wy+1,7*flicker);
                    pet.gfx.fillStyle(drawCol,0.85*pulse*da);
                    pet.gfx.fillTriangle(wx-4*flicker,wy+3,wx+4*flicker,wy+3,wx,wy-6*flicker);
                    pet.gfx.fillCircle(wx,wy+2,4*flicker);
                    pet.gfx.fillStyle(0xffaa33,0.8*pulse*da);
                    pet.gfx.fillTriangle(wx-2.2*flicker,wy+2,wx+2.2*flicker,wy+2,wx,wy-3.5*flicker);
                    pet.gfx.fillStyle(0xffee99,0.85*dimGate); pet.gfx.fillCircle(wx,wy+1,1.6);
                    for(let i=0;i<3;i++){
                        const ember=(time*0.0025+i*1.4)%1;
                        const ey=wy-ember*11;
                        const exo=Math.sin(time*0.01+i*2)*2;
                        pet.gfx.fillStyle(0xffaa44,0.6*(1-ember)*da);
                        pet.gfx.fillCircle(wx+exo,ey,0.9-ember*0.5);
                    }

                } else {
                    pet.gfx.fillStyle(drawCol,pulse*da); pet.gfx.fillCircle(wx,wy,6);
                    pet.gfx.fillStyle(0xffffff,0.8*dimGate); pet.gfx.fillCircle(wx,wy,2.5);
                    pet.gfx.lineStyle(1.5,drawCol,0.4*pulse); pet.gfx.strokeCircle(wx,wy,9);
                }
            }
            // Stamina arc around every wisp
            this._drawStaminaArc(pet,wx,wy);
            // Skyward Apprentice — star body with orbiting mini-cannonballs
            if(pet.type==='skyward'){
                pet.gfx.clear();
                const rot=time*0.003;
                const cooldown=pet.fireInterval;
                const pct=Math.min(1,(time-(pet.lastFire||0))/cooldown);
                // Star body — 5 points
                const starR=7, innerR=3.5;
                const pts=5;
                pet.gfx.fillStyle(0xffdd44,0.85*pulse);
                pet.gfx.beginPath();
                for(let i=0;i<pts*2;i++){
                    const ang=i/pts*Math.PI-Math.PI/2;
                    const r=i%2===0?starR:innerR;
                    const sx=wx+Math.cos(ang)*r, sy=wy+Math.sin(ang)*r;
                    i===0?pet.gfx.moveTo(sx,sy):pet.gfx.lineTo(sx,sy);
                }
                pet.gfx.closePath(); pet.gfx.fillPath();
                pet.gfx.lineStyle(1,0xffffff,0.7); pet.gfx.strokePath();
                // Center bright dot
                pet.gfx.fillStyle(0xffffff,0.9); pet.gfx.fillCircle(wx,wy,2);
                // 3 orbiting mini-cannonballs at different phases
                const orbitR=10;
                for(let b=0;b<3;b++){
                    const bang=rot*(b%2===0?1:-0.7)+b*(Math.PI*2/3);
                    const bx=wx+Math.cos(bang)*orbitR, by=wy+Math.sin(bang)*orbitR;
                    const bScale=0.7+0.3*pct; // grow as cooldown charges
                    pet.gfx.fillStyle(0x444455,0.9); pet.gfx.fillCircle(bx,by,2.5*bScale);
                    pet.gfx.fillStyle(0x9999bb,0.7); pet.gfx.fillCircle(bx-0.5*bScale,by-0.7*bScale,1.2*bScale);
                    // Trail dot behind each ball
                    const trailAng=bang-(b%2===0?0.4:-0.3);
                    pet.gfx.fillStyle(0xffcc44,0.25*(0.3+0.7*pct));
                    pet.gfx.fillCircle(wx+Math.cos(trailAng)*orbitR,wy+Math.sin(trailAng)*orbitR,1.5*bScale);
                }
                // Charge ring — fills up as cooldown completes (gold = attack cooldown, distinct from stamina arc further out)
                if(pct<1){
                    pet.gfx.lineStyle(1.5,0xffcc44,0.4);
                    pet.gfx.beginPath(); pet.gfx.arc(wx,wy,14,-Math.PI/2,-Math.PI/2+pct*Math.PI*2,false); pet.gfx.strokePath();
                }
            }
            // Life wisp — heart-shaped pulsing core with pink glow
            if(pet.type==='life'){
                pet.gfx.clear();
                const sinceDrain=time-(pet.lastFire||0);
                const activityPct=Math.max(0,1-sinceDrain/1500);
                const lp=0.6+0.4*Math.sin(time*0.012);
                pet.gfx.fillStyle(0xff44aa,0.12+0.18*activityPct*lp); pet.gfx.fillCircle(wx,wy,14);
                pet.gfx.fillStyle(0xff88bb,0.8*lp); pet.gfx.fillCircle(wx,wy,6);
                pet.gfx.fillStyle(0xff88bb,0.7*lp); pet.gfx.fillCircle(wx-3,wy-3,4);
                pet.gfx.fillStyle(0xff88bb,0.7*lp); pet.gfx.fillCircle(wx+3,wy-3,4);
                pet.gfx.fillStyle(0xff88bb,0.7*lp); pet.gfx.fillTriangle(wx-5,wy+1,wx+5,wy+1,wx,wy+8);
                // Thin outline tracing the heart silhouette for definition
                pet.gfx.lineStyle(0.8,0xffccee,0.5*lp);
                pet.gfx.strokeCircle(wx-3,wy-3,4); pet.gfx.strokeCircle(wx+3,wy-3,4);
                pet.gfx.fillStyle(0xffeeff,0.85); pet.gfx.fillCircle(wx-1,wy-1,2);
                // Slow ambient pulse-ring breathing outward, independent of drain activity
                const ringPulse=(time*0.0008)%1;
                pet.gfx.lineStyle(1,0xff88bb,0.25*(1-ringPulse));
                pet.gfx.strokeCircle(wx,wy,4+ringPulse*7);
                // Charge sparkles flare right after a drain
                if(activityPct>0.15){
                    for(let s=0;s<3;s++){
                        const sa=time*0.005+s*2.1;
                        const sr=8+2*Math.sin(time*0.01+s);
                        pet.gfx.fillStyle(0xff44aa,0.6*activityPct);
                        pet.gfx.fillCircle(wx+Math.cos(sa)*sr,wy+Math.sin(sa)*sr,1.5*activityPct);
                    }
                }
            }

            // Attack range ring
            pet.ring.clear();
            // NOTE: the DPS totem (_isTotem) is intentionally INCLUDED here. Every other
            // system filters it out, which meant wisps never targeted the training dummy and
            // it always read "DPS: 0". Totems only exist when spawned from the dev panel, so
            // including them has no effect on normal waves — it just makes the dummy measurable.
            // Cloaked enemies are untargetable (the health-freeze net also makes them
            // invincible as a backstop). Reveal them with Light's pulse to fight them.
            const inRange=this.enemies.filter(e=>e!=null&&e.sprite?.active&&!e._cloaked&&Math.hypot(e.sprite.x-px,e.sprite.y-py)<=attackR);
            pet.ring.lineStyle(1,col,inRange.length?0.3:0.1);
            pet.ring.strokeCircle(px,py,attackR);

            // Ghost-muted wisps skip all attack logic — body still draws above
            if(pet._ghostMuted){ this._drawStaminaArc(pet,wx,wy); continue; }

            // Clear fiery laser when no enemies in range
            if(pet.type==='fire'&&!inRange.length) pet._fireLaserGfx?.clear();

            // ── FIERY WISP: two modes — Single (ramp to a massive purple beam on one
            // target) or Multi (spreads weaker flame whips across many enemies at once) ──
            if(pet.type==='fire'){
                const fireMode=this._fireWispMode||'single';

                if(fireMode==='single'){
                    if(pet._fireTarget&&pet._fireTarget.sprite?.active&&
                       Math.hypot(pet._fireTarget.sprite.x-px,pet._fireTarget.sprite.y-py)<=attackR){
                        pet._fireRamp=Math.min(12,(time-pet._fireLockStart)/1000);
                    } else {
                        const wasPurple=pet._fireRamp>=10;
                        pet._fireTarget=inRange[0]||null;
                        pet._fireLockStart=time;
                        if(!wasPurple) pet._fireRamp=0;
                        else pet._fireRamp=10;
                    }

                    if(!pet._fireLaserGfx||!pet._fireLaserGfx.active)
                        pet._fireLaserGfx=this.add.graphics().setDepth(4.8);
                    pet._fireLaserGfx.clear();

                    const transformed=pet._fireRamp>=10;

                    if(pet._fireTarget&&pet._fireTarget.sprite?.active){
                        const ex=pet._fireTarget.sprite.x, ey=pet._fireTarget.sprite.y;
                        const intensity=Math.min(1,pet._fireRamp/10);
                        if(transformed){
                            // Scaled up further — wider beam, brighter core, bigger impact bloom
                            const pulse=0.7+0.3*Math.sin(time*0.025);
                            pet._fireLaserGfx.lineStyle(30,0x220033,0.14*pulse);
                            pet._fireLaserGfx.beginPath(); pet._fireLaserGfx.moveTo(wx,wy); pet._fireLaserGfx.lineTo(ex,ey); pet._fireLaserGfx.strokePath();
                            pet._fireLaserGfx.lineStyle(16,0x9900ff,0.55*pulse);
                            pet._fireLaserGfx.beginPath(); pet._fireLaserGfx.moveTo(wx,wy); pet._fireLaserGfx.lineTo(ex,ey); pet._fireLaserGfx.strokePath();
                            pet._fireLaserGfx.lineStyle(7,0xcc44ff,0.95*pulse);
                            pet._fireLaserGfx.beginPath(); pet._fireLaserGfx.moveTo(wx,wy); pet._fireLaserGfx.lineTo(ex,ey); pet._fireLaserGfx.strokePath();
                            pet._fireLaserGfx.lineStyle(2.2,0xffffff,0.85*pulse);
                            pet._fireLaserGfx.beginPath(); pet._fireLaserGfx.moveTo(wx,wy); pet._fireLaserGfx.lineTo(ex,ey); pet._fireLaserGfx.strokePath();
                            pet.gfx.clear();
                            pet.gfx.fillStyle(0xaa00ff,0.9+0.1*pulse); pet.gfx.fillCircle(wx,wy,11);
                            pet.gfx.fillStyle(0xffffff,0.8); pet.gfx.fillCircle(wx,wy,4.5);
                            pet.gfx.lineStyle(4.5,0xcc44ff,0.55*pulse); pet.gfx.strokeCircle(wx,wy,18);
                            pet.gfx.lineStyle(2,0xffffff,0.22*pulse); pet.gfx.strokeCircle(wx,wy,23);
                            pet._fireLaserGfx.fillStyle(0x9900ff,0.9*pulse); pet._fireLaserGfx.fillCircle(ex,ey,18);
                            pet._fireLaserGfx.fillStyle(0xcc44ff,0.65*pulse); pet._fireLaserGfx.fillCircle(ex,ey,11);
                            pet._fireLaserGfx.fillStyle(0xffffff,0.65*pulse); pet._fireLaserGfx.fillCircle(ex,ey,5);
                        } else {
                            const lw=2+intensity*9;
                            const alpha=0.5+intensity*0.5;
                            pet._fireLaserGfx.lineStyle(lw+8,0xff2200,0.1+intensity*0.2);
                            pet._fireLaserGfx.beginPath(); pet._fireLaserGfx.moveTo(wx,wy); pet._fireLaserGfx.lineTo(ex,ey); pet._fireLaserGfx.strokePath();
                            pet._fireLaserGfx.lineStyle(lw,0xff4422,alpha);
                            pet._fireLaserGfx.beginPath(); pet._fireLaserGfx.moveTo(wx,wy); pet._fireLaserGfx.lineTo(ex,ey); pet._fireLaserGfx.strokePath();
                            pet._fireLaserGfx.lineStyle(lw*0.35,0xffaa44,alpha*0.8);
                            pet._fireLaserGfx.beginPath(); pet._fireLaserGfx.moveTo(wx,wy); pet._fireLaserGfx.lineTo(ex,ey); pet._fireLaserGfx.strokePath();
                            if(intensity>0.4){
                                pet._fireLaserGfx.lineStyle(lw*0.15,0xffffff,intensity*0.7);
                                pet._fireLaserGfx.beginPath(); pet._fireLaserGfx.moveTo(wx,wy); pet._fireLaserGfx.lineTo(ex,ey); pet._fireLaserGfx.strokePath();
                            }
                            const spark=0.4+0.4*Math.sin(time*0.015*(1+intensity*3));
                            pet._fireLaserGfx.fillStyle(0xff4422,spark); pet._fireLaserGfx.fillCircle(ex,ey,4+intensity*8);
                            pet._fireLaserGfx.fillStyle(0xffdd44,spark*0.7); pet._fireLaserGfx.fillCircle(ex,ey,2+intensity*4);
                            // Wisp's own body — was missing entirely in this branch, leaving
                            // just a beam with no visible source during the whole ramp phase
                            pet.gfx.clear();
                            const flicker=0.8+0.2*Math.sin(time*0.02)+0.1*Math.sin(time*0.035+1.3);
                            const bodyGrow=1+intensity*0.6; // grows slightly as it ramps toward purple
                            pet.gfx.fillStyle(0x882200,0.5*flicker); pet.gfx.fillCircle(wx,wy+1,7*flicker*bodyGrow);
                            pet.gfx.fillStyle(0xff4422,0.85*flicker);
                            pet.gfx.fillTriangle(wx-4*flicker*bodyGrow,wy+3,wx+4*flicker*bodyGrow,wy+3,wx,wy-6*flicker*bodyGrow);
                            pet.gfx.fillCircle(wx,wy+2,4*flicker*bodyGrow);
                            pet.gfx.fillStyle(0xffaa33,0.8*flicker);
                            pet.gfx.fillTriangle(wx-2.2*flicker*bodyGrow,wy+2,wx+2.2*flicker*bodyGrow,wy+2,wx,wy-3.5*flicker*bodyGrow);
                            pet.gfx.fillStyle(0xffee99,0.85); pet.gfx.fillCircle(wx,wy+1,1.6);
                            // Ramp ring — fills in as a visual cue toward the purple transformation threshold
                            pet.gfx.lineStyle(1.5,0xffaa44,0.5);
                            pet.gfx.beginPath(); pet.gfx.arc(wx,wy,11,-Math.PI/2,-Math.PI/2+intensity*Math.PI*2,false); pet.gfx.strokePath();
                        }
                    } else {
                        // No enemy in range at all — idle flame, calm and small, never invisible
                        pet.gfx.clear();
                        const flicker=0.8+0.2*Math.sin(time*0.02)+0.1*Math.sin(time*0.035+1.3);
                        pet.gfx.fillStyle(0x882200,0.4*flicker); pet.gfx.fillCircle(wx,wy+1,6*flicker);
                        pet.gfx.fillStyle(0xff4422,0.7*flicker);
                        pet.gfx.fillTriangle(wx-3.2*flicker,wy+3,wx+3.2*flicker,wy+3,wx,wy-5*flicker);
                        pet.gfx.fillCircle(wx,wy+2,3.2*flicker);
                        pet.gfx.fillStyle(0xffaa33,0.65*flicker);
                        pet.gfx.fillTriangle(wx-1.8*flicker,wy+2,wx+1.8*flicker,wy+2,wx,wy-3*flicker);
                        pet.gfx.fillStyle(0xffee99,0.7); pet.gfx.fillCircle(wx,wy+1,1.3);
                    }

                    if(pet._fireTarget&&pet._fireTarget.sprite?.active&&time-pet.lastFire>=pet.fireInterval){
                        pet.lastFire=time;
                        pet.stamina=Math.max(0,(pet.stamina||100)-(this._devNoStamina?0:pet.fatigueDrain));
                        if(pet.stamina<=0&&!this._devNoStamina){ pet.fatigued=true; }
                        const e=pet._fireTarget;
                        let dmg;
                        if(transformed){
                            // Scaled up significantly — 0.45% HP per 100ms = 4.5% HP/s, a true
                            // single-target finisher once it's had time to ramp into purple
                            dmg=e.health*0.0045*dmgMult;
                        } else {
                            dmg=(5+pet._fireRamp*8)*dmgMult;
                        }
                        this._lastDamageFromWisp=true; e.health-=dmg; this.updateEnemyHealthBar(e); this._lastDamageFromWisp=false;
                        if(e.health<=0){ this.killEnemy(e); pet._fireTarget=null; pet._fireLaserGfx?.clear(); if(pet._fireRamp<10) pet._fireRamp=0; }
                    }
                    continue;
                }

                // ── MULTI MODE: spreads weaker flame whips across many enemies at once ──
                if(!pet._fireLaserGfx||!pet._fireLaserGfx.active)
                    pet._fireLaserGfx=this.add.graphics().setDepth(4.8);
                pet._fireLaserGfx.clear();
                pet.gfx.clear();
                // Body — calmer, ember-like rather than the ramping single-target core
                const mpulse=0.65+0.25*Math.sin(time*0.012);
                pet.gfx.fillStyle(0xff5522,0.8*mpulse); pet.gfx.fillCircle(wx,wy,6.5);
                pet.gfx.fillStyle(0xffaa44,0.6*mpulse); pet.gfx.fillCircle(wx,wy,3.2);
                pet.gfx.lineStyle(1.5,0xff6633,0.4*mpulse); pet.gfx.strokeCircle(wx,wy,10);

                // Refresh target list periodically rather than every frame
                const MULTI_CAP=10; // a LOT of enemies, capped for performance/readability
                if(pet._fireMultiInterval===undefined) pet._fireMultiInterval=500; // faster tick than single's 800ms — built for swarms that won't stand still
                if(!pet._fireMultiRefreshAt||time>=pet._fireMultiRefreshAt){
                    pet._fireMultiRefreshAt=time+250;
                    pet._fireMultiTargets=inRange.slice(0,MULTI_CAP).filter(e=>e.sprite?.active);
                }
                const targets=(pet._fireMultiTargets||[]).filter(e=>e.sprite?.active);
                for(const tgt of targets){
                    const ex=tgt.sprite.x, ey=tgt.sprite.y;
                    const flick=0.5+0.4*Math.sin(time*0.02+ex*0.05);
                    pet._fireLaserGfx.lineStyle(4,0xff2200,0.08*flick);
                    pet._fireLaserGfx.beginPath(); pet._fireLaserGfx.moveTo(wx,wy); pet._fireLaserGfx.lineTo(ex,ey); pet._fireLaserGfx.strokePath();
                    pet._fireLaserGfx.lineStyle(1.6,0xff5522,0.45*flick);
                    pet._fireLaserGfx.beginPath(); pet._fireLaserGfx.moveTo(wx,wy); pet._fireLaserGfx.lineTo(ex,ey); pet._fireLaserGfx.strokePath();
                    pet._fireLaserGfx.lineStyle(0.6,0xffaa66,0.6*flick);
                    pet._fireLaserGfx.beginPath(); pet._fireLaserGfx.moveTo(wx,wy); pet._fireLaserGfx.lineTo(ex,ey); pet._fireLaserGfx.strokePath();
                    pet._fireLaserGfx.fillStyle(0xff5522,0.4*flick); pet._fireLaserGfx.fillCircle(ex,ey,2.5);
                }

                if(targets.length&&time-pet.lastFire>=pet._fireMultiInterval){
                    pet.lastFire=time;
                    pet.stamina=Math.max(0,(pet.stamina||100)-(this._devNoStamina?0:pet.fatigueDrain));
                    if(pet.stamina<=0&&!this._devNoStamina){ pet.fatigued=true; }
                    // Percentage-of-current-HP like every other wisp, so it actually keeps pace
                    // with enemy HP scaling across waves instead of decaying into irrelevance.
                    // Tuned to be the clear swarm answer: against several fast targets that never
                    // sit still long enough for Single's 10s ramp to matter, Multi's faster tick
                    // (500ms vs Single's 800ms) and per-target % easily outpaces what Single's
                    // unramped orange phase could ever do to that same group. Single's purple
                    // beam ceiling is still far higher — this only wins the swarm matchup.
                    const perTargetPct=0.018; // 1.8% current HP per tick, per target hit
                    for(const tgt of targets){
                        if(!tgt.sprite?.active)continue;
                        const dmg=tgt.health*perTargetPct*dmgMult;
                        this._lastDamageFromWisp=true; tgt.health-=dmg; this.updateEnemyHealthBar(tgt); this._lastDamageFromWisp=false;
                        if(tgt.health<=0) this.killEnemy(tgt);
                    }
                }
                continue;
            }

            // Fist wisp manages its own position — skip orbit
            if(pet.type==='fist'){

                const target=pet._fistTarget&&pet._fistTarget.sprite?.active&&
                    Math.hypot(pet._fistTarget.sprite.x-px,pet._fistTarget.sprite.y-py)<=attackR
                    ? pet._fistTarget : (inRange[0]||null);
                pet._fistTarget=target;

                if(target){
                    const tdx=target.sprite.x-pet._fistX, tdy=target.sprite.y-pet._fistY;
                    const td=Math.hypot(tdx,tdy)||1;
                    const chaseR=TS*0.5;
                    if(td>chaseR){
                        const speed=TS*7*dt;
                        pet._fistX+=tdx/td*Math.min(speed,td-chaseR);
                        pet._fistY+=tdy/td*Math.min(speed,td-chaseR);
                    }
                } else {
                    // Smoothly lerp toward orbit position
                    pet._fistX+=(orbitX-pet._fistX)*Math.min(1,dt*8);
                    pet._fistY+=(orbitY-pet._fistY)*Math.min(1,dt*8);
                }

                // Unstable, agitated wisp — jittery irregular core that never sits still,
                // crackling with barely-contained energy. Shudders harder right before punching.
                pet.gfx.clear();
                const isAttacking=time-(pet._lastPunchAnim||0)<200;
                const fc=isAttacking?0xff2200:0xff5522;
                const fx2=pet._fistX, fy2=pet._fistY;
                // Constant high-frequency jitter offset — body never sits perfectly still
                const agitation=isAttacking?2.8:1.1;
                const jx=Math.sin(time*0.04)*agitation*0.6+Math.sin(time*0.071+1.7)*agitation*0.4;
                const jy=Math.cos(time*0.037)*agitation*0.6+Math.cos(time*0.063+0.9)*agitation*0.4;
                const cx2=fx2+jx, cy2=fy2+jy;
                const fpulse=0.75+0.25*Math.sin(time*0.025);
                // Outer flare when actively punching
                if(isAttacking){ pet.gfx.fillStyle(0xffaa44,0.45*fpulse); pet.gfx.fillCircle(cx2,cy2,12); }
                // Irregular jagged core — radius wobbles per-vertex so the silhouette is never a clean circle
                const spikes=7;
                pet.gfx.fillStyle(fc,0.9*fpulse);
                pet.gfx.beginPath();
                for(let i=0;i<spikes;i++){
                    const ang=(i/spikes)*Math.PI*2;
                    const wobble=1+Math.sin(time*0.018+i*1.9)*0.35+(isAttacking?0.25:0);
                    const rad=(5.5+i%2*0.8)*wobble;
                    const px2=cx2+Math.cos(ang)*rad, py2=cy2+Math.sin(ang)*rad;
                    i===0?pet.gfx.moveTo(px2,py2):pet.gfx.lineTo(px2,py2);
                }
                pet.gfx.closePath(); pet.gfx.fillPath();
                // Crackling energy lines snapping off the core at random angles
                for(let c=0;c<3;c++){
                    const cAng=time*0.01+c*2.4+Math.sin(time*0.05+c)*0.8;
                    const innerR=4, outerR=8.5+Math.sin(time*0.04+c*3)*1.5;
                    pet.gfx.lineStyle(0.9,0xffcc66,0.55*fpulse*(isAttacking?1.4:1));
                    pet.gfx.lineBetween(cx2+Math.cos(cAng)*innerR,cy2+Math.sin(cAng)*innerR,cx2+Math.cos(cAng)*outerR,cy2+Math.sin(cAng)*outerR);
                }
                // Hot inner core
                pet.gfx.fillStyle(0xffdd88,0.85); pet.gfx.fillCircle(cx2,cy2,1.8);
                pet.gfx.lineStyle(1,0xff8844,0.4*fpulse); pet.gfx.strokeCircle(cx2,cy2,9.5);

                // Range ring
                pet.ring.clear();
                pet.ring.lineStyle(1,0xff6622,inRange.length?0.3:0.1);
                pet.ring.strokeCircle(px,py,attackR);

                // Only attack when close enough to the target
                const distToTarget=target?Math.hypot(target.sprite.x-pet._fistX,target.sprite.y-pet._fistY):999;
                const inPunchRange=distToTarget<=TS*1.2;

                if(target&&inPunchRange&&time-pet.lastFire>=(pet._fistCooldown||pet.fireInterval)){
                    pet._fistCooldown=null;
                    pet.lastFire=time;
                    pet.stamina=Math.max(0,(pet.stamina||100)-(this._devNoStamina?0:pet.fatigueDrain));
                    if(pet.stamina<=0&&!this._devNoStamina){ pet.fatigued=true; }
                    pet._attackCount=(pet._attackCount||0)+1;
                    const attackNum=pet._attackCount%3||3;
                    const isHeavy=attackNum===3;
                    pet._punchDir=Math.atan2(target.sprite.y-pet._fistY,target.sprite.x-pet._fistX);
                    pet._lastPunchAnim=time;

                    if(isHeavy){
                        const pGfx=this.add.graphics().setDepth(5.5);
                        pGfx.lineStyle(5,0xff2200,0.95);
                        pGfx.beginPath(); pGfx.moveTo(pet._fistX,pet._fistY); pGfx.lineTo(target.sprite.x,target.sprite.y); pGfx.strokePath();
                        pGfx.fillStyle(0xff2200,0.9); pGfx.fillCircle(target.sprite.x,target.sprite.y,14);
                        pGfx.fillStyle(0xffffff,0.8); pGfx.fillCircle(target.sprite.x,target.sprite.y,6);
                        this.tweens.add({targets:pGfx,alpha:0,duration:350,onComplete:()=>pGfx.destroy()});
                        this._showFloatingText(target.sprite.x,target.sprite.y-24,'💥 KO!','#ff2200');
                        const koDmg=Math.max(40*dmgMult,target.health*0.05); this._lastDamageFromWisp=true; target.health-=koDmg; this.updateEnemyHealthBar(target); this._lastDamageFromWisp=false;
                        if(!target._isTotem&&!target._isDummy){
                            const kpx=target.sprite.x+Math.cos(pet._punchDir)*TS*2;
                            const kpy=target.sprite.y+Math.sin(pet._punchDir)*TS*2;
                            const ktx=Math.floor(kpx/TS), kty=Math.floor(kpy/TS);
                            if(this.world[ktx]?.[kty]===this.FLOOR){
                                target.x=ktx; target.y=kty;
                                target.sprite.x=ktx*TS+TS/2; target.sprite.y=kty*TS+TS/2;
                                target._committedPath=undefined; target._pathIndex=undefined;
                            }
                        }
                        // Stun 2s — use wrench stun visual not ice block
                        target.isStunned=true;
                        target.stunnedUntil=this.time.now+2000;
                        this._showStunIndicator(target);
                        this.cameras.main.shake(100,0.004);
                        pet._fistCooldown=1000;
                    } else {
                        for(let i=0;i<3;i++){
                            this.time.delayedCall(i*80,()=>{
                                if(!target.sprite?.active)return;
                                const pGfx=this.add.graphics().setDepth(5.5);
                                pGfx.lineStyle(2,0xff8844,0.85);
                                pGfx.beginPath(); pGfx.moveTo(pet._fistX,pet._fistY); pGfx.lineTo(target.sprite.x,target.sprite.y); pGfx.strokePath();
                                pGfx.fillStyle(0xff8844,0.8); pGfx.fillCircle(target.sprite.x,target.sprite.y,6);
                                pGfx.fillStyle(0xffffff,0.5); pGfx.fillCircle(target.sprite.x,target.sprite.y,2.5);
                                this.tweens.add({targets:pGfx,alpha:0,duration:100,onComplete:()=>pGfx.destroy()});
                                this._showFloatingText(target.sprite.x+(Math.random()-0.5)*12,target.sprite.y-16,'bap','#ff8844');
                                const bapDmg=(8+(this.wave||1)*0.8)*dmgMult; this._lastDamageFromWisp=true; target.health-=bapDmg; this.updateEnemyHealthBar(target); this._lastDamageFromWisp=false;
                                if(target.health<=0)this.killEnemy(target);
                            });
                        }
                    }
                    if(target.health<=0)this.killEnemy(target);
                }
                continue;
            }

            // ── PHANTOM WISP: possesses enemy, makes it flee, thumps nearby ──
            if(pet.type==='phantom'){
                // Initiate travel to first unpossessed enemy if idle
                if(!pet._phantomTarget&&!pet._phantomTraveling){
                    const tgt=inRange.find(e=>!e._possessed);
                    if(tgt){
                        pet._phantomTraveling=true;
                        pet._phantomPending=tgt;
                        pet._phantomTravelDest={x:tgt.sprite.x,y:tgt.sprite.y-TS*0.6};
                    }
                }
                // New possession just started — drain stamina once per possession
                if(pet._phantomTarget&&!pet._phantomStaminaDrained){
                    pet._phantomStaminaDrained=true;
                    pet.stamina=Math.max(0,(pet.stamina||100)-(this._devNoStamina?0:pet.fatigueDrain));
                    if(pet.stamina<=0&&!this._devNoStamina){ pet.fatigued=true; }
                }
                if(!pet._phantomTarget) pet._phantomStaminaDrained=false; // reset for next possession
                if(pet._phantomTarget&&pet._phantomTarget.sprite?.active){
                    const e=pet._phantomTarget;
                    e._possessed=true; e._phantomDmgBonus=0.25;
                    e.sprite.setTint(0xccaaff); e._fleeing=true;
                    const elapsed=time-(pet._phantomHopTime||time);
                    if(elapsed<100&&!pet._thumpedStart){ pet._thumpedStart=true; this._phantomThump(e.sprite.x,e.sprite.y,TS*3.5,dmgMult); }
                    if(elapsed>2800&&!pet._thumpedEnd){ pet._thumpedEnd=true; this._phantomThump(e.sprite.x,e.sprite.y,TS*3.5,dmgMult); }
                    // Continuous mild slow aura around the possessed enemy for the full duration —
                    // the two thumps above are just the dramatic damage/visual bursts at start/end
                    if(this.time.now-(pet._auraLastTick||0)>=150){
                        pet._auraLastTick=this.time.now;
                        const auraR=TS*2.6;
                        for(const ne of this.enemies){
                            if(!ne.sprite?.active||ne._isTotem||ne===e)continue;
                            if(Math.hypot(ne.sprite.x-e.sprite.x,ne.sprite.y-e.sprite.y)>auraR)continue;
                            ne.isSlowed=true; ne.slowedUntil=this.time.now+250; ne._slowMult=0.35; ne._slowType='slow_goop';
                        }
                    }
                    if(elapsed>=3000){
                        e._fleeing=false; e._possessed=false; e._phantomDmgBonus=0;
                        e._committedPath=null; e._pathIndex=undefined; e.sprite.clearTint();
                        pet._phantomTarget=null;
                        // Travel back to orbit first, then pick next
                        pet._phantomTraveling=true;
                        pet._phantomTravelDest={x:orbitX,y:orbitY};
                        pet._phantomPending=null; // no pending — will pick on arrival
                    }
                    pet.gfx.clear();
                    const ppulse=0.5+0.4*Math.sin(time*0.01);
                    // Ghostly body — rounded top, three wavy tail points trailing below
                    const ghAng=time*0.003;
                    pet.gfx.fillStyle(0xccaaff,0.15*ppulse); pet.gfx.fillCircle(wx,wy,11);
                    pet.gfx.fillStyle(0xccaaff,ppulse);
                    pet.gfx.fillCircle(wx,wy-1.5,5.5); // rounded head
                    for(let t=0;t<3;t++){
                        const tx2=wx-3+t*3, tWave=Math.sin(ghAng*2+t*1.5)*1.2;
                        pet.gfx.fillCircle(tx2+tWave,wy+4+t*0.4,2.4-t*0.3); // wavy trailing tail lobes
                    }
                    pet.gfx.fillStyle(0xffffff,0.7); pet.gfx.fillCircle(wx-1,wy-2.5,2);
                    // Two small dark eye dots
                    pet.gfx.fillStyle(0x442288,0.7*ppulse); pet.gfx.fillCircle(wx-1.8,wy-1.8,0.7); pet.gfx.fillCircle(wx+1.6,wy-1.8,0.7);
                    pet.gfx.lineStyle(1.5,0xaa88ff,0.4*ppulse); pet.gfx.strokeCircle(wx,wy-1.5,8);
                    pet.ring.clear();
                    pet.ring.lineStyle(1.5,0xccaaff,0.35+0.15*Math.sin(time*0.006)); pet.ring.strokeCircle(e.sprite.x,e.sprite.y,TS*0.85);
                    const rot2=time*0.004; pet.ring.lineStyle(1,0xaa88ff,0.2);
                    pet.ring.beginPath(); pet.ring.arc(e.sprite.x,e.sprite.y,TS*1.3,rot2,rot2+Math.PI*1.1,false); pet.ring.strokePath();
                } else {
                    if(pet._phantomTarget){ pet._phantomTarget._possessed=false; pet._phantomTarget=null; }
                    pet.ring.clear();
                    pet.gfx.clear();
                    const ppulse2=0.5+0.3*Math.sin(time*0.008);
                    const ghAng2=time*0.003;
                    pet.gfx.fillStyle(0xccaaff,0.15*ppulse2); pet.gfx.fillCircle(wx,wy,11);
                    pet.gfx.fillStyle(0xccaaff,ppulse2);
                    pet.gfx.fillCircle(wx,wy-1.5,5.5);
                    for(let t=0;t<3;t++){
                        const tx2=wx-3+t*3, tWave=Math.sin(ghAng2*2+t*1.5)*1.2;
                        pet.gfx.fillCircle(tx2+tWave,wy+4+t*0.4,2.4-t*0.3);
                    }
                    pet.gfx.fillStyle(0xffffff,0.7); pet.gfx.fillCircle(wx-1,wy-2.5,2);
                    pet.gfx.fillStyle(0x442288,0.7*ppulse2); pet.gfx.fillCircle(wx-1.8,wy-1.8,0.7); pet.gfx.fillCircle(wx+1.6,wy-1.8,0.7);
                    pet.gfx.lineStyle(1.5,0xaa88ff,0.35*ppulse2); pet.gfx.strokeCircle(wx,wy-1.5,8);
                }
                continue;
            }

            if(!inRange.length||time-pet.lastFire<pet.fireInterval)continue;
            pet.lastFire=time;
            // Drain stamina on attack. Light drains PER ENEMY it will hit (base + per-hit) so
            // clearing a horde costs proportionally more than poking one enemy — the swarm
            // power is paid for. Other wisps keep their flat per-cast drain.
            let drainThisCast=pet.fatigueDrain;
            if(pet.type==='light' && !this._devNoStamina){
                const maxLen=(this._lightChainLen||2);
                const willHit=Math.max(1,Math.min(inRange.length, maxLen));
                const base=this._lightDrainBase??2;      // small base so single-target stays cheap
                const perHit=this._lightDrainPerHit??3;  // each chained enemy adds this
                // Brand discount: average the discount over the targets the chain will hit
                // (branded enemies cost less), so drilling a seared target is cheaper.
                let discount=1;
                if(this._lightBrand){
                    const sorted=inRange.slice(0,willHit);
                    let sum=0; for(const t of sorted) sum+=this._lightBrandMult(t);
                    discount = sorted.length? sum/sorted.length : 1;
                }
                drainThisCast=(base+perHit*willHit)*discount;
            }
            pet.stamina=Math.max(0,(pet.stamina||100)-(this._devNoStamina?0:drainThisCast));
            if(pet.stamina<=0&&!this._devNoStamina){ pet.fatigued=true; this._showFloatingText(wx,wy-20,'zz','#888899'); }

            // ── SKYWARD APPRENTICE: crosshair lock → cannon strike ────────
            if(pet.type==='skyward'){
                const waveNum=this.wave||1;
                const strikeCount=Math.max(3,Math.floor(inRange.length*0.5)+Math.floor(waveNum/5));
                const targets=Phaser.Utils.Array.Shuffle([...inRange]).slice(0,strikeCount);
                // Phase 1: crosshairs lock onto each target one by one
                const lockDelay=200;
                targets.forEach((e,i)=>{
                    this.time.delayedCall(i*lockDelay,()=>{
                        if(!e.sprite?.active)return;
                        const tx2=e.sprite.x, ty2=e.sprite.y;
                        // Crosshair — 4 arms closing in
                        const xhair=this.add.graphics().setDepth(5.5);
                        const drawXhair=(scale,alpha)=>{
                            xhair.clear();
                            const arm=10*scale, gap=4*scale, thick=1.5;
                            xhair.lineStyle(thick,0xffdd44,alpha);
                            // Top
                            xhair.lineBetween(tx2,ty2-gap,tx2,ty2-gap-arm);
                            // Bottom
                            xhair.lineBetween(tx2,ty2+gap,tx2,ty2+gap+arm);
                            // Left
                            xhair.lineBetween(tx2-gap,ty2,tx2-gap-arm,ty2);
                            // Right
                            xhair.lineBetween(tx2+gap,ty2,tx2+gap+arm,ty2);
                            // Corner ticks
                            xhair.lineStyle(thick,0xff4422,alpha*0.8);
                            xhair.lineBetween(tx2-gap,ty2-gap,tx2-gap-4*scale,ty2-gap);
                            xhair.lineBetween(tx2-gap,ty2-gap,tx2-gap,ty2-gap-4*scale);
                            xhair.lineBetween(tx2+gap,ty2-gap,tx2+gap+4*scale,ty2-gap);
                            xhair.lineBetween(tx2+gap,ty2-gap,tx2+gap,ty2-gap-4*scale);
                            xhair.lineBetween(tx2-gap,ty2+gap,tx2-gap-4*scale,ty2+gap);
                            xhair.lineBetween(tx2-gap,ty2+gap,tx2-gap,ty2+gap+4*scale);
                            xhair.lineBetween(tx2+gap,ty2+gap,tx2+gap+4*scale,ty2+gap);
                            xhair.lineBetween(tx2+gap,ty2+gap,tx2+gap,ty2+gap+4*scale);
                        };
                        drawXhair(2,0.3);
                        // Animate crosshair closing in
                        let sc=2; const closeTimer=this.time.addEvent({delay:16,loop:true,callback:()=>{
                            sc=Math.max(0.6,sc-0.07);
                            drawXhair(sc,0.9-(sc-0.6)*0.5);
                        }});
                        // Phase 2: cannon drop after lock
                        const strikeDur=lockDelay*(targets.length-i)+300;
                        this.time.delayedCall(strikeDur,()=>{
                            closeTimer.remove(); xhair.destroy();
                            if(!this.cameras?.main)return;
                            const dropX=tx2+(Math.random()-0.5)*12;
                            const dropY=ty2+(Math.random()-0.5)*12;
                            // Cannonball
                            const ball=this.add.graphics().setDepth(5.8);
                            ball.fillStyle(0x333344,1); ball.fillCircle(0,0,8);
                            ball.fillStyle(0x6666aa,0.7); ball.fillCircle(0,0,5);
                            ball.fillStyle(0xaaaacc,0.5); ball.fillCircle(-2,-3,2.5);
                            ball.x=dropX+(Math.random()-0.5)*30;
                            ball.y=this.cameras.main.worldView.y-30;
                            // Trail line (wispy smoke)
                            const trail=this.add.graphics().setDepth(5.6);
                            const startY=ball.y;
                            // Shadow shrinks as ball approaches
                            const shadow=this.add.ellipse(dropX,dropY,14,7,0x000000,0.35).setDepth(0.6);
                            this.tweens.add({targets:shadow,scaleX:0.2,scaleY:0.2,duration:400});
                            this.tweens.add({targets:ball,x:dropX,y:dropY,duration:400,ease:'Quad.easeIn',
                                onUpdate:()=>{
                                    trail.clear();
                                    trail.lineStyle(2,0xffcc44,0.3);
                                    trail.beginPath(); trail.moveTo(ball.x,ball.y); trail.lineTo(ball.x+(Math.random()-0.5)*4,startY); trail.strokePath();
                                },
                                onComplete:()=>{
                                    ball.destroy(); shadow.destroy(); trail.destroy();
                                    // Impact — scorch + explosion
                                    const scorch=this.add.graphics().setDepth(0.8);
                                    scorch.fillStyle(0x111111,0.4); scorch.fillEllipse(dropX,dropY,TS*1.2,TS*0.7);
                                    this.time.delayedCall(3000,()=>this.tweens.add({targets:scorch,alpha:0,duration:800,onComplete:()=>scorch.destroy()}));
                                    const exp=this.add.graphics().setDepth(5.5);
                                    exp.x=dropX; exp.y=dropY;
                                    exp.fillStyle(0xff6622,0.95); exp.fillCircle(0,0,TS*1.5);
                                    exp.fillStyle(0xffcc44,0.7); exp.fillCircle(0,0,TS*0.9);
                                    exp.fillStyle(0xffffff,0.4); exp.fillCircle(0,0,TS*0.4);
                                    this.cameras.main.shake(60,0.002);
                                    this.tweens.add({targets:exp,scaleX:2.2,scaleY:2.2,alpha:0,duration:350,onComplete:()=>exp.destroy()});
                                    const baseDmg=(50+waveNum*5)*dmgMult;
                                    const aoeR=TS*1.8;
                                    for(const e2 of [...this.enemies]){
                                        if(!e2.sprite?.active)continue;
                                        if(Math.hypot(e2.sprite.x-dropX,e2.sprite.y-dropY)>aoeR)continue;
                                        this._lastDamageFromWisp=true; e2.health-=baseDmg; this.updateEnemyHealthBar(e2); this._lastDamageFromWisp=false;
                                        if(e2.health<=0)this.killEnemy(e2);
                                    }
                                }
                            });
                        });
                    });
                });
            }


            // ── VOID WISP: purple laser with travel time, black hole on hit ──
            if(pet.type==='void'){
                const radius=this.TILE_SIZE*3.2;
                const minSeparation=radius*2.15; // must clear both blast radii with a small margin
                // Greedily pick up to 3 targets whose positions don't overlap each other's blast zone
                const chosen=[];
                for(const e of inRange){
                    if(!e.sprite?.active)continue;
                    const tooClose=chosen.some(c=>Math.hypot(e.sprite.x-c.sprite.x,e.sprite.y-c.sprite.y)<minSeparation);
                    if(tooClose)continue;
                    chosen.push(e);
                    if(chosen.length>=3)break;
                }
                if(!chosen.length)return;
                chosen.forEach((tgt,idx)=>{
                    this.time.delayedCall(idx*180,()=>{ // stagger launches slightly
                        if(!tgt.sprite?.active)return;
                        const totalDist=Math.hypot(tgt.sprite.x-wx,tgt.sprite.y-wy);
                        const speed=300;
                        const travelDur=(totalDist/speed)*1000;
                        const proj=this.add.graphics().setDepth(5.5);
                        proj.fillStyle(0xaa00ff,1); proj.fillCircle(0,0,5);
                        proj.fillStyle(0xffffff,0.6); proj.fillCircle(0,0,2);
                        proj.lineStyle(2,0xcc44ff,0.7); proj.strokeCircle(0,0,7);
                        proj.x=wx; proj.y=wy;
                        const trail=this.add.graphics().setDepth(5.4);
                        let trailPts=[];
                        const trailTimer=this.time.addEvent({delay:30,loop:true,callback:()=>{
                            if(!proj.active){trailTimer.remove();return;}
                            trailPts.push({x:proj.x,y:proj.y,t:this.time.now});
                            trailPts=trailPts.filter(p=>this.time.now-p.t<200);
                            trail.clear();
                            for(let i=1;i<trailPts.length;i++){
                                const a=(i/trailPts.length)*0.6;
                                trail.lineStyle(3*(i/trailPts.length),0xaa00ff,a);
                                trail.beginPath(); trail.moveTo(trailPts[i-1].x,trailPts[i-1].y); trail.lineTo(trailPts[i].x,trailPts[i].y); trail.strokePath();
                            }
                        }});
                        const targetX=tgt.sprite.x, targetY=tgt.sprite.y;
                        this.tweens.add({targets:proj,x:targetX,y:targetY,duration:travelDur,ease:'Linear',
                            onComplete:()=>{
                                proj.destroy(); trailTimer.remove(); trail.destroy();
                                const imp=this.add.graphics().setDepth(5.5);
                                imp.x=targetX; imp.y=targetY;
                                imp.fillStyle(0xaa00ff,0.8); imp.fillCircle(0,0,12);
                                this.tweens.add({targets:imp,scaleX:2,scaleY:2,alpha:0,duration:200,onComplete:()=>imp.destroy()});
                                this._spawnVoidBlackHole(targetX,targetY,dmgMult,wx,wy);
                            }
                        });
                    });
                });
            }

            // ── LIFE WISP: drains enemies, spreads the absorbed stamina across active wisps ──
            if(pet.type==='life'){
                if(inRange.length&&!pet._draining){
                    // Targets up to 4 enemies simultaneously
                    const targets=inRange.slice(0,4);
                    pet._draining=true;
                    let pendingSnaps=targets.length;
                    targets.forEach((tgt,ti)=>{
                        const ex=tgt.sprite.x, ey=tgt.sprite.y;
                        const pulse=this.add.graphics().setDepth(5.2);
                        pulse.x=ex; pulse.y=ey;
                        pulse.fillStyle(0xff88bb,0.6); pulse.fillCircle(0,0,8);
                        pulse.fillStyle(0xffeeff,0.8); pulse.fillCircle(0,0,4);
                        this.tweens.add({targets:pulse,scaleX:2.2,scaleY:2.2,alpha:0,duration:180,onComplete:()=>pulse.destroy()});
                        const tensionGfx=this.add.graphics().setDepth(5.1);
                        let tensionT=0;
                        const tensionTimer=this.time.addEvent({delay:16,loop:true,callback:()=>{
                            if(!tgt.sprite?.active){tensionTimer.remove();tensionGfx.destroy();return;}
                            tensionT+=0.016;
                            tensionGfx.clear();
                            const wave=Math.sin(tensionT*18+ti*1.2)*3;
                            const mx=(wx+tgt.sprite.x)/2+wave, my=(wy+tgt.sprite.y)/2+wave;
                            tensionGfx.lineStyle(6,0xff44aa,0.18); tensionGfx.beginPath(); tensionGfx.moveTo(wx,wy); tensionGfx.lineTo(mx,my); tensionGfx.lineTo(tgt.sprite.x,tgt.sprite.y); tensionGfx.strokePath();
                            tensionGfx.lineStyle(2.5,0xff88cc,0.75); tensionGfx.beginPath(); tensionGfx.moveTo(wx,wy); tensionGfx.lineTo(mx,my); tensionGfx.lineTo(tgt.sprite.x,tgt.sprite.y); tensionGfx.strokePath();
                            tensionGfx.lineStyle(1,0xffeeff,0.9); tensionGfx.beginPath(); tensionGfx.moveTo(wx,wy); tensionGfx.lineTo(mx,my); tensionGfx.lineTo(tgt.sprite.x,tgt.sprite.y); tensionGfx.strokePath();
                            tensionGfx.fillStyle(0xff88bb,0.6+0.3*Math.sin(tensionT*12)); tensionGfx.fillCircle(tgt.sprite.x,tgt.sprite.y,5+2*Math.sin(tensionT*12));
                        }});
                        this.time.delayedCall(150,()=>{
                            tensionTimer.remove(); tensionGfx.destroy();
                            if(!tgt.sprite?.active){pendingSnaps--;if(!pendingSnaps)pet._draining=false;return;}
                            pet.lastFire=this.time.now; // drives the heart's post-drain glow flare
                            const drain=tgt.health*0.025*dmgMult;
                            tgt.health-=drain; this.updateEnemyHealthBar(tgt);
                            if(tgt.health<=0) this.killEnemy(tgt);
                            // ── Channeled Surge: each successful drain pulls the next passive
                            // heal tick closer, rewarding active play instead of leaving Life Wisp
                            // parked. 0.4s knocked off per hit, capped so it can't be spammed into
                            // an instant-repeat — minimum 0.8s remaining before the next tick fires.
                            if(this._lifeAuraLastTick!==undefined){
                                const sinceLastTick=this.time.now-this._lifeAuraLastTick;
                                const timeUntilNextTick=5000-sinceLastTick;
                                const reduced=Math.max(800,timeUntilNextTick-400);
                                this._lifeAuraLastTick=this.time.now-(5000-reduced);
                                // Tiny readout so the effect is legible without being intrusive
                                this._showFloatingText(wx,wy-16,'-0.4s','#aaffcc');
                            }
                            const snap=this.add.graphics().setDepth(5.5);
                            snap.lineStyle(5,0xff44aa,0.9); snap.beginPath(); snap.moveTo(tgt.sprite?.x||ex,tgt.sprite?.y||ey); snap.lineTo(wx,wy); snap.strokePath();
                            snap.lineStyle(2,0xffeeff,0.95); snap.beginPath(); snap.moveTo(tgt.sprite?.x||ex,tgt.sprite?.y||ey); snap.lineTo(wx,wy); snap.strokePath();
                            const orb=this.add.graphics().setDepth(5.8);
                            orb.fillStyle(0xff88bb,1); orb.fillCircle(0,0,5);
                            orb.fillStyle(0xffeeff,0.8); orb.fillCircle(0,0,2.5);
                            orb.lineStyle(1.5,0xff44aa,0.7); orb.strokeCircle(0,0,7);
                            orb.x=tgt.sprite?.x||ex; orb.y=tgt.sprite?.y||ey;
                            this.tweens.add({targets:orb,x:wx,y:wy,duration:180,ease:'Quad.easeIn',
                                onComplete:()=>{
                                    orb.destroy();
                                    pet.gfx.clear();
                                    pet.gfx.fillStyle(0xff44aa,1); pet.gfx.fillCircle(wx,wy,10);
                                    pet.gfx.fillStyle(0xffeeff,0.9); pet.gfx.fillCircle(wx,wy,5);
                                    pendingSnaps--;
                                    if(!pendingSnaps) pet._draining=false;
                                }
                            });
                            this.tweens.add({targets:snap,alpha:0,duration:120,onComplete:()=>snap.destroy()});
                        });
                    });
                }
            }



            // ── POISON WISP: barf creates 3×3 poison pool ───────────────────
            else if(pet.type==='poison'){
                const tgt=inRange[0];
                // Barf projectile — green blob with travel time
                const barf=this.add.graphics().setDepth(5.5);
                barf.fillStyle(0x44cc44,0.9); barf.fillCircle(0,0,7);
                barf.fillStyle(0x88ff44,0.6); barf.fillCircle(-2,-2,4);
                barf.fillStyle(0xffff44,0.4); barf.fillCircle(0,0,3);
                barf.x=wx; barf.y=wy;
                // Wavy arc to target
                const cx=tgt.sprite.x, cy=tgt.sprite.y;
                const dist=Math.hypot(cx-wx,cy-wy);
                this.tweens.add({targets:barf,x:cx,y:cy,duration:400,ease:'Quad.easeIn',
                    onUpdate:t=>{ barf.y=wy+(cy-wy)*t.progress - Math.sin(t.progress*Math.PI)*dist*0.3; },
                    onComplete:()=>{
                        barf.destroy();
                        // Impact splat
                        const flat=5*dmgMult;
                        if(tgt.sprite?.active){ tgt.health-=flat; this.updateEnemyHealthBar(tgt); if(tgt.health<=0)this.killEnemy(tgt); }
                        // Spawn 3×3 poison pool at landing
                        const TS2=this.TILE_SIZE;
                        const ltx=Math.floor(cx/TS2), lty=Math.floor(cy/TS2);
                        for(let dx=-1;dx<=1;dx++) for(let dy=-1;dy<=1;dy++){
                            if(this.world[ltx+dx]?.[lty+dy]===this.FLOOR)
                                this._spawnPoisonTile(ltx+dx,lty+dy,dmgMult);
                        }
                        // Splat visual
                        const splat=this.add.graphics().setDepth(1.1);
                        splat.fillStyle(0x33aa33,0.5); splat.fillCircle(cx,cy,TS2*1.6);
                        splat.fillStyle(0x44cc44,0.3); splat.fillCircle(cx-8,cy+6,TS2*0.8);
                        splat.fillStyle(0x55dd55,0.2); splat.fillCircle(cx+10,cy-4,TS2*0.6);
                        this.tweens.add({targets:splat,alpha:0,duration:600,onComplete:()=>splat.destroy()});
                    }
                });
            }

            // ── LIGHT WISP: chain laser — beams physically travel hop-to-hop ──────────
            if(pet.type==='light'){
                // ── Skill-tree derived stats (all default to the original baseline) ──
                const chains  = this._petLightChains||1;      // B: Extra Arc — simultaneous chains
                const maxLen  = this._lightChainLen||2;        // B: Longer Reach — base 2 targets
                const coeff   = this._lightCoeff||4;           // B: Amplified Jump — base coeff 4
                const flat    = this._lightFlat||0;            // A: Focused Beam — flat dmg
                const lmult   = 1+(this._lightDmgAdd||0);      // A branch: additive % damage
                // C capstone — Solar Flare: every 5th cast supercharges the whole volley
                this._lightCastCount=(this._lightCastCount||0)+1;
                const solar   = this._lightSolarFlare && (this._lightCastCount%5===0);
                const solarMult = solar?2.5:1;
                const lenBonus  = solar?2:0;
                const coreCol = solar?0xffdd44:0xffffff;       // gold flash on a supercharged cast
                const glowCol = solar?0xffaa22:0xaaccff;
                if(solar) this._showFloatingText(wx,wy-22,'SOLAR FLARE ☀','#ffdd44');

                // Lightspeed node: beams resolve instantly and reach farther between hops.
                // Base Light: each hop takes travelPerHop ms to arrive, so the chain resolves
                // sequentially (the beam visibly races down the line) and effective throughput
                // is a touch lower — keeping base Light a team-dependent contributor. Lightspeed
                // makes the bolt FAST but still with visible travel (never truly instant) — the
                // travel arc is part of Light's visual identity.
                const fast = !!this._lightInstant;             // "Lightspeed" upgrade
                const instant = false;                          // never truly instant — travel is the look
                const travelPerHop = fast?45:160;               // ms per hop: slower base, fast (not 0) maxed
                const baseReach = this._lightJumpRad||5;       // B: Wider Arc — base 5 tiles
                const jumpRad = TS*(fast?baseReach+4:baseReach); // Lightspeed extends reach

                const usedStarts=new Set();
                for(let c=0;c<chains;c++){
                    const start=inRange.find(e=>!usedStarts.has(e));
                    if(!start)break;
                    usedStarts.add(start);
                    let targets=[start]; const hit=new Set([start]);
                    while(targets.length<maxLen+lenBonus){
                        const last=targets[targets.length-1];
                        let next=this.enemies.find(e=>e.sprite?.active&&!e._cloaked&&!hit.has(e)&&
                            Math.hypot(e.sprite.x-last.sprite.x,e.sprite.y-last.sprite.y)<jumpRad);
                        if(!next)break;
                        hit.add(next); targets.push(next);
                    }
                    const chainLen=targets.length; // 1..maxLen(+bonus)
                    // Mastery: reward the CHAIN, not the cast — a 1-target chain is Light
                    // doing its job badly, so hops are where the value is.
                    this._addWispMastery('light',3+(chainLen-1)*4);
                    const scale=Math.min(1,chainLen/6);
                    // Base per-hit damage comes from the UPGRADED chain length (what the player
                    // invested in), NOT the runtime count — so a dense pack doesn't inflate the
                    // base. On TOP, a longer live chain gives a GENTLE, CAPPED per-target bonus:
                    // big chains hit each target a bit harder (rewarding, and matches the thick
                    // beam visual) without the old runaway that melted clustered tanks.
                    const dmgChainRef=(this._lightChainLen||2);
                    const baseHit=(10+dmgChainRef*coeff+flat)*dmgMult*lmult*solarMult;
                    const chainBonus=1+Math.min(0.40, (chainLen-1)*0.08); // +8% per extra link, cap +40%
                    const dmgPerHit=baseHit*chainBonus;
                    const beamWidth=(1+scale*6)*(solar?1.4:1);
                    const alpha=0.5+scale*0.5;
                    // Snapshot the beam path at cast time (positions barely move within ~300ms).
                    const pts=[{x:wx,y:wy},...targets.map(t=>({x:t.sprite.x,y:t.sprite.y}))];

                    const resolveHop=(idx)=>{
                        const e=targets[idx];
                        const ax=pts[idx].x, ay=pts[idx].y;         // segment start (prev hop)
                        const bx=pts[idx+1].x, by=pts[idx+1].y;     // this target
                        // B capstone — Cascade Charge: each hop hits harder than the last (capped)
                        const cascadeMult=this._lightCascade?Math.min(1.6,1+0.15*idx):1;
                        const dmgThisHop=dmgPerHit*cascadeMult;
                        const bw=beamWidth*(this._lightCascade?Math.min(1.5,1+0.12*idx):1);
                        const nodeR=2+scale*5;

                        // Called when the bolt reaches the target: draw the settled beam,
                        // apply damage, run pierce + execute.
                        const land=()=>{
                            const laser=this.add.graphics().setDepth(5);
                            // CLEAN radiant light beam (not lightning). The SOLID core stays thin
                            // and constant regardless of chain size, so it never obscures the
                            // enemies underneath. "Stronger" is conveyed by a translucent glow
                            // halo (see-through — doesn't hide anything), a hotter/brighter core,
                            // and bigger impact bursts at the endpoints — never by width.
                            const beam=(w,col,a)=>{ laser.lineStyle(w,col,a); laser.beginPath(); laser.moveTo(ax,ay); laser.lineTo(bx,by); laser.strokePath(); };
                            // Soft translucent halo — widens with power but very low alpha, so it
                            // reads as radiance/bloom you can see THROUGH, not a solid occluder.
                            beam(3+scale*7, glowCol, 0.06+scale*0.06);
                            beam(2+scale*3, glowCol, 0.12+scale*0.08);
                            // Solid body — thin and near-constant (only a hair thicker with power).
                            beam(1.6+scale*1.2, coreCol, 0.85);
                            // White-hot filament — brightness/heat is the power signal, not size.
                            beam(Math.max(0.8,0.8+scale*0.6), 0xffffff, 0.9+scale*0.1);
                            // Radiant impact burst at the target — small and tidy, not a big bloom.
                            const burst=nodeR*(0.7+scale*0.5);
                            laser.fillStyle(glowCol,0.16); laser.fillCircle(bx,by,burst*1.5);   // small outer bloom
                            laser.fillStyle(glowCol,0.5);  laser.fillCircle(bx,by,burst);
                            laser.fillStyle(coreCol,0.95); laser.fillCircle(bx,by,burst*0.55);
                            laser.fillStyle(0xffffff,1);   laser.fillCircle(bx,by,burst*0.28);
                            // Four short radiant spokes on a strong hit (a "sparkle", light-themed
                            // rather than electric forks) — subtle, only on bigger chains.
                            if(scale>0.5){
                                laser.lineStyle(1,0xffffff,0.5*scale);
                                for(let k=0;k<4;k++){ const a=k*Math.PI/2+Math.PI/4; laser.beginPath(); laser.moveTo(bx,by); laser.lineTo(bx+Math.cos(a)*burst*1.5,by+Math.sin(a)*burst*1.5); laser.strokePath(); }
                            }
                            this.tweens.add({targets:laser,alpha:0,duration:150+chainLen*25,onComplete:()=>laser.destroy()});
                            if(e?.sprite?.active&&!e._cloaked){
                                const wasAlive=e.health;
                                this._lightExecuteCheck(e,pet); // execute BEFORE damage if already low
                                if(e.sprite?.active){
                                    this._applyLightBrand(e); // brand raises this enemy's tier
                                    // fromWisp:true so this deferred beam hit can damage the flying Angel.
                                    this._dealDamage(e,dmgThisHop,{fromX:ax,fromY:ay,fromWisp:true});
                                }
                            }
                        };

                        if(instant){ land(); return; }

                        // Base Light: animate a bolt physically crossing ax,ay → bx,by, trailing
                        // the beam behind a bright travelling head; damage lands when it arrives.
                        const trav=this.add.graphics().setDepth(5);
                        this.tweens.addCounter({from:0,to:1,duration:travelPerHop,onUpdate:tw=>{
                            if(!trav.active)return;
                            const t=tw.getValue();
                            const hx=ax+(bx-ax)*t, hy=ay+(by-ay)*t;
                            trav.clear();
                            trav.lineStyle(2+scale*3,glowCol,0.10+scale*0.06); trav.beginPath(); trav.moveTo(ax,ay); trav.lineTo(hx,hy); trav.strokePath();
                            trav.lineStyle(1.6+scale*1,coreCol,0.85);           trav.beginPath(); trav.moveTo(ax,ay); trav.lineTo(hx,hy); trav.strokePath();
                            trav.fillStyle(0xffffff,1);  trav.fillCircle(hx,hy,Math.max(2,2+scale*2));
                            trav.fillStyle(glowCol,0.5); trav.fillCircle(hx,hy,Math.max(3.5,4+scale*3));
                        },onComplete:()=>{ trav.destroy(); land(); }});
                    };
                    // Instant → resolve the whole chain at once; otherwise stagger by travel time
                    for(let idx=0;idx<targets.length;idx++){
                        if(travelPerHop>0) this.time.delayedCall(idx*travelPerHop,()=>resolveHop(idx));
                        else resolveHop(idx);
                    }
                }
            }

            // ── ICE WISP: single-target freeze/shatter control. Each hit can FREEZE (RNG);
            // a follow-up ice hit SHATTERS a frozen target (brittle + water puddle); if not
            // shattered within the window it MELTS into a bigger puddle. Puddles slow + wet.
            else if(pet.type==='ice'){
                const beamCount=this._petIceBeams||1;      // 1 by identity; pet_ice_beams raises it
                const targets=this._pickIceTargets(inRange,beamCount);
                for(const e of targets){
                    const laser=this.add.graphics().setDepth(5);
                    laser.lineStyle(10,0x44aaff,0.15); laser.beginPath(); laser.moveTo(wx,wy); laser.lineTo(e.sprite.x,e.sprite.y); laser.strokePath();
                    laser.lineStyle(5,0x88ddff,0.55); laser.beginPath(); laser.moveTo(wx,wy); laser.lineTo(e.sprite.x,e.sprite.y); laser.strokePath();
                    laser.lineStyle(2.5,0xaaeeff,0.95); laser.beginPath(); laser.moveTo(wx,wy); laser.lineTo(e.sprite.x,e.sprite.y); laser.strokePath();
                    laser.lineStyle(1,0xffffff,0.9); laser.beginPath(); laser.moveTo(wx,wy); laser.lineTo(e.sprite.x,e.sprite.y); laser.strokePath();
                    laser.fillStyle(0x88ddff,0.8); laser.fillCircle(e.sprite.x,e.sprite.y,6);
                    laser.fillStyle(0xffffff,0.9); laser.fillCircle(e.sprite.x,e.sprite.y,2.5);
                    this.tweens.add({targets:laser,alpha:0,duration:250,onComplete:()=>laser.destroy()});
                    e._iceLastHitAt=this.time.now;   // feeds the rotation term in _pickIceTargets
                    const dmg=8*dmgMult;
                    this._lastDamageFromWisp=true; this._lastDamageFromIce=true;
                    e.health-=dmg; this.updateEnemyHealthBar(e);
                    this._lastDamageFromWisp=false; this._lastDamageFromIce=false;
                    if(e.health<=0){ this.killEnemy(e); continue; }
                    // If already frozen → this follow-up ice hit SHATTERS it.
                    if(e._iceFrozen){
                        this._shatterFrozen(e);
                        continue;
                    }
                    // Otherwise roll for a freeze. Base 15%, +upgrade, +big bonus if WET,
                    // and doubled chance AND duration on a Deep Freeze locked target.
                    let chance=(this._iceFreezeChance||0.15)+(this._iceFreezeBonus||0);
                    if(e._wetUntil>this.time.now) chance+=(this._iceWetFreezeBonus||0.35);
                    const locked=this._iceDeepFreeze&&e===this._iceLockTarget;
                    if(locked) chance*=2;
                    if(Math.random()<chance) this._freezeIceTarget(e,locked?2:1);
                }
            }

            // ── BOOM WISP: chain detonator — plants bombs that chain on death/timer ──
            else if(pet.type==='boom'){
                const tgt=inRange[0];
                // Laser plant beam
                const laser=this.add.graphics().setDepth(5);
                laser.lineStyle(14,0xff4400,0.12); laser.beginPath(); laser.moveTo(wx,wy); laser.lineTo(tgt.sprite.x,tgt.sprite.y); laser.strokePath();
                laser.lineStyle(6,0xff8844,0.7); laser.beginPath(); laser.moveTo(wx,wy); laser.lineTo(tgt.sprite.x,tgt.sprite.y); laser.strokePath();
                laser.lineStyle(2.5,0xff8844,0.95); laser.beginPath(); laser.moveTo(wx,wy); laser.lineTo(tgt.sprite.x,tgt.sprite.y); laser.strokePath();
                laser.lineStyle(1,0xffffff,0.7); laser.beginPath(); laser.moveTo(wx,wy); laser.lineTo(tgt.sprite.x,tgt.sprite.y); laser.strokePath();
                laser.fillStyle(0xff8844,0.9); laser.fillCircle(tgt.sprite.x,tgt.sprite.y,7);
                this.tweens.add({targets:laser,alpha:0,duration:250,onComplete:()=>laser.destroy()});
                this._plantBomb(tgt,dmgMult,0);
            }
        }
    }

    // ─── ICE TARGET SELECTION ──────────────────────────────────────────
    // Previously `inRange.slice(0,beamCount)`, which is raw this.enemies array order —
    // so Ice re-hit whatever sat earliest in the array and fresh arrivals went untouched.
    //
    // Priority, highest first:
    //   1. FROZEN targets. The freeze window is short and the follow-up hit is the whole
    //      payoff (shatter → brittle → puddle → Cascade), so cashing it in always outranks
    //      starting a new freeze. This is the "snap back" half of the behaviour.
    //   2. Among unfrozen: rotation. The longer since Ice last hit an enemy, the higher it
    //      scores, so beams spread freeze ROLLS across distinct targets instead of stacking
    //      redundant hits on one. Never-hit enemies have no _iceLastHitAt and land at the cap.
    //   3. WET targets outrank dry ones — wet adds _iceWetFreezeBonus to the roll, so a hit
    //      spent there converts to a freeze far more often.
    //   4. Distance as a small tiebreak only; it must not outweigh rotation or the wet bonus.
    //
    // Scoring, not sorting by one key, because these need to trade off against each other
    // rather than lexicographically. Returns distinct enemies (entries are unique objects).
    _pickIceTargets(inRange,beamCount){
        // DEEP FREEZE capstone: abandon rotation and pin the toughest enemy in range as the
        // primary beam. Any remaining beams still rotate normally, so beamCount keeps meaning.
        //
        // The remaining beams delegate to _scoreIceTargets rather than recursing into this
        // method — recursing re-entered this same branch and re-assigned _iceLockTarget to
        // the toughest of the REMAINDER, so the doubled freeze chance/duration silently
        // applied to the second-toughest enemy instead of the one actually locked.
        if(this._iceDeepFreeze && inRange.length){
            let lock=null;
            for(const e of inRange) if(!lock||(e.health||0)>(lock.health||0)) lock=e;
            this._iceLockTarget=lock;
            if(beamCount<=1) return [lock];
            return [lock,...this._scoreIceTargets(inRange.filter(e=>e!==lock),beamCount-1)];
        }
        this._iceLockTarget=null;
        return this._scoreIceTargets(inRange,beamCount);
    }

    // The rotation scorer. Split out of _pickIceTargets so Deep Freeze can reuse it for its
    // non-locked beams without re-triggering the lock.
    _scoreIceTargets(inRange,beamCount){
        if(beamCount<=0) return [];
        if(inRange.length<=beamCount) return inRange.slice();
        const now=this.time.now, attackR=(this._petRange||5)*this.TILE_SIZE;
        // Time for every target in range to get one hit, at the current beam count.
        const cycleMs=Math.max(1,(inRange.length/Math.max(1,beamCount))*(this._iceInterval||800));
        const px=this.player?.x??0, py=this.player?.y??0;
        return inRange
            .map(e=>{
                let score=0;
                if(e._iceFrozen){
                    score+=1000;                                   // always cash the shatter
                } else {
                    // Rotation: staleness NORMALISED against how long a full cycle actually
                    // takes, so it saturates exactly when every other target has had a turn.
                    // A fixed cap cannot do this — it has to exceed cycleMs, and cycleMs moves
                    // with pool size, beam count and fire interval. When the cap fell below
                    // cycleMs every candidate pinned to the cap mid-cycle and the distance
                    // tiebreak silently became the sole decider, stranding Ice on the nearest
                    // few enemies. (That shipped once at cap=150, and would have returned the
                    // moment _petIceBeams went back to 1.)
                    score+=600*Math.min(1,(now-(e._iceLastHitAt||0))/cycleMs);
                    // Wet is worth a quarter of a cycle's rotation credit: enough to win
                    // between comparably-stale targets, since a wet hit converts to a freeze
                    // far more often — but a never-hit target still outranks a wet one, so no
                    // single wet enemy gets farmed while untouched enemies wait.
                    if(e._wetUntil>now) score+=150;
                }
                // Tiebreak only: nearer is marginally better. Kept small (max 15) so it
                // decides between otherwise-equal targets and never flips a rotation call.
                const d=Math.hypot((e.sprite?.x??px)-px,(e.sprite?.y??py)-py);
                score+=15*(1-Math.min(1,d/(attackR||1)));
                return {e,score};
            })
            .sort((a,b)=>b.score-a.score)
            .slice(0,beamCount)
            .map(s=>s.e);
    }

    _plantBomb(enemy,dmgMult,depth){
        if(!enemy.sprite?.active)return;
        const TS=this.TILE_SIZE;
        // Stack bombs — each adds to count and refreshes/adds fuse
        enemy._bombStacks=Math.min((enemy._bombStacks||0)+1,6); // hard cap at 6
        enemy._bombDmgMult=dmgMult;
        if(enemy._bombTimer){enemy._bombTimer.remove();}
        const stacks=enemy._bombStacks;
        // Fuse duration shortens with stacks — 3s base, -0.3s per stack, min 1.2s
        const fuseDur=Math.max(1200,3000-stacks*300);
        // Bomb icon — ⊗ drawn above enemy, updates with stack count
        if(!enemy._bombGfx||!enemy._bombGfx.active){
            enemy._bombGfx=this.add.graphics().setDepth(6.5);
            enemy._bombLabel=this.add.text(0,0,'',{fontSize:'8px',fontFamily:'monospace',color:'#ffcc44',stroke:'#000',strokeThickness:2}).setOrigin(0.5).setDepth(6.6);
        }
        const drawBombIcon=()=>{
            if(!enemy.sprite?.active||!enemy._bombGfx?.active)return;
            const ex=enemy.sprite.x, ey=enemy.sprite.y-TS*0.9;
            const pulse=0.7+0.3*Math.sin(this.time.now*0.02*(1+stacks*0.3));
            enemy._bombGfx.clear();
            // Bomb circle
            enemy._bombGfx.fillStyle(0x222222,0.85); enemy._bombGfx.fillCircle(ex,ey,7);
            enemy._bombGfx.lineStyle(2,0xff4400,pulse); enemy._bombGfx.strokeCircle(ex,ey,7);
            // Fuse line
            enemy._bombGfx.lineStyle(1.5,0xffaa44,pulse);
            enemy._bombGfx.beginPath(); enemy._bombGfx.moveTo(ex+3,ey-6); enemy._bombGfx.lineTo(ex+7,ey-11); enemy._bombGfx.strokePath();
            // Fuse spark
            enemy._bombGfx.fillStyle(0xffcc44,pulse); enemy._bombGfx.fillCircle(ex+7,ey-11,2);
            // Stack count
            if(stacks>1){ enemy._bombLabel.setText(`×${stacks}`); enemy._bombLabel.setPosition(ex+9,ey); }
            else { enemy._bombLabel.setText(''); }
        };
        // Animate icon each frame until detonation
        const iconTimer=this.time.addEvent({delay:16,loop:true,callback:()=>{
            if(!enemy.sprite?.active||!enemy._bombGfx?.active){ iconTimer.remove(); return; }
            drawBombIcon();
        }});
        drawBombIcon();
        const detonate=(ex,ey)=>{
            this._addWispMastery('boom',4+stacks*2);  // mastery scales with stacked fuse
            iconTimer.remove();
            enemy._bombGfx?.destroy(); enemy._bombGfx=null;
            enemy._bombLabel?.destroy(); enemy._bombLabel=null;
            enemy._bombStacks=0;
            const aoeR=Math.min(TS*4.0, TS*(2.2+stacks*0.4)); // capped at 4 tiles radius
            const dmg=(35+stacks*18)*dmgMult;
            // Explosion visual — max 4 rings regardless of stacks
            for(let ring=0;ring<Math.min(4,2+stacks);ring++){
                this.time.delayedCall(ring*40,()=>{
                    const exp=this.add.graphics().setDepth(5.5);
                    exp.x=ex; exp.y=ey;
                    exp.fillStyle(0xff2200,0.9); exp.fillCircle(0,0,aoeR*(0.5+ring*0.2));
                    exp.fillStyle(0xff8844,0.7); exp.fillCircle(0,0,aoeR*(0.3+ring*0.15));
                    exp.fillStyle(0xffdd44,0.5); exp.fillCircle(0,0,aoeR*(0.15+ring*0.1));
                    this.tweens.add({targets:exp,scaleX:2.5,scaleY:2.5,alpha:0,duration:400+ring*60,onComplete:()=>exp.destroy()});
                });
            }
            this.cameras.main.shake(Math.min(160,80+stacks*15),Math.min(0.006,0.003+stacks*0.0005));
            // Damage + chain plant on survivors
            for(const e of [...this.enemies]){
                if(!e.sprite?.active||e._isTotem)continue;
                if(Math.hypot(e.sprite.x-ex,e.sprite.y-ey)>aoeR)continue;
                this._lastDamageFromWisp=true; e.health-=dmg; this.updateEnemyHealthBar(e); this._lastDamageFromWisp=false;
                if(e.health<=0){
                    this.killEnemy(e);
                } else if(depth<2){  // max 2 chain levels to prevent cascade lag
                    // Chain — plant a bomb on survivors in blast radius
                    this.time.delayedCall(200,()=>this._plantBomb(e,dmgMult,depth+1));
                }
            }
        };
        // Detonation timer
        enemy._bombTimer=this.time.delayedCall(fuseDur,()=>{
            if(!enemy.sprite?.active)return;
            detonate(enemy.sprite.x,enemy.sprite.y);
        });
        // Also detonate if enemy dies — hook via a flag checked in killEnemy
        enemy._onKillDetonate=()=>{
            if(enemy._bombStacks>0&&enemy._bombTimer){
                enemy._bombTimer.remove();
                detonate(enemy.sprite?.x||enemy.x*TS+TS/2,enemy.sprite?.y||enemy.y*TS+TS/2);
            }
        };
    }

    _openCannonAimPicker(tower){
        const TS=this.TILE_SIZE;
        const def=this._towerDefs()[tower.type];
        const range=(def.range+(tower._rangeBonus||0)+(this._globalRangeBonus||0))*TS;
        const objs=[];
        const tr=o=>{objs.push(o);return o;};

        // Dark overlay
        const overlay=tr(this.add.rectangle(this.cameras.main.scrollX+this.scale.width/2,this.cameras.main.scrollY+this.scale.height/2,this.scale.width,this.scale.height,0x000000,0.45).setDepth(19).setInteractive());

        // Range circle drawn at tower position
        const cirGfx=tr(this.add.graphics().setDepth(20));
        const aimGfx=tr(this.add.graphics().setDepth(20));
        const label=tr(this.add.text(tower.px,tower.py-range-18,'Click to set aim direction',{fontSize:'9px',fontFamily:'monospace',color:'#ff8844',stroke:'#000',strokeThickness:2}).setOrigin(0.5).setDepth(20));

        const draw=(ang,cursorX,cursorY)=>{
            cirGfx.clear();
            // Range ring
            cirGfx.lineStyle(2,0xff8844,0.55); cirGfx.strokeCircle(tower.px,tower.py,range);
            cirGfx.fillStyle(0xff8844,0.07); cirGfx.fillCircle(tower.px,tower.py,range);
            // 8 direction tick marks
            for(let i=0;i<8;i++){
                const a=i/8*Math.PI*2;
                cirGfx.lineStyle(1.5,0xff8844,0.4);
                cirGfx.lineBetween(tower.px+Math.cos(a)*(range-6),tower.py+Math.sin(a)*(range-6),tower.px+Math.cos(a)*range,tower.py+Math.sin(a)*range);
            }
            aimGfx.clear();
            if(ang!==null){
                // Line extends to cursor or range edge, whichever is closer
                const dist=cursorX!==undefined?Math.min(range,Math.hypot(cursorX-tower.px,cursorY-tower.py)):range;
                const ex=tower.px+Math.cos(ang)*dist, ey=tower.py+Math.sin(ang)*dist;
                // Faint extension to ring edge
                aimGfx.lineStyle(1,0xff8844,0.25);
                aimGfx.beginPath(); aimGfx.moveTo(ex,ey); aimGfx.lineTo(tower.px+Math.cos(ang)*range,tower.py+Math.sin(ang)*range); aimGfx.strokePath();
                // Main aim line
                aimGfx.lineStyle(2.5,0xff8844,0.95);
                aimGfx.beginPath(); aimGfx.moveTo(tower.px,tower.py); aimGfx.lineTo(ex,ey); aimGfx.strokePath();
                // Dot at cursor position
                aimGfx.fillStyle(0xff8844,1); aimGfx.fillCircle(ex,ey,6);
                aimGfx.fillStyle(0xffffff,0.9); aimGfx.fillCircle(ex,ey,2.5);
                // Ring edge indicator
                aimGfx.fillStyle(0xff8844,0.4); aimGfx.fillCircle(tower.px+Math.cos(ang)*range,tower.py+Math.sin(ang)*range,4);
                label.setText(`🎯 ${Math.round(ang*(180/Math.PI))}° — click to confirm`);
            }
        };
        draw(tower._cannonFixedAng??null, tower._cannonFixedAng!==undefined?tower.px+Math.cos(tower._cannonFixedAng)*(tower._cannonFixedDist??range):undefined, tower._cannonFixedAng!==undefined?tower.py+Math.sin(tower._cannonFixedAng)*(tower._cannonFixedDist??range):undefined);

        const close=()=>{ objs.forEach(o=>o?.destroy()); this._openUpgradeMenu(tower); };
        // Click anywhere on overlay — set angle
        overlay.on('pointerdown',p=>{ p.event.stopPropagation(); const dx=p.worldX-tower.px,dy=p.worldY-tower.py; const ang=Math.atan2(dy,dx); tower._cannonFixedAng=ang; tower._cannonFixedDist=Math.min(range,Math.hypot(dx,dy)); tower._mgAimGfx?.clear(); draw(ang,p.worldX,p.worldY); close(); });
        // Circle interaction — hover shows preview, click confirms
        const hitCirc=tr(this.add.circle(tower.px,tower.py,range+20,0xffffff,0).setDepth(20).setInteractive());
        hitCirc.on('pointerdown',p=>{
            p.event.stopPropagation();
            const dx=p.worldX-tower.px, dy=p.worldY-tower.py;
            const ang=Math.atan2(dy,dx);
            const dist=Math.min(range,Math.hypot(dx,dy));
            tower._cannonFixedAng=ang;
            tower._cannonFixedDist=dist;
            draw(ang,p.worldX,p.worldY); close();
        });
        hitCirc.on('pointermove',p=>{ const ang=Math.atan2(p.worldY-tower.py,p.worldX-tower.px); draw(ang,p.worldX,p.worldY); });
        // Close on Escape
        const onEsc=()=>{ this.input.keyboard.off('keydown-ESC',onEsc); close(); };
        this.input.keyboard.on('keydown-ESC',onEsc);
    }

    _cannonBounceArc(fromX,fromY,toX,toY,dirX,dirY,hopDist,bouncesLeft,baseDmg,aoeR,coreR,shellR,isBowler){
        const TS=this.TILE_SIZE;
        const flightDist=Math.hypot(toX-fromX,toY-fromY);
        const dur=400+Math.min(flightDist/TS,8)/8*300;
        const arcH=20+Math.min(flightDist/TS,6)/6*30;

        // Shadow
        const shadow=this.add.ellipse(fromX,fromY,shellR*1.4,shellR*0.7,0x000000,0.3).setDepth(0.5);
        this.tweens.add({targets:shadow,x:toX,y:toY,scaleX:2,alpha:0.4,duration:dur,ease:'Linear'});

        // Ball graphic
        const ball=this.add.graphics().setDepth(5);
        ball.x=fromX; ball.y=fromY;
        const startX=fromX,startY=fromY;
        let elapsed=0,rot=0;
        const arc=this.time.addEvent({delay:16,loop:true,callback:()=>{
            elapsed+=16;
            const t=Math.min(elapsed/dur,1);
            ball.x=startX+(toX-startX)*t;
            ball.y=startY+(toY-startY)*t - 4*arcH*t*(1-t);
            rot+=15*(16/1000);
            ball.clear();
            ball.fillStyle(isBowler?0x888899:0xff8844,1); ball.fillCircle(0,0,shellR);
            ball.fillStyle(0xffdd44,0.7); ball.fillCircle(0,0,shellR*0.5);
            const sx=Math.cos(rot)*shellR*0.4, sy=Math.sin(rot)*shellR*0.4;
            ball.fillStyle(0xffffff,0.5); ball.fillCircle(sx,sy,shellR*0.25);
            if(t>=1){
                arc.remove(); ball.destroy(); shadow.active&&shadow.destroy();
                // Impact
                this._cannonImpact({_canCoreStun:false,_canAftershock:false,_canCatapult:false,_canCarpetBomb:false,_canPctDmg:0},toX,toY,baseDmg*0.7,aoeR,coreR,flightDist,false);
                // Bowling ball on last bounce of last shell
                if(isBowler&&bouncesLeft===0) this._fireBowlingBall({px:fromX,py:fromY},toX,toY,baseDmg,aoeR);
                // Next bounce — same hop distance, same direction
                if(bouncesLeft>0){
                    const nx=toX+dirX*hopDist, ny=toY+dirY*hopDist;
                    const ntx=Math.floor(nx/TS),nty=Math.floor(ny/TS);
                    if(this.world[ntx]?.[nty]===this.FLOOR)
                        this._cannonBounceArc(toX,toY,nx,ny,dirX,dirY,hopDist,bouncesLeft-1,baseDmg,aoeR,coreR,shellR,isBowler);
                }
            }
        }});
    }

    _fireBowlingBall(tower,tx,ty,baseDmg,aoeR){
        const TS=this.TILE_SIZE;
        const ang=Math.atan2(ty-tower.py,tx-tower.px);
        const ball=this.add.graphics().setDepth(5.5);
        ball.x=tx; ball.y=ty;
        const speed=180;
        let rot=0;
        const hitCooldowns=new Map();
        const roll=this.time.addEvent({delay:16,loop:true,callback:()=>{
            if(!ball.active){roll.remove();return;}
            ball.x+=Math.cos(ang)*speed*(16/1000);
            ball.y+=Math.sin(ang)*speed*(16/1000);
            rot+=20;
            ball.clear();
            ball.fillStyle(0x333344,1); ball.fillCircle(0,0,13);
            ball.fillStyle(0x666677,0.9); ball.fillCircle(0,0,9);
            ball.fillStyle(0x9999aa,0.6); ball.fillCircle(0,0,5);
            const sx=Math.cos(rot*Math.PI/180)*5, sy=Math.sin(rot*Math.PI/180)*5;
            ball.fillStyle(0xddddee,0.8); ball.fillCircle(sx,sy,3);
            // Grind trail
            ball.lineStyle(2,0xffaa44,0.35);
            ball.beginPath();
            ball.moveTo(-Math.cos(ang)*10,-Math.sin(ang)*10);
            ball.lineTo(-Math.cos(ang)*22,-Math.sin(ang)*22);
            ball.strokePath();
            const btx=Math.floor(ball.x/TS), bty=Math.floor(ball.y/TS);
            if(this.world[btx]?.[bty]!==this.FLOOR){
                const wallExp=this.add.graphics().setDepth(5);
                wallExp.x=ball.x; wallExp.y=ball.y;
                wallExp.fillStyle(0x666677,0.8); wallExp.fillCircle(0,0,aoeR);
                wallExp.fillStyle(0xffffff,0.4); wallExp.fillCircle(0,0,aoeR*0.4);
                this.tweens.add({targets:wallExp,scaleX:1.8,scaleY:1.8,alpha:0,duration:400,onComplete:()=>wallExp.destroy()});
                this.cameras.main.shake(150,0.006);
                ball.destroy(); roll.remove(); return;
            }
            const now=this.time.now;
            for(const e of [...this.enemies]){
                if(!e.sprite?.active)continue;
                if(Math.hypot(e.sprite.x-ball.x,e.sprite.y-ball.y)>TS*1.0)continue;
                const lastHit=hitCooldowns.get(e)||0;
                if(now-lastHit<80)continue;
                hitCooldowns.set(e,now);
                const grindDmg=baseDmg*0.25;
                e.health-=grindDmg; this.updateEnemyHealthBar(e);
                // Push forward in roll direction — short push, keeps enemy in contact
                const pushX=e.sprite.x+Math.cos(ang)*TS*0.9;
                const pushY=e.sprite.y+Math.sin(ang)*TS*0.9;
                const ptx=Math.floor(pushX/TS), pty=Math.floor(pushY/TS);
                if(this.world[ptx]?.[pty]===this.FLOOR){
                    e.x=ptx; e.y=pty;
                    this.tweens.killTweensOf(e.sprite);
                    this.tweens.add({targets:e.sprite,x:ptx*TS+TS/2,y:pty*TS+TS/2,duration:80,ease:'Linear'});
                }
                if(e.health<=0)this.killEnemy(e);
            }
        }});
    }

    _spawnLavaTile(tileX,tileY,durationMs=4000){
        if(!this._lavaTiles) this._lavaTiles=[];
        // Refresh if tile already exists there
        const existing=this._lavaTiles.find(t=>t.tileX===tileX&&t.tileY===tileY);
        if(existing){ existing.createdAt=this.time.now; existing.durationMs=durationMs; return; }
        if(this.world[tileX]?.[tileY]!==this.FLOOR)return;
        const TS=this.TILE_SIZE;
        const px=tileX*TS+TS/2, py=tileY*TS+TS/2;
        // Exact main-game lava tile: 3-layer rectangle stack
        const base=this.add.rectangle(px,py,TS,TS,0xcc2200,0.85).setDepth(0.5);
        const glow=this.add.rectangle(px,py,TS-4,TS-4,0xff6600,0.6).setDepth(0.51);
        const core=this.add.rectangle(px,py,TS-10,TS-10,0xffaa00,0.4).setDepth(0.52);
        this.tweens.add({targets:glow,alpha:0.9,duration:180,yoyo:true,repeat:-1,ease:'Sine.easeInOut'});
        this.tweens.add({targets:core,alpha:0.7,scaleX:0.85,scaleY:0.85,duration:130,yoyo:true,repeat:-1,ease:'Sine.easeInOut',delay:60});
        this._lavaTiles.push({tileX,tileY,visuals:[base,glow,core],createdAt:this.time.now,durationMs,_lastTick:0});
    }

    _spawnLavaTilesInCircle(cx,cy,radiusPx,durationMs=4000){
        // Spawn a lava tile on every floor tile within the radius
        const TS=this.TILE_SIZE;
        const tileR=Math.ceil(radiusPx/TS);
        const centerTX=Math.floor(cx/TS), centerTY=Math.floor(cy/TS);
        for(let dx=-tileR;dx<=tileR;dx++){
            for(let dy=-tileR;dy<=tileR;dy++){
                const tx=centerTX+dx, ty=centerTY+dy;
                const px=tx*TS+TS/2, py=ty*TS+TS/2;
                if(Math.hypot(px-cx,py-cy)<=radiusPx){
                    this._spawnLavaTile(tx,ty,durationMs);
                }
            }
        }
    }

    _updateLavaTiles(time){
        if(!this._lavaTiles?.length)return;
        const TICK=80, PCT=0.01/12; // ~1% HP per second, ticked every 80ms
        for(let i=this._lavaTiles.length-1;i>=0;i--){
            const lt=this._lavaTiles[i];
            const age=time-lt.createdAt;
            if(age>=lt.durationMs){
                for(const v of lt.visuals){this.tweens.killTweensOf(v);v.active&&v.destroy();}
                this._lavaTiles.splice(i,1); continue;
            }
            // Fade out last 400ms
            if(age>lt.durationMs-400){
                const fadeAlpha=1-(age-(lt.durationMs-400))/400;
                for(const v of lt.visuals) v.setAlpha(v.alpha*fadeAlpha);
            }
            // Damage tick
            if(time-lt._lastTick>=TICK){
                lt._lastTick=time;
                for(const e of [...this.enemies]){
                    if(!e.sprite?.active||e.x!==lt.tileX||e.y!==lt.tileY)continue;
                    const dmg=e.health*PCT;
                    e.health-=dmg; this.updateEnemyHealthBar(e);
                    if(e.health<=0)this.killEnemy(e);
                }
            }
        }
    }

    _cannonImpact(tower,tx,ty,baseDmg,aoeR,coreR,travelDist,isBowler){
        const TS=this.TILE_SIZE;
        const pctDmg=tower._canPctDmg||0;

        // ── CATAPULT: entirely replaces normal shell ──────────────────────────
        if(tower._canCatapult){
            const miniCount=20, spreadR=aoeR*1.5;
            const arcShell=this.add.graphics().setDepth(6);
            arcShell.fillStyle(0x884422,1); arcShell.fillCircle(0,0,8);
            arcShell.fillStyle(0xff6622,0.8); arcShell.fillCircle(0,0,5);
            arcShell.x=tower.px; arcShell.y=tower.py;
            const peakX=(tower.px+tx)/2;
            const peakY=Math.min(tower.py,ty)-140;
            this.tweens.add({targets:arcShell,x:peakX,y:peakY,duration:550,ease:'Sine.easeOut',
                onComplete:()=>{
                    // Fall to target — split via delayedCall at 40% of fall (200ms in)
                    this.tweens.add({targets:arcShell,x:tx,y:ty,duration:500,ease:'Sine.easeIn'});
                    this.time.delayedCall(200,()=>{
                        if(!arcShell.active)return;
                        const splitX=arcShell.x, splitY=arcShell.y;
                        arcShell.destroy();
                        // Flash
                        const flash=this.add.graphics().setDepth(7);
                        flash.x=splitX; flash.y=splitY;
                        flash.fillStyle(0xff8844,0.9); flash.fillCircle(0,0,14);
                        this.tweens.add({targets:flash,scaleX:2.5,scaleY:2.5,alpha:0,duration:250,onComplete:()=>flash.destroy()});
                        // 20 mini-balls all spawn at once, land simultaneously
                        for(let m=0;m<miniCount;m++){
                            const ang=(m/miniCount)*Math.PI*2+(Math.random()-0.5)*0.4;
                            const dist=Math.random()*spreadR;
                            const mx=tx+Math.cos(ang)*dist, my=ty+Math.sin(ang)*dist;
                            const mini=this.add.graphics().setDepth(6);
                            mini.fillStyle(0xff6622,1); mini.fillCircle(0,0,3.5);
                            mini.fillStyle(0xffaa44,0.8); mini.fillCircle(0,0,1.5);
                            mini.x=splitX; mini.y=splitY;
                            this.tweens.add({targets:mini,x:mx,y:my,duration:300,ease:'Quad.easeIn',
                                onComplete:()=>{
                            mini.destroy();
                                    const miniR=TS*1.8; // much bigger explosion
                                    const miniExp=this.add.graphics().setDepth(5);
                                    miniExp.x=mx; miniExp.y=my;
                                    miniExp.fillStyle(0xff6622,0.7); miniExp.fillCircle(0,0,miniR);
                                    miniExp.fillStyle(0xffdd44,0.5); miniExp.fillCircle(0,0,miniR*0.55);
                                    miniExp.fillStyle(0xffffff,0.3); miniExp.fillCircle(0,0,miniR*0.25);
                                    this.tweens.add({targets:miniExp,scaleX:1.5,scaleY:1.5,alpha:0,duration:300,onComplete:()=>miniExp.destroy()});
                                    // Lava tile always spawns on landing
                                    if(tower._canNapalm) this._spawnLavaTilesInCircle(mx,my,miniR);
                                    for(const e of [...this.enemies]){
                                        if(!e.sprite?.active)continue;
                                        if(Math.hypot(e.sprite.x-mx,e.sprite.y-my)>miniR)continue;
                                        const mDmg=baseDmg*0.35;
                                        e.health-=mDmg; this.updateEnemyHealthBar(e);
                                        if(e.health<=0){ this.killEnemy(e); continue; }
                                    }
                                }
                            });
                        }
                    });
                }
            });
            return; // catapult handles everything — no normal impact
        }

        // ── NORMAL IMPACT ─────────────────────────────────────────────────────
        const exp=this.add.graphics().setDepth(5);
        exp.x=tx; exp.y=ty;
        exp.fillStyle(0xff8844,0.65); exp.fillCircle(0,0,aoeR);
        exp.fillStyle(0xffdd44,0.45); exp.fillCircle(0,0,aoeR*0.5);
        if(coreR>0){ exp.fillStyle(0xffffff,0.5); exp.fillCircle(0,0,coreR); }
        this.tweens.add({targets:exp,scaleX:1.5,scaleY:1.5,alpha:0,duration:320,onComplete:()=>exp.destroy()});
        this.cameras.main.shake(60,0.002);

        for(const e of [...this.enemies]){
            if(!e.sprite?.active)continue;
            const d=Math.hypot(e.sprite.x-tx,e.sprite.y-ty);
            if(d>aoeR)continue;
            let dmg=baseDmg+(e.health*pctDmg);
            if(d<=coreR) dmg+=e.health*0.05;
            e.health-=dmg; this.updateEnemyHealthBar(e);
            if(e.health<=0){ this.killEnemy(e); continue; }
            if(d<=coreR&&tower._canCoreStun) this.freezeEnemy?.(e,1200);
        }

        // Bowling ball rolls from tower through target until hitting a wall
        if(isBowler) this._fireBowlingBall(tower,tx,ty,baseDmg,aoeR);
        if(tower._canAftershock&&coreR>0){
            this.time.delayedCall(400,()=>{
                const exp2=this.add.graphics().setDepth(5);
                exp2.x=tx; exp2.y=ty;
                exp2.fillStyle(0xff4422,0.7); exp2.fillCircle(0,0,coreR*1.3);
                exp2.fillStyle(0xffffff,0.4); exp2.fillCircle(0,0,coreR*0.6);
                this.tweens.add({targets:exp2,scaleX:1.8,scaleY:1.8,alpha:0,duration:350,onComplete:()=>exp2.destroy()});
                for(const e of [...this.enemies]){
                    if(!e.sprite?.active)continue;
                    if(Math.hypot(e.sprite.x-tx,e.sprite.y-ty)<=coreR*1.3){
                        e.health-=baseDmg*0.6+e.health*0.02;
                        this.updateEnemyHealthBar(e);
                        if(e.health<=0)this.killEnemy(e);
                    }
                }
            });
        }
    }

    _skywardStrike(tower,enemies){
        const waveNum=this.wave||1;
        const totalStrikes=Math.max(waveNum, enemies.length) * 2;
        const baseDmg=(100+(tower._skyBaseDmgBonus||0))*(1+waveNum*0.1)*(this.turretDmgMult||1);
        const pctDmg=0.05+(tower._skyPctBonus||0);
        const aoeR=(2+(tower._skyAoeBonus||0))*this.TILE_SIZE;
        const executeThreshold=tower._skyExecuteThreshold||0;
        const targets=Phaser.Utils.Array.Shuffle([...enemies]).slice(0,totalStrikes);

        this._showFloatingText(tower.px,tower.py-24,'SKYWARD!','#ff4422');

        // Animate the tower — scale up briefly then pulse on each launch
        const skyTower=this.towers.find(t=>t===tower);
        if(skyTower?.body?.active){
            this.tweens.add({targets:skyTower.body,scaleX:1.4,scaleY:1.4,duration:200,yoyo:true,ease:'Quad.easeOut'});
        }

        // Launch visuals upward fast — max 12 shells for performance
        const launchCount=Math.min(totalStrikes,Math.max(12,Math.floor(waveNum/3)));
        for(let i=0;i<launchCount;i++){
            this.time.delayedCall(i*150,()=>{
                if(!tower.active)return;
                // Flash tower body
                if(tower.body?.active){
                    tower.body.setAlpha(0.4);
                    this.tweens.add({targets:tower.body,alpha:1,duration:80});
                }
                const shell=this.add.graphics().setDepth(6);
                shell.fillStyle(0xff6644,1); shell.fillCircle(0,0,5);
                shell.fillStyle(0xffaa44,0.7); shell.fillCircle(0,0,3);
                shell.x=tower.px+(Math.random()-0.5)*20;
                shell.y=tower.py;
                // Fast upward — exits screen in ~400ms
                this.tweens.add({
                    targets:shell,
                    x:shell.x+(Math.random()-0.5)*80,
                    y:-40,
                    duration:350+Math.random()*100,
                    ease:'Quad.easeIn',
                    onComplete:()=>shell.destroy()
                });
            });
        }

        // Rain down — staggered, each shell from off-screen top, slow and heavy
        targets.forEach((target,i)=>{
            const warnDelay=900+i*150;
            const strikeDelay=warnDelay+600;

            // Stomp-style target crosshair drawn on the enemy
            this.time.delayedCall(warnDelay,()=>{
                if(!target.sprite?.active)return;
                const tx=target.sprite.x, ty=target.sprite.y;
                const tgfx=this.add.graphics().setDepth(4.5);
                const TS=this.TILE_SIZE;
                const startT=this.time.now;
                const timer=this.time.addEvent({delay:20,loop:true,callback:()=>{
                    if(!tgfx.active){timer.remove();return;}
                    const elapsed=this.time.now-startT;
                    if(elapsed>=600){tgfx.destroy();timer.remove();return;}
                    const flash=0.6+0.4*Math.sin(elapsed*0.04);
                    tgfx.clear();
                    tgfx.lineStyle(2.5,0xff2200,0.85*flash);
                    tgfx.strokeCircle(tx,ty,TS*1.1);
                    tgfx.lineStyle(1,0xff6600,0.5*flash);
                    tgfx.strokeCircle(tx,ty,TS*0.55);
                    const cl=TS*1.5;
                    tgfx.lineStyle(1.5,0xff2200,0.7*flash);
                    tgfx.beginPath();tgfx.moveTo(tx-cl,ty);tgfx.lineTo(tx+cl,ty);tgfx.strokePath();
                    tgfx.beginPath();tgfx.moveTo(tx,ty-cl);tgfx.lineTo(tx,ty+cl);tgfx.strokePath();
                }});
                // Safety: force destroy after 650ms regardless
                this.time.delayedCall(650,()=>{ timer.remove(); tgfx?.active&&tgfx.destroy(); });
            });

            // Shell falls from off-screen — slow and heavy
            this.time.delayedCall(strikeDelay,()=>{
                if(!target.sprite?.active)return;
                const tx=target.sprite.x, ty=target.sprite.y;

                const bolt=this.add.graphics().setDepth(7);
                bolt.fillStyle(0xff4422,1); bolt.fillCircle(0,0,7);
                bolt.fillStyle(0xff8844,0.9); bolt.fillCircle(0,0,4);
                bolt.fillStyle(0xffffff,0.7); bolt.fillCircle(0,0,2);
                bolt.x=tx+(Math.random()-0.5)*30;
                bolt.y=-30; // off screen top

                // Slow heavy fall — 1500ms, easeIn to feel weighty
                this.tweens.add({
                    targets:bolt,
                    x:tx, y:ty,
                    duration:1500,
                    ease:'Quad.easeIn',
                    onComplete:()=>{
                        bolt.destroy();
                        // Impact explosion
                        const exp=this.add.graphics().setDepth(5.5);
                        exp.x=tx; exp.y=ty;
                        exp.fillStyle(0xff4422,0.8); exp.fillCircle(0,0,aoeR);
                        exp.fillStyle(0xffcc44,0.55); exp.fillCircle(0,0,aoeR*0.6);
                        exp.fillStyle(0xffffff,0.4); exp.fillCircle(0,0,aoeR*0.28);
                        this.tweens.add({targets:exp,scaleX:1.6,scaleY:1.6,alpha:0,duration:450,onComplete:()=>exp.destroy()});
                        // Heavier shake per impact
                        this.cameras.main.shake(120,0.0055);
                        // Damage
                        for(const e of [...this.enemies]){
                            if(!e.sprite?.active)continue;
                            if(Math.hypot(e.sprite.x-tx,e.sprite.y-ty)>aoeR)continue;
                            let dmg=baseDmg+e.health*pctDmg;
                            if(executeThreshold>0&&e.health/e.maxHealth<=executeThreshold){
                                dmg=e.health+1;
                                this._showFloatingText(e.sprite.x,e.sprite.y-20,'EXECUTE','#ff2200');
                            }
                            if(tower._skyColdEfficiency&&e.health/e.maxHealth<=(tower._skyColdThreshold||0.25)){
                                dmg=e.health+1;
                                this._showFloatingText(e.sprite.x,e.sprite.y-20,'COLD EFFICIENCY','#aaddff');
                            }
                            e.health-=dmg;
                            this.updateEnemyHealthBar(e);
                            if(e.health<=0)this.killEnemy(e);
                        }
                    }
                });
            });
        });
    }

    _updateAuras(time,dt){
        if(this.baseHealRate>0)this.baseHP=Math.min(this.baseMaxHP,this.baseHP+this.baseHealRate*dt);
        // Is a Bulwark-Aura fountain covering the base this frame?
        this._baseWardActive=false;
        for(const h of (this.towers||[])){
            if(!h.active||!h._baseWard)continue;
            const d=this._towerDefs()[h.type];
            const r=((d?.range||0)+(h._rangeBonus||0))*this.TILE_SIZE;
            if(Math.hypot(h.px-this.basePx,h.py-this.basePy)<=r){ this._baseWardActive=true; break; }
        }
        // FOUNTAIN BASE PROJECTILE SHIELD — any fountain whose aura reaches the base
        // regenerates a shield pool that absorbs incoming projectile/ranged damage. This is
        // the fountain's core defensive role: without one, mortar/sniper barrages hit the base
        // directly; with one, the shield soaks them until it's spent, then regenerates.
        let shieldCap=0, shieldRegen=0;
        for(const h of (this.towers||[])){
            if(!h.active||h.type!=='healing_fountain')continue;
            const d=this._towerDefs()[h.type];
            const r=((d?.range||0)+(h._rangeBonus||0))*this.TILE_SIZE;
            if(Math.hypot(h.px-this.basePx,h.py-this.basePy)<=r+2*this.TILE_SIZE){
                const cap=140*(1+(h._baseRepairRate||0)*0.12); // Fortify Core enlarges the pool
                shieldCap=Math.max(shieldCap,cap);
                shieldRegen+=14+(h._baseRepairRate||0)*1.2;     // HP/s of shield regen, stacks per fountain
            }
        }
        this._baseProjShieldCap=shieldCap;
        if(shieldCap>0){
            this._baseProjShield=Math.min(shieldCap,(this._baseProjShield||0)+shieldRegen*dt);
        } else {
            this._baseProjShield=0; // no covering fountain → no shield
        }
        // Shield bubble visual around the base, opacity/size scaled to current shield.
        if(!this._baseShieldGfx) this._baseShieldGfx=this.add.graphics().setDepth(4.5);
        const bg=this._baseShieldGfx; bg.clear();
        if(this._baseProjShield>0 && this._baseProjShieldCap>0){
            const frac=this._baseProjShield/this._baseProjShieldCap;
            const rad=this._centreRoom ? Math.min(this._centreRoom.w,this._centreRoom.h)*this.TILE_SIZE*0.32 : 90;
            const pulse=0.5+0.5*Math.sin(time*0.004);
            bg.lineStyle(2.5,0x88ddff,0.3+0.4*frac);
            bg.strokeCircle(this.basePx,this.basePy,rad);
            bg.fillStyle(0x66ccff,0.04+0.08*frac*pulse);
            bg.fillCircle(this.basePx,this.basePy,rad);
            // hex-facet arcs to read as a shield, brighter when fuller
            bg.lineStyle(1.5,0xaaeeff,0.15+0.25*frac);
            for(let k=0;k<6;k++){ const a=k*Math.PI/3+time*0.0005; bg.lineBetween(this.basePx+Math.cos(a)*rad*0.7,this.basePy+Math.sin(a)*rad*0.7,this.basePx+Math.cos(a)*rad,this.basePy+Math.sin(a)*rad); }
        }
        // Regen Field (healer turret upgrade): passively trickle-heal towers in range.
        for(const h of (this.towers||[])){
            if(!h.active||!h._regenField)continue;
            const d=this._towerDefs()[h.type];
            const r=((d?.range||0)+(h._rangeBonus||0))*this.TILE_SIZE;
            for(const t2 of this.towers){
                if(t2===h||!t2.active)continue;
                // Passive regen only tops a tower up to 60% — it stabilizes a battered tower
                // but can't sustain it to full under sustained fire (that needs active heals).
                const cap=t2.maxHp*0.6;
                if(t2.hp>=cap||t2._healBlocked)continue;
                if(Math.hypot(t2.px-h.px,t2.py-h.py)<=r){
                    t2.hp=Math.min(cap,t2.hp+h._regenField*dt);
                }
            }
        }
        for(const aura of this.baseAuras){
            const r=(3+1.5+aura.tier)*this.TILE_SIZE;
            if(aura.type==='poison')for(const e of [...this.enemies]){if(!e.sprite?.active||Math.hypot(e.sprite.x-this.basePx,e.sprite.y-this.basePy)>r)continue;if(!e._poisonTick||time-e._poisonTick>500){e._poisonTick=time;e.health-=2+aura.tier*2;this.updateEnemyHealthBar(e);if(e.health<=0)this.killEnemy(e);}}
            if(aura.type==='heal'&&Math.hypot(this.player.x-this.basePx,this.player.y-this.basePy)<=r)this.playerHP=Math.min(this.playerMaxHP,this.playerHP+(1+aura.tier)*dt);
        }
        if(this._auraGfx?.active){const g=this._auraGfx,t=time*0.001;g.clear();for(const a of this.baseAuras){const r=(3+1.5+a.tier)*this.TILE_SIZE,col=a.type==='heal'?0x44ff88:0x88ff44;g.lineStyle(2,col,0.3+0.1*Math.sin(t*2));g.strokeCircle(this.basePx,this.basePy,r);g.fillStyle(col,0.05);g.fillCircle(this.basePx,this.basePy,r);}}
    }

    // ─── BUILD MENU ───────────────────────────────────────────────────────────
    _buildBuildMenu(){
        const defs=this._towerDefs(),types=Object.keys(defs),W=this.scale.width,H=this.scale.height;
        const cols=4,btnW=116,btnH=108,gap=12,rows=Math.ceil(types.length/cols);
        const totalW=cols*btnW+(cols-1)*gap,sx=W/2-totalW/2,sy=H/2-(rows*(btnH+gap))/2-28;
        this._bmObjs=[];const tr=o=>{this._bmObjs.push(o);return o;};
        tr(this.add.rectangle(W/2,H/2,W,H,0x000000,0.72).setScrollFactor(0).setDepth(20).setVisible(false).setInteractive());
        const panel=tr(this.add.graphics().setScrollFactor(0).setDepth(21).setVisible(false));
        panel.fillStyle(0x12121e,0.97);panel.fillRoundedRect(sx-18,sy-34,totalW+36,rows*(btnH+gap)+64,10);
        panel.lineStyle(1.5,0x2a3a5a,0.8);panel.strokeRoundedRect(sx-18,sy-34,totalW+36,rows*(btnH+gap)+64,10);
        tr(this.add.text(W/2,sy-18,'⚙  BUILD TOWER  [Q to close]',{fontSize:'15px',fontFamily:'monospace',color:'#aaddff',stroke:'#000',strokeThickness:3}).setOrigin(0.5).setScrollFactor(0).setDepth(22).setVisible(false));
        this._bmBtnData=[];
        for(let i=0;i<types.length;i++){
            const type=types[i],def=defs[type],col=i%cols,row=Math.floor(i/cols),bx=sx+col*(btnW+gap),by=sy+row*(btnH+gap);
            const bg=tr(this.add.graphics().setScrollFactor(0).setDepth(22).setVisible(false));
            const nameT=tr(this.add.text(bx+btnW/2,by+68,def.name,{fontSize:'10px',fontFamily:'monospace',color:'#'+def.color.toString(16).padStart(6,'0'),fontStyle:'bold'}).setOrigin(0.5).setScrollFactor(0).setDepth(23).setVisible(false));
            const costT=tr(this.add.text(bx+btnW/2,by+80,`⚙ ${this._getTowerCost(type)}`,{fontSize:'10px',fontFamily:'monospace',color:'#ffdd88'}).setOrigin(0.5).setScrollFactor(0).setDepth(23).setVisible(false));
            tr(this.add.text(bx+btnW/2,by+92,def.desc,{fontSize:'8px',fontFamily:'monospace',color:'#556688',wordWrap:{width:btnW-8}}).setOrigin(0.5,0).setScrollFactor(0).setDepth(23).setVisible(false));
            const miniG=tr(this.add.graphics().setScrollFactor(0).setDepth(23).setVisible(false));
            this._drawTowerMini(miniG,type,def,bx+btnW/2,by+32);
            const drawBtn=hov=>{bg.clear();bg.fillStyle(hov?0x223050:0x1a2035,0.98);bg.fillRoundedRect(bx,by,btnW,btnH,7);bg.lineStyle(1.5,def.color,hov?1:0.55);bg.strokeRoundedRect(bx,by,btnW,btnH,7);};drawBtn(false);
            const hit=tr(this.add.rectangle(bx+btnW/2,by+btnH/2,btnW,btnH,0xffffff,0).setScrollFactor(0).setDepth(24).setVisible(false).setInteractive());
            hit.on('pointerover',()=>drawBtn(true));hit.on('pointerout',()=>drawBtn(false));
            hit.on('pointerdown',p=>{
                p.event.stopPropagation();
                if(!this._buildMenuOpen)return;
                // Skyward is unique — max 1
                if(type==='skyward'&&this.towers.some(t=>t.type==='skyward')){
                    this._showFloatingText(W/2,H/2+20,'SKYWARD ALREADY DEPLOYED','#ff6644',0);return;
                }
                const cost=this._getTowerCost(type);
                if(this.scraps<cost){this._showFloatingText(W/2,H/2+20,'NOT ENOUGH SCRAPS','#ff6644',0);return;}
                this._closeBuildMenu();
                this.time.delayedCall(50,()=>this._startPlacementMode(type));
            });
            this._bmBtnData.push({bg,miniG,nameT,costT,hit,type,def,drawBtn});
        }
    }

    _drawTowerMini(g,type,def,cx,cy){
        g.clear();g.fillStyle(0x2a2a3c,1);g.fillRect(cx-17,cy-17,34,34);g.lineStyle(1.5,def.color,0.65);g.strokeRect(cx-17,cy-17,34,34);
        switch(type){
            case 'tesla_coil':   g.lineStyle(2.5,0x44aaff,1);g.beginPath();g.moveTo(cx,cy-13);g.lineTo(cx,cy+13);g.strokePath();g.beginPath();g.moveTo(cx-8,cy-4);g.lineTo(cx,cy-13);g.lineTo(cx+8,cy-4);g.strokePath();g.fillStyle(0xaaffff,1);g.fillCircle(cx,cy-13,4);break;
            case 'sniper':       g.fillStyle(0x555566,1);g.fillRect(cx-4,cy-14,8,24);g.fillStyle(0xff6644,1);g.fillCircle(cx,cy,6);g.lineStyle(3.5,0xff8866,1);g.beginPath();g.moveTo(cx,cy);g.lineTo(cx,cy-15);g.strokePath();break;
            case 'machine_gun':  g.fillStyle(0x999aaa,1);g.fillRect(cx-12,cy-5,24,10);g.fillStyle(0xffcc44,1);g.fillCircle(cx,cy,6);g.lineStyle(3,0xffeeaa,1);g.beginPath();g.moveTo(cx+6,cy-3);g.lineTo(cx+15,cy-3);g.strokePath();g.beginPath();g.moveTo(cx+6,cy+3);g.lineTo(cx+15,cy+3);g.strokePath();break;
            case 'magnetizer':   g.lineStyle(3,0x44ffaa,0.9);g.strokeCircle(cx,cy,12);g.fillStyle(0x44ffaa,1);g.fillRect(cx-10,cy-5,7,10);g.fillRect(cx+3,cy-5,7,10);g.lineStyle(2,0xaaffdd,0.6);g.beginPath();g.arc(cx-6,cy-8,4,-Math.PI,0,false);g.strokePath();g.beginPath();g.arc(cx+6,cy-8,4,-Math.PI,0,false);g.strokePath();break;
            case 'healer_turret':g.fillStyle(0x335544,1);g.fillCircle(cx,cy+4,11);g.fillStyle(0x44ff88,1);g.fillCircle(cx,cy,9);g.fillStyle(0xffffff,1);g.fillRect(cx-5,cy-1.5,10,3);g.fillRect(cx-1.5,cy-5,3,10);break;
            case 'healing_fountain':g.fillStyle(0x223344,1);g.fillCircle(cx,cy+6,11);g.fillStyle(0x88ffdd,0.9);g.fillCircle(cx,cy+6,7);g.fillStyle(0x99ffee,0.7);g.fillCircle(cx,cy+6,4);break;
            case 'cannon':       g.fillStyle(0x445566,1);g.fillCircle(cx,cy+2,12);g.fillStyle(0xff8844,0.9);g.fillCircle(cx,cy+2,7);g.lineStyle(5,0x777788,1);g.beginPath();g.moveTo(cx,cy+2);g.lineTo(cx,cy-14);g.strokePath();g.fillStyle(0x999aaa,1);g.fillCircle(cx,cy-14,4);break;
            case 'skyward':{
                // Dark armoured platform base
                g.fillStyle(0x1a0a00,1); g.fillRect(cx-10,cy-10,20,20);
                g.lineStyle(1.5,0xff4422,0.7); g.strokeRect(cx-10,cy-10,20,20);
                // Inner plate
                g.fillStyle(0x2a1100,1); g.fillCircle(cx,cy,8);
                g.lineStyle(1,0xff6644,0.5); g.strokeCircle(cx,cy,8);
                // 4 diagonal struts to corners
                g.lineStyle(2,0xff4422,0.8);
                for(let a=0;a<4;a++){
                    const ang=a*Math.PI/2+Math.PI/4;
                    g.beginPath(); g.moveTo(cx+Math.cos(ang)*8,cy+Math.sin(ang)*8);
                    g.lineTo(cx+Math.cos(ang)*13,cy+Math.sin(ang)*13); g.strokePath();
                    // Corner nubs
                    g.fillStyle(0xff6644,0.9); g.fillCircle(cx+Math.cos(ang)*13,cy+Math.sin(ang)*13,2);
                }
                // Crosshair lines
                g.lineStyle(1,0xff2200,0.5);
                g.beginPath(); g.moveTo(cx-9,cy); g.lineTo(cx+9,cy); g.strokePath();
                g.beginPath(); g.moveTo(cx,cy-9); g.lineTo(cx,cy+9); g.strokePath();
                // Hot core
                g.fillStyle(0xff2200,0.95); g.fillCircle(cx,cy,3.5);
                g.fillStyle(0xff8844,0.8); g.fillCircle(cx,cy,1.5);
                break;
            }
        }
    }

    _openBuildMenu(){
        this._closeAllPanels('build');
        this._buildMenuOpen=true;
        this._bmObjs.forEach(o=>o.setVisible(true));
        this._bmBtnData.forEach(b=>{
            const cost=this._getTowerCost(b.type);
            b.costT.setText(`⚙ ${cost}  ×${this.towers.filter(t=>t.type===b.type).length||''}`);
            const ok=this.scraps>=cost;
            b.nameT.setAlpha(ok?1:0.35); b.costT.setAlpha(ok?1:0.35); b.miniG.setAlpha(ok?1:0.25);
        });
    }
    _closeBuildMenu(){this._buildMenuOpen=false;this._bmObjs.forEach(o=>o.setVisible(false));}

    _startPlacementMode(type){
        this._placementMode=type;const def=this._towerDefs()[type];
        this._ghostGfx=this.add.graphics().setDepth(6);this._rangeGfx=this.add.graphics().setDepth(0.35);
        this._placeLabel=this.add.text(this.scale.width/2,52,`Place ${def.name}  (ESC to cancel)`,{fontSize:'13px',fontFamily:'monospace',color:'#aaddff',stroke:'#000',strokeThickness:3}).setOrigin(0.5).setScrollFactor(0).setDepth(30);
        this.input.on('pointermove',this._onPlacementMove,this);
    }
    _onPlacementMove(ptr){
        if(!this._placementMode||!this._ghostGfx?.active||!this._rangeGfx?.active)return;
        const TS=this.TILE_SIZE,def=this._towerDefs()[this._placementMode],tx=Math.floor(ptr.worldX/TS),ty=Math.floor(ptr.worldY/TS);
        const fp=def.footprint||1, half=Math.floor(fp/2);
        // Validate all footprint tiles
        let ok=true;
        for(let dx=-half;dx<=half&&ok;dx++) for(let dy=-half;dy<=half&&ok;dy++){
            const nx=tx+dx,ny=ty+dy;
            if(this.world[nx]?.[ny]!==this.FLOOR) ok=false;
            if(this.towers.some(t=>t.tileX===nx&&t.tileY===ny)) ok=false;
            if(Math.hypot(nx-this.baseTileX,ny-this.baseTileY)<=3) ok=false;
        }
        const col=ok?0x44ff88:0xff4444;
        const wx=tx*TS-half*TS, wy=ty*TS-half*TS, ws=fp*TS;
        this._ghostGfx.clear();
        this._ghostGfx.fillStyle(col,0.28); this._ghostGfx.fillRect(wx,wy,ws,ws);
        this._ghostGfx.lineStyle(1.5,col,0.7); this._ghostGfx.strokeRect(wx,wy,ws,ws);
        const px=tx*TS+TS/2,py=ty*TS+TS/2;
        this._rangeGfx.clear();
        if(def.range>0){this._rangeGfx.lineStyle(1.5,def.color,0.4);this._rangeGfx.strokeCircle(px,py,def.range*TS);this._rangeGfx.fillStyle(def.color,0.06);this._rangeGfx.fillCircle(px,py,def.range*TS);}
    }
    _cancelPlacement(){
        if(!this._placementMode)return;this._placementMode=null;
        this._ghostGfx?.destroy();this._ghostGfx=null;this._rangeGfx?.destroy();this._rangeGfx=null;
        this._placeLabel?.destroy();this._placeLabel=null;
        this.input.off('pointermove',this._onPlacementMove,this);
    }

    _openUpgradeMenu(tower){
        // 'upgrade' is excepted: this menu re-opens itself when returning from its own
        // sub-dialogs (cannon aim, duplicate tree), and it already self-closes below.
        this._closeAllPanels('upgrade');
        this._closeUpgradeMenu();
        this._upgradeMenuOpen=true;
        const def=this._towerDefs()[tower.type];
        const W=this.scale.width,H=this.scale.height;
        const panelW=Math.min(W*0.94,940),panelH=Math.min(H*0.94,720),px=W/2-panelW/2,py=H/2-panelH/2;
        const objs=this._umObjs=[]; const tr=o=>{objs.push(o);return o;};
        const colHex='#'+def.color.toString(16).padStart(6,'0');

        tr(this.add.rectangle(W/2,H/2,W,H,0x000000,0.7).setScrollFactor(0).setDepth(25)
            .setInteractive().on('pointerdown',()=>this._closeUpgradeMenu()));

        const panelBg=tr(this.add.rectangle(W/2,H/2,panelW,panelH,0x0a1520,0.98).setScrollFactor(0).setDepth(26));
        panelBg.setStrokeStyle(2,def.color,0.75);

        tr(this.add.text(px+panelW/2,py+22,`${def.icon}  ${def.name.toUpperCase()}`,
            {fontSize:'21px',fontFamily:UIKit.FONT.title,color:colHex,stroke:'#000',strokeThickness:3,fontStyle:'bold'})
            .setOrigin(0.5).setScrollFactor(0).setDepth(27));
        const hpFracHdr=(tower.maxHp>0)?Math.round(tower.hp/tower.maxHp*100):100;
        const statsStr=`Range ${def.range+(tower._rangeBonus||0)}  ·  CD ${Math.round((def.fireInterval||0)*this._towerCDMult)}ms  ·  HP ${hpFracHdr}%`;
        tr(this.add.text(px+panelW/2,py+46,statsStr,{fontSize:'12px',fontFamily:'monospace',color:'#5f7d92'})
            .setOrigin(0.5).setScrollFactor(0).setDepth(27));
        const dv=tr(this.add.graphics().setScrollFactor(0).setDepth(27));
        dv.lineStyle(1,0x1a2a3a,1); dv.lineBetween(px+14,py+62,px+panelW-14,py+62);

        const tAX=px+14,tAW=panelW-28,tAY=py+74,tAH=panelH-172;
        const tree=this._getUpgradeTree(tower.type);
        const nPaths=tree.paths.length;
        const maxNodes=Math.max(...tree.paths.map(p=>p.nodes.length));
        const pathColors=[def.color,0xaa66ff,0x44ff88,0xffaa44];

        // ── VERTICAL-COLUMN LAYOUT ───────────────────────────────────────────────
        // One column per branch, filling the panel width; nodes stack top→bottom down a
        // spine. No horizontal scrolling — 3-4 columns fit the wide panel comfortably.
        const colGap=14;
        const colW=Math.floor((tAW-(nPaths-1)*colGap)/nPaths);
        const headH=26;                                   // branch header band
        const nodeAreaTop=tAY+headH+10;
        const nodeAreaH=tAH-headH-10;                     // full vertical space for nodes
        const vGap=12;

        let nodeObjs=[];
        const rebuild=()=>{
            nodeObjs.forEach(o=>{const i=objs.indexOf(o);if(i!==-1)objs.splice(i,1);o?.active&&o.destroy();});
            nodeObjs=[];
            const nt=o=>{nodeObjs.push(o);objs.push(o);return o;};

            tree.paths.forEach((path,pi)=>{
                const colX=tAX+pi*(colW+colGap);
                const cx=colX+colW/2;
                const pc=pathColors[pi]||def.color;
                const pcHex='#'+pc.toString(16).padStart(6,'0');
                // Each branch fills the FULL column height with its own node count, so a
                // 3-node branch and a 4-node branch both reach the bottom (no dead space).
                const cnt=path.nodes.length;
                const nodeH=Math.floor((nodeAreaH-(cnt-1)*vGap)/cnt);
                const step=nodeH+vGap;

                // Column header — branch name (first node's name) on a tinted bar.
                const hdr=nt(this.add.graphics().setScrollFactor(0).setDepth(28));
                hdr.fillStyle(pc,0.16); hdr.fillRoundedRect(colX,tAY,colW,headH,5);
                hdr.lineStyle(1.5,pc,0.5); hdr.strokeRoundedRect(colX,tAY,colW,headH,5);
                nt(this.add.text(cx,tAY+headH/2,`${['I','II','III','IV'][pi]||pi+1}  ·  ${path.label||this._branchName(path)}`,
                    {fontSize:'12px',fontFamily:'monospace',color:pcHex,fontStyle:'bold'})
                    .setOrigin(0.5).setScrollFactor(0).setDepth(29));

                // Vertical spine behind the nodes.
                const spine=nt(this.add.graphics().setScrollFactor(0).setDepth(27.5));
                spine.lineStyle(2,pc,0.18);
                spine.lineBetween(cx,nodeAreaTop,cx,nodeAreaTop+cnt*step-vGap);

                path.nodes.forEach((node,ti)=>{
                    const ny=nodeAreaTop+ti*step;
                    const nodeId=path.ids[ti];
                    const purchased=tower._upgrades?.[nodeId]||0;
                    const maxed=purchased>=node.tiers;
                    const prereq=!node.requires||(tower._upgrades?.[node.requires]||0)>0;
                    const isExcluded=node.exclusive&&(tower._upgrades?.[node.exclusive]||0)>0;
                    const canAfford=this.scraps>=node.costFn(purchased);
                    const available=prereq&&!maxed&&canAfford&&!isExcluded;
                    const unlocked=prereq&&!maxed&&!isExcluded;

                    // Connector from previous node — brightens once the prereq is bought.
                    if(ti>0){
                        const pp=tower._upgrades?.[path.ids[ti-1]]||0;
                        const cl=nt(this.add.graphics().setScrollFactor(0).setDepth(27.6));
                        cl.lineStyle(3,pc,pp>0?0.7:0.18);
                        cl.lineBetween(cx,ny-vGap,cx,ny);
                        if(pp>0){ cl.fillStyle(pc,0.7); cl.fillTriangle(cx-4,ny-3,cx+4,ny-3,cx,ny+2); }
                    }

                    const ng=nt(this.add.graphics().setScrollFactor(0).setDepth(28));
                    const drawNg=(hov)=>{
                        ng.clear();
                        const fill=maxed?0x0a2010:isExcluded?0x1a0808:hov?0x123049:unlocked?0x0d1a26:0x080c10;
                        const border=maxed?0x44ff88:isExcluded?0x441111:hov&&available?pc:unlocked?0x2a4058:0x141c24;
                        ng.fillStyle(fill,0.98); ng.fillRoundedRect(colX,ny,colW,nodeH,6);
                        ng.lineStyle(maxed||(hov&&available)?2.5:1.5,border,maxed?0.9:unlocked?0.65:0.3);
                        ng.strokeRoundedRect(colX,ny,colW,nodeH,6);
                        // status pip top-left
                        ng.fillStyle(maxed?0x44ff88:isExcluded?0x662222:unlocked?pc:0x223040,1);
                        ng.fillCircle(colX+11,ny+11,4);
                        // tier pips bottom
                        if(node.tiers>1) for(let t=0;t<node.tiers;t++){
                            ng.fillStyle(t<purchased?pc:0x2a4058,1);
                            ng.fillCircle(colX+12+t*(colW-24)/(node.tiers-1),ny+nodeH-9,3.5);
                        }
                    };
                    drawNg(false);

                    const pad=9;
                    const nameTxt=nt(this.add.text(cx,ny+pad,node.name,
                        {fontSize:'14px',fontFamily:'monospace',color:maxed?'#66ffaa':isExcluded?'#664444':unlocked?'#e6eef8':'#46586c',
                         fontStyle:'bold',wordWrap:{width:colW-18},align:'center'}).setOrigin(0.5,0).setScrollFactor(0).setDepth(29));
                    const cs=maxed?'✓ MAX':isExcluded?'✕ EXCL':unlocked?`${node.costFn(purchased)} ⚙`:'LOCKED';
                    const cc=maxed?'#66ffaa':isExcluded?'#ff5555':canAfford&&unlocked?'#ffdd44':'#6a5033';
                    nt(this.add.text(cx,ny+nodeH-pad-2,cs,{fontSize:'13px',fontFamily:'monospace',color:cc,fontStyle:'bold'})
                        .setOrigin(0.5,1).setScrollFactor(0).setDepth(29));
                    if(node.desc){
                        // Center the description in the gap between the name and the cost line.
                        const gapTop=ny+pad+nameTxt.height+4;
                        const gapBot=ny+nodeH-pad-16;
                        const dMaxH=gapBot-gapTop;
                        const dt=nt(this.add.text(cx,(gapTop+gapBot)/2,node.desc,
                            {fontSize:'12px',fontFamily:'monospace',color:unlocked||maxed?'#8298ac':'#3c4a5c',
                             wordWrap:{width:colW-16},align:'center',lineSpacing:2}).setOrigin(0.5,0.5).setScrollFactor(0).setDepth(29));
                        if(dt.height>dMaxH) dt.setScale(Math.max(0.72,dMaxH/dt.height)); // shrink to fit tall descs
                    }

                    if(available){
                        const hit=nt(this.add.rectangle(cx,ny+nodeH/2,colW,nodeH,0xffffff,0).setScrollFactor(0).setDepth(30).setInteractive());
                        hit.on('pointerover',()=>drawNg(true)); hit.on('pointerout',()=>drawNg(false));
                        hit.on('pointerdown',p=>{
                            p.event.stopPropagation();
                            const cost=node.costFn(tower._upgrades?.[nodeId]||0);
                            if(this.scraps<cost)return;
                            this.scraps-=cost; this.orbScraps=this.scraps;
                            if(!tower._upgrades)tower._upgrades={};
                            tower._upgrades[nodeId]=(tower._upgrades[nodeId]||0)+1;
                            node.eff(tower,tower._upgrades[nodeId]);
                            this._showFloatingText(tower.px,tower.py-24,`↑ ${node.name}`,'#ffdd44');
                            this._refreshTowerVisual(tower);
                            rebuild();
                        });
                    }
                });
            });
        };
        rebuild();

        const fY=py+panelH-34;
        const fd=tr(this.add.graphics().setScrollFactor(0).setDepth(27));
        // Cannon fixed aim — dedicated button
        if(tower.type==='cannon'){
            const isFixed=tower._cannonFixedAng!==undefined;
            // Set Aim button
            const aimBg=tr(this.add.rectangle(px+panelW/2-(isFixed?70:0),fY-44,isFixed?128:180,30,0x0d1a26).setScrollFactor(0).setDepth(27).setInteractive());
            aimBg.setStrokeStyle(2,isFixed?0xff8844:0x334455,1);
            tr(this.add.text(px+panelW/2-(isFixed?70:0),fY-44,isFixed?`🎯 ${Math.round(tower._cannonFixedAng*(180/Math.PI))}°`:'🎯 Set Aim Direction',
                {fontSize:'13px',fontFamily:'monospace',color:isFixed?'#ff8844':'#aabbcc',fontStyle:'bold'}).setOrigin(0.5).setScrollFactor(0).setDepth(28));
            aimBg.on('pointerdown',p=>{ p.event.stopPropagation(); this._closeUpgradeMenu(); this._openCannonAimPicker(tower); });
            // Clear button if aimed
            if(isFixed){
                const clrBg=tr(this.add.rectangle(px+panelW/2+80,fY-44,64,30,0x1a0a0a).setScrollFactor(0).setDepth(27).setInteractive());
                clrBg.setStrokeStyle(2,0x442222,1);
                tr(this.add.text(px+panelW/2+80,fY-44,'✕ Clear',{fontSize:'12px',fontFamily:'monospace',color:'#884444'}).setOrigin(0.5).setScrollFactor(0).setDepth(28));
                clrBg.on('pointerdown',p=>{ p.event.stopPropagation(); tower._cannonFixedAng=undefined; tower._cannonFixedDist=undefined; tower._mgAimGfx?.clear(); this._closeUpgradeMenu(); this._openUpgradeMenu(tower); });
            }
        }
        // Magnetizer mode toggle
        if(tower.type==='magnetizer'){
            const modes=[['gravity','⚫ Gravity'],['wave','🌊 Wave'],['aura','❄ Aura']];
            modes.forEach(([mode,label],i)=>{
                const active=(tower._magMode||'gravity')===mode;
                const mx=px+panelW/2-120+i*120;
                const mBg=tr(this.add.rectangle(mx,fY-56,110,30,active?0x0a2a1a:0x0d1a26).setScrollFactor(0).setDepth(27).setInteractive());
                mBg.setStrokeStyle(2,active?0x44ffaa:0x334455,1);
                const mTxt=tr(this.add.text(mx,fY-56,label,{fontSize:'13px',fontFamily:'monospace',color:active?'#44ffaa':'#668899',fontStyle:'bold'})
                    .setOrigin(0.5).setScrollFactor(0).setDepth(28));
                mBg.on('pointerdown',p=>{
                    p.event.stopPropagation();
                    tower._magMode=mode;
                    tower._waveDirGfx?.destroy(); tower._waveDirGfx=null;
                    tower._auraGfx?.destroy(); tower._auraGfx=null;
                    if(tower._chillTiles){ tower._chillTiles.forEach(ct=>ct.gfx?.destroy()); tower._chillTiles=null; }
                    this._closeUpgradeMenu(); this._openUpgradeMenu(tower);
                });
            });
            if((tower._magMode||'gravity')==='wave'){
                tr(this.add.text(px+panelW/2,fY-30,`Wave dir: click tower to aim`,
                    {fontSize:'11px',fontFamily:'monospace',color:'#4488ff'}).setOrigin(0.5).setScrollFactor(0).setDepth(28));
                tower._settingWaveDir=true;
            } else {
                tower._settingWaveDir=false;
            }
        }

        fd.lineStyle(1,0x1a2a3a,1); fd.lineBetween(px+14,fY-20,px+panelW-14,fY-20);
        const _hpFrac=(tower.maxHp>0)?Math.max(0,Math.min(1,tower.hp/tower.maxHp)):1;
        const sa=Math.floor((tower.paidCost||def.cost)*(0.2+0.4*_hpFrac));
        // Sell button (left)
        const sBg=tr(this.add.rectangle(px+panelW/2-72,fY,132,38,0x0d1a26).setScrollFactor(0).setDepth(27).setInteractive());
        sBg.setStrokeStyle(2,0x331111,1);
        const sTxt=tr(this.add.text(px+panelW/2-72,fY,`Sell +${sa}⚙`,
            {fontSize:'15px',fontFamily:'monospace',color:'#ff6644',fontStyle:'bold',stroke:'#000',strokeThickness:2})
            .setOrigin(0.5).setScrollFactor(0).setDepth(28));
        sBg.on('pointerover',()=>{sBg.setFillStyle(0x221010);sTxt.setColor('#ff9977');});
        sBg.on('pointerout', ()=>{sBg.setFillStyle(0x0d1a26);sTxt.setColor('#ff6644');});
        sBg.on('pointerdown',p=>{p.event.stopPropagation();this._sellTower(tower);this._closeUpgradeMenu();});
        // Duplicate button (right) — costs the original build price
        // Dupe cost = placement cost + total upgrade cost spent
        const dupBaseCost=this._getTowerCost(tower.type);
        const dupTree=this._getUpgradeTree(tower.type);
        let upgradeCostTotal=0;
        if(dupTree&&tower._upgrades){
            for(const path of dupTree.paths||[]){
                for(const node of path.nodes||[]){
                    const id=path.ids[path.nodes.indexOf(node)];
                    const purchased=tower._upgrades[id]||0;
                    for(let t=0;t<purchased;t++) upgradeCostTotal+=node.costFn(t);
                }
            }
        }
        const dupCost=dupBaseCost+upgradeCostTotal;
        const canDup=this.scraps>=dupCost;
        const dBg=tr(this.add.rectangle(px+panelW/2+72,fY,120,38,canDup?0x0d1a1a:0x111111).setScrollFactor(0).setDepth(27).setInteractive());
        dBg.setStrokeStyle(2,canDup?0x113311:0x222222,1);
        const dTxt=tr(this.add.text(px+panelW/2+72,fY,`Dupe ${dupCost}⚙`,
            {fontSize:'15px',fontFamily:'monospace',color:canDup?'#44ffaa':'#446655',fontStyle:'bold',stroke:'#000',strokeThickness:2})
            .setOrigin(0.5).setScrollFactor(0).setDepth(28));
        if(canDup){
            dBg.on('pointerover',()=>{dBg.setFillStyle(0x102a1a);dTxt.setColor('#88ffcc');});
            dBg.on('pointerout', ()=>{dBg.setFillStyle(0x0d1a1a);dTxt.setColor('#44ffaa');});
            dBg.on('pointerdown',p=>{
                p.event.stopPropagation();
                this._closeUpgradeMenu();
                this._startDuplicatePlacement(tower);
            });
        }
        tr(this.add.text(px+panelW-12,py+12,'✕',{fontSize:'20px',fontFamily:UIKit.FONT.title,color:'#ff6644'})
            .setOrigin(1,0).setScrollFactor(0).setDepth(28).setInteractive().on('pointerdown',()=>this._closeUpgradeMenu()));
    }

    // Short column title for an upgrade branch — derived from its first node's name
    // (the tower trees carry no explicit branch labels).
    _branchName(path){
        const n=path?.nodes?.[0]?.name||'Branch';
        // Trim leading "+N " counters so "+1 Target" → "Target", keep it short.
        return n.replace(/^[+\-]?\d+\s*/,'').split(' ').slice(0,2).join(' ');
    }

    // Threat ranking for priority targeting. Higher = more worth killing first. Ranks the
    // enemies that WRECK your defense (and that volume-towers handle poorly) above fodder and
    // pure tanks — so a priority sniper picks the CEO/rooter/healer out of a crowd, dividing
    // labor with the cannon/MG/tesla that handle the swarm. Reusable by any future consumer.
    _enemyThreat(e){
        if(!e||!e.sprite?.active||e._cloaked) return -1; // can't/shouldn't target
        let s=0;
        if(e._tdCEO && !e._ceoKnight) s+=100;      // spawns knights + nearsights towers
        if(e.isRooter)               s+=90;        // disables towers
        if(e._tdInfernal)            s+=85;        // melts a tower
        if(e.isHealerTotem||e._isTotem) s+=80;     // sustains the whole wave
        if(e._tdTaunter)             s+=70;        // shields the pack
        if(e.isAnchor)               s+=65;        // accelerates the pack
        if(e._tdGhostBuster)         s+=60;        // disables wisps
        if(e._tdWraith)              s+=55;        // cloak support
        if(e._ceoKnight)             s+=40;        // armored tank
        if(e._tdBulwark||e._shield>0) s+=35;       // shielded
        if(e._tdBerserker)           s+=30;        // enrages
        if(e.isSplitter)             s+=15;
        const prog = 1 - (Math.hypot((e.sprite.x-this.basePx),(e.sprite.y-this.basePy))/(this.WORLD_WIDTH*this.TILE_SIZE));
        return s + prog; // fractional tie-break: within a tier prefer the one nearest the base
    }

    _startDuplicatePlacement(srcTower){
        // Enter normal placement mode for the same tower type
        this._dupSource=srcTower; // store source so upgrades can be copied after placement
        this._startPlacementMode(srcTower.type);
    }

    _closeUpgradeMenu(){
        this._upgradeMenuOpen=false;
        (this._umObjs||[]).forEach(o=>o?.active&&o.destroy());
        this._umObjs=[];
    }

    // Full per-tower upgrade tree — 2 paths × 3 tiers each
    _getUpgradeTree(type){
        const TS=this;
        const trees={
            tesla_coil:{paths:[
                // Branch I: Chain count → Omnistrike
                // Omnistrike fires directly at every enemy in radius — bypasses chain routing
                // so it hits spread enemies too, not just ones near each other
                {ids:['tc_1a','tc_1b','tc_1c','tc_1d'],nodes:[
                    {name:'+1 Target',    tiers:1,costFn:_=>40,
                     desc:'Chains to 1 more enemy (5 total)',
                     eff:(tw)=>{ tw._tcChains=(tw._tcChains||4)+1; }},
                    {name:'+3 Targets',   tiers:1,costFn:_=>100,requires:'tc_1a',
                     desc:'Chains to 3 more (8 total)',
                     eff:(tw)=>{ tw._tcChains=(tw._tcChains||5)+3; },exclusive:'tc_2b'},
                    {name:'+6 Targets',   tiers:1,costFn:_=>220,requires:'tc_1b',
                     desc:'Chains to 6 more (14 total)',
                     eff:(tw)=>{ tw._tcChains=(tw._tcChains||8)+6; }},
                    {name:'Omnistrike',   tiers:1,costFn:_=>500,requires:'tc_1c',
                     desc:'Fires at every enemy in radius directly — no chain routing, hits spread and clustered equally',
                     eff:(tw)=>{ tw._tcInfinite=true; tw._tcOmnistrike=true; }},
                ]},
                // Branch II: Range + damage → Arc Mastery
                // Arc Mastery: base damage ×2 but chain radius tightened to 3 tiles
                // Superior against clustered enemies — requires magnetizer/cannon setup
                {ids:['tc_2a','tc_2b','tc_2c','tc_2d'],nodes:[
                    {name:'+2 Range',     tiers:1,costFn:_=>35,
                     desc:'+2 tile detection range',
                     eff:(tw)=>{ tw._rangeBonus=(tw._rangeBonus||0)+2; if(tw.rangeRing)tw.rangeRing.setRadius((TS._towerDefs().tesla_coil.range+tw._rangeBonus)*TS.TILE_SIZE); }},
                    {name:'Amplifier I',  tiers:1,costFn:_=>90,requires:'tc_2a',
                     desc:'+1 range, +25% base dmg, +2 chains',
                     eff:(tw)=>{ tw._rangeBonus=(tw._rangeBonus||0)+1; tw._dmgMult=(tw._dmgMult||1)*1.25; tw._tcChains=(tw._tcChains||4)+2; if(tw.rangeRing)tw.rangeRing.setRadius((TS._towerDefs().tesla_coil.range+tw._rangeBonus)*TS.TILE_SIZE); },exclusive:'tc_1b'},
                    {name:'Amplifier II', tiers:1,costFn:_=>200,requires:'tc_2b',
                     desc:'+1 range, +35% base dmg, +2 chains',
                     eff:(tw)=>{ tw._rangeBonus=(tw._rangeBonus||0)+1; tw._dmgMult=(tw._dmgMult||1)*1.35; tw._tcChains=(tw._tcChains||6)+2; if(tw.rangeRing)tw.rangeRing.setRadius((TS._towerDefs().tesla_coil.range+tw._rangeBonus)*TS.TILE_SIZE); }},
                    {name:'Arc Mastery',  tiers:1,costFn:_=>420,requires:'tc_2c',
                     desc:'Base damage ×2 — chain radius tightened to 3 tiles, requires enemy clustering',
                     eff:(tw)=>{ tw._dmgMult=(tw._dmgMult||1)*2; tw._tcChainRadius=3; }},
                ]},
                // Branch III: Conductor crowd multiplier + slow aura (independent)
                {ids:['tc_3a','tc_3b','tc_3c','tc_3d'],nodes:[
                    {name:'Conductor I',  tiers:1,costFn:_=>50,
                     desc:'+8% dmg per enemy in radius (cap 10, max +80%)',
                     eff:(tw)=>{ tw._tcCrowdMult=true; tw._tcCrowdCap=10; tw._tcCrowdBonus=0.08; }},
                    {name:'Conductor II', tiers:1,costFn:_=>120,requires:'tc_3a',
                     desc:'Bonus raised to +12% per enemy',
                     eff:(tw)=>{ tw._tcCrowdBonus=0.12; }},
                    {name:'Conductor III',tiers:1,costFn:_=>240,requires:'tc_3b',
                     desc:'Cap raised to 20 enemies (max +240%)',
                     eff:(tw)=>{ tw._tcCrowdCap=20; }},
                    {name:'Slow Aura',    tiers:1,costFn:_=>380,requires:'tc_3c',
                     desc:'All enemies inside radius slowed 15% while inside',
                     eff:(tw)=>{ tw._tcSlowAura=true; }},
                ]},
            ]},
            sniper:{paths:[
                // Branch I: Explosive tip → shrapnel AoE
                {ids:['sn_1a','sn_1b','sn_1c'],nodes:[
                    {name:'Explosive Tip', tiers:1,costFn:_=>60,
                     desc:'Shots explode on impact — 1.5 tile AoE radius',
                     eff:(tw)=>{ tw._snExplode=true; tw._snAoeR=1.5; },exclusive:'sn_2a'},
                    {name:'Bigger Blast',  tiers:2,costFn:t=>[120,260][t]||999,requires:'sn_1a',
                     desc:'+0.5 AoE radius per tier (up to 2.5 tiles)',
                     eff:(tw)=>{ tw._snAoeR=(tw._snAoeR||1.5)+0.5; }},
                    {name:'Shrapnel',      tiers:1,costFn:_=>350,requires:'sn_1b',
                     desc:'Explosion scatters 6 piercing shrapnel in all directions',
                     eff:(tw)=>{ tw._snShrapnel=true; }},
                ]},
                // Branch II: Armor piercing (mutually exclusive with Branch I)
                {ids:['sn_2a','sn_2b','sn_2c'],nodes:[
                    {name:'AP Rounds',     tiers:1,costFn:_=>50,
                     desc:'Shots bypass armor — deals flat damage ignoring all shields',
                     eff:(tw)=>{ tw._snArmorPierce=true; },exclusive:'sn_1a'},
                    {name:'Hardened Core', tiers:2,costFn:t=>[100,220][t]||999,requires:'sn_2a',
                     desc:'+30% damage per tier',
                     eff:(tw)=>{ tw._dmgMult=(tw._dmgMult||1)*1.3; }},
                    {name:'Anti-Armor',    tiers:1,costFn:_=>380,requires:'sn_2b',
                     desc:'Armor piercing shots deal 3× damage to shielded/armored enemies',
                     eff:(tw)=>{ tw._snAntiArmor=true; }},
                ]},
                // Branch III: Critical hits — RNG high reward
                {ids:['sn_3a','sn_3b','sn_3c','sn_3d'],nodes:[
                    {name:'Crit I',        tiers:1,costFn:_=>55,
                     desc:'15% chance to crit for 2× damage',
                     eff:(tw)=>{ tw._snCritChance=(tw._snCritChance||0)+0.15; tw._snCritMult=2; }},
                    {name:'Crit II',       tiers:2,costFn:t=>[110,230][t]||999,requires:'sn_3a',
                     desc:'+10% crit chance per tier (up to 35%)',
                     eff:(tw)=>{ tw._snCritChance=Math.min(0.35,(tw._snCritChance||0.15)+0.10); }},
                    {name:'Deadeye',       tiers:1,costFn:_=>400,requires:'sn_3b',
                     desc:'Crits deal 5× damage — massive payoff but still RNG',
                     eff:(tw)=>{ tw._snCritMult=5; }},
                    {name:'Priority Targeting',tiers:1,costFn:_=>360,requires:'sn_3c',
                     desc:'Always fires at the highest-THREAT enemy in range (CEO, rooter, healer, infernal…) instead of the furthest — the assassin that kills what matters',
                     eff:(tw)=>{ tw._snPriority=true; }},
                ]},
            ]},
            machine_gun:{paths:[
                // Branch I: Shotgun MG — short range volleys, inverse damage cone, ice edge bullets (excl B2)
                {ids:['mg_1a','mg_1b','mg_1c'],nodes:[
                    {name:'Shotgun Barrel', tiers:1,costFn:_=>80,
                     desc:'Converts to shotgun — 7 bullets in a 45° cone. Center bullets deal 10% dmg, edge bullets 26%+slow.',
                     eff:(tw)=>{ tw._mgShotgun=true; tw._mgBullets=7; },exclusive:'mg_2a'},
                    {name:'Wide Barrel',    tiers:2,costFn:t=>[120,220][t]||999,requires:'mg_1a',
                     desc:'+2 bullets & wider spread per tier (up to 11)',
                     eff:(tw)=>{ tw._mgBullets=(tw._mgBullets||7)+2; }},
                    {name:'Hollow Point',   tiers:1,costFn:_=>350,requires:'mg_1b',
                     desc:'Edge bullets: 4% HP damage + 35% slow. Center bullets pierce through all enemies.',
                     eff:(tw)=>{ tw._mgHollowPoint=true; }},
                ]},
                // Branch II: Laser MG — instant hitscan, pierces, bounces walls, marks enemies (excl B1)
                {ids:['mg_2a','mg_2b','mg_2c'],nodes:[
                    {name:'Laser Barrel', tiers:1,costFn:_=>120,
                     desc:'Bullets become instant lasers — pierce all enemies, 0.2% HP damage, marks targets',
                     eff:(tw)=>{ tw._mgLaser=true; },exclusive:'mg_1a'},
                    {name:'Wall Bounce',  tiers:2,costFn:t=>[150,300][t]||999,requires:'mg_2a',
                     desc:'+1 wall bounce per tier (up to 2)',
                     eff:(tw)=>{ tw._mgLaserBounces=(tw._mgLaserBounces||0)+1; }},
                    {name:'Chain Death',  tiers:1,costFn:_=>400,requires:'mg_2b',
                     desc:'Marked enemies explode on death — base damage + 3% HP to nearby enemies',
                     eff:(tw)=>{ tw._mgChainDeath=true; }},
                ]},
                // Branch III: Focus Fire — locks single target, ramps damage, skyward target marker
                {ids:['mg_3a','mg_3b','mg_3c'],nodes:[
                    {name:'Focus Fire',   tiers:1,costFn:_=>100,
                     desc:'Locks onto one enemy. Damage ramps 2× per second up to 5× on that target.',
                     eff:(tw)=>{ tw._mgFocus=true; }},
                    {name:'Armor Break',  tiers:2,costFn:t=>[130,280][t]||999,requires:'mg_3a',
                     desc:'Focused target takes +20% damage from all sources per tier',
                     eff:(tw)=>{ tw._mgArmorBreak=(tw._mgArmorBreak||0)+0.2; }},
                    {name:'Execute',      tiers:1,costFn:_=>450,requires:'mg_3b',
                     desc:'Focused target below 20% HP takes 3× damage from this MG',
                     eff:(tw)=>{ tw._mgExecute=true; }},
                ]},
            ]},
            magnetizer:{paths:[
                // Branch I: Well strength
                {ids:['ma_1a','ma_1b','ma_1c'],nodes:[
                    {name:'Wide Field',   tiers:2,costFn:t=>[50,110][t]||999,
                     desc:'+2 tile pull radius per tier',
                     eff:(tw)=>{ tw._magPullRadius=(tw._magPullRadius||5)+2; }},
                    {name:'Deep Pull',    tiers:2,costFn:t=>[80,160][t]||999,requires:'ma_1a',
                     desc:'+0.5 tile pull force & −100ms pull interval per tier',
                     eff:(tw)=>{ tw._magPullDist=(tw._magPullDist||1)+0.5; tw._magPullInterval=Math.max(300,(tw._magPullInterval||600)-100); }},
                    {name:'Implosion',    tiers:1,costFn:_=>350,requires:'ma_1b',
                     desc:'Well duration +2s, vulnerability lasts 3s',
                     eff:(tw)=>{ tw._magWellDur=(tw._magWellDur||3000)+2000; tw._magVulnDur=3000; }},
                ]},
                // Branch II: Turret speed & power
                {ids:['ma_2a','ma_2b','ma_2c'],nodes:[
                    {name:'Quick Shot',   tiers:2,costFn:t=>[60,130][t]||999,
                     desc:'−2s well cooldown per tier',
                     eff:(tw)=>{ tw._fireRateMult=(tw._fireRateMult||1)*0.75; }},
                    {name:'Overcharge',   tiers:1,costFn:_=>200,requires:'ma_2a',
                     desc:'Vulnerability multiplier increases to 3×',
                     eff:(tw)=>{ tw._magVulnMult=3; }},
                    {name:'Twin Wells',   tiers:1,costFn:_=>400,requires:'ma_2b',
                     desc:'Each shot spawns two overlapping wells',
                     eff:(tw)=>{ tw._magTwinWells=true; }},
                ]},
                // Branch III: Stun & slow
                {ids:['ma_3a','ma_3b','ma_3c'],nodes:[
                    {name:'Disruptor',    tiers:1,costFn:_=>120,
                     desc:'Each pull pulse briefly stuns enemies (0.4s)',
                     eff:(tw)=>{ tw._magStunOnPull=true; }},
                    {name:'Chain Pull',   tiers:1,costFn:_=>200,requires:'ma_3a',
                     desc:'Pulled enemies are slowed 40% for 2s after well expires',
                     eff:(tw)=>{ tw._magSlowOnRelease=true; }},
                    {name:'Lingering Mark',tiers:1,costFn:_=>420,requires:'ma_3b',
                     desc:'Vulnerability persists 4s after the well ends — enemies keep taking bonus damage from all your towers as they walk into the kill zone',
                     eff:(tw)=>{ tw._magLingerVuln=true; }},
                ]},
            ]},
            cannon:{paths:[
                // Branch I: AoE/Catapult/Napalm (excl B2)
                {ids:['ca_1a','ca_1b','ca_1c'],nodes:[
                    {name:'Big Barrel',   tiers:3,costFn:t=>[40,90,180][t]||999,
                     desc:'+0.5 AoE radius per tier',
                     eff:(tw)=>{ tw._aoeBonus=(tw._aoeBonus||0)+0.5; },exclusive:'ca_2a'},
                    {name:'Catapult',     tiers:1,costFn:_=>220,requires:'ca_1a',
                     desc:'Shell splits into 12 mini-cannonballs after 8 tiles',
                     eff:(tw)=>{ tw._canCatapult=true; }},
                    {name:'Napalm',       tiers:1,costFn:_=>400,requires:'ca_1b',
                     desc:'Mini-cannonballs leave lava tiles dealing 6% HP damage',
                     eff:(tw)=>{ tw._canNapalm=true; }},
                ]},
                // Branch II: Barrage/Carpet Bomb (excl B1)
                {ids:['ca_2a','ca_2b','ca_2c'],nodes:[
                    {name:'Heavy Shell',  tiers:2,costFn:t=>[80,180][t]||999,
                     desc:'+30% damage per tier',
                     eff:(tw)=>{ tw._dmgMult=(tw._dmgMult||1)*1.3; },exclusive:'ca_1a'},
                    {name:'Barrage',      tiers:2,costFn:t=>[120,280][t]||999,requires:'ca_2a',
                     desc:'T1: fires 2 shells. T2: fires 3 shells.',
                     eff:(tw,lv)=>{ tw._canShotCount=lv+1; }},
                    {name:'Carpet Bomb',  tiers:1,costFn:_=>500,requires:'ca_2b',
                     desc:'6 bouncing shells. Last one is a bowling ball — rolls fast, grinds enemies with rapid DPS and pushes them back.',
                     eff:(tw)=>{ tw._canShotCount=6; tw._canCarpetBomb=true; }},
                ]},
                // Branch III: Core utility
                {ids:['ca_3a','ca_3b','ca_3c','ca_3d'],nodes:[
                    {name:'Hard Core',    tiers:2,costFn:t=>[50,110][t]||999,
                     desc:'+0.4 core radius per tier — deals 12% HP bonus in core area',
                     eff:(tw)=>{ tw._canCoreBonus=(tw._canCoreBonus||0)+0.4; }},
                    {name:'Stun Core',    tiers:1,costFn:_=>150,requires:'ca_3a',
                     desc:'Enemies hit by the core are stunned for 1.2s',
                     eff:(tw)=>{ tw._canCoreStun=true; }},
                    {name:'Precision',    tiers:1,costFn:_=>220,requires:'ca_3b',
                     desc:'Targets highest HP enemy in range',
                     eff:(tw)=>{ tw._canPrecision=true; }},
                    {name:'Aftershock',   tiers:1,costFn:_=>380,requires:'ca_3c',
                     desc:'Core explodes again 0.4s after impact — 60% dmg + 8% HP',
                     eff:(tw)=>{ tw._canAftershock=true; }},
                ]},
            ]},
            healer_turret:{paths:[
                // Branch I: Repair output — heavy, targeted tower healing
                {ids:['ht_a1','ht_a2','ht_a3'],nodes:[
                    {name:'Overcharge',   tiers:3,costFn:t=>[30,70,150][t]||999,
                     desc:'+50% heal amount per tier — big single-target repair',
                     eff:(tw)=>{ tw._healBonus=(tw._healBonus||1)*1.5; }},
                    {name:'Triage',       tiers:1,costFn:_=>140,requires:'ht_a1',
                     desc:'Always heals the LOWEST-HP tower in range first',
                     eff:(tw)=>{ tw._healTriage=true; }},
                    {name:'Field Medic',  tiers:1,costFn:_=>320,requires:'ht_a2',
                     desc:'Heals ALL towers in range each pulse, not just one',
                     eff:(tw)=>{ tw._healAll=true; }},
                ]},
                // Branch II: Response speed & emergency
                {ids:['ht_b1','ht_b2','ht_b3'],nodes:[
                    {name:'Wider Reach',  tiers:3,costFn:t=>[25,60,130][t]||999,
                     desc:'+1 tile range',
                     eff:(tw)=>{ tw._rangeBonus=(tw._rangeBonus||0)+1; }},
                    {name:'Fast Pulse',   tiers:2,costFn:t=>[50,120][t]||999,requires:'ht_b1',
                     desc:'-25% heal interval — heals more often',
                     eff:(tw)=>{ tw._fireRateMult=(tw._fireRateMult||1)*0.75; }},
                    {name:'Emergency',    tiers:1,costFn:_=>280,requires:'ht_b2',
                     desc:'Cancels a killing blow on a tower in range (survives at 15% HP) — 15s cooldown',
                     eff:(tw)=>{ tw._emergency=true; }},
                ]},
                // Branch III: Protective field — keeps towers alive proactively
                {ids:['ht_c1','ht_c2','ht_c3'],nodes:[
                    {name:'Regen Field',  tiers:2,costFn:t=>[80,180][t]||999,
                     desc:'Towers in range passively regen 2HP/s per tier',
                     eff:(tw)=>{ tw._regenField=(tw._regenField||0)+2; }},
                    {name:'Reinforce',    tiers:1,costFn:_=>220,requires:'ht_c1',
                     desc:'Towers in range take 15% less damage',
                     eff:(tw)=>{ tw._reinforce=true; }},
                    {name:'Guardian',     tiers:1,costFn:_=>380,requires:'ht_c2',
                     desc:'Once per wave, prevents a tower in range from being destroyed (survives at 1 HP)',
                     eff:(tw)=>{ tw._guardian=true; }},
                ]},
            ]},
            skyward:{paths:[
                // Single linear path — 6 upgrades, very expensive
                {ids:['sk_1','sk_2','sk_3','sk_4','sk_5','sk_6'],nodes:[
                    {name:'Early Warning', tiers:1,costFn:_=>500,
                     desc:'Trigger threshold: 20 → 12 enemies',
                     eff:(tw)=>{ tw._skyThreshold=12; }},
                    {name:'Wide Spread',   tiers:1,costFn:_=>800,requires:'sk_1',
                     desc:'AoE radius per strike +1 tile (3 tiles total)',
                     eff:(tw)=>{ tw._skyAoeBonus=(tw._skyAoeBonus||0)+1; }},
                    {name:'More Shells',   tiers:1,costFn:_=>1200,requires:'sk_2',
                     desc:'Base strikes = wave# + 50% of enemies (instead of just 50%)',
                     eff:(tw)=>{ tw._skyStrikePct=0.50; tw._skyMoreShells=true; }},
                    {name:'Warhead',       tiers:1,costFn:_=>1800,requires:'sk_3',
                     desc:'+60 base damage & +8% HP damage per strike',
                     eff:(tw)=>{ tw._skyBaseDmgBonus=(tw._skyBaseDmgBonus||0)+60; tw._skyPctBonus=(tw._skyPctBonus||0)+0.05; }},
                    {name:'Execute',       tiers:1,costFn:_=>2500,requires:'sk_4',
                     desc:'Enemies below 15% HP are instantly killed',
                     eff:(tw)=>{ tw._skyExecuteThreshold=0.15; }},
                    {name:'Cold Efficiency',tiers:1,costFn:_=>4000,requires:'sk_5',
                     desc:'Executes any enemy at 25% HP or below. Chilling.',
                     eff:(tw)=>{ tw._skyColdEfficiency=true; tw._skyColdThreshold=0.25; tw._skyExecuteThreshold=0; }},
                ]},
            ]},
            healing_fountain:{paths:[
                // Branch I: Aura reach & throughput — wide, always-on passive healing
                {ids:['hf_a1','hf_a2','hf_a3'],nodes:[
                    {name:'Wellspring',   tiers:3,costFn:t=>[30,70,150][t]||999,
                     desc:'+50% heal amount per tier',
                     eff:(tw)=>{ tw._healBonus=(tw._healBonus||1)*1.5; }},
                    {name:'Wide Aura',    tiers:3,costFn:t=>[50,110,220][t]||999,requires:'hf_a1',
                     desc:'+1 tile aura radius per tier — blanket a whole chokepoint',
                     eff:(tw)=>{ tw._rangeBonus=(tw._rangeBonus||0)+1; }},
                    {name:'Life Spring',  tiers:1,costFn:_=>300,requires:'hf_a2',
                     desc:'Aura heals towers AND the base core continuously',
                     eff:(tw)=>{ tw._healTowers=true; tw._healBase=true; }},
                ]},
                // Branch II: Base shield specialist — the fountain's core role. Any fountain
                // covering the base regenerates a projectile shield; this branch supercharges it.
                {ids:['hf_b1','hf_b2','hf_b3'],nodes:[
                    {name:'Fast Flow',    tiers:3,costFn:t=>[25,60,130][t]||999,
                     desc:'-15% heal interval per tier',
                     eff:(tw)=>{ tw._fireRateMult=(tw._fireRateMult||1)*0.85; }},
                    {name:'Fortify Core', tiers:2,costFn:t=>[120,240][t]||999,requires:'hf_b1',
                     desc:'Bigger, faster-regenerating base shield + repairs the core +6 HP/s per tier',
                     eff:(tw)=>{ tw._baseRepairRate=(tw._baseRepairRate||0)+6; tw._healBase=true; }},
                    {name:'Bulwark Aura', tiers:1,costFn:_=>340,requires:'hf_b2',
                     desc:'The base takes 12% less damage while any fountain aura reaches it',
                     eff:(tw)=>{ tw._baseWard=true; }},
                ]},
                // Branch III: Cleansing waters — utility & protection
                {ids:['hf_c1','hf_c2','hf_c3'],nodes:[
                    {name:'Cleanse',      tiers:1,costFn:_=>120,
                     desc:'Removes slow/stun from towers on heal',
                     eff:(tw)=>{ tw._cleanse=true; }},
                    {name:'Overflow',     tiers:2,costFn:t=>[160,300][t]||999,requires:'hf_c1',
                     desc:'Overheal grants a damage-absorbing shield (bigger per tier)',
                     eff:(tw)=>{ tw._overflow=(tw._overflow||0)+1; }},
                    {name:'Sanctuary',    tiers:1,costFn:_=>400,requires:'hf_c2',
                     desc:'Cancels a killing blow on a tower in the aura (survives at 15% HP) — 15s cooldown',
                     eff:(tw)=>{ tw._sanctuary=true; }},
                ]},
            ]},
        };
        return trees[type]||{paths:[]};
    }

    _refreshTowerVisual(tower){
        // Show upgrade dots on the base plate — count total upgrades purchased
        if(!tower.base?.active)return;
        const total=Object.values(tower._upgrades||{}).reduce((a,b)=>a+b,0);
        if(total<=0)return;
        // Remove old dot gfx if any
        tower._dotGfx?.destroy();
        const g=this.add.graphics().setDepth(1.65);
        tower._dotGfx=g;
        const def=this._towerDefs()[tower.type];
        const TS=this.TILE_SIZE,px=tower.tileX*TS,py=tower.tileY*TS;
        // Up to 6 gold dots across bottom of tile
        const max=Math.min(total,6);
        for(let i=0;i<max;i++){
            const dx=px+4+(i*(TS-8)/(max>1?max-1:1));
            g.fillStyle(0xffdd44,0.9); g.fillCircle(dx,py+TS-4,2.5);
        }
        // Tint body slightly based on path
        if(tower._upgrades){
            // Visual tint based on dominant path — body is Graphics, use alpha instead
            const pathACount=Object.keys(tower._upgrades).filter(k=>/_[12]/.test(k.split('_').slice(0,2).join('_'))).reduce((s,k)=>s+(tower._upgrades[k]||0),0);
        }
    }

    _applyUpgrade(){} // legacy stub


    _offerPowerups(){
        if(this.gameOver)return;
        const all=[{id:'p_hp',name:'Reinforced Frame',icon:'❤',desc:'+25 max HP',eff:()=>{this.playerMaxHP+=25;this.playerHP=Math.min(this.playerHP+25,this.playerMaxHP);}},{id:'p_dmg',name:'Sharpened Wrench',icon:'⚙',desc:'+6 wrench dmg',eff:()=>{this.wrenchDmg+=6;}},{id:'t_dmg',name:'Overcharged',icon:'⚡',desc:'+15% turret dmg',eff:()=>{this.turretDmgMult+=0.15;}},{id:'b_reg',name:'Auto-Repair',icon:'🔧',desc:'Base heals 2/s',eff:()=>{this.baseHealRate+=2;}},{id:'h_aura',name:'Healing Zone',icon:'💚',desc:'Aura heals player',eff:()=>{const x=this.baseAuras.find(a=>a.type==='heal');x?x.tier=Math.min(4,x.tier+1):this.baseAuras.push({type:'heal',tier:0});}},{id:'p_aura',name:'Toxin Field',icon:'☠',desc:'Aura poisons enemies',eff:()=>{const x=this.baseAuras.find(a=>a.type==='poison');x?x.tier=Math.min(4,x.tier+1):this.baseAuras.push({type:'poison',tier:0});}},{id:'shld',name:'Reflective Plating',icon:'🛡',desc:'+12% reflection',eff:()=>{this.shieldPct=Math.min(0.6,this.shieldPct+0.12);}}];
        const avail=all.filter(p=>(this._powerupTiers[p.id]||0)<5),picks=Phaser.Utils.Array.Shuffle(avail).slice(0,3);
        const W=this.scale.width,H=this.scale.height,objs=[];const tr=o=>{objs.push(o);return o;};
        tr(this.add.rectangle(W/2,H/2,W,H,0x000000,0.78).setScrollFactor(0).setDepth(40).setInteractive());
        tr(this.add.text(W/2,H*0.17,`⭐ WAVE ${this.wave} BONUS — CHOOSE ONE ⭐`,{fontSize:'17px',fontFamily:UIKit.FONT.title,color:'#ffdd44',stroke:'#000',strokeThickness:4}).setOrigin(0.5).setScrollFactor(0).setDepth(41));
        const cw=196,ch=200,gap=18,sx=W/2-(picks.length*(cw+gap)-gap)/2;
        picks.forEach((p,i)=>{const tier=this._powerupTiers[p.id]||0,bx=sx+i*(cw+gap),by=H*0.28;const bg=tr(this.add.graphics().setScrollFactor(0).setDepth(41));const draw=hov=>{bg.clear();bg.fillStyle(hov?0x1e2a40:0x151525,0.98);bg.fillRoundedRect(bx,by,cw,ch,9);bg.lineStyle(2,hov?0x5588cc:0x334466,hov?0.9:0.7);bg.strokeRoundedRect(bx,by,cw,ch,9);};draw(false);tr(this.add.text(bx+cw/2,by+28,p.icon,{fontSize:'32px'}).setOrigin(0.5).setScrollFactor(0).setDepth(42));tr(this.add.text(bx+cw/2,by+72,p.name,{fontSize:'12px',fontFamily:'monospace',color:'#ffffff',fontStyle:'bold',wordWrap:{width:cw-14}}).setOrigin(0.5).setScrollFactor(0).setDepth(42));tr(this.add.text(bx+cw/2,by+98,p.desc,{fontSize:'10px',fontFamily:'monospace',color:'#8899aa',wordWrap:{width:cw-18}}).setOrigin(0.5).setScrollFactor(0).setDepth(42));tr(this.add.text(bx+cw/2,by+ch-18,'CHOOSE',{fontSize:'12px',fontFamily:'monospace',color:'#ffdd44',fontStyle:'bold'}).setOrigin(0.5).setScrollFactor(0).setDepth(42));const hit=tr(this.add.rectangle(bx+cw/2,by+ch/2,cw,ch,0xffffff,0).setScrollFactor(0).setDepth(43).setInteractive());hit.on('pointerover',()=>draw(true));hit.on('pointerout',()=>draw(false));hit.on('pointerdown',()=>{p.eff();this._powerupTiers[p.id]=(tier+1);objs.forEach(o=>o?.active&&o.destroy());this._showBanner(`${p.icon} ${p.name.toUpperCase()}`,'#ffdd44','Upgrade applied!');this.time.delayedCall(2000,()=>this._startNextWave());});});
    }

    _buildHUD(){
        // the top bar in the game's own look: a dark card with a gold rule, the title face, each stat in its own slot
        const W=this.scale.width,hudBg=this.add.graphics().setScrollFactor(0).setDepth(10);
        hudBg.fillStyle(0x090b14,0.9);hudBg.fillRect(0,0,W,40);hudBg.lineStyle(1,0x2b3256,0.9);hudBg.lineBetween(0,40,W,40);
        hudBg.lineStyle(1,0xc9a45a,0.35);hudBg.lineBetween(0,38,W,38);
        const s={fontSize:'14px',fontFamily:UIKit.FONT.title,fontStyle:'bold',color:'#d8e6ff',stroke:'#05060a',strokeThickness:3};
        const slot=[[14,0],[120,0],[215,0],[305,0],[460,0],[610,0],[700,0]],at=k=>slot[k][0];
        this._hudWave=this.add.text(at(0),11,'WAVE 0',{...s,color:'#f6d58a'}).setScrollFactor(0).setDepth(11);this._hudScrap=this.add.text(at(1),11,'⚙ 50',{...s,color:'#ffdd88'}).setScrollFactor(0).setDepth(11);
        this._hudGlorp=this.add.text(at(2),11,'✦ 20',{...s,color:'#7dffc8'}).setScrollFactor(0).setDepth(11);
        this._hudBase=this.add.text(at(3),11,'🏛 500',s).setScrollFactor(0).setDepth(11);this._hudPlayer=this.add.text(at(4),11,'❤ 100',{...s,color:'#ffb0bc'}).setScrollFactor(0).setDepth(11);
        this._hudEnemy=this.add.text(at(5),11,'👾 0',s).setScrollFactor(0).setDepth(11);
        this._hudKills=this.add.text(at(6),11,'☠ 0',s).setScrollFactor(0).setDepth(11);
        this.add.text(W-14,12,`[${'Q'}] BUILD`,{fontSize:'12px',fontFamily:UIKit.FONT.title,fontStyle:'bold',color:'#8a93a6'}).setOrigin(1,0).setScrollFactor(0).setDepth(11);
    }
    _updateHUD(){
        this._hudWave.setText(`WAVE ${this.wave}`);this._hudScrap.setText(`⚙ ${this.scraps}`);
        if(this._hudGlorp) this._hudGlorp.setText(`✦ ${this.glorps||0}`);
        this._hudBase.setText(`🏛 ${Math.ceil(this.baseHP)}/${this.baseMaxHP}`);this._hudPlayer.setText(`❤ ${Math.ceil(this.playerHP)}/${this.playerMaxHP}`);
        this._hudEnemy.setText(`👾 ${this.enemies.filter(e=>!e._isTotem&&!e._isDummy).length}`);
        if(this._hudKills) this._hudKills.setText(`☠ ${this._killCount||0}`);
        if(this._baseHpFill){const pct=this.baseHP/this.baseMaxHP;this._baseHpFill.width=Math.max(0,80*pct);this._baseHpFill.fillColor=pct>0.6?0x44aaff:pct>0.3?0xffdd44:0xff4444;}
    }

    openPauseMenu(...a)  { return HUD.prototype.openPauseMenu.call(this,...a); }
    closePauseMenu(...a) { return HUD.prototype.closePauseMenu.call(this,...a); }

    _toggleDevMode(){
        this._devMode=!this._devMode;
        this._showFloatingText(this.scale.width/2,80,
            this._devMode?'🛠 DEV MODE ON  (` to toggle, \\ for panel)':'DEV MODE OFF',
            this._devMode?'#ffdd44':'#888888',0);
    }

    _openDevPanel(){
        if(this._devPanelOpen)return;
        this._closeAllPanels('devpanel');
        this._devPanelOpen=true;

        const W=this.scale.width;
        const PANEL_W=210,ROW_H=32,PAD=10;
        const entries=[
            {label:'+500 Scraps',    desc:'Add 500 scraps',          action:()=>{this.scraps+=500;this.orbScraps=this.scraps;}},
            {label:'+5000 Scraps',   desc:'Add 5000 scraps',         action:()=>{this.scraps+=5000;this.orbScraps=this.scraps;}},
            {label:'Max Scraps',     desc:'Set scraps to 99999',     action:()=>{this.scraps=99999;this.orbScraps=99999;}},
            {label:'Skip +5 Waves',  desc:'Fast-forward 5 waves',    action:()=>{this._closeDevPanel();this._devSkipWaves(5);}},
            {label:'Skip +10 Waves', desc:'Fast-forward 10 waves',   action:()=>{this._closeDevPanel();this._devSkipWaves(10);}},
            {label:'Jump to Wave…',  desc:'Enter wave number',       action:()=>{this._closeDevPanel();this._devWavePrompt();}},
            {label:'Kill All',       desc:'Kill all active enemies', action:()=>{[...this.enemies].forEach(e=>{if(e.sprite?.active)this.killEnemy(e);});}},
            {label:'Spawn Enemy…',   desc:'Pick enemy, click to place',action:()=>{this._closeDevPanel();this._openDevSpawnMenu();}},
            {label:'DPS Totem',      desc:'Place a training dummy near you',action:()=>{this._closeDevPanel();this._spawnDPSTotem();}},
            {label:'Remove Totems',  desc:'Clear all DPS totems',    action:()=>{this._clearDPSTotems();this._closeDevPanel();}},
            {label:'Buy All Upgrades',desc:'Purchase every shop upgrade instantly',action:()=>{this._devBuyAllUpgrades();this._closeDevPanel();}},
            {label:'+5000 Glorps ✦', desc:'Fund wisp skill trees for testing',action:()=>{this.glorps=(this.glorps||0)+5000;this._showFloatingText(this.player.x,this.player.y-30,'+5000 ✦','#ccffff');this._closeDevPanel();}},
            {label:`Stamina Drain: ${this._devNoStamina?'OFF':'ON'}`,
             desc:'Toggle wisp stamina drain / fatigue lockouts',
             action:()=>{
                 this._devNoStamina=!this._devNoStamina;
                 if(this._devNoStamina){
                     // Refill everything and clear any active lockout immediately.
                     (this.pets||[]).forEach(p=>{ p.stamina=p.maxStamina; p.fatigued=false; p._lockoutUntil=0; });
                 }
                 this._showFloatingText(this.player.x,this.player.y-30,`Stamina drain ${this._devNoStamina?'OFF':'ON'}`,'#44ff44');
                 this._closeDevPanel();
             }},
            {label:'Max Wisp Tree…',  desc:'Buy every node of one wisp\'s skill tree',
             action:()=>{this._closeDevPanel();this._openDevWispTreeMenu();}},
        ];

        const panelH=PAD*2+entries.length*ROW_H+28;
        const px=W-PANEL_W-8,py=50;
        const objs=this._dpObjs=[];
        const tr=o=>{objs.push(o);return o;};

        const bg=tr(this.add.graphics().setScrollFactor(0).setDepth(200));
        bg.fillStyle(0x000000,0.82); bg.fillRoundedRect(px,py,PANEL_W,panelH,6);
        bg.lineStyle(1,0x44ff44,0.6); bg.strokeRoundedRect(px,py,PANEL_W,panelH,6);

        tr(this.add.text(px+PAD,py+PAD,'🛠 DEV MODE',
            {fontSize:'11px',fontFamily:'monospace',color:'#44ff44',fontStyle:'bold'})
            .setScrollFactor(0).setDepth(201));

        entries.forEach((e,i)=>{
            const ry=py+PAD+24+i*ROW_H;
            const dot=tr(this.add.graphics().setScrollFactor(0).setDepth(201));
            const drawDot=(active)=>{
                dot.clear();
                dot.fillStyle(active?0xffff44:0x334433,1);
                dot.fillCircle(px+PAD+6,ry+ROW_H/2-2,5);
            };
            drawDot(false);

            const lbl=tr(this.add.text(px+PAD+16,ry+2,e.label,
                {fontSize:'11px',fontFamily:'monospace',color:'#ccffcc'})
                .setScrollFactor(0).setDepth(201));
            tr(this.add.text(px+PAD+16,ry+14,e.desc,
                {fontSize:'9px',fontFamily:'monospace',color:'#557755'})
                .setScrollFactor(0).setDepth(201));

            const hit=tr(this.add.rectangle(px+PAD,ry,PANEL_W-PAD*2,ROW_H-4,0xffffff,0)
                .setOrigin(0,0).setScrollFactor(0).setDepth(202).setInteractive({useHandCursor:true}));
            hit.on('pointerover', ()=>lbl.setStyle({color:'#ffffff'}));
            hit.on('pointerout',  ()=>lbl.setStyle({color:'#ccffcc'}));
            hit.on('pointerdown', ()=>{
                e.action();
                drawDot(true);
                this.time.delayedCall(300,()=>drawDot(false));
            });
        });

        tr(this.add.text(px+PAD,py+panelH-PAD-4,'` to close',
            {fontSize:'9px',fontFamily:'monospace',color:'#335533'})
            .setScrollFactor(0).setDepth(201));
    }

    // Dev: buy out every node of one wisp's skill tree, free. Nodes are applied in branch
    // order and repeated per tier, so `requires` chains and each eff()'s cumulative
    // mutation behave exactly as if the player had bought them one at a time.
    _devMaxWispTree(type){
        const tree=this._getWispSkillTree(type);
        if(!tree){ this._showFloatingText(this.player.x,this.player.y-30,'No tree for '+type,'#ff6666'); return; }
        const store=this._wispUpgrades[type]||(this._wispUpgrades[type]={});
        let bought=0;
        for(const path of tree.paths){
            path.nodes.forEach((node,ti)=>{
                const id=path.ids[ti];
                while((store[id]||0)<node.tiers){
                    store[id]=(store[id]||0)+1;
                    node.eff(this);
                    bought++;
                }
            });
        }
        this._syncLightPets?.();
        this._showFloatingText(this.player.x,this.player.y-30,`${type.toUpperCase()} tree maxed (${bought} nodes)`,'#ccffff');
    }

    _openDevWispTreeMenu(){
        if(this._devTreeMenuOpen)return;
        this._closeAllPanels('devtree');
        this._devTreeMenuOpen=true;
        const W=this.scale.width,H=this.scale.height;
        const objs=this._dtObjs=[]; const tr=o=>{objs.push(o);return o;};
        const icons={light:'✨',ice:'❄',boom:'💥',fire:'🔥',fist:'👊',void:'🌑',poison:'☠',skyward:'🌟',phantom:'👻',life:'🌸'};
        const all=['light','ice','boom','fire','fist','void','poison','skyward','phantom','life'];
        const rows=all.map(t=>({type:t,has:!!this._getWispSkillTree(t)}));

        const PW=340, RH=32, PH=64+rows.length*RH+30;
        const px=W/2-PW/2, py=H/2-PH/2;
        tr(this.add.rectangle(W/2,H/2,W,H,0x000000,0.7).setScrollFactor(0).setDepth(210).setInteractive()
            .on('pointerdown',()=>this._closeDevWispTreeMenu()));
        const bg=tr(this.add.graphics().setScrollFactor(0).setDepth(211));
        bg.fillStyle(0x050a12,0.99); bg.fillRoundedRect(px,py,PW,PH,8);
        bg.lineStyle(2,0x44ff44,0.6); bg.strokeRoundedRect(px,py,PW,PH,8);
        tr(this.add.text(px+PW/2,py+24,'🛠 MAX WISP TREE',{fontSize:'16px',fontFamily:UIKit.FONT.title,color:'#44ff44',fontStyle:'bold'}).setOrigin(0.5).setScrollFactor(0).setDepth(212));
        tr(this.add.text(px+PW/2,py+44,'Buys every node, free',{fontSize:'10px',fontFamily:'monospace',color:'#557755'}).setOrigin(0.5).setScrollFactor(0).setDepth(212));

        rows.forEach((r,i)=>{
            const ry=py+64+i*RH;
            const rowBg=tr(this.add.graphics().setScrollFactor(0).setDepth(212));
            const drawRow=hov=>{ rowBg.clear(); rowBg.fillStyle(hov&&r.has?0x14243a:0x0a1018,0.95); rowBg.fillRoundedRect(px+10,ry,PW-20,RH-4,5); };
            drawRow(false);
            tr(this.add.text(px+24,ry+(RH-4)/2,icons[r.type]||'?',{fontSize:'16px'}).setOrigin(0.5).setScrollFactor(0).setDepth(213));
            tr(this.add.text(px+44,ry+(RH-4)/2,r.type.charAt(0).toUpperCase()+r.type.slice(1),
                {fontSize:'13px',fontFamily:'monospace',color:r.has?'#ccddee':'#445055'}).setOrigin(0,0.5).setScrollFactor(0).setDepth(213));
            tr(this.add.text(px+PW-24,ry+(RH-4)/2,r.has?'MAX →':'no tree',
                {fontSize:'11px',fontFamily:'monospace',color:r.has?'#ffdd44':'#3a4448'}).setOrigin(1,0.5).setScrollFactor(0).setDepth(213));
            if(r.has){
                const hit=tr(this.add.rectangle(px+PW/2,ry+(RH-4)/2,PW-20,RH-4,0xffffff,0).setScrollFactor(0).setDepth(214).setInteractive());
                hit.on('pointerover',()=>drawRow(true)); hit.on('pointerout',()=>drawRow(false));
                hit.on('pointerdown',p=>{ p.event.stopPropagation(); this._devMaxWispTree(r.type); this._closeDevWispTreeMenu(); });
            }
        });
        tr(this.add.text(px+PW/2,py+PH-14,'click outside to close',{fontSize:'9px',fontFamily:'monospace',color:'#335533'}).setOrigin(0.5).setScrollFactor(0).setDepth(212));
    }

    _closeDevWispTreeMenu(){
        this._devTreeMenuOpen=false;
        (this._dtObjs||[]).forEach(o=>o?.active&&o.destroy());
        this._dtObjs=[];
    }

    _openDevSpawnMenu(){
        if(this._devSpawnOpen)return;
        this._closeAllPanels('devspawn');
        this._devSpawnOpen=true;

        // Enemy catalogue with visual info
        const ENEMIES=[
            {type:'basic',          label:'Basic',          color:0xff5555, desc:'Standard slime'},
            {type:'berserker',      label:'Berserker',      color:0xff2200, desc:'Tanky melee'},
            {type:'speed',          label:'Speed',          color:0x44ffee, desc:'3× faster, electric'},
            {type:'rooter',         label:'Rooter',         color:0x33aa33, desc:'Pulls/roots'},
            {type:'splitter',       label:'Splitter',       color:0xffaa00, desc:'Splits on death'},
            {type:'ranged',         label:'Ranged',         color:0x9999ff, desc:'Shoots projectiles'},
            {type:'sniper',         label:'Sniper',         color:0xcc8800, desc:'Long range repositioner'},
            {type:'mortar',         label:'Mortar',         color:0x445566, desc:'Lobs AoE shots'},
            {type:'healer_totem',   label:'Healer Totem',   color:0x44ff88, desc:'Heals nearby enemies'},
            {type:'anchor',         label:'Anchor',         color:0x6688aa, desc:'Speeds allies, slows player'},
            {type:'taunter',        label:'Taunter',        color:0x44ff88, desc:'Redirects 50% damage'},
            {type:'ceo',            label:'CEO',            color:0xddaaff, desc:'Shields, transforms minions'},
            {type:'knight',         label:'Knight',         color:0xdd88ff, desc:'CEO-made armoured minion'},
            {type:'infernal',       label:'Infernal',       color:0xff4400, desc:'Growing laser beam'},
            {type:'portal_bringer', label:'Portal Bringer', color:0xaa44ff, desc:'Plants portal, spawns enemies'},
            {type:'ghost_buster',   label:'Ghost Buster',   color:0xddddff, desc:'Mutes wisps on hit'},
            {type:'wraith',         label:'Wraith',         color:0x99aadd, desc:'Cloaks itself + nearby allies (invincible until revealed)'},
            {type:'bomber',         label:'Sapper',         color:0xffdd00, desc:'Very fast, low HP — rushes nearest tower, huge tower damage'},
            {type:'ems',            label:'EMS Slime',      color:0x66ccff, desc:'Fast — EMP pulse disables all turrets 2.5s; 90%-absorb shield on cooldown'},
            {type:'demon',          label:'Demon',          color:0xcc3366, desc:'Dives to hell (invuln), resurfaces & flamethrowers towers w/ purple fire; dying burning towers chain-burst'},
            {type:'angel',          label:'Angel',          color:0xfff2aa, desc:'Flies (WISP-only damage) — ground ring gives enemies under it 35% DR; tethers to demons'},
            {type:'bulwark',        label:'Bulwark',        color:0x88ccff, desc:'Front shield blocks direct fire — only lobbed/AoE bypasses it'},
        ];

        let selected=ENEMIES[0].type;

        const W=this.scale.width,H=this.scale.height;
        // Panel height is DERIVED from the enemy count (2-col grid) so it always contains
        // every card. Header + rows + footer, capped to the screen; if it would exceed that,
        // the card height shrinks to fit rather than overflowing the panel.
        const cols=2, gapY=4, headH=46, footH=28;
        const rows=Math.ceil(ENEMIES.length/cols);
        const panelW=320;
        const py=44, maxPanelH=H-py-12;
        let cardH=48;
        let panelH=headH+rows*(cardH+gapY)+footH;
        if(panelH>maxPanelH){
            cardH=Math.max(30,Math.floor((maxPanelH-headH-footH-rows*gapY)/rows));
            panelH=headH+rows*(cardH+gapY)+footH;
        }
        const px=W-panelW-8;
        const objs=this._dsObjs=[]; const tr=o=>{objs.push(o);return o;};

        const bg=tr(this.add.graphics().setScrollFactor(0).setDepth(200));
        bg.fillStyle(0x000000,0.88); bg.fillRoundedRect(px,py,panelW,panelH,6);
        bg.lineStyle(1,0xff4444,0.7); bg.strokeRoundedRect(px,py,panelW,panelH,6);

        tr(this.add.text(px+10,py+10,'🎯 SPAWN ENEMY',
            {fontSize:'11px',fontFamily:'monospace',color:'#ff8888',fontStyle:'bold'})
            .setScrollFactor(0).setDepth(201));

        // Wave selector — spawn enemies at any wave's strength without advancing there.
        this._devSpawnWave=this._devSpawnWave||this.wave||1;
        const waveOpts=[1,5,10,15,20,25,30,35,40,45,50];
        const chipW=(panelW-20)/waveOpts.length, chipY=py+32;
        tr(this.add.text(px+10,py+31,'@ wave:',{fontSize:'8px',fontFamily:'monospace',color:'#8899aa'})
            .setScrollFactor(0).setDepth(201));
        const waveChips=[];
        waveOpts.forEach((wv,i)=>{
            const cxw=px+52+i*((panelW-62)/waveOpts.length);
            const chip=tr(this.add.text(cxw,chipY,`${wv}`,
                {fontSize:'10px',fontFamily:'monospace',
                 color:this._devSpawnWave===wv?'#ffee66':'#66778a',
                 fontStyle:this._devSpawnWave===wv?'bold':'normal'})
                .setScrollFactor(0).setDepth(201).setInteractive({useHandCursor:true}));
            chip.on('pointerdown',()=>{
                this._devSpawnWave=wv;
                waveChips.forEach((c,j)=>{ c.setColor(waveOpts[j]===wv?'#ffee66':'#66778a'); c.setFontStyle(waveOpts[j]===wv?'bold':'normal'); });
                statusTxt.setText(`Spawn wave set to W${wv} — click floor to spawn at W${wv} strength`);
            });
            waveChips.push(chip);
        });

        const statusTxt=tr(this.add.text(px+10,py+panelH-20,'Click anywhere on floor to spawn',
            {fontSize:'9px',fontFamily:'monospace',color:'#557755'})
            .setScrollFactor(0).setDepth(201));

        // Grid of enemy cards — 2 columns
        const cardW=(panelW-24)/cols;
        const startY=py+headH;

        const selBoxes=[];
        ENEMIES.forEach((e,i)=>{
            const col=i%cols,row=Math.floor(i/cols);
            const cx2=px+8+col*(cardW+8),cy2=startY+row*(cardH+gapY);
            const colHex='#'+e.color.toString(16).padStart(6,'0');

            const cardBg=tr(this.add.graphics().setScrollFactor(0).setDepth(201));
            const drawCard=(sel,hov)=>{
                cardBg.clear();
                const fill=sel?0x1a0808:hov?0x0e1010:0x080808;
                const border=sel?e.color:hov?0x888888:0x222222;
                cardBg.fillStyle(fill,0.95); cardBg.fillRect(cx2,cy2,cardW,cardH);
                cardBg.lineStyle(sel?2:1,border,sel?1:0.5); cardBg.strokeRect(cx2,cy2,cardW,cardH);
                // Colour swatch
                cardBg.fillStyle(e.color,0.85); cardBg.fillCircle(cx2+16,cy2+cardH/2,10);
                cardBg.lineStyle(1,0xffffff,0.3); cardBg.strokeCircle(cx2+16,cy2+cardH/2,10);
            };
            drawCard(i===0,false);
            selBoxes.push(drawCard);

            tr(this.add.text(cx2+30,cy2+8,e.label,
                {fontSize:'10px',fontFamily:'monospace',color:'#ccffcc',fontStyle:'bold'})
                .setScrollFactor(0).setDepth(202));
            tr(this.add.text(cx2+30,cy2+22,e.desc,
                {fontSize:'8px',fontFamily:'monospace',color:'#556655'})
                .setScrollFactor(0).setDepth(202));

            const hit=tr(this.add.rectangle(cx2+cardW/2,cy2+cardH/2,cardW,cardH,0xffffff,0)
                .setScrollFactor(0).setDepth(203).setInteractive({useHandCursor:true}));
            hit.on('pointerover', ()=>{ if(selected!==e.type)drawCard(false,true); });
            hit.on('pointerout',  ()=>{ drawCard(selected===e.type,false); });
            hit.on('pointerdown', ()=>{
                selected=e.type;
                statusTxt.setText(`Selected: ${e.label} — click floor to spawn`);
                // Redraw all cards
                ENEMIES.forEach((e2,j)=>selBoxes[j](selected===e2.type,false));
            });
        });

        tr(this.add.text(px+panelW-8,py+8,'✕',{fontSize:'13px',fontFamily:'monospace',color:'#ff6666'})
            .setOrigin(1,0).setScrollFactor(0).setDepth(203)
            .setInteractive().on('pointerdown',()=>this._closeDevSpawnMenu()));

        // World click handler — spawn on floor tile, at the chosen dev wave's strength
        const onWorldClick=(ptr)=>{
            if(this._devSpawnOpen&&selected){
                const cam=this.cameras.main;
                const wx=Math.floor((ptr.x+cam.scrollX)/this.TILE_SIZE);
                const wy=Math.floor((ptr.y+cam.scrollY)/this.TILE_SIZE);
                if(this.world[wx]?.[wy]===this.FLOOR){
                    // Spawn AS IF at the selected wave: temporarily override this.wave so all
                    // wave-scaled stats (HP, damage, armour) compute for that wave, then restore.
                    const realWave=this.wave;
                    const spawnWave=this._devSpawnWave||this.wave;
                    this.wave=spawnWave;
                    const sc=Math.pow(1.06,spawnWave-1);
                    this._spawnEnemy(selected,wx,wy,sc,this._isStationary(selected));
                    this.wave=realWave;
                    this._showFloatingText(ptr.x,ptr.y-16,`+${selected} (W${spawnWave})`,'#ff8888');
                    statusTxt.setText(`Spawned ${selected} at W${spawnWave} strength — click again for more`);
                }
            }
        };
        this.input.on('pointerdown',onWorldClick);
        objs.push({active:true,destroy:()=>this.input.off('pointerdown',onWorldClick)});

        this.input.keyboard.once('keydown-BACKTICK',()=>this._closeDevSpawnMenu());
    }

    _closeDevSpawnMenu(){
        this._devSpawnOpen=false;
        (this._dsObjs||[]).forEach(o=>o?.active&&o.destroy());
        this._dsObjs=[];
    }

    _closeDevPanel(){
        this._devPanelOpen=false;
        (this._dpObjs||[]).forEach(o=>o?.active&&o.destroy());
        this._dpObjs=[];
    }

    // Abandon the current wave without starting a new one. Bumping _waveToken invalidates
    // any queued spawn callbacks so they can't leak into the next wave.
    _abandonWave(){
        [...this.enemies].forEach(e=>{if(e.sprite?.active)this.killEnemy(e);});
        this._clearStationaries?.();
        this._waveToken++;
        this.enemiesLeft=0;
        this.waveActive=false;
        this._currentWaveFinal=false;
    }

    // Dev: jump forward n waves and immediately begin the destination wave.
    // (The old _skipWave only killed enemies and never incremented this.wave, so the game
    // stalled with waveActive=false and nothing scheduled to restart it.)
    _devSkipWaves(n=1){
        if(this.gameOver)return;
        this._abandonWave();
        this.wave+=Math.max(0,n-1);   // _startNextWave performs the final ++
        this._waveCompCache=null;     // force a fresh roll for the destination wave
        this.time.delayedCall(150,()=>{ if(!this.gameOver) this._startNextWave(); });
    }

    _skipWave(){ this._devSkipWaves(1); }

    _devWavePrompt(){
        const target=parseInt(prompt('Jump to wave:'));
        if(!isNaN(target)&&target>0){
            this._abandonWave();          // also invalidates queued spawns via _waveToken
            this.wave=target-1;           // _startNextWave performs the ++
            this._waveCompCache=null;     // force a fresh roll for the destination wave
            this.time.delayedCall(250,()=>{ if(!this.gameOver) this._startNextWave(); });
        }
    }

    _openPauseMenu(){
        if(this._pauseMenuOpen||this.gameOver)return;
        this.openPauseMenu();
        this._pmActive=true;
        // RESTART must restart THIS scene, not 'Game'. HUD builds the menu, so repoint
        // the button through the named handle it exposes.
        //
        // This previously walked _pauseObjs looking for a Text whose content was
        // 'RESTART' and assumed the element at index-1 was its interactive background.
        // That coupling broke silently whenever the menu's construction order changed —
        // the loop simply found nothing and RESTART kept Game's behaviour, sending the
        // player to the wrong scene with no error anywhere.
        this._pauseBtns?.restart?.setOnClick(()=>{
            this.closePauseMenu(); this._pmActive=false; this.scene.start('TowerDefenseScene');
        });
    }
    _closePauseMenu(){
        this._pmActive=false;
        this.closePauseMenu();
    }

    _triggerGameOver(){
        if(this.gameOver)return;this.gameOver=true;
        this.cameras.main.shake(500,0.015);this.cameras.main.flash(300,255,0,0);
        const W=this.scale.width,H=this.scale.height;
        this.add.rectangle(W/2,H/2,W,H,0x000000,0.82).setScrollFactor(0).setDepth(50);
        this.add.text(W/2,H/2-50,'BASE DESTROYED',{fontSize:'30px',fontFamily:UIKit.FONT.title,color:'#ff4444',stroke:'#000',strokeThickness:5}).setOrigin(0.5).setScrollFactor(0).setDepth(51);
        this.add.text(W/2,H/2,`Survived ${this.wave-1} wave${this.wave-1!==1?'s':''}`,{fontSize:'17px',fontFamily:UIKit.FONT.title,color:'#aaddff'}).setOrigin(0.5).setScrollFactor(0).setDepth(51);
        this.add.text(W/2,H/2+55,'[ RESTART ]',{fontSize:'18px',fontFamily:UIKit.FONT.title,color:'#ffdd44',stroke:'#000',strokeThickness:3}).setOrigin(0.5).setScrollFactor(0).setDepth(51).setInteractive().on('pointerdown',()=>{
            // Rebuilding the 120x100 TD map is the heaviest transition in the game, so
            // the loader earns its place here more than anywhere else.
            if(typeof Transitions!=='undefined') Transitions.loader(this,{title:'ENGINEERING DEFENSE',tag:'HOLD THE BASE',accent:UIKit.PALETTE.accentGreen,duration:900,onDone:()=>this.scene.restart()});
            else this.scene.restart();
        });
        this.add.text(W/2,H/2+88,'[ LEVEL SELECT ]',{fontSize:'14px',fontFamily:'monospace',color:'#778899'}).setOrigin(0.5).setScrollFactor(0).setDepth(51).setInteractive().on('pointerdown',()=>this.scene.start('LevelSelect'));
    }

    // One banner at a time: a second one waits for the first to finish (the opening title and wave 1 used to print over each other).
    _showBanner(title,color,sub){
        if(this._bannerUp?.active){(this._bannerQ||(this._bannerQ=[])).push([title,color,sub]);return;}
        if(this._bannerUp&&!this._bannerUp.active)this._bannerQ=[];   // left over from a restarted scene: start with an empty queue
        const W=this.scale.width,H=this.scale.height,y=H*0.2,items=[];
        const bg=this.add.graphics().setScrollFactor(0).setDepth(35).setAlpha(0);for(let i=0;i<12;i++){bg.fillStyle(0x000000,0.05);bg.fillRect(0,y-42+i*2,W,84-i*4);}items.push(bg);
        const t1=this.add.text(W/2,y-(sub?8:0),title,{fontSize:'24px',fontFamily:UIKit.FONT.title,color,stroke:'#05060a',strokeThickness:5,fontStyle:'bold'}).setOrigin(0.5).setScrollFactor(0).setDepth(36).setAlpha(0);items.push(t1);
        if(sub){const t2=this.add.text(W/2,y+16,sub,{fontSize:'13px',fontFamily:UIKit.FONT.title,fontStyle:'italic',color:'#b8c4d4',stroke:'#05060a',strokeThickness:3}).setOrigin(0.5).setScrollFactor(0).setDepth(36).setAlpha(0);items.push(t2);}
        this._bannerUp=t1;
        this.tweens.add({targets:items,alpha:1,duration:200,onComplete:()=>this.time.delayedCall(1900,()=>this.tweens.add({targets:items,alpha:0,duration:350,onComplete:()=>{items.forEach(o=>o?.active&&o.destroy());this._bannerUp=null;const n=this._bannerQ?.shift();if(n)this._showBanner(...n);}}))});
    }
    _showFloatingText(x,y,text,color='#ffffff',sf=1){
        // Round bare numeric damage values so hits read "45" not "44.7". Prefixed strings
        // ("-45", "+30HP", "EXECUTE") pass through untouched.
        if(typeof text==='number') text=Math.round(text);
        else if(typeof text==='string'&&/^-?\d+\.\d+$/.test(text)) text=String(Math.round(parseFloat(text)));
        const t=this.add.text(x,y,String(text),{fontSize:'11px',fontFamily:'monospace',color,stroke:'#000',strokeThickness:2}).setOrigin(0.5).setDepth(6).setScrollFactor(sf);this.tweens.add({targets:t,y:y-22,alpha:0,duration:650,onComplete:()=>t.destroy()});}
}
if(typeof module!=='undefined')module.exports=TowerDefenseScene;