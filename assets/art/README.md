# Art

The game loads every file listed in manifest.json at startup (BootScene). Redraw any of them in Aseprite (or anything) and
save over the file: keep the same size, transparent background, PNG. Pixel art is drawn at a few times its size with no
smoothing; the ones marked "soft" are glows and gradients, drawn smooth.

Files with a .json beside them are sheets: the .json says where each frame sits (x, y, w, h). Keep every frame where it is
when you redraw one (frames side by side, left to right, unless the .json says otherwise).

If a file is missing, the game draws its own version instead (the code that first painted it is still there).

| file | size | what it is |
|---|---|---|
| bfx_shots.png (+ .json) | 126x16, 12 frames | boss projectiles (named in the .json) |
| cfx_bits.png (+ .json) | 128x68, 17 frames | small creature bits: gear, marks, flames (named in the .json) |
| cfx_face.png (+ .json) | 256x544, 130 frames | every eye and hat the slimes wear, one 32x32 cell each (named in the .json) |
| cfx_ice.png (+ .json) | 52x21, 2 frames | the ice block, whole and cracked |
| cs_sheet.png (+ .json) | 192x96, 16 frames | cosmic effect bits (named in the .json) |
| cs_sigil.png | 128x128 | the cosmic sigil circle (white, tinted in game) |
| el_icon_cosmic.png (+ .json) | 64x16, 4 frames | an element's icon, 4 frames |
| el_icon_fire.png (+ .json) | 64x16, 4 frames | an element's icon, 4 frames |
| el_icon_ice.png (+ .json) | 64x16, 4 frames | an element's icon, 4 frames |
| el_icon_lightning.png (+ .json) | 64x16, 4 frames | an element's icon, 4 frames |
| fx_anger.png (+ .json) | 9x9 | the anger mark over the Voltslime |
| fx_blockcrack.png | 32x32 | cracks over a frozen block |
| fx_bonk_star.png (+ .json) | 7x7 | stars round its head after the BONK |
| fx_cheer_back.png | 92x60 | the stage's curtains, valance and bulbs |
| fx_cheer_heart.png (+ .json) | 9x9 | hearts rising off an Encouraged enemy |
| fx_cheer_stage.png | 96x20 | the Cheerleader's pop-up stage (deck and skirt) |
| fx_cond_cap.png (+ .json) | 55x11, 5 frames | Circuit Breaker: a capacitor's badge, five 11x11 frames side by side, empty to fully charged |
| fx_cond_ins.png (+ .json) | 11x11 | Circuit Breaker: an insulator's badge |
| fx_cond_live.png (+ .json) | 11x11 | Circuit Breaker: a live wire's badge (beside the enemy's health bar, and on the meter) |
| fx_dancer_a.png (+ .json) | 36x18, 2 frames | backup dancers: two 18x18 frames side by side (down, then up) |
| fx_dancer_b.png (+ .json) | 36x18, 2 frames | backup dancers: two 18x18 frames side by side (down, then up) |
| fx_heartbreak_l.png (+ .json) | 9x9 | the two halves of a broken heart (Discouraged) |
| fx_heartbreak_r.png (+ .json) | 9x9 | the two halves of a broken heart (Discouraged) |
| fx_pompom.png (+ .json) | 14x14 | the Cheerleader Slime's pompom (flipped for her other hand) |
| fx_rock.png (+ .json) | 9x9 | the rock you throw at the Voltslime |
| fx_scared_eyes.png (+ .json) | 16x16 | goggly frightened eyes and a sweat drop (boss intros) |
| fx_smoke.png | 64x64 | a smoke puff (white, tinted in game) |
| fx_spot.png | 64x128 | the Cheerleader's spotlight beam (soft) |
| fx_tornado3.png (+ .json) | 512x52, 8 frames | Gale's tornado, 8 frames |
| fx_ultblock_ban.png (+ .json) | 12x12 | the ult-blocker zone's icon |
| fx_ultblock_drain.png (+ .json) | 12x12 | the ult-blocker zone's icon |
| fx_void_key.png (+ .json) | 28x28 | the Void Rift's keys |
| fx_volt_crown.png | 13x7 | the Voltslime's crown lying on the floor while it sleeps |
| isle_land_dais.png | 210x170 | the Enchanter's Isle island |
| isle_land_top.png | 210x170 | the Enchanter's Isle island |
| isle_mini_bind.png (+ .json) | 80x20, 4 frames | an Enchanter's Isle menu icon, 4 frames |
| isle_mini_combine.png (+ .json) | 80x20, 4 frames | an Enchanter's Isle menu icon, 4 frames |
| isle_mini_garden.png (+ .json) | 80x20, 4 frames | an Enchanter's Isle menu icon, 4 frames |
| isle_mini_reforge.png (+ .json) | 80x20, 4 frames | an Enchanter's Isle menu icon, 4 frames |
| isle_mini_reseal.png (+ .json) | 80x20, 4 frames | an Enchanter's Isle menu icon, 4 frames |
| isle_pillar_20.png | 13x25 | an Enchanter's Isle pillar |
| isle_pillar_26.png | 13x31 | an Enchanter's Isle pillar |
| lt_coin.png | 5x5 | a coin spilling out of a chest |
| lt_gem.png | 5x6 | a glorp spilling out of a chest |
| lt_gold_body.png | 22x22 | a chest: its body or lid, closed or open (wood, gold, void, mimic) |
| lt_gold_bodyopen.png | 22x22 | a chest: its body or lid, closed or open (wood, gold, void, mimic) |
| lt_gold_lid.png | 22x22 | a chest: its body or lid, closed or open (wood, gold, void, mimic) |
| lt_gold_lidopen.png | 22x22 | a chest: its body or lid, closed or open (wood, gold, void, mimic) |
| lt_mimic_body.png | 22x22 | a chest: its body or lid, closed or open (wood, gold, void, mimic) |
| lt_mimic_bodyopen.png | 22x22 | a chest: its body or lid, closed or open (wood, gold, void, mimic) |
| lt_mimic_lid.png | 22x22 | a chest: its body or lid, closed or open (wood, gold, void, mimic) |
| lt_mimic_lidopen.png | 22x22 | a chest: its body or lid, closed or open (wood, gold, void, mimic) |
| lt_void_body.png | 22x22 | a chest: its body or lid, closed or open (wood, gold, void, mimic) |
| lt_void_bodyopen.png | 22x22 | a chest: its body or lid, closed or open (wood, gold, void, mimic) |
| lt_void_lid.png | 22x22 | a chest: its body or lid, closed or open (wood, gold, void, mimic) |
| lt_void_lidopen.png | 22x22 | a chest: its body or lid, closed or open (wood, gold, void, mimic) |
| lt_wood_body.png | 22x22 | a chest: its body or lid, closed or open (wood, gold, void, mimic) |
| lt_wood_bodyopen.png | 22x22 | a chest: its body or lid, closed or open (wood, gold, void, mimic) |
| lt_wood_lid.png | 22x22 | a chest: its body or lid, closed or open (wood, gold, void, mimic) |
| lt_wood_lidopen.png | 22x22 | a chest: its body or lid, closed or open (wood, gold, void, mimic) |
| lv_enc_rubble.png (+ .json) | 16x16 | the stone an Encased Slime throws |
| map_decor_fire.png (+ .json) | 24x24 | a map decoration |
| map_decor_hills.png (+ .json) | 24x24 | a map decoration |
| map_decor_pines.png (+ .json) | 24x24 | a map decoration |
| map_decor_ruin.png (+ .json) | 24x24 | a map decoration |
| map_decor_skull.png (+ .json) | 24x24 | a map decoration |
| map_vig_camp.png (+ .json) | 224x48, 4 frames | a level's painted scene on the map, 4 frames of 56x48 |
| map_vig_castle.png (+ .json) | 224x48, 4 frames | a level's painted scene on the map, 4 frames of 56x48 |
| map_vig_chasm.png (+ .json) | 224x48, 4 frames | a level's painted scene on the map, 4 frames of 56x48 |
| map_vig_fort.png (+ .json) | 224x48, 4 frames | a level's painted scene on the map, 4 frames of 56x48 |
| map_vig_rift.png (+ .json) | 224x48, 4 frames | a level's painted scene on the map, 4 frames of 56x48 |
| map_vig_storm.png (+ .json) | 224x48, 4 frames | a level's painted scene on the map, 4 frames of 56x48 |
| map_vig_sunken.png (+ .json) | 224x48, 4 frames | a level's painted scene on the map, 4 frames of 56x48 |
| mn_fade.png | 4x64 | a small menu effect (sparkle, ring, glow, fade...) · soft, not pixel-sharp |
| mn_flake.png | 5x5 | a small menu effect (sparkle, ring, glow, fade...) |
| mn_glow.png | 64x64 | a small menu effect (sparkle, ring, glow, fade...) · soft, not pixel-sharp |
| mn_icon_astrolabe.png (+ .json) | 104x26, 4 frames | a weapon's shop icon, 26x26 frames (its idle) |
| mn_icon_ball_lightning.png (+ .json) | 104x26, 4 frames | a weapon's shop icon, 26x26 frames (its idle) |
| mn_icon_barrier_staff.png (+ .json) | 104x26, 4 frames | a weapon's shop icon, 26x26 frames (its idle) |
| mn_icon_conductor.png (+ .json) | 260x26, 10 frames | a weapon's shop icon, 26x26 frames (its idle) |
| mn_icon_cosmic_fists.png (+ .json) | 104x26, 4 frames | a weapon's shop icon, 26x26 frames (its idle) |
| mn_icon_flame_fists.png (+ .json) | 104x26, 4 frames | a weapon's shop icon, 26x26 frames (its idle) |
| mn_icon_flame_sword.png (+ .json) | 104x26, 4 frames | a weapon's shop icon, 26x26 frames (its idle) |
| mn_icon_fractal_shard.png (+ .json) | 104x26, 4 frames | a weapon's shop icon, 26x26 frames (its idle) |
| mn_icon_ice_fists.png (+ .json) | 104x26, 4 frames | a weapon's shop icon, 26x26 frames (its idle) |
| mn_icon_icicle_cannon.png (+ .json) | 104x26, 4 frames | a weapon's shop icon, 26x26 frames (its idle) |
| mn_icon_ignition.png (+ .json) | 104x26, 4 frames | a weapon's shop icon, 26x26 frames (its idle) |
| mn_icon_lightning_fists.png (+ .json) | 104x26, 4 frames | a weapon's shop icon, 26x26 frames (its idle) |
| mn_icon_magma_staff.png (+ .json) | 104x26, 4 frames | a weapon's shop icon, 26x26 frames (its idle) |
| mn_icon_orb_emitter.png (+ .json) | 104x26, 4 frames | a weapon's shop icon, 26x26 frames (its idle) |
| mn_icon_singularity_staff.png (+ .json) | 104x26, 4 frames | a weapon's shop icon, 26x26 frames (its idle) |
| mn_icon_void_blade.png (+ .json) | 104x26, 4 frames | a weapon's shop icon, 26x26 frames (its idle) |
| mn_lv0.png | 132x32 | a level's picture in the menus |
| mn_ring.png | 15x9 | a small menu effect (sparkle, ring, glow, fade...) |
| mn_sea_angler.png | 52x40 | a sea creature in the menus' ocean |
| mn_sea_deep.png | 4x512 | a sea creature in the menus' ocean · soft, not pixel-sharp |
| mn_sea_fish.png | 9x5 | a sea creature in the menus' ocean |
| mn_sea_jelly.png | 22x44 | a sea creature in the menus' ocean |
| mn_sea_manta.png | 96x44 | a sea creature in the menus' ocean |
| mn_sea_squid.png | 48x128 | a sea creature in the menus' ocean |
| mn_sea_whale.png | 192x56 | a sea creature in the menus' ocean |
| mn_shaft.png | 32x128 | a small menu effect (sparkle, ring, glow, fade...) · soft, not pixel-sharp |
| mn_spark.png | 5x5 | a small menu effect (sparkle, ring, glow, fade...) |
| mn_streak.png | 1x5 | a small menu effect (sparkle, ring, glow, fade...) |
| shop_g2_bulwark.png (+ .json) | 96x24, 4 frames | a gadget's icon, 4 frames |
| shop_g2_decoy.png (+ .json) | 96x24, 4 frames | a gadget's icon, 4 frames |
| shop_g2_displacer.png (+ .json) | 96x24, 4 frames | a gadget's icon, 4 frames |
| shop_g2_emp.png (+ .json) | 96x24, 4 frames | a gadget's icon, 4 frames |
| shop_g2_grounding.png (+ .json) | 96x24, 4 frames | a gadget's icon, 4 frames |
| shop_g2_mend.png (+ .json) | 96x24, 4 frames | a gadget's icon, 4 frames |
| shop_g2_smite.png (+ .json) | 96x24, 4 frames | a gadget's icon, 4 frames |
| shop_lantern.png (+ .json) | 64x16, 4 frames | the shop's lantern, 4 frames |
| slime_anchor.png (+ .json) | 224x192, 42 frames | an enemy's recoloured slime body (32x32 frames; 0 and 18 make its idle) |
| slime_armored.png (+ .json) | 224x192, 42 frames | an enemy's recoloured slime body (32x32 frames; 0 and 18 make its idle) |
| slime_bud.png (+ .json) | 224x192, 42 frames | an enemy's recoloured slime body (32x32 frames; 0 and 18 make its idle) |
| slime_ceo.png (+ .json) | 224x192, 42 frames | an enemy's recoloured slime body (32x32 frames; 0 and 18 make its idle) |
| slime_cheer.png (+ .json) | 224x192, 42 frames | an enemy's recoloured slime body (32x32 frames; 0 and 18 make its idle) |
| slime_diver.png (+ .json) | 224x192, 42 frames | an enemy's recoloured slime body (32x32 frames; 0 and 18 make its idle) |
| slime_encased_armor.png (+ .json) | 224x192, 42 frames | an enemy's recoloured slime body (32x32 frames; 0 and 18 make its idle) |
| slime_frost.png (+ .json) | 224x192, 42 frames | an enemy's recoloured slime body (32x32 frames; 0 and 18 make its idle) |
| slime_healer.png (+ .json) | 224x192, 42 frames | an enemy's recoloured slime body (32x32 frames; 0 and 18 make its idle) |
| slime_hunter.png (+ .json) | 224x192, 42 frames | an enemy's recoloured slime body (32x32 frames; 0 and 18 make its idle) |
| slime_hunter_frenzy.png (+ .json) | 224x192, 42 frames | an enemy's recoloured slime body (32x32 frames; 0 and 18 make its idle) |
| slime_leech_cosmic.png (+ .json) | 224x192, 42 frames | the Leech's body in the colour of the element it took |
| slime_leech_fire.png (+ .json) | 224x192, 42 frames | the Leech's body in the colour of the element it took |
| slime_m_armored.png (+ .json) | 224x192, 42 frames | an enemy's own slime body (32x32 frames; 0 and 18 make its idle) |
| slime_m_armored_E.png (+ .json) | 224x192, 42 frames | an enemy's own slime body (32x32 frames; 0 and 18 make its idle) |
| slime_m_armored_N.png (+ .json) | 224x192, 42 frames | an enemy's own slime body (32x32 frames; 0 and 18 make its idle) |
| slime_m_armored_S.png (+ .json) | 224x192, 42 frames | an enemy's own slime body (32x32 frames; 0 and 18 make its idle) |
| slime_m_armored_W.png (+ .json) | 224x192, 42 frames | an enemy's own slime body (32x32 frames; 0 and 18 make its idle) |
| slime_m_bud.png (+ .json) | 224x192, 42 frames | an enemy's own slime body (32x32 frames; 0 and 18 make its idle) |
| slime_m_budcopy.png (+ .json) | 224x192, 42 frames | an enemy's own slime body (32x32 frames; 0 and 18 make its idle) |
| slime_m_ceo.png (+ .json) | 224x192, 42 frames | an enemy's own slime body (32x32 frames; 0 and 18 make its idle) |
| slime_m_conduit.png (+ .json) | 224x192, 42 frames | an enemy's own slime body (32x32 frames; 0 and 18 make its idle) |
| slime_m_encased.png (+ .json) | 224x192, 42 frames | an enemy's own slime body (32x32 frames; 0 and 18 make its idle) |
| slime_m_frostborn.png (+ .json) | 224x192, 42 frames | an enemy's own slime body (32x32 frames; 0 and 18 make its idle) |
| slime_m_gem.png (+ .json) | 224x192, 42 frames | an enemy's own slime body (32x32 frames; 0 and 18 make its idle) |
| slime_m_mortar.png (+ .json) | 224x192, 42 frames | an enemy's own slime body (32x32 frames; 0 and 18 make its idle) |
| slime_m_ranged.png (+ .json) | 224x192, 42 frames | an enemy's own slime body (32x32 frames; 0 and 18 make its idle) |
| slime_m_ripplerunner.png (+ .json) | 224x192, 42 frames | an enemy's own slime body (32x32 frames; 0 and 18 make its idle) |
| slime_m_singularity.png (+ .json) | 224x192, 42 frames | an enemy's own slime body (32x32 frames; 0 and 18 make its idle) |
| slime_m_splitter.png (+ .json) | 224x192, 42 frames | an enemy's own slime body (32x32 frames; 0 and 18 make its idle) |
| slime_m_tidecaller.png (+ .json) | 224x192, 42 frames | an enemy's own slime body (32x32 frames; 0 and 18 make its idle) |
| slime_m_voidsniper.png (+ .json) | 224x192, 42 frames | an enemy's own slime body (32x32 frames; 0 and 18 make its idle) |
| slime_m_waverider.png (+ .json) | 224x192, 42 frames | an enemy's own slime body (32x32 frames; 0 and 18 make its idle) |
| slime_m_wishingwell.png (+ .json) | 224x192, 42 frames | an enemy's own slime body (32x32 frames; 0 and 18 make its idle) |
| slime_shade_fire.png (+ .json) | 224x192, 42 frames | the Adaptive Shade's body in one of its forms |
| slime_shade_ice.png (+ .json) | 224x192, 42 frames | the Adaptive Shade's body in one of its forms |
| slime_shade_lightning.png (+ .json) | 224x192, 42 frames | the Adaptive Shade's body in one of its forms |
| slime_shade_void.png (+ .json) | 224x192, 42 frames | the Adaptive Shade's body in one of its forms |
| slime_smasher.png (+ .json) | 224x192, 42 frames | the Smasher, the Tide Mother's guard: the slime sheet in mantis-shrimp green with blue glints |
| slime_void.png (+ .json) | 64x32, 2 frames | the Void Sovereign's body (two 32x32 frames) |
| slime_volt.png (+ .json) | 64x32, 2 frames | the Voltslime's body (two 32x32 frames) |
| slime_wraith.png (+ .json) | 224x192, 42 frames | an enemy's recoloured slime body (32x32 frames; 0 and 18 make its idle) |
| slime_wraith_ghost.png (+ .json) | 224x192, 42 frames | an enemy's recoloured slime body (32x32 frames; 0 and 18 make its idle) |
| tm_chain.png | 8x5 | a chain link, tiled along the Reservoir's binding chains (light grey, tinted per rune) |
| tm_club.png | 10x7 | a Smasher's club (two ride beside it and snap forward on the strike) |
| tm_statue.png | 14x19 | the Reservoir's rune statue (its rune glows in the dark recess) |
| tm_statue_broken.png | 14x19 | the same statue, broken once its rune is undone |
| tm_sym_tide.png | 16x16 | the tide rune's symbol (the other four runes use the element icons) |
| ui_fragment.png | 9x11 | an ult fragment |
| vfx_aura2_field.png | 256x256 | an effect sprite (white, tinted in game) |
| vfx_aura2_ring.png | 256x256 | an effect sprite (white, tinted in game) |
| vfx_dot.png | 8x8 | an effect sprite (white, tinted in game) · soft, not pixel-sharp |
| vfx_edge.png | 256x256 | an effect sprite (white, tinted in game) · soft, not pixel-sharp |
| vfx_flame.png | 16x24 | an effect sprite (white, tinted in game) · soft, not pixel-sharp |
| vfx_glow.png | 128x128 | an effect sprite (white, tinted in game) · soft, not pixel-sharp |
| vfx_light.png | 128x128 | an effect sprite (white, tinted in game) · soft, not pixel-sharp |
| vfx_ring.png | 64x64 | an effect sprite (white, tinted in game) · soft, not pixel-sharp |
| vfx_rune.png | 64x64 | an effect sprite (white, tinted in game) · soft, not pixel-sharp |
| vfx_shadow.png | 64x64 | an effect sprite (white, tinted in game) · soft, not pixel-sharp |
| vfx_splat.png | 40x40 | an effect sprite (white, tinted in game) |
| vfx_void.png | 192x192 | an effect sprite (white, tinted in game) |
